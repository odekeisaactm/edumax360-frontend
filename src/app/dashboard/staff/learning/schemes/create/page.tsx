'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { schemeOfWorkAPI, academicAPI, academicCalendarAPI } from '@/lib/api';
import { SchemeOfWorkList, SchemeOfWorkDetail } from '@/lib/types';
import {
  Save, Send, X, Check, AlertCircle, Loader2, ChevronLeft,
  BookOpen, Calendar, Plus, Trash2, Copy, ShieldCheck, Info
} from 'lucide-react';

// ─── Types & Defaults ─────────────────────────────────────────────────────────

interface WeekForm {
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  topic: string;
  sub_topics: string;
  planned_objectives: string;
  planned_activities: string;
  reference_materials: string;
  is_holiday_or_break: boolean;
}

interface SchemeForm {
  title: string;
  session_id: string;
  period_id: string;
  class_level_id: string;
  class_section_id: string;
  class_config_id: string;
  subject_id: string;
}

const DEFAULT_WEEK: WeekForm = {
  week_number: 1, week_start_date: '', week_end_date: '',
  topic: '', sub_topics: '', planned_objectives: '',
  planned_activities: '', reference_materials: '', is_holiday_or_break: false
};

const DEFAULT_FORM: SchemeForm = {
  title: '', session_id: '', period_id: '',
  class_level_id: '', class_section_id: '', class_config_id: '', subject_id: ''
};

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

// ─── Sub-components ────────────────────────────────────────────────────────────

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

// ─── Copy Modal ────────────────────────────────────────────────────────────────

function CopySchemeModal({
  onClose, onSelect, currentSessionId
}: {
  onClose: () => void;
  onSelect: (id: number) => void;
  currentSessionId: string;
}) {
  const [schemes, setSchemes] = useState<SchemeOfWorkList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    schemeOfWorkAPI.list({ status: 'approved' })
      .then(data => setSchemes(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async (id: number) => {
    setSaving(true);
    await onSelect(id);
    setSaving(false);
  };

  const filtered = schemes.filter(s =>
    String(s.session) !== currentSessionId && // Only show past sessions
    (s.title.toLowerCase().includes(search.toLowerCase()) || s.subject_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><Copy className="h-4 w-4" /> Copy from Previous Session</h3>
          <button onClick={onClose} disabled={saving} className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <input type="text" placeholder="Search past approved schemes..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50" />
        </div>
        <div className="overflow-y-auto p-4 flex-1">
          {loading ? (
             <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
          ) : filtered.length === 0 ? (
             <div className="text-center py-10 text-slate-500 text-sm">No past approved schemes found.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.subject_name} • {s.week_count} Weeks</p>
                  </div>
                  <button onClick={() => handleCopy(s.id)} disabled={saving}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-blue-600 text-xs font-semibold rounded-lg shadow-sm hover:bg-blue-50 transition-colors disabled:opacity-50">
                    Copy Scheme
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Builder Form ─────────────────────────────────────────────────────────

function SchemeBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const copyId = searchParams.get('copy'); // Used if navigating from List Page's Copy/Edit Draft button
  const editId = searchParams.get('edit');

  const [form, setForm] = useState<SchemeForm>(DEFAULT_FORM);
  const [weeks, setWeeks] = useState<WeekForm[]>([DEFAULT_WEEK]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // System Options
  const [options, setOptions] = useState({
    sessions: [] as any[], periods: [] as any[],
    classLevels: [] as any[], classSections: [] as any[],
    classConfigs: [] as any[], subjects: [] as any[],
  });
  const [currentSessionId, setCurrentSessionId] = useState('');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // 1. Initialize Data
  useEffect(() => {
    const init = async () => {
      try {
        const [sessions, classLevels, classSections, classConfigs, subjects, curSession, curPeriod] = await Promise.all([
          academicCalendarAPI.listSessions(),
          academicAPI.listClasses(),
          academicAPI.listClassSections(),
          academicAPI.listClassConfigurations(),
          academicAPI.listSubjects(),
          academicCalendarAPI.getCurrentSession().catch(() => null),
          academicCalendarAPI.getCurrentPeriod().catch(() => null),
        ]);

        let periods: any[] = [];
        if (curSession) {
          periods = await academicCalendarAPI.listSessionPeriods({ session_id: curSession.id });
        }

        setOptions({ sessions, periods, classLevels, classSections, classConfigs, subjects });
        const cSessId = curSession ? String(curSession.id) : '';
        setCurrentSessionId(cSessId);

        // Load existing data if Copying or Editing
        const targetId = copyId || editId;
        if (targetId) {
          await loadSchemeData(Number(targetId), !!copyId, cSessId, curPeriod ? String(curPeriod.id) : '', periods, classConfigs);
        } else {
          // Defaults for brand new
          setForm(prev => ({
            ...prev,
            session_id: cSessId,
            period_id: curPeriod ? String(curPeriod.id) : ''
          }));
        }
      } catch (err) {
        showToast('error', 'Failed to load system configurations.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [copyId, editId]);

  // Handle cascading dropdowns
  const handleSessionChange = async (sessionId: string) => {
    setForm(prev => ({ ...prev, session_id: sessionId, period_id: '' }));
    if (!sessionId) { setOptions(prev => ({ ...prev, periods: [] })); return; }
    const periods = await academicCalendarAPI.listSessionPeriods({ session_id: Number(sessionId) });
    setOptions(prev => ({ ...prev, periods }));
  };

  useEffect(() => {
    if (form.class_level_id && form.class_section_id) {
      const config = options.classConfigs.find(c =>
        String(c.student_class) === form.class_level_id &&
        String(c.class_section) === form.class_section_id
      );
      setForm(prev => ({ ...prev, class_config_id: config ? String(config.id) : '' }));
    } else {
      setForm(prev => ({ ...prev, class_config_id: '' }));
    }
  }, [form.class_level_id, form.class_section_id, options.classConfigs]);

  const filteredClassSections = form.class_level_id
    ? options.classSections.filter(s => options.classConfigs.some(c => String(c.student_class) === form.class_level_id && String(c.class_section) === String(s.id)))
    : options.classSections;

  // 2. Load Scheme Data (For Copy or Edit)
  const loadSchemeData = async (id: number, isCopy: boolean, cSessId: string, cPeriodId: string, loadedPeriods?: any[], loadedConfigs?: any[]) => {
    try {
      const data = await schemeOfWorkAPI.get(id);
      const confId = data.class_configuration_ids[0]; // Assuming 1-to-1 mapping in builder
      const configObj = (loadedConfigs || options.classConfigs).find(c => c.id === confId);

      setForm({
        title: isCopy ? `${data.title} (Copy)` : data.title,
        session_id: isCopy ? cSessId : String(data.session),
        period_id: isCopy ? cPeriodId : String(data.term),
        subject_id: String(data.subject_id),
        class_level_id: configObj ? String(configObj.student_class) : '',
        class_section_id: configObj ? String(configObj.class_section) : '',
        class_config_id: confId ? String(confId) : '',
      });

      if (!isCopy && loadedPeriods) {
        const per = await academicCalendarAPI.listSessionPeriods({ session_id: data.session });
        setOptions(prev => ({ ...prev, periods: per }));
      }

      if (data.weeks && data.weeks.length > 0) {
        setWeeks(data.weeks.map(w => ({
          week_number: w.week_number,
          week_start_date: isCopy ? '' : (w.week_start_date || ''),
          week_end_date: isCopy ? '' : (w.week_end_date || ''),
          topic: w.topic || '',
          sub_topics: w.sub_topics || '',
          planned_objectives: w.planned_objectives || '',
          planned_activities: w.planned_activities || '',
          reference_materials: w.reference_materials || '',
          is_holiday_or_break: w.is_holiday_or_break || false,
        })));
      }
      if (isCopy) setShowCopyModal(false);
    } catch (err) {
      showToast('error', 'Failed to load scheme data.');
    }
  };

  // 3. Week Array Management
  const addWeek = () => {
    setWeeks(prev => [...prev, { ...DEFAULT_WEEK, week_number: prev.length + 1 }]);
  };

  const removeWeek = (index: number) => {
    setWeeks(prev => {
      const next = prev.filter((_, i) => i !== index);
      // Re-index
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

  // 4. Save Logic
  // 4. Save Logic
  const handleSave = async (andSubmit = false) => {
    setSaveError(null);
    if (!form.title.trim()) return setSaveError('Title is required.');
    if (!form.subject_id) return setSaveError('Subject is required.');
    if (!form.class_config_id) return setSaveError('Class and Section are required.');
    if (!form.session_id || !form.period_id) return setSaveError('Session and Term are required.');
    if (weeks.length === 0) return setSaveError('At least one week must be planned.');

    // Pre-flight validation for required week fields
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      if (!w.topic.trim()) return setSaveError(`Week ${w.week_number}: Topic / Reason is required.`);
      if (!w.week_start_date) return setSaveError(`Week ${w.week_number}: Start Date is required.`);
      if (!w.week_end_date) return setSaveError(`Week ${w.week_number}: End Date is required.`);
    }

    setIsSaving(true);
    try {
      const payload = {
        title: form.title,
        subject_id: Number(form.subject_id),
        class_configuration_ids: [Number(form.class_config_id)],
        session: Number(form.session_id),
        term: Number(form.period_id),
        weeks_data: weeks.map(w => ({
          ...w,
          week_start_date: w.week_start_date || null,
          week_end_date: w.week_end_date || null,
        }))
      };

      let savedId;
      if (editId) {
        const res = await schemeOfWorkAPI.update(Number(editId), payload as any);
        savedId = res.id;
      } else {
        const res = await schemeOfWorkAPI.create(payload as any);
        savedId = res.id;
      }

      if (andSubmit) {
        await schemeOfWorkAPI.submit(savedId);
      }

      showToast('success', andSubmit ? 'Scheme saved and submitted!' : 'Scheme draft saved.');
      router.push('/dashboard/staff/learning/schemes');
    } catch (err: any) {
      // Safe Error Parsing: Convert nested backend error objects to strings so React doesn't crash
      const data = err?.response?.data;
      if (data && typeof data === 'object' && !data.message) {
        let errorString = '';

        // Extract nested week errors gracefully
        if (data.weeks_data && Array.isArray(data.weeks_data)) {
          data.weeks_data.forEach((weekErr: any, idx: number) => {
            if (weekErr && typeof weekErr === 'object') {
              Object.entries(weekErr).forEach(([k, v]) => {
                errorString += `Week ${idx + 1} - ${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}\n`;
              });
            }
          });
        }

        // Extract root level errors
        Object.entries(data).forEach(([key, value]) => {
          if (key !== 'weeks_data') {
            errorString += `${key.replace(/_/g, ' ')}: ${Array.isArray(value) ? value.join(', ') : String(value)}\n`;
          }
        });

        setSaveError(errorString.trim() || 'Failed to save scheme.');
      } else {
        setSaveError(data?.message || err?.message || 'Failed to save scheme.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white transition-colors disabled:bg-slate-50 disabled:text-slate-400";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {showCopyModal && (
        <CopySchemeModal
          onClose={() => setShowCopyModal(false)}
          onSelect={(id) => loadSchemeData(id, true, currentSessionId, form.period_id, options.periods, options.classConfigs)}
          currentSessionId={currentSessionId}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              {editId ? 'Edit Scheme Draft' : 'Create Scheme of Work'}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Plan your termly curriculum structure</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editId && (
            <button onClick={() => setShowCopyModal(true)} disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-blue-200 text-blue-700 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50">
              <Copy className="h-4 w-4" /> Copy Previous
            </button>
          )}
          <button onClick={() => handleSave(false)} disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md disabled:opacity-50">
            <Send className="h-4 w-4" /> Submit for Approval
          </button>
        </div>
      </div>

      {saveError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium whitespace-pre-line flex-1">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Metadata Panel ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        <div>
          <label className={labelCls}>Scheme Title <span className="text-red-400 normal-case">*</span></label>
          <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. JSS 1 Mathematics - First Term" className={inputCls} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Session <span className="text-red-400 normal-case">*</span></label>
            <select value={form.session_id} onChange={e => handleSessionChange(e.target.value)} className={inputCls}>
              <option value="">Select Session</option>
              {options.sessions.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Term <span className="text-red-400 normal-case">*</span></label>
            <select value={form.period_id} onChange={e => setForm({ ...form, period_id: e.target.value })} disabled={!form.session_id} className={inputCls}>
              <option value="">Select Term</option>
              {options.periods.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Class Group <span className="text-red-400 normal-case">*</span></label>
            <select value={form.class_level_id} onChange={e => setForm({ ...form, class_level_id: e.target.value, class_section_id: '' })} className={inputCls}>
              <option value="">Select Class</option>
              {options.classLevels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Class Section <span className="text-red-400 normal-case">*</span></label>
            <select value={form.class_section_id} onChange={e => setForm({ ...form, class_section_id: e.target.value })} disabled={!form.class_level_id || filteredClassSections.length === 0} className={inputCls}>
              <option value="">{!form.class_level_id ? 'Select class first' : 'Select section'}</option>
              {filteredClassSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>Subject <span className="text-red-400 normal-case">*</span></label>
          <select value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} className={inputCls}>
            <option value="">Select Subject</option>
            {options.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Weeks Builder ── */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" /> Weekly Breakdown
        </h3>

        {weeks.map((week, index) => (
          <div key={index} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group">
            {/* Week Header */}
            <div className="bg-slate-50/80 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
              <h4 className="font-bold text-slate-700">Week {week.week_number}</h4>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${week.is_holiday_or_break ? 'bg-amber-500 border-amber-500' : 'border-slate-300'}`}>
                    {week.is_holiday_or_break && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 select-none">Holiday / Break</span>
                </label>
                {weeks.length > 1 && (
                  <button onClick={() => removeWeek(index)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove Week">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Week Content */}
            <div className="p-5">
              {week.is_holiday_or_break ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelCls}>Reason / Label <span className="text-red-400 normal-case">*</span></label>
                    <input type="text" value={week.topic} onChange={e => updateWeek(index, 'topic', e.target.value)}
                      placeholder="e.g. Mid-term Break" className={`${inputCls} border-amber-200 bg-amber-50/30 focus:ring-amber-500`} />
                  </div>
                  <div>
                    <label className={labelCls}>Start Date</label>
                    <input type="date" value={week.week_start_date} onChange={e => updateWeek(index, 'week_start_date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>End Date</label>
                    <input type="date" value={week.week_end_date} onChange={e => updateWeek(index, 'week_end_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Topic <span className="text-red-400 normal-case">*</span></label>
                      <input type="text" value={week.topic} onChange={e => updateWeek(index, 'topic', e.target.value)}
                        placeholder="Main topic for this week" className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Sub-Topics</label>
                      <input type="text" value={week.sub_topics} onChange={e => updateWeek(index, 'sub_topics', e.target.value)}
                        placeholder="Comma separated sub-topics" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Start Date</label>
                      <input type="date" value={week.week_start_date} onChange={e => updateWeek(index, 'week_start_date', e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>End Date</label>
                      <input type="date" value={week.week_end_date} onChange={e => updateWeek(index, 'week_end_date', e.target.value)} className={inputCls} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Learning Objectives</label>
                      <textarea value={week.planned_objectives} onChange={e => updateWeek(index, 'planned_objectives', e.target.value)}
                        placeholder="What students should know by the end of the week..." rows={2} className={`${inputCls} resize-none`} />
                    </div>
                    <div>
                      <label className={labelCls}>Planned Activities</label>
                      <textarea value={week.planned_activities} onChange={e => updateWeek(index, 'planned_activities', e.target.value)}
                        placeholder="Teacher and student activities..." rows={2} className={`${inputCls} resize-none`} />
                    </div>
                    <div>
                      <label className={labelCls}>Reference Materials</label>
                      <textarea value={week.reference_materials} onChange={e => updateWeek(index, 'reference_materials', e.target.value)}
                        placeholder="Textbooks, URLs, etc." rows={2} className={`${inputCls} resize-none`} />
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

    </div>
  );
}

// Suspense Wrapper required by Next.js when using useSearchParams()
export default function SchemeOfWorkCreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
      <SchemeBuilderContent />
    </Suspense>
  );
}