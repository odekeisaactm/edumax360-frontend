// ============================================================
// LEARNING RESOURCES — TYPES
// ============================================================

// ------------------------------------------------------------
// 1. Shared Mini Types
// ------------------------------------------------------------

export interface UserMini {
  id: number;
  full_name: string;
  email: string;
}

export interface SubjectMini {
  id: number;
  name: string;
  code: string;
}

export interface ClassConfigMini {
  id: number;
  name: string;
}

// ------------------------------------------------------------
// 2. Settings & AI Configuration
// ------------------------------------------------------------

export interface LearningResourcesSettings {
  id: number;
  school_section: number | null;
  school_section_name: string;
  ai_service: number | null;
  ai_service_name: string;
  // Content Generation Flags
  enable_auto_note_generation: boolean;
  enable_auto_summary: boolean;
  enable_auto_flashcards: boolean;
  enable_auto_quiz_generation: boolean;
  // Vetting & Approvals
  enable_ai_vetting: boolean;
  vetting_criteria: Record<string, boolean>;
  auto_approve_threshold: number;
  auto_approve_lesson_notes: boolean;
  auto_approve_scheme_of_work: boolean;
  // Summary Settings
  summary_length: 'short' | 'medium' | 'long';
  key_points_count: number;
  // TTS Settings
  enable_text_to_speech: boolean;
  tts_voice: string;
  tts_speed: number;
  // Recording
  enable_live_recording: boolean;
  updated_at: string;
}

// ------------------------------------------------------------
// 3. Scheme of Work (MVP)
// ------------------------------------------------------------

export type SchemeOfWorkStatus = 'draft' | 'submitted' | 'approved' | 'declined';

export interface SchemeOfWorkWeek {
  id: number;
  scheme_of_work: number;
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  topic: string;
  sub_topics: string | null;
  planned_objectives: string | null;
  planned_activities: string | null;
  reference_materials: string | null;
  lesson_note: number | null;
  is_holiday_or_break: boolean;
  has_note: boolean;
  is_overdue: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchemeOfWorkList {
  id: number;
  title: string;
  subject_name: string;
  status: SchemeOfWorkStatus;
  session: number;
  term: number;
  week_count: number;
  created_at: string;
  updated_at: string;
}

export interface SchemeOfWorkDetail {
  id: number;
  title: string;
  subject: SubjectMini;
  subject_id: number;
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];
  session: number;
  term: number;
  school_section: number | null;
  status: SchemeOfWorkStatus;
  approved_by: UserMini | null;
  approved_at: string | null;
  decline_reason: string | null;
  declined_by: UserMini | null;
  declined_at: string | null;
  weeks: SchemeOfWorkWeek[];
  created_by: UserMini | null;
  created_at: string;
  updated_at: string;
}

export interface SchemeOfWorkCreate {
  title: string;
  subject: number;
  class_configuration_ids: number[];
  session: number;
  term: number;
  school_section?: number | null;
}

export interface SchemeOfWorkApprovalPayload {
  action: 'approve' | 'decline';
  decline_reason?: string;
}

// ------------------------------------------------------------
// 4. Lesson Notes (MVP)
// ------------------------------------------------------------

export type LessonNoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'declined'
  | 'archived';

export type LessonNoteCreationMethod = 'manual' | 'ai_generated' | 'uploaded';

export interface LessonNoteList {
  id: number;
  title: string;
  subject_name: string;
  classes: string[];
  status: LessonNoteStatus;
  creation_method: LessonNoteCreationMethod;
  grant_student_access: boolean;
  scheduled_date: string | null;
  ai_vetting_score: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonNoteDetail {
  id: number;
  title: string;
  content: string;
  creation_method: LessonNoteCreationMethod;
  attachment: string | null;
  subject: SubjectMini;
  subject_id: number;
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];
  scheduled_date: string | null;
  scheduled_time: string | null;
  topic: string | null;
  learning_objectives: string | null;
  instructional_materials: string | null;
  status: LessonNoteStatus;
  ai_vetting_score: number | null;
  ai_vetting_feedback: string | null;
  ai_vetted_at: string | null;
  approved_by: UserMini | null;
  approved_at: string | null;
  decline_reason: string | null;
  declined_by: UserMini | null;
  declined_at: string | null;
  grant_student_access: boolean;
  session: number;
  session_name: string;
  term: number;
  term_name: string;
  school_section: number | null;
  created_by: UserMini | null;
  created_at: string;
  updated_at: string;
  // Computed
  can_student_view: boolean;
  has_tts: boolean;
  has_summary: boolean;
  materials_count: number;
}

export interface LessonNoteCreate {
  title: string;
  content: string;
  creation_method: LessonNoteCreationMethod;
  attachment?: File | null;
  subject: number;
  class_configuration_ids: number[];
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  topic?: string | null;
  learning_objectives?: string | null;
  instructional_materials?: string | null;
  session: number;
  term: number;
  school_section?: number | null;
}

export interface LessonNoteApprovalPayload {
  action: 'approve' | 'decline';
  decline_reason?: string;
}

export interface LessonNoteGrantAccessPayload {
  grant_student_access: boolean;
}

export interface LessonNotePreviewReviewResponse {
  overall_score: number;
  feedback: string;
  suggestions: string[];
  checks: Record<string, { score: number; comment: string }>;
  passed: boolean;
  threshold: number;
}

// ------------------------------------------------------------
// 5. Lesson Materials (MVP)
// ------------------------------------------------------------

export type LessonMaterialType =
  | 'video'
  | 'pdf'
  | 'document'
  | 'presentation'
  | 'image'
  | 'audio'
  | 'link'
  | 'other';

export type MaterialProcessingStatus =
  | 'not_applicable'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface LessonMaterialList {
  id: number;
  title: string;
  material_type: LessonMaterialType;
  subject_name: string;
  classes: string[];
  processing_status: MaterialProcessingStatus;
  grant_student_access: boolean;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  uploaded_by_name: string | null;
  created_at: string;
  is_active: boolean;
}

export interface LessonMaterialDetail {
  id: number;
  title: string;
  description: string | null;
  material_type: LessonMaterialType;
  file: string | null;
  external_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  subject: SubjectMini;
  subject_id: number;
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];
  lesson_note: number | null;
  lesson_note_title: string | null;
  processing_status: MaterialProcessingStatus;
  summary_enabled: boolean;
  grant_student_access: boolean;
  is_active: boolean;
  school_section: number | null;
  uploaded_by: UserMini | null;
  created_at: string;
  updated_at: string;
  // Computed
  has_summary: boolean;
  has_flashcards: boolean;
  summaries_count: number;
}

export interface LessonMaterialCreate {
  title: string;
  description?: string;
  material_type: LessonMaterialType;
  file?: File | null;
  external_url?: string | null;
  subject: number;
  class_configuration_ids: number[];
  lesson_note?: number | null;
  summary_enabled?: boolean;
  is_active?: boolean;
  school_section?: number | null;
}

// ------------------------------------------------------------
// 6. Summaries, Flashcards & Quizzes (MVP AI Extensions)
// ------------------------------------------------------------

export type SummaryType = 'short' | 'medium' | 'long';

export interface MaterialSummary {
  id: number;
  material: number | null;
  lesson_note: number | null;
  source_title: string | null;
  source_type: 'material' | 'lesson_note' | null;
  summary_text: string;
  key_points: string[];
  summary_type: SummaryType;
  ai_model_used: string;
  confidence_score: number | null;
  generated_at: string;
}

export interface Flashcard {
  id: number;
  front: string;
  back: string;
  front_image: string | null;
  back_image: string | null;
  order: number;
}

export interface FlashcardSetList {
  id: number;
  title: string;
  subject_name: string;
  card_count: number;
  source_title: string | null;
  ai_generated: boolean;
  created_at: string;
}

export interface FlashcardSetDetail {
  id: number;
  title: string;
  description: string | null;
  material: number | null;
  lesson_note: number | null;
  subject: number;
  subject_name: string;
  flashcards: Flashcard[];
  card_count: number;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export type QuizStrictness = 'easy' | 'moderate' | 'hard';

export interface AutoGeneratedQuizList {
  id: number;
  title: string;
  subject_name: string;
  total_questions: number;
  passing_score: string;
  generation_strictness: QuizStrictness;
  ai_generated: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AutoGeneratedQuizDetail {
  id: number;
  title: string;
  material: number | null;
  lesson_note: number | null;
  subject: number;
  subject_name: string;
  classes: string[];
  total_questions: number;
  passing_score: string;
  include_objective: boolean;
  include_subjective: boolean;
  include_theory: boolean;
  generation_strictness: QuizStrictness;
  ai_generated: boolean;
  is_active: boolean;
  exam_schedule: number | null;
  is_ready_for_attempts: boolean;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// 7. Pending Note Reminders (MVP)
// ------------------------------------------------------------

export interface PendingNoteReminder {
  id: number;
  teacher: number;
  teacher_name: string;
  subject: number;
  subject_name: string;
  class_configuration: number;
  class_name: string;
  scheduled_date: string;
  scheme_week: number | null;
  reminder_sent_at: string;
  reminder_count: number;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  lesson_note: number | null;
}

// ------------------------------------------------------------
// 8. TTS Audio (MVP AI Extension)
// ------------------------------------------------------------

export type TTSStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface TextToSpeechAudio {
  id: number;
  lesson_note: number | null;
  material_summary: number | null;
  source_title: string | null;
  source_type: 'lesson_note' | 'material_summary' | null;
  audio_file: string | null;
  duration_seconds: number;
  voice_used: string;
  speed: number;
  language: string;
  status: TTSStatus;
  error_message: string | null;
  generated_at: string;
}

// ------------------------------------------------------------
// 9. Learning Paths (Phase 2)
// ------------------------------------------------------------

export interface LearningPathList {
  id: number;
  title: string;
  subject_name: string;
  is_sequential: boolean;
  ai_organized: boolean;
  is_active: boolean;
  sections_count: number;
  created_at: string;
}

export interface LearningPathSection {
  id: number;
  title: string;
  description: string | null;
  order: number;
  lesson_notes: number[];
  materials: number[];
  unlock_quiz: number | null;
  unlock_quiz_title: string | null;
  ai_suggested: boolean;
  lesson_notes_count: number;
  materials_count: number;
  created_at: string;
}

export interface LearningPathDetail {
  id: number;
  title: string;
  description: string | null;
  subject: SubjectMini;
  subject_id: number;
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];
  is_sequential: boolean;
  ai_organized: boolean;
  session: number;
  term: number;
  school_section: number | null;
  is_active: boolean;
  sections: LearningPathSection[];
  students_enrolled: number;
  created_by: UserMini | null;
  created_at: string;
  updated_at: string;
}

export interface LearningPathCreate {
  title: string;
  description?: string;
  subject: number;
  class_configuration_ids: number[];
  is_sequential?: boolean;
  session: number;
  term: number;
  school_section?: number | null;
}

export interface LearningPathSectionWrite {
  learning_path: number;
  title: string;
  description?: string;
  order: number;
  lesson_note_ids?: number[];
  material_ids?: number[];
  unlock_quiz?: number | null;
}

// ------------------------------------------------------------
// 10. Student Progress & Annotations (Phase 2)
// ------------------------------------------------------------

export type MaterialProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface StudentMaterialProgress {
  id: number;
  material: number;
  material_title: string;
  material_type: LessonMaterialType;
  status: MaterialProgressStatus;
  percentage_completed: string;
  time_spent_seconds: number;
  last_position_seconds: number;
  started_at: string | null;
  completed_at: string | null;
  last_accessed: string;
}

export interface StudentMaterialProgressUpdate {
  status?: MaterialProgressStatus;
  percentage_completed?: number;
  time_spent_seconds?: number;
  last_position_seconds?: number;
}

export interface StudentLearningPathProgress {
  id: number;
  learning_path: number;
  path_title: string;
  subject_name: string;
  current_section: number | null;
  current_section_detail: {
    id: number;
    title: string;
    description: string | null;
    order: number;
    materials_count: number;
    notes_count: number;
    has_unlock_quiz: boolean;
    ai_suggested: boolean;
  } | null;
  completed_section_ids: number[];
  percentage_completed: string;
  total_sections: number;
  is_complete: boolean;
  started_at: string;
  completed_at: string | null;
  last_accessed: string;
}

export interface StudentBookmark {
  id: number;
  lesson_note: number | null;
  material: number | null;
  source_title: string | null;
  source_type: 'lesson_note' | 'material' | null;
  title: string | null;
  notes: string | null;
  timestamp_seconds: number | null;
  created_at: string;
}

export interface StudentBookmarkCreate {
  lesson_note?: number | null;
  material?: number | null;
  title?: string;
  notes?: string;
  timestamp_seconds?: number;
}

export interface StudentHighlight {
  id: number;
  lesson_note: number;
  highlighted_text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  position_data: Record<string, unknown>;
  notes: string | null;
  created_at: string;
}

export interface StudentHighlightCreate {
  lesson_note: number;
  highlighted_text: string;
  color?: 'yellow' | 'green' | 'blue' | 'pink' | 'orange';
  position_data: Record<string, unknown>;
  notes?: string;
}

// ------------------------------------------------------------
// 11. Peer Note Sharing (Phase 2)
// ------------------------------------------------------------

export type SharedNoteStatus = 'pending' | 'approved' | 'rejected';

export interface StudentSharedNoteList {
  id: number;
  title: string;
  student_name: string;
  subject_name: string;
  status: SharedNoteStatus;
  views_count: number;
  likes_count: number;
  is_liked: boolean;
  created_at: string;
}

export interface StudentSharedNoteDetail {
  id: number;
  student: number;
  student_name: string;
  title: string;
  content: string;
  lesson_note: number | null;
  material: number | null;
  subject: number;
  subject_name: string;
  class_configuration: number | null;
  class_name: string | null;
  status: SharedNoteStatus;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  views_count: number;
  likes_count: number;
  is_liked: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudentSharedNoteCreate {
  title: string;
  content: string;
  lesson_note?: number | null;
  material?: number | null;
  subject: number;
}

export interface SharedNoteModerationPayload {
  action: 'approve' | 'reject';
  feedback?: string;
}

// ------------------------------------------------------------
// 12. Assignments & Submissions (Phase 2)
// ------------------------------------------------------------

export type AssignmentSubmissionStatus = 'submitted' | 'graded' | 'returned_for_revision';

export interface LessonAssignmentList {
  id: number;
  title: string;
  subject_name: string;
  due_date: string;
  max_score: string;
  is_active: boolean;
  submissions_count: number;
  created_at: string;
}

export interface LessonAssignmentDetail {
  id: number;
  title: string;
  instructions: string;
  subject: SubjectMini;
  subject_id: number;
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];
  lesson_note: number | null;
  due_date: string;
  max_score: string;
  allow_late_submission: boolean;
  late_penalty_percent: string;
  attachment: string | null;
  session: number;
  term: number;
  school_section: number | null;
  is_active: boolean;
  is_past_due: boolean;
  created_by: UserMini | null;
  created_at: string;
  updated_at: string;
}

export interface LessonAssignmentCreate {
  title: string;
  instructions: string;
  subject: number;
  class_configuration_ids: number[];
  lesson_note?: number | null;
  due_date: string;
  max_score?: string;
  allow_late_submission?: boolean;
  late_penalty_percent?: string;
  attachment?: File | null;
  session: number;
  term: number;
  school_section?: number | null;
}

export interface StudentAssignmentSubmission {
  id: number;
  assignment: number;
  assignment_title: string;
  student: number;
  student_name: string;
  submission_text: string | null;
  submission_file: string | null;
  submitted_at: string;
  is_late: boolean;
  status: AssignmentSubmissionStatus;
  score_awarded: string | null;
  feedback: string | null;
  graded_by: UserMini | null;
  graded_at: string | null;
}

export interface StudentAssignmentSubmissionCreate {
  submission_text?: string;
  submission_file?: File | null;
}

export interface SubmissionGradePayload {
  score: number;
  feedback?: string;
}

// ------------------------------------------------------------
// 13. Live Classes & Agora (Phase 2)
// ------------------------------------------------------------

export type LiveClassSessionType = 'lesson' | 'meeting' | 'tutorial' | 'other';
export type LiveClassSessionMode = 'remote' | 'in_classroom' | 'hybrid';
export type LiveClassPenMode = 'none' | 'teacher_only' | 'all_students';
export type LiveClassStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type AttendanceStatus = 'present' | 'late' | 'left_early' | 'absent';

export interface LiveClassSessionList {
  id: number;
  title: string;
  session_type: LiveClassSessionType;
  session_mode: LiveClassSessionMode;
  subject_name: string | null;
  classes: string[];
  host_name: string | null;
  scheduled_start: string;
  scheduled_end: string;
  duration_minutes: number;
  status: LiveClassStatus;
  is_live: boolean;
  enable_whiteboard: boolean;
  enable_recording: boolean;
  agora_channel_name: string;
}

export interface LiveClassSessionDetail {
  id: number;
  title: string;
  description: string | null;
  session_type: LiveClassSessionType;
  session_mode: LiveClassSessionMode;
  enable_student_screen_monitoring: boolean;
  pen_mode: LiveClassPenMode;
  subject: number | null;
  subject_name: string | null;
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];
  scheduled_start: string;
  scheduled_end: string;
  agora_channel_name: string;
  agora_app_id: string;
  agora_token: string;
  entrance_key: string | null;
  status: LiveClassStatus;
  actual_start_time: string | null;
  actual_end_time: string | null;
  enable_whiteboard: boolean;
  enable_screen_share: boolean;
  enable_chat: boolean;
  enable_recording: boolean;
  host: number | null;
  host_name: string | null;
  session: number;
  term: number;
  school_section: number | null;
  attendance_count: number;
  created_at: string;
  updated_at: string;
}

export interface LiveClassSessionCreate {
  title: string;
  description?: string;
  session_type: LiveClassSessionType;
  session_mode?: LiveClassSessionMode;
  enable_student_screen_monitoring?: boolean;
  pen_mode?: LiveClassPenMode;
  subject?: number | null;
  class_configuration_ids?: number[];
  scheduled_start: string;
  scheduled_end: string;
  entrance_key?: string | null;
  enable_whiteboard?: boolean;
  enable_screen_share?: boolean;
  enable_chat?: boolean;
  enable_recording?: boolean;
  host?: number | null;
  session: number;
  term: number;
  school_section?: number | null;
}

export interface LiveClassJoinPayload {
  entrance_key?: string;
}

export interface LiveClassJoinResponse {
  agora_app_id: string;
  agora_channel: string;
  agora_token: string;
  enable_whiteboard: boolean;
  enable_screen_share: boolean;
  enable_chat: boolean;
  enable_recording: boolean;
  is_host: boolean;
}

export interface LiveClassAttendance {
  id: number;
  live_class: number;
  student: number | null;
  staff: number | null;
  participant_name: string | null;
  participant_type: 'student' | 'staff' | null;
  joined_at: string;
  left_at: string | null;
  duration_seconds: number;
  status: AttendanceStatus;
  chat_messages_count: number;
  questions_asked: number;
}

export interface LiveClassWhiteboard {
  id: number;
  live_class: number;
  snapshot_image: string | null;
  whiteboard_data: Record<string, unknown> | null;
  title: string | null;
  timestamp: string;
}

export interface StudentScreenMonitor {
  id: number;
  live_class: number;
  student: number;
  student_name: string;
  device_identifier: string;
  agora_screen_channel: string;
  is_currently_sharing: boolean;
  started_at: string;
  ended_at: string | null;
  flagged_by_teacher: boolean;
  flag_note: string | null;
}

export interface ScreenMonitorFlagPayload {
  note?: string;
}

export interface LiveClassPenStream {
  id: number;
  live_class: number;
  device: number | null;
  staff: number | null;
  student: number | null;
  owner_name: string;
  stream_target: 'shared_board' | 'individual_pad';
  stroke_data: Record<string, unknown>;
  page_number: number;
  started_at: string;
  ended_at: string | null;
}

// ------------------------------------------------------------
// 14. Smart Hardware & OCR (Phase 2)
// ------------------------------------------------------------

export type SmartPenStatus = 'active' | 'lost' | 'damaged' | 'retired';
export type HandwritingCaptureStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface SmartPenDevice {
  id: number;
  device_serial: string;
  school_section: number | null;
  status: SmartPenStatus;
  battery_level: number | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface HandwritingCapture {
  id: number;
  content_type: number;
  object_id: number;
  target_object: { type: string; id: number; str: string } | null;
  device: number | null;
  raw_stroke_data: Record<string, unknown> | null;
  scanned_image: string | null;
  ocr_text: string | null;
  ocr_confidence: number | null;
  status: HandwritingCaptureStatus;
  error_message: string | null;
  created_at: string;
}

// ------------------------------------------------------------
// 15. Queue & API Infrastructure
// ------------------------------------------------------------

export type AITaskType =
  | 'summary'
  | 'flashcards'
  | 'quiz'
  | 'tts'
  | 'vetting'
  | 'note_generation'
  | 'ai_path_suggest'
  | 'handwriting_ocr';

export type AITaskStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retry';

export interface AIProcessingQueue {
  id: number;
  task_type: AITaskType;
  target_object: {
    type: string;
    id: number;
    str: string;
  } | null;
  celery_task_id: string | null;
  status: AITaskStatus;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  priority: number;
  triggered_by: number | null;
  created_at: string;
  processed_at: string | null;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface TaskDispatchResponse {
  task_id: string;
}