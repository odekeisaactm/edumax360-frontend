'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api, resultArchiveAPI } from '@/lib/api';
import { 
  UserCheck, Search, Loader2, ArrowLeft, Calendar, Award, History, X, CheckCircle2, AlertTriangle, AlertCircle
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

// --- Shared Utility ---
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
          className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm font-bold text-slate-700"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSearchResults([]); setShowDropdown(false); }} className="absolute right-4 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        )}
      </div>
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl z-[60] overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2">
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

export default function StudentResultHistoryViewer() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[] | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const fetchHistory = async (student: any) => {
    setLoading(true);
    setData(null);
    setSelectedStudent(student);

    try {
      const res = await resultArchiveAPI.studentHistory({
        student_id: student.id
      });
      setData(res);
    } catch (err: any) {
      showToast('error', err?.response?.data?.message || err?.message || "Failed to load student history.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 px-4">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      
      <div className="flex items-center gap-4 mt-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-12 h-12 bg-amber-500 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-amber-200 transform rotate-6">
          <UserCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Academic Trajectory</h1>
          <p className="text-sm text-slate-500 font-bold tracking-tight">Complete historical record for individual students</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="max-w-2xl">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Lookup Student</label>
          <StudentSearch onSelect={fetchHistory} placeholder="Search student name or admission number..." />
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
      ) : data && (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-[1rem] flex items-center justify-center font-black text-white shadow-lg uppercase overflow-hidden">
                    {selectedStudent?.image_url ? <img src={selectedStudent.image_url} className="w-full h-full object-cover" /> : selectedStudent?.full_name?.[0]}
                </div>
                <div>
                    <h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">{selectedStudent?.full_name}</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Enrollment No: {selectedStudent?.registration_number}</p>
                </div>
            </div>
            <div className="px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-100 shadow-sm">
               {data.length} Records Found
            </div>
          </div>
          
          {data.length === 0 ? (
            <div className="p-20 text-center">
                <History className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No historical results indexed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-10">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-white text-slate-400 border-b border-slate-100">
                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px]">Academic Term</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Assigned Class</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px]">Result Type</th>
                    <th className="px-6 py-5 font-black uppercase tracking-widest text-[10px] text-center">Average Score</th>
                    <th className="px-8 py-5 font-black uppercase tracking-widest text-[10px] text-right">Dataset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.map((record: any) => (
                    <tr key={record.result_id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shadow-inner">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-black text-slate-800">{record.period_name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{record.session_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-black text-slate-600 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-xl text-[10px] uppercase group-hover:border-indigo-200 transition-colors">
                          {record.class_name}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="font-black text-slate-500 text-[10px] uppercase tracking-widest">
                          {record.result_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        {record.average_score !== null ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl font-black text-[10px] shadow-sm border border-emerald-100">
                            {record.average_score}%
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => router.push(`/dashboard/staff/result/detail?student_id=${selectedStudent.id}&period_id=${record.period_id}&type=${record.result_type}`)}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-lg shadow-indigo-100 transform active:scale-95"
                        >
                          OPEN SHEET
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
