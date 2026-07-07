'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultGradeSetsAPI, resultGradesAPI, resultGroupsAPI, resultSettingsAPI } from '@/lib/api';
import { ResultGradeSet, ResultGrade, ResultConfigurationGroup, ResultSettings } from '@/lib/types';
import {
  Award, Plus, Edit3, Trash2, Search, X, Check, AlertCircle,
  AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Lock, Unlock, Layers, Shield, ArrowRight, CheckCircle2,
  Minus, GraduationCap,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface GradeRow {
  _id: string;
  order: number;
  name: string;
  end_of_term_min: string;
  end_of_term_max: string;
  end_of_term_remark: string;
  midterm_name: string;
  midterm_name_locked: boolean;
  midterm_min: string;
  midterm_max: string;
  midterm_remark: string;
}

let _uid = 0;
const uid = () => String(++_uid);
let _toastId = 0;

interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

const emptyRow = (order: number): GradeRow => ({
  _id: uid(), order,
  name: '', end_of_term_min: '', end_of_term_max: '', end_of_term_remark: '',
  midterm_name: '', midterm_name_locked: true,
  midterm_min: '', midterm_max: '', midterm_remark: '',
});

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

function capitalizeName(name: string): string {
  return name ? name.toUpperCase() : '';
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

function ConfirmModal({ open, gradeSet, isDeleting, onConfirm, onCancel }: {
  open: boolean; gradeSet: ResultGradeSet | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !gradeSet) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Grade Set</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Delete <span className="font-semibold text-slate-700">"{gradeSet.name}"</span>? All grades within it will also be deleted. This cannot be undone.
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

// ─── Coverage Bar ──────────────────────────────────────────────────────────────
function CoverageBar({ rows }: { rows: GradeRow[] }) {
  const segments = rows
    .filter(r => r.end_of_term_min !== '' && r.end_of_term_max !== '')
    .map(r => ({ min: Number(r.end_of_term_min), max: Number(r.end_of_term_max), name: r.name || '?' }))
    .sort((a, b) => a.min - b.min);

  const covers0 = segments.length > 0 && segments[0].min === 0;
  const covers100 = segments.length > 0 && segments[segments.length - 1].max === 100;
  const hasGap = segments.some((s, i) => i > 0 && s.min !== segments[i - 1].max);
  const hasOverlap = segments.some((s, i) => i > 0 && s.min < segments[i - 1].max);
  const isValid = covers0 && covers100 && !hasGap && !hasOverlap && segments.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">End of Term Coverage (0–100)</span>
        {isValid
          ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Valid</span>
          : <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Incomplete</span>
        }
      </div>
      <div className="relative h-6 bg-slate-100 rounded-lg overflow-hidden">
        {segments.map((s, i) => (
          <div key={i}
            className={`absolute h-full flex items-center justify-center text-white text-[10px] font-bold transition-all ${
              i % 2 === 0 ? 'bg-blue-500' : 'bg-indigo-500'
            }`}
            style={{ left: `${s.min}%`, width: `${Math.max(0, s.max - s.min)}%` }}
            title={`${s.name}: ${s.min}–${s.max}`}>
            {s.max - s.min >= 8 ? s.name : ''}
          </div>
        ))}
        <span className="absolute left-0 bottom-0 text-[9px] text-slate-400 px-0.5">0</span>
        <span className="absolute right-0 bottom-0 text-[9px] text-slate-400 px-0.5">100</span>
      </div>
      {hasGap && <p className="text-xs text-red-500">⚠ Gap detected between grades — ranges must be continuous.</p>}
      {hasOverlap && <p className="text-xs text-red-500">⚠ Overlap detected between grades.</p>}
      {!covers0 && segments.length > 0 && <p className="text-xs text-amber-600">Grades must start at 0.</p>}
      {!covers100 && segments.length > 0 && <p className="text-xs text-amber-600">Grades must end at 100.</p>}
    </div>
  );
}

// ─── Validate Grades ───────────────────────────────────────────────────────────
function validateGrades(rows: GradeRow[], useMidterm: boolean, midtermMax: number): string[] {
  const errors: string[] = [];
  if (rows.length === 0) { errors.push('Add at least one grade.'); return errors; }

  // End of term validation
  const eot = rows
    .map((r, i) => ({ i, min: Number(r.end_of_term_min), max: Number(r.end_of_term_max), name: r.name, remark: r.end_of_term_remark }))
    .filter(r => !isNaN(r.min) && !isNaN(r.max))
    .sort((a, b) => a.min - b.min);

  if (eot.length === 0) {
    errors.push('At least one grade must have valid min/max values.');
  } else {
    eot.forEach(({ i, min, max, name, remark }) => {
      if (!name.trim()) errors.push(`Grade ${i + 1}: Name is required.`);
      if (!remark.trim()) errors.push(`Grade ${i + 1}: End of term remark is required.`);
      if (min >= max) errors.push(`Grade ${i + 1}: Min mark must be less than max mark.`);
      else if (min < 0 || max > 100) errors.push(`Grade ${i + 1}: Marks must be between 0 and 100.`);
    });

    if (eot[0].min !== 0) errors.push('First grade must start at 0.');
    if (eot[eot.length - 1].max !== 100) errors.push('Last grade must end at 100.');

    for (let i = 1; i < eot.length; i++) {
      if (eot[i].min !== eot[i - 1].max) {
        errors.push(`Gap or overlap between grade ${eot[i - 1].i + 1} and ${eot[i].i + 1}. Ranges must be continuous (e.g., 0–40, 40–70).`);
      }
    }
  }

  // Midterm validation
  if (useMidterm) {
    const mt = rows
      .map((r, i) => ({ i, min: Number(r.midterm_min), max: Number(r.midterm_max), remark: r.midterm_remark }))
      .filter(r => !isNaN(r.min) && !isNaN(r.max))
      .sort((a, b) => a.min - b.min);

    if (mt.length > 0) {
      mt.forEach(({ i, min, max, remark }) => {
        if (!remark.trim()) errors.push(`Grade ${i + 1}: Midterm remark is required.`);
        if (min >= max) errors.push(`Grade ${i + 1}: Midterm min must be less than max.`);
      });

      if (mt[0].min !== 0) errors.push('First midterm grade must start at 0.');
      if (mt[mt.length - 1].max !== midtermMax) errors.push(`Last midterm grade must end at ${midtermMax}.`);

      for (let i = 1; i < mt.length; i++) {
        if (mt[i].min !== mt[i - 1].max) {
          errors.push(`Midterm gap or overlap between grade ${mt[i - 1].i + 1} and ${mt[i].i + 1}.`);
        }
      }
    }
  }

  return errors;
}

// ─── Grade Row Editor ──────────────────────────────────────────────────────────
function GradeRowEditor({ row, index, useMidterm, onChange, onRemove, onMaxBlur }: {
  row: GradeRow;
  index: number;
  useMidterm: boolean;
  onChange: (row: GradeRow) => void;
  onRemove: () => void;
  onMaxBlur: (max: string) => void;
}) {
  const prevEndTermRemarkRef = React.useRef(row.end_of_term_remark);

  const set = (key: keyof GradeRow, val: any) => {
    const next = { ...row, [key]: val };
    if (key === 'name' && next.midterm_name_locked) {
      next.midterm_name = val;
    }
    onChange(next);
  };

  // Auto-copy midterm remark from end of term remark
  const handleEndTermRemarkChange = (val: string) => {
    const prevVal = row.end_of_term_remark;
    const nextRow = { ...row, end_of_term_remark: val };

    // Auto-copy if midterm remark is empty OR equals previous end term remark
    if (!row.midterm_remark || row.midterm_remark === prevVal) {
      nextRow.midterm_remark = val;
    }
    onChange(nextRow);
  };

  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
  const miniLabel = "block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1";

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-500">Grade {index + 1}</span>
        <button type="button" onClick={onRemove}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-2">
            <label className={miniLabel}>Order</label>
            <input type="number" min={1} value={row.order}
              onChange={e => set('order', Number(e.target.value))}
              className={inputCls} />
          </div>
          <div className="col-span-10">
            <label className={miniLabel}>Grade Name <span className="normal-case text-slate-300">(used for both)</span></label>
            <input type="text" placeholder="e.g. A, B, C" value={row.name}
              onChange={e => set('name', e.target.value.toUpperCase())}
              className={inputCls} />
          </div>
        </div>

        {/* End of term row */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">End of Term</span>
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3">
              <label className={miniLabel}>Min Mark</label>
              <input type="number" step="0.01" min="0" max="100" placeholder="0"
                value={row.end_of_term_min}
                onChange={e => set('end_of_term_min', e.target.value)}
                className={inputCls} />
            </div>
            <div className="col-span-3">
              <label className={miniLabel}>Max Mark</label>
              <input type="number" step="0.01" min="0" max="100" placeholder="100"
                value={row.end_of_term_max}
                onChange={e => set('end_of_term_max', e.target.value)}
                onBlur={e => onMaxBlur(e.target.value)}
                className={inputCls} />
            </div>
            <div className="col-span-6">
              <label className={miniLabel}>Remark</label>
              <input type="text" placeholder="e.g. Excellent, Very Good"
                value={row.end_of_term_remark}
                onChange={e => handleEndTermRemarkChange(e.target.value)}
                className={inputCls} />
            </div>
          </div>
        </div>

        {/* Midterm row */}
        {useMidterm && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="h-2 w-2 rounded-full bg-violet-500" />
              <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">Midterm</span>
            </div>
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3">
                <label className={miniLabel}>Min Mark</label>
                <input type="number" step="0.01" min="0" placeholder="0"
                  value={row.midterm_min}
                  onChange={e => set('midterm_min', e.target.value)}
                  className={inputCls} />
              </div>
              <div className="col-span-3">
                <label className={miniLabel}>Max Mark</label>
                <input type="number" step="0.01" min="0" placeholder="20"
                  value={row.midterm_max}
                  onChange={e => set('midterm_max', e.target.value)}
                  className={inputCls} />
              </div>
              <div className="col-span-5">
                <label className={miniLabel}>Remark</label>
                <input type="text" placeholder="e.g. Excellent"
                  value={row.midterm_remark}
                  onChange={e => set('midterm_remark', e.target.value)}
                  className={inputCls} />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-1">
                <button type="button"
                  onClick={() => set('midterm_name_locked', !row.midterm_name_locked)}
                  title={row.midterm_name_locked ? 'Midterm name mirrors grade name — click to unlock' : 'Click to sync with grade name'}
                  className={`p-1.5 rounded-lg transition-colors ${row.midterm_name_locked ? 'text-blue-600 bg-blue-50 border border-blue-200' : 'text-slate-400 bg-slate-50 border border-slate-200 hover:text-slate-600'}`}>
                  {row.midterm_name_locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {!row.midterm_name_locked && (
              <div className="mt-2">
                <label className={miniLabel}>Midterm Grade Name <span className="normal-case text-slate-300">(overriding grade name)</span></label>
                <input type="text" placeholder="e.g. A, B, C"
                  value={row.midterm_name}
                  onChange={e => set('midterm_name', e.target.value.toUpperCase())}
                  className={inputCls} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Grade Set Modal ───────────────────────────────────────────────────────────
function GradeSetModal({ editing, groups, useMidterm, midtermMax, preselectedGroupId, isSaving, onSave, onClose }: {
  editing: ResultGradeSet | null;
  groups: ResultConfigurationGroup[];
  useMidterm: boolean;
  midtermMax: number;
  preselectedGroupId: number | null;
  isSaving: boolean;
  onSave: (setData: { name: string; description: string; configuration_group: number; is_active: boolean }, rows: GradeRow[]) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [configGroup, setConfigGroup] = useState<number | ''>(
    editing?.configuration_group ?? preselectedGroupId ?? ''
  );
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [rows, setRows] = useState<GradeRow[]>(() => {
    if (editing?.grades && editing.grades.length > 0) {
      return editing.grades
        .sort((a, b) => a.order - b.order)
        .map(g => ({
          _id: uid(),
          order: g.order,
          name: g.end_of_term_name || g.midterm_name || '',
          end_of_term_min: g.end_of_term_min_mark?.toString() || '',
          end_of_term_max: g.end_of_term_max_mark?.toString() || '',
          end_of_term_remark: g.end_of_term_remark || '',
          midterm_name: g.midterm_name || g.end_of_term_name || '',
          midterm_name_locked: g.midterm_name === g.end_of_term_name || !g.midterm_name,
          midterm_min: g.midterm_min_mark?.toString() || '',
          midterm_max: g.midterm_max_mark?.toString() || '',
          midterm_remark: g.midterm_remark || '',
        }));
    }
    return [emptyRow(1)];
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false); // Only show errors after submit attempt

  const addRow = () => {
    const lastMax = rows.length > 0 ? rows[rows.length - 1].end_of_term_max : '';
    const newRow = emptyRow(rows.length + 1);
    newRow.end_of_term_min = lastMax;
    setRows(prev => [...prev, newRow]);
    // Clear validation errors when user adds a row (they might fix the issue)
    setShowValidation(false);
    setValidationErrors([]);
  };

  const updateRow = (index: number, row: GradeRow) => {
    setRows(prev => prev.map((r, i) => i === index ? row : r));
    // Clear validation errors when user edits (they might fix the issue)
    setShowValidation(false);
    setValidationErrors([]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) {
      return;
    }
    setRows(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, order: i + 1 })));
    setShowValidation(false);
    setValidationErrors([]);
  };

  const handleMaxBlur = (index: number, max: string) => {
    setRows(prev => {
      if (index + 1 >= prev.length) return prev;
      const next = [...prev];
      next[index + 1] = { ...next[index + 1], end_of_term_min: max };
      return next;
    });
    setShowValidation(false);
    setValidationErrors([]);
  };

  const clearAllErrors = () => {
    setValidationErrors([]);
    setFormError(null);
    setShowValidation(false);
  };

  const isFormValid = name.trim() && configGroup && rows.some(r => r.name.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setShowValidation(true);

    if (!configGroup) { setFormError('Please select a configuration group.'); return; }
    if (!name.trim()) { setFormError('Grade set name is required.'); return; }

    const errs = validateGrades(rows, useMidterm, midtermMax);
    if (errs.length > 0) {
      setValidationErrors(errs);
      return;
    }

    try {
      await onSave(
        { name: name.trim(), description, configuration_group: Number(configGroup), is_active: isActive },
        rows,
      );
    } catch (err) {
      setFormError(extractError(err));
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="h-4 w-4" />
            {editing ? 'Edit Grade Set' : 'New Grade Set'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Error (API/validation errors) */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Validation Errors - only shown after submit, with single clear button */}
        {showValidation && validationErrors.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Fix these issues before saving:
              </p>
              <button
                onClick={clearAllErrors}
                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors"
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            </div>
            <ul className="space-y-0.5 max-h-32 overflow-y-auto">
              {validationErrors.map((e, i) => (
                <li key={i} className="text-xs text-amber-700">• {e}</li>
              ))}
            </ul>
          </div>
        )}

        <form id="grade-set-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Grade Set Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Standard Grading 2024" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Configuration Group <span className="text-red-400 normal-case">*</span></label>
                <select required value={configGroup}
                  onChange={e => setConfigGroup(e.target.value ? Number(e.target.value) : '')}
                  disabled={!!preselectedGroupId}
                  className={inputCls + (preselectedGroupId ? ' opacity-70 cursor-not-allowed' : '')}>
                  <option value="">Select a group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                {preselectedGroupId && <p className="text-xs text-blue-500 mt-1">Pre-selected from groups page</p>}
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center justify-between w-full p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Active</p>
                    <p className="text-xs text-slate-400">Set as active grade set for this group</p>
                  </div>
                  <button type="button" role="switch" aria-checked={isActive}
                    onClick={() => setIsActive(v => !v)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${isActive ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description..." className={inputCls + ' resize-none'} />
              </div>
            </div>

            {rows.length > 0 && <CoverageBar rows={rows} />}

            {useMidterm && (
              <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-700">
                <Award className="h-4 w-4 flex-shrink-0" />
                Midterm is enabled — midterm ranges should cover 0–{midtermMax}. Grade names are synced by default; click the lock icon to override per row.
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade Bands</p>
                <span className="text-xs text-slate-400">{rows.length} grade{rows.length !== 1 ? 's' : ''}</span>
              </div>

              {rows.map((row, i) => (
                <GradeRowEditor
                  key={row._id}
                  row={row}
                  index={i}
                  useMidterm={useMidterm}
                  onChange={updated => updateRow(i, updated)}
                  onRemove={() => removeRow(i)}
                  onMaxBlur={max => handleMaxBlur(i, max)}
                />
              ))}

              <button type="button" onClick={addRow}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium px-1 transition-colors">
                <Plus className="h-4 w-4" /> Add Grade Band
              </button>
            </div>

          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="grade-set-form" disabled={isSaving || !isFormValid}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Grade Set' : 'Create Grade Set'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}






























// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ResultGradeSetsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const preselectedGroupId = searchParams.get('group') ? Number(searchParams.get('group')) : null;

  const [gradeSets, setGradeSets] = useState<ResultGradeSet[]>([]);
  const [groups, setGroups] = useState<ResultConfigurationGroup[]>([]);
  const [settings, setSettings] = useState<ResultSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSet, setEditingSet] = useState<ResultGradeSet | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingSet, setDeletingSet] = useState<ResultGradeSet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<number | ''>(preselectedGroupId || '');
  const [filterActive, setFilterActive] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('result.manage_result_configuration');
  const canEdit   = user?.is_superuser || hasPermission('result.manage_result_configuration');
  const canDelete = user?.is_superuser || hasPermission('result.manage_result_configuration');

  const useMidterm = settings?.use_midterm ?? false;
  const midtermMax = Number(settings?.midterm_max_score ?? 20);

  const autoOpenedRef = React.useRef(false);

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Clean URL parameter
  const cleanUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.has('group')) {
      params.delete('group');
      const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  // Close modal and clean URL
  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setEditingSet(null);
    cleanUrlParams();
  }, [cleanUrlParams]);

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [setsData, groupsData, settingsData] = await Promise.all([
        resultGradeSetsAPI.list(filterGroup ? { configuration_group: Number(filterGroup) } : undefined),
        resultGroupsAPI.list(),
        resultSettingsAPI.get(),
      ]);
      setGradeSets(Array.isArray(setsData) ? setsData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setSettings(settingsData);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [filterGroup]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-open modal when group param is present

  useEffect(() => {
      if (preselectedGroupId && !loading && groups.length > 0 && !showModal && !autoOpenedRef.current) {
        autoOpenedRef.current = true;
        setEditingSet(null);
        setShowModal(true);
      }
  }, [preselectedGroupId, loading, groups.length, showModal]);

  const handleSave = async (
    setData: { name: string; description: string; configuration_group: number; is_active: boolean },
    rows: GradeRow[],
  ) => {
    setIsSaving(true);
    let createdSetId: number | null = null;
    try {
      let gradeSet: ResultGradeSet;

      if (editingSet) {
        gradeSet = await resultGradeSetsAPI.update(editingSet.id, setData);
        if (editingSet.grades) {
          await Promise.all(editingSet.grades.map(g => resultGradesAPI.delete(g.id)));
        }
      } else {
        gradeSet = await resultGradeSetsAPI.create(setData);
        createdSetId = gradeSet.id;
      }

      await Promise.all(rows.map(row => {
        const gradeType = useMidterm ? 'both' : 'end_of_term';
        const payload: any = {
          grade_set: gradeSet.id,
          order: row.order,
          grade_type: gradeType,
          end_of_term_name: row.name,
          end_of_term_min_mark: row.end_of_term_min,
          end_of_term_max_mark: row.end_of_term_max,
          end_of_term_remark: row.end_of_term_remark,
        };
        if (useMidterm) {
          payload.midterm_name = row.midterm_name_locked ? row.name : row.midterm_name;
          payload.midterm_min_mark = row.midterm_min;
          payload.midterm_max_mark = row.midterm_max;
          payload.midterm_remark = row.midterm_remark;
        }
        return resultGradesAPI.create(payload);
      }));

      showToast('success', `"${setData.name}" ${editingSet ? 'updated' : 'created'} successfully`);
      handleModalClose(); // Close modal and clean URL
      fetchData();
    } catch (err) {
      if (createdSetId) {
        try { await resultGradeSetsAPI.delete(createdSetId); } catch {}
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async (gradeSet: ResultGradeSet) => {
    try {
      await resultGradeSetsAPI.activate(gradeSet.id);
      showToast('success', `"${gradeSet.name}" is now the active grade set`);
      fetchData();
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingSet) return;
    setIsDeleting(true);
    try {
      await resultGradeSetsAPI.delete(deletingSet.id);
      setGradeSets(prev => prev.filter(s => s.id !== deletingSet.id));
      showToast('success', `"${deletingSet.name}" deleted`);
      setDeletingSet(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingSet(null);
    } finally { setIsDeleting(false); }
  };

  const getGroupName = (id: number) => groups.find(g => g.id === id)?.name ?? `Group ${id}`;

  const filtered = gradeSets.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGroup = !filterGroup || s.configuration_group === Number(filterGroup);
    const matchActive = !filterActive || s.is_active;
    return matchSearch && matchGroup && matchActive;
  });

  const totalActive = gradeSets.filter(s => s.is_active).length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal open={!!deletingSet} gradeSet={deletingSet} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingSet(null)} />

      {showModal && (
        <GradeSetModal
          editing={editingSet}
          groups={groups}
          useMidterm={useMidterm}
          midtermMax={midtermMax}
          preselectedGroupId={preselectedGroupId}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={handleModalClose}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Award className="h-5 w-5 text-white" />
            </div>
            Grade Sets
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            Define grade boundaries for each configuration group
            {preselectedGroupId && groups.length > 0 && (
              <span className="ml-2 text-blue-500 font-medium">— {getGroupName(preselectedGroupId)}</span>
            )}
          </p>
        </div>
        {canCreate && (
          <button onClick={() => {
            setEditingSet(null);
            setShowModal(true);
            cleanUrlParams();
          }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> New Grade Set
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sets', value: gradeSets.length, icon: Award, color: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: totalActive, icon: Shield, color: 'from-emerald-500 to-teal-600' },
          { label: 'Groups', value: groups.length, icon: Layers, color: 'from-violet-500 to-purple-600' },
          { label: 'Midterm', value: useMidterm ? `Max ${midtermMax}` : 'Disabled', icon: GraduationCap, color: useMidterm ? 'from-orange-400 to-amber-500' : 'from-slate-400 to-slate-500' },
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

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search grade sets..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value ? Number(e.target.value) : '')}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={filterActive}
                onClick={() => setFilterActive(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${filterActive ? 'bg-blue-600' : 'bg-slate-200'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${filterActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-slate-600">Active only</span>
            </label>
            <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading grade sets...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchData} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Award className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterGroup ? 'No grade sets match your search' : 'No grade sets yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterGroup ? 'Try different keywords or filters.' : 'Create your first grade set to define grading boundaries.'}
            </p>
            {!searchTerm && !filterGroup && canCreate && (
              <button onClick={() => {
                setEditingSet(null);
                setShowModal(true);
                cleanUrlParams();
              }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> New Grade Set
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_160px_100px_90px_160px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade Set</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grades</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(gradeSet => (
                <div key={gradeSet.id}>
                  <div className="flex flex-col sm:grid sm:grid-cols-[1fr_160px_100px_90px_160px] items-start sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${gradeSet.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Award className={`h-4 w-4 ${gradeSet.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{gradeSet.name}</p>
                        {gradeSet.description && <p className="text-xs text-slate-400 truncate">{gradeSet.description}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:block min-w-0">
                      <span className="sm:hidden text-xs text-slate-400">Group:</span>
                      <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[150px] block">
                        {getGroupName(gradeSet.configuration_group)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:block">
                      <span className="sm:hidden text-xs text-slate-400">Grades:</span>
                      <span className="text-sm font-medium text-slate-600">
                        {gradeSet.grades_count ?? gradeSet.grades?.length ?? 0} band{(gradeSet.grades_count ?? gradeSet.grades?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div>
                      {gradeSet.is_active ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {!gradeSet.is_active && canEdit && (
                        <button onClick={() => handleActivate(gradeSet)} title="Set as active"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => { setEditingSet(gradeSet); setShowModal(true); }} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingSet(gradeSet)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === gradeSet.id ? null : gradeSet.id)}
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                        {expandedId === gradeSet.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {expandedId === gradeSet.id && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="ml-0 sm:ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        {gradeSet.grades && gradeSet.grades.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Grade Bands</p>
                            <div className="grid grid-cols-1 gap-2">
                              {[...gradeSet.grades].sort((a, b) => (Number(a.end_of_term_min_mark) - Number(b.end_of_term_min_mark))).map(grade => (
                                <div key={grade.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                  <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                    <span className="text-sm font-bold text-slate-800 w-8">{capitalizeName(grade.end_of_term_name || '')}</span>
                                    <span className="text-xs text-slate-500 font-mono">{grade.end_of_term_min_mark} – {grade.end_of_term_max_mark}</span>
                                    <ArrowRight className="h-3 w-3 text-slate-300" />
                                    <span className="text-xs text-slate-600">{grade.end_of_term_remark}</span>
                                    <span className="ml-auto text-[10px] text-blue-500 font-semibold uppercase">End of Term</span>
                                  </div>
                                  {(grade.grade_type === 'both' || grade.grade_type === 'midterm') && (
                                    <div className="flex items-center gap-3 px-3 py-2 bg-violet-50/50 border-t border-violet-100 flex-wrap">
                                      <div className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                                      <span className="text-sm font-bold text-slate-800 w-8">{capitalizeName(grade.midterm_name || '')}</span>
                                      <span className="text-xs text-slate-500 font-mono">{grade.midterm_min_mark} – {grade.midterm_max_mark}</span>
                                      <ArrowRight className="h-3 w-3 text-slate-300" />
                                      <span className="text-xs text-slate-600">{grade.midterm_remark}</span>
                                      <span className="ml-auto text-[10px] text-violet-500 font-semibold uppercase">Midterm</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            {gradeSet.coverage_valid && (
                              <div className={`flex items-center gap-2 mt-3 p-2 rounded-lg text-xs font-medium ${gradeSet.coverage_valid.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {gradeSet.coverage_valid.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                {gradeSet.coverage_valid.message}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No grades defined yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {gradeSets.length} grade set{gradeSets.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
