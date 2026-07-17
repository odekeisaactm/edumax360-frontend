'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWard } from '@/context/WardContext';
import { academicCalendarAPI, api } from '@/lib/api';
import {
  Award, Calendar, Clock, Layers, Loader2,
  Search, GraduationCap, UserCircle, ArrowRight,
  X, CheckCircle2, AlertTriangle, AlertCircle
} from 'lucide-react';

// ─── Toasts & Error Handling ──────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'Results have not been published for this term yet.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
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

export default function ParentResultSelectionPage() {
  const router = useRouter();
  const { selectedWard, loading: wardLoading } = useWard();

  // ── Data States ──
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [checkingResult, setCheckingResult] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ── Form States ──
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [termType, setTermType] = useState<'midterm' | 'end_of_term'>('end_of_term');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // 1. Initial Load: Fetch Sessions & Current Session
  useEffect(() => {
    const fetchDefaults = async () => {
      setLoadingInitial(true);
      try {
        const [sessData, currentSess] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession()
        ]);

        setSessions(sessData || []);

        if (currentSess?.id) {
          setSelectedSessionId(String(currentSess.id));
        }
      } catch (err) {
        console.error("Failed to load sessions", err);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchDefaults();
  }, []);

  // 2. Load Periods whenever Session changes
  useEffect(() => {
    if (!selectedSessionId) {
      setPeriods([]);
      return;
    }

    const fetchPeriods = async () => {
      setLoadingPeriods(true);
      try {
        const pers = await academicCalendarAPI.listSessionPeriods({ session_id: Number(selectedSessionId) });
        setPeriods(pers || []);

        // Find the period flagged as current in the returned data
        const currentPeriod = pers.find((p: any) => p.is_current === true);

        if (currentPeriod) {
          setSelectedPeriodId(String(currentPeriod.id));
        } else if (pers.length > 0) {
          setSelectedPeriodId(String(pers[pers.length - 1].id));
        }

      } catch (err) {
        console.error("Failed to load periods", err);
      } finally {
        setLoadingPeriods(false);
      }
    };

    fetchPeriods();
  }, [selectedSessionId]);

  // 3. Handle View Result (Pre-check publication status)
  const handleViewResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId || !selectedWard) return;

    setCheckingResult(true);
    try {
      // We ping the print-data endpoint. If it is unpublished, the backend will block it and throw an error.
      await api.get('/api/result/detail/print-data/', {
        params: {
          student_id: selectedWard.id,
          period_id: selectedPeriodId,
          comment_type: termType,
        },
      });

      // If the request succeeds, it means it's published and accessible. Route to the view page!
      router.push(`/dashboard/parent/result/view?period=${selectedPeriodId}&type=${termType}`);
    } catch (err: any) {
      // The backend blocked it (e.g. 403 Forbidden or 400 Validation Error)
      showToast('error', extractError(err));
    } finally {
      setCheckingResult(false);
    }
  };

  if (wardLoading || loadingInitial) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-500">Preparing result gateway...</p>
      </div>
    );
  }

  if (!selectedWard) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <GraduationCap className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-xl font-black text-slate-800">No Ward Selected</h3>
        <p className="text-slate-500 max-w-xs mt-2">Please select a child from the top menu to view results.</p>
      </div>
    );
  }

  const wardName = selectedWard.full_name || `${selectedWard.first_name || ''} ${selectedWard.last_name || ''}`.trim();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* ── Page Header ── */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0">
          <Award className="h-10 w-10 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Academic Results</h1>
          <p className="text-indigo-200 mt-1 font-medium">Check terminal performance, grades, and teacher remarks.</p>
        </div>
      </div>

      {/* ── Selection Form Card ── */}
      <form onSubmit={handleViewResult} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
        {/* Accent Top Border */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />

        <div className="p-6 sm:p-8">

          {/* Target Student Identity */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl mb-8">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden flex-shrink-0">
              {selectedWard.image_url ? (
                <img src={selectedWard.image_url} alt={wardName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-50 font-bold text-indigo-400 text-lg">
                  {wardName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Checking results for</p>
              <p className="text-sm font-black text-slate-800 capitalize">{wardName}</p>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {selectedWard.current_class_name} {selectedWard.current_class_section_name ? `· ${selectedWard.current_class_section_name}` : ''} • {selectedWard.registration_number}
              </p>
            </div>
          </div>

          <div className="space-y-6">

            {/* Session & Term Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Academic Session
                </label>
                <select
                  required
                  value={selectedSessionId}
                  onChange={e => setSelectedSessionId(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-semibold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white text-slate-700"
                >
                  <option value="">Select Session...</option>
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Term / Period
                </label>
                <select
                  required
                  disabled={!selectedSessionId || loadingPeriods}
                  value={selectedPeriodId}
                  onChange={e => setSelectedPeriodId(e.target.value)}
                  className="w-full px-4 py-3 text-sm font-semibold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white text-slate-700 disabled:opacity-50 disabled:bg-slate-50"
                >
                  <option value="">{loadingPeriods ? 'Loading terms...' : 'Select Term...'}</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Term Type Toggles */}
            <div className="pt-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Assessment Type
              </label>
              <div className="flex gap-4">
                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all flex-1 ${
                    termType === 'end_of_term'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="termType"
                    value="end_of_term"
                    checked={termType === 'end_of_term'}
                    onChange={() => setTermType('end_of_term')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-600 accent-indigo-600"
                  />
                  <div>
                    <p className={`text-sm font-bold ${termType === 'end_of_term' ? 'text-indigo-900' : 'text-slate-700'}`}>End of Term</p>
                    <p className={`text-xs mt-0.5 ${termType === 'end_of_term' ? 'text-indigo-600/70' : 'text-slate-400'}`}>Full continuous assessment & exams</p>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all flex-1 ${
                    termType === 'midterm'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm'
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="termType"
                    value="midterm"
                    checked={termType === 'midterm'}
                    onChange={() => setTermType('midterm')}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-600 accent-indigo-600"
                  />
                  <div>
                    <p className={`text-sm font-bold ${termType === 'midterm' ? 'text-indigo-900' : 'text-slate-700'}`}>Midterm</p>
                    <p className={`text-xs mt-0.5 ${termType === 'midterm' ? 'text-indigo-600/70' : 'text-slate-400'}`}>Half-term continuous assessment only</p>
                  </div>
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 hidden sm:block">
            Results are published securely.
          </p>
          <button
            type="submit"
            disabled={!selectedPeriodId || checkingResult}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            {checkingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {checkingResult ? 'Verifying...' : 'Check Result'}
            {!checkingResult && <ArrowRight className="w-4 h-4 ml-1" />}
          </button>
        </div>
      </form>

    </div>
  );
}