'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { userStorage } from '@/lib/storage';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import { WebSocketService } from '@/lib/websocket';

export default function GameSelectionScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('Player');
  const [userBalance, setUserBalance] = useState(0);
  const [userId, setUserId] = useState<number | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [wsService, setWsService] = useState<WebSocketService | null>(null);

  // Format user ID as 6-digit number (add 100000)
  const formatUserId = (id: number | null): string => {
    if (!id) return '100000';
    return (id + 100000).toString().padStart(6, '0');
  };

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

    const name = userStorage.getDisplayName() || userStorage.getUsername() || 'Player';
    setUserName(name);
    const id = userStorage.getUserId();
    setUserId(id);
    refreshBalance();

    // Setup WebSocket for admin chat
    const ws = new WebSocketService();
    const userId = userStorage.getUserId();
    if (userId) {
      ws.connect(name, 'admin_chat_room');
      
      // Send joinRoom message after connection is established
      ws.on('connected', () => {
        console.log('✅ WebSocket connected, joining admin chat room');
        ws.send({
          type: 'joinRoom',
          username: name,
          roomId: 'admin_chat_room',
          userId: userId,
        });
      });
      
      // Handle message history when joining
      ws.on('messageHistory', (data: any) => {
        console.log('📚 Received message history:', data);
        if (data.messages && Array.isArray(data.messages)) {
          const formattedMessages = data.messages.map((msg: any) => ({
            userName: msg.userName || (msg.isAdmin ? 'Admin' : name),
            content: msg.content || msg.message,
            timestamp: msg.timestamp || new Date().toISOString(),
            isAdmin: msg.isAdmin || false,
          }));
          setChatMessages(formattedMessages);
        }
      });
      
      ws.on('adminNewMessage', (data: any) => {
        setChatMessages((prev) => [...prev, {
          userName: 'Admin',
          content: data.message?.content || data.message,
          timestamp: data.message?.timestamp || new Date().toISOString(),
          isAdmin: true,
        }]);
      });
      
      setWsService(ws);
    }

    return () => {
      ws.disconnect();
    };
  }, []);

  const handleLogout = async () => {
    try {
      userStorage.clearUser();
      try {
        if (auth) {
          await signOut(auth);
        }
      } catch (e) {}
      toast.success('Амжилттай гарлаа');
      router.push('/');
    } catch (error: any) {
      toast.error('Гарахад алдаа гарлаа');
    }
  };

  const sendChatMessage = () => {
    if (chatInput.trim() && wsService) {
      wsService.send({
        type: 'userToAdminMessage',
        message: chatInput.trim(),
        username: userName,
      });
      setChatInput('');
      toast.success('Мессеж илгээгдлээ!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0A111A] via-[#0F1923] to-[#0A111A]">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-10 h-10 rounded-full bg-[#1A2B3C] border border-[#00C896]/25 flex items-center justify-center hover:bg-[#00C896]/10 transition"
            >
              <span className="text-white text-lg">👤</span>
            </button>
            <div>
              <p className="text-white font-orbitron text-sm font-bold">{userName}</p>
              <p className="text-[#00C896] text-xs font-orbitron">
                ID: {formatUserId(userId)}
              </p>
              <p className="text-[#00C896] text-xs font-orbitron">
                {userBalance.toLocaleString()}₮
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowChatModal(true)}
              className="px-4 py-2 bg-[#1A2B3C] rounded-lg border border-[#00C896]/25 text-white text-sm font-orbitron hover:bg-[#00C896]/10 transition"
            >
              💬 Админтай чат
            </button>
            <button
              onClick={() => router.push('/buy-in')}
              className="px-6 py-2 bg-gradient-to-r from-[#00C896] to-[#00A884] rounded-lg text-white font-bold font-orbitron hover:shadow-lg hover:shadow-[#00C896]/30 transition"
            >
              🎮 ТОГЛОХ
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2 font-orbitron">
            MONGOL POKER 13
          </h1>
          <p className="text-[#00C896] font-orbitron">Premium Poker Experience</p>
        </motion.div>

        {/* Game Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/buy-in')}
            className="p-6 bg-gradient-to-br from-[#1A2B3C] to-[#0F1923] rounded-xl border-2 border-[#00C896]/50 hover:border-[#00C896] transition shadow-lg"
          >
            <div className="text-4xl mb-3">💰</div>
            <h3 className="text-white font-bold text-lg mb-2 font-orbitron">Cash Game</h3>
            <p className="text-white/70 text-sm">Бэлэн мөнгөний тоглоом</p>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-6 bg-gradient-to-br from-[#1A2B3C] to-[#0F1923] rounded-xl border-2 border-[#FFD700]/50 hover:border-[#FFD700] transition shadow-lg opacity-50 cursor-not-allowed"
          >
            <div className="text-4xl mb-3">🎯</div>
            <h3 className="text-white font-bold text-lg mb-2 font-orbitron">Tournament</h3>
            <p className="text-white/70 text-sm">Тэмцээн (Удахгүй)</p>
          </motion.button>
        </div>
      </div>

      {/* Logout Confirmation */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0F1923] rounded-2xl border-2 border-[#FF4757] p-6 max-w-sm w-full"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-[#FF4757]/10 border-2 border-[#FF4757] flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-white font-bold text-xl mb-2 font-orbitron">ГАРАХ</h3>
              <p className="text-white/70 text-sm">
                Та системээс гарахдаа итгэлтэй байна уу?
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 bg-[#1A2B3C] rounded-lg text-white font-bold hover:bg-[#1A2B3C]/80 transition"
              >
                БОЛИХ
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 bg-gradient-to-r from-[#FF4757] to-red-800 rounded-lg text-white font-bold hover:shadow-lg transition"
              >
                ГАРАХ
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0F1923] rounded-2xl border-2 border-[#00C896] w-full max-w-md h-[500px] flex flex-col"
          >
            <div className="p-4 border-b border-[#00C896]/30 bg-[#1A2B3C] rounded-t-2xl flex justify-between items-center">
              <h3 className="text-white font-bold font-orbitron">💬 Админтай чат</h3>
              <button
                onClick={() => setShowChatModal(false)}
                className="text-white hover:text-[#FF4757] transition"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.isAdmin
                      ? 'bg-[#9C27B0]/20 border border-[#9C27B0]/30'
                      : 'bg-[#1A2B3C] border border-[#00C896]/30'
                  }`}
                >
                  <p className="text-xs text-white/70 mb-1 font-orbitron">
                    {msg.userName}
                  </p>
                  <p className="text-white text-sm">{msg.content}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#00C896]/30 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Мессежээ бичнэ үү..."
                className="flex-1 px-4 py-2 bg-[#1A2B3C] border border-white/10 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#00C896]"
              />
              <button
                onClick={sendChatMessage}
                className="px-6 py-2 bg-gradient-to-r from-[#00C896] to-[#00A884] rounded-lg text-white font-bold hover:shadow-lg transition"
              >
                Илгээх
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

