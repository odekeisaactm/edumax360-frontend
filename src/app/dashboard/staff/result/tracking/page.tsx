'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultViewAPI } from '@/lib/api';
import { ResultUploadTracking } from '@/lib/types';
import {
  ClipboardList, Search, X, Check, AlertCircle, AlertTriangle,
  Loader2, RefreshCw, Eye, Edit3,
  ChevronDown, ChevronUp, TrendingUp, ExternalLink,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DashboardStats {
  total: number;
  uploaded: number;
  pending: number;
  progressPercentage: number;
}

interface PendingItem {
  id: number;
  subject_id: number;
  subject_name: string;
  class_config_id: number;
  class_name: string;
  form_teacher: number | null;
  form_teacher_name: string | null;
  subject_teachers: Array<{ id: number; name: string }>;
}

type TabType = 'uploaded' | 'pending';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
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

// ─── Helper Functions ─────────────────────────────────────────────────────────
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// ─── Progress Bar Component ───────────────────────────────────────────────────
function ProgressBar({ stats }: { stats: DashboardStats }) {
  const getColor = () => {
    if (stats.progressPercentage >= 80) return 'bg-emerald-500';
    if (stats.progressPercentage >= 50) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          Upload Progress (Score Based)
        </h3>
        <span className="text-sm font-bold text-blue-600">{stats.progressPercentage}%</span>
      </div>

      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getColor()}`}
          style={{ width: `${stats.progressPercentage}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 text-center text-xs">
        <div>
          <p className="text-slate-400">Uploaded</p>
          <p className="font-bold text-emerald-600">{stats.uploaded}</p>
        </div>
        <div>
          <p className="text-slate-400">Pending</p>
          <p className="font-bold text-amber-600">{stats.pending}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UploadedResultsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>('uploaded');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'class_name' | 'subject_name'>('class_name');
  const [uploadedResults, setUploadedResults] = useState<ResultUploadTracking[]>([]);
  const [pendingResults, setPendingResults] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0, uploaded: 0, pending: 0, progressPercentage: 0
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const canEdit = user?.is_superuser || hasPermission('result.change_resultmodel');
  const canView = user?.is_superuser || hasPermission('result.view_resultmodel');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = {
        result_type: activeTab === 'uploaded' ? 'score' : 'pending',
        page_size: 100,
      };

      if (activeTab === 'uploaded') {
        params.ordering = sortOrder;
      }

      if (searchTerm) params.search = searchTerm;

      const response = await resultViewAPI.trackingDashboard(params);

      if (activeTab === 'uploaded') {
        setUploadedResults(response.results || []);
      } else {
        setPendingResults(response.results || []);
      }

      // Fetch stats for progress bar
      const [uploadedRes, pendingRes] = await Promise.all([
        resultViewAPI.trackingDashboard({ result_type: 'score', page_size: 100 }),
        resultViewAPI.trackingDashboard({ result_type: 'pending', page_size: 100 }),
      ]);

      const uploaded = uploadedRes.results?.length || 0;
      const pending = pendingRes.results?.length || 0;
      const total = uploaded + pending;
      const progressPercentage = total > 0 ? Math.round((uploaded / total) * 100) : 0;

      setStats({ total, uploaded, pending, progressPercentage });
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, sortOrder]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleView = (item: ResultUploadTracking) => {
    router.push(`/dashboard/staff/result/view/score?class=${item.class_configuration}&subject=${item.subject}`);
  };

  const handleEdit = (item: ResultUploadTracking) => {
    router.push(`/dashboard/staff/result/upload/score?class=${item.class_configuration}&subject=${item.subject}`);
  };

  const handlePendingEdit = (item: PendingItem) => {
    router.push(`/dashboard/staff/result/upload/score?class=${item.class_config_id}&subject=${item.subject_id}`);
  };

  const getStatusBadge = (caUploaded: boolean, examUploaded: boolean) => {
    if (caUploaded && examUploaded) {
      return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Complete</span>;
    }
    if (caUploaded || examUploaded) {
      return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Partial</span>;
    }
    return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Not Started</span>;
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const tabs: { id: TabType; label: string; icon: any; color: string }[] = [
    { id: 'uploaded', label: 'Uploaded Results', icon: Check, color: 'emerald' },
    { id: 'pending', label: 'Pending Results', icon: AlertCircle, color: 'amber' },
  ];

  const currentData = activeTab === 'uploaded' ? uploadedResults : pendingResults;

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
            Uploaded Results
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Track score-based result uploads</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Progress Bar ── */}
      <ProgressBar stats={stats} />

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === tab.id
                ? `bg-${tab.color}-50 text-${tab.color}-600 border border-${tab.color}-200`
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
              activeTab === tab.id ? `bg-${tab.color}-100` : 'bg-slate-100'
            }`}>
              {tab.id === 'uploaded' ? stats.uploaded : stats.pending}
            </span>
          </button>
        ))}
      </div>

      {/* ── Search and Sort ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject or class..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {searchTerm && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 whitespace-nowrap">Sort by:</span>
            <button
              onClick={() => setSortOrder('class_name')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortOrder === 'class_name'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Class
            </button>
            <button
              onClick={() => setSortOrder('subject_name')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortOrder === 'subject_name'
                  ? 'bg-blue-100 text-blue-700 font-medium'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Subject
            </button>
          </div>
        </div>
      </div>

      {/* ── Results Table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Uploaded By</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                    <p className="mt-2 text-sm text-slate-400">Loading...</p>
                  </td>
                </tr>
              ) : pageError ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-red-600">{pageError}</p>
                    <button onClick={fetchData} className="mt-2 text-sm text-blue-600 underline">Try Again</button>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <div className="text-center">
                      <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <h3 className="font-semibold text-slate-700 mb-1">No results found</h3>
                      <p className="text-sm text-slate-400">
                        {activeTab === 'uploaded'
                          ? 'No uploaded results match your search.'
                          : searchTerm
                            ? 'No pending results match your search.'
                            : 'All results have been uploaded!'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentData.map((item, idx) => {
                  const isPending = activeTab === 'pending';
                  const trackingItem = item as ResultUploadTracking;
                  const pendingItem = item as PendingItem;
                  const rowId = isPending ? pendingItem.id : trackingItem.id;
                  const className = isPending
                    ? pendingItem.class_name
                    : (trackingItem as any).class_name || `Class ${trackingItem.class_configuration}`;

                  return (
                    <React.Fragment key={rowId}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3 text-sm text-slate-500">{idx + 1}.</td>
                        <td className="px-5 py-3 text-sm font-medium text-slate-800">
                          {toTitleCase((isPending ? pendingItem.subject_name : trackingItem.subject_name) || '')}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {className}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">
                          {isPending ? '-' : trackingItem.uploaded_at ? new Date(trackingItem.uploaded_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600">
                          {isPending ? (
                            <span className="text-amber-600">Not uploaded</span>
                          ) : (
                            (trackingItem as any).uploaded_by_name || 'System'
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {isPending ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending</span>
                          ) : (
                            getStatusBadge(trackingItem.ca_uploaded, trackingItem.exam_uploaded)
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {!isPending && canView && (
                              <button
                                onClick={() => handleView(trackingItem)}
                                className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all"
                                title="View"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => isPending ? handlePendingEdit(pendingItem) : handleEdit(trackingItem)}
                                className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all"
                                title={isPending ? "Upload" : "Edit"}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedRow(expandedRow === rowId ? null : rowId)}
                              className="p-1.5 rounded-lg text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all"
                            >
                              {expandedRow === rowId ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {expandedRow === rowId && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-5 pb-3 pt-0">
                            <div className="p-3 bg-white rounded-xl border border-slate-100 mt-2">
                              {isPending ? (
                                <div className="space-y-3 text-sm">
                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-slate-600 min-w-[120px]">Form Teacher:</span>
                                    {pendingItem.form_teacher ? (
                                      <button
                                        onClick={() => router.push(`/dashboard/staff/staff/${pendingItem.form_teacher}`)}
                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium"
                                      >
                                        {pendingItem.form_teacher_name}
                                        <ExternalLink className="h-3 w-3" />
                                      </button>
                                    ) : (
                                      <span className="text-slate-400 italic">Not assigned</span>
                                    )}
                                  </div>

                                  <div className="flex items-start gap-2">
                                    <span className="font-semibold text-slate-600 min-w-[120px]">Subject Teachers:</span>
                                    {pendingItem.subject_teachers && pendingItem.subject_teachers.length > 0 ? (
                                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                                        {pendingItem.subject_teachers.map(teacher => (
                                          <button
                                            key={teacher.id}
                                            onClick={() => router.push(`/dashboard/staff/staff/${teacher.id}`)}
                                            className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-medium"
                                          >
                                            {teacher.name}
                                            <ExternalLink className="h-3 w-3" />
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 italic">No teachers assigned</span>
                                    )}
                                  </div>
                                  
                                  <div className="pt-2 border-t border-slate-50">
                                    <p className="text-amber-600 text-xs font-medium flex items-center gap-1.5">
                                      <AlertCircle className="h-3.5 w-3.5" />
                                      This result has not been uploaded yet. Click the edit button to upload.
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-slate-400 text-xs">CA Uploaded</p>
                                    <p className="font-semibold">{trackingItem.ca_uploaded ? 'Yes' : 'No'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-xs">Exam Uploaded</p>
                                    <p className="font-semibold">{trackingItem.exam_uploaded ? 'Yes' : 'No'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-xs">Last Uploaded</p>
                                    <p className="font-semibold">{trackingItem.uploaded_at ? new Date(trackingItem.uploaded_at).toLocaleString() : '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-400 text-xs">Status</p>
                                    <p className="font-semibold">{trackingItem.is_complete ? 'Complete' : 'Incomplete'}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
          <p className="text-xs text-slate-400">
            Showing {currentData.length} {activeTab === 'uploaded' ? 'uploaded' : 'pending'} result{currentData.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </div>
  );
}