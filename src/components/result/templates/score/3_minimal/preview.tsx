'use client';

import React from 'react';
import { ResultSettings, ResultBehaviorCategory } from '@/lib/types';

interface ScoreResultData {
  subject_name: string;
  subject_code: string;
  fields: Record<string, number>;
  total_ca: number;
  total: number;
  grade: string;
  remark: string;
  position: number | null;
  highest_in_class?: number;
  lowest_in_class?: number;
  class_average?: number;
  students_counted?: number;
  midterm_total?: number;
  midterm_position?: number;
  midterm_grade?: string;
  midterm_remark?: string;
}

interface BehaviorRating {
  [fieldName: string]: number;
}

interface CommentData {
  form_teacher?: string;
  form_teacher_signature?: string;
  form_teacher_comment?: string;
  head_teacher?: string;
  head_teacher_title?: string;
  head_teacher_signature?: string;
  head_teacher_comment?: string;
  custom_comments?: Record<string, string>;
  area_of_focus?: string;
  present_attendance?: number;
  total_attendance?: number;
}

interface MinimalScoreTemplateProps {
  student: any;
  result: any;
  settings: ResultSettings;
  behaviorCategories: ResultBehaviorCategory[];
  behaviorRatings: BehaviorRating;
  comments: CommentData;
  termType: 'midterm' | 'end_of_term';
  gradeList?: Array<any>;
  midtermGradeList?: Array<any>;
  schoolInfo?: any;
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '—';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Helper function to safely render comment values
function renderCommentValue(value: any): React.ReactNode {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    // If it's a nested object with a message property
    if ('message' in value) return value.message;
    // If it's an array
    if (Array.isArray(value)) return value.join(', ');
    // Otherwise stringify
    return JSON.stringify(value);
  }
  return value;
}

export default function MinimalScoreTemplate({
  student,
  result,
  settings,
  behaviorCategories,
  behaviorRatings,
  comments,
  termType,
  gradeList = [],
  midtermGradeList = [],
  schoolInfo,
}: MinimalScoreTemplateProps) {
  const isMidterm = termType === 'midterm';
  const subjectList = Object.entries(result.result_data || {}) as [string, ScoreResultData][];

  return (
    <div className="max-w-4xl mx-auto bg-white border border-slate-200 p-8 font-serif text-slate-900">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-6 mb-6 flex items-center justify-between">
        <div className="w-1/4">
          <img src={ensureAbsoluteUrl(schoolInfo?.logo) || '/images/default-logo.png'} alt="Logo" className="w-20 h-20 grayscale object-contain" />
        </div>
        <div className="w-2/4 text-center">
          <h1 className="text-2xl font-bold uppercase tracking-widest">{schoolInfo?.name || 'SCHOOL NAME'}</h1>
          <p className="text-sm mt-2 font-mono uppercase tracking-widest border border-slate-900 inline-block px-3 py-1">
            {isMidterm ? 'Midterm' : 'End of Term'} Report - {result.period_name} {result.session_name}
          </p>
        </div>
        <div className="w-1/4 flex justify-end">
          <img src={ensureAbsoluteUrl(student.image) || '/images/default-avatar.png'} alt="Student" className="w-20 h-24 object-cover border border-slate-300 p-1" />
        </div>
      </div>

      {/* Student Details Grid */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-2 mb-8 text-sm">
        <div className="flex justify-between border-b border-slate-200 py-1">
          <span className="text-slate-500 uppercase">Name</span>
          <span className="font-semibold">{student.first_name} {student.last_name}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 py-1">
          <span className="text-slate-500 uppercase">Admission No.</span>
          <span className="font-semibold">{student.registration_number?.toUpperCase()}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 py-1">
          <span className="text-slate-500 uppercase">Class</span>
          <span className="font-semibold">{student.current_class?.name || student.class}</span>
        </div>
        <div className="flex justify-between border-b border-slate-200 py-1">
          <span className="text-slate-500 uppercase">Attendance</span>
          <span className="font-semibold">{comments.present_attendance || 0} / {comments.total_attendance || 0}</span>
        </div>
      </div>

      {/* Main Table */}
      <table className="w-full text-sm mb-8 border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-900">
            <th className="py-2 text-left font-bold uppercase">Subject</th>
            <th className="py-2 text-center font-bold uppercase">Total</th>
            <th className="py-2 text-center font-bold uppercase">Class Avg</th>
            <th className="py-2 text-center font-bold uppercase">Grade</th>
            <th className="py-2 text-left font-bold uppercase pl-4">Remark</th>
           </tr>
        </thead>
        <tbody>
          {subjectList.map(([id, data]) => (
            <tr key={id} className="border-b border-slate-200">
              <td className="py-2 font-medium">{toTitleCase(data.subject_name)}</td>
              <td className="py-2 text-center font-bold">{isMidterm ? data.midterm_total : data.total || '-'}</td>
              <td className="py-2 text-center text-slate-500">{isMidterm ? (data as any).midterm_average : data.class_average || '-'}</td>
              <td className="py-2 text-center">{isMidterm ? data.midterm_grade : data.grade || '-'}</td>
              <td className="py-2 text-left pl-4 italic text-slate-600">{isMidterm ? data.midterm_remark : data.remark || '-'}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
            <td className="py-3 px-2">OVERALL PERFORMANCE</td>
            <td className="py-3 text-center">{result.total_score || '-'}</td>
            <td className="py-3 text-center" colSpan={3}>
              Avg: {result.average_score || '-'} |
              Class Avg: {result.class_average || '-'} |
              Pos: {result.position || '-'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Traits and Remarks */}
      <div className="flex gap-12">
        <div className="w-1/2">
          <h3 className="font-bold uppercase border-b border-slate-900 pb-1 mb-3">Behavior & Traits</h3>
          {behaviorCategories.map(cat => (
            <div key={cat.id} className="mb-4">
              <div className="font-semibold text-xs text-slate-500 uppercase mb-1">{cat.name}</div>
              {cat.fields_list?.map(f => (
                <div key={f.id} className="flex justify-between text-sm py-0.5">
                  <span>{f.name}</span>
                  <span className="font-mono font-bold">{behaviorRatings[f.name] || '-'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="w-1/2">
          <h3 className="font-bold uppercase border-b-2 border-slate-900 pb-1 mb-3">Official Remarks</h3>

          {/* Custom Fields - FIXED LINE BELOW */}
          {settings.enable_custom_comment_fields && (settings.custom_comment_fields ?? []).map((fieldName: string) => (
            <div key={fieldName} className="mb-3">
              <div className="text-[10px] text-slate-500 uppercase font-bold">{fieldName}</div>
              <div className="text-sm border-l-2 border-slate-200 pl-3 py-1">
                {renderCommentValue(
                  comments.custom_comments?.[fieldName] ??
                  comments?.[fieldName as keyof typeof comments] ??
                  '—'
                )}
              </div>
            </div>
          ))}

          <div className="mb-4">
            <div className="text-xs text-slate-500 uppercase font-bold">Form Teacher: {toTitleCase(comments.form_teacher)}</div>
            <div className="text-sm italic mt-1 border-l-2 border-slate-900 pl-3 py-1">
               {renderCommentValue(comments.form_teacher_comment || '—')}
            </div>
            {comments.form_teacher_signature && (
              <div className="mt-2 h-12">
                <img src={ensureAbsoluteUrl(comments.form_teacher_signature)} alt="Signature" className="h-full object-contain" />
              </div>
            )}
          </div>
          <div className="mb-4">
            <div className="text-xs text-slate-500 uppercase font-bold">{comments.head_teacher_title || 'Principal'}: {toTitleCase(comments.head_teacher)}</div>
            <div className="text-sm italic mt-1 border-l-2 border-slate-900 pl-3 py-1">
              {renderCommentValue(comments.head_teacher_comment || '—')}
            </div>
            {comments.head_teacher_signature && (
              <div className="mt-2 h-12">
                <img src={ensureAbsoluteUrl(comments.head_teacher_signature)} alt="Signature" className="h-full object-contain" />
              </div>
            )}
          </div>
          <div className="mt-8 pt-4 border-t border-dashed border-slate-300">
            <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest">
              This is a computer-generated document.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}