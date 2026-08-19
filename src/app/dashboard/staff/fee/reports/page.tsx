'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, academicAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod, ClassModel } from '@/lib/types';
import {
  Filter, Loader2, BarChart2, PieChart,
  TrendingUp, Clock, FileText, CheckCircle, AlertTriangle, X,
  Download, FileSpreadsheet, Printer
} from 'lucide-react';
import dynamic from 'next/dynamic';

// ─── Dynamic Tab Imports ──────────────────────────────────────────────────────
const CollectionsTab = dynamic(() => import('./tabs/CollectionsTab'), { loading: () => <TabSkeleton /> });
const TrendsTab = dynamic(() => import('./tabs/TrendsTab'), { loading: () => <TabSkeleton /> });
const AgingTab = dynamic(() => import('./tabs/AgingTab'), { loading: () => <TabSkeleton /> });
const ClassPerformanceTab = dynamic(() => import('./tabs/ClassPerformanceTab'), { loading: () => <TabSkeleton /> });

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function TabSkeleton() {
  return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-200" /></div>;
}

type TabKey = 'collections' | 'trends' | 'performance' | 'aging';

// ─── Main Parent Component ────────────────────────────────────────────────────
export default function FeeReportsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // ── Reference Data State ──
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [feesList, setFeesList] = useState<any[]>([]);

  // ── "Super Filter" State ──
  const [filterSessionId, setFilterSessionId] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string>('');
  const [isCumulative, setIsCumulative] = useState<boolean>(false);
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [filterSectionId, setFilterSectionId] = useState<string>('');
  const [specificFeeId, setSpecificFeeId] = useState<string>('');

  const [debtType, setDebtType] = useState<'all' | 'tuition_only' | 'ancillary_only'>('all');
  const [groupBy, setGroupBy] = useState<'student' | 'parent'>('student');
  const [thresholdPct, setThresholdPct] = useState<string>('');

  // ── Tab Navigation & Report Data State ──
  const [activeTab, setActiveTab] = useState<TabKey>('collections');
  const [dataLoading, setDataLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const fetchRequestIdRef = useRef(0);
  const printRef = useRef<HTMLDivElement>(null);

  // ── Initialize Reference Data ──
  useEffect(() => {
    const init = async () => {
      try {
        const [sessRes, curSessRaw, clsRes, secRes, feesRes] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession(),
          academicAPI.listClasses({ is_active: true }).catch(() => []),
          academicAPI.listClassSections().catch(() => []),
          feeAPI.getFees().catch(() => [])
        ]);

        const validSessions = Array.isArray(sessRes) ? sessRes : (sessRes as any)?.results || [];
        setSessions(validSessions);
        setClasses(Array.isArray(clsRes) ? clsRes : (clsRes as any)?.results || []);
        setSections(Array.isArray(secRes) ? secRes : (secRes as any)?.results || []);
        setFeesList(Array.isArray(feesRes) ? feesRes : (feesRes as any)?.results || []);

        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        const targetSessionId = curSess?.id ? curSess.id.toString() : (validSessions[0]?.id?.toString() || '');

        if (targetSessionId) {
          setFilterSessionId(targetSessionId);
          const perData = await academicCalendarAPI.listSessionPeriods({ session_id: Number(targetSessionId) });
          setPeriods(perData);
          const currentP = perData.find(p => p.is_current);
          if (currentP) setFilterPeriodId(currentP.id.toString());
          else if (perData.length > 0) setFilterPeriodId(perData[0].id.toString());
        }
      } catch (err) {
        showToast('error', 'Failed to load filter parameters.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [showToast]);

  useEffect(() => {
    if (!loading && filterSessionId) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(filterSessionId) })
        .then(res => {
          setPeriods(res);
          if (res.length > 0 && !res.find(p => p.id.toString() === filterPeriodId)) {
            setFilterPeriodId(res[0].id.toString());
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSessionId, loading]);

  const availableSections = filterClassId
    ? sections.filter(sec => !sec.school_section || sec.school_section === classes.find(c => c.id.toString() === filterClassId)?.school_section)
    : [];

  useEffect(() => {
    if (specificFeeId && debtType === 'ancillary_only') {
      setDebtType('tuition_only');
    }
  }, [specificFeeId, debtType]);

  // ── FIX: reset reportData the INSTANT the tab changes, before the fetch
  // fires. Without this, switching tabs briefly renders the previous
  // tab's data through the new tab's template — harmless-looking NaNs in
  // some cases, a hard crash in others (e.g. an object rendered where an
  // array is expected). Every tab now always shows its own loading state
  // instead of another tab's leftover shape. ──
  useEffect(() => {
    setReportData(null);
  }, [activeTab]);

  // ── Fetch Report Data ──
  const fetchReport = useCallback(async () => {
    if (!filterSessionId) return;
    const requestId = ++fetchRequestIdRef.current;
    setDataLoading(true);

    try {
      let data = null;

      if (activeTab === 'collections') {
        const res = await feeAPI.getCollectionReport({
          session_id: filterSessionId,
          period_id: filterPeriodId,
          cumulative: isCumulative,
          class_id: filterClassId,
          section_id: filterSectionId,
          fee_id: specificFeeId,
          debt_type: debtType,
          group_by: groupBy,
          threshold_pct: thresholdPct || undefined
        });
        data = res?.results ?? res;
      } else if (activeTab === 'aging') {
        data = await feeAPI.getAgingBuckets({ session_id: filterSessionId });
      } else if (activeTab === 'trends') {
        const res = await feeAPI.getPaymentTrends({ session_id: filterSessionId, days: 30 });
        data = res?.results ?? res;
      } else if (activeTab === 'performance') {
        const res = await feeAPI.getClassPerformanceReport({
          session_id: filterSessionId,
          period_id: filterPeriodId,
          cumulative: isCumulative,
          debt_type: debtType,
        });
        data = res?.results ?? res;
      }

      if (requestId !== fetchRequestIdRef.current) return;
      setReportData(data);

    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      showToast('error', extractError(err));
    } finally {
      if (requestId === fetchRequestIdRef.current) setDataLoading(false);
    }
  }, [
    activeTab, filterSessionId, filterPeriodId, isCumulative, filterClassId,
    filterSectionId, specificFeeId, debtType, groupBy, thresholdPct, showToast
  ]);

  useEffect(() => {
    if (!loading) fetchReport();
  }, [fetchReport, loading]);

  // ── Dynamic title + export params, built from active filters ──
  const filterLabels = useMemo(() => {
    const session = sessions.find(s => s.id.toString() === filterSessionId);
    const period = periods.find(p => p.id.toString() === filterPeriodId);
    const cls = classes.find(c => c.id.toString() === filterClassId);
    return {
      session_label: session ? `${session.start_year}/${session.end_year}` : '',
      period_label: period ? (period.name || period.period?.name || '') : '',
      class_label: cls ? cls.name : '',
    };
  }, [sessions, periods, classes, filterSessionId, filterPeriodId, filterClassId]);

  const reportTitle = useMemo(() => {
    const base = activeTab === 'collections' ? 'Collections & Clearance Report'
      : activeTab === 'performance' ? 'Class Performance Report'
      : activeTab === 'trends' ? 'Payment Flow Trends'
      : 'Aging / Overdue Analysis';
    const parts = [base];
    if (filterLabels.session_label) parts.push(filterLabels.session_label);
    if (filterLabels.period_label) parts.push(`${isCumulative ? 'From ' : ''}${filterLabels.period_label}`);
    if (activeTab === 'collections' && filterLabels.class_label) parts.push(filterLabels.class_label);
    if (activeTab === 'collections' && debtType !== 'all') parts.push(debtType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
    if (activeTab === 'collections' && thresholdPct) parts.push(`Min ${thresholdPct}% Cleared`);
    return parts.join(' — ');
  }, [activeTab, filterLabels, isCumulative, debtType, thresholdPct]);

  // ── CSV export: always the FULL filtered dataset, independent of any
  // client-side pagination happening inside the tab. ──
  const handleExportCsv = () => {
    if (activeTab === 'aging') return; // aging is a single small object, nothing to export
    const endpointPath = activeTab === 'collections' ? 'collections'
      : activeTab === 'performance' ? 'class-performance'
      : 'trends';

    const params = new URLSearchParams();
    const base: Record<string, any> = {
      session_id: filterSessionId,
      session_label: filterLabels.session_label,
      period_label: filterLabels.period_label,
      class_label: filterLabels.class_label,
    };
    if (activeTab === 'collections') {
      Object.assign(base, {
        period_id: filterPeriodId, cumulative: isCumulative, class_id: filterClassId,
        section_id: filterSectionId, fee_id: specificFeeId, debt_type: debtType,
        group_by: groupBy, threshold_pct: thresholdPct,
      });
    } else if (activeTab === 'performance') {
      Object.assign(base, { period_id: filterPeriodId, cumulative: isCumulative, debt_type: debtType });
    }

    Object.entries(base).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '' && v !== false) params.append(k, String(v));
    });
    params.append('export', 'csv');
    window.location.href = `/api/fee/reports/${endpointPath}/?${params.toString()}`;
  };

  // ── PDF export: browser print of the currently loaded (full, filtered)
  // dataset. Each tab renders a `data-print-summary` block that this
  // triggers via window.print(). ──
  const handleExportPdf = () => {
    window.print();
  };

  if (!canManage) {
    return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing finance permissions.</div>;
  }

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Initializing Reports Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-0 animate-in fade-in duration-300 print:p-0 print:max-w-none">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Reports</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Advanced analytics, aging, and collection performance.</p>
          </div>
        </div>

        {/* ── Export Toolbar — dynamic title, always the full filtered set ── */}
        <div className="flex items-center gap-2">
          {activeTab !== 'aging' && (
            <button onClick={handleExportCsv} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
            </button>
          )}
          <button onClick={handleExportPdf} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-indigo-600" /> Print / PDF
          </button>
        </div>
      </div>

      {/* ── SUPER FILTER BAR ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 print:hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Master Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Session</label>
            <select value={filterSessionId} onChange={e => setFilterSessionId(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500">
              {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Term</label>
            <select value={filterPeriodId} onChange={e => setFilterPeriodId(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Terms</option>
              {periods.filter(p => p.session?.id.toString() === filterSessionId).map(p => (
                <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Term Scope</label>
            <select value={isCumulative ? 'true' : 'false'} onChange={e => setIsCumulative(e.target.value === 'true')} disabled={!filterPeriodId} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
              <option value="false">Selected Term Only</option>
              <option value="true">Selected Term Downward (Cumulative)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Debt Source</label>
            <select value={debtType} onChange={e => setDebtType(e.target.value as any)} disabled={!!specificFeeId} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
              <option value="all">Invoice + Ancillary Debt (Combined)</option>
              <option value="tuition_only">Invoice Only</option>
              <option value="ancillary_only">Ancillary Debt Only (Fines, etc.)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Class</label>
            <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} disabled={activeTab === 'performance'} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Arm / Section</label>
            <select value={filterSectionId} onChange={e => setFilterSectionId(e.target.value)} disabled={!filterClassId || availableSections.length === 0 || activeTab === 'performance'} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
              <option value="">All Arms</option>
              {availableSections.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Specific Fee Breakdown</label>
            <select value={specificFeeId} onChange={e => setSpecificFeeId(e.target.value)} disabled={activeTab !== 'collections'} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
              <option value="">Total Invoice</option>
              {feesList.map(fee => <option key={fee.id} value={fee.id}>{fee.name}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Group By</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} disabled={activeTab !== 'collections'} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                <option value="student">Student</option>
                <option value="parent">Parent (Family Rollup)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Min % Cleared</label>
              <div className="relative">
                <input type="number" min="0" max="100" placeholder="e.g. 100" value={thresholdPct} onChange={e => setThresholdPct(e.target.value)} disabled={activeTab !== 'collections'} className="w-full pl-3 pr-6 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS NAVIGATION ── */}
      <div className="flex overflow-x-auto gap-2 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit print:hidden">
        <button onClick={() => setActiveTab('collections')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'collections' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <FileText className="w-4 h-4" /> Collections & Clearance
        </button>
        <button onClick={() => setActiveTab('trends')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'trends' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <TrendingUp className="w-4 h-4" /> Payment Flow Trends
        </button>
        <button onClick={() => setActiveTab('performance')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'performance' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <PieChart className="w-4 h-4" /> Class Performance
        </button>
        <button onClick={() => setActiveTab('aging')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'aging' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Clock className="w-4 h-4" /> Aging / Overdue
        </button>
      </div>

      {/* ── Print-only title header ── */}
      <div className="hidden print:block px-1">
        <h1 className="text-lg font-black text-slate-900">{reportTitle}</h1>
        <p className="text-xs text-slate-500">Printed {new Date().toLocaleString('en-GB')}</p>
      </div>

      {/* ── TAB CONTENT RENDERING ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] relative print:border-0 print:shadow-none print:rounded-none" ref={printRef}>
        {dataLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl print:hidden">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        )}

        <div className="p-1">
          {/* Only the active tab's own reportData is ever passed here — see the
              reset-on-tab-change effect above, which guarantees reportData is
              null (and each tab shows its own loading/empty state) until the
              fetch for THIS tab has actually resolved. */}
          {activeTab === 'collections' && (
            <CollectionsTab
              data={reportData}
              groupBy={groupBy}
              reportTitle={reportTitle}
            />
          )}
          {activeTab === 'trends' && <TrendsTab data={reportData} reportTitle={reportTitle} />}
          {activeTab === 'performance' && <ClassPerformanceTab data={reportData} reportTitle={reportTitle} />}
          {activeTab === 'aging' && <AgingTab data={reportData} reportTitle={reportTitle} />}
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}