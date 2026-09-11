'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sigma, X } from 'lucide-react';

const MATH_SYMBOLS = [
  { label: 'x²',   latex: '^{2}',        tip: 'Superscript 2' },
  { label: 'xⁿ',   latex: '^{}',         tip: 'Superscript' },
  { label: '√',    latex: '\\sqrt{}',    tip: 'Square root' },
  { label: '∛',    latex: '\\sqrt[3]{}', tip: 'Cube root' },
  { label: 'a/b',  latex: '\\frac{}{}',  tip: 'Fraction' },
  { label: 'π',    latex: '\\pi',        tip: 'Pi' },
  { label: 'θ',    latex: '\\theta',     tip: 'Theta' },
  { label: 'α',    latex: '\\alpha',     tip: 'Alpha' },
  { label: 'β',    latex: '\\beta',      tip: 'Beta' },
  { label: '∞',    latex: '\\infty',     tip: 'Infinity' },
  { label: '≤',    latex: '\\leq',       tip: 'Less or equal' },
  { label: '≥',    latex: '\\geq',       tip: 'Greater or equal' },
  { label: '≠',    latex: '\\neq',       tip: 'Not equal' },
  { label: '∑',    latex: '\\sum',       tip: 'Summation' },
  { label: '∫',    latex: '\\int',       tip: 'Integral' },
  { label: 'sin',  latex: '\\sin',       tip: 'Sine' },
  { label: 'cos',  latex: '\\cos',       tip: 'Cosine' },
  { label: 'tan',  latex: '\\tan',       tip: 'Tangent' },
  { label: 'log',  latex: '\\log',       tip: 'Log' },
  { label: 'ln',   latex: '\\ln',        tip: 'Natural log' },
];

let katexLoading: Promise<void> | null = null;

function ensureKatex(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).katex) return Promise.resolve();
  if (katexLoading) return katexLoading;

  katexLoading = new Promise((resolve) => {
    if (!document.querySelector('link[data-katex]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
      link.setAttribute('data-katex', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-katex]')) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
      s.setAttribute('data-katex', '1');
      s.onload = () => resolve();
      document.head.appendChild(s);
    } else {
      const wait = setInterval(() => {
        if ((window as any).katex) { clearInterval(wait); resolve(); }
      }, 80);
    }
  });
  return katexLoading;
}

interface MathModalProps {
  open: boolean;
  onInsert: (latex: string) => void;
  onClose: () => void;
}

export default function MathModal({ open, onInsert, onClose }: MathModalProps) {
  const [latex, setLatex] = useState('');
  const [preview, setPreview] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setLatex(''); setPreview(''); return; }
    ensureKatex().then(() => setTimeout(() => inputRef.current?.focus(), 60));
  }, [open]);

  useEffect(() => {
    if (!latex.trim()) { setPreview(''); return; }
    const katex = (window as any).katex;
    if (katex) {
      try {
        setPreview(katex.renderToString(latex, { throwOnError: false, displayMode: true }));
      } catch { setPreview(''); }
    } else {
      setPreview(`<code class="text-lg">${latex}</code>`);
    }
  }, [latex]);

  if (!open) return null;

  const appendSymbol = (sym: string) => {
    setLatex(p => p + sym);
    inputRef.current?.focus();
  };

  const handleInsert = () => {
    if (!latex.trim()) return;
    onInsert(latex.trim());
    setLatex('');
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sigma className="h-5 w-5 text-violet-600" />
            <h3 className="font-bold text-slate-900">Insert Math Equation</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Symbols — click to insert</p>
            <div className="flex flex-wrap gap-1.5">
              {MATH_SYMBOLS.map(s => (
                <button key={s.latex} onClick={() => appendSymbol(s.latex)}
                  title={s.tip}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all">
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">LaTeX Expression</p>
            <input
              ref={inputRef}
              type="text"
              value={latex}
              onChange={e => setLatex(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInsert(); } }}
              placeholder="e.g. \frac{1}{2}, x^{2}+y^{2}, \sqrt{a^2+b^2}"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-xs text-slate-400 mt-1">Type LaTeX directly or click symbols above</p>
          </div>

          {preview && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Preview</p>
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 min-h-[60px] flex items-center justify-center overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleInsert} disabled={!latex.trim()}
            className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            Insert Equation
          </button>
        </div>
      </div>
    </div>
  );
}