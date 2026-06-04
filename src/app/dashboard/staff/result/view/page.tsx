'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Eye, ArrowLeft, Loader2, AlertCircle, FileText,
  Users, Star, BookOpen, RefreshCw, GraduationCap,
  Layers, ChevronDown, Check, AlertTriangle, X,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface UploadableSubject {
  id: number;
  name: string;
  code: string;
  teachers: number[];
}

interface UploadableSection {
  id: number;
  name: string;
  class_config_id: number;
  subjects: UploadableSubject[];
}

interface UploadableClassGroup {
  id: number;
  name: string;
  sections: UploadableSection[];
}

interface UploadableClass {
  id: number;
  name: string;
  class_name: string;
  class_section_name: string | null;
  result_type: string;
  can_have_special_student: boolean;
  form_teacher: number | null;
  assistant_form_teacher: number | null;
  subjects: UploadableSubject[];
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900'
          : t.type === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
          : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function groupClassesByClassName(classes: UploadableClass[]): UploadableClassGroup[] {
  const groupMap = new Map<string, UploadableClassGroup>();

  for (const cls of classes) {
    const className = cls.class_name;
    if (!groupMap.has(className)) {
      groupMap.set(className, {
        id: cls.id,
        name: className,
        sections: [],
      });
    }

    const group = groupMap.get(className)!;
    group.sections.push({
      id: cls.id,
      name: cls.class_section_name || 'Main',
      class_config_id: cls.id,
      subjects: cls.subjects,
    });
  }

  for (const group of groupMap.values()) {
    group.sections.sort((a, b) => a.name.localeCompare(b.name));
  }

  return Array.from(groupMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Score Based Form ─────────────────────────────────────────────────────────
function ScoreBasedForm({
  classes,
  loading,
  onSubmit
}: {
  classes: UploadableClass[];
  loading: boolean;
  onSubmit: (classConfigId: number, subjectId: number) => void;
}) {
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);

  const classGroups = useMemo(() => groupClassesByClassName(classes), [classes]);

  const selectedClassGroupData = classGroups.find(g => g.name === selectedClassGroup);
  const availableSections = selectedClassGroupData?.sections || [];

  const selectedSectionData = availableSections.find(s => s.id === selectedSection);
  const availableSubjects = selectedSectionData?.subjects || [];

  const handleClassChange = (className: string) => {
    setSelectedClassGroup(className);
    setSelectedSection(null);
    setSelectedSubject(null);
  };

  const handleSectionChange = (sectionId: number) => {
    setSelectedSection(sectionId);
    setSelectedSubject(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSection && selectedSubject) {
      onSubmit(selectedSection, selectedSubject);
    }
  };

  const isFormValid = selectedClassGroup && selectedSection && selectedSubject;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Class <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={selectedClassGroup}
            onChange={e => handleClassChange(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            disabled={loading}
          >
            <option value="">Select a class</option>
            {classGroups.map(group => (
              <option key={group.name} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Section <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={selectedSection || ''}
            onChange={e => handleSectionChange(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            disabled={loading || !selectedClassGroup}
          >
            <option value="">{!selectedClassGroup ? 'Select class first' : 'Select a section'}</option>
            {availableSections.map(section => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Subject <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={selectedSubject || ''}
            onChange={e => setSelectedSubject(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            disabled={loading || !selectedSection || availableSubjects.length === 0}
          >
            <option value="">
              {!selectedSection ? 'Select section first' :
               availableSubjects.length === 0 ? 'No subjects available' : 'Select a subject'}
            </option>
            {availableSubjects.map(subject => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !isFormValid}
        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-200"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        View Results
      </button>
    </form>
  );
}

// ─── Text Based Form ─────────────────────────────────────────────────────────
function TextBasedForm({
  classes,
  loading,
  onSubmit
}: {
  classes: UploadableClass[];
  loading: boolean;
  onSubmit: (classConfigId: number) => void;
}) {
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<number | null>(null);

  const classGroups = useMemo(() => groupClassesByClassName(classes), [classes]);

  const selectedClassGroupData = classGroups.find(g => g.name === selectedClassGroup);
  const availableSections = selectedClassGroupData?.sections || [];

  const handleClassChange = (className: string) => {
    setSelectedClassGroup(className);
    setSelectedSection(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSection) {
      onSubmit(selectedSection);
    }
  };

  const isFormValid = selectedClassGroup && selectedSection;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Class <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={selectedClassGroup}
            onChange={e => handleClassChange(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            disabled={loading}
          >
            <option value="">Select a class</option>
            {classGroups.map(group => (
              <option key={group.name} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Section <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={selectedSection || ''}
            onChange={e => setSelectedSection(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            disabled={loading || !selectedClassGroup}
          >
            <option value="">{!selectedClassGroup ? 'Select class first' : 'Select a section'}</option>
            {availableSections.map(section => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-1">
        You will be taken to a student list to view results.
      </p>

      <button
        type="submit"
        disabled={loading || !isFormValid}
        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-emerald-200"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        View Student List
      </button>
    </form>
  );
}

// ─── Special Needs Form ──────────────────────────────────────────────────────
function SpecialNeedsForm({
  classes,
  loading,
  onSubmit
}: {
  classes: UploadableClass[];
  loading: boolean;
  onSubmit: (classConfigId: number) => void;
}) {
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<number | null>(null);

  const classGroups = useMemo(() => groupClassesByClassName(classes), [classes]);

  const selectedClassGroupData = classGroups.find(g => g.name === selectedClassGroup);
  const availableSections = selectedClassGroupData?.sections || [];

  const handleClassChange = (className: string) => {
    setSelectedClassGroup(className);
    setSelectedSection(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSection) {
      onSubmit(selectedSection);
    }
  };

  const isFormValid = selectedClassGroup && selectedSection;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Class <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={selectedClassGroup}
            onChange={e => handleClassChange(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            disabled={loading}
          >
            <option value="">Select a class</option>
            {classGroups.map(group => (
              <option key={group.name} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Section <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={selectedSection || ''}
            onChange={e => setSelectedSection(Number(e.target.value))}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            disabled={loading || !selectedClassGroup}
          >
            <option value="">{!selectedClassGroup ? 'Select class first' : 'Select a section'}</option>
            {availableSections.map(section => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-1">
        Classes that can accommodate special needs students. You will be taken to a student list to view results.
      </p>

      <button
        type="submit"
        disabled={loading || !isFormValid}
        className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-violet-200"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
        View Student List
      </button>
    </form>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ViewResultPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'score' | 'text' | 'special'>('score');
  const [scoreClasses, setScoreClasses] = useState<UploadableClass[]>([]);
  const [textClasses, setTextClasses] = useState<UploadableClass[]>([]);
  const [specialClasses, setSpecialClasses] = useState<UploadableClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const [scoreCount, setScoreCount] = useState(0);
  const [textCount, setTextCount] = useState(0);
  const [specialCount, setSpecialCount] = useState(0);

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const [scoreRes, textRes, specialRes] = await Promise.all([
        api.get('/api/academic/class-subjects/uploadable/', { params: { result_type: 'score' } }),
        api.get('/api/academic/class-subjects/uploadable/', { params: { result_type: 'text' } }),
        api.get('/api/academic/class-subjects/uploadable/', { params: { result_type: 'special' } }),
      ]);

      const scoreData = scoreRes.data?.data?.classes || [];
      const textData = textRes.data?.data?.classes || [];
      const specialData = specialRes.data?.data?.classes || [];

      setScoreClasses(scoreData);
      setTextClasses(textData);
      setSpecialClasses(specialData);

      setScoreCount(new Set(scoreData.map((c: UploadableClass) => c.class_name)).size);
      setTextCount(new Set(textData.map((c: UploadableClass) => c.class_name)).size);
      setSpecialCount(new Set(specialData.map((c: UploadableClass) => c.class_name)).size);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const getCurrentClasses = (): UploadableClass[] => {
    if (activeTab === 'score') return scoreClasses;
    if (activeTab === 'text') return textClasses;
    return specialClasses;
  };

  const handleScoreSubmit = (classConfigId: number, subjectId: number) => {
    router.push(`/dashboard/staff/result/view/score?class=${classConfigId}&subject=${subjectId}`);
  };

  const handleTextSubmit = (classConfigId: number) => {
    router.push(`/dashboard/staff/result/upload/text/students?class=${classConfigId}`);
  };

  const handleSpecialSubmit = (classConfigId: number) => {
    router.push(`/dashboard/staff/result/upload/text/students?class=${classConfigId}&type=special`);
  };

  const tabs = [
    { id: 'score' as const, label: 'Score Based', icon: FileText, color: 'blue', count: scoreCount },
    { id: 'text' as const, label: 'Text Based', icon: Users, color: 'emerald', count: textCount },
    { id: 'special' as const, label: 'Special Needs', icon: Star, color: 'violet', count: specialCount },
  ];

  const currentClasses = getCurrentClasses();

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Eye className="h-5 w-5 text-white" />
            </div>
            View Results
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">View score-based and text-based results</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Stats Cards (also serve as tab switchers) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`bg-white rounded-2xl border-2 p-5 text-left transition-all ${
              activeTab === tab.id
                ? `border-${tab.color}-500 ring-2 ring-${tab.color}-200 shadow-md`
                : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className={`w-10 h-10 rounded-xl bg-${tab.color}-50 flex items-center justify-center`}>
                <tab.icon className={`h-5 w-5 text-${tab.color}-600`} />
              </div>
              <span className={`text-2xl font-bold text-${tab.color}-600`}>{tab.count}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 mt-3">{tab.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">classes available</p>
          </button>
        ))}
      </div>

      {/* ── Main Form Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            {activeTab === 'score' && <FileText className="h-5 w-5 text-blue-600" />}
            {activeTab === 'text' && <Users className="h-5 w-5 text-emerald-600" />}
            {activeTab === 'special' && <Star className="h-5 w-5 text-violet-600" />}
            {activeTab === 'score' && 'Score Based Results'}
            {activeTab === 'text' && 'Text Based Results'}
            {activeTab === 'special' && 'Special Needs Results'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {activeTab === 'score' && 'Select class, section, and subject to view scores'}
            {activeTab === 'text' && 'Select class and section to view text-based ratings'}
            {activeTab === 'special' && 'Select class and section to view special needs results'}
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : pageError ? (
            <div className="text-center py-12">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
              <p className="text-sm text-red-600">{pageError}</p>
              <button onClick={fetchData} className="mt-3 text-sm text-blue-600 underline">Try Again</button>
            </div>
          ) : (
            <>
              {activeTab === 'score' && (
                <ScoreBasedForm
                  classes={currentClasses}
                  loading={loading}
                  onSubmit={handleScoreSubmit}
                />
              )}
              {activeTab === 'text' && (
                <TextBasedForm
                  classes={currentClasses}
                  loading={loading}
                  onSubmit={handleTextSubmit}
                />
              )}
              {activeTab === 'special' && (
                <SpecialNeedsForm
                  classes={currentClasses}
                  loading={loading}
                  onSubmit={handleSpecialSubmit}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Help Text ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Quick Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-blue-700">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">1</span>
            </div>
            <span><strong>Score Based:</strong> Select class → section → subject to view scores.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-emerald-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-emerald-800 font-bold text-[10px]">2</span>
            </div>
            <span><strong>Text Based:</strong> Select class → section to view student list with ratings.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-violet-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-violet-800 font-bold text-[10px]">3</span>
            </div>
            <span><strong>Special Needs:</strong> Same as text based, but for special needs students.</span>
          </div>
        </div>
      </div>
    </div>
  );
}