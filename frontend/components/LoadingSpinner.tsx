'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const SIZE_MAP = {
  sm: 24,
  md: 40,
  lg: 56,
};

export function LoadingSpinner({ size = 'md', label }: LoadingSpinnerProps) {
  const px = SIZE_MAP[size];
  const borderWidth = size === 'sm' ? 2.5 : size === 'md' ? 3 : 3.5;

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        style={{
          width: px,
          height: px,
          border: `${borderWidth}px solid rgba(59, 130, 246, 0.15)`,
          borderTopColor: 'var(--accent-primary, #3b82f6)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {label && (
        <p className="text-sm text-[var(--text-muted)] animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
}

export default LoadingSpinner;
