'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { userStorage } from '@/lib/storage';
import { authAPI } from '@/lib/api';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithCredential, OAuthProvider } from 'firebase/auth';
import HomeScreen from '@/components/HomeScreen';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const userId = userStorage.getUserId();
    if (userId) {
      setIsLoading(false);
      router.push('/game-selection');
      return;
    }

    // Check Firebase auth
    if (!auth) {
      setIsLoading(false);
      return;
    }

    try {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          // User is signed in, save to backend
          try {
            const provider = user.providerData[0]?.providerId === 'apple.com' ? 'apple' : 'google';
            const response = await authAPI.socialLogin({
              firebase_uid: user.uid,
              email: user.email || undefined,
              display_name: user.displayName || undefined,
              provider,
              avatar_url: user.photoURL || undefined,
            });
            
            if (response.user) {
              userStorage.setUser({ ...response.user, token: response.token });
              router.push('/game-selection');
            }
          } catch (error) {
            console.error('Error saving user to backend:', error);
          }
        }
        setIsLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error initializing Firebase auth:', error);
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0A0A]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00FF87] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#00FF87] font-orbitron text-sm tracking-wider">
            ТОГЛООМ ХОЛБОГДОЖ БАЙНА...
          </p>
        </div>
      </div>
    );
  }

  return <HomeScreen />;
}
