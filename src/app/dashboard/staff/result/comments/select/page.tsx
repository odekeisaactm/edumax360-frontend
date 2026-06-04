'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  MessageSquare, ArrowLeft, Loader2, AlertCircle, FileText,
  Users, Star, BookOpen, RefreshCw, GraduationCap,
  Layers, ChevronDown, CheckCircle2, AlertTriangle, X
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
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ComputeCommentsSelectPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();

  const [classes, setClasses] = useState<UploadableClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<number | null>(null);
  const [commentType, setCommentType] = useState<'midterm' | 'end_of_term'>('end_of_term');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
      // Fetch classes that the user can upload comments for
      // Using the same uploadable endpoint since permissions are similar
      const response = await api.get('/api/academic/class-subjects/uploadable/', {
        params: { result_type: 'all' }
      });
      const classData = response.data?.data?.classes || [];
      setClasses(classData);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const classGroups = useMemo(() => groupClassesByClassName(classes), [classes]);

  const selectedClassGroupData = classGroups.find(g => g.name === selectedClassGroup);
  const availableSections = selectedClassGroupData?.sections || [];

  const handleClassChange = (className: string) => {
    setSelectedClassGroup(className);
    setSelectedSection(null);
  };

  const handleProceed = () => {
    if (selectedSection) {
      router.push(
        `/dashboard/staff/result/comments/students?class=${selectedSection}&type=${commentType}`
      );
    }
  };

  const isFormValid = selectedClassGroup && selectedSection;

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            Compute Comments
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Add behavior ratings and comments for students</p>
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

      {/* ── Main Form Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            Select Class & Comment Type
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Choose the class and specify whether this is for midterm or end of term comments
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
          ) : classGroups.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No classes available</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                You don't have permission to compute comments for any class, or no classes exist.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Class and Section Dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Select Class <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={selectedClassGroup}
                    onChange={e => handleClassChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
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
                    disabled={!selectedClassGroup}
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

              {/* Comment Type Selection */}
              <div className="border-t border-slate-100 pt-6">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Comment Type <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-4">
                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all flex-1 ${
                      commentType === 'end_of_term'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="commentType"
                      value="end_of_term"
                      checked={commentType === 'end_of_term'}
                      onChange={() => setCommentType('end_of_term')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800">End of Term</p>
                      <p className="text-xs text-slate-400">Final comments and behavior ratings for the term</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all flex-1 ${
                      commentType === 'midterm'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="commentType"
                      value="midterm"
                      checked={commentType === 'midterm'}
                      onChange={() => setCommentType('midterm')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800">Midterm</p>
                      <p className="text-xs text-slate-400">Mid-term comments and behavior ratings</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Proceed Button */}
              <div className="pt-4">
                <button
                  onClick={handleProceed}
                  disabled={!isFormValid}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                >
                  <MessageSquare className="h-4 w-4" />
                  Proceed to Student List
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Help Text ── */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Quick Guide
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-700">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">1</span>
            </div>
            <span><strong>Select Class & Section:</strong> Choose the class you're the form teacher for.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">2</span>
            </div>
            <span><strong>Choose Comment Type:</strong> Select whether you're entering midterm or end of term comments.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">3</span>
            </div>
            <span><strong>Enter Comments:</strong> Add behavior ratings, attendance, and teacher comments for each student.</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 bg-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-blue-800 font-bold text-[10px]">4</span>
            </div>
            <span><strong>Bulk Compute:</strong> Use the bulk option to enter comments for all students at once.</span>
          </div>
        </div>
      </div>
    </div>
  );
}