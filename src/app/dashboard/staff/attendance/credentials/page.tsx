'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { deviceCredentialsAPI } from '@/lib/service/attendance';
import type { DeviceCredential, DeviceType, ParticipantType } from '@/lib/types/attendance';
import {
  Fingerprint, Barcode, ScanLine, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw, Info, Sparkles, Filter, Users, ChevronLeft, ChevronRight
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d.slice(0, 150);
    if (d.detail) return String(d.detail).slice(0, 150);
    if (d.message) return String(d.message).slice(0, 150);
  }
  return err?.message || 'An unexpected error occurred.';
}

const DEVICE_TYPE_META: Record<DeviceType, { label: string; icon: any; color: string; bg: string; border: string; biometric: boolean }> = {
  ZKTECO:          { label: 'ZKTeco',          icon: Fingerprint, color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100',    biometric: true },
  DIGITAL_PERSONA: { label: 'DigitalPersona',  icon: Fingerprint, color: 'text-violet-700',  bg: 'bg-violet-50',  border: 'border-violet-100',  biometric: true },
  BARCODE_SCANNER: { label: 'Barcode Scanner', icon: Barcode,     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', biometric: false },
  OTHER:           { label: 'Other',           icon: ScanLine,    color: 'text-slate-700',   bg: 'bg-slate-100',  border: 'border-slate-200',   biometric: false },
};

const PARTICIPANT_LABELS: Record<ParticipantType, string> = {
  STUDENT: 'Student', STAFF: 'Staff', PARENT: 'Parent', VISITOR: 'Visitor',
};

// Handle optional enhanced serializer fields safely
function whoFor(c: any): string {
  return c.student_name || c.staff_name || c.parent_name || c.known_visitor_name || '—';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, credential, isDeleting, onConfirm, onCancel }: {
  open: boolean; credential: any | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !credential) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Credential</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Remove the credential for <span className="font-semibold text-slate-700">"{whoFor(credential)}"</span>?
          They will no longer be recognized by PIN <span className="font-mono">{credential.device_pin}</span>.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Generate Modal ───────────────────────────────────────────────────────
function BulkGenerateModal({ open, isGenerating, onConfirm, onClose }: {
  open: boolean; isGenerating: boolean; onConfirm: () => void; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Generate Barcode Credentials</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Creates a barcode credential for every active student who doesn't already have one, using their
          registration number as the PIN. Existing credentials are left untouched — safe to run more than once.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={isGenerating}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isGenerating}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Modal (non-biometric credentials only) ──────────────────────────────
function EditCredentialModal({ editing, isSaving, onSave, onClose }: {
  editing: any; isSaving: boolean;
  onSave: (data: Partial<DeviceCredential>) => Promise<void>; onClose: () => void;
}) {
  const [pin, setPin] = useState(editing.device_pin);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) { setError('PIN is required.'); return; }
    try {
      await onSave({ device_pin: pin.trim() });
    } catch (err) {
      setError(extractError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Barcode className="h-5 w-5" /> Edit Credential
          </h3>
          <button onClick={onClose} disabled={isSaving} className="text-white/80 hover:text-white p-1 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Barcode PIN</label>
            <input type="text" value={pin} onChange={e => setPin(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
            <p className="text-[11px] text-slate-400 mt-1.5">For {whoFor(editing)} — should match what's printed/encoded on their ID card.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={isSaving}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSaving}
              className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center gap-2">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendanceCredentialsPage() {
  const { hasPermission, user } = useAuth();

  const [credentials, setCredentials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Pagination & Filter State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [deviceFilter, setDeviceFilter] = useState<DeviceType | 'all'>('all');
  const [participantFilter, setParticipantFilter] = useState<ParticipantType | 'all'>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals
  const [editingCredential, setEditingCredential] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingCredential, setDeletingCredential] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canManage = user?.is_superuser || hasPermission('attendance.change_devicecredentialmodel');
  const PAGE_SIZE = 50;

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Data
  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = { page, page_size: PAGE_SIZE };
      if (deviceFilter !== 'all') params.device_type = deviceFilter;
      if (participantFilter !== 'all') params.participant_type = participantFilter;
      if (showActiveOnly) params.is_active = true;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await deviceCredentialsAPI.list(params);

      setCredentials(res.results || []);
      setTotalCount(res.count || 0);
      setTotalPages(Math.ceil((res.count || 0) / PAGE_SIZE));
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [page, deviceFilter, participantFilter, showActiveOnly, debouncedSearch]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

  // Reset page when filters change
  const handleFilterChange = (setter: Function, value: any) => {
    setter(value);
    setPage(1);
  };

  const handleToggleActive = async (credential: any) => {
    setTogglingId(credential.id);
    try {
      const updated = await deviceCredentialsAPI.update(credential.id, { is_active: !credential.is_active });
      setCredentials(prev => prev.map(c => c.id === updated.id ? updated : c));
      showToast('success', `${whoFor(updated)} ${updated.is_active ? 'reactivated' : 'revoked'}.`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaveEdit = async (data: Partial<DeviceCredential>) => {
    if (!editingCredential) return;
    setIsSaving(true);
    try {
      const updated = await deviceCredentialsAPI.update(editingCredential.id, data);
      setCredentials(prev => prev.map(c => c.id === updated.id ? updated : c));
      showToast('success', `Credential updated for ${whoFor(updated)}.`);
      setEditingCredential(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCredential) return;
    setIsDeleting(true);
    try {
      await deviceCredentialsAPI.delete(deletingCredential.id);
      setCredentials(prev => prev.filter(c => c.id !== deletingCredential.id));
      setTotalCount(prev => prev - 1);
      showToast('success', `Credential for ${whoFor(deletingCredential)} removed.`);
      setDeletingCredential(null);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await deviceCredentialsAPI.bulkGenerateBarcode();
      showToast('success', `Generated ${result.created} new barcode credential(s). ${result.skipped_existing} already had one.`);
      setShowBulkModal(false);
      setPage(1);
      fetchCredentials();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDeleteModal open={!!deletingCredential} credential={deletingCredential} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingCredential(null)} />

      <BulkGenerateModal open={showBulkModal} isGenerating={isGenerating}
        onConfirm={handleBulkGenerate} onClose={() => setShowBulkModal(false)} />

      {editingCredential && (
        <EditCredentialModal editing={editingCredential} isSaving={isSaving}
          onSave={handleSaveEdit} onClose={() => setEditingCredential(null)} />
      )}

      {pageError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {pageError}
          </div>
          <button onClick={fetchCredentials} className="text-sm text-red-700 underline flex items-center gap-1 flex-shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Fingerprint className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Device Credentials</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Manage PIN enrollments and sync status</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setShowBulkModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all hover:shadow-lg">
            <Sparkles className="h-4 w-4" /> Generate Barcodes
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-snug">
          Fingerprint credentials (ZKTeco, DigitalPersona) are created automatically once a captured print
          syncs successfully to a device — they can be revoked here but not hand-edited. Barcode credentials
          can be fully edited manually.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col md:flex-row items-center gap-4">

        {/* Search */}
        <div className="relative flex-1 w-full md:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by PIN (or Reg. Number)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-shadow" />
        </div>

        {/* Dropdowns */}
        <div className="flex-1 flex flex-wrap items-center gap-3 w-full">
          <div className="relative flex-1 min-w-[140px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <select
              value={deviceFilter}
              onChange={(e) => handleFilterChange(setDeviceFilter, e.target.value as any)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none cursor-pointer"
            >
              <option value="all">All Device Types</option>
              {Object.entries(DEVICE_TYPE_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>

          <div className="relative flex-1 min-w-[140px]">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Users className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <select
              value={participantFilter}
              onChange={(e) => handleFilterChange(setParticipantFilter, e.target.value as any)}
              className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium appearance-none cursor-pointer"
            >
              <option value="all">All Participants</option>
              {Object.entries(PARTICIPANT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggles & Actions */}
        <div className="flex items-center gap-4 flex-shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={showActiveOnly} onClick={() => handleFilterChange(setShowActiveOnly, !showActiveOnly)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm font-semibold text-slate-700">Active Only</span>
          </label>
          <button onClick={fetchCredentials} className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {loading && credentials.length === 0 ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400 font-medium">Loading credentials...</p>
          </div>
        ) : credentials.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-slate-800 text-base mb-1">No matching credentials found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Person</th>
                  {participantFilter === 'all' && (
                    <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Role</th>
                  )}
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Hardware Type</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Enrolled PIN</th>
                  <th className="text-left px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map(credential => {
                  const meta = DEVICE_TYPE_META[credential.device_type] || DEVICE_TYPE_META.OTHER;
                  const editable = !meta.biometric;
                  const isStudent = credential.participant_type === 'STUDENT';

                  return (
                    <tr key={credential.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-bold text-slate-800">{whoFor(credential)}</p>
                        {isStudent && (credential.student_registration_number || credential.student_class) && (
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                            {credential.student_registration_number && (
                              <span className="font-mono text-[11px]">{credential.student_registration_number}</span>
                            )}
                            {credential.student_registration_number && credential.student_class && (
                              <span>•</span>
                            )}
                            {credential.student_class && (
                              <span>{credential.student_class}</span>
                            )}
                          </div>
                        )}
                      </td>
                      {participantFilter === 'all' && (
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                            {PARTICIPANT_LABELS[credential.participant_type]}
                          </span>
                        </td>
                      )}
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${meta.bg} ${meta.color} border ${meta.border}`}>
                          <meta.icon className="h-3.5 w-3.5" /> {meta.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-700 font-semibold">{credential.device_pin}</td>
                      <td className="px-5 py-3">
                        {canManage ? (
                          <button
                            role="switch" aria-checked={credential.is_active}
                            onClick={() => handleToggleActive(credential)}
                            disabled={togglingId === credential.id}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${credential.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${credential.is_active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${credential.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {credential.is_active ? 'Active' : 'Revoked'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && editable && (
                            <>
                              <button onClick={() => setEditingCredential(credential)} title="Edit Credential"
                                className="p-1.5 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all">
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeletingCredential(credential)} title="Delete Credential"
                                className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {!editable && (
                            <span className="text-[10px] text-slate-400 italic pr-1 font-medium bg-slate-50 px-2 py-1 rounded">Auto-synced</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination Controls */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50 mt-auto">
          <p className="text-xs font-medium text-slate-500">
            Showing <span className="font-bold text-slate-700">{credentials.length}</span> of <span className="font-bold text-slate-700">{totalCount}</span> results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-slate-600 px-2">
              Page {page} of {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0 || loading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}