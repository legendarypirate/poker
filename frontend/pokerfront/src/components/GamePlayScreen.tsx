'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { userStorage } from '@/lib/storage';
import { WebSocketService } from '@/lib/websocket';
import { Card, cardValue } from '@/lib/models/card';
import { HandPlay } from '@/lib/models/hand';
import { evaluateHand, canPlay } from '@/lib/utils/cardEvaluator';
import { getPokerAvatar, getAvatarGradient, formatUserId } from '@/lib/utils/avatarUtils';
import CardComponent from './CardComponent';
import RoundScoreModal from './RoundScoreModal';
import GameOverModal from './GameOverModal';
import toast from 'react-hot-toast';

interface GamePlayScreenProps {
  roomId: string;
}

// Helper function to normalize card data from server
function normalizeCard(card: any): Card | null {
  if (!card) return null;
  
  // If it's already in the correct format
  if (card.rank && card.suit) {
    return { rank: String(card.rank), suit: String(card.suit) };
  }
  
  // If it's a string like "3♠" or "3S"
  if (typeof card === 'string') {
    const match = card.match(/^(\d+|J|Q|K|A|2)([♠♥♦♣]|S|H|D|C)$/);
    if (match) {
      const suitMap: Record<string, string> = {
        'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣'
      };
      return {
        rank: match[1],
        suit: suitMap[match[2]] || match[2]
      };
    }
  }
  
  // If it's an object with different property names
  if (card.value && card.suit) {
    return { rank: String(card.value), suit: String(card.suit) };
  }
  
  console.warn('Could not normalize card:', card);
  return null;
}

function normalizeHand(hand: any): Card[] {
  if (!Array.isArray(hand)) return [];
  return hand.map(normalizeCard).filter((card): card is Card => card !== null);
}

// Sort cards by rank (high to low), matching Flutter/Dart logic
function sortCardsByRank(cards: Card[]): Card[] {
  const suitOrder: Record<string, number> = {
    '♦': 1,
    '♣': 2,
    '♥': 3,
    '♠': 4,
  };

  const sorted = [...cards].sort((a, b) => {
    // First sort by rank value (high to low)
    const rankDiff = cardValue(b.rank) - cardValue(a.rank);
    if (rankDiff !== 0) return rankDiff;
    
    // For same rank, sort by suit order (high to low suit value, matching Flutter logic)
    return (suitOrder[b.suit] || 0) - (suitOrder[a.suit] || 0);
  });

  return sorted;
}

export default function GamePlayScreen({ roomId }: GamePlayScreenProps) {
  const router = useRouter();
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<Card[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [myPlayerId, setMyPlayerId] = useState(1);
  const [gameStarted, setGameStarted] = useState(false);
  const [remainingTime, setRemainingTime] = useState(15);
  const [seatedPlayers, setSeatedPlayers] = useState<any[]>([]);
  const [lastPlay, setLastPlay] = useState<HandPlay | null>(null);
  const [opponentCardCounts, setOpponentCardCounts] = useState<Record<number, number>>({});
  const [playerPoints, setPlayerPoints] = useState<Record<number, number>>({});
  const [playerReadyStatus, setPlayerReadyStatus] = useState<Record<number, boolean>>({});
  const [isReady, setIsReady] = useState(false);
  const [wsService, setWsService] = useState<WebSocketService | null>(null);
  const [myUsername, setMyUsername] = useState<string>('');
  const [myDisplayName, setMyDisplayName] = useState<string>('');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string>('');
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerLastPlayedCards, setPlayerLastPlayedCards] = useState<Record<number, Card[]>>({});
  const [previousPlayerPassed, setPreviousPlayerPassed] = useState(false);
  
  // Modal states
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [roundModalData, setRoundModalData] = useState<{
    pointsUpdate: Record<number, number>;
    roundWinnerId: number;
  } | null>(null);
  
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [gameOverModalData, setGameOverModalData] = useState<{
    winnerId: number;
    finalPoints: Record<number, number>;
    eliminatedPlayers: number[];
    completeSuitWin?: boolean;
    winningSuit?: string;
  } | null>(null);

  useEffect(() => {
    const username = userStorage.getUsername() || 'user';
    const displayName = userStorage.getDisplayName() || '';
    const avatarUrl = userStorage.getAvatarUrl() || '';
    const userId = userStorage.getUserId();
    setMyUsername(username);
    setMyDisplayName(displayName);
    setMyAvatarUrl(avatarUrl);
    setMyUserId(userId);
    
    const ws = new WebSocketService();

    ws.on('playerIdSet', (data: any) => {
      const playerId = typeof data.playerId === 'string' 
        ? parseInt(data.playerId, 10) 
        : data.playerId;
      setMyPlayerId(playerId);
    });

    ws.on('seatedPlayers', (data: any) => {
      console.log('Received seatedPlayers:', data);
      setSeatedPlayers(data.players || data || []);
    });

    // Listen for player join/leave events
    ws.on('playerJoined', (data: any) => {
      console.log('Player joined:', data);
      // Request updated player list
      ws.send({ type: 'getSeatedPlayers' });
    });

    ws.on('playerLeft', (data: any) => {
      console.log('Player left:', data);
      // Request updated player list
      ws.send({ type: 'getSeatedPlayers' });
    });

    ws.on('playerReadyStatus', (data: any) => {
      console.log('Received playerReadyStatus:', data);
      const status = data.status || data || {};
      setPlayerReadyStatus(status);
      // Update local ready state if this is about me
      if (myPlayerId && status[myPlayerId] !== undefined) {
        setIsReady(status[myPlayerId]);
      }
    });

    // Also listen for readyStatusUpdate in case server uses different event name
    ws.on('readyStatusUpdate', (data: any) => {
      console.log('Received readyStatusUpdate:', data);
      const status = data.status || data || {};
      setPlayerReadyStatus(status);
      // Update local ready state if this is about me
      if (myPlayerId && status[myPlayerId] !== undefined) {
        setIsReady(status[myPlayerId]);
      }
    });

    // Listen for playerReady response/confirmation
    ws.on('playerReady', (data: any) => {
      console.log('Received playerReady confirmation:', data);
      if (data.status) {
        setPlayerReadyStatus(data.status);
      }
      if (data.playerId === myPlayerId && data.ready !== undefined) {
        setIsReady(data.ready);
      }
    });

    ws.on('gameStart', (data: any) => {
      console.log('gameStart event:', data);
      setGameStarted(true);
      // Clear last played cards when game starts
      setPlayerLastPlayedCards({});
      setPreviousPlayerPassed(false);
      // If hand is included in gameStart, set it
      if (data?.hand) {
        const normalizedHand = normalizeHand(data.hand);
        if (normalizedHand.length > 0) {
          const sortedHand = sortCardsByRank(normalizedHand);
          console.log('Setting player hand from gameStart:', sortedHand);
          setPlayerHand(sortedHand);
        }
      }
      // Request game state and hand
      ws.send({ type: 'getGameState' });
      ws.send({ type: 'getHand' });
    });

    ws.on('handReceived', (data: any) => {
      console.log('handReceived event:', data);
      // Handle different possible data formats
      const hand = data.hand || data.cards || data;
      const normalizedHand = normalizeHand(hand);
      if (normalizedHand.length > 0) {
        const sortedHand = sortCardsByRank(normalizedHand);
        console.log('Setting player hand:', sortedHand);
        setPlayerHand(sortedHand);
      } else {
        console.warn('handReceived: Invalid hand data format', data);
      }
      setGameStarted(true);
      setRemainingTime(15);
    });

    // Listen for 'hand' event (backend sends this, not 'handReceived')
    ws.on('hand', (data: any) => {
      console.log('hand event:', data);
      // Clear last played cards when new hand is dealt (new round)
      setPlayerLastPlayedCards({});
      setPreviousPlayerPassed(false);
      // Handle different possible data formats
      const hand = data.hand || data.cards || data;
      const normalizedHand = normalizeHand(hand);
      if (normalizedHand.length > 0) {
        const sortedHand = sortCardsByRank(normalizedHand);
        console.log('Setting player hand from hand event:', sortedHand);
        setPlayerHand(sortedHand);
        setGameStarted(true);
        setRemainingTime(15);
      } else {
        console.warn('hand event: Invalid hand data format', data);
      }
    });

    ws.on('turnUpdate', (data: any) => {
      const playerId = typeof data.player === 'string' ? parseInt(data.player, 10) : data.player;
      const time = data.time || data.remainingTime || 15;
      console.log('turnUpdate received:', { playerId, time, myPlayerId });
      setCurrentPlayer(playerId);
      setRemainingTime(time);
    });

    // Also listen for 'turn' event in case server uses that
    ws.on('turn', (data: any) => {
      const playerId = typeof data.player === 'string' ? parseInt(data.player, 10) : data.player;
      const time = data.remainingTime || data.time || 15;
      console.log('turn event received:', { playerId, remainingTime: time, myPlayerId });
      setCurrentPlayer(playerId);
      setRemainingTime(time);
    });

    ws.on('opponentMove', (data: any) => {
      console.log('opponentMove received:', data);
      const normalizedMove = normalizeHand(data.move || data.cards || []);
      if (normalizedMove.length === 0) {
        console.warn('opponentMove: No cards in move', data);
        return;
      }
      const play = evaluateHand(normalizedMove);
      const playerId = typeof data.player === 'string' ? parseInt(data.player, 10) : data.player;
      
      console.log('opponentMove: Player', playerId, 'played', normalizedMove.length, 'cards');
      
      // Update lastPlay for all players (including current player)
      setLastPlay(play);
      // Reset previousPlayerPassed since someone just played cards
      setPreviousPlayerPassed(false);
      
      // Store the last played cards for this player
      setPlayerLastPlayedCards((prev) => ({
        ...prev,
        [playerId]: normalizedMove,
      }));
      
      // Update opponent card counts (for all players except current player)
      if (playerId !== myPlayerId) {
        setOpponentCardCounts((prev) => ({
          ...prev,
          [playerId]: (prev[playerId] || 13) - (normalizedMove.length || 0),
        }));
      } else {
        // For current player, update card count from hand length
        // This is handled by removing cards from playerHand in handlePlayCards
      }
      
      // Immediately request game state to get updated turn after a move
      // This is critical to ensure turn advances correctly after web player discards
      if (ws.isConnected()) {
        ws.send({ type: 'getGameState' });
      }
      
      // Also request again after a short delay to ensure we get the latest turn update
      setTimeout(() => {
        if (ws.isConnected()) {
          ws.send({ type: 'getGameState' });
        }
      }, 300);
    });

    ws.on('opponentPass', (data: any) => {
      console.log('opponentPass received:', data);
      if (data.shouldReset) {
        console.log('Round reset - clearing lastPlay');
        setLastPlay(null);
        setPreviousPlayerPassed(false);
        // Clear all player last played cards when round resets
        setPlayerLastPlayedCards({});
      } else {
        // When a player passes (but round doesn't reset), mark that previous player passed
        // This allows the next player to play any hand, not required to beat the previous hand
        console.log('Player passed - next player can play any hand');
        setPreviousPlayerPassed(true);
        setLastPlay(null);
      }
      // Request game state to sync lastPlay properly - this ensures we get the correct state
      // especially important when round resets and lastPlay should be null
      if (ws.isConnected()) {
        // Request immediately and also after a short delay to ensure server has processed
        ws.send({ type: 'getGameState' });
        setTimeout(() => {
          if (ws.isConnected()) {
            ws.send({ type: 'getGameState' });
          }
        }, 200);
      }
    });

    ws.on('gameState', (data: any) => {
      console.log('gameState event:', data);
      if (data.points) setPlayerPoints(data.points);
      if (data.hand) {
        const normalizedHand = normalizeHand(data.hand);
        if (normalizedHand.length > 0) {
          const sortedHand = sortCardsByRank(normalizedHand);
          console.log('Setting player hand from gameState:', sortedHand);
          setPlayerHand(sortedHand);
        }
      }
      if (data.currentPlayer !== undefined) {
        const playerId = typeof data.currentPlayer === 'string' 
          ? parseInt(data.currentPlayer, 10) 
          : data.currentPlayer;
        const oldPlayer = currentPlayer;
        console.log('Current player updated from gameState:', playerId, 'myPlayerId:', myPlayerId, 'oldPlayer:', oldPlayer);
        setCurrentPlayer(playerId);
        // If turn changed, also update remaining time if provided
        if (oldPlayer !== playerId && data.remainingTime !== undefined) {
          setRemainingTime(data.remainingTime);
        }
      }
      if (data.remainingTime !== undefined && data.currentPlayer === myPlayerId) {
        setRemainingTime(data.remainingTime);
      }
      // Update lastPlay - explicitly handle null/undefined to reset when round resets
      // But if previousPlayerPassed is true, don't override it (keep it null to allow any play)
      if (data.lastPlay === null || data.lastPlay === undefined) {
        setLastPlay(null);
        console.log('Last play reset from gameState (round reset)');
      } else if (data.lastPlay && !previousPlayerPassed) {
        // Only update lastPlay from gameState if previous player didn't pass
        // If previous player passed, we want to keep lastPlay as null to allow any play
        const normalizedLastPlay = normalizeHand(data.lastPlay);
        if (normalizedLastPlay.length > 0) {
          const play = evaluateHand(normalizedLastPlay);
          setLastPlay(play);
          console.log('Last play updated from gameState:', play.rank, normalizedLastPlay.length, 'cards');
        } else {
          // If lastPlay is empty array, reset it
          setLastPlay(null);
        }
      }
      if (data.ended) {
        toast.success('Тоглоом дууслаа!');
      }
    });

    // Handle round over event
    ws.on('roundOver', (data: any) => {
      console.log('roundOver event:', data);
      try {
        const rawPoints = data.points || {};
        const rawTotalPoints = data.totalPoints || {};
        
        // Convert string keys to numbers
        const pointsUpdate: Record<number, number> = {};
        const totalPoints: Record<number, number> = {};
        
        Object.entries(rawPoints).forEach(([key, value]) => {
          pointsUpdate[parseInt(key, 10)] = value as number;
        });
        
        Object.entries(rawTotalPoints).forEach(([key, value]) => {
          totalPoints[parseInt(key, 10)] = value as number;
        });
        
        const winnerId = typeof data.winner === 'string' 
          ? parseInt(data.winner, 10) 
          : data.winner;
        
        // Update total points
        setPlayerPoints(totalPoints);
        
        // Show round modal
        setRoundModalData({
          pointsUpdate,
          roundWinnerId: winnerId,
        });
        setShowRoundModal(true);
      } catch (e) {
        console.error('❌ Error parsing round over:', e);
      }
    });

    // Handle game over event
    ws.on('gameOver', async (data: any) => {
      console.log('gameOver event:', data);
      try {
        const rawPoints = data.points || {};
        const pointsUpdate: Record<number, number> = {};
        
        Object.entries(rawPoints).forEach(([key, value]) => {
          pointsUpdate[parseInt(key, 10)] = value as number;
        });
        
        const eliminatedPlayers = Array.isArray(data.eliminatedPlayers)
          ? data.eliminatedPlayers.map((id: any) => 
              typeof id === 'string' ? parseInt(id, 10) : id
            )
          : [];
        
        const winnerId = typeof data.winner === 'string' 
          ? parseInt(data.winner, 10) 
          : data.winner;
        
        // Update points
        setPlayerPoints(pointsUpdate);
        
        // Refresh user balance after game finishes
        try {
          const { authAPI } = await import('@/lib/api');
          const response = await authAPI.getCurrentUser();
          if (response.success && response.user) {
            const { userStorage } = await import('@/lib/storage');
            userStorage.setUser(response.user);
            console.log('✅ Balance refreshed after game:', response.user.account_balance);
          }
        } catch (balanceError) {
          console.error('❌ Error refreshing balance:', balanceError);
        }
        
        // Show game over modal
        setGameOverModalData({
          winnerId,
          finalPoints: pointsUpdate,
          eliminatedPlayers,
          completeSuitWin: data.completeSuitWin || false,
          winningSuit: data.winningSuit || null,
        });
        setShowGameOverModal(true);
      } catch (e) {
        console.error('❌ Error parsing game over:', e);
      }
    });

    ws.on('connected', () => {
      setIsConnected(true);
      console.log('✅ WebSocket connected successfully');
      // Send joinRoom message to actually join the room
      ws.send({ 
        type: 'joinRoom',
        username: username,
        roomId: roomId,
        userId: userStorage.getUserId() || null,
        buyIn: userStorage.get('selected_buy_in') || null,
        displayName: displayName,
        avatarUrl: avatarUrl
      });
    });

    // Add a catch-all message listener for debugging
    ws.on('message', (data: any) => {
      if (data.type && !['ping', 'pong'].includes(data.type)) {
        console.log('WebSocket message received:', data.type, data);
      }
    });

    ws.on('roomJoined', (data: any) => {
      console.log('Room joined:', data);
      const playerId = typeof data.playerId === 'string' 
        ? parseInt(data.playerId, 10) 
        : data.playerId;
      setMyPlayerId(playerId);
      // Request current player list after joining
      ws.send({ type: 'getSeatedPlayers' });
    });

    ws.on('disconnected', () => {
      setIsConnected(false);
      console.log('🔌 WebSocket disconnected');
    });

    ws.on('error', (data: any) => {
      setIsConnected(false);
      const errorMsg = data.message || 'WebSocket холболт амжилтгүй боллоо. Серверийг шалгана уу.';
      toast.error(errorMsg);
      console.error('WebSocket error:', data);
    });

    ws.connect(username, roomId);
    setWsService(ws);

    // Request player list after a short delay to ensure connection is established
    const requestPlayersTimer = setTimeout(() => {
      if (ws.isConnected()) {
        ws.send({ type: 'getSeatedPlayers' });
      }
    }, 500);

    // Periodically refresh player list to ensure sync (every 3 seconds)
    const refreshInterval = setInterval(() => {
      if (ws.isConnected() && !gameStarted) {
        ws.send({ type: 'getSeatedPlayers' });
      }
    }, 3000);

    return () => {
      clearTimeout(requestPlayersTimer);
      clearInterval(refreshInterval);
      ws.disconnect();
    };
  }, [roomId]);

  const handleCardClick = (card: Card) => {
    console.log('Card clicked:', card);
    if (!card || !card.rank || !card.suit) {
      console.error('Invalid card clicked:', card);
      return;
    }
    // Only allow selection during your turn
    if (!isMyTurn && gameStarted) {
      toast.error('Энэ таны эргэлт биш байна');
      return;
    }
    setSelectedCards((prev) => {
      const isSelected = prev.some(c => c.rank === card.rank && c.suit === card.suit);
      if (isSelected) {
        return prev.filter(c => !(c.rank === card.rank && c.suit === card.suit));
      } else {
        return [...prev, card];
      }
    });
  };

  const handleClearSelection = () => {
    setSelectedCards([]);
  };

  const handlePlayCards = () => {
    if (!wsService || selectedCards.length === 0) return;

    const play = evaluateHand(selectedCards);
    if (play.rank === 'Invalid') {
      toast.error('Хүчингүй карт сонголт');
      console.error('Invalid hand evaluation:', selectedCards, play);
      return;
    }

    // Debug logging
    console.log('Attempting to play:', {
      selectedCards,
      playRank: play.rank,
      lastPlay: lastPlay ? { rank: lastPlay.rank, cards: lastPlay.cards } : null,
      canPlay: canPlay(selectedCards, lastPlay)
    });

    // If previous player passed, allow any valid hand (don't require beating lastPlay)
    const effectiveLastPlay = previousPlayerPassed ? null : lastPlay;
    
    // Client-side validation - block invalid plays to prevent cards from being discarded
    const clientSideCanPlay = canPlay(selectedCards, effectiveLastPlay);
    
    if (!clientSideCanPlay && effectiveLastPlay) {
      // Show error message and block the play
      console.warn('⚠️ Client-side validation failed:', {
        playRank: play.rank,
        lastPlayRank: effectiveLastPlay.rank,
        playCards: selectedCards.map(c => `${c.rank}${c.suit}`),
        lastPlayCards: effectiveLastPlay.cards.map(c => `${c.rank}${c.suit}`),
        playCardValues: selectedCards.map(c => ({ rank: c.rank, value: cardValue(c.rank), suit: c.suit })),
        lastPlayCardValues: effectiveLastPlay.cards.map(c => ({ rank: c.rank, value: cardValue(c.rank), suit: c.suit }))
      });
      
      const errorMsg = `Энэ картуудыг тоглох боломжгүй. Та ${play.rank} тоглож байна, гэхдээ ${effectiveLastPlay.rank} давах шаардлагатай.`;
      toast.error(errorMsg);
      
      // Don't send to backend and don't remove cards - validation failed
      return;
    }

    // Validation passed - proceed with sending to backend
    // Immediately update lastPlay to show in center (optimistic update)
    setLastPlay(play);
    // Reset previousPlayerPassed since we just played cards
    setPreviousPlayerPassed(false);

    // Use 'move' type to match Flutter app and server expectations
    // Send cards in the same format as Flutter: array of {rank, suit} objects
    const cardsToSend = selectedCards.map(card => ({
      rank: card.rank,
      suit: card.suit
    }));
    
    console.log('Sending move to backend:', {
      type: 'move',
      cards: cardsToSend,
      playRank: play.rank
    });
    
    wsService.send({
      type: 'move',
      cards: cardsToSend,
    });

    // Store the last played cards for current player
    setPlayerLastPlayedCards((prev) => ({
      ...prev,
      [myPlayerId]: selectedCards,
    }));

    // Only remove cards from hand after validation passes
    setPlayerHand((prev) =>
      prev.filter(
        (card) =>
          !selectedCards.some(
            (selected) => selected.rank === card.rank && selected.suit === card.suit
          )
      )
    );
    setSelectedCards([]);
    
    // Request game state and turn update after playing to ensure turn advances correctly
    // This ensures mobile player sees the correct turn after web player plays
    setTimeout(() => {
      if (wsService.isConnected()) {
        wsService.send({ type: 'getGameState' });
      }
    }, 100);
    
    // Also request turn update after a slightly longer delay to ensure server has processed
    setTimeout(() => {
      if (wsService.isConnected()) {
        wsService.send({ type: 'getGameState' });
      }
    }, 500);
  };

  const handlePass = () => {
    if (!wsService) return;
    wsService.send({ type: 'pass' });
    setSelectedCards([]);
  };

  const handleAdvice = () => {
    if (!isMyTurn || playerHand.length === 0) {
      toast.error('Таны ээлж биш байна');
      return;
    }

    // Suggest starting move if no last play
    if (!lastPlay) {
      suggestStartingMove();
    } else {
      suggestCounterMove();
    }
  };

  const suggestStartingMove = () => {
    const possiblePlays: Card[][] = [];

    // Single cards
    for (const card of playerHand) {
      possiblePlays.push([card]);
    }

    // Pairs
    const rankCount: Record<string, Card[]> = {};
    for (const card of playerHand) {
      if (!rankCount[card.rank]) rankCount[card.rank] = [];
      rankCount[card.rank].push(card);
    }

    for (const cards of Object.values(rankCount)) {
      if (cards.length >= 2) {
        possiblePlays.push(cards.slice(0, 2));
      }
      if (cards.length >= 3) {
        possiblePlays.push(cards.slice(0, 3));
      }
    }

    // Sort by size then value
    possiblePlays.sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      return cardValue(a[0].rank) - cardValue(b[0].rank);
    });

    if (possiblePlays.length > 0) {
      setSelectedCards(possiblePlays[0]);
      toast.success('Зөвлөгөө: ' + possiblePlays[0].length + ' карт сонгосон');
    } else {
      toast.error('Тоглох боломжгүй');
    }
  };

  const suggestCounterMove = () => {
    if (!lastPlay) return;

    const requiredSize = lastPlay.cards.length;
    const possiblePlays: Card[][] = [];

    // Find all combinations of the required size
    const rankCount: Record<string, Card[]> = {};
    for (const card of playerHand) {
      if (!rankCount[card.rank]) rankCount[card.rank] = [];
      rankCount[card.rank].push(card);
    }

    // Check for matching size combinations
    if (requiredSize === 1) {
      for (const card of playerHand) {
        if (cardValue(card.rank) > cardValue(lastPlay.cards[0].rank)) {
          possiblePlays.push([card]);
        }
      }
    } else if (requiredSize === 2) {
      for (const cards of Object.values(rankCount)) {
        if (cards.length >= 2) {
          const pair = cards.slice(0, 2);
          if (cardValue(pair[0].rank) > cardValue(lastPlay.cards[0].rank)) {
            possiblePlays.push(pair);
          }
        }
      }
    } else if (requiredSize === 3) {
      for (const cards of Object.values(rankCount)) {
        if (cards.length >= 3) {
          const triple = cards.slice(0, 3);
          if (cardValue(triple[0].rank) > cardValue(lastPlay.cards[0].rank)) {
            possiblePlays.push(triple);
          }
        }
      }
    }

    // Sort by value
    possiblePlays.sort((a, b) => cardValue(a[0].rank) - cardValue(b[0].rank));

    if (possiblePlays.length > 0) {
      setSelectedCards(possiblePlays[0]);
      toast.success('Зөвлөгөө: ' + possiblePlays[0].length + ' карт сонгосон');
    } else {
      toast.error('Тоглох боломжгүй - ӨНЖИХ хэрэгтэй');
    }
  };

  const handleReady = (newReadyState: boolean) => {
    console.log('handleReady called:', { newReadyState, isConnected, myPlayerId });
    
    if (!wsService) {
      toast.error('WebSocket холболт байхгүй байна');
      return;
    }

    if (!isConnected) {
      toast.error('Серверт холбогдоогүй байна. Хүлээгээд дахин оролдоно уу.');
      return;
    }

    if (!myPlayerId) {
      toast.error('Тоглогчийн ID олдсонгүй. Хүлээгээд дахин оролдоно уу.');
      return;
    }

    // Optimistically update UI
    setIsReady(newReadyState);
    // Also optimistically update the playerReadyStatus
    setPlayerReadyStatus((prev) => {
      const updated = {
        ...prev,
        [myPlayerId]: newReadyState,
      };
      console.log('Updated playerReadyStatus:', updated);
      return updated;
    });
    
    try {
      const message = {
        type: 'playerReady',
        ready: newReadyState,
      };
      console.log('Sending ready status:', message);
      wsService.send(message);
      toast.success(newReadyState ? 'Бэлэн төлөвт шилжлээ ✓' : 'Бэлэн төлөв цуцлагдлаа');
    } catch (error) {
      // Revert on error
      setIsReady(!newReadyState);
      setPlayerReadyStatus((prev) => ({
        ...prev,
        [myPlayerId]: !newReadyState,
      }));
      toast.error('Алдаа гарлаа. Дахин оролдоно уу.');
      console.error('Error sending ready status:', error);
    }
  };

  // Ensure both are numbers for comparison
  const isMyTurn = gameStarted && 
    myPlayerId !== null && 
    myPlayerId !== undefined && 
    currentPlayer !== null && 
    currentPlayer !== undefined &&
    Number(currentPlayer) === Number(myPlayerId);

  // Sync local ready state with server state
  useEffect(() => {
    if (myPlayerId && playerReadyStatus[myPlayerId] !== undefined) {
      setIsReady(playerReadyStatus[myPlayerId]);
    }
  }, [myPlayerId, playerReadyStatus]);

  // Retry requesting hand if game started but hand is empty
  useEffect(() => {
    if (!gameStarted || playerHand.length > 0 || !wsService || !isConnected) {
      return;
    }

    // Request hand after a short delay
    const retryTimeout = setTimeout(() => {
      if (playerHand.length === 0 && wsService.isConnected()) {
        console.log('Hand still empty, requesting again...');
        wsService.send({ type: 'getHand' });
      }
    }, 2000);

    // Retry again after 5 seconds if still no hand
    const retryTimeout2 = setTimeout(() => {
      if (playerHand.length === 0 && wsService.isConnected()) {
        console.log('Hand still empty after 5s, requesting again...');
        wsService.send({ type: 'getHand' });
      }
    }, 5000);

    return () => {
      clearTimeout(retryTimeout);
      clearTimeout(retryTimeout2);
    };
  }, [gameStarted, playerHand.length, wsService, isConnected]);

  // Periodically sync game state during gameplay to ensure both players stay in sync
  // This helps fix issues where mobile player doesn't see web player's moves or turn updates
  useEffect(() => {
    if (!gameStarted || !wsService || !isConnected) {
      return;
    }

    const gameStateSyncInterval = setInterval(() => {
      if (wsService.isConnected()) {
        wsService.send({ type: 'getGameState' });
      }
    }, 2000); // Sync every 2 seconds during gameplay

    return () => {
      clearInterval(gameStateSyncInterval);
    };
  }, [gameStarted, wsService, isConnected]);

  // Countdown timer effect - decrease remaining time every second when it's someone's turn
  useEffect(() => {
    if (!gameStarted || remainingTime <= 0) {
      return;
    }

    const timerInterval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timerInterval);
    };
  }, [gameStarted, currentPlayer, remainingTime]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Royal Poker Table Background with Felt Texture */}
      <div className="absolute inset-0">
        {/* Base felt gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, #1a5f2e 0%, #0d3d1f 40%, #051a0d 100%)',
          }}
        />
        
        {/* Felt texture overlay */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px),
              radial-gradient(circle at 20% 30%, rgba(34, 197, 94, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(22, 163, 74, 0.1) 0%, transparent 50%)
            `,
            backgroundSize: '100% 100%, 100% 100%, 150% 150%, 150% 150%',
          }}
        />
        
        {/* Royal table border glow */}
        <div
          className="absolute inset-0"
          style={{
            boxShadow: 'inset 0 0 100px rgba(251, 191, 36, 0.1), inset 0 0 200px rgba(34, 197, 94, 0.05)',
          }}
        />
        
        {/* Animated light rays */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{
            background: [
              'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.05) 0%, transparent 50%)',
              'radial-gradient(circle at 70% 70%, rgba(251, 191, 36, 0.05) 0%, transparent 50%)',
              'radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 0.05) 0%, transparent 50%)',
            ],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>
      
      {/* Royal Table Surface */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          className="w-[90%] h-[80%] rounded-full border-8 shadow-2xl relative overflow-hidden"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #3D7C47 0%, #2D5F3F 30%, #1A4D2E 60%, #0D2818 100%)',
            borderColor: '#fbbf24',
            boxShadow: '0 0 60px rgba(251, 191, 36, 0.4), inset 0 0 100px rgba(0, 0, 0, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5)',
          }}
          animate={{
            boxShadow: [
              '0 0 60px rgba(251, 191, 36, 0.4), inset 0 0 100px rgba(0, 0, 0, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5)',
              '0 0 80px rgba(251, 191, 36, 0.6), inset 0 0 100px rgba(0, 0, 0, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5)',
              '0 0 60px rgba(251, 191, 36, 0.4), inset 0 0 100px rgba(0, 0, 0, 0.3), 0 20px 60px rgba(0, 0, 0, 0.5)',
            ],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          {/* Inner table glow */}
          <div className="absolute inset-4 rounded-full" style={{
            boxShadow: 'inset 0 0 80px rgba(251, 191, 36, 0.15)',
          }} />
          
          {/* Decorative center pattern */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full opacity-10" style={{
            background: 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
          }} />
        </motion.div>
      </div>

      {/* Players */}
      {gameStarted && seatedPlayers.length > 0 && (
        <div className="absolute inset-0">
          {seatedPlayers.map((player, idx) => {
            const playerId = player.playerId;
            const isCurrent = currentPlayer === playerId;
            const isMe = playerId === myPlayerId;
            const cardCount = playerId !== myPlayerId 
              ? (opponentCardCounts[playerId] ?? (player.cardCount ?? 13))
              : playerHand.length;
            const points = playerPoints[playerId] ?? 0;
            const isEliminated = points >= 30;
            const lastPlayedCards = playerLastPlayedCards[playerId] || [];
            // Get avatar URL - check multiple possible fields and ensure it's a valid URL
            let avatarUrl = player.avatar_url || player.avatarUrl || '';
            // Clean up avatar URL - remove any whitespace and validate
            if (avatarUrl && typeof avatarUrl === 'string') {
              avatarUrl = avatarUrl.trim();
              // If it's not a valid URL (doesn't start with http/https/data), treat as empty
              if (avatarUrl && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://') && !avatarUrl.startsWith('data:')) {
                console.warn('Invalid avatar URL format for player', playerId, avatarUrl);
                avatarUrl = '';
              }
            } else {
              avatarUrl = '';
            }
            const displayName = player.displayName || player.username || `Player ${playerId}`;
            const playerUserId = player.userId || player.user_id || null;
            const pokerAvatar = getPokerAvatar(playerUserId, avatarUrl, displayName);
            const avatarGradient = getAvatarGradient(playerUserId);
            const formattedUserId = formatUserId(playerUserId);

            let position = 'top-10 left-1/2 -translate-x-1/2';
            if (idx === 1) {
              position = 'top-20 right-10';
            }
            if (idx === 2) {
              position = 'bottom-10 left-10';
            }
            if (idx === 3) {
              position = 'top-20 left-10';
            }

            // Calculate timer progress (0 to 1)
            const timerProgress = remainingTime / 15;
            const showTimer = isCurrent && !isEliminated;

            return (
              <div key={playerId}>
                {/* Player Avatar with Timer Indicator */}
                <div className={`absolute ${position} z-30`}>
                  <div className="relative">
                    {/* Timer Circle Indicator - only for current player or me */}
                    {(showTimer || isMe) && (
                      <svg 
                        className="absolute inset-0 w-16 h-16 -rotate-90"
                        style={{ 
                          width: '64px', 
                          height: '64px',
                          filter: showTimer ? 'drop-shadow(0 0 8px rgba(255, 193, 7, 0.8))' : 'none'
                        }}
                      >
                        {/* Background circle */}
                        <circle
                          cx="32"
                          cy="32"
                          r="28"
                          fill="none"
                          stroke={isMe ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 193, 7, 0.2)'}
                          strokeWidth="3"
                        />
                        {/* Timer progress circle */}
                        {showTimer && (
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            fill="none"
                            stroke={remainingTime <= 5 ? '#FF4757' : '#FFC107'}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - timerProgress)}`}
                            className="transition-all duration-1000"
                          />
                        )}
                        {/* My player indicator (blue border) */}
                        {isMe && !showTimer && (
                          <circle
                            cx="32"
                            cy="32"
                            r="30"
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            className="animate-pulse"
                          />
                        )}
                      </svg>
                    )}
                    {/* Royal Avatar */}
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl border-3 overflow-hidden relative ${
                        isCurrent && !isEliminated
                          ? 'border-[#FFC107] shadow-lg shadow-[#FFC107]/50'
                          : isMe
                          ? 'border-[#3B82F6] shadow-lg shadow-[#3B82F6]/50'
                          : 'border-white/30'
                      }`}
                      style={{
                        background: avatarUrl 
                          ? 'transparent'
                          : avatarGradient,
                        borderWidth: '3px',
                        boxShadow: isCurrent && !isEliminated
                          ? '0 0 20px rgba(255, 193, 7, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.1)'
                          : isMe
                          ? '0 0 20px rgba(59, 130, 246, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.1)'
                          : '0 4px 12px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      {avatarUrl && avatarUrl.trim() !== '' ? (
                        <img 
                          src={avatarUrl} 
                          alt={displayName}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            // If image fails to load, show first letter as fallback
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              // Remove any existing fallback
                              const existingFallback = parent.querySelector('span');
                              if (existingFallback) {
                                existingFallback.remove();
                              }
                              // Add new fallback with first letter
                              const fallback = document.createElement('span');
                              fallback.className = 'drop-shadow-lg text-2xl font-bold text-white';
                              fallback.textContent = pokerAvatar;
                              parent.appendChild(fallback);
                            }
                          }}
                          onLoad={() => {
                            // Image loaded successfully
                            console.log('Avatar loaded successfully for player', playerId, avatarUrl);
                          }}
                        />
                      ) : (
                        <span className="drop-shadow-lg text-2xl font-bold text-white">
                          {pokerAvatar}
                        </span>
                      )}
                      {/* Royal crown for current player */}
                      {isCurrent && !isEliminated && (
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-yellow-400 text-lg drop-shadow-lg">
                          👑
                        </div>
                      )}
                    </div>
                    {/* Timer text overlay for current player */}
                    {showTimer && (
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                        <div className="px-2 py-1 bg-black/70 rounded text-white text-xs font-bold">
                          {remainingTime}s
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Player Info with Last Played Cards - Container */}
                <div className={`absolute ${position} top-20 z-50`}>
                  <div className="relative flex items-center gap-2">
                    {/* Last Played Cards - Left side (for right-positioned players) */}
                    {lastPlayedCards.length > 0 && (idx === 1) && (
                      <div className="flex flex-row-reverse gap-0.5 items-center">
                        {lastPlayedCards.map((card, cardIdx) => (
                          <div key={cardIdx} className="transform scale-[0.5] -mr-1 last:mr-0">
                            <CardComponent card={card} />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Player Info Box */}
                    <div
                      className={`p-3 rounded-lg border-2 transition-all backdrop-blur-sm ${
                        isCurrent && !isEliminated
                          ? 'border-[#00C896] bg-[#00C896]/30 shadow-lg shadow-[#00C896]/50'
                          : 'border-white/20 bg-black/50'
                      }`}
                    >
                      <p className="text-white text-xs font-bold font-orbitron">
                        {displayName}
                      </p>
                      {playerUserId && (
                        <p className="text-[#00C896] text-[10px] font-orbitron">ID: {formattedUserId}</p>
                      )}
                      {cardCount > 0 && (
                        <p className="text-[#FFD700] text-xs">Карт: {cardCount}</p>
                      )}
                      <p className="text-white/90 text-xs font-semibold">Оноо: {points}</p>
                      {isEliminated && <p className="text-[#FF4757] text-xs font-bold">OUT</p>}
                    </div>
                    {/* Last Played Cards - Right side (for left/center positioned players) */}
                    {lastPlayedCards.length > 0 && (idx !== 1) && (
                      <div className="flex flex-row gap-0.5 items-center">
                        {lastPlayedCards.map((card, cardIdx) => (
                          <div key={cardIdx} className="transform scale-[0.5] -ml-1 first:ml-0">
                            <CardComponent card={card} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Last Play Cards - Center Display with Royal Styling */}
      {gameStarted && lastPlay && lastPlay.cards && lastPlay.cards.length > 0 && (
        <motion.div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3"
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
        >
          {/* Hand Rank Label with Royal Glow */}
          {lastPlay.rank && lastPlay.rank !== 'Invalid' && (
            <motion.div 
              className="px-6 py-3 rounded-full shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                boxShadow: '0 8px 24px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.4)',
              }}
              animate={{
                boxShadow: [
                  '0 8px 24px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.4)',
                  '0 8px 32px rgba(251, 191, 36, 0.8), 0 0 60px rgba(251, 191, 36, 0.6)',
                  '0 8px 24px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.4)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                }}
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              <p className="text-white text-sm md:text-base font-bold font-orbitron relative z-10 drop-shadow-lg">
                {lastPlay.rank}
              </p>
            </motion.div>
          )}
          {/* Cards with elegant spread animation */}
          <div className="flex gap-2 items-center justify-center">
            {lastPlay.cards.map((card, idx) => (
              <motion.div
                key={`center-${card.rank}-${card.suit}-${idx}`}
                initial={{ opacity: 0, scale: 0.5, rotateY: -90 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ 
                  delay: idx * 0.1,
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
                whileHover={{ scale: 1.1, z: 20 }}
              >
                <CardComponent card={card} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Player Hand */}
      {gameStarted && (
        <div className="absolute bottom-32 left-0 right-0 z-50 overflow-visible">
          {playerHand.length > 0 ? (
            <>
              {/* Selection instructions with elegant animation */}
              {isMyTurn && selectedCards.length === 0 && (
                <motion.div 
                  className="text-center mb-4"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.p 
                    className="text-white/90 text-sm md:text-base font-orbitron font-semibold"
                    animate={{
                      textShadow: [
                        '0 0 10px rgba(251, 191, 36, 0.5)',
                        '0 0 20px rgba(251, 191, 36, 0.8)',
                        '0 0 10px rgba(251, 191, 36, 0.5)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    ✨ Картуудыг сонгохын тулд дээр нь дараарай ✨
                  </motion.p>
                </motion.div>
              )}
              {/* Cards with elegant dealing animation */}
              {/* Increased padding-top and minHeight to accommodate selected cards that move up 16px and scale to 1.15 */}
              <div className="flex justify-center overflow-x-auto overflow-y-visible px-4 pt-20 pb-6" style={{ minHeight: '280px' }}>
                <div className="relative flex md:gap-1">
                  {playerHand.map((card, idx) => {
                    const isSelected = selectedCards.some(
                      (c) => c.rank === card.rank && c.suit === card.suit
                    );
                    return (
                      <motion.div
                        key={`${card.rank}-${card.suit}-${idx}`}
                        className={`relative ${idx > 0 ? '-ml-4 md:ml-0' : ''}`}
                        style={{
                          zIndex: isSelected ? 50 : playerHand.length - idx,
                        }}
                        initial={{ 
                          opacity: 0, 
                          y: 100, 
                          rotateY: -180,
                          scale: 0.5 
                        }}
                        animate={{ 
                          opacity: 1, 
                          y: 0, 
                          rotateY: 0,
                          scale: 1 
                        }}
                        transition={{ 
                          delay: idx * 0.05,
                          type: "spring",
                          stiffness: 200,
                          damping: 20,
                        }}
                        whileHover={!isSelected ? {
                          y: -8,
                          scale: 1.05,
                          transition: { duration: 0.2 }
                        } : {}}
                      >
                        <CardComponent
                          card={card}
                          isSelected={isSelected}
                          onClick={() => handleCardClick(card)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="text-white text-center py-4">
              <p>Картууд хүлээгдэж байна...</p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons - Royal Styled with Animations */}
      {gameStarted && isMyTurn && (
        <motion.div 
          className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4 z-50"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.div 
            className="flex items-center gap-3 px-6 py-4 rounded-[30px] shadow-2xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)',
              border: '2px solid rgba(251, 191, 36, 0.5)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(251, 191, 36, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
            animate={{
              boxShadow: [
                '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(251, 191, 36, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                '0 8px 40px rgba(251, 191, 36, 0.3), 0 0 0 1px rgba(251, 191, 36, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(251, 191, 36, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.1), transparent)',
              }}
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            
            {/* ӨНЖИХ Button */}
            <motion.button
              onClick={handlePass}
              className="px-6 py-3 rounded-[20px] text-white font-bold font-orbitron text-sm relative overflow-hidden"
              style={{ 
                letterSpacing: '1px',
                background: 'linear-gradient(135deg, #FF4757 0%, #FF3838 50%, #FF4757 100%)',
                boxShadow: '0 4px 16px rgba(255, 71, 87, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                }}
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <span className="relative z-10">ӨНЖИХ</span>
            </motion.button>
            
            {/* ТОГЛОХ Button */}
            <motion.button
              onClick={handlePlayCards}
              disabled={selectedCards.length === 0}
              className={`px-6 py-3 rounded-[20px] text-white font-bold font-orbitron text-sm relative overflow-hidden ${
                selectedCards.length > 0
                  ? 'cursor-pointer'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ 
                letterSpacing: '1px',
                background: selectedCards.length > 0
                  ? 'linear-gradient(135deg, #2ED573 0%, #00C896 50%, #2ED573 100%)'
                  : 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
                boxShadow: selectedCards.length > 0
                  ? '0 4px 16px rgba(46, 213, 115, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  : '0 4px 16px rgba(0, 0, 0, 0.2)',
              }}
              whileHover={selectedCards.length > 0 ? { scale: 1.08, y: -2 } : {}}
              whileTap={selectedCards.length > 0 ? { scale: 0.95 } : {}}
              animate={selectedCards.length > 0 ? {
                boxShadow: [
                  '0 4px 16px rgba(46, 213, 115, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  '0 6px 24px rgba(46, 213, 115, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  '0 4px 16px rgba(46, 213, 115, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                ],
              } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {selectedCards.length > 0 && (
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  }}
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              )}
              <span className="relative z-10">ТОГЛОХ</span>
            </motion.button>
            
            {/* ЗӨВЛӨГӨӨ Button */}
            <motion.button
              onClick={handleAdvice}
              className="px-6 py-3 rounded-[20px] text-white font-bold font-orbitron text-sm relative overflow-hidden"
              style={{ 
                letterSpacing: '1px',
                background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #F97316 100%)',
                boxShadow: '0 4px 16px rgba(249, 115, 22, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
              whileHover={{ scale: 1.08, y: -2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                }}
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <span className="relative z-10">ЗӨВЛӨГӨӨ</span>
            </motion.button>
            
            {/* Clear Selection Button */}
            {selectedCards.length > 0 && (
              <button
                onClick={handleClearSelection}
                className="px-4 py-2.5 bg-gray-600 rounded-[20px] text-white font-bold hover:bg-gray-700 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
                title="Сонголт цуцлах"
              >
                ✕
              </button>
            )}
          </motion.div>
        </motion.div>
      )}


      {/* Ready Overlay - Show avatars in positions */}
      {!gameStarted && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          {/* Center info */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl border-2 border-[#00C896] px-6 py-4 shadow-2xl">
              <p className="text-gray-800 font-bold text-lg text-center font-orbitron">
                Бэлэн тоглогчид: {Object.values(playerReadyStatus).filter(Boolean).length}/{Math.max(seatedPlayers.length, Object.keys(playerReadyStatus).length || 1)}
              </p>
              {!isConnected && (
                <p className="text-[#FF4757] text-sm text-center font-orbitron mt-2">
                  ⚠️ Серверт холбогдоогүй байна
                </p>
              )}
            </div>
          </div>

          {/* Show all 4 seats in positions */}
          {[1, 2, 3, 4].map((seatId) => {
            const player = seatedPlayers.find((p) => p.playerId === seatId);
            const isOccupied = !!player;
            const isMe = seatId === myPlayerId;
            const isReady = playerReadyStatus[seatId] || false;
            
            // If this is my seat but I'm not in seatedPlayers yet, create a placeholder
            const displayPlayer = isMe && !player ? {
              playerId: myPlayerId,
              username: myDisplayName || myUsername || 'Та',
              avatar_url: myAvatarUrl
            } : player;
            
            // Calculate relative position
            const getRelativePosition = (id: number) => {
              if (!myPlayerId) return 'top-10 left-1/2 -translate-x-1/2';
              const diff = id - myPlayerId;
              const relativeId = (3 + diff) % 4;
              switch (relativeId) {
                case 1: // Top center
                  return 'top-10 left-1/2 -translate-x-1/2';
                case 2: // Top right
                  return 'top-20 right-10';
                case 3: // Bottom left
                  return 'bottom-10 left-10';
                case 0: // Top left
                  return 'top-20 left-10';
                default:
                  return 'top-10 left-1/2 -translate-x-1/2';
              }
            };

            const position = getRelativePosition(seatId);
            const playerColor = isMe ? '#3B82F6' : '#9C27B0';
            const displayName = displayPlayer?.username || displayPlayer?.displayName || (isMe ? (myDisplayName || myUsername || 'Та') : `Player ${seatId}`);
            // Get avatar URL - check multiple possible fields and ensure it's a valid URL
            let avatarUrl = displayPlayer?.avatar_url || displayPlayer?.avatarUrl || '';
            // Clean up avatar URL - remove any whitespace and validate
            if (avatarUrl && typeof avatarUrl === 'string') {
              avatarUrl = avatarUrl.trim();
              // If it's not a valid URL (doesn't start with http/https/data), treat as empty
              if (avatarUrl && !avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://') && !avatarUrl.startsWith('data:')) {
                console.warn('Invalid avatar URL format for player', seatId, avatarUrl);
                avatarUrl = '';
              }
            } else {
              avatarUrl = '';
            }
            const playerUserId = displayPlayer?.userId || displayPlayer?.user_id || (isMe ? myUserId : null);
            const displayNameForAvatar = displayPlayer?.displayName || displayPlayer?.username || `Player ${seatId}`;
            const pokerAvatar = getPokerAvatar(playerUserId, avatarUrl, displayNameForAvatar);
            const avatarGradient = getAvatarGradient(playerUserId);
            const formattedUserId = formatUserId(playerUserId);

            return (
              <div key={seatId} className={`absolute ${position} pointer-events-auto`}>
                <motion.div
                  className={`p-4 rounded-2xl border-3 ${
                    isReady
                      ? 'border-[#2ED573] bg-gradient-to-br from-white via-white to-[#2ED573]/10 backdrop-blur-sm'
                      : isMe
                      ? 'border-[#FFD700] bg-gradient-to-br from-white via-white to-[#FFD700]/10 backdrop-blur-sm'
                      : 'border-gray-300/50 bg-gradient-to-br from-white/95 via-white/90 to-gray-100/50 backdrop-blur-sm'
                  }`}
                  style={{
                    boxShadow: isReady
                      ? '0 8px 32px rgba(46, 213, 115, 0.5), 0 0 20px rgba(46, 213, 115, 0.3)'
                      : isMe
                      ? '0 8px 32px rgba(251, 191, 36, 0.4), 0 0 20px rgba(251, 191, 36, 0.2)'
                      : '0 4px 20px rgba(0, 0, 0, 0.15)',
                  }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="flex items-center gap-3">
                    {/* Royal Avatar with Poker Theme */}
                    <div className="relative">
                      {isReady && (isOccupied || isMe) && (
                        <motion.div 
                          className="absolute inset-0 rounded-full bg-[#2ED573]/30"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl border-3 shadow-xl overflow-hidden relative"
                        style={{
                          background: (isOccupied || isMe)
                            ? avatarUrl 
                              ? 'transparent'
                              : avatarGradient
                            : 'linear-gradient(135deg, #e5e7eb, #d1d5db)',
                          borderColor: isReady
                            ? '#2ED573'
                            : isMe
                            ? '#FFD700'
                            : '#9ca3af',
                          borderWidth: '3px',
                          boxShadow: isReady
                            ? '0 0 20px rgba(46, 213, 115, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.1)'
                            : isMe
                            ? '0 0 20px rgba(251, 191, 36, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.1)'
                            : '0 4px 12px rgba(0, 0, 0, 0.2)',
                        }}
                      >
                        {avatarUrl && avatarUrl.trim() !== '' ? (
                          <img 
                            src={avatarUrl} 
                            alt={displayName}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              // If image fails to load, show first letter as fallback
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                // Remove any existing fallback
                                const existingFallback = parent.querySelector('span');
                                if (existingFallback) {
                                  existingFallback.remove();
                                }
                                // Add new fallback with first letter
                                const fallback = document.createElement('span');
                                fallback.className = 'text-3xl drop-shadow-lg font-bold text-white';
                                fallback.textContent = pokerAvatar;
                                parent.appendChild(fallback);
                              }
                            }}
                            onLoad={() => {
                              // Image loaded successfully
                              console.log('Avatar loaded successfully for player', seatId, avatarUrl);
                            }}
                          />
                        ) : (isOccupied || isMe) ? (
                          <span className="text-3xl drop-shadow-lg font-bold text-white">
                            {pokerAvatar}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xl">○</span>
                        )}
                        {/* Royal crown overlay for ready players */}
                        {isReady && (isOccupied || isMe) && (
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-yellow-400 text-lg drop-shadow-lg">
                            👑
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Ready/Not Ready buttons - only for MY player */}
                    {isMe && (isOccupied || myPlayerId) && (
                      <>
                        {/* Ready (Check) button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Check button clicked, current isReady:', isReady);
                            handleReady(true);
                          }}
                          disabled={isReady || !isConnected}
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                            isReady
                              ? 'bg-[#2ED573] border-[#2ED573] shadow-lg shadow-[#2ED573]/50 cursor-default'
                              : !isConnected
                              ? 'bg-gray-300 border-gray-400 cursor-not-allowed opacity-50'
                              : 'bg-white border-[#2ED573] hover:bg-[#2ED573]/10 hover:scale-110 active:scale-95 cursor-pointer'
                          }`}
                          title={isReady ? 'Бэлэн байна' : !isConnected ? 'Холбогдоогүй байна' : 'Бэлэн болгох'}
                        >
                          <svg
                            className={`w-6 h-6 ${isReady ? 'text-white' : !isConnected ? 'text-gray-500' : 'text-[#2ED573]'}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>

                        {/* Not Ready (X) button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('X button clicked, current isReady:', isReady);
                            handleReady(false);
                          }}
                          disabled={!isReady || !isConnected}
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                            !isReady
                              ? 'bg-[#FF4757] border-[#FF4757] shadow-lg shadow-[#FF4757]/50 cursor-default'
                              : !isConnected
                              ? 'bg-gray-300 border-gray-400 cursor-not-allowed opacity-50'
                              : 'bg-white border-[#FF4757] hover:bg-[#FF4757]/10 hover:scale-110 active:scale-95 cursor-pointer'
                          }`}
                          title={!isReady ? 'Бэлэн биш' : !isConnected ? 'Холбогдоогүй байна' : 'Бэлэн төлөв цуцлах'}
                        >
                          <svg
                            className={`w-6 h-6 ${!isReady ? 'text-white' : !isConnected ? 'text-gray-500' : 'text-[#FF4757]'}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>

                        {/* Action buttons next to ready buttons */}
                        <div className="flex gap-2 ml-2">
                          <button className="w-8 h-8 bg-[#00C896] rounded-full flex items-center justify-center text-white hover:bg-[#00A884] transition shadow-lg">
                            🔄
                          </button>
                          <button className="w-8 h-8 bg-[#9C27B0] rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition shadow-lg">
                            💬
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Player name and ID */}
                  <div className="mt-2 text-center min-w-[120px]">
                    <p className="text-gray-800 text-sm font-bold font-orbitron">
                      {(isOccupied || isMe)
                        ? displayName
                        : 'Хоосон'}
                    </p>
                    {(isOccupied || isMe) && playerUserId && (
                      <p className="text-[10px] font-orbitron mt-1 text-gray-500">
                        ID: {formattedUserId}
                      </p>
                    )}
                    {(isOccupied || isMe) && (
                      <p
                        className={`text-xs font-orbitron mt-1 ${
                          isReady ? 'text-[#2ED573] font-semibold' : 'text-gray-600'
                        }`}
                      >
                        {isReady ? 'Бэлэн ✓' : 'Хүлээгдэж байна'}
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      )}

      {/* Back Button */}
      <button
        onClick={() => {
          // Send leaveRoom message when leaving (both during active game and when finished)
          if (wsService && wsService.isConnected()) {
            wsService.send({ type: 'leaveRoom' });
          }
          router.back();
        }}
        className="absolute top-4 left-4 w-12 h-12 bg-[#FF4757] rounded-full flex items-center justify-center text-white hover:bg-red-700 transition shadow-lg"
      >
        ←
      </button>

      {/* Top Right Buttons - Only show during game */}
      {gameStarted && (
        <div className="absolute top-4 right-4 flex gap-2">
          <button className="w-12 h-12 bg-[#00C896] rounded-full flex items-center justify-center text-white hover:bg-[#00A884] transition shadow-lg">
            🔄
          </button>
          <button className="w-12 h-12 bg-[#9C27B0] rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition shadow-lg">
            💬
          </button>
        </div>
      )}

      {/* Round Score Modal */}
      {roundModalData && (
        <RoundScoreModal
          isOpen={showRoundModal}
          pointsUpdate={roundModalData.pointsUpdate}
          roundWinnerId={roundModalData.roundWinnerId}
          seatedPlayers={seatedPlayers}
          myPlayerId={myPlayerId}
          onClose={() => {
            setShowRoundModal(false);
            setRoundModalData(null);
          }}
        />
      )}

      {/* Game Over Modal */}
      {gameOverModalData && (
        <GameOverModal
          isOpen={showGameOverModal}
          winnerId={gameOverModalData.winnerId}
          finalPoints={gameOverModalData.finalPoints}
          eliminatedPlayers={gameOverModalData.eliminatedPlayers}
          seatedPlayers={seatedPlayers}
          myPlayerId={myPlayerId}
          wsService={wsService}
          completeSuitWin={gameOverModalData.completeSuitWin}
          winningSuit={gameOverModalData.winningSuit}
          onClose={() => {
            setShowGameOverModal(false);
            setGameOverModalData(null);
          }}
        />
      )}
    </div>
  );
}

