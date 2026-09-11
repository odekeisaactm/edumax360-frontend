'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';

interface NoteAIPanelProps {
  disabled: boolean;
  disabledReason?: string;
  onGenerate: (instruction: string) => Promise<void>;
}

export default function NoteAIPanel({
  disabled, disabledReason, onGenerate,
}: NoteAIPanelProps) {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (collapsed) return null;

  const handleGenerate = async () => {
    setError(null);
    setBusy(true);
    try {
      await onGenerate(instruction);
      setCollapsed(true);
    } catch (e: any) {
      setError(e?.message || 'Generation failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl border border-violet-100 shadow-sm p-5 space-y-4 relative">
      <button
        onClick={() => setCollapsed(true)}
        className="absolute top-3 right-3 p-1 text-violet-400 hover:text-violet-700 rounded-lg hover:bg-white/60 transition-colors"
        title="Dismiss">
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-4 w-4 text-violet-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-violet-900">Generate Draft</p>
          <p className="text-xs text-violet-700 mt-0.5">
            Fill the metadata on the right, then let AI produce a first draft you can edit.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1.5">
          Additional Instructions (optional)
        </label>
        <textarea
          value={instruction}
          onChange={e => setInstruction(e.target.value)}
          rows={2}
          placeholder="e.g. Emphasise real-world examples, keep language simple"
          className="w-full px-3.5 py-2.5 text-sm border border-violet-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none resize-none bg-white/80"
        />
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={disabled || busy}
        title={disabled ? disabledReason : undefined}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              : <><Sparkles className="h-4 w-4" /> Generate Draft</>}
      </button>

      {disabled && disabledReason && (
        <p className="text-xs text-violet-600 text-center">{disabledReason}</p>
      )}
    </div>
  );
}