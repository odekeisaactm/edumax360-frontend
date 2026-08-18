'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { bulkCampaignsAPI } from '@/lib/communication.service';
import type { BulkCampaign } from '@/lib/types';
import {
  ChevronLeft, Loader2, AlertCircle, CheckCircle2, X, RefreshCw,
  Send, Users, Mail, MessageSquare, MessageCircle, AlertTriangle, ShieldAlert
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.error) return String(d.error);
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[150] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm animate-[fadeIn_0.2s_ease-out]
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

const STATUS_META = {
  DRAFT: { color: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Draft' },
  QUEUED: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Queued' },
  SENDING: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Sending...' },
  COMPLETED: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Completed' },
  FAILED: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Completed (with failures)' },
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CampaignTrackingDashboard() {
  const router = useRouter();
  const params = useParams();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('communication.send_bulk_campaign');

  // Safely parse ID to prevent NaN fetches
  const campaignId = params?.id ? Number(params.id) : null;

  const [campaign, setCampaign] = useState<BulkCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isRetrying, setIsRetrying] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const tid = ++_toastId;
    setToasts(prev => [...prev, { id: tid, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500);
  }, []);

  const dismissToast = (tid: number) => setToasts(prev => prev.filter(t => t.id !== tid));

  const fetchCampaign = useCallback(async () => {
    if (!campaignId) return null;
    try {
      const data = await bulkCampaignsAPI.get(campaignId);
      setCampaign(data);
      setNotFound(false);
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) setNotFound(true);
      else showToast('error', extractError(err) || 'Failed to load campaign.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [campaignId, showToast]);

  // Initial Load
  useEffect(() => {
    if (campaignId) fetchCampaign();
  }, [campaignId, fetchCampaign]);

  // Polling Engine (Active while QUEUED or SENDING)
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      if (!isMounted || !campaignId) return;
      const data = await fetchCampaign();

      if (data && (data.status === 'QUEUED' || data.status === 'SENDING')) {
        pollTimeoutRef.current = setTimeout(poll, 3000);
      }
    };

    if (campaign && (campaign.status === 'QUEUED' || campaign.status === 'SENDING')) {
      pollTimeoutRef.current = setTimeout(poll, 3000);
    }

    return () => {
      isMounted = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, [campaign?.status, campaignId, fetchCampaign]);

  const handleRetryFailed = async () => {
    if (!campaign) return;
    setIsRetrying(true);
    try {
      await bulkCampaignsAPI.retryFailed(campaign.id, campaign.channels);
      showToast('success', 'Failed messages re-queued successfully.');
      await fetchCampaign(); // Refresh UI to trigger the polling engine again
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsRetrying(false);
    }
  };

  if (loading || !campaignId) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (notFound || !campaign) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-6">
          <ShieldAlert className="w-12 h-12 text-red-300" />
        </div>
        <p className="text-xl font-black text-slate-700">Campaign Not Found</p>
        <p className="text-sm font-medium text-slate-500 mt-2 mb-6 max-w-xs">
          This campaign may have been deleted or the link is invalid.
        </p>
        <button onClick={() => router.push('/dashboard/staff/communication/campaigns')} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md shadow-indigo-200">
          Back to Hub
        </button>
      </div>
    );
  }

  const meta = STATUS_META[campaign.status as keyof typeof STATUS_META] || STATUS_META.DRAFT;
  const isProcessing = campaign.status === 'QUEUED' || campaign.status === 'SENDING';

  const total = campaign.recipient_count || 1;
  const processed = (campaign.sent_count || 0) + (campaign.failed_count || 0);
  const progressPct = isProcessing ? Math.min(100, Math.round((processed / total) * 100)) : 100;

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto px-4 sm:px-6 pt-6 animate-[fadeIn_0.3s_ease-out]">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Progress Banner ── */}
      {isProcessing && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-3xl p-6 flex items-center gap-5 shadow-sm animate-in slide-in-from-top-2">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-end mb-2.5">
              <p className="text-base font-black text-indigo-900">Dispatching Campaign...</p>
              <p className="text-sm font-bold text-indigo-600">{progressPct}%</p>
            </div>
            <div className="w-full h-2.5 bg-indigo-200/50 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-2.5">
              {processed} of {total} messages processed
            </p>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <button onClick={() => router.push('/dashboard/staff/communication/campaigns')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors mt-1" title="Back to Hub">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <span className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${meta.color}`}>
                {meta.label}
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                CMP-{campaign.id.toString().padStart(4, '0')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">
              {campaign.name}
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1.5">
              Launched on {new Date(campaign.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={fetchCampaign} className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh Stats">
            <RefreshCw className={`w-5 h-5 ${loading && !isProcessing ? 'animate-spin' : ''}`} />
          </button>

          {canManage && campaign.failed_count > 0 && !isProcessing && (
            <button
              onClick={handleRetryFailed}
              disabled={isRetrying}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 text-sm font-bold rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
              Retry {campaign.failed_count} Failed
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between h-[120px]">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Targets</p>
          </div>
          <p className="text-4xl font-black text-slate-800">{campaign.recipient_count || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between h-[120px]">
          <div className="flex items-center gap-2 mb-2">
            <Send className="w-4 h-4 text-emerald-400" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delivered</p>
          </div>
          <p className="text-4xl font-black text-emerald-600">{campaign.sent_count || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between h-[120px]">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Failed</p>
          </div>
          <p className="text-4xl font-black text-red-600">{campaign.failed_count || 0}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between h-[120px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Audience Type</p>
          <p className="text-lg font-bold text-slate-700 break-words leading-tight">{campaign.recipient_type.replace(/_/g, ' ')}</p>
        </div>
      </div>

      {/* ── Content Review ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Email Payload */}
        {campaign.channels.includes('EMAIL') && (
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col h-[520px]">
            <div className="bg-indigo-50/50 px-6 py-4 border-b border-indigo-100 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-bold text-indigo-900 uppercase tracking-widest">Email Payload</span>
            </div>
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Subject</p>
              <p className="text-base font-bold text-slate-800">{campaign.email_subject || '—'}</p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-white">
              {campaign.email_body ? (
                <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: campaign.email_body }} />
              ) : (
                <p className="text-slate-400 italic">No HTML content provided.</p>
              )}
            </div>
          </div>
        )}

        {/* SMS & WhatsApp Payloads */}
        <div className="space-y-6 lg:col-span-1">
          {campaign.channels.includes('SMS') && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
              <div className="bg-sky-50/50 px-6 py-4 border-b border-sky-100 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-600" />
                <span className="text-sm font-bold text-sky-900 uppercase tracking-widest">SMS Payload</span>
              </div>
              <div className="p-6 bg-slate-50/50">
                <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{campaign.sms_message || '—'}</p>
              </div>
            </div>
          )}

          {campaign.channels.includes('WHATSAPP') && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
              <div className="bg-emerald-50/50 px-6 py-4 border-b border-emerald-100 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-900 uppercase tracking-widest">WhatsApp Payload</span>
              </div>
              <div className="p-6 bg-slate-50/50">
                <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">{campaign.whatsapp_message || '—'}</p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}