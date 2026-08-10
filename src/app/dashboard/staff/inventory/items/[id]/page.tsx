// app/dashboard/staff/inventory/items/[id]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { inventoryItemAPI, stockInAPI, stockOutAPI, stockTransferAPI } from '@/lib/api';
import { InventoryItem, StockIn, StockOut, StockTransfer } from '@/lib/types';
import ItemFormModal, { ItemFormValues } from '@/components/inventory/ItemFormModal';
import {
  ArrowLeft, Package, Edit3, AlertTriangle, Loader2,
  Tag, ScanLine, DollarSign, MapPin, Activity, ArrowDownCircle,
  ArrowUpCircle, RefreshCw, Plus, Check, LayoutGrid, History, ExternalLink,
} from 'lucide-react';

// ─── Local type extensions ──────────────────────────────────────────────────────
// These assume the backend has added created_by_name (StockIn/StockOut/StockTransfer)
// and staff_recipient_name (StockOut). Declared as optional intersections here so
// this compiles fine even before those fields land, and picks them up once they do.
type StockInEvent = StockIn & { created_by_name?: string };
type StockOutEvent = StockOut & { created_by_name?: string; staff_recipient_name?: string; destination_location_name?: string };
type StockTransferEvent = StockTransfer & { created_by_name?: string };

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details).map(([, v]) => (Array.isArray(v) ? v[0] : String(v))).join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function formatCurrency(val: string | number | undefined | null): string {
  if (!val) return '₦0.00';
  return `₦${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function humanize(s?: string | null): string {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Types for Timeline ───────────────────────────────────────────────────────
type EventType = 'stock_in' | 'stock_out' | 'transfer';
type TimelineEvent = {
  id: string;
  type: EventType;
  date: string;
  details: string;
  meta: string;
  createdBy?: string;
};

const MOVEMENT_LIMIT = 15; // per-endpoint fetch cap; also the "recent activity" cap shown for a single type

const TYPE_TABS: { id: EventType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stock_in', label: 'In' },
  { id: 'stock_out', label: 'Out' },
  { id: 'transfer', label: 'Transfer' },
];

const FULL_HISTORY_LINKS: Record<EventType, { base: string; label: string }> = {
  stock_in: { base: '/dashboard/staff/inventory/stock-in', label: 'stock-in history' },
  stock_out: { base: '/dashboard/staff/inventory/stock-out', label: 'stock-out history' },
  transfer: { base: '/dashboard/staff/inventory/stock-transfer', label: 'transfer history' },
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = Number(params.id);
  const { hasPermission, user } = useAuth();

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'movement'>('overview');
  const [typeFilter, setTypeFilter] = useState<EventType | 'all'>('all');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('inventory.add_inventoryitemmodel');
  const canManageStock = user?.is_superuser || hasPermission('inventory.add_inventorystockinmodel');

  // ── Data Fetching ──
  const fetchItem = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await inventoryItemAPI.get(itemId);
      setItem(data);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const [insRes, outsRes, transfersRes] = await Promise.all([
        stockInAPI.list({ item: itemId, page_size: MOVEMENT_LIMIT }),
        stockOutAPI.list({ item: itemId, page_size: MOVEMENT_LIMIT }),
        stockTransferAPI.list({ item: itemId, page_size: MOVEMENT_LIMIT }),
      ]);

      const normalize = (res: any) => Array.isArray(res) ? res : (res?.results?.data || res?.results || res?.data || []);
      const unit = item?.unit || 'pcs';

      const ins: TimelineEvent[] = normalize(insRes).map((r: StockInEvent) => ({
        id: `in-${r.id}`,
        type: 'stock_in',
        date: r.date_received || r.created_at,
        details: `+${Number(r.items?.[0]?.quantity_received || 0).toFixed(2)} ${unit}`,
        meta: `Received into ${r.location_name || 'Unknown'}`,
        createdBy: r.created_by_name,
      }));

      const outs: TimelineEvent[] = normalize(outsRes).map((r: StockOutEvent) => {
        let meta: string;
        if (r.staff_recipient) {
          const name = r.staff_recipient_name || 'a staff member';
          meta = `Collected by ${name}${r.department ? ` — ${humanize(r.department)}` : ''}`;
        } else if (r.destination_location) {
          meta = `To ${r.destination_location_name || 'another location'}`;
        } else {
          meta = `${humanize(r.reason) || 'Removed'} from ${r.location_name || 'Unknown'}${r.department ? ` — ${humanize(r.department)}` : ''}`;
        }
        return {
          id: `out-${r.id}`,
          type: 'stock_out',
          date: r.date_removed || r.created_at,
          details: `-${Number(r.quantity_removed).toFixed(2)} ${unit}`,
          meta,
          createdBy: r.created_by_name,
        };
      });

      const transfers: TimelineEvent[] = normalize(transfersRes).map((r: StockTransferEvent) => ({
        id: `trn-${r.id}`,
        type: 'transfer',
        date: r.transfer_date || r.created_at,
        details: `${Number(r.items?.[0]?.quantity || 0).toFixed(2)} ${unit}`,
        meta: `${r.from_location_name || 'A'} → ${r.to_location_name || 'B'}`,
        createdBy: r.created_by_name,
      }));

      const combined = [...ins, ...outs, ...transfers].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimeline(combined);
    } catch (err) {
      console.error('Failed to fetch timeline', err);
    } finally {
      setTimelineLoading(false);
    }
  }, [itemId, item?.unit]);

  useEffect(() => { fetchItem(); }, [fetchItem]);
  useEffect(() => { if (item) fetchTimeline(); }, [item, fetchTimeline]);

  const handleEditSave = async (form: ItemFormValues) => {
    setIsSaving(true);
    try {
      const updateData = {
        ...form,
        category: form.category === '' ? undefined : Number(form.category),
      };
      const updated = await inventoryItemAPI.update(itemId, updateData);
      setItem(updated);
      setShowEditModal(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // ── Calculated Values ──
  const lastCost = item?.last_cost_price ? Number(item.last_cost_price) : 0;
  const sellingPrice = item?.current_selling_price ? Number(item.current_selling_price) : 0;
  const profitMargin = sellingPrice > 0 && lastCost > 0 ? ((sellingPrice - lastCost) / sellingPrice * 100) : 0;
  const totalStock = item?.total_quantity ? Number(item.total_quantity) : 0;
  const reorderLevel = item?.reorder_level ? Number(item.reorder_level) : 0;
  const stockPercentage = reorderLevel > 0 ? Math.min((totalStock / reorderLevel) * 100, 100) : (totalStock > 0 ? 100 : 0);

  const filteredTimeline = typeFilter === 'all' ? timeline : timeline.filter(e => e.type === typeFilter);

  // ── Loading & Error States ──
  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-9 w-9 animate-spin text-indigo-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading item details...</p>
      </div>
    </div>
  );

  if (pageError || !item) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl ring-1 ring-red-100 p-8 space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">Item Not Found</h3>
        <p className="text-sm text-slate-500">{pageError || 'This item may have been deleted or the link is broken.'}</p>
        <button onClick={() => router.push('/dashboard/staff/inventory/items')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Items
        </button>
      </div>
    </div>
  );

  // ── Render Helpers ──
  const InfoRow = ({ label, value, children }: { label: string; value?: string | React.ReactNode; children?: React.ReactNode }) => (
    <div className="flex justify-between py-2.5 border-b border-slate-50 last:border-0 gap-4">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-slate-800 font-medium text-right">{value || children}</span>
    </div>
  );

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'stock_in': return <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" />;
      case 'stock_out': return <ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />;
      case 'transfer': return <RefreshCw className="h-3.5 w-3.5 text-blue-600" />;
    }
  };

  const getEventIconBg = (type: EventType) => {
    switch (type) {
      case 'stock_in': return 'bg-emerald-50';
      case 'stock_out': return 'bg-red-50';
      case 'transfer': return 'bg-blue-50';
    }
  };

  const getEventLabel = (type: EventType) => type === 'stock_in' ? 'Stock In' : type === 'stock_out' ? 'Stock Out' : 'Transfer';

  return (
    <div className="space-y-5 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100/70">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Item updated successfully!</p>
          </div>
        </div>
      )}

      {showEditModal && (
        <ItemFormModal
          editing={item}
          isSaving={isSaving}
          onSave={handleEditSave}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* ── Hero Header ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 flex items-start justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
            <button onClick={() => router.push('/dashboard/staff/inventory/items')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
              <ArrowLeft className="h-4 w-4 text-slate-600" />
            </button>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
              <Package className="h-5 sm:h-6 w-5 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                <span className="truncate">{item.name}</span>
                {item.is_active ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200 flex-shrink-0">Active</span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 flex-shrink-0">Inactive</span>
                )}
              </h1>
              <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{item.category_name || 'Uncategorized'}</span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1"><ScanLine className="h-3 w-3" />{item.barcode || 'No Barcode'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {canManageStock && (
              <button onClick={() => router.push(`/dashboard/staff/inventory/stock-in/new?item_id=${item.id}`)}
                title="Stock In"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-sm">
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Stock In</span>
              </button>
            )}
            {canManageStock && (
              <button onClick={() => router.push(`/dashboard/staff/inventory/stock-out/new?item_id=${item.id}`)}
                title="Stock Out"
                className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-orange-400 to-red-500 text-white text-sm font-semibold rounded-xl hover:from-orange-500 hover:to-red-600 transition-all shadow-sm">
                <ArrowUpCircle className="h-4 w-4" /> <span className="hidden sm:inline">Stock Out</span>
              </button>
            )}
            {canEdit && (
              <button onClick={() => setShowEditModal(true)}
                className="p-2 sm:p-2.5 rounded-xl border border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                title="Edit Item">
                <Edit3 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Low Stock Warning Banner */}
        {item.is_low_stock && (
          <div className="mx-4 sm:mx-6 mb-4 sm:mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm text-amber-800 flex items-start sm:items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span><span className="font-semibold">Low Stock:</span> {totalStock.toFixed(2)} {item.unit} left, below the {reorderLevel.toFixed(2)} {item.unit} reorder level.</span>
          </div>
        )}
        {!item.is_low_stock && <div className="h-4 sm:h-6" />}

        {/* ── Tabs ── */}
        <div className="flex border-t border-slate-100 px-4 sm:px-6">
          {[
            { id: 'overview' as const, label: 'Overview', icon: LayoutGrid },
            { id: 'movement' as const, label: 'Movement', icon: History },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.id ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

          {/* Card 1: Core Info */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Core Information</h3>
            </div>
            <div className="p-5 divide-y divide-slate-50">
              <InfoRow label="Unit of Measure" value={item.unit.charAt(0).toUpperCase() + item.unit.slice(1)} />
              <InfoRow label="Total Stock" value={<span className="font-bold text-slate-900">{totalStock.toFixed(2)} <span className="text-slate-400 font-normal">{item.unit}s</span></span>} />
              <InfoRow label="Reorder Level" value={`${reorderLevel.toFixed(2)} ${item.unit}s`} />
            </div>
          </div>

          {/* Card 2: Financials */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" /> Financials
              </h3>
            </div>
            <div className="p-5 divide-y divide-slate-50">
              <InfoRow label="Selling Price" value={<span className="text-indigo-600 font-bold">{formatCurrency(sellingPrice)}</span>} />
              <InfoRow label="Last Cost Price" value={formatCurrency(lastCost)} />
              <InfoRow
                label="Est. Margin"
                value={
                  <span className={`font-bold ${profitMargin > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {profitMargin.toFixed(1)}%
                  </span>
                }
              />
            </div>
          </div>

          {/* Card 3: Stock by Location */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> Stock by Location
              </h3>
            </div>
            <div className="p-5 flex-1 flex flex-col justify-center">
              {item.location_stocks && item.location_stocks.length > 0 ? (
                <div className="space-y-3">
                  {item.location_stocks.map(loc => (
                    <div key={loc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${loc.location_type === 'shop' ? 'bg-violet-400' : 'bg-amber-400'}`} />
                        <span className="text-sm font-medium text-slate-700 truncate">{loc.location_name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900 flex-shrink-0">{Number(loc.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-400 uppercase mb-1 font-semibold">
                      <span>Stock Health</span>
                      <span>{stockPercentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          stockPercentage <= 25 ? 'bg-red-500' :
                          stockPercentage <= 75 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${stockPercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No tracked stock locations found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Movement Tab ── */}
      {activeTab === 'movement' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-50 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {TYPE_TABS.map(t => (
                <button key={t.id} onClick={() => setTypeFilter(t.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    typeFilter === t.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={fetchTimeline} disabled={timelineLoading} title="Refresh"
              className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 p-1.5">
              <RefreshCw className={`h-4 w-4 ${timelineLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-4 sm:p-5">
            {timelineLoading && timeline.length === 0 ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300 mx-auto" /></div>
            ) : filteredTimeline.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">
                  {typeFilter === 'all' ? 'No stock movements recorded for this item yet.' : `No recent ${getEventLabel(typeFilter as EventType).toLowerCase()} activity.`}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {filteredTimeline.map(event => (
                  <div key={event.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-slate-50/70 transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${getEventIconBg(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm text-slate-800 truncate">
                          <span className="font-semibold">{getEventLabel(event.type)}</span>
                          <span className="text-slate-400 font-normal"> · {event.details}</span>
                        </p>
                        <p className="text-[11px] text-slate-400 flex-shrink-0">{new Date(event.date).toLocaleDateString()}</p>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {event.meta}{event.createdBy && <span className="text-slate-300"> · Logged by {event.createdBy}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Full history links */}
          {timeline.length > 0 && (
            <div className="px-4 sm:px-5 py-3.5 border-t border-slate-50 bg-slate-50/40">
              {typeFilter === 'all' ? (
                <div className="flex items-center gap-4 flex-wrap text-xs">
                  {(Object.keys(FULL_HISTORY_LINKS) as EventType[]).map(type => (
                    <button key={type}
                      onClick={() => router.push(`${FULL_HISTORY_LINKS[type].base}?item=${itemId}`)}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-medium transition-colors">
                      Full {FULL_HISTORY_LINKS[type].label} <ExternalLink className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => router.push(`${FULL_HISTORY_LINKS[typeFilter as EventType].base}?item=${itemId}`)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors">
                  View full {FULL_HISTORY_LINKS[typeFilter as EventType].label} <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}