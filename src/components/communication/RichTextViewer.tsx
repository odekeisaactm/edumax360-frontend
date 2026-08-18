'use client';

// Renders Tiptap-produced HTML consistently wherever it's displayed
// (edit-mode editor content and read-only detail view both use the
// `.rte-body` class below). Uses styled-jsx (built into Next.js) instead of
// the @tailwindcss/typography plugin, since that plugin isn't in
// package.json — no extra dependency needed.
//
// Suggested path: components/communication/RichTextViewer.tsx

import React from 'react';

export function RichTextStyles() {
  return (
    <style jsx global>{`
      .rte-body h2 { font-size: 1.2rem; font-weight: 700; color: #0f172a; margin-top: 1.1rem; margin-bottom: 0.5rem; line-height: 1.35; }
      .rte-body h3 { font-size: 1.05rem; font-weight: 700; color: #0f172a; margin-top: 0.9rem; margin-bottom: 0.4rem; line-height: 1.35; }
      .rte-body p { margin-bottom: 0.75rem; line-height: 1.7; }
      .rte-body p:last-child { margin-bottom: 0; }
      .rte-body ul { list-style: disc; padding-left: 1.4rem; margin-bottom: 0.75rem; }
      .rte-body ol { list-style: decimal; padding-left: 1.4rem; margin-bottom: 0.75rem; }
      .rte-body li { margin-bottom: 0.25rem; line-height: 1.6; }
      .rte-body li p { margin-bottom: 0; }
      .rte-body blockquote { border-left: 3px solid #c7d2fe; padding-left: 1rem; color: #475569; font-style: italic; margin: 0.75rem 0; }
      .rte-body strong { font-weight: 700; }
      .rte-body em { font-style: italic; }
      .rte-body u { text-decoration: underline; }
      .rte-body s { text-decoration: line-through; }
      .rte-body a { color: #4f46e5; text-decoration: underline; }
      .rte-body code { background: #f1f5f9; border-radius: 0.25rem; padding: 0.1rem 0.35rem; font-size: 0.85em; }
      .rte-body hr { border: none; border-top: 1px solid #e2e8f0; margin: 1rem 0; }
      /* Tiptap placeholder extension hook */
      .rte-body p.is-editor-empty:first-child::before {
        content: attr(data-placeholder);
        color: #94a3b8;
        float: left;
        height: 0;
        pointer-events: none;
      }
    `}</style>
  );
}

export default function RichTextViewer({ html, emptyLabel = 'No content.' }: { html?: string | null; emptyLabel?: string }) {
  const isEmpty = !html || !html.trim() || html.trim() === '<p></p>';
  if (isEmpty) {
    return <p className="text-sm text-slate-400 italic">{emptyLabel}</p>;
  }
  return (
    <>
      <RichTextStyles />
      <div className="rte-body text-sm text-slate-800" dangerouslySetInnerHTML={{ __html: html as string }} />
    </>
  );
}