'use client';

import React, { useState, useEffect } from 'react';
import { useWard } from '@/context/WardContext';
import { resultViewAPI, resultArchiveAPI, api } from '@/lib/api';
import { 
  Award, TrendingUp, Star, FileText, ChevronRight, AlertCircle, 
  Loader2, Zap, LayoutDashboard, Target, GraduationCap
} from 'lucide-react';
import Link from 'next/link';

export default function ParentDashboard() {
  const { selectedWard, loading: wardLoading } = useWard();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    if (selectedWard) {
      fetchDashboardData();
    }
  }, [selectedWard]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Get student's history to find latest term
      const history = await resultArchiveAPI.studentHistory({ student_id: selectedWard!.id });
      
      if (history && history.length > 0) {
        const latest = history[0];
        setStats({
          average: latest.average_score,
          class_name: latest.class_name,
          period: latest.period_name,
          session: latest.session_name,
        });

        // 2. Generate Insight (compare last 2 if exist)
        if (history.length >= 2) {
          const curr = history[0].average_score;
          const prev = history[1].average_score;
          if (curr !== null && prev !== null) {
            const diff = (curr - prev).toFixed(1);
            if (Number(diff) > 0) {
              setInsight(`Your child's overall average improved by ${diff}% compared to last term.`);
            } else if (Number(diff) < 0) {
              setInsight(`Overall average declined by ${Math.abs(Number(diff))}% since last term. Focus on core subjects.`);
            }
          }
        } else {
          setInsight("Welcome to the new term! Track your child's progress as results are published.");
        }
      } else {
        setStats(null);
        setInsight("No results published yet for this session.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (wardLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!selectedWard) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <GraduationCap className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-xl font-black text-slate-800">No Ward Selected</h3>
        <p className="text-slate-500 max-w-xs mt-2">Please select a child to view their dashboard.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      {/* Welcome Card */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-200">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="relative">
              <img 
                src={selectedWard.image || '/images/default-avatar.png'} 
                alt={selectedWard.first_name}
                className="w-20 h-20 md:w-28 md:h-28 rounded-3xl object-cover border-4 border-slate-800 shadow-xl"
              />
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-8 h-8 rounded-2xl flex items-center justify-center border-4 border-slate-900 shadow-lg">
                <Zap className="w-4 h-4 text-white fill-current" />
              </div>
            </div>
            <div>
              <p className="text-indigo-400 font-bold text-xs uppercase tracking-[0.2em] mb-2">Welcome Back</p>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                {selectedWard.first_name} {selectedWard.last_name}
              </h1>
              <p className="text-slate-400 font-medium mt-1">
                {selectedWard.current_class_name} · {selectedWard.registration_number}
              </p>
            </div>
          </div>
          
          <Link href="/dashboard/parent/result" className="inline-flex items-center gap-3 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-900/20 group">
            View Current Result
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Award className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Average Score</p>
            <p className="text-2xl font-black text-slate-900">{stats?.average ? `${stats.average}%` : '—'}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <Target className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Class Position</p>
            <p className="text-2xl font-black text-slate-900">Coming Soon</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center">
            <Star className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Best Subject</p>
            <p className="text-2xl font-black text-slate-900">Coming Soon</p>
          </div>
        </div>
      </div>

      {/* Insight Card */}
      {insight && (
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-center gap-8">
          <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h4 className="text-xl font-black mb-2 tracking-tight">Academic Insight</h4>
            <p className="text-indigo-100 font-medium leading-relaxed">
              {insight}
            </p>
          </div>
        </div>
      )}

      {/* Quick Links / Empty State */}
      {!stats && !loading && (
        <div className="bg-white p-12 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
          <AlertCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800">No Published Results</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2">
            The school has not yet published any results for the current academic session. 
            Check back soon or contact the school office.
          </p>
        </div>
      )}

    </div>
  );
}
