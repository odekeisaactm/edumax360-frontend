'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BarChart2, Plus, Trash2, X } from 'lucide-react';

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

export function GraphModal({ open, onInsert, onClose }: {
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
