'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicCalendarAPI, alumniAPI } from '@/lib/api';
import {
  GraduationCap, Search, X, Check, AlertCircle, Loader2,
  RefreshCw, Eye, ChevronLeft, ChevronRight,
  Download, FileSpreadsheet, FileText, ChevronDown,
  Filter, SlidersHorizontal,
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

// ─── constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;

const GENDER_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  male:   { label: 'Male',   color: 'text-blue-700', bg: 'bg-blue-50',  border: 'border-blue-100'  },
  female: { label: 'Female', color: 'text-pink-700', bg: 'bg-pink-50',  border: 'border-pink-100'  },
};

// ─── Export field definitions ─────────────────────────────────────────────────
const ALL_EXPORT_FIELDS: { key: string; label: string; defaultOn: boolean }[] = [
  { key: 'full_name',           label: 'Full Name',     defaultOn: true  },
  { key: 'registration_number', label: 'Reg Number',    defaultOn: true  },
  { key: 'gender',              label: 'Gender',        defaultOn: true  },
  { key: 'current_class',       label: 'Final Class',   defaultOn: true  },
  { key: 'status',              label: 'Status',        defaultOn: false },
  { key: 'date_of_birth',       label: 'Date of Birth', defaultOn: false },
  { key: 'religion',            label: 'Religion',      defaultOn: false },
  { key: 'state',               label: 'State',         defaultOn: false },
  { key: 'lga',                 label: 'LGA',           defaultOn: false },
  { key: 'mobile',              label: 'Mobile',        defaultOn: false },
  { key: 'email',               label: 'Email',         defaultOn: false },
  { key: 'parent_name',         label: 'Parent Name',   defaultOn: false },
  { key: 'parent_mobile',       label: 'Parent Mobile', defaultOn: false },
];

const DEFAULT_FIELDS = new Set(ALL_EXPORT_FIELDS.filter(f => f.defaultOn).map(f => f.key));

// ─── FieldCheckbox ────────────────────────────────────────────────────────────
function FieldCheckbox({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group" onClick={onChange}>
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
        checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300 group-hover:border-blue-400'
      }`}>
        {checked && <Check className="h-2.5 w-2.5 text-white" />}
      </div>
      <span className="text-xs text-slate-600 group-hover:text-slate-800 transition-colors select-none">{label}</span>
    </label>
  );
}

// ─── Export Fields Modal ──────────────────────────────────────────────────────
function ExportFieldsModal({ open, selectedFields, onApply, onClose }: {
  open: boolean;
  selectedFields: Set<string>;
  onApply: (fields: Set<string>) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<Set<string>>(new Set(selectedFields));

  useEffect(() => {
    if (open) setLocal(new Set(selectedFields));
  }, [open, selectedFields]);

  const toggle = (key: string) => setLocal(prev => {
    const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next;
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Export Fields</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs text-slate-400 mb-4">Choose which columns appear in Excel / PDF downloads.</p>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {ALL_EXPORT_FIELDS.map(f => (
              <FieldCheckbox key={f.key} label={f.label} checked={local.has(f.key)} onChange={() => toggle(f.key)} />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button onClick={() => setLocal(new Set(DEFAULT_FIELDS))}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">
            Reset defaults
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={() => onApply(local)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Download Dropdown ─────────────────────────────────────────────────────────
function DownloadDropdown({ onExcel, onPDF, onFields, downloading }: {
  onExcel: () => void; onPDF: () => void; onFields: () => void; downloading: boolean;
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
      <button onClick={() => setOpen(p => !p)} disabled={downloading}
        className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50">
        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
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
                <p className="text-[11px] text-slate-400">Selected fields only</p>
              </div>
            </button>
            <button onClick={() => { onPDF(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left">
              <div className="w-8 h-8 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">PDF</p>
                <p className="text-[11px] text-slate-400">Printable alumni list</p>
              </div>
            </button>
          </div>
          <div className="px-3 py-2 border-t border-slate-50 bg-slate-50/60">
            <button onClick={() => { onFields(); setOpen(false); }}
              className="text-[11px] text-blue-600 font-semibold hover:text-blue-800 transition-colors">
              <Filter className="h-3 w-3 inline mr-1" />
              Customise export fields
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AlumniPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [alumni, setAlumni]         = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(false);
  const [pageError, setPageError]   = useState<string | null>(null);
  const [toasts, setToasts]         = useState<ToastItem[]>([]);
  const [downloading, setDownloading] = useState(false);

  // sessions
  const [sessions, setSessions]       = useState<any[]>([]);
  const [sessionId, setSessionId]     = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // search
  const [search, setSearch]           = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // export fields
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));
  const [showFieldsModal, setShowFieldsModal] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  // ── load sessions ──
  useEffect(() => {
    academicCalendarAPI.listSessions()
      .then((s: any[]) => setSessions(Array.isArray(s) ? s : []))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  // ── fetch alumni ──
  const fetchAlumni = useCallback(async (pg = 1, opts?: { sid?: string; q?: string }) => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      const sid = opts?.sid ?? sessionId;
      const q   = opts?.q   ?? search;
      if (sid) params.session_id = sid;
      if (q)   params.search     = q;

      const data = await alumniAPI.list(params);
      const results = data?.results?.data ?? data?.results ?? data?.data ?? data ?? [];
      setAlumni(Array.isArray(results) ? results : []);
      setTotal(data?.count ?? results.length);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [sessionId, search]);

  // initial load
  useEffect(() => { fetchAlumni(1); }, []);

  // search debounce
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchAlumni(1, { q: search }), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  // ── build download params ──
  const buildDownloadParams = () => {
    const p: Record<string, any> = {};
    if (sessionId)             p.session_id = sessionId;
    if (search)                p.search     = search;
    if (selectedFields.size)   p.fields     = Array.from(selectedFields).join(',');
    return p;
  };

  const handleExcel = async () => {
    setDownloading(true);
    try { await alumniAPI.downloadExcel(buildDownloadParams()); }
    catch { showToast('error', 'Failed to download Excel file'); }
    finally { setDownloading(false); }
  };

  const handlePDF = async () => {
    setDownloading(true);
    try { await alumniAPI.downloadPDF(buildDownloadParams()); }
    catch { showToast('error', 'Failed to download PDF file'); }
    finally { setDownloading(false); }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const sessionLabel = sessions.find(s => String(s.id) === sessionId)?.name || '';

  // ── stat counts ──
  const maleCount   = alumni.filter(s => s.gender === 'male').length;
  const femaleCount = alumni.filter(s => s.gender === 'female').length;

  const inputCls = 'px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white text-slate-800 transition-colors';

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      <ExportFieldsModal
        open={showFieldsModal}
        selectedFields={selectedFields}
        onApply={fields => { setSelectedFields(fields); setShowFieldsModal(false); }}
        onClose={() => setShowFieldsModal(false)}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            Alumni
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            Graduated students{sessionLabel ? ` — ${sessionLabel}` : ''}
          </p>
        </div>
        <DownloadDropdown
          onExcel={handleExcel}
          onPDF={handlePDF}
          onFields={() => setShowFieldsModal(true)}
          downloading={downloading}
        />
      </div>

      {/* ── Session selector + search bar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Session select */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
              Graduation Session
            </label>
            {sessionsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : (
              <select
                value={sessionId}
                onChange={e => { setSessionId(e.target.value); fetchAlumni(1, { sid: e.target.value }); }}
                className={`${inputCls} min-w-[160px]`}
              >
                <option value="">All sessions</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.start_year}-{s.end_year}</option>
                ))}
              </select>
            )}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or reg number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inputCls} w-full pl-9 pr-8`}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Refresh */}
          <button onClick={() => fetchAlumni(page)} title="Refresh"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Alumni',  value: total,       color: 'from-violet-500 to-purple-600' },
          { label: 'This Page',     value: alumni.length, color: 'from-blue-500 to-blue-600'  },
          { label: 'Male',          value: maleCount,   color: 'from-sky-500 to-cyan-600'      },
          { label: 'Female',        value: femaleCount, color: 'from-pink-400 to-rose-500'     },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading alumni…</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchAlumni(1)}
              className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : alumni.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="h-7 w-7 text-violet-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {sessionId || search ? 'No alumni match your filters' : 'No alumni records yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {sessionId || search
                ? 'Try selecting a different session or clearing your search.'
                : 'Alumni appear here after students are promoted with graduation status.'}
            </p>
            {(sessionId || search) && (
              <button
                onClick={() => { setSessionId(''); setSearch(''); fetchAlumni(1, { sid: '', q: '' }); }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-violet-600 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 150px 120px 80px' }}>
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Final Class</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reg Number</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {alumni.map(s => {
                const gender = GENDER_META[s.gender ?? ''];
                const fullName = toTitleCase(s.full_name ?? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim());
                const classDisplay = [s.current_class_name, s.current_class_section_name].filter(Boolean).join(' ');

                return (
                  <div key={s.id}
                    className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                    style={{ gridTemplateColumns: '2.5rem 1fr 150px 120px 80px' }}>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {s.image_url ? (
                        <img src={s.image_url} alt={fullName}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-violet-400" />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {gender && (
                          <span className={`px-1.5 py-0 rounded text-[11px] font-semibold border ${gender.bg} ${gender.color} ${gender.border}`}>
                            {gender.label}
                          </span>
                        )}
                        {/* graduation badge */}
                        <span className="px-1.5 py-0 rounded text-[11px] font-semibold border bg-violet-50 text-violet-700 border-violet-100">
                          Graduated
                        </span>
                      </div>
                    </div>

                    {/* Class */}
                    <div className="hidden sm:block min-w-0">
                      <p className="text-sm text-slate-700 font-medium truncate">{classDisplay || '—'}</p>
                    </div>

                    {/* Reg */}
                    <div className="hidden sm:block min-w-0">
                      <span className="text-xs font-mono text-slate-500">{s.registration_number || '—'}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => router.push(`/dashboard/staff/students/${s.id}`)}
                        title="View profile"
                        className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> alumni
                {(sessionId || search) && <span className="ml-1 text-violet-500 font-medium">(filtered)</span>}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchAlumni(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchAlumni(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page ? 'bg-violet-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchAlumni(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

