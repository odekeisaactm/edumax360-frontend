'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { bulkCampaignsAPI } from '@/lib/communication.service';
import { academicAPI, departmentsAPI } from '@/lib/api';
import type { BulkCampaign, BulkRecipientType, MessageChannel } from '@/lib/types';
import {
  Megaphone, X, Loader2, Search, History, AlertTriangle, ArrowRight,
  Send, CheckCircle2, Users, MessageSquare, ShieldAlert, AlertCircle,
  Eye, Mail, MessageCircle, ChevronLeft, Smartphone,
  GraduationCap, Briefcase, Tags, Calculator
} from 'lucide-react';
import RichTextEditor, { stripHtml } from '@/components/communication/RichTextEditor';

// ─── Helpers & Configuration ───────────────────────────────────────────────────

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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
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
  DRAFT: { color: 'bg-slate-100 text-slate-600 border-slate-200' },
  QUEUED: { color: 'bg-amber-100 text-amber-700 border-amber-200' },
  SENDING: { color: 'bg-blue-100 text-blue-700 border-blue-200' },
  COMPLETED: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  FAILED: { color: 'bg-red-100 text-red-700 border-red-200' },
};

const RECIPIENT_TYPES: { value: BulkRecipientType; label: string; icon: any }[] = [
  { value: 'PARENT', label: 'Parents & Guardians', icon: Users },
  { value: 'STUDENT', label: 'Students', icon: GraduationCap },
  { value: 'STAFF', label: 'Staff Members', icon: Briefcase },
  { value: 'CUSTOM_CONTACT', label: 'Custom Contacts', icon: Tags },
];

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Live Preview Component ────────────────────────────────────────────────────

function LivePreviewBody({ channel, emailSubj, emailHtml, smsText, waText }: {
  channel: MessageChannel | null;
  emailSubj: string; emailHtml: string; smsText: string; waText: string;
}) {
  if (!channel) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 border border-slate-200 border-dashed rounded-3xl h-[420px]">
        <Eye className="w-10 h-10 text-slate-300 mb-3" />
        <p className="text-sm font-bold text-slate-500">Preview Device</p>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Select a channel to see how your message will appear.</p>
      </div>
    );
  }

  if (channel === 'EMAIL') {
    return (
      <div className="w-full bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 overflow-hidden h-[450px] flex flex-col animate-[fadeIn_0.2s_ease-out]">
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex-shrink-0 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Subject</p>
            <p className="text-sm font-bold text-slate-800 truncate">{emailSubj || <span className="text-slate-300 italic font-normal">No subject line</span>}</p>
          </div>
        </div>
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
          {stripHtml(emailHtml).trim() ? (
            <div className="text-sm text-slate-700 leading-relaxed prose-sm" dangerouslySetInnerHTML={{ __html: emailHtml }} />
          ) : (
            <p className="text-sm text-slate-300 italic">Start typing to see your email body...</p>
          )}
        </div>
      </div>
    );
  }

  // Phone Mockup (SMS & WhatsApp)
  return (
    <div className="w-72 bg-white rounded-[2.5rem] shadow-2xl border-[6px] border-slate-800 overflow-hidden relative flex flex-col h-[480px] mx-auto animate-[fadeIn_0.2s_ease-out]">
      <div className="absolute top-0 inset-x-0 h-5 flex justify-center z-10">
        <div className="w-24 h-4 bg-slate-800 rounded-b-xl"></div>
      </div>
      <div className={`${channel === 'WHATSAPP' ? 'bg-[#075e54]' : 'bg-blue-500'} h-16 pt-5 px-4 flex items-center gap-2 shadow-sm text-white flex-shrink-0 z-10`}>
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          {channel === 'WHATSAPP' ? <MessageCircle className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">School Update</p>
          <p className="text-[9px] text-white/80">Live Preview</p>
        </div>
      </div>
      <div className={`p-4 flex-1 flex flex-col justify-end pb-8 overflow-y-auto ${channel === 'WHATSAPP' ? 'bg-[#efeae2]' : 'bg-slate-50'}`}>
        {(channel === 'WHATSAPP' ? waText : smsText) ? (
          <div className={`p-3 rounded-2xl shadow-sm ml-4 relative mb-2 break-words ${channel === 'WHATSAPP' ? 'bg-white rounded-tl-sm' : 'bg-blue-100 text-blue-950 rounded-br-sm mr-2 ml-8'}`}>
            <p className={`text-xs whitespace-pre-wrap font-sans leading-relaxed ${channel === 'WHATSAPP' ? 'text-slate-800' : 'text-blue-950'}`}>
              {channel === 'WHATSAPP' ? waText : smsText}
            </p>
            <span className={`text-[8px] absolute bottom-1 right-2 block text-right mt-1.5 ${channel === 'WHATSAPP' ? 'text-slate-400' : 'text-blue-500/70'}`}>Now</span>
          </div>
        ) : (
          <div className="text-center text-xs font-semibold text-slate-400 bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-slate-200">
            Type a message to preview.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Hub Page ────────────────────────────────────────────────────────────

export default function CampaignHubPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canManage = user?.is_superuser || hasPermission('communication.send_bulk_campaign');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 6000);
  }, []);

  // Ledger & System State
  const [campaigns, setCampaigns] = useState<BulkCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Cost Engine Settings
  const [pricingReady, setPricingReady] = useState(false);
  const [smsCharLimit, setSmsCharLimit] = useState(160);
  const [smsCostPerPage, setSmsCostPerPage] = useState(0);
  const [waMinRate, setWaMinRate] = useState(0);
  const [waMaxRate, setWaMaxRate] = useState(0);

  // Filter Data Lookups
  const [classes, setClasses] = useState<any[]>([]);
  const [schoolSections, setSchoolSections] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // Wizard State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    channels: [] as MessageChannel[],
    recipient_type: 'PARENT' as BulkRecipientType,
    filter_criteria: {} as Record<string, any>,
    email_subject: '',
    email_body: '',
    sms_message: '',
    whatsapp_message: '',
  });

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activePreviewTab, setActivePreviewTab] = useState<MessageChannel | null>(null);

  // ─── Initial Data Load (Like StudentsPage) ───
  useEffect(() => {
    const fetchSystemData = async () => {
      setLoading(true);
      try {
        // Fetch ledger
        const res = await bulkCampaignsAPI.list();
        setCampaigns((res as any)?.results || res || []);

        // Fetch Academic & HR References safely
        academicAPI.listClasses().then((c: any) => setClasses(Array.isArray(c?.results) ? c.results : Array.isArray(c) ? c : [])).catch(() => {});
        departmentsAPI.list().then((d: any) => setDepartments(Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [])).catch(() => {});
        api.get('/api/academic/school-sections/').then(r => setSchoolSections(Array.isArray(r.data?.results) ? r.data.results : Array.isArray(r.data) ? r.data : [])).catch(() => {});

        // Fetch Costs Engine Configs
        const [settingsRes, waRatesRes] = await Promise.all([
          api.get('/api/communication/settings/').catch(() => null),
          api.get('/api/communication/whatsapp-rates/').catch(() => null)
        ]);

        if (settingsRes?.data) {
          const s = Array.isArray(settingsRes.data.results) ? settingsRes.data.results[0] : settingsRes.data;
          if (s?.sms_page_character_length) setSmsCharLimit(Number(s.sms_page_character_length));
          if (s?.platform_sms_cost_per_page) setSmsCostPerPage(Number(s.platform_sms_cost_per_page));
        }

        if (waRatesRes?.data) {
          const rates = Array.isArray(waRatesRes.data.results) ? waRatesRes.data.results : waRatesRes.data;
          if (rates && rates.length > 0) {
            const effectiveRates = rates.map((r: any) => Number(r.effective_rate));
            setWaMinRate(Math.min(...effectiveRates));
            setWaMaxRate(Math.max(...effectiveRates));
          }
        }
        setPricingReady(true);
      } catch (err) {
        showToast('error', 'Failed to load campaigns.');
      } finally {
        setLoading(false);
      }
    };
    fetchSystemData();
  }, [showToast]);

  // ─── Live Audience Polling ───
  useEffect(() => {
    if (!isWizardOpen || wizardStep < 2) return;

    let isMounted = true;
    const fetchPreview = async () => {
      setPreviewLoading(true);
      try {
        const res: any = await bulkCampaignsAPI.preview({
          recipient_type: form.recipient_type,
          filter_criteria: form.filter_criteria,
          channels: form.channels.length > 0 ? form.channels : ['EMAIL']
        });
        if (isMounted) setPreviewCount(res.count);
      } catch (err: any) {
        if (isMounted) showToast('error', extractError(err));
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };

    const timeout = setTimeout(fetchPreview, 600);
    return () => { isMounted = false; clearTimeout(timeout); };
  }, [form.recipient_type, form.filter_criteria, form.channels, wizardStep, isWizardOpen, showToast]);

  // ─── Dynamic Pricing Engine ───
  const smsPageCount = Math.max(1, Math.ceil((form.sms_message || '').length / smsCharLimit));

  const estimatedCosts = useMemo(() => {
    const count = previewCount || 0;
    const res = { email: 0, sms: 0, waMin: 0, waMax: 0, totalMin: 0, totalMax: 0 };

    if (form.channels.includes('SMS')) res.sms = count * smsPageCount * smsCostPerPage;
    if (form.channels.includes('WHATSAPP')) {
      res.waMin = count * waMinRate;
      res.waMax = count * waMaxRate;
    }

    res.totalMin = res.email + res.sms + res.waMin;
    res.totalMax = res.email + res.sms + res.waMax;
    return res;
  }, [previewCount, form.channels, smsPageCount, smsCostPerPage, waMinRate, waMaxRate]);

  // ─── Filtering Dependencies ───
  const availableSections = useMemo(() => {
    if (!form.filter_criteria.class_id) return [];
    const cls = classes.find(c => String(c.id) === String(form.filter_criteria.class_id));
    if (!cls?.configurations?.length) return [];

    const seen = new Set<number>();
    const extracted: any[] = [];
    for (const config of cls.configurations) {
      if (config.is_active && !seen.has(config.class_section)) {
        seen.add(config.class_section);
        extracted.push({ id: config.class_section, name: config.class_section_name });
      }
    }
    return extracted;
  }, [form.filter_criteria.class_id, classes]);

  const updateFilter = (key: string, value: any) => {
    setForm(prev => {
      const updated = { ...prev.filter_criteria };
      if (value === '' || value === null) delete updated[key];
      else updated[key] = value;

      // Clean up dependencies
      if (key === 'class_id') delete updated.class_section_id;

      return { ...prev, filter_criteria: updated };
    });
  };

  const handleRecipientTypeChange = (type: BulkRecipientType) => {
    setForm(prev => ({
      ...prev,
      recipient_type: type,
      filter_criteria: {} // Purge filters when switching audiences to avoid dirty state
    }));
  };

  // ─── Actions ───
  const toggleChannel = (ch: MessageChannel) => {
    setForm(prev => ({
      ...prev,
      channels: prev.channels.includes(ch) ? prev.channels.filter(c => c !== ch) : [...prev.channels, ch]
    }));
  };

  useEffect(() => {
    if (wizardStep === 3 && form.channels.length > 0 && !form.channels.includes(activePreviewTab as MessageChannel)) {
      setActivePreviewTab(form.channels[0]);
    }
  }, [wizardStep, form.channels, activePreviewTab]);

  const handleDispatch = async () => {
    setIsExecuting(true);
    try {
      const created = await bulkCampaignsAPI.create(form);
      await bulkCampaignsAPI.queue(created.id);

      showToast('success', 'Campaign created and queued for dispatch!');
      setIsWizardOpen(false);
      resetWizard();
      const res = await bulkCampaignsAPI.list();
      setCampaigns((res as any)?.results || res || []);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsExecuting(false);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setForm({
      name: '', channels: [], recipient_type: 'PARENT', filter_criteria: {},
      email_subject: '', email_body: '', sms_message: '', whatsapp_message: ''
    });
    setPreviewCount(null);
  };

  const attemptCloseWizard = () => {
    if (wizardStep > 1 && !isExecuting) setCloseConfirmOpen(true);
    else { setIsWizardOpen(false); resetWizard(); }
  };

  const filteredCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(p => p.filter(t => t.id !== id))} />

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0 shadow-sm">
            <Megaphone className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">Campaign Manager</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Send bulk multi-channel broadcasts to your school community.</p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => { setIsWizardOpen(true); setWizardStep(1); }} className="w-full md:w-auto justify-center px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-md">
            <Send className="h-4 w-4" /> New Campaign
          </button>
        )}
      </div>

      {/* ── Ledger ── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-indigo-500" />
            <h3 className="font-bold text-slate-800 text-sm">Broadcast History</h3>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white transition-all" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Campaign Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Audience</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channels</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-500 mx-auto"/></td></tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-400 text-sm font-medium">No campaigns found.</td></tr>
              ) : (
                filteredCampaigns.map(c => {
                  const meta = STATUS_META[c.status as keyof typeof STATUS_META] || STATUS_META.DRAFT;
                  return (
                    <tr key={c.id} onClick={() => router.push(`/dashboard/staff/communication/campaigns/${c.id}`)} className="hover:bg-slate-50/70 transition-colors cursor-pointer group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{c.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-400"/>
                          {RECIPIENT_TYPES.find(t => t.value === c.recipient_type)?.label || c.recipient_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1.5">
                          {c.channels.includes('EMAIL') && <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-100"><Mail className="w-3.5 h-3.5" /></span>}
                          {c.channels.includes('SMS') && <span className="p-1.5 bg-sky-50 text-sky-600 rounded-md border border-sky-100"><Smartphone className="w-3.5 h-3.5" /></span>}
                          {c.channels.includes('WHATSAPP') && <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100"><MessageCircle className="w-3.5 h-3.5" /></span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider border inline-block ${meta.color}`}>{c.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-semibold text-slate-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Wizard Drawer (Massive Canvas) ── */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full sm:max-w-5xl xl:w-[90vw] bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right-8 duration-300 border-l border-slate-200">

            {/* Drawer Header */}
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                  <Megaphone className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">Campaign Builder</h2>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5">Step {wizardStep} of 4</p>
                </div>
              </div>
              <button onClick={attemptCloseWizard} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6 md:p-10">
              <div className="max-w-5xl mx-auto h-full">

                {/* STEP 1: SETUP */}
                {wizardStep === 1 && (
                  <div className="space-y-10 animate-in slide-in-from-right-4 max-w-3xl mx-auto pt-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-2.5 uppercase tracking-widest">1. Name Your Campaign <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="e.g. Term 2 Fee Resumption Notice"
                        className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-base font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">2. Select Channels <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                        <button onClick={() => toggleChannel('EMAIL')} className={`p-6 rounded-3xl border text-left flex flex-col gap-4 transition-all ${form.channels.includes('EMAIL') ? 'border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-500/10 shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${form.channels.includes('EMAIL') ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                            <Mail className="h-6 w-6" />
                          </div>
                          <div>
                            <span className={`block text-lg font-black mb-1.5 ${form.channels.includes('EMAIL') ? 'text-indigo-900' : 'text-slate-700'}`}>Email</span>
                            <span className="text-xs font-medium text-slate-500 leading-snug">Rich text formatting, beautiful layouts, and attachments.</span>
                          </div>
                        </button>

                        <button onClick={() => toggleChannel('SMS')} className={`p-6 rounded-3xl border text-left flex flex-col gap-4 transition-all ${form.channels.includes('SMS') ? 'border-sky-500 bg-sky-50/50 ring-4 ring-sky-500/10 shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${form.channels.includes('SMS') ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-500'}`}>
                            <Smartphone className="h-6 w-6" />
                          </div>
                          <div>
                            <span className={`block text-lg font-black mb-1.5 ${form.channels.includes('SMS') ? 'text-sky-900' : 'text-slate-700'}`}>SMS Message</span>
                            <span className="text-xs font-medium text-slate-500 leading-snug">Fast, direct plain-text alerts straight to their mobile device.</span>
                          </div>
                        </button>

                        <button onClick={() => toggleChannel('WHATSAPP')} className={`p-6 rounded-3xl border text-left flex flex-col gap-4 transition-all ${form.channels.includes('WHATSAPP') ? 'border-emerald-500 bg-emerald-50/50 ring-4 ring-emerald-500/10 shadow-lg' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${form.channels.includes('WHATSAPP') ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                            <MessageCircle className="h-6 w-6" />
                          </div>
                          <div>
                            <span className={`block text-lg font-black mb-1.5 ${form.channels.includes('WHATSAPP') ? 'text-emerald-900' : 'text-slate-700'}`}>WhatsApp</span>
                            <span className="text-xs font-medium text-slate-500 leading-snug">Modern delivery with bold formatting and high read rates.</span>
                          </div>
                        </button>

                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: AUDIENCE */}
                {wizardStep === 2 && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 max-w-4xl mx-auto">

                    {/* Live Target Banner */}
                    <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-end justify-between gap-6 border border-slate-800">
                      <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
                        <Users className="w-72 h-72 text-white" />
                      </div>

                      <div className="relative z-10">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Eye className="h-4 w-4"/> Live Audience Match
                        </h3>
                        {previewLoading ? (
                          <div className="flex items-center gap-3 h-[60px]">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-400"/>
                            <span className="text-slate-300 font-medium">Calculating targets...</span>
                          </div>
                        ) : (
                          <div className="flex items-baseline gap-2.5">
                            <span className="text-6xl font-black text-white leading-none">{previewCount ?? 0}</span>
                            <span className="text-base font-bold text-slate-400">Recipients</span>
                          </div>
                        )}
                      </div>

                      <div className="relative z-10 md:text-right border-t border-slate-800 md:border-0 pt-5 md:pt-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center md:justify-end gap-1.5">
                          <Calculator className="h-3 w-3" /> Estimated Total Cost
                        </p>
                        {pricingReady ? (
                          <p className="text-2xl font-mono font-bold text-emerald-400">
                            {estimatedCosts.totalMin === estimatedCosts.totalMax
                              ? `~ ${formatCurrency(estimatedCosts.totalMin)}`
                              : `btw ${formatCurrency(estimatedCosts.totalMin)} to ${formatCurrency(estimatedCosts.totalMax)}`
                            }
                          </p>
                        ) : (
                          <p className="text-sm font-semibold text-slate-500 italic">Calculating pricing...</p>
                        )}
                        <p className="text-[10px] text-slate-500 font-medium mt-1">Rates vary by channel & destination.</p>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-3 uppercase tracking-widest">Target Demographic <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {RECIPIENT_TYPES.map(type => (
                            <button
                              key={type.value}
                              onClick={() => handleRecipientTypeChange(type.value)}
                              className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all ${form.recipient_type === type.value ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                            >
                              <type.icon className="w-6 h-6" />
                              <span className="text-xs font-bold text-center">{type.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Granular Filters Engine */}
                      <div className="pt-6 border-t border-slate-100">
                        <label className="block text-[11px] font-bold text-slate-500 mb-4 uppercase tracking-widest">Granular Filters</label>

                        {form.recipient_type === 'PARENT' && (
                          <div className="space-y-5">
                            <label className="flex items-center gap-4 cursor-pointer p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors">
                              <input
                                type="checkbox"
                                checked={form.filter_criteria.require_active_ward ?? true}
                                onChange={e => updateFilter('require_active_ward', e.target.checked)}
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div>
                                <span className="block text-sm font-bold text-slate-800">Only Parents with Active Wards</span>
                                <span className="block text-xs text-slate-500 font-medium mt-0.5">Exclude parents whose children have graduated, been suspended, or left the school.</span>
                              </div>
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className={labelCls}>Specific School Section</label>
                                <select
                                  value={form.filter_criteria.school_section_id || ''}
                                  onChange={e => updateFilter('school_section_id', e.target.value)}
                                  className={inputCls}
                                >
                                  <option value="">All Sections</option>
                                  {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className={labelCls}>Specific Class</label>
                                <select
                                  value={form.filter_criteria.class_id || ''}
                                  onChange={e => updateFilter('class_id', e.target.value)}
                                  className={inputCls}
                                >
                                  <option value="">All Classes</option>
                                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {form.recipient_type === 'STUDENT' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className={labelCls}>Specific Class</label>
                              <select
                                value={form.filter_criteria.class_id || ''}
                                onChange={e => updateFilter('class_id', e.target.value)}
                                className={inputCls}
                              >
                                <option value="">All Classes</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Specific Arm <span className="lowercase font-normal opacity-70">(Optional)</span></label>
                              <select
                                value={form.filter_criteria.class_section_id || ''}
                                onChange={e => updateFilter('class_section_id', e.target.value)}
                                disabled={!form.filter_criteria.class_id}
                                className={`${inputCls} disabled:opacity-50`}
                              >
                                <option value="">All Arms</option>
                                {availableSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                          </div>
                        )}

                        {form.recipient_type === 'STAFF' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className={labelCls}>Department</label>
                              <select
                                value={form.filter_criteria.department_id || ''}
                                onChange={e => updateFilter('department_id', e.target.value)}
                                className={inputCls}
                              >
                                <option value="">All Departments</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Staff Type</label>
                              <select
                                value={form.filter_criteria.staff_type || ''}
                                onChange={e => updateFilter('staff_type', e.target.value)}
                                className={inputCls}
                              >
                                <option value="">All Types</option>
                                <option value="teaching">Teaching Staff</option>
                                <option value="non_teaching">Non-Teaching Staff</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {form.recipient_type === 'CUSTOM_CONTACT' && (
                          <div>
                            <label className={labelCls}>Filter by Tag</label>
                            <input
                              type="text"
                              placeholder="e.g. 'Vendor' or 'Alumni'"
                              value={form.filter_criteria.tag || ''}
                              onChange={e => updateFilter('tag', e.target.value)}
                              className={inputCls}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: COMPOSITION */}
                {wizardStep === 3 && (
                  <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-14rem)] animate-in slide-in-from-right-4">

                    {/* Left: Input Composer */}
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                      {form.channels.includes('EMAIL') && (
                        <div className="bg-white rounded-3xl border border-indigo-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                          <div className="bg-indigo-50/70 px-6 py-4 border-b border-indigo-100 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-indigo-600"/>
                            <span className="font-bold text-indigo-900 text-sm uppercase tracking-widest">Email Designer</span>
                          </div>
                          <div className="p-6 space-y-5">
                            <div>
                              <label className={labelCls}>Email Subject</label>
                              <input
                                type="text"
                                value={form.email_subject}
                                onChange={e => setForm({...form, email_subject: e.target.value})}
                                onFocus={() => setActivePreviewTab('EMAIL')}
                                placeholder="Write a compelling subject line..."
                                className={inputCls}
                              />
                            </div>
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm" onFocus={() => setActivePreviewTab('EMAIL')}>
                              <RichTextEditor
                                content={form.email_body}
                                onChange={val => setForm({...form, email_body: val})}
                                placeholder="Design your email content here. Use the toolbar to add formatting, links, and lists..."
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {form.channels.includes('SMS') && (
                        <div className="bg-white rounded-3xl border border-sky-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
                          <div className="bg-sky-50/70 px-6 py-4 border-b border-sky-100 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Smartphone className="w-5 h-5 text-sky-600"/>
                              <span className="font-bold text-sky-900 text-sm uppercase tracking-widest">SMS Message</span>
                            </div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded border ${smsPageCount > 1 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {form.sms_message.length} chars • {smsPageCount} Page(s)
                            </span>
                          </div>
                          <div className="p-6">
                            <textarea
                              value={form.sms_message}
                              onChange={e => setForm({...form, sms_message: e.target.value})}
                              onFocus={() => setActivePreviewTab('SMS')}
                              placeholder="Type your plain text SMS here..."
                              rows={5}
                              className={`${inputCls} resize-y custom-scrollbar`}
                            />
                            <p className="text-[10px] font-semibold text-slate-400 mt-2 text-right">Standard SMS rate: {formatCurrency(smsCostPerPage)} per page.</p>
                          </div>
                        </div>
                      )}

                      {form.channels.includes('WHATSAPP') && (
                        <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                          <div className="bg-emerald-50/70 px-6 py-4 border-b border-emerald-100 flex items-center gap-2">
                            <MessageCircle className="w-5 h-5 text-emerald-600"/>
                            <span className="font-bold text-emerald-900 text-sm uppercase tracking-widest">WhatsApp Message</span>
                          </div>
                          <div className="p-6">
                            <textarea
                              value={form.whatsapp_message}
                              onChange={e => setForm({...form, whatsapp_message: e.target.value})}
                              onFocus={() => setActivePreviewTab('WHATSAPP')}
                              placeholder="WhatsApp allows basic formatting like *bold* and _italic_..."
                              rows={5}
                              className={`${inputCls} resize-y custom-scrollbar`}
                            />
                            <p className="text-[10px] font-semibold text-slate-400 mt-2 text-right">Rates vary by destination country.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Persistent Live Preview */}
                    <div className="hidden lg:flex flex-col w-[360px] flex-shrink-0 bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 items-center justify-center">
                      <div className="flex items-center gap-2 mb-6">
                        <Eye className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Device Preview</span>
                      </div>
                      <LivePreviewBody
                        channel={activePreviewTab}
                        emailSubj={form.email_subject}
                        emailHtml={form.email_body}
                        smsText={form.sms_message}
                        waText={form.whatsapp_message}
                      />
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW & DISPATCH */}
                {wizardStep === 4 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 max-w-2xl mx-auto pt-6">

                    <div className="bg-slate-900 rounded-[2rem] p-10 text-center shadow-2xl relative overflow-hidden">
                      <div className="absolute -right-6 -top-6 opacity-10">
                        <Send className="w-48 h-48 text-white" />
                      </div>
                      <div className="relative z-10">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg">
                          <Send className="h-10 w-10 text-white" />
                        </div>
                        <h3 className="text-3xl font-black text-white mb-2 tracking-tight">Ready to Dispatch!</h3>
                        <p className="text-sm text-slate-300 font-medium">
                          You are about to launch <strong className="text-white">"{form.name}"</strong> to <strong className="text-emerald-400">{previewCount} targeted recipients</strong>.
                        </p>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-200 p-3 shadow-sm divide-y divide-slate-100">

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4"/> Audience</span>
                        <span className="text-sm font-black text-slate-900">{RECIPIENT_TYPES.find(t => t.value === form.recipient_type)?.label}</span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><Megaphone className="w-4 h-4"/> Channels</span>
                        <div className="flex gap-2">
                          {form.channels.includes('EMAIL') && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase rounded-md border border-indigo-100">Email</span>}
                          {form.channels.includes('SMS') && <span className="px-2.5 py-1 bg-sky-50 text-sky-700 text-[10px] font-bold uppercase rounded-md border border-sky-100">SMS</span>}
                          {form.channels.includes('WHATSAPP') && <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase rounded-md border border-emerald-100">WhatsApp</span>}
                        </div>
                      </div>

                      <div className="p-6 bg-slate-50/50 rounded-b-[1.25rem] space-y-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200 pb-3"><Calculator className="w-4 h-4"/> Pricing Breakdown</h4>

                        <div className="space-y-3">
                          {form.channels.includes('EMAIL') && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-slate-600">Email Dispatch</span>
                              <span className="text-sm font-bold text-slate-900">Free</span>
                            </div>
                          )}
                          {form.channels.includes('SMS') && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-slate-600">SMS ({smsPageCount} Page{smsPageCount>1?'s':''})</span>
                              <span className="text-sm font-bold text-slate-900">~ {formatCurrency(estimatedCosts.sms)}</span>
                            </div>
                          )}
                          {form.channels.includes('WHATSAPP') && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-semibold text-slate-600">WhatsApp</span>
                              <span className="text-sm font-bold text-slate-900">
                                {estimatedCosts.waMin === estimatedCosts.waMax
                                  ? `~ ${formatCurrency(estimatedCosts.waMin)}`
                                  : `btw ${formatCurrency(estimatedCosts.waMin)} to ${formatCurrency(estimatedCosts.waMax)}`}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="pt-5 border-t border-slate-200 flex flex-col items-end">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Estimate</span>
                          <span className="text-2xl font-black text-emerald-600 leading-none">
                            {estimatedCosts.totalMin === estimatedCosts.totalMax
                              ? `~ ${formatCurrency(estimatedCosts.totalMin)}`
                              : `btw ${formatCurrency(estimatedCosts.totalMin)} to ${formatCurrency(estimatedCosts.totalMax)}`}
                          </span>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-8 py-5 border-t border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
              {wizardStep > 1 ? (
                <button onClick={() => setWizardStep(p => (p - 1) as any)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors">
                  Go Back
                </button>
              ) : <div></div>}

              {wizardStep < 4 ? (
                <button onClick={() => {
                  if (wizardStep === 1 && !form.name) return showToast('error', 'Campaign name is required.');
                  if (wizardStep === 1 && form.channels.length === 0) return showToast('error', 'Select at least one channel.');
                  if (wizardStep === 3 && form.channels.includes('EMAIL') && (!form.email_subject || !stripHtml(form.email_body))) return showToast('error', 'Email subject and body are required.');
                  if (wizardStep === 3 && form.channels.includes('SMS') && !form.sms_message) return showToast('error', 'SMS message is required.');
                  if (wizardStep === 3 && form.channels.includes('WHATSAPP') && !form.whatsapp_message) return showToast('error', 'WhatsApp message is required.');

                  setWizardStep(p => (p + 1) as any);
                }} className="px-8 py-3 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-md flex items-center gap-2">
                  Next Step <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleDispatch} disabled={isExecuting} className="px-8 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-indigo-200">
                  {isExecuting ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5"/>} Dispatch Campaign
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Discard Confirm ── */}
      {closeConfirmOpen && (
        <div className="fixed inset-0 z-[250] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setCloseConfirmOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5 bg-amber-50 text-amber-600 border border-amber-100">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">Discard Campaign?</h3>
            <p className="text-sm text-slate-500 text-center mb-8 leading-relaxed font-medium">
              You have unsaved progress in the wizard. Closing now will delete this draft entirely.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCloseConfirmOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">Keep Editing</button>
              <button onClick={() => { setCloseConfirmOpen(false); setIsWizardOpen(false); resetWizard(); }} className="flex-1 py-3 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 transition-colors shadow-md shadow-rose-200">Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}