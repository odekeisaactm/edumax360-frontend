'use client';

// app/dashboard/staff/communication/queries/page.tsx
//
// Index/list only. Clicking a ticket navigates to a real route
// (/queries/[id]) instead of toggling a pane on the same page — this is a
// standard master → detail navigation now, not a split-screen workspace.

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { queriesAPI } from '@/lib/communication.service';
import type { Query } from '@/lib/types';
import Avatar from '@/components/communication/Avatar';
import { Search, CheckCircle2, Inbox, Loader2 } from 'lucide-react';
import { ToastStack, useToasts, STATUS_META, getSenderName, needsReply, FilterKey } from './_shared';

export default function QueriesIndexPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toasts, showToast, dismissToast } = useToasts();

  const [tickets, setTickets] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('unassigned');
  const [search, setSearch] = useState('');

  const fetchQueries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await queriesAPI.list();
      const results: Query[] = (res as any)?.results || res || [];
      results.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setTickets(results);
    } catch (err) {
      showToast('error', 'Failed to load inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueries(); }, [fetchQueries]);

  const staffId = (user as any)?.profile?.id || user?.id;

  const counts = {
    all: tickets.length,
    unassigned: tickets.filter(t => !t.assigned_to && t.status !== 'resolved' && t.status !== 'closed').length,
    mine: tickets.filter(t => t.assigned_to === staffId && t.status !== 'resolved' && t.status !== 'closed').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(search.toLowerCase()) ||
                          getSenderName(t).toLowerCase().includes(search.toLowerCase()) ||
                          t.id.toString().includes(search);
    if (!matchesSearch) return false;

    if (filter === 'unassigned') return !t.assigned_to && t.status !== 'resolved' && t.status !== 'closed';
    if (filter === 'mine') return t.assigned_to === staffId && t.status !== 'resolved' && t.status !== 'closed';
    if (filter === 'resolved') return t.status === 'resolved' || t.status === 'closed';
    return true; // 'all'
  });

  return (
    <div className="flex flex-col h-[100dvh] lg:h-[calc(100vh-4rem)] bg-slate-50 lg:border-t border-slate-200 overflow-hidden">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header & Search */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <h1 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2 max-w-3xl mx-auto lg:max-w-none">
          <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
            <Inbox className="w-5 h-5"/>
          </div>
          Helpdesk Inbox
        </h1>

        <div className="max-w-3xl mx-auto lg:max-w-none">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search subject or sender..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none bg-white shadow-sm transition-all"
            />
          </div>

          {/* Filter Segmented Control */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-xl overflow-x-auto">
            {([
              { id: 'unassigned', label: 'Unassigned' },
              { id: 'mine', label: 'Mine' },
              { id: 'all', label: 'All' },
              { id: 'resolved', label: 'Resolved' },
            ] as { id: FilterKey; label: string }[]).map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex-1 px-3 py-2 text-[11px] font-bold rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                  filter === f.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f.label} <span className={filter === f.id ? 'text-indigo-400' : 'text-slate-400'}>{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto lg:max-w-none divide-y divide-slate-50">
          {loading ? (
            <div className="p-10 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-sm font-medium text-slate-400">Loading inbox...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
             <div className="p-10 text-center flex flex-col items-center">
               <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                 <CheckCircle2 className="w-6 h-6 text-slate-300" />
               </div>
               <p className="text-sm font-bold text-slate-600">No tickets found</p>
               <p className="text-xs text-slate-400 mt-1">Inbox zero achieved.</p>
             </div>
          ) : (
            filteredTickets.map(ticket => {
              const sender = getSenderName(ticket);
              const statusMeta = STATUS_META[ticket.status as keyof typeof STATUS_META] || STATUS_META.open;
              const flagged = needsReply(ticket);

              return (
                <div
                  key={ticket.id}
                  onClick={() => router.push(`/dashboard/staff/communication/queries/${ticket.id}`)}
                  className="p-5 cursor-pointer transition-all border-l-4 border-l-transparent hover:bg-slate-50 hover:border-l-indigo-200 bg-white flex gap-3.5"
                >
                  <Avatar name={sender} size="md" />

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-sm truncate flex items-center gap-1.5 text-slate-900">
                        {flagged && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Awaiting your reply" />}
                        {sender}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold flex-shrink-0 mt-0.5">
                        {new Date(ticket.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <div className="text-sm font-medium leading-snug line-clamp-2 text-slate-600">
                      {ticket.title}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className={`text-[9px] px-2 py-0.5 rounded uppercase tracking-wider font-bold border flex-shrink-0 ${statusMeta.color} ${statusMeta.border}`}>
                        {statusMeta.label}
                      </span>
                      {(ticket as any).assigned_to_name ? (
                        <span className="text-[10px] font-semibold text-slate-400 truncate">{(ticket as any).assigned_to_name}</span>
                      ) : (
                        <span className="text-[10px] font-mono font-semibold text-slate-300">TKT-{ticket.id}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}