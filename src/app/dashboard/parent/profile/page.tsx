'use client';

import React, { useState, useEffect, useRef } from 'react';
import { authAPI, utilityAPI } from '@/lib/api';
import { 
  User, Phone, Briefcase, Camera, Loader2, Save, 
  CheckCircle2, AlertCircle, X, Check, Edit3
} from 'lucide-react';

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

export default function ParentProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [statesList, setStatesList] = useState<any[]>([]);
  const [lgasList, setLgasList] = useState<any[]>([]);
  
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, type, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  };

  const [formData, setFormData] = useState({
    parent_id: '', title: '', first_name: '', middle_name: '', last_name: '',
    email: '', mobile: '', address: '', date_of_birth: '', gender: '',
    marital_status: '', religion: '', state: '', lga: '', occupation: '',
    office_address: '', office_mobile: ''
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authAPI.getProfile();
        const data = res.data || res;
        setFormData({
          parent_id: data.parent_id || '', title: data.title || '', first_name: data.first_name || '',
          middle_name: data.middle_name || '', last_name: data.last_name || '', email: data.email || '',
          mobile: data.mobile || '', address: data.address || '', date_of_birth: data.date_of_birth ? data.date_of_birth.substring(0, 10) : '',
          gender: data.gender || '', marital_status: data.marital_status || '', religion: data.religion || '',
          state: data.state || '', lga: data.lga || '', occupation: data.occupation || '',
          office_address: data.office_address || '', office_mobile: data.office_mobile || ''
        });
        if (data.image_url) {
          setImagePreview(data.image_url);
        }
      } catch (err) {
        showToast('error', 'Failed to load profile details.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();

    utilityAPI.getStates().then((res: any) => {
      setStatesList(res.data || res || []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (formData.state) {
      utilityAPI.getLGAs(formData.state).then((res: any) => {
        setLgasList(res.data || res || []);
      }).catch(console.error);
    } else {
      setLgasList([]);
    }
  }, [formData.state]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (imageFile) {
        const d = new FormData();
        Object.entries(formData).forEach(([k, v]) => {
          if (k !== 'parent_id' && v) d.append(k, v as string);
        });
        d.append('image', imageFile);
        await authAPI.updateProfile(d);
      } else {
        const d = { ...formData };
        delete (d as any).parent_id;
        await authAPI.updateProfile(d);
      }
      showToast('success', 'Profile updated successfully.');
      setIsEditing(false);
    } catch (err: any) {
      showToast('error', err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  const inputClasses = isEditing 
    ? "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white transition-all"
    : "w-full px-0 py-2.5 border-transparent bg-transparent text-slate-800 text-sm outline-none cursor-default font-medium disabled:opacity-100 disabled:text-slate-800";

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <ToastStack toasts={toasts} onDismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
      
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm shadow-indigo-200">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">My Profile</h1>
              <p className="text-sm font-medium text-slate-500">Manage your personal information</p>
            </div>
          </div>
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-indigo-200 transition-all flex items-center gap-2 transform hover:scale-[1.02]"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>

        <div className={`bg-white rounded-2xl shadow-sm border ${isEditing ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-slate-100'} overflow-hidden transition-all duration-300`}>
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row gap-6 items-center md:items-start bg-slate-50/50">
            <div className="relative group">
              <div className={`w-24 h-24 rounded-full border-4 border-white shadow-sm bg-slate-100 overflow-hidden flex items-center justify-center ${isEditing ? 'cursor-pointer hover:border-indigo-100' : ''}`}
                onClick={() => isEditing && fileInputRef.current?.click()}>
                {imagePreview ? (
                  <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-300" />
                )}
                {isEditing && (
                  <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              {isEditing && (
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} disabled={!isEditing} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-900 mt-2 flex items-center justify-center md:justify-start gap-2">
                {formData.first_name} {formData.last_name}
                {isEditing && <span className="text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold ml-2">Editing Mode</span>}
              </h2>
              {formData.parent_id && (
                <div className="inline-flex items-center px-3 py-1 mt-2 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <span className="text-xs font-semibold text-indigo-700">School Reference ID: {formData.parent_id}</span>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-8">
            {/* Personal Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" /> Personal Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Title</label>
                  {isEditing ? (
                    <select name="title" value={formData.title} onChange={handleChange} className={inputClasses}>
                      <option value="">Select...</option>
                      {['Mr', 'Mrs', 'Miss', 'Dr'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <div className={inputClasses}>{formData.title || '—'}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">First Name</label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className={inputClasses} required disabled={!isEditing} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Middle Name</label>
                  <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} className={inputClasses} disabled={!isEditing} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className={inputClasses} required disabled={!isEditing} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date of Birth</label>
                  <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className={inputClasses} disabled={!isEditing} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Gender</label>
                  {isEditing ? (
                    <select name="gender" value={formData.gender} onChange={handleChange} className={inputClasses}>
                      <option value="">Select...</option>
                      {['Male', 'Female'].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  ) : (
                    <div className={inputClasses}>{formData.gender || '—'}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Marital Status</label>
                  {isEditing ? (
                    <select name="marital_status" value={formData.marital_status} onChange={handleChange} className={inputClasses}>
                      <option value="">Select...</option>
                      {['Single', 'Married', 'Divorced', 'Widowed'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div className={inputClasses}>{formData.marital_status || '—'}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Religion</label>
                  {isEditing ? (
                    <select name="religion" value={formData.religion} onChange={handleChange} className={inputClasses}>
                      <option value="">Select Religion</option>
                      {['christianity', 'islam', 'traditional', 'other'].map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  ) : (
                    <div className={inputClasses}>{formData.religion ? formData.religion.charAt(0).toUpperCase() + formData.religion.slice(1) : '—'}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Contact Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-500" /> Contact & Location
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClasses} disabled={!isEditing} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mobile Number</label>
                  <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} className={inputClasses} disabled={!isEditing} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Residential Address</label>
                  <textarea name="address" rows={isEditing ? 2 : undefined} value={formData.address} onChange={handleChange} className={`${inputClasses} ${!isEditing ? 'h-auto py-1 resize-none' : 'resize-none'}`} disabled={!isEditing} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">State of Origin</label>
                  {isEditing ? (
                    <select name="state" value={formData.state} onChange={handleChange} className={inputClasses}>
                      <option value="">Select State</option>
                      {statesList.map(s => {
                        const val = typeof s === 'string' ? s : s.name || s.id;
                        const label = typeof s === 'string' ? s : s.name || s.id;
                        return <option key={val} value={val}>{label}</option>;
                      })}
                    </select>
                  ) : (
                    <div className={inputClasses}>{formData.state || '—'}</div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">LGA</label>
                  {isEditing ? (
                    <select name="lga" value={formData.lga} onChange={handleChange} className={inputClasses} disabled={!formData.state}>
                      <option value="">Select LGA</option>
                      {lgasList.map(l => {
                        const val = typeof l === 'string' ? l : l.name || l.id;
                        const label = typeof l === 'string' ? l : l.name || l.id;
                        return <option key={val} value={val}>{label}</option>;
                      })}
                    </select>
                  ) : (
                    <div className={inputClasses}>{formData.lga || '—'}</div>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Employment Details */}
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" /> Employment Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Occupation</label>
                  <input type="text" name="occupation" value={formData.occupation} onChange={handleChange} className={inputClasses} disabled={!isEditing} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Office Mobile</label>
                  <input type="tel" name="office_mobile" value={formData.office_mobile} onChange={handleChange} className={inputClasses} disabled={!isEditing} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Office Address</label>
                  <textarea name="office_address" rows={isEditing ? 2 : undefined} value={formData.office_address} onChange={handleChange} className={`${inputClasses} ${!isEditing ? 'h-auto py-1 resize-none' : 'resize-none'}`} disabled={!isEditing} />
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex justify-end pt-4 gap-3 border-t border-slate-100 mt-8">
                <button 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-5 py-2.5 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors flex items-center gap-2 disabled:opacity-70"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
