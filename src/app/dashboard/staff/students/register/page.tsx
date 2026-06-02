'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { parentsAPI } from '@/lib/api';
import {
  Users, Search, ArrowLeft, UserPlus, X,
  Loader2, Mail, Phone, MapPin, ChevronRight,
  UserCircle, Sparkles, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Parent = {
  id: number;
  parent_id?: string;
  full_name?: string;
  title?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile?: string | null;
  address?: string | null;
  image_url?: string | null;
  status?: string | null;
  wards_count?: number;
  gender?: string | null;
  occupation?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatName(p: Parent): string {
  if (p.full_name) return p.full_name;
  return [p.title, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
}

function toTitleCase(str: string): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ parent, size = 'md' }: { parent: Parent; size?: 'sm' | 'md' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const sizes = { sm: 'w-10 h-10', md: 'w-14 h-14', lg: 'w-20 h-20' };
  const iconSizes = { sm: 'h-5 w-5', md: 'h-7 w-7', lg: 'h-10 w-10' };

  if (parent.image_url && !broken) {
    return (
      <img src={parent.image_url} alt={formatName(parent)}
        className={`${sizes[size]} rounded-2xl object-cover border-2 border-white shadow-sm flex-shrink-0`}
        onError={() => setBroken(true)} />
    );
  }

  const initials = [parent.first_name, parent.last_name]
    .filter(Boolean).map(n => n![0].toUpperCase()).join('');

  return (
    <div className={`${sizes[size]} rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center flex-shrink-0 border-2 border-white shadow-sm`}>
      {initials
        ? <span className="font-bold text-blue-700 text-sm">{initials}</span>
        : <UserCircle className={`${iconSizes[size]} text-blue-400`} />
      }
    </div>
  );
}

// ─── Parent Card ──────────────────────────────────────────────────────────────
function ParentCard({ parent, selected, onClick }: {
  parent: Parent; selected: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl border-2 text-left transition-all duration-200 ${
        selected
          ? 'border-blue-500 bg-blue-50/80 shadow-sm shadow-blue-100'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/80 hover:shadow-sm'
      }`}>
      <Avatar parent={parent} size="sm" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold truncate ${selected ? 'text-blue-900' : 'text-slate-800'}`}>
          {toTitleCase(formatName(parent))}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {parent.parent_id && (
            <span className="text-[11px] font-mono text-slate-400">{parent.parent_id}</span>
          )}
          {parent.mobile && (
            <span className="text-[11px] text-slate-400 truncate">{parent.mobile}</span>
          )}
        </div>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
        selected ? 'border-blue-500 bg-blue-500' : 'border-slate-200'
      }`}>
        {selected && <div className="w-2 h-2 rounded-full bg-white" />}
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentRegisterPage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();
  const params = useParams();

  // If a parent_id is passed via URL, pre-select that parent
  const presetParentId = params?.parent_id ? Number(params.parent_id) : null;

  const [search, setSearch]         = useState('');
  const [results, setResults]       = useState<Parent[]>([]);
  const [selected, setSelected]     = useState<Parent | null>(null);
  const [loading, setLoading]       = useState(false);
  const [preLoading, setPreLoading] = useState(!!presetParentId);
  const [error, setError]           = useState('');
  const searchInputRef              = useRef<HTMLInputElement>(null);

  const canCreate = user?.is_superuser || hasPermission('student_management.add_studentmodel');

  // Pre-load parent if parent_id in URL
  useEffect(() => {
    if (!presetParentId) return;
    setPreLoading(true);
    parentsAPI.get(presetParentId)
      .then(p => { setSelected(p as any); })
      .catch(() => setError('Could not load guardian. Please search manually.'))
      .finally(() => setPreLoading(false));
  }, [presetParentId]);

  // Search
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setResults([]); return; }

    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await parentsAPI.list({ status: 'active', search: term, page_size: 8 });
        const data = (res as any)?.results ?? (res as any)?.data ?? res ?? [];
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  const handleProceed = () => {
    if (!selected) return;
    router.push(`/dashboard/staff/students/register/${selected.id}`);
  };

  if (!canCreate) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <p className="font-bold text-slate-800 mb-1">Access Denied</p>
          <p className="text-sm text-slate-400">You don't have permission to register students.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10 max-w-4xl mx-auto">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Users className="h-5 w-5 text-white" />
            </div>
            Register Student
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">Select a guardian to continue with registration</p>
        </div>
      </div>

      {preLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Left: Search Panel ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Search card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-800">Search Guardian</p>
                  <button onClick={() => router.push('/dashboard/staff/students/guardians/create')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
                    <UserPlus className="h-3.5 w-3.5" /> New Guardian
                  </button>
                </div>
              </div>

              <div className="p-4">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, mobile, email or parent ID…"
                    autoFocus={!presetParentId}
                    className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50/50 placeholder:text-slate-300"
                  />
                  {search && (
                    <button onClick={() => { setSearch(''); setResults([]); searchInputRef.current?.focus(); }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Results */}
                <div className="mt-3 space-y-2 min-h-[80px]">
                  {loading ? (
                    <div className="flex items-center gap-2 py-6 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      <p className="text-xs text-slate-400">Searching…</p>
                    </div>
                  ) : results.length > 0 ? (
                    results.map(p => (
                      <ParentCard
                        key={p.id}
                        parent={p}
                        selected={selected?.id === p.id}
                        onClick={() => setSelected(p)}
                      />
                    ))
                  ) : search.trim().length >= 2 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm font-semibold text-slate-600 mb-1">No guardians found</p>
                      <p className="text-xs text-slate-400 mb-3">Try a different name, mobile, or parent ID</p>
                      <button onClick={() => router.push('/dashboard/staff/students/guardians/create')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
                        <UserPlus className="h-3.5 w-3.5" /> Register New Guardian
                      </button>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                        <Search className="h-5 w-5 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-400">Type at least 2 characters to search</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick tip */}
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
              <Sparkles className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Every student must be linked to a registered guardian. If the guardian doesn't exist yet,{' '}
                <button onClick={() => router.push('/dashboard/staff/students/guardians/create')}
                  className="font-semibold underline underline-offset-2 hover:text-amber-900 transition-colors">
                  register them first
                </button>
                , then come back here.
              </p>
            </div>
          </div>

          {/* ── Right: Selected Guardian Panel ── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden sticky top-4">

              {/* Panel header */}
              <div className="px-5 py-4 border-b border-slate-50">
                <p className="text-sm font-bold text-slate-800">Selected Guardian</p>
              </div>

              {!selected ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                    <UserCircle className="h-8 w-8 text-slate-300" />
                  </div>
                  <p className="text-sm font-semibold text-slate-500 mb-1">No guardian selected</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Search and select a guardian on the left to proceed with registration
                  </p>
                </div>
              ) : (
                <div>
                  {/* Guardian hero */}
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start gap-4">
                      <Avatar parent={selected} size="lg" />
                      <div className="flex-1 min-w-0 pt-1">
                        <p className="font-bold text-slate-900 text-base leading-tight truncate">
                          {toTitleCase(formatName(selected))}
                        </p>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">{selected.parent_id || '—'}</p>
                        {selected.status && (
                          <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                            selected.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${selected.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact details */}
                  <div className="px-5 pb-4 space-y-2.5 border-t border-slate-50 pt-4">
                    {[
                      { icon: Phone, value: selected.mobile, empty: 'No mobile number' },
                      { icon: Mail,  value: selected.email,  empty: 'No email address'  },
                      { icon: MapPin, value: selected.address, empty: 'No address on file' },
                    ].map(({ icon: Icon, value, empty }) => (
                      <div key={empty} className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <p className={`text-xs leading-relaxed ${value ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                          {value || empty}
                        </p>
                      </div>
                    ))}

                    {selected.occupation && (
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-400">JB</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">{toTitleCase(selected.occupation)}</p>
                      </div>
                    )}
                  </div>

                  {/* Wards count */}
                  {selected.wards_count !== undefined && (
                    <div className="mx-5 mb-4 px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Current wards</span>
                      <span className="text-sm font-bold text-slate-700">{selected.wards_count}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="px-5 pb-5 space-y-2">
                    <button onClick={handleProceed}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 active:scale-[0.98]">
                      Continue to Student Form
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => setSelected(null)}
                      className="w-full px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors">
                      Clear selection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}