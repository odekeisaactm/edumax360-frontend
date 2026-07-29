'use client';

import { useRouter, useParams } from 'next/navigation';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  staffAPI,
  hrSettingsAPI,
  departmentsAPI,
  positionsAPI,
  customFieldsAPI,
  utilityAPI,
  groupsAPI,
} from '@/lib/api';
import {
  HRSettings,
  Department,
  Position,
  CustomStaffField,
  Bank,
} from '@/lib/types';
import {
  Users, ArrowLeft, Save, X, AlertCircle, Loader2,
  Upload, Camera, MapPin, Phone, Mail,
  Briefcase, Building2, CreditCard, Heart, Check,
  ChevronDown, ChevronUp, User, Shield, AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface StaffFormState {
  title: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  mobile: string;
  address: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  marital_status: 'single' | 'married' | 'divorced' | 'widowed' | '';
  religion: 'christianity' | 'islam' | 'traditional' | 'other' | '';
  state: string;
  lga: string;
  blood_group: string;
  genotype: string;
  medical_conditions: string;
  staff_type: 'academic' | 'non_academic' | 'both';
  status: 'active' | 'inactive' | 'on_leave' | 'suspended' | 'terminated';
  department: number | null;
  position: number | null;
  employment_date: string;
  group: number | null;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  extra_fields: Record<string, any>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
  }
  return err?.message || 'An unexpected error occurred.';
}

function toStr(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function toNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─── Style constants ─────────────────────────────────────────────────────────────
const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Section Accordion ───────────────────────────────────────────────────────────
function Section({
  id, title, icon: Icon, iconGradient, subtitle, children, open, onToggle, required = false,
}: {
  id: string; title: string; icon: any; iconGradient: string;
  subtitle?: string; children: React.ReactNode;
  open: boolean; onToggle: (id: string) => void; required?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3.5 px-5 py-4 hover:bg-slate-50/60 transition-colors text-left group"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${iconGradient} shadow-sm`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            {required && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                Required
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <div className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${open ? 'bg-slate-100 text-slate-600' : 'text-slate-300 group-hover:text-slate-400'}`}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-50 px-5 pt-5 pb-6">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Custom Field Renderer ───────────────────────────────────────────────────────
function CustomFieldInput({ field, value, onChange }: {
  field: CustomStaffField; value: any; onChange: (v: any) => void;
}) {
  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)}
          required={field.is_required} rows={3} placeholder={field.description ?? ''}
          className={inputCls + ' resize-none'} />
      );
    case 'select':
      return (
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          required={field.is_required} className={inputCls + ' cursor-pointer'}>
          <option value="">Select an option</option>
          {field.choices?.map((c, i) => <option key={i} value={c}>{c}</option>)}
        </select>
      );
    case 'checkbox':
      return (
        <button type="button" onClick={() => onChange(!value)}
          className="flex items-center gap-2.5 group mt-1">
          <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
            value ? 'bg-blue-600 border-blue-600 shadow-sm' : 'border-slate-300 bg-white group-hover:border-blue-400'
          }`}>
            {value && <Check className="h-3 w-3 text-white" />}
          </div>
          <span className="text-sm text-slate-600">{field.description || 'Yes'}</span>
        </button>
      );
    case 'number':
      return (
        <input type="number" value={value || ''} onChange={e => onChange(e.target.value)}
          required={field.is_required} placeholder={field.description ?? ''} className={inputCls} />
      );
    case 'date':
      return (
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
          required={field.is_required} className={inputCls} />
      );
    default:
      return (
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
          required={field.is_required} placeholder={field.description ?? ''} className={inputCls} />
      );
  }
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function StaffEditPage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const staffId = Number(params?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const STAFF_INDEX = '/dashboard/staff/staff';

  const canEdit = user?.is_superuser || hasPermission('human_resource.change_staffmodel');

  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [staffName, setStaffName]     = useState('');

  const [hrSettings, setHRSettings]     = useState<HRSettings | null>(null);
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [customFields, setCustomFields] = useState<CustomStaffField[]>([]);
  const [states, setStates]             = useState<string[]>([]);
  const [lgas, setLgas]                 = useState<string[]>([]);
  const [banks, setBanks]               = useState<Bank[]>([]);
  const [groups, setGroups]             = useState<any[]>([]);

  const [imagePreview, setImagePreview]     = useState<string | null>(null);
  const [imageFile, setImageFile]           = useState<File | null>(null);
  const [imageError, setImageError]         = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);

  const [open, setOpen] = useState<Record<string, boolean>>({
    basic: true, contact: true, employment: true,
    personal: false, banking: false, medical: false, custom: false,
  });
  const toggle = (id: string) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

  const [form, setForm] = useState<StaffFormState>({
    title: '', first_name: '', middle_name: '', last_name: '',
    email: '', mobile: '', address: '',
    date_of_birth: '', gender: 'male', marital_status: '', religion: '',
    state: '', lga: '',
    blood_group: '', genotype: '', medical_conditions: '',
    staff_type: 'academic', status: 'active', department: null, position: null,
    employment_date: '', group: null,
    bank_name: '', bank_code: '', account_number: '', account_name: '',
    extra_fields: {},
  });

  const set = <K extends keyof StaffFormState>(key: K, val: StaffFormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const filteredPositions = form.department
    ? allPositions.filter(p => {
        const dv = (p as any).department ?? (p as any).department_id;
        return dv === form.department;
      })
    : [];

  // ── Fetch staff + reference data ──
  useEffect(() => {
    if (!canEdit || !staffId) return;
    const toArr = (d: any) => d?.results ?? d?.data ?? (Array.isArray(d) ? d : []);

    Promise.all([
      staffAPI.get(staffId),
      hrSettingsAPI.get(),
      departmentsAPI.list(),
      positionsAPI.list(),
      customFieldsAPI.list(),
      utilityAPI.getStates(),
      utilityAPI.getBanks(),
      groupsAPI.list(),
    ]).then(([staff, settings, depts, pos, fields, stateList, bankList, groupList]) => {
      // Populate reference data
      setHRSettings(settings);
      setDepartments(toArr(depts));
      setAllPositions(toArr(pos));
      setCustomFields(toArr(fields));
      setStates(Array.isArray(stateList) ? stateList : []);
setBanks(Array.isArray(bankList) ? bankList : []);
      setGroups(toArr(groupList));

      // Populate form with existing staff data
      setStaffName(staff.full_name ?? `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim());
      setForm({
        title:             toStr(staff.title),
        first_name:        toStr(staff.first_name),
        middle_name:       toStr(staff.middle_name),
        last_name:         toStr(staff.last_name),
        email:             toStr(staff.email),
        mobile:            toStr(staff.mobile),
        address:           toStr(staff.address),
        date_of_birth:     toStr(staff.date_of_birth),
        gender:            (staff.gender as 'male' | 'female') ?? 'male',
        marital_status:    (staff.marital_status ?? '') as StaffFormState['marital_status'],
        religion:          (staff.religion ?? '') as StaffFormState['religion'],
        state:             toStr(staff.state),
        lga:               toStr(staff.lga),
        blood_group:       toStr(staff.blood_group),
        genotype:          toStr(staff.genotype),
        medical_conditions: toStr(staff.medical_conditions),
        staff_type:        (staff.staff_type as StaffFormState['staff_type']) ?? 'academic',
        status:            (staff.status as StaffFormState['status']) ?? 'active',
        department:        toNum(typeof staff.department === 'object' ? (staff.department as any)?.id : staff.department),
        position:          toNum(typeof staff.position === 'object' ? (staff.position as any)?.id : staff.position),
        employment_date:   toStr(staff.employment_date),
        group:             toNum(typeof staff.group === 'object' ? (staff.group as any)?.id : staff.group),
        bank_name:         toStr(staff.bank_name),
        bank_code:         toStr(staff.bank_code),
        account_number:    toStr(staff.account_number),
        account_name:      toStr(staff.account_name),
        extra_fields:      (staff.extra_fields && typeof staff.extra_fields === 'object') ? staff.extra_fields : {},
      });

      // Set existing image preview
      if (staff.image_url ?? staff.image) {
        setImagePreview(staff.image_url ?? staff.image ?? null);
      }
    }).catch(err => setSubmitError(extractError(err)))
      .finally(() => setLoading(false));
  }, [canEdit, staffId]);

  // ── LGAs ──
  useEffect(() => {
    if (!form.state) { setLgas([]); return; }
    utilityAPI.getLGAs(form.state)
      .then((d: any) => setLgas(Array.isArray(d) ? d : d?.data ?? []))
      .catch(() => {});
  }, [form.state]);

  // ── Image ──
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type)) {
      setImageError('Only JPEG, PNG or GIF allowed'); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError('Max file size is 2MB'); return;
    }
    setImageFile(file);
    setRemoveExistingImage(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setRemoveExistingImage(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = new window.FormData();
      (Object.entries(form) as [keyof StaffFormState, any][]).forEach(([k, v]) => {
        if (k === 'extra_fields') return;
        if (v !== null && v !== undefined) payload.append(k, String(v ?? ''));
      });
      if (Object.keys(form.extra_fields).length > 0)
        payload.append('extra_fields', JSON.stringify(form.extra_fields));
      if (imageFile) {
        payload.append('image', imageFile);
      } else if (removeExistingImage) {
        payload.append('image', ''); // signal backend to clear the image
      }

      await staffAPI.update(staffId, payload);
      router.push(`${STAFF_INDEX}/${staffId}`);
    } catch (err) {
      setSubmitError(extractError(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Guards ──
  if (!canEdit) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="font-bold text-slate-800 mb-1">Access Denied</h3>
        <p className="text-sm text-slate-400">You don't have permission to edit staff.</p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-400">Loading staff data...</p>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-28">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button type="button"
          onClick={() => router.push(`${STAFF_INDEX}/${staffId}`)}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Users className="h-5 w-5 text-white" />
            </div>
            Edit Staff Member
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12 truncate">
            {staffName || 'Loading...'}
          </p>
        </div>
      </div>

      {/* ── Submit Error ── */}
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700 mb-0.5">Could not update staff member</p>
            <p className="text-sm text-red-600 whitespace-pre-line leading-relaxed">{submitError}</p>
          </div>
          <button type="button" onClick={() => setSubmitError(null)}
            className="text-red-400 hover:text-red-600 flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Profile Photo ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-sm">
            <Camera className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Profile Photo</p>
            <p className="text-xs text-slate-400">Optional · JPEG, PNG or GIF · Max 2MB</p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Preview"
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 shadow-sm" />
                <button type="button" onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-sm transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1">
                <Camera className="h-6 w-6 text-slate-300" />
                <span className="text-[10px] text-slate-300 font-medium">No photo</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
              <Upload className="h-3.5 w-3.5" />
              {imagePreview ? 'Change Photo' : 'Upload Photo'}
            </button>
            {imageError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" /> {imageError}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION: Basic Information ── */}
      <Section id="basic" title="Basic Information" icon={User}
        iconGradient="from-blue-500 to-blue-600"
        subtitle="Name, staff type and employment date"
        open={open.basic} onToggle={toggle} required>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Title</label>
            <select value={form.title} onChange={e => set('title', e.target.value)}
              className={inputCls + ' cursor-pointer'}>
              <option value="">Select title</option>
              {['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              First Name <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <input required type="text" value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              placeholder="e.g. Amara" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Middle Name</label>
            <input type="text" value={form.middle_name}
              onChange={e => set('middle_name', e.target.value)}
              placeholder="Optional" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>
              Last Name <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <input required type="text" value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              placeholder="e.g. Okonkwo" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>
              Staff Type <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <select required value={form.staff_type}
              onChange={e => set('staff_type', e.target.value as StaffFormState['staff_type'])}
              className={inputCls + ' cursor-pointer'}>
              <option value="academic">Academic</option>
              <option value="non_academic">Non-Academic</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Employment Date</label>
            <input type="date" value={form.employment_date}
              onChange={e => set('employment_date', e.target.value)}
              className={inputCls} />
          </div>
          <div>
              <label className={labelCls}>
                Status <span className="text-red-400 normal-case font-normal">*</span>
              </label>
              <select required value={form.status}
                onChange={e => set('status', e.target.value as StaffFormState['status'])}
                className={inputCls + ' cursor-pointer'}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
                <option value="suspended">Suspended</option>
                <option value="terminated">Terminated</option>
              </select>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Contact Information ── */}
      <Section id="contact" title="Contact Information" icon={Phone}
        iconGradient="from-teal-500 to-cyan-600"
        subtitle="Email, phone number and address"
        open={open.contact} onToggle={toggle}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              <Mail className="inline h-3 w-3 mr-1 mb-0.5" />Email Address
            </label>
            <input type="email" value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="staff@school.edu.ng" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>
              <Phone className="inline h-3 w-3 mr-1 mb-0.5" />Mobile Number
            </label>
            <input type="tel" value={form.mobile}
              onChange={e => set('mobile', e.target.value)}
              placeholder="+2348000000000" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>
              <MapPin className="inline h-3 w-3 mr-1 mb-0.5" />Address
            </label>
            <textarea value={form.address}
              onChange={e => set('address', e.target.value)}
              rows={3} placeholder="Street, City, State..."
              className={inputCls + ' resize-none'} />
          </div>
        </div>
      </Section>

      {/* ── SECTION: Employment ── */}
      <Section id="employment" title="Employment" icon={Briefcase}
        iconGradient="from-violet-500 to-purple-600"
        subtitle="Department, position, gender and access group"
        open={open.employment} onToggle={toggle}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              <Building2 className="inline h-3 w-3 mr-1 mb-0.5" />Department
            </label>
            <select value={form.department ?? ''}
              onChange={e => {
                set('department', e.target.value ? Number(e.target.value) : null);
                set('position', null);
              }}
              className={inputCls + ' cursor-pointer'}>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              <Briefcase className="inline h-3 w-3 mr-1 mb-0.5" />Position
            </label>
            <select value={form.position ?? ''}
              onChange={e => set('position', e.target.value ? Number(e.target.value) : null)}
              className={inputCls + ' cursor-pointer'}>
              <option value="">
                {form.department
                  ? filteredPositions.length > 0 ? 'Select Position' : 'No positions in this department'
                  : 'Select department first'}
              </option>
              {filteredPositions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Gender <span className="text-red-400 normal-case font-normal">*</span>
            </label>
            <select required value={form.gender}
              onChange={e => set('gender', e.target.value as 'male' | 'female')}
              className={inputCls + ' cursor-pointer'}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              <Shield className="inline h-3 w-3 mr-1 mb-0.5" />Access Group
            </label>
            <select value={form.group ?? ''}
              onChange={e => set('group', e.target.value ? Number(e.target.value) : null)}
              className={inputCls + ' cursor-pointer'}>
              <option value="">No Group</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Personal Information ── */}
      <Section id="personal" title="Personal Information" icon={User}
        iconGradient="from-orange-400 to-amber-500"
        subtitle="Date of birth, marital status, state & LGA"
        open={open.personal} onToggle={toggle}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input type="date" value={form.date_of_birth}
              onChange={e => set('date_of_birth', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Marital Status</label>
            <select value={form.marital_status}
              onChange={e => set('marital_status', e.target.value as StaffFormState['marital_status'])}
              className={inputCls + ' cursor-pointer'}>
              <option value="">Select status</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Religion</label>
            <select value={form.religion}
              onChange={e => set('religion', e.target.value as StaffFormState['religion'])}
              className={inputCls + ' cursor-pointer'}>
              <option value="">Select religion</option>
              <option value="christianity">Christianity</option>
              <option value="islam">Islam</option>
              <option value="traditional">Traditional</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>
              <MapPin className="inline h-3 w-3 mr-1 mb-0.5" />State of Origin
            </label>
            <select value={form.state}
              onChange={e => { set('state', e.target.value); set('lga', ''); }}
              className={inputCls + ' cursor-pointer'}>
              <option value="">Select State</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Local Government Area</label>
            <select value={form.lga} onChange={e => set('lga', e.target.value)}
              disabled={!form.state}
              className={inputCls + ' cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'}>
              <option value="">{form.state ? 'Select LGA' : 'Select state first'}</option>
              {lgas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* ── SECTION: Banking (settings-gated) ── */}
      {hrSettings?.use_salary_fields && (
        <Section id="banking" title="Banking Information" icon={CreditCard}
          iconGradient="from-emerald-500 to-teal-600"
          subtitle="Bank, account number and account name"
          open={open.banking} onToggle={toggle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Bank</label>
              <select value={form.bank_name}
                onChange={e => {
                  const bank = banks.find(b => b.bank_name === e.target.value);
                  setForm(prev => ({ ...prev, bank_name: e.target.value, bank_code: bank?.code ?? '' }));
                }}
                className={inputCls + ' cursor-pointer'}>
                <option value="">Select Bank</option>
                {banks.map(b => <option key={b.code} value={b.bank_name}>{b.bank_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <input type="text" value={form.account_number}
                onChange={e => set('account_number', e.target.value)}
                maxLength={10} placeholder="10-digit NUBAN" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Account Name</label>
              <input type="text" value={form.account_name}
                onChange={e => set('account_name', e.target.value)}
                placeholder="Name as it appears on the account" className={inputCls} />
            </div>
          </div>
        </Section>
      )}

      {/* ── SECTION: Medical (settings-gated) ── */}
      {hrSettings?.use_health_fields && (
        <Section id="medical" title="Medical Information" icon={Heart}
          iconGradient="from-red-400 to-rose-500"
          subtitle="Blood group, genotype, medical conditions"
          open={open.medical} onToggle={toggle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Blood Group</label>
              <select value={form.blood_group} onChange={e => set('blood_group', e.target.value)}
                className={inputCls + ' cursor-pointer'}>
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Genotype</label>
              <select value={form.genotype} onChange={e => set('genotype', e.target.value)}
                className={inputCls + ' cursor-pointer'}>
                <option value="">Select</option>
                {['AA', 'AS', 'SS', 'AC'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls}>Known Medical Conditions</label>
              <textarea value={form.medical_conditions}
                onChange={e => set('medical_conditions', e.target.value)}
                rows={3} placeholder="Known conditions, allergies, medications..."
                className={inputCls + ' resize-none'} />
            </div>
          </div>
        </Section>
      )}

      {/* ── SECTION: Custom Fields ── */}
      {customFields.length > 0 && (
        <Section id="custom" title="Additional Information" icon={Users}
          iconGradient="from-slate-500 to-slate-600"
          subtitle={`${customFields.length} custom field${customFields.length !== 1 ? 's' : ''} configured for your school`}
          open={open.custom} onToggle={toggle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customFields.map(field => (
              <div key={field.id} className={field.field_type === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className={labelCls}>
                  {field.field_name}
                  {field.is_required && <span className="text-red-400 normal-case font-normal ml-1">*</span>}
                </label>
                <CustomFieldInput
                  field={field}
                  value={form.extra_fields[field.id]}
                  onChange={v => setForm(prev => ({
                    ...prev,
                    extra_fields: { ...prev.extra_fields, [field.id]: v },
                  }))}
                />
                {field.description && field.field_type !== 'checkbox' && (
                  <p className="text-xs text-slate-400 mt-1.5">{field.description}</p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Sticky Action Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg shadow-slate-900/5">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            {submitting ? (
              <span className="text-slate-400 text-xs">Saving changes, please wait...</span>
            ) : (
              <span className="text-slate-400 text-xs">
                Fields marked <span className="text-red-400 font-bold">*</span> are required
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button type="button"
              onClick={() => router.push(`${STAFF_INDEX}/${staffId}`)}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                : <><Save className="h-4 w-4" /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>

    </form>
  );
}