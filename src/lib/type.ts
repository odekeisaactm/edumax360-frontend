export * from './assessment.types';
export * from './result.types';
export * from './learning.types';

// User-related types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  user_type: 'staff' | 'student' | 'parent';
  is_superuser: boolean;
  profile?: {
    // Staff fields
    staff_id?: string;
    department?: string | null;
    position?: string | null;
    leadership_role?: string | null;
    wallet_balance?: string | number | null;
    // Shared fields
    image?: string | null;
    title?: string | null;
  };
}

// Authentication types
export interface LoginResponse {
  token: string;
  refresh: string;
  user: User;
  permissions: string[];
  active_modules: Module[];
  token_warning?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// Module types
export interface Module {
  code: string;
  name: string;
  category?: string;
}

// School information types
export interface SchoolInfo {
  id?: number;
  name: string;
  short_name: string;
  motto: string;
  website: string;
  email: string;
  mobile_1: string;
  mobile_2: string;
  address: string;
  logo: string;
  updated_at: string;
}

// AI Configuration
export interface SchoolAIConfig {
  id?: number;
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'deepseek' | 'custom' | 'local' | 'groq';
  model_name: string;
  monthly_token_limit: number;
  tokens_used_this_month: number;
  is_active: boolean;
  created_at?: string;
}

// WhatsApp Configuration
export interface WhatsAppConfig {
  id?: number;
  name: string;
  phone_number_id: string;
  is_active: boolean;
  created_at?: string;
}

// School settings types
export interface SchoolSettings {
  id?: number;
  // General Settings
  enable_notifications: boolean;
  separate_school_sections_data: boolean;
  // School Type
  school_type: 'day' | 'boarding' | 'mixed';
  // Academic Settings
  default_period_type: 'term' | 'semester' | 'quarter' | 'trimester';
  school_week_start_day: 'monday' | 'sunday' | 'saturday';
  // Portal Settings
  parent_portal_enabled: boolean;
  student_portal_enabled: boolean;
  // Data Management
  delete_archived_data_after_years: number;
  // Notification Settings
  enable_sms_notifications: boolean;
  enable_email_notifications: boolean;
  // Display & UI Settings
  items_per_page: 10 | 25 | 50 | 100;
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  // Backup & Maintenance
  enable_automatic_backup: boolean;
  backup_frequency_days: number;
  maintenance_mode: boolean;
  default_ai_config?: SchoolAIConfig | null;
  default_whatsapp_config?: WhatsAppConfig | null;
  updated_at: string;
}


// Dashboard types
export interface DashboardStats {
  active_students: number;
  total_staff: number;
  low_stock: number;
  total_sales_today: number;
  total_profit_today: number;
}

// Academic structure types
export interface SchoolSection {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  order: number;
}


// API response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

// Form types
export interface LoginFormValues {
  username: string;
  password: string;
  rememberMe?: boolean;
}

// Navigation types
export interface NavItem {
  name: string;
  href: string;
  icon: string;
  current?: boolean;
  children?: NavItem[];
  requiredPermissions?: string[];
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  loading: boolean;
  authReady: boolean;
  permissions: string[];
  activeModules: Module[];
}


// API error types
export interface ApiError {
  message: string;
  status: number;
  field?: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  error?: string;
  detail?: string;
  [key: string]: any;
}


// ==================== HR MODEL TYPES ====================

// HR Settings
export interface HRSettings {
  id?: number;
  // Staff ID Generation
  auto_generate_staff_id: boolean;
  staff_id_prefix: string;
  staff_id_length: number;
  // Barcode Settings
  generate_staff_barcode: boolean;
  // Feature Toggles
  use_salary_fields: boolean;
  use_health_fields: boolean;
  // Login Generation Settings
  auto_generate_staff_logins: boolean;
  staff_username_type: 'email' | 'staff_id' | 'custom';
  staff_password_type: 'random_alphanumeric' | 'random_alpha' | 'random_special' | 'first_name' | 'last_name' | 'first_last';
  staff_password_length: number;
  // Leave Settings
  auto_approve_leave: boolean;
  allow_leave_staff_login: boolean;
  // Metadata
  updated_at: string;
  created_at: string;
}

// Department
export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  staff_count?: number;
  positions_count?: number;
  created_at: string;
  updated_at: string;
}

// Position
export interface Position {
  id: number;
  name: string;
  code: string;
  department: number | Department;
  department_name?: string;
  description?: string;
  is_active: boolean;
  staff_count?: number;
  created_at: string;
  updated_at: string;
}

// Staff
export interface Staff {
  id: number;
  staff_id: string;
  title?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  address?: string;
  date_of_birth?: string;
  gender: 'male' | 'female';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  religion?: 'christianity' | 'islam' | 'traditional' | 'other';
  state?: string;
  lga?: string;
  blood_group?: string;
  genotype?: string;
  medical_conditions?: string;
  staff_type: 'academic' | 'non_academic' | 'both';
  department?: number | Department;
  department_name?: string;
  position?: number | Position;
  position_name?: string;
  employment_date?: string;
  group?: number | Group;
  group_name?: string;
  // Banking Information
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  // Files
  image?: string;
  image_url?: string;
  cv?: string;
  cv_url?: string;
  barcode?: string;
  barcode_url?: string;
  // Custom Fields
  extra_fields?: Record<string, any>;
  // Status
  status: 'active' | 'inactive' | 'suspended' | 'terminated' | 'on_leave';
  // Profile
  profile?: StaffProfile;
  // Counts
  documents_count?: number;
  leaves_count?: number;
  // Audit
  created_by?: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

// Staff Profile
export interface StaffProfile {
  id: number;
  username: string;
  is_active: boolean;
  default_password: string;
  password_changed: boolean;
  password_changed_at?: string;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

// Custom Staff Field
export interface CustomStaffField {
  id: number;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  is_required: boolean;
  choices?: string[];
  ordering: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Staff Document
export interface StaffDocument {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  document_type: 'certificate' | 'id_card' | 'license' | 'contract' | 'other';
  title: string;
  document: string;
  document_url?: string;
  description?: string;
  issue_date?: string;
  expiry_date?: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  uploaded_at: string;
}

// Staff Leave
export interface StaffLeave {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'emergency' | 'unpaid' | 'other';
  start_date: string;
  expected_end_date: string;
  actual_end_date?: string;
  status: 'pending' | 'approved' | 'active' | 'completed' | 'declined' | 'cancelled';
  reason: string;
  decline_reason?: string;
  notes?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

// Bulk Staff Upload
export interface BulkStaffUpload {
  id: number;
  file: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: {
    successful: number[];
    failed: Array<{
      row: number;
      errors: Record<string, string>;
    }>;
  };
  total_rows: number;
  successful_count: number;
  failed_count: number;
  error_message?: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}


// ==================== ACADEMIC MANAGEMENT TYPES ====================

// Academic Settings
export interface AcademicSettings {
  id?: number;
  use_class_sections: boolean;
  auto_promote_students: boolean;
  promotion_cutoff_score: string;
  use_promotion_cutoff: boolean;
  max_students_per_class: number;
  enable_subject_registration: boolean;
  updated_at: string;
}

// Class Section (already exists, but ensure it matches)
export interface ClassSection {
  id: number;
  name: string;
  code: string;
  school_section: number | SchoolSection | null;
  order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Class Model (update existing)
export interface ClassModel {
  id: number;
  name: string;
  short_name?: string;
  school_section: number | SchoolSection | null;
  school_section_name?: string;
  result_type: 'score' | 'text' | 'combined';
  is_graduation_class: boolean;
  next_class?: number;
  next_class_name?: string;
  order: number;
  is_active: boolean;
  configurations?: ClassConfiguration[];
  subjects?: number[];
  created_at: string;
  updated_at: string;
  // ADD THIS:
  can_have_special_student: boolean;
}


// Class Configuration
export interface ClassConfiguration {
  id: number;
  student_class: number | ClassModel;
  class_section?: number | ClassSection;
  class_section_name?: string;
  max_capacity?: number;
  form_teacher?: number;
  form_teacher_name?: string;
  assistant_form_teacher?: number;
  assistant_form_teacher_name?: string;
  class_rep?: number;
  assistant_class_rep?: number;
  is_active: boolean;
  student_count: number;
  created_at: string;
  updated_at: string;
  class_name?: string;           // from parent ClassModel
  result_type?: 'score' | 'text' | 'combined';  // from parent ClassModel
  can_have_special_student?: boolean;  // from parent ClassModel
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  subject_type: 'theory' | 'practical' | 'combined';
  school_section?: number | SchoolSection | null;
  school_section_name?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubjectGroup {
  id: number;
  name: string;
  code: string;
  description?: string;
  school_section: number | SchoolSection | null;  // Add | null
  school_section_name?: string;
  applicable_classes: number[];
  applicable_class_names?: string[];
  subjects: number[];
  subject_names?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Class Subject Configuration
export interface ClassSubjectConfiguration {
  id: number;
  class_configuration: number | ClassConfiguration;
  subject: number | Subject;
  subject_name?: string;
  teachers: number[];
  teacher_names?: string[];
  created_at: string;
  updated_at: string;
}

// Promotion Mapping
export interface PromotionMapping {
  id: number;
  from_class_config: number | ClassConfiguration;
  from_class_name?: string;
  to_class_config?: number | ClassConfiguration;
  to_class_name?: string;
  is_active: boolean;
  created_at: string;
}

// Student Class History
export interface StudentClassHistory {
  id: number;
  student: number;
  student_name?: string;
  session: number;
  session_name?: string;
  class_config: number | ClassConfiguration;
  class_name?: string;
  entry_type: 'new_admission' | 'promoted' | 'repeated' | 'transferred_in' | 'moved';
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'withdrawn' | 'transferred';
  promotion_status: 'pending' | 'promoted' | 'repeated' | 'graduated' | 'not_applicable';
  promoted_to_config?: number | ClassConfiguration;
  promoted_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Form Types

// AcademicSettings is missing a form type
export interface AcademicSettingsFormValues {
  use_class_sections: boolean;
  auto_promote_students: boolean;
  promotion_cutoff_score: string;
  use_promotion_cutoff: boolean;
  max_students_per_class: number;
  enable_subject_registration: boolean;
}

export interface ClassFormValues {
  name: string;
  short_name?: string;
  school_section: number;
  result_type: 'score' | 'text' | 'combined';
  is_graduation_class: boolean;
  can_have_special_student: boolean;
  next_class?: number;
  order: number;
  section_ids?: number[];
}

export interface SubjectFormValues {
  name: string;
  code: string;
  subject_type: 'theory' | 'practical' | 'combined';
  school_section?: number;
  description?: string;
  is_active: boolean;
}

export interface SubjectGroupFormValues {
  name: string;
  code: string;
  description?: string;
  school_section: number;
  applicable_classes: number[];
  subjects: number[];
  is_active: boolean;
}

export interface PromotionMappingFormValues {
  from_class_config_id: number;
  to_class_config_id?: number;
}

export interface BulkPromotionMappingFormValues {
  mappings: PromotionMappingFormValues[];
}

// Timetable
export interface Timetable {
  id: number;
  class_configuration: number | ClassConfiguration;
  class_configuration_name?: string;
  subject?: number | Subject;
  subject_name?: string;
  break_type?: 'short' | 'long' | 'closing';
  day: number;
  day_name?: string;
  start_time: string;
  end_time: string;
  teacher?: number;
  teacher_name?: string;
  classroom?: string;
  created_at: string;
  updated_at: string;
}

// Leadership Role
export interface LeadershipRole {
  id: number;
  role_type: 'head_teacher' | 'deputy_head' | 'section_head' | 'academic_director' | 'principal' | 'vice_principal';
  role_type_display?: string;
  staff: number;
  staff_name?: string;
  school_section?: number | null;
  school_section_name?: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Form Types
export interface TimetableFormValues {
  class_configuration: number;
  subject?: number;
  break_type?: 'short' | 'long' | 'closing';
  day: number;
  start_time: string;
  end_time: string;
  teacher?: number;
  classroom?: string;
}

export interface LeadershipRoleFormValues {
  role_type: 'head_teacher' | 'deputy_head' | 'section_head' | 'academic_director' | 'principal' | 'vice_principal';
  staff: number;
  school_section?: number;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  notes?: string;
}

// ==================== GROUP & PERMISSION TYPES ====================

// Group (Django auth.Group)
export interface Group {
  id: number;
  name: string;
  permissions_count?: number;
  permissions?: Permission[];
  users?: User[];
  user_count?: number;
}

// Permission (Django auth.Permission)
export interface Permission {
  id: number;
  name: string;
  codename: string;
  content_type: number;
  content_type_name?: string;
}

// ==================== UTILITY TYPES ====================

// State/LGA
export interface State {
  name: string;
  lgas: string[];
}

// Bank
export interface Bank {
  bank_name: string;
  code: string;
}

// Duplicate Check Result
export interface DuplicateCheckResult {
  is_duplicate: boolean;
  type: 'email' | 'mobile' | 'name' | null;
  message: string | null;
  staff_id: number | null;
  staff_name: string | null;
}

// ==================== FORM TYPES ====================

// Staff Form
export interface StaffFormValues {
  title?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  mobile?: string;
  address?: string;
  date_of_birth?: string;
  gender: 'male' | 'female';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  religion?: 'christianity' | 'islam' | 'traditional' | 'other';
  state?: string;
  lga?: string;
  blood_group?: string;
  genotype?: string;
  medical_conditions?: string;
  staff_type: 'academic' | 'non_academic' | 'both';
  department?: number;
  position?: number;
  employment_date?: string;
  group?: number;
  // Banking
  bank_name?: string;
  bank_code?: string;
  account_number?: string;
  account_name?: string;
  // Files
  image?: File;
  cv?: File;
  // Custom fields
  extra_fields?: Record<string, any>;
}

// Department Form
export interface DepartmentFormValues {
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

// Position Form
export interface PositionFormValues {
  name: string;
  code: string;
  department: number;
  description?: string;
  is_active: boolean;
}

// Custom Field Form
export interface CustomFieldFormValues {
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  is_required: boolean;
  choices?: string[];
  ordering: number;
  description?: string;
  is_active: boolean;
}

// Leave Form
export interface LeaveFormValues {
  staff: number;
  leave_type: 'annual' | 'sick' | 'maternity' | 'paternity' | 'emergency' | 'unpaid' | 'other';
  start_date: string;
  expected_end_date: string;
  reason: string;
  notes?: string;
}

// Group Form
export interface GroupFormValues {
  name: string;
}

// Permission Assignment Form
export interface PermissionAssignmentFormValues {
  permissions: string[];
}

// ==================== API RESPONSE TYPES ====================

// Paginated Staff List
export interface StaffListResponse extends PaginatedResponse<Staff> {}

// Custom Fields for Form
export interface CustomFieldForForm {
  id: number;
  name: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
  choices?: string[];
}

// Bulk Download Request
export interface BulkDownloadRequest {
  staff_ids: number[];
  fields: string[];
  format: 'excel' | 'pdf';
}

// ==================== FILTER & SEARCH TYPES ====================

// Staff List Filters
export interface StaffListFilters {
  status?: string;
  staff_type?: string;
  department?: number;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// Leave List Filters
export interface LeaveListFilters {
  status?: string;
  staff?: number;
  start_date?: string;
  end_date?: string;
}

// ==================== ACADEMIC CALENDAR TYPES ====================

// Day Model (Read-only)
export interface Day {
  id: number;
  name: string;
  order: number;
}

// Session Model
export interface Session {
  id: number;
  start_year: number;
  end_year: number;
  separator: '-' | '/';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Academic Period Model
export interface AcademicPeriod {
  id: number;
  name: string;
  short_name?: string;
  order: number;
  is_active: boolean;
}

// Academic Period Type Model
export interface AcademicPeriodType {
  id: number;
  singular_name: string;
  plural_name: string;
  periods_per_session: number;
  is_active: boolean;
  periods: AcademicPeriod[];
  current_period_id?: number; // Used when creating/updating
}

// Academic Session Period Model
export interface AcademicSessionPeriod {
  id: number;
  session: Session;
  period: AcademicPeriod;
  school_section?: SchoolSection;
  resumption_date?: string;
  closing_date?: string;
  next_resumption_date?: string;
  is_current: boolean;
  is_on_holiday: boolean;
  created_at: string;
  updated_at: string;
  // Write fields
  session_id?: number;
  period_id?: number;
  school_section_id?: number;
}

// Form types
export interface SessionFormValues {
  start_year: number;
  end_year: number;
  separator: '-' | '/';
}

export interface SchoolSectionFormValues {
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  order: number;
}

export interface AcademicPeriodFormValues {
  name: string;
  short_name?: string;
  order: number;
}

export interface AcademicPeriodTypeFormValues {
  singular_name: string;
  plural_name: string;
  periods_per_session: number;
  periods: AcademicPeriodFormValues[];
  current_period_id?: number;
}

export interface AcademicSessionPeriodFormValues {
  session_id: number;
  period_id: number;
  school_section_id?: number;
  resumption_date?: string;
  closing_date?: string;
  next_resumption_date?: string;
  is_current: boolean;
  is_on_holiday: boolean;
}



// ==================== FILTER TYPES ====================



export interface ExamFilters {
  exam_type?: string;
  session?: number;
  term?: number;
  is_published?: boolean;
  is_practice_mode?: boolean;
  search?: string;
}



////////////////////////////////////////////////
// ==================== STUDENT MANAGEMENT TYPES ====================

// Student Settings
export interface StudentSettings {
  id?: number;
  auto_generate_student_id: boolean;
  student_id_prefix: string;
  auto_generate_parent_id: boolean;
  parent_id_prefix: string;
  use_health_fields: boolean;
  generate_barcode: boolean;
  enable_fingerprint: boolean;
  max_fingerprint_count: number;
  auto_generate_logins: boolean;
  student_username_type: 'registration_number' | 'email' | 'custom';
  student_password_type: 'registration_number' | 'dob' | 'random_alphanumeric' | 'first_name';
  student_password_length: number;
  parent_username_type: 'email' | 'parent_id' | 'mobile' | 'custom';
  parent_password_type: 'random_alphanumeric' | 'random_alpha' | 'first_name' | 'last_name';
  parent_password_length: number;
  parent_portal_enabled: boolean;
  student_portal_enabled: boolean;
  show_user_form: boolean;
  updated_at: string;
}

// Utility
export interface Utility {
  id: number;
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
  student_count?: number;
  created_at: string;
  updated_at: string;
}

// Custom Field
export interface CustomField {
  id: number;
  field_for: 'student' | 'parent';
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
  is_required: boolean;
  choices?: string[];
  ordering: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Parent
export interface Parent {
  id: number;
  parent_id: string;
  title?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  address?: string;
  date_of_birth?: string;
  gender: 'male' | 'female';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  religion?: 'christianity' | 'islam' | 'traditional' | 'other';
  state?: string;
  lga?: string;
  occupation?: string;
  office_address?: string;
  office_mobile?: string;
  image?: string;
  image_url?: string;
  extra_fields?: Record<string, any>;
  status: string;
  profile?: ParentProfile;
  wards_count?: number;
  active_wards_count?: number;
  created_by?: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

// Parent Profile
export interface ParentProfile {
  id: number;
  username: string;
  is_active: boolean;
  default_password: string;
  last_login?: string;
  created_at: string;
}

// Student
export interface Student {
  id: number;
  registration_number: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name?: string;
  email?: string;
  mobile?: string;
  date_of_birth?: string;
  gender: 'male' | 'female';
  religion?: 'christianity' | 'islam' | 'traditional' | 'other';
  state?: string;
  lga?: string;
  blood_group?: string;
  genotype?: string;
  medical_conditions?: string;
  parent: number | Parent;
  parent_name?: string;
  relationship_with_parent: 'father' | 'mother' | 'guardian' | 'uncle' | 'aunt' | 'grandparent' | 'sibling' | 'other';
  current_class?: number;
  current_class_name?: string;
  current_class_section?: number;
  current_class_section_name?: string;
  subject_group?: number;
  utility_ids?: number[];
  image?: string;
  image_url?: string;
  barcode?: string;
  barcode_url?: string;
  extra_fields?: Record<string, any>;
  status: 'active' | 'suspended' | 'graduated' | 'withdrawn' | 'transferred';
  profile?: StudentProfile;
  documents_count?: number;
  fingerprints_count?: number;
  other_guardians_count?: number;
  created_by?: number;
  updated_by?: number;
  created_at: string;
  updated_at: string;
}

// Student Profile
export interface StudentProfile {
  id: number;
  username: string;
  is_active: boolean;
  default_password: string;
  last_login?: string;
  created_at: string;
}

// Other Guardian
export interface OtherGuardian {
  id: number;
  student: number;
  title?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name?: string;
  relationship: 'father' | 'mother' | 'guardian' | 'uncle' | 'aunt' | 'grandparent' | 'sibling' | 'other';
  relationship_display?: string;
  email?: string;
  mobile?: string;
  address?: string;
  occupation?: string;
  is_emergency_contact: boolean;
  created_at: string;
  updated_at: string;
}

// Student Document
export interface StudentDocument {
  id: number;
  student: number;
  document_type: 'birth_certificate' | 'id_card' | 'medical' | 'report' | 'other';
  document_type_display?: string;
  title: string;
  document: string;
  document_url?: string;
  description?: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  uploaded_at: string;
}

// Fingerprint
export interface Fingerprint {
  id: number;
  student: number;
  finger_name: 'left_thumb' | 'left_index' | 'left_middle' | 'left_ring' | 'left_little' |
                'right_thumb' | 'right_index' | 'right_middle' | 'right_ring' | 'right_little';
  finger_name_display?: string;
  fingerprint_template: string;
  quality_score?: number;
  capture_device?: string;
  is_active: boolean;
  last_used?: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// Duplicate Check Result (Student/Parent)
export interface StudentDuplicateCheckResult {
  is_duplicate: boolean;
  message: string | null;
  student_id: number | null;
  student_name: string | null;
}

export interface ParentDuplicateCheckResult {
  is_duplicate: boolean;
  type: 'email' | 'mobile' | 'name' | null;
  message: string | null;
  parent_id: number | null;
  parent_name: string | null;
}

// Form Values
export interface ParentFormValues {
  title?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  mobile?: string;
  address?: string;
  date_of_birth?: string;
  gender: 'male' | 'female';
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  religion?: 'christianity' | 'islam' | 'traditional' | 'other';
  state?: string;
  lga?: string;
  occupation?: string;
  office_address?: string;
  office_mobile?: string;
  image?: File;
  extra_fields?: Record<string, any>;
}

export interface StudentFormValues {
  first_name: string;
  middle_name?: string;
  last_name: string;
  email?: string;
  mobile?: string;
  date_of_birth?: string;
  gender: 'male' | 'female';
  religion?: 'christianity' | 'islam' | 'traditional' | 'other';
  state?: string;
  lga?: string;
  blood_group?: string;
  genotype?: string;
  medical_conditions?: string;
  parent: number;
  relationship_with_parent: 'father' | 'mother' | 'guardian' | 'uncle' | 'aunt' | 'grandparent' | 'sibling' | 'other';
  current_class?: number;
  current_class_section?: number;
  subject_group?: number;
  utility_ids?: number[];
  image?: File;
  extra_fields?: Record<string, any>;
}

// List Filters
export interface ParentListFilters {
  status?: string;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface StudentListFilters {
  status?: string;
  current_class?: number;
  current_class_section?: number;
  parent?: number;
  gender?: string;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

// Add to existing types

// Bulk Upload
export interface BulkStudentUpload {
  id: number;
  file: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: {
    successful: number[];
    failed: { row: number; errors: string }[];
  };
  total_rows: number;
  successful_count: number;
  failed_count: number;
  error_message?: string;
  uploaded_by?: number;
  uploaded_by_name?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// Password Reset
export interface ResetPasswordPayload {
  password_type: 'auto' | 'custom';
  custom_password?: string;
  send_email?: boolean;
}

export interface ResetPasswordResponse {
  username: string;
  new_password: string;
}

// Status Toggle
export interface ToggleStatusPayload {
  status: string;
}

export interface ToggleStatusResponse {
  id: number;
  old_status: string;
  new_status: string;
}

// Student List (lightweight)
export interface StudentListItem {
  id: number;
  registration_number: string;
  full_name: string;
  image_url?: string;
  email?: string;
  mobile?: string;
  gender: 'male' | 'female';
  parent_name?: string;
  current_class_name?: string;
  current_class_section_name?: string;
  status: 'active' | 'suspended' | 'graduated' | 'withdrawn' | 'transferred';
}

// Parent List (lightweight)
export interface ParentListItem {
  id: number;
  parent_id: string;
  full_name: string;
  image_url?: string;
  email?: string;
  mobile?: string;
  status: string;
  wards_count?: number;
}

// ==================== FEE MANAGEMENT TYPES ====================

export type WalletField = 'fee' | 'canteen';
export type PaymentMode = 'cash' | 'bank_transfer' | 'cheque' | 'wallet' | 'online' | 'other';
export type PaymentStatus = 'pending' | 'confirmed' | 'reverted';
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overpaid';
export type FeeOccurrence = 'periodic' | 'annually' | 'one_time';
export type DiscountType = 'percentage' | 'fixed';
export type WaiverStatus = 'pending' | 'approved' | 'rejected';

export interface StudentWallet {
  id: number;
  student: number;
  fee_balance: string;
  canteen_balance: string;
  unified_balance?: string;
  last_updated: string;
}

export interface WalletTransaction {
  id: number;
  wallet: number;
  transaction_type: string;
  wallet_field: WalletField;
  amount: string;
  balance_after: string;
  reason: string;
  reference: string;
  created_at: string;
}

export interface InvoiceItem {
  id: number;
  description: string;
  fee_master: number;
  fee_master_name?: string;
  amount: string;
  total_discount: string;
  total_waived: string;
  amount_paid: string;
  balance: string;
  discounts?: StudentDiscount[];
  fee_waivers?: FeeWaiver[];
}

export interface FamilyInvoiceItem {
  id: number;
  description: string;
  amount: string;
  amount_paid: string;
  balance: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  student: number;
  student_name?: string;
  session: number;
  session_display?: string;
  period: number;
  period_name?: string;
  status: InvoiceStatus;
  total_amount: string;
  total_discount: string;
  total_waived: string;
  amount_paid: string;
  balance: string;
  due_date?: string;
  items: InvoiceItem[];
  payments?: FeePayment[];
  created_at: string;
}

export interface FamilyInvoice {
  id: number;
  invoice_number: string;
  parent: number;
  parent_name?: string;
  session: number;
  period: number;
  period_name?: string;
  status: InvoiceStatus;
  total_amount: string;
  amount_paid: string;
  balance: string;
  due_date?: string;
  items: FamilyInvoiceItem[];
  payments?: FamilyFeePayment[];
}

export interface ItemBreakdownEntry {
  invoice_item_id: number;
  amount: string;
}

export interface FamilyItemBreakdownEntry {
  family_invoice_item_id: number;
  amount: string;
}

export interface FeePayment {
  id: number;
  invoice: number;
  invoice_number?: string;
  amount: string;
  payment_mode: PaymentMode;
  status: PaymentStatus;
  currency: string;
  bank_account?: number;
  bank_account_name?: string;
  date: string;
  reference: string;
  description: string;
  notes?: string;
  proof_of_payment?: string;
  confirmed_by?: number;
  confirmed_by_name?: string;
  confirmed_at?: string;
  item_breakdown: ItemBreakdownEntry[];
  created_at: string;
}

export interface FamilyFeePayment {
  id: number;
  invoice: number;
  amount: string;
  payment_mode: PaymentMode;
  status: PaymentStatus;
  date: string;
  reference: string;
  item_breakdown: FamilyItemBreakdownEntry[];
  created_at: string;
}

export interface OtherPayment {
  id: number;
  student: number;
  student_name?: string;
  description: string;
  category: string;
  amount: string;
  amount_paid: string;
  balance: string;
  currency: string;
  notes?: string;
  session?: number;
  period?: number;
  status: string;
  created_at: string;
}

export interface FeeGroup {
  id: number;
  name: string;
  description?: string;
  created_at: string;
}

export interface Fee {
  id: number;
  name: string;
  code: string;
  occurrence: FeeOccurrence;
  payment_period?: number; // AcademicPeriodModel PK
  parent_bound: boolean;
  is_protected: boolean;
  description?: string;
}

export interface PeriodFeeAmount {
  id: number;
  period: number;
  period_name: string;
  amount: string;
}

export interface FeeStructure {
  id: number;
  fee: number;
  fee_name?: string;
  group: number;
  group_name?: string;
  student_classes: number[];
  class_sections: number[];
  period_amounts: PeriodFeeAmount[];
  is_active: boolean;
}

export interface Discount {
  id: number;
  title: string;
  discount_type: DiscountType;
  occurrence: FeeOccurrence;
  applicable_fees: number[];
  applicable_classes: number[];
  is_protected: boolean;
  description?: string;
}

export interface DiscountApplication {
  id: number;
  discount: number;
  discount_title?: string;
  session?: number;
  period?: number;
  discount_amount: string;
  created_at: string;
}

export interface StudentDiscount {
  id: number;
  student: number;
  discount_application: number;
  invoice_item?: number;
  family_invoice_item?: number;
  amount_discounted: string;
  created_at: string;
}

export interface FeeWaiver {
  id: number;
  invoice_item?: number;
  family_invoice_item?: number;
  amount_waived: string;
  reason: string;
  status: WaiverStatus;
  requested_by?: number;
  reviewed_by?: number;
  rejection_reason?: string;
  created_at: string;
}

export type GatewayPurpose = 'fee_payment' | 'wallet_funding' | 'both';

export interface SchoolBankDetail {
  id: number;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  purpose: GatewayPurpose;
  current_balance: string;
  is_active: boolean;
}

export interface PaymentGatewayConfig {
  id: number;
  name: string;
  provider: 'paystack' | 'flutterwave' | 'custom';
  purpose: GatewayPurpose;
  is_active: boolean;
  is_default: boolean;
  public_key?: string;
  secret_key?: string;
  api_base_url?: string;
  webhook_secret?: string;
  created_at: string;
}

export interface StudentFinancialDashboard {
  student_id: number;
  student_name: string;
  student_class: string;
  registration_number: string;
  current_invoice: Invoice | null;
  family_invoice: FamilyInvoice | null;
  invoice_history: Invoice[];
  wallet: StudentWallet;
  other_payments_outstanding: OtherPayment[];
  total_outstanding: string;
}

export interface InvoiceGenerationJob {
  id: string;
  status: string;
  status_display: string;
  is_complete: boolean;
  total_students: number;
  processed_students: number;
  failed_students: number;
  progress_pct: number;
  error_message?: string;
  session: number;
  period: number;
  created_at: string;
  completed_at?: string;
}

export interface FeeSetting {
  id: number;
  auto_generate_invoice_on_enrollment: boolean;
  invoice_due_days_after_period_start: number;
  allow_inter_field_transfer: boolean;
  allow_sibling_transfer: boolean;
  wallet_unified: boolean;
  enable_auto_reminder: boolean;
  reminder_start_days_after_invoice: number;
  reminder_interval_days: number;
  send_invoice_email: boolean;
  send_payment_receipt_email: boolean;
  whatsapp_bot_enabled: boolean;
  bot_allow_proof_upload: boolean;
  bot_send_receipt: boolean;
  online_payment_auto_confirm: boolean;
  active_ai_config?: number;
  active_whatsapp_config?: number;
}