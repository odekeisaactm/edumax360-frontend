'use client';

import React from 'react';
import MinimalScoreTemplate from '../../score/3_minimal/preview';
import MinimalTextTemplate from '../../text/3_minimal/preview';

export default function MinimalCombinedTemplate(props: any) {
  return (
    <div className="flex flex-col gap-16 font-serif">
      <div>
        <h2 className="text-2xl font-bold border-b-4 border-slate-900 pb-2 mb-8 text-center uppercase tracking-widest">I. Academic Performance</h2>
        <MinimalScoreTemplate {...props} />
      </div>
      
      <div className="page-break-before-always">
        <h2 className="text-2xl font-bold border-b-4 border-slate-900 pb-2 mb-8 text-center uppercase tracking-widest">II. Qualitative Feedback</h2>
        <MinimalTextTemplate {...props} />
      </div>
    </div>
  );
}