'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

interface Props {
  schoolInfo: any;
  logoUrl?: string;
  title: string;
  filters: string[];
  generatedAt: string;
}

/** Print-only letterhead: logo on the left, school details beside it,
 *  then the report title and the active filters. Hidden on screen. */
export default function PrintLetterhead({ schoolInfo, logoUrl, title, filters, generatedAt }: Props) {
  const contact = [schoolInfo?.email, schoolInfo?.mobile_1, schoolInfo?.mobile_2, schoolInfo?.website]
    .filter(Boolean)
    .join('   ·   ');
  const address = schoolInfo?.address ? String(schoolInfo.address).replace(/\s*\n\s*/g, ', ') : '';

  return (
    <div className="hidden print:block mb-6">
      <div className="flex items-center gap-5 pb-4 border-b-2 border-slate-900">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-20 w-20 object-contain shrink-0" />
        ) : (
          <div className="h-20 w-20 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <Building2 className="h-9 w-9 text-slate-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black uppercase tracking-wide text-slate-900 leading-tight">
            {schoolInfo?.name || 'School Name Not Set'}
          </h1>
          {schoolInfo?.motto && <p className="text-[11px] italic text-slate-500 mt-0.5">{schoolInfo.motto}</p>}
          {address && <p className="text-[11px] text-slate-600 mt-1.5">{address}</p>}
          {contact && <p className="text-[11px] text-slate-600 mt-0.5">{contact}</p>}
        </div>
      </div>

      <div className="pt-4 flex items-end justify-between gap-6">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight">{title}</h2>
          {filters.length > 0 && (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{filters.join('   |   ')}</p>
          )}
        </div>
        <p className="text-[10px] font-medium text-slate-400 whitespace-nowrap">Generated {generatedAt}</p>
      </div>
    </div>
  );
}