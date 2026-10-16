'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function PaymentCallbackClient() {
  const params = useSearchParams();
  const router = useRouter();
  const ref = params.get('ref');

  const [status, setStatus] = useState<'loading' | 'confirmed' | 'pending' | 'error'>('loading');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref) { setStatus('error'); setError('Missing reference.'); return; }

    let attempts = 0;
    const poll = async () => {
      try {
        const res = await api.get(`/api/billing/public/pay/verify/?ref=${ref}`);
        setData(res.data);
        if (res.data.status === 'confirmed') {
          setStatus('confirmed');
          return;
        }
        if (attempts >= 10) { setStatus('pending'); return; }
        attempts++;
        setTimeout(poll, 2500);
      } catch (e: any) {
        setStatus('error');
        setError(e.response?.data?.detail || e.message);
      }
    };
    poll();
  }, [ref]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Confirming your payment...</h2>
          </>
        )}
        {status === 'confirmed' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Payment Successful</h2>
            <p className="text-sm text-slate-500">
              Your subscription is now active. You can log in again.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 rounded-xl text-white font-bold bg-gradient-to-r from-indigo-600 to-blue-600"
            >
              Go to Login
            </button>
          </>
        )}
        {status === 'pending' && (
          <>
            <Loader2 className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Payment Processing</h2>
            <p className="text-sm text-slate-500">
              We're still confirming your payment. Please log in again in a minute.
            </p>
            <Link href="/login" className="text-indigo-600 font-semibold text-sm">
              Back to Login
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-500">{error}</p>
            <Link href="/login" className="text-indigo-600 font-semibold text-sm">
              Back to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}