'use client';

import React from 'react';
import { ResultSettings, ResultBehaviorCategory } from '@/lib/types';

interface TextResultTemplateProps {
  student: any;
  result: any;
  settings: ResultSettings;
  behaviorCategories: ResultBehaviorCategory[];
  behaviorRatings: any;
  comments: any;
  termType: 'midterm' | 'end_of_term';
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

export default function MinimalTextTemplate({
  student,
  result,
  settings,
  behaviorCategories,
  behaviorRatings,
  comments,
  termType,
  schoolInfo,
}: TextResultTemplateProps) {
  const isMidterm = termType === 'midterm';
  const textCategories = result.text_categories || [];
  const customFields: string[] = settings.enable_custom_comment_fields ? (settings.custom_comment_fields ?? []) : [];

  return (
    <div className="max-w-4xl mx-auto bg-white border border-slate-300 p-10 font-serif text-slate-900">
      {/* Header */}
      <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-widest">{schoolInfo?.name || 'SCHOOL NAME'}</h1>
          <p className="text-sm mt-1 uppercase tracking-wider text-slate-500">Qualitative Assessment Report</p>
        </div>
        <div className="text-right text-sm">
          <p><span className="text-slate-500 uppercase">Term:</span> <span className="font-semibold">{result.period_name} {result.session_name}</span></p>
          <p><span className="text-slate-500 uppercase">Type:</span> <span className="font-semibold">{isMidterm ? 'Midterm' : 'End of Term'}</span></p>
        </div>
      </div>

      {/* Student Details */}
      <div className="grid grid-cols-2 gap-x-16 gap-y-2 text-sm mb-10 border-b border-slate-200 pb-6">
        <div className="flex justify-between border-b border-dashed border-slate-300 py-1">
          <span className="text-slate-500 uppercase">Name</span>
          <span className="font-bold">{student.first_name} {student.last_name}</span>
        </div>
        <div className="flex justify-between border-b border-dashed border-slate-300 py-1">
          <span className="text-slate-500 uppercase">Admission No.</span>
          <span className="font-bold">{student.registration_number?.toUpperCase()}</span>
        </div>
        <div className="flex justify-between border-b border-dashed border-slate-300 py-1">
          <span className="text-slate-500 uppercase">Class</span>
          <span className="font-bold">{student.current_class?.name}</span>
        </div>
        <div className="flex justify-between border-b border-dashed border-slate-300 py-1">
          <span className="text-slate-500 uppercase">Attendance</span>
          <span className="font-bold">{comments.present_attendance || 0} / {comments.total_attendance || 0}</span>
        </div>
      </div>

      <div className="flex gap-16">
        {/* Left Column: Cognitive */}
        <div className="w-1/2">
          <h2 className="text-lg font-bold border-b border-slate-900 mb-4 uppercase">Evaluations</h2>
          <div className="space-y-6">
            {textCategories.map((cat: any) => (
              <div key={cat.id}>
                <h3 className="font-bold text-sm uppercase tracking-wide text-slate-600 mb-2">{cat.name}</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {cat.fields.map((field: any) => (
                      <tr key={field.id} className="border-b border-slate-100">
                        <td className="py-1.5">{field.name}</td>
                        <td className="py-1.5 text-right font-semibold">{field.score || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Behavior & Remarks */}
        <div className="w-1/2">
          <h2 className="text-lg font-bold border-b border-slate-900 mb-4 uppercase">Behavior</h2>
          <div className="space-y-6 mb-8">
            {behaviorCategories.map((cat: any) => (
              <div key={cat.id}>
                <h3 className="font-bold text-sm uppercase tracking-wide text-slate-600 mb-2">{cat.name}</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {cat.fields_list?.map((field: any) => (
                      <tr key={field.id} className="border-b border-slate-100">
                        <td className="py-1.5">{field.name}</td>
                        <td className="py-1.5 text-right font-mono font-bold">{behaviorRatings[field.name] || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <h2 className="text-lg font-bold border-b border-slate-900 mb-4 uppercase">Remarks</h2>
          <div className="space-y-4 text-sm">
            {/* Custom Fields */}
            {customFields.map((fieldName: string, i: number) => (
              <div key={i}>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{fieldName}</p>
                <p className="mt-1">"{comments.custom_comments?.[fieldName] ?? comments?.[fieldName] ?? '—'}"</p>
              </div>
            ))}

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Form Teacher: {toTitleCase(comments.form_teacher)}</p>
              <p className="italic mt-1">"{comments.form_teacher_comment || '—'}"</p>
              {comments.form_teacher_signature && (
                <div className="mt-2 h-10">
                  <img src={ensureAbsoluteUrl(comments.form_teacher_signature)} alt="Signature" className="h-full object-contain" />
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{comments.head_teacher_title || 'Principal'}: {toTitleCase(comments.head_teacher)}</p>
              <p className="italic mt-1">"{comments.head_teacher_comment || '—'}"</p>
              {comments.head_teacher_signature && (
                <div className="mt-2 h-10">
                  <img src={ensureAbsoluteUrl(comments.head_teacher_signature)} alt="Signature" className="h-full object-contain" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}