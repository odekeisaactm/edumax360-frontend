'use client';

import React, { useMemo } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
  text_rating_options?: any[];
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

export default function ModernTextTemplate({
  student = {},
  result = {},
  settings = {},
  comments = {},
  termType = 'end_of_term',
  ratingOptions,          // Explicitly destructuring these
  rating_options,         // to ensure React catches them
  behaviorCategories,
  behavior_categories,
  behaviorRatings,
  behavior_ratings,
  schoolInfo,
  school_info,
  ...props
}: TextTemplateProps) {

  // ── SAFELY EXTRACT PROPS REGARDLESS OF CASING ──
  const bCats = behaviorCategories || behavior_categories || props.behaviorCategories || props.behavior_categories || [];
  const bRatings = behaviorRatings || behavior_ratings || props.behaviorRatings || props.behavior_ratings || {};
  const sInfo = schoolInfo || school_info || props.schoolInfo || props.school_info || {};

  // ── EXTRACT TEXT RATING OPTIONS DIRECTLY FROM DATABASE JSON ──
  let rawOptions =
    ratingOptions ||
    rating_options ||
    props.ratingOptions ||
    props.rating_options ||
    result.rating_options ||
    settings.text_rating_options ||
    settings.rating_options ||
    [];

  if (typeof rawOptions === 'string') {
    try { rawOptions = JSON.parse(rawOptions); } catch (e) { rawOptions = []; }
  }
  const backendRatingOptions = Array.isArray(rawOptions) ? rawOptions : [];

  const headerColor    = hex(settings.header_color,    '#2c5f8d');
  const primaryColor   = hex(settings.primary_color,   '#2c5f8d');
  const secondaryColor = hex(settings.secondary_color, '#f0f4f8');
  const accentColor    = hex(settings.accent_color,    '#1890ff');

  const showComment    = settings.show_text_result_comment !== false;

  const totalOpened    = comments.total_attendance ?? student.attendance?.total ?? '—';
  const totalPresent   = comments.present_attendance ?? student.attendance?.present ?? '—';
  const sessionName    = result.session_name ?? '—';
  const periodName     = result.period_name ?? '—';
  const termTypeLabel  = termType === 'midterm' ? 'Mid Term' : 'End of Term';

  const vendorName  = sInfo.vendor_name    || 'Balabalutech Limited';
  const vendorSite  = sInfo.vendor_website || 'balabalutech.com';
  const vendorPhone = sInfo.vendor_phone   || '08163550192';

  // ── GROUP RESULT DATA BY CATEGORY ON THE FLY ──
  const groupedCategories = useMemo(() => {
    const rawData = result.result_data || {};
    const groups = new Map<string, any[]>();

    Object.values(rawData).forEach((item: any) => {
      const catName = item.category_name || 'Uncategorized';
      if (!groups.has(catName)) {
        groups.set(catName, []);
      }
      groups.get(catName)!.push(item);
    });

    return Array.from(groups.entries()).map(([name, fields]) => ({
      name,
      fields
    }));
  }, [result.result_data]);

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
  const thStyle: React.CSSProperties = {
    backgroundColor: headerColor, color: '#fff',
    padding: '5px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700,
    border: `1px solid ${headerColor}`,
  };
  const thLeft: React.CSSProperties = { ...thStyle, textAlign: 'left' };
  const tdBase: React.CSSProperties = { padding: '5px 8px', border: '1px solid #e2e8f0', fontSize: 12, color: '#1e293b' };
  const tdLeft: React.CSSProperties = { ...tdBase, textAlign: 'left', fontWeight: 600 };

  // Calculate dynamic width for behavior section (3-column layout)
  const bCatCount = bCats.length;
  // If 2 categories + 1 legend = 3 slots (33.33% each). If 1 category + 1 legend = 50% each.
  const behaviorBoxWidth = (bCatCount === 2 || bCatCount >= 3) ? '33.33%' : '50%';

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
      fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1e293b',
    }}>

      {/* ══ LETTERHEAD + TITLE BAND ══ */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 110, flexShrink: 0, backgroundColor: headerColor }}>
          <SafeImage
            src={ensureAbsoluteUrl(student.image)}
            alt="Student"
            fallbackText={(student.first_name?.[0] ?? '') + (student.last_name?.[0] ?? '')}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: headerColor, color: '#fff', textAlign: 'center', padding: '12px 12px 8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Georgia, serif', textTransform: 'uppercase' }}>{sInfo.name || 'School Name'}</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.9 }}>...{toTitleCase(sInfo.motto)}</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>{sInfo.address}</div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
              {[sInfo.mobile_1, sInfo.email, sInfo.website].filter(Boolean).join('  |  ')}
            </div>
          </div>
          <div style={{ backgroundColor: headerColor, color: '#fff', padding: '5px 10px', fontSize: 13, fontWeight: 700, textAlign: 'center', letterSpacing: '0.02em', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            Student Report Card For {termTypeLabel === 'Mid Term' ? 'Mid ' : ''}{toTitleCase(periodName)} {sessionName} Session
          </div>
        </div>
        <div style={{ width: 110, flexShrink: 0, backgroundColor: headerColor }}>
          <SafeImage
            src={ensureAbsoluteUrl(sInfo.logo)}
            alt="Logo"
            fallbackText={sInfo.short_name || sInfo.name || 'Logo'}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', padding: 8 }}
          />
        </div>
      </div>

      {/* ══ INFO BOX (Exactly 2 Rows) ══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, margin: '2px 0' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 700, width: '40%' }}>
              {student.last_name ? toTitleCase(`${student.last_name}, ${student.first_name ?? ''} ${student.middle_name ?? ''}`.replace(/\s+/g, ' ').trim()) : toTitleCase(student.full_name ?? '—')}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 700, width: '30%' }}>
              ADM NO.: {student.registration_number?.toUpperCase() ?? '—'}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 700, width: '30%' }}>
              CLASS: {`${student.current_class?.name ?? ''} ${student.class_section ?? ''}`.trim()}
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 700 }}>
              GENDER: {toTitleCase(student.gender)}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 700 }}>
              ATTENDANCE: {totalPresent}/{totalOpened}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '5px 8px', fontWeight: 700 }}>
              RESUMPTION DATE: {result.resumption_date ?? '—'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ══ TEXT RESULT TABLE (Full Width) ══ */}
      <table style={{ ...tableStyle, marginTop: '2px' }}>
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
                {/* Category Header Row (Spans full width) */}
                <tr>
                  <td colSpan={showComment ? 3 : 2} style={{ ...tdLeft, backgroundColor: primaryColor, color: '#fff', fontSize: 13, textTransform: 'uppercase', padding: '6px 8px', border: `1px solid ${primaryColor}` }}>
                    {category.name}
                  </td>
                </tr>
                {/* Field Rows */}
                {category.fields.map((field: any, fieldIndex: number) => (
                  <tr key={`${catIndex}-${fieldIndex}`} style={{ backgroundColor: fieldIndex % 2 === 0 ? '#fff' : secondaryColor }}>
                    <td style={{ ...tdLeft, fontWeight: 500 }}>{toSentenceCase(field.field_name)}</td>
                    {showComment && <td style={{ ...tdBase, textAlign: 'left', fontStyle: 'italic' }}>{field.comment || '—'}</td>}
                    <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, color: primaryColor }}>
                      {field.rating ? String(field.rating).toUpperCase() : '—'}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>

      {/* ══ HORIZONTAL TEXT RATING SCALE (Single Row) ══ */}
      <div style={{ border: '1px solid #cbd5e1', borderTop: 'none' }}>
        <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', padding: '6px 10px', gap: 16, fontSize: 10.5, backgroundColor: secondaryColor, whiteSpace: 'nowrap' }}>
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

      {/* ══ AFFECTIVE / PSYCHOMOTOR DOMAIN (3-Column Layout with Legend) ══ */}
      {bCats.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ backgroundColor: headerColor, color: '#fff', padding: '6px', textAlign: 'center', fontWeight: 700, fontSize: 12, border: `1px solid ${headerColor}` }}>
            Affective and Psychomotor Observation (Behavioural & Physical Abilities)
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', border: '1px solid #cbd5e1', borderTop: 'none' }}>

            {/* Behavior Categories (col-4 each if there are 2) */}
            {bCats.map((cat: any, idx: number) => (
              <div key={idx} style={{ width: behaviorBoxWidth, boxSizing: 'border-box', borderRight: '1px solid #cbd5e1' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: secondaryColor }}>
                      <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: 11, borderBottom: '1px solid #cbd5e1', color: primaryColor }}>{cat.name.toUpperCase()}</th>
                      <th style={{ padding: '5px 8px', textAlign: 'center', fontSize: 11, borderBottom: '1px solid #cbd5e1', width: '50px', color: primaryColor }}>SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cat.fields_list ?? cat.items ?? []).map((item: any, i: number) => {
                      const itemName = item.name ?? item;
                      const score = item.score ?? bRatings[itemName] ?? bRatings[itemName?.toLowerCase?.()] ?? '';
                      return (
                        <tr key={i}>
                          <td style={{ padding: '4px 8px', fontSize: 11, borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>{toSentenceCase(itemName)}</td>
                          <td style={{ padding: '4px 8px', fontSize: 12, borderBottom: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, color: accentColor }}>{score}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Behavior Legend (Last col-4 slot) */}
            <div style={{ width: behaviorBoxWidth, boxSizing: 'border-box' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: secondaryColor }}>
                    <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: 11, borderBottom: '1px solid #cbd5e1', color: primaryColor }}>BEHAVIOR RATING INDEX</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    '5 - Maintain excellent degree of observable traits',
                    '4 - Maintain a high level of observable traits',
                    '3 - Maintain acceptable level of observable traits',
                    '2 - Show mental regard for observable traits',
                    '1 - Has no regard for observable traits',
                  ].map((line, i) => (
                    <tr key={i}>
                      <td style={{ padding: '4px 8px', fontSize: 10, fontWeight: 500, borderBottom: '1px solid #e2e8f0', backgroundColor: i % 2 === 0 ? '#fff' : secondaryColor }}>{line}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ══ NEXT TERM'S TARGET (From Custom Comments if provided) ══ */}
      {settings.custom_comment_fields?.map((fieldName: string, i: number) => {
        const customValue = comments.custom_comments?.[fieldName] ?? comments?.[fieldName];
        if (!customValue) return null;
        return (
          <div key={i} style={{ border: '1px solid #cbd5e1', borderTop: 'none', padding: '6px 8px', fontSize: 12, marginTop: '10px' }}>
            <strong>{toTitleCase(fieldName)}:</strong> {customValue}
          </div>
        );
      })}

      {/* ══ SIGNATURES & REMARKS ══ */}
      <div style={{ border: '1px solid #cbd5e1', marginTop: '10px', borderRadius: '4px', overflow: 'hidden' }}>
        {[
          { label: "Teacher's Name", name: toTitleCase(comments.form_teacher), commentLabel: "Teacher's Comment", comment: comments.form_teacher_comment, signature: comments.form_teacher_signature },
          { label: toTitleCase(comments.head_teacher_title ?? 'Principal'), name: toTitleCase(comments.head_teacher), commentLabel: null, comment: null, signature: comments.head_teacher_signature },
        ].map((staff, si) => (
          <div key={si} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', borderBottom: si === 0 ? '1px solid #cbd5e1' : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '6px 10px', fontSize: 12, borderBottom: staff.commentLabel ? '1px solid #cbd5e1' : 'none' }}>
                <strong>{staff.label}:</strong> {staff.name ?? '—'}
              </div>
              {staff.commentLabel && (
                <div style={{ padding: '6px 10px', backgroundColor: headerColor, color: '#fff', fontSize: 12, flex: 1 }}>
                  <strong>{staff.commentLabel}:</strong> <span style={{ fontStyle: 'italic' }}>{staff.comment ?? '—'}</span>
                </div>
              )}
            </div>
            <div style={{ borderLeft: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px', backgroundColor: '#fff' }}>
              {staff.signature ? (
                <img src={ensureAbsoluteUrl(staff.signature)} alt="Signature" style={{ maxHeight: 35, maxWidth: 120, objectFit: 'contain' }} />
              ) : <div style={{ height: 35 }} />}
              <div style={{ color: '#64748b', fontSize: 9, marginTop: 2, fontWeight: 700 }}>SIGNATURE</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══ FOOTER ══ */}
      <div style={{ backgroundColor: '#f8fafc', textAlign: 'center', padding: '6px 8px', fontSize: 9, color: '#64748b', border: '1px solid #cbd5e1', borderTop: 'none', marginTop: '10px' }}>
        Managed by <strong>{vendorName}</strong> &nbsp;{vendorPhone}&nbsp; {vendorSite}
      </div>

    </div>
  );
}