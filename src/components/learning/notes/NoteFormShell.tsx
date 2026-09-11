'use client';

import React, {
  useState, useEffect, useCallback, useRef, useMemo,
} from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  lessonNotesAPI, academicAPI, academicCalendarAPI,
  aiAccessAPI, schemeWeeksAPI,
} from '@/lib/api';
import NoteEditor from './NoteEditor';
import NoteAIPanel from './NoteAIPanel';
import NoteUploadZone, { ExtractionResult } from './NoteUploadZone';
import {
  Save, Send, X, Check, AlertCircle, Loader2, ChevronLeft,
  FileText, Sparkles, PenLine, Upload as UploadIcon,
  Paperclip, Trash2, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';

type Mode = 'write' | 'upload' | 'ai';
type ToastType = 'success' | 'error' | 'warn';
interface Toast { id: number; type: ToastType; message: string; }

interface Meta {
  title: string;
  topic: string;
  learning_objectives: string;
  instructional_materials: string;
  subject_id: string;
  class_name: string;
  class_config_ids: number[];
  scheduled_date: string;
  scheduled_time: string;
  scheme_week_id: number | null;
  grant_student_access: boolean;
}

interface SchemeWeekOption {
  id: number;
  week_number: number;
  topic: string;
  scheme_title?: string;
  week_start_date?: string;
}

interface ExistingAttachment {
  name: string;
  url: string;
}

const EMPTY_META: Meta = {
  title: '', topic: '', learning_objectives: '', instructional_materials: '',
  subject_id: '', class_name: '', class_config_ids: [],
  scheduled_date: '', scheduled_time: '', scheme_week_id: null,
  grant_student_access: false,
};

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1";

let _tid = 0;

function basename(path: string): string {
  try {
    const clean = path.split('?')[0];
    return decodeURIComponent(clean.substring(clean.lastIndexOf('/') + 1)) || 'attachment';
  } catch {
    return 'attachment';
  }
}

export default function NoteFormShell({
  mode: pageMode, initialNote, noteId,
}: { mode: 'create' | 'edit'; initialNote?: any; noteId?: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = pageMode === 'edit';

  const [chosenMode, setChosenMode] = useState<Mode | null>(isEdit ? 'write' : null);
  const [mode, setMode] = useState<Mode>('write');

  const [meta, setMeta] = useState<Meta>(EMPTY_META);
  const [titleManual, setTitleManual] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [showEditor, setShowEditor] = useState(true);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<ExistingAttachment | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Declined-note banner state (edit mode only)
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const [declinedAt, setDeclinedAt] = useState<string | null>(null);
  const [noteStatus, setNoteStatus] = useState<string | null>(null);
  const [isAutoApproved, setIsAutoApproved] = useState(false);

  // Current scheme-week link, kept separately so it survives subject/class refetch
  const [initialSchemeWeek, setInitialSchemeWeek] = useState<SchemeWeekOption | null>(null);

  const [scope, setScope] = useState<any[]>([]);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [currentTerm, setCurrentTerm] = useState<any>(null);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [schemeWeeks, setSchemeWeeks] = useState<SchemeWeekOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = (type: ToastType, message: string) => {
    const id = ++_tid;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  };

  useEffect(() => {
    (async () => {
      try {
        const [cs, ct, scopeRes, , aiAccess] = await Promise.all([
          academicCalendarAPI.getCurrentSession().catch(() => null),
          academicCalendarAPI.getCurrentPeriod().catch(() => null),
          academicAPI.getMyTeachingScope().catch(() => ({ scope: [] })),
          Promise.resolve(null),
          aiAccessAPI.check('learning').catch(() => ({ enabled: false })),
        ]);
        setCurrentSession(cs);
        setCurrentTerm(ct);
        setScope(scopeRes?.scope || []);
        setIsAIEnabled(!!(aiAccess as any)?.enabled);

        if (isEdit && initialNote) {
          setMeta({
            title: initialNote.title || '',
            topic: initialNote.topic || '',
            learning_objectives: initialNote.learning_objectives || '',
            instructional_materials: initialNote.instructional_materials || '',
            subject_id: String(initialNote.subject_id ?? initialNote.subject?.id ?? ''),
            class_name: '',
            class_config_ids: (initialNote.class_configurations_detail || []).map((c: any) => c.id),
            scheduled_date: initialNote.scheduled_date || '',
            scheduled_time: initialNote.scheduled_time || '',
            scheme_week_id: initialNote.current_scheme_week_id ?? null,
            grant_student_access: !!initialNote.grant_student_access,
          });
          setTitleManual(initialNote.title || null);
          setHtmlContent(initialNote.content || '');
          setMode('write'); setChosenMode('write');

          setDeclineReason(initialNote.decline_reason || null);
          setDeclinedAt(initialNote.declined_at || null);
          setNoteStatus(initialNote.status || null);
          setIsAutoApproved(
            initialNote.status === 'approved' && !initialNote.approved_by
          );

          if (initialNote.attachment) {
            setExistingAttachment({
              name: basename(initialNote.attachment),
              url: initialNote.attachment,
            });
          }

          if (initialNote.current_scheme_week) {
            setInitialSchemeWeek({
              id: initialNote.current_scheme_week.id,
              week_number: initialNote.current_scheme_week.week_number,
              topic: initialNote.current_scheme_week.topic,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isEdit, initialNote]);

  useEffect(() => {
    if (!isEdit || !scope.length || meta.class_name) return;
    if (meta.class_config_ids.length === 0) return;
    for (const item of scope) {
      if (meta.class_config_ids.includes(item.class_config_id)) {
        setMeta(p => ({ ...p, class_name: item.class_name }));
        break;
      }
    }
  }, [scope, isEdit, meta.class_config_ids, meta.class_name]);

  const classNames = useMemo(() => Array.from(new Set(scope.map(s => s.class_name))).sort(), [scope]);
  const sectionsForClass = useMemo(
    () => scope.filter(s => s.class_name === meta.class_name),
    [scope, meta.class_name]
  );
  const availableSubjects = useMemo(() => {
    if (meta.class_config_ids.length === 0) return [];
    const map = new Map<number, { id: number; name: string; code: string }>();
    sectionsForClass
      .filter(s => meta.class_config_ids.includes(s.class_config_id))
      .forEach(s => s.subjects.forEach(sub => map.set(sub.id, sub)));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sectionsForClass, meta.class_config_ids]);

  const sessionLabel = currentSession
    ? (currentSession.name || `${currentSession.start_year}/${currentSession.end_year}`) : '';
  const termLabel = currentTerm ? (currentTerm.period?.name || currentTerm.name || '') : '';
  const selectedSubjectName = useMemo(() => {
    for (const item of scope) {
      if (!meta.class_config_ids.includes(item.class_config_id)) continue;
      const s = item.subjects.find((x: any) => String(x.id) === meta.subject_id);
      if (s) return s.name;
    }
    return '';
  }, [scope, meta.class_config_ids, meta.subject_id]);

  useEffect(() => {
    if (isEdit || titleManual !== null) return;
    if (!meta.class_name || !selectedSubjectName || !sessionLabel || !termLabel) {
      setMeta(p => (p.title === '' ? p : { ...p, title: '' }));
      return;
    }
    const auto = `${sessionLabel} - ${termLabel} ${selectedSubjectName} for ${meta.class_name}`;
    setMeta(p => (p.title === auto ? p : { ...p, title: auto }));
  }, [isEdit, titleManual, meta.class_name, selectedSubjectName, sessionLabel, termLabel]);

  useEffect(() => {
    if (!meta.subject_id || !meta.class_config_ids.length || !currentSession || !currentTerm) {
      setSchemeWeeks([]); return;
    }
    let cancelled = false;
    (async () => {
      try {
        const weeks = await schemeWeeksAPI.availableForNote({
          subject: Number(meta.subject_id),
          session: currentSession.id,
          term: currentTerm.id,
          class_config: meta.class_config_ids[0],
        });
        if (!cancelled) setSchemeWeeks(weeks || []);
      } catch { if (!cancelled) setSchemeWeeks([]); }
    })();
    return () => { cancelled = true; };
  }, [meta.subject_id, meta.class_config_ids, currentSession, currentTerm]);

  // Merge the note's currently-linked week into the dropdown options so it
  // doesn't silently fall back to "Not linked" (which would drop the link).
  const schemeWeekOptions = useMemo<SchemeWeekOption[]>(() => {
    if (!initialSchemeWeek) return schemeWeeks;
    if (schemeWeeks.some(w => w.id === initialSchemeWeek.id)) return schemeWeeks;
    return [initialSchemeWeek, ...schemeWeeks];
  }, [schemeWeeks, initialSchemeWeek]);

  const setMetaField = <K extends keyof Meta>(k: K, v: Meta[K]) => {
    if (k === 'title') {
      if (v === '') setTitleManual(null);
      else setTitleManual(v as string);
    }
    setMeta(p => ({ ...p, [k]: v }));
  };

  const handleClassChange = (className: string) => {
    const ids = scope.filter(s => s.class_name === className).map(s => s.class_config_id);
    setMeta(p => ({ ...p, class_name: className, class_config_ids: ids, subject_id: '', scheme_week_id: null }));
    setInitialSchemeWeek(null);
  };

  const toggleSection = (configId: number) => {
    const next = meta.class_config_ids.includes(configId)
      ? meta.class_config_ids.filter(id => id !== configId)
      : [...meta.class_config_ids, configId];
    setMeta(p => ({ ...p, class_config_ids: next, scheme_week_id: null }));
    setInitialSchemeWeek(null);
  };

  const handleSubjectChange = (value: string) => {
    setMeta(p => ({ ...p, subject_id: value, scheme_week_id: null }));
    setInitialSchemeWeek(null);
  };

  const chooseMode = (next: Mode) => {
    if (next === 'ai' && !isAIEnabled) return;
    setChosenMode(next);
    setMode(next);
    setShowEditor(next !== 'upload');
  };

  const handleExtract = useCallback(async (file: File): Promise<ExtractionResult> => {
    const res = await lessonNotesAPI.extractFile(file);
    if (!res?.data) throw new Error('Extraction returned no data.');
    return res.data;
  }, []);

  const insertExtraction = (html: string) => {
    setHtmlContent(html); setShowEditor(true);
    showToast('warn', 'Auto-extracted — check formatting before submitting.');
  };

  const handleAIGenerate = async (instruction: string) => {
    if (!meta.topic) throw new Error('Add a topic before generating.');
    let buffer = '';
    const mod = await import('@/lib/getApiUrl');
    const res = await fetch(`${mod.getApiUrl()}/api/learning/notes/ai-generate/`, {
      method: 'POST', credentials: 'include', headers: mod.getAuthHeaders(),
      body: JSON.stringify({
        topic: meta.topic,
        learning_objectives: meta.learning_objectives,
        instruction,
        subject_id: meta.subject_id ? Number(meta.subject_id) : undefined,
        class_config_ids: meta.class_config_ids,
      }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || 'AI generation failed.');
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;
        try {
          const p = JSON.parse(raw);
          if (p.error) throw new Error(p.error);
          if (p.text) { buffer += p.text; setHtmlContent(buffer); setShowEditor(true); }
        } catch { /* ignore */ }
      }
    }
    if (!buffer.trim()) throw new Error('AI returned no content.');
  };

  const validate = (): string | null => {
    if (!meta.class_name) return 'Class is required.';
    if (meta.class_config_ids.length === 0) return 'Select at least one section.';
    if (!meta.subject_id) return 'Subject is required.';
    if (!meta.title.trim()) return 'Title is required.';
    if (!currentSession || !currentTerm) return 'No active academic period.';
    const hasContent = htmlContent.replace(/<[^>]*>/g, '').trim().length > 0;
    const hasAttachment =
      !!attachment ||
      (!!existingAttachment && !removeAttachment);
    if (!hasContent && !hasAttachment) return 'Add content or attach a file.';
    return null;
  };

  const handleSave = async (andSubmit = false, silent = false) => {
    if (!silent) setSaveError(null);
    const err = validate();
    if (err) { if (!silent) setSaveError(err); return; }
    if (silent && !isEdit) return;

    setIsSaving(true);
    try {
      const payload: any = {
        title: meta.title,
        content: htmlContent || '',
        creation_method: mode === 'ai' ? 'ai_generated' : mode === 'upload' ? 'uploaded' : 'manual',
        subject_id: Number(meta.subject_id),
        class_configuration_ids: meta.class_config_ids,
        session: currentSession.id,
        term: currentTerm.id,
        topic: meta.topic || undefined,
        learning_objectives: meta.learning_objectives || undefined,
        instructional_materials: meta.instructional_materials || undefined,
        scheduled_date: meta.scheduled_date || undefined,
        scheduled_time: meta.scheduled_time || undefined,
        scheme_week_id: meta.scheme_week_id ?? null,
        grant_student_access: meta.grant_student_access,
      };
      if (attachment) payload.attachment = attachment;
      if (isEdit && removeAttachment && !attachment) {
        payload.remove_attachment = true;
      }

      const saved = isEdit && noteId
        ? await lessonNotesAPI.update(noteId, payload)
        : await lessonNotesAPI.create(payload);

      if (andSubmit && saved?.id) await lessonNotesAPI.submit(saved.id);
      setLastSavedAt(new Date());

      if (!silent) {
        showToast('success', andSubmit ? 'Note submitted.' : 'Draft saved.');
        router.push(`/dashboard/staff/learning/notes/${saved.id}`);
      }
    } catch (e: any) {
      const data = e?.response?.data;
      let msg = 'Failed to save note.';
      if (data && typeof data === 'object') {
        if (typeof data === 'string') msg = data;
        else if (data.message) msg = data.message;
        else {
          msg = Object.entries(data)
            .map(([k, v]: [string, any]) =>
              `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join('\n');
        }
      }
      if (!silent) setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isEdit || !noteId) return;
    autosaveRef.current = setInterval(() => { if (!isSaving) handleSave(false, true); }, 30000);
    return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, noteId, isSaving, htmlContent, meta, attachment, removeAttachment]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); handleSave(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlContent, meta, mode, attachment, removeAttachment]);

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (scope.length === 0 && !isEdit) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center bg-white rounded-2xl border border-slate-100 shadow-sm p-10">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileText className="h-8 w-8 text-slate-300" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">No teaching assignments</h2>
        <p className="text-sm text-slate-500">You aren't assigned to teach any subject in any class.</p>
        <button onClick={() => router.back()} className="mt-5 text-sm text-blue-600 font-medium hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-32">
      <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
            ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-red-50 border-red-200 text-red-900'}`}>
            {t.type === 'success' ? <Check className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              : <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${t.type === 'warn' ? 'text-amber-500' : 'text-red-500'}`} />}
            <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
            <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            {isEdit ? 'Edit Lesson Note' : 'Create Lesson Note'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {sessionLabel}{sessionLabel && termLabel && ' · '}{termLabel}
            {isEdit && lastSavedAt && <span className="ml-3 text-xs text-slate-400">Saved {lastSavedAt.toLocaleTimeString()}</span>}
          </p>
        </div>
      </div>

      {/* Auto-approved notice — edits apply immediately, no review */}
      {isEdit && isAutoApproved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">Auto-approved note</p>
            <p className="text-xs text-emerald-800 mt-0.5">
              This note was approved without manual review. Edits apply immediately and stay visible to students (if access is on).
            </p>
          </div>
        </div>
      )}

      {/* Previously-declined banner — visible while revising */}
      {isEdit && declineReason && (noteStatus === 'draft' || noteStatus === 'declined') && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-orange-900">
              Previously declined{declinedAt && ` — ${new Date(declinedAt).toLocaleDateString()}`}
            </p>
            <p className="text-sm text-orange-800 mt-1 whitespace-pre-line">{declineReason}</p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium whitespace-pre-line flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {!isEdit && chosenMode === null && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <h2 className="text-base font-semibold text-slate-800 mb-1">How would you like to start?</h2>
          <p className="text-sm text-slate-500 mb-6">Pick a starting point. You can attach files in any mode.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button onClick={() => chooseMode('write')}
              className="group text-left p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <PenLine className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Write from Scratch</p>
              <p className="text-xs text-slate-500 mt-1">Open the editor and compose the note yourself.</p>
            </button>
            <button onClick={() => chooseMode('upload')}
              className="group text-left p-5 rounded-2xl border border-slate-200 hover:border-sky-400 hover:bg-sky-50/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <UploadIcon className="h-5 w-5 text-sky-600" />
              </div>
              <p className="text-sm font-semibold text-slate-800">Upload Document</p>
              <p className="text-xs text-slate-500 mt-1">Attach a Word, PDF, or Excel file. Optionally extract its text.</p>
            </button>
            {isAIEnabled && (
              <button onClick={() => chooseMode('ai')}
                className="group text-left p-5 rounded-2xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/40 transition-all">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">Generate with AI</p>
                <p className="text-xs text-slate-500 mt-1">Let AI produce a first draft you can edit.</p>
              </button>
            )}
          </div>
        </div>
      )}

      {chosenMode !== null && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Assignment</p>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-3">
                <label className={labelCls}>Class <span className="text-red-400 normal-case">*</span></label>
                <select value={meta.class_name} onChange={e => handleClassChange(e.target.value)} className={inputCls}>
                  <option value="">Select Class</option>
                  {classNames.map(cn => <option key={cn} value={cn}>{cn}</option>)}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className={labelCls}>Subject <span className="text-red-400 normal-case">*</span></label>
                <select value={meta.subject_id}
                  onChange={e => handleSubjectChange(e.target.value)}
                  disabled={!meta.class_name || availableSubjects.length === 0}
                  className={inputCls}>
                  <option value="">
                    {!meta.class_name ? 'Select class first'
                      : availableSubjects.length === 0 ? 'No subjects'
                      : 'Select Subject'}
                  </option>
                  {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-6">
                <label className={labelCls}>
                  Title <span className="text-red-400 normal-case">*</span>
                  {!isEdit && titleManual === null && meta.title && (
                    <span className="ml-2 text-[10px] font-normal text-emerald-500 normal-case">auto</span>
                  )}
                </label>
                <input type="text" value={meta.title}
                  onChange={e => setMetaField('title', e.target.value)}
                  placeholder="Type a title or leave for auto-fill"
                  className={inputCls} />
              </div>
            </div>

            {meta.class_name && sectionsForClass.length > 0 && (
              <div className="mt-3">
                <label className={labelCls}>Sections <span className="text-red-400 normal-case">*</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {sectionsForClass.map(sec => {
                    const checked = meta.class_config_ids.includes(sec.class_config_id);
                    return (
                      <button key={sec.class_config_id} type="button" onClick={() => toggleSection(sec.class_config_id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                          checked ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                        }`}>
                        {sec.section_name || 'Main'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button onClick={() => setDetailsOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Details</p>
                <span className="text-[10px] text-slate-400 normal-case">topic, objectives, materials, scheduling, student access</span>
              </div>
              {detailsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
            {detailsOpen && (
              <div className="px-5 pb-5 pt-2 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Topic</label>
                    <input type="text" value={meta.topic}
                      onChange={e => setMetaField('topic', e.target.value)}
                      placeholder="Curriculum topic" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Scheduled Date</label>
                    <input type="date" value={meta.scheduled_date}
                      onChange={e => setMetaField('scheduled_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Learning Objectives</label>
                  <textarea value={meta.learning_objectives}
                    onChange={e => setMetaField('learning_objectives', e.target.value)}
                    rows={2} placeholder="What students should learn..."
                    className={inputCls + ' resize-none'} />
                </div>
                <div>
                  <label className={labelCls}>Instructional Materials</label>
                  <textarea value={meta.instructional_materials}
                    onChange={e => setMetaField('instructional_materials', e.target.value)}
                    rows={2} placeholder="Tools needed (chart, calculator, etc.)"
                    className={inputCls + ' resize-none'} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Scheduled Time</label>
                    <input type="time" value={meta.scheduled_time}
                      onChange={e => setMetaField('scheduled_time', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Student Access</label>
                    <button
                      type="button"
                      onClick={() => setMetaField('grant_student_access', !meta.grant_student_access)}
                      className={`w-full h-[38px] flex items-center justify-between gap-3 px-3 rounded-lg border transition-colors ${
                        meta.grant_student_access
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}>
                      <span className={`text-sm font-medium truncate ${
                        meta.grant_student_access ? 'text-emerald-800' : 'text-slate-600'
                      }`}>
                        {meta.grant_student_access ? 'Visible to students' :'Not visible to students'}
                      </span>
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                          meta.grant_student_access ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          meta.grant_student_access ? 'translate-x-4' : 'translate-x-0.5'
                        }`} />
                      </span>
                    </button>
                  </div>
                </div>

                {schemeWeekOptions.length > 0 && (
                  <div>
                    <label className={labelCls}>Link to Scheme Week</label>
                    <select value={meta.scheme_week_id ?? ''}
                      onChange={e => setMetaField('scheme_week_id', e.target.value ? Number(e.target.value) : null)}
                      className={inputCls}>
                      <option value="">— Not linked —</option>
                      {schemeWeekOptions.map(w => (
                        <option key={w.id} value={w.id}>Week {w.week_number} · {w.topic}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {mode === 'ai' && isAIEnabled && (
            <NoteAIPanel
              disabled={!meta.class_name || !meta.subject_id || !meta.topic}
              disabledReason="Fill class, subject, and topic to enable generation."
              onGenerate={handleAIGenerate}
            />
          )}

          {mode === 'upload' && !isEdit && (
            <NoteUploadZone
              file={attachment}
              onFileChange={setAttachment}
              onExtract={handleExtract}
              onInsertExtraction={insertExtraction}
              editorActive={showEditor}
            />
          )}

          {mode !== 'upload' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              {attachment ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Paperclip className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{attachment.name}</p>
                    <p className="text-xs text-slate-500">{(attachment.size / 1024).toFixed(0)} KB · New file</p>
                  </div>
                  <button onClick={() => setAttachment(null)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : existingAttachment && !removeAttachment ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
                    <Paperclip className="h-4 w-4 text-sky-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{existingAttachment.name}</p>
                    <p className="text-xs text-slate-500">Attached</p>
                  </div>
                  <a href={existingAttachment.url} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                    title="Open attachment">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <label className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer" title="Replace attachment">
                    <Paperclip className="h-4 w-4" />
                    <input type="file" className="sr-only"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setAttachment(f); e.currentTarget.value = ''; }} />
                  </label>
                  <button onClick={() => setRemoveAttachment(true)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove attachment">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="file" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setAttachment(f); setRemoveAttachment(false); } e.currentTarget.value = ''; }} />
                  <div className="w-9 h-9 rounded-lg bg-slate-50 group-hover:bg-emerald-50 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Paperclip className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
                      {removeAttachment ? 'Removed — attach a new file' : 'Attach a supporting file'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {removeAttachment ? 'The original attachment will be deleted on save.' : 'Optional · PDF, Word, Excel, or any document'}
                    </p>
                  </div>
                </label>
              )}
            </div>
          )}

          {showEditor && (
            <NoteEditor
              content={htmlContent}
              onChange={setHtmlContent}
              isAIEnabled={isAIEnabled}
              subjectId={meta.subject_id}
              classConfigIds={meta.class_config_ids}
            />
          )}
        </>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 hidden sm:block">
            {isEdit ? 'Editing'
              : chosenMode === null ? 'Choose a starting point'
              : mode === 'write' ? 'Writing from scratch'
              : mode === 'upload' ? 'Uploading document'
              : 'AI-assisted draft'}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => handleSave(false)} disabled={isSaving || chosenMode === null}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
            </button>
            {!isAutoApproved && (
              <button onClick={() => handleSave(true)} disabled={isSaving || chosenMode === null}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md disabled:opacity-50">
                <Send className="h-4 w-4" /> Save & Submit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}