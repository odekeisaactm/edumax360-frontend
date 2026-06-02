'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWard } from '@/context/WardContext';
import { resultAnalyticsAPI, resultArchiveAPI } from '@/lib/api';
import { 
  TrendingUp, Loader2, AlertCircle, Calendar, LineChart as ChartIcon, Info
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';

export default function ParentPerformanceComparison() {
  const { selectedWard, loading: wardLoading } = useWard();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (selectedWard) {
      fetchComparison();
    }
  }, [selectedWard]);

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await resultAnalyticsAPI.studentTracker({ student_id: selectedWard!.id });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (wardLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  if (!selectedWard) return <div className="p-8 text-center text-slate-500">Select a child to view performance trends.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">Performance Comparison</h1>
          <p className="text-sm text-slate-500 font-medium">Tracking academic progress over time</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>
      ) : data ? (
        <div className="space-y-8">
          
          {/* Insight Alert */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex gap-4 items-start shadow-sm">
            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Info className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h4 className="font-bold text-indigo-900 mb-1">Academic Insight</h4>
              <p className="text-sm text-indigo-700 leading-relaxed font-medium">
                {data.insight}
              </p>
            </div>
          </div>

          {/* Overall Trend Chart */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <ChartIcon className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wide">Overall Average Trajectory (%)</h3>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.overall_trend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="period" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Line type="monotone" dataKey="average" name="Average" stroke="#4f46e5" strokeWidth={4} dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Specific Trends - Grid of small charts or one multi-line? 
              Let's do a few key ones or just mention overall. 
              The prompt says "student performance across terms per subject".
              Let's render a multi-line chart for the top 5 subjects.
          */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <ChartIcon className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-slate-800 uppercase tracking-wide">Subject-Specific Trends</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {Object.entries(data.subject_trends || {}).slice(0, 4).map(([subjName, trend]: [string, any]) => (
                 <div key={subjName} className="space-y-3 bg-slate-50 p-6 rounded-3xl">
                    <h4 className="font-bold text-slate-700 text-sm">{subjName}</h4>
                    <div className="h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend}>
                          <XAxis dataKey="period" hide />
                          <YAxis domain={[0, 100]} hide />
                          <RechartsTooltip labelStyle={{color: '#000'}} />
                          <Line type="step" dataKey="score" name="Score" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
               ))}
            </div>
          </div>

        </div>
      ) : (
        <div className="h-48 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
           <AlertCircle className="w-10 h-10 text-slate-200 mb-3" />
           <p className="text-slate-400 font-medium">Insufficient data to generate comparison charts.</p>
        </div>
      )}

    </div>
  );
}
