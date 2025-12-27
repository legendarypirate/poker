function startTurnTimer(roomId, rooms, broadcastToRoom, autoPassFn) {
  if (!rooms || !rooms[roomId]) {
    console.log(`⚠️ Rooms object or room ${roomId} not found in startTurnTimer`);
    return;
  }
  
  const room = rooms[roomId];
  if (!room || room.players.length === 0) return;

  const currentPlayer = room.players[room.currentPlayerIndex];
  if (!currentPlayer) {
    console.log(`⚠️ Current player not found in room ${roomId}`);
    return;
  }
  
  broadcastToRoom(roomId, {
    type: "timerUpdate",
    player: currentPlayer.playerId,
    remainingTime: 15,
    totalTime: 15
  }, rooms);

  let timeLeft = 15;
  
  const timerInterval = setInterval(() => {
    // Check if room still exists before each update
    if (!rooms || !rooms[roomId] || !rooms[roomId].players || rooms[roomId].players.length === 0) {
      clearInterval(timerInterval);
      return;
    }
    
    timeLeft--;
    
    broadcastToRoom(roomId, {
      type: "timerUpdate",
      player: currentPlayer.playerId,
      remainingTime: timeLeft,
      totalTime: 15
    }, rooms);

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (rooms[roomId]) {
        rooms[roomId].turnTimer = null;
      }
      if (autoPassFn) {
        autoPassFn(roomId);
      }
    }
  }, 1000);

  room.turnTimer = timerInterval;
}

function clearTurnTimer(roomId, rooms) {
  const room = rooms[roomId];
  if (room && room.turnTimer) {
    clearInterval(room.turnTimer);
    room.turnTimer = null;
  }
}

function startAutoStartCountdown(roomId, rooms, broadcastToRoom, startGame) {
  const room = rooms[roomId];
  if (!room) return;
  
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
  }

  let countdown = 10;
  
  const countdownInterval = setInterval(() => {
    broadcastToRoom(roomId, {
      type: "autoStartCountdown",
      remainingTime: countdown
    });

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      room.autoStartTimer = null;
      startGame(roomId);
    }
    
    countdown--;
  }, 1000);

  room.autoStartTimer = countdownInterval;
}

function cancelAutoStart(roomId, rooms) {
  const room = rooms[roomId];
  if (room && room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
    room.autoStartTimer = null;
  }
}

module.exports = {
  startTurnTimer,
  clearTurnTimer,
  startAutoStartCountdown,
  cancelAutoStart
};

