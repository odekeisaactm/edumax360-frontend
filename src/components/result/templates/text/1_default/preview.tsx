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

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function DefaultTextTemplate({
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
    <div className="max-w-4xl mx-auto bg-white border-2 border-black font-sans text-sm">
      {/* Header */}
      <div className="flex text-white" style={{ backgroundColor: colors.header, borderBottom: '1px solid black', height: '135px' }}>
        <div className="w-1/6">
          <img src={ensureAbsoluteUrl(student.image) || '/images/default-avatar.png'} alt={student.first_name} className="w-full h-[133px] object-cover" />
        </div>
        <div className="w-4/6 text-center py-3 px-4">
          <h4 className="font-serif font-bold text-xl">{schoolInfo?.name?.toUpperCase() || 'SCHOOL NAME'}</h4>
          <h6 className="text-sm mt-1">...{schoolInfo?.motto?.toLowerCase() || 'Motto'}</h6>
          <h6 className="text-xs">{schoolInfo?.address}</h6>
          <p className="text-xs mt-1">{schoolInfo?.mobile_1} | {schoolInfo?.email}</p>
        </div>
        <div className="w-1/6">
          <img src={ensureAbsoluteUrl(schoolInfo?.logo) || '/images/default-logo.png'} alt="Logo" className="w-full h-[133px] object-contain bg-white/10 p-2" />
        </div>
      </div>

      <div className="text-white text-center py-0.5 font-bold border-x border-black" style={{ backgroundColor: colors.header }}>
        Student Report Card For {isMidterm ? 'Mid ' : ''} {result.period_name} {result.session_name} Session
      </div>

      {/* Info Banner */}
      <div className="border border-black rounded-sm p-1 m-1 text-center text-sm font-bold">
        <span>Student Name: {student.first_name} {student.last_name}</span> |
        <span className="ml-2">Admission ID: {student.registration_number?.toUpperCase()}</span> |
        <span className="ml-2">Class: {student.current_class?.name}</span> |
        <span className="ml-2">Attendance: {comments.present_attendance || 0} / {comments.total_attendance || 0}</span>
      </div>

      <div className="h-4" />

      {/* Text Categories */}
      <div className="px-2 space-y-4">
        {textCategories.map((cat: any) => (
          <div key={cat.id}>
            <div className="font-bold text-white px-2 py-0.5" style={{ backgroundColor: colors.header, border: '1px solid black' }}>
              {cat.name.toUpperCase()}
            </div>
            {cat.fields.map((field: any) => (
              <div key={field.id} className="flex border border-t-0 border-gray-400 h-6 items-center font-mono text-sm text-black">
                <div className="w-4/5 px-2">{field.name}</div>
                <div className="w-1/5 border-l border-black text-center font-bold">{field.score || '-'}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="h-6" />

      {/* Behavior */}
      <div className="text-white text-center py-0.5 text-sm font-bold border-y border-black" style={{ backgroundColor: colors.header }}>
        Affective and Psychomotor Observation
      </div>
      <div className="flex flex-wrap p-2 gap-4">
        {behaviorCategories.map((category) => (
          <div key={category.id} className="flex-1 min-w-[250px] border border-black">
            <table className="w-full border-collapse">
              <thead>
                <tr style={{ backgroundColor: colors.header, color: 'white', height: '20px' }}>
                  <th className="text-left pl-2 border border-black">{category.name.toUpperCase()}</th>
                  <th className="border border-black w-16">Score</th>
                </tr>
              </thead>
              <tbody>
                {(category.fields_list ?? category.fields ?? []).map((field: any) => (
                  <tr key={field.id} className="border border-black">
                    <td className="text-left font-bold text-xs pl-2 border border-black">{field.name}</td>
                    <td className="text-center border border-black">{behaviorRatings[field.name] || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Rating System & Comments */}
      <div className="border-t border-black p-2 font-bold text-sm text-center">
        Rating: {settings.behavior_max_rating} - Excellent Trait, {settings.behavior_max_rating - 1} - Good Trait, 1 - No Trait
      </div>
      <div className="border border-black m-2 p-1 font-sans text-xs">
        {customFields.map((fieldName: string, i: number) => (
          <p key={i} className="border-b border-black font-bold py-0.5">
            {fieldName}: {comments.custom_comments?.[fieldName] ?? comments?.[fieldName] ?? '—'}
          </p>
        ))}
        <p className="border-b border-black font-bold py-0.5">Teacher's Name: {comments.form_teacher || '—'}</p>
        <p className="py-0.5 text-white px-1" style={{ backgroundColor: colors.header }}>Teacher's Comment: {comments.form_teacher_comment || '—'}</p>
        <p className="border-b border-black font-bold py-0.5">{comments.head_teacher_title || 'Principal'}'s Name: {comments.head_teacher || '—'}</p>
        <p className="py-0.5 text-white px-1" style={{ backgroundColor: colors.header }}>{comments.head_teacher_title || 'Principal'}'s Comment: {comments.head_teacher_comment || '—'}</p>
      </div>
    </div>
  );
}