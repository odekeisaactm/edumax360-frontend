'use client';

/**
 * School-wide exam security settings:
 *   • Device approval required / optional
 *   • Automatic warning + auto-submit after N security violations
 * Backed by GET/PATCH /api/assessment/general-settings/.
 */
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ShieldCheck, Smartphone, Loader2, Check, AlertTriangle, Info, BellRing, Send } from 'lucide-react';

interface GeneralSettings {
  require_device_approval: boolean;
  violation_warn_threshold: number;
  violation_auto_submit_threshold: number;
  updated_at?: string;
  updated_by_name?: string | null;
}

function errorText(err: unknown): string {
  const d = (err as { response?: { data?: unknown } })?.response?.data as Record<string, unknown> | undefined;
  if (d && typeof d === 'object') {
    for (const v of Object.values(d)) {
      if (Array.isArray(v) && v.length) return String(v[0]);
      if (typeof v === 'string') return v;
    }
  }
  return 'Could not save the settings.';
}

export default function ExamSecuritySettingsCard({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<GeneralSettings | null>(null);
  const [draft, setDraft] = useState<GeneralSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/api/assessment/general-settings/')
      .then(r => { setData(r.data); setDraft(r.data); })
      .catch(() => setLoadError('Could not load exam security settings.'));
  }, []);

  const dirty = !!(data && draft) && JSON.stringify({ ...data, updated_at: 0, updated_by_name: 0 }) !== JSON.stringify({ ...draft, updated_at: 0, updated_by_name: 0 });

  const save = async (patch?: Partial<GeneralSettings>) => {
    if (!draft) return;
    const body = { ...draft, ...(patch || {}) };
    setSaving(true); setError(null);
    try {
      const r = await api.patch('/api/assessment/general-settings/', {
        require_device_approval: body.require_device_approval,
        violation_warn_threshold: Number(body.violation_warn_threshold) || 0,
        violation_auto_submit_threshold: Number(body.violation_auto_submit_threshold) || 0,
      });
      setData(r.data); setDraft(r.data);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 font-medium flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> {loadError}
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-3 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading exam security…
      </div>
    );
  }

  const optional = !draft.require_device_approval;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div>
          <div>
            <h2 className="text-base font-black">Exam Security</h2>
            <p className="text-[11px] text-slate-300 font-medium">Applies to every CBT exam, on web, desktop and mobile apps.</p>
          </div>
        </div>
        {saved && <span className="text-[11px] font-bold flex items-center gap-1 text-emerald-300"><Check className="w-3.5 h-3.5" /> Saved</span>}
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* Device approval */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Smartphone className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-900">Device approval</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
              {optional
                ? 'Off: any device can sit exams without staff approval. Devices are registered automatically on first use. Devices you block or deactivate are still refused.'
                : 'On: every device must be approved under Assessment → Devices before a student can start an exam on it.'}
            </p>
            {optional && (
              <p className="text-[11px] text-amber-700 font-semibold mt-2 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-px" /> Useful for a first exam with many new devices. Turn it back on once devices are settled.
              </p>
            )}
          </div>
          <button
            type="button" role="switch" aria-checked={draft.require_device_approval} disabled={!canEdit || saving}
            onClick={() => { const next = { ...draft, require_device_approval: !draft.require_device_approval }; setDraft(next); save(next); }}
            className={`relative inline-flex h-7 w-[52px] shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${draft.require_device_approval ? 'bg-indigo-600' : 'bg-slate-300'}`}
            title={draft.require_device_approval ? 'Approval required' : 'Approval optional'}
          >
            <span className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${draft.require_device_approval ? 'translate-x-[26px]' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Automatic enforcement */}
        <div>
          <p className="text-sm font-black text-slate-900">Automatic enforcement</p>
          <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
            Violations are clear signs of leaving the exam or tampering: switching tabs or apps, leaving screen pinning, split-screen,
            screen recording, extra faces on camera. Camera noise and window focus alone don&apos;t count.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <label className="rounded-xl border border-slate-200 p-3.5 flex items-center gap-3">
              <BellRing className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800">Warn the student after</span>
                <span className="block text-[10.5px] text-slate-400 font-medium">0 = no automatic warning</span>
              </span>
              <input type="number" min={0} max={50} disabled={!canEdit} value={draft.violation_warn_threshold}
                onChange={e => setDraft({ ...draft, violation_warn_threshold: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                className="w-16 px-2 py-1.5 text-sm font-black text-center rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-[11px] font-bold text-slate-400">violations</span>
            </label>
            <label className="rounded-xl border border-slate-200 p-3.5 flex items-center gap-3">
              <Send className="w-4 h-4 text-rose-500 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-slate-800">Auto-submit the exam after</span>
                <span className="block text-[10.5px] text-slate-400 font-medium">0 = never auto-submit</span>
              </span>
              <input type="number" min={0} max={100} disabled={!canEdit} value={draft.violation_auto_submit_threshold}
                onChange={e => setDraft({ ...draft, violation_auto_submit_threshold: Math.max(0, parseInt(e.target.value || '0', 10)) })}
                className="w-16 px-2 py-1.5 text-sm font-black text-center rounded-lg border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-[11px] font-bold text-slate-400">violations</span>
            </label>
          </div>
          {error && <p className="mt-3 text-xs font-bold text-rose-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}
          {canEdit && dirty && (
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => { setDraft(data); setError(null); }} disabled={saving}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => save()} disabled={saving}
                className="px-4 py-2 text-xs font-black rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save rules
              </button>
            </div>
          )}
          {!canEdit && <p className="mt-3 text-[11px] text-slate-400 font-medium">Only administrators can change these settings.</p>}
        </div>
      </div>
    </div>
  );
}
