'use client';

import { useRouter, useParams } from 'next/navigation';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  studentsAPI,
  parentsAPI,
  studentSettingsAPI,
  schoolInfoAPI,
  academicAPI,
} from '@/lib/api';
import {
  Student,
  Parent,
  StudentSettings,
  SchoolInfo,
} from '@/lib/types';

// AFTER
import {
  Users,
  ArrowLeft,
  Edit3,
  Loader2,
  AlertCircle,
  User as UserIcon, // <--- Renamed to avoid conflict
  GraduationCap,
  FileText,
  Fingerprint,
  Heart, Plus,
  Shield,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  UserPlus,
  CreditCard,
  Trash2,
  Power, Package,
  Lock
} from 'lucide-react';

// Tab Components
import OverviewTab from './tabs/OverviewTab';
import AcademicTab from './tabs/AcademicTab';
import GuardiansTab from './tabs/GuardiansTab';
import DocumentsTab from './tabs/DocumentsTab';
import FingerprintsTab from './tabs/FingerprintsTab';
import MedicalTab from './tabs/MedicalTab';
import UtilitiesTab from './tabs/UtilitiesTab';
import AccountTab from './tabs/AccountTab';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  active:    { label: 'Active',    dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  suspended: { label: 'Suspended', dot: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200'     },
  graduated: { label: 'Graduated', dot: 'bg-blue-500',    text: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200'    },
  withdrawn: { label: 'Withdrawn', dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200'   },
  inactive:  { label: 'Inactive',  dot: 'bg-slate-400',   text: 'text-slate-600',   bg: 'bg-slate-100',   border: 'border-slate-200'   },
};

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: UserIcon },
  { id: 'academic',    label: 'Academic',    icon: GraduationCap },
  { id: 'guardians',   label: 'Guardians',   icon: Users },
  { id: 'documents',   label: 'Documents',   icon: FileText },
  { id: 'fingerprints', label: 'Fingerprints', icon: Fingerprint },
  { id: 'medical',     label: 'Medical',     icon: Heart },
  { id: 'utilities',   label: 'Utilities',   icon: Package },
  { id: 'account',     label: 'Account',     icon: Shield },
];

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function StudentDetailsPage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = parseInt(params.id as string);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [settings, setSettings] = useState<StudentSettings | null>(null);
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const canView = user?.is_superuser || hasPermission('student_management.view_studentmodel');
  const canEdit = user?.is_superuser || hasPermission('student_management.change_studentmodel');
  const canDelete = user?.is_superuser || hasPermission('student_management.delete_studentmodel');

  useEffect(() => {
    if (canView && studentId) {
      fetchData();
    }
  }, [canView, studentId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentData, parentData, settingsData, schoolData] = await Promise.all([
        studentsAPI.get(studentId),
        // Fetch parent ID if it's a number or object
        studentsAPI.get(studentId).then(s => {
             const pid = typeof s.parent === 'number' ? s.parent : s.parent.id;
             return parentsAPI.get(pid);
        }).catch(() => null),
        studentSettingsAPI.get(),
        schoolInfoAPI.get().catch(() => null)
      ]);

      setStudent(studentData);
      setParent(parentData);
      setSettings(settingsData);
      setSchoolInfo(schoolData);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.detail || 'Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  if (!canView) return <AccessDenied />;
  if (loading) return <LoadingState />;
  if (error || !student) return <ErrorState error={error} />;

  const statusMeta = STATUS_META[student.status ?? ''] || STATUS_META.inactive;

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/staff/students')} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Users className="h-5 w-5 text-white" />
            </div>
            <span className="truncate">{student.full_name}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">{student.registration_number} · Student</p>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={fetchData} className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600">
            <RefreshCw className="h-4 w-4" />
          </button>
          {canEdit && (
            <button onClick={() => router.push(`/dashboard/staff/students/${studentId}/edit`)} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50">
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </button>
          )}

        </div>
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-600 to-blue-700" />
        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex-shrink-0">
            {student.image_url ? (
              <img src={student.image_url} alt={student.full_name} className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                <UserIcon className="h-10 w-10 text-blue-300" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-slate-900">{student.full_name}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-3">
              {student.current_class_name || 'Not Assigned'} {student.current_class_section_name && ` - ${student.current_class_section_name}`}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500">
               {student.gender && <span className="flex items-center gap-1.5"><UserIcon className="h-3 w-3 text-slate-400" />{student.gender}</span>}
               {parent && <span className="flex items-center gap-1.5"><Users className="h-3 w-3 text-slate-400" />{parent.full_name}</span>}
            </div>
          </div>
          {/* Stats Pills */}
          <div className="flex sm:flex-col gap-2 flex-shrink-0">
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[72px]">
              <p className="text-lg font-bold text-slate-800">{student.documents_count || 0}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase">Docs</p>
            </div>
            <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-center min-w-[72px]">
              <p className="text-lg font-bold text-slate-800">{student.fingerprints_count || 0}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase">Fingerprints</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none">
          {TABS.map(tab => {
            // Hide medical if setting disabled
            if (tab.id === 'medical' && !settings?.use_health_fields) return null;

            return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          )})}
        </div>

        {/* Tab Content */}
        <div className="p-5 min-h-[400px]">
          {activeTab === 'overview' && <OverviewTab student={student} settings={settings} />}
          {activeTab === 'academic' && <AcademicTab student={student} />}
          {activeTab === 'guardians' && <GuardiansTab student={student} parent={parent} refreshParent={fetchData} />}
          {activeTab === 'documents' && <DocumentsTab student={student} schoolInfo={schoolInfo} settings={settings} refreshStudent={fetchData} />}
          {activeTab === 'fingerprints' && <FingerprintsTab student={student} settings={settings} refreshStudent={fetchData} />}
          {activeTab === 'medical' && <MedicalTab student={student} />}
          {activeTab === 'utilities' && <UtilitiesTab student={student} refreshStudent={fetchData} />}
          {activeTab === 'account' && <AccountTab student={student} parent={parent} refreshStudent={fetchData} onDelete={() => router.push('/dashboard/staff/students')} />}
        </div>
      </div>
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────────
function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You don't have permission to view students.</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
        <p className="mt-3 text-sm text-slate-400">Loading student details...</p>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: string | null }) {
  return (
    <div className="min-h-[500px] flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h3 className="font-bold text-slate-800 mb-1">Error</h3>
        <p className="text-sm text-slate-400 mb-5">{error || 'Student not found'}</p>
      </div>
    </div>
  );
}