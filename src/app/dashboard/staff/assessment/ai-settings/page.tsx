'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { assessmentAISettingsAPI, aiServicesAPI, academicCalendarAPI } from '@/lib/api';
import {
  AssessmentAISettings,
  AssessmentAISettingsFormValues,
  AIServiceConfig,
  SchoolSection,
} from '@/lib/types';
import {
  Brain, Settings, Edit3, Check, X, AlertCircle, Sparkles,
  Cpu, Shield, Activity, Sliders, Zap, Eye, MessageSquare,
  Loader2, RefreshCw, ChevronRight, Target, BarChart2, Key
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
type MarkingStrictness = 'lenient' | 'moderate' | 'strict' | 'very_strict';

interface FormState {
  school_section: number | null;
  ai_service: number | null;
  enable_ai_marking: boolean;
  enable_ai_vetting: boolean;
  enable_ai_feedback: boolean;
  marking_strictness: MarkingStrictness;
  grammar_tolerance: number;
  spelling_weight: number;
  auto_mark_threshold: number;
  use_dob_for_exam_pin: boolean;
}

const DEFAULT_FORM: FormState = {
  school_section: null,
  ai_service: null,
  enable_ai_marking: true,
  enable_ai_vetting: true,
  enable_ai_feedback: true,
  marking_strictness: 'moderate',
  grammar_tolerance: 2,
  spelling_weight: 0.1,
  auto_mark_threshold: 0.85,
  use_dob_for_exam_pin: false,
};

function settingsToForm(s: AssessmentAISettings): FormState {
  return {
    school_section: typeof s.school_section === 'number' ? s.school_section : null,
    ai_service: typeof s.ai_service === 'number' ? s.ai_service : null,
    enable_ai_marking: s.enable_ai_marking ?? true,
    enable_ai_vetting: s.enable_ai_vetting ?? true,
    enable_ai_feedback: s.enable_ai_feedback ?? true,
    marking_strictness: s.marking_strictness ?? 'moderate',
    grammar_tolerance: s.grammar_tolerance ?? 2,
    spelling_weight: s.spelling_weight ?? 0.1,
    auto_mark_threshold: s.auto_mark_threshold ?? 0.85,
    use_dob_for_exam_pin: s.use_dob_for_exam_pin ?? false,
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
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 flex-shrink-0 ${checked ? 'bg-violet-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ value, activeLabel = 'Enabled', inactiveLabel = 'Disabled' }: {
  value: boolean; activeLabel?: string; inactiveLabel?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      value ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

// ─── Setting Row ───────────────────────────────────────────────────────────────
function SettingRow({ icon: Icon, iconBg, label, value, description }: {
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

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({
  settings, aiServices, schoolSections, isSaving, onSave, onClose,
}: {
  settings: AssessmentAISettings | null;
  aiServices: AIServiceConfig[];
  schoolSections: SchoolSection[];
  isSaving: boolean;
  onSave: (f: FormState) => Promise<void>;
  onClose: () => void;
}) {
  type Tab = 'general' | 'marking' | 'thresholds';
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [form, setForm] = useState<FormState>(settings ? settingsToForm(settings) : DEFAULT_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data) {
        const msgs = typeof data === 'object'
          ? Object.entries(data).map(([f, m]: [string, any]) =>
              `${f.replace(/_/g, ' ')}: ${Array.isArray(m) ? m.join(', ') : m}`).join('\n')
          : String(data);
        setSaveError(msgs);
      } else {
        setSaveError(err?.message || 'Failed to save AI settings.');
      }
    }
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: Settings },
    { id: 'marking' as const, label: 'Marking', icon: Brain },
    { id: 'thresholds' as const, label: 'Thresholds', icon: Sliders },
  ];

  const strictnessOptions: { value: MarkingStrictness; label: string; desc: string }[] = [
    { value: 'lenient', label: 'Lenient', desc: 'Accept variations generously' },
    { value: 'moderate', label: 'Moderate', desc: 'Standard marking behaviour' },
    { value: 'strict', label: 'Strict', desc: 'Prefer closer matches' },
    { value: 'very_strict', label: 'Very Strict', desc: 'Near-exact matching required' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {settings ? 'Edit AI Settings' : 'Create AI Settings'}
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
            <span className="whitespace-pre-line flex-1">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6 flex-shrink-0 gap-1">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id
                  ? 'text-violet-600 border-violet-600'
                  : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form id="ai-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── General ── */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Select the AI service and scope for these settings.</p>

                <div>
                  <label className={labelCls}>School Section</label>
                  <select
                    value={form.school_section ?? ''}
                    onChange={e => set('school_section', e.target.value === '' ? null : Number(e.target.value))}
                    className={inputCls}
                  >
                    <option value="">Global (All Sections)</option>
                    {schoolSections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Leave blank to apply across all sections</p>
                </div>

                <div>
                  <label className={labelCls}>AI Service *</label>
                  <select
                    value={form.ai_service ?? ''}
                    onChange={e => set('ai_service', e.target.value === '' ? null : Number(e.target.value))}
                    required
                    className={inputCls}
                  >
                    <option value="">Select AI Service</option>
                    {aiServices.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.service_type})</option>
                    ))}
                  </select>
                  {aiServices.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No active AI services. Please create one first.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <Toggle
                    checked={form.enable_ai_marking}
                    onChange={v => set('enable_ai_marking', v)}
                    label="AI Marking"
                    description="Auto-grade subjective questions"
                  />
                  <Toggle
                    checked={form.enable_ai_vetting}
                    onChange={v => set('enable_ai_vetting', v)}
                    label="AI Vetting"
                    description="Review teacher scores"
                  />
                  <Toggle
                    checked={form.enable_ai_feedback}
                    onChange={v => set('enable_ai_feedback', v)}
                    label="AI Feedback"
                    description="Student feedback generation"
                  />
                </div>

                {/* PIN Settings */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Exam PIN</p>
              <Toggle
                checked={form.use_dob_for_exam_pin}
                onChange={v => set('use_dob_for_exam_pin', v)}
                label="Use Date of Birth as Exam PIN"
                description="Student's DOB in DDMMYY format becomes their exam PIN"
              />
            </div>
              </div>
            )}

            {/* ── Marking ── */}
            {activeTab === 'marking' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure how strictly AI evaluates student answers.</p>

                <div>
                  <label className={labelCls}>Marking Strictness</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {strictnessOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => set('marking_strictness', opt.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          form.marking_strictness === opt.value
                            ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <p className={`text-xs font-bold ${form.marking_strictness === opt.value ? 'text-violet-700' : 'text-slate-700'}`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Grammar Tolerance</label>
                    <input
                      type="number"
                      value={form.grammar_tolerance}
                      onChange={e => set('grammar_tolerance', Number(e.target.value))}
                      min={0} max={10}
                      className={inputCls}
                    />
                    <p className="text-xs text-slate-400 mt-1">Errors allowed before deduction (0–10)</p>
                  </div>
                  <div>
                    <label className={labelCls}>Spelling Weight</label>
                    <input
                      type="number"
                      value={form.spelling_weight}
                      onChange={e => set('spelling_weight', parseFloat(e.target.value))}
                      step={0.01} min={0} max={1}
                      className={inputCls}
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Spelling impact on score (0.0–1.0)
                      <span className="ml-1 font-semibold text-violet-600">{(form.spelling_weight * 100).toFixed(0)}%</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Thresholds ── */}
            {activeTab === 'thresholds' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Set confidence thresholds that determine when AI marks automatically vs. flags for manual review.</p>

                <div>
                  <label className={labelCls}>Auto-Mark Confidence Threshold</label>
                  <div className="space-y-3">
                    <input
                      type="range"
                      value={form.auto_mark_threshold}
                      onChange={e => set('auto_mark_threshold', parseFloat(e.target.value))}
                      step={0.01} min={0} max={1}
                      className="w-full accent-violet-600"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 text-xs text-slate-400">
                        <span>0% — Always review</span>
                        <span>100% — Always auto-mark</span>
                      </div>
                      <div className="px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-bold">
                        {(form.auto_mark_threshold * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Answers where AI confidence is above this threshold will be auto-marked. Below it, they'll be flagged for manual review.
                  </p>
                </div>

                {/* Visual threshold explanation */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Threshold Preview</p>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-slate-600">
                      Confidence ≥ <strong>{(form.auto_mark_threshold * 100).toFixed(0)}%</strong> → Auto-marked instantly
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="text-slate-600">
                      Confidence &lt; <strong>{(form.auto_mark_threshold * 100).toFixed(0)}%</strong> → Flagged for manual review
                    </span>
                  </div>
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
            className="px-5 py-2 text-sm bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-violet-200">
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
export default function AISettingsPage() {
  const { hasPermission, user } = useAuth();
  const [aiSettings, setAISettings] = useState<AssessmentAISettings | null>(null);
  const [aiServices, setAIServices] = useState<AIServiceConfig[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('assessment_center.change_assessmentaisettingsmodel');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [settingsData, servicesData, sectionsData] = await Promise.all([
        assessmentAISettingsAPI.get(),
        aiServicesAPI.list(),
        academicCalendarAPI.listSchoolSections(),
      ]);
      if (settingsData === null) {
        setPageError('not_found');
        setAISettings(null);
      } else {
        setAISettings(settingsData);
      }
      setAIServices(servicesData.filter(s => s.is_active));
      setSchoolSections(sectionsData);
    } catch {
      setPageError('fetch_error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (form: FormState) => {
    setIsSaving(true);
    try {
      const payload: AssessmentAISettingsFormValues = {
        school_section: form.school_section,
        ai_service: form.ai_service!,
        enable_ai_marking: form.enable_ai_marking,
        enable_ai_vetting: form.enable_ai_vetting,
        enable_ai_feedback: form.enable_ai_feedback,
        marking_strictness: form.marking_strictness,
        grammar_tolerance: form.grammar_tolerance,
        spelling_weight: form.spelling_weight,
        auto_mark_threshold: form.auto_mark_threshold,
        use_dob_for_exam_pin: form.use_dob_for_exam_pin,
      };
      const updated = aiSettings?.id
        ? await assessmentAISettingsAPI.update(aiSettings.id, payload)
        : await assessmentAISettingsAPI.create(payload);
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
        <Loader2 className="h-10 w-10 animate-spin text-violet-600 mx-auto" />
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
        <button onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  // ── Not found ──
  if (pageError === 'not_found' && !aiSettings) return (
    <>
      {isEditing && (
        <SettingsModal
          settings={null}
          aiServices={aiServices}
          schoolSections={schoolSections}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setIsEditing(false)}
        />
      )}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto">
            <Brain className="h-10 w-10 text-violet-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure AI Settings</h3>
            <p className="text-slate-400 text-sm">Set up AI-powered marking and assessment features for your institution.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-200">
              <Sparkles className="h-5 w-5" /> Set Up AI Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up AI settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = aiSettings!;

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
        <SettingsModal
          settings={s}
          aiServices={aiServices}
          schoolSections={schoolSections}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => setIsEditing(false)}
        />
      )}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-violet-200">
              <Brain className="h-5 w-5 text-white" />
            </div>
            AI Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">AI-powered marking and assessment configuration</p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200">
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'AI Service',
            value: s.ai_service_name || 'Not set',
            icon: Cpu,
            color: 'from-violet-500 to-purple-600',
          },
          {
            label: 'Strictness',
            value: s.marking_strictness?.replace(/_/g, ' ') || 'moderate',
            icon: Target,
            color: 'from-blue-500 to-indigo-600',
          },
          {
            label: 'Auto-Mark Threshold',
            value: s.auto_mark_threshold ? `${(s.auto_mark_threshold * 100).toFixed(0)}%` : '—',
            icon: BarChart2,
            color: 'from-emerald-500 to-teal-600',
          },
          {
            label: 'Spelling Weight',
            value: s.spelling_weight ? `${(s.spelling_weight * 100).toFixed(0)}%` : '—',
            icon: Sliders,
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

        {/* General */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
              <Settings className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">General</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Cpu} iconBg="bg-violet-50 text-violet-600" label="AI Service"
              description="Selected AI provider for marking"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{s.ai_service_name || '—'}</span>} />
            <SettingRow icon={Shield} iconBg="bg-blue-50 text-blue-600" label="School Section"
              description="Scope of this configuration"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{s.school_section_name || 'Global'}</span>} />
            <SettingRow icon={Zap} iconBg="bg-emerald-50 text-emerald-600" label="AI Marking"
              description="Auto-grade subjective questions" value={<StatusBadge value={s.enable_ai_marking} />} />
            <SettingRow icon={Eye} iconBg="bg-amber-50 text-amber-600" label="AI Vetting"
              description="Review teacher manual scores" value={<StatusBadge value={s.enable_ai_vetting} />} />
            <SettingRow icon={MessageSquare} iconBg="bg-teal-50 text-teal-600" label="AI Feedback"
              description="Generate student feedback" value={<StatusBadge value={s.enable_ai_feedback} />} />
            <SettingRow icon={Key} iconBg="bg-pink-50 text-pink-600" label="DOB as Exam PIN"
              description="Use date of birth as student exam PIN"
              value={<StatusBadge value={s.use_dob_for_exam_pin} />} />
          </div>
        </div>

        {/* Marking */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Brain className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Marking</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Target} iconBg="bg-blue-50 text-blue-600" label="Strictness"
              description="How precisely AI evaluates answers"
              value={
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">
                  {s.marking_strictness?.replace(/_/g, ' ') || '—'}
                </span>
              } />
            <SettingRow icon={Activity} iconBg="bg-purple-50 text-purple-600" label="Grammar Tolerance"
              description="Errors allowed before deduction"
              value={<span className="text-xs font-bold text-slate-700">{s.grammar_tolerance ?? '—'} errors</span>} />
            <SettingRow icon={Sliders} iconBg="bg-orange-50 text-orange-600" label="Spelling Weight"
              description="Spelling impact on total score"
              value={<span className="text-xs font-bold text-slate-700">{s.spelling_weight ? `${(s.spelling_weight * 100).toFixed(0)}%` : '—'}</span>} />
          </div>
        </div>

        {/* Threshold */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <BarChart2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Threshold</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={BarChart2} iconBg="bg-emerald-50 text-emerald-600" label="Auto-Mark Threshold"
              description="Min confidence for automatic marking"
              value={
                <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-1 rounded-lg">
                  {s.auto_mark_threshold ? `${(s.auto_mark_threshold * 100).toFixed(0)}%` : '—'}
                </span>
              } />
          </div>

          {/* Visual bar */}
          <div className="mx-4 mb-4 mt-2 p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl border border-violet-100">
            <p className="text-xs font-semibold text-violet-700 mb-3 uppercase tracking-wide">Confidence Threshold</p>
            <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                style={{ width: `${(s.auto_mark_threshold || 0) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-slate-400">0%</span>
              <span className="text-xs font-bold text-violet-700">
                {s.auto_mark_threshold ? `${(s.auto_mark_threshold * 100).toFixed(0)}%` : '—'}
              </span>
              <span className="text-xs text-slate-400">100%</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                Above threshold → Auto-marked
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                Below threshold → Manual review
              </div>
            </div>
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
                { label: 'AI Service', value: <span className="text-sm text-slate-700">{s.ai_service_name || '—'}</span>, desc: 'Selected AI provider for marking' },
                { label: 'School Section', value: <span className="text-sm text-slate-700">{s.school_section_name || 'Global (All Sections)'}</span>, desc: 'Scope of this configuration' },
                { label: 'Enable AI Marking', value: <StatusBadge value={s.enable_ai_marking} />, desc: 'Automatically grade subjective and theory questions' },
                { label: 'Enable AI Vetting', value: <StatusBadge value={s.enable_ai_vetting} />, desc: 'AI reviews teacher manual scores for discrepancies' },
                { label: 'Enable AI Feedback', value: <StatusBadge value={s.enable_ai_feedback} />, desc: 'Provide AI-generated feedback to students on answers' },
                { label: 'Marking Strictness', value: <span className="capitalize text-sm text-slate-700">{s.marking_strictness?.replace(/_/g, ' ') || '—'}</span>, desc: 'How strictly AI evaluates student answers' },
                { label: 'Grammar Tolerance', value: <span className="text-sm text-slate-700">{s.grammar_tolerance ?? '—'} errors</span>, desc: 'Grammar/spelling errors allowed before score deduction' },
                { label: 'Spelling Weight', value: <span className="text-sm text-slate-700">{s.spelling_weight ? `${(s.spelling_weight * 100).toFixed(0)}%` : '—'}</span>, desc: 'Weight of spelling accuracy in overall score' },
                { label: 'Auto-Mark Threshold', value: <span className="text-sm font-bold text-violet-700">{s.auto_mark_threshold ? `${(s.auto_mark_threshold * 100).toFixed(0)}%` : '—'}</span>, desc: 'Minimum AI confidence required for automatic marking' },
                { label: 'Use DOB as Exam PIN', value: <StatusBadge value={s.use_dob_for_exam_pin} />, desc: 'Student date of birth (DDMMYY) used as exam PIN' },

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