'use client';

// Suggested path: app/dashboard/parent/communication/queries/[id]/page.tsx

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { queriesAPI } from '@/lib/communication.service';
import type { Query } from '@/lib/types';
import Avatar from '@/components/communication/Avatar';
import {
  ChevronLeft, Send, Loader2, AlertCircle,
  CheckCircle2, Clock, Check, X, ShieldAlert, Paperclip
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

const STATUS_META = {
  open: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertCircle, label: 'Open' },
  in_progress: { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock, label: 'In Progress' },
  resolved: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'Resolved' },
  closed: { color: 'bg-slate-100 text-slate-600 border-slate-200', icon: CheckCircle2, label: 'Closed' },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function ParentTicketThread() {
  const params = useParams();
  const { user } = useAuth();

  const [ticket, setTicket] = useState<Query | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts(prev => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  };
  const dismissToast = (tid: number) => setToasts(prev => prev.filter(t => t.id !== tid));

  useEffect(() => {
    if (params?.id) fetchTicket(Number(params.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  const fetchTicket = async (id: number) => {
    try {
      const data = await queriesAPI.get(id);
      setTicket(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

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

  const handleReply = async () => {
    if ((!replyText.trim() && !attachment) || !ticket) return;
    setReplyLoading(true);

    try {
      const payload = new FormData();
      payload.append('query', String(ticket.id));
      if (replyText.trim()) payload.append('message', replyText);
      if (attachment) payload.append('attachment', attachment);

      await queriesAPI.addFollowUp(ticket.id, payload);

      setReplyText("");
      setAttachment(null);
      await fetchTicket(ticket.id);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setReplyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-medium text-slate-500">Loading thread...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto text-center px-4">
        <ShieldAlert className="w-16 h-16 mb-4 text-red-300" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
        <p className="text-sm text-slate-500 mb-6">{error || 'Ticket not found or you do not have permission to view it.'}</p>
        <Link href="/dashboard/parent/communication/queries" className="px-6 py-2.5 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors">
          Back to Helpdesk
        </Link>
      </div>
    );
  }

  const statusMeta = STATUS_META[ticket.status as keyof typeof STATUS_META] || STATUS_META.open;
  const StatusIcon = statusMeta.icon;
  const isOriginalMessageMine = ticket.flow === 'incoming';
  const parentDisplayName = (ticket as any).parent_name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'You');

  return (
    <div className="max-w-4xl mx-auto h-[100dvh] sm:h-[calc(100vh-6rem)] flex flex-col sm:pb-4 px-0 sm:px-4 md:px-6">

      {/* Toast Overlay */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-auto">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border sm:max-w-sm ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
            {t.type === 'success' ? <Check className="h-4 w-4 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 mt-0.5 text-red-500" />}
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => dismissToast(t.id)}><X className="h-3.5 w-3.5 opacity-50 hover:opacity-100" /></button>
          </div>
        ))}
      </div>

      {/* Thread Header */}
      <div className="bg-white sm:rounded-t-3xl border border-slate-100 border-b-0 shadow-sm px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard/parent/communication/queries" className="p-2 -ml-1.5 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">
              {ticket.title}
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wider truncate">
              TKT-{ticket.id} • {ticket.query_type}
              {(ticket as any).assigned_to_name && <> • Handled by {(ticket as any).assigned_to_name}</>}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border flex-shrink-0 ${statusMeta.color}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{statusMeta.label}</span>
        </span>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-50 sm:border-x border-slate-100 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-hide relative">

        <div className="flex justify-center pt-2">
          <span className="bg-white px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 border border-slate-200 shadow-sm uppercase tracking-widest">
            {new Date(ticket.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Original Ticket Message */}
        <div className={`flex gap-2.5 ${isOriginalMessageMine ? 'justify-end' : 'justify-start'}`}>
          {!isOriginalMessageMine && <Avatar name="School Admin" size="sm" />}
          <div className="max-w-[85%] md:max-w-[65%] min-w-0">
            {!isOriginalMessageMine && <span className="text-[10px] font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">School Admin</span>}
            <div className={`px-5 py-3.5 shadow-sm text-sm font-medium leading-relaxed whitespace-pre-wrap ${
              isOriginalMessageMine
                ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
            }`}>
              {ticket.message}

              {(ticket as any).attachment && (
                <a href={(ticket as any).attachment} target="_blank" rel="noopener noreferrer"
                   className={`inline-flex items-center gap-1 mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                     isOriginalMessageMine ? 'bg-black/10 hover:bg-black/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                   }`}>
                  <Paperclip className="h-3 w-3" /> View Attachment
                </a>
              )}
            </div>
            <span className={`text-[10px] font-semibold text-slate-400 mt-1.5 block ${isOriginalMessageMine ? 'text-right' : 'text-left'}`}>
              {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {isOriginalMessageMine && <Avatar name={parentDisplayName} size="sm" />}
        </div>

        {/* Follow-up Threads */}
        {ticket.follow_ups?.map((msg) => {
          const isMe = msg.sent_by === user?.id;
          const displayName = isMe ? parentDisplayName : (msg.sent_by_name || 'School Admin');
          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && <Avatar name={msg.sent_by_name || 'School Admin'} size="sm" />}
              <div className="max-w-[85%] md:max-w-[65%] min-w-0">
                {!isMe && <span className="text-[10px] font-bold text-slate-400 mb-1.5 block uppercase tracking-wider">{msg.sent_by_name || 'School Admin'}</span>}
                <div className={`px-5 py-3.5 shadow-sm text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                  isMe
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                }`}>
                  {msg.message}
                  {msg.attachment && (
                    <a href={msg.attachment} target="_blank" rel="noopener noreferrer"
                       className={`inline-flex items-center gap-1 mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                         isMe ? 'bg-black/10 hover:bg-black/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                       }`}>
                      <Paperclip className="h-3 w-3" /> View Attachment
                    </a>
                  )}
                </div>
                <span className={`text-[10px] font-semibold text-slate-400 mt-1.5 block ${isMe ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {isMe && <Avatar name={parentDisplayName} size="sm" />}
            </div>
          );
        })}

        {(ticket.status === 'resolved' || ticket.status === 'closed') && (
          <div className="flex justify-center pt-1">
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-full text-[11px] font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ticket {ticket.status}{(ticket as any).resolved_at ? ` on ${new Date((ticket as any).resolved_at).toLocaleDateString()}` : ''}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Message Input Box */}
      <div className="bg-white sm:rounded-b-3xl border border-slate-100 border-t-0 p-3 sm:p-4 shadow-sm z-10 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
          <div className="max-w-3xl mx-auto space-y-2">

            {attachment && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg w-max mb-2">
                <span className="text-xs font-bold truncate max-w-[200px]">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="p-0.5 hover:bg-indigo-200 rounded-md transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 items-end">
              <div className="relative flex-shrink-0 mb-1">
                <input
                  type="file"
                  id="ticket-attachment-reply"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileValidation}
                />
                <label
                  htmlFor="ticket-attachment-reply"
                  className="flex items-center justify-center w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <Paperclip className="w-5 h-5" />
                </label>
              </div>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 min-h-[48px] sm:min-h-[52px] max-h-[120px] resize-y border border-slate-200 rounded-2xl px-4 py-3 sm:py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-slate-50 transition-all custom-scrollbar"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />

              <button
                onClick={handleReply}
                disabled={replyLoading || (!replyText.trim() && !attachment)}
                className="mb-1 p-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center h-[48px] w-[48px] sm:h-[52px] sm:w-[52px] shrink-0"
              >
                {replyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-sm font-bold text-slate-500 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              This ticket has been {ticket.status}. No further replies can be sent.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}