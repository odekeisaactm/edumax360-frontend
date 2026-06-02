'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { lessonNotesAPI } from '@/lib/api';
import { LessonNoteDetail, LessonNoteCreate } from '@/lib/types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Save, Send, Brain, X, Check, AlertCircle, Loader2,
  ChevronLeft, Bold, Italic, UnderlineIcon, List,
  ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Heading1, Heading2, Heading3, Quote, Undo, Redo,
  Sparkles, CheckCircle, XCircle, Info, RefreshCw,
  ChevronDown,
} from 'lucide-react';

// ─── Input / Label ─────────────────────────────────────────────────────────────
const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Toolbar Button ────────────────────────────────────────────────────────────
function ToolbarBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded-lg transition-colors ${
        active
          ? 'bg-emerald-100 text-emerald-700'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}

// ─── TipTap Toolbar ────────────────────────────────────────────────────────────
function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-slate-200 bg-slate-50/80">
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
        <Undo className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
        <Redo className="h-4 w-4" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 className="h-4 w-4" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')} title="Bold">
        <Bold className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')} title="Italic">
        <Italic className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')} title="Underline">
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')} title="Bullet List">
        <List className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')} title="Numbered List">
        <ListOrdered className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')} title="Blockquote">
        <Quote className="h-4 w-4" />
      </ToolbarBtn>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })} title="Align Left">
        <AlignLeft className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })} title="Align Center">
        <AlignCenter className="h-4 w-4" />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })} title="Align Right">
        <AlignRight className="h-4 w-4" />
      </ToolbarBtn>
    </div>
  );
}

// ─── AI Review Modal ───────────────────────────────────────────────────────────
interface AIReviewResult {
  overall_score: number;
  feedback: string;
  suggestions: string[];
  checks: Record<string, { score: number; comment: string }>;
  passed: boolean;
  threshold: number;
}

function AIReviewModal({
  result,
  onSaveDraft,
  onKeepEditing,
  isSaving,
}: {
  result: AIReviewResult;
  onSaveDraft: () => void;
  onKeepEditing: () => void;
  isSaving: boolean;
}) {
  const pct = Math.round(result.overall_score * 100);
  const thresholdPct = Math.round(result.threshold * 100);

  const scoreColor = pct >= 80
    ? 'text-emerald-600'
    : pct >= 60
    ? 'text-amber-600'
    : 'text-red-600';

  const scoreBg = pct >= 80
    ? 'from-emerald-50 to-teal-50 border-emerald-200'
    : pct >= 60
    ? 'from-amber-50 to-orange-50 border-amber-200'
    : 'from-red-50 to-rose-50 border-red-200';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 rounded-t-2xl flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Review Results
          </h3>
          <button onClick={onKeepEditing} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Score */}
          <div className={`rounded-2xl border p-5 bg-gradient-to-br ${scoreBg} flex items-center gap-5`}>
            <div className="relative w-20 h-20 flex-shrink-0">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9155" fill="none"
                  stroke={pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="3"
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-black ${scoreColor}`}>{pct}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">Overall Score</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Auto-approve threshold: <strong>{thresholdPct}%</strong>
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                {result.passed
                  ? <><CheckCircle className="h-4 w-4 text-emerald-600" /><span className="text-xs font-semibold text-emerald-600">Meets approval threshold</span></>
                  : <><XCircle className="h-4 w-4 text-amber-600" /><span className="text-xs font-semibold text-amber-600">Below approval threshold</span></>
                }
              </div>
            </div>
          </div>

          {/* Checks */}
          {Object.keys(result.checks).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Detailed Checks</p>
              <div className="space-y-2">
                {Object.entries(result.checks).map(([key, check]) => {
                  const checkPct = Math.round((check.score ?? 0) * 100);
                  const checkColor = checkPct >= 80 ? 'bg-emerald-500' : checkPct >= 60 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={key} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-slate-700 capitalize">
                          {key.replace(/_/g, ' ')}
                        </p>
                        <span className="text-xs font-bold text-slate-600">{checkPct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mb-1.5">
                        <div className={`h-1.5 rounded-full ${checkColor}`} style={{ width: `${checkPct}%` }} />
                      </div>
                      {check.comment && (
                        <p className="text-xs text-slate-500">{check.comment}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feedback */}
          {result.feedback && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Feedback</p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed">
                {result.feedback}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Suggestions ({result.suggestions.length})
              </p>
              <ul className="space-y-2">
                {result.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button onClick={onKeepEditing} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Keep Editing
          </button>
          <button onClick={onSaveDraft} disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="h-4 w-4" /> Save as Draft</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
interface PageProps {
  params?: { id?: string };
}

export default function LessonNoteFormPage({ params }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isEdit = !!params?.id;
  const noteId = params?.id ? parseInt(params.id) : null;

  // Form state
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [learningObjectives, setLearningObjectives] = useState('');
  const [subject, setSubject] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [creationMethod, setCreationMethod] = useState<'manual' | 'ai_generated' | 'uploaded'>('manual');
  const [session, setSession] = useState('');
  const [term, setTerm] = useState('');
  const [schoolSection, setSchoolSection] = useState('');
  const [classConfigIds, setClassConfigIds] = useState<number[]>([]);

  // UI state
  const [loading, setLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<AIReviewResult | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitAfterSave, setSubmitAfterSave] = useState(false);

  // Editor
  const editor = useEditor({
      immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing your lesson note here...' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-6 py-5 text-slate-800',
      },
    },
  });

  // Load existing note for edit
  useEffect(() => {
    if (!isEdit || !noteId) return;
    lessonNotesAPI.get(noteId).then(note => {
      setTitle(note.title);
      setTopic(note.topic ?? '');
      setLearningObjectives(note.learning_objectives ?? '');
      setSubject(String(note.subject_id ?? ''));
      setScheduledDate(note.scheduled_date ?? '');
      setScheduledTime(note.scheduled_time ?? '');
      setCreationMethod(note.creation_method);
      setSession(String(note.session ?? ''));
      setTerm(String(note.term ?? ''));
      setSchoolSection(String(note.school_section ?? ''));
      setClassConfigIds(note.class_configurations_detail.map(c => c.id));
      editor?.commands.setContent(note.content ?? '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [isEdit, noteId, editor]);

  const getContent = () => editor?.getHTML() ?? '';

  // ── AI Review ──
  const handleAIReview = async () => {
    const content = getContent();
    if (!content || content === '<p></p>') {
      setSaveError('Write some content before requesting an AI review.');
      return;
    }
    setIsReviewing(true);
    setSaveError(null);
    try {
      const res = await lessonNotesAPI.previewReview({
        content,
        school_section: schoolSection ? Number(schoolSection) : null,
      });
      if (res.success && res.data) {
        setReviewResult(res.data);
        setShowReviewModal(true);
      } else {
        setSaveError(res.message ?? 'AI review failed.');
      }
    } catch (err: any) {
      const data = err?.response?.data;
      setSaveError(data?.message || data?.error || 'AI review failed. Please try again.');
    } finally {
      setIsReviewing(false);
    }
  };

  // ── Save ──
  const buildPayload = (): LessonNoteCreate => ({
    title,
    content: getContent(),
    creation_method: creationMethod,
    subject: Number(subject),
    class_configuration_ids: classConfigIds,
    topic: topic || undefined,
    learning_objectives: learningObjectives || undefined,
    scheduled_date: scheduledDate || undefined,
    scheduled_time: scheduledTime || undefined,
    session: Number(session),
    term: Number(term),
    school_section: schoolSection ? Number(schoolSection) : null,
  });

  const handleSave = async (andSubmit = false) => {
    setSaveError(null);
    if (!title.trim()) { setSaveError('Title is required.'); return; }
    if (!subject) { setSaveError('Please select a subject.'); return; }
    if (!session || !term) { setSaveError('Session and term are required.'); return; }
    if (!getContent() || getContent() === '<p></p>') { setSaveError('Note content cannot be empty.'); return; }

    setIsSaving(true);
    try {
      let saved;
      if (isEdit && noteId) {
        saved = await lessonNotesAPI.update(noteId, buildPayload());
      } else {
        saved = await lessonNotesAPI.create(buildPayload());
      }
      if (andSubmit) {
        await lessonNotesAPI.submit(saved.id);
      }
      router.push(`/dashboard/staff/learning/notes/${saved.id}`);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === 'object' && !data.message) {
        const msgs = Object.entries(data)
          .map(([f, m]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(m) ? m.join(', ') : m}`)
          .join('\n');
        setSaveError(msgs);
      } else {
        setSaveError(data?.message || 'Failed to save note.');
      }
    } finally {
      setIsSaving(false);
      setShowReviewModal(false);
    }
  };

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
    </div>
  );

  return (
    <div className="space-y-6 pb-10">

      {showReviewModal && reviewResult && (
        <AIReviewModal
          result={reviewResult}
          onSaveDraft={() => handleSave(false)}
          onKeepEditing={() => setShowReviewModal(false)}
          isSaving={isSaving}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {isEdit ? 'Edit Lesson Note' : 'Create Lesson Note'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEdit ? 'Update your note and resubmit for approval' : 'Write, review, then submit for approval'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAIReview}
            disabled={isReviewing || isSaving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-md shadow-violet-200">
            {isReviewing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Reviewing...</>
              : <><Brain className="h-4 w-4" /> AI Review</>}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSaving || isReviewing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Save className="h-4 w-4" /> Save Draft</>}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={isSaving || isReviewing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-md shadow-emerald-200">
            <Send className="h-4 w-4" /> Save & Submit
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 whitespace-pre-line flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Editor ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Title */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <label className={labelCls}>Note Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Photosynthesis"
              className={inputCls}
            />
          </div>

          {/* Rich text editor */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Note Content *</p>
              <div className="flex items-center gap-2">
                <select
                  value={creationMethod}
                  onChange={e => setCreationMethod(e.target.value as any)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500">
                  <option value="manual">Manual</option>
                  <option value="ai_generated">AI Generated</option>
                  <option value="uploaded">Uploaded</option>
                </select>
              </div>
            </div>
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>

        </div>

        {/* ── Right: Metadata ── */}
        <div className="space-y-4">

          {/* Subject & class */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignment</p>
            <div>
              <label className={labelCls}>Subject *</label>
              <input type="number" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="Subject ID" className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Enter subject ID (dropdown coming soon)</p>
            </div>
            <div>
              <label className={labelCls}>Class Configuration IDs</label>
              <input
                type="text"
                value={classConfigIds.join(', ')}
                onChange={e => {
                  const ids = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                  setClassConfigIds(ids);
                }}
                placeholder="e.g. 1, 2, 3"
                className={inputCls}
              />
              <p className="text-xs text-slate-400 mt-1">Comma-separated class config IDs</p>
            </div>
          </div>

          {/* Curriculum */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Curriculum</p>
            <div>
              <label className={labelCls}>Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="Curriculum topic covered" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Learning Objectives</label>
              <textarea value={learningObjectives} onChange={e => setLearningObjectives(e.target.value)}
                rows={3} placeholder="What students should learn from this lesson..."
                className={inputCls + ' resize-none'} />
            </div>
          </div>

          {/* Scheduling */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scheduling</p>
            <div>
              <label className={labelCls}>Scheduled Date</label>
              <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Scheduled Time</label>
              <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                className={inputCls} />
            </div>
          </div>

          {/* Session & Term */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Session & Term</p>
            <div>
              <label className={labelCls}>Session ID *</label>
              <input type="number" value={session} onChange={e => setSession(e.target.value)}
                placeholder="Session ID" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Term ID *</label>
              <input type="number" value={term} onChange={e => setTerm(e.target.value)}
                placeholder="Term ID" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>School Section ID</label>
              <input type="number" value={schoolSection} onChange={e => setSchoolSection(e.target.value)}
                placeholder="Optional" className={inputCls} />
            </div>
          </div>

          {/* Info box */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-1">
              <p className="font-semibold">How it works</p>
              <p>Save as draft first, then use <strong>AI Review</strong> for feedback before submitting. Once submitted, AI vetting runs automatically.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}