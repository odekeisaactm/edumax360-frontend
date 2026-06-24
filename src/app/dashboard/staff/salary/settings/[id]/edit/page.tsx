'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { salarySettingsAPI } from '@/lib/salary_management.service';
import { SalarySetting } from '@/lib/salary_management.types';
import SalarySettingForm from '../../_components/SalarySettingForm';

export default function EditSalarySettingPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<SalarySetting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      setError('Invalid salary setting id.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await salarySettingsAPI.get(numericId);
        if (!cancelled) setData(result);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to load salary setting.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Loading salary setting…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Couldn't load this setting</p>
          <p className="text-sm text-slate-400 mb-4">{error || 'Salary setting not found.'}</p>
          <button
            onClick={() => router.push('/dashboard/staff/salary/settings')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return <SalarySettingForm initialData={data} />;
}