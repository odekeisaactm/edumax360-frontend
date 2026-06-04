'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { learningAISettingsAPI, aiConfigAPI } from '@/lib/api';
import { LearningResourcesAISettings, SchoolAIConfig } from '@/lib/types';
import {
  Settings, Edit3, Check, X, AlertCircle, Sparkles,
  Loader2, Brain, FileText, Zap, Mic, Video,
  RefreshCw, ChevronDown, SlidersHorizontal,
  BookOpen, FlashlightIcon as Flash, HelpCircle,
  Shield, Volume2, Gauge, Hash, ToggleLeft,
} from 'lucide-react';

// ─── Default form values ───────────────────────────────────────────────────────
const DEFAULT_FORM: Partial<LearningResourcesAISettings> = {
    ai_service: undefined,
  enable_auto_note_generation: true,
  enable_auto_summary: true,
  enable_auto_flashcards: true,
  enable_auto_quiz_generation: true,
  enable_ai_vetting: true,
  vetting_criteria: {
    check_curriculum_alignment: true,
    check_grammar: true,
    check_completeness: true,
  },
  auto_approve_threshold: 0.9,
  summary_length: 'medium',
  key_points_count: 5,
  enable_text_to_speech: true,
  tts_voice: 'af_sarah',
  tts_speed: 1.0,
  enable_live_recording: false,
};

const VOICE_LABELS: Record<string, string> = {
  af_sarah: 'Sarah (Female, US)',
  af_bella: 'Bella (Female, US)',
  af_nicole: 'Nicole (Female, US)',
  af_sky: 'Sky (Female, US)',
  am_adam: 'Adam (Male, US)',
  am_michael: 'Michael (Male, US)',
  bf_emma: 'Emma (Female, UK)',
  bf_isabella: 'Isabella (Female, UK)',
  bm_george: 'George (Male, UK)',
  bm_lewis: 'Lewis (Male, UK)',
  'en-US-Neural2-F': 'Neural2-F (Female, US)',
  'en-US-Neural2-D': 'Neural2-D (Male, US)',
  'en-GB-Neural2-A': 'Neural2-A (Female, UK)',
  'en-GB-Neural2-B': 'Neural2-B (Male, UK)',
};

function settingsToForm(s: LearningResourcesAISettings): Partial<LearningResourcesAISettings> {
  return {
      ai_service: s.ai_service ?? null,
    enable_auto_note_generation: s.enable_auto_note_generation ?? true,
    enable_auto_summary: s.enable_auto_summary ?? true,
    enable_auto_flashcards: s.enable_auto_flashcards ?? true,
    enable_auto_quiz_generation: s.enable_auto_quiz_generation ?? true,
    enable_ai_vetting: s.enable_ai_vetting ?? true,
    vetting_criteria: s.vetting_criteria ?? {
      check_curriculum_alignment: true,
      check_grammar: true,
      check_completeness: true,
    },
    auto_approve_threshold: s.auto_approve_threshold ?? 0.9,
    summary_length: s.summary_length ?? 'medium',
    key_points_count: s.key_points_count ?? 5,
    enable_text_to_speech: s.enable_text_to_speech ?? true,
    tts_voice: s.tts_voice ?? 'en-US-Neural2-F',
    tts_speed: s.tts_speed ?? 1.0,
    enable_live_recording: s.enable_live_recording ?? false,
  };
}

// ─── Reusable Toggle ───────────────────────────────────────────────────────────
function Toggle({
  checked, onChange, label, description,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 flex-shrink-0 ${checked ? 'bg-emerald-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({
  value, activeLabel = 'Enabled', inactiveLabel = 'Disabled', danger = false,
}: {
  value: boolean; activeLabel?: string; inactiveLabel?: string; danger?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      value
        ? danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? danger ? 'bg-red-500' : 'bg-emerald-500' : 'bg-slate-400'}`} />
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

// ─── Setting Row ───────────────────────────────────────────────────────────────
function SettingRow({
  icon: Icon, iconBg, label, value, description,
}: {
  icon: any; iconBg: string; label: string; value: React.ReactNode; description: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-4 hover:bg-slate-50/70 rounded-xl transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <div className="flex-shrink-0">{value}</div>
    </div>
  );
}

// ─── Input / Label ─────────────────────────────────────────────────────────────
const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  settings, isSaving, onSave, onClose,
}: {
  settings: LearningResourcesAISettings | null;
  isSaving: boolean;
  onSave: (f: Partial<LearningResourcesAISettings>) => Promise<void>;
  onClose: () => void;
}) {
  type TabId = 'content' | 'vetting' | 'summary' | 'tts' | 'live';
  const [activeTab, setActiveTab] = useState<TabId>('content');
  const [form, setForm] = useState<Partial<LearningResourcesAISettings>>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiConfigs, setAIConfigs] = useState<SchoolAIConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);

    useEffect(() => {
      setLoadingConfigs(true);
      aiConfigAPI.list()
        .then(data => setAIConfigs(data))
        .catch(() => {})
        .finally(() => setLoadingConfigs(false));
    }, []);

  const set = <K extends keyof LearningResourcesAISettings>(key: K, value: LearningResourcesAISettings[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setVettingCriteria = (key: string, value: boolean) =>
    setForm(prev => ({
      ...prev,
      vetting_criteria: { ...(prev.vetting_criteria ?? {}), [key]: value },
    }));

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setSaveError(null);
  try {
    await onSave(form);
  } catch (err: any) {
    const data = err?.response?.data;
    if (!data) {
      setSaveError(err?.message || 'An unexpected error occurred.');
      return;
    }
    // Non-field errors (from validate())
    if (data.non_field_errors) {
      setSaveError(Array.isArray(data.non_field_errors)
        ? data.non_field_errors.join('\n')
        : data.non_field_errors);
      return;
    }
    // Field-level errors
    if (typeof data === 'object' && !data.message) {
      const msgs = Object.entries(data)
        .map(([field, errors]: [string, any]) => {
          const label = field.replace(/_/g, ' ');
          const msg = Array.isArray(errors) ? errors.join(', ') : String(errors);
          return `${label}: ${msg}`;
        })
        .join('\n');
      setSaveError(msgs);
      return;
    }
    // Wrapped message
    setSaveError(data?.message || 'Failed to save AI settings.');
  }
};

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'content', label: 'Content AI', icon: Brain },
    { id: 'vetting', label: 'Vetting', icon: Shield },
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'tts', label: 'Text-to-Speech', icon: Volume2 },
    { id: 'live', label: 'Live Class', icon: Video },
  ];

  const criteria = form.vetting_criteria ?? {};

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {settings ? 'Edit AI Settings' : 'Configure AI Settings'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0 gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id ? 'text-emerald-600 border-emerald-600' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form id="ai-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── Content AI ── */}
            {activeTab === 'content' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure which AI-powered content generation features are active.</p>
                {/* AI Service selector */}
    <div>
      <label className={labelCls}>AI Service</label>
      <select
        value={form.ai_service ?? ''}
        onChange={e => set('ai_service' as any, e.target.value ? Number(e.target.value) : null)}
        className={inputCls}
      >
        <option value="">— No AI service (disable all AI features) —</option>
        {aiConfigs.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <p className="text-xs text-slate-400 mt-1">
        Configure AI services in <strong>Settings → AI Config</strong>. Required if any AI feature below is enabled.
      </p>
    </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={!!form.enable_auto_note_generation} onChange={v => set('enable_auto_note_generation', v)}
                    label="Auto Note Generation" description="AI generates lesson notes from topics" />
                  <Toggle checked={!!form.enable_auto_summary} onChange={v => set('enable_auto_summary', v)}
                    label="Auto Summary" description="Summarize PDFs, DOCX, and PPT uploads" />
                  <Toggle checked={!!form.enable_auto_flashcards} onChange={v => set('enable_auto_flashcards', v)}
                    label="Auto Flashcards" description="Generate study flashcards from content" />
                  <Toggle checked={!!form.enable_auto_quiz_generation} onChange={v => set('enable_auto_quiz_generation', v)}
                    label="Auto Quiz Generation" description="Generate quiz questions from materials" />
                </div>
              </div>
            )}

            {/* ── Vetting ── */}
            {activeTab === 'vetting' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">AI reviews lesson notes before they reach an approver. Configure what gets checked.</p>
                <Toggle checked={!!form.enable_ai_vetting} onChange={v => set('enable_ai_vetting', v)}
                  label="Enable AI Vetting" description="AI reviews lesson notes submitted for approval" />

                <div className="space-y-2">
                  <p className={labelCls}>Vetting Criteria</p>
                  <div className="space-y-2">
                    <Toggle checked={!!criteria.check_curriculum_alignment}
                      onChange={v => setVettingCriteria('check_curriculum_alignment', v)}
                      label="Curriculum Alignment" description="Does the note align with standard curriculum?" />
                    <Toggle checked={!!criteria.check_grammar}
                      onChange={v => setVettingCriteria('check_grammar', v)}
                      label="Grammar Quality" description="Is language appropriate and grammatically correct?" />
                    <Toggle checked={!!criteria.check_completeness}
                      onChange={v => setVettingCriteria('check_completeness', v)}
                      label="Completeness" description="Does the note have objectives, content, and conclusion?" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Auto-Approve Threshold</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={form.auto_approve_threshold ?? 0.9}
                      onChange={e => set('auto_approve_threshold', parseFloat(e.target.value))}
                      className="flex-1 accent-emerald-600"
                    />
                    <span className="text-sm font-bold text-slate-700 w-12 text-right">
                      {Math.round((form.auto_approve_threshold ?? 0.9) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Notes scoring at or above this threshold are auto-approved. Currently: <strong>{Math.round((form.auto_approve_threshold ?? 0.9) * 100)}%</strong>
                  </p>
                </div>
              </div>
            )}

            {/* ── Summary ── */}
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Control the length and depth of AI-generated summaries.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Summary Length</label>
                    <select value={form.summary_length ?? 'medium'} onChange={e => set('summary_length', e.target.value as any)} className={inputCls}>
                      <option value="short">Short (100–200 words)</option>
                      <option value="medium">Medium (300–500 words)</option>
                      <option value="long">Long (500–1000 words)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Key Points Count</label>
                    <input type="number" value={form.key_points_count ?? 5}
                      onChange={e => set('key_points_count', Number(e.target.value))}
                      min={1} max={20} className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Number of key points to extract (1–20)</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TTS ── */}
            {activeTab === 'tts' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure text-to-speech audio generation for lesson notes and summaries.</p>
                <Toggle checked={!!form.enable_text_to_speech} onChange={v => set('enable_text_to_speech', v)}
                  label="Enable Text-to-Speech" description="Generate audio versions of lesson content" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className={labelCls}>Voice</label>
                      <select
                        value={form.tts_voice ?? 'af_sarah'}
                        onChange={e => set('tts_voice', e.target.value)}
                        className={inputCls}
                      >
                        <optgroup label="Kokoro Voices (Self-hosted)">
                          <option value="af_sarah">Sarah — Female, American English</option>
                          <option value="af_bella">Bella — Female, American English</option>
                          <option value="af_nicole">Nicole — Female, American English</option>
                          <option value="af_sky">Sky — Female, American English</option>
                          <option value="am_adam">Adam — Male, American English</option>
                          <option value="am_michael">Michael — Male, American English</option>
                          <option value="bf_emma">Emma — Female, British English</option>
                          <option value="bf_isabella">Isabella — Female, British English</option>
                          <option value="bm_george">George — Male, British English</option>
                          <option value="bm_lewis">Lewis — Male, British English</option>
                        </optgroup>
                        <optgroup label="Google Neural Voices (Cloud)">
                          <option value="en-US-Neural2-F">Neural2-F — Female, US English</option>
                          <option value="en-US-Neural2-D">Neural2-D — Male, US English</option>
                          <option value="en-GB-Neural2-A">Neural2-A — Female, British English</option>
                          <option value="en-GB-Neural2-B">Neural2-B — Male, British English</option>
                        </optgroup>
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                        Kokoro voices work with your self-hosted setup. Google Neural voices require Cloud TTS.
                      </p>
                    </div>
                  <div>
                    <label className={labelCls}>Speech Speed</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={0.5} max={2.0} step={0.1}
                        value={form.tts_speed ?? 1.0}
                        onChange={e => set('tts_speed', parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-600"
                      />
                      <span className="text-sm font-bold text-slate-700 w-10 text-right">
                        {(form.tts_speed ?? 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">0.5x (slow) — 2.0x (fast)</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Live Class ── */}
            {activeTab === 'live' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Default recording behaviour for live class sessions. Can be overridden per session.</p>
                <Toggle checked={!!form.enable_live_recording} onChange={v => set('enable_live_recording', v)}
                  label="Enable Live Recording by Default"
                  description="School-wide default for client-side session recording. Recordings save to participants' devices only — nothing is stored on the server." />
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  Recording is client-side only (browser MediaRecorder). Files are downloaded to the participant's device. No server storage is used regardless of this setting.
                </div>
              </div>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="ai-settings-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" />{settings ? 'Save Changes' : 'Create Settings'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function LearningAISettingsPage() {
  const { hasPermission, user } = useAuth();
  const [aiSettings, setAISettings] = useState<LearningResourcesAISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('learning_resources.view_learningresourcesaisettingsmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await learningAISettingsAPI.getGlobal();
      if (data === null) { setPageError('not_found'); setAISettings(null); }
      else { setAISettings(data); }
    } catch { setPageError('fetch_error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: Partial<LearningResourcesAISettings>) => {
    setIsSaving(true);
    try {
      let updated: LearningResourcesAISettings;
      if (aiSettings) {
        updated = await learningAISettingsAPI.update(aiSettings.id, form);
      } else {
        updated = await learningAISettingsAPI.create(form);
      }
      setAISettings(updated);
      setIsEditing(false);
      setPageError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading AI settings...</p>
      </div>
    </div>
  );

  // ── Fetch error ──
  if (pageError === 'fetch_error') return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load AI settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  // ── Not found (first-time setup) ──
  if (pageError === 'not_found' && !aiSettings) return (
    <>
      {isEditing && <SettingsModal settings={null} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto">
            <Brain className="h-10 w-10 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Learning AI</h3>
            <p className="text-slate-400 text-sm">Set up AI features for lesson notes, materials, summaries, flashcards and live classes.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200">
              <Sparkles className="h-5 w-5" /> Set Up AI Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to configure AI settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = aiSettings!;
  const approveThresholdPct = Math.round((s.auto_approve_threshold ?? 0.9) * 100);
  const activeFeatureCount = [
    s.enable_auto_note_generation,
    s.enable_auto_summary,
    s.enable_auto_flashcards,
    s.enable_auto_quiz_generation,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">AI settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && (
        <SettingsModal settings={s} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Brain className="h-5 w-5 text-white" />
            </div>
            Learning AI Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            {s.school_section_name} — AI configuration for content generation and live classes
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Active AI Features',
            value: `${activeFeatureCount} / 4`,
            icon: Zap,
            color: 'from-emerald-500 to-teal-600',
          },
          {
            label: 'Auto-Approve Threshold',
            value: `${approveThresholdPct}%`,
            icon: Gauge,
            color: 'from-blue-500 to-indigo-600',
          },
          {
            label: 'Summary Length',
            value: s.summary_length ?? 'medium',
            icon: FileText,
            color: 'from-violet-500 to-purple-600',
          },
          {
            label: 'TTS Speed',
            value: `${(s.tts_speed ?? 1.0).toFixed(1)}x`,
            icon: Volume2,
            color: 'from-orange-400 to-amber-500',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 capitalize truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Three cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Content Generation */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Brain className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Content Generation</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Brain} iconBg="bg-emerald-50 text-emerald-600"
                label="AI Service"
                description="Configured AI provider for this school"
                value={
                  <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg max-w-[120px] truncate block text-right">
                    {s.ai_service_name || 'Not configured'}
                  </span>
                } />
            <SettingRow icon={BookOpen} iconBg="bg-emerald-50 text-emerald-600"
              label="Auto Note Generation"
              description="AI generates lesson notes from topics"
              value={<StatusBadge value={s.enable_auto_note_generation} />} />
            <SettingRow icon={FileText} iconBg="bg-teal-50 text-teal-600"
              label="Auto Summary"
              description="Summarize uploaded PDFs, DOCX, and PPT"
              value={<StatusBadge value={s.enable_auto_summary} />} />
            <SettingRow icon={Zap} iconBg="bg-cyan-50 text-cyan-600"
              label="Auto Flashcards"
              description="Generate study flashcards from content"
              value={<StatusBadge value={s.enable_auto_flashcards} />} />
            <SettingRow icon={HelpCircle} iconBg="bg-sky-50 text-sky-600"
              label="Auto Quiz Generation"
              description="Generate quiz questions from materials"
              value={<StatusBadge value={s.enable_auto_quiz_generation} />} />
          </div>
        </div>

        {/* Vetting & Summary */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Vetting & Summary</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Shield} iconBg="bg-blue-50 text-blue-600"
              label="AI Vetting"
              description="AI reviews notes before approval"
              value={<StatusBadge value={s.enable_ai_vetting} />} />
            <SettingRow icon={Gauge} iconBg="bg-indigo-50 text-indigo-600"
              label="Auto-Approve Threshold"
              description="Confidence score required for auto-approval"
              value={
                <span className="text-xs font-bold text-slate-700 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">
                  {approveThresholdPct}%
                </span>
              } />
            <SettingRow icon={FileText} iconBg="bg-violet-50 text-violet-600"
              label="Summary Length"
              description="Default depth of AI summaries"
              value={
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">
                  {s.summary_length}
                </span>
              } />
            <SettingRow icon={Hash} iconBg="bg-purple-50 text-purple-600"
              label="Key Points Count"
              description="Points extracted per summary"
              value={<span className="text-xs font-bold text-slate-700">{s.key_points_count} points</span>} />
          </div>
        </div>

        {/* TTS & Live Class */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <Volume2 className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">TTS & Live Class</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Volume2} iconBg="bg-orange-50 text-orange-600"
              label="Text-to-Speech"
              description="Generate audio from lesson content"
              value={<StatusBadge value={s.enable_text_to_speech} />} />
            <SettingRow icon={Mic} iconBg="bg-amber-50 text-amber-600"
              label="TTS Voice"
              description="Kokoro voice identifier in use"
              value={
                <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg max-w-[100px] truncate block text-right">
                  {VOICE_LABELS[s.tts_voice] || s.tts_voice || '—'}
                </span>
              } />
            <SettingRow icon={Gauge} iconBg="bg-rose-50 text-rose-600"
              label="TTS Speed"
              description="Speech playback speed multiplier"
              value={<span className="text-xs font-bold text-slate-700">{(s.tts_speed ?? 1.0).toFixed(1)}x</span>} />
            <SettingRow icon={Video} iconBg="bg-red-50 text-red-600"
              label="Live Recording Default"
              description="Default recording setting for new sessions"
              value={<StatusBadge value={s.enable_live_recording} activeLabel="On by default" inactiveLabel="Off by default" />} />
          </div>

          {/* Vetting criteria badge cluster */}
          <div className="mx-4 mb-4 mt-2 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Active Vetting Checks</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'check_curriculum_alignment', label: 'Curriculum' },
                { key: 'check_grammar', label: 'Grammar' },
                { key: 'check_completeness', label: 'Completeness' },
              ].map(({ key, label }) => (
                <span key={key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  s.vetting_criteria?.[key]
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-400 line-through'
                }`}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full settings table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">All Settings</h3>
          <span className="text-xs text-slate-400">Complete AI configuration overview</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/60">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-5">Setting</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Value</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { label: 'Auto Note Generation', value: <StatusBadge value={s.enable_auto_note_generation} />, desc: 'AI generates lesson note content from a topic and objectives' },
                { label: 'Auto Summary', value: <StatusBadge value={s.enable_auto_summary} />, desc: 'Auto-generate summaries from uploaded PDF, DOCX, and PPTX files' },
                { label: 'Auto Flashcards', value: <StatusBadge value={s.enable_auto_flashcards} />, desc: 'Generate study flashcard sets from content automatically' },
                { label: 'Auto Quiz Generation', value: <StatusBadge value={s.enable_auto_quiz_generation} />, desc: 'Generate quiz questions from materials and lesson notes' },
                { label: 'AI Vetting', value: <StatusBadge value={s.enable_ai_vetting} />, desc: 'AI reviews submitted lesson notes before manual approval' },
                { label: 'Check Curriculum Alignment', value: <StatusBadge value={!!s.vetting_criteria?.check_curriculum_alignment} />, desc: 'Vetting checks curriculum alignment' },
                { label: 'Check Grammar', value: <StatusBadge value={!!s.vetting_criteria?.check_grammar} />, desc: 'Vetting checks grammar and language quality' },
                { label: 'Check Completeness', value: <StatusBadge value={!!s.vetting_criteria?.check_completeness} />, desc: 'Vetting checks for objectives, content and conclusion' },
                { label: 'Auto-Approve Threshold', value: <span className="text-sm font-bold text-slate-700">{approveThresholdPct}%</span>, desc: 'AI confidence score required to auto-approve a note' },
                { label: 'Summary Length', value: <span className="capitalize text-sm text-slate-700">{s.summary_length}</span>, desc: 'Default word count range for generated summaries' },
                { label: 'Key Points Count', value: <span className="text-sm text-slate-700">{s.key_points_count} points</span>, desc: 'Number of key points extracted per summary' },
                { label: 'Text-to-Speech', value: <StatusBadge value={s.enable_text_to_speech} />, desc: 'Generate audio from lesson notes and material summaries' },
                { label: 'TTS Voice', value: <span className="font-mono text-sm text-slate-700">{VOICE_LABELS[s.tts_voice] || s.tts_voice || '—'}</span>, desc: 'Kokoro voice ID used for audio generation' },
                { label: 'TTS Speed', value: <span className="text-sm text-slate-700">{(s.tts_speed ?? 1.0).toFixed(1)}x</span>, desc: 'Speech playback speed multiplier (0.5–2.0)' },
                { label: 'Live Recording Default', value: <StatusBadge value={s.enable_live_recording} activeLabel="On by default" inactiveLabel="Off by default" />, desc: 'School-wide default for client-side session recording' },
              ].map(({ label, value, desc }) => (
                <tr key={label} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-5 text-sm font-medium text-slate-700 whitespace-nowrap">{label}</td>
                  <td className="py-3.5 px-4">{value}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last updated */}
      {s.updated_at && (
        <p className="text-xs text-slate-400 text-right">
          Last updated: {new Date(s.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}