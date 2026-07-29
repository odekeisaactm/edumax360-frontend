'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, academicAPI } from '@/lib/api';
import { FeeStructure, AcademicSessionPeriod, Fee, FeeGroup, Session, ClassModel, ClassSection } from '@/lib/types';
import {
  ArrowLeft, Check, X, AlertCircle, Loader2, Tag, Calendar, Info,
  Layers, Save, Pencil, FolderOpen, Users, ShieldCheck, Settings, Clock,
} from 'lucide-react';

// ─── Style Helpers ────────────────────────────────────────────────────────────
// Same token language as the list/create page: single cyan accent, flat icon
// boxes instead of gradients, rounded-lg/xl instead of 2xl, tighter padding.

const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5';

const fmtMoney = (v: string | number = 0) => `₦${Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

function extractError(err: any): string {
  if (err?.response?.data?.detail) return err.response.data.detail;
  return err?.message || 'An unexpected error occurred';
}

function SectionHeader({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode; }) {
  return (
    <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
      <h2 className="font-bold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wide">
        <span className="text-cyan-600">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Toasts ───────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border pointer-events-auto animate-in slide-in-from-right-4 ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />}
          <span className="text-sm font-medium whitespace-pre-line">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
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
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const showToast = useCallback((type: Toast['type'], message: string) => {
    const tid = ++toastIdRef.current;
    setToasts(p => [...p, { id: tid, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== tid)), 5000);
  }, []);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);

  const [structure, setStructure] = useState<FeeStructure | null>(null);
  const [feeBlueprint, setFeeBlueprint] = useState<Fee | null>(null);
  const [group, setGroup] = useState<FeeGroup | null>(null);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);

  // amounts are mapped to the AcademicPeriod Blueprint ID (e.g. 1st Term = 1), NOT the SessionPeriod ID
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [draftAmounts, setDraftAmounts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const structId = parseInt(id as string);

      const [sData, sessionsData, feesData, groupsData, classesData, sectionsData] = await Promise.all([
        feeAPI.getFeeStructure(structId),
        academicCalendarAPI.listSessions(),
        feeAPI.getFees(),
        feeAPI.getFeeGroups(),
        academicAPI.listClasses({ is_active: true }),
        academicAPI.listClassSections(),
      ]);

      setStructure(sData);
      setFeeBlueprint(feesData.find((f: Fee) => f.id === sData.fee) || null);
      setGroup(groupsData.find((g: FeeGroup) => g.id === sData.group) || null);
      setClasses(classesData);
      setSections(sectionsData);

      const current = sessionsData.find((s: Session) => s.is_active);
      if (!current) {
        showToast('error', 'No active Academic Session found. Configure a session first.');
        setLoading(false);
        return;
      }
      setActiveSession(current);

      const pData = await academicCalendarAPI.listSessionPeriods({ session_id: current.id });
      // Drop duplicates (general periods have no school_section)
      const uniquePeriods = pData.filter((p: AcademicSessionPeriod) => !p.school_section);
      setPeriods(uniquePeriods.sort((a: any, b: any) => (a.period?.order || 0) - (b.period?.order || 0)));

      // Load amounts using the backend's period (blueprint ID)
      const initialAmounts: Record<number, string> = {};
      sData.period_amounts?.forEach((pa: { period: number; amount: string }) => {
        initialAmounts[pa.period] = pa.amount;
      });
      setAmounts(initialAmounts);
      setDraftAmounts(initialAmounts);

    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { if (isNew) setEditing(true); }, [isNew]);

  const startEditing = () => { setDraftAmounts(amounts); setEditing(true); };
  const cancelEditing = () => { setDraftAmounts(amounts); setEditing(false); };
  const handleAmountChange = (periodId: number, val: string) => {
    setDraftAmounts(prev => ({ ...prev, [periodId]: val }));
  };

  const hasNegative = Object.values(draftAmounts).some(v => v !== '' && parseFloat(v) < 0);

  const handleSave = async () => {
    if (hasNegative) return showToast('error', 'Amounts cannot be negative.');
    setIsSubmitting(true);
    try {
      const data = Object.entries(draftAmounts)
        .filter(([_, amt]) => amt !== '' && parseFloat(amt) >= 0)
        .map(([pid, amt]) => ({ period: parseInt(pid), amount: amt }));

      // Fallback: If you updated your API helper, this might be `feeAPI.structures.setPeriodAmounts`
      const apiCall = (feeAPI as any).structures?.setPeriodAmounts || (feeAPI as any).setPeriodAmounts;
      await apiCall(parseInt(id as string), data);

      setAmounts(draftAmounts);
      setEditing(false);
      showToast('success', isNew ? 'Pricing set. Structure is now active.' : 'Pricing matrix updated successfully.');

      if (isNew) router.push('/dashboard/staff/fee/fee-structures');
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-[500px] flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
      <p className="text-slate-400 font-semibold tracking-widest text-xs uppercase">Loading Pricing Matrix...</p>
    </div>
  );

  if (!structure || !feeBlueprint || !activeSession) return (
    <div className="max-w-2xl mx-auto p-14 text-center bg-white rounded-xl border border-slate-100">
       <AlertCircle className="h-10 w-10 text-rose-500 mx-auto mb-5" />
       <h2 className="text-lg font-bold text-slate-800">Configuration Error</h2>
       <p className="text-slate-500 mt-2 text-sm">Required academic session or fee blueprint is missing.</p>
       <button onClick={() => router.push('/dashboard/staff/fee/fee-structures')} className="mt-7 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-semibold text-xs">Return to Fee Master</button>
    </div>
  );

  const occ = feeBlueprint.occurrence;

  const displayedPeriods = periods.filter(p => {
    if (occ === 'periodic') return true;
    const blueprintId = (p.period as any)?.id || p.period;
    const targetId = feeBlueprint.payment_period;
    if (!targetId) return false;
    return Number(blueprintId) === Number(targetId);
  });

  const sourceAmounts = editing ? draftAmounts : amounts;

  // FIX: Aggregate totals and counts using the Blueprint ID, not the SessionPeriod ID
  const total = displayedPeriods.reduce((sum, p) => {
    const bpId = (p.period as any)?.id || p.period;
    return sum + (parseFloat(sourceAmounts[bpId] || '0') || 0);
  }, 0);

  const pricedCount = displayedPeriods.filter(p => {
    const bpId = (p.period as any)?.id || p.period;
    return amounts[bpId] && parseFloat(amounts[bpId]) > 0;
  }).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-16 animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onRemove={tid => setToasts(p => p.filter(t => t.id !== tid))} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-3.5">
          <button onClick={() => router.push('/dashboard/staff/fee/fee-structures')} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Tag className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">{feeBlueprint.name}</h1>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${occ === 'periodic' ? 'bg-cyan-50 text-cyan-700' : 'bg-amber-50 text-amber-700'}`}>
                {occ?.replace('_', ' ')}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${structure.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${structure.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                {structure.is_active ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Pricing for the {activeSession.start_year}/{activeSession.end_year} session</p>
          </div>
        </div>

        {canManage && (
          editing ? (
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button onClick={cancelEditing} disabled={isSubmitting} className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSubmitting || hasNegative} className="flex-1 sm:flex-none px-5 py-2 bg-cyan-600 text-white text-sm font-semibold rounded-lg hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isNew ? 'Finalize & Activate' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <button onClick={startEditing} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors">
              <Pencil className="h-4 w-4" /> Edit Prices
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Left Col: Context */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <SectionHeader icon={<Settings className="h-4 w-4" />} title="Structure Context" />
            <div className="p-5 space-y-3.5">
              <div>
                <label className={labelCls}>Fee Blueprint</label>
                <p className="text-sm font-bold text-slate-900">{feeBlueprint.name}</p>
                <p className="text-[10px] font-mono text-slate-400">{feeBlueprint.code}</p>
              </div>
              <div>
                <label className={labelCls}>Financial Group</label>
                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded-md">
                  <FolderOpen className="h-3 w-3" /> {group?.name || 'Unknown'}
                </span>
              </div>
              <div>
                <label className={labelCls}>Occurrence</label>
                <p className="text-xs font-bold text-slate-600 capitalize">{occ?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <SectionHeader icon={<ShieldCheck className="h-4 w-4" />} title="Target Scopes" />
            <div className="p-5">
              {!structure.scopes || structure.scopes.length === 0 ? (
                <p className="text-xs italic text-slate-400">No classes assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {structure.scopes.map((sc, idx) => {
                    const cName = classes.find(c => c.id === sc.student_class)?.name || 'Unknown Class';
                    const sName = sc.class_section ? sections.find(s => s.id === sc.class_section)?.name : 'ALL ARMS';
                    const isAll = !sc.class_section;
                    return (
                      <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold ${isAll ? 'bg-white border-cyan-200 text-cyan-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <Users className={`h-3.5 w-3.5 ${isAll ? 'text-cyan-500' : 'text-slate-400'}`} />
                        {cName} <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${isAll ? 'bg-cyan-100' : 'bg-slate-100'}`}>{sName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4 flex gap-2.5">
            <Info className="h-4 w-4 text-cyan-600 shrink-0 mt-0.5" />
            <p className="text-xs text-cyan-900 leading-relaxed">
              {occ === 'periodic'
                ? 'This is a periodic fee — invoices are generated for every term a scoped student resumes for.'
                : `This is a ${occ?.replace('_', ' ')} fee — it only bills during its designated period.`}
            </p>
          </div>
        </div>

        {/* Right Col: Pricing Matrix */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <SectionHeader icon={<Calendar className="h-4 w-4" />} title="Session Pricing Matrix">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {occ === 'periodic' ? 'All Terms' : 'Designated Term Only'}
              </span>
            </SectionHeader>

            <div className="p-5 space-y-5">
              {displayedPeriods.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-400 italic">
                    {occ === 'periodic'
                      ? `No periods defined for the ${activeSession.start_year}/${activeSession.end_year} session.`
                      : 'The designated payment period for this fee does not exist in the active session.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {displayedPeriods.map(p => {
                    // FIX: Extract Blueprint ID for mapping input
                    const bpId = (p.period as any)?.id || p.period;
                    const val = editing ? (draftAmounts[bpId] ?? '') : amounts[bpId];
                    const isNegative = editing && val !== '' && parseFloat(val) < 0;
                    const hasPrice = !editing && val && parseFloat(val) > 0;

                    return (
                      <div key={p.id} className={`p-3.5 rounded-lg border transition-colors ${hasPrice ? 'border-slate-200 bg-white' : editing ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/50'}`}>
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                              <Clock className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">{(p.period as any)?.name || 'Academic Period'}</span>
                          </div>
                          {p.is_current && (
                            <span className="px-2 py-0.5 bg-cyan-600 rounded-md text-[9px] font-bold text-white uppercase tracking-wide">Current</span>
                          )}
                        </div>

                        {editing ? (
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₦</span>
                            <input
                              type="number" step="0.01"
                              value={draftAmounts[bpId] ?? ''}
                              onChange={e => handleAmountChange(bpId, e.target.value)}
                              placeholder="0.00"
                              className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 transition-all ${isNegative ? 'border-rose-300 focus:ring-rose-200 text-rose-600' : 'border-slate-200 focus:ring-cyan-500 text-slate-800'}`}
                            />
                          </div>
                        ) : (
                          <p className={`text-base font-black text-right ${hasPrice ? 'text-slate-900' : 'text-slate-300 italic text-sm font-medium'}`}>
                            {hasPrice ? fmtMoney(val) : 'No price set'}
                          </p>
                        )}
                        {isNegative && <p className="text-[10px] text-rose-500 font-bold mt-1.5">Amount cannot be negative.</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Total Summary */}
              <div className="bg-slate-900 rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Session Total</p>
                    <p className="text-slate-400 text-[10px]">
                      {pricedCount} of {displayedPeriods.length} period{displayedPeriods.length !== 1 ? 's' : ''} priced
                    </p>
                  </div>
                </div>
                <p className="text-lg font-black text-white">{fmtMoney(total)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}