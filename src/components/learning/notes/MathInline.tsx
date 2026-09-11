'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useRef, useState } from 'react';

let ready = false;
let loading: Promise<void> | null = null;

function loadKatex(): Promise<void> {
  if (ready) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
    s.onload = () => { ready = true; resolve(); };
    document.head.appendChild(s);
  });
  return loading;
}

function View({ node, updateAttributes, selected }: any) {
  const [ok, setOk] = useState(ready);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.attrs.latex || '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!ok) loadKatex().then(() => setOk(true)); }, [ok]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { updateAttributes({ latex: draft }); setEditing(false); };

  if (!ok) return <NodeViewWrapper as="span" className="text-xs text-slate-400">…</NodeViewWrapper>;

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="inline-block">
        <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(node.attrs.latex); setEditing(false); }
          }}
          className="px-2 py-0.5 text-sm border border-violet-400 rounded outline-none font-mono" />
      </NodeViewWrapper>
    );
  }

  const html = (window as any).katex?.renderToString(node.attrs.latex || '', { throwOnError: false })
    || node.attrs.latex;

  return (
    <NodeViewWrapper as="span"
      className={`katex-inline inline-block px-1 rounded cursor-pointer ${selected ? 'bg-violet-100' : 'hover:bg-slate-100'}`}
      data-latex={node.attrs.latex}
      onClick={() => setEditing(true)}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() { return { latex: { default: '' } }; },
  parseHTML() {
    return [{ tag: 'span[data-latex]', getAttrs: el => ({ latex: (el as HTMLElement).getAttribute('data-latex') || '' }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-latex': HTMLAttributes.latex, class: 'katex-inline' })];
  },
  addNodeView() { return ReactNodeViewRenderer(View); },
});