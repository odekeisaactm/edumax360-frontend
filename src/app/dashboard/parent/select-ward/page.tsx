'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useWard, Ward } from '@/context/WardContext';
import { useAuth } from '@/context/AuthContext';
import {
  ChevronRight, Loader2,
  AlertCircle, Users, ShieldCheck
} from 'lucide-react';

export default function SelectWardPage() {
  const router = useRouter();
  const { wards, loading, setSelectedWard } = useWard();
  const { user } = useAuth();

  const handleSelect = (ward: Ward) => {
    setSelectedWard(ward);
    router.push('/dashboard/parent');
  };

  const getWardName = (ward: Ward) => {
    return ward.full_name || `${ward.first_name || ''} ${ward.last_name || ''}`.trim() || 'Student';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 pb-20">
        <div className="w-full max-w-2xl mx-auto space-y-8">

          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome, {user?.first_name || 'Parent'}</h2>
            <p className="text-slate-500 font-medium">Please select a child to access their dashboard</p>
          </div>

          {wards.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">No Wards Found</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                We couldn't find any students linked to this parent account. Please contact the school administrator to update your profile.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {wards.map((ward) => {
                const wardName = getWardName(ward);
                const initial = wardName[0].toUpperCase();

                return (
                  <button
                    key={ward.id}
                    onClick={() => handleSelect(ward)}
                    className="group bg-white p-5 rounded-3xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-100 transition-all duration-300 text-left flex items-center gap-5"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl font-black text-indigo-600 flex-shrink-0 overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-300">
                      {ward.image_url ? (
                        <img src={ward.image_url} alt={wardName} className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 truncate capitalize group-hover:text-indigo-700 transition-colors">
                        {wardName}
                      </h3>
                      <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                        {ward.current_class_name || 'No Class'} {ward.current_class_section_name ? `· ${ward.current_class_section_name}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-md">
                          {ward.registration_number}
                        </span>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white text-slate-400 transition-colors flex-shrink-0">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Secure Environment Notice */}
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-8">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Secure Portal Connection
          </div>

        </div>
      </main>
    </div>
  );
}