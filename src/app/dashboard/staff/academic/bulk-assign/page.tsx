'use client';

/**
 * Bulk teacher assignment — form teachers and subject teachers for every
 * class on one page (instead of opening each class configuration).
 * Same flow as student bulk-update: edit → changed rows highlighted → save →
 * per-row summary.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  UserCheck, BookOpen, Loader2, Save, RotateCcw, Search, X, Check, AlertTriangle, Users, Copy, Plus,
} from 'lucide-react';

interface Staff { id: number; name: string; staff_id: string; staff_type?: string | null }
interface SubjectRow { class_subject_config_id: number; subject_id: number; subject_name: string; subject_code?: string; teachers: number[] }
interface ClassRow {
  id: number; name: string; student_class_id: number; class_name: string; class_section_name: string | null;
  school_section_id: number | null; school_section_name: string;
  form_teacher: number | null; assistant_form_teacher: number | null; subjects: SubjectRow[];
}
interface RowResult { id: number; success: boolean; error?: string; warning?: string }
interface SaveSummary { title: string; results: RowResult[]; label: (id: number) => string }

type Tab = 'form' | 'subject';
type SubjectMode = 'class' | 'teacher';

function errorText(err: unknown, fallback: string) {
  const d = (err as { response?: { data?: { message?: string; detail?: string } } })?.response?.data;
  return d?.message || d?.detail || fallback;
}

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');

function StaffSelect({ value, onChange, staff, placeholder, disabled, exclude }: {
  value: number | null; onChange: (v: number | null) => void; staff: Staff[]; placeholder: string; disabled?: boolean; exclude?: number[];
}) {
  return (
    <select value={value ?? ''} disabled={disabled}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full min-w-[180px] px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50">
      <option value="">{placeholder}</option>
      {staff.filter(s => !exclude?.includes(s.id) || s.id === value).map(s => (
        <option key={s.id} value={s.id}>{s.name}{s.staff_id ? ` (${s.staff_id})` : ''}</option>
      ))}
    </select>
  );
}

export default function BulkTeacherAssignmentPage() {
  const { user, hasPermission } = useAuth();
  const canView = !!(user?.is_superuser || hasPermission('academic_structure.view_academic_setup') || hasPermission('academic_structure.manage_academic_setup'));
  const canEdit = !!(user?.is_superuser || hasPermission('academic_structure.manage_academic_setup'));

  const [tab, setTab] = useState<Tab>('form');
  const [mode, setMode] = useState<SubjectMode>('class');
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [teacherId, setTeacherId] = useState<number | null>(null);

  // edits
  const [formEdits, setFormEdits] = useState<Record<number, { form_teacher: number | null; assistant_form_teacher: number | null }>>({});
  const [subjEdits, setSubjEdits] = useState<Record<number, number[]>>({});
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<SaveSummary | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const r = await api.get('/api/academic/bulk-assign/overview/');
      setClasses(r.data?.data?.classes || []);
      setStaff(r.data?.data?.staff || []);
      setFormEdits({}); setSubjEdits({});
    } catch (e) {
      setLoadError(errorText(e, 'Could not load classes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (canView) load(); }, [canView, load]);

  const dirtyForm = Object.keys(formEdits).length;
  const dirtySubj = Object.keys(subjEdits).length;
  const dirty = dirtyForm + dirtySubj;

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const sections = useMemo(() => {
    const m = new Map<string, string>();
    classes.forEach(c => m.set(String(c.school_section_id ?? ''), c.school_section_name));
    return Array.from(m.entries());
  }, [classes]);

  const baseClasses = useMemo(() => {
    const m = new Map<number, string>();
    classes.filter(c => !sectionFilter || String(c.school_section_id ?? '') === sectionFilter)
      .forEach(c => m.set(c.student_class_id, c.class_name));
    return Array.from(m.entries());
  }, [classes, sectionFilter]);

  const visible = useMemo(() => classes.filter(c =>
    (!sectionFilter || String(c.school_section_id ?? '') === sectionFilter)
    && (!classFilter || String(c.student_class_id) === classFilter)
    && (!search || c.name.toLowerCase().includes(search.toLowerCase())
        || c.subjects.some(s => s.subject_name.toLowerCase().includes(search.toLowerCase())))
  ), [classes, sectionFilter, classFilter, search]);

  const staffName = useCallback((id: number) => staff.find(s => s.id === id)?.name || `#${id}`, [staff]);

  // ── form-teacher edits ─────────────────────────────────────────────────────
  const formValue = (c: ClassRow) => formEdits[c.id] ?? { form_teacher: c.form_teacher, assistant_form_teacher: c.assistant_form_teacher };
  const setForm = (c: ClassRow, patch: Partial<{ form_teacher: number | null; assistant_form_teacher: number | null }>) => {
    setFormEdits(prev => {
      const next = { ...formValue(c), ...patch };
      const copy = { ...prev };
      if (next.form_teacher === c.form_teacher && next.assistant_form_teacher === c.assistant_form_teacher) delete copy[c.id];
      else copy[c.id] = next;
      return copy;
    });
  };

  // ── subject-teacher edits ─────────────────────────────────────────────────
  const subjOriginal = useMemo(() => {
    const m: Record<number, number[]> = {};
    classes.forEach(c => c.subjects.forEach(s => { m[s.class_subject_config_id] = s.teachers; }));
    return m;
  }, [classes]);
  const subjValue = (id: number) => subjEdits[id] ?? subjOriginal[id] ?? [];
  const setSubj = (id: number, teachers: number[]) => {
    setSubjEdits(prev => {
      const copy = { ...prev };
      if (sameSet(teachers, subjOriginal[id] || [])) delete copy[id];
      else copy[id] = teachers;
      return copy;
    });
  };
  const toggleTeacher = (configId: number, tId: number) => {
    const cur = subjValue(configId);
    setSubj(configId, cur.includes(tId) ? cur.filter(x => x !== tId) : [...cur, tId]);
  };
  /** Same subject, same teachers, every arm of this class (e.g. JSS1 A, B, C). */
  const applyToArms = (c: ClassRow, s: SubjectRow) => {
    const teachers = subjValue(s.class_subject_config_id);
    classes.filter(o => o.student_class_id === c.student_class_id && o.id !== c.id).forEach(o => {
      const match = o.subjects.find(x => x.subject_id === s.subject_id);
      if (match) setSubj(match.class_subject_config_id, teachers);
    });
    showToast('success', `${s.subject_name}: applied to all ${c.class_name} arms (not saved yet)`);
  };

  const discard = () => { setFormEdits({}); setSubjEdits({}); };

  // ── save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    const allResults: RowResult[] = [];
    const labels: Record<string, string> = {};
    try {
      if (dirtyForm) {
        const rows = Object.entries(formEdits).map(([id, v]) => ({ class_configuration_id: Number(id), ...v }));
        const r = await api.post('/api/academic/bulk-assign/form-teachers/', { rows });
        (r.data?.data?.results || []).forEach((x: RowResult) => {
          allResults.push(x);
          labels[`f${x.id}`] = `Form teacher · ${classes.find(c => c.id === x.id)?.name ?? x.id}`;
        });
      }
      if (dirtySubj) {
        const rows = Object.entries(subjEdits).map(([id, teachers]) => ({ class_subject_config_id: Number(id), teachers }));
        const r = await api.post('/api/academic/bulk-assign/subject-teachers/', { rows });
        (r.data?.data?.results || []).forEach((x: RowResult) => {
          allResults.push({ ...x, id: -x.id });
          const c = classes.find(cc => cc.subjects.some(s => s.class_subject_config_id === x.id));
          const s = c?.subjects.find(ss => ss.class_subject_config_id === x.id);
          labels[`f${-x.id}`] = `${s?.subject_name ?? 'Subject'} · ${c?.name ?? ''}`;
        });
      }
      const ok = allResults.filter(r => r.success).length;
      setSummary({ title: `${ok} saved, ${allResults.length - ok} failed`, results: allResults, label: id => labels[`f${id}`] || String(id) });
      await load();
    } catch (e) {
      showToast('error', errorText(e, 'Could not save the assignments.'));
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return <div className="p-6 text-sm font-semibold text-slate-500">You do not have permission to view class assignments.</div>;
  }

  const teacherCount = teacherId ? classes.reduce((n, c) => n + c.subjects.filter(s => subjValue(s.class_subject_config_id).includes(teacherId)).length, 0) : 0;

  return (
    <div className="space-y-5 pb-28">
      {toast && (
        <div className={`fixed top-4 right-4 z-[80] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />} {toast.text}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3"><Users className="w-6 h-6 text-indigo-600" /> Bulk Teacher Assignment</h1>
        <p className="text-sm text-slate-500 mt-1">
          Assign form teachers and subject teachers for every class on one page. Teachers then only see their own
          classes and subjects in Assessment and Results.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {([['form', 'Form Teachers', UserCheck], ['subject', 'Subject Teachers', BookOpen]] as const).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border ${tab === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
        {tab === 'subject' && (
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 ml-auto">
            {([['class', 'By class'], ['teacher', 'By teacher']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${mode === k ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select value={sectionFilter} onChange={e => { setSectionFilter(e.target.value); setClassFilter(''); }}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
          <option value="">All school sections</option>
          {sections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
          <option value="">All classes</option>
          {baseClasses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search class or subject"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm" />
        </div>
        {tab === 'subject' && mode === 'teacher' && (
          <StaffSelect value={teacherId} onChange={setTeacherId} staff={staff} placeholder="Choose a teacher…" />
        )}
      </div>

      {loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{loadError}</div>}
      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : visible.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400 font-medium">No classes match the filters.</div>
      ) : tab === 'form' ? (
        /* ── FORM TEACHERS ─────────────────────────────────────────────── */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-3">Class</th><th className="px-4 py-3">Form Teacher</th><th className="px-4 py-3">Assistant Form Teacher</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map(c => {
                const v = formValue(c);
                const changed = !!formEdits[c.id];
                const same = v.form_teacher && v.form_teacher === v.assistant_form_teacher;
                return (
                  <tr key={c.id} className={changed ? 'bg-amber-50/70' : ''}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{c.school_section_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StaffSelect value={v.form_teacher} onChange={x => setForm(c, { form_teacher: x })} staff={staff} placeholder="— None —" disabled={!canEdit} />
                    </td>
                    <td className="px-4 py-3">
                      <StaffSelect value={v.assistant_form_teacher} onChange={x => setForm(c, { assistant_form_teacher: x })} staff={staff} placeholder="— None —" disabled={!canEdit} />
                      {same && <p className="text-[11px] text-rose-600 font-semibold mt-1">Can&apos;t be the same as the form teacher</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : mode === 'class' ? (
        /* ── SUBJECT TEACHERS · BY CLASS ───────────────────────────────── */
        <div className="space-y-4">
          {visible.map(c => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-black text-slate-900">{c.name} <span className="text-[11px] font-semibold text-slate-400 ml-1">{c.school_section_name}</span></p>
                <span className="text-[11px] text-slate-400 font-semibold">{c.subjects.length} subject(s)</span>
              </div>
              {c.subjects.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-400">No subjects configured for this class yet (add them on the class configuration page).</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {c.subjects.filter(s => !search || c.name.toLowerCase().includes(search.toLowerCase()) || s.subject_name.toLowerCase().includes(search.toLowerCase())).map(s => {
                    const cur = subjValue(s.class_subject_config_id);
                    const changed = !!subjEdits[s.class_subject_config_id];
                    const hasArms = classes.some(o => o.student_class_id === c.student_class_id && o.id !== c.id);
                    return (
                      <div key={s.class_subject_config_id} className={`px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 ${changed ? 'bg-amber-50/70' : ''}`}>
                        <p className="md:w-48 shrink-0 text-sm font-bold text-slate-800">{s.subject_name}</p>
                        <div className="flex-1 flex flex-wrap items-center gap-1.5">
                          {cur.length === 0 && <span className="text-xs text-amber-600 font-semibold">No teacher</span>}
                          {cur.map(t => (
                            <span key={t} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                              {staffName(t)}
                              {canEdit && <button onClick={() => toggleTeacher(s.class_subject_config_id, t)} className="p-0.5 rounded-full hover:bg-indigo-100"><X className="w-3 h-3" /></button>}
                            </span>
                          ))}
                          {canEdit && (
                            <select value="" onChange={e => e.target.value && toggleTeacher(s.class_subject_config_id, Number(e.target.value))}
                              className="px-2 py-1 rounded-lg border border-dashed border-slate-300 text-xs text-slate-600 bg-white">
                              <option value="">+ Add teacher</option>
                              {staff.filter(x => !cur.includes(x.id)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          )}
                        </div>
                        {canEdit && hasArms && (
                          <button onClick={() => applyToArms(c, s)} title={`Use these teachers for ${s.subject_name} in every ${c.class_name} arm`}
                            className="shrink-0 text-[11px] font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1">
                            <Copy className="w-3.5 h-3.5" /> All {c.class_name} arms
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : !teacherId ? (
        <div className="p-10 text-center text-sm text-slate-400 font-medium">Choose a teacher above, then tick the subjects they teach in each class.</div>
      ) : (
        /* ── SUBJECT TEACHERS · BY TEACHER ─────────────────────────────── */
        <div className="space-y-3">
          <p className="text-sm text-slate-600"><b>{staffName(teacherId)}</b> teaches <b>{teacherCount}</b> class subject(s). Tap a subject to add or remove.</p>
          {visible.map(c => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col md:flex-row md:items-start gap-3">
              <p className="md:w-48 shrink-0 text-sm font-black text-slate-900">{c.name}<span className="block text-[11px] font-semibold text-slate-400">{c.school_section_name}</span></p>
              <div className="flex-1 flex flex-wrap gap-2">
                {c.subjects.length === 0 && <span className="text-xs text-slate-400">No subjects configured</span>}
                {c.subjects.map(s => {
                  const on = subjValue(s.class_subject_config_id).includes(teacherId);
                  const changed = !!subjEdits[s.class_subject_config_id];
                  return (
                    <button key={s.class_subject_config_id} disabled={!canEdit} onClick={() => toggleTeacher(s.class_subject_config_id, teacherId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 transition-colors ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'} ${changed ? 'ring-2 ring-amber-300' : ''}`}>
                      {on ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />} {s.subject_name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save bar */}
      {canEdit && dirty > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-[70] bg-white border-t border-slate-200 shadow-2xl px-4 py-3">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-slate-700 flex-1">
              {dirtyForm > 0 && <span>{dirtyForm} form-teacher change(s)</span>}
              {dirtyForm > 0 && dirtySubj > 0 && <span> · </span>}
              {dirtySubj > 0 && <span>{dirtySubj} subject-teacher change(s)</span>}
              <span className="text-slate-400 font-medium"> not saved</span>
            </p>
            <button onClick={discard} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 inline-flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Discard</button>
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black inline-flex items-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save all
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-900">{summary.title}</h3>
              <button onClick={() => setSummary(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-slate-100">
              {summary.results.map((r, i) => (
                <div key={i} className="px-5 py-2.5 flex items-start gap-3 text-sm">
                  {r.success ? <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800">{summary.label(r.id)}</p>
                    {r.error && <p className="text-xs text-rose-600">{r.error}</p>}
                    {r.warning && <p className="text-xs text-amber-600">{r.warning}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSummary(null)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
