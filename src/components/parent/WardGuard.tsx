'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useWard } from '@/context/WardContext';
import { Loader2 } from 'lucide-react';

export default function WardGuard({ children }: { children: React.ReactNode }) {
  const { selectedWard, loading } = useWard();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      const isSelectPage = pathname.includes('/parent/select-ward');

      if (!selectedWard && !isSelectPage) {
        // Force them to the selection screen (whether they have 0 or multiple wards)
        router.replace('/dashboard/parent/select-ward');
      } else if (selectedWard && isSelectPage) {
        // If they already selected, push them to the dashboard
        router.replace('/dashboard/parent');
      }
    }
  }, [loading, selectedWard, pathname, router]);

  // Block rendering of the children (e.g. the Dashboard) if we are loading
  // OR if we are about to redirect them to the select-ward page.
  if (loading || (!selectedWard && !pathname.includes('/parent/select-ward'))) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  return <>{children}</>;
}