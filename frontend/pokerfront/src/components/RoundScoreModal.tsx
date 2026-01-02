'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RoundScoreModalProps {
  isOpen: boolean;
  pointsUpdate: Record<number, number>;
  roundWinnerId: number;
  seatedPlayers: any[];
  myPlayerId: number;
  onClose: () => void;
}

export default function RoundScoreModal({
  isOpen,
  pointsUpdate,
  roundWinnerId,
  seatedPlayers,
  myPlayerId,
  onClose,
}: RoundScoreModalProps) {
  const roundWinner = seatedPlayers.find(
    (p) => p.playerId === roundWinnerId
  ) || { username: `Player ${roundWinnerId}`, displayName: `Player ${roundWinnerId}` };

  // Auto-close after 3 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only depend on isOpen, not onClose to avoid re-running

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
              background: 'linear-gradient(135deg, #00C896 0%, #2ED573 100%)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Trophy Icon */}
            <div className="flex justify-center mb-3">
              <div className="text-5xl">🏆</div>
            </div>

            {/* Title */}
            <h2 className="text-white text-2xl font-bold text-center mb-3 font-orbitron">
              Дугуй дууслаа!
            </h2>

            {/* Winner Message */}
            <p className="text-[#FFD700] text-base font-bold text-center mb-4 font-orbitron">
              🎉 {roundWinner.displayName || roundWinner.username} дугуйг яллаа!
            </p>

            {/* Points Table */}
            <div className="mb-4 p-3 rounded-xl bg-black/30">
              {Object.entries(pointsUpdate).map(([playerIdStr, points]) => {
                const playerId = parseInt(playerIdStr, 10);
                const player = seatedPlayers.find((p) => p.playerId === playerId) || {
                  username: `Player ${playerId}`,
                  displayName: `Player ${playerId}`,
                };
                const isWinner = playerId === roundWinnerId;
                const isMe = playerId === myPlayerId;

                return (
                  <div key={playerId} className="py-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-orbitron ${
                          isWinner
                            ? 'text-[#FFD700] font-bold'
                            : 'text-white font-normal'
                        }`}
                      >
                        {player.displayName || player.username}
                        {isMe ? ' (Та)' : ''}
                      </span>
                      <div
                        className={`px-3 py-1 rounded-[10px] font-orbitron font-bold ${
                          isWinner
                            ? 'bg-[#FFD700] text-black'
                            : 'bg-[#00C896] text-white'
                        }`}
                      >
                        {points}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Countdown Message */}
            <p className="text-white/70 text-xs italic text-center font-orbitron">
              Дараагийн дугуй 3 секундын дараа эхлэх болно...
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

