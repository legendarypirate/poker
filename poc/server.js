const express = require("express");
const WebSocket = require("ws");
const db = require("./app/models");
const cors = require("cors");

const app = express();

// CORS configuration - allow all origins for development (restrict in production)
var corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Allow all origins for development
    callback(null, true);
  },
  credentials: true
};

// Enable CORS
app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the application." });
});
require("./app/routes/user.routes")(app);
require("./app/routes/auth.routes")(app);
require("./app/routes/game.routes")(app);
require("./app/routes/user_statistics.routes")(app);
require("./app/routes/withdrawal.routes")(app);
require("./app/routes/admin.routes")(app);
require("./app/routes/tournament.routes")(app);

// Sync database
db.sequelize
  .sync()
  .then(() => {
    console.log("Synced db.");
  })
  .catch((err) => {
    console.log("Failed to sync db: " + err.message);
  });

// Create HTTP server
const server = app.listen(3001, () => {
  console.log("✅ Server is running on port 3001");
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("error", (error) => {
  console.error("❌ WebSocket Server Error:", error);
});

wss.on("listening", () => {
  console.log("✅ WebSocket server is listening on port 3001");
});

// Game state
const rooms = {};
const roomReadyStatus = new Map();

// Import handlers
const { handleAdminMessage, handleUserAdminMessage, removeAdminConnection, removeAdminChatUser, getUserChat } = require('./websocket/adminHandler');
const { 
  handleGameMessage, 
  handleJoinRoom, 
  handlePlayerDisconnect,
  broadcastToRoom,
  broadcastPlayerCount,
  startGame
} = require('./websocket/gameHandler');
const { startTurnTimer, clearTurnTimer, startAutoStartCountdown, cancelAutoStart } = require('./websocket/timerUtils');
const { handleTournamentMessage } = require('./websocket/tournamentHandler');

// Helper function to create bound broadcast function
function createBroadcastToRoom(rooms) {
  return (roomId, message) => broadcastToRoom(roomId, message, rooms);
}

// Helper function to create bound broadcastPlayerCount
function createBroadcastPlayerCount(rooms) {
  return (roomId) => broadcastPlayerCount(roomId, rooms, wss);
}

// Helper function to create bound startTurnTimer
function createStartTurnTimer(rooms) {
  return (roomId) => {
    const { autoPass } = require('./websocket/gameHandler');
    startTurnTimer(roomId, rooms, createBroadcastToRoom(rooms), (roomId) => {
      autoPass(roomId, rooms, createBroadcastToRoom(rooms), createStartTurnTimer(rooms));
    });
  };
}

wss.on("connection", (ws, req) => {
  console.log(`🔌 New WebSocket connection from ${req.socket.remoteAddress}`);
  console.log(`📡 Request URL: ${req.url}`);
  let roomId = null;
  let player = null;
  let isAdmin = false;

  ws.on("error", (error) => {
    console.error("❌ WebSocket connection error:", error);
  });

  ws.on("message", async (msgStr) => {
    let msg;
    try {
      msg = JSON.parse(msgStr);
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    // Handle admin messages
    if (handleAdminMessage(msg, ws, rooms)) {
      isAdmin = true;
      return;
    }

    // Handle user admin messages (getMessageHistory, joinAdminChat, userToAdminMessage)
    if (handleUserAdminMessage(msg, ws, player, rooms)) {
      return;
    }

    // Handle tournament messages
    const userId = msg.userId || msg.user_id || (player ? player.userId : null);
    if (handleTournamentMessage(msg, ws, userId)) {
      return;
    }

    // Handle join room
    if (msg.type === "joinRoom") {
      handleJoinRoom(msg, ws, rooms, roomReadyStatus, createBroadcastToRoom(rooms), createBroadcastPlayerCount(rooms))
        .then(result => {
          if (result) {
            player = result.player;
            roomId = result.roomId;
          }
        })
        .catch(error => {
          console.error("Error in handleJoinRoom:", error);
          ws.send(JSON.stringify({ type: "error", message: "Error joining room" }));
        });
      return;
    }

    // Handle leave room
    if (msg.type === "leaveRoom") {
      if (!roomId || !rooms[roomId] || !player) {
        ws.send(JSON.stringify({ type: "error", message: "Not in a room" }));
        return;
      }

      // Wrap in async IIFE to handle await properly
      (async () => {
        const { handlePlayerDisconnect } = require('./websocket/gameHandler');
        const { clearPlayerState, getRoomGameId } = require('./websocket/disconnectHandler');
        const { clearTurnTimer, cancelAutoStart } = require('./websocket/timerUtils');
        
        const room = rooms[roomId];
        const gameId = room.gameId || getRoomGameId(roomId);
        
        // If game has finished, remove player immediately
        if (room.gameFinished) {
          room.players = room.players.filter((p) => p.ws !== player.ws);
          
          // Clear player state if exists
          if (player.userId && gameId) {
            await clearPlayerState(player.userId, gameId);
          }
          
          createBroadcastPlayerCount(rooms)(roomId);
          
          // Clean up room if empty
          if (room.players.length === 0) {
            delete rooms[roomId];
            roomReadyStatus.delete(roomId);
            cancelAutoStart(roomId, rooms);
            clearTurnTimer(roomId, rooms);
          }
          
          console.log(`👋 Player ${player.playerId} left room ${roomId} after game finished`);
          player = null;
          roomId = null;
          return;
        } else if (room.gameStarted && !room.gameFinished) {
          // Game is active, handle as disconnect (keep for reconnection within 60 sec)
          // Only allow reconnection if game has started
          await handlePlayerDisconnect(
            roomId, 
            player, 
            rooms, 
            roomReadyStatus, 
            createBroadcastToRoom(rooms), 
            createBroadcastPlayerCount(rooms),
            clearTurnTimer,
            cancelAutoStart,
            createStartTurnTimer(rooms)
          );
          console.log(`👋 Player ${player.playerId} requested to leave room ${roomId} during active game (60s reconnection window)`);
          // Don't clear player/roomId here as they might reconnect within 60 seconds
          return;
        } else {
          // Game not started, remove player normally
          room.players = room.players.filter((p) => p.ws !== player.ws);
          
          if (roomReadyStatus.has(roomId)) {
            const readyStatus = roomReadyStatus.get(roomId);
            readyStatus.delete(player.playerId);
            cancelAutoStart(roomId, rooms);
            
            createBroadcastToRoom(rooms)(roomId, {
              type: "playerReadyStatus",
              status: Object.fromEntries(readyStatus)
            });
          }
          
          createBroadcastPlayerCount(rooms)(roomId);
          
          // Clean up room if empty
          if (room.players.length === 0) {
            delete rooms[roomId];
            roomReadyStatus.delete(roomId);
            cancelAutoStart(roomId, rooms);
            clearTurnTimer(roomId, rooms);
          }
          
          console.log(`👋 Player ${player.playerId} left room ${roomId}`);
          player = null;
          roomId = null;
          return;
        }
      })().catch(error => {
        console.error("Error handling leaveRoom:", error);
        ws.send(JSON.stringify({ type: "error", message: "Error leaving room" }));
      });
      return;
    }

    // Handle game messages
    const { startGame } = require('./websocket/gameHandler');
    if (handleGameMessage(msg, ws, player, roomId, rooms, roomReadyStatus, createBroadcastToRoom(rooms))) {
      return;
    }

    // Silently ignore unknown message types
  });

  ws.on("close", (code, reason) => {
    console.log(`🔌 WebSocket connection closed. Code: ${code}, Reason: ${reason || 'No reason'}`);
    // Remove admin connection
    if (isAdmin) {
      removeAdminConnection(ws);
      return;
    }

    // Remove admin chat user if exists
    removeAdminChatUser(ws);

    // Handle player disconnect
    handlePlayerDisconnect(
      roomId, 
      player, 
      rooms, 
      roomReadyStatus, 
      createBroadcastToRoom(rooms), 
      createBroadcastPlayerCount(rooms),
      (roomId) => clearTurnTimer(roomId, rooms),
      (roomId) => cancelAutoStart(roomId, rooms),
      createStartTurnTimer(rooms)
    );
  });
});
