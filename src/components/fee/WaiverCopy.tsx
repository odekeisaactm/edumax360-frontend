'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Loader2, ArrowRight, Info, CheckCircle2, AlertTriangle, Copy, Calendar } from 'lucide-react';
import { feeAPI, academicCalendarAPI } from '@/lib/api';

interface WaiverCopyProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function WaiverCopyWizard({ isOpen, onClose, onSuccess, showToast }: WaiverCopyProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]); // full, unfiltered — carries .session and .period

  // Source term — any session/term, no restriction (we're copying FROM history)
  const [sourceSessionId, setSourceSessionId] = useState('');
  const [sourcePeriodId, setSourcePeriodId] = useState('');

  // Target term — restricted to current or future (we're creating NEW waivers here)
  const [targetSessionId, setTargetSessionId] = useState('');
  const [targetPeriodId, setTargetPeriodId] = useState('');

  const [batchTitle, setBatchTitle] = useState('');

  const [rules, setRules] = useState({
    conflict_resolution: '',
    price_change_action: 'apply_same_amount',
    exceeds_balance_action: 'cap_at_balance',
    existing_waiver_action: ''
  });

  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [activeStatus, setActiveStatus] = useState<any>(null);
  const pollRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setStep(1);
      setPreviewItems([]);
      setActiveStatus(null);
      setBatchTitle('');
      setSourceSessionId('');
      setSourcePeriodId('');
      setTargetSessionId('');
      setTargetPeriodId('');
      setRules({
        conflict_resolution: '',
        price_change_action: 'apply_same_amount',
        exceeds_balance_action: 'cap_at_balance',
        existing_waiver_action: ''
      });

      academicCalendarAPI.listSessions().then(setSessions).catch(() => setSessions([]));
      academicCalendarAPI.listSessionPeriods().then(setPeriods).catch(() => setPeriods([]));
    }
  }, [isOpen]);

  // Reset the term choice whenever its session changes
  useEffect(() => { setSourcePeriodId(''); }, [sourceSessionId]);
  useEffect(() => { setTargetPeriodId(''); }, [targetSessionId]);

  const sourcePeriodsForSession = useMemo(
    () => (sourceSessionId ? periods.filter(p => p.session?.id?.toString() === sourceSessionId) : []),
    [periods, sourceSessionId]
  );

  const currentPeriod = useMemo(() => periods.find((p: any) => p.is_current), [periods]);
  const currentSession = useMemo(
    () => sessions.find((s: any) => s.id === currentPeriod?.session?.id),
    [sessions, currentPeriod]
  );

  // Mirrors the "locked past term" rule from the invoice correction wizard —
  // a new waiver should never be silently created in a term that's already closed.
  const targetPeriodsForSession = useMemo(() => {
    if (!targetSessionId) return [];
    const targetSessionObj = sessions.find((s: any) => s.id.toString() === targetSessionId);
    const sessionPeriods = periods.filter((p: any) => p.session?.id?.toString() === targetSessionId);
    if (!currentPeriod || !targetSessionObj || !currentSession) return sessionPeriods;

    if (targetSessionObj.start_year > currentSession.start_year) return sessionPeriods;
    if (targetSessionObj.start_year === currentSession.start_year) {
      return sessionPeriods.filter((p: any) => (p.period?.order ?? 0) >= (currentPeriod.period?.order ?? 0));
    }
    return [];
  }, [periods, sessions, targetSessionId, currentPeriod, currentSession]);

  const handlePreview = async () => {
    if (!sourcePeriodId || !targetPeriodId) return showToast('error', 'Please select both a source and a target term.');
    if (!rules.conflict_resolution || !rules.existing_waiver_action) return showToast('error', 'Please complete all rule selections.');
    if (sourcePeriodId === targetPeriodId) return showToast('error', 'Source and target terms cannot be the same.');

    setLoading(true);
    try {
      const res = await feeAPI.previewWaiverCopy({
        source_period_id: Number(sourcePeriodId),
        target_period_id: Number(targetPeriodId),
        rules
      });
      setPreviewItems(res.preview_items || []);
      setStep(2);
    } catch (e: any) {
      showToast('error', e.response?.data?.detail || e.message || 'Failed to generate preview.');
    } finally {
      setLoading(false);
    }
  };

  const pollStatus = (batchId: number) => {
    pollRef.current = setTimeout(async () => {
      try {
        const res = await feeAPI.getWaiverCopyStatus(batchId);
        setActiveStatus(res);
        if (!res.is_complete) {
          pollStatus(batchId);
        } else if (res.status === 'success' || res.status === 'partial') {
          setTimeout(() => {
            onClose();
            onSuccess();
          }, 3000);
        }
      } catch (e) {
        // Retry on network hiccup
        pollStatus(batchId);
      }
    }, 2000);
  };

  const handleExecute = async () => {
    if (!batchTitle.trim()) return showToast('error', 'Please provide a title for this copy batch.');
    setLoading(true);
    try {
      const res = await feeAPI.executeWaiverCopy({
        title: batchTitle,
        source_period_id: Number(sourcePeriodId),
        target_period_id: Number(targetPeriodId),
        rules
      });
      setStep(3);
      setActiveStatus(res);
      pollStatus(res.id);
    } catch (e: any) {
      showToast('error', e.response?.data?.detail || e.message || 'Execution failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full sm:w-[600px] md:w-[700px] max-w-full bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right-8 duration-300">

        {/* Drawer Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex justify-center items-center shrink-0">
              <Copy className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Bulk Copy Waivers</h2>
              <p className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Step {step} of 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-6">

          {/* STEP 1: CONFIGURE RULES */}
          {step === 1 && (
            <div className="space-y-6 max-w-xl mx-auto animate-in zoom-in-95">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs font-medium text-blue-800 space-y-1.5 leading-relaxed">
                  <p><strong>System Rules & Safeties:</strong></p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Only <strong>Approved</strong> waivers are copied.</li>
                    <li>Waivers for Ancillary Debts (fines, damages) are safely ignored.</li>
                    <li>If the target fee doesn't exist for a student's new class, it is safely ignored.</li>
                    <li>Target term can only be the <strong>current or a future term</strong> — past terms are locked.</li>
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-500" /> 1. Source Term (Copy From)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Session</label>
                    <select value={sourceSessionId} onChange={e => setSourceSessionId(e.target.value)} className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium">
                      <option value="">Select session...</option>
                      {sessions.map((s: any) => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Term</label>
                    <select value={sourcePeriodId} onChange={e => setSourcePeriodId(e.target.value)} disabled={!sourceSessionId} className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium disabled:opacity-50">
                      <option value="">Select term...</option>
                      {sourcePeriodsForSession.map((p: any) => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-emerald-500" /> 2. Target Term (Copy To)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Session</label>
                    <select value={targetSessionId} onChange={e => setTargetSessionId(e.target.value)} className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium">
                      <option value="">Select session...</option>
                      {sessions.map((s: any) => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Term</label>
                    <select value={targetPeriodId} onChange={e => setTargetPeriodId(e.target.value)} disabled={!targetSessionId} className="w-full text-xs sm:text-sm p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-medium disabled:opacity-50">
                      <option value="">Select term...</option>
                      {targetPeriodsForSession.map((p: any) => <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>)}
                    </select>
                    {targetSessionId && targetPeriodsForSession.length === 0 && (
                      <p className="text-[9px] text-amber-600 font-semibold mt-1.5">Past terms are locked — pick the current or a future session.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">3. Copy Rules</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">If a student has multiple waivers on the exact same fee <span className="text-red-500">*</span></label>
                  <select value={rules.conflict_resolution} onChange={e => setRules({...rules, conflict_resolution: e.target.value as any})} className="w-full text-sm p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="" disabled>-- Make a Selection --</option>
                    <option value="use_first">Use First (Oldest Entry)</option>
                    <option value="use_last">Use Last (Newest Entry)</option>
                    <option value="use_highest">Use Highest Amount</option>
                    <option value="use_lowest">Use Lowest Amount</option>
                    <option value="sum_all">Sum All Valid Waivers Together</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">If the target invoice already has an approved waiver <span className="text-red-500">*</span></label>
                  <select value={rules.existing_waiver_action} onChange={e => setRules({...rules, existing_waiver_action: e.target.value as any})} className="w-full text-sm p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="" disabled>-- Make a Selection --</option>
                    <option value="skip">Skip (Preserve existing waiver, do not copy)</option>
                    <option value="overwrite">Overwrite with copied value</option>
                    <option value="merge">Merge (Add the copied amount to the existing one)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">If fee price has changed</label>
                    <select value={rules.price_change_action} onChange={e => setRules({...rules, price_change_action: e.target.value as any})} className="w-full text-sm p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50">
                      <option value="apply_same_amount">Apply Same Fixed Amount</option>
                      <option value="apply_proportion">Apply Proportionately</option>
                      <option value="ignore">Ignore / Skip Copy</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">If waiver exceeds balance</label>
                    <select value={rules.exceeds_balance_action} onChange={e => setRules({...rules, exceeds_balance_action: e.target.value as any})} className="w-full text-sm p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50">
                      <option value="cap_at_balance">Cap at Exact Balance</option>
                      <option value="ignore">Ignore / Skip Copy</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 2 && (
            <div className="space-y-4 max-w-2xl mx-auto animate-in slide-in-from-right-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">Provide a Batch Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. 2nd Term Alumni Concessions"
                  value={batchTitle}
                  onChange={e => setBatchTitle(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[50vh] sm:h-[60vh]">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center font-bold text-sm shrink-0">
                  <span className="text-slate-800">Projection Preview</span>
                  <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg text-xs">{previewItems.length} Waivers Projected</span>
                </div>

                <div className="overflow-x-auto overflow-y-auto flex-1">
                  {previewItems.length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center text-slate-400 space-y-2">
                      <AlertTriangle className="h-8 w-8 text-amber-400" />
                      <p className="text-sm font-medium text-center">No waivers qualify to be copied under these rules.</p>
                      <p className="text-xs text-center">Either there were no approved waivers in the source term, or the target invoices are already fully paid/cleared.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs whitespace-nowrap sm:whitespace-normal">
                      <thead className="bg-slate-50 sticky top-0 border-b border-slate-100 shadow-sm">
                        <tr>
                          <th className="p-3 sm:px-4 font-bold text-slate-500 uppercase tracking-wider">Student / Family</th>
                          <th className="p-3 sm:px-4 font-bold text-slate-500 uppercase tracking-wider">Target Fee</th>
                          <th className="p-3 sm:px-4 text-right font-bold text-slate-500 uppercase tracking-wider">Projected Value</th>
                          <th className="p-3 sm:px-4 text-center font-bold text-slate-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 sm:px-4 font-semibold text-slate-800 max-w-[120px] sm:max-w-[200px] truncate" title={item.entity_name}>{item.entity_name}</td>
                            <td className="p-3 sm:px-4 text-slate-600 max-w-[120px] sm:max-w-[200px] truncate" title={item.fee_name}>{item.fee_name}</td>
                            <td className="p-3 sm:px-4 text-right font-black text-emerald-700">₦{item.projected_amount}</td>
                            <td className="p-3 sm:px-4 text-center">
                              {item.will_overwrite ?
                                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded border border-amber-200 text-[10px] uppercase font-bold tracking-wider">Overwrite</span> :
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded border border-emerald-200 text-[10px] uppercase font-bold tracking-wider">Create</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: EXECUTION STATUS */}
          {step === 3 && activeStatus && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-5 animate-in zoom-in-95">
              {activeStatus.is_complete ? (
                <div className="bg-emerald-50 text-emerald-600 p-5 rounded-full border border-emerald-100 shadow-sm"><CheckCircle2 className="w-12 h-12" /></div>
              ) : (
                <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
              )}

              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900">{activeStatus.status_display || 'Queued'}</h3>
                <p className="text-sm font-medium text-slate-500">Processed <strong className="text-slate-800">{activeStatus.processed_targets ?? 0}</strong> of <strong className="text-slate-800">{activeStatus.total_targets ?? '—'}</strong> records.</p>
                {activeStatus.failed_targets > 0 && <p className="text-sm font-bold text-rose-500 bg-rose-50 px-3 py-1 rounded-lg inline-block mt-2">{activeStatus.failed_targets} failures detected.</p>}
                {activeStatus.error_message && <p className="text-xs text-rose-500 max-w-sm mt-2">{activeStatus.error_message}</p>}
              </div>

              {!activeStatus.is_complete && (
                <div className="w-64 sm:w-80 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner mt-4">
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${activeStatus.progress_pct || 0}%` }} />
                </div>
              )}
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
          {step > 1 && step < 3 ? (
            <button onClick={() => setStep(p => (p-1) as any)} disabled={loading} className="px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50">
              Go Back
            </button>
          ) : <div/>}

          {step === 1 && (
            <button onClick={handlePreview} disabled={loading} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 disabled:opacity-50 shadow-md transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Generate Preview'} <ArrowRight className="w-4 h-4"/>
            </button>
          )}
          {step === 2 && (
            <button onClick={handleExecute} disabled={loading || !batchTitle || previewItems.length === 0} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-200 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Execute Copy Batch'}
            </button>
          )}
          {step === 3 && activeStatus?.is_complete && (
            <button onClick={() => { onClose(); onSuccess(); }} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 shadow-md transition-all">
              Close & View Ledger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}