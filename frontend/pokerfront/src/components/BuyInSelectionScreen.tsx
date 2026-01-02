'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { userStorage } from '@/lib/storage';
import toast from 'react-hot-toast';

const buyInOptions = [
  { amount: '20k', value: 20, icon: '♦️', color: 'blue', rarity: 'common' },
  { amount: '50k', value: 50, icon: '♠️', color: 'red', rarity: 'rare' },
  { amount: '100k', value: 100, icon: '♥️', color: 'green', rarity: 'epic' },
  { amount: '200k', value: 200, icon: '♣️', color: 'purple', rarity: 'legendary' },
];

export default function BuyInSelectionScreen() {
  const router = useRouter();
  const [userBalance, setUserBalance] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const refreshBalance = async () => {
      try {
        const { authAPI } = await import('@/lib/api');
        const response = await authAPI.getCurrentUser();
        if (response.success && response.user) {
          userStorage.setUser(response.user);
          setUserBalance(response.user.account_balance || 0);
          console.log('✅ Balance refreshed:', response.user.account_balance);
        } else {
          // Fallback to stored balance if API fails
          const balance = userStorage.getBalance() || 0;
          setUserBalance(balance);
        }
      } catch (error) {
        console.error('❌ Error refreshing balance:', error);
        // Fallback to stored balance if API fails
        const balance = userStorage.getBalance() || 0;
        setUserBalance(balance);
      }
    };

    refreshBalance();
  }, []);

  const handleBuyInSelect = (option: typeof buyInOptions[0]) => {
    const buyInAmount = option.value * 1000;

    if (userBalance < buyInAmount) {
      toast.error(`Үлдэгдэл хүрэлцэхгүй. ${buyInAmount.toLocaleString()}₮ шаардлагатай.`);
      return;
    }

    userStorage.set('selected_buy_in', option.value);
    router.push(`/room-selection?buyIn=${option.amount}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A111A] via-[#0F1923] to-[#0A111A]">
      {/* Top Image */}
      <div className="h-64 w-full bg-gradient-to-b from-[#0F1923] to-[#0A111A] flex items-center justify-center">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-full h-full flex items-center justify-center"
        >
          <img 
            src="/mgl.png" 
            alt="Poker" 
            className="max-w-full max-h-full object-contain"
          />
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-8 h-8 rounded-full bg-[#1A2B3C]/80 border border-[#00C896]/25 flex items-center justify-center hover:bg-[#00C896]/10 transition"
            >
              ←
            </button>
            <div>
              <h2 className="text-white font-bold text-xs font-orbitron">Buy In СОНГОЛТ</h2>
              <p className="text-white/70 text-[9px]">Хэмжээ сонгоно уу</p>
            </div>
          </div>

          <div className="px-3 py-2 bg-[#1A2B3C] rounded-lg border border-[#FFD700]/25">
            <div className="flex items-center gap-2">
              <span className="text-[#FFD700] text-xs">💰</span>
              <div className="text-right">
                <p className="text-white/70 text-[8px]">Дансны үлдэгдэл</p>
                <p className="text-[#FFD700] text-xs font-bold">
                  {userBalance.toLocaleString()}₮
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Buy-In Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {buyInOptions.map((option, index) => {
            const buyInAmount = option.value * 1000;
            const isRestricted = userBalance < buyInAmount;
            const isHovered = hoveredIndex === index;

            return (
              <motion.button
                key={option.amount}
                whileHover={{ scale: isHovered ? 1.05 : 1 }}
                whileTap={{ scale: 0.95 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => !isRestricted && handleBuyInSelect(option)}
                disabled={isRestricted}
                className={`relative p-4 rounded-xl border-2 transition ${
                  isRestricted
                    ? 'bg-[#1A2B3C]/50 border-[#FF4757]/50 opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-br from-[#1A2B3C] to-[#0F1923] border-[#00C896]/25 hover:border-[#00C896]'
                }`}
              >
                {isRestricted && (
                  <div className="absolute inset-0 bg-black/50 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-2xl mb-1">🔒</span>
                    <p className="text-[#FF4757] text-[10px] font-bold font-orbitron">
                      Дансаа цэнэглэнэ үү
                    </p>
                  </div>
                )}

                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/90 to-blue-500/40 border border-white/15 flex items-center justify-center mb-2">
                    <span className="text-base">{option.icon}</span>
                  </div>
                  <p className="text-[#FFD700] font-bold text-base mb-2 font-orbitron">
                    {option.amount}
                  </p>
                  <div className="px-2 py-1 bg-[#00C896]/12 rounded border border-[#00C896]/70">
                    <div className="flex items-center gap-1">
                      <span className="text-[#00C896] text-[8px]">▶</span>
                      <span className="text-[#00C896] text-[8px] font-bold font-orbitron">
                        ТОГЛОХ
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Add Money Button */}
        <button className="w-full py-3 bg-gradient-to-r from-[#00C896] to-[#00A884] rounded-lg text-white font-bold hover:shadow-lg hover:shadow-[#00C896]/30 transition flex items-center justify-center gap-2">
          <span>+</span>
          <span>ЦЭНЭГЛЭХ</span>
        </button>
      </div>
    </div>
  );
}

