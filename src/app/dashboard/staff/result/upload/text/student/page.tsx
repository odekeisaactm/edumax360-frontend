'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { textResultUploadAPI } from '@/lib/api';
import {
  Save, ArrowLeft, Loader2, AlertCircle, FileText, Star,
  CheckCircle2, AlertTriangle, X,
  Mic, MicOff, MessageSquare
} from 'lucide-react';
import { resultVoiceAPI } from '@/lib/result.service';

// ─── Voice AI Types ────────────────────────────────────────────────────────────
interface VoiceLog {
  id: number;
  transcript: string;
  intent?: string;
  action?: string;
  error?: boolean;
}

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
  can_upload: boolean;
  fields: TextField[];
}

interface PrepareData {
  student_id: number;
  student_name: string;
  class_config_id: number;
  class_name: string;
  period_id: number;
  period_name: string;
  is_form_teacher: boolean;
  rating_options: RatingOption[];
  categories: TextCategory[];
  is_update: boolean;
  image?: string;
}

interface FieldData {
  rating: string;
  comment: string;
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

// ─── Field Component (Compact) ─────────────────────────────────────────────────
function TextFieldInput({ field, ratingOptions, value, onChange, disabled, onFocus, isCorrecting }: {
  field: TextField;
  ratingOptions: RatingOption[];
  value: { rating: string; comment: string };
  onChange: (rating: string, comment: string) => void;
  disabled: boolean;
  onFocus?: (type: 'rating' | 'comment', fieldId: number) => void;
  isCorrecting?: boolean;
}) {
  const [localRating, setLocalRating] = useState(value.rating);
  const [localComment, setLocalComment] = useState(value.comment);

  useEffect(() => {
    setLocalRating(value.rating);
    setLocalComment(value.comment);
  }, [value]);

  const handleRatingChange = (rating: string) => {
    setLocalRating(rating);
    onChange(rating, localComment);
  };

  const handleCommentChange = (comment: string) => {
    setLocalComment(comment);
    onChange(localRating, comment);
  };

  // Capitalize ONLY the first letter of the entire string (Sentence Case)
  const formattedFieldName = field.name
    ? field.name.charAt(0).toUpperCase() + field.name.slice(1)
    : '';

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
        <select
          id={`rating-${field.id}`}
          value={localRating}
          onChange={e => handleRatingChange(e.target.value)}
          onFocus={() => onFocus && onFocus('rating', field.id)}
          disabled={disabled}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:opacity-50 disabled:bg-slate-50"
        >
          <option value="">Select</option>
          {ratingOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-3 sm:col-span-5 relative">
        <input
          id={`comment-${field.id}`}
          type="text"
          value={localComment}
          onChange={e => handleCommentChange(e.target.value)}
          onFocus={() => onFocus && onFocus('comment', field.id)}
          disabled={disabled}
          placeholder="Comment..."
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:opacity-50 disabled:bg-slate-50 pr-8"
        />
        {isCorrecting && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function TextStudentUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const studentId = searchParams.get('student');
  const classId = searchParams.get('class');
  const type = searchParams.get('type') || 'text';

  const [data, setData] = useState<PrepareData | null>(null);
  const [fieldData, setFieldData] = useState<Record<number, FieldData>>({});

  // Track initial state to know what was explicitly cleared vs what was just never touched
  const [initialFieldData, setInitialFieldData] = useState<Record<number, FieldData>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Voice AI States
  const [voiceLogs, setVoiceLogs] = useState<VoiceLog[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isVoicePaused, setIsVoicePaused] = useState(false);
  const [voiceError, setVoiceError] = useState<string|null>(null);
  const [activeInput, setActiveInput] = useState<{ type: 'rating' | 'comment', fieldId: number } | null>(null);
  const [correctingFieldId, setCorrectingFieldId] = useState<number | null>(null);

  const recognitionRef = React.useRef<any>(null);
  const commentTimeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Speech Recognition Hook
  useEffect(() => {
    const SpeechRecognition = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setVoiceError("Browser does not support Web Speech API");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
    };

    let destroyed = false;

    recognition.onerror = (event: any) => {
      if (destroyed) return;
      if (event.error !== 'no-speech') {
        setVoiceError(event.error);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (destroyed) return;
      setIsListening(false);
      if (!isVoicePaused && !voiceError) {
        try { recognition.start(); } catch(e) {}
      }
    };
    recognition.onresult = async (event: any) => {
      const isFinal = event.results[event.results.length - 1].isFinal;
      if (!isFinal) return;

      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      const logId = Date.now();

      if (isVoicePaused || !data) return;

      if (activeInput?.type === 'comment') {
        const fieldId = activeInput.fieldId;

        setFieldData(prev => {
          const current = prev[fieldId]?.comment || '';
          const newText = current ? `${current} ${transcript}` : transcript;

          clearTimeout(commentTimeoutRef.current);

          commentTimeoutRef.current = setTimeout(async () => {
            setCorrectingFieldId(fieldId);
            try {
              const inputEl = document.getElementById(`comment-${fieldId}`) as HTMLInputElement;
              const textToCorrect = inputEl ? inputEl.value : newText;

              const res = await resultVoiceAPI.correctComment({ text: textToCorrect });
              if (res.corrected_text) {
                setFieldData(p => ({
                  ...p,
                  [fieldId]: { ...p[fieldId], comment: res.corrected_text }
                }));
              }
            } catch(e) {
              console.error(e);
            } finally {
              setCorrectingFieldId(null);
            }
          }, 1500);

          return { ...prev, [fieldId]: { ...prev[fieldId], comment: newText } };
        });

        setVoiceLogs(prev => [{ id: logId, transcript, intent: 'dictation' }, ...prev].slice(0, 5));

      } else {
        setVoiceLogs(prev => [{ id: logId, transcript }, ...prev].slice(0, 5));

        const flatFields = data.categories.flatMap(c => c.fields.map(f => ({ id: f.id, name: f.name })));

        const context = {
          fields: flatFields,
          rating_options: data.rating_options.map(r => r.value),
          active_field_id: activeInput?.fieldId
        };

        try {
          const response = await resultVoiceAPI.interpret({ transcript, context });

          setVoiceLogs(prev => prev.map(log =>
            log.id === logId ? { ...log, intent: response.intent, action: response.intent } : log
          ));

          processIntent(response, flatFields);
        } catch (err) {
          console.error("Voice interpret error", err);
        }
      }
    };

    recognitionRef.current = recognition;

    if (!isVoicePaused) {
      try { recognition.start(); } catch(e) {}
    }

    return () => {
      destroyed = true;
      recognition.stop();
    };
  }, [isVoicePaused, voiceError, data, activeInput]);

  const processIntent = (intentData: any, flatFields: any[]) => {
    if (!data) return;

    if (intentData.intent === 'focus_field') {
      if (intentData.field_name) {
        const field = flatFields.find(f => f.name.toLowerCase() === intentData.field_name.toLowerCase() || intentData.field_id === f.id);
        if (field) {
          const select = document.getElementById(`rating-${field.id}`);
          if (select) {
            select.focus();
            select.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    } else if (intentData.intent === 'select_rating') {
      if (activeInput?.fieldId && intentData.rating) {
        const matchedRating = data.rating_options.find(r => r.value.toLowerCase() === intentData.rating.toLowerCase() || r.label.toLowerCase() === intentData.rating.toLowerCase());
        if (matchedRating) {
          handleFieldChange(activeInput.fieldId, matchedRating.value, fieldData[activeInput.fieldId]?.comment || '');
          const currentIndex = flatFields.findIndex(f => f.id === activeInput.fieldId);
          if (currentIndex !== -1 && currentIndex < flatFields.length - 1) {
            const nextField = flatFields[currentIndex + 1];
            const select = document.getElementById(`rating-${nextField.id}`);
            if (select) select.focus();
          }
        }
      }
    } else if (intentData.intent === 'next') {
      if (activeInput?.fieldId) {
        const currentIndex = flatFields.findIndex(f => f.id === activeInput.fieldId);
        if (currentIndex !== -1 && currentIndex < flatFields.length - 1) {
          const nextField = flatFields[currentIndex + 1];
          const select = document.getElementById(`${activeInput.type}-${nextField.id}`);
          if (select) select.focus();
        }
      }
    } else if (intentData.intent === 'previous') {
      if (activeInput?.fieldId) {
        const currentIndex = flatFields.findIndex(f => f.id === activeInput.fieldId);
        if (currentIndex > 0) {
          const prevField = flatFields[currentIndex - 1];
          const select = document.getElementById(`${activeInput.type}-${prevField.id}`);
          if (select) select.focus();
        }
      }
    } else if (intentData.intent === 'save') {
      handleSubmit();
    } else if (intentData.intent === 'save_and_complete') {
      if (confirm("Save and leave page?")) {
        handleSubmit();
      }
    } else if (intentData.intent === 'dismiss') {
       setToasts(prev => prev.filter(t => t.type !== 'error'));
    }
  };

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

      const prepareData = response as PrepareData;
      setData(prepareData);

      const initialData: Record<number, FieldData> = {};
      prepareData.categories.forEach(category => {
        category.fields.forEach(field => {
          initialData[field.id] = {
            rating: field.rating || '',
            comment: field.comment || '',
          };
        });
      });

      setFieldData(initialData);
      setInitialFieldData(initialData); // Capture the original state!

    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, [studentId, classId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFieldChange = (fieldId: number, rating: string, comment: string) => {
    setFieldData(prev => ({
      ...prev,
      [fieldId]: { rating, comment },
    }));
  };

  const handleSubmit = async () => {
    if (!data) return;

    setSubmitting(true);
    try {
      const fieldDataPayload: Record<number, { rating: string; comment: string }> = {};

      Object.entries(fieldData).forEach(([id, value]) => {
        const fieldId = parseInt(id);
        const init = initialFieldData[fieldId];

        // Does the field have a value NOW?
        const hasValue = value.rating.trim() !== '' || value.comment.trim() !== '';
        // Did the field have a value ORIGINALLY?
        const hadValue = init ? (init.rating.trim() !== '' || init.comment.trim() !== '') : false;

        // If it currently has a value, OR if it used to have one and was just cleared, send it!
        // We ignore fields that were always empty to prevent backend validation errors.
        if (hasValue || hadValue) {
          fieldDataPayload[fieldId] = {
            rating: value.rating || '',
            comment: value.comment || '',
          };
        }
      });

      if (Object.keys(fieldDataPayload).length === 0) {
        showToast('warn', 'No fields available to save');
        setSubmitting(false);
        return;
      }

      await textResultUploadAPI.submit({
        student_id: parseInt(studentId!),
        class_config_id: parseInt(classId!),
        academic_period_id: data.period_id,
        field_data: fieldDataPayload,
      });

      showToast('success', 'Result saved successfully');
      router.replace(`/dashboard/staff/result/view/text/student?student=${studentId}&class=${classId}&type=${type}`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const getStudentImage = () => {
    return data?.image || '/images/default-avatar.png';
  };

  const title = type === 'special' ? 'Special Needs Result Upload' : 'Text Based Result Upload';
  const icon = type === 'special' ? <Star className="h-5 w-5 text-white" /> : <FileText className="h-5 w-5 text-white" />;
  const headerColor = type === 'special' ? 'from-violet-600 to-purple-600' : 'from-emerald-600 to-teal-600';

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-400 text-sm">Loading result form...</p>
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
          <p className="text-sm text-slate-500">{pageError || 'Unable to load result form'}</p>
          <button onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className={`w-8 h-8 bg-gradient-to-br ${headerColor} rounded-lg flex items-center justify-center`}>
            {icon}
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">{title}</h1>
            <p className="text-xs text-slate-400">{data.class_name} · {data.period_name}</p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-sm"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Result
        </button>
      </div>

      {/* ── Student Info Card (Compact) ── */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 flex items-center gap-3">
        <img
          src={getStudentImage()}
          alt={toTitleCase(data.student_name)}
          className="w-10 h-10 rounded-full object-cover border border-slate-200"
        />
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{toTitleCase(data.student_name)}</h2>
          <p className="text-xs text-slate-400">{data.class_name}</p>
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

      {/* ── Voice Assistant Panel ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsVoicePaused(!isVoicePaused)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md ${
              isVoicePaused ? 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              : voiceError ? 'bg-red-50 text-red-500 border border-red-200'
              : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white animate-pulse shadow-blue-200'
            }`}
            title={isVoicePaused ? "Resume Voice AI" : "Pause Voice AI"}
          >
            {isVoicePaused ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              Voice Assistant
              {!isVoicePaused && !voiceError && <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
            </h3>
            <p className="text-xs text-slate-500">
              {isVoicePaused ? 'Paused. Click to resume.' : voiceError ? `Error: ${voiceError}` : 'Listening for ratings or dictation...'}
            </p>
          </div>
        </div>

        <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100 min-h-[60px] max-h-[80px] overflow-y-auto flex flex-col-reverse">
          {voiceLogs.length === 0 ? (
             <p className="text-xs text-slate-400 italic flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Say a field name to select, or dictate a comment...</p>
          ) : (
            <div className="space-y-1">
              {voiceLogs.map((log, i) => (
                <div key={log.id} className={`text-xs flex items-center justify-between ${i === 0 ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                  <span>"{log.transcript}"</span>
                  {log.intent && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
                      log.intent === 'unknown' ? 'bg-slate-200 text-slate-500' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {log.intent}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Categories and Fields (Compact Table Layout) ── */}
      {data.categories.map(category => (
        <div key={category.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className={`px-3 py-2 ${category.can_upload ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-slate-500'} text-white`}>
            <h3 className="text-sm font-semibold">{category.name}</h3>
            {!category.can_upload && (
              <p className="text-xs text-blue-200">Read-only</p>
            )}
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
                <TextFieldInput
                  key={field.id}
                  field={field}
                  ratingOptions={data.rating_options}
                  value={fieldData[field.id] || { rating: '', comment: '' }}
                  onChange={(rating, comment) => handleFieldChange(field.id, rating, comment)}
                  disabled={!category.can_upload}
                  onFocus={(type, id) => setActiveInput({ type, fieldId: id })}
                  isCorrecting={correctingFieldId === field.id}
                />
              ))
            )}
          </div>
        </div>
      ))}

      {/* ── Sticky Save Button Footer ── */}
      <div className="sticky bottom-4 bg-white rounded-xl border border-slate-100 shadow-lg p-3 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 shadow-sm"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Result
        </button>
      </div>
    </div>
  );
}