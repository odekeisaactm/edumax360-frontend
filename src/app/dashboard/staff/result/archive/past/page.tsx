'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI, resultArchiveAPI } from '@/lib/api';
import {
  History, Search, ArrowLeft, Loader2, AlertCircle, X,
  AlertTriangle, CheckCircle2, Edit3, Eye, RefreshCw,
  TrendingUp, Award, Users, SortAsc, SortDesc, Save,
  Settings2, BookOpen
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Field {
  name: string;
  max_mark: number;
}

interface StudentRow {
  student_id: number;
  student_name: string;
  reg_number: string;
  image?: string | null;
  scores: Record<string, number | null>;
  total: number | null;
  grade: string | null;
  remark?: string | null;
  position?: number | null;
}

interface SpreadsheetData {
  fields: Field[];
  rows: StudentRow[];
}

interface StudentListItem {
  student_id: number;
  name: string;
  reg_number: string;
  image?: string | null;
  has_result: boolean;
}

interface FilterState {
  session_id: string;
  period_id: string;
  class_level_id: string;
  class_section_id: string;
  class_config_id: string;
  subject_id: string;
  result_type: 'score' | 'text' | 'special' | '';
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function getStudentImage(imgUrl?: string | null) {
  if (!imgUrl || imgUrl.trim() === '') return '/images/default-avatar.png';
  if (imgUrl.startsWith('http')) return imgUrl;
  return `${API_BASE_URL}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-indigo-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
          : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 animate-in zoom-in-95">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Confirm Save</h3>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Score Input (edit mode) ──────────────────────────────────────────────────
function ScoreInput({ value, maxMark, onChange }: {
  value: number | null;
  maxMark: number;
  onChange: (val: number | null) => void;
}) {
  const [local, setLocal] = useState(value !== null ? String(value) : '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocal(value !== null ? String(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocal(raw);
    setError(null);
    if (raw === '') { onChange(null); return; }
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    if (num < 0) { setError(`Min 0`); return; }
    if (num > maxMark) { setError(`Max ${maxMark}`); return; }
    onChange(num);
  };

  const handleBlur = () => {
    if (local === '') { onChange(null); return; }
    const num = parseFloat(local);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(num, 0), maxMark);
      setLocal(String(clamped));
      onChange(clamped);
    } else {
      setLocal('');
      onChange(null);
    }
    setError(null);
  };

  return (
    <div className="relative">
      <input
        type="number"
        step="1"
        min="0"
        max={maxMark}
        value={local}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-20 px-2 py-1.5 text-sm text-center border rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none transition-colors
          ${error ? 'border-red-400 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 hover:border-amber-400 text-amber-900 font-medium'}`}
        placeholder="—"
      />
      {error && (
        <div className="absolute -top-6 left-0 text-[10px] text-red-500 whitespace-nowrap bg-red-50 border border-red-200 px-1.5 py-0.5 rounded z-10">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatsBar({ rows }: { rows: StudentRow[] }) {
  if (!rows || !Array.isArray(rows)) return null;
  const withScores = rows.filter(r => r.total !== null);
  if (withScores.length === 0) return null;
  const totals = withScores.map(r => r.total as number);
  const highest = Math.max(...totals);
  const lowest = Math.min(...totals);
  const average = Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
      {[
        { label: 'Highest', value: highest, icon: TrendingUp, color: 'from-emerald-50 to-teal-50 border-emerald-100', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', textColor: 'text-emerald-700' },
        { label: 'Lowest', value: lowest, icon: TrendingUp, color: 'from-amber-50 to-orange-50 border-amber-100', iconBg: 'bg-amber-100', iconColor: 'text-amber-600 rotate-180', textColor: 'text-amber-700' },
        { label: 'Average', value: average, icon: Award, color: 'from-blue-50 to-indigo-50 border-blue-100', iconBg: 'bg-blue-100', iconColor: 'text-blue-600', textColor: 'text-blue-700' },
        { label: 'Students', value: withScores.length, icon: Users, color: 'from-violet-50 to-purple-50 border-violet-100', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', textColor: 'text-violet-700' },
      ].map(({ label, value, icon: Icon, color, iconBg, iconColor, textColor }) => (
        <div key={label} className={`bg-gradient-to-br ${color} rounded-xl p-3 border`}>
          <div className="flex items-center justify-between">
            <div className={`w-7 h-7 ${iconBg} rounded-lg flex items-center justify-center`}>
              <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
            </div>
            <span className={`text-xl font-bold ${textColor}`}>{value}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function ArchivePastResultsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const canEdit = user?.is_superuser || hasPermission('result.edit_past_result');

  const [step, setStep] = useState<1 | 2>(1);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const [filters, setFilters] = useState<FilterState>({
    session_id: '', period_id: '', class_level_id: '',
    class_section_id: '', class_config_id: '', subject_id: '', result_type: '',
  });

  const [options, setOptions] = useState({
    sessions: [] as any[], periods: [] as any[],
    classLevels: [] as any[], classSections: [] as any[],
    classConfigs: [] as any[], allSubjects: [] as any[], classSubjects: [] as any[],
  });

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  // Result state
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetData | null>(null);
  const [studentList, setStudentList] = useState<StudentListItem[] | null>(null);

  // Edit State
  const [editMode, setEditMode] = useState(false);
  const [editScores, setEditScores] = useState<Record<number, Record<string, number | null>>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Sort State
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // ── 1. Initial Data Fetch & Auto-Select ──
  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const [sessions, classLevels, classSections, classConfigs, allSubjects, currentSession] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicAPI.listClasses(),
          academicAPI.listClassSections(),
          academicAPI.listClassConfigurations(),
          academicAPI.listSubjects(),
          academicCalendarAPI.getCurrentSession().catch(() => null),
        ]);

        const currentSessionId = currentSession?.id ? String(currentSession.id) : '';

        setOptions({
          sessions,
          periods: [],
          classLevels,
          classSections,
          classConfigs,
          allSubjects,
          classSubjects: [],
        });

        // Auto-select session
        if (currentSessionId) {
          setFilters(prev => ({ ...prev, session_id: currentSessionId }));
          const periods = await academicCalendarAPI.listSessionPeriods({ session_id: Number(currentSessionId) });
          setOptions(prev => ({ ...prev, periods }));

          try {
            const curPerRes = await academicCalendarAPI.getCurrentPeriod();
            if (curPerRes?.id) {
              setFilters(prev => ({ ...prev, session_id: currentSessionId, period_id: String(curPerRes.id) }));
            }
          } catch(e) {}
        }
      } catch (err) {
        showToast('error', 'Failed to load filter options');
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchDefaults();
  }, [showToast]);

  // ── 2. Handle Cascading Updates ──
  // Fetch periods when session changes
  const handleSessionChange = async (sessionId: string) => {
    setFilters(prev => ({ ...prev, session_id: sessionId, period_id: '' }));
    if (!sessionId) {
       setOptions(prev => ({ ...prev, periods: [] }));
       return;
    }
    const periods = await academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionId) });
    setOptions(prev => ({ ...prev, periods }));
  };

  // Resolve config and class subjects when class/section explicitly changes
  useEffect(() => {
    if (filters.class_level_id && filters.class_section_id) {
      const config = options.classConfigs.find(c =>
        String(c.student_class) === filters.class_level_id &&
        String(c.class_section) === filters.class_section_id
      );

      const newConfigId = config ? String(config.id) : '';
      let newResultType = filters.result_type;

      if (config) {
        const clsModel = options.classLevels.find(l => String(l.id) === filters.class_level_id);
        if (clsModel?.result_type) {
           newResultType = clsModel.result_type === 'mix' ? 'score' : clsModel.result_type;
        }

        // Fetch subjects correctly using the proper endpoint
        academicAPI.listClassSubjectConfigurations({ class_configuration_id: Number(newConfigId) })
          .then(configs => {
            const activeSubjIds = configs.map((c: any) => typeof c.subject === 'object' ? c.subject?.id : c.subject);
            const cleanSubs = options.allSubjects.filter(s => activeSubjIds.includes(s.id));
            setOptions(prev => ({ ...prev, classSubjects: cleanSubs }));
          })
          .catch(() => setOptions(prev => ({ ...prev, classSubjects: [] })));
      } else {
        setOptions(prev => ({ ...prev, classSubjects: [] }));
      }

      setFilters(prev => ({
        ...prev,
        class_config_id: newConfigId,
        result_type: newResultType,
        subject_id: ''
      }));
    } else {
      // If either level or section is missing, wipe config resolution
      setFilters(prev => ({
        ...prev,
        class_config_id: '',
        result_type: '',
        subject_id: ''
      }));
      setOptions(prev => ({ ...prev, classSubjects: [] }));
    }
  }, [filters.class_level_id, filters.class_section_id, options.classConfigs, options.classLevels, options.allSubjects]);

  const handleClassLevelChange = (levelId: string) => {
    setFilters(prev => ({
      ...prev,
      class_level_id: levelId,
      class_section_id: '',
      class_config_id: '',
      subject_id: '',
      result_type: ''
    }));
  };

  const filteredClassLevels = options.classLevels;

  const filteredClassSections = filters.class_level_id
    ? options.classSections.filter(s => {
        const configs = options.classConfigs.filter(c => String(c.student_class) === filters.class_level_id);
        return configs.some(c => String(c.class_section) === String(s.id));
      })
    : options.classSections;

  const isScoreType = filters.result_type === 'score' || filters.result_type === 'combined';
  const displayedSubjects = showAllSubjects ? options.allSubjects : options.classSubjects;

  const set = (key: keyof FilterState, val: string) => setFilters(prev => ({ ...prev, [key]: val }));

  const canSearch = filters.session_id && filters.period_id && filters.class_config_id && filters.result_type &&
    (isScoreType ? filters.subject_id : true);

  // ── 3. Fetch Data ──
  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setSpreadsheet(null);
    setStudentList(null);
    setEditMode(false);
    setEditScores({});

    try {
      if (isScoreType) {
        const res = await resultArchiveAPI.getSpreadsheet({
          session_id: filters.session_id,
          period_id: filters.period_id,
          class_id: filters.class_config_id,
          subject_id: filters.subject_id,
        });

        const data = res.data || res;
        setSpreadsheet(data);

        // Initialize Edit State using proper fields
        const init: Record<number, Record<string, number | null>> = {};
        if (data.rows && Array.isArray(data.rows)) {
           data.rows.forEach((r: StudentRow) => { init[r.student_id] = { ...r.scores }; });
        }
        setEditScores(init);
        setStep(2);
      } else {
        const res = await resultArchiveAPI.listStudents({
          session_id: filters.session_id,
          period_id: filters.period_id,
          class_id: filters.class_config_id,
          result_type: filters.result_type,
        });

        const data = res.data?.results || res.data || res;
        setStudentList(data);
        setStep(2);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── 4. Bulk Save ──
  const handleBulkSave = async () => {
    setSaving(true);
    try {
      if (!spreadsheet || !spreadsheet.rows) return;

      const payloadArray = spreadsheet.rows.map(row => ({
         student_id: row.student_id,
         scores: editScores[row.student_id] || {}
      }));

      await resultArchiveAPI.bulkUpdateRecords({
        session_id: filters.session_id,
        period_id: filters.period_id,
        class_id: filters.class_config_id,
        subject_id: filters.subject_id,
        student_scores: payloadArray
      });

      showToast('success', 'Past results updated successfully');
      setShowConfirm(false);
      setEditMode(false);
      handleSearch(); // Fetch fresh data to get correct grades & remarks
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSaving(false);
    }
  };

  const getSortedRows = (rows: StudentRow[] | undefined) => {
    if (!rows || !Array.isArray(rows)) return [];
    const copy = [...rows];
    if (sortBy === 'score') {
      copy.sort((a, b) => sortOrder === 'desc' ? (b.total || 0) - (a.total || 0) : (a.total || 0) - (b.total || 0));
    } else {
      copy.sort((a, b) => a.student_name.localeCompare(b.student_name));
    }
    return copy;
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  const sortedRows = spreadsheet ? getSortedRows(spreadsheet.rows) : [];
  const subjectName = options.allSubjects.find(s => String(s.id) === filters.subject_id)?.name || '';

  const sessObj = options.sessions.find(s => String(s.id) === filters.session_id);
  const sessionName = sessObj ? (sessObj.name || `${sessObj.start_year}/${sessObj.end_year} Session`) : '';

  const periodName = options.periods.find(p => String(p.id) === filters.period_id)?.period?.name || options.periods.find(p => String(p.id) === filters.period_id)?.name || '';
  const className = options.classLevels.find(c => String(c.id) === filters.class_level_id)?.name || '';
  const sectionName = options.classSections.find(s => String(s.id) === filters.class_section_id)?.name || '';

  return (
    <div className="max-w-[85rem] mx-auto pb-20 px-4 pt-6 min-h-screen">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showConfirm && (
        <ConfirmModal
          message="Save changes to all student scores? This will permanently overwrite archival data and recalculate grades."
          onConfirm={handleBulkSave}
          onCancel={() => setShowConfirm(false)}
          loading={saving}
        />
      )}

      {/* ── Page Header ── */}
      <div className="mb-6 print:hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-2xl px-5 py-4 md:px-7 md:py-5 shadow-lg shadow-slate-300/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-900/30 flex-shrink-0">
                <History className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest truncate">Result Archive</p>
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">Past Results Viewer</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {step === 2 && (
                <button onClick={() => setStep(1)} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold transition-all flex items-center gap-2 text-xs border border-white/10">
                  <Settings2 className="w-4 h-4" /> Reconfigure Filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── STEP 1: FILTERS ── */}
      {step === 1 && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in max-w-4xl mx-auto overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-600" />

          <div className="flex items-center mb-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
               <span className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-indigo-200">
                 <Search className="w-3.5 h-3.5 text-white" />
               </span>
               Locate Archived Record
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Session <span className="text-red-400 normal-case">*</span></label>
              <select value={filters.session_id} onChange={e => handleSessionChange(e.target.value)} className={inputCls} disabled={loadingOptions}>
                <option value="">Select session</option>
                {options.sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Term <span className="text-red-400 normal-case">*</span></label>
              <select value={filters.period_id} onChange={e => set('period_id', e.target.value)} className={inputCls} disabled={!filters.session_id}>
                <option value="">Select term</option>
                {options.periods.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Class Level <span className="text-red-400 normal-case">*</span></label>
              <select value={filters.class_level_id} onChange={e => handleClassLevelChange(e.target.value)} className={inputCls}>
                <option value="">Select class</option>
                {filteredClassLevels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Class Section <span className="text-red-400 normal-case">*</span></label>
              <select value={filters.class_section_id} onChange={e => set('class_section_id', e.target.value)} disabled={!filters.class_level_id || filteredClassSections.length === 0} className={inputCls + (!filters.class_level_id ? ' opacity-60 cursor-not-allowed' : '')}>
                <option value="">{!filters.class_level_id ? 'Select class first' : 'Select section'}</option>
                {filteredClassSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Result Type <span className="text-red-400 normal-case">*</span></label>
              <select value={filters.result_type} onChange={e => set('result_type', e.target.value as any)} className={inputCls} disabled={!filters.class_level_id}>
                <option value="">Select type</option>
                <option value="score">Score Based</option>
                <option value="text">Text Based</option>
                <option value="special">Special Needs</option>
              </select>
            </div>

            {isScoreType && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject <span className="text-red-400 normal-case">*</span></label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={showAllSubjects} onChange={e => setShowAllSubjects(e.target.checked)} className="w-3 h-3 accent-indigo-600" />
                    <span className="text-[10px] text-slate-400 font-medium">Show all</span>
                  </label>
                </div>
                <select value={filters.subject_id} onChange={e => set('subject_id', e.target.value)} className={inputCls}>
                  <option value="">Select subject</option>
                  {displayedSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end">
            <button onClick={handleSearch} disabled={!canSearch || loading} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-200">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Fetch Archive Data
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: REPORT DISPLAY ── */}
      {step === 2 && (
        <div className="animate-in fade-in slide-in-from-bottom-6 max-w-7xl mx-auto space-y-4">

          {/* ════ SCORE TYPE ════ */}
          {isScoreType && spreadsheet && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm print:hidden">
                <div>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-500"/>
                    {subjectName} · {className}{sectionName ? ` ${sectionName}` : ''}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">{sessionName} · {periodName} · {(spreadsheet.rows || []).length} records</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button onClick={() => { setSortBy('name'); setSortOrder('asc'); }} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors uppercase tracking-wider ${sortBy === 'name' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>By Name</button>
                    <button onClick={() => { if (sortBy === 'score') setSortOrder(o => o === 'desc' ? 'asc' : 'desc'); else { setSortBy('score'); setSortOrder('desc'); } }} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors flex items-center gap-1 uppercase tracking-wider ${sortBy === 'score' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>
                      By Score {sortBy === 'score' && (sortOrder === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />)}
                    </button>
                  </div>

                  {(spreadsheet.rows || []).length > 0 && canEdit && !editMode && (
                    <button onClick={() => setEditMode(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm shadow-amber-200 uppercase tracking-wider">
                      <Edit3 className="h-3.5 w-3.5" /> Edit Mode
                    </button>
                  )}

                  {editMode && (
                    <>
                      <button onClick={() => { setEditMode(false); setEditScores({}); handleSearch(); }} className="px-4 py-2 text-xs font-bold uppercase tracking-wider border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                      <button onClick={() => setShowConfirm(true)} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-sm uppercase tracking-wider">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                      </button>
                    </>
                  )}
                </div>
              </div>

              <StatsBar rows={spreadsheet.rows || []} />

              {editMode && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 animate-in fade-in print:hidden">
                  <Edit3 className="h-4 w-4 flex-shrink-0" />
                  <span className="font-bold uppercase tracking-wider">Historical Edit Active</span>
                  <span className="text-amber-600">— Scores are validated against origin max values. Grades recalculate automatically on save.</span>
                </div>
              )}

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print-shadow-none">
                {(!spreadsheet.rows || spreadsheet.rows.length === 0) ? (
                  <div className="py-16 text-center">
                    <History className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No archived records found for this subject.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                        <tr>
                          <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky left-0 z-30 bg-slate-50 border-r border-slate-100 min-w-[200px]">Student</th>
                          {spreadsheet.fields.map(field => (
                            <th key={field.name} className="px-3 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider border-l border-slate-100">
                              {field.name} <span className="text-slate-400 block text-[9px] print:hidden">/ {field.max_mark}</span>
                            </th>
                          ))}
                          <th className="px-4 py-3 text-[10px] font-bold text-indigo-700 uppercase tracking-wider text-center border-l border-slate-200 bg-indigo-50/50">Total</th>
                          {!editMode && (
                            <>
                              <th className="px-4 py-3 text-[10px] font-bold text-indigo-700 uppercase tracking-wider text-center bg-indigo-50/50">Grade</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-indigo-700 uppercase tracking-wider text-center bg-indigo-50/50">Rmk</th>
                              <th className="px-4 py-3 text-[10px] font-bold text-indigo-700 uppercase tracking-wider text-center bg-indigo-50/50">Pos</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedRows.map((student, idx) => (
                          <tr key={student.student_id} className={`hover:bg-slate-50/50 transition-colors ${editMode ? 'bg-amber-50/10' : ''}`}>
                            <td className="px-4 py-3 sticky left-0 z-10 bg-inherit border-r border-slate-100">
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-slate-400 w-4">{idx + 1}.</span>
                                <img src={getStudentImage(student.image)} alt={student.student_name} className="w-8 h-8 rounded-full object-cover border border-slate-200 print:hidden" onError={e => {(e.target as HTMLImageElement).src = '/images/default-avatar.png';}} />
                                <div>
                                  <p className="text-xs font-bold text-slate-800 leading-tight">{student.student_name}</p>
                                  <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">{student.reg_number}</p>
                                </div>
                              </div>
                            </td>
                            {spreadsheet.fields.map(field => (
                              <td key={field.name} className="px-3 py-2 text-center border-l border-slate-100">
                                {editMode ? (
                                  <ScoreInput value={editScores[student.student_id]?.[field.name] ?? null} maxMark={field.max_mark} onChange={val => setEditScores(prev => ({...prev, [student.student_id]: {...prev[student.student_id], [field.name]: val}}))} />
                                ) : (
                                  <span className="text-sm font-semibold text-slate-600">{student.scores[field.name] !== null && student.scores[field.name] !== undefined ? student.scores[field.name] : '—'}</span>
                                )}
                              </td>
                            ))}
                            <td className="px-4 py-2 text-center font-bold text-indigo-900 border-l border-slate-200 bg-indigo-50/20">
                              {editMode ? (
                                Object.values(editScores[student.student_id] || {}).reduce((sum, val) => sum + (val !== null ? Number(val) : 0), 0)
                              ) : (
                                student.total !== null ? student.total : '—'
                              )}
                            </td>
                            {!editMode && (
                              <>
                                <td className="px-4 py-2 text-center font-bold text-slate-700 bg-indigo-50/20 uppercase">{student.grade || '—'}</td>
                                <td className="px-4 py-2 text-center text-xs font-medium text-slate-600 bg-indigo-50/20 uppercase">{student.remark || '—'}</td>
                                <td className="px-4 py-2 text-center text-xs font-bold text-slate-500 bg-indigo-50/20">{student.position || '—'}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ════ TEXT / SPECIAL TYPE ════ */}
          {!isScoreType && studentList && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden print-shadow-none">
               <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between print:hidden">
                 <div>
                   <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">{className}{sectionName ? ` ${sectionName}` : ''} · {filters.result_type === 'special' ? 'Special Needs' : 'Text Based'}</h3>
                   <p className="text-xs text-slate-400 mt-1">{sessionName} · {periodName} · {studentList.length} students</p>
                 </div>
               </div>

               {studentList.length === 0 ? (
                  <div className="py-16 text-center">
                    <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">No students found matching these criteria.</p>
                  </div>
               ) : (
                 <div className="divide-y divide-slate-100">
                    {studentList.map((student, idx) => (
                      <div key={student.student_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 w-5">{idx + 1}.</span>
                          <img src={getStudentImage(student.image)} alt={student.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 print:hidden" onError={e => {(e.target as HTMLImageElement).src = '/images/default-avatar.png';}} />
                          <div>
                            <p className="text-sm font-bold text-slate-800">{student.name}</p>
                            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{student.reg_number}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 print:hidden">
                          {student.has_result ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Result Archived
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> No Record
                            </span>
                          )}

                          <div className="flex gap-2">
                             <button onClick={() => router.push(`/dashboard/staff/result/archive/past/student?student_id=${student.student_id}&session_id=${filters.session_id}&period_id=${filters.period_id}&class_id=${filters.class_config_id}&result_type=${filters.result_type}`)} disabled={!student.has_result} className="p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-30">
                               <Eye className="w-4 h-4" />
                             </button>
                             {canEdit && (
                               <button onClick={() => router.push(`/dashboard/staff/result/archive/past/student?student_id=${student.student_id}&session_id=${filters.session_id}&period_id=${filters.period_id}&class_id=${filters.class_config_id}&result_type=${filters.result_type}&edit=true`)} disabled={!student.has_result} className="p-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-30">
                                 <Edit3 className="w-4 h-4" />
                               </button>
                             )}
                          </div>
                        </div>
                      </div>
                    ))}
                 </div>
               )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}