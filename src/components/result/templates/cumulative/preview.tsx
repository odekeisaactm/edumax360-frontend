'use client';

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

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
  if (!str) return '';
  return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
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

function SafeImage({ src, fallbackText, style }: { src?: string; fallbackText: string; style: React.CSSProperties }) {
  const [failed, setFailed] = React.useState(false);
  if (!src || failed) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 700, textAlign: 'center', padding: 4 }}>
        {fallbackText}
      </div>
    );
  }
  return <img src={src} alt="Img" style={style} onError={() => setFailed(true)} />;
}

export default function CumulativeResultTemplate({
  student,
  cumulativeData,
  settings,
  schoolInfo
}: {
  student: any;
  cumulativeData: any;
  settings: any;
  schoolInfo: any;
}) {

  const headerColor    = hex(settings?.header_color,    '#2c5f8d');
  const primaryColor   = hex(settings?.primary_color,   '#2c5f8d');
  const secondaryColor = hex(settings?.secondary_color, '#f0f4f8');
  const accentColor    = hex(settings?.accent_color,    '#1890ff');

  const isDetailed = settings?.cumulative_format === 'detailed';
  const showGraph = settings?.show_cumulative_graph !== false;
  const showPosition = settings?.show_position_on_result !== false;

  const vendorName  = schoolInfo?.vendor_name    || 'Balabalutech Limited';
  const vendorSite  = schoolInfo?.vendor_website || 'balabalutech.com';
  const vendorPhone = schoolInfo?.vendor_phone   || '08163550192';

  const subjects = Object.values(cumulativeData.subjects || {}) as any[];
  const periods = cumulativeData.periods || [];

  const chartData = useMemo(() =>
    subjects.map((s: any) => ({
      name: s.code || s.name.substring(0, 3).toUpperCase(),
      score: s.average ?? 0,
      fullName: s.name,
    })), [subjects]
  );

  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 11 };
  const thStyle: React.CSSProperties = {
    backgroundColor: headerColor, color: '#fff', padding: '6px 4px', textAlign: 'center',
    fontSize: 10, fontWeight: 700, border: `1px solid ${headerColor}`, whiteSpace: 'nowrap',
  };
  const thVerticalStyle: React.CSSProperties = { ...thStyle, writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 80, padding: 5 };
  const tdBase: React.CSSProperties = { padding: '5px 4px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: 11, color: '#1e293b' };

  return (
    <div style={{
      width: '210mm', minHeight: '297mm', backgroundColor: '#fff',
      margin: '0 auto', boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
      fontFamily: 'Arial, sans-serif', fontSize: 13, color: '#1e293b',
      position: 'relative', paddingBottom: 40
    }}>

      {/* ══ LETTERHEAD + TITLE BAND ══ */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: 100, flexShrink: 0, backgroundColor: headerColor }}>
          <SafeImage src={ensureAbsoluteUrl(student?.image_url || student?.image)} fallbackText="No Photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ backgroundColor: headerColor, color: '#fff', textAlign: 'center', padding: '10px 12px 6px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, fontFamily: 'Georgia, serif', textTransform: 'uppercase' }}>{schoolInfo?.name || 'School Name'}</div>
            <div style={{ fontSize: 11, marginTop: 3, opacity: 0.9 }}>{schoolInfo?.address}</div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>
              {[schoolInfo?.mobile_1, schoolInfo?.email, schoolInfo?.website].filter(Boolean).join('  |  ')}
            </div>
          </div>
          <div style={{ backgroundColor: headerColor, color: '#fff', padding: '5px 10px', fontSize: 12, fontWeight: 700, textAlign: 'center', letterSpacing: '0.04em' }}>
            CUMULATIVE STUDENT REPORT CARD &nbsp;|&nbsp; {cumulativeData?.session_name || 'SESSION'}
          </div>
        </div>
        <div style={{ width: 100, flexShrink: 0, backgroundColor: headerColor }}>
          <SafeImage src={ensureAbsoluteUrl(schoolInfo?.logo)} fallbackText="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, display: 'block' }} />
        </div>
      </div>

      {/* ══ INFO BOX ══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, margin: '2px 0' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, width: '34%' }}>
              {student?.last_name
                ? toTitleCase(`${student.last_name}, ${student.first_name ?? ''} ${student.middle_name ?? ''}`.replace(/\s+/g, ' ').trim())
                : toTitleCase(student?.full_name ?? '—')}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, width: '33%' }}>
              CLASS: {`${student?.current_class?.name ?? student?.current_class_name ?? ''} ${student?.class_section ?? ''}`.trim() || '—'}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700, width: '33%' }}>
              GENDER: {toTitleCase(student?.gender || '—')}
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              CUM. TOTAL: {cumulativeData?.overall_total?.toFixed(1) ?? '—'}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              STUDENT AVERAGE: {cumulativeData?.overall_average?.toFixed(1) ?? '—'}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              CLASS AVERAGE: {cumulativeData?.class_average?.toFixed(1) ?? '—'}
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              ATTENDANCE: {cumulativeData?.attendance?.present ?? 0} / {cumulativeData?.attendance?.total ?? 0}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              RESUMPTION DATE: {cumulativeData?.resumption_date || '—'}
            </td>
            <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', fontWeight: 700 }}>
              {showPosition ? `POSITION: ${cumulativeData?.position && cumulativeData.position !== '—' ? ordinal(cumulativeData.position) : '—'}` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ══ SCORE TABLE ══ */}
      <div style={{ margin: '15px 0' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', width: 160 }}>Subject</th>

              {isDetailed && periods.map((p: any) => (
                <th key={p.order} style={thVerticalStyle}>{toTitleCase(p.name)}</th>
              ))}

              <th style={thStyle}>Total Score</th>
              <th style={thStyle}>Cumulative Avg.</th>
              <th style={thStyle}>Final Grade</th>
              <th style={thStyle}>Remark</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((sub: any, i: number) => {
              const scoreColor = getScoreColor(sub.average);
              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : secondaryColor }}>
                  <td style={{ ...tdBase, textAlign: 'left', fontWeight: 600 }}>{toTitleCase(sub.name)}</td>

                  {isDetailed && periods.map((p: any) => {
                    const score = sub.terms[p.name];
                    return (
                      <td key={p.order} style={tdBase}>{score !== undefined && score !== null ? Number(score).toFixed(1) : '—'}</td>
                    );
                  })}

                  <td style={{ ...tdBase, fontWeight: 700 }}>{Number(sub.total || 0).toFixed(1)}</td>
                  <td style={{ ...tdBase, fontWeight: 700 }}>{Number(sub.average || 0).toFixed(1)}</td>
                  <td style={{ ...tdBase, fontWeight: 700, color: scoreColor }}>{sub.grade?.toUpperCase() || '—'}</td>
                  <td style={{ ...tdBase, fontWeight: 600, color: scoreColor }}>{sub.remark?.toUpperCase() || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══ SUMMARY BAND ══ */}
      <div style={{ margin: '15px 10px', backgroundColor: headerColor, color: '#fff', borderRadius: 4, padding: '10px 12px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
        <div>
          <span style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Session Total Score</span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{Number(cumulativeData.overall_total || 0).toFixed(1)}</span>
        </div>
        <div>
          <span style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Session Average</span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{Number(cumulativeData.overall_average || 0).toFixed(1)}%</span>
        </div>
        <div>
          <span style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Final Grade</span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{cumulativeData.overall_grade?.toUpperCase() || '—'}</span>
        </div>
        <div>
          <span style={{ fontSize: 10, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 3 }}>Final Remark</span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{cumulativeData.overall_remark?.toUpperCase() || '—'}</span>
        </div>
      </div>

      {/* ══ BAR CHART ══ */}
      {showGraph && chartData.length > 0 && (
        <div style={{ margin: '15px 10px', border: '1px solid #e2e8f0', borderRadius: 5, padding: '8px 4px 4px', backgroundColor: '#fafbfc' }}>
          <div style={{ textAlign: 'center', color: primaryColor, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Cumulative Performance Chart (Average Scores)</div>
          <ResponsiveContainer width="100%" height={120}>
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

      {/* ══ FOOTER ══ */}
      <div style={{ backgroundColor: '#f8fafc', textAlign: 'center', padding: '4px 8px', fontSize: 9, color: '#64748b', border: '1px solid #e2e8f0', borderTop: 'none', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        Powered by <strong>{vendorName}</strong> &nbsp;{vendorPhone}&nbsp; {vendorSite}
      </div>
    </div>
  );
}