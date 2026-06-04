'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { scannedExamsAPI } from '@/lib/api';
import {
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  ChevronRight,
  Filter,
  Search,
  BookOpen,
  Calendar,
  MoreVertical,
  AlertCircle,
  Loader2, Users,
  ScanText,RefreshCw,
} from 'lucide-react';

// ─── Style constants ─────────────────────────────────────────────────────────

const cardCls = "bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/40 transition-all p-6 group cursor-pointer border-l-4";

const STATUS_COLORS: Record<string, string> = {
  draft: "border-slate-300 bg-slate-50",
  published: "border-emerald-500 bg-emerald-50/30",
  marking: "border-violet-500 bg-violet-50/30",
  completed: "border-blue-500 bg-blue-50/30",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScannedExamsListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchQuery] = useState('');

  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_scannedexammodel');

  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scannedExamsAPI.list();
      setExams(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const filtered = exams.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-[1.25rem] flex items-center justify-center shadow-xl shadow-emerald-200">
               <ScanText className="h-6 w-6 text-white" />
            </div>
            Scanned Exams
          </h1>
          <p className="text-slate-500 font-medium mt-1 pl-15">Traditional paper exams with AI-powered marking</p>
        </div>

        {canCreate && (
          <button 
            onClick={() => router.push('/dashboard/staff/assessment/scanned-exams/create')}
            className="h-[52px] px-8 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all transform active:scale-95 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Scanned Exam
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search exams..."
            value={searchTerm}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="flex gap-2">
           <button className="p-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-colors">
              <Filter className="h-5 w-5" />
           </button>
           <button onClick={fetchExams} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-colors">
              <RefreshCw className="h-5 w-5" />
           </button>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
           <Loader2 className="h-10 w-10 text-emerald-500 animate-spin" />
           <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fetching exams...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-20 text-center">
           <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
              <FileText className="h-8 w-8 text-slate-200" />
           </div>
           <h3 className="text-xl font-bold text-slate-900 mb-2 font-black uppercase tracking-tight">No exams found</h3>
           <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto mb-8">Ready to move away from manual marking? Create your first AI-assisted scanned exam today.</p>
           {canCreate && (
             <button 
               onClick={() => router.push('/dashboard/staff/assessment/scanned-exams/create')}
               className="px-8 py-3 bg-emerald-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
             >
                Initialize First Exam
             </button>
           )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(exam => (
            <div 
              key={exam.id} 
              onClick={() => router.push(`/dashboard/staff/assessment/scanned-exams/${exam.id}`)}
              className={`${cardCls} ${STATUS_COLORS[exam.status] || STATUS_COLORS.draft}`}
            >
              <div className="flex justify-between items-start mb-6">
                 <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                    <ScanText className="h-5 w-5 text-emerald-600" />
                 </div>
                 <span className="px-3 py-1 bg-white rounded-lg border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
                    {exam.status}
                 </span>
              </div>

              <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-1 uppercase tracking-tight mb-2">
                 {exam.name}
              </h3>
              
              <div className="space-y-3">
                 <div className="flex items-center gap-3 text-slate-400">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold">{exam.session_name} · {exam.term_name}</span>
                 </div>
                 <div className="flex items-center gap-3 text-slate-400">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold line-clamp-1">{exam.subject_names?.join(', ') || 'No subjects'}</span>
                 </div>
                 <div className="flex items-center gap-3 text-slate-400">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold line-clamp-1">{exam.class_names?.join(', ') || 'No classes'}</span>
                 </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                 <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       {exam.schedules_created ? 'Schedules Ready' : 'Pending Setup'}
                    </span>
                 </div>
                 <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <ChevronRight className="h-4 w-4" />
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
