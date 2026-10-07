'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicCalendarAPI, academicAPI, schoolInfoAPI, api } from '@/lib/api';
import { Session, AcademicSessionPeriod, ClassModel } from '@/lib/types';
import { getApiUrl } from '@/lib/getApiUrl';
import {
  Filter, Loader2, BarChart2, PieChart,
  TrendingUp, Layers, FileText, CheckCircle, AlertTriangle, X,
  FileSpreadsheet, Printer, Users
} from 'lucide-react';
import dynamic from 'next/dynamic';
import PrintLetterhead from './PrintLetterhead';

// ─── Dynamic Tab Imports ──────────────────────────────────────────────────────
const CollectionsTab = dynamic(() => import('./tabs/CollectionsTab'), { loading: () => <TabSkeleton /> });
const TrendsTab = dynamic(() => import('./tabs/TrendsTab'), { loading: () => <TabSkeleton /> });
const FeeBreakdownTab = dynamic(() => import('./tabs/FeeBreakdownTab'), { loading: () => <TabSkeleton /> });
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

function cleanParams(p: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) out[k] = v;
  });
  return out;
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none print:hidden">
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

type TabKey = 'collections' | 'trends' | 'performance' | 'breakdown';
type DebtType = 'all' | 'tuition_only' | 'ancillary_only';

const REPORT_PATH: Record<TabKey, string> = {
  collections: 'collections',
  breakdown: 'fee-breakdown',
  performance: 'class-performance',
  trends: 'trends',
};

const BASE_TITLE: Record<TabKey, string> = {
  collections: 'Collections & Clearance Report',
  breakdown: 'Fee Breakdown Report',
  performance: 'Class Performance Report',
  trends: 'Payment Flow Trends',
};

const DEBT_LABEL: Record<DebtType, string> = {
  all: 'Invoice + Ancillary Debt',
  tuition_only: 'Invoice Only',
  ancillary_only: 'Ancillary Debt Only',
};

// Every report response is stored with the tab (and group mode) it was
// fetched for, so a tab can never render another tab's leftover shape.
interface ReportState { tab: TabKey; groupBy: 'student' | 'parent'; body: any; }

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
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // ── "Super Filter" State ──
  const [filterSessionId, setFilterSessionId] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string>('');
  const [isCumulative, setIsCumulative] = useState<boolean>(false);
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [filterSectionId, setFilterSectionId] = useState<string>('');
  const [specificFeeId, setSpecificFeeId] = useState<string>('');

  const [debtType, setDebtType] = useState<DebtType>('all');
  const [groupBy, setGroupBy] = useState<'student' | 'parent'>('student');
  const [thresholdPct, setThresholdPct] = useState<string>('');
  const [includeWards, setIncludeWards] = useState<boolean>(false);

  // ── Tab Navigation & Report Data State ──
  const [activeTab, setActiveTab] = useState<TabKey>('collections');
  const [dataLoading, setDataLoading] = useState(false);
  const [report, setReport] = useState<ReportState | null>(null);
  const [printedAt, setPrintedAt] = useState<string>(() => new Date().toLocaleString('en-GB'));
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

  // School letterhead details for the printed report — fetched once.
  useEffect(() => {
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => {});
  }, []);

  const logoUrl = useMemo(() => {
    const p: string | undefined = schoolInfo?.logo;
    if (!p) return undefined;
    if (/^(https?:|data:|blob:)/.test(p)) return p;
    return `${getApiUrl()}${p.startsWith('/') ? '' : '/'}${p}`;
  }, [schoolInfo]);

  // Warm the browser cache so the logo is ready the moment someone prints.
  useEffect(() => {
    if (logoUrl) { const img = new Image(); img.src = logoUrl; }
  }, [logoUrl]);

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

  // A family-bound fee (PTA, Yearbook...) has no per-student rows, so student
  // grouping would come back empty — force the family rollup instead.
  const selectedFee = useMemo(() => feesList.find(f => f.id?.toString() === specificFeeId), [feesList, specificFeeId]);
  const feeIsFamilyBound = !!selectedFee?.parent_bound;
  useEffect(() => {
    if (feeIsFamilyBound && groupBy !== 'parent') setGroupBy('parent');
  }, [feeIsFamilyBound, groupBy]);

  // ── One params builder shared by the fetch and the CSV export ──
  const buildParams = useCallback((tab: TabKey): Record<string, any> => {
    switch (tab) {
      case 'collections':
        return {
          session_id: filterSessionId, period_id: filterPeriodId, cumulative: isCumulative,
          class_id: filterClassId, section_id: filterSectionId, fee_id: specificFeeId,
          debt_type: debtType, group_by: groupBy, threshold_pct: thresholdPct,
          include_wards: groupBy === 'parent' && includeWards,
        };
      case 'breakdown':
        return {
          session_id: filterSessionId, period_id: filterPeriodId, cumulative: isCumulative,
          class_id: filterClassId, section_id: filterSectionId, debt_type: debtType,
        };
      case 'performance':
        return { session_id: filterSessionId, period_id: filterPeriodId, cumulative: isCumulative, debt_type: debtType };
      case 'trends':
      default:
        return { session_id: filterSessionId, days: 30 };
    }
  }, [
    filterSessionId, filterPeriodId, isCumulative, filterClassId, filterSectionId,
    specificFeeId, debtType, groupBy, thresholdPct, includeWards,
  ]);

  // ── Fetch Report Data ──
  const fetchReport = useCallback(async () => {
    if (!filterSessionId) return;
    const requestId = ++fetchRequestIdRef.current;
    const tab = activeTab;
    const gb = groupBy;
    setDataLoading(true);

    try {
      const res = await api.get(`${getApiUrl()}/api/fee/reports/${REPORT_PATH[tab]}/`, {
        params: cleanParams(buildParams(tab)),
      });
      if (requestId !== fetchRequestIdRef.current) return;
      setReport({ tab, groupBy: gb, body: res.data });
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      showToast('error', extractError(err));
    } finally {
      if (requestId === fetchRequestIdRef.current) setDataLoading(false);
    }
  }, [activeTab, groupBy, filterSessionId, buildParams, showToast]);

  useEffect(() => {
    if (!loading) fetchReport();
  }, [fetchReport, loading]);

  // Only ever hand a tab the response that was fetched for that tab.
  const body = report && report.tab === activeTab ? report.body : null;
  const rowList: any[] | null = body === null ? null : (Array.isArray(body?.results) ? body.results : []);
  const dataGroupBy = report && report.tab === 'collections' ? report.groupBy : groupBy;

  // ── Labels: filenames, print title, and the printed filter summary ──
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
    const parts = [BASE_TITLE[activeTab]];
    if (filterLabels.session_label) parts.push(filterLabels.session_label);
    if (filterLabels.period_label) parts.push(`${isCumulative ? 'From ' : ''}${filterLabels.period_label}`);
    if ((activeTab === 'collections' || activeTab === 'breakdown') && filterLabels.class_label) parts.push(filterLabels.class_label);
    if ((activeTab === 'collections' || activeTab === 'breakdown') && debtType !== 'all') parts.push(debtType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()));
    if (activeTab === 'collections' && thresholdPct) parts.push(`Min ${thresholdPct}% Cleared`);
    return parts.join(' — ');
  }, [activeTab, filterLabels, isCumulative, debtType, thresholdPct]);

  const printFilters = useMemo(() => {
    const f: string[] = [];
    if (filterLabels.session_label) f.push(`Session ${filterLabels.session_label}`);
    if (activeTab === 'trends') {
      f.push('Last 30 days');
      return f;
    }
    if (filterLabels.period_label) f.push(isCumulative ? `${filterLabels.period_label} and earlier terms` : filterLabels.period_label);
    else f.push('All terms');

    if (activeTab === 'collections' || activeTab === 'breakdown') {
      if (filterLabels.class_label) f.push(`Class: ${filterLabels.class_label}`);
      const sec = sections.find(s => s.id?.toString() === filterSectionId);
      if (sec) f.push(`Arm: ${sec.name}`);
    }
    if (activeTab === 'collections') {
      if (selectedFee) f.push(`Fee: ${selectedFee.name}`);
      f.push(`Grouped by ${groupBy === 'parent' ? 'parent' : 'student'}`);
      if (thresholdPct) f.push(`Min ${thresholdPct}% cleared`);
    }
    if (debtType !== 'all') f.push(DEBT_LABEL[debtType]);
    return f;
  }, [activeTab, filterLabels, isCumulative, sections, filterSectionId, selectedFee, groupBy, thresholdPct, debtType]);

  // ── CSV export: always the FULL filtered dataset ──
  const handleExportCsv = async () => {
    const params = cleanParams({
      ...buildParams(activeTab),
      session_label: filterLabels.session_label,
      period_label: filterLabels.period_label,
      class_label: filterLabels.class_label,
    });
    params.export = 'csv';

    try {
      const res = await api.get(`${getApiUrl()}/api/fee/reports/${REPORT_PATH[activeTab]}/`, {
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportTitle}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  // ── PDF: browser print of the loaded (full, filtered) dataset, with the
  // school letterhead. "Save as PDF" in the print dialog gives the file. ──
  const handleExportPdf = () => {
    setPrintedAt(new Date().toLocaleString('en-GB'));
    setTimeout(() => window.print(), 80);
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

  const landscape = activeTab === 'collections' || activeTab === 'breakdown';
  const tabBtn = (key: TabKey) =>
    `flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === key ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`;
  const selectCls = 'w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50';
  const labelCls = 'block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5';

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-0 animate-in fade-in duration-300 print:p-0 print:pb-0 print:space-y-0 print:max-w-none">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Financial Reports</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Collections, fee breakdown, class performance and payment trends.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'collections' && groupBy === 'parent' && (
            <label className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={includeWards} onChange={e => setIncludeWards(e.target.checked)} className="accent-indigo-600" />
              <Users className="w-3.5 h-3.5 text-slate-500" /> Show wards
            </label>
          )}
          <button onClick={handleExportCsv} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Export CSV
          </button>
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
            <label className={labelCls}>Session</label>
            <select value={filterSessionId} onChange={e => setFilterSessionId(e.target.value)} className={selectCls}>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Term</label>
            <select value={filterPeriodId} onChange={e => setFilterPeriodId(e.target.value)} className={selectCls}>
              <option value="">All Terms</option>
              {periods.filter(p => p.session?.id.toString() === filterSessionId).map(p => (
                <option key={p.id} value={p.id}>{p.name || p.period?.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Term Scope</label>
            <select value={isCumulative ? 'true' : 'false'} onChange={e => setIsCumulative(e.target.value === 'true')} disabled={!filterPeriodId} className={selectCls}>
              <option value="false">Selected Term Only</option>
              <option value="true">Selected Term Downward (Cumulative)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Debt Source</label>
            <select value={debtType} onChange={e => setDebtType(e.target.value as DebtType)} disabled={activeTab === 'collections' && !!specificFeeId} className={selectCls}>
              <option value="all">Invoice + Ancillary Debt (Combined)</option>
              <option value="tuition_only">Invoice Only</option>
              <option value="ancillary_only">Ancillary Debt Only (Fines, etc.)</option>
            </select>
          </div>

          <div>
            <label className={labelCls}>Class</label>
            <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} disabled={activeTab === 'performance' || activeTab === 'trends'} className={selectCls}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Arm / Section</label>
            <select value={filterSectionId} onChange={e => setFilterSectionId(e.target.value)} disabled={!filterClassId || availableSections.length === 0 || activeTab === 'performance' || activeTab === 'trends'} className={selectCls}>
              <option value="">All Arms</option>
              {availableSections.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Specific Fee</label>
            <select value={specificFeeId} onChange={e => setSpecificFeeId(e.target.value)} disabled={activeTab !== 'collections'} className={selectCls}>
              <option value="">All Fees</option>
              {feesList.map(fee => <option key={fee.id} value={fee.id}>{fee.name}{fee.parent_bound ? ' (Family)' : ''}</option>)}
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelCls}>Group By</label>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} disabled={activeTab !== 'collections' || feeIsFamilyBound} title={feeIsFamilyBound ? 'Family fees are always grouped by parent' : undefined} className={selectCls}>
                <option value="student">Student</option>
                <option value="parent">Parent (Family Rollup)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className={labelCls}>Min % Cleared</label>
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
        <button onClick={() => setActiveTab('collections')} className={tabBtn('collections')}>
          <FileText className="w-4 h-4" /> Collections & Clearance
        </button>
        <button onClick={() => setActiveTab('trends')} className={tabBtn('trends')}>
          <TrendingUp className="w-4 h-4" /> Payment Flow Trends
        </button>
        <button onClick={() => setActiveTab('performance')} className={tabBtn('performance')}>
          <PieChart className="w-4 h-4" /> Class Performance
        </button>
        <button onClick={() => setActiveTab('breakdown')} className={tabBtn('breakdown')}>
          <Layers className="w-4 h-4" /> Fee Breakdown
        </button>
      </div>

      {/* ── Print-only letterhead: school logo + details, report title, filters ── */}
      <PrintLetterhead
        schoolInfo={schoolInfo}
        logoUrl={logoUrl}
        title={BASE_TITLE[activeTab]}
        filters={printFilters}
        generatedAt={printedAt}
      />

      {/* ── TAB CONTENT RENDERING ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] relative print:border-0 print:shadow-none print:rounded-none print:min-h-0" ref={printRef}>
        {dataLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl print:hidden">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        )}

        <div className="p-1 print:p-0">
          {activeTab === 'collections' && (
            <CollectionsTab
              data={rowList}
              totals={body?.totals}
              familyTotals={body?.family_totals}
              groupBy={dataGroupBy}
              reportTitle={reportTitle}
            />
          )}
          {activeTab === 'trends' && <TrendsTab data={rowList} reportTitle={reportTitle} />}
          {activeTab === 'performance' && <ClassPerformanceTab data={rowList} totals={body?.totals} reportTitle={reportTitle} />}
          {activeTab === 'breakdown' && <FeeBreakdownTab data={body} reportTitle={reportTitle} />}
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 ${landscape ? 'landscape' : 'portrait'};
            margin: 1.2cm 1.2cm 1.6cm 1.2cm;
            @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; color: #94a3b8; }
          }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tfoot.print-once { display: table-row-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          tbody.print-group { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}