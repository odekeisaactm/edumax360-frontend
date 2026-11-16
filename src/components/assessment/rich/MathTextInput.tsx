'use client';

/**
 * One-line input (objective options) with an equation button. Equations are
 * stored inline as \( latex \) and previewed underneath.
 */
import React, { useRef, useState } from 'react';
import { Sigma } from 'lucide-react';
import { MathModal } from './MathModal';
import RichContent from './RichContent';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

export default function MathTextInput({ value, onChange, placeholder, className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const hasMath = /\\\([\s\S]+?\\\)/.test(value || '');

  const insert = (latex: string) => {
    const v = value || '';
    const at = caretRef.current ?? v.length;
    const piece = `\\(${latex}\\)`;
    onChange(v.slice(0, at) + piece + v.slice(at));
    setOpen(false);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) { el.focus(); el.setSelectionRange(at + piece.length, at + piece.length); }
    });
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className={`${className} flex-1 min-w-0`}
        />
        <button type="button" title="Insert equation"
          onMouseDown={e => { e.preventDefault(); caretRef.current = inputRef.current?.selectionStart ?? null; setOpen(true); }}
          className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 text-violet-700 hover:bg-violet-50 flex items-center justify-center">
          <Sigma className="h-4 w-4" />
        </button>
      </div>
      {hasMath && (
        <div className="mt-1 px-2 py-1 rounded-lg bg-slate-50 text-sm text-slate-700">
          <RichContent text={value} inline />
        </div>
      )}
      <MathModal open={open} onClose={() => setOpen(false)} onInsert={insert} />
    </div>
  );
}
