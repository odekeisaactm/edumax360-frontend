'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { resultUploadAPI } from '@/lib/api';
import {
  Save, ArrowLeft, Loader2, AlertCircle, CheckCircle2,
  FileText, AlertTriangle, X, Upload, Eye, FileUp,
  Mic, MicOff, MessageSquare, Check,
} from 'lucide-react';
import { examScriptAPI, resultVoiceAPI } from '@/lib/result.service';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Field {
  name: string;
  max_mark: number;
  field_type: 'ca' | 'exam';
  is_midterm: boolean;
  order: number;
  is_editable?: boolean;
}

interface StudentScore {
  student_id: number;
  student_name: string;
  reg_number: string;
  image?: string | null;
  scores: Record<string, number | string | null>;
}

interface PrepareData {
  class_config_id: number;
  class_name: string;
  subject_id: number;
  subject_name: string;
  period_id: number;
  period_name: string;
  session_id: number;
  session_name: string;
  result_type: string;
  fields: Field[];
  students: StudentScore[];
  is_update: boolean;
}

interface SubmitResponse {
  saved: number;
  has_ca: boolean;
  has_exam: boolean;
  errors: any[];
  message: string;
}

interface VoiceLog {
  id: number;
  transcript: string;
  intent?: string;
}

interface ExamScript {
  file_type: 'pdf' | 'images';
  file_data: string[];
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function speak(msg: string) {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  synth.speak(new SpeechSynthesisUtterance(msg));
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : t.type === 'warn'
            ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Modal (for "save and complete" voice command) ────────────────────

function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Confirm Action</h3>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all"
          >
            Confirm
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center">Say "cancel" or "dismiss" to close with voice</p>
      </div>
    </div>
  );
}

// ─── Score Input ──────────────────────────────────────────────────────────────

function ScoreInput({ value, maxMark, fieldName, studentId, isEditable = true, onChange, onFocus }: {
  value: number | string | null;
  maxMark: number;
  fieldName: string;
  studentId: number;
  isEditable?: boolean;
  onChange: (studentId: number, fieldName: string, value: string) => void;
  onFocus?: (studentId: number, fieldName: string) => void;
}) {
  // Represent internally as string to avoid the 0-erase loop
  const toDisplay = (v: number | string | null): string => {
    if (v === null || v === undefined || v === '') return '';
    return String(v);
  };

  const [localValue, setLocalValue] = useState<string>(toDisplay(value));
  const [error, setError] = useState<string | null>(null);

  // Sync from parent only when parent value actually changes meaningfully
  const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
    setLocalValue(toDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isEditable) return;
    const raw = e.target.value;
    setLocalValue(raw);
    setError(null);

    if (raw === '') {
      onChange(studentId, fieldName, '');
      return;
    }

    const num = parseFloat(raw);
    if (isNaN(num)) return; // let user keep typing, don't propagate NaN

    if (num < 0) {
      setError('Cannot be negative');
      onChange(studentId, fieldName, '0');
    } else if (num > maxMark) {
      setError(`Max is ${maxMark}`);
      // clamp
      onChange(studentId, fieldName, String(maxMark));
    } else {
      onChange(studentId, fieldName, raw);
    }
  };

  const handleBlur = () => {
    if (!isEditable) return;

    // FIX: Prevent the blur event from overwriting a new voice update
    if (localValue === toDisplay(value)) return;

    if (localValue === '') {
      onChange(studentId, fieldName, '');
      return;
    }
    const num = parseFloat(localValue);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(num, 0), maxMark);
      setLocalValue(String(clamped));
      onChange(studentId, fieldName, String(clamped));
    } else {
      // invalid text — clear
      setLocalValue('');
      onChange(studentId, fieldName, '');
    }
    setError(null);
  };

  return (
    <div className="relative">
      <input
        id={`input-${studentId}-${fieldName.replace(/\s+/g, '-')}`}
        type="number"
        step="1"
        min="0"
        max={maxMark}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => onFocus && onFocus(studentId, fieldName)}
        readOnly={!isEditable}
        className={`w-20 px-2 py-1.5 text-sm text-center border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors
          ${error
            ? 'border-red-400 bg-red-50'
            : !isEditable
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
            : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        placeholder="—"
      />
      {error && (
        <div className="absolute -top-6 left-0 text-[10px] text-red-500 whitespace-nowrap bg-red-50 border border-red-200 px-1.5 py-0.5 rounded z-10">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── File Uploader ─────────────────────────────────────────────────────────────

function FileUploader({ onUpload, isUploading }: {
  onUpload: (files: File[]) => void;
  isUploading: boolean;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const selected = Array.from(e.target.files);
    const hasPdf = selected.some(f => f.type === 'application/pdf');
    const hasImg = selected.some(f => f.type.startsWith('image/'));
    if (hasPdf && hasImg) {
      setError('Cannot mix PDF and image files. Choose one type only.');
      setFiles([]);
      return;
    }
    setError(null);
    setFiles(selected);
  };

  const handleUpload = () => {
    if (files.length === 0) return;
    onUpload(files);
    setFiles([]);
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        multiple
        accept="image/*,.pdf"
        onChange={handleChange}
        className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {files.length > 0 && (
        <p className="text-xs text-slate-500">{files.length} file(s) selected</p>
      )}
      <button
        onClick={handleUpload}
        disabled={files.length === 0 || isUploading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Upload
      </button>
    </div>
  );
}

// ─── Answer Sheet Modal ────────────────────────────────────────────────────────

function AnswerSheetModal({ student, data, onClose, showToast }: {
  student: StudentScore;
  data: PrepareData;
  onClose: () => void;
  showToast: (type: 'success' | 'error', msg: string) => void;
}) {
  const [answerSheet, setAnswerSheet] = useState<ExamScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sheet = await examScriptAPI.getAnswerSheet({
          student_id: student.student_id,
          class_config_id: data.class_config_id,
          subject_id: data.subject_id,
          academic_period_id: data.period_id,
        });
        if (!cancelled) setAnswerSheet(sheet);
      } catch {
        // 404 means none uploaded yet — that's fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student.student_id, data]);

  const handleUpload = async (files: File[]) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('student_id', student.student_id.toString());
    fd.append('class_config_id', data.class_config_id.toString());
    fd.append('subject_id', data.subject_id.toString());
    fd.append('academic_period_id', data.period_id.toString());
    files.forEach(f => fd.append('files', f));
    try {
      const sheet = await examScriptAPI.uploadAnswerSheet(fd);
      setAnswerSheet(sheet);
      showToast('success', 'Answer sheet uploaded.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setUploading(false);
    }
  };

  const openFiles = (script: ExamScript) => {
  if (script.file_type === 'pdf') {
    window.open(script.file_data[0], '_blank');
  } else {
    // Build one HTML page containing all images — avoids popup-blocker killing all but the first
    const imgTags = script.file_data
      .map(url => `<img src="${url}" style="max-width:100%;height:auto;display:block;margin:0 auto">`)
      .join('<hr style="border-color:#333;margin:12px 0">');
    const html = `<!DOCTYPE html><html><head><title>Answer Sheet</title></head>
      <body style="margin:0;padding:12px;background:#1a1a1a;box-sizing:border-box">
        ${imgTags}
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up the object URL after the tab has had time to load it
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
};

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: '88vh' }}>
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Answer Sheet — {student.student_name}
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
            </div>
          ) : answerSheet ? (
            <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50">
              <div>
                <p className="text-sm font-semibold text-slate-800">Answer sheet on file</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    answerSheet.file_type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>{answerSheet.file_type}</span>
                  <span className="text-xs text-slate-400">{answerSheet.file_data.length} file(s)</span>
                </div>
              </div>
              <button
                onClick={() => openFiles(answerSheet)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </button>
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
              <p className="text-sm text-slate-400">No answer sheet uploaded yet.</p>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              {answerSheet ? 'Replace Answer Sheet' : 'Upload Answer Sheet'}
            </h4>
            <FileUploader onUpload={handleUpload} isUploading={uploading} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ScoreUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const classId = searchParams.get('class');
  const subjectId = searchParams.get('subject');
  const periodId = searchParams.get('period');

  // ── Data state ──
  const [data, setData] = useState<PrepareData | null>(null);
  const [studentScores, setStudentScores] = useState<Record<number, Record<string, number | string | null>>>({});
  const [questionPaper, setQuestionPaper] = useState<ExamScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // ── UI state ──
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [uploadingQP, setUploadingQP] = useState(false);
  const [showQPUploader, setShowQPUploader] = useState(false);
  const [selectedStudentForSheet, setSelectedStudentForSheet] = useState<StudentScore | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Voice state ──
  const [mounted, setMounted] = useState(false);
  const [voiceLogs, setVoiceLogs] = useState<VoiceLog[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [voicePaused, setVoicePaused] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // ── Voice navigation state ──
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  // ── Refs: the recognition handler can ONLY read from these, never from state ──
  const recognitionRef = useRef<any>(null);
  const voicePausedRef = useRef(false);
  const activeStudentIdRef = useRef<number | null>(null);
  const activeFieldRef = useRef<string | null>(null);
  const dataRef = useRef<PrepareData | null>(null);
  const studentScoresRef = useRef<Record<number, Record<string, number | string | null>>>({});
  const showConfirmModalRef = useRef(false);
  const processIntentRef = useRef<((intent: any) => void) | null>(null);
  const voiceBusyRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { studentScoresRef.current = studentScores; }, [studentScores]);
  useEffect(() => { activeStudentIdRef.current = activeStudentId; }, [activeStudentId]);
  useEffect(() => { activeFieldRef.current = activeField; }, [activeField]);
  useEffect(() => { voicePausedRef.current = voicePaused; }, [voicePaused]);
  useEffect(() => { showConfirmModalRef.current = showConfirmModal; }, [showConfirmModal]);

  // ── Mark mounted (avoids hydration mismatch) ──
  useEffect(() => { setMounted(true); }, []);

  // ── Toast helpers ──
  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Score change handler ──
  const handleScoreChange = useCallback((studentId: number, fieldName: string, value: string) => {
    setStudentScores(prev => {
      const next = {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [fieldName]: value === '' ? null : Number(value),
        },
      };
      studentScoresRef.current = next;
      return next;
    });
  }, []);

  // ── Field focus handler (called by ScoreInput and by processIntent) ──
  const handleFieldFocus = useCallback((studentId: number, fieldName: string) => {
    setActiveStudentId(studentId);
    setActiveField(fieldName);
    activeStudentIdRef.current = studentId;
    activeFieldRef.current = fieldName;
  }, []);

  // ── Focus a DOM input by studentId + fieldName ──
  const focusInput = useCallback((studentId: number, fieldName: string) => {
  const el = document.getElementById(
    `input-${studentId}-${fieldName.replace(/\s+/g, '-')}`
  ) as HTMLInputElement | null;
  if (el) {
    el.focus();
    handleFieldFocus(studentId, fieldName);
  }
}, [handleFieldFocus]);

  // ── Scroll student row into view ──
  const scrollToStudent = useCallback((studentId: number) => {
    const row = document.getElementById(`student-row-${studentId}`);
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ── Submit handler ──
  const handleSubmit = useCallback(async (navigateAway = false) => {
    const current = dataRef.current;
    if (!current) return;

    setSubmitting(true);
    try {
      const studentScoresArray = current.students.map(s => ({
        student_id: s.student_id,
        scores: Object.fromEntries(
          Object.entries(studentScoresRef.current[s.student_id] || {}).map(([k, v]) => [k, v === '' ? null : v])
        ),
      })) as any[];

      const response: SubmitResponse = await resultUploadAPI.submit({
        class_config_id: current.class_config_id,
        subject_id: current.subject_id,
        academic_period_id: current.period_id,
        student_scores: studentScoresArray,
      });

      if (response.errors && response.errors.length > 0) {
        showToast('warn', `Saved with ${response.errors.length} error(s). Check and retry.`);
        // Stay on page — do not navigate even if navigateAway was requested
      } else {
        showToast('success', response.message);
        if (navigateAway) {
          router.replace(`/dashboard/staff/result/view/score?class=${current.class_config_id}&subject=${current.subject_id}`);
        }
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSubmitting(false);
    }
  }, [router, showToast]);

  // ── processIntent: reads ONLY from refs, calls setState for updates ──
  const processIntent = useCallback((intentData: any) => {
    const current = dataRef.current;
    if (!current) return;

    const { intent } = intentData;
    const sid = activeStudentIdRef.current;
    const field = activeFieldRef.current;
    const scores = studentScoresRef.current;

    if (intent === 'unknown' || !intent) return; // silent ignore

    if (intent === 'dismiss') {
      setShowConfirmModal(false);
      showConfirmModalRef.current = false;
      setToasts(prev => prev.filter(t => t.type !== 'error'));
      return;
    }

    // If confirm modal is open, only dismiss is allowed
    if (showConfirmModalRef.current) return;

    if (intent === 'focus_student') {
      const targetId: number = intentData.student_id;
      if (!targetId) return;

      setActiveStudentId(targetId);
      activeStudentIdRef.current = targetId;
      scrollToStudent(targetId);

      // Only auto-focus first field if it's blank
      const firstEditable = current.fields.find(f => f.is_editable !== false);
      if (firstEditable) {
        const existing = scores[targetId]?.[firstEditable.name];
        const isBlank = existing === null || existing === undefined || existing === '';
        if (isBlank) {
          focusInput(targetId, firstEditable.name);
        } else {
          // Just highlight the row, no focus
          setActiveField(null);
          activeFieldRef.current = null;
        }
      }
      return;
    }

    if (intent === 'focus_field') {
      if (!sid) return;
      const targetField: string = intentData.field_name;
      if (!targetField) return;
      const fieldDef = current.fields.find(f => f.name.toLowerCase() === targetField.toLowerCase() && f.is_editable !== false);
      if (fieldDef) focusInput(sid, fieldDef.name);
      return;
    }

    if (intent === 'enter_score') {
      if (!sid || !field) return;
      const fieldDef = current.fields.find(f => f.name === field);
      if (!fieldDef) return;
      const val: number = intentData.value;
      if (val > fieldDef.max_mark) {
        const msg = `That value exceeds the maximum of ${fieldDef.max_mark} for ${fieldDef.name}.`;
        showToast('warn', msg);
        speak(msg);
        return;
      }
      handleScoreChange(sid, field, String(val));

      // Advance to next editable blank field for this student
      const fieldIndex = current.fields.findIndex(f => f.name === field);
      const remaining = current.fields.slice(fieldIndex + 1).filter(f => f.is_editable !== false);
      const nextField = remaining[0];
      if (nextField) {
        focusInput(sid, nextField.name);
      } else {
        // Try to move to next student's first blank editable field
        const studentIndex = current.students.findIndex(s => s.student_id === sid);
        if (studentIndex < current.students.length - 1) {
          const nextStudent = current.students[studentIndex + 1];
          const nextSid = nextStudent.student_id;
          const nextStudentScores = scores[nextSid] || {};
          const firstBlankField = current.fields
            .filter(f => f.is_editable !== false)
            .find(f => {
              const v = nextStudentScores[f.name];
              return v === null || v === undefined || v === '';
            });
          if (firstBlankField) {
            setActiveStudentId(nextSid);
            activeStudentIdRef.current = nextSid;
            scrollToStudent(nextSid);
            focusInput(nextSid, firstBlankField.name);
          }
        }
      }
      return;
    }

    if (intent === 'next') {
      if (!sid || !field) return;
      const fieldIndex = current.fields.findIndex(f => f.name === field);
      const nextInRow = current.fields.slice(fieldIndex + 1).find(f => f.is_editable !== false);
      if (nextInRow) {
        focusInput(sid, nextInRow.name);
      } else {
        const studentIndex = current.students.findIndex(s => s.student_id === sid);
        if (studentIndex < current.students.length - 1) {
          const nextStudent = current.students[studentIndex + 1];
          const nextSid = nextStudent.student_id;
          const nextStudentScores = scores[nextSid] || {};
          const firstBlankField = current.fields
            .filter(f => f.is_editable !== false)
            .find(f => {
              const v = nextStudentScores[f.name];
              return v === null || v === undefined || v === '';
            });
          if (firstBlankField) {
            setActiveStudentId(nextSid);
            activeStudentIdRef.current = nextSid;
            scrollToStudent(nextSid);
            focusInput(nextSid, firstBlankField.name);
          }
        }
      }
      return;
    }

    if (intent === 'previous') {
      if (!sid || !field) return;
      const fieldIndex = current.fields.findIndex(f => f.name === field);
      const editablesBefore = current.fields.slice(0, fieldIndex).filter(f => f.is_editable !== false);
      if (editablesBefore.length > 0) {
        focusInput(sid, editablesBefore[editablesBefore.length - 1].name);
      } else {
        const studentIndex = current.students.findIndex(s => s.student_id === sid);
        if (studentIndex > 0) {
          const prevStudent = current.students[studentIndex - 1];
          const prevSid = prevStudent.student_id;
          const lastEditable = [...current.fields].reverse().find(f => f.is_editable !== false);
          if (lastEditable) {
            setActiveStudentId(prevSid);
            activeStudentIdRef.current = prevSid;
            scrollToStudent(prevSid);
            focusInput(prevSid, lastEditable.name);
          }
        }
      }
      return;
    }

    if (intent === 'save') {
      handleSubmit(false);
      return;
    }

    if (intent === 'save_and_complete') {
      setShowConfirmModal(true);
      showConfirmModalRef.current = true;
      return;
    }
  }, [focusInput, handleScoreChange, handleSubmit, scrollToStudent, showToast]);

  // Keep processIntentRef current
  useEffect(() => {
    processIntentRef.current = processIntent;
  }, [processIntent]);

  // ── Voice recognition: created ONCE, reads from refs ──
  useEffect(() => {
    if (!mounted) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    let destroyed = false;

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech') return;
      if (destroyed) return;        // ← guard
      setVoiceError(e.error);
      setIsListening(false);
    };
    recognition.onend = () => {
      if (destroyed) return;        // ← guard — the stop() in cleanup triggered this
      setIsListening(false);
      if (!voicePausedRef.current) {
        try { recognition.start(); } catch (_) {}
      }
    };

    recognition.onresult = async (event: any) => {
      // Read from refs — these are always current values
      if (voicePausedRef.current) return;
      if (!dataRef.current) return;
      if (voiceBusyRef.current) return;

      const transcript: string = event.results[event.results.length - 1][0].transcript.trim();
      if (!transcript) return;

      const logId = Date.now();
      setVoiceLogs(prev => [{ id: logId, transcript }, ...prev].slice(0, 6));

      voiceBusyRef.current = true;
      try {
        const response = await resultVoiceAPI.interpret({
          transcript,
          context: {
            students: dataRef.current!.students.map(s => ({ id: s.student_id, name: s.student_name })),
            fields: dataRef.current!.fields.map(f => ({ name: f.name, max: f.max_mark, is_editable: f.is_editable !== false })),
            active_student_id: activeStudentIdRef.current,
            active_field: activeFieldRef.current,
          },
        });

        setVoiceLogs(prev =>
          prev.map(log => log.id === logId ? { ...log, intent: response.intent } : log)
        );

        // Call processIntent via ref so we always get the latest version
        processIntentRef.current?.(response);
      } catch (err) {
        console.error('Voice interpret error:', err);
      }finally {
        voiceBusyRef.current = false;
        }
    };

    // Start immediately
    try { recognition.start(); } catch (_) {}

    return () => {
        destroyed = true;
      try { recognition.stop(); } catch (_) {}
    };
  }, [mounted]); // ← empty-ish: only re-run when mounted flips. Never re-run on state changes.

  // ── Toggle voice pause ──
  const toggleVoicePause = () => {
    const next = !voicePaused;
    setVoicePaused(next);
    voicePausedRef.current = next;
    if (next) {
      try { recognitionRef.current?.stop(); } catch (_) {}
    } else {
      setVoiceError(null);
      try { recognitionRef.current?.start(); } catch (_) {}
    }
  };

  // ── Fetch page data ──
  const fetchData = useCallback(async () => {
    if (!classId || !subjectId) {
      setPageError('Missing required parameters.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setPageError(null);
    try {
      const response = await resultUploadAPI.prepare({
        class_config_id: parseInt(classId),
        subject_id: parseInt(subjectId),
        period_id: periodId ? parseInt(periodId) : undefined,
      }) as PrepareData;

      setData(response);
      dataRef.current = response;

      const scoresMap: Record<number, Record<string, number | string | null>> = {};
      response.students.forEach(s => { scoresMap[s.student_id] = { ...s.scores }; });
      setStudentScores(scoresMap);
      studentScoresRef.current = scoresMap;

      // Fetch question paper (ignore 404)
      try {
        const qp = await examScriptAPI.getQuestionPaper({
          class_config_id: parseInt(classId),
          subject_id: parseInt(subjectId),
          academic_period_id: response.period_id,
        });
        if (qp) setQuestionPaper(qp);
      } catch (_) {}
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [classId, subjectId, periodId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUploadQuestionPaper = async (files: File[]) => {
    if (!data) return;
    setUploadingQP(true);
    const fd = new FormData();
    fd.append('class_config_id', data.class_config_id.toString());
    fd.append('subject_id', data.subject_id.toString());
    fd.append('academic_period_id', data.period_id.toString());
    files.forEach(f => fd.append('files', f));
    try {
      const qp = await examScriptAPI.uploadQuestionPaper(fd);
      setQuestionPaper(qp);
      setShowQPUploader(false);
      showToast('success', 'Question paper uploaded.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setUploadingQP(false);
    }
  };

  const openScript = (script: ExamScript) => {
  if (script.file_type === 'pdf') {
    window.open(script.file_data[0], '_blank');
  } else {
    const imgTags = script.file_data
      .map(url => `<img src="${url}" style="max-width:100%;height:auto;display:block;margin:0 auto">`)
      .join('<hr style="border-color:#333;margin:12px 0">');
    const html = `<!DOCTYPE html><html><head><title>Question Paper</title></head>
      <body style="margin:0;padding:12px;background:#1a1a1a;box-sizing:border-box">
        ${imgTags}
      </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
};

  // ── Loading / error screens ──
  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading result upload form…</p>
        </div>
      </div>
    );
  }

  if (pageError || !data) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
          <p className="text-sm text-slate-500">{pageError || 'Unable to load result data.'}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Determine voice status for UI ──
  const voiceStatusColor = !voiceSupported || voiceError
    ? 'bg-red-50 text-red-500 border border-red-200'
    : voicePaused
    ? 'bg-slate-100 text-slate-400'
    : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-200';

  const voiceStatusText = !voiceSupported
    ? 'Voice not supported in this browser.'
    : voiceError
    ? `Mic error: ${voiceError}`
    : voicePaused
    ? 'Paused — click to resume.'
    : isListening
    ? 'Listening…'
    : 'Starting…';

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showConfirmModal && (
        <ConfirmModal
          message="Save all results and leave this page?"
          onConfirm={async () => {
            setShowConfirmModal(false);
            await handleSubmit(true);
          }}
          onCancel={() => {
            setShowConfirmModal(false);
            showConfirmModalRef.current = false;
          }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <FileText className="h-5 w-5 text-white" />
            </div>
            Score Result Upload
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {data.class_name} · {data.subject_name} · {data.period_name} ({data.session_name})
          </p>
        </div>
      </div>

      {/* ── Question Paper Section ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              questionPaper ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
            }`}>
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Exam Question Paper</h3>
              {questionPaper ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                    questionPaper.file_type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>{questionPaper.file_type}</span>
                  <span className="text-xs text-slate-400">{questionPaper.file_data.length} file(s) uploaded</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">No question paper uploaded yet.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {questionPaper && (
              <button
                onClick={() => openScript(questionPaper)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Eye className="h-3.5 w-3.5" /> View
              </button>
            )}
            <button
              onClick={() => setShowQPUploader(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {questionPaper ? 'Replace' : 'Upload Paper'}
            </button>
          </div>
        </div>

        {/* Controlled uploader panel */}
        {showQPUploader && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <FileUploader onUpload={handleUploadQuestionPaper} isUploading={uploadingQP} />
          </div>
        )}
      </div>

      {/* ── Voice Assistant Panel (only after mount to avoid hydration) ── */}
      {mounted && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={voiceSupported ? toggleVoicePause : undefined}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md ${voiceStatusColor} ${voiceSupported ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              title={voicePaused ? 'Resume voice' : 'Pause voice'}
            >
              {voicePaused || !voiceSupported
                ? <MicOff className="h-5 w-5" />
                : <Mic className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                Voice Assistant
                {!voicePaused && isListening && voiceSupported && !voiceError && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">{voiceStatusText}</p>
            </div>
          </div>

          {/* Voice log */}
          <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 min-h-[56px] max-h-[80px] overflow-y-auto">
            {voiceLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Say a student name, "focus Exam", "enter 75", "next", "save"…
              </p>
            ) : (
              <div className="space-y-1">
                {voiceLogs.map((log, i) => (
                  <div key={log.id} className={`text-xs flex items-center justify-between gap-2 ${i === 0 ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    <span className="truncate">"{log.transcript}"</span>
                    {log.intent && (
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                        log.intent === 'unknown' ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {log.intent}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Score Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full min-w-[900px]">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide min-w-[240px] rounded-tl-2xl">
                  Student
                </th>
                {data.fields.map(field => (
                  <th key={field.name} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide whitespace-nowrap">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{field.name.toUpperCase()}</span>
                      <span className="text-blue-200 text-[10px] font-normal">Max: {field.max_mark}</span>
                      {field.is_editable === false && (
                        <span className="text-[9px] bg-white/20 px-1 rounded">locked</span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide rounded-tr-2xl">
                  Sheet
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.students.map((student, idx) => {
                const isActive = activeStudentId === student.student_id;
                return (
                  <tr
                    id={`student-row-${student.student_id}`}
                    key={student.student_id}
                    className={`transition-all duration-200 ${
                      isActive
                        ? 'bg-indigo-50 border-l-4 border-indigo-500'
                        : idx % 2 === 0
                        ? 'bg-white hover:bg-blue-50/30 border-l-4 border-transparent'
                        : 'bg-slate-50/40 hover:bg-blue-50/30 border-l-4 border-transparent'
                    }`}
                  >
                    {/* Student name + reg number */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-6 flex-shrink-0">{idx + 1}.</span>
                        <img
                          src={student.image || '/images/default-avatar.png'}
                          alt={student.student_name}
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                          onError={e => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{student.student_name}</p>
                          <p className="text-[11px] font-mono text-slate-400 truncate">{student.reg_number}</p>
                        </div>
                      </div>
                    </td>

                    {/* Score inputs */}
                    {data.fields.map(field => (
                      <td key={field.name} className="px-3 py-2 text-center">
                        <ScoreInput
                          value={studentScores[student.student_id]?.[field.name] ?? null}
                          maxMark={field.max_mark}
                          fieldName={field.name}
                          studentId={student.student_id}
                          isEditable={field.is_editable !== false}
                          onChange={handleScoreChange}
                          onFocus={handleFieldFocus}
                        />
                      </td>
                    ))}

                    {/* Answer sheet action */}
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => setSelectedStudentForSheet(student)}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Upload / View Answer Sheet"
                      >
                        <FileUp className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {data.students.length} student(s) · {data.fields.filter(f => f.is_editable !== false).length} editable field(s)
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowConfirmModal(true); showConfirmModalRef.current = true; }}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Save & Complete
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-md shadow-emerald-200"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All
            </button>
          </div>
        </div>
      </div>

      {/* ── Answer Sheet Modal ── */}
      {selectedStudentForSheet && (
        <AnswerSheetModal
          student={selectedStudentForSheet}
          data={data}
          onClose={() => setSelectedStudentForSheet(null)}
          showToast={showToast}
        />
      )}

      {/* ── Instructions ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <FileText className="h-4 w-4" /> Instructions
        </h3>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Locked fields (shown grayed) cannot be edited this period</li>
          <li>Empty fields are skipped — no score is recorded for them</li>
          <li>Voice: say a student's name, field name, or a number to enter scores hands-free</li>
          <li>"Save All" stays on this page · "Save & Complete" confirms then navigates away</li>
        </ul>
      </div>
    </div>
  );
}
