// src/app/dashboard/staff/students/[id]/components/tabs/GuardiansTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { studentsAPI, otherGuardiansAPI, parentsAPI } from '@/lib/api';
import { Student, Parent, OtherGuardian, Student as StudentType } from '@/lib/types';
import {
  Users, Plus, Edit, Trash2, User as UserIcon, Phone, Mail,
  ChevronRight, Loader2, X, Briefcase, MapPin, UserPlus,
  CheckCircle2, AlertTriangle, XCircle
} from 'lucide-react';

// Relationship choices matching StudentModel.RelationshipType.choices
const RELATIONSHIPS = [
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'uncle', label: 'Uncle' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
];

// Titles
const TITLES = ['Mr.', 'Mrs.', 'Miss', 'Dr.', 'Prof.', 'Alhaji', 'Chief', 'Engr.', 'Hon.'];

// ─── Toast System ──────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}

function ToastContainer({ toasts, dismissToast }: { toasts: ToastItem[]; dismissToast: (id: number) => void }) {
  if (toasts.length === 0) return null;

  const styles: Record<ToastType, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
    },
    error: {
      bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800',
      icon: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
    },
    info: {
      bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800',
      icon: <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0" />
    },
  };

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      {toasts.map(t => {
        const s = styles[t.type];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-lg ${s.bg} ${s.border} ${s.text} animate-toast-in`}
          >
            {s.icon}
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
      <style jsx global>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-toast-in {
          animation: toast-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ title, message, confirmLabel = 'Delete', loading, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Props {
  student: Student;
  parent: Parent | null;
  refreshParent: () => void;
}

export default function GuardiansTab({ student, parent, refreshParent }: Props) {
  const router = useRouter();
  const [otherGuardians, setOtherGuardians] = useState<OtherGuardian[]>([]);
  const [siblings, setSiblings] = useState<StudentType[]>([]);
  const [showGuardianModal, setShowGuardianModal] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<OtherGuardian | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<OtherGuardian | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toasts, showToast, dismissToast } = useToasts();

  useEffect(() => {
    const loadData = async () => {
      try {
        const [guards, sibs] = await Promise.all([
          otherGuardiansAPI.list(student.id),
          parent ? parentsAPI.getWards(parent.id) : []
        ]);
        // Filter out current student from siblings
        setSiblings(sibs.filter((s: any) => s.id !== student.id));
        setOtherGuardians(guards);
      } catch (e) {
        console.error(e);
        showToast('Failed to load guardian information', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id, parent]);

  const handleDeleteGuardian = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await otherGuardiansAPI.delete(deleteTarget.id);
      setOtherGuardians(prev => prev.filter(g => g.id !== deleteTarget.id));
      showToast('Guardian deleted successfully', 'success');
      setDeleteTarget(null);
    } catch (e) {
      showToast('Failed to delete guardian', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Helper to safely generate initials
  const getInitials = (first: string | undefined, last: string | undefined) => {
    const f = (first || '').charAt(0).toUpperCase();
    const l = (last || '').charAt(0).toUpperCase();
    return f + l;
  };

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} dismissToast={dismissToast} />

      {/* Primary Parent Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <Users className="h-3.5 w-3.5" />
            </div>
            Primary Guardian
          </h3>
          {parent && (
            <button
              onClick={() => router.push(`/dashboard/staff/students/guardians/${parent.id}`)}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              View Full Profile
            </button>
          )}
        </div>

        {parent ? (
          <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200 overflow-hidden">
               {parent.image_url ? <img src={parent.image_url} className="w-full h-full object-cover" /> : <UserIcon className="h-6 w-6 text-slate-400" />}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-base font-bold text-slate-900 truncate">{parent.full_name}</p>
               <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
                 {parent.mobile && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400" />{parent.mobile}</span>}
                 {parent.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400" />{parent.email}</span>}
               </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No primary parent linked to this student.
          </div>
        )}
      </div>

      {/* Other Guardians Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-sm font-bold text-slate-900">Other Guardians</h3>
          <button
            onClick={() => { setEditingGuardian(null); setShowGuardianModal(true); }}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm shadow-blue-200"
          >
            <Plus className="h-3.5 w-3.5" /> Add Guardian
          </button>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
          ) : otherGuardians.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No additional guardians added yet.
            </div>
          ) : (
            otherGuardians.map(guardian => (
              <div key={guardian.id} className="p-4 hover:bg-slate-50 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    {/* Safe Initials Generation */}
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      {getInitials(guardian.first_name, guardian.last_name)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {guardian.title && <span className="font-normal text-slate-500 mr-1">{guardian.title}</span>}
                          {guardian.first_name} {guardian.middle_name} {guardian.last_name}
                        </p>
                        {guardian.is_emergency_contact && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded border border-amber-200 uppercase">Emergency</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
                        {guardian.relationship && <span className="capitalize bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{guardian.relationship.replace('_', ' ')}</span>}
                        {guardian.mobile && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{guardian.mobile}</span>}
                        {guardian.occupation && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{guardian.occupation}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingGuardian(guardian); setShowGuardianModal(true); }}
                      className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                      title="Edit guardian"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(guardian)}
                      className="p-2 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                      title="Delete guardian"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Siblings Section */}
      {siblings.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-500" /> Siblings
          </h3>
          <div className="space-y-2">
            {siblings.map(sib => (
              <button
                key={sib.id}
                onClick={() => router.push(`/dashboard/staff/students/${sib.id}`)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden">
                    {sib.image_url ? <img src={sib.image_url} className="w-full h-full object-cover" /> : <UserIcon className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-700 transition-colors">{sib.full_name}</p>
                    <p className="text-xs text-slate-500">{sib.current_class_name || 'No Class'} · {sib.registration_number}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guardian Form Modal */}
      {showGuardianModal && (
        <GuardianFormModal
          studentId={student.id}
          guardian={editingGuardian}
          onClose={() => setShowGuardianModal(false)}
          onSave={(saved) => {
            setShowGuardianModal(false);
            if (editingGuardian) {
              setOtherGuardians(prev => prev.map(g => g.id === saved.id ? saved : g));
              showToast('Guardian updated successfully', 'success');
            } else {
              setOtherGuardians(prev => [...prev, saved]);
              showToast('Guardian added successfully', 'success');
            }
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete Guardian"
          message={`Are you sure you want to delete ${deleteTarget.first_name} ${deleteTarget.last_name}? This action cannot be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeleteGuardian}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Guardian Form Modal Component ────────────────────────────────────────────────
interface GuardianFormModalProps {
  studentId: number;
  guardian: OtherGuardian | null;
  onClose: () => void;
  onSave: (g: OtherGuardian) => void;
  onError: (message: string) => void;
}

function GuardianFormModal({ studentId, guardian, onClose, onSave, onError }: GuardianFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    relationship: 'guardian',
    email: '',
    mobile: '',
    address: '',
    occupation: '',
    is_emergency_contact: false
  });

  useEffect(() => {
    if (guardian) {
      setForm({
        title: guardian.title || '',
        first_name: guardian.first_name,
        middle_name: guardian.middle_name || '',
        last_name: guardian.last_name,
        relationship: guardian.relationship,
        email: guardian.email || '',
        mobile: guardian.mobile || '',
        address: guardian.address || '',
        occupation: guardian.occupation || '',
        is_emergency_contact: guardian.is_emergency_contact
      });
    }
  }, [guardian]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = guardian
        ? await otherGuardiansAPI.update(guardian.id, { ...form, relationship: form.relationship as OtherGuardian['relationship'] })
        : await otherGuardiansAPI.create(studentId, { ...form, relationship: form.relationship as OtherGuardian['relationship'] });
      onSave(data);
    } catch (err: any) {
      const errorDetail = err?.response?.data?.detail || err?.message || 'Failed to save guardian';
      onError(errorDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            {guardian ? 'Edit Guardian' : 'Add New Guardian'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <form id="guardian-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Title (Optional)</label>
                <select
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">Select Title</option>
                  {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">First Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="first_name"
                  value={form.first_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. John"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Middle Name</label>
                <input
                  type="text"
                  name="middle_name"
                  value={form.middle_name}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Doe"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Last Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="last_name"
                  value={form.last_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Smith"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Relationship <span className="text-red-500">*</span></label>
                <select
                  name="relationship"
                  value={form.relationship}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Mobile Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  name="mobile"
                  value={form.mobile}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0801 234 5678"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="guardian@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Occupation</label>
                <input
                  type="text"
                  name="occupation"
                  value={form.occupation}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Teacher"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Residential Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Enter full address..."
              />
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <input
                type="checkbox"
                id="is_emergency"
                name="is_emergency_contact"
                checked={form.is_emergency_contact}
                onChange={handleChange}
                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="is_emergency" className="text-sm text-amber-800 font-medium cursor-pointer">
                Mark as Emergency Contact
              </label>
            </div>
          </form>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="guardian-form"
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-blue-200"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Users className="h-4 w-4" /> Save Guardian</>}
          </button>
        </div>
      </div>
    </div>
  );
}