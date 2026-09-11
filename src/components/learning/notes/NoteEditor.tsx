'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Heading1, Heading2,
  Heading3, Quote, Undo, Redo, Sparkles, Loader2,
  ChevronDown, X, Sigma,
} from 'lucide-react';
import { getApiUrl, getAuthHeaders } from '@/lib/getApiUrl';
import { MathInline } from './MathInline';
import MathModal from './MathModal';

interface NoteEditorProps {
  content: string;
  onChange: (html: string) => void;
  isAIEnabled: boolean;
  subjectId?: string;
  classConfigIds?: number[];
}

function ToolbarBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean;
  title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}

export default function NoteEditor({
  content, onChange, isAIEnabled, subjectId, classConfigIds = [],
}: NoteEditorProps) {
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [mathOpen, setMathOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing your lesson note here...' }),
      MathInline,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content: content || '',
    editorProps: {
      attributes: {
        class: 'rich-content max-w-none focus:outline-none min-h-[360px] px-6 py-5 text-slate-800',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content && content !== current) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  const callSSE = useCallback(async (
    endpoint: string,
    body: Record<string, unknown>,
    onChunk: (text: string) => void,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${getApiUrl()}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setAiError(data?.message || 'AI request failed.');
        return false;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (payload.text) onChunk(payload.text);
            if (payload.error) { setAiError(payload.error); return false; }
          } catch { /* ignore */ }
        }
      }
      return true;
    } catch (e: any) {
      setAiError(e?.message || 'AI request failed.');
      return false;
    }
  }, []);

  const runFullRewrite = useCallback(async (instruction: string) => {
    if (!editor) return;
    setAiError(null);
    setAiBusy(true);
    setAiMenuOpen(false);
    const fullHtml = editor.getHTML();
    if (!fullHtml || fullHtml.replace(/<[^>]*>/g, '').trim().length === 0) {
      setAiError('Write some content before asking AI to rewrite it.');
      setAiBusy(false);
      return;
    }
    let buffer = '';
    const ok = await callSSE('/api/learning/notes/ai-rewrite-note/', {
      content: fullHtml,
      instruction,
      subject_id: subjectId ? Number(subjectId) : undefined,
      class_config_ids: classConfigIds,
    }, (chunk) => {
      buffer += chunk;
      editor.commands.setContent(buffer, false);
    });
    if (ok && buffer.trim().length > 0) {
      editor.commands.setContent(buffer, false);
    } else if (ok) {
      setAiError('AI returned no content. Your note is unchanged.');
    }
    setAiBusy(false);
  }, [editor, callSSE, subjectId, classConfigIds]);

  const runSelectionRewrite = useCallback(async (instruction: string) => {
    if (!editor) return;
    setAiError(null);
    setSelectionBusy(true);
    const { from, to } = editor.state.selection;
    if (from === to) { setSelectionBusy(false); return; }
    const selectionText = editor.state.doc.textBetween(from, to, ' ');
    const beforeText = editor.state.doc.textBetween(Math.max(0, from - 500), from, ' ');
    const afterText = editor.state.doc.textBetween(to, Math.min(editor.state.doc.content.size, to + 500), ' ');

    let buffer = '';
    const ok = await callSSE('/api/learning/notes/ai-rewrite-selection/', {
      selection: selectionText,
      context_before: beforeText,
      context_after: afterText,
      instruction,
      subject_id: subjectId ? Number(subjectId) : undefined,
      class_config_ids: classConfigIds,
    }, (chunk) => { buffer += chunk; });

    if (ok && buffer.trim()) {
      editor.chain().focus().deleteRange({ from, to }).insertContent(buffer).run();
    } else if (ok) {
      setAiError('AI returned no content. Selection unchanged.');
    }
    setSelectionBusy(false);
  }, [editor, callSSE, subjectId, classConfigIds]);

  const handleInsertMath = useCallback((latex: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex } }).run();
    setMathOpen(false);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm relative">
      <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between rounded-t-2xl">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Note Content</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {editor.getText().trim().split(/\s+/).filter(Boolean).length} words
          </span>
          {isAIEnabled && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAiMenuOpen(v => !v)}
                disabled={aiBusy}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50">
                {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI
                <ChevronDown className="h-3 w-3" />
              </button>
              {aiMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                  {[
                    { label: 'Rewrite', instruction: 'Rewrite for clarity and flow while keeping the meaning.' },
                    { label: 'Expand', instruction: 'Expand with more detail and examples.' },
                    { label: 'Simplify', instruction: 'Simplify for the target class.' },
                    { label: 'Shorten', instruction: 'Shorten while keeping key ideas.' },
                    { label: 'Fix Grammar', instruction: 'Fix grammar and spelling only.' },
                  ].map(({ label, instruction }) => (
                    <button key={label} type="button"
                      onClick={() => runFullRewrite(instruction)}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky toolbar — top-16 matches your app's fixed header height.
          If your shell header is a different height, adjust top-16 → top-[XXpx]. */}
      <div className="sticky top-16 z-20 flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-none">
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
          <Undo className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
          <Redo className="h-4 w-4" />
        </ToolbarBtn>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })} title="H1"><Heading1 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })} title="H2"><Heading2 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })} title="H3"><Heading3 className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')} title="Bold"><Bold className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')} title="Italic"><Italic className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')} title="Underline"><UnderlineIcon className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')} title="Bullet list"><List className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')} title="Quote"><Quote className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })} title="Left"><AlignLeft className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })} title="Center"><AlignCenter className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })} title="Right"><AlignRight className="h-4 w-4" /></ToolbarBtn>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <ToolbarBtn
          onClick={() => setMathOpen(true)}
          title="Insert equation">
          <Sigma className="h-4 w-4" />
        </ToolbarBtn>
      </div>

      {aiError && (
        <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
          <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 flex-1">{aiError}</p>
          <button onClick={() => setAiError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isAIEnabled && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ state }) => {
            const { from, to } = state.selection;
            return from !== to && !selectionBusy;
          }}
          options={{ placement: 'top' }}
        >
          <div className="flex items-center gap-1 bg-slate-900 text-white rounded-xl px-2 py-1 shadow-xl">
            {[
              { label: 'Rewrite', instruction: 'Rewrite this fragment clearly.' },
              { label: 'Expand', instruction: 'Expand this fragment with more detail.' },
              { label: 'Shorten', instruction: 'Shorten this fragment.' },
              { label: 'Fix', instruction: 'Fix grammar and spelling.' },
            ].map(({ label, instruction }) => (
              <button key={label} type="button"
                onClick={() => runSelectionRewrite(instruction)}
                disabled={selectionBusy}
                className="text-xs font-medium px-2 py-1 rounded hover:bg-slate-700 transition-colors disabled:opacity-50">
                {selectionBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
              </button>
            ))}
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />

      <MathModal
        open={mathOpen}
        onInsert={handleInsertMath}
        onClose={() => setMathOpen(false)}
      />
    </div>
  );
}