// src/app/dashboard/staff/staff/[id]/components/tabs/AccountTab.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { staffAPI } from '@/lib/api';
import { Staff } from '@/lib/types';
import {
  Shield, Key, Trash2, Power, AlertTriangle,
  Lock, Check, X, Loader2, AlertCircle, Eye, EyeOff,
  ChevronRight, ToggleLeft, ToggleRight, UserPlus
} from 'lucide-react';

interface Props {
  staff: Staff;
  refreshStaff: () => void;
  onDelete: () => void;
}

// FIXED: Added extraction for 'error' field
function extractError(err: any): string {
  if (!err) return 'An unexpected error occurred.';
  if (err?.response?.data?.detail) return String(err.response.data.detail);
  if (err?.response?.data?.message) return String(err.response.data.message);
  if (err?.response?.data?.error) return String(err.response.data.error); // <--- This fixes the 400 issue

  const details = err?.response?.data?.details;
  if (details && typeof details === 'object') {
    const messages: string[] = [];
    for (const key in details) {
      const val = details[key];
      if (Array.isArray(val) && val.length > 0) {
        messages.push(`${key.replace(/_/g, ' ')}: ${val[0]}`);
      } else {
        messages.push(`${key.replace(/_/g, ' ')}: ${String(val)}`);
      }
    }
    if (messages.length > 0) return messages.join('\n');
  }

  return err?.message || 'An unexpected error occurred. Please try again.';
}

export default function AccountTab({ staff, refreshStaff, onDelete }: Props) {
  const router = useRouter();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false); // New state for Create Account

  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const resetActionState = () => {
    setActionError('');
    setSuccessMsg('');
  };

  const handleDelete = async () => {
    setLoading(true);
    resetActionState();
    try {
      await staffAPI.delete(staff.id);
      onDelete();
    } catch (err: any) {
      setActionError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setLoading(true);
    resetActionState();
    const newStatus = staff.status === 'active' ? 'suspended' : 'active';
    try {
      await staffAPI.toggleStatus(staff.id, newStatus);
      refreshStaff();
      setShowStatusModal(false);
      setSuccessMsg(`Staff ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setActionError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (password: string) => {
    setLoading(true);
    resetActionState();
    try {
      await staffAPI.resetPassword(staff.id, { password_type: 'custom', custom_password: password });
      refreshStaff();
      setShowPasswordModal(false);
      setSuccessMsg('Password updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setActionError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleChangeUsername = async () => {
    setLoading(true);
    resetActionState();
    if (!newUsername.trim()) return setActionError('Username is required');
    if (newUsername.length < 3) return setActionError('Username must be at least 3 characters');

    try {
      await staffAPI.changeUsername(staff.id, newUsername);
      refreshStaff();
      setShowUsernameModal(false);
      setSuccessMsg('Username updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setActionError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  // New Handler for Creating Account
  const handleCreateAccount = async () => {
    setLoading(true);
    resetActionState();
    try {
      await staffAPI.createAccount(staff.id, { username: newUsername, password: newPassword });
      refreshStaff();
      setShowCreateModal(false);
      setSuccessMsg('Login account created successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setActionError(extractError(err));
    } finally {
      setLoading(false);
    }
  };

  function ActionCard({ title, subtitle, icon: Icon, iconBg, onClick, color, onOpen }: any) {
    const colorClasses: Record<string, string> = {
      blue: 'border-blue-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700',
      red: 'border-red-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700',
      orange: 'border-orange-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700',
      green: 'border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700',
    };

    return (
      <button
        onClick={() => {
          if (onOpen) onOpen();
          onClick();
        }}
        className={`w-full bg-white border p-5 rounded-2xl text-left hover:shadow-md transition-all group flex items-center gap-4 ${colorClasses[color]}`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg} group-hover:scale-105 transition-transform`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex-shrink-0 text-slate-300 group-hover:text-slate-400">
           <ChevronRight className="h-5 w-5" />
        </div>
      </button>
    );
  }

  function CredentialCard({ staff }: { staff: any }) {
    const hasProfile = !!staff.profile;
    const username = staff.profile?.username;
    const password = staff.profile?.default_password;

    if (!hasProfile) {
      return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-center text-sm font-bold text-slate-900">No Login Account Created</h3>
          <p className="text-center text-sm text-slate-500 mt-1 mb-4">This staff member does not have portal access yet.</p>
          <button
            onClick={() => {
              resetActionState();
              setNewUsername('');
              setNewPassword('');
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200"
          >
            <UserPlus className="h-4 w-4" /> Create Login Account
          </button>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
            <Key className="h-3.5 w-3.5" />
          </div>
          Login Credentials
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Username</label>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-slate-800">{username || '—'}</span>
              <button
                onClick={() => {
                  resetActionState();
                  setNewUsername(staff.profile?.username || '');
                  setShowUsernameModal(true);
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
              >
                Change
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Password</label>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold text-slate-800">
                  {showPassword ? password : '•••••••••••'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => {
                    resetActionState();
                    setShowPasswordModal(true);
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">Portal Status</span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            staff.status === 'active'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}>
            {staff.status === 'active' ? <><Check className="h-3.5 w-3.5" /> Active</> : <><X className="h-3.5 w-3.5" /> Suspended</>}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top">
          <Check className="h-4 w-4" /> {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {/* Change Password */}
        <ActionCard
          title="Change Password"
          subtitle="Reset this staff member's portal login password"
          icon={Key}
          iconBg="bg-gradient-to-br from-violet-500 to-purple-700"
          onClick={() => {
            resetActionState();
            setShowPasswordModal(true);
          }}
          color="blue"
        />

        {/* Suspend/Activate */}
        <ActionCard
          title={staff.status === 'active' ? 'Suspend Account' : 'Activate Account'}
          subtitle={staff.status === 'active' ? 'Disable staff access to the portal' : 'Restore staff access to the portal'}
          icon={Power}
          iconBg={staff.status === 'active' ? 'bg-gradient-to-br from-orange-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}
          onClick={() => {
            resetActionState();
            setShowStatusModal(true);
          }}
          color={staff.status === 'active' ? 'orange' : 'green'}
        />

        {/* Delete Staff */}
        <ActionCard
          title="Delete Staff"
          subtitle="Permanently remove this staff record"
          icon={Trash2}
          iconBg="bg-gradient-to-br from-red-500 to-red-600"
          onClick={() => {
            resetActionState();
            setShowDeleteModal(true);
          }}
          color="red"
        />
      </div>

      {/* Credential Display Card */}
      <CredentialCard staff={staff} />

      {/* --- Modals --- */}

      {showCreateModal && (
        <Modal title="Create Login Account" onClose={() => { setShowCreateModal(false); resetActionState(); }}>
          <p className="text-sm text-slate-500 mb-4">
            Leave fields blank to auto-generate credentials based on HR settings.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Username (Optional)</label>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Auto-generate if blank"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Password (Optional)</label>
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Auto-generate if blank"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            {actionError && <p className="text-red-500 text-sm">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowCreateModal(false); resetActionState(); }} disabled={loading} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={handleCreateAccount} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><UserPlus className="h-4 w-4" /> Create Account</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showUsernameModal && (
        <Modal title="Change Username" onClose={() => { setShowUsernameModal(false); resetActionState(); }}>
          <p className="text-sm text-slate-500 mb-4">
            Changing the username for <span className="font-semibold text-slate-700">{staff.first_name} {staff.last_name}</span>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">New Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {actionError && <p className="text-red-500 text-sm mt-4">{actionError}</p>}
          <div className="flex gap-3 mt-6">
            <button onClick={() => { setShowUsernameModal(false); resetActionState(); }} disabled={loading} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
            <button onClick={handleChangeUsername} disabled={loading || !newUsername.trim()} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Check className="h-4 w-4" /> Update Username</>}
            </button>
          </div>
        </Modal>
      )}

      {showPasswordModal && (
        <Modal title="Change Password" onClose={() => { setShowPasswordModal(false); resetActionState(); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">New Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent outline-none"
              />
            </div>
            {actionError && <p className="text-red-500 text-sm">{actionError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowPasswordModal(false); resetActionState(); }} disabled={loading} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={() => handleResetPassword(newPassword)} disabled={loading || !newPassword} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Key className="h-4 w-4" /> Set Password</>}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showStatusModal && (
        <Modal title={staff.status === 'active' ? 'Suspend Staff?' : 'Activate Staff?'} onClose={() => { setShowStatusModal(false); resetActionState(); }}>
           <p className="text-sm text-slate-600 mb-6">
             Are you sure you want to change {staff.first_name} {staff.last_name}'s status to <strong>{staff.status === 'active' ? 'Suspended' : 'Active'}</strong>?
           </p>
           {actionError && <p className="text-red-500 text-sm mb-4">{actionError}</p>}
           <div className="flex justify-end gap-3">
             <button onClick={() => { setShowStatusModal(false); resetActionState(); }} disabled={loading} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50">Cancel</button>
             <button onClick={handleToggleStatus} disabled={loading} className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${staff.status === 'active' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
               {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : (
                 <span className="flex items-center gap-2">
                   {staff.status === 'active' ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                   {staff.status === 'active' ? 'Suspend' : 'Activate'}
                 </span>
               )}
             </button>
           </div>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal title="Delete Staff Permanently?" onClose={() => { setShowDeleteModal(false); resetActionState(); }}>
           <div className="p-4 bg-red-50 border border-red-100 rounded-xl mb-4">
             <p className="text-sm text-red-800 font-medium flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Warning</p>
             <p className="text-xs text-red-700 mt-1">This action cannot be undone. All records will be lost.</p>
           </div>
           {actionError && <p className="text-red-500 text-sm mb-4">{actionError}</p>}
           <div className="flex justify-end gap-3">
             <button onClick={() => { setShowDeleteModal(false); resetActionState(); }} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
             <button onClick={handleDelete} disabled={loading} className="px-4 py-2 text-sm text-white bg-red-600 rounded-xl hover:bg-red-700 flex items-center gap-2">
               {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Confirm Delete</>}
             </button>
           </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}