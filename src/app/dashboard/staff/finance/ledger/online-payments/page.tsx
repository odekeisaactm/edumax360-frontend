'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { onlinePaymentAPI, gatewayAPI, financeSettingsAPI } from '@/lib/finance.service';
import { studentsAPI, staffAPI, parentsAPI } from '@/lib/api';
import type { OnlinePaymentTransaction, PaymentGatewayConfig, FinanceSettings } from '@/lib/finance.types';
import {
  Activity, Search, X, AlertCircle, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, Filter, Eye, UserCircle, Users,
  CheckCircle2, XCircle, CreditCard, Mail, Clock, Landmark, Code2,
} from 'lucide-react';

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (Array.isArray(d.non_field_errors) && d.non_field_errors.length) return String(d.non_field_errors[0]);
    for (const [key, val] of Object.entries(d)) {
      if (Array.isArray(val) && val.length) return `${key}: ${val[0]}`;
      if (typeof val === 'string') return val;
    }
  }
  return err?.message || 'An error occurred';
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  initiated: 'Initiated',
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
  abandoned: 'Abandoned',
};

const STATUS_STYLES: Record<string, string> = {
  initiated: 'bg-slate-100 text-slate-600 border-slate-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  abandoned: 'bg-gray-50 text-gray-600 border-gray-200',
};

const PAYMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'student_funding', label: 'Student Wallet Funding' },
  { value: 'staff_funding', label: 'Staff Wallet Funding' },
  { value: 'fee_payment', label: 'Fee Payment / Checkout' },
];

/* ────────────────────────────────────────────────────────────────────────
   Person search + select filter — same interaction pattern as the
   student/staff/parent search on the deposit & POS pages, compacted for
   a filter bar. Selecting a person narrows the ledger to just their
   transactions (via person_type/person_id on the API).
   ──────────────────────────────────────────────────────────────────── */
interface SelectedPersonFilter { type: 'student' | 'staff' | 'parent'; id: number; name: string; }

function PersonFilterBox({
  value,
  onSelect,
  onClear,
}: {
  value: SelectedPersonFilter | null;
  onSelect: (p: SelectedPersonFilter) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [personType, setPersonType] = useState<'student' | 'staff' | 'parent'>('student');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const fetcher = personType === 'student' ? studentsAPI.list : personType === 'staff' ? staffAPI.list : parentsAPI.list;
      fetcher({ search: query.trim(), page_size: 8 })
        .then((data: any) => {
          const results = data?.results ?? data?.data ?? data ?? [];
          setResults(Array.isArray(results) ? results : []);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, personType]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePick = (person: any) => {
    const name = toTitleCase(person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim());
    onSelect({ type: personType, id: person.id, name });
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 pl-3 pr-2 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
        <UserCircle className="h-4 w-4 text-indigo-500" />
        <span className="font-semibold text-indigo-800">{value.name}</span>
        <span className="text-[10px] font-bold uppercase text-indigo-400">{value.type}</span>
        <button onClick={onClear} className="text-indigo-400 hover:text-indigo-700">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-w-[220px]" ref={boxRef}>
      <div className="relative">
        <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          placeholder={`Find ${personType}...`}
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1.5 w-72 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="flex gap-1 p-1.5 bg-slate-50 border-b border-slate-100">
            {(['student', 'staff', 'parent'] as const).map(t => (
              <button
                key={t}
                onClick={() => { setPersonType(t); setResults([]); }}
                className={`flex-1 px-2 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  personType === t ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-indigo-500" /></div>
            ) : query.trim().length < 2 ? (
              <p className="text-xs text-slate-400 text-center py-6">Type at least 2 characters</p>
            ) : results.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No {personType}s found</p>
            ) : (
              results.map(p => (
                <button
                  key={p.id}
                  onClick={() => handlePick(p)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <UserCircle className="h-6 w-6 text-slate-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {toTitleCase(p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim())}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      {p.registration_number || p.staff_id || p.mobile || p.email || ''}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Gateway response — normalized card for Paystack / Flutterwave, with
   raw JSON tucked behind a toggle instead of dumped on the accountant.
   ──────────────────────────────────────────────────────────────────── */
function parseGatewayResponse(raw: any, providerHint?: string) {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw.data || raw;

  const hint = (providerHint || '').toLowerCase();
  const provider: 'paystack' | 'flutterwave' | 'unknown' =
    hint.includes('flutterwave') ? 'flutterwave' :
    hint.includes('paystack') ? 'paystack' :
    data.authorization ? 'paystack' :
    data.card ? 'flutterwave' : 'unknown';

  const statusRaw: string = (data.status || raw.status || '').toString();
  const success = raw.status === true || ['success', 'successful', 'completed'].includes(statusRaw.toLowerCase());

  let amount: number | null = null;
  let feeAmount: number | null = null;
  if (provider === 'paystack') {
    amount = data.amount != null ? Number(data.amount) / 100 : null;
    feeAmount = data.fees != null ? Number(data.fees) / 100 : null;
  } else {
    amount = data.amount != null ? Number(data.amount) : (data.charged_amount != null ? Number(data.charged_amount) : null);
    feeAmount = data.app_fee != null ? Number(data.app_fee) : null;
  }

  const currency = data.currency || 'NGN';
  const paidAt = data.paidAt || data.paid_at || data.created_at || data.createdAt || null;
  const channel = data.channel || data.payment_type || null;
  const email = data.customer?.email || null;
  const primaryRef = data.reference || data.tx_ref || null;
  const secondaryRef = data.flw_ref || null;
  const gatewayMessage = data.gateway_response || data.message || null;

  let card: { brand?: string; last4?: string; bank?: string; expiry?: string } | null = null;
  if (data.authorization) {
    card = {
      brand: data.authorization.brand,
      last4: data.authorization.last4,
      bank: data.authorization.bank,
      expiry: data.authorization.exp_month && data.authorization.exp_year
        ? `${data.authorization.exp_month}/${data.authorization.exp_year}` : undefined,
    };
  } else if (data.card) {
    card = {
      brand: data.card.type,
      last4: data.card.last_4digits,
      bank: data.card.issuer,
      expiry: data.card.expiry,
    };
  }

  const timeline: Array<{ time: number; type: string; message: string }> | null =
    Array.isArray(data.log?.history) ? data.log.history : null;

  return { provider, success, statusRaw, amount, feeAmount, currency, paidAt, channel, email, primaryRef, secondaryRef, card, timeline, gatewayMessage, raw };
}

function GatewayResponseCard({ raw, providerHint }: { raw: any; providerHint?: string }) {
  const [showRaw, setShowRaw] = useState(false);
  const parsed = parseGatewayResponse(raw, providerHint);

  if (!parsed) {
    return <p className="text-xs text-slate-400 italic">No gateway response recorded.</p>;
  }

  const { success, statusRaw, amount, feeAmount, currency, paidAt, channel, email, primaryRef, secondaryRef, card, timeline, gatewayMessage } = parsed;

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
        {success ? <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" /> : <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />}
        <div>
          <p className={`text-sm font-bold ${success ? 'text-emerald-800' : 'text-red-800'}`}>
            {success ? 'Payment verified successfully' : `Payment ${statusRaw || 'failed'}`}
          </p>
          {gatewayMessage && <p className="text-xs text-slate-500 mt-0.5">{gatewayMessage}</p>}
        </div>
      </div>

      {/* Amount + core facts */}
      <div className="grid grid-cols-2 gap-3">
        {amount != null && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Amount Charged</p>
            <p className="text-lg font-bold text-slate-800">{currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            {feeAmount != null && <p className="text-[11px] text-slate-400 mt-0.5">Gateway fee: {currency} {feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>}
          </div>
        )}
        {paidAt && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Clock className="h-3 w-3" /> Paid At</p>
            <p className="text-sm font-semibold text-slate-800 mt-1">{new Date(paidAt).toLocaleString('en-GB')}</p>
          </div>
        )}
        {channel && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Channel</p>
            <p className="text-sm font-semibold text-slate-800 mt-1 capitalize">{channel}</p>
          </div>
        )}
        {email && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1"><Mail className="h-3 w-3" /> Payer Email</p>
            <p className="text-sm font-semibold text-slate-800 mt-1 truncate">{email}</p>
          </div>
        )}
      </div>

      {/* Card details */}
      {card && (card.brand || card.last4) && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <CreditCard className="h-5 w-5 text-indigo-500 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-indigo-900 capitalize">{card.brand || 'Card'}</span>
            {card.last4 && <span className="text-indigo-700 font-mono ml-1.5">•••• {card.last4}</span>}
            {card.bank && <span className="text-indigo-500 ml-2">{card.bank}</span>}
            {card.expiry && <span className="text-indigo-400 ml-2">exp {card.expiry}</span>}
          </div>
        </div>
      )}

      {/* References */}
      {(primaryRef || secondaryRef) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Landmark className="h-3.5 w-3.5 text-slate-400" />
          {primaryRef && <span className="font-mono">{primaryRef}</span>}
          {secondaryRef && <span className="font-mono text-slate-400">· {secondaryRef}</span>}
        </div>
      )}

      {/* Timeline (Paystack only, gracefully hidden otherwise) */}
      {timeline && timeline.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Attempt Timeline</p>
          <div className="space-y-1.5">
            {timeline.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${h.type === 'success' ? 'bg-emerald-500' : h.type === 'error' ? 'bg-red-500' : 'bg-slate-300'}`} />
                <span className="text-slate-600">{h.message}</span>
                <span className="text-slate-300">· {h.time}s</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON, collapsed */}
      <button
        onClick={() => setShowRaw(v => !v)}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600"
      >
        <Code2 className="h-3.5 w-3.5" /> {showRaw ? 'Hide' : 'View'} raw gateway payload
      </button>
      {showRaw && (
        <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-[11px] overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

// Detail Drawer Component
function TransactionDetailDrawer({ transactionId, onClose }: { transactionId: number | null; onClose: () => void }) {
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    onlinePaymentAPI.get(transactionId)
      .then(setTx)
      .catch(err => setError(extractError(err)))
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (!transactionId) return null;

  const summary = tx?.payment_object_summary;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white flex items-center justify-between">
          <h3 className="font-bold">Transaction Details</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : tx ? (
            <div className="space-y-6">
              {/* Basic info */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gateway</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Gateway:</span><span className="font-medium ml-1">{tx.gateway_name}</span></div>
                  <div><span className="text-slate-500">Reference:</span><span className="font-mono ml-1">{tx.gateway_reference}</span></div>
                  <div><span className="text-slate-500">Amount:</span><span className="font-medium ml-1">{Number(tx.amount).toLocaleString()}</span></div>
                  <div><span className="text-slate-500">Currency:</span><span className="font-medium ml-1">{tx.currency}</span></div>
                  <div><span className="text-slate-500">Status:</span><span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[tx.gateway_status]}`}>{STATUS_LABELS[tx.gateway_status]}</span></div>
                  <div><span className="text-slate-500">Initiated:</span><span className="font-medium ml-1">{new Date(tx.initiated_at).toLocaleString('en-GB')}</span></div>
                  {tx.completed_at && <div className="col-span-2"><span className="text-slate-500">Completed:</span><span className="font-medium ml-1">{new Date(tx.completed_at).toLocaleString('en-GB')}</span></div>}
                </div>
              </div>

              {/* Payment object summary */}
              {summary && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Payment Purpose</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                    <div><span className="text-slate-500">Type:</span><span className="font-medium ml-1">{PAYMENT_TYPE_OPTIONS.find(o => o.value === summary.type)?.label || summary.type}</span></div>
                    {summary.person_name && <div><span className="text-slate-500">Payer:</span><span className="font-medium ml-1">{summary.person_name}</span></div>}
                    {summary.reference && <div><span className="text-slate-500">Payment Ref:</span><span className="font-mono ml-1">{summary.reference}</span></div>}
                    {summary.amount && <div><span className="text-slate-500">Amount:</span><span className="font-medium ml-1">₦{Number(summary.amount).toLocaleString()}</span></div>}
                    {summary.wallet_type && <div><span className="text-slate-500">Wallet:</span><span className="font-medium ml-1">{summary.wallet_type}</span></div>}
                  </div>
                </div>
              )}

              {/* Gateway response — now human-readable */}
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gateway Response</p>
                <GatewayResponseCard raw={tx.gateway_response} providerHint={tx.gateway_name} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function OnlinePaymentsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [transactions, setTransactions] = useState<OnlinePaymentTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [gatewayFilter, setGatewayFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [personFilter, setPersonFilter] = useState<SelectedPersonFilter | null>(null);

  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [currencies, setCurrencies] = useState<string[]>([]);

  const fetchTransactions = useCallback(async (pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (gatewayFilter) params.gateway = gatewayFilter;
      if (statusFilter) params.gateway_status = statusFilter;
      if (currencyFilter) params.currency = currencyFilter;
      if (paymentTypeFilter) params.payment_type = paymentTypeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (personFilter) {
        params.person_type = personFilter.type;
        params.person_id = personFilter.id;
      }

      const data = await onlinePaymentAPI.list(params);
      let results: OnlinePaymentTransaction[] = [];
      let totalCount = 0;
      if (Array.isArray(data)) {
        results = data;
        totalCount = data.length;
      } else if (data?.results) {
        results = data.results;
        totalCount = typeof data.count === 'number' ? data.count : results.length;
      }
      setTransactions(results);
      setTotal(totalCount);
      setPage(pg);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [search, gatewayFilter, statusFilter, currencyFilter, paymentTypeFilter, dateFrom, dateTo, personFilter]);

  useEffect(() => {
    Promise.all([
      gatewayAPI.list(),
      financeSettingsAPI.get(),
    ]).then(([gates, settingsRes]) => {
      setGateways(Array.isArray(gates) ? gates : []);
      const settingsData = (settingsRes as any)?.data || settingsRes;
      setSettings(settingsData);
      if (settingsData?.currency_config?.supported_currencies) {
        const base = settingsData.currency_config.base_currency;
        const supported = Object.keys(settingsData.currency_config.supported_currencies || {});
        setCurrencies([base, ...supported.filter(c => c !== base)]);
      }
    }).catch(() => {});

    fetchTransactions(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterApply = () => fetchTransactions(1);
  // Re-fetch immediately when a person is picked/cleared, so it feels like a real filter
  useEffect(() => { fetchTransactions(1); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNextPage = total > 0 ? page * PAGE_SIZE < total : transactions.length >= PAGE_SIZE;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
              <Activity className="h-5 w-5 text-white" />
            </div>
            Online Transactions
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Gateway payment logs with payer details</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by payer name, reg. no, or reference..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleFilterApply(); }}
            className="w-full pl-9 pr-9 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <PersonFilterBox value={personFilter} onSelect={setPersonFilter} onClear={() => setPersonFilter(null)} />

        <select value={gatewayFilter} onChange={e => setGatewayFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl">
          <option value="">All Gateways</option>
          {gateways.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <select value={paymentTypeFilter} onChange={e => setPaymentTypeFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl">
          {PAYMENT_TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl">
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>

        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl">
          <option value="">All Currencies</option>
          {currencies.map(cur => <option key={cur} value={cur}>{cur}</option>)}
        </select>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl" />

        <button onClick={handleFilterApply} className="px-3 py-2 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 inline-flex items-center gap-1">
          <Filter className="h-3.5 w-3.5" /> Apply
        </button>
        <button onClick={() => fetchTransactions(page)} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="p-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" /><p className="mt-2 text-sm text-slate-400">Loading online transactions...</p></div>
      ) : pageError ? (
        <div className="p-10 text-center"><AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-red-600 mb-3">{pageError}</p><button onClick={() => fetchTransactions(1)} className="text-sm text-indigo-600 underline inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Retry</button></div>
      ) : transactions.length === 0 ? (
        <div className="p-16 text-center"><div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Activity className="h-7 w-7 text-indigo-300" /></div><h3 className="font-semibold text-slate-700 mb-1">No online transactions found</h3><p className="text-sm text-slate-400 mb-5">Try adjusting your filters.</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Reference / Date</th>
                  <th className="px-4 py-3 text-left">Gateway</th>
                  <th className="px-4 py-3 text-left">Payment Type</th>
                  <th className="px-4 py-3 text-left">Payer</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(t => {
                  const summary = t.payment_object_summary;
                  const payerName = summary?.person_name || '—';
                  const paymentTypeLabel = PAYMENT_TYPE_OPTIONS.find(o => o.value === summary?.type)?.label || 'Unknown';
                  const reference = summary?.reference || t.gateway_reference;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTxId(t.id)}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-indigo-600">{reference}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(t.initiated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{t.gateway_name || '—'}</td>
                      <td className="px-4 py-3">{paymentTypeLabel}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{payerName}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[t.gateway_status] || ''}`}>{STATUS_LABELS[t.gateway_status] || t.gateway_status}</span></td>
                      <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); setSelectedTxId(t.id); }} className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100"><Eye className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">Pg {page} {total > 0 ? `of ${totalPages} (${total} total)` : ''}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => fetchTransactions(page - 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 inline-flex items-center gap-1"><ChevronLeft className="h-4 w-4" /> Prev</button>
              <span className="px-3 py-1.5 text-sm">{page}</span>
              <button disabled={!hasNextPage} onClick={() => fetchTransactions(page + 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 inline-flex items-center gap-1">Next <ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <TransactionDetailDrawer transactionId={selectedTxId} onClose={() => setSelectedTxId(null)} />
    </div>
  );
}