
// ============================================================
// LEARNING RESOURCES
// ============================================================

// --- Shared Mini Types ---

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

// --- AI Settings ---

export interface LearningResourcesAISettings {
  id: number;
  school_section: number | null;
  school_section_name: string;
  ai_service: number;
  ai_service_name: string;
  // Content generation
  enable_auto_note_generation: boolean;
  enable_auto_summary: boolean;
  enable_auto_flashcards: boolean;
  enable_auto_quiz_generation: boolean;
  // Vetting
  enable_ai_vetting: boolean;
  vetting_criteria: Record<string, boolean>;
  auto_approve_threshold: number;
  // Summary
  summary_length: 'short' | 'medium' | 'long';
  key_points_count: number;
  // TTS
  enable_text_to_speech: boolean;
  tts_voice: string;
  tts_speed: number;
  // Live class
  enable_live_recording: boolean;
  updated_at: string;
}

// --- Lesson Notes ---

export type LessonNoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'declined'
  | 'archived';

export type LessonNoteCreationMethod =
  | 'manual'
  | 'ai_generated'
  | 'uploaded';

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
  subject_id: number;                       // write only
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];        // write only
  scheduled_date: string | null;
  scheduled_time: string | null;
  topic: string | null;
  learning_objectives: string | null;
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

// --- Lesson Materials ---

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
  subject_id: number;                       // write only
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];        // write only
  lesson_note: number | null;
  lesson_note_title: string | null;
  processing_status: MaterialProcessingStatus;
  summary_enabled: boolean;
  grant_student_access: boolean;
  school_section: number | null;
  uploaded_by: UserMini | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
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
  school_section?: number | null;
}

// --- Summaries ---

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

// --- Flashcards ---

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

// --- Quizzes ---

export type QuizStrictness = 'easy' | 'moderate' | 'hard';

export interface AutoGeneratedQuizList {
  id: number;
  title: string;
  subject_name: string;
  total_questions: number;
  passing_score: string;                    // DecimalField → string
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
  passing_score: string;                    // DecimalField → string
  include_objective: boolean;
  include_subjective: boolean;
  include_theory: boolean;
  generation_strictness: QuizStrictness;
  ai_generated: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Learning Paths ---

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
  subject_id: number;                       // write only
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];        // write only
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

// --- Student Progress ---

export type MaterialProgressStatus = 'not_started' | 'in_progress' | 'completed';

export interface StudentMaterialProgress {
  id: number;
  material: number;
  material_title: string;
  material_type: LessonMaterialType;
  status: MaterialProgressStatus;
  percentage_completed: string;             // DecimalField → string
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
  percentage_completed: string;             // DecimalField → string
  total_sections: number;
  is_complete: boolean;
  started_at: string;
  completed_at: string | null;
  last_accessed: string;
}

// --- Bookmarks & Highlights ---

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

// --- Peer Note Sharing ---

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

// --- TTS Audio ---

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

// --- Live Classes ---

export type LiveClassSessionType = 'lesson' | 'meeting' | 'tutorial' | 'other';
export type LiveClassStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

export interface LiveClassSessionList {
  id: number;
  title: string;
  session_type: LiveClassSessionType;
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
}

export interface LiveClassSessionDetail {
  id: number;
  title: string;
  description: string | null;
  session_type: LiveClassSessionType;
  subject: number | null;
  subject_name: string | null;
  class_configurations_detail: ClassConfigMini[];
  class_configuration_ids: number[];       // write only
  scheduled_start: string;
  scheduled_end: string;
  agora_channel_name: string;
  agora_app_id: string;
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

// Returned from join endpoint
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

export type AttendanceStatus = 'present' | 'late' | 'left_early' | 'absent';

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

// --- Reminders ---

export interface PendingNoteReminder {
  id: number;
  teacher: number;
  teacher_name: string;
  subject: number;
  subject_name: string;
  class_configuration: number;
  class_name: string;
  scheduled_date: string;
  reminder_sent_at: string;
  reminder_count: number;
  is_acknowledged: boolean;
  acknowledged_at: string | null;
  lesson_note: number | null;
}

// --- AI Processing Queue ---

export type AITaskType =
  | 'summary'
  | 'flashcards'
  | 'quiz'
  | 'tts'
  | 'vetting'
  | 'note_generation'
  | 'ai_path_suggest';

export type AITaskStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retry';

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

// --- API Response Wrapper ---
// Matches the ok()/err() helpers in views.py

export interface APIResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
}

// --- Task Dispatch Response ---
// Returned from generate-ai, generate-summary, generate-tts etc.

export interface TaskDispatchResponse {
  task_id: string;
}