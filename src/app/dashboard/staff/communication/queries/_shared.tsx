'use client';

// Shared between queries/page.tsx (index) and queries/[id]/page.tsx (detail).
// Keeping this here avoids duplicating the toast system, status metadata,
// and sender-name/reply-status helpers across both routes.

import React from 'react';
import { AlertCircle, Clock, CheckCircle2, Check, X } from 'lucide-react';
import type { Query } from '@/lib/types';

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export type FilterKey = 'unassigned' | 'mine' | 'all' | 'resolved';

export interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

let _toastId = 0;

export function useToasts() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, showToast, dismissToast };
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
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

export const STATUS_META = {
  open: { color: 'bg-amber-100 text-amber-700', border: 'border-amber-200', icon: AlertCircle, label: 'Open' },
  in_progress: { color: 'bg-blue-100 text-blue-700', border: 'border-blue-200', icon: Clock, label: 'In Progress' },
  resolved: { color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2, label: 'Resolved' },
  closed: { color: 'bg-slate-100 text-slate-600', border: 'border-slate-200', icon: CheckCircle2, label: 'Closed' },
};

export function getSenderName(ticket: Query): string {
  return ticket.student_name || ticket.parent_name || ticket.staff_name || 'Anonymous';
}

// Last message in the thread — either the newest follow-up, or the
// original ticket message if nobody has replied yet.
export function getLastMessageSenderId(ticket: Query): number | null | undefined {
  const ups = ticket.follow_ups;
  if (ups && ups.length > 0) return ups[ups.length - 1].sent_by;
  return (ticket as any).created_by;
}

// A ticket "needs a reply" when the requester spoke last and it's still
// open — i.e. staff hasn't responded to the latest message yet.
export function needsReply(ticket: Query): boolean {
  if (ticket.status === 'resolved' || ticket.status === 'closed') return false;
  return getLastMessageSenderId(ticket) === (ticket as any).created_by;
}

export function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}