'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authorizedDevicesAPI, schoolInfoAPI } from '@/lib/api';
import { examEntryAPI, publicExamAPI } from '@/lib/assessment.service';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import {
  Shield, Lock, AlertCircle, CheckCircle2, Loader2,
  BookOpen, User, Key, AlertTriangle, X, Search,
  ChevronRight, ArrowLeft,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SchoolInfo { name: string; short_name?: string; logo?: string | null; }

type PageStep = 'checking-device' | 'unauthorized' | 'entry-form' | 'validating';
// reg     → student types / resolves a reg number
// confirm → "Is this you?" card (typed numbers only)
// ready   → pick exam + enter PIN
type EntryStage = 'reg' | 'confirm' | 'ready';

interface LookupExam {
  exam_name: string;
  exam_type: string;
  subject_name: string;
  exam_code: string;
  schedule_id: number;
  start_datetime: string;
  duration_minutes: number;
}
interface LookupResult {
  student_name: string;
  registration_number: string;
  class_name: string;
  section_name: string | null;
  exams: LookupExam[];
}

const apiMessage = (err: any, fallback: string): string => {
  const msg =
    err?.response?.data?.detail ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;
  return String(msg);
};

const classLabel = (l: LookupResult) =>
  `${l.class_name}${l.section_name ? ` · ${l.section_name}` : ''}`;

// ─── Helper Drawer ─────────────────────────────────────────────────────────────
// For students who don't know their reg number: class → section → name.
// It only RESOLVES a reg number and hands it back; the main page does the rest.
// Public + device-gated endpoints only. Never returns PINs.

type HelperStep = 'class' | 'section' | 'student';

interface HelperSection { id: number | null; name: string; class_configuration_id: number; }
interface HelperClass { id: number; name: string; sections: HelperSection[]; }
interface HelperStudent { name: string; registration_number: string; }

const STUDENT_PAGE_SIZE = 8;

function HelperDrawer({
  deviceFingerprint,
  onResolved,
  onClose,
}: {
  deviceFingerprint: string;
  onResolved: (regNumber: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<HelperStep>('class');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [classes, setClasses] = useState<HelperClass[]>([]);
  const [selectedClass, setSelectedClass] = useState<HelperClass | null>(null);

  const [students, setStudents] = useState<HelperStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(STUDENT_PAGE_SIZE);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await publicExamAPI.classes(deviceFingerprint);
        if (cancelled) return;
        if (data.length === 0) {
          setError('No exam is scheduled today. Please check with your teacher.');
          return;
        }
        setClasses(data);
      } catch (e: any) {
        if (!cancelled) setError(apiMessage(e, 'Could not load classes. Please try again.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [deviceFingerprint]);

  useEffect(() => {
    if (step !== 'student') return;
    const t = setTimeout(() => searchRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [step]);

  const loadStudents = async (section: HelperSection) => {
    setError('');
    setLoading(true);
    try {
      const data = await publicExamAPI.students(section.class_configuration_id, deviceFingerprint);
      if (data.length === 0) {
        setError('No students are registered for exams in this class today.');
        return;
      }
      setStudents(data);
      setStudentSearch('');
      setVisibleCount(STUDENT_PAGE_SIZE);
      setStep('student');
    } catch (e: any) {
      setError(apiMessage(e, 'Could not load students. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleClassSelect = (cls: HelperClass) => {
    setSelectedClass(cls);
    setError('');
    if (cls.sections.length === 1) {
      loadStudents(cls.sections[0]);
    } else {
      setStep('section');
    }
  };

  const handleStudentSelect = (s: HelperStudent) => {
    onResolved(s.registration_number);
    onClose();
  };

  const hasMultipleSections = (selectedClass?.sections.length ?? 0) > 1;

  const handleBack = () => {
    setError('');
    if (step === 'student') {
      setStep(hasMultipleSections ? 'section' : 'class');
      return;
    }
    if (step === 'section') {
      setStep('class');
      return;
    }
    onClose();
  };

  const filteredStudents = studentSearch.trim()
    ? students.filter(
        s =>
          s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
          s.registration_number.toLowerCase().includes(studentSearch.toLowerCase()),
      )
    : students;
  const visibleStudents = filteredStudents.slice(0, visibleCount);
  const hiddenCount = filteredStudents.length - visibleStudents.length;

  const stepLabel: Record<HelperStep, string> = {
    class: 'Select Your Class',
    section: 'Select Your Section',
    student: 'Find Your Name',
  };

  const optionClass =
    'w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-all text-left group';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-bold text-slate-800">{stepLabel[step]}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500 mx-auto" />
              <p className="text-xs text-slate-400">Loading…</p>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-5 space-y-2">
            {step === 'class' &&
              classes.map(cls => (
                <button key={cls.id} onClick={() => handleClassSelect(cls)} className={optionClass}>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                    {cls.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
                </button>
              ))}

            {step === 'section' && (
              <>
                <p className="text-xs text-slate-400 mb-1">
                  Class: <strong className="text-slate-600">{selectedClass?.name}</strong>
                </p>
                {selectedClass?.sections.map(sec => (
                  <button
                    key={sec.class_configuration_id}
                    onClick={() => loadStudents(sec)}
                    className={optionClass}
                  >
                    <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                      {sec.name}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
                  </button>
                ))}
              </>
            )}

            {step === 'student' && (
              <>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search your name…"
                    value={studentSearch}
                    onChange={e => {
                      setStudentSearch(e.target.value);
                      setVisibleCount(STUDENT_PAGE_SIZE);
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">
                    No students match your search
                  </p>
                ) : (
                  visibleStudents.map(s => (
                    <button
                      key={s.registration_number}
                      onClick={() => handleStudentSelect(s)}
                      className={optionClass}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                          {s.name}
                        </p>
                        <p className="text-xs font-mono text-slate-400">{s.registration_number}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
                    </button>
                  ))
                )}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setVisibleCount(c => c + STUDENT_PAGE_SIZE)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline w-full text-center py-2"
                  >
                    Show more ({hiddenCount} hidden)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function ExamEntryPage() {
  const router = useRouter();

  const [pageStep, setPageStep] = useState<PageStep>('checking-device');
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [approvalRequested, setApprovalRequested] = useState(false);
  const [showHelper, setShowHelper] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);

  // Identity flow
  const [stage, setStage] = useState<EntryStage>('reg');
  const [regInput, setRegInput] = useState('');
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [selectedExam, setSelectedExam] = useState<LookupExam | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');

  // Entry
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pinSectionRef = useRef<HTMLDivElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // The form is replaced by a spinner while validating; bring the error back into view.
  useEffect(() => {
    if (!error || pageStep !== 'entry-form') return;
    const t = setTimeout(() => {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(t);
  }, [error, pageStep]);

  // Once an exam is chosen, bring the PIN field into view and focus it.
  useEffect(() => {
    if (stage !== 'ready' || !selectedExam) return;
    const t = setTimeout(() => {
      pinSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      pinInputRef.current?.focus({ preventScroll: true });
    }, 200);
    return () => clearTimeout(t);
  }, [stage, selectedExam]);

  useEffect(() => {
    checkDevice();
    schoolInfoAPI.get().then(setSchoolInfo).catch(() => {});
  }, []);

  const checkDevice = async () => {
    try {
      const fp = await getDeviceFingerprint();
      setDeviceFingerprint(fp);
      const status = await authorizedDevicesAPI.checkDeviceStatus(fp);
      setPageStep(status.status === 'approved' ? 'entry-form' : 'unauthorized');
    } catch {
      setPageStep('unauthorized');
    }
  };

  const requestDeviceApproval = async () => {
    setLoading(true);
    setError('');
    try {
      await authorizedDevicesAPI.requestApproval(deviceFingerprint);
      setApprovalRequested(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to request approval.');
    } finally {
      setLoading(false);
    }
  };

  // skipConfirm = true when the student picked their own name in the helper
  // drawer (that already identified them), so we go straight to exam + PIN.
  const findExams = async (reg: string, skipConfirm = false) => {
    const cleaned = reg.trim().toUpperCase();
    if (!cleaned) {
      setLookupError('Enter your registration number');
      return;
    }
    setLookupError('');
    setError('');
    setLookingUp(true);
    try {
      const data = await publicExamAPI.lookup(cleaned, deviceFingerprint);
      setLookup(data);
      setRegInput(data.registration_number);
      setPin('');
      setSelectedExam(data.exams.length === 1 ? data.exams[0] : null);
      setStage(skipConfirm ? 'ready' : 'confirm');
    } catch (err: any) {
      setLookupError(apiMessage(err, 'Could not find your exams. Please try again.'));
      setStage('reg');
    } finally {
      setLookingUp(false);
    }
  };

  const resetIdentity = () => {
    setStage('reg');
    setLookup(null);
    setSelectedExam(null);
    setPin('');
    setError('');
    setLookupError('');
  };

  const selectExam = (ex: LookupExam) => {
    setSelectedExam(ex);
    setPin('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!lookup || !selectedExam) {
      setError('Select your exam first');
      return;
    }
    if (pin.length !== 6) {
      setError('PIN must be exactly 6 digits');
      return;
    }

    setLoading(true);
    setPageStep('validating');

    try {
      const data = await examEntryAPI.validateEntry({
        exam_code: selectedExam.exam_code.toUpperCase().trim(),
        admission_number: lookup.registration_number.toUpperCase().trim(),
        pin,
        device_fingerprint: deviceFingerprint,
      });
      if (data.attempt_id) {
        router.push(`/assessment/exam/take?attempt=${data.attempt_id}`);
      } else {
        throw new Error('No attempt ID received');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.exam?.[0] ||
        err?.response?.data?.exam_code?.[0] ||
        err?.response?.data?.admission_number?.[0] ||
        err?.response?.data?.pin?.[0] ||
        err?.response?.data?.error ||
        err?.message ||
        'Invalid credentials. Please check and try again.';
      setError(msg);
      setPageStep('entry-form');
      setLoading(false);
    }
  };

  // ── Shared branding header ─────────────────────────────────────────────────
  const BrandingHeader = ({ compact = false }: { compact?: boolean }) => (
    <div className={`text-center ${compact ? 'mb-4' : 'mb-8'}`}>
      <div className={`flex items-center justify-center ${compact ? 'mb-2' : 'mb-4'}`}>
        {schoolInfo?.logo ? (
          <img
            src={schoolInfo.logo}
            alt={schoolInfo.name}
            className={`${compact ? 'h-11 w-11' : 'h-16 w-16'} object-contain rounded-xl shadow-md`}
          />
        ) : (
          <div className={`${compact ? 'w-11 h-11' : 'w-16 h-16'} bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200`}>
            <BookOpen className={`${compact ? 'h-5 w-5' : 'h-8 w-8'} text-white`} />
          </div>
        )}
      </div>
      {schoolInfo?.name && (
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
          {schoolInfo.name}
        </p>
      )}
      <h1 className={`${compact ? 'text-xl' : 'text-2xl'} font-bold text-slate-900`}>Exam Entry</h1>
      {!compact && <p className="text-sm text-slate-500 mt-1">Enter your credentials to begin</p>}
    </div>
  );

  // ── Checking device ────────────────────────────────────────────────────────
  if (pageStep === 'checking-device') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Checking device…</p>
            <p className="text-sm text-slate-400 mt-1">Verifying device authorization</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Unauthorized ───────────────────────────────────────────────────────────
  if (pageStep === 'unauthorized') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <BrandingHeader />
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 text-center space-y-5">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
              <Shield className="h-7 w-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Device Not Authorized</h2>
              <p className="text-sm text-slate-500 mt-2">
                This device hasn&apos;t been approved for exam access. Contact your administrator to request approval.
              </p>
            </div>
            {!approvalRequested ? (
              <div className="space-y-3">
                <button
                  onClick={requestDeviceApproval}
                  disabled={loading}
                  className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-200 transition-all"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Requesting…</>
                  ) : (
                    <><Shield className="h-4 w-4" />Request Approval</>
                  )}
                </button>
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-left">
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Request Sent</p>
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Please wait for your administrator to approve this device, then refresh the page.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Validating ─────────────────────────────────────────────────────────────
  if (pageStep === 'validating') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Validating credentials…</p>
            <p className="text-sm text-slate-400 mt-1">Please wait</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Entry form ─────────────────────────────────────────────────────────────
  const labelClass =
    'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
  const primaryBtn =
    'w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 text-base';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {showHelper && (
        <HelperDrawer
          deviceFingerprint={deviceFingerprint}
          onResolved={reg => findExams(reg, true)}
          onClose={() => setShowHelper(false)}
        />
      )}

      <div className="w-full max-w-md">
        <BrandingHeader compact />

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Device badge */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-50 flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-emerald-700">Device Authorized</span>
          </div>

          {/* ── Stage 1: registration number ── */}
          {stage === 'reg' && (
            <form
              onSubmit={e => {
                e.preventDefault();
                findExams(regInput);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className={labelClass}>
                  <User className="inline h-3 w-3 mr-1.5" />Admission / Reg. Number
                </label>
                <input
                  type="text"
                  autoFocus
                  value={regInput}
                  onChange={e => setRegInput(e.target.value.toUpperCase())}
                  placeholder="Enter your registration number"
                  autoComplete="off"
                  className="w-full px-4 py-2.5 border-2 border-slate-200 bg-white rounded-xl text-sm transition-all focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                />
              </div>

              {lookupError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{lookupError}</p>
                </div>
              )}

              <button type="submit" disabled={lookingUp || !regInput.trim()} className={primaryBtn}>
                {lookingUp ? (
                  <><Loader2 className="h-5 w-5 animate-spin" />Searching…</>
                ) : (
                  <><Search className="h-5 w-5" />Find My Exams</>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowHelper(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline w-full text-center"
              >
                Don&apos;t know your number?
              </button>
            </form>
          )}

          {/* ── Stage 2: confirm identity ── */}
          {stage === 'confirm' && lookup && (
            <div className="p-5 space-y-5">
              <div className="text-center space-y-1 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  Is this you?
                </p>
                <p className="text-2xl font-bold text-slate-900 break-words">{lookup.student_name}</p>
                <p className="text-sm font-medium text-slate-600">{classLabel(lookup)}</p>
                <p className="text-xs font-mono text-slate-400">{lookup.registration_number}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetIdentity}
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Not Me
                </button>
                <button
                  type="button"
                  onClick={() => setStage('ready')}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
                >
                  Yes, That&apos;s Me
                </button>
              </div>
            </div>
          )}

          {/* ── Stage 3: pick exam + PIN ── */}
          {stage === 'ready' && lookup && (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{lookup.student_name}</p>
                  <p className="text-xs text-slate-500">
                    {classLabel(lookup)} · <span className="font-mono">{lookup.registration_number}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetIdentity}
                  className="text-xs text-slate-400 hover:text-slate-600 underline flex-shrink-0"
                >
                  Not me
                </button>
              </div>

              <div>
                <label className={labelClass}>
                  <BookOpen className="inline h-3 w-3 mr-1.5" />Your exams today
                </label>
                <div className="space-y-2">
                  {lookup.exams.map(ex => {
                    const selected = selectedExam?.exam_code === ex.exam_code;
                    return (
                      <button
                        type="button"
                        key={ex.exam_code}
                        onClick={() => selectExam(ex)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                          selected
                            ? 'bg-blue-50 border-blue-500'
                            : 'bg-slate-50 border-slate-100 hover:bg-blue-50 hover:border-blue-200'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-slate-700'}`}>
                            {ex.subject_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {ex.exam_name}
                            {ex.exam_type ? ` · ${ex.exam_type}` : ''}
                          </p>
                          {ex.duration_minutes ? (
                            <p className="text-xs text-slate-400 mt-0.5">{ex.duration_minutes} min</p>
                          ) : null}
                        </div>
                        {selected ? (
                          <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 ml-2" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedExam && (
                <div ref={pinSectionRef} className="space-y-4 scroll-mb-6">
                  <div>
                    <label className={labelClass}>
                      <Key className="inline h-3 w-3 mr-1.5" />6-Digit PIN
                    </label>
                    <input
                      ref={pinInputRef}
                      type="text"
                      inputMode="numeric"
                      value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="● ● ● ● ● ●"
                      maxLength={6}
                      autoComplete="off"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-center font-mono text-2xl tracking-[0.5em] focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all bg-white"
                    />
                    <p className="text-xs text-slate-400 mt-1.5 text-center">
                      The 6-digit PIN given to you by your teacher
                    </p>
                  </div>

                  {error && (
                    <div ref={errorRef} className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <button type="submit" disabled={loading || pin.length !== 6} className={primaryBtn}>
                    {loading ? (
                      <><Loader2 className="h-5 w-5 animate-spin" />Validating…</>
                    ) : (
                      <><Lock className="h-5 w-5" />Enter Exam</>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Ensure you have a stable internet connection before starting
        </div>
      </div>
    </div>
  );
}