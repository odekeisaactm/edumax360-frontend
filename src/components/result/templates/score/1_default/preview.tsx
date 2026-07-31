'use client';

/**
 * Score Template 1 — Classic Standard
 * File: src/components/result/templates/score/1_default/preview.tsx
 *
 * CHANGE LOG (this revision):
 * - Fixed Vertical Headers: When columns are rotated vertically, `whiteSpace` is set to `normal` and `height` is clamped to `110px`. This forces long names like "Holiday Assignment" to wrap into two vertical lines, saving massive vertical height.
 */

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  dummySchool, dummyStudent, dummyScoreResult, dummyBehavior,
  dummyBehaviorRatings, dummyComments, dummyGradeList,
  dummySettings, dummyFieldList, dummyPeriod,
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
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(Number(score))) return '#1e293b';
  const s = Number(score);
  if (s < 40) return '#dc2626';
  if (s < 45) return '#ca8a04';
  if (s < 70) return '#0f172a';
  if (s < 85) return '#16a34a';
  return '#2563eb';
}

function SafeImage({ src, alt, fallbackText, style }: { src?: string; alt: string; fallbackText: string; style: React.CSSProperties }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: 4 }}>
        {fallbackText}
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} onError={() => setFailed(true)} />;
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

  const isPreview = !studentProp && !resultProp;
  const school   = schoolInfoProp  ?? dummySchool;
  const student  = studentProp     ?? dummyStudent;
  const result   = resultProp      ?? { ...dummyScoreResult.summary, result_data: dummyScoreResult.subjects, session_name: dummyPeriod.session, period_name: dummyPeriod.term };
  const settings = settingsProp    ?? dummySettings;
  const bCats    = behaviorCatProp?.length  ? behaviorCatProp  : dummyBehavior.categories;
  const bRatings = behaviorRatingsProp && Object.keys(behaviorRatingsProp).length ? behaviorRatingsProp : dummyBehaviorRatings;
  const comments = commentsProp    ?? dummyComments;
  const grades   = gradeListProp?.length    ? gradeListProp    : dummyGradeList;
  const fields   = fieldListProp?.length    ? fieldListProp    : dummyFieldList;

  const headerColor    = hex(settings.header_color,    '#2c5f8d');
  const primaryColor   = hex(settings.primary_color,   '#2c5f8d');
  const secondaryColor = hex(settings.secondary_color, '#f0f4f8');
  const accentColor    = hex(settings.accent_color,    '#1890ff');

  const resultData: Record<string, any> = result.result_data ?? {};

  const subjectRows = useMemo(() => {
    if (subjectListProp?.length) {
      return subjectListProp.map((sub: any) => ({
        ...sub,
        name: toTitleCase(sub.name),
        scores: resultData[String(sub.id)] ?? null
      })).filter((s: any) => s.scores);
    }
    return Object.entries(resultData).map(([id, data]: [string, any]) => ({
      id,
      name: toTitleCase(data.subject_name || 'Unknown Subject'),
      code: data.subject_code || '',
      scores: data,
    }));
  }, [subjectListProp, resultData]);

  const scoreCols = useMemo(() => {
    if (termType === 'midterm') return fields.filter((f: any) => f.is_midterm);
    return fields;
  }, [fields, termType]);

  const headerDensity = useMemo(() => {
    const totalChars = scoreCols.reduce((sum: number, c: any) => sum + (c.name?.length ?? 0), 0);
    const count = scoreCols.length;
    if (count > 5 || totalChars > 50) return 'vertical';
    if (count > 4) return 'compact';
    return 'normal';
  }, [scoreCols]);

  const getScore = (colName: string, scores: any): string => {
    if (!scores?.fields) return '—';
    if (scores.fields[colName] !== undefined) return scores.fields[colName];
    const normalizedCol = colName.toLowerCase().trim();
    const entry = Object.entries(scores.fields).find(([k]) => k.toLowerCase().trim() === normalizedCol);
    if (entry) return entry[1] as string;
    const aliases: Record<string,string[]> = {
      ca1:  ['ca 1','ca_1','1st ca','first ca'],
      ca2:  ['ca 2','ca_2','2nd ca','second ca'],
      ca3:  ['ca 3','ca_3','3rd ca','third ca'],
      exam: ['exam','examination','final'],
    };
    for (const [canonical, variants] of Object.entries(aliases)) {
      if (variants.includes(normalizedCol) || canonical === normalizedCol) {
        const match = Object.entries(scores.fields).find(([k]) =>
          variants.includes(k.toLowerCase().trim()) || k.toLowerCase().trim() === canonical
        );
        if (match) return match[1] as string;
      }
    }
    return '—';
  };

  const chartData = useMemo(() =>
    subjectRows.map((s: any) => ({
      name:     s.code || s.name.substring(0, 3).toUpperCase(),
      score:    s.scores?.total ?? 0,
      fullName: s.name,
    })), [subjectRows]
  );

  const showGraph      = settings.show_end_of_term_graph !== false && termType !== 'midterm';
  const showBehaviour  = settings.show_behavior_on_score_result !== false;
  const showPosition   = settings.show_position_on_result !== false;

  const customFields: string[] = settings.enable_custom_comment_fields ? (settings.custom_comment_fields ?? []) : [];

  const totalScore     = result.total_score     ?? (isPreview ? dummyScoreResult.summary.total_score : 0);
  const studentAverage = result.average_score   ?? result.student_average ?? (isPreview ? dummyScoreResult.summary.student_average : 0);
  const classAverage   = result.class_average   ?? (isPreview ? dummyScoreResult.summary.class_average : 0);
  const position       = result.position        ?? (isPreview ? dummyScoreResult.summary.position : '—');
  const attendance     = {
    present: comments.present_attendance ?? student.attendance?.present ?? 0,
    total:   comments.total_attendance   ?? student.attendance?.total   ?? 0
  };
  const sessionName    = result.session_name    ?? (isPreview ? dummyPeriod.session : '—');
  const periodName     = result.period_name     ?? (isPreview ? dummyPeriod.term : '—');
  const termTypeLabel  = termType === 'midterm' ? 'Mid Term' : 'End of Term';

  const vendorName  = school.vendor_name    || 'Balabalutech Limited';
  const vendorSite  = school.vendor_website || 'balabalutech.com';
  const vendorPhone = school.vendor_phone   || '08163550192';

  const commentRows = [
    ...customFields.map((fieldName: string) => ({
      label: fieldName,
      value: comments.custom_comments?.[fieldName] || comments?.[fieldName] || '',
      isComment: false
    })),
    {
      label: 'Class Teacher',
      value: comments.form_teacher && comments.form_teacher !== '—' ? toTitleCase(comments.form_teacher) : '',
      isComment: false
    },
    {
      label: "Teacher's Comment",
      value: comments.form_teacher_comment || '',
      isComment: true
    },
    {
      label: comments.head_teacher_title || 'Principal',
      value: comments.head_teacher && comments.head_teacher !== '—' ? toTitleCase(comments.head_teacher) : '',
      isComment: false
    },
    {
      label: `${comments.head_teacher_title || 'Principal'}'s Comment`,
      value: comments.head_teacher_comment || '',
      isComment: true
    }
  ];

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };

  // ─── THE WRAPPING FIX IS HERE ───
  const thStyle: React.CSSProperties = {
    backgroundColor: headerColor, color: '#fff',
    padding: headerDensity === 'normal' ? '5px 6px' : '4px 3px',
    textAlign: 'center',
    fontSize: headerDensity === 'normal' ? 11 : headerDensity === 'compact' ? 9.5 : 9,
    fontWeight: 700,
    border: `1px solid ${headerColor}`,
    // Set whiteSpace to normal so text can wrap when rotated!
    whiteSpace: headerDensity === 'vertical' ? 'normal' : 'nowrap',
    writingMode: headerDensity === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
    transform: headerDensity === 'vertical' ? 'rotate(180deg)' : 'none',
    // Lock the height so long phrases hit the wall and wrap to 2 vertical lines
    height: headerDensity === 'vertical' ? 110 : undefined,
    lineHeight: 1.1,
  };

  const thLeft: React.CSSProperties = {
    ...thStyle,
    textAlign: 'left',
    writingMode: 'horizontal-tb',
    transform: 'none',
    height: undefined,
    width: '26%',
    minWidth: 180,
    whiteSpace: 'nowrap'
  };

  const tdBase: React.CSSProperties = { padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: 12, color: '#1e293b' };
  const tdLeft: React.CSSProperties = { ...tdBase, textAlign: 'left', fontWeight: 600 };

  const sectionHeader: React.CSSProperties = {
    backgroundColor: headerColor, color: '#fff', padding: '3px 10px',
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
  };

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
      fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1e293b',
    }}>

      {/* ══ LETTERHEAD + TITLE BAND ════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 110, flexShrink: 0, overflow: 'hidden', backgroundColor: headerColor }}>
          <SafeImage
            src={ensureAbsoluteUrl(student.image)}
            alt="Student"
            fallbackText={(student.first_name?.[0] ?? '') + (student.last_name?.[0] ?? '')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: headerColor, color: '#fff', textAlign: 'center', padding: '12px 12px 8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
          <div style={{ ...sectionHeader, fontSize: 12, borderTop: `3px solid ${accentColor}`, backgroundColor: headerColor }}>
            STUDENT REPORT CARD &nbsp;—&nbsp; {periodName.toUpperCase()} {sessionName.toUpperCase()} &nbsp;|&nbsp; {termTypeLabel.toUpperCase()} RESULT
          </div>
        </div>

        <div style={{ width: 110, flexShrink: 0, overflow: 'hidden', backgroundColor: headerColor }}>
          <SafeImage
            src={ensureAbsoluteUrl(school.logo)}
            alt="Logo"
            fallbackText={school.short_name || school.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 10 }}
          />
        </div>
      </div>

      {/* ══ STUDENT INFO GRID ══════════════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: `1px solid #e2e8f0`, borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', borderBottom: '1px solid #e2e8f0', backgroundColor: secondaryColor }}>
          <div style={{ padding: '6px 10px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>
              {student.last_name
                ? toTitleCase(`${student.last_name}, ${student.first_name ?? ''} ${student.middle_name ?? ''}`.replace(/\s+/g, ' ').trim())
                : toTitleCase(student.full_name ?? '—')}
            </span>
          </div>
          <div style={{ padding: '6px 10px', borderRight: '1px solid #e2e8f0', fontSize: 11, display: 'flex', alignItems: 'center' }}>
            <span style={{ color: primaryColor, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>Admission No:</span>
            <span style={{ fontWeight: 600 }}>{student.registration_number ?? '—'}</span>
          </div>
          <div style={{ padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center' }}>
            <span style={{ color: primaryColor, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>Class:</span>
            <span style={{ fontWeight: 600 }}>{`${student.current_class?.name ?? ''} ${student.class_section ?? ''}`.trim() || '—'}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', borderBottom: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
          {[
            ['Gender', toTitleCase(student.gender)],
            ['Attendance', `${attendance.present} of ${attendance.total} days`],
            ['Resumption Date', result.resumption_date ?? (isPreview ? dummyPeriod.next_term_open : '—')],
          ].map(([label, value], i) => (
            <div key={i} style={{ padding: '6px 10px', borderRight: i < 2 ? '1px solid #e2e8f0' : 'none', fontSize: 11, display: 'flex', alignItems: 'center' }}>
              <span style={{ color: primaryColor, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>{label}:</span>
              <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: showPosition ? '1.4fr 1fr 1fr 1fr' : '1.4fr 1fr 1fr', backgroundColor: secondaryColor }}>
          {[
            ['Cum. Total', totalScore],
            ['Student Avg', typeof studentAverage === 'number' ? `${studentAverage.toFixed(1)}%` : studentAverage],
            ['Class Avg', typeof classAverage === 'number' ? `${classAverage.toFixed(1)}%` : classAverage],
            ...(showPosition ? [['Position', ordinal(position)]] : []),
          ].map(([label, value], i) => (
            <div key={i} style={{ padding: '6px 10px', borderRight: (showPosition ? i < 3 : i < 2) ? '1px solid #e2e8f0' : 'none', fontSize: 11, display: 'flex', alignItems: 'center' }}>
              <span style={{ color: primaryColor, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>{label}:</span>
              <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ SCORE TABLE ══════════════════════════════════════════════════════════ */}
      <div style={{ margin: '0 10px' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thLeft}>Subject</th>
              {scoreCols.map((col: any) => (
                <th key={col.id} style={thStyle} title={col.name}>
                  {/* React will naturally wrap this because whiteSpace is normal */}
                  {col.name}<br /><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>/{col.max_mark}</span>
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
              const scoreColor = getScoreColor(s?.total);
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
                  <td style={{ ...tdBase, fontWeight: 700, color: scoreColor, textTransform: 'uppercase' }}>{s?.grade ?? '—'}</td>
                  <td style={{ ...tdBase, fontWeight: 600, color: scoreColor, textTransform: 'uppercase' }}>{s?.remark ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ BAR CHART ════════════════════════════════════════════════════════════ */}
      {showGraph && chartData.length > 0 && (
        <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 5, padding: '6px 4px 2px', backgroundColor: '#fafbfc' }}>
          <div style={{ ...sectionHeader, backgroundColor: 'transparent', color: primaryColor, marginBottom: 2, padding: '2px 10px' }}>
            Performance Chart
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 12, left: -10, bottom: 4 }}
              barCategoryGap={chartData.length <= 4 ? '55%' : chartData.length <= 7 ? '45%' : '30%'}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip formatter={(val: any, _: any, props: any) => [val, props.payload.fullName]} contentStyle={{ fontSize: 11, borderRadius: 8, border: `1px solid ${accentColor}` }} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={getScoreColor(entry.score)} />
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
                      <th style={{ ...thLeft, fontSize: 9, padding: '3px 5px', height: undefined, transform: 'none', writingMode: 'horizontal-tb' }}>{cat.name?.toUpperCase()}</th>
                      <th style={{ ...thStyle, width: 36, fontSize: 9, padding: '3px 5px', height: undefined, transform: 'none', writingMode: 'horizontal-tb' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cat.fields_list ?? cat.items ?? cat.student_behaviour ?? []).map((item: any, ii: number) => {
                      const itemName = item.name ?? item;
                      const score    = item.score ?? bRatings[itemName] ?? bRatings[itemName?.toLowerCase?.()] ?? '—';
                      return (
                        <tr key={ii} style={{ backgroundColor: ii % 2 === 0 ? '#fff' : secondaryColor }}>
                          <td style={{ ...tdLeft, fontSize: 10, fontWeight: 500, padding: '2px 5px' }}>{itemName}</td>
                          <td style={{ ...tdBase, fontWeight: 700, color: accentColor, padding: '2px 5px', fontSize: 10 }}>{score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', padding: '3px 8px', fontSize: 9.5, color: '#64748b', textAlign: 'center', backgroundColor: secondaryColor }}>
            <strong>RATING:</strong>&nbsp;
            {settings.behavior_max_rating === 5
              ? '5-Excellent | 4-Good | 3-Fair | 2-Poor | 1-No Trait'
              : `Scale: 1 to ${settings.behavior_max_rating ?? 5}`}
          </div>
        </div>
      )}

      {/* ══ GRADING SCALE ════════════════════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ ...sectionHeader, padding: '3px 10px' }}>Grading Scale</div>
        <div style={{
          display: 'flex', justifyContent: 'center', flexWrap: 'nowrap', overflowX: 'auto',
          padding: '5px 10px', gap: 16, fontSize: 11, backgroundColor: secondaryColor, whiteSpace: 'nowrap',
        }}>
          {grades.map((g: any, i: number) => {
            const minRaw = Math.round(g.min_score ?? g.end_of_term_min_mark ?? 0);
            const max = Math.round(g.max_score ?? g.end_of_term_max_mark ?? 0);

            // Add 1 to the minimum score for display, UNLESS it is 0
            const min = minRaw > 0 ? minRaw + 1 : minRaw;

            const label = g.grade || g.end_of_term_name || '—';
            return (
              <span key={i}>
                <strong style={{ color: primaryColor, fontSize: 12 }}>{label}</strong>
                <span style={{ color: '#475569', marginLeft: 4 }}>{min}–{max}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ══ REMARKS & COMMENTS ═══════════════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ ...sectionHeader, padding: '3px 10px' }}>Remarks &amp; Comments</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          {commentRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', borderBottom: i < commentRows.length - 1 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none' }}>
              <div style={{ width: '28%', backgroundColor: headerColor, padding: '6px 12px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                <strong style={{ color: '#ffffff', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em' }}>{row.label}</strong>
              </div>
              <div style={{ flex: 1, backgroundColor: '#fff', padding: '6px 12px', color: '#334155', fontStyle: row.isComment ? 'italic' : 'normal', fontWeight: row.isComment ? 400 : 600, borderBottom: i < commentRows.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                {row.value ? (row.isComment ? `"${row.value}"` : row.value) : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ backgroundColor: '#f8fafc', color: '#64748b', textAlign: 'center', padding: '6px 8px', fontSize: 10, marginTop: 8, borderTop: '1px solid #e2e8f0' }}>
        Powered by&nbsp;<span style={{ color: '#334155', fontWeight: 700 }}>{vendorName}</span>&nbsp;|&nbsp;{vendorSite}&nbsp;|&nbsp;{vendorPhone}
      </div>

    </div>
  );
}