'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { examsAPI, resultTransferAPI } from '@/lib/api';
import type {
  Exam,
  ExamResultTransferConfig,
  GroupsSummaryResponse,
  PreviewResponse,
} from '@/lib/assessment.types';
import {
  ArrowLeft, ArrowRight, AlertCircle, AlertTriangle,
  Loader2, Check, X, Info, Play, AlertOctagon, Shield,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  const d = err?.response?.data;
  if (typeof d === 'string') return d;
  if (d?.detail) return d.detail;
  if (d?.error) return d.error;
  return err?.message || 'An error occurred';
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────

type ConfirmVariant = 'danger' | 'primary' | 'success';

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  variant: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
}

function ConfirmModal({
  open, state, loading, onCancel,
}: {
  open: boolean;
  state: ConfirmState | null;
  loading: boolean;
  onCancel: () => void;
}) {
  if (!open || !state) return null;

  const variants = {
    danger: {
      iconBg: 'bg-red-100', iconColor: 'text-red-600',
      btn: 'bg-red-600 hover:bg-red-700', Icon: AlertOctagon,
    },
    primary: {
      iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
      btn: 'bg-violet-600 hover:bg-violet-700', Icon: Info,
    },
    success: {
      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
      btn: 'bg-emerald-600 hover:bg-emerald-700', Icon: Play,
    },
  }[state.variant];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${variants.iconBg}`}>
          <variants.Icon className={`h-6 w-6 ${variants.iconColor}`} />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">{state.title}</h3>
        <p className="text-sm text-slate-500 text-center mb-6 whitespace-pre-line">{state.message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={state.onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors ${variants.btn}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type MappingEntry = {
  result_field_id: number | null;
  is_exempt: boolean;
  round_to_nearest_half: boolean;
};

type Step = 1 | 2 | 3;

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewResultTransferPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();
  const [mounted, setMounted] = useState(false);

  const canManage =
    !!user && (user.is_superuser || hasPermission('result.can_publish_result'));

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [exams, setExams] = useState<Exam[]>([]);
  const [existingConfigs, setExistingConfigs] = useState<ExamResultTransferConfig[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [creatingConfig, setCreatingConfig] = useState(false);

  // Active config
  const [configId, setConfigId] = useState<number | null>(null);
  const [configCreatedByWizard, setConfigCreatedByWizard] = useState(false);

  // Step 2
  const [groupsSummary, setGroupsSummary] = useState<GroupsSummaryResponse | null>(null);
  const [mappings, setMappings] = useState<Record<number, MappingEntry>>({});
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [savingMappings, setSavingMappings] = useState(false);

  // Step 3
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Load exams + existing configs
  useEffect(() => {
    if (!mounted || !canManage) return;
    (async () => {
      setLoadingExams(true);
      setError(null);
      try {
        const [examList, configs] = await Promise.all([
          examsAPI.list({ is_published: true }),
          resultTransferAPI.list(),
        ]);
        setExams(examList);
        setExistingConfigs(configs);
      } catch (err: any) {
        setError(extractError(err));
      } finally {
        setLoadingExams(false);
      }
    })();
  }, [mounted, canManage]);

  // Only exclude fully-transferred exams. Drafts stay pickable.
  const eligibleExams = useMemo(() => {
    const transferred = new Set(
      existingConfigs.filter(c => c.is_transferred).map(c => c.exam)
    );
    return exams.filter(e => !transferred.has(e.id));
  }, [exams, existingConfigs]);

  const getDraftConfig = useCallback((examId: number) => {
    return existingConfigs.find(c => c.exam === examId && !c.is_transferred) || null;
  }, [existingConfigs]);

  const selectedExam = useMemo(
    () => exams.find(e => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  const selectedDraft = useMemo(
    () => selectedExamId ? getDraftConfig(selectedExamId) : null,
    [selectedExamId, getDraftConfig]
  );

  // Step 1 → create or resume → load groups
  const handleContinueStep1 = async () => {
    if (!selectedExamId) return;
    setCreatingConfig(true);
    setError(null);
    try {
      let activeConfigId: number;
      const draft = getDraftConfig(selectedExamId);

      if (draft) {
        activeConfigId = draft.id;
        setConfigCreatedByWizard(false);
      } else {
        const config = await resultTransferAPI.create({ exam: selectedExamId });
        activeConfigId = config.id;
        setConfigCreatedByWizard(true);
      }

      setConfigId(activeConfigId);
      setLoadingGroups(true);

      const summary = await resultTransferAPI.getGroupsSummary(activeConfigId);
      setGroupsSummary(summary);

      const initial: Record<number, MappingEntry> = {};
      for (const g of summary.groups) {
        const m = g.mapping;
        const hasFields = g.available_fields.length > 0;
        initial[g.group_id] = {
          result_field_id: m?.result_field ?? null,
          is_exempt: m?.is_exempt ?? !hasFields,
          round_to_nearest_half: m?.round_to_nearest_half ?? true,
        };
      }
      setMappings(initial);
      setStep(2);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setCreatingConfig(false);
      setLoadingGroups(false);
    }
  };

  // Back from step 2 — confirm before discarding
  const requestBackFromStep2 = () => {
    if (!configId || !configCreatedByWizard) {
      setConfigId(null);
      setGroupsSummary(null);
      setMappings({});
      setSelectedExamId(null);
      setStep(1);
      return;
    }
    setConfirmState({
      title: 'Discard this transfer config?',
      message: 'Going back will delete the draft transfer configuration. No scores have been transferred.',
      confirmLabel: 'Discard',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await resultTransferAPI.delete(configId);
          setExistingConfigs(prev => prev.filter(c => c.id !== configId));
        } catch { /* ignore */ }
        setConfirmBusy(false);
        setConfirmState(null);
        setConfigId(null);
        setConfigCreatedByWizard(false);
        setGroupsSummary(null);
        setMappings({});
        setSelectedExamId(null);
        setStep(1);
      },
    });
  };

  // Step 2 → save → preview
  const handleSaveMappingsAndPreview = async () => {
    if (!configId || !groupsSummary) return;

    const missing = groupsSummary.groups.filter(g => {
      const m = mappings[g.group_id];
      return m && !m.is_exempt && !m.result_field_id;
    });
    if (missing.length > 0) {
      setError(
        `Select a field for every active group. Missing: ${missing.map(g => g.group_name).join(', ')}`
      );
      return;
    }

    setSavingMappings(true);
    setError(null);
    try {
      const payload = groupsSummary.groups.map(g => {
        const m = mappings[g.group_id];
        return {
          configuration_group_id: g.group_id,
          result_field_id: m.is_exempt ? null : m.result_field_id,
          is_exempt: m.is_exempt,
          round_to_nearest_half: m.round_to_nearest_half,
        };
      });

      const saveResult = await resultTransferAPI.setGroupMappings(configId, payload);
      if (saveResult.errors && saveResult.errors.length > 0) {
        setError(`Some mappings failed: ${saveResult.errors.join('; ')}`);
        return;
      }

      setLoadingPreview(true);
      const previewData = await resultTransferAPI.preview(configId);
      setPreview(previewData);
      setStep(3);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSavingMappings(false);
      setLoadingPreview(false);
    }
  };

  // Step 3 → confirm → execute
  const requestExecute = () => {
    if (!configId || !preview?.can_execute) return;
    const count = preview.transferrable;
    setConfirmState({
      title: 'Execute transfer?',
      message: `Transfer ${count} score${count !== 1 ? 's' : ''} into the Result module?\n\nThis can be run again later if a student's scores need to be updated.`,
      confirmLabel: 'Execute',
      variant: 'success',
      onConfirm: async () => {
        setConfirmBusy(true);
        setConfirmState(null);
        setExecuting(true);
        setError(null);
        try {
          await resultTransferAPI.execute(configId);
          router.push(`/dashboard/staff/assessment/result-transfer/${configId}`);
        } catch (err: any) {
          setError(extractError(err));
          setExecuting(false);
          setConfirmBusy(false);
        }
      },
    });
  };

  // Guards
  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Access Denied</h2>
          <p className="text-sm text-slate-500">You don't have permission to manage result transfers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">

      <ConfirmModal
        open={!!confirmState}
        state={confirmState}
        loading={confirmBusy}
        onCancel={() => { if (!confirmBusy) setConfirmState(null); }}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (step === 1) router.push('/dashboard/staff/assessment/result-transfer');
            else if (step === 2) requestBackFromStep2();
            else setStep(2);
          }}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">New Result Transfer</h1>
          <p className="text-sm text-slate-500">
            {step === 1 && 'Select an exam to configure'}
            {step === 2 && 'Map each configuration group to a target field'}
            {step === 3 && 'Review the transfer before executing'}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(n => (
          <React.Fragment key={n}>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              step === n
                ? 'bg-violet-600 text-white border-violet-600'
                : step > n
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}>
              {step > n ? <Check className="h-3 w-3" /> : <span>{n}</span>}
              <span>{n === 1 ? 'Select Exam' : n === 2 ? 'Map Groups' : 'Preview & Execute'}</span>
            </div>
            {n < 3 && (
              <div className={`h-px flex-1 ${step > n ? 'bg-emerald-300' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1 whitespace-pre-line">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* STEP 1 */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
          {loadingExams ? (
            <div className="flex items-center justify-center py-8 gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
              <span className="text-sm">Loading exams…</span>
            </div>
          ) : eligibleExams.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Info className="h-7 w-7 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No eligible exams</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Either no published exams exist, or every published exam has already been transferred.
                Check the <button onClick={() => router.push('/dashboard/staff/assessment/result-transfer')} className="text-violet-600 underline">transfer list</button> to see existing configs.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Select exam
                </label>
                <select
                  value={selectedExamId ?? ''}
                  onChange={e => setSelectedExamId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  <option value="">— Choose an exam —</option>
                  {eligibleExams.map(e => {
                    const isDraft = !!getDraftConfig(e.id);
                    return (
                      <option key={e.id} value={e.id}>
                        {e.name}{isDraft ? ' (draft — will resume)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedExam && (
                <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl space-y-1.5">
                  <p className="text-sm font-bold text-violet-900">{selectedExam.name}</p>
                  <p className="text-xs text-violet-700">
                    {selectedExam.exam_type} · {selectedExam.start_date} → {selectedExam.end_date}
                  </p>
                  {selectedDraft && (
                    <p className="text-xs text-amber-700 font-medium pt-1 border-t border-violet-200 mt-2">
                      ↻ A draft config for this exam already exists. Continuing will resume it.
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <span>
                  The next step asks you to map each result configuration group to a target field.
                  Nothing is transferred until you explicitly execute at the last step.
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleContinueStep1}
                  disabled={!selectedExamId || creatingConfig}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
                >
                  {creatingConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {creatingConfig ? 'Preparing…' : selectedDraft ? 'Resume Draft' : 'Continue'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="space-y-4">
          {loadingGroups ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 flex items-center justify-center gap-3 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
              <span className="text-sm">Loading groups…</span>
            </div>
          ) : !groupsSummary || groupsSummary.groups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="h-7 w-7 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">No configuration groups found</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                This exam has no submitted attempts from classes with an active result
                configuration group.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Configuration groups ({groupsSummary.groups.length})
                  </span>
                  <span className="text-xs text-slate-400">
                    Map each group to the field that should receive the score
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {groupsSummary.groups.map(g => {
                    const entry = mappings[g.group_id];
                    const hasFields = g.available_fields.length > 0;
                    return (
                      <div key={g.group_id} className={`p-5 transition-colors ${entry?.is_exempt ? 'bg-slate-50/50 opacity-70' : ''}`}>
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="font-bold text-slate-900">{g.group_name}</h3>
                              {!hasFields && (
                                <span className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full border border-red-200">
                                  NO FIELD SET
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {g.class_count} {g.class_count === 1 ? 'class' : 'classes'} · {g.attempt_count} submitted {g.attempt_count === 1 ? 'attempt' : 'attempts'}
                            </p>
                            {g.class_names.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1 truncate" title={g.class_names.join(', ')}>
                                {g.class_names.slice(0, 5).join(', ')}
                                {g.class_names.length > 5 && ` +${g.class_names.length - 5} more`}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 sm:w-[280px] flex-shrink-0">
                            <select
                              value={entry?.is_exempt ? '' : (entry?.result_field_id ?? '')}
                              onChange={e => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                setMappings(prev => ({
                                  ...prev,
                                  [g.group_id]: {
                                    ...prev[g.group_id],
                                    result_field_id: val,
                                    is_exempt: false,
                                  },
                                }));
                              }}
                              disabled={!hasFields || entry?.is_exempt}
                              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-400"
                            >
                              <option value="">— Select field —</option>
                              {g.available_fields.map(f => (
                                <option key={f.id} value={f.id}>
                                  {f.name} (max {f.max_mark})
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={entry?.round_to_nearest_half ?? true}
                                  onChange={e => setMappings(prev => ({
                                    ...prev,
                                    [g.group_id]: { ...prev[g.group_id], round_to_nearest_half: e.target.checked },
                                  }))}
                                  className="rounded text-violet-600 focus:ring-violet-500"
                                />
                                Round to 0.5
                              </label>
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={entry?.is_exempt ?? false}
                                  onChange={e => setMappings(prev => ({
                                    ...prev,
                                    [g.group_id]: {
                                      ...prev[g.group_id],
                                      is_exempt: e.target.checked,
                                      result_field_id: e.target.checked ? null : prev[g.group_id].result_field_id,
                                    },
                                  }))}
                                  className="rounded text-amber-600 focus:ring-amber-500"
                                />
                                Exempt
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={requestBackFromStep2}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMappingsAndPreview}
                  disabled={savingMappings || loadingPreview}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition-all"
                >
                  {savingMappings || loadingPreview
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <ArrowRight className="h-4 w-4" />}
                  {savingMappings ? 'Saving mappings…' : loadingPreview ? 'Building preview…' : 'Save & Preview'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-xs font-medium text-slate-500 mb-0.5">Transferrable</p>
              <p className="text-2xl font-bold text-violet-600">{preview.transferrable}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
              <p className="text-xs font-medium text-slate-500 mb-0.5">Exempted</p>
              <p className="text-2xl font-bold text-slate-500">{preview.exempted}</p>
            </div>
            <div className={`rounded-xl border shadow-sm px-4 py-3 ${
              preview.errors.length > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}>
              <p className={`text-xs font-medium mb-0.5 ${
                preview.errors.length > 0 ? 'text-red-600' : 'text-emerald-600'
              }`}>Errors</p>
              <p className={`text-2xl font-bold ${
                preview.errors.length > 0 ? 'text-red-700' : 'text-emerald-700'
              }`}>{preview.errors.length}</p>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
                <AlertTriangle className="h-4 w-4" />
                {preview.errors.length} attempt{preview.errors.length !== 1 ? 's' : ''} cannot be transferred
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {preview.errors.slice(0, 20).map((e, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <span className="font-semibold">{e.student}</span> ({e.class}): {e.reason}
                  </p>
                ))}
                {preview.errors.length > 20 && (
                  <p className="text-xs text-red-500 italic">… and {preview.errors.length - 20} more</p>
                )}
              </div>
            </div>
          )}

          {preview.rows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Preview ({preview.rows.length} row{preview.rows.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="overflow-x-auto max-h-[420px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Student</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Class</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Subject</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Raw</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">→ Field</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Converted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2 text-slate-700">{row.student_name}</td>
                        <td className="px-4 py-2 text-slate-600 text-xs">{row.class}</td>
                        <td className="px-4 py-2 text-slate-600">{row.subject}</td>
                        <td className="px-4 py-2 text-right text-slate-600">
                          {row.raw_score.toFixed(1)} / {row.exam_max.toFixed(0)}
                        </td>
                        <td className="px-4 py-2 text-slate-700 text-xs">
                          {row.target_field}
                          {row.override_applied && (
                            <span className="ml-1 text-[10px] font-bold text-amber-600">OVR</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-900">
                          {row.converted_score.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.rows.length === 0 && preview.errors.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center">
              <p className="text-sm text-slate-500">No attempts to transfer.</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={executing}
              className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Back to mapping
            </button>
            <button
              onClick={requestExecute}
              disabled={executing || !preview.can_execute}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {executing ? 'Executing…' : `Execute Transfer (${preview.transferrable})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}