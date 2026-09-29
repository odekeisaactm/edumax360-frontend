'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { SOFTWARE_NAME } from '@/lib/constants';
import {
  GraduationCap, LogOut, Copy, Check, Eye, EyeOff,
  UserCircle, Key, AlertCircle, Loader2, ArrowRight,
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { user, authReady, loading, logout } = useAuth();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // ── Auth gate ──
  useEffect(() => {
    if (!authReady || loading) return;
    if (!user) {
      window.location.href = '/login';
      return;
    }
    // Non-students who somehow land here get bounced to their real dashboard
    if (user.user_type === 'parent') window.location.href = '/dashboard/parent';
    else if (user.user_type === 'staff') window.location.href = '/dashboard/staff';
    else if (user.user_type !== 'student') window.location.href = '/dashboard';
  }, [authReady, loading, user]);

  const parent = user?.profile?.parent;

  const handleCopy = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  };

  const handleLogout = async () => {
    setRedirecting(true);
    await logout(); // logout() clears session and redirects to /login
  };

  // ── Loading ──
  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user || user.user_type !== 'student') return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">

      {/* Background decor */}
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

      {/* Card */}
      <div className="w-full max-w-lg bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-100/50 border border-white p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in-95 duration-500">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-xl shadow-indigo-200 flex items-center justify-center">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2 mb-7">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Student Login Not Available Yet
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
            You cannot log in to the Student Portal at this time.
            Please use your parent's credentials to sign in to the Parent Portal
            and access your ward's information.
          </p>
        </div>

        {/* Parent credentials block */}
        {parent ? (
          <div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 rounded-2xl p-5 space-y-3 mb-5">

            <div className="flex items-center gap-2 pb-2 border-b border-indigo-100">
              <UserCircle className="w-4 h-4 text-indigo-600" />
              <p className="text-xs font-black text-indigo-700 uppercase tracking-wider">
                Parent Account
              </p>
            </div>

            {parent.full_name && (
              <div className="text-sm">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Name</p>
                <p className="font-bold text-slate-800">{parent.full_name}</p>
              </div>
            )}

            {parent.username && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Username</p>
                  <p className="font-mono font-bold text-slate-800 text-sm truncate">{parent.username}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('username', parent.username!)}
                  className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white transition-colors"
                  title="Copy username"
                >
                  {copiedField === 'username'
                    ? <Check className="w-4 h-4 text-emerald-600" />
                    : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {parent.default_password && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Default Password</p>
                  <p className="font-mono font-bold text-slate-800 text-sm truncate">
                    {showPassword ? parent.default_password : '••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-white transition-colors"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy('password', parent.default_password!)}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white transition-colors"
                    title="Copy password"
                  >
                    {copiedField === 'password'
                      ? <Check className="w-4 h-4 text-emerald-600" />
                      : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="flex items-start gap-2 pt-2 border-t border-indigo-100">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                If your parent has already changed their password from the default shown here,
                this password will no longer work. Ask them for their current password instead.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-5 text-center">
            <Key className="w-5 h-5 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              Ask your parent for their Parent Portal login details.
            </p>
          </div>
        )}

        {/* Action */}
        <button
          type="button"
          onClick={handleLogout}
          disabled={redirecting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {redirecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Signing out...
            </>
          ) : (
            <>
              <LogOut className="w-4 h-4" />
              Log out & go to Login
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="mt-10 flex items-center gap-2 text-slate-400 select-none">
        <GraduationCap className="w-5 h-5" />
        <span className="text-sm font-bold uppercase tracking-widest">{SOFTWARE_NAME}</span>
      </div>
    </div>
  );
}