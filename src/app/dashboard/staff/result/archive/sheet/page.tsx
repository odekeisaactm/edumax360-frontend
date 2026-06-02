'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, resultArchiveAPI } from '@/lib/api';
import { 
  FileText, Search, Loader2, ArrowLeft, Calendar, History, Layers, GraduationCap, Box
} from 'lucide-react';

export default function ResultSheetViewer() {
  const router = useRouter();

  const [filters, setFilters] = useState({
    session_id: '',
    period_id: '',
    school_section_id: '',
    class_level_id: '',
    class_section_id: '',
    class_config_id: '',
    result_type: 'score',
  });

  const [options, setOptions] = useState({
    sessions: [] as any[],
    periods: [] as any[],
    schoolSections: [] as any[],
    classLevels: [] as any[],
    classSections: [] as any[],
    classConfigs: [] as any[],
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[] | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [sessRes, perRes, schSecRes, classLvlRes, classSecRes, classConfRes, currSessRes, currPerRes] = await Promise.all([
          api.get('/api/school/sessions/'),
          api.get('/api/school/session-periods/'),
          api.get('/api/school/sections/'),
          api.get('/api/academic/classes/'),
          api.get('/api/academic/class-sections/'),
          api.get('/api/academic/class-configurations/'),
          api.get('/api/school/sessions/current/'),
          api.get('/api/school/session-periods/current/')
        ]);
        setOptions({
          sessions: sessRes.data.data?.results || sessRes.data.data || [],
          periods: perRes.data.data?.results || perRes.data.data || [],
          schoolSections: schSecRes.data.data?.results || schSecRes.data.data || [],
          classLevels: classLvlRes.data.data?.results || classLvlRes.data.data || [],
          classSections: classSecRes.data.data?.results || classSecRes.data.data || [],
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
      } catch (err) {
        console.error('Failed to load filter options', err);
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (filters.class_level_id) {
      const config = options.classConfigs.find(c => 
        String(c.student_class) === filters.class_level_id && 
        (filters.class_section_id ? String(c.class_section) === filters.class_section_id : true)
      );
      setFilters(prev => ({ ...prev, class_config_id: config ? String(config.id) : '' }));
    }
  }, [filters.class_level_id, filters.class_section_id, options.classConfigs]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.session_id || !filters.period_id || !filters.class_config_id) return;
    setLoading(true);
    setData(null);

    try {
      const res = await resultArchiveAPI.pastClassList({
        session_id: Number(filters.session_id),
        period_id: Number(filters.period_id),
        class_id: Number(filters.class_config_id),
        result_type: filters.result_type,
      });
      setData(res);
    } catch (err) {
      alert("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const filteredClasses = filters.school_section_id 
    ? options.classLevels.filter(c => String(c.school_section) === filters.school_section_id)
    : options.classLevels;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
      
      <div className="flex items-center gap-4 mt-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-200 transform -rotate-3">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Result Sheet Finder</h1>
          <p className="text-sm text-slate-500 font-bold">Instantly retrieve and preview past student result sheets</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-5 items-end">
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Session</label><select value={filters.session_id} onChange={e => setFilters({...filters, session_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required><option value="">Select Session</option>{options.sessions?.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><History className="w-3 h-3" /> Term</label><select value={filters.period_id} onChange={e => setFilters({...filters, period_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required><option value="">Select Term</option>{options.periods?.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Sch. Section</label><select value={filters.school_section_id} onChange={e => setFilters({...filters, school_section_id: e.target.value, class_level_id: ''})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"><option value="">Any Section</option>{options.schoolSections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> Class Level</label><select value={filters.class_level_id} onChange={e => setFilters({...filters, class_level_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required><option value="">Select Class</option>{filteredClasses?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5"><Box className="w-3 h-3" /> Class Arm</label><select value={filters.class_section_id} onChange={e => setFilters({...filters, class_section_id: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"><option value="">All Arms</option>{options.classSections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">Result Type</label><select value={filters.result_type} onChange={e => setFilters({...filters, result_type: e.target.value})} className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700" required><option value="score">Score Based</option><option value="text">Qualitative</option><option value="combined">Combined</option></select></div>
          <div className="md:col-span-1 lg:col-span-2 flex justify-end"><button type="submit" disabled={loading || !filters.class_config_id} className="h-[46px] px-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50">{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />} PULL SHEETS</button></div>
        </form>
      </div>

      {data && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-black text-slate-900 uppercase tracking-tight text-xl">Historical Dataset · {data.length} Records</h3>
          </div>
          {data.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center"><Box className="w-12 h-12 text-slate-100 mb-3" /><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No records found for selection.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8 bg-slate-50/30">
              {data.map((student: any) => (
                <div key={student.student_id} className="bg-white border border-slate-100 rounded-3xl p-5 flex items-center gap-5 hover:shadow-2xl hover:shadow-indigo-100 transition-all group">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center font-black text-indigo-400 overflow-hidden shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-colors">{student.image ? <img src={student.image} alt="" className="w-full h-full object-cover" /> : student.name?.[0]}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-800 text-sm truncate uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{student.name}</h4>
                    <p className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">{student.reg_number}</p>
                    {student.has_result ? (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest">{student.average_score}% AVG</div>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">PENDING</div>
                    )}
                  </div>
                  <button onClick={() => router.push(`/dashboard/staff/result/print/preview?student_id=${student.student_id}&period_id=${filters.period_id}`)} disabled={!student.has_result} className="w-10 h-10 bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-20 shadow-sm"><FileText className="w-5 h-5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
