'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, academicAPI, academicCalendarAPI } from '@/lib/api';
import {
  Search, ArrowLeft, Loader2, AlertCircle, X,
  AlertTriangle, CheckCircle2, Eye, RefreshCw,
  Layers, Users, Settings2, BookOpen, GraduationCap, Box
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

export default function CumulativeSelectionPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const [filters, setFilters] = useState({
    session_id: '', class_level_id: '', class_section_id: '', class_config_id: ''
  });

  const [options, setOptions] = useState({
    sessions: [] as any[], classLevels: [] as any[],
    classSections: [] as any[], classConfigs: [] as any[],
  });

  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // ── 1. Initial Data Fetch ──
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

        setOptions({ sessions, classLevels, classSections, classConfigs });

        if (currentSession?.id) {
          setFilters(prev => ({ ...prev, session_id: String(currentSession.id) }));
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
  useEffect(() => {
    if (filters.class_level_id && filters.class_section_id) {
      const config = options.classConfigs.find(c =>
        String(c.student_class) === filters.class_level_id &&
        String(c.class_section) === filters.class_section_id
      );
      setFilters(prev => ({ ...prev, class_config_id: config ? String(config.id) : '' }));
    } else {
      setFilters(prev => ({ ...prev, class_config_id: '' }));
    }
  }, [filters.class_level_id, filters.class_section_id, options.classConfigs]);

  const canSearch = filters.session_id && filters.class_level_id && filters.class_section_id;

  // ── 3. Fetch Data ──
  const handleSearch = async () => {
    if (!canSearch) return;
    setLoading(true);
    setData(null);

    try {
      // Use the session-broadsheet to get all students and their cumulative averages efficiently!
      const res = await api.get('/api/result/spreadsheet/session-broadsheet/', {
        params: {
          session_id: filters.session_id,
          class_level_id: filters.class_level_id,
          class_section_id: filters.class_section_id
        }
      });
      setData(res.data);
      setStep(2);
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (studentId: number) => {
    if (!data?.rows) return;
    const allStudentIds = data.rows.map((r: any) => r.student_id).join(',');
    router.push(
      `/dashboard/staff/result/archive/cumulative/preview?student_id=${studentId}&session_id=${filters.session_id}&class_config_id=${filters.class_config_id}&students=${allStudentIds}`
    );
  };

  const filteredStudents = data?.rows?.filter((student: any) => {
    const matchSearch = !searchTerm ||
      student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.reg_number.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  }) || [];

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5';

  return (
    <div className="max-w-[85rem] mx-auto pb-20 px-4 pt-6 min-h-screen">
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm bg-white border-slate-200 text-slate-800">
            <p className="text-sm font-medium flex-1">{t.message}</p>
          </div>
        ))}
      </div>

      {/* ── Page Header ── */}
      <div className="mb-6">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 rounded-2xl px-5 py-4 md:px-7 md:py-5 shadow-lg shadow-slate-300/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-teal-300 uppercase tracking-widest truncate">Result Archive</p>
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">Cumulative Session Results</h1>
              </div>
            </div>
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl font-semibold transition-all flex items-center gap-2 text-xs border border-white/10">
                <Settings2 className="w-4 h-4" /> Reconfigure Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── STEP 1: FILTERS ── */}
      {step === 1 && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in max-w-4xl mx-auto overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-600" />

          <div className="flex items-center mb-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
               <span className="w-7 h-7 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                 <Search className="w-3.5 h-3.5 text-white" />
               </span>
               Locate Class Roster
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Session <span className="text-red-400">*</span></label>
              <select value={filters.session_id} onChange={e => setFilters(p => ({...p, session_id: e.target.value}))} className={inputCls} disabled={loadingOptions}>
                <option value="">Select session</option>
                {options.sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}><GraduationCap className="w-3.5 h-3.5" /> Class Level <span className="text-red-400">*</span></label>
              <select value={filters.class_level_id} onChange={e => setFilters(p => ({...p, class_level_id: e.target.value, class_section_id: ''}))} className={inputCls}>
                <option value="">Select class</option>
                {options.classLevels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}><Box className="w-3.5 h-3.5" /> Class Section <span className="text-red-400">*</span></label>
              <select value={filters.class_section_id} onChange={e => setFilters(p => ({...p, class_section_id: e.target.value}))} disabled={!filters.class_level_id} className={inputCls}>
                <option value="">Select section</option>
                {options.classSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-100 flex justify-end">
            <button onClick={handleSearch} disabled={!canSearch || loading} className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold rounded-xl hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-50 shadow-md">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Fetch Cumulative Roster
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: STUDENT LIST ── */}
      {step === 2 && data && (
        <div className="animate-in fade-in slide-in-from-bottom-6 max-w-7xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-teal-600" />
                    {data.class_name}
                 </h3>
                 <p className="text-xs text-slate-500 mt-1">{data.session_name} · Cumulative Session Analytics · {filteredStudents.length} records</p>
               </div>
               <div className="relative w-full sm:w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                 <input type="text" placeholder="Search student..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none" />
               </div>
             </div>

             {filteredStudents.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">No students found.</p>
                </div>
             ) : (
               <div className="divide-y divide-slate-100">
                  {filteredStudents.map((student: any, idx: number) => (
                    <div key={student.student_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 w-5">{idx + 1}.</span>
                        <img src={student.image || '/images/default-avatar.png'} alt={student.student_name} className="w-10 h-10 rounded-full object-cover border border-slate-200" onError={e => {(e.target as HTMLImageElement).src = '/images/default-avatar.png';}} />
                        <div>
                          <p className="text-sm font-bold text-slate-800">{student.student_name}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{student.reg_number}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-4 mr-4 text-center">
                           <div>
                             <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Session Avg</p>
                             <p className="text-sm font-black text-indigo-600">{student.average_score}%</p>
                           </div>
                           <div>
                             <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Position</p>
                             <p className="text-sm font-black text-amber-600">{student.position || '—'}</p>
                           </div>
                        </div>

                        <button onClick={() => handlePreview(student.student_id)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800 text-xs font-bold rounded-lg transition-colors border border-teal-100 uppercase tracking-wider">
                          <Eye className="w-3.5 h-3.5" /> View Cumulative
                        </button>
                      </div>
                    </div>
                  ))}
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}