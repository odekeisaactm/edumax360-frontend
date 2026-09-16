'use client';

/**
 * Combined Template 1 — Legacy HTML Match (Improved)
 * File: src/components/result/templates/combined/1_default/preview.tsx
 *
 * v2 changes vs original:
 *  - Header uses minHeight instead of a fixed height, so a long school
 *    address/motto can no longer overflow into the subtitle bar below it.
 *  - Student-info strip rebuilt as a lighter 3x3 grid; Date of Birth removed,
 *    Resumption Date kept (renders "—" when unset, same as before).
 *  - Topics-covered fetch now sends the student's class id so the backend can
 *    scope categories to the right class; a name-based de-dupe on the
 *    frontend is kept as a defensive safety net on top of that.
 *  - "KEY" block for text ratings is now a compact, content-width block
 *    instead of a full-width table.
 *  - Rating/Grading legend redesigned as chips instead of a wall of text.
 *  - @page print rule + break-inside:avoid on major blocks/rows, so output
 *    doesn't depend on each browser's print-dialog margin settings and rows
 *    don't get sliced across a page break.
 *  - Cum. Total / Cum. Average now rounded, consistent with every other
 *    score on the page.
 *  - Font stack consolidated (cursive/lato/courier mix replaced with one
 *    sans-serif for structure, monospace kept only for the numeric score grid).
 *  - Colors: unchanged — already pulled from settings, not hardcoded.
 */

import React, { useMemo, useEffect, useState } from 'react';
import {
  dummySchool, dummyStudent, dummyScoreResult, dummyBehavior,
  dummyBehaviorRatings, dummyComments, dummyGradeList,
  dummySettings, dummyFieldList, dummyPeriod,
} from '@/lib/result-template-dummy-data';

import { getApiUrl } from '@/lib/getApiUrl';

const API_BASE_URL = typeof window !== 'undefined' ? getApiUrl() : (process.env.NEXT_PUBLIC_API_URL || '');

interface CombinedTemplateProps {
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
  ratingOptions?:      any[];
  periodId?:           string | number | null;
}

function hex(v: string, fallback: string): string {
  return v && v.startsWith('#') ? v : fallback;
}

// Derives a translucent tint of a settings color for chips/borders —
// keeps the legend/chip redesign fully dynamic, never a hardcoded brand color.
function hexToRgba(hexColor: string, alpha: number): string {
  const clean = (hexColor || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(44,95,141,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '—';
  return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function roundOrDash(v: any): string {
  if (v === undefined || v === null || v === '') return '—';
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n)) : String(v);
}

export default function DefaultCombinedTemplate({
  student:            studentProp,
  result:             resultProp,
  settings:           settingsProp,
  behaviorCategories: behaviorCatProp,
  behaviorRatings:    behaviorRatingsProp,
  comments:           commentsProp,
  termType            = 'end_of_term',
  gradeList:          gradeListProp,
  midtermGradeList:   midtermGradeListProp,
  schoolInfo:         schoolInfoProp,
  fieldList:          fieldListProp,
  subjectList:        subjectListProp,
  ratingOptions:      ratingOptionsProp,
  periodId,
}: CombinedTemplateProps) {

  // ── Resolve with fallbacks ──────────────────────────────────────────────────
  const isPreview = !studentProp && !resultProp;
  const school   = schoolInfoProp  ?? dummySchool;
  const student  = studentProp     ?? dummyStudent;
  const result   = resultProp      ?? { ...dummyScoreResult.summary, result_data: dummyScoreResult.subjects, session_name: dummyPeriod.session, period_name: dummyPeriod.term };
  const settings = settingsProp    ?? dummySettings;
  const bCats    = behaviorCatProp?.length  ? behaviorCatProp  : dummyBehavior.categories;
  const bRatings = behaviorRatingsProp && Object.keys(behaviorRatingsProp).length ? behaviorRatingsProp : dummyBehaviorRatings;
  const comments = commentsProp    ?? dummyComments;
  const grades   = gradeListProp?.length    ? gradeListProp    : dummyGradeList;
  const midGrades= midtermGradeListProp?.length ? midtermGradeListProp : dummyGradeList;
  const fields   = fieldListProp?.length    ? fieldListProp    : dummyFieldList;

  let rawOptions = ratingOptionsProp || result.rating_options || settings.text_rating_options || settings.rating_options || [];
  if (typeof rawOptions === 'string') {
    try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = []; }
  }
  const backendRatingOptions = Array.isArray(rawOptions) ? rawOptions : [];

  // ── Colors from settings ────────────────────────────────────────────────────
  const primaryColor   = hex(settings.primary_color, '#2c5f8d');
  const secondaryColor = hex(settings.secondary_color, '#f0f4f8');
  const headerColor    = hex(settings.header_color, '#2c5f8d');

  const resultData: Record<string, any> = result.result_data ?? {};

  // ============================================================================
  // SCORE LOGIC (Filter for `subject_name`)
  // ============================================================================
  const subjectRows = useMemo(() => {
    if (subjectListProp?.length) {
      return subjectListProp.map((sub: any) => ({
        ...sub,
        name: toTitleCase(sub.name),
        scores: resultData[String(sub.id)] ?? null
      })).filter((s: any) => s.scores && s.scores.subject_name);
    }
    return Object.entries(resultData)
      .filter(([_, data]: [string, any]) => !!data?.subject_name)
      .map(([id, data]: [string, any]) => ({
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

  const getScore = (colName: string, scores: any): string => {
    if (!scores?.fields) return '-';
    if (scores.fields[colName] !== undefined && scores.fields[colName] !== null) return scores.fields[colName];
    const normalizedCol = colName.toLowerCase().trim();
    const entry = Object.entries(scores.fields).find(([k]) => k.toLowerCase().trim() === normalizedCol);
    if (entry && entry[1] !== null) return entry[1] as string;
    return '-';
  };

  // ============================================================================
  // TEXT LOGIC (Filter for `field_name` + Fetch Categories, scoped to the student's class)
  // ============================================================================
  const resolvedPeriodId = periodId ?? result?.academic_period ?? result?.academic_session_period ?? result?.period?.id ?? null;
  // class_config_id is what the real API payload carries; current_class?.id kept as a fallback
  // in case a different caller shapes the student object differently.
  const resolvedClassId  = student.class_config_id ?? student.current_class?.id ?? null;
  const [activeCategories, setActiveCategories] = useState<any[] | null>(null);

  useEffect(() => {
    if (isPreview) return;
    if (!resolvedPeriodId) return;

    let cancelled = false;
    import('@/lib/api').then(({ textCategoriesAPI }) => {
       const params: any = { academic_period: resolvedPeriodId };
       if (resolvedClassId) params.student_class = resolvedClassId;
       textCategoriesAPI.list(params).then(res => {
         if (cancelled) return;
         const data = (res as any)?.results || res || [];
         setActiveCategories(Array.isArray(data) ? data : []);
       }).catch(err => console.error("Failed to load text categories", err));
    }).catch(err => console.error(err));

    return () => { cancelled = true; };
  }, [isPreview, resolvedPeriodId, resolvedClassId]);

  // Defensive de-dupe by category name — a safety net on top of the backend's
  // class filter, in case two categories ever share a name (see e.g. the
  // "Expressive Arts And Design/story Telling" vs ".../ Storytelling" case).
  const topicsForDisplay = useMemo(() => {
    if (!activeCategories) return [];
    const seen = new Set<string>();
    return activeCategories.filter((c: any) => {
      const key = (c.name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeCategories]);

  const groupedCategories = useMemo(() => {
    if (activeCategories === null) return [];
    return activeCategories.map((cat: any) => {
      const activeFields = cat.fields_list || [];
      const fieldsForCat: any[] = [];
      activeFields.forEach((f: any) => {
        const saved = resultData[String(f.id)];
        if (saved && saved.field_name) {
          fieldsForCat.push({ ...saved, field_name: f.name || saved.field_name });
        }
      });
      return { ...cat, fields: fieldsForCat };
    }).filter(group => group.fields.length > 0);
  }, [resultData, activeCategories]);

  // ============================================================================
  // SHARED DATA
  // ============================================================================
  const totalScore     = result.total_score     ?? (isPreview ? dummyScoreResult.summary.total_score : 0);
  const studentAverage = result.average_score   ?? result.student_average ?? (isPreview ? dummyScoreResult.summary.student_average : 0);

  const attendance = {
    present: comments.present_attendance ?? student.attendance?.present ?? '',
    total:   comments.total_attendance   ?? student.attendance?.total   ?? ''
  };

  const sessionName = result.session_name ?? (isPreview ? dummyPeriod.session : '');
  const periodName  = result.period_name  ?? (isPreview ? dummyPeriod.term : '');
  const studentName = student.last_name ? `${student.last_name} ${student.first_name || ''} ${student.middle_name || ''}`.trim() : student.full_name;
  const className   = `${student.current_class?.name ?? ''} ${student.class_section ?? ''}`.trim() || '—';

  const vendorName  = school.vendor_name    || 'Balabalutech Limited';
  const vendorSite  = school.vendor_website || 'https://balabalutech.com';
  const vendorPhone = school.vendor_phone   || '08163550192';

  // ── Styles ──
  const baseFont    = "'Segoe UI', Arial, Helvetica, sans-serif";
  const numericFont = "'Courier New', Courier, monospace";

  const cellStyle: React.CSSProperties = {
    border: '1px solid black',
    paddingLeft: '5px',
    textAlign: 'center',
    fontFamily: numericFont,
    fontSize: '12px',
    fontWeight: 'bolder'
  };

  // Lighter, non-tabular style for the compact student-info strip — no longer
  // borrows the heavy bordered/courier score-table styling.
  const infoCellStyle: React.CSSProperties = {
    border: `1px solid ${hexToRgba(headerColor, 0.25)}`,
    padding: '6px 10px',
    fontFamily: baseFont,
    fontSize: '13px',
    textAlign: 'left',
    verticalAlign: 'middle',
  };
  const infoLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '9px',
    letterSpacing: '0.5px',
    color: 'rgba(0,0,0,0.55)',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: '1px',
  };

  // Keeps a block from being sliced in half across a page break on print.
  const avoidBreak: React.CSSProperties = { breakInside: 'avoid', pageBreakInside: 'avoid' };

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', padding: '14px', boxSizing: 'border-box', fontFamily: baseFont,
    }}>
      {/* Print rules baked into the page itself so output no longer depends on
          each staff member's own browser print-dialog margin settings. */}
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div style={{ backgroundColor: 'white', border: '2px solid black', fontFamily: baseFont }}>

        {/* ══ HEADER ══ */}
        {/* minHeight (not a fixed height) — a long address/motto can now grow
            the box instead of overflowing into the subtitle bar below it. */}
        <div className="avoid-break" style={{ ...avoidBreak, backgroundColor: headerColor, color: 'white', border: '1px solid black', borderBottom: '1px solid black', minHeight: '135px', display: 'flex', alignItems: 'stretch' }}>
          <div style={{ width: '16.66%' }}>
            <img src={ensureAbsoluteUrl(student.image) || '/default_image.jpg'} alt="Student" style={{ width: '100%', height: '100%', minHeight: '133px', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ width: '66.66%', padding: '15px', color: 'white', textAlign: 'center' }}>
            <h4 style={{ fontFamily: 'Georgia, serif', fontWeight: 'bold', margin: 0, fontSize: '20px' }}>{school.name?.toUpperCase()}</h4>
            <h6 style={{ fontSize: '13px', marginTop: '10px', fontWeight: 'bold', margin: '10px 0 5px 0' }}>...{toTitleCase(school.motto)}</h6>
            <h6 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'normal' }}>{toTitleCase(school.address)}</h6>
            <p style={{ margin: 0, fontSize: '13px' }}>{school.mobile_1} | {school.email?.toLowerCase()} | {school.website}</p>
          </div>
          <div style={{ width: '16.66%' }}>
            <img src={ensureAbsoluteUrl(school.logo)} alt="Logo" style={{ width: '100%', height: '100%', minHeight: '133px', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>

        {/* ══ SUBTITLE ══ */}
        <div style={{ backgroundColor: headerColor, color: 'white', minHeight: '22px', borderBottom: '2px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px 0' }}>
          <p style={{ fontWeight: 'bold', margin: 0, fontSize: '14px' }}>
            Student Report Card For {termType === 'midterm' ? 'Mid ' : ''}{toTitleCase(periodName)} {toTitleCase(sessionName)} Session
          </p>
        </div>

        {/* ══ STUDENT INFO — compact 3x3 grid. Date of Birth removed; Resumption
            Date kept (still renders "—" when unset). ══ */}
        <div className="avoid-break" style={{ ...avoidBreak, backgroundColor: secondaryColor, borderBottom: '2px solid black', padding: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ ...infoCellStyle, width: '40%' }}>
                  <span style={infoLabelStyle}>Pupil's Name</span>{toTitleCase(studentName)}
                </td>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>Adm No.</span>{student.registration_number?.toUpperCase()}
                </td>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>Class</span>{className.toUpperCase()}
                </td>
              </tr>
              <tr>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>No. Of Times School Opened</span>{attendance.total || '—'}
                </td>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>No. Of Times Present</span>{attendance.present || '—'}
                </td>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>Sex</span>{toTitleCase(student.gender)}
                </td>
              </tr>
              <tr>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>Cum. Total</span>{roundOrDash(totalScore)}
                </td>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>Cum. Average</span>{roundOrDash(studentAverage)}
                </td>
                <td style={infoCellStyle}>
                  <span style={infoLabelStyle}>Resumption Date</span>{result.resumption_date || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══ TOPICS COVERED ══ */}
        {/* activeCategories is now fetched scoped to the student's class
            (resolvedClassId → student_class param); topicsForDisplay adds a
            name-based de-dupe on top as a display-layer safety net. */}
        {topicsForDisplay.length > 0 && (
          <div style={{ color: 'black', borderBottom: '1px solid black', padding: '15px' }}>
            <div style={{ padding: '1px' }}>
              <p style={{ color: primaryColor, textAlign: 'center', fontWeight: 'bold', margin: '0 0 10px 0', fontSize: '16px' }}>
                TOPICS COVERED THIS TERM IN THE AREAS OF LEARNING
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -5px' }}>
                {topicsForDisplay.map((category: any, idx: number) => (
                  <div key={idx} className="avoid-break" style={{ ...avoidBreak, width: '50%', padding: '0 5px', boxSizing: 'border-box', marginBottom: '10px' }}>
                    <div style={{ border: '1px solid black', height: '100%', padding: '10px' }}>
                      <h4 style={{ color: primaryColor, fontSize: '15px', textAlign: 'center', fontWeight: 'bold', margin: '0 0 5px 0' }}>
                        {category.name?.toUpperCase()}
                      </h4>
                      <p style={{ fontSize: '13px', color: 'black', margin: 0 }}>
                        {category.description || ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ TEXT TABLE ══ */}
        {groupedCategories.length > 0 && (
          <div style={{ padding: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: secondaryColor }}>
                <tr>
                  <th rowSpan={2} style={{ ...cellStyle, fontFamily: baseFont, width: '150px' }}>AREAS OF LEARNING</th>
                  <th rowSpan={2} style={{ ...cellStyle, fontFamily: baseFont, width: '200px' }}>ASPECT</th>
                  <th colSpan={3} style={{ ...cellStyle, fontFamily: baseFont }}>PUPIL'S ACHIEVEMENT</th>
                </tr>
                <tr>
                  <th style={{ ...cellStyle, fontFamily: baseFont }}>Comment</th>
                  <th style={{ ...cellStyle, fontFamily: baseFont, width: '150px' }}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {groupedCategories.map((cat: any, catIndex: number) => (
                  <tr key={catIndex} className="avoid-break" style={{ ...avoidBreak, border: '1px solid black' }}>
                    <th style={{ ...cellStyle, fontFamily: baseFont, backgroundColor: headerColor, color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>
                      {toTitleCase(cat.name)}
                    </th>
                    <th colSpan={3} style={{ padding: '0px', border: 'none' }}>
                      <table style={{ height: '100%', width: '100%', margin: '0px', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <tbody>
                          {cat.fields.map((field: any, fieldIndex: number) => (
                            <tr key={fieldIndex}>
                              <td style={{ ...cellStyle, fontFamily: baseFont, width: '200px', textAlign: 'left', borderTop: fieldIndex === 0 ? 'none' : '1px solid black', borderBottom: 'none', borderLeft: 'none' }}>
                                {toTitleCase(field.field_name)}
                              </td>
                              <td style={{ ...cellStyle, fontFamily: baseFont, textAlign: 'left', borderTop: fieldIndex === 0 ? 'none' : '1px solid black', borderBottom: 'none' }}>
                                {field.comment ? field.comment : <span style={{ color: 'transparent' }}>.</span>}
                              </td>
                              <td style={{ ...cellStyle, fontFamily: baseFont, width: '150px', textAlign: 'left', borderTop: fieldIndex === 0 ? 'none' : '1px solid black', borderBottom: 'none', borderRight: 'none' }}>
                                {field.rating ? field.rating.toUpperCase() : <span style={{ color: 'transparent' }}>.</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </th>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ TEXT KEY — now a compact, content-width block instead of a
            full-width table (item 4: it no longer stretches to fill the page) ══ */}
        {groupedCategories.length > 0 && backendRatingOptions.length > 0 && (
          <div style={{ padding: '8px', display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ maxWidth: '340px', width: '100%' }}>
              <h3 style={{ color: primaryColor, fontSize: '14px', margin: '0 0 6px 0', fontWeight: 'bold' }}>KEY</h3>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <tbody>
                  {backendRatingOptions.map((opt: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ ...cellStyle, fontFamily: baseFont, width: '120px', backgroundColor: headerColor, color: '#fff', fontWeight: 'bold', fontSize: '11px' }}>
                        {opt.label?.toUpperCase()}
                      </td>
                      <td style={{ ...cellStyle, fontFamily: baseFont, textAlign: 'left', fontSize: '11px', fontWeight: 'normal' }}>
                        {opt.description || opt.remark || opt.label}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ SCORE TABLE ══ */}
        {subjectRows.length > 0 && (
          <div style={{ padding: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ height: '20px', backgroundColor: headerColor, color: 'white' }}>
                  <th rowSpan={2} style={{ ...cellStyle, fontFamily: baseFont, verticalAlign: 'middle', textAlign: 'left', paddingLeft: '10px', fontSize: '16px', minWidth: '200px', width: '150px' }}>Subjects</th>
                  {scoreCols.map((col: any) => (
                    <th key={col.id} style={{ ...cellStyle, fontFamily: baseFont }}>{toTitleCase(col.name)}</th>
                  ))}
                  <th style={{ ...cellStyle, fontFamily: baseFont, width: '60px' }}>Total Score</th>
                  <th style={{ ...cellStyle, fontFamily: baseFont, width: '60px' }}>Highest Score</th>
                  <th style={{ ...cellStyle, fontFamily: baseFont, width: '60px' }}>Lowest Score</th>
                  <th style={{ ...cellStyle, fontFamily: baseFont, width: '60px' }}>Average Score</th>
                  <th rowSpan={2} style={{ ...cellStyle, fontFamily: baseFont, width: '60px', verticalAlign: 'middle' }}>Grade</th>
                  <th rowSpan={2} style={{ ...cellStyle, fontFamily: baseFont, width: '100px', verticalAlign: 'middle' }}>Remark</th>
                </tr>
                <tr style={{ backgroundColor: headerColor, color: 'white' }}>
                  {scoreCols.map((col: any) => (
                    <th key={col.id} style={{ ...cellStyle, textAlign: 'center' }}>{Math.round(col.max_mark)}</th>
                  ))}
                  <th style={cellStyle}>100</th>
                  <th style={cellStyle}>100</th>
                  <th style={cellStyle}>100</th>
                  <th style={cellStyle}>100</th>
                </tr>
              </thead>
              <tbody>
                {subjectRows.map((sub: any, idx: number) => (
                  <tr key={idx} className="avoid-break" style={avoidBreak}>
                    <td style={{ ...cellStyle, textAlign: 'left' }}><b>{sub.name}</b></td>
                    {scoreCols.map((col: any) => (
                      <td key={col.id} style={{ ...cellStyle, maxWidth: '150px' }}>{getScore(col.name, sub.scores)}</td>
                    ))}
                    <td style={cellStyle}>{sub.scores?.total !== undefined ? Math.round(sub.scores.total) : ''}</td>
                    <td style={cellStyle}>{sub.scores?.highest_in_class !== undefined ? Math.round(sub.scores.highest_in_class) : ''}</td>
                    <td style={cellStyle}>{sub.scores?.lowest_in_class !== undefined ? Math.round(sub.scores.lowest_in_class) : ''}</td>
                    <td style={cellStyle}>{sub.scores?.average_score !== undefined ? Math.round(sub.scores.average_score) : (sub.scores?.class_average !== undefined ? Math.round(sub.scores.class_average) : '')}</td>
                    <td style={cellStyle}>{sub.scores?.total > 0 ? (sub.scores?.grade?.toUpperCase() || '') : ''}</td>
                    <td style={{ ...cellStyle, width: 'fit-content' }}>{sub.scores?.total > 0 ? (toTitleCase(sub.scores?.remark) || '') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ BEHAVIOUR ══ */}
        {bCats.length > 0 && (
          <div style={{ padding: '4px' }}>
            <div style={{ backgroundColor: headerColor, color: 'white', minHeight: '20px', border: '1px solid black' }}>
              <p style={{ textAlign: 'center', fontSize: '14px', fontFamily: baseFont, fontWeight: 'bold', margin: 0, padding: '2px 0' }}>
                Affective and Psychomotor Observation (Behavioural & Physical Abilities)
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {bCats.map((cat: any, idx: number) => (
                <div key={idx} className="avoid-break" style={{ ...avoidBreak, width: bCats.length === 1 ? '100%' : (bCats.length === 2 ? '50%' : '33.333%') }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: headerColor, color: 'white', height: '20px' }}>
                        <th style={{ ...cellStyle, fontFamily: baseFont, textAlign: 'left', paddingLeft: '5px' }}>{cat.name?.toUpperCase()}</th>
                        <th style={{ ...cellStyle, fontFamily: baseFont }}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cat.fields_list ?? cat.items ?? cat.student_behaviour ?? []).map((item: any, iIdx: number) => {
                        const itemName = item.name ?? item;
                        const score = item.score ?? bRatings[itemName] ?? bRatings[itemName?.toLowerCase?.()] ?? '';
                        return (
                          <tr key={iIdx}>
                            <td style={{ ...cellStyle, fontFamily: baseFont, textAlign: 'left', fontWeight: 'bold', fontSize: '12px', padding: '0px 5px' }}>{toTitleCase(itemName)}</td>
                            <td style={cellStyle}>{score}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ RATING / GRADING LEGEND — redesigned as chips instead of a
            single dull line of grey text ══ */}
        {(bCats.length > 0 || subjectRows.length > 0) && (
          <div className="avoid-break" style={{ ...avoidBreak, border: '1px solid black', margin: '4px', padding: '8px 10px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>

              {bCats.length > 0 && (
                <div style={{ flex: '1 1 220px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '11px', margin: '0 0 6px 0', color: primaryColor, textTransform: 'uppercase' }}>Behaviour Rating</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {[
                      { n: 5, label: 'Excellent' },
                      { n: 4, label: 'Good' },
                      { n: 3, label: 'Fair' },
                      { n: 1, label: 'No Trait' },
                    ].map((r) => (
                      <span key={r.n} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        border: `1px solid ${hexToRgba(primaryColor, 0.35)}`,
                        borderRadius: '999px', padding: '2px 8px', fontSize: '10px', fontFamily: baseFont,
                      }}>
                        <span style={{
                          width: '14px', height: '14px', borderRadius: '50%',
                          backgroundColor: hexToRgba(primaryColor, 0.15 + r.n * 0.12),
                          color: primaryColor, fontWeight: 'bold', fontSize: '9px',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>{r.n}</span>
                        {r.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {subjectRows.length > 0 && (
                <div style={{ flex: '1 1 320px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '11px', margin: '0 0 6px 0', color: primaryColor, textTransform: 'uppercase' }}>Grading Scale</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(termType === 'midterm' ? midGrades : grades).map((g: any, idx: number) => (
                      <span key={idx} style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        border: `1px solid ${hexToRgba(primaryColor, 0.35)}`,
                        borderRadius: '4px', padding: '2px 8px', fontSize: '10px', fontFamily: baseFont,
                      }}>
                        <b style={{ color: primaryColor }}>
                          {Math.round(g.min_score || g.end_of_term_min_mark || g.midterm_min_mark || 0)}–{Math.round(g.max_score || g.end_of_term_max_mark || g.midterm_max_mark || 0)}
                        </b>
                        {toTitleCase(g.remark || g.end_of_term_remark || g.midterm_remark)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ══ REMARKS & COMMENTS ══ */}
        <div className="avoid-break" style={{ ...avoidBreak, color: 'black', borderBottom: '2px solid black', padding: '1px', fontFamily: baseFont }}>
          <div style={{ border: '1px solid black', borderRadius: '3px', paddingLeft: '5px', paddingBottom: '0px' }}>

            {settings.custom_comment_fields?.map((customField: string, idx: number) => (
              <p key={idx} style={{ minHeight: '16px', padding: '0px', margin: '0px', fontSize: '12px', borderBottom: '1px solid black' }}>
                <b>{customField}: {comments.custom_comments?.[customField] || comments[customField] || ''}</b>
              </p>
            ))}

            <p style={{ height: '16px', padding: '0px', margin: '0px', fontSize: '12px', borderBottom: '1px solid black' }}>
              <b>Teacher's Name: {toTitleCase(comments.form_teacher)}</b>
            </p>
            <p style={{ backgroundColor: headerColor, color: 'white', minHeight: '16px', padding: '0px 0px 0px 3px', margin: '0px', fontSize: '12px', borderBottom: '1px solid black' }}>
              <b>Teacher's Comment:</b> {comments.form_teacher_comment}
            </p>

            <p style={{ height: '16px', padding: '0px', margin: '0px', fontSize: '12px', borderBottom: '1px solid black' }}>
              <b>{comments.head_teacher_title || 'Head of Foundation Classes'}: {toTitleCase(comments.head_teacher)}</b>
            </p>
            <p style={{ backgroundColor: headerColor, color: 'white', minHeight: '16px', padding: '0px 0px 0px 3px', margin: '0px', fontSize: '12px', borderBottom: 'none' }}>
              <b>Comment:</b> {comments.head_teacher_comment}
            </p>

          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div style={{ margin: '5px 0 10px 0' }}>
          <p style={{ margin: '0px', padding: '0px', height: '15px', fontSize: '10px', textAlign: 'center' }}>
            Managed by {vendorName} <a href={`tel:${vendorPhone}`}>{vendorPhone}</a> <a href={vendorSite} target="_blank" rel="noopener noreferrer">{vendorSite}</a>
          </p>
        </div>

      </div>
    </div>
  );
}