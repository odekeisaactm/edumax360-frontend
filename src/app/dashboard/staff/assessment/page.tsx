'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { dashboardAPI, examsAPI, aiMarkingQueueAPI } from '@/lib/api';
import {
  Zap,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';

// ─── Style constants ─────────────────────────────────────────────────────────

const cardCls = "bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8 transition-all hover:shadow-xl hover:shadow-slate-200/40";
const statLabelCls = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssessmentDashboard() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, e, q] = await Promise.all([
        dashboardAPI.getStats(),
        examsAPI.list({ limit: 5 }),
        aiMarkingQueueAPI.getStats()
      ]);
      setStats(s);
      setRecentExams(e.slice(0, 5));
      setQueueStats(q);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 text-violet-600 animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest font-mono">Loading Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 animate-in fade-in duration-700">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Assessment <span className="text-violet-600">Hub</span>
          </h1>
          <p className="text-slate-500 font-medium mt-1">Unified monitoring and configuration for all examinations</p>
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={() => router.push('/dashboard/staff/assessment/exams/create')}
             className="h-[56px] px-8 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all transform active:scale-95 flex items-center gap-3"
           >
              <Plus className="h-4 w-4" />
              Initialize Exam
           </button>
           <button onClick={fetchData} className="p-4 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm transition-all">
              <RefreshCw className="h-5 w-5" />
           </button>
        </div>
      </div>

      {/* ── Row 1: High Level Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className={cardCls}>
            <p className={statLabelCls}>Active Students</p>
            <div className="flex items-end justify-between">
               <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{stats?.students?.active}</h2>
               <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Users className="h-6 w-6" />
               </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
               <TrendingUp className="h-3 w-3" />
               <span>+{stats?.students?.new_this_term} new this term</span>
            </div>
         </div>

         <div className={cardCls}>
            <p className={statLabelCls}>Ongoing Exams</p>
            <div className="flex items-end justify-between">
               <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{stats?.exams?.ongoing}</h2>
               <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Clock className="h-6 w-6" />
               </div>
            </div>
            <p className="mt-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">{stats?.exams?.upcoming} scheduled soon</p>
         </div>

         <div className={cardCls}>
            <p className={statLabelCls}>AI Marking Queue</p>
            <div className="flex items-end justify-between">
               <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{queueStats?.total_pending || 0}</h2>
               <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600">
                  <BrainCircuit className="h-6 w-6" />
               </div>
            </div>
            <p className="mt-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Across {stats?.results?.pending} submissions</p>
         </div>

         <div className={cardCls}>
            <p className={statLabelCls}>Results Published</p>
            <div className="flex items-end justify-between">
               <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{stats?.results?.published}</h2>
               <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
                  <CheckCircle2 className="h-6 w-6" />
               </div>
            </div>
            <p className="mt-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">Last transfer: {new Date().toLocaleDateString()}</p>
         </div>
      </div>

      {/* ── Row 2: Tables ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Recent Activity / Exams */}
         <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Examinations</h3>
               <button onClick={() => router.push('/dashboard/staff/assessment/exams')} className="text-[10px] font-black text-violet-600 uppercase hover:underline">View All</button>
            </div>
            <div className="flex-1 overflow-x-auto">
               <table className="w-full">
                  <thead className="bg-slate-50/50">
                     <tr>
                        <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Exam Name</th>
                        <th className="px-8 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-8 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {recentExams.map(exam => (
                        <tr key={exam.id} className="hover:bg-slate-50/30 transition-colors">
                           <td className="px-8 py-5">
                              <p className="font-bold text-slate-800 text-sm">{exam.name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{exam.exam_type} · {exam.start_date}</p>
                           </td>
                           <td className="px-8 py-5 text-center">
                              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                 exam.is_published ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                              }`}>
                                 {exam.is_published ? 'Published' : 'Draft'}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-right">
                              <button 
                                onClick={() => router.push(`/dashboard/staff/assessment/exams/${exam.id}`)}
                                className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-violet-600 hover:text-white transition-all ml-auto"
                              >
                                 <ArrowRight className="h-4 w-4" />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Quick Actions & Marking Stats */}
         <div className="space-y-6">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl">
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Marking Hub</h3>
               <div className="space-y-4">
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex items-center justify-between">
                     <div>
                        <p className="text-2xl font-black">{queueStats?.completed_today || 0}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">AI Graded Today</p>
                     </div>
                     <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-20" />
                  </div>
                  <div className="bg-white/5 rounded-2xl p-5 border border-white/10 flex items-center justify-between">
                     <div>
                        <p className="text-2xl font-black text-rose-400">{queueStats?.failed_count || 0}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action Required</p>
                     </div>
                     <AlertCircle className="h-8 w-8 text-rose-500 opacity-20" />
                  </div>
               </div>
               <button 
                 onClick={() => router.push('/dashboard/staff/assessment/marking')}
                 className="w-full py-4 bg-white text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
               >
                  Go to Marking Hub
                  <ArrowRight className="h-4 w-4" />
               </button>
            </div>

            <div className="bg-violet-600 rounded-[2.5rem] p-8 text-white relative overflow-hidden group shadow-xl shadow-violet-200">
               <Zap className="absolute -right-4 -bottom-4 h-32 w-32 text-white/10 group-hover:scale-110 transition-transform duration-700" />
               <h3 className="text-sm font-black text-violet-200 uppercase tracking-widest mb-4">Quick Setup</h3>
               <div className="space-y-3 relative z-10">
                  {[
                    { label: 'Question Banks', icon: BookOpen, path: '/dashboard/staff/assessment/question-banks' },
                    { label: 'Manage Topics', icon: FileText, path: '/dashboard/staff/assessment/topics' },
                    { label: 'Result Transfer', icon: RefreshCw, path: '/dashboard/staff/assessment/result-transfer' },
                  ].map(action => (
                    <button 
                      key={action.label}
                      onClick={() => router.push(action.path)}
                      className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center gap-3 transition-all text-sm font-bold border border-white/5"
                    >
                       <action.icon className="h-4 w-4" />
                       {action.label}
                    </button>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
