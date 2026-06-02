'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { examsAPI, academicCalendarAPI, academicAPI } from '@/lib/api';
import { AcademicSessionPeriod, Subject, ClassModel } from '@/lib/types';
import {
  ClipboardList, ArrowLeft, AlertCircle, X, Check,
  BookOpen, Users, Calendar, Settings, ChevronDown,
  ChevronUp, Info, Loader2, AlertTriangle,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAM_TYPE_OPTIONS = [
  { value: 'test',     label: 'Class Test' },
  { value: 'quiz',     label: 'Quiz' },
  { value: 'ca',       label: 'Continuous Assessment' },
  { value: 'midterm',  label: 'Mid-term Exam' },
  { value: 'exam',     label: 'End of Term Exam' },
  { value: 'practice', label: 'Practice / Mock Exam' },
];

// ─── Shared style constants ───────────────────────────────────────────────────

const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  if (!err) return 'An unknown error occurred';
  if (err.response?.data) {
    const d = err.response.data;
    if (typeof d === 'string') return d;
    if (d.detail) return d.detail;
    if (d.error) return d.error;
    if (d.message) return d.message;
    // Multi-field DRF errors
    const entries = Object.entries(d);
    if (entries.length) {
      return entries
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');
    }
  }
  return err.message || 'An error occurred';
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
            ${t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span className="text-sm font-medium whitespace-pre-line">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const show = (type: Toast['type'], message: string) => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };
  const remove = (id: number) => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, showToast: show, removeToast: remove };
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1
        ${checked ? 'bg-violet-600' : 'bg-slate-200'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, children }: {
  icon: React.ReactNode; title: string; children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
      <h2 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
        <span className="text-violet-500">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CreateExamPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const { toasts, showToast, removeToast } = useToasts();

  const [currentPeriod, setCurrentPeriod] = useState<AcademicSessionPeriod | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [examType, setExamType] = useState('exam');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<number[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [totalMarks, setTotalMarks] = useState(70);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);
  const [allowReview, setAllowReview] = useState(true);
  const [showResultsImmediately, setShowResultsImmediately] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);

  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_exammodel');

  useEffect(() => { fetchData(); }, []);

  // Auto-set practice mode when exam type is practice
  useEffect(() => {
    setIsPracticeMode(examType === 'practice');
  }, [examType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [periodsData, subjectsData, classesData] = await Promise.all([
        academicCalendarAPI.listSessionPeriods(),
        academicAPI.listSubjects({ is_active: true }),
        academicAPI.listClasses({ is_active: true }),
      ]);
      setSubjects(subjectsData);
      setClasses(classesData);
      const current = periodsData.find((p: AcademicSessionPeriod) => p.is_current);
      setCurrentPeriod(current ?? null);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (id: number) =>
    setSelectedSubjects(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const toggleClass = (id: number) =>
    setSelectedClasses(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);

  const validate = (): string | null => {
    if (!name.trim())              return 'Exam name is required';
    if (!startDate)                return 'Start date is required';
    if (!endDate)                  return 'End date is required';
    if (endDate < startDate)       return 'End date must be after start date';
    if (selectedSubjects.length === 0) return 'Select at least one subject';
    if (selectedClasses.length === 0)  return 'Select at least one class';
    if (!currentPeriod)            return 'No active session/term found. Please set a current session period first.';
    if (totalMarks < 1)            return 'Total marks must be at least 1';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { showToast('error', err); return; }

    setIsSubmitting(true);
    try {
      const getId = (v: any) => typeof v === 'object' && v !== null ? v.id : v;
      const exam = await examsAPI.create({
        name: name.trim(),
        exam_type: examType,
        session: getId(currentPeriod!.session),
        term: currentPeriod!.id,  // ExamModel.term → AcademicSessionPeriodModel (term.period.name in serializer confirms this)
        subjects: selectedSubjects,
        classes: selectedClasses,
        start_date: startDate,
        end_date: endDate,
        instructions: instructions.trim() || undefined,
        total_marks: totalMarks,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        allow_review: allowReview,
        show_results_immediately: showResultsImmediately,
        is_practice_mode: isPracticeMode,
      } as any);
      router.push(`/dashboard/staff/assessment/exams/${exam.id}?new=true`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">You don't have permission to create exams.</p>
      </div>
    </div>
  );

  const currentSessionLabel = currentPeriod
    ? (() => {
        const s = currentPeriod.session;
        const p = currentPeriod.period;
        const sLabel = typeof s === 'object' ? `${s.start_year}/${s.end_year}` : `Session ${s}`;
        const pLabel = typeof p === 'object' ? p.name : `Term ${p}`;
        return `${sLabel} — ${pLabel}`;
      })()
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">
      <ToastStack toasts={toasts} onRemove={removeToast} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/staff/assessment/exams')}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Create New Exam</h1>
          <p className="text-xs text-slate-500">Schedules will be auto-generated for each class × subject combination</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Section 1: Basic Info ──────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <SectionHeader icon={<ClipboardList className="h-4 w-4" />} title="Basic Information" />
            <div className="p-5 space-y-4">

              {/* Current session banner */}
              {currentSessionLabel ? (
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Info className="h-4 w-4 text-violet-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-violet-800">Current Session & Term</p>
                    <p className="text-sm text-violet-700 capitalize">{currentSessionLabel}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700 font-medium">
                    No active session found — please set a current session period before creating an exam.
                  </p>
                </div>
              )}

              {/* Exam name */}
              <div>
                <label className={labelCls}>Exam Name <span className="text-red-400">*</span></label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. First Term Examination 2025/2026"
                  className={inputCls} />
              </div>

              {/* Type + Total marks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Exam Type <span className="text-red-400">*</span></label>
                  <select value={examType} onChange={e => setExamType(e.target.value)} className={inputCls}>
                    {EXAM_TYPE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Total Marks <span className="text-red-400">*</span></label>
                  <input type="number" value={totalMarks}
                    onChange={e => setTotalMarks(parseInt(e.target.value) || 0)}
                    min={1} max={500} className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">Default 70 (if CA is 30)</p>
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>
                    <Calendar className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    Start Date <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>
                    <Calendar className="inline h-3.5 w-3.5 mr-1 text-slate-400" />
                    End Date <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className={labelCls}>
                  General Instructions <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                  rows={3} placeholder="e.g. Answer all questions. Use black or blue pen only..."
                  className={`${inputCls} resize-none`} />
              </div>
            </div>
          </div>

          {/* ── Section 2: Subjects ────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <SectionHeader icon={<BookOpen className="h-4 w-4" />} title={`Subjects (${selectedSubjects.length} selected)`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedSubjects(subjects.map(s => s.id))}
                  className="text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors">
                  Select All
                </button>
                {selectedSubjects.length > 0 && (
                  <button onClick={() => setSelectedSubjects([])}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </SectionHeader>
            <div className="p-5">
              {subjects.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No subjects found</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {subjects.map(subject => {
                    const selected = selectedSubjects.includes(subject.id);
                    return (
                      <button key={subject.id} onClick={() => toggleSubject(subject.id)}
                        className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all
                          ${selected
                            ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50'}`}>
                        <div className="flex items-center gap-1.5">
                          {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{subject.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedSubjects.length === 0 && subjects.length > 0 && (
                <p className="text-xs text-red-400 mt-2">Please select at least one subject</p>
              )}
            </div>
          </div>

          {/* ── Section 3: Classes ────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <SectionHeader icon={<Users className="h-4 w-4" />} title={`Classes (${selectedClasses.length} selected)`}>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedClasses(classes.map(c => c.id))}
                  className="text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors">
                  Select All
                </button>
                {selectedClasses.length > 0 && (
                  <button onClick={() => setSelectedClasses([])}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </SectionHeader>
            <div className="p-5">
              {classes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No classes found</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {classes.map(cls => {
                    const selected = selectedClasses.includes(cls.id);
                    return (
                      <button key={cls.id} onClick={() => toggleClass(cls.id)}
                        className={`px-3 py-2.5 rounded-xl border text-sm font-medium text-left transition-all
                          ${selected
                            ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-violet-50'}`}>
                        <div className="flex items-center gap-1.5">
                          {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{cls.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedClasses.length === 0 && classes.length > 0 && (
                <p className="text-xs text-red-400 mt-2">Please select at least one class</p>
              )}
            </div>

            {/* Schedule preview note */}
            {selectedSubjects.length > 0 && selectedClasses.length > 0 && (
              <div className="px-5 pb-5">
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <Info className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-violet-900">Schedules will be auto-created</p>
                    <p className="text-xs text-violet-700 mt-0.5">
                      One schedule per valid subject × class combination — only where the class offers the subject. You'll set dates and questions for each on the next page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 4: Advanced Options ───────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setShowAdvanced(p => !p)}
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <span className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4 text-violet-500" />
                Advanced Options
              </span>
              {showAdvanced
                ? <ChevronUp className="h-4 w-4 text-slate-400" />
                : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {showAdvanced && (
              <div className="border-t border-slate-100 p-5 space-y-3">
                {[
                  { label: 'Randomize Questions',       sub: 'Different order per student',        value: randomizeQuestions,      set: setRandomizeQuestions },
                  { label: 'Randomize Options',         sub: 'Shuffle MCQ options per student',    value: randomizeOptions,        set: setRandomizeOptions },
                  { label: 'Allow Review',              sub: 'Students can review before submit',  value: allowReview,             set: setAllowReview },
                  { label: 'Show Results Immediately',  sub: 'Display score right after submit',   value: showResultsImmediately,  set: setShowResultsImmediately },
                ].map(({ label, sub, value, set }) => (
                  <div key={label}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{label}</p>
                      <p className="text-xs text-slate-400">{sub}</p>
                    </div>
                    <Toggle checked={value} onChange={set} />
                  </div>
                ))}

                {examType === 'practice' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2 mt-1">
                    <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Practice mode is automatically enabled for Practice / Mock exam type.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-1">
            <button onClick={() => router.push('/dashboard/staff/assessment/exams')}
              className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors text-sm">
              Cancel
            </button>
            <button onClick={handleSubmit}
              disabled={isSubmitting || !currentPeriod}
              className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl shadow-sm hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm">
              {isSubmitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                : <><ClipboardList className="h-4 w-4" /> Create Exam</>}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}