'use client';

import React from 'react';

const renderCommentValue = (value: any): React.ReactNode => {
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
};

export default function MinimalScoreTemplate(props: any) {
  const { data } = props;

  // Extract the necessary data from props
  const scores = data?.scores || {};
  const comments = data?.comments || {};

  // Define the academic fields to display
  const academicFields = [
    { key: 'academic_performance', label: 'Academic Performance' },
    { key: 'homework_completion', label: 'Homework Completion' },
    { key: 'class_participation', label: 'Class Participation' },
    { key: 'test_scores', label: 'Test Scores' },
    { key: 'project_quality', label: 'Project Quality' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'behavior', label: 'Behavior' },
    { key: 'effort', label: 'Effort' },
    { key: 'critical_thinking', label: 'Critical Thinking' },
    { key: 'creativity', label: 'Creativity' },
    { key: 'collaboration', label: 'Collaboration' },
    { key: 'communication', label: 'Communication' },
  ];

  // Define custom fields that might come from the data
  const customFields = comments.custom_comments
    ? Object.keys(comments.custom_comments).filter(key => !academicFields.some(field => field.key === key))
    : [];

  return (
    <div className="font-serif max-w-4xl mx-auto p-8">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Academic Report</h1>
        <p className="text-slate-600">Student Performance Evaluation</p>
        {data?.student_name && (
          <div className="mt-4 text-lg">
            <span className="font-semibold">Student:</span> {data.student_name}
          </div>
        )}
        {data?.date && (
          <div className="text-sm text-slate-500">
            Date: {new Date(data.date).toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Scores Section */}
      <div className="mb-12">
        <h2 className="text-xl font-bold border-b-2 border-slate-900 pb-2 mb-6">Academic Scores</h2>
        <div className="space-y-4">
          {academicFields.map((field) => {
            const score = scores[field.key];
            if (score === undefined) return null;

            return (
              <div key={field.key} className="flex items-center justify-between">
                <span className="font-medium text-slate-700">{field.label}</span>
                <div className="flex items-center gap-4">
                  <div className="w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full transition-all duration-300"
                      style={{ width: `${(score / 100) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm text-slate-600 min-w-[40px]">
                    {score}/100
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comments Section */}
      <div>
        <h2 className="text-xl font-bold border-b-2 border-slate-900 pb-2 mb-6">Detailed Comments</h2>

        {/* Standard comments */}
        {academicFields.map((field) => {
          const commentValue = comments[field.key as keyof typeof comments];
          if (!commentValue) return null;

          return (
            <div key={field.key} className="mb-4">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">{field.label}</div>
              <div className="text-sm border-l-2 border-slate-200 pl-3 py-1">
                {renderCommentValue(commentValue)}
              </div>
            </div>
          );
        })}

        {/* Custom comments */}
        {customFields.map((fieldName) => (
          <div key={fieldName} className="mb-4">
            <div className="text-xs text-slate-500 uppercase font-bold mb-1">
              {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <div className="text-sm border-l-2 border-slate-200 pl-3 py-1">
              {renderCommentValue(
                comments.custom_comments?.[fieldName] ??
                comments?.[fieldName as keyof typeof comments] ??
                '—'
              )}
            </div>
          </div>
        ))}

        {/* Overall comments */}
        {comments.overall && (
          <div className="mt-6 pt-4 border-t-2 border-slate-200">
            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Overall Assessment</div>
            <div className="text-sm border-l-2 border-slate-200 pl-3 py-1 italic">
              {renderCommentValue(comments.overall)}
            </div>
          </div>
        )}

        {/* Teacher signature */}
        {data?.teacher_name && (
          <div className="mt-8 pt-4 text-right">
            <div className="text-sm text-slate-600">Teacher: {data.teacher_name}</div>
            <div className="text-xs text-slate-400 mt-1">Electronic Signature</div>
          </div>
        )}
      </div>
    </div>
  );
}