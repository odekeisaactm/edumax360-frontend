'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api, feeAPI } from '@/lib/api';
import { ArrowLeft, Loader2, Download, Receipt, Wallet, User, Check, AlertCircle } from 'lucide-react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';

function formatCurrency(amount: string | number | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount || 0);
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'student'; // 'student' | 'family'
  
  const id = params.id as string;
  
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchInvoice = async () => {
      setLoading(true);
      setError(null);
      try {
        let res;
        if (type === 'family') {
          res = await api.get(`/api/fee/family-invoices/${id}/`);
        } else {
          res = await api.get(`/api/fee/invoices/${id}/`);
        }
        setInvoice(res.data);
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id, type]);

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>;
  }

  if (error || !invoice) {
    return <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Invoice Not Found</h1>
      <p className="text-slate-500 mb-6">{error || 'The requested invoice could not be found or you do not have permission.'}</p>
      <button onClick={() => router.back()} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-medium">
        Go Back
      </button>
    </div>;
  }

  const isPaid = parseFloat(invoice.balance || '0') <= 0;
  const isPartiallyPaid = parseFloat(invoice.amount_paid || '0') > 0 && !isPaid;

  const downloadPdfUrl = type === 'family' 
    ? `/api/fee/family-invoices/${id}/pdf/` 
    : `/api/fee/invoices/${id}/pdf/`;

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-20">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                Invoice {invoice.invoice_number}
                {isPaid ? (
                  <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1"><Check className="w-3 h-3"/> PAID</span>
                ) : isPartiallyPaid ? (
                  <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">PARTIAL</span>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full">UNPAID</span>
                )}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Issued on {new Date(invoice.issue_date || invoice.created_at).toLocaleDateString()} 
                {invoice.due_date && ` • Due on ${new Date(invoice.due_date).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href={api.defaults.baseURL + downloadPdfUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow flex items-center gap-2 transition-colors">
              <Download className="w-4 h-4" /> Download PDF
            </a>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <User className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Billed To</h2>
            </div>
            
            {type === 'family' ? (
              <div className="space-y-1 text-sm text-slate-600">
                <p className="font-semibold text-slate-800 text-base">{invoice.parent_name || 'Family Account'}</p>
                {invoice.parent_email && <p>{invoice.parent_email}</p>}
                {invoice.parent_phone && <p>{invoice.parent_phone}</p>}
              </div>
            ) : (
              <div className="space-y-1 text-sm text-slate-600">
                <p className="font-semibold text-slate-800 text-base">{invoice.student?.full_name}</p>
                <p>Reg No: {invoice.student?.registration_number}</p>
                <p>Class: {invoice.student?.current_class?.name || invoice.student?.current_class_name} {invoice.student?.current_class_section?.name || ''}</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                <Wallet className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Summary</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed</span>
                <span className="font-medium text-slate-800">{formatCurrency(invoice.total_amount)}</span>
              </div>
              {(parseFloat(invoice.total_discount || '0') > 0 || parseFloat(invoice.total_waived || '0') > 0) && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium text-emerald-600">-{formatCurrency(invoice.total_discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waived</span>
                    <span className="font-medium text-amber-600">-{formatCurrency(invoice.total_waived)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid</span>
                <span className="font-medium text-slate-800">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between font-bold text-base">
                <span className="text-slate-800">Balance Due</span>
                <span className={isPaid ? 'text-emerald-600' : 'text-red-600'}>{formatCurrency(invoice.balance)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-400" /> Invoice Items
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-right">Discount</th>
                  <th className="px-6 py-4 text-right">Waived</th>
                  <th className="px-6 py-4 text-right">Paid</th>
                  <th className="px-6 py-4 text-right font-bold text-slate-700">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invoice.items || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">No items found on this invoice.</td>
                  </tr>
                ) : (
                  invoice.items.map((item: any, i: number) => (
                    <tr key={item.id || i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{item.description}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(item.amount)}</td>
                      <td className="px-6 py-4 text-right text-emerald-600">-{formatCurrency(item.total_discount || '0')}</td>
                      <td className="px-6 py-4 text-right text-amber-600">-{formatCurrency(item.total_waived || '0')}</td>
                      <td className="px-6 py-4 text-right">{formatCurrency(item.amount_paid || '0')}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(item.balance || item.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
