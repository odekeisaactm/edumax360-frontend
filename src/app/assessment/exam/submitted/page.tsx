'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  CheckCircle2, Clock, AlertCircle, Home, FileText,
  AlertTriangle, Copy, Check, RefreshCw, Loader2,
  Shield, Trophy, Hourglass,
} from 'lucide-react';
import type { ExamResultResponse } from '@/lib/assessment.types';

// ─── Types ─────────────────────────────────────────────────────────────────────

type FetchState = 'loading' | 'loaded' | 'unavailable' | 'not_found';
type VisualState = 'error' | 'flagged' | 'auto' | 'success';

// ─── Main Component ────────────────────────────────────────────────────────────

function ExamSubmittedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const attemptId   = searchParams?.get('attempt');
  const autoSubmit  = searchParams?.get('auto') === 'true';
  const submitError = searchParams?.get('error') === 'true';

  // ── Fetch state ──
  const [result, setResult]       = useState<ExamResultResponse | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [refreshKey, setRefreshKey] = useState(0);

  // ── UI state ──
  const [copied, setCopied]         = useState(false);
  const [retrying, setRetrying]     = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const autoRetriedRef              = useRef(false);

  // ── Fetch attempt details ──
  useEffect(() => {
    if (!attemptId) { setFetchState('not_found'); return; }
    let cancelled = false;
    setFetchState('loading');
    api.get(`/api/assessment/student/exam-result/${attemptId}/`)
      .then(res => {
        if (cancelled) return;
        setResult(res.data);
        setFetchState('loaded');
      })
      .catch(err => {
        if (cancelled) return;
        if (err?.response?.status === 404) setFetchState('not_found');
        else setFetchState('unavailable');
      });
    return () => { cancelled = true; };
  }, [attemptId, refreshKey]);

  // ── Copy reference ──
  const copyAttemptId = useCallback(async () => {
    if (!attemptId) return;
    try {
      await navigator.clipboard.writeText(attemptId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [attemptId]);

  // ── Retry submission ──
  const retrySubmission = useCallback(async () => {
    if (!attemptId || retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await api.post(`/api/assessment/exam-attempts/${attemptId}/submit/`, {
        auto_submit: autoSubmit,
      });
      // Success — clean URL
      setRefreshKey(k => k + 1);
      router.replace(`/assessment/exam/submitted?attempt=${attemptId}${autoSubmit ? '&auto=true' : ''}`);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg    = err?.response?.data?.error || '';
      // 400 "already submitted" / "invalid status" → treat as success
      if (status === 400 && /invalid status|already/i.test(msg)) {
        setRefreshKey(k => k + 1);
        router.replace(`/assessment/exam/submitted?attempt=${attemptId}${autoSubmit ? '&auto=true' : ''}`);
      } else {
        setRetryError(msg || 'Could not confirm submission. Please contact your invigilator.');
      }
    } finally {
      setRetrying(false);
    }
  }, [attemptId, autoSubmit, retrying, router]);

  // ── Auto-retry once on mount if error flag is present ──
  useEffect(() => {
    if (submitError && attemptId && !autoRetriedRef.current) {
      autoRetriedRef.current = true;
      retrySubmission();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitError, attemptId]);

  // ── Auto-clean URL if server says the attempt is actually submitted ──
  const serverSaysSubmitted =
    result?.attempt?.status === 'submitted' ||
    result?.attempt?.status === 'auto_submitted';

  useEffect(() => {
    if (submitError && serverSaysSubmitted) {
      router.replace(`/assessment/exam/submitted?attempt=${attemptId}${autoSubmit ? '&auto=true' : ''}`);
    }
  }, [submitError, serverSaysSubmitted, attemptId, autoSubmit, router]);

  // ── Dashboard nav ──
  const handleGoDashboard = () => {
    if (!user) { router.push('/assessment/exam-entry'); return; }
    if (user.user_type === 'student') router.push('/dashboard/student');
    else router.push('/dashboard');
  };

  // ── Derived ──
  const realSubmittedAt = result?.attempt?.submitted_at ?? null;
  const isFlagged       = result?.attempt?.is_flagged_for_review ?? false;
  const pending         = result?.statistics?.pending ?? 0;
  const totalScore      = result?.attempt?.total_score ?? null;
  const percentage      = result?.attempt?.percentage ?? null;
  const totalMarks      = result?.exam_details?.total_marks ?? null;
  const examName        = result?.exam_details?.name ?? null;
  const subject         = result?.exam_details?.subject ?? null;

  const gradingComplete = result !== null && pending === 0;
  const scoreAvailable  = gradingComplete && totalScore !== null && percentage !== null;

  // Effective error: URL says error, but if server confirms submitted, trust server
  const effectiveSubmitError = submitError && !serverSaysSubmitted;

  // ── Visual state priority ──
  const visualState: VisualState = effectiveSubmitError
    ? 'error'
    : isFlagged
    ? 'flagged'
    : autoSubmit
    ? 'auto'
    : 'success';

  const stateConfig = {
    error: {
      bg: 'bg-red-50', iconBg: 'bg-red-100',
      titleColor: 'text-red-900', subtitleColor: 'text-red-700',
      icon: <AlertCircle className="h-10 w-10 text-red-600" />,
      title: 'Submission Unconfirmed',
      subtitle: 'We could not confirm your exam submission',
    },
    flagged: {
      bg: 'bg-amber-50', iconBg: 'bg-amber-100',
      titleColor: 'text-amber-900', subtitleColor: 'text-amber-700',
      icon: <Shield className="h-10 w-10 text-amber-600" />,
      title: 'Submission Under Review',
      subtitle: 'Your answers have been recorded but are pending review',
    },
    auto: {
      bg: 'bg-amber-50', iconBg: 'bg-amber-100',
      titleColor: 'text-amber-900', subtitleColor: 'text-amber-700',
      icon: <Clock className="h-10 w-10 text-amber-600" />,
      title: 'Time Expired — Auto-Submitted',
      subtitle: 'Your exam was submitted automatically at the time limit',
    },
    success: {
      bg: 'bg-green-50', iconBg: 'bg-green-100',
      titleColor: 'text-green-900', subtitleColor: 'text-green-700',
      icon: <CheckCircle2 className="h-10 w-10 text-green-600" />,
      title: 'Exam Submitted Successfully!',
      subtitle: 'Your answers have been recorded and submitted',
    },
  }[visualState];

  const formatSubmittedAt = (iso: string | null): string | null => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleString(undefined, {
        weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return null; }
  };

  // ── Invalid reference page ──
  if (fetchState === 'not_found') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Reference</h1>
          <p className="text-sm text-slate-500 mb-6">
            We couldn&apos;t find an exam attempt with the reference provided.
            If you just submitted, please contact your invigilator with your
            attempt reference.
          </p>
          <div className="flex gap-3">
            <button onClick={() => router.push('/assessment/exam-entry')}
              className="flex-1 px-4 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors text-sm">
              Back to Entry
            </button>
            <button onClick={handleGoDashboard}
              className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors text-sm">
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">

          {/* ── Header ── */}
          <div className={`px-6 sm:px-8 py-6 ${stateConfig.bg}`}>
            <div className="flex items-center justify-center mb-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${stateConfig.iconBg}`}>
                {stateConfig.icon}
              </div>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-bold text-center ${stateConfig.titleColor}`}>
              {stateConfig.title}
            </h1>
            <p className={`text-center mt-2 ${stateConfig.subtitleColor}`}>
              {stateConfig.subtitle}
            </p>
            {(examName || subject) && (
              <p className="text-center text-xs text-slate-500 mt-2">
                {subject}{subject && examName ? ' · ' : ''}{examName}
              </p>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">

            {/* ── ERROR: retry panel ── */}
            {effectiveSubmitError && (
              <div className="border-2 border-red-200 bg-red-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 mb-1">Your submission is not confirmed</h3>
                    <p className="text-sm text-red-800">
                      The submission request failed. Your answers were being saved
                      locally, but we couldn&apos;t confirm them with the server.
                      Try again now — or show this reference to your invigilator
                      immediately.
                    </p>
                  </div>
                </div>
                {retryError && (
                  <p className="text-sm text-red-800 bg-white/60 rounded-lg px-3 py-2">{retryError}</p>
                )}
                <button
                  onClick={retrySubmission}
                  disabled={retrying}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                  {retrying ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Retrying…</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" /> Retry Submission</>
                  )}
                </button>
              </div>
            )}

            {/* ── Attempt reference ── */}
            <div className={`rounded-xl p-4 ${effectiveSubmitError ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm text-gray-600">Submission Reference</p>
                {attemptId && (
                  <button onClick={copyAttemptId}
                    className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors">
                    {copied
                      ? <><Check className="h-3 w-3" /> Copied</>
                      : <><Copy className="h-3 w-3" /> Copy</>}
                  </button>
                )}
              </div>
              <code className={`text-sm sm:text-base font-mono font-bold break-all ${effectiveSubmitError ? 'text-red-900' : 'text-gray-900'}`}>
                {attemptId || 'N/A'}
              </code>
              {effectiveSubmitError && (
                <p className="text-xs text-red-700 mt-2">
                  Keep this reference. Your invigilator can use it to recover your answers.
                </p>
              )}
            </div>

            {/* ── Score (if available) ── */}
            {fetchState === 'loaded' && result && !effectiveSubmitError && (
              <>
                {scoreAvailable ? (
                  <div className="rounded-xl p-5 bg-gradient-to-br from-violet-50 to-indigo-50 border-2 border-violet-200">
                    <div className="flex items-center justify-center mb-3">
                      <Trophy className="h-8 w-8 text-violet-600" />
                    </div>
                    <p className="text-center text-sm font-medium text-violet-700 mb-1">Your Score</p>
                    <p className="text-center text-4xl font-bold text-violet-900">
                      {Number(percentage).toFixed(1)}%
                    </p>
                    {totalMarks !== null && (
                      <p className="text-center text-sm text-violet-600 mt-1">
                        {Number(totalScore).toFixed(1)} / {totalMarks} marks
                      </p>
                    )}
                  </div>
                ) : !gradingComplete ? (
                  <div className="rounded-xl p-4 bg-blue-50 border border-blue-200 flex items-start gap-3">
                    <Hourglass className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">Grading in progress</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        {pending} answer{pending !== 1 ? 's' : ''} pending review.
                        Your final score will appear once marking is complete.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
                    <p className="text-sm text-slate-600 text-center">
                      Your score will appear here once released by your teacher.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── Flagged notice ── */}
            {isFlagged && !effectiveSubmitError && (
              <div className="border-2 border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                <Shield className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-900 mb-1">Submission under review</h3>
                  <p className="text-sm text-amber-800">
                    Some activity during your exam was flagged for review by your
                    teacher. Your answers are saved. You may be contacted for
                    clarification.
                  </p>
                </div>
              </div>
            )}

            {/* ── Info panel ── */}
            {!effectiveSubmitError && (
              <div className={`border-2 rounded-xl p-4 ${
                visualState === 'flagged' || visualState === 'auto'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                    visualState === 'flagged' || visualState === 'auto'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                  }`} />
                  <div>
                    <h3 className={`font-bold mb-2 ${
                      visualState === 'flagged' || visualState === 'auto'
                        ? 'text-amber-900'
                        : 'text-blue-900'
                    }`}>
                      Important Information
                    </h3>
                    <ul className={`text-sm space-y-1.5 ${
                      visualState === 'flagged' || visualState === 'auto'
                        ? 'text-amber-800'
                        : 'text-blue-800'
                    }`}>
                      <li>✓ Your submission has been recorded</li>
                      <li>✓ You cannot access or modify this exam anymore</li>
                      <li>✓ Your teacher will grade your answers</li>
                      <li>✓ Results will be available once marking is complete</li>
                      {autoSubmit && <li>✓ All answers saved up to the time limit were submitted</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* ── Next steps ── */}
            {!effectiveSubmitError && (
              <div>
                <h3 className="font-bold text-gray-900 mb-3">What happens next?</h3>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'Teacher Grades Answers', desc: 'Your teacher will review and mark your exam responses' },
                    { step: '2', title: 'Results Published',      desc: 'Once marking is complete, your results will be made available' },
                    { step: '3', title: 'View Your Performance',  desc: 'Check your student dashboard for results and feedback' },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-violet-600">{step}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{title}</p>
                        <p className="text-sm text-gray-600">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Actions ── */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button onClick={handleGoDashboard}
                className="flex-1 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 flex items-center justify-center gap-2 transition-colors">
                <Home className="h-5 w-5" />
                Go to Dashboard
              </button>
              <button onClick={() => router.push('/assessment/exam-entry')}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 flex items-center justify-center gap-2 transition-colors">
                <FileText className="h-5 w-5" />
                Back to Exam Entry
              </button>
            </div>
          </div>
        </div>

        {/* ── Footer — real timestamp or neutral message, never a lie ── */}
        <div className="mt-6 text-center">
          {realSubmittedAt ? (
            <p className="text-sm text-gray-600 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full inline-block">
              Submitted on {formatSubmittedAt(realSubmittedAt)}
            </p>
          ) : autoSubmit ? (
            <p className="text-sm text-gray-600 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full inline-block">
              Auto-submitted at the exam time limit
            </p>
          ) : !effectiveSubmitError ? (
            <p className="text-sm text-gray-600 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-full inline-block">
              Your submission has been recorded
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ExamSubmittedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Clock className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    }>
      <ExamSubmittedPageInner />
    </Suspense>
  );
}