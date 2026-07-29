'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { feeAPI, academicCalendarAPI, api, studentsAPI } from '@/lib/api';
import { Session, AcademicSessionPeriod } from '@/lib/types';
import {
  Search, X, CheckCircle2, AlertCircle, Loader2,
  Tag, History, Lock, ShieldCheck, Users,
  Calendar, Layers, Percent, Hash, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Box, ArrowLeft, ArrowRight
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const PAGE_SIZE = 25;

function getStudentImage(imgUrl?: string | null) {
  if (!imgUrl || imgUrl.trim() === '') return '/images/default-avatar.png';
  if (imgUrl.startsWith('http')) return imgUrl;
  return `${API_BASE_URL}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str?: string | null): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtMoney(v: string | number) {
  return Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderRateLock(type: string, amount: string) {
  const isPct = type === 'percentage';
  const val = isPct ? `${Number(amount)}%` : `₦${fmtMoney(amount)}`;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${
      isPct ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }`}>
      {isPct ? <Percent className="w-2.5 h-2.5" /> : <Hash className="w-2.5 h-2.5" />} {val}
    </span>
  );
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
          : <AlertCircle className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Student Search Component ─────────────────────────────────────────────────
const StudentSearch = ({ onSelect }: { onSelect: (s: any) => void }) => {
  const [query, setQuery] = useState('');
  const [results, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSearch = async (val: string) => {
    if (val.length < 3) { setSearchResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    try {
      const res = await studentsAPI.list({ search: val });
      setSearchResults((res as any).results || res || []);
    } catch (e) {
      setSearchResults([]);
    } finally { setIsSearching(false); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length >= 3) {
      setIsSearching(true);
      debounceRef.current = setTimeout(() => executeSearch(val), 400);
    } else {
      setSearchResults([]); setIsSearching(false);
    }
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
        <input
          type="text" value={query} onChange={handleInputChange} onFocus={() => setShowDropdown(true)}
          placeholder="Search by student name or registration number..."
          className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-slate-800 font-medium"
        />
        {query && (
          <button onClick={() => { setQuery(''); setSearchResults([]); setShowDropdown(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-100 shadow-lg z-[60] overflow-hidden max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {query.length < 3 ? (
            <div className="p-6 text-center text-slate-500 text-sm font-medium">Please type at least 3 characters to search...</div>
          ) : isSearching ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center">
              <Loader2 className="w-6 h-6 animate-spin mb-3 text-indigo-500" />
              <span className="text-sm font-medium">Searching archive...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {results.map(s => {
                const fullName = toTitleCase(s.full_name || `${s.first_name} ${s.last_name}`);
                const classDisplay = [s.current_class_name, s.current_class_section_name].filter(Boolean).join(' ');
                const isInactive = s.status === 'graduated' || s.status === 'transferred' || s.status === 'withdrawn';

                return (
                  <button key={s.id} onClick={() => { onSelect(s); setQuery(''); setShowDropdown(false); }} className="w-full flex items-center justify-between p-4 text-left hover:bg-indigo-50/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <img src={getStudentImage(s.image_url || s.image)} alt={fullName} className="w-10 h-10 rounded-full object-cover border border-slate-200" onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{fullName}</p>
                          {isInactive && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-500 border-slate-200">{s.status}</span>}
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">
                          {s.registration_number} {!isInactive && classDisplay ? `• ${classDisplay}` : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center flex flex-col items-center">
              <Search className="w-8 h-8 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-600">No students found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DiscountAuditPage() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4500);
  }, []);

  // ── Global State ──
  const [activeTab, setActiveTab] = useState<'beneficiaries' | 'locks' | 'history'>('beneficiaries');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [periods, setPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [classConfigs, setClassConfigs] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Audit Filters (Tabs 1 & 2) ──
  const [filterSession, setFilterSession] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterDiscount, setFilterDiscount] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Tab 1: Term Beneficiaries State ──
  const [groupedBeneficiaries, setGroupedBeneficiaries] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalImpact, setTotalImpact] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // ── Tab 2: Rate Locks State ──
  const [rateLocks, setRateLocks] = useState<any[]>([]);

  // ── Tab 3: Student History State ──
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [studentHistoryData, setStudentHistoryData] = useState<any[]>([]);
  const [studentHistoryLoading, setStudentHistoryLoading] = useState(false);
  const [activeEnrollmentsModal, setActiveEnrollmentsModal] = useState<any[] | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initialization ──
  useEffect(() => {
    const init = async () => {
      try {
        const [sessRes, curSessRaw, clsRes, confRes, discRes] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicCalendarAPI.getCurrentSession(),
          api.get('/api/academic/classes/'),
          api.get('/api/academic/class-configurations/'),
          feeAPI.getDiscounts()
        ]);

        setSessions(Array.isArray(sessRes) ? sessRes : []);

        const classData = clsRes.data?.data?.results || clsRes.data?.data || clsRes.data || [];
        setClasses(Array.isArray(classData) ? classData : []);

        setClassConfigs(confRes.data?.data?.results || confRes.data?.data || confRes.data || []);
        setDiscounts(Array.isArray(discRes) ? discRes : ((discRes as any).results || []));

        const curSess = curSessRaw?.data?.data || curSessRaw?.data || curSessRaw;
        if (curSess?.id) {
          setFilterSession(curSess.id.toString());
          const perData = await academicCalendarAPI.listSessionPeriods({ session_id: curSess.id });
          setPeriods(perData);
          const curP = perData.find(p => p.is_current);
          if (curP) setFilterPeriod(curP.id.toString());
          else if (perData.length > 0) setFilterPeriod(perData[0].id.toString());
        }
      } catch (err) {
        console.error("Initialization Error:", err);
        showToast('warn', 'Failed to load some calendar defaults.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [showToast]);

  // Sync periods when session changes
  useEffect(() => {
    if (filterSession && !loading) {
      academicCalendarAPI.listSessionPeriods({ session_id: Number(filterSession) }).then(res => {
        setPeriods(res);
        if (res.length > 0 && !res.find(p => p.id.toString() === filterPeriod)) {
          setFilterPeriod(res[0].id.toString());
        }
      });
    }
  }, [filterSession, loading]);

  const filteredArms = useMemo(() => {
    if (!filterClass) return classConfigs;
    return classConfigs.filter(c => String(c.student_class) === filterClass);
  }, [classConfigs, filterClass]);

  // ── Fetch Tab 1 & Tab 2 Data ──
  const fetchAuditData = useCallback(async (pg = 1) => {
    if (activeTab === 'history' || !filterSession || !filterPeriod) return;
    setLoading(true);
    try {
      if (activeTab === 'beneficiaries') {
        const params: any = { session: filterSession, period: filterPeriod, page: pg, page_size: PAGE_SIZE };
        if (filterDiscount) params.discount = filterDiscount;
        if (filterClass) params.student_class = filterClass;
        if (filterSection) params.class_section = filterSection;
        if (searchQuery.trim()) params.search = searchQuery.trim();

        const data = await feeAPI.getGroupedAppliedDiscounts(params);
        setGroupedBeneficiaries(data.results || []);
        setTotalRecords(data.count || 0);
        setTotalImpact(parseFloat(data.total_impact || '0'));
        setPage(pg);
      } else if (activeTab === 'locks') {
        const params: any = { session: filterSession, period: filterPeriod };
        const data = await feeAPI.getDiscountApplications(params);
        setRateLocks(Array.isArray(data) ? data : (data.results || []));
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterSession, filterPeriod, filterDiscount, filterClass, filterSection, searchQuery, showToast]);

  // Auto-fetch when filters/tabs change
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchAuditData(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [fetchAuditData]);

  // Tab 1 Page Totals
  const tab1PageImpact = useMemo(() => {
    return groupedBeneficiaries.reduce((acc, g) => acc + parseFloat(g.total || '0'), 0);
  }, [groupedBeneficiaries]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  // ── Tab 3: History Loading ──
  const handleSelectHistoryStudent = async (student: any) => {
    setSelectedStudent(student);
    setStudentHistoryLoading(true);
    try {
      const data = await feeAPI.getAppliedDiscounts({ student: student.id });
      setStudentHistoryData(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setStudentHistoryLoading(false);
    }
  };

  const loadActiveEnrollments = async (studentId: number) => {
    try {
      const data = await feeAPI.getDiscountEnrollments({ student: studentId, is_active: true });
      setActiveEnrollmentsModal(Array.isArray(data) ? data : (data.results || []));
    } catch (err) {
      showToast('error', 'Failed to load active enrollments.');
    }
  };

  // Group history by term
  const historyByTerm = useMemo(() => {
    const map = new Map<string, { term_label: string; total: number; items: any[] }>();
    studentHistoryData.forEach(row => {
      const sName = row.session_display || 'Unknown Session';
      const pName = row.period_display || 'Unknown Term';
      const key = `${sName} — ${pName}`;

      if (!map.has(key)) map.set(key, { term_label: key, total: 0, items: [] });
      const g = map.get(key)!;
      g.items.push(row);
      g.total += parseFloat(row.amount_discounted || '0');
    });
    return Array.from(map.values()).sort((a, b) => {
      const aDate = a.items[0]?.created_at || '';
      const bDate = b.items[0]?.created_at || '';
      return bDate.localeCompare(aDate);
    });
  }, [studentHistoryData]);

  // UI Helpers
  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 bg-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium";
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center justify-between";

  return (
    <div className="max-w-[85rem] mx-auto pb-20 px-4 pt-6 bg-slate-50/50 min-h-screen">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* ── Page Header ── */}
      <div className="mb-5 print:hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-xl px-5 py-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <History className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest truncate">Financial Audit</p>
                <h1 className="text-lg font-bold text-white tracking-tight truncate">Discount Application History</h1>
              </div>
            </div>

            <div className="flex bg-white/10 p-1 rounded-lg border border-white/10 shrink-0">
              <button onClick={() => { setActiveTab('beneficiaries'); setExpandedRow(null); }} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'beneficiaries' ? 'bg-white text-indigo-900' : 'text-slate-300 hover:text-white'}`}>
                Term Audit
              </button>
              <button onClick={() => { setActiveTab('locks'); setExpandedRow(null); }} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'locks' ? 'bg-white text-indigo-900' : 'text-slate-300 hover:text-white'}`}>
                <Lock className="w-3.5 h-3.5" /> Rate Locks
              </button>
              <button onClick={() => { setActiveTab('history'); setExpandedRow(null); }} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${activeTab === 'history' ? 'bg-white text-indigo-900' : 'text-slate-300 hover:text-white'}`}>
                Student Audit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS 1 & 2: GLOBAL FILTERS ── */}
      {(activeTab === 'beneficiaries' || activeTab === 'locks') && (
        <div className="bg-white p-4 rounded-xl border border-slate-100 mb-5 animate-in slide-in-from-top-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className={labelCls}>Session</label>
              <select value={filterSession} onChange={e => setFilterSession(e.target.value)} className={inputCls}>
                <option value="">Select Session...</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.start_year}/{s.end_year}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Term / Period</label>
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} disabled={!filterSession} className={`${inputCls} disabled:opacity-50 disabled:bg-slate-50`}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name || (p as any).period?.name}</option>)}
              </select>
            </div>

            {activeTab === 'beneficiaries' && (
              <>
                <div>
                  <label className={labelCls}>Discount Program</label>
                  <select value={filterDiscount} onChange={e => setFilterDiscount(e.target.value)} className={inputCls}>
                    <option value="">All Programs</option>
                    {discounts.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Grade / Level</label>
                  <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterSection(''); }} className={inputCls}>
                    <option value="">All Grades</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Class Arm</label>
                  <select value={filterSection} onChange={e => setFilterSection(e.target.value)} disabled={!filterClass} className={`${inputCls} disabled:opacity-50 disabled:bg-slate-50`}>
                    <option value="">All Arms</option>
                    {filteredArms.map((arm: any) => {
                      const armValue = arm.class_section_id ? arm.class_section_id : arm.id;
                      const armLabel = arm.class_section_name ? arm.class_section_name : 'Main Arm';
                      return (
                        <option key={arm.id} value={armValue}>
                          {armLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            )}
          </div>

          {activeTab === 'beneficiaries' && (
            <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search Name or Reg No..." className={`${inputCls} pl-10`} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 1: TERM BENEFICIARIES ── */}
      {activeTab === 'beneficiaries' && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden min-h-[400px] animate-in fade-in slide-in-from-bottom-6 duration-500">

          {/* STATS BAR */}
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="mb-3.5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" /> Student Beneficiaries
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                Showing exact deductions applied to invoices during the selected term. Click a student to view the breakdown.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate">Page Impact</p>
                <p className="text-sm font-black text-slate-700 leading-tight break-words">₦{fmtMoney(tab1PageImpact)}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 min-w-0">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 truncate">Page Students</p>
                <p className="text-sm font-black text-slate-700 leading-tight">{groupedBeneficiaries.length}</p>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg px-3.5 py-2.5 min-w-0">
                <p className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1.5 truncate">Total Impact</p>
                <p className="text-sm font-black text-emerald-600 leading-tight break-words">₦{fmtMoney(totalImpact)}</p>
              </div>
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg px-3.5 py-2.5 min-w-0">
                <p className="text-[9px] font-bold text-indigo-600/70 uppercase tracking-widest mb-1.5 truncate">Total Students</p>
                <p className="text-sm font-black text-indigo-700 leading-tight">{totalRecords}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-500 mx-auto" /></div>
          ) : groupedBeneficiaries.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Box className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-600">No discounts applied</p>
              <p className="text-xs mt-1">No invoices in this term received a discount deduction based on your filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white border-b border-slate-100">
                      <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px] w-10"></th>
                      <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">Beneficiary Details</th>
                      <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-center">Applications</th>
                      <th className="px-5 py-3.5 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-right">Total Deduction</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {groupedBeneficiaries.map(g => {
                      const fullName = toTitleCase(g.student_name);
                      const classLabel = [g.current_class_name, g.current_class_section_name].filter(Boolean).join(' ');

                      return (
                      <React.Fragment key={g.student_id}>
                        <tr onClick={() => setExpandedRow(expandedRow === g.student_id ? null : g.student_id)} className={`hover:bg-indigo-50/30 transition-colors group cursor-pointer ${expandedRow === g.student_id ? 'bg-indigo-50/20' : ''}`}>
                          <td className="px-5 py-3.5 text-slate-400 group-hover:text-indigo-500">
                            {expandedRow === g.student_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <img src={getStudentImage(g.image_url)} alt={fullName} className="w-9 h-9 rounded-full object-cover border border-slate-200" onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }} />
                              <div>
                                <p className="font-bold text-slate-900 text-sm group-hover:text-indigo-700 transition-colors">{fullName}</p>
                                <p className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mt-0.5">
                                  {g.registration_number || 'N/A'} {classLabel ? `• ${classLabel}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 group-hover:bg-white transition-colors">
                              <Layers className="w-3 h-3 text-slate-400" /> {g.items?.length || 0} Item{(g.items?.length || 0) !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className="font-black text-emerald-600 text-base">₦{fmtMoney(g.total)}</span>
                          </td>
                        </tr>
                        {/* Nested breakdown row */}
                        {expandedRow === g.student_id && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={4} className="px-5 py-4 border-b border-slate-100">
                              <div className="pl-6 border-l-2 border-indigo-200 space-y-4 ml-6 py-2">
                                {g.items?.map((it: any) => (
                                  <div key={it.id} className="flex justify-between items-center text-sm">
                                    <div className="flex flex-col gap-1">
                                      <span className="font-semibold text-slate-700 flex items-center gap-2">
                                        <Tag className="w-3.5 h-3.5 text-slate-400"/> {it.discount_title}
                                      </span>
                                      <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 ml-5">
                                        Applied to: <span className="font-bold text-slate-600">{it.fee_target_name || 'Fee'} (₦{fmtMoney(it.fee_base_amount || 0)})</span>
                                        <ArrowRight className="w-3 h-3 text-slate-300 mx-0.5" />
                                        {it.locked_type && it.locked_rate && renderRateLock(it.locked_type, it.locked_rate)}
                                      </span>
                                    </div>
                                    <span className="font-bold text-slate-800 text-base">-₦{fmtMoney(it.amount_discounted)}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )})}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500">
                    Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalRecords)} of{' '}
                    <span className="font-bold text-slate-700">{totalRecords}</span> records
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => fetchAuditData(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-colors bg-transparent">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 text-xs font-bold text-slate-600">{page} / {totalPages}</span>
                    <button onClick={() => fetchAuditData(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-colors bg-transparent">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: RATE LOCKS ── */}
      {activeTab === 'locks' && (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden min-h-[400px] animate-in fade-in slide-in-from-bottom-6 duration-500">
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-500" /> Financial Rate Snapshots
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Immutable records proving exactly what rules existed when invoices were generated.</p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center"><Loader2 className="h-7 w-7 animate-spin text-indigo-500 mx-auto" /></div>
          ) : rateLocks.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Lock className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-600">No rate locks recorded</p>
              <p className="text-xs mt-1">No invoices were generated with discounts in this term.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-5 py-3.5">Discount Program</th>
                    <th className="px-5 py-3.5">Master Locked Rate</th>
                    <th className="px-5 py-3.5 text-right">Class Overrides (Tiers)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rateLocks.map(lock => {
                    const hasTiers = lock.tier_snapshots && Object.keys(lock.tier_snapshots).length > 0;

                    return (
                      <tr key={lock.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-800 text-sm">
                          {lock.discount_title}
                          <span className="block mt-1 text-[10px] font-medium text-slate-400 tracking-widest uppercase">
                            Locked: {new Date(lock.created_at).toLocaleDateString('en-GB')}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {renderRateLock(lock.discount_type, lock.discount_amount)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!hasTiers ? (
                            <span className="text-xs font-semibold text-slate-400 italic bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Uniform (No overrides)</span>
                          ) : (
                            <div className="flex flex-col items-end gap-2">
                              {Object.entries(lock.tier_snapshots).map(([classId, amt]: any) => {
                                const clsName = classes.find(c => c.id.toString() === classId)?.name || `Class #${classId}`;
                                return (
                                  <span key={classId} className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                    <span className="text-slate-400">{clsName}</span> <ArrowRight className="w-3 h-3 text-slate-300" />
                                    {renderRateLock(lock.discount_type, amt)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: STUDENT DEEP-DIVE ── */}
      {activeTab === 'history' && (
        <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 relative z-20">

          <div className="bg-white p-5 md:p-6 rounded-xl border border-slate-100 relative mb-5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-t-xl" />
            <div className="max-w-2xl">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5 mb-4">
                <span className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Search className="w-3.5 h-3.5 text-white" />
                </span>
                Lookup Student Audit
              </h2>
              <p className="text-xs text-slate-500 mb-3">Search for any student to view their complete lifetime discount application history.</p>
              <StudentSearch onSelect={handleSelectHistoryStudent} />
            </div>
          </div>

          {/* Results Panel */}
          {studentHistoryLoading ? (
            <div className="bg-white rounded-xl border border-slate-100 p-20 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-indigo-500 mx-auto mb-4" />
              <p className="text-sm font-medium text-slate-500">Retrieving audit history...</p>
            </div>
          ) : selectedStudent && studentHistoryData && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <img src={getStudentImage(selectedStudent.image_url || selectedStudent.image)} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm" onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }} />
                  <div>
                    <h2 className="text-lg font-black text-slate-900">{toTitleCase(selectedStudent.full_name)}</h2>
                    <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{selectedStudent.registration_number} • {selectedStudent.current_class_name}</p>
                  </div>
                </div>
                <button onClick={() => loadActiveEnrollments(selectedStudent.id)} className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 self-start sm:self-auto">
                  <ShieldCheck className="w-4 h-4"/> Verify Active Enrollments
                </button>
              </div>

              {historyByTerm.length === 0 ? (
                <div className="p-20 text-center">
                  <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Box className="w-7 h-7 text-slate-300" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 mb-1">No historical discounts</h3>
                  <p className="text-sm text-slate-400">There are no archived discount applications linked to this student profile.</p>
                </div>
              ) : (
                <div className="p-5 md:p-6 space-y-5 bg-slate-50/30">
                  {historyByTerm.map((term, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-indigo-300 transition-colors">
                      <div className="bg-indigo-50/50 px-5 py-3.5 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-white border border-indigo-100 rounded-lg flex items-center justify-center text-indigo-500">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 text-sm block">{term.term_label.split(' — ')[1]}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{term.term_label.split(' — ')[0]}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Term Total</span>
                          <span className="font-black text-emerald-600 text-lg leading-none">-₦{fmtMoney(term.total)}</span>
                        </div>
                      </div>
                      <div className="px-5 py-2">
                        <div className="divide-y divide-slate-50">
                          {term.items.map(it => (
                            <div key={it.id} className="py-4 hover:bg-slate-50/50 group flex items-start justify-between gap-4 transition-colors px-2 rounded-lg">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                  <Tag className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors"/>
                                  {it.discount_title}
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 ml-6">
                                  Target: <span className="font-bold text-slate-600">{it.fee_target_name || 'Fee'} (₦{fmtMoney(it.fee_base_amount || 0)})</span>
                                  <ArrowRight className="w-3 h-3 text-slate-300 mx-0.5" />
                                  {it.locked_type && it.locked_rate && renderRateLock(it.locked_type, it.locked_rate)}
                                </span>
                              </div>
                              <span className="text-base font-black text-slate-900 mt-1">-₦{fmtMoney(it.amount_discounted)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Active Enrollments Verification Modal ──
           Widened from max-w-sm (384px) to max-w-xl (576px) and restructured —
           the old layout crammed a title row, a rate badge, a nested "Applicable
           Fees" wrapped-badge list, and a date line into ~300px of usable width. */}
      {activeEnrollmentsModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setActiveEnrollmentsModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-500"/> Verified Enrollments</h3>
                <p className="text-xs text-slate-500 mt-1">Actively enrolled programs — these will automatically apply on the next invoice generation.</p>
              </div>
              <button type="button" onClick={() => setActiveEnrollmentsModal(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-lg border border-slate-200 shrink-0 ml-3"><X className="h-4 w-4" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {activeEnrollmentsModal.length === 0 ? (
                <div className="text-center p-6 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-600">No active enrollments.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeEnrollmentsModal.map(e => (
                    <div key={e.id} className="p-4 border border-emerald-200 bg-emerald-50/40 rounded-xl">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="font-bold text-emerald-900 text-sm flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0"/>
                          <span className="truncate">{e.discount_title}</span>
                        </p>
                        <div className="shrink-0">{renderRateLock(e.discount_type, e.base_rate)}</div>
                      </div>

                      <div className="bg-white rounded-lg p-3 border border-emerald-100">
                        <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-2">Applicable Fees</p>
                        <div className="flex flex-wrap gap-1.5">
                          {e.applicable_fees && e.applicable_fees.length > 0 ? (
                            e.applicable_fees.map((fee: string, idx: number) => (
                              <span key={idx} className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-semibold px-2 py-1 rounded-md">
                                {fee}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No fees specified</span>
                          )}
                        </div>
                      </div>

                      <p className="text-[9px] font-bold text-slate-400 mt-3 uppercase tracking-widest text-right">
                        Enrolled: {new Date(e.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}