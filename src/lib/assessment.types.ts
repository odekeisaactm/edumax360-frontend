// ==================== ASSESSMENT CENTER TYPES ====================
// Auto-generated from backend models, serializers, and views
// assessment_center/models.py + serializers.py + views.py

// ============================================================================
// SHARED / PRIMITIVE TYPES
// ============================================================================

export type SetupStatus = 'draft' | 'partial' | 'ready' | 'ongoing' | 'completed';
export type LifecycleStatus = 'not_ready' | 'upcoming' | 'ongoing' | 'completed';
export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AIMarkingStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retry';
export type DeviceType = 'desktop' | 'laptop' | 'tablet' | 'mobile';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';
export type MarkingStrictness = 'lenient' | 'moderate' | 'strict' | 'very_strict';
export type GradingMethod = 'auto_system' | 'auto_ai' | 'ai_assisted' | 'manual';
export type ExamType = 'test' | 'quiz' | 'ca' | 'midterm' | 'exam' | 'practice';
export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'auto_submitted' | 'abandoned';

export type QuestionType =
  | 'objective'
  | 'subjective'
  | 'theory'
  | 'true_false'
  | 'fill_blank';

export type ProctoringEventType =
  | 'tab_switch'
  | 'window_blur'
  | 'copy_paste'
  | 'right_click'
  | 'print_screen'
  | 'webcam_snapshot'
  | 'face_not_detected'
  | 'multiple_faces'
  | 'suspicious_movement'
  | 'unusual_pattern';

export type ProctoringAction = 'ignored' | 'warning' | 'invalidated' | 'pending';
export type Proctoringseverity = 'low' | 'medium' | 'high' | 'critical';

export type AIServiceType = 'openai' | 'anthropic' | 'google' | 'local' | 'custom';

export type DeviceApprovalStatus = 'pending' | 'approved' | 'rejected';
export type DeviceCheckStatus = 'approved' | 'pending' | 'blocked' | 'unknown';

export type FileType = 'pdf' | 'image';

// ============================================================================
// AI CONFIGURATION
// ============================================================================

export interface AIServiceConfig {
  id: number;
  name: string;
  model_name: string;
  service_type: AIServiceType;
  api_endpoint: string;
  api_key?: string; // write-only, not returned on read
  default_temperature: number;
  default_max_tokens: number;
  is_active: boolean;
  monthly_token_limit?: number | null;
  tokens_used_this_month: number;
  tokens_remaining?: number | null;
  usage_percentage?: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface AssessmentAISettings {
  id: number;
  school_section?: number | null;
  school_section_name?: string | null;
  ai_service: number;
  ai_service_name?: string;
  enable_ai_marking: boolean;
  enable_ai_vetting: boolean;
  enable_ai_feedback: boolean;
  use_dob_for_exam_pin: boolean;
  marking_strictness: MarkingStrictness;
  grammar_tolerance: number; // 0–10
  spelling_weight: number;   // 0.0–1.0
  auto_mark_threshold: number; // 0.0–1.0
  updated_at: string;
}

export interface AssessmentAISettingsFormValues {
  school_section?: number | null;
  ai_service: number;
  enable_ai_marking: boolean;
  enable_ai_vetting: boolean;
  enable_ai_feedback: boolean;
  use_dob_for_exam_pin: boolean;
  marking_strictness: MarkingStrictness;
  grammar_tolerance: number;
  spelling_weight: number;
  auto_mark_threshold: number;
}

// ============================================================================
// EXAMINATION INFRASTRUCTURE
// ============================================================================

export interface ExaminationHall {
  id: number;
  name: string;
  code: string;
  capacity: number;
  location?: string | null;
  facilities?: string | null;
  school_section?: number | null;
  school_section_name?: string | null;
  is_active: boolean;
  available_capacity?: number;
  created_at: string;
  updated_at: string;
}

export interface ExaminationHallFormValues {
  name: string;
  code: string;
  capacity: number;
  location?: string;
  facilities?: string;
  school_section?: number | null;
  is_active: boolean;
}

export interface HallAvailability {
  hall: string;
  total_capacity: number;
  available_capacity: number;
  occupied: number;
  can_accommodate: boolean;
}

// ============================================================================
// DEVICE MANAGEMENT
// ============================================================================

export interface AuthorizedDevice {
  id: number;
  device_name: string;
  device_type: DeviceType;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string;
  browser_fingerprint?: string;
  browser?: string | null;
  os?: string | null;
  is_authorized: boolean;
  is_active: boolean;
  is_blocked: boolean;
  block_reason?: string | null;
  status_display?: string;
  authorized_by?: number | null;
  authorized_by_name?: string | null;
  authorized_at?: string | null;
  last_used?: string | null;
  times_used: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceApprovalRequest {
  id: number;
  device?: number | null;
  device_name?: string | null;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string;
  device_type: DeviceType;
  suggested_device_name?: string;
  status: DeviceApprovalStatus;
  requested_at: string;
  reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string;
}

export interface DeviceCheckResponse {
  status: DeviceCheckStatus;
  device_id?: number;
  device_name?: string;
  request_id?: number;
  message: string;
  reason?: string;  // ← add this
}

export interface DeviceInfo {
  device_fingerprint: string;
  ip_address: string;
  user_agent: string;
  device_type: DeviceType;
  suggested_name?: string;
}

export interface CaptureDeviceResponse {
  success: boolean;
  device_info: DeviceInfo & { suggested_name: string };
}

// ============================================================================
// TOPICS
// ============================================================================

export interface Topic {
  id: number;
  title: string;
  description?: string | null;
  subject: number;
  subject_name?: string;
  student_class: number;
  class_name?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface TopicDropdown {
  id: number;
  title: string;
}

export interface TopicFormValues {
  title: string;
  description?: string;
  subject: number;
  student_class: number;
}

// ============================================================================
// QUESTION BANKS
// ============================================================================

export interface QuestionBank {
  id: number;
  name: string;
  description?: string | null;
  subject: number;
  subject_name?: string;
  student_class: number;
  class_name?: string;
  topic?: number | null;
  topic_title?: string | null;
  school_section?: number | null;
  school_section_name?: string | null;
  difficulty_level?: DifficultyLevel | null;
  is_active: boolean;
  question_count?: number;
  question_types?: Record<QuestionType, number>;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionBankDetail extends QuestionBank {
  questions: Question[];
}

export interface QuestionBankFormValues {
  name: string;
  description?: string;
  subject: number;
  student_class: number;
  topic?: number | null;
  school_section?: number | null;
  difficulty_level?: DifficultyLevel | null;
  is_active: boolean;
}

export interface QuestionBankSearchParams {
  subject_id: number;
  class_id: number;
  topic_id?: number;
  difficulty_level?: DifficultyLevel;
  search?: string;
}

export interface QuestionBankStats {
  total_questions: number;
  by_type: Record<QuestionType, number>;
  by_difficulty: Record<DifficultyLevel, number>;
}

export interface QuestionBankWithStats {
  bank: QuestionBankDetail;
  questions: Question[];
  stats: QuestionBankStats;
}

// ============================================================================
// QUESTIONS
// ============================================================================

export interface QuestionOptions {
  A?: string;
  B?: string;
  C?: string;
  D?: string;
  E?: string;
  [key: string]: string | undefined;
}

export interface Question {
  id: number;
  question_bank: number;
  question_bank_name?: string;
  question_type: QuestionType;
  question_number?: number | null;
  sub_question_number?: string | null;
  question_text: string;
  diagram?: string | null;
  diagram_url?: string | null;
  // Objective / True-False
  options?: QuestionOptions | null;
  correct_answer?: string | null; // 'A'|'B'|'C'|'D'|'E' for objective, 'True'|'False' for true_false
  // Subjective / Theory
  model_answer?: string | null;
  keywords?: string[] | null;
  // Marking
  max_mark: number;
  difficulty_level: DifficultyLevel;
  order: number;
  // Analytics
  times_used: number;
  average_score?: number | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionFormValues {
  question_bank: number;
  question_type: QuestionType;
  question_number?: number | null;
  sub_question_number?: string | null;
  question_text: string;
  diagram?: File | null;
  options?: QuestionOptions | null;
  correct_answer?: string | null;
  model_answer?: string | null;
  keywords?: string[] | null;
  max_mark: number;
  difficulty_level: DifficultyLevel;
  order?: number;
}

export interface QuestionAnalytics {
  total_attempts: number;
  times_used_in_exams: number;
  average_score: number;
  max_mark: number;
  success_rate?: number | null; // objective only
  performance_percentage: number;
  difficulty_perception: 'Too Easy' | 'Appropriate' | 'Challenging' | 'Too Difficult' | 'Unknown';
}

export interface BulkCreateQuestionsPayload {
  question_bank_id: number;
  questions: QuestionFormValues[];
}

// ============================================================================
// EXAM CONFIGURATION
// ============================================================================

export interface Exam {
  id: number;
  name: string;
  exam_type: ExamType;
  session: number;
  session_name?: string;
  term: number;
  term_name?: string;
  subjects: number[];
  subjects_count?: number;
  classes: number[];
  classes_count?: number;
  start_date: string;
  end_date: string;
  instructions?: string | null;
  // Settings
  allow_review: boolean;
  show_results_immediately: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  allow_offline_mode: boolean;
  is_adaptive: boolean;
  is_practice_mode: boolean;
  total_marks: number;
  // Status
  is_published: boolean;
  is_active: boolean;
  schedules_created: boolean;
  schedules_progress?: SchedulesProgress;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulesProgress {
  total: number;
  ready: number;
  percentage: number;
}

export interface ExamFormValues {
  name: string;
  exam_type: ExamType;
  session: number;
  term: number;
  subjects: number[];
  classes: number[];
  start_date: string;
  end_date: string;
  instructions?: string;
  allow_review: boolean;
  show_results_immediately: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  allow_offline_mode: boolean;
  is_adaptive: boolean;
  is_practice_mode: boolean;
  total_marks: number;
}

export interface ExamDetail extends Exam {
  schedules: ExamSchedule[];
}

export interface ScheduleCreationStatus {
  status: 'pending' | 'in_progress' | 'completed';
  schedules_created: boolean;
  total_schedules: number;
  message: string;
}

// ============================================================================
// EXAM SCHEDULES
// ============================================================================

export interface QuestionsStatus {
  expected: number;
  actual: number;
  percentage: number;
  complete: boolean;
}

export interface StudentsInfo {
  total: number;
  attempted: number;
  submitted: number;
  pending: number;
}

export interface ExamSchedule {
  id: number;
  exam: number;
  exam_name?: string;
  exam_type?: ExamType;
  subject: number;
  subject_name?: string;
  subject_code?: string;
  class_configuration: number;
  class_name?: string;
  section_name?: string | null;
  // Timing
  start_datetime: string;
  end_datetime?: string;
  duration_minutes: number;
  grace_period_minutes: number;
  final_deadline?: string;
  // Auth
  exam_code: string;
  requires_password: boolean;
  // Location
  examination_hall?: number | null;
  hall_name?: string | null;
  invigilators?: number[];
  // Question requirements
  total_objective_questions: number;
  total_theory_questions: number;
  total_subjective_questions: number;
  total_marks: number;
  // Status
  setup_status: SetupStatus;
  lifecycle_status?: LifecycleStatus;
  // Aggregated
  questions_status?: QuestionsStatus;
  students_info?: StudentsInfo;
  created_at: string;
  updated_at: string;
}

export interface ExamScheduleDetail extends ExamSchedule {
  sections: ExamSection[];
  questions: ExamQuestionDetail[];
  students: StudentAttemptSummary[];
  statistics?: ExamScheduleStatistics | null;
  is_published: boolean;
}

export interface ExamScheduleStatistics {
  highest_score: number;
  lowest_score: number;
  average_score: number;
  total_attempts: number;
}

export interface ExamScheduleUpdateFormValues {
  start_datetime: string;
  duration_minutes: number;
  grace_period_minutes: number;
  examination_hall?: number | null;
  invigilators?: number[];
  requires_password: boolean;
}

export interface QuestionRequirementsFormValues {
  total_objective_questions: number;
  total_theory_questions: number;
  total_subjective_questions: number;
}

export interface QuestionRequirementsResponse {
  success: boolean;
  message: string;
  setup_status: SetupStatus;
  requirements: {
    objective: number;
    theory: number;
    subjective: number;
    total: number;
  };
}

export interface ValidateQuestionsResponse {
  success: boolean;
  setup_status: SetupStatus;
  questions: {
    objective: { expected: number; actual: number; complete: boolean };
    theory: { expected: number; actual: number; complete: boolean };
    subjective: { expected: number; actual: number; complete: boolean };
  };
  all_complete: boolean;
}

// Schedule grouped by subject (from schedules_status endpoint)
export interface ScheduleBySubjectItem {
  id: number;
  class: string;
  section: string | null;
  full_class_name: string;
  exam_code: string;
  setup_status: SetupStatus;
  lifecycle_status: LifecycleStatus;
  start_datetime: string;
  duration_minutes: number;
  questions_complete: boolean;
  total_questions: number;
  expected_questions: number;
  students_count: number;
  attempts_count: number;
  submitted_count: number;
}

export interface SchedulesBySubject {
  [subjectName: string]: {
    subject_id: number;
    subject_code: string;
    schedules: ScheduleBySubjectItem[];
  };
}

export interface ExamSchedulesStatusResponse {
  exam: Exam;
  schedules_by_subject: SchedulesBySubject;
  summary: {
    total_schedules: number;
    ready: number;
    partial: number;
    draft: number;
    ongoing: number;
    completed: number;
  };
}

// ============================================================================
// EXAM SECTIONS
// ============================================================================

export interface ExamSection {
  id: number;
  exam_schedule: number;
  name: string;
  instructions?: string | null;
  order: number;
  total_questions: number;
  questions_to_answer: number;
  instruction_text?: string;
  questions_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ExamSectionFormValues {
  exam_schedule: number;
  name: string;
  instructions?: string;
  order: number;
  total_questions: number;
  questions_to_answer: number;
}

// ============================================================================
// EXAM QUESTIONS (assigned to schedule)
// ============================================================================

export interface ExamQuestion {
  id: number;
  exam_schedule: number;
  exam_section?: number | null;
  section_name?: string | null;
  question: number;
  question_text?: string;
  question_type?: QuestionType;
  order: number;
  custom_mark?: number | null;
  mark?: number;
  created_at: string;
}

export interface ExamQuestionDetail {
  id: number;
  exam_schedule: number;
  exam_section?: number | null;
  section_name?: string | null;
  question_data: Question;
  order: number;
  custom_mark?: number | null;
  mark: number;
  created_at: string;
}

export interface BulkAddQuestionsPayload {
  exam_schedule_id: number;
  exam_section_id?: number | null;
  question_ids: number[];
}

export interface BulkAddQuestionsResponse {
  success: boolean;
  message: string;
  added_ids: number[];
  setup_status: SetupStatus;
  total_questions: number;
}

export interface ReorderQuestionsPayload {
  exam_schedule_id: number;
  question_order: number[]; // list of ExamQuestion IDs in new order
}

// ============================================================================
// STUDENT EXAM ACCESS (PINs)
// ============================================================================

export interface StudentExamAccess {
  id: number;
  exam: number;
  student: number;
  student_full_name: string;
  registration_number: string;
  class_name: string;
  class_section_name?: string | null;
  pin: string;
  is_used: boolean;
  used_at?: string | null;
  created_at: string;
}

export interface StudentPinsResponse {
  exam: {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
  };
  total_pins: number;
  pins: StudentExamAccess[];
}

// ============================================================================
// STUDENT EXAM ATTEMPTS
// ============================================================================

export interface StudentExamAttempt {
  id: number;
  attempt_id: string; // UUID
  student: number;
  student_name?: string;
  exam_schedule: number;
  exam_name?: string;
  subject_name?: string;
  device?: number | null;
  device_name?: string | null;
  examination_hall?: number | null;
  hall_name?: string | null;
  status: AttemptStatus;
  started_at?: string | null;
  submitted_at?: string | null;
  time_spent_seconds: number;
  remaining_time_seconds?: number;
  total_score?: number | null;
  percentage?: number | null;
  cheating_flags_count: number;
  is_flagged_for_review: boolean;
  is_offline_attempt: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentAttemptSummary {
  student: Record<string, any>; // StudentSerializer output
  has_attempted: boolean;
  attempt_status?: AttemptStatus | null;
  score?: number | null;
  percentage?: number | null;
  submitted_at?: string | null;
}

export interface StudentsListResponse {
  schedule: {
    id: number;
    exam_name: string;
    subject: string;
    class: string;
  };
  students: StudentAttemptSummary[];
  summary: {
    total: number;
    attempted: number;
    submitted: number;
    in_progress: number;
    not_started: number;
  };
}

// ============================================================================
// STUDENT ANSWERS
// ============================================================================

export interface StudentAnswer {
  id: number;
  attempt: number;
  exam_question: number;
  question_text?: string;
  question_type?: QuestionType;
  max_mark?: number;
  // Objective
  selected_option?: string | null;
  // Subjective / Theory
  answer_text?: string | null;
  answer_file?: string | null;
  // Grading
  is_graded: boolean;
  score_awarded?: number | null;
  grading_method?: GradingMethod | null;
  graded_by?: number | null;
  graded_at?: string | null;
  // AI
  ai_confidence?: number | null;
  ai_feedback?: string | null;
  // Review
  flagged_for_review: boolean;
  review_notes?: string | null;
  // Metadata
  answered_at: string;
  last_saved_at: string;
  save_count: number;
}

export interface SaveAnswerPayload {
  attempt_id: string;
  exam_question_id: number;
  selected_option?: string | null;
  answer_text?: string | null;
}

export interface BulkSaveAnswersPayload {
  attempt_id: string;
  answers: Array<{
    exam_question_id: number;
    selected_option?: string | null;
    answer_text?: string | null;
  }>;
}

// ============================================================================
// EXAM ENTRY & STUDENT FLOW
// ============================================================================

export interface ExamCodeVerifyResponse {
  valid: boolean;
  exam_schedule_id: number;
  exam_details: {
    name: string;
    subject: string;
    class: string;
    duration_minutes: number;
    start_datetime: string;
    requires_password: boolean;
  };
}

export interface ExamAuthResponse {
  authenticated: boolean;
  student: {
    id: number;
    name: string;
    registration_number: string;
    photo?: string | null;
  };
  exam_details: {
    name: string;
    subject: string;
    instructions?: string | null;
    duration_minutes: number;
    start_datetime: string;
    end_datetime: string;
    final_deadline: string;
    total_marks: number;
    allow_review: boolean;
  };
  can_start: boolean;
  reason: string;
}

export interface ExamEntryValidationPayload {
  exam_code: string;
  admission_number: string;
  pin: string;
  device_fingerprint: string;
}

export interface ExamEntryValidationResponse {
  success: boolean;
  message: string;
  attempt_id: string;
  exam_title: string;
  duration_minutes: number;
  instructions?: string | null;
}

// Question as returned during exam (no correct_answer/model_answer/keywords)
export interface ExamQuestion_Student {
  id: number;
  exam_question_id: number;
  order: number;
  question_type: QuestionType;
  question_number?: number | null;
  sub_question_number?: string | null;
  question_text: string;
  diagram?: string | null;
  max_mark: number;
  options?: QuestionOptions | null; // only for objective
  section?: string | null;
}

export interface ExamSectionStudent {
  id: number;
  name: string;
  instructions?: string | null;
  total_questions: number;
  questions_to_answer: number;
  instruction_text: string;
  questions: ExamQuestion_Student[];
}

export interface ExamStartResponse {
  success: boolean;
  attempt: StudentExamAttempt;
  questions: ExamQuestion_Student[];
  sections?: ExamSectionStudent[] | null;
  exam_config: {
    duration_minutes: number;
    final_deadline: string;
    allow_review: boolean;
    randomize_questions: boolean;
    randomize_options: boolean;
  };
  remaining_time_seconds: number;
}

export interface ExamSubmitResponse {
  success: boolean;
  message: string;
  attempt: {
    attempt_id: string;
    status: AttemptStatus;
    submitted_at: string;
    time_spent_seconds: number;
    total_score?: number | null;
    percentage?: number | null;
  };
  show_results_immediately: boolean;
  pending_grading: number;
}

// ============================================================================
// EXAM RESULT (student view)
// ============================================================================

export interface AnswerResult {
  question_number?: number | null;
  sub_question_number?: string | null;
  question_text: string;
  question_type: QuestionType;
  section?: string | null;
  max_mark: number;
  is_graded: boolean;
  score_awarded?: number | null;
  grading_method?: GradingMethod | null;
  ai_feedback?: string | null;
  // Objective only
  selected_option?: string | null;
  correct_answer?: string | null;
  is_correct?: boolean;
  options?: QuestionOptions | null;
  // Subjective/Theory
  answer_text?: string | null;
  model_answer?: string | null; // staff only
}

export interface ExamResultResponse {
  attempt: StudentExamAttempt;
  exam_details: {
    name: string;
    subject: string;
    total_marks: number;
  };
  answers: AnswerResult[];
  statistics: {
    total_questions: number;
    graded: number;
    pending: number;
    correct?: number | null;
  };
}

// ============================================================================
// STUDENT DASHBOARD
// ============================================================================

export interface StudentDashboardScheduleItem {
  id: number;
  exam_name: string;
  exam_type: ExamType;
  subject: string;
  exam_code: string;
  start_datetime: string;
  duration_minutes: number;
  total_marks: number;
  has_attempted: boolean;
  attempt_status?: AttemptStatus | null;
  score?: number | null;
  percentage?: number | null;
}

export interface StudentDashboardResponse {
  student: {
    name: string;
    class: string;
  };
  upcoming: StudentDashboardScheduleItem[];
  in_progress: StudentDashboardScheduleItem[];
  completed: StudentDashboardScheduleItem[];
  practice: StudentDashboardScheduleItem[];
  summary: {
    upcoming_count: number;
    in_progress_count: number;
    completed_count: number;
    practice_count: number;
  };
}

// ============================================================================
// PROCTORING
// ============================================================================

export interface ProctoringEvent {
  id: number;
  attempt: number;
  student_name?: string;
  exam_name?: string;
  event_type: ProctoringEventType;
  event_data?: Record<string, any> | null;
  snapshot?: string | null;
  severity: Proctoringseverity;
  invigilator_notified: boolean;
  notified_at?: string | null;
  reviewed: boolean;
  reviewed_by?: number | null;
  review_notes?: string | null;
  action_taken?: ProctoringAction | null;
  created_at: string;
}

export interface ProctoringEventCreatePayload {
  attempt_id: string;
  event_type: ProctoringEventType;
  event_data?: Record<string, any>;
  snapshot?: File | null;
  severity?: Proctoringseverity;
}

export interface ActiveStudentProctoring {
  attempt_id: string;
  student: {
    id: number;
    name: string;
    registration_number: string;
    photo?: string | null;
  };
  device: {
    name?: string | null;
    type?: DeviceType | null;
  };
  hall?: string | null;
  started_at?: string | null;
  time_spent_seconds: number;
  remaining_seconds: number;
  cheating_flags_count: number;
  is_flagged: boolean;
  answers_saved: number;
}

export interface ProctoringDashboardResponse {
  exam_schedule: {
    id: number;
    exam_name: string;
    subject: string;
    class: string;
    start_datetime: string;
    end_datetime: string;
    final_deadline: string;
  };
  active_students: ActiveStudentProctoring[];
  recent_events: ProctoringEvent[];
  flagged_students: Array<{
    attempt_id: string;
    student: string;
    flags_count: number;
    status: AttemptStatus;
  }>;
  statistics: {
    total_students: number;
    currently_taking: number;
    submitted: number;
    not_started: number;
    flagged_count: number;
    total_events: number;
    critical_events: number;
  };
}

export interface InvigilatorSession {
  id: number;
  invigilator: number;
  invigilator_name?: string;
  exam_schedule: number;
  exam_name?: string;
  session_start: string;
  session_end?: string | null;
  is_active: boolean;
  connection_id?: string | null;
}

// ============================================================================
// SCANNED ANSWER SHEETS
// ============================================================================

export interface ScannedAnswerSheet {
  id: number;
  attempt: number;
  student_name?: string;
  file: string;
  file_type: FileType;
  part_number: number;
  total_parts: number;
  ocr_status: OcrStatus;
  ai_grading_status: OcrStatus;
  extracted_text?: string | null;
  detected_answers?: Record<string, { text: string; confidence: number }> | null;
  uploaded_by?: number | null;
  uploaded_at: string;
  processed_at?: string | null;
}

export interface ScannedSheetUploadPayload {
  attempt_id: string;
  file: File;
  part_number?: number;
  total_parts?: number;
}

export interface ScannedSheetProcessingStatus {
  id: number;
  ocr_status: OcrStatus;
  ai_grading_status: OcrStatus;
  processed_at?: string | null;
  answers_detected: number;
}

// ============================================================================
// MARKING
// ============================================================================

export interface MarkAnswerPayload {
  answer_id: number;
  score: number;
  feedback?: string;
}

export interface BulkMarkAnswersPayload {
  marks: MarkAnswerPayload[];
}

export interface UngradeAnswerForMarking {
  answer_id: number;
  question_text: string;
  question_type: QuestionType;
  answer_text?: string | null;
  max_mark: number;
  model_answer?: string | null;
  keywords?: string[] | null;
  ai_confidence?: number | null;
  ai_feedback?: string | null;
}

export interface StudentMarkingGroup {
  student_id: number;
  attempt_id: string;
  answers: UngradeAnswerForMarking[];
}

export interface MarkingDashboardResponse {
  exam_schedule?: {
    id: number;
    exam_name: string;
    subject: string;
    class: string;
  };
  total_ungraded: number;
  by_student?: Record<string, StudentMarkingGroup>;
  by_schedule?: Record<string, { schedule_id: number; count: number }>;
}

// ============================================================================
// TEACHER DASHBOARD
// ============================================================================

export interface TeacherScheduleItem {
  id: number;
  exam_name: string;
  exam_type: ExamType;
  subject: string;
  class: string;
  exam_code: string;
  start_datetime: string;
  setup_status: SetupStatus;
  lifecycle_status: LifecycleStatus;
  students_count: number;
  attempts_count: number;
  submitted_count: number;
  pending_marks?: number;
}

export interface TeacherDashboardResponse {
  teacher: {
    name: string;
    role: string;
  };
  upcoming: TeacherScheduleItem[];
  ongoing: TeacherScheduleItem[];
  needs_marking: TeacherScheduleItem[];
  completed: TeacherScheduleItem[];
  summary: {
    upcoming_count: number;
    ongoing_count: number;
    needs_marking_count: number;
    completed_count: number;
  };
}

// ============================================================================
// RESULT TRANSFER
// ============================================================================

export interface ExamResultTransferConfig {
  id: number;
  exam: number;
  exam_name?: string;
  result_field: number;
  result_field_name?: string;
  auto_transfer: boolean;
  scale_score: boolean;
  transfer_on_publish: boolean;
  last_transfer_date?: string | null;
  students_transferred: number;
  created_at: string;
  updated_at: string;
}

export interface TransferPreviewItem {
  student: string;
  subject: string;
  original_score: number;
  scaled_score?: number | null;
  final_score: number;
}

export interface TransferPreviewResponse {
  config: ExamResultTransferConfig;
  total_students: number;
  preview: TransferPreviewItem[];
  note: string;
}

export interface TransferExecuteResponse {
  success: boolean;
  students_transferred: number;
  transfer_date: string;
}

// ============================================================================
// AI MARKING QUEUE
// ============================================================================

export interface AIMarkingQueue {
  id: number;
  answer: number;
  student_name?: string;
  question_text?: string;
  status: AIMarkingStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  error_message?: string | null;
  celery_task_id?: string | null;
  created_at: string;
  processed_at?: string | null;
}

export interface AIMarkingQueueStats {
  stats: Record<AIMarkingStatus, number>;
  total: number;
}

// ============================================================================
// ANALYTICS
// ============================================================================

export interface SubjectAnalyticsSummary {
  subject: string;
  attempts: number;
  average_score: number;
  average_percentage: number;
}

export interface ClassAnalyticsSummary {
  class: string;
  attempts: number;
  average_score: number;
  average_percentage: number;
}

export interface ExamAnalyticsResponse {
  exam: {
    id: number;
    name: string;
    exam_type: ExamType;
    session: string;
    term: string;
  };
  overall: {
    total_students: number;
    total_attempts: number;
    submitted: number;
    completion_rate: number;
    highest_score?: number | null;
    lowest_score?: number | null;
    average_score?: number | null;
    average_percentage?: number | null;
  };
  by_subject: SubjectAnalyticsSummary[];
  by_class: ClassAnalyticsSummary[];
}

export interface ClassPerformanceExamItem {
  exam_name: string;
  subject: string;
  exam_type: ExamType;
  total_marks: number;
  attempts: number;
  total_students: number;
  average_score: number;
  average_percentage: number;
  highest_score: number;
  lowest_score: number;
}

export interface ClassPerformanceReportResponse {
  class: string;
  session: string;
  term: string;
  exams: ClassPerformanceExamItem[];
  summary: {
    total_exams: number;
    overall_average: number;
  };
}

export interface ExamMaxMarkResponse {
  class_configuration_id: number;
  configuration_group: string;
  field_set: string;
  exam_max_mark: number;
}

export interface QuestionBulkUploadStatus {
  id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  successful_count: number;
  failed_count: number;
  error_message?: string;
  results?: {
    failed: { row: number; data: string; reason: string }[];
  };
  started_at?: string;
  completed_at?: string;
}

export interface QuestionBulkTemplateParams {
  question_type: 'objective' | 'theory' | 'subjective' | 'true_false' | 'fill_blank';
  number_of_options: number;
  option_label_style: 'ABC' | 'abc' | '123' | 'roman';
  number_of_questions: number;
}


