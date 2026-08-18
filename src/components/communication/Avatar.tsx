'use client';

// Suggested path: components/communication/Avatar.tsx
//
// Deterministic colored-initials avatar — same name always gets the same
// color, no images required. Used anywhere a sender/assignee needs a face.

import React from 'react';

const PALETTE = [
  'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500',
  'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500',
  'bg-violet-500', 'bg-fuchsia-500', 'bg-pink-500',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, size = 'md', ring = true }: {
  name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; ring?: boolean;
}) {
  const safeName = name || '?';
  const color = PALETTE[hashString(safeName) % PALETTE.length];
  const sizeCls = {
    xs: 'w-6 h-6 text-[9px]',
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
  }[size];

  return (
    <div className={`${sizeCls} ${color} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm ${ring ? 'ring-2 ring-white' : ''}`}>
      {getInitials(safeName)}
    </div>
  );
}