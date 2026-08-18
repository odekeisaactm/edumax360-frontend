'use client';

/**
 * Text Template 1 — Classic Standard
 * File: src/components/result/templates/text/1_default/preview.tsx
 *
 * CHANGE LOG:
 * 1. Converted from Tailwind to strict inline CSS to match Score Template 1 perfectly.
 * 2. Letterhead: Photo/Logo span the full height of the header + title band.
 * 3. Info Box: Space-efficient 2-row grid.
 * 4. Text Categories: Dynamically groups fields and renders them in a clean, alternating-color table.
 * 5. Remarks & Comments: Implements the signature-free, two-tone flat list design.
 * 6. Bulletproof mapping applied to Behavior Ratings to prevent JS crashes.
 */

import React, { useMemo } from 'react';
import {
  dummySchool, dummyStudent, dummyBehavior,
  dummyBehaviorRatings, dummyComments, dummySettings, dummyPeriod,
} from '@/lib/result-template-dummy-data';

import { getApiUrl } from '@/lib/getApiUrl';

const API_BASE_URL = typeof window !== 'undefined' ? getApiUrl() : (process.env.NEXT_PUBLIC_API_URL || '');

interface TextTemplateProps {
  student?:            any;
  result?:             any;
  settings?:           any;
  comments?:           any;
  termType?:           'midterm' | 'end_of_term';
  behaviorCategories?: any[];
  behavior_categories?: any[];
  behaviorRatings?:    Record<string, number>;
  behavior_ratings?:   Record<string, number>;
  schoolInfo?:         any;
  school_info?:        any;
  ratingOptions?:      any[];
  rating_options?:     any[];
}

function hex(v: string, fallback: string): string {
  return v && v.startsWith('#') ? v : fallback;
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '—';
  return str.toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function toSentenceCase(str: string | null | undefined): string {
  if (!str) return '';
  const s = str.trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function ensureAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
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

export default function DefaultTextTemplate({
  student: studentProp,
  result: resultProp,
  settings: settingsProp,
  comments: commentsProp,
  termType = 'end_of_term',
  ratingOptions,
  rating_options,
  behaviorCategories,
  behavior_categories,
  behaviorRatings,
  behavior_ratings,
  schoolInfo,
  school_info,
  ...props
}: TextTemplateProps) {

  // ── Resolve with fallbacks ──────────────────────────────────────────────────
  const isPreview = !studentProp && !resultProp;
  const school   = schoolInfo || school_info || props.schoolInfo || props.school_info || dummySchool;
  const student  = studentProp ?? dummyStudent;
  const result   = resultProp ?? { result_data: {}, session_name: dummyPeriod.session, period_name: dummyPeriod.term };
  const settings = settingsProp ?? dummySettings;
  const bCats    = behaviorCategories || behavior_categories || props.behaviorCategories || props.behavior_categories || (isPreview ? dummyBehavior.categories : []);
  const bRatings = behaviorRatings || behavior_ratings || props.behaviorRatings || props.behavior_ratings || (isPreview ? dummyBehaviorRatings : {});
  const comments = commentsProp ?? dummyComments;

  // ── Extact Text Rating Options ──
  let rawOptions =
    ratingOptions || rating_options || props.ratingOptions || props.rating_options ||
    result.rating_options || settings.text_rating_options || settings.rating_options || [];

  if (typeof rawOptions === 'string') {
    try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = []; }
  }
  const backendRatingOptions = Array.isArray(rawOptions) ? rawOptions : [];

  // ── Colors from settings ────────────────────────────────────────────────────
  const headerColor    = hex(settings.header_color,    '#2c5f8d');
  const primaryColor   = hex(settings.primary_color,   '#2c5f8d');
  const secondaryColor = hex(settings.secondary_color, '#f0f4f8');
  const accentColor    = hex(settings.accent_color,    '#1890ff');

  const showComment    = settings.show_text_result_comment !== false;

  const totalOpened    = comments.total_attendance ?? student.attendance?.total ?? '—';
  const totalPresent   = comments.present_attendance ?? student.attendance?.present ?? '—';
  const sessionName    = result.session_name ?? (isPreview ? dummyPeriod.session : '—');
  const periodName     = result.period_name ?? (isPreview ? dummyPeriod.term : '—');
  const termTypeLabel  = termType === 'midterm' ? 'Mid Term' : 'End of Term';

  const vendorName  = school.vendor_name    || 'Balabalutech Limited';
  const vendorSite  = school.vendor_website || 'balabalutech.com';
  const vendorPhone = school.vendor_phone   || '08163550192';

  // ── Group Data by Category ──────────────────────────────────────────────────
  const [activeCategories, setActiveCategories] = React.useState<any[] | null>(null);

  React.useEffect(() => {
    if (isPreview) return;
    import('@/lib/api').then(({ textCategoriesAPI }) => {
       textCategoriesAPI.list().then(data => {
         setActiveCategories(data);
       }).catch(err => console.error("Failed to load text categories", err));
    }).catch(err => console.error(err));
  }, [isPreview]);

  const groupedCategories = useMemo(() => {
    const rawData = result.result_data || {};
    
    // If active categories are not loaded yet, fallback to parsing whatever is in rawData
    if (!activeCategories) {
      const groups = new Map<string, any[]>();
      Object.values(rawData).forEach((item: any) => {
        const catName = item.category_name || 'General';
        if (!groups.has(catName)) {
          groups.set(catName, []);
        }
        groups.get(catName)!.push(item);
      });
      return Array.from(groups.entries()).map(([name, fields]) => ({
        name,
        fields
      }));
    }

    // Filter strictly by the current active configuration
    return activeCategories.map((cat: any) => {
      const activeFields = cat.fields_list || [];
      const fieldsForCat: any[] = [];
      
      activeFields.forEach((f: any) => {
        const saved = rawData[String(f.id)];
        if (saved) {
          fieldsForCat.push({
            ...saved,
            field_name: f.name || saved.field_name
          });
        }
      });

      return {
        name: cat.name,
        fields: fieldsForCat
      };
    }).filter(group => group.fields.length > 0);
  }, [result.result_data, activeCategories]);

  // ── Flat List of Comment Rows ───────────────────────────────────────────────
  const customFields: string[] = settings.enable_custom_comment_fields ? (settings.custom_comment_fields ?? []) : [];

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

  // ── Shared styles ───────────────────────────────────────────────────────────
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
  const thStyle: React.CSSProperties = {
    backgroundColor: headerColor, color: '#fff',
    padding: '5px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700,
    border: `1px solid ${headerColor}`,
  };
  const thLeft: React.CSSProperties = { ...thStyle, textAlign: 'left' };
  const tdBase: React.CSSProperties = { padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: 12, color: '#1e293b' };
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

      {/* ══ STUDENT INFO GRID (2 Rows) ═════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: `1px solid #e2e8f0`, borderRadius: 5, overflow: 'hidden' }}>
        {/* Row 1 */}
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

        {/* Row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', backgroundColor: '#fff' }}>
          {[
            ['Gender', toTitleCase(student.gender)],
            ['Attendance', `${totalPresent} of ${totalOpened} days`],
            ['Resumption Date', result.resumption_date ?? (isPreview ? dummyPeriod.next_term_open : '—')],
          ].map(([label, value], i) => (
            <div key={i} style={{ padding: '6px 10px', borderRight: i < 2 ? '1px solid #e2e8f0' : 'none', fontSize: 11, display: 'flex', alignItems: 'center' }}>
              <span style={{ color: primaryColor, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>{label}:</span>
              <span style={{ fontWeight: 600 }}>{value ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ TEXT RESULT TABLE ══════════════════════════════════════════════════ */}
      <div style={{ margin: '0 10px' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thLeft, width: showComment ? '40%' : '70%' }}>FIELD / SKILL</th>
              {showComment && <th style={{ ...thLeft, width: '40%' }}>COMMENT</th>}
              <th style={{ ...thStyle, width: showComment ? '20%' : '30%' }}>RATING</th>
            </tr>
          </thead>
          <tbody>
            {groupedCategories.length === 0 ? (
              <tr>
                <td colSpan={showComment ? 3 : 2} style={{ ...tdBase, textAlign: 'center', padding: '20px', fontStyle: 'italic', color: '#94a3b8' }}>
                  No academic fields recorded for this student.
                </td>
              </tr>
            ) : (
              groupedCategories.map((category, catIndex) => (
                <React.Fragment key={catIndex}>
                  <tr>
                    <td colSpan={showComment ? 3 : 2} style={{ ...tdLeft, backgroundColor: secondaryColor, color: primaryColor, fontSize: 12, textTransform: 'uppercase', padding: '6px 8px' }}>
                      {category.name}
                    </td>
                  </tr>
                  {category.fields.map((field: any, fieldIndex: number) => (
                    <tr key={`${catIndex}-${fieldIndex}`} style={{ backgroundColor: '#fff' }}>
                      <td style={{ ...tdLeft, fontWeight: 500, paddingLeft: '16px' }}>{toSentenceCase(field.field_name)}</td>
                      {showComment && <td style={{ ...tdBase, textAlign: 'left', fontStyle: 'italic' }}>{field.comment || '—'}</td>}
                      <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, color: primaryColor }}>
                        {field.rating ? String(field.rating).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—'}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══ RATING KEY ═════════════════════════════════════════════════════════ */}
      <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', padding: '6px 10px', gap: 16, fontSize: 11, backgroundColor: secondaryColor, whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 700, color: primaryColor }}>RATING KEY:</span>
          {backendRatingOptions.length > 0 ? (
            backendRatingOptions.map((opt: any, i: number) => (
              <span key={i}>
                <strong style={{ color: accentColor }}>{opt.label?.toUpperCase()}</strong> = {opt.remark || opt.score}
              </span>
            ))
          ) : (
            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No rating scale configured</span>
          )}
        </div>
      </div>

      {/* ══ BEHAVIOUR ════════════════════════════════════════════════════════════ */}
      {bCats.length > 0 && (
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
                      <th style={{ ...thLeft, fontSize: 9, padding: '3px 5px' }}>{cat.name?.toUpperCase()}</th>
                      <th style={{ ...thStyle, width: 36, fontSize: 9, padding: '3px 5px' }}>Score</th>
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

      {/* ══ REMARKS & COMMENTS (Two-Tone, Flat List, No Signatures) ══════════════ */}
      <div style={{ margin: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ ...sectionHeader, padding: '3px 10px' }}>Remarks &amp; Comments</div>
        <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          {commentRows.map((row, i) => (
            <div key={i} style={{ display: 'flex', borderBottom: i < commentRows.length - 1 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none' }}>

              {/* Left Column: Label (Main Background Color) */}
              <div style={{ width: '28%', backgroundColor: headerColor, padding: '6px 12px', borderRight: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
                <strong style={{ color: '#ffffff', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.04em' }}>{row.label}</strong>
              </div>

              {/* Right Column: Value/Comment Text (White Background) */}
              <div style={{ flex: 1, backgroundColor: '#fff', padding: '6px 12px', color: '#334155', fontStyle: row.isComment ? 'italic' : 'normal', fontWeight: row.isComment ? 400 : 600, borderBottom: i < commentRows.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                {row.value ? (row.isComment ? `"${row.value}"` : row.value) : ''}
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* ══ FOOTER — dynamic, white-label per school/vendor ═══════════════════════ */}
      <div style={{
        backgroundColor: '#f8fafc',
        color: '#64748b',
        textAlign: 'center',
        padding: '6px 8px',
        fontSize: 10,
        marginTop: 8,
        borderTop: '1px solid #e2e8f0'
      }}>
        Powered by&nbsp;
        <span style={{ color: '#334155', fontWeight: 700 }}>{vendorName}</span>
        &nbsp;|&nbsp;{vendorSite}&nbsp;|&nbsp;{vendorPhone}
      </div>

    </div>
  );
}