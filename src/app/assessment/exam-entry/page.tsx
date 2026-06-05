'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authorizedDevicesAPI, schoolInfoAPI, academicAPI } from '@/lib/api';
import { examsAPI, examEntryAPI } from '@/lib/assessment.service';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import {
  Shield, Lock, AlertCircle, CheckCircle2, Loader2,
  BookOpen, User, Key, AlertTriangle, X, Sparkles,
  ChevronRight, Search, ArrowLeft, GraduationCap,
} from 'lucide-react';
import type { Exam, ExamDetail } from '@/lib/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SchoolInfo { name: string; short_name?: string; logo?: string | null; }
interface ClassOption { id: number; name: string; }
interface SectionOption { id: number; name: string; }
interface SubjectOption {
  subject_name: string;
  schedule_id: number;
  exam_code: string;
}
interface StudentOption {
  student_full_name: string;
  registration_number: string;
}

type HelperStep = 'class' | 'section' | 'subject' | 'student' | 'confirm';
type PageStep = 'checking-device' | 'unauthorized' | 'entry-form' | 'validating';

// ─── Helper Drawer ─────────────────────────────────────────────────────────────

function HelperDrawer({
  onFill,
  onClose,
}: {
  onFill: (examCode: string, regNumber: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<HelperStep>('class');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rawClasses, setRawClasses] = useState<any[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [activeExam, setActiveExam] = useState<ExamDetail | null>(null);

  const [selectedClass, setSelectedClass] = useState<ClassOption | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionOption | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectOption | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Load classes on mount — derive sections from configurations, no settings call needed
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const classData = await academicAPI.listClasses();
        setRawClasses(classData);
        setClasses(classData.map((c: any) => ({ id: c.id, name: c.name })));
      } catch {
        setError('Failed to load class list. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (step === 'student') setTimeout(() => searchRef.current?.focus(), 100);
  }, [step]);

  const handleClassSelect = async (cls: ClassOption) => {
    setSelectedClass(cls);
    setError('');
    setLoading(true);
    try {
      // Derive sections from the configurations array already in the classes response
      const raw = rawClasses.find((c: any) => c.id === cls.id);
      const derivedSections: SectionOption[] = (raw?.configurations ?? [])
        .filter((cfg: any) => cfg.is_active)
        .map((cfg: any) => ({ id: cfg.class_section, name: cfg.class_section_name }))
        .sort((a: SectionOption, b: SectionOption) => a.name.localeCompare(b.name));

      setSections(derivedSections);

      if (derivedSections.length > 0) {
        // Class has sections — show section step
        setStep('section');
      } else {
        // No sections — go straight to subjects
        const exam = await findActiveExam(cls.id);
        if (!exam) {
          setError(`No active exam found for ${cls.name}. Please check with your teacher.`);
          return;
        }
        setActiveExam(exam);
        await loadSubjects(exam, cls.id, null);
      }
    } catch {
      setError('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Find the active exam that includes a given class
  const findActiveExam = async (classId: number): Promise<ExamDetail | null> => {
    const today = new Date().toISOString().split('T')[0];
    const candidates = await examsAPI.list({ is_published: true, is_active: true });
    const dateValid = candidates.filter((e: any) =>
      e.start_date <= today && e.end_date >= today
    );
    for (const candidate of dateValid) {
      const detail = await examsAPI.get(candidate.id);
      if (Array.isArray(detail.classes) && detail.classes.includes(classId)) {
        return detail;
      }
    }
    return null;
  };

  const handleSectionSelect = async (section: SectionOption) => {
    setSelectedSection(section);
    setError('');
    setLoading(true);
    try {
      const exam = await findActiveExam(selectedClass!.id);
      if (!exam) {
        setError(`No active exam found for ${selectedClass!.name}. Please check with your teacher.`);
        return;
      }
      setActiveExam(exam);
      await loadSubjects(exam, selectedClass!.id, section);
    } catch {
      setError('Failed to load subjects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Derive subjects from schedules_by_subject, filtering by class and section
  const loadSubjects = async (exam: ExamDetail, classId: number, section: SectionOption | null) => {
    const statusData = await examsAPI.getSchedulesStatus(exam.id);
    const subjectList: SubjectOption[] = [];

    Object.entries(statusData.schedules_by_subject).forEach(([subjectName, group]: [string, any]) => {
      const match = group.schedules?.find((s: any) => {
        if (s.class_id !== classId) return false;
        if (section && s.section_id !== section.id) return false;
        return true;
      });
      if (match) {
        subjectList.push({
          subject_name: subjectName,
          schedule_id: match.id,
          exam_code: match.exam_code,
        });
      }
    });

    if (subjectList.length === 0) {
      setError('No subjects found for this class in the active exam.');
      return;
    }
    setSubjects(subjectList.sort((a, b) => a.subject_name.localeCompare(b.subject_name)));
    setStep('subject');
  };

  const handleSubjectSelect = async (subject: SubjectOption) => {
    setSelectedSubject(subject);
    setError('');
    setLoading(true);
    try {
      const response = await examsAPI.getStudentPins(activeExam!.id, {
        class_id: selectedClass!.id,
        ...(selectedSection ? { class_section_id: selectedSection.id } : {}),
        schedule_id: subject.schedule_id,
      });
      const studentList: StudentOption[] = response.pins.map((p: any) => ({
        student_full_name: p.student_full_name,
        registration_number: p.registration_number,
      })).sort((a: StudentOption, b: StudentOption) =>
        a.student_full_name.localeCompare(b.student_full_name)
      );
      if (studentList.length === 0) {
        setError('No students found for this class and subject.');
        return;
      }
      setStudents(studentList);
      setStudentSearch('');
      setStep('student');
    } catch {
      setError('Failed to load student list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: StudentOption) => {
    setSelectedStudent(student);
    setStep('confirm');
  };

  const handleConfirm = () => {
    if (!selectedSubject || !selectedStudent) return;
    onFill(selectedSubject.exam_code, selectedStudent.registration_number);
    onClose();
  };

  const handleBack = () => {
    setError('');
    if (step === 'confirm') { setStep('student'); return; }
    if (step === 'student') { setStep('subject'); return; }
    if (step === 'subject') { setStep(sections.length > 0 ? 'section' : 'class'); return; }
    if (step === 'section') { setStep('class'); return; }
    onClose();
  };

  const filteredStudents = studentSearch.trim()
    ? students.filter(s =>
        s.student_full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.registration_number.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : students;

  const hasSections = sections.length > 0;
  const stepNumber: Record<HelperStep, number> = {
    class: 1,
    section: 2,
    subject: hasSections ? 3 : 2,
    student: hasSections ? 4 : 3,
    confirm: hasSections ? 5 : 4,
  };
  const totalSteps = hasSections ? 5 : 4;

  const stepLabel: Record<HelperStep, string> = {
    class: 'Select Your Class',
    section: 'Select Your Section',
    subject: 'Select Subject',
    student: 'Find Your Name',
    confirm: 'Confirm Details',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]">

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={handleBack}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-xs text-slate-400">Step {stepNumber[step]} of {totalSteps}</p>
              <h3 className="text-sm font-bold text-slate-800">{stepLabel[step]}</h3>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100 flex-shrink-0">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
            style={{ width: `${(stepNumber[step] / totalSteps) * 100}%` }}
          />
        </div>

        {/* Active exam badge */}
        {activeExam && (
          <div className="mx-5 mt-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 flex-shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <p className="text-xs font-medium text-blue-700 truncate">{activeExam.name}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-7 w-7 animate-spin text-blue-500 mx-auto" />
              <p className="text-xs text-slate-400">Loading…</p>
            </div>
          </div>
        )}

        {/* ── STEP: CLASS ── */}
        {!loading && step === 'class' && (
          <div className="overflow-y-auto flex-1 p-5 space-y-2">
            {classes.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No classes available</p>
            ) : classes.map(cls => (
              <button key={cls.id} onClick={() => handleClassSelect(cls)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-all text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white border border-slate-200 group-hover:border-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <GraduationCap className="h-4 w-4 text-slate-400 group-hover:text-blue-500" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{cls.name}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        )}

        {/* ── STEP: SECTION ── */}
        {!loading && step === 'section' && (
          <div className="overflow-y-auto flex-1 p-5 space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              Class: <strong className="text-slate-600">{selectedClass?.name}</strong>
            </p>
            {sections.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No sections found for this class</p>
            ) : sections.map(sec => (
              <button key={sec.id} onClick={() => handleSectionSelect(sec)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-all text-left group">
                <span className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{sec.name}</span>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        )}

        {/* ── STEP: SUBJECT ── */}
        {!loading && step === 'subject' && (
          <div className="overflow-y-auto flex-1 p-5 space-y-2">
            <p className="text-xs text-slate-400 mb-3">
              {selectedClass?.name}{selectedSection ? ` · ${selectedSection.name}` : ''}
            </p>
            {subjects.map(sub => (
              <button key={sub.schedule_id} onClick={() => handleSubjectSelect(sub)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-all text-left group">
                <div>
                  <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">{sub.subject_name}</p>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{sub.exam_code}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        )}

        {/* ── STEP: STUDENT ── */}
        {!loading && step === 'student' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search your name…"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {filteredStudents.length} of {students.length} students
              </p>
            </div>
            <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No students match your search</p>
              ) : filteredStudents.map(student => (
                <button key={student.registration_number}
                  onClick={() => handleStudentSelect(student)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-all text-left group">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700">
                      {student.student_full_name}
                    </p>
                    <p className="text-xs font-mono text-slate-400">{student.registration_number}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: CONFIRM ── */}
        {!loading && step === 'confirm' && selectedStudent && selectedSubject && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Scrollable details */}
            <div className="overflow-y-auto flex-1 px-5 pt-3 pb-2">
              <p className="text-xs text-slate-400 mb-3">
                Please confirm your details are correct before proceeding.
              </p>

              {[
                { label: 'Class', value: `${selectedClass?.name}${selectedSection ? ` · ${selectedSection.name}` : ''}` },
                { label: 'Subject', value: selectedSubject.subject_name },
                { label: 'Exam Code', value: selectedSubject.exam_code, mono: true },
                { label: 'Your Name', value: selectedStudent.student_full_name, bold: true },
                { label: 'Reg. No.', value: selectedStudent.registration_number, mono: true },
              ].map(row => (
                <div key={row.label}
                  className="flex items-start justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                  <span className="text-xs text-slate-400 flex-shrink-0 w-20">{row.label}</span>
                  <span className={`text-sm text-right flex-1 break-all ${
                    row.mono ? 'font-mono font-bold text-slate-800' :
                    row.bold ? 'font-bold text-slate-900' : 'text-slate-700'
                  }`}>{row.value}</span>
                </div>
              ))}

              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs text-amber-700">
                  <strong>Is this you?</strong> If anything looks wrong, tap Go Back.
                  After confirming, you only need to enter your PIN.
                </p>
              </div>
            </div>

            {/* Fixed action buttons */}
            <div className="flex gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
              <button onClick={handleBack}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                Go Back
              </button>
              <button onClick={handleConfirm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                Yes, That's Me
              </button>
            </div>
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

  const [examCode, setExamCode] = useState('');
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper-filled flag — locks the exam code + admission number fields
  const [helperFilled, setHelperFilled] = useState(false);

  useEffect(() => {
    checkDevice();
    // Load school info in parallel — fail silently
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

  const handleHelperFill = (code: string, regNumber: string) => {
    setExamCode(code);
    setAdmissionNumber(regNumber);
    setPin('');
    setError('');
    setHelperFilled(true);
  };

  const clearHelperFill = () => {
    setExamCode('');
    setAdmissionNumber('');
    setPin('');
    setHelperFilled(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!examCode || !admissionNumber || !pin) { setError('Please fill in all fields'); return; }
    if (pin.length !== 6) { setError('PIN must be exactly 6 digits'); return; }

    setLoading(true);
    setPageStep('validating');

    try {
      const data = await examEntryAPI.validateEntry({
        exam_code: examCode.toUpperCase().trim(),
        admission_number: admissionNumber.toUpperCase().trim(),
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
  const BrandingHeader = () => (
    <div className="text-center mb-8">
      <div className="flex items-center justify-center mb-4">
        {schoolInfo?.logo ? (
          <img
            src={schoolInfo.logo}
            alt={schoolInfo.name}
            className="h-16 w-16 object-contain rounded-2xl shadow-lg"
          />
        ) : (
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
            <BookOpen className="h-8 w-8 text-white" />
          </div>
        )}
      </div>
      {schoolInfo?.name && (
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
          {schoolInfo.name}
        </p>
      )}
      <h1 className="text-2xl font-bold text-slate-900">Exam Entry</h1>
      <p className="text-sm text-slate-500 mt-1">Enter your credentials to begin</p>
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
                This device hasn't been approved for exam access. Contact your administrator to request approval.
              </p>
            </div>
            {!approvalRequested ? (
              <div className="space-y-3">
                <button onClick={requestDeviceApproval} disabled={loading}
                  className="w-full px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-200 transition-all">
                  {loading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Requesting…</>
                    : <><Shield className="h-4 w-4" />Request Approval</>}
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
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">

      {showHelper && (
        <HelperDrawer onFill={handleHelperFill} onClose={() => setShowHelper(false)} />
      )}

      <div className="w-full max-w-md">
        <BrandingHeader />

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">

          {/* Top bar: device badge + helper button */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-emerald-700">Device Authorized</span>
            </div>
            <button onClick={() => setShowHelper(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg transition-colors">
              <Sparkles className="h-3.5 w-3.5" />
              Need Help?
            </button>
          </div>

          {/* Helper-filled notice */}
          {helperFilled && (
            <div className="mx-6 mt-4 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-blue-800">Details filled automatically</p>
                <p className="text-xs text-blue-600 mt-0.5">Just enter your 6-digit PIN to continue</p>
              </div>
              <button onClick={clearHelperFill}
                className="text-blue-400 hover:text-blue-600 flex-shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-5">

            {/* Exam Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <BookOpen className="inline h-3 w-3 mr-1.5" />Exam Code
              </label>
              <input
                type="text"
                value={examCode}
                onChange={e => setExamCode(e.target.value.toUpperCase())}
                placeholder="e.g. MATH-PRI2-8049"
                disabled={helperFilled}
                autoComplete="off"
                className={`w-full px-4 py-3 border-2 rounded-xl text-sm font-mono tracking-wide transition-all focus:outline-none
                  ${helperFilled
                    ? 'border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed'
                    : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50'}`}
              />
            </div>

            {/* Admission Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <User className="inline h-3 w-3 mr-1.5" />Admission / Reg. Number
              </label>
              <input
                type="text"
                value={admissionNumber}
                onChange={e => setAdmissionNumber(e.target.value.toUpperCase())}
                placeholder="Enter your registration number"
                disabled={helperFilled}
                autoComplete="off"
                className={`w-full px-4 py-3 border-2 rounded-xl text-sm transition-all focus:outline-none
                  ${helperFilled
                    ? 'border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed'
                    : 'border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50'}`}
              />
            </div>

            {/* Clear helper fill link */}
            {helperFilled && (
              <button type="button" onClick={clearHelperFill}
                className="text-xs text-slate-400 hover:text-slate-600 underline w-full text-center -mt-2 block">
                Enter manually instead
              </button>
            )}

            {/* PIN */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Key className="inline h-3 w-3 mr-1.5" />6-Digit PIN
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="● ● ● ● ● ●"
                maxLength={6}
                autoComplete="off"
                className="w-full px-4 py-4 border-2 border-slate-200 rounded-xl text-center font-mono text-2xl tracking-[0.5em] focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all bg-white"
              />
              <p className="text-xs text-slate-400 mt-1.5 text-center">
                The 6-digit PIN given to you by your teacher
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !examCode || !admissionNumber || pin.length !== 6}
              className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 text-base">
              {loading
                ? <><Loader2 className="h-5 w-5 animate-spin" />Validating…</>
                : <><Lock className="h-5 w-5" />Enter Exam</>}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          Ensure you have a stable internet connection before starting
        </div>
      </div>
    </div>
  );
}