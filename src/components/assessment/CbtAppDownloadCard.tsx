'use client';

/**
 * Parent portal: "Download the CBT App" card.
 * Shows the school's current Android / Windows releases (uploaded by staff
 * under Assessment → CBT App). Hidden when nothing has been published.
 */
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Download, Smartphone, Monitor, ShieldCheck, ChevronDown } from 'lucide-react';

export interface PublicRelease {
  platform: 'android' | 'windows';
  version: string;
  min_version: string | null;
  download_url: string;
  file_name: string;
  file_size: number;
  notes: string;
  released_at: string;
}

export const formatBytes = (n: number) =>
  !n ? '' : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

const PLATFORMS = {
  android: {
    label: 'Android phone or tablet',
    icon: Smartphone,
    tone: 'from-emerald-500 to-teal-600',
    steps: [
      'Tap Download, then open the downloaded file.',
      'If asked, allow your browser to "install unknown apps" for this file.',
      'Open the app and allow the camera when asked. The app pins the screen during exams; that is expected.',
    ],
  },
  windows: {
    label: 'Windows laptop or desktop',
    icon: Monitor,
    tone: 'from-indigo-500 to-blue-600',
    steps: [
      'Download and run the setup file (no administrator rights needed).',
      'If Windows SmartScreen appears, choose "More info" → "Run anyway".',
      'Open the app from the desktop shortcut. It runs full-screen; use the Exit button on the first screen to close it.',
    ],
  },
} as const;

export default function CbtAppDownloadCard() {
  const [releases, setReleases] = useState<Partial<Record<'android' | 'windows', PublicRelease | null>> | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/assessment/cbt-app-releases/latest/')
      .then(r => setReleases(r.data || {}))
      .catch(() => setReleases({}));
  }, []);

  const available = (['android', 'windows'] as const).filter(p => releases?.[p]?.download_url);
  if (!releases || available.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-6">
      <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black">Download the CBT Exam App</h2>
          <p className="text-[12px] text-slate-300 font-medium">Install it on your child&apos;s device before exam day.</p>
        </div>
      </div>
      <div className={`grid grid-cols-1 ${available.length > 1 ? 'md:grid-cols-2' : ''} gap-4 p-5`}>
        {available.map(p => {
          const r = releases[p]!;
          const meta = PLATFORMS[p];
          const Icon = meta.icon;
          const expanded = open === p;
          return (
            <div key={p} className="rounded-2xl border border-slate-200 p-4 flex flex-col">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.tone} text-white flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-900">{meta.label}</p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Version {r.version}{r.file_size ? ` · ${formatBytes(r.file_size)}` : ''}
                  </p>
                </div>
              </div>
              {r.notes && <p className="text-xs text-slate-500 mt-3 leading-relaxed whitespace-pre-line">{r.notes}</p>}
              <a href={r.download_url} target="_blank" rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black px-4 py-3">
                <Download className="w-4 h-4" /> Download
              </a>
              <button type="button" onClick={() => setOpen(expanded ? null : p)}
                className="mt-2 text-[11px] font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center justify-center gap-1">
                How to install <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && (
                <ol className="mt-2 space-y-1.5 text-xs text-slate-600 list-decimal pl-5">
                  {meta.steps.map(s => <li key={s}>{s}</li>)}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
