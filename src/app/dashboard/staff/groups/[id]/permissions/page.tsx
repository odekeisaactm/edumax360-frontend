'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI } from '@/lib/api';
import { Group } from '@/lib/types';
import {
  Shield, ArrowLeft, Check, AlertCircle, Loader2,
  ChevronDown, ChevronUp, Save, X, RefreshCw, Lock,
  Users, BookOpen, DollarSign, Settings, Calendar,
  Building, Briefcase, FileText, GraduationCap, Layers,
} from 'lucide-react';

// Import ONLY the data — this is the only file you edit when adding modules
import { MODULES, AreaDef, ModuleDef } from '@/lib/permissionsConfig';

// ─── Auto-theming ──────────────────────────────────────────────────────────────
// Palettes cycle automatically by module index. Add modules freely — no manual
// color work needed. Add more palette entries here if you ever have >8 modules.

const MODULE_ICONS = [
  Users, BookOpen, DollarSign, Settings, Calendar,
  Building, Briefcase, FileText, GraduationCap, Layers,
];

const MODULE_ICON_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-600 to-purple-600',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-purple-500',
  'from-red-500 to-orange-600',
  'from-teal-500 to-emerald-600',
];

// Area palettes cycle within each module by area index
const AREA_PALETTES = [
  { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100',   dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700',   checkbox: 'bg-blue-500' },
  { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700', checkbox: 'bg-violet-500' },
  { color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-100',   dot: 'bg-teal-500',   badge: 'bg-teal-50 text-teal-700',   checkbox: 'bg-teal-500' },
  { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100', dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700', checkbox: 'bg-orange-500' },
  { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100', dot: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700', checkbox: 'bg-indigo-500' },
  { color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-100',   dot: 'bg-rose-500',   badge: 'bg-rose-50 text-rose-700',   checkbox: 'bg-rose-500' },
  { color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-100',dot: 'bg-emerald-500',badge: 'bg-emerald-50 text-emerald-700',checkbox: 'bg-emerald-500' },
  { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100',  dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700',  checkbox: 'bg-amber-500' },
];

function getModuleTheme(moduleIndex: number) {
  return {
    Icon: MODULE_ICONS[moduleIndex % MODULE_ICONS.length],
    gradient: MODULE_ICON_GRADIENTS[moduleIndex % MODULE_ICON_GRADIENTS.length],
  };
}

function getAreaTheme(areaIndex: number) {
  return AREA_PALETTES[areaIndex % AREA_PALETTES.length];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
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
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Area Sub-Accordion ────────────────────────────────────────────────────────
function AreaAccordion({ area, areaIndex, selected, onToggle, onToggleAll }: {
  area: AreaDef;
  areaIndex: number;
  selected: Set<string>;
  onToggle: (codename: string) => void;
  onToggleAll: (area: AreaDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const theme = getAreaTheme(areaIndex);
  const codes = area.permissions.map(p => p.codename);
  const selectedCount = codes.filter(c => selected.has(c)).length;
  const allOn = codes.length > 0 && selectedCount === codes.length;

  return (
    <div className={`rounded-xl border overflow-hidden ${theme.border}`}>
      {/* Area header */}
      <div className={`px-4 py-3 flex items-center justify-between ${theme.bg}`}>
        <button onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2.5 flex-1 text-left min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${theme.dot}`} />
          <div className="min-w-0">
            <p className={`font-semibold text-sm ${theme.color}`}>{area.label}</p>
            <p className="text-xs text-slate-400 truncate">{area.description}</p>
          </div>
          {open
            ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 ml-1" />
            : <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 ml-1" />}
        </button>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <span className="text-xs text-slate-400 tabular-nums">{selectedCount}/{codes.length}</span>
          {codes.length > 0 && (
            <button onClick={() => onToggleAll(area)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                allOn
                  ? `${theme.bg} ${theme.color} ${theme.border}`
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}>
              {allOn ? 'Clear' : 'All'}
            </button>
          )}
        </div>
      </div>

      {/* Permission rows */}
      {open && (
        <div className="bg-white divide-y divide-slate-50">
          {area.permissions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-slate-400 italic">No permissions defined yet.</p>
          ) : area.permissions.map(p => {
            const isOn = selected.has(p.codename);
            return (
              <label key={p.codename}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-slate-50/70 ${isOn ? 'bg-slate-50/40' : ''}`}>
                <div onClick={() => onToggle(p.codename)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isOn ? `${theme.checkbox} border-transparent` : 'border-slate-300 bg-white'
                  }`}>
                  {isOn && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0" onClick={() => onToggle(p.codename)}>
                  <p className={`text-sm font-medium leading-tight ${isOn ? 'text-slate-900' : 'text-slate-600'}`}>
                    {p.label}
                  </p>
                  <p className="text-xs text-slate-400 leading-tight mt-0.5">{p.desc}</p>
                </div>
                {isOn && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${theme.badge} flex-shrink-0`}>
                    ON
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Module Accordion ──────────────────────────────────────────────────────────
function ModuleAccordion({ module, moduleIndex, selected, onToggle, onToggleAll }: {
  module: ModuleDef;
  moduleIndex: number;
  selected: Set<string>;
  onToggle: (codename: string) => void;
  onToggleAll: (area: AreaDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const { Icon, gradient } = getModuleTheme(moduleIndex);

  const allCodes = module.areas.flatMap(a => a.permissions.map(p => p.codename));
  const selectedCount = allCodes.filter(c => selected.has(c)).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors text-left">
        <div className={`w-9 h-9 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900 text-sm">{module.label}</p>
          <p className="text-xs text-slate-400 truncate">{module.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {selectedCount > 0 && (
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg tabular-nums">
              {selectedCount} selected
            </span>
          )}
          {open
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2.5 border-t border-slate-50">
          <div className="pt-4 space-y-2.5">
            {module.areas.map((area, areaIndex) => (
              <AreaAccordion
                key={area.key}
                area={area}
                areaIndex={areaIndex}
                selected={selected}
                onToggle={onToggle}
                onToggleAll={onToggleAll}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function GroupPermissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const groupId = parseInt(id);

  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [group, setGroup]         = useState<Group | null>(null);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [original, setOriginal]   = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isSaving, setIsSaving]   = useState(false);
  const [toasts, setToasts]       = useState<ToastItem[]>([]);

  const canEdit = user?.is_superuser || hasPermission('auth.change_group');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (isNaN(groupId)) { setPageError('Invalid group ID'); setLoading(false); return; }
    setLoading(true); setPageError(null);
    try {
      const [groupData, groupPerms] = await Promise.all([
        groupsAPI.get(groupId),
        groupsAPI.getGroupPermissions(groupId),
      ]);
      setGroup(groupData);
      const perms = new Set<string>(groupPerms.map((p: any) => p.codename));
      setSelected(new Set(perms));
      setOriginal(new Set(perms));
    } catch (err: any) {
      setPageError(err?.response?.status === 404 ? 'Group not found' : extractError(err));
    } finally { setLoading(false); }
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = useCallback((codename: string) => {
    if (!canEdit) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(codename) ? next.delete(codename) : next.add(codename);
      return next;
    });
  }, [canEdit]);

  const toggleAll = useCallback((area: AreaDef) => {
    if (!canEdit) return;
    const codes = area.permissions.map(p => p.codename);
    setSelected(prev => {
      const next = new Set(prev);
      const allOn = codes.every(c => next.has(c));
      allOn ? codes.forEach(c => next.delete(c)) : codes.forEach(c => next.add(c));
      return next;
    });
  }, [canEdit]);

  const handleSave = async () => {
    if (!canEdit || !group) return;
    setIsSaving(true);
    try {
      await groupsAPI.assignPermissions(groupId, { permissions: [...selected] });
      setOriginal(new Set(selected));
      showToast('success', `Permissions saved for "${group.name}"`);
      setTimeout(() => router.push(`/dashboard/staff/groups/${groupId}`), 1200);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setIsSaving(false); }
  };

  const isDirty = [...selected].some(c => !original.has(c)) || [...original].some(c => !selected.has(c));
  const totalSelected = selected.size;

  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading permissions...</p>
      </div>
    </div>
  );

  if (pageError || !group) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="font-semibold text-slate-700 mb-1">{pageError ?? 'Something went wrong'}</h3>
        <p className="text-sm text-slate-400 mb-5">Could not load this group's permissions.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
          <button onClick={() => router.push('/dashboard/staff/groups')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
            Back to Groups
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 pb-28">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/dashboard/staff/groups/${groupId}`)}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <Lock className="h-5 w-5 text-white" />
              </div>
              Assign Permissions
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">
              Group: <span className="font-semibold text-slate-600">{group.name}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            <span className="font-bold text-blue-600">{totalSelected}</span> selected
          </span>
          {isDirty && (
            <button onClick={() => setSelected(new Set(original))}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Reset
            </button>
          )}
          <button onClick={handleSave} disabled={isSaving || !isDirty}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save</>}
          </button>
        </div>
      </div>

      {/* ── Info note ── */}
      <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
        <Shield className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Expand a module to see its permission areas. Each area groups related actions together.
          Changes are not saved until you click <span className="font-semibold">Save</span>.
        </p>
      </div>

      {/* ── Module Accordions — driven entirely by permissionsConfig.ts ── */}
      <div className="space-y-3">
        {MODULES.map((module, moduleIndex) => (
          <ModuleAccordion
            key={module.key}
            module={module}
            moduleIndex={moduleIndex}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
          />
        ))}
      </div>

      {/* ── Sticky Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-100 shadow-lg">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-500 min-w-0 flex items-center gap-2">
            <span className="font-bold text-blue-600">{totalSelected}</span>
            <span>permission{totalSelected !== 1 ? 's' : ''} selected for</span>
            <span className="font-semibold text-slate-700 truncate">{group.name}</span>
            {isDirty && <span className="text-xs text-amber-600 font-semibold ml-1">● Unsaved</span>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => router.push(`/dashboard/staff/groups/${groupId}`)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            {isDirty && (
              <button onClick={() => setSelected(new Set(original))}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                Reset
              </button>
            )}
            <button onClick={handleSave} disabled={isSaving || !isDirty}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                : <><Save className="h-4 w-4" /> Save {totalSelected} Permissions</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}