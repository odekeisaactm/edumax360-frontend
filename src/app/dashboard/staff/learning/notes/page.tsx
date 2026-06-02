'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { lessonNotesAPI } from '@/lib/api';
import { LessonNoteList } from '@/lib/types';
import {
  Plus, Search, Filter, FileText, Clock, CheckCircle,
  XCircle, Archive, AlertCircle, ChevronRight, Loader2,
  RefreshCw, Eye, Edit3, Trash2, Send, BookOpen,
  Brain, MoreVertical, Calendar, User, X,
} from 'lucide-react';

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: FileText, dot: 'bg-slate-400' },
  pending_approval: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700', icon: Clock, dot: 'bg-amber-500' },
  approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, dot: 'bg-emerald-500' },
  declined: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: XCircle, dot: 'bg-red-500' },
  archived: { label: 'Archived', color: 'bg-purple-100 text-purple-700', icon: Archive, dot: 'bg-purple-500' },
};

const METHOD_CONFIG = {
  manual: { label: 'Manual', color: 'bg-blue-50 text-blue-600' },
  ai_generated: { label: 'AI Generated', color: 'bg-violet-50 text-violet-600' },
  uploaded: { label: 'Uploaded', color: 'bg-teal-50 text-teal-600' },
};

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── AI Score Badge ────────────────────────────────────────────────────────────
function AIScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <span className="text-xs text-slate-300">—</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? 'text-emerald-600 bg-emerald-50' : pct >= 60 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>
      <Brain className="h-3 w-3" />
      {pct}%
    </span>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <FileText className="h-8 w-8 text-slate-300" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        {filtered ? 'No notes match your filters' : 'No lesson notes yet'}
      </h3>
      <p className="text-sm text-slate-400 mb-4">
        {filtered ? 'Try adjusting your search or filters.' : 'Create your first lesson note to get started.'}
      </p>
      {filtered && (
        <button onClick={onClear}
          className="text-sm text-emerald-600 font-medium hover:underline">
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LessonNotesPage() {
  const { hasPermission, user } = useAuth();
  const [notes, setNotes] = useState<LessonNoteList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Permissions
  const canCreate = user?.is_superuser || hasPermission('learning_resources.add_lessonnotemodel');
  const canApprove = user?.is_superuser || hasPermission('learning_resources.approve_lesson_note');
  const canDecline = user?.is_superuser || hasPermission('learning_resources.decline_lesson_note');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await lessonNotesAPI.list(params);
      setNotes(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const filtered = notes.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.subject_name.toLowerCase().includes(q) ||
      n.classes.some(c => c.toLowerCase().includes(q))
    );
  });

  const isFiltered = !!search || !!statusFilter;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
  };

  // Status summary counts
  const counts = notes.reduce((acc, n) => {
    acc[n.status] = (acc[n.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 pb-10">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            Lesson Notes
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            {notes.length} note{notes.length !== 1 ? 's' : ''} total
          </p>
        </div>
        {canCreate && (
          <Link href="/dashboard/staff/learning/notes/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
            <Plus className="h-4 w-4" /> New Note
          </Link>
        )}
      </div>

      {/* ── Status summary chips ── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
            !statusFilter ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}>
          All ({notes.length})
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const count = counts[key] || 0;
          if (count === 0) return null;
          return (
            <button key={key}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                statusFilter === key ? cfg.color + ' ring-2 ring-offset-1 ring-current' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Search + filter bar ── */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search notes, subjects, classes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border rounded-xl transition-colors ${
            showFilters ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}>
          <Filter className="h-4 w-4" />
          Filter
        </button>
        <button onClick={fetchNotes}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none">
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
            <p className="text-sm text-slate-400">Loading lesson notes...</p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm text-slate-500">Failed to load notes.</p>
            <button onClick={fetchNotes}
              className="text-sm text-emerald-600 font-medium hover:underline flex items-center gap-1 mx-auto">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        </div>
      )}

      {/* ── Notes list ── */}
      {!loading && !error && (
        filtered.length === 0
          ? <EmptyState filtered={isFiltered} onClear={clearFilters} />
          : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-50">
                {filtered.map(note => {
                  const methodCfg = METHOD_CONFIG[note.creation_method] ?? METHOD_CONFIG.manual;
                  return (
                    <div key={note.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group">

                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-5 w-5 text-emerald-600" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800 truncate">{note.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodCfg.color}`}>
                            {methodCfg.label}
                          </span>
                          {note.grant_student_access && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                              Student Access
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {note.subject_name}
                          </span>
                          {note.classes.length > 0 && (
                            <span className="text-xs text-slate-400">
                              {note.classes.slice(0, 2).join(', ')}
                              {note.classes.length > 2 && ` +${note.classes.length - 2}`}
                            </span>
                          )}
                          {note.scheduled_date && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(note.scheduled_date).toLocaleDateString()}
                            </span>
                          )}
                          {note.created_by_name && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {note.created_by_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <AIScoreBadge score={note.ai_vetting_score} />
                        <StatusBadge status={note.status as any} />
                        <Link
                          href={`/dashboard/staff/learning/notes/${note.id}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs text-emerald-600 font-medium hover:underline">
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}