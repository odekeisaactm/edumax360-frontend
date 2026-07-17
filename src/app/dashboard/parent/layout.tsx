'use client';

import React, { useState, useEffect } from 'react';
import { WardProvider, useWard } from '@/context/WardContext';
import { ArrowRightLeft, Check, Loader2, Users } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

function WardSwitcher() {
  const { wards, selectedWard, setSelectedWard } = useWard();
  const [isOpen, setIsOpen] = useState(false);

  if (!wards || wards.length <= 1) return null;

  // Extract name properly based on API response
  const currentName = selectedWard?.full_name || `${selectedWard?.first_name || ''} ${selectedWard?.last_name || ''}`.trim() || 'Student';

  return (
    <div className="relative flex items-center gap-4">
      {/* Current Ward Display */}
      <div className="hidden md:flex flex-col items-end">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Current Ward</span>
        <span className="text-sm font-black text-slate-800 leading-none capitalize">
          {currentName}
        </span>
      </div>

      {/* Clean Switch Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors font-bold text-sm shadow-sm border border-indigo-100"
      >
        <ArrowRightLeft className="w-4 h-4" />
        <span>Switch Ward</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden py-2 animate-in fade-in slide-in-from-top-2">
            <div className="px-4 py-3 border-b border-slate-50 mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Select a Ward</p>
            </div>
            {wards.map((ward) => {
              const wardName = ward.full_name || `${ward.first_name || ''} ${ward.last_name || ''}`.trim() || 'Student';
              const initial = wardName[0].toUpperCase();

              return (
                <button
                  key={ward.id}
                  onClick={() => {
                    setSelectedWard(ward);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50
                    ${selectedWard?.id === ward.id ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0
                    ${selectedWard?.id === ward.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate leading-tight mb-1 capitalize">
                      {wardName}
                    </p>
                    <p className="text-[11px] text-slate-500 font-semibold truncate leading-none">
                      {ward.current_class_name || 'No Class'} {ward.current_class_section_name ? `· ${ward.current_class_section_name}` : ''}
                    </p>
                  </div>
                  {selectedWard?.id === ward.id && (
                    <Check className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ParentLayoutInner({ children }: { children: React.ReactNode }) {
  const { selectedWard, loading, wards } = useWard();
  const router = useRouter();
  const pathname = usePathname();

  const isSelectPage = pathname.includes('/parent/select-ward');

  useEffect(() => {
    if (!loading) {
      if (!selectedWard && !isSelectPage) {
        router.replace('/dashboard/parent/select-ward');
      } else if (selectedWard && isSelectPage) {
        router.replace('/dashboard/parent');
      }
    }
  }, [loading, selectedWard, pathname, router]);

  if (loading || (!selectedWard && !isSelectPage)) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-500 animate-pulse">Loading parent portal...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/*
        ADDED print:hidden HERE
        This stops the Switcher from appearing on physical prints!
      */}
      {!isSelectPage && wards.length > 1 && (
        <div className="flex justify-end items-center mb-6 print:hidden">
          <WardSwitcher />
        </div>
      )}
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