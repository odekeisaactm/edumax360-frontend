'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { feeAPI } from '@/lib/api';
import { Discount, Fee, FeeOccurrence, DiscountApplication } from '@/lib/types';
import {
  Tag, Plus, Edit2, Trash2, Check, X, AlertCircle,
  Loader2, Search, ChevronDown, ChevronUp, Percent, Hash,
} from 'lucide-react';

const fmt = (v: string | number = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};

// ─── Discount Form ────────────────────────────────────────────────────────────

interface DiscountFormProps {
  initial?: Partial<Discount>;
  fees: Fee[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  title: string;
}

function DiscountForm({ initial, fees, onSave, onCancel, title }: DiscountFormProps) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    discount_type: initial?.discount_type || 'percentage',
    occurrence: initial?.occurrence || 'periodic',
    applicable_fees: initial?.applicable_fees || [] as number[],
    description: initial?.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFee = (id: number) =>
    setForm(f => ({ ...f, applicable_fees: f.applicable_fees.includes(id) ? f.applicable_fees.filter(x => x !== id) : [...f.applicable_fees, id] }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError(null);
    try { await onSave(form); }
    catch (e: any) { setError(e.response?.data?.message || 'Save failed'); setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
          <Tag className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Title *</label>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Sibling Discount, Staff Discount"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Discount Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['percentage', 'fixed'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, discount_type: t }))}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-all capitalize flex items-center justify-center gap-1.5 ${
                    form.discount_type === t ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200 hover:border-pink-300'
                  }`}>
                  {t === 'percentage' ? <Percent className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Occurrence</label>
            <select value={form.occurrence} onChange={e => setForm(f => ({ ...f, occurrence: e.target.value as FeeOccurrence }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500">
              <option value="periodic">Periodic</option>
              <option value="annually">Annually</option>
              <option value="one_time">One-Time</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-2">Applicable Fees</label>
          <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 max-h-40 overflow-y-auto">
            {fees.map(f => (
              <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.applicable_fees.includes(f.id)} onChange={() => toggleFee(f.id)}
                  className="rounded text-pink-600 focus:ring-pink-500" />
                <span className="text-xs text-gray-700">{f.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">{form.applicable_fees.length} fee{form.applicable_fees.length !== 1 ? 's' : ''} selected (empty = all fees)</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500" />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onCancel} disabled={saving}
          className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save Discount
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiscountsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'create' | { mode: 'edit'; discount: Discount }>('list');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, f] = await Promise.all([feeAPI.getDiscounts(), feeAPI.getFees()]);
      setDiscounts(d); setFees(f);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const handleCreate = async (data: any) => {
    const created = await feeAPI.createDiscount(data);
    setDiscounts(prev => [created, ...prev]);
    setView('list');
    showSuccess('Discount created');
  };

  const handleUpdate = async (data: any) => {
    if (typeof view !== 'object') return;
    const updated = await feeAPI.updateDiscount(view.discount.id, data);
    setDiscounts(prev => prev.map(d => d.id === view.discount.id ? updated : d));
    setView('list');
    showSuccess('Discount updated');
  };

  const filtered = discounts.filter(d =>
    !search || d.title.toLowerCase().includes(search.toLowerCase())
  );

  if (view === 'create') return <div className="pb-8"><DiscountForm title="Create Discount" fees={fees} onSave={handleCreate} onCancel={() => setView('list')} /></div>;
  if (typeof view === 'object') return <div className="pb-8"><DiscountForm title="Edit Discount" initial={view.discount} fees={fees} onSave={handleUpdate} onCancel={() => setView('list')} /></div>;

  return (
    <div className="space-y-5 pb-8">
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg">
          <Check className="h-4 w-4 text-green-600" /><p className="text-sm font-medium text-green-800">{successMsg}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-lg">
            <Tag className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discounts</h1>
            <p className="text-sm text-gray-400">{discounts.length} discount scheme{discounts.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setView('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 shadow-sm">
            <Plus className="h-4 w-4" /> New Discount
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search discounts..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-pink-500 shadow-sm" />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border p-12 text-center"><Loader2 className="h-10 w-10 text-pink-500 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
          <Tag className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-600 mb-1">No discounts yet</p>
          {canManage && (
            <button onClick={() => setView('create')}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white text-sm font-semibold rounded-lg">
              <Plus className="h-4 w-4" /> Create first discount
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => {
            const applicableFeeNames = d.applicable_fees?.map(fid => fees.find(f => f.id === fid)?.name).filter(Boolean);
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:border-pink-200 transition-colors">
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-pink-50 flex items-center justify-center flex-shrink-0">
                    {d.discount_type === 'percentage' ? <Percent className="h-5 w-5 text-pink-600" /> : <Hash className="h-5 w-5 text-pink-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{d.title}</span>
                      <span className="px-2 py-0.5 bg-pink-50 text-pink-700 rounded-full text-xs font-medium capitalize">{d.discount_type}</span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs capitalize">{d.occurrence}</span>
                      {d.is_protected && <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-xs">Protected</span>}
                    </div>
                    {applicableFeeNames?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">Applies to: {applicableFeeNames.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canManage && !d.is_protected && (
                      <button onClick={() => setView({ mode: 'edit', discount: d })}
                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg">
                      {expanded === d.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {expanded === d.id && d.description && (
                  <div className="border-t border-gray-50 px-5 py-3 bg-gray-50/50">
                    <p className="text-xs text-gray-600">{d.description}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}