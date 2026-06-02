'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { groupsAPI, staffAPI } from '@/lib/api';
import { Group, Staff } from '@/lib/types';
import {
  Shield, ArrowLeft, Lock, Users, Edit3, AlertCircle,
  Loader2, RefreshCw, ChevronRight, UserCircle, Building2,
  Briefcase, Circle,
} from 'lucide-react';

// ─── Import the SINGLE source of truth for permissions ────────────────────────
import { MODULES } from '@/lib/permissionsConfig';

// ─── Auto-theming (Preserving your exact styling) ─────────────────────────────
const MODULE_ICON_GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-violet-600 to-purple-600',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-purple-500',
  'from-red-500 to-orange-600',
  'from-teal-500 to-emerald-600',
];

const AREA_PALETTES = [
  { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-100',   dot: 'bg-blue-500' },
  { color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100', dot: 'bg-violet-500' },
  { color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-100',   dot: 'bg-teal-500' },
  { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-100', dot: 'bg-orange-500' },
  { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100', dot: 'bg-indigo-500' },
  { color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-100',   dot: 'bg-rose-500' },
  { color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-100',dot: 'bg-emerald-500' },
  { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-100',  dot: 'bg-amber-500' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string }> = {
  active:    { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  inactive:  { dot: 'bg-slate-400',   text: 'text-slate-500',   bg: 'bg-slate-100' },
  on_leave:  { dot: 'bg-amber-500',   text: 'text-amber-700',   bg: 'bg-amber-50' },
  suspended: { dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50' },
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const groupId = parseInt(id);

  const router = useRouter();
  const { hasPermission, user } = useAuth();

  const [group, setGroup]         = useState<Group | null>(null);
  const [staff, setStaff]         = useState<Staff[]>([]);
  const [loading, setLoading]     = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const canManagePerms = user?.is_superuser || hasPermission('auth.change_group');

  const fetchData = useCallback(async () => {
    if (isNaN(groupId)) { setPageError('Invalid group ID'); setLoading(false); return; }
    setLoading(true); setPageError(null);
    try {
      const [groupData, groupPerms, staffData] = await Promise.all([
        groupsAPI.get(groupId),
        groupsAPI.getGroupPermissions(groupId),
        staffAPI.list({ group: groupId }),
      ]);
      const permsArray = groupPerms?.data ?? groupPerms ?? [];
      setGroup({ ...groupData, permissions: Array.isArray(permsArray) ? permsArray : [] });
      const staffList = staffData?.results ?? staffData?.data ?? staffData ?? [];
      setStaff(Array.isArray(staffList) ? staffList : []);
    } catch (err: any) {
      setPageError(err?.response?.status === 404 ? 'Group not found' : extractError(err));
    } finally { setLoading(false); }
  }, [groupId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Build filtered modules — Dynamically inject styling to match original ──
  const assignedCodes = new Set((group?.permissions ?? []).map((p: any) => p.codename));

  const filteredModules = MODULES.map((mod, modIndex) => ({
    ...mod,
    iconBg: MODULE_ICON_GRADIENTS[modIndex % MODULE_ICON_GRADIENTS.length],
    areas: mod.areas
      .map((area, areaIndex) => {
        const palette = AREA_PALETTES[areaIndex % AREA_PALETTES.length];
        return {
          ...area,
          color: palette.color,
          bg: palette.bg,
          border: palette.border,
          dot: palette.dot,
          permissions: area.permissions.filter(p => assignedCodes.has(p.codename)),
        };
      })
      .filter(area => area.permissions.length > 0),
  })).filter(mod => mod.areas.length > 0);

  // ── Loading ──
  if (loading) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-2 text-sm text-slate-400">Loading group...</p>
      </div>
    </div>
  );

  // ── Error ──
  if (pageError || !group) return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-400" />
        </div>
        <h3 className="font-semibold text-slate-700 mb-1">{pageError ?? 'Something went wrong'}</h3>
        <p className="text-sm text-slate-400 mb-5">Could not load this group.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
          <button onClick={() => router.push('/dashboard/staff/groups')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors">
            Back to Groups
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/staff/groups')}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
                <Shield className="h-5 w-5 text-white" />
              </div>
              {group.name}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5 pl-12">Group detail — read only</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canManagePerms && (
            <button onClick={() => router.push(`/dashboard/staff/groups/${groupId}/permissions`)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100 transition-all">
              <Lock className="h-4 w-4" /> Manage Permissions
            </button>
          )}

        </div>
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Group ID',          value: `#${group.id}`,                         icon: Shield, color: 'from-blue-500 to-blue-600' },
          { label: 'Permissions',        value: group.permissions_count ?? assignedCodes.size, icon: Lock,   color: 'from-violet-500 to-purple-600' },
          { label: 'Staff Members',      value: staff.length,                           icon: Users,  color: 'from-orange-400 to-amber-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Permissions Panel ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-400" /> Assigned Permissions
          </h2>

          {filteredModules.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Lock className="h-6 w-6 text-amber-400" />
              </div>
              <p className="font-semibold text-slate-700 text-sm mb-1">No permissions assigned</p>
              <p className="text-xs text-slate-400 mb-4">This group has no access rights yet.</p>
              {canManagePerms && (
                <button onClick={() => router.push(`/dashboard/staff/groups/${groupId}/permissions`)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
                  <Lock className="h-3.5 w-3.5" /> Assign Permissions
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredModules.map(mod => (
                <div key={mod.key} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Module header */}
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-50">
                    <div className={`w-7 h-7 bg-gradient-to-br ${mod.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Shield className="h-3.5 w-3.5 text-white" />
                    </div>
                    <p className="font-bold text-sm text-slate-800">{mod.label}</p>
                  </div>
                  {/* Areas */}
                  <div className="p-3 space-y-2">
                    {mod.areas.map(area => (
                      <div key={area.key} className={`rounded-xl border p-3 ${area.bg} ${area.border}`}>
                        <p className={`text-xs font-bold mb-2 flex items-center gap-1.5 ${area.color}`}>
                          <span className={`w-2 h-2 rounded-full ${area.dot}`} />
                          {area.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {area.permissions.map(p => (
                            <span key={p.codename}
                              className="px-2 py-0.5 bg-white/80 border border-white rounded-lg text-[11px] text-slate-700 font-medium">
                              {p.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Staff Members Panel ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-400" /> Staff Members
            <span className="ml-auto text-xs font-semibold text-slate-400 normal-case">{staff.length} total</span>
          </h2>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {staff.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-slate-300" />
                </div>
                <p className="font-semibold text-slate-700 text-sm mb-1">No staff in this group</p>
                <p className="text-xs text-slate-400">Assign staff to this group from their profile.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {staff.map(s => {
                  const statusStyle = STATUS_STYLES[s.status] ?? STATUS_STYLES.inactive;
                  return (
                    <button key={s.id}
                      onClick={() => router.push(`/dashboard/staff/staff/${s.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors text-left group">
                      {/* Avatar */}
                      {s.image ? (
                        <img src={s.image} alt={s.full_name}
                          className="w-9 h-9 rounded-xl object-cover flex-shrink-0 border border-slate-100" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <UserCircle className="h-5 w-5 text-indigo-400" />
                        </div>
                      )}
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{s.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-slate-400 font-mono">{s.staff_id}</span>
                          {s.department && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                              <Building2 className="h-2.5 w-2.5" />
                              {typeof s.department === 'object' ? s.department.name : s.department}
                            </span>
                          )}
                          {s.position && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                              <Briefcase className="h-2.5 w-2.5" />
                              {typeof s.position === 'object' ? s.position.name : s.position}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Status + chevron */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                          {s.status.replace('_', ' ')}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}