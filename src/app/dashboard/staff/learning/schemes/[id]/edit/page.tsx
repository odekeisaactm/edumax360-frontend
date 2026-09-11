'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { schemeOfWorkAPI, academicAPI } from '@/lib/api';
import {
  Save, Send, X, Check, AlertCircle, Loader2, ChevronLeft,
  BookOpen, Calendar, Plus, Trash2, Info
} from 'lucide-react';

interface TeachingScopeItem {
  class_config_id: number;
  class_name: string;
  section_name: string | null;
  school_section_id: number | null;
  school_section_name: string;
  subjects: { id: number; name: string; code: string }[];
}

interface WeekForm {
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  topic: string;
  sub_topics: string[];
  planned_objectives: string;
  planned_activities: string;
  reference_materials: string;
  is_holiday_or_break: boolean;
}

const DEFAULT_WEEK = (n: number): WeekForm => ({
  week_number: n,
  week_start_date: '',
  week_end_date: '',
  topic: '',
  sub_topics: [''],
  planned_objectives: '',
  planned_activities: '',
  reference_materials: '',
  is_holiday_or_break: false,
});

const iso = (d: Date) => d.toISOString().split('T')[0];
const addDays = (dateStr: string, days: number): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return iso(d);
};

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${t.type === 'warn' ? 'text-amber-500' : 'text-red-500'}`} />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function EditSchemePage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { user } = useAuth();

  const [form, setForm] = useState({
    title: '',
    subject_id: '',
    class_name: '',
    class_config_ids: [] as number[],
  });
  const [titleManual, setTitleManual] = useState<string | null>(null);
  const [weeks, setWeeks] = useState<WeekForm[]>([DEFAULT_WEEK(1)]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Scheme meta carried into the editor (not editable here)
  const [schemeMeta, setSchemeMeta] = useState<{
    session_name: string;
    term_name: string;
    session_id: number;
    term_id: number;
    decline_reason: string | null;
    declined_at: string | null;
    status: string;
  } | null>(null);

  const [scope, setScope] = useState<TeachingScopeItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const toastId = ++_toastId;
    setToasts(prev => [...prev, { id: toastId, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), 4500);
  };
  const dismissToast = (toastId: number) => setToasts(prev => prev.filter(t => t.id !== toastId));

  // ── Load scheme + scope ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [scheme, scopeRes] = await Promise.all([
          schemeOfWorkAPI.get(Number(id)),
          academicAPI.getMyTeachingScope().catch(() => ({ scope: [] })),
        ]);

        const scopeList: TeachingScopeItem[] = scopeRes?.scope || [];
        setScope(scopeList);

        // Resolve class_name from the scheme's class_configuration ids
        const schemeConfigIds: number[] = (scheme.class_configurations_detail || []).map((c: any) => c.id);

        let detectedClassName = '';
        for (const item of scopeList) {
          if (schemeConfigIds.includes(item.class_config_id)) {
            detectedClassName = item.class_name;
            break;
          }
        }

        // Prefill form
        const prefTitle = scheme.title || '';
        setForm({
          title: prefTitle,
          subject_id: String(scheme.subject_id ?? scheme.subject?.id ?? ''),
          class_name: detectedClassName,
          class_config_ids: schemeConfigIds,
        });
        setTitleManual(prefTitle);

        // Prefill weeks
        const prefWeeks: WeekForm[] = (scheme.weeks || []).map((w: any) => ({
          week_number: w.week_number,
          week_start_date: w.week_start_date || '',
          week_end_date: w.week_end_date || '',
          topic: w.topic || '',
          sub_topics: Array.isArray(w.sub_topics) && w.sub_topics.length > 0 ? w.sub_topics : [''],
          planned_objectives: w.planned_objectives || '',
          planned_activities: w.planned_activities || '',
          reference_materials: w.reference_materials || '',
          is_holiday_or_break: !!w.is_holiday_or_break,
        }));
        setWeeks(prefWeeks.length > 0 ? prefWeeks : [DEFAULT_WEEK(1)]);

        setSchemeMeta({
          session_name: (scheme as any).session_name || String(scheme.session),
          term_name: (scheme as any).term_name || String(scheme.term),
          session_id: scheme.session,
          term_id: scheme.term,
          decline_reason: scheme.decline_reason || null,
          declined_at: scheme.declined_at || null,
          status: scheme.status,
        });

        setInitialized(true);
      } catch (err: any) {
        setLoadError(err?.response?.data?.message || 'Failed to load scheme.');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  // ── Derived scope ────────────────────────────────────────────────
  const classNames = useMemo(
    () => Array.from(new Set(scope.map(s => s.class_name))).sort(),
    [scope]
  );

  const sectionsForClass = useMemo(
    () => scope.filter(s => s.class_name === form.class_name),
    [scope, form.class_name]
  );

  const availableSubjects = useMemo(() => {
    if (form.class_config_ids.length === 0) return [];
    const map = new Map<number, { id: number; name: string; code: string }>();
    sectionsForClass
      .filter(s => form.class_config_ids.includes(s.class_config_id))
      .forEach(s => s.subjects.forEach(sub => map.set(sub.id, sub)));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sectionsForClass, form.class_config_ids]);

  const selectedSubjectName = useMemo(() => {
    const s = availableSubjects.find(x => String(x.id) === form.subject_id);
    return s?.name || '';
  }, [availableSubjects, form.subject_id]);

  const sessionLabel = schemeMeta?.session_name || '';
  const termLabel = schemeMeta?.term_name || '';

  // ── Auto title (only when titleManual is null) ───────────────────
  useEffect(() => {
    if (!initialized) return;
    if (titleManual !== null) return;
    if (!form.class_name || !selectedSubjectName || !sessionLabel || !termLabel) {
      setForm(prev => (prev.title === '' ? prev : { ...prev, title: '' }));
      return;
    }
    const auto = `${sessionLabel} - ${termLabel} ${selectedSubjectName} for ${form.class_name}`;
    setForm(prev => (prev.title === auto ? prev : { ...prev, title: auto }));
  }, [initialized, titleManual, form.class_name, selectedSubjectName, sessionLabel, termLabel]);

  const handleTitleChange = (value: string) => {
    if (value === '') {
      setTitleManual(null);
      if (form.class_name && selectedSubjectName && sessionLabel && termLabel) {
        setForm(prev => ({
          ...prev,
          title: `${sessionLabel} - ${termLabel} ${selectedSubjectName} for ${form.class_name}`,
        }));
      } else {
        setForm(prev => ({ ...prev, title: '' }));
      }
    } else {
      setTitleManual(value);
      setForm(prev => ({ ...prev, title: value }));
    }
  };

  // ── Class / section handlers ─────────────────────────────────────
  const handleClassChange = (className: string) => {
    const ids = scope
      .filter(s => s.class_name === className)
      .map(s => s.class_config_id);
    setForm(prev => ({
      ...prev,
      class_name: className,
      class_config_ids: ids,
      subject_id: '',
    }));
  };

  const toggleSection = (configId: number) => {
    setForm(prev => {
      const next = prev.class_config_ids.includes(configId)
        ? prev.class_config_ids.filter(id => id !== configId)
        : [...prev.class_config_ids, configId];
      return { ...prev, class_config_ids: next };
    });
  };

  // ── Week management ──────────────────────────────────────────────
  const addWeek = () => {
    setWeeks(prev => {
      const nextNum = prev.length > 0 ? prev[prev.length - 1].week_number + 1 : 1;
      const last = prev[prev.length - 1];
      let start = '';
      if (last?.week_end_date) {
        start = addDays(last.week_end_date, 1);
      }
      const end = start ? addDays(start, 6) : '';
      return [...prev, { ...DEFAULT_WEEK(nextNum), week_start_date: start, week_end_date: end }];
    });
  };

  const removeWeek = (index: number) => {
    setWeeks(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((w, i) => ({ ...w, week_number: i + 1 }));
    });
  };

  const updateWeek = (index: number, field: keyof WeekForm, value: any) => {
    setWeeks(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleWeekStartChange = (index: number, startDate: string) => {
    setWeeks(prev => {
      const next = [...prev];
      const end = startDate ? addDays(startDate, 6) : '';
      next[index] = { ...next[index], week_start_date: startDate, week_end_date: end };
      return next;
    });
  };

  const updateSubTopic = (weekIndex: number, subIndex: number, value: string) => {
    setWeeks(prev => {
      const next = [...prev];
      const subs = [...next[weekIndex].sub_topics];
      subs[subIndex] = value;
      next[weekIndex] = { ...next[weekIndex], sub_topics: subs };
      return next;
    });
  };

  const addSubTopic = (weekIndex: number) => {
    setWeeks(prev => {
      const next = [...prev];
      next[weekIndex] = { ...next[weekIndex], sub_topics: [...next[weekIndex].sub_topics, ''] };
      return next;
    });
  };

  const removeSubTopic = (weekIndex: number, subIndex: number) => {
    setWeeks(prev => {
      const next = [...prev];
      const subs = next[weekIndex].sub_topics.filter((_, i) => i !== subIndex);
      next[weekIndex] = { ...next[weekIndex], sub_topics: subs.length ? subs : [''] };
      return next;
    });
  };

  // ── Save ─────────────────────────────────────────────────────────
  const handleSave = async (andSubmit = false) => {
    setSaveError(null);

    if (!form.class_name) return setSaveError('Class is required.');
    if (form.class_config_ids.length === 0) return setSaveError('Select at least one section.');
    if (!form.subject_id) return setSaveError('Subject is required.');
    if (!form.title.trim()) return setSaveError('Title is required.');
    if (!schemeMeta) return setSaveError('Scheme metadata missing.');
    if (weeks.length === 0) return setSaveError('At least one week must be planned.');

    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      if (!w.topic.trim()) return setSaveError(`Week ${w.week_number}: Topic is required.`);
    }

    setIsSaving(true);
    try {
      const payload = {
        title: form.title,
        subject_id: Number(form.subject_id),
        class_configuration_ids: form.class_config_ids,
        session: schemeMeta.session_id,
        term: schemeMeta.term_id,
        weeks_data: weeks.map(w => ({
          week_number: w.week_number,
          week_start_date: w.week_start_date || null,
          week_end_date: w.week_end_date || null,
          topic: w.topic,
          sub_topics: w.sub_topics.filter(s => s.trim()),
          planned_objectives: w.planned_objectives || '',
          planned_activities: w.planned_activities || '',
          reference_materials: w.reference_materials || '',
          is_holiday_or_break: w.is_holiday_or_break,
        })),
      };

      await schemeOfWorkAPI.update(Number(id), payload as any);

      if (andSubmit) {
        await schemeOfWorkAPI.submit(Number(id));
      }

      showToast('success', andSubmit ? 'Scheme updated and submitted.' : 'Changes saved.');
      router.push(`/dashboard/staff/learning/schemes/${id}`);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === 'object' && !data.message) {
        let msg = '';
        if (data.weeks_data && Array.isArray(data.weeks_data)) {
          data.weeks_data.forEach((weekErr: any, idx: number) => {
            if (weekErr && typeof weekErr === 'object') {
              Object.entries(weekErr).forEach(([k, v]) => {
                msg += `Week ${idx + 1} - ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}\n`;
              });
            }
          });
        }
        Object.entries(data).forEach(([key, value]) => {
          if (key !== 'weeks_data') {
            msg += `${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : String(value)}\n`;
          }
        });
        setSaveError(msg.trim() || 'Failed to save scheme.');
      } else {
        setSaveError(data?.message || err?.message || 'Failed to save scheme.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  if (loadError) return (
    <div className="max-w-lg mx-auto mt-20 text-center bg-white rounded-2xl border border-red-100 shadow-sm p-10">
      <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-4" />
      <h2 className="text-lg font-bold text-slate-800 mb-1">Failed to load scheme</h2>
      <p className="text-sm text-slate-500">{loadError}</p>
      <button onClick={() => router.back()} className="mt-5 text-sm text-blue-600 font-medium hover:underline">
        Go back
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-32">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Edit Scheme of Work
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Update the plan and resubmit for approval</p>
        </div>
      </div>

      {/* Previously declined banner */}
      {schemeMeta?.decline_reason && (schemeMeta.status === 'draft' || schemeMeta.status === 'declined') && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-orange-800">
              Previously declined
              {schemeMeta.declined_at && ` — ${new Date(schemeMeta.declined_at).toLocaleDateString()}`}
            </h4>
            <p className="text-sm text-orange-700 mt-1 whitespace-pre-line">{schemeMeta.decline_reason}</p>
          </div>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium whitespace-pre-line flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Class <span className="text-red-400 normal-case">*</span></label>
            <select value={form.class_name} onChange={e => handleClassChange(e.target.value)} className={inputCls}>
              <option value="">Select Class</option>
              {classNames.map(cn => <option key={cn} value={cn}>{cn}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Subject <span className="text-red-400 normal-case">*</span></label>
            <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })}
              disabled={!form.class_name || availableSubjects.length === 0} className={inputCls}>
              <option value="">
                {!form.class_name ? 'Select class first'
                  : availableSubjects.length === 0 ? 'No subjects available'
                  : 'Select Subject'}
              </option>
              {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {form.class_name && sectionsForClass.length > 0 && (
          <div>
            <label className={labelCls}>Sections / Arms <span className="text-red-400 normal-case">*</span></label>
            <div className="flex flex-wrap gap-2 mt-1">
              {sectionsForClass.map(sec => {
                const checked = form.class_config_ids.includes(sec.class_config_id);
                return (
                  <button key={sec.class_config_id} type="button" onClick={() => toggleSection(sec.class_config_id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      checked
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                    }`}>
                    {sec.section_name || 'Main'}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-2">All sections are prechecked. Click to remove.</p>
          </div>
        )}

        <div>
          <label className={labelCls}>
            Scheme Title <span className="text-red-400 normal-case">*</span>
            {titleManual === null && form.title && (
              <span className="ml-2 text-[10px] font-normal text-blue-500 normal-case">auto</span>
            )}
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Type a title or clear to auto-fill"
            className={inputCls}
          />
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
          <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600">
            <p className="font-semibold text-slate-700">{sessionLabel} · {termLabel}</p>
            <p className="mt-0.5">Session and term are fixed for this scheme.</p>
          </div>
        </div>
      </div>

      {/* Weeks */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" /> Weekly Breakdown
        </h3>

        {weeks.map((week, index) => (
          <div key={index} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
            <div className="bg-slate-50/80 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="font-bold text-slate-700">Week</h4>
                <input type="number" min={1} value={week.week_number}
                  onChange={e => updateWeek(index, 'week_number', Number(e.target.value))}
                  className="w-16 px-2 py-1 text-sm font-bold text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => updateWeek(index, 'is_holiday_or_break', !week.is_holiday_or_break)}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${week.is_holiday_or_break ? 'bg-amber-500 border-amber-500' : 'border-slate-300'}`}>
                    {week.is_holiday_or_break && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 select-none">Non-teaching week</span>
                </label>
                {weeks.length > 1 && (
                  <button onClick={() => removeWeek(index)}
                    className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove Week">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-5">
              {week.is_holiday_or_break ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-3">
                    <label className={labelCls}>Label <span className="text-red-400 normal-case">*</span></label>
                    <input type="text" value={week.topic} onChange={e => updateWeek(index, 'topic', e.target.value)}
                      placeholder="e.g. Mid-term break, Public holiday"
                      className={`${inputCls} border-amber-200 bg-amber-50/30 focus:ring-amber-500`} />
                  </div>
                  <div>
                    <label className={labelCls}>Start Date</label>
                    <input type="date" value={week.week_start_date}
                      onChange={e => handleWeekStartChange(index, e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>End Date</label>
                    <input type="date" value={week.week_end_date} onChange={e => updateWeek(index, 'week_end_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Topic <span className="text-red-400 normal-case">*</span></label>
                      <input type="text" value={week.topic} onChange={e => updateWeek(index, 'topic', e.target.value)}
                        placeholder="Main topic for this week" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Start Date</label>
                      <input type="date" value={week.week_start_date}
                        onChange={e => handleWeekStartChange(index, e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>End Date</label>
                      <input type="date" value={week.week_end_date} onChange={e => updateWeek(index, 'week_end_date', e.target.value)} className={inputCls} />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Sub-topics</label>
                    <div className="space-y-2">
                      {week.sub_topics.map((st, si) => (
                        <div key={si} className="flex items-center gap-2">
                          <input type="text" value={st} onChange={e => updateSubTopic(index, si, e.target.value)}
                            placeholder={`Sub-topic ${si + 1}`} className={inputCls} />
                          <button onClick={() => removeSubTopic(index, si)} type="button"
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addSubTopic(index)} type="button"
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <Plus className="h-3.5 w-3.5" /> Add sub-topic
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Learning Objectives</label>
                      <textarea value={week.planned_objectives} onChange={e => updateWeek(index, 'planned_objectives', e.target.value)}
                        placeholder="What students should know by the end of the week..." rows={2}
                        className={`${inputCls} resize-none`} />
                    </div>
                    <div>
                      <label className={labelCls}>Planned Activities</label>
                      <textarea value={week.planned_activities} onChange={e => updateWeek(index, 'planned_activities', e.target.value)}
                        placeholder="Teacher and student activities..." rows={2}
                        className={`${inputCls} resize-none`} />
                    </div>
                    <div>
                      <label className={labelCls}>Reference Materials</label>
                      <textarea value={week.reference_materials} onChange={e => updateWeek(index, 'reference_materials', e.target.value)}
                        placeholder="Textbooks, URLs, etc." rows={2}
                        className={`${inputCls} resize-none`} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        <button onClick={addWeek} type="button"
          className="w-full py-4 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500 font-semibold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
          <Plus className="h-5 w-5" /> Add Another Week
        </button>
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.04)] print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 hidden sm:block">
            {weeks.length} week{weeks.length !== 1 ? 's' : ''} planned
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => handleSave(false)} disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
            </button>
            <button onClick={() => handleSave(true)} disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md disabled:opacity-50">
              <Send className="h-4 w-4" /> Save & Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}