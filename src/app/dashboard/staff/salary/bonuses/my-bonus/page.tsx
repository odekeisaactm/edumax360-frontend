'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { bonusesAPI } from '@/lib/api';
import { Bonus } from '@/lib/types';
import {
  Award, Eye, Loader2, RefreshCw, AlertCircle, UserCircle,
  Check, AlertTriangle, X, CalendarDays, Users,
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
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmtMoney(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toTitleCase(str: string): string {
  if (!str) return '—';
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

/**
 * bonusesAPI.myList() already normalises the envelope and returns:
 *   { results: Bonus[], count: number, stats: StatsShape | null }
 * No extra unwrapping needed — just read the fields directly.
 */
function unwrapMyBonusResponse(res: any): { bonuses: Bonus[]; stats: StatsShape } {
  return {
    bonuses: Array.isArray(res?.results) ? res.results : [],
    stats: res?.stats ?? {
      total_amount: 0, paid_amount: 0, unpaid_amount: 0, category_breakdown: [],
    },
  };
}

interface StatsShape {
  total_amount: number;
  paid_amount: number;
  unpaid_amount: number;
  category_breakdown: { name: string; total: number; count?: number }[];
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
            ${t.type === 'success'
              ? 'bg-white border-emerald-200 text-emerald-900'
              : 'bg-white border-red-200 text-red-900'}`}
        >
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-500" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-40 hover:opacity-80 flex-shrink-0 ml-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ bonusId, onClose }: { bonusId: number | null; onClose: () => void }) {
  const [data, setData] = useState<Bonus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (bonusId) {
      setLoading(true);
      bonusesAPI.get(bonusId)
        .then(res => setData(res))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    } else {
      setData(null);
    }
  }, [bonusId]);

  if (!bonusId) return null;
  const staffDetail = (data?.staff_detail as any) || null;
  const categoryDetail = (data as any)?.category_detail || null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : data ? (
          <>
            {/* Dark header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 py-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">Bonus Details</span>
                </div>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Amount</p>
              <p className="text-3xl font-bold text-white mb-3">{fmtMoney(data.amount)}</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                ${data.status === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${data.status === 'paid' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {data.status === 'paid' ? 'Paid' : 'Unpaid'}
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* Recipient */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5" /> Recipient
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-blue-700">Type:</span>
                  {data.type === 'staff'
                    ? <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-bold rounded-md border border-blue-200">Staff</span>
                    : <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[11px] font-bold rounded-md">Volunteer</span>}
                </div>
                {data.type === 'staff' && staffDetail ? (
                  <div className="flex items-center gap-3 mt-2 p-3 bg-white rounded-lg border border-blue-100">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {staffDetail.first_name?.[0] ?? staffDetail.full_name?.[0] ?? '?'}
                      {staffDetail.last_name?.[0] ?? ''}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{staffDetail.full_name || data.staff_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{staffDetail.staff_id || ''}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-blue-900 font-medium mt-1">{data.volunteer_name}</p>
                )}
              </div>

              {/* Category */}
              {categoryDetail && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Category</p>
                  <p className="text-sm font-semibold text-slate-800">{toTitleCase(categoryDetail.name)}</p>
                  {categoryDetail.description && (
                    <p className="text-xs text-slate-500 mt-1">{categoryDetail.description}</p>
                  )}
                </div>
              )}

              {/* Payment Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Payment Info
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Period</p>
                    <p className="text-sm font-bold text-slate-800">{data.month}/{data.year}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Due date</p>
                    <p className="text-sm font-bold text-slate-800">
                      {new Date(data.due_date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Transaction Meta</p>
                <div className="space-y-2 text-sm">
                  {[
                    ['Created by', (data as any).created_by_name || 'System'],
                    ['Created on', new Date(data.created_at).toLocaleString()],
                    ['Last updated', new Date(data.updated_at).toLocaleString()],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-slate-500 flex-shrink-0">{label}</span>
                      <span className="font-medium text-slate-800 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {data.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Notes</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{data.notes}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-red-500 text-sm">
            Failed to load details.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function MyBonusPage() {
  const { user, hasPermission } = useAuth();

  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [stats, setStats] = useState<StatsShape>({
    total_amount: 0, paid_amount: 0, unpaid_amount: 0, category_breakdown: [],
  });
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);

  const canView = user?.is_superuser || hasPermission('salary_management.view_salaryrecordmodel');

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchMyBonuses = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await bonusesAPI.myList({ page_size: 1000 }) as any;
      const { bonuses: data, stats: s } = unwrapMyBonusResponse(res);
      setBonuses(data);
      setStats(s);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) fetchMyBonuses();
  }, [canView, fetchMyBonuses]);

  /** Read category name from category_detail if present, else fall back gracefully */
  function getCategoryName(bonus: Bonus): string {
    const detail = (bonus as any).category_detail;
    if (detail?.name) return toTitleCase(detail.name);
    return '—';
  }

  if (!canView) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-6 w-6 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {detailId && <DetailDrawer bonusId={detailId} onClose={() => setDetailId(null)} />}

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-blue-200 flex-shrink-0">
            <Award className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Bonuses</h1>
            <p className="text-xs text-slate-400">Your personal bonus history</p>
          </div>
        </div>
        <button
          onClick={fetchMyBonuses}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-500 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          {
            label: 'Total amount',
            value: fmtMoney(stats.total_amount),
            iconBg: 'bg-blue-50 border-blue-100',
            iconColor: 'text-blue-500',
            icon: Award,
          },
          {
            label: 'Paid',
            value: fmtMoney(stats.paid_amount),
            iconBg: 'bg-emerald-50 border-emerald-100',
            iconColor: 'text-emerald-500',
            icon: Check,
          },
          {
            label: 'Unpaid',
            value: fmtMoney(stats.unpaid_amount),
            iconBg: 'bg-amber-50 border-amber-100',
            iconColor: 'text-amber-500',
            icon: AlertTriangle,
          },
        ].map(({ label, value, iconBg, iconColor, icon: Icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 border rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800 tabular-nums">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Category Breakdown ── */}
      {!loading && stats.category_breakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Category breakdown</p>
          <div className="flex flex-wrap gap-2">
            {stats.category_breakdown.map(cat => (
              <div key={cat.name} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-500">{toTitleCase(cat.name)}</span>
                <span className="text-xs font-bold text-slate-800 tabular-nums">{fmtMoney(cat.total)}</span>
                {cat.count !== undefined && (
                  <span className="text-[10px] text-slate-400">×{cat.count}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500 mx-auto" />
            <p className="mt-2.5 text-sm text-slate-400">Loading bonuses...</p>
          </div>
        ) : pageError ? (
          <div className="p-12 text-center">
            <AlertCircle className="h-7 w-7 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button
              onClick={fetchMyBonuses}
              className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : bonuses.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Award className="h-6 w-6 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">No bonuses yet</h3>
            <p className="text-sm text-slate-400">You haven't received any bonuses yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: 'fixed', minWidth: '600px' }}>
              <colgroup>
                <col style={{ width: '44px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '116px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '96px' }} />
                <col style={{ width: '56px' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-3 py-2.5" />
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Category</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Due date</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Period</th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {bonuses.map(bonus => (
                  <tr key={bonus.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* Avatar */}
                    <td className="px-3 py-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                        ${bonus.type === 'staff'
                          ? 'bg-blue-50 border border-blue-100'
                          : 'bg-slate-50 border border-slate-200'}`}>
                        {bonus.type === 'staff'
                          ? <Award className="h-3.5 w-3.5 text-blue-400" />
                          : <Users className="h-3.5 w-3.5 text-slate-400" />}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-slate-800 truncate">{getCategoryName(bonus)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {bonus.type === 'staff' ? 'Staff bonus' : 'Volunteer bonus'}
                      </p>
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-semibold text-slate-800 tabular-nums">
                        {fmtMoney(bonus.amount)}
                      </span>
                    </td>

                    {/* Due date */}
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-slate-500">
                        {new Date(bonus.due_date).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </td>

                    {/* Period */}
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-xs font-mono text-slate-500">
                        {bonus.month}/{bonus.year}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center">
                      {bonus.status === 'paid' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-semibold rounded-full whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 text-[11px] font-semibold rounded-full whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />Unpaid
                        </span>
                      )}
                    </td>

                    {/* View action */}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => setDetailId(bonus.id)}
                        title="View details"
                        className="w-7 h-7 rounded-lg flex items-center justify-center border border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors mx-auto"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer count */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-700">{bonuses.length}</span> bonus record{bonuses.length !== 1 ? 's' : ''} total
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}