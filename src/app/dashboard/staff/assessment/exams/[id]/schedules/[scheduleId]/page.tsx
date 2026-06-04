'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  examSchedulesAPI, questionsAPI, questionBanksAPI, examinationHallsAPI, staffAPI
} from '@/lib/api';
import {
  ExamScheduleDetail, Question, QuestionBank, ExaminationHall,
} from '@/lib/types';
import {
  ArrowLeft, AlertCircle, X, Check, Loader2, Save,
  BookOpen, Settings, Sparkles, Upload, Plus, Target,
  CheckCircle2, XCircle, Info, Shield, ListChecks, FileQuestion,
  RefreshCw, Search, Eye, BrainCircuit, ChevronRight, ChevronDown, Clock,
  Users, UserCheck, UserMinus,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedQuestion extends Question {
  _order: number;
  custom_mark?: number | null;
  section_id?: number | null;
}

// ─── Style constants ─────────────────────────────────────────────────────────

const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-700 bg-white disabled:bg-slate-50 disabled:text-slate-400';

const QTYPE_COLORS: Record<string, string> = {
  objective:     'bg-blue-50 text-blue-700 border-blue-200',
  theory:        'bg-purple-50 text-purple-700 border-purple-200',
  subjective:    'bg-orange-50 text-orange-700 border-orange-200',
  fill_in_blank: 'bg-teal-50 text-teal-700 border-teal-200',
  true_false:    'bg-pink-50 text-pink-700 border-pink-200',
};

const DIFF_COLORS: Record<string, string> = {
  easy:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  hard:   'bg-red-50 text-red-700 border-red-200',
};

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
    if (entries.length)
      return entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
  }
  return err.message || 'An error occurred';
}

function renumber(qs: SelectedQuestion[]): SelectedQuestion[] {
  return qs.map((q, i) => ({ ...q, _order: i + 1 }));
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto max-w-sm animate-in slide-in-from-right-4 fade-in
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />}
          <span className="text-sm font-medium whitespace-pre-line flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100 shrink-0">
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
  const show = useCallback((type: Toast['type'], message: string) => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);
  return {
    toasts,
    showToast: show,
    removeToast: (id: number) => setToasts(p => p.filter(t => t.id !== id)),
  };
}

// ─── Error Modal (for important errors) ──────────────────────────────────────

function ErrorModal({ open, title, message, onClose }: {
  open: boolean; title: string; message: string; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 fade-in">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-base font-bold text-slate-900 text-center mb-2">{title}</h3>
          <p className="text-sm text-slate-500 text-center leading-relaxed whitespace-pre-line">{message}</p>
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invigilator Modal ────────────────────────────────────────────────────────

function InvigilatorModal({ open, assignedIds, staffList, isSaving, onSave, onClose }: {
  open: boolean;
  assignedIds: number[];
  staffList: any[];
  isSaving: boolean;
  onSave: (ids: number[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>(assignedIds);

  useEffect(() => { setSelectedIds(assignedIds); }, [assignedIds, open]);

  if (!open) return null;

  const filtered = staffList.filter(s =>
    (s.full_name || `${s.first_name} ${s.last_name}`)
      .toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedStaff = staffList.filter(s => selectedIds.includes(s.id));

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>

        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="h-4 w-4" /> Assign Invigilators
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Results */}
          {filtered.length > 0 ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {filtered.map(staff => {
                const name = staff.full_name || `${staff.first_name} ${staff.last_name}`;
                const isChecked = selectedIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggle(staff.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      isChecked
                        ? 'bg-violet-50 border-violet-200'
                        : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isChecked ? 'bg-violet-600' : 'bg-slate-100'
                    }`}>
                      {isChecked
                        ? <Check className="h-3.5 w-3.5 text-white" />
                        : <UserCheck className="h-3.5 w-3.5 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isChecked ? 'text-violet-900' : 'text-slate-700'}`}>
                        {name}
                      </p>
                      {staff.staff_id && (
                        <p className="text-xs text-slate-400">{staff.staff_id}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No staff found</p>
          )}

          {/* Selected chips */}
          {selectedStaff.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Selected ({selectedStaff.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedStaff.map(s => (
                  <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 rounded-lg border border-violet-100">
                    <span className="text-sm text-violet-700 font-medium">
                      {s.full_name || `${s.first_name} ${s.last_name}`}
                    </span>
                    <button onClick={() => toggle(s.id)} className="text-violet-400 hover:text-violet-600 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={() => onSave(selectedIds)} disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-violet-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" /> Confirm</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Question Preview Modal ───────────────────────────────────────────────────

function QuestionPreviewModal({ open, question, onClose }: {
  open: boolean;
  question: Question | null;
  onClose: () => void;
}) {
  if (!open || !question) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${QTYPE_COLORS[question.question_type]}`}>
                <FileQuestion className="h-4 w-4" />
             </div>
             <h3 className="font-bold text-slate-900">Question Preview</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
           <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                 <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${QTYPE_COLORS[question.question_type]}`}>
                   {question.question_type.replace(/_/g, ' ')}
                 </span>
                 <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${DIFF_COLORS[question.difficulty_level]}`}>
                   {question.difficulty_level}
                 </span>
                 <span className="text-xs font-bold text-slate-400">Score Weight: {question.max_mark} mk</span>
              </div>
              <p className="text-lg font-bold text-slate-800 leading-relaxed">{question.question_text}</p>
              {question.diagram && (
                <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm max-w-md">
                   <img src={question.diagram} alt="Diagram" className="w-full h-auto" />
                </div>
              )}
           </div>

           {question.question_type === 'objective' && question.options && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(question.options).map(([label, text]) => (
                  <div key={label} className={`p-4 rounded-2xl border flex items-start gap-4 transition-all
                    ${question.correct_answer === label ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                     <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0
                        ${question.correct_answer === label ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-white text-slate-400 shadow-sm'}`}>
                        {label}
                     </div>
                     <span className={`text-sm font-bold ${question.correct_answer === label ? 'text-emerald-900' : 'text-slate-600'}`}>{text}</span>
                     {question.correct_answer === label && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto shrink-0" />}
                  </div>
                ))}
             </div>
           )}

           {['theory', 'subjective', 'fill_blank'].includes(question.question_type) && (
             <div className="space-y-6">
                {question.model_answer && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-[1.5rem] p-6">
                    <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <CheckCircle2 className="h-3 w-3" /> Model Answer
                    </h4>
                    <p className="text-sm font-bold text-emerald-900 leading-relaxed whitespace-pre-wrap">{question.model_answer}</p>
                  </div>
                )}
                {question.keywords && (question.keywords as any).length > 0 && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-[1.5rem] p-6">
                    <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Target className="h-3 w-3" /> AI Grading Keywords
                    </h4>
                    <div className="flex flex-wrap gap-2">
                       {(question.keywords as any).map((k: string, i: number) => (
                         <span key={i} className="px-3 py-1 bg-white border border-blue-100 text-blue-700 text-xs font-bold rounded-lg shadow-sm">
                           {k}
                         </span>
                       ))}
                    </div>
                  </div>
                )}
             </div>
           )}

           {question.question_type === 'true_false' && (
             <div className="flex items-center gap-4">
                {['True', 'False'].map(val => (
                  <div key={val} className={`flex-1 p-5 rounded-[1.5rem] border flex items-center justify-center gap-3 transition-all
                    ${question.correct_answer === val ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                     <span className={`text-lg font-black ${question.correct_answer === val ? 'text-emerald-700' : 'text-slate-400'}`}>{val}</span>
                     {question.correct_answer === val && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  </div>
                ))}
             </div>
           )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
           <button onClick={onClose} className="px-6 py-2 bg-slate-900 text-white text-sm font-black rounded-xl hover:bg-black transition-all shadow-lg">
             CLOSE PREVIEW
           </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Generate Modal ────────────────────────────────────────────────────────

function AIGenerateModal({ open, schedule, onClose, onComplete, topics }: {
  open: boolean;
  schedule: ExamScheduleDetail;
  onClose: () => void;
  onComplete: () => void;
  topics: any[];
}) {
  const [loading, setLoading] = useState(false);
  const [questionType, setQuestionType] = useState<'objective' | 'theory'>('objective');
  const [difficulty, setDifficulty] = useState<'random' | 'easy' | 'medium' | 'hard'>('random');
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [count, setCount] = useState(5);
  const [overhaul, setOverhaul] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    try {
      await examSchedulesAPI.aiGenerateQuestions(schedule.id, {
        question_type: questionType,
        difficulty,
        topics: selectedTopics,
        count,
        overhaul,
      });
      onComplete();
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-in zoom-in-95 fade-in">

        {/* Header */}
        <div className="relative px-6 pt-8 pb-6 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <BrainCircuit className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">AI Question Selection</h3>
                <p className="text-xs text-slate-500">Auto-pick from your question bank</p>
              </div>
            </div>
            <button onClick={onClose} disabled={loading}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors disabled:opacity-40">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Inline error */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-1">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Generation failed</p>
                <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-5">

          {/* Type + Difficulty */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Type</label>
              <select value={questionType} onChange={e => setQuestionType(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-violet-500 text-slate-700">
                <option value="objective">Objective</option>
                <option value="theory">Theory</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-violet-500 text-slate-700">
                <option value="random">Random</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Count + Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Count</label>
              <input type="number" min={1} max={50} value={count}
                onChange={e => setCount(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-violet-500 text-slate-700" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Mode</label>
              <div className="flex bg-slate-100 p-1 rounded-xl h-[42px]">
                <button type="button" onClick={() => setOverhaul(false)}
                  className={`flex-1 rounded-lg text-xs font-bold transition-all ${!overhaul ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  Append
                </button>
                <button type="button" onClick={() => setOverhaul(true)}
                  className={`flex-1 rounded-lg text-xs font-bold transition-all ${overhaul ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                  Replace
                </button>
              </div>
            </div>
          </div>

          {/* Topics */}
          {topics.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">
                Filter by Topic <span className="normal-case font-normal text-slate-400">(optional)</span>
              </label>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-32 overflow-y-auto divide-y divide-slate-50">
                  {topics.map(t => (
                    <label key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={selectedTopics.includes(t.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedTopics([...selectedTopics, t.id]);
                          else setSelectedTopics(selectedTopics.filter(id => id !== t.id));
                        }}
                        className="rounded text-violet-600 focus:ring-violet-500" />
                      <span className="text-sm text-slate-700">{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {overhaul && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                <span className="font-semibold">Replace mode:</span> existing {questionType} questions will be removed before adding new ones.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5 flex-shrink-0">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleGenerate} disabled={loading}
            className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-violet-200">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              : <><Sparkles className="h-4 w-4" /> Generate</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SetupBadge ───────────────────────────────────────────────────────────────

function SetupBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    ready:   { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Ready' },
    partial: { cls: 'bg-amber-50 text-amber-700 border-amber-200',       label: 'Partial' },
    draft:   { cls: 'bg-slate-50 text-slate-600 border-slate-200',       label: 'Draft' },
  };
  const { cls, label } = map[status] || map.draft;
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>{label}</span>;
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────

function QuestionCard({ question, order, action, onPreview }: {
  question: Question | SelectedQuestion;
  order?: number;
  action?: React.ReactNode;
  onPreview: (q: Question) => void;
}) {
  const typeCls = QTYPE_COLORS[question.question_type] || 'bg-slate-50 text-slate-600 border-slate-200';
  const diffCls = DIFF_COLORS[question.difficulty_level] || 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <div className="border border-slate-100 rounded-xl p-3.5 hover:bg-slate-50/60 transition-all group/card">
      <div className="flex items-start gap-3">
        {order !== undefined && (
          <div className="shrink-0 w-7 h-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center font-bold text-xs">
            {order}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {question.question_number != null && (
              <span className="text-xs font-semibold text-slate-600">
                Q{question.question_number}{question.sub_question_number || ''}
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold border ${typeCls}`}>
              {question.question_type.replace(/_/g, ' ')}
            </span>
            <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold border ${diffCls}`}>
              {question.difficulty_level}
            </span>
            <span className="text-xs text-slate-400">{question.max_mark} mk</span>
          </div>
          <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">{question.question_text}</p>
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button onClick={() => onPreview(question as any)} className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover/card:opacity-100" title="Preview full question">
            <Eye className="h-3.5 w-3.5" />
          </button>
          {action && <div className="shrink-0 ml-1">{action}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExamScheduleDetailPage() {
  const router   = useRouter();
  const params   = useParams();
  const { hasPermission, user } = useAuth();
  const { toasts, showToast, removeToast } = useToasts();

  const examId     = params?.id         ? parseInt(params.id as string)         : null;
  const scheduleId = params?.scheduleId ? parseInt(params.scheduleId as string) : null;

  // ── Data ───────────────────────────────────────────────────────────────────
  const [schedule,       setSchedule]       = useState<ExamScheduleDetail | null>(null);
  const [questionBanks,  setQuestionBanks]  = useState<QuestionBank[]>([]);
  const [halls,          setHalls]          = useState<ExaminationHall[]>([]);
  const [staffList,      setStaffList]      = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);

  // ── Config ─────────────────────────────────────────────────────────────────
  const [startDateTime,   setStartDateTime]   = useState('');
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [graceMinutes,    setGraceMinutes]    = useState(0);
  const [hallId,          setHallId]          = useState<number | null>(null);
  const [invigilators,    setInvigilators]    = useState<number[]>([]);
  const [savingConfig,    setSavingConfig]    = useState(false);

  // ── Invigilator modal ──────────────────────────────────────────────────────
  const [showInvigilatorModal, setShowInvigilatorModal] = useState(false);

  // ── Requirements ──────────────────────────────────────────────────────────
  const [reqObjective,  setReqObjective]  = useState(0);
  const [reqTheory,     setReqTheory]     = useState(0);
  const [reqSubjective, setReqSubjective] = useState(0);
  const [savingReqs,    setSavingReqs]    = useState(false);

  // ── Questions ──────────────────────────────────────────────────────────────
  const [activeTab,          setActiveTab]          = useState<'manual' | 'ai' | 'bulk'>('manual');
  const [selectedBank,       setSelectedBank]       = useState<number | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestions,  setSelectedQuestions]  = useState<SelectedQuestion[]>([]);
  const [loadingQuestions,   setLoadingQuestions]   = useState(false);
  const [savingQuestions,    setSavingQuestions]    = useState(false);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchQuery,      setSearchQuery]      = useState('');
  const [filterType,       setFilterType]       = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // ── AI ─────────────────────────────────────────────────────────────────────
  const [showAIGenerate, setShowAIGenerate] = useState(false);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [errorModal, setErrorModal]           = useState<{ title: string; message: string } | null>(null);

  // ── Mark ready ─────────────────────────────────────────────────────────────
  const [markingReady, setMarkingReady] = useState(false);

  // ── PIN ────────────────────────────────────────────────────────────────────
  const [duplicateId, setDuplicateId] = useState<number | null>(null);

  const isPublished = schedule ? schedule.is_published === true : false;
  const canEdit = !isPublished && (user?.is_superuser || hasPermission('assessment_center.change_examschedulemodel'));

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async (silent = false) => {
    if (!scheduleId) return;
    if (!silent) setLoading(true);
    try {
      const [data, assigned] = await Promise.all([
        examSchedulesAPI.get(scheduleId),
        examSchedulesAPI.getAssignedQuestions(scheduleId),
      ]);
      setSchedule(data);
      if (data.start_datetime) setStartDateTime(data.start_datetime.substring(0, 16));
      setDurationMinutes(data.duration_minutes ?? 120);
      setGraceMinutes(data.grace_period_minutes ?? 0);
      setHallId(data.examination_hall ?? null);
      setInvigilators(data.invigilators || []);
      setReqObjective(data.total_objective_questions ?? 0);
      setReqTheory(data.total_theory_questions ?? 0);
      setReqSubjective(data.total_subjective_questions ?? 0);
      const qs: SelectedQuestion[] = (assigned.questions || [])
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((q: any, idx: number) => ({
          ...q.question_data,
          _order: q.order ?? idx + 1,
          custom_mark: q.custom_mark ?? null,
          section_id: q.exam_section ?? null,
        }));
      setSelectedQuestions(qs);
      const [banksResponse, hallData, staffData] = await Promise.all([
        questionBanksAPI.getAvailableForSchedule(scheduleId!),
        examinationHallsAPI.list({ is_active: true }),
        staffAPI.list({ status: 'active' }),
      ]);
      const banks = banksResponse.banks ?? [];
      setQuestionBanks(banks);
      setHalls(hallData);
      setStaffList(staffData);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadQuestionsFromBank = useCallback(async (bankId: number) => {
    if (!schedule) return;
    setLoadingQuestions(true);
    setAvailableQuestions([]);
    try {
      const qs = await questionsAPI.list({ question_bank: bankId });
      setAvailableQuestions(qs);
    } catch (err) {
      showToast('error', 'Failed to load questions from bank');
    } finally {
      setLoadingQuestions(false);
    }
  }, [schedule]);

  const handleBankChange = (bankId: number) => {
    if (!bankId || isNaN(bankId)) {
      setSelectedBank(null);
      setAvailableQuestions([]);
      return;
    }
    setSelectedBank(bankId);
    setSearchQuery('');
    setFilterType('');
    setFilterDifficulty('');
    loadQuestionsFromBank(bankId);
  };

  const handleSaveConfig = async () => {
    if (!scheduleId) return;
    setSavingConfig(true);
    try {
      const payload: any = {
        duration_minutes:    durationMinutes,
        grace_period_minutes: graceMinutes,
        examination_hall:    hallId,
        invigilators:        invigilators,
      };
      if (startDateTime) payload.start_datetime = new Date(startDateTime).toISOString();
      await examSchedulesAPI.update(scheduleId, payload);
      showToast('success', 'Schedule configuration saved');
      await fetchAll(true);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveRequirements = async () => {
    if (!scheduleId) return;
    if (reqObjective + reqTheory + reqSubjective === 0) {
      showToast('error', 'At least one question type must have a count greater than 0');
      return;
    }
    setSavingReqs(true);
    try {
      await examSchedulesAPI.setQuestionRequirements(scheduleId, {
        total_objective_questions:  reqObjective,
        total_theory_questions:     reqTheory,
        total_subjective_questions: reqSubjective,
      });
      showToast('success', 'Question requirements saved');
      await fetchAll(true);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSavingReqs(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentObjective  = selectedQuestions.filter(q => q.question_type === 'objective').length;
  const currentTheory     = selectedQuestions.filter(q => q.question_type === 'theory').length;
  const currentSubjective = selectedQuestions.filter(q => q.question_type === 'subjective').length;

  const allRequirementsMet =
    (reqObjective + reqTheory + reqSubjective > 0) &&
    currentObjective  === reqObjective  &&
    currentTheory     === reqTheory     &&
    currentSubjective === reqSubjective;

  const typeOrder = ['objective', 'theory', 'subjective', 'true_false', 'fill_blank'];
  const sortQs = (qs: Question[]) => [...qs].sort((a, b) => {
    const ai = typeOrder.indexOf(a.question_type);
    const bi = typeOrder.indexOf(b.question_type);
    if (ai !== bi) return ai - bi;
    return (a.question_number ?? 999) - (b.question_number ?? 999);
  });

  const filteredAvailable = sortQs(availableQuestions.filter(q => {
    if (selectedQuestions.some(sq => sq.id === q.id)) return false;
    if (filterType       && q.question_type    !== filterType)       return false;
    if (filterDifficulty && q.difficulty_level !== filterDifficulty) return false;
    if (searchQuery && !q.question_text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }));

  // ── Question management ────────────────────────────────────────────────────

  const handleAddQuestion = (q: Question) => {
    if (selectedQuestions.some(sq => sq.id === q.id)) {
      setDuplicateId(q.id);
      setTimeout(() => setDuplicateId(null), 3000);
      return;
    }

    // Check limits
    if (q.question_type === 'objective' && reqObjective > 0 && currentObjective >= reqObjective) {
      showToast('error', `Objective limit (${reqObjective}) reached.`);
      return;
    }
    if (q.question_type === 'theory' && reqTheory > 0 && currentTheory >= reqTheory) {
      showToast('error', `Theory limit (${reqTheory}) reached.`);
      return;
    }
    if (q.question_type === 'subjective' && reqSubjective > 0 && currentSubjective >= reqSubjective) {
      showToast('error', `Subjective limit (${reqSubjective}) reached.`);
      return;
    }

    setSelectedQuestions(prev => renumber([...prev, { ...q, _order: prev.length + 1 }]));
  };

  const handleRemoveQuestion = (questionId: number) => {
    setSelectedQuestions(prev => renumber(prev.filter(q => q.id !== questionId)));
  };

  const handleSaveQuestions = async () => {
    if (!scheduleId) return;
    if (selectedQuestions.length === 0) {
      showToast('error', 'No questions selected. Add questions before saving.');
      return;
    }

    // NOTE: marks tally validation removed — staff can save partial selections
    // and complete them later.

    setSavingQuestions(true);
    try {
      await examSchedulesAPI.addQuestions(scheduleId, {
        question_ids: selectedQuestions.map(q => q.id),
        order:        selectedQuestions.map(q => q.id),
        custom_marks: Object.fromEntries(
          selectedQuestions
            .filter(q => q.custom_mark != null)
            .map(q => [q.id, q.custom_mark!])
        ),
      });
      showToast('success', `${selectedQuestions.length} questions saved`);
      await fetchAll(true);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSavingQuestions(false);
    }
  };

  const handleMarkReady = async () => {
    if (!scheduleId) return;
    setMarkingReady(true);
    try {
      await examSchedulesAPI.markReady(scheduleId);
      showToast('success', 'Schedule marked as ready');
      await fetchAll(true);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setMarkingReady(false);
    }
  };

  const handleBulkImport = async (ids: number[], validQIds: Set<number>) => {
    if (!scheduleId || !schedule) return;

    const invalid = ids.filter(id => !validQIds.has(id));
    if (invalid.length > 0) {
      showToast('error', `These IDs are not in the selected bank: ${invalid.join(', ')}`);
      return;
    }

    const existingIds = new Set(selectedQuestions.map(q => q.id));
    const newIds = ids.filter(id => !existingIds.has(id));
    if (newIds.length === 0) {
      showToast('error', 'All entered IDs are already selected');
      return;
    }

    let objToAdd = 0, theoryToAdd = 0, subjToAdd = 0;
    const questionsToAdd: Question[] = [];

    for (const id of newIds) {
      const q = availableQuestions.find(x => x.id === id);
      if (!q) continue;
      if (q.question_type === 'objective') objToAdd++;
      else if (q.question_type === 'theory') theoryToAdd++;
      else if (q.question_type === 'subjective') subjToAdd++;
      questionsToAdd.push(q);
    }

    if (reqObjective > 0 && currentObjective + objToAdd > reqObjective) {
      showToast('error', `Bulk add failed: Objective limit would be exceeded (${currentObjective + objToAdd} > ${reqObjective})`);
      return;
    }
    if (reqTheory > 0 && currentTheory + theoryToAdd > reqTheory) {
      showToast('error', `Bulk add failed: Theory limit would be exceeded (${currentTheory + theoryToAdd} > ${reqTheory})`);
      return;
    }
    if (reqSubjective > 0 && currentSubjective + subjToAdd > reqSubjective) {
      showToast('error', `Bulk add failed: Subjective limit would be exceeded (${currentSubjective + subjToAdd} > ${reqSubjective})`);
      return;
    }

    setSelectedQuestions(prev => renumber([
      ...prev,
      ...questionsToAdd.map(q => ({ ...q, _order: 0, custom_mark: null, section_id: null })),
    ]));
    showToast('success', `${questionsToAdd.length} questions added — click Save to confirm`);
    setActiveTab('manual');
  };

  // ── Invigilator save ───────────────────────────────────────────────────────

  const handleSaveInvigilators = (ids: number[]) => {
    setInvigilators(ids);
    setShowInvigilatorModal(false);
  };

  // ── Manual Selection Grouping ─────────────────────────────────────────────

  const groupedAvailable = typeOrder.map(t => ({
    type: t,
    questions: filteredAvailable.filter(q => q.question_type === t)
  })).filter(g => g.questions.length > 0);

  // ── Invigilator display names ──────────────────────────────────────────────

  const invigilatorNames = staffList
    .filter(s => invigilators.includes(s.id))
    .map(s => s.full_name || `${s.first_name} ${s.last_name}`);

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-96 flex items-center justify-center">
      <Loader2 className="h-10 w-10 text-violet-500 animate-spin" />
    </div>
  );

  if (!schedule) return (
    <div className="min-h-96 flex items-center justify-center text-center">
      <div>
        <AlertCircle className="h-14 w-14 text-red-300 mx-auto mb-4" />
        <p className="font-semibold text-slate-700 mb-4">Schedule not found</p>
        <button onClick={() => router.back()}
          className="px-5 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 text-sm">
          Go Back
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onRemove={removeToast} />

      <ErrorModal
        open={!!errorModal}
        title={errorModal?.title || 'Error'}
        message={errorModal?.message || ''}
        onClose={() => setErrorModal(null)}
      />

      {duplicateId && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] px-6 py-3 bg-amber-600 text-white rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-in slide-in-from-top-4 fade-in duration-300">
          Question ID #{duplicateId} already selected
        </div>
      )}

      <QuestionPreviewModal open={!!previewQuestion} question={previewQuestion} onClose={() => setPreviewQuestion(null)} />

      <AIGenerateModal
        open={showAIGenerate}
        schedule={schedule}
        topics={questionBanks.filter(b => b.id === selectedBank).flatMap(b => b.topic ? [{ id: b.topic, title: b.topic_title }] : [])}
        onClose={() => setShowAIGenerate(false)}
        onComplete={() => { setShowAIGenerate(false); showToast('success', 'AI generation complete'); fetchAll(true); }}
      />

      <InvigilatorModal
        open={showInvigilatorModal}
        assignedIds={invigilators}
        staffList={staffList}
        isSaving={false}
        onSave={handleSaveInvigilators}
        onClose={() => setShowInvigilatorModal(false)}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors mt-0.5 shrink-0"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0"><BookOpen className="h-4 w-4 text-white" /></div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{schedule.subject_name} — {schedule.class_name}{schedule.section_name ? ` (${schedule.section_name})` : ''}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{schedule.exam_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <SetupBadge status={schedule.setup_status} />
            <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{schedule.exam_code}</span>
            <span className="inline-flex items-center gap-1 text-xs text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-lg"><Shield className="h-3 w-3" />Questions locked to subject/class</span>
          </div>
        </div>
        <button onClick={() => fetchAll(true)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors shrink-0 mt-0.5"><RefreshCw className="h-4 w-4" /></button>
      </div>

      {isPublished && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"><Shield className="h-4 w-4 text-amber-500 shrink-0" /><p className="text-sm text-amber-800 font-medium">Exam is <strong>published</strong>. Editing is locked.</p></div>
      )}

      {/* ── Stat chips ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Added',  value: selectedQuestions.length, color: 'text-violet-600' },
          { label: 'Objective',    value: `${currentObjective}/${reqObjective}`,   color: currentObjective  === reqObjective  && reqObjective  > 0 ? 'text-emerald-600' : 'text-slate-600' },
          { label: 'Theory',       value: `${currentTheory}/${reqTheory}`,         color: currentTheory     === reqTheory     && reqTheory     > 0 ? 'text-emerald-600' : 'text-slate-600' },
          { label: 'Subjective',   value: `${currentSubjective}/${reqSubjective}`, color: currentSubjective === reqSubjective && reqSubjective > 0 ? 'text-emerald-600' : 'text-slate-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
            <p className="text-xs font-medium text-slate-500 mb-0.5">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Config & Requirements — stacked vertically ────────────────────── */}
      <div className="space-y-5">

        {/* Schedule Config */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <SectionHeader icon={Settings} title="Schedule Config" subtitle="Date, time, hall, invigilators" />
          <div className="grid grid-cols-1 sm:grid-cols-6 lg:grid-cols-12 gap-4">

            {/* Start Date — col-4 */}
            <div className="sm:col-span-6 lg:col-span-4">
              <label className={labelCls}>Start Date &amp; Time</label>
              <input type="datetime-local" value={startDateTime}
                onChange={e => setStartDateTime(e.target.value)}
                className={inputCls} disabled={!canEdit} />
            </div>

            {/* Duration — col-4 */}
            <div className="sm:col-span-3 lg:col-span-4">
              <label className={labelCls}>Duration (min)</label>
              <input type="number" value={durationMinutes}
                onChange={e => setDurationMinutes(parseInt(e.target.value) || 60)}
                className={inputCls} disabled={!canEdit} />
            </div>

            {/* Grace — col-4 */}
            <div className="sm:col-span-3 lg:col-span-4">
              <label className={labelCls}>Grace Period (min)</label>
              <input type="number" value={graceMinutes}
                onChange={e => setGraceMinutes(parseInt(e.target.value) || 0)}
                className={inputCls} disabled={!canEdit} />
            </div>

            {/* Hall — col-6 */}
            <div className="sm:col-span-3 lg:col-span-6">
              <label className={labelCls}>Examination Hall</label>
              <select value={hallId ?? ''} onChange={e => setHallId(e.target.value ? parseInt(e.target.value) : null)}
                className={inputCls} disabled={!canEdit}>
                <option value="">— No hall assigned —</option>
                {halls.map(h => (<option key={h.id} value={h.id}>{h.name} (capacity: {h.capacity})</option>))}
              </select>
            </div>

            {/* Invigilators — col-6 with chip display + modal trigger */}
            <div className="sm:col-span-3 lg:col-span-6">
              <label className={labelCls}>Invigilators</label>
              <div
                onClick={() => canEdit && setShowInvigilatorModal(true)}
                className={`min-h-[42px] w-full px-3 py-2 border border-slate-200 rounded-xl text-sm flex items-center flex-wrap gap-1.5 transition-colors
                  ${canEdit ? 'cursor-pointer hover:border-violet-400 hover:bg-violet-50/30' : 'bg-slate-50 cursor-default'}`}
              >
                {invigilatorNames.length === 0 ? (
                  <span className="text-slate-400 text-sm">
                    {canEdit ? 'Click to assign invigilators...' : 'No invigilators assigned'}
                  </span>
                ) : (
                  invigilatorNames.map((name, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 text-violet-800 text-xs font-medium rounded-lg">
                      <UserCheck className="h-3 w-3" />{name}
                    </span>
                  ))
                )}
                {canEdit && (
                  <span className="ml-auto text-xs text-violet-500 font-medium shrink-0 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Manage
                  </span>
                )}
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex justify-end mt-4">
              <button onClick={handleSaveConfig} disabled={savingConfig}
                className="px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 text-sm disabled:opacity-50 flex items-center gap-2">
                {savingConfig ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : 'Save Config'}
              </button>
            </div>
          )}
        </div>

        {/* Requirements */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <SectionHeader icon={Target} title="Question Requirements" subtitle="Set expected question counts per type" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Objective',  val: reqObjective,  set: setReqObjective },
              { label: 'Theory',     val: reqTheory,     set: setReqTheory },
              { label: 'Subjective', val: reqSubjective, set: setReqSubjective },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <label className={labelCls}>{label}</label>
                <input type="number" min={0} value={val}
                  onChange={e => set(parseInt(e.target.value) || 0)}
                  className={inputCls} disabled={!canEdit} />
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="flex justify-end mt-4">
              <button onClick={handleSaveRequirements} disabled={savingReqs}
                className="px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 text-sm disabled:opacity-50 flex items-center gap-2">
                {savingReqs ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</> : 'Save Requirements'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Question Management ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 flex">
          {[
            { key: 'manual', label: 'Manual Selection', icon: BookOpen },
            { key: 'ai',     label: 'AI Generate',      icon: Sparkles },
            { key: 'bulk',   label: 'Bulk Import',      icon: Upload },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)} className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors ${activeTab === key ? 'text-violet-600 border-b-2 border-violet-600 bg-violet-50/40' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <select value={selectedBank ?? ''} onChange={e => handleBankChange(parseInt(e.target.value))} disabled={!canEdit || questionBanks.length === 0} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-slate-50"><option value="">{questionBanks.length === 0 ? `No banks` : '— Select Question Bank —'}</option>{questionBanks.map(b => (<option key={b.id} value={b.id}>{b.name} ({b.question_count ?? 0})</option>))}</select>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" /><input type="text" placeholder="Search questions…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" /></div>
                <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"><option value="">All Types</option>{typeOrder.map(t => (<option key={t} value={t}>{t.replace(/_/g, ' ')}</option>))}</select>
                <select value={filterDifficulty} onChange={e => setFilterDifficulty(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"><option value="">All Difficulties</option>{['easy', 'medium', 'hard'].map(d => (<option key={d} value={d}>{d}</option>))}</select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between"><span className="text-sm font-semibold text-slate-700">Available ({filteredAvailable.length})</span></div>
                  <div className="p-3 max-h-[520px] overflow-y-auto space-y-6">
                    {loadingQuestions ? (
                      <div className="flex items-center justify-center py-16"><Loader2 className="h-7 w-7 text-violet-400 animate-spin" /></div>
                    ) : groupedAvailable.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center gap-2"><BookOpen className="h-10 w-10 text-slate-200" /><p className="text-sm text-slate-400">No questions found</p></div>
                    ) : groupedAvailable.map(group => (
                      <div key={group.type} className="space-y-3">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 bg-slate-50 px-2 py-1 rounded-md">
                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                          {group.type.replace(/_/g, ' ')}s ({group.questions.length})
                        </h5>
                        <div className="space-y-2">
                          {group.questions.map(q => (
                            <QuestionCard key={q.id} question={q} onPreview={setPreviewQuestion} action={canEdit ? (
                              <button onClick={() => handleAddQuestion(q)} className="p-1.5 text-violet-600 hover:bg-violet-100 rounded-lg border border-violet-200 transition-colors"><Plus className="h-3.5 w-3.5" /></button>
                            ) : undefined} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Selected ({selectedQuestions.length})</span>
                    {canEdit && (
                      <button onClick={handleSaveQuestions} disabled={savingQuestions}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
                        {savingQuestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                      </button>
                    )}
                  </div>
                  <div className="p-3 max-h-[520px] overflow-y-auto space-y-2">
                    {selectedQuestions.length === 0
                      ? <div className="flex flex-col items-center justify-center py-16 text-center gap-2"><ListChecks className="h-10 w-10 text-slate-200" /><p className="text-sm text-slate-400">No questions selected yet</p></div>
                      : selectedQuestions.map(q => (
                        <QuestionCard key={q.id} question={q} order={q._order} onPreview={setPreviewQuestion} action={canEdit ? (
                          <button onClick={() => handleRemoveQuestion(q.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"><X className="h-3.5 w-3.5" /></button>
                        ) : undefined} />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="max-w-sm mx-auto py-10">
              <div className="text-center space-y-5">
                <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto">
                  <BrainCircuit className="h-8 w-8 text-violet-600" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">AI Question Selection</h4>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    Intelligently select the most appropriate questions from your bank using the school's active AI service.
                  </p>
                </div>
                <button onClick={() => setShowAIGenerate(true)} disabled={!canEdit}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-violet-200">
                  <Sparkles className="h-4 w-4" /> Configure &amp; Generate
                </button>
                <p className="text-xs text-slate-400">
                  Make sure a question bank is selected in the Manual tab first.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'bulk' && (
            <BulkTab
              onImport={handleBulkImport}
              questionBanks={questionBanks}
              selectedBankQuestions={availableQuestions}
              selectedBank={selectedBank}
              onBankChange={handleBankChange}
              loadingQuestions={loadingQuestions}
              subjectName={schedule.subject_name}
              className={schedule.class_name}
              canEdit={canEdit}
              onPreview={setPreviewQuestion}
            />
          )}
        </div>
      </div>

      {allRequirementsMet && schedule.setup_status !== 'ready' && canEdit && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-900 text-sm">All requirements met!</p>
              <p className="text-xs text-emerald-700 mt-0.5">Save your questions first, then mark this schedule as ready.</p>
            </div>
          </div>
          <button onClick={handleMarkReady} disabled={markingReady}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 text-sm transition-colors shrink-0">
            {markingReady ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Mark as Ready
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Tab ─────────────────────────────────────────────────────────────────

function BulkTab({
  onImport, questionBanks, selectedBankQuestions, selectedBank, onBankChange,
  loadingQuestions, subjectName, className, canEdit, onPreview
}: {
  onImport: (ids: number[], validIds: Set<number>) => Promise<void>;
  questionBanks: QuestionBank[];
  selectedBankQuestions: Question[];
  selectedBank: number | null;
  onBankChange: (id: number) => void;
  loadingQuestions: boolean;
  subjectName?: string;
  className?: string;
  canEdit: boolean;
  onPreview: (q: Question) => void;
}) {
  const [idText, setIdText] = useState('');
  const [duplicateId, setDuplicateId] = useState<number | null>(null);

  const validQIds = new Set(selectedBankQuestions.map(q => q.id));

  const handleImport = async () => {
    const ids = idText.split(/[\s,\n]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (ids.length === 0) return;
    await onImport(ids, validQIds);
    setIdText('');
  };

  const handleAddId = (id: number) => {
    const existingIds = idText.split(/[\s,\n]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (existingIds.includes(id)) {
      setDuplicateId(id);
      setTimeout(() => setDuplicateId(null), 3000);
      return;
    }
    setIdText(prev => { const existing = prev.trim(); return existing ? `${existing}, ${id}` : `${id}`; });
  };

  const types = ['objective', 'theory', 'subjective', 'true_false', 'fill_blank'];
  const grouped = types.map(t => ({
    type: t,
    questions: selectedBankQuestions.filter(q => q.question_type === t)
  })).filter(g => g.questions.length > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <Upload className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 mb-1">How Bulk Import Works</p>
          <ol className="text-xs text-amber-700 space-y-0.5 list-decimal list-inside">
            <li>Select a bank to see available IDs.</li>
            <li>Click an ID to add it to your input area.</li>
            <li>Click <strong>Import</strong> to add them to your selection.</li>
            <li>Switch to <strong>Manual Selection</strong> then click <strong>Save</strong>.</li>
          </ol>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Question Bank</label>
        <select value={selectedBank ?? ''} onChange={e => { if (e.target.value) onBankChange(parseInt(e.target.value)); }}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-slate-50" disabled={!canEdit || questionBanks.length === 0}>
          <option value="">Select a bank to view IDs</option>
          {questionBanks.map(b => (<option key={b.id} value={b.id}>{b.name} ({b.question_count ?? 0})</option>))}
        </select>
      </div>

      {selectedBank && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/30">
          <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Question Repository</span>
            <span className="text-[10px] font-bold text-slate-400">Click ID to add · Eye icon to preview</span>
          </div>
          {loadingQuestions
            ? <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 text-violet-400 animate-spin" /></div>
            : grouped.length === 0
            ? <p className="text-xs text-slate-400 text-center py-10">Empty bank</p>
            : (
              <div className="p-4 space-y-6 max-h-80 overflow-y-auto">
                {grouped.map(group => (
                  <div key={group.type} className="space-y-3">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {group.type.replace(/_/g, ' ')}s ({group.questions.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {group.questions.map(q => (
                        <div key={q.id} className="flex items-center bg-white border border-slate-100 rounded-xl shadow-sm hover:border-indigo-300 transition-all">
                          <button onClick={() => handleAddId(q.id)} className="pl-3 pr-2 py-2 flex items-center gap-2 group">
                            <span className="font-mono font-black text-indigo-600 text-xs group-hover:scale-110 transition-transform">#{q.id}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{q.difficulty_level[0]}</span>
                          </button>
                          <div className="w-px h-4 bg-slate-100 mx-1" />
                          <button onClick={() => onPreview(q)} className="pr-3 pl-2 py-2 text-slate-300 hover:text-indigo-600 transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      <div className="space-y-3">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IDs to Import</label>
        <textarea value={idText} onChange={e => setIdText(e.target.value)} rows={3}
          placeholder="e.g. 102, 105, 120..."
          className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50"
          disabled={!canEdit} />
        <button onClick={handleImport} disabled={!idText.trim() || !selectedBank}
          className="w-full h-[52px] bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
          <Upload className="h-4 w-4" /> ADD TO SELECTION
        </button>
      </div>
    </div>
  );
}