'use client';

import React, { useEffect, useState } from 'react';
import { bankDetailsAPI } from '@/lib/api';
import { Landmark, CreditCard, Wallet, Copy, CheckCircle2 } from 'lucide-react';

export default function ParentBanksPage() {
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await bankDetailsAPI.list({ is_active: true, account_type: 'bank' });
        setBanks(response || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch school bank accounts.');
      } finally {
        setLoading(false);
      }
    };
    fetchBanks();
  }, []);

  const handleCopy = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatPurpose = (purpose: string) => {
    switch (purpose) {
      case 'fee_payment':
        return 'Fee Payment';
      case 'wallet_funding':
        return 'Wallet Funding';
      case 'both':
        return 'Fee & Wallet Funding';
      default:
        return 'General Purpose';
    }
  };

  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'fee_payment':
        return <CreditCard className="h-5 w-5 text-indigo-500" />;
      case 'wallet_funding':
        return <Wallet className="h-5 w-5 text-emerald-500" />;
      case 'both':
      default:
        return <Landmark className="h-5 w-5 text-fuchsia-500" />;
    }
  };

  const getGradientByPurpose = (purpose: string) => {
    switch (purpose) {
      case 'fee_payment':
        return 'from-indigo-500/10 via-indigo-500/5 to-transparent border-indigo-100';
      case 'wallet_funding':
        return 'from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-100';
      case 'both':
      default:
        return 'from-fuchsia-500/10 via-fuchsia-500/5 to-transparent border-fuchsia-100';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
        <p className="mt-4 text-slate-500 font-medium">Loading bank accounts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl max-w-md text-center">
          <p className="font-semibold text-lg">Oops!</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">School Bank Accounts</h1>
          <p className="text-slate-500 mt-1">
            Make payments directly to the school's approved bank accounts below.
          </p>
        </div>
      </div>

      {banks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
          <Landmark className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-800">No Bank Accounts Found</h3>
          <p className="text-slate-500 mt-2 max-w-sm mx-auto">
            The school has not added any active bank accounts yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map((bank, index) => (
            <div
              key={bank.id || index}
              className={`relative bg-white rounded-3xl overflow-hidden border ${getGradientByPurpose(bank.purpose)} shadow-sm hover:shadow-xl transition-all duration-300 group`}
            >
              {/* Decorative Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${getGradientByPurpose(bank.purpose)} opacity-50 pointer-events-none`}></div>
              
              <div className="relative p-6 z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-6">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center">
                    {getPurposeIcon(bank.purpose)}
                  </div>
                  <div className="bg-white/60 backdrop-blur-md px-3 py-1 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
                    {formatPurpose(bank.purpose)}
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Bank Name</p>
                    <p className="text-lg font-bold text-slate-900">{bank.bank_name || bank.bank?.name || 'Unknown Bank'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Account Name</p>
                    <p className="text-base font-semibold text-slate-800 line-clamp-1">{bank.account_name}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200/60">
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Account Number</p>
                  <div className="flex items-center justify-between bg-slate-50/80 backdrop-blur-sm border border-slate-200 rounded-2xl p-3 group-hover:bg-white group-hover:border-indigo-100 transition-colors">
                    <p className="text-2xl font-mono font-bold tracking-widest text-slate-900">
                      {bank.account_number}
                    </p>
                    <button
                      onClick={() => handleCopy(bank.account_number, bank.id || index)}
                      className={`p-2 rounded-xl transition-all ${copiedId === (bank.id || index) ? 'bg-green-100 text-green-600' : 'bg-white shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200'}`}
                      title="Copy account number"
                    >
                      {copiedId === (bank.id || index) ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
