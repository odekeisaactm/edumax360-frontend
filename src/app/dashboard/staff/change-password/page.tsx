'use client';

import React, { useState } from 'react';
import { authAPI } from '@/lib/api';
import { Loader2, CheckCircle2, XCircle, X, Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface ToastItem { id: number; type: 'success' | 'error'; message: string; }
let _toastId = 0;

export default function StaffChangePasswordPage() {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const calculateStrength = (pwd: string) => {
    if (!pwd) return 0;
    if (pwd.length < 8) return 1; // weak
    if (pwd.length < 12) return 2; // fair
    return 3; // strong
  };

  const strength = calculateStrength(formData.new_password);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.new_password.length < 8) {
      return showToast('error', 'New password must be at least 8 characters.');
    }
    if (formData.new_password !== formData.confirm_password) {
      return showToast('error', 'New passwords do not match.');
    }
    if (formData.current_password === formData.new_password) {
      return showToast('error', 'New password cannot be the same as current password.');
    }

    setLoading(true);
    try {
      await authAPI.changePassword({
        old_password: formData.current_password,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password
      });
      showToast('success', 'Password changed successfully.');
      setFormData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to change password.';
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 relative">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border ${t.type === 'success' ? 'bg-white border-green-200' : 'bg-white border-red-200'} animate-in slide-in-from-right-8 max-w-sm`}>
            {t.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
            <div className="flex-1 text-sm font-medium text-slate-800">{t.message}</div>
            <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600 p-1 -mr-2 -mt-2"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>

      <div className="max-w-md mx-auto mt-10">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Change Password</h1>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
              <div className="relative">
                <input 
                  type={showCurrent ? "text" : "password"} 
                  name="current_password" 
                  value={formData.current_password} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none pr-10" 
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
              <div className="relative">
                <input 
                  type={showNew ? "text" : "password"} 
                  name="new_password" 
                  value={formData.new_password} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none pr-10" 
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.new_password && (
                <div className="mt-2 flex gap-1 h-1.5 w-full rounded-full overflow-hidden bg-slate-100">
                  <div className={`h-full ${strength >= 1 ? (strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-yellow-500' : 'bg-green-500') : ''}`} style={{ width: '33.33%' }}></div>
                  <div className={`h-full ${strength >= 2 ? (strength === 2 ? 'bg-yellow-500' : 'bg-green-500') : ''}`} style={{ width: '33.33%' }}></div>
                  <div className={`h-full ${strength >= 3 ? 'bg-green-500' : ''}`} style={{ width: '33.33%' }}></div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input 
                  type={showConfirm ? "text" : "password"} 
                  name="confirm_password" 
                  value={formData.confirm_password} 
                  onChange={handleChange} 
                  required 
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none pr-10" 
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
            <ShieldAlert className="w-4 h-4 shrink-0 text-slate-400" />
            <p>After changing your password, you will need to log in again on other devices for security purposes.</p>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Updating Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
