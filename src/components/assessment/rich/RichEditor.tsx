'use client';

/**
 * Rich editor for question text and model answers. Same tools as the
 * student theory answer box: bold/italic/underline, sub/superscript, lists,
 * tables, equations (with a symbol palette), graphs, and a quick symbol bar.
 *
 * Uncontrolled contenteditable: `value` is read once on mount (remount with a
 * new `key` to load different content). `onChange` gets sanitised HTML.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Table2, Sigma, BarChart2, Plus, Trash2,
  Subscript as SubIcon, Superscript as SupIcon, Omega,
} from 'lucide-react';
import { MathModal } from './MathModal';
import { GraphModal } from './GraphModal';
import { equationHtml, plainToHtml, renderMathIn, sanitizeRichHtml } from './richText';

/** Symbols typed straight into the text (no equation needed). */
const QUICK_SYMBOLS = [
  '°', '±', '×', '÷', '≈', '≠', '≤', '≥', '√', 'π', 'θ', 'α', 'β', 'γ', 'Δ', 'λ', 'μ', 'Ω', 'Σ', '∞',
  '→', '⇌', '↑', '↓', '½', '¼', '¾', '²', '³', '₂', '₃', '∠', '⊥', '∥', '€', '£', '₦',
];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const CELL = 'border:1px solid #cbd5e1;padding:6px 10px;min-width:60px';

export default function RichEditor({ value, onChange, placeholder, minHeight = 140 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const onChangeRef = useRef(onChange);
  const [mathOpen, setMathOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const [empty, setEmpty] = useState(!value);
  const [inTable, setInTable] = useState(false);

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = plainToHtml(value || '');
    renderMathIn(el, { editable: true });
    setEmpty(!(el.textContent || '').trim() && !el.querySelector('img, .katex-inline, table'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const isEmpty = !(el.textContent || '').trim() && !el.querySelector('img, .katex-inline, table');
    setEmpty(isEmpty);
    onChangeRef.current(isEmpty ? '' : sanitizeRichHtml(el.innerHTML));
  }, []);

  const saveRange = () => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (sel && sel.rangeCount && el && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      rangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreRange = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const sel = window.getSelection();
    if (rangeRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(rangeRef.current);
    } else if (sel) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  };

  const insertHtml = (html: string) => {
    restoreRange();
    document.execCommand('insertHTML', false, html);
    saveRange();
    emit();
  };

  const exec = (cmd: string) => {
    restoreRange();
    document.execCommand(cmd, false);
    saveRange();
    emit();
  };

  const tableCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    let n: Node | null = sel?.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
    while (n && n !== editorRef.current) {
      if ((n as Element).tagName === 'TD' || (n as Element).tagName === 'TH') return n as HTMLTableCellElement;
      n = n.parentNode;
    }
    return null;
  };

  const tableOp = (op: 'row' | 'col' | 'delRow' | 'delCol') => {
    restoreRange();
    const cell = tableCell();
    const table = cell?.closest('table');
    if (!cell || !table) return;
    const row = cell.closest('tr') as HTMLTableRowElement;
    if (op === 'row') {
      const nr = table.insertRow(row.rowIndex + 1);
      for (let i = 0; i < (table.rows[0]?.cells.length || 1); i++) {
        const td = nr.insertCell(); td.style.cssText = CELL; td.innerHTML = '&nbsp;';
      }
    } else if (op === 'col') {
      Array.from(table.rows).forEach(r => { const td = r.insertCell(cell.cellIndex + 1); td.style.cssText = CELL; td.innerHTML = '&nbsp;'; });
    } else if (op === 'delRow') {
      if (table.rows.length <= 1) table.remove(); else row.remove();
    } else {
      if ((table.rows[0]?.cells.length || 0) <= 1) table.remove();
      else Array.from(table.rows).forEach(r => r.cells[cell.cellIndex] && r.deleteCell(cell.cellIndex));
    }
    emit();
  };

  const onSelect = () => {
    saveRange();
    setInTable(!!tableCell());
  };

  useEffect(() => {
    document.addEventListener('selectionchange', onSelect);
    return () => document.removeEventListener('selectionchange', onSelect);
  }); // re-bound each render; cheap

  const btn = 'p-1.5 hover:bg-white rounded-md text-slate-600 hover:text-slate-900 transition-all flex items-center gap-1';
  const md = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };

  return (
    <div className="rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-transparent">
      <div className="flex items-center gap-0.5 bg-slate-50 p-1.5 rounded-t-xl border-b border-slate-200 flex-wrap">
        <button type="button" onMouseDown={md(() => exec('bold'))} className={btn} title="Bold"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={md(() => exec('italic'))} className={btn} title="Italic"><Italic className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={md(() => exec('underline'))} className={btn} title="Underline"><UnderlineIcon className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={md(() => exec('superscript'))} className={btn} title="Superscript (x²)"><SupIcon className="h-3.5 w-3.5" /></button>
        <button type="button" onMouseDown={md(() => exec('subscript'))} className={btn} title="Subscript (H₂O)"><SubIcon className="h-3.5 w-3.5" /></button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <button type="button" onMouseDown={md(() => exec('insertUnorderedList'))} className={btn} title="Bullet list"><span className="text-sm leading-none">•</span><span className="text-xs">List</span></button>
        <button type="button" onMouseDown={md(() => exec('insertOrderedList'))} className={btn} title="Numbered list"><span className="text-xs font-bold">1.</span><span className="text-xs">List</span></button>
        <button type="button" title="Insert table" className={btn}
          onMouseDown={md(() => insertHtml(
            `<table style="border-collapse:collapse;margin:8px 0"><tbody>${
              Array.from({ length: 3 }, () => `<tr>${Array.from({ length: 3 }, () => `<td style="${CELL}">&nbsp;</td>`).join('')}</tr>`).join('')
            }</tbody></table><p><br></p>`))}>
          <Table2 className="h-3.5 w-3.5" /><span className="text-xs">Table</span>
        </button>
        <div className="w-px h-4 bg-slate-300 mx-1" />
        <button type="button" onMouseDown={md(() => setSymbolsOpen(o => !o))}
          className={`${btn} ${symbolsOpen ? 'bg-white text-slate-900' : ''}`} title="Symbols">
          <Omega className="h-3.5 w-3.5" /><span className="text-xs font-bold">Symbols</span>
        </button>
        <button type="button" onMouseDown={md(() => { saveRange(); setMathOpen(true); })}
          className="p-1.5 hover:bg-white rounded-md flex items-center gap-1 text-violet-700" title="Insert equation">
          <Sigma className="h-3.5 w-3.5" /><span className="text-xs font-bold">Equation</span>
        </button>
        <button type="button" onMouseDown={md(() => { saveRange(); setGraphOpen(true); })}
          className="p-1.5 hover:bg-white rounded-md flex items-center gap-1 text-blue-700" title="Insert graph">
          <BarChart2 className="h-3.5 w-3.5" /><span className="text-xs font-bold">Graph</span>
        </button>
        {inTable && (
          <div className="flex items-center gap-0.5 ml-auto bg-slate-800 text-white rounded-lg px-1 py-0.5">
            <button type="button" onMouseDown={md(() => tableOp('row'))} className="px-1.5 py-1 text-[11px] hover:bg-slate-700 rounded flex items-center gap-0.5"><Plus className="h-3 w-3 text-emerald-400" />Row</button>
            <button type="button" onMouseDown={md(() => tableOp('col'))} className="px-1.5 py-1 text-[11px] hover:bg-slate-700 rounded flex items-center gap-0.5"><Plus className="h-3 w-3 text-blue-400" />Col</button>
            <button type="button" onMouseDown={md(() => tableOp('delRow'))} className="px-1.5 py-1 text-[11px] hover:bg-red-900 rounded flex items-center gap-0.5"><Trash2 className="h-3 w-3 text-red-400" />Row</button>
            <button type="button" onMouseDown={md(() => tableOp('delCol'))} className="px-1.5 py-1 text-[11px] hover:bg-red-900 rounded flex items-center gap-0.5"><Trash2 className="h-3 w-3 text-red-400" />Col</button>
          </div>
        )}
      </div>

      {symbolsOpen && (
        <div className="flex flex-wrap gap-1 px-2 py-2 border-b border-slate-100 bg-white">
          {QUICK_SYMBOLS.map(s => (
            <button key={s} type="button" onMouseDown={md(() => insertHtml(s))}
              className="min-w-[30px] h-8 px-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-violet-50 hover:border-violet-300">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        {empty && placeholder && (
          <div className="absolute left-3.5 top-3 text-sm text-slate-400 pointer-events-none">{placeholder}</div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('indent', false); } }}
          className="rich-content px-3.5 py-3 text-sm text-slate-800 leading-relaxed outline-none overflow-x-auto"
          style={{ minHeight }}
        />
      </div>

      <MathModal open={mathOpen} onClose={() => setMathOpen(false)}
        onInsert={latex => { setMathOpen(false); insertHtml(equationHtml(latex)); }} />
      <GraphModal open={graphOpen} onClose={() => setGraphOpen(false)}
        onInsert={url => { setGraphOpen(false); insertHtml(`<img src="${url}" alt="Graph" style="max-width:100%;border-radius:8px;margin:8px 0;display:block" /><p><br></p>`); }} />
    </div>
  );
}
