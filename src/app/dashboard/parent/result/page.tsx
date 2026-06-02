'use client';

import React, { useState, useEffect } from 'react';
import { useWard } from '@/context/WardContext';
import { resultViewAPI, api } from '@/lib/api';
import { 
  FileText, Award, AlertCircle, Loader2, Download, Printer, 
  ChevronRight, BookOpen, UserCheck, ShieldCheck, CheckCircle2
} from 'lucide-react';

export default function CurrentResultPage() {
  const { selectedWard, loading: wardLoading } = useWard();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedWard) {
      fetchCurrentResult();
    }
  }, [selectedWard]);

  const fetchCurrentResult = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // 1. Find the current period for the ward's section
      // We need ward's section. Let's assume the selectedWard object has it or we fetch it.
      // If missing, we'll try to find any active period.
      const periodRes = await api.get('/api/school/session-periods/current/');
      const periodId = periodRes.data.data?.id;

      if (!periodId) {
        setError("No active academic term found.");
        return;
      }

      // 2. Fetch the result
      const res = await resultViewAPI.studentSheet({
        student_id: selectedWard!.id,
        period_id: periodId
      });
      setResult(res);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError("Result not yet available. Your child's result hasn't been published for the current term.");
      } else {
        setError("Failed to load result. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (wardLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  if (!selectedWard) return <div className="p-8 text-center text-slate-500 bg-white rounded-3xl border border-dashed">Select a child to view results.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Current Term Result</h1>
          <p className="text-sm text-slate-500 font-medium">Academic performance for the active term</p>
        </div>
        {result && (
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 transition-all"
          >
            <Printer className="w-4 h-4" /> Print / Download PDF
          </button>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : error ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800">Result Status</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
            {error}
          </p>
        </div>
      ) : result ? (
        <div className="space-y-6">
          
          {/* Summary Cards (Mobile First) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-indigo-600 p-5 rounded-3xl text-white shadow-lg shadow-indigo-100">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Average</p>
              <p className="text-2xl font-black">{result.average_score}%</p>
            </div>
            <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-lg shadow-slate-200">
              <p className="text-[10px] font-black opacity-60 uppercase tracking-widest mb-1">Position</p>
              <p className="text-2xl font-black">{result.position || '—'}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Score</p>
              <p className="text-2xl font-black text-slate-900">{result.total_score}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Class Avg</p>
              <p className="text-2xl font-black text-slate-900">{result.class_average || '—'}%</p>
            </div>
          </div>

          {/* Scores - Card Layout on Mobile */}
          <div className="space-y-4 md:hidden">
            <h3 className="font-bold text-slate-800 px-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" /> Subject Breakdown
            </h3>
            {result.subjects?.map((s: any, idx: number) => (
              <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-800">{s.name}</h4>
                  <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-black">
                    {s.grade}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 border-t border-slate-50 pt-3">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</p>
                    <p className="font-bold text-slate-700">{s.total}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avg</p>
                    <p className="font-bold text-slate-700">{s.average || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pos</p>
                    <p className="font-bold text-slate-700">{s.position || '—'}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Remark</p>
                  <p className="text-xs text-slate-600 font-medium italic">"{s.remark || 'N/A'}"</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Subject</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Score</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Grade</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Position</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {result.subjects?.map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{s.name}</td>
                    <td className="px-6 py-4 text-center font-black text-indigo-600">{s.total}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-black">
                        {s.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-500">{s.position || '—'}</td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-medium italic">"{s.remark || 'N/A'}"</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Behaviors & Traits Section */}
          {result.behaviors && result.behaviors.length > 0 && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500" /> Behavioral Assessment & Traits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {result.behaviors.map((b: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm font-bold text-slate-600">{b.name}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <div 
                          key={star} 
                          className={`w-4 h-4 rounded-sm ${star <= b.score ? 'bg-amber-400' : 'bg-slate-100'}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Teacher & Principal Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Teacher's Remark</p>
                <p className="text-sm text-slate-700 font-medium leading-relaxed italic">"{result.teacher_remark || 'No remark provided.'}"</p>
             </div>
             <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Principal's Remark</p>
                <p className="text-sm text-indigo-900 font-bold leading-relaxed italic">"{result.principal_remark || 'No remark provided.'}"</p>
             </div>
          </div>

        </div>
      ) : null}

    </div>
  );
}
