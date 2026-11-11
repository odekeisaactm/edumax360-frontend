'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultTransferAPI } from '@/lib/api';
import type {
  ExamResultTransferConfig,
  GroupsSummaryResponse,
  PreviewResponse,
} from '@/lib/assessment.types';
import {
  ArrowLeft, AlertCircle, AlertTriangle, Loader2, Check, X, Info,
  Play, AlertOctagon, Shield, CheckCircle2, Clock, RefreshCw, Save,
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ResultTransferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { hasPermission, user } = useAuth();
  const [mounted, setMounted] = useState(false);

  const configId = params?.id ? parseInt(params.id as string) : null;

  const canManage =
    !!user && (user.is_superuser || hasPermission('result.can_publish_result'));

  // Data
  const [config, setConfig] = useState<ExamResultTransferConfig | null>(null);
  const [groupsSummary, setGroupsSummary] = useState<GroupsSummaryResponse | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);

  // Mapping edit state
  const [mappings, setMappings] = useState<Record<number, MappingEntry>>({});
  const [savedFingerprint, setSavedFingerprint] = useState('');

  // Loading flags
  const [loading, setLoading] = useState(true);
  const [savingMappings, setSavingMappings] = useState(false);
  const [refreshingPreview, setRefreshingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Dirty check ──
  const currentFingerprint = useMemo(
    () => JSON.stringify(mappings),
    [mappings]
  );
  const isDirty = savedFingerprint !== '' && currentFingerprint !== savedFingerprint;

  // ── Load all ──
  const loadAll = useCallback(async () => {
    if (!configId || !canManage) return;
    setLoading(true);
    setError(null);
    try {
      const [cfg, groups, prev] = await Promise.all([
        resultTransferAPI.get(configId),
        resultTransferAPI.getGroupsSummary(configId),
        resultTransferAPI.preview(configId),
      ]);
      setConfig(cfg);
      setGroupsSummary(groups);
      setPreview(prev);

      const m: Record<number, MappingEntry> = {};
      for (const g of groups.groups) {
        m[g.group_id] = {
          result_field_id: g.mapping?.result_field ?? null,
          is_exempt: g.mapping?.is_exempt ?? !g.available_fields.length,
          round_to_nearest_half: g.mapping?.round_to_nearest_half ?? true,
        };
      }
      setMappings(m);
      setSavedFingerprint(JSON.stringify(m));
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [configId, canManage]);

  useEffect(() => {
    if (mounted) loadAll();
  }, [mounted, loadAll]);

  // ── Save mappings ──
  const handleSaveMappings = async () => {
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

      setSavedFingerprint(currentFingerprint);

      // Refresh preview
      setRefreshingPreview(true);
      const prev = await resultTransferAPI.preview(configId);
      setPreview(prev);

      // Refresh groups_summary to update mapping metadata
      const groups = await resultTransferAPI.getGroupsSummary(configId);
      setGroupsSummary(groups);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSavingMappings(false);
      setRefreshingPreview(false);
    }
  };

  // ── Execute / Re-run ──
  const requestExecute = () => {
    if (!configId || !preview?.can_execute || isDirty) return;
    const count = preview.transferrable;
    const isRerun = !!config?.is_transferred;

    setConfirmState({
      title: isRerun ? 'Re-run transfer?' : 'Execute transfer?',
      message: isRerun
        ? `Re-transfer ${count} score${count !== 1 ? 's' : ''}?\n\nExisting scores in the Result module will be overwritten with the current values.`
        : `Transfer ${count} score${count !== 1 ? 's' : ''} into the Result module?\n\nThis can be run again later if needed.`,
      confirmLabel: isRerun ? 'Re-run' : 'Execute',
      variant: 'success',
      onConfirm: async () => {
        setConfirmBusy(true);
        setConfirmState(null);
        setExecuting(true);
        setError(null);
        try {
          await resultTransferAPI.execute(configId);
          await loadAll();
        } catch (err: any) {
          setError(extractError(err));
        } finally {
          setExecuting(false);
          setConfirmBusy(false);
        }
      },
    });
  };

  // ── Guards ──
  if (!mounted || loading) {
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
          <p className="text-sm text-slate-500">You don't have permission to manage this transfer.</p>
        </div>
      </div>
    );
  }

  if (!config || !groupsSummary) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Config not found</h2>
          <p className="text-sm text-slate-500 mb-4">{error || 'This transfer config could not be loaded.'}</p>
          <button
            onClick={() => router.push('/dashboard/staff/assessment/result-transfer')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to list
          </button>
        </div>
      </div>
    );
  }

  // ── Partial transfer delta ──
  const transferDelta =
    config.is_transferred && preview
      ? preview.transferrable - config.students_transferred
      : 0;

  const canExecute = !!preview?.can_execute && !isDirty && !executing;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-32">

      <ConfirmModal
        open={!!confirmState}
        state={confirmState}
        loading={confirmBusy}
        onCancel={() => { if (!confirmBusy) setConfirmState(null); }}
      />

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push('/dashboard/staff/assessment/result-transfer')}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors mt-0.5 flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{config.exam_name}</h1>
            {config.is_transferred ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" /> Transferred
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                <Clock className="h-3 w-3" /> Pending
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {config.is_transferred && config.last_transfer_date
              ? `Last run: ${new Date(config.last_transfer_date).toLocaleString()} · ${config.students_transferred} student${config.students_transferred !== 1 ? 's' : ''}`
              : 'Not yet executed'}
          </p>
        </div>
        <button
          onClick={loadAll}
          title="Refresh"
          className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* ── Partial transfer banner ── */}
      {config.is_transferred && transferDelta > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="font-semibold">
              {transferDelta} new attempt{transferDelta !== 1 ? 's' : ''} since the last run
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Re-run to include them. Existing scores will be preserved and overwritten with current values.
            </p>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="flex-1 whitespace-pre-line">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Groups mapping card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Configuration groups ({groupsSummary.groups.length})
          </span>
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
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

        {isDirty && (
          <div className="px-5 py-3 border-t border-slate-100 bg-amber-50/40 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-800">
              You have unsaved mapping changes.
            </p>
            <button
              onClick={handleSaveMappings}
              disabled={savingMappings || refreshingPreview}
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            >
              {savingMappings || refreshingPreview
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              {savingMappings ? 'Saving…' : refreshingPreview ? 'Updating preview…' : 'Save Mappings'}
            </button>
          </div>
        )}
      </div>

      {/* ── Preview card ── */}
      {preview && (
        <>
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
              <div className="overflow-x-auto max-h-[460px]">
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
        </>
      )}

      {/* ── Sticky action bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {isDirty ? (
              <span className="text-amber-600 font-medium">Unsaved changes — save before executing</span>
            ) : preview && preview.can_execute ? (
              <span>Ready to {config.is_transferred ? 're-run' : 'execute'} — {preview.transferrable} score{preview.transferrable !== 1 ? 's' : ''}</span>
            ) : preview && preview.errors.length > 0 ? (
              <span className="text-red-600 font-medium">{preview.errors.length} error{preview.errors.length !== 1 ? 's' : ''} — fix mappings to continue</span>
            ) : (
              <span>Nothing to transfer yet</span>
            )}
          </div>
          <button
            onClick={requestExecute}
            disabled={!canExecute}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {executing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Executing…</>
            ) : (
              <><Play className="h-4 w-4" /> {config.is_transferred ? 'Re-run Transfer' : 'Execute Transfer'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}