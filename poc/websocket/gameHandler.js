const { evaluateHand, canPlayCards } = require('../utils/handEvaluator');
const { removeCardsFromHand } = require('../utils/cardUtils');
const { dealCards, checkRoundOver } = require('../utils/gameLogic');
const { startTurnTimer, clearTurnTimer, startAutoStartCountdown, cancelAutoStart } = require('./timerUtils');
const { getUserChat } = require('./adminHandler');
const { 
  handlePlayerDisconnect: handleDisconnectTimer, 
  handlePlayerReconnect, 
  autoFoldPlayer,
  checkActiveGame,
  createOrUpdatePlayerState,
  clearPlayerState,
  setRoomGameId,
  getRoomGameId
} = require('./disconnectHandler');
const db = require('../app/models');

function broadcastToRoom(roomId, message, rooms) {
  const room = rooms[roomId];
  if (!room) return;

  room.players.forEach((p) => {
    if (p.ws && p.ws.readyState === 1) { // WebSocket.OPEN
      p.ws.send(JSON.stringify(message));
    }
  });
}

function broadcastPlayerCount(roomId, rooms) {
  const room = rooms[roomId];
  if (!room) return;
  const count = room.players.length;

  const message = {
    type: "playerCount",
    roomId,
    players: count,
    maxPlayers: 4,
  };

  broadcastToRoom(roomId, message, rooms);
}

function autoPass(roomId, rooms, broadcastToRoom, startTurnTimerFn) {
  const { clearTurnTimer } = require('./timerUtils');
  const room = rooms[roomId];
  if (!room || room.players.length === 0) {
    console.log(`⚠️ Room ${roomId} not found or empty during auto-pass`);
    clearTurnTimer(roomId, rooms);
    return;
  }

  // Check if currentPlayerIndex is valid
  if (room.currentPlayerIndex === undefined || room.currentPlayerIndex >= room.players.length) {
    console.log(`⚠️ Invalid currentPlayerIndex in room ${roomId}, resetting to 0`);
    room.currentPlayerIndex = 0;
  }

  const currentPlayer = room.players[room.currentPlayerIndex];
  
  // Double-check that currentPlayer exists
  if (!currentPlayer) {
    console.log(`❌ Current player is undefined in room ${roomId}, cannot auto-pass`);
    clearTurnTimer(roomId, rooms);
    return;
  }

  console.log(`⏰ Auto-pass for player ${currentPlayer.playerId} in room ${roomId}`);

  room.passCount++;

  let resetLastPlay = false;

  if (room.passCount >= room.players.length - 1 && room.lastPlay !== null) {
    console.log(`🔄 Round reset in room ${roomId}`);
    room.lastPlay = null;
    room.passCount = 0;
    resetLastPlay = true;
  }

  broadcastToRoom(roomId, {
    type: "opponentPass",
    player: currentPlayer.playerId,
    resetLastPlay,
    autoPassed: true
  }, rooms);

  // Move to next player with bounds checking
  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  
  // Verify the next player exists before starting timer
  const nextPlayer = room.players[room.currentPlayerIndex];
  if (nextPlayer) {
    // Verify rooms still exists before calling startTurnTimerFn
    if (rooms && rooms[roomId]) {
      // startTurnTimerFn expects (roomId) but we need to pass all required params
      // The function is already bound with rooms, broadcastToRoom, and autoPassFn
      startTurnTimerFn(roomId);
      
      broadcastToRoom(roomId, {
        type: "turn",
        player: nextPlayer.playerId,
      }, rooms);
    } else {
      console.log(`⚠️ Room ${roomId} no longer exists, cannot continue turn`);
      clearTurnTimer(roomId, rooms);
    }
  } else {
    console.log(`❌ Next player is undefined in room ${roomId}, cannot continue turn`);
    clearTurnTimer(roomId, rooms);
  }
}

async function startGame(roomId, rooms, roomReadyStatus, broadcastToRoomFn, startTurnTimerFn) {
  const { cancelAutoStart } = require('./timerUtils');
  const { dealCards } = require('../utils/gameLogic');
  const room = rooms[roomId];
  if (!room) {
    console.error(`❌ Room ${roomId} not found when starting game`);
    return;
  }

  console.log(`🎮 Starting game in room ${roomId} with ${room.players.length} players`);
  
  if (roomReadyStatus.has(roomId)) {
    roomReadyStatus.delete(roomId);
  }
  
  // Create game record in database
  try {
    const roomNumber = parseInt(roomId.replace(/\D/g, '')) || parseInt(roomId.replace('room_', '')) || 1;
    const playerUserIds = room.players.map(p => p.userId).filter(Boolean);
    
    const gameRecord = await db.games.create({
      room_id: roomNumber,
      status: 1, // active
      players: playerUserIds,
      buy_in: room.buyIn || null,
      game_type: room.gameType || 'mongol_13',
      start_time: new Date(),
    });

    room.gameId = gameRecord.game_id;
    setRoomGameId(roomId, gameRecord.game_id);

    // Create player states for all players
    for (let player of room.players) {
      if (player.userId) {
        await createOrUpdatePlayerState(player.userId, gameRecord.game_id, true);
      }
    }

    console.log(`✅ Created game record ${gameRecord.game_id} for room ${roomId}`);
  } catch (error) {
    console.error(`❌ Error creating game record:`, error);
  }
  
  // Initialize player points for new game
  room.playerPoints = {};
  for (let player of room.players) {
    room.playerPoints[player.playerId] = 0;
  }
  
  // Mark game as started
  room.gameStarted = true;
  
  cancelAutoStart(roomId, rooms);
  dealCards(roomId, rooms, startTurnTimerFn, broadcastToRoomFn);
  
  console.log(`🚀 Game started in room ${roomId}`);
}

function handleGameMessage(msg, ws, player, roomId, rooms, roomReadyStatus, broadcastToRoom) {
  // Handle messages that don't require being in a room
  if (msg.type === 'getRoomStatuses') {
    const roomStatuses = {};
    for (const [id, room] of Object.entries(rooms)) {
      roomStatuses[id] = room.players.length;
    }
    ws.send(JSON.stringify({
      type: "initialRoomData",
      rooms: roomStatuses
    }));
    return true;
  }

  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: "pong" }));
    return true;
  }

  if (!roomId || !rooms[roomId]) {
    // Silently ignore other messages when not in a room
    return false;
  }

  const room = rooms[roomId];
  const currentPlayer = room.players[room.currentPlayerIndex];

  switch (msg.type) {
    case "playerReady": {
      const { ready } = msg;
      
      if (!roomReadyStatus.has(roomId)) {
        roomReadyStatus.set(roomId, new Map());
      }
      
      const readyStatus = roomReadyStatus.get(roomId);
      readyStatus.set(player.playerId, ready);
      
      broadcastToRoom(roomId, {
        type: "playerReadyStatus",
        status: Object.fromEntries(readyStatus)
      }, rooms);
      
      const readyPlayers = Array.from(readyStatus.values()).filter(Boolean).length;
      const totalPlayers = room.players.length;
      
      console.log(`✅ Player ${player.playerId} ready: ${ready} (${readyPlayers}/${totalPlayers} ready)`);
      
      if (readyPlayers >= 2 && readyPlayers === totalPlayers) {
        console.log(`🚀 All players ready, auto-starting game in room ${roomId}`);
        const { startAutoStartCountdown } = require('./timerUtils');
        const { startTurnTimer } = require('./timerUtils');
        startAutoStartCountdown(roomId, rooms, broadcastToRoom, (roomId) => {
          startGame(roomId, rooms, roomReadyStatus, broadcastToRoom, (roomId) => {
            const boundStartTurnTimer = (roomId) => {
              startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
            };
            boundStartTurnTimer(roomId);
          });
        });
      } else {
        const { cancelAutoStart } = require('./timerUtils');
        cancelAutoStart(roomId, rooms);
      }
      return true;
    }

    case "startGame": {
      const readyStatus = roomReadyStatus.get(roomId);
      const readyPlayers = readyStatus ? Array.from(readyStatus.values()).filter(Boolean).length : 0;
      
      if (readyPlayers >= 2) {
        console.log(`🎮 Manual game start in room ${roomId}`);
        const { cancelAutoStart, startTurnTimer } = require('./timerUtils');
        cancelAutoStart(roomId, rooms);
        startGame(roomId, rooms, roomReadyStatus, broadcastToRoom, (roomId) => {
          const boundStartTurnTimer = (roomId) => {
            startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
          };
          boundStartTurnTimer(roomId);
        });
        
        broadcastToRoom(roomId, {
          type: "gameStart"
        }, rooms);
      } else {
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "Need at least 2 ready players to start" 
        }));
      }
      return true;
    }

    case "autoStartGame": {
      console.log(`⏰ Auto-start triggered for room ${roomId}`);
      const { startTurnTimer } = require('./timerUtils');
      startGame(roomId, rooms, roomReadyStatus, broadcastToRoom, (roomId) => {
        const boundStartTurnTimer = (roomId) => {
          startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
        };
        boundStartTurnTimer(roomId);
      });
      
      broadcastToRoom(roomId, {
        type: "gameStart"
      }, rooms);
      return true;
    }

    case "gameOver": {
      const room = rooms[roomId];
      if (room) {
        room.lastPlay = null;
        room.passCount = 0;
        room.currentPlayerIndex = 0;
        console.log(`🎯 Final game over processed for room ${roomId}`);
      }
      return true;
    }

    case "getReadyStatus": {
      const readyStatus = roomReadyStatus.get(roomId) || new Map();
      ws.send(JSON.stringify({
        type: "playerReadyStatus",
        status: Object.fromEntries(readyStatus)
      }));
      return true;
    }

    case "move": {
      if (!player || player.playerId !== currentPlayer.playerId) {
        ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
        return true;
      }

      if (!msg.cards || !Array.isArray(msg.cards)) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid cards" }));
        return true;
      }

      // Validate card combination
      const handEvaluation = evaluateHand(msg.cards);
      if (handEvaluation.rank === 'Invalid') {
        ws.send(JSON.stringify({ type: "error", message: "Invalid card combination" }));
        return true;
      }

      // Check if play is valid against last play
      if (!canPlayCards(msg.cards, room.lastPlay)) {
        ws.send(JSON.stringify({ type: "error", message: "Cannot play these cards against current play" }));
        return true;
      }

      clearTurnTimer(roomId, rooms);

      room.lastPlay = { cards: msg.cards, evaluation: handEvaluation };
      room.passCount = 0;

      player.hand = removeCardsFromHand(player.hand, msg.cards);

      broadcastToRoom(roomId, {
        type: "opponentMove",
        player: player.playerId,
        cards: msg.cards,
      }, rooms);

      // Check if this move ended the round (player has no cards left)
      let roundEnded = false;
      if (player.hand.length === 0) {
        console.log(`🔍 Player ${player.playerId} played last card, checking round end`);
        roundEnded = checkRoundOver(roomId, rooms, (roomId) => clearTurnTimer(roomId, rooms), (roomId, message) => broadcastToRoom(roomId, message, rooms));
      }

      // Only continue to next player if round didn't end
      if (!roundEnded) {
        const { startTurnTimer } = require('./timerUtils');
        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
        const boundStartTurnTimer = (roomId) => {
          startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
        };
        boundStartTurnTimer(roomId);
        
        broadcastToRoom(roomId, {
          type: "turn",
          player: room.players[room.currentPlayerIndex].playerId,
        }, rooms);
      }
      return true;
    }

    case "pass": {
      if (!player || player.playerId !== currentPlayer.playerId) {
        ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
        return true;
      }

      clearTurnTimer(roomId, rooms);

      const totalPlayers = room.players.length;
      room.passCount++;

      let resetLastPlay = false;

      if (room.passCount >= totalPlayers - 1 && room.lastPlay !== null) {
        console.log(`🔄 Round reset in room ${roomId}`);
        room.lastPlay = null;
        room.passCount = 0;
        resetLastPlay = true;
      }

      broadcastToRoom(roomId, {
        type: "opponentPass",
        player: player.playerId,
        resetLastPlay,
      }, rooms);

      const { startTurnTimer } = require('./timerUtils');
      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % totalPlayers;
      const boundStartTurnTimer = (roomId) => {
        startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
      };
      boundStartTurnTimer(roomId);
      
      broadcastToRoom(roomId, {
        type: "turn",
        player: room.players[room.currentPlayerIndex].playerId,
      }, rooms);
      return true;
    }

    case "restart": {
      if (room.players.length >= 2) {
        const { dealCards } = require('../utils/gameLogic');
        const { startTurnTimer } = require('./timerUtils');
        // Reset for new game completely
        room.playerPoints = {};
        for (let player of room.players) {
          room.playerPoints[player.playerId] = 0;
        }
        room.lastPlay = null;
        room.passCount = 0;
        room.currentPlayerIndex = 0;
        
        const boundStartTurnTimer = (roomId) => {
          startTurnTimer(roomId, rooms, broadcastToRoom, (roomId) => autoPass(roomId, rooms, broadcastToRoom, boundStartTurnTimer));
        };
        dealCards(roomId, rooms, boundStartTurnTimer, broadcastToRoom);
        
        broadcastToRoom(roomId, {
          type: "gameRestarted"
        }, rooms);
      } else {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Need at least 2 players to start",
          })
        );
      }
      return true;
    }

    case "chat": {
      if (!msg.message || typeof msg.message !== 'string') {
        ws.send(JSON.stringify({ type: "error", message: "Invalid chat message" }));
        return true;
      }
  
      broadcastToRoom(roomId, {
        type: "chat",
        player: player.playerId,
        username: player.username,
        message: msg.message,
        timestamp: Date.now(),
      }, rooms);
      return true;
    }

    default:
      return false;
  }
}

async function handleJoinRoom(msg, ws, rooms, roomReadyStatus, broadcastToRoom, broadcastPlayerCount) {
  const requestedRoomId = msg.roomId;
  const username = msg.username;
  const userId = msg.userId || msg.user_id; // Support both formats
  const buyIn = msg.buyIn || msg.buy_in; // Buy-in amount (e.g., 20, 50, 100, 200)
  const gameType = msg.gameType || msg.game_type || 'mongol_13'; // Default game type

  if (!username) {
    ws.send(JSON.stringify({ type: "error", message: "Username is required" }));
    return null;
  }

  // Check if user has an active game (if userId is provided)
  if (userId) {
    const activeGame = await checkActiveGame(userId);
    if (activeGame && activeGame.gameId) {
      // User has an active game
      const gameId = activeGame.gameId;
      const playerState = activeGame.playerState;
      
      // Check if player is trying to rejoin the same room
      const roomNumber = parseInt(requestedRoomId.replace(/\D/g, '')) || null;
      const activeGameRecord = activeGame.game;
      
      if (activeGameRecord && activeGameRecord.room_id === roomNumber) {
        // Trying to rejoin the same game - allow it (will be handled by existing player check)
        console.log(`🔄 User ${userId} attempting to rejoin game ${gameId}`);
      } else {
        // Check if the active game still has connected players
        // If all players left, the game should be finished
        try {
          const activeGameRecord = activeGame.game;
          if (activeGameRecord) {
            // Check if game is still active in database
            const currentGame = await db.games.findByPk(gameId);
            if (!currentGame || currentGame.status !== 1) {
              // Game is already finished, allow joining
              console.log(`✅ Game ${gameId} is already finished, allowing user ${userId} to join new room`);
            } else {
              // Check player states to see if any players are still connected
              const playerStates = await db.player_states.findAll({
                where: { game_id: gameId }
              });
              
              const hasConnectedPlayers = playerStates.some(ps => ps.is_connected === true);
              
              if (!hasConnectedPlayers) {
                // All players disconnected - finish the game
                console.log(`🏁 All players disconnected from game ${gameId}, finishing game`);
                await db.games.update(
                  { status: 2, end_time: new Date() },
                  { where: { game_id: gameId } }
                );
                
                // Clear all player states
                await db.player_states.destroy({
                  where: { game_id: gameId }
                });
                
                // Clear current_game_id for all users in this game
                await db.users.update(
                  { current_game_id: null },
                  { where: { current_game_id: gameId } }
                );
                
                console.log(`✅ Game ${gameId} finished due to all players disconnecting`);
                // Allow user to join new room
              } else {
                // User has an active game in a different room with connected players
                ws.send(JSON.stringify({ 
                  type: "error", 
                  message: "Your current game is not finished. Please finish or wait for your current game to end before joining another room.",
                  activeGameId: gameId
                }));
                return null;
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error checking active game status:`, error);
          // On error, allow joining to prevent blocking
        }
      }
    }
  }

  // Validate balance if buy-in is 20k (value 20)
  if (buyIn === 20) {
    if (!userId) {
      ws.send(JSON.stringify({ 
        type: "error", 
        message: "User ID is required to play in 20k games. Please log in again." 
      }));
      return null;
    }
    
    try {
      const user = await db.users.findByPk(userId);
      if (!user) {
        ws.send(JSON.stringify({ type: "error", message: "User not found" }));
        return null;
      }
      
      const accountBalance = parseFloat(user.account_balance) || 0;
      if (accountBalance < 20000) {
        ws.send(JSON.stringify({ 
          type: "error", 
          message: "Insufficient balance. You need at least 20,000 to play in 20k games. Please deposit funds to continue." 
        }));
        return null;
      }
    } catch (error) {
      console.error("Error checking user balance:", error);
      ws.send(JSON.stringify({ type: "error", message: "Error validating balance" }));
      return null;
    }
  }

  const tournamentId = msg.tournamentId || null;
  
  if (!rooms[requestedRoomId]) {
    rooms[requestedRoomId] = {
      players: [],
      currentPlayerIndex: 0,
      lastPlay: null,
      passCount: 0,
      playerPoints: {},
      buyIn: buyIn || null,
      gameType: gameType,
      tournamentId: tournamentId || null
    };
  } else {
    // Update tournament ID if provided
    if (tournamentId) {
      rooms[requestedRoomId].tournamentId = tournamentId;
    }
  }

  const room = rooms[requestedRoomId];
  
  // If room already has buy-in set, validate it matches
  if (room.buyIn && buyIn && room.buyIn !== buyIn) {
    ws.send(JSON.stringify({ 
      type: "error", 
      message: `This room is for ${room.buyIn}k buy-in. Please select the correct buy-in.` 
    }));
    return null;
  }
  
  // Set buy-in and game type if not already set
  if (!room.buyIn && buyIn) {
    room.buyIn = buyIn;
  }
  if (!room.gameType) {
    room.gameType = gameType;
  }

  // Check if username already exists in the room (reconnection)
  const existingPlayer = room.players.find((p) => p.username === username || (userId && p.userId === userId));
  if (existingPlayer) {
    existingPlayer.ws = ws;
    const player = existingPlayer;
    const roomId = requestedRoomId;

    // Handle reconnection - mark as connected
    if (userId && room.gameId) {
      await handlePlayerReconnect(userId, room.gameId);
    }

    ws.send(
      JSON.stringify({
        type: "roomJoined",
        roomId,
        playerId: player.playerId,
        reconnected: true
      })
    );

    ws.send(
      JSON.stringify({
        type: "seatedPlayers",
        players: room.players.map((p) => ({
          playerId: p.playerId,
          username: p.username,
        })),
      })
    );

    // Send current points if available
    if (room.playerPoints && Object.keys(room.playerPoints).length > 0) {
      ws.send(JSON.stringify({
        type: "gameState",
        points: room.playerPoints,
        gameEnded: false
      }));
    }

    if (roomReadyStatus.has(roomId)) {
      const readyStatus = roomReadyStatus.get(roomId);
      ws.send(JSON.stringify({
        type: "playerReadyStatus",
        status: Object.fromEntries(readyStatus)
      }));
    }

    if (player.hand && player.hand.length > 0) {
      ws.send(JSON.stringify({
        type: "hand",
        hand: player.hand,
        player: player.playerId,
      }));
    }

    if (room.currentPlayerIndex !== undefined) {
      ws.send(
        JSON.stringify({
          type: "turn",
          player: room.players[room.currentPlayerIndex]?.playerId,
        })
      );
    }

    console.log(`🔄 Player ${player.playerId} reconnected to room ${roomId} (${username})`);
    return { player, roomId };
  }

  if (room.players.length >= 4) {
    ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
    return null;
  }

  // Calculate next available playerId (handle gaps from players leaving)
  const existingPlayerIds = room.players.map(p => p.playerId).sort((a, b) => a - b);
  let playerId = 1;
  for (let i = 0; i < existingPlayerIds.length; i++) {
    if (existingPlayerIds[i] === playerId) {
      playerId++;
    } else {
      break;
    }
  }
  
  const player = { ws, playerId, username, hand: [], userId: userId || null };
  room.players.push(player);
  const roomId = requestedRoomId;

  // If game has already started, create/update player state
  if (userId && room.gameId) {
    await createOrUpdatePlayerState(userId, room.gameId, true);
  }

  // Initialize user chat when player joins
  // For admin chat room, use userId if available, otherwise use playerId
  const chatUserId = (requestedRoomId === 'admin_chat_room' && userId) ? userId.toString() : playerId.toString();
  getUserChat(chatUserId, {
    userId: chatUserId,
    username: username,
    roomId: roomId
  });

  // Initialize player points
  if (!room.playerPoints) room.playerPoints = {};
  room.playerPoints[playerId] = 0;

  if (!roomReadyStatus.has(roomId)) {
    roomReadyStatus.set(roomId, new Map());
  }
  const readyStatus = roomReadyStatus.get(roomId);
  readyStatus.set(playerId, false);

  ws.send(
    JSON.stringify({
      type: "roomJoined",
      roomId,
      playerId,
    })
  );

  // Send current room state to the newly joined player immediately
  ws.send(JSON.stringify({
    type: "seatedPlayers",
    players: room.players.map((p) => ({
      playerId: p.playerId,
      username: p.username,
    })),
  }));

  ws.send(JSON.stringify({
    type: "playerReadyStatus",
    status: Object.fromEntries(readyStatus)
  }));

  // Also broadcast to all players (including the new one) for consistency
  broadcastToRoom(roomId, {
    type: "seatedPlayers",
    players: room.players.map((p) => ({
      playerId: p.playerId,
      username: p.username,
    })),
  }, rooms);

  broadcastToRoom(roomId, {
    type: "playerReadyStatus",
    status: Object.fromEntries(readyStatus)
  }, rooms);

  broadcastPlayerCount(roomId, rooms);

  console.log(`🎮 Player ${playerId} joined room ${roomId} (${username})`);

  return { player, roomId };
}

async function finishGameWhenAllPlayersLeft(roomId, room, gameId) {
  if (!gameId || !room.gameStarted) return;

  console.log(`🏁 Finishing game ${gameId} in room ${roomId} - all players disconnected`);

  try {
    // Update game status to finished
    const { updateGameStatusToFinished } = require('../utils/gameLogic');
    await updateGameStatusToFinished(roomId, gameId);

    // Clear player states for all players
    const { clearPlayerState } = require('./disconnectHandler');
    for (const player of room.players) {
      if (player.userId) {
        await clearPlayerState(player.userId, gameId);
      }
    }

    console.log(`✅ Game ${gameId} finished and player states cleared`);
  } catch (error) {
    console.error(`❌ Error finishing game ${gameId}:`, error);
  }
}

async function handlePlayerDisconnect(roomId, player, rooms, roomReadyStatus, broadcastToRoom, broadcastPlayerCount, clearTurnTimer, cancelAutoStart, startTurnTimer) {
  if (!roomId || !rooms[roomId] || !player) return;

  const room = rooms[roomId];
  const gameId = room.gameId || getRoomGameId(roomId);
  
  // If game has started and player has userId, handle disconnect timer
  if (gameId && player.userId && room.gameStarted) {
    await handleDisconnectTimer(
      player.userId, 
      gameId, 
      roomId, 
      rooms,
      (userId, gameId, roomId, rooms) => autoFoldPlayer(userId, gameId, roomId, rooms)
    );
  }
  
  if (roomReadyStatus.has(roomId)) {
    const readyStatus = roomReadyStatus.get(roomId);
    readyStatus.delete(player.playerId);
    
    cancelAutoStart(roomId, rooms);
    
    broadcastToRoom(roomId, {
      type: "playerReadyStatus",
      status: Object.fromEntries(readyStatus)
    }, rooms);
  }

  if (room.currentPlayerIndex !== undefined && 
      room.players[room.currentPlayerIndex]?.playerId === player.playerId) {
    clearTurnTimer(roomId, rooms);
  }

  // Don't remove player from room if game has started - keep them for reconnection
  if (!room.gameStarted) {
    room.players = room.players.filter((p) => p.ws !== player.ws);
  } else {
    // Just mark websocket as null but keep player in room
    const playerIndex = room.players.findIndex(p => p.playerId === player.playerId);
    if (playerIndex !== -1) {
      room.players[playerIndex].ws = null;
    }
  }

  // Check if all players have disconnected from a started game
  const connectedPlayers = room.players.filter(p => p.ws);
  if (room.gameStarted && connectedPlayers.length === 0 && room.players.length > 0) {
    // All players disconnected - finish the game
    await finishGameWhenAllPlayersLeft(roomId, room, gameId);
    
    // Clean up room
    delete rooms[roomId];
    roomReadyStatus.delete(roomId);
    cancelAutoStart(roomId, rooms);
    clearTurnTimer(roomId, rooms);
    console.log(`🧹 Cleaned up room ${roomId} after all players disconnected`);
    return;
  }

  if (room.players.length === 0 || (!room.gameStarted && connectedPlayers.length === 0)) {
    delete rooms[roomId];
    roomReadyStatus.delete(roomId);
    cancelAutoStart(roomId, rooms);
    clearTurnTimer(roomId, rooms);
  } else {
    broadcastToRoom(roomId, {
      type: "playerLeft",
      player: player.playerId,
      username: player.username,
      disconnected: room.gameStarted, // true if game started, false if just left
    }, rooms);

    broadcastPlayerCount(roomId, rooms);

    // Only continue game if there are connected players
    if (room.currentPlayerIndex !== undefined && connectedPlayers.length > 1 && room.gameStarted) {
      // Find next connected player
      let nextIndex = (room.currentPlayerIndex + 1) % room.players.length;
      let attempts = 0;
      while (attempts < room.players.length && (!room.players[nextIndex] || !room.players[nextIndex].ws)) {
        nextIndex = (nextIndex + 1) % room.players.length;
        attempts++;
      }
      
      if (room.players[nextIndex] && room.players[nextIndex].ws) {
        room.currentPlayerIndex = nextIndex;
        startTurnTimer(roomId, rooms, broadcastToRoom, () => {});
        
        broadcastToRoom(roomId, {
          type: "turn",
          player: room.players[room.currentPlayerIndex].playerId,
        }, rooms);
      }
    }
  }

  console.log(`❌ Player ${player.playerId} disconnected from room ${roomId}`);
}

module.exports = {
  handleGameMessage,
  handleJoinRoom,
  handlePlayerDisconnect,
  broadcastToRoom,
  broadcastPlayerCount,
  startGame,
  autoPass
};

