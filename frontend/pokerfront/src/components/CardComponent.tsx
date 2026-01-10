'use client';

import React from 'react';
import { Card } from '@/lib/models/card';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface CardComponentProps {
  card: Card;
  isSelected?: boolean;
  isInSelectionRange?: boolean;
  isStrongestInRange?: boolean;
  faceDown?: boolean;
  onClick?: () => void;
}

const suitSymbols: Record<string, string> = {
  '♠': '♠',
  '♥': '♥',
  '♦': '♦',
  '♣': '♣',
};

const suitColors: Record<string, string> = {
  '♠': 'text-gray-900',
  '♥': 'text-red-700',
  '♦': 'text-red-700',
  '♣': 'text-gray-900',
};

// Get inline style for red suits to ensure visibility
const getSuitStyle = (suit: string): React.CSSProperties => {
  if (suit === '♥' || suit === '♦') {
    return { color: '#991b1b', fontWeight: 'bold' }; // red-800, very dark red for maximum visibility
  }
  return { color: '#111827', fontWeight: 'bold' }; // gray-900 for black suits
};

export default function CardComponent({
  card,
  isSelected = false,
  isInSelectionRange = false,
  isStrongestInRange = false,
  faceDown = false,
  onClick,
}: CardComponentProps) {
  const isRed = card.suit === '♥' || card.suit === '♦';
  const cardColor = isRed ? '#dc2626' : '#111827';
  const goldColor = '#fbbf24';
  
  // Motion values for 3D tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7.5, -7.5]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-7.5, 7.5]), { stiffness: 300, damping: 30 });

  if (faceDown) {
    return (
      <motion.div
        className="w-14 h-20 md:w-16 md:h-24 rounded-xl border-2 border-amber-400/40 shadow-2xl flex items-center justify-center relative overflow-hidden cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 30%, #3b82f6 50%, #1e40af 70%, #1e3a8a 100%)',
          boxShadow: '0 12px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
        }}
        whileHover={{ scale: 1.08, rotateY: 5 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {/* Animated shimmer effect */}
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          style={{
            background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
            backgroundSize: '200% 200%',
          }}
        />
        {/* Decorative royal pattern */}
        <div className="absolute inset-0 opacity-15" style={{
          backgroundImage: `
            radial-gradient(circle at 3px 3px, rgba(255,255,255,0.4) 1px, transparent 0),
            radial-gradient(circle at 8px 8px, rgba(251,191,36,0.3) 1px, transparent 0)
          `,
          backgroundSize: '12px 12px, 16px 16px',
        }} />
        <motion.span 
          className="text-white text-lg md:text-xl font-bold relative z-10"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ?
        </motion.span>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set((e.clientX - centerX) / (rect.width / 2));
        y.set((e.clientY - centerY) / (rect.height / 2));
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      whileHover={isSelected ? {} : { scale: 1.12, y: -8, z: 20 }}
      whileTap={{ scale: 0.94 }}
      animate={isSelected ? {
        scale: 1.15,
        y: -16,
        rotateZ: 0,
        z: 30,
      } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`w-9 h-12 sm:w-12 sm:h-18 md:w-16 md:h-24 rounded-lg sm:rounded-xl flex flex-col items-center justify-center relative cursor-pointer ${
        isSelected
          ? 'border-4 shadow-2xl'
          : isStrongestInRange
          ? 'border-3 shadow-xl'
          : isInSelectionRange
          ? 'border-2 shadow-lg'
          : 'border-2 shadow-md'
      }`}
      style={{
        rotateX: isSelected ? 0 : rotateX,
        rotateY: isSelected ? 0 : rotateY,
        transformStyle: 'preserve-3d',
        background: isSelected
          ? `linear-gradient(135deg, ${goldColor} 0%, #f59e0b 25%, #d97706 50%, #f59e0b 75%, ${goldColor} 100%)`
          : `linear-gradient(135deg, #ffffff 0%, #fafafa 25%, #ffffff 50%, #f9fafb 75%, #ffffff 100%)`,
        borderColor: isSelected
          ? goldColor
          : isStrongestInRange
          ? goldColor
          : isInSelectionRange
          ? `${goldColor}80`
          : '#e5e7eb',
        boxShadow: isSelected
          ? `0 16px 32px rgba(251, 191, 36, 0.6), 0 0 0 4px rgba(251, 191, 36, 0.3), 0 0 40px rgba(251, 191, 36, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)`
          : isStrongestInRange
          ? `0 10px 20px rgba(251, 191, 36, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.6)`
          : isInSelectionRange
          ? `0 8px 16px rgba(251, 191, 36, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.6)`
          : `0 6px 12px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.9)`,
      }}
    >
      {/* Animated glow effect when selected */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 rounded-xl"
          animate={{
            boxShadow: [
              '0 0 20px rgba(251, 191, 36, 0.6)',
              '0 0 40px rgba(251, 191, 36, 0.8)',
              '0 0 20px rgba(251, 191, 36, 0.6)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Royal decorative corner patterns */}
      <motion.div 
        className="absolute top-0 left-0 w-4 h-4 opacity-30"
        style={{
          background: `linear-gradient(135deg, ${cardColor} 0%, transparent 70%)`,
          clipPath: 'polygon(0 0, 100% 0, 0 100%)',
        }}
        animate={isSelected ? { opacity: [0.3, 0.6, 0.3] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <motion.div 
        className="absolute bottom-0 right-0 w-4 h-4 opacity-30"
        style={{
          background: `linear-gradient(135deg, transparent 0%, ${cardColor} 100%)`,
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
        }}
        animate={isSelected ? { opacity: [0.3, 0.6, 0.3] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      />

      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
      }} />

      {/* Rank with elegant typography */}
      <motion.div 
        className={`text-xs sm:text-sm md:text-lg lg:text-xl font-bold leading-tight ${isSelected ? 'text-white' : ''}`}
        style={isSelected ? { 
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.4), 0 0 8px rgba(0, 0, 0, 0.2)',
          fontWeight: 800,
        } : getSuitStyle(card.suit)}
        animate={isSelected ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {card.rank}
      </motion.div>
      
      {/* Suit with elegant styling */}
      <motion.div 
        className={`text-sm sm:text-base md:text-2xl lg:text-3xl font-black leading-none mt-0.5 sm:mt-1 ${isSelected ? 'text-white' : ''}`}
        style={isSelected ? { 
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.4), 0 0 8px rgba(0, 0, 0, 0.2)',
          fontWeight: 900,
        } : getSuitStyle(card.suit)}
        animate={isSelected ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {suitSymbols[card.suit] || card.suit}
      </motion.div>

      {/* Animated gold accent line when selected */}
      {isSelected && (
        <motion.div 
          className="absolute bottom-0 left-0 right-0 h-1.5"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.8), rgba(251, 191, 36, 0.9), rgba(255, 215, 0, 0.8), transparent)',
          }}
          animate={{
            backgroundPosition: ['-100% 0', '200% 0'],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Subtle shine effect */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 50%)',
        }}
        animate={isSelected ? {
          opacity: [0.3, 0.6, 0.3],
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.button>
  );
}

