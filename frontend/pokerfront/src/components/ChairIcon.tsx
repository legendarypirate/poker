import React from 'react';

interface ChairIconProps {
  className?: string;
  size?: number;
}

export default function ChairIcon({ className = '', size = 80 }: ChairIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Chair back */}
      <rect
        x="30"
        y="15"
        width="40"
        height="8"
        rx="4"
        fill="#1e3a5f"
        stroke="#3B82F6"
        strokeWidth="1.5"
      />
      {/* Chair seat */}
      <rect
        x="25"
        y="50"
        width="50"
        height="12"
        rx="6"
        fill="#0f2a4a"
        stroke="#3B82F6"
        strokeWidth="1.5"
      />
      {/* Chair legs */}
      <rect x="28" y="62" width="6" height="20" rx="2" fill="#1e3a5f" />
      <rect x="66" y="62" width="6" height="20" rx="2" fill="#1e3a5f" />
      {/* Chair armrests */}
      <rect x="20" y="25" width="6" height="30" rx="3" fill="#1e3a5f" stroke="#3B82F6" strokeWidth="1" />
      <rect x="74" y="25" width="6" height="30" rx="3" fill="#1e3a5f" stroke="#3B82F6" strokeWidth="1" />
      {/* Subtle glow */}
      <ellipse cx="50" cy="56" rx="30" ry="8" fill="#3B82F6" opacity="0.1" />
    </svg>
  );
}

