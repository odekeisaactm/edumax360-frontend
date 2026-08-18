'use client';

// Suggested path: app/dashboard/parent/announcements/page.tsx
//
// Same data flow and logic as before (search, pagination, reading modal) —
// this pass is purely visual. Design idea: an actual noticeboard. Each
// announcement is a pinned note — a soft paper card, faintly tilted, held
// down by a small colored pin (color = priority), with an honest torn/ribbon
// flag for anything urgent or high priority. The page background reads as
// the board itself; the reading modal is where the "paper" gets picked up
// and read close, so its headline switches to an editorial serif (Newsreader)
// while the rest of the UI stays on the app's normal sans face.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Newsreader } from 'next/font/google';
import { announcementsAPI } from '@/lib/communication.service';
import type { Announcement, AnnouncementPriority } from '@/lib/types';
import RichTextViewer from '@/components/communication/RichTextViewer';
import { stripHtml } from '@/components/communication/RichTextEditor';
import {
  Megaphone, Search, X, Loader2, AlertCircle,
  CalendarDays, Paperclip, ChevronLeft, ChevronRight,
  ArrowRight, FileText, PartyPopper
} from 'lucide-react';

const serif = Newsreader({ subsets: ['latin'], weight: ['500', '600', '700'], style: ['normal', 'italic'], display: 'swap' });

// ─── Helpers & Constants ───────────────────────────────────────────────────────

const PAGE_SIZE = 12;

// Named per-priority "pin" color + optional corner flag for anything that
// needs to visually jump off the board.
const PRIORITY_META: Record<AnnouncementPriority, { label: string; pin: string; flagBg: string; flagText: string; showFlag: boolean }> = {
  urgent: { label: 'Urgent', pin: '#e11d48', flagBg: '#e11d48', flagText: '#fff', showFlag: true },
  high: { label: 'High Priority', pin: '#d97706', flagBg: '#d97706', flagText: '#fff', showFlag: true },
  normal: { label: 'Notice', pin: '#4f46e5', flagBg: '#4f46e5', flagText: '#fff', showFlag: false },
  low: { label: 'FYI', pin: '#94a3b8', flagBg: '#94a3b8', flagText: '#fff', showFlag: false },
};

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

// Deterministic per-card tilt so re-renders don't jitter the layout —
// derived from the id rather than random, small enough to read as "hand
// placed" rather than crooked.
function tiltFor(id: number | string): number {
  const n = typeof id === 'number' ? id : String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const steps = [-1.6, -0.8, 0, 0.9, 1.7];
  return steps[n % steps.length];
}

// ─── Reading Modal ─────────────────────────────────────────────────────────────

function AnnouncementReadModal({
  announcement,
  onClose
}: {
  announcement: Announcement | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (announcement) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [announcement]);

  if (!announcement) return null;
  const meta = PRIORITY_META[announcement.priority] || PRIORITY_META.normal;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-[#2a2419]/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] ring-1 ring-black/5">

        {/* Header */}
        <div className="relative px-7 pt-7 pb-6 border-b border-slate-100 flex items-start justify-between flex-shrink-0 bg-slate-50/60">
          <div className="pr-4 min-w-0">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.pin }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: meta.pin }}>{meta.label}</span>
              <span className="text-slate-300">·</span>
              <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {new Date(announcement.created_at).toLocaleDateString('en-US', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </span>
            </div>
            <h2 className={`${serif.className} text-[26px] font-semibold text-slate-900 leading-[1.15] tracking-tight`}>
              {announcement.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-900/5 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 bg-white">
          <RichTextViewer html={announcement.content} />

          {announcement.attachment && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Attached File
              </p>
              <a
                href={announcement.attachment}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between p-4 rounded-xl border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-indigo-900 truncate">View Attachment</p>
                    <p className="text-xs text-indigo-600/70 truncate">Click to open or download</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function ParentNoticeboardPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [readingPost, setReadingPost] = useState<Announcement | null>(null);

  const fetchAnnouncements = useCallback(async (pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;

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
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchAnnouncements(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search, fetchAnnouncements]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-full pb-16 bg-slate-50">
      <AnnouncementReadModal announcement={readingPost} onClose={() => setReadingPost(null)} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8">

        {/* ── Header banner ── */}
        <div className="relative overflow-hidden rounded-3xl shadow-lg shadow-indigo-950/10" style={{ background: 'linear-gradient(135deg, #3730a3 0%, #4338ca 45%, #2563eb 100%)' }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
          <div className="relative px-6 sm:px-9 py-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
                  <Megaphone className="h-4 w-4 text-white" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-100">School Noticeboard</span>
              </div>
              <h1 className={`${serif.className} text-3xl sm:text-[34px] font-semibold text-white leading-tight tracking-tight`}>
                What's happening at school
              </h1>
              <p className="text-sm text-indigo-100/90 mt-2 max-w-md">Every notice pinned here, newest first — tap any note to read it in full.</p>
            </div>

            <div className="relative w-full md:w-72 flex-shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search updates..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-sm border-0 rounded-xl focus:ring-2 focus:ring-white/70 outline-none bg-white/95 shadow-sm transition-all placeholder:text-slate-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Feed Body ── */}
        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-500">Loading your noticeboard...</p>
          </div>
        ) : pageError ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-red-100 shadow-sm">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-red-600 mb-4">{pageError}</p>
            <button onClick={() => fetchAnnouncements(1)} className="px-5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-bold rounded-xl transition-colors">
              Try Again
            </button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="h-8 w-8 text-indigo-400" />
            </div>
            <h3 className={`${serif.className} text-xl font-semibold text-slate-800 mb-1`}>
              {search ? 'No matches found' : "You're all caught up"}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {search ? 'Try adjusting your search terms.' : 'Nothing new is pinned up right now — check back later.'}
            </p>
          </div>
        ) : (
          <div className="space-y-9">

            {/* Pinboard grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 pt-2">
              {announcements.map((ann) => {
                const previewText = stripHtml(ann.content);
                const meta = PRIORITY_META[ann.priority] || PRIORITY_META.normal;
                const tilt = tiltFor(ann.id);

                return (
                  <div
                    key={ann.id}
                    onClick={() => setReadingPost(ann)}
                    className="notice-card relative cursor-pointer"
                    style={{ ['--tilt' as any]: `${tilt}deg` }}
                  >
                    {/* Pin — sits outside the clipped card so it isn't cut off */}
                    <div className="notice-pin" style={{ backgroundColor: meta.pin }}>
                      <div className="notice-pin-highlight" />
                    </div>

                    <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-[0_3px_10px_rgba(15,23,42,0.06)]">
                      {meta.showFlag && (
                        <div className="corner-flag" style={{ backgroundColor: meta.flagBg, color: meta.flagText }}>
                          {meta.label}
                        </div>
                      )}

                      <div className="p-5 pt-6 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {new Date(ann.created_at).toLocaleDateString()}
                        </span>

                        <h3 className={`${serif.className} text-lg font-semibold text-slate-900 leading-snug mb-2 line-clamp-2`}>
                          {ann.title}
                        </h3>

                        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3 mb-4">
                          {previewText || 'Click to read full announcement...'}
                        </p>

                        <div className="pt-4 border-t border-dashed border-slate-200 flex items-center justify-between mt-auto">
                          {ann.attachment ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                              <Paperclip className="h-3 w-3" /> Attached
                            </span>
                          ) : <span />}
                          <span className="notice-read-more inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-indigo-600">
                            Read Notice <ArrowRight className="h-3.5 w-3.5 notice-arrow transition-transform" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
              <p className="text-xs font-semibold text-slate-500">
                Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} updates
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                  <button
                    onClick={() => fetchAnnouncements(page - 1)}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button
                        key={pg}
                        onClick={() => fetchAnnouncements(pg)}
                        className={`min-w-[2rem] h-8 rounded-lg text-xs font-bold transition-all ${
                          pg === page
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pg}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => fetchAnnouncements(page + 1)}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      <style jsx>{`
        .notice-card {
          transform: rotate(var(--tilt));
          transition: transform 0.22s ease;
        }
        .notice-card:hover {
          transform: rotate(0deg) translateY(-3px);
        }
        .notice-card:hover .notice-arrow {
          transform: translateX(3px);
        }
        .notice-pin {
          position: absolute;
          top: -7px;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.15);
        }
        .notice-pin-highlight {
          position: absolute;
          top: 2px;
          left: 3px;
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.65);
        }
        .corner-flag {
          position: absolute;
          top: 12px;
          right: -30px;
          width: 118px;
          padding: 3px 0;
          text-align: center;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          transform: rotate(45deg);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}