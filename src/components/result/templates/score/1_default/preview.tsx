'use client';

/**
 * Score Template 1 — Classic Standard
 * File: src/components/result/templates/score/1_default/preview.tsx
 */

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  dummySchool, dummyStudent, dummyScoreResult, dummyBehavior,
  dummyBehaviorRatings, dummyComments, dummyGradeList,
  dummySettings, dummyFieldList, dummyScoreSubjects, dummyPeriod,
} from '@/lib/result-template-dummy-data';

import { getApiUrl } from '@/lib/getApiUrl';

const API_BASE_URL = typeof window !== 'undefined' ? getApiUrl() : (process.env.NEXT_PUBLIC_API_URL || '');

interface ScoreTemplateProps {
  student?:            any;
  result?:             any;
  settings?:           any;
  behaviorCategories?: any[];
  behaviorRatings?:    Record<string, number>;
  comments?:           any;
  termType?:           'midterm' | 'end_of_term';
  gradeList?:          any[];
  midtermGradeList?:   any[];
  schoolInfo?:         any;
  fieldList?:          any[];
  subjectList?:        any[];
}

function hex(v: string, fallback: string): string {
  return v && v.startsWith('#') ? v : fallback;
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '—';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ordinal(n: string | number): string {
  const num = parseInt(String(n));
  if (isNaN(num)) return String(n);
  const s = ['th','st','nd','rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  // If it starts with /media or /static, prepend base URL
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function DefaultScoreTemplate({
  student:            studentProp,
  result:             resultProp,
  settings:           settingsProp,
  behaviorCategories: behaviorCatProp,
  behaviorRatings:    behaviorRatingsProp,
  comments:           commentsProp,
  termType            = 'end_of_term',
  gradeList:          gradeListProp,
  schoolInfo:         schoolInfoProp,
  fieldList:          fieldListProp,
  subjectList:        subjectListProp,
}: ScoreTemplateProps) {

  // ── Resolve with fallbacks ──────────────────────────────────────────────────
  const school   = schoolInfoProp  ?? dummySchool;
  const student  = studentProp     ?? dummyStudent;
  const result   = resultProp      ?? { ...dummyScoreResult.summary, result_data: dummyScoreResult.subjects, session_name: dummyPeriod.session, period_name: dummyPeriod.term };
  const settings = settingsProp    ?? dummySettings;
  const bCats    = behaviorCatProp?.length  ? behaviorCatProp  : dummyBehavior.categories;
  const bRatings = behaviorRatingsProp && Object.keys(behaviorRatingsProp).length ? behaviorRatingsProp : dummyBehaviorRatings;
  const comments = commentsProp    ?? dummyComments;
  const grades   = gradeListProp?.length    ? gradeListProp    : dummyGradeList;
  const fields   = fieldListProp?.length    ? fieldListProp    : dummyFieldList;

  // ── Colors from result settings ─────────────────────────────────────────────
  const headerColor    = hex(settings.header_color,    '#2c5f8d'); // letterhead + all section headers
  const primaryColor   = hex(settings.primary_color,   '#2c5f8d'); // text accents, labels, borders
  const secondaryColor = hex(settings.secondary_color, '#f0f4f8'); // row stripes, info band bg
  const accentColor    = hex(settings.accent_color,    '#1890ff'); // chart bars, grade highlights

  // ── Subject rows ─────────────────────────────────────────────────────────────
  const resultData: Record<string, any> = result.result_data ?? {};
  
  const subjectRows = useMemo(() => {
    // If subjectList is provided, use it. Otherwise, derive from resultData.
    if (subjectListProp?.length) {
      return subjectListProp.map((sub: any) => ({ 
        ...sub, 
        name: toTitleCase(sub.name),
        scores: resultData[String(sub.id)] ?? null 
      })).filter((s: any) => s.scores);
    }
    
    // Derive from resultData keys
    return Object.entries(resultData).map(([id, data]: [string, any]) => ({
      id,
      name: toTitleCase(data.subject_name || 'Unknown Subject'),
      code: data.subject_code || '',
      scores: data,
    }));
  }, [subjectListProp, resultData]);

  // ── Score columns (exclude midterm fields) ───────────────────────────────────
  const scoreCols = useMemo(() => {
    if (termType === 'midterm') {
      return fields.filter((f: any) => f.is_midterm);
    }
    // For End of Term, show everything that is part of the final score
    return fields;
  }, [fields, termType]);

  // ── Map column name → score key ──────────────────────────────────────────────
  const getScore = (colName: string, scores: any): string => {
    if (!scores?.fields) return '—';
    
    // 1. Try exact match
    if (scores.fields[colName] !== undefined) return scores.fields[colName];

    // 2. Try case-insensitive match
    const normalizedCol = colName.toLowerCase().trim();
    const entry = Object.entries(scores.fields).find(([k]) => k.toLowerCase().trim() === normalizedCol);
    if (entry) return entry[1] as string;

    // 3. Try common aliases (fallback)
    const aliases: Record<string,string[]> = {
      ca1:  ['ca 1','ca_1','1st ca','first ca'],
      ca2:  ['ca 2','ca_2','2nd ca','second ca'],
      ca3:  ['ca 3','ca_3','3rd ca','third ca'],
      exam: ['exam','examination','final'],
    };
    
    for (const [canonical, variants] of Object.entries(aliases)) {
      if (variants.includes(normalizedCol) || canonical === normalizedCol) {
        // Look for any of these variants in the actual score keys
        const match = Object.entries(scores.fields).find(([k]) => 
          variants.includes(k.toLowerCase().trim()) || k.toLowerCase().trim() === canonical
        );
        if (match) return match[1] as string;
      }
    }

    return '—';
  };

  // ── Chart ────────────────────────────────────────────────────────────────────
  const chartData = useMemo(() =>
    subjectRows.map((s: any) => ({
      name:     s.code || s.name.substring(0, 3).toUpperCase(),
      score:    s.scores?.total ?? 0,
      fullName: s.name,
    })), [subjectRows]
  );

  // ── Conditionals ─────────────────────────────────────────────────────────────
  const showGraph      = settings.show_end_of_term_graph !== false && termType !== 'midterm';
  const showBehaviour  = settings.show_behavior_on_score_result !== false;
  
  // Robust check for custom fields
  const customFields: string[] = settings.enable_custom_comment_fields 
    ? (settings.custom_comment_fields ?? []) 
    : [];

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalScore     = result.total_score     ?? dummyScoreResult.summary.total_score;
  const studentAverage = result.average_score   ?? result.student_average ?? dummyScoreResult.summary.student_average;
  const classAverage   = result.class_average   ?? dummyScoreResult.summary.class_average;
  const position       = result.position        ?? dummyScoreResult.summary.position;
  const noInClass      = result.number_of_student ?? student.no_in_class ?? dummyScoreResult.summary.number_of_student;
  const attendance     = {
    present: comments.present_attendance ?? student.attendance?.present ?? 0,
    total:   comments.total_attendance   ?? student.attendance?.total   ?? 0
  };
  const sessionName    = result.session_name    ?? dummyPeriod.session;
  const periodName     = result.period_name     ?? dummyPeriod.term;

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };

  const thStyle: React.CSSProperties = {
    backgroundColor: headerColor,
    color: '#fff',
    padding: '5px 6px',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 700,
    border: `1px solid ${headerColor}`,
    whiteSpace: 'nowrap',
  };
  const thLeft: React.CSSProperties = { ...thStyle, textAlign: 'left' };

  const tdBase: React.CSSProperties = {
    padding: '4px 6px',
    border: '1px solid #e2e8f0',
    textAlign: 'center',
    fontSize: 12,
    color: '#1e293b',
  };
  const tdLeft: React.CSSProperties = { ...tdBase, textAlign: 'left', fontWeight: 600, fontFamily: 'Arial, sans-serif' };

  const sectionHeader: React.CSSProperties = {
    backgroundColor: headerColor,
    color: '#fff',
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    textAlign: 'center',
  };

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
      fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1e293b',
    }}>

      {/* ══ LETTERHEAD ═══════════════════════════════════════════════════════════ */}
      <div style={{ backgroundColor: headerColor, color: '#fff', display: 'flex', alignItems: 'stretch' }}>

        {/* Student photo — full height */}
        <div style={{ width: 110, flexShrink: 0, overflow: 'hidden' }}>
          <img
            src={ensureAbsoluteUrl(student.image) ?? '/images/default-avatar.png'}
            alt="Student"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
          />
        </div>

        {/* School details — center */}
        <div style={{ flex: 1, textAlign: 'center', padding: '14px 12px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'Georgia, serif', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {school.name}
          </div>
          {school.motto && (
            <div style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.82, marginTop: 3 }}>
              …{school.motto}…
            </div>
          )}
          <div style={{ fontSize: 11, marginTop: 3, opacity: 0.88 }}>{school.address}</div>
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.80 }}>
            {[school.mobile_1, school.email, school.website].filter(Boolean).join('  |  ')}
          </div>
        </div>

        {/* School logo — full height */}
        <div style={{ width: 110, flexShrink: 0, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          <img
            src={ensureAbsoluteUrl(school.logo) ?? '/images/default-logo.png'}
            alt="Logo"
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 10 }}
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-logo.png'; }}
          />
        </div>
      </div>

      {/* ══ REPORT TITLE BAND ════════════════════════════════════════════════════ */}
      <div style={{ ...sectionHeader, fontSize: 12, borderBottom: `3px solid ${accentColor}` }}>
        STUDENT REPORT CARD &nbsp;—&nbsp;
        {termType === 'midterm' ? 'MID TERM' : periodName.toUpperCase()}
        &nbsp;|&nbsp; {sessionName.toUpperCase()} SESSION
      </div>

      {/* ══ STUDENT INFO GRID ════════════════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: `1px solid #e2e8f0`, borderRadius: 5, overflow: 'hidden', backgroundColor: secondaryColor }}>
        {/* Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
          {[
            ['Student Name', `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || student.full_name],
            ['Admission No.',  student.registration_number],
            ['Class',         `${student.current_class?.name ?? ''} ${student.class_section ?? ''}`.trim()],
          ].map(([label, value], i) => (
            <div key={i} style={{
              padding: '5px 10px',
              borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
              fontSize: 12,
            }}>
              <span style={{ color: primaryColor, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 1 }}>
                {label}
              </span>
              <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
            </div>
          ))}
        </div>
        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: termType !== 'midterm' ? '1px solid #e2e8f0' : 'none' }}>
          {[
            ['Gender',       toTitleCase(student.gender)],
            ['No. in Class', noInClass],
            ['Attendance',   `${attendance.present} of ${attendance.total} days`],
          ].map(([label, value], i) => (
            <div key={i} style={{
              padding: '5px 10px',
              borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
              fontSize: 12,
            }}>
              <span style={{ color: primaryColor, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 1 }}>
                {label}
              </span>
              <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
            </div>
          ))}
        </div>
        {/* Row 3 — end of term only */}
        {termType !== 'midterm' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            {[
              ['Session',        sessionName],
              ['Term Closed',    dummyPeriod.date_school_closed],
              ['Next Term Opens',dummyPeriod.next_term_open],
            ].map(([label, value], i) => (
              <div key={i} style={{
                padding: '5px 10px',
                borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
                fontSize: 12,
              }}>
                <span style={{ color: primaryColor, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 1 }}>
                  {label}
                </span>
                <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ SCORE TABLE ══════════════════════════════════════════════════════════ */}
      <div style={{ margin: '0 10px' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thLeft, width: 170 }}>Subject</th>
              {scoreCols.map((col: any) => (
                <th key={col.id} style={thStyle}>
                  {col.name}<br />
                  <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>/{col.max_mark}</span>
                </th>
              ))}
              <th style={thStyle}>Total<br /><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>/100</span></th>
              <th style={thStyle}>Highest</th>
              <th style={thStyle}>Lowest</th>
              <th style={thStyle}>Class Avg</th>
              <th style={thStyle}>Grade</th>
              <th style={thStyle}>Remark</th>
            </tr>
          </thead>
          <tbody>
            {subjectRows.map((sub: any, i: number) => {
              const s = sub.scores;
              return (
                <tr key={sub.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : secondaryColor }}>
                  <td style={tdLeft}>{sub.name}</td>
                  {scoreCols.map((col: any) => (
                    <td key={col.id} style={tdBase}>{getScore(col.name, s)}</td>
                  ))}
                  <td style={{ ...tdBase, fontWeight: 700, color: primaryColor }}>{s?.total ?? '—'}</td>
                  <td style={tdBase}>{s?.highest_in_class ?? '—'}</td>
                  <td style={tdBase}>{s?.lowest_in_class ?? '—'}</td>
                  <td style={tdBase}>{s?.class_average ?? s?.average_score ?? '—'}</td>
                  <td style={{ ...tdBase, fontWeight: 700, color: accentColor }}>{s?.grade ?? '—'}</td>
                  <td style={tdBase}>{s?.remark ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ SUMMARY BAND ═════════════════════════════════════════════════════════ */}
      <div style={{
        margin: '6px 10px',
        backgroundColor: headerColor,
        color: '#fff',
        borderRadius: 4,
        padding: '6px 12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        fontSize: 12,
        gap: 4,
      }}>
        {[
          ['Total Score',     totalScore],
          ['Student Average', typeof studentAverage === 'number' ? `${studentAverage.toFixed(1)}%` : studentAverage],
          ['Class Average',   typeof classAverage === 'number' ? `${classAverage.toFixed(1)}%` : classAverage],
          ['Position',        ordinal(position)],
          ['No. of Students', noInClass],
        ].map(([label, value]) => (
          <div key={label as string} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>{value ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* ══ BAR CHART ════════════════════════════════════════════════════════════ */}
      {showGraph && chartData.length > 0 && (
        <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 5, padding: '8px 4px 4px', backgroundColor: '#fafbfc' }}>
          <div style={{ ...sectionHeader, backgroundColor: 'transparent', color: primaryColor, marginBottom: 4 }}>
            Performance Chart
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 12, left: -10, bottom: 4 }}
              barCategoryGap={chartData.length <= 4 ? '55%' : chartData.length <= 7 ? '45%' : '30%'}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={(val: any, _: any, props: any) => [val, props.payload.fullName]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${accentColor}` }}
              />
              <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.score < 40 ? '#f87171' : accentColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ══ BEHAVIOUR ════════════════════════════════════════════════════════════ */}
      {showBehaviour && bCats.length > 0 && (
        <div style={{ margin: '8px 10px' }}>
          <div style={sectionHeader}>
            Affective &amp; Psychomotor Observation (Behavioural &amp; Physical Abilities)
          </div>
          <div style={{ display: 'flex', border: '1px solid #e2e8f0', borderTop: 'none' }}>
            {bCats.map((cat: any, ci: number) => (
              <div key={ci} style={{ flex: 1, borderRight: ci < bCats.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thLeft, fontSize: 10 }}>{cat.name?.toUpperCase()}</th>
                      <th style={{ ...thStyle, width: 44, fontSize: 10 }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cat.fields_list ?? cat.items ?? cat.student_behaviour ?? []).map((item: any, ii: number) => {
                      const itemName = item.name ?? item;
                      const score    = item.score ?? bRatings[itemName] ?? bRatings[itemName.toLowerCase()] ?? '—';
                      return (
                        <tr key={ii} style={{ backgroundColor: ii % 2 === 0 ? '#fff' : secondaryColor }}>
                          <td style={{ ...tdLeft, fontSize: 11, fontWeight: 500 }}>{itemName}</td>
                          <td style={{ ...tdBase, fontWeight: 700, color: accentColor }}>{score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', padding: '3px 8px', fontSize: 10, color: '#64748b', textAlign: 'center', backgroundColor: secondaryColor }}>
            Rating:&nbsp;
            {settings.behavior_max_rating ?? 5} — Excellent &nbsp;|&nbsp;
            4 — Good &nbsp;|&nbsp;
            3 — Fair &nbsp;|&nbsp;
            1 — No Trait
          </div>
        </div>
      )}

      {/* ══ GRADE KEY ════════════════════════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={sectionHeader}>Grading Scale</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', padding: '5px 10px', gap: '2px 18px', fontSize: 11, backgroundColor: secondaryColor }}>
          {grades.map((g: any, i: number) => (
            <span key={i}>
              <strong style={{ color: accentColor }}>{g.grade || g.end_of_term_name || 'Grade'}:</strong>
              &nbsp;{g.min_score || g.end_of_term_min_mark}–{g.max_score || g.end_of_term_max_mark}
              {(g.remark || g.end_of_term_remark) ? ` (${g.remark || g.end_of_term_remark})` : ''}
            </span>
          ))}
        </div>
      </div>

      {/* ══ COMMENTS ═════════════════════════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={sectionHeader}>Remarks &amp; Comments</div>
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          {customFields.map((fieldName: string, i: number) => (
            <div key={i} style={{ padding: '4px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, backgroundColor: i % 2 === 0 ? '#fff' : secondaryColor }}>
              <strong style={{ minWidth: 140, color: primaryColor, flexShrink: 0 }}>{fieldName}:</strong>
              <span style={{ color: '#475569' }}>{comments.custom_comments?.[fieldName] ?? comments?.[fieldName] ?? '—'}</span>
            </div>
          ))}
          {[
            ['Class Teacher',      toTitleCase(comments.form_teacher), false],
            ["Teacher's Comment",  comments.form_teacher_comment,   true ],
            [comments.head_teacher_title ?? 'Principal', toTitleCase(comments.head_teacher), false],
            ["Principal's Comment",comments.head_teacher_comment,   true ],
          ].map(([label, value, italic], i) => (
            <div key={i as number} style={{
              padding: '4px 10px',
              borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none',
              display: 'flex',
              gap: 8,
              backgroundColor: (customFields.length + i) % 2 === 0 ? '#fff' : secondaryColor,
            }}>
              <strong style={{ minWidth: 140, color: primaryColor, flexShrink: 0 }}>{label as string}:</strong>
              <span style={{ color: '#475569', fontStyle: italic ? 'italic' : 'normal' }}>{value as string ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ SIGNATURES ═══════════════════════════════════════════════════════════ */}
      <div style={{ margin: '12px 10px 8px', display: 'flex', justifyContent: 'space-around', fontSize: 11 }}>
        {[
          { role: 'Class Teacher', name: toTitleCase(comments.form_teacher), signature: comments.form_teacher_signature },
          { role: comments.head_teacher_title ?? 'Principal', name: toTitleCase(comments.head_teacher), signature: comments.head_teacher_signature }
        ].map((staff, idx) => (
          <div key={idx} style={{ textAlign: 'center', minWidth: 140, position: 'relative' }}>
            {/* Signature Image */}
            <div style={{ height: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: -10 }}>
              {staff.signature && (
                <img 
                  src={ensureAbsoluteUrl(staff.signature)} 
                  alt="Signature" 
                  style={{ maxHeight: '100%', maxWidth: 120, objectFit: 'contain' }} 
                />
              )}
            </div>
            <div style={{ borderBottom: `2px solid ${primaryColor}`, marginBottom: 4, height: 28 }} />
            <div style={{ fontWeight: 600, color: '#334155' }}>{staff.name ?? '—'}</div>
            <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>{staff.role} Signature</div>
          </div>
        ))}
      </div>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        backgroundColor: headerColor,
        color: 'rgba(255,255,255,0.55)',
        textAlign: 'center',
        padding: '6px 8px',
        fontSize: 9,
        marginTop: 8,
        letterSpacing: '0.03em',
      }}>
        Powered by&nbsp;
        <span style={{ color: '#fff', fontWeight: 700 }}>Balabalutech Limited</span>
        &nbsp;|&nbsp;balabalutech.com&nbsp;|&nbsp;08163550192
      </div>

    </div>
  );
}