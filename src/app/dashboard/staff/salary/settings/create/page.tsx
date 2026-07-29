'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { salarySettingsAPI } from '@/lib/salary_management.service';
import { SalarySetting } from '@/lib/salary_management.types';
import SalarySettingForm from '../_components/SalarySettingForm';

// useSearchParams() requires a Suspense boundary in the app router, or
// `next build` fails with "should be wrapped in a suspense boundary".
export default function CreateSalarySettingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[500px] flex items-center justify-center">
          <div className="flex items-center gap-2.5 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading…</span>
          </div>
        </div>
      }
    >
      <CreateSalarySettingPageInner />
    </Suspense>
  );
}

function CreateSalarySettingPageInner() {
  const searchParams = useSearchParams();
  const duplicateFromId = searchParams?.get('duplicate_from');

  const [duplicateFrom, setDuplicateFrom] = useState<SalarySetting | null>(null);
  const [loading, setLoading] = useState(!!duplicateFromId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!duplicateFromId) return;
    const numericId = Number(duplicateFromId);
    if (!Number.isFinite(numericId)) {
      setError('Invalid duplicate source id.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await salarySettingsAPI.get(numericId);
        if (!cancelled) setDuplicateFrom(result);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load the setting to duplicate.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [duplicateFromId]);

  // Fetching the source setting to duplicate — block briefly so the form
  // doesn't seed a moment after it renders (which would flash empty
  // accordions and then repopulate).
  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Loading structure to duplicate…</span>
        </div>
      </div>
    );
  }

  // If duplicating failed, don't block create entirely — surface the error
  // and fall through to a normal blank create form.
  if (error) {
    return (
      <div>
        <div className="mb-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Couldn't load the setting to duplicate</p>
            <p className="text-sm mt-0.5">{error} You can still create a setting from scratch below.</p>
          </div>
        </div>
        <SalarySettingForm />
      </div>
    );
  }

  return <SalarySettingForm duplicateFrom={duplicateFrom || undefined} />;
}