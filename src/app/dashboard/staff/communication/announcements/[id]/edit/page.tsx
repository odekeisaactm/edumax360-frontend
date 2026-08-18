'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { academicAPI } from '@/lib/api';
import type { AnnouncementTargetAudience, AnnouncementPriority } from '@/lib/types';
import {
  ArrowLeft, Megaphone, Check, AlertCircle, Loader2, X, ShieldAlert,
  CalendarDays, Users, Tag, Paperclip, UploadCloud, Info, FileText,
} from 'lucide-react';
import RichTextEditor, { stripHtml } from '@/components/communication/RichTextEditor';

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? (v as any[])[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
    if (typeof d === 'object' && !Array.isArray(d)) {
      const fields = Object.entries(d)
        .filter(([, v]) => Array.isArray(v) && (v as any[]).length)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${(v as any[])[0]}`)
        .join(' ');
      if (fields) return fields;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
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

const TARGET_LABELS: Record<AnnouncementTargetAudience, string> = {
  all: 'All Users',
  students: 'Students Only',
  parents: 'Parents Only',
  staff: 'Staff Only',
  specific_class: 'Specific Classes',
  specific_section: 'Specific Sections',
};

function getAuthorId(a: any): string | number | null {
  const raw = a?.created_by ?? a?.author ?? a?.posted_by ?? null;
  if (raw == null) return null;
  return typeof raw === 'object' ? (raw.id ?? null) : raw;
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" — trims the seconds/timezone
// off whatever ISO string the API returns.
function toLocalInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function EditAnnouncementPage() {
  const params = useParams();
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const id = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [canEdit, setCanEdit] = useState<boolean | null>(null); // null = not yet determined
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState<string | null>(null);
  const [removeAttachment, setRemoveAttachment] = useState(false);

  const [form, setForm] = useState({
    title: '',
    content: '',
    target_audience: 'all' as AnnouncementTargetAudience,
    specific_class_ids: [] as number[],
    specific_section_ids: [] as number[],
    priority: 'normal' as AnnouncementPriority,
    is_published: true,
    publish_date: '',
    expiry_date: '',
    attachment: null as File | null,
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts(prev => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  };
  const dismissToast = (tid: number) => setToasts(prev => prev.filter(t => t.id !== tid));

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    academicAPI.listClasses({ is_active: true })
      .then(res => setClasses(Array.isArray(res) ? res : (res as any).results || []))
      .catch(() => {});
    api.get('/api/school/sections/')
      .then(res => setSections(res.data?.results || res.data || []))
      .catch(() => {});
  }, []);

  const loadAnnouncement = useCallback(async () => {
    setIsLoading(true); setLoadError(null);
    try {
      const res = await api.get(`/api/communication/announcements/${id}/`);
      const a = res.data;

      const authorId = getAuthorId(a);
      const isOwner = !!(user?.id && authorId != null && String(user.id) === String(authorId));
      const allowed = !!user && (user.is_superuser || hasPermission('communication.change_announcementmodel') || isOwner);
      setCanEdit(allowed);
      if (!allowed) { setIsLoading(false); return; }

      setForm({
        title: a.title || '',
        content: a.content || '',
        target_audience: a.target_audience || 'all',
        specific_class_ids: a.specific_class_ids || (a.specific_classes || []).map((c: any) => c.id) || [],
        specific_section_ids: a.specific_section_ids || (a.specific_sections || []).map((s: any) => s.id) || [],
        priority: a.priority || 'normal',
        is_published: !!a.is_published,
        publish_date: toLocalInputValue(a.publish_date),
        expiry_date: toLocalInputValue(a.expiry_date),
        attachment: null,
      });
      setExistingAttachmentUrl(a.attachment || null);
    } catch (err) {
      setLoadError(extractError(err));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  useEffect(() => { if (id && user) loadAnnouncement(); }, [id, user, loadAnnouncement]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'File size exceeds 5MB limit.');
        return;
      }
      set('attachment', file);
      setRemoveAttachment(false);
    }
  };

  const toggleArrayItem = (key: 'specific_class_ids' | 'specific_section_ids', itemId: number) => {
    set(key, form[key].includes(itemId)
      ? form[key].filter(x => x !== itemId)
      : [...form[key], itemId]
    );
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return showToast('error', 'Please enter a title.');
    if (!stripHtml(form.content)) return showToast('error', 'Please enter the announcement content.');
    if (form.target_audience === 'specific_class' && form.specific_class_ids.length === 0) {
      return showToast('error', 'Please select at least one class.');
    }
    if (form.target_audience === 'specific_section' && form.specific_section_ids.length === 0) {
      return showToast('error', 'Please select at least one section.');
    }
    if (form.publish_date && form.expiry_date && new Date(form.publish_date) > new Date(form.expiry_date)) {
      return showToast('error', 'Publish date cannot be after expiry date.');
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      payload.append('title', form.title);
      payload.append('content', form.content);
      payload.append('target_audience', form.target_audience);
      payload.append('priority', form.priority);
      payload.append('is_published', form.is_published ? 'true' : 'false');

      if (form.publish_date) payload.append('publish_date', new Date(form.publish_date).toISOString());
      if (form.expiry_date) payload.append('expiry_date', new Date(form.expiry_date).toISOString());

      if (form.attachment) {
        payload.append('attachment', form.attachment);
      } else if (removeAttachment) {
        // NOTE: confirm this matches how your serializer clears a FileField —
        // some setups expect an empty string, others a dedicated flag.
        payload.append('attachment', '');
      }

      form.specific_class_ids.forEach(cid => payload.append('specific_class_ids', String(cid)));
      form.specific_section_ids.forEach(sid => payload.append('specific_section_ids', String(sid)));

      await api.patch(`/api/communication/announcements/${id}/`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('success', 'Announcement updated successfully.');
      setTimeout(() => router.push(`/dashboard/staff/communication/announcements/${id}`), 800);
    } catch (error) {
      showToast('error', extractError(error));
      setIsSaving(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none bg-white font-medium text-slate-800 transition-all";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading announcement...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-600 mb-4">{loadError}</p>
        <Link href="/dashboard/staff/communication/announcements" className="text-sm text-indigo-600 underline inline-flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Announcements
        </Link>
      </div>
    );
  }

  // Permission gate — rendered instead of the form for anyone who isn't the
  // author and doesn't have real manage permission.
  if (canEdit === false) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="font-bold text-slate-800 text-base mb-1">You can't edit this announcement</h3>
        <p className="text-sm text-slate-400 mb-5">Only the original author or a communication manager can make changes here.</p>
        <Link href={`/dashboard/staff/communication/announcements/${id}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 text-sm font-bold rounded-xl hover:bg-indigo-100 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Announcement
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/staff/communication/announcements/${id}`}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-indigo-600" />
              Edit Announcement
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Update the notice and its targeting.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left Column: Main Content ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">

            <div>
              <label className={labelCls}>Announcement Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. End of Term Holiday Notice"
                className={`${inputCls} text-base`}
                maxLength={200}
              />
            </div>

            <div>
              <label className={labelCls}>Detailed Content <span className="text-red-500">*</span></label>
              <RichTextEditor
                value={form.content}
                onChange={html => set('content', html)}
                placeholder="Type the full body of your announcement here..."
                minHeight="16rem"
              />
              <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Use the toolbar for headings, lists, and formatting.
              </p>
            </div>

            {/* Attachment */}
            <div className="pt-2 border-t border-slate-100">
              <label className={labelCls}>Attachment <span className="text-slate-400 font-normal lowercase">(Optional)</span></label>

              {existingAttachmentUrl && !form.attachment && !removeAttachment && (
                <div className="mt-2 flex items-center justify-between gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <a href={existingAttachmentUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-semibold text-indigo-700 hover:underline min-w-0">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Current attachment</span>
                  </a>
                  <button type="button" onClick={() => setRemoveAttachment(true)}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex-shrink-0">
                    Remove
                  </button>
                </div>
              )}

              {removeAttachment && !form.attachment && (
                <div className="mt-2 flex items-center justify-between gap-3 p-3 border border-red-100 rounded-xl bg-red-50">
                  <p className="text-xs font-semibold text-red-600">Attachment will be removed on save.</p>
                  <button type="button" onClick={() => setRemoveAttachment(false)} className="text-xs font-bold text-slate-500 hover:text-slate-700 flex-shrink-0">
                    Undo
                  </button>
                </div>
              )}

              <div className="mt-2 relative">
                <input
                  type="file"
                  onChange={handleFileChange}
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
                <label
                  htmlFor="file-upload"
                  className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                    form.attachment
                      ? 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {form.attachment ? (
                    <div className="flex flex-col items-center text-center p-4">
                      <Paperclip className="h-7 w-7 text-indigo-500 mb-2" />
                      <p className="text-sm font-bold text-indigo-700 truncate max-w-[250px]">{form.attachment.name}</p>
                      <p className="text-xs text-indigo-400 mt-1">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center p-3">
                      <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-2">
                        <UploadCloud className="h-4 w-4 text-slate-400" />
                      </div>
                      <p className="text-sm font-bold text-slate-600">
                        {existingAttachmentUrl ? 'Click to replace attachment' : 'Click to upload an attachment'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, or Images (Max 5MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right Column: Settings & Targeting ── */}
        <div className="space-y-6">

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Users className="h-4 w-4 text-indigo-500" /> Audience Targeting
            </h3>

            <div>
              <label className={labelCls}>Who should see this?</label>
              <select
                value={form.target_audience}
                onChange={e => {
                  set('target_audience', e.target.value as AnnouncementTargetAudience);
                  set('specific_class_ids', []);
                  set('specific_section_ids', []);
                }}
                className={inputCls}
              >
                {Object.entries(TARGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {form.target_audience === 'specific_class' && (
              <div className="space-y-2 pt-2">
                <label className={labelCls}>Select Classes <span className="text-red-500">*</span></label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 custom-scrollbar">
                  {classes.map(c => (
                    <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.specific_class_ids.includes(c.id)}
                        onChange={() => toggleArrayItem('specific_class_ids', c.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {form.target_audience === 'specific_section' && (
              <div className="space-y-2 pt-2">
                <label className={labelCls}>Select Sections <span className="text-red-500">*</span></label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 custom-scrollbar">
                  {sections.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.specific_section_ids.includes(s.id)}
                        onChange={() => toggleArrayItem('specific_section_ids', s.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm font-semibold text-slate-700">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
              <Tag className="h-4 w-4 text-indigo-500" /> Meta & Visibility
            </h3>

            <div>
              <label className={labelCls}>Priority Level</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value as AnnouncementPriority)} className={inputCls}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="pt-2">
              <label className={labelCls}>Visibility Status</label>
              <div className="flex gap-2">
                <button
                  onClick={() => set('is_published', true)}
                  className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl border transition-all ${form.is_published ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  Published
                </button>
                <button
                  onClick={() => set('is_published', false)}
                  className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl border transition-all ${!form.is_published ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  Draft
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><CalendarDays className="h-3 w-3"/> Display Timing <span className="lowercase font-normal text-slate-400">(Optional)</span></h5>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Publish On</label>
                <input type="datetime-local" value={form.publish_date} onChange={e => set('publish_date', e.target.value)} className={inputCls} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expire On (Auto-hide)</label>
                <input type="datetime-local" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <p className="hidden sm:block text-sm font-medium text-slate-500">
            {form.is_published ? 'Changes will be visible immediately.' : 'This announcement is saved as a draft.'}
          </p>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-8 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin"/> Saving</> : <><Check className="h-4 w-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}