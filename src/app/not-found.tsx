'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Compass, Home, ArrowLeft, GraduationCap } from 'lucide-react';
import { SOFTWARE_NAME } from '@/lib/constants';

export default function NotFound() {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine the correct dashboard path based on the user's role
  const getDashboardPath = () => {
    if (!user) return '/login'; // Fallback if they are completely logged out

    if (user.user_type === 'student') return '/dashboard/student';
    if (user.user_type === 'parent') return '/dashboard/parent';
    return '/dashboard/staff'; // Default for admins/teachers
  };

  const dashboardLink = getDashboardPath();

  if (!mounted) return null; // Avoid flashing incorrect links before context loads

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden relative">

      {/* ── Background Decorative Elements ── */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Main 404 Card ── */}
      <div className="w-full max-w-lg bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-white p-8 sm:p-12 text-center animate-in zoom-in-95 fade-in duration-500 relative z-10">

        {/* Visual Graphic */}
        <div className="relative flex justify-center items-center mb-6">
          {/* Big 404 Text Background */}
          <h1 className="text-[120px] sm:text-[150px] font-black text-transparent bg-clip-text bg-gradient-to-b from-indigo-50 to-indigo-100/10 select-none leading-none tracking-tighter">
            404
          </h1>

          {/* Floating Icon Overlap */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full shadow-xl shadow-indigo-200 flex items-center justify-center border-4 border-white animate-bounce" style={{ animationDuration: '3s' }}>
              <Compass className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Lost in the corridors?
          </h2>
          <p className="text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
            We couldn't find the page you're looking for. It might have been moved, deleted, or you might have typed the URL incorrectly.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>

          <Link
            href={dashboardLink}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5"
          >
            <Home className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </div>

      </div>

      {/* ── Footer Branding ── */}
      <div className="mt-12 flex items-center gap-2 text-slate-400 select-none animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <GraduationCap className="w-5 h-5" />
        <span className="text-sm font-bold uppercase tracking-widest">{SOFTWARE_NAME}</span>
      </div>

    </div>
  );
}