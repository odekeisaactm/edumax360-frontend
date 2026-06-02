'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { parentsAPI } from '@/lib/api';
import {
  UserCheck, ArrowLeft, Edit3, Trash2, Mail, Phone, MapPin, Calendar,
  Briefcase, AlertCircle, Loader2, Shield, ChevronRight,
  X, Check, AlertTriangle, UserCircle, Key, RefreshCw, User,
  Users, ToggleLeft, ToggleRight, Eye, EyeOff, BookOpen,
  Building2, Home,
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

// ─── Constants ──────────────────────────────────────────────────────────────────
const PARENT_INDEX = '/dashboard/staff/students/guardians';
const STUDENT_INDEX = '/dashboard/staff/students';

const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  active:    { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  suspended: { label: 'Suspended', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
  inactive:  { label: 'Inactive',  dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200'   },
};

const TABS = [
  { id: 'overview',    label: 'Overview'    },
  { id: 'personal',   label: 'Personal'    },
  { id: 'employment', label: 'Employment'  },
  { id: 'wards',      label: 'Wards'       },
  { id: 'account',    label: 'Account'     },
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
function DeleteModal({ parent, wardsCount, deleting, onConfirm, onCancel }: {
  parent: any; wardsCount: number; deleting: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const hasWards = wardsCount > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${hasWards ? 'bg-amber-100' : 'bg-red-100'}`}>
          <AlertTriangle className={`h-6 w-6 ${hasWards ? 'text-amber-600' : 'text-red-600'}`} />
        </div>

        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
          {hasWards ? 'Cannot Delete Guardian' : 'Delete Guardian'}
        </h3>

        {hasWards ? (
          <>
            <p className="text-sm text-slate-500 text-center mb-5">
              <span className="font-semibold text-slate-700">"{String(parent.first_name)} {String(parent.last_name)}"</span> has{' '}
              <span className="font-bold text-amber-600">{wardsCount} registered ward{wardsCount !== 1 ? 's' : ''}</span>.
              You must reassign or delete all wards before this guardian can be removed.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 space-y-1.5">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">To delete this guardian:</p>
              <p className="text-xs text-amber-700 flex items-start gap-2"><span className="mt-0.5">1.</span> Go to each ward's profile</p>
              <p className="text-xs text-amber-700 flex items-start gap-2"><span className="mt-0.5">2.</span> Reassign them to another guardian, or delete the student record</p>
              <p className="text-xs text-amber-700 flex items-start gap-2"><span className="mt-0.5">3.</span> Return here to delete this guardian</p>
            </div>
            <button onClick={onCancel}
              className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-semibold text-slate-700 transition-colors text-sm">
              Got it
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 text-center mb-5">
              You are about to permanently delete{' '}
              <span className="font-semibold text-slate-700">"{String(parent.first_name)} {String(parent.last_name)}"</span>.
              This action cannot be undone.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 space-y-1.5">
              <p className="text-xs font-bold text-red-800 uppercase tracking-wide">What will be permanently lost:</p>
              <p className="text-xs text-red-700 flex items-center gap-2"><X className="h-3 w-3 flex-shrink-0" /> All personal and contact information</p>
              <p className="text-xs text-red-700 flex items-center gap-2"><X className="h-3 w-3 flex-shrink-0" /> Login account and portal access</p>
              <p className="text-xs text-red-700 flex items-center gap-2"><X className="h-3 w-3 flex-shrink-0" /> All custom field data</p>
              <p className="text-xs text-red-700 flex items-center gap-2"><X className="h-3 w-3 flex-shrink-0" /> Username and password history</p>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel} disabled={deleting}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm">
                Cancel
              </button>
              <button onClick={onConfirm} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Password Modal ───────────────────────────────────────────────────────────────
function PasswordModal({ parent, onSuccess, onClose }: {
  parent: any; onSuccess: (newPassword: string) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<'auto' | 'custom'>('custom');
  const [customPassword, setCustomPassword] = useState('');
  const [showUsername, setShowUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (mode === 'custom' && customPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      const payload: any = { password_type: mode };
      if (mode === 'custom') payload.custom_password = customPassword;
      const res = await parentsAPI.resetPassword(parent.id, payload);
      onSuccess(res.new_password || customPassword);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Key className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Change Password</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Setting a new password for <span className="font-semibold text-slate-700">{String(parent.first_name)} {String(parent.last_name)}</span>.
            They will need to use this to log into the parent portal.
          </p>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('custom')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                mode === 'custom'
                  ? 'bg-violet-50 border-violet-300 text-violet-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}>
              Set Manually
            </button>
            <button onClick={() => setMode('auto')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                mode === 'auto'
                  ? 'bg-violet-50 border-violet-300 text-violet-700'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}>
              Auto-Generate
            </button>
          </div>

          {mode === 'custom' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={customPassword}
                  onChange={e => setCustomPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none pr-10"
                />
                <button type="button" onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                A new password will be generated automatically based on your school's password settings and saved to the parent's account.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving || (mode === 'custom' && !customPassword)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Key className="h-4 w-4" /> Set Password</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsernameModal({ parent, onSuccess, onClose }: {
  parent: any; onSuccess: (newUsername: string) => void; onClose: () => void;
}) {
  const [username, setUsername] = useState(parent.profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!username.trim()) { setError('Username is required.'); return; }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    setSaving(true);
    try {
      const res = await parentsAPI.changeUsername(parent.id, username.trim());
      onSuccess(res.username);
    } catch (err: any) {
      setError(extractError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Edit3 className="h-3.5 w-3.5 text-white" />
            </div>
            <p className="font-bold text-slate-900 text-sm">Change Username</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">
            Changing the username for{' '}
            <span className="font-semibold text-slate-700">{String(parent)}</span>.
            They will need to use this new username to log in.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              New Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. amaka.okonkwo"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Min. 3 characters. Must be unique across all users.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving || !username.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                : <><Check className="h-4 w-4" /> Update Username</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Status Modal ──────────────────────────────────────────────────────────
function ToggleStatusModal({ parent, onConfirm, onCancel, loading }: {
  parent: any; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const isActive = parent.status === 'active';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isActive ? 'bg-orange-100' : 'bg-emerald-100'}`}>
          {isActive ? <ToggleLeft className="h-6 w-6 text-orange-600" /> : <ToggleRight className="h-6 w-6 text-emerald-600" />}
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
          {isActive ? 'Suspend Guardian' : 'Activate Guardian'}
        </h3>
        <p className="text-sm text-slate-500 text-center mb-5">
          {isActive
            ? <>Suspending <span className="font-semibold text-slate-700">"{String(parent.first_name)} {String(parent.last_name)}"</span> will disable their portal access immediately.</>
            : <>Activating <span className="font-semibold text-slate-700">"{String(parent.first_name)} {String(parent.last_name)}"</span> will restore their portal access.</>
          }
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm ${
              isActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}>
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
              : isActive ? <><ToggleLeft className="h-4 w-4" /> Suspend</> : <><ToggleRight className="h-4 w-4" /> Activate</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function ParentDetailPage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const parentId = Number(params?.id);

  const [parent, setParent]   = useState<any | null>(null);
  const [wards, setWards]     = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Modal states
  const [showDelete, setShowDelete]         = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [showToggle, setShowToggle]         = useState(false);
  const [toggling, setToggling]             = useState(false);
  const [toastMsg, setToastMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDefaultPwd, setShowDefaultPwd] = useState(false);

  // Permissions
  const canEdit   = user?.is_superuser || hasPermission('student_management.change_parentmodel');
  const canDelete = user?.is_superuser || hasPermission('student_management.delete_parentmodel');
  const canManage = user?.is_superuser || hasPermission('student_management.change_parentmodel');

  const [showUsername, setShowUsername] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

    const loadData = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const [parentData, wardsData] = await Promise.all([
      parentsAPI.get(parentId),
      parentsAPI.getWards(parentId).catch(() => []),
    ]);
    setParent(parentData);
    setWards(Array.isArray(wardsData) ? wardsData : (wardsData as any)?.data ?? []);

    // Try to load custom fields if the method exists
    try {
      // Check if the method exists before calling
      if (typeof parentsAPI.getCustomFields === 'function') {
        const cfData = await parentsAPI.getCustomFields('parent');
        const cfList = Array.isArray(cfData) ? cfData : (cfData as any)?.data ?? [];
        setCustomFields(cfList);
      } else {
        // If the method doesn't exist, just set empty array
        setCustomFields([]);
      }
    } catch (cfErr) {
      // Silently fail - custom fields are optional
      console.warn('Could not load custom fields:', cfErr);
      setCustomFields([]);
    }
  } catch (err: any) {
    setError(err?.response?.status === 404 ? 'Guardian not found.' : extractError(err));
  } finally {
    setLoading(false);
  }
}, [parentId]);

  useEffect(() => { if (parentId) loadData(); }, [parentId, loadData]);

  const handleDelete = async () => {
    if (!parent) return;
    setDeleting(true);
    try {
      await parentsAPI.delete(parent.id);
      router.push(PARENT_INDEX);
    } catch (err: any) {
      // Backend blocks if wards exist — show the modal with ward count info
      showToast('error', extractError(err));
      setShowDelete(false);
    } finally { setDeleting(false); }
  };

  const handleToggleStatus = async () => {
    if (!parent) return;
    setToggling(true);
    const newStatus = parent.status === 'active' ? 'suspended' : 'active';
    try {
      await parentsAPI.toggleStatus(parent.id, newStatus);
      setParent((p: any) => ({ ...p, status: newStatus }));
      setShowToggle(false);
      showToast('success', `Guardian ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
    } catch (err: any) {
      showToast('error', extractError(err));
    } finally { setToggling(false); }
  };

  // ── Guards ──
  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-400">Loading guardian details...</p>
      </div>
    </div>
  );

  if (error || !parent) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="font-bold text-slate-800 mb-1">Error</h3>
        <p className="text-sm text-slate-400 mb-5">{error || 'Guardian not found'}</p>
        <button onClick={() => router.push(PARENT_INDEX)}
          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold rounded-xl shadow-md">
          Back to Guardians
        </button>
      </div>
    </div>
  );

  const statusMeta  = STATUS_META[parent.status ?? ''] ?? STATUS_META.inactive;
  const fullName    = parent.full_name ?? `${parent.first_name ?? ''} ${parent.last_name ?? ''}`.trim();
  const extraFields = parent.extra_fields;
  const hasExtra    = extraFields && typeof extraFields === 'object' && Object.keys(extraFields).length > 0;
  const wardsCount  = wards.length;
  const hasProfile  = !!parent.profile;

  const tabsWithCounts = TABS.map(t => ({
    ...t,
    count: t.id === 'wards' ? wardsCount : null,
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
        <DeleteModal
          parent={parent}
          wardsCount={wardsCount}
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
      {showPassword && (
        <PasswordModal
          parent={parent}
          onSuccess={(newPwd) => {
            setParent((p: any) => ({
              ...p,
              profile: p.profile ? { ...p.profile, default_password: newPwd } : p.profile
            }));
            setShowPassword(false);
            showToast('success', 'Password updated successfully');
          }}
          onClose={() => setShowPassword(false)}
        />
      )}
      {showUsername && (
          <UsernameModal
            parent={parent}
            onSuccess={(newUsername) => {
              setParent((p: any) => ({
                ...p,
                profile: p.profile ? { ...p.profile, username: newUsername } : p.profile
              }));
              setShowUsername(false);
              showToast('success', 'Username updated successfully');
            }}
            onClose={() => setShowUsername(false)}
          />
        )}
      {showToggle && (
        <ToggleStatusModal
          parent={parent}
          onConfirm={handleToggleStatus}
          onCancel={() => setShowToggle(false)}
          loading={toggling}
        />
      )}

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(PARENT_INDEX)}
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200 flex-shrink-0">
              <UserCheck className="h-5 w-5 text-white" />
            </div>
            <span className="truncate">{fullName}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">{parent.parent_id} · Guardian</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={loadData} title="Refresh"
            className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all">
            <RefreshCw className="h-4 w-4" />
          </button>
          {canManage && (
            <button onClick={() => setShowToggle(true)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border rounded-xl transition-all ${
                parent.status === 'active'
                  ? 'border-orange-200 text-orange-600 hover:bg-orange-50'
                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
              }`}>
              {parent.status === 'active'
                ? <><ToggleLeft className="h-3.5 w-3.5" /> Suspend</>
                : <><ToggleRight className="h-3.5 w-3.5" /> Activate</>
              }
            </button>
          )}
          {canEdit && (
            <button onClick={() => router.push(`${PARENT_INDEX}/${parentId}/edit`)}
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
        <div className="h-2 bg-gradient-to-r from-blue-600 to-blue-700" />
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {parent.image_url ? (
              <img src={parent.image_url} alt={fullName}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 shadow-sm" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <UserCircle className="h-10 w-10 text-blue-300" />
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
              {parent.parent_id} {parent.gender ? `· ${parent.gender.charAt(0).toUpperCase() + parent.gender.slice(1)}` : ''}
              {parent.occupation ? ` · ${parent.occupation}` : ''}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
              {parent.email && (
                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 text-slate-400" />{parent.email}</span>
              )}
              {parent.mobile && (
                <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 text-slate-400" />{parent.mobile}</span>
              )}
              {parent.created_at && (
                <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3 text-slate-400" />Registered {fmt(parent.created_at)}</span>
              )}
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[72px]">
              <p className="text-lg font-bold text-slate-800">{wardsCount}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Wards</p>
            </div>
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[72px]">
              <p className="text-lg font-bold text-slate-800">{parent.active_wards_count ?? 0}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Active</p>
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
                <InfoCard title="Basic Information" icon={User} iconGradient="from-blue-500 to-blue-600">
                  <InfoRow label="Parent ID" value={<span className="font-mono text-xs">{parent.parent_id}</span>} />
                  <InfoRow label="Gender" value={<span className="capitalize">{parent.gender}</span>} />
                  <InfoRow label="Religion" value={<span className="capitalize">{parent.religion}</span>} />
                  <InfoRow label="Marital Status" value={<span className="capitalize">{parent.marital_status?.replace('_', ' ')}</span>} />
                  <InfoRow label="Date of Birth" value={fmt(parent.date_of_birth)} />
                </InfoCard>

                <InfoCard title="Contact" icon={Phone} iconGradient="from-teal-500 to-cyan-600">
                  <InfoRow label="Email" value={parent.email} />
                  <InfoRow label="Mobile" value={parent.mobile} />
                  <InfoRow label="Address" value={parent.address} />
                </InfoCard>

                <InfoCard title="Employment" icon={Briefcase} iconGradient="from-amber-500 to-amber-600">
                  <InfoRow label="Occupation" value={parent.occupation} />
                  <InfoRow label="Office Mobile" value={parent.office_mobile} />
                  <InfoRow label="Office Address" value={parent.office_address} />
                </InfoCard>
              </div>

              {/* Wards quick view */}
              {wardsCount > 0 && (
                <InfoCard title="Registered Wards" icon={Users} iconGradient="from-violet-500 to-purple-600">
                  <div className="pt-1 space-y-0">
                    {wards.slice(0, 3).map(ward => (
                      <button key={ward.id}
                        onClick={() => router.push(`${STUDENT_INDEX}/${ward.id}`)}
                        className="w-full flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 -mx-5 px-5 transition-colors rounded-xl">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <User className="h-3.5 w-3.5 text-violet-500" />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold text-slate-800 truncate">{ward.full_name}</p>
                          <p className="text-xs text-slate-400">{ward.registration_number}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          ward.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>{ward.status}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 flex-shrink-0" />
                      </button>
                    ))}
                    {wardsCount > 3 && (
                      <button onClick={() => setActiveTab('wards')}
                        className="w-full text-xs text-blue-600 font-semibold pt-3 pb-1 hover:text-blue-700 transition-colors text-center">
                        View all {wardsCount} wards →
                      </button>
                    )}
                  </div>
                </InfoCard>
              )}

              {/* Login account quick view */}
              {hasProfile && (
                <InfoCard title="Login Account" icon={Key} iconGradient="from-slate-500 to-slate-600">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6">
                    <InfoRow label="Username" value={<span className="font-mono text-xs">{parent.profile?.username}</span>} />
                    <InfoRow label="Portal Access" value={
                      parent.status === 'active'
                        ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold"><Check className="h-3 w-3" /> Enabled</span>
                        : <span className="text-red-600 text-xs font-semibold">Suspended</span>
                    } />
                    <InfoRow label="Default Password" value={
                      <span className="font-mono text-xs bg-slate-50 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                        {parent.profile?.default_password ?? '••••••••'}
                      </span>
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
                <InfoRow label="Email" value={parent.email} />
                <InfoRow label="Mobile" value={parent.mobile} />
                <InfoRow label="Home Address" value={parent.address} />
              </InfoCard>

              <InfoCard title="Personal Details" icon={User} iconGradient="from-orange-400 to-amber-500">
                <InfoRow label="Date of Birth" value={fmt(parent.date_of_birth)} />
                <InfoRow label="Gender" value={<span className="capitalize">{parent.gender}</span>} />
                <InfoRow label="Marital Status" value={<span className="capitalize">{parent.marital_status?.replace('_', ' ')}</span>} />
                <InfoRow label="Religion" value={<span className="capitalize">{parent.religion}</span>} />
              </InfoCard>

              <InfoCard title="Location" icon={MapPin} iconGradient="from-violet-500 to-purple-600">
                <InfoRow label="State of Origin" value={parent.state} />
                <InfoRow label="LGA" value={parent.lga} />
              </InfoCard>

              {hasExtra && (
                <InfoCard title="Additional Information" icon={BookOpen} iconGradient="from-slate-500 to-slate-600">
                  {Object.entries(extraFields).map(([fieldId, v]) => {
                    const field = customFields.find((f: any) => String(f.id) === String(fieldId));
                    const label = field?.field_name ?? `Field ${fieldId}`;
                    return <InfoRow key={fieldId} label={label} value={String(v)} />;
                  })}
                </InfoCard>
              )}
            </div>
          )}

          {/* ── EMPLOYMENT ── */}
          {activeTab === 'employment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoCard title="Work Information" icon={Briefcase} iconGradient="from-amber-500 to-amber-600">
                <InfoRow label="Occupation" value={parent.occupation} />
                <InfoRow label="Office Mobile" value={parent.office_mobile} />
              </InfoCard>
              <InfoCard title="Office Location" icon={Building2} iconGradient="from-sky-500 to-sky-700">
                <InfoRow label="Office Address" value={parent.office_address} />
              </InfoCard>
            </div>
          )}

          {/* ── WARDS ── */}
          {activeTab === 'wards' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {wardsCount} ward{wardsCount !== 1 ? 's' : ''} registered
                </p>
              </div>

              {wardsCount === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600 mb-1">No wards registered</p>
                  <p className="text-xs text-slate-400">Students linked to this guardian will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wards.map(ward => {
                    const wardStatus = ward.status === 'active'
                      ? { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
                      : { text: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' };
                    return (
                      <div key={ward.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
                          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                            {ward.image_url ? (
                              <img src={ward.image_url} alt={ward.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                                <User className="h-4 w-4 text-blue-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{ward.full_name}</p>
                            <p className="text-xs text-slate-400 font-mono">{ward.registration_number}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${wardStatus.bg} ${wardStatus.text} ${wardStatus.border}`}>
                            {ward.status?.toUpperCase()}
                          </span>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1">
                          {ward.current_class_name && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Class</p>
                              <p className="text-xs text-slate-700 font-medium mt-0.5">{ward.current_class_name}</p>
                            </div>
                          )}
                          {ward.gender && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Gender</p>
                              <p className="text-xs text-slate-700 font-medium mt-0.5 capitalize">{ward.gender}</p>
                            </div>
                          )}
                        </div>
                        <div className="px-4 pb-3">
                          <button onClick={() => router.push(`${STUDENT_INDEX}/${ward.id}`)}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
                            View Student Profile <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {activeTab === 'account' && (
          <div className="space-y-5">
            {!hasProfile ? (
              <div className="py-14 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Shield className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-600 mb-1">No login account</p>
                <p className="text-xs text-slate-400">This guardian doesn't have a portal account yet</p>
              </div>
            ) : (
              <>
                {/* Login details card */}
                <InfoCard title="Login Details" icon={Key} iconGradient="from-violet-500 to-purple-600">
                  <InfoRow label="Username" value={
                    <span className="font-mono text-xs">{parent.profile?.username}</span>
                  } />
                  <InfoRow label="Portal Status" value={
                    parent.status === 'active'
                      ? <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                          <Check className="h-3 w-3" /> Active — Can log in
                        </span>
                      : <span className="inline-flex items-center gap-1 text-red-700 text-xs font-semibold bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
                          <X className="h-3 w-3" /> Suspended — Cannot log in
                        </span>
                  } />
                  <InfoRow label="Default Password" value={
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-slate-50 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200">
                        {showDefaultPwd ? (parent.profile?.default_password ?? '—') : '••••••••'}
                      </span>
                      <button onClick={() => setShowDefaultPwd(p => !p)}
                        className="text-slate-400 hover:text-slate-600 transition-colors">
                        {showDefaultPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  } />
                </InfoCard>

                {/* Action cards */}
                {canManage && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Change username */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <Edit3 className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Change Username</p>
                          <p className="text-xs text-slate-400">Update portal login name</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                        Current: <span className="font-mono text-slate-600">{parent.profile?.username}</span>
                      </p>
                      <button onClick={() => setShowUsername(true)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 transition-all shadow-sm">
                        Change Username
                      </button>
                    </div>

                    {/* Change password */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Key className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Change Password</p>
                          <p className="text-xs text-slate-400">Set a new portal password</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                        Admin can set password directly without requiring the current one.
                      </p>
                      <button onClick={() => setShowPassword(true)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all shadow-sm">
                        Change Password
                      </button>
                    </div>

                    {/* Enable / Disable */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:col-span-2">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          parent.status === 'active'
                            ? 'bg-gradient-to-br from-orange-400 to-orange-500'
                            : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                        }`}>
                          {parent.status === 'active'
                            ? <ToggleLeft className="h-4 w-4 text-white" />
                            : <ToggleRight className="h-4 w-4 text-white" />
                          }
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {parent.status === 'active' ? 'Suspend Portal Access' : 'Restore Portal Access'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {parent.status === 'active'
                              ? 'Prevent this guardian from logging into the parent portal'
                              : 'Allow this guardian to log into the parent portal again'
                            }
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setShowToggle(true)}
                        className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-sm ${
                          parent.status === 'active'
                            ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700'
                            : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800'
                        }`}>
                        {parent.status === 'active' ? 'Suspend Guardian' : 'Activate Guardian'}
                      </button>
                    </div>

                  </div>
                )}
              </>
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}