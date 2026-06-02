'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { scannedExamsAPI } from '@/lib/api';
import {
  ArrowLeft,
  ScanText,
  Calendar,
  Layers,
  BookOpen,
  Users,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Settings,
  MoreVertical,
  Plus,
} from 'lucide-react';

// ─── Style constants ─────────────────────────────────────────────────────────

const groupCls = "bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-4";
const scheduleRowCls = "px-6 py-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all flex items-center justify-between group cursor-pointer";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScannedExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  
  const examId = Number(params.id);
  
  const [exam, setExam] = useState<any | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [examData, schedulesData] = await Promise.all([
        scannedExamsAPI.get(examId),
        scannedExamsAPI.getSchedules(examId),
      ]);
      setExam(examData);
      setSchedules(schedulesData);
      
      // Auto-expand all
      const ids = new Set<number>(schedulesData.map((s: any) => s.subject));
      setExpandedSubjects(ids);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSubject = (id: number) => {
    setExpandedSubjects(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  // Grouping
  const schedulesBySubject = schedules.reduce((acc, s) => {
    if (!acc[s.subject]) acc[s.subject] = { name: s.subject_name, schedules: [] };
    acc[s.subject].schedules.push(s);
    return acc;
  }, {} as Record<number, { name: string, schedules: any[] }>);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Scanning configurations...</p>
      </div>
    );
  }

  if (!exam) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <button 
          onClick={() => router.push('/dashboard/staff/assessment/scanned-exams')}
          className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all shadow-sm mt-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
           <div className="flex items-center justify-between mb-2">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{exam.name}</h1>
              <span className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-slate-200">
                 {exam.status}
              </span>
           </div>
           <div className="flex items-center gap-6 text-slate-400 text-sm font-bold">
              <div className="flex items-center gap-2">
                 <Calendar className="h-4 w-4 text-emerald-500" />
                 {exam.session_name} · {exam.term_name}
              </div>
              <div className="flex items-center gap-2">
                 <Layers className="h-4 w-4 text-emerald-500" />
                 {schedules.length} Exam Schedules
              </div>
           </div>
        </div>
      </div>

      {/* ── Subject Groups ── */}
      <div className="space-y-6">
         {Object.entries(schedulesBySubject).map(([subId, group]: any) => (
           <div key={subId} className={groupCls}>
              <button 
                onClick={() => toggleSubject(Number(subId))}
                className="w-full px-8 py-5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100"
              >
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                       <BookOpen className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="text-left">
                       <h3 className="font-black text-slate-800 uppercase tracking-wide">{group.name}</h3>
                       <p className="text-[10px] font-bold text-slate-400">{group.schedules.length} class configurations</p>
                    </div>
                 </div>
                 {expandedSubjects.has(Number(subId)) ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
              </button>

              {expandedSubjects.has(Number(subId)) && (
                <div className="divide-y divide-slate-50">
                   {group.schedules.map((s: any) => (
                     <div 
                       key={s.id} 
                       onClick={() => router.push(`/dashboard/staff/assessment/scanned-exams/${exam.id}/schedule/${s.id}`)}
                       className={scheduleRowCls}
                     >
                        <div className="flex items-center gap-4">
                           <div className="text-left">
                              <p className="font-bold text-slate-700 text-sm">{s.class_name} {s.section_name}</p>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${
                                   s.question_setup_status === 'ready' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                 }`}>
                                    {s.question_setup_status.replace('_',' ')}
                                 </span>
                                 <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {s.submission_count} / {s.student_count} Students
                                 </span>
                              </div>
                           </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all opacity-0 group-hover:opacity-100">
                           <ChevronRight className="h-4 w-4" />
                        </div>
                     </div>
                   ))}
                </div>
              )}
           </div>
         ))}
      </div>
    </div>
  );
}
