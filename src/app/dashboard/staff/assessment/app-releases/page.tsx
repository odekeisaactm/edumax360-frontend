'use client';

/**
 * Staff: upload the CBT app builds (Android APK / Windows installer).
 * The current release per platform appears on the parent portal and is what
 * the app's update check reads.
 */
import React, { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Upload, Smartphone, Monitor, Loader2, Check, Trash2, Star, AlertTriangle, Link2, Download, X, PackageCheck,
} from 'lucide-react';
import { formatBytes } from '@/components/assessment/CbtAppDownloadCard';

interface Release {
  id: number;
  platform: 'android' | 'windows';
  platform_display: string;
  version: string;
  external_url: string;
  file_name: string;
  file_size: number;
  notes: string;
  min_version: string;
  is_current: boolean;
  download_url: string;
  uploaded_by_name: string | null;
  created_at: string;
}

function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: unknown; status?: number } };
  const d = e?.response?.data as Record<string, unknown> | undefined;
  if (d && typeof d === 'object') {
    for (const v of Object.values(d)) {
      if (Array.isArray(v) && v.length) return String(v[0]);
      if (typeof v === 'string') return v;
    }
  }
  if (e?.response?.status === 413) return 'The file is too large for the server upload limit. Use a download link instead.';
  return fallback;
}

const EMPTY = { platform: 'android' as 'android' | 'windows', version: '', min_version: '', notes: '', external_url: '' };

export default function CbtAppReleasesPage() {
  const { user } = useAuth();
  const isAdmin = !!(user?.is_superuser || (user as { is_staff?: boolean } | null)?.is_staff);
  const [releases, setReleases] = useState<Release[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [useLink, setUseLink] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api.get('/api/assessment/cbt-app-releases/')
      .then(r => setReleases(Array.isArray(r.data) ? r.data : r.data?.results || []))
      .catch(() => setLoadError('Could not load app releases.'));

  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setDone(false);
    if (!form.version.trim()) { setError('Enter the version number, e.g. 1.1.0'); return; }
    if (!useLink && !file) { setError('Choose the app file to upload.'); return; }
    if (useLink && !form.external_url.trim()) { setError('Paste the download link.'); return; }
    const fd = new FormData();
    fd.append('platform', form.platform);
    fd.append('version', form.version.trim());
    fd.append('min_version', form.min_version.trim());
    fd.append('notes', form.notes);
    fd.append('is_current', 'true');
    if (useLink) fd.append('external_url', form.external_url.trim());
    else if (file) fd.append('file', file);
    setProgress(0);
    try {
      await api.post('/api/assessment/cbt-app-releases/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: ev => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
      });
      setForm({ ...EMPTY, platform: form.platform });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setDone(true); setTimeout(() => setDone(false), 3000);
      load();
    } catch (err) {
      setError(errorText(err, 'Upload failed.'));
    } finally {
      setProgress(null);
    }
  };

  const makeCurrent = async (r: Release) => {
    setBusyId(r.id);
    try { await api.patch(`/api/assessment/cbt-app-releases/${r.id}/`, { is_current: true }); load(); }
    catch (err) { setError(errorText(err, 'Could not update the release.')); }
    finally { setBusyId(null); }
  };

  const remove = async (r: Release) => {
    if (!window.confirm(`Delete ${r.platform_display} ${r.version}? Parents will no longer see it.`)) return;
    setBusyId(r.id);
    try { await api.delete(`/api/assessment/cbt-app-releases/${r.id}/`); load(); }
    catch (err) { setError(errorText(err, 'Could not delete the release.')); }
    finally { setBusyId(null); }
  };

  const accept = form.platform === 'android' ? '.apk' : '.exe,.msi,.zip';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0"><PackageCheck className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl font-black text-slate-900">CBT App Releases</h1>
          <p className="text-sm text-slate-500 font-medium">
            Upload the Android and Windows exam apps. The current release of each appears on the parent portal,
            and older app versions are told to update.
          </p>
        </div>
      </div>

      {isAdmin && (
        <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 sm:p-6 space-y-4">
          <p className="text-sm font-black text-slate-900">Publish a new release</p>
          <div className="grid grid-cols-2 gap-3">
            {(['android', 'windows'] as const).map(p => (
              <button key={p} type="button" onClick={() => { setForm({ ...form, platform: p }); setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                className={`rounded-xl border-2 p-3 flex items-center gap-3 text-left transition-colors ${form.platform === p ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
                {p === 'android' ? <Smartphone className="w-5 h-5 text-emerald-600" /> : <Monitor className="w-5 h-5 text-indigo-600" />}
                <span>
                  <span className="block text-sm font-black text-slate-900">{p === 'android' ? 'Android' : 'Windows'}</span>
                  <span className="block text-[11px] text-slate-500 font-medium">{p === 'android' ? '.apk file' : 'setup .exe (or .zip)'}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Version</span>
              <input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="1.1.0"
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Minimum version allowed <span className="text-slate-400 font-medium">(optional)</span></span>
              <input value={form.min_version} onChange={e => setForm({ ...form, min_version: e.target.value })} placeholder="e.g. 1.1.0 forces everyone to update"
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500" />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">{useLink ? 'Download link' : 'App file'}</span>
              <button type="button" onClick={() => setUseLink(!useLink)} className="text-[11px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-1">
                {useLink ? <><Upload className="w-3 h-3" /> Upload a file instead</> : <><Link2 className="w-3 h-3" /> Use a link instead</>}
              </button>
            </div>
            {useLink ? (
              <input value={form.external_url} onChange={e => setForm({ ...form, external_url: e.target.value })} placeholder="https://drive.google.com/…"
                className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500" />
            ) : (
              <label className="mt-1 flex items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 p-4 cursor-pointer">
                <Upload className="w-5 h-5 text-slate-400 shrink-0" />
                <span className="flex-1 min-w-0 text-sm font-semibold text-slate-600 truncate">
                  {file ? `${file.name} · ${formatBytes(file.size)}` : `Choose the ${accept} file`}
                </span>
                {file && <button type="button" onClick={ev => { ev.preventDefault(); setFile(null); if (fileRef.current) fileRef.current.value = ''; }}><X className="w-4 h-4 text-slate-400" /></button>}
                <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-bold text-slate-700">What&apos;s new <span className="text-slate-400 font-medium">(optional, shown to students and parents)</span></span>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500" />
          </label>

          {error && <p className="text-xs font-bold text-rose-600 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {error}</p>}
          <div className="flex items-center justify-end gap-3">
            {done && <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Published</span>}
            <button type="submit" disabled={progress !== null}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black disabled:opacity-60 inline-flex items-center gap-2">
              {progress !== null ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {progress}%</> : <><Upload className="w-4 h-4" /> Publish</>}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><p className="text-sm font-black text-slate-900">All releases</p></div>
        {loadError ? (
          <p className="p-5 text-sm text-rose-700 font-semibold">{loadError}</p>
        ) : !releases ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
        ) : releases.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400 font-medium">Nothing published yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {releases.map(r => (
              <li key={r.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {r.platform === 'android' ? <Smartphone className="w-5 h-5 text-emerald-600 shrink-0" /> : <Monitor className="w-5 h-5 text-indigo-600 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
                      {r.platform === 'android' ? 'Android' : 'Windows'} {r.version}
                      {r.is_current && <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Current</span>}
                      {r.min_version && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">min {r.min_version}</span>}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {r.file_name || r.external_url}{r.file_size ? ` · ${formatBytes(r.file_size)}` : ''} · {new Date(r.created_at).toLocaleDateString()}
                      {r.uploaded_by_name ? ` · ${r.uploaded_by_name}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.download_url && (
                    <a href={r.download_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Download"><Download className="w-4 h-4" /></a>
                  )}
                  {isAdmin && !r.is_current && (
                    <button onClick={() => makeCurrent(r)} disabled={busyId === r.id}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5" /> Make current
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={() => remove(r)} disabled={busyId === r.id} className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" title="Delete">
                      {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
