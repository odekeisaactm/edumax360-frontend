/**
 * Rich question/answer text — shared helpers.
 *
 * Storage format (same as student theory answers):
 *   - plain text (older questions)            → shown as-is, line breaks kept
 *   - HTML from the rich editor               → <p>, <b>, lists, tables, <img> graphs
 *   - equations: <span class="katex-inline" data-latex="…">\(…\)</span>
 *   - inline maths in plain text / options    → \( … \)
 */
import katex from 'katex';

const RICH_TAG = /<\/?(p|br|div|b|strong|i|em|u|ul|ol|li|table|thead|tbody|tr|td|th|span|img|sub|sup|h[1-6]|code|blockquote)\b[^>]*>/i;

export function isRichHtml(text: string | null | undefined): boolean {
  return !!text && RICH_TAG.test(text);
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Older plain-text questions → editor HTML (keeps line breaks). */
export function plainToHtml(text: string): string {
  if (!text) return '';
  if (isRichHtml(text)) return text;
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

/** Readable plain text (search, previews, AI). Equations become \(latex\); graphs "[graph]". */
export function richToPlain(text: string | null | undefined): string {
  if (!text) return '';
  if (!isRichHtml(text)) return text;
  if (typeof window === 'undefined') {
    return text.replace(/<img\b[^>]*>/gi, ' [graph] ').replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
  }
  const doc = new DOMParser().parseFromString(text, 'text/html');
  doc.querySelectorAll('span.katex-inline[data-latex]').forEach(el => {
    el.textContent = `\\(${el.getAttribute('data-latex') || ''}\\)`;
  });
  doc.querySelectorAll('img').forEach(el => el.replaceWith(doc.createTextNode(' [graph] ')));
  doc.querySelectorAll('br').forEach(el => el.replaceWith(doc.createTextNode('\n')));
  doc.querySelectorAll('p, div, li, tr').forEach(el => el.append(doc.createTextNode('\n')));
  return (doc.body.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/** True when the editor content has text, an equation or a graph. */
export function hasRichContent(text: string | null | undefined): boolean {
  if (!text) return false;
  if (!isRichHtml(text)) return text.trim().length > 0;
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0 || /<img\b|data-latex=/i.test(text);
}

const SAFE_IMG = /^(data:image\/(png|jpe?g|gif|webp);base64,|https?:\/\/|\/)/i;

/**
 * Sanitise editor/stored HTML (defence in depth — the backend strips scripts too).
 * Keeps formatting, tables, equations and graph images; removes scripts,
 * event handlers and javascript: URLs. Rendered KaTeX is reduced to its
 * LaTeX source so stored HTML stays small and re-renders anywhere.
 */
export function sanitizeRichHtml(html: string): string {
  if (typeof window === 'undefined' || !html) return html || '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('span.katex-inline[data-latex]').forEach(el => {
      const latex = el.getAttribute('data-latex') || '';
      Array.from(el.attributes).forEach(a => { if (!['class', 'data-latex'].includes(a.name)) el.removeAttribute(a.name); });
      el.textContent = `\\(${latex}\\)`;
    });
    doc.querySelectorAll('script, iframe, object, embed, style, link, meta, form, input, button, textarea, select')
      .forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = (attr.value || '').trim();
        if (name.startsWith('on') || name === 'contenteditable' || name === 'srcdoc') el.removeAttribute(attr.name);
        else if ((name === 'href' || name === 'xlink:href') && /^\s*(javascript|data|vbscript):/i.test(value)) el.removeAttribute(attr.name);
        else if (name === 'src' && !(el.tagName === 'IMG' && SAFE_IMG.test(value))) el.removeAttribute(attr.name);
      });
    });
    return doc.body.innerHTML;
  } catch {
    return escapeHtml(html);
  }
}

export function renderLatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, { throwOnError: false, displayMode });
  } catch {
    return `<code>${escapeHtml(latex)}</code>`;
  }
}

/** HTML for an equation inserted by the editor. */
export function equationHtml(latex: string): string {
  return `<span class="katex-inline" data-latex="${escapeAttr(latex)}" contenteditable="false" ` +
    `style="display:inline-block;vertical-align:middle;margin:0 2px">${renderLatex(latex)}</span>&nbsp;`;
}

/** Render every equation inside an element (spans + \(…\) in text). */
export function renderMathIn(root: HTMLElement, opts: { editable?: boolean } = {}) {
  root.querySelectorAll('span.katex-inline[data-latex]').forEach(el => {
    if (el.querySelector('.katex')) return;
    el.innerHTML = renderLatex(el.getAttribute('data-latex') || '');
    if (opts.editable) el.setAttribute('contenteditable', 'false');
    (el as HTMLElement).style.cssText = 'display:inline-block;vertical-align:middle;margin:0 2px';
  });
  if (opts.editable) return;
  // Inline \( … \) written directly in text (options, older questions)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = (n as Text).parentElement;
    if (parent?.closest('.katex, .katex-inline, code')) continue;
    if (/\\\([\s\S]+?\\\)/.test(n.nodeValue || '')) targets.push(n as Text);
  }
  targets.forEach(node => {
    const frag = document.createDocumentFragment();
    const parts = (node.nodeValue || '').split(/(\\\([\s\S]+?\\\))/);
    parts.forEach(part => {
      const m = part.match(/^\\\(([\s\S]+)\\\)$/);
      if (m) {
        const span = document.createElement('span');
        span.className = 'katex-inline';
        span.style.cssText = 'display:inline-block;vertical-align:middle;margin:0 2px';
        span.innerHTML = renderLatex(m[1]);
        frag.appendChild(span);
      } else if (part) {
        frag.appendChild(document.createTextNode(part));
      }
    });
    node.replaceWith(frag);
  });
}
