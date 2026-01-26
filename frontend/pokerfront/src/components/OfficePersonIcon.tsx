import React from 'react';

interface OfficePersonIconProps {
  className?: string;
  size?: number;
  isReady?: boolean;
  avatarUrl?: string;
  name?: string;
}

export default function OfficePersonIcon({ 
  className = '', 
  size = 80, 
  isReady = false,
  avatarUrl,
  name = 'Player'
}: OfficePersonIconProps) {
  // Generate avatar URL if not provided - using UI Avatars as fallback
  const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=${size}&background=3B82F6&color=fff&bold=true`;
  const imageUrl = avatarUrl || defaultAvatarUrl;

  return (
    <div 
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={imageUrl}
        alt={name}
        className="rounded-full object-cover border-2"
        style={{
          width: size,
          height: size,
          borderColor: isReady ? '#2ED573' : '#3B82F6',
        }}
        onError={(e) => {
          // Fallback to default avatar if image fails to load
          const target = e.target as HTMLImageElement;
          if (target.src !== defaultAvatarUrl) {
            target.src = defaultAvatarUrl;
          }
        }}
      />
      {/* Ready indicator glow */}
      {isReady && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: '0 0 20px rgba(46, 213, 115, 0.5)',
            border: '2px solid #2ED573',
          }}
        />
      )}
    </div>
  );
}

