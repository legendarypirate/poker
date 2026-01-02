'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { userStorage } from '@/lib/storage';
import { WebSocketService } from '@/lib/websocket';
import toast from 'react-hot-toast';

interface RoomSelectionScreenProps {
  buyIn: string;
}

export default function RoomSelectionScreen({ buyIn }: RoomSelectionScreenProps) {
  const router = useRouter();
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userBalance, setUserBalance] = useState(0);
  const [wsService, setWsService] = useState<WebSocketService | null>(null);

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

    const username = userStorage.getUsername() || 'user';
    const ws = new WebSocketService();
    
    ws.on('connected', () => {
      setIsConnected(true);
      setIsLoading(false);
      const buyInValue = parseInt(buyIn.replace('k', ''));
      ws.send({ type: 'getRoomStatuses', buyIn: buyInValue });
    });

    ws.on('roomStatus', (data: any) => {
      setPlayerCounts((prev) => ({
        ...prev,
        [data.roomId]: data.players,
      }));
    });

    ws.on('playerCount', (data: any) => {
      setPlayerCounts((prev) => ({
        ...prev,
        [data.roomId]: data.players,
      }));
    });

    ws.on('initialRoomData', (data: any) => {
      if (data.rooms) {
        setPlayerCounts(data.rooms);
      }
    });

    ws.on('error', (data: any) => {
      const message = data.message || 'Алдаа гарлаа';
      if (message.includes('Insufficient balance') || message.includes('20,000')) {
        toast.error('Хөрөнгө хүрэлцэхгүй байна. 20k тоглохын тулд хамгийн багадаа 20,000₮ шаардлагатай.');
      } else {
        toast.error(message);
      }
    });

    // Connect to a general room for room status updates
    ws.connect(username, 'room_status');
    setWsService(ws);

    return () => {
      ws.disconnect();
    };
  }, []);

  const handleJoinRoom = (roomId: string) => {
    if (!isConnected || !wsService) {
      toast.error('Холболт хүлээгдэж байна...');
      return;
    }

    const userId = userStorage.getUserId();
    const username = userStorage.getUsername() || 'user';
    const buyInValue = parseInt(buyIn.replace('k', ''));

    // Check balance for 20k buy-in
    if (buyInValue === 20 && userBalance < 20000) {
      toast.error('Хөрөнгө хүрэлцэхгүй байна. 20k тоглохын тулд хамгийн багадаа 20,000₮ шаардлагатай.');
      return;
    }

    // If balance is 22000, only allow 20k rooms
    if (userBalance === 22000 && buyInValue > 20) {
      toast.error('Таны хөрөнгө 22,000₮ байгаа тул зөвхөн 20k буй-интэй өрөөнд орох боломжтой.');
      return;
    }

    userStorage.set('selected_room_id', roomId);

    wsService.send({
      type: 'joinRoom',
      roomId,
      username,
      userId,
      buyIn: buyInValue,
      isObserving: false,
    });

    router.push(`/play?roomId=${roomId}`);
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
      <div className="p-4">
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
              <h2 className="text-white font-bold text-xs font-orbitron">ӨРӨӨ СОНГОЛТ</h2>
              <p className="text-white/70 text-[9px]">{buyIn} буй-интэй өрөөнүүд</p>
            </div>
          </div>

          <div className="px-3 py-2 bg-[#1A2B3C] rounded-lg border border-[#FFD700]/25">
            <div className="flex items-center gap-2">
              <span className="text-[#FFD700] text-xs">💰</span>
              <div className="text-right">
                <p className="text-white/70 text-[8px]">Хөрөнгө</p>
                <p className="text-[#FFD700] text-xs font-bold">
                  {userBalance.toLocaleString()}₮
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && (
          <div className="mb-4 px-3 py-2 bg-orange-500/15 rounded-lg border border-orange-500/30 flex items-center justify-center gap-2">
            <span className="text-orange-500 text-xs">⚠️</span>
            <p className="text-orange-500 text-[10px]">Холболт хүлээгдэж байна...</p>
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-[#00C896] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-white/70 text-sm font-orbitron">Өрөөнүуд ачаалж байна...</p>
          </div>
        ) : (
          <>
            {/* Room Header */}
            <div className="mb-4 px-4 py-2 bg-gradient-to-r from-[#1A2B3C] to-[#0F1923] rounded-lg border border-[#00C896]/30 flex items-center justify-center gap-2">
              <span className="text-[#00C896] text-xs">🏠</span>
              <p className="text-white text-xs font-bold font-orbitron">
                ӨРӨӨ СОНГОХ - {buyIn}
              </p>
            </div>

            {/* Rooms Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto">
              {Array.from({ length: 20 }, (_, i) => {
                const roomNumber = i + 1;
                const roomId = `room_${roomNumber}`;
                const players = playerCounts[roomId] || 0;
                const isFull = players >= 4;

                return (
                  <motion.button
                    key={roomId}
                    whileHover={{ scale: isFull ? 1 : 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => !isFull && handleJoinRoom(roomId)}
                    disabled={isFull}
                    className={`p-3 rounded-xl border-2 transition ${
                      isFull
                        ? 'bg-[#1A2B3C]/50 border-[#FF4757]/50 opacity-50 cursor-not-allowed'
                        : 'bg-gradient-to-br from-[#1A2B3C] to-[#0F1923] border-[#00C896]/40 hover:border-[#00C896]'
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                          isFull
                            ? 'bg-[#FF4757]/20 border border-[#FF4757]/30'
                            : 'bg-[#00C896]/20 border border-[#00C896]/30'
                        }`}
                      >
                        <span className="text-base">
                          {isFull ? '🔒' : '🎮'}
                        </span>
                      </div>
                      <p className="text-white font-bold text-sm mb-1 font-orbitron">
                        ӨРӨӨ {roomNumber}
                      </p>
                      <div className="px-2 py-1 bg-black/30 rounded border border-[#FFD700]/40 mb-2">
                        <p className="text-[#FFD700] text-[10px] font-bold font-orbitron">
                          {buyIn}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        <span className="text-white/70 text-[10px]">👥</span>
                        <p className="text-white/70 text-[10px] font-bold font-orbitron">
                          {isFull ? 'ДУУССАН' : `${players}/4`}
                        </p>
                      </div>
                      <div
                        className={`px-2 py-1 rounded text-[8px] font-bold font-orbitron ${
                          isFull
                            ? 'bg-[#FF4757]/20 text-[#FF4757] border border-[#FF4757]'
                            : 'bg-[#2ED573]/20 text-[#2ED573] border border-[#2ED573]'
                        }`}
                      >
                        {isFull ? 'ДУУССАН' : 'ОРНО УУ'}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Bottom Info */}
            <div className="mt-4 px-3 py-2 bg-[#1A2B3C] rounded-lg border border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#00C896]/10 rounded">
                  <span className="text-[#00C896] text-xs">ℹ️</span>
                </div>
                <p className="text-white/70 text-[10px]">4 тоглогчтой өрөөнүүд</p>
              </div>
              <div className="px-2 py-1 bg-black/30 rounded border border-white/10">
                <p className="text-white/70 text-[9px]">20 өрөөнүүд</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

