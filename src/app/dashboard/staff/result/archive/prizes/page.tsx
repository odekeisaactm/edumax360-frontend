'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, academicCalendarAPI, schoolInfoAPI } from '@/lib/api';
import {
  Search, Loader2, ArrowLeft, Printer, Trophy, TrendingUp, Users, Calendar, Layers,
  Settings2, SlidersHorizontal, HelpCircle, LayoutGrid, X, ArrowUpDown, AlertCircle, CheckCircle2, GraduationCap, Presentation, BookOpen, Building2
} from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500" /> : <AlertCircle className="h-4 w-4 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function HelpModal({ title, content, onClose }: { title: string, content: React.ReactNode, onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm tracking-wide flex items-center gap-2"><HelpCircle className="w-4 h-4 text-blue-600"/> {title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
        </div>
        <div className="p-5 text-sm text-slate-600 leading-relaxed space-y-3">{content}</div>
      </div>
    </div>
  );
}

// ─── Step indicator (mirrors the polish of the dashboard's card language) ────
function StepPills({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { id: 1, label: 'Rules' },
    { id: 2, label: 'Scope' },
    { id: 3, label: 'Report' },
  ];
  return (
    <div className="flex items-center gap-2 print-hidden">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
            step === s.id ? 'bg-blue-100 text-blue-700' : step > s.id ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
          }`}>
            {step > s.id ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 flex items-center justify-center">{s.id}</span>}
            {s.label}
          </div>
          {i < steps.length - 1 && <div className={`w-4 h-px ${step > s.id ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Report shape (explicit discriminated union) ──────────────────────────────
// Without this annotation, TypeScript widens `type: 'students'` / `type: 'groups'`
// to plain `string` when inferring the useMemo's return type, which merges the
// two branches into one object with every branch-specific field marked optional
// — that's what produced the "possibly undefined" errors even after narrowing
// on `.type`. Declaring the union explicitly keeps the literals literal.
type StudentsReport = {
  type: 'students';
  cumulative: Record<string, any[]>;
  subjects: Record<string, Record<string, any[]>>;
  disqualified: any[];
};

type GroupsReport = {
  type: 'groups';
  topClasses: any[];
  topSubjects: any[];
};

type ProcessedReport = StudentsReport | GroupsReport;

export default function PrizeArchivePage() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [helpTopic, setHelpTopic] = useState<{title: string, content: React.ReactNode} | null>(null);
  const [showLayoutDrawer, setShowLayoutDrawer] = useState(false);

  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  const [rules, setRules] = useState({
    termType: 'end_of_term', minSubjects: 7, ignoreAbandoned: true, strictSubjectEligibility: true, tieBreaker: 'share'
  });

  const [filters, setFilters] = useState({
    analysisTarget: 'students', sessionId: '', periodId: '', schoolSectionId: '', studentClassId: '', classConfigId: '',
    competitionPool: 'class_level', topNLimit: '3', customTopN: 20
  });

  const [options, setOptions] = useState({ sessions: [] as any[], periods: [] as any[], schoolSections: [] as any[], classLevels: [] as any[], classConfigs: [] as any[] });
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState<{cumulative: any[], subject_scores: any[]}>({ cumulative: [], subject_scores: [] });
  const [pivotMode, setPivotMode] = useState<'subject_first' | 'class_first'>('subject_first');
  const [layoutConfig, setLayoutConfig] = useState({ visibleClasses: {} as Record<string, boolean>, visibleSubjects: {} as Record<string, boolean>, classOrder: [] as string[], subjectOrder: [] as string[] });

  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const [sess, schSec, curSess, cls, cfgs] = await Promise.all([
          academicCalendarAPI.listSessions(), academicCalendarAPI.listSchoolSections(),
          academicCalendarAPI.getCurrentSession(), api.get('/api/academic/classes/'), api.get('/api/academic/class-configurations/')
        ]);
        setOptions(prev => ({ ...prev, sessions: sess, schoolSections: schSec, classLevels: cls.data?.data?.results || cls.data?.data || [], classConfigs: cfgs.data?.data?.results || cfgs.data?.data || [] }));

        if (curSess?.id) {
          setFilters(prev => ({ ...prev, sessionId: String(curSess.id) }));
          const pers = await academicCalendarAPI.listSessionPeriods({ session_id: curSess.id });
          setOptions(prev => ({ ...prev, periods: pers }));
          try {
            const curPerRes = await api.get('/api/school/session-periods/current/');
            if (curPerRes.data?.data?.id) setFilters(prev => ({ ...prev, periodId: String(curPerRes.data.data.id) }));
          } catch(e) {}
        }
      } catch (err) {}
    };
    loadDefaults();

    // School header info — mirrors the School Info page's fetch. Failing silently
    // here is fine: the header just falls back to a generic icon if unavailable.
    schoolInfoAPI.get().then(data => { if (data) setSchoolInfo(data); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (filters.sessionId) academicCalendarAPI.listSessionPeriods({ session_id: Number(filters.sessionId) }).then(pers => setOptions(prev => ({ ...prev, periods: pers })));
  }, [filters.sessionId]);

  const filteredLevels = useMemo(() => filters.schoolSectionId ? options.classLevels.filter(l => String(l.school_section) === filters.schoolSectionId) : options.classLevels, [options.classLevels, filters.schoolSectionId]);
  const filteredArms = useMemo(() => filters.studentClassId ? options.classConfigs.filter(c => String(c.student_class) === filters.studentClassId) : options.classConfigs, [options.classConfigs, filters.studentClassId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filters.sessionId || !filters.periodId) return showToast('warn', "Session and Term are required.");

    setLoading(true);
    try {
      const params = {
        session_id: filters.sessionId, period_id: filters.periodId, school_section_id: filters.schoolSectionId || undefined,
        student_class_id: filters.studentClassId || undefined, class_config_id: filters.classConfigId || undefined,
        min_subjects: rules.minSubjects, ignore_abandoned: rules.ignoreAbandoned, term_type: rules.termType
      };

      const res = await api.get('/api/result/archive/prizes/', { params });
      setRawData(res.data);

      const uniqueClasses = new Set<string>();
      const uniqueSubjects = new Set<string>();
      res.data.cumulative.forEach((r: any) => uniqueClasses.add(filters.competitionPool === 'class_arm' ? r.class_arm_name : filters.competitionPool === 'class_level' ? r.class_level_name : 'Global/Section Level'));
      res.data.subject_scores.forEach((r: any) => uniqueSubjects.add(r.subject_name));

      const initialClasses = Array.from(uniqueClasses).sort();
      const initialSubjects = Array.from(uniqueSubjects).sort();

      setLayoutConfig({ visibleClasses: Object.fromEntries(initialClasses.map(c => [c, true])), visibleSubjects: Object.fromEntries(initialSubjects.map(s => [s, true])), classOrder: initialClasses, subjectOrder: initialSubjects });
      setStep(3);
    } catch (err: any) { showToast('error', "Failed to compute records."); } finally { setLoading(false); }
  };

  const rankAndSlice = (list: any[], keyField: 'average' | 'score', topN: number) => {
    let sorted = [...list].sort((a, b) => {
      if (b[keyField] !== a[keyField]) return b[keyField] - a[keyField];
      if (keyField === 'average' && rules.tieBreaker !== 'share') {
        if (rules.tieBreaker === 'highest_total' && b.total_score !== a.total_score) return b.total_score - a.total_score;
        if (rules.tieBreaker === 'highest_exam' && b.highest_exam_score !== a.highest_exam_score) return b.highest_exam_score - a.highest_exam_score;
      }
      return 0;
    });

    let currentRank = 1; let rankOutput = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0) {
        const prev = sorted[i - 1], curr = sorted[i]; let isTie = false;
        if (curr[keyField] === prev[keyField]) {
           if (keyField === 'score') isTie = true;
           else {
             if (rules.tieBreaker === 'share') isTie = true;
             else if (rules.tieBreaker === 'highest_total' && curr.total_score === prev.total_score) isTie = true;
             else if (rules.tieBreaker === 'highest_exam' && curr.highest_exam_score === prev.highest_exam_score) isTie = true;
           }
        }
        if (!isTie) currentRank = i + 1;
      }
      if (currentRank > topN) break;
      rankOutput.push({ ...sorted[i], rank: currentRank });
    }
    return rankOutput;
  };

  const processedReport = useMemo<ProcessedReport | null>(() => {
    if (!rawData) return null;
    const topN = filters.topNLimit === 'custom' ? filters.customTopN : Number(filters.topNLimit);
    const getGroupName = (r: any) => filters.competitionPool === 'class_arm' ? r.class_arm_name : filters.competitionPool === 'class_level' ? r.class_level_name : 'Global/Section Level';

    const eligibleStudents = rawData.cumulative.filter(r => r.is_eligible);
    const eligibleIds = new Set(eligibleStudents.map(r => r.student_id));

    if (filters.analysisTarget === 'students') {
      const groupedCumulative: Record<string, any[]> = {};
      eligibleStudents.forEach(r => { const g = getGroupName(r); if (!groupedCumulative[g]) groupedCumulative[g] = []; groupedCumulative[g].push(r); });
      const finalCumulative: Record<string, any[]> = {};
      Object.keys(groupedCumulative).forEach(g => finalCumulative[g] = rankAndSlice(groupedCumulative[g], 'average', topN));

      const subjectGroups: Record<string, Record<string, any[]>> = {};
      rawData.subject_scores.forEach(r => {
        if (rules.strictSubjectEligibility && !eligibleIds.has(r.student_id)) return;
        const classGrp = getGroupName(r); const subGrp = r.subject_name;
        if (!subjectGroups[subGrp]) subjectGroups[subGrp] = {};
        if (!subjectGroups[subGrp][classGrp]) subjectGroups[subGrp][classGrp] = [];
        subjectGroups[subGrp][classGrp].push(r);
      });

      const finalSubjects: Record<string, Record<string, any[]>> = {};
      Object.keys(subjectGroups).forEach(sub => {
        finalSubjects[sub] = {};
        Object.keys(subjectGroups[sub]).forEach(cls => finalSubjects[sub][cls] = rankAndSlice(subjectGroups[sub][cls], 'score', topN));
      });

      const finalDisqualified = rawData.cumulative.filter(r => !r.is_eligible).sort((a,b) => b.average - a.average);
      return { type: 'students', cumulative: finalCumulative, subjects: finalSubjects, disqualified: finalDisqualified };
    }
    else {
      const classGroups: Record<string, { name: string, teachers: Set<string>, totalAvg: number, count: number }> = {};
      eligibleStudents.forEach(r => {
         const key = getGroupName(r);
         if (!classGroups[key]) classGroups[key] = { name: key, teachers: new Set(), totalAvg: 0, count: 0 };
         if (r.form_teacher_name && r.form_teacher_name !== 'Unassigned') classGroups[key].teachers.add(r.form_teacher_name);
         classGroups[key].totalAvg += r.average;
         classGroups[key].count += 1;
      });
      const rankedClasses = Object.values(classGroups).map(c => ({
         name: c.name,
         teacher: Array.from(c.teachers).join(', ') || 'Unassigned',
         average: Number((c.totalAvg / c.count).toFixed(2))
      })).sort((a,b) => b.average - a.average).slice(0, topN).map((c, i) => ({...c, rank: i + 1}));

      const subjectGroups: Record<string, { name: string, classGroup: string, teachers: Set<string>, totalScore: number, count: number }> = {};
      rawData.subject_scores.forEach(r => {
         if (rules.strictSubjectEligibility && !eligibleIds.has(r.student_id)) return;

         const groupName = getGroupName(r);
         const key = `${r.subject_name} (${groupName})`;

         if (!subjectGroups[key]) subjectGroups[key] = { name: r.subject_name, classGroup: groupName, teachers: new Set(), totalScore: 0, count: 0 };
         if (r.subject_teacher_name && r.subject_teacher_name !== 'Unassigned') subjectGroups[key].teachers.add(r.subject_teacher_name);
         subjectGroups[key].totalScore += r.score;
         subjectGroups[key].count += 1;
      });
      const rankedSubjects = Object.values(subjectGroups).map(s => ({
         name: s.name,
         classArm: s.classGroup,
         teacher: Array.from(s.teachers).join(', ') || 'Unassigned',
         average: Number((s.totalScore / s.count).toFixed(2))
      })).sort((a,b) => b.average - a.average).slice(0, topN).map((s, i) => ({...s, rank: i + 1}));

      return { type: 'groups', topClasses: rankedClasses, topSubjects: rankedSubjects };
    }
  }, [rawData, filters.competitionPool, filters.topNLimit, filters.customTopN, filters.analysisTarget, rules.tieBreaker, rules.strictSubjectEligibility]);

  // Narrow the union here, once, into its own const. TypeScript's control-flow
  // narrowing on `processedReport.type === 'students'` doesn't reliably carry
  // into the .map() closures further down in the JSX, so we lock the variant
  // in ahead of time instead of relying on inline narrowing (or `as any`).
  const studentReport = processedReport && processedReport.type === 'students' ? processedReport : null;
  const groupReport = processedReport && processedReport.type === 'groups' ? processedReport : null;

  const handleDragStart = (e: React.DragEvent, index: number, type: 'class' | 'subject') => e.dataTransfer.setData('text/plain', `${type}|${index}`);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, dropIndex: number, type: 'class' | 'subject') => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain'); if (!data) return;
    const [dragType, dragIndexStr] = data.split('|'); if (dragType !== type) return;
    const dragIndex = parseInt(dragIndexStr, 10);
    const newOrder = [...(type === 'class' ? layoutConfig.classOrder : layoutConfig.subjectOrder)];
    const [draggedItem] = newOrder.splice(dragIndex, 1); newOrder.splice(dropIndex, 0, draggedItem);
    setLayoutConfig(prev => ({ ...prev, [type === 'class' ? 'classOrder' : 'subjectOrder']: newOrder }));
  };

  const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all";
  const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center justify-between";
  const primaryBtnCls = "inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-200 disabled:opacity-50";

  return (
    <div className="max-w-[85rem] mx-auto pb-20 px-4 pt-6 bg-slate-50/50 min-h-screen">

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { background: white; font-size: 11px !important; }
          .print-break-avoid { page-break-inside: avoid; }
          .print-shadow-none { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          .print-hidden { display: none !important; }
          th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          .page-break-before { page-break-before: always; }
        }
      `}} />

      <ToastStack toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />
      {helpTopic && <HelpModal title={helpTopic.title} content={helpTopic.content} onClose={() => setHelpTopic(null)} />}

      {/* ── Hero header — matches the dashboard's dark gradient banner language ── */}
      <div className="mb-6 print-hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 rounded-2xl px-5 py-4 md:px-7 md:py-5 shadow-lg shadow-slate-300/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>

              {schoolInfo?.logo ? (
                <img src={schoolInfo.logo} alt={schoolInfo?.name || 'School logo'} className="w-11 h-11 rounded-xl object-contain bg-white/10 p-1.5 flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-900/30 flex-shrink-0">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
              )}

              <div className="min-w-0">
                <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest truncate">
                  {schoolInfo?.name || schoolInfo?.short_name || 'Result Archive'}
                </p>
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">Prize & Award Archive</h1>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Enterprise Reporting Engine</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <StepPills step={step} />
              {step === 3 && (
                <div className="flex gap-2">
                  {filters.analysisTarget === 'students' && (
                    <button onClick={() => setShowLayoutDrawer(true)} className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg font-semibold transition-all flex items-center gap-2 text-xs border border-white/10">
                      <LayoutGrid className="w-3.5 h-3.5" /> Layout
                    </button>
                  )}
                  <button onClick={() => setStep(2)} className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg font-semibold transition-all flex items-center gap-2 text-xs border border-white/10">
                    <Settings2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={() => { setShowLayoutDrawer(false); setTimeout(() => window.print(), 100); }} className="px-3.5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-lg font-semibold transition-all flex items-center gap-2 text-xs shadow-md shadow-blue-900/30">
                    <Printer className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- WIZARD STEP 1: RULES ENGINE --- */}
      {step === 1 && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in max-w-3xl mx-auto overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
               <span className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200">
                 <Settings2 className="w-3.5 h-3.5 text-white" />
               </span>
               Step 1: Evaluation Rules
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Period Type</label>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setRules({...rules, termType: 'end_of_term'})} className={`flex-1 py-1.5 rounded-md font-semibold text-sm transition-all ${rules.termType === 'end_of_term' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>End of Term</button>
                <button onClick={() => setRules({...rules, termType: 'midterm'})} className={`flex-1 py-1.5 rounded-md font-semibold text-sm transition-all ${rules.termType === 'midterm' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>Midterm</button>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Min. Subjects Threshold
                <button type="button" onClick={() => setHelpTopic({title: 'Minimum Subjects', content: <p>Students must complete at least this many subjects to be eligible for Overall Rankings.</p>})}><HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500"/></button>
              </label>
              <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <input type="range" min="1" max="15" value={rules.minSubjects} onChange={e => setRules({...rules, minSubjects: Number(e.target.value)})} className="flex-1 accent-blue-600" />
                <span className="font-bold text-slate-700 text-sm">{rules.minSubjects}</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                Abandoned Subject Filter
                <button type="button" onClick={() => setHelpTopic({title: 'Abandoned Subject Filter', content: <p>Excludes subjects where the Exam score is missing or 0 from the student's average calculation.</p>})}><HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500"/></button>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors h-[42px]">
                <input type="checkbox" checked={rules.ignoreAbandoned} onChange={e => setRules({...rules, ignoreAbandoned: e.target.checked})} className="w-4 h-4 accent-blue-600 rounded" />
                <span className="font-semibold text-slate-700 text-sm">Drop Incomplete Subjects</span>
              </label>
            </div>

            <div>
              <label className={labelCls}>
                Subject Prize Eligibility
                <button type="button" onClick={() => setHelpTopic({title: 'Subject Award Eligibility', content: <p>If checked, students disqualified from the Overall Ranking (due to minimum subjects) are also disqualified from winning single-subject awards.</p>})}><HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500"/></button>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors h-[42px]">
                <input type="checkbox" checked={rules.strictSubjectEligibility} onChange={e => setRules({...rules, strictSubjectEligibility: e.target.checked})} className="w-4 h-4 accent-blue-600 rounded" />
                <span className="font-semibold text-slate-700 text-sm">Strict Prize Eligibility</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>Tie-Breaker Logic</label>
              <select value={rules.tieBreaker} onChange={e => setRules({...rules, tieBreaker: e.target.value})} className={inputCls}>
                <option value="share">Share Rank (e.g. 1st, 1st, 3rd)</option>
                <option value="highest_total">Tie-Break by Highest Total Score</option>
                <option value="highest_exam" disabled={rules.termType === 'midterm'}>Tie-Break by Highest Exam Score (End of Term Only)</option>
              </select>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
            <button onClick={() => setStep(2)} className={primaryBtnCls}>
              Next Step &rarr;
            </button>
          </div>
        </div>
      )}

      {/* --- WIZARD STEP 2: SCOPE & CATEGORY --- */}
      {step === 2 && (
        <form onSubmit={handleGenerate} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm animate-in slide-in-from-right-8 max-w-4xl mx-auto overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
                <span className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-white" />
                </span>
                Step 2: Analysis Scope
             </h2>
             <button type="button" onClick={() => setStep(1)} className="text-[10px] font-bold text-slate-400 hover:text-slate-700 tracking-wider uppercase">← Back</button>
          </div>

          <div className="mb-6">
            <label className={labelCls}>
              Analysis Target (Who gets the award?)
              <button type="button" onClick={() => setHelpTopic({title: 'Analysis Target', content: <p><b>Students:</b> Ranks individual pupils.<br/><br/><b>Groups (Teachers):</b> Averages performance across entire classes or subject areas to identify top-performing educators.</p>})}><HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-blue-500"/></button>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFilters({...filters, analysisTarget: 'students'})} className={`p-3 border rounded-lg flex items-center gap-3 text-left transition-all ${filters.analysisTarget === 'students' ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <GraduationCap className="w-5 h-5" />
                <div><p className="font-bold text-sm">Student Rankings</p></div>
              </button>
              <button type="button" onClick={() => setFilters({...filters, analysisTarget: 'groups'})} className={`p-3 border rounded-lg flex items-center gap-3 text-left transition-all ${filters.analysisTarget === 'groups' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                <Presentation className="w-5 h-5" />
                <div><p className="font-bold text-sm">Teacher / Group Awards</p></div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelCls}>Session</label>
              <select required value={filters.sessionId} onChange={e => setFilters({...filters, sessionId: e.target.value})} className={inputCls}>
                <option value="">Select Session...</option>
                {options.sessions?.map(s => <option key={s.id} value={s.id}>{s.name || `${s.start_year}/${s.end_year}`}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Term / Period</label>
              <select required value={filters.periodId} onChange={e => setFilters({...filters, periodId: e.target.value})} className={inputCls}>
                <option value="">Select Term...</option>
                {options.periods?.map(p => <option key={p.id} value={p.id}>{p.period?.name || p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className={labelCls}>Limit Section</label>
              <select value={filters.schoolSectionId} onChange={e => setFilters({...filters, schoolSectionId: e.target.value, studentClassId: '', classConfigId: ''})} className={inputCls}>
                <option value="">Whole School</option>
                {options.schoolSections?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Limit Grade</label>
              <select value={filters.studentClassId} onChange={e => setFilters({...filters, studentClassId: e.target.value, classConfigId: ''})} className={inputCls}>
                <option value="">All Grades</option>
                {filteredLevels?.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Limit Arm</label>
              <select value={filters.classConfigId} onChange={e => setFilters({...filters, classConfigId: e.target.value})} disabled={!filters.studentClassId} className={`${inputCls} disabled:opacity-50 disabled:bg-slate-50`}>
                <option value="">All Arms</option>
                {filteredArms?.map(c => <option key={c.id} value={c.id}>{c.class_name || c.name} {c.class_section_name || ''}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-6 border-t border-slate-100 pt-5">
            <label className={labelCls}>
              Competition Pool (Grouping)
            </label>
            <div className="grid grid-cols-3 gap-3">
               {[ {id: 'section', label: 'Merge All'}, {id: 'class_level', label: 'By Grade Level'}, {id: 'class_arm', label: 'By Specific Arm'} ].map(opt => (
                 <button key={opt.id} type="button" onClick={() => setFilters({...filters, competitionPool: opt.id})} className={`p-2.5 border rounded-lg text-xs font-bold text-center transition-all ${filters.competitionPool === opt.id ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                   {opt.label}
                 </button>
               ))}
            </div>
          </div>

          <div className="flex items-end justify-between pt-6 border-t border-slate-100">
            <div className="flex gap-3">
              <div>
                <label className={labelCls}>Rank Limit</label>
                <select value={filters.topNLimit} onChange={e => setFilters({...filters, topNLimit: e.target.value})} className={inputCls + " w-32"}>
                  <option value="1">Top 1 Only</option><option value="3">Top 3</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="custom">Custom...</option>
                </select>
              </div>
              {filters.topNLimit === 'custom' && (
                 <div className="animate-in slide-in-from-left-2">
                   <label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1.5">Enter Limit</label>
                   <input type="number" min="1" max="500" value={filters.customTopN} onChange={e => setFilters({...filters, customTopN: Number(e.target.value)})} className="w-24 border border-blue-300 rounded-lg px-3 py-2 text-sm font-bold text-blue-700 bg-blue-50 outline-none" />
                 </div>
              )}
            </div>

            <button type="submit" disabled={loading} className={primaryBtnCls}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} Generate
            </button>
          </div>
        </form>
      )}

      {/* --- WIZARD STEP 3: REPORT UI --- */}
      {step === 3 && processedReport && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 max-w-6xl mx-auto">
          {/* Print letterhead — includes school identity since this becomes an official document */}
          <div className="hidden print:block mb-6 text-center border-b border-slate-300 pb-3">
             {schoolInfo?.logo && (
               <img src={schoolInfo.logo} alt={schoolInfo?.name || 'School logo'} className="w-14 h-14 object-contain mx-auto mb-2" />
             )}
             {schoolInfo?.name && (
               <h1 className="text-xl font-bold uppercase tracking-widest text-slate-900">{schoolInfo.name}</h1>
             )}
             {schoolInfo?.motto && (
               <p className="text-[10px] italic text-slate-500 mt-0.5">"{schoolInfo.motto}"</p>
             )}
             <h2 className="text-base font-bold uppercase tracking-widest text-slate-800 mt-2">
               {filters.analysisTarget === 'groups' ? 'Group Performance Roster' : 'Official Prize Roster'}
             </h2>
             <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Top {filters.topNLimit === 'custom' ? filters.customTopN : filters.topNLimit} Ranking | Session: {options.sessions.find(s=>s.id===Number(filters.sessionId))?.name}</p>
          </div>

          {/* === RENDER: STUDENT RANKINGS === */}
          {studentReport && (
            <>
              <div className="bg-white p-3 rounded-lg border border-slate-100 flex items-center justify-between print-hidden shadow-sm">
                 <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2">Structure:</span>
                 <div className="flex bg-slate-100 p-1 rounded-md">
                    <button onClick={() => setPivotMode('subject_first')} className={`px-4 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${pivotMode === 'subject_first' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Subject Centric</button>
                    <button onClick={() => setPivotMode('class_first')} className={`px-4 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all ${pivotMode === 'class_first' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Class Centric</button>
                 </div>
              </div>

              <div className="space-y-8">
                 {/* Cumulative (Always Class-Centric) */}
                 {layoutConfig.classOrder.filter(c => layoutConfig.visibleClasses[c]).map(cls => {
                    const ranks = studentReport.cumulative[cls] || [];
                    if (ranks.length === 0) return null;
                    return (
                       <div key={`cumul_${cls}`} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print-shadow-none print-break-avoid">
                          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-5 py-3 flex items-center justify-between print:bg-slate-100 border-b border-slate-200">
                             <h3 className="font-bold text-white print:text-slate-900 uppercase tracking-widest text-xs flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-amber-400 print:text-slate-600"/> Overall Cumulative Best</h3>
                             <span className="text-[10px] font-bold text-slate-300 print:text-slate-700 uppercase tracking-wider">{cls}</span>
                          </div>
                          <table className="w-full text-left">
                             <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                   <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">Rank</th>
                                   <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student</th>
                                   <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center w-24">Subj.</th>
                                   <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Total</th>
                                   <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Average</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                                {ranks.map(r => (
                                   <tr key={r.student_id} className="hover:bg-slate-50/50">
                                      <td className="px-5 py-2.5 font-bold text-slate-900 text-sm">{r.rank}</td>
                                      <td className="px-5 py-2.5">
                                         <span className="font-semibold text-slate-800 text-sm block">{r.student_name}</span>
                                         <span className="text-[10px] text-slate-400 uppercase tracking-wider">{r.reg_number} • <span className="text-blue-500 print:text-slate-500">{r.class_arm_name}</span></span>
                                      </td>
                                      <td className="px-5 py-2.5 text-center font-medium text-slate-600 text-sm">{r.subject_count}</td>
                                      <td className="px-5 py-2.5 text-right font-medium text-slate-600 text-sm">{r.total_score}</td>
                                      <td className="px-5 py-2.5 text-right font-bold text-slate-900 text-sm">{r.average}%</td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    );
                 })}

                 {/* Subject Awards */}
                 {pivotMode === 'subject_first' ? (
                    layoutConfig.subjectOrder.filter(s => layoutConfig.visibleSubjects[s]).map(sub => {
                       const classesForSub = layoutConfig.classOrder.filter(c => layoutConfig.visibleClasses[c] && studentReport.subjects[sub]?.[c]?.length > 0);
                       if (classesForSub.length === 0) return null;
                       return (
                         <div key={`sub_${sub}`} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print-shadow-none print-break-avoid">
                            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
                               <BookOpen className="w-4 h-4 text-blue-600 print:text-slate-600"/>
                               <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Best in {sub}</h3>
                            </div>
                            {classesForSub.map(cls => (
                               <div key={`${sub}_${cls}`} className="border-t first:border-t-0 border-slate-100">
                                  <div className="bg-white px-5 py-1.5 border-b border-slate-100"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cls}</span></div>
                                  <table className="w-full text-left">
                                     <tbody className="divide-y divide-slate-50">
                                        {studentReport.subjects[sub][cls].map((r:any) => (
                                           <tr key={r.student_id} className="hover:bg-slate-50/50">
                                              <td className="px-5 py-2 font-bold text-slate-400 text-xs w-16">{r.rank}</td>
                                              <td className="px-5 py-2">
                                                <span className="font-semibold text-slate-700 text-sm">{r.student_name}</span>
                                                <span className="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{r.reg_number} • <span className="text-blue-500 print:text-slate-500">{r.class_arm_name}</span></span>
                                              </td>
                                              <td className="px-5 py-2 text-right font-bold text-blue-700 text-sm w-24">{r.score}%</td>
                                           </tr>
                                        ))}
                                     </tbody>
                                  </table>
                               </div>
                            ))}
                         </div>
                       );
                    })
                 ) : (
                    layoutConfig.classOrder.filter(c => layoutConfig.visibleClasses[c]).map(cls => {
                       const subjectsForClass = layoutConfig.subjectOrder.filter(s => layoutConfig.visibleSubjects[s] && studentReport.subjects[s]?.[cls]?.length > 0);
                       if (subjectsForClass.length === 0) return null;
                       return (
                         <div key={`cls_${cls}`} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print-shadow-none page-break-before">
                            <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2">
                               <Layers className="w-4 h-4 text-blue-600 print:text-slate-600"/>
                               <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Subject Awards: {cls}</h3>
                            </div>
                            {subjectsForClass.map(sub => (
                               <div key={`${cls}_${sub}`} className="border-t first:border-t-0 border-slate-100 print-break-avoid">
                                  <div className="bg-white px-5 py-1.5 border-b border-slate-100"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sub}</span></div>
                                  <table className="w-full text-left">
                                     <tbody className="divide-y divide-slate-50">
                                        {studentReport.subjects[sub][cls].map((r:any) => (
                                           <tr key={r.student_id} className="hover:bg-slate-50/50">
                                              <td className="px-5 py-2 font-bold text-slate-400 text-xs w-16">{r.rank}</td>
                                              <td className="px-5 py-2">
                                                <span className="font-semibold text-slate-700 text-sm">{r.student_name}</span>
                                                <span className="block text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{r.reg_number} • <span className="text-blue-500 print:text-slate-500">{r.class_arm_name}</span></span>
                                              </td>
                                              <td className="px-5 py-2 text-right font-bold text-blue-700 text-sm w-24">{r.score}%</td>
                                           </tr>
                                        ))}
                                     </tbody>
                                  </table>
                               </div>
                            ))}
                         </div>
                       );
                    })
                 )}
              </div>

              {studentReport.disqualified.length > 0 && (
                 <div className="mt-10 bg-white rounded-xl border border-red-100 shadow-sm print-hidden overflow-hidden">
                    <div className="px-5 py-3 bg-red-50 border-b border-red-100 font-bold text-red-800 uppercase tracking-wider text-xs flex items-center justify-between">
                       <span>Disqualified (Rules Engine)</span>
                       <span className="bg-white text-red-600 px-2.5 py-0.5 rounded shadow-sm border border-red-100">{studentReport.disqualified.length}</span>
                    </div>
                    <table className="w-full text-left">
                       <tbody className="divide-y divide-slate-100">
                          {studentReport.disqualified.map((r:any) => (
                             <tr key={r.student_id}>
                                <td className="px-5 py-2 font-semibold text-slate-700 text-sm">{r.student_name} <span className="text-[10px] text-slate-400 uppercase ml-2">{r.class_arm_name}</span></td>
                                <td className="px-5 py-2 font-medium text-red-500 text-[11px] uppercase tracking-wide">{r.disqualified_reason}</td>
                                <td className="px-5 py-2 text-right font-bold text-slate-800 text-sm">{r.average}%</td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
            </>
          )}

          {/* === RENDER: GROUP RANKINGS === */}
          {groupReport && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Teacher Awards */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print-shadow-none print-break-avoid">
                 <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-5 py-3 flex items-center gap-2 print:bg-slate-100 border-b border-slate-200">
                    <Trophy className="w-4 h-4 text-amber-400 print:text-slate-600"/>
                    <h3 className="font-bold text-white print:text-slate-900 uppercase tracking-wider text-xs">Top Performing Classes</h3>
                 </div>
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                       <tr>
                          <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12">Rnk</th>
                          <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Class & Form Teacher</th>
                          <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Class Avg</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {groupReport.topClasses.map((c: any) => (
                          <tr key={c.name} className="hover:bg-slate-50/50">
                             <td className="px-5 py-3 font-bold text-slate-900 text-sm">{c.rank}</td>
                             <td className="px-5 py-3">
                                <span className="font-bold text-slate-800 text-sm block">{c.name}</span>
                                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Teacher: <span className="text-emerald-600 font-bold">{c.teacher}</span></span>
                             </td>
                             <td className="px-5 py-3 text-right font-bold text-slate-900 text-base">{c.average}%</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              {/* Subject Teacher Awards */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden print-shadow-none print-break-avoid">
                 <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600 print:text-slate-600"/>
                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">Top Subject Performance</h3>
                 </div>
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                       <tr>
                          <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12">Rnk</th>
                          <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Subject & Teacher</th>
                          <th className="px-5 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Subj Avg</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {groupReport.topSubjects.map((s: any) => (
                          <tr key={s.name+s.classArm} className="hover:bg-slate-50/50">
                             <td className="px-5 py-3 font-bold text-slate-900 text-sm">{s.rank}</td>
                             <td className="px-5 py-3">
                                <span className="font-bold text-slate-800 text-sm block uppercase">{s.name} <span className="text-[10px] text-slate-400 tracking-wider ml-1">{s.classArm}</span></span>
                                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Teacher: <span className="text-blue-600 font-bold">{s.teacher}</span></span>
                             </td>
                             <td className="px-5 py-3 text-right font-bold text-slate-900 text-base">{s.average}%</td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- LAYOUT DRAWER --- */}
      {showLayoutDrawer && (
         <div className="fixed inset-0 z-[60] flex justify-end print-hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowLayoutDrawer(false)}></div>
            <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right">
               <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs flex items-center gap-2"><LayoutGrid className="w-4 h-4"/> Layout Editor</h3>
                  <button onClick={() => setShowLayoutDrawer(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-5 space-y-6">
                  <div>
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Classes (Drag to Reorder)</h4>
                     <div className="space-y-2">
                        {layoutConfig.classOrder.map((cls, idx) => (
                           <div key={cls} draggable onDragStart={e => handleDragStart(e, idx, 'class')} onDragOver={handleDragOver} onDrop={e => handleDrop(e, idx, 'class')} className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-300">
                              <input type="checkbox" checked={layoutConfig.visibleClasses[cls]} onChange={e => setLayoutConfig(p => ({...p, visibleClasses: {...p.visibleClasses, [cls]: e.target.checked}}))} className="w-4 h-4 accent-blue-600" />
                              <span className={`text-xs font-semibold flex-1 ${!layoutConfig.visibleClasses[cls] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{cls}</span>
                           </div>
                        ))}
                     </div>
                  </div>
                  <div>
                     <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Subjects (Drag to Reorder)</h4>
                     <div className="space-y-2">
                        {layoutConfig.subjectOrder.map((sub, idx) => (
                           <div key={sub} draggable onDragStart={e => handleDragStart(e, idx, 'subject')} onDragOver={handleDragOver} onDrop={e => handleDrop(e, idx, 'subject')} className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm cursor-grab active:cursor-grabbing hover:border-slate-300">
                              <input type="checkbox" checked={layoutConfig.visibleSubjects[sub]} onChange={e => setLayoutConfig(p => ({...p, visibleSubjects: {...p.visibleSubjects, [sub]: e.target.checked}}))} className="w-4 h-4 accent-blue-600" />
                              <span className={`text-xs font-semibold flex-1 ${!layoutConfig.visibleSubjects[sub] ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{sub}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="p-5 border-t border-slate-100 bg-slate-50">
                  <button onClick={() => setShowLayoutDrawer(false)} className="w-full py-2.5 bg-slate-900 text-white font-bold uppercase tracking-wider text-xs rounded-lg hover:bg-slate-800 shadow-sm">Apply Layout</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}