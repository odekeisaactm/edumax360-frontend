// app/dashboard/staff/academic/timetable/page.tsx
'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI, academicCalendarAPI } from '@/lib/api';
import { ClassConfiguration, ClassModel, AcademicSettings, Timetable, Day } from '@/lib/types';
import {
  Calendar, Clock, ChevronDown, Loader2, AlertCircle,
  Printer, BookOpen, Coffee, Sunset, LogOut, UserCircle,
  MapPin, GraduationCap, ChevronRight,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

const BREAK_META: Record<string, { label: string; bg: string; text: string; printBg: string; icon: React.ReactNode }> = {
  short:   { label: 'Short Break',  bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-700',   printBg: '#fffbeb', icon: <Coffee className="h-3.5 w-3.5" /> },
  long:    { label: 'Long Break',   bg: 'bg-orange-50 border-orange-200',  text: 'text-orange-700',  printBg: '#fff7ed', icon: <Sunset className="h-3.5 w-3.5" /> },
  closing: { label: 'Closing Time', bg: 'bg-slate-100 border-slate-200',   text: 'text-slate-600',   printBg: '#f8fafc', icon: <LogOut className="h-3.5 w-3.5" /> },
};

// ─── Select Component ──────────────────────────────────────────────────────────
function SelectBox({ value, onChange, options, placeholder, disabled, icon: Icon }: {
  value: number | ''; onChange: (v: number | '') => void;
  options: { id: number; name: string }[]; placeholder: string;
  disabled?: boolean; icon?: any;
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none z-10" />}
      <select
        value={value}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
        disabled={disabled}
        className={`w-full appearance-none bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700
          focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition
          ${Icon ? 'pl-9' : 'pl-4'} pr-10 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ─── Timetable Cell ─────────────────────────────────────────────────────────────
function TimetableCell({ entry, isCurrentDay, isActive, isNext }: {
  entry: Timetable; isCurrentDay: boolean; isActive: boolean; isNext: boolean;
}) {
  const isBreak = !!entry.break_type;
  const breakMeta = entry.break_type ? BREAK_META[entry.break_type] : null;

  if (isBreak && breakMeta) {
    return (
      <div className={`h-full rounded-xl border p-2 flex flex-col items-center justify-center gap-1 ${breakMeta.bg}
        ${isActive ? 'ring-2 ring-amber-400 shadow-md' : ''}`}>
        <span className={`${breakMeta.text}`}>{breakMeta.icon}</span>
        <span className={`text-xs font-semibold ${breakMeta.text}`}>{breakMeta.label}</span>
        {isActive && <span className="text-[10px] text-amber-600 font-bold animate-pulse">NOW</span>}
      </div>
    );
  }

  return (
    <div className={`h-full rounded-xl border p-2.5 flex flex-col gap-1.5 transition-all
      ${isActive
        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400 shadow-md'
        : isNext
          ? 'bg-indigo-50/50 border-indigo-200'
          : isCurrentDay
            ? 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30'
            : 'bg-white border-slate-100 hover:border-slate-200'
      }`}>
      <div className="flex items-start justify-between gap-1">
        <p className={`text-xs font-bold leading-tight truncate flex-1 ${isActive ? 'text-blue-800' : 'text-slate-800'}`}>
          {entry.subject_name}
        </p>
        {isActive && (
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mt-0.5" />
        )}
        {isNext && !isActive && (
          <ChevronRight className="flex-shrink-0 h-3 w-3 text-indigo-400" />
        )}
      </div>
      {entry.teacher_name && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
          <UserCircle className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{entry.teacher_name}</span>
        </div>
      )}
      {entry.classroom && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{entry.classroom}</span>
        </div>
      )}
      {isActive && <span className="text-[10px] text-blue-600 font-bold">IN SESSION</span>}
      {isNext && !isActive && <span className="text-[10px] text-indigo-500 font-semibold">NEXT UP</span>}
    </div>
  );
}

// ─── Countdown Timer ───────────────────────────────────────────────────────────
function CountdownBanner({ activeEntry, nextEntry }: { activeEntry: Timetable | null; nextEntry: Timetable | null }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!activeEntry && !nextEntry) return null;

  const now = nowMinutes();

  if (activeEntry) {
    const endMin = timeToMinutes(activeEntry.end_time);
    const remaining = endMin - now;
    const label = activeEntry.break_type ? BREAK_META[activeEntry.break_type]?.label : activeEntry.subject_name;
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-blue-800 truncate">{label}</span>
          <span className="text-sm text-blue-600 ml-2">in session</span>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-blue-500">Ends in</p>
          <p className="text-sm font-bold text-blue-700">{remaining > 0 ? `${remaining} min` : 'Ending now'}</p>
        </div>
      </div>
    );
  }

  if (nextEntry) {
    const startMin = timeToMinutes(nextEntry.start_time);
    const until = startMin - now;
    const label = nextEntry.break_type ? BREAK_META[nextEntry.break_type]?.label : nextEntry.subject_name;
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
        <ChevronRight className="h-4 w-4 text-indigo-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-indigo-700">Next up: </span>
          <span className="text-sm text-indigo-800 font-bold truncate">{label}</span>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs text-indigo-400">Starts in</p>
          <p className="text-sm font-bold text-indigo-600">{until > 0 ? `${until} min` : 'Starting now'}</p>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TimetablePage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Pre-selection from URL params (set when navigating from class config detail)
  const initialConfigId = searchParams.get('config_id') ? Number(searchParams.get('config_id')) : null;

  // Selectors
  const [settings, setSettings] = useState<AcademicSettings | null>(null);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [configs, setConfigs] = useState<ClassConfiguration[]>([]);
  const [days, setDays] = useState<Day[]>([]);

  const [selectedClassId, setSelectedClassId] = useState<number | ''>('');
  const [selectedConfigId, setSelectedConfigId] = useState<number | ''>(initialConfigId ?? '');

  // Timetable data
  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingTimetable, setLoadingTimetable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live clock tick every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Init: load classes, settings, days ──
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
        setClasses(classesData);
        setDays(daysData);

        // If we have an initial config_id from URL, resolve it to class + config
        if (initialConfigId) {
          const configData = await academicAPI.getClassConfiguration(initialConfigId);
          const classId = (configData.student_class != null && typeof configData.student_class === 'object')
            ? (configData.student_class as any).id
            : configData.student_class as number;
          setSelectedClassId(classId);

          // Load configs for this class
          const configsData = await academicAPI.listClassConfigurations({ student_class_id: classId });
          setConfigs(configsData);
          setSelectedConfigId(initialConfigId);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load');
      } finally {
        setLoadingInit(false);
      }
    })();
  }, []);

  // ── When class changes, load its configs ──
  useEffect(() => {
    if (!selectedClassId) { setConfigs([]); setSelectedConfigId(''); return; }
    (async () => {
      try {
        const data = await academicAPI.listClassConfigurations({ student_class_id: selectedClassId });
        setConfigs(data);
        // Auto-select if only one config (no sections)
        if (data.length === 1) setSelectedConfigId(data[0].id);
        else if (!initialConfigId) setSelectedConfigId('');
      } catch {}
    })();
  }, [selectedClassId]);

  // ── When config changes, load timetable ──
  useEffect(() => {
    if (!selectedConfigId) { setTimetable([]); return; }
    (async () => {
      setLoadingTimetable(true);
      try {
        const data = await academicAPI.listTimetable({ class_configuration_id: selectedConfigId as number });
        setTimetable(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load timetable');
      } finally { setLoadingTimetable(false); }
    })();
  }, [selectedConfigId]);

  // ── Derived: build timetable grid ──
  const useSections = settings?.use_class_sections ?? false;
  const today = todayDayName();
  const now = nowMinutes();

  // Days that have at least one entry
  const activeDayIds = new Set(timetable.map(t => t.day as number));
  const visibleDays = days.filter(d => activeDayIds.has(d.id));

  // All unique time slots (sorted)
  const allSlots = Array.from(
    new Map(
      timetable.map(t => [`${t.start_time}-${t.end_time}`, { start: t.start_time, end: t.end_time }])
    ).values()
  ).sort((a, b) => a.start.localeCompare(b.start));

  // Grid: slot → day → entry
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

  // Today's entries for live indicator
  const todayDay = days.find(d => d.name === today);
  const todayEntries = todayDay
    ? timetable.filter(t => t.day === todayDay.id || (t.day as any)?.id === todayDay.id)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : [];

  const activeEntry = todayEntries.find(e =>
    timeToMinutes(e.start_time) <= now && timeToMinutes(e.end_time) > now
  ) ?? null;

  const nextEntry = activeEntry
    ? todayEntries.find(e => timeToMinutes(e.start_time) > now) ?? null
    : todayEntries.find(e => timeToMinutes(e.start_time) > now) ?? null;

  // ── Selected config label ──
  const selectedConfig = configs.find(c => c.id === selectedConfigId);
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const timetableTitle = selectedClass
    ? `${selectedClass.name}${selectedConfig?.class_section_name ? ` ${selectedConfig.class_section_name}` : ''} — Timetable`
    : 'Class Timetable';

  const handlePrint = () => window.print();

  if (loadingInit) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-sm text-slate-400">Loading timetable...</p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Print Styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #timetable-print-area, #timetable-print-area * { visibility: visible !important; }
          #timetable-print-area { position: fixed; inset: 0; padding: 20px; background: white; }
          .no-print { display: none !important; }
          @page { size: landscape; margin: 15mm; }
        }
      `}</style>

      <div className="space-y-5 pb-10">
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 no-print">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            Timetable
          </h1>
          {selectedConfigId && timetable.length > 0 && (
            <button onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
          )}
        </div>

        {/* ── Selectors ── */}
        <div className="no-print bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className={`grid gap-4 ${useSections ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
              <SelectBox
                value={selectedClassId}
                onChange={v => { setSelectedClassId(v); setSelectedConfigId(''); }}
                options={classes.map(c => ({ id: c.id, name: c.name }))}
                placeholder="Select a class"
                icon={GraduationCap}
              />
            </div>
            {useSections && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Section / Arm
                </label>
                <SelectBox
                  value={selectedConfigId}
                  onChange={setSelectedConfigId}
                  options={configs.map(c => ({
                    id: c.id,
                    name: c.class_section_name || 'Default',
                  }))}
                  placeholder="Select section"
                  disabled={!selectedClassId || configs.length === 0}
                  icon={BookOpen}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Live Banner ── */}
        {selectedConfigId && timetable.length > 0 && (activeEntry || nextEntry) && (
          <div className="no-print">
            <CountdownBanner activeEntry={activeEntry} nextEntry={nextEntry} />
          </div>
        )}

        {/* ── Empty / Loading states ── */}
        {!selectedConfigId && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center no-print">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-7 w-7 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Select a class to view its timetable</h3>
            <p className="text-sm text-slate-400">Choose a class{useSections ? ' and section' : ''} from the selectors above</p>
          </div>
        )}

        {selectedConfigId && loadingTimetable && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center no-print">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading timetable...</p>
          </div>
        )}

        {selectedConfigId && !loadingTimetable && timetable.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center no-print">
            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="h-7 w-7 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No timetable entries</h3>
            <p className="text-sm text-slate-400">This class has no scheduled entries yet</p>
          </div>
        )}

        {/* ── Timetable Grid ── */}
        {selectedConfigId && !loadingTimetable && timetable.length > 0 && (
          <div id="timetable-print-area">
            {/* Print header (only visible when printing) */}
            <div className="hidden print:block mb-6">
              <h2 className="text-xl font-bold text-slate-900">{timetableTitle}</h2>
              <p className="text-sm text-slate-500">Generated {new Date().toLocaleDateString()}</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Class label */}
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 no-print">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                  <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <h2 className="text-sm font-bold text-slate-800">{timetableTitle}</h2>
                <span className="text-xs text-slate-400 ml-auto">{timetable.length} period{timetable.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: `${140 + allSlots.length * 130}px` }}>
                  <thead>
                    <tr className="bg-slate-50">
                      {/* Day column header */}
                      <th className="w-32 px-3 py-3 text-left border-b border-r border-slate-100 sticky left-0 bg-slate-50 z-10">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          <Calendar className="h-3.5 w-3.5" />
                          Day
                        </div>
                      </th>
                      {allSlots.map((slot, idx) => {
                        const slotStart = timeToMinutes(slot.start);
                        const slotEnd = timeToMinutes(slot.end);
                        const isCurrentTimeSlot = now >= slotStart && now < slotEnd;
                        return (
                          <th key={idx}
                            className={`px-2 py-3 text-center border-b border-r border-slate-100 last:border-r-0 min-w-[130px]
                              ${isCurrentTimeSlot ? 'bg-blue-50' : ''}`}>
                            <div className={`text-xs font-bold font-mono ${isCurrentTimeSlot ? 'text-blue-700' : 'text-slate-600'}`}>
                              {fmtTime(slot.start)}
                            </div>
                            <div className={`text-[10px] font-mono mt-0.5 ${isCurrentTimeSlot ? 'text-blue-400' : 'text-slate-400'}`}>
                              {fmtTime(slot.end)}
                            </div>
                            {isCurrentTimeSlot && (
                              <div className="mt-1 flex justify-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDays.map((day, dayIdx) => {
                      const isToday = day.name === today;
                      return (
                        <tr key={day.id}
                          className={`border-b border-slate-50 last:border-b-0
                            ${isToday ? 'bg-blue-50/20' : dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                          {/* Day label */}
                          <td className={`px-3 py-2 border-r border-slate-100 w-32 align-middle sticky left-0 z-10
                            ${isToday ? 'bg-blue-50' : dayIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                                {day.name}
                              </span>
                              {isToday && (
                                <span className="text-[10px] text-blue-500 font-semibold flex items-center gap-1 mt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                  Today
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Slot cells */}
                          {allSlots.map((slot, slotIdx) => {
                            const key = `${slot.start}-${slot.end}`;
                            const entry = grid[key]?.[day.id];
                            const slotStart = timeToMinutes(slot.start);
                            const slotEnd = timeToMinutes(slot.end);
                            const isCurrentTimeSlot = now >= slotStart && now < slotEnd;
                            const isActive = isToday && isCurrentTimeSlot && !!entry;
                            const isNext = isToday && !isActive && !!entry && !!nextEntry && entry.id === nextEntry.id;

                            return (
                              <td key={slotIdx}
                                className={`px-2 py-2 border-r border-slate-100 last:border-r-0 align-top
                                  ${isCurrentTimeSlot && isToday ? 'bg-blue-50/40' : ''}`}>
                                {entry ? (
                                  <TimetableCell
                                    entry={entry}
                                    isCurrentDay={isToday}
                                    isActive={isActive}
                                    isNext={isNext}
                                  />
                                ) : (
                                  <div className="min-h-[60px] rounded-xl bg-slate-50/50 border border-dashed border-slate-100" />
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

              {/* Legend */}
              <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center gap-4 no-print">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Legend</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500 border border-blue-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-blue-700">In session</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-indigo-300 border border-indigo-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-indigo-600">Next up</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 flex-shrink-0" />
                  <span className="text-xs font-medium text-blue-500">Today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-300 border border-amber-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-amber-700">Short Break</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-orange-300 border border-orange-400 flex-shrink-0" />
                  <span className="text-xs font-medium text-orange-700">Long Break</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-400 border border-slate-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-slate-600">Closing Time</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </>
  );
}
