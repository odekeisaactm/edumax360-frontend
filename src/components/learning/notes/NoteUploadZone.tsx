'use client';

import React, { useState } from 'react';
import { FileUp, FileText, Trash2, Loader2, AlertTriangle, Sparkles, X } from 'lucide-react';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx';
const LOSSY_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

export interface ExtractionResult {
  html: string;
  format: 'pdf' | 'docx' | 'xlsx' | null;
  warnings: string[];
  image_count: number;
  empty: boolean;
}

interface NoteUploadZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  onExtract: (file: File) => Promise<ExtractionResult>;
  onInsertExtraction: (html: string) => void;
  editorActive: boolean;
}

export default function NoteUploadZone({
  file, onFileChange, onExtract, onInsertExtraction, editorActive,
}: NoteUploadZoneProps) {
  const [extracting, setExtracting] = useState(false);
  const [preview, setPreview] = useState<ExtractionResult | null>(null);
  const [showLossyWarning, setShowLossyWarning] = useState(false);
  const [pendingLossy, setPendingLossy] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = (f: File) => {
    setError(null);
    const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
    if (!LOSSY_EXTS.includes(ext)) {
      setError('Unsupported file type. Use PDF, Word, or Excel.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('File is over 2MB. Use Lesson Materials for larger files.');
      return;
    }
    onFileChange(f);
    setPreview(null);
  };

  const doExtract = async (f: File) => {
    setExtracting(true);
    setError(null);
    try {
      const result = await onExtract(f);
      setPreview(result);
      if (result.empty) setError('No text could be extracted. Try a different file.');
    } catch (e: any) {
      setError(e?.message || 'Extraction failed.');
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractClick = () => {
    if (!file) return;
    setPendingLossy(file);
    setShowLossyWarning(true);
  };

  return (
    <>
      {showLossyWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Extract content?</h3>
                <p className="text-xs text-slate-500">Read this before continuing</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Extraction is lossy. Images, colors, columns, complex layouts,
              and some formatting will be lost. Only text and simple tables are preserved.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowLossyWarning(false); setPendingLossy(null); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => {
                setShowLossyWarning(false);
                if (pendingLossy) doExtract(pendingLossy);
                setPendingLossy(null);
              }}
                className="flex-1 px-4 py-2.5 bg-amber-600 text-white font-semibold text-sm rounded-xl hover:bg-amber-700">
                Extract Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Extracted Content Preview</h3>
                <p className="text-xs text-slate-500">
                  Format: {preview.format?.toUpperCase() || '—'} · Review before inserting
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="h-4 w-4" />
              </button>
            </div>

            {preview.warnings.length > 0 && (
              <div className="px-6 pt-4 space-y-2">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {preview.empty ? (
                <div className="text-center py-12">
                  <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">No content could be extracted.</p>
                </div>
              ) : (
                <div className="rich-content border border-slate-100 rounded-xl p-4 bg-slate-50/30"
                    dangerouslySetInnerHTML={{ __html: preview.html }} />
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setPreview(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl hover:bg-slate-50">
                Cancel
              </button>
              <button disabled={preview.empty}
                onClick={() => { onInsertExtraction(preview.html); setPreview(null); }}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-semibold text-sm rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                Insert into Editor
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        {!file ? (
          <label className="block">
            <input type="file" accept={ACCEPT} className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); e.currentTarget.value = ''; }} />
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors cursor-pointer">
              <FileUp className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">Drop a file or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">PDF, Word, or Excel · Max 2MB</p>
            </div>
          </label>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            {!editorActive && (
              <button onClick={handleExtractClick} disabled={extracting}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50">
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {extracting ? 'Extracting...' : 'Extract Content'}
              </button>
            )}
            <button onClick={() => { onFileChange(null); setPreview(null); }}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </div>
    </>
  );
}