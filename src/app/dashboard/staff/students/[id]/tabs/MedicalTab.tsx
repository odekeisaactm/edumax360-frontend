import React from 'react';
import { Student } from '@/lib/types';
import { Heart, Activity, Star, AlertCircle } from 'lucide-react';

export default function MedicalTab({ student }: { student: Student }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

      {/* 1. Vitals Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-500" /> Vitals
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase">Blood Group</label>
            <p className="text-sm font-medium text-slate-800 mt-1">{student.blood_group || '—'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase">Genotype</label>
            <p className="text-sm font-medium text-slate-800 mt-1">{student.genotype || '—'}</p>
          </div>
        </div>
      </div>

      {/* 2. Conditions Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-500" /> Conditions
        </h3>
        <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-700 min-h-[80px] leading-relaxed">
          {student.medical_conditions || 'No specific medical conditions reported.'}
        </div>
      </div>

      {/* 3. Special Needs Card (NEW) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Star className="h-4 w-4 text-indigo-500" /> Special Needs
        </h3>

        {(student as any).is_special_need ? (
          <div className="flex flex-col items-center justify-center p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center gap-2">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900">Yes</p>
              <p className="text-xs text-indigo-600">Special requirements noted</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl text-center gap-2">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
              <Star className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600">No</p>
              <p className="text-xs text-slate-400">No special needs recorded</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}