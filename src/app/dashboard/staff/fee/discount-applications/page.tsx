'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { feeAPI } from '@/lib/fee.service';
import { DiscountApplication, Discount, StudentDiscount } from '@/lib/types';
import {
  Database, Plus, Check, X, AlertCircle,
  Loader2, Search, Tag, Users, Filter,
} from 'lucide-react';

const fmt = (v: string | number = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};

// --- Local API Helpers to bypass missing service definitions ---
const localAPI = {
  getApps: async () => {
    const res = await api.get('/api/fee/discount-applications/');
    return res.data?.results || res.data || [];
  },
  createApp: async (data: any) => {
    const res = await api.post('/api/fee/discount-applications/', data);
    return res.data?.data || res.data;
  },
  getStudentDiscounts: async () => {
    const res = await api.get('/api/fee/student-discounts/');
    return res.data?.results || res.data || [];
  }
};

export default function DiscountApplicationsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [activeTab, setActiveTab] = useState<'applications' | 'applied'>('applications');

  // State
  const [applications, setApplications] = useState<DiscountApplication[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [studentDiscounts, setStudentDiscounts] = useState<StudentDiscount[]>([]);

  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState('');

  // Form State
  const [form, setForm] = useState({ discount: '', session: '', period: '', discount_amount: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, discRes, studentDiscRes] = await Promise.all([
        localAPI.getApps(),
        feeAPI.discounts.list(),
        localAPI.getStudentDiscounts(),
      ]);
      setApplications(appsRes);
      setDiscounts(discRes);
      setStudentDiscounts(studentDiscRes);
    } catch (err) {
      console.error("Failed to load discount applications", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Submit
  const handleSubmit = async () => {
    if (!form.discount || !form.discount_amount) {
      setError('Discount and Amount are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        discount: parseInt(form.discount),
        discount_amount: form.discount_amount,
        ...(form.session ? { session: parseInt(form.session) } : {}),
        ...(form.period ? { period: parseInt(form.period) } : {}),
      };

      const created = await localAPI.createApp(payload);

      // Fix for the TS2345 empty object error
      setApplications(prev => [created as DiscountApplication, ...prev]);
      setModal(false);
      setForm({ discount: '', session: '', period: '', discount_amount: '' });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.message || 'Failed to create application.');
    } finally {
      setSaving(false);
    }
  };

  // Filters
  const filteredApps = applications.filter(a =>
    !search ||
    (a.discount_title && a.discount_title.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredStudentDiscounts = studentDiscounts.filter(d =>
    !search ||
    (d.student_name && d.student_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discount Applications</h1>
            <p className="text-sm text-gray-500">Manage termly discount rules and applied student concessions.</p>
          </div>
        </div>

        {canManage && (
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" /> New Application Rule
          </button>
        )}
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'applications' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Application Rules
          </button>
          <button
            onClick={() => setActiveTab('applied')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'applied' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            Applied to Students
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
        </div>
      ) : activeTab === 'applications' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold">
                <tr>
                  <th className="px-5 py-4">Discount Scheme</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Term / Session</th>
                  <th className="px-5 py-4">Type</th>
                  <th className="px-5 py-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-gray-500">No application rules found.</td>
                  </tr>
                ) : filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-indigo-500" />
                        {app.discount_title || `Discount #${app.discount}`}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-bold text-emerald-600">
                      {fmt(app.discount_amount)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {app.period_display || app.session_display || 'Universal'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium capitalize">
                        {app.discount_type || 'Standard'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {/* Fix for TS2769 Overload error */}
                      {app.created_at ? new Date(app.created_at as string).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold">
                <tr>
                  <th className="px-5 py-4">Student</th>
                  <th className="px-5 py-4">Discount Applied</th>
                  <th className="px-5 py-4">Amount Discounted</th>
                  <th className="px-5 py-4">Applied Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredStudentDiscounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-gray-500">No student discounts applied yet.</td>
                  </tr>
                ) : filteredStudentDiscounts.map((sd) => (
                  <tr key={sd.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-indigo-500" />
                        {sd.student_name || `Student #${sd.student}`}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {sd.discount_title || `App #${sd.discount_application}`}
                    </td>
                    <td className="px-5 py-3 font-bold text-emerald-600">
                      {fmt(sd.amount_discounted)}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {/* Fix for TS2769 Overload error */}
                      {sd.created_at ? new Date(sd.created_at as string).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900">New Application Rule</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1 rounded-md shadow-sm border border-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Discount Scheme *</label>
                <select
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a discount...</option>
                  {discounts.map(d => (
                    <option key={d.id} value={d.id}>{d.title} (ID: {d.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Discount Amount *</label>
                <input
                  type="number"
                  placeholder="e.g. 5000 or 15"
                  value={form.discount_amount}
                  onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Session ID (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1"
                    value={form.session}
                    onChange={(e) => setForm({ ...form, session: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">Period ID (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2"
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Application
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}