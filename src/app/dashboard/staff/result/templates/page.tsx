'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resultTemplatesAPI, resultSettingsAPI, schoolInfoAPI } from '@/lib/api';
import { ResultTemplate, ResultSettings } from '@/lib/types';
import {
  dummySettings, dummySchool, dummyStudent, dummyScoreResult,
  dummyTextCategories, dummyBehavior, dummyBehaviorRatings,
  dummyComments, dummyGradeList, dummyMidtermGradeList, dummyFieldList,
  dummyScoreSubjects, dummyPeriod,
} from '@/lib/result-template-dummy-data';
import {
  Loader2, X, Check, Eye, Layers, FileText, BarChart2,
  CheckCircle, AlertCircle, Sparkles,
} from 'lucide-react';

import DefaultScoreTemplate    from '@/components/result/templates/score/1_default/preview';
import ModernScoreTemplate     from '@/components/result/templates/score/2_modern/preview';
import MinimalScoreTemplate    from '@/components/result/templates/score/3_minimal/preview';
import DefaultTextTemplate     from '@/components/result/templates/text/1_default/preview';
import ModernTextTemplate      from '@/components/result/templates/text/2_modern/preview';
import MinimalTextTemplate     from '@/components/result/templates/text/3_minimal/preview';
import DefaultCombinedTemplate from '@/components/result/templates/combined/1_default/preview';
import ModernCombinedTemplate  from '@/components/result/templates/combined/2_modern/preview';
import MinimalCombinedTemplate from '@/components/result/templates/combined/3_minimal/preview';

// ─── Template component registry ──────────────────────────────────────────────
const TEMPLATE_COMPONENTS: Record<string, React.FC<any>> = {
  score_1_default:    DefaultScoreTemplate,
  score_2_modern:     ModernScoreTemplate,
  score_3_minimal:    MinimalScoreTemplate,
  text_1_default:     DefaultTextTemplate,
  text_2_modern:      ModernTextTemplate,
  text_3_minimal:     MinimalTextTemplate,
  combined_1_default: DefaultCombinedTemplate,
  combined_2_modern:  ModernCombinedTemplate,
  combined_3_minimal: MinimalCombinedTemplate,
};

type TabType = 'score' | 'text' | 'combined';

const TAB_META: Record<TabType, { label: string; icon: React.FC<any>; description: string; color: string; activeBg: string }> = {
  score: {
    label: 'Score Results',
    icon: BarChart2,
    description: 'Templates for numeric subject-based assessments',
    color: 'text-blue-600',
    activeBg: 'bg-blue-600',
  },
  text: {
    label: 'Text Results',
    icon: FileText,
    description: 'Templates for qualitative category-based assessments',
    color: 'text-violet-600',
    activeBg: 'bg-violet-600',
  },
  combined: {
    label: 'Combined Results',
    icon: Layers,
    description: 'Templates that blend scores and text evaluations',
    color: 'text-emerald-600',
    activeBg: 'bg-emerald-600',
  },
};

// ─── Shared preview props builder ─────────────────────────────────────────────
function buildPreviewProps(settings: ResultSettings | null, schoolInfo: any) {
  return {
    student:            dummyStudent,
    result: {
      ...dummyStudent,
      session_name:   dummyPeriod.session,
      period_name:    dummyPeriod.term,
      result_data:    dummyScoreResult.subjects,
      result_type:    'score',
      total_score:    dummyScoreResult.summary.total_score,
      average_score:  parseFloat(dummyScoreResult.summary.student_average),
      text_categories: dummyTextCategories,
      ...dummyScoreResult.summary,
    },
    // Use dummy settings for layout/structure, but live colors AND custom field config
    settings: {
      ...dummySettings,
      primary_color:   settings?.primary_color   ?? dummySettings.primary_color,
      secondary_color: settings?.secondary_color ?? dummySettings.secondary_color,
      header_color:    settings?.header_color    ?? dummySettings.header_color,
      accent_color:    settings?.accent_color    ?? dummySettings.accent_color,
      enable_custom_comment_fields: settings?.enable_custom_comment_fields ?? dummySettings.enable_custom_comment_fields,
      custom_comment_fields: settings?.custom_comment_fields ?? dummySettings.custom_comment_fields,
    } as any,
    behaviorCategories: dummyBehavior.categories as any,
    behaviorRatings:    dummyBehaviorRatings,
    comments:           dummyComments,
    termType:           'end_of_term' as const,
    gradeList:          dummyGradeList,
    midtermGradeList:   dummyMidtermGradeList,
    schoolInfo:         schoolInfo ?? dummySchool,
    fieldList:          dummyFieldList,
    subjectList:        dummyScoreSubjects,
  };
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
let _tid = 0;
interface Toast { id: number; type: 'success' | 'error'; message: string }

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-5 right-5 z-[80] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-medium max-w-xs
          ${t.type === 'success' ? 'bg-white border-emerald-200 text-emerald-800' : 'bg-white border-red-200 text-red-800'}`}>
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="opacity-40 hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({
  template, settings, schoolInfo, isActive, canEdit, saving,
  onSetActive, onClose,
}: {
  template: ResultTemplate;
  settings: ResultSettings | null;
  schoolInfo: any;
  isActive: boolean;
  canEdit: boolean;
  saving: boolean;
  onSetActive: () => void;
  onClose: () => void;
}) {
  const Component = TEMPLATE_COMPONENTS[template.id];
  const previewProps = buildPreviewProps(settings, schoolInfo);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
        style={{ maxHeight: '92vh' }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{template.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{template.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-xl">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Currently Active
              </span>
            ) : canEdit ? (
              <button
                onClick={onSetActive}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50"
              >
                {saving
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Check className="h-3.5 w-3.5" />}
                Set as Active
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notice bar */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-shrink-0">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            Preview uses dummy data and your school's saved colors. Actual results will show real student data.
          </p>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-6 min-h-0">
          {Component ? (
            <div style={{ zoom: 0.82 }} className="origin-top">
              <Component {...previewProps} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <Layers className="h-12 w-12 opacity-20" />
              <p className="text-sm">Template component not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Template Card ─────────────────────────────────────────────────────────────
function TemplateCard({
  template, isActive, canEdit, saving, onPreview, onSetActive,
}: {
  template: ResultTemplate;
  isActive: boolean;
  canEdit: boolean;
  saving: boolean;
  onPreview: () => void;
  onSetActive: () => void;
}) {
  const tab = template.type as TabType;
  const meta = TAB_META[tab];

  const topAccent: Record<TabType, string> = {
    score:    'from-blue-400 to-indigo-500',
    text:     'from-violet-400 to-purple-500',
    combined: 'from-emerald-400 to-teal-500',
  };

  return (
    <div className={`group relative bg-white rounded-2xl border-2 transition-all duration-200 overflow-hidden flex flex-col
      ${isActive
        ? 'border-indigo-400 shadow-lg shadow-indigo-100'
        : 'border-slate-100 hover:border-slate-300 hover:shadow-md hover:shadow-slate-100'}`}>

      {/* Top accent line */}
      <div className={`h-1 w-full bg-gradient-to-r ${topAccent[tab]}`} />

      {/* Active badge */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
          ACTIVE
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Icon area */}
        <div className={`w-full h-24 rounded-xl bg-gradient-to-br flex items-center justify-center
          ${tab === 'score'    ? 'from-blue-50 to-indigo-100'
          : tab === 'text'    ? 'from-violet-50 to-purple-100'
          :                     'from-emerald-50 to-teal-100'}`}>
          <meta.icon className={`h-10 w-10 opacity-30 ${meta.color}`} />
        </div>

        {/* Info */}
        <div className="flex-1">
          <p className="font-bold text-slate-800 text-sm leading-tight">{template.name}</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">{template.description}</p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onPreview}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-slate-50 text-slate-700 hover:bg-slate-100 transition-all"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>

          {canEdit && !isActive && (
            <button
              onClick={onSetActive}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm shadow-indigo-200 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Set Active
            </button>
          )}

          {isActive && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle className="h-3.5 w-3.5" />
              Active
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ResultTemplatesPage() {
  const { hasPermission, user } = useAuth();
  const canEdit = user?.is_superuser || hasPermission('result.change_resultsettingsmodel');

  const [activeTab, setActiveTab]         = useState<TabType>('score');
  const [templates, setTemplates]         = useState<ResultTemplate[]>([]);
  const [settings, setSettings]           = useState<ResultSettings | null>(null);
  const [schoolInfo, setSchoolInfo]       = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [previewTemplate, setPreviewTemplate] = useState<ResultTemplate | null>(null);
  const [savingId, setSavingId]           = useState<string | null>(null);
  const [toasts, setToasts]               = useState<Toast[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_tid;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [tpls, sets, info] = await Promise.all([
          resultTemplatesAPI.list(),
          resultSettingsAPI.get(),
          schoolInfoAPI.get().catch(() => null),
        ]);
        setTemplates(tpls);
        setSettings(sets);
        setSchoolInfo(info);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getActiveId = (tab: TabType): string | null => {
    if (!settings) return null;
    const map: Record<TabType, keyof ResultSettings> = {
      score:    'score_template',
      text:     'text_template',
      combined: 'combined_template',
    };
    return (settings[map[tab]] as string) ?? null;
  };

  const handleSetActive = async (template: ResultTemplate) => {
    if (!canEdit) return;
    setSavingId(template.id);
    try {
      await resultTemplatesAPI.select({ type: template.type, template_id: template.id });
      const updated = await resultSettingsAPI.get();
      setSettings(updated);
      showToast('success', `"${template.name}" is now the active ${template.type} template.`);
      setPreviewTemplate(null);
    } catch {
      showToast('error', 'Failed to update template. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredTemplates = templates.filter(t => t.type === activeTab);
  const tabMeta           = TAB_META[activeTab];

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading templates…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          settings={settings}
          schoolInfo={schoolInfo}
          isActive={getActiveId(previewTemplate.type as TabType) === previewTemplate.id}
          canEdit={canEdit}
          saving={savingId === previewTemplate.id}
          onSetActive={() => handleSetActive(previewTemplate)}
          onClose={() => setPreviewTemplate(null)}
        />
      )}

      <div className="space-y-8 pb-12">

        {/* ── Page header ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-8 py-8">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-purple-500/10 blur-2xl" />

          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-900/50">
                  <Layers className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Template Gallery</h1>
              </div>
              <p className="text-sm text-indigo-300/80 pl-13 ml-[52px]">
                Browse, preview and activate result card templates for your school.
              </p>
            </div>

            {/* Active template badges */}
            <div className="flex flex-col gap-1.5 text-right">
              {(['score', 'text', 'combined'] as TabType[]).map(tab => {
                const activeId   = getActiveId(tab);
                const activeTemp = templates.find(t => t.id === activeId);
                return (
                  <div key={tab} className="flex items-center gap-2 justify-end">
                    <span className="text-[11px] text-indigo-400 capitalize font-medium">{tab}:</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                      activeTemp
                        ? 'bg-white/10 text-white'
                        : 'bg-white/5 text-white/30'
                    }`}>
                      {activeTemp?.name ?? 'None set'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-start gap-3 flex-wrap">
          {(['score', 'text', 'combined'] as TabType[]).map(tab => {
            const m        = TAB_META[tab];
            const isActive = activeTab === tab;
            const activeId = getActiveId(tab);
            const count    = templates.filter(t => t.type === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-semibold transition-all border
                  ${isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <m.icon className={`h-4 w-4 ${isActive ? 'text-white' : m.color}`} />
                {m.label}
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md
                  ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
                {activeId && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="Template active" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab description ── */}
        <div className="flex items-center gap-3">
          <tabMeta.icon className={`h-4 w-4 ${tabMeta.color} flex-shrink-0`} />
          <p className="text-sm text-slate-500">{tabMeta.description}</p>
          {getActiveId(activeTab) && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {templates.find(t => t.id === getActiveId(activeTab))?.name} is active
            </span>
          )}
        </div>

        {/* ── Template grid ── */}
        {filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <tabMeta.icon className="h-12 w-12 text-slate-200" />
            <p className="text-slate-400 font-medium">No {activeTab} templates available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                isActive={getActiveId(activeTab) === t.id}
                canEdit={canEdit}
                saving={savingId === t.id}
                onPreview={() => setPreviewTemplate(t)}
                onSetActive={() => handleSetActive(t)}
              />
            ))}
          </div>
        )}

        {/* ── Footer note ── */}
        <p className="text-center text-xs text-slate-400">
          Templates are previewed with dummy student data and your school's saved color scheme.
          Changes take effect immediately for all new result views.
        </p>
      </div>
    </>
  );
}