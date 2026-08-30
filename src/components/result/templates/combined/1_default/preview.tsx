'use client';

/**
 * Combined Template 1 — Legacy HTML Match (Clean & Dynamic)
 * File: src/components/result/templates/combined/1_default/preview.tsx
 *
 * Structural arrangement matched to the original HTML.
 * Colors, rating keys, and vendor tags are strictly dynamic.
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

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '—';
  return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
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
  // TEXT LOGIC (Filter for `field_name` + Fetch Categories)
  // ============================================================================
  const resolvedPeriodId = periodId ?? result?.academic_period ?? result?.academic_session_period ?? result?.period?.id ?? null;
  const [activeCategories, setActiveCategories] = useState<any[] | null>(null);

  useEffect(() => {
    if (isPreview) return;
    if (!resolvedPeriodId) return;

    let cancelled = false;
    import('@/lib/api').then(({ textCategoriesAPI }) => {
       const params: any = { academic_period: resolvedPeriodId };
       textCategoriesAPI.list(params).then(res => {
         if (cancelled) return;
         const data = (res as any)?.results || res || [];
         setActiveCategories(Array.isArray(data) ? data : []);
       }).catch(err => console.error("Failed to load text categories", err));
    }).catch(err => console.error(err));

    return () => { cancelled = true; };
  }, [isPreview, resolvedPeriodId]);

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

  // ── Exact Styles ──
  const cellStyle: React.CSSProperties = {
    border: '1px solid black',
    paddingLeft: '5px',
    textAlign: 'center',
    fontFamily: 'courier, monospace',
    fontSize: '12px',
    fontWeight: 'bolder'
  };

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', padding: '20px', boxSizing: 'border-box',
    }}>
      <div style={{ backgroundColor: 'white', border: '2px solid black', fontFamily: 'lato, courier, cursive' }}>

        {/* ══ HEADER ══ */}
        <div style={{ backgroundColor: headerColor, color: 'white', fontFamily: 'cursive', border: '1px solid black', borderBottom: '1px solid black', height: '135px', display: 'flex' }}>
          <div style={{ width: '16.66%' }}>
            <img src={ensureAbsoluteUrl(student.image) || '/default_image.jpg'} alt="Student" style={{ width: '100%', height: '133px', borderRadius: '0px', objectFit: 'cover' }} />
          </div>
          <div style={{ width: '66.66%', padding: '15px', color: 'white', textAlign: 'center' }}>
            <h4 style={{ fontFamily: 'serif', fontWeight: 'bold', margin: 0, fontSize: '20px' }}>{school.name?.toUpperCase()}</h4>
            <h6 style={{ fontSize: '14px', marginTop: '10px', fontWeight: 'bold', margin: '10px 0 5px 0' }}>...{toTitleCase(school.motto)}</h6>
            <h6 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>{toTitleCase(school.address)}</h6>
            <p style={{ margin: 0, fontSize: '15px' }}>{school.mobile_1} | {school.email?.toLowerCase()} | {school.website}</p>
          </div>
          <div style={{ width: '16.66%' }}>
            <img src={ensureAbsoluteUrl(school.logo)} alt="Logo" style={{ width: '100%', height: '133px', borderRadius: '0px', objectFit: 'cover' }} />
          </div>
        </div>

        {/* ══ SUBTITLE ══ */}
        <div style={{ backgroundColor: headerColor, color: 'white', height: '22px', borderBottom: '2px solid black', borderTop: '0px solid black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontWeight: 'bold', margin: 0, fontSize: '14px' }}>
            Student Report Card For {termType === 'midterm' ? 'Mid ' : ''}{toTitleCase(periodName)} {toTitleCase(sessionName)} Session
          </p>
        </div>

        {/* ══ STUDENT INFO ══ */}
        <div style={{ color: 'black', borderBottom: '2px solid black', borderTop: '0px solid black', padding: '1px' }}>
          <table style={{ width: '100%', color: 'black', fontSize: '15px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <th style={{ ...cellStyle, textAlign: 'left' }}>PUPIL’S NAME: {toTitleCase(studentName)}</th>
                <th style={{ ...cellStyle, textAlign: 'left' }}>ADM NO.: {student.registration_number?.toUpperCase()}</th>
                <th style={{ ...cellStyle, textAlign: 'left' }}>NO. OF TIMES<br />SCHOOL OPENED: {attendance.total}</th>
                <th style={{ ...cellStyle, textAlign: 'left' }}>CUM. TOTAL: {totalScore}</th>
              </tr>
              <tr>
                <th style={{ ...cellStyle, textAlign: 'left' }}>DATE OF BIRTH: {student.date_of_birth || ''}</th>
                <th style={{ ...cellStyle, textAlign: 'left' }}>CLASS: {className.toUpperCase()}</th>
                <th style={{ ...cellStyle, textAlign: 'left' }}>NO. OF TIMES PRESENT: {attendance.present}</th>
                <th style={{ ...cellStyle, textAlign: 'left' }}>CUM. AVERAGE: {studentAverage}</th>
              </tr>
              <tr>
                <th style={{ ...cellStyle, textAlign: 'left' }}>SEX: {toTitleCase(student.gender)}</th>
                <th colSpan={3} style={{ ...cellStyle, textAlign: 'left' }}>RESUMPTION DATE: {result.resumption_date || ''}</th>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ══ TOPICS COVERED ══ */}
        {activeCategories && activeCategories.length > 0 && (
          <div style={{ color: 'black', borderBottom: '1px solid black', borderTop: '0px solid black', padding: '15px' }}>
            <div style={{ padding: '1px' }}>
              <p style={{ color: primaryColor, textAlign: 'center', fontWeight: 'bold', margin: '0 0 10px 0', fontSize: '16px' }}>
                TOPICS COVERED THIS TERM IN THE AREAS OF LEARNING
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0 -5px' }}>
                {activeCategories.map((category: any, idx: number) => (
                  <div key={idx} style={{ width: '50%', padding: '0 5px', boxSizing: 'border-box', marginBottom: '10px' }}>
                    <div style={{ border: '1px solid black', height: '100%', padding: '10px' }}>
                      <h4 style={{ color: primaryColor, fontSize: '16px', textAlign: 'center', fontWeight: 'bold', margin: '0 0 5px 0' }}>
                        {category.name?.toUpperCase()}
                      </h4>
                      <p style={{ fontSize: '14px', color: 'black', fontFamily: 'sans-serif', margin: 0 }}>
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
                  <th rowSpan={2} style={{ ...cellStyle, width: '150px' }}>AREAS OF LEARNING</th>
                  <th rowSpan={2} style={{ ...cellStyle, width: '200px' }}>ASPECT</th>
                  <th colSpan={3} style={cellStyle}>PUPIL'S ACHIEVEMENT</th>
                </tr>
                <tr>
                  <th style={cellStyle}>Comment</th>
                  <th style={{ ...cellStyle, width: '150px' }}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {groupedCategories.map((cat: any, catIndex: number) => (
                  <tr key={catIndex} style={{ border: '1px solid black' }}>
                    <th style={{ ...cellStyle, backgroundColor: headerColor, color: '#fff', fontWeight: 'bold', fontSize: '20px' }}>
                      {toTitleCase(cat.name)}
                    </th>
                    <th colSpan={3} style={{ padding: '0px', border: 'none' }}>
                      <table style={{ height: '100%', width: '100%', margin: '0px', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <tbody>
                          {cat.fields.map((field: any, fieldIndex: number) => (
                            <tr key={fieldIndex}>
                              <td style={{ ...cellStyle, width: '200px', textAlign: 'left', borderTop: fieldIndex === 0 ? 'none' : '1px solid black', borderBottom: 'none', borderLeft: 'none' }}>
                                {toTitleCase(field.field_name)}
                              </td>
                              <td style={{ ...cellStyle, textAlign: 'left', borderTop: fieldIndex === 0 ? 'none' : '1px solid black', borderBottom: 'none' }}>
                                {field.comment ? field.comment : <span style={{ color: 'transparent' }}>.</span>}
                              </td>
                              <td style={{ ...cellStyle, width: '150px', textAlign: 'left', borderTop: fieldIndex === 0 ? 'none' : '1px solid black', borderBottom: 'none', borderRight: 'none' }}>
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

        {/* ══ TEXT KEY ══ */}
        {groupedCategories.length > 0 && backendRatingOptions.length > 0 && (
          <div style={{ padding: '8px' }}>
            <h3 style={{ color: primaryColor, fontSize: '18px', margin: '0 0 10px 0', fontWeight: 'bold' }}>KEY</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {backendRatingOptions.map((opt: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ ...cellStyle, width: '150px', backgroundColor: headerColor, color: '#fff', fontWeight: 'bold' }}>
                      {opt.label?.toUpperCase()}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'left' }}>
                      {opt.description || opt.remark || opt.label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ SCORE TABLE ══ */}
        {subjectRows.length > 0 && (
          <div style={{ padding: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ height: '20px', backgroundColor: headerColor, color: 'white' }}>
                  <th rowSpan={2} style={{ ...cellStyle, verticalAlign: 'middle', textAlign: 'left', paddingLeft: '10px', fontSize: '16px', minWidth: '200px', width: '150px' }}>Subjects</th>
                  {scoreCols.map((col: any) => (
                    <th key={col.id} style={cellStyle}>{toTitleCase(col.name)}</th>
                  ))}
                  <th style={{ ...cellStyle, width: '60px' }}>Total Score</th>
                  <th style={{ ...cellStyle, width: '60px' }}>Highest Score</th>
                  <th style={{ ...cellStyle, width: '60px' }}>Lowest Score</th>
                  <th style={{ ...cellStyle, width: '60px' }}>Average Score</th>
                  <th rowSpan={2} style={{ ...cellStyle, width: '60px', verticalAlign: 'middle' }}>Grade</th>
                  <th rowSpan={2} style={{ ...cellStyle, width: '100px', verticalAlign: 'middle' }}>Remark</th>
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
                  <tr key={idx}>
                    <td style={{ ...cellStyle, textAlign: 'left', fontFamily: 'courier' }}><b>{sub.name}</b></td>
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
            <div style={{ backgroundColor: headerColor, color: 'white', height: '20px', border: '1px solid black' }}>
              <p style={{ textAlign: 'center', fontSize: '14px', fontFamily: 'Arial', fontWeight: 'bold', margin: 0 }}>
                Affective and Psychomotor Observation (Behavioural & Physical Abilities)
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {bCats.map((cat: any, idx: number) => (
                <div key={idx} style={{ width: bCats.length === 1 ? '100%' : (bCats.length === 2 ? '50%' : '33.333%') }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: headerColor, color: 'white', height: '20px' }}>
                        <th style={{ ...cellStyle, textAlign: 'left', paddingLeft: '5px' }}>{cat.name?.toUpperCase()}</th>
                        <th style={cellStyle}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cat.fields_list ?? cat.items ?? cat.student_behaviour ?? []).map((item: any, iIdx: number) => {
                        const itemName = item.name ?? item;
                        const score = item.score ?? bRatings[itemName] ?? bRatings[itemName?.toLowerCase?.()] ?? '';
                        return (
                          <tr key={iIdx}>
                            <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 'bold', fontSize: '12px', padding: '0px 5px' }}>{toTitleCase(itemName)}</td>
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

        {/* ══ GRADING KEY ══ */}
        {(bCats.length > 0 || subjectRows.length > 0) && (
          <div style={{ color: 'grey', border: '1px solid black', padding: '0px', minHeight: '45px', margin: '4px' }}>
            {bCats.length > 0 && (
              <>
                <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', margin: '5px 0' }}>
                  Rating: 5 - Excellent Trait, 4 Good Trait, 3 Fair Trait, 1 - No Trait
                </p>
                <hr style={{ marginTop: '-5px', marginBottom: '0px', borderTop: '1px solid grey' }} />
              </>
            )}
            {subjectRows.length > 0 && (
              <p style={{ textAlign: 'center', padding: '0px', margin: '5px 0', fontSize: '12px', fontFamily: 'Arial' }}>
                Grading: {(termType === 'midterm' ? midGrades : grades).map((g: any, idx: number) => (
                  <span key={idx}>
                    {Math.round(g.min_score || g.end_of_term_min_mark || g.midterm_min_mark || 0)} - {Math.round(g.max_score || g.end_of_term_max_mark || g.midterm_max_mark || 0)} = {toTitleCase(g.remark || g.end_of_term_remark || g.midterm_remark)}
                    {idx < (termType === 'midterm' ? midGrades : grades).length - 1 ? ' | ' : ''}
                  </span>
                ))}
              </p>
            )}
          </div>
        )}

        {/* ══ REMARKS & COMMENTS ══ */}
        <div style={{ color: 'black', borderBottom: '2px solid black', borderTop: '0px solid black', padding: '1px', fontFamily: 'lato, courier, cursive' }}>
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