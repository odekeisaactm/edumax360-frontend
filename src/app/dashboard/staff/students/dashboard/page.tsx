'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { studentDashboardAPI, academicAPI } from '@/lib/api';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Users, GraduationCap, UserCheck, TrendingUp, BarChart2,
  Globe, Activity, Zap, RefreshCw, Loader2, AlertCircle,
  Check, X, ChevronDown, Heart, Shield, Key,
  Trash2, QrCode, UserPlus, ToggleLeft, ToggleRight,
  AlertTriangle, Download,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface OverviewData {
  totals: {
    students: number; parents: number;
    active_students: number; active_parents: number;
    male_students: number; female_students: number;
    male_parents: number; female_parents: number;
    special_needs: number;
    parents_with_wards: number; parents_without_wards: number;
    student_parent_ratio: number;
  };
  per_class: { current_class__name: string; current_class__order: number; count: number; }[];
  per_section: { current_class__school_section__name: string; count: number; }[];
  status_breakdown: { status: string; count: number; }[];
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16'];
const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899' };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d?.message) return String(d.message);
  if (d?.detail)  return String(d.detail);
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str: string): string {
  if (!str) return '—';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, loading }: {
  label: string; value: number | string; sub?: string;
  icon: any; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        {loading
          ? <div className="h-7 w-16 bg-slate-100 rounded animate-pulse mt-1" />
          : <p className="text-2xl font-bold text-slate-800 leading-tight">{value}</p>
        }
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
function SectionCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div>
          <p className="text-sm font-bold text-slate-900">{title}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Empty Chart ──────────────────────────────────────────────────────────────
function EmptyChart({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="text-center">
        <BarChart2 className="h-8 w-8 text-slate-200 mx-auto mb-2" />
        <p className="text-xs text-slate-400">{message}</p>
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────
function ActionBtn({ icon: Icon, label, desc, color, danger, onClick, loading, disabled }: {
  icon: any; label: string; desc: string; color: string; danger?: boolean;
  onClick: () => void; loading?: boolean; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading || disabled}
      className={`w-full flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
        danger
          ? 'border-red-100 hover:border-red-300 hover:bg-red-50'
          : 'border-slate-100 hover:border-blue-200 hover:bg-blue-50/40'
      } disabled:opacity-50 disabled:cursor-not-allowed`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${color} shadow-sm`}>
        {loading ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Icon className="h-4 w-4 text-white" />}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-bold ${danger ? 'text-red-700' : 'text-slate-800'}`}>{label}</p>
        <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, danger, onConfirm, onCancel, loading }: {
  open: boolean; title: string; message: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
          <AlertTriangle className={`h-6 w-6 ${danger ? 'text-red-600' : 'text-blue-600'}`} />
        </div>
        <h3 className="text-base font-bold text-slate-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}>
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ type, message, onDismiss }: { type: 'success'|'error'; message: string; onDismiss: () => void }) {
  return (
    <div className={`fixed top-4 right-4 z-[70] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
      ${type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
      {type === 'success'
        ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
        : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
      <p className="text-sm font-medium flex-1 leading-snug">{message}</p>
      <button onClick={onDismiss} className="opacity-50 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',    label: 'Overview',    icon: Activity   },
  { id: 'students',    label: 'Students',    icon: GraduationCap },
  { id: 'admissions',  label: 'Admissions',  icon: TrendingUp },
  { id: 'demographics',label: 'Demographics',icon: Globe      },
  { id: 'guardians',   label: 'Guardians',   icon: UserCheck  },
  { id: 'actions',     label: 'Actions',     icon: Zap        },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentDashboardPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Data
  const [overview,      setOverview]      = useState<OverviewData | null>(null);
  const [admissions,    setAdmissions]    = useState<any>(null);
  const [classDist,     setClassDist]     = useState<any>(null);
  const [demographics,  setDemographics]  = useState<any>(null);
  const [guardianStats, setGuardianStats] = useState<any>(null);
  const [classes,       setClasses]       = useState<any[]>([]);

  // Loading states
  const [loadingOverview,    setLoadingOverview]    = useState(false);
  const [loadingAdmissions,  setLoadingAdmissions]  = useState(false);
  const [loadingClassDist,   setLoadingClassDist]   = useState(false);
  const [loadingDemographics,setLoadingDemographics]= useState(false);
  const [loadingGuardians,   setLoadingGuardians]   = useState(false);

  // Filters
  const [admissionClassFilter, setAdmissionClassFilter] = useState('');
  const [classDistSession,     setClassDistSession]     = useState('');
  const [demoClass,            setDemoClass]            = useState('');
  const [demoSession,          setDemoSession]          = useState('');

  // Actions
  const [confirm, setConfirm] = useState<{ action: string; title: string; message: string; danger?: boolean } | null>(null);
  const [runningAction, setRunningAction] = useState(false);
  const [actionResults, setActionResults] = useState<Record<string, { affected: number; message: string }>>({});
  const [toast, setToast] = useState<{ type: 'success'|'error'; message: string } | null>(null);

  const canAdmin = user?.is_superuser || hasPermission('student_management.view_statistics');

  const showToast = (type: 'success'|'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  // Load overview on mount and when tab changes
  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    try { setOverview(await studentDashboardAPI.getOverview()); }
    catch (e) { showToast('error', extractError(e)); }
    finally { setLoadingOverview(false); }
  }, []);

  const loadAdmissions = useCallback(async () => {
    setLoadingAdmissions(true);
    try {
      const params: any = {};
      if (admissionClassFilter) params.class_id = admissionClassFilter;
      setAdmissions(await studentDashboardAPI.getAdmissions(params));
    } catch (e) { showToast('error', extractError(e)); }
    finally { setLoadingAdmissions(false); }
  }, [admissionClassFilter]);

  const loadClassDist = useCallback(async () => {
    setLoadingClassDist(true);
    try {
      const params: any = {};
      if (classDistSession) params.session_id = classDistSession;
      setClassDist(await studentDashboardAPI.getClassDistribution(params));
    } catch (e) { showToast('error', extractError(e)); }
    finally { setLoadingClassDist(false); }
  }, [classDistSession]);

  const loadDemographics = useCallback(async () => {
    setLoadingDemographics(true);
    try {
      const params: any = {};
      if (demoClass)   params.class_id   = demoClass;
      if (demoSession) params.session_id = demoSession;
      setDemographics(await studentDashboardAPI.getDemographics(params));
    } catch (e) { showToast('error', extractError(e)); }
    finally { setLoadingDemographics(false); }
  }, [demoClass, demoSession]);

  const loadGuardianStats = useCallback(async () => {
    setLoadingGuardians(true);
    try { setGuardianStats(await studentDashboardAPI.getGuardianStats()); }
    catch (e) { showToast('error', extractError(e)); }
    finally { setLoadingGuardians(false); }
  }, []);

  // Initial load
  useEffect(() => {
    loadOverview();
    academicAPI.listClasses().then((c: any[]) => setClasses(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  // Tab-triggered loads
  useEffect(() => {
    if (activeTab === 'admissions'  && !admissions)    loadAdmissions();
    if (activeTab === 'students'    && !classDist)      loadClassDist();
    if (activeTab === 'demographics'&& !demographics)  loadDemographics();
    if (activeTab === 'guardians'   && !guardianStats)  loadGuardianStats();
  }, [activeTab]);

  // Re-load on filter change
  useEffect(() => { if (activeTab === 'admissions')   loadAdmissions();  }, [admissionClassFilter]);
  useEffect(() => { if (activeTab === 'students')     loadClassDist();   }, [classDistSession]);
  useEffect(() => { if (activeTab === 'demographics') loadDemographics();}, [demoClass, demoSession]);

  const runAction = async () => {
    if (!confirm) return;
    setRunningAction(true);
    try {
      const result = await studentDashboardAPI.executeAction(confirm.action);
      setActionResults(prev => ({ ...prev, [confirm.action]: result }));
      showToast('success', result.message);
      // Refresh overview after action
      loadOverview();
    } catch (e) {
      showToast('error', extractError(e));
    } finally {
      setRunningAction(false);
      setConfirm(null);
    }
  };

  const triggerAction = (action: string, title: string, message: string, danger?: boolean) => {
    setConfirm({ action, title, message, danger });
  };

  const sessions = admissions?.sessions || [];
  const t = overview?.totals;

  const selectCls = 'px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white text-slate-700';

  return (
    <div className="space-y-5 pb-10">
      {toast && <Toast type={toast.type} message={toast.message} onDismiss={() => setToast(null)} />}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ''}
        message={confirm?.message || ''}
        danger={confirm?.danger}
        onConfirm={runAction}
        onCancel={() => setConfirm(null)}
        loading={runningAction}
      />

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <BarChart2 className="h-5 w-5 text-white" />
            </div>
            Student Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Analytics, insights and bulk operations</p>
        </div>
        <button onClick={() => { loadOverview(); if (activeTab === 'admissions') loadAdmissions(); if (activeTab === 'students') loadClassDist(); if (activeTab === 'demographics') loadDemographics(); if (activeTab === 'guardians') loadGuardianStats(); }}
          className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Top KPI Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Total Students" value={t?.students ?? 0}     sub={`${t?.active_students ?? 0} active`}  icon={GraduationCap} color="from-blue-500 to-blue-600"    loading={loadingOverview} />
        <StatCard label="Total Guardians" value={t?.parents ?? 0}     sub={`${t?.active_parents ?? 0} active`}   icon={UserCheck}     color="from-emerald-500 to-teal-600"  loading={loadingOverview} />
        <StatCard label="Male Students"   value={t?.male_students ?? 0}   icon={Users}         color="from-sky-500 to-blue-600"      loading={loadingOverview} />
        <StatCard label="Female Students" value={t?.female_students ?? 0} icon={Users}         color="from-pink-500 to-rose-500"     loading={loadingOverview} />
        <StatCard label="Special Needs"   value={t?.special_needs ?? 0}   icon={Heart}         color="from-rose-400 to-pink-500"     loading={loadingOverview} />
        <StatCard label="Student:Parent"  value={`${t?.student_parent_ratio ?? 0}:1`} sub="ratio" icon={TrendingUp} color="from-violet-500 to-purple-600" loading={loadingOverview} />
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2 flex-shrink-0 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">

          {/* ══ OVERVIEW TAB ══ */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Status breakdown */}
                <SectionCard title="Student Status Breakdown" subtitle="All students by enrolment status">
                  {loadingOverview ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (overview?.status_breakdown?.length ?? 0) === 0 ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={overview!.status_breakdown.map(s => ({ name: toTitleCase(s.status), value: s.count }))}
                          cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}>
                          {overview!.status_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                {/* Gender comparison */}
                <SectionCard title="Gender Distribution" subtitle="Students vs Guardians">
                  {loadingOverview ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={[
                        { name: 'Students', Male: t?.male_students ?? 0, Female: t?.female_students ?? 0 },
                        { name: 'Guardians', Male: t?.male_parents ?? 0, Female: t?.female_parents ?? 0 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Bar dataKey="Male"   fill={GENDER_COLORS.male}   radius={[4,4,0,0]} />
                        <Bar dataKey="Female" fill={GENDER_COLORS.female} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                {/* Per section */}
                <SectionCard title="Students by School Section" subtitle="Current active enrollment">
                  {loadingOverview ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (overview?.per_section?.length ?? 0) === 0 ? <EmptyChart message="No section data" />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={overview!.per_section.map(s => ({
                          name: s['current_class__school_section__name'] || 'Unknown',
                          value: s.count,
                        }))} cx="50%" cy="50%" outerRadius={75} dataKey="value">
                          {overview!.per_section.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                {/* Guardian quick stats */}
                <SectionCard title="Guardian Summary" subtitle="Wards and portal status">
                  <div className="space-y-3">
                    {[
                      { label: 'With wards',      value: t?.parents_with_wards ?? 0,    color: 'text-emerald-600' },
                      { label: 'Without wards',   value: t?.parents_without_wards ?? 0, color: 'text-orange-500' },
                      { label: 'Male guardians',  value: t?.male_parents ?? 0,          color: 'text-blue-600'   },
                      { label: 'Female guardians',value: t?.female_parents ?? 0,        color: 'text-pink-600'   },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-sm text-slate-600">{label}</span>
                        <span className={`text-sm font-bold ${color}`}>{loadingOverview ? '…' : value}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>

              {/* Students per class bar */}
              <SectionCard title="Students per Class" subtitle="Current active enrollment by class">
                {loadingOverview ? <div className="h-52 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                : (overview?.per_class?.length ?? 0) === 0 ? <EmptyChart message="No class data" />
                : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={overview!.per_class.map(c => ({
                      name: c['current_class__name'] || 'Unknown',
                      Students: c.count,
                    }))} margin={{ left: 0, right: 10, top: 5, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="Students" fill="#3b82f6" radius={[4,4,0,0]}>
                        {overview!.per_class.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </SectionCard>
            </div>
          )}

          {/* ══ STUDENTS TAB ══ */}
          {activeTab === 'students' && (
            <div className="space-y-5">
              {/* Session filter */}
              <div className="flex items-center gap-3 flex-wrap">
                <select value={classDistSession} onChange={e => setClassDistSession(e.target.value)} className={selectCls}>
                  <option value="">Current enrollment</option>
                  {sessions.map((s: any) => <option key={s.session_id || s.id} value={s.session_id || s.id}>{s.session_label || s.label}</option>)}
                </select>
                {loadingClassDist && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SectionCard title="Students per Class" subtitle="Total per class level">
                  {loadingClassDist ? <div className="h-52 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (classDist?.per_class?.length ?? 0) === 0 ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={classDist.per_class.map((c: any) => ({
                        name: c['class_config__student_class__name'] || c['current_class__name'] || 'Unknown',
                        Male: c.male, Female: c.female, Total: c.count,
                      }))} margin={{ bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Bar dataKey="Male"   fill={GENDER_COLORS.male}   radius={[4,4,0,0]} stackId="a" />
                        <Bar dataKey="Female" fill={GENDER_COLORS.female} radius={[4,4,0,0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                <SectionCard title="Students per Section" subtitle="Distribution by school section">
                  {loadingClassDist ? <div className="h-52 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (classDist?.per_section?.length ?? 0) === 0 ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={classDist.per_section.map((s: any) => ({
                          name: s['class_config__student_class__school_section__name'] || s['current_class__school_section__name'] || 'Unknown',
                          value: s.count,
                        }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                          {classDist.per_section.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>
              </div>
            </div>
          )}

          {/* ══ ADMISSIONS TAB ══ */}
          {activeTab === 'admissions' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <select value={admissionClassFilter} onChange={e => setAdmissionClassFilter(e.target.value)} className={selectCls}>
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {loadingAdmissions && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
              </div>

              <SectionCard title="New Admissions per Session" subtitle="Students admitted per academic session with gender breakdown">
                {loadingAdmissions ? <div className="h-64 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                : (admissions?.admissions_per_session?.length ?? 0) === 0
                  ? <EmptyChart message="No admission history found" />
                  : (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={admissions.admissions_per_session.map((s: any) => ({
                        name: s.session_label, Male: s.male, Female: s.female, Total: s.total,
                      }))} margin={{ bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                        <Bar dataKey="Male"   fill={GENDER_COLORS.male}   radius={[4,4,0,0]} />
                        <Bar dataKey="Female" fill={GENDER_COLORS.female} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
              </SectionCard>

              {/* Trend line */}
              {(admissions?.admissions_per_session?.length ?? 0) > 1 && (
                <SectionCard title="Admission Trend" subtitle="Total new admissions over time">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={admissions.admissions_per_session.map((s: any) => ({
                      name: s.session_label, Admissions: s.total,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="Admissions" stroke="#3b82f6" strokeWidth={2.5}
                        dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </SectionCard>
              )}

              {/* Note about first-year data */}
              <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  The first session of data may include existing students registered during initial setup,
                  not just new admissions. This may cause the first bar to appear inflated.
                </p>
              </div>
            </div>
          )}

          {/* ══ DEMOGRAPHICS TAB ══ */}
          {activeTab === 'demographics' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 flex-wrap">
                <select value={demoClass} onChange={e => setDemoClass(e.target.value)} className={selectCls}>
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={demoSession} onChange={e => setDemoSession(e.target.value)} className={selectCls}>
                  <option value="">All sessions</option>
                  {sessions.map((s: any) => <option key={s.session_id || s.id} value={s.session_id || s.id}>{s.session_label || s.label}</option>)}
                </select>
                {loadingDemographics && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                {demographics && <span className="text-xs text-slate-400">{demographics.total_filtered} students</span>}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Religion */}
                <SectionCard title="Religion Distribution" subtitle="Active students by religion">
                  {loadingDemographics ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (demographics?.religion?.length ?? 0) === 0 ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={demographics.religion.map((r: any) => ({
                          name: toTitleCase(r.religion || 'Unknown'), value: r.count,
                        }))} cx="50%" cy="50%" outerRadius={75} dataKey="value">
                          {demographics.religion.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                {/* Age */}
                <SectionCard title="Age Distribution" subtitle="Students by age group">
                  {loadingDemographics ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (demographics?.age_distribution?.length ?? 0) === 0 ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={demographics.age_distribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Students" radius={[4,4,0,0]}>
                          {demographics.age_distribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                {/* State */}
                <div className="lg:col-span-2">
                  <SectionCard title="State of Origin" subtitle="Top 15 states (active students)">
                    {loadingDemographics ? <div className="h-52 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                    : (demographics?.state_distribution?.length ?? 0) === 0 ? <EmptyChart message="No state data" />
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={demographics.state_distribution.map((s: any) => ({
                          name: s.state, Students: s.count,
                        }))} margin={{ bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Bar dataKey="Students" radius={[4,4,0,0]}>
                            {demographics.state_distribution.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </SectionCard>
                </div>
              </div>
            </div>
          )}

          {/* ══ GUARDIANS TAB ══ */}
          {activeTab === 'guardians' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Gender */}
                <SectionCard title="Guardian Gender" subtitle="Male vs Female breakdown">
                  {loadingGuardians ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (guardianStats?.gender?.length ?? 0) === 0 ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={guardianStats.gender.map((g: any) => ({
                          name: toTitleCase(g.gender || 'Unknown'), value: g.count,
                        }))} cx="50%" cy="50%" outerRadius={75} dataKey="value">
                          {guardianStats.gender.map((g: any, i: number) => (
                            <Cell key={i} fill={g.gender === 'male' ? GENDER_COLORS.male : g.gender === 'female' ? GENDER_COLORS.female : COLORS[i]} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                {/* Wards distribution */}
                <SectionCard title="Wards per Guardian" subtitle="How many children each guardian has">
                  {loadingGuardians ? <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (guardianStats?.wards_dist?.length ?? 0) === 0 ? <EmptyChart />
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={guardianStats.wards_dist.map((w: any) => ({
                        name: `${w.ward_count} ward${w.ward_count !== 1 ? 's' : ''}`,
                        Guardians: w.parent_count,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="Guardians" fill="#10b981" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </SectionCard>

                {/* Portal stats */}
                <SectionCard title="Portal Access" subtitle="Guardian portal account status">
                  {loadingGuardians ? <div className="h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : !guardianStats?.portal_stats ? <EmptyChart />
                  : (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'With account',    value: guardianStats.portal_stats.with_account,    color: 'text-emerald-600' },
                        { label: 'Without account', value: guardianStats.portal_stats.without_account, color: 'text-orange-500'  },
                        { label: 'Active portal',   value: guardianStats.portal_stats.active_portal,   color: 'text-blue-600'    },
                        { label: 'Suspended',       value: guardianStats.portal_stats.suspended_portal, color: 'text-red-500'    },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                          <p className={`text-xl font-bold ${color}`}>{value}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                {/* Top occupations */}
                <SectionCard title="Top Occupations" subtitle="Most common guardian occupations">
                  {loadingGuardians ? <div className="h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-400" /></div>
                  : (guardianStats?.occupations?.length ?? 0) === 0 ? <EmptyChart message="No occupation data" />
                  : (
                    <div className="space-y-2">
                      {guardianStats.occupations.slice(0, 7).map((o: any, i: number) => {
                        const max = guardianStats.occupations[0]?.count || 1;
                        const pct = Math.round((o.count / max) * 100);
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-slate-600 w-28 truncate">{toTitleCase(o.occupation)}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                              <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 w-6 text-right">{o.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          )}

          {/* ══ ACTIONS TAB ══ */}
          {activeTab === 'actions' && (
            <div className="space-y-6">
              {!canAdmin && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                  <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700">You need admin permissions to run bulk actions.</p>
                </div>
              )}

              {/* Account generation */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Account Generation</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ActionBtn icon={Key} label="Generate Student Accounts"
                    desc="Create login accounts for active students who don't have one"
                    color="from-blue-500 to-blue-600"
                    loading={runningAction && confirm?.action === 'generate_student_accounts'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('generate_student_accounts', 'Generate Student Accounts',
                      'This will create login accounts for all active students without one. The system will use your configured username and password settings.')} />
                  <ActionBtn icon={UserPlus} label="Generate Guardian Accounts"
                    desc="Create login accounts for active guardians who don't have one"
                    color="from-emerald-500 to-teal-600"
                    loading={runningAction && confirm?.action === 'generate_parent_accounts'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('generate_parent_accounts', 'Generate Guardian Accounts',
                      'This will create portal accounts for all active guardians without one.')} />
                  <ActionBtn icon={QrCode} label="Generate Student Barcodes"
                    desc="Generate barcodes for all active students without one (barcode must be enabled)"
                    color="from-violet-500 to-purple-600"
                    loading={runningAction && confirm?.action === 'generate_student_barcodes'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('generate_student_barcodes', 'Generate Barcodes',
                      'This will generate barcodes for all active students without one. Barcode generation must be enabled in settings.')} />
                </div>
              </div>

              {/* Portal access */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Portal Access Control</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ActionBtn icon={ToggleRight} label="Activate Student Portal"
                    desc="Re-enable portal access for all student accounts"
                    color="from-emerald-500 to-emerald-600"
                    loading={runningAction && confirm?.action === 'activate_student_portal'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('activate_student_portal', 'Activate Student Portal',
                      'This will re-enable portal login for all student accounts that are currently deactivated.')} />
                  <ActionBtn icon={ToggleLeft} label="Deactivate Student Portal"
                    desc="Disable portal access for all student accounts"
                    color="from-orange-400 to-amber-500"
                    loading={runningAction && confirm?.action === 'deactivate_student_portal'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('deactivate_student_portal', 'Deactivate Student Portal',
                      'This will disable portal login for all student accounts. Students will not be able to log in until reactivated.', true)} />
                  <ActionBtn icon={ToggleRight} label="Activate Guardian Portal"
                    desc="Re-enable portal access for all guardian accounts"
                    color="from-emerald-500 to-emerald-600"
                    loading={runningAction && confirm?.action === 'activate_parent_portal'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('activate_parent_portal', 'Activate Guardian Portal',
                      'This will re-enable portal login for all guardian accounts that are currently deactivated.')} />
                  <ActionBtn icon={ToggleLeft} label="Deactivate Guardian Portal"
                    desc="Disable portal access for all guardian accounts"
                    color="from-orange-400 to-amber-500"
                    loading={runningAction && confirm?.action === 'deactivate_parent_portal'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('deactivate_parent_portal', 'Deactivate Guardian Portal',
                      'This will disable portal login for all guardian accounts. Guardians will not be able to log in until reactivated.', true)} />
                </div>
              </div>

              {/* Cleanup */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Cleanup</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ActionBtn icon={Trash2} label="Delete Guardians Without Wards"
                    desc="Permanently remove all guardian records with no linked students"
                    color="from-red-500 to-red-600" danger
                    loading={runningAction && confirm?.action === 'delete_parents_without_wards'}
                    disabled={!canAdmin}
                    onClick={() => triggerAction('delete_parents_without_wards', 'Delete Guardians Without Wards',
                      'This will permanently delete all guardian records that have no linked students. This cannot be undone. Their login accounts will also be removed.', true)} />
                </div>
              </div>

              {/* Recent action results */}
              {Object.keys(actionResults).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Results</p>
                  <div className="space-y-2">
                    {Object.entries(actionResults).map(([action, result]) => (
                      <div key={action} className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-emerald-800">{result.message}</p>
                          <p className="text-[11px] text-emerald-600 font-mono">{action}</p>
                        </div>
                        <span className="text-lg font-bold text-emerald-700">{result.affected}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}