'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWard } from '@/context/WardContext';
import { academicCalendarAPI } from '@/lib/api';
import {
  Award, Calendar, Clock, Layers, Loader2,
  Search, GraduationCap, ArrowRight
} from 'lucide-react';

export default function ParentResultSelectionPage() {
  const router = useRouter();
  const { selectedWard, loading: wardLoading } = useWard();

  // ── Data States ──
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  // ── Form States ──
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [termType, setTermType] = useState<'midterm' | 'end_of_term'>('end_of_term');

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

  // 3. Route directly to view page (Security & Fee checks happen there)
  const handleViewResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId || !selectedWard) return;
    router.push(`/dashboard/parent/result/view?period=${selectedPeriodId}&type=${termType}`);
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
    <div className="max-w-3xl mx-auto space-y-4 pb-10">

      {/* ── Compact Banner WITHOUT Redundant Switcher ── */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-4 sm:p-6 shadow-xl shadow-slate-200 flex items-center gap-4 relative z-20">
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0 overflow-hidden">
          {selectedWard.image_url ? (
            <img src={selectedWard.image_url} alt={wardName} className="w-full h-full object-cover" />
          ) : (
            <Award className="h-7 w-7 text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight truncate capitalize">
            {wardName}
          </h1>
          <p className="text-indigo-200 text-xs sm:text-sm font-medium truncate mt-0.5">
            {selectedWard.current_class_name} {selectedWard.current_class_section_name ? `· ${selectedWard.current_class_section_name}` : ''} • {selectedWard.registration_number}
          </p>
        </div>
      </div>

      {/* ── Selection Form Card ── */}
      <form onSubmit={handleViewResult} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative z-10">
        <div className="p-5 sm:p-8 space-y-6">

          {/* Session & Term Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Academic Session
              </label>
              <select
                required
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                className="w-full px-4 py-3 text-sm font-semibold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white text-slate-700 hover:border-indigo-300 transition-colors"
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
                className="w-full px-4 py-3 text-sm font-semibold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white text-slate-700 disabled:opacity-50 disabled:bg-slate-50 hover:border-indigo-300 transition-colors"
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
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                  <p className={`text-[11px] mt-0.5 ${termType === 'end_of_term' ? 'text-indigo-600/70' : 'text-slate-400'}`}>Full continuous assessment & exams</p>
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
                  <p className={`text-[11px] mt-0.5 ${termType === 'midterm' ? 'text-indigo-600/70' : 'text-slate-400'}`}>Half-term continuous assessment only</p>
                </div>
              </label>
            </div>
          </div>

        </div>

        {/* ── Footer Actions ── */}
        <div className="px-5 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={!selectedPeriodId}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-200"
          >
            <Search className="w-4 h-4" />
            Check Result
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </form>

    </div>
  );
}