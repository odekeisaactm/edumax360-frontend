'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWard } from '@/context/WardContext';
import { academicCalendarAPI } from '@/lib/api';
import {
  Calendar, Layers, Loader2, Search,
  GraduationCap, ArrowRight, Award, Info
} from 'lucide-react';

export default function ParentCumulativeSelectionPage() {
  const router = useRouter();
  const { selectedWard, loading: wardLoading } = useWard();

  // ── Data States ──
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingPeriods, setLoadingPeriods] = useState(false);

  // ── Form States ──
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // The cumulative result is tied to the last term of the selected session
  const finalPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

  // 1. Initial Load: Fetch Sessions
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

  // 2. Load Periods whenever Session changes (to find the final term)
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
      } catch (err) {
        console.error("Failed to load periods", err);
      } finally {
        setLoadingPeriods(false);
      }
    };

    fetchPeriods();
  }, [selectedSessionId]);

  // 3. Route directly to view page (Security & Fee checks happen there)
  const handleViewCumulative = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finalPeriod || !selectedWard || !selectedSessionId) return;

    // Route to the cumulative view using the session ID
    router.push(`/dashboard/parent/result/cumulative/view?session_id=${selectedSessionId}`);
  };

  if (wardLoading || loadingInitial) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-sm font-medium text-slate-500">Preparing cumulative gateway...</p>
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

      {/* ── Compact Banner ── */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-950 rounded-3xl p-4 sm:p-6 shadow-xl shadow-emerald-900/20 flex items-center gap-4 relative z-20">
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner flex-shrink-0 overflow-hidden">
          {selectedWard.image_url ? (
            <img src={selectedWard.image_url} alt={wardName} className="w-full h-full object-cover" />
          ) : (
            <Layers className="h-7 w-7 text-emerald-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight truncate capitalize">
            {wardName}
          </h1>
          <p className="text-emerald-200 text-xs sm:text-sm font-medium truncate mt-0.5">
            {selectedWard.current_class_name} {selectedWard.current_class_section_name ? `· ${selectedWard.current_class_section_name}` : ''} • {selectedWard.registration_number}
          </p>
        </div>
      </div>

      {/* ── Selection Form Card ── */}
      <form onSubmit={handleViewCumulative} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative z-10">
        <div className="p-5 sm:p-8 space-y-6">

          <div className="flex items-start gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-2xl border border-emerald-100 mb-2">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <p className="text-sm font-medium leading-relaxed">
              Cumulative results aggregate performance across all terms in an academic session. They are typically only available at the end of the year.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Academic Session
              </label>
              <select
                required
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
                className="w-full px-4 py-3 text-sm font-semibold border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white text-slate-700 hover:border-emerald-300 transition-colors"
              >
                <option value="">Select Session...</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5" /> Evaluated Final Term
              </label>
              <div className="w-full px-4 py-3 text-sm font-semibold border border-slate-200 bg-slate-50 rounded-xl text-slate-500 flex items-center gap-2">
                {loadingPeriods ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying terms...</>
                ) : finalPeriod ? (
                  finalPeriod.period?.name || finalPeriod.name
                ) : (
                  'Awaiting session selection'
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ── Footer Actions ── */}
        <div className="px-5 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={!finalPeriod}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-200"
          >
            <Search className="w-4 h-4" />
            Check Cumulative
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </form>

    </div>
  );
}