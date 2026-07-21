'use client';

/**
 * Score Template 2 — "CCS Classic" (file path / export name kept as-is: 2_modern/preview.tsx, ModernScoreTemplate)
 *
 * This is a full rebuild to match the CCS reference PDF layout 1:1:
 * - Letterhead (photo | school info | logo, full height) + single-line title band
 * - 3-row info box (Name/Class/Gender, Cum Total/Student Avg/Class Avg, School Opened/Present/Resumption)
 * - Subject table (left) running alongside a behavior sidebar (right): Social Development + Work & Study
 *   Habits as 1–5 checkmark grids, plus a Rating Index legend — matches CCS's two-column layout exactly.
 * - Full-width performance chart below both columns
 * - Single-line grading scale (letter-based, no decimals, no repeated "Grade:" label)
 * - CCS-style boxed signatures: name+comment rows on the left, signature image boxed to the right,
 *   spanning that staff member's row height — no separate signature section.
 * - Footer driven by schoolInfo.vendor_name / vendor_website / vendor_phone (white-label per school)
 * - Grade & Remark cells color-coded by raw score (school-agnostic): <40 red, 40–44 yellow, 45–69 black,
 *   70–84 green, 85–100 blue — same convention as Template 1, kept consistent across templates.
 * - Position cell respects settings.show_position_on_result.
 */

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  dummySchool, dummyStudent, dummyScoreResult, dummyBehavior,
  dummyBehaviorRatings, dummyComments, dummyGradeList,
  dummySettings, dummyFieldList, dummyScoreSubjects, dummyPeriod,
} from '@/lib/result-template-dummy-data';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

function ordinal(n: string | number): string {
  const num = parseInt(String(n));
  if (isNaN(num)) return String(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const v = num % 100;
  return num + (s[(v - 20) % 10] || s[v] || s[0]);
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '—';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Score-based color coding — same convention used across all templates
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

export default function ModernScoreTemplate({
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
    if (count > 8 || totalChars > 70) return 'vertical';
    if (count > 6 || totalChars > 50) return 'compact';
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

  const showGraph     = settings.show_end_of_term_graph !== false && termType !== 'midterm';
  const showBehaviour = settings.show_behavior_on_score_result !== false;
  const showPosition  = settings.show_position_on_result !== false;
  const maxRating     = settings.behavior_max_rating ?? 5;
  const customFields: string[] = settings.enable_custom_comment_fields
    ? (settings.custom_comment_fields ?? []) : [];

  const totalScore     = result.total_score     ?? 0;
  const studentAverage = result.average_score   ?? 0;
  const classAverage   = result.class_average   ?? 0;
  const position       = result.position        ?? '—';
  const noInClass      = result.number_of_student ?? student.no_in_class ?? 0;
  const attendance     = {
    present: comments.present_attendance ?? student.attendance?.present ?? 0,
    total:   comments.total_attendance   ?? student.attendance?.total   ?? 0
  };
  const sessionName    = result.session_name    ?? '—';
  const periodName     = result.period_name     ?? '—';
  const termTypeLabel  = termType === 'midterm' ? 'Mid Term' : 'End of Term';

  const vendorName  = school.vendor_name    || 'Balabalutech Limited';
  const vendorSite  = school.vendor_website || 'balabalutech.com';
  const vendorPhone = school.vendor_phone   || '08163550192';

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
  const thStyle: React.CSSProperties = {
    backgroundColor: headerColor, color: '#fff',
    padding: headerDensity === 'normal' ? '5px 6px' : '4px 3px',
    textAlign: 'center',
    fontSize: headerDensity === 'normal' ? 11 : 9.5,
    fontWeight: 700, border: `1px solid ${headerColor}`,
    whiteSpace: 'nowrap',
    writingMode: headerDensity === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
    transform: headerDensity === 'vertical' ? 'rotate(180deg)' : 'none',
    height: headerDensity === 'vertical' ? 60 : undefined,
    maxWidth: headerDensity === 'vertical' ? 24 : undefined,
  };
  const thLeft: React.CSSProperties = { ...thStyle, textAlign: 'left', writingMode: 'horizontal-tb', transform: 'none', height: undefined };
  const tdBase: React.CSSProperties = { padding: '4px 6px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: 12, color: '#1e293b' };
  const tdLeft: React.CSSProperties = { ...tdBase, textAlign: 'left', fontWeight: 600 };

  const sectionHeader: React.CSSProperties = {
    backgroundColor: headerColor, color: '#fff', padding: '3px 8px',
    fontSize: 10.5, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em',
  };

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
      fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1e293b',
    }}>

      {/* ══ LETTERHEAD + TITLE BAND (photo/logo span both, full header height) ══ */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 100, flexShrink: 0, backgroundColor: headerColor }}>
          <SafeImage
            src={ensureAbsoluteUrl(student.image)}
            alt="Student"
            fallbackText={(student.first_name?.[0] ?? '') + (student.last_name?.[0] ?? '')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: headerColor, color: '#fff', textAlign: 'center', padding: '10px 12px 6px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'Georgia, serif', textTransform: 'uppercase' }}>{school.name}</div>
            <div style={{ fontSize: 11, marginTop: 3, opacity: 0.9 }}>{school.address}</div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
              {[school.mobile_1, school.email, school.website].filter(Boolean).join('  |  ')}
            </div>
          </div>
          <div style={{ ...sectionHeader, fontSize: 12, padding: '5px 10px' }}>
            Student Report Card For {termTypeLabel === 'Mid Term' ? 'Mid ' : ''}{periodName} {sessionName} Session
          </div>
        </div>
        <div style={{ width: 100, flexShrink: 0, backgroundColor: headerColor }}>
          <SafeImage
            src={ensureAbsoluteUrl(school.logo)}
            alt="Logo"
            fallbackText={school.short_name || school.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 8 }}
          />
        </div>
      </div>

      {/* ══ INFO BOX — 3 rows, matches CCS exactly ═════════════════════════════ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, margin: '2px 0' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, width: '34%' }}>
              {/* Handles blank middle name cleanly without double spaces */}
              {`${student.first_name ?? ''} ${student.middle_name ? student.middle_name + ' ' : ''}${student.last_name ?? ''}`.replace(/\s+/g, ' ').trim() || student.full_name}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, width: '33%' }}>
              CLASS: {`${student.current_class?.name ?? ''} ${student.class_section ?? ''}`.trim()}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, width: '33%' }}>
              GENDER: {toTitleCase(student.gender)}
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              CUM. TOTAL: {totalScore}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              STUDENT AVERAGE: {typeof studentAverage === 'number' ? studentAverage.toFixed(1) : studentAverage}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              CLASS AVERAGE: {typeof classAverage === 'number' ? classAverage.toFixed(1) : classAverage}
            </td>
          </tr>
          <tr>
            {/* Restructured Row 3 */}
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              ATTENDANCE: {attendance.present} / {attendance.total}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              RESUMPTION DATE: {result.resumption_date ?? '—'}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              {showPosition ? `POSITION: ${ordinal(position)}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ══ TWO-COLUMN: SCORE TABLE (left) + BEHAVIOR SIDEBAR (right) ═══════════ */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>

        {/* Left: subject score table */}
        <div style={{ flex: showBehaviour && bCats.length > 0 ? '0 0 65%' : '1 1 100%' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={{ ...thLeft, width: 150 }}>Subjects</th>
                {scoreCols.map((col: any) => {
                  // Display rule: <= 5 is UPPERCASE, else Title Case
                  const displayName = col.name?.length <= 5 ? col.name.toUpperCase() : toTitleCase(col.name);

                  return (
                    <th key={col.id} style={thStyle} title={col.name}>
                      {headerDensity === 'vertical' ? displayName : (
                        <>{displayName}<br /><span style={{ fontSize: 8.5, fontWeight: 400, opacity: 0.75 }}>({col.max_mark})</span></>
                      )}
                    </th>
                  );
                })}
                <th style={thStyle}>Total<br /><span style={{ fontSize: 8.5, fontWeight: 400, opacity: 0.75 }}>(100)</span></th>
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
                    <td style={{ ...tdBase, fontWeight: 700 }}>{s?.total ?? '—'}</td>
                    <td style={{ ...tdBase, fontWeight: 700, color: scoreColor }}>{s?.grade?.toUpperCase() ?? '—'}</td>
                    <td style={{ ...tdBase, fontWeight: 600, color: scoreColor }}>{s?.remark?.toUpperCase() ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right: behavior sidebar — Social Development + Work/Study Habits + Rating Index */}
        {showBehaviour && bCats.length > 0 && (
          <div style={{ flex: '0 0 35%', borderLeft: 'none' }}>
            {bCats.map((cat: any, ci: number) => (
              <table key={ci} style={{ ...tableStyle, marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th style={{ ...thLeft, fontSize: 9.5, padding: '3px 5px' }}>{cat.name?.toUpperCase()}</th>
                    {Array.from({ length: maxRating }).map((_, ri) => (
                      <th key={ri} style={{ ...thStyle, width: 16, fontSize: 9, padding: '3px 2px' }}>{ri + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(cat.fields_list ?? cat.items ?? cat.student_behaviour ?? []).map((item: any, ii: number) => {
                    const itemName = item.name ?? item;
                    const score = item.score ?? bRatings[itemName] ?? bRatings[itemName?.toLowerCase?.()] ?? null;
                    return (
                      <tr key={ii} style={{ backgroundColor: ii % 2 === 0 ? '#fff' : secondaryColor }}>
                        <td style={{ ...tdLeft, fontSize: 9.5, fontWeight: 500, padding: '2px 5px' }}>{itemName}</td>
                        {Array.from({ length: maxRating }).map((_, ri) => (
                          <td key={ri} style={{ ...tdBase, padding: '2px', fontSize: 10, color: accentColor, fontWeight: 700 }}>
                            {Number(score) === ri + 1 ? '✓' : ''}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
            {/* Rating Index legend */}
            <table style={tableStyle}>
              <thead>
                <tr><th style={{ ...thLeft, fontSize: 9.5, padding: '3px 5px' }}>RATING INDEX</th></tr>
              </thead>
              <tbody>
                {[
                  '1. Has no regard for observable traits',
                  '2. Show mental regard for observable traits',
                  '3. Maintain acceptable level of observable traits',
                  '4. Maintain a high level of observable traits',
                  '5. Maintain excellent degree of observable traits',
                ].slice(0, maxRating).map((line, i) => (
                  <tr key={i}>
                    <td style={{ ...tdLeft, fontSize: 8.5, fontWeight: 500, padding: '2px 5px' }}>{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ BAR CHART — full width, below both columns ═════════════════════════ */}
      {showGraph && chartData.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} margin={{ top: 6, right: 12, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
              <Tooltip formatter={(val: any, _: any, props: any) => [val, props.payload.fullName]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={getScoreColor(entry.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ══ GRADING SCALE — one line, letter-based ══════════════════════════════ */}
      <div style={{ border: '1px solid #e2e8f0', borderTop: 'none' }}>
        <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', padding: '4px 10px', gap: 14, fontSize: 10.5, backgroundColor: secondaryColor, whiteSpace: 'nowrap' }}>
          {grades.map((g: any, i: number) => {
            const min = Math.round(g.min_score ?? g.end_of_term_min_mark ?? 0);
            const max = Math.round(g.max_score ?? g.end_of_term_max_mark ?? 0);
            const label = g.grade || g.end_of_term_name || '—';
            return (
              <span key={i}>
                <strong style={{ color: accentColor }}>{label}</strong>&nbsp;{min}–{max}
              </span>
            );
          })}
        </div>
      </div>

      {/* ══ REMARKS + CCS-STYLE BOXED SIGNATURES ════════════════════════════════ */}
      <div style={{ border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
        {customFields.map((fieldName: string, i: number) => (
          <div key={i} style={{ padding: '3px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8, backgroundColor: i % 2 === 0 ? '#fff' : secondaryColor, fontSize: 11.5 }}>
            <strong style={{ minWidth: 110, color: primaryColor, flexShrink: 0 }}>{fieldName}:</strong>
            <span style={{ color: '#475569' }}>{comments.custom_comments?.[fieldName] ?? comments?.[fieldName] ?? '—'}</span>
          </div>
        ))}
        {[
          { label: 'Homeroom Teacher', name: toTitleCase(comments.form_teacher), commentLabel: "Teacher's Comment", comment: comments.form_teacher_comment, signature: comments.form_teacher_signature },
          { label: comments.head_teacher_title ?? 'Principal', name: toTitleCase(comments.head_teacher), commentLabel: "Principal's Comment", comment: comments.head_teacher_comment, signature: comments.head_teacher_signature },
        ].map((staff, si) => (
          <div key={si} style={{ display: 'grid', gridTemplateColumns: '1fr 130px', borderBottom: si === 0 ? '1px solid #e2e8f0' : 'none' }}>
            <div>
              <div style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                {staff.label}: {staff.name ?? '—'}
              </div>
              <div style={{ padding: '4px 10px', backgroundColor: headerColor, color: '#fff', fontSize: 11.5 }}>
                <strong>{staff.commentLabel}:</strong> <span style={{ fontStyle: 'italic' }}>{staff.comment ?? '—'}</span>
              </div>
            </div>
            <div style={{ borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 6px' }}>
              {staff.signature ? (
                <img src={ensureAbsoluteUrl(staff.signature)} alt="Signature" style={{ maxHeight: 30, maxWidth: 110, objectFit: 'contain' }} />
              ) : <div style={{ height: 30 }} />}
              <div style={{ color: '#94a3b8', fontSize: 9, marginTop: 1 }}>Signature</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══ FOOTER — dynamic vendor info ════════════════════════════════════════ */}
      <div style={{ backgroundColor: '#f8fafc', textAlign: 'center', padding: '4px 8px', fontSize: 9, color: '#64748b', border: '1px solid #e2e8f0', borderTop: 'none' }}>
        Managed by <strong>{vendorName}</strong> &nbsp;{vendorPhone}&nbsp; {vendorSite}
      </div>

    </div>
  );
}