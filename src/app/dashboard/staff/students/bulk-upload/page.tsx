'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { bulkUploadAPI, studentSettingsAPI, academicAPI } from '@/lib/api';
import {
  Upload, Download, FileSpreadsheet, Users, GraduationCap,
  Check, X, AlertCircle, AlertTriangle, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Info, FileText, Trash2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type UploadMode = 'student' | 'parent';
type TabMode    = 'upload' | 'download';

interface UploadStatus {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  successful_count: number;
  failed_count: number;
  error_message?: string;
  results?: {
    successful_ids: number[];
    failed: { row: number; data: string; reason: string }[];
  };
  started_at?: string;
  completed_at?: string;
}

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  defaultOn: boolean;
  description?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d?.message) return String(d.message);
  if (d?.detail)  return String(d.detail);
  return err?.message || 'An unexpected error occurred.';
}

function fmt(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Field Checkbox ────────────────────────────────────────────────────────────
function FieldCheckbox({ field, checked, onChange }: {
  field: FieldDef; checked: boolean; onChange: () => void;
}) {
  return (
    <label className={`flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
      field.required
        ? 'border-blue-200 bg-blue-50/50 cursor-not-allowed'
        : checked
          ? 'border-blue-400 bg-blue-50'
          : 'border-slate-100 bg-white hover:border-slate-200'
    }`}>
      <div onClick={field.required ? undefined : onChange}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
          checked || field.required ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
        }`}>
        {(checked || field.required) && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-700 leading-tight">
          {field.label}
          {field.required && <span className="ml-1 text-[10px] text-blue-600 font-normal">(required)</span>}
        </p>
        {field.description && (
          <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{field.description}</p>
        )}
      </div>
    </label>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r   = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#3b82f6" strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={dash}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.4s ease' }} />
    </svg>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ onFile, disabled }: { onFile: (f: File) => void; disabled?: boolean }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    if (!f.name.match(/\.(xlsx|xls)$/i)) return;
    onFile(f);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
        disabled ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
        : drag    ? 'border-blue-400 bg-blue-50'
        :           'border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
      }`}>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={e => handle(e.target.files)} disabled={disabled} />
      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-4">
        <FileSpreadsheet className="h-7 w-7 text-blue-500" />
      </div>
      <p className="text-sm font-bold text-slate-700 mb-1">Drop your Excel file here</p>
      <p className="text-xs text-slate-400">or click to browse · .xlsx or .xls · max 10 MB</p>
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────
function ResultsPanel({ status, onReset, onDownloadErrors }: {
  status: UploadStatus; onReset: () => void; onDownloadErrors: () => void;
}) {
  const [showErrors, setShowErrors] = useState(false);
  const failed = status.results?.failed || [];
  const pct = status.total_rows > 0
    ? Math.round(((status.successful_count + status.failed_count) / status.total_rows) * 100)
    : 0;

  if (status.status === 'pending' || status.status === 'processing') {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <ProgressRing pct={pct} size={80} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">{pct}%</span>
          </div>
        </div>
        <p className="text-sm font-bold text-slate-800 mb-1">
          {status.status === 'pending' ? 'Queued for processing…' : 'Processing…'}
        </p>
        <p className="text-xs text-slate-400">
          {status.successful_count + status.failed_count} / {status.total_rows || '?'} rows processed
        </p>
      </div>
    );
  }

  if (status.status === 'failed') {
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800 mb-1">Upload Failed</p>
            <p className="text-xs text-red-600 leading-relaxed">{status.error_message || 'An error occurred during processing.'}</p>
          </div>
        </div>
        <button onClick={onReset}
          className="mt-4 w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  // Completed
  const hasErrors = failed.length > 0;
  const allFailed = status.successful_count === 0 && failed.length > 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={`rounded-2xl border shadow-sm p-5 ${allFailed ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${allFailed ? 'bg-red-100' : 'bg-emerald-100'}`}>
            {allFailed
              ? <AlertCircle className="h-6 w-6 text-red-600" />
              : <Check className="h-6 w-6 text-emerald-600" />
            }
          </div>
          <div className="flex-1">
            <p className={`text-sm font-bold mb-2 ${allFailed ? 'text-red-800' : 'text-emerald-800'}`}>
              {allFailed ? 'All rows failed' : 'Upload Complete'}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-lg font-bold text-emerald-700">{status.successful_count}</p>
                <p className="text-[11px] text-emerald-600">Succeeded</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-600">{status.failed_count}</p>
                <p className="text-[11px] text-red-500">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700">{status.total_rows}</p>
                <p className="text-[11px] text-slate-400">Total rows</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          Completed {fmt(status.completed_at)}
        </p>
      </div>

      {/* Errors section */}
      {hasErrors && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <button onClick={() => setShowErrors(p => !p)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-bold text-slate-800">
                {failed.length} Failed Row{failed.length !== 1 ? 's' : ''}
              </span>
              {failed.length > 100 && (
                <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  Showing first 100
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {failed.length > 0 && (
                <button onClick={e => { e.stopPropagation(); onDownloadErrors(); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors">
                  <Download className="h-3.5 w-3.5" /> Download full report
                </button>
              )}
              {showErrors ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>

          {showErrors && (
            <div className="border-t border-slate-50">
              <div className="grid grid-cols-[4rem_1fr_1fr] text-[11px] font-bold text-slate-400 uppercase tracking-wide px-5 py-2 bg-slate-50">
                <span>Row</span><span>Name / Data</span><span>Reason</span>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                {failed.slice(0, 100).map((row, i) => (
                  <div key={i} className="grid grid-cols-[4rem_1fr_1fr] px-5 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-mono text-slate-500">#{row.row}</span>
                    <span className="text-xs text-slate-700 truncate pr-2">{row.data || '—'}</span>
                    <span className="text-xs text-red-600">{row.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={onReset}
        className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors">
        Upload Another File
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BulkUploadPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [mode, setMode]   = useState<UploadMode>('student');
  const [tab, setTab]     = useState<TabMode>('download');

  // Settings
  const [settings, setSettings]             = useState<any>(null);
  const [academicSettings, setAcademicSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings]   = useState(true);

  // Download tab — field selection
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  // Upload tab
  const [uploadFile, setUploadFile]     = useState<File | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadId, setUploadId]         = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [uploadError, setUploadError]   = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Download
  const [downloading, setDownloading] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: 'success'|'error'; message: string } | null>(null);

  const canUpload = user?.is_superuser || hasPermission('student_management.add_bulkstudentuploadmodel');

  const showToast = (type: 'success'|'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Load settings
  useEffect(() => {
    Promise.all([
      studentSettingsAPI.get().catch(() => null),
      academicAPI.getSettings().catch(() => null),
    ]).then(([s, a]) => {
      setSettings(s);
      setAcademicSettings(a);
    }).finally(() => setLoadingSettings(false));
  }, []);

  // Build field definitions based on mode + settings
  const fieldDefs: FieldDef[] = React.useMemo(() => {
    if (loadingSettings) return [];
    const useClassSections = academicSettings?.use_class_sections === true;
    const autoGenerateId   = mode === 'student'
      ? settings?.auto_generate_student_id !== false
      : settings?.auto_generate_parent_id  !== false;
    const showUserForm     = settings?.show_user_form === true;

    if (mode === 'parent') {
      const defs: FieldDef[] = [
        { key: 'first_name',    label: 'First Name',     required: true,  defaultOn: true  },
        { key: 'last_name',     label: 'Last Name',      required: true,  defaultOn: true  },
        { key: 'gender',        label: 'Gender',         required: true,  defaultOn: true  },
        { key: 'middle_name',   label: 'Middle Name',    required: false, defaultOn: false },
        { key: 'email',         label: 'Email',          required: false, defaultOn: true,  description: 'Used as username if username type is email' },
        { key: 'mobile',        label: 'Mobile Number',  required: false, defaultOn: true  },
        { key: 'address',       label: 'Home Address',   required: false, defaultOn: false },
        { key: 'state',         label: 'State of Origin',required: false, defaultOn: false },
        { key: 'lga',           label: 'LGA',            required: false, defaultOn: false },
        { key: 'religion',      label: 'Religion',       required: false, defaultOn: false },
        { key: 'marital_status',label: 'Marital Status', required: false, defaultOn: false },
        { key: 'occupation',    label: 'Occupation',     required: false, defaultOn: false },
      ];
      if (!autoGenerateId) {
        defs.splice(3, 0, { key: 'parent_id', label: 'Parent ID', required: true, defaultOn: true, description: 'Required — auto-generation is disabled' });
      }
      if (showUserForm) {
        defs.push({ key: 'username', label: 'Username', required: false, defaultOn: false, description: 'Leave blank to auto-generate' });
        defs.push({ key: 'password', label: 'Password', required: false, defaultOn: false, description: 'Leave blank to auto-generate' });
      }
      return defs;
    } else {
      const defs: FieldDef[] = [
        { key: 'first_name',               label: 'First Name',              required: true,  defaultOn: true  },
        { key: 'last_name',                label: 'Last Name',               required: true,  defaultOn: true  },
        { key: 'gender',                   label: 'Gender',                  required: true,  defaultOn: true  },
        { key: 'parent_id',                label: 'Parent ID',               required: true,  defaultOn: true,  description: 'Must match an existing active guardian' },
        { key: 'relationship_with_parent', label: 'Relationship',            required: true,  defaultOn: true  },
        { key: 'class',                    label: 'Class',                   required: true,  defaultOn: true  },
        { key: 'middle_name',              label: 'Middle Name',             required: false, defaultOn: false },
        { key: 'email',                    label: 'Email',                   required: false, defaultOn: true  },
        { key: 'mobile',                   label: 'Mobile Number',           required: false, defaultOn: true  },
        { key: 'date_of_birth',            label: 'Date of Birth',           required: false, defaultOn: false, description: 'Format: YYYY-MM-DD' },
        { key: 'religion',                 label: 'Religion',                required: false, defaultOn: false },
        { key: 'state',                    label: 'State of Origin',         required: false, defaultOn: false },
        { key: 'lga',                      label: 'LGA',                     required: false, defaultOn: false },
      ];
      if (useClassSections) {
        defs.splice(6, 0, { key: 'class_section', label: 'Class Section', required: true, defaultOn: true });
      }
      if (!autoGenerateId) {
        defs.push({ key: 'registration_number', label: 'Registration Number', required: true, defaultOn: true, description: 'Required — auto-generation is disabled' });
      }
      if (showUserForm) {
        defs.push({ key: 'username', label: 'Username', required: false, defaultOn: false, description: 'Leave blank to auto-generate' });
        defs.push({ key: 'password', label: 'Password', required: false, defaultOn: false, description: 'Leave blank to auto-generate' });
      }
      return defs;
    }
  }, [mode, settings, academicSettings, loadingSettings]);

  // Initialise selected fields when mode/settings change
  useEffect(() => {
    setSelectedFields(new Set(fieldDefs.filter(f => f.defaultOn || f.required).map(f => f.key)));
  }, [fieldDefs]);

  const toggleField = (key: string) => {
    const def = fieldDefs.find(f => f.key === key);
    if (def?.required) return;
    setSelectedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Polling
  const startPolling = useCallback((id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await bulkUploadAPI.getStatus(id);
        setUploadStatus(data);
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      } catch { /* ignore */ }
    }, 2000);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = mode === 'parent'
        ? await bulkUploadAPI.uploadParents(uploadFile)
        : await bulkUploadAPI.uploadStudents(uploadFile);
      setUploadId(result.upload_id);
      setUploadStatus({ id: result.upload_id, status: 'pending', total_rows: 0, successful_count: 0, failed_count: 0 });
      startPolling(result.upload_id);
    } catch (err: any) {
      setUploadError(extractError(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const fields = Array.from(selectedFields);
      if (mode === 'parent') {
        await bulkUploadAPI.downloadParentTemplate(fields);
      } else {
        await bulkUploadAPI.downloadStudentTemplate(fields);
      }
      showToast('success', 'Template downloaded successfully');
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setDownloading(false);
    }
  };

  const resetUpload = () => {
    setUploadFile(null);
    setUploadId(null);
    setUploadStatus(null);
    setUploadError('');
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const isProcessing = uploadStatus?.status === 'pending' || uploadStatus?.status === 'processing';

  return (
    <div className="space-y-5 pb-10 max-w-4xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[70] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {toast.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button onClick={() => setToast(null)}><X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" /></button>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
            <Upload className="h-5 w-5 text-white" />
          </div>
          Bulk Upload
        </h1>
        <p className="text-sm text-slate-400 mt-0.5 pl-12">Upload multiple students or guardians from Excel</p>
      </div>

      {/* Mode Toggle */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-1.5 flex gap-1.5">
        {([
          { id: 'student', label: 'Students',  icon: GraduationCap },
          { id: 'parent',  label: 'Guardians', icon: Users         },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setMode(id); resetUpload(); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mode === id
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100">
          {([
            { id: 'download', label: 'Download Template', icon: Download },
            { id: 'upload',   label: 'Upload Data',       icon: Upload   },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
                tab === id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ── DOWNLOAD TAB ── */}
          {tab === 'download' && (
            <div className="space-y-5">
              {/* Info banner */}
              <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-700 leading-relaxed space-y-1">
                  <p><span className="font-bold">Dark blue columns</span> are required and cannot be removed.</p>
                  <p><span className="font-bold">Light blue columns</span> are optional — include only what you need.</p>
                  <p>Blank or incomplete rows will be skipped during upload.</p>
                  <p>Do not edit or remove the header row — it will be validated on upload.</p>
                  {mode === 'student' && (
                    <p>The template includes a <span className="font-bold">Parent Reference</span> sheet with all active guardian IDs.</p>
                  )}
                </div>
              </div>

              {/* Field selection */}
              {loadingSettings ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">
                      Select fields to include in template
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {fieldDefs.map(field => (
                        <FieldCheckbox
                          key={field.key}
                          field={field}
                          checked={selectedFields.has(field.key)}
                          onChange={() => toggleField(field.key)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-400">
                      {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
                    </p>
                    <button onClick={handleDownloadTemplate} disabled={downloading || selectedFields.size === 0}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                      {downloading
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                        : <><FileSpreadsheet className="h-4 w-4" /> Download Template</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── UPLOAD TAB ── */}
          {tab === 'upload' && (
            <div className="space-y-5">
              {!canUpload ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700">You don't have permission to upload student or guardian data.</p>
                </div>
              ) : uploadStatus ? (
                <ResultsPanel
                  status={uploadStatus}
                  onReset={resetUpload}
                  onDownloadErrors={() => uploadId && bulkUploadAPI.downloadErrorReport(uploadId).catch(() => showToast('error', 'Failed to download error report'))}
                />
              ) : (
                <>
                  {/* Checklist */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-600 mb-2">Before uploading, make sure:</p>
                    {[
                      'You downloaded the template from this page (not a previous version)',
                      'You have not edited or renamed any column headers',
                      'Required fields are filled in for every row',
                      mode === 'student' ? 'Parent IDs match existing active guardians' : 'Emails and mobile numbers are not already in use',
                      'The file is saved as .xlsx or .xls',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-blue-600" />
                        </div>
                        <p className="text-xs text-slate-600">{item}</p>
                      </div>
                    ))}
                  </div>

                  {/* File drop */}
                  {!uploadFile ? (
                    <UploadZone onFile={setUploadFile} disabled={uploading} />
                  ) : (
                    <div className="flex items-center gap-4 px-5 py-4 bg-blue-50 border border-blue-200 rounded-2xl">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-blue-900 truncate">{uploadFile.name}</p>
                        <p className="text-xs text-blue-600">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button onClick={() => setUploadFile(null)} disabled={uploading}
                        className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {uploadError && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{uploadError}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button onClick={() => { setTab('download'); setUploadFile(null); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                      ← Get the template first
                    </button>
                    <button onClick={handleUpload} disabled={!uploadFile || uploading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
                      {uploading
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
                        : <><Upload className="h-4 w-4" /> Start Upload</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Help notes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Download Template', desc: 'Select the fields you need and download the Excel template. Fill in your data.', color: 'from-blue-500 to-blue-600' },
            { step: '2', title: 'Upload File',       desc: 'Upload the completed Excel file. The system validates and processes each row.', color: 'from-violet-500 to-purple-600' },
            { step: '3', title: 'Review Results',    desc: 'View a summary of successful and failed rows. Download an error report if needed.', color: 'from-emerald-500 to-teal-600' },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className="flex items-start gap-3">
              <div className={`w-8 h-8 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-sm`}>
                {step}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">{title}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}