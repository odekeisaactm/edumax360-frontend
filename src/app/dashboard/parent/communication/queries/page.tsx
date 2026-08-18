'use client';

// Suggested path: app/dashboard/parent/communication/queries/page.tsx
//
// Kept as its own page (separate from the thread view) rather than folded
// into a single-page master-detail like the staff inbox. Parents visit this
// occasionally rather than triaging constantly, so a normal list → detail
// navigation (bookmarkable, works naturally with the mobile back button)
// fits better than an agent-style split view, and it matches the
// list/detail pattern already used elsewhere in the app (e.g. announcements).

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { queriesAPI } from '@/lib/communication.service';
import type { Query, QueryType } from '@/lib/types';
import Avatar from '@/components/communication/Avatar';
import {
  MessageSquare, Plus, Search, X, Loader2, AlertCircle, Check,
  Clock, CheckCircle2, ChevronRight, HelpCircle, ShieldAlert, Paperclip
} from 'lucide-react';

// ─── Helpers & Validation ──────────────────────────────────────────────────────

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

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] sm:w-auto">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border sm:max-w-sm animate-[fadeIn_0.2s_ease-out]
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

const STATUS_META = {
  open: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: 'Open' },
  in_progress: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock, label: 'In Progress' },
  resolved: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Resolved' },
  closed: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: CheckCircle2, label: 'Closed' },
};

const TYPE_META = {
  general: { icon: HelpCircle, color: 'text-indigo-500 bg-indigo-50' },
  complaint: { icon: ShieldAlert, color: 'text-rose-500 bg-rose-50' },
  request: { icon: MessageSquare, color: 'text-emerald-500 bg-emerald-50' },
  feedback: { icon: MessageSquare, color: 'text-amber-500 bg-amber-50' },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ParentTicketsHub() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [form, setForm] = useState({ title: '', message: '', query_type: 'general' as QueryType });
  const [attachment, setAttachment] = useState<File | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await queriesAPI.list();
      const results: Query[] = (res as any)?.results || res || [];
      results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setTickets(results);
    } catch (err) {
      showToast('error', 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const handleFileValidation = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (file.size > MAX_FILE_SIZE) {
        showToast('error', 'File size exceeds 5MB limit.');
        e.target.value = '';
        return;
      }
      if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
        showToast('error', `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
        e.target.value = '';
        return;
      }
      setAttachment(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return showToast('error', 'Title and message are required.');

    setSubmitLoading(true);
    try {
      const payload = new FormData();
      payload.append('title', form.title);
      payload.append('message', form.message);
      payload.append('query_type', form.query_type);
      payload.append('status', 'open');
      if (attachment) payload.append('attachment', attachment);

      const created = await queriesAPI.create(payload);

      setTickets(prev => [created, ...prev]);
      setIsModalOpen(false);
      setForm({ title: '', message: '', query_type: 'general' });
      setAttachment(null);
      showToast('success', 'Ticket raised successfully.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toString().includes(search)
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
            <HelpCircle className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">Helpdesk & Queries</h1>
            <p className="text-sm text-slate-500 mt-0.5 truncate">Raise tickets and communicate directly with school admin.</p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex-shrink-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-200"
        >
          <Plus className="w-4 h-4" /> Raise Ticket
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by ticket subject or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm transition-all"
        />
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-sm font-medium text-slate-500">Loading your tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-indigo-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No tickets found</h3>
            <p className="text-sm text-slate-500 mb-6">You haven't raised any queries yet.</p>
            <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors">
              <Plus className="w-4 h-4" /> Raise your first ticket
            </button>
          </div>
        ) : (
          filteredTickets.map(ticket => {
            const statusMeta = STATUS_META[ticket.status as keyof typeof STATUS_META] || STATUS_META.open;
            const StatusIcon = statusMeta.icon;
            const typeMeta = TYPE_META[ticket.query_type as keyof typeof TYPE_META] || TYPE_META.general;
            const TypeIcon = typeMeta.icon;
            const lastMsg = ticket.follow_ups && ticket.follow_ups.length > 0
              ? ticket.follow_ups[ticket.follow_ups.length - 1] : null;

            return (
              <Link href={`/dashboard/parent/communication/queries/${ticket.id}`} key={ticket.id}>
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 flex items-start sm:items-center gap-3 sm:gap-4 group transition-all cursor-pointer">

                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${typeMeta.color}`}>
                    <TypeIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors text-sm sm:text-base line-clamp-1 min-w-0">
                        {ticket.title}
                      </h3>
                      <span className={`hidden sm:inline-flex flex-shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusMeta.color}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-[11px] sm:text-xs font-semibold text-slate-500 mt-1.5">
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 border border-slate-200">TKT-{ticket.id}</span>
                      <span className="capitalize">{ticket.query_type}</span>
                      <span className="hidden xs:inline">•</span>
                      <span>Updated {new Date(ticket.updated_at).toLocaleDateString()}</span>
                    </div>

                    {lastMsg && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                        <Avatar name={(lastMsg as any).sent_by_name || 'Reply'} size="xs" ring={false} />
                        <span className="truncate">
                          <span className="font-semibold text-slate-500">{(lastMsg as any).sent_by_name || 'Reply'}:</span> {lastMsg.message || 'Sent an attachment'}
                        </span>
                      </div>
                    )}

                    <span className={`sm:hidden inline-flex mt-2 items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusMeta.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors flex-shrink-0 self-center hidden sm:flex">
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* ── Create Modal — full-width bottom sheet on mobile, centered dialog on desktop ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[80] sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out]">

            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
              <h2 className="text-lg font-black text-slate-900">Raise New Ticket</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Category <span className="text-red-500">*</span></label>
                <select
                  value={form.query_type}
                  onChange={e => setForm({...form, query_type: e.target.value as QueryType})}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                >
                  <option value="general">General Inquiry</option>
                  <option value="complaint">Complaint</option>
                  <option value="request">Special Request</option>
                  <option value="feedback">Feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Subject <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                  placeholder="e.g. Leave request for tomorrow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Message Details <span className="text-red-500">*</span></label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={e => setForm({...form, message: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none resize-none transition-all"
                  placeholder="Please provide as much detail as possible..."
                />
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Attachment <span className="lowercase font-normal text-slate-400">(Optional - Max 5MB)</span></label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="file"
                    id="ticket-attachment"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleFileValidation}
                  />
                  <label
                    htmlFor="ticket-attachment"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-indigo-600 cursor-pointer transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                    {attachment ? 'Change File' : 'Attach File'}
                  </label>

                  {attachment && (
                    <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 max-w-[200px]">
                      <span className="truncate">{attachment.name}</span>
                      <button type="button" onClick={() => setAttachment(null)} className="hover:text-indigo-900"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitLoading} className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
                  {submitLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting</> : <><Plus className="w-4 h-4" /> Submit Ticket</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}