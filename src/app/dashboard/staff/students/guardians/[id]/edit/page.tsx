'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { parentsAPI, studentCustomFieldsAPI, utilityAPI } from '@/lib/api';
import { CustomField } from '@/lib/types';
import {
  UserCheck, ArrowLeft, ChevronDown, ChevronUp, Camera,
  AlertTriangle, AlertCircle, Check, X, Loader2,
  User, Phone, MapPin, Briefcase, SlidersHorizontal, Star,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
const PARENT_INDEX = '/dashboard/staff/students/guardians';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? (v as any[])[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Section Accordion ────────────────────────────────────────────────────────
interface SectionProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  required?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ icon, iconBg, title, subtitle, required, open, onToggle, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors text-left"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{title}</span>
            {required && (
              <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 uppercase tracking-wide">
                Required
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-slate-50">
          <div className="pt-5">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Form State ───────────────────────────────────────────────────────────────
interface FormState {
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  religion: string;
  marital_status: string;
  date_of_birth: string;
  email: string;
  mobile: string;
  address: string;
  state: string;
  lga: string;
  occupation: string;
  office_mobile: string;
  office_address: string;
}

const EMPTY_FORM: FormState = {
  first_name: '', middle_name: '', last_name: '', gender: '', religion: '',
  marital_status: '', date_of_birth: '',
  email: '', mobile: '', address: '',
  state: '', lga: '',
  occupation: '', office_mobile: '', office_address: '',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EditParentPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const params = useParams();
  const parentId = Number(params?.id);

  const canEdit = user?.is_superuser || hasPermission('student_management.change_parentmodel') || false;

  const [openSections, setOpenSections] = useState({
    basic: true,
    contact: true,
    personal: false,
    employment: false,
    additional: false,
  });

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [extraFields, setExtraFields] = useState<Record<string | number, string>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [lgas, setLgas] = useState<string[]>([]);
  const [loadingLgas, setLoadingLgas] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // ── Load parent data ──
  const loadParent = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const [parent, fields, stateList] = await Promise.all([
        parentsAPI.get(parentId),
        studentCustomFieldsAPI.list('parent'),
        utilityAPI.getStates(),
      ]);

      setForm({
        first_name:    parent.first_name    ?? '',
        middle_name:   parent.middle_name   ?? '',
        last_name:     parent.last_name     ?? '',
        gender:        parent.gender        ?? '',
        religion:      parent.religion      ?? '',
        marital_status: parent.marital_status ?? '',
        date_of_birth: parent.date_of_birth ?? '',
        email:         parent.email         ?? '',
        mobile:        parent.mobile        ?? '',
        address:       parent.address       ?? '',
        state:         parent.state         ?? '',
        lga:           parent.lga           ?? '',
        occupation:    parent.occupation    ?? '',
        office_mobile: parent.office_mobile ?? '',
        office_address: parent.office_address ?? '',
      });

      if (parent.extra_fields && typeof parent.extra_fields === 'object') {
        setExtraFields(parent.extra_fields);
      }

      if (parent.image_url) {
        setCurrentImage(parent.image_url);
        setImagePreview(parent.image_url);
      }

      setCustomFields(fields.filter((f: CustomField) => f.is_active));
      setStates(Array.isArray(stateList) ? stateList : []);
    } catch (err: any) {
      setLoadError(err?.response?.status === 404 ? 'Guardian not found.' : extractError(err));
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => { if (parentId) loadParent(); }, [parentId, loadParent]);

  // ── LGA cascade ──
  useEffect(() => {
    if (!form.state) { setLgas([]); return; }
    setLoadingLgas(true);
    utilityAPI.getLGAs(form.state).then((lgaList: string[]) => {
      setLgas(Array.isArray(lgaList) ? lgaList : []);
    }).catch(() => setLgas([])).finally(() => setLoadingLgas(false));
  }, [form.state]);

  // ── Field change ──
  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((p) => ({ ...p, [field]: undefined }));
    setSubmitError('');
  };

  // ── Image pick ──
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setSubmitError('Image must be JPEG, PNG, or GIF.'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSubmitError('Image must be under 2 MB.'); return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setSubmitError('');
    setFieldErrors({});

    if (!form.first_name.trim() || !form.last_name.trim()) {
      const errors: Partial<Record<keyof FormState, string>> = {};
      if (!form.first_name.trim()) errors.first_name = 'Required';
      if (!form.last_name.trim()) errors.last_name = 'Required';
      setFieldErrors(errors);
      setSubmitError('First name and last name are required.');
      setOpenSections((p) => ({ ...p, basic: true }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!form.gender) {
      setFieldErrors({ gender: 'Gender is required' });
      setSubmitError('Gender is required.');
      setOpenSections((p) => ({ ...p, basic: true }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { fd.append(k, v === undefined ? '' : v); });
      if (Object.keys(extraFields).length > 0) fd.append('extra_fields', JSON.stringify(extraFields));
      if (imageFile) fd.append('image', imageFile);

      await parentsAPI.update(parentId, fd);
      router.push(`${PARENT_INDEX}/${parentId}`);
    } catch (err: any) {
      setSubmitError(extractError(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Guards ──
  if (!canEdit) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 mb-6">You don't have permission to edit guardians.</p>
          <button onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-3 text-sm text-slate-400">Loading guardian details...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">{loadError}</p>
          <button onClick={() => router.push(PARENT_INDEX)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl">
            Back to Guardians
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.push(`${PARENT_INDEX}/${parentId}`)}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            Edit Guardian
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Update guardian information</p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col gap-4">

        {/* Profile Photo Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden flex items-center justify-center border-2 border-white shadow-sm">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-9 w-9 text-slate-300" />
                )}
              </div>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors border-2 border-white">
                <Camera className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Profile Photo</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">JPEG, PNG or GIF · max 2 MB</p>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                {imagePreview ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
            {imagePreview && imagePreview !== currentImage && (
              <button type="button"
                onClick={() => { setImageFile(null); setImagePreview(currentImage); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="ml-auto p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={handleImageChange} />
        </div>

        {/* 1. Basic Information */}
        <Section
          icon={<User className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
          title="Basic Information"
          subtitle="Full name, gender, religion and marital status"
          required
          open={openSections.basic}
          onToggle={() => toggleSection('basic')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>First Name <span className="text-red-500 normal-case">*</span></label>
              <input className={`${inputCls} ${fieldErrors.first_name ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                placeholder="e.g. Amaka" value={form.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)} />
              {fieldErrors.first_name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fieldErrors.first_name}</p>}
            </div>
            <div>
              <label className={labelCls}>Middle Name</label>
              <input className={inputCls} placeholder="e.g. Chioma" value={form.middle_name}
                onChange={(e) => handleChange('middle_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Last Name <span className="text-red-500 normal-case">*</span></label>
              <input className={`${inputCls} ${fieldErrors.last_name ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                placeholder="e.g. Okonkwo" value={form.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)} />
              {fieldErrors.last_name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fieldErrors.last_name}</p>}
            </div>
            <div>
              <label className={labelCls}>Gender <span className="text-red-500 normal-case">*</span></label>
              <select className={`${inputCls} ${fieldErrors.gender ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                value={form.gender} onChange={(e) => handleChange('gender', e.target.value)}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {fieldErrors.gender && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{fieldErrors.gender}</p>}
            </div>
            <div>
              <label className={labelCls}>Religion</label>
              <select className={inputCls} value={form.religion} onChange={(e) => handleChange('religion', e.target.value)}>
                <option value="">Select religion</option>
                <option value="christianity">Christianity</option>
                <option value="islam">Islam</option>
                <option value="traditional">Traditional</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Marital Status</label>
              <select className={inputCls} value={form.marital_status} onChange={(e) => handleChange('marital_status', e.target.value)}>
                <option value="">Select status</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input className={inputCls} type="date" value={form.date_of_birth}
                onChange={(e) => handleChange('date_of_birth', e.target.value)} />
            </div>
          </div>
        </Section>

        {/* 2. Contact Information */}
        <Section
          icon={<Phone className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
          title="Contact Information"
          subtitle="Email address, phone and home address"
          required
          open={openSections.contact}
          onToggle={() => toggleSection('contact')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email Address</label>
              <input className={inputCls} type="email" placeholder="e.g. amaka@example.com" value={form.email}
                onChange={(e) => handleChange('email', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Mobile Number</label>
              <input className={inputCls} type="tel" placeholder="e.g. 0801 234 5678" value={form.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Home Address</label>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Enter full home address"
                value={form.address} onChange={(e) => handleChange('address', e.target.value)} />
            </div>
          </div>
        </Section>

        {/* 3. Personal Information */}
        <Section
          icon={<MapPin className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-violet-500 to-violet-700"
          title="Personal Information"
          subtitle="State of origin and local government area"
          open={openSections.personal}
          onToggle={() => toggleSection('personal')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>State of Origin</label>
              <select className={inputCls} value={form.state} onChange={(e) => handleChange('state', e.target.value)}>
                <option value="">Select state</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>LGA</label>
              <select className={inputCls} value={form.lga} onChange={(e) => handleChange('lga', e.target.value)}
                disabled={!form.state || loadingLgas}>
                <option value="">
                  {loadingLgas ? 'Loading…' : form.state ? 'Select LGA' : 'Select state first'}
                </option>
                {lgas.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </Section>

        {/* 4. Employment Information */}
        <Section
          icon={<Briefcase className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
          title="Employment Information"
          subtitle="Occupation and work contact"
          open={openSections.employment}
          onToggle={() => toggleSection('employment')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Occupation</label>
              <input className={inputCls} placeholder="e.g. Civil Servant" value={form.occupation}
                onChange={(e) => handleChange('occupation', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Office Mobile</label>
              <input className={inputCls} type="tel" placeholder="e.g. 0801 234 5678" value={form.office_mobile}
                onChange={(e) => handleChange('office_mobile', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Office Address</label>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Enter office address"
                value={form.office_address} onChange={(e) => handleChange('office_address', e.target.value)} />
            </div>
          </div>
        </Section>

        {/* 5. Additional / Custom Fields */}
        {customFields.length > 0 && (
          <Section
            icon={<SlidersHorizontal className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-sky-500 to-sky-700"
            title="Additional Information"
            subtitle="School-configured custom fields"
            open={openSections.additional}
            onToggle={() => toggleSection('additional')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customFields.map((field) => (
                <div key={field.id} className={field.field_type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className={labelCls}>
                    {field.field_name}
                    {field.is_required && <span className="text-red-500 ml-1 normal-case">*</span>}
                  </label>
                  {field.field_type === 'text' && (
                    <input className={inputCls} placeholder={`Enter ${field.field_name.toLowerCase()}`}
                      value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))} />
                  )}
                  {field.field_type === 'number' && (
                    <input className={inputCls} type="number"
                      value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))} />
                  )}
                  {field.field_type === 'date' && (
                    <input className={inputCls} type="date"
                      value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))} />
                  )}
                  {field.field_type === 'textarea' && (
                    <textarea className={`${inputCls} resize-none`} rows={3}
                      value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))} />
                  )}
                  {field.field_type === 'select' && (
                    <select className={inputCls} value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))}>
                      <option value="">Select {field.field_name.toLowerCase()}</option>
                      {(field.choices ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {field.field_type === 'checkbox' && (
                    <select className={inputCls} value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))}>
                      <option value="">Select</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* ── Sticky Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {submitError && (
          <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-100">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600 font-medium flex-1">{submitError}</p>
            <button onClick={() => setSubmitError('')}>
              <X className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
            </button>
          </div>
        )}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <Star className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {form.first_name || form.last_name
                  ? [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ')
                  : 'Guardian'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{form.email || form.mobile || 'No contact info'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button type="button" onClick={() => router.push(`${PARENT_INDEX}/${parentId}`)} disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit}
              disabled={submitting || !form.first_name.trim() || !form.last_name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                : <><Check className="h-4 w-4" /> Save Changes</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}