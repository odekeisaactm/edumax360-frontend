'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import {
  studentsAPI, staffAPI, inventoryItemAPI, inventoryLocationAPI,
  inventoryReportAPI, saleAPI, inventorySettingAPI, shopAccessAPI, schoolInfoAPI
} from '@/lib/api';
import { InventoryLocation, InventoryItemList, SalePayload, InventorySetting, SalePaymentMethod } from '@/lib/types';
import {
  CreditCard, Search, X, Trash2, ScanLine, User, Wallet,
  Loader2, AlertCircle, Check, Store, Star, Fingerprint,
  ShieldOff, Lock, Printer, Building2
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
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

// THE PAGINATION FIX: Bulletproof data extraction
function extractListData(res: any): any[] {
  const data = res?.data || res;
  if (data?.success && Array.isArray(data.data)) return data.data;
  if (data?.results?.data && Array.isArray(data.results.data)) return data.results.data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

function titleCase(str: string): string {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtMoney(amount: string | number | undefined | null): string {
  if (amount == null) return '₦0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₦0.00';
  return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function genIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getImageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 pointer-events-none">
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

// Types for the global Window object
declare global {
  interface Window {
    Fingerprint?: any;
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function POSPage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<InventorySetting | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [assignedShop, setAssignedShop] = useState<InventoryLocation | null>(null);
  const [shopAccessLoading, setShopAccessLoading] = useState(true);
  const [shopAccessDenied, setShopAccessDenied] = useState(false);

  const [shops, setShops] = useState<InventoryLocation[]>([]);
  const [activeShop, setActiveShop] = useState<InventoryLocation | null>(null);
  const [showShopModal, setShowShopModal] = useState(false);

  const [topItems, setTopItems] = useState<InventoryItemList[]>([]);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState<Customer[]>([]);
  const [isSearchingCust, setIsSearchingCust] = useState(false);
  const skipCustSearchRef = useRef(false);

  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<InventoryItemList[]>([]);
  const [showItemResults, setShowItemResults] = useState(false);
  const [isSearchingItems, setIsSearchingItems] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('cash');
  const [isSaving, setIsSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const idempotencyKeyRef = useRef<string>(genIdempotencyKey());

  // Print Overlay State
  const [printThermalSale, setPrintThermalSale] = useState<any | null>(null);
  const [pendingRedirectSale, setPendingRedirectSale] = useState<any | null>(null);

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

  const canSell = user?.is_superuser || hasPermission('inventory.add_inventorysalemodel');
  const isSuperuser = !!user?.is_superuser;

  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Load Scripts and Initialize API sequentially ──
  useEffect(() => {
    let isMounted = true;

    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.async = false; // CRITICAL: Forces sequential script execution
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });

    const initSDK = async () => {
      try {
        await loadScript('https://unpkg.com/@digitalpersona/websdk@v1');
        await loadScript('https://unpkg.com/@digitalpersona/fingerprint@v1');
        if (isMounted) setFpSdkReady(true);
      } catch (e) {
        console.error('SDK Load Error', e);
      }
    };
    initSDK();

    return () => {
      isMounted = false;
      if (isCapturingRef.current && fpApiRef.current) fpApiRef.current.stopAcquisition().catch(console.error);
    };
  }, []);

  // 1. Load Settings
  useEffect(() => {
    inventorySettingAPI.get().then(setSettings).catch(() => showToast('error', 'Could not load POS settings.')).finally(() => setSettingsLoading(false));
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => {});
  }, [showToast]);

  // 2. Load shop assignment
  useEffect(() => {
    if (isSuperuser) { setShopAccessLoading(false); return; }
    shopAccessAPI.myAccess()
      .then(data => {
        if (data?.shop) {
          setAssignedShop({
            id: data.shop, name: data.shop_name || '', code: data.shop_code || '',
            location_type: 'shop', is_active: true, created_at: '', updated_at: '',
          });
        } else {
          setShopAccessDenied(true);
        }
      })
      .catch(() => setShopAccessDenied(true))
      .finally(() => setShopAccessLoading(false));
  }, [isSuperuser]);

  // 3. Load Shops
  useEffect(() => {
    inventoryLocationAPI.list().then(data => {
      const shopLocs = (Array.isArray(data) ? data : []).filter((l: InventoryLocation) => l.location_type === 'shop');
      setShops(shopLocs);

      if (!isSuperuser && assignedShop) {
        const matched = shopLocs.find((s: InventoryLocation) => s.id === assignedShop.id);
        if (matched) setActiveShop(matched);
        return;
      }
      if (isSuperuser) {
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
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperuser, assignedShop]);

  // 3b. Load Top Items
  useEffect(() => {
    if (!activeShop) return;
    inventoryReportAPI.get({ type: 'top_selling', location: activeShop.id } as any).then(res => {
      const data = (res as any)?.data || res;
      if (Array.isArray(data) && data.length > 0 && data.some((d: any) => d.location_quantity != null)) {
        setTopItems(data);
      } else {
        inventoryItemAPI.list({ page_size: 10, is_active: true, location: activeShop.id }).then(r => setTopItems(r?.results || []));
      }
    }).catch(() => {
      inventoryItemAPI.list({ page_size: 10, is_active: true, location: activeShop.id }).then(r => setTopItems(r?.results || []));
    });
  }, [activeShop]);

  // 4. Customer Search with Bulletproof Extraction
  useEffect(() => {
    if (skipCustSearchRef.current) { skipCustSearchRef.current = false; return; }
    if (custSearch.trim().length < 2) { setCustResults([]); return; }

    setIsSearchingCust(true);
    const timer = setTimeout(async () => {
      try {
        const [stdRes, staffRes] = await Promise.all([
          studentsAPI.list({ search: custSearch, status: 'active', page_size: 5 } as any),
          staffAPI.list({ search: custSearch, status: 'active', page_size: 5 } as any)
        ]);

        const stdData = extractListData(stdRes);
        const staffData = extractListData(staffRes);

        const formatted: Customer[] = [
          ...stdData.map((s: any) => ({
            type: 'student' as const,
            id: s.id,
            name: s.full_name || `${s.first_name} ${s.last_name}`,
            identifier: s.registration_number,
            display_class: `${s.current_class_name || ''} ${s.current_class_section_name || ''}`.trim(),
            wallet_balance: parseFloat(s.canteen_balance) || 0,
            image_url: s.image_url,
          })),
          ...staffData.map((s: any) => ({
            type: 'staff' as const,
            id: s.id,
            name: s.full_name || `${s.first_name} ${s.last_name}`,
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

  // 5. Item Search
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
  }, [itemSearch, activeShop?.id]);

  // 6. Global Barcode Scanner
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShop]);

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const res = await inventoryItemAPI.list({ search: barcode, page_size: 5, location: activeShop?.id });
      const foundItems: InventoryItemList[] = res?.results || [];
      const exactMatch = foundItems.find((i: InventoryItemList) => i.barcode === barcode);
      if (exactMatch) {
        addToCart(exactMatch);
        showToast('success', `Item added: ${exactMatch.name}`);
      } else {
        showToast('error', `Barcode not found in stock: ${barcode}`);
      }
    } catch (err) {
      showToast('error', 'Error processing barcode');
    }
  };

  const getShopStock = (item: InventoryItemList) => item.location_quantity != null ? Number(item.location_quantity) : 0;

  // ── Spending power ──
  const getSpendingPower = useCallback((cust: Customer | null): number | null => {
    if (!cust || !settings) return null;
    if (cust.type === 'student') {
      const maxDebt = settings.allow_student_debt ? Number(settings.max_student_debt || 0) : 0;
      return cust.wallet_balance + maxDebt;
    }
    const maxDebt = settings.allow_staff_debt ? Number(settings.max_staff_debt || 0) : 0;
    return cust.wallet_balance + maxDebt;
  }, [settings]);

  const customerSpendingPower = getSpendingPower(customer);
  const customerHasNoSpendingPower = customer !== null && customerSpendingPower !== null && customerSpendingPower <= 0;

  const addToCart = (item: InventoryItemList) => {
    if (customerHasNoSpendingPower && (paymentMethod === 'student_wallet' || paymentMethod === 'staff_wallet')) {
      showToast('error', `${customer?.name} has no spending power left. Switch customer or payment method first.`);
      return;
    }
    if (cart.some(c => c.id === item.id)) { showToast('error', `'${titleCase(item.name)}' is already in the cart.`); return; }
    const stock = getShopStock(item);
    if (stock <= 0) { showToast('error', `'${titleCase(item.name)}' is out of stock.`); return; }
    setCart(prev => [...prev, { id: item.id, name: item.name, unit_price: item.current_selling_price, quantity: '1', max_qty: stock }]);
    setItemSearch(''); setItemResults([]); setShowItemResults(false);
  };

  const handleQtyChange = (id: number, value: string) => {
    const numVal = Number(value);
    const item = cart.find(c => c.id === id);
    if (item && numVal > item.max_qty) {
      showToast('error', `Only ${item.max_qty} units available.`);
      setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: String(c.max_qty) } : c));
      return;
    }
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: value } : c));
  };

  const handleRemoveItem = (id: number) => setCart(prev => prev.filter(item => item.id !== id));

  const selectCustomer = (c: Customer) => {
    setCustomer(c);
    skipCustSearchRef.current = true;
    setCustSearch(c.name);
    setCustResults([]);
    if (c.type === 'student') setPaymentMethod('student_wallet');
    if (c.type === 'staff') setPaymentMethod('staff_wallet');
  };

  const clearCustomer = () => {
    setCustomer(null);
    setCustSearch('');
    setPaymentMethod(settings?.allow_cash ? 'cash' : (settings?.allow_pos ? 'pos' : 'cash'));
  };

  const subtotal = cart.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);
  const effectiveDiscount = settings?.allow_discount ? Number(discount || 0) : 0;
  const grandTotal = Math.max(0, subtotal - effectiveDiscount);

  const isWalkin = !customer;
  const paymentOptions: Array<{ value: SalePaymentMethod; label: string; disabled: boolean; reason?: string }> = [
    { value: 'cash', label: 'Cash', disabled: !settings?.allow_cash, reason: !settings?.allow_cash ? 'Disabled' : undefined },
    { value: 'pos', label: 'POS / Card', disabled: !settings?.allow_pos, reason: !settings?.allow_pos ? 'Disabled' : undefined },
    { value: 'student_wallet', label: `Student Wallet`, disabled: !customer || customer.type !== 'student', reason: !customer || customer.type !== 'student' ? 'Select student' : undefined },
    { value: 'staff_wallet', label: `Staff Wallet`, disabled: !customer || customer.type !== 'staff', reason: !customer || customer.type !== 'staff' ? 'Select staff' : undefined },
  ];

  useEffect(() => {
    if (!settings) return;
    const current = paymentOptions.find(p => p.value === paymentMethod);
    if (current?.disabled) {
      const firstValid = paymentOptions.find(p => !p.disabled);
      if (firstValid) setPaymentMethod(firstValid.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, customer]);

  // ── Fingerprint Logic ──────────────────────────────────────────────────────
  const initFingerprintAPI = useCallback(() => {
    try {
      const FP = (window as any).Fingerprint;
      if (!FP || !FP.WebApi) throw new Error('SDK not loaded');

      const fpApi = new FP.WebApi();

      fpApi.onCommunicationFailed = () => setFpStatus({ text: 'Connection Failed', detail: 'Check DP agent', color: 'text-red-500' });
      fpApi.onDeviceConnected = () => setFpStatus({ text: 'Scanner Ready', detail: 'Ready to identify', color: 'text-green-500' });
      fpApi.onDeviceDisconnected = () => setFpStatus({ text: 'Scanner Disconnected', detail: 'Reconnect device', color: 'text-red-500' });

      fpApi.onAcquisitionStarted = () => {
        if (justIdentifiedRef.current) { justIdentifiedRef.current = false; return; }
        setShowFpOverlay(true);
        setFpStatus({ text: 'Scanning...', detail: 'Hold finger steady', color: 'text-blue-500' });
      };

      fpApi.onAcquisitionStopped = () => {
        setShowFpOverlay(false);
        if (fpActiveRef.current && !isCapturingRef.current && !isCancellingRef.current) {
          setFpStatus({ text: 'Scanner Active', detail: 'Place finger to identify', color: 'text-blue-500' });
        }
        isCancellingRef.current = false;
      };

      fpApi.onSamplesAcquired = async (event: any) => {
        try {
          const samples = JSON.parse(event.samples);
          if (!samples || samples.length === 0) throw new Error('No samples captured');
          const fmd = samples[0];
          const probeData = typeof fmd === 'object' ? fmd.Data : fmd;
          if (!probeData) throw new Error('No FMD Data in sample');

          setShowFpOverlay(false);
          setFpStatus({ text: 'Identifying...', detail: 'Please wait', color: 'text-blue-500' });

          const response = await api.post('/api/student/identify-fingerprint/', { fingerprint_data: probeData });
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
          setFpStatus({ text: 'Identified', detail: data.student.name, color: 'text-green-500' });

          justIdentifiedRef.current = true;
          setTimeout(() => { if (fpActiveRef.current) startFingerprintCapture(fpApiRef.current); }, 2000);

        } catch (error: any) {
          setShowFpOverlay(false);
          showToast('error', error.message);
          setFpStatus({ text: 'Not Identified', detail: error.message, color: 'text-red-500' });
          setTimeout(() => { if (fpActiveRef.current) startFingerprintCapture(fpApiRef.current); }, 2000);
        } finally {
          isCapturingRef.current = false;
        }
      };

      fpApi.onErrorOccurred = (event: any) => {
        setFpStatus({ text: 'Scanner Error', detail: event.error?.message || 'Unknown error', color: 'text-red-500' });
        setShowFpOverlay(false);
        isCapturingRef.current = false;
      };

      fpApiRef.current = fpApi;
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
      await apiInstance.startAcquisition(FP.SampleFormat.PngImage);
      isCapturingRef.current = true;
      setFpStatus({ text: 'Scanner Active', detail: 'Place finger to identify', color: 'text-blue-500' });
    } catch (e: any) {
      setFpStatus({ text: 'Start Failed', detail: e.message, color: 'text-red-500' });
    }
  };

  const stopFingerprintCapture = async () => {
    if (!isCapturingRef.current || !fpApiRef.current) return;
    try { await fpApiRef.current.stopAcquisition(); } catch (e) {} finally { isCapturingRef.current = false; }
  };

  const handleEnableFingerprint = async () => {
    if (!fpSdkReady) { showToast('error', 'SDK not loaded yet. Please wait.'); return; }
    if (initFingerprintAPI()) {
      fpActiveRef.current = true; setFpActive(true);
      await startFingerprintCapture(fpApiRef.current);
    } else {
      showToast('error', 'Failed to initialize scanner');
    }
  };

  const handleStopFingerprint = async () => {
    fpActiveRef.current = false; setFpActive(false);
    await stopFingerprintCapture();
    setShowFpOverlay(false);
    setFpStatus({ text: 'Disabled', detail: 'Scanner off', color: 'text-slate-400' });
  };

  // ── Auto-Print & Redirect Flow ─────────────────────────────────────────────

  const handlePostSaleRedirect = (sale: any) => {
    const target = settings?.default_sale_redirect || 'new_sale';
    if (target === 'index') router.push('/dashboard/staff/inventory/sales');
    else if (target === 'detail') router.push(`/dashboard/staff/inventory/sales/${sale.id}`);
    // 'new_sale' = stay here
  };

  // Trigger window.print() once the thermal DOM overlay renders
  useEffect(() => {
    if (printThermalSale) {
      const timer = setTimeout(() => { window.print(); }, 150);
      return () => clearTimeout(timer);
    }
  }, [printThermalSale]);

  // Clean up print overlay and route user after print dialog closes
  useEffect(() => {
    const handleAfterPrint = () => {
      setPrintThermalSale(null);
      if (pendingRedirectSale) {
        handlePostSaleRedirect(pendingRedirectSale);
        setPendingRedirectSale(null);
      }
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRedirectSale]);

  // ── Sale Submission ────────────────────────────────────────────────────────
  const handleSale = async () => {
    if (!activeShop) { showToast('error', 'Select a shop first.'); return; }
    if (cart.length === 0) { showToast('error', 'Cart is empty.'); return; }
    if (isWalkin && settings && !settings.allow_walkin_sale) {
      showToast('error', 'Walk-in sales disabled. Attach a customer.'); return;
    }
    if ((paymentMethod === 'student_wallet' || paymentMethod === 'staff_wallet') && customerHasNoSpendingPower) {
      showToast('error', `Insufficient funds (Req: ₦${grandTotal.toFixed(2)}).`); return;
    }

    setIsSaving(true);
    try {
      const payload: SalePayload & { idempotency_key?: string } = {
        location: activeShop.id,
        customer: customer?.type === 'student' ? customer.id : null,
        staff_customer: customer?.type === 'staff' ? customer.id : null,
        discount: String(effectiveDiscount || '0'),
        payment_method: paymentMethod,
        items: cart.map(c => ({ item: c.id, quantity: c.quantity, unit_price: c.unit_price })),
        idempotency_key: idempotencyKeyRef.current,
      };
      const sale = await saleAPI.create(payload);
      showToast('success', 'Sale processed successfully!');

      setCart([]); setDiscount('0'); clearCustomer();
      idempotencyKeyRef.current = genIdempotencyKey(); // fresh key

      if (settings?.auto_print_receipt) {
        setPendingRedirectSale(sale); // Queue the redirect
        setPrintThermalSale(sale);    // Mount the print DOM (which fires window.print())
      } else {
        handlePostSaleRedirect(sale);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Access Gates ─────────────────────────────────────────────────────────────
  if (!canSell) return <div className="p-16 text-center font-bold text-red-600">Access Denied</div>;
  if (settingsLoading || shopAccessLoading) return <div className="p-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" /></div>;
  if (!isSuperuser && shopAccessDenied) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-amber-100 p-8 space-y-3">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto"><Lock className="h-7 w-7 text-amber-500" /></div>
          <h3 className="text-lg font-bold text-slate-900">No Shop Assigned</h3>
          <p className="text-sm text-slate-500">Contact an administrator to get assigned to a POS shop.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-10">

      {/* Print CSS Scope */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #receipt-print-area, #receipt-print-area * { visibility: visible; }
          #receipt-print-area { position: fixed; inset: 0; width: 100%; margin: 0; box-shadow: none !important; border-radius: 0 !important; max-height: none !important; }
        }
      `}} />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Shop Selection Modal */}
      {isSuperuser && showShopModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Select Shop Location</h3>
            <div className="space-y-2 mt-4">
              {shops.map(shop => (
                <button key={shop.id} onClick={() => { setActiveShop(shop); localStorage.setItem('pos_shop_id', String(shop.id)); setShowShopModal(false); }} className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors text-left">
                  <Store className="h-5 w-5 text-blue-500" />
                  <div><p className="font-semibold text-slate-800">{shop.name}</p><p className="text-xs text-slate-400">{shop.code}</p></div>
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
            <button onClick={() => { setShowFpOverlay(false); stopFingerprintCapture(); }} className="mt-4 px-4 py-2 border rounded-xl hover:bg-slate-50">Cancel</button>
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
              {isSuperuser && shops.length > 1 && <button onClick={() => setShowShopModal(true)} className="text-xs text-blue-600 hover:underline ml-1">Change</button>}
            </div>
          )}
        </div>
        <button onClick={fpActive ? handleStopFingerprint : handleEnableFingerprint} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${fpActive ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'}`}>
          <Fingerprint className={`h-3.5 w-3.5 ${fpActive ? 'animate-pulse' : ''}`} />
          {fpActive ? <span className={fpStatus.color}>{fpStatus.text}</span> : 'Enable Scanner'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-4">

          {/* Customer & Top Items */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder={settings?.allow_walkin_sale ? "Search Customer (Optional)" : "Search Customer (Required)"} className={`${inputCls} pl-9 pr-8`} />
                {isSearchingCust && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
                {custResults.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white rounded-lg border border-slate-100 shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {custResults.map(c => (
                      <button key={`${c.type}-${c.id}`} type="button" onMouseDown={() => selectCustomer(c)} className="w-full flex items-center justify-between gap-2 p-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0">
                        <div className="min-w-0"><p className="font-semibold text-xs text-slate-800 truncate">{c.name}</p><p className="text-[10px] text-slate-400 truncate">{c.identifier} • {c.display_class || c.type}</p></div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0"><span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${c.type === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{c.type}</span><span className={`text-[9px] font-semibold ${c.wallet_balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>₦{c.wallet_balance.toFixed(2)}</span></div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customer && <button onClick={clearCustomer} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="h-4 w-4" /></button>}
            </div>

            {customer && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center gap-3">
                <img src={customer.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name)}&background=0D8ABC&color=fff`} alt={customer.name} className="w-9 h-9 rounded-full object-cover border border-white shadow-sm" />
                <div className="flex-1 min-w-0"><p className="font-bold text-xs text-slate-900 truncate">{customer.name}</p><p className="text-[10px] text-slate-500">{customer.identifier}</p></div>
                <div className="text-right"><p className="text-[9px] text-slate-400 uppercase">{customer.type === 'student' ? 'Canteen Wallet' : 'Wallet'}</p><p className={`text-xs font-bold ${customer.wallet_balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>₦{customer.wallet_balance.toFixed(2)}</p></div>
              </div>
            )}

            {customerHasNoSpendingPower && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <ShieldOff className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-700">No spending power available</p>
                  <p className="text-[11px] text-red-600 mt-0.5">Switch customer or use Cash/POS.</p>
                </div>
              </div>
            )}

            {/* Top Items */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" /> Top Selling Items</p>
              <div className="flex flex-wrap gap-1.5">
                {topItems.map(item => (
                  <button key={item.id} onClick={() => addToCart(item)} className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors">
                    {titleCase(item.name)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Item Search & Cart */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={itemSearch} onChange={e => setItemSearch(e.target.value)} onFocus={() => itemResults.length > 0 && setShowItemResults(true)} onBlur={() => setTimeout(() => setShowItemResults(false), 200)} placeholder="Search item or scan barcode..." className={`${inputCls} pl-9 pr-8`} />
              {showItemResults && !isSearchingItems && (
                <div className="absolute z-20 mt-1 left-4 right-4 bg-white rounded-lg border border-slate-100 shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                  {itemResults.map(item => (
                    <button key={item.id} type="button" onMouseDown={() => addToCart(item)} className="w-full flex justify-between p-2.5 hover:bg-slate-50 border-b border-slate-50">
                      <div className="text-left"><p className="font-semibold text-xs text-slate-800">{titleCase(item.name)}</p><p className="text-[10px] text-slate-400">{item.barcode || 'No barcode'}</p></div>
                      <div className="text-right"><p className="text-xs font-bold text-slate-700">₦{Number(item.current_selling_price).toLocaleString()}</p><p className="text-[9px] text-slate-400">Stock: {getShopStock(item)}</p></div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr><th className="p-2 w-8"></th><th className="text-left p-2">Item</th><th className="text-right p-2 w-24">Price (₦)</th><th className="text-center p-2 w-20">Qty</th><th className="text-right p-2 w-28">Total (₦)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {cart.map(item => (
                    <tr key={item.id}>
                      <td className="p-2 text-center"><button type="button" onClick={() => handleRemoveItem(item.id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="h-3.5 w-3.5" /></button></td>
                      <td className="p-2 font-medium text-slate-800 text-xs truncate">{titleCase(item.name)}</td>
                      <td className="p-2 text-right text-slate-600 font-medium">{Number(item.unit_price).toLocaleString()}</td>
                      <td className="p-2"><input type="number" min="1" max={item.max_qty} value={item.quantity} onChange={e => handleQtyChange(item.id, e.target.value)} className="w-full px-1.5 py-1 border border-slate-200 rounded text-center text-xs outline-none" /></td>
                      <td className="p-2 text-right font-bold text-slate-800">{(Number(item.quantity) * Number(item.unit_price)).toLocaleString()}</td>
                    </tr>
                  ))}
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
              <div className="flex justify-between text-xs"><span className="text-slate-500">Subtotal</span><span className="font-semibold text-slate-800">₦{subtotal.toLocaleString()}</span></div>

              {settings?.allow_discount && (
                <div><label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Discount (₦)</label><input type="number" step="0.01" min="0" value={discount} onChange={e => setDiscount(e.target.value)} className={`${inputCls} py-1.5 text-xs`} /></div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Method</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as SalePaymentMethod)} className={`${inputCls} py-1.5 text-xs`}>
                  {paymentOptions.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center"><span className="text-sm font-bold text-slate-800">Grand Total</span><span className="text-xl font-extrabold text-blue-600">₦{grandTotal.toLocaleString()}</span></div>

              <button onClick={handleSale} disabled={isSaving || cart.length === 0 || !activeShop} className="w-full flex justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm disabled:opacity-50">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CreditCard className="h-4 w-4" /> Place Order</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PRINT DOM OVERLAY (THERMAL POS SLIP) ── */}
      {printThermalSale && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-start justify-center py-8 px-4 print:p-0 print:bg-white animate-in fade-in">
          <div id="receipt-print-area" className="bg-white w-full max-w-[300px] rounded-xl overflow-hidden print:w-full">
            <div className="p-4 print:p-2 text-black font-mono" style={{ fontSize: '11px', lineHeight: '1.4' }}>
              <div className="text-center mb-3">
                <h2 className="font-black text-sm uppercase mb-0.5">{schoolInfo?.name || 'SCHOOL NAME'}</h2>
                <p className="text-[9px] mb-0.5">{schoolInfo?.address || ''}</p>
                <p className="text-[9px]">{schoolInfo?.phone || ''}</p>
              </div>
              <div className="border-b border-dashed border-black mb-3"></div>
              <h3 className="font-bold text-xs mb-3 uppercase text-center tracking-widest">SALES RECEIPT</h3>
              <div className="flex justify-between mb-1 text-[10px]"><span>Ref:</span><span className="font-bold">{printThermalSale.transaction_id}</span></div>
              <div className="flex justify-between mb-1 text-[10px]"><span>Date:</span><span>{new Date().toLocaleString()}</span></div>
              <div className="flex justify-between mb-3 text-[10px]"><span>Customer:</span><span className="font-bold">{printThermalSale.customer_name || printThermalSale.staff_customer_name || 'Walk-in'}</span></div>

              <div className="border-b border-dashed border-black mb-3"></div>
              <div className="w-full mb-3 text-[10px]">
                 <div className="flex justify-between font-bold mb-1 border-b border-black pb-1"><span>Item</span><span>Total</span></div>
                 {(printThermalSale.items || []).map((it: any, idx: number) => (
                    <div key={idx} className="flex justify-between mt-1"><span className="pr-2">{it.item_name} <span className="text-[9px]">x{it.quantity}</span></span><span className="font-bold">₦{Number(it.unit_price * it.quantity).toLocaleString()}</span></div>
                 ))}
              </div>

              <div className="border-t border-dashed border-black pt-2 mb-3">
                <div className="flex justify-between mb-1 text-[10px]"><span>Subtotal:</span><span>₦{Number(printThermalSale.subtotal || 0).toLocaleString()}</span></div>
                <div className="flex justify-between mb-1 text-[10px]"><span>Discount:</span><span>₦{Number(printThermalSale.discount || 0).toLocaleString()}</span></div>
                <div className="text-base font-black my-2 flex justify-between items-center border-y-2 border-black py-1.5"><span>TOTAL:</span><span>{fmtMoney(printThermalSale.total_amount)}</span></div>
                <div className="flex justify-between mt-1 text-[10px]"><span>Paid Via:</span><span className="font-bold uppercase">{printThermalSale.payment_method.replace('_', ' ')}</span></div>
              </div>
              <div className="text-center mt-4">
                <p className="text-[10px] font-bold italic mb-1">Thank you for your patronage!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}