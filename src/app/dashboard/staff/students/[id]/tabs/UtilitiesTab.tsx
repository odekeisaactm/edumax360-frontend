import React, { useState, useEffect } from 'react';
import { utilitiesAPI, studentsAPI } from '@/lib/api';
import { Student, Utility } from '@/lib/types';
import { Package, Check, X, Loader2, ToggleLeft, ToggleRight, Grid3x3 } from 'lucide-react';

interface Props {
  student: Student;
  refreshStudent: () => void;
}

export default function UtilitiesTab({ student, refreshStudent }: Props) {
  const [allUtilities, setAllUtilities] = useState<Utility[]>([]);
  const [studentUtilityIds, setStudentUtilityIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, [student.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Get all active utilities
      const all = await utilitiesAPI.list();
      setAllUtilities(all.filter((u: Utility) => u.is_active));

      // 2. Get student's current utilities
      // Note: The API might return the full objects or just IDs.
      // We assume the studentsAPI.get() returns the object with utility_ids included,
      // but we can also call the specific endpoint if available.
      // For now, we rely on the student object passed from the parent refresh.
      if (student.utility_ids) {
        setStudentUtilityIds(student.utility_ids);
      }
    } catch (e) {
      console.error('Failed to load utilities', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (utilityId: number, isActive: boolean) => {
    setUpdating(true);
    try {
      let newIds: number[];
      if (isActive) {
        // Remove ID
        newIds = studentUtilityIds.filter(id => id !== utilityId);
      } else {
        // Add ID
        newIds = [...studentUtilityIds, utilityId];
      }

      // Update local state immediately (Optimistic UI)
      setStudentUtilityIds(newIds);

      // Send to backend
      await studentsAPI.updateUtilities(student.id, newIds);

      // Refresh student data from parent to ensure sync
      refreshStudent();
    } catch (err) {
      console.error(err);
      alert('Failed to update services');
      // Revert on error
      loadData();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* COLUMN 1: My Services (Subscribed) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <Package className="h-3.5 w-3.5" />
          </div>
          Active Services
          <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
            {studentUtilityIds.length}
          </span>
        </h3>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : studentUtilityIds.length === 0 ? (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No active services.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allUtilities
              .filter(u => studentUtilityIds.includes(u.id))
              .map(utility => (
                <div key={utility.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{utility.name}</p>
                      <p className="text-xs text-slate-500">{utility.code}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(utility.id, true)}
                    disabled={updating}
                    className="p-1.5 text-blue-600 hover:bg-white hover:shadow-sm rounded-lg transition-all disabled:opacity-50"
                    title="Remove Service"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* COLUMN 2: Available Services (Subscribe) */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
            <Grid3x3 className="h-3.5 w-3.5" />
          </div>
          Available Services
        </h3>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {allUtilities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No services configured in the school.</p>
            ) : (
              allUtilities.map(utility => {
                const isSubscribed = studentUtilityIds.includes(utility.id);
                return (
                  <div
                    key={utility.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSubscribed
                        ? 'bg-blue-50 border-blue-100 opacity-50'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSubscribed ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <p className={`text-sm font-bold ${isSubscribed ? 'text-slate-500' : 'text-slate-900'}`}>{utility.name}</p>
                        <p className="text-xs text-slate-400">{utility.description || 'No description'}</p>
                      </div>
                    </div>

                    {!isSubscribed && (
                      <button
                        onClick={() => handleToggle(utility.id, false)}
                        disabled={updating}
                        className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 rounded-lg transition-all disabled:opacity-50"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
}