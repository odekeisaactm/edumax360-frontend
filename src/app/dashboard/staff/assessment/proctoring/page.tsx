'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Shield, Clock, Users, AlertTriangle, CheckCircle2,
  ChevronRight, RefreshCw, Loader2, AlertCircle, X, Check,
  Activity, Eye, Radio, BookOpen, Calendar, Zap,
  TrendingUp, UserX, Monitor, Search
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProctoringSchedule {
  id: number;
  exam_id: number;
  exam_name: string;
  exam_type: string;
  subject_name: string;
  subject_code: string;
  class_name: string;
  section_name: string | null;
  exam_code: string;
  start_datetime: string;
  end_datetime: string;
  final_deadline: string;
  duration_minutes: number;
  setup_status: string;
  lifecycle_status: string;
  hall: string | null;
  total_students: number;
  in_progress: number;
  submitted: number;
  flagged: number;
  not_started: number;
  time_remaining_seconds: number;
}

interface SchedulesData {
  in_progress: ProctoringSchedule[];
  upcoming: ProctoringSchedule[];
  completed: ProctoringSchedule[];
  summary: {
    total: number;
    in_progress: number;
    upcoming: number;
    completed: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateTime(dt: string): string {
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d?.detail) return d.detail;
  if (d?.error) return d.error;
  if (typeof d === 'string') return d;
  return err?.message || 'An error occurred';
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span className="text-sm font-medium flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StudentProgress({ schedule }: { schedule: ProctoringSchedule }) {
  const total = schedule.total_students || 1;
  const submittedPct = (schedule.submitted / total) * 100;
  const activePct = (schedule.in_progress / total) * 100;
  const notStartedPct = (schedule.not_started / total) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{total} students</span>
        <div className="flex items-center gap-3">
          {schedule.in_progress > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {schedule.in_progress} active
            </span>
          )}
          {schedule.submitted > 0 && (
            <span className="text-emerald-600">{schedule.submitted} submitted</span>
          )}
          {schedule.flagged > 0 && (
            <span className="text-red-600">{schedule.flagged} flagged</span>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${submittedPct}%` }} />
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${activePct}%` }} />
        <div className="h-full bg-slate-200 transition-all" style={{ width: `${notStartedPct}%` }} />
      </div>
    </div>
  );
}

// ─── Schedule Card ────────────────────────────────────────────────────────────

function ScheduleCard({ schedule, onMonitor }: {
  schedule: ProctoringSchedule;
  onMonitor: (s: ProctoringSchedule) => void;
}) {
  const isLive = schedule.lifecycle_status === 'ongoing';
  const isUpcoming = schedule.lifecycle_status === 'upcoming';
  const isDone = schedule.lifecycle_status === 'completed';

  const [localRemaining, setLocalRemaining] = useState(schedule.time_remaining_seconds);

  useEffect(() => {
    if (!isLive || localRemaining <= 0) return;
    const t = setInterval(() => setLocalRemaining(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [isLive, localRemaining]);

  useEffect(() => {
    setLocalRemaining(schedule.time_remaining_seconds);
  }, [schedule.time_remaining_seconds]);

  const urgency = localRemaining < 600 && isLive;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all
      ${isLive ? 'border-blue-200 hover:border-blue-300' : isDone ? 'border-slate-100' : 'border-slate-100 hover:border-slate-200'}`}>
      <div className="p-5">
        <div className="flex items-start gap-4">

          {/* Left: icon */}
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            isLive ? 'bg-blue-100' : isDone ? 'bg-slate-100' : 'bg-violet-100'
          }`}>
            {isLive
              ? <Radio className="h-5 w-5 text-blue-600" />
              : isDone
              ? <CheckCircle2 className="h-5 w-5 text-slate-400" />
              : <Clock className="h-5 w-5 text-violet-600" />}
          </div>

          {/* Center: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base">{schedule.subject_name}</h3>
              {schedule.subject_code && (
                <span className="text-xs text-slate-400 font-mono">({schedule.subject_code})</span>
              )}
              {isLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping absolute" />
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 relative" />
                  LIVE
                </span>
              )}
              {schedule.flagged > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle className="h-3 w-3" />
                  {schedule.flagged} flagged
                </span>
              )}
            </div>

            <p className="text-sm text-slate-500 mb-3">
              {schedule.exam_name} · {schedule.class_name}
              {schedule.section_name ? ` (${schedule.section_name})` : ''}
              {schedule.hall ? ` · ${schedule.hall}` : ''}
            </p>

            {/* Time info */}
            <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(schedule.start_datetime)}
              </span>
              <span>{formatDateTime(schedule.start_datetime)} – {formatDateTime(schedule.end_datetime)}</span>
              <span>{schedule.duration_minutes} min</span>
              <span className="font-mono text-slate-400">{schedule.exam_code}</span>
              {isLive && localRemaining > 0 && (
                <span className={`font-semibold flex items-center gap-1 ${urgency ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>
                  <Clock className="h-3 w-3" />
                  {formatTime(localRemaining)} left
                </span>
              )}
            </div>

            {/* Progress bar */}
            {(isLive || isDone) && <StudentProgress schedule={schedule} />}

            {isUpcoming && (
              <p className="text-xs text-violet-600 font-medium">
                Starts {formatDateTime(schedule.start_datetime)} · {schedule.total_students} students expected
              </p>
            )}
          </div>

          {/* Right: action */}
          <div className="shrink-0">
            {isLive ? (
              <button
                onClick={() => onMonitor(schedule)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm shadow-blue-200">
                <Monitor className="h-4 w-4" />
                Monitor
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : isDone ? (
              <button
                onClick={() => onMonitor(schedule)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition-colors">
                <Eye className="h-4 w-4" />
                Review
              </button>
            ) : (
              <button
                onClick={() => onMonitor(schedule)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-sm font-semibold rounded-xl transition-colors">
                <Eye className="h-4 w-4" />
                View
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Divider ──────────────────────────────────────────────────────────

function SectionDivider({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={`h-px flex-1 ${color === 'blue' ? 'bg-blue-100' : color === 'violet' ? 'bg-violet-100' : 'bg-slate-100'}`} />
      <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
        color === 'blue'
          ? 'text-blue-700 bg-blue-50 border-blue-200'
          : color === 'violet'
          ? 'text-violet-700 bg-violet-50 border-violet-200'
          : 'text-slate-500 bg-slate-50 border-slate-200'
      }`}>
        {label} ({count})
      </span>
      <div className={`h-px flex-1 ${color === 'blue' ? 'bg-blue-100' : color === 'violet' ? 'bg-violet-100' : 'bg-slate-100'}`} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProctoringSelector() {
  const router = useRouter();
  const { user } = useAuth();

  const [data, setData] = useState<SchedulesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const [selectedExamId, setSelectedExamId] = useState<number | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  const showToast = (type: Toast['type'], message: string) => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/api/assessment/proctoring/my-schedules/');
      setData(res.data);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleMonitor = (schedule: ProctoringSchedule) => {
    const url = `/dashboard/staff/assessment/proctoring/${schedule.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const availableExams = useMemo(() => {
    if (!data) return [];
    const examMap = new Map<number, string>();
    [...data.in_progress, ...data.upcoming, ...data.completed].forEach(s => {
      examMap.set(s.exam_id, s.exam_name);
    });
    return Array.from(examMap.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data || selectedExamId === '') return null;

    const searchLower = searchTerm.toLowerCase();

    // Helper to filter individual schedules
    const filterSchedule = (s: ProctoringSchedule) => {
      if (s.exam_id !== selectedExamId) return false;
      if (!searchLower) return true;

      return (
        s.subject_name.toLowerCase().includes(searchLower) ||
        (s.subject_code && s.subject_code.toLowerCase().includes(searchLower)) ||
        s.class_name.toLowerCase().includes(searchLower) ||
        (s.section_name && s.section_name.toLowerCase().includes(searchLower))
      );
    };

    const in_progress = data.in_progress.filter(filterSchedule);
    const upcoming = data.upcoming.filter(filterSchedule);
    const completed = data.completed.filter(filterSchedule);

    return {
      in_progress,
      upcoming,
      completed,
      summary: {
        in_progress: in_progress.length,
        upcoming: upcoming.length,
        completed: completed.length
      }
    };
  }, [data, selectedExamId, searchTerm]);

  const totalActive = filteredData?.in_progress.reduce((s, e) => s + e.in_progress, 0) ?? 0;
  const totalFlagged = filteredData?.in_progress.reduce((s, e) => s + e.flagged, 0) ?? 0;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onRemove={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Proctoring</h1>
            <p className="text-sm text-slate-500">Monitor live exams and review activity</p>
          </div>
        </div>
        <button onClick={() => fetchData(true)}
          className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Exam Selection & Search ── */}
      {!loading && data && availableExams.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Select Exam</label>
            <select
              value={selectedExamId}
              onChange={(e) => {
                setSelectedExamId(Number(e.target.value) || '');
                setSearchTerm(''); // Clear search when switching exams
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Choose an exam to view schedules --</option>
              {availableExams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>

          {selectedExamId !== '' && (
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Search Schedules</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search class, subject, section..."
                  className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Stat chips ── */}
      {!loading && filteredData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Live Exams', value: filteredData.summary.in_progress, icon: Radio, color: 'text-blue-600', bg: 'bg-blue-50', iconColor: 'text-blue-600' },
            { label: 'Active Students', value: totalActive, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
            { label: 'Flagged', value: totalFlagged, icon: AlertTriangle, color: totalFlagged > 0 ? 'text-red-600' : 'text-slate-500', bg: 'bg-red-50', iconColor: 'text-red-500' },
            { label: 'Upcoming', value: filteredData.summary.upcoming, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50', iconColor: 'text-violet-600' },
          ].map(({ label, value, icon: Icon, color, bg, iconColor }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 ${bg} rounded-xl flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Loading & Schedules ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading your assigned exams…</p>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-700">Failed to load exams</p>
        </div>
      ) : data.in_progress.length === 0 && data.upcoming.length === 0 && data.completed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">No exams assigned</h3>
          <p className="text-sm text-slate-400">
            You are not assigned as an invigilator for any published exams.
          </p>
        </div>
      ) : selectedExamId === '' ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-blue-400" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">Select an Exam</h3>
          <p className="text-sm text-slate-400">Please choose an exam from the dropdown above to view its schedules.</p>
        </div>
      ) : filteredData ? (
        filteredData.in_progress.length === 0 && filteredData.upcoming.length === 0 && filteredData.completed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No schedules found</h3>
            <p className="text-sm text-slate-400">No schedules match your current search.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* In Progress */}
            {filteredData.in_progress.length > 0 && (
              <section>
                <SectionDivider label="Live Now" count={filteredData.in_progress.length} color="blue" />
                <div className="space-y-3">
                  {filteredData.in_progress.map(s => (
                    <ScheduleCard key={s.id} schedule={s} onMonitor={handleMonitor} />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {filteredData.upcoming.length > 0 && (
              <section>
                <SectionDivider label="Upcoming" count={filteredData.upcoming.length} color="violet" />
                <div className="space-y-3">
                  {filteredData.upcoming.map(s => (
                    <ScheduleCard key={s.id} schedule={s} onMonitor={handleMonitor} />
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {filteredData.completed.length > 0 && (
              <section>
                <SectionDivider label="Completed" count={filteredData.completed.length} color="gray" />
                <div className="space-y-3">
                  {filteredData.completed.map(s => (
                    <ScheduleCard key={s.id} schedule={s} onMonitor={handleMonitor} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )
      ) : null}
    </div>
  );
}