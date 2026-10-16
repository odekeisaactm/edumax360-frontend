'use client';

import React, { useState } from 'react';
import { Loader2, X, CreditCard, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

export interface Ward {
  student_ref: string;
  name: string;
  amount_owed: string;
  session_label?: string;
  period_label?: string;
}

interface Props {
  blockType: string;
  amountOwed: string;
  wards: Ward[];
  parentRef?: string;
  sessionRef?: string;
  periodRef?: string;
  payerEmail?: string;
  onClose: () => void;
}

export default function PaySubscriptionModal({
  blockType, amountOwed, wards, parentRef, sessionRef, periodRef, payerEmail, onClose,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(wards.map(w => w.student_ref)));
  const [email, setEmail] = useState(payerEmail || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const required = blockType === 'parent_subscription' || blockType === 'student_subscription';
  const allSelected = selected.size === wards.length;

  const toggle = (ref: string) => {
    if (required && allSelected && selected.size === 1) return;
    const next = new Set(selected);
    if (next.has(ref)) next.delete(ref); else next.add(ref);
    setSelected(next);
  };

  const computedTotal = wards
    .filter(w => selected.has(w.student_ref))
    .reduce((sum, w) => sum + parseFloat(w.amount_owed || '0'), 0)
    .toFixed(2);

  const handlePay = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const refs = wards.filter(w => selected.has(w.student_ref)).map(w => w.student_ref);
      const payload: any = {
        parent_ref: parentRef || undefined,
        student_refs: refs,
        payment_method: 'paystack',
        payer_email: email,
      };
      if (sessionRef) payload.session_ref = sessionRef;
      if (periodRef) payload.period_ref = periodRef;
      if (wards[0]?.session_label) payload.session_label = wards[0].session_label;
      if (wards[0]?.period_label) payload.period_label = wards[0].period_label;

      const res = await api.post('/api/billing/public/pay/', payload);

      if (res.data?.paystack_url) {
        window.location.href = res.data.paystack_url;
      } else {
        setError('Payment initialization failed.');
      }
    } catch (e: any) {
      const data = e.response?.data;
      let msg = 'Payment failed.';
      if (data) {
        if (typeof data === 'string') msg = data;
        else if (data.detail) msg = String(data.detail);
        else if (data.error) msg = String(data.error);
        else {
          const firstKey = Object.keys(data)[0];
          if (firstKey) {
            const val = data[firstKey];
            msg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : `${firstKey}: ${val}`;
          }
        }
      } else if (e.message) {
        msg = e.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Subscription Payment Required</h2>
              <p className="text-xs text-slate-500">Access is blocked until payment is made</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            {required
              ? 'All outstanding students must be paid to restore login access.'
              : 'Select which students to pay for.'}
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {wards.map((w) => {
              const checked = selected.has(w.student_ref);
              return (
                <label
                  key={w.student_ref}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    checked ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(w.student_ref)}
                      disabled={required && allSelected && selected.size === 1}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{w.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{w.student_ref}</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-700">₦{w.amount_owed}</p>
                </label>
              );
            })}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-sm font-semibold text-slate-500">Total</span>
            <span className="text-xl font-black text-slate-900">₦{computedTotal}</span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePay}
            disabled={loading || selected.size === 0 || !email.includes('@')}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Pay Now
          </button>
        </div>
      </div>
    </div>
  );
}