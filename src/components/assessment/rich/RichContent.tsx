'use client';

/**
 * Displays question text / model answers / options that may contain rich
 * formatting, equations and graphs. Older plain-text content renders exactly
 * as before (line breaks kept).
 */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { isRichHtml, plainToHtml, renderMathIn, sanitizeRichHtml } from './richText';

interface Props {
  text: string | null | undefined;
  className?: string;
  /** Inline content (e.g. an option label row) — uses a <span>. */
  inline?: boolean;
  /** Plain one-line preview for lists (no images/tables). */
  preview?: boolean;
}

export default function RichContent({ text, className = '', inline = false, preview = false }: Props) {
  const ref = useRef<HTMLDivElement & HTMLSpanElement>(null);

  const html = useMemo(() => {
    const raw = text || '';
    if (!raw) return '';
    let out = isRichHtml(raw) ? sanitizeRichHtml(raw) : plainToHtml(raw);
    if (preview) {
      out = out.replace(/<img\b[^>]*>/gi, ' <em>[graph]</em> ').replace(/<table[\s\S]*?<\/table>/gi, ' <em>[table]</em> ');
    }
    return out;
  }, [text, preview]);

  useLayoutEffect(() => {
    if (ref.current) renderMathIn(ref.current);
  }, [html]);

  const cls = `rich-content ${className}`;
  if (inline) return <span ref={ref} className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
  return <div ref={ref} className={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}
