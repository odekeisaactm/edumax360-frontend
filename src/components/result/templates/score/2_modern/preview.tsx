'use client';

/**
 * Score Template 2 — Modern Elegant
 * File: src/components/result/templates/score/2_modern/preview.tsx
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

// Score bar width as percentage of 100
function scoreWidth(score: number): string {
  return `${Math.min(Math.max(score, 0), 100)}%`;
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

  // ── Colors ──────────────────────────────────────────────────────────────────
  const headerColor    = hex(settings.header_color,    '#1e3a5f');
  const primaryColor   = hex(settings.primary_color,   '#2c5f8d');
  const secondaryColor = hex(settings.secondary_color, '#f0f4f8');
  const accentColor    = hex(settings.accent_color,    '#1890ff');

  // Derive a slightly lighter header tint for the right panel
  const headerTint = `${headerColor}18`; // 10% opacity version

  // ── Subjects ────────────────────────────────────────────────────────────────
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
    if (termType === 'midterm') {
      return fields.filter((f: any) => f.is_midterm);
    }
    return fields;
  }, [fields, termType]);

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
  const showGraph     = settings.show_end_of_term_graph !== false && termType !== 'midterm';
  const showBehaviour = settings.show_behavior_on_score_result !== false;
  const customFields: string[] = settings.enable_custom_comment_fields
    ? (settings.custom_comment_fields ?? []) : [];

  // ── Summary ──────────────────────────────────────────────────────────────────
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

  // Grade pill color
  const gradeColor = (grade: string) => {
    if (!grade || grade === '—') return '#94a3b8';
    const g = grade.toUpperCase();
    if (g === 'A') return '#16a34a';
    if (g === 'B') return accentColor;
    if (g === 'C') return '#f59e0b';
    if (g === 'D') return '#f97316';
    return '#ef4444';
  };

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', boxShadow: '0 4px 32px rgba(0,0,0,0.12)',
      fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13, color: '#1e293b',
    }}>

      {/* ══ HEADER ═══════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 120 }}>

        {/* Left panel — dark, stacked logo + photo */}
        <div style={{
          width: 110, flexShrink: 0, backgroundColor: headerColor,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 6, padding: '10px 8px',
        }}>
          <img
            src={ensureAbsoluteUrl(school.logo) ?? '/images/default-logo.png'}
            alt="Logo"
            style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)', padding: 4 }}
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-logo.png'; }}
          />
          <img
            src={ensureAbsoluteUrl(student.image) ?? '/images/default-avatar.png'}
            alt="Student"
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }}
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
          />
        </div>

        {/* Right panel — school info + term badge */}
        <div style={{
          flex: 1, backgroundColor: headerTint, borderLeft: `4px solid ${accentColor}`,
          padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: headerColor, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {school.name}
          </div>
          {school.motto && (
            <div style={{ fontSize: 11, color: primaryColor, fontStyle: 'italic', marginTop: 3 }}>
              {school.motto}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            {school.address}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {[school.mobile_1, school.email, school.website].filter(Boolean).join('  ·  ')}
          </div>
          {/* Term badge */}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              backgroundColor: headerColor, color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '3px 10px',
              borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {termType === 'midterm' ? 'Mid Term' : periodName}
            </span>
            <span style={{
              backgroundColor: accentColor + '22', color: accentColor,
              fontSize: 10, fontWeight: 700, padding: '3px 10px',
              borderRadius: 20, letterSpacing: '0.04em',
            }}>
              {sessionName} Session
            </span>
            <span style={{
              backgroundColor: '#f1f5f9', color: '#475569',
              fontSize: 10, fontWeight: 600, padding: '3px 10px',
              borderRadius: 20,
            }}>
              Student Report Card
            </span>
          </div>
        </div>
      </div>

      {/* ══ STUDENT INFO GRID ════════════════════════════════════════════════════ */}
      <div style={{
        margin: '10px 12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        border: `1px solid ${accentColor}33`,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: secondaryColor,
      }}>
        {[
          ['Student Name',   `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim() || student.full_name],
          ['Admission No.',   student.registration_number],
          ['Class',          `${student.current_class?.name ?? ''} ${student.class_section ?? ''}`.trim()],
          ['Gender',          toTitleCase(student.gender)],
          ['No. in Class',    noInClass],
          ['Attendance',     `${attendance.present} / ${attendance.total} days`],
          ...(termType !== 'midterm' ? [
            ['Session',         sessionName],
            ['Term Closed',     dummyPeriod.date_school_closed],
            ['Next Term Opens', dummyPeriod.next_term_open],
          ] : []),
        ].map(([label, value], i) => {
          const row   = Math.floor(i / 3);
          const col   = i % 3;
          const total = termType !== 'midterm' ? 9 : 6;
          const lastRow = Math.floor((total - 1) / 3);
          return (
            <div key={i} style={{
              padding: '7px 12px',
              borderRight: col < 2 ? `1px solid ${accentColor}22` : 'none',
              borderBottom: row < lastRow ? `1px solid ${accentColor}22` : 'none',
              backgroundColor: row % 2 === 0 ? '#fff' : secondaryColor,
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                {label}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{value ?? '—'}</div>
            </div>
          );
        })}
      </div>

      {/* ══ SCORE TABLE ══════════════════════════════════════════════════════════ */}
      <div style={{ margin: '0 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: headerColor, color: '#fff' }}>
              <th style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 700, borderRadius: '6px 0 0 0', width: 170 }}>
                Subject
              </th>
              {scoreCols.map((col: any) => (
                <th key={col.id} style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                  {col.name}<br />
                  <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>/{col.max_mark}</span>
                </th>
              ))}
              <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>
                Total<br /><span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>/100</span>
              </th>
              <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>Score Bar</th>
              <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>Highest</th>
              <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700 }}>Avg</th>
              <th style={{ padding: '7px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700, borderRadius: '0 6px 0 0' }}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {subjectRows.map((sub: any, i: number) => {
              const s     = sub.scores;
              const total = s?.total ?? 0;
              const isEven = i % 2 === 0;
              return (
                <tr key={sub.id} style={{ backgroundColor: isEven ? '#fff' : secondaryColor }}>
                  {/* Left accent bar + subject name */}
                  <td style={{
                    padding: '6px 10px', fontWeight: 600, fontSize: 12,
                    borderLeft: `3px solid ${accentColor}`,
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    {sub.name}
                  </td>
                  {scoreCols.map((col: any) => (
                    <td key={col.id} style={{ padding: '6px', textAlign: 'center', fontSize: 12, borderBottom: '1px solid #f1f5f9', color: '#475569' }}>
                      {getScore(col.name, s)}
                    </td>
                  ))}
                  {/* Total — bold + colored */}
                  <td style={{ padding: '6px', textAlign: 'center', fontWeight: 800, fontSize: 13, color: primaryColor, borderBottom: '1px solid #f1f5f9' }}>
                    {total || '—'}
                  </td>
                  {/* Progress bar */}
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', minWidth: 80 }}>
                    <div style={{ backgroundColor: '#e2e8f0', borderRadius: 4, height: 7, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4,
                        width: scoreWidth(total),
                        backgroundColor: total >= 70 ? accentColor : total >= 50 ? '#f59e0b' : '#ef4444',
                        transition: 'width 0.3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'right', marginTop: 1 }}>{total}%</div>
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center', fontSize: 12, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                    {s?.highest_in_class ?? '—'}
                  </td>
                  <td style={{ padding: '6px', textAlign: 'center', fontSize: 12, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
                    {s?.average_score ?? s?.class_average ?? '—'}
                  </td>
                  {/* Grade pill */}
                  <td style={{ padding: '6px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: gradeColor(s?.grade) + '22',
                      color: gradeColor(s?.grade),
                      fontWeight: 800, fontSize: 12,
                      padding: '2px 10px', borderRadius: 20,
                      border: `1px solid ${gradeColor(s?.grade)}44`,
                    }}>
                      {s?.grade ?? '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ SUMMARY CARDS ════════════════════════════════════════════════════════ */}
      <div style={{
        margin: '10px 12px',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 8,
      }}>
        {[
          { label: 'Total Score',     value: totalScore,     icon: '📊' },
          { label: 'Student Average', value: typeof studentAverage === 'number' ? `${studentAverage.toFixed(1)}%` : studentAverage, icon: '📈' },
          { label: 'Class Average',   value: typeof classAverage === 'number' ? `${classAverage.toFixed(1)}%` : classAverage, icon: '📉' },
          { label: 'Position',        value: ordinal(position), icon: '🏆' },
          { label: 'Class Size',      value: noInClass,      icon: '👥' },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{
            backgroundColor: secondaryColor,
            border: `1px solid ${accentColor}33`,
            borderRadius: 10, padding: '8px 10px', textAlign: 'center',
            borderTop: `3px solid ${accentColor}`,
          }}>
            <div style={{ fontSize: 16 }}>{icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: primaryColor, marginTop: 2 }}>{value ?? '—'}</div>
            <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ══ BAR CHART ════════════════════════════════════════════════════════════ */}
      {showGraph && chartData.length > 0 && (
        <div style={{ margin: '0 12px 10px', border: `1px solid ${accentColor}22`, borderRadius: 10, padding: '10px 4px 6px', backgroundColor: secondaryColor }}>
          <div style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', color: primaryColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Subject Performance Overview
          </div>
          <ResponsiveContainer width="100%" height={155}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 14, left: -10, bottom: 4 }}
              barCategoryGap={chartData.length <= 4 ? '55%' : chartData.length <= 7 ? '45%' : '30%'}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                formatter={(val: any, _: any, props: any) => [val, props.payload.fullName]}
                contentStyle={{ fontSize: 11, borderRadius: 10, border: `1px solid ${accentColor}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.score < 40 ? '#ef4444' : accentColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ══ BEHAVIOUR ════════════════════════════════════════════════════════════ */}
      {showBehaviour && bCats.length > 0 && (
        <div style={{ margin: '0 12px 10px' }}>
          <div style={{
            backgroundColor: headerColor, color: '#fff',
            padding: '5px 12px', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderRadius: '8px 8px 0 0', textAlign: 'center',
          }}>
            Affective &amp; Psychomotor Observation
          </div>
          <div style={{
            border: `1px solid ${accentColor}33`, borderTop: 'none',
            borderRadius: '0 0 8px 8px', padding: 10,
            display: 'flex', gap: 12, backgroundColor: secondaryColor,
          }}>
            {bCats.map((cat: any, ci: number) => (
              <div key={ci} style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  {cat.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(cat.fields_list ?? cat.items ?? []).map((item: any, ii: number) => {
                    const itemName = item.name ?? item;
                    const score    = item.score ?? bRatings[itemName] ?? 0;
                    const maxRating = settings.behavior_max_rating ?? 5;
                    return (
                      <div key={ii} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#334155', flex: 1 }}>{itemName}</span>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {Array.from({ length: maxRating }).map((_, si) => (
                            <div key={si} style={{
                              width: 10, height: 10, borderRadius: '50%',
                              backgroundColor: si < score ? accentColor : '#e2e8f0',
                            }} />
                          ))}
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: '#fff',
                          backgroundColor: accentColor,
                          width: 22, height: 22, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {score}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
            Rating: {settings.behavior_max_rating ?? 5} — Excellent &nbsp;|&nbsp; 4 — Good &nbsp;|&nbsp; 3 — Fair &nbsp;|&nbsp; 1 — No Trait
          </div>
        </div>
      )}

      {/* ══ GRADE KEY ════════════════════════════════════════════════════════════ */}
      <div style={{ margin: '0 12px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>
          Grade Key:
        </span>
        {grades.map((g: any, i: number) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            backgroundColor: gradeColor(g.grade || g.end_of_term_name) + '18',
            border: `1px solid ${gradeColor(g.grade || g.end_of_term_name)}44`,
            color: gradeColor(g.grade || g.end_of_term_name),
            fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 20,
          }}>
            <strong>{g.grade || g.end_of_term_name}:</strong> {g.min_score || g.end_of_term_min_mark}–{g.max_score || g.end_of_term_max_mark}
            {(g.remark || g.end_of_term_remark) ? ` · ${g.remark || g.end_of_term_remark}` : ''}
          </span>
        ))}
      </div>

      {/* ══ COMMENTS ═════════════════════════════════════════════════════════════ */}
      <div style={{ margin: '0 12px 10px', border: `1px solid ${accentColor}33`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{
          backgroundColor: headerColor, color: '#fff',
          padding: '5px 12px', fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Remarks &amp; Comments
        </div>
        <div style={{ fontSize: 12 }}>
          {customFields.map((fieldName: string, i: number) => (
            <div key={i} style={{
              padding: '6px 12px', display: 'flex', gap: 10,
              borderBottom: '1px solid #f1f5f9',
              backgroundColor: i % 2 === 0 ? '#fff' : secondaryColor,
            }}>
              <strong style={{ minWidth: 140, color: accentColor, flexShrink: 0, fontSize: 11 }}>{fieldName}:</strong>
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
              padding: '6px 12px', display: 'flex', gap: 10,
              borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none',
              backgroundColor: (customFields.length + (i as number)) % 2 === 0 ? '#fff' : secondaryColor,
            }}>
              <strong style={{ minWidth: 140, color: accentColor, flexShrink: 0, fontSize: 11 }}>{label as string}:</strong>
              <span style={{ color: '#475569', fontStyle: italic ? 'italic' : 'normal' }}>{value as string ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ SIGNATURES ═══════════════════════════════════════════════════════════ */}
      <div style={{ margin: '10px 12px 8px', display: 'flex', justifyContent: 'space-around', fontSize: 11 }}>
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
            <div style={{ borderBottom: `2px solid ${accentColor}`, marginBottom: 4, height: 28 }} />
            <div style={{ fontWeight: 600, color: '#334155' }}>{staff.name ?? '—'}</div>
            <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>{staff.role} Signature</div>
          </div>
        ))}
      </div>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════════════ */}
      <div style={{
        margin: '0 12px 12px',
        backgroundColor: secondaryColor,
        border: `1px solid ${accentColor}22`,
        borderRadius: 8,
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 9,
        color: '#94a3b8',
      }}>
        <span>This result is computer-generated and valid without a stamp.</span>
        <span>
          Powered by&nbsp;
          <strong style={{ color: primaryColor }}>Balabalutech Limited</strong>
          &nbsp;·&nbsp;balabalutech.com&nbsp;·&nbsp;08163550192
        </span>
      </div>

    </div>
  );
}