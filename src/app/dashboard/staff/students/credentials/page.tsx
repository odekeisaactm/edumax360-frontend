'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  studentsAPI, parentsAPI, academicAPI, studentSettingsAPI,
} from '@/lib/api';
import {
  KeyRound, Search, X, Check, AlertCircle, Loader2,
  RefreshCw, Download, FileSpreadsheet, FileText,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  GraduationCap, UserCheck, ShieldOff, Settings,
  Mail, Send, Clock, Users, CheckSquare, Square,
} from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return new Date(iso).toLocaleDateString();
}

function formatExactTime(iso: string | null | undefined): string {
  if (!iso) return 'Never emailed';
  return new Date(iso).toLocaleString();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── FieldCheckbox ────────────────────────────────────────────────────────────
function FieldCheckbox({ label, checked, onChange, locked = false }: {
  label: string; checked: boolean; onChange?: () => void; locked?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 group ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      onClick={locked ? undefined : onChange}
    >
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
        checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'
      } ${locked ? 'opacity-70' : ''}`}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <span className="text-xs text-slate-600 select-none">{label}{locked && ' (required)'}</span>
    </label>
  );
}

// ─── DownloadDropdown ─────────────────────────────────────────────────────────
function DownloadDropdown({ onExcel, onPDF, downloading, label = 'Download' }: {
  onExcel: () => void; onPDF: () => void; downloading: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        disabled={downloading}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50"
      >
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          <div className="p-1.5">
            <button onClick={() => { onExcel(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Excel (.xlsx)</p>
                <p className="text-[11px] text-slate-400">Spreadsheet with credentials</p>
              </div>
            </button>
            <button onClick={() => { onPDF(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">PDF</p>
                <p className="text-[11px] text-slate-400">Printable credentials list</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SendCredentialsDropdown ──────────────────────────────────────────────────
function SendCredentialsDropdown({ onSendAll, onSendFiltered, onSendSelected, selectedCount, hasFilters }: {
  onSendAll: () => void; onSendFiltered: () => void; onSendSelected: () => void;
  selectedCount: number; hasFilters: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-white text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
      >
        <Mail className="h-4 w-4 text-blue-600" />
        Send Credentials
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          <div className="p-1.5">
            <button onClick={() => { onSendSelected(); setOpen(false); }}
              disabled={selectedCount === 0}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed">
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <CheckSquare className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Selected ({selectedCount})</p>
                <p className="text-[11px] text-slate-400">Only checked rows</p>
              </div>
            </button>
            <button onClick={() => { onSendFiltered(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Search className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Filtered{hasFilters ? '' : ' (no filters set)'}</p>
                <p className="text-[11px] text-slate-400">Everyone matching current search/filters</p>
              </div>
            </button>
            <button onClick={() => { onSendAll(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">All Parents</p>
                <p className="text-[11px] text-slate-400">Entire database</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skipped group accordion ──────────────────────────────────────────────────
function SkippedGroup({ title, count, parents, expanded, onToggle, onDownload, downloading }: {
  title: string; count: number; parents: any[]; expanded: boolean;
  onToggle: () => void; onDownload: (fmt: 'excel' | 'pdf') => void; downloading: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
        <span className="text-sm font-semibold text-slate-700">{title} <span className="text-slate-400 font-normal">({count})</span></span>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {expanded && (
        <div className="p-4 space-y-3">
          <div className="max-h-40 overflow-y-auto space-y-1">
            {parents.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-xs text-slate-600 py-1">
                <span>{toTitleCase(p.full_name)}</span>
                <span className="font-mono text-slate-400">{p.parent_id}</span>
              </div>
            ))}
            {count > parents.length && (
              <p className="text-[11px] text-slate-400 pt-1">…and {count - parents.length} more</p>
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={() => onDownload('excel')} disabled={downloading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Download Excel
            </button>
            <button onClick={() => onDownload('pdf')} disabled={downloading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">
              <FileText className="h-3.5 w-3.5" /> Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Send Credentials Modal ────────────────────────────────────────────────────
function SendCredentialsModal({
  mode, onClose, preview, previewLoading, onRefreshPreview,
  skipIfEverEmailed, setSkipIfEverEmailed,
  useSkipDays, setUseSkipDays, skipDays, setSkipDays,
  onConfirm, sending, onDownloadSkipped, downloadingSkipped,
}: {
  mode: 'all' | 'filtered' | 'selected';
  onClose: () => void;
  preview: any;
  previewLoading: boolean;
  onRefreshPreview: () => void;
  skipIfEverEmailed: boolean; setSkipIfEverEmailed: (v: boolean) => void;
  useSkipDays: boolean; setUseSkipDays: (v: boolean) => void;
  skipDays: number | ''; setSkipDays: (v: number | '') => void;
  onConfirm: () => void; sending: boolean;
  onDownloadSkipped: (group: 'no_email' | 'already_emailed', fmt: 'excel' | 'pdf') => void;
  downloadingSkipped: boolean;
}) {
  const [expandedGroup, setExpandedGroup] = useState<'no_email' | 'already_emailed' | null>(null);
  const modeLabel = mode === 'all' ? 'all parents' : mode === 'selected' ? 'the selected parents' : 'the filtered parents';

  const total = preview?.total_considered ?? 0;
  const eligible = preview?.eligible_count ?? 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <Send className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Send Login Credentials</h3>
              <p className="text-xs text-slate-400">Sending to {modeLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* skip options */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={skipIfEverEmailed}
                onChange={e => setSkipIfEverEmailed(e.target.checked)}
                className="rounded border-slate-300" />
              <span className="text-sm text-slate-700">Skip parents who have ever been emailed</span>
            </label>

            {!skipIfEverEmailed && (
              <label className="flex items-center gap-2 cursor-pointer pl-1">
                <input type="checkbox" checked={useSkipDays}
                  onChange={e => setUseSkipDays(e.target.checked)}
                  className="rounded border-slate-300" />
                <span className="text-sm text-slate-700">Skip if emailed within the last</span>
                <input type="number" min={1} value={skipDays}
                  disabled={!useSkipDays}
                  onChange={e => setSkipDays(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40" />
                <span className="text-sm text-slate-700">days</span>
              </label>
            )}
          </div>

          {/* preview summary */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
            {previewLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            ) : preview ? (
              <>
                <p className="text-sm font-semibold text-slate-800">
                  Sending to <span className="text-blue-700">{eligible}</span> of {total} {mode === 'selected' ? 'selected' : ''}
                </p>
                {eligible === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No eligible recipients with the current filters — adjust the skip options above.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-400">Unable to load preview.</p>
            )}
          </div>

          {/* skipped accordion */}
          {preview && (preview.skipped?.no_email?.count > 0 || preview.skipped?.already_emailed?.count > 0) && (
            <div className="space-y-2">
              <SkippedGroup
                title="No email on file"
                count={preview.skipped.no_email.count}
                parents={preview.skipped.no_email.parents}
                expanded={expandedGroup === 'no_email'}
                onToggle={() => setExpandedGroup(p => p === 'no_email' ? null : 'no_email')}
                onDownload={(fmt) => onDownloadSkipped('no_email', fmt)}
                downloading={downloadingSkipped}
              />
              <SkippedGroup
                title="Already emailed"
                count={preview.skipped.already_emailed.count}
                parents={preview.skipped.already_emailed.parents}
                expanded={expandedGroup === 'already_emailed'}
                onToggle={() => setExpandedGroup(p => p === 'already_emailed' ? null : 'already_emailed')}
                onDownload={(fmt) => onDownloadSkipped('already_emailed', fmt)}
                downloading={downloadingSkipped}
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={sending || previewLoading || eligible === 0}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to {eligible}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Portal disabled banner ───────────────────────────────────────────────────
function PortalDisabledBanner({ type }: { type: 'student' | 'parent' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">

    </div>
  );
}

// ─── No logins banner ─────────────────────────────────────────────────────────
function NoLoginsBanner({ type }: { type: 'student' | 'parent' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
        <KeyRound className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="font-bold text-slate-800 text-base mb-1">No credentials found</h3>
      <p className="text-sm text-slate-400 max-w-sm mb-4">
        No {type === 'student' ? 'students' : 'parents'} have login accounts yet. Enable
        &quot;Auto Generate Logins&quot; in Student Settings and register new records.
      </p>
        <a
        href="/dashboard/staff/students/settings"
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
      >
        <Settings className="h-3.5 w-3.5" /> Go to Student Settings
      </a>
    </div>
  );
}

// ─── constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

const STUDENT_OPTIONAL = [
  { key: 'current_class', label: 'Class' },
  { key: 'gender',        label: 'Gender' },
];

const PARENT_OPTIONAL = [
  { key: 'email',     label: 'Email' },
  { key: 'mobile',    label: 'Mobile' },
  { key: 'parent_id', label: 'Parent ID' },
];

const GENDER_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  male:   { label: 'Male',   color: 'text-blue-700', bg: 'bg-blue-50',  border: 'border-blue-100'  },
  female: { label: 'Female', color: 'text-pink-700', bg: 'bg-pink-50',  border: 'border-pink-100'  },
};

const PARENT_STATUS_META: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  active:    { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  suspended: { dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-100'  },
  inactive:  { dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100',  border: 'border-slate-200'   },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CredentialsPage() {
  const { user } = useAuth();

  // ── tab ──
  const [tab, setTab] = useState<'student' | 'parent'>('student');

  // ── settings ──
  const [settings, setSettings] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // ── classes (for student filter) ──
  const [classes, setClasses]   = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [useClassSections, setUseClassSections] = useState(false);

  // ── student state ──
  const [students, setStudents]             = useState<any[]>([]);
  const [studentTotal, setStudentTotal]     = useState(0);
  const [studentPage, setStudentPage]       = useState(1);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentError, setStudentError]     = useState<string | null>(null);

  const [studentSearch, setStudentSearch]             = useState('');
  const [studentClass, setStudentClass]               = useState('');
  const [studentSection, setStudentSection]           = useState('');
  const [studentGender, setStudentGender]             = useState('');
  const [studentOptionalFields, setStudentOptionalFields] = useState<Set<string>>(new Set());

  // ── parent state ──
  const [parents, setParents]             = useState<any[]>([]);
  const [parentTotal, setParentTotal]     = useState(0);
  const [parentPage, setParentPage]       = useState(1);
  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError]     = useState<string | null>(null);

  const [parentSearch, setParentSearch]             = useState('');
  const [parentStatus, setParentStatus]             = useState('');
  const [parentClass, setParentClass]               = useState('');
  const [parentClassSection, setParentClassSection] = useState('');
  const [parentSections, setParentSections]         = useState<any[]>([]);
  const [parentOptionalFields, setParentOptionalFields] = useState<Set<string>>(new Set());

  // ── parent selection (for send-credentials) ──
  const [selectedParentIds, setSelectedParentIds] = useState<Set<number>>(new Set());

  // ── send credentials modal ──
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailMode, setEmailMode] = useState<'all' | 'filtered' | 'selected'>('filtered');
  const [skipIfEverEmailed, setSkipIfEverEmailed] = useState(false);
  const [useSkipDays, setUseSkipDays] = useState(true);
  const [skipDays, setSkipDays] = useState<number | ''>(7);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloadingSkipped, setDownloadingSkipped] = useState(false);

  // ── shared ──
  const [downloading, setDownloading] = useState(false);
  const [toasts, setToasts]           = useState<ToastItem[]>([]);

  const studentDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parentDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── toast helper ──
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  // ── load settings + classes on mount ──
  useEffect(() => {
    studentSettingsAPI.get()
      .then(s => setSettings(s))
      .catch(() => setSettings(null))
      .finally(() => setSettingsLoading(false));

    academicAPI.listClasses()
      .then((c: any[]) => setClasses(Array.isArray(c) ? c : []))
      .catch(() => {});

    academicAPI.getSettings()
      .then((s: any) => setUseClassSections(s?.use_class_sections === true))
      .catch(() => {});
  }, []);

  // ── class → sections (student tab) ──
  const handleClassChange = (classId: string) => {
    setStudentClass(classId);
    setStudentSection('');
    if (!classId) { setSections([]); return; }
    const cls = classes.find(c => String(c.id) === classId);
    if (!cls?.configurations?.length) { setSections([]); return; }
    const seen = new Set<number>();
    const extracted: any[] = [];
    for (const config of cls.configurations) {
      if (config.is_active && !seen.has(config.class_section)) {
        seen.add(config.class_section);
        extracted.push({ id: config.class_section, name: config.class_section_name });
      }
    }
    setSections(extracted);
  };

  // ── class → sections (parent tab) ──
  const handleParentClassChange = (classId: string) => {
    setParentClass(classId);
    setParentClassSection('');
    if (!classId) {
      setParentSections([]);
      fetchParents(1, { cls: '', section: '' });
      return;
    }
    const cls = classes.find(c => String(c.id) === classId);
    if (!cls?.configurations?.length) {
      setParentSections([]);
    } else {
      const seen = new Set<number>();
      const extracted: any[] = [];
      for (const config of cls.configurations) {
        if (config.is_active && !seen.has(config.class_section)) {
          seen.add(config.class_section);
          extracted.push({ id: config.class_section, name: config.class_section_name });
        }
      }
      setParentSections(extracted);
    }
    fetchParents(1, { cls: classId, section: '' });
  };

  // ── fetch students ──
  const fetchStudents = useCallback(async (pg = 1, opts?: {
    search?: string; cls?: string; section?: string; gender?: string;
  }) => {
    setStudentLoading(true); setStudentError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      const s = opts?.search   ?? studentSearch;
      const c = opts?.cls      ?? studentClass;
      const sc = opts?.section ?? studentSection;
      const g = opts?.gender   ?? studentGender;
      if (s)  params.search                = s;
      if (c)  params.current_class         = c;
      if (sc) params.current_class_section = sc;
      if (g)  params.gender                = g;

      const data = await (studentsAPI as any).getCredentials(params);
      const results = data?.results ?? data?.data ?? data ?? [];
      setStudents(Array.isArray(results) ? results : []);
      setStudentTotal(data?.count ?? results.length);
      setStudentPage(pg);
    } catch (err) {
      setStudentError(extractError(err));
    } finally {
      setStudentLoading(false);
    }
  }, [studentSearch, studentClass, studentSection, studentGender]);

  // ── fetch parents ──
  const fetchParents = useCallback(async (pg = 1, opts?: {
    search?: string; status?: string; cls?: string; section?: string;
  }) => {
    setParentLoading(true); setParentError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      const s  = opts?.search  ?? parentSearch;
      const st = opts?.status  ?? parentStatus;
      const c  = opts?.cls     ?? parentClass;
      const sc = opts?.section ?? parentClassSection;
      if (s)  params.search                = s;
      if (st) params.status                = st;
      if (c)  params.current_class         = c;
      if (sc) params.current_class_section = sc;

      const data = await (parentsAPI as any).getCredentials(params);
      const results = data?.results ?? data?.data ?? data ?? [];
      setParents(Array.isArray(results) ? results : []);
      setParentTotal(data?.count ?? results.length);
      setParentPage(pg);
    } catch (err) {
      setParentError(extractError(err));
    } finally {
      setParentLoading(false);
    }
  }, [parentSearch, parentStatus, parentClass, parentClassSection]);

  // ── initial load ──
  useEffect(() => { fetchStudents(1); }, []);
  useEffect(() => { if (tab === 'parent' && parents.length === 0 && !parentLoading) fetchParents(1); }, [tab]);

  // ── search debounce — student ──
  useEffect(() => {
    if (studentDebounce.current) clearTimeout(studentDebounce.current);
    studentDebounce.current = setTimeout(() => fetchStudents(1, { search: studentSearch }), 400);
    return () => { if (studentDebounce.current) clearTimeout(studentDebounce.current); };
  }, [studentSearch]);

  // ── search debounce — parent ──
  useEffect(() => {
    if (parentDebounce.current) clearTimeout(parentDebounce.current);
    parentDebounce.current = setTimeout(() => fetchParents(1, { search: parentSearch }), 400);
    return () => { if (parentDebounce.current) clearTimeout(parentDebounce.current); };
  }, [parentSearch]);

  // ── toggle optional download field ──
  const toggleStudentField = (key: string) =>
    setStudentOptionalFields(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleParentField = (key: string) =>
    setParentOptionalFields(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── parent row selection ──
  const toggleParentSelected = (id: number) =>
    setSelectedParentIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const allOnPageSelected = parents.length > 0 && parents.every(p => selectedParentIds.has(p.id));
  const toggleSelectAllOnPage = () => {
    setSelectedParentIds(prev => {
      const n = new Set(prev);
      if (allOnPageSelected) {
        parents.forEach(p => n.delete(p.id));
      } else {
        parents.forEach(p => n.add(p.id));
      }
      return n;
    });
  };

  // ── download helpers ──
  const buildStudentDownloadParams = () => {
    const p: Record<string, any> = {};
    if (studentSearch)  p.search                = studentSearch;
    if (studentClass)   p.current_class         = studentClass;
    if (studentSection) p.current_class_section = studentSection;
    if (studentGender)  p.gender                = studentGender;
    if (studentOptionalFields.size > 0) p.fields = Array.from(studentOptionalFields).join(',');
    return p;
  };

  const buildParentDownloadParams = () => {
    const p: Record<string, any> = {};
    if (parentSearch)         p.search                = parentSearch;
    if (parentStatus)         p.status                = parentStatus;
    if (parentClass)          p.current_class         = parentClass;
    if (parentClassSection)   p.current_class_section = parentClassSection;
    if (parentOptionalFields.size > 0) p.fields = Array.from(parentOptionalFields).join(',');
    return p;
  };

  const handleStudentExcel = async () => {
    setDownloading(true);
    try { await (studentsAPI as any).downloadCredentialsExcel(buildStudentDownloadParams()); }
    catch { showToast('error', 'Failed to download Excel file'); }
    finally { setDownloading(false); }
  };

  const handleStudentPDF = async () => {
    setDownloading(true);
    try { await (studentsAPI as any).downloadCredentialsPDF(buildStudentDownloadParams()); }
    catch { showToast('error', 'Failed to download PDF file'); }
    finally { setDownloading(false); }
  };

  const handleParentExcel = async () => {
    setDownloading(true);
    try { await (parentsAPI as any).downloadCredentialsExcel(buildParentDownloadParams()); }
    catch { showToast('error', 'Failed to download Excel file'); }
    finally { setDownloading(false); }
  };

  const handleParentPDF = async () => {
    setDownloading(true);
    try { await (parentsAPI as any).downloadCredentialsPDF(buildParentDownloadParams()); }
    catch { showToast('error', 'Failed to download PDF file'); }
    finally { setDownloading(false); }
  };

  // ── send-credentials: build request payload ──
  const buildEmailPayload = (mode: 'all' | 'filtered' | 'selected') => {
    const payload: any = { mode };
    if (mode === 'selected') {
      payload.ids = Array.from(selectedParentIds);
    } else if (mode === 'filtered') {
      payload.filters = {
        search: parentSearch || undefined,
        status: parentStatus || undefined,
        current_class: parentClass || undefined,
        current_class_section: parentClassSection || undefined,
      };
    }
    if (skipIfEverEmailed) {
      payload.skip_if_ever_emailed = true;
    } else if (useSkipDays && skipDays) {
      payload.skip_if_emailed_within_days = Number(skipDays);
    }
    return payload;
  };

  const hasActiveParentFilters = !!(parentSearch || parentStatus || parentClass || parentClassSection);

  // ── send-credentials: preview ──
  const fetchPreview = useCallback(async (mode: 'all' | 'filtered' | 'selected') => {
    setPreviewLoading(true);
    try {
      const payload = buildEmailPayload(mode);
      const data = await parentsAPI.previewCredentialsEmail(payload);      setPreview(data);
    } catch (err) {
      showToast('error', extractError(err));
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [parentSearch, parentStatus, parentClass, parentClassSection, selectedParentIds, skipIfEverEmailed, useSkipDays, skipDays]);

  const openSendModal = (mode: 'all' | 'filtered' | 'selected') => {
    setEmailMode(mode);
    setEmailModalOpen(true);
  };

  useEffect(() => {
    if (!emailModalOpen) return;
    fetchPreview(emailMode);
  }, [emailModalOpen, emailMode, skipIfEverEmailed, useSkipDays, skipDays]);

  const handleConfirmSend = async () => {
    setSending(true);
    try {
      const payload = buildEmailPayload(emailMode);
      const data = await parentsAPI.sendCredentialsEmail(payload);
      if (data?.queued) {
        showToast('success', `Sending credentials to ${data.recipient_count} parent${data.recipient_count !== 1 ? 's' : ''}…`);
        setEmailModalOpen(false);
        setSelectedParentIds(new Set());
        fetchParents(parentPage);
      } else {
        showToast('error', data?.message || 'No eligible parents to email.');
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSending(false);
    }
  };

  const handleDownloadSkipped = async (group: 'no_email' | 'already_emailed', fmt: 'excel' | 'pdf') => {
    if (!preview) return;
    const ids = preview.skipped?.[group]?.parents?.map((p: any) => p.id) ?? [];
    if (ids.length === 0) return;
    setDownloadingSkipped(true);
    try {
      const params = { ids: ids.join(',') };
      if (fmt === 'excel') await (parentsAPI as any).downloadCredentialsExcel(params);
      else await (parentsAPI as any).downloadCredentialsPDF(params);
    } catch {
      showToast('error', 'Failed to download list');
    } finally {
      setDownloadingSkipped(false);
    }
  };

  // ── shared input/select styles ──
  const inputCls = 'px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-slate-800 transition-colors';

  // ── pagination helper ──
  const Pagination = ({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) => {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const pg = totalPages <= 5 ? i + 1
            : page <= 3 ? i + 1
            : page >= totalPages - 2 ? totalPages - 4 + i
            : page - 2 + i;
          return (
            <button key={pg} onClick={() => onPage(pg)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                pg === page ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}>
              {pg}
            </button>
          );
        })}
        <button onClick={() => onPage(page + 1)} disabled={page === Math.ceil(total / PAGE_SIZE)}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {emailModalOpen && (
        <SendCredentialsModal
          mode={emailMode}
          onClose={() => setEmailModalOpen(false)}
          preview={preview}
          previewLoading={previewLoading}
          onRefreshPreview={() => fetchPreview(emailMode)}
          skipIfEverEmailed={skipIfEverEmailed}
          setSkipIfEverEmailed={setSkipIfEverEmailed}
          useSkipDays={useSkipDays}
          setUseSkipDays={setUseSkipDays}
          skipDays={skipDays}
          setSkipDays={setSkipDays}
          onConfirm={handleConfirmSend}
          sending={sending}
          onDownloadSkipped={handleDownloadSkipped}
          downloadingSkipped={downloadingSkipped}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <KeyRound className="h-5 w-5 text-white" />
            </div>
            Download Credentials
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Export default login credentials for students and parents</p>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'student' && settings?.student_portal_enabled !== false && (
            <DownloadDropdown onExcel={handleStudentExcel} onPDF={handleStudentPDF} downloading={downloading} />
          )}
          {tab === 'parent' && settings?.parent_portal_enabled !== false && (
            <>
              <SendCredentialsDropdown
                onSendAll={() => openSendModal('all')}
                onSendFiltered={() => openSendModal('filtered')}
                onSendSelected={() => openSendModal('selected')}
                selectedCount={selectedParentIds.size}
                hasFilters={hasActiveParentFilters}
              />
              <DownloadDropdown onExcel={handleParentExcel} onPDF={handleParentPDF} downloading={downloading} />
            </>
          )}
        </div>
      </div>

      {/* ── Tab Toggle ── */}
      <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 gap-1">
        <button
          onClick={() => setTab('student')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'student'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Students
        </button>
        <button
          onClick={() => setTab('parent')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'parent'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          Parents
        </button>
      </div>

      {/* ════════════════════════════════════════════════
           STUDENT TAB
          ════════════════════════════════════════════ */}
      {tab === 'student' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {settingsLoading ? (
            <div className="p-16 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : settings?.student_portal_enabled === false ? (
            <PortalDisabledBanner type="student" />
          ) : (
            <>
              {/* Toolbar */}
              <div className="px-5 py-4 border-b border-slate-50 space-y-4">

                {/* Row 1: search + filters */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Name search */}
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name or reg number…"
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className={`${inputCls} w-full pl-9 pr-8`}
                    />
                    {studentSearch && (
                      <button onClick={() => setStudentSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Class */}
                  <select
                    value={studentClass}
                    onChange={e => handleClassChange(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">All classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  {/* Section */}
                  {useClassSections && (
                    <select
                      value={studentSection}
                      onChange={e => { setStudentSection(e.target.value); fetchStudents(1, { section: e.target.value }); }}
                      disabled={!studentClass || sections.length === 0}
                      className={inputCls}
                    >
                      <option value="">{studentClass ? 'All sections' : 'Select class first'}</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}

                  {/* Gender */}
                  <select
                    value={studentGender}
                    onChange={e => { setStudentGender(e.target.value); fetchStudents(1, { gender: e.target.value }); }}
                    className={inputCls}
                  >
                    <option value="">All genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>

                  {/* Refresh */}
                  <button onClick={() => fetchStudents(studentPage)} title="Refresh"
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                {/* Row 2: optional download fields */}
                <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-slate-50">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex-shrink-0">
                    Extra download columns:
                  </span>
                  {['Full Name', 'Reg Number', 'Username', 'Default Password'].map(l => (
                    <FieldCheckbox key={l} label={l} checked locked />
                  ))}
                  {STUDENT_OPTIONAL.map(f => (
                    <FieldCheckbox
                      key={f.key}
                      label={f.label}
                      checked={studentOptionalFields.has(f.key)}
                      onChange={() => toggleStudentField(f.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Table */}
              {studentLoading ? (
                <div className="p-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                  <p className="mt-2 text-sm text-slate-400">Loading credentials…</p>
                </div>
              ) : studentError ? (
                <div className="p-10 text-center">
                  <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-600 mb-3">{studentError}</p>
                  <button onClick={() => fetchStudents(1)}
                    className="text-sm text-blue-600 underline inline-flex items-center gap-1">
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ) : students.length === 0 ? (
                <NoLoginsBanner type="student" />
              ) : (
                <>
                  {/* Table header */}
                  <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    style={{ gridTemplateColumns: '1fr 130px 130px 140px 130px' }}>
                    <span>Student</span>
                    <span>Class</span>
                    <span>Reg Number</span>
                    <span>Username</span>
                    <span>Default Password</span>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {students.map(s => {
                      const gender = GENDER_META[s.gender ?? ''];
                      const classDisplay = [s.current_class_name, s.current_class_section_name]
                        .filter(Boolean).join(' ');
                      return (
                        <div key={s.id}
                          className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                          style={{ gridTemplateColumns: '1fr 130px 130px 140px 130px' }}>

                          {/* Name */}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">
                              {toTitleCase(s.full_name)}
                            </p>
                            {gender && (
                              <span className={`mt-0.5 inline-block px-1.5 rounded text-[11px] font-semibold border ${gender.bg} ${gender.color} ${gender.border}`}>
                                {gender.label}
                              </span>
                            )}
                          </div>

                          {/* Class */}
                          <div className="hidden sm:block">
                            <span className="text-sm text-slate-700">{classDisplay || '—'}</span>
                          </div>

                          {/* Reg */}
                          <div className="hidden sm:block">
                            <span className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                              {s.registration_number || '—'}
                            </span>
                          </div>

                          {/* Username */}
                          <div className="hidden sm:block">
                            <span className="text-xs font-mono text-slate-700">{s.username || '—'}</span>
                          </div>

                          {/* Password */}
                          <div className="hidden sm:block">
                            <span className="text-xs font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                              {s.default_password || '—'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-xs text-slate-400">
                      Showing {((studentPage - 1) * PAGE_SIZE) + 1}–{Math.min(studentPage * PAGE_SIZE, studentTotal)} of{' '}
                      <span className="font-semibold text-slate-600">{studentTotal}</span> student{studentTotal !== 1 ? 's' : ''}
                    </p>
                    <Pagination page={studentPage} total={studentTotal} onPage={p => fetchStudents(p)} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
           PARENT TAB
          ════════════════════════════════════════════ */}
      {tab === 'parent' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {settingsLoading ? (
            <div className="p-16 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600 mx-auto" />
            </div>
          ) : settings?.parent_portal_enabled === false ? (
            <PortalDisabledBanner type="parent" />
          ) : (
            <>
              {/* Toolbar */}
              <div className="px-5 py-4 border-b border-slate-50 space-y-4">

                {/* Row 1: search + status + class + section */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by name, email, mobile, parent ID…"
                      value={parentSearch}
                      onChange={e => setParentSearch(e.target.value)}
                      className={`${inputCls} w-full pl-9 pr-8`}
                    />
                    {parentSearch && (
                      <button onClick={() => setParentSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <select
                    value={parentStatus}
                    onChange={e => { setParentStatus(e.target.value); fetchParents(1, { status: e.target.value }); }}
                    className={inputCls}
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  {/* Ward's class */}
                  <select
                    value={parentClass}
                    onChange={e => handleParentClassChange(e.target.value)}
                    className={inputCls}
                    title="Filter by ward's class"
                  >
                    <option value="">All classes (ward)</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  {/* Ward's section */}
                  {useClassSections && (
                    <select
                      value={parentClassSection}
                      onChange={e => { setParentClassSection(e.target.value); fetchParents(1, { section: e.target.value }); }}
                      disabled={!parentClass || parentSections.length === 0}
                      className={inputCls}
                    >
                      <option value="">{parentClass ? 'All sections' : 'Select class first'}</option>
                      {parentSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}

                  <button onClick={() => fetchParents(parentPage)} title="Refresh"
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>

                {/* Row 2: optional download fields */}
                <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-slate-50">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex-shrink-0">
                    Extra download columns:
                  </span>
                  {['Full Name', 'Username', 'Default Password'].map(l => (
                    <FieldCheckbox key={l} label={l} checked locked />
                  ))}
                  {PARENT_OPTIONAL.map(f => (
                    <FieldCheckbox
                      key={f.key}
                      label={f.label}
                      checked={parentOptionalFields.has(f.key)}
                      onChange={() => toggleParentField(f.key)}
                    />
                  ))}
                </div>
              </div>

              {/* Table */}
              {parentLoading ? (
                <div className="p-16 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                  <p className="mt-2 text-sm text-slate-400">Loading credentials…</p>
                </div>
              ) : parentError ? (
                <div className="p-10 text-center">
                  <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-600 mb-3">{parentError}</p>
                  <button onClick={() => fetchParents(1)}
                    className="text-sm text-blue-600 underline inline-flex items-center gap-1">
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ) : parents.length === 0 ? (
                <NoLoginsBanner type="parent" />
              ) : (
                <>
                  {/* Table header */}
                  <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                    style={{ gridTemplateColumns: '32px 1fr 150px 150px 100px 90px' }}>
                    <button onClick={toggleSelectAllOnPage} className="flex items-center justify-center">
                      {allOnPageSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-slate-300" />}
                    </button>
                    <span>Parent</span>
                    <span>Username</span>
                    <span>Default Password</span>
                    <span>Status</span>
                    <span>Last Emailed</span>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {parents.map(p => {
                      const status = PARENT_STATUS_META[p.status ?? 'active'] ?? PARENT_STATUS_META.active;
                      const isSelected = selectedParentIds.has(p.id);
                      return (
                        <div key={p.id}
                          className={`flex sm:grid items-center gap-3 px-5 py-3.5 transition-colors ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'}`}
                          style={{ gridTemplateColumns: '32px 1fr 150px 150px 100px 90px' }}>

                          {/* Checkbox */}
                          <button onClick={() => toggleParentSelected(p.id)} className="flex items-center justify-center">
                            {isSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-slate-300" />}
                          </button>

                          {/* Name */}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 text-sm truncate">
                              {toTitleCase(p.full_name)}
                            </p>
                            {p.parent_id && (
                              <span className="text-[11px] font-mono text-slate-400">{p.parent_id}</span>
                            )}
                          </div>

                          {/* Username */}
                          <div className="hidden sm:block">
                            <span className="text-xs font-mono text-slate-700">{p.username || '—'}</span>
                          </div>

                          {/* Password */}
                          <div className="hidden sm:block">
                            <span className="text-xs font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                              {p.default_password || '—'}
                            </span>
                          </div>

                          {/* Status */}
                          <div className="hidden sm:block">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                              {(p.status || 'active').charAt(0).toUpperCase() + (p.status || 'active').slice(1)}
                            </span>
                          </div>

                          {/* Last Emailed */}
                          <div className="hidden sm:block" title={formatExactTime(p.credentials_last_emailed_at)}>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${p.credentials_last_emailed_at ? 'text-slate-500' : 'text-slate-300'}`}>
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(p.credentials_last_emailed_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-xs text-slate-400">
                      Showing {((parentPage - 1) * PAGE_SIZE) + 1}–{Math.min(parentPage * PAGE_SIZE, parentTotal)} of{' '}
                      <span className="font-semibold text-slate-600">{parentTotal}</span> parent{parentTotal !== 1 ? 's' : ''}
                      {selectedParentIds.size > 0 && (
                        <span className="ml-2 text-blue-600 font-semibold">· {selectedParentIds.size} selected</span>
                      )}
                    </p>
                    <Pagination page={parentPage} total={parentTotal} onPage={p => fetchParents(p)} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}