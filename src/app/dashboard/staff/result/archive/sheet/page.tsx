'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI, resultArchiveAPI } from '@/lib/api';
import {
  Search, ArrowLeft, Loader2, AlertCircle, X,
  AlertTriangle, CheckCircle2, Eye, RefreshCw,
  FileText, Users, Settings2, BookOpen
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentListItem {
  student_id?: number;
  id?: number;
  name?: string;
  student_name?: string;
  reg_number: string;
  image?: string | null;
  has_result: boolean;
  average_score?: number | null;
  total_score?: number | null;
}

interface FilterState {
  session_id: string;
  period_id: string;
  class_level_id: string;
  class_section_id: string;
  class_config_id: string;
  result_type: 'score' | 'text' | 'combined' | '';
  term_type: 'end_of_term' | 'midterm';
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
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
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

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function ResultSheetViewerPage() {
  const router = useRouter();

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
    class_section_id: '', class_config_id: '', result_type: '', term_type: 'end_of_term',
  });

  const [options, setOptions] = useState({
    sessions: [] as any[], periods: [] as any[],
    classLevels: [] as any[], classSections: [] as any[],
    classConfigs: [] as any[],
  });

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);

  // Data state
  const [studentList, setStudentList] = useState<StudentListItem[] | null>(null);

  // ── 1. Initial Data Fetch & Auto-Select ──
  useEffect(() => {
    const fetchDefaults = async () => {
      try {
        const [sessions, classLevels, classSections, classConfigs, currentSession] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicAPI.listClasses(),
          academicAPI.listClassSections(),
          academicAPI.listClassConfigurations(),
          academicCalendarAPI.getCurrentSession().catch(() => null),
        ]);

        const currentSessionId = currentSession?.id ? String(currentSession.id) : '';

        setOptions({
          sessions,
          periods: [],
          classLevels,
          classSections,
          classConfigs,
        });

        // Auto-select session and term
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
      }

      setFilters(prev => ({
        ...prev,
        class_config_id: newConfigId,
        result_type: newResultType,
      }));
    } else {
      // Wipe config resolution if selection is incomplete
      setFilters(prev => ({
        ...prev,
        class_config_id: '',
        result_type: '',
      }));
    }
  }, [filters.class_level_id, filters.class_section_id, options.classConfigs, options.classLevels]);

  const handleClassLevelChange = (levelId: string) => {
    setFilters(prev => ({
      ...prev,
      class_level_id: levelId,
      class_section_id: '',
      class_config_id: '',
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

  const set = (key: keyof FilterState, val: string) => setFilters(prev => ({ ...prev, [key]: val }));

  const canSearch = filters.session_id && filters.period_id && filters.class_config_id && filters.result_type;

  // ── 3. Fetch Data ──
  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setStudentList(null);

    try {
      // FIX: Use listStudents instead of the non-existent pastClassList endpoint
      const res = await resultArchiveAPI.listStudents({
        session_id: Number(filters.session_id),
        period_id: Number(filters.period_id),
        class_id: Number(filters.class_config_id),
        result_type: filters.result_type,
      });

      const data = res.data?.results || res.data || res;
      setStudentList(data);
      setStep(2);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewSheet = (studentId: number) => {
    if (!studentList) return;
    // Build a comma-separated list of ALL student IDs in this class to pass to the preview page
    // This allows the teacher to click "Next" / "Prev" through the whole class seamlessly!
    const allStudentIds = studentList.map(s => s.student_id || s.id).join(',');

    router.push(
      `/dashboard/staff/result/print/preview?student=${studentId}&period=${filters.period_id}&type=${filters.term_type}&students=${allStudentIds}`
    );
  };

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  const sessObj = options.sessions.find(s => String(s.id) === filters.session_id);
  const sessionName = sessObj ? (sessObj.name || `${sessObj.start_year}/${sessObj.end_year}`) : '';
  const periodName = options.periods.find(p => String(p.id) === filters.period_id)?.period?.name || options.periods.find(p => String(p.id) === filters.period_id)?.name || '';
  const className = options.classLevels.find(c => String(c.id) === filters.class_level_id)?.name || '';
  const sectionName = options.classSections.find(s => String(s.id) === filters.class_section_id)?.name || '';

  return (
    <div className="max-w-[85rem] mx-auto pb-20 px-4 pt-6 min-h-screen">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="mb-6 print:hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 rounded-2xl px-5 py-4 md:px-7 md:py-5 shadow-lg shadow-slate-300/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-900/30 flex-shrink-0">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-teal-300 uppercase tracking-widest truncate">Result Archive</p>
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">Result Sheet Viewer</h1>
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
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-600" />

          <div className="flex items-center mb-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
               <span className="w-7 h-7 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm shadow-teal-200">
                 <Search className="w-3.5 h-3.5 text-white" />
               </span>
               Locate Class Roster
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
                <option value="combined">Combined</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Term Type (Report Card) <span className="text-red-400 normal-case">*</span></label>
              <select value={filters.term_type} onChange={e => set('term_type', e.target.value as any)} className={inputCls}>
                <option value="end_of_term">End of Term Report</option>
                <option value="midterm">Midterm Report</option>
              </select>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end">
            <button onClick={handleSearch} disabled={!canSearch || loading} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold rounded-xl hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-md shadow-teal-200">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Fetch Class Roster
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: REPORT DISPLAY ── */}
      {step === 2 && studentList && (
        <div className="animate-in fade-in slide-in-from-bottom-6 max-w-7xl mx-auto space-y-4">

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-teal-600" />
                    {className}{sectionName ? ` ${sectionName}` : ''}
                 </h3>
                 <p className="text-xs text-slate-500 mt-1">{sessionName} · {periodName} · {filters.term_type === 'midterm' ? 'Midterm' : 'End of Term'} · {studentList.length} records found</p>
               </div>
               <button onClick={handleSearch} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors self-end sm:self-auto">
                 <RefreshCw className="h-4 w-4" />
               </button>
             </div>

             {studentList.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No students found matching these criteria.</p>
                </div>
             ) : (
               <div className="divide-y divide-slate-100">
                  {studentList.map((student, idx) => {
                    // Normalize the backend keys depending on which endpoint was hit
                    const sId = student.student_id || student.id;
                    const sName = student.name || student.student_name || 'Unknown';
                    const avg = student.average_score;

                    return (
                      <div key={sId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-400 w-5">{idx + 1}.</span>
                          <img src={getStudentImage(student.image)} alt={sName} className="w-10 h-10 rounded-full object-cover border border-slate-200" onError={e => {(e.target as HTMLImageElement).src = '/images/default-avatar.png';}} />
                          <div>
                            <p className="text-sm font-bold text-slate-800">{sName}</p>
                            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{student.reg_number}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {student.has_result ? (
                            <div className="flex items-center gap-3">
                                {avg !== undefined && avg !== null && (
                                   <span className="hidden sm:inline-flex text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded-md">
                                     {Number(avg).toFixed(1)}% AVG
                                   </span>
                                )}
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-full border border-emerald-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Result Archived
                                </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> No Record
                            </span>
                          )}

                          <button
                            onClick={() => sId && handlePreviewSheet(sId)}
                            disabled={!student.has_result}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800 text-xs font-bold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-teal-100 uppercase tracking-wider"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Sheet
                          </button>
                        </div>
                      </div>
                    );
                  })}
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}