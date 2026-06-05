'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { examsAPI, academicAPI, api } from '@/lib/api';
import {
  CheckSquare, Loader2, AlertCircle, Search,
  Users, AlertTriangle, Brain,
  Filter, RefreshCw, Eye,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Exam { id: number; name: string; exam_type: string; }
interface ClassOption { id: number; name: string; }
interface SectionOption { id: number; name: string; }
interface SubjectOption { name: string; scheduleId: number; }

interface AttemptRow {
  attempt_id: string;
  student_name: string;
  admission_number: string;
  attempt_status: string;
  submitted_at: string | null;
  objective_score: number;
  objective_max: number;
  theory_score: number;
  theory_max: number;
  total_score: number;
  total_max: number;
  percentage: number;
  marking_status: string;
  pending_count: number;
  low_confidence_count: number;
  has_theory: boolean;
}

interface MarkingListResponse {
  schedule: {
    id: number;
    exam_name: string;
    subject: string;
    class_name: string;
    section_name: string | null;
  };
  summary: {
    total_students: number;
    submitted: number;
    ungraded: number;
    pending: number;
    fully_marked: number;
    needs_review: number;
  };
  attempts: AttemptRow[];
}

// Shape of each item in schedules_by_subject[subjectName].schedules
interface ScheduleItem {
  id: number;
  class_id: number;
  class: string;
  section: string | null;
  full_class_name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MARKING_STATUS: Record<string, { label: string; color: string }> = {
  marked:        { label: 'Marked',      color: 'bg-emerald-100 text-emerald-700' },
  manual_marked: { label: 'Manual',      color: 'bg-blue-100 text-blue-700' },
  ai_marked:     { label: 'AI Marked',   color: 'bg-purple-100 text-purple-700' },
  auto_graded:   { label: 'Auto Graded', color: 'bg-sky-100 text-sky-700' },
  partial:       { label: 'Partial',     color: 'bg-amber-100 text-amber-700' },
  ungraded:      { label: 'Ungraded',    color: 'bg-slate-100 text-slate-600' },
};

const ATTEMPT_STATUS: Record<string, { label: string; color: string }> = {
  submitted:   { label: 'Submitted',   color: 'bg-emerald-100 text-emerald-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  not_started: { label: 'Not Started', color: 'bg-slate-100 text-slate-500' },
  timed_out:   { label: 'Timed Out',   color: 'bg-red-100 text-red-600' },
};

function Badge({
  status,
  map,
}: {
  status: string;
  map: Record<string, { label: string; color: string }>;
}) {
  const cfg = map[status] ?? { label: status, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarkingHubPage() {
  const router = useRouter();

  // Selector state
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const [schedulesBySubject, setSchedulesBySubject] = useState<
    Record<string, { subject_id: number; schedules: ScheduleItem[] }>
  >({});

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);

  const [useClassSections, setUseClassSections] = useState(false);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [selectedSection, setSelectedSection] = useState<SectionOption | null>(null);

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);

  // Table state
  const [markingData, setMarkingData] = useState<MarkingListResponse | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Loading / error
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load exams + settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [examList, settings] = await Promise.all([
          examsAPI.list({ is_published: true }),
          academicAPI.getSettings(),
        ]);
        setExams(examList);
        setUseClassSections(settings?.use_class_sections ?? false);
      } catch {
        setError('Failed to load exams.');
      } finally {
        setLoadingExams(false);
      }
    })();
  }, []);

  // Step 1: Exam selected → fetch schedules_status, derive classes
  const handleExamSelect = async (exam: Exam) => {
    setSelectedExam(exam);
    setSelectedClass(null);
    setSelectedSection(null);
    setSelectedSubject(null);
    setClasses([]);
    setSections([]);
    setSubjects([]);
    setMarkingData(null);
    setError(null);
    setLoadingSchedules(true);

    try {
      const statusData = await examsAPI.getSchedulesStatus(exam.id);
      const bySubject = statusData.schedules_by_subject as unknown as Record <
      string,
      { subject_id: number; schedules: ScheduleItem[] }
    >;
      setSchedulesBySubject(bySubject);

      // Derive unique classes from all schedules
      const classMap = new Map<number, string>();
      Object.values(bySubject)
        .flatMap(g => g.schedules)
        .forEach(s => classMap.set(s.class_id, s.class));

      setClasses(
        Array.from(classMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      setError('Failed to load exam data.');
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Step 2: Class selected → sections or subjects
  const handleClassSelect = async (cls: ClassOption) => {
    setSelectedClass(cls);
    setSelectedSection(null);
    setSelectedSubject(null);
    setSections([]);
    setSubjects([]);
    setMarkingData(null);
    setError(null);


// TO
const sectionMap = new Map<number, string>();
Object.values(schedulesBySubject).forEach(group => {
  group.schedules.forEach((s: any) => {
    if (s.class_id === cls.id && s.section_id && s.section) {
      sectionMap.set(s.section_id, s.section);
    }
  });
});
const derivedSections = Array.from(sectionMap.entries())
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) => a.name.localeCompare(b.name));
setSections(derivedSections);

if (derivedSections.length === 0) {
  deriveSubjects(cls.id, null);
}
  };

  // Step 3: Section selected → subjects
  const handleSectionSelect = (sec: SectionOption) => {
    setSelectedSection(sec);
    setSelectedSubject(null);
    setSubjects([]);
    setMarkingData(null);
    setError(null);
    deriveSubjects(selectedClass!.id, sec.name);
  };

  // Derive subjects for given class + optional section name
  const deriveSubjects = (classId: number, sectionName: string | null) => {
    const result: SubjectOption[] = [];
    Object.entries(schedulesBySubject).forEach(([subjectName, group]) => {
      const match = group.schedules.find(s => {
        if (s.class_id !== classId) return false;
        if (sectionName !== null && s.section !== sectionName) return false;
        return true;
      });
      if (match) result.push({ name: subjectName, scheduleId: match.id });
    });
    result.sort((a, b) => a.name.localeCompare(b.name));
    setSubjects(result);
    if (result.length === 0) setError('No subjects found for this selection.');
  };

  // Step 4: Subject selected → load marking list
  const loadMarkingList = useCallback(async (scheduleId: number) => {
    setLoadingStudents(true);
    setError(null);
    try {
      const res = await api.get(`/api/assessment/teacher/schedule/${scheduleId}/marking-list/`);
      setMarkingData(res.data);
    } catch {
      setError('Failed to load student list.');
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const handleSubjectSelect = (sub: SubjectOption) => {
    setSelectedSubject(sub);
    setMarkingData(null);
    setSearch('');
    setStatusFilter('all');
    loadMarkingList(sub.scheduleId);
  };

  const handleRefresh = () => {
    if (selectedSubject) loadMarkingList(selectedSubject.scheduleId);
  };

  // Filtered rows
  const filteredAttempts = (markingData?.attempts ?? []).filter(a => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      a.student_name.toLowerCase().includes(q) ||
      a.admission_number.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || a.marking_status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <CheckSquare className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Marking Hub</h1>
            <p className="text-xs text-slate-500">Review and grade student submissions</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Selector Card — compact dropdowns in one row */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-wrap gap-3 items-end">

            {/* Exam */}
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Exam</label>
              {loadingExams ? (
                <div className="flex items-center gap-2 h-10 text-sm text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : (
                <select
                  value={selectedExam?.id ?? ''}
                  onChange={e => {
                    const exam = exams.find(x => x.id === Number(e.target.value));
                    if (exam) handleExamSelect(exam);
                  }}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
                >
                  <option value="">Select exam…</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
            </div>

            {/* Class */}
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Class</label>
              {loadingSchedules ? (
                <div className="flex items-center gap-2 h-10 text-sm text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                </div>
              ) : (
                <select
                  value={selectedClass?.id ?? ''}
                  disabled={!selectedExam || classes.length === 0}
                  onChange={e => {
                    const cls = classes.find(c => c.id === Number(e.target.value));
                    if (cls) handleClassSelect(cls);
                  }}
                  className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* Section — only when use_class_sections */}
            {sections.length > 0 && (
              <div className="flex-1 min-w-[140px]">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Section</label>
                {loadingSections ? (
                  <div className="flex items-center gap-2 h-10 text-sm text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </div>
                ) : (
                  <select
                    value={selectedSection?.id ?? ''}
                    disabled={!selectedClass || sections.length === 0}
                    onChange={e => {
                      const sec = sections.find(s => s.id === Number(e.target.value));
                      if (sec) handleSectionSelect(sec);
                    }}
                    className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <option value="">Select section…</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {/* Subject */}
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">Subject</label>
              <select
                value={selectedSubject?.scheduleId ?? ''}
                disabled={!(sections.length > 0 ? selectedSection : selectedClass) || subjects.length === 0} || subjects.length === 0}
                onChange={e => {
                  const sub = subjects.find(s => s.scheduleId === Number(e.target.value));
                  if (sub) handleSubjectSelect(sub);
                }}
                className="w-full h-10 px-3 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.scheduleId} value={s.scheduleId}>{s.name}</option>)}
              </select>
            </div>

          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 mt-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Loading students */}
        {loadingStudents && (
          <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <span className="text-sm">Loading student list…</span>
          </div>
        )}

        {/* Marking List */}
        {markingData && !loadingStudents && (
          <>
            {/* Summary chips */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { label: 'Total',        value: markingData.summary.total_students, color: 'text-slate-800', bg: 'bg-white' },
                { label: 'Submitted',    value: markingData.summary.submitted,      color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Ungraded',     value: markingData.summary.ungraded,       color: 'text-slate-600', bg: 'bg-slate-50' },
                { label: 'Pending',      value: markingData.summary.pending,        color: 'text-amber-700', bg: 'bg-amber-50' },
                { label: 'Marked',       value: markingData.summary.fully_marked,   color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'Needs Review', value: markingData.summary.needs_review,   color: 'text-rose-700', bg: 'bg-rose-50' },
              ].map(chip => (
                <div key={chip.label} className={`${chip.bg} border border-slate-200 rounded-xl p-3 text-center`}>
                  <p className={`text-2xl font-bold ${chip.color}`}>{chip.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{chip.label}</p>
                </div>
              ))}
            </div>

            {/* Table card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Table header controls */}
              <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-500" />
                  <span className="text-sm font-semibold text-slate-700">
                    {markingData.schedule.subject} — {markingData.schedule.class_name}
                    {markingData.schedule.section_name ? ` · ${markingData.schedule.section_name}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search student…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 w-44"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="pl-8 pr-6 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white appearance-none"
                    >
                      <option value="all">All Statuses</option>
                      {Object.entries(MARKING_STATUS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleRefresh}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-100">
                      <th className="text-left px-5 py-3">Student</th>
                      <th className="text-left px-4 py-3">Attempt</th>
                      <th className="text-center px-4 py-3">Obj.</th>
                      <th className="text-center px-4 py-3">Theory</th>
                      <th className="text-center px-4 py-3">Total</th>
                      <th className="text-left px-4 py-3">Marking</th>
                      <th className="text-center px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAttempts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">
                          No students match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredAttempts.map(row => (
                        <tr key={row.attempt_id} className="hover:bg-violet-50/30 transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-800">{row.student_name}</p>
                            <p className="text-xs text-slate-400">{row.admission_number}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge status={row.attempt_status} map={ATTEMPT_STATUS} />
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">
                            {row.objective_max > 0 ? (
                              <span className="font-medium">{row.objective_score}/{row.objective_max}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">
                            {row.theory_max > 0 ? (
                              <span className="font-medium">{row.theory_score}/{row.theory_max}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <p className="font-semibold text-slate-800">{row.total_score}/{row.total_max}</p>
                            {row.total_max > 0 && (
                              <p className="text-xs text-slate-400">{row.percentage.toFixed(1)}%</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge status={row.marking_status} map={MARKING_STATUS} />
                              {row.pending_count > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-amber-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  {row.pending_count}
                                </span>
                              )}
                              {row.low_confidence_count > 0 && (
                                <span className="flex items-center gap-0.5 text-xs text-purple-600">
                                  <Brain className="h-3 w-3" />
                                  {row.low_confidence_count}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() =>
                                router.push(
                                  `/dashboard/staff/assessment/marking/${row.attempt_id}`
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Mark
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredAttempts.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
                  Showing {filteredAttempts.length} of {markingData.attempts.length} students
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}