'use client';

// Suggested path: app/dashboard/staff/communication/announcements/[id]/page.tsx
//
// Shared by everyone who can view announcements — the person who created a
// given announcement and any other staff member. That means action buttons
// (Edit / Delete) must be gated per-item, not just by "can this user manage
// announcements at all": someone with no manage permission should still be
// able to edit/delete their OWN post, and someone who isn't the author needs
// real manage permission to touch someone else's.
//
// ASSUMPTIONS to double check against your actual API/serializer:
//  - GET /api/communication/announcements/{id}/ returns the full Announcement,
//    including a `created_by` field (number id, or an object with an `id`).
//    Adjust `getAuthorId()` below if your field is named differently
//    (e.g. `author`, `posted_by`).
//  - Permission codenames: communication.change_announcementmodel /
//    communication.delete_announcementmodel. Swap for your real ones.

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import type { Announcement, AnnouncementPriority, AnnouncementTargetAudience } from '@/lib/types';
import {
  ArrowLeft, Megaphone, Edit3, Trash2, AlertCircle, AlertTriangle,
  Loader2, Check, X, Users, Tag, CalendarDays, Paperclip, UserRound,
} from 'lucide-react';
import RichTextViewer from '@/components/communication/RichTextViewer';

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

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

function ConfirmDeleteModal({ open, title, isDeleting, onConfirm, onCancel }: {
  open: boolean; title: string; isDeleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-[fadeIn_0.15s_ease-out]">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Announcement</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to permanently delete <span className="font-semibold text-slate-700">"{title}"</span>?
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

// Pulls a comparable author id out of whatever shape `created_by` turns out
// to be (raw id, or a nested user object). Adjust the field name here if
// your API calls it something else.
function getAuthorId(a: any): string | number | null {
  const raw = a?.created_by ?? a?.author ?? a?.posted_by ?? null;
  if (raw == null) return null;
  return typeof raw === 'object' ? (raw.id ?? null) : raw;
}
function getAuthorName(a: any): string | null {
  const raw = a?.created_by ?? a?.author ?? a?.posted_by ?? null;
  if (raw && typeof raw === 'object') {
    return raw.full_name || [raw.first_name, raw.last_name].filter(Boolean).join(' ') || raw.name || raw.email || null;
  }
  return null;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AnnouncementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const id = params?.id as string;

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts(prev => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  };
  const dismissToast = (tid: number) => setToasts(prev => prev.filter(t => t.id !== tid));

  const fetchAnnouncement = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const res = await api.get(`/api/communication/announcements/${id}/`);
      setAnnouncement(res.data);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchAnnouncement(); }, [id, fetchAnnouncement]);

  const authorId = announcement ? getAuthorId(announcement) : null;
  const authorName = announcement ? getAuthorName(announcement) : null;
  const isOwner = !!(user?.id && authorId != null && String(user.id) === String(authorId));

  // Per-item permission: real manage permission OR ownership of this specific post.
  const canEdit = !!user && (user.is_superuser || hasPermission('communication.change_announcementmodel') || isOwner);
  const canDelete = !!user && (user.is_superuser || hasPermission('communication.delete_announcementmodel') || isOwner);

  const handleDelete = async () => {
    if (!announcement) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/communication/announcements/${announcement.id}/`);
      showToast('success', 'Announcement deleted.');
      setTimeout(() => router.push('/dashboard/staff/communication/announcements'), 600);
    } catch (err) {
      showToast('error', extractError(err));
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading announcement...</p>
      </div>
    );
  }

  if (pageError || !announcement) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-600 mb-4">{pageError || 'Announcement not found.'}</p>
        <Link href="/dashboard/staff/communication/announcements" className="text-sm text-indigo-600 underline inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Announcements
        </Link>
      </div>
    );
  }

  const isPublished = announcement.is_published;

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDeleteModal
        open={showDeleteModal} title={announcement.title} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <Link href="/dashboard/staff/communication/announcements"
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors flex-shrink-0 mt-0.5">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPublished ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {isPublished ? 'Published' : 'Draft'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${PRIORITY_STYLES[announcement.priority] || PRIORITY_STYLES.normal}`}>
                <Tag className="h-2.5 w-2.5" /> {announcement.priority}
              </span>
              {isOwner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                  Posted by you
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2 flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-indigo-600 flex-shrink-0" />
              <span className="truncate">{announcement.title}</span>
            </h1>
          </div>
        </div>

        {/* Actions — only rendered for someone with real permission, or the author */}
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {canEdit && (
              <Link href={`/dashboard/staff/communication/announcements/${announcement.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 transition-colors">
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </Link>
            )}
            {canDelete && (
              <button onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Meta grid */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Audience</p>
          <p className="text-sm font-semibold text-slate-700">{TARGET_LABELS[announcement.target_audience] || announcement.target_audience}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Posted</p>
          <p className="text-sm font-semibold text-slate-700">{new Date(announcement.created_at).toLocaleDateString()}</p>
        </div>
        {(announcement as any).publish_date && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Publish On</p>
            <p className="text-sm font-semibold text-slate-700">{new Date((announcement as any).publish_date).toLocaleString()}</p>
          </div>
        )}
        {(announcement as any).expiry_date && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><CalendarDays className="h-3 w-3" /> Expires</p>
            <p className="text-sm font-semibold text-slate-700">{new Date((announcement as any).expiry_date).toLocaleString()}</p>
          </div>
        )}
        {authorName && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1"><UserRound className="h-3 w-3" /> Author</p>
            <p className="text-sm font-semibold text-slate-700 truncate">{authorName}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <RichTextViewer html={(announcement as any).content} />

        {(announcement as any).attachment && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <a href={(announcement as any).attachment} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors">
              <Paperclip className="h-4 w-4" /> View Attachment
            </a>
          </div>
        )}
      </div>
    </div>
  );
}