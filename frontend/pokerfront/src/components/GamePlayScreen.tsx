'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { userStorage } from '@/lib/storage';
import { WebSocketService } from '@/lib/websocket';
import { WS_URL } from '@/lib/config';
import { Card, cardValue } from '@/lib/models/card';
import { HandPlay } from '@/lib/models/hand';
import { evaluateHand, canPlay } from '@/lib/utils/cardEvaluator';
import { getPokerAvatar, getAvatarGradient, formatUserId } from '@/lib/utils/avatarUtils';
import CardComponent from './CardComponent';
import RoundScoreModal from './RoundScoreModal';
import GameOverModal from './GameOverModal';
import ChairIcon from './ChairIcon';
import OfficePersonIcon from './OfficePersonIcon';
import toast from 'react-hot-toast';
import { IoMdSend } from 'react-icons/io';
import { FaPlay, FaHandPaper, FaLightbulb, FaTimes, FaWifi, FaCog } from 'react-icons/fa';
import { MdClear, MdSignalWifiOff } from 'react-icons/md';

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

// Sort cards by suit (then by rank within suit)
function sortCardsBySuit(cards: Card[]): Card[] {
  const suitOrder: Record<string, number> = {
    '♠': 1,  // Spade first (left side)
    '♥': 2,
    '♣': 3,
    '♦': 4,
  };

  const sorted = [...cards].sort((a, b) => {
    // First sort by suit order (low to high)
    const suitDiff = (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
    if (suitDiff !== 0) return suitDiff;
    
    // For same suit, sort by rank value (high to low)
    return cardValue(b.rank) - cardValue(a.rank);
  });

  return sorted;
}

// Helper function to get avatar path based on player count and index
function getAvatarPath(playerIndex: number, totalPlayers: number): string {
  if (totalPlayers === 1) {
    return '/avatar.png';
  } else if (totalPlayers === 2) {
    return playerIndex === 0 ? '/avatar.png' : '/avatar1.png';
  } else if (totalPlayers === 3) {
    if (playerIndex === 0) return '/avatar.png';
    if (playerIndex === 1) return '/avatar1.png';
    return '/avatar2.png';
  } else if (totalPlayers >= 4) {
    if (playerIndex === 0) return '/avatar.png';
    if (playerIndex === 1) return '/avatar1.png';
    if (playerIndex === 2) return '/avatar2.png';
    return '/avatar3.png';
  }
  return '/avatar.png';
}

// Helper function to get table style configuration
function getTableStyleConfig(style: 'green' | 'blue' | 'black') {
  switch (style) {
    case 'green':
      return {
        background: 'radial-gradient(circle at 30% 30%, #2d5a3d 0%, #1e4a2d 25%, #0f3a1d 50%, #0a2a15 75%, #051a0d 100%)',
        ambientLight: 'rgba(46, 213, 115, 0.1)',
        lightReflection: [
          'radial-gradient(circle at 30% 30%, rgba(46, 213, 115, 0.08) 0%, transparent 50%)',
          'radial-gradient(circle at 70% 70%, rgba(46, 213, 115, 0.08) 0%, transparent 50%)',
          'radial-gradient(circle at 30% 30%, rgba(46, 213, 115, 0.08) 0%, transparent 50%)',
        ],
        textureOverlay: `
          repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px),
          repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px),
          repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px),
          radial-gradient(circle at 25% 25%, rgba(70, 200, 120, 0.15) 0%, transparent 40%),
          radial-gradient(circle at 75% 75%, rgba(50, 180, 100, 0.15) 0%, transparent 40%)
        `,
      };
    case 'blue':
      return {
        background: 'radial-gradient(circle at 30% 30%, #4a6fa5 0%, #3d5a80 25%, #2d4a6b 50%, #1e3a5f 75%, #0f2a4a 100%)',
        ambientLight: 'rgba(59, 130, 246, 0.1)',
        lightReflection: [
          'radial-gradient(circle at 30% 30%, rgba(150, 200, 255, 0.08) 0%, transparent 50%)',
          'radial-gradient(circle at 70% 70%, rgba(150, 200, 255, 0.08) 0%, transparent 50%)',
          'radial-gradient(circle at 30% 30%, rgba(150, 200, 255, 0.08) 0%, transparent 50%)',
        ],
        textureOverlay: `
          repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px),
          repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px),
          repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px),
          radial-gradient(circle at 25% 25%, rgba(100, 150, 200, 0.15) 0%, transparent 40%),
          radial-gradient(circle at 75% 75%, rgba(80, 130, 180, 0.15) 0%, transparent 40%)
        `,
      };
    case 'black':
      return {
        background: 'radial-gradient(circle at 30% 30%, #2a2a2a 0%, #1a1a1a 25%, #0f0f0f 50%, #080808 75%, #000000 100%)',
        ambientLight: 'rgba(255, 255, 255, 0.05)',
        lightReflection: [
          'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.06) 0%, transparent 50%)',
          'radial-gradient(circle at 70% 70%, rgba(255, 255, 255, 0.06) 0%, transparent 50%)',
          'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.06) 0%, transparent 50%)',
        ],
        textureOverlay: `
          repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.02) 1px, rgba(255,255,255,0.02) 2px),
          repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.02) 1px, rgba(255,255,255,0.02) 2px),
          repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 4px),
          radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.08) 0%, transparent 40%)
        `,
      };
    default:
      return getTableStyleConfig('blue');
  }
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
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
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

  // Rejoin modal state
  const [showRejoinModal, setShowRejoinModal] = useState(false);

  // Chat state
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{
    playerId: number;
    username: string;
    message: string;
    timestamp: number;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [beepedPlayers, setBeepedPlayers] = useState<Set<number>>(new Set());
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Set<number>>(new Set());
  const [sortBySuit, setSortBySuit] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [chatPosition, setChatPosition] = useState<'left' | 'right'>('right');
  
  // Table style state
  const [tableStyle, setTableStyle] = useState<'green' | 'blue' | 'black'>('blue');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  
  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [dragEndIndex, setDragEndIndex] = useState<number | null>(null);
  const [dragRangeCards, setDragRangeCards] = useState<Card[]>([]);

  // Play beep sound and show red background when any player has 1 card left
  useEffect(() => {
    if (!gameStarted) return;

    // Calculate card counts for all players
    const playerCardCounts = seatedPlayers.map((player) => {
      const playerId = player.playerId;
      // For all players, prefer opponentCardCounts (from backend) if available
      // This ensures other players see the correct count for me
      // For myself, fallback to playerHand.length if count not available
      const cardCount = opponentCardCounts[playerId] !== undefined 
        ? opponentCardCounts[playerId]
        : (playerId !== myPlayerId
            ? (player.cardCount !== undefined ? player.cardCount : 0)
            : playerHand.length);
      return { playerId, cardCount };
    });

    // Find all players with exactly 1 card left (including yourself)
    const playersWithOneCard = playerCardCounts.filter(
      p => p.cardCount === 1
    );

    // Trigger beep sound for each player who reaches 1 card (only once per player)
    playersWithOneCard.forEach(({ playerId }) => {
      if (!beepedPlayers.has(playerId)) {
        // Play beep sound - try Web Audio API first (more reliable), fallback to MP3
        const playBeep = async () => {
          try {
            // Try Web Audio API first (more reliable across browsers)
            try {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              const audioContext = new AudioContext();
              
              // Resume audio context if suspended (required for user interaction)
              if (audioContext.state === 'suspended') {
                await audioContext.resume();
              }
              
              const oscillator = audioContext.createOscillator();
              const gainNode = audioContext.createGain();
              
              oscillator.connect(gainNode);
              gainNode.connect(audioContext.destination);
              
              oscillator.frequency.value = 800; // Beep frequency
              oscillator.type = 'sine';
              
              gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
              
              oscillator.start(audioContext.currentTime);
              oscillator.stop(audioContext.currentTime + 0.3);
              
              console.log('✅ Played beep sound via Web Audio API');
              
              // Cleanup after sound finishes
              setTimeout(() => {
                try {
                  oscillator.disconnect();
                  gainNode.disconnect();
                  audioContext.close().catch(() => {});
                } catch (e) {
                  // Ignore cleanup errors
                }
              }, 400);
            } catch (webAudioError) {
              // Web Audio failed, try MP3 fallback
              console.log('⚠️ Web Audio API failed, trying MP3 fallback:', webAudioError);
              const audio = new Audio('/beep.mp3');
              audio.volume = 0.5;
              
              const playPromise = audio.play();
              if (playPromise !== undefined) {
                await playPromise;
                console.log('✅ Played beep sound from MP3 file');
              }
            }
            
            // Mark this player as beeped
            setBeepedPlayers((prev) => {
              const newSet = new Set(prev);
              newSet.add(playerId);
              return newSet;
            });
          } catch (error) {
            console.error('❌ Error playing beep sound:', error);
            // Mark as beeped even if sound fails to prevent retry loops
            setBeepedPlayers((prev) => {
              const newSet = new Set(prev);
              newSet.add(playerId);
              return newSet;
            });
          }
        };
        
        playBeep();
      }
    });
  }, [opponentCardCounts, playerHand.length, gameStarted, seatedPlayers, myPlayerId, beepedPlayers]);

  // Reset beeped players when game starts or new round begins
  useEffect(() => {
    if (!gameStarted) {
      setBeepedPlayers(new Set());
    }
  }, [gameStarted]);

  // Detect desktop and auto-open chat on desktop
  useEffect(() => {
    const checkIsDesktop = () => {
      const isDesktopDevice = window.innerWidth >= 768; // md breakpoint
      setIsDesktop(isDesktopDevice);
      if (isDesktopDevice) {
        setShowChatModal(true); // Auto-open chat on desktop
      }
    };
    
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

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
      const players = data.players || data || [];
      setSeatedPlayers(players);
      
      // If game has started, check if any previously disconnected players are now in the list
      // This handles cases where reconnection happens but roomJoined event wasn't caught
      if (gameStarted) {
        setDisconnectedPlayers(prev => {
          const newSet = new Set(prev);
          const currentPlayerIds = new Set(players.map((p: any) => p.playerId));
          // Remove players from disconnected set if they're in the current players list
          // (they may have reconnected)
          prev.forEach(playerId => {
            if (currentPlayerIds.has(playerId)) {
              // Player is still in the game, might have reconnected
              // We'll keep them as disconnected until we get explicit reconnection signal
              // or they make a move
            }
          });
          return newSet;
        });
      }
      
      // Initialize card counts for all opponents if game has started
      if (gameStarted && myPlayerId) {
        setOpponentCardCounts((prev) => {
          const updated = { ...prev };
          players.forEach((player: any) => {
            if (player.playerId !== myPlayerId) {
              // Initialize to 13 if not already set (game started, so they should have 13 cards)
              if (updated[player.playerId] === undefined) {
                updated[player.playerId] = player.cardCount !== undefined ? player.cardCount : 13;
              }
            }
          });
          return updated;
        });
      }
    });

    // Listen for player join/leave events
    ws.on('playerJoined', (data: any) => {
      console.log('Player joined:', data);
      // Request updated player list
      ws.send({ type: 'getSeatedPlayers' });
    });

    ws.on('playerLeft', (data: any) => {
      console.log('Player left:', data);
      // If player disconnected during active game, mark them as disconnected
      // Check both explicit disconnected flag and if game has started
      if (data.player && (data.disconnected || gameStarted)) {
        setDisconnectedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.add(data.player);
          return newSet;
        });
        console.log(`📡 Player ${data.player} disconnected during game`);
      }
      // Request updated player list
      ws.send({ type: 'getSeatedPlayers' });
    });

    ws.on('playerReconnected', (data: any) => {
      console.log('Player reconnected:', data);
      // Remove player from disconnected set when they reconnect
      if (data.player) {
        setDisconnectedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.player);
          return newSet;
        });
        console.log(`✅ Player ${data.player} reconnected - removed from disconnected set`);
      }
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
          const sortedHand = sortBySuit ? sortCardsBySuit(normalizedHand) : sortCardsByRank(normalizedHand);
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
        const sortedHand = sortBySuit ? sortCardsBySuit(normalizedHand) : sortCardsByRank(normalizedHand);
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
      // Clear countdown when hand is received (game has started)
      setStartCountdown(null);
      // Clear last played cards when new hand is dealt (new round)
      setPlayerLastPlayedCards({});
      setPreviousPlayerPassed(false);
      // Clear lastPlay when receiving new hand - new round starts fresh
      setLastPlay(null);
      // Reset beeped players for new round
      setBeepedPlayers(new Set());
      console.log('🔄 New hand received - cleared lastPlay for fresh round start');
      // Handle different possible data formats
      const hand = data.hand || data.cards || data;
      const normalizedHand = normalizeHand(hand);
      if (normalizedHand.length > 0) {
        const sortedHand = sortBySuit ? sortCardsBySuit(normalizedHand) : sortCardsByRank(normalizedHand);
        console.log('Setting player hand from hand event:', sortedHand);
        setPlayerHand(sortedHand);
        setGameStarted(true);
        setRemainingTime(15);
        
        // Initialize card counts for all players when hand is dealt
        // This ensures other players see the correct initial count for me
        if (myPlayerId) {
          setOpponentCardCounts((prev) => {
            const updated = { ...prev };
            // Initialize current player's count to the number of cards received
            updated[myPlayerId] = sortedHand.length;
            // Initialize opponent card counts to 13 for all other players
            if (seatedPlayers.length > 0) {
              seatedPlayers.forEach((player) => {
                if (player.playerId !== myPlayerId) {
                  // Only initialize if not already set
                  if (updated[player.playerId] === undefined) {
                    updated[player.playerId] = 13;
                  }
                }
              });
            }
            console.log('📊 Initialized card counts (all players):', updated);
            return updated;
          });
        }
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
      // If this is our turn after reconnecting, ensure we have the latest game state
      if (playerId === myPlayerId && ws.isConnected()) {
        // Request game state to ensure all UI elements are properly restored
        setTimeout(() => {
          if (ws.isConnected()) {
            ws.send({ type: 'getGameState' });
          }
        }, 100);
      }
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
      
      // If a previously disconnected player plays cards, they've reconnected
      if (playerId && disconnectedPlayers.has(playerId)) {
        setDisconnectedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(playerId);
          return newSet;
        });
        console.log(`✅ Player ${playerId} appears to have reconnected (played cards)`);
      }
      
      console.log('opponentMove: Player', playerId, 'played', normalizedMove.length, 'cards');
      
      // If this is our own move, ensure cards are removed from hand (backend confirmation)
      // This handles cases where optimistic removal might have failed
      if (playerId === myPlayerId) {
        setPlayerHand((prev) => {
          // Create a map to count how many of each card we need to remove
          const cardsToRemove = new Map<string, number>();
          normalizedMove.forEach((card) => {
            const key = `${card.rank}${card.suit}`;
            cardsToRemove.set(key, (cardsToRemove.get(key) || 0) + 1);
          });

          // Remove cards, handling duplicates correctly
          const result: Card[] = [];
          const removedCounts = new Map<string, number>();

          prev.forEach((card) => {
            const key = `${card.rank}${card.suit}`;
            const needToRemove = cardsToRemove.get(key) || 0;
            const alreadyRemoved = removedCounts.get(key) || 0;

            if (needToRemove > 0 && alreadyRemoved < needToRemove) {
              // Remove this card
              removedCounts.set(key, alreadyRemoved + 1);
            } else {
              // Keep this card
              result.push(card);
            }
          });

          const totalRemoved = Array.from(removedCounts.values()).reduce((a, b) => a + b, 0);
          if (totalRemoved === normalizedMove.length) {
            console.log(`✅ Backend confirmed: Removed ${totalRemoved} cards from hand (${prev.length} -> ${result.length})`);
          } else if (totalRemoved > 0) {
            console.log(`⚠️ Backend confirmation: Removed ${totalRemoved} cards (expected ${normalizedMove.length}, had ${prev.length}, now ${result.length})`);
          } else {
            console.log(`ℹ️ Backend confirmation: Cards already removed (hand has ${prev.length} cards, played ${normalizedMove.length})`);
          }

          return result;
        });
      }
      
      // Update lastPlay for all players (including current player)
      setLastPlay(play);
      // Reset previousPlayerPassed since someone just played cards
      setPreviousPlayerPassed(false);
      
      // Store the last played cards for this player
      setPlayerLastPlayedCards((prev) => ({
        ...prev,
        [playerId]: normalizedMove,
      }));
      
      // Update card counts from backend if provided, otherwise calculate
      if (data.cardCounts) {
        // Use card counts from backend (most accurate)
        // Update ALL players' counts, including myPlayerId (for other players to see correctly)
        setOpponentCardCounts((prev) => {
          const updated = { ...prev };
          Object.entries(data.cardCounts).forEach(([pid, count]) => {
            const playerIdNum = parseInt(pid, 10);
            const countValue = typeof count === 'number' ? count : parseInt(String(count), 10);
            // Update all players' counts - backend sends accurate counts for everyone
            // This ensures other players see the correct count for the current player
            updated[playerIdNum] = countValue;
          });
          console.log('📊 Updated card counts from opponentMove (all players):', updated);
          console.log('📊 My player ID:', myPlayerId, 'My count in updated:', updated[myPlayerId]);
          return updated;
        });
      } else {
        // Fallback: calculate from move (for backward compatibility)
        if (playerId !== myPlayerId) {
          setOpponentCardCounts((prev) => {
            // Only use current count if it's already set (don't default to 13)
            // If not set, we can't calculate accurately, so don't update
            if (prev[playerId] === undefined) {
              console.warn(`⚠️ Cannot calculate card count for player ${playerId} - no initial count available`);
              return prev; // Don't update if we don't have initial count
            }
            const currentCount = prev[playerId];
            const newCount = Math.max(0, currentCount - (normalizedMove.length || 0));
            console.log(`📊 Calculated card count for player ${playerId}: ${newCount} (was ${currentCount}, played ${normalizedMove.length})`);
            return {
              ...prev,
              [playerId]: newCount,
            };
          });
        }
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

    // Handle chat messages
    ws.on('chatMessage', (data: any) => {
      console.log('chatMessage received:', data);
      const playerId = typeof data.playerId === 'string' ? parseInt(data.playerId, 10) : (data.playerId || data.player);
      setChatMessages((prev) => {
        const newMessage = {
          playerId: playerId,
          username: data.username || `Player ${playerId}`,
          message: data.message,
          timestamp: data.timestamp || Date.now(),
        };
        // Play chat sound when new message arrives
        try {
          const audio = new Audio('/sounds/chat.mp3');
          audio.volume = 0.5;
          audio.play().catch((err) => {
            // Fallback: use Web Audio API beep if file doesn't exist
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
          });
        } catch (err) {
          console.log('Could not play chat sound:', err);
        }
        return [...prev, newMessage];
      });
    });

    ws.on('opponentPass', (data: any) => {
      console.log('opponentPass received:', data);
      // If a previously disconnected player passes, they may have reconnected
      if (data.player && disconnectedPlayers.has(data.player)) {
        setDisconnectedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.player);
          return newSet;
        });
        console.log(`✅ Player ${data.player} appears to have reconnected (made a pass)`);
      }
      if (data.resetLastPlay || data.shouldReset) {
        // Round reset - all players passed, clear lastPlay
        console.log('Round reset - all players passed, clearing lastPlay');
        setLastPlay(null);
        setPreviousPlayerPassed(false);
        // Clear all player last played cards when round resets
        setPlayerLastPlayedCards({});
      } else {
        // When a player passes (but round doesn't reset), keep lastPlay
        // Next player must still beat the last play or pass
        // Only when ALL players pass should lastPlay be cleared
        console.log('Player passed - but lastPlay remains, next player must beat it or pass');
        setPreviousPlayerPassed(false); // Don't allow any hand, must beat lastPlay
        // DO NOT clear lastPlay here - keep it until all players pass
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
      // Update card counts from gameState if provided
      if (data.cardCounts) {
        setOpponentCardCounts((prev) => {
          const updated = { ...prev };
          Object.entries(data.cardCounts).forEach(([pid, count]) => {
            const playerIdNum = parseInt(pid, 10);
            // Update all players' counts - backend sends accurate counts for everyone
            updated[playerIdNum] = count as number;
          });
          console.log('📊 Updated card counts from gameState (all players):', updated);
          return updated;
        });
      }
      if (data.hand) {
        const normalizedHand = normalizeHand(data.hand);
        if (normalizedHand.length > 0) {
          const sortedHand = sortCardsByRank(normalizedHand);
          // Only update hand from gameState if:
          // 1. We don't have a hand yet (new game/round)
          // 2. The hand from server has 13 cards (new round)
          // 3. The hand from server has fewer cards than our current hand (backend confirms we played cards)
          // This prevents overwriting our local state with stale data
          setPlayerHand((prev) => {
            if (prev.length === 0) {
              // No hand yet, use server hand
              console.log('Setting player hand from gameState (no hand yet):', sortedHand);
              return sortedHand;
            } else if (sortedHand.length === 13) {
              // New round - 13 cards means fresh hand
              console.log('Setting player hand from gameState (new round):', sortedHand);
              return sortedHand;
            } else if (sortedHand.length < prev.length) {
              // Server confirms we have fewer cards (we played some)
              // Use server hand as source of truth
              console.log(`Setting player hand from gameState (server confirms fewer cards): ${prev.length} -> ${sortedHand.length}`);
              return sortedHand;
            } else {
              // Server hand has same or more cards - might be stale, keep our local state
              console.log(`Keeping local hand (${prev.length} cards) - server hand (${sortedHand.length} cards) might be stale`);
              return prev;
            }
          });
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
      // Update lastPlay from gameState
      // Only clear lastPlay when backend sends null (round reset - all players passed)
      // Otherwise, always update lastPlay to match backend state
      if (data.lastPlay === null || data.lastPlay === undefined) {
        setLastPlay(null);
        setPreviousPlayerPassed(false);
        console.log('Last play reset from gameState (round reset - all players passed)');
      } else if (data.lastPlay) {
        // Update lastPlay from gameState - backend maintains it until all players pass
        const normalizedLastPlay = normalizeHand(data.lastPlay);
        if (normalizedLastPlay.length > 0) {
          const play = evaluateHand(normalizedLastPlay);
          setLastPlay(play);
          setPreviousPlayerPassed(false);
          console.log('Last play updated from gameState:', play.rank, normalizedLastPlay.length, 'cards');
        } else {
          // If lastPlay is empty array, reset it
          setLastPlay(null);
          setPreviousPlayerPassed(false);
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

    // Handle new round start event - clear all previous round state
    ws.on('newRoundStart', (data: any) => {
      console.log('newRoundStart event:', data);
      // Reset beeped players for new round
      setBeepedPlayers(new Set());
      // Reset card counts - will be updated when new hand is dealt
      if (data.cardCounts) {
        setOpponentCardCounts((prev) => {
          const updated = { ...prev };
          Object.entries(data.cardCounts).forEach(([pid, count]) => {
            const playerIdNum = parseInt(pid, 10);
            // Update all players' counts - backend sends accurate counts for everyone
            updated[playerIdNum] = count as number;
          });
          console.log('📊 Updated card counts from newRoundStart (all players):', updated);
          return updated;
        });
      }
      // Clear last play from previous round - new round starts fresh
      setLastPlay(null);
      setPreviousPlayerPassed(false);
      // Clear all player last played cards from previous round
      setPlayerLastPlayedCards({});
      console.log('🔄 New round started - cleared lastPlay and all previous round state');
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
        } catch (balanceError: any) {
          // Don't log auth errors as they're handled by the interceptor
          if (!balanceError?.isAuthError) {
            console.error('❌ Error refreshing balance:', balanceError);
          }
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
      
      // If reconnected during active game, show rejoin modal and remove from disconnected set
      if (data.reconnected && gameStarted) {
        setShowRejoinModal(true);
        // Remove this player from disconnected set if they reconnected
        setDisconnectedPlayers(prev => {
          const newSet = new Set(prev);
          newSet.delete(playerId);
          return newSet;
        });
        // Immediately request game state to restore turn information and action buttons
        if (ws.isConnected()) {
          ws.send({ type: 'getGameState' });
        }
      }
      
      // Request current player list after joining
      ws.send({ type: 'getSeatedPlayers' });
    });

    ws.on('disconnected', () => {
      setIsConnected(false);
      console.log('🔌 WebSocket disconnected');
    });

    ws.on('error', (data: any) => {
      const errorMsg = data.message || 'WebSocket холболт амжилтгүй боллоо. Серверийг шалгана уу.';
      
      // If error is about invalid move, don't disconnect - just show error
      if (errorMsg.includes('Cannot play') || errorMsg.includes('Invalid') || errorMsg.includes('тоглох боломжгүй')) {
        console.warn('⚠️ Move rejected by backend:', errorMsg);
        toast.error(errorMsg);
        // Don't disconnect on move validation errors
        return;
      }
      
      // For other errors, disconnect
      setIsConnected(false);
      toast.error(errorMsg);
      
      // Log detailed error information
      const errorDetails = {
        message: errorMsg,
        readyState: data.readyState,
        error: data.error,
        timestamp: new Date().toISOString(),
        url: WS_URL,
      };
      console.error('❌ WebSocket error:', errorDetails);
    });

    // Listen for auto-start countdown
    ws.on('autoStartCountdown', (data: any) => {
      console.log('autoStartCountdown event:', data);
      const countdownNumber = data.countdownNumber || data.remainingTime;
      if (countdownNumber && countdownNumber > 0) {
        setStartCountdown(countdownNumber);
      } else {
        setStartCountdown(null);
      }
    });

    // Clear countdown when game starts
    ws.on('gameStart', () => {
      console.log('gameStart event - clearing countdown');
      setStartCountdown(null);
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

  // Find best hand from a range of cards
  const findBestHand = (cards: Card[]): Card[] => {
    if (cards.length === 0) return [];
    
    // Generate all possible combinations
    const combinations: Card[][] = [];
    
    // Single cards
    for (const card of cards) {
      combinations.push([card]);
    }
    
    // Pairs
    const rankCount: Record<string, Card[]> = {};
    for (const card of cards) {
      if (!rankCount[card.rank]) rankCount[card.rank] = [];
      rankCount[card.rank].push(card);
    }
    
    for (const cardsOfRank of Object.values(rankCount)) {
      if (cardsOfRank.length >= 2) {
        combinations.push(cardsOfRank.slice(0, 2));
      }
      if (cardsOfRank.length >= 3) {
        combinations.push(cardsOfRank.slice(0, 3));
      }
      if (cardsOfRank.length >= 4) {
        combinations.push(cardsOfRank.slice(0, 4));
      }
    }
    
    // Straights (5 cards)
    if (cards.length >= 5) {
      const sortedCards = [...cards].sort((a, b) => cardValue(a.rank) - cardValue(b.rank));
      for (let i = 0; i <= sortedCards.length - 5; i++) {
        const straight = sortedCards.slice(i, i + 5);
        const play = evaluateHand(straight);
        if (play.rank !== 'Invalid') {
          combinations.push(straight);
        }
      }
    }
    
    // Flushes (5 cards of same suit)
    const suitGroups: Record<string, Card[]> = {};
    for (const card of cards) {
      if (!suitGroups[card.suit]) suitGroups[card.suit] = [];
      suitGroups[card.suit].push(card);
    }
    for (const suitCards of Object.values(suitGroups)) {
      if (suitCards.length >= 5) {
        combinations.push(suitCards.slice(0, 5));
      }
    }
    
    // Evaluate all combinations and find the best
    let bestHand: Card[] = [];
    let bestRank = -1;
    const rankOrder = ['HighCard', 'OnePair', 'ThreeOfAKind', 'Straight', 'Flush', 'FullHouse', 'FourOfAKind', 'StraightFlush', 'RoyalFlush'];
    
    for (const combo of combinations) {
      const play = evaluateHand(combo);
      if (play.rank !== 'Invalid') {
        const rankIndex = rankOrder.indexOf(play.rank);
        if (rankIndex > bestRank) {
          bestRank = rankIndex;
          bestHand = combo;
        } else if (rankIndex === bestRank && combo.length > bestHand.length) {
          bestHand = combo;
        }
      }
    }
    
    return bestHand;
  };

  const handleCardClick = (card: Card) => {
    // Don't handle click if we're dragging
    if (isDragging) return;
    
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
  
  const handleCardDragStart = (index: number, e: React.MouseEvent | React.TouchEvent) => {
    if (!isMyTurn && gameStarted) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStartIndex(index);
    setDragEndIndex(index);
  };
  
  const handleCardDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || dragStartIndex === null) return;
    
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
    if (clientX === undefined) return;
    
    // Find which card is under the cursor
    const cards = document.querySelectorAll('[data-card-index]');
    let targetIndex = dragStartIndex;
    
    cards.forEach((cardEl) => {
      const rect = cardEl.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        const index = parseInt(cardEl.getAttribute('data-card-index') || '0');
        targetIndex = index;
      }
    });
    
    setDragEndIndex(targetIndex);
    
    // Calculate range
    const start = Math.min(dragStartIndex, targetIndex);
    const end = Math.max(dragStartIndex, targetIndex);
    const rangeCards = playerHand.slice(start, end + 1);
    setDragRangeCards(rangeCards);
    
    // Find best hand from range
    if (rangeCards.length > 0) {
      const bestHand = findBestHand(rangeCards);
      if (bestHand.length > 0) {
        setSelectedCards(bestHand);
      }
    }
  };
  
  const handleCardDragEnd = () => {
    if (isDragging && dragRangeCards.length > 0) {
      const bestHand = findBestHand(dragRangeCards);
      if (bestHand.length > 0) {
        setSelectedCards(bestHand);
      }
    }
    setIsDragging(false);
    setDragStartIndex(null);
    setDragEndIndex(null);
    setDragRangeCards([]);
  };
  
  // Add global mouse/touch listeners for drag
  useEffect(() => {
    if (isDragging) {
      const handleMove = (e: MouseEvent | TouchEvent) => handleCardDragMove(e);
      const handleEnd = () => handleCardDragEnd();
      
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
      };
    }
  }, [isDragging, dragStartIndex, playerHand]);

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

    // Only allow playing a new hand (without beating lastPlay) when round is reset (all players passed)
    // If lastPlay exists, must beat it or pass - don't allow weaker hands
    const effectiveLastPlay = lastPlay;
    
    // Client-side validation - block invalid plays to prevent cards from being discarded
    // CRITICAL: Check card count FIRST before any other validation
    if (effectiveLastPlay && selectedCards.length !== effectiveLastPlay.cards.length) {
      const errorMsg = `Та ${effectiveLastPlay.cards.length} карт тоглох ёстой, гэхдээ ${selectedCards.length} карт сонгосон байна.`;
      console.warn('⚠️ Card count mismatch:', {
        selected: selectedCards.length,
        required: effectiveLastPlay.cards.length,
        lastPlay: effectiveLastPlay
      });
      toast.error(errorMsg);
      // Don't send to backend and don't remove cards - validation failed
      return;
    }
    
    const clientSideCanPlay = canPlay(selectedCards, effectiveLastPlay);
    
    if (!clientSideCanPlay && effectiveLastPlay) {
      // Show error message and block the play
      console.warn('⚠️ Client-side validation failed:', {
        playRank: play.rank,
        lastPlayRank: effectiveLastPlay.rank,
        playCards: selectedCards.map(c => `${c.rank}${c.suit}`),
        lastPlayCards: effectiveLastPlay.cards.map(c => `${c.rank}${c.suit}`),
        playCardCount: selectedCards.length,
        lastPlayCardCount: effectiveLastPlay.cards.length,
        playCardValues: selectedCards.map(c => ({ rank: c.rank, value: cardValue(c.rank), suit: c.suit })),
        lastPlayCardValues: effectiveLastPlay.cards.map(c => ({ rank: c.rank, value: cardValue(c.rank), suit: c.suit }))
      });
      
      const errorMsg = `Энэ картуудыг тоглох боломжгүй. Та ${play.rank} тоглож байна, гэхдээ ${effectiveLastPlay.rank} давах шаардлагатай.`;
      toast.error(errorMsg);
      
      // Don't send to backend and don't remove cards - validation failed
      return;
    }

    // Validation passed - proceed with sending to backend
    // Don't update lastPlay optimistically - wait for backend confirmation
    
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

    // Remove cards optimistically from hand immediately
    // This prevents UI issues where cards appear to still be in hand
    setPlayerHand((prev) => {
      const filtered = prev.filter(
        (card) =>
          !selectedCards.some(
            (played) => played.rank === card.rank && played.suit === card.suit
          )
      );
      console.log(`🎴 Optimistically removed ${selectedCards.length} cards from hand (${prev.length} -> ${filtered.length})`);
      return filtered;
    });

    // Clear selection immediately for UI
    setSelectedCards([]);
    
    // Cards will also be removed again when we receive opponentMove event
    // for our own player ID (backend confirmation), but the filter will handle duplicates
    
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

  // Auto-clear countdown when it reaches 0 or game starts
  useEffect(() => {
    if (startCountdown !== null && startCountdown <= 0) {
      setStartCountdown(null);
    }
    if (gameStarted && startCountdown !== null) {
      // Clear countdown when game starts
      setStartCountdown(null);
    }
  }, [startCountdown, gameStarted]);

  // Decrement countdown every second
  useEffect(() => {
    if (startCountdown === null || startCountdown <= 0) {
      return;
    }

    const countdownInterval = setInterval(() => {
      setStartCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return null; // Clear when reaches 0
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [startCountdown]);

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
      {/* Professional Game Start Countdown Overlay */}
      <AnimatePresence>
        {startCountdown !== null && startCountdown > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div
              key={startCountdown}
              initial={{ scale: 0.3, opacity: 0, rotateY: -180 }}
              animate={{ 
                scale: [1.3, 1, 1.1, 1], 
                opacity: [0.3, 1, 1, 1],
                rotateY: [0, 0, 360, 0],
              }}
              exit={{ scale: 0.3, opacity: 0, rotateY: 180 }}
              transition={{ 
                duration: 0.6,
                ease: "easeOut"
              }}
              className="relative z-10"
            >
              <div 
                className="text-[220px] sm:text-[280px] font-bold font-orbitron text-[#FFD700] relative"
                style={{
                  textShadow: '0 0 60px rgba(255, 215, 0, 1), 0 0 100px rgba(255, 215, 0, 0.8), 0 0 150px rgba(255, 215, 0, 0.6), 0 8px 32px rgba(0, 0, 0, 0.8)',
                  filter: 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.9))',
                }}
              >
                {startCountdown}
                {/* Animated glow ring */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(255, 215, 0, 0.3) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                  }}
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Poker Table Background */}
      {(() => {
        const styleConfig = getTableStyleConfig(tableStyle);
        return (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
              {/* Subtle ambient lighting */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 6, repeat: Infinity }}
                style={{
                  background: `radial-gradient(ellipse at 50% 50%, ${styleConfig.ambientLight} 0%, transparent 70%)`,
                }}
              />
            </div>
            
            {/* Professional Poker Table Surface with Wide Black Border */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Outer black border - wide and prominent */}
              <div 
                className="w-[92%] h-[82%] rounded-full absolute"
                style={{
                  background: '#000000',
                  boxShadow: '0 0 0 20px #000000, 0 0 0 24px rgba(0, 0, 0, 0.8), 0 20px 80px rgba(0, 0, 0, 0.8), inset 0 0 0 2px rgba(255, 255, 255, 0.1)',
                }}
              />
              
              {/* Main table surface - dynamic style */}
              <motion.div 
                className="w-[90%] h-[80%] rounded-full relative overflow-hidden"
                style={{
                  background: styleConfig.background,
                  boxShadow: 'inset 0 0 120px rgba(0, 0, 0, 0.4), inset 0 0 60px rgba(0, 0, 0, 0.2), 0 0 0 20px #000000',
                }}
                key={tableStyle}
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {/* Realistic felt texture overlay */}
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: styleConfig.textureOverlay,
                    backgroundSize: '100% 100%, 100% 100%, 200% 200%, 150% 150%, 150% 150%',
                  }}
                />
                
                {/* Subtle light reflection on felt */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{
                    background: styleConfig.lightReflection,
                  }}
                  transition={{ duration: 10, repeat: Infinity }}
                />
                
                {/* Inner rim highlight */}
                <div 
                  className="absolute inset-2 rounded-full pointer-events-none"
                  style={{
                    boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
                  }}
                />
                
                {/* Center dealer area - subtle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full opacity-5" style={{
                  background: 'radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%)',
                  boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.3)',
                }} />
              </motion.div>
            </div>
          </>
        );
      })()}

      {/* Players */}
      {gameStarted && seatedPlayers.length > 0 && (
        <div className="absolute inset-0">
          {(() => {
            // Sort players by playerId to get consistent ordering for avatar assignment
            const sortedPlayers = [...seatedPlayers].sort((a, b) => a.playerId - b.playerId);
            return sortedPlayers.map((player, idx) => {
              const playerId = player.playerId;
              const isCurrent = currentPlayer === playerId;
              const isMe = playerId === myPlayerId;
              // Calculate card count - ensure it's always a number and displayed
              // For all players, prefer opponentCardCounts (from backend) if available
              // This ensures other players see the correct count for me
              // For myself, fallback to playerHand.length if count not available
              const cardCount = opponentCardCounts[playerId] !== undefined 
                ? opponentCardCounts[playerId]
                : (playerId !== myPlayerId
                    ? (player.cardCount !== undefined && player.cardCount !== null
                        ? player.cardCount 
                        : (gameStarted ? 13 : 0)) // Default to 13 if game started, 0 otherwise
                    : playerHand.length); // For myself, use actual hand length as fallback
              const points = playerPoints[playerId] ?? 0;
              const isEliminated = points >= 30;
              const lastPlayedCards = playerLastPlayedCards[playerId] || [];
              const hasOneCard = cardCount === 1;
              
              // Check if only one player remains (has cards > 0)
              const playersWithCards = seatedPlayers.filter(p => {
                const pid = p.playerId;
                // For all players, prefer opponentCardCounts (from backend) if available
                const count = opponentCardCounts[pid] !== undefined 
                  ? opponentCardCounts[pid]
                  : (pid !== myPlayerId
                      ? (p.cardCount !== undefined ? p.cardCount : 0)
                      : playerHand.length);
                return count > 0;
              });
              const onlyOnePlayerRemains = playersWithCards.length === 1;
              const isLastPlayerRemaining = onlyOnePlayerRemains && playersWithCards[0]?.playerId === playerId;
              const isDisconnected = disconnectedPlayers.has(playerId);
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
              const displayName = (typeof player.displayName === 'string' ? player.displayName : null) 
                || (typeof player.username === 'string' ? player.username : null) 
                || `Player ${playerId}`;
              const playerUserId = player.userId || player.user_id || null;
              const pokerAvatar = getPokerAvatar(playerUserId, avatarUrl, displayName);
              const avatarGradient = getAvatarGradient(playerUserId);
              const formattedUserId = formatUserId(playerUserId);
              
              // Get the default avatar path based on player index and total player count
              const defaultAvatarPath = getAvatarPath(idx, sortedPlayers.length);

            // Calculate positions relative to myPlayerId
            // Each player always sees themselves at bottom left
            const getRelativePosition = (pid: number) => {
              if (!myPlayerId) return 'top-4 sm:top-10 left-1/2 -translate-x-1/2';
              
              // If this is me, always return bottom left position
              if (pid === myPlayerId) {
                return 'bottom-24 sm:bottom-10 left-2 sm:left-10';
              }
              
              // Calculate relative position based on playerId difference
              // My position (myPlayerId) is always bottom left
              // Other players are positioned in join order: top center, top right, top left
              const diff = pid - myPlayerId;
              
              // Normalize to 0-3 range (4 players max)
              const relativePosition = ((diff % 4) + 4) % 4;
              
              switch (relativePosition) {
                case 0: // Me - bottom left (shouldn't reach here due to check above, but keep for safety)
                  return 'bottom-24 sm:bottom-10 left-2 sm:left-10';
                case 1: // Next player (myPlayerId + 1) - top center
                  return 'top-4 sm:top-10 left-1/2 -translate-x-1/2';
                case 2: // Second next (myPlayerId + 2) - top right
                  return 'top-12 sm:top-20 right-2 sm:right-10';
                case 3: // Third next (myPlayerId + 3) - top left
                  return 'top-12 sm:top-20 left-2 sm:left-10';
                default:
                  return 'top-4 sm:top-10 left-1/2 -translate-x-1/2';
              }
            };
            
            const position = getRelativePosition(playerId);

            // Calculate timer progress (0 to 1)
            const timerProgress = remainingTime / 15;
            const showTimer = isCurrent && !isEliminated;

            return (
              <div key={playerId}>
                {/* Player Avatar with Timer Indicator */}
                <div className={`absolute ${position} z-40`}>
                  <div className="relative w-12 h-12 sm:w-16 sm:h-16">
                    {/* Professional Timer Circle Indicator - only for current player or me */}
                    {(showTimer || isMe) && (
                      <svg 
                        className="absolute inset-0 w-full h-full -rotate-90"
                        style={{ 
                          filter: showTimer ? 'drop-shadow(0 0 12px rgba(255, 193, 7, 0.9)) drop-shadow(0 0 24px rgba(255, 193, 7, 0.5))' : 'none',
                          zIndex: 41
                        }}
                        viewBox="0 0 64 64"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {/* Outer glow ring */}
                        {showTimer && (
                          <circle
                            cx="32"
                            cy="32"
                            r="32"
                            fill="none"
                            stroke={remainingTime <= 5 ? 'rgba(255, 71, 87, 0.3)' : 'rgba(255, 193, 7, 0.2)'}
                            strokeWidth="1"
                            className="animate-pulse"
                          />
                        )}
                        {/* Background circle with gradient effect */}
                        <circle
                          cx="32"
                          cy="32"
                          r="30"
                          fill="none"
                          stroke={isMe ? 'rgba(59, 130, 246, 0.25)' : 'rgba(0, 0, 0, 0.4)'}
                          strokeWidth="4"
                        />
                        {/* Timer progress circle with animated glow - blue theme */}
                        {showTimer && (
                          <>
                            <defs>
                              <linearGradient id={`timer-gradient-${playerId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor={remainingTime <= 5 ? '#FF4757' : '#3B82F6'} stopOpacity="1" />
                                <stop offset="100%" stopColor={remainingTime <= 5 ? '#FF6B7A' : '#60A5FA'} stopOpacity="0.9" />
                              </linearGradient>
                            </defs>
                            <circle
                              cx="32"
                              cy="32"
                              r="30"
                              fill="none"
                              stroke={`url(#timer-gradient-${playerId})`}
                              strokeWidth="4"
                              strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 30}`}
                              strokeDashoffset={`${2 * Math.PI * 30 * (1 - timerProgress)}`}
                              className="transition-all duration-1000 ease-linear"
                              style={{
                                filter: remainingTime <= 5 
                                  ? 'drop-shadow(0 0 8px rgba(255, 71, 87, 0.8))'
                                  : 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.7))',
                              }}
                            />
                            {/* Pulsing inner ring for urgency */}
                            {remainingTime <= 5 && (
                              <motion.circle
                                cx="32"
                                cy="32"
                                r="28"
                                fill="none"
                                stroke="#FF4757"
                                strokeWidth="2"
                                strokeOpacity="0.5"
                                animate={{
                                  scale: [1, 1.1, 1],
                                  opacity: [0.5, 0.8, 0.5],
                                }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                              />
                            )}
                          </>
                        )}
                        {/* My player indicator (blue border with glow) */}
                        {isMe && !showTimer && (
                          <motion.circle
                            cx="32"
                            cy="32"
                            r="31"
                            fill="none"
                            stroke="#3B82F6"
                            strokeWidth="3"
                            animate={{
                              opacity: [0.6, 1, 0.6],
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                            style={{
                              filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))',
                            }}
                          />
                        )}
                      </svg>
                    )}
                    {/* Professional Poker Avatar with Enhanced Styling */}
                    <div
                      className={`w-full h-full rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-2xl border-3 sm:border-4 overflow-hidden relative ${
                        (isLastPlayerRemaining && !isMe) || (hasOneCard && !isMe)
                          ? 'border-[#FF4757] shadow-xl shadow-[#FF4757]/70 animate-pulse'
                          : isCurrent && !isEliminated
                          ? 'border-[#3B82F6] shadow-xl shadow-[#3B82F6]/70'
                          : isMe
                          ? 'border-[#3B82F6] shadow-xl shadow-[#3B82F6]/80'
                          : 'border-[#1e3a5f]/60'
                      }`}
                      style={{
                        background: avatarGradient, // Always show gradient as fallback
                        borderWidth: '4px',
                        minHeight: '100%',
                        minWidth: '100%',
                        boxShadow: (isLastPlayerRemaining && !isMe) || (hasOneCard && !isMe)
                          ? '0 0 30px rgba(255, 71, 87, 0.8), 0 8px 24px rgba(255, 71, 87, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.15)'
                          : isCurrent && !isEliminated
                          ? '0 0 35px rgba(59, 130, 246, 0.9), 0 0 60px rgba(59, 130, 246, 0.5), 0 8px 24px rgba(0, 0, 0, 0.6), inset 0 0 20px rgba(255, 255, 255, 0.15)'
                          : isMe
                          ? '0 0 30px rgba(59, 130, 246, 0.8), 0 0 50px rgba(59, 130, 246, 0.4), 0 6px 20px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.12)'
                          : '0 4px 16px rgba(0, 0, 0, 0.6), inset 0 0 10px rgba(59, 130, 246, 0.1)',
                      }}
                    >
                      {/* Always show default avatar first, then try to overlay custom avatar if available */}
                      <img 
                        src={defaultAvatarPath} 
                        alt={displayName}
                        className="w-full h-full object-cover rounded-full absolute inset-0 z-10"
                        onError={(e) => {
                          // If default avatar fails, show gradient background with first letter
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const existingFallback = parent.querySelector('span.fallback-avatar');
                            if (existingFallback) {
                              existingFallback.remove();
                            }
                            const fallback = document.createElement('span');
                            fallback.className = 'fallback-avatar drop-shadow-lg text-2xl font-bold text-white absolute inset-0 flex items-center justify-center z-10';
                            fallback.textContent = pokerAvatar;
                            parent.appendChild(fallback);
                          }
                        }}
                        onLoad={() => {
                          // Default avatar loaded successfully
                          console.log('Default avatar loaded successfully for player', playerId, defaultAvatarPath);
                        }}
                      />
                      {/* Overlay custom avatar if available and valid */}
                      {avatarUrl && avatarUrl.trim() !== '' && (
                        <img 
                          src={avatarUrl} 
                          alt={displayName}
                          className="w-full h-full object-cover rounded-full absolute inset-0 z-20"
                          onError={(e) => {
                            // If custom avatar fails, just hide it and show default avatar
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            console.log('Custom avatar failed to load for player', playerId, 'showing default avatar');
                          }}
                          onLoad={() => {
                            // Image loaded successfully
                            console.log('Custom avatar loaded successfully for player', playerId, avatarUrl);
                          }}
                        />
                      )}
                      {/* WiFi Disconnected Icon Overlay - shown when player quits during game */}
                      {isDisconnected && !isMe && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 rounded-full backdrop-blur-sm">
                          <div className="relative flex items-center justify-center">
                            <MdSignalWifiOff 
                              className="text-red-500 text-2xl sm:text-3xl drop-shadow-lg"
                              style={{
                                filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))',
                              }}
                            />
                            {/* Pulsing animation for disconnected indicator */}
                            <motion.div
                              className="absolute inset-0 rounded-full bg-red-500/20"
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.8, 0.5],
                              }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Royal crown for current player - positioned above avatar, higher up to not cover face */}
                      {isCurrent && !isEliminated && (
                        <div className="absolute -top-6 sm:-top-8 left-1/2 -translate-x-1/2 z-50 text-yellow-400 text-lg sm:text-xl drop-shadow-lg pointer-events-none">
                          👑
                        </div>
                      )}
                    </div>
                    {/* Professional Timer text overlay for current player with blue theme */}
                    {showTimer && (
                      <motion.div 
                        className="absolute -bottom-7 left-1/2 -translate-x-1/2 z-50"
                        animate={{
                          scale: remainingTime <= 5 ? [1, 1.1, 1] : 1,
                        }}
                        transition={{ duration: 0.5, repeat: remainingTime <= 5 ? Infinity : 0 }}
                      >
                        <div 
                          className="px-3 py-1.5 rounded-lg text-white text-sm font-bold font-orbitron relative overflow-hidden"
                          style={{
                            background: remainingTime <= 5
                              ? 'linear-gradient(135deg, #FF4757 0%, #FF3838 100%)'
                              : 'linear-gradient(135deg, rgba(15, 42, 74, 0.95) 0%, rgba(30, 58, 95, 0.9) 100%)',
                            border: `2px solid ${remainingTime <= 5 ? '#FF6B7A' : 'rgba(59, 130, 246, 0.7)'}`,
                            boxShadow: remainingTime <= 5
                              ? '0 0 20px rgba(255, 71, 87, 0.8), 0 4px 12px rgba(0, 0, 0, 0.5)'
                              : '0 0 20px rgba(59, 130, 246, 0.6), 0 4px 12px rgba(0, 0, 0, 0.6)',
                            textShadow: '0 0 10px rgba(224, 231, 255, 0.8)',
                          }}
                        >
                          {remainingTime <= 5 && (
                            <motion.div
                              className="absolute inset-0"
                              style={{
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                              }}
                              animate={{
                                x: ['-100%', '200%'],
                              }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                            />
                          )}
                          <span className="relative z-10">{remainingTime}s</span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
                {/* Player Info with Last Played Cards - Container */}
                <div className={`absolute ${position} z-30`} style={{ 
                  [isMe ? 'bottom' : 'top']: isMe ? 'calc(4rem + 80px)' : 'calc(4rem + 80px)',
                  [isMe ? 'top' : 'bottom']: 'auto'
                }}>
                  <div className="relative flex items-center gap-1 sm:gap-2">
                    {/* Last Played Cards - Left side (for right-positioned players) */}
                    {lastPlayedCards.length > 0 && (idx === 1) && (
                      <div className="flex flex-row-reverse gap-0.5 items-center">
                        {lastPlayedCards.map((card, cardIdx) => (
                          <div key={cardIdx} className="transform scale-[0.4] sm:scale-[0.5] -mr-1 last:mr-0">
                            <CardComponent card={card} />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Professional Player Info Box with blue/black theme */}
                    <div
                      className={`p-2.5 sm:p-3.5 rounded-xl border-2 transition-all backdrop-blur-md ${
                        hasOneCard && !isMe && !isEliminated
                          ? 'border-[#FF4757] bg-gradient-to-br from-[#FF4757]/50 to-[#FF3838]/40 shadow-xl shadow-[#FF4757]/60 animate-pulse'
                          : isCurrent && !isEliminated
                          ? 'border-[#3B82F6] bg-gradient-to-br from-[#1e3a5f]/80 to-[#0f2a4a]/70 shadow-xl shadow-[#3B82F6]/60'
                          : 'border-[#1e3a5f]/50 bg-gradient-to-br from-black/80 to-[#0f2a4a]/70'
                      }`}
                      style={{
                        boxShadow: hasOneCard && !isMe && !isEliminated
                          ? '0 8px 32px rgba(255, 71, 87, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.2)'
                          : isCurrent && !isEliminated
                          ? '0 8px 32px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.15)'
                          : '0 4px 16px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(59, 130, 246, 0.1)',
                      }}
                    >
                      <p className="text-white text-[10px] sm:text-xs font-bold font-orbitron truncate max-w-[80px] sm:max-w-none">
                        {displayName}
                      </p>
                      {playerUserId && (
                        <p className="text-[#00C896] text-[9px] sm:text-[10px] font-orbitron">ID: {formattedUserId}</p>
                      )}
                      {/* Card count with icon */}
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#3B82F6]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className={`text-[10px] sm:text-xs font-bold ${hasOneCard && !isMe && !isEliminated ? 'text-[#FF4757] animate-pulse' : 'text-[#60A5FA]'}`}>
                          {cardCount > 0 ? cardCount : 0}
                          {hasOneCard && !isMe && !isEliminated && ' ⚠️'}
                        </p>
                      </div>
                      {/* Points with icon */}
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#3B82F6]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <p className="text-white/90 text-[10px] sm:text-xs font-semibold">{points}</p>
                      </div>
                      {isEliminated && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#FF4757]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <p className="text-[#FF4757] text-[10px] sm:text-xs font-bold">OUT</p>
                        </div>
                      )}
                      {hasOneCard && !isMe && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#FF4757] animate-pulse" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="text-[#FF4757] text-[9px] sm:text-xs font-bold animate-pulse">1 КАРТ ҮЛДЛЭЭ!</p>
                        </div>
                      )}
                    </div>
                    {/* Last Played Cards - Right side (for left/center positioned players) */}
                    {lastPlayedCards.length > 0 && (idx !== 1) && (
                      <div className="flex flex-row gap-0.5 items-center">
                        {lastPlayedCards.map((card, cardIdx) => (
                          <div key={cardIdx} className="transform scale-[0.4] sm:scale-[0.5] -ml-1 first:ml-0">
                            <CardComponent card={card} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
            });
          })()}
        </div>
      )}

      {/* Last Play Cards - Professional Center Display */}
      {gameStarted && lastPlay && lastPlay.cards && lastPlay.cards.length > 0 && (
        <motion.div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.6, y: -30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 25,
            mass: 0.8
          }}
        >
          {/* Professional Hand Rank Label with blue/black theme */}
          {lastPlay.rank && lastPlay.rank !== 'Invalid' && (
            <motion.div 
              className="px-8 py-3.5 rounded-full shadow-2xl relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1e40af 100%)',
                border: '2px solid rgba(59, 130, 246, 0.6)',
                boxShadow: '0 8px 32px rgba(59, 130, 246, 0.7), 0 0 60px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              }}
              animate={{
                boxShadow: [
                  '0 8px 32px rgba(59, 130, 246, 0.7), 0 0 60px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  '0 10px 40px rgba(59, 130, 246, 0.9), 0 0 80px rgba(59, 130, 246, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
                  '0 8px 32px rgba(59, 130, 246, 0.7), 0 0 60px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                ],
                scale: [1, 1.02, 1],
              }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              {/* Animated shimmer effect */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                }}
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
              <p 
                className="text-white text-base md:text-lg font-bold font-orbitron relative z-10 drop-shadow-lg"
                style={{
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.8), 0 0 15px rgba(224, 231, 255, 0.6)',
                  letterSpacing: '1px',
                }}
              >
                {lastPlay.rank}
              </p>
            </motion.div>
          )}
          {/* Cards with professional poker spread animation */}
          <motion.div 
            className={`flex items-center justify-center w-full px-2 sm:px-0 ${
              lastPlay.cards.length >= 5 ? 'gap-0.5 sm:gap-3' : 'gap-1 sm:gap-3'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {lastPlay.cards.map((card, idx) => {
              // Scale down cards on mobile when there are 5 cards to ensure they fit and are centered
              const isMobile = !isDesktop;
              const shouldScale = lastPlay.cards.length >= 5 && isMobile;
              const cardScale = shouldScale ? 0.6 : 1;
              
              return (
                <motion.div
                  key={`center-${card.rank}-${card.suit}-${idx}`}
                  className="flex-shrink-0"
                  initial={{ 
                    opacity: 0, 
                    scale: 0.3, 
                    rotateY: -180,
                    y: -50,
                    x: idx % 2 === 0 ? -30 : 30,
                  }}
                  animate={{ 
                    opacity: 1, 
                    scale: cardScale, 
                    rotateY: 0,
                    y: 0,
                    x: 0,
                  }}
                  transition={{ 
                    delay: idx * 0.08,
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                    mass: 0.7,
                  }}
                  whileHover={{ 
                    scale: shouldScale ? cardScale * 1.15 : 1.15, 
                    y: -10,
                    z: 30,
                    transition: { duration: 0.2 }
                  }}
                  style={{
                    filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))',
                  }}
                >
                  <CardComponent card={card} />
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>
      )}

      {/* Player Hand with Enhanced Display */}
      {gameStarted && (
        <div className="absolute bottom-20 sm:bottom-32 left-0 right-0 z-50 overflow-visible">
          {playerHand.length > 0 ? (
            <>
              {/* Enhanced Selection instructions with blue theme */}
              {isMyTurn && selectedCards.length === 0 && (
                <motion.div 
                  className="text-center mb-2 sm:mb-4 px-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <motion.p 
                    className="text-white/95 text-xs sm:text-sm md:text-base font-orbitron font-semibold"
                    animate={{
                      textShadow: [
                        '0 0 10px rgba(59, 130, 246, 0.6)',
                        '0 0 20px rgba(59, 130, 246, 0.9)',
                        '0 0 10px rgba(59, 130, 246, 0.6)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{
                      color: '#e0e7ff',
                    }}
                  >
                    ✨ Картуудыг сонгохын тулд дээр нь дараарай ✨
                  </motion.p>
                </motion.div>
              )}
              {/* Professional Poker Hand Cards with Enhanced Realistic Display */}
              {/* Card hand container with beautiful backdrop */}
              <div className="relative">
                {/* Subtle backdrop glow for card area */}
                <div 
                  className="absolute inset-x-0 bottom-0 h-32 sm:h-40 rounded-t-[50px] opacity-30"
                  style={{
                    background: 'radial-gradient(ellipse at center top, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
                    filter: 'blur(20px)',
                  }}
                />
                <div className="flex justify-center overflow-x-auto overflow-y-visible px-1 sm:px-2 md:px-4 pt-16 sm:pt-20 pb-4 sm:pb-6 relative z-10" style={{ minHeight: '240px', WebkitOverflowScrolling: 'touch', maxWidth: '100vw' }}>
                <div className="relative flex min-w-max" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
                  {playerHand.map((card, idx) => {
                    const isSelected = selectedCards.some(
                      (c) => c.rank === card.rank && c.suit === card.suit
                    );
                    const isInDragRange = isDragging && dragStartIndex !== null && dragEndIndex !== null &&
                      idx >= Math.min(dragStartIndex, dragEndIndex) && idx <= Math.max(dragStartIndex, dragEndIndex);
                    const isBestInRange = isInDragRange && dragRangeCards.length > 0 && 
                      selectedCards.some(c => c.rank === card.rank && c.suit === card.suit);
                    return (
                      <motion.div
                        key={`${card.rank}-${card.suit}-${idx}`}
                        // Mobile: negative margin for overlap to show all 13 cards, Web: normal gap
                        className={`relative ${idx === 0 ? '' : 'sm:ml-2 -ml-3 sm:-ml-0'}`}
                        style={{
                          zIndex: isSelected ? 50 : playerHand.length - idx,
                          filter: isSelected 
                            ? 'drop-shadow(0 0 20px rgba(46, 213, 115, 0.8)) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4))'
                            : 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3))',
                          opacity: isInDragRange && !isBestInRange ? 0.4 : 1,
                        }}
                        initial={{ 
                          opacity: 0, 
                          y: 150, 
                          rotateY: -180,
                          rotateZ: (idx - playerHand.length / 2) * 5,
                          scale: 0.3,
                          x: (idx - playerHand.length / 2) * 20,
                        }}
                        animate={{ 
                          opacity: isInDragRange && !isBestInRange ? 0.4 : 1, 
                          y: 0, 
                          rotateY: 0,
                          rotateZ: 0,
                          scale: 1,
                          x: 0,
                        }}
                        transition={{ 
                          delay: idx * 0.06,
                          type: "spring",
                          stiffness: 350,
                          damping: 25,
                          mass: 0.6,
                        }}
                        whileHover={!isSelected && !isDragging ? {
                          y: -15,
                          scale: 1.12,
                          rotateZ: 0,
                          transition: { 
                            duration: 0.25,
                            type: "spring",
                            stiffness: 400,
                          }
                        } : {
                          y: -10,
                          scale: 1.08,
                        }}
                        onMouseDown={(e) => handleCardDragStart(idx, e)}
                        onTouchStart={(e) => handleCardDragStart(idx, e)}
                        data-card-index={idx}
                      >
                        <CardComponent
                          card={card}
                          isSelected={isSelected}
                          isInSelectionRange={isInDragRange}
                          isStrongestInRange={isBestInRange}
                          onClick={() => handleCardClick(card)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white text-center py-4">
              <p className="text-sm sm:text-base" style={{ color: '#e0e7ff' }}>Картууд хүлээгдэж байна...</p>
            </div>
          )}
        </div>
      )}

      {/* Professional Poker Action Buttons */}
      {gameStarted && isMyTurn && (
        <motion.div 
          className="absolute bottom-2 sm:bottom-4 left-0 right-0 flex justify-center gap-2 sm:gap-3 px-2 sm:px-4 z-50"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            delay: 0.2,
            type: "spring",
            stiffness: 200,
            damping: 20
          }}
        >
          <motion.div 
            className="flex items-center gap-3 px-6 py-4 sm:px-8 sm:py-5 rounded-[35px] shadow-2xl relative overflow-hidden backdrop-blur-md"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 42, 74, 0.95) 0%, rgba(30, 58, 95, 0.9) 50%, rgba(0, 0, 0, 0.95) 100%)',
              border: '3px solid rgba(59, 130, 246, 0.5)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 4px rgba(0, 0, 0, 0.4)',
            }}
            animate={{
              boxShadow: [
                '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 4px rgba(0, 0, 0, 0.4)',
                '0 12px 50px rgba(0, 0, 0, 0.9), 0 0 40px rgba(59, 130, 246, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.15), inset 0 -2px 4px rgba(0, 0, 0, 0.4)',
                '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(59, 130, 246, 0.3), inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 4px rgba(0, 0, 0, 0.4)',
              ],
              borderColor: [
                'rgba(59, 130, 246, 0.5)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(59, 130, 246, 0.5)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {/* Animated shimmer effect with blue theme */}
            <motion.div
              className="absolute inset-0 rounded-[35px]"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.2), transparent)',
              }}
              animate={{
                x: ['-100%', '200%'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Professional ӨНЖИХ (FOLD) Icon Button */}
            <motion.button
              onClick={handlePass}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white relative overflow-hidden group"
              style={{ 
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2a4a 50%, #000000 100%)',
                border: '3px solid rgba(59, 130, 246, 0.6)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 130, 246, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
              }}
              whileHover={{ 
                scale: 1.15, 
                y: -5,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.9), 0 0 30px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.15)',
                borderColor: 'rgba(59, 130, 246, 0.9)',
              }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              title="Өнжих"
            >
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <FaHandPaper className="relative z-10 w-7 h-7 sm:w-9 sm:h-9" style={{ filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8))' }} />
            </motion.button>
            
            {/* Professional ТОГЛОХ (PLAY) Icon Button */}
            <motion.button
              onClick={handlePlayCards}
              disabled={selectedCards.length === 0}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white relative overflow-hidden group ${
                selectedCards.length > 0
                  ? 'cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              style={{ 
                background: selectedCards.length > 0
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1e40af 100%)'
                  : 'linear-gradient(135deg, #1e3a5f 0%, #0f2a4a 100%)',
                border: `3px solid ${selectedCards.length > 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)'}`,
                boxShadow: selectedCards.length > 0
                  ? '0 8px 24px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)'
                  : '0 4px 12px rgba(0, 0, 0, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
              }}
              whileHover={selectedCards.length > 0 ? { 
                scale: 1.15, 
                y: -5,
                boxShadow: '0 12px 32px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.25)',
                borderColor: 'rgba(59, 130, 246, 1)',
              } : {}}
              whileTap={selectedCards.length > 0 ? { scale: 0.9 } : {}}
              animate={selectedCards.length > 0 ? {
                boxShadow: [
                  '0 8px 24px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
                  '0 12px 32px rgba(59, 130, 246, 0.8), 0 0 30px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.25)',
                  '0 8px 24px rgba(59, 130, 246, 0.6), 0 0 20px rgba(59, 130, 246, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
                ],
              } : {}}
              transition={{ duration: 2.5, repeat: Infinity }}
              title="Тоглох"
            >
              {selectedCards.length > 0 && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
                  }}
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.6, 1, 0.6],
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              <FaPlay className="relative z-10 w-6 h-6 sm:w-8 sm:h-8 ml-1" style={{ filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8))' }} />
            </motion.button>
            
            {/* Professional ЗӨВЛӨГӨӨ (HINT) Icon Button */}
            <motion.button
              onClick={handleAdvice}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white relative overflow-hidden group"
              style={{ 
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2a4a 50%, #000000 100%)',
                border: '3px solid rgba(59, 130, 246, 0.6)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 20px rgba(59, 130, 246, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1)',
              }}
              whileHover={{ 
                scale: 1.15, 
                y: -5,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.9), 0 0 30px rgba(59, 130, 246, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.15)',
                borderColor: 'rgba(59, 130, 246, 0.9)',
              }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              title="Зөвлөгөө"
            >
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
                }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <FaLightbulb className="relative z-10 w-7 h-7 sm:w-9 sm:h-9" style={{ filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.8))' }} />
            </motion.button>
            
            {/* Clear Selection Icon Button */}
            {selectedCards.length > 0 && (
              <motion.button
                onClick={handleClearSelection}
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2a4a 100%)',
                  border: '2px solid rgba(59, 130, 246, 0.5)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.1)',
                }}
                whileHover={{ 
                  scale: 1.1, 
                  borderColor: 'rgba(59, 130, 246, 0.8)',
                }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                title="Сонголт цуцлах"
              >
                <MdClear className="w-5 h-5 sm:w-6 sm:h-6" />
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}


      {/* Ready Overlay - Show avatars in positions */}
      {!gameStarted && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          {/* Center info */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto w-[90%] sm:w-auto max-w-[300px]">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl border-2 border-[#00C896] px-4 py-3 sm:px-6 sm:py-4 shadow-2xl">
              <p className="text-gray-800 font-bold text-sm sm:text-lg text-center font-orbitron">
                Бэлэн тоглогчид: {Object.values(playerReadyStatus).filter(Boolean).length}/{Math.max(seatedPlayers.length, Object.keys(playerReadyStatus).length || 1)}
              </p>
              {!isConnected && (
                <p className="text-[#FF4757] text-sm text-center font-orbitron mt-2">
                  ⚠️ Серверт холбогдоогүй байна
                </p>
              )}
            </div>
          </div>

          {/* Show all 4 seats in positions - sorted by join order (playerId) */}
          {(() => {
            // Sort players by join order (playerId) to ensure consistent ordering
            const sortedPlayers = [...seatedPlayers].sort((a, b) => a.playerId - b.playerId);
            const allSeatIds = [1, 2, 3, 4];
            
            // Create a map of seatId to player for easy lookup
            const seatMap = new Map<number, any>();
            sortedPlayers.forEach(p => seatMap.set(p.playerId, p));
            
            // If I'm not in seatedPlayers yet, add myself
            if (myPlayerId && !seatMap.has(myPlayerId)) {
              seatMap.set(myPlayerId, {
                playerId: myPlayerId,
                username: myDisplayName || myUsername || 'Та',
                avatar_url: myAvatarUrl,
                userId: myUserId
              });
            }
            
            // Calculate positions relative to myPlayerId
            // Each player always sees themselves at bottom left
            const getRelativePosition = (playerId: number) => {
              if (!myPlayerId) return 'top-4 left-1/2 -translate-x-1/2';
              
              // If this is me, always return bottom left position
              if (playerId === myPlayerId) {
                return 'bottom-32 sm:bottom-10 left-2 sm:left-10';
              }
              
              // Calculate relative position based on playerId difference
              // My position (myPlayerId) is always bottom left
              // Other players are positioned in join order: top center, top right, top left
              const diff = playerId - myPlayerId;
              
              // Normalize to 0-3 range (4 players max)
              const relativePosition = ((diff % 4) + 4) % 4;
              
              switch (relativePosition) {
                case 0: // Me - bottom left (shouldn't reach here due to check above, but keep for safety)
                  return 'bottom-32 sm:bottom-10 left-2 sm:left-10';
                case 1: // Next player (myPlayerId + 1) - top center
                  return 'top-4 sm:top-10 left-1/2 -translate-x-1/2';
                case 2: // Second next (myPlayerId + 2) - top right
                  return 'top-16 sm:top-20 right-2 sm:right-10';
                case 3: // Third next (myPlayerId + 3) - top left
                  return 'top-16 sm:top-20 left-2 sm:left-10';
                default:
                  return 'top-4 sm:top-10 left-1/2 -translate-x-1/2';
              }
            };
            
            // Get player index for avatar assignment
            // Create a list of all actual players (occupied seats only) - calculate once outside map
            const actualPlayers = allSeatIds
              .map(id => seatMap.get(id))
              .filter(p => p !== undefined)
              .sort((a, b) => a.playerId - b.playerId);
            const totalPlayers = actualPlayers.length;
            
            return allSeatIds.map((seatId) => {
              const player = seatMap.get(seatId);
              const isOccupied = !!player;
              const isMe = seatId === myPlayerId;
              const isReady = playerReadyStatus[seatId] || false;
              
              // If this is my seat but I'm not in seatedPlayers yet, create a placeholder
              const displayPlayer = isMe && !player ? {
                playerId: myPlayerId,
                username: myDisplayName || myUsername || 'Та',
                avatar_url: myAvatarUrl,
                userId: myUserId
              } : player;
              
              // Use the actual playerId for position calculation, not seatId
              const actualPlayerId = displayPlayer?.playerId || seatId;
              const position = getRelativePosition(actualPlayerId);
              const playerColor = isMe ? '#3B82F6' : '#9C27B0';
            const displayName = (typeof displayPlayer?.username === 'string' ? displayPlayer.username : null)
              || (typeof displayPlayer?.displayName === 'string' ? displayPlayer.displayName : null)
              || (isMe ? (typeof myDisplayName === 'string' ? myDisplayName : (typeof myUsername === 'string' ? myUsername : 'Та')) : `Player ${seatId}`);
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
            const displayNameForAvatar = (typeof displayPlayer?.displayName === 'string' ? displayPlayer.displayName : null)
              || (typeof displayPlayer?.username === 'string' ? displayPlayer.username : null)
              || `Player ${seatId}`;
            const pokerAvatar = getPokerAvatar(playerUserId, avatarUrl, displayNameForAvatar);
            const avatarGradient = getAvatarGradient(playerUserId);
            const formattedUserId = formatUserId(playerUserId);
            
            // Find the index of this player in the sorted list
            const playerIndex = actualPlayers.findIndex(p => p?.playerId === actualPlayerId);
            
            // Get the default avatar path based on player index and total player count
            const defaultAvatarPath = getAvatarPath(playerIndex >= 0 ? playerIndex : 0, totalPlayers || 1);

            return (
              <div key={seatId} className={`absolute ${position} pointer-events-auto w-[140px] sm:w-auto`}>
                <motion.div
                  className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl border-2 sm:border-3 ${
                    isReady
                      ? 'border-[#2ED573] bg-gradient-to-br from-[#1e3a5f]/90 via-[#0f2a4a]/90 to-black/95 backdrop-blur-sm'
                      : isMe
                      ? 'border-[#3B82F6] bg-gradient-to-br from-[#1e3a5f]/90 via-[#0f2a4a]/90 to-black/95 backdrop-blur-sm'
                      : isOccupied
                      ? 'border-[#3B82F6]/50 bg-gradient-to-br from-[#1e3a5f]/80 via-[#0f2a4a]/80 to-black/90 backdrop-blur-sm'
                      : 'border-[#3B82F6]/30 bg-gradient-to-br from-[#1e3a5f]/60 via-[#0f2a4a]/60 to-black/80 backdrop-blur-sm'
                  }`}
                  style={{
                    boxShadow: isReady
                      ? '0 8px 32px rgba(46, 213, 115, 0.5), 0 0 20px rgba(46, 213, 115, 0.3), inset 0 0 20px rgba(59, 130, 246, 0.1)'
                      : isMe
                      ? '0 8px 32px rgba(59, 130, 246, 0.4), 0 0 20px rgba(59, 130, 246, 0.2), inset 0 0 20px rgba(59, 130, 246, 0.1)'
                      : isOccupied
                      ? '0 4px 20px rgba(59, 130, 246, 0.3), inset 0 0 10px rgba(59, 130, 246, 0.05)'
                      : '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 10px rgba(59, 130, 246, 0.05)',
                  }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="flex flex-col items-center gap-2 sm:gap-3">
                    {/* Chair or Office Person Icon */}
                    <div className="relative">
                      {isReady && (isOccupied || isMe) && (
                        <motion.div 
                          className="absolute inset-0 rounded-full bg-[#2ED573]/30"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                      {isOccupied || isMe ? (
                        <div className="relative">
                          <OfficePersonIcon 
                            size={isMe ? 90 : 80} 
                            isReady={isReady}
                            className="drop-shadow-2xl"
                            avatarUrl={avatarUrl}
                            name={displayName}
                          />
                          {/* Avatar overlay on person - always use default avatars based on player count */}
                          <div className="absolute top-2 left-1/2 -translate-x-1/2">
                            {/* Crown icon above avatar - positioned higher to not cover face */}
                            {isReady && (
                              <div className="absolute -top-5 sm:-top-6 left-1/2 -translate-x-1/2 z-30 text-yellow-400 text-lg sm:text-xl drop-shadow-lg pointer-events-none">
                                👑
                              </div>
                            )}
                            <div
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg border-2 shadow-xl overflow-hidden relative"
                              style={{
                                background: 'transparent',
                                borderColor: isReady
                                  ? '#2ED573'
                                  : isMe
                                  ? '#3B82F6'
                                  : '#3B82F6',
                                borderWidth: '2px',
                                boxShadow: isReady
                                  ? '0 0 15px rgba(46, 213, 115, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.1)'
                                  : isMe
                                  ? '0 0 15px rgba(59, 130, 246, 0.5), inset 0 0 10px rgba(255, 255, 255, 0.1)'
                                  : '0 0 10px rgba(59, 130, 246, 0.4), inset 0 0 8px rgba(255, 255, 255, 0.1)',
                              }}
                            >
                              {/* Always use default avatar based on player count and position */}
                              <img 
                                src={defaultAvatarPath} 
                                alt={displayName}
                                className="w-full h-full object-cover rounded-full z-10"
                                onError={(e) => {
                                  // If default avatar fails, show gradient background with first letter
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    const existingFallback = parent.querySelector('span');
                                    if (existingFallback) {
                                      existingFallback.remove();
                                    }
                                    const fallback = document.createElement('span');
                                    fallback.className = 'text-xl drop-shadow-lg font-bold text-white z-10';
                                    fallback.textContent = pokerAvatar;
                                    parent.appendChild(fallback);
                                  }
                                }}
                                onLoad={() => {
                                  console.log('Default avatar loaded in ready overlay for player', seatId, defaultAvatarPath);
                                }}
                              />
                              {/* Overlay custom avatar if available and valid */}
                              {avatarUrl && avatarUrl.trim() !== '' && (
                                <img 
                                  src={avatarUrl} 
                                  alt={displayName}
                                  className="w-full h-full object-cover rounded-full absolute inset-0 z-20"
                                  onError={(e) => {
                                    // If custom avatar fails, just hide it and show default avatar
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    console.log('Custom avatar failed to load in ready overlay for player', seatId);
                                  }}
                                  onLoad={() => {
                                    console.log('Custom avatar loaded in ready overlay for player', seatId, avatarUrl);
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Closed face for empty seats
                        <div className="relative flex items-center justify-center">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-[#1e3a5f]/60 to-[#0f2a4a]/60 border-2 border-[#3B82F6]/30 flex items-center justify-center shadow-xl">
                            <div className="text-4xl sm:text-5xl opacity-70">😶</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ready/Not Ready buttons - only for MY player */}
                    {isMe && (isOccupied || myPlayerId) && (
                      <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center">
                        {/* Ready (Check) button - Beautiful Icon */}
                        <motion.button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Check button clicked, current isReady:', isReady);
                            handleReady(true);
                          }}
                          disabled={isReady || !isConnected}
                          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 transition-all relative overflow-hidden ${
                            isReady
                              ? 'bg-[#2ED573] border-[#2ED573] shadow-lg shadow-[#2ED573]/50 cursor-default'
                              : !isConnected
                              ? 'bg-[#1e3a5f] border-[#3B82F6]/30 cursor-not-allowed opacity-50'
                              : 'bg-gradient-to-br from-[#1e3a5f] to-[#0f2a4a] border-[#2ED573] hover:bg-[#2ED573]/20 hover:scale-110 active:scale-95 cursor-pointer'
                          }`}
                          style={{
                            boxShadow: isReady
                              ? '0 0 20px rgba(46, 213, 115, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.1)'
                              : !isConnected
                              ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                              : '0 4px 12px rgba(59, 130, 246, 0.3), inset 0 0 8px rgba(59, 130, 246, 0.1)',
                          }}
                          whileHover={!isReady && isConnected ? { scale: 1.1 } : {}}
                          whileTap={!isReady && isConnected ? { scale: 0.9 } : {}}
                          title={isReady ? 'Бэлэн байна' : !isConnected ? 'Холбогдоогүй байна' : 'Бэлэн болгох'}
                        >
                          {!isReady && isConnected && (
                            <motion.div
                              className="absolute inset-0 rounded-full"
                              style={{
                                background: 'radial-gradient(circle, rgba(46, 213, 115, 0.2) 0%, transparent 70%)',
                              }}
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.8, 0.5],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                          <svg
                            className={`w-5 h-5 sm:w-6 sm:h-6 relative z-10 ${isReady ? 'text-white' : !isConnected ? 'text-[#3B82F6]/50' : 'text-[#2ED573]'}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.button>

                        {/* Not Ready (X) button - Beautiful Icon */}
                        <motion.button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('X button clicked, current isReady:', isReady);
                            handleReady(false);
                          }}
                          disabled={!isReady || !isConnected}
                          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 transition-all relative overflow-hidden ${
                            !isReady
                              ? 'bg-[#FF4757] border-[#FF4757] shadow-lg shadow-[#FF4757]/50 cursor-default'
                              : !isConnected
                              ? 'bg-[#1e3a5f] border-[#3B82F6]/30 cursor-not-allowed opacity-50'
                              : 'bg-gradient-to-br from-[#1e3a5f] to-[#0f2a4a] border-[#FF4757] hover:bg-[#FF4757]/20 hover:scale-110 active:scale-95 cursor-pointer'
                          }`}
                          style={{
                            boxShadow: !isReady
                              ? '0 0 20px rgba(255, 71, 87, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.1)'
                              : !isConnected
                              ? '0 2px 8px rgba(0, 0, 0, 0.3)'
                              : '0 4px 12px rgba(255, 71, 87, 0.3), inset 0 0 8px rgba(255, 71, 87, 0.1)',
                          }}
                          whileHover={isReady && isConnected ? { scale: 1.1 } : {}}
                          whileTap={isReady && isConnected ? { scale: 0.9 } : {}}
                          title={!isReady ? 'Бэлэн биш' : !isConnected ? 'Холбогдоогүй байна' : 'Бэлэн төлөв цуцлах'}
                        >
                          {isReady && isConnected && (
                            <motion.div
                              className="absolute inset-0 rounded-full"
                              style={{
                                background: 'radial-gradient(circle, rgba(255, 71, 87, 0.2) 0%, transparent 70%)',
                              }}
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.8, 0.5],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                          <svg
                            className={`w-5 h-5 sm:w-6 sm:h-6 relative z-10 ${!isReady ? 'text-white' : !isConnected ? 'text-[#3B82F6]/50' : 'text-[#FF4757]'}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            viewBox="0 0 24 24"
                          >
                            <path d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </motion.button>

                        {/* Action buttons - Beautiful Icons */}
                        <div className="flex gap-1.5 sm:gap-2">
                          <motion.button 
                            className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-[#1e3a5f] to-[#0f2a4a] border-2 border-[#3B82F6]/50 rounded-full flex items-center justify-center text-white hover:border-[#3B82F6] transition shadow-lg relative overflow-hidden"
                            style={{
                              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3), inset 0 0 8px rgba(59, 130, 246, 0.1)',
                            }}
                            whileHover={{ scale: 1.1, borderColor: '#3B82F6' }}
                            whileTap={{ scale: 0.9 }}
                            title="Солих"
                          >
                            <motion.div
                              className="absolute inset-0 rounded-full"
                              style={{
                                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
                              }}
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.8, 0.5],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 relative z-10 text-[#3B82F6]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </motion.button>
                          <motion.button 
                            className="w-9 h-9 sm:w-11 sm:h-11 bg-gradient-to-br from-[#1e3a5f] to-[#0f2a4a] border-2 border-[#3B82F6]/50 rounded-full flex items-center justify-center text-white hover:border-[#3B82F6] transition shadow-lg relative overflow-hidden"
                            style={{
                              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3), inset 0 0 8px rgba(59, 130, 246, 0.1)',
                            }}
                            whileHover={{ scale: 1.1, borderColor: '#3B82F6' }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setShowChatModal(true)}
                            title="Чат"
                          >
                            <motion.div
                              className="absolute inset-0 rounded-full"
                              style={{
                                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
                              }}
                              animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.8, 0.5],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 relative z-10 text-[#3B82F6]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Player name and ID */}
                  <div className="mt-1.5 sm:mt-2 text-center w-full">
                    <p className={`text-xs sm:text-sm font-bold font-orbitron truncate ${
                      (isOccupied || isMe) ? 'text-white' : 'text-[#3B82F6]/60'
                    }`}>
                      {(isOccupied || isMe)
                        ? displayName
                        : 'Хоосон'}
                    </p>
                    {(isOccupied || isMe) && playerUserId && (
                      <p className="text-[9px] sm:text-[10px] font-orbitron mt-0.5 sm:mt-1 text-[#3B82F6]/70">
                        ID: {formattedUserId}
                      </p>
                    )}
                    {(isOccupied || isMe) && (
                      <p
                        className={`text-[10px] sm:text-xs font-orbitron mt-0.5 sm:mt-1 ${
                          isReady ? 'text-[#2ED573] font-semibold' : 'text-[#3B82F6]/70'
                        }`}
                      >
                        {isReady ? 'Бэлэн ✓' : 'Хүлээгдэж байна'}
                      </p>
                    )}
                  </div>
                </motion.div>
              </div>
            );
            });
          })()}
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
        className="absolute top-4 left-4 w-12 h-12 bg-[#FF4757] rounded-full flex items-center justify-center text-white hover:bg-red-700 transition shadow-lg z-50"
      >
        ←
      </button>
      
      {/* Settings Button - Always visible */}
      <button 
        onClick={() => setShowSettingsPanel(!showSettingsPanel)}
        className="absolute top-4 left-20 w-12 h-12 bg-gradient-to-br from-[#1e3a5f] to-[#0f2a4a] rounded-full flex items-center justify-center text-white hover:from-[#3B82F6] hover:to-[#2563eb] transition shadow-lg border-2 border-[#3B82F6]/50 z-50"
        title="Тохиргоо"
      >
        <FaCog className="w-5 h-5" />
      </button>

      {/* Top Right Buttons - Only show during game */}
      {gameStarted && (
        <div className="absolute top-4 right-4 flex gap-2 z-50">
          <button 
            onClick={() => {
              setSortBySuit(!sortBySuit);
              setPlayerHand((prev) => {
                return sortBySuit ? sortCardsByRank(prev) : sortCardsBySuit(prev);
              });
            }}
            className="w-12 h-12 bg-[#00C896] rounded-full flex items-center justify-center text-white hover:bg-[#00A884] transition shadow-lg"
            title={sortBySuit ? "Зэрэглэлээр эрэмбэлэх" : "Дүрсээр эрэмбэлэх"}
          >
            {sortBySuit ? '🔢' : '🔄'}
          </button>
          <button 
            onClick={() => setShowChatModal(true)}
            className="w-12 h-12 bg-[#9C27B0] rounded-full flex items-center justify-center text-white hover:bg-purple-700 transition shadow-lg relative"
          >
            💬
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {chatMessages.length}
              </span>
            )}
          </button>
        </div>
      )}
      
      {/* Settings Panel - Always visible */}
      {showSettingsPanel && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-[198] bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSettingsPanel(false)}
          />
          
          {/* Settings Panel */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            className="fixed top-20 left-4 sm:left-auto sm:right-4 z-[200] w-[90%] sm:w-80 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f1419] border-2 border-[#3B82F6] rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-xl font-bold font-orbitron flex items-center gap-2">
                <FaCog className="w-5 h-5 text-[#3B82F6]" />
                Тохиргоо
              </h2>
              <button
                onClick={() => setShowSettingsPanel(false)}
                className="text-white hover:text-[#FF4757] transition text-xl"
              >
                ✕
              </button>
            </div>
            
            {/* Table Style Selection */}
            <div className="mb-6">
              <h3 className="text-white/90 text-sm font-semibold mb-3 font-orbitron">Ширээний загвар</h3>
              <div className="grid grid-cols-3 gap-3">
                {/* Green Style */}
                <motion.button
                  onClick={() => setTableStyle('green')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    tableStyle === 'green'
                      ? 'border-[#2ED573] shadow-lg shadow-[#2ED573]/50'
                      : 'border-[#3B82F6]/30 hover:border-[#3B82F6]/60'
                  }`}
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #2d5a3d 0%, #1e4a2d 25%, #0f3a1d 50%, #0a2a15 75%, #051a0d 100%)',
                  }}
                >
                  {tableStyle === 'green' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-[#2ED573]/20"
                    >
                      <span className="text-white text-2xl">✓</span>
                    </motion.div>
                  )}
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-white text-xs font-bold">
                    Ногоон
                  </div>
                </motion.button>
                
                {/* Blue Style */}
                <motion.button
                  onClick={() => setTableStyle('blue')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    tableStyle === 'blue'
                      ? 'border-[#3B82F6] shadow-lg shadow-[#3B82F6]/50'
                      : 'border-[#3B82F6]/30 hover:border-[#3B82F6]/60'
                  }`}
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #4a6fa5 0%, #3d5a80 25%, #2d4a6b 50%, #1e3a5f 75%, #0f2a4a 100%)',
                  }}
                >
                  {tableStyle === 'blue' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-[#3B82F6]/20"
                    >
                      <span className="text-white text-2xl">✓</span>
                    </motion.div>
                  )}
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-white text-xs font-bold">
                    Цэнхэр
                  </div>
                </motion.button>
                
                {/* Black Style */}
                <motion.button
                  onClick={() => setTableStyle('black')}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    tableStyle === 'black'
                      ? 'border-[#FFFFFF] shadow-lg shadow-[#FFFFFF]/30'
                      : 'border-[#3B82F6]/30 hover:border-[#3B82F6]/60'
                  }`}
                  style={{
                    background: 'radial-gradient(circle at 30% 30%, #2a2a2a 0%, #1a1a1a 25%, #0f0f0f 50%, #080808 75%, #000000 100%)',
                  }}
                >
                  {tableStyle === 'black' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center bg-[#FFFFFF]/10"
                    >
                      <span className="text-white text-2xl">✓</span>
                    </motion.div>
                  )}
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-white text-xs font-bold">
                    Хар
                  </div>
                </motion.button>
              </div>
            </div>
            
            {/* Additional Settings */}
            <div className="border-t border-[#3B82F6]/30 pt-4 space-y-4">
              {gameStarted && (
                <div className="flex items-center justify-between">
                  <span className="text-white/90 text-sm font-orbitron">Картын эрэмбэлэлт</span>
                  <button
                    onClick={() => {
                      setSortBySuit(!sortBySuit);
                      setPlayerHand((prev) => {
                        return sortBySuit ? sortCardsByRank(prev) : sortCardsBySuit(prev);
                      });
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      sortBySuit
                        ? 'bg-[#00C896] text-white'
                        : 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/50'
                    }`}
                  >
                    {sortBySuit ? 'Дүрсээр' : 'Зэрэглэлээр'}
                  </button>
                </div>
              )}
              
              {/* Table Style Preview */}
              <div>
                <h3 className="text-white/90 text-sm font-semibold mb-2 font-orbitron">Одоогийн загвар</h3>
                <div className="relative h-16 rounded-lg overflow-hidden border border-[#3B82F6]/30">
                  <div 
                    className="absolute inset-0"
                    style={{
                      background: getTableStyleConfig(tableStyle).background,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-bold font-orbitron drop-shadow-lg">
                      {tableStyle === 'green' ? '🟢 Ногоон' : tableStyle === 'blue' ? '🔵 Цэнхэр' : '⚫ Хар'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Game Info */}
              {gameStarted && (
                <div className="border-t border-[#3B82F6]/30 pt-4">
                  <div className="text-white/70 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Тоглогчид:</span>
                      <span className="font-semibold">{seatedPlayers.length}/4</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Холболт:</span>
                      <span className={`font-semibold ${isConnected ? 'text-[#2ED573]' : 'text-[#FF4757]'}`}>
                        {isConnected ? '✓ Холбогдсон' : '✗ Холбогдоогүй'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
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

      {/* Rejoin Modal */}
      {showRejoinModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-gradient-to-br from-[#1e3a5f] via-[#0f2a4a] to-black rounded-2xl p-6 sm:p-8 max-w-md w-[90%] border-2 border-[#3B82F6] shadow-2xl"
          >
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 text-center font-orbitron">
              Тоглоомд дахин нэгдэх уу?
            </h2>
            <p className="text-sm sm:text-base text-gray-300 mb-6 text-center">
              Тоглоом үргэлжилж байна. Дахин нэгдэх эсвэл гарах уу?
            </p>
            <div className="flex gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowRejoinModal(false);
                  // Player chooses to rejoin - they're already reconnected
                  // Just close the modal
                }}
                className="px-6 py-3 bg-gradient-to-r from-[#2ED573] to-[#1DB954] text-white font-bold rounded-lg shadow-lg hover:shadow-[#2ED573]/50 transition-all"
              >
                Дахин нэгдэх
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setShowRejoinModal(false);
                  // Player chooses to quit - leave the room
                  if (wsService && wsService.isConnected()) {
                    wsService.send({ type: 'leaveRoom' });
                  }
                  router.push('/room-selection');
                }}
                className="px-6 py-3 bg-gradient-to-r from-[#FF4757] to-[#C44569] text-white font-bold rounded-lg shadow-lg hover:shadow-[#FF4757]/50 transition-all"
              >
                Гарах
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Chat Modal / Panel */}
      {showChatModal && (
        <>
          {/* Backdrop - only on mobile */}
          {!isDesktop && (
            <div 
              className="fixed inset-0 z-[199] bg-black/50 backdrop-blur-sm"
              onClick={() => setShowChatModal(false)}
            />
          )}

          {/* Chat Modal / Panel */}
          <motion.div
            initial={isDesktop ? { x: chatPosition === 'right' ? 400 : -400, opacity: 0 } : { scale: 0.8, opacity: 0 }}
            animate={isDesktop ? { x: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isDesktop ? { x: chatPosition === 'right' ? 400 : -400, opacity: 0 } : { scale: 0.8, opacity: 0 }}
            className={`fixed z-[200] flex flex-col bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border-2 border-[#9C27B0] shadow-2xl ${
              isDesktop 
                ? `${chatPosition === 'right' ? 'right-4' : 'left-4'} bottom-4 w-80 h-96 rounded-[20px]`
                : 'inset-0 m-auto w-[90%] max-w-md h-[70vh] rounded-[20px]'
            }`}
          >
            {/* Header */}
            <div className="p-4 border-b border-[#9C27B0]/30 flex items-center justify-between">
              <h2 className="text-[#FFD700] text-lg font-bold font-orbitron">💬 Чат</h2>
              <div className="flex items-center gap-2">
                {isDesktop && (
                  <button
                    onClick={() => setChatPosition(chatPosition === 'right' ? 'left' : 'right')}
                    className="text-white hover:text-[#00C896] transition text-sm"
                    title="Move chat"
                  >
                    {chatPosition === 'right' ? '←' : '→'}
                  </button>
                )}
                <button
                  onClick={() => setShowChatModal(false)}
                  className="text-white hover:text-[#FF4757] transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-white text-center">Чат хоосон байна</p>
              ) : (
                chatMessages.map((msg, idx) => {
                  const player = seatedPlayers.find(p => p.playerId === msg.playerId);
                  const isMyMessage = msg.playerId === myPlayerId;
                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg ${
                        isMyMessage
                          ? 'bg-[#9C27B0]/30 ml-auto max-w-[80%]'
                          : 'bg-black/30 mr-auto max-w-[80%]'
                      }`}
                    >
                      <p className="text-[#00C896] text-xs font-bold">
                        {player?.displayName || player?.username || msg.username}
                      </p>
                      <p className="text-white text-sm">{msg.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#9C27B0]/30 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    if (wsService && wsService.isConnected()) {
                      wsService.send({
                        type: 'chat',
                        message: chatInput.trim(),
                      });
                      setChatInput('');
                    }
                  }
                }}
                placeholder="Зурвас илгээх..."
                className="flex-1 px-4 py-2 bg-black/50 border border-[#9C27B0]/30 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#9C27B0]"
              />
              <button
                onClick={() => {
                  if (chatInput.trim() && wsService && wsService.isConnected()) {
                    wsService.send({
                      type: 'chat',
                      message: chatInput.trim(),
                    });
                    setChatInput('');
                  }
                }}
                className="px-3 py-2 bg-[#9C27B0] text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center"
                title="Илгээх"
              >
                <IoMdSend className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

