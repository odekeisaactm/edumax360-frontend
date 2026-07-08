'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultViewAPI } from '@/lib/api';
import api from '@/lib/api';
import {
  ClipboardList, Search, X, Check, AlertCircle, AlertTriangle,
  Loader2, RefreshCw, Eye, Edit3, Layers, Shield, FileText, SplitSquareHorizontal,
  ChevronDown, ChevronUp, TrendingUp, ExternalLink, ChevronLeft, ChevronRight
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DashboardItem {
  id: string;
  class_config_id: number;
  subject_id: number;
  class_name: string;
  subject_name: string;
  form_teacher_id: number | null;
  form_teacher_name: string | null;
  ca_uploaded: boolean;
  exam_uploaded: boolean;
  status: 'Complete' | 'Partial' | 'Pending';
  uploaded_at: string | null;
  uploaded_by_name: string | null;
  is_pending: boolean;
  school_section: string;
}

interface DashboardStats {
  total: number;
  complete: number;
  partial: number;
  pending: number;
  progressPercentage: number;
}

interface FilterOption { id: number; name: string; }

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UploadedResultsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [results, setResults] = useState<DashboardItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, complete: 0, partial: 0, pending: 0, progressPercentage: 0 });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // --- Filter Options States ---
  const [rawFilterData, setRawFilterData] = useState<any[]>([]);

  // --- Filter Selection States ---
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'partial' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'class_name' | 'subject_name'>('class_name');

  const [schoolSectionId, setSchoolSectionId] = useState<string>('');
  const [studentClassId, setStudentClassId] = useState<string>('');
  const [classSectionId, setClassSectionId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const canEdit = user?.is_superuser || hasPermission('result.change_resultmodel');
  const canView = user?.is_superuser || hasPermission('result.view_resultmodel');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // 1. Fetch raw permitted data (ONLY 'score' based to hide Play Group)
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const response = await api.get('/api/academic/class-subjects/uploadable/', { params: { result_type: 'score' }});
        setRawFilterData(response.data?.data?.classes || []);
      } catch (err) {
        console.error("Failed to load permitted filter options", err);
      }
    };
    loadFilters();
  }, []);

  // 2. Cascading Dropdown Logic using useMemo
  const sectionOptions = useMemo(() => {
    const map = new Map<number, FilterOption>();
    rawFilterData.forEach(c => {
      if (c.school_section_id) map.set(c.school_section_id, { id: c.school_section_id, name: c.school_section_name });
    });
    return Array.from(map.values());
  }, [rawFilterData]);

  const classOptions = useMemo(() => {
    const map = new Map<number, FilterOption>();
    rawFilterData.forEach(c => {
      if (!schoolSectionId || c.school_section_id === Number(schoolSectionId)) {
        map.set(c.student_class_id, { id: c.student_class_id, name: c.class_name });
      }
    });
    return Array.from(map.values());
  }, [rawFilterData, schoolSectionId]);

  const armOptions = useMemo(() => {
    const map = new Map<number, FilterOption>();
    rawFilterData.forEach(c => {
      const matchSection = !schoolSectionId || c.school_section_id === Number(schoolSectionId);
      const matchClass = !studentClassId || c.student_class_id === Number(studentClassId);
      if (matchSection && matchClass && c.class_section_id) {
        map.set(c.class_section_id, { id: c.class_section_id, name: c.class_section_name });
      }
    });
    return Array.from(map.values());
  }, [rawFilterData, schoolSectionId, studentClassId]);

  const subjectOptions = useMemo(() => {
    const map = new Map<number, FilterOption>();
    rawFilterData.forEach(c => {
      const matchSection = !schoolSectionId || c.school_section_id === Number(schoolSectionId);
      const matchClass = !studentClassId || c.student_class_id === Number(studentClassId);
      const matchArm = !classSectionId || c.class_section_id === Number(classSectionId);

      if (matchSection && matchClass && matchArm && c.subjects) {
        c.subjects.forEach((sub: any) => {
          map.set(sub.id, { id: sub.id, name: sub.name });
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawFilterData, schoolSectionId, studentClassId, classSectionId]);

  // 3. Auto-reset child dropdowns if their selected value becomes invalid due to a parent changing
  useEffect(() => {
    if (studentClassId && !classOptions.some(c => c.id === Number(studentClassId))) setStudentClassId('');
  }, [classOptions, studentClassId]);

  useEffect(() => {
    if (classSectionId && !armOptions.some(a => a.id === Number(classSectionId))) setClassSectionId('');
  }, [armOptions, classSectionId]);

  useEffect(() => {
    if (subjectId && !subjectOptions.some(s => s.id === Number(subjectId))) setSubjectId('');
  }, [subjectOptions, subjectId]);


  // --- Fetch Dashboard Tracking Data ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = {
        page: currentPage,
        page_size: PAGE_SIZE,
        status: statusFilter,
        ordering: sortOrder
      };

      if (searchTerm) params.search = searchTerm;
      if (schoolSectionId) params.school_section_id = schoolSectionId;
      if (studentClassId) params.student_class_id = studentClassId;
      if (classSectionId) params.class_section_id = classSectionId;
      if (subjectId) params.subject_id = subjectId;

      const [listRes, statsRes] = await Promise.all([
        resultViewAPI.trackingDashboard(params),
        resultViewAPI.trackingDashboardStats()
      ]);

      setResults(listRes.results || []);
      setTotalCount(listRes.count || 0);
      setStats({
        total: statsRes.total || 0,
        complete: statsRes.complete || 0,
        partial: statsRes.partial || 0,
        pending: statsRes.pending || 0,
        progressPercentage: statsRes.progressPercentage || 0,
      });

    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, searchTerm, sortOrder, schoolSectionId, studentClassId, classSectionId, subjectId]);

  // Reset to page 1 if any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, sortOrder, schoolSectionId, studentClassId, classSectionId, subjectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getStatusBadge = (status: string) => {
    if (status === 'Complete') {
      return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold tracking-wide border border-emerald-200 shadow-sm">Complete</span>;
    }
    if (status === 'Partial') {
      return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold tracking-wide border border-amber-200 shadow-sm">Partial</span>;
    }
    return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold tracking-wide border border-slate-200 shadow-sm">Pending</span>;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            Universal Result Tracker
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Monitor score computation progress across the institution</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* ── Progress Bar & High Level Stats ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Overall Completion
          </h3>
          <span className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
            {stats.progressPercentage}%
          </span>
        </div>

        <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-6 border border-slate-200 shadow-inner">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-blue-500 to-emerald-500"
            style={{ width: `${stats.progressPercentage}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Assigned</p>
            <p className="text-xl font-bold text-slate-800">{stats.total}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">100% Complete</p>
            <p className="text-xl font-bold text-emerald-700">{stats.complete}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Partial (Draft)</p>
            <p className="text-xl font-bold text-amber-700">{stats.partial}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pending (0%)</p>
            <p className="text-xl font-bold text-slate-700">{stats.pending}</p>
          </div>
        </div>
      </div>

      {/* ── Filtering Toolbar ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">

        {/* Top Row: Search & Status Segment */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject or class..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 hover:bg-white transition-colors"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start lg:self-auto overflow-x-auto w-full lg:w-auto">
            {['all', 'complete', 'partial', 'pending'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as any)}
                className={`flex-1 px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-all whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-white text-blue-700 shadow-sm border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Row: Dynamic Dropdown Filters & Sort */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={schoolSectionId}
              onChange={e => setSchoolSectionId(e.target.value)}
              className="bg-transparent text-sm text-slate-600 outline-none font-medium cursor-pointer"
            >
              <option value="">All Sections</option>
              {sectionOptions.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Shield className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={studentClassId}
              onChange={e => setStudentClassId(e.target.value)}
              className="bg-transparent text-sm text-slate-600 outline-none font-medium cursor-pointer max-w-[150px]"
            >
              <option value="">All Classes</option>
              {classOptions.map(cls => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <SplitSquareHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={classSectionId}
              onChange={e => setClassSectionId(e.target.value)}
              className="bg-transparent text-sm text-slate-600 outline-none font-medium cursor-pointer max-w-[150px]"
            >
              <option value="">All Arms/Sections</option>
              {armOptions.map(sec => <option key={sec.id} value={sec.id}>{sec.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={subjectId}
              onChange={e => setSubjectId(e.target.value)}
              className="bg-transparent text-sm text-slate-600 outline-none font-medium cursor-pointer max-w-[150px]"
            >
              <option value="">All Subjects</option>
              {subjectOptions.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
            </select>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sort:</span>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as any)}
              className="px-3 py-1.5 text-sm bg-blue-50 border border-blue-100 text-blue-700 font-medium rounded-lg outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="class_name">Class Name</option>
              <option value="subject_name">Subject Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Results Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">#</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Class & Section</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Uploader</th>
                <th className="px-5 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                    <p className="mt-3 text-sm font-medium text-slate-500">Syncing database...</p>
                  </td>
                </tr>
              ) : pageError ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-red-600">{pageError}</p>
                    <button onClick={fetchData} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-semibold underline">Try Again</button>
                  </td>
                </tr>
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-inner">
                      <ClipboardList className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="font-bold text-slate-700 mb-1">No assignments found</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto">
                      Adjust your filters or search term to see more results.
                    </p>
                  </td>
                </tr>
              ) : (
                results.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-3 text-sm text-slate-400 font-mono">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{item.class_name}</span>
                          <span className="text-xs text-slate-400">{item.school_section}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {toTitleCase(item.subject_name)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {item.uploaded_by_name ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">{item.uploaded_by_name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{new Date(item.uploaded_at!).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Not available</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {getStatusBadge(item.status)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {!item.is_pending && canView && (
                            <button
                              onClick={() => router.push(`/dashboard/staff/result/view/score?class=${item.class_config_id}&subject=${item.subject_id}`)}
                              className="p-2 rounded-lg text-blue-600 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm"
                              title="View Result Matrix"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => router.push(`/dashboard/staff/result/upload/score?class=${item.class_config_id}&subject=${item.subject_id}`)}
                              className="p-2 rounded-lg text-amber-600 bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-all shadow-sm"
                              title={item.is_pending ? "Upload Data" : "Edit Records"}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                            className={`p-2 rounded-lg transition-all shadow-sm border ${
                              expandedRow === item.id
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {expandedRow === item.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDED ROW LOGIC */}
                    {expandedRow === item.id && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={6} className="px-5 pb-4 pt-1 border-b border-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm ml-8">

                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-1">Upload Details</h4>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Continuous Assessment:</span>
                                <span className={`font-semibold ${item.ca_uploaded ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {item.ca_uploaded ? 'Recorded ✓' : 'Missing ✗'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Examination Score:</span>
                                <span className={`font-semibold ${item.exam_uploaded ? 'text-emerald-600' : 'text-slate-400'}`}>
                                  {item.exam_uploaded ? 'Recorded ✓' : 'Missing ✗'}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-100 pb-1">Class Oversight</h4>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Form Teacher:</span>
                                {item.form_teacher_id ? (
                                  <button onClick={() => router.push(`/dashboard/staff/staff/${item.form_teacher_id}`)}
                                    className="font-semibold text-blue-600 hover:underline flex items-center gap-1">
                                    {item.form_teacher_name} <ExternalLink className="h-3 w-3" />
                                  </button>
                                ) : (
                                  <span className="text-slate-400 italic">Unassigned</span>
                                )}
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Subject Configuration ID:</span>
                                <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{item.class_config_id}</span>
                              </div>
                            </div>

                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ── */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs font-medium text-slate-500">
              Showing <span className="font-bold text-slate-800">{(currentPage - 1) * PAGE_SIZE + 1}</span> to <span className="font-bold text-slate-800">{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> of <span className="font-bold text-slate-800">{totalCount}</span> entries
            </p>

            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}