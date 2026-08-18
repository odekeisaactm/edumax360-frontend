'use client';

// app/dashboard/staff/communication/queries/[id]/page.tsx
//
// Full-page thread view for one ticket, on its own route. The "back"
// button always navigates to the index — no more mobile-only back arrow
// or hidden desktop pane; this page IS the detail view now.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { queriesAPI } from '@/lib/communication.service';
import type { Query } from '@/lib/types';
import Avatar from '@/components/communication/Avatar';
import {
  MessageSquare, CheckCircle2, Send, Loader2, X, Paperclip, UserCheck, ChevronLeft,
} from 'lucide-react';
import { ToastStack, useToasts, getSenderName, extractError, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '../_shared';

const INBOX_PATH = '/dashboard/staff/communication/queries';

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toasts, showToast, dismissToast } = useToasts();

  // Safely parse the ID, fallback to null if not ready to prevent NaN fetches
  const ticketId = params?.id ? Number(params.id) : null;

  const [ticket, setTicket] = useState<Query | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [replyText, setReplyText] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) return; // BLOCKS THE NaN FETCH

    setLoading(true);
    try {
      const data = await queriesAPI.get(ticketId);
      setTicket(data);
      setNotFound(false);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        showToast('error', extractError(err) || 'Failed to load ticket.');
      }
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // Only trigger the fetch once the ticketId is valid
  useEffect(() => {
    if (ticketId) fetchTicket();
  }, [ticketId, fetchTicket]);

  useEffect(() => {
    if (ticket) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [ticket]);

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

  const handleClaim = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const updated = await queriesAPI.update(ticket.id, {
        status: 'in_progress',
        assigned_to: (user as any)?.profile?.id || user?.id
      });
      setTicket(updated);
      showToast('success', 'Ticket claimed successfully.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!ticket) return;
    setActionLoading(true);
    try {
      const updated = await queriesAPI.update(ticket.id, { status: 'resolved' });
      setTicket(updated);
      showToast('success', 'Ticket marked as resolved.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReply = async () => {
    if (!ticket || (!replyText.trim() && !attachment)) return;
    setReplyLoading(true);

    try {
      const payload = new FormData();
      payload.append('query', String(ticket.id));
      if (replyText.trim()) payload.append('message', replyText);
      if (attachment) payload.append('attachment', attachment);

      await queriesAPI.addFollowUp(ticket.id, payload);

      setReplyText("");
      setAttachment(null);

      await fetchTicket();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setReplyLoading(false);
    }
  };

  // Do not render the main UI until we are no longer loading and we have a valid ticket
  if (loading || !ticketId) {
    return (
      <div className="flex h-[100dvh] lg:h-[calc(100vh-4rem)] bg-slate-50 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (notFound || !ticket) {
    return (
      <div className="flex flex-col h-[100dvh] lg:h-[calc(100vh-4rem)] bg-slate-50 items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-6">
          <MessageSquare className="w-10 h-10 text-slate-300" />
        </div>
        <p className="text-xl font-black text-slate-700">Ticket not found</p>
        <p className="text-sm font-medium text-slate-500 mt-2 mb-6 max-w-xs">
          This ticket may have been removed, or the link is incorrect.
        </p>
        <button onClick={() => router.push(INBOX_PATH)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Inbox
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] lg:h-[calc(100vh-4rem)] bg-slate-50/50 lg:border-t border-slate-200 overflow-hidden">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Thread Header */}
      <div className="px-4 sm:px-6 py-5 sm:py-6 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 bg-white shadow-sm z-10 flex-shrink-0">
        <div className="min-w-0 flex items-start gap-2.5 flex-1">
          <button onClick={() => router.push(INBOX_PATH)}
            className="p-1.5 -ml-1.5 mt-0.5 rounded-lg hover:bg-slate-100 text-slate-500 flex-shrink-0" title="Back to Inbox">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                TKT-{ticket.id}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {ticket.query_type}
              </span>
              {(ticket as any).assigned_to_name && (
                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  Assigned to {(ticket as any).assigned_to_name}
                </span>
              )}
            </div>

            {/* Full title, free to wrap — this page has nothing else competing for width */}
            <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {ticket.title}
            </h2>

            <div className="text-sm text-slate-500 flex items-center gap-2 font-medium flex-wrap">
              <Avatar name={getSenderName(ticket)} size="xs" ring={false} />
              <span className="whitespace-nowrap">Sent by <span className="font-bold text-slate-700">{getSenderName(ticket)}</span></span>
              {(ticket as any).resolved_at && (
                <span className="text-slate-400 font-normal">
                  · resolved {new Date((ticket as any).resolved_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0 sm:pt-0.5">
          {ticket.status === 'open' && (
            <button
              onClick={handleClaim}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 text-indigo-700 transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              <UserCheck className="w-4 h-4" /> Claim Ticket
            </button>
          )}
          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
            <button
              onClick={handleResolve}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-emerald-600 border border-emerald-600 rounded-xl hover:bg-emerald-700 text-white transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" /> Mark Resolved
            </button>
          )}
        </div>
      </div>

      {/* Thread Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50 custom-scrollbar relative">

        <div className="flex justify-center pt-2">
          <span className="bg-white px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 border border-slate-200 shadow-sm uppercase tracking-widest">
            {new Date(ticket.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Initial Query (Requester = Left) */}
        <div className="flex justify-start gap-2.5">
          <Avatar name={getSenderName(ticket)} size="sm" />
          <div className="max-w-[85%] lg:max-w-[70%] min-w-0">
             <span className="text-[10px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">{getSenderName(ticket)}</span>
             <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">{ticket.message}</p>

                {(ticket as any).attachment && (
                  <a href={(ticket as any).attachment} target="_blank" rel="noopener noreferrer"
                     className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors w-max">
                    <Paperclip className="h-3.5 w-3.5" /> View Attachment
                  </a>
                )}
             </div>
             <span className="text-[10px] font-semibold text-slate-400 mt-1.5 block">{new Date(ticket.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>

        {/* Follow ups */}
        {ticket.follow_ups?.map((msg) => {
          const isMe = msg.sent_by === user?.id;
          const isAgent = isMe || (msg.sent_by_name && msg.sent_by_name !== getSenderName(ticket));
          const displayName = isMe ? 'You' : (msg.sent_by_name || (isAgent ? 'Agent' : 'Sender'));

          return (
            <div key={msg.id} className={`flex gap-2.5 ${isAgent ? 'justify-end' : 'justify-start'}`}>
              {!isAgent && <Avatar name={msg.sent_by_name || getSenderName(ticket)} size="sm" />}
              <div className="max-w-[85%] lg:max-w-[70%] min-w-0">
                <span className={`text-[10px] font-bold mb-1.5 block uppercase tracking-wider ${isAgent ? 'text-indigo-400 text-right' : 'text-slate-500'}`}>
                  {displayName}
                </span>

                <div className={`px-5 py-4 shadow-sm text-sm font-medium leading-relaxed whitespace-pre-wrap break-words ${
                  isAgent
                    ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm'
                }`}>
                  {msg.message}
                  {msg.attachment && (
                    <a href={msg.attachment} target="_blank" rel="noopener noreferrer"
                       className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors w-max ${
                         isAgent ? 'bg-black/10 hover:bg-black/20 text-white' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700'
                       }`}>
                      <Paperclip className="h-3.5 w-3.5" /> View Attachment
                    </a>
                  )}
                </div>
                <span className={`text-[10px] font-semibold text-slate-400 mt-1.5 block ${isAgent ? 'text-right' : ''}`}>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              {isAgent && <Avatar name={displayName === 'You' ? (user?.first_name ? `${user.first_name} ${user.last_name || ''}` : 'You') : displayName} size="sm" />}
            </div>
          );
        })}

        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Reply Box */}
      <div className="p-3 sm:p-4 border-t border-slate-200 bg-white z-10 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
          <div className="max-w-4xl mx-auto space-y-2">

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
                  id="staff-reply-attachment"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleFileValidation}
                />
                <label
                  htmlFor="staff-reply-attachment"
                  className="flex items-center justify-center w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <Paperclip className="w-5 h-5" />
                </label>
              </div>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 min-h-[48px] sm:min-h-[52px] max-h-[200px] resize-y border border-slate-200 rounded-2xl px-4 py-3 sm:py-3.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-slate-50 transition-all custom-scrollbar"
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
              This ticket has been marked as {ticket.status}. You cannot send further replies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}