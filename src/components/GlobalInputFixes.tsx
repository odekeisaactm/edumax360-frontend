// components/GlobalInputFixes.tsx
'use client';
import { useEffect } from 'react';

export default function GlobalInputFixes() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const el = document.activeElement as HTMLInputElement;
      if (el?.tagName === 'INPUT' && el.type === 'number') {
        el.blur();
      }
    };
    document.addEventListener('wheel', handleWheel, { passive: true });
    return () => document.removeEventListener('wheel', handleWheel);
  }, []);

  return null;
}