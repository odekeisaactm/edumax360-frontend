'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, academicAPI, academicCalendarAPI } from '@/lib/api';
import {
  Columns, Search, Loader2, ArrowLeft, Download, Printer,
  Calendar, History, Layers, GraduationCap, Box, X, CheckCircle2,
  AlertTriangle, AlertCircle, Settings2, RefreshCw, SortAsc, SortDesc,
  Eye, ListTree
} from 'lucide-react';

// ─── Types & Helpers ──────────────────────────────────────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getStudentImage(imgUrl?: string | null) {
  if (!imgUrl || imgUrl.trim() === '') return '/images/default-avatar.png';
  if (imgUrl.startsWith('http')) return imgUrl;
  return `${API_BASE_URL}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function extractError(err: any): string {
  const d = err?.response?.data;
  return typeof d === 'string' ? d : d?.detail || d?.message || err?.message || 'An error occurred.';
}

const getColorClass = (tier: string) => {
  switch (tier) {
    case 'red': return 'text-red-600 bg-red-50/50 font-black';
    case 'amber': return 'text-amber-600 bg-amber-50/50 font-bold';
    case 'green': return 'text-emerald-600 bg-emerald-50/50 font-black';
    default: return 'text-slate-700 font-semibold';
  }
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MasterBroadsheetPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  // Options State
  const [options, setOptions] = useState({
    sessions: [] as any[], periods: [] as any[],
    schoolSections: [] as any[], classLevels: [] as any[],
    classSections: [] as any[], classConfigs: [] as any[],
  });

  // Filters State
  const [filters, setFilters] = useState({
    mode: 'term' as 'term' | 'session',
    session_id: '', period_id: '', school_section_id: '',
    class_level_id: '', class_section_id: ''
  });

  // Data State
  const [data, setData] = useState<any>(null);

  // UI Toggles
  const [sortBy, setSortBy] = useState<'rank' | 'name'>('rank');
  const [viewMode, setViewMode] = useState<'summary' | 'breakdown'>('summary');

  // ─── 1. Load Initial Options ───
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [sessions, schSections, classLevels, classSections, classConfigs, currentSession, currentPeriod] = await Promise.all([
          academicCalendarAPI.listSessions(),
          api.get('/api/school/sections/').then(r => r.data?.results || r.data?.data || []),
          academicAPI.listClasses(),
          academicAPI.listClassSections(),
          academicAPI.listClassConfigurations(),
          academicCalendarAPI.getCurrentSession().catch(() => null),
          academicCalendarAPI.getCurrentPeriod().catch(() => null),
        ]);

        setOptions({
          sessions, periods: [], schoolSections: schSections,
          classLevels, classSections, classConfigs
        });

        if (currentSession?.id) {
          setFilters(prev => ({ ...prev, session_id: String(currentSession.id) }));
          const periods = await academicCalendarAPI.listSessionPeriods({ session_id: currentSession.id });
          setOptions(prev => ({ ...prev, periods }));
          if (currentPeriod?.id) {
            setFilters(prev => ({ ...prev, session_id: String(currentSession.id), period_id: String(currentPeriod.id) }));
          }
        }
      } catch (err) {
        showToast('error', 'Failed to load configuration options.');
      }
    };
    fetchOptions();
  }, [showToast]);

  const handleSessionChange = async (val: string) => {
    setFilters(prev => ({ ...prev, session_id: val, period_id: '' }));
    if (!val) { setOptions(prev => ({ ...prev, periods: [] })); return; }
    const periods = await academicCalendarAPI.listSessionPeriods({ session_id: Number(val) });
    setOptions(prev => ({ ...prev, periods }));
  };

  // ─── 2. Fetch Broadsheet Data ───
  const generateBroadsheet = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!filters.session_id || !filters.class_level_id) return;
    if (filters.mode === 'term' && !filters.period_id) return;

    setLoading(true);
    setData(null);
    setStep(2);
    setSortBy('rank');

    try {
      const endpoint = filters.mode === 'term'
        ? '/api/result/spreadsheet/term-broadsheet/'
        : '/api/result/spreadsheet/session-broadsheet/';

      const res = await api.get(endpoint, {
        params: {
          session_id: filters.session_id,
          period_id: filters.mode === 'term' ? filters.period_id : undefined,
          class_level_id: filters.class_level_id,
          class_section_id: filters.class_section_id || undefined, // Send undefined if empty to trigger merge
        }
      });
      setData(res.data);
    } catch (err) {
      showToast('error', extractError(err));
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  // ─── 3. Data Processing (Memos) ───
  const subjectList = useMemo(() => {
    if (!data?.rows) return [];
    const subs = new Set<string>();
    data.rows.forEach((r: any) => Object.keys(r.subjects).forEach(s => subs.add(s)));
    return Array.from(subs).sort();
  }, [data]);

  const termList = useMemo(() => {
    if (!data?.is_session || !data?.rows) return [];
    const terms = new Set<string>();
    data.rows.forEach((r: any) => {
      Object.values(r.subjects).forEach((s: any) => {
        if (s.terms) Object.keys(s.terms).forEach(t => terms.add(t));
      });
    });
    return Array.from(terms);
  }, [data]);

  const sortedRows = useMemo(() => {
    if (!data?.rows) return [];
    return [...data.rows].sort((a, b) => {
      if (sortBy === 'name') return a.student_name.localeCompare(b.student_name);
      return a.position - b.position;
    });
  }, [data, sortBy]);

  const columnStats = useMemo(() => {
    if (!data?.rows || subjectList.length === 0) return { avg: {}, highest: {} };
    const stats: any = { avg: {}, highest: {} };
    subjectList.forEach(sub => {
      const scores = data.rows
        .map((r: any) => data.is_session ? r.subjects[sub]?.cumulative_average : r.subjects[sub]?.total)
        .filter((v: any) => v !== undefined && v !== null);

      stats.highest[sub] = scores.length ? Math.max(...scores).toFixed(1) : '—';
      stats.avg[sub] = scores.length ? (scores.reduce((a:number,b:number)=>a+b, 0) / scores.length).toFixed(1) : '—';
    });
    return stats;
  }, [data, subjectList]);

  // ─── 4. Exports ───
  const handleExportExcel = async () => {
    if (!data) return;

    // Dynamically import XLSX
    const XLSX = await import('xlsx');

    const wsData = sortedRows.map((r: any, i) => {
      const row: any = {
        "S/N": i + 1, "Admission No": r.reg_number, "Student Name": r.student_name
      };

      subjectList.forEach(sub => {
        const subData = r.subjects[sub];
        if (!subData) {
           if (data.is_session && viewMode === 'breakdown') termList.forEach(t => row[`${sub} - ${t}`] = '—');
           row[sub] = '—';
        } else {
           if (data.is_session) {
             if (viewMode === 'breakdown') {
               termList.forEach(t => row[`${sub} - ${t}`] = subData.terms?.[t] ?? '—');
             }
             row[sub] = subData.cumulative_average ?? '—';
           } else {
             row[sub] = subData.total ?? '—';
           }
        }
      });
      row["Total"] = r.total_score;
      row["Average"] = `${r.average_score}%`;
      row["Position"] = r.position;
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Broadsheet");
    XLSX.writeFile(wb, `${data.class_name}_Broadsheet.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!data) return;

    // Dynamically import jsPDF and autoTable
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF('landscape');

    // Build Headers
    let headRow = ["S/N", "Adm No", "Student Name"];
    subjectList.forEach(sub => {
       const shortSub = sub.substring(0, 3).toUpperCase();
       if (data.is_session && viewMode === 'breakdown') {
           termList.forEach((_, i) => headRow.push(`${shortSub} T${i+1}`));
       }
       headRow.push(shortSub);
    });
    headRow.push("Tot", "Avg", "Pos");

    // Build Body
    const bodyRows = sortedRows.map((r: any, i) => {
      const row = [i + 1, r.reg_number, r.student_name];
      subjectList.forEach(sub => {
         const subData = r.subjects[sub];
         if (!subData) {
             if (data.is_session && viewMode === 'breakdown') termList.forEach(() => row.push('—'));
             row.push('—');
         } else {
             if (data.is_session) {
                if (viewMode === 'breakdown') termList.forEach(t => row.push(subData.terms?.[t] ?? '—'));
                row.push(subData.cumulative_average ?? '—');
             } else {
                row.push(subData.total ?? '—');
             }
         }
      });
      row.push(r.total_score, `${r.average_score}%`, r.position);
      return row;
    });

    const title = `${data.class_name} Broadsheet - ${data.is_session ? data.session_name : data.period_name}`;
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    autoTable(doc, {
      head: [headRow],
      body: bodyRows,
      startY: 20,
      styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
      columnStyles: { 2: { halign: 'left' } } // left align names
    });
    doc.save(`${title}.pdf`);
  };

  // ─── Render Helpers ───
  const inputCls = 'w-full px-3.5 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-slate-50 transition-colors text-slate-800 font-bold';
  const labelCls = 'text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-1.5';

  const filteredClassLevels = filters.school_section_id ? options.classLevels.filter(c => String(c.school_section) === filters.school_section_id) : options.classLevels;
  const filteredClassSections = filters.class_level_id ? options.classSections.filter(s => {
    const configs = options.classConfigs.filter(c => String(c.student_class) === filters.class_level_id);
    return configs.some(c => String(c.class_section) === String(s.id));
  }) : options.classSections;

  return (
    <div className="max-w-[90rem] mx-auto pb-20 px-4 pt-6 min-h-screen">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* ── Page Header ── */}
      <div className="mb-6 print:hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-2xl px-5 py-4 md:px-7 md:py-5 shadow-lg shadow-slate-300/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button>
              <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-900/30">
                <Columns className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Analytics</p>
                <h1 className="text-xl font-bold text-white tracking-tight">Master Broadsheets</h1>
              </div>
            </div>
            {step === 2 && (
              <button onClick={() => setStep(1)} className="px-4 py-2 bg-white/10 text-white rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/10 hover:bg-white/20 transition-all">
                <Settings2 className="w-4 h-4" /> Reconfigure Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── STEP 1: FILTERS ── */}
      {step === 1 && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in max-w-5xl mx-auto overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-blue-600" />

          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
               <button type="button" onClick={() => setFilters(p => ({...p, mode: 'term'}))} className={`px-5 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${filters.mode === 'term' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Single Term</button>
               <button type="button" onClick={() => setFilters(p => ({...p, mode: 'session'}))} className={`px-5 py-2 text-xs font-bold rounded-lg uppercase tracking-wider transition-all ${filters.mode === 'session' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Full Session</button>
            </div>
          </div>

          <form onSubmit={generateBroadsheet} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className={labelCls}><Calendar className="w-3.5 h-3.5" /> Session <span className="text-red-400">*</span></label>
              <select value={filters.session_id} onChange={e => handleSessionChange(e.target.value)} className={inputCls} required>
                <option value="">Select session</option>
                {options.sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>

            {filters.mode === 'term' && (
              <div>
                <label className={labelCls}><History className="w-3.5 h-3.5" /> Term <span className="text-red-400">*</span></label>
                <select value={filters.period_id} onChange={e => setFilters(p => ({...p, period_id: e.target.value}))} className={inputCls} required>
                  <option value="">Select term</option>
                  {options.periods.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}><Layers className="w-3.5 h-3.5" /> Sch. Section</label>
              <select value={filters.school_section_id} onChange={e => setFilters(p => ({...p, school_section_id: e.target.value, class_level_id: ''}))} className={inputCls}>
                <option value="">All Sections</option>
                {options.schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}><GraduationCap className="w-3.5 h-3.5" /> Class Level <span className="text-red-400">*</span></label>
              <select value={filters.class_level_id} onChange={e => setFilters(p => ({...p, class_level_id: e.target.value, class_section_id: ''}))} className={inputCls} required>
                <option value="">Select Class Level</option>
                {filteredClassLevels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}><Box className="w-3.5 h-3.5" /> Class Arm (Optional)</label>
              <select value={filters.class_section_id} onChange={e => setFilters(p => ({...p, class_section_id: e.target.value}))} className={inputCls} disabled={!filters.class_level_id}>
                <option value="">Merge All Arms</option>
                {filteredClassSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <p className="text-[9px] text-slate-400 mt-1.5 ml-1 leading-tight">Leave blank to generate a merged ranking for the entire class level.</p>
            </div>

            <div className="lg:col-span-3 mt-4 flex justify-end">
               <button type="submit" disabled={loading} className="h-12 px-10 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50">
                 {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Columns className="w-5 h-5" />}
                 Generate Broadsheet
               </button>
            </div>
          </form>
        </div>
      )}

      {/* ── STEP 2: TABLE ── */}
      {step === 2 && data && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-6 flex flex-col max-h-[85vh]">

          {/* Header & Controls */}
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
            <div>
              <h3 className="font-bold text-slate-900 text-lg uppercase tracking-tight flex items-center gap-2">
                 <Columns className="w-4 h-4 text-indigo-500" />
                 {data.class_name} Broadsheet
              </h3>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">{data.session_name} {data.is_session ? '· Session Cumulative' : `· ${data.period_name}`}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Data Toggles */}
              <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-lg">
                 <button onClick={() => setSortBy('rank')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors flex items-center gap-1 ${sortBy === 'rank' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}><SortDesc className="w-3.5 h-3.5"/> Rank</button>
                 <button onClick={() => setSortBy('name')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors flex items-center gap-1 ${sortBy === 'name' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}><SortAsc className="w-3.5 h-3.5"/> Name</button>
              </div>

              {data.is_session && (
                 <div className="flex items-center gap-1 bg-amber-100/50 p-1 rounded-lg border border-amber-100">
                    <button onClick={() => setViewMode('summary')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors flex items-center gap-1 ${viewMode === 'summary' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-200/50'}`}><Eye className="w-3.5 h-3.5"/> Summary</button>
                    <button onClick={() => setViewMode('breakdown')} className={`px-3 py-1.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors flex items-center gap-1 ${viewMode === 'breakdown' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:bg-amber-200/50'}`}><ListTree className="w-3.5 h-3.5"/> Breakdown</button>
                 </div>
              )}

              {/* Exports */}
              <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm"><Download className="w-3.5 h-3.5" /> Excel</button>
              <button onClick={handleExportPDF} className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm"><Printer className="w-3.5 h-3.5" /> PDF</button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-auto flex-1 bg-white relative">
            <table className="w-full text-center text-sm border-collapse min-w-max">
              <thead className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
                <tr>
                  <th className="px-4 py-4 font-black uppercase tracking-widest text-[10px] sticky left-0 z-40 bg-slate-900 border-r border-slate-800">Student Profile</th>

                  {subjectList.map(sub => (
                    <th key={sub} className="font-black uppercase tracking-widest text-[10px] border-l border-slate-800" colSpan={(data.is_session && viewMode === 'breakdown') ? termList.length + 1 : 1}>
                      <div className="px-3 py-2 border-b border-slate-800 text-amber-400">{sub}</div>
                      {(data.is_session && viewMode === 'breakdown') && (
                        <div className="flex justify-between bg-slate-800">
                          {termList.map((t, i) => (
                             <div key={t} className="flex-1 px-2 py-2 border-r border-slate-700 text-slate-300 font-medium">T{i+1}</div>
                          ))}
                          <div className="flex-1 px-2 py-2 font-black text-indigo-300">AVG</div>
                        </div>
                      )}
                    </th>
                  ))}

                  <th className="px-4 py-4 font-black text-indigo-300 uppercase tracking-widest text-[10px] bg-slate-800 border-l border-slate-700">Total</th>
                  <th className="px-4 py-4 font-black text-emerald-300 uppercase tracking-widest text-[10px] bg-slate-800 border-l border-slate-700">AVG</th>
                  <th className="px-4 py-4 font-black text-amber-300 uppercase tracking-widest text-[10px] bg-slate-800 border-l border-slate-700">Pos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedRows.length === 0 ? (
                  <tr><td colSpan={100} className="py-16 text-center text-slate-400 font-medium">No results found for this selection.</td></tr>
                ) : (
                  sortedRows.map((row: any, i: number) => (
                    <tr key={row.student_id} className="hover:bg-slate-50/80 transition-colors group">

                      {/* Pinned Profile Column */}
                      <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 transition-colors border-r border-slate-100 p-0">
                        <div className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-[10px] font-bold text-slate-400 w-4">{i + 1}.</span>
                          <img src={row.image} className="w-8 h-8 rounded-full object-cover border border-slate-200" onError={e => {(e.target as HTMLImageElement).src = '/images/default-avatar.png';}} />
                          <div className="text-left min-w-[140px]">
                            <p className="text-xs font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{row.student_name}</p>
                            <p className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mt-0.5">{row.reg_number}</p>
                          </div>
                        </div>
                      </td>

                      {/* Subject Scores */}
                      {subjectList.map(sub => {
                        const subData = row.subjects[sub];
                        if (!subData) {
                          return (
                            <React.Fragment key={sub}>
                               {(data.is_session && viewMode === 'breakdown') && termList.map(t => <td key={t} className="px-2 py-3 border-l border-slate-100 text-slate-300 text-xs">—</td>)}
                               <td className="px-3 py-3 border-l border-slate-100 text-slate-300 text-sm font-medium">—</td>
                            </React.Fragment>
                          );
                        }
                        return (
                          <React.Fragment key={sub}>
                            {(data.is_session && viewMode === 'breakdown') && termList.map(t => (
                               <td key={t} className="px-2 py-3 border-l border-slate-100 text-slate-500 text-xs font-medium bg-slate-50/30">
                                 {subData.terms?.[t] ?? '—'}
                               </td>
                            ))}
                            <td className={`px-3 py-3 border-l border-slate-200 text-sm ${getColorClass(subData.color_tier)}`}>
                              {data.is_session ? subData.cumulative_average : subData.total}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      {/* Grand Totals */}
                      <td className="px-4 py-3 font-black text-indigo-700 bg-indigo-50/30 border-l border-slate-200">{row.total_score.toFixed(1)}</td>
                      <td className="px-4 py-3 font-black text-emerald-700 bg-emerald-50/30 border-l border-emerald-100">{row.average_score.toFixed(1)}%</td>
                      <td className="px-4 py-3 font-black text-amber-600 bg-amber-50/30 border-l border-amber-100">{row.position}</td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Footer Stats Row */}
              {sortedRows.length > 0 && (
                <tfoot className="bg-slate-800 text-slate-300 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                  <tr>
                    <td className="sticky left-0 z-40 bg-slate-800 border-r border-slate-700 px-4 py-3 text-right">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Class Avg</p>
                       <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mt-1">Highest</p>
                    </td>

                    {subjectList.map(sub => (
                      <td key={sub} className="border-l border-slate-700 px-2 py-3" colSpan={(data.is_session && viewMode === 'breakdown') ? termList.length + 1 : 1}>
                         <p className="text-xs font-bold text-slate-300">{columnStats.avg[sub]}</p>
                         <p className="text-xs font-black text-indigo-300 mt-1">{columnStats.highest[sub]}</p>
                      </td>
                    ))}

                    <td colSpan={3} className="border-l border-slate-700 px-4 py-3 text-left">
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">Statistics auto-calculated from visible column data.</p>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}