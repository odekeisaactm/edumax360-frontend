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
  classSectionsAPI, // Note: The Create page used local extraction, I'll stick to that pattern for consistency
  studentSettingsAPI,
} from '@/lib/api';
import {
  Parent,
  StudentSettings,
  CustomField,
  Utility,
  ClassModel,
  ClassSection,
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
  Search,
  Edit3,
  UserPlus,
  Undo,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const inputCls =
  'w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white transition-colors placeholder:text-slate-300 text-slate-800 disabled:bg-slate-50 disabled:text-slate-400';
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
  status: string;
}

// ─── Main Page Component ────────────────────────────────────────────────────────
export default function StudentUpdatePage() {
  const { hasPermission, user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const studentId = parseInt(params.id as string);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State
  const [loading, setLoading] = useState(true);
  const [loadingErrors, setLoadingErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [student, setStudent] = useState<any>(null); // Raw student data
  const [parent, setParent] = useState<Parent | null>(null); // Current Parent Object
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

  // Parent Change State
  const [showParentSearch, setShowParentSearch] = useState(false);
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [parentSearchResults, setParentSearchResults] = useState<Parent[]>([]);
  const [searchingParents, setSearchingParents] = useState(false);
  const [selectedNewParent, setSelectedNewParent] = useState<Parent | null>(null);
  const [showParentConfirm, setShowParentConfirm] = useState(false);
  const [parentChanged, setParentChanged] = useState(false);
  const [originalParentId, setOriginalParentId] = useState<number | null>(null);

  // Section expansion state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    academic: true,
    basic: true,
    contact: false,
    personal: false,
    medical: false,
    additional: false,
    utilities: false,
  });

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

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
    parent: 0,
    relationship_with_parent: 'father',
    current_class: null,
    current_class_section: null,
    subject_group: null,
    is_special_need: false,
    utility_ids: [],
    extra_fields: {},
    status: 'active',
  });

  const canEdit = user?.is_superuser || hasPermission('student_management.change_studentmodel');
  const showUserForm = settings?.show_user_form === true;
  const useClassSections = academicSettings?.use_class_sections === true;

  // ── Load reference data and student ──
  useEffect(() => {
    if (canEdit) {
      fetchData();
    }
  }, [canEdit, studentId]);

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

  // ── Parent Search Debounce ──
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (parentSearchTerm.trim().length >= 2) {
        handleParentSearch(parentSearchTerm);
      } else {
        setParentSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [parentSearchTerm]);

  // ── Fetch all data ──
    // ── Fetch all data ──
  const fetchData = async () => {
    setLoading(true);
    setLoadingErrors([]);

    try {
      // 1. Fetch Student Data First
      const studentData = await studentsAPI.get(studentId);
      setStudent(studentData);

      // 2. Fetch Reference Data in parallel
      const promises: Record<string, Promise<any>> = {
        settings: studentSettingsAPI.get(),
        customFields: studentCustomFieldsAPI.list('student'),
        utilities: utilitiesAPI.list(),
        classes: academicAPI.listClasses(),
        states: utilityAPI.getStates(),
        academicSettings: academicAPI.getSettings(),
        subjectGroups: academicAPI.listSubjectGroups(),
      };

      const results = await Promise.allSettled([
        promises.settings,
        promises.customFields,
        promises.utilities,
        promises.classes,
        promises.states,
        promises.academicSettings,
        promises.subjectGroups,
      ]);

      const errors: string[] = [];

      // 3. Process Reference Data
      if (results[0].status === 'fulfilled') setSettings(results[0].value);

      // Custom Fields
      if (results[1].status === 'fulfilled') {
        const fieldsData = results[1].value;
        const fieldsArray = Array.isArray(fieldsData) ? fieldsData : (fieldsData?.results || fieldsData?.data || []);
        setCustomFields(fieldsArray.filter((f: CustomField) => f.is_active));
      }

      // Utilities
      if (results[2].status === 'fulfilled') {
        const utilitiesData = results[2].value;
        const utilitiesArray = Array.isArray(utilitiesData) ? utilitiesData : (utilitiesData?.results || utilitiesData?.data || []);
        setUtilities(utilitiesArray.filter((u: Utility) => u.is_active));
      }

      // CLASSES - Store in local variable 'classesData' for immediate use
      let classesData: ClassModel[] = [];
      if (results[3].status === 'fulfilled') {
        const rawClasses = results[3].value;
        classesData = Array.isArray(rawClasses) ? rawClasses : (rawClasses?.results || rawClasses?.data || []);
        setClasses(classesData);
      }

      // States
      if (results[4].status === 'fulfilled') setStates(Array.isArray(results[4].value) ? results[4].value : []);

      // Academic Settings
      if (results[5].status === 'fulfilled') setAcademicSettings(results[5].value);

      // Subject Groups
      if (results[6].status === 'fulfilled') {
        const groupsData = results[6].value;
        setSubjectGroups(Array.isArray(groupsData) ? groupsData : (groupsData?.results || groupsData?.data || []));
      }

      if (errors.length > 0) {
        setLoadingErrors(errors);
      }

      // 4. Fetch Parent Data
      const parentId = typeof studentData.parent === 'number' ? studentData.parent : studentData.parent?.id;
      if (parentId) {
        setOriginalParentId(parentId);
        const parentData = await parentsAPI.get(parentId);
        setParent(parentData);
      }

      // 5. Populate Form Data
      const utilityIds = studentData.utilities?.map((u: any) => typeof u === 'number' ? u : u.id) || [];

      setFormData({
        first_name: studentData.first_name || '',
        middle_name: studentData.middle_name || '',
        last_name: studentData.last_name || '',
        email: studentData.email || '',
        mobile: studentData.mobile || '',
        date_of_birth: studentData.date_of_birth || '',
        gender: studentData.gender || '',
        religion: studentData.religion || '',
        state: studentData.state || '',
        lga: studentData.lga || '',
        blood_group: studentData.blood_group || '',
        genotype: studentData.genotype || '',
        medical_conditions: studentData.medical_conditions || '',
        parent: parentId,
        relationship_with_parent: studentData.relationship_with_parent || 'father',
        current_class: studentData.current_class ? (typeof studentData.current_class === 'number' ? studentData.current_class : (studentData.current_class as any).id) : null,
        current_class_section: studentData.current_class_section ? (typeof studentData.current_class_section === 'number' ? studentData.current_class_section : (studentData.current_class_section as any).id) : null,
        subject_group: studentData.subject_group ? (typeof studentData.subject_group === 'number' ? studentData.subject_group : (studentData.subject_group as any).id) : null,
        is_special_need: !!studentData.is_special_need,
        utility_ids: utilityIds,
        extra_fields: studentData.extra_fields || {},
        status: studentData.status || 'active',
      });

      // Set Image
      if (studentData.image_url) {
        setImagePreview(studentData.image_url);
      }

      // 6. Trigger Dependent Fetches
      if (studentData.state) {
        fetchLGAs(studentData.state);
      }

      // --- FIX: Trigger section fetch using the fresh 'classesData' ---
      if (studentData.current_class) {
        const classId = typeof studentData.current_class === 'number' ? studentData.current_class : (studentData.current_class as any).id;
        // Pass classesData explicitly so we don't wait for state update
        fetchSectionsForClass(classId, classesData);
      }

    } catch (error: any) {
      setError(extractError(error));
    } finally {
      setLoading(false);
    }
  };

  // ── Parent Search Logic ──
  const handleParentSearch = async (term: string) => {
    setSearchingParents(true);
    try {
      const res = await parentsAPI.list({ search: term, page_size: 10 });
     const data = Array.isArray(res) ? res : ((res as any)?.results || (res as any)?.data || []);
      setParentSearchResults(data as any as Parent[]);
    } catch (err) {
      setParentSearchResults([]);
    } finally {
      setSearchingParents(false);
    }
  };

  const handleSelectNewParent = (p: Parent) => {
    setSelectedNewParent(p);
    setShowParentConfirm(true);
    setParentSearchTerm('');
    setParentSearchResults([]);
  };

  const handleConfirmParentChange = () => {
    if (selectedNewParent) {
      setParent(selectedNewParent);
      setFormData(prev => ({ ...prev, parent: selectedNewParent.id }));
      setParentChanged(true);
      setShowParentSearch(false);
      setShowParentConfirm(false);
      setSelectedNewParent(null);
    }
  };

  const handleRevertParent = () => {
    if (originalParentId && parent?.id !== originalParentId) {
      // We need to fetch the original parent again if we lost it, or keep it in state.
      // For simplicity, we assume we just need to reset the form ID to originalParentId
      // and refetch the parent object.
      parentsAPI.get(originalParentId).then(p => {
        setParent(p);
        setFormData(prev => ({ ...prev, parent: originalParentId! }));
        setParentChanged(false);
      }).catch(() => {
        // If original parent deleted, handle gracefully
        setError('Original parent no longer exists.');
      });
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

  // ── Fetch sections for class (SAME LOGIC AS CREATE) ──
  // Added optional 'classList' parameter
  const fetchSectionsForClass = async (classId: number, classList?: ClassModel[]) => {
    setLoadingSections(true);
    try {
      // Use the provided classList if available, otherwise fallback to state
      const sourceClasses = classList || classes;

      const selectedClass = sourceClasses.find(c => c.id === classId);

      if (!selectedClass || !selectedClass.configurations?.length) {
        setSections([]);
        return;
      }

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
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    setError(null);
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

  // ── Handle image upload (Same as Create) ──
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

  // ── Handle camera (Same as Create) ──
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

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not get canvas context');
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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
    setImagePreview(student?.image_url || null); // Revert to original
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

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setError('Please fix the errors before submitting');
      if (errors.first_name || errors.last_name || errors.gender) {
        setOpenSections(prev => ({ ...prev, basic: true }));
      }
      if (errors.current_class || errors.relationship_with_parent) {
        setOpenSections(prev => ({ ...prev, academic: true }));
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

    setSubmitting(true);
    setError(null);

    try {
      const submitData = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
          if (key === 'utility_ids') {
            (value as number[]).forEach(id => submitData.append('utility_ids', String(id)));
          } else if (key === 'is_special_need') {
            submitData.append(key, value ? 'true' : 'false');
          } else if (key === 'extra_fields') {
            // handled separately below
          } else if (value === null || value === '') {
            // Explicitly send empty to clear the field on the backend
            submitData.append(key, '');
          } else {
            submitData.append(key, value as string);
          }
        });

      if (Object.keys(formData.extra_fields).length > 0) {
        submitData.append('extra_fields', JSON.stringify(formData.extra_fields));
      }

      if (imageFile) {
        submitData.append('image', imageFile);
      }

      await studentsAPI.update(studentId, submitData as any);

      setSuccess('Student updated successfully!');
      setTimeout(() => {
        router.push(`/dashboard/staff/students/${studentId}`);
      }, 1500);
    } catch (error: any) {
      setError(extractError(error));
    } finally {
      setSubmitting(false);
    }
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
      if (!group.applicable_classes || group.applicable_classes.length === 0) return false;
      return group.applicable_classes.some(cls => {
        const classId = typeof cls === 'object' ? (cls as any).id : cls;
        return classId === formData.current_class;
      });
    });
  }, [subjectGroups, formData.current_class]);

  const availableSubjectGroups = getSubjectGroupsForClass();

  // ── Permission check ──
  if (!canEdit) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to edit students.</p>
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
          <p className="text-gray-600">Loading student data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push(`/dashboard/staff/students/${studentId}`)}
          className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
              <Edit3 className="h-5 w-5 text-white" />
            </div>
            Edit Student
          </h1>
          <p className="text-sm text-slate-400 mt-0.5 pl-12">
            {student ? `Editing ${student.first_name} ${student.last_name}` : 'Loading...'}
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
                  title="Remove current photo"
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
                      <Upload className="h-3.5 w-3.5" /> Upload New
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

        {/* Guardian Information Section (Edit Mode: View + Change) */}
        <Section
          icon={<Users className="h-5 w-5 text-white" />}
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-700"
          title="Guardian Information"
          subtitle="Linked parent/guardian details"
          required
          open={openSections.academic}
          onToggle={() => toggleSection('academic')}
        >
          {parent && (
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
              </div>
            </div>
          )}

          {/* Parent Change Interface */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            {!showParentSearch && !parentChanged ? (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Change Guardian</h3>
                  <p className="text-xs text-slate-500">Search and assign a different parent to this student</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParentSearch(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm"
                >
                  <Search className="h-3.5 w-3.5" /> Search New
                </button>
              </div>
            ) : showParentSearch ? (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={parentSearchTerm}
                    onChange={(e) => setParentSearchTerm(e.target.value)}
                    placeholder="Type parent name (min 2 chars)..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setShowParentSearch(false);
                      setParentSearchTerm('');
                      setParentSearchResults([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {searchingParents && (
                  <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Searching...
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto space-y-1">
                  {parentSearchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectNewParent(p)}
                      className="w-full text-left px-3 py-2.5 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-slate-600">
                        {p.first_name[0]}{p.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {p.title} {p.first_name} {p.last_name}
                        </p>
                        <p className="text-xs text-slate-500">{p.mobile || 'No mobile'}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Confirmation Card for New Parent */}
                {showParentConfirm && selectedNewParent && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-blue-900">Confirm Change</p>
                        <p className="text-xs text-blue-700">
                          Set <strong>{selectedNewParent.first_name} {selectedNewParent.last_name}</strong> as guardian?
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirmParentChange}
                        className="text-xs font-semibold px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowParentConfirm(false);
                          setSelectedNewParent(null);
                        }}
                        className="text-xs font-semibold px-3 py-1.5 bg-white text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : parentChanged ? (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-xs font-bold text-amber-900">Parent Changed!</p>
                  <p className="text-xs text-amber-700">Remember to save form to apply.</p>
                </div>
                {originalParentId && parent?.id !== originalParentId && (
                  <button
                    type="button"
                    onClick={handleRevertParent}
                    className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1"
                  >
                    <Undo className="h-3 w-3" /> Revert
                  </button>
                )}
              </div>
            ) : null}
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

            {/* Status */}
            <div>
              <label className={labelCls}>
                Status <span className="text-red-500 normal-case">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className={inputCls}
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="transferred">Transferred</option>
              </select>
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
      </div>

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
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0">
              <Edit3 className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {formData.first_name || formData.last_name
                    ? [formData.first_name, formData.middle_name, formData.last_name].filter(Boolean).join(' ')
                    : 'Edit Student'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {formData.current_class
                    ? `Class ${classes.find(c => c.id === formData.current_class)?.name || ''}`
                    : 'No class selected'}
                </p>
              </>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/staff/students/${studentId}`)}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}