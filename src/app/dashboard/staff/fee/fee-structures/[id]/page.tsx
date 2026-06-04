'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI } from '@/lib/api';
import { FeeStructure, AcademicSessionPeriod, Fee, Session } from '@/lib/types';
import {
  ArrowLeft, Check, X, AlertCircle, Loader2,
  DollarSign, Calendar, Info, Layers, Save,
  Zap, Clock, BarChart3, TrendingUp, Box,
} from 'lucide-react';

// ─── Style Helpers ───────────────────────────────────────────────────────────

const inputCls = 'w-full px-4 py-3 border border-slate-200 rounded-xl text-base font-bold focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 text-slate-800 bg-white transition-all text-right pr-12';

const fmt = (v: string | number = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
            ${t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span className="text-sm font-medium whitespace-pre-line">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Page ───────────────────────────────────────────────────────────────

export default function FeeStructurePricingPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNew = searchParams.get('new') === 'true';
  const { user } = useAuth();
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const showToast = (type: Toast['type'], message: string) => {
    const tid = ++counter.current;
    setToasts(p => [...p, { id: tid, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== tid)), 5000);
  };

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [structure, setStructure] = useState<FeeStructure | null>(null);
  const [feeBlueprint, setFeeBlueprint] = useState<Fee | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const structId = parseInt(id as string);
      
      // 1. Load basic structure + all sessions
      const [sData, sessionsData, feesData] = await Promise.all([
        feeAPI.getFeeStructure(structId),
        academicCalendarAPI.listSessions(),
        feeAPI.getFees(),
      ]);
      
      setStructure(sData);
      const blueprint = feesData.find((f: Fee) => f.id === sData.fee) || null;
      setFeeBlueprint(blueprint);

      // 2. Identify Active Session
      const current = sessionsData.find((s: Session) => s.is_active);
      if (!current) {
        showToast('error', 'No active Academic Session found. Configure a session first.');
        setLoading(false);
        return;
      }
      setActiveSession(current);

      // 3. Load Session Periods for the Active Session
      // Note: Backend 'ensure_active_session_periods_exist' was triggered by 'getFeeStructure' call.
      const pData = await academicCalendarAPI.listSessionPeriods({ session_id: current.id });
      
      // Filter out duplicate periods if multiple school sections exist 
      // (Bursars set master price for the 'Global' section/all sections).
      const uniquePeriods = pData.filter(p => !p.school_section);
      setPeriods(uniquePeriods.sort((a, b) => (a.period?.order || 0) - (b.period?.order || 0)));

      // 4. Initialize amounts from existing data
      const initialAmounts: Record<number, string> = {};
      sData.period_amounts?.forEach((pa: { period: number; amount: string }) => {
        initialAmounts[pa.period] = pa.amount;
      });
      setAmounts(initialAmounts);

    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleAmountChange = (periodId: number, val: string) => {
    setAmounts(prev => ({ ...prev, [periodId]: val }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const data = Object.entries(amounts)
        .filter(([_, amt]) => amt !== '' && parseFloat(amt) >= 0)
        .map(([pid, amt]) => ({
          period: parseInt(pid),
          amount: amt
        }));

      await feeAPI.setPeriodAmounts(parseInt(id as string), data);
      showToast('success', 'Pricing matrix updated successfully');
      
      if (isNew) {
         router.push('/dashboard/staff/fee/fee-structures');
      }
    } catch (err: any) {
      showToast('error', err.response?.data?.detail || 'Save failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-[500px] flex flex-col items-center justify-center gap-6">
      <div className="relative">
        <Loader2 className="h-14 w-14 text-emerald-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
           <DollarSign className="h-5 w-5 text-emerald-600 font-bold" />
        </div>
      </div>
      <p className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">Synchronizing Pricing Matrix...</p>
    </div>
  );

  if (!structure || !feeBlueprint || !activeSession) return (
    <div className="p-16 text-center bg-white rounded-[32px] border border-slate-100 shadow-sm">
       <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
       <h2 className="text-2xl font-black text-slate-800 tracking-tight">Configuration Error</h2>
       <p className="text-slate-500 mt-2">Required academic session or blueprint is missing.</p>
       <button onClick={() => router.back()} className="mt-8 px-6 py-2 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs">Return to Master</button>
    </div>
  );

  const occ = feeBlueprint.occurrence;

  // ─── Filter Periods based on Occurrence ─────────────────────────────────────
  
  const displayedPeriods = periods.filter(p => {
    // If it's a periodic fee (every term), show all terms.
    if (occ === 'periodic') return true;
    
    // If it's annual or one-time, only show the designated payment period.
    const blueprintId = p.period?.id || p.period;
    const targetId = feeBlueprint.payment_period;
    
    if (!targetId) return false;
    return Number(blueprintId) === Number(targetId);
  });

  // Calculate annual total based ONLY on displayed periods
  const annualTotal = displayedPeriods.reduce((sum, p) => {
    const val = amounts[p.id] || '0';
    return sum + (parseFloat(val) || 0);
  }, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <ToastStack toasts={toasts} onRemove={(tid) => setToasts(p => p.filter(t => t.id !== tid))} />

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <button onClick={() => router.push('/dashboard/staff/fee/fee-structures')}
            className="p-3.5 text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all active:scale-90 shadow-hover">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-500/20 rounded-full translate-x-3 -translate-y-3 blur-md" />
             <DollarSign className="h-7 w-7 text-emerald-400 drop-shadow-sm" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
               <h1 className="text-2xl font-black text-slate-900 tracking-tighter">TERM PRICING</h1>
               <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter border shadow-sm
                 ${occ === 'periodic' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                 {occ?.replace('_', ' ')}
               </span>
            </div>
            <p className="text-sm text-slate-500 font-medium">
               Set prices for <span className="text-slate-900 font-extrabold underline decoration-emerald-500 underline-offset-4 decoration-2">{feeBlueprint.name}</span>
            </p>
          </div>
        </div>

        <button onClick={handleSave} disabled={isSubmitting}
          className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-black rounded-2xl hover:opacity-95 shadow-2xl shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 group">
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 group-hover:scale-110 transition-transform" />}
          {isNew ? 'Finalize & Activate' : 'Update Prices'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-7 space-y-6">
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
                  <Box className="h-3 w-3 text-emerald-500" /> Structure Context
               </p>
               <div className="space-y-4">
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Financial Group</p>
                     <p className="text-sm font-black text-slate-800">{(structure as any).group_name}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Session Context</p>
                     <p className="text-xs font-bold text-slate-600 uppercase tracking-tight">{activeSession.start_year}/{activeSession.end_year}</p>
                  </div>
               </div>
            </div>

            <div className="pt-6 border-t border-slate-50">
               <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/50">
                  <div className="flex items-center gap-2 mb-1">
                     <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                     <p className="text-[10px] font-black uppercase text-emerald-700">Estimated Yield</p>
                  </div>
                  <p className="text-lg font-black text-emerald-700">
                     {fmt(annualTotal)}
                  </p>
                  <p className="text-[9px] text-emerald-600/70 font-bold italic mt-0.5">* Sum of displayed terms</p>
               </div>
            </div>
          </div>

          <div className="bg-amber-50/50 rounded-[32px] border border-amber-100/40 p-7 flex items-start gap-4">
            <Info className="h-5 w-5 text-amber-500 shrink-0 mt-1" />
            <div>
              <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider mb-2">Automated Billing</h4>
              <p className="text-[11px] text-amber-800/80 leading-relaxed font-semibold">
                {occ === 'periodic' 
                  ? 'Set prices for all academic periods. Invoices will be generated for every term students resume for.'
                  : `This is a ${occ?.replace('_', ' ')} fee. It will only be billed during the designated period.`}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Matrix */}
        <div className="lg:col-span-3">
           <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                 <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-500" /> Session Matrix
                 </h3>
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                   {occ === 'periodic' ? 'All Terms' : 'Designated Term Only'}
                 </span>
              </div>
              
              <div className="p-8 space-y-6">
                 {displayedPeriods.length === 0 ? (
                    <div className="text-center py-12">
                       <p className="text-sm text-slate-400 font-medium italic">
                         {occ === 'periodic' 
                           ? `No periods defined for session ${activeSession.start_year}/${activeSession.end_year}.`
                           : 'The designated payment period for this fee does not exist in the active session.'}
                       </p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       {displayedPeriods.map(p => (
                          <div key={p.id} className="group relative p-6 bg-slate-50/50 border border-slate-100 rounded-[24px] hover:bg-white hover:border-emerald-200 hover:shadow-xl transition-all duration-300">
                             <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-3">
                                   <div className={`w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors`}>
                                      <Clock className="h-4 w-4" />
                                   </div>
                                   <div>
                                      <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">{p.period?.name || 'Academic Period'}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Period</p>
                                   </div>
                                </div>
                                {p.is_current && (
                                   <div className="flex items-center gap-1.5 px-2 py-1 bg-violet-600 rounded-lg shadow-sm shadow-violet-200">
                                      <Zap className="h-2.5 w-2.5 text-white fill-white animate-pulse" />
                                      <span className="text-[7px] font-black text-white uppercase tracking-tighter">Current</span>
                                   </div>
                                )}
                             </div>

                             <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm group-hover:text-emerald-500 transition-colors">₦</span>
                                <input
                                   type="number"
                                   step="0.01"
                                   value={amounts[p.id] || ''}
                                   onChange={(e) => handleAmountChange(p.id, e.target.value)}
                                   placeholder="0.00"
                                   className={inputCls}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-200 pointer-events-none group-focus-within:text-emerald-500 tracking-widest uppercase">NGN</div>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}

                 <div className="bg-slate-900 rounded-[28px] p-7 flex items-center justify-between shadow-2xl relative overflow-hidden mt-8">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full translate-x-10 -translate-y-10 blur-3xl" />
                    <div className="flex items-center gap-4 relative z-10">
                       <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
                          <BarChart3 className="h-5 w-5" />
                       </div>
                       <div>
                          <h4 className="text-white font-black text-sm uppercase tracking-widest mb-1">Yield Confirmation</h4>
                          <p className="text-slate-400 text-[10px] font-medium leading-tight">Finalize prices for the {activeSession.start_year}/{activeSession.end_year} session billing cycle.</p>
                       </div>
                    </div>
                    <button onClick={handleSave} disabled={isSubmitting}
                      className="px-6 py-3 bg-emerald-500 text-slate-950 font-black rounded-xl hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 text-[10px] uppercase tracking-widest relative z-10 shadow-lg shadow-emerald-500/20">
                      {isSubmitting ? 'Syncing...' : 'Save Matrix'}
                    </button>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
