'use client';

import React, { useState } from 'react';
import { authAPI } from '@/lib/api';
import { Lock, Eye, EyeOff, Loader2, Check, AlertCircle, X, ShieldCheck } from 'lucide-react';

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 shrink-0 mt-0.5"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

export default function ParentChangePasswordPage() {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getStrength = (pass: string) => {
    let score = 0;
    if (pass.length > 7) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getStrength(formData.new_password);
  const getStrengthColor = () => {
    if (strength === 0) return 'bg-slate-200';
    if (strength === 1) return 'bg-red-400';
    if (strength === 2) return 'bg-amber-400';
    if (strength === 3) return 'bg-blue-400';
    return 'bg-emerald-500';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.new_password !== formData.confirm_password) {
      showToast('error', 'New passwords do not match.');
      return;
    }
    if (strength < 2) {
      showToast('error', 'Password is too weak. Please use a stronger password.');
      return;
    }
    
    setSaving(true);
    try {
      await authAPI.changePassword({
        old_password: formData.current_password,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password
      });
      showToast('success', 'Password changed successfully. You may need to login again.');
      setFormData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      showToast('error', err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200 mx-auto mb-4">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Change Password</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Keep your account secure by updating your password regularly.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Password</label>
              <div className="relative">
                <input 
                  type={showCurrent ? "text" : "password"} 
                  name="current_password" 
                  value={formData.current_password} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none pr-10" 
                  required 
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
              <div className="relative">
                <input 
                  type={showNew ? "text" : "password"} 
                  name="new_password" 
                  value={formData.new_password} 
                  onChange={handleChange} 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none pr-10" 
                  required 
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              
              {formData.new_password && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 flex gap-1 h-1">
                    <div className={`flex-1 rounded-full ${strength >= 1 ? getStrengthColor() : 'bg-slate-200'}`} />
                    <div className={`flex-1 rounded-full ${strength >= 2 ? getStrengthColor() : 'bg-slate-200'}`} />
                    <div className={`flex-1 rounded-full ${strength >= 3 ? getStrengthColor() : 'bg-slate-200'}`} />
                    <div className={`flex-1 rounded-full ${strength >= 4 ? getStrengthColor() : 'bg-slate-200'}`} />
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">
                    {strength === 0 && 'Weak'}
                    {strength === 1 && 'Fair'}
                    {strength === 2 && 'Good'}
                    {strength >= 3 && 'Strong'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm New Password</label>
              <input 
                type={showNew ? "text" : "password"} 
                name="confirm_password" 
                value={formData.confirm_password} 
                onChange={handleChange} 
                className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 outline-none ${
                  formData.confirm_password && formData.new_password !== formData.confirm_password
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-slate-200 focus:ring-indigo-500 focus:border-transparent'
                }`} 
                required 
              />
              {formData.confirm_password && formData.new_password !== formData.confirm_password && (
                <p className="text-[11px] text-red-500 mt-1 font-medium">Passwords do not match</p>
              )}
            </div>

            <button 
              type="submit" 
              disabled={saving || !formData.current_password || !formData.new_password || !formData.confirm_password}
              className="w-full bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mt-4"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {saving ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
        
        <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed font-medium">
            Make sure your new password is at least 8 characters long and includes a mix of uppercase letters, numbers, and special characters.
          </p>
        </div>
      </div>
    </div>
  );
}
