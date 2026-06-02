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

export default function ModernTextTemplate({
  student,
  result,
  settings,
  behaviorCategories,
  behaviorRatings,
  comments,
  termType,
  schoolInfo,
}: TextResultTemplateProps) {
  const colors = {
    primary: settings.primary_color || '#2c5f8d',
    secondary: settings.secondary_color || '#f9fafb',
    header: settings.header_color || '#2c5f8d',
    accent: settings.accent_color || '#1890ff',
  };

  const isMidterm = termType === 'midterm';
  const textCategories = result.text_categories || [];
  const customFields: string[] = settings.enable_custom_comment_fields ? (settings.custom_comment_fields ?? []) : [];

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-xl border border-slate-100 font-sans text-slate-800 overflow-hidden">
      <div className="p-8 flex items-center justify-between" style={{ background: `linear-gradient(to right, ${colors.primary}, ${colors.header})`, color: 'white' }}>
        <img src={ensureAbsoluteUrl(student.image) || '/images/default-avatar.png'} alt="Student" className="w-24 h-24 rounded-full border-2 border-white object-cover" />
        <div className="text-center px-4">
          <h1 className="text-2xl font-bold tracking-wider uppercase">{schoolInfo?.name || 'School Name'}</h1>
          <p className="text-sm opacity-90 italic mt-1">{schoolInfo?.motto}</p>
          <div className="mt-3 text-xs bg-white/10 inline-block px-3 py-1 rounded-full">
            {isMidterm ? 'Midterm' : 'End of Term'} Evaluation - {result.period_name} {result.session_name}
          </div>
        </div>
        <img src={ensureAbsoluteUrl(schoolInfo?.logo) || '/images/default-logo.png'} alt="Logo" className="w-20 h-20 rounded-xl bg-white p-1 object-contain" />
      </div>

      <div className="p-8 space-y-6">
        <div className="flex justify-between bg-slate-50 p-4 rounded-xl text-sm border border-slate-100">
          <div><span className="text-slate-400 block text-xs uppercase font-bold">Student Name</span><span className="font-semibold">{student.first_name} {student.last_name}</span></div>
          <div><span className="text-slate-400 block text-xs uppercase font-bold">Admission No.</span><span className="font-semibold">{student.registration_number?.toUpperCase()}</span></div>
          <div><span className="text-slate-400 block text-xs uppercase font-bold">Class</span><span className="font-semibold">{student.current_class?.name}</span></div>
          <div><span className="text-slate-400 block text-xs uppercase font-bold">Attendance</span><span className="font-semibold">{comments.present_attendance || 0} / {comments.total_attendance || 0}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <h2 className="text-lg font-bold border-b-2 pb-2" style={{ borderColor: colors.primary, color: colors.primary }}>Performance Evaluation</h2>
            {textCategories.map((cat: any) => (
              <div key={cat.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">{cat.name}</h3>
                <div className="space-y-2">
                  {cat.fields.map((field: any) => (
                    <div key={field.id} className="flex justify-between text-sm items-center">
                      <span className="text-slate-600">{field.name}</span>
                      <span className="font-semibold px-2 py-0.5 rounded bg-white border border-slate-200" style={{ color: colors.accent }}>{field.score || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <h2 className="text-lg font-bold border-b-2 pb-2" style={{ borderColor: colors.primary, color: colors.primary }}>Behavioral Assessment</h2>
            {behaviorCategories.map((cat: any) => (
              <div key={cat.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">{cat.name}</h3>
                <div className="space-y-2">
                  {cat.fields_list?.map((field: any) => (
                    <div key={field.id} className="flex justify-between text-sm items-center">
                      <span className="text-slate-600">{field.name}</span>
                      <span className="font-bold w-6 text-center">{behaviorRatings[field.name] || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wide">Remarks</h3>
              
              {/* Custom Fields */}
              {customFields.map((fieldName: string, i: number) => (
                <div key={i}>
                  <p className="text-xs text-slate-400 uppercase font-bold">{fieldName}</p>
                  <p className="text-sm font-medium mt-1">"{comments.custom_comments?.[fieldName] ?? comments?.[fieldName] ?? '—'}"</p>
                </div>
              ))}

              <div>
                <p className="text-xs text-slate-400 uppercase font-bold">Form Teacher: {toTitleCase(comments.form_teacher)}</p>
                <p className="text-sm font-medium mt-1 italic">"{comments.form_teacher_comment || '—'}"</p>
                {comments.form_teacher_signature && (
                  <div className="mt-2 h-10">
                    <img src={ensureAbsoluteUrl(comments.form_teacher_signature)} alt="Signature" className="h-full object-contain" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase font-bold">{comments.head_teacher_title || 'Principal'}: {toTitleCase(comments.head_teacher)}</p>
                <p className="text-sm font-medium mt-1 italic">"{comments.head_teacher_comment || '—'}"</p>
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
    </div>
  );
}