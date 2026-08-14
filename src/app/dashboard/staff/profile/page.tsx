'use client';

import React, { useState, useEffect, useRef } from 'react';
import { authAPI, utilityAPI } from '@/lib/api';
import { Loader2, Lock, Upload, User, CheckCircle2, XCircle, X, Edit3 } from 'lucide-react';

interface ToastItem { id: number; type: 'success' | 'error'; message: string; }
let _toastId = 0;

export default function StaffProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [statesList, setStatesList] = useState<any[]>([]);
  const [lgasList, setLgasList] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: '', first_name: '', middle_name: '', last_name: '',
    email: '', mobile: '', address: '', date_of_birth: '',
    gender: '', marital_status: '', religion: '', state: '', lga: '',
    blood_group: '', genotype: '', medical_conditions: ''
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await authAPI.getProfile();
        setProfile(data);
        setFormData({
          title: data.title || '',
          first_name: data.first_name || '',
          middle_name: data.middle_name || '',
          last_name: data.last_name || '',
          email: data.email || '',
          mobile: data.mobile || '',
          address: data.address || '',
          date_of_birth: data.date_of_birth ? data.date_of_birth.substring(0, 10) : '',
          gender: data.gender || '',
          marital_status: data.marital_status || '',
          religion: data.religion || '',
          state: data.state || '',
          lga: data.lga || '',
          blood_group: data.blood_group || '',
          genotype: data.genotype || '',
          medical_conditions: data.medical_conditions || ''
        });
        if (data.profile_image) {
          setPreviewImage(data.profile_image);
        }
      } catch (err: any) {
        showToast('error', err.message || 'Failed to load profile');
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageClick = () => {
    if (isEditing) fileInputRef.current?.click();
  };
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (selectedImage) {
        const form = new FormData();
        Object.entries(formData).forEach(([k, v]) => form.append(k, v));
        form.append('profile_image', selectedImage);
        await authAPI.updateProfile(form);
      } else {
        await authAPI.updateProfile(formData);
      }
      showToast('success', 'Profile updated successfully');
      setIsEditing(false);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const inputClasses = isEditing 
    ? "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white transition-all"
    : "w-full px-0 py-2.5 border-transparent bg-transparent text-slate-800 text-sm outline-none cursor-default font-medium disabled:opacity-100 disabled:text-slate-800";

  return (
    <div className="min-h-screen bg-slate-50 p-4 relative">
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

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2 rounded-xl font-semibold text-sm shadow-md shadow-indigo-200 transition-all flex items-center gap-2 transform hover:scale-[1.02]"
            >
              <Edit3 className="w-4 h-4" />
              Edit Profile
            </button>
          )}
        </div>
        
        {/* Read-Only Work Details */}
        <div className="bg-slate-100/80 rounded-2xl p-5 border border-slate-200 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4 text-slate-600">
            <Lock className="w-5 h-5 text-indigo-500" />
            <p className="text-sm font-medium">These details are managed by HR and cannot be changed here.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div><label className="text-xs font-bold text-slate-400 tracking-wider uppercase">Staff ID</label><div className="font-semibold text-slate-800 mt-1">{profile?.staff_id || '—'}</div></div>
            <div><label className="text-xs font-bold text-slate-400 tracking-wider uppercase">Department</label><div className="font-semibold text-slate-800 mt-1">{profile?.department || '—'}</div></div>
            <div><label className="text-xs font-bold text-slate-400 tracking-wider uppercase">Position</label><div className="font-semibold text-slate-800 mt-1">{profile?.position || '—'}</div></div>
            <div><label className="text-xs font-bold text-slate-400 tracking-wider uppercase">Employment Date</label><div className="font-semibold text-slate-800 mt-1">{profile?.employment_date ? new Date(profile.employment_date).toLocaleDateString() : '—'}</div></div>
            <div><label className="text-xs font-bold text-slate-400 tracking-wider uppercase">Staff Type</label><div className="font-semibold text-slate-800 mt-1">{profile?.staff_type || '—'}</div></div>
          </div>
        </div>

        {/* Editable Personal Details */}
        <form onSubmit={handleSubmit} className={`bg-white rounded-2xl shadow-sm border ${isEditing ? 'border-indigo-200 ring-4 ring-indigo-50' : 'border-slate-100'} p-5 sm:p-6 transition-all duration-300`}>
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            Personal Details
            {isEditing && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Editing</span>}
          </h2>

          <div className="flex flex-col md:flex-row gap-8 mb-8">
            <div className="flex flex-col items-center gap-3">
              <div 
                onClick={handleImageClick}
                className={`w-28 h-28 rounded-full bg-slate-50 border-2 ${isEditing ? 'border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer' : 'border-solid border-slate-200 cursor-default'} flex items-center justify-center overflow-hidden transition-colors group relative shadow-sm`}
              >
                {previewImage ? (
                  <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                )}
                {isEditing && (
                  <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" disabled={!isEditing} />
              {isEditing && <span className="text-xs font-semibold text-indigo-600">Click to update</span>}
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Title</label>
                {isEditing ? (
                  <select name="title" value={formData.title} onChange={handleChange} className={inputClasses}>
                    <option value="">Select Title</option>
                    {['Mr', 'Mrs', 'Miss', 'Dr', 'Prof'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <div className={inputClasses}>{formData.title || '—'}</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">First Name</label>
                <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} required disabled={!isEditing} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Middle Name</label>
                <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} disabled={!isEditing} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Last Name</label>
                <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} required disabled={!isEditing} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} required disabled={!isEditing} className={inputClasses} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Mobile</label>
                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} disabled={!isEditing} className={inputClasses} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Date of Birth</label>
              <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} disabled={!isEditing} className={inputClasses} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Gender</label>
              {isEditing ? (
                <select name="gender" value={formData.gender} onChange={handleChange} className={inputClasses}>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              ) : (
                <div className={inputClasses}>{formData.gender || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Marital Status</label>
              {isEditing ? (
                <select name="marital_status" value={formData.marital_status} onChange={handleChange} className={inputClasses}>
                  <option value="">Select Status</option>
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
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Blood Group</label>
              {isEditing ? (
                <select name="blood_group" value={formData.blood_group} onChange={handleChange} className={inputClasses}>
                  <option value="">Select Blood Group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              ) : (
                <div className={inputClasses}>{formData.blood_group || '—'}</div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Genotype</label>
              {isEditing ? (
                <select name="genotype" value={formData.genotype} onChange={handleChange} className={inputClasses}>
                  <option value="">Select Genotype</option>
                  {['AA', 'AS', 'SS', 'AC'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              ) : (
                <div className={inputClasses}>{formData.genotype || '—'}</div>
              )}
            </div>
          </div>
          
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Home Address</label>
            <textarea name="address" value={formData.address} onChange={handleChange} disabled={!isEditing} rows={isEditing ? 3 : undefined} className={`${inputClasses} ${!isEditing ? 'h-auto py-1 resize-none' : 'resize-none'}`}></textarea>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Medical Conditions (Optional)</label>
            <textarea name="medical_conditions" value={formData.medical_conditions} onChange={handleChange} disabled={!isEditing} rows={isEditing ? 2 : undefined} className={`${inputClasses} ${!isEditing ? 'h-auto py-1 resize-none' : 'resize-none'}`} placeholder={isEditing ? "List any known medical conditions..." : ""}></textarea>
          </div>

          {isEditing && (
            <div className="flex justify-end border-t border-slate-100 pt-5 gap-3">
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
                className={`bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-colors flex items-center gap-2 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
