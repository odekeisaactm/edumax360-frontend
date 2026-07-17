'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { feeAPI, studentsAPI } from '@/lib/api';
import { Discount, StudentDiscountEnrollment } from '@/lib/types';
import {
  Users, Search, ArrowLeft, X, Loader2, UserCircle,
  AlertCircle, Check, Tag, ShieldCheck, Plus, Trash2, Ban
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function fmtMoney(v: string | number) {
  return Number(v).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm transition-all animate-in slide-in-from-right-4
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
    </div>
  );
}

function ResultCard({ person, selected, onClick }: { person: any; selected: boolean; onClick: () => void; }) {
  const fullName = toTitleCase(person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim());
  const classLabel = [person.current_class_name, person.current_class_section_name].filter(Boolean).join(' · ');

  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center gap-3.5 p-3 rounded-xl border-2 text-left transition-all ${
        selected ? 'border-indigo-500 bg-indigo-50/80 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/80'
      }`}>
      <div className="flex-shrink-0">
        {person.image_url ? (
          <img src={person.image_url} alt={fullName} className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
            <UserCircle className="h-6 w-6 text-indigo-400" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${selected ? 'text-indigo-900' : 'text-slate-800'}`}>{fullName}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[11px] font-mono text-slate-400">{person.registration_number}</span>
          {classLabel && <span className="text-[11px] text-slate-400 truncate">· {classLabel}</span>}
        </div>
      </div>
    </button>
  );
}

export default function DiscountEnrollmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillStudentId = searchParams.get('student_id');
  const { hasPermission, user } = useAuth();
  const canManage = user?.is_superuser || hasPermission('fee_management.manage_fees');

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const [masterDiscounts, setMasterDiscounts] = useState<Discount[]>([]);
  const [enrollments, setEnrollments] = useState<StudentDiscountEnrollment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any | null>(null);

  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDiscountToAssign, setSelectedDiscountToAssign] = useState<string>('');
  const [revokeModal, setRevokeModal] = useState<{ open: boolean; enrollment: StudentDiscountEnrollment | null }>({ open: false, enrollment: null });

  // ── Load Master Discounts ──
  useEffect(() => {
    const loadMasters = async () => {
      try {
        const discounts = await feeAPI.getDiscounts();
        setMasterDiscounts(discounts);
      } catch (err) {
        showToast('error', extractError(err));
      }
    };
    loadMasters();
  }, []);

  // ── Pre-load student if ID is passed in URL ──
  useEffect(() => {
    if (prefillStudentId) {
      studentsAPI.get(parseInt(prefillStudentId)).then(data => {
        handleSelectStudent(data);
      }).catch(() => {
        showToast('error', 'Could not load the requested student.');
      });
    }
  }, [prefillStudentId]);

  // ── Search Debounce ──
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(() => {
      setSearchLoading(true);
      studentsAPI.list({ search: searchQuery.trim(), page_size: 15 })
        .then((data: any) => setSearchResults(Array.isArray(data?.results) ? data.results : []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  // ── Load Student Enrollments ──
  const fetchStudentEnrollments = async (studentId: number) => {
    setLoadingEnrollments(true);
    try {
      const data = await feeAPI.getDiscountEnrollments({ student: studentId, is_active: true });
      setEnrollments(data);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setLoadingEnrollments(false);
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedPerson(student);
    setSearchResults([]);
    setSearchQuery('');
    setSelectedDiscountToAssign('');
    fetchStudentEnrollments(student.id);
  };

  const clearSelection = () => {
    setSelectedPerson(null);
    setEnrollments([]);
    setSelectedDiscountToAssign('');
    router.replace('/dashboard/staff/fee/discount-enrollment');
  };

  // ── Enroll Student ──
  const handleEnroll = async () => {
    if (!selectedPerson) return;
    if (!selectedDiscountToAssign) return showToast('error', 'Please select a discount to assign.');

    setIsSubmitting(true);
    try {
      const newEnrollment = await feeAPI.createDiscountEnrollment({
        student: selectedPerson.id,
        discount: parseInt(selectedDiscountToAssign),
        is_active: true
      });
      setEnrollments(prev => [newEnrollment, ...prev]);

      // Reset & Close Modal
      setSelectedDiscountToAssign('');
      setAssignModalOpen(false);

      showToast('success', 'Student successfully enrolled in discount.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Revoke Enrollment ──
  const handleRevoke = async () => {
    if (!revokeModal.enrollment) return;
    setIsSubmitting(true);
    try {
      await feeAPI.deleteDiscountEnrollment(revokeModal.enrollment.id);
      setEnrollments(prev => prev.filter(e => e.id !== revokeModal.enrollment!.id));
      showToast('success', 'Discount revoked successfully.');
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsSubmitting(false);
      setRevokeModal({ open: false, enrollment: null });
    }
  };

  // ── Smart Filter ──
  const availableDiscounts = (() => {
    if (!selectedPerson) return [];
    const enrolledIds = enrollments.map(e => e.discount);
    let available = masterDiscounts.filter(d => !enrolledIds.includes(d.id));

    const studentClassId = Number(selectedPerson.current_class);
    available = available.filter(d => {
      if (!d.applicable_classes || d.applicable_classes.length === 0) return true;
      return d.applicable_classes.some((c: any) => {
        const targetClassId = typeof c === 'object' ? c.id : c;
        return Number(targetClassId) === studentClassId;
      });
    });
    return available;
  })();

  // ── Utility: Get Rate string ──
  const getRateForDiscount = (discountId: number) => {
    const master = masterDiscounts.find(d => d.id === discountId);
    if (!master) return null;
    return master.discount_type === 'percentage'
      ? `${master.amount}%`
      : `₦${fmtMoney(master.amount || 0)}`;
  };

  return (
    <div className="pb-20 max-w-7xl mx-auto animate-in fade-in duration-300">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.push('/dashboard/staff/fee/discount-enrollments')} className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <Tag className="h-5 w-5 text-white" />
            </div>
            Manage Student Discounts
          </h1>
          <p className="text-sm text-slate-500 mt-1 pl-14">Assign or revoke fee discounts for individual students.</p>
        </div>
      </div>

      {!selectedPerson ? (
        // ─── Search View ──
        <div className="max-w-3xl mx-auto mt-12">
          <div className="text-center mb-6">
             <h2 className="text-lg font-bold text-slate-800">Locate Student</h2>
             <p className="text-sm text-slate-500">Search for a student to manage their discounts.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name or registration number..."
              className="w-full pl-12 pr-10 py-3.5 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none bg-white shadow-sm transition-all"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-6 space-y-2 max-h-[60vh] overflow-y-auto">
            {searchLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                <span className="ml-2 text-sm text-slate-500">Searching...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map(student => (
                <ResultCard key={student.id} person={student} selected={false} onClick={() => handleSelectStudent(student)} />
              ))
            ) : searchQuery.trim().length >= 2 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">
                <UserCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-600">No students found</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        // ─── Selected Person + Action View ──
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Profile Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-4">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {selectedPerson.image_url ? (
                      <img src={selectedPerson.image_url} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-inner">
                        <UserCircle className="h-8 w-8 text-indigo-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-lg leading-tight">
                      {toTitleCase(selectedPerson.full_name || `${selectedPerson.first_name || ''} ${selectedPerson.last_name || ''}`.trim())}
                    </p>
                    <p className="text-xs font-mono font-bold text-indigo-600 mt-1">
                      {selectedPerson.registration_number}
                    </p>
                    <div className="mt-2">
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                        {[selectedPerson.current_class_name, selectedPerson.current_class_section_name].filter(Boolean).join(' · ') || 'No Class Assigned'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-2">
                  <button onClick={clearSelection} className="w-full px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2">
                    <Search className="h-4 w-4" /> Change Student
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Discounts Management */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[300px] flex flex-col">
              {/* Header with Assign Button */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" /> Active Discounts
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full ml-1">
                    {enrollments.length}
                  </span>
                </h3>
                {canManage && (
                  <button
                    onClick={() => setAssignModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Assign Discount
                  </button>
                )}
              </div>

              <div className="p-5 bg-slate-50/30 flex-1">
                {loadingEnrollments ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mb-2" />
                    <p className="text-xs font-bold uppercase tracking-wider">Loading...</p>
                  </div>
                ) : enrollments.length === 0 ? (
                  <div className="text-center text-slate-400 py-12">
                    <Tag className="h-10 w-10 mb-3 mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">No active discounts.</p>
                    <p className="text-xs mt-1">This student is billed standard rates.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {enrollments.map(e => {
                      const rate = getRateForDiscount(e.discount);
                      return (
                        <div key={e.id} className="bg-white border border-slate-200 p-4 rounded-xl flex items-center justify-between shadow-sm hover:border-emerald-200 transition-colors group">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 flex-shrink-0">
                               <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-slate-900">{e.discount_title || `Discount #${e.discount}`}</p>
                                {rate && (
                                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded border border-indigo-100">
                                    {rate}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-1">
                                Enrolled: {new Date(e.created_at || Date.now()).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                          </div>
                          {canManage && (
                            <button
                              onClick={() => setRevokeModal({ open: true, enrollment: e })}
                              className="p-2 rounded-lg text-rose-500 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 transition-colors flex-shrink-0"
                              title="Revoke Discount"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Discount Modal ── */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" /> Assign New Discount
              </h3>
              <button onClick={() => setAssignModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-sm text-slate-500 mb-5">Select a discount configuration to apply to <strong className="text-slate-800">{selectedPerson?.first_name}</strong>. Only eligible discounts are shown.</p>

              {availableDiscounts.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <p>There are no eligible, unassigned discounts available for this student's class.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableDiscounts.map(d => {
                    const isSelected = selectedDiscountToAssign === d.id.toString();
                    const rateText = d.discount_type === 'percentage' ? `${d.amount}% OFF` : `₦${fmtMoney(d.amount || 0)} OFF`;

                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDiscountToAssign(d.id.toString())}
                        className={`p-4 border-2 rounded-xl cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-300 bg-white'}`}
                      >
                        <div>
                          <p className={`font-bold text-sm ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>{d.title}</p>
                          <p className={`text-xs mt-0.5 font-medium ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`}>
                            {rateText}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-3xl">
              <button onClick={() => setAssignModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={handleEnroll} disabled={isSubmitting || !selectedDiscountToAssign} className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Enroll Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke Modal ── */}
      {revokeModal.open && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-rose-50 border border-rose-200 text-rose-600">
               <Ban className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Revoke Discount</h3>
            <p className="text-sm text-slate-500 text-center mb-6 leading-relaxed">
              Remove <strong className="text-slate-800">{revokeModal.enrollment?.discount_title}</strong> from this student? They will be billed standard rates moving forward.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRevokeModal({ open: false, enrollment: null })} className="flex-1 py-3 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleRevoke} disabled={isSubmitting} className="flex-1 py-3 bg-rose-600 text-white text-sm font-bold rounded-xl hover:bg-rose-700 flex items-center justify-center gap-2 transition-colors">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}