import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import PaymentCallbackClient from './PaymentCallbackClient';

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
        </div>
      }
    >
      <PaymentCallbackClient />
    </Suspense>
  );
}