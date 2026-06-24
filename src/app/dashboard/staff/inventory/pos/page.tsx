// app/dashboard/staff/inventory/pos/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Script from 'next/script';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { studentsAPI, staffAPI, inventoryItemAPI, inventoryLocationAPI, inventoryReportAPI, saleAPI } from '@/lib/api';
import { InventoryLocation, InventoryItemList, SalePayload } from '@/lib/types';
import {
  CreditCard, Search, X, Trash2, ScanLine, User, Wallet,
  Loader2, AlertCircle, Check, Store, ShoppingCart, Fingerprint, Star,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'info'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
  }
  return err?.message || 'An unexpected error occurred.';
}

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
            'bg-blue-50 border-blue-200 text-blue-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" /> :
           t.type === 'error' ? <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" /> :
           <ScanLine className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';

interface CartItem {
  id: number;
  name: string;
  unit_price: string;
  quantity: string;
  max_qty: number;
}

interface Customer {
  type: 'student' | 'staff';
  id: number;
  name: string;
  identifier: string;
  display_class?: string;
  wallet_balance: number;
  image_url?: string | null;
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function POSPage() {
  const { hasPermission, user } = useAuth();

  const [shops, setShops] = useState<InventoryLocation[]>([]);
  const [activeShop, setActiveShop] = useState<InventoryLocation | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);

  const [topItems, setTopItems] = useState<InventoryItemList[]>([]);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [isSearchingCust, setIsSearchingCust] = useState(false);

  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<InventoryItemList[]>([]);
  const [showItemResults, setShowItemResults] = useState(false);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Fingerprint state
  const fpApiRef = useRef<any>(null);
  const fpActiveRef = useRef(false);
  const isCapturingRef = useRef(false);
  const isCancellingRef = useRef(false);
  const justIdentifiedRef = useRef(false);
  const [fpSdkReady, setFpSdkReady] = useState(false);
  const [fpActive, setFpActive] = useState(false);
  const [fpStatus, setFpStatus] = useState({ text: 'Initializing...', detail: 'Checking scanner', color: 'text-orange-500' });
  const [showFpOverlay, setShowFpOverlay] = useState(false);

  const canSell = user?.is_superuser || hasPermission('inventory.add_salemodel');

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // 1. Load Shops & Top Items
  useEffect(() => {
    inventoryLocationAPI.list().then(data => {
      const shopLocs = (Array.isArray(data) ? data : []).filter((l: InventoryLocation) => l.location_type === 'shop');
      setShops(shopLocs);
      const savedShopId = localStorage.getItem('pos_shop_id');
      if (savedShopId) {
        const found = shopLocs.find((s: InventoryLocation) => s.id === Number(savedShopId));
        if (found) { setActiveShop(found); return; }
      }
      if (shopLocs.length === 1) {
        setActiveShop(shopLocs[0]);
        localStorage.setItem('pos_shop_id', String(shopLocs[0].id));
      } else if (shopLocs.length > 1) {
        setShowShopModal(true);
      }
    });

    inventoryReportAPI.get({ type: 'top_selling' }).then(res => {
      const data = (res as any)?.data || res;
      if (Array.isArray(data) && data.length > 0) {
        setTopItems(data);
      } else {
        inventoryItemAPI.list({ page_size: 10, is_active: true, location: activeShop?.id }).then(r => setTopItems(r?.results || []));
      }
    }).catch(() => {
      inventoryItemAPI.list({ page_size: 10, is_active: true, location: activeShop?.id }).then(r => setTopItems(r?.results || []));
    });
  }, []);

  // 2. Customer Search — fixed: data is at results.data, fields are full_name, canteen_balance, wallet_balance
  useEffect(() => {
    if (custSearch.trim().length < 2) { setCustResults([]); return; }
    setIsSearchingCust(true);
    const timer = setTimeout(async () => {
      try {
        const [stdRes, staffRes] = await Promise.all([
          studentsAPI.list({ search: custSearch, status: 'active', page_size: 5 }),
          staffAPI.list({ search: custSearch, status: 'active', page_size: 5 })
        ]);

        // Data is nested at results.data
        const stdData: any[] = (stdRes as any)?.results?.data || (stdRes as any)?.data || [];
        const staffData: any[] = (staffRes as any)?.results?.data || (staffRes as any)?.data || [];

        const formatted: Customer[] = [
          ...stdData.map((s: any) => ({
            type: 'student' as const,
            id: s.id,
            name: s.full_name,
            identifier: s.registration_number,
            display_class: `${s.current_class_name || ''} ${s.current_class_section_name || ''}`.trim(),
            wallet_balance: parseFloat(s.canteen_balance) || 0,
            image_url: s.image_url,
          })),
          ...staffData.map((s: any) => ({
            type: 'staff' as const,
            id: s.id,
            name: s.full_name,
            identifier: s.staff_id,
            wallet_balance: parseFloat(s.wallet_balance) || 0,
            image_url: s.image_url || null,
          })),
        ];
        setCustResults(formatted);
      } catch (err) {
        console.error('Customer search error:', err);
      } finally {
        setIsSearchingCust(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [custSearch]);

  // 3. Item Search
  useEffect(() => {
    if (itemSearch.trim().length < 2) { setItemResults([]); setShowItemResults(false); return; }
    setIsSearchingItems(true);
    const timer = setTimeout(async () => {
      try {
          const res = await inventoryItemAPI.list({ search: itemSearch, page_size: 10, is_active: true, location: activeShop?.id });
        setItemResults(res?.results || []);
        setShowItemResults(true);
      } catch (err) {} finally { setIsSearchingItems(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  // 4. Global Barcode Scanner — mirrors HTML version logic
  useEffect(() => {
    let buffer = '';
    let barcodeTimer: ReturnType<typeof setTimeout> | null = null;
    let lastKeypressTime = 0;
    const BARCODE_CHAR_DELAY = 50;
    const BARCODE_MIN_LENGTH = 3;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || (target as any).isContentEditable) return;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeypressTime;

      if (e.key === 'Enter') {
        if (buffer.length >= BARCODE_MIN_LENGTH) {
          e.preventDefault();
          handleBarcodeScan(buffer);
          buffer = '';
        }
        lastKeypressTime = currentTime;
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (timeDiff < BARCODE_CHAR_DELAY && buffer.length > 0) {
          if (target.tagName === 'INPUT') e.preventDefault();
          buffer += e.key;
          if (barcodeTimer) clearTimeout(barcodeTimer);
          barcodeTimer = setTimeout(() => {
            if (buffer.length >= BARCODE_MIN_LENGTH) handleBarcodeScan(buffer);
            buffer = '';
          }, 100);
        } else {
          buffer = e.key;
        }
        lastKeypressTime = currentTime;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const res = await inventoryItemAPI.list({ search: barcode, page_size: 5 });
      const foundItems: InventoryItemList[] = res?.results || [];
      const exactMatch = foundItems.find((i: InventoryItemList) => i.barcode === barcode);
      if (exactMatch) {
        addToCart(exactMatch);
        showToast('success', `Item added: ${exactMatch.name}`);
      } else {
        showToast('error', `Barcode not found: ${barcode}`);
      }
    } catch (err) {
      showToast('error', 'Error processing barcode');
    }
  };

  const getShopStock = (item: InventoryItemList) =>
  item.location_quantity != null ? Number(item.location_quantity) : 0;

  const addToCart = (item: InventoryItemList) => {
    if (cart.some(c => c.id === item.id)) { showToast('error', `'${titleCase(item.name)}' is already in the cart.`); return; }
    const stock = getShopStock(item);
    if (stock <= 0) { showToast('error', `'${titleCase(item.name)}' is out of stock.`); return; }
    setCart(prev => [...prev, { id: item.id, name: item.name, unit_price: item.current_selling_price, quantity: '1', max_qty: stock }]);
    setItemSearch(''); setItemResults([]); setShowItemResults(false);
  };

  const handleQtyChange = (id: number, value: string) => {
    const numVal = Number(value);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if (numVal > item.max_qty) {
          showToast('error', `Only ${item.max_qty} units available.`);
          return { ...item, quantity: String(item.max_qty) };
        }
        return { ...item, quantity: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (id: number) => setCart(prev => prev.filter(item => item.id !== id));

  const selectCustomer = (c: Customer) => {
    setCustomer(c);
    setCustSearch(c.name);
    setCustResults([]);
    if (c.type === 'student') setPaymentMethod('student_wallet');
    if (c.type === 'staff') setPaymentMethod('staff_wallet');
  };

  const clearCustomer = () => {
    setCustomer(null);
    setCustSearch('');
    setPaymentMethod('cash');
  };

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
  const grandTotal = Math.max(0, subtotal - Number(discount || 0));

  // ─── Fingerprint Logic — mirrors HTML version exactly ──────────────────────

  // Called by Next.js Script onReady — both SDK scripts are loaded at this point
  const handleFpSdkReady = () => {
    setFpSdkReady(true);
  };

  const initFingerprintAPI = useCallback(() => {
    try {
      const FP = (window as any).Fingerprint;
      if (!FP || !FP.WebApi) throw new Error('DigitalPersona SDK not loaded');

      const api = new FP.WebApi();

      api.onCommunicationFailed = () =>
        setFpStatus({ text: 'Connection Failed', detail: 'Check if DP agent is running', color: 'text-red-500' });

      api.onDeviceConnected = () =>
        setFpStatus({ text: 'Scanner Ready', detail: 'Ready to identify', color: 'text-green-500' });

      api.onDeviceDisconnected = () =>
        setFpStatus({ text: 'Scanner Disconnected', detail: 'Reconnect the device', color: 'text-red-500' });

      api.onAcquisitionStarted = () => {
        if (justIdentifiedRef.current) {
          justIdentifiedRef.current = false;
          return;
        }
        setShowFpOverlay(true);
        setFpStatus({ text: 'Scanning...', detail: 'Hold finger steady', color: 'text-blue-500' });
      };

      api.onAcquisitionStopped = () => {
        setShowFpOverlay(false);
        if (fpActiveRef.current && !isCapturingRef.current && !isCancellingRef.current) {
          setFpStatus({ text: 'Scanner Active', detail: 'Place finger to identify', color: 'text-blue-500' });
        }
        isCancellingRef.current = false;
      };

      api.onSamplesAcquired = async (event: any) => {
        try {
          const samples = JSON.parse(event.samples);
          if (!samples || samples.length === 0) throw new Error('No samples captured');
          const fmd = samples[0];
          const probeData = typeof fmd === 'object' ? fmd.Data : fmd;
          if (!probeData) throw new Error('No FMD Data in sample');

          setShowFpOverlay(false);
          setFpStatus({ text: 'Identifying...', detail: 'Please wait', color: 'text-blue-500' });

          const response = await api.post('/api/students/identify-fingerprint/', { fingerprint_data: probeData });
          const data = response.data;

          if (!data.success) throw new Error(data.message || 'Not identified');

          selectCustomer({
            type: 'student',
            id: data.student.id,
            name: data.student.name,
            identifier: data.student.reg_number,
            display_class: `${data.student.student_class} ${data.student.class_section}`.trim(),
            wallet_balance: parseFloat(data.student.wallet_balance) || 0,
            image_url: data.student.image_url,
          });

          showToast('success', `Identified: ${data.student.name}`);
          setFpStatus({ text: 'Student Identified', detail: data.student.name, color: 'text-green-500' });

          justIdentifiedRef.current = true;
          setTimeout(() => {
            if (fpActiveRef.current) startFingerprintCapture(fpApiRef.current);
          }, 2000);

        } catch (error: any) {
          setShowFpOverlay(false);
          showToast('error', error.message);
          setFpStatus({ text: 'Not Identified', detail: error.message, color: 'text-red-500' });
          setTimeout(() => {
            if (fpActiveRef.current) startFingerprintCapture(fpApiRef.current);
          }, 2000);
        } finally {
          isCapturingRef.current = false;
        }
      };

      api.onQualityReported = (event: any) => {
        console.log('Fingerprint quality:', event.quality);
      };

      api.onErrorOccurred = (event: any) => {
        setFpStatus({ text: 'Scanner Error', detail: event.error?.message || 'Unknown error', color: 'text-red-500' });
        setShowFpOverlay(false);
        isCapturingRef.current = false;
      };

      fpApiRef.current = api;
      return true;
    } catch (e: any) {
      setFpStatus({ text: 'Init Failed', detail: e.message, color: 'text-red-500' });
      return false;
    }
  }, [showToast]);

  const startFingerprintCapture = async (apiInstance: any) => {
    if (isCapturingRef.current || !apiInstance) return;
    try {
      const FP = (window as any).Fingerprint;
      await apiInstance.startAcquisition(FP.SampleFormat.Intermediate);
      isCapturingRef.current = true;
      setFpStatus({ text: 'Scanner Active', detail: 'Place finger to identify', color: 'text-blue-500' });
    } catch (e: any) {
      setFpStatus({ text: 'Start Failed', detail: e.message, color: 'text-red-500' });
    }
  };

  const stopFingerprintCapture = async () => {
    if (!isCapturingRef.current || !fpApiRef.current) return;
    try {
      await fpApiRef.current.stopAcquisition();
    } catch (e) {
      console.error('Stop capture failed:', e);
    } finally {
      isCapturingRef.current = false;
    }
  };

  const handleEnableFingerprint = async () => {
    if (!fpSdkReady) {
      showToast('error', 'Fingerprint SDK not loaded yet. Please wait.');
      return;
    }
    const ok = initFingerprintAPI();
    if (ok) {
      fpActiveRef.current = true;
      setFpActive(true);
      await startFingerprintCapture(fpApiRef.current);
    } else {
      showToast('error', 'Failed to initialize fingerprint scanner');
    }
  };

  const handleStopFingerprint = async () => {
    fpActiveRef.current = false;
    setFpActive(false);
    await stopFingerprintCapture();
    setShowFpOverlay(false);
    setFpStatus({ text: 'Disabled', detail: 'Scanner off', color: 'text-slate-400' });
  };

  const cancelFingerprintScan = () => {
    setShowFpOverlay(false);
    isCancellingRef.current = true;
    stopFingerprintCapture();
    setFpStatus({ text: 'Scan Cancelled', detail: 'Click to scan again', color: 'text-slate-500' });
  };

  // ─── Sale Submission ───────────────────────────────────────────────────────
  const handleSale = async () => {
    if (!activeShop) { showToast('error', 'Please select a shop first.'); return; }
    if (cart.length === 0) { showToast('error', 'Cart is empty.'); return; }
    if (paymentMethod === 'student_wallet') {
      if (!customer || customer.type !== 'student') { showToast('error', 'Select a student for wallet payment.'); return; }
      if (grandTotal > customer.wallet_balance) {
        showToast('error', `Insufficient funds. Available: ₦${customer.wallet_balance.toFixed(2)}, Required: ₦${grandTotal.toFixed(2)}`);
        return;
      }
    }
    if (paymentMethod === 'staff_wallet') {
      if (!customer || customer.type !== 'staff') { showToast('error', 'Select a staff for wallet payment.'); return; }
      if (grandTotal > customer.wallet_balance) {
        showToast('error', `Insufficient funds. Available: ₦${customer.wallet_balance.toFixed(2)}, Required: ₦${grandTotal.toFixed(2)}`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: SalePayload = {
        location: activeShop.id,
        customer: customer?.type === 'student' ? customer.id : null,
        staff_customer: customer?.type === 'staff' ? customer.id : null,
        discount: discount || '0',
        payment_method: paymentMethod as any,
        items: cart.map(c => ({ item: c.id, quantity: c.quantity, unit_price: c.unit_price }))
      };
      await saleAPI.create(payload);
      showToast('success', 'Sale processed successfully!');
      setCart([]); setDiscount('0'); clearCustomer();
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSaving(false);
    }
  };

  if (!canSell) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="font-bold text-slate-800">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to process sales.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-10">

      {/* DigitalPersona SDK — loaded once, passively. onReady gates initialization. */}
      <Script
        src="https://unpkg.com/@digitalpersona/websdk@v1"
        strategy="afterInteractive"
      />
      <Script
        src="https://unpkg.com/@digitalpersona/fingerprint@v1"
        strategy="afterInteractive"
        onReady={handleFpSdkReady}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Shop Selection Modal */}
      {showShopModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Select Shop Location</h3>
            <p className="text-sm text-slate-400 mb-4">Please select which shop you are selling from. This will be saved for next time.</p>
            <div className="space-y-2">
              {shops.map(shop => (
                <button key={shop.id} onClick={() => {
                  setActiveShop(shop);
                  localStorage.setItem('pos_shop_id', String(shop.id));
                  setShowShopModal(false);
                }} className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-left">
                  <Store className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-semibold text-slate-800">{shop.name}</p>
                    <p className="text-xs text-slate-400">{shop.code}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Fingerprint Overlay */}
      {showFpOverlay && (
        <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl text-center max-w-sm">
            <Fingerprint className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-pulse" />
            <h4 className="text-lg font-bold text-slate-900">Place Finger on Scanner</h4>
            <p className="text-sm text-slate-500 mt-1">Identifying student...</p>
            <button onClick={cancelFingerprintScan} className="mt-4 px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            Point of Sale
          </h1>
          {activeShop && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Store className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-700">{activeShop.name}</span>
              {shops.length > 1 && (
                <button onClick={() => setShowShopModal(true)} className="text-xs text-blue-600 hover:underline ml-1">Change</button>
              )}
            </div>
          )}
        </div>

        {/* Fingerprint Toggle Button */}
        <button
          onClick={fpActive ? handleStopFingerprint : handleEnableFingerprint}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border
            ${fpActive
              ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
              : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
            }`}
        >
          <Fingerprint className={`h-3.5 w-3.5 ${fpActive ? 'animate-pulse' : ''}`} />
          {fpActive ? (
            <span className={fpStatus.color}>{fpStatus.text}</span>
          ) : (
            'Enable Scanner'
          )}
        </button>
      </div>

      {/* Fingerprint Status Bar — visible when active */}
      {fpActive && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-100 rounded-xl shadow-sm">
          <Fingerprint className={`h-4 w-4 flex-shrink-0 ${fpStatus.color}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${fpStatus.color}`}>{fpStatus.text}</p>
            <p className="text-[10px] text-slate-400">{fpStatus.detail}</p>
          </div>
          <button onClick={handleStopFingerprint} className="text-[10px] font-semibold text-red-500 hover:text-red-700 px-2 py-1 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
            Stop Scanner
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Customer & Top Items */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={custSearch}
                  onChange={e => setCustSearch(e.target.value)}
                  placeholder="Search Customer (Optional)"
                  className={`${inputCls} pl-9 pr-8`}
                />
                {isSearchingCust && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
                {custResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-slate-100 shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {custResults.map(c => (
                      <button
                        key={`${c.type}-${c.id}`}
                        type="button"
                        onClick={() => selectCustomer(c)}
                        className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-slate-800 truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {c.identifier} • {c.display_class || c.type}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${c.type === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {c.type}
                          </span>
                          <span className="text-[9px] text-emerald-600 font-semibold">₦{c.wallet_balance.toFixed(2)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customer && (
                <button onClick={clearCustomer} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {customer && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                <img
                  src={customer.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name)}&background=0D8ABC&color=fff`}
                  alt={customer.name}
                  className="w-9 h-9 rounded-full object-cover border border-white shadow-sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">{customer.name}</p>
                  <p className="text-[10px] text-slate-500">{customer.identifier}</p>
                  {customer.display_class && (
                    <p className="text-[10px] text-slate-400">{customer.display_class}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-slate-400 uppercase">{customer.type === 'student' ? 'Canteen Wallet' : 'Wallet'}</p>
                  <p className="text-xs font-bold text-emerald-600">₦{customer.wallet_balance.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Top Items */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-400" /> Top Selling Items
              </p>
              <div className="flex flex-wrap gap-1.5">
                {topItems.map(item => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                  >
                    {titleCase(item.name)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Item Search & Cart */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  onFocus={() => itemResults.length > 0 && setShowItemResults(true)}
                  onBlur={() => setTimeout(() => setShowItemResults(false), 200)}
                  placeholder="Search item or scan barcode..."
                  className={`${inputCls} pl-9 pr-8`}
                />
                {isSearchingItems && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
                {showItemResults && !isSearchingItems && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-slate-100 shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {itemResults.length > 0 ? itemResults.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={() => addToCart(item)}
                        className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-slate-800 truncate">{titleCase(item.name)}</p>
                          <p className="text-[10px] text-slate-400 truncate">{item.barcode || 'No barcode'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs font-bold text-slate-700">₦{Number(item.current_selling_price).toLocaleString()}</p>
                          <p className="text-[9px] text-slate-400">Stock: {Number(item.total_quantity).toFixed(0)}</p>
                        </div>
                      </button>
                    )) : <div className="p-3 text-center text-xs text-slate-400">No items found.</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left font-semibold text-slate-500 p-2 w-8"></th>
                    <th className="text-left font-semibold text-slate-500 p-2">Item</th>
                    <th className="text-right font-semibold text-slate-500 p-2 w-24">Price (₦)</th>
                    <th className="text-center font-semibold text-slate-500 p-2 w-20">Qty</th>
                    <th className="text-right font-semibold text-slate-500 p-2 w-28">Total (₦)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.map(item => (
                    <tr key={item.id}>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td className="p-2">
                        <p title={titleCase(item.name)} className="font-medium text-slate-800 text-xs truncate">{titleCase(item.name)}</p>
                      </td>
                      <td className="p-2 text-right text-slate-600 font-medium">{Number(item.unit_price).toLocaleString()}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          max={item.max_qty}
                          value={item.quantity}
                          onChange={e => handleQtyChange(item.id, e.target.value)}
                          className="w-full px-1.5 py-1 border border-slate-200 rounded text-center text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </td>
                      <td className="p-2 text-right font-bold text-slate-800">
                        {(Number(item.quantity) * Number(item.unit_price)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-xs">
                        Cart is empty. Add items to place order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Checkout Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden sticky top-4">
            <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-violet-500" />
              <h3 className="text-sm font-bold text-slate-800">Checkout</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-slate-800">₦{subtotal.toLocaleString()}</span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Discount (₦)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                  className={`${inputCls} py-1.5 text-xs`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className={`${inputCls} py-1.5 text-xs`}
                >
                  <option value="cash">Cash</option>
                  <option value="pos">POS</option>
                  <option value="student_wallet" disabled={!customer || customer.type !== 'student'}>
                    Student Wallet {customer?.type === 'student' ? `(₦${customer.wallet_balance.toFixed(2)})` : ''}
                  </option>
                  <option value="staff_wallet" disabled={!customer || customer.type !== 'staff'}>
                    Staff Wallet {customer?.type === 'staff' ? `(₦${customer.wallet_balance.toFixed(2)})` : ''}
                  </option>
                </select>
              </div>

              {/* Insufficient funds warning */}
              {(paymentMethod === 'student_wallet' || paymentMethod === 'staff_wallet') && customer && grandTotal > customer.wallet_balance && (
                <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-[10px] text-red-600 font-medium">Insufficient balance</p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-800">Grand Total</span>
                <span className="text-xl font-extrabold text-blue-600">₦{grandTotal.toLocaleString()}</span>
              </div>

              <button
                onClick={handleSale}
                disabled={isSaving || cart.length === 0 || !activeShop}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm disabled:opacity-50"
              >
                {isSaving
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                  : <><CreditCard className="h-4 w-4" /> Place Order</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}