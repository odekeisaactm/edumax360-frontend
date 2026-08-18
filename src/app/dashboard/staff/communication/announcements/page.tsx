'use client';

// Suggested path: app/dashboard/staff/communication/announcements/page.tsx
//
// Everyone who can see announcements shares this list — the person who
// created a given row and any other staff member. Row-level Edit/Delete
// buttons are gated per-row (manage permission OR being that row's author),
// matching the same logic on the detail and edit pages. See the comment
// block in the detail page for the `created_by` field assumption.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { announcementsAPI } from '@/lib/communication.service';
import type { Announcement, AnnouncementPriority, AnnouncementTargetAudience } from '@/lib/types';
import {
  Megaphone, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Users, Eye, Paperclip, ChevronLeft, ChevronRight,
  CalendarDays, Tag
} from 'lucide-react';

// ─── Helpers & Constants ───────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? (v as any[])[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

const PAGE_SIZE = 20;

const PRIORITY_STYLES: Record<AnnouncementPriority, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-blue-100 text-blue-700 border-blue-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

const TARGET_LABELS: Record<AnnouncementTargetAudience, string> = {
  all: 'All Users',
  students: 'Students Only',
  parents: 'Parents Only',
  staff: 'Staff Only',
  specific_class: 'Specific Classes',
  specific_section: 'Specific Sections',
};

function toTitleCase(str: string): string {
  return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Pulls a comparable author id out of whatever shape `created_by` turns out
// to be (raw id, or a nested user object). Adjust the field name here if
// your API calls it something else (e.g. `author`, `posted_by`).
function getAuthorId(a: any): string | number | null {
  const raw = a?.created_by ?? a?.author ?? a?.posted_by ?? null;
  if (raw == null) return null;
  return typeof raw === 'object' ? (raw.id ?? null) : raw;
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-[fadeIn_0.2s_ease-out]
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, item, isDeleting, onConfirm, onCancel }: {
  open: boolean; item: Announcement | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.15s_ease-out]">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Announcement</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to permanently delete{' '}
          <span className="font-semibold text-slate-700">"{item.title}"</span>?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-red-200">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function AnnouncementsPage() {
  const { hasPermission, user } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [deletingItem, setDeletingItem] = useState<Announcement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // "Can create" gate for the top-level Post button — separate from the
  // per-row Edit/Delete gates below, which also allow the row's own author.
  const canCreate = user?.is_superuser || hasPermission('communication.add_announcementmodel');
  const canManageAny = user?.is_superuser || hasPermission('communication.change_announcementmodel') || hasPermission('communication.delete_announcementmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchAnnouncements = useCallback(async (pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (targetFilter) params.target_audience = targetFilter;
      if (statusFilter === 'published') params.is_published = true;
      if (statusFilter === 'draft') params.is_published = false;

      const data = await announcementsAPI.list(params) as any;
      const results = data?.results ?? data?.data ?? data ?? [];

      setAnnouncements(Array.isArray(results) ? results : []);
      setTotal(data?.count ?? results.length);
      setPage(pg);
    } catch (err: any) {
      if (err?.response?.status === 404 && pg > 1) {
        fetchAnnouncements(1);
      } else {
        setPageError(extractError(err));
      }
    } finally { setLoading(false); }
  }, [search, targetFilter, statusFilter]);

  // Handle Debounce for Search and immediate fetch for Filters
  useEffect(() => { fetchAnnouncements(1); }, [targetFilter, statusFilter]);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchAnnouncements(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  const handleDelete = async () => {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      await announcementsAPI.delete(deletingItem.id);
      setAnnouncements(prev => prev.filter(a => a.id !== deletingItem.id));
      setTotal(prev => prev - 1);
      showToast('success', `"${deletingItem.title}" deleted successfully.`);
      setDeletingItem(null);

      if (announcements.length === 1 && page > 1) fetchAnnouncements(page - 1);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingItem(null);
    } finally { setIsDeleting(false); }
  };

  const clearFilters = () => { setTargetFilter(''); setSearch(''); setStatusFilter('all'); };
  const hasFilters = !!(search || targetFilter || statusFilter !== 'all');
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingItem} item={deletingItem} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingItem(null)}
      />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            Announcements
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage official school noticeboard posts.</p>
        </div>
        {canCreate && (
          <Link href="/dashboard/staff/communication/announcements/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md shadow-indigo-200 w-max">
            <Plus className="h-4 w-4" /> Post Announcement
          </Link>
        )}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">

          <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search title or content..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Target Dropdown */}
            <select value={targetFilter} onChange={e => setTargetFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${targetFilter ? 'border-indigo-400 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-600 bg-white'}`}>
              <option value="">All Audiences</option>
              {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Segmented Control for Status Filter */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {[
              { id: 'all', label: 'All Status' },
              { id: 'published', label: 'Published' },
              { id: 'draft', label: 'Drafts' },
            ].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id as any)}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  statusFilter === f.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}>
                {f.label}
              </button>
            ))}
            <button onClick={() => fetchAnnouncements(page)} title="Refresh" className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

        </div>

        {/* ── Body States ── */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading announcements...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchAnnouncements(1)} className="text-sm text-indigo-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Megaphone className="h-7 w-7 text-indigo-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No announcements match your filters' : 'No announcements posted yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Keep your school informed by posting the first official noticeboard announcement.'}
            </p>
            {!hasFilters && canCreate && (
              <Link href="/dashboard/staff/communication/announcements/new"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md shadow-indigo-200">
                <Plus className="h-4 w-4" /> Create First Announcement
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className={`grid ${canManageAny ? 'grid-cols-[3rem_2.5fr_1.5fr_100px_110px]' : 'grid-cols-[3rem_2.5fr_1.5fr_100px_56px]'} items-center gap-4 px-6 py-3 bg-slate-50/60 border-b border-slate-100 min-w-[850px] overflow-x-auto`}>
              <span className="w-10" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Title & Date</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Audience & Priority</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50 overflow-x-auto">
              {announcements.map(a => {
                const isPublished = a.is_published;

                // Per-row permission: real manage permission OR being this
                // row's own author (so a non-manager can still edit/delete
                // the announcement they personally posted).
                const authorId = getAuthorId(a);
                const isOwner = !!(user?.id && authorId != null && String(user.id) === String(authorId));
                const canEditRow = !!user && (user.is_superuser || hasPermission('communication.change_announcementmodel') || isOwner);
                const canDeleteRow = !!user && (user.is_superuser || hasPermission('communication.delete_announcementmodel') || isOwner);

                return (
                  <div key={a.id} className={`grid ${canManageAny ? 'grid-cols-[3rem_2.5fr_1.5fr_100px_110px]' : 'grid-cols-[3rem_2.5fr_1.5fr_100px_56px]'} items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors min-w-[850px]`}>

                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${isPublished ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                      <Megaphone className="h-5 w-5" />
                    </div>

                    {/* Title & Metadata */}
                    <div className="min-w-0 pr-4">
                      <p className="font-bold text-slate-900 text-sm truncate">{a.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-slate-400">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3"/> {new Date(a.created_at).toLocaleDateString()}</span>
                        {a.attachment && (
                          <span className="flex items-center gap-1 text-indigo-500 font-bold bg-indigo-50 px-1.5 py-0.5 rounded"><Paperclip className="h-3 w-3"/> Attachment</span>
                        )}
                        {isOwner && (
                          <span className="text-indigo-500 font-bold">You</span>
                        )}
                      </div>
                    </div>

                    {/* Target & Priority */}
                    <div className="flex flex-col gap-1.5 min-w-0 pr-4">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 truncate">
                        <Users className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{TARGET_LABELS[a.target_audience] || toTitleCase(a.target_audience)}</span>
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border w-max ${PRIORITY_STYLES[a.priority] || PRIORITY_STYLES.normal}`}>
                        <Tag className="h-2.5 w-2.5" /> {a.priority}
                      </span>
                    </div>

                    {/* Status */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border w-max ${isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {isPublished ? 'Published' : 'Draft'}
                    </span>

                    {/* Actions — View is always available; Edit/Delete are per-row gated */}
                    <div className="flex items-center gap-1.5">
                      <Link href={`/dashboard/staff/communication/announcements/${a.id}`} title="View Notice"
                        className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-4 w-4" />
                      </Link>
                      {canEditRow && (
                        <Link href={`/dashboard/staff/communication/announcements/${a.id}/edit`} title="Edit"
                          className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-4 w-4" />
                        </Link>
                      )}
                      {canDeleteRow && (
                        <button onClick={() => setDeletingItem(a)} title="Delete"
                          className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer + Pagination */}
            <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> records
                {hasFilters && <span className="ml-1 text-indigo-500 font-medium">(filtered)</span>}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchAnnouncements(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchAnnouncements(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchAnnouncements(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}