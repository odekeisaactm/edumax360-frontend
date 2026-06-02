'use client';

import React, { useState, useEffect } from 'react';
import { useWard } from '@/context/WardContext';
import { resultViewAPI, api } from '@/lib/api';
import { 
  Columns, Filter, Search, Loader2, AlertCircle, Download
} from 'lucide-react';

export default function ParentBroadsheetView() {
  const { selectedWard } = useWard();
  const [filters, setFilters] = useState({ session_id: '', period_id: '' });
  const [options, setOptions] = useState({ sessions: [], periods: [] });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

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
    setData(null);

    try {
      // For broadsheet, we need class_config_id. Let's find the class the ward was in during that session.
      // Easiest is to use the fullClassSpreadsheet endpoint if we have the class_config_id.
      // We can get class_config_id from the student's history for that session.
      const historyRes = await api.get('/api/result/archive/student-history/', { params: { student_id: selectedWard.id } });
      const record = historyRes.data.find((r: any) => r.session_id === Number(filters.session_id));
      
      if (!record) {
        alert("No record found for this ward in the selected session.");
        setLoading(false);
        return;
      }

      const res = await resultViewAPI.fullClassSpreadsheet({
        class_config_id: record.class_config_id || 1, // Fallback if missing
        period_id: Number(filters.period_id)
      });
      setData(res);
    } catch (err) {
      alert("Failed to load broadsheet. It might not be published for this class.");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedWard) return <div className="p-8 text-center text-slate-500">Select a child to view class broadsheets.</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
          <Columns className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Class Broadsheet</h1>
          <p className="text-sm text-slate-500 font-medium">Performance comparison with classmates</p>
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
          <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Generate
          </button>
        </form>
      </div>

      {data ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-6 md:p-8">
           <div className="mb-6 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 uppercase tracking-wide">{data.class_name} Broadsheet</h3>
              <p className="text-xs text-slate-400 font-bold bg-slate-50 px-3 py-1 rounded-lg">Horizontal scroll to view subjects →</p>
           </div>

           <div className="overflow-x-auto -mx-6 md:-mx-8">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-4 py-3 border border-slate-800 text-left sticky left-0 z-10 bg-slate-900">Student Name</th>
                    {Object.values(data.rows[0]?.subjects || {}).map((s: any) => (
                      <th key={s.name} className="px-2 py-3 border border-slate-800 min-w-[60px]">
                        {s.name?.substring(0, 3).toUpperCase()}
                      </th>
                    ))}
                    <th className="px-4 py-3 border border-slate-800 bg-indigo-600">Avg</th>
                    <th className="px-4 py-3 border border-slate-800 bg-slate-800">Pos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row: any) => (
                    <tr 
                      key={row.student_id} 
                      className={`${row.student_id === selectedWard.id ? 'bg-indigo-50 font-black' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className={`px-4 py-3 border border-slate-100 text-left sticky left-0 z-10 ${row.student_id === selectedWard.id ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700'}`}>
                        {row.student_name}
                        {row.student_id === selectedWard.id && <span className="ml-2 inline-block px-1.5 py-0.5 bg-indigo-600 text-white rounded text-[8px]">YOU</span>}
                      </td>
                      {Object.values(row.subjects || {}).map((s: any, idx: number) => (
                        <td key={idx} className="px-2 py-3 border border-slate-100 text-slate-600">
                          {s.total ?? '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3 border border-slate-100 text-indigo-700 font-black bg-indigo-50/30">{row.average_score}%</td>
                      <td className="px-4 py-3 border border-slate-100 text-slate-500 font-bold">{row.position || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           </div>
        </div>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
           <Columns className="w-10 h-10 text-slate-200 mb-3" />
           <p className="text-slate-400 font-medium text-center max-w-xs">Select session and term to view how your child ranks in their class.</p>
        </div>
      )}

    </div>
  );
}
