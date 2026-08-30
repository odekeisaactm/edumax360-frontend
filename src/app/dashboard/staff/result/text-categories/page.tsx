'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { textCategoriesAPI, resultSettingsAPI, academicCalendarAPI, staffAPI, academicAPI } from '@/lib/api';
import { TextResultCategory, ResultSettings, Staff, AcademicPeriodType, AcademicSessionPeriod, ClassConfiguration } from '@/lib/types';
import {
  FileText, Plus, Edit3, Trash2, Search, X, Check, AlertCircle,
  AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Layers, Shield, Building2, Users, Copy, Globe, Calendar,
  UserCheck, GraduationCap, Minus, CheckSquare, Square,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SchoolSection {
  id: number;
  name: string;
  code: string;
}

interface FieldFormData {
  _id: string;
  name: string;
  order: number;
  student_kind: 'normal' | 'special' | 'combined';
  student_class: number[];
}

interface CategoryFormData {
  name: string;
  description: string;
  school_section: number | null;
  order: number;
  student_kind: 'normal' | 'special' | 'combined';
  student_class: number[];
}

interface PreviewFieldRow {
  id: number;
  name: string;
  order: number;
}

interface PreviewCategoryGroup {
  categoryId: number;
  categoryName: string;
  fields: PreviewFieldRow[];
}

let _uid = 0;
const uid = () => String(++_uid);
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

function ConfirmModal({ open, title, name, isDeleting, onConfirm, onCancel }: {
  open: boolean; title: string; name: string; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Delete <span className="font-semibold text-slate-700">"{name}"</span>? This cannot be undone.
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

// ─── Filter Classes Helper ─────────────────────────────────────────────────────
function filterClassesByStudentKind(
  classes: ClassConfiguration[],
  studentKind: 'normal' | 'special' | 'combined'
): ClassConfiguration[] {
  return classes.filter(cls => {
    if (studentKind === 'normal') {
      return cls.result_type === 'text' || cls.result_type === 'combined';
    }
    if (studentKind === 'special') {
      return cls.can_have_special_student === true;
    }
    if (studentKind === 'combined') {
      return cls.result_type === 'text' || cls.result_type === 'combined' || cls.can_have_special_student === true;
    }
    return true;
  });
}

// ─── Class Config Selector ─────────────────────────────────────────────────────
function CategoryClassSelector({
  allClassConfigs,
  selectedConfigIds,
  onChange,
}: {
  allClassConfigs: ClassConfiguration[];
  selectedConfigIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, { classId: number; className: string; configs: ClassConfiguration[] }> = {};
    allClassConfigs.forEach(cfg => {
      const className = cfg.class_name || `Class ${cfg.student_class}`;
      if (!map[className]) {
        map[className] = {
          classId: cfg.student_class as number,
          className,
          configs: [],
        };
      }
      map[className].configs.push(cfg);
    });
    return Object.values(map);
  }, [allClassConfigs]);

  const allConfigIds = allClassConfigs.map(c => c.id);
  const allSelected = allConfigIds.every(id => selectedConfigIds.includes(id));
  const someSelected = selectedConfigIds.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange(allConfigIds);
  };

  const toggleClass = (classConfigs: ClassConfiguration[]) => {
    const configIds = classConfigs.map(c => c.id);
    const allChecked = configIds.every(id => selectedConfigIds.includes(id));
    if (allChecked) {
      onChange(selectedConfigIds.filter(id => !configIds.includes(id)));
    } else {
      const next = new Set([...selectedConfigIds, ...configIds]);
      onChange(Array.from(next));
    }
  };

  const toggleConfig = (configId: number) => {
    if (selectedConfigIds.includes(configId)) {
      onChange(selectedConfigIds.filter(id => id !== configId));
    } else {
      onChange([...selectedConfigIds, configId]);
    }
  };

  if (allClassConfigs.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        No class configurations found. Please create class configurations first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
        <button type="button" onClick={toggleAll}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
            allSelected ? 'border-blue-500 bg-blue-500' : someSelected ? 'border-blue-500 bg-blue-100' : 'border-slate-300'
          }`}>
            {allSelected && <Check className="h-2.5 w-2.5 text-white" />}
            {someSelected && <Minus className="h-2.5 w-2.5 text-blue-600" />}
          </div>
          {allSelected ? 'Uncheck All Classes' : 'Check All Classes'}
        </button>
      </div>

      {selectedConfigIds.length > 0 && (
        <p className="text-xs text-blue-600 font-medium px-1">
          {selectedConfigIds.length} configuration{selectedConfigIds.length !== 1 ? 's' : ''} selected
        </p>
      )}

      <div className="space-y-2">
        {grouped.map(group => {
          const configs = group.configs;
          const configIds = configs.map(c => c.id);
          const allChecked = configIds.every(id => selectedConfigIds.includes(id));
          const someChecked = configIds.some(id => selectedConfigIds.includes(id));

          return (
            <div key={group.classId} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleClass(configs)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  allChecked ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  allChecked ? 'border-blue-500 bg-blue-500'
                  : someChecked ? 'border-blue-400 bg-blue-100'
                  : 'border-slate-300 bg-white'
                }`}>
                  {allChecked && <Check className="h-2.5 w-2.5 text-white" />}
                  {someChecked && !allChecked && <Minus className="h-2.5 w-2.5 text-blue-600" />}
                </div>
                <GraduationCap className={`h-4 w-4 flex-shrink-0 ${allChecked ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className={`text-sm font-semibold flex-1 ${allChecked ? 'text-blue-800' : 'text-slate-700'}`}>
                  {group.className}
                </span>
                <span className="text-xs text-slate-400">{configs.length} config{configs.length !== 1 ? 's' : ''}</span>
              </button>

              {someChecked && (
                <div className="px-4 py-3 bg-blue-50/60 border-t border-blue-100 flex flex-wrap gap-2">
                  {configs.map(cfg => {
                    const checked = selectedConfigIds.includes(cfg.id);
                    const label = cfg.class_section_name || group.className;
                    return (
                      <button
                        key={cfg.id}
                        type="button"
                        onClick={() => toggleConfig(cfg.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          checked
                            ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}>
                        {checked ? <Check className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Category Modal ───────────────────────────────────────────────────────────
function CategoryModal({ editing, schoolSections, allClassConfigs, isSaving, onSave, onClose }: {
  editing: TextResultCategory | null;
  schoolSections: SchoolSection[];
  allClassConfigs: ClassConfiguration[];
  isSaving: boolean;
  onSave: (data: CategoryFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CategoryFormData>({
    name: editing?.name || '',
    description: editing?.description || '',
    school_section: editing?.school_section ?? null,
    order: editing?.order ?? 1,
    student_kind: editing?.student_kind || 'combined',
    student_class: editing?.student_class || [],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const filteredClasses = useMemo(() => {
    return filterClassesByStudentKind(allClassConfigs, form.student_kind);
  }, [allClassConfigs, form.student_kind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Category name is required.');
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {editing ? 'Edit Category' : 'New Category'}
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

        <form id="category-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            <div>
              <label className={labelCls}>Category Name <span className="text-red-400 normal-case">*</span></label>
              <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Literacy, Numeracy, Creative Arts" className={inputCls} />
            </div>

            <div>
              <label className={labelCls}>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description..." className={inputCls + ' resize-none'} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>School Section</label>
                <select value={form.school_section ?? ''} onChange={e => setForm({ ...form, school_section: e.target.value ? Number(e.target.value) : null })}
                  className={inputCls}>
                  <option value="">All Sections (Global)</option>
                  {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Display Order</label>
                <input type="number" min="1" value={form.order} onChange={e => setForm({ ...form, order: Number(e.target.value) })}
                  className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Student Kind <span className="text-red-400 normal-case">*</span></label>
              <select
                value={form.student_kind}
                onChange={e => setForm({ ...form, student_kind: e.target.value as any, student_class: [] })}
                className={inputCls}
              >
                <option value="normal">Normal (Regular Students Only)</option>
                <option value="special">Special (Special Needs Students Only)</option>
                <option value="combined">Combined (Both Regular and Special Needs)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1">
                {form.student_kind === 'normal' && 'This category applies only to regular students.'}
                {form.student_kind === 'special' && 'This category applies only to special needs students.'}
                {form.student_kind === 'combined' && 'This category applies to both regular and special needs students. Fields can override this setting.'}
              </p>
            </div>

            <div>
              <label className={labelCls}>Applicable Classes</label>
              <CategoryClassSelector
                allClassConfigs={filteredClasses}
                selectedConfigIds={form.student_class}
                onChange={(ids) => setForm({ ...form, student_class: ids })}
              />
            </div>

          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="category-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Category' : 'Create Category'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Teachers Modal ───────────────────────────────────────────────────────────
function TeachersModal({ categoryName, assignedTeachers, isSaving, onSave, onClose }: {
  categoryName: string;
  assignedTeachers: Staff[];
  isSaving: boolean;
  onSave: (teacherIds: number[]) => Promise<void>;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Staff[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(() => assignedTeachers.map(t => t.id));
  const [localTeachers, setLocalTeachers] = useState<Staff[]>(assignedTeachers);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const searchStaff = useCallback(async () => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await staffAPI.list({ search: searchTerm, page_size: 20 });
      const results = (data as any)?.results ?? (data as any)?.data ?? data ?? [];
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error('Staff search failed:', err);
    } finally {
      setSearching(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const timer = setTimeout(searchStaff, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, searchStaff]);


    const toggleStaff = (staffId: number, staffObj?: Staff) => {
      const isSelected = selectedIds.includes(staffId);
      if (isSelected) {
        setSelectedIds(prev => prev.filter(id => id !== staffId));
        setLocalTeachers(prev => prev.filter(t => t.id !== staffId));
      } else {
        setSelectedIds(prev => [...prev, staffId]);
        if (staffObj) setLocalTeachers(prev => [...prev, staffObj]);
      }
    };

  const handleSubmit = async () => {
    setFormError(null);
    try {
      await onSave(selectedIds);
    } catch (err) {
      setFormError(extractError(err));
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '80vh' }}>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assign Teachers - {categoryName}
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

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff by name (min 2 characters)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={inputCls + " pl-9"}
            />
          </div>

          {searching ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Search Results</p>
              {searchResults.map(staff => (
                <div key={staff.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="font-medium text-slate-800">{staff.full_name || `${staff.first_name} ${staff.last_name}`}</p>
                    <p className="text-xs text-slate-400">{staff.staff_id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleStaff(staff.id, staff)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedIds.includes(staff.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {selectedIds.includes(staff.id) ? 'Remove' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          ) : searchTerm.length >= 2 ? (
            <p className="text-center text-sm text-slate-400 py-8">No staff found matching "{searchTerm}"</p>
          ) : (
            <p className="text-center text-sm text-slate-400 py-8">Type at least 2 characters to search for staff</p>
          )}

          {localTeachers.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Currently Assigned</p>
              <div className="flex flex-wrap gap-2">
                {localTeachers.map(staff => (
                  <div key={staff.id} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                    <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-sm text-blue-700">{staff.full_name || `${staff.first_name} ${staff.last_name}`}</span>
                    <button onClick={() => {
                      toggleStaff(staff.id);
                    }} className="text-blue-400 hover:text-blue-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Save Teachers</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({
  allClassConfigs,
  loading,
  results,
  onRunPreview,
  onClose,
}: {
  allClassConfigs: ClassConfiguration[];
  loading: boolean;
  results: PreviewCategoryGroup[] | null;
  onRunPreview: (configIds: number[], kind: 'normal' | 'special' | 'both') => void;
  onClose: () => void;
}) {
  const grouped = useMemo(() => {
    const map: Record<string, { classId: number; className: string; configs: ClassConfiguration[] }> = {};
    allClassConfigs.forEach(cfg => {
      const className = cfg.class_name || `Class ${cfg.student_class}`;
      if (!map[className]) {
        map[className] = { classId: cfg.student_class as number, className, configs: [] };
      }
      map[className].configs.push(cfg);
    });
    return Object.values(map);
  }, [allClassConfigs]);

  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [selectedConfigId, setSelectedConfigId] = useState<number | ''>('');
  const [kind, setKind] = useState<'normal' | 'special' | 'both'>('both');

  const currentGroup = grouped.find(g => g.className === selectedClassName) || null;
  const hasMultipleSections = (currentGroup?.configs.length || 0) > 1;

  const handleClassChange = (className: string) => {
    setSelectedClassName(className);
    setSelectedConfigId('');
  };

  const handleShowPreview = () => {
    if (!currentGroup) return;
    const configIds = selectedConfigId
      ? [Number(selectedConfigId)]
      : currentGroup.configs.map(c => c.id);
    onRunPreview(configIds, kind);
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Preview Categories &amp; Fields
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Class</label>
              <select value={selectedClassName} onChange={e => handleClassChange(e.target.value)} className={inputCls}>
                <option value="">Select Class</option>
                {grouped.map(g => <option key={g.className} value={g.className}>{g.className}</option>)}
              </select>
            </div>

            {hasMultipleSections && (
              <div>
                <label className={labelCls}>Section <span className="text-slate-300 normal-case">(optional)</span></label>
                <select value={selectedConfigId} onChange={e => setSelectedConfigId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
                  <option value="">All Sections</option>
                  {currentGroup?.configs.map(cfg => (
                    <option key={cfg.id} value={cfg.id}>{cfg.class_section_name || currentGroup.className}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Student Kind</label>
              <select value={kind} onChange={e => setKind(e.target.value as any)} className={inputCls}>
                <option value="both">Both</option>
                <option value="normal">Normal</option>
                <option value="special">Special</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleShowPreview}
            disabled={!selectedClassName || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading...</> : <><Search className="h-4 w-4" /> Show Preview</>}
          </button>

          {results && (
            results.length === 0 ? (
              <p className="text-sm text-slate-400 italic text-center py-8">No categories or fields match this selection.</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                {results.map(group => (
                  <div key={group.categoryId}>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">{group.categoryName}</p>
                    </div>
                    {group.fields.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400 italic">No matching fields.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody>
                          {group.fields.map((f, idx) => (
                            <tr key={f.id} className={idx !== group.fields.length - 1 ? 'border-b border-slate-50' : ''}>
                              <td className="px-4 py-2 text-slate-400 w-10">{f.order}</td>
                              <td className="px-4 py-2 text-slate-700">{f.name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field Row Editor (Inline) ────────────────────────────────────────────────
function FieldRowEditor({ field, index, categoryStudentKind, allClassConfigs, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: {
  field: FieldFormData;
  index: number;
  categoryStudentKind: 'normal' | 'special' | 'combined';
  allClassConfigs: ClassConfiguration[];
  onUpdate: (field: FieldFormData) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isStudentKindLocked = categoryStudentKind !== 'combined';

  const filteredClasses = useMemo(() => {
    return filterClassesByStudentKind(allClassConfigs, field.student_kind);
  }, [allClassConfigs, field.student_kind]);

  const toggleClass = (classId: number) => {
    onUpdate({
      ...field,
      student_class: field.student_class.includes(classId)
        ? field.student_class.filter(id => id !== classId)
        : [...field.student_class, classId]
    });
  };

  const inputCls = "w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            className="p-0.5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-30 transition-colors">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <span className="text-xs font-bold text-slate-500 ml-1">Field {index + 1}</span>
        </div>
        <button type="button" onClick={onRemove}
          className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
          <Trash2 className="h-3 w-3" /> Remove
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-7">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Field Name</label>
            <input type="text" placeholder="e.g. Reading, Writing" value={field.name}
              onChange={e => onUpdate({ ...field, name: e.target.value })}
              className={inputCls} />
          </div>
          <div className="col-span-3">
            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Order</label>
            <input type="number" min="1" value={field.order} onChange={e => onUpdate({ ...field, order: Number(e.target.value) })}
              className={inputCls} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
            Student Kind {isStudentKindLocked && <span className="text-slate-300 normal-case">(locked by category)</span>}
          </label>
          <select
            value={field.student_kind}
            onChange={e => onUpdate({ ...field, student_kind: e.target.value as any, student_class: [] })}
            disabled={isStudentKindLocked}
            className={inputCls + (isStudentKindLocked ? ' opacity-70 cursor-not-allowed' : '')}
          >
            <option value="normal">Normal (Regular Students Only)</option>
            <option value="special">Special (Special Needs Students Only)</option>
            <option value="combined">Combined (Both Regular and Special Needs)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Applicable Classes</label>
          <CategoryClassSelector
            allClassConfigs={filteredClasses}
            selectedConfigIds={field.student_class}
            onChange={(ids) => onUpdate({ ...field, student_class: ids })}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TextCategoriesPage() {
  const { hasPermission, user } = useAuth();

  const [categories, setCategories] = useState<TextResultCategory[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [sessionPeriods, setSessionPeriods] = useState<AcademicSessionPeriod[]>([]);
  const [periodType, setPeriodType] = useState<AcademicPeriodType | null>(null);
  const [settings, setSettings] = useState<ResultSettings | null>(null);
  const [allClassConfigs, setAllClassConfigs] = useState<ClassConfiguration[]>([]);
  const [allTeachers, setAllTeachers] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingTeachers, setLoadingTeachers] = useState(false);

  const [pendingTeachers, setPendingTeachers] = useState<Staff[] | null>(null);
  const [teacherModalKey, setTeacherModalKey] = useState(0);

  const [selectedSessionPeriodId, setSelectedSessionPeriodId] = useState<number | null>(null);
  const [filterSection, setFilterSection] = useState<number | ''>('');

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TextResultCategory | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [showTeachersModal, setShowTeachersModal] = useState(false);
  const [selectedCategoryForTeachers, setSelectedCategoryForTeachers] = useState<TextResultCategory | null>(null);
  const [assignedTeachers, setAssignedTeachers] = useState<Staff[]>([]);
  const [isSavingTeachers, setIsSavingTeachers] = useState(false);

  const [deletingCategory, setDeletingCategory] = useState<TextResultCategory | null>(null);
  const [deletingField, setDeletingField] = useState<{ categoryId: number; fieldId: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [categoryFields, setCategoryFields] = useState<Record<number, FieldFormData[]>>({});
  const [savingFields, setSavingFields] = useState<Record<number, boolean>>({});

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // ── Preview state ──
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewCategoryGroup[] | null>(null);

  const canCreate = user?.is_superuser || hasPermission('result.manage_result_configuration');
  const canEdit = user?.is_superuser || hasPermission('result.manage_result_configuration');
  const canDelete = user?.is_superuser || hasPermission('result.manage_result_configuration');

  const scope = settings?.text_category_scope || 'fixed';

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchClassConfigs = useCallback(async () => {
    try {
      const configsData = await academicAPI.listClassConfigurations();
      setAllClassConfigs(Array.isArray(configsData) ? configsData : []);
    } catch (err) {
      console.error('Failed to fetch class configurations:', err);
    }
  }, []);

  const fetchPeriodData = useCallback(async () => {
    try {
      const [periodTypesData, sessionPeriodsData] = await Promise.all([
        academicCalendarAPI.listPeriodTypes(),
        academicCalendarAPI.listSessionPeriods(),
      ]);

      const activePeriodType = Array.isArray(periodTypesData)
        ? periodTypesData.find(pt => pt.is_active)
        : null;
      setPeriodType(activePeriodType || null);

      const periodsList = Array.isArray(sessionPeriodsData) ? sessionPeriodsData : [];
      setSessionPeriods(periodsList);

      if (periodsList.length > 0 && scope !== 'fixed') {
        const currentPeriod = periodsList.find(p => p.is_current);
        const periodIdToSelect = currentPeriod ? currentPeriod.id : periodsList[0].id;
        setSelectedSessionPeriodId(periodIdToSelect);
      }
    } catch (err) {
      console.error('Failed to fetch period data:', err);
    }
  }, [scope]);

  const fetchSettings = useCallback(async () => {
    try {
      const settingsData = await resultSettingsAPI.get();
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const params: any = {};

      if (scope !== 'fixed' && selectedSessionPeriodId) {
        params.academic_period = selectedSessionPeriodId;
      }

      if (filterSection) {
        params.school_section = filterSection;
      }

      const [categoriesData, sectionsData] = await Promise.all([
        textCategoriesAPI.list(params),
        academicCalendarAPI.listSchoolSections(),
      ]);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setSchoolSections(Array.isArray(sectionsData) ? sectionsData : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [scope, selectedSessionPeriodId, filterSection]);

  const fetchAllTeachers = useCallback(async () => {
    if (categories.length > 0) {
      const allTeacherIds = [...new Set(categories.flatMap(c => c.teachers))];
      if (allTeacherIds.length > 0) {
        try {
          const staffList = await staffAPI.list({});
          const results = (staffList as any)?.results ?? (staffList as any)?.data ?? staffList ?? [];
          setAllTeachers(Array.isArray(results) ? results : []);
        } catch (err) {
          console.error('Failed to fetch teachers:', err);
        }
      }
    }
  }, [categories]);

  const fetchTeachersForCategory = useCallback(async (category: TextResultCategory): Promise<Staff[]> => {
    if (!category.teachers || category.teachers.length === 0) {
      setAssignedTeachers([]);
      return [];
    }
    setLoadingTeachers(true);
    try {
      const staffList = await staffAPI.list({});
      const results = (staffList as any)?.results ?? (staffList as any)?.data ?? staffList ?? [];
      const teacherIds = new Set(category.teachers);
      const teachers = (Array.isArray(results) ? results : []).filter(t => teacherIds.has(t.id));
      setAssignedTeachers(teachers);
      return teachers;
    } catch (err) {
      console.error('Failed to fetch teachers:', err);
      setAssignedTeachers([]);
      return [];
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  useEffect(() => { fetchPeriodData(); }, []);
  useEffect(() => { fetchSettings(); }, []);
  useEffect(() => { fetchClassConfigs(); }, []);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchAllTeachers(); }, [fetchAllTeachers]);

  const fetchFieldsForCategory = useCallback(async (categoryId: number, categoryStudentKind: string) => {
    try {
      const fieldsData = await textCategoriesAPI.listFields({ category: categoryId });
      const fields = Array.isArray(fieldsData) ? fieldsData : [];
      setCategoryFields(prev => ({
        ...prev,
        [categoryId]: fields.map(f => ({
          _id: String(f.id),
          name: f.name,
          order: f.order,
          student_kind: f.student_kind || categoryStudentKind,
          student_class: f.student_class || [],
        })),
      }));
    } catch (err) {
      showToast('error', extractError(err));
    }
  }, [showToast]);

  const handleExpand = (categoryId: number, categoryStudentKind: string) => {
    if (expandedId === categoryId) {
      setExpandedId(null);
    } else {
      setExpandedId(categoryId);
      if (!categoryFields[categoryId]) {
        fetchFieldsForCategory(categoryId, categoryStudentKind);
      }
    }
  };

  const handleSaveCategory = async (data: CategoryFormData) => {
    setIsSavingCategory(true);
    try {
      const payload: any = { ...data };

      if (scope !== 'fixed') {
        payload.academic_period = selectedSessionPeriodId;
      }

      if (editingCategory) {
        const updated = await textCategoriesAPI.update(editingCategory.id, payload);
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...updated, fields_list: c.fields_list } : c));
        showToast('success', `"${data.name}" updated successfully`);
      } else {
        const created = await textCategoriesAPI.create(payload);
        setCategories(prev => [created, ...prev]);
        showToast('success', `"${data.name}" created successfully`);
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (err) {
      throw err;
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSaveTeachers = async (teacherIds: number[]) => {
    if (!selectedCategoryForTeachers) return;
    setIsSavingTeachers(true);
    try {
      await textCategoriesAPI.update(selectedCategoryForTeachers.id, { teachers: teacherIds });
      showToast('success', 'Teachers assigned successfully');
      setShowTeachersModal(false);
      setSelectedCategoryForTeachers(null);
      setPendingTeachers(null);
      fetchCategories();
      fetchAllTeachers();
    } catch (err) {
      throw err;
    } finally {
      setIsSavingTeachers(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      await textCategoriesAPI.delete(deletingCategory.id);
      setCategories(prev => prev.filter(c => c.id !== deletingCategory.id));
      showToast('success', `"${deletingCategory.name}" deleted`);
      setDeletingCategory(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingCategory(null);
    } finally { setIsDeleting(false); }
  };

  const handleSaveFields = async (categoryId: number) => {
    const fields = categoryFields[categoryId];
    if (!fields) return;

    setSavingFields(prev => ({ ...prev, [categoryId]: true }));
    try {
      const existingFields = await textCategoriesAPI.listFields({ category: categoryId });
      const existingIds = new Set(existingFields.map(f => f.id));
      const currentIds = new Set(fields.filter(f => !f._id.toString().startsWith('temp_')).map(f => parseInt(f._id.toString())));

      for (const existing of existingFields) {
        if (!currentIds.has(existing.id)) {
          await textCategoriesAPI.deleteField(existing.id);
        }
      }

      for (const field of fields) {
        if (field._id.toString().startsWith('temp_')) {
          await textCategoriesAPI.createField({
            category: categoryId,
            name: field.name,
            order: field.order,
            student_kind: field.student_kind,
            student_class: field.student_class,
          } as any);
        } else {
          await textCategoriesAPI.updateField(parseInt(field._id.toString()), {
            name: field.name,
            order: field.order,
            student_kind: field.student_kind,
            student_class: field.student_class,
          } as any);
        }
      }

      showToast('success', 'Fields saved successfully');
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        fetchFieldsForCategory(categoryId, category.student_kind);
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSavingFields(prev => ({ ...prev, [categoryId]: false }));
    }
  };

  const addFieldToCategory = (categoryId: number, categoryStudentKind: string) => {
    const currentFields = categoryFields[categoryId] || [];
    const newOrder = currentFields.length + 1;
    const newField: FieldFormData = {
      _id: `temp_${Date.now()}_${Math.random()}`,
      name: '',
      order: newOrder,
      student_kind: categoryStudentKind === 'combined' ? 'combined' : categoryStudentKind as 'normal' | 'special' | 'combined',
      student_class: [],
    };
    setCategoryFields(prev => ({
      ...prev,
      [categoryId]: [...currentFields, newField],
    }));
  };

  const updateFieldInCategory = (categoryId: number, fieldIndex: number, updatedField: FieldFormData) => {
    const currentFields = [...(categoryFields[categoryId] || [])];
    currentFields[fieldIndex] = updatedField;
    setCategoryFields(prev => ({ ...prev, [categoryId]: currentFields }));
  };

  const removeFieldFromCategory = (categoryId: number, fieldIndex: number) => {
    const currentFields = [...(categoryFields[categoryId] || [])];
    currentFields.splice(fieldIndex, 1);
    currentFields.forEach((field, idx) => { field.order = idx + 1; });
    setCategoryFields(prev => ({ ...prev, [categoryId]: currentFields }));
  };

  const moveField = (categoryId: number, fieldIndex: number, direction: 'up' | 'down') => {
    const fields = [...(categoryFields[categoryId] || [])];
    if (direction === 'up' && fieldIndex === 0) return;
    if (direction === 'down' && fieldIndex === fields.length - 1) return;

    const swapIndex = direction === 'up' ? fieldIndex - 1 : fieldIndex + 1;
    [fields[fieldIndex], fields[swapIndex]] = [fields[swapIndex], fields[fieldIndex]];
    fields.forEach((field, idx) => { field.order = idx + 1; });
    setCategoryFields(prev => ({ ...prev, [categoryId]: fields }));
  };

  const handleCopyFromLastSession = async () => {
    if (!selectedSessionPeriodId) return;

    try {
      const result = await textCategoriesAPI.copyFromLastSession(selectedSessionPeriodId);
      showToast('success', result.message);
      fetchCategories();
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  // ── Preview handler ──
  const handleRunPreview = async (configIds: number[], kind: 'normal' | 'special' | 'both') => {
    setPreviewLoading(true);
    setPreviewResults(null);
    try {
      const matchesClass = (studentClass: number[] | undefined | null) =>
        !studentClass || studentClass.length === 0 || studentClass.some(id => configIds.includes(id));

      const matchesKind = (itemKind: string) =>
        kind === 'both' ? true : (itemKind === kind || itemKind === 'combined');

      const matchingCategories = categories
        .filter(c => matchesClass(c.student_class) && matchesKind(c.student_kind))
        .sort((a, b) => a.order - b.order);

      const groups: PreviewCategoryGroup[] = [];
      for (const category of matchingCategories) {
        const fieldsData = await textCategoriesAPI.listFields({ category: category.id });
        const fields = Array.isArray(fieldsData) ? fieldsData : [];
        const matchingFields = fields
          .filter(f => matchesClass(f.student_class) && matchesKind(f.student_kind || category.student_kind))
          .sort((a, b) => a.order - b.order)
          .map(f => ({ id: f.id, name: f.name, order: f.order }));

        if (matchingFields.length > 0) {
          groups.push({ categoryId: category.id, categoryName: category.name, fields: matchingFields });
        }
      }

      setPreviewResults(groups);
    } catch (err) {
      showToast('error', extractError(err));
      setPreviewResults([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const getPeriodTypeLabel = () => {
    if (!periodType) return 'Period';
    return periodType.singular_name.charAt(0).toUpperCase() + periodType.singular_name.slice(1);
  };

  const getPeriodTypePluralLabel = () => {
    if (!periodType) return 'Periods';
    return periodType.plural_name.charAt(0).toUpperCase() + periodType.plural_name.slice(1);
  };

  const getSectionName = (sectionId: number | null | undefined) => {
    if (!sectionId) return 'All Sections';
    return schoolSections.find(s => s.id === sectionId)?.name || 'Unknown';
  };

  const getScopeLabel = () => {
    switch (scope) {
      case 'fixed': return 'Fixed (used forever)';
      case 'per_session': return `Per Session (copied across sessions, same structure for all ${getPeriodTypePluralLabel()} in a session)`;
      case 'per_period': return `Per ${getPeriodTypeLabel()} (unique per ${getPeriodTypeLabel().toLowerCase()})`;
      default: return 'Unknown';
    }
  };

  const filtered = categories.filter(c => {
    const matchSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSection = !filterSection || c.school_section === filterSection;
    return matchSearch && matchSection;
  });

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingCategory}
        title="Delete Category"
        name={deletingCategory?.name || ''}
        isDeleting={isDeleting}
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeletingCategory(null)}
      />

      <ConfirmModal
        open={!!deletingField}
        title="Delete Field"
        name="this field"
        isDeleting={isDeleting}
        onConfirm={async () => {
          if (deletingField) {
            try {
              await textCategoriesAPI.deleteField(deletingField.fieldId);
              showToast('success', 'Field deleted successfully');
              const category = categories.find(c => c.id === deletingField.categoryId);
              if (category) {
                fetchFieldsForCategory(deletingField.categoryId, category.student_kind);
              }
              setDeletingField(null);
            } catch (err) {
              showToast('error', extractError(err));
              setDeletingField(null);
            }
          }
        }}
        onCancel={() => setDeletingField(null)}
      />

      {showCategoryModal && (
        <CategoryModal
          editing={editingCategory}
          schoolSections={schoolSections}
          allClassConfigs={allClassConfigs}
          isSaving={isSavingCategory}
          onSave={handleSaveCategory}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null); }}
        />
      )}

      {showTeachersModal && selectedCategoryForTeachers && pendingTeachers !== null && (
        <TeachersModal
          key={teacherModalKey}
          categoryName={selectedCategoryForTeachers.name}
          assignedTeachers={pendingTeachers}
          isSaving={isSavingTeachers}
          onSave={handleSaveTeachers}
          onClose={() => { setShowTeachersModal(false); setSelectedCategoryForTeachers(null); setPendingTeachers(null); }}
        />
      )}

      {showPreviewModal && (
        <PreviewModal
          allClassConfigs={allClassConfigs}
          loading={previewLoading}
          results={previewResults}
          onRunPreview={handleRunPreview}
          onClose={() => { setShowPreviewModal(false); setPreviewResults(null); }}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <FileText className="h-5 w-5 text-white" />
            </div>
            Text Result Categories
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage text-based result categories and fields</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setPreviewResults(null); setShowPreviewModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all">
            <Search className="h-4 w-4" /> Preview
          </button>
          {canCreate && (
            <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
              <Plus className="h-4 w-4" /> New Category
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {scope !== 'fixed' && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {getPeriodTypeLabel()}
              </label>
              <select
                value={selectedSessionPeriodId || ''}
                onChange={e => setSelectedSessionPeriodId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Select {getPeriodTypeLabel()}</option>
                {sessionPeriods.map(p => {
                  const sessionName = `${p.session.start_year}${p.session.separator}${p.session.end_year}`;
                  const periodName = p.period.name;
                  return (
                    <option key={p.id} value={p.id}>
                      {sessionName} - {periodName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">School Section</label>
            <select value={filterSection} onChange={e => setFilterSection(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
              <option value="">All Sections</option>
              {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-500">Scope: <span className="font-semibold text-slate-700">{getScopeLabel()}</span></p>
              </div>
              {scope === 'per_session' && selectedSessionPeriodId && (
                <button onClick={handleCopyFromLastSession}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors whitespace-nowrap">
                  <Copy className="h-3.5 w-3.5" /> Copy from Last Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Current Selection Display (only for non-fixed scope) ── */}
      {scope !== 'fixed' && selectedSessionPeriodId && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
          <p className="text-sm font-medium text-blue-800">
            Text Result Categories for: {getPeriodTypeLabel()} - {sessionPeriods.find(p => p.id === selectedSessionPeriodId)?.period.name || ''}
          </p>
        </div>
      )}

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Categories', value: categories.length, icon: FileText, color: 'from-blue-500 to-blue-600' },
          { label: 'School Sections', value: schoolSections.length, icon: Building2, color: 'from-violet-500 to-purple-600' },
          { label: 'Scope', value: scope === 'fixed' ? 'Fixed' : scope === 'per_session' ? 'Per Session' : 'Per Period', icon: Globe, color: 'from-emerald-500 to-teal-600' },
          { label: scope === 'fixed' ? 'Global' : getPeriodTypeLabel(), value: scope === 'fixed' ? 'All' : sessionPeriods.length, icon: scope === 'fixed' ? Globe : Calendar, color: 'from-orange-400 to-amber-500' },
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

      {/* ── Categories List ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search categories..."
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
          <button onClick={() => fetchCategories()} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading categories...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchCategories} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileText className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm ? 'No categories match your search' : 'No categories found'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm ? 'Try a different search term.' : 'Create your first text result category to get started.'}
            </p>
            {!searchTerm && canCreate && (
              <button onClick={() => { setEditingCategory(null); setShowCategoryModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> New Category
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[1fr_140px_100px_120px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Section</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(category => {
                const fields = categoryFields[category.id] || [];
                const isExpanded = expandedId === category.id;
                const isSavingFieldsForCategory = savingFields[category.id] || false;

                return (
                  <div key={category.id}>
                    <div className="flex flex-col sm:grid sm:grid-cols-[1fr_140px_100px_120px] items-start sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-100">
                          <FileText className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{category.name}</p>
                          {category.description && (
                            <p className="text-xs text-slate-400 truncate">{category.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400">Order: {category.order}</span>
                            <span className="text-xs text-slate-300">·</span>
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 capitalize">
                              {category.student_kind}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 sm:block min-w-0">
                        <span className="sm:hidden text-xs text-slate-400">Section:</span>
                        <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[120px] block">
                          {getSectionName(category.school_section)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:block">
                        <span className="sm:hidden text-xs text-slate-400">Fields:</span>
                        <span className="text-sm font-medium text-slate-600">
                          {category.fields_list?.length || 0} field{(category.fields_list?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={async () => {
                                setSelectedCategoryForTeachers(category);
                                setPendingTeachers(null);
                                const teachers = await fetchTeachersForCategory(category);
                                setPendingTeachers(teachers);
                                setTeacherModalKey(k => k + 1);
                                setShowTeachersModal(true);
                              }}
                              title="Assign Teachers"
                              className="p-2 rounded-lg text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all"
                              disabled={loadingTeachers}
                            >
                              {loadingTeachers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                            </button>
                            <button
                              onClick={() => { setEditingCategory(category); setShowCategoryModal(true); }}
                              title="Edit"
                              className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeletingCategory(category)} title="Delete"
                            className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleExpand(category.id, category.student_kind)} title="Expand fields"
                          className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="ml-0 sm:ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Fields</p>
                            <div className="flex gap-2">
                              {fields.length > 0 && (
                                <button onClick={() => handleSaveFields(category.id)} disabled={isSavingFieldsForCategory}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all disabled:opacity-50">
                                  {isSavingFieldsForCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                  Save Fields
                                </button>
                              )}
                              <button onClick={() => addFieldToCategory(category.id, category.student_kind)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                                <Plus className="h-3 w-3" /> Add Field
                              </button>
                            </div>
                          </div>

                          {fields.length === 0 ? (
                            <p className="text-sm text-slate-400 italic text-center py-4">No fields yet. Click "Add Field" to create one.</p>
                          ) : (
                            <div className="space-y-3">
                              {fields.map((field, idx) => (
                                <FieldRowEditor
                                  key={field._id}
                                  field={field}
                                  index={idx}
                                  categoryStudentKind={category.student_kind}
                                  allClassConfigs={allClassConfigs}
                                  onUpdate={(updated) => updateFieldInCategory(category.id, idx, updated)}
                                  onRemove={() => removeFieldFromCategory(category.id, idx)}
                                  onMoveUp={() => moveField(category.id, idx, 'up')}
                                  onMoveDown={() => moveField(category.id, idx, 'down')}
                                  isFirst={idx === 0}
                                  isLast={idx === fields.length - 1}
                                />
                              ))}
                            </div>
                          )}

                          {fields.length > 0 && (
                                      <div className="flex justify-end gap-2 mt-3">
                                        <button onClick={() => handleSaveFields(category.id)} disabled={isSavingFieldsForCategory}
                                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all disabled:opacity-50">
                                          {isSavingFieldsForCategory ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                          Save Fields
                                        </button>
                                        <button onClick={() => addFieldToCategory(category.id, category.student_kind)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                                          <Plus className="h-3 w-3" /> Add Field
                                        </button>
                                      </div>
                                    )}
                                    {fields.length === 0 && (
                                      <div className="flex justify-end mt-2">
                                        <button onClick={() => addFieldToCategory(category.id, category.student_kind)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                                          <Plus className="h-3 w-3" /> Add Field
                                        </button>
                                      </div>
                                    )}

                          {/* Assigned Teachers */}
                          {category.teachers && category.teachers.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Assigned Teachers</p>
                              <div className="flex flex-wrap gap-2">
                                {category.teachers.map(teacherId => {
                                  const teacher = allTeachers.find(t => t.id === teacherId);
                                  return (
                                    <span key={teacherId} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-lg">
                                      {teacher?.full_name || teacher?.first_name || `Teacher #${teacherId}`}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Applied Classes */}
                          {category.student_class && category.student_class.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-slate-100">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Applied Classes</p>
                              <div className="flex flex-wrap gap-2">
                                {category.student_class.map(classId => {
                                  const classConfig = allClassConfigs.find(c => c.id === classId);
                                  const className = classConfig?.class_section_name
                                    ? `${classConfig.class_name} ${classConfig.class_section_name}`
                                    : classConfig?.class_name || `Class ${classId}`;
                                  return (
                                    <span key={classId} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg">
                                      {className}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}