'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { bankDetailsAPI } from '@/lib/api';
import { SchoolBankDetailFormValues } from '@/lib/types';
import { SchoolBankDetail } from '@/lib/finance.types';
import {
  Building, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  CreditCard, Wallet, Users, Eye, EyeOff,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? v[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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
function ConfirmModal({ open, bank, isDeleting, onConfirm, onCancel }: {
  open: boolean; bank: SchoolBankDetail | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !bank) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Bank Account</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{bank.bank_name} - {bank.account_name}"</span>?
          This cannot be undone and will affect all linked income and expense records.
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

// ─── Bank Form Modal ──────────────────────────────────────────────────────────
interface BankOption {
  bank_name: string;
  code: string;
}

function BankModal({
  editing,
  isSaving,
  onSave,
  onClose,
  banks,
  loadingBanks,
}: {
  editing: SchoolBankDetail | null;
  isSaving: boolean;
  onSave: (data: SchoolBankDetailFormValues) => Promise<void>;
  onClose: () => void;
  banks: BankOption[];
  loadingBanks: boolean;
}) {
  const [form, setForm] = useState<SchoolBankDetailFormValues>(
    editing
      ? {
          bank_name: editing.bank_name,
          account_number: editing.account_number,
          account_name: editing.account_name,
          is_for_funding: editing.is_for_funding,
          is_for_fees: editing.is_for_fees,
          is_active: editing.is_active,
        }
      : {
          bank_name: '',
          account_number: '',
          account_name: '',
          is_for_funding: true,
          is_for_fees: true,
          is_active: true,
        }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof SchoolBankDetailFormValues>(key: K, value: SchoolBankDetailFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header - fixed */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Building className="h-4 w-4" />
            {editing ? 'Edit Bank Account' : 'New Bank Account'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error - fixed */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <form id="bank-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Bank Name <span className="text-red-400 normal-case">*</span></label>
              <select
                required
                value={form.bank_name}
                onChange={e => set('bank_name', e.target.value)}
                className={inputCls}
                disabled={loadingBanks}
              >
                <option value="">Select Bank</option>
                {banks.map(bank => (
                  <option key={bank.code} value={bank.bank_name}>{bank.bank_name}</option>
                ))}
              </select>
              {loadingBanks && <p className="text-xs text-slate-400 mt-1">Loading banks...</p>}
            </div>
            <div>
              <label className={labelCls}>Account Name <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.account_name} onChange={e => set('account_name', e.target.value)}
                placeholder="e.g. John Doe" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Account Number <span className="text-red-400 normal-case">*</span></label>
              <input
                required
                type="text"
                value={form.account_number}
                onChange={e => set('account_number', e.target.value)}
                placeholder="e.g. 0123456789"
                className={inputCls}
              />
            </div>

            {/* Flags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">For Wallet Funding</p>
                  <p className="text-xs text-slate-400">Can be used for funding</p>
                </div>
                <button type="button" role="switch" aria-checked={form.is_for_funding}
                  onClick={() => set('is_for_funding', !form.is_for_funding)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_for_funding ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_for_funding ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">For Fees</p>
                  <p className="text-xs text-slate-400">Can be used for fee payments</p>
                </div>
                <button type="button" role="switch" aria-checked={form.is_for_fees}
                  onClick={() => set('is_for_fees', !form.is_for_fees)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_for_fees ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_for_fees ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <div className="flex items-center justify-between w-full p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="text-sm font-medium text-slate-800">Active</p>
                  <p className="text-xs text-slate-400">Bank account is operational</p>
                </div>
                <button type="button" role="switch" aria-checked={form.is_active}
                  onClick={() => set('is_active', !form.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Footer - fixed */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="bank-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Bank' : 'Create Bank'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
interface BankOption {
  bank_name: string;
  code: string;
}

export default function BankAccountsPage() {
  const { hasPermission, user } = useAuth();

  const [banks, setBanks] = useState<BankOption[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<SchoolBankDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingBank, setEditingBank] = useState<SchoolBankDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingBank, setDeletingBank] = useState<SchoolBankDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('finance.add_expensemodel');
  const canEdit   = user?.is_superuser || hasPermission('finance.change_expensemodel');
  const canDelete = user?.is_superuser || hasPermission('finance.delete_expensemodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Load banks from external API ──
  useEffect(() => {
    (async () => {
      setLoadingBanks(true);
      try {
        const response = await fetch('https://app.nuban.com.ng/bank_codes.json');
        const data = await response.json();
        setBanks(data);
      } catch {
        // Silent fail — user can still type bank name manually
      } finally {
        setLoadingBanks(false);
      }
    })();
  }, []);

  const fetchBankAccounts = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await bankDetailsAPI.list();
      setBankAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBankAccounts(); }, [fetchBankAccounts]);

  const openCreate = () => { setEditingBank(null); setShowModal(true); };
  const openEdit = (bank: SchoolBankDetail) => { setEditingBank(bank); setShowModal(true); };

  const handleSave = async (form: SchoolBankDetailFormValues) => {
    setIsSaving(true);
    try {
      if (editingBank) {
        const updated = await bankDetailsAPI.update(editingBank.id, form);
        setBankAccounts(prev => prev.map(b => b.id === updated.id ? updated : b));
        showToast('success', `"${updated.bank_name} - ${updated.account_name}" updated successfully`);
      } else {
        const created = await bankDetailsAPI.create(form);
        setBankAccounts(prev => [created, ...prev]);
        showToast('success', `"${created.bank_name} - ${created.account_name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingBank) return;
    setIsDeleting(true);
    try {
      await bankDetailsAPI.delete(deletingBank.id);
      setBankAccounts(prev => prev.filter(b => b.id !== deletingBank.id));
      showToast('success', `"${deletingBank.bank_name} - ${deletingBank.account_name}" deleted`);
      setDeletingBank(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingBank(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = bankAccounts.filter(b => {
    const matchSearch = b.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        b.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        b.account_number.includes(searchTerm);
    const matchActive = !showActiveOnly || b.is_active;
    return matchSearch && matchActive;
  });

  const totalActive = bankAccounts.filter(b => b.is_active).length;
  const totalFunding = bankAccounts.filter(b => b.is_for_funding).length;
  const totalFees = bankAccounts.filter(b => b.is_for_fees).length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingBank} bank={deletingBank} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingBank(null)}
      />

      {showModal && (
        <BankModal
          editing={editingBank}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          banks={banks}
          loadingBanks={loadingBanks}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Building className="h-5 w-5 text-white" />
            </div>
            Bank Accounts
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage school bank accounts for income, expenses, and funding</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
            <Plus className="h-4 w-4" /> Add Bank Account
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Accounts', value: bankAccounts.length, icon: Building, color: 'from-emerald-500 to-emerald-600' },
          { label: 'Active', value: totalActive, icon: Check, color: 'from-green-500 to-teal-600' },
          { label: 'For Funding', value: totalFunding, icon: Wallet, color: 'from-blue-500 to-indigo-600' },
          { label: 'For Fees', value: totalFees, icon: CreditCard, color: 'from-purple-500 to-violet-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search by bank name, account name, or number..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={showActiveOnly}
                onClick={() => setShowActiveOnly(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-600">Active only</span>
            </label>
            <button onClick={fetchBankAccounts} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400">Loading bank accounts...</p>
        </div>
      ) : pageError ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">{pageError}</p>
          <button onClick={fetchBankAccounts} className="mt-3 text-sm text-red-600 underline">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building className="h-8 w-8 text-emerald-300" />
          </div>
          <h3 className="font-semibold text-slate-700 mb-1">
            {searchTerm ? 'No accounts match your search' : 'No bank accounts yet'}
          </h3>
          <p className="text-sm text-slate-400 mb-5">
            {searchTerm ? 'Try different keywords.' : 'Add your first bank account to get started.'}
          </p>
          {!searchTerm && canCreate && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
              <Plus className="h-4 w-4" /> Add Bank Account
            </button>
          )}
        </div>
      ) : (
        /* ── 2-Column Grid ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(bank => (
            <div key={bank.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
              <div className={`h-1 w-full bg-gradient-to-r ${bank.is_active ? 'from-emerald-500 to-teal-500' : 'from-slate-300 to-slate-400'}`} />
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bank.is_active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                      <Building className={`h-5 w-5 ${bank.is_active ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{bank.bank_name}</h3>
                      <p className="text-xs text-slate-500 truncate">{bank.account_name}</p>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${bank.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {bank.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Account Number */}
                <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-0.5">Account Number</p>
                  <p className="font-mono font-bold text-slate-800 text-lg tracking-wider">
                    {bank.account_number}
                  </p>
                </div>

                {/* Flags */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bank.is_for_funding ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    {bank.is_for_funding ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Funding
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bank.is_for_fees ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-400'}`}>
                    {bank.is_for_fees ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Fees
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-400">
                    Updated: {new Date(bank.updated_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-1">
                    {canEdit && (
                      <button onClick={() => openEdit(bank)} title="Edit"
                        className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingBank(bank)} title="Delete"
                        className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer count ── */}
      {!loading && !pageError && filtered.length > 0 && (
        <div className="px-5 py-3 bg-white rounded-2xl border border-slate-100">
          <p className="text-xs text-slate-400">
            Showing {filtered.length} of {bankAccounts.length} bank account{bankAccounts.length !== 1 ? 's' : ''}
            {showActiveOnly ? ' (active only)' : ''}
          </p>
        </div>
      )}
    </div>
  );
}