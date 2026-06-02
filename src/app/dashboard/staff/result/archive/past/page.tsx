'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  History, Search, ArrowLeft, Loader2, AlertCircle, X, Check,
  AlertTriangle, CheckCircle2, Edit3, Eye, RefreshCw,
  TrendingUp, Award, Users, SortAsc, SortDesc, Save,
  FileText, Star, GraduationCap,
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
  result_type: 'score' | 'text' | 'special';
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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
function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
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
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all">
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
          ${error ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50 hover:border-amber-400'}`}
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
  const withScores = rows.filter(r => r.total !== null);
  if (withScores.length === 0) return null;
  const totals = withScores.map(r => r.total as number);
  const highest = Math.max(...totals);
  const lowest = Math.min(...totals);
  const average = Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ArchivePastResultsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const canEdit = user?.is_superuser || hasPermission('result.edit_past_result');

  const [filters, setFilters] = useState<FilterState>({
    session_id: '', period_id: '', class_level_id: '',
    class_section_id: '', class_config_id: '', subject_id: '',
    result_type: 'score',
  });

  const [options, setOptions] = useState({
    sessions: [] as any[], periods: [] as any[],
    classLevels: [] as any[], classSections: [] as any[],
    classConfigs: [] as any[], subjects: [] as any[],
  });

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Score result state
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editScores, setEditScores] = useState<Record<number, Record<string, number | null>>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'name'>('score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Text/special result state
  const [studentList, setStudentList] = useState<StudentListItem[] | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Load filter options ──
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [sessRes, perRes, classLvlRes, classSecRes, classConfRes, subRes] = await Promise.all([
          api.get('/api/school/sessions/'),
          api.get('/api/school/session-periods/'),
          api.get('/api/academic/classes/'),
          api.get('/api/academic/class-sections/'),
          api.get('/api/academic/class-configurations/'),
          api.get('/api/academic/subjects/'),
        ]);
        setOptions({
          sessions: sessRes.data.data?.results || sessRes.data.data || [],
          periods: perRes.data.data?.results || perRes.data.data || [],
          classLevels: classLvlRes.data.data?.results || classLvlRes.data.data || [],
          classSections: classSecRes.data.data?.results || classSecRes.data.data || [],
          classConfigs: classConfRes.data.data?.results || classConfRes.data.data || [],
          subjects: subRes.data.data?.results || subRes.data.data || [],
        });
      } catch (err) {
        showToast('error', 'Failed to load filter options');
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  // ── Auto-resolve class_config_id when class+section changes ──
  useEffect(() => {
    if (filters.class_level_id) {
      const config = options.classConfigs.find(c =>
        String(c.student_class) === filters.class_level_id &&
        (filters.class_section_id ? String(c.class_section) === filters.class_section_id : true)
      );
      setFilters(prev => ({ ...prev, class_config_id: config ? String(config.id) : '' }));
    }
  }, [filters.class_level_id, filters.class_section_id, options.classConfigs]);

  const set = (key: keyof FilterState, val: string) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    // Reset results when filters change
    setSpreadsheet(null);
    setStudentList(null);
    setEditMode(false);
  };

  const filteredClassLevels = options.classLevels;
  const filteredClassSections = filters.class_level_id
    ? options.classSections.filter(s => {
        const configs = options.classConfigs.filter(c => String(c.student_class) === filters.class_level_id);
        return configs.some(c => String(c.class_section) === String(s.id));
      })
    : options.classSections;

  const isScoreType = filters.result_type === 'score';
  const canSearch = filters.session_id && filters.period_id && filters.class_config_id &&
    (isScoreType ? filters.subject_id : true);

  // ── Fetch results ──
  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setSpreadsheet(null);
    setStudentList(null);
    setEditMode(false);

    try {
      if (isScoreType) {
        const res = await api.get('/api/result/archive/get_spreadsheet/', {
          params: {
            session_id: filters.session_id,
            period_id: filters.period_id,
            class_id: filters.class_config_id,
            subject_id: filters.subject_id,
          }
        });
        const data = res.data;
        setSpreadsheet(data);
        // Init edit scores
        const init: Record<number, Record<string, number | null>> = {};
        data.rows.forEach((r: StudentRow) => {
          init[r.student_id] = { ...r.scores };
        });
        setEditScores(init);
      } else {
        const res = await api.get('/api/result/archive/list_students/', {
          params: {
            session_id: filters.session_id,
            period_id: filters.period_id,
            class_id: filters.class_config_id,
            result_type: filters.result_type,
          }
        });
        setStudentList(res.data);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Save edits ──
  const handleSave = async () => {
    setSaving(true);
    setShowConfirm(false);
    try {
      if (!spreadsheet) return;
      // Save each student
      await Promise.all(
        spreadsheet.rows.map(row =>
          api.post('/api/result/archive/update_record/', {
            student_id: row.student_id,
            session_id: filters.session_id,
            period_id: filters.period_id,
            class_id: filters.class_config_id,
            subject_id: filters.subject_id,
            scores: editScores[row.student_id] || {},
          })
        )
      );
      showToast('success', 'Results updated successfully');
      setEditMode(false);
      handleSearch(); // Refresh
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSaving(false);
    }
  };

  // ── Sort rows ──
  const getSortedRows = (rows: StudentRow[]) => {
    const copy = [...rows];
    if (sortBy === 'score') {
      copy.sort((a, b) => sortOrder === 'desc'
        ? (b.total || 0) - (a.total || 0)
        : (a.total || 0) - (b.total || 0));
    } else {
      copy.sort((a, b) => a.student_name.localeCompare(b.student_name));
    }
    return copy;
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  const sortedRows = spreadsheet ? getSortedRows(spreadsheet.rows) : [];
  const subjectName = options.subjects.find(s => String(s.id) === filters.subject_id)?.name || '';
  const sessionName = options.sessions.find(s => String(s.id) === filters.session_id)?.name || '';
  const periodName = options.periods.find(p => String(p.id) === filters.period_id)?.period?.name || options.periods.find(p => String(p.id) === filters.period_id)?.name || '';
  const className = options.classLevels.find(c => String(c.id) === filters.class_level_id)?.name || '';
  const sectionName = options.classSections.find(s => String(s.id) === filters.class_section_id)?.name || '';

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showConfirm && (
        <ConfirmModal
          message="Save changes to all student scores? This will recalculate grades and remarks."
          onConfirm={handleSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <History className="h-5 w-5 text-white" />
            </div>
            Past Results Viewer
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">View and edit archived result records</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Select Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <div>
            <label className={labelCls}>Session <span className="text-red-400 normal-case">*</span></label>
            <select value={filters.session_id} onChange={e => set('session_id', e.target.value)} className={inputCls}>
              <option value="">Select session</option>
              {options.sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Term <span className="text-red-400 normal-case">*</span></label>
            <select value={filters.period_id} onChange={e => set('period_id', e.target.value)} className={inputCls}>
              <option value="">Select term</option>
              {options.periods.map(p => (
                <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Result Type <span className="text-red-400 normal-case">*</span></label>
            <select value={filters.result_type} onChange={e => set('result_type', e.target.value as any)} className={inputCls}>
              <option value="score">Score Based</option>
              <option value="text">Text Based</option>
              <option value="special">Special Needs</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Class <span className="text-red-400 normal-case">*</span></label>
            <select value={filters.class_level_id} onChange={e => set('class_level_id', e.target.value)} className={inputCls}>
              <option value="">Select class</option>
              {filteredClassLevels.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Class Section</label>
            <select
              value={filters.class_section_id}
              onChange={e => set('class_section_id', e.target.value)}
              disabled={!filters.class_level_id || filteredClassSections.length === 0}
              className={inputCls + (!filters.class_level_id ? ' opacity-60 cursor-not-allowed' : '')}
            >
              <option value="">{!filters.class_level_id ? 'Select class first' : 'All sections'}</option>
              {filteredClassSections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {isScoreType && (
            <div>
              <label className={labelCls}>Subject <span className="text-red-400 normal-case">*</span></label>
              <select value={filters.subject_id} onChange={e => set('subject_id', e.target.value)} className={inputCls}>
                <option value="">Select subject</option>
                {options.subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSearch}
            disabled={!canSearch || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-blue-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Load Results
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading archived results…</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SCORE RESULT TABLE
      ══════════════════════════════════════════════════════ */}
      {!loading && spreadsheet && (
        <div className="space-y-4">

          {/* Context bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {subjectName} · {className}{sectionName ? ` ${sectionName}` : ''}
              </p>
              <p className="text-xs text-slate-400">{sessionName} · {periodName} · {spreadsheet.rows.length} students</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sort toggle */}
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => { setSortBy('name'); setSortOrder('asc'); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sortBy === 'name' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  By Name
                </button>
                <button
                  onClick={() => {
                    if (sortBy === 'score') setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
                    else { setSortBy('score'); setSortOrder('desc'); }
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${sortBy === 'score' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  By Score
                  {sortBy === 'score' && (sortOrder === 'desc' ? <SortDesc className="h-3 w-3" /> : <SortAsc className="h-3 w-3" />)}
                </button>
              </div>

              <button onClick={handleSearch}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>

              {canEdit && !editMode && (
                <button
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors shadow-sm shadow-amber-200"
                >
                  <Edit3 className="h-4 w-4" /> Edit Results
                </button>
              )}

              {editMode && (
                <>
                  <button
                    onClick={() => { setEditMode(false); setEditScores({}); handleSearch(); }}
                    className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-sm shadow-emerald-200"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <StatsBar rows={spreadsheet.rows} />

          {/* Edit mode banner */}
          {editMode && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <Edit3 className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Edit mode active</span>
              <span className="text-amber-600">— Scores are validated against original max values. Grades recalculate on save.</span>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full min-w-[700px]">
                  <thead className="sticky top-0 z-20">
                    <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      <th className="sticky left-0 bg-gradient-to-r from-blue-600 to-indigo-600 z-30 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide min-w-[220px] rounded-tl-2xl">
                        Student
                      </th>
                      {spreadsheet.fields.map(field => (
                        <th key={field.name} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{field.name}</span>
                            <span className="text-blue-200 text-[10px] font-normal">/{field.max_mark}</span>
                          </div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide bg-emerald-600 whitespace-nowrap">
                        Total
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                        Grade
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap rounded-tr-2xl">
                        Remark
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedRows.map((student, idx) => (
                      <tr key={student.student_id} className={`transition-colors ${
                        idx % 2 === 0 ? 'bg-white hover:bg-blue-50/30' : 'bg-slate-50/30 hover:bg-blue-50/30'
                      } ${editMode ? 'bg-amber-50/20' : ''}`}>
                        <td className="sticky left-0 z-10 px-4 py-3 bg-inherit">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-5 flex-shrink-0">{idx + 1}.</span>
                            <img
                              src={student.image || '/images/default-avatar.png'}
                              alt={student.student_name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200 flex-shrink-0"
                              onError={e => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate max-w-[160px]">{student.student_name}</p>
                              <p className="text-[10px] font-mono text-slate-400 uppercase">{student.reg_number}</p>
                            </div>
                          </div>
                        </td>

                        {spreadsheet.fields.map(field => (
                          <td key={field.name} className="px-3 py-2 text-center">
                            {editMode ? (
                              <ScoreInput
                                value={editScores[student.student_id]?.[field.name] ?? null}
                                maxMark={field.max_mark}
                                onChange={val => setEditScores(prev => ({
                                  ...prev,
                                  [student.student_id]: {
                                    ...prev[student.student_id],
                                    [field.name]: val,
                                  }
                                }))}
                              />
                            ) : (
                              <span className="text-sm text-slate-700">
                                {student.scores[field.name] !== null && student.scores[field.name] !== undefined
                                  ? student.scores[field.name]
                                  : '—'}
                              </span>
                            )}
                          </td>
                        ))}

                        <td className="px-3 py-2 text-center bg-emerald-50/50">
                          <span className="text-sm font-bold text-emerald-700">
                            {student.total !== null ? student.total : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-sm font-semibold text-slate-800">{student.grade || '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="text-sm text-slate-600">{student.remark || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {spreadsheet.rows.length} student{spreadsheet.rows.length !== 1 ? 's' : ''} · Archived result
              </p>
              {editMode && (
                <p className="text-xs text-amber-600 font-medium">Unsaved changes</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TEXT / SPECIAL STUDENT LIST
      ══════════════════════════════════════════════════════ */}
      {!loading && studentList && (
        <div className="space-y-4">

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {className}{sectionName ? ` ${sectionName}` : ''} · {filters.result_type === 'special' ? 'Special Needs' : 'Text Based'}
              </p>
              <p className="text-xs text-slate-400">{sessionName} · {periodName} · {studentList.length} students</p>
            </div>
            <button onClick={handleSearch}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {studentList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-7 w-7 text-slate-300" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No results found</h3>
              <p className="text-sm text-slate-400">No archived results match the selected filters.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_120px_100px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
              </div>

              <div className="divide-y divide-slate-50">
                {studentList.map((student, idx) => (
                  <div key={student.student_id}
                    className="flex sm:grid sm:grid-cols-[1fr_120px_100px] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-slate-400 w-5 flex-shrink-0">{idx + 1}.</span>
                      <img
                        src={student.image || '/images/default-avatar.png'}
                        alt={student.name}
                        className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{student.name}</p>
                        <p className="text-[10px] font-mono text-slate-400 uppercase">{student.reg_number}</p>
                      </div>
                    </div>

                    <div>
                      {student.has_result ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Result found
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> No result
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => router.push(
                          `/dashboard/staff/result/archive/past/student?student_id=${student.student_id}&session_id=${filters.session_id}&period_id=${filters.period_id}&class_id=${filters.class_config_id}&result_type=${filters.result_type}`
                        )}
                        disabled={!student.has_result}
                        title="View result"
                        className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => router.push(
                            `/dashboard/staff/result/archive/past/student?student_id=${student.student_id}&session_id=${filters.session_id}&period_id=${filters.period_id}&class_id=${filters.class_config_id}&result_type=${filters.result_type}&edit=true`
                          )}
                          disabled={!student.has_result}
                          title="Edit result"
                          className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
                <p className="text-xs text-slate-400">
                  {studentList.filter(s => s.has_result).length} of {studentList.length} students have results
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}