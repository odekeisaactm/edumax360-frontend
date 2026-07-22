'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { studentsAPI, resultArchiveAPI } from '@/lib/api';
import {
  UserCheck, Search, Loader2, ArrowLeft, Calendar,
  History, X, CheckCircle2, AlertTriangle, AlertCircle,
  FileText, GraduationCap, Box
} from 'lucide-react';

// ─── Helpers & Constants ──────────────────────────────────────────────────────
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
  active:      { label: 'Active',      bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  suspended:   { label: 'Suspended',   bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200'  },
  graduated:   { label: 'Graduated',   bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200'    },
  withdrawn:   { label: 'Withdrawn',   bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300'   },
  transferred: { label: 'Transferred', bg: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-violet-200'  },
};

function getStudentImage(imgUrl?: string | null) {
  if (!imgUrl || imgUrl.trim() === '') return '/images/default-avatar.png';
  if (imgUrl.startsWith('http')) return imgUrl;
  return `${API_BASE_URL}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
}

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'An unexpected error occurred.';
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error' | 'warn'; message: string; }

// ─── Toast Stack ──────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none print:hidden">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-amber-50 border-amber-200 text-amber-900'
          : t.type === 'warn' ? 'bg-orange-50 border-orange-200 text-orange-900'
          : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success' ? <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-600" />
          : t.type === 'warn' ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-orange-500" />
          : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 ml-2 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Student Search Component ─────────────────────────────────────────────────
const StudentSearch = ({ onSelect }: { onSelect: (s: any) => void }) => {
  const [query, setQuery] = useState('');
  const [results, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const executeSearch = async (val: string) => {
    if (val.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      // Searching all students (active & inactive)
      const res = await studentsAPI.list({ search: val });
      const list = res.results || [];
      setSearchResults(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length >= 3) {
      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        executeSearch(val);
      }, 400); // 400ms debounce
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search by student name or registration number..."
          className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all shadow-sm text-slate-800 font-medium"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setSearchResults([]); setShowDropdown(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showDropdown && query.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl z-[60] overflow-hidden max-h-[320px] overflow-y-auto animate-in fade-in slide-in-from-top-2">
          {query.length < 3 ? (
            <div className="p-6 text-center text-slate-500 text-sm font-medium">
              Please type at least 3 characters to search...
            </div>
          ) : isSearching ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center">
              <Loader2 className="w-6 h-6 animate-spin mb-3 text-amber-500" />
              <span className="text-sm font-medium">Searching archive...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {results.map(s => {
                const fullName = toTitleCase(s.full_name || `${s.first_name} ${s.last_name}`);
                const classDisplay = [s.current_class_name, s.current_class_section_name].filter(Boolean).join(' ');
                const statusMeta = STATUS_META[s.status || 'active'] || STATUS_META.active;
                const hideClass = s.status === 'graduated' || s.status === 'transferred';

                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelect(s);
                      setQuery(fullName);
                      setShowDropdown(false);
                    }}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-amber-50/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={getStudentImage(s.image_url || s.image)}
                        alt={fullName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 group-hover:text-amber-700 transition-colors">{fullName}</p>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5 uppercase tracking-wider">
                          {s.registration_number} {hideClass ? '' : `• ${classDisplay || 'No Active Class'}`}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center flex flex-col items-center">
              <Search className="w-8 h-8 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-600">No students found</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by a different name or ID.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function StudentResultHistoryViewer() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[] | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: 'success' | 'error' | 'warn', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchHistory = async (student: any) => {
    setLoading(true);
    setData(null);
    setSelectedStudent(student);

    try {
      const res = await resultArchiveAPI.studentHistory({
        student_id: student.id
      });
      // Handle the API unwrap safely
      const historyData = res.data || res;
      setData(Array.isArray(historyData) ? historyData : []);
    } catch (err: any) {
      showToast('error', extractError(err) || "Failed to load student history.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSheet = (record: any) => {
    if (!data || !selectedStudent) return;

    // Pass ALL period IDs for this student in chronological order to the preview page.
    const allPeriodIds = data.map(r => r.period_id).join(',');

    router.push(
      `/dashboard/staff/result/print/preview?student=${selectedStudent.id}&period=${record.period_id}&type=${record.result_type}&periods=${allPeriodIds}`
    );
  };

  const selectedFullName = selectedStudent ? toTitleCase(selectedStudent.full_name || `${selectedStudent.first_name} ${selectedStudent.last_name}`) : '';
  const selectedClassDisplay = selectedStudent ? [selectedStudent.current_class_name, selectedStudent.current_class_section_name].filter(Boolean).join(' ') : '';
  const selectedStatusMeta = selectedStudent ? (STATUS_META[selectedStudent.status || 'active'] || STATUS_META.active) : STATUS_META.active;
  const hideSelectedClass = selectedStudent && (selectedStudent.status === 'graduated' || selectedStudent.status === 'transferred');

  return (
    <div className="max-w-[85rem] mx-auto pb-20 px-4 pt-6 min-h-screen">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Page Header ── */}
      <div className="mb-6 print:hidden">
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 rounded-2xl px-5 py-4 md:px-7 md:py-5 shadow-lg shadow-slate-300/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md shadow-amber-900/30 flex-shrink-0">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-amber-300 uppercase tracking-widest truncate">Result Archive</p>
                <h1 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">Student Result History</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search Container (overflow-hidden removed) ── */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm animate-in fade-in relative mb-6 z-30">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-600" />

        <div className="max-w-2xl">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2.5 mb-4">
            <span className="w-7 h-7 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm shadow-amber-200">
              <Search className="w-3.5 h-3.5 text-white" />
            </span>
            Lookup Student Trajectory
          </h2>

          <p className="text-xs text-slate-500 mb-3">Search for any active or graduated student to view their complete academic history.</p>
          <StudentSearch onSelect={fetchHistory} />
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center animate-in fade-in">
          <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">Retrieving academic history...</p>
        </div>
      )}

      {/* ── Results Display ── */}
      {!loading && data && selectedStudent && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500 z-20 relative">

          {/* Profile Header */}
          <div className="px-6 py-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <img
                  src={getStudentImage(selectedStudent.image_url || selectedStudent.image)}
                  alt={selectedFullName}
                  className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-avatar.png'; }}
                />
                <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-lg leading-tight">{selectedFullName}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${selectedStatusMeta.bg} ${selectedStatusMeta.text} ${selectedStatusMeta.border}`}>
                        {selectedStatusMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono uppercase tracking-wider">{selectedStudent.registration_number}</span>
                      {!hideSelectedClass && (
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest">• {selectedClassDisplay || 'No Active Class'}</span>
                      )}
                    </div>
                </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-amber-100 shadow-sm self-start sm:self-auto">
               <History className="w-4 h-4" /> {data.length} Records Found
            </div>
          </div>

          {data.length === 0 ? (
            <div className="p-20 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Box className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-slate-700 mb-1">No historical results</h3>
                <p className="text-sm text-slate-400">There are no archived results linked to this student profile.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white border-b border-slate-200">
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] min-w-[200px]">Academic Term</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Class Enrolled</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Type</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-center">Average</th>
                    <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((record: any) => {
                    const isScoreType = record.result_type === 'score' || record.result_type === 'combined';
                    return (
                      <tr key={record.result_id || `${record.period_id}-${record.result_type}`} className="hover:bg-amber-50/30 transition-colors group">

                        {/* Term Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600 group-hover:border-amber-200 transition-colors shadow-sm">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-sm">{record.period_name}</p>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">{record.session_name}</p>
                            </div>
                          </div>
                        </td>

                        {/* Class Enrolled */}
                        <td className="px-6 py-4">
                          <span className="inline-flex font-bold text-slate-600 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider group-hover:border-amber-200 transition-colors">
                            <GraduationCap className="w-3 h-3 mr-1.5 text-slate-400" />
                            {record.class_name}
                          </span>
                        </td>

                        {/* Result Type Badge */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                            isScoreType ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {record.result_type.replace('_', ' ')}
                          </span>
                        </td>

                        {/* Average Score */}
                        <td className="px-6 py-4 text-center">
                          {isScoreType && record.average_score !== null && record.average_score !== undefined ? (
                            <div className="inline-flex items-center justify-center px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg font-black text-xs shadow-sm border border-amber-100">
                              {Number(record.average_score).toFixed(1)}%
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        {/* Action Button */}
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleOpenSheet(record)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-amber-400 hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Sheet
                          </button>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}