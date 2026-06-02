'use client';

import React, { useState, useEffect } from 'react';
import { useWard } from '@/context/WardContext';
import { api } from '@/lib/api';
import { 
  FileSearch, Search, Loader2, AlertCircle, Eye, Download, BookOpen
} from 'lucide-react';

export default function ScriptViewerPage() {
  const { selectedWard } = useWard();
  const [filters, setFilters] = useState({ session_id: '', period_id: '' });
  const [options, setOptions] = useState({ sessions: [], periods: [] });
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<any[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [sessRes, perRes] = await Promise.all([
          api.get('/api/school-config/sessions/'),
          api.get('/api/school-config/academic-periods/'),
        ]);
        setOptions({
          sessions: sessRes.data.results || sessRes.data,
          periods: perRes.data.results || perRes.data,
        });
      } catch (err) {}
    };
    fetchOptions();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.period_id || !selectedWard) return;

    setLoading(true);
    setScripts([]);

    try {
      const res = await api.get('/api/result/exam-scripts/list_scripts/', {
        params: {
          student_id: selectedWard.id,
          period_id: Number(filters.period_id)
        }
      });
      setScripts(res.data);
    } catch (err) {
      alert("Failed to load scripts.");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedWard) return <div className="p-8 text-center text-slate-500">Select a child to view exam scripts.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg">
          <FileSearch className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Exam Script Viewer</h1>
          <p className="text-sm text-slate-500 font-medium">Review question papers and answer sheets</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Session</label>
            <select value={filters.session_id} onChange={e => setFilters({...filters, session_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none bg-slate-50">
              <option value="">Select Session</option>
              {options.sessions.map((s: any) => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Term</label>
            <select value={filters.period_id} onChange={e => setFilters({...filters, period_id: e.target.value})} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none bg-slate-50">
              <option value="">Select Term</option>
              {options.periods.map((p: any) => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Find Scripts
          </button>
        </form>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>
      ) : scripts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scripts.map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-purple-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-800">{item.subject_name}</h3>
               </div>
               
               <div className="space-y-2">
                 {item.qp ? (
                   <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-2xl">
                      <span className="text-xs font-bold text-indigo-700">Question Paper</span>
                      <a 
                        href={item.qp.file_data?.[0]} 
                        target="_blank" 
                        className="p-2 bg-white text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl shadow-sm transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                   </div>
                 ) : (
                   <div className="p-3 bg-slate-50 rounded-2xl text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">No Question Paper</div>
                 )}

                 {item.as ? (
                   <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl">
                      <span className="text-xs font-bold text-emerald-700">Answer Sheet</span>
                      <a 
                        href={item.as.file_data?.[0]} 
                        target="_blank" 
                        className="p-2 bg-white text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl shadow-sm transition-all"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                   </div>
                 ) : (
                   <div className="p-3 bg-slate-50 rounded-2xl text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">No Answer Sheet</div>
                 )}
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
           <FileSearch className="w-10 h-10 text-slate-200 mb-3" />
           <p className="text-slate-400 font-medium">No scripts found for the selected period.</p>
        </div>
      )}

    </div>
  );
}
