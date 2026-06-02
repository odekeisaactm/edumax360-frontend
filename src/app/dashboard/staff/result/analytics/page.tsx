'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, resultAnalyticsAPI, resultViewAPI } from '@/lib/api';
import { 
  BarChart2, TrendingUp, Users, Download, ChevronDown, CheckCircle2,
  AlertCircle, Loader2, Layers, Target, Divide, Search, X, UserCheck, Check, Bot
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';

let _toastId = 0;
function showToast(setToasts: any, type: 'success'|'error'|'warn', message: string) {
  const id = ++_toastId;
  setToasts((prev: any) => [...prev, { id, type, message }]);
  setTimeout(() => setToasts((prev: any) => prev.filter((t: any) => t.id !== id)), 5000);
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'string') return d;
  if (d?.detail) return String(d.detail);
  if (d?.message) return String(d.message);
  return err?.message || 'An unexpected error occurred.';
}

function downloadChart(chartRef: React.RefObject<HTMLDivElement | null>, filename: string, setToasts: any) {
  import('html2canvas').then(html2canvas => {
    if (chartRef.current) {
      html2canvas.default(chartRef.current).then(canvas => {
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }
  }).catch(() => {
    showToast(setToasts, 'error', "Please install html2canvas to enable chart downloads.");
  });
}

const StudentSearch = ({ onSelect, placeholder = "Search student..." }: { onSelect: (s: any) => void, placeholder?: string }) => {
  const [query, setQuery] = useState('');
  const [results, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    setShowDropdown(true);
    try {
      const res = await api.get('/api/student/students/', { params: { search: val } });
      const list = res.data.results?.data || res.data.data?.results || res.data.results || res.data.data || [];
      setSearchResults(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => query.length >= 3 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-[1rem] text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-700"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSearchResults([]); setShowDropdown(false); }} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl z-[60] overflow-hidden max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="p-8 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Searching...</div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {results.map(s => (
                <button
                  key={s.id}
                  onClick={() => { onSelect(s); setQuery(s.full_name || `${s.first_name} ${s.last_name}`); setShowDropdown(false); }}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                    {s.image_url ? <img src={s.image_url} className="w-full h-full object-cover" /> : (s.full_name?.[0] || '')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{s.full_name || `${s.first_name} ${s.last_name}`}</p>
                    <p className="text-xs text-slate-500">{s.registration_number} · {s.current_class_name || 'No Class'}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : <div className="p-8 text-center text-slate-400 font-medium">No students found.</div>}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// OVERVIEW TAB
// ============================================================================
const OverviewTab = ({ sessions, periods, currentSessionId, currentPeriodId, setToasts }: any) => {
  const [filters, setFilters] = useState({ session: currentSessionId || '', period: currentPeriodId || '' });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentSessionId) setFilters(f => ({ ...f, session: currentSessionId }));
    if (currentPeriodId) setFilters(f => ({ ...f, period: currentPeriodId }));
  }, [currentSessionId, currentPeriodId]);

  const fetchOverview = useCallback(async () => {
    if (!filters.session || !filters.period) return;
    setLoading(true);
    try {
      const res = await resultAnalyticsAPI.overview({ session: Number(filters.session), period: Number(filters.period) });
      setData(res);
    } catch (e) { showToast(setToasts, 'error', extractError(e)); } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex gap-4 bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm w-max">
        <select value={filters.session} onChange={e => setFilters({...filters, session: e.target.value})} className="border border-slate-200 rounded-[1rem] px-4 py-2 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
          <option value="">Select Session</option>
          {sessions?.map((s:any) => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
        </select>
        <select value={filters.period} onChange={e => setFilters({...filters, period: e.target.value})} className="border border-slate-200 rounded-[1rem] px-4 py-2 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
          <option value="">Select Term</option>
          {periods?.map((p:any) => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center hover:shadow-xl transition-all">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">Total Assessed</p>
              <p className="text-4xl font-black text-slate-900">{data.total_assessed}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center hover:shadow-xl transition-all">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">Class Average</p>
              <p className="text-4xl font-black text-indigo-600">{data.class_average}%</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center hover:shadow-xl transition-all">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">Highest Score</p>
              <p className="text-4xl font-black text-emerald-500">{data.highest_score}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center hover:shadow-xl transition-all">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">Lowest Score</p>
              <p className="text-4xl font-black text-rose-500">{data.lowest_score}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-center hover:shadow-xl transition-all">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] mb-2">Pass Rate</p>
              <p className="text-4xl font-black text-amber-500">{data.pass_rate}%</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Subject Performance Distribution</h3>
              <button onClick={() => downloadChart(chartRef, 'overview_stats', setToasts)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            <div ref={chartRef} className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chart_data} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="subject" tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 30px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                  <Legend wrapperStyle={{fontSize: '11px', paddingTop: '20px', fontWeight: '900', textTransform: 'uppercase'}} />
                  <Bar dataKey="midterm" name="Midterm Avg" fill="#fcd34d" radius={[8, 8, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="end_of_term" name="End of Term Avg" fill="#818cf8" radius={[8, 8, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
          <BarChart2 className="w-12 h-12 text-slate-100 mb-3" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Waiting for data...</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPARISON TAB
// ============================================================================
const ComparisonTab = ({ sessions, classLevels, classSections, schoolSections, periods, currentSessionId, currentPeriodId, setToasts }: any) => {
  const [filtersA, setFiltersA] = useState({ session: currentSessionId || '', class: '', class_section: '', gender: '', period: currentPeriodId || '', school_section: '' });
  const [filtersB, setFiltersB] = useState({ session: currentSessionId || '', class: '', class_section: '', gender: '', period: currentPeriodId || '', school_section: '' });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const getLabel = (filters: any) => {
    const sess = sessions?.find((s: any) => s.id == filters.session)?.name || '';
    const cls = classLevels?.find((c: any) => c.id == filters.class)?.name || 'All Classes';
    const arm = classSections?.find((s: any) => s.id == filters.class_section)?.name || '';
    const gen = filters.gender || 'All Genders';
    return `${sess ? `${sess} ` : ''}${cls}${arm ? ` ${arm}` : ''} (${gen})`;
  };

  const fetchComparison = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await resultAnalyticsAPI.comparison({
        a_session: filtersA.session, a_class: filtersA.class, a_class_section: filtersA.class_section, a_gender: filtersA.gender, a_period: filtersA.period, a_school_section: filtersA.school_section,
        b_session: filtersB.session, b_class: filtersB.class, b_class_section: filtersB.class_section, b_gender: filtersB.gender, b_period: filtersB.period, b_school_section: filtersB.school_section,
      });
      setData(res);
    } catch (e) { showToast(setToasts, 'error', extractError(e)); } finally { setLoading(false); }
  };

  const FilterGroup = ({ title, filters, setFilters }: any) => {
    const filteredClasses = filters.school_section 
      ? classLevels?.filter((c: any) => c.school_section == filters.school_section)
      : classLevels;

    return (
      <div className="flex-1 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
        <h4 className="font-black text-slate-800 mb-6 uppercase tracking-tight text-lg">{title}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session</label>
            <select value={filters.session} onChange={e => setFilters({...filters, session: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" required>
              <option value="">Any Session</option>
              {sessions?.map((s: any) => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Term</label>
            <select value={filters.period} onChange={e => setFilters({...filters, period: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700" required>
              <option value="">Any Term</option>
              {periods?.map((p: any) => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">School Section</label>
            <select value={filters.school_section} onChange={e => setFilters({...filters, school_section: e.target.value, class: ''})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
              <option value="">Any Section</option>
              {schoolSections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class Level</label>
            <select value={filters.class} onChange={e => setFilters({...filters, class: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
              <option value="">Any Class</option>
              {filteredClasses?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class Arm (Opt)</label>
            <select value={filters.class_section} onChange={e => setFilters({...filters, class_section: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
              <option value="">All Arms</option>
              {classSections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
            <select value={filters.gender} onChange={e => setFilters({...filters, gender: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
              <option value="">Both Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <form onSubmit={fetchComparison}>
        <div className="flex flex-col lg:flex-row gap-6">
          <FilterGroup title="Group A Dataset" filters={filtersA} setFilters={setFiltersA} />
          <div className="hidden lg:flex items-center justify-center"><Divide className="w-8 h-8 text-slate-200" /></div>
          <FilterGroup title="Group B Dataset" filters={filtersB} setFilters={setFiltersB} />
        </div>
        <div className="flex justify-end mt-6">
          <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 h-[52px] rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />} RUN ANALYSIS
          </button>
        </div>
      </form>

      {data && data.chart_data?.length > 0 ? (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 animate-in fade-in zoom-in-95 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-10">
            <div>
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Comparative Index</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Analysing {getLabel(filtersA)} vs {getLabel(filtersB)}</p>
            </div>
            <button onClick={() => downloadChart(chartRef, 'group_comparison', setToasts)} className="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl text-xs font-black shadow-lg transition-all flex items-center gap-2">
              <Download className="w-4 h-4" /> EXPORT
            </button>
          </div>
          <div ref={chartRef} className="h-[30rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chart_data} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="subject" tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} domain={[0, 100]} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 30px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                <Legend wrapperStyle={{fontSize: '11px', paddingTop: '30px', fontWeight: '900', textTransform: 'uppercase'}} />
                <Bar dataKey="groupA" name="Group A Avg" fill="#818cf8" radius={[10, 10, 0, 0]} maxBarSize={40} />
                <Bar dataKey="groupB" name="Group B Avg" fill="#fb7185" radius={[10, 10, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : !loading && (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-dashed border-slate-200 mt-8">
           <Layers className="w-12 h-12 text-slate-100 mb-3" />
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Run analysis to view comparison.</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STUDENT VS STUDENT TAB
// ============================================================================
const StudentVsStudentTab = ({ sessions, periods, currentSessionId, currentPeriodId, setToasts }: any) => {
  const [filters, setFilters] = useState({ session: currentSessionId || '', period: currentPeriodId || '' });
  const [studentA, setStudentA] = useState<any>(null);
  const [studentB, setStudentB] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const fetchComparison = async () => {
    if (!filters.session || !filters.period || !studentA || !studentB) {
      showToast(setToasts, 'warn', "Please select a Session, Term, and two students.");
      return;
    }
    setLoading(true);
    try {
      const [resA, resB] = await Promise.all([
        resultAnalyticsAPI.studentTracker({ student_id: studentA.id }),
        resultAnalyticsAPI.studentTracker({ student_id: studentB.id })
      ]);
      
      // Match the period name from the active filters
      const targetPeriodName = `${sessions.find((s:any)=>s.id == filters.session)?.start_year}/${sessions.find((s:any)=>s.id == filters.session)?.end_year} ${periods.find((p:any)=>p.id == filters.period)?.period?.name}`;
      
      const subA = resA.subject_trends || {};
      const subB = resB.subject_trends || {};
      
      const allSubs = Array.from(new Set([...Object.keys(subA), ...Object.keys(subB)]));
      const chart_data = allSubs.map(sub => {
        // Find the specific score for this term, or fallback to the latest if exact match fails
        const a_scores = subA[sub] || [];
        const b_scores = subB[sub] || [];
        // For simplicity in this view, we can just grab the latest or the one matching the period
        const a_val = a_scores.length ? a_scores[a_scores.length - 1].score : 0;
        const b_val = b_scores.length ? b_scores[b_scores.length - 1].score : 0;
        return { subject: sub, studentA: a_val, studentB: b_val };
      });

      setData({ chart_data });
    } catch (e) { showToast(setToasts, 'error', extractError(e)); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session</label>
            <select value={filters.session} onChange={e => setFilters({...filters, session: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
              <option value="">Select Session</option>
              {sessions?.map((s:any) => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
            </select>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Term</label>
            <select value={filters.period} onChange={e => setFilters({...filters, period: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
              <option value="">Select Term</option>
              {periods?.map((p:any) => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative">
          <div className="space-y-4">
             <h4 className="font-black text-indigo-600 uppercase tracking-tight">Student A</h4>
             <StudentSearch onSelect={setStudentA} placeholder="Find first student..." />
             {studentA && (
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                 <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-indigo-500 shadow-sm overflow-hidden">
                   {studentA.image_url ? <img src={studentA.image_url} className="w-full h-full object-cover" /> : studentA.full_name[0]}
                 </div>
                 <div>
                   <p className="font-bold text-slate-800">{studentA.full_name}</p>
                   <p className="text-[10px] font-black text-slate-400 uppercase">{studentA.current_class_name}</p>
                 </div>
               </div>
             )}
          </div>
          
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-slate-100 rounded-full items-center justify-center font-black text-slate-400 border-4 border-white z-10">VS</div>

          <div className="space-y-4">
             <h4 className="font-black text-rose-500 uppercase tracking-tight">Student B</h4>
             <StudentSearch onSelect={setStudentB} placeholder="Find second student..." />
             {studentB && (
               <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                 <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-black text-rose-500 shadow-sm overflow-hidden">
                   {studentB.image_url ? <img src={studentB.image_url} className="w-full h-full object-cover" /> : studentB.full_name[0]}
                 </div>
                 <div>
                   <p className="font-bold text-slate-800">{studentB.full_name}</p>
                   <p className="text-[10px] font-black text-slate-400 uppercase">{studentB.current_class_name}</p>
                 </div>
               </div>
             )}
          </div>
        </div>
        <div className="flex justify-end mt-8">
          <button onClick={fetchComparison} disabled={loading || !studentA || !studentB} className="bg-slate-900 hover:bg-black text-white px-10 h-[52px] rounded-2xl font-black text-sm shadow-xl transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />} COMPARE STUDENTS
          </button>
        </div>
      </div>

      {data && data.chart_data?.length > 0 && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 mt-8 animate-in zoom-in-95">
           <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Head to Head Performance</h3>
              <button onClick={() => downloadChart(chartRef, 'student_comparison', setToasts)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            <div ref={chartRef} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data.chart_data}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{fontSize: 10, fill: '#64748b', fontWeight: 'bold'}} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Radar name={studentA?.full_name} dataKey="studentA" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.5} />
                  <Radar name={studentB?.full_name} dataKey="studentB" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.5} />
                  <Legend wrapperStyle={{fontSize: '11px', paddingTop: '20px', fontWeight: '900', textTransform: 'uppercase'}} />
                  <RechartsTooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUBJECT TRENDS TAB
// ============================================================================
const SubjectTrendsTab = ({ subjects, classLevels, setToasts }: any) => {
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [classId, setClassId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const fetchTrend = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const res = await resultAnalyticsAPI.subjectTrend({ subject_id: Number(subjectId), class: classId ? Number(classId) : undefined });
      setData(res);
    } catch (e) { showToast(setToasts, 'error', extractError(e)); } finally { setLoading(false); }
  }, [subjectId, classId]);

  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex gap-4 bg-white p-4 rounded-[1.5rem] border border-slate-100 shadow-sm">
        <select value={subjectId} onChange={e => setSubjectId(e.target.value ? Number(e.target.value) : '')} className="flex-1 border border-slate-200 rounded-[1rem] px-4 py-3 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
          <option value="">Select Subject</option>
          {subjects?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={classId} onChange={e => setClassId(e.target.value ? Number(e.target.value) : '')} className="flex-1 border border-slate-200 rounded-[1rem] px-4 py-3 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700">
          <option value="">All Classes (Aggregated)</option>
          {classLevels?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : data?.chart_data?.length > 0 ? (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Longitudinal Trend</h3>
            <button onClick={() => downloadChart(chartRef, 'subject_trend', setToasts)} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
          <div ref={chartRef} className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.chart_data} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} />
                <RechartsTooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 30px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                <Legend wrapperStyle={{fontSize: '11px', paddingTop: '20px', fontWeight: '900', textTransform: 'uppercase'}} />
                <Line type="monotone" dataKey="average" name="General Average" stroke="#4f46e5" strokeWidth={5} dot={{r: 6, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff'}} activeDot={{ r: 9 }} />
                <Line type="monotone" dataKey="highest" name="Highest Score" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="lowest" name="Lowest Score" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : subjectId && !loading && (
        <div className="p-12 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
          <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No historical data available.</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STUDENT TRACKER TAB
// ============================================================================
const StudentTrackerTab = ({ setToasts }: any) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const fetchTracker = async (student: any) => {
    setLoading(true);
    setSelectedStudent(student);
    try {
      const res = await resultAnalyticsAPI.studentTracker({ student_id: student.id });
      setData(res);
    } catch (e) { showToast(setToasts, 'error', extractError(e)); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm max-w-xl mx-auto">
         <StudentSearch onSelect={fetchTracker} placeholder="Search student name..." />
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : data ? (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex items-center gap-6 min-w-[320px]">
              <div className="w-20 h-20 rounded-[1.5rem] bg-indigo-50 flex items-center justify-center text-3xl font-black text-indigo-500 overflow-hidden shadow-inner border border-indigo-100">
                {(selectedStudent?.image_url || selectedStudent?.image) ? <img src={selectedStudent.image_url || selectedStudent.image} className="w-full h-full object-cover" /> : selectedStudent?.full_name?.[0]}
              </div>
              <div>
                <h4 className="font-black text-slate-900 text-xl tracking-tight uppercase">{selectedStudent?.full_name}</h4>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{selectedStudent?.registration_number}</p>
                <div className="mt-3 inline-block px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-xl border border-indigo-100">ACTIVE PROFILE</div>
              </div>
            </div>

            <div className="flex-1 bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-300/50 flex items-start gap-5 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />
              <div className="bg-white/10 p-4 rounded-[1.25rem] backdrop-blur-md"><Bot className="w-6 h-6 text-indigo-300" /></div>
              <div className="relative z-10">
                <h4 className="font-black text-indigo-300 text-[10px] uppercase tracking-[0.3em] mb-2">AI Insight</h4>
                <p className="text-sm font-bold leading-relaxed opacity-90">"{data.insight}"</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Growth Trajectory</h3>
              <button onClick={() => downloadChart(chartRef, `trajectory`, setToasts)} className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-slate-200">
                Export Chart
              </button>
            </div>
            <div ref={chartRef} className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.overall_trend} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 30px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                  <Line type="step" dataKey="average" name="Overall Avg" stroke="#ec4899" strokeWidth={5} dot={{ r: 8, fill: '#ec4899', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
          <Target className="w-12 h-12 text-slate-200 mb-3" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Select a student to begin.</p>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// GENDER ANALYSIS TAB
// ============================================================================
const GenderAnalysisTab = ({ sessions, periods, classLevels, classSections, schoolSections, setToasts }: any) => {
  const [filters, setFilters] = useState({ session: '', period: '', class: '', class_section: '', school_section: '' });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const getFilterLabel = () => {
    const cls = classLevels?.find((c: any) => c.id == filters.class)?.name || 'All Classes';
    const arm = classSections?.find((s: any) => s.id == filters.class_section)?.name || '';
    const sec = schoolSections?.find((s: any) => s.id == filters.school_section)?.name || '';
    return `${sec ? `${sec} · ` : ''}${cls}${arm ? ` ${arm}` : ''}`;
  };

  const fetchGender = useCallback(async () => {
    setLoading(true);
    try {
      const res = await resultAnalyticsAPI.genderAnalysis({
        session: filters.session || undefined,
        period: filters.period || undefined,
        class: filters.class || undefined,
        class_section: filters.class_section || undefined,
        school_section: filters.school_section || undefined,
      });
      setData(res);
    } catch (e) { showToast(setToasts, 'error', extractError(e)); } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchGender(); }, [fetchGender]);

  const filteredClasses = filters.school_section 
    ? classLevels?.filter((c: any) => c.school_section == filters.school_section)
    : classLevels;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session</label><select value={filters.session} onChange={e => setFilters({...filters, session: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"><option value="">All Sessions</option>{sessions?.map((s: any) => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}</select></div>
        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Term</label><select value={filters.period} onChange={e => setFilters({...filters, period: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"><option value="">All Terms</option>{periods?.map((p: any) => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}</select></div>
        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sch. Section</label><select value={filters.school_section} onChange={e => setFilters({...filters, school_section: e.target.value, class: ''})} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"><option value="">All Sections</option>{schoolSections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class Level</label><select value={filters.class} onChange={e => setFilters({...filters, class: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"><option value="">All Classes</option>{filteredClasses?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class Arm</label><select value={filters.class_section} onChange={e => setFilters({...filters, class_section: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700"><option value="">All Arms</option>{classSections?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : data && data.chart_data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-[0.3em] text-blue-200 mb-1">MALE AGGREGATE</p>
                <p className="text-5xl font-black">{data.overall?.Male || 0}%</p>
              </div>
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="bg-pink-500 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-pink-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-[0.3em] text-pink-200 mb-1">FEMALE AGGREGATE</p>
                <p className="text-5xl font-black">{data.overall?.Female || 0}%</p>
              </div>
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Users className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-10">
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Parity Index</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{getFilterLabel()}</p>
              </div>
              <button onClick={() => downloadChart(chartRef, 'gender_analysis', setToasts)} className="px-6 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl text-xs font-black shadow-lg transition-all">
                EXPORT CHART
              </button>
            </div>
            <div ref={chartRef} className="h-[30rem] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chart_data} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="subject" tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 10, fill: '#64748b', fontWeight: 800}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 30px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold'}} />
                  <Legend wrapperStyle={{fontSize: '11px', paddingTop: '30px', fontWeight: '900', textTransform: 'uppercase'}} />
                  <Bar dataKey="Male" name="Male Performance" fill="#3b82f6" radius={[10, 10, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Female" name="Female Performance" fill="#ec4899" radius={[10, 10, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};


// ============================================================================
// MAIN PAGE LAYOUT
// ============================================================================

export default function ResultAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [classLevels, setClassLevels] = useState<any[]>([]);
  const [classSections, setClassSections] = useState<any[]>([]);
  const [schoolSections, setSchoolSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    const fetchSelectors = async () => {
      try {
        const [sessRes, perRes, classRes, secRes, subRes, schRes, currSessRes, currPerRes] = await Promise.all([
          api.get('/api/school/sessions/'),
          api.get('/api/school/session-periods/'),
          api.get('/api/academic/classes/'),
          api.get('/api/academic/class-sections/'),
          api.get('/api/academic/subjects/'),
          api.get('/api/school/sections/'),
          api.get('/api/school/sessions/current/'),
          api.get('/api/school/session-periods/current/')
        ]);
        setSessions(sessRes.data.data?.results || sessRes.data.data || []);
        setPeriods(perRes.data.data?.results || perRes.data.data || []);
        setClassLevels(classRes.data.data?.results || classRes.data.data || []);
        setClassSections(secRes.data.data?.results || secRes.data.data || []);
        setSubjects(subRes.data.data?.results || subRes.data.data || []);
        setSchoolSections(schRes.data.data?.results || schRes.data.data || []);
        
        setCurrentSessionId(currSessRes.data.data?.id || null);
        setCurrentPeriodId(currPerRes.data.data?.id || null);
      } catch (e) {
        console.error("Failed to load selectors", e);
      }
    };
    fetchSelectors();
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'comparison', label: 'Comparison' },
    { id: 'student_vs_student', label: 'Student vs Student' },
    { id: 'trends', label: 'Trends' },
    { id: 'tracker', label: 'Tracker' },
    { id: 'gender', label: 'Gender' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4">
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
            ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
            : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-red-50 border-red-200 text-red-900'}`}>
            {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : t.type === 'warn' ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
            <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-slate-200 transform -rotate-3">
              <BarChart2 className="h-6 w-6 text-white" />
            </div>
            Analytics Intelligence
          </h1>
          <p className="text-sm text-slate-500 font-bold mt-2 ml-1">Visualising academic performance across the institution</p>
        </div>
      </div>

      <div className="bg-slate-100 p-1.5 rounded-[1.5rem] flex flex-wrap shadow-inner overflow-hidden">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 min-w-[120px] px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all
              ${activeTab === t.id ? 'bg-white text-indigo-600 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {activeTab === 'overview' && <OverviewTab sessions={sessions} periods={periods} currentSessionId={currentSessionId} currentPeriodId={currentPeriodId} setToasts={setToasts} />}
        {activeTab === 'comparison' && <ComparisonTab sessions={sessions} classLevels={classLevels} classSections={classSections} schoolSections={schoolSections} periods={periods} currentSessionId={currentSessionId} currentPeriodId={currentPeriodId} setToasts={setToasts} />}
        {activeTab === 'student_vs_student' && <StudentVsStudentTab sessions={sessions} periods={periods} currentSessionId={currentSessionId} currentPeriodId={currentPeriodId} setToasts={setToasts} />}
        {activeTab === 'trends' && <SubjectTrendsTab subjects={subjects} classLevels={classLevels} setToasts={setToasts} />}
        {activeTab === 'tracker' && <StudentTrackerTab setToasts={setToasts} />}
        {activeTab === 'gender' && <GenderAnalysisTab sessions={sessions} periods={periods} classLevels={classLevels} classSections={classSections} schoolSections={schoolSections} setToasts={setToasts} />}
      </div>
    </div>
  );
}
