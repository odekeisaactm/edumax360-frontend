'use client';

import React from 'react';
import { useWard } from '@/context/WardContext';
import { 
  Users, CheckCircle2, ChevronRight, GraduationCap, MapPin, 
  Calendar, CreditCard, ShieldCheck, Loader2
} from 'lucide-react';

export default function MyWardsPage() {
  const { wards, selectedWard, setSelectedWard, loading } = useWard();

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">My Children</h1>
          <p className="text-sm text-slate-500 font-medium">Manage and switch between your wards</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {wards.map((ward) => (
          <div 
            key={ward.id}
            className={`relative bg-white rounded-[2rem] border transition-all overflow-hidden cursor-pointer group
              ${selectedWard?.id === ward.id ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-xl' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}
            onClick={() => setSelectedWard(ward)}
          >
            {selectedWard?.id === ward.id && (
              <div className="absolute top-4 right-4 bg-indigo-600 text-white p-1 rounded-full z-10">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}

            <div className="p-8">
              <div className="flex items-center gap-6 mb-6">
                <img 
                  src={ward.image || '/images/default-avatar.png'} 
                  alt={ward.first_name}
                  className="w-20 h-20 rounded-3xl object-cover border-4 border-slate-50 shadow-sm"
                />
                <div>
                  <h3 className="text-xl font-black text-slate-800">{ward.first_name} {ward.last_name}</h3>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{ward.registration_number}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-500">
                  <GraduationCap className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{ward.current_class_name} · {ward.current_class_section_name}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium italic">Active Student</span>
                </div>
              </div>

              <button 
                className={`w-full mt-8 py-3 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2
                  ${selectedWard?.id === ward.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600'}`}
              >
                {selectedWard?.id === ward.id ? 'Currently Viewing' : 'Switch to Ward'}
                <ChevronRight className={`w-4 h-4 ${selectedWard?.id === ward.id ? 'hidden' : 'block'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
