'use client';

import React, { useState, useEffect } from 'react';
import { schoolInfoAPI } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import {
  Building2, Edit3, Upload, Globe, Phone, Mail,
  MapPin, X, Check, AlertCircle, Sparkles, Loader2,
  ExternalLink,
} from 'lucide-react';

// ─── Info row component ────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, iconBg, label, children }: {
  icon: any; iconBg: string; label: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${iconBg}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
        <div className="text-sm font-medium text-slate-800">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
function SchoolInfoModal({ schoolInfo, isSaving, onSave, onClose }: {
  schoolInfo: any; isSaving: boolean;
  onSave: (data: any) => Promise<void>; onClose: () => void;
}) {
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(fd.entries());
    try { await onSave(data); }
    catch (err: any) {
      const d = err?.response?.data;
      setSaveError(d?.detail || d?.message || err?.message || 'Failed to save. Please try again.');
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            {schoolInfo ? 'Edit School Information' : 'Create School Information'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error — outside scroll */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{saveError}</span>
          </div>
        )}

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <form id="school-info-form" onSubmit={handleSubmit} className="p-6 space-y-4">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  School Name <span className="text-red-400">*</span>
                </label>
                <input type="text" name="name" required defaultValue={schoolInfo?.name ?? ''}
                  className={inputCls} placeholder="e.g., Springfield Academy" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Short Name <span className="text-red-400">*</span>
                </label>
                <input type="text" name="short_name" required defaultValue={schoolInfo?.short_name ?? ''}
                  className={inputCls} placeholder="e.g., SGA" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">School Motto</label>
              <textarea name="motto" rows={2} defaultValue={schoolInfo?.motto ?? ''}
                className={`${inputCls} resize-none`} placeholder="e.g., Knowledge, Excellence, Integrity" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Email Address <span className="text-red-400">*</span>
              </label>
              <input type="email" name="email" required defaultValue={schoolInfo?.email ?? ''}
                className={inputCls} placeholder="school@example.com" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Primary Mobile <span className="text-red-400">*</span>
                </label>
                <input type="tel" name="mobile_1" required defaultValue={schoolInfo?.mobile_1 ?? ''}
                  className={inputCls} placeholder="+234 xxx xxx xxxx" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Secondary Mobile</label>
                <input type="tel" name="mobile_2" defaultValue={schoolInfo?.mobile_2 ?? ''}
                  className={inputCls} placeholder="+234 xxx xxx xxxx" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Website URL</label>
              <input type="url" name="website" defaultValue={schoolInfo?.website ?? ''}
                className={inputCls} placeholder="https://www.example.com" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                School Address <span className="text-red-400">*</span>
              </label>
              <textarea name="address" rows={3} required defaultValue={schoolInfo?.address ?? ''}
                className={`${inputCls} resize-none`} placeholder="Enter complete school address" />
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="school-info-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" />{schoolInfo ? 'Save Changes' : 'Create'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SchoolInfoPage() {
  const { hasPermission, user } = useAuth();
  const { authReady } = useRequireAuth();
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const canEdit = user?.is_superuser || hasPermission('school_configuration.change_schoolinfomodel');

  useEffect(() => {
    if (authReady && user) fetchSchoolInfo();
  }, [authReady, user]);

  const fetchSchoolInfo = async () => {
    setLoading(true);
    try {
      const data = await schoolInfoAPI.get();
      if (data === null) { setPageError('not_found'); setSchoolInfo(null); }
      else {
        setSchoolInfo(data);
        setPageError(null);
        if (data.logo) setLogoPreview(data.logo);
      }
    } catch { setPageError('fetch_error'); }
    finally { setLoading(false); }
  };

  const handleSave = async (data: any) => {
    setIsSaving(true);
    try {
      const updated = schoolInfo
        ? await schoolInfoAPI.update(data)
        : await schoolInfoAPI.create(data);
      setSchoolInfo(updated);
      setIsEditing(false);
      setPageError(null);
      toast();
    } catch (err) { throw err; }
    finally { setIsSaving(false); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) { setLogoError('File must be under 1MB'); return; }
    setLogoError(null);
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      const result = await schoolInfoAPI.uploadLogo(file);
      if (schoolInfo) {
        await schoolInfoAPI.update({ logo: result.url });
        setSchoolInfo((prev: any) => prev ? { ...prev, logo: result.url } : null);
      } else {
        setLogoPreview(result.url);
      }
      toast();
    } catch { setLogoError('Upload failed. Please try again.'); }
    finally { setUploadingLogo(false); }
  };

  const toast = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  if (!authReady || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading school information...</p>
      </div>
    </div>
  );

  if (pageError === 'fetch_error') return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load the school information.</p>
        <button onClick={fetchSchoolInfo} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          Try Again
        </button>
      </div>
    </div>
  );

  if (pageError === 'not_found' && !schoolInfo) return (
    <>
      {isEditing && <SchoolInfoModal schoolInfo={null} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <Building2 className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Welcome to Your School</h3>
            <p className="text-slate-400 text-sm">Set up your school's profile to get started.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200">
              <Sparkles className="h-5 w-5" /> Set Up School Information
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up school information.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const si = schoolInfo;

  return (
    <div className="space-y-5 pb-10">
      {/* Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Changes saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SchoolInfoModal schoolInfo={si} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            School Information
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage your school's profile and contact details</p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Edit3 className="h-4 w-4" /> Edit Information
          </button>
        )}
      </div>

      {/* ── Top row: Logo (compact) + Identity + Contact ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Logo — compact fixed-height, no longer than its siblings */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">School Logo</p>

          {/* Logo display — fixed square, compact */}
          <div className="w-full aspect-square max-h-40 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center overflow-hidden border border-slate-200 self-center">
            {logoPreview ? (
              <img src={logoPreview} alt="School Logo" className="w-full h-full object-contain p-3" />
            ) : (
              <div className="text-center p-4">
                <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-1" />
                <p className="text-xs text-slate-400">No logo</p>
              </div>
            )}
          </div>

          {/* Upload */}
          {canEdit && (
            <div>
              <input id="logo-upload" type="file" className="sr-only" accept="image/*"
                onChange={handleLogoUpload} disabled={uploadingLogo} />
              <label htmlFor="logo-upload"
                className={`flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer border
                  ${uploadingLogo
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                {uploadingLogo
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...</>
                  : <><Upload className="h-3.5 w-3.5" /> Upload Logo</>}
              </label>
              {logoError
                ? <p className="mt-1.5 text-xs text-red-500 text-center">{logoError}</p>
                : <p className="mt-1.5 text-xs text-slate-400 text-center">PNG, JPG up to 1MB</p>}
            </div>
          )}
        </div>

        {/* Identity card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Identity</p>

          {/* School name hero */}
          <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-500 font-medium mb-1">Full Name</p>
            <p className="text-lg font-bold text-slate-900 leading-snug">{si?.name ?? '—'}</p>
            {si?.short_name && (
              <span className="inline-block mt-1.5 text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                {si.short_name}
              </span>
            )}
          </div>

          {si?.motto && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Motto
              </p>
              <p className="text-sm italic text-slate-600">"{si.motto}"</p>
            </div>
          )}
        </div>

        {/* Contact card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contact</p>
          <div>
            <InfoRow icon={Mail} iconBg="bg-sky-50 text-sky-600" label="Email">
              <a href={`mailto:${si?.email}`} className="text-blue-600 hover:underline truncate block">
                {si?.email ?? '—'}
              </a>
            </InfoRow>
            <InfoRow icon={Phone} iconBg="bg-emerald-50 text-emerald-600" label="Primary Mobile">
              <a href={`tel:${si?.mobile_1}`} className="text-blue-600 hover:underline">
                {si?.mobile_1 ?? '—'}
              </a>
            </InfoRow>
            {si?.mobile_2 && (
              <InfoRow icon={Phone} iconBg="bg-teal-50 text-teal-600" label="Secondary Mobile">
                <a href={`tel:${si.mobile_2}`} className="text-blue-600 hover:underline">
                  {si.mobile_2}
                </a>
              </InfoRow>
            )}
            <InfoRow icon={Globe} iconBg="bg-violet-50 text-violet-600" label="Website">
              {si?.website
                ? <a href={si.website} target="_blank" rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 truncate max-w-full">
                    <span className="truncate">{si.website}</span>
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                : <span className="text-slate-400">Not set</span>}
            </InfoRow>
          </div>
        </div>
      </div>

      {/* ── Address full-width ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
            <MapPin className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</p>
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl p-4 border border-slate-100 leading-relaxed">
          {si?.address ?? <span className="text-slate-400">Not set</span>}
        </p>
      </div>
    </div>
  );
}