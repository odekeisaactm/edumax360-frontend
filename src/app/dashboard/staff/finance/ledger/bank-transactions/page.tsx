'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { auditLedgersAPI, bankDetailsAPI } from '@/lib/finance.service';
import type { BankTransaction, SchoolBankDetail } from '@/lib/finance.types';
import {
  Landmark, Search, X, AlertCircle, Loader2, RefreshCw,
  ChevronLeft, ChevronRight, Filter, Eye, ArrowUpRight, ArrowDownRight,
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

function fmtMoney(amount: number | string): string {
  return '₦' + Number(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const PAGE_SIZE = 20;

const DIRECTION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  credit: { label: 'Inflow', color: 'text-emerald-600', icon: <ArrowDownRight className="h-4 w-4" /> },
  debit: { label: 'Outflow', color: 'text-red-600', icon: <ArrowUpRight className="h-4 w-4" /> },
};

const TYPE_LABELS: Record<string, string> = {
  opening_balance: 'Opening Balance',
  fee_payment: 'Fee Payment',
  family_payment: 'Family Fee Payment',
  income: 'General Income',
  expense: 'General Expense',
  wallet_funding: 'Wallet Funding',
  supplier_payment: 'Supplier Payment',
  advance_settlement: 'Advance Settlement',
  other_clearance: 'Other Clearance',
  bank_transfer: 'Internal Bank Transfer',
  manual_adjustment: 'Manual Adjustment',
  reversal: 'Reversal',
};

const TYPE_STYLES: Record<string, string> = {
  opening_balance: 'bg-slate-100 text-slate-600 border-slate-200',
  fee_payment: 'bg-blue-50 text-blue-700 border-blue-200',
  family_payment: 'bg-blue-50 text-blue-700 border-blue-200',
  income: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expense: 'bg-red-50 text-red-700 border-red-200',
  wallet_funding: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  supplier_payment: 'bg-orange-50 text-orange-700 border-orange-200',
  advance_settlement: 'bg-amber-50 text-amber-700 border-amber-200',
  other_clearance: 'bg-purple-50 text-purple-700 border-purple-200',
  bank_transfer: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  manual_adjustment: 'bg-gray-50 text-gray-600 border-gray-200',
  reversal: 'bg-red-50 text-red-700 border-red-200',
};

function TransactionDetailDrawer({ transactionId, onClose }: { transactionId: number | null; onClose: () => void }) {
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    setTx(null);
    auditLedgersAPI.getBankTransaction(transactionId)
      .then(setTx)
      .catch(err => setError(extractError(err)))
      .finally(() => setLoading(false));
  }, [transactionId]);

  if (!transactionId) return null;

  const isCredit = tx && tx.direction === 'credit';

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-xl h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white flex items-center justify-between">
          <h3 className="font-bold">Bank Transaction</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : error ? (
            <div className="text-red-600 text-sm">{error}</div>
          ) : tx ? (
            <div className="space-y-6">
              {/* Amount headline */}
              <div className={`p-4 rounded-xl border ${isCredit ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                </p>
                <p className={`text-2xl font-bold mt-1 ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                  {isCredit ? '+' : '−'}{fmtMoney(tx.amount)}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <span>{fmtMoney(tx.balance_before)}</span>
                  <ArrowUpRight className="h-3 w-3" />
                  <span className="font-semibold text-slate-700">{fmtMoney(tx.balance_after)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-slate-500">Account:</span><span className="font-medium ml-1">{tx.bank_account_name}</span></div>
                  <div><span className="text-slate-500">Direction:</span><span className={`font-medium ml-1 ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>{tx.direction_display}</span></div>
                  <div><span className="text-slate-500">Date:</span><span className="font-medium ml-1">{new Date(tx.created_at).toLocaleString('en-GB')}</span></div>
                  {tx.created_by_name && <div><span className="text-slate-500">Actioned By:</span><span className="font-medium ml-1">{tx.created_by_name}</span></div>}
                  {tx.reference && <div><span className="text-slate-500">Reference:</span><span className="font-mono ml-1">{tx.reference}</span></div>}
                  {tx.reason && <div className="col-span-2"><span className="text-slate-500">Reason:</span><span className="font-medium ml-1">{tx.reason}</span></div>}
                </div>
                {tx.foreign_currency && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                    <p className="font-semibold text-slate-600">Foreign Currency Details</p>
                    <p>Currency: {tx.foreign_currency} · Amount: {tx.foreign_amount} · Rate: {tx.exchange_rate}</p>
                  </div>
                )}
              </div>

              {tx.source_object_summary && (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Source</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
                    <p className="font-medium text-slate-800">{tx.source_object_summary.description}</p>
                    <p className="text-xs text-slate-400 mt-1">Type: {tx.source_object_summary.type} · ID: {tx.source_object_summary.id}</p>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function BankTransactionsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);

  const [search, setSearch] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [banks, setBanks] = useState<SchoolBankDetail[]>([]);

  useEffect(() => {
    bankDetailsAPI.list({ is_active: true, page_size: 1000 })
      .then((data: any) => {
        const arr = Array.isArray(data) ? data : (data?.results ?? []);
        setBanks(arr);
      })
      .catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async (pg = 1) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = { page: pg, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (bankFilter) params.bank_account = bankFilter;
      if (directionFilter) params.direction = directionFilter;
      if (typeFilter) params.transaction_type = typeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await auditLedgersAPI.getBankLedger(params);
      let results: BankTransaction[] = [];
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
  }, [search, bankFilter, directionFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterApply = () => fetchTransactions(1);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNextPage = total > 0 ? page * PAGE_SIZE < total : transactions.length >= PAGE_SIZE;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
              <Landmark className="h-5 w-5 text-white" />
            </div>
            Bank Transactions
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Unified bank and cash ledger</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search reference or reason..."
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

        <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl">
          <option value="">All Accounts</option>
          {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
        </select>

        <select value={directionFilter} onChange={e => setDirectionFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl">
          <option value="">All Directions</option>
          <option value="credit">Credit (Inflow)</option>
          <option value="debit">Debit (Outflow)</option>
        </select>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-xl">
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
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
        <div className="p-16 text-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" /><p className="mt-2 text-sm text-slate-400">Loading bank transactions...</p></div>
      ) : pageError ? (
        <div className="p-10 text-center"><AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" /><p className="text-sm text-red-600 mb-3">{pageError}</p><button onClick={() => fetchTransactions(1)} className="text-sm text-indigo-600 underline inline-flex items-center gap-1"><RefreshCw className="h-3.5 w-3.5" /> Retry</button></div>
      ) : transactions.length === 0 ? (
        <div className="p-16 text-center"><div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Landmark className="h-7 w-7 text-indigo-300" /></div><h3 className="font-semibold text-slate-700 mb-1">No transactions found</h3><p className="text-sm text-slate-400 mb-5">Try adjusting your filters.</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Date / Ref</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Direction</th>
                  <th className="px-4 py-3 text-left">Amount</th>
                  <th className="px-4 py-3 text-left">Balance (Before → After)</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map(t => {
                  const directionMeta = DIRECTION_META[t.direction] || DIRECTION_META.credit;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedTxId(t.id)}>
                      <td className="px-4 py-3">
                        <div>{new Date(t.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        {t.reference && <div className="text-[11px] font-mono text-slate-400 mt-0.5">{t.reference}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{t.bank_account_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${TYPE_STYLES[t.transaction_type] || ''}`}>
                          {TYPE_LABELS[t.transaction_type] || t.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${directionMeta.color}`}>
                          {directionMeta.icon} {directionMeta.label}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${t.direction === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.direction === 'credit' ? '+' : '−'}{fmtMoney(t.amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="text-slate-400">{fmtMoney(t.balance_before)}</span>
                        <span className="mx-1.5 text-slate-300">→</span>
                        <span className="font-medium text-slate-700">{fmtMoney(t.balance_after)}</span>
                      </td>
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