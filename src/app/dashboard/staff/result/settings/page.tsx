'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resultSettingsAPI, resultTemplatesAPI, feeAPI } from '@/lib/api';
import { resultFieldsAPI } from '@/lib/result.service';
import { ResultSettings, ResultTemplate, ActiveTemplates, TextRatingOption, ResultField } from '@/lib/types';
import {
  Settings, Edit3, Check, X, AlertCircle, Loader2, RefreshCw,
  Award, Eye, EyeOff, Palette, Bell, CreditCard, FileText,
  ToggleLeft, Hash, Star, MessageSquare, Layout, ChevronUp,
  ChevronDown, Plus, Trash2, GripVertical, Users, Shield,
  BookOpen, Sliders, Zap, Globe, Lock, CheckCircle2, Unlock
} from 'lucide-react';

// ─── Default form ──────────────────────────────────────────────────────────────
const DEFAULT_FORM: Partial<ResultSettings> = {
  allowed_user: 'both',
  text_result_allowed_user: 'both',
  student_view_result: 'when_published',
  result_status: 'not_published',
  default_comment_mode: 'auto',
  enable_custom_comment_fields: false,
  custom_comment_fields: [],
  use_midterm: false,
  midterm_max_score: '20.00',
  convert_midterm_to_100: false,
  behavior_max_rating: 5,
  show_behavior_on_score_result: true,
  show_behavior_on_text_result: false,
  show_behavior_on_combined_result: true,
  text_rating_options: [],
  text_category_scope: 'fixed',
  score_template: null,
  text_template: null,
  combined_template: null,
  primary_color: '#2c5f8d',
  secondary_color: '#f9fafb',
  header_color: '#2c5f8d',
  accent_color: '#1890ff',
  show_end_of_term_graph: true,
  show_midterm_graph: false,
  send_result_via_whatsapp: false,
  whatsapp_result_bot_enabled: false,
  fee_restriction_scope: 'total',
  fee_restriction_type: 'none',
  fee_restriction_value: '0',
  fee_specific: null,
  current_result_upload: [],
};

function settingsToForm(s: ResultSettings): Partial<ResultSettings> {
  return { ...DEFAULT_FORM, ...s, current_result_upload: s.current_result_upload || [] };
}

function formatPermission(val: string) {
  if (val === 'both') return 'Form or Subject Teacher';
  if (val === 'any') return 'Any User';
  return val.replace(/_/g, ' ');
}

// ─── Reusable components ───────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
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
      value
        ? danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-500'
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

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const selectCls = inputCls;

// ─── Rating Options Editor ─────────────────────────────────────────────────────
function RatingOptionsEditor({ options, onChange }: {
  options: TextRatingOption[];
  onChange: (opts: TextRatingOption[]) => void;
}) {
  const add = () => onChange([...options, { value: '', label: '', score: 0 }]);
  const remove = (i: number) => onChange(options.filter((_, idx) => idx !== i));
  const update = (i: number, key: keyof TextRatingOption, val: any) => {
    const next = [...options];
    next[i] = { ...next[i], [key]: val };
    onChange(next);
  };
  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...options];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  };
  const moveDown = (i: number) => {
    if (i === options.length - 1) return;
    const next = [...options];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 px-1">
        <span className="col-span-1" />
        <span className="col-span-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Value</span>
        <span className="col-span-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Label</span>
        <span className="col-span-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Score</span>
        <span className="col-span-1" />
      </div>
      {options.map((opt, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-xl p-2 border border-slate-100">
          <div className="col-span-1 flex flex-col gap-0.5">
            <button type="button" onClick={() => moveUp(i)} disabled={i === 0}
              className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={() => moveDown(i)} disabled={i === options.length - 1}
              className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <input className="col-span-3 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="achieved" value={opt.value} onChange={e => update(i, 'value', e.target.value)} />
          <input className="col-span-4 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Achieved" value={opt.label} onChange={e => update(i, 'label', e.target.value)} />
          <input type="number" className="col-span-3 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="5" value={opt.score} onChange={e => update(i, 'score', Number(e.target.value))} />
          <button type="button" onClick={() => remove(i)}
            className="col-span-1 p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium px-1 pt-1 transition-colors">
        <Plus className="h-4 w-4" /> Add Rating Option
      </button>
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({ template, selected, onSelect }: {
  template: ResultTemplate; selected: boolean; onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect}
      className={`relative rounded-xl border-2 overflow-hidden text-left transition-all ${
        selected
          ? 'border-blue-500 shadow-md shadow-blue-100'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}>
      {/* Preview area */}
      <div className="h-28 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative">
        {template.preview_image
          ? <img src={template.preview_image} alt={template.name} className="w-full h-full object-cover" />
          : (
            <div className="text-center">
              <Layout className="h-8 w-8 text-slate-300 mx-auto mb-1" />
              <span className="text-xs text-slate-400">No preview</span>
            </div>
          )
        }
        {selected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow">
            <Check className="h-3.5 w-3.5 text-white" />
          </div>
        )}
      </div>
      <div className="p-3 bg-white">
        <p className="text-sm font-semibold text-slate-800 truncate">{template.name}</p>
        {template.description && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">{template.description}</p>
        )}
        <span className="inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium capitalize">
          {template.type}
        </span>
      </div>
    </button>
  );
}

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ settings, isSaving, onSave, onClose }: {
  settings: ResultSettings | null;
  isSaving: boolean;
  onSave: (f: Partial<ResultSettings>) => Promise<void>;
  onClose: () => void;
}) {
  type Tab = 'general' | 'upload' | 'midterm' | 'behavior' | 'text' | 'templates' | 'colors' | 'fee' | 'notifications';
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [form, setForm] = useState<Partial<ResultSettings>>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ResultTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [fees, setFees] = useState<{id: number, name: string}[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [allFields, setAllFields] = useState<ResultField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const set = <K extends keyof ResultSettings>(key: K, value: ResultSettings[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Load templates when Templates tab is opened
  useEffect(() => {
    if (activeTab === 'templates' && templates.length === 0) {
      setLoadingTemplates(true);
      resultTemplatesAPI.list().then(setTemplates).catch(() => {}).finally(() => setLoadingTemplates(false));
    }
  }, [activeTab]);

  // Load fees when Fee tab is opened
  useEffect(() => {
    if (activeTab === 'fee' && fees.length === 0) {
      setLoadingFees(true);
      feeAPI.getFees().then(setFees).catch(() => {}).finally(() => setLoadingFees(false));
    }
  }, [activeTab]);

  // Load fields when Upload tab is opened
  useEffect(() => {
    if (activeTab === 'upload' && allFields.length === 0) {
      setLoadingFields(true);
      resultFieldsAPI.list().then(setAllFields).catch(() => {}).finally(() => setLoadingFields(false));
    }
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.detail) {
        setSaveError(data.detail);
      } else if (typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([f, m]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(m) ? m.join(', ') : m}`)
          .join('\n');
        setSaveError(msgs);
      } else {
        setSaveError(err?.message || 'Failed to save result settings.');
      }
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'upload', label: 'Upload Restrictions', icon: Unlock },
    { id: 'midterm', label: 'Midterm', icon: BookOpen },
    { id: 'behavior', label: 'Behavior', icon: Star },
    { id: 'text', label: 'Text Results', icon: FileText },
    { id: 'templates', label: 'Templates', icon: Layout },
    { id: 'colors', label: 'Colors', icon: Palette },
    { id: 'fee', label: 'Fee Access', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const customFieldsText = (form.custom_comment_fields || []).join('\n');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {settings ? 'Edit Result Settings' : 'Create Result Settings'}
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
            <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4 flex-shrink-0 gap-0.5 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form id="result-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── General ── */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                <p className="text-xs text-slate-400">Control who can upload results, student access, comment mode, and custom fields.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Score Upload Permission</label>
                    <select value={form.allowed_user} onChange={e => set('allowed_user', e.target.value as any)} className={selectCls}>
                      <option value="form_teacher">Form Teacher Only</option>
                      <option value="subject_teacher">Subject Teacher Only</option>
                      <option value="both">Form or Subject Teacher</option>
                      <option value="any">Any User</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Text Upload Permission</label>
                    <select value={form.text_result_allowed_user} onChange={e => set('text_result_allowed_user', e.target.value as any)} className={selectCls}>
                      <option value="form_teacher">Form Teacher Only</option>
                      <option value="subject_teacher">Subject Teacher Only</option>
                      <option value="both">Form or Subject Teacher</option>
                      <option value="any">Any User</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Student Can View Result</label>
                    <select value={form.student_view_result} onChange={e => set('student_view_result', e.target.value as any)} className={selectCls}>
                      <option value="when_published">When Published</option>
                      <option value="once_uploaded">Once Uploaded</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Result Status</label>
                    <select value={form.result_status} onChange={e => set('result_status', e.target.value as any)} className={selectCls}>
                      <option value="not_published">Not Published</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Comment Mode</label>
                    <select value={form.default_comment_mode} onChange={e => set('default_comment_mode', e.target.value as any)} className={selectCls}>
                      <option value="auto">Auto (from templates based on score)</option>
                      <option value="manual">Manual (teacher types directly)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <Toggle checked={!!form.enable_custom_comment_fields}
                    onChange={v => set('enable_custom_comment_fields', v)}
                    label="Enable Custom Comment Fields"
                    description="Add school-defined fields like 'Next Term Focus', 'Area for Improvement'" />
                  {form.enable_custom_comment_fields && (
                    <div>
                      <label className={labelCls}>Custom Comment Fields <span className="normal-case font-normal text-slate-400">(one per line)</span></label>
                      <textarea
                        rows={4}
                        className={inputCls + ' resize-none font-mono text-xs'}
                        placeholder={"Next Term Focus\nArea for Improvement\nStrength"}
                        value={customFieldsText}
                        onChange={e => set('custom_comment_fields', e.target.value.split('\n').filter(l => l.trim()))}
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        {(form.custom_comment_fields || []).length} field(s) defined
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={!!form.show_end_of_term_graph}
                    onChange={v => set('show_end_of_term_graph', v)}
                    label="Show End of Term Graph" description="Display performance graph on result card" />
                  <Toggle checked={!!form.show_midterm_graph}
                    onChange={v => set('show_midterm_graph', v)}
                    label="Show Midterm Graph" description="Display midterm graph on result card" />
                </div>
              </div>
            )}

            {/* ── Upload Restrictions ── */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">
                  Control which specific score fields (like CA1, Exam) are open for data entry.
                  <strong className="text-amber-600 ml-1 italic">Note: If no fields are selected, all uploads are blocked (Lockdown Mode).</strong>
                </p>
                {loadingFields ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : allFields.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No result fields found in the system.
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                      <span className="text-sm font-semibold text-slate-700">Open Fields</span>
                      <button
                        type="button"
                        onClick={() => set('current_result_upload', [])}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        Clear All (Open Everything)
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {allFields.map(field => {
                        const checked = (form.current_result_upload || []).includes(field.id);
                        return (
                          <label key={field.id} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                            checked ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 bg-white'
                          }`}>
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                              checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                            }`}>
                              {checked && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              readOnly
                              className="sr-only"
                            />
                            <div className="min-w-0 flex-1" onClick={() => {
                              const curr = form.current_result_upload || [];
                              set('current_result_upload', checked ? curr.filter(id => id !== field.id) : [...curr, field.id]);
                            }}>
                              <p className="text-sm font-semibold text-slate-800 truncate">{field.name}</p>
                              <p className="text-xs text-slate-400 capitalize truncate">Max: {field.max_mark}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Midterm ── */}
            {activeTab === 'midterm' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure midterm result functionality and scoring.</p>
                <Toggle checked={!!form.use_midterm} onChange={v => set('use_midterm', v)}
                  label="Enable Midterm Results" description="Allow midterm scores to be uploaded and displayed" />
                {form.use_midterm && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Midterm Max Score</label>
                      <input type="number" step="0.01" min="0"
                        value={form.midterm_max_score}
                        onChange={e => set('midterm_max_score', e.target.value)}
                        className={inputCls} placeholder="20.00" />
                      <p className="text-xs text-slate-400 mt-1">Maximum achievable midterm score</p>
                    </div>
                    <div className="flex items-start pt-6">
                      <Toggle checked={!!form.convert_midterm_to_100}
                        onChange={v => set('convert_midterm_to_100', v)}
                        label="Convert to 100-point scale"
                        description="midterm_max_score must be divisible by 5" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Behavior ── */}
            {activeTab === 'behavior' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure behavior rating system and where it appears on result cards.</p>
                <div>
                  <label className={labelCls}>Max Behavior Rating</label>
                  <input type="number" min={1} max={10}
                    value={form.behavior_max_rating}
                    onChange={e => set('behavior_max_rating', Number(e.target.value))}
                    className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">e.g. 5 = rated on a scale of 1–5</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Toggle checked={!!form.show_behavior_on_score_result}
                    onChange={v => set('show_behavior_on_score_result', v)}
                    label="On Score Results" description="Show behavior section on score-based cards" />
                  <Toggle checked={!!form.show_behavior_on_text_result}
                    onChange={v => set('show_behavior_on_text_result', v)}
                    label="On Text Results" description="Show behavior section on text-based cards" />
                  <Toggle checked={!!form.show_behavior_on_combined_result}
                    onChange={v => set('show_behavior_on_combined_result', v)}
                    label="On Combined Results" description="Show behavior section on combined cards" />
                </div>
              </div>
            )}

            {/* ── Text Results ── */}
            {activeTab === 'text' && (
              <div className="space-y-5">
                <p className="text-xs text-slate-400">Configure text-based result categories, scoping, and rating options.</p>
                <div>
                  <label className={labelCls}>Text Category Scope</label>
                  <select value={form.text_category_scope} onChange={e => set('text_category_scope', e.target.value as any)} className={selectCls}>
                    <option value="fixed">Fixed — created once, reused forever</option>
                    <option value="per_session">Per Session — same across all terms, copied per session</option>
                    <option value="per_period">Per Period — unique per term</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Text Rating Options</label>
                  <RatingOptionsEditor
                    options={form.text_rating_options || []}
                    onChange={opts => set('text_rating_options', opts)} />
                </div>
              </div>
            )}

            {/* ── Templates ── */}
            {activeTab === 'templates' && (
              <div className="space-y-6">
                <p className="text-xs text-slate-400">Select which frontend template to use for each result type. Set to none to disable that result type.</p>

                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  </div>
                ) : (
                  ['score', 'text', 'combined'].map(type => {
                    const filtered = templates.filter(t => t.type === type);
                    const fieldKey = `${type}_template` as 'score_template' | 'text_template' | 'combined_template';
                    const selected = form[fieldKey];

                    return (
                      <div key={type} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-800 capitalize">{type} Result Template</h4>
                          {selected && (
                            <button type="button" onClick={() => set(fieldKey, null)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                              Clear selection
                            </button>
                          )}
                        </div>
                        {filtered.length === 0 ? (
                          <div className="py-6 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            No {type} templates available in registry
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {filtered.map(t => (
                              <TemplateCard key={t.id} template={t}
                                selected={selected === t.id}
                                onSelect={() => set(fieldKey, t.id)} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Colors ── */}
            {activeTab === 'colors' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Customize result card colors. These override template defaults.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { key: 'primary_color', label: 'Primary Color', desc: 'Main brand color' },
                    { key: 'secondary_color', label: 'Secondary Color', desc: 'Background/secondary elements' },
                    { key: 'header_color', label: 'Header Color', desc: 'Result card header background' },
                    { key: 'accent_color', label: 'Accent Color', desc: 'Highlights and interactive elements' },
                  ] as const).map(({ key, label, desc }) => (
                    <div key={key}>
                      <label className={labelCls}>{label}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={form[key] || '#000000'}
                          onChange={e => set(key, e.target.value)}
                          className="h-10 w-14 rounded-xl border border-slate-200 cursor-pointer p-1 bg-white" />
                        <input type="text" value={form[key] || ''}
                          onChange={e => set(key, e.target.value)}
                          placeholder="#000000" maxLength={7}
                          className={inputCls + ' font-mono'} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
                {/* Preview strip */}
                <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <div className="h-12 flex items-center justify-center text-white text-sm font-semibold"
                    style={{ background: form.header_color || '#2c5f8d' }}>
                    Result Card Header Preview
                  </div>
                  <div className="h-16 flex items-center justify-center gap-4 px-4"
                    style={{ background: form.secondary_color || '#f9fafb' }}>
                    <div className="h-8 w-24 rounded-lg"
                      style={{ background: form.primary_color || '#2c5f8d' }} />
                    <div className="h-8 w-16 rounded-lg"
                      style={{ background: form.accent_color || '#1890ff' }} />
                    <p className="text-xs text-slate-500">Color preview</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Fee Access ── */}
            {activeTab === 'fee' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Restrict result access based on fee payment status.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Restriction Type</label>
                    <select value={form.fee_restriction_type} onChange={e => set('fee_restriction_type', e.target.value as any)} className={selectCls}>
                      <option value="none">No Restriction</option>
                      <option value="percentage">Minimum % Paid</option>
                      <option value="balance">Maximum Outstanding Balance</option>
                    </select>
                  </div>
                  {form.fee_restriction_type !== 'none' && (
                    <>
                      <div>
                        <label className={labelCls}>Restriction Scope</label>
                        <select value={form.fee_restriction_scope} onChange={e => set('fee_restriction_scope', e.target.value as any)} className={selectCls}>
                          <option value="total">Total Invoice (all fees)</option>
                          <option value="specific">Specific Fee Item</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>
                          {form.fee_restriction_type === 'percentage' ? 'Minimum % Paid' : 'Maximum Outstanding (₦)'}
                        </label>
                        <input type="number" step="0.01" min="0"
                          value={form.fee_restriction_value}
                          onChange={e => set('fee_restriction_value', e.target.value)}
                          className={inputCls}
                          placeholder={form.fee_restriction_type === 'percentage' ? '50' : '5000'} />
                        <p className="text-xs text-slate-400 mt-1">
                          {form.fee_restriction_type === 'percentage'
                            ? 'Student must have paid at least this % to view result'
                            : 'Student must owe no more than this amount'}
                        </p>
                      </div>
                      {form.fee_restriction_scope === 'specific' && (
                        <div>
                          <label className={labelCls}>Specific Fee</label>
                          <select
                            value={form.fee_specific || ''}
                            onChange={e => set('fee_specific', e.target.value ? Number(e.target.value) : null)}
                            className={selectCls}
                          >
                            <option value="">-- Select Fee --</option>
                            {loadingFees ? (
                              <option disabled>Loading fees...</option>
                            ) : (
                              fees.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))
                            )}
                          </select>
                          <p className="text-xs text-slate-400 mt-1">Select the fee item to check against</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Notifications ── */}
            {activeTab === 'notifications' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-400">Configure WhatsApp result notifications for parents.</p>
                <div className="grid grid-cols-1 gap-3">
                  <Toggle checked={!!form.send_result_via_whatsapp}
                    onChange={v => set('send_result_via_whatsapp', v)}
                    label="Send Result via WhatsApp"
                    description="Notify parents via WhatsApp when results are published" />
                  <Toggle checked={!!form.whatsapp_result_bot_enabled}
                    onChange={v => set('whatsapp_result_bot_enabled', v)}
                    label="Enable WhatsApp AI Bot"
                    description="Allow the AI bot to respond to parent result queries. Requires WhatsApp + AI configured." />
                </div>
                {form.whatsapp_result_bot_enabled && !form.send_result_via_whatsapp && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    The AI bot works best when WhatsApp notifications are also enabled.
                  </div>
                )}
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
          <button type="submit" form="result-settings-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
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
export default function ResultSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<ResultSettings | null>(null);
  const [activeTemplates, setActiveTemplates] = useState<ActiveTemplates | null>(null);
  const [allFields, setAllFields] = useState<ResultField[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('result.change_resultsettingsmodel');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [data, tmpl, fields] = await Promise.all([
        resultSettingsAPI.get(),
        resultTemplatesAPI.active().catch(() => null),
        resultFieldsAPI.list().catch(() => []),
      ]);
      if (data === null) { setPageError('not_found'); setSettings(null); }
      else { setSettings(data); }
      if (tmpl) setActiveTemplates(tmpl);
      setAllFields(fields);
    } catch { setPageError('fetch_error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: Partial<ResultSettings>) => {
    setIsSaving(true);
    try {
      const updated = await resultSettingsAPI.update(form);
      setSettings(updated);
      setIsEditing(false);
      setPageError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      // Refresh active templates
      resultTemplatesAPI.active().then(setActiveTemplates).catch(() => {});
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
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading result settings...</p>
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
        <p className="text-sm text-slate-500">Couldn't load result settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  // ── Not found ──
  if (pageError === 'not_found' && !settings) return (
    <>
      {isEditing && <SettingsModal settings={null} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-10 text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mx-auto">
            <Award className="h-10 w-10 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configure Result Settings</h3>
            <p className="text-slate-400 text-sm">Set up your result module to customise grading, templates, and notifications.</p>
          </div>
          {canEdit ? (
            <button onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200">
              <Zap className="h-5 w-5" /> Set Up Result Settings
            </button>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              You don't have permission to set up result settings. Please contact an administrator.
            </div>
          )}
        </div>
      </div>
    </>
  );

  const s = settings!;

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Result settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SettingsModal settings={s} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Award className="h-5 w-5 text-white" />
            </div>
            Result Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Result module configuration and preferences</p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Result Status',
            value: s.result_status === 'published' ? 'Published' : 'Not Published',
            icon: s.result_status === 'published' ? CheckCircle2 : Lock,
            color: s.result_status === 'published' ? 'from-emerald-500 to-green-600' : 'from-slate-400 to-slate-500',
          },
          {
            label: 'Upload Permission',
            value: formatPermission(s.allowed_user),
            icon: Shield,
            color: 'from-blue-500 to-blue-600',
          },
          {
            label: 'Comment Mode',
            value: s.default_comment_mode === 'auto' ? 'Auto' : 'Manual',
            icon: MessageSquare,
            color: 'from-violet-500 to-purple-600',
          },
          {
            label: 'Fee Restriction',
            value: s.fee_restriction_type === 'none' ? 'None' : s.fee_restriction_type === 'percentage' ? `Min ${s.fee_restriction_value}%` : `Max ₦${s.fee_restriction_value}`,
            icon: CreditCard,
            color: s.fee_restriction_type === 'none' ? 'from-slate-400 to-slate-500' : 'from-orange-400 to-amber-500',
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

        {/* Permissions & Access */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Permissions & Access</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Users} iconBg="bg-blue-50 text-blue-600"
              label="Score Upload" description="Who can upload score results"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.allowed_user.replace(/_/g, ' ')}</span>} />
            <SettingRow icon={FileText} iconBg="bg-indigo-50 text-indigo-600"
              label="Text Upload" description="Who can upload text results"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.text_result_allowed_user.replace(/_/g, ' ')}</span>} />
            <SettingRow icon={Eye} iconBg="bg-violet-50 text-violet-600"
              label="Student View" description="When students can view results"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.student_view_result.replace(/_/g, ' ')}</span>} />
            <SettingRow icon={Globe} iconBg="bg-sky-50 text-sky-600"
              label="Result Status" description="Current publish state"
              value={<StatusBadge value={s.result_status === 'published'} activeLabel="Published" inactiveLabel="Not Published" />} />
          </div>
        </div>

        {/* Behavior & Midterm */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
              <Star className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Behavior & Midterm</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Star} iconBg="bg-violet-50 text-violet-600"
              label="Behavior on Score" description="Show behavior on score cards"
              value={<StatusBadge value={s.show_behavior_on_score_result} />} />
            <SettingRow icon={Star} iconBg="bg-purple-50 text-purple-600"
              label="Behavior on Text" description="Show behavior on text cards"
              value={<StatusBadge value={s.show_behavior_on_text_result} />} />
            <SettingRow icon={Hash} iconBg="bg-fuchsia-50 text-fuchsia-600"
              label="Max Behavior Rating" description="Scale for behavior ratings"
              value={<span className="text-xs font-bold text-slate-700">1 – {s.behavior_max_rating}</span>} />
            <SettingRow icon={BookOpen} iconBg="bg-blue-50 text-blue-600"
              label="Midterm Enabled" description="Midterm results active"
              value={<StatusBadge value={s.use_midterm} />} />
            {s.use_midterm && (
              <SettingRow icon={Hash} iconBg="bg-sky-50 text-sky-600"
                label="Midterm Max Score" description="Maximum midterm score"
                value={<span className="text-xs font-bold text-slate-700">{s.midterm_max_score}</span>} />
            )}
          </div>
        </div>

        {/* Templates & Colors */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <Palette className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Templates & Colors</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Layout} iconBg="bg-orange-50 text-orange-600"
              label="Score Template" description="Active score result template"
              value={<span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{s.score_template || 'None'}</span>} />
            <SettingRow icon={Layout} iconBg="bg-amber-50 text-amber-600"
              label="Text Template" description="Active text result template"
              value={<span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{s.text_template || 'None'}</span>} />
            <SettingRow icon={Layout} iconBg="bg-yellow-50 text-yellow-600"
              label="Combined Template" description="Active combined result template"
              value={<span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{s.combined_template || 'None'}</span>} />
          </div>
          {/* Color preview strip */}
          <div className="mx-4 mb-4 mt-2 rounded-xl overflow-hidden border border-slate-100">
            <div className="h-8 flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: s.header_color }}>Header</div>
            <div className="h-8 flex items-center justify-center gap-3 px-3"
              style={{ background: s.secondary_color }}>
              <div className="h-5 w-10 rounded" style={{ background: s.primary_color }} />
              <div className="h-5 w-8 rounded" style={{ background: s.accent_color }} />
              <span className="text-xs text-slate-500">Colors</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notifications, Fee & Upload card ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Bell className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Notifications</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Bell} iconBg="bg-emerald-50 text-emerald-600"
              label="WhatsApp Notifications" description="Notify parents when result is published"
              value={<StatusBadge value={s.send_result_via_whatsapp} />} />
            <SettingRow icon={Zap} iconBg="bg-teal-50 text-teal-600"
              label="AI Bot Enabled" description="Bot responds to parent result queries"
              value={<StatusBadge value={s.whatsapp_result_bot_enabled} />} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <CreditCard className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Fee Access</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={CreditCard} iconBg="bg-orange-50 text-orange-600"
              label="Restriction Type" description="How fee restriction is applied"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.fee_restriction_type.replace(/_/g, ' ')}</span>} />
            {s.fee_restriction_type !== 'none' && (
              <>
                <SettingRow icon={Globe} iconBg="bg-amber-50 text-amber-600"
                  label="Scope" description="Which fee invoice to check"
                  value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg capitalize">{s.fee_restriction_scope}</span>} />
                {s.fee_restriction_scope === 'specific' && (
                  <SettingRow icon={FileText} iconBg="bg-blue-50 text-blue-600"
                    label="Specific Fee" description="The specific fee to check"
                    value={<span className="text-xs font-bold text-slate-700">{s.fee_specific_name || 'None Selected'}</span>} />
                )}
                <SettingRow icon={Hash} iconBg="bg-yellow-50 text-yellow-600"
                  label="Threshold Value" description={s.fee_restriction_type === 'percentage' ? 'Minimum % required' : 'Max outstanding allowed'}
                  value={<span className="text-xs font-bold text-slate-700">
                    {s.fee_restriction_type === 'percentage' ? `${s.fee_restriction_value}%` : `₦${s.fee_restriction_value}`}
                  </span>} />
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Unlock className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Upload Restrictions</h3>
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-400 mb-3">Currently open score fields for data entry:</p>
            {s.current_result_upload && s.current_result_upload.length > 0 ? (
              <div className="flex flex-col gap-2">
                {allFields
                  .filter(f => s.current_result_upload.includes(f.id))
                  .map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg uppercase tracking-tight">
                      <CheckCircle2 className="h-3 w-3 text-indigo-500" />
                      {f.name}
                    </div>
                  ))
                }
              </div>
            ) : (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg inline-block">
                All Fields Allowed
              </span>
            )}
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
                { label: 'Score Upload Permission', value: <span className="capitalize text-sm">{formatPermission(s.allowed_user)}</span>, desc: 'Who can upload score-based results' },
                { label: 'Text Upload Permission', value: <span className="capitalize text-sm">{formatPermission(s.text_result_allowed_user)}</span>, desc: 'Who can upload text-based results' },
                { label: 'Student View Result', value: <span className="capitalize text-sm">{s.student_view_result.replace(/_/g, ' ')}</span>, desc: 'When students can access their results' },
                { label: 'Result Status', value: <StatusBadge value={s.result_status === 'published'} activeLabel="Published" inactiveLabel="Not Published" />, desc: 'Current publish state of results' },
                { label: 'Comment Mode', value: <span className="capitalize text-sm">{s.default_comment_mode}</span>, desc: 'Auto-select comments or manual teacher input' },
                { label: 'Custom Comment Fields', value: <span className="text-sm">{(s.custom_comment_fields || []).length} field(s)</span>, desc: 'Dynamic comment fields defined by school' },
                { label: 'Midterm Enabled', value: <StatusBadge value={s.use_midterm} />, desc: 'Whether midterm result functionality is active' },
                { label: 'Midterm Max Score', value: <span className="text-sm">{s.midterm_max_score}</span>, desc: 'Maximum achievable midterm score' },
                { label: 'Convert Midterm to 100', value: <StatusBadge value={s.convert_midterm_to_100} />, desc: 'Display midterm on 100-point scale' },
                { label: 'Behavior Max Rating', value: <span className="text-sm">1 – {s.behavior_max_rating}</span>, desc: 'Scale for behavior field ratings' },
                { label: 'Behavior on Score Results', value: <StatusBadge value={s.show_behavior_on_score_result} />, desc: 'Show behavior section on score-based cards' },
                { label: 'Behavior on Text Results', value: <StatusBadge value={s.show_behavior_on_text_result} />, desc: 'Show behavior section on text-based cards' },
                { label: 'Behavior on Combined Results', value: <StatusBadge value={s.show_behavior_on_combined_result} />, desc: 'Show behavior section on combined cards' },
                { label: 'Text Category Scope', value: <span className="capitalize text-sm">{s.text_category_scope.replace(/_/g, ' ')}</span>, desc: 'How text categories are managed across sessions' },
                { label: 'Text Rating Options', value: <span className="text-sm">{(s.text_rating_options || []).length} option(s)</span>, desc: 'Rating scale for text-based results' },
                { label: 'Score Template', value: <span className="font-mono text-xs">{s.score_template || 'None'}</span>, desc: 'Active frontend template for score results' },
                { label: 'Text Template', value: <span className="font-mono text-xs">{s.text_template || 'None'}</span>, desc: 'Active frontend template for text results' },
                { label: 'Combined Template', value: <span className="font-mono text-xs">{s.combined_template || 'None'}</span>, desc: 'Active frontend template for combined results' },
                { label: 'Send via WhatsApp', value: <StatusBadge value={s.send_result_via_whatsapp} />, desc: 'Notify parents on result publish via WhatsApp' },
                { label: 'WhatsApp AI Bot', value: <StatusBadge value={s.whatsapp_result_bot_enabled} />, desc: 'AI bot responds to parent result queries' },
                { label: 'Fee Restriction Type', value: <span className="capitalize text-sm">{s.fee_restriction_type.replace(/_/g, ' ')}</span>, desc: 'How fee payment is checked before showing result' },
                { label: 'Fee Restriction Scope', value: <span className="capitalize text-sm">{s.fee_restriction_scope}</span>, desc: 'Which fee invoice to check against' },
                ...(s.fee_restriction_scope === 'specific' ? [{ label: 'Specific Fee', value: <span className="text-sm font-semibold">{s.fee_specific_name || 'None Selected'}</span>, desc: 'The specific fee item to check' }] : []),
                { label: 'Fee Threshold Value', value: <span className="text-sm">{s.fee_restriction_type === 'percentage' ? `${s.fee_restriction_value}%` : s.fee_restriction_type === 'balance' ? `₦${s.fee_restriction_value}` : '—'}</span>, desc: 'Minimum payment % or maximum outstanding balance' },
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
          {s.updated_by_name && ` by ${s.updated_by_name}`}
        </p>
      )}
    </div>
  );
}