'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { 
  Award, Search, Loader2, ArrowLeft, Download, Printer, Filter, Trophy, BookOpen, Star, TrendingUp, Users, Calendar, History, Layers, GraduationCap, Box, AlertTriangle, AlertCircle, CheckCircle2, X
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

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

export default function PrizeArchivePage() {
  const router = useRouter();

  const [options, setOptions] = useState({
    sessions: [] as any[],
    periods: [] as any[],
    classConfigs: [] as any[],
    classLevels: [] as any[],
    schoolSections: [] as any[],
  });

  const [filters, setFilters] = useState({
    session_id: '',
    period_id: '',
    school_section_id: '',
    class_level_id: '',
    class_config_id: '',
    level_id: '' // for level-wide ranking
  });
  
  const [topN, setTopN] = useState(3);
  const [rankLevel, setRankLevel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  useEffect(() => {
    const fetchWithDefaults = async () => {
        try {
            const [sessRes, perRes, schSecRes, classLvlRes, classConfRes, currSessRes, currPerRes] = await Promise.all([
              api.get('/api/school/sessions/'),
              api.get('/api/school/session-periods/'),
              api.get('/api/school/sections/'),
              api.get('/api/academic/classes/'),
              api.get('/api/academic/class-configurations/'),
              api.get('/api/school/sessions/current/'),
              api.get('/api/school/session-periods/current/')
            ]);
            
            const sessions = sessRes.data.data?.results || sessRes.data.data || [];
            const periods = perRes.data.data?.results || perRes.data.data || [];
            
            setOptions({
              sessions,
              periods,
              schoolSections: schSecRes.data.data?.results || schSecRes.data.data || [],
              classLevels: classLvlRes.data.data?.results || classLvlRes.data.data || [],
              classConfigs: classConfRes.data.data?.results || classConfRes.data.data || [],
            });
            
            const curSessId = currSessRes.data.data?.id;
            const curPerId = currPerRes.data.data?.id;
            if (curSessId || curPerId) {
                setFilters(prev => ({
                    ...prev,
                    session_id: curSessId ? String(curSessId) : prev.session_id,
                    period_id: curPerId ? String(curPerId) : prev.period_id,
                }));
            }
          } catch (err) {}
    };
    fetchWithDefaults();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.session_id || !filters.period_id) {
        showToast('warn', "Session and Term are required");
        return;
    }
    if (!rankLevel && !filters.class_config_id) {
        showToast('warn', "Select a Class Arm to generate prize list");
        return;
    }
    if (rankLevel && !filters.class_level_id) {
        showToast('warn', "Select a Class Level to rank across sections");
        return;
    }

    setLoading(true);
    setData(null);
    try {
      const params: any = {
        session_id: filters.session_id,
        period_id: filters.period_id,
        top_n: topN,
      };
      if (rankLevel) {
        params.level_id = filters.class_level_id;
      } else {
        params.class_id = filters.class_config_id;
      }

      const res = await api.get('/api/result/archive/prizes/', { params });
      setData(res.data);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || err?.message || "Failed to generate prize list.");
    } finally {
      setLoading(false);
    }
  };

  const filteredClasses = filters.school_section_id 
    ? options.classConfigs.filter(c => options.classLevels.find(l => l.id == c.student_class)?.school_section == filters.school_section_id)
    : options.classConfigs;
    
  const filteredLevels = filters.school_section_id
    ? options.classLevels.filter(l => l.school_section == filters.school_section_id)
    : options.classLevels;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 bg-amber-500 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-amber-200 transform rotate-3">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Prize & Award Archive</h1>
            <p className="text-sm text-slate-500 font-bold tracking-tight">Identify top academic performers and subject excellence</p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <form onSubmit={handleGenerate} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                 <Calendar className="w-3 h-3" /> Session
              </label>
              <select value={filters.session_id} onChange={e => setFilters({...filters, session_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-amber-500 transition-all">
                <option value="">Select Session</option>
                {options.sessions?.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                 <History className="w-3 h-3" /> Term/Period
              </label>
              <select value={filters.period_id} onChange={e => setFilters({...filters, period_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-amber-500 transition-all">
                <option value="">Select Term</option>
                {options.periods?.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                 <Layers className="w-3 h-3" /> Sch. Section
              </label>
              <select value={filters.school_section_id} onChange={e => setFilters({...filters, school_section_id: e.target.value, class_config_id: '', class_level_id: ''})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-amber-500 transition-all">
                <option value="">Any Section</option>
                {options.schoolSections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                 <Star className="w-3 h-3" /> Rank Limit
              </label>
              <select value={topN} onChange={e => setTopN(Number(e.target.value))} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-amber-500 transition-all">
                <option value={1}>Top 1 Only</option>
                <option value={3}>Top 3 Performers</option>
                <option value={5}>Top 5 Performers</option>
                <option value={10}>Top 10 Performers</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-8 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                <button type="button" onClick={() => setRankLevel(false)} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${!rankLevel ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Single Class Arm</button>
                <button type="button" onClick={() => setRankLevel(true)} className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${rankLevel ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Whole Grade Level</button>
            </div>

            <div className="flex-1 w-full">
              {rankLevel ? (
                <div className="space-y-1.5 animate-in slide-in-from-left-2">
                  <select value={filters.class_level_id} onChange={e => setFilters({...filters, class_level_id: e.target.value})} className="w-full border-2 border-indigo-100 rounded-2xl px-5 py-3 text-sm font-black text-indigo-900 bg-indigo-50/30 focus:border-indigo-500 outline-none transition-all">
                    <option value="">Choose Class Level (ranks all arms together)...</option>
                    {filteredLevels?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5 animate-in slide-in-from-right-2">
                  <select value={filters.class_config_id} onChange={e => setFilters({...filters, class_config_id: e.target.value})} className="w-full border-2 border-indigo-100 rounded-2xl px-5 py-3 text-sm font-black text-indigo-900 bg-indigo-50/30 focus:border-indigo-500 outline-none transition-all">
                    <option value="">Choose Specific Class Arm...</option>
                    {filteredClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="w-full md:w-auto px-10 h-[52px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 transform active:scale-95">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              GENERATE RANKINGS
            </button>
          </div>
        </form>
      </div>

      {data && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6">
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-200 flex items-center justify-between overflow-hidden relative group hover:shadow-indigo-300 transition-all">
                <div className="relative z-10">
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-2">Class Average</p>
                   <p className="text-4xl font-black">{data.class_average}%</p>
                </div>
                <TrendingUp className="w-24 h-24 absolute -right-4 -bottom-4 text-indigo-500/50 group-hover:scale-110 transition-transform" />
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 flex items-center justify-between overflow-hidden relative group hover:shadow-2xl transition-all">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">Total Candidates</p>
                   <p className="text-4xl font-black text-slate-900">{data.student_count}</p>
                </div>
                <Users className="w-24 h-24 absolute -right-4 -bottom-4 text-slate-50 group-hover:scale-110 transition-transform" />
             </div>
             <div className="bg-emerald-500 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-200 flex items-center justify-between overflow-hidden relative group hover:shadow-emerald-300 transition-all">
                <div className="relative z-10">
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-100 mb-2">Overall Best</p>
                   <p className="text-4xl font-black">{data.overall_best?.student_name?.split(' ')[0]}</p>
                   <p className="text-xs font-bold opacity-80 mt-1">{data.overall_best?.average}% AVG</p>
                </div>
                <Trophy className="w-24 h-24 absolute -right-4 -bottom-4 text-emerald-400/50 group-hover:scale-110 transition-transform" />
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Overall Standings */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
               <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
                  <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-3">
                     <Award className="w-5 h-5 text-amber-400" />
                     Overall Standings (Top {topN})
                  </h3>
               </div>
               <div className="divide-y divide-slate-50">
                  {data.overall_winners?.map((w: any) => (
                    <div key={w.student_id} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition-colors group">
                       <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center font-black text-xl shadow-lg border
                          ${w.rank === 1 ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100' 
                          : w.rank === 2 ? 'bg-slate-50 text-slate-500 border-slate-100 shadow-slate-100' 
                          : 'bg-orange-50 text-orange-600 border-orange-100 shadow-orange-100'}`}>
                          {w.rank}
                       </div>
                       <div className="flex-1">
                          <h4 className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{w.student_name}</h4>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{w.reg_number}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-2xl font-black text-slate-900 leading-none">{w.average}%</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Weighted Avg</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Subject Excellence */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col max-h-[600px]">
               <div className="px-8 py-6 bg-slate-50 border-b border-slate-100">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm flex items-center gap-3">
                     <Star className="w-5 h-5 text-indigo-500" />
                     Subject Excellence Awards
                  </h3>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="divide-y divide-slate-50">
                    {Object.entries(data.subject_best || {}).map(([sub, best]: [string, any]) => (
                      <div key={sub} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[1rem] bg-indigo-50 border border-indigo-100 flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-colors">
                              <BookOpen className="w-5 h-5 text-indigo-600 group-hover:text-white transition-colors" />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 text-sm uppercase group-hover:text-indigo-600 transition-colors">{sub}</h4>
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{best.student_name}</p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-sm shadow-sm">
                            {best.score}
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}