'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, academicAPI } from '@/lib/api';
import {
  InvoiceGenerationJob,
  Session,
  AcademicSessionPeriod,
  ClassModel,
} from '@/lib/types';
import {
  ArrowLeft, Check, X, AlertCircle, Loader2,
  FileText, Calendar, Info, Layers, Play,
  Zap, Clock, BarChart3, TrendingUp, Box, Plus,
  RefreshCw, History, CheckCircle2, AlertTriangle,
  Settings, ChevronDown, Users
} from 'lucide-react';

// ─── Style Helpers ───────────────────────────────────────────────────────────

const labelCls = 'block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide';
const selectCls = 'w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 text-slate-800 bg-white transition-all appearance-none';

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto transition-all animate-in fade-in slide-in-from-right-4
            ${t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span className="text-sm font-bold">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Page Implementation ──────────────────────────────────────────────────────

export default function InvoiceGenerationPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const showToast = (type: Toast['type'], message: string) => {
    const tid = ++counter.current;
    setToasts(p => [...p, { id: tid, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== tid)), 5000);
  };

  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allPeriods, setAllPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [jobs, setJobs] = useState<InvoiceGenerationJob[]>([]);
  
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<InvoiceGenerationJob | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, pData, cData, jData] = await Promise.all([
        academicCalendarAPI.listSessions(),
        academicCalendarAPI.listSessionPeriods(),
        academicAPI.listClasses({ is_active: true }),
        feeAPI.getGenerationJobs({ limit: 5 }),
      ]);
      
      setSessions(sData);
      setAllPeriods(pData);
      setClasses(cData);
      setJobs(Array.isArray(jData) ? jData : ((jData as any).results || []));

      // Auto-select current session
      const current = sData.find(s => s.is_active);
      if (current) {
        setSelectedSession(current.id.toString());
        // Auto-select current period
        const currentPeriod = pData.find(p => p.session?.id === current.id && p.is_current);
        if (currentPeriod) setSelectedPeriod(currentPeriod.id.toString());
      }

    } catch (err: any) {
      showToast('error', 'Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);

  // Polling logic
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const status = await feeAPI.getJobStatus(jobId);
      setActiveJob(status);
      
      if (status.is_complete) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setActiveJobId(null);
        showToast(status.status === 'success' ? 'success' : 'error', 
          status.status === 'success' ? 'Invoice generation completed successfully!' : 'Generation failed.');
        loadInitialData(); // Refresh history
      }
    } catch (err) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setActiveJobId(null);
    }
  }, [loadInitialData]);

  useEffect(() => {
    if (activeJobId) {
      pollingRef.current = setInterval(() => pollJobStatus(activeJobId), 2000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeJobId, pollJobStatus]);

  const handleStartJob = async () => {
    if (!selectedSession || !selectedPeriod || selectedClasses.length === 0) {
      showToast('error', 'Please select a Session, Period, and at least one Class');
      return;
    }

    setIsStarting(true);
    try {
      const job = await feeAPI.startGenerationJob({
        session_id: parseInt(selectedSession),
        period_id: parseInt(selectedPeriod),
        class_ids: selectedClasses,
      });
      
      setActiveJobId(job.id);
      setActiveJob(job);
      showToast('success', 'Generation job started in the background.');
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to start generation job');
    } finally {
      setIsStarting(false);
    }
  };

  const toggleClass = (id: number) => {
    setSelectedClasses(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const filteredPeriods = allPeriods.filter(p => p.session?.id === parseInt(selectedSession));

  if (loading) return (
    <div className="min-h-[500px] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <Loader2 className="h-14 w-14 text-emerald-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
           <FileText className="h-5 w-5 text-emerald-600 font-bold" />
        </div>
      </div>
      <p className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">Initializing Generator...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24">
      <ToastStack toasts={toasts} onRemove={(tid) => setToasts(p => p.filter(t => t.id !== tid))} />

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <button onClick={() => router.push('/dashboard/staff/fee/invoices')}
            className="p-3.5 text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all active:scale-90 shadow-hover">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/20 rounded-full translate-x-3 -translate-y-3 blur-md" />
             <Play className="h-7 w-7 text-emerald-400 fill-emerald-400 drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Generate Invoices</h1>
            <p className="text-sm text-slate-500 font-medium">Bulk billing engine for automated termly invoices</p>
          </div>
        </div>

        {!activeJobId ? (
           <button onClick={handleStartJob} disabled={isStarting || selectedClasses.length === 0}
             className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black rounded-2xl hover:opacity-95 shadow-2xl shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 group">
             {isStarting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 group-hover:scale-110 transition-transform" />}
             START GENERATION RUN
           </button>
        ) : (
           <div className="flex items-center gap-3 px-8 py-4 bg-emerald-50 border-2 border-emerald-200 text-emerald-700 font-black rounded-2xl shadow-inner">
              <Loader2 className="h-5 w-5 animate-spin" />
              IN PROGRESS...
           </div>
        )}
      </div>

      {activeJob && (
        <div className="bg-white rounded-[32px] border-2 border-emerald-500/30 p-8 shadow-2xl shadow-emerald-500/10 animate-in zoom-in-95 duration-500">
           <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
                    <RefreshCw className="h-6 w-6 animate-spin-slow" />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Live Generation Status</h3>
                    <p className="text-xs font-bold text-slate-400">System is processing {activeJob.total_students} student invoices</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-2xl font-black text-emerald-600 tracking-tighter">{activeJob.progress_pct}%</p>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed</p>
              </div>
           </div>

           <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mb-6 shadow-inner">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-1000 ease-out shadow-lg"
                style={{ width: `${activeJob.progress_pct}%` }}
              />
           </div>

           <div className="grid grid-cols-3 gap-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Processed</p>
                 <p className="text-xl font-black text-slate-800">{activeJob.processed_students}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                 <p className="text-[10px] font-black text-red-400 uppercase mb-1">Failed</p>
                 <p className="text-xl font-black text-red-600">{activeJob.failed_students}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                 <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Remaining</p>
                 <p className="text-xl font-black text-blue-600">{activeJob.total_students - activeJob.processed_students}</p>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Run Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-7 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center gap-3">
               <Settings className="h-4 w-4 text-emerald-500" />
               <h2 className="text-xs font-black uppercase tracking-widest text-slate-800 font-bold">Scope Context</h2>
            </div>
            <div className="p-7 space-y-6">
              <div>
                <label className={labelCls}>Academic Session</label>
                <div className="relative">
                   <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} className={selectCls}>
                     <option value="">Select Session...</option>
                     {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
                   </select>
                   <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Academic Period</label>
                <div className="relative">
                   <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className={selectCls} disabled={!selectedSession}>
                     <option value="">Select Period...</option>
                     {filteredPeriods.map(p => <option key={p.id} value={p.id}>{p.period?.name}</option>)}
                   </select>
                   <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/50 rounded-[32px] border border-indigo-100/40 p-7 flex items-start gap-4 shadow-sm">
            <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-1" />
            <div>
              <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider mb-2">Safe Execution</h4>
              <p className="text-[11px] text-indigo-800/80 leading-relaxed font-semibold">
                Invoice generation is <strong>idempotent</strong>. Re-running a job for the same student will not create duplicate invoices or items; it only fills in missing ones.
              </p>
            </div>
          </div>
        </div>

        {/* Class Selector */}
        <div className="lg:col-span-2">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Select Target Classes</h3>
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedClasses(classes.map(c => c.id))}
                      className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 transition-colors uppercase tracking-tighter">SELECT ALL</button>
                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                    <button onClick={() => setSelectedClasses([])}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-tighter">CLEAR</button>
                 </div>
              </div>
              
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                 {classes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50">
                       <Box className="h-12 w-12" />
                       <p className="font-bold italic">No active classes found.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                       {classes.map(cls => {
                          const isSelected = selectedClasses.includes(cls.id);
                          return (
                             <button key={cls.id} onClick={() => toggleClass(cls.id)}
                               className={`group relative p-5 rounded-2xl border-2 transition-all duration-300 text-left overflow-hidden
                                 ${isSelected 
                                   ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-500/20 translate-y-[-2px]' 
                                   : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/30'}`}>
                                
                                <div className="flex items-center justify-between relative z-10">
                                   <p className="text-xs font-black uppercase tracking-tight truncate pr-4">{cls.name}</p>
                                   {isSelected ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 text-emerald-400 transition-opacity" />}
                                </div>
                                <div className={`absolute top-0 right-0 w-16 h-16 rounded-full translate-x-8 -translate-y-8 blur-2xl transition-colors
                                  ${isSelected ? 'bg-white/10' : 'bg-emerald-500/5'}`} />
                             </button>
                          );
                       })}
                    </div>
                 )}
              </div>

              <div className="px-8 py-5 border-t border-slate-50 bg-slate-50/20 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedClasses.length} Classes in Target Scope</p>
                 </div>
              </div>
           </div>
        </div>

      </div>

      {/* History Area */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
         <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <History className="h-4 w-4 text-emerald-500" />
               <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest">Recent Activity</h3>
            </div>
            <button onClick={loadInitialData} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">
               <RefreshCw className="h-4 w-4" />
            </button>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50/30">
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Job ID</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                     <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Created</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {jobs.length === 0 ? (
                     <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-slate-300 italic font-medium">No recent generation activity found.</td>
                     </tr>
                  ) : (
                     jobs.map(job => (
                        <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-8 py-5">
                              <p className="text-xs font-mono font-bold text-slate-600">#{job.id?.toString().substring(0, 8).toUpperCase()}</p>
                           </td>
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black text-slate-900 uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                                    {typeof job.session === 'object' ? `${(job.session as any).start_year}/${(job.session as any).end_year}` : `Session ${job.session}`}
                                 </span>
                                 <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-md">
                                    {typeof job.period === 'object' ? (job.period as any).name : `Period ${job.period}`}
                                 </span>
                              </div>
                           </td>
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                 <div className={`w-2 h-2 rounded-full ${
                                   job.status === 'success' ? 'bg-emerald-500' : 
                                   job.status === 'failure' ? 'bg-red-500' : 
                                   'bg-amber-500 animate-pulse'
                                 }`} />
                                 <span className={`text-[10px] font-black uppercase tracking-tighter ${
                                   job.status === 'success' ? 'text-emerald-600' : 
                                   job.status === 'failure' ? 'text-red-600' : 
                                   'text-amber-600'
                                 }`}>
                                    {job.status_display || job.status}
                                 </span>
                              </div>
                           </td>
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-4">
                                 <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                    <div className={`h-full ${job.status === 'failure' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${job.progress_pct}%` }} />
                                 </div>
                                 <span className="text-[10px] font-black text-slate-400 whitespace-nowrap">{job.processed_students} / {job.total_students}</span>
                              </div>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <p className="text-[10px] font-bold text-slate-400">{new Date(job.created_at).toLocaleString()}</p>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
}