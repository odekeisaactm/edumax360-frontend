'use client';

import React, { useState, useEffect } from 'react';
import { useWard } from '@/context/WardContext';
import { resultViewAPI, api, resultArchiveAPI } from '@/lib/api';
import { 
  Archive, Calendar, Search, Loader2, AlertCircle, Printer, BookOpen
} from 'lucide-react';

export default function ParentResultArchive() {
  const { selectedWard } = useWard();
  const [filters, setFilters] = useState({ session_id: '', period_id: '' });
  const [options, setOptions] = useState({ sessions: [], periods: [] });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!filters.session_id || !filters.period_id || !selectedWard) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await resultViewAPI.studentSheet({
        student_id: selectedWard.id,
        period_id: Number(filters.period_id)
      });
      setResult(res);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError("No result found for the selected term.");
      } else {
        setError("Failed to load result.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!selectedWard) return <div className="p-8 text-center text-slate-500">Select a child to view archived results.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center shadow-lg">
          <Archive className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Result Archive</h1>
          <p className="text-sm text-slate-500">View past academic records</p>
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
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            View Result
          </button>
        </form>
      </div>

      {result ? (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
           <div className="flex justify-between items-center pb-6 border-b border-slate-50">
              <div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{result.student_name}</h3>
                <p className="text-sm text-slate-500 font-medium">{result.period_name} · {result.session_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average</p>
                <p className="text-2xl font-black text-indigo-600">{result.average_score}%</p>
              </div>
           </div>

           {/* Simple List for Archive View */}
           <div className="space-y-3">
             {result.subjects?.map((s: any, idx: number) => (
               <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
                 <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-slate-400 text-xs shadow-sm">
                     {s.name[0]}
                   </div>
                   <div>
                     <p className="font-bold text-slate-800">{s.name}</p>
                     <p className="text-[10px] text-slate-400 font-medium italic">"{s.remark || 'No remark'}"</p>
                   </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                      <p className="font-black text-slate-700">{s.total}</p>
                    </div>
                    <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-xs">
                      {s.grade}
                    </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      ) : error ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">{error}</p>
        </div>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
           <Calendar className="w-10 h-10 text-slate-200 mb-3" />
           <p className="text-slate-400 font-medium">Select a session and term to view historical results.</p>
        </div>
      )}

    </div>
  );
}
