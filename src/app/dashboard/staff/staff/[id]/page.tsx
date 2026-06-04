'use client';

import { useRouter, useParams } from 'next/navigation';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { staffAPI, hrSettingsAPI, documentsAPI, leaveAPI, customFieldsAPI } from '@/lib/api';
import { Staff, HRSettings, StaffDocument, StaffLeave } from '@/lib/types';
import {
  Users, ArrowLeft, Edit3, Trash2, Mail, Phone, MapPin, Calendar,
  Building2, Briefcase, FileText, Clock, AlertCircle, Loader2,
  Shield, CreditCard, Heart, ChevronDown, ChevronUp, Download,
  Eye, Plus, X, Upload, Check, AlertTriangle, UserCircle,
  Key, Activity, BookOpen, RefreshCw, User
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.details && typeof d.details === 'object') {
      const msgs = Object.entries(d.details)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? (v as any[])[0] : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

function fmt(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function val(v: any): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

// ─── Constants ──────────────────────────────────────────────────────────────────
const STAFF_INDEX = '/dashboard/staff/staff';

const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  active:     { label: 'Active',     dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  inactive:   { label: 'Inactive',   dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200'   },
  on_leave:   { label: 'On Leave',   dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  suspended:  { label: 'Suspended',  dot: 'bg-orange-500',  text: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200'  },
  terminated: { label: 'Terminated', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
};

const LEAVE_STATUS_META: Record<string, { label: string; text: string; bg: string; border: string }> = {
  pending:  { label: 'Pending',  text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200'  },
  approved: { label: 'Approved', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  declined: { label: 'Declined', text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200'     },
  active:   { label: 'Active',   text: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200'    },
  completed:{ label: 'Completed',text: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-200'   },
};

const TABS = [
  { id: 'overview',    label: 'Overview'    },
  { id: 'personal',   label: 'Personal'    },
  { id: 'employment', label: 'Employment'  },
  { id: 'documents',  label: 'Documents'   },
  { id: 'leave',      label: 'Leave'       },
];

// ─── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}

function InfoCard({ title, icon: Icon, iconGradient, children }: {
  title: string; icon: any; iconGradient: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${iconGradient} shadow-sm flex-shrink-0`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <p className="text-sm font-bold text-slate-900">{title}</p>
      </div>
      <div className="px-5 pb-2">{children}</div>
    </div>
  );
}

// ─── Delete Modal ────────────────────────────────────────────────────────────────
function DeleteModal({ name, deleting, onConfirm, onCancel }: {
  name: string; deleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Staff Member</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete <span className="font-semibold text-slate-700">"{name}"</span>?
          This will remove their login account and cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Decline Modal ────────────────────────────────────────────────────────────────
function DeclineModal({ onConfirm, onCancel, loading }: {
  onConfirm: (reason: string) => void; onCancel: () => void; loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Decline Leave Request</h3>
        <p className="text-xs text-slate-400 mb-4">Please provide a reason for declining this leave.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder="Enter reason..."
          className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm">
            Cancel
          </button>
          <button onClick={() => reason.trim() && onConfirm(reason.trim())} disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
            {loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Declining...</> : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document Upload Modal ────────────────────────────────────────────────────────
function DocumentUploadModal({ staffId, onSuccess, onClose }: {
  staffId: number; onSuccess: () => void; onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  const isSignature = docType === 'signature';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile) return;

    // Frontend validation for signature
    if (isSignature) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('For signatures, please upload an image (JPG, PNG, or WEBP).');
        return;
      }
      if (selectedFile.size > 2 * 1024 * 1024) {
        setError('Signature image should not exceed 2MB.');
        return;
      }
    }

    setUploading(true); setError(null);
    try {
      const fd = new window.FormData(e.currentTarget);
      fd.set('document', selectedFile);
      await documentsAPI.upload(staffId, fd as any);
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Upload className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Upload Document</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Document Type *</label>
              <select 
                name="document_type" 
                required 
                value={docType}
                onChange={e => {
                  setDocType(e.target.value);
                  setSelectedFile(null); // Clear file when type changes to avoid mismatches
                }}
                className={inputCls + ' cursor-pointer'}
              >
                <option value="">Select type</option>
                <option value="certificate">Certificate</option>
                <option value="id_card">ID Card</option>
                <option value="license">License</option>
                <option value="contract">Contract</option>
                <option value="signature">Signature</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Title *</label>
              <input type="text" name="title" required placeholder={isSignature ? "e.g. My Signature" : "e.g. Bachelor's Degree"} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              File * {isSignature ? '(JPG, PNG, WEBP)' : '(PDF, DOC, DOCX)'}
            </label>
            <input 
              ref={fileRef} 
              type="file" 
              accept={isSignature ? "image/*" : ".pdf,.doc,.docx"} 
              required
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} 
              className="hidden" 
            />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full px-3.5 py-2.5 text-sm border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              {selectedFile ? selectedFile.name : `Click to select ${isSignature ? 'signature image' : 'file'}`}
            </button>
            {selectedFile && (
              <p className="text-xs text-slate-400 mt-1">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea name="description" rows={2} placeholder="Brief description..."
              className={inputCls + ' resize-none'} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" name="issue_date" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" name="expiry_date" className={inputCls} />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={uploading}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={uploading || !selectedFile}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Upload</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Document Modal ─────────────────────────────────────────────────────────
function EditDocModal({ doc, staffId, onSuccess, onClose }: {
  doc: any; staffId: number; onSuccess: () => void; onClose: () => void;
}) {
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileRef               = useRef<HTMLInputElement>(null);
  const [form, setForm]       = useState({
    title:         doc.title         ?? '',
    document_type: doc.document_type ?? '',
    description:   doc.description   ?? '',
    issue_date:    doc.issue_date     ?? '',
    expiry_date:   doc.expiry_date    ?? '',
  });

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const isSignature = form.document_type === 'signature';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newFile && isSignature) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(newFile.type)) {
        setError('For signatures, please upload an image (JPG, PNG, or WEBP).');
        return;
      }
      if (newFile.size > 2 * 1024 * 1024) {
        setError('Signature image should not exceed 2MB.');
        return;
      }
    }

    setSaving(true); setError(null);
    try {
      let payload: any;
      if (newFile) {
        const fd = new FormData();
        fd.append('title',         form.title);
        fd.append('document_type', form.document_type);
        fd.append('description',   form.description);
        fd.append('issue_date',    form.issue_date  || '');
        fd.append('expiry_date',   form.expiry_date || '');
        fd.append('document',      newFile);
        payload = fd;
      } else {
        payload = {
          ...form,
          issue_date:  form.issue_date  || null,
          expiry_date: form.expiry_date || null,
        };
      }
      await documentsAPI.update(staffId, doc.id, payload);
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
              <Edit3 className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Edit Document</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Document Type *</label>
              <select 
                value={form.document_type} 
                onChange={e => {
                  set('document_type')(e);
                  setNewFile(null); // Clear file on type change
                }} 
                required 
                className={inputCls + ' cursor-pointer'}
              >
                <option value="">Select type</option>
                <option value="certificate">Certificate</option>
                <option value="id_card">ID Card</option>
                <option value="license">License</option>
                <option value="contract">Contract</option>
                <option value="signature">Signature</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Title *</label>
              <input type="text" value={form.title} onChange={set('title')} required placeholder={isSignature ? "e.g. My Signature" : "e.g. Bachelor's Degree"} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Brief description..."
              className={inputCls + ' resize-none'} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" value={form.issue_date} onChange={set('issue_date')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expiry Date</label>
              <input type="date" value={form.expiry_date} onChange={set('expiry_date')} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Replace File {isSignature ? '(JPG, PNG, WEBP)' : '(optional)'}
            </label>
            <input 
              ref={fileRef} 
              type="file" 
              accept={isSignature ? "image/*" : ".pdf,.doc,.docx"}
              onChange={e => setNewFile(e.target.files?.[0] ?? null)} 
              className="hidden" 
            />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full px-3.5 py-2.5 text-sm border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-amber-400 hover:text-amber-600 transition-colors flex items-center justify-center gap-2">
              <Upload className="h-4 w-4" />
              {newFile ? newFile.name : `Click to replace ${isSignature ? 'signature image' : 'file'}`}
            </button>
            {newFile && (
              <p className="text-xs text-slate-400 mt-1">{(newFile.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Leave Modal ──────────────────────────────────────────────────────────
function CreateLeaveModal({ staffId, onSuccess, onClose }: {
  staffId: number; onSuccess: () => void; onClose: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    leave_type: '', start_date: '', expected_end_date: '', reason: '',
  });

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors text-slate-800';
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setError(null);
    try {
      await leaveAPI.createForStaff(staffId, { ...form, staff: staffId });
      onSuccess();
    } catch (err) {
      setError(extractError(err));
    } finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">New Leave Request</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Leave Type *</label>
            <select required value={form.leave_type} onChange={e => setForm(p => ({ ...p, leave_type: e.target.value }))}
              className={inputCls + ' cursor-pointer'}>
              <option value="">Select type</option>
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="maternity">Maternity Leave</option>
              <option value="paternity">Paternity Leave</option>
              <option value="emergency">Emergency Leave</option>
              <option value="unpaid">Unpaid Leave</option>
              <option value="study">Study Leave</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" required value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expected End Date *</label>
              <input type="date" required value={form.expected_end_date}
                onChange={e => setForm(p => ({ ...p, expected_end_date: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Reason *</label>
            <textarea rows={3} required value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Brief reason for leave..."
              className={inputCls + ' resize-none'} />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={creating}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={creating}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200 disabled:opacity-50 flex items-center justify-center gap-2">
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Clock className="h-4 w-4" /> Submit Request</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function StaffDetailPage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const staffId = Number(params?.id);

  const [staff, setStaff]         = useState<Staff | null>(null);
  const [hrSettings, setHRSettings] = useState<HRSettings | null>(null);
  const [documents, setDocuments] = useState<StaffDocument[]>([]);
  const [leaves, setLeaves]       = useState<StaffLeave[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal states
  const [showDelete, setShowDelete]         = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [showDocUpload, setShowDocUpload]   = useState(false);
  const [showCreateLeave, setShowCreateLeave] = useState(false);
  const [showDecline, setShowDecline]       = useState<number | null>(null);
  const [deletingDoc, setDeletingDoc]       = useState<number | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<number | null>(null);
  const [editDoc, setEditDoc]               = useState<any | null>(null);
  const [actionLoading, setActionLoading]   = useState<number | null>(null);
  const [endEarlyLeave, setEndEarlyLeave]   = useState<number | null>(null);
  const [endEarlyDate, setEndEarlyDate]     = useState('');
  const [toastMsg, setToastMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Permissions
  const canEdit          = user?.is_superuser || hasPermission('human_resource.change_staffmodel');
  const canDelete        = user?.is_superuser || hasPermission('human_resource.delete_staffmodel');
  const canApproveLeave  = user?.is_superuser || hasPermission('human_resource.can_approve_leave');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [staffData, settings, docs, leavesData, cfData] = await Promise.all([
        staffAPI.get(staffId),
        hrSettingsAPI.get(),
        documentsAPI.list(staffId).catch(() => []),
        leaveAPI.listForStaff(staffId).catch(() => []),
        customFieldsAPI.list().catch(() => []),
      ]);
      setStaff(staffData);
      setHRSettings(settings);
      setDocuments(Array.isArray(docs) ? docs : (docs as any)?.data ?? []);
      const leavesArr = Array.isArray(leavesData) ? leavesData : ((leavesData as any)?.data ?? (leavesData as any)?.results ?? []);
      setLeaves(Array.isArray(leavesArr) ? leavesArr : []);
      const cfList = Array.isArray(cfData) ? cfData : (cfData as any)?.data ?? (cfData as any)?.results ?? [];
      setCustomFields(cfList);
    } catch (err: any) {
      setError(err?.response?.status === 404 ? 'Staff member not found.' : extractError(err));
    } finally { setLoading(false); }
  };

  useEffect(() => { if (staffId) loadData(); }, [staffId]);

  const handleDelete = async () => {
    if (!staff) return;
    setDeleting(true);
    try {
      await staffAPI.delete(staff.id);
      router.push(STAFF_INDEX);
    } catch (err) {
      showToast('error', extractError(err));
      setShowDelete(false);
    } finally { setDeleting(false); }
  };

  const handleApprove = async (leaveId: number) => {
    setActionLoading(leaveId);
    try {
      await leaveAPI.approve(leaveId);
      setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status: 'approved' } : l));
      showToast('success', 'Leave approved successfully');
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setActionLoading(null); }
  };

  const handleDecline = async (leaveId: number, reason: string) => {
    setActionLoading(leaveId);
    try {
      await leaveAPI.decline(leaveId, reason);
      setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status: 'declined' } : l));
      setShowDecline(null);
      showToast('success', 'Leave declined');
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setActionLoading(null); }
  };

  const handleChangeStatus = async (leaveId: number, newStatus: string, extra?: { actual_end_date?: string }) => {
    setActionLoading(leaveId);
    try {
      await leaveAPI.changeStatus(leaveId, { status: newStatus, ...extra });
      setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status: newStatus as any } : l));
      showToast('success', `Leave marked as ${newStatus}`);
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setActionLoading(null); }
  };

  const handleDeleteDoc = async (docId: number) => {
    setDeletingDoc(docId);
    try {
      await documentsAPI.delete(staffId, docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      showToast('success', 'Document deleted');
    } catch (err) {
      showToast('error', extractError(err));
    } finally { setDeletingDoc(null); }
  };

  // ── Guards ──
  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-400">Loading staff details...</p>
      </div>
    </div>
  );

  if (error || !staff) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="font-bold text-slate-800 mb-1">Error</h3>
        <p className="text-sm text-slate-400 mb-5">{error || 'Staff not found'}</p>
        <button onClick={() => router.push(STAFF_INDEX)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl shadow-md">
          Back to Staff List
        </button>
      </div>
    </div>
  );

  const statusMeta = STATUS_META[staff.status ?? ''] ?? STATUS_META.inactive;
  const fullName   = staff.full_name ?? `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim();
  const extraFields = (staff as any).extra_fields;
  const hasExtra = extraFields && typeof extraFields === 'object' && Object.keys(extraFields).length > 0;

  const tabsWithCounts = TABS.map(t => ({
    ...t,
    count: t.id === 'documents' ? documents.length : t.id === 'leave' ? leaves.length : null,
  }));

  return (
    <div className="space-y-5 pb-10">

      {/* ── Toast ── */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${toastMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {toastMsg.type === 'success'
            ? <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
            : <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
          <p className="text-sm font-medium flex-1">{toastMsg.text}</p>
          <button onClick={() => setToastMsg(null)} className="opacity-50 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showDelete && (
        <DeleteModal name={fullName} deleting={deleting} onConfirm={handleDelete} onCancel={() => setShowDelete(false)} />
      )}
      {showDecline !== null && (
        <DeclineModal
          loading={actionLoading === showDecline}
          onConfirm={reason => handleDecline(showDecline, reason)}
          onCancel={() => setShowDecline(null)}
        />
      )}
      {confirmDeleteDoc !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Delete Document</p>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">Are you sure you want to delete this document?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteDoc(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => { handleDeleteDoc(confirmDeleteDoc); setConfirmDeleteDoc(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {editDoc && (
        <EditDocModal
          doc={editDoc}
          staffId={staffId}
          onSuccess={() => {
            setEditDoc(null);
            documentsAPI.list(staffId).then((d: any) => setDocuments(Array.isArray(d) ? d : d?.data ?? []));
            showToast('success', 'Document updated');
          }}
          onClose={() => setEditDoc(null)}
        />
      )}
      {showDocUpload && (
        <DocumentUploadModal
          staffId={staffId}
          onSuccess={() => {
            setShowDocUpload(false);
            documentsAPI.list(staffId).then((d: any) => setDocuments(Array.isArray(d) ? d : d?.data ?? []));
            showToast('success', 'Document uploaded successfully');
          }}
          onClose={() => setShowDocUpload(false)}
        />
      )}
      {showCreateLeave && (
        <CreateLeaveModal
          staffId={staffId}
          onSuccess={() => {
            setShowCreateLeave(false);
            leaveAPI.listForStaff(staffId).then((d: any) => { const arr = Array.isArray(d) ? d : (d?.data ?? d?.results ?? []); setLeaves(Array.isArray(arr) ? arr : []); });
            showToast('success', 'Leave request created');
          }}
          onClose={() => setShowCreateLeave(false)}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(STAFF_INDEX)}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 flex-shrink-0">
              <Users className="h-5 w-5 text-white" />
            </div>
            <span className="truncate">{fullName}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">{staff.staff_id} · {staff.staff_type?.replace('_', ' ')}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => loadData()} title="Refresh"
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
            <RefreshCw className="h-4 w-4" />
          </button>
          {canEdit && (
            <button onClick={() => router.push(`${STAFF_INDEX}/${staffId}/edit`)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all">
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
          )}
          {canDelete && (
            <button onClick={() => setShowDelete(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-red-200 rounded-xl text-red-600 hover:bg-red-50 transition-all">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ── Profile Hero Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {staff.image_url ?? (staff as any).image ? (
              <img src={staff.image_url ?? (staff as any).image}
                alt={fullName}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 shadow-sm" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                <UserCircle className="h-10 w-10 text-indigo-300" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-slate-900">{fullName}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              {val((staff as any).position_name)} {(staff as any).department_name ? `· ${(staff as any).department_name}` : ''}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              {staff.email && (
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-400" />{staff.email}</span>
              )}
              {staff.mobile && (
                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" />{staff.mobile}</span>
              )}
              {staff.employment_date && (
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-slate-400" />Joined {fmt(staff.employment_date)}</span>
              )}
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[72px]">
              <p className="text-lg font-bold text-slate-800">{documents.length}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Documents</p>
            </div>
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[72px]">
              <p className="text-lg font-bold text-slate-800">{leaves.length}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Leaves</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {tabsWithCounts.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              {tab.label}
              {tab.count !== null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-5">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard title="Basic Information" icon={Users} iconGradient="from-blue-500 to-blue-600">
                  <InfoRow label="Staff ID" value={<span className="font-mono text-xs">{staff.staff_id}</span>} />
                  <InfoRow label="Staff Type" value={<span className="capitalize">{staff.staff_type?.replace('_', ' ')}</span>} />
                  <InfoRow label="Status" value={
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                      {statusMeta.label}
                    </span>
                  } />
                  <InfoRow label="Employment Date" value={fmt(staff.employment_date)} />
                </InfoCard>

                <InfoCard title="Contact" icon={Phone} iconGradient="from-teal-500 to-cyan-600">
                  <InfoRow label="Email" value={staff.email || '—'} />
                  <InfoRow label="Mobile" value={staff.mobile || '—'} />
                  <InfoRow label="Address" value={staff.address || '—'} />
                </InfoCard>

                <InfoCard title="Position" icon={Briefcase} iconGradient="from-violet-500 to-purple-600">
                  <InfoRow label="Department" value={(staff as any).department_name || '—'} />
                  <InfoRow label="Position" value={(staff as any).position_name || '—'} />
                  <InfoRow label="Group" value={(staff as any).group_name || '—'} />
                </InfoCard>
              </div>

              {/* Login Account */}
              {(staff as any).profile && (
                <InfoCard title="Login Account" icon={Key} iconGradient="from-slate-500 to-slate-600">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6">
                    <InfoRow label="Username" value={<span className="font-mono text-xs">{(staff as any).profile?.username}</span>} />
                    <InfoRow label="Active" value={(staff as any).profile?.is_active ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold"><Check className="h-3 w-3" /> Yes</span>
                    ) : (
                      <span className="text-red-600 text-xs font-semibold">No</span>
                    )} />
                    <InfoRow label="Password Changed" value={(staff as any).profile?.password_changed ? 'Yes' : (
                      <span className="text-amber-600 text-xs font-semibold">No (default)</span>
                    )} />
                    <InfoRow label="Default Password" value={
                      !(staff as any).profile?.password_changed
                        ? <span className="font-mono text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-200">{(staff as any).profile?.default_password}</span>
                        : <span className="text-slate-400 text-xs">Hidden</span>
                    } />
                  </div>
                </InfoCard>
              )}
            </div>
          )}

          {/* ── PERSONAL ── */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoCard title="Contact Information" icon={Phone} iconGradient="from-teal-500 to-cyan-600">
                <InfoRow label="Email" value={staff.email} />
                <InfoRow label="Mobile" value={staff.mobile} />
                <InfoRow label="Address" value={staff.address} />
                <InfoRow label="State of Origin" value={staff.state} />
                <InfoRow label="LGA" value={staff.lga} />
              </InfoCard>

              <InfoCard title="Personal Details" icon={User} iconGradient="from-orange-400 to-amber-500">
                <InfoRow label="Date of Birth" value={fmt(staff.date_of_birth)} />
                <InfoRow label="Gender" value={<span className="capitalize">{staff.gender}</span>} />
                <InfoRow label="Marital Status" value={<span className="capitalize">{staff.marital_status?.replace('_', ' ')}</span>} />
                <InfoRow label="Religion" value={<span className="capitalize">{staff.religion}</span>} />
              </InfoCard>

              {hrSettings?.use_health_fields && (
                <div className="sm:col-span-2">
                  <InfoCard title="Health Information" icon={Heart} iconGradient="from-red-400 to-rose-500">
                    <div className="grid grid-cols-3 gap-x-6">
                      <InfoRow label="Blood Group" value={staff.blood_group} />
                      <InfoRow label="Genotype" value={staff.genotype} />
                      <InfoRow label="Medical Conditions" value={staff.medical_conditions || 'None'} />
                    </div>
                  </InfoCard>
                </div>
              )}

              {hasExtra && (
                <div className="sm:col-span-2">
                  <InfoCard title="Additional Information" icon={BookOpen} iconGradient="from-slate-500 to-slate-600">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6">
                      {Object.entries(extraFields).map(([fieldId, v]) => {
                        const field = customFields.find((f: any) => String(f.id) === String(fieldId));
                        const label = field?.field_name ?? `Field ${fieldId}`;
                        return <InfoRow key={fieldId} label={label} value={String(v)} />;
                      })}
                    </div>
                  </InfoCard>
                </div>
              )}
            </div>
          )}

          {/* ── EMPLOYMENT ── */}
          {activeTab === 'employment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoCard title="Current Position" icon={Briefcase} iconGradient="from-violet-500 to-purple-600">
                <InfoRow label="Department" value={(staff as any).department_name} />
                <InfoRow label="Position" value={(staff as any).position_name} />
                <InfoRow label="Staff Type" value={<span className="capitalize">{staff.staff_type?.replace('_', ' ')}</span>} />
                <InfoRow label="Employment Date" value={fmt(staff.employment_date)} />
                <InfoRow label="Access Group" value={(staff as any).group_name} />
              </InfoCard>

              {hrSettings?.use_salary_fields && (
                <InfoCard title="Banking Information" icon={CreditCard} iconGradient="from-emerald-500 to-teal-600">
                  <InfoRow label="Bank Name" value={staff.bank_name} />
                  <InfoRow label="Account Number" value={staff.account_number} />
                  <InfoRow label="Account Name" value={staff.account_name} />
                </InfoCard>
              )}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
                <button onClick={() => setShowDocUpload(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                  <Plus className="h-3.5 w-3.5" /> Upload Document
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FileText className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600 mb-1">No documents yet</p>
                  <p className="text-xs text-slate-400">Upload certificates, contracts, or ID cards</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {documents.map(doc => (
                    <div key={doc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                      {/* Card header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <FileText className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{doc.title}</p>
                          <p className="text-xs text-slate-400 capitalize">{doc.document_type?.replace('_', ' ')}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => window.open(doc.document_url, '_blank')}
                            className="p-1.5 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={async () => {
                            try {
                              const res = await fetch(doc.document_url || '');
                              const blob = await res.blob();
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = doc.title || 'document';
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch { window.open(doc.document_url, '_blank'); }
                          }} className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all" title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditDoc(doc)}
                            className="p-1.5 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all" title="Edit">
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setConfirmDeleteDoc(doc.id)}
                            disabled={deletingDoc === doc.id}
                            className="p-1.5 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all disabled:opacity-50" title="Delete">
                            {deletingDoc === doc.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                      {/* Card body — details */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
                        {(doc as any).description && (
                          <div className="col-span-2">
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Description</p>
                            <p className="text-xs text-slate-600 mt-0.5">{(doc as any).description}</p>
                          </div>
                        )}
                        {(doc as any).issue_date && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Issued</p>
                            <p className="text-xs text-slate-700 mt-0.5">{fmt((doc as any).issue_date)}</p>
                          </div>
                        )}
                        {(doc as any).expiry_date && (
                          <div>
                            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Expires</p>
                            <p className="text-xs text-slate-700 mt-0.5">{fmt((doc as any).expiry_date)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LEAVE ── */}
          {activeTab === 'leave' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">{leaves.length} leave request{leaves.length !== 1 ? 's' : ''}</p>
                <button onClick={() => setShowCreateLeave(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-200">
                  <Plus className="h-3.5 w-3.5" /> Request Leave
                </button>
              </div>

              {leaves.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Clock className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600 mb-1">No leave requests</p>
                  <p className="text-xs text-slate-400">Leave requests for this staff will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaves.map(leave => {
                    const lMeta      = LEAVE_STATUS_META[leave.status ?? ''] ?? LEAVE_STATUS_META.pending;
                    const isPending  = leave.status === 'pending';
                    const isApproved = leave.status === 'approved';
                    const isActive   = leave.status === 'active';
                    const isActioning = actionLoading === leave.id;
                    const showingEndEarly = endEarlyLeave === leave.id;
                    return (
                      <div key={leave.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="text-sm font-bold text-slate-900 capitalize">
                                {leave.leave_type?.replace('_', ' ')} Leave
                              </p>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${lMeta.bg} ${lMeta.text} ${lMeta.border}`}>
                                {lMeta.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {fmt(leave.start_date)} → {fmt(leave.expected_end_date)}
                              </span>
                              {leave.actual_end_date && (
                                <span className="text-slate-400">Ended: {fmt(leave.actual_end_date)}</span>
                              )}
                            </div>
                            {leave.reason && (
                              <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{leave.reason}</p>
                            )}
                            {leave.status === 'declined' && (leave as any).decline_reason && (
                              <p className="text-xs text-red-500 mt-1.5 flex items-start gap-1">
                                <span className="font-semibold flex-shrink-0">Decline reason:</span>
                                <span>{(leave as any).decline_reason}</span>
                              </p>
                            )}
                          </div>

                          {canApproveLeave && (
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                              {isPending && (
                                <>
                                  <button onClick={() => handleApprove(leave.id)} disabled={isActioning}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                    {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Approve
                                  </button>
                                  <button onClick={() => setShowDecline(leave.id)} disabled={isActioning}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50">
                                    <X className="h-3 w-3" /> Decline
                                  </button>
                                </>
                              )}
                              {isApproved && (
                                <>
                                  <button onClick={() => handleChangeStatus(leave.id, 'active')} disabled={isActioning}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-50">
                                    {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Mark Active
                                  </button>
                                  <button onClick={() => handleChangeStatus(leave.id, 'cancelled')} disabled={isActioning}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">
                                    <X className="h-3 w-3" /> Cancel
                                  </button>
                                </>
                              )}
                              {isActive && (
                                <>
                                  <button onClick={() => handleChangeStatus(leave.id, 'completed')} disabled={isActioning}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors disabled:opacity-50">
                                    {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                    Complete
                                  </button>
                                  <button onClick={() => { setEndEarlyLeave(leave.id); setEndEarlyDate(''); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
                                    <Calendar className="h-3 w-3" /> End Early
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* End Early inline form */}
                        {showingEndEarly && (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-end gap-3">
                            <div className="flex-1 min-w-[160px]">
                              <label className="block text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Actual End Date</label>
                              <input type="date" value={endEarlyDate} onChange={e => setEndEarlyDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none bg-white" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setEndEarlyLeave(null)}
                                className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-white transition-colors">
                                Cancel
                              </button>
                              <button
                                onClick={() => { handleChangeStatus(leave.id, 'completed', { actual_end_date: endEarlyDate || undefined }); setEndEarlyLeave(null); }}
                                disabled={isActioning}
                                className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50">
                                Confirm
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}