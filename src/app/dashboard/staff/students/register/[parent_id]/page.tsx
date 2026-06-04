'use client';

import { useRouter, useParams } from 'next/navigation';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  studentsAPI,
  parentsAPI,
  studentCustomFieldsAPI,
  utilitiesAPI,
  utilityAPI,
  academicAPI,
  classSectionsAPI,
  studentSettingsAPI,
} from '@/lib/api';
import {
  Parent,
  StudentSettings,
  CustomField,
  Utility,
  ClassModel,
  ClassSection,
  StudentDuplicateCheckResult,
  SubjectGroup,
} from '@/lib/types';
import {
  Users,
  ArrowLeft,
  Save,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Upload,
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  Check,
  Video,
  VideoOff,
  RefreshCw,
  Key,
  GraduationCap,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Heart,
  SlidersHorizontal,
  Star,
  Layers,
  Package,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800';
const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Section Component ─────────────────────────────────────────────────────────
interface SectionProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  required?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  error?: string;
}

function Section({ icon, iconBg, title, subtitle, required, open, onToggle, children, error }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-4 px-6 py-4 transition-colors text-left ${error ? 'bg-red-50/50' : 'hover:bg-slate-50/60'}`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{title}</span>
            {required && (
              <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-md border border-red-100 uppercase tracking-wide">
                Required
              </span>
            )}
            {error && (
              <span className="text-[10px] font-semibold text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Needs attention
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-slate-50">
          <div className="pt-5">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Form State Interface ───────────────────────────────────────────────────────
interface FormData {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  mobile: string;
  date_of_birth: string;
  gender: 'male' | 'female' | '';
  religion: string;
  state: string;
  lga: string;
  blood_group: string;
  genotype: string;
  medical_conditions: string;
  parent: number;
  relationship_with_parent: string;
  current_class: number | null;
  current_class_section: number | null;
  subject_group: number | null;
  is_special_need: boolean;
  utility_ids: number[];
  extra_fields: Record<string, any>;
  custom_username: string;
  custom_password: string;
}

// ─── Main Page Component ────────────────────────────────────────────────────────
export default function StudentCreatePage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const parentId = parseInt(params.parent_id as string);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [loadingErrors, setLoadingErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [settings, setSettings] = useState<StudentSettings | null>(null);
  const [academicSettings, setAcademicSettings] = useState<any>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [utilities, setUtilities] = useState<Utility[]>([]);
  const [subjectGroups, setSubjectGroups] = useState<SubjectGroup[]>([]);
  const [classes, setClasses] = useState<ClassModel[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [lgas, setLgas] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [loadingSections, setLoadingSections] = useState(false);

  // Section expansion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    academic: true,
    basic: true,
    contact: false,
    personal: false,
    medical: false,
    additional: false,
    utilities: false,
    userform: true,
  });

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Duplicate detection
  const [duplicateCheck, setDuplicateCheck] = useState<StudentDuplicateCheckResult | null>(null);
  const [ignoreDuplicate, setIgnoreDuplicate] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const duplicateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Form data with defaults
  const [formData, setFormData] = useState<FormData>({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    mobile: '',
    date_of_birth: '',
    gender: '',
    religion: '',
    state: '',
    lga: '',
    blood_group: '',
    genotype: '',
    medical_conditions: '',
    parent: parentId,
    relationship_with_parent: 'father',
    current_class: null,
    current_class_section: null,
    subject_group: null,
    is_special_need: false,
    utility_ids: [],
    extra_fields: {},
    custom_username: '',
    custom_password: '',
  });

  const canCreate = user?.is_superuser || hasPermission('student_management.add_studentmodel');
  const showUserForm = settings?.show_user_form === true;
  const useClassSections = academicSettings?.use_class_sections === true;

  // ── Load reference data ──
  useEffect(() => {
    if (canCreate) {
      fetchData();
    }
  }, [canCreate, parentId]);

  // ── Inherit from parent when parent loads ──
  useEffect(() => {
    if (parent) {
      setFormData(prev => ({
        ...prev,
        state: prev.state || parent.state || '',
        lga: prev.lga || parent.lga || '',
        religion: prev.religion || parent.religion || '',
      }));

      if (parent.state && !formData.state) {
        fetchLGAs(parent.state);
      }
    }
  }, [parent]);

  // ── Load LGAs when state changes ──
  useEffect(() => {
    if (formData.state) {
      fetchLGAs(formData.state);
    } else {
      setLgas([]);
    }
  }, [formData.state]);

  // ── Load sections when class changes ──
  useEffect(() => {
    if (formData.current_class) {
      fetchSectionsForClass(formData.current_class);
    } else {
      setSections([]);
      setFormData(prev => ({ ...prev, current_class_section: null, subject_group: null }));
    }
  }, [formData.current_class]);

  // ── Duplicate check ──
  const runDuplicateCheck = useCallback(async (first: string, last: string, middle: string) => {
    if (ignoreDuplicate || !first.trim() || !last.trim()) {
      setDuplicateCheck(null);
      return;
    }
    setCheckingDuplicate(true);
    try {
      const result = await studentsAPI.checkDuplicate({
        first_name: first,
        middle_name: middle,
        last_name: last,
        parent_id: parentId,
      });
      setDuplicateCheck(result as StudentDuplicateCheckResult);
    } catch {
      setDuplicateCheck(null);
    } finally {
      setCheckingDuplicate(false);
    }
  }, [parentId, ignoreDuplicate]);

  const scheduleDuplicateCheck = useCallback((f: FormData) => {
    if (duplicateTimerRef.current) clearTimeout(duplicateTimerRef.current);
    duplicateTimerRef.current = setTimeout(() => {
      runDuplicateCheck(f.first_name, f.last_name, f.middle_name);
    }, 600);
  }, [runDuplicateCheck]);

  // ── Fetch all data with better error handling ──
  const fetchData = async () => {
    setLoading(true);
    setLoadingErrors([]);

    try {
      const promises: Record<string, Promise<any>> = {
        parent: parentsAPI.get(parentId),
        settings: studentSettingsAPI.get(),
        customFields: studentCustomFieldsAPI.list('student'),
        utilities: utilitiesAPI.list(),
        classes: academicAPI.listClasses(),
        states: utilityAPI.getStates(),
        academicSettings: academicAPI.getSettings(),
        subjectGroups: academicAPI.listSubjectGroups(),
      };

      const results = await Promise.allSettled([
        promises.parent,
        promises.settings,
        promises.customFields,
        promises.utilities,
        promises.classes,
        promises.states,
        promises.academicSettings,
        promises.subjectGroups,
      ]);

      const errors: string[] = [];

      // Parent
      if (results[0].status === 'fulfilled') {
        setParent(results[0].value);
      } else {
        errors.push('Failed to load parent data');
      }

      // Settings
      if (results[1].status === 'fulfilled') {
        setSettings(results[1].value);
      } else {
        errors.push('Failed to load settings');
      }

      // Custom Fields
      if (results[2].status === 'fulfilled') {
        const fieldsData = results[2].value;
        const fieldsArray = Array.isArray(fieldsData) ? fieldsData :
                          (fieldsData?.results || fieldsData?.data || []);
        const activeFields = fieldsArray.filter((f: CustomField) => f.is_active);
        setCustomFields(activeFields);
      }

      // Utilities
      if (results[3].status === 'fulfilled') {
        const utilitiesData = results[3].value;
        const utilitiesArray = Array.isArray(utilitiesData) ? utilitiesData :
                             (utilitiesData?.results || utilitiesData?.data || []);
        const activeUtilities = utilitiesArray.filter((u: Utility) => u.is_active);
        setUtilities(activeUtilities);
      }

      // Classes
      if (results[4].status === 'fulfilled') {
        const classesData = results[4].value;
        const classesArray = Array.isArray(classesData) ? classesData :
                            (classesData?.results || classesData?.data || []);
        setClasses(classesArray);
      } else {
        errors.push('Failed to load classes');
      }

      // States
      if (results[5].status === 'fulfilled') {
        const statesData = results[5].value;
        setStates(Array.isArray(statesData) ? statesData : []);
      } else {
        errors.push('Failed to load states');
      }

      // Academic Settings
      if (results[6].status === 'fulfilled') {
        setAcademicSettings(results[6].value);
      }

      // Subject Groups
      if (results[7].status === 'fulfilled') {
        const groupsArray = Array.isArray(results[7].value) ? results[7].value :
                         (results[7].value?.results || results[7].value?.data || []);
        setSubjectGroups(groupsArray);
      }

      if (errors.length > 0) {
        setLoadingErrors(errors);
      }

    } catch (error: any) {
      setError(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch LGAs ──
  const fetchLGAs = async (state: string) => {
    try {
      const lgasData = await utilityAPI.getLGAs(state);
      setLgas(Array.isArray(lgasData) ? lgasData : []);
    } catch (error: any) {
      setLgas([]);
    }
  };

  // ── Fetch sections for class (FIXED) ──
    const fetchSectionsForClass = async (classId: number) => {
      setLoadingSections(true);
      try {
        const selectedClass = classes.find(c => c.id === classId);
        if (!selectedClass || !selectedClass.configurations?.length) {
          setSections([]);
          return;
        }

        // Extract unique sections directly from configurations in the class object
        const seen = new Set<number>();
        const extracted: ClassSection[] = [];

        for (const config of selectedClass.configurations) {
          const sectionId = typeof config.class_section === 'number'
            ? config.class_section
            : config.class_section?.id;

          if (config.is_active && sectionId !== undefined && !seen.has(sectionId)) {
            seen.add(sectionId);
            extracted.push({
              id: sectionId,
              name: config.class_section_name,
            } as ClassSection);
          }
        }

        setSections(extracted);
      } catch (error: any) {
        console.error('Error extracting sections:', error);
        setSections([]);
      } finally {
        setLoadingSections(false);
      }
    };

  // ── Toggle section ──
  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Handle input change ──
  const handleInputChange = (field: keyof FormData, value: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value };

      if (['first_name', 'last_name', 'middle_name'].includes(field)) {
        scheduleDuplicateCheck(next);
      }

      return next;
    });

    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    setError(null);
    setDuplicateCheck(null);
  };

  // ── Handle utility change ──
  const handleUtilityChange = (utilityId: number) => {
    setFormData(prev => ({
      ...prev,
      utility_ids: prev.utility_ids.includes(utilityId)
        ? prev.utility_ids.filter(id => id !== utilityId)
        : [...prev.utility_ids, utilityId]
    }));
  };

  // ── Handle custom field change ──
  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      extra_fields: {
        ...prev.extra_fields,
        [fieldId]: value
      }
    }));
  };

  // ── Handle image upload ──
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, or GIF)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size should not exceed 2MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Handle camera (FIXED) ──
  const startCamera = async () => {
      setCameraError(null);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera API not supported in this browser. Please use file upload.');
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        setStream(mediaStream);
        setShowCamera(true);

        // Let React render the video element first, then attach the stream
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            // autoPlay + playsInline on the element handles playback —
            // no manual .play() needed, avoids the "not interacted" DOMException
          }
        }, 50);
      } catch (error: any) {
        console.error('Error accessing camera:', error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraError('Camera permission denied. Allow access in browser settings or use file upload.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setCameraError('No camera found. Connect a camera or use file upload.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          setCameraError('Camera is in use by another app. Close it or use file upload.');
        } else {
          setCameraError(`Could not access camera: ${error.message}. Please use file upload.`);
        }
      }
    };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not get canvas context');
        return;
      }

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob and create file
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
          setImageFile(file);
          setImagePreview(canvas.toDataURL('image/jpeg', 0.9));
          stopCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const switchCamera = async () => {
      stopCamera();
      const nextMode = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(nextMode);
      setTimeout(() => startCamera(), 300);
    };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ── Validation ──
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.first_name.trim()) {
      errors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      errors.last_name = 'Last name is required';
    }

    if (!formData.gender) {
      errors.gender = 'Gender is required';
    }

    if (!formData.current_class) {
      errors.current_class = 'Class is required';
    }

    if (showUserForm) {
      if (!formData.custom_username.trim()) {
        errors.custom_username = 'Username is required';
      }
      if (!formData.custom_password.trim() || formData.custom_password.length < 6) {
        errors.custom_password = 'Password must be at least 6 characters';
      }
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors before submitting');
      if (errors.first_name || errors.last_name || errors.gender) {
        setOpenSections(prev => ({ ...prev, basic: true }));
      }
      if (errors.current_class || errors.relationship_with_parent) {
        setOpenSections(prev => ({ ...prev, academic: true }));
      }
      if (errors.custom_username || errors.custom_password) {
        setOpenSections(prev => ({ ...prev, userform: true }));
      }
      return false;
    }

    return true;
  };

  // ── Handle submit ──
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (submitting) return;

    if (!validateForm()) return;

    if (duplicateCheck?.is_duplicate && !ignoreDuplicate) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const submitData = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
          if (key === 'utility_ids') {
            // Send each ID as a separate form field entry, not a JSON string
            (value as number[]).forEach(id => submitData.append('utility_ids', String(id)));
          } else if (key === 'is_special_need') {
            submitData.append(key, value ? 'true' : 'false');
          } else if (key !== 'extra_fields' && value !== null && value !== '') {
            submitData.append(key, value as string);
          }
        });

      if (Object.keys(formData.extra_fields).length > 0) {
        submitData.append('extra_fields', JSON.stringify(formData.extra_fields));
      }

      if (imageFile) {
        submitData.append('image', imageFile);
      }

      const result = await studentsAPI.create(submitData as any);

      setSuccess('Student created successfully!');
      setTimeout(() => {
          router.push(`/dashboard/staff/students/${result.id}`);  // ← use result.id
        }, 1500);
    } catch (error: any) {
      setError(extractError(error));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Handle view duplicate ──
  const handleViewDuplicate = () => {
    if (duplicateCheck?.student_id) {
      router.push(`/dashboard/staff/students/${duplicateCheck.student_id}`);
    }
  };

  // ── Handle ignore duplicate ──
  const handleIgnoreDuplicate = () => {
    setIgnoreDuplicate(true);
    setDuplicateCheck(null);
  };

  // ── Cleanup camera on unmount ──
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  // ── Get filtered subject groups for selected class ──
  const getSubjectGroupsForClass = useCallback((): SubjectGroup[] => {
    if (!formData.current_class) return [];

    return subjectGroups.filter(group => {
      if (!group.applicable_classes || group.applicable_classes.length === 0) {
        return false;
      }

      return group.applicable_classes.some(cls => {
        const classId = typeof cls === 'object' ? (cls as any).id : cls;
        return classId === formData.current_class;
      });
    });
  }, [subjectGroups, formData.current_class]);

  const availableSubjectGroups = getSubjectGroupsForClass();

  // ── Permission check ──
  if (!canCreate) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to create students.</p>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600">Loading form...</p>
          {loadingErrors.length > 0 && (
            <div className="max-w-md mx-auto mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-900 mb-2">Some data failed to load:</p>
              <ul className="text-xs text-amber-700 list-disc list-inside space-y-1">
                {loadingErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
              <button
                onClick={fetchData}
                className="mt-3 text-xs font-semibold text-amber-800 underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push('/dashboard/staff/students/register')}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <Users className="h-5 w-5 text-white" />
            </div>
            Register Student
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">
            {parent ? `Adding student for ${parent.first_name} ${parent.last_name}` : 'Loading parent...'}
          </p>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mb-4">
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
            <button onClick={() => setError('')}>
              <X className="h-4 w-4 text-red-400 hover:text-red-600 transition-colors" />
            </button>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-col gap-4">

        {/* Profile Photo Card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              {showCamera ? (
                <div className="relative">
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl z-10 p-2">
                      <p className="text-white text-xs text-center">{cameraError}</p>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-24 h-24 rounded-2xl object-cover bg-black"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              ) : imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-white shadow-sm"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center border-2 border-white shadow-sm">
                  <Users className="h-9 w-9 text-slate-300" />
                </div>
              )}
              {imagePreview && !showCamera && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors border-2 border-white"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Student Photo</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                JPEG, PNG or GIF · max 2 MB
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                {showCamera ? (
                  <>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={!!cameraError}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Camera className="h-3.5 w-3.5" /> Capture
                    </button>
                    <button
                      type="button"
                      onClick={switchCamera}
                      disabled={!!cameraError}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Switch camera"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Switch
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <VideoOff className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Video className="h-3.5 w-3.5" /> Use Camera
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        {/* Guardian Information Section */}
        {parent && (
          <Section
            icon={<Users className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
            title="Guardian Information"
            subtitle="Linked parent/guardian details"
            required
            open={openSections.academic}
            onToggle={() => toggleSection('academic')}
          >
            <div className="flex items-center gap-5 mb-5">
              <div className="flex-shrink-0">
                {parent.image_url ? (
                  <img
                    src={parent.image_url}
                    alt={parent.full_name || 'Parent'}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center border-2 border-white shadow-sm">
                    <Users className="h-10 w-10 text-emerald-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-slate-900 truncate">
                  {parent.title ? `${parent.title} ` : ''}{parent.first_name} {parent.middle_name || ''} {parent.last_name}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {parent.mobile && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {parent.mobile}
                    </div>
                  )}
                  {parent.email && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      {parent.email}
                    </div>
                  )}
                </div>
                {parent.address && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{parent.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {/* Relationship */}
              <div>
                <label className={labelCls}>
                  Relationship with Student <span className="text-red-500 normal-case">*</span>
                </label>
                <select
                  value={formData.relationship_with_parent}
                  onChange={(e) => handleInputChange('relationship_with_parent', e.target.value)}
                  className={`${inputCls} ${fieldErrors.relationship_with_parent ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="guardian">Guardian</option>
                  <option value="uncle">Uncle</option>
                  <option value="aunt">Aunt</option>
                  <option value="grandparent">Grandparent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </select>
                {fieldErrors.relationship_with_parent && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.relationship_with_parent}
                  </p>
                )}
              </div>

              {/* Class */}
              <div>
                <label className={labelCls}>
                  Class <span className="text-red-500 normal-case">*</span>
                </label>
                <select
                  value={formData.current_class || ''}
                  onChange={(e) => {
                    const classId = e.target.value ? Number(e.target.value) : null;
                    handleInputChange('current_class', classId);
                    // Reset dependent fields
                    setFormData(prev => ({ ...prev, current_class_section: null, subject_group: null }));
                  }}
                  className={`${inputCls} ${fieldErrors.current_class ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                >
                  <option value="">Select Class</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
                {fieldErrors.current_class && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.current_class}
                  </p>
                )}
              </div>

              {/* Class Section - only show if use_class_sections is true */}
              {useClassSections && (
                <div>
                  <label className={labelCls}>
                    Class Section {useClassSections && <span className="text-red-500 normal-case">*</span>}
                  </label>
                  <div className="relative">
                    <select
                      value={formData.current_class_section || ''}
                      onChange={(e) => handleInputChange('current_class_section', e.target.value ? Number(e.target.value) : null)}
                      disabled={!formData.current_class || loadingSections}
                      className={inputCls}
                    >
                      <option value="">
                        {!formData.current_class
                          ? 'Select class first'
                          : loadingSections
                            ? 'Loading sections...'
                            : sections.length === 0
                              ? 'No sections available'
                              : 'Select Section'}
                      </option>
                      {sections.map(section => (
                        <option key={section.id} value={section.id}>{section.name}</option>
                      ))}
                    </select>
                    {loadingSections && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      </div>
                    )}
                  </div>
                  {formData.current_class && sections.length === 0 && !loadingSections && (
                    <p className="text-xs text-amber-600 mt-1">No sections available for this class</p>
                  )}
                </div>
              )}

              {/* Subject Group - only loads after class is selected */}
              <div>
                <label className={labelCls}>
                  Subject Group
                </label>
                <select
                  value={formData.subject_group || ''}
                  onChange={(e) => handleInputChange('subject_group', e.target.value ? Number(e.target.value) : null)}
                  disabled={!formData.current_class || availableSubjectGroups.length === 0}
                  className={inputCls}
                >
                  <option value="">
                    {!formData.current_class ? 'Select class first' :
                     availableSubjectGroups.length === 0 ? 'No subject groups for this class' : 'Select Subject Group'}
                  </option>
                  {availableSubjectGroups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              {/* Is Special Need */}
              <div className="md:col-span-2">
                <label className={labelCls}>
                  Special Needs
                </label>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="is_special_need"
                    checked={formData.is_special_need}
                    onChange={(e) => handleInputChange('is_special_need', e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="is_special_need" className="text-sm text-slate-700">
                    Student has special needs
                  </label>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* Utilities Section */}
        {utilities.length > 0 && (
          <Section
            icon={<Package className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-orange-500 to-amber-600"
            title="Utilities & Services"
            subtitle="Optional services for the student"
            open={openSections.utilities}
            onToggle={() => toggleSection('utilities')}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {utilities.map(utility => (
                <label
                  key={utility.id}
                  className={`flex items-center gap-2.5 p-3 border-2 rounded-xl cursor-pointer transition-all ${
                    formData.utility_ids.includes(utility.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.utility_ids.includes(utility.id)}
                    onChange={() => handleUtilityChange(utility.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">{utility.name}</span>
                </label>
              ))}
            </div>
          </Section>
        )}

        {/* Basic Information Section */}
        <Section
          icon={<Users className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-blue-500 to-blue-700"
          title="Basic Information"
          subtitle="Name, gender and date of birth"
          required
          open={openSections.basic}
          onToggle={() => toggleSection('basic')}
          error={fieldErrors.first_name || fieldErrors.last_name || fieldErrors.gender}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>
                First Name <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                className={`${inputCls} ${fieldErrors.first_name ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                placeholder="e.g. Chinedu"
                value={formData.first_name}
                onChange={(e) => handleInputChange('first_name', e.target.value)}
              />
              {fieldErrors.first_name && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {fieldErrors.first_name}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Middle Name</label>
              <input
                className={inputCls}
                placeholder="e.g. Nnamdi"
                value={formData.middle_name}
                onChange={(e) => handleInputChange('middle_name', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>
                Last Name <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                className={`${inputCls} ${fieldErrors.last_name ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                placeholder="e.g. Okonkwo"
                value={formData.last_name}
                onChange={(e) => handleInputChange('last_name', e.target.value)}
              />
              {fieldErrors.last_name && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {fieldErrors.last_name}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>
                Gender <span className="text-red-500 normal-case">*</span>
              </label>
              <select
                className={`${inputCls} ${fieldErrors.gender ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {fieldErrors.gender && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {fieldErrors.gender}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input
                type="date"
                className={inputCls}
                value={formData.date_of_birth}
                onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Religion</label>
              <select
                className={inputCls}
                value={formData.religion}
                onChange={(e) => handleInputChange('religion', e.target.value)}
              >
                <option value="">Select religion</option>
                <option value="christianity">Christianity</option>
                <option value="islam">Islam</option>
                <option value="traditional">Traditional</option>
                <option value="other">Other</option>
              </select>
              {parent?.religion && formData.religion === parent.religion && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Inherited from parent
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* Contact Information Section */}
        <Section
          icon={<Phone className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-violet-500 to-violet-700"
          title="Contact Information"
          subtitle="Email and mobile number"
          open={openSections.contact}
          onToggle={() => toggleSection('contact')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email Address</label>
              <input
                type="email"
                className={inputCls}
                placeholder="e.g. chinedu@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Mobile Number</label>
              <input
                type="tel"
                className={inputCls}
                placeholder="e.g. 0801 234 5678"
                value={formData.mobile}
                onChange={(e) => handleInputChange('mobile', e.target.value)}
              />
            </div>
          </div>
        </Section>

        {/* Personal Information Section */}
        <Section
          icon={<MapPin className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-amber-500 to-amber-600"
          title="Personal Information"
          subtitle="State of origin and local government area"
          open={openSections.personal}
          onToggle={() => toggleSection('personal')}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>State of Origin</label>
              <select
                className={inputCls}
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
              >
                <option value="">Select state</option>
                {states.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {parent?.state && formData.state === parent.state && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Inherited from parent
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Local Government Area</label>
              <select
                className={inputCls}
                value={formData.lga}
                onChange={(e) => handleInputChange('lga', e.target.value)}
                disabled={!formData.state}
              >
                <option value="">
                  {formData.state ? 'Select LGA' : 'Select state first'}
                </option>
                {lgas.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {parent?.lga && formData.lga === parent.lga && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                  <Users className="h-3 w-3" /> Inherited from parent
                </p>
              )}
            </div>
          </div>
        </Section>

        {/* Medical Information Section */}
        {settings?.use_health_fields && (
          <Section
            icon={<Heart className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-rose-500 to-rose-600"
            title="Medical Information"
            subtitle="Health details and special needs"
            open={openSections.medical}
            onToggle={() => toggleSection('medical')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Blood Group</label>
                <select
                  className={inputCls}
                  value={formData.blood_group}
                  onChange={(e) => handleInputChange('blood_group', e.target.value)}
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Genotype</label>
                <select
                  className={inputCls}
                  value={formData.genotype}
                  onChange={(e) => handleInputChange('genotype', e.target.value)}
                >
                  <option value="">Select Genotype</option>
                  <option value="AA">AA</option>
                  <option value="AS">AS</option>
                  <option value="SS">SS</option>
                  <option value="AC">AC</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelCls}>Medical Conditions</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  placeholder="Any known medical conditions, allergies, or health notes"
                  value={formData.medical_conditions}
                  onChange={(e) => handleInputChange('medical_conditions', e.target.value)}
                />
              </div>
            </div>
          </Section>
        )}

        {/* Additional/Custom Fields Section */}
        {customFields.length > 0 && (
          <Section
            icon={<SlidersHorizontal className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-sky-500 to-sky-700"
            title="Additional Information"
            subtitle="School-configured custom fields"
            open={openSections.additional}
            onToggle={() => toggleSection('additional')}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customFields.map((field) => (
                <div key={field.id} className={field.field_type === 'textarea' ? 'sm:col-span-2' : ''}>
                  <label className={labelCls}>
                    {field.field_name}
                    {field.is_required && <span className="text-red-500 ml-1 normal-case">*</span>}
                  </label>

                  {field.field_type === 'text' && (
                    <input
                      className={inputCls}
                      placeholder={`Enter ${field.field_name.toLowerCase()}`}
                      value={formData.extra_fields[field.id] ?? ''}
                      onChange={(e) => handleCustomFieldChange(field.id.toString(), e.target.value)}
                    />
                  )}

                  {field.field_type === 'number' && (
                    <input
                      type="number"
                      className={inputCls}
                      placeholder={`Enter ${field.field_name.toLowerCase()}`}
                      value={formData.extra_fields[field.id] ?? ''}
                      onChange={(e) => handleCustomFieldChange(field.id.toString(), e.target.value)}
                    />
                  )}

                  {field.field_type === 'date' && (
                    <input
                      type="date"
                      className={inputCls}
                      value={formData.extra_fields[field.id] ?? ''}
                      onChange={(e) => handleCustomFieldChange(field.id.toString(), e.target.value)}
                    />
                  )}

                  {field.field_type === 'textarea' && (
                    <textarea
                      className={`${inputCls} resize-none`}
                      rows={3}
                      placeholder={`Enter ${field.field_name.toLowerCase()}`}
                      value={formData.extra_fields[field.id] ?? ''}
                      onChange={(e) => handleCustomFieldChange(field.id.toString(), e.target.value)}
                    />
                  )}

                  {field.field_type === 'select' && (
                    <select
                      className={inputCls}
                      value={formData.extra_fields[field.id] ?? ''}
                      onChange={(e) => handleCustomFieldChange(field.id.toString(), e.target.value)}
                    >
                      <option value="">Select {field.field_name.toLowerCase()}</option>
                      {(field.choices ?? []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}

                  {field.field_type === 'checkbox' && (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`custom_field_${field.id}`}
                        checked={!!formData.extra_fields[field.id]}
                        onChange={(e) => handleCustomFieldChange(field.id.toString(), e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor={`custom_field_${field.id}`} className="ml-2 text-sm text-slate-700">
                        {field.description || 'Yes'}
                      </label>
                    </div>
                  )}

                  {field.description && field.field_type !== 'checkbox' && (
                    <p className="text-xs text-slate-400 mt-1">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* User Form Section - Conditional */}
        {showUserForm && (
          <Section
            icon={<Key className="h-5 w-5 text-white" />}
            iconBg="bg-gradient-to-br from-violet-500 to-violet-700"
            title="Login Credentials"
            subtitle="Set username and password for portal access"
            required
            open={openSections.userform}
            onToggle={() => toggleSection('userform')}
            error={fieldErrors.custom_username || fieldErrors.custom_password}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>
                  Username <span className="text-red-500 normal-case">*</span>
                </label>
                <input
                  className={`${inputCls} ${fieldErrors.custom_username ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                  placeholder="e.g. chinedu.okonkwo"
                  value={formData.custom_username}
                  onChange={(e) => handleInputChange('custom_username', e.target.value)}
                />
                {fieldErrors.custom_username && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.custom_username}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>
                  Password <span className="text-red-500 normal-case">*</span>
                </label>
                <input
                  className={`${inputCls} ${fieldErrors.custom_password ? 'border-red-400 ring-2 ring-red-200' : ''}`}
                  type="text"
                  placeholder="Min. 6 characters"
                  value={formData.custom_password}
                  onChange={(e) => handleInputChange('custom_password', e.target.value)}
                />
                {fieldErrors.custom_password && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {fieldErrors.custom_password}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">
                  Shown in plain text so you can record it for the student.
                </p>
              </div>
            </div>
          </Section>
        )}
      </div>

      {/* ── Duplicate Banner ── */}
      {(duplicateCheck?.is_duplicate || checkingDuplicate) && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center z-50 pointer-events-none px-4">
          <div className="pointer-events-auto w-full max-w-md">
            {checkingDuplicate ? (
              <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-lg">
                <Loader2 className="h-4 w-4 text-slate-400 animate-spin flex-shrink-0" />
                <p className="text-sm text-slate-500">Checking for duplicates…</p>
              </div>
            ) : duplicateCheck?.is_duplicate ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xl shadow-amber-100/50">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900">Possible duplicate found</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      <span className="font-semibold">{duplicateCheck.student_name}</span>
                      {duplicateCheck.message ? ` — ${duplicateCheck.message}` : ' has a similar name.'}
                    </p>
                    <div className="flex gap-2 mt-3">
                      {duplicateCheck.student_id && (
                        <button
                          type="button"
                          onClick={handleViewDuplicate}
                          className="text-xs font-semibold px-3 py-1.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                          View Student
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleIgnoreDuplicate}
                        className="text-xs font-semibold px-3 py-1.5 bg-white text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                      >
                        Ignore & Continue
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleIgnoreDuplicate}
                    className="text-amber-400 hover:text-amber-600 flex-shrink-0 p-0.5"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ── Success Banner ── */}
      {success && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-sm font-medium text-green-900">{success}</p>
          </div>
        </div>
      )}

      {/* ── Sticky Footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {/* Error strip */}
        {error && (
          <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-100">
            <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600 font-medium flex-1">{error}</p>
            <button onClick={() => setError('')}>
              <X className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
            </button>
          </div>
        )}

        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <Star className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              {duplicateCheck?.is_duplicate && !ignoreDuplicate ? (
                <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Resolve the duplicate warning before saving
                </p>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {formData.first_name || formData.last_name
                      ? [formData.first_name, formData.middle_name, formData.last_name].filter(Boolean).join(' ')
                      : 'New Student'}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {formData.current_class
                      ? `Class ${classes.find(c => c.id === formData.current_class)?.name || ''}`
                      : 'No class selected'}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push('/dashboard/staff/students/register')}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || (duplicateCheck?.is_duplicate && !ignoreDuplicate)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Register Student
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}