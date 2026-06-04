'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { examsAPI, examSchedulesAPI } from '@/lib/api';
import { Exam, ExamSchedule } from '@/lib/types';
import {
  ClipboardList, ArrowLeft, AlertCircle, X, Check,
  Calendar, Clock, Users, BookOpen, CheckCircle2,
  AlertTriangle, Eye, Globe, Lock, ChevronDown,
  ChevronRight, RefreshCw, Printer, Loader2, BarChart3,
  FileQuestion, Shield, FlaskConical,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAM_TYPE_LABELS: Record<string, string> = {
  test: 'Class Test', quiz: 'Quiz', ca: 'Continuous Assessment',
  midterm: 'Mid-term Exam', exam: 'End of Term Exam', practice: 'Practice / Mock',
};

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
    const entries = Object.entries(d);
    if (entries.length) return entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
  }
  return err.message || 'An error occurred';
}

function formatDateTime(dt: string) {
  const d = new Date(dt);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span className="text-sm font-medium whitespace-pre-line">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
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
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  };
  return { toasts, showToast: show, removeToast: (id: number) => setToasts(p => p.filter(t => t.id !== id)) };
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ open, title, message, subMessage, confirmLabel = 'Confirm',
  confirmClass = 'bg-violet-600 hover:bg-violet-700', loading, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; subMessage?: string;
  confirmLabel?: string; confirmClass?: string;
  loading: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 rounded-full mx-auto mb-4">
          <Globe className="h-6 w-6 text-violet-600" />
        </div>
        <h3 className="text-lg font-bold text-center text-slate-900 mb-1">{title}</h3>
        <p className="text-center text-slate-600 text-sm mb-1">{message}</p>
        {subMessage && <p className="text-center text-slate-500 text-xs mb-6">{subMessage}</p>}
        <div className="flex justify-center gap-3 mt-6">
          <button onClick={onCancel} disabled={loading}
            className="px-5 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`px-5 py-2.5 text-white font-semibold rounded-xl disabled:opacity-50 flex items-center gap-2 transition-colors ${confirmClass}`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Date Modal ──────────────────────────────────────────────────────────

function BulkDateModal({ open, subjectName, defaultDate, onConfirm, onCancel, loading }: {
  open: boolean; subjectName: string; defaultDate: string;
  onConfirm: (date: string, time: string, duration: number) => void;
  onCancel: () => void; loading: boolean;
}) {
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('08:00');
  const [duration, setDuration] = useState(60);

  useEffect(() => { if (open) setDate(defaultDate); }, [open, defaultDate]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Assign Date & Time</h3>
        <p className="text-sm text-slate-500 mb-5">
          Set the same date and time for all <strong className="text-slate-700">{subjectName}</strong> schedules
        </p>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Time</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Duration (min)</label>
              <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 60)}
                min={15} step={15} className={inputCls} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(date, time, duration)} disabled={loading || !date || !time}
            className="px-4 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-50 text-sm flex items-center gap-2 transition-colors">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Assigning...' : 'Assign to All'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Copy Schedule Modal ──────────────────────────────────────────────────────

function CopyScheduleModal({ open, sourceSchedule, onClose, onComplete }: {
  open: boolean;
  sourceSchedule: ExamSchedule | null;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [copyQuestions, setCopyQuestions] = useState(true);
  const [copyDateTime, setCopyDateTime] = useState(true);
  const [copyHall, setCopyHall] = useState(true);
  const [copyInvigilators, setCopyInvigilators] = useState(true);

  useEffect(() => {
    if (open && sourceSchedule) {
      setLoading(true);
      examSchedulesAPI.getAvailableForCopy(sourceSchedule.id)
        .then(data => {
          setOptions(data);
          // Auto-check those that are not ready
          setSelectedIds(data.filter(s => s.setup_status !== 'ready').map(s => s.id));
        })
        .finally(() => setLoading(false));
    }
  }, [open, sourceSchedule]);

  if (!open || !sourceSchedule) return null;

  const handleCopy = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      await examSchedulesAPI.copy(sourceSchedule.id, {
        target_schedule_ids: selectedIds,
        copy_questions: copyQuestions,
        copy_datetime: copyDateTime,
        copy_hall: copyHall,
        copy_invigilators: copyInvigilators,
      });
      onComplete();
    } catch (err) {
      alert(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100">
           <h3 className="text-xl font-bold text-slate-900">Copy Exam Setup</h3>
           <p className="text-sm text-slate-500 mt-1">
             Copy questions and settings from <span className="font-bold text-slate-700">{sourceSchedule.class_name}</span> to other class arms.
           </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" checked={copyQuestions} onChange={e => setCopyQuestions(e.target.checked)} className="rounded text-violet-600 focus:ring-violet-500" />
                <span className="text-sm font-semibold text-slate-700">Questions</span>
              </label>
              <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" checked={copyDateTime} onChange={e => setCopyDateTime(e.target.checked)} className="rounded text-violet-600 focus:ring-violet-500" />
                <span className="text-sm font-semibold text-slate-700">Date & Time</span>
              </label>
              <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" checked={copyHall} onChange={e => setCopyHall(e.target.checked)} className="rounded text-violet-600 focus:ring-violet-500" />
                <span className="text-sm font-semibold text-slate-700">Examination Hall</span>
              </label>
              <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" checked={copyInvigilators} onChange={e => setCopyInvigilators(e.target.checked)} className="rounded text-violet-600 focus:ring-violet-500" />
                <span className="text-sm font-semibold text-slate-700">Invigilators</span>
              </label>
           </div>

           <div className="space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Select Target Class Arms</p>
              {options.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4">No other class arms found for this subject.</p>
              ) : (
                <div className="space-y-2">
                  {options.map(opt => (
                    <label key={opt.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl cursor-pointer hover:border-violet-200 transition-all">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" 
                          checked={selectedIds.includes(opt.id)} 
                          onChange={e => {
                            if (e.target.checked) setSelectedIds([...selectedIds, opt.id]);
                            else setSelectedIds(selectedIds.filter(id => id !== opt.id));
                          }}
                          className="rounded text-violet-600 focus:ring-violet-500" 
                        />
                        <span className="text-sm font-bold text-slate-700">{opt.class_name}</span>
                      </div>
                      <SetupBadge status={opt.setup_status} />
                    </label>
                  ))}
                </div>
              )}
           </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
           <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
           <button onClick={handleCopy} disabled={loading || selectedIds.length === 0} className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-100 flex items-center gap-2 transition-all disabled:opacity-50">
             {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
             Copy setup
           </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function SetupBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ready:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Ready' },
    partial: { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Partial' },
    draft:   { cls: 'bg-slate-50 text-slate-600 border-slate-200',       label: 'Draft' },
  };
  const { cls, label } = map[status] || map.draft;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{label}</span>
  );
}

function LifecycleBadge({ status }: { status?: string }) {
  if (!status || status === 'upcoming') return null;
  const map: Record<string, { cls: string; label: string }> = {
    ongoing:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',       label: 'Ongoing' },
    completed: { cls: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Completed' },
  };
  const entry = map[status];
  if (!entry) return null;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${entry.cls}`}>{entry.label}</span>
  );
}

// ─── Schedule Row ─────────────────────────────────────────────────────────────

function ScheduleRow({ schedule, canEdit, onView, onCopy }: {
  schedule: ExamSchedule; canEdit: boolean; onView: () => void; onCopy: () => void;
}) {
  const hasDateTime = !!schedule.start_datetime;
  const qs = (schedule as any).questions_status;
  const si = (schedule as any).students_info;
  const lc = (schedule as any).lifecycle_status;

  return (
    <div className="px-5 py-3.5 hover:bg-slate-50/60 transition-colors border-b border-slate-50 last:border-0 group">
      <div className="flex items-center gap-4">
        {/* Class name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className="font-semibold text-slate-800 text-sm">{schedule.class_name}</span>
            {schedule.section_name && (
              <span className="text-xs text-slate-400">({schedule.section_name})</span>
            )}
            <SetupBadge status={schedule.setup_status} />
            <LifecycleBadge status={lc} />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            {hasDateTime ? (() => {
              const { date, time } = formatDateTime(schedule.start_datetime!);
              return (
                <>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{date}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{time}</span>
                  <span>{schedule.duration_minutes} min</span>
                </>
              );
            })() : (
              <span className="flex items-center gap-1 text-amber-500">
                <AlertTriangle className="h-3 w-3" />No date set
              </span>
            )}
            <span className="text-slate-200">·</span>
            <span className="font-mono text-slate-400">{schedule.exam_code}</span>

            {/* Questions status */}
            {qs && (
              <>
                <span className="text-slate-200">·</span>
                <span className={`flex items-center gap-1 ${qs.complete ? 'text-emerald-600' : 'text-slate-400'}`}>
                  <FileQuestion className="h-3 w-3" />
                  {qs.actual}/{qs.expected} questions
                </span>
              </>
            )}

            {/* Students */}
            {si && (
              <>
                <span className="text-slate-200">·</span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {si.total} students
                  {si.submitted > 0 && <span className="text-emerald-600">({si.submitted} submitted)</span>}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           {canEdit && schedule.setup_status === 'ready' && (
             <button onClick={onCopy}
               className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors border border-transparent hover:border-violet-200"
               title="Copy setup to other arms">
               <RefreshCw className="h-4 w-4" />
             </button>
           )}
           <button onClick={onView}
             className="p-1.5 text-violet-500 hover:bg-violet-50 rounded-lg transition-colors border border-transparent hover:border-violet-200"
             title="View schedule">
             <Eye className="h-4 w-4" />
           </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();
  const { toasts, showToast, removeToast } = useToasts();

  const examId = parseInt(params.id as string);
  const isNew = searchParams.get('new') === 'true';

  const [exam, setExam] = useState<Exam | null>(null);
  const [schedules, setSchedules] = useState<ExamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(isNew);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());

  // Bulk date modal
  const [bulkSubject, setBulkSubject] = useState<{ id: number; name: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Copy modal
  const [copySource, setCopySource] = useState<ExamSchedule | null>(null);

  // Publish confirm
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  // Unpublish confirm
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [unpublishLoading, setUnpublishLoading] = useState(false);

  const canView    = user?.is_superuser || hasPermission('assessment_center.view_exammodel');
  const hasEditPerm = user?.is_superuser || hasPermission('assessment_center.change_exammodel');
  // Once published, date/time and configuration are locked
  const canEdit    = hasEditPerm && !exam?.is_published;
  const canPublish = hasEditPerm;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!canView) return;
    if (!silent) setLoading(true);
    try {
      const [examData, schedulesData] = await Promise.all([
        examsAPI.get(examId),
        examSchedulesAPI.list({ exam: examId }),
      ]);
      setExam(examData);
      setSchedules(schedulesData);
      if (polling && examData.schedules_created) setPolling(false);

      // Auto-expand all subjects on first load
      if (!silent) {
        const ids = new Set<number>();
        schedulesData.forEach((s: ExamSchedule) => {
          const sid = typeof s.subject === 'object' ? (s.subject as any).id : s.subject;
          ids.add(sid);
        });
        setExpandedSubjects(ids);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [examId, canView, polling]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Silent poll every 2s while schedules are being created
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => fetchData(true), 2000);
    return () => clearInterval(interval);
  }, [polling, fetchData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleBulkAssign = async (date: string, time: string, duration: number) => {
    if (!bulkSubject) return;
    setBulkLoading(true);
    try {
      const datetime = `${date}T${time}:00`;
      const subjectSchedules = schedules.filter(s => {
        const sid = typeof s.subject === 'object' ? (s.subject as any).id : s.subject;
        return sid === bulkSubject.id;
      });
      await Promise.all(subjectSchedules.map(s =>
        examSchedulesAPI.update(s.id, { start_datetime: datetime, duration_minutes: duration })
      ));
      showToast('success', `Date assigned to all ${bulkSubject.name} schedules`);
      setBulkSubject(null);
      await fetchData(true);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleCopyComplete = async () => {
    showToast('success', 'Setup copied successfully');
    setCopySource(null);
    await fetchData(true);
  };

  const handlePublish = async () => {
    if (!exam) return;
    setPublishLoading(true);
    try {
      await examsAPI.publish(exam.id);
      showToast('success', 'Exam published! Student PINs have been generated.');
      setShowPublishConfirm(false);
      await fetchData(true);
    } catch (err) {
      showToast('error', extractError(err));
      setShowPublishConfirm(false);
    } finally {
      setPublishLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!exam) return;
    setUnpublishLoading(true);
    try {
      await examsAPI.unpublish(exam.id);
      showToast('success', 'Exam unpublished');
      setShowUnpublishConfirm(false);
      await fetchData(true);
    } catch (err) {
      showToast('error', extractError(err));
      setShowUnpublishConfirm(false);
    } finally {
      setUnpublishLoading(false);
    }
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const schedulesBySubject = schedules.reduce((acc, s) => {
    const sid = typeof s.subject === 'object' ? (s.subject as any).id : s.subject as number;
    if (!acc[sid]) acc[sid] = { subject_id: sid, subject_name: s.subject_name || `Subject ${sid}`, schedules: [] };
    acc[sid].schedules.push(s);
    return acc;
  }, {} as Record<number, { subject_id: number; subject_name: string; schedules: ExamSchedule[] }>);

  const subjectGroups = Object.values(schedulesBySubject);
  const totalSchedules = schedules.length;
  const readySchedules = schedules.filter(s => s.setup_status === 'ready').length;
  const partialSchedules = schedules.filter(s => s.setup_status === 'partial').length;
  const draftSchedules = schedules.filter(s => s.setup_status === 'draft').length;
  const progress = totalSchedules > 0 ? Math.round((readySchedules / totalSchedules) * 100) : 0;
  const allReady = totalSchedules > 0 && readySchedules === totalSchedules;

  const toggleSubject = (id: number) =>
    setExpandedSubjects(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!canView) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500">You don't have permission to view this exam.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onRemove={removeToast} />

      {/* Bulk date modal */}
      <BulkDateModal
        open={!!bulkSubject}
        subjectName={bulkSubject?.name || ''}
        defaultDate={exam?.start_date || ''}
        loading={bulkLoading}
        onConfirm={handleBulkAssign}
        onCancel={() => setBulkSubject(null)}
      />

      {/* Copy modal */}
      <CopyScheduleModal
        open={!!copySource}
        sourceSchedule={copySource}
        onClose={() => setCopySource(null)}
        onComplete={handleCopyComplete}
      />

      {/* Publish confirm */}
      <ConfirmModal
        open={showPublishConfirm}
        title="Publish Exam"
        message={`Are you sure you want to publish "${exam?.name}"?`}
        subMessage="This will generate unique PINs for all students and make the exam accessible."
        confirmLabel="Publish & Generate PINs"
        confirmClass="bg-emerald-600 hover:bg-emerald-700"
        loading={publishLoading}
        onConfirm={handlePublish}
        onCancel={() => setShowPublishConfirm(false)}
      />

      {/* Unpublish confirm */}
      <ConfirmModal
        open={showUnpublishConfirm}
        title="Unpublish Exam"
        message={`Are you sure you want to unpublish "${exam?.name}"?`}
        subMessage="Students will lose access immediately. This cannot be done if students are currently taking the exam."
        confirmLabel="Unpublish"
        confirmClass="bg-red-600 hover:bg-red-700"
        loading={unpublishLoading}
        onConfirm={handleUnpublish}
        onCancel={() => setShowUnpublishConfirm(false)}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/dashboard/staff/assessment/exams')}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors mt-0.5 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                {exam?.is_practice_mode
                  ? <FlaskConical className="h-5 w-5 text-white" />
                  : exam?.is_published
                  ? <Globe className="h-5 w-5 text-white" />
                  : <ClipboardList className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {loading ? 'Loading…' : (exam?.name || 'Exam Not Found')}
                </h1>
                {exam && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-500 capitalize">
                      {EXAM_TYPE_LABELS[exam.exam_type] || exam.exam_type}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500">
                      {exam.start_date === exam.end_date ? exam.start_date : `${exam.start_date} → ${exam.end_date}`}
                    </span>
                    <span className="text-slate-300">·</span>
                    {exam.is_published
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Globe className="h-3 w-3" />Published
                        </span>
                      : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                          <Lock className="h-3 w-3" />Draft
                        </span>
                    }
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {exam && canPublish && (
              <div className="flex items-center gap-2">
                <button onClick={() => fetchData(true)}
                  className="p-2 border border-slate-200 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                  <RefreshCw className="h-4 w-4" />
                </button>
                {exam.is_published && (
                  <>
                    <button
                      onClick={() => router.push(`/dashboard/staff/assessment/exams/${exam.id}/pins`)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 border border-violet-200 font-semibold rounded-xl hover:bg-violet-100 transition-colors text-sm">
                      <Printer className="h-4 w-4" />
                      Print PINs
                    </button>
                    <button onClick={() => setShowUnpublishConfirm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 font-semibold rounded-xl hover:bg-red-100 transition-colors text-sm">
                      <Lock className="h-4 w-4" />
                      Unpublish
                    </button>
                  </>
                )}
                {!exam.is_published && (
                  <button
                    onClick={() => {
                      if (!allReady) {
                        showToast('error', `${totalSchedules - readySchedules} schedule(s) not ready yet`);
                        return;
                      }
                      setShowPublishConfirm(true);
                    }}
                    disabled={!exam.schedules_created}
                    className={`inline-flex items-center gap-2 px-4 py-2 font-semibold rounded-xl text-sm transition-all
                      ${allReady
                        ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 shadow-sm'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                    <Globe className="h-4 w-4" />
                    Publish Exam
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Polling banner ─────────────────────────────────────────────────── */}
      {polling && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
          <p className="text-sm text-blue-800 font-medium">Creating schedules in the background…</p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 text-violet-400 animate-spin" />
          <p className="text-sm text-slate-500">Loading exam details…</p>
        </div>
      ) : !exam ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <AlertCircle className="h-14 w-14 text-red-300 mx-auto mb-4" />
          <p className="font-semibold text-slate-700">Exam not found</p>
        </div>
      ) : (
        <>
          {/* ── Stat chips ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Schedules', value: totalSchedules,  color: 'text-violet-600' },
              { label: 'Ready',           value: readySchedules,  color: 'text-emerald-600' },
              { label: 'Partial',         value: partialSchedules, color: 'text-amber-600' },
              { label: 'Draft',           value: draftSchedules,  color: 'text-slate-500' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
                <p className="text-xs font-medium text-slate-500 mb-0.5">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* ── Progress bar (only while unpublished) ────────────────────────── */}
          {!exam.is_published && totalSchedules > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Setup Progress</p>
                  <p className="text-xs text-slate-400">{readySchedules} of {totalSchedules} schedules ready</p>
                </div>
                <span className={`text-2xl font-bold ${allReady ? 'text-emerald-600' : 'text-violet-600'}`}>
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${allReady ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-600 to-indigo-500'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              {allReady && (
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  All schedules ready — you can now publish the exam.
                </div>
              )}
            </div>
          )}

          {/* ── No schedules ─────────────────────────────────────────────────── */}
          {schedules.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
              <ClipboardList className="h-14 w-14 text-slate-200 mx-auto mb-4" />
              <p className="font-semibold text-slate-700 mb-1">No Schedules Yet</p>
              <p className="text-sm text-slate-400">
                {exam.schedules_created
                  ? 'No valid class × subject combinations found for this exam.'
                  : 'Schedules are being generated in the background…'}
              </p>
            </div>
          )}

          {/* ── Subject groups ───────────────────────────────────────────────── */}
          <div className="space-y-3">
            {subjectGroups.map(group => {
              const isExpanded = expandedSubjects.has(group.subject_id);
              const groupReady   = group.schedules.filter(s => s.setup_status === 'ready').length;
              const groupTotal   = group.schedules.length;
              const allGroupReady = groupReady === groupTotal;
              const someGroupReady = groupReady > 0 && !allGroupReady;

              return (
                <div key={group.subject_id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Subject header */}
                  <div className="flex items-center gap-0">
                    <button onClick={() => toggleSubject(group.subject_id)}
                      className="flex-1 px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50/60 transition-colors text-left">
                      <BookOpen className="h-4 w-4 text-violet-500 shrink-0" />
                      <span className="font-semibold text-slate-800 text-sm">{group.subject_name}</span>
                      <span className="text-xs text-slate-400">
                        {groupTotal} class{groupTotal !== 1 ? 'es' : ''}
                      </span>

                      {/* Progress pills */}
                      {allGroupReady ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />All Ready
                        </span>
                      ) : someGroupReady ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="h-3 w-3" />{groupReady}/{groupTotal} Ready
                        </span>
                      ) : null}

                      <span className="ml-auto">
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-slate-400" />
                          : <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </span>
                    </button>

                    {/* Bulk assign button */}
                    {canEdit && (
                      <button
                        onClick={() => setBulkSubject({ id: group.subject_id, name: group.subject_name })}
                        className="px-4 py-3.5 text-xs font-semibold text-violet-600 hover:bg-violet-50 border-l border-slate-100 transition-colors whitespace-nowrap">
                        Set Date/Time
                      </button>
                    )}
                  </div>

                  {/* Schedule rows */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {group.schedules.map(schedule => (
                        <ScheduleRow
                          key={schedule.id}
                          schedule={schedule}
                          canEdit={canEdit}
                          onView={() => router.push(
                            `/dashboard/staff/assessment/exams/${examId}/schedules/${schedule.id}`
                          )}
                          onCopy={() => setCopySource(schedule)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
