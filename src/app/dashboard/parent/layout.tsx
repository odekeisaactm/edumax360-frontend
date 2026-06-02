'use client';

import React, { useState } from 'react';
import { WardProvider, useWard } from '@/context/WardContext';
import { ChevronDown, User, Check, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

function WardSwitcher() {
  const { wards, selectedWard, setSelectedWard } = useWard();
  const [isOpen, setIsOpen] = useState(false);

  if (!wards || wards.length <= 1) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors border border-slate-200 shadow-sm"
      >
        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold">
          {selectedWard?.first_name?.[0]}{selectedWard?.last_name?.[0]}
        </div>
        <span className="text-xs font-bold text-slate-700 hidden md:block">
          {selectedWard?.first_name} {selectedWard?.last_name}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
            <div className="px-4 py-2 border-b border-slate-50 mb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Switch Ward</p>
            </div>
            {wards.map((ward) => (
              <button
                key={ward.id}
                onClick={() => {
                  setSelectedWard(ward);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50
                  ${selectedWard?.id === ward.id ? 'bg-indigo-50/50' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs
                  ${selectedWard?.id === ward.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {ward.first_name?.[0]}{ward.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate leading-none mb-0.5">{ward.first_name} {ward.last_name}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{ward.current_class_name || 'No Class'}</p>
                </div>
                {selectedWard?.id === ward.id && (
                  <Check className="w-4 h-4 text-indigo-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ParentLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect if not parent
  React.useEffect(() => {
    if (user && user.user_type !== 'parent' && user.user_type !== 'staff') {
      // router.replace('/dashboard');
    }
  }, [user]);

  return (
    <div className="flex flex-col w-full">
      {/* Top action bar for Parent Portal */}
      <div className="flex justify-end items-center mb-6">
        <WardSwitcher />
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <WardProvider>
      <ParentLayoutInner>
        {children}
      </ParentLayoutInner>
    </WardProvider>
  );
}
