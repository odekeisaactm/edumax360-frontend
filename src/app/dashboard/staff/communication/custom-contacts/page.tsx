'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {contactsAPI} from '@/lib/communication.service';
import {CustomContact} from '@/lib/communication.types';
import {
  Users, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Mail, Smartphone, MessageSquare, ChevronLeft, ChevronRight, Info
} from 'lucide-react';

// ─── Types & API ───────────────────────────────────────────────────────────────



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
  }
  return err?.message || 'An unexpected error occurred.';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ─── Shared UI Components ──────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-[fadeIn_0.2s_ease-out]
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

function ConfirmModal({ open, contact, isDeleting, onConfirm, onCancel }: {
  open: boolean; contact: CustomContact | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !contact) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Contact</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to permanently delete{' '}
          <span className="font-semibold text-slate-700">"{toTitleCase(contact.full_name)}"</span>?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-red-200">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Centered Edit Modal ───────────────────────────────────────────────────────

function ContactModal({
  editing, isSaving, onSave, onClose, showToast
}: {
  editing: CustomContact | null; isSaving: boolean;
  onSave: (data: Partial<CustomContact>) => Promise<void>; onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState<Partial<CustomContact>>(
    editing ? { ...editing } : { full_name: '', phone: '', email: '', whatsapp_number: '', tag: '', is_active: true }
  );

  const set = <K extends keyof CustomContact>(key: K, value: CustomContact[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name?.trim()) {
      showToast('error', 'Contact name is required.');
      return;
    }

    // Strict Validation: Letters in phone numbers
    const phoneRegex = /^[\d\s\+\-\(\)]*$/;
    if (form.phone && !phoneRegex.test(form.phone)) {
      showToast('error', 'Phone number can only contain numbers, spaces, and formatting characters like + - ( )');
      return;
    }
    if (form.whatsapp_number && !phoneRegex.test(form.whatsapp_number)) {
      showToast('error', 'WhatsApp number can only contain numbers, spaces, and formatting characters like + - ( )');
      return;
    }

    // Strict Validation: Must have at least one contact method
    const hasEmail = !!form.email?.trim();
    const hasPhone = !!form.phone?.trim();
    const hasWA = !!form.whatsapp_number?.trim();

    if (!hasEmail && !hasPhone && !hasWA) {
      showToast('error', 'You must provide at least an Email, Phone Number, or WhatsApp Number.');
      return;
    }

    try {
      await onSave(form);
    } catch (err) { showToast('error', extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none bg-white font-medium text-slate-800 transition-shadow";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-lg flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </span>
            {editing ? 'Edit Custom Contact' : 'Add Custom Contact'}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form id="contact-form" onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(100vh-12rem)]">
          <div>
            <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
            <input required type="text" value={form.full_name || ''} onChange={e => set('full_name', e.target.value)}
              placeholder="e.g. Adebayo Logistics" className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone Number (SMS)</label>
              <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)}
                placeholder="e.g. +2348012345678" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp Number</label>
              <input type="tel" value={form.whatsapp_number || ''} onChange={e => set('whatsapp_number', e.target.value)}
                placeholder="e.g. +2348012345678" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Email Address</label>
            <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)}
              placeholder="e.g. contact@domain.com" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Contact Tag / Group</label>
            <input type="text" value={form.tag || ''} onChange={e => set('tag', e.target.value)}
              placeholder="e.g. Vendor, Alumni, PTA" className={inputCls} />
            <p className="text-[10px] text-slate-400 mt-1.5 flex items-start gap-1">
              <Info className="h-3 w-3 flex-shrink-0 mt-0.5" /> Use tags to organize and group contacts together for targeted broadcast campaigns.
            </p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              You must provide at least one method of communication (Email, Phone, or WhatsApp) to save this contact.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50/70 rounded-xl border border-slate-100">
            <div>
              <p className="text-sm font-semibold text-slate-800">Account Status</p>
              <p className="text-xs text-slate-400">Can this contact receive bulk messages?</p>
            </div>
            <button type="button" role="switch" aria-checked={form.is_active}
              onClick={() => set('is_active', !form.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-emerald-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-white hover:border-slate-300 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="contact-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:from-blue-700 hover:to-indigo-700 shadow-blue-200">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Save Contact</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Constants & Meta ──────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function CustomContactsPage() {
  const { hasPermission, user } = useAuth();

  const [contacts, setContacts] = useState<CustomContact[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomContact | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingContact, setDeletingContact] = useState<CustomContact | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  type MethodFilter = 'all' | 'phone' | 'email' | 'both';
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canManage = user?.is_superuser || hasPermission('communication.manage_communication_settings');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchContacts = useCallback(async (pg = 1) => {
    setLoading(true); setPageError(null);
    try {
      const params: Record<string, any> = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (tagFilter) params.tag = tagFilter;
      if (methodFilter !== 'all') params.method = methodFilter; // Passes to the new backend query

      const data = await contactsAPI.list(params) as any;
      const results = data?.results ?? data?.data ?? data ?? [];

      setContacts(Array.isArray(results) ? results : []);
      setTotal(data?.count ?? results.length);
      setPage(pg);

      // Extract unique tags for dropdown if loading page 1 without search filters
      if (pg === 1 && !search && !tagFilter && methodFilter === 'all') {
        const uniqueTags = Array.from(new Set(results.map((c: CustomContact) => c.tag).filter(Boolean))) as string[];
        setTags(uniqueTags);
      }
    } catch (err: any) {
      // 404 Rescue: If the page exceeds total pages due to filter changes, jump back to page 1
      if (err?.response?.status === 404 && pg > 1) {
        fetchContacts(1);
      } else {
        setPageError(extractError(err));
      }
    } finally { setLoading(false); }
  }, [search, tagFilter, methodFilter]);

  // Handle Debounce for Search and immediate fetch for Filters
  useEffect(() => { fetchContacts(1); }, [tagFilter, methodFilter]);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchContacts(1), 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]);

  const handleDelete = async () => {
    if (!deletingContact) return;
    setIsDeleting(true);
    try {
      await contactsAPI.delete(deletingContact.id);
      setContacts(prev => prev.filter(c => c.id !== deletingContact.id));
      setTotal(prev => prev - 1);
      showToast('success', `"${toTitleCase(deletingContact.full_name)}" removed successfully.`);
      setDeletingContact(null);

      // Attempt to refetch if we just deleted the last item on a page
      if (contacts.length === 1 && page > 1) {
        fetchContacts(page - 1);
      }
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingContact(null);
    } finally { setIsDeleting(false); }
  };

  const handleSave = async (form: Partial<CustomContact>) => {
    setIsSaving(true);
    try {
      if (editingContact) {
        const updated = await contactsAPI.update(editingContact.id, form);
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        showToast('success', `Contact updated successfully.`);
      } else {
        await contactsAPI.create(form);
        showToast('success', `Contact added successfully.`);
        // Reload page 1 to fetch the new data and updated counts
        fetchContacts(1);
      }
      setShowModal(false);
    } catch (err) {
      throw err; // Passed down to modal to show error toast
    } finally { setIsSaving(false); }
  };

  const openCreate = () => { setEditingContact(null); setShowModal(true); };
  const openEdit = (contact: CustomContact) => { setEditingContact(contact); setShowModal(true); };

  const clearFilters = () => { setTagFilter(''); setSearch(''); setMethodFilter('all'); };
  const hasFilters = !!(search || tagFilter || methodFilter !== 'all');
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingContact} contact={deletingContact} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingContact(null)}
      />

      {showModal && (
        <ContactModal editing={editingContact} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} showToast={showToast} />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Users className="h-5 w-5 text-white" />
            </div>
            Custom Contacts
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage external contacts for bulk campaigns</p>
        </div>
        {canManage && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Contact
          </button>
        )}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── Toolbar ── */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">

          <div className="flex items-center gap-3 w-full xl:w-auto flex-wrap">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" placeholder="Search contacts or tags..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Tag Dropdown */}
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
              className={`px-3 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${tagFilter ? 'border-blue-400 text-blue-700 bg-blue-50' : 'border-slate-200 text-slate-600 bg-white'}`}>
              <option value="">All Tags</option>
              {tags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {hasFilters && (
              <button onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-colors">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Segmented Control for Method Filter */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
            {[
              { id: 'all', label: 'All Contacts' },
              { id: 'phone', label: 'Has Phone' },
              { id: 'email', label: 'Has Email' },
              { id: 'both', label: 'Has Both' },
            ].map(f => (
              <button key={f.id} onClick={() => setMethodFilter(f.id as MethodFilter)}
                className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  methodFilter === f.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}>
                {f.label}
              </button>
            ))}
            <button onClick={() => fetchContacts(page)} title="Refresh" className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

        </div>

        {/* ── Body States ── */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading contacts...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchContacts(1)} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {hasFilters ? 'No contacts match your filters' : 'No custom contacts yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">
              {hasFilters ? 'Try adjusting your search or filters.' : 'Add vendors, alumni, or partners to include them in bulk communication campaigns.'}
            </p>
            {!hasFilters && canManage && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add First Contact
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[3rem_2fr_2fr_100px_90px] items-center gap-4 px-6 py-3 bg-slate-50/60 border-b border-slate-100 min-w-[700px] overflow-x-auto">
              <span className="w-10" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact Name</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Communication Methods</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50 overflow-x-auto">
              {contacts.map(c => {
                const fullName = toTitleCase(c.full_name);
                const initials = getInitials(c.full_name);

                return (
                  <div key={c.id} className="grid grid-cols-[3rem_2fr_2fr_100px_90px] items-center gap-4 px-6 py-3.5 hover:bg-slate-50/50 transition-colors min-w-[700px]">

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0 border border-indigo-50">
                      <span className="text-sm font-bold text-indigo-700">{initials}</span>
                    </div>

                    {/* Name (with Tag tooltip) */}
                    <div className="min-w-0 pr-4" title={c.tag ? `Tag: ${c.tag}` : 'No Tag'}>
                      <p className={`font-bold text-slate-900 text-sm truncate ${c.tag ? 'cursor-help underline decoration-slate-300 decoration-dashed underline-offset-4' : ''}`}>
                        {fullName}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">Added {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>

                    {/* Contact Methods */}
                    <div className="flex flex-col gap-1.5 min-w-0 pr-4">
                      {c.email ? (
                        <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /> <span className="truncate">{c.email}</span>
                        </div>
                      ) : null}
                      {c.phone || c.whatsapp_number ? (
                        <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
                          <Smartphone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            {c.phone} {c.phone && c.whatsapp_number ? ' / ' : ''} {c.whatsapp_number && <span className="text-emerald-600 inline-flex items-center gap-1"><MessageSquare className="h-3 w-3"/>{c.whatsapp_number}</span>}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Status */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border w-max ${c.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {canManage && (
                        <button onClick={() => openEdit(c)} title="Edit"
                          className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => setDeletingContact(c)} title="Delete"
                          className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer + Pagination */}
            <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                <span className="font-semibold text-slate-600">{total}</span> contacts
                {hasFilters && <span className="ml-1 text-blue-500 font-medium">(filtered)</span>}
              </p>

              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => fetchContacts(page - 1)} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pg = totalPages <= 5 ? i + 1
                      : page <= 3 ? i + 1
                      : page >= totalPages - 2 ? totalPages - 4 + i
                      : page - 2 + i;
                    return (
                      <button key={pg} onClick={() => fetchContacts(pg)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          pg === page
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {pg}
                      </button>
                    );
                  })}
                  <button onClick={() => fetchContacts(page + 1)} disabled={page === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}