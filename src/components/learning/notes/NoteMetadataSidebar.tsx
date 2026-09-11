'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { schemeWeeksAPI } from '@/lib/api';

interface TeachingScopeItem {
  class_config_id: number;
  class_name: string;
  section_name: string | null;
  subjects: { id: number; name: string; code: string }[];
}

interface SchemeWeekOption {
  id: number;
  week_number: number;
  topic: string;
  scheme_title: string;
  week_start_date: string;
}

export interface NoteMetadata {
  title: string;
  topic: string;
  learning_objectives: string;
  instructional_materials: string;
  subject_id: string;
  class_name: string;
  class_config_ids: number[];
  scheduled_date: string;
  scheduled_time: string;
  scheme_week_id: number | null;
}

interface Props {
  value: NoteMetadata;
  onChange: (next: NoteMetadata) => void;
  scope: TeachingScopeItem[];
  currentSession: any;
  currentTerm: any;
  autoTitleEnabled: boolean;
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

export default function NoteMetadataSidebar({
  value, onChange, scope, currentSession, currentTerm, autoTitleEnabled,
}: Props) {
  const [schemeWeeks, setSchemeWeeks] = useState<SchemeWeekOption[]>([]);

  const classNames = useMemo(
    () => Array.from(new Set(scope.map(s => s.class_name))).sort(),
    [scope]
  );

  const sectionsForClass = useMemo(
    () => scope.filter(s => s.class_name === value.class_name),
    [scope, value.class_name]
  );

  const availableSubjects = useMemo(() => {
    if (value.class_config_ids.length === 0) return [];
    const map = new Map<number, { id: number; name: string; code: string }>();
    sectionsForClass
      .filter(s => value.class_config_ids.includes(s.class_config_id))
      .forEach(s => s.subjects.forEach(sub => map.set(sub.id, sub)));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sectionsForClass, value.class_config_ids]);

  // Fetch available scheme weeks whenever subject/session/term/class change
  useEffect(() => {
    if (!value.subject_id || !value.class_config_ids.length || !currentSession || !currentTerm) {
      setSchemeWeeks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const weeks = await schemeWeeksAPI.availableForNote({
          subject: Number(value.subject_id),
          session: currentSession.id,
          term: currentTerm.id,
          class_config: value.class_config_ids[0],
        });
        if (!cancelled) setSchemeWeeks(weeks || []);
      } catch { if (!cancelled) setSchemeWeeks([]); }
    })();
    return () => { cancelled = true; };
  }, [value.subject_id, value.class_config_ids, currentSession, currentTerm]);

  const setField = <K extends keyof NoteMetadata>(k: K, v: NoteMetadata[K]) =>
    onChange({ ...value, [k]: v });

  const handleClassChange = (className: string) => {
    const ids = scope.filter(s => s.class_name === className).map(s => s.class_config_id);
    onChange({ ...value, class_name: className, class_config_ids: ids, subject_id: '', scheme_week_id: null });
  };

  const toggleSection = (configId: number) => {
    const next = value.class_config_ids.includes(configId)
      ? value.class_config_ids.filter(id => id !== configId)
      : [...value.class_config_ids, configId];
    onChange({ ...value, class_config_ids: next, scheme_week_id: null });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assignment</p>

        <div>
          <label className={labelCls}>Class <span className="text-red-400 normal-case">*</span></label>
          <select value={value.class_name} onChange={e => handleClassChange(e.target.value)} className={inputCls}>
            <option value="">Select Class</option>
            {classNames.map(cn => <option key={cn} value={cn}>{cn}</option>)}
          </select>
        </div>

        {value.class_name && sectionsForClass.length > 0 && (
          <div>
            <label className={labelCls}>Sections <span className="text-red-400 normal-case">*</span></label>
            <div className="flex flex-wrap gap-1.5">
              {sectionsForClass.map(sec => {
                const checked = value.class_config_ids.includes(sec.class_config_id);
                return (
                  <button key={sec.class_config_id} type="button" onClick={() => toggleSection(sec.class_config_id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      checked ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                    }`}>
                    {sec.section_name || 'Main'}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className={labelCls}>Subject <span className="text-red-400 normal-case">*</span></label>
          <select value={value.subject_id}
            onChange={e => setField('subject_id', e.target.value)}
            disabled={!value.class_name || availableSubjects.length === 0}
            className={inputCls}>
            <option value="">
              {!value.class_name ? 'Select class first'
                : availableSubjects.length === 0 ? 'No subjects available'
                : 'Select Subject'}
            </option>
            {availableSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>
            Title <span className="text-red-400 normal-case">*</span>
            {autoTitleEnabled && value.title && (
              <span className="ml-2 text-[10px] font-normal text-emerald-500 normal-case">auto</span>
            )}
          </label>
          <input type="text" value={value.title}
            onChange={e => setField('title', e.target.value)}
            placeholder="Type a title or leave for auto-fill"
            className={inputCls} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Curriculum</p>

        <div>
          <label className={labelCls}>Topic</label>
          <input type="text" value={value.topic}
            onChange={e => setField('topic', e.target.value)}
            placeholder="Curriculum topic" className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Learning Objectives</label>
          <textarea value={value.learning_objectives}
            onChange={e => setField('learning_objectives', e.target.value)}
            rows={3} placeholder="What students should learn..."
            className={inputCls + ' resize-none'} />
        </div>

        <div>
          <label className={labelCls}>Instructional Materials</label>
          <textarea value={value.instructional_materials}
            onChange={e => setField('instructional_materials', e.target.value)}
            rows={2} placeholder="Tools needed (chart, calculator, etc.)"
            className={inputCls + ' resize-none'} />
        </div>

        {schemeWeeks.length > 0 && (
          <div>
            <label className={labelCls}>Link to Scheme Week</label>
            <select
              value={value.scheme_week_id ?? ''}
              onChange={e => setField('scheme_week_id', e.target.value ? Number(e.target.value) : null)}
              className={inputCls}>
              <option value="">— Not linked —</option>
              {schemeWeeks.map(w => (
                <option key={w.id} value={w.id}>
                  Week {w.week_number} · {w.topic}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Scheduling</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={value.scheduled_date}
              onChange={e => setField('scheduled_date', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Time</label>
            <input type="time" value={value.scheduled_time}
              onChange={e => setField('scheduled_time', e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2.5">
        <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 space-y-1">
          <p className="font-semibold">Workflow</p>
          <p>Save as draft, then submit for approval. Once approved and access is granted, students in the assigned classes can read it.</p>
        </div>
      </div>
    </div>
  );
}