'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { resultGroupsAPI } from '@/lib/api';
import { academicAPI, academicCalendarAPI } from '@/lib/api';
import { ResultConfigurationGroup, ResultConfigurationGroupWrite } from '@/lib/types';
import {
  Layers, Plus, Edit3, Trash2, Search, X, Check, AlertCircle,
  AlertTriangle, Loader2, RefreshCw, ChevronDown, ChevronUp,
  Users, Award, Columns, CheckSquare, Square, Eye, Shield,
  GraduationCap, Building2, Minus,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ClassConfig {
  id: number;
  student_class: number;
  class_section: number | null;
  class_section_name: string | null;
  is_active: boolean;
  student_count: number;
}

interface ClassModel {
  id: number;
  name: string;
  short_name?: string | null;
  school_section?: number | null;
  is_active: boolean;
  order: number;
}

interface SchoolSection { id: number; name: string; code: string; }

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const msgs = Object.entries(d.details).map(([, v]) => Array.isArray(v) ? v[0] : String(v)).join(' ');
      if (msgs) return msgs;
    }
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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

function ConfirmModal({ open, group, isDeleting, onConfirm, onCancel }: {
  open: boolean; group: ResultConfigurationGroup | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !group) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Group</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-700">"{group.name}"</span>?
          This cannot be undone.
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

// ─── Class Config Selector ─────────────────────────────────────────────────────
function ClassConfigSelector({
  allClasses, allConfigs, selectedConfigIds, onChange,
}: {
  allClasses: ClassModel[];
  allConfigs: ClassConfig[];
  selectedConfigIds: number[];
  onChange: (ids: number[]) => void;
}) {
  // Group configs by class
  const grouped = useMemo(() => {
    const map: Record<number, ClassConfig[]> = {};
    allConfigs.forEach(cfg => {
      if (!map[cfg.student_class]) map[cfg.student_class] = [];
      map[cfg.student_class].push(cfg);
    });
    return map;
  }, [allConfigs]);

  // Unique section names across all configs
  const allSectionNames = useMemo(() => {
    const names = new Set<string>();
    allConfigs.forEach(cfg => { if (cfg.class_section_name) names.add(cfg.class_section_name); });
    return Array.from(names).sort();
  }, [allConfigs]);

  const [bulkSection, setBulkSection] = useState('');

  const classesWithConfigs = allClasses.filter(c => grouped[c.id]?.length > 0);
  const allConfigIds = allConfigs.map(c => c.id);
  const allSelected = allConfigIds.every(id => selectedConfigIds.includes(id));
  const someSelected = selectedConfigIds.length > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) onChange([]);
    else onChange(allConfigIds);
  };

  const toggleClass = (classId: number) => {
    const configIds = (grouped[classId] || []).map(c => c.id);
    const allChecked = configIds.every(id => selectedConfigIds.includes(id));
    if (allChecked) {
      onChange(selectedConfigIds.filter(id => !configIds.includes(id)));
    } else {
      const next = new Set([...selectedConfigIds, ...configIds]);
      onChange(Array.from(next));
    }
  };

  const toggleConfig = (configId: number, classId: number) => {
    let next: number[];
    if (selectedConfigIds.includes(configId)) {
      next = selectedConfigIds.filter(id => id !== configId);
    } else {
      next = [...selectedConfigIds, configId];
    }
    onChange(next);
  };

  const bulkToggleSection = (check: boolean) => {
    if (!bulkSection) return;
    const sectionConfigIds = allConfigs
      .filter(c => c.class_section_name === bulkSection)
      .map(c => c.id);
    if (check) {
      const next = new Set([...selectedConfigIds, ...sectionConfigIds]);
      onChange(Array.from(next));
    } else {
      onChange(selectedConfigIds.filter(id => !sectionConfigIds.includes(id)));
    }
  };

  const getClassState = (classId: number): 'all' | 'some' | 'none' => {
    const configIds = (grouped[classId] || []).map(c => c.id);
    const checked = configIds.filter(id => selectedConfigIds.includes(id));
    if (checked.length === 0) return 'none';
    if (checked.length === configIds.length) return 'all';
    return 'some';
  };

  if (classesWithConfigs.length === 0) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        No class configurations found. Please create class configurations first.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
        {/* Check all */}
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

        {/* Bulk section toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Section:</span>
          <select value={bulkSection} onChange={e => setBulkSection(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="">Select section</option>
            {allSectionNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <button type="button" onClick={() => bulkToggleSection(true)} disabled={!bulkSection}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-40 font-medium">
            <CheckSquare className="h-3.5 w-3.5" /> Check
          </button>
          <button type="button" onClick={() => bulkToggleSection(false)} disabled={!bulkSection}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-40 font-medium">
            <Square className="h-3.5 w-3.5" /> Uncheck
          </button>
        </div>
      </div>

      {/* Selected count */}
      {selectedConfigIds.length > 0 && (
        <p className="text-xs text-blue-600 font-medium px-1">
          {selectedConfigIds.length} configuration{selectedConfigIds.length !== 1 ? 's' : ''} selected
        </p>
      )}

      {/* Class rows */}
      <div className="space-y-2">
        {classesWithConfigs.map(cls => {
          const configs = grouped[cls.id] || [];
          const state = getClassState(cls.id);
          const isExpanded = state !== 'none';

          return (
            <div key={cls.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Class row */}
              <button type="button" onClick={() => toggleClass(cls.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  state !== 'none' ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-slate-50'
                }`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  state === 'all' ? 'border-blue-500 bg-blue-500'
                  : state === 'some' ? 'border-blue-400 bg-blue-100'
                  : 'border-slate-300 bg-white'
                }`}>
                  {state === 'all' && <Check className="h-2.5 w-2.5 text-white" />}
                  {state === 'some' && <Minus className="h-2.5 w-2.5 text-blue-600" />}
                </div>
                <GraduationCap className={`h-4 w-4 flex-shrink-0 ${state !== 'none' ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className={`text-sm font-semibold flex-1 ${state !== 'none' ? 'text-blue-800' : 'text-slate-700'}`}>
                  {cls.name}
                  {cls.short_name && <span className="ml-1.5 text-xs font-normal text-slate-400">({cls.short_name})</span>}
                </span>
                <span className="text-xs text-slate-400">{configs.length} config{configs.length !== 1 ? 's' : ''}</span>
              </button>

              {/* Config chips — only shown when class is checked */}
              {state !== 'none' && (
                <div className="px-4 py-3 bg-blue-50/60 border-t border-blue-100 flex flex-wrap gap-2">
                  {configs.map(cfg => {
                    const checked = selectedConfigIds.includes(cfg.id);
                    const label = cfg.class_section_name || cls.name;
                    return (
                      <button key={cfg.id} type="button"
                        onClick={() => toggleConfig(cfg.id, cls.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          checked
                            ? 'bg-blue-500 border-blue-500 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}>
                        {checked
                          ? <Check className="h-3 w-3" />
                          : <Square className="h-3 w-3" />}
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

// ─── Group Modal ───────────────────────────────────────────────────────────────
interface GroupFormValues {
  name: string;
  description: string;
  school_section: number | null;
  is_active: boolean;
  class_configuration_ids: number[];
}

function GroupModal({ editing, schoolSections, allClasses, allConfigs, isSaving, onSave, onClose }: {
  editing: ResultConfigurationGroup | null;
  schoolSections: SchoolSection[];
  allClasses: ClassModel[];
  allConfigs: ClassConfig[];
  isSaving: boolean;
  onSave: (data: GroupFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const preselected = useMemo(() => {
    if (!editing) return [];
    return editing.class_configurations.map((c: any) => typeof c === 'object' ? c.id : c);
  }, [editing]);

  const [form, setForm] = useState<GroupFormValues>({
    name: editing?.name || '',
    description: editing?.description || '',
    school_section: editing?.school_section ?? null,
    is_active: editing?.is_active ?? true,
    class_configuration_ids: preselected,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof GroupFormValues>(key: K, val: GroupFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {editing ? 'Edit Configuration Group' : 'New Configuration Group'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        <form id="group-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-5">

            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Group Name <span className="text-red-400 normal-case">*</span></label>
                <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. SS1–SS3 Standard Grading" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Description</label>
                <textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Optional description..." className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className={labelCls}>School Section</label>
                <select value={form.school_section ?? ''} onChange={e => set('school_section', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                  <option value="">All Sections (Global)</option>
                  {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-0.5">
                <div className="flex items-center justify-between w-full p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Active</p>
                    <p className="text-xs text-slate-400">Group is available for use</p>
                  </div>
                  <button type="button" role="switch" aria-checked={form.is_active}
                    onClick={() => set('is_active', !form.is_active)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-blue-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Class config selector */}
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assign Class Configurations</p>
              <p className="text-xs text-slate-400 mb-3">Select classes and their sections to include in this group.</p>
              <ClassConfigSelector
                allClasses={allClasses}
                allConfigs={allConfigs}
                selectedConfigIds={form.class_configuration_ids}
                onChange={ids => set('class_configuration_ids', ids)}
              />
            </div>

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="group-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Group' : 'Create Group'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ResultGroupsPage() {
  const { hasPermission, user } = useAuth();

  const [groups, setGroups] = useState<ResultConfigurationGroup[]>([]);
  const [allClasses, setAllClasses] = useState<ClassModel[]>([]);
  const [allConfigs, setAllConfigs] = useState<ClassConfig[]>([]);
  const [schoolSections, setSchoolSections] = useState<SchoolSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ResultConfigurationGroup | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingGroup, setDeletingGroup] = useState<ResultConfigurationGroup | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState<number | ''>('');
  const [filterActive, setFilterActive] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('result.add_resultconfigurationgroupmodel');
  const canEdit   = user?.is_superuser || hasPermission('result.change_resultconfigurationgroupmodel');
  const canDelete = user?.is_superuser || hasPermission('result.delete_resultconfigurationgroupmodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const [groupsData, classesData, configsData, sectionsData] = await Promise.all([
        resultGroupsAPI.list(),
        academicAPI.listClasses(),
        academicAPI.listClassConfigurations(),
        academicCalendarAPI.listSchoolSections(),
      ]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setAllClasses(Array.isArray(classesData) ? classesData : []);
      setAllConfigs(Array.isArray(configsData) ? configsData : []);
      setSchoolSections(Array.isArray(sectionsData) ? sectionsData : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (form: GroupFormValues) => {
    setIsSaving(true);
    try {
      if (editingGroup) {
        const updated = await resultGroupsAPI.update(editingGroup.id, {
          name: form.name,
          description: form.description,
          school_section: form.school_section ?? undefined,
          is_active: form.is_active,
          class_configuration_ids: form.class_configuration_ids,
        });
        // Assign classes separately
        await resultGroupsAPI.assignClasses(editingGroup.id, form.class_configuration_ids, true);
        setGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, ...updated } : g));
        showToast('success', `"${form.name}" updated successfully`);
      } else {
        const created = await resultGroupsAPI.create({
          name: form.name,
          description: form.description,
          school_section: form.school_section ?? undefined,
          is_active: form.is_active,
          class_configuration_ids: form.class_configuration_ids,
        });
        setGroups(prev => [created, ...prev]);
        showToast('success', `"${form.name}" created successfully`);
      }
      setShowModal(false);
      setEditingGroup(null);
      fetchData(); // Refresh to get latest data
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setIsDeleting(true);
    try {
      await resultGroupsAPI.delete(deletingGroup.id);
      setGroups(prev => prev.filter(g => g.id !== deletingGroup.id));
      showToast('success', `"${deletingGroup.name}" deleted`);
      setDeletingGroup(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingGroup(null);
    } finally { setIsDeleting(false); }
  };

  const getSectionName = (val: number | null | undefined) =>
    val ? (schoolSections.find(s => s.id === val)?.name ?? 'Unknown') : 'All Sections';

  // Group assigned configs by class for expanded view
  const getGroupedConfigs = (group: ResultConfigurationGroup) => {
    const assignedIds = group.class_configurations.map((c: any) => typeof c === 'object' ? c.id : c);
    const assignedConfigs = allConfigs.filter(c => assignedIds.includes(c.id));
    const byClass: Record<number, ClassConfig[]> = {};
    assignedConfigs.forEach(cfg => {
      if (!byClass[cfg.student_class]) byClass[cfg.student_class] = [];
      byClass[cfg.student_class].push(cfg);
    });
    return byClass;
  };

  const filtered = groups.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSection = !filterSection || g.school_section === filterSection;
    const matchActive = !filterActive || g.is_active;
    return matchSearch && matchSection && matchActive;
  });

  const totalActive = groups.filter(g => g.is_active).length;
  const totalClasses = groups.reduce((sum, g) => sum + (g.class_count || g.class_configurations.length), 0);

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal open={!!deletingGroup} group={deletingGroup} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingGroup(null)} />

      {showModal && (
        <GroupModal
          editing={editingGroup}
          schoolSections={schoolSections}
          allClasses={allClasses}
          allConfigs={allConfigs}
          isSaving={isSaving}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingGroup(null); }}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Layers className="h-5 w-5 text-white" />
            </div>
            Configuration Groups
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Group classes to share grade sets and field sets</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditingGroup(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> New Group
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Groups', value: groups.length, icon: Layers, color: 'from-blue-500 to-blue-600' },
          { label: 'Active', value: totalActive, icon: Shield, color: 'from-emerald-500 to-teal-600' },
          { label: 'Total Classes', value: totalClasses, icon: GraduationCap, color: 'from-violet-500 to-purple-600' },
          { label: 'School Sections', value: schoolSections.length, icon: Building2, color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Search + filter bar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search groups..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value ? Number(e.target.value) : '')}
            className="px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white">
            <option value="">All Sections</option>
            {schoolSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
            <button onClick={fetchData} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading groups...</p>
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
              <Layers className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm || filterSection ? 'No groups match your search' : 'No groups yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm || filterSection ? 'Try different keywords or filters.' : 'Create your first configuration group to get started.'}
            </p>
            {!searchTerm && !filterSection && canCreate && (
              <button onClick={() => { setEditingGroup(null); setShowModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> New Group
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_130px_130px_90px_130px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Classes</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Grade Set</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Field Set</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(group => {
                const groupedConfigs = getGroupedConfigs(group);
                const classCount = group.class_count ?? group.class_configurations.length;

                return (
                  <div key={group.id}>
                    {/* Main row */}
                    <div className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_130px_130px_90px_130px] items-start sm:items-center gap-3 sm:gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                      {/* Name + section */}
                      <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${group.is_active ? 'bg-blue-100' : 'bg-slate-100'}`}>
                          <Layers className={`h-4 w-4 ${group.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{group.name}</p>
                          <p className="text-xs text-slate-400 truncate">{getSectionName(group.school_section)}</p>
                        </div>
                      </div>

                      {/* Classes */}
                      <div className="flex items-center gap-1.5 sm:block">
                        <span className="sm:hidden text-xs text-slate-400">Classes:</span>
                        <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {classCount} class{classCount !== 1 ? 'es' : ''}
                        </span>
                      </div>

                      {/* Grade Set */}
                      <div className="flex items-center gap-1.5 sm:block min-w-0">
                        <span className="sm:hidden text-xs text-slate-400 flex-shrink-0">Grade Set:</span>
                        {group.active_grade_set_name ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg font-medium truncate max-w-[120px]">
                            <Award className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{group.active_grade_set_name}</span>
                          </span>
                        ) : (
                          <a href={`/dashboard/staff/result/grade-sets?group=${group.id}`}
                              className="text-xs text-blue-500 hover:text-blue-700 italic underline underline-offset-2 transition-colors">
                              Not set — Add now
                            </a>
                        )}
                      </div>

                      {/* Field Set */}
                      <div className="flex items-center gap-1.5 sm:block min-w-0">
                        <span className="sm:hidden text-xs text-slate-400 flex-shrink-0">Field Set:</span>
                        {group.active_field_set_name ? (
                          <span className="flex items-center gap-1 text-xs text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg font-medium truncate max-w-[120px]">
                            <Columns className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{group.active_field_set_name}</span>
                          </span>
                        ) : (
                          <a href={`/dashboard/staff/result/field-sets?group=${group.id}`}
                          className="text-xs text-blue-500 hover:text-blue-700 italic underline underline-offset-2 transition-colors">
                          Not set — Add now
                        </a>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        {group.is_active ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inactive
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button onClick={() => { setEditingGroup(group); setShowModal(true); }} title="Edit"
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeletingGroup(group)} title="Delete"
                            className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => setExpandedId(expandedId === group.id ? null : group.id)} title="Toggle details"
                          className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                          {expandedId === group.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded row */}
                    {expandedId === group.id && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="ml-0 sm:ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                          {group.description && (
                            <p className="text-sm text-slate-500 italic">{group.description}</p>
                          )}

                          {Object.keys(groupedConfigs).length > 0 ? (
                            <div>
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Assigned Classes</p>
                              <div className="space-y-2">
                                {Object.entries(groupedConfigs).map(([classId, configs]) => {
                                  const cls = allClasses.find(c => c.id === Number(classId));
                                  return (
                                    <div key={classId} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                                        <span className="text-sm font-semibold text-slate-700">{cls?.name ?? `Class ${classId}`}</span>
                                        <span className="text-xs text-slate-400">({configs.length} section{configs.length !== 1 ? 's' : ''})</span>
                                      </div>
                                      <div className="flex flex-wrap gap-2 p-3">
                                        {configs.map(cfg => (
                                          <span key={cfg.id} className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg font-medium">
                                            <Users className="h-3 w-3" />
                                            {cfg.class_section_name || cls?.name || `Config ${cfg.id}`}
                                            <span className="text-blue-400">· {cfg.student_count}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400 italic">No class configurations assigned yet.</p>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pt-1 border-t border-slate-100">
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group ID</span>
                              <p className="mt-1 text-slate-700 font-medium">#{group.id}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Created</span>
                              <p className="mt-1 text-slate-700">{new Date(group.created_at).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</span>
                              <p className="mt-1 text-slate-700">{new Date(group.updated_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {groups.length} group{groups.length !== 1 ? 's' : ''}
                {filterActive ? ' (active only)' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}