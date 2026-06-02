'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Shield, Clock, Users, AlertTriangle, CheckCircle2, X, Check,
  AlertCircle, Loader2, RefreshCw, ChevronRight, Camera, CameraOff,
  MessageSquare, XCircle, Plus, Minus, Eye, Radio, Activity,
  ChevronDown, ChevronLeft, Search, Filter, MoreHorizontal,
  UserX, UserCheck, Flag, Image as ImageIcon, ZapOff, Zap,
  Monitor, ArrowLeft, Send, Timer, SlidersHorizontal,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentData {
  attempt_id: string | null;
  student: { id: number; name: string; registration_number: string; photo: string | null; };
  status: 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned';
  started_at: string | null;
  submitted_at: string | null;
  remaining_seconds: number;
  answers_saved: number;
  total_questions: number;
  cheating_flags_count: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  is_flagged: boolean;
  camera_status: 'ok' | 'no_face' | 'multiple_faces' | 'unknown';
  tab_switches: number;
  face_alerts: number;
  device_type: string | null;
  hall: string | null;
}

interface TimelineEvent {
  id: number;
  attempt_id: string;
  student_name: string;
  student_id: number;
  event_type: string;
  event_description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  event_data: Record<string, any>;
  created_at: string;
  reviewed: boolean;
  action_taken: string | null;
  snapshot: string | null;
}

interface DashboardData {
  exam_schedule: {
    id: number;
    exam_name: string;
    subject_name: string;
    class_name: string;
    section_name: string | null;
    start_datetime: string;
    end_datetime: string;
    final_deadline: string;
    duration_minutes: number;
  };
  students: StudentData[];
  timeline: TimelineEvent[];
  statistics: {
    total: number;
    in_progress: number;
    submitted: number;
    not_started: number;
    abandoned: number;
    flagged: number;
    high_risk: number;
    no_face: number;
    server_time: string;
  };
  time_remaining_seconds: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d?.detail) return d.detail;
  if (d?.error) return d.error;
  if (typeof d === 'string') return d;
  return err?.message || 'An error occurred';
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  in_progress:   { label: 'Active',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  submitted:     { label: 'Submitted',   cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  auto_submitted:{ label: 'Auto-submitted', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  not_started:   { label: 'Not Started', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  abandoned:     { label: 'Abandoned',   cls: 'bg-red-100 text-red-600 border-red-200' },
};

const SEVERITY_CONFIG: Record<string, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-600', label: 'text-red-700' },
  high:     { dot: 'bg-red-500', label: 'text-red-600' },
  medium:   { dot: 'bg-amber-500', label: 'text-amber-700' },
  low:      { dot: 'bg-slate-400', label: 'text-slate-500' },
};

const RISK_CONFIG: Record<string, { cls: string; badge: string; row: string; border: string }> = {
  high:   { cls: 'text-red-700',   badge: 'bg-red-100 text-red-700 border-red-200',    row: 'bg-red-50/40',    border: 'border-l-red-500' },
  medium: { cls: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200', row: 'bg-amber-50/30', border: 'border-l-amber-500' },
  low:    { cls: 'text-slate-500', badge: 'bg-slate-50 text-slate-500 border-slate-200',  row: '',              border: 'border-l-transparent' },
};

// Quick warning templates
const WARNING_TEMPLATES = [
  'Please face your camera directly.',
  'Adjust your position so only your face is visible to the camera.',
  'You have been flagged for suspicious activity. Continue normally or your exam may be terminated.',
  'Return to your exam immediately.',
  'Please do not look away from your screen.',
];

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[10100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border pointer-events-auto max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'error'   ? 'bg-red-50 border-red-200 text-red-900'
          :                        'bg-blue-50 border-blue-200 text-blue-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 text-green-600 shrink-0" />
          : t.type === 'error'  ? <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          :                       <Activity className="h-4 w-4 text-blue-600 shrink-0" />}
          <span className="text-sm font-medium flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Warning Modal ────────────────────────────────────────────────────────────

function WarningModal({ open, studentName, onSend, onClose }: {
  open: boolean; studentName: string;
  onSend: (message: string) => Promise<void>; onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    await onSend(message.trim());
    setSending(false);
    setMessage('');
  };

  return (
    <div className="fixed inset-0 z-[10050] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <MessageSquare className="h-4 w-4" />
            <h3 className="font-bold">Send Warning to {studentName}</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quick Templates</p>
            <div className="space-y-1.5">
              {WARNING_TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => setMessage(t)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-xl border transition-all ${
                    message === t
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Custom Message</p>
            <textarea
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type a custom warning message..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSend} disabled={!message.trim() || sending}
              className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Warning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function SubmitModal({ open, studentName, onSubmit, onClose }: {
  open: boolean; studentName: string;
  onSubmit: (reason: string) => Promise<void>; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = [
    'Suspected external assistance',
    'Unauthorised person visible in camera',
    'Student left exam area',
    'Device violation',
    'Other',
  ];

  if (!open) return null;

  const finalReason = reason === 'Other' ? custom : reason;

  const handleSubmit = async () => {
    if (!finalReason.trim()) return;
    setSubmitting(true);
    await onSubmit(finalReason.trim());
    setSubmitting(false);
    setReason('');
    setCustom('');
  };

  return (
    <div className="fixed inset-0 z-[10050] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Terminate Exam</h3>
          <p className="text-sm text-slate-500 text-center mb-5">
            Submit and terminate <strong className="text-slate-700">{studentName}'s</strong> exam.
            This action is permanent.
          </p>

          <div className="space-y-2 mb-4">
            {reasons.map(r => (
              <label key={r} className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                reason === r ? 'bg-red-50 border-red-200' : 'border-slate-100 hover:border-slate-200'
              }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  reason === r ? 'border-red-500 bg-red-500' : 'border-slate-300'
                }`}>
                  {reason === r && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <input type="radio" value={r} checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
                <span className="text-sm text-slate-700">{r}</span>
              </label>
            ))}
          </div>

          {reason === 'Other' && (
            <textarea rows={2} value={custom} onChange={e => setCustom(e.target.value)}
              placeholder="Specify reason..."
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4 resize-none" />
          )}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={!finalReason.trim() || submitting}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Terminate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Extend Time Modal ────────────────────────────────────────────────────────

function ExtendModal({ open, studentName, onExtend, onClose }: {
  open: boolean; studentName: string;
  onExtend: (minutes: number, reason: string) => Promise<void>; onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(5);
  const [reason, setReason] = useState('');
  const [extending, setExtending] = useState(false);

  if (!open) return null;

  const presets = [5, 10, 15, 20];

  const handleExtend = async () => {
    if (minutes <= 0) return;
    setExtending(true);
    await onExtend(minutes, reason);
    setExtending(false);
  };

  return (
    <div className="fixed inset-0 z-[10050] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="p-6">
          <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Timer className="h-6 w-6 text-violet-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Grant Extra Time</h3>
          <p className="text-sm text-slate-500 text-center mb-5">
            Add time for <strong className="text-slate-700">{studentName}</strong>
          </p>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Minutes</p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {presets.map(p => (
                  <button key={p} onClick={() => setMinutes(p)}
                    className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                      minutes === p ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-violet-300'
                    }`}>
                    +{p}m
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2">
                <button onClick={() => setMinutes(p => Math.max(1, p - 1))}
                  className="text-slate-400 hover:text-slate-700 transition-colors">
                  <Minus className="h-4 w-4" />
                </button>
                <input type="number" value={minutes} onChange={e => setMinutes(parseInt(e.target.value) || 1)}
                  min={1} max={120}
                  className="flex-1 text-center font-bold text-slate-800 outline-none text-sm" />
                <button onClick={() => setMinutes(p => Math.min(120, p + 1))}
                  className="text-slate-400 hover:text-slate-700 transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Reason <span className="normal-case font-normal text-slate-400">(optional)</span>
              </label>
              <input type="text" value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g., Technical issue, bathroom break..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleExtend} disabled={minutes <= 0 || extending}
              className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {extending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />}
              Grant +{minutes}m
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Student Detail Slide-Over ────────────────────────────────────────────────

function StudentSlideOver({ student, events, onClose, onWarn, onSubmit, onExtend }: {
  student: StudentData | null;
  events: TimelineEvent[];
  onClose: () => void;
  onWarn: () => void;
  onSubmit: () => void;
  onExtend: () => void;
}) {
  const isActive = student?.status === 'in_progress';
  const risk = RISK_CONFIG[student?.risk_level ?? 'low'];
  const status = STATUS_CONFIG[student?.status ?? 'not_started'];

  const studentEvents = student
    ? events.filter(e => e.attempt_id === student.attempt_id)
    : [];

  return (
    <div className={`fixed inset-y-0 right-0 z-[10030] w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ${student ? 'translate-x-0' : 'translate-x-full'}`}>
      {!student ? null : (
        <>
          {/* Header */}
          <div className={`px-6 py-5 border-b border-slate-100 ${risk.row} flex-shrink-0`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {student.student.photo ? (
                  <img src={student.student.photo} alt={student.student.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center">
                    <span className="text-lg font-bold text-slate-500">
                      {student.student.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900">{student.student.name}</p>
                  <p className="text-xs text-slate-400">{student.student.registration_number}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${status.cls}`}>
                      {status.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${risk.badge}`}>
                      {student.risk_level.toUpperCase()} RISK · {student.risk_score}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="px-6 py-4 border-b border-slate-100 grid grid-cols-3 gap-3 flex-shrink-0">
            {[
              { label: 'Answers', value: `${student.answers_saved}/${student.total_questions}` },
              { label: 'Tab Switches', value: student.tab_switches },
              { label: 'Face Alerts', value: student.face_alerts },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                <p className="text-base font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Event log */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Event Log ({studentEvents.length})
              </p>
              {studentEvents.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4">No events recorded</p>
              ) : (
                <div className="space-y-2">
                  {studentEvents.map(e => {
                    const sev = SEVERITY_CONFIG[e.severity];
                    return (
                      <div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-50">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sev.dot}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 capitalize">{e.event_description}</p>
                          {e.event_data?.message && (
                            <p className="text-xs text-slate-400 mt-0.5 italic">"{e.event_data.message}"</p>
                          )}
                          <p className="text-xs text-slate-400 mt-0.5">{timeAgo(e.created_at)}</p>
                        </div>
                        {e.snapshot && (
                          <a href={e.snapshot} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 p-1 text-slate-400 hover:text-blue-600 transition-colors">
                            <ImageIcon className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {isActive && (
            <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 space-y-2">
              <button onClick={onWarn}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold rounded-xl transition-colors text-sm">
                <MessageSquare className="h-4 w-4" /> Send Warning
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onExtend}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 font-semibold rounded-xl transition-colors text-sm">
                  <Timer className="h-4 w-4" /> Extend Time
                </button>
                <button onClick={onSubmit}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold rounded-xl transition-colors text-sm">
                  <XCircle className="h-4 w-4" /> Terminate
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Camera Status Icon ───────────────────────────────────────────────────────

function CameraStatusIcon({ status }: { status: StudentData['camera_status'] }) {
  if (status === 'ok') return <Camera className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === 'no_face') return <CameraOff className="h-3.5 w-3.5 text-red-500 animate-pulse" />;
  if (status === 'multiple_faces') return <Users className="h-3.5 w-3.5 text-amber-500" />;
  return <Camera className="h-3.5 w-3.5 text-slate-300" />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProctoringRoom() {
  const params = useParams();
  const scheduleId = params?.id as string;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pollingPaused, setPollingPaused] = useState(false);

  // Countdown from server time
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  // UI state
  const [showTimeline, setShowTimeline] = useState(true);
  const [sortBy, setSortBy] = useState<'risk' | 'name' | 'status'>('risk');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchStudent, setSearchStudent] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'high'>('all');

  // Selected student for slide-over
  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);

  // Action modals
  const [warningTarget, setWarningTarget] = useState<StudentData | null>(null);
  const [submitTarget, setSubmitTarget] = useState<StudentData | null>(null);
  const [extendTarget, setExtendTarget] = useState<StudentData | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastCounter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!scheduleId) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.get(`/api/assessment/proctoring/dashboard/${scheduleId}/`);
      setData(res.data);
      setCountdownSeconds(res.data.time_remaining_seconds);
      setLastUpdated(new Date());
    } catch (err) {
      if (!silent) showToast('error', extractError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [scheduleId, showToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Pause/resume on visibility change
  useEffect(() => {
    const handler = () => setPollingPaused(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Polling every 10s — recursive setTimeout to avoid drift
  const pollRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    const poll = async () => {
      if (!document.hidden) await fetchData(true);
      pollRef.current = setTimeout(poll, 10000);
    };
    pollRef.current = setTimeout(poll, 10000);
    return () => clearTimeout(pollRef.current);
  }, [fetchData]);

  // Local countdown tick
  useEffect(() => {
    if (countdownSeconds <= 0) return;
    const t = setInterval(() => setCountdownSeconds(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [countdownSeconds > 0]);

  // Keep selected student fresh after polls
  useEffect(() => {
    if (!selectedStudent || !data) return;
    const fresh = data.students.find(s => s.attempt_id === selectedStudent.attempt_id
      || s.student.id === selectedStudent.student.id);
    if (fresh) setSelectedStudent(fresh);
  }, [data]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSendWarning = async (message: string) => {
    if (!warningTarget?.attempt_id) return;
    try {
      await api.post(`/api/assessment/exam-attempts/${warningTarget.attempt_id}/send-warning/`, { message });
      showToast('success', `Warning sent to ${warningTarget.student.name}`);
      setWarningTarget(null);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleSubmitExam = async (reason: string) => {
    if (!submitTarget?.attempt_id) return;
    try {
      await api.post(`/api/assessment/exam-attempts/${submitTarget.attempt_id}/invigilator-submit/`, { reason });
      showToast('success', `${submitTarget.student.name}'s exam terminated`);
      setSubmitTarget(null);
      setSelectedStudent(null);
      await fetchData(true);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleExtendTime = async (minutes: number, reason: string) => {
    if (!extendTarget?.attempt_id) return;
    try {
      await api.post(`/api/assessment/exam-attempts/${extendTarget.attempt_id}/extend-time/`, { minutes, reason });
      showToast('success', `+${minutes} min granted to ${extendTarget.student.name}`);
      setExtendTarget(null);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleReviewEvent = async (eventId: number, action: string) => {
    try {
      await api.post(`/api/assessment/proctoring-events/${eventId}/review/`, { action_taken: action });
      await fetchData(true);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const students = data?.students ?? [];

  const filteredStudents = students
    .filter(s => {
      if (filterStatus && s.status !== filterStatus) return false;
      if (searchStudent && !s.student.name.toLowerCase().includes(searchStudent.toLowerCase())
        && !s.student.registration_number.toLowerCase().includes(searchStudent.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'risk') return b.risk_score - a.risk_score;
      if (sortBy === 'name') return a.student.name.localeCompare(b.student.name);
      if (sortBy === 'status') {
        const order = { in_progress: 0, not_started: 1, submitted: 2, auto_submitted: 2, abandoned: 3 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      }
      return 0;
    });

  const timelineEvents = (data?.timeline ?? [])
    .filter(e => timelineFilter === 'all' || e.severity === 'high' || e.severity === 'critical');

  const stats = data?.statistics;
  const exam = data?.exam_schedule;

  const isExpired = countdownSeconds <= 0;
  const isUrgent = countdownSeconds > 0 && countdownSeconds < 600;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-100 flex flex-col overflow-hidden">
      <ToastStack toasts={toasts} onRemove={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* Modals */}
      <WarningModal
        open={!!warningTarget}
        studentName={warningTarget?.student.name ?? ''}
        onSend={handleSendWarning}
        onClose={() => setWarningTarget(null)}
      />
      <SubmitModal
        open={!!submitTarget}
        studentName={submitTarget?.student.name ?? ''}
        onSubmit={handleSubmitExam}
        onClose={() => setSubmitTarget(null)}
      />
      <ExtendModal
        open={!!extendTarget}
        studentName={extendTarget?.student.name ?? ''}
        onExtend={handleExtendTime}
        onClose={() => setExtendTarget(null)}
      />

      {/* Slide-over */}
      <StudentSlideOver
        student={selectedStudent}
        events={data?.timeline ?? []}
        onClose={() => setSelectedStudent(null)}
        onWarn={() => { setWarningTarget(selectedStudent); setSelectedStudent(null); }}
        onSubmit={() => { setSubmitTarget(selectedStudent); setSelectedStudent(null); }}
        onExtend={() => { setExtendTarget(selectedStudent); setSelectedStudent(null); }}
      />
      {selectedStudent && (
        <div className="fixed inset-0 z-[10020] bg-black/20" onClick={() => setSelectedStudent(null)} />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="px-5 py-3 flex items-center gap-4">

          {/* Left: back + exam info */}
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => window.close()}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-900 text-sm truncate">
                  {exam?.subject_name} — {exam?.class_name}{exam?.section_name ? ` (${exam.section_name})` : ''}
                </p>
                {stats && stats.in_progress > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping absolute" />
                    <Radio className="h-2.5 w-2.5 relative" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{exam?.exam_name}</p>
            </div>
          </div>

          {/* Center: stat chips */}
          {stats && (
            <div className="hidden md:flex items-center gap-2 flex-1 justify-center">
              {[
                { value: stats.in_progress, label: 'Active', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                { value: stats.submitted, label: 'Submitted', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { value: stats.not_started, label: 'Pending', color: 'text-slate-600 bg-slate-50 border-slate-200' },
                { value: stats.flagged, label: 'Flagged', color: stats.flagged > 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-slate-400 bg-slate-50 border-slate-100' },
                { value: stats.high_risk, label: 'High Risk', color: stats.high_risk > 0 ? 'text-red-700 bg-red-50 border-red-200' : 'text-slate-400 bg-slate-50 border-slate-100' },
              ].map(({ value, label, color }) => (
                <div key={label} className={`px-3 py-1 rounded-xl border text-xs font-bold ${color}`}>
                  {value} {label}
                </div>
              ))}
            </div>
          )}

          {/* Right: countdown + refresh */}
          <div className="flex items-center gap-2 shrink-0">
            {pollingPaused && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                Paused
              </span>
            )}
            {lastUpdated && (
              <span className="text-xs text-slate-400 hidden sm:block">
                Updated {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
            <button onClick={() => fetchData(true)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className={`px-3 py-1.5 rounded-xl border text-sm font-mono font-bold ${
              isExpired ? 'bg-slate-100 text-slate-400 border-slate-200'
              : isUrgent ? 'bg-red-100 text-red-700 border-red-200 animate-pulse'
              : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}>
              <Clock className="h-3.5 w-3.5 inline mr-1.5" />
              {isExpired ? 'Ended' : formatCountdown(countdownSeconds)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading monitoring room…</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">

          {/* ── Student Table ────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Table toolbar */}
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input type="text" placeholder="Search student…" value={searchStudent}
                  onChange={e => setSearchStudent(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none text-slate-700 bg-white">
                <option value="">All Status</option>
                <option value="in_progress">Active</option>
                <option value="submitted">Submitted</option>
                <option value="not_started">Not Started</option>
                <option value="abandoned">Abandoned</option>
              </select>

              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {(['risk', 'name', 'status'] as const).map(s => (
                  <button key={s} onClick={() => setSortBy(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all capitalize ${
                      sortBy === s ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {s === 'risk' ? '⚠ Risk' : s}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-400 ml-auto">
                {filteredStudents.length}/{students.length} students
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-slate-400">No students match your filter</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredStudents.map(student => {
                    const risk = RISK_CONFIG[student.risk_level];
                    const statusCfg = STATUS_CONFIG[student.status];
                    const isActive = student.status === 'in_progress';
                    const isSelected = selectedStudent?.student.id === student.student.id;

                    return (
                      <div key={student.student.id}
                        onClick={() => setSelectedStudent(student)}
                        className={`flex items-center gap-4 px-4 py-3 cursor-pointer transition-all border-l-4 group
                          ${risk.border} ${risk.row}
                          ${isSelected ? 'ring-1 ring-blue-200 bg-blue-50/40' : 'hover:bg-slate-50'}
                        `}>

                        {/* Photo + name */}
                        <div className="flex items-center gap-3 w-52 min-w-0 shrink-0">
                          {student.student.photo ? (
                            <img src={student.student.photo} alt={student.student.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                              <span className="text-sm font-bold text-slate-500">
                                {student.student.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{student.student.name}</p>
                            <p className="text-xs text-slate-400 truncate">{student.student.registration_number}</p>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="w-28 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </div>

                        {/* Risk */}
                        <div className="w-24 shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${risk.badge}`}>
                            {student.risk_level.toUpperCase()} {student.risk_score > 0 ? `·${student.risk_score}` : ''}
                          </span>
                        </div>

                        {/* Camera */}
                        <div className="w-8 flex justify-center shrink-0">
                          <CameraStatusIcon status={student.camera_status} />
                        </div>

                        {/* Tab switches */}
                        <div className="w-12 shrink-0 text-center">
                          {student.tab_switches > 0 ? (
                            <span className={`text-xs font-bold ${student.tab_switches >= 5 ? 'text-red-600' : student.tab_switches >= 3 ? 'text-amber-600' : 'text-slate-500'}`}>
                              {student.tab_switches}✕
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </div>

                        {/* Progress */}
                        <div className="flex-1 min-w-0">
                          {isActive && student.total_questions > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">
                                  {student.answers_saved}/{student.total_questions}
                                </span>
                                {student.remaining_seconds > 0 && (
                                  <span className={`text-xs font-mono ${student.remaining_seconds < 300 ? 'text-red-600' : 'text-slate-400'}`}>
                                    {formatCountdown(student.remaining_seconds)}
                                  </span>
                                )}
                              </div>
                              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all"
                                  style={{ width: `${(student.answers_saved / student.total_questions) * 100}%` }} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {student.status === 'submitted' || student.status === 'auto_submitted'
                                ? `${student.answers_saved} answered`
                                : '—'}
                            </span>
                          )}
                        </div>

                        {/* Actions (hover) */}
                        {isActive && student.attempt_id && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setWarningTarget(student)}
                              title="Send warning"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-100 transition-colors border border-amber-200">
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setExtendTarget(student)}
                              title="Extend time"
                              className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors border border-violet-200">
                              <Timer className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setSubmitTarget(student)}
                              title="Force submit"
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-100 transition-colors border border-red-200">
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Timeline ────────────────────────────────────────────────── */}
          <div className={`border-l border-slate-200 bg-white flex flex-col transition-all duration-300 overflow-hidden ${showTimeline ? 'w-80' : 'w-0'}`}>
            {showTimeline && (
              <>
                {/* Timeline header */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Live Feed</span>
                    {timelineEvents.length > 0 && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
                        {timelineEvents.length}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                      {(['all', 'high'] as const).map(f => (
                        <button key={f} onClick={() => setTimelineFilter(f)}
                          className={`px-2 py-1 rounded-md text-xs font-semibold transition-all capitalize ${
                            timelineFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                          }`}>
                          {f === 'high' ? '⚠ High' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Timeline events */}
                <div className="flex-1 overflow-y-auto">
                  {timelineEvents.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-xs text-slate-400">No events yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {timelineEvents.map(event => {
                        const sev = SEVERITY_CONFIG[event.severity];
                        return (
                          <div key={event.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-start gap-2.5">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sev.dot}`} />
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => {
                                    const s = students.find(st => st.student.id === event.student_id);
                                    if (s) setSelectedStudent(s);
                                  }}
                                  className="text-xs font-semibold text-blue-600 hover:underline block truncate text-left">
                                  {event.student_name}
                                </button>
                                <p className={`text-xs mt-0.5 capitalize ${sev.label}`}>
                                  {event.event_description}
                                </p>
                                {event.event_data?.message && (
                                  <p className="text-xs text-slate-400 mt-0.5 italic truncate">
                                    "{event.event_data.message}"
                                  </p>
                                )}
                                <p className="text-xs text-slate-400 mt-1">{timeAgo(event.created_at)}</p>
                              </div>

                              {/* Quick actions */}
                              {!event.reviewed && event.attempt_id && (
                                <div className="flex flex-col gap-1 shrink-0">
                                  <button
                                    onClick={() => handleReviewEvent(event.id, 'ignored')}
                                    title="Ignore"
                                    className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors">
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      const s = students.find(st => st.attempt_id === event.attempt_id);
                                      if (s) setWarningTarget(s);
                                    }}
                                    title="Warn student"
                                    className="p-1 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors">
                                    <MessageSquare className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              {event.snapshot && (
                                <a href={event.snapshot} target="_blank" rel="noopener noreferrer"
                                  className="p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0">
                                  <ImageIcon className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Timeline toggle button */}
          <button
            onClick={() => setShowTimeline(p => !p)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-5 h-16 bg-white border border-slate-200 rounded-l-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            style={{ right: showTimeline ? '320px' : '0px' }}
            title={showTimeline ? 'Hide timeline' : 'Show timeline'}>
            {showTimeline ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}