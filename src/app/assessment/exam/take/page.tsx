'use client';
export const dynamic = 'force-dynamic';

import React, {
  useState, useEffect, useRef, useCallback, useLayoutEffect, memo, Suspense
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, schoolInfoAPI } from '@/lib/api';
import {
  Clock, AlertCircle, CheckCircle2, Send, Camera, CameraOff,
  AlertTriangle, Loader2, BookOpen, ChevronLeft, ChevronRight,
  X, List, PenLine, FileText, Shield, Info, Users,
  Bold, Italic, Underline as UnderlineIcon, Table2, Sigma,
  BarChart2, Maximize, Plus, Trash2,
} from 'lucide-react';
import * as faceapi from 'face-api.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  id: number;
  exam_question_id: number;
  order: number;
  // Backend currently marks: objective | theory | subjective.
  // Any other value is shown with the written-answer editor (never hidden).
  question_type: string;
  question_number: string;
  sub_question_number: string | null;
  question_text: string;
  diagram: string | null;
  max_mark: number;
  options?: Record<string, string>;
}

interface Answer {
  exam_question_id: number;
  answer_text?: string;
  selected_option?: string;
}

interface InvigilatorWarning {
  id: number;
  message: string;
  sent_by: string;
  sent_at: string;
  is_termination?: boolean;
}

interface SchoolInfo { name: string; logo?: string | null; }

type TabType = 'objective' | 'theory' | 'subjective';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface PendingEvent {
  event_type: string;
  severity: string;
  event_data: Record<string, any>;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_API_URL || ''}${path}`;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/** An answer counts as non-empty if it has text, a graph image, or an equation. */
function hasContent(html: string): boolean {
  return stripHtml(html).length > 0 || /<img\b|data-latex=/i.test(html);
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

const answerKey = (a: Answer) => `${a.selected_option ?? ''}|${a.answer_text ?? ''}`;

/** submit_attempt() answers 400 "Cannot submit - invalid status" when already submitted. */
function isAlreadySubmitted(err: any): boolean {
  const status = err?.response?.status;
  const msg = String(err?.response?.data?.error ?? '');
  return status === 400 && /invalid status/i.test(msg);
}

function groupOf(q: Question): TabType {
  if (q.question_type === 'objective') return 'objective';
  if (q.question_type === 'subjective') return 'subjective';
  return 'theory';
}

/**
 * Client-side HTML sanitizer — defence-in-depth only.
 * The backend MUST also sanitize before persisting.
 * Preserves KaTeX spans and tables; strips scripts and event handlers.
 */
function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Equations: keep only the LaTeX source (the editor re-renders it when loaded)
    doc.querySelectorAll('span.katex-inline[data-latex]').forEach(el => {
      el.textContent = `\\(${el.getAttribute('data-latex') || ''}\\)`;
    });
    doc.querySelectorAll('script, iframe, object, embed, style, link, meta').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = (attr.value || '').trim().toLowerCase();
        if (name.startsWith('on')) el.removeAttribute(attr.name);
        if ((name === 'href' || name === 'src' || name === 'xlink:href') && value.startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

// ─── Error Modal ───────────────────────────────────────────────────────────────

function ErrorModal({ show, title, message, onClose, onRetry }: {
  show: boolean; title: string; message: string;
  onClose: () => void; onRetry?: () => void;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-11 h-11 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div><h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
            <p className="text-sm text-slate-600">{message}</p></div>
        </div>
        <div className="flex gap-3 justify-end">
          {onRetry && (
            <button onClick={onRetry}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">
              Retry
            </button>
          )}
          <button onClick={onClose}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invigilator Warning Overlay ───────────────────────────────────────────────
// Full-screen blocking modal. Student MUST acknowledge before continuing.

function InvigilatorWarningOverlay({ warning, onAcknowledge }: {
  warning: InvigilatorWarning | null;
  onAcknowledge: (id: number) => Promise<void>;
}) {
  const [acking, setAcking] = useState(false);
  if (!warning) return null;

  const handle = async () => {
    setAcking(true);
    await onAcknowledge(warning.id);
    setAcking(false);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-amber-900/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-900 mb-1">Message from Invigilator</h3>
          <p className="text-sm text-slate-500 mb-4">Sent by {warning.sent_by}</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
            <p className="text-base text-amber-900 font-medium leading-relaxed">{warning.message}</p>
          </div>
        </div>
        <button onClick={handle} disabled={acking}
          className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {acking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {warning.is_termination ? 'OK' : 'I Understand — Continue Exam'}
        </button>
      </div>
    </div>
  );
}

// ─── Math Modal ────────────────────────────────────────────────────────────────

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

function MathModal({ open, onInsert, onClose }: {
  open: boolean;
  onInsert: (latex: string) => void;
  onClose: () => void;
}) {
  const [latex, setLatex] = useState('');
  const [preview, setPreview] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setLatex(''); setPreview(''); return; }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!latex.trim()) { setPreview(''); return; }
    try {
      const katex = (window as any).katex;
      if (katex) {
        setPreview(katex.renderToString(latex, { throwOnError: false, displayMode: true }));
      } else {
        setPreview(`<code class="text-lg">${latex}</code>`);
      }
    } catch {
      setPreview('');
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
    <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 select-text">
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
              onKeyDown={e => { if (e.key === 'Enter') handleInsert(); }}
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

// ─── Graph Modal ───────────────────────────────────────────────────────────────

const GRAPH_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

function safeEval(expr: string, x: number): number | null {
  try {
    let e = expr.trim().replace(/\s/g, '');
    const eqIdx = e.indexOf('=');
    if (eqIdx !== -1) e = e.slice(eqIdx + 1);
    if (!e) return null;
    if (!/^[0-9x\+\-\*\/\^\(\)\.\,sincotalqrpbeMPIE]+$/i.test(e)) return null;

    e = e
      .replace(/\^/g,    '**')
      .replace(/\bsin\b/g,  'Math.sin')
      .replace(/\bcos\b/g,  'Math.cos')
      .replace(/\btan\b/g,  'Math.tan')
      .replace(/\bsqrt\b/g, 'Math.sqrt')
      .replace(/\babs\b/g,  'Math.abs')
      .replace(/\bcbrt\b/g, 'Math.cbrt')
      .replace(/\blog\b/g,  'Math.log10')
      .replace(/\bln\b/g,   'Math.log')
      .replace(/\bexp\b/g,  'Math.exp')
      .replace(/\bpi\b/gi,  'Math.PI')
      .replace(/\be\b/g,    'Math.E');

    // eslint-disable-next-line no-new-func
    const fn = new Function('x', `"use strict"; try { return +(${e}); } catch(e){ return NaN; }`);
    const v  = fn(x);
    return isFinite(v) ? v : null;
  } catch { return null; }
}

function drawGraph(canvas: HTMLCanvasElement, expressions: string[],
  xMin: number, xMax: number, yMin: number, yMax: number) {
  const ctx   = canvas.getContext('2d')!;
  const W     = canvas.width;
  const H     = canvas.height;
  const pad   = 40;
  const w     = W - pad * 2;
  const h     = H - pad * 2;

  const toCanvasX = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * w;
  const toCanvasY = (y: number) => pad + ((yMax - y) / (yMax - yMin)) * h;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth   = 1;
  const xStep = (xMax - xMin) / 10;
  const yStep = (yMax - yMin) / 10;

  for (let x = Math.ceil(xMin); x <= xMax; x += xStep) {
    const cx = toCanvasX(x);
    ctx.beginPath(); ctx.moveTo(cx, pad); ctx.lineTo(cx, pad + h); ctx.stroke();
  }
  for (let y = Math.ceil(yMin); y <= yMax; y += yStep) {
    const cy = toCanvasY(y);
    ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(pad + w, cy); ctx.stroke();
  }

  ctx.strokeStyle = '#64748b';
  ctx.lineWidth   = 1.5;
  if (yMin <= 0 && yMax >= 0) {
    const cy = toCanvasY(0);
    ctx.beginPath(); ctx.moveTo(pad, cy); ctx.lineTo(pad + w, cy); ctx.stroke();
  }
  if (xMin <= 0 && xMax >= 0) {
    const cx = toCanvasX(0);
    ctx.beginPath(); ctx.moveTo(cx, pad); ctx.lineTo(cx, pad + h); ctx.stroke();
  }

  ctx.fillStyle  = '#64748b';
  ctx.font       = '10px system-ui, sans-serif';
  ctx.textAlign  = 'center';
  for (let x = Math.ceil(xMin); x <= xMax; x += xStep) {
    if (Math.abs(x) < 0.0001) continue;
    ctx.fillText(String(Math.round(x * 10) / 10), toCanvasX(x), pad + h + 14);
  }
  ctx.textAlign = 'right';
  for (let y = Math.ceil(yMin); y <= yMax; y += yStep) {
    if (Math.abs(y) < 0.0001) continue;
    ctx.fillText(String(Math.round(y * 10) / 10), pad - 5, toCanvasY(y) + 4);
  }

  const steps = w * 2;
  expressions.forEach((expr, i) => {
    if (!expr.trim()) return;
    ctx.strokeStyle = GRAPH_COLORS[i % GRAPH_COLORS.length];
    ctx.lineWidth   = 2;
    ctx.beginPath();
    let started = false;
    for (let px = 0; px <= steps; px++) {
      const x  = xMin + (px / steps) * (xMax - xMin);
      const y  = safeEval(expr, x);
      if (y === null || y < yMin - (yMax - yMin) || y > yMax + (yMax - yMin)) {
        started = false; continue;
      }
      const cx = toCanvasX(x);
      const cy = toCanvasY(y);
      if (!started) { ctx.moveTo(cx, cy); started = true; }
      else          { ctx.lineTo(cx, cy); }
    }
    ctx.stroke();
  });

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth   = 1;
  ctx.strokeRect(pad, pad, w, h);
}

function GraphModal({ open, onInsert, onClose }: {
  open: boolean;
  onInsert: (imgDataUrl: string) => void;
  onClose: () => void;
}) {
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const [exprs, setExprs]           = useState(['y = x*x']);
  const [xMin, setXMin]             = useState(-10);
  const [xMax, setXMax]             = useState(10);
  const [yMin, setYMin]             = useState(-10);
  const [yMax, setYMax]             = useState(10);
  const [autoY, setAutoY]           = useState(true);
  const [graphError, setGraphError] = useState('');

  const redraw = useCallback(() => {
    if (!canvasRef.current) return;
    setGraphError('');
    try {
      if (autoY) {
        const ys: number[] = [];
        for (let px = 0; px <= 400; px++) {
          const x = xMin + (px / 400) * (xMax - xMin);
          exprs.forEach(e => {
            const v = safeEval(e, x);
            if (v !== null) ys.push(v);
          });
        }
        if (ys.length > 0) {
          const mn = Math.min(...ys), mx = Math.max(...ys);
          const margin = (mx - mn) * 0.15 || 1;
          drawGraph(canvasRef.current, exprs, xMin, xMax, mn - margin, mx + margin);
        } else {
          drawGraph(canvasRef.current, exprs, xMin, xMax, yMin, yMax);
        }
      } else {
        drawGraph(canvasRef.current, exprs, xMin, xMax, yMin, yMax);
      }
    } catch (e: any) {
      setGraphError(e.message || 'Invalid expression');
    }
  }, [exprs, xMin, xMax, yMin, yMax, autoY]);

  useEffect(() => { if (open) redraw(); }, [open, redraw]);
  if (!open) return null;

  const handleInsert = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    onInsert(url);
  };

  const addExpr    = () => setExprs(p => [...p, '']);
  const removeExpr = (i: number) => setExprs(p => p.filter((_, j) => j !== i));
  const updateExpr = (i: number, v: string) => {
    setExprs(p => { const n = [...p]; n[i] = v; return n; });
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 select-text">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-blue-600" />
            <h3 className="font-bold text-slate-900">Graph / Plot</h3>
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">No internet needed</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          <canvas ref={canvasRef} width={580} height={340}
            className="w-full rounded-xl border border-slate-200 bg-white" />

          {graphError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />{graphError}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expressions</p>
            {exprs.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: GRAPH_COLORS[i % GRAPH_COLORS.length] }} />
                <input
                  type="text" value={e}
                  onChange={ev => updateExpr(i, ev.target.value)}
                  onBlur={redraw}
                  onKeyDown={ev => { if (ev.key === 'Enter') redraw(); }}
                  placeholder="e.g. y = x^2 - 1, y = sin(x), y = 2*x + 3"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {exprs.length > 1 && (
                  <button onClick={() => { removeExpr(i); setTimeout(redraw, 50); }}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              {exprs.length < 6 && (
                <button onClick={addExpr}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add expression
                </button>
              )}
              <button onClick={redraw}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 hover:bg-slate-100 rounded-lg transition-colors">
                Redraw
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">View Range</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { label: 'x min', val: xMin, set: setXMin },
                { label: 'x max', val: xMax, set: setXMax },
                ...(!autoY ? [
                  { label: 'y min', val: yMin, set: setYMin },
                  { label: 'y max', val: yMax, set: setYMax },
                ] : []),
              ] as { label: string; val: number; set: (n: number) => void }[]).map(({ label, val, set }) => (
                <div key={label}>
                  <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                  <input type="number" value={val}
                    onChange={e => set(parseFloat(e.target.value) || 0)}
                    onBlur={redraw}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input type="checkbox" checked={autoY} onChange={e => { setAutoY(e.target.checked); setTimeout(redraw, 50); }}
                className="rounded text-blue-600" />
              Auto y range
            </label>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleInsert}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
            <BarChart2 className="h-4 w-4" /> Insert Graph
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table Toolbar Hook ───────────────────────────────────────────────────────

function useTableToolbar(editorRef: React.RefObject<HTMLDivElement | null>) {
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [inTable, setInTable]       = useState(false);

  const checkSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) { setInTable(false); return; }
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    while (node && node !== editorRef.current) {
      if ((node as Element).tagName === 'TABLE') {
        const rect       = (node as HTMLElement).getBoundingClientRect();
        const editorRect = editorRef.current!.getBoundingClientRect();
        setToolbarPos({
          top:  rect.top  - editorRect.top  - 36,
          left: rect.left - editorRect.left,
        });
        setInTable(true);
        return;
      }
      node = node.parentNode;
    }
    setInTable(false);
  }, [editorRef]);

  useEffect(() => {
    document.addEventListener('selectionchange', checkSelection);
    return () => document.removeEventListener('selectionchange', checkSelection);
  }, [checkSelection]);

  const getTableAndCell = (): { table: HTMLTableElement; cell: HTMLTableCellElement } | null => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
    while (node) {
      if ((node as Element).tagName === 'TD' || (node as Element).tagName === 'TH') {
        const cell  = node as HTMLTableCellElement;
        const table = cell.closest('table') as HTMLTableElement;
        return table ? { table, cell } : null;
      }
      node = node.parentNode;
    }
    return null;
  };

  const addRow = useCallback(() => {
    const t = getTableAndCell(); if (!t) return;
    const { table, cell } = t;
    const row = cell.closest('tr') as HTMLTableRowElement;
    if (!row) return;
    const newRow  = table.insertRow(row.rowIndex + 1);
    const numCols = table.rows[0]?.cells.length || 3;
    for (let i = 0; i < numCols; i++) {
      const td = newRow.insertCell();
      td.style.cssText = 'border:1px solid #cbd5e1;padding:6px 10px;min-width:60px';
      td.innerHTML = '&nbsp;';
    }
  }, []);

  const addCol = useCallback(() => {
    const t = getTableAndCell(); if (!t) return;
    const { table, cell } = t;
    const colIdx = cell.cellIndex + 1;
    Array.from(table.rows).forEach(row => {
      const td = row.insertCell(colIdx);
      td.style.cssText = 'border:1px solid #cbd5e1;padding:6px 10px;min-width:60px';
      td.innerHTML = '&nbsp;';
    });
  }, []);

  const deleteRow = useCallback(() => {
    const t = getTableAndCell(); if (!t) return;
    const { table, cell } = t;
    const row = cell.closest('tr') as HTMLTableRowElement;
    if (table.rows.length <= 1) { table.remove(); return; }
    row?.remove();
  }, []);

  const deleteCol = useCallback(() => {
    const t = getTableAndCell(); if (!t) return;
    const { table, cell } = t;
    const colIdx = cell.cellIndex;
    if (table.rows[0]?.cells.length <= 1) { table.remove(); return; }
    Array.from(table.rows).forEach(row => {
      if (row.cells[colIdx]) row.deleteCell(colIdx);
    });
  }, []);

  return { inTable, toolbarPos, addRow, addCol, deleteRow, deleteCol };
}

/** Re-render saved equations (<span data-latex>) with KaTeX. Returns false if KaTeX isn't loaded yet. */
function renderKatexSpans(root: HTMLElement): boolean {
  const spans = root.querySelectorAll('span.katex-inline[data-latex]');
  if (spans.length === 0) return true;
  const katex = (window as any).katex;
  if (!katex) return false;
  spans.forEach(el => {
    if (el.querySelector('.katex')) return; // already rendered
    try {
      el.innerHTML = katex.renderToString(el.getAttribute('data-latex') || '', { throwOnError: false });
      el.setAttribute('contenteditable', 'false');
      (el as HTMLElement).style.cssText = 'display:inline-block;vertical-align:middle;margin:0 2px';
    } catch { /* leave the raw \\(...\\) text */ }
  });
  return true;
}

// ─── Theory Editor ─────────────────────────────────────────────────────────────
// Uncontrolled contenteditable. Tagged with `data-theory-editor` so the parent can
// read the live content at save time. Flushes pending edits on unmount (including
// clearing an answer) so nothing is lost when navigating between questions fast.

interface TheoryEditorProps {
  examQuestionId: number;
  initialValue: string;
  onChange: (html: string) => void;
  onSaveRange: () => void;
  onOpenMath: () => void;
  onOpenGraph: () => void;
}

const TheoryEditor = memo(function TheoryEditor({
  examQuestionId, initialValue, onChange, onSaveRange, onOpenMath, onOpenGraph,
}: TheoryEditorProps) {
  const editorRef    = useRef<HTMLDivElement>(null);
  const initialized  = useRef(false);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastHtmlRef  = useRef<string>(initialValue || '');
  const dirtyRef     = useRef(false);
  const onChangeRef  = useRef(onChange);
  const { inTable, toolbarPos, addRow, addCol, deleteRow, deleteCol } = useTableToolbar(editorRef);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Init innerHTML once
  useLayoutEffect(() => {
    if (editorRef.current && !initialized.current) {
      editorRef.current.innerHTML = initialValue || '';
      initialized.current = true;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render equations restored from a saved answer (waits for KaTeX to load)
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (!el.isConnected) return;
      if (!renderKatexSpans(el) && tries++ < 20) timer = setTimeout(run, 500);
    };
    run();
    return () => clearTimeout(timer);
  }, []);

  const handleInput = useCallback(() => {
    const html = editorRef.current?.innerHTML || '';
    lastHtmlRef.current = html;
    dirtyRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      dirtyRef.current = false;
      onChangeRef.current(html);
    }, 350);
  }, []);

  // Flush a pending debounce on unmount (also covers a cleared answer)
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      if (dirtyRef.current) {
        onChangeRef.current(lastHtmlRef.current);
      }
    };
  }, []);

  const execCmd = useCallback((cmd: string, value?: string) => {
    if (!editorRef.current) return;
    if (document.activeElement !== editorRef.current) {
      editorRef.current.focus({ preventScroll: true });
    }
    requestAnimationFrame(() => {
      document.execCommand(cmd, false, value ?? undefined);
      handleInput();
    });
  }, [handleInput]);

  const insertTable = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      const html = `
        <table style="border-collapse:collapse;width:100%;margin:8px 0">
          <tbody>
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;min-width:80px">&nbsp;</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;min-width:80px">&nbsp;</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px;min-width:80px">&nbsp;</td>
            </tr>
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px 10px">&nbsp;</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px">&nbsp;</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px">&nbsp;</td>
            </tr>
            <tr>
              <td style="border:1px solid #cbd5e1;padding:6px 10px">&nbsp;</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px">&nbsp;</td>
              <td style="border:1px solid #cbd5e1;padding:6px 10px">&nbsp;</td>
            </tr>
          </tbody>
        </table><p><br></p>`;
      document.execCommand('insertHTML', false, html);
      handleInput();
    });
  }, [handleInput]);

  const tbBtn = 'p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition-all';

  return (
    <div className="space-y-2 select-text">
      <div className="flex items-center gap-0.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex-wrap">
        <button type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('bold'); }}
          className={tbBtn} title="Bold (Ctrl+B)"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('italic'); }}
          className={tbBtn} title="Italic (Ctrl+I)"><Italic className="h-3.5 w-3.5" /></button>
        <button type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('underline'); }}
          className={tbBtn} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></button>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        <button type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList'); }}
          className={`${tbBtn} flex items-center gap-0.5`} title="Bullet list">
          <span className="text-sm">•</span>
          <span className="text-xs">List</span>
        </button>
        <button type="button"
          onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList'); }}
          className={`${tbBtn} flex items-center gap-0.5`} title="Numbered list">
          <span className="text-xs font-bold">1.</span>
          <span className="text-xs">List</span>
        </button>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        <button type="button"
          onMouseDown={e => { e.preventDefault(); insertTable(); }}
          className={`${tbBtn} flex items-center gap-1`} title="Insert table">
          <Table2 className="h-3.5 w-3.5" />
          <span className="text-xs">Table</span>
        </button>

        <div className="w-px h-4 bg-slate-300 mx-1" />

        <button type="button"
          onMouseDown={e => { e.preventDefault(); onSaveRange(); onOpenMath(); }}
          className="p-1.5 hover:bg-white rounded-md transition-all flex items-center gap-1 text-violet-700 hover:text-violet-900"
          title="Insert math equation">
          <Sigma className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">Equation</span>
        </button>
        <button type="button"
          onMouseDown={e => { e.preventDefault(); onSaveRange(); onOpenGraph(); }}
          className="p-1.5 hover:bg-white rounded-md transition-all flex items-center gap-1 text-blue-700 hover:text-blue-900"
          title="Insert graph">
          <BarChart2 className="h-3.5 w-3.5" />
          <span className="text-xs font-bold">Graph</span>
        </button>
      </div>

      <div className="relative">
        {inTable && toolbarPos && (
          <div
            className="absolute z-20 flex items-center gap-1 bg-slate-800 text-white rounded-lg px-2 py-1 shadow-xl border border-slate-700"
            style={{ top: `${toolbarPos.top}px`, left: `${toolbarPos.left}px` }}
            onMouseDown={e => e.preventDefault()}
          >
            <button onClick={addRow}
              className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-slate-700 rounded-md transition-colors" title="Add row below">
              <Plus className="h-3 w-3 text-emerald-400" /> Row
            </button>
            <button onClick={addCol}
              className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-slate-700 rounded-md transition-colors" title="Add column right">
              <Plus className="h-3 w-3 text-blue-400" /> Col
            </button>
            <div className="w-px h-3 bg-slate-600" />
            <button onClick={deleteRow}
              className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-red-900 rounded-md transition-colors" title="Delete row">
              <Trash2 className="h-3 w-3 text-red-400" /> Row
            </button>
            <button onClick={deleteCol}
              className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-red-900 rounded-md transition-colors" title="Delete column">
              <Trash2 className="h-3 w-3 text-red-400" /> Col
            </button>
          </div>
        )}

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          data-theory-editor={examQuestionId}
          onInput={handleInput}
          onKeyDown={e => {
            if (e.key === 'Tab') { e.preventDefault(); document.execCommand('indent', false); }
          }}
          className="w-full min-h-[280px] px-5 py-4 border-2 border-slate-100 rounded-2xl text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all bg-white overflow-y-auto cursor-text leading-relaxed select-text"
          style={{ fontFamily: 'inherit' }}
        />
      </div>

      <p className="text-[10px] text-slate-400 flex items-center gap-1.5 justify-end">
        <Info className="h-3 w-3" />
        Bold · Italic · Underline · Bullet &amp; numbered lists · Tables · Equations · Graphs
      </p>
    </div>
  );
});

// ─── Webcam Monitor ────────────────────────────────────────────────────────────

function WebcamMonitor({ videoRef, canvasRef, cameraEnabled, cameraError, detectedFaces }: {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cameraEnabled: boolean;
  cameraError: string | null;
  detectedFaces: number | null;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[60] w-44 h-32 bg-slate-900 rounded-2xl border-2 border-white shadow-2xl overflow-hidden">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg border border-white/10">
        <div className={`w-1.5 h-1.5 rounded-full ${cameraEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
        <span className="text-[9px] font-bold text-white uppercase tracking-wider">
          {cameraEnabled ? 'Live' : cameraError ? 'Error' : 'Starting'}
        </span>
      </div>

      {cameraEnabled && detectedFaces !== null && detectedFaces === 0 && (
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <div className="bg-red-600/90 text-white px-2 py-1.5 rounded-xl text-center">
            <CameraOff className="h-4 w-4 mx-auto mb-0.5" />
            <p className="text-[8px] font-black uppercase leading-tight">Face not<br/>detected</p>
          </div>
        </div>
      )}
      {cameraEnabled && detectedFaces !== null && detectedFaces > 1 && (
        <div className="absolute inset-0 flex items-center justify-center p-2">
          <div className="bg-amber-600/90 text-white px-2 py-1.5 rounded-xl text-center">
            <Users className="h-4 w-4 mx-auto mb-0.5" />
            <p className="text-[8px] font-black uppercase leading-tight">Multiple<br/>faces!</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

function ExamTakingPageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const attemptId    = searchParams?.get('attempt');

  // ── Exam data ──
  const [examTitle, setExamTitle]             = useState('');
  const [questions, setQuestions]             = useState<Question[]>([]);
  const [answers, setAnswers]                 = useState<Record<number, Answer>>({});
  const [studentName, setStudentName]         = useState('');
  const [studentClass, setStudentClass]       = useState('');
  const [studentSection, setStudentSection]   = useState<string | null>(null);
  const [studentImageUrl, setStudentImageUrl] = useState<string | null>(null);
  const [schoolInfo, setSchoolInfo]           = useState<SchoolInfo | null>(null);

  // ── UI ──
  const [loading, setLoading]                 = useState(true);
  const [activeTab, setActiveTab]             = useState<TabType>('objective');
  const [currentQIdx, setCurrentQIdx]         = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [closing, setClosing]                 = useState<{ title: string; text: string } | null>(null);
  const [notice, setNotice]                   = useState<string | null>(null);

  const [errorModal, setErrorModal] = useState({
    show: false, title: '', message: '',
    onRetry: undefined as (() => void) | undefined,
  });

  // ── Timer (server-authoritative; counts down from a monotonic deadline) ──
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const deadlineRef       = useRef<number | null>(null);   // performance.now() based
  const timeExpiredRef    = useRef(false);
  const expiredOnLoadRef  = useRef(false);

  // ── Saving ──
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved]   = useState<Date | null>(null);
  const autoSaveRef       = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const answersRef        = useRef<Record<number, Answer>>({});
  const savedSnapshotRef  = useRef<Record<number, string>>({});   // what the server already has
  const saveChainRef      = useRef<Promise<boolean>>(Promise.resolve(true)); // serialises saves
  const submittingRef     = useRef(false);

  // ── Webcam + face detection ──
  const videoRef                          = useRef<HTMLVideoElement>(null);
  const canvasRef                         = useRef<HTMLCanvasElement>(null);
  const streamRef                         = useRef<MediaStream | null>(null);
  const cameraStartedRef                  = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError]     = useState<string | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<number | null>(null);
  const [noFaceStreak, setNoFaceStreak]   = useState(0);
  const detectedFacesRef                  = useRef<number | null>(null);
  const faceIntervalRef                   = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const snapshotIntervalRef               = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const consecutiveNoFaceRef              = useRef(0);
  const multiFaceStreakRef                = useRef(0);
  const mismatchStreakRef                 = useRef(0);
  const studentDescriptorRef              = useRef<Float32Array | null>(null);

  // ── Proctoring counts ──
  const [tabSwitchCount, setTabSwitchCount]   = useState(0);
  const [windowBlurCount, setWindowBlurCount] = useState(0);
  const [fullscreenExits, setFullscreenExits] = useState(0);

  // ── Fullscreen ──
  const [fullscreenHasExited, setFullscreenHasExited]     = useState(false);
  const [isCurrentlyFullscreen, setIsCurrentlyFullscreen] = useState(false);
  const fullscreenEnteredOnceRef                           = useRef(false);
  const showFullscreenBanner = fullscreenHasExited && !isCurrentlyFullscreen;

  // ── Invigilator warnings ──
  const [activeWarning, setActiveWarning] = useState<InvigilatorWarning | null>(null);
  const activeWarningRef                   = useRef<InvigilatorWarning | null>(null);
  const warningPollRef                     = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const noticeTimerRef                     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Proctoring event queue + throttle ──
  const eventQueueRef     = useRef<PendingEvent[]>([]);
  const flushingEventsRef = useRef(false);
  const lastEventAtRef    = useRef<Record<string, number>>({});

  // ── Math / Graph modals ──
  const [showMathModal, setShowMathModal]   = useState(false);
  const [showGraphModal, setShowGraphModal] = useState(false);
  const savedRangeRef                        = useRef<Range | null>(null);

  // ── Derived ──
  const tabQs: Record<TabType, Question[]> = {
    objective:  questions.filter(q => groupOf(q) === 'objective'),
    theory:     questions.filter(q => groupOf(q) === 'theory'),
    subjective: questions.filter(q => groupOf(q) === 'subjective'),
  };
  const availableTabs = (['objective', 'theory', 'subjective'] as TabType[])
    .filter(t => tabQs[t].length > 0);
  const currentTabQs = tabQs[activeTab] ?? [];
  const currentQ     = currentTabQs[currentQIdx] ?? null;

  const answeredCount = Object.keys(answers).length;
  const progress      = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    clearInterval(autoSaveRef.current);
    clearInterval(faceIntervalRef.current);
    clearInterval(snapshotIntervalRef.current);
    clearInterval(warningPollRef.current);
    clearTimeout(noticeTimerRef.current);
  }, []);

  // ── Timer helpers ──
  const setServerRemaining = useCallback((secs: number) => {
    const s = Math.max(0, secs);
    deadlineRef.current = performance.now() + s * 1000;
    setRemainingSeconds(Math.ceil(s));
  }, []);

  // ── Answers: state mirror of answersRef + live editor content ──
  const getMergedAnswers = useCallback((): Record<number, Answer> => {
    const merged: Record<number, Answer> = {};
    Object.entries(answersRef.current).forEach(([k, a]) => {
      merged[Number(k)] = a.answer_text !== undefined
        ? { ...a, answer_text: sanitizeHtml(a.answer_text) }
        : a;
    });
    document.querySelectorAll('[data-theory-editor]').forEach((el: any) => {
      const qid = parseInt(el.dataset.theoryEditor, 10);
      if (isNaN(qid)) return;
      const html = el.innerHTML || '';
      if (!hasContent(html)) delete merged[qid];
      else merged[qid] = { exam_question_id: qid, answer_text: sanitizeHtml(html) };
    });
    return merged;
  }, []);

  const handleAnswerChange = useCallback((examQuestionId: number, value: string, isOption = false) => {
    const next = { ...answersRef.current };
    const isEmpty = isOption ? !value : !hasContent(value);
    if (isEmpty) {
      delete next[examQuestionId];
    } else {
      next[examQuestionId] = {
        exam_question_id: examQuestionId,
        ...(isOption ? { selected_option: value } : { answer_text: value }),
      };
    }
    answersRef.current = next;
    setAnswers(next);
  }, []);

  // Local backup of every change (cheap and synchronous), independent of the network
  useEffect(() => {
    if (loading || !attemptId) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(`exam_${attemptId}_answers`, JSON.stringify(answersRef.current)); }
      catch { /* storage full / unavailable */ }
    }, 400);
    return () => clearTimeout(t);
  }, [answers, loading, attemptId]);

  // ── Leave the exam page ──
  const finishAndLeave = useCallback((auto: boolean, error = false) => {
    if (!error) {
      try {
        localStorage.removeItem(`exam_${attemptId}_answers`);
        localStorage.removeItem(`exam_${attemptId}_questions`);
      } catch { /* ignore */ }
    }
    cleanup();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const qs = `attempt=${attemptId}${auto ? '&auto=true' : ''}${error ? '&error=true' : ''}`;
    router.push(`/assessment/exam/submitted?${qs}`);
  }, [attemptId, cleanup, router]);

  // ── Load exam data ──
  const loadExamData = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    try {
      const res  = await api.get(`/api/assessment/exam-attempts/${attemptId}/questions/`);
      const data = res.data;

      // Already submitted / closed: nothing to take — go to the result page
      if (['submitted', 'auto_submitted', 'abandoned'].includes(data.attempt_status)) {
        finishAndLeave(data.attempt_status === 'auto_submitted');
        return;
      }

      setExamTitle(data.exam_title || 'Exam');
      setStudentName(data.student_name || '');
      setStudentClass(data.student_class || '');
      setStudentSection(data.student_section || null);
      setStudentImageUrl(data.student_image_url || null);
      setQuestions(data.questions || []);

      // Timer — server value already includes invigilator extensions.
      // 0 on load means the attempt is expired OR already closed; we find out on submit.
      const rem = typeof data.remaining_seconds === 'number'
        ? data.remaining_seconds
        : (data.duration_minutes || 60) * 60;
      if (rem <= 0) expiredOnLoadRef.current = true;
      setServerRemaining(rem);

      // Restore answers: server copy (if the API sends it) then this device's local copy on top
      const restored: Record<number, Answer> = {};
      const snapshot: Record<number, string> = {};
      if (Array.isArray(data.saved_answers)) {
        data.saved_answers.forEach((a: any) => {
          const qid = Number(a.exam_question_id);
          if (isNaN(qid) || !(a.selected_option || a.answer_text)) return;
          const ans: Answer = {
            exam_question_id: qid,
            ...(a.selected_option ? { selected_option: a.selected_option } : {}),
            ...(a.answer_text ? { answer_text: a.answer_text } : {}),
          };
          restored[qid] = ans;
          snapshot[qid] = answerKey(ans);
        });
      }
      try {
        const saved = localStorage.getItem(`exam_${attemptId}_answers`);
        if (saved) Object.assign(restored, JSON.parse(saved));
      } catch { /* ignore */ }
      savedSnapshotRef.current = snapshot;
      answersRef.current = restored;
      setAnswers(restored);

      try { localStorage.setItem(`exam_${attemptId}_questions`, JSON.stringify(data.questions || [])); }
      catch { /* ignore */ }
    } catch (err: any) {
      setErrorModal({
        show: true,
        title: 'Failed to Load Exam',
        message: err?.response?.data?.error || err?.message || 'Could not load questions.',
        onRetry: () => { setErrorModal(p => ({ ...p, show: false })); loadExamData(); },
      });
    } finally {
      setLoading(false);
    }
  }, [attemptId, setServerRemaining, finishAndLeave]);

  // ── Fullscreen request ──
  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  }, []);

  // ── Proctoring ──
  const loadStudentDescriptor = useCallback(async (imgUrl: string) => {
    try {
      const img = new Image(); img.crossOrigin = 'anonymous';
      await new Promise<void>(res => {
        img.onload = () => res();
        img.onerror = () => res();
        img.src = imgUrl;
      });
      if (!img.naturalWidth) return;
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks().withFaceDescriptor();
      if (detection) studentDescriptorRef.current = detection.descriptor;
    } catch { /* silently skip */ }
  }, []);

  const logEvent = useCallback(async (eventType: string, severity: string, eventData: any) => {
    const payload: PendingEvent = { event_type: eventType, severity, event_data: eventData };
    try {
      await api.post(`/api/assessment/exam-attempts/${attemptId}/log-event/`, payload);
    } catch {
      eventQueueRef.current.push(payload);
      if (eventQueueRef.current.length > 100) eventQueueRef.current.shift();
    }
  }, [attemptId]);

  /** Same event type is logged at most once per cooldown — keeps the DB and invigilator alerts sane. */
  const logEventThrottled = useCallback((type: string, severity: string, data: any, cooldownMs: number) => {
    const now = Date.now();
    if (now - (lastEventAtRef.current[type] || 0) < cooldownMs) return;
    lastEventAtRef.current[type] = now;
    logEvent(type, severity, data);
  }, [logEvent]);

  const startFaceDetection = useCallback(() => {
    clearInterval(faceIntervalRef.current);
    faceIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        ).withFaceLandmarks().withFaceDescriptors();

        const count = detections.length;
        detectedFacesRef.current = count;
        setDetectedFaces(count);

        if (count === 0) {
          multiFaceStreakRef.current = 0;
          mismatchStreakRef.current = 0;
          consecutiveNoFaceRef.current += 1;
          setNoFaceStreak(consecutiveNoFaceRef.current);
          if (consecutiveNoFaceRef.current >= 4) {
            logEventThrottled('face_not_detected', 'medium',
              { consecutive: consecutiveNoFaceRef.current }, 30000);
          }
        } else {
          consecutiveNoFaceRef.current = 0;
          setNoFaceStreak(0);

          if (count > 1) {
            multiFaceStreakRef.current += 1;
            if (multiFaceStreakRef.current >= 2) {
              logEventThrottled('multiple_faces', 'high', { face_count: count }, 20000);
            }
          } else {
            multiFaceStreakRef.current = 0;
          }

          if (count === 1 && studentDescriptorRef.current && detections[0].descriptor) {
            const distance = faceapi.euclideanDistance(
              studentDescriptorRef.current, detections[0].descriptor
            );
            if (distance > 0.6) {
              mismatchStreakRef.current += 1;
              if (mismatchStreakRef.current >= 3) {
                logEventThrottled('identity_mismatch', 'high',
                  { distance: distance.toFixed(3) }, 60000);
              }
            } else {
              mismatchStreakRef.current = 0;
            }
          }
        }
      } catch { /* silently ignore */ }
    }, 3000);
  }, [logEventThrottled]);

  const startSnapshots = useCallback(() => {
    clearInterval(snapshotIntervalRef.current);
    snapshotIntervalRef.current = setInterval(async () => {
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      try {
        const w = 480;
        const h = Math.round((video.videoHeight / video.videoWidth) * w);
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')?.drawImage(video, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
        await api.post(`/api/assessment/exam-attempts/${attemptId}/log-event/`, {
          event_type: 'webcam_snapshot',
          severity: 'low',
          event_data: {
            faces_detected: detectedFacesRef.current,
            image_data: base64,
            size_bytes: base64.length,
          },
        }).catch(() => {});
      } catch { /* ignore */ }
    }, 60000);
  }, [attemptId]);

  const loadCamera = useCallback(async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      const video = videoRef.current;
      if (!video) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      video.onloadedmetadata = () => { startFaceDetection(); startSnapshots(); };
      video.srcObject = stream;
      setCameraEnabled(true);
    } catch (err: any) {
      setCameraError(err?.message || 'Camera unavailable');
      logEvent('camera_error', 'high', { error: err?.message });
    }
  }, [logEvent, startFaceDetection, startSnapshots]);

  // ── Saving ──
  // mode 'delta': only answers the server doesn't have yet (periodic autosave)
  // mode 'all'  : every answer (final save before submit)
  // Saves are chained so a slow request can never overwrite a newer one.
  const saveNow = useCallback((mode: 'delta' | 'all'): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      const merged  = getMergedAnswers();
      const entries = Object.values(merged);
      const changed = mode === 'all'
        ? entries
        : entries.filter(a => savedSnapshotRef.current[a.exam_question_id] !== answerKey(a));
      // Answers the student cleared since the last save
      const clearedIds = Object.keys(savedSnapshotRef.current)
        .map(Number).filter(id => !merged[id]);
      const toSend: Array<Answer | { exam_question_id: number; cleared: true }> = [
        ...changed,
        ...clearedIds.map(id => ({ exam_question_id: id, cleared: true as const })),
      ];
      if (toSend.length === 0) return true;

      setSaveStatus('saving');
      try { localStorage.setItem(`exam_${attemptId}_answers`, JSON.stringify(merged)); }
      catch { /* ignore */ }
      try {
        await api.post(`/api/assessment/exam-attempts/${attemptId}/save-answers/`, { answers: toSend });
        changed.forEach(a => { savedSnapshotRef.current[a.exam_question_id] = answerKey(a); });
        clearedIds.forEach(id => { delete savedSnapshotRef.current[id]; });
        setLastSaved(new Date());
        setSaveStatus('saved');
        return true;
      } catch (err: any) {
        setSaveStatus('error');
        // 409 = attempt closed or time is over: retrying can never succeed
        if (err?.response?.status === 409) return true;
        return false;
      }
    };
    const p = saveChainRef.current.then(run, run);
    saveChainRef.current = p;
    return p;
  }, [attemptId, getMergedAnswers]);

  const autoSave = useCallback(() => {
    if (submittingRef.current) return;
    saveNow('delta');
  }, [saveNow]);

  // ── Invigilator warnings + server timer sync ──
  const showWarning = useCallback((w: InvigilatorWarning | null) => {
    activeWarningRef.current = w;
    setActiveWarning(w);
  }, []);

  const pollWarnings = useCallback(async () => {
    if (!attemptId) return;
    try {
      const res = await api.get(`/api/assessment/exam-attempts/${attemptId}/check-warnings/`);
      const warnings = (res.data?.warnings || []) as InvigilatorWarning[];

      // Invigilator ended this exam: stop all saving/timers, tell the student, then leave.
      const termination = warnings.find(w => w.is_termination);
      if (termination && !submittingRef.current) {
        submittingRef.current = true;
        setSubmitting(true);
        cleanup();
        showWarning(termination);
        return;
      }

      if (warnings.length > 0 && !activeWarningRef.current) showWarning(warnings[0]);

      // Server is authoritative for time (already includes granted extensions)
      if (typeof res.data?.remaining_seconds === 'number'
          && !timeExpiredRef.current && !submittingRef.current) {
        setServerRemaining(res.data.remaining_seconds);
      }

      const extensions = (res.data?.time_extensions || []) as Array<{ id: number; minutes: number }>;
      if (extensions.length > 0) {
        const mins = extensions.reduce((s, e) => s + (e.minutes || 0), 0);
        setNotice(`Invigilator added ${mins} extra minute${mins !== 1 ? 's' : ''}.`);
        clearTimeout(noticeTimerRef.current);
        noticeTimerRef.current = setTimeout(() => setNotice(null), 8000);
        extensions.forEach(ext => {
          api.post(`/api/assessment/exam-attempts/${attemptId}/acknowledge-warning/`, {
            warning_id: ext.id,
          }).catch(() => {});
        });
      }
    } catch { /* fail silently */ }
  }, [attemptId, cleanup, setServerRemaining, showWarning]);

  const acknowledgeWarning = useCallback(async (id: number) => {
    const wasTermination = !!activeWarningRef.current?.is_termination;
    try {
      await api.post(`/api/assessment/exam-attempts/${attemptId}/acknowledge-warning/`, { warning_id: id });
    } catch { /* ignore */ }
    showWarning(null);
    if (wasTermination) finishAndLeave(false);
  }, [attemptId, finishAndLeave, showWarning]);

  // ── Submit (manual) ──
  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setShowSubmitModal(false);
    setSubmitting(true);

    // The final save MUST succeed: submit_attempt() turns every unsaved question into a 0.
    let saved = false;
    for (let i = 0; i < 3 && !saved; i++) {
      saved = await saveNow('all');
      if (!saved) await sleep(1000 * (i + 1));
    }
    if (!saved) {
      submittingRef.current = false;
      setSubmitting(false);
      setErrorModal({
        show: true,
        title: 'Could not save your answers',
        message: 'Check your internet connection and try again. Your answers are safe on this computer and your exam is still open.',
        onRetry: () => { setErrorModal(p => ({ ...p, show: false })); handleSubmit(); },
      });
      return;
    }

    try {
      await api.post(`/api/assessment/exam-attempts/${attemptId}/submit/`, {
        auto_submit: false,
        answers: Object.values(getMergedAnswers()),
      });
      finishAndLeave(false);
    } catch (err: any) {
      if (isAlreadySubmitted(err)) { finishAndLeave(false); return; }
      submittingRef.current = false;
      setSubmitting(false);
      setErrorModal({
        show: true,
        title: 'Submission Failed',
        message: err?.response?.data?.error || err?.message || 'Failed to submit. Your answers are saved.',
        onRetry: () => { setErrorModal(p => ({ ...p, show: false })); handleSubmit(); },
      });
    }
  }, [attemptId, finishAndLeave, getMergedAnswers, saveNow]);

  // ── Submit (time up / closed attempt) ──
  const handleAutoSubmit = useCallback(async (opts?: { skipSave?: boolean }) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setClosing(opts?.skipSave
      ? { title: 'Checking your exam…', text: 'One moment please.' }
      : { title: "Time's Up!", text: 'Saving your answers and submitting…' });

    if (!opts?.skipSave) {
      // Keep trying for up to ~45 s — a lost final save means zeros.
      const startedAt = Date.now();
      while (true) {
        const ok = await saveNow('all');
        if (ok || Date.now() - startedAt > 45000) break;
        await sleep(3000);
      }
    }

    for (let i = 0; i < 5; i++) {
      try {
        await api.post(`/api/assessment/exam-attempts/${attemptId}/submit/`, {
          auto_submit: true,
          ...(opts?.skipSave ? {} : { answers: Object.values(getMergedAnswers()) }),
        });
        finishAndLeave(true);
        return;
      } catch (err: any) {
        if (isAlreadySubmitted(err)) { finishAndLeave(true); return; }
        await sleep(2000);
      }
    }
    finishAndLeave(true, true);
  }, [attemptId, finishAndLeave, getMergedAnswers, saveNow]);

  // ── Math / Graph insertion ──
  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const insertAtSavedRange = useCallback((html: string) => {
    const editor = document.querySelector('[data-theory-editor]') as HTMLElement | null;
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (savedRangeRef.current) {
      sel?.removeAllRanges();
      sel?.addRange(savedRangeRef.current);
    }
    document.execCommand('insertHTML', false, html);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }, []);

  const handleInsertMath = useCallback((latex: string) => {
    try {
      const katex = (window as any).katex;
      if (katex) {
        const rendered = katex.renderToString(latex, { throwOnError: false });
        const html = `<span class="katex-inline" data-latex="${escapeAttr(latex)}" contenteditable="false" style="display:inline-block;vertical-align:middle;margin:0 2px">${rendered}</span>&nbsp;`;
        insertAtSavedRange(html);
      } else {
        insertAtSavedRange(`<code>${latex}</code>&nbsp;`);
      }
    } catch {
      insertAtSavedRange(latex);
    }
    setShowMathModal(false);
  }, [insertAtSavedRange]);

  const handleInsertGraph = useCallback((imgDataUrl: string) => {
    const html = `<img src="${imgDataUrl}" alt="Graph" style="max-width:100%;border-radius:8px;margin:8px 0;display:block" /><p><br></p>`;
    insertAtSavedRange(html);
    setShowGraphModal(false);
  }, [insertAtSavedRange]);

  // ═══ Effects ═══════════════════════════════════════════════════════════════

  // On mount
  useEffect(() => {
    if (!attemptId) { router.push('/assessment/exam-entry'); return; }
    loadExamData();
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => {});
    requestFullscreen();
    return cleanup;
  }, [attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start the camera only once the exam UI (and its <video>) is mounted
  useEffect(() => {
    if (loading || !attemptId || cameraStartedRef.current) return;
    cameraStartedRef.current = true;
    loadCamera();
  }, [loading, attemptId, loadCamera]);

  // KaTeX: self-hosted copy first (public/vendor/katex), CDN only as a fallback
  useEffect(() => {
    if ((window as any).katex) return;
    const LOCAL = '/vendor/katex/katex.min';
    const CDN   = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min';
    const addCss = (href: string) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = href;
      document.head.appendChild(l);
    };
    const addJs = (src: string, onError?: () => void) => {
      const s = document.createElement('script');
      s.src = src;
      s.onerror = () => { s.remove(); onError?.(); };
      document.head.appendChild(s);
    };
    addCss(`${LOCAL}.css`);
    addJs(`${LOCAL}.js`, () => { addCss(`${CDN}.css`); addJs(`${CDN}.js`); });
  }, []);

  // Student face descriptor
  useEffect(() => {
    if (studentImageUrl) loadStudentDescriptor(getImageUrl(studentImageUrl) ?? studentImageUrl);
  }, [studentImageUrl, loadStudentDescriptor]);

  // Timer display — computed from the deadline, so it cannot drift
  useEffect(() => {
    if (loading || submitting) return;
    const t = setInterval(() => {
      if (deadlineRef.current === null) return;
      setRemainingSeconds(Math.max(0, Math.ceil((deadlineRef.current - performance.now()) / 1000)));
    }, 1000);
    return () => clearInterval(t);
  }, [loading, submitting]);

  // Expiry (also handles opening an attempt that is already closed)
  useEffect(() => {
    if (loading || questions.length === 0) return;
    if (deadlineRef.current === null || remainingSeconds > 0) return;
    if (timeExpiredRef.current || submittingRef.current) return;
    timeExpiredRef.current = true;
    handleAutoSubmit({ skipSave: expiredOnLoadRef.current });
  }, [remainingSeconds, loading, questions.length, handleAutoSubmit]);

  // Autosave — one stable interval
  useEffect(() => {
    if (loading) return;
    autoSaveRef.current = setInterval(autoSave, 20000);
    return () => clearInterval(autoSaveRef.current);
  }, [autoSave, loading]);

  // Poll warnings + server time every 5 s
  useEffect(() => {
    if (loading) return;
    warningPollRef.current = setInterval(pollWarnings, 5000);
    return () => clearInterval(warningPollRef.current);
  }, [pollWarnings, loading]);

  // Retry proctoring events that failed to send
  useEffect(() => {
    if (loading) return;
    const flush = async () => {
      if (flushingEventsRef.current || eventQueueRef.current.length === 0) return;
      flushingEventsRef.current = true;
      const batch = [...eventQueueRef.current];
      eventQueueRef.current = [];
      for (const ev of batch) {
        try {
          await api.post(`/api/assessment/exam-attempts/${attemptId}/log-event/`, ev);
        } catch {
          eventQueueRef.current.push(ev);
        }
      }
      flushingEventsRef.current = false;
    };
    const t = setInterval(flush, 10000);
    return () => clearInterval(t);
  }, [attemptId, loading]);

  // Persist locally when the page is hidden/closed (sync, no network needed)
  useEffect(() => {
    if (loading || !attemptId) return;
    const persist = () => {
      try {
        localStorage.setItem(`exam_${attemptId}_answers`, JSON.stringify(getMergedAnswers()));
      } catch { /* ignore */ }
    };
    window.addEventListener('pagehide', persist);
    return () => window.removeEventListener('pagehide', persist);
  }, [attemptId, loading, getMergedAnswers]);

  // Security: tab switch / blur / right-click / shortcuts / paste / fullscreen
  useEffect(() => {
    if (loading || submitting) return;

    let blurTimerId: ReturnType<typeof setTimeout> | undefined;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (blurTimerId) { clearTimeout(blurTimerId); blurTimerId = undefined; }
        setTabSwitchCount(p => { const n = p + 1; logEvent('tab_switch', 'high', { count: n }); return n; });
      }
    };

    const handleBlur = () => {
      // If the tab becomes hidden right after, it is a tab switch — don't double count
      if (blurTimerId) clearTimeout(blurTimerId);
      blurTimerId = setTimeout(() => {
        if (!document.hidden) {
          setWindowBlurCount(p => { const n = p + 1; logEvent('window_blur', 'medium', { count: n }); return n; });
        }
      }, 200);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logEventThrottled('right_click', 'low', {}, 5000);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl   = e.ctrlKey || e.metaKey;
      const target   = e.target as HTMLElement;
      const inEditor = target?.contentEditable === 'true';
      if (
        e.key === 'F12' ||
        (isCtrl && e.shiftKey && e.key === 'I') ||
        (isCtrl && !inEditor && e.key === 'u') ||
        (isCtrl && e.key === 's') ||
        (isCtrl && e.key === 'p')
      ) {
        e.preventDefault();
        logEventThrottled('shortcut_attempt', 'medium', { key: e.key }, 5000);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      logEventThrottled('paste_attempt', 'medium', {}, 5000);
    };

    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsCurrentlyFullscreen(isFull);
      if (isFull) {
        fullscreenEnteredOnceRef.current = true;
      } else if (fullscreenEnteredOnceRef.current && !submittingRef.current) {
        setFullscreenHasExited(true);
        setFullscreenExits(p => {
          const n = p + 1;
          logEvent('fullscreen_exit', 'medium', { count: n });
          return n;
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      if (blurTimerId) clearTimeout(blurTimerId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [loading, submitting, logEvent, logEventThrottled]);

  // Initial tab
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [questions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ Render ════════════════════════════════════════════════════════════════

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-500 text-sm">Loading exam…</p>
      </div>
    </div>
  );

  if (questions.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <ErrorModal
        show={errorModal.show} title={errorModal.title} message={errorModal.message}
        onClose={() => setErrorModal(p => ({ ...p, show: false }))}
        onRetry={errorModal.onRetry}
      />
      <div className="text-center max-w-sm">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Questions Available</h2>
        <p className="text-slate-500 text-sm mb-5">This exam has no questions assigned.</p>
        <button onClick={() => router.push('/assessment/exam-entry')}
          className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700">
          Back to Entry
        </button>
      </div>
    </div>
  );

  const timerColor = remainingSeconds < 300
    ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
    : remainingSeconds < 600
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';

  const tabLabel: Record<TabType, string> = { objective: 'Objective', theory: 'Theory', subjective: 'Subjective' };
  const tabIcon:  Record<TabType, React.ReactNode> = {
    objective:  <List     className="h-3.5 w-3.5" />,
    theory:     <PenLine  className="h-3.5 w-3.5" />,
    subjective: <FileText className="h-3.5 w-3.5" />,
  };

  const saveStatusText = saveStatus === 'saving'
    ? 'Saving…'
    : saveStatus === 'saved' && lastSaved
    ? `Saved ${lastSaved.toLocaleTimeString()}`
    : saveStatus === 'error'
    ? 'Save failed — will retry'
    : 'Not saved yet';

  const saveStatusColor = saveStatus === 'error'
    ? 'text-red-500'
    : saveStatus === 'idle'
    ? 'text-amber-500'
    : 'text-slate-400';

  return (
    <div className="min-h-screen bg-slate-50 select-none">

      <WebcamMonitor
        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
        canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
        cameraEnabled={cameraEnabled}
        cameraError={cameraError}
        detectedFaces={detectedFaces}
      />

      <InvigilatorWarningOverlay warning={activeWarning} onAcknowledge={acknowledgeWarning} />

      <MathModal open={showMathModal} onInsert={handleInsertMath} onClose={() => setShowMathModal(false)} />
      <GraphModal open={showGraphModal} onInsert={handleInsertGraph} onClose={() => setShowGraphModal(false)} />

      <ErrorModal
        show={errorModal.show} title={errorModal.title} message={errorModal.message}
        onClose={() => setErrorModal(p => ({ ...p, show: false }))}
        onRetry={errorModal.onRetry}
      />

      {notice && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[95] bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-lg">
          {notice}
        </div>
      )}

      {showFullscreenBanner && !submitting && (
        <div className="fixed top-0 left-0 right-0 z-[90] bg-amber-600 text-white px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
          <span className="text-sm font-semibold flex items-center gap-2">
            <Maximize className="h-4 w-4" />
            Exam requires full-screen mode
          </span>
          <button onClick={requestFullscreen}
            className="px-3 py-1 bg-white text-amber-700 text-sm font-bold rounded-lg hover:bg-amber-50 transition-colors">
            Return to Fullscreen
          </button>
        </div>
      )}

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm print:hidden">
        <div className="bg-amber-600 px-4 py-1.5 flex items-center justify-center gap-2 text-white">
          <Shield className="h-3.5 w-3.5" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">
            Monitored &middot; Tab switches recorded &middot; Paste disabled
          </span>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {schoolInfo?.logo ? (
                <img src={schoolInfo.logo} alt={schoolInfo.name}
                  className="h-9 w-9 object-contain rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
              )}
              <div className="min-w-0">
                {schoolInfo?.name && (
                  <p className="text-xs text-slate-400 truncate leading-none mb-0.5">{schoolInfo.name}</p>
                )}
                <p className="text-sm font-bold text-slate-900 truncate leading-tight">{examTitle}</p>
                <p className="text-xs text-slate-500 truncate">
                  {studentName}
                  {studentClass && <span> &middot; {studentClass}{studentSection ? ` ${studentSection}` : ''}</span>}
                </p>
              </div>
              {studentImageUrl && (
                <img src={getImageUrl(studentImageUrl) ?? ''} alt="You"
                  className="w-9 h-9 rounded-xl object-cover border-2 border-blue-200 flex-shrink-0 hidden sm:block"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {cameraEnabled ? (
                <div className="flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-emerald-500" />
                  {detectedFaces !== null && detectedFaces > 1 && (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              ) : cameraError ? (
                <span title={cameraError ?? undefined}>
                  <CameraOff className="h-4 w-4 text-amber-500" />
                </span>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              )}

              {!isCurrentlyFullscreen && (
                <button
                  onClick={requestFullscreen}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Enter fullscreen">
                  <Maximize className="h-4 w-4" />
                </button>
              )}

              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-mono font-bold ${timerColor}`}>
                <Clock className="h-3.5 w-3.5" />
                {formatTime(remainingSeconds)}
              </div>

              <div className="hidden md:flex flex-col items-end gap-1">
                <span className="text-xs text-slate-500">{answeredCount}/{questions.length}</span>
                <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <button onClick={() => setShowSubmitModal(true)} disabled={submitting}
                className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                <Send className="h-3.5 w-3.5" />
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="max-w-6xl mx-auto px-4 py-5">
        <div className="flex gap-5">
          <div className="flex-1 min-w-0">

            {/* Tab switcher */}
            {availableTabs.length > 1 && (
              <div className="flex gap-1 mb-4 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                {availableTabs.map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab); setCurrentQIdx(0); }}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}>
                    {tabIcon[tab]}{tabLabel[tab]}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {tabQs[tab].length}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Question card */}
            {currentQ ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="p-6">
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {currentQIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          currentQ.question_type === 'objective' ? 'bg-blue-100 text-blue-700'
                          : currentQ.question_type === 'theory'  ? 'bg-purple-100 text-purple-700'
                          : currentQ.question_type === 'subjective' ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-slate-100 text-slate-700'
                        }`}>{currentQ.question_type.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-400">{currentQ.max_mark} mark{currentQ.max_mark !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-base text-slate-900 leading-relaxed whitespace-pre-wrap">{currentQ.question_text}</p>
                    </div>
                  </div>

                  {currentQ.diagram && (
                    <div className="mb-5 ml-12">
                      <img src={getImageUrl(currentQ.diagram) ?? ''} alt="Diagram"
                        className="max-w-full h-auto rounded-xl border border-slate-200"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                  )}

                  {/* Objective options */}
                  {currentQ.question_type === 'objective' && currentQ.options && (
                    <div className="space-y-2.5 ml-12">
                      {Object.entries(currentQ.options).map(([key, value]) => {
                        const isSelected = answers[currentQ.exam_question_id]?.selected_option === key;
                        return (
                          <label key={key}
                            className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                              isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                            }`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                              isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <input type="radio" name={`q-${currentQ.exam_question_id}`} value={key} checked={isSelected}
                              className="sr-only"
                              onChange={e => handleAnswerChange(currentQ.exam_question_id, e.target.value, true)} />
                            <span className="text-sm text-slate-800 leading-relaxed">
                              <span className="font-bold text-slate-600 mr-1">{key}.</span>{value}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Every non-objective question gets the written-answer editor */}
                  {currentQ.question_type !== 'objective' && (
                    <div className="ml-12">
                      <TheoryEditor
                        key={currentQ.exam_question_id}
                        examQuestionId={currentQ.exam_question_id}
                        initialValue={answers[currentQ.exam_question_id]?.answer_text || ''}
                        onChange={html => handleAnswerChange(currentQ.exam_question_id, html)}
                        onSaveRange={saveRange}
                        onOpenMath={() => setShowMathModal(true)}
                        onOpenGraph={() => setShowGraphModal(true)}
                      />
                    </div>
                  )}
                </div>

                {/* Navigation footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-b-2xl">
                  <button onClick={() => setCurrentQIdx(p => Math.max(0, p - 1))}
                    disabled={currentQIdx === 0}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>

                  <div className={`text-xs ${saveStatusColor} flex items-center gap-1.5`}>
                    {saveStatus === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
                    {saveStatus === 'error' && <AlertTriangle className="h-3 w-3" />}
                    <span>{saveStatusText}</span>
                  </div>

                  <button onClick={() => setCurrentQIdx(p => Math.min(currentTabQs.length - 1, p + 1))}
                    disabled={currentQIdx === currentTabQs.length - 1}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <p className="text-slate-400">No questions in this section</p>
              </div>
            )}
          </div>

          {/* ── Navigator sidebar ── */}
          <div className="w-56 flex-shrink-0 hidden lg:block">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sticky top-20">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Navigator</h3>
              {availableTabs.map(tab => (
                <div key={tab} className="mb-4">
                  {availableTabs.length > 1 && (
                    <p className="text-xs font-semibold text-slate-400 mb-1.5 capitalize">{tabLabel[tab]}</p>
                  )}
                  <div className="grid grid-cols-5 gap-1">
                    {tabQs[tab].map((q, idx) => {
                      const isAnswered = !!answers[q.exam_question_id];
                      const isCurrent  = activeTab === tab && idx === currentQIdx;
                      return (
                        <button key={q.exam_question_id}
                          onClick={() => { setActiveTab(tab); setCurrentQIdx(idx); }}
                          className={`w-full aspect-square rounded text-xs font-bold transition-all ${
                            isCurrent    ? 'bg-blue-600 text-white shadow-sm scale-110'
                            : isAnswered ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="border-t border-slate-100 pt-3 mt-2 space-y-1.5">
                {[
                  { color: 'bg-blue-600',                              label: 'Current' },
                  { color: 'bg-emerald-100 border border-emerald-300', label: `Answered (${answeredCount})` },
                  { color: 'bg-slate-100 border border-slate-200',     label: `Unanswered (${questions.length - answeredCount})` },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${item.color} flex-shrink-0`} />
                    <span className="text-xs text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>

              {(tabSwitchCount > 0 || fullscreenExits > 0 || windowBlurCount > 0 ||
                (detectedFaces !== null && (detectedFaces > 1 || (detectedFaces === 0 && noFaceStreak >= 4)))) && (
                <div className="border-t border-red-100 pt-3 mt-3">
                  <p className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Alerts
                  </p>
                  <div className="space-y-1 text-xs text-red-600">
                    {tabSwitchCount > 0 && <p>Tab switches: {tabSwitchCount}</p>}
                    {windowBlurCount > 0 && <p>Window focus lost: {windowBlurCount}</p>}
                    {fullscreenExits > 0 && <p>Fullscreen exits: {fullscreenExits}</p>}
                    {detectedFaces !== null && detectedFaces > 1 && (
                      <p className="animate-pulse font-semibold">Multiple faces!</p>
                    )}
                    {detectedFaces === 0 && cameraEnabled && noFaceStreak >= 4 && (
                      <p>Face not detected</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Submit modal ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-3">Submit Exam?</h3>
            <p className="text-sm text-slate-600 mb-2">
              You have answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
            </p>
            {answeredCount < questions.length && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-amber-800 font-medium">
                  ⚠️ {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's are' : ' is'} unanswered.
                </p>
              </div>
            )}
            <p className="text-xs text-slate-400 mb-5">Once submitted you cannot change your answers.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowSubmitModal(false)} disabled={submitting}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
                Review Again
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {submitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</>
                  : <><Send className="h-4 w-4" />Submit Now</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Time up / closing overlay ── */}
      {closing && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">{closing.title}</h3>
            <p className="text-slate-500 mb-5 text-sm">{closing.text}</p>
            <Loader2 className="h-7 w-7 animate-spin text-blue-600 mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamTakingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    }>
      <ExamTakingPageInner />
    </Suspense>
  );
}