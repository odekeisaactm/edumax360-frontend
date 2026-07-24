'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { textResultUploadAPI } from '@/lib/api';
import {
  ArrowLeft, Loader2, AlertCircle, FileText, Star,
  CheckCircle2, AlertTriangle, X, Edit3,
  Printer, Users
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface RatingOption {
  value: string;
  label: string;
  score: number;
}

interface TextField {
  id: number;
  name: string;
  student_type: string;
  rating?: string;
  comment?: string;
}

interface TextCategory {
  id: number;
  name: string;
  fields: TextField[];
}

interface PrepareData {
  student_id: number;
  student_name: string;
  class_config_id: number;
  class_name: string;
  period_id: number;
  period_name: string;
  rating_options: RatingOption[];
  categories: TextCategory[];
  image?: string;
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

function toTitleCase(str: string) {
  if (!str) return '';
  return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
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

// ─── View Field Component (Read-only, Compact) ─────────────────────────────────
function ViewTextField({ field, ratingOptions, value }: {
  field: TextField;
  ratingOptions: RatingOption[];
  value: { rating: string; comment: string };
}) {
  const selectedRating = ratingOptions.find(r => r.value === value.rating);

  // Capitalize ONLY the first letter of the entire string (Sentence Case)
  const formattedFieldName = field.name
    ? field.name.charAt(0).toUpperCase() + field.name.slice(1)
    : '';

  // Calculate dynamic colors based on score
  let ratingColorClass = 'text-slate-500'; // Default if unrated

  if (selectedRating && ratingOptions.length > 0) {
    const scores = ratingOptions.map(r => r.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    if (selectedRating.score === maxScore) {
      ratingColorClass = 'text-emerald-600 font-bold'; // Highest -> Green
    } else if (selectedRating.score === minScore) {
      ratingColorClass = 'text-red-600 font-bold';     // Lowest -> Red
    } else {
      ratingColorClass = 'text-slate-900 font-bold';   // In-between -> Black/Dark
    }
  }

  return (
    <div className="grid grid-cols-12 gap-2 py-2 border-b border-slate-100">
      <div className="col-span-5 sm:col-span-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">{formattedFieldName}</span>

          {field.student_type !== 'combined' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              {field.student_type === 'normal' ? 'Reg' : 'Spec'}
            </span>
          )}
        </div>
      </div>
      <div className="col-span-4 sm:col-span-3">
        <span className={`text-sm ${ratingColorClass}`}>
          {selectedRating ? selectedRating.label.toUpperCase() : '-'}
        </span>
      </div>
      <div className="col-span-3 sm:col-span-5">
        <span className="text-sm text-slate-500 italic">
          {value.comment || '-'}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ViewTextStudentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, user } = useAuth();

  const studentId = searchParams.get('student');
  const classId = searchParams.get('class');
  const type = searchParams.get('type') || 'text';

  const [data, setData] = useState<PrepareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canUpdate = user?.is_superuser || hasPermission('result.change_resultmodel');

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
    try {
      const response = await textResultUploadAPI.prepare({
        student_id: parseInt(studentId),
        class_config_id: parseInt(classId),
      });

      setData(response as PrepareData);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [studentId, classId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = () => {
    router.push(`/dashboard/staff/result/upload/text/student?student=${studentId}&class=${classId}&type=${type}`);
  };

  const handleBackToList = () => {
    router.push(`/dashboard/staff/result/upload/text/students?class=${classId}&type=${type}`);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStudentImage = () => {
    return data?.image || '/images/default-avatar.png';
  };

  const title = type === 'special' ? 'Special Needs Result' : 'Text Based Result';
  const headerColor = type === 'special' ? 'from-violet-600 to-purple-600' : 'from-emerald-600 to-teal-600';

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading result...</p>
        </div>
      </div>
    );
  }

  if (pageError || !data) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="max-w-md text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
          <p className="text-sm text-slate-500">{pageError || 'Unable to load result'}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  // Build field data map from categories
  const fieldDataMap: Record<number, { rating: string; comment: string }> = {};
  data.categories.forEach(category => {
    category.fields.forEach(field => {
      fieldDataMap[field.id] = {
        rating: field.rating || '',
        comment: field.comment || '',
      };
    });
  });

  return (
    <div className="space-y-4 pb-10 print:space-y-2">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Print CSS */}
      <style jsx global>{`
        @media print {
          .print-hide {
            display: none !important;
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print-hide">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className={`w-8 h-8 bg-gradient-to-br ${headerColor} rounded-lg flex items-center justify-center`}>
            {type === 'special' ? <Star className="h-4 w-4 text-white" /> : <FileText className="h-4 w-4 text-white" />}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-400">{data.class_name} · {data.period_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBackToList}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            Student List
          </button>
          {canUpdate && (
            <button
              onClick={handleUpdate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Update
            </button>
          )}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 text-sm hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        </div>
      </div>

      {/* ── Student Info Card ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center gap-3">
        <img
          src={getStudentImage()}
          alt={data.student_name}
          className="w-12 h-12 rounded-full object-cover border border-slate-200"
        />
        <div>
          <h2 className="text-base font-bold text-slate-800">{toTitleCase(data.student_name)}</h2>
          <p className="text-xs text-slate-400">{data.class_name} · {data.period_name}</p>
        </div>
      </div>

      {/* ── Rating Scale Display ── */}
      {data.rating_options.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-1">Rating Scale:</p>
          <div className="flex flex-wrap gap-3">
            {data.rating_options.map(opt => (
              <span key={opt.value} className="text-xs text-blue-600">
                <span className="font-semibold">{opt.label}:</span> {opt.score}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Categories and Fields (Read-only, Compact Table Layout) ── */}
      {data.categories.map(category => (
        <div key={category.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className={`px-3 py-2 bg-gradient-to-r ${headerColor} text-white`}>
            <h3 className="text-sm font-semibold">{category.name}</h3>
          </div>
          <div className="p-3">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 pb-2 mb-1 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
              <div className="col-span-5 sm:col-span-4">Field</div>
              <div className="col-span-4 sm:col-span-3">Rating</div>
              <div className="col-span-3 sm:col-span-5">Comment</div>
            </div>

            {/* Fields */}
            {category.fields.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-3">No fields in this category</p>
            ) : (
              category.fields.map(field => (
                <ViewTextField
                  key={field.id}
                  field={field}
                  ratingOptions={data.rating_options}
                  value={fieldDataMap[field.id] || { rating: '', comment: '' }}
                />
              ))
            )}
          </div>
        </div>
      ))}

      {/* ── Footer ── */}
      <div className="text-center text-xs text-slate-400 pt-2 print-hide">
        Printed on {new Date().toLocaleString()}
      </div>
    </div>
  );
}