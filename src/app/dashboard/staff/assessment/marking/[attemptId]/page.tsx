'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Brain, User,
  Loader2, AlertCircle, List, PenLine, FileText,
  Check, X, RotateCcw, Save, ChevronLeft, ChevronRight,
  BookOpen, Lightbulb, Target,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnswerItem {
  answer_id: number;
  question_number: string;
  sub_question_number: string | null;
  question_text: string;
  question_image?: string | null;
  image?: string | null;
  image_url?: string | null;
  question_type: 'objective' | 'theory' | 'subjective';
  section: string | null;
  max_mark: number;
  is_graded: boolean;
  score_awarded: number | null;
  grading_method: 'auto' | 'ai' | 'manual' | null;
  ai_feedback: string | null;
  ai_confidence?: number | null;

  // Objective
  selected_option?: string;
  correct_answer?: string;
  is_correct?: boolean;
  options?: Record<string, string>;

  // Theory / subjective
  answer_text?: string;
  model_answer?: string;
}

interface AttemptResult {
  attempt: {
    attempt_id: string;
    student_name?: string;
    status: string;
    total_score: number | null;
    percentage: number | null;
  };
  exam_details: {
    name: string;
    subject: string;
    total_marks: number;
  };
  answers: AnswerItem[];
  statistics: {
    total_questions: number;
    graded: number;
    pending: number;
    correct: number | null;
  };
}

type TabType = 'objective' | 'theory' | 'subjective';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  if (err?.response?.data) {
    const d = err.response.data;
    if (typeof d === 'string') return d;
    if (d.detail) return d.detail;
    if (d.error) return d.error;
  }
  return err?.message || 'Something went wrong';
}

function confidenceLabel(confidence: number | null | undefined): { label: string; cls: string } {
  if (confidence == null) return { label: '—', cls: 'text-slate-400' };
  if (confidence >= 0.85) return { label: `${Math.round(confidence * 100)}% confident`, cls: 'text-emerald-600' };
  if (confidence >= 0.65) return { label: `${Math.round(confidence * 100)}% confident`, cls: 'text-amber-600' };
  return { label: `${Math.round(confidence * 100)}% — low confidence`, cls: 'text-red-600' };
}

function getImageUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_API_URL || ''}${path}`;
}

// ─── Score Input ───────────────────────────────────────────────────────────────

interface ScoreInputProps {
  answerId: string;
  maxMark: number;
  currentScore: number | null;
  isGraded: boolean;
  gradingMethod: string | null;
  aiConfidence?: number | null;
  onSave: (score: number, feedback: string) => Promise<void>;
  saving: boolean;
}

function ScoreInput({ answerId, maxMark, currentScore, isGraded, gradingMethod, aiConfidence, onSave, saving }: ScoreInputProps) {
  const [score, setScore] = useState<string>(currentScore != null ? String(currentScore) : '');
  const [feedback, setFeedback] = useState('');
  const [editing, setEditing] = useState(!isGraded);

  const isLowConfidence = aiConfidence != null && aiConfidence < 0.7;
  const showOverridePrompt = isGraded && gradingMethod === 'ai' && isLowConfidence;

  useEffect(() => {
    setScore(currentScore != null ? String(currentScore) : '');
    setEditing(!isGraded || showOverridePrompt);
  }, [answerId, currentScore, isGraded]);

  const handleSave = async () => {
    const s = parseFloat(score);
    if (isNaN(s) || s < 0 || s > maxMark) return;
    await onSave(s, feedback);
    setEditing(false);
  };

  const conf = confidenceLabel(aiConfidence);

  if (!editing && isGraded) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-sm font-bold ${
              gradingMethod === 'ai' ? 'text-blue-700' : 'text-violet-700'
            }`}>
              {gradingMethod === 'ai' ? <Brain className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {currentScore} / {maxMark}
            </div>
            {gradingMethod === 'ai' && (
              <span className={`text-xs font-medium ${conf.cls}`}>{conf.label}</span>
            )}
          </div>
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-xs font-semibold rounded-lg hover:bg-white transition-colors">
            <RotateCcw className="h-3 w-3" /> Override
          </button>
        </div>
        {isLowConfidence && (
          <div className="mt-3 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 font-medium">
              AI confidence is low — please review and override if needed.
            </p>
          </div>
        )}
        {currentScore != null && gradingMethod === 'ai' && (
          <p className="text-xs text-slate-500 mt-2 italic">{/* AI feedback shown in parent */}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">
        {isGraded ? 'Override Score' : 'Award Score'}
      </p>

      {/* Score slider + input */}
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={0}
          max={maxMark}
          step={0.5}
          value={score || 0}
          onChange={e => setScore(e.target.value)}
          className="flex-1 accent-violet-600"
        />
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={maxMark}
            step={0.5}
            value={score}
            onChange={e => setScore(e.target.value)}
            className="w-16 text-center border border-violet-300 rounded-lg py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <span className="text-sm text-slate-500 font-medium">/ {maxMark}</span>
        </div>
      </div>

      {/* Quick mark buttons */}
      <div className="flex gap-2 flex-wrap">
        {[0, Math.round(maxMark * 0.25 * 2) / 2, Math.round(maxMark * 0.5 * 2) / 2, Math.round(maxMark * 0.75 * 2) / 2, maxMark].filter((v, i, a) => a.indexOf(v) === i).map(v => (
          <button key={v} onClick={() => setScore(String(v))}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              parseFloat(score) === v
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
            }`}>
            {v}
          </button>
        ))}
      </div>

      {/* Optional feedback */}
      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="Add feedback for student (optional)…"
        rows={2}
        className="w-full px-3 py-2 border border-violet-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none bg-white"
      />

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || score === '' || isNaN(parseFloat(score))}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Score
        </button>
        {isGraded && (
          <button onClick={() => { setScore(String(currentScore ?? '')); setEditing(false); }}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-white transition-colors">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function MarkingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const attemptId = params?.attemptId as string;

  const [data, setData] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<TabType>('objective');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savingAnswer, setSavingAnswer] = useState<string | null>(null); // question_number of saving item
  const [errorModal, setErrorModal] = useState<string | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    loadData();
  }, [attemptId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/api/assessment/student/exam-result/${attemptId}/`);
      setData(r.data);
      // Set initial tab to first available
      const answers = r.data.answers as AnswerItem[];
      if (answers.some(a => a.question_type === 'objective')) setActiveTab('objective');
      else if (answers.some(a => a.question_type === 'theory')) setActiveTab('theory');
      else if (answers.some(a => a.question_type === 'subjective')) setActiveTab('subjective');
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveScore = async (answer: AnswerItem, score: number, feedback: string) => {
    setSavingAnswer(answer.question_number);
    try {
      await api.post('/api/assessment/teacher/mark-answer/', {
        answer_id: answer.answer_id,
        score: score,
        feedback: feedback || undefined,
      });
      // Refresh data to update scores
      await loadData();
    } catch (err: any) {
      setErrorModal(extractError(err));
    } finally {
      setSavingAnswer(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading answers…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Failed to Load</h2>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const allAnswers = data.answers;
  const objAnswers = allAnswers.filter(a => a.question_type === 'objective');
  const theoryAnswers = allAnswers.filter(a => a.question_type === 'theory');
  const subjAnswers = allAnswers.filter(a => a.question_type === 'subjective');

  const availableTabs: TabType[] = [
    ...(objAnswers.length > 0 ? ['objective' as TabType] : []),
    ...(theoryAnswers.length > 0 ? ['theory' as TabType] : []),
    ...(subjAnswers.length > 0 ? ['subjective' as TabType] : []),
  ];

  const tabAnswers: Record<TabType, AnswerItem[]> = {
    objective: objAnswers,
    theory: theoryAnswers,
    subjective: subjAnswers,
  };
  const currentTabAnswers = tabAnswers[activeTab] ?? [];
  const currentAnswer = currentTabAnswers[currentIndex] ?? null;

  const tabLabel: Record<TabType, string> = { objective: 'Objective', theory: 'Theory', subjective: 'Subjective' };
  const tabIcon: Record<TabType, React.ReactNode> = {
    objective: <List className="h-3.5 w-3.5" />,
    theory: <PenLine className="h-3.5 w-3.5" />,
    subjective: <FileText className="h-3.5 w-3.5" />,
  };

  const pendingInTab = currentTabAnswers.filter(a => !a.is_graded).length;
  const totalScore = data.attempt.total_score;
  const pct = data.attempt.percentage;

  return (
    <div className="space-y-5 pb-8">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors mt-0.5 flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-slate-900">{data.exam_details.name}</h1>
            <span className="text-slate-400">·</span>
            <span className="text-sm text-slate-600">{data.exam_details.subject}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center">
                <User className="h-3 w-3 text-violet-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                {data.attempt.student_name || `Attempt ${attemptId.slice(0, 8)}…`}
              </span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {data.statistics.graded}/{data.statistics.total_questions} graded
            </span>
            {totalScore != null && (
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                (pct ?? 0) >= 70 ? 'bg-emerald-50 text-emerald-700'
                : (pct ?? 0) >= 50 ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-600'
              }`}>
                {totalScore} / {data.exam_details.total_marks} ({pct}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab switcher ── */}
      {availableTabs.length > 1 && (
        <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
          {availableTabs.map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setCurrentIndex(0); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {tabIcon[tab]}
              {tabLabel[tab]}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {tabAnswers[tab].length}
              </span>
              {tab !== 'objective' && tabAnswers[tab].filter(a => !a.is_graded).length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {currentAnswer ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Question navigator sidebar ── */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:sticky lg:top-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Questions</p>
              <div className="grid grid-cols-6 gap-1.5 mb-4">
                {currentTabAnswers.map((a, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isGraded = a.is_graded;
                  const isLowConf = a.grading_method === 'ai' && (a.ai_confidence ?? 1) < 0.7;
                  return (
                    <button key={idx} onClick={() => setCurrentIndex(idx)}
                      title={`Q${idx + 1} — ${isGraded ? 'Graded' : 'Pending'}`}
                      className={`aspect-square rounded-lg text-xs font-bold transition-all relative ${
                        isCurrent
                          ? 'bg-violet-600 text-white shadow-md scale-110'
                          : isLowConf
                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                          : isGraded
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                      {idx + 1}
                      {isLowConf && !isCurrent && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400" />
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Legend */}
              <div className="space-y-1.5 text-xs border-t border-slate-100 pt-3">
                {[
                  { color: 'bg-violet-600', label: 'Current' },
                  { color: 'bg-emerald-100 border border-emerald-300', label: `Graded (${currentTabAnswers.filter(a => a.is_graded).length})` },
                  { color: 'bg-orange-100 border border-orange-300', label: 'Review needed' },
                  { color: 'bg-slate-100 border border-slate-200', label: `Pending (${pendingInTab})` },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${item.color} flex-shrink-0`} />
                    <span className="text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Answer card ── */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              {/* Card header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center text-xs font-bold">
                    {currentIndex + 1}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    currentAnswer.question_type === 'objective' ? 'bg-blue-100 text-blue-700'
                    : currentAnswer.question_type === 'theory' ? 'bg-violet-100 text-violet-700'
                    : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {currentAnswer.question_type}
                  </span>
                  <span className="text-xs text-slate-400">{currentAnswer.max_mark} mark{currentAnswer.max_mark !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} disabled={currentIndex === 0}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs text-slate-400 px-1">{currentIndex + 1}/{currentTabAnswers.length}</span>
                  <button onClick={() => setCurrentIndex(i => Math.min(currentTabAnswers.length - 1, i + 1))} disabled={currentIndex === currentTabAnswers.length - 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">

                {/* Question text */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Question</p>
                  <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">{currentAnswer.question_text}</p>
                  {(currentAnswer.question_image || currentAnswer.image || currentAnswer.image_url) && (
                    <img
                      src={getImageUrl(currentAnswer.question_image || currentAnswer.image || currentAnswer.image_url || '') || ''}
                      alt="Question image"
                      className="mt-3 max-h-48 w-auto rounded-xl border border-slate-200 object-contain"
                    />
                  )}
                </div>

                {/* ── OBJECTIVE ── */}
                {currentAnswer.question_type === 'objective' && currentAnswer.options && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Options</p>
                    {Object.entries(currentAnswer.options).map(([key, val]) => {
                      const isCorrect = key === currentAnswer.correct_answer;
                      const isSelected = key === currentAnswer.selected_option;
                      return (
                        <div key={key} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                          isCorrect && isSelected ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                          : isCorrect ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : isSelected ? 'bg-red-50 border-red-200 text-red-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          <span className="font-bold flex-shrink-0 w-5">{key}.</span>
                          <span className="flex-1">{val}</span>
                          {isCorrect && <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />}
                          {isSelected && !isCorrect && <X className="h-4 w-4 text-red-500 flex-shrink-0" />}
                        </div>
                      );
                    })}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                      currentAnswer.is_correct ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {currentAnswer.is_correct
                        ? <><CheckCircle2 className="h-4 w-4" /> Correct — {currentAnswer.max_mark} mark{currentAnswer.max_mark !== 1 ? 's' : ''}</>
                        : <><X className="h-4 w-4" /> Incorrect — 0 marks</>
                      }
                    </div>
                  </div>
                )}

                {/* ── THEORY / SUBJECTIVE ── */}
                {(currentAnswer.question_type === 'theory' || currentAnswer.question_type === 'subjective') && (
                  <>
                    {/* Model answer */}
                    {currentAnswer.model_answer && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-blue-600" />
                          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Model Answer / Marking Scheme</p>
                        </div>
                        <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-wrap">{currentAnswer.model_answer}</p>
                      </div>
                    )}

                    {/* Student answer */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-slate-500" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Student's Answer</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[80px]">
                        {currentAnswer.answer_text ? (
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{currentAnswer.answer_text}</p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No answer provided</p>
                        )}
                      </div>
                    </div>

                    {/* AI feedback (if exists) */}
                    {currentAnswer.ai_feedback && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Brain className="h-4 w-4 text-blue-600" />
                          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">AI Feedback</p>
                          {currentAnswer.ai_confidence != null && (
                            <span className={`text-xs font-medium ml-auto ${confidenceLabel(currentAnswer.ai_confidence).cls}`}>
                              {confidenceLabel(currentAnswer.ai_confidence).label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-blue-900 leading-relaxed">{currentAnswer.ai_feedback}</p>
                      </div>
                    )}

                    {/* Score input */}
                    <ScoreInput
                      answerId={`${currentAnswer.question_number}-${currentAnswer.sub_question_number}`}
                      maxMark={currentAnswer.max_mark}
                      currentScore={currentAnswer.score_awarded}
                      isGraded={currentAnswer.is_graded}
                      gradingMethod={currentAnswer.grading_method}
                      aiConfidence={currentAnswer.ai_confidence}
                      onSave={(score, feedback) => handleSaveScore(currentAnswer, score, feedback)}
                      saving={savingAnswer === currentAnswer.question_number}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">All {tabLabel[activeTab]} questions are graded</p>
        </div>
      )}

      {/* Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">Save Failed</h3>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">{errorModal}</p>
            <button
              onClick={() => setErrorModal(null)}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}