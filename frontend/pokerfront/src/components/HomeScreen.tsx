'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { authAPI } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { userStorage } from '@/lib/storage';
import toast from 'react-hot-toast';
import { logError, getErrorMessage } from '@/lib/utils/errorLogger';

export default function HomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showRegularAuth, setShowRegularAuth] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [email, setEmail] = useState('');

  const backgroundImage = 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2232&q=80';
  const cardBackgroundImage = 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2071&q=80';

  const handleRegularAuth = async () => {
    if (!username || !password) {
      toast.error('Нэвтрэх нэр, нууц үгээ оруулна уу');
      return;
    }

    if (isRegistering) {
      if (!passwordConfirm) {
        toast.error('Нууц үгээ давтан оруулна уу');
        return;
      }
      if (password !== passwordConfirm) {
        toast.error('Нууц үг таарахгүй байна');
        return;
      }
      if (password.length < 6) {
        toast.error('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        const response = await authAPI.register(username, password, passwordConfirm, email || undefined);
        if (response.user) {
          userStorage.setUser({ ...response.user, token: response.token });
          router.push('/game-selection');
        }
      } else {
        const response = await authAPI.login(username, password);
        if (response.user) {
          userStorage.setUser({ ...response.user, token: response.token });
          router.push('/game-selection');
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Амжилтгүй');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth) {
      toast.error('Firebase идэвхжээгүй байна');
      return;
    }

    setIsLoading(true);
    let firebaseUser: any = null;

    try {
      // Step 1: Firebase Authentication
      console.log('[Google Sign-In] Step 1: Starting Firebase authentication...');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      const result = await signInWithPopup(auth!, provider);
      firebaseUser = result.user;
      console.log('[Google Sign-In] Step 1: Firebase authentication successful', {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
      });

      // Step 2: Backend API call
      console.log('[Google Sign-In] Step 2: Sending user data to backend...');
      const response = await authAPI.socialLogin({
        firebase_uid: firebaseUser.uid,
        email: firebaseUser.email || undefined,
        display_name: firebaseUser.displayName || undefined,
        provider: 'google',
        avatar_url: firebaseUser.photoURL || undefined,
      });
      console.log('[Google Sign-In] Step 2: Backend API call successful');

      if (response.user) {
        userStorage.setUser({ ...response.user, token: response.token });
        console.log('[Google Sign-In] Success: User logged in and redirected');
        router.push('/game-selection');
      } else {
        throw new Error('Backend response missing user data');
      }
    } catch (error: any) {
      // Determine which step failed
      const step: 'firebase_auth' | 'backend_api' | 'unknown' = 
        firebaseUser === null ? 'firebase_auth' :
        error?.response || error?.config ? 'backend_api' :
        'unknown';

      // Log detailed error information
      const errorDetails = logError({
        error,
        step,
        userId: firebaseUser?.uid,
        email: firebaseUser?.email || error?.email,
        timestamp: new Date().toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
        url: typeof window !== 'undefined' ? window.location.href : 'N/A',
        additionalData: {
          firebaseAuthSuccess: firebaseUser !== null,
          firebaseUid: firebaseUser?.uid,
          backendUrl: error?.config?.url,
          backendMethod: error?.config?.method,
        },
      });

      // Get user-friendly error message
      const errorMessage = getErrorMessage(error, step);
      
      // Show error toast
      toast.error(errorMessage);

      // In development, also show detailed error in console
      if (process.env.NODE_ENV === 'development') {
        console.error('[Google Sign-In] Full error details:', errorDetails);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      // Note: Apple Sign-In may require additional setup
      // For now, show a message that it's not fully implemented
      toast.error('Apple Sign-In нь удахгүй идэвхжүүлнэ');
    } catch (error: any) {
      toast.error('Apple нэвтрэх амжилтгүй');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-cover bg-center"
      style={{
        backgroundImage: `url(${backgroundImage})`,
      }}
    >
      <div className="min-h-screen bg-black/85 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="p-6 rounded-2xl border-2 border-[#00FF87]/50 shadow-2xl"
            style={{
              backgroundImage: `url(${cardBackgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="bg-black/70 p-6 rounded-2xl">
              {/* Logo */}
              <div className="flex justify-center mb-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00FF87] to-[#00CC7A] border-3 border-white/30 shadow-lg flex items-center justify-center">
                  <span className="text-4xl">♠️</span>
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-white text-center mb-2 font-orbitron tracking-wider">
                MONGOL POKER 13
              </h1>
              <p className="text-[#00FF87] text-xs text-center mb-8 font-orbitron tracking-widest">
                Premium Poker Experience
              </p>

              {/* Regular Auth Form */}
              {showRegularAuth && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-6 space-y-4"
                >
                  <input
                    type="text"
                    placeholder="Нэвтрэх нэр"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#00FF87]"
                  />
                  {isRegistering && (
                    <input
                      type="email"
                      placeholder="Имэйл (сонголттой)"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#00FF87]"
                    />
                  )}
                  <input
                    type="password"
                    placeholder="Нууц үг"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#00FF87]"
                  />
                  {isRegistering && (
                    <input
                      type="password"
                      placeholder="Нууц үг давтах"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-[#00FF87]"
                    />
                  )}
                  <button
                    onClick={handleRegularAuth}
                    disabled={isLoading}
                    className="w-full py-3 bg-[#00FF87] text-white rounded-lg font-bold hover:bg-[#00CC7A] transition disabled:opacity-50"
                  >
                    {isLoading ? 'Түр хүлээнэ үү...' : isRegistering ? 'Бүртгүүлэх' : 'Нэвтрэх'}
                  </button>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setIsRegistering(!isRegistering)}
                      className="text-white/70 text-sm hover:text-white underline"
                    >
                      {isRegistering ? 'Нэвтрэх' : 'Бүртгүүлэх'}
                    </button>
                    <span className="text-white/50">•</span>
                    <button
                      onClick={() => {
                        setShowRegularAuth(false);
                        setIsRegistering(false);
                        setUsername('');
                        setPassword('');
                        setPasswordConfirm('');
                        setEmail('');
                      }}
                      className="text-white/70 text-sm hover:text-white"
                    >
                      Буцах
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Auth Buttons */}
              {!showRegularAuth && (
                <div className="flex gap-3 justify-center mb-6">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowRegularAuth(true);
                      setIsRegistering(false);
                    }}
                    className="w-24 h-24 bg-[#00FF87]/90 rounded-xl border border-white/20 shadow-lg flex flex-col items-center justify-center hover:shadow-[#00FF87]/30 transition"
                  >
                    <span className="text-3xl mb-2">📧</span>
                    <span className="text-[10px] font-bold text-white">EMAIL</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAppleSignIn}
                    disabled={isLoading}
                    className="w-24 h-24 bg-black/90 rounded-xl border border-white/20 shadow-lg flex flex-col items-center justify-center hover:shadow-black/30 transition disabled:opacity-50"
                  >
                    <span className="text-3xl mb-2">🍎</span>
                    <span className="text-[10px] font-bold text-white">APPLE</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    className="w-24 h-24 bg-red-900/90 rounded-xl border border-white/20 shadow-lg flex flex-col items-center justify-center hover:shadow-red-900/30 transition disabled:opacity-50"
                  >
                    <span className="text-3xl mb-2">G</span>
                    <span className="text-[10px] font-bold text-white">GOOGLE</span>
                  </motion.button>
                </div>
              )}

              {/* Features */}
              <div className="mt-6 p-4 bg-black/60 rounded-xl border border-white/10">
                <p className="text-[#00FF87] text-xs text-center mb-3 font-orbitron tracking-wider">
                  🎮 ТОГЛООМЫН ТӨРЛҮҮД
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['♠️ Texas Hold\'em', '♥️ Omaha', '♦️ 5 Card Draw', '♣️ 7 Card Stud', '🎯 Tournament', '💰 Cash Game'].map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 bg-black/40 rounded-full text-white text-[10px] border border-[#00FF87]/30"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Footer */}
          <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/10 text-center">
            <p className="text-white/70 text-[10px] mb-2">© 2024 MONGOL POKER 13 • v1.0.0</p>
            <div className="flex gap-2 justify-center text-[10px]">
              <button className="text-[#00FF87] underline">Privacy Policy</button>
              <span className="text-white/70">•</span>
              <button className="text-[#00FF87] underline">Terms of Service</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

