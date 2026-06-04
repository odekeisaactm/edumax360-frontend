'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resultFieldSetsAPI, resultFieldsAPI, resultGroupsAPI, resultSettingsAPI } from '@/lib/api';
import { ResultFieldSet, ResultField, ResultConfigurationGroup, ResultSettings } from '@/lib/types';
import {
  Columns, Plus, Edit3, Trash2, Search, X, Check, AlertCircle,
  AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Layers, Shield, ArrowRight, CheckCircle2, Minus, GraduationCap,
  GripVertical, Hash, FileText, Calculator, AlertOctagon,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FieldFormRow {
  _id: string;
  name: string;
  max_mark: string;
  field_type: 'ca' | 'exam';
  order: number;
  is_midterm: boolean;
}

let _uid = 0;
const uid = () => String(++_uid);
let _toastId = 0;

interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

const emptyRow = (order: number): FieldFormRow => ({
  _id: uid(),
  name: '',
  max_mark: '',
  field_type: 'ca',
  order,
  is_midterm: false,
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

function ConfirmModal({ open, fieldSet, isDeleting, onConfirm, onCancel }: {
  open: boolean; fieldSet: ResultFieldSet | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !fieldSet) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Field Set</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Delete <span className="font-semibold text-slate-700">"{fieldSet.name}"</span>? All fields within it will also be deleted. This cannot be undone.
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

// ─── Total Indicator ──────────────────────────────────────────────────────────
function TotalIndicator({ rows, useMidterm, midtermMax }: {
  rows: FieldFormRow[];
  useMidterm: boolean;
  midtermMax: number;
}) {
  let total = 0;
  let midtermTotal = 0;

  rows.forEach(row => {
    const val = parseFloat(row.max_mark);
    if (!isNaN(val)) {
      total += val;
      if (row.is_midterm) midtermTotal += val;
    }
  });

  // Round to 2 decimal places
  const roundedTotal = Math.round(total * 100) / 100;
  const roundedMidtermTotal = Math.round(midtermTotal * 100) / 100;

  const isValid = Math.abs(roundedTotal - 100) < 0.01;
  const isMidtermValid = !useMidterm || Math.abs(roundedMidtermTotal - midtermMax) < 0.01;

  let color = 'text-slate-600';
  if (roundedTotal > 100) color = 'text-red-600';
  else if (roundedTotal < 100 && roundedTotal > 0) color = 'text-amber-600';
  else if (isValid) color = 'text-emerald-600';

  return (
    <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Marks</span>
        </div>
        <div className={`text-lg font-bold ${color}`}>
          {roundedTotal.toFixed(2)} / 100
        </div>
      </div>
      {!isValid && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Fields must sum to exactly 100. Current total: {roundedTotal.toFixed(2)}
        </p>
      )}
      {useMidterm && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Midterm Total</span>
          </div>
          <div className={`text-sm font-bold ${isMidtermValid ? 'text-emerald-600' : 'text-amber-600'}`}>
            {roundedMidtermTotal.toFixed(2)} / {midtermMax}
          </div>
        </div>
      )}
      {useMidterm && !isMidtermValid && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Midterm fields must sum to exactly {midtermMax}. Current total: {roundedMidtermTotal.toFixed(2)}
        </p>
      )}
    </div>
  );
}

// ─── Validate Fields ───────────────────────────────────────────────────────────
function validateFields(rows: FieldFormRow[], useMidterm: boolean, midtermMax: number): string[] {
  const errors: string[] = [];
  if (rows.length === 0) { errors.push('Add at least one field.'); return errors; }

  const names = new Set();

  // Calculate totals with proper decimal handling
  let total = 0;
  let midtermTotal = 0;

  rows.forEach((row, i) => {
    if (!row.name.trim()) errors.push(`Field ${i + 1}: Name is required.`);
    if (names.has(row.name.trim().toLowerCase())) errors.push(`Field ${i + 1}: Name "${row.name}" must be unique.`);
    names.add(row.name.trim().toLowerCase());

    const maxMark = parseFloat(row.max_mark);
    if (isNaN(maxMark)) errors.push(`Field ${i + 1}: Max mark is required.`);
    else if (maxMark <= 0) errors.push(`Field ${i + 1}: Max mark must be greater than 0.`);
    else if (maxMark > 100) errors.push(`Field ${i + 1}: Max mark cannot exceed 100.`);
    else {
      total += maxMark;
      if (row.is_midterm) midtermTotal += maxMark;
    }
  });

  // Round to 2 decimal places for comparison
  const roundedTotal = Math.round(total * 100) / 100;
  const roundedMidtermTotal = Math.round(midtermTotal * 100) / 100;

  if (Math.abs(roundedTotal - 100) > 0.01) {
    errors.push(`Total marks must equal 100. Current total: ${roundedTotal.toFixed(2)}`);
  }
  if (useMidterm && Math.abs(roundedMidtermTotal - midtermMax) > 0.01) {
    errors.push(`Midterm fields must sum to exactly ${midtermMax}. Current total: ${roundedMidtermTotal.toFixed(2)}`);
  }

  return errors;
}

// ─── Field Row Editor ──────────────────────────────────────────────────────────
function FieldRowEditor({ row, index, useMidterm, onChange, onRemove, onMoveUp, onMoveDown }: {
  row: FieldFormRow;
  index: number;
  useMidterm: boolean;
  onChange: (row: FieldFormRow) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const set = (key: keyof FieldFormRow, val: any) => {
    onChange({ ...row, [key]: val });
  };

  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
  const miniLabel = "block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1";

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={false}
            className="p-1 rounded text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-bold text-slate-500 ml-1">Field {index + 1}</span>
        </div>
        <button type="button" onClick={onRemove}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-5">
            <label className={miniLabel}>Field Name</label>
            <input type="text" placeholder="e.g. First CA, Exam, Project"
              value={row.name}
              onChange={e => set('name', e.target.value)}
              className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className={miniLabel}>Max Mark</label>
            <input type="number" step="0.01" min="0" max="100" placeholder="0"
              value={row.max_mark}
              onChange={e => set('max_mark', e.target.value)}
              className={inputCls} />
          </div>
          <div className="col-span-3">
            <label className={miniLabel}>Type</label>
            <select value={row.field_type} onChange={e => set('field_type', e.target.value as 'ca' | 'exam')}
              className={inputCls}>
              <option value="ca">Continuous Assessment (CA)</option>
              <option value="exam">Exam</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className={miniLabel}>Order</label>
            <input type="number" min="1" value={row.order}
              onChange={e => set('order', Number(e.target.value))}
              className={inputCls} />
          </div>
        </div>

        {useMidterm && (
          <div className="mt-3 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={row.is_midterm}
                onChange={e => set('is_midterm', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-xs font-medium text-slate-600">
                Count toward midterm total
              </span>
              <span className="text-[10px] text-slate-400 ml-2">
                (This field contributes to both midterm and end-of-term scores)
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Field Set Modal ───────────────────────────────────────────────────────────
function FieldSetModal({ editing, groups, useMidterm, midtermMax, preselectedGroupId, isSaving, onSave, onClose, existingResultsWarning }: {
  editing: ResultFieldSet | null;
  groups: ResultConfigurationGroup[];
  useMidterm: boolean;
  midtermMax: number;
  preselectedGroupId: number | null;
  isSaving: boolean;
  onSave: (setData: { name: string; description: string; configuration_group: number; is_active: boolean }, rows: FieldFormRow[]) => Promise<void>;
  onClose: () => void;
  existingResultsWarning: string | null;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [configGroup, setConfigGroup] = useState<number | ''>(
    editing?.configuration_group ?? preselectedGroupId ?? ''
  );
  const [isActive, setIsActive] = useState(editing?.is_active ?? true);
  const [rows, setRows] = useState<FieldFormRow[]>(() => {
    if (editing?.fields_list && editing.fields_list.length > 0) {
      return editing.fields_list
        .sort((a, b) => a.order - b.order)
        .map(f => ({
          _id: uid(),
          name: f.name,
          max_mark: f.max_mark,
          field_type: f.field_type,
          order: f.order,
          is_midterm: f.is_midterm,
        }));
    }
    return [emptyRow(1)];
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  const addRow = () => {
    setRows(prev => [...prev, emptyRow(prev.length + 1)]);
    setShowValidation(false);
    setValidationErrors([]);
  };

  const updateRow = (index: number, row: FieldFormRow) => {
    setRows(prev => prev.map((r, i) => i === index ? row : r));
    setShowValidation(false);
    setValidationErrors([]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, order: i + 1 })));
    setShowValidation(false);
    setValidationErrors([]);
  };

  const moveRow = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rows.length - 1) return;

    const newRows = [...rows];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newRows[index], newRows[swapIndex]] = [newRows[swapIndex], newRows[index]];

    newRows.forEach((row, i) => { row.order = i + 1; });
    setRows(newRows);
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
    if (!name.trim()) { setFormError('Field set name is required.'); return; }

    const errs = validateFields(rows, useMidterm, midtermMax);
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
            <Columns className="h-4 w-4" />
            {editing ? 'Edit Field Set' : 'New Field Set'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {existingResultsWarning && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
            <div className="flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold mb-1">⚠️ Warning: Existing results detected</p>
                <p>{existingResultsWarning}</p>
              </div>
            </div>
          </div>
        )}

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="flex-1">{formError}</span>
            <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showValidation && validationErrors.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Fix these issues before saving:
              </p>
              <button onClick={clearAllErrors}
                className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors">
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

        <form id="field-set-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Field Set Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. 3-Field CA+Exam System" className={inputCls} />
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
                    <p className="text-xs text-slate-400">Set as active field set for this group</p>
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

            <TotalIndicator rows={rows} useMidterm={useMidterm} midtermMax={midtermMax} />

            {useMidterm && (
              <div className="flex items-center gap-2 p-3 bg-violet-50 border border-violet-100 rounded-xl text-xs text-violet-700">
                <GraduationCap className="h-4 w-4 flex-shrink-0" />
                Midterm is enabled — fields marked as "Count toward midterm total" will contribute to both midterm and end-of-term scores.
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assessment Fields</p>
                <span className="text-xs text-slate-400">{rows.length} field{rows.length !== 1 ? 's' : ''}</span>
              </div>

              {rows.map((row, i) => (
                <FieldRowEditor
                  key={row._id}
                  row={row}
                  index={i}
                  useMidterm={useMidterm}
                  onChange={updated => updateRow(i, updated)}
                  onRemove={() => removeRow(i)}
                  onMoveUp={() => moveRow(i, 'up')}
                  onMoveDown={() => moveRow(i, 'down')}
                />
              ))}

              <button type="button" onClick={addRow}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium px-1 transition-colors">
                <Plus className="h-4 w-4" /> Add Field
              </button>
            </div>

          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="field-set-form" disabled={isSaving || !isFormValid}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Field Set' : 'Create Field Set'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ResultFieldSetsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const preselectedGroupId = searchParams.get('group') ? Number(searchParams.get('group')) : null;

  const [fieldSets, setFieldSets] = useState<ResultFieldSet[]>([]);
  const [groups, setGroups] = useState<ResultConfigurationGroup[]>([]);
  const [settings, setSettings] = useState<ResultSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [existingResultsWarning, setExistingResultsWarning] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSet, setEditingSet] = useState<ResultFieldSet | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingSet, setDeletingSet] = useState<ResultFieldSet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<number | ''>(preselectedGroupId || '');
  const [filterActive, setFilterActive] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('result.add_resultfieldsetmodel');
  const canEdit   = user?.is_superuser || hasPermission('result.change_resultfieldsetmodel');
  const canDelete = user?.is_superuser || hasPermission('result.delete_resultfieldsetmodel');

  const useMidterm = settings?.use_midterm ?? false;
  const midtermMax = Number(settings?.midterm_max_score ?? 20);

  const autoOpenedRef = React.useRef(false);

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const cleanUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.has('group')) {
      params.delete('group');
      const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
      router.replace(newUrl);
    }
  }, [searchParams, router]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    setEditingSet(null);
    setExistingResultsWarning(null);
    cleanUrlParams();
  }, [cleanUrlParams]);

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [setsData, groupsData, settingsData] = await Promise.all([
        resultFieldSetsAPI.list(filterGroup ? { configuration_group: Number(filterGroup) } : undefined),
        resultGroupsAPI.list(),
        resultSettingsAPI.get(),
      ]);
      setFieldSets(Array.isArray(setsData) ? setsData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setSettings(settingsData);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, [filterGroup]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Check for existing results when editing a field set
  const checkExistingResults = useCallback(async (groupId: number) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return null;

      // Get all classes in this group and check if any have results
      // This would require an API call to check readiness
      // For now, we'll show a generic warning if any class in group has results
      // You may need to implement a check endpoint or use the readiness API

      return null; // Placeholder - implement actual check
    } catch {
      return null;
    }
  }, [groups]);


    useEffect(() => {
      if (preselectedGroupId && !loading && groups.length > 0 && !showModal && !autoOpenedRef.current) {
        autoOpenedRef.current = true;
        setEditingSet(null);
        setShowModal(true);
      }
    }, [preselectedGroupId, loading, groups.length, showModal]);

  const handleSave = async (
      setData: { name: string; description: string; configuration_group: number; is_active: boolean },
      rows: FieldFormRow[],
    ) => {
      setIsSaving(true);
      let createdSetId: number | null = null;
      try {
        let fieldSet: ResultFieldSet;

        if (editingSet) {
          fieldSet = await resultFieldSetsAPI.update(editingSet.id, setData);
          if (editingSet.fields_list) {
            await Promise.all(editingSet.fields_list.map(f => resultFieldsAPI.delete(f.id)));
          }
        } else {
          fieldSet = await resultFieldSetsAPI.create(setData);
          createdSetId = fieldSet.id;
        }

        await Promise.all(rows.map(row => {
          const payload: any = {
            field_set: fieldSet.id,
            name: row.name,
            max_mark: row.max_mark,
            order: row.order,
            field_type: row.field_type,
            is_midterm: row.is_midterm,
          };
          return resultFieldsAPI.create(payload);
        }));

        showToast('success', `"${setData.name}" ${editingSet ? 'updated' : 'created'} successfully`);
        handleModalClose();
        fetchData();
      } catch (err) {
        if (createdSetId) {
          try { await resultFieldSetsAPI.delete(createdSetId); } catch {}
        }
        throw err;
      } finally {
        setIsSaving(false);
      }
    };

  const handleActivate = async (fieldSet: ResultFieldSet) => {
    try {
      await resultFieldSetsAPI.activate(fieldSet.id);
      showToast('success', `"${fieldSet.name}" is now the active field set`);
      fetchData();
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const handleDelete = async () => {
    if (!deletingSet) return;
    setIsDeleting(true);
    try {
      await resultFieldSetsAPI.delete(deletingSet.id);
      setFieldSets(prev => prev.filter(s => s.id !== deletingSet.id));
      showToast('success', `"${deletingSet.name}" deleted`);
      setDeletingSet(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingSet(null);
    } finally { setIsDeleting(false); }
  };

  const getGroupName = (id: number) => groups.find(g => g.id === id)?.name ?? `Group ${id}`;

  const filtered = fieldSets.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGroup = !filterGroup || s.configuration_group === Number(filterGroup);
    const matchActive = !filterActive || s.is_active;
    return matchSearch && matchGroup && matchActive;
  });

  const totalActive = fieldSets.filter(s => s.is_active).length;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal open={!!deletingSet} fieldSet={deletingSet} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingSet(null)} />

      {showModal && (
        <FieldSetModal
          editing={editingSet}
          groups={groups}
          useMidterm={useMidterm}
          midtermMax={midtermMax}
          preselectedGroupId={preselectedGroupId}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={handleModalClose}
          existingResultsWarning={existingResultsWarning}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Columns className="h-5 w-5 text-white" />
            </div>
            Field Sets
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">
            Define assessment components for each configuration group
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
            <Plus className="h-4 w-4" /> New Field Set
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sets', value: fieldSets.length, icon: Columns, color: 'from-blue-500 to-blue-600' },
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
            <input type="text" placeholder="Search field sets..." value={searchTerm}
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
            <p className="mt-2 text-sm text-slate-400">Loading field sets...</p>
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
              <Columns className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterGroup ? 'No field sets match your search' : 'No field sets yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterGroup ? 'Try different keywords or filters.' : 'Create your first field set to define assessment components.'}
            </p>
            {!searchTerm && !filterGroup && canCreate && (
              <button onClick={() => {
                setEditingSet(null);
                setShowModal(true);
                cleanUrlParams();
              }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> New Field Set
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_160px_100px_90px_160px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Field Set</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(fieldSet => (
                <div key={fieldSet.id}>
                  <div className="flex flex-col sm:grid sm:grid-cols-[1fr_160px_100px_90px_160px] items-start sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${fieldSet.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                        <Columns className={`h-4 w-4 ${fieldSet.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{fieldSet.name}</p>
                        {fieldSet.description && <p className="text-xs text-slate-400 truncate">{fieldSet.description}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:block min-w-0">
                      <span className="sm:hidden text-xs text-slate-400">Group:</span>
                      <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[150px] block">
                        {getGroupName(fieldSet.configuration_group)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:block">
                      <span className="sm:hidden text-xs text-slate-400">Fields:</span>
                      <span className="text-sm font-medium text-slate-600">
                        {fieldSet.fields_count ?? fieldSet.fields_list?.length ?? 0} field{(fieldSet.fields_count ?? fieldSet.fields_list?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div>
                      {fieldSet.is_active ? (
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
                      {!fieldSet.is_active && canEdit && (
                        <button onClick={() => handleActivate(fieldSet)} title="Set as active"
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => {
                          setEditingSet(fieldSet);
                          setShowModal(true);
                          // Check for existing results
                          checkExistingResults(fieldSet.configuration_group).then(warning => {
                            setExistingResultsWarning(warning);
                          });
                        }} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingSet(fieldSet)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === fieldSet.id ? null : fieldSet.id)}
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                        {expandedId === fieldSet.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {expandedId === fieldSet.id && (
                    <div className="px-5 pb-4 pt-0">
                      <div className="ml-0 sm:ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        {fieldSet.fields_list && fieldSet.fields_list.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assessment Fields</p>
                              {fieldSet.total_valid && (
                                <div className={`flex items-center gap-1 text-xs font-medium ${fieldSet.total_valid.valid ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {fieldSet.total_valid.valid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                  Total: {parseFloat(fieldSet.total_valid.total).toFixed(1)}/100
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {[...fieldSet.fields_list].sort((a, b) => a.order - b.order).map(field => (
                                <div key={field.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                  <div className="flex items-center gap-3 px-3 py-2 flex-wrap">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                    <span className="text-sm font-bold text-slate-800">{field.name}</span>
                                    <span className="text-xs text-slate-500 font-mono">{field.max_mark} marks</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${field.field_type === 'ca' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-700'}`}>
                                      {field.field_type === 'ca' ? 'CA' : 'Exam'}
                                    </span>
                                    {field.is_midterm && (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                        Midterm
                                      </span>
                                    )}
                                    <span className="ml-auto text-[10px] text-slate-400 font-mono">Order: {field.order}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No fields defined yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {fieldSets.length} field set{fieldSets.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
