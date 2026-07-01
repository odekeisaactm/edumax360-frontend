'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { studentsAPI, classesAPI, classSectionsAPI } from '@/lib/api';
import { Student, ClassModel, ClassSection } from '@/lib/types';
import {
  Search, Users, CreditCard, ChevronRight,
  GraduationCap, Hash, X, Loader2, UserCheck,
  AlertCircle, BookOpen,
} from 'lucide-react';

type SearchMode = 'class' | 'name' | 'reg';

export default function FeePaymentSearchPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const canAccess = user?.is_superuser || hasPermission('fee_management.add_feepaymentmodel');

  const [mode, setMode] = useState<SearchMode>('name');
  const [query, setQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [results, setResults] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [classLoading, setClassLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    classesAPI.list().then(setClasses).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClass) { setSections([]); setSelectedSection(''); return; }
    setClassLoading(true);
    classSectionsAPI.list({ school_section: parseInt(selectedClass) })
      .then(setSections)
      .catch(() => setSections([]))
      .finally(() => setClassLoading(false));
  }, [selectedClass]);

  const searchStudents = useCallback(async (params: object) => {
      setLoading(true);
      setError(null);
      try {
        const data = await studentsAPI.list({ status: 'active', ...params });
        setResults(data.results);
      } catch {
        setError('Search failed. Please try again.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, []);

  // Class + section search
  useEffect(() => {
    if (mode !== 'class') return;
    if (!selectedClass || !selectedSection) { setResults([]); return; }
    searchStudents({ current_class: selectedClass, current_class_section: selectedSection });
  }, [selectedClass, selectedSection, mode, searchStudents]);

  // Name / reg search with debounce
  useEffect(() => {
    if (mode === 'class') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(() => {
      searchStudents({ search: query.trim() });
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode, searchStudents]);

  const handleModeChange = (m: SearchMode) => {
    setMode(m);
    setQuery('');
    setResults([]);
    setSelected(null);
    setError(null);
    setSelectedClass('');
    setSelectedSection('');
  };

  const handleSelect = (student: Student) => {
    setSelected(student);
  };

  const handleProceed = () => {
    if (selected) router.push(`/dashboard/staff/finance/students/${selected.id}/dashboard`);
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to record fee payments.</p>
        </div>
      </div>
    );
  }

  const selectedClassName = classes.find(c => String(c.id) === selectedClass)?.name || '';
  const selectedSectionName = sections.find(s => String(s.id) === selectedSection)?.name || '';

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* Page Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
            <CreditCard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fee Payment</h1>
            <p className="text-sm text-gray-500">Search for a student to manage their fee payments</p>
          </div>
        </div>

        {/* Search Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Mode Tabs */}
          <div className="flex border-b border-gray-100">
            {([
              { key: 'name', label: 'Search by Name', icon: Search },
              { key: 'reg', label: 'Reg. Number', icon: Hash },
              { key: 'class', label: 'By Class', icon: GraduationCap },
            ] as { key: SearchMode; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleModeChange(key)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all ${
                  mode === key
                    ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-500'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Search Controls */}
          <div className="p-5">
            {mode === 'class' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Class</label>
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50"
                  >
                    <option value="">Select class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name?.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Section</label>
                  <select
                    value={selectedSection}
                    onChange={e => setSelectedSection(e.target.value)}
                    disabled={!selectedClass || classLoading}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 disabled:opacity-50"
                  >
                    <option value="">Select section...</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name?.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={mode === 'name' ? 'Type student name...' : 'Enter registration number...'}
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50"
                />
                {query && (
                  <button
                    onClick={() => { setQuery(''); setResults([]); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results + Detail side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Results List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">
                {loading ? 'Searching...' : results.length > 0
                  ? `${results.length} student${results.length !== 1 ? 's' : ''} found`
                  : mode === 'class' && selectedClass && selectedSection
                  ? 'No students found'
                  : 'Results'}
              </span>
              {loading && <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />}
              {mode === 'class' && selectedClass && selectedSection && (
                <span className="text-xs text-gray-400">{selectedClassName} · {selectedSectionName}</span>
              )}
            </div>

            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Empty state */}
            {!loading && results.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Users className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">
                  {mode === 'name' || mode === 'reg'
                    ? query.length < 2
                      ? 'Start typing to search'
                      : 'No students match your search'
                    : 'Select a class and section to see students'}
                </p>
              </div>
            )}

            {/* Student list */}
            {results.length > 0 && (
              <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
                {results.map(student => (
                  <button
                    key={student.id}
                    onClick={() => handleSelect(student)}
                    className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all hover:bg-gray-50 ${
                      selected?.id === student.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm">
                      {student.image_url ? (
                        <img src={student.image_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        student.full_name?.charAt(0).toUpperCase() || student.first_name?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {(student.full_name || `${student.first_name} ${student.last_name}`).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {student.registration_number}
                        {student.current_class_name && ` · ${student.current_class_name}`}
                        {student.current_class_section_name && ` ${student.current_class_section_name}`}
                      </p>
                    </div>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 ${
                      selected?.id === student.id ? 'text-emerald-500' : 'text-gray-300'
                    }`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Student Detail Panel */}
          <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
            selected ? 'border-emerald-200' : 'border-gray-100'
          }`}>
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full py-14 text-center px-6">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <UserCheck className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">Select a student from the list to view their details</p>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold shadow-md flex-shrink-0 overflow-hidden">
                    {selected.image_url ? (
                      <img src={selected.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (selected.full_name || selected.first_name)?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {(selected.full_name || `${selected.first_name} ${selected.last_name}`).toUpperCase()}
                    </h3>
                    <p className="text-sm text-emerald-600 font-mono font-medium">{selected.registration_number}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                      selected.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selected.status}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2">
                  {selected.current_class_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <BookOpen className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500">Class:</span>
                      <span className="font-medium text-gray-800">
                        {selected.current_class_name}
                        {selected.current_class_section_name && ` · ${selected.current_class_section_name}`}
                      </span>
                    </div>
                  )}
                  {selected.parent_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500">Guardian:</span>
                      <span className="font-medium text-gray-800">{selected.parent_name}</span>
                    </div>
                  )}
                  {selected.gender && (
                    <div className="flex items-center gap-2 text-sm">
                      <UserCheck className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-500">Gender:</span>
                      <span className="font-medium text-gray-800 capitalize">{selected.gender}</span>
                    </div>
                  )}
                </div>

                {/* Proceed Button */}
                <button
                  onClick={handleProceed}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg hover:shadow-emerald-200 transform hover:-translate-y-0.5"
                >
                  <CreditCard className="h-4 w-4" />
                  Manage Fees & Payments
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}