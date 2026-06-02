'use client';

import React from 'react';
import { ResultSettings, ResultBehaviorCategory } from '@/lib/types';
import ModernScoreTemplate from '../../score/2_modern/preview';
import ModernTextTemplate from '../../text/2_modern/preview';

export default function ModernCombinedTemplate(props: any) {
  return (
    <div className="flex flex-col gap-12 bg-slate-50 p-8 rounded-3xl">
      <div className="bg-white px-8 py-4 rounded-xl shadow-sm text-center">
        <h2 className="text-xl font-bold tracking-widest uppercase text-slate-800">Comprehensive Report Portfolio</h2>
        <p className="text-sm text-slate-400 mt-1">Section I: Quantitative Scores</p>
      </div>
      
      <ModernScoreTemplate {...props} />
      
      <div className="bg-white px-8 py-4 rounded-xl shadow-sm text-center">
        <p className="text-sm text-slate-400">Section II: Qualitative Evaluation</p>
      </div>
      
      <ModernTextTemplate {...props} />
    </div>
  );
}