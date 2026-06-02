'use client';

import React from 'react';
import { ResultSettings, ResultBehaviorCategory } from '@/lib/types';
import DefaultScoreTemplate from '../../score/1_default/preview';
import DefaultTextTemplate from '../../text/1_default/preview';

interface CombinedResultTemplateProps {
  student: any;
  result: any;
  settings: ResultSettings;
  behaviorCategories: ResultBehaviorCategory[];
  behaviorRatings: any;
  comments: any;
  termType: 'midterm' | 'end_of_term';
  gradeList?: Array<any>;
  midtermGradeList?: Array<any>;
  schoolInfo?: any;
}

export default function DefaultCombinedTemplate(props: CombinedResultTemplateProps) {
  // A simple composition of both default templates for preview purposes.
  // In a real scenario, this might interleave the data, but stacking them is standard.
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center font-bold text-lg border-b-2 border-black pb-2">PART 1: COGNITIVE SCORES</div>
      <DefaultScoreTemplate {...props} />
      
      <div className="text-center font-bold text-lg border-b-2 border-black pb-2 mt-8">PART 2: QUALITATIVE ASSESSMENT</div>
      <DefaultTextTemplate {...props} />
    </div>
  );
}