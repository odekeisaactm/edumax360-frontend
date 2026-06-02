'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI } from '@/lib/api';
import { Group, GroupFormValues } from '@/lib/types';
import {
  Shield, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  Loader2, RefreshCw, Users, Lock, Eye,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.details) {
      const details = d.details;
      if (details.non_field_errors?.length) return details.non_field_errors[0];
      const fields = Object.entries(details)
        .map(([, v]) => (Array.isArray(v) ? v[0] : String(v)))
        .join(' ');
      if (fields) return fields;
    }
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, group, isDeleting, onConfirm, onCancel }: {
  open: boolean; group: Group | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !group) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Group</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{group.name}"</span>?
          All staff assigned to this group will lose its permissions.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Group Form Modal ──────────────────────────────────────────────────────────
function GroupModal({ editing, isSaving, onSave, onClose }: {
  editing: Group | null;
  isSaving: boolean;
  onSave: (data: GroupFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<GroupFormValues>(
    editing ? { name: editing.name } : { name: '' }
  );
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try { await onSave(form); }
    catch (err) { setFormError(extractError(err)); }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {editing ? 'Edit Group' : 'New Group'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {formError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{formError}</span>
            <button onClick={() => setFormError(null)} className="ml-auto text-red-400 hover:text-red-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Form */}
        <form id="group-form" onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>
              Group Name <span className="text-red-400 normal-case">*</span>
            </label>
            <input
              required type="text" value={form.name}
              onChange={e => setForm({ name: e.target.value })}
              placeholder="e.g. HR Managers, Class Teachers"
              className={inputCls}
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">
              Choose a clear, descriptive name that reflects the group's responsibilities.
            </p>
          </div>

          {/* Info note */}
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
            <Lock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              After creating the group, use the <span className="font-semibold">Manage Permissions</span> button to assign what this group can access.
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="group-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Creating...'}</>
              : <><Check className="h-4 w-4" />{editing ? 'Update Group' : 'Create Group'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GroupsPage() {
  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('auth.add_group');
  const canEdit   = user?.is_superuser || hasPermission('auth.change_group');
  const canDelete = user?.is_superuser || hasPermission('auth.delete_group');
  const canManagePerms = user?.is_superuser || hasPermission('auth.change_group');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchGroups = useCallback(async () => {
    setLoading(true); setPageError(null);
    try {
      const data = await groupsAPI.list();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(extractError(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const openCreate = () => { setEditingGroup(null); setShowModal(true); };
  const openEdit = (g: Group) => { setEditingGroup(g); setShowModal(true); };

  const handleSave = async (form: GroupFormValues) => {
    setIsSaving(true);
    try {
      if (editingGroup) {
        const updated = await groupsAPI.update(editingGroup.id, form);
        setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
        showToast('success', `"${updated.name}" updated successfully`);
      } else {
        const created = await groupsAPI.create(form);
        setGroups(prev => [created, ...prev]);
        showToast('success', `"${created.name}" created successfully`);
      }
      setShowModal(false);
    } catch (err) {
      throw err;
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setIsDeleting(true);
    try {
      await groupsAPI.delete(deletingGroup.id);
      setGroups(prev => prev.filter(g => g.id !== deletingGroup.id));
      showToast('success', `"${deletingGroup.name}" deleted`);
      setDeletingGroup(null);
    } catch (err) {
      showToast('error', extractError(err));
      setDeletingGroup(null);
    } finally { setIsDeleting(false); }
  };

  const filtered = groups.filter(g =>
    (g.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPermissions = groups.reduce((sum, g) => sum + (g.permissions_count ?? 0), 0);
  const totalMembers     = groups.reduce((sum, g) => sum + (g.user_count ?? 0), 0);

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmModal
        open={!!deletingGroup} group={deletingGroup} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingGroup(null)}
      />

      {showModal && (
        <GroupModal editing={editingGroup} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} />
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Shield className="h-5 w-5 text-white" />
            </div>
            Groups
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage roles and assign permissions to groups of staff</p>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Plus className="h-4 w-4" /> Add Group
          </button>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Groups',      value: groups.length,   icon: Shield, color: 'from-blue-500 to-blue-600' },
          { label: 'Total Permissions', value: totalPermissions, icon: Lock,   color: 'from-violet-500 to-purple-600' },
          { label: 'Total Members',     value: totalMembers,    icon: Users,  color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── List Card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" placeholder="Search groups..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <button onClick={fetchGroups} title="Refresh"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* States */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading groups...</p>
          </div>
        ) : pageError ? (
          <div className="p-10 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{pageError}</p>
            <button onClick={fetchGroups} className="text-sm text-blue-600 underline inline-flex items-center gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="h-7 w-7 text-blue-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {searchTerm ? 'No groups match your search' : 'No groups yet'}
            </h3>
            <p className="text-sm text-slate-400 mb-5">
              {searchTerm ? 'Try different keywords.' : 'Create your first group to start managing staff permissions.'}
            </p>
            {!searchTerm && canCreate && (
              <button onClick={openCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                <Plus className="h-4 w-4" /> Add Group
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Permissions</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Members</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
            </div>

            <div className="divide-y divide-slate-50">
              {filtered.map(group => (
                <div key={group.id}>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                    {/* Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Shield className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{group.name}</p>
                        <p className="text-xs text-slate-400">ID #{group.id}</p>
                      </div>
                    </div>

                    {/* Permissions count */}
                    <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{group.permissions_count ?? 0}</span>
                    </div>

                    {/* Members count */}
                    <div className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{group.user_count ?? 0}</span>
                    </div>

                    {/* Actions — all in one cell */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => router.push(`/dashboard/staff/groups/${group.id}`)}
                        title="View details"
                        className="p-2 rounded-lg text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-all">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      {canManagePerms && (
                        <button
                          onClick={() => router.push(`/dashboard/staff/groups/${group.id}/permissions`)}
                          title="Manage Permissions"
                          className="p-2 rounded-lg text-purple-600 bg-purple-50 border border-purple-100 hover:bg-purple-100 transition-all">
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => openEdit(group)} title="Edit"
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeletingGroup(group)} title="Delete"
                          className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}
                        title="Quick preview"
                        className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                        {expandedId === group.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded row */}
                  {expandedId === group.id && (
                    <div className="px-5 pb-4">
                      <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100">
                        {/* Permission pills */}
                        {group.permissions && group.permissions.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                              Assigned Permissions ({group.permissions.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {group.permissions.slice(0, 20).map(p => (
                                <span key={p.id}
                                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium">
                                  {p.name}
                                </span>
                              ))}
                              {group.permissions.length > 20 && (
                                <span className="px-2.5 py-1 bg-slate-200 rounded-lg text-xs text-slate-500 font-medium">
                                  +{group.permissions.length - 20} more
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Lock className="h-4 w-4 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700">No permissions assigned</p>
                              <p className="text-xs text-slate-400">
                                Use the{' '}
                                {canManagePerms ? (
                                  <button
                                    onClick={() => router.push(`/dashboard/staff/groups/${group.id}/permissions`)}
                                    className="text-blue-600 underline font-medium">
                                    Manage Permissions
                                  </button>
                                ) : (
                                  <span className="font-medium">Manage Permissions</span>
                                )}{' '}
                                button to assign access rights to this group.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {groups.length} group{groups.length !== 1 ? 's' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}