'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, academicAPI } from '@/lib/api';
import { FeeStructure, Fee, FeeGroup, ClassModel, ClassSection } from '@/lib/types';
import {
  Layers, Plus, Edit2, Trash2, Check, X, AlertCircle,
  Loader2, Search, ChevronDown, ChevronUp, ArrowLeft,
  Settings, Users, BookOpen, Info, AlertTriangle,
  LayoutGrid, LayoutList,
} from 'lucide-react';

// ─── Shared style constants ───────────────────────────────────────────────────

const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';
const inputCls = 'w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 bg-white transition-all';

const fmt = (v: string | number = 0) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractError(err: any): string {
  if (!err) return 'An unknown error occurred';
  if (err.response?.data) {
    const d = err.response.data;
    if (typeof d === 'string') return d;
    if (d.detail) return d.detail;
    if (d.message) return d.message;
    const entries = Object.entries(d);
    if (entries.length) {
      return entries
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n');
    }
  }
  return err.message || 'An error occurred';
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border pointer-events-auto
            ${t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-900'
              : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span className="text-sm font-medium whitespace-pre-line">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="ml-1 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const show = (type: Toast['type'], message: string) => {
    const id = ++counter.current;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };
  const remove = (id: number) => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, showToast: show, removeToast: remove };
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
        ${checked ? 'bg-emerald-600' : 'bg-slate-200'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, children }: {
  icon: React.ReactNode; title: string; children?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
      <h2 className="font-bold text-slate-800 flex items-center gap-2.5 text-sm uppercase tracking-wide">
        <span className="text-emerald-500">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FeeStructuresPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const { toasts, showToast, removeToast } = useToasts();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [loading, setLoading] = useState(true);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [groups, setGroups] = useState<FeeGroup[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'create' | { mode: 'edit'; structure: FeeStructure }>('list');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedFee, setSelectedFee] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sData, fData, gData, cData, secData] = await Promise.all([
        feeAPI.getFeeStructures(),
        feeAPI.getFees(),
        feeAPI.getFeeGroups(),
        academicAPI.listClasses({ is_active: true }),
        academicAPI.listClassSections(),
      ]);
      setStructures(sData);
      setFees(fData);
      setGroups(gData);
      setClasses(cData);
      setSections(secData);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof view === 'object' && view.mode === 'edit') {
      const s = view.structure;
      setSelectedFee(s.fee?.toString() || '');
      setSelectedGroup(s.group?.toString() || '');
      setSelectedClasses(s.student_classes || []);
      setSelectedSections(s.class_sections || []);
      setIsActive(s.is_active);
    } else {
      setSelectedFee('');
      setSelectedGroup('');
      setSelectedClasses([]);
      setSelectedSections([]);
      setIsActive(true);
    }
  }, [view]);

  const toggleClass = (id: number) =>
    setSelectedClasses(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);

  const toggleSection = (id: number) =>
    setSelectedSections(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);

  const handleSubmit = async () => {
    if (!selectedFee || !selectedGroup) {
      showToast('error', 'Please select both a Fee blueprint and a Fee Group');
      return;
    }
    if (selectedClasses.length === 0 && selectedSections.length === 0) {
      showToast('error', 'Select at least one Class or Class Section to target');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fee: parseInt(selectedFee),
        group: parseInt(selectedGroup),
        student_classes: selectedClasses,
        class_sections: selectedSections,
        is_active: isActive,
      };

      if (typeof view === 'object' && view.mode === 'edit') {
        const updated = await feeAPI.updateFeeStructure(view.structure.id, payload);
        setStructures(prev => prev.map(s => s.id === updated.id ? updated : s));
        showToast('success', 'Fee structure updated successfully');
        setView('list');
      } else {
        const created = await feeAPI.createFeeStructure(payload);
        showToast('success', 'Fee structure created! Now set the period amounts.');
        router.push(`/dashboard/staff/fee/fee-structures/${created.id}?new=true`);
        return;
      }
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── LIST VIEW ──────────────────────────────────────────────────────────────
  
  if (view === 'list') {
    const filtered = structures.filter(s => {
      if (!search) return true;
      const fName = fees.find(f => f.id === s.fee)?.name?.toLowerCase() || '';
      const gName = groups.find(g => g.id === s.group)?.name?.toLowerCase() || '';
      return fName.includes(search.toLowerCase()) || gName.includes(search.toLowerCase());
    });

    return (
      <div className="space-y-6 pb-12">
        <ToastStack toasts={toasts} onRemove={removeToast} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-100">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">Fee Master</h1>
              <p className="text-sm text-slate-400 font-medium">Link fees to classes and arms for automated billing</p>
            </div>
          </div>
          {canManage && (
            <button onClick={() => setView('create')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-sm font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-emerald-100 active:scale-95">
              <Plus className="h-5 w-5" /> Create Structure
            </button>
          )}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search structures by fee name or group..."
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-50 focus:border-emerald-500 transition-all shadow-sm outline-none font-medium" />
          </div>
          <button onClick={load} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm active:scale-95">
            <Loader2 className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-[32px] border border-slate-100 p-24 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
            <p className="text-slate-400 font-medium italic">Syncing with fee master database...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-[32px] border border-slate-100 p-20 flex flex-col items-center gap-4 text-center shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-200">
              <Layers className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-700">{search ? 'No matches found' : 'No fee structures found'}</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              {search ? 'Try a different keyword.' : 'Begin by configuring which fee blueprints apply to which academic levels.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map(s => {
              const fee = fees.find(f => f.id === s.fee);
              const group = groups.find(g => g.id === s.group);
              
              return (
                <div key={s.id} className={`group bg-white rounded-[24px] border transition-all duration-300 shadow-sm hover:shadow-xl hover:translate-y-[-2px]
                  ${s.is_active ? 'border-slate-100 hover:border-emerald-200' : 'border-slate-200 opacity-70 grayscale'}`}>
                  
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner
                          ${s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          <Layers className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 leading-tight text-base truncate max-w-[200px]">{fee?.name || 'Unknown Fee'}</h3>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">{group?.name || 'No Group'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setView({ mode: 'edit', structure: s })}
                           className="p-2.5 text-amber-500 hover:bg-amber-50 rounded-xl transition-all active:scale-90" title="Edit Configuration">
                           <Edit2 className="h-4.5 w-4.5" />
                         </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-tight text-slate-400 border-b border-slate-50 pb-2">
                        <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> Target Coverage</span>
                        <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {s.student_classes?.length || 0} Classes
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap gap-1.5 h-14 overflow-y-auto no-scrollbar content-start">
                        {s.student_classes?.map(cid => {
                          const name = classes.find(c => c.id === cid)?.name;
                          return (
                            <span key={cid} className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-600 uppercase">
                              {name || `#${cid}`}
                            </span>
                          );
                        })}
                        {s.class_sections?.map(sid => {
                          const name = sections.find(sc => sc.id === sid)?.name;
                          return (
                            <span key={`sec-${sid}`} className="px-2.5 py-1 bg-teal-50 border border-teal-100 rounded-lg text-[10px] font-bold text-teal-600 uppercase">
                              {name || `Arm-${sid}`}
                            </span>
                          );
                        })}
                        {(!s.student_classes?.length && !s.class_sections?.length) && (
                          <span className="text-[11px] italic text-slate-300">No classes/arms assigned</span>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border shadow-sm
                             ${s.is_active ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                             {s.is_active ? 'Active' : 'Disabled'}
                           </span>
                         </div>
                         <button onClick={() => router.push(`/dashboard/staff/fee/fee-structures/${s.id}`)}
                           className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition-all flex items-center gap-2 uppercase tracking-widest shadow-sm active:scale-95">
                           Configure Prices <Plus className="h-3 w-3" />
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── CREATE / EDIT VIEW ─────────────────────────────────────────────────────

  const isEdit = typeof view === 'object' && view.mode === 'edit';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <ToastStack toasts={toasts} onRemove={removeToast} />
      
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => setView('list')}
          className="p-3 text-slate-400 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all shadow-hover active:scale-90">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-100">
          <Layers className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{isEdit ? 'Update' : 'Setup New'} Fee Structure</h1>
          <p className="text-sm text-slate-500">Define which student categories will be billed for this fee</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
            <SectionHeader icon={<Settings className="h-4 w-4" />} title="Base Configuration" />
            <div className="p-6 space-y-6">
              <div>
                <label className={labelCls}>Fee Blueprint <span className="text-red-400">*</span></label>
                <select value={selectedFee} onChange={e => setSelectedFee(e.target.value)} className={inputCls}>
                  <option value="">Choose fee type...</option>
                  {fees.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-2 italic px-1">Defines the name, code and occurrence logic</p>
              </div>

              <div>
                <label className={labelCls}>Financial Group <span className="text-red-400">*</span></label>
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className={inputCls}>
                  <option value="">Choose group...</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 mt-2 italic px-1">Used for accounting and dashboard categorization</p>
              </div>

              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-800">Status</p>
                  <p className="text-[11px] text-slate-400 font-medium">Toggle active structure</p>
                </div>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-indigo-50/50 rounded-[28px] border border-indigo-100/50 p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
               <Info className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-indigo-900 mb-1">Creation Flow</h4>
              <p className="text-[11px] text-indigo-700/80 leading-relaxed">
                After creating the structure, you will be redirected to the <strong>Pricing Dashboard</strong> where you will set the amounts for each academic period.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-select */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Classes Selection */}
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
            <SectionHeader icon={<Users className="h-4 w-4" />} title="Applicable Classes">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelectedClasses(classes.map(c => c.id))}
                  className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg hover:bg-emerald-600 hover:text-white transition-all uppercase tracking-wider">
                  Select All
                </button>
                <button type="button" onClick={() => setSelectedClasses([])}
                  className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-lg hover:bg-slate-200 hover:text-slate-600 transition-all uppercase tracking-wider">
                  Clear
                </button>
              </div>
            </SectionHeader>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {classes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 italic gap-2 opacity-50">
                  <Users className="h-8 w-8" />
                  <p className="text-sm">No classes available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {classes.map(cls => {
                    const selected = selectedClasses.includes(cls.id);
                    return (
                      <button key={cls.id} onClick={() => toggleClass(cls.id)}
                        className={`group px-4 py-3 rounded-2xl border-2 text-xs font-bold text-left transition-all relative overflow-hidden
                          ${selected
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="truncate pr-2">{cls.name?.toUpperCase()}</span>
                          {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-emerald-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Selection Status</span>
               <span className="text-xs font-bold text-emerald-600">{selectedClasses.length} Classes Selected</span>
            </div>
          </div>

          {/* Sections Selection */}
          <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[400px]">
            <SectionHeader icon={<LayoutGrid className="h-4 w-4" />} title="Specific Arms / Sections">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setSelectedSections(sections.map(s => s.id))}
                  className="px-3 py-1 bg-teal-50 text-teal-600 text-[10px] font-bold rounded-lg hover:bg-teal-600 hover:text-white transition-all uppercase tracking-wider">
                  Select All
                </button>
                <button type="button" onClick={() => setSelectedSections([])}
                  className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] font-bold rounded-lg hover:bg-slate-200 hover:text-slate-600 transition-all uppercase tracking-wider">
                  Clear
                </button>
              </div>
            </SectionHeader>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl px-5 py-3.5 mb-6 flex items-start gap-4">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                  Selection here overrides general class billing. Use this if the fee only applies to certain arms (e.g. Science Arm only) or if you have custom billing for individual sections.
                </p>
              </div>

              {sections.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 italic gap-2 opacity-50">
                  <LayoutGrid className="h-8 w-8" />
                  <p className="text-sm">No sections defined</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sections.map(sec => {
                    const selected = selectedSections.includes(sec.id);
                    return (
                      <button key={sec.id} onClick={() => toggleSection(sec.id)}
                        className={`group px-4 py-3 rounded-2xl border-2 text-xs font-bold text-left transition-all relative overflow-hidden
                          ${selected
                            ? 'bg-teal-600 border-teal-600 text-white shadow-md'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-teal-300 hover:bg-teal-50'}`}>
                        <div className="flex items-center justify-between">
                          <span className="truncate pr-2">{sec.name}</span>
                          {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-teal-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
             <div className="px-6 py-3 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Selection Status</span>
               <span className="text-xs font-bold text-teal-600">{selectedSections.length} Sections Selected</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-4">
            <button onClick={() => setView('list')}
              className="px-8 py-3.5 bg-white border border-slate-200 rounded-[20px] font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm shadow-sm active:scale-95">
              Discard Changes
            </button>
            <button onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-10 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-extrabold rounded-[20px] shadow-xl shadow-emerald-100 hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 text-sm active:scale-95">
              {isSubmitting
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving Configuration…</>
                : <><Check className="h-5 w-5" /> {isEdit ? 'Save Changes' : 'Confirm & Set Pricing'}</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}