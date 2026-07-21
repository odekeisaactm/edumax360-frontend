'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import api, { activityLogsAPI, staffDashboardAPI, academicAPI, academicCalendarAPI } from '@/lib/api';
import { ActivityLog } from '@/lib/types';
import { ClassConfiguration, ClassModel, AcademicSettings, Timetable, Day, AcademicSessionPeriod } from '@/lib/types';
import { MASTER_QUICK_LINKS } from '@/lib/quickLinks';
import {
  Users, BookOpen, DollarSign, UserCheck, Shield, FileText,
  Calendar, Loader2, ChevronRight, UserCircle, Briefcase, Award, User,
  ArrowRight, Clock, ChevronDown, Coffee, Sunset, LogOut, MapPin,
  GraduationCap, Zap, TrendingUp, Activity,
} from 'lucide-react';

// ============================================================================
// HELPERS (shared)
// ============================================================================

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h > 12 ? h - 12 : h || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}
function todayDayName(): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}
function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function toTitleCase(str: string): string {
  return str
    .split(/[\s_\-/·]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const BREAK_META: Record<string, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  short:   { label: 'Short Break',  bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',  icon: <Coffee className="h-3 w-3" /> },
  long:    { label: 'Long Break',   bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: <Sunset className="h-3 w-3" /> },
  closing: { label: 'Closing',      bg: 'bg-slate-100 border-slate-200',  text: 'text-slate-600',  icon: <LogOut className="h-3 w-3" /> },
};

// ============================================================================
// STAT CARD
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  gradient: string;
  linkText: string;
  linkHref: string;
  delay?: string;
}

function StatCard({ title, value, icon: Icon, gradient, linkText, linkHref, delay = '0ms' }: StatCardProps) {
  return (
    <div
      className="relative bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 flex flex-col justify-between h-full group hover:shadow-md transition-all duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: delay }}
    >
      {/* Coloured accent strip */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${gradient}`} />

      <div className="p-5 pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-3xl font-black text-slate-900 leading-none">{value}</p>
          </div>
          <div className={`p-3 rounded-2xl ${gradient} bg-opacity-10`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>

      <div className="px-5 pb-4">
        <Link
          href={linkHref}
          className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors group/link"
        >
          {linkText}
          <ArrowRight className="h-3.5 w-3.5 group-hover/link:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

function getCategoryStyle(category: string) {
  switch (category) {
    case 'academic': return { bg: 'bg-blue-100', text: 'text-blue-600', dot: 'bg-blue-500', icon: BookOpen };
    case 'admission': return { bg: 'bg-violet-100', text: 'text-violet-600', dot: 'bg-violet-500', icon: Users };
    case 'hr': return { bg: 'bg-rose-100', text: 'text-rose-600', dot: 'bg-rose-500', icon: UserCheck };
    default: return { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', icon: Calendar };
  }
}

function getActivityTitle(activity: ActivityLog): string {
  if (activity.category === 'admission' && activity.action_type === 'create') return 'New Student Registration';
  if (activity.category === 'hr' && activity.action_type === 'create') return 'New Staff Member';
  if (activity.action_type === 'payment') return 'Fee Payment Received';
  if (activity.action_type === 'promote') return 'Student Promotion';
  if (activity.action_type === 'flagged') return 'Exam Security Flag';
  return `${activity.category_display} — ${activity.action_type_display}`;
}

// ============================================================================
// MINI TIMETABLE (embedded in dashboard)
// ============================================================================

function MiniTimetableCell({ entry, isActive, isNext }: {
  entry: Timetable; isActive: boolean; isNext: boolean;
}) {
  const isBreak = !!entry.break_type;
  const breakMeta = entry.break_type ? BREAK_META[entry.break_type] : null;

  if (isBreak && breakMeta) {
    return (
      <div className={`h-full rounded-xl border p-2 flex flex-col items-center justify-center gap-0.5 ${breakMeta.bg}
        ${isActive ? 'ring-2 ring-amber-400' : ''}`}>
        <span className={breakMeta.text}>{breakMeta.icon}</span>
        <span className={`text-[10px] font-bold ${breakMeta.text} text-center leading-tight`}>{breakMeta.label}</span>
        {isActive && <span className="text-[9px] text-amber-600 font-black animate-pulse">NOW</span>}
      </div>
    );
  }

  return (
    <div className={`h-full rounded-xl border p-2 flex flex-col gap-1 transition-all
      ${isActive
        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400 shadow'
        : isNext
          ? 'bg-indigo-50 border-indigo-200'
          : 'bg-white border-slate-200 hover:border-blue-200'
      }`}>
      <p className={`text-[11px] font-bold leading-tight truncate ${isActive ? 'text-blue-800' : 'text-slate-800'}`}>
        {entry.subject_name}
      </p>
      {entry.teacher_name && (
        <div className="flex items-center gap-0.5 text-[9px] text-slate-400 truncate">
          <UserCircle className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">{entry.teacher_name}</span>
        </div>
      )}
      {entry.classroom && (
        <div className="flex items-center gap-0.5 text-[9px] text-slate-400 truncate">
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="truncate">{entry.classroom}</span>
        </div>
      )}
      {isActive && <span className="text-[9px] text-blue-600 font-black">IN SESSION</span>}
      {isNext && !isActive && <span className="text-[9px] text-indigo-500 font-bold">NEXT UP</span>}
    </div>
  );
}

function MiniTimetable() {
  const [settings, setSettings] = useState<AcademicSettings | null>(null);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [configs, setConfigs] = useState<ClassConfiguration[]>([]);
  const [days, setDays] = useState<Day[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedConfigId, setSelectedConfigId] = useState<number | ''>('');

  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingTimetable, setLoadingTimetable] = useState(false);

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Initial load: settings, classes, days — then auto-select first class
  useEffect(() => {
    (async () => {
      setLoadingInit(true);
      try {
        const [settingsData, classesData, daysData] = await Promise.all([
          academicAPI.getSettings(),
          academicAPI.listClasses({ is_active: true }),
          academicCalendarAPI.listDays(),
        ]);
        setSettings(settingsData);
        setDays(daysData);

        if (classesData.length > 0) {
          setClasses(classesData);
          setSelectedClassId(classesData[0].id);
        }
      } catch {}
      finally { setLoadingInit(false); }
    })();
  }, []);

  // When class changes, load configs and auto-select first
  useEffect(() => {
    if (!selectedClassId) { setConfigs([]); setSelectedConfigId(''); return; }
    (async () => {
      try {
        const data = await academicAPI.listClassConfigurations({ student_class_id: selectedClassId });
        setConfigs(data);
        if (data.length > 0) setSelectedConfigId(data[0].id);
        else setSelectedConfigId('');
      } catch {}
    })();
  }, [selectedClassId]);

  // When config changes (and we have a class), load timetable
  useEffect(() => {
    if (!selectedConfigId || !selectedClassId) { setTimetable([]); return; }
    (async () => {
      setLoadingTimetable(true);
      try {
        const data = await academicAPI.listTimetable({ class_configuration_id: selectedConfigId as number });
        setTimetable(data);
      } catch {}
      finally { setLoadingTimetable(false); }
    })();
  }, [selectedConfigId, selectedClassId]);

  const useSections = settings?.use_class_sections ?? false;
  const today = todayDayName();
  const now = nowMinutes();

  const activeDayIds = new Set(timetable.map(t => t.day as number));
  const visibleDays = days.filter(d => activeDayIds.has(d.id));

  const allSlots = Array.from(
    new Map(
      timetable.map(t => [`${t.start_time}-${t.end_time}`, { start: t.start_time, end: t.end_time }])
    ).values()
  ).sort((a, b) => a.start.localeCompare(b.start));

  const grid: Record<string, Record<number, Timetable>> = {};
  for (const slot of allSlots) {
    const key = `${slot.start}-${slot.end}`;
    grid[key] = {};
    for (const entry of timetable) {
      if (entry.start_time === slot.start && entry.end_time === slot.end) {
        grid[key][entry.day as number] = entry;
      }
    }
  }

  const todayDay = days.find(d => d.name === today);
  const todayEntries = todayDay
    ? timetable
        .filter(t => t.day === todayDay.id || (t.day as any)?.id === todayDay.id)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : [];

  const activeEntry = todayEntries.find(e =>
    timeToMinutes(e.start_time) <= now && timeToMinutes(e.end_time) > now
  ) ?? null;

  const nextEntry = todayEntries.find(e => timeToMinutes(e.start_time) > now) ?? null;

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedConfig = configs.find(c => c.id === selectedConfigId);
  const timetableTitle = selectedClass
    ? `${selectedClass.name}${selectedConfig?.class_section_name ? ` · ${selectedConfig.class_section_name}` : ''}`
    : 'Timetable';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Card Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
              <Calendar className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Class Timetable</h2>
          </div>
          <Link
            href="/dashboard/staff/academic/timetable"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 transition-colors"
          >
            Full view <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Selectors row */}
        <div className={`grid gap-2 ${useSections ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Class selector */}
          <div className="relative">
            <GraduationCap className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none z-10" />
            <select
              value={selectedClassId}
              onChange={e => { setSelectedClassId(e.target.value ? Number(e.target.value) : ''); setSelectedConfigId(''); }}
              disabled={loadingInit}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700
                pl-7 pr-7 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50"
            >
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Section selector (only when sections enabled) */}
          {useSections && (
            <div className="relative">
              <BookOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none z-10" />
              <select
                value={selectedConfigId}
                onChange={e => setSelectedConfigId(e.target.value ? Number(e.target.value) : '')}
                disabled={!selectedClassId || configs.length === 0}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700
                  pl-7 pr-7 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50"
              >
                <option value="">Select section</option>
                {configs.map(c => <option key={c.id} value={c.id}>{c.class_section_name || 'Default'}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* Live status pill */}
        {selectedConfigId && timetable.length > 0 && activeEntry && (
          <div className="mt-2.5 flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-xs font-bold text-blue-800 truncate">
              {activeEntry.break_type ? BREAK_META[activeEntry.break_type]?.label : activeEntry.subject_name}
            </span>
            <span className="text-xs text-blue-500 ml-auto flex-shrink-0">
              ends {fmtTime(activeEntry.end_time)}
            </span>
          </div>
        )}
        {selectedConfigId && timetable.length > 0 && !activeEntry && nextEntry && (
          <div className="mt-2.5 flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
            <ChevronRight className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-indigo-600">Next: </span>
            <span className="text-xs font-bold text-indigo-800 truncate">
              {nextEntry.break_type ? BREAK_META[nextEntry.break_type]?.label : nextEntry.subject_name}
            </span>
            <span className="text-xs text-indigo-400 ml-auto flex-shrink-0">
              {fmtTime(nextEntry.start_time)}
            </span>
          </div>
        )}
      </div>

      {/* Timetable body */}
      <div className="flex-1 overflow-auto p-3" style={{ minHeight: 0 }}>
        {loadingInit || loadingTimetable ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        ) : !selectedConfigId ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Calendar className="h-8 w-8 text-slate-200 mb-2" />
            <p className="text-xs font-semibold text-slate-400">
              {useSections ? 'Select a class and section' : 'Select a class'}
            </p>
          </div>
        ) : timetable.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Clock className="h-8 w-8 text-slate-200 mb-2" />
            <p className="text-xs font-semibold text-slate-400">No timetable entries yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Class title */}
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">{timetableTitle}</p>
            <table className="border-collapse" style={{ minWidth: `${100 + allSlots.length * 110}px` }}>
              <thead>
                <tr className="bg-slate-50">
                  <th className="w-20 px-2 py-2 text-left border-b border-r border-slate-100 sticky left-0 bg-slate-50 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Day</span>
                  </th>
                  {allSlots.map((slot, idx) => {
                    const slotStart = timeToMinutes(slot.start);
                    const slotEnd = timeToMinutes(slot.end);
                    const isNow = now >= slotStart && now < slotEnd;
                    return (
                      <th key={idx} className={`px-1.5 py-2 text-center border-b border-r border-slate-100 last:border-r-0 min-w-[110px] ${isNow ? 'bg-blue-50' : ''}`}>
                        <div className={`text-[10px] font-bold font-mono ${isNow ? 'text-blue-700' : 'text-slate-500'}`}>{fmtTime(slot.start)}</div>
                        <div className={`text-[9px] font-mono mt-0.5 ${isNow ? 'text-blue-400' : 'text-slate-400'}`}>{fmtTime(slot.end)}</div>
                        {isNow && <div className="mt-0.5 flex justify-center"><span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" /></div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleDays.map((day, dayIdx) => {
                  const isToday = day.name === today;
                  return (
                    <tr key={day.id} className={`border-b border-slate-50 last:border-b-0
                      ${isToday ? 'bg-blue-50/20' : dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                      <td className={`px-2 py-1.5 border-r border-slate-100 w-20 align-middle sticky left-0 z-10
                        ${isToday ? 'bg-blue-50' : dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                        <div className="flex flex-col">
                          <span className={`text-[10px] font-black uppercase tracking-wide ${isToday ? 'text-blue-700' : 'text-slate-500'}`}>{day.name}</span>
                          {isToday && <span className="text-[9px] text-blue-500 font-bold flex items-center gap-0.5 mt-0.5"><span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />Today</span>}
                        </div>
                      </td>
                      {allSlots.map((slot, slotIdx) => {
                        const key = `${slot.start}-${slot.end}`;
                        const entry = grid[key]?.[day.id];
                        const slotStart = timeToMinutes(slot.start);
                        const slotEnd = timeToMinutes(slot.end);
                        const isCurrentTimeSlot = now >= slotStart && now < slotEnd;
                        const isActive = isToday && isCurrentTimeSlot && !!entry;
                        const isNext = isToday && !isActive && !!entry && !!nextEntry && entry.id === nextEntry.id;
                        return (
                          <td key={slotIdx} className={`px-1.5 py-1.5 border-r border-slate-100 last:border-r-0 align-top
                            ${isCurrentTimeSlot && isToday ? 'bg-blue-50/40' : ''}`}>
                            {entry ? (
                              <MiniTimetableCell entry={entry} isActive={isActive} isNext={isNext} />
                            ) : (
                              <div className="min-h-[52px] rounded-xl bg-slate-50/50 border border-dashed border-slate-100" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

export default function StaffDashboard() {
  const { user, getUserFullName, hasPermission, activeModules } = useAuth();

  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  const [summaryData, setSummaryData] = useState<any>({});
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState<AcademicSessionPeriod | null>(null);

  const titleStr = user?.profile?.title ? `${user.profile.title} ` : '';
  const fullName = `${titleStr}${getUserFullName()}`;
  const designation = [user?.profile?.position, user?.profile?.department]
    .filter(Boolean)
    .map(s => toTitleCase(s!))
    .join(' · ');

  // ── Module & Permission checks ──
  const checkModuleActive = (moduleCode?: string) => {
    if (!moduleCode) return true;
    const coreModules = ['student_management', 'human_resource', 'academic_structure'];
    if (coreModules.includes(moduleCode)) return true;
    return activeModules.some(m => m.code === moduleCode);
  };

  const allowedQuickLinks = MASTER_QUICK_LINKS.filter(link => {
    if (!checkModuleActive(link.moduleCode)) return false;
    if (user?.is_superuser) return true;
    if (link.requiredPermission && !hasPermission(link.requiredPermission)) return false;
    return true;
  }).slice(0, 6);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const activityRes = await activityLogsAPI.list({ session_period__is_current: true });
        const activityData = Array.isArray(activityRes) ? activityRes : (activityRes as any).results || [];
        setRecentActivities(activityData.slice(0, 10));

        const summaryRes = await staffDashboardAPI.getSummary();
        setSummaryData(summaryRes || {});

        // Fetch current academic period
        try {
          const curPerRes = await api.get('/api/school/session-periods/current/');
          const periodData = curPerRes?.data?.data || curPerRes?.data;

          if (periodData && periodData.id) {
            setCurrentPeriod(periodData);
          }
        } catch { /* non-critical */ }
      } catch (error) {
        console.error('Dashboard data fetch failed:', error);
      } finally {
        setLoadingActivities(false);
        setLoadingSummary(false);
      }
    };
    fetchData();
  }, []);

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Stat card definitions — only render if data exists
  const statCards: StatCardProps[] = [];
  if (summaryData?.student_management?.active_students !== undefined) {
    statCards.push({
      title: 'Active Students', value: summaryData.student_management.active_students.toLocaleString(),
      icon: Users, gradient: 'bg-gradient-to-br from-blue-500 to-blue-700',
      linkText: 'View students', linkHref: '/dashboard/staff/students', delay: '0ms',
    });
  }
  if (summaryData?.student_management?.active_parents !== undefined) {
    statCards.push({
      title: 'Active Parents', value: summaryData.student_management.active_parents.toLocaleString(),
      icon: User, gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700',
      linkText: 'View parents', linkHref: '/dashboard/staff/students/guardians', delay: '60ms',
    });
  }
  if (summaryData?.academic?.active_classes !== undefined) {
    statCards.push({
      title: 'Active Classes', value: summaryData.academic.active_classes.toLocaleString(),
      icon: BookOpen, gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
      linkText: 'View classes', linkHref: '/dashboard/staff/academic/classes', delay: '120ms',
    });
  }
  if (summaryData?.human_resource?.active_staff !== undefined) {
    statCards.push({
      title: 'Active Staff', value: summaryData.human_resource.active_staff.toLocaleString(),
      icon: UserCheck, gradient: 'bg-gradient-to-br from-violet-500 to-violet-700',
      linkText: 'View staff', linkHref: '/dashboard/staff/staff', delay: '180ms',
    });
  }

  return (
    <div className="space-y-6 pb-10">

      {/* ── 1. HERO HEADER ── */}
      <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-2xl overflow-hidden shadow-xl">
        {/* Decorative blobs */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="h-20 w-20 rounded-2xl border-2 border-white/20 bg-white/10 shadow-lg overflow-hidden">
                {user?.profile?.image ? (
                  <img src={user.profile.image} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <UserCircle className="h-10 w-10 text-white/50" />
                  </div>
                )}
              </div>
              {/* Online dot */}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 shadow" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-blue-300 text-sm font-semibold mb-0.5 tracking-wide">{greeting}</p>
              <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight truncate">{fullName}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {designation && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 bg-white/10 px-3 py-1 rounded-full">
                    <Briefcase className="h-3 w-3 text-white/50" />
                    {designation}
                  </span>
                )}
                {user?.profile?.leadership_role && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-400/20 border border-amber-400/30 px-3 py-1 rounded-full">
                    <Award className="h-3 w-3" />
                    {user.profile.leadership_role}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-white/50 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                  {user?.profile?.staff_id || 'N/A'}
                </span>
              </div>
            </div>

            {/* Date + Academic Period chip */}
            <div className="flex flex-col items-start sm:items-end gap-1 flex-shrink-0 mt-1 sm:mt-0">
              <div className="flex items-center gap-1.5">
                <span className="text-white/40 text-[11px] font-semibold uppercase tracking-widest">
                  {new Date().toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
              </div>
              <span className="text-white/80 text-base font-black leading-none">
                {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              {currentPeriod && (
                <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-white/10 border border-white/15 rounded-full text-[11px] font-bold text-white/80">
                  <Calendar className="h-3 w-3 text-blue-300" />
                  {currentPeriod.period.name} &middot; {currentPeriod.session.start_year}{currentPeriod.session.separator}{currentPeriod.session.end_year}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. STAT CARDS ── */}
      {!loadingSummary && statCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      )}
      {loadingSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {/* ── 3. ACTIVITY FEED + TIMETABLE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">Recent Activity</h2>
            </div>
            {!loadingActivities && recentActivities.length > 0 && (
              <Link
                href="/dashboard/staff/activities"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 transition-colors"
              >
                View all <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="flex-1 p-4">
            {loadingActivities ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded w-2/3" />
                      <div className="h-2.5 bg-slate-50 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Activity className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-xs font-semibold text-slate-400">No recent activities</p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivities.map((activity) => {
                  const style = getCategoryStyle(activity.category);
                  const Icon = style.icon;
                  let href = '#';
                  let isClickable = false;
                  if (activity.target_model === 'studentmodel' && activity.target_object_id) {
                    href = `/dashboard/staff/students/${activity.target_object_id}`;
                    isClickable = true;
                  }
                  const content = (
                    <div className="flex items-start gap-3 p-2 rounded-xl transition-colors">
                      {/* Icon dot */}
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${style.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${style.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold leading-tight ${isClickable ? 'text-blue-700 group-hover:underline' : 'text-slate-800'}`}>
                          {getActivityTitle(activity)}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{activity.description}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] text-slate-400">{timeAgo(activity.created_at)}</span>
                          <span className="text-slate-200">·</span>
                          <span className="text-[10px] text-slate-400">By {activity.actor_name}</span>
                        </div>
                      </div>
                    </div>
                  );
                  return isClickable ? (
                    <Link key={activity.id} href={href} className="block group hover:bg-slate-50 rounded-xl">{content}</Link>
                  ) : (
                    <div key={activity.id} className="block">{content}</div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Timetable panel */}
        <MiniTimetable />
      </div>

      {/* ── 4. QUICK ACTIONS ── */}
      {allowedQuickLinks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <h2 className="text-sm font-bold text-slate-800">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allowedQuickLinks.map((link) => {
              const IconComponent = link.icon as any;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  className="group relative p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm transition-all duration-200 overflow-hidden"
                >
                  {/* Hover shine */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/0 to-blue-600/0 group-hover:from-blue-600/5 group-hover:to-indigo-600/5 transition-all duration-300 pointer-events-none rounded-xl" />
                  <IconComponent className={`h-7 w-7 mb-2.5 ${link.iconColor} group-hover:scale-110 transition-transform duration-200`} />
                  <p className="text-sm font-bold text-slate-800 group-hover:text-blue-700 leading-tight">{link.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{link.description}</p>
                  <ArrowRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}