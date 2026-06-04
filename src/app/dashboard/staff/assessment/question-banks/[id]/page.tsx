'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { questionBanksAPI, questionsAPI } from '@/lib/api';
import { QuestionBank, Question } from '@/lib/types';
import {
  Library,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Target,
  BookMarked,
  GraduationCap,
  FileText,
  CheckCircle2,
  Image as ImageIcon,
  Settings,
  Loader2,
  Hash,
  ChevronDown,
  ChevronUp,
  Upload,
  Download,
  File,
} from 'lucide-react';
import { QuestionBulkUploadStatus } from '@/lib/assessment.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.error) return String(d.error);
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
    if (typeof d === 'object') {
      const msgs = Object.entries(d)
        .map(([f, v]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug whitespace-pre-line">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmModal({ open, isDeleting, onConfirm, onCancel }: {
  open: boolean; isDeleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Question</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete this question? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared form styles ───────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white";
const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";

// ─── Difficulty badge ─────────────────────────────────────────────────────────
function DifficultyBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    hard: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${map[level] || map.medium}`}>
      <Target className="h-3 w-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

// ─── Question type badge ──────────────────────────────────────────────────────
function QuestionTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    objective:  'bg-blue-50 text-blue-700 border-blue-100',
    theory:     'bg-purple-50 text-purple-700 border-purple-100',
    subjective: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    true_false: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    fill_blank: 'bg-amber-50 text-amber-700 border-amber-100',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border ${map[type] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
      {type.replace('_', ' ')}
    </span>
  );
}

// ─── Question type ────────────────────────────────────────────────────────────
type QType = 'objective' | 'theory' | 'subjective' | 'true_false' | 'fill_blank';

// ─── Bulk Upload Modal ────────────────────────────────────────────────────────
function BulkUploadModal({ open, bank, onClose, onUploadComplete }: {
  open: boolean;
  bank: QuestionBank;
  onClose: () => void;
  onUploadComplete: () => void;
}) {
  const [activeTab, setActiveTab]               = useState<'download' | 'upload'>('download');
  const [questionType, setQuestionType]         = useState<QType>('objective');
  const [numberOfOptions, setNumberOfOptions]   = useState(4);
  const [optionLabelStyle, setOptionLabelStyle] = useState<'ABC' | 'abc' | '123' | 'roman'>('ABC');
  const [numberOfQuestions, setNumberOfQuestions] = useState(20);
  const [defaultMark, setDefaultMark]           = useState('1');

  const [downloading, setDownloading]     = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [uploadFile, setUploadFile]     = useState<File | null>(null);
  const [fileError, setFileError]       = useState<string | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadStatus, setUploadStatus] = useState<QuestionBulkUploadStatus | null>(null);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [errorReportLoading, setErrorReportLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling whenever the modal closes or unmounts
  useEffect(() => {
    if (!open) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [open]);

  if (!open) return null;

  const isActivelyProcessing =
    uploading ||
    uploadStatus?.status === 'pending' ||
    uploadStatus?.status === 'processing';

  const handleClose = () => {
    if (isActivelyProcessing) return;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    onClose();
  };

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await questionBanksAPI.downloadBulkTemplate(bank.id, {
        question_type:       questionType,
        number_of_options:   numberOfOptions,
        option_label_style:  optionLabelStyle,
        number_of_questions: numberOfQuestions,
        default_mark:        defaultMark,
      });
    } catch (err: any) {
      setDownloadError(extractError(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setFileError(null);
    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      setFileError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`);
      return;
    }
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setFileError('Only .xlsx and .xls files are supported.');
      return;
    }
    setUploadFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadStatus(null);

    try {
      const res = await questionBanksAPI.bulkUpload(bank.id, uploadFile);

      pollRef.current = setInterval(async () => {
        try {
          const status = await questionBanksAPI.getBulkUploadStatus(res.upload_id);
          setUploadStatus(status);

          if (status.status === 'completed' || status.status === 'failed') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
            setUploading(false);
          }
        } catch (pollErr) {
          console.error('Status poll error:', pollErr);
          // Don't stop polling on transient network error — skip this tick
        }
      }, 2000);

    } catch (err: any) {
      setUploadError(extractError(err));
      setUploading(false);
    }
  };

  const handleErrorReportDownload = async () => {
    if (!uploadStatus) return;
    setErrorReportLoading(true);
    try {
      await questionBanksAPI.downloadBulkErrorReport(uploadStatus.id);
    } catch (err: any) {
      alert('Failed to download error report: ' + extractError(err));
    } finally {
      setErrorReportLoading(false);
    }
  };

  const resetUploadTab = () => {
    setUploadStatus(null);
    setUploadFile(null);
    setUploadError(null);
    setFileError(null);
  };

  const progressPct = uploadStatus
    ? Math.round(
        ((uploadStatus.successful_count + uploadStatus.failed_count) /
          Math.max(uploadStatus.total_rows, 1)) * 100
      )
    : 0;
  const circumference = 2 * Math.PI * 40; // r=40

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Upload className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Bulk Upload Questions</h3>
              <p className="text-xs text-violet-200 mt-0.5 truncate max-w-xs">{bank.name}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isActivelyProcessing}
            title={isActivelyProcessing ? 'Upload is still processing' : 'Close'}
            className="p-1.5 rounded-lg hover:bg-white/10 text-violet-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Processing warning banner */}
        {isActivelyProcessing && (
          <div className="bg-amber-50 px-6 py-2 border-b border-amber-100 flex items-center gap-2 text-xs font-semibold text-amber-700 flex-shrink-0">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Upload is processing — please wait before closing.
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-100 flex-shrink-0">
          {(['download', 'upload'] as const).map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {i + 1}. {tab === 'download' ? 'Download Template' : 'Upload File'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Download tab ── */}
          {activeTab === 'download' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-2">
                <p className="font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> Instructions
                </p>
                <ul className="list-disc pl-5 space-y-1 text-blue-700 text-xs">
                  <li>Each upload handles <strong>one question type</strong> at a time.</li>
                  <li>Do <strong>not</strong> delete or rename the hidden <code>_meta</code> sheet.</li>
                  <li>Images/diagrams must be added after upload via the question edit form.</li>
                  <li>The <em>Correct Answer</em> column uses a dropdown matching your selected labels.</li>
                  <li>Difficulty defaults to the bank's setting but can be changed per row.</li>
                  <li>For theory questions, same Q.Number + different Sub-Question = different questions.</li>
                  <li>Keywords for theory/subjective: comma-separated in one cell.</li>
                </ul>
              </div>

              {downloadError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {downloadError}
                </div>
              )}

              {/* Question type selector */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Question Type</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'objective',  label: 'Objective'     },
                    { id: 'theory',     label: 'Theory'        },
                    { id: 'subjective', label: 'Subjective'    },
                    { id: 'true_false', label: 'True / False'  },
                    { id: 'fill_blank', label: 'Fill in Blank' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setQuestionType(t.id as QType)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        questionType === t.id
                          ? 'bg-violet-50 border-violet-300 text-violet-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Objective-specific options */}
              {questionType === 'objective' && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Number of Options</label>
                    <select
                      value={numberOfOptions}
                      onChange={e => setNumberOfOptions(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-violet-500 text-sm"
                    >
                      {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} Options</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Label Style</label>
                    <select
                      value={optionLabelStyle}
                      onChange={e => setOptionLabelStyle(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-violet-500 text-sm"
                    >
                      <option value="ABC">A, B, C, D</option>
                      <option value="abc">a, b, c, d</option>
                      <option value="123">1, 2, 3, 4</option>
                      <option value="roman">i, ii, iii, iv</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Default mark + row count */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Default Mark per Question
                  </label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={defaultMark}
                    onChange={e => setDefaultMark(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-violet-500 text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">Pre-filled in every row. Change per row in the file.</p>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Pre-filled Rows</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={numberOfQuestions}
                    onChange={e => setNumberOfQuestions(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-violet-500 text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-1">You can add more rows manually in Excel.</p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {downloading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                    : <><Download className="h-4 w-4" /> Download Template</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Upload tab ── */}
          {activeTab === 'upload' && (
            <div className="space-y-6">

              {uploadStatus ? (
                <div className="space-y-5">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex items-center gap-5">
                    {(uploadStatus.status === 'pending' || uploadStatus.status === 'processing') ? (
                      <div className="relative w-20 h-20 flex-shrink-0">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e2e8f0" strokeWidth="8" />
                          <circle
                            cx="50" cy="50" r="40"
                            fill="transparent"
                            stroke="#8b5cf6"
                            strokeWidth="8"
                            strokeDasharray={`${(progressPct / 100) * circumference} ${circumference}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-slate-700">{progressPct}%</span>
                        </div>
                      </div>
                    ) : uploadStatus.status === 'completed' ? (
                      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Check className="h-9 w-9 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertCircle className="h-9 w-9 text-red-600" />
                      </div>
                    )}

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 capitalize">
                        {uploadStatus.status === 'processing' ? 'Processing…' : `Upload ${uploadStatus.status}`}
                      </h3>
                      {uploadStatus.status === 'failed' && (
                        <p className="text-sm text-red-600 mt-1">{uploadStatus.error_message}</p>
                      )}
                      {(uploadStatus.status === 'completed' || uploadStatus.status === 'processing') && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                            {uploadStatus.successful_count} saved
                          </span>
                          {uploadStatus.failed_count > 0 && (
                            <span className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 px-2.5 py-1 rounded-lg">
                              {uploadStatus.failed_count} failed
                            </span>
                          )}
                          <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {uploadStatus.total_rows} total rows
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Failed rows table */}
                  {uploadStatus.results?.failed && uploadStatus.results.failed.length > 0 && (
                    <div className="border border-red-200 rounded-2xl overflow-hidden">
                      <div className="bg-red-50 px-4 py-3 flex items-center justify-between border-b border-red-200">
                        <h4 className="font-bold text-red-900 flex items-center gap-2 text-sm">
                          <AlertCircle className="h-4 w-4" />
                          Failed Rows ({uploadStatus.results.failed.length})
                        </h4>
                        <button
                          onClick={handleErrorReportDownload}
                          disabled={errorReportLoading}
                          className="text-xs font-bold text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {errorReportLoading
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Download className="h-3.5 w-3.5" />}
                          Download Error Report
                        </button>
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {uploadStatus.results.failed.map((f, i) => (
                          <div key={i} className="px-4 py-2.5 text-sm flex items-start gap-3">
                            <span className="font-bold text-slate-500 text-xs w-12 flex-shrink-0 pt-0.5">
                              Row {f.row}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-400 truncate">{f.data}</p>
                              <p className="text-xs text-red-600 font-semibold mt-0.5">{f.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(uploadStatus.status === 'completed' || uploadStatus.status === 'failed') && (
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={resetUploadTab}
                        className="px-5 py-2 border border-slate-200 rounded-xl font-semibold text-slate-600 text-sm hover:bg-slate-50"
                      >
                        Upload Another File
                      </button>
                      <button
                        onClick={onUploadComplete}
                        className="px-5 py-2 bg-violet-600 text-white rounded-xl font-semibold text-sm hover:bg-violet-700"
                      >
                        Done
                      </button>
                    </div>
                  )}
                </div>

              ) : (
                /* ── File picker ── */
                <div className="space-y-4">
                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {uploadError}
                    </div>
                  )}
                  {fileError && (
                    <div className="p-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl text-sm flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {fileError}
                    </div>
                  )}

                  {!uploadFile ? (
                    <label
                      htmlFor="bulk-file-upload"
                      className="cursor-pointer border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-violet-50/30 hover:border-violet-200 transition-colors"
                    >
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                        <Upload className="h-8 w-8 text-violet-400" />
                      </div>
                      <p className="font-bold text-slate-700 mb-1">Click to select an Excel file</p>
                      <p className="text-sm text-slate-400">Supports .xlsx and .xls · Max 10 MB</p>
                      <input
                        id="bulk-file-upload"
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-violet-50 border border-violet-100 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-violet-600 shadow-sm">
                          <File className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{uploadFile.name}</p>
                          <p className="text-xs text-slate-400">{(uploadFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setUploadFile(null); setFileError(null); }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleUpload}
                      disabled={!uploadFile || uploading}
                      className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 flex items-center gap-2 shadow-md disabled:opacity-50"
                    >
                      {uploading
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                        : <><Upload className="h-4 w-4" /> Start Upload</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Question Form Modal ──────────────────────────────────────────────────────
function QuestionFormModal({ open, editing, bankId, onClose, onSaved }: {
  open: boolean;
  editing: Question | null;
  bankId: number;
  onClose: () => void;
  onSaved: (q: Question, isNew: boolean) => void;
}) {
  // ── Objective display settings ──
  const [numberOfOptions, setNumberOfOptions] = useState(4);
  const [optionLabelType, setOptionLabelType] = useState<'ABC' | 'abc' | '123' | 'roman'>('ABC');

  // ── Shared fields ──
  const [questionType, setQuestionType]       = useState<QType>('objective');
  const [questionText, setQuestionText]       = useState('');
  const [diagram, setDiagram]                 = useState<File | null>(null);
  const [defaultMark, setDefaultMark]         = useState(1);
  const [maxMark, setMaxMark]                 = useState(1);
  const [difficultyLevel, setDifficultyLevel] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionNumber, setQuestionNumber]   = useState<number | null>(null);
  const [subQuestionNumber, setSubQuestionNumber] = useState('');

  // ── Objective ──
  const [options, setOptions]             = useState<Record<string, string>>({});
  const [correctAnswer, setCorrectAnswer] = useState('');

  // ── Theory / subjective / fill_blank ──
  const [modelAnswer, setModelAnswer] = useState('');
  const [keywords, setKeywords]       = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Option labels (memoised) ──
  const optionLabels = useMemo<string[]>(() => {
    const bases: Record<string, string[]> = {
      ABC:   Array.from({ length: 6 }, (_, i) => String.fromCharCode(65 + i)),
      abc:   Array.from({ length: 6 }, (_, i) => String.fromCharCode(97 + i)),
      '123': Array.from({ length: 6 }, (_, i) => String(i + 1)),
      roman: ['i', 'ii', 'iii', 'iv', 'v', 'vi'],
    };
    return (bases[optionLabelType] || bases.ABC).slice(0, numberOfOptions);
  }, [numberOfOptions, optionLabelType]);

  // ── Re-key options when label set changes ──
  useEffect(() => {
    if (questionType !== 'objective') return;
    const oldValues = Object.values(options);
    const newOpts: Record<string, string> = {};
    optionLabels.forEach((l, i) => { newOpts[l] = oldValues[i] ?? ''; });
    setOptions(newOpts);
    if (correctAnswer && !optionLabels.includes(correctAnswer)) setCorrectAnswer('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionLabels, questionType]);

  // ── Sync maxMark with defaultMark when switching type ──
  useEffect(() => {
    if (!editing) setMaxMark(defaultMark);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionType]);

  // ── Populate when editing ──
  useEffect(() => {
    if (!open) return;

    if (editing) {
      const type = editing.question_type as QType;
      setQuestionType(type);
      setQuestionText(editing.question_text);
      const mark = parseFloat(String(editing.max_mark));
      setMaxMark(mark);
      setDefaultMark(mark);
      setDifficultyLevel(editing.difficulty_level as any);
      setQuestionNumber(editing.question_number || null);
      setSubQuestionNumber(editing.sub_question_number || '');
      setDiagram(null);

      if (type === 'objective') {
        const existingOpts = editing.options || {};
        setOptions(existingOpts as Record<string, string>);
        setCorrectAnswer(editing.correct_answer || '');
        const count = Object.keys(existingOpts).length;
        if (count >= 2) setNumberOfOptions(count);
      } else if (type === 'true_false') {
        setCorrectAnswer(editing.correct_answer || '');
      } else {
        setModelAnswer(editing.model_answer || '');
        setKeywords(editing.keywords || []);
      }
    } else {
      setQuestionType('objective');
      setQuestionText('');
      setDiagram(null);
      setDefaultMark(1);
      setMaxMark(1);
      setDifficultyLevel('medium');
      setQuestionNumber(null);
      setSubQuestionNumber('');
      setOptions({});
      setCorrectAnswer('');
      setModelAnswer('');
      setKeywords([]);
      setKeywordInput('');
      setNumberOfOptions(4);
      setOptionLabelType('ABC');
    }
    setError(null);
  }, [open, editing]);

  if (!open) return null;

  const isObjective    = questionType === 'objective';
  const isTrueFalse    = questionType === 'true_false';
  const isWritten      = !isObjective && !isTrueFalse;
  const showSubQuestion = questionType !== 'objective';

  const handleSubmit = async () => {
    if (!questionText.trim()) { setError('Question text is required.'); return; }
    if (isObjective && !correctAnswer) { setError('Please select the correct answer.'); return; }
    if (isTrueFalse && !correctAnswer) { setError('Please select True or False.'); return; }
    if (isObjective && Object.values(options).filter(v => v.trim()).length < 2) {
      setError('Please fill in at least 2 options.'); return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('question_bank',    bankId.toString());
      fd.append('question_type',    questionType);
      fd.append('question_text',    questionText.trim());
      fd.append('max_mark',         maxMark.toString());
      fd.append('difficulty_level', difficultyLevel);
      if (questionNumber) fd.append('question_number', questionNumber.toString());
      if (showSubQuestion && subQuestionNumber.trim())
        fd.append('sub_question_number', subQuestionNumber.trim());
      if (diagram) fd.append('diagram', diagram);

      if (isObjective) {
        const cleanOpts = Object.fromEntries(
          Object.entries(options).filter(([, v]) => v.trim())
        );
        fd.append('options',        JSON.stringify(cleanOpts));
        fd.append('correct_answer', correctAnswer);
      } else if (isTrueFalse) {
        fd.append('correct_answer', correctAnswer);
      } else {
        fd.append('model_answer', modelAnswer);
        if (keywords.length > 0) fd.append('keywords', JSON.stringify(keywords));
      }

      const result = editing
        ? await questionsAPI.update(editing.id, fd)
        : await questionsAPI.create(fd);

      onSaved(result, !editing);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
      setKeywordInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{editing ? 'Edit Question' : 'Add Question'}</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {editing ? 'Update question details' : 'Add a new question to this bank'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Objective settings bar */}
        {isObjective && (
          <div className="flex items-center gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0 flex-wrap">
            <Settings className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Options</span>
            <select
              value={numberOfOptions}
              onChange={e => setNumberOfOptions(parseInt(e.target.value))}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} options</option>)}
            </select>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Labels</span>
            <select
              value={optionLabelType}
              onChange={e => setOptionLabelType(e.target.value as any)}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="ABC">A, B, C…</option>
              <option value="abc">a, b, c…</option>
              <option value="123">1, 2, 3…</option>
              <option value="roman">i, ii, iii…</option>
            </select>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide ml-auto">
              Mark per question
            </span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={defaultMark}
              onChange={e => {
                const v = parseFloat(e.target.value) || 1;
                setDefaultMark(v);
                setMaxMark(v);
              }}
              className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}

          {/* Question Type */}
          <div>
            <label className={labelCls}>Question Type <span className="text-red-500">*</span></label>
            <select
              value={questionType}
              onChange={e => {
                setQuestionType(e.target.value as QType);
                setCorrectAnswer('');
                setError(null);
              }}
              className={inputCls}
            >
              <option value="objective">Objective (Multiple Choice)</option>
              <option value="theory">Theory (Essay)</option>
              <option value="subjective">Subjective (Short Answer)</option>
              <option value="true_false">True / False</option>
              <option value="fill_blank">Fill in the Blank</option>
            </select>
          </div>

          {/* Numbering + Marks row */}
          <div className={`grid gap-4 ${showSubQuestion ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'}`}>
            <div>
              <label className={labelCls}>Q. Number</label>
              <input
                type="number"
                min="1"
                value={questionNumber ?? ''}
                placeholder="e.g. 1"
                onChange={e => setQuestionNumber(e.target.value ? parseInt(e.target.value) : null)}
                className={inputCls}
              />
            </div>
            {showSubQuestion && (
              <div>
                <label className={labelCls}>Sub-Question</label>
                <input
                  type="text"
                  value={subQuestionNumber}
                  placeholder="e.g. a, i"
                  onChange={e => setSubQuestionNumber(e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Max Mark <span className="text-red-500">*</span></label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={maxMark}
                onChange={e => setMaxMark(parseFloat(e.target.value) || 0.5)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Difficulty</label>
              <select
                value={difficultyLevel}
                onChange={e => setDifficultyLevel(e.target.value as any)}
                className={inputCls}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className={labelCls}>Question Text <span className="text-red-500">*</span></label>
            <textarea
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              rows={4}
              placeholder="Enter the question…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Diagram */}
          <div>
            <label className={labelCls}>
              Diagram / Image <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={e => setDiagram(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
              {diagram && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 whitespace-nowrap">
                  <ImageIcon className="h-3.5 w-3.5" /> {diagram.name}
                </span>
              )}
            </div>
            {editing?.diagram_url && !diagram && (
              <div className="mt-2">
                <img
                  src={editing.diagram_url}
                  alt="Current diagram"
                  className="max-h-28 rounded-xl border border-slate-200 object-contain"
                />
                <p className="text-xs text-slate-400 mt-1">Current image — upload a new one to replace it.</p>
              </div>
            )}
          </div>

          {/* ── Objective options ── */}
          {isObjective && (
            <div className="space-y-2">
              <label className={labelCls}>Options <span className="text-red-500">*</span></label>
              {optionLabels.map(label => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-600 text-sm flex-shrink-0">
                    {label}
                  </div>
                  <input
                    type="text"
                    value={options[label] || ''}
                    placeholder={`Option ${label}`}
                    onChange={e => setOptions(prev => ({ ...prev, [label]: e.target.value }))}
                    className={`${inputCls} flex-1`}
                  />
                  <label title="Mark as correct answer" className="flex-shrink-0 cursor-pointer">
                    <input
                      type="radio"
                      name="correct_answer"
                      value={label}
                      checked={correctAnswer === label}
                      onChange={e => setCorrectAnswer(e.target.value)}
                      className="w-4 h-4 text-violet-600 focus:ring-violet-500"
                    />
                  </label>
                </div>
              ))}
              <p className="text-xs text-slate-400 pt-0.5">Click the radio button on the right to mark the correct answer.</p>
            </div>
          )}

          {/* ── True / False ── */}
          {isTrueFalse && (
            <div>
              <label className={labelCls}>Correct Answer <span className="text-red-500">*</span></label>
              <div className="flex gap-3">
                {['True', 'False'].map(val => (
                  <label
                    key={val}
                    className={`flex-1 flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl border-2 cursor-pointer transition-all ${
                      correctAnswer === val
                        ? val === 'True'
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-red-500 bg-red-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="true_false"
                      value={val}
                      checked={correctAnswer === val}
                      onChange={e => setCorrectAnswer(e.target.value)}
                      className="sr-only"
                    />
                    <span className={`font-semibold text-sm ${
                      correctAnswer === val
                        ? val === 'True' ? 'text-emerald-700' : 'text-red-700'
                        : 'text-slate-600'
                    }`}>{val}</span>
                    {correctAnswer === val && (
                      <CheckCircle2 className={`h-4 w-4 ${val === 'True' ? 'text-emerald-600' : 'text-red-600'}`} />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Theory / Subjective / Fill blank ── */}
          {isWritten && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>
                  Model Answer <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={modelAnswer}
                  onChange={e => setModelAnswer(e.target.value)}
                  rows={6}
                  placeholder="Expected answer or marking scheme…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div>
                <label className={labelCls}>
                  Keywords for AI Marking <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                    placeholder="Type a keyword and press Enter"
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={addKeyword}
                    className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-100 rounded-full text-xs font-semibold"
                      >
                        {kw}
                        <button
                          type="button"
                          onClick={() => setKeywords(prev => prev.filter(k => k !== kw))}
                          className="hover:text-violet-900 ml-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-violet-200"
          >
            {isSubmitting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {editing ? 'Updating…' : 'Adding…'}</>
              : <><Check className="h-4 w-4" /> {editing ? 'Update Question' : 'Add Question'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────
function QuestionCard({ question, index, canEdit, canDelete, onEdit, onDelete }: {
  question: Question; index: number;
  canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isObjective = question.question_type === 'objective';
  const isTrueFalse = question.question_type === 'true_false';
  const isWritten   = !isObjective && !isTrueFalse;

  return (
    <div className="border-b border-slate-50 last:border-0">
      {/* Row */}
      <div className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
        {/* Number badge */}
        <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-xs font-bold text-violet-600">
            {question.question_number ? `${question.question_number}${question.sub_question_number || ''}` : index + 1}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <QuestionTypeBadge type={question.question_type} />
            <DifficultyBadge level={question.difficulty_level} />
            <span className="text-xs text-slate-400">
              {question.max_mark} mark{parseFloat(question.max_mark.toString()) !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-sm text-slate-800 leading-relaxed line-clamp-2">{question.question_text}</p>

          {isTrueFalse && (
            <p className="text-xs mt-1.5">
              <span className="text-slate-400">Answer: </span>
              <span className={`font-semibold ${question.correct_answer === 'True' ? 'text-emerald-600' : 'text-red-500'}`}>
                {question.correct_answer}
              </span>
            </p>
          )}
          {isObjective && question.correct_answer && (
            <p className="text-xs mt-1.5">
              <span className="text-slate-400">Correct: </span>
              <span className="font-semibold text-emerald-600">{question.correct_answer}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {canEdit && (
            <button onClick={onEdit} title="Edit"
              className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button onClick={onDelete} title="Delete"
              className="p-2 rounded-lg text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg text-slate-400 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="ml-16 mr-5 mb-4 space-y-3">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed">
            {question.question_text}
          </div>

          {isObjective && question.options && (
            <div className="space-y-1.5">
              {Object.entries(question.options).map(([key, val]) => (
                <div key={key} className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                  question.correct_answer === key
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-white border-slate-100'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    question.correct_answer === key ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>{key}</div>
                  <span className="text-sm text-slate-700 flex-1">{val}</span>
                  {question.correct_answer === key && <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                </div>
              ))}
            </div>
          )}

          {isWritten && question.model_answer && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-700 mb-1">Model Answer</p>
              <p className="text-sm text-blue-800">{question.model_answer}</p>
            </div>
          )}

          {question.keywords && question.keywords.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-slate-400 font-medium">Keywords:</span>
              {question.keywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-100 rounded-full text-xs font-semibold">{kw}</span>
              ))}
            </div>
          )}

          {question.diagram_url && (
            <img src={question.diagram_url} alt="Question diagram"
              className="max-h-48 rounded-xl border border-slate-200 object-contain" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuestionBankDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const { hasPermission, user } = useAuth();
  const bankId  = parseInt(params.id as string);

  const [bank, setBank]           = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats]         = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [showForm, setShowForm]             = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingQuestion, setEditingQuestion]   = useState<Question | null>(null);
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState<Question | null>(null);
  const [isDeleting, setIsDeleting]             = useState(false);

  const [toasts, setToasts]       = useState<ToastItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');

  const canView   = user?.is_superuser || hasPermission('assessment_center.view_questionmodel');
  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_questionmodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_questionmodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_questionmodel');

  // ── Sort helper ──
  const sortQuestions = (qs: Question[]): Question[] =>
    [...qs].sort((a, b) => {
      const an = a.question_number ?? Infinity;
      const bn = b.question_number ?? Infinity;
      if (an !== bn) return an - bn;
      return (a.sub_question_number || '').localeCompare(b.sub_question_number || '');
    });

  // ── Toasts ──
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts(p => p.filter(t => t.id !== id));

  // ── Fetch ──
  useEffect(() => {
    if (canView && bankId) fetchBankDetails();
  }, [canView, bankId]);

  const fetchBankDetails = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await questionBanksAPI.getDetailWithQuestions(bankId);
      setBank(data.bank);
      setQuestions(sortQuestions(data.questions));
      setStats(data.stats);
    } catch (err: any) {
      setFetchError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ──
  const handleSaved = (q: Question, isNew: boolean) => {
    if (isNew) {
      setQuestions(prev => sortQuestions([...prev, q]));
      showToast('success', 'Question added successfully!');
    } else {
      setQuestions(prev => sortQuestions(prev.map(x => x.id === q.id ? q : x)));
      showToast('success', 'Question updated successfully!');
    }
    setActiveTab(q.question_type);
    setShowForm(false);
    setEditingQuestion(null);
    questionBanksAPI.getDetailWithQuestions(bankId)
      .then(d => setStats(d.stats))
      .catch(() => {});
  };

  const handleDelete = async () => {
    if (!deletingQuestion) return;
    setIsDeleting(true);
    try {
      await questionsAPI.delete(deletingQuestion.id);
      setQuestions(prev => prev.filter(q => q.id !== deletingQuestion.id));
      showToast('success', 'Question deleted.');
      setShowDeleteModal(false);
      setDeletingQuestion(null);
      questionBanksAPI.getDetailWithQuestions(bankId)
        .then(d => setStats(d.stats))
        .catch(() => {});
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Guard: no permission ──
  if (!canView) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">You don't have permission to view this question bank.</p>
        </div>
      </div>
    );
  }

  // ── Guard: loading ──
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading question bank…</span>
      </div>
    );
  }

  // ── Guard: fetch error ──
  if (fetchError && !bank) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to Load</h2>
          <p className="text-slate-500 mb-4">{fetchError}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={showDeleteModal}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteModal(false); setDeletingQuestion(null); }}
      />

      {bank && (
        <BulkUploadModal
          open={showBulkUpload}
          bank={bank}
          onClose={() => setShowBulkUpload(false)}
          onUploadComplete={() => {
            fetchBankDetails();
            setShowBulkUpload(false);
          }}
        />
      )}

      <QuestionFormModal
        open={showForm}
        editing={editingQuestion}
        bankId={bankId}
        onClose={() => { setShowForm(false); setEditingQuestion(null); }}
        onSaved={handleSaved}
      />

      {/* ── Page Header ── */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors mt-0.5 flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200 flex-shrink-0">
              <Library className="h-5 w-5 text-white" />
            </div>
            <span className="truncate">{bank?.name}</span>
          </h1>
          {bank?.description && (
            <p className="text-sm text-slate-400 mt-1 pl-12">{bank.description}</p>
          )}
        </div>
        {canCreate && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowBulkUpload(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all shadow-sm"
            >
              <Upload className="h-4 w-4" />
              Bulk Upload
            </button>
            <button
              onClick={() => { setEditingQuestion(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200 hover:shadow-lg hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              Add Question
            </button>
          </div>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Subject',         value: bank?.subject_name || '—',       icon: BookMarked,  color: 'blue'   },
          { label: 'Class',           value: bank?.class_name || '—',         icon: GraduationCap, color: 'purple' },
          { label: 'Total Questions', value: stats?.total_questions ?? questions.length, icon: Hash, color: 'violet' },
          {
            label: 'Difficulty',
            value: bank?.difficulty_level
              ? bank.difficulty_level.charAt(0).toUpperCase() + bank.difficulty_level.slice(1)
              : 'Medium',
            icon: Target,
            color: 'amber',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-${color}-50`}>
              <Icon className={`h-4 w-4 text-${color}-600`} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-sm font-bold text-slate-900 leading-tight truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Questions — Tabbed by type ── */}
      {(() => {
        const TYPE_ORDER: QType[] = ['objective', 'theory', 'subjective', 'true_false', 'fill_blank'];
        const TYPE_LABELS: Record<QType, string> = {
          objective:  'Objective',
          theory:     'Theory',
          subjective: 'Subjective',
          true_false: 'True / False',
          fill_blank: 'Fill in Blank',
        };

        const presentTypes = TYPE_ORDER.filter(t => questions.some(q => q.question_type === t));
        const tabs = [
          { key: 'all', label: 'All', count: questions.length },
          ...presentTypes.map(t => ({
            key: t,
            label: TYPE_LABELS[t],
            count: questions.filter(q => q.question_type === t).length,
          })),
        ];

        const safeTab = tabs.find(t => t.key === activeTab) ? activeTab : 'all';
        const visibleQuestions = safeTab === 'all'
          ? questions
          : questions.filter(q => q.question_type === safeTab);

        return (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-0.5 px-4 pt-3 pb-0 border-b border-slate-100 overflow-x-auto">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap border-b-2 transition-colors -mb-px
                    ${safeTab === tab.key
                      ? 'border-violet-600 text-violet-700 bg-violet-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold leading-none
                    ${safeTab === tab.key ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
              {questions.length > 0 && canCreate && (
                <div className="ml-auto flex-shrink-0 pb-2 pl-2">
                  <button onClick={() => { setEditingQuestion(null); setShowForm(true); }}
                    className="inline-flex items-center gap-1.5 text-sm text-violet-600 font-semibold hover:text-violet-700">
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </button>
                </div>
              )}
            </div>

            {/* Question rows */}
            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <FileText className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No questions yet</p>
                <p className="text-xs text-slate-400">Start building this bank by adding questions</p>
                {canCreate && (
                  <button onClick={() => { setEditingQuestion(null); setShowForm(true); }}
                    className="mt-1 text-sm text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add first question
                  </button>
                )}
              </div>
            ) : (
              <div>
                {visibleQuestions.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={i}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={() => { setEditingQuestion(q); setShowForm(true); }}
                    onDelete={() => { setDeletingQuestion(q); setShowDeleteModal(true); }}
                  />
                ))}
              </div>
            )}

            {questions.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                <p className="text-xs text-slate-400">
                  Showing <span className="font-semibold text-slate-600">{visibleQuestions.length}</span> of{' '}
                  <span className="font-semibold text-slate-600">{questions.length}</span> question{questions.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}