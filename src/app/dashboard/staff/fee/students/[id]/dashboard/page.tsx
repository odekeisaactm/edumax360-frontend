'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, studentsAPI } from '@/lib/api';
import {
  StudentFinancialDashboard, Invoice, FamilyInvoice,
  FeePayment, OtherPayment, StudentWallet, Student, SchoolBankDetail, WalletField,
} from '@/lib/types';
import {
  CreditCard, Wallet, AlertTriangle, Check, X, ChevronLeft,
  FileText, Clock, ArrowUpCircle, History, Eye, Printer,
  RotateCcw, Plus, Minus, ArrowRightLeft, Users, Loader2,
  AlertCircle, Download, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { academicCalendarAPI } from '@/lib/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val: string | number | undefined) => {
  if (!val) return '₦0.00';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partially_paid: 'bg-amber-100 text-amber-800',
  unpaid: 'bg-red-100 text-red-800',
  overpaid: 'bg-blue-100 text-blue-800',
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  reverted: 'bg-gray-100 text-gray-600',
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatPill({ label, value, color = 'gray' }: { label: string; value: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    teal: 'bg-teal-50 text-teal-700',
  };
  return (
    <div className={`rounded-xl px-4 py-3 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-0.5">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

// ─── Manual Invoice Modal ─────────────────────────────────────────────────────

interface ManualInvoiceModalProps {
  studentId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function ManualInvoiceModal({ studentId, onClose, onSuccess }: ManualInvoiceModalProps) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState({ session: '', period: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      academicCalendarAPI.listSessions(),
      academicCalendarAPI.listSessionPeriods(),
    ]).then(([s, p]) => {
      setSessions(s);
      setPeriods(p);
    }).finally(() => setFetching(false));
  }, []);

  const handleSubmit = async () => {
    if (!form.session || !form.period) {
      setError('Please select both session and period');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await feeAPI.createInvoice({
        student: studentId,
        session: parseInt(form.session),
        period: parseInt(form.period),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-slate-800 px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-bold flex items-center gap-2"><Plus className="h-5 w-5" /> Manual Invoice</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}
          {fetching ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Session</label>
                <select value={form.session} onChange={e => setForm(f => ({ ...f, session: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Session...</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Period</label>
                <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Period...</option>
                  {periods.filter(p => p.session === parseInt(form.session)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || fetching}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Item Modal ───────────────────────────────────────────────────────────

interface AddItemModalProps {
  invoiceId: number;
  studentClassId: number;
  onClose: () => void;
  onSuccess: () => void;
}

function AddItemModal({ invoiceId, studentClassId, onClose, onSuccess }: AddItemModalProps) {
  const [structures, setStructures] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    feeAPI.getFeeStructures().then(res => {
      // Only show fees applicable to this student's class
      const applicable = res.filter((s: any) => 
        s.student_classes?.some((c: any) => (c.id || c) === studentClassId)
      );
      setStructures(applicable);
    }).finally(() => setFetching(false));
  }, [studentClassId]);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    try {
      await feeAPI.addInvoiceItem({
        invoice_id: invoiceId,
        fee_master_id: parseInt(selectedId)
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-emerald-800 px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-bold flex items-center gap-2"><Plus className="h-5 w-5" /> Add Fee Item</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}
          {fetching ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-emerald-400" /></div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Fee from Master</label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                <option value="">Choose a fee...</option>
                {structures.map(s => (
                  <option key={s.id} value={s.id}>{s.fee_name} — {s.group_name}</option>
                ))}
              </select>
              <p className="mt-2 text-[10px] text-gray-400">
                * Price will be automatically pulled from the Fee Master for this period.
              </p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || !selectedId}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Add to Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wallet Modal ─────────────────────────────────────────────────────────────

interface WalletModalProps {
  student: Student;
  wallet: StudentWallet;
  onClose: () => void;
  onSuccess: () => void;
  allowInterField: boolean;
  allowSibling: boolean;
}

function WalletModal({ student, wallet, onClose, onSuccess, allowInterField, allowSibling }: WalletModalProps) {
  const [tab, setTab] = useState<'view' | 'fund' | 'transfer_field' | 'transfer_sibling'>('view');
  const [siblings, setSiblings] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: '',
    wallet_field: 'fee' as WalletField,
    notes: '',
    reference: '',
    from_field: 'fee' as WalletField,
    to_field: 'canteen' as WalletField,
    to_student_id: '',
    reason: '',
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  useEffect(() => {
    if (tab === 'view') {
      setTxLoading(true);
      feeAPI.getWalletTransactions(student.id)
        .then(setTransactions)
        .catch(() => setTransactions([]))
        .finally(() => setTxLoading(false));
    }
    if (tab === 'transfer_sibling') {
      studentsAPI.getSiblings(student.id).then(setSiblings).catch(() => setSiblings([]));
    }
  }, [tab, student.id]);

  const handleSubmit = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (tab === 'fund') {
        await feeAPI.fundWallet({
          student: student.id,
          amount: form.amount,
          wallet_field: form.wallet_field,
          notes: form.notes,
          reference: form.reference,
        });
        setSuccess('Wallet funded successfully');
      } else if (tab === 'transfer_field') {
        await feeAPI.transferWalletField({
          student_id: student.id,
          amount: form.amount,
          from_field: form.from_field,
          to_field: form.to_field,
          reason: form.reason,
        });
        setSuccess('Transfer completed successfully');
      } else if (tab === 'transfer_sibling') {
        if (!form.to_student_id) { setError('Please select a sibling'); setLoading(false); return; }
        await feeAPI.transferWalletSibling({
          from_student_id: student.id,
          to_student_id: parseInt(form.to_student_id),
          amount: form.amount,
          from_field: form.from_field,
          to_field: form.to_field,
          reason: form.reason,
        });
        setSuccess('Transfer to sibling completed');
      }
      setTimeout(() => { onSuccess(); onClose(); }, 1500);
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { key: 'view', label: 'Balance & History' },
    { key: 'fund', label: 'Fund Wallet' },
    ...(allowInterField ? [{ key: 'transfer_field', label: 'Transfer (Fields)' }] : []),
    ...(allowSibling ? [{ key: 'transfer_sibling', label: 'Transfer (Sibling)' }] : []),
  ] as { key: typeof tab; label: string }[];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Wallet & Transfers
            </h3>
            <p className="text-teal-100 text-xs mt-0.5">{student.full_name || `${student.first_name} ${student.last_name}`}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {/* Balance pills */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4 bg-gray-50 border-b">
          <StatPill label="Fee Wallet" value={fmt(wallet.fee_balance)} color="teal" />
          <StatPill label="Canteen Wallet" value={fmt(wallet.canteen_balance)} color="blue" />
        </div>

        {/* Tabs */}
        <div className="flex border-b overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setError(null); setSuccess(null); }}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all ${
                tab === t.key ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50' : 'text-gray-500 hover:text-gray-700'
              }`}
            >{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-700">
              <Check className="h-4 w-4" /> {success}
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {/* View tab */}
          {tab === 'view' && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Transaction History</h4>
              {txLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 text-teal-500 animate-spin" /></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No transactions yet</div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <div>
                        <p className="font-medium text-gray-800">{tx.reason || tx.transaction_type}</p>
                        <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className={`font-bold ${tx.amount?.startsWith('-') ? 'text-red-600' : 'text-green-600'}`}>
                        {fmt(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fund tab */}
          {tab === 'fund' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Wallet to Fund</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['fee', 'canteen'] as WalletField[]).map(field => (
                    <button key={field} onClick={() => setForm(f => ({ ...f, wallet_field: field }))}
                      className={`py-2.5 rounded-lg text-sm font-medium border transition-all capitalize ${
                        form.wallet_field === field ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                      }`}
                    >{field} Wallet</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (₦)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reference (optional)</label>
                <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="Bank teller no., etc."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          )}

          {/* Transfer field tab */}
          {tab === 'transfer_field' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">From</label>
                  <select value={form.from_field} onChange={e => setForm(f => ({ ...f, from_field: e.target.value as WalletField }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="fee">Fee Wallet ({fmt(wallet.fee_balance)})</option>
                    <option value="canteen">Canteen Wallet ({fmt(wallet.canteen_balance)})</option>
                  </select>
                </div>
                <ArrowRightLeft className="h-5 w-5 text-gray-400 mt-5 flex-shrink-0" />
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">To</label>
                  <select value={form.to_field} onChange={e => setForm(f => ({ ...f, to_field: e.target.value as WalletField }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="fee">Fee Wallet</option>
                    <option value="canteen">Canteen Wallet</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (₦)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason</label>
                <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Reason for transfer"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          )}

          {/* Transfer sibling tab */}
          {tab === 'transfer_sibling' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Transfer To (Sibling)</label>
                {siblings.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No siblings found for this student</p>
                ) : (
                  <select value={form.to_student_id} onChange={e => setForm(f => ({ ...f, to_student_id: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Select sibling...</option>
                    {siblings.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || `${s.first_name} ${s.last_name}`} · {s.current_class_name || ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">From Wallet</label>
                  <select value={form.from_field} onChange={e => setForm(f => ({ ...f, from_field: e.target.value as WalletField }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="fee">Fee ({fmt(wallet.fee_balance)})</option>
                    <option value="canteen">Canteen ({fmt(wallet.canteen_balance)})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">To Wallet</label>
                  <select value={form.to_field} onChange={e => setForm(f => ({ ...f, to_field: e.target.value as WalletField }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="fee">Fee</option>
                    <option value="canteen">Canteen</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Amount (₦)</label>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason</label>
                <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Reason for transfer"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== 'view' && (
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
            <button onClick={onClose} disabled={loading}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {tab === 'fund' ? 'Fund Wallet' : 'Confirm Transfer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Payment Form ─────────────────────────────────────────────────────────────

interface PaymentFormProps {
  invoice: Invoice | FamilyInvoice;
  isFamily: boolean;
  bankAccounts: SchoolBankDetail[];
  walletBalance: string;
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
}

function PaymentForm({ invoice, isFamily, bankAccounts, walletBalance, onSubmit, onClose }: PaymentFormProps) {
  // Build initial amounts: fill each item's balance as default
  const initAmounts = () => {
    const map: Record<number, string> = {};
    invoice.items?.forEach((item: any) => {
      const bal = parseFloat(item.balance || '0');
      if (bal > 0) map[item.id] = bal.toFixed(2);
    });
    return map;
  };
  const [itemAmounts, setItemAmounts] = useState<Record<number, string>>(initAmounts);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [bankAccount, setBankAccount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalEntered = Object.values(itemAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const walletBal = parseFloat(walletBalance || '0');

  const handleSubmit = async () => {
    if (totalEntered <= 0) { setError('Please enter at least one payment amount'); return; }
    if (paymentMode === 'wallet' && totalEntered > walletBal) {
      setError(`Insufficient wallet balance (${fmt(walletBalance)})`); return;
    }
    if (paymentMode !== 'wallet' && paymentMode !== 'online' && !bankAccount) {
      setError('Please select a bank account'); return;
    }

    const itemBreakdown = Object.entries(itemAmounts)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([id, amount]) => ({
        [isFamily ? 'family_invoice_item_id' : 'invoice_item_id']: parseInt(id),
        amount,
      }));

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        invoice: invoice.id,
        amount: totalEntered.toFixed(2),
        payment_mode: paymentMode,
        bank_account: bankAccount || undefined,
        date,
        reference,
        description,
        notes,
        item_breakdown: itemBreakdown,
      });
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Record Payment</h3>
            <p className="text-emerald-100 text-xs mt-0.5">Invoice {invoice.invoice_number}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Invoice summary */}
          <div className="grid grid-cols-3 gap-3 px-6 py-4 bg-gray-50 border-b">
            <StatPill label="Invoice Total" value={fmt(invoice.total_amount)} />
            <StatPill label="Amount Paid" value={fmt(invoice.amount_paid)} color="green" />
            <StatPill label="Balance Due" value={fmt(invoice.balance)} color="red" />
          </div>

          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
              </div>
            )}

            {/* Item amounts */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Payment Per Item</h4>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Description</th>
                      <th className="text-right px-4 py-2.5 font-semibold text-gray-600">Balance</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-gray-600 w-32">Pay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {invoice.items?.map((item: any) => {
                      const bal = parseFloat(item.balance || '0');
                      const isPaid = bal <= 0;
                      return (
                        <tr key={item.id} className={isPaid ? 'opacity-50' : ''}>
                          <td className="px-4 py-2.5 text-gray-800 font-medium">
                            {item.description || item.fee_master_name || `Item #${item.id}`}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-mono text-xs ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                            {isPaid ? '✓ Paid' : fmt(item.balance)}
                          </td>
                          <td className="px-3 py-2">
                            {isPaid ? null : (
                              <input
                                type="number"
                                value={itemAmounts[item.id] || ''}
                                onChange={e => setItemAmounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                max={item.balance}
                                min="0"
                                step="0.01"
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-right text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-emerald-50">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-800">Total Being Paid</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">{fmt(totalEntered)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Mode *</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="wallet">Wallet ({fmt(walletBalance)})</option>
                  <option value="online">Online</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {paymentMode !== 'wallet' && paymentMode !== 'online' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bank Account *</label>
                  <select value={bankAccount} onChange={e => setBankAccount(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select account...</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.bank_name} – {b.account_number}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reference</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="Teller no., receipt no..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Total: <span className="font-bold text-gray-900">{fmt(totalEntered)}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} disabled={loading}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={loading || totalEntered <= 0}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Apply Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StudentFinancialDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();

  const studentId = parseInt(params.id as string);
  const canRecord = user?.is_superuser || hasPermission('fee_management.add_feepaymentmodel');
  const canConfirm = user?.is_superuser || hasPermission('fee_management.confirm_payment');
  const canView = user?.is_superuser || hasPermission('fee_management.view_feepaymentmodel');

  const [dashboard, setDashboard] = useState<StudentFinancialDashboard | null>(null);
  const [bankAccounts, setBankAccounts] = useState<SchoolBankDetail[]>([]);
  const [feeSetting, setFeeSetting] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeInvoiceId, setActiveInvoiceId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'invoice_history' | 'payment_history'>('invoice_history');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showManualInvoiceModal, setShowManualInvoiceModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState<number | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState<{ invoice: Invoice | FamilyInvoice; isFamily: boolean } | null>(null);
  const [revertModal, setRevertModal] = useState<{ id: number; isFamily: boolean } | null>(null);
  const [revertReason, setRevertReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandedOther, setExpandedOther] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const invoiceId = searchParams.get('invoice_id');
      const sessionId = searchParams.get('session_id');
      const periodId = searchParams.get('period_id');
      const params: any = {};
      if (invoiceId) params.invoice_id = parseInt(invoiceId);
      if (sessionId) params.session_id = parseInt(sessionId);
      if (periodId) params.period_id = parseInt(periodId);

      const [dash, banks, settings] = await Promise.all([
        feeAPI.getStudentDashboard(studentId, params),
        feeAPI.getBankAccounts(),
        feeAPI.getSettings().catch(() => null),
      ]);
      setDashboard(dash);
      setBankAccounts(banks);
      setFeeSetting(settings);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to load student financial data');
    } finally {
      setLoading(false);
    }
  }, [studentId, searchParams]);

  useEffect(() => { load(); }, [load]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleDeleteInvoice = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      await feeAPI.deleteInvoice(id);
      showSuccess('Invoice deleted');
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to delete invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!window.confirm('Remove this item from the invoice?')) return;
    setActionLoading(true);
    try {
      await feeAPI.deleteInvoiceItem(id);
      showSuccess('Item removed');
      load();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Failed to remove item');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (invoice: Invoice | FamilyInvoice, isFamily: boolean) => {
    setShowPaymentForm({ invoice, isFamily });
  };

  const handlePaymentSubmit = async (data: any) => {
    const { isFamily } = showPaymentForm!;
    if (isFamily) {
      await feeAPI.recordFamilyPayment(data);
    } else {
      await feeAPI.recordPayment(data);
    }
    setShowPaymentForm(null);
    showSuccess('Payment recorded successfully');
    load();
  };

  const handleConfirm = async (id: number, isFamily: boolean) => {
    setActionLoading(true);
    try {
      if (isFamily) await feeAPI.confirmFamilyPayment(id);
      else await feeAPI.confirmPayment(id);
      showSuccess('Payment confirmed');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevert = async () => {
    if (!revertModal) return;
    setActionLoading(true);
    try {
      await feeAPI.revertPayment(revertModal.id, revertReason);
      setRevertModal(null);
      setRevertReason('');
      showSuccess('Payment reverted');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!canView) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading financial data...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md text-center">
          <AlertCircle className="h-14 w-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to Load</h2>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button onClick={load} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { current_invoice, family_invoice, invoice_history, wallet, other_payments_outstanding, total_outstanding } = dashboard;
  const hasOtherDebts = other_payments_outstanding?.length > 0;

  return (
    <div className="space-y-5 pb-10">
      {/* Success toast */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-50 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-lg">
          <Check className="h-4 w-4 text-green-600" />
          <p className="text-sm font-medium text-green-800">{successMsg}</p>
        </div>
      )}

      {/* Revert modal */}
      {revertModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Revert Payment</h3>
            <p className="text-sm text-gray-500 mb-4">This will mark the payment as reverted. Please provide a reason.</p>
            <textarea value={revertReason} onChange={e => setRevertReason(e.target.value)} rows={3}
              placeholder="Reason for reverting..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm mb-4 focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setRevertModal(null); setRevertReason(''); }}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleRevert} disabled={actionLoading || !revertReason.trim()}
                className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Revert Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet modal */}
      {showWalletModal && wallet && (
        <WalletModal
          student={{ id: studentId, full_name: dashboard.student_name } as Student}
          wallet={wallet}
          onClose={() => setShowWalletModal(false)}
          onSuccess={load}
          allowInterField={feeSetting?.allow_inter_field_transfer ?? true}
          allowSibling={feeSetting?.allow_sibling_transfer ?? true}
        />
      )}

      {/* Payment form modal */}
      {showPaymentForm && (
        <PaymentForm
          invoice={showPaymentForm.invoice}
          isFamily={showPaymentForm.isFamily}
          bankAccounts={bankAccounts}
          walletBalance={wallet?.fee_balance || '0'}
          onSubmit={handlePaymentSubmit}
          onClose={() => setShowPaymentForm(null)}
        />
      )}

      {/* Student header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{dashboard.student_name}</h1>
              <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                <span className="font-mono">{dashboard.registration_number}</span>
                {dashboard.student_class && (
                  <><span>·</span><span>{dashboard.student_class}</span></>
                )}
                {wallet && (
                  <><span>·</span><span className="text-teal-600 font-medium">Wallet: {fmt(wallet.fee_balance)}</span></>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowManualInvoiceModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors border border-slate-200">
              <Plus className="h-4 w-4" /> Create Invoice
            </button>
            <button onClick={() => setShowWalletModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-teal-50 text-teal-700 text-sm font-semibold rounded-xl hover:bg-teal-100 transition-colors border border-teal-200">
              <Wallet className="h-4 w-4" /> Wallet & Transfers
            </button>
            {canRecord && current_invoice && (
              <button onClick={() => handleRecordPayment(current_invoice, false)}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all shadow-sm">
                <CreditCard className="h-4 w-4" /> Record Payment
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Other payments alert */}
      {hasOtherDebts && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-red-800">Outstanding Other Payments</h4>
                <p className="text-xs text-red-600 mt-0.5">
                  {other_payments_outstanding.length} unpaid item(s) —
                  total {fmt(other_payments_outstanding.reduce((s, p) => s + parseFloat(p.balance || '0'), 0))}
                </p>
              </div>
            </div>
            <button onClick={() => setExpandedOther(v => !v)} className="text-red-400 hover:text-red-600">
              {expandedOther ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
          {expandedOther && (
            <div className="mt-3 space-y-1.5">
              {other_payments_outstanding.map((p: OtherPayment) => (
                <div key={p.id} className="flex justify-between text-xs bg-white border border-red-100 rounded-lg px-3 py-2">
                  <span className="text-gray-700">{p.description}</span>
                  <span className="font-bold text-red-600">{fmt(p.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Total outstanding summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatPill label="Total Outstanding" value={fmt(total_outstanding)} color="red" />
        <StatPill label="Current Invoice" value={fmt(current_invoice?.balance)} color={current_invoice?.balance === '0.00' ? 'green' : 'amber'} />
        {family_invoice && <StatPill label="Family Invoice" value={fmt(family_invoice.balance)} color="amber" />}
        {wallet && <StatPill label="Fee Wallet" value={fmt(wallet.fee_balance)} color="teal" />}
      </div>

      {/* Current Invoice */}
      {current_invoice ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Current Invoice</h2>
              <p className="text-xs text-gray-400">{current_invoice.invoice_number} · {current_invoice.period_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[current_invoice.status] || 'bg-gray-100 text-gray-600'}`}>
                {current_invoice.status?.replace('_', ' ')}
              </span>
              {canRecord && current_invoice.status === 'unpaid' && parseFloat(current_invoice.amount_paid) === 0 && (
                <button onClick={() => handleDeleteInvoice(current_invoice.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete entire invoice">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              {canRecord && parseFloat(current_invoice.balance) > 0 && (
                <button onClick={() => handleRecordPayment(current_invoice, false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
                  <Plus className="h-3.5 w-3.5" /> Pay
                </button>
              )}
              <a href={`/api/fee/invoices/${current_invoice.id}/pdf/`} target="_blank" rel="noreferrer"
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Print invoice">
                <Printer className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Invoice items table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Description</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Discount</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {current_invoice.items?.map((item: any) => {
                  const bal = parseFloat(item.balance || '0');
                  const canDelete = canRecord && parseFloat(item.amount_paid) === 0 && parseFloat(item.total_waived || '0') === 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-3 text-gray-800 font-medium">
                        {item.description || item.fee_master_name}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-mono text-xs">{fmt(item.amount)}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-mono text-xs">
                        {parseFloat(item.total_discount || '0') > 0 ? `-${fmt(item.total_discount)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600 font-mono text-xs">{fmt(item.amount_paid)}</td>
                      <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {bal <= 0 ? '✓ Paid' : fmt(item.balance)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {canDelete && (
                          <button onClick={() => handleDeleteItem(item.id)}
                            className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {canRecord && (
                  <tr>
                    <td colSpan={6} className="px-6 py-2 bg-gray-50/30">
                      <button onClick={() => setShowAddItemModal(current_invoice.id)}
                        className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 uppercase tracking-wider">
                        <Plus className="h-3 w-3" /> Add Line Item
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td className="px-6 py-3 font-bold text-gray-800">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800 font-mono text-xs">{fmt(current_invoice.total_amount)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600 font-mono text-xs">
                    {parseFloat(current_invoice.total_discount || '0') > 0 ? `-${fmt(current_invoice.total_discount)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600 font-mono text-xs">{fmt(current_invoice.amount_paid)}</td>
                  <td className="px-4 py-3 text-right font-bold text-red-600 font-mono text-xs">{fmt(current_invoice.balance)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <FileText className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-700 mb-1">No Invoice for Current Period</h3>
          <p className="text-sm text-gray-400">No invoice has been generated for this student for the current term.</p>
        </div>
      )}

      {/* Family Invoice */}
      {family_invoice && (
        <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-indigo-50 flex items-center justify-between bg-indigo-50/50">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" /> Family Invoice
              </h2>
              <p className="text-xs text-gray-400">{family_invoice.invoice_number} · Shared across siblings</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[family_invoice.status] || 'bg-gray-100 text-gray-600'}`}>
                {family_invoice.status?.replace('_', ' ')}
              </span>
              {canRecord && parseFloat(family_invoice.balance) > 0 && (
                <button onClick={() => handleRecordPayment(family_invoice, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700">
                  <Plus className="h-3.5 w-3.5" /> Pay
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold text-gray-600">Description</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Paid</th>
                  <th className="text-right px-6 py-3 font-semibold text-gray-600">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {family_invoice.items?.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-gray-800 font-medium">{item.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{fmt(item.amount)}</td>
                    <td className="px-4 py-3 text-right text-blue-600 font-mono text-xs">{fmt(item.amount_paid)}</td>
                    <td className={`px-6 py-3 text-right font-mono text-xs font-bold ${parseFloat(item.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {parseFloat(item.balance) <= 0 ? '✓' : fmt(item.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t">
            <span className="text-sm font-bold text-gray-700">Balance Due</span>
            <span className="text-sm font-bold text-red-600">{fmt(family_invoice.balance)}</span>
          </div>
        </div>
      )}

      {/* Tabs: Invoice History & Payment History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'invoice_history', label: 'Invoice History', icon: FileText },
            { key: 'payment_history', label: 'Payment History', icon: History },
          ].map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all ${
                activeTab === key
                  ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-500'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* Invoice history tab */}
        {activeTab === 'invoice_history' && (
          invoice_history?.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">No invoice history found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold text-gray-600">Invoice</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Period</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Balance</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoice_history?.map((inv: Invoice) => (
                    <tr key={inv.id} className={`hover:bg-gray-50/50 transition-colors ${activeInvoiceId === inv.id ? 'bg-emerald-50/50' : ''}`}>
                      <td className="px-6 py-3 font-mono text-xs text-gray-600">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-700">{inv.period_name || inv.session_display}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmt(inv.total_amount)}</td>
                      <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${parseFloat(inv.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmt(inv.balance)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                          {inv.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setActiveInvoiceId(activeInvoiceId === inv.id ? null : inv.id)}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <a href={`/api/fee/invoices/${inv.id}/pdf/`} target="_blank" rel="noreferrer"
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Print">
                            <Printer className="h-3.5 w-3.5" />
                          </a>
                          {canRecord && parseFloat(inv.balance) > 0 && (
                            <button onClick={() => handleRecordPayment(inv, false)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Record payment">
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Payment history tab */}
        {activeTab === 'payment_history' && (
          <div className="overflow-x-auto">
            {/* Collect all payments from all invoices */}
            {(() => {
              const allPayments: (FeePayment & { invoice_number?: string })[] = [];
              invoice_history?.forEach((inv: Invoice) => {
                inv.payments?.forEach((p: FeePayment) => {
                  allPayments.push({ ...p, invoice_number: inv.invoice_number });
                });
              });
              if (current_invoice?.payments) {
                current_invoice.payments.forEach((p: FeePayment) => {
                  allPayments.push({ ...p, invoice_number: current_invoice.invoice_number });
                });
              }
              allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              if (allPayments.length === 0) {
                return <div className="py-10 text-center text-gray-400 text-sm">No payment records found</div>;
              }

              return (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-6 py-3 font-semibold text-gray-600">Date</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Invoice</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Mode</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allPayments.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 text-gray-600 text-xs">
                          {new Date(p.date || p.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono text-xs">{fmt(p.amount)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.invoice_number}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize text-xs">{p.payment_mode?.replace('_', ' ')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-600'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-1">
                            {p.status === 'confirmed' && (
                              <>
                                <a href={`/api/fee/payments/${p.id}/receipt-pdf/`} target="_blank" rel="noreferrer"
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Receipt">
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                                {canConfirm && (
                                  <button onClick={() => setRevertModal({ id: p.id, isFamily: false })}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Revert">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                            {p.status === 'pending' && canConfirm && (
                              <button onClick={() => handleConfirm(p.id, false)} disabled={actionLoading}
                                className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Confirm">
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}
      </div>

      {showManualInvoiceModal && (
        <ManualInvoiceModal
          studentId={studentId}
          onClose={() => setShowManualInvoiceModal(false)}
          onSuccess={load}
        />
      )}

      {showAddItemModal && dashboard && (
        <AddItemModal
          invoiceId={showAddItemModal}
          studentClassId={(dashboard as any).student_class_id}
          onClose={() => setShowAddItemModal(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
