'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { userStorage } from '@/lib/storage';
import GameSelectionScreen from '@/components/GameSelectionScreen';

export default function GameSelectionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userId = userStorage.getUserId();
    if (!userId) {
      router.push('/');
    } else {
      setIsLoading(false);
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0F1923]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#00C896] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#00C896] font-orbitron text-sm">Ачаалж байна...</p>
        </div>
      </div>
    );
  }

  return <GameSelectionScreen />;
}

