'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { learningAISettingsAPI, schoolSettingsAPI, aiConfigAPI } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import { LearningResourcesSettings, SchoolAIConfig } from '@/lib/types';
import {
  Settings, Edit3, Check, X, AlertCircle, Sparkles,
  Loader2, Brain, FileText, Zap, Mic, Video,
  RefreshCw, Shield, Volume2, Gauge, Hash, ClipboardCheck,
  ChevronRight, Lock, BookOpen, HelpCircle
} from 'lucide-react';

// ─── API Unwrapper (Fixes the Wrapped Response Bug) ───────────────────────────
function unwrap(payload: any) {
  // If backend returns { success: true, data: { ... } }, extract the data
  if (payload && payload.success !== undefined && payload.data !== undefined) {
    return payload.data;
  }
  return payload;
}

// ─── Default form values ───────────────────────────────────────────────────────
const DEFAULT_FORM: Partial<LearningResourcesSettings> = {
  ai_service: undefined,
  auto_approve_scheme_of_work: false,
  auto_approve_lesson_notes: false,
  enable_auto_note_generation: false,
  enable_auto_summary: false,
  enable_auto_flashcards: false,
  enable_auto_quiz_generation: false,
  enable_ai_vetting: false,
  vetting_criteria: {
    check_curriculum_alignment: true,
    check_grammar: true,
    check_completeness: true,
  },
  auto_approve_threshold: 0.9,
  summary_length: 'medium',
  key_points_count: 5,
  enable_text_to_speech: false,
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

function settingsToForm(s: LearningResourcesSettings): Partial<LearningResourcesSettings> {
  return {
    ai_service: s.ai_service ?? null,
    auto_approve_scheme_of_work: s.auto_approve_scheme_of_work ?? false,
    auto_approve_lesson_notes: s.auto_approve_lesson_notes ?? false,
    enable_auto_note_generation: s.enable_auto_note_generation ?? false,
    enable_auto_summary: s.enable_auto_summary ?? false,
    enable_auto_flashcards: s.enable_auto_flashcards ?? false,
    enable_auto_quiz_generation: s.enable_auto_quiz_generation ?? false,
    enable_ai_vetting: s.enable_ai_vetting ?? false,
    vetting_criteria: s.vetting_criteria ?? {
      check_curriculum_alignment: true,
      check_grammar: true,
      check_completeness: true,
    },
    auto_approve_threshold: s.auto_approve_threshold ?? 0.9,
    summary_length: s.summary_length ?? 'medium',
    key_points_count: s.key_points_count ?? 5,
    enable_text_to_speech: s.enable_text_to_speech ?? false,
    tts_voice: s.tts_voice ?? 'en-US-Neural2-F',
    tts_speed: s.tts_speed ?? 1.0,
    enable_live_recording: s.enable_live_recording ?? false,
  };
}

// ─── Reusable Toggle ───────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, description, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 transition-colors ${disabled ? 'opacity-60 cursor-not-allowed grayscale-[30%]' : 'hover:border-slate-200'}`}>
      <div className="flex-1 pr-4">
        <p className={`text-sm font-medium ${disabled ? 'text-slate-500' : 'text-slate-800'}`}>{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${checked ? 'bg-emerald-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function StatusBadge({ value, activeLabel = 'Enabled', inactiveLabel = 'Disabled', danger = false }: {
  value: boolean; activeLabel?: string; inactiveLabel?: string; danger?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      value ? danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? danger ? 'bg-red-500' : 'bg-emerald-500' : 'bg-slate-400'}`} />
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

function SettingRow({ icon: Icon, iconBg, label, value, description }: {
  icon: any; iconBg: string; label: string; value: React.ReactNode; description: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-4 hover:bg-slate-50/70 rounded-xl transition-colors group">
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

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white disabled:bg-slate-50 disabled:text-slate-500";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  settings,
  aiConfigs,
  isAIGloballyActive,
  globalSettings,
  isSaving,
  onSave,
  onClose,
  canManageGlobal
}: {
  settings: LearningResourcesSettings | null;
  aiConfigs: SchoolAIConfig[];
  isAIGloballyActive: boolean;
  globalSettings: any;
  isSaving: boolean;
  onSave: (f: Partial<LearningResourcesSettings>) => Promise<void>;
  onClose: () => void;
  canManageGlobal: boolean;
}) {
  type TabId = 'core' | 'content' | 'vetting' | 'summary' | 'tts' | 'live';
  const [activeTab, setActiveTab] = useState<TabId>('core');
  const [form, setForm] = useState<Partial<LearningResourcesSettings>>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof LearningResourcesSettings>(key: K, value: LearningResourcesSettings[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setVettingCriteria = (key: string, value: boolean) =>
    setForm(prev => ({
      ...prev,
      vetting_criteria: { ...(prev.vetting_criteria ?? {}), [key]: value },
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const payload = { ...form };

    // Master Kill Switch Cleanup: If AI is globally disabled, ensure payload turns off AI features
    if (!isAIGloballyActive) {
      payload.ai_service = null;
      payload.enable_auto_note_generation = false;
      payload.enable_auto_summary = false;
      payload.enable_auto_flashcards = false;
      payload.enable_auto_quiz_generation = false;
      payload.enable_ai_vetting = false;
      payload.enable_text_to_speech = false;
    }

    try { await onSave(payload); }
    catch (err: any) {
      const data = err?.response?.data;
      if (!data) return setSaveError(err?.message || 'An unexpected error occurred.');
      if (data.non_field_errors) return setSaveError(Array.isArray(data.non_field_errors) ? data.non_field_errors.join('\n') : data.non_field_errors);
      if (typeof data === 'object' && !data.message) {
        setSaveError(Object.entries(data).map(([field, errors]: [string, any]) => `${field.replace(/_/g, ' ')}: ${Array.isArray(errors) ? errors.join(', ') : String(errors)}`).join('\n'));
        return;
      }
      setSaveError(data?.message || 'Failed to save settings.');
    }
  };

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'core', label: 'Core Workflows', icon: Settings },
    { id: 'content', label: 'Content AI', icon: Brain },
    { id: 'vetting', label: 'Vetting', icon: Shield },
    { id: 'summary', label: 'Summary', icon: FileText },
    { id: 'tts', label: 'Text-to-Speech', icon: Volume2 },
    { id: 'live', label: 'Live Class', icon: Video },
  ];

  const criteria = form.vetting_criteria ?? {};

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {settings ? 'Edit Learning Management Settings' : 'Configure Learning Management'}
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
        <form id="learning-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 bg-slate-50/20">
          <div className="p-6 space-y-6">

            {/* Global AI Config Notice for AI tabs */}
            {activeTab !== 'core' && activeTab !== 'live' && !isAIGloballyActive && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <strong className="block text-amber-900 mb-0.5">AI is Globally Disabled</strong>
                    The AI Billing Mode is currently disabled or missing an API key in the global School Settings. All AI features are locked off.
                  </div>
                </div>
                {canManageGlobal && (
                  <Link href="/dashboard/setup/school-settings" onClick={onClose}
                    className="flex-shrink-0 px-4 py-2 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap shadow-sm">
                    Manage Global AI
                  </Link>
                )}
              </div>
            )}

            {/* ── Core Workflows ── */}
            {activeTab === 'core' && (
              <div className="space-y-4 max-w-2xl">
                <p className="text-sm text-slate-500">Configure global approval rules. These apply regardless of whether AI features are enabled.</p>
                <div className="grid grid-cols-1 gap-4 mt-4">
                  <Toggle checked={!!form.auto_approve_scheme_of_work} onChange={v => set('auto_approve_scheme_of_work', v)}
                    label="Auto-Approve Schemes of Work" description="Skip manual HOD review. Schemes go straight to 'approved' when teachers submit them." />
                  <Toggle checked={!!form.auto_approve_lesson_notes} onChange={v => set('auto_approve_lesson_notes', v)}
                    label="Auto-Approve Lesson Notes" description="Skip manual review. Lesson notes become visible to students (if granted) instantly upon submission." />
                </div>
              </div>
            )}

            {/* ── Content AI ── */}
            {activeTab === 'content' && (
              <div className="space-y-6 max-w-3xl">

                {/* AI Service Selector */}
                <div className={`p-5 rounded-xl border border-slate-200 bg-white ${!isAIGloballyActive && 'opacity-60'}`}>
                  <label className={labelCls}>Active AI Provider for Learning</label>
                  <select
                    value={form.ai_service ?? ''}
                    onChange={e => set('ai_service', e.target.value ? Number(e.target.value) : null)}
                    className={`${inputCls} max-w-md`}
                    disabled={!isAIGloballyActive}
                  >
                    <option value="">— Select an AI Provider —</option>
                    {aiConfigs.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.provider})</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Select which AI service to use for Lesson Notes and Summaries. This is required if any feature below is enabled.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Toggle
                    disabled={!isAIGloballyActive}
                    checked={isAIGloballyActive && !!form.enable_auto_note_generation}
                    onChange={v => set('enable_auto_note_generation', v)}
                    label="Auto Note Generation" description="AI generates lesson notes from topics" />
                  <Toggle
                    disabled={!isAIGloballyActive}
                    checked={isAIGloballyActive && !!form.enable_auto_summary}
                    onChange={v => set('enable_auto_summary', v)}
                    label="Auto Summary" description="Summarize PDFs, DOCX, and PPT uploads" />
                  <Toggle
                    disabled={!isAIGloballyActive}
                    checked={isAIGloballyActive && !!form.enable_auto_flashcards}
                    onChange={v => set('enable_auto_flashcards', v)}
                    label="Auto Flashcards" description="Generate study flashcards from content" />
                  <Toggle
                    disabled={!isAIGloballyActive}
                    checked={isAIGloballyActive && !!form.enable_auto_quiz_generation}
                    onChange={v => set('enable_auto_quiz_generation', v)}
                    label="Auto Quiz Generation" description="Generate quiz questions from materials" />
                </div>
              </div>
            )}

            {/* ── Vetting ── */}
            {activeTab === 'vetting' && (
              <div className="space-y-6 max-w-3xl">
                <Toggle
                  disabled={!isAIGloballyActive}
                  checked={isAIGloballyActive && !!form.enable_ai_vetting}
                  onChange={v => set('enable_ai_vetting', v)}
                  label="Enable AI Vetting" description="AI reviews lesson notes submitted for approval" />

                <div className={`space-y-3 ${!isAIGloballyActive && 'opacity-50'}`}>
                  <p className={labelCls}>Vetting Criteria</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Toggle disabled={!isAIGloballyActive} checked={!!criteria.check_curriculum_alignment}
                      onChange={v => setVettingCriteria('check_curriculum_alignment', v)}
                      label="Curriculum Alignment" description="Check alignment with standard curriculum" />
                    <Toggle disabled={!isAIGloballyActive} checked={!!criteria.check_grammar}
                      onChange={v => setVettingCriteria('check_grammar', v)}
                      label="Grammar Quality" description="Check language appropriateness" />
                    <Toggle disabled={!isAIGloballyActive} checked={!!criteria.check_completeness}
                      onChange={v => setVettingCriteria('check_completeness', v)}
                      label="Completeness" description="Check for objectives, content, and conclusion" />
                  </div>
                </div>

                <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${!isAIGloballyActive && 'opacity-50'}`}>
                  <label className={labelCls}>Auto-Approve Threshold</label>
                  <div className="flex items-center gap-4 mt-2">
                    <input
                      type="range" min={0} max={1} step={0.05}
                      disabled={!isAIGloballyActive}
                      value={form.auto_approve_threshold ?? 0.9}
                      onChange={e => set('auto_approve_threshold', parseFloat(e.target.value))}
                      className="flex-1 accent-emerald-600 disabled:accent-slate-400"
                    />
                    <span className={`text-lg font-bold w-16 text-right ${isAIGloballyActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {Math.round((form.auto_approve_threshold ?? 0.9) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    If AI vetting is enabled and the AI scores the note at or above this threshold, it bypasses manual human review.
                  </p>
                </div>
              </div>
            )}

            {/* ── Summary ── */}
            {activeTab === 'summary' && (
              <div className="space-y-4 max-w-2xl">
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${!isAIGloballyActive && 'opacity-50'}`}>
                  <div>
                    <label className={labelCls}>Summary Length</label>
                    <select disabled={!isAIGloballyActive} value={form.summary_length ?? 'medium'} onChange={e => set('summary_length', e.target.value as any)} className={inputCls}>
                      <option value="short">Short (100–200 words)</option>
                      <option value="medium">Medium (300–500 words)</option>
                      <option value="long">Long (500–1000 words)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Key Points Count</label>
                    <input disabled={!isAIGloballyActive} type="number" value={form.key_points_count ?? 5}
                      onChange={e => set('key_points_count', Number(e.target.value))}
                      min={1} max={20} className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Number of key points to extract (1–20)</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── TTS ── */}
            {activeTab === 'tts' && (
              <div className="space-y-6 max-w-3xl">
                <Toggle
                  disabled={!isAIGloballyActive}
                  checked={isAIGloballyActive && !!form.enable_text_to_speech}
                  onChange={v => set('enable_text_to_speech', v)}
                  label="Enable Text-to-Speech" description="Generate audio versions of lesson content" />
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-6 ${!isAIGloballyActive && 'opacity-50'}`}>
                  <div>
                    <label className={labelCls}>Voice</label>
                    <select
                      disabled={!isAIGloballyActive}
                      value={form.tts_voice ?? 'af_sarah'}
                      onChange={e => set('tts_voice', e.target.value)}
                      className={inputCls}
                    >
                      <optgroup label="Kokoro Voices (Self-hosted)">
                        <option value="af_sarah">Sarah (Female, US)</option>
                        <option value="af_bella">Bella (Female, US)</option>
                        <option value="af_nicole">Nicole (Female, US)</option>
                        <option value="af_sky">Sky (Female, US)</option>
                        <option value="am_adam">Adam (Male, US)</option>
                        <option value="am_michael">Michael (Male, US)</option>
                        <option value="bf_emma">Emma (Female, UK)</option>
                        <option value="bf_isabella">Isabella (Female, UK)</option>
                        <option value="bm_george">George (Male, UK)</option>
                        <option value="bm_lewis">Lewis (Male, UK)</option>
                      </optgroup>
                      <optgroup label="Google Neural Voices (Cloud)">
                        <option value="en-US-Neural2-F">Neural2-F (Female, US)</option>
                        <option value="en-US-Neural2-D">Neural2-D (Male, US)</option>
                        <option value="en-GB-Neural2-A">Neural2-A (Female, UK)</option>
                        <option value="en-GB-Neural2-B">Neural2-B (Male, UK)</option>
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Speech Speed</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={0.5} max={2.0} step={0.1}
                        disabled={!isAIGloballyActive}
                        value={form.tts_speed ?? 1.0}
                        onChange={e => set('tts_speed', parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-600 disabled:accent-slate-400"
                      />
                      <span className={`text-sm font-bold w-10 text-right ${isAIGloballyActive ? 'text-slate-700' : 'text-slate-400'}`}>
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
              <div className="space-y-4 max-w-2xl">
                <Toggle checked={!!form.enable_live_recording} onChange={v => set('enable_live_recording', v)}
                  label="Enable Live Recording by Default"
                  description="School-wide default for client-side session recording. Can be overridden per session." />
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 mt-4">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
                  Recording is client-side only (browser MediaRecorder). Files are downloaded to the participant's device. No server storage is used regardless of this setting.
                </div>
              </div>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-5 py-2.5 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="learning-settings-form" disabled={isSaving}
            className="px-6 py-2.5 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
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
export default function LearningSettingsPage() {
  const { hasPermission, user } = useAuth();
  const { authReady } = useRequireAuth();

  const [learningSettings, setLearningSettings] = useState<LearningResourcesSettings | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [aiConfigs, setAiConfigs] = useState<SchoolAIConfig[]>([]);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('learning_resources.view_learningresourcessettingsmodel');
  const canManageGlobal = user?.is_superuser || hasPermission('school_configuration.change_schoolsettingsmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [learningRes, globalRes, aiRes] = await Promise.all([
        learningAISettingsAPI.getGlobal().catch(() => null),
        schoolSettingsAPI.get().catch(() => null),
        aiConfigAPI.list().catch(() => []),
      ]);

      const learningData = unwrap(learningRes);
      const globalData = unwrap(globalRes);
      const aiData = unwrap(aiRes);

      if (!learningData) { setPageError('not_found'); setLearningSettings(null); }
      else { setLearningSettings(learningData); }

      setGlobalSettings(globalData);
      setAiConfigs(Array.isArray(aiData) ? aiData.filter((c: any) => c.is_active) : []);

    } catch {
      setPageError('fetch_error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady && user) fetchSettings();
  }, [fetchSettings, authReady, user]);

  const handleSave = async (form: Partial<LearningResourcesSettings>) => {
    setIsSaving(true);
    try {
      let updated: LearningResourcesSettings;
      if (learningSettings) {
        updated = await learningAISettingsAPI.update(learningSettings.id, form);
      } else {
        updated = await learningAISettingsAPI.create(form);
      }
      setLearningSettings(unwrap(updated));
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

  if (!authReady || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
    </div>
  );

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading Learning Management settings...</p>
      </div>
    </div>
  );

  if (pageError === 'fetch_error') return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  // Master Kill Switch Logic
  const isAIGloballyActive =
    globalSettings &&
    globalSettings.ai_billing_mode !== 'disabled' &&
    (globalSettings.ai_billing_mode !== 'school_owns_key' || !!globalSettings.active_ai_config);

  if (pageError === 'not_found' && !learningSettings) return (
    <>
      {isEditing && <SettingsModal settings={null} aiConfigs={aiConfigs} globalSettings={globalSettings} isAIGloballyActive={isAIGloballyActive} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} canManageGlobal={canManageGlobal} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto">
            <Settings className="h-10 w-10 text-emerald-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Learning Management</h3>
            <p className="text-slate-500 text-sm">Set up core workflows, approvals, and AI features for lesson notes, materials, and live classes.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-200">
              <Sparkles className="h-5 w-5" /> Initialize Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to configure learning settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = learningSettings!;
  const approveThresholdPct = Math.round((s.auto_approve_threshold ?? 0.9) * 100);

  // Calculate active AI feature count ONLY if AI is globally active
  const activeAIFeatureCount = isAIGloballyActive ? [
    s.enable_auto_note_generation,
    s.enable_auto_summary,
    s.enable_auto_flashcards,
    s.enable_auto_quiz_generation,
  ].filter(Boolean).length : 0;

  // Resolve the configured AI name for the display card
  const selectedAIProviderName = aiConfigs.find(c => c.id === s.ai_service)?.name || (s as any).ai_service_name || 'Not configured';

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && (
        <SettingsModal settings={s} aiConfigs={aiConfigs} globalSettings={globalSettings} isAIGloballyActive={isAIGloballyActive} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} canManageGlobal={canManageGlobal} />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Settings className="h-5 w-5 text-white" />
            </div>
            Learning Management Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1 pl-13">
            {s.school_section_name} — Configure approvals, automations, and AI tools
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Auto-Approvals',
            value: (s.auto_approve_scheme_of_work && s.auto_approve_lesson_notes) ? 'All Active' : (s.auto_approve_scheme_of_work || s.auto_approve_lesson_notes) ? 'Partial' : 'Disabled',
            icon: ClipboardCheck,
            color: 'from-blue-500 to-indigo-600',
          },
          {
            label: 'Active AI Features',
            value: isAIGloballyActive ? `${activeAIFeatureCount} / 4` : 'Off (Global Lock)',
            icon: Zap,
            color: isAIGloballyActive ? 'from-emerald-500 to-teal-600' : 'from-slate-400 to-slate-500',
          },
          {
            label: 'AI Vetting Threshold',
            value: isAIGloballyActive && s.enable_ai_vetting ? `${approveThresholdPct}%` : '—',
            icon: Gauge,
            color: isAIGloballyActive && s.enable_ai_vetting ? 'from-violet-500 to-purple-600' : 'from-slate-400 to-slate-500',
          },
          {
            label: 'TTS Playback Speed',
            value: isAIGloballyActive && s.enable_text_to_speech ? `${(s.tts_speed ?? 1.0).toFixed(1)}x` : '—',
            icon: Volume2,
            color: isAIGloballyActive && s.enable_text_to_speech ? 'from-orange-400 to-amber-500' : 'from-slate-400 to-slate-500',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide truncate">{label}</p>
              <p className="text-base font-bold text-slate-900 capitalize truncate mt-0.5">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Global Warning Banner on Main View */}
      {!isAIGloballyActive && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong className="block text-amber-900 text-sm mb-0.5">AI Processing is Disabled</strong>
              <p className="text-xs text-amber-800">
                The global AI Billing Mode is set to 'Disabled' or is missing an API key in School Settings. All AI tools in this module have been locked down.
              </p>
            </div>
          </div>
          {canManageGlobal && (
            <Link href="/dashboard/setup/school-settings"
              className="flex-shrink-0 px-4 py-2 bg-white border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap shadow-sm">
              Manage Global AI
            </Link>
          )}
        </div>
      )}

      {/* ── Four cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Core Workflows */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="h-4 w-4 text-blue-700" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Core Workflows</h3>
          </div>
          <div className="p-3 flex-1">
            <SettingRow icon={FileText} iconBg="bg-blue-50 text-blue-600"
              label="Schemes of Work"
              description="Auto-approve without human review"
              value={<StatusBadge value={s.auto_approve_scheme_of_work} />} />
            <SettingRow icon={BookOpen} iconBg="bg-indigo-50 text-indigo-600"
              label="Lesson Notes"
              description="Auto-approve without human review"
              value={<StatusBadge value={s.auto_approve_lesson_notes} />} />
          </div>
        </div>

        {/* Content Generation (AI) */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-opacity ${!isAIGloballyActive && 'opacity-60 grayscale-[30%]'}`}>
          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Brain className="h-4 w-4 text-emerald-700" />
            </div>
            <h3 className="text-base font-bold text-slate-800">AI Content Generation</h3>
          </div>
          <div className="p-3 flex-1">
            <SettingRow icon={Brain} iconBg="bg-slate-100 text-slate-600"
                label="Learning AI Provider"
                description="Selected API for Notes & Summaries"
                value={
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg max-w-[120px] truncate block text-right ${isAIGloballyActive && s.ai_service ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                    {selectedAIProviderName}
                  </span>
                } />
            <SettingRow icon={BookOpen} iconBg="bg-emerald-50 text-emerald-600"
              label="Auto Note Generation"
              description="AI creates structured notes from topics"
              value={<StatusBadge value={isAIGloballyActive && s.enable_auto_note_generation} />} />
            <SettingRow icon={FileText} iconBg="bg-teal-50 text-teal-600"
              label="Auto Summary"
              description="Summarize uploaded materials"
              value={<StatusBadge value={isAIGloballyActive && s.enable_auto_summary} />} />
            <SettingRow icon={Zap} iconBg="bg-cyan-50 text-cyan-600"
              label="Auto Flashcards"
              description="Generate study cards from content"
              value={<StatusBadge value={isAIGloballyActive && s.enable_auto_flashcards} />} />
            <SettingRow icon={HelpCircle} iconBg="bg-sky-50 text-sky-600"
              label="Auto Quizzes"
              description="Generate practice tests"
              value={<StatusBadge value={isAIGloballyActive && s.enable_auto_quiz_generation} />} />
          </div>
        </div>

        {/* Vetting & Summary */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col transition-opacity ${!isAIGloballyActive && 'opacity-60 grayscale-[30%]'}`}>
          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
              <Shield className="h-4 w-4 text-violet-700" />
            </div>
            <h3 className="text-base font-bold text-slate-800">AI Vetting & Summaries</h3>
          </div>
          <div className="p-3 flex-1">
            <SettingRow icon={Shield} iconBg="bg-violet-50 text-violet-600"
              label="AI Vetting"
              description="AI pre-reviews teacher notes"
              value={<StatusBadge value={isAIGloballyActive && s.enable_ai_vetting} />} />
            <SettingRow icon={Gauge} iconBg="bg-fuchsia-50 text-fuchsia-600"
              label="Vetting Threshold"
              description="AI score required to bypass human review"
              value={
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${isAIGloballyActive ? 'text-fuchsia-700 bg-fuchsia-50' : 'text-slate-500 bg-slate-100'}`}>
                  {approveThresholdPct}%
                </span>
              } />
            <SettingRow icon={FileText} iconBg="bg-purple-50 text-purple-600"
              label="Summary Length"
              description="Default length of AI summaries"
              value={
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg capitalize">
                  {s.summary_length}
                </span>
              } />
            <SettingRow icon={Hash} iconBg="bg-pink-50 text-pink-600"
              label="Key Points"
              description="Bullet points per summary"
              value={<span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{s.key_points_count} pts</span>} />

            {/* Vetting checks mini-display */}
            <div className="mx-4 mb-2 mt-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Vetting Checks Applied</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'check_curriculum_alignment', label: 'Curriculum' },
                  { key: 'check_grammar', label: 'Grammar' },
                  { key: 'check_completeness', label: 'Completeness' },
                ].map(({ key, label }) => (
                  <span key={key} className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    isAIGloballyActive && s.vetting_criteria?.[key] ? 'bg-violet-100 text-violet-700' : 'bg-slate-200 text-slate-400 line-through'
                  }`}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TTS & Live Class */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Volume2 className="h-4 w-4 text-orange-700" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Media & Live Classes</h3>
          </div>
          <div className="p-3 flex-1">
            <SettingRow icon={Volume2} iconBg="bg-orange-50 text-orange-600"
              label="Text-to-Speech"
              description="Generate audio from content"
              value={<StatusBadge value={isAIGloballyActive && s.enable_text_to_speech} />} />
            <SettingRow icon={Mic} iconBg="bg-amber-50 text-amber-600"
              label="TTS Voice"
              description="Active voice profile"
              value={
                <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg max-w-[110px] truncate block text-right">
                  {VOICE_LABELS[s.tts_voice] || s.tts_voice || '—'}
                </span>
              } />
            <SettingRow icon={Gauge} iconBg="bg-rose-50 text-rose-600"
              label="TTS Speed"
              description="Audio playback speed"
              value={<span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{(s.tts_speed ?? 1.0).toFixed(1)}x</span>} />
            <SettingRow icon={Video} iconBg="bg-red-50 text-red-600"
              label="Live Recording"
              description="Session recording default"
              value={<StatusBadge value={s.enable_live_recording} activeLabel="On" inactiveLabel="Off" />} />
          </div>
        </div>
      </div>

      {/* ── Full settings table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">All Settings</h3>
          <span className="text-xs text-slate-400">Complete configuration overview</span>
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
                { label: 'Auto-Approve Schemes', value: <StatusBadge value={s.auto_approve_scheme_of_work} />, desc: 'Bypass manual approval for schemes of work' },
                { label: 'Auto-Approve Notes', value: <StatusBadge value={s.auto_approve_lesson_notes} />, desc: 'Bypass manual approval for lesson notes' },
                { label: 'Learning AI Provider', value: <span className="text-sm font-semibold text-slate-700">{selectedAIProviderName}</span>, desc: 'Selected API configuration for this module' },
                { label: 'Auto Note Generation', value: <StatusBadge value={isAIGloballyActive && s.enable_auto_note_generation} />, desc: 'AI generates lesson note content from a topic and objectives' },
                { label: 'Auto Summary', value: <StatusBadge value={isAIGloballyActive && s.enable_auto_summary} />, desc: 'Auto-generate summaries from uploaded files' },
                { label: 'Auto Flashcards', value: <StatusBadge value={isAIGloballyActive && s.enable_auto_flashcards} />, desc: 'Generate study flashcard sets from content automatically' },
                { label: 'Auto Quiz Generation', value: <StatusBadge value={isAIGloballyActive && s.enable_auto_quiz_generation} />, desc: 'Generate quiz questions from materials and lesson notes' },
                { label: 'AI Vetting', value: <StatusBadge value={isAIGloballyActive && s.enable_ai_vetting} />, desc: 'AI reviews submitted lesson notes before manual approval' },
                { label: 'Check Curriculum Alignment', value: <StatusBadge value={isAIGloballyActive && !!s.vetting_criteria?.check_curriculum_alignment} />, desc: 'Vetting checks curriculum alignment' },
                { label: 'Check Grammar', value: <StatusBadge value={isAIGloballyActive && !!s.vetting_criteria?.check_grammar} />, desc: 'Vetting checks grammar and language quality' },
                { label: 'Check Completeness', value: <StatusBadge value={isAIGloballyActive && !!s.vetting_criteria?.check_completeness} />, desc: 'Vetting checks for objectives, content and conclusion' },
                { label: 'Auto-Approve Threshold', value: <span className="text-sm font-bold text-slate-700">{approveThresholdPct}%</span>, desc: 'AI confidence score required to auto-approve a note' },
                { label: 'Summary Length', value: <span className="capitalize text-sm text-slate-700">{s.summary_length}</span>, desc: 'Default word count range for generated summaries' },
                { label: 'Key Points Count', value: <span className="text-sm text-slate-700">{s.key_points_count} points</span>, desc: 'Number of key points extracted per summary' },
                { label: 'Text-to-Speech', value: <StatusBadge value={isAIGloballyActive && s.enable_text_to_speech} />, desc: 'Generate audio from lesson notes and material summaries' },
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
        <p className="text-xs font-medium text-slate-400 text-center pt-4">
          Last updated: {new Date(s.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}