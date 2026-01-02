'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface GameOverModalProps {
  isOpen: boolean;
  winnerId: number;
  finalPoints: Record<number, number>;
  eliminatedPlayers: number[];
  seatedPlayers: any[];
  myPlayerId: number;
  onClose: () => void;
  onNewGame?: () => void;
  wsService?: any; // WebSocket service to send leaveRoom message
  completeSuitWin?: boolean;
  winningSuit?: string;
}

export default function GameOverModal({
  isOpen,
  winnerId,
  finalPoints,
  eliminatedPlayers,
  seatedPlayers,
  myPlayerId,
  onClose,
  onNewGame,
  wsService,
  completeSuitWin = false,
  winningSuit,
}: GameOverModalProps) {
  const router = useRouter();
  const winner = seatedPlayers.find((p) => p.playerId === winnerId) || {
    username: `Player ${winnerId}`,
    displayName: `Player ${winnerId}`,
  };

  const handleNewGame = () => {
    onClose();
    if (onNewGame) {
      onNewGame();
    } else {
      // Navigate to game selection or reload
      router.push('/play');
    }
  };

  const handleMainMenu = () => {
    // Send leaveRoom message when navigating to main menu after game finishes
    if (wsService && wsService.isConnected()) {
      wsService.send({ type: 'leaveRoom' });
    }
    onClose();
    router.push('/');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="relative z-10 w-[90%] max-w-md"
        >
          <div
            className="p-6 rounded-[20px] border-[3px] border-[#FFD700] shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Celebration Icon */}
            <div className="flex justify-center mb-3">
              <div className="text-5xl">🎉</div>
            </div>

            {/* Winner Title */}
            <h2 className="text-[#FFD700] text-lg font-bold text-center mb-4 font-orbitron">
              {completeSuitWin ? (
                <>
                  🏆 {winner.displayName || winner.username} БҮХЭЛ БОЛОМЖТОЙ ЯЛЛАА! 🏆
                  <div className="text-sm mt-2 text-white/90">
                    {winningSuit && `Бүх ${winningSuit} карттай!`}
                  </div>
                </>
              ) : (
                <>🎉 {winner.displayName || winner.username} ТОГЛООМЫГ ЯЛЛАА!</>
              )}
            </h2>

            {/* Eliminated Players Section */}
            {eliminatedPlayers.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-[#FF4757]/30">
                {eliminatedPlayers.map((playerId) => {
                  const player = seatedPlayers.find((p) => p.playerId === playerId) || {
                    username: `Player ${playerId}`,
                    displayName: `Player ${playerId}`,
                  };
                  return (
                    <div key={playerId} className="py-1 flex items-center gap-2">
                      <span className="text-[#FF4757]">🚫</span>
                      <span className="text-white font-bold font-orbitron">
                        {player.displayName || player.username} - {finalPoints[playerId] ?? 0} оноо
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Final Points Table */}
            <div className="mb-5 p-3 rounded-xl bg-black/30">
              {Object.entries(finalPoints).map(([playerIdStr, points]) => {
                const playerId = parseInt(playerIdStr, 10);
                const player = seatedPlayers.find((p) => p.playerId === playerId) || {
                  username: `Player ${playerId}`,
                  displayName: `Player ${playerId}`,
                };
                const isWinner = playerId === winnerId;
                const isEliminated = eliminatedPlayers.includes(playerId);
                const isMe = playerId === myPlayerId;

                return (
                  <div key={playerId} className="py-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {isEliminated && <span className="text-[#FF4757] text-sm">🚫</span>}
                        <span
                          className={`font-orbitron ${
                            isWinner
                              ? 'text-[#FFD700] font-bold'
                              : isEliminated
                              ? 'text-[#FF4757] font-normal'
                              : 'text-white font-normal'
                          }`}
                        >
                          {player.displayName || player.username}
                          {isMe ? ' (Та)' : ''}
                        </span>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-[10px] font-orbitron font-bold ${
                          isWinner
                            ? 'bg-[#FFD700] text-black'
                            : isEliminated
                            ? 'bg-[#FF4757] text-white'
                            : 'bg-[#9C27B0] text-white'
                        }`}
                      >
                        {points} оноо
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleNewGame}
                className="px-5 py-3 bg-[#00C896] text-white font-bold font-orbitron rounded-lg hover:bg-[#00A884] transition-all shadow-lg hover:scale-105 active:scale-95"
              >
                ШИНЭ ТОГЛООМ
              </button>
              <button
                onClick={handleMainMenu}
                className="px-5 py-3 bg-[#9C27B0] text-white font-bold font-orbitron rounded-lg hover:bg-[#7B1FA2] transition-all shadow-lg hover:scale-105 active:scale-95"
              >
                ҮНДСЭН ЦЭС
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

