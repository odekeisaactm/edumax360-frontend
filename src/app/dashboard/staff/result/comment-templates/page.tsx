'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resultCommentTemplatesAPI, resultGroupsAPI } from '@/lib/api';
import { ResultCommentTemplate, ResultConfigurationGroup } from '@/lib/types';
import {
  MessageSquare, Plus, Edit3, Trash2, Search, X, Check, AlertCircle,
  AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Layers, Shield, FileText, Copy, Trash, Eye,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface TemplateFormData {
  configuration_group: number | '';
  comment_type: 'form_teacher' | 'head_teacher';
  applies_to: 'end_of_term' | 'midterm' | 'both';
  comment_text: string;
  min_score: string;
  max_score: string;
}

const PAGE_SIZE = 20;

let _toastId = 0;

interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const msgs = Object.entries(d.details).map(([, v]) => Array.isArray(v) ? v[0] : String(v)).join(' ');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
          : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function ConfirmModal({ open, template, isDeleting, onConfirm, onCancel }: {
  open: boolean; template: ResultCommentTemplate | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !template) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Template</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Delete template for{' '}
          <span className="font-semibold text-slate-700">
            {template.comment_type === 'form_teacher' ? 'Form Teacher' : 'Head Teacher'}
          </span>
          ? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Template Modal ───────────────────────────────────────────────────────────
function TemplateModal({ editing, groups, isSaving, onSave, onClose }: {
  editing: ResultCommentTemplate | null;
  groups: ResultConfigurationGroup[];
  isSaving: boolean;
  onSave: (data: TemplateFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TemplateFormData>({
    configuration_group: editing?.configuration_group || '',
    comment_type: editing?.comment_type || 'form_teacher',
    applies_to: (editing as any)?.applies_to || 'end_of_term',
    comment_text: editing?.comment_text || '',
    min_score: editing?.min_score || '',
    max_score: editing?.max_score || '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.configuration_group) {
      setFormError('Please select a configuration group.');
      return;
    }
    if (!form.comment_text.trim()) {
      setFormError('Comment text is required.');
      return;
    }
    const min = parseFloat(form.min_score);
    const max = parseFloat(form.max_score);
    if (isNaN(min) || isNaN(max)) {
      setFormError('Min and max scores are required.');
      return;
    }
    if (min >= max) {
      setFormError('Min score must be less than max score.');
      return;
    }
    if (min < 0 || max > 100) {
      setFormError('Scores must be between 0 and 100.');
      return;
    }
    try {
      await onSave(form);
    } catch (err) {
      setFormError(extractError(err));
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {editing ? 'Edit Comment Template' : 'New Comment Template'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form id="template-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            <div>
              <label className={labelCls}>Configuration Group <span className="text-red-400 normal-case">*</span></label>
              <select
                required
                value={form.configuration_group}
                onChange={e => setForm({ ...form, configuration_group: e.target.value ? Number(e.target.value) : '' })}
                className={inputCls}
              >
                <option value="">Select a group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1">All classes in this group share these comment templates</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Comment Type <span className="text-red-400 normal-case">*</span></label>
                <select
                  required
                  value={form.comment_type}
                  onChange={e => setForm({ ...form, comment_type: e.target.value as any })}
                  className={inputCls}
                >
                  <option value="form_teacher">Form Teacher Comment</option>
                  <option value="head_teacher">Head Teacher / Principal Comment</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Applies To <span className="text-red-400 normal-case">*</span></label>
                <select
                  required
                  value={form.applies_to}
                  onChange={e => setForm({ ...form, applies_to: e.target.value as any })}
                  className={inputCls}
                >
                  <option value="end_of_term">End of Term Only</option>
                  <option value="midterm">Midterm Only</option>
                  <option value="both">Both End of Term and Midterm</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Min Score <span className="text-red-400 normal-case">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={form.min_score}
                  onChange={e => setForm({ ...form, min_score: e.target.value })}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Max Score <span className="text-red-400 normal-case">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  required
                  value={form.max_score}
                  onChange={e => setForm({ ...form, max_score: e.target.value })}
                  placeholder="100"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Comment Text <span className="text-red-400 normal-case">*</span></label>
              <textarea
                required
                rows={4}
                value={form.comment_text}
                onChange={e => setForm({ ...form, comment_text: e.target.value })}
                placeholder="e.g. Excellent performance, keep it up!"
                className={inputCls + ' resize-none'}
              />
              <p className="text-xs text-slate-400 mt-1">
                If multiple templates match the same score range, one will be chosen randomly for variety.
              </p>
            </div>

          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="template-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Template' : 'Create Template'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CommentTemplatesPage() {
  const { hasPermission, user } = useAuth();

  const [templates, setTemplates] = useState<ResultCommentTemplate[]>([]);
  const [groups, setGroups] = useState<ResultConfigurationGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Pagination state (server-driven — mirrors DRF's count/next/previous envelope)
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [previousUrl, setPreviousUrl] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ResultCommentTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingTemplate, setDeletingTemplate] = useState<ResultCommentTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<number | ''>('');
  const [filterType, setFilterType] = useState<'form_teacher' | 'head_teacher' | ''>('');
  const [filterAppliesTo, setFilterAppliesTo] = useState<'end_of_term' | 'midterm' | 'both' | ''>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [previewGroupId, setPreviewGroupId] = useState<number | null>(null);
  const [previewScore, setPreviewScore] = useState<string>('');
  const [previewType, setPreviewType] = useState<'form_teacher' | 'head_teacher'>('form_teacher');
  const [previewResult, setPreviewResult] = useState<{ auto_comment: string | null; has_match: boolean } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('result.add_resultcommenttemplatemodel');
  const canEdit = user?.is_superuser || hasPermission('result.change_resultcommenttemplatemodel');
  const canDelete = user?.is_superuser || hasPermission('result.delete_resultcommenttemplatemodel');

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async (targetPage: number) => {
    setLoading(true); setPageError(null);
    try {
      const params: any = { page: targetPage, page_size: PAGE_SIZE };
      if (filterGroup) params.configuration_group = filterGroup;
      if (filterType) params.comment_type = filterType;
      if (filterAppliesTo) params.applies_to = filterAppliesTo;

      const [templatesData, groupsData] = await Promise.all([
        resultCommentTemplatesAPI.list(params),
        resultGroupsAPI.list(),
      ]);

      setTemplates(Array.isArray(templatesData.results) ? templatesData.results : []);
      setCount(templatesData.count ?? 0);
      setNextUrl(templatesData.next ?? null);
      setPreviousUrl(templatesData.previous ?? null);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [filterGroup, filterType, filterAppliesTo]);

  // Reset to page 1 whenever server-side filters change, then fetch.
  useEffect(() => {
    setPage(1);
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterGroup, filterType, filterAppliesTo]);

  // Fetch whenever the page changes (but not on the filter-triggered reset above,
  // since that effect already fetches page 1 directly).
  useEffect(() => {
    if (page === 1) return;
    fetchData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const goToNextPage = () => {
    if (!nextUrl) return;
    setPage(p => p + 1);
  };
  const goToPreviousPage = () => {
    if (!previousUrl || page <= 1) return;
    setPage(p => p - 1);
  };

  const handleSave = async (data: TemplateFormData) => {
    setIsSaving(true);
    try {
      const payload = {
        configuration_group: data.configuration_group as number,
        comment_type: data.comment_type,
        applies_to: data.applies_to,
        comment_text: data.comment_text,
        min_score: data.min_score,
        max_score: data.max_score,
      };

      if (editingTemplate) {
        const updated = await resultCommentTemplatesAPI.update(editingTemplate.id, payload as any);
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updated : t));
        showToast('success', 'Template updated successfully');
      } else {
        await resultCommentTemplatesAPI.create(payload as any);
        showToast('success', 'Template created successfully');
      }
      setShowModal(false);
      setEditingTemplate(null);
      // Re-fetch current page from the server so count/results stay accurate
      // (a new template may land on a different page than the one we're viewing).
      fetchData(page);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    try {
      await resultCommentTemplatesAPI.delete(deletingTemplate.id);
      showToast('success', 'Template deleted successfully');
      setDeletingTemplate(null);
      // If we just deleted the last item on a page beyond page 1, step back a page.
      const isLastItemOnPage = templates.length === 1 && page > 1;
      const targetPage = isLastItemOnPage ? page - 1 : page;
      if (isLastItemOnPage) setPage(targetPage);
      fetchData(targetPage);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingTemplate(null);
    } finally { setIsDeleting(false); }
  };

  const handlePreview = async () => {
    if (!previewGroupId || !previewScore) return;
    setPreviewLoading(true);
    try {
      const result = await resultCommentTemplatesAPI.preview({
        group_id: previewGroupId,
        score: parseFloat(previewScore),
        type: previewType,
      });
      setPreviewResult(result);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const getGroupName = (id: number) => groups.find(g => g.id === id)?.name ?? `Group ${id}`;

  // Search remains client-side (comment_text isn't in filterset_fields / no search backend
  // configured on the viewset), so it only searches within the currently loaded page.
  const filtered = templates.filter(t => {
    const matchSearch = !searchTerm || t.comment_text.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  const totalByType = {
    form_teacher: templates.filter(t => t.comment_type === 'form_teacher').length,
    head_teacher: templates.filter(t => t.comment_type === 'head_teacher').length,
  };

  const getAppliesToLabel = (appliesTo: string) => {
    switch (appliesTo) {
      case 'end_of_term': return 'End of Term';
      case 'midterm': return 'Midterm';
      case 'both': return 'Both';
      default: return appliesTo;
    }
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingTemplate}
        template={deletingTemplate}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeletingTemplate(null)}
      />

      {showModal && (
        <TemplateModal
          editing={editingTemplate}
          groups={groups}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingTemplate(null); }}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            Comment Templates
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage auto-comment templates for form and head teachers</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingTemplate(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> New Template
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Templates', value: count, icon: MessageSquare, color: 'from-blue-500 to-blue-600' },
          { label: 'Form Teacher (page)', value: totalByType.form_teacher, icon: FileText, color: 'from-emerald-500 to-teal-600' },
          { label: 'Head Teacher (page)', value: totalByType.head_teacher, icon: Shield, color: 'from-violet-500 to-purple-600' },
          { label: 'Groups', value: groups.length, icon: Layers, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 truncate">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Preview Tool ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-center gap-2 mb-3">
          <Eye className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-blue-800">Preview Comment Template</h3>
          <span className="text-xs text-blue-500 ml-2">Test which comment would be selected for a given score</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={previewGroupId || ''}
            onChange={e => setPreviewGroupId(e.target.value ? Number(e.target.value) : null)}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">Select Group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select
            value={previewType}
            onChange={e => setPreviewType(e.target.value as any)}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="form_teacher">Form Teacher Comment</option>
            <option value="head_teacher">Head Teacher Comment</option>
          </select>
          <input
            type="number"
            step="0.5"
            min="0"
            max="100"
            placeholder="Score (e.g., 75)"
            value={previewScore}
            onChange={e => setPreviewScore(e.target.value)}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
          <button
            onClick={handlePreview}
            disabled={!previewGroupId || !previewScore || previewLoading}
            className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Preview
          </button>
        </div>
        {previewResult && (
          <div className={`mt-3 p-3 rounded-xl ${previewResult.has_match ? 'bg-white border border-blue-200' : 'bg-amber-50 border border-amber-200'}`}>
            <p className="text-xs font-semibold text-slate-500 mb-1">Preview Result:</p>
            {previewResult.has_match ? (
              <p className="text-sm text-slate-700 italic">"{previewResult.auto_comment}"</p>
            ) : (
              <p className="text-sm text-amber-700">No matching template found for this score range.</p>
            )}
          </div>
        )}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search this page by comment text..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={filterGroup}
            onChange={e => setFilterGroup(e.target.value ? Number(e.target.value) : '')}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">All Types</option>
            <option value="form_teacher">Form Teacher</option>
            <option value="head_teacher">Head Teacher</option>
          </select>
          <select
            value={filterAppliesTo}
            onChange={e => setFilterAppliesTo(e.target.value as any)}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="">All Applies To</option>
            <option value="end_of_term">End of Term Only</option>
            <option value="midterm">Midterm Only</option>
            <option value="both">Both</option>
          </select>
          <button onClick={() => fetchData(page)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading templates...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={() => fetchData(page)} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterGroup || filterType || filterAppliesTo ? 'No templates match your search' : 'No comment templates yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterGroup || filterType || filterAppliesTo ? 'Try different keywords or filters.' : 'Create your first comment template to enable auto-comments.'}
            </p>
            {!searchTerm && !filterGroup && !filterType && !filterAppliesTo && canCreate && (
              <button onClick={() => { setEditingTemplate(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> New Template
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_100px_120px_100px_100px] items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Comment Template</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Applies To</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score Range</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(template => (
                <div key={template.id}>
                  <div className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_100px_120px_100px_100px] items-start sm:items-center gap-3 sm:gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    {/* Comment preview */}
                    <div className="min-w-0 w-full sm:w-auto">
                      <p className="text-sm font-medium text-slate-800 truncate">{template.comment_text.substring(0, 60)}</p>
                      {template.comment_text.length > 60 && (
                        <p className="text-xs text-slate-400 mt-0.5">...{template.comment_text.substring(60, 100)}</p>
                      )}
                    </div>

                    {/* Group */}
                    <div className="flex items-center gap-1.5 sm:block">
                      <span className="sm:hidden text-xs text-slate-400">Group:</span>
                      <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[110px] block">
                        {getGroupName(template.configuration_group)}
                      </span>
                    </div>

                    {/* Type badge */}
                    <div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                        template.comment_type === 'form_teacher'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-violet-100 text-violet-700'
                      }`}>
                        {template.comment_type === 'form_teacher' ? 'Form Teacher' : 'Head Teacher'}
                      </span>
                    </div>

                    {/* Applies To badge */}
                    <div>
                      <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                        (template as any).applies_to === 'both'
                          ? 'bg-purple-100 text-purple-700'
                          : (template as any).applies_to === 'midterm'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {getAppliesToLabel((template as any).applies_to || 'end_of_term')}
                      </span>
                    </div>

                    {/* Score range */}
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-mono text-slate-700">{template.min_score}</span>
                      <span className="text-xs text-slate-300">–</span>
                      <span className="text-sm font-mono text-slate-700">{template.max_score}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button onClick={() => { setEditingTemplate(template); setShowModal(true); }} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingTemplate(template)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === template.id ? null : template.id)} title="View full comment"
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                        {expandedId === template.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded full comment */}
                  {expandedId === template.id && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="ml-0 sm:ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Full Comment Text</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{template.comment_text}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mt-4 pt-3 border-t border-slate-100">
                          <div>
                            <span className="text-slate-400">Template ID</span>
                            <p className="font-semibold text-slate-700">#{template.id}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Created</span>
                            <p className="font-semibold text-slate-700">{new Date(template.created_at).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Min Score</span>
                            <p className="font-semibold text-slate-700">{template.min_score}</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Max Score</span>
                            <p className="font-semibold text-slate-700">{template.max_score}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer — count + pagination controls */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {count} template{count !== 1 ? 's' : ''} on page {page} of {totalPages}
                {filterGroup ? ` (filtered by group)` : ''}
                {filterType ? ` (${filterType === 'form_teacher' ? 'Form Teacher' : 'Head Teacher'})` : ''}
                {filterAppliesTo ? ` (${getAppliesToLabel(filterAppliesTo)})` : ''}
                {searchTerm ? ` — search applies to this page only` : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousPage}
                  disabled={!previousUrl || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </button>
                <span className="text-xs text-slate-500 px-1">Page {page} / {totalPages}</span>
                <button
                  onClick={goToNextPage}
                  disabled={!nextUrl || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}