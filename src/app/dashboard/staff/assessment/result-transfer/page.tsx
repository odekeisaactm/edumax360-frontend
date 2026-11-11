'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultTransferAPI } from '@/lib/api';
import type { ExamResultTransferConfig } from '@/lib/assessment.types';
import {
  RefreshCw, Plus, Eye, Trash2, Loader2, AlertCircle,
  CheckCircle2, Clock, Shield, Search, X,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  const d = err?.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  if (d?.error) return d.error;
  return err?.message || 'An error occurred';
}

type StatusFilter = 'all' | 'transferred' | 'pending';

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ResultTransferListPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const [mounted, setMounted] = useState(false);

  const canManage =
    !!user && (user.is_superuser || hasPermission('result.can_publish_result'));

  const [configs, setConfigs] = useState<ExamResultTransferConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [deleting, setDeleting] = useState<ExamResultTransferConfig | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchConfigs = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const data = await resultTransferAPI.list();
      setConfigs(data);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (mounted) fetchConfigs();
  }, [mounted, fetchConfigs]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await resultTransferAPI.delete(deleting.id);
      setConfigs(prev => prev.filter(c => c.id !== deleting.id));
      setDeleting(null);
    } catch (err: any) {
      setError(extractError(err));
      setDeleting(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return configs.filter(c => {
      if (statusFilter === 'transferred' && !c.is_transferred) return false;
      if (statusFilter === 'pending' && c.is_transferred) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(c.exam_name || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [configs, statusFilter, search]);

  const stats = useMemo(() => ({
    total: configs.length,
    transferred: configs.filter(c => c.is_transferred).length,
    pending: configs.filter(c => !c.is_transferred).length,
    totalStudents: configs.reduce((s, c) => s + c.students_transferred, 0),
  }), [configs]);

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Access Denied</h2>
          <p className="text-sm text-slate-500">
            You don't have permission to manage result transfers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <RefreshCw className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Result Transfer</h1>
            <p className="text-sm text-slate-500">
              Migrate exam scores into the result module
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfigs}
            disabled={loading}
            title="Refresh"
            className="p-2.5 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => router.push('/dashboard/staff/assessment/result-transfer/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 transition-all shadow-md shadow-violet-200"
          >
            <Plus className="h-4 w-4" />
            New Transfer
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Configs',   value: stats.total,        color: 'text-violet-600' },
          { label: 'Transferred',     value: stats.transferred,  color: 'text-emerald-600' },
          { label: 'Pending',         value: stats.pending,      color: 'text-amber-600' },
          { label: 'Students Moved',  value: stats.totalStudents, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
            <p className="text-xs font-medium text-slate-500 mb-0.5">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by exam name…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
        >
          <option value="all">All statuses</option>
          <option value="transferred">Transferred</option>
          <option value="pending">Pending</option>
        </select>
        {(search || statusFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('all'); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex items-center justify-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
          <span className="text-sm">Loading transfer configs…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
          <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <RefreshCw className="h-7 w-7 text-violet-300" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">
            {search || statusFilter !== 'all'
              ? 'No configs match your filters'
              : 'No transfer configs yet'}
          </h3>
          <p className="text-sm text-slate-400 mb-5">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filters.'
              : 'Create your first transfer configuration to begin.'}
          </p>
          {!search && statusFilter === 'all' && (
            <button
              onClick={() => router.push('/dashboard/staff/assessment/result-transfer/new')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700"
            >
              <Plus className="h-4 w-4" />
              New Transfer
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_110px_140px_110px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Exam</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Groups</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Students</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Actions</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map(c => (
              <div
                key={c.id}
                className="grid grid-cols-[minmax(0,1fr)_120px_110px_140px_110px] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/staff/assessment/result-transfer/${c.id}`)}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{c.exam_name || '—'}</p>
                  <p className="text-xs text-slate-400">
                    {c.last_transfer_date
                      ? `Last run: ${new Date(c.last_transfer_date).toLocaleDateString()}`
                      : 'Not yet executed'}
                  </p>
                </div>
                <span className="text-sm text-slate-700 font-medium">
                  {c.group_count} {c.group_count === 1 ? 'group' : 'groups'}
                </span>
                <span className="text-sm text-slate-700 font-medium">
                  {c.students_transferred}
                </span>
                <div>
                  {c.is_transferred ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Transferred
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => router.push(`/dashboard/staff/assessment/result-transfer/${c.id}`)}
                    title="View details"
                    className="p-2 rounded-lg text-violet-600 bg-violet-50 border border-violet-100 hover:bg-violet-100 transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleting(c)}
                    title="Delete"
                    className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
            <p className="text-xs text-slate-400">
              Showing {filtered.length} of {configs.length} config{configs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleting && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
              Delete transfer config?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-2">
              <span className="font-semibold text-slate-700">{deleting.exam_name}</span>
            </p>
            <p className="text-xs text-red-500 text-center mb-6">
              Deleting this config does <strong>not</strong> remove already-transferred scores from the Result module. It only removes the mapping — you'd need to recreate it to run again.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleting(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}