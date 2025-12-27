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
  console.log("✅ Server is running on port 3043");
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

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
  return (roomId) => broadcastPlayerCount(roomId, rooms);
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

wss.on("connection", (ws) => {
  let roomId = null;
  let player = null;
  let isAdmin = false;

  ws.on("message", (msgStr) => {
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

    // Handle game messages
    const { startGame } = require('./websocket/gameHandler');
    if (handleGameMessage(msg, ws, player, roomId, rooms, roomReadyStatus, createBroadcastToRoom(rooms))) {
      return;
    }

    // Silently ignore unknown message types
  });

  ws.on("close", () => {
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
