'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, resultViewAPI, resultSettingsAPI, resultBehaviorAPI } from '@/lib/api';
import { ResultModel, ResultSettings, ResultBehaviorCategory } from '@/lib/types';
import {
  MessageSquare, ArrowLeft, Loader2, AlertCircle, Save,
  ChevronDown, ChevronUp, User, Calendar, Star, FileText,
  TrendingUp, Award, BookOpen, CheckCircle2, AlertTriangle, X,
  Users, Eye, ChevronLeft, ChevronRight,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface BehaviorField {
  id: number;
  name: string;
  order: number;
}

interface BehaviorCategory {
  id: number;
  name: string;
  fields: BehaviorField[];
}

interface CommentData {
  form_teacher_comment?: string;
  head_teacher_comment?: string;
  custom_comments?: Record<string, string>;
  behavior_ratings?: Record<string, number>;
  total_attendance?: number;
  present_attendance?: number;
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);

    // Handle DRF field errors (e.g. { field_name: ['error message'] })
    if (typeof d === 'object') {
      const values = Object.values(d);
      if (values.length > 0) {
        const firstError = values[0];
        if (Array.isArray(firstError)) return String(firstError[0]);
        if (typeof firstError === 'string') return firstError;
      }
    }
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

// ─── Result Accordion Component ───────────────────────────────────────────────
function ResultAccordion({ result, resultType }: { result: ResultModel | null; resultType: string }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!result) {
    return (
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Student Result</span>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {isOpen && (
          <div className="p-4 text-center text-slate-400 text-sm">
            No result data available for this student.
          </div>
        )}
      </div>
    );
  }

  const isScoreBased = result.result_type === 'score' || result.result_type === 'combined';
  const resultData = result.result_data_with_stats || result.result_data;

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-700">Student Result</span>
          {result.average_score && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              Avg: {result.average_score}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100">
          {isScoreBased ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Subject</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">Score</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">Grade</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {Object.entries(resultData || {}).map(([subjectId, data]: [string, any]) => (
                    <tr key={subjectId} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-700">{data.subject_name}</td>
                      <td className="px-3 py-2 text-center text-slate-600">{data.total}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          {data.grade}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500">{data.position || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(resultData || {}).reduce((acc: any[], [fieldId, data]: [string, any]) => {
                const categoryName = data.category_name;
                if (!acc.find(item => item.category === categoryName)) {
                  acc.push({ category: categoryName, fields: [] });
                }
                const category = acc.find(item => item.category === categoryName);
                category.fields.push({ name: data.field_name, rating: data.rating, comment: data.comment });
                return acc;
              }, []).map((category, idx) => (
                <div key={idx} className="border border-slate-100 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">
                    {category.category}
                  </div>
                  <div className="divide-y divide-slate-50">
                    {category.fields.map((field: any, fidx: number) => (
                      <div key={fidx} className="px-3 py-2 flex justify-between items-center text-sm">
                        <span className="text-slate-700">{field.name}</span>
                        <span className="text-slate-500">
                          {field.rating ? `${field.rating.toUpperCase()}` : '-'}
                          {field.comment && <span className="text-xs text-slate-400 ml-2">({field.comment})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(resultData || {}).length === 0 && (
                <p className="text-sm text-slate-400 italic text-center">No result data available</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Behavior Ratings Component ───────────────────────────────────────────────
function BehaviorRatings({ categories, ratings, maxRating, onChange }: {
  categories: ResultBehaviorCategory[];
  ratings: Record<string, number>;
  maxRating: number;
  onChange: (fieldName: string, value: number) => void;
}) {
  const [openCategories, setOpenCategories] = useState<Record<number, boolean>>({});

  const toggleCategory = (categoryId: number) => {
    setOpenCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
      <div className="p-4 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-700">Behavior Ratings</span>
          <span className="text-xs text-slate-400">(1-{maxRating})</span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {categories.map(category => (
          <div key={category.id} className="border border-slate-100 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <span className="text-sm font-medium text-slate-700">{category.name}</span>
              {openCategories[category.id] ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
            </button>

            {openCategories[category.id] && (
              <div className="p-3 space-y-2">
                {category.fields_list?.map(field => (
                  <div key={field.id} className="flex items-center gap-3">
                    <label className="text-sm text-slate-600 flex-1">{field.name}</label>
                    <input
                      type="number"
                      min={1}
                      max={maxRating}
                      value={ratings[field.name] || ''}
                      onChange={e => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val)) {
                          onChange(field.name, 0);
                          return;
                        }
                        if (val < 1) val = 1;
                        if (val > maxRating) val = maxRating;
                        onChange(field.name, val);
                      }}
                      onBlur={e => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val) || val < 1) {
                          onChange(field.name, 1);
                        } else if (val > maxRating) {
                          onChange(field.name, maxRating);
                        }
                      }}
                      className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center"
                      placeholder={`1-${maxRating}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {categories.length === 0 && (
          <p className="text-sm text-slate-400 italic text-center">No behavior categories configured.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ComputeCommentsIndividualPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();

  const studentId = searchParams.get('student');
  const classId = searchParams.get('class');
  const commentType = searchParams.get('type') || 'end_of_term';
  const studentIdsParam = searchParams.get('students') || '';

  const studentIds = studentIdsParam ? studentIdsParam.split(',').map(Number) : [];
  const currentIndex = studentIds.length ? studentIds.indexOf(parseInt(studentId!)) : -1;

  const [result, setResult] = useState<ResultModel | null>(null);
  const [resultNotFound, setResultNotFound] = useState(false);
  const [fallbackInfo, setFallbackInfo] = useState<{ student_name?: string; class_name?: string; period_name?: string; student_image?: string; registration_number?: string }>({});
  const [settings, setSettings] = useState<ResultSettings | null>(null);
  const [behaviorCategories, setBehaviorCategories] = useState<ResultBehaviorCategory[]>([]);
  const [commentData, setCommentData] = useState<CommentData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const isHeadTeacher = user?.is_superuser || hasPermission('result.add_head_teacher_comment');
  const maxRating = settings?.behavior_max_rating || 5;
  const customFields = settings?.custom_comment_fields || [];

  const showToast = (type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchData = useCallback(async () => {
    if (!studentId || !classId) {
      setPageError('Missing required parameters');
      setLoading(false);
      return;
    }

    setLoading(true);
    setPageError(null);
    setResultNotFound(false);
    setResult(null);

    try {
      // Fetch independent data
      const [settingsData, behaviorData] = await Promise.all([
        resultSettingsAPI.get(),
        resultBehaviorAPI.listCategories(),
      ]);
      setSettings(settingsData);
      setBehaviorCategories(behaviorData);

      // Fetch student sheet with error handling for 404 (not computed)
      let sheetData;
      try {
        sheetData = await resultViewAPI.studentSheet({ student_id: parseInt(studentId) });
        setResult(sheetData);
      } catch (err: any) {
        if (err.response?.status === 404) {
          setResultNotFound(true);
          const data = err.response.data;
          setFallbackInfo({
            student_name: data?.student_name || 'Student',
            period_name: data?.period_name || 'Academic Period',
            student_image: data?.student_image,
            registration_number: data?.registration_number,
          });
          setLoading(false);
          return;
        }
        throw err;
      }

      // Fetch comments
      const commentResponse = await api.get('/api/result/comments/retrieve_comment/', {
        params: {
          student_id: parseInt(studentId),
          period_id: sheetData.academic_period,
          comment_type: commentType,
        },
      });

      if (commentResponse.data) {
        setCommentData({
          form_teacher_comment: commentResponse.data.form_teacher_comment || '',
          head_teacher_comment: commentResponse.data.head_teacher_comment || '',
          custom_comments: commentResponse.data.custom_comments || {},
          behavior_ratings: commentResponse.data.behavior_ratings || {},
          total_attendance: commentResponse.data.total_attendance || undefined,
          present_attendance: commentResponse.data.present_attendance || undefined,
        });
      }
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [studentId, classId, commentType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBehaviorChange = (fieldName: string, value: number) => {
    setCommentData(prev => ({
      ...prev,
      behavior_ratings: {
        ...prev.behavior_ratings,
        [fieldName]: value,
      },
    }));
  };

  const handleCustomCommentChange = (fieldName: string, value: string) => {
    setCommentData(prev => ({
      ...prev,
      custom_comments: {
        ...prev.custom_comments,
        [fieldName]: value,
      },
    }));
  };

  const handleSave = async () => {
    // Attendance validation
    if (commentData.present_attendance !== undefined && commentData.total_attendance !== undefined) {
      if (commentData.present_attendance > commentData.total_attendance) {
        showToast('error', 'Present days cannot exceed total school days');
        return;
      }
    }

    setSaving(true);
    try {
      await api.post('/api/result/comments/save_comment/', {
        student_id: parseInt(studentId!),
        period_id: result?.academic_period,
        class_config_id: parseInt(classId!),
        comment_type: commentType,
        form_teacher_comment: commentData.form_teacher_comment,
        head_teacher_comment: commentData.head_teacher_comment,
        custom_comments: commentData.custom_comments,
        behavior_ratings: commentData.behavior_ratings,
        total_attendance: commentData.total_attendance,
        present_attendance: commentData.present_attendance,
      });
      showToast('success', 'Comment saved successfully');
    } catch (err) {
      showToast('error', extractError(err));
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < studentIds.length - 1 && studentIds.length > 0) {
      const nextStudentId = studentIds[currentIndex + 1];
      router.push(
        `/dashboard/staff/result/comments/student?student=${nextStudentId}&class=${classId}&type=${commentType}&students=${studentIdsParam}`
      );
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0 && studentIds.length > 0) {
      const prevStudentId = studentIds[currentIndex - 1];
      router.push(
        `/dashboard/staff/result/comments/student?student=${prevStudentId}&class=${classId}&type=${commentType}&students=${studentIdsParam}`
      );
    }
  };

  const handleSaveAndNext = async () => {
    if (resultNotFound) {
      handleNext();
      return;
    }
    await handleSave();
    handleNext();
  };

  const handleSaveAndPrevious = async () => {
    if (resultNotFound) {
      handlePrevious();
      return;
    }
    await handleSave();
    handlePrevious();
  };

  const getStudentImage = () => {
    const img = (result as any)?.student_image || fallbackInfo.student_image;
    return ensureAbsoluteUrl(img) || '/images/default-avatar.png';
  };

  const title = commentType === 'midterm' ? 'Midterm Comments' : 'End of Term Comments';
  const headerColor = commentType === 'midterm' ? 'from-amber-600 to-orange-600' : 'from-emerald-600 to-teal-600';

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (pageError || (!result && !resultNotFound)) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
          <p className="text-sm text-slate-500">{pageError || 'Unable to load data'}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const studentName = result?.student_name || fallbackInfo.student_name || 'Student';
  const regNumber = result?.registration_number || fallbackInfo.registration_number;
  const className = result?.class_name || 'Class';
  const periodName = result?.period_name || fallbackInfo.period_name || 'Academic Period';

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className={`w-9 h-9 bg-gradient-to-br ${headerColor} rounded-xl flex items-center justify-center shadow-md`}>
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              {title}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {studentName} {regNumber && <span className="opacity-70">({regNumber})</span>} · {className}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${commentType === 'midterm' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {commentType === 'midterm' ? 'Midterm' : 'End of Term'}
          </span>
        </div>
      </div>

      {/* ── Student Info Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
        <img
          src={getStudentImage()}
          alt={studentName}
          className="w-14 h-14 rounded-full object-cover border-2 border-blue-200"
          onError={e => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
        />
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {studentName} {regNumber && <span className="text-slate-400 font-normal ml-1">({regNumber})</span>}
          </h2>
          <p className="text-sm text-slate-500">{className} · {periodName}</p>
        </div>
      </div>

      {/* ── Result Accordion (Closed by default) ── */}
      <ResultAccordion result={result} resultType={result?.result_type || 'score'} />

      {resultNotFound ? (
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-10 text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <FileText className="h-8 w-8 text-amber-600" />
          </div>
          <div className="max-w-xs mx-auto">
            <h3 className="text-lg font-bold text-amber-900">Result Not Yet Computed</h3>
            <p className="text-sm text-amber-700 mt-1">
              The academic results for this student have not been computed yet. You can only add comments after results are generated.
            </p>
          </div>
          <div className="pt-2">
             <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 px-6 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200"
            >
              Skip to Next Student <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Behavior Ratings ── */}
          <BehaviorRatings
            categories={behaviorCategories}
            ratings={commentData.behavior_ratings || {}}
            maxRating={maxRating}
            onChange={handleBehaviorChange}
          />

          {/* ── Attendance ── */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Attendance</span>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Present Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={commentData.present_attendance || ''}
                    onChange={e => setCommentData(prev => ({ ...prev, present_attendance: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    placeholder="Days present"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Total Days
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={commentData.total_attendance || ''}
                    onChange={e => setCommentData(prev => ({ ...prev, total_attendance: e.target.value ? parseInt(e.target.value) : undefined }))}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    placeholder="Total school days"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Comments ── */}
          <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700">Comments</span>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Form Teacher Comment
                </label>
                <textarea
                  rows={3}
                  value={commentData.form_teacher_comment || ''}
                  onChange={e => setCommentData(prev => ({ ...prev, form_teacher_comment: e.target.value }))}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white resize-none"
                  placeholder="Enter form teacher comment..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Head Teacher Comment
                  {!isHeadTeacher && <span className="ml-2 text-xs text-amber-600">(Read-only)</span>}
                </label>
                <textarea
                  rows={3}
                  value={commentData.head_teacher_comment || ''}
                  onChange={e => isHeadTeacher && setCommentData(prev => ({ ...prev, head_teacher_comment: e.target.value }))}
                  readOnly={!isHeadTeacher}
                  className={`w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white resize-none ${!isHeadTeacher ? 'bg-slate-50 text-slate-500' : ''}`}
                  placeholder="Enter head teacher comment..."
                />
              </div>

              {/* Custom Comment Fields */}
              {customFields.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Additional Comments
                  </label>
                  <div className="space-y-3">
                    {customFields.map(field => (
                      <div key={field}>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{field}</label>
                        <textarea
                          rows={2}
                          value={commentData.custom_comments?.[field] || ''}
                          onChange={e => handleCustomCommentChange(field, e.target.value)}
                          className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white resize-none"
                          placeholder={`Enter ${field.toLowerCase()}...`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Sticky Action Bar ── */}
      <div className="sticky bottom-4 bg-white rounded-xl border border-slate-100 shadow-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {studentIds.length > 0 && currentIndex > 0 && (
            <button
              onClick={handleSaveAndPrevious}
              disabled={saving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white font-medium rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronLeft className="h-4 w-4" />}
              {resultNotFound ? 'Previous' : 'Save & Previous'}
            </button>
          )}

          {studentIds.length > 0 && currentIndex < studentIds.length - 1 && (
            <button
              onClick={handleSaveAndNext}
              disabled={saving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {resultNotFound ? 'Next' : 'Save & Next'}
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>

        {!resultNotFound && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-blue-200"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Comment
          </button>
        )}
      </div>
    </div>
  );
}
