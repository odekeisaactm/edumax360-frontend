'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { examsAPI } from '@/lib/assessment.service';
import {
  ArrowLeft, Printer, Download, Search, Loader2, AlertCircle,
  Key, Users, CheckCircle2, Shield, FileText, BookOpen, School,
  LayoutGrid, X, ChevronDown, Table2, Grid3X3,
  FileSpreadsheet, GraduationCap, AlertTriangle,
} from 'lucide-react';
import type { ExamDetail, ExamSchedulesStatusResponse, StudentExamAccess } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption   { id: number; name: string; }
interface SectionOption { id: number; name: string; }
interface SubjectCode   { subject_name: string; subject_code: string; exam_code: string; }

type PrintMode  = 'slips' | 'schedule';
type DownloadMode = 'pin_only' | 'full';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white disabled:bg-slate-50 disabled:text-slate-400';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

function extractError(err: any): string {
  return err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'An error occurred';
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, color, danger }: {
  icon: any; label: string; value: string | number; color: string; danger?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 ${danger ? 'border-red-200' : 'border-slate-100'}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0">
        <p className={`text-xs truncate ${danger ? 'text-red-500' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-sm font-bold ${danger ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
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
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          <div className="p-1.5">
            <button
              onClick={() => { onPrint('slips'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-violet-50 border border-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Grid3X3 className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">PIN Slips</p>
                <p className="text-[11px] text-slate-400">Compact · ~10 per page · exam codes on portal</p>
              </div>
            </button>
            <button
              onClick={() => { onPrint('schedule'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Table2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">PIN + Schedule</p>
                <p className="text-[11px] text-slate-400">Self-contained · ~4 per page · includes subject codes</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Download Dropdown ────────────────────────────────────────────────────────

function DownloadDropdown({ onDownload }: {
  onDownload: (format: 'csv' | 'xlsx', mode: DownloadMode) => void;
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
          <div className="p-1.5 border-b border-slate-50">
            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">PIN Only</p>
            <button
              onClick={() => { onDownload('csv', 'pin_only'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Table2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">CSV</p>
                <p className="text-[11px] text-slate-400">Name, reg, PIN, status</p>
              </div>
            </button>
            <button
              onClick={() => { onDownload('xlsx', 'pin_only'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Excel</p>
                <p className="text-[11px] text-slate-400">Name, reg, PIN, status</p>
              </div>
            </button>
          </div>
          <div className="p-1.5">
            <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full (with subjects)</p>
            <button
              onClick={() => { onDownload('csv', 'full'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Table2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">CSV</p>
                <p className="text-[11px] text-slate-400">One row per student, one column per subject</p>
              </div>
            </button>
            <button
              onClick={() => { onDownload('xlsx', 'full'); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-left"
            >
              <div className="w-8 h-8 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-xs">Excel</p>
                <p className="text-[11px] text-slate-400">One row per student, one column per subject</p>
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
  const [mounted, setMounted] = useState(false);

  const examId = params?.id ? parseInt(params.id as string) : null;
  const canView = user?.is_superuser || hasPermission('assessment_center.view_exammodel');

  // ── Data ──
  const [exam, setExam]                         = useState<ExamDetail | null>(null);
  const [schedulesStatus, setSchedulesStatus]   = useState<ExamSchedulesStatusResponse | null>(null);
  const [pageLoading, setPageLoading]           = useState(true);
  const [pageError, setPageError]               = useState('');

  // ── Filters ──
  const [selectedClassId, setSelectedClassId]     = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);

  // ── PIN data ──
  const [pins, setPins]               = useState<StudentExamAccess[]>([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [pinsError, setPinsError]     = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Print mode ──
  const [printMode, setPrintMode] = useState<PrintMode>('slips');

  useEffect(() => { setMounted(true); }, []);

  // ── Load exam + schedules ──
  useEffect(() => {
    if (!examId || !mounted) return;
    (async () => {
      setPageLoading(true);
      try {
        const [examData, statusData] = await Promise.all([
          examsAPI.get(examId),
          examsAPI.getSchedulesStatus(examId),
        ]);
        setExam(examData);
        setSchedulesStatus(statusData);
      } catch (err) {
        setPageError(extractError(err));
      } finally {
        setPageLoading(false);
      }
    })();
  }, [examId, mounted]);

  // ── Derived: classes present in this exam ──
  const classes: ClassOption[] = useMemo(() => {
    if (!schedulesStatus) return [];
    const map = new Map<number, string>();
    Object.values(schedulesStatus.schedules_by_subject).forEach((group: any) => {
      group.schedules.forEach((s: any) => {
        if (s.class_id) map.set(s.class_id, s.class);
      });
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [schedulesStatus]);

  // ── Derived: sections grouped by class ──
  const classSectionsMap: Map<number, SectionOption[]> = useMemo(() => {
    if (!schedulesStatus) return new Map();
    const result = new Map<number, Map<number, string>>();
    Object.values(schedulesStatus.schedules_by_subject).forEach((group: any) => {
      group.schedules.forEach((s: any) => {
        if (!s.class_id || !s.section_id || !s.section) return;
        if (!result.has(s.class_id)) result.set(s.class_id, new Map());
        result.get(s.class_id)!.set(s.section_id, s.section);
      });
    });
    const final = new Map<number, SectionOption[]>();
    result.forEach((sectionMap, classId) => {
      final.set(
        classId,
        Array.from(sectionMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });
    return final;
  }, [schedulesStatus]);

  const sectionsForClass = selectedClassId ? (classSectionsMap.get(selectedClassId) ?? []) : [];
  const hasSections = sectionsForClass.length > 0;

  // ── Derived: subject → exam code map for the current class+section ──
  const subjectCodes: SubjectCode[] = useMemo(() => {
    if (!schedulesStatus || !selectedClassId) return [];
    const result: SubjectCode[] = [];
    Object.entries(schedulesStatus.schedules_by_subject).forEach(([subjectName, group]: [string, any]) => {
      const match = group.schedules.find((s: any) =>
        s.class_id === selectedClassId &&
        (hasSections ? s.section_id === selectedSectionId : true)
      );
      if (match) {
        result.push({
          subject_name: subjectName,
          subject_code: group.subject_code,
          exam_code: match.exam_code,
        });
      }
    });
    return result.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  }, [schedulesStatus, selectedClassId, selectedSectionId, hasSections]);

  // ── Derived: total students in this class+section ──
  const totalStudentsInClass = useMemo(() => {
    if (!schedulesStatus || !selectedClassId) return 0;
    for (const group of Object.values(schedulesStatus.schedules_by_subject) as any[]) {
      const match = group.schedules.find((s: any) =>
        s.class_id === selectedClassId &&
        (hasSections ? s.section_id === selectedSectionId : true)
      );
      if (match) return match.students_count ?? 0;
    }
    return 0;
  }, [schedulesStatus, selectedClassId, selectedSectionId, hasSections]);

  // ── Handler: class change ──
  const handleClassChange = (classId: number) => {
    setSelectedClassId(classId);
    setSelectedSectionId(null);
    setPins([]);
    setPinsError('');
    setSearchQuery('');

    // Auto-select the only section if there's just one
    const classSections = classSectionsMap.get(classId) ?? [];
    if (classSections.length === 1) {
      setSelectedSectionId(classSections[0].id);
    }
  };

  // ── Load pins when class (+ optional section) is ready ──
  useEffect(() => {
    if (!examId || !selectedClassId) { setPins([]); return; }
    if (hasSections && !selectedSectionId) { setPins([]); return; }

    let cancelled = false;
    setLoadingPins(true);
    setPinsError('');

    examsAPI.getStudentPins(examId, {
      class_id: selectedClassId,
      class_section_id: selectedSectionId ?? undefined,
    })
      .then(response => {
        if (cancelled) return;
        setPins(response.pins ?? []);
      })
      .catch(err => {
        if (cancelled) return;
        setPinsError(extractError(err));
      })
      .finally(() => {
        if (!cancelled) setLoadingPins(false);
      });

    return () => { cancelled = true; };
  }, [examId, selectedClassId, selectedSectionId, hasSections]);

  // ── Filtered pins ──
  const filteredPins = useMemo(() => {
    if (!searchQuery.trim()) return pins;
    const q = searchQuery.toLowerCase();
    return pins.filter(p =>
      p.student_full_name.toLowerCase().includes(q) ||
      p.registration_number.toLowerCase().includes(q) ||
      p.pin.includes(searchQuery.trim())
    );
  }, [pins, searchQuery]);

  const usedCount    = pins.filter(p => p.is_used).length;
  const unusedCount  = pins.length - usedCount;
  const missingCount = Math.max(0, totalStudentsInClass - pins.length);

  const readyToLoad =
    !!selectedClassId && (!hasSections || !!selectedSectionId);

  // ── Print handler ──
  const handlePrint = (mode: PrintMode) => {
    setPrintMode(mode);
    setTimeout(() => window.print(), 60);
  };

  // ── Download handler ──
  const handleDownload = (format: 'csv' | 'xlsx', mode: DownloadMode) => {
    if (!filteredPins.length) return;

    const safeClass = classes.find(c => c.id === selectedClassId)?.name.replace(/\s+/g, '-') ?? 'class';
    const safeSection = sectionsForClass.find(s => s.id === selectedSectionId)?.name.replace(/\s+/g, '-') ?? '';
    const filenameBase = `pins-${safeClass}${safeSection ? `-${safeSection}` : ''}-${mode}`;

    // ── Build headers + rows ──
    let headers: string[];
    let rows: (string | number)[][];

    if (mode === 'pin_only') {
      headers = ['Student Name', 'Registration Number', 'PIN', 'Status'];
      rows = filteredPins.map(p => [
        p.student_full_name,
        p.registration_number,
        p.pin,
        p.is_used ? 'Used' : 'Unused',
      ]);
    } else {
      // "full" — one row per student, one column per subject
      headers = ['Student Name', 'Registration Number', 'PIN', 'Status', ...subjectCodes.map(s => s.subject_name)];
      rows = filteredPins.map(p => [
        p.student_full_name,
        p.registration_number,
        p.pin,
        p.is_used ? 'Used' : 'Unused',
        ...subjectCodes.map(s => s.exam_code),
      ]);
    }

    if (format === 'csv') {
      const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, mode === 'pin_only' ? 'PINs' : 'PINs + Schedule');
      XLSX.writeFile(wb, `${filenameBase}.xlsx`);
    }).catch(() => {
      // Fallback to CSV if xlsx import fails
      handleDownload('csv', mode);
    });
  };

  // ── Guards ──
  if (!mounted) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
    </div>
  );

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

  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name ?? '';
  const selectedSectionName = sectionsForClass.find(s => s.id === selectedSectionId)?.name ?? '';

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* SCREEN VIEW                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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
            <h2 className="text-sm font-semibold text-slate-800">Select Class</h2>
            <p className="text-xs text-slate-400 ml-1">Pins are one per student — the exam code is on the portal</p>
          </div>

          <div className={`grid gap-4 ${selectedClassId && hasSections ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Class */}
            <div>
              <label className={labelCls}><School className="inline h-3 w-3 mr-1" />Class</label>
              <select
                value={selectedClassId ?? ''}
                onChange={e => e.target.value && handleClassChange(parseInt(e.target.value))}
                className={inputCls}
              >
                <option value="">— Select class —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Section — only shown when the selected class actually has sections */}
            {selectedClassId && hasSections && (
              <div>
                <label className={labelCls}><LayoutGrid className="inline h-3 w-3 mr-1" />Section</label>
                <select
                  value={selectedSectionId ?? ''}
                  onChange={e => {
                    setSelectedSectionId(e.target.value ? parseInt(e.target.value) : null);
                    setSearchQuery('');
                  }}
                  className={inputCls}
                >
                  <option value="">— Select section —</option>
                  {sectionsForClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Error state for PIN load */}
        {pinsError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{pinsError}</p>
          </div>
        )}

        {/* Stats */}
        {readyToLoad && !loadingPins && pins.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatChip icon={Users}        label="Total Students" value={totalStudentsInClass} color="bg-gradient-to-br from-violet-500 to-purple-600" />
            <StatChip icon={Key}          label="PINs Issued"    value={pins.length}       color="bg-gradient-to-br from-sky-500 to-blue-600" />
            <StatChip icon={CheckCircle2} label="PINs Used"      value={usedCount}         color="bg-gradient-to-br from-emerald-500 to-green-600" />
            {missingCount > 0 ? (
              <StatChip icon={AlertTriangle} label="Missing PINs" value={missingCount}    color="bg-gradient-to-br from-red-500 to-rose-600" danger />
            ) : (
              <StatChip icon={FileText}    label="PINs Unused"   value={unusedCount}       color="bg-gradient-to-br from-amber-400 to-orange-500" />
            )}
          </div>
        )}

        {/* Missing PIN warning */}
        {readyToLoad && !loadingPins && missingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm text-amber-800">
              <p className="font-semibold">{missingCount} student{missingCount !== 1 ? 's' : ''} in this class {missingCount !== 1 ? 'have' : 'has'} no PIN</p>
              <p className="text-xs text-amber-700 mt-0.5">
                PINs are generated when the exam is published. If some students enrolled after publishing, they'll need to be added manually or the exam republished.
              </p>
            </div>
          </div>
        )}

        {/* Actions bar */}
        {readyToLoad && pins.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, reg number, or PIN…"
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
                Select a class{hasSections ? ' and section' : ''} above to load student PINs
              </p>
            </div>
          </div>
        ) : pins.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center py-20">
            <div className="text-center space-y-2">
              <Users className="h-8 w-8 text-slate-200 mx-auto" />
              <p className="text-sm text-slate-400">No students found for this class</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {filteredPins.length} student{filteredPins.length !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
              <span className="text-xs text-slate-400">
                {selectedClassName}{selectedSectionName ? ` · ${selectedSectionName}` : ''} · {subjectCodes.length} subject{subjectCodes.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Desktop header */}
            <div className="hidden sm:grid items-center gap-3 px-5 py-3 bg-slate-50/60 border-b border-slate-100"
                 style={{ gridTemplateColumns: '2.5rem 1fr 140px 130px 90px' }}>
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
                  style={{ gridTemplateColumns: '2.5rem 1fr 140px 130px 90px' }}
                >
                  <StudentAvatar imageUrl={(pin as any).student_image} name={pin.student_full_name} />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{pin.student_full_name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 sm:hidden">{pin.registration_number}</p>
                  </div>

                  <div className="hidden sm:block min-w-0">
                    <p className="text-sm font-mono text-slate-500 truncate">{pin.registration_number}</p>
                  </div>

                  <div>
                    <code className="px-2.5 py-1 bg-violet-50 text-violet-800 rounded-lg font-mono text-base font-bold tracking-widest border border-violet-100">
                      {pin.pin}
                    </code>
                  </div>

                  <div>
                    {pin.is_used ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-100">
                        <CheckCircle2 className="h-3 w-3" /> Used
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">
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

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PRINT VIEW                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
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
            .slip-row   { page-break-inside: avoid; }
            .cut-line {
              display: block !important;
              height: 1px;
              background-image: linear-gradient(to right, #94a3b8 50%, transparent 50%);
              background-size: 8px 1px;
              background-repeat: repeat-x;
              background-position: center;
              margin: 6px 0;
              position: relative;
              border: none !important;
            }
            .cut-line::before {
              content: "✂";
              position: absolute;
              left: -20px;
              top: 50%;
              transform: translateY(-50%);
              font-size: 12px;
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
              margin: 0 10px;
              flex-shrink: 0;
              position: relative;
            }
            .cut-line-vertical::before {
              content: "✂";
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(90deg);
              font-size: 12px;
              color: #94a3b8;
              background: white;
              padding: 2px;
            }
          }
        `}</style>

        <div className="p-4">
          {/* Print header */}
          <div className="text-center mb-4 pb-3 border-b-2 border-slate-300">
            <h1 className="text-xl font-bold text-slate-900">Student Exam Access PINs</h1>
            <p className="text-sm text-slate-600 mt-0.5">{exam?.name}</p>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-500 mt-1.5">
              <span>Class: <strong>{selectedClassName}{selectedSectionName ? ` · ${selectedSectionName}` : ''}</strong></span>
              <span>Students: <strong>{filteredPins.length}</strong></span>
              <span>Mode: <strong>{printMode === 'slips' ? 'PIN Only' : 'PIN + Schedule'}</strong></span>
            </div>
          </div>

          <div className="bg-slate-50 rounded border border-slate-200 p-2.5 mb-3 text-[11px] text-slate-700">
            {printMode === 'slips' ? (
              <><strong>How to use:</strong> Each student uses their PIN at the exam door. They look up the exam code for each subject on the student portal (Class → Subject → Schedule).</>
            ) : (
              <><strong>How to use:</strong> Each student uses their PIN and the exam code for the specific subject they're writing — both are on the slip below.</>
            )}{' '}
            Keep this document confidential.
          </div>

          {/* ── Slips mode ── */}
          {printMode === 'slips' && (() => {
            const PER_ROW = 2;
            const rows: StudentExamAccess[][] = [];
            for (let i = 0; i < filteredPins.length; i += PER_ROW) {
              rows.push(filteredPins.slice(i, i + PER_ROW));
            }
            return rows.map((rowPins, rowIndex) => (
              <div key={rowIndex}>
                {rowIndex > 0 && <div className="cut-line" />}
                <div className="slip-row flex gap-0">
                  {rowPins.map((pin, colIndex) => (
                    <React.Fragment key={pin.id}>
                      {colIndex === 1 && <div className="cut-line-vertical" />}
                      <div className="flex-1 px-3 py-2 break-inside-avoid">
                        <div className="flex items-start gap-2 mb-1.5">
                          {(pin as any).student_image ? (
                            <img src={(pin as any).student_image} alt={pin.student_full_name}
                                 className="w-8 h-8 rounded object-cover border border-slate-200 flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-xs leading-tight truncate">{pin.student_full_name}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{pin.registration_number}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">#{filteredPins.indexOf(pin) + 1}</span>
                        </div>
                        <div className="text-center py-1.5 bg-slate-100 rounded font-mono text-xl font-black tracking-[0.3em] text-slate-900">
                          {pin.pin}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 px-1">
                          <span>{selectedClassName}{selectedSectionName ? ` · ${selectedSectionName}` : ''}</span>
                          <span>Exam code: <em>on portal</em></span>
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                  {rowPins.length === 1 && <div className="flex-1" />}
                </div>
              </div>
            ));
          })()}

          {/* ── Schedule mode (self-contained) ── */}
          {printMode === 'schedule' && (() => {
            const PER_ROW = 2;
            const rows: StudentExamAccess[][] = [];
            for (let i = 0; i < filteredPins.length; i += PER_ROW) {
              rows.push(filteredPins.slice(i, i + PER_ROW));
            }
            return rows.map((rowPins, rowIndex) => (
              <div key={rowIndex}>
                {rowIndex > 0 && <div className="cut-line" />}
                <div className="slip-row flex gap-0">
                  {rowPins.map((pin, colIndex) => (
                    <React.Fragment key={pin.id}>
                      {colIndex === 1 && <div className="cut-line-vertical" />}
                      <div className="flex-1 px-3 py-2.5 break-inside-avoid">
                        <div className="flex items-start gap-2 mb-2">
                          {(pin as any).student_image ? (
                            <img src={(pin as any).student_image} alt={pin.student_full_name}
                                 className="w-10 h-10 rounded object-cover border border-slate-200 flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="h-5 w-5 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-sm leading-tight truncate">{pin.student_full_name}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{pin.registration_number}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{selectedClassName}{selectedSectionName ? ` · ${selectedSectionName}` : ''}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">#{filteredPins.indexOf(pin) + 1}</span>
                        </div>

                        <div className="text-center py-1.5 bg-slate-100 rounded font-mono text-xl font-black tracking-[0.3em] text-slate-900 mb-2">
                          {pin.pin}
                        </div>

                        <table className="w-full text-[9px]" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <th style={{ padding: '2px 3px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Subject</th>
                              <th style={{ padding: '2px 3px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>Exam Code</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subjectCodes.map(s => (
                              <tr key={s.subject_code} style={{ borderBottom: '1px dotted #f1f5f9' }}>
                                <td style={{ padding: '1.5px 3px', color: '#475569' }}>{s.subject_name}</td>
                                <td style={{ padding: '1.5px 3px', fontFamily: 'monospace', fontWeight: 700, color: '#4c1d95' }}>{s.exam_code}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </React.Fragment>
                  ))}
                  {rowPins.length === 1 && <div className="flex-1" />}
                </div>
              </div>
            ));
          })()}

          <div className="cut-line" style={{ marginTop: 14 }} />
          <div className="pt-2 text-center text-[10px] text-slate-500">
            Printed: {new Date().toLocaleString()} · For official use only · Keep confidential
          </div>
        </div>
      </div>
    </>
  );
}