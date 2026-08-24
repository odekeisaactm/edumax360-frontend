'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { inventoryReportAPI_v2, inventoryCategoryAPI, inventoryLocationAPI, schoolInfoAPI, inventorySettingAPI } from '@/lib/api';
import {
  Filter, Loader2, BarChart2, TrendingUp, Users,
  CheckCircle, AlertTriangle, X, Printer, Package, FileBarChart2
} from 'lucide-react';
import dynamicImport from 'next/dynamic';

// Dynamic Tab Imports
const StockLevelTab = dynamicImport(() => import('./tabs/StockLevelTab'), { loading: () => <TabSkeleton />, ssr: false });
const SalesProfitTab = dynamicImport(() => import('./tabs/SalesProfitTab'), { loading: () => <TabSkeleton />, ssr: false });
const StaffSalesTab = dynamicImport(() => import('./tabs/StaffSalesTab'), { loading: () => <TabSkeleton />, ssr: false });
const InventoryLevelTab = dynamicImport(() => import('./tabs/InventoryLevelTab'), { loading: () => <TabSkeleton />, ssr: false });

// Helpers
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d && typeof d === 'object') {
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.error) return String(d.error);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function TabSkeleton() {
  return <div className="h-96 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-200" /></div>;
}

type TabKey = 'stock-level' | 'sales-profit' | 'staff-sales' | 'inventory-level';

export default function InventoryReportsPage() {
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('inventory.view_inventory_report');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  // Reference Data
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);

  // Filter State
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('all');
  const [skipZero, setSkipZero] = useState<boolean>(false);
  const [showOptional, setShowOptional] = useState<boolean>(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<TabKey>('stock-level');
  const [dataLoading, setDataLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const fetchRequestIdRef = useRef(0);
  const printRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback((tab: TabKey) => {
    setReportData(null);
    setActiveTab(tab);
    // Reset date filters for non-movement reports? Keep as is.
  }, []);

  // Client-only timestamp
  const [printedAt, setPrintedAt] = useState<string>('');
  useEffect(() => {
    setPrintedAt(new Date().toLocaleString('en-GB'));
  }, []);

  // Initialize reference data
  useEffect(() => {
    const init = async () => {
      try {
        const [catRes, locRes, schoolRes, settingsRes] = await Promise.all([
          inventoryCategoryAPI.list(),
          inventoryLocationAPI.list(),
          schoolInfoAPI.get(),
          inventorySettingAPI.get(),
        ]);
        setCategories(Array.isArray(catRes) ? catRes : catRes?.results || []);
        setLocations(Array.isArray(locRes) ? locRes : locRes?.results || []);
        setSchoolInfo(schoolRes);
        setSettings(settingsRes);
      } catch (err) {
        showToast('error', 'Failed to load filter parameters or school info.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [showToast]);

  // Fetch report data based on active tab
  const fetchReport = useCallback(async () => {
    const requestId = ++fetchRequestIdRef.current;
    setDataLoading(true);

    try {
      let data = null;

      if (activeTab === 'stock-level') {
        const params: any = {};
        if (filterLocation !== 'all') params.location = filterLocation;
        if (filterCategory) params.category = filterCategory;
        data = await inventoryReportAPI_v2.stockLevel(params);
      } else if (activeTab === 'sales-profit') {
        const params: any = {};
        if (filterStartDate) params.start_date = filterStartDate;
        if (filterEndDate) params.end_date = filterEndDate;
        if (filterLocation !== 'all') params.location = filterLocation;
        if (filterPaymentMethod !== 'all') params.payment_method = filterPaymentMethod;
        data = await inventoryReportAPI_v2.salesAnalysis(params);
      } else if (activeTab === 'staff-sales') {
        const params: any = {};
        if (filterStartDate) params.start_date = filterStartDate;
        if (filterEndDate) params.end_date = filterEndDate;
        if (filterLocation !== 'all') params.location = filterLocation;
        data = await inventoryReportAPI_v2.staffSales(params);
      } else if (activeTab === 'inventory-level') {
        const params: any = {};
        if (filterStartDate) params.date_from = filterStartDate;
        if (filterEndDate) params.date_to = filterEndDate;
        if (filterLocation !== 'all') params.location = filterLocation;
        params.skip_zero = skipZero;
        params.show_optional = showOptional;
        data = await inventoryReportAPI_v2.stockMovement(params);
      }

      if (requestId !== fetchRequestIdRef.current) return;
      setReportData(data);
    } catch (err) {
      if (requestId !== fetchRequestIdRef.current) return;
      showToast('error', extractError(err));
    } finally {
      if (requestId === fetchRequestIdRef.current) setDataLoading(false);
    }
  }, [activeTab, filterLocation, filterCategory, filterStartDate, filterEndDate, filterPaymentMethod, skipZero, showOptional, showToast]);

  useEffect(() => {
    if (!loading) fetchReport();
  }, [fetchReport, loading]);

  const reportTitle = useMemo(() => {
    const base = activeTab === 'stock-level' ? 'Stock Level Report'
      : activeTab === 'sales-profit' ? 'Sales & Profit Analysis'
      : activeTab === 'staff-sales' ? 'Staff Sales Report'
      : 'Inventory Level Report';
    const parts = [base];
    if (filterLocation !== 'all') {
      const loc = locations.find(l => l.id.toString() === filterLocation);
      if (loc) parts.push(loc.name);
    }
    if ((filterStartDate && filterEndDate) && (activeTab !== 'stock-level')) {
      parts.push(`${filterStartDate} to ${filterEndDate}`);
    }
    return parts.join(' — ');
  }, [activeTab, filterLocation, filterStartDate, filterEndDate, locations]);

  const handleExportPdf = () => window.print();

  if (!canManage) return <div className="p-16 text-center font-bold text-red-600">Access Denied: Missing inventory report permissions.</div>;

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-600" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Initializing Reports Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-0 animate-in fade-in duration-300 print:p-0 print:max-w-none">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-600 flex items-center justify-center shadow-md shrink-0">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Inventory Reports</h1>
            <p className="text-xs text-slate-500 mt-1 font-medium">Stock levels, sales performance, staff analytics, and inventory movements.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportPdf} className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-cyan-600" /> Print / PDF
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 print:hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Master Filters</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Location filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Location</label>
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500">
              <option value="all">All Locations</option>
              <option value="shop">All Shops</option>
              <option value="store">All Stores</option>
              {locations.filter(l => l.location_type !== 'generic').map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {/* Category only for stock-level */}
          {activeTab === 'stock-level' && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500">
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {/* Date range for sales/profit, staff-sales, and inventory-level */}
          {activeTab !== 'stock-level' && (
            <>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Start Date</label>
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">End Date</label>
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500" />
              </div>
              {activeTab === 'sales-profit' && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Payment Method</label>
                  <select value={filterPaymentMethod} onChange={e => setFilterPaymentMethod(e.target.value)} className="w-full px-3 py-2 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="all">All Methods</option>
                    <option value="cash">Cash</option>
                    <option value="student_wallet">Student Wallet</option>
                    <option value="staff_wallet">Staff Wallet</option>
                    <option value="pos">POS</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* Checkboxes for inventory-level */}
          {activeTab === 'inventory-level' && (
            <>
              <div className="col-span-2 flex flex-wrap items-center gap-4 mt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input type="checkbox" checked={skipZero} onChange={e => setSkipZero(e.target.checked)} className="form-checkbox rounded text-cyan-600" />
                  Skip items with no activity
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input type="checkbox" checked={showOptional} onChange={e => setShowOptional(e.target.checked)} className="form-checkbox rounded text-cyan-600" />
                  Show Qty Sold & Stocked Out
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1 bg-white rounded-xl border border-slate-200 shadow-sm w-fit print:hidden">
        <button onClick={() => handleTabChange('stock-level')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'stock-level' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Package className="w-4 h-4" /> Stock Level
        </button>
        <button onClick={() => handleTabChange('sales-profit')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'sales-profit' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <TrendingUp className="w-4 h-4" /> Sales & Profit
        </button>
        <button onClick={() => handleTabChange('staff-sales')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'staff-sales' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <Users className="w-4 h-4" /> Staff Sales
        </button>
        <button onClick={() => handleTabChange('inventory-level')} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'inventory-level' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
          <FileBarChart2 className="w-4 h-4" /> Inventory Level
        </button>
      </div>

      {/* Print header with school info */}
      <div className="hidden print:block px-1">
        {schoolInfo && (
          <div className="text-center mb-4">
            <h1 className="text-lg font-black text-slate-900">{schoolInfo.name}</h1>
            {schoolInfo.address && <p className="text-xs text-slate-600">{schoolInfo.address}</p>}
            <p className="text-xs text-slate-600">{schoolInfo.mobile_1} | {schoolInfo.email}</p>
          </div>
        )}
        <h1 className="text-lg font-black text-slate-900">{reportTitle}</h1>
        <p className="text-xs text-slate-500">Printed {printedAt}</p>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px] relative print:border-0 print:shadow-none print:rounded-none" ref={printRef}>
        {dataLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-2xl print:hidden">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
          </div>
        )}

        <div className="p-1">
          {activeTab === 'stock-level' && <StockLevelTab data={reportData} reportTitle={reportTitle} />}
          {activeTab === 'sales-profit' && <SalesProfitTab data={reportData} reportTitle={reportTitle} />}
          {activeTab === 'staff-sales' && <StaffSalesTab data={reportData} reportTitle={reportTitle} settings={settings} />}
          {activeTab === 'inventory-level' && <InventoryLevelTab data={reportData} reportTitle={reportTitle} showOptional={showOptional} />}
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { width: 100% !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .overflow-x-auto { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}