'use client';

import { useEffect, useState } from 'react';
import { useWard } from '@/context/WardContext';
import PaySubscriptionModal from '@/components/billing/PaySubscriptionModal';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function SubscriptionPayPage() {
  const { wards } = useWard();
  const [loading, setLoading] = useState(true);
  const [wardList, setWardList] = useState<any[]>([]);

  useEffect(() => {
    // Build the wards list from context — we assume each ward is unpaid here.
    // The modal handles selection + calling the API.
    const list = wards.map(w => ({
      student_ref: w.registration_number,
      name: `${w.first_name} ${w.last_name}`,
      amount_owed: '0', // will be filled by backend on pay anyway
      session_label: '',
      period_label: '',
    }));
    setWardList(list);
    setLoading(false);
  }, [wards]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <PaySubscriptionModal
      blockType="parent_subscription"
      amountOwed="0"
      wards={wardList}
      parentRef=""
      onClose={() => window.history.back()}
    />
  );
}