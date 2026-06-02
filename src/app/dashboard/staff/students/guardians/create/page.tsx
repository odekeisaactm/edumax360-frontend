'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { parentsAPI, studentCustomFieldsAPI, utilityAPI, studentSettingsAPI } from '@/lib/api';
import { CustomField, ParentDuplicateCheckResult } from '@/lib/types';
import {
  UserCheck, ArrowLeft, ChevronDown, ChevronUp, Camera,
  AlertTriangle, AlertCircle, Check, X, Loader2,
  User, Phone, MapPin, Briefcase, SlidersHorizontal, Star, Key,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

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

interface BackendDuplicate {
  is_duplicate: true;
  parent_id: number | null;
  parent_name: string | null;
  message: string | null;
}

function isDuplicateError(err: any): boolean {
  return err?.response?.data?.code === 'DUPLICATE_PARENT';
}

function parseDuplicateFromError(err: any): BackendDuplicate {
  const data = err?.response?.data;
  return {
    is_duplicate: true,
    parent_id: data?.details?.parent_id ?? null,
    parent_name: data?.details?.parent_name ?? null,
    message: data?.message ?? null,
  };
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
  email: string;
  mobile: string;
  address: string;
  state: string;
  lga: string;
  occupation: string;
  company_name: string;
  company_address: string;
  custom_username: string;
  custom_password: string;
}

const EMPTY_FORM: FormState = {
  first_name: '', middle_name: '', last_name: '', gender: '', religion: '',
  email: '', mobile: '', address: '',
  state: '', lga: '',
  occupation: '', company_name: '', company_address: '',
  custom_username: '',
  custom_password: '',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RegisterGuardianPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Permission
  const canCreate = user?.is_superuser || user?.permissions?.includes('student_management.add_parentmodel') || false;

  // Sections open state
  const [openSections, setOpenSections] = useState({
    basic: true,
    contact: true,
    personal: false,
    employment: false,
    additional: false,
    userform: true,
  });

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Form
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [extraFields, setExtraFields] = useState<Record<string | number, string>>({});

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reference data
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [states, setStates] = useState<string[]>([]);
  const [lgas, setLgas] = useState<string[]>([]);
  const [loadingLgas, setLoadingLgas] = useState(false);
  const showUserForm = settings?.show_user_form === true;


  // Duplicate check
  const [duplicateResult, setDuplicateResult] = useState<ParentDuplicateCheckResult | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const duplicateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitDuplicate, setSubmitDuplicate] = useState<BackendDuplicate | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // ── Load reference data ──
  useEffect(() => {
    studentCustomFieldsAPI.list('parent').then((fields: CustomField[]) => {
      setCustomFields(fields.filter((f) => f.is_active));
    }).catch(() => {});

    utilityAPI.getStates().then((stateList: string[]) => {
      setStates(Array.isArray(stateList) ? stateList : []);
    }).catch(() => {});

    studentSettingsAPI.get().then((s: any) => setSettings(s)).catch(() => {});
  }, []);

  // ── LGA cascade ──
  useEffect(() => {
    if (!form.state) { setLgas([]); return; }
    setLoadingLgas(true);
    setForm((p) => ({ ...p, lga: '' }));
    utilityAPI.getLGAs(form.state).then((lgaList: string[]) => {
      setLgas(Array.isArray(lgaList) ? lgaList : []);
    }).catch(() => setLgas([])).finally(() => setLoadingLgas(false));
  }, [form.state]);

  // ── Duplicate check ──
  const runDuplicateCheck = useCallback(async (first: string, last: string, middle: string, email: string, mobile: string) => {
    if (!first.trim() || !last.trim()) { setDuplicateResult(null); return; }
    setCheckingDuplicate(true);
    try {
      const result = await parentsAPI.checkDuplicate({ first_name: first, middle_name: middle, last_name: last, email, mobile });
      setDuplicateResult(result as ParentDuplicateCheckResult);
    } catch {
      setDuplicateResult(null);
    } finally {
      setCheckingDuplicate(false);
    }
  }, []);

  const scheduleDuplicateCheck = useCallback((f: FormState) => {
    if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
    duplicateTimerRef.current = setTimeout(() => {
      runDuplicateCheck(f.first_name, f.last_name, f.middle_name, f.email, f.mobile);
    }, 600);
  }, [runDuplicateCheck]);

  // ── Field change ──
  const handleChange = (field: keyof FormState, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };
        if (['first_name', 'last_name', 'middle_name', 'email', 'mobile'].includes(field)) {
          scheduleDuplicateCheck(next);
        }
        return next;
      });
      setFieldErrors((p) => ({ ...p, [field]: undefined })); // ← add this
      setSubmitError('');
      setSubmitDuplicate(null);
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
      setSubmitDuplicate(null);
      setFieldErrors({});

      if (!form.first_name.trim() || !form.last_name.trim()) {
        setSubmitError('First name and last name are required.');
        setFieldErrors({
          first_name: !form.first_name.trim() ? 'Required' : undefined,
          last_name: !form.last_name.trim() ? 'Required' : undefined,
        });
        setOpenSections((p) => ({ ...p, basic: true }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (!form.gender) {
        setSubmitError('Gender is required.');
        setFieldErrors({ gender: 'Gender is required' });
        setOpenSections((p) => ({ ...p, basic: true }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

       if (showUserForm) {
          if (!form.custom_username.trim()) {
            setSubmitError('Username is required.');
            setFieldErrors({ custom_username: 'Username is required' });
            setOpenSections((p) => ({ ...p, userform: true }));
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
          if (!form.custom_password.trim() || form.custom_password.trim().length < 6) {
            setSubmitError('Password must be at least 6 characters.');
            setFieldErrors({ custom_password: 'Min. 6 characters required' });
            setOpenSections((p) => ({ ...p, userform: true }));
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        }

      setSubmitting(true);
      try {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
        if (Object.keys(extraFields).length > 0) fd.append('extra_fields', JSON.stringify(extraFields));
        if (imageFile) fd.append('image', imageFile);

        const created = await parentsAPI.create(fd);
        router.push(`/dashboard/staff/students/guardians/${created.id}`);
      } catch (err: any) {
        if (isDuplicateError(err)) {
          setSubmitDuplicate(parseDuplicateFromError(err));
        } else {
          setSubmitError(extractError(err));
        }
      } finally {
        setSubmitting(false);
      }
    };

  // ── No permission ──
  if (!canCreate) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 mb-6">You don't have permission to register guardians.</p>
          <button onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            Register Guardian
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Fill in the details to register a new parent or guardian</p>
        </div>
      </div>

      {/* ── Submit Error Banner ── */}
      {submitError && (
        <div className="mb-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium flex-1">{submitError}</p>
            <button onClick={() => setSubmitError('')}>
              <X className="h-4 w-4 text-red-400 hover:text-red-600 transition-colors" />
            </button>
          </div>
        </div>
      )}

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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors border-2 border-white"
              >
                <Camera className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Profile Photo</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                JPEG, PNG or GIF · max 2 MB
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {imagePreview ? 'Change photo' : 'Upload photo'}
              </button>
            </div>
            {imagePreview && (
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="ml-auto p-2 rounded-xl hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors"
              >
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
          subtitle="Full name, gender and religion"
          required
          open={openSections.basic}
          onToggle={() => toggleSection('basic')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>First Name <span className="text-red-500 normal-case">*</span></label>
              <input className={inputCls} placeholder="e.g. Amaka" value={form.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Middle Name</label>
              <input className={inputCls} placeholder="e.g. Chioma" value={form.middle_name}
                onChange={(e) => handleChange('middle_name', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Last Name <span className="text-red-500 normal-case">*</span></label>
              <input className={inputCls} placeholder="e.g. Okonkwo" value={form.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)} />
            </div>
            <div>
                  <label className={labelCls}>Gender <span className="text-red-500 normal-case">*</span></label>
                  <select
                    className={`${inputCls} ${fieldErrors.gender ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                    value={form.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  {fieldErrors.gender && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {fieldErrors.gender}
                    </p>
                  )}
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
          subtitle="Occupation, employer and work address"
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
              <label className={labelCls}>Company / Employer Name</label>
              <input className={inputCls} placeholder="e.g. Federal Ministry of Finance" value={form.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Work Address</label>
              <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Enter employer address"
                value={form.company_address} onChange={(e) => handleChange('company_address', e.target.value)} />
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
                    <input className={inputCls} type="number" placeholder={`Enter ${field.field_name.toLowerCase()}`}
                      value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))} />
                  )}
                  {field.field_type === 'date' && (
                    <input className={inputCls} type="date"
                      value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))} />
                  )}
                  {field.field_type === 'textarea' && (
                    <textarea className={`${inputCls} resize-none`} rows={3} placeholder={`Enter ${field.field_name.toLowerCase()}`}
                      value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))} />
                  )}
                  {field.field_type === 'select' && (
                    <select className={inputCls} value={extraFields[field.id] ?? ''}
                      onChange={(e) => setExtraFields((p) => ({ ...p, [field.id]: e.target.value }))}>
                      <option value="">Select {field.field_name.toLowerCase()}</option>
                      {(field.choices ?? []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                  {field.field_type === 'boolean' && (
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

        {showUserForm && (
          <Section
            icon={<Key className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-violet-500 to-violet-700"
            title="Login Credentials"
            subtitle="Set username and password for portal access"
            required
            open={openSections.userform}
            onToggle={() => toggleSection('userform')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Username <span className="text-red-500 normal-case">*</span>
                </label>
                <input
                  className={`${inputCls} ${fieldErrors.custom_username ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                  placeholder="e.g. amaka.okonkwo"
                  value={form.custom_username}
                  onChange={(e) => handleChange('custom_username', e.target.value)}
                />
                {fieldErrors.custom_username && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.custom_username}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  Password <span className="text-red-500 normal-case">*</span>
                </label>
                <input
                  className={`${inputCls} ${fieldErrors.custom_password ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                  type="text"
                  placeholder="Min. 6 characters"
                  value={form.custom_password}
                  onChange={(e) => handleChange('custom_password', e.target.value)}
                />
                {fieldErrors.custom_password && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.custom_password}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">
                  Shown in plain text so you can record it for the parent.
                </p>
              </div>
            </div>
          </Section>
        )}
      </div>

      {/* ── Duplicate Banner (centered bottom, above sticky footer) ── */}
      {(duplicateResult?.is_duplicate || checkingDuplicate || submitDuplicate) && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
          <div className="pointer-events-auto w-full max-w-md">

            {checkingDuplicate ? (
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-lg">
                <Loader2 className="h-4 w-4 text-slate-400 animate-spin flex-shrink-0" />
                <p className="text-sm text-slate-500">Checking for duplicates…</p>
              </div>

            ) : submitDuplicate ? (
              // Backend-returned duplicate on submit — red, more urgent
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-xl shadow-red-100/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-900">Duplicate guardian found</p>
                    <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                      <span className="font-semibold">{submitDuplicate.parent_name}</span>
                      {submitDuplicate.message ? ` — ${submitDuplicate.message}` : ' already exists in the system.'}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {submitDuplicate.parent_id && (
                        <button type="button"
                          onClick={() => router.push(`/dashboard/staff/students/guardians/${submitDuplicate.parent_id}`)}
                          className="text-xs font-semibold px-3 py-1.5 bg-red-100 text-red-800 border border-red-200 rounded-lg hover:bg-red-200 transition-colors">
                          View Existing Guardian
                        </button>
                      )}
                      <button type="button"
                        onClick={() => setSubmitDuplicate(null)}
                        className="text-xs font-semibold px-3 py-1.5 bg-white text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSubmitDuplicate(null)}
                    className="text-red-400 hover:text-red-600 flex-shrink-0 p-0.5">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

            ) : duplicateResult?.is_duplicate ? (
              // Live duplicate check warning — amber, less urgent
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xl shadow-amber-100/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900">Possible duplicate found</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      <span className="font-semibold">{duplicateResult.parent_name}</span>
                      {duplicateResult.message ? ` — ${duplicateResult.message}` : ' has a similar name or contact.'}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {duplicateResult.parent_id && (
                        <button type="button"
                          onClick={() => router.push(`/dashboard/staff/students/guardians/${duplicateResult.parent_id}`)}
                          className="text-xs font-semibold px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors">
                          View Existing Guardian
                        </button>
                      )}
                      <button type="button"
                        onClick={() => setDuplicateResult(null)}
                        className="text-xs font-semibold px-3 py-1.5 bg-white text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors">
                        Ignore & Continue
                      </button>
                    </div>
                  </div>
                  <button type="button" onClick={() => setDuplicateResult(null)}
                    className="text-amber-400 hover:text-amber-600 flex-shrink-0 p-0.5">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

            ) : null}
          </div>
        </div>
      )}

      {/* ── Sticky Footer ── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">

          {/* Error strip */}
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
                {submitDuplicate ? (
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    Resolve the duplicate warning before saving
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {form.first_name || form.last_name
                        ? [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ')
                        : 'New Guardian'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{form.email || form.mobile || 'No contact info yet'}</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={submitting}
                className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !form.first_name.trim() || !form.last_name.trim() || !!submitDuplicate}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="h-4 w-4" /> Register Guardian</>
                )}
              </button>
            </div>
          </div>
        </div>

    </div>
  );
}