import React, { useState, useEffect } from 'react';
import { Student, StudentClassHistory } from '@/lib/types';
import { studentsAPI } from '@/lib/api';
import { GraduationCap, Calendar, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  student: Student;
}

export default function AcademicTab({ student }: Props) {
  const [history, setHistory] = useState<StudentClassHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentsAPI.getClassHistory(student.id).then(setHistory).finally(() => setLoading(false));
  }, [student.id]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Class Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-blue-600" /> Current Class
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Class</p>
            <p className="text-sm font-medium text-slate-800 mt-1">{student.current_class_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Section</p>
            <p className="text-sm font-medium text-slate-800 mt-1">{student.current_class_section_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold">Admission No.</p>
            <p className="text-sm font-medium text-slate-800 mt-1">{student.registration_number}</p>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-6">Academic History</h3>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">No history available.</div>
        ) : (
          <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
            {history.map((record, idx) => (
              <div key={record.id} className="relative pl-6">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(record.status)}`}></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-slate-800">{record.class_name}</p>
                    <p className="text-sm text-slate-500">{record.session_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(record.status)}`}>
                      {record.status}
                    </span>
                    {record.entry_type && (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                        {record.entry_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-500 flex gap-4">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {record.start_date}</span>
                  {record.end_date && <span>to {record.end_date}</span>}
                </div>

                {record.promotion_status && record.promotion_status !== 'pending' && (
                  <div className="mt-2 text-xs font-medium text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">
                    Promotion: {record.promotion_status}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}