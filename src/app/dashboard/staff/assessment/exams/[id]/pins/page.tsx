'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { academicAPI } from '@/lib/api';
import { examsAPI } from '@/lib/assessment.service';
import {
  ArrowLeft, Printer, Download, Search, Loader2, AlertCircle,
  Key, Users, CheckCircle2, Shield, FileText, BookOpen, School,
  LayoutGrid, X, RefreshCw, ChevronDown, Table2, Grid3X3,
  FileSpreadsheet, GraduationCap,
} from 'lucide-react';
import type { ExamDetail, ExamSchedulesStatusResponse, StudentExamAccess } from '@/lib/types';
import type { AcademicSettings } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption  { id: number; name: string; }
interface SectionOption { id: number; name: string; }
interface SubjectSchedule {
  subject_id: number;
  subject_name: string;
  subject_code: string;
  schedule_id: number;
  exam_code: string;
}

type PrintMode = 'grid' | 'table';
type CSVMode   = 'table' | 'pin_only';
type XLSXMode  = 'table' | 'pin_only';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-slate-50 disabled:text-slate-400';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

function extractError(err: any): string {
  return err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'An error occurred';
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        <p className="text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

// ─── Student Avatar ───────────────────────────────────────────────────────────

function StudentAvatar({ imageUrl, name }: { imageUrl?: string; name: string }) {
  const [imgError, setImgError] = useState(false);
  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={name}
        onError={() => setImgError(true)}
        className="w-9 h-9 rounded-xl object-cover border border-slate-100 shadow-sm flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center flex-shrink-0">
      <GraduationCap className="h-4 w-4 text-violet-400" />
    </div>
  );
}

// ─── Print Dropdown ───────────────────────────────────────────────────────────

function PrintDropdown({ onPrint }: { onPrint: (mode: PrintMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
      >
        <Printer className="h-4 w-4" />
        Print
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          <div className="p-1.5">
            <button
              onClick={() => { onPrint('grid'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-violet-50 border border-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Grid3X3 className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Grid (Slip layout)</p>
                <p className="text-[11px] text-slate-400">2 slips per row, cut lines</p>
              </div>
            </button>
            <button
              onClick={() => { onPrint('table'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Table2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Table</p>
                <p className="text-[11px] text-slate-400">Name, reg, subject, PIN</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Download Dropdown ─────────────────────────────────────────────────────────

function DownloadDropdown({ onDownload }: {
  onDownload: (format: 'csv' | 'xlsx', mode: CSVMode | XLSXMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
      >
        <Download className="h-4 w-4" />
        Download
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          {/* CSV */}
          <div className="p-1.5 border-b border-slate-50">
            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">CSV</p>
            <button
              onClick={() => { onDownload('csv', 'table'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Table2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Table</p>
                <p className="text-[11px] text-slate-400">Name, reg, subject, code, PIN, status</p>
              </div>
            </button>
            <button
              onClick={() => { onDownload('csv', 'pin_only'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Key className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">PIN Only</p>
                <p className="text-[11px] text-slate-400">Name, reg, PIN, status</p>
              </div>
            </button>
          </div>
          {/* Excel */}
          <div className="p-1.5">
            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Excel</p>
            <button
              onClick={() => { onDownload('xlsx', 'table'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Table (.xlsx)</p>
                <p className="text-[11px] text-slate-400">Full details spreadsheet</p>
              </div>
            </button>
            <button
              onClick={() => { onDownload('xlsx', 'pin_only'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Key className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">PIN Only (.xlsx)</p>
                <p className="text-[11px] text-slate-400">Name, reg, PIN only</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrintPinsPage() {
  const router  = useRouter();
  const params  = useParams();
  const { hasPermission, user } = useAuth();

  const examId = params?.id ? parseInt(params.id as string) : null;
  const canView = user?.is_superuser || hasPermission('assessment_center.view_exammodel');

  // ── Data ──
  const [academicSettings, setAcademicSettings] = useState<AcademicSettings | null>(null);
  const [exam, setExam]                         = useState<ExamDetail | null>(null);
  const [schedulesStatus, setSchedulesStatus]   = useState<ExamSchedulesStatusResponse | null>(null);
  const [pageLoading, setPageLoading]           = useState(true);
  const [pageError, setPageError]               = useState('');

  // ── Filters ──
  const [classes, setClasses]               = useState<ClassOption[]>([]);
  const [sections, setSections]             = useState<SectionOption[]>([]);
  const [subjects, setSubjects]             = useState<SubjectSchedule[]>([]);
  const [selectedClassId, setSelectedClassId]   = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject]   = useState<SubjectSchedule | null>(null);
  const [loadingSections, setLoadingSections]   = useState(false);

  // ── PIN data ──
  const [pins, setPins]           = useState<StudentExamAccess[]>([]);
  const [examCode, setExamCode]   = useState<string | null>(null);
  const [loadingPins, setLoadingPins] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Print mode (stored for print view) ──
  const [printMode, setPrintMode] = useState<PrintMode>('grid');

  const useClassSections = academicSettings?.use_class_sections ?? false;

  // ── Load page ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!examId) return;
    (async () => {
      setPageLoading(true);
      try {
        const [settingsData, examData, statusData] = await Promise.all([
          academicAPI.getSettings(),
          examsAPI.get(examId),
          examsAPI.getSchedulesStatus(examId),
        ]);
        setAcademicSettings(settingsData);
        setExam(examData);
        setSchedulesStatus(statusData);

        const classMap = new Map<number, string>();
        Object.values(statusData.schedules_by_subject).forEach((group: any) => {
          group.schedules.forEach((s: any) => {
            if (s.class_id) classMap.set(s.class_id, s.class);
          });
        });
        setClasses(
          Array.from(classMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (err) {
        setPageError(extractError(err));
      } finally {
        setPageLoading(false);
      }
    })();
  }, [examId]);

  // ── Class change ───────────────────────────────────────────────────────────
  const handleClassChange = useCallback(async (classId: number) => {
    setSelectedClassId(classId);
    setSelectedSectionId(null);
    setSelectedSubject(null);
    setPins([]);
    setExamCode(null);

    if (schedulesStatus) {
      const subjectList: SubjectSchedule[] = [];
      Object.entries(schedulesStatus.schedules_by_subject).forEach(([subjectName, group]) => {
        const match = group.schedules.find(s => (s as any).class_id === classId);
        if (match) subjectList.push({
          subject_id: group.subject_id,
          subject_name: subjectName,
          subject_code: group.subject_code,
          schedule_id: match.id,
          exam_code: match.exam_code,
        });
      });
      setSubjects(subjectList.sort((a, b) => a.subject_name.localeCompare(b.subject_name)));
    }

    const sectionMap = new Map<number, string>();
    Object.values(schedulesStatus.schedules_by_subject).forEach((group: any) => {
      group.schedules.forEach((s: any) => {
        if (s.class_id === classId && s.section_id && s.section) {
          sectionMap.set(s.section_id, s.section);
        }
      });
    });
    setSections(
      Array.from(sectionMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [schedulesStatus, useClassSections]);

  // ── Load pins ──────────────────────────────────────────────────────────────
  const loadPins = useCallback(async (
    subject: SubjectSchedule, classId: number, sectionId: number | null,
  ) => {
    if (!examId) return;
    setLoadingPins(true);
    setPins([]);
    try {
      const response = await examsAPI.getStudentPins(examId, {
        class_id: classId,
        class_section_id: sectionId ?? undefined,
        schedule_id: subject.schedule_id,
      });

      setPins(response.pins);
      setExamCode((response as any).exam_code ?? subject.exam_code);
      console.log(response.pins);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoadingPins(false);
    }
  }, [examId]);

  const handleSubjectChange = (subject: SubjectSchedule) => {
    setSelectedSubject(subject);
    if (selectedClassId && (!useClassSections || selectedSectionId)) {
      loadPins(subject, selectedClassId, selectedSectionId);
    }
  };

  const handleSectionChange = (sectionId: number) => {
    setSelectedSectionId(sectionId);
    if (selectedSubject && selectedClassId) {
      loadPins(selectedSubject, selectedClassId, sectionId);
    }
  };

  // ── Filtered pins ─────────────────────────────────────────────────────────
  const filteredPins = searchQuery.trim()
    ? pins.filter(p =>
        p.student_full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.registration_number.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pins;

  const usedCount   = pins.filter(p => p.is_used).length;
  const unusedCount = pins.length - usedCount;

  // ── Print handler ─────────────────────────────────────────────────────────
  const handlePrint = (mode: PrintMode) => {
    setPrintMode(mode);
    // Wait for state to flush then print
    setTimeout(() => window.print(), 50);
  };

  // ── Download handlers ─────────────────────────────────────────────────────
  const handleDownload = (format: 'csv' | 'xlsx', mode: CSVMode | XLSXMode) => {
    if (!filteredPins.length || !selectedSubject) return;

    const isPinOnly = mode === 'pin_only';

    if (format === 'csv') {
      const headers = isPinOnly
        ? ['Student Name', 'Registration Number', 'PIN', 'Status']
        : ['Student Name', 'Registration Number', 'Subject', 'Exam Code', 'PIN', 'Status'];

      const rows = filteredPins.map(p => isPinOnly
        ? [p.student_full_name, p.registration_number, p.pin, p.is_used ? 'Used' : 'Unused']
        : [p.student_full_name, p.registration_number, selectedSubject.subject_name, examCode ?? '', p.pin, p.is_used ? 'Used' : 'Unused']
      );

      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `pins-${exam?.name ?? examId}-${selectedSubject.subject_code}${isPinOnly ? '-pin-only' : ''}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // XLSX — build via SheetJS if available, otherwise fall back to CSV
    try {
      // Dynamic import for environments that have xlsx
      import('xlsx').then(XLSX => {
        const headers = isPinOnly
          ? ['Student Name', 'Registration Number', 'PIN', 'Status']
          : ['Student Name', 'Registration Number', 'Subject', 'Exam Code', 'PIN', 'Status'];

        const data = filteredPins.map(p => isPinOnly
          ? [p.student_full_name, p.registration_number, p.pin, p.is_used ? 'Used' : 'Unused']
          : [p.student_full_name, p.registration_number, selectedSubject.subject_name, examCode ?? '', p.pin, p.is_used ? 'Used' : 'Unused']
        );

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'PINs');
        XLSX.writeFile(wb, `pins-${exam?.name ?? examId}-${selectedSubject.subject_code}${isPinOnly ? '-pin-only' : ''}.xlsx`);
      });
    } catch {
      // Fallback: treat as CSV with xlsx extension
      handleDownload('csv', mode);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!canView) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
          <Shield className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500">You don't have permission to view exam PINs.</p>
      </div>
    </div>
  );

  if (pageLoading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-violet-600 mx-auto" />
        <p className="text-sm text-slate-400">Loading exam data…</p>
      </div>
    </div>
  );

  if (pageError && !exam) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
        <p className="text-sm text-red-600">{pageError}</p>
        <button onClick={() => router.back()} className="text-sm text-violet-600 underline">Go back</button>
      </div>
    </div>
  );

  const readyToLoad = selectedClassId && selectedSubject && (sections.length === 0 || selectedSectionId);

  return (
    <>
      {/* ── Screen View ──────────────────────────────────────────────────────── */}
      <div className="space-y-6 pb-10 print:hidden">

        {/* Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors mt-1 flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">Student Exam PINs</h1>
            <p className="text-sm text-slate-500 mt-0.5 truncate">{exam?.name}</p>
          </div>
        </div>

        {/* Filter Panel */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
              <LayoutGrid className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">Filter</h2>
            <p className="text-xs text-slate-400 ml-1">Select a class and subject to load PINs</p>
          </div>

          <div className={`grid gap-4 ${sections.length > 0 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
            <div>
              <label className={labelCls}><School className="inline h-3 w-3 mr-1" />Class</label>
              <select value={selectedClassId ?? ''} onChange={e => e.target.value && handleClassChange(parseInt(e.target.value))} className={inputCls}>
                <option value="">— Select class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {sections.length > 0 && (
              <div>
                <label className={labelCls}><LayoutGrid className="inline h-3 w-3 mr-1" />Section</label>
                <select
                  value={selectedSectionId ?? ''}
                  onChange={e => e.target.value && handleSectionChange(parseInt(e.target.value))}
                  disabled={!selectedClassId || loadingSections}
                  className={inputCls}
                >
                  <option value="">{loadingSections ? 'Loading…' : !selectedClassId ? '— Select class first —' : '— Select section —'}</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}><BookOpen className="inline h-3 w-3 mr-1" />Subject</label>
              <select
                value={selectedSubject?.schedule_id ?? ''}
                onChange={e => { const found = subjects.find(s => s.schedule_id === parseInt(e.target.value)); if (found) handleSubjectChange(found); }}
                disabled={!selectedClassId || (sections.length > 0 && !selectedSectionId)}
                className={inputCls}
              >
                <option value="">
                  {!selectedClassId ? '— Select class first —'
                    : sections.length > 0 && !selectedSectionId ? '— Select section first —'
                    : subjects.length === 0 ? 'No subjects for this class'
                    : '— Select subject —'}
                </option>
                {subjects.map(s => <option key={s.schedule_id} value={s.schedule_id}>{s.subject_name} ({s.exam_code})</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        {pins.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatChip icon={Users}        label="Total Students" value={pins.length}    color="bg-gradient-to-br from-violet-500 to-purple-600" />
            <StatChip icon={CheckCircle2} label="PINs Used"      value={usedCount}      color="bg-gradient-to-br from-emerald-500 to-green-600" />
            <StatChip icon={Key}          label="PINs Unused"    value={unusedCount}    color="bg-gradient-to-br from-amber-400 to-orange-500"  />
            <StatChip icon={FileText}     label="Exam Code"      value={examCode ?? '—'} color="bg-gradient-to-br from-sky-500 to-blue-600"     />
          </div>
        )}

        {/* Actions bar */}
        {pins.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name or reg number…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <DownloadDropdown onDownload={handleDownload} />
                <PrintDropdown onPrint={handlePrint} />
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {loadingPins ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center py-16">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500 mx-auto" />
              <p className="text-sm text-slate-400">Loading student PINs…</p>
            </div>
          </div>
        ) : !readyToLoad ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center py-20">
            <div className="text-center space-y-3 max-w-sm">
              <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto">
                <Key className="h-7 w-7 text-violet-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Select a class{useClassSections ? ', section,' : ''} and subject above to load student PINs
              </p>
            </div>
          </div>
        ) : pins.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center py-20">
            <div className="text-center space-y-2">
              <Users className="h-8 w-8 text-slate-200 mx-auto" />
              <p className="text-sm text-slate-400">No students found for this selection</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Table header row */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {filteredPins.length} student{filteredPins.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              {selectedSubject && examCode && (
                <span className="text-xs text-slate-400">
                  {selectedSubject.subject_name} ·
                  <code className="ml-1 font-mono font-bold text-violet-600">{examCode}</code>
                </span>
              )}
            </div>

            {/* Column headers */}
            <div
              className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
              style={{ gridTemplateColumns: '2.5rem 1fr 140px 140px 80px' }}
            >
              <span />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Student</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Reg. Number</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">PIN</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filteredPins.map(pin => (
                <div
                  key={pin.id}
                  className="flex sm:grid items-center gap-3 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                  style={{ gridTemplateColumns: '2.5rem 1fr 140px 140px 80px' }}
                >
                  {/* Avatar */}
                  <StudentAvatar imageUrl={(pin as any).student_image} name={pin.student_full_name} />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{pin.student_full_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{pin.registration_number}</p>
                  </div>

                  {/* Reg */}
                  <div className="hidden sm:block min-w-0">
                    <p className="text-sm font-mono text-slate-500 truncate">{pin.registration_number}</p>
                  </div>

                  {/* PIN */}
                  <div className="hidden sm:block">
                    <code className="px-2.5 py-1 bg-violet-50 text-violet-800 rounded-lg font-mono text-base font-bold tracking-widest border border-violet-100">
                      {pin.pin}
                    </code>
                  </div>

                  {/* Mobile PIN (visible on small screens) */}
                  <div className="sm:hidden">
                    <code className="px-2 py-0.5 bg-violet-50 text-violet-800 rounded font-mono text-sm font-bold tracking-widest border border-violet-100">
                      {pin.pin}
                    </code>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block">
                    {pin.is_used ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                        <CheckCircle2 className="h-3 w-3" /> Used
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">
                        <Key className="h-3 w-3" /> Unused
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Print View ───────────────────────────────────────────────────────── */}
      <div className="hidden print:block">
        <style jsx>{`
          @media print {
            @page { margin: 1cm; size: A4; }
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            .md\\:flex-shrink-0 { display: none !important; }
            header.bg-white { display: none !important; }
            .flex-1.flex-col { display: block !important; }
            main.flex-1 { padding: 0 !important; margin: 0 !important; }
            .print\\:hidden { display: none !important; }
            .print\\:block  { display: block !important; }
            .pin-slip-row   { page-break-inside: avoid; }
            .cut-line {
              display: block !important;
              height: 1px;
              background-image: linear-gradient(to right, #94a3b8 50%, transparent 50%);
              background-size: 8px 1px;
              background-repeat: repeat-x;
              background-position: center;
              margin: 8px 0;
              position: relative;
              border: none !important;
            }
            .cut-line::before {
              content: "✂";
              position: absolute;
              left: -20px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 13px;
              color: #94a3b8;
              background: white;
              padding-right: 3px;
            }
            .cut-line-vertical {
              display: block !important;
              width: 1px;
              align-self: stretch;
              background-image: linear-gradient(to bottom, #94a3b8 50%, transparent 50%);
              background-size: 1px 8px;
              background-repeat: repeat-y;
              background-position: center;
              margin: 0 12px;
              flex-shrink: 0;
              position: relative;
            }
            .cut-line-vertical::before {
              content: "✂";
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(90deg);
              font-size: 13px;
              color: #94a3b8;
              background: white;
              padding: 2px;
            }
          }
        `}</style>

        <div className="p-6">
          {/* Print header */}
          <div className="text-center mb-6 pb-4 border-b-2 border-slate-300">
            <h1 className="text-2xl font-bold text-slate-900">Student Exam Access PINs</h1>
            <p className="text-base text-slate-600 mt-1">{exam?.name}</p>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-500 mt-2">
              <span>Subject: <strong>{selectedSubject?.subject_name}</strong></span>
              <span>Exam Code: <strong className="font-mono">{examCode}</strong></span>
              <span>Total: <strong>{filteredPins.length} students</strong></span>
            </div>
          </div>

          <div className="bg-slate-50 rounded border border-slate-200 p-3 mb-4 text-xs text-slate-700">
            <strong>Instructions:</strong> Each student uses their unique PIN together with the exam code to access their exam.
            PINs are valid for the entire exam period. Keep this document confidential.
          </div>

          {/* Grid mode */}
          {printMode === 'grid' && (() => {
            const rows: StudentExamAccess[][] = [];
            for (let i = 0; i < filteredPins.length; i += 2) rows.push(filteredPins.slice(i, i + 2));
            return rows.map((rowPins, rowIndex) => (
              <div key={rowIndex}>
                {rowIndex > 0 && <div className="cut-line" />}
                <div className="pin-slip-row flex gap-0">
                  {rowPins.map((pin, colIndex) => (
                    <React.Fragment key={pin.id}>
                      {colIndex === 1 && <div className="cut-line-vertical" />}
                      <div className="flex-1 p-3 break-inside-avoid">
                        <div className="flex items-start gap-2 mb-2">
                          {/* Photo in print slip */}
                          {(pin as any).student_image ? (
                            <img
                              src={(pin as any).student_image}
                              alt={pin.student_full_name}
                              className="w-10 h-10 rounded object-cover border border-slate-200 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="h-5 w-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-sm leading-tight truncate">{pin.student_full_name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{pin.registration_number}</p>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">#{filteredPins.indexOf(pin) + 1}</span>
                        </div>
                        <div className="space-y-1.5 pt-2 border-t border-slate-200">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Subject</span>
                            <span className="font-semibold text-slate-700">{selectedSubject?.subject_name}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Exam Code</span>
                            <code className="font-mono font-bold text-slate-800">{examCode}</code>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-500 mb-1">PIN</p>
                            <div className="text-center py-1.5 bg-slate-100 rounded font-mono text-2xl font-black tracking-[0.3em] text-slate-900">
                              {pin.pin}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                  {rowPins.length === 1 && <div className="flex-1" />}
                </div>
              </div>
            ));
          })()}

          {/* Table mode */}
          {printMode === 'table' && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>#</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Student Name</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Reg. Number</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Subject</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Exam Code</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>PIN</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#64748b' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPins.map((pin, idx) => (
                  <tr key={pin.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                    <td style={{ padding: '7px 12px', color: '#94a3b8' }}>{idx + 1}</td>
                    <td style={{ padding: '7px 12px', fontWeight: 600, color: '#1e293b' }}>{pin.student_full_name}</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#64748b' }}>{pin.registration_number}</td>
                    <td style={{ padding: '7px 12px', color: '#475569' }}>{selectedSubject?.subject_name}</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{examCode}</td>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 900, fontSize: 15, letterSpacing: '0.15em', color: '#4c1d95' }}>{pin.pin}</td>
                    <td style={{ padding: '7px 12px', color: pin.is_used ? '#059669' : '#94a3b8', fontWeight: 600 }}>{pin.is_used ? 'Used' : 'Unused'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="cut-line" style={{ marginTop: 16 }} />
          <div className="pt-3 text-center text-xs text-slate-500">
            Printed: {new Date().toLocaleString()} · For official use only · Keep confidential
          </div>
        </div>
      </div>
    </>
  );
}