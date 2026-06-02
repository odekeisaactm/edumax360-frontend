'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, studentsAPI } from '@/lib/api';
import { DiscountApplication, Discount, StudentDiscount, Student } from '@/lib/types';
import {
  Database, Plus, Trash2, Check, X, AlertCircle,
  Loader2, Search, Tag, ChevronRight, Users, Filter,
} from 'lucide-react';

const fmt = (v: string | number = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};

// ─── Discount Applications Page ───────────────────────────────────────────────

export function DiscountApplicationsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [applications, setApplications] = useState<DiscountApplication[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ discount: '', session: '', period: '', discount_amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [apps, disc] = await Promise.all([feeAPI.getDiscountApplications(), feeAPI.getDiscounts()]);
      setApplications(apps); setDiscounts(disc);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const handleSave = async () => {
    if (!form.discount || !form.discount_amount) { setError('Discount and amount are required'); return; }
    setSaving(true); setError(null);
    try {
      const created = await feeAPI.createDiscountApplication({
        discount: parseInt(form.discount),
        session: form.session ? parseInt(form.session) : undefined,
        period: form.period ? parseInt(form.period) : undefined,
        discount_amount: form.discount_amount,
      });
      setApplications(prev => [created, ...prev]);
      setModal(false);
      setForm({ discount: '', session: '', period: '', discount_amount: '' });
      showSuccess('Discount application created');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const selectedDiscount = discounts.find(d => d.id === parseInt(form.discount));

  return (
    <div className="space-y-5 pb-8">
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg">
          <Check className="h-4 w-4 text-green-600" /><p className="text-sm font-medium text-green-800">{successMsg}</p>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">New Discount Application</h3>
              <button onClick={() => setModal(false)} disabled={saving} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Discount Scheme *</label>
                <select value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500">
                  <option value="">Select discount...</option>
                  {discounts.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              {selectedDiscount && (
                <div className="p-3 bg-violet-50 rounded-lg text-xs text-violet-700">
                  Type: {selectedDiscount.discount_type} · Occurrence: {selectedDiscount.occurrence}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Session (optional)</label>
                  <input value={form.session} onChange={e => setForm(f => ({ ...f, session: e.target.value }))}
                    placeholder="Session ID"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Period (optional)</label>
                  <input value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                    placeholder="Period ID"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Discount Amount *
                  {selectedDiscount?.discount_type === 'percentage' ? ' (%)' : ' (₦)'}
                </label>
                <input type="number" value={form.discount_amount} onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))}
                  placeholder={selectedDiscount?.discount_type === 'percentage' ? '10 for 10%' : '5000.00'}
                  min="0" step="0.01"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t">
              <button onClick={() => setModal(false)} disabled={saving}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discount Applications</h1>
            <p className="text-sm text-gray-400">{applications.length} application{applications.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 shadow-sm">
            <Plus className="h-4 w-4" /> New Application
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border p-12 text-center"><Loader2 className="h-10 w-10 text-violet-500 animate-spin mx-auto" /></div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
          <Database className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-600">No discount applications yet</p>
          <p className="text-sm text-gray-400 mt-1">Create an application to lock in a discount rate for a session/period</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Discount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Session/Period</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {applications.map(a => {
                const disc = discounts.find(d => d.id === a.discount);
                return (
                  <tr key={a.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-medium text-gray-800">{disc?.title || a.discount_title || `Discount #${a.discount}`}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {a.session ? `Session #${a.session}` : 'All sessions'}
                      {a.period ? ` · Period #${a.period}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                      {disc?.discount_type === 'percentage' ? `${a.discount_amount}%` : fmt(a.discount_amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Apply Discount: Student Search → Assign ──────────────────────────────────

export function ApplyDiscountPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canAccess = user?.is_superuser || hasPermission('fee_management.add_feepaymentmodel');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [searching, setSearching] = useState(false);
  const [discounts, setDiscounts] = useState<DiscountApplication[]>([]);
  const [selectedDiscount, setSelectedDiscount] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    feeAPI.getDiscountApplications().then(setDiscounts).catch(() => setDiscounts([]));
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try { setResults(await studentsAPI.list({ search: query, status: 'active' })); }
      catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const handleApply = async () => {
    if (!selected || !selectedDiscount) { setError('Select a student and discount'); return; }
    setApplying(true); setError(null);
    try {
      // POST to assign discount to student
      await feeAPI.assignStudentDiscount?.({ student: selected.id, discount_application: parseInt(selectedDiscount) });
      setSuccessMsg('Discount applied successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
      setSelected(null); setSelectedDiscount(''); setQuery(''); setResults([]);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to apply discount');
    } finally { setApplying(false); }
  };

  return (
    <div className="space-y-5 pb-8">
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg">
          <Check className="h-4 w-4 text-green-600" /><p className="text-sm font-medium text-green-800">{successMsg}</p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg">
          <Tag className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Apply Discount</h1>
          <p className="text-sm text-gray-400">Search for a student and assign a discount</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">1. Search Student</p>
          </div>
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Name or registration number..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 bg-gray-50"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-500 animate-spin" />}
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {results.map(s => (
                <button key={s.id} onClick={() => setSelected(s)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    selected?.id === s.id ? 'bg-teal-50 border border-teal-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(s.full_name || s.first_name)?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{(s.full_name || `${s.first_name} ${s.last_name}`).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{s.registration_number} · {s.current_class_name}</p>
                  </div>
                  {selected?.id === s.id && <Check className="h-4 w-4 text-teal-600 flex-shrink-0" />}
                </button>
              ))}
              {!searching && query.length >= 2 && results.length === 0 && (
                <p className="text-xs text-center text-gray-400 py-6">No students found</p>
              )}
              {query.length < 2 && (
                <p className="text-xs text-center text-gray-400 py-6">Type at least 2 characters</p>
              )}
            </div>
          </div>
        </div>

        {/* Assign */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-800">2. Select Discount & Apply</p>
          </div>
          <div className="p-4 space-y-4">
            {selected ? (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                <p className="text-sm font-bold text-teal-800">{(selected.full_name || `${selected.first_name} ${selected.last_name}`).toUpperCase()}</p>
                <p className="text-xs text-teal-600 mt-0.5">{selected.registration_number} · {selected.current_class_name}</p>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-xl text-center text-sm text-gray-400">Select a student first</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Discount Application</label>
              <select value={selectedDiscount} onChange={e => setSelectedDiscount(e.target.value)}
                disabled={!selected}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 disabled:opacity-50 bg-gray-50">
                <option value="">Select discount...</option>
                {discounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.discount_title || `Discount #${a.discount}`}
                    {a.period ? ` — Period #${a.period}` : ''}
                    {' '}({a.discount_amount}{/* type shown in label */})
                  </option>
                ))}
              </select>
            </div>

            <button onClick={handleApply} disabled={!selected || !selectedDiscount || applying}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 shadow-sm">
              {applying ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              Apply Discount
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Applied Discounts List ───────────────────────────────────────────────────

export function AppliedDiscountsPage() {
  const { user, hasPermission } = useAuth();
  const canView = user?.is_superuser || hasPermission('fee_management.view_feepaymentmodel');

  const [discounts, setDiscounts] = useState<StudentDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    feeAPI.getAppliedDiscounts().then(setDiscounts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = discounts.filter(d =>
    !search || JSON.stringify(d).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
          <Tag className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applied Discounts</h1>
          <p className="text-sm text-gray-400">{loading ? '...' : `${discounts.length} applied`}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm" />
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border p-12 text-center"><Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center">
          <Tag className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-base font-semibold text-gray-600">No applied discounts found</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Student</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Discount</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Applied</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(d => (
                <tr key={d.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-medium text-gray-800">Student #{d.student}</td>
                  <td className="px-4 py-3 text-gray-600">App #{d.discount_application}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">{fmt(d.amount_discounted)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Default export — used for routing, picks component based on path context
export default DiscountApplicationsPage;