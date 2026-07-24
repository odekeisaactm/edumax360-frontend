// ============================================================
// ADD TO lib/types.ts
// ============================================================

// --- Settings ---

export interface TextRatingOption {
  value: string;   // e.g. "achieved"
  label: string;   // e.g. "Achieved"
  score: number;   // e.g. 5
}

export interface ResultSettings {
  id: number;
  // Upload permissions
  allowed_user: 'form_teacher' | 'subject_teacher' | 'both' | 'any';
  text_result_allowed_user: 'form_teacher' | 'subject_teacher' | 'both' | 'any';
  // Student access
  student_view_result: 'when_published' | 'once_uploaded';  // was boolean — wrong
  result_status: 'published' | 'not_published';             // was 'draft' — wrong
  // Comments
  default_comment_mode: 'auto' | 'manual';
  enable_custom_comment_fields: boolean;
  custom_comment_fields: string[];
  // Midterm
  use_midterm: boolean;
  midterm_max_score: string;                // DecimalField → string from DRF
  convert_midterm_to_100: boolean;
  // Behavior
  behavior_max_rating: number;
  show_behavior_on_score_result: boolean;
  show_behavior_on_text_result: boolean;
  show_behavior_on_combined_result: boolean;
  // Text rating
  text_rating_options: TextRatingOption[];  // was Array<{label, value: number}> — wrong
  // Text category scope
  text_category_scope: 'fixed' | 'per_session' | 'per_period';
  // Templates — nullable CharFields
  score_template: string | null;
  text_template: string | null;
  combined_template: string | null;
  // Colors
  primary_color: string;
  secondary_color: string;
  header_color: string;
  accent_color: string;
  // Graph
  show_end_of_term_graph: boolean;
  show_midterm_graph: boolean;
  show_position_on_result: boolean;
  // Cumulative
  show_cumulative_graph: boolean;
  cumulative_format: 'summary' | 'detailed';
  cumulative_avg_mode: 'all_terms' | 'active_terms';
  // WhatsApp
  send_result_via_whatsapp: boolean;
  whatsapp_result_bot_enabled: boolean;
  // Fee restriction
  fee_restriction_scope: 'total' | 'specific';
  fee_restriction_type: 'none' | 'percentage' | 'balance';
  fee_restriction_value: string;                             // DecimalField → string
  fee_specific?: number | null;
  fee_specific_name?: string | null;                         // read-only from serializer
  current_result_upload: number[];                           // array of ResultField IDs
  // Meta
  updated_at: string;
  updated_by?: number | null;
  updated_by_name?: string | null;                           // read-only from serializer
}

// --- Configuration Group ---

export interface ResultConfigurationGroup {
  id: number;
  name: string;
  description?: string | null;
  school_section?: number | null;
  is_active: boolean;
  class_configurations: Array<{ id: number; label: string }>;  // was number[] — serializer returns objects
  class_count: number;
  active_grade_set_name?: string | null;
  active_field_set_name?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

// Write payload for group create/update
export interface ResultConfigurationGroupWrite {
  name: string;
  description?: string;
  school_section?: number | null;
  is_active?: boolean;
  class_configuration_ids?: number[];
}

// --- Grade System ---

export interface ResultGrade {
  id: number;
  grade_set: number;
  order: number;
  grade_type: 'end_of_term' | 'midterm' | 'both';
  // End of term fields
  end_of_term_name?: string | null;
  end_of_term_min_mark?: string | null;   // DecimalField → string
  end_of_term_max_mark?: string | null;
  end_of_term_remark?: string | null;
  // Midterm fields
  midterm_name?: string | null;
  midterm_min_mark?: string | null;
  midterm_max_mark?: string | null;
  midterm_remark?: string | null;
}

export interface ResultGradeSet {
  id: number;
  name: string;
  description?: string | null;
  configuration_group: number;
  is_active: boolean;
  grades?: ResultGrade[];
  grades_count?: number;
  coverage_valid?: { valid: boolean; message: string };
}

// --- Field System ---

export interface ResultField {
  id: number;
  field_set: number;
  name: string;
  max_mark: string;                        // DecimalField → string
  order: number;
  field_type: 'ca' | 'exam';              // removed 'custom' — not in model
  is_midterm: boolean;
}

export interface ResultFieldSet {
  id: number;
  name: string;
  description?: string | null;
  configuration_group: number;
  is_active: boolean;
  fields_list?: ResultField[];            // source='fields' in serializer → fields_list
  fields_count?: number;
  total_valid?: { valid: boolean; total: string; message: string };
}

// --- Behavior ---

export interface ResultBehaviorField {
  id: number;
  category: number;
  name: string;
  order: number;
}

export interface ResultBehaviorCategory {
  id: number;
  name: string;
  school_section?: number | null;
  order: number;
  recommended_fields_count: number;       // was missing
  fields_list?: ResultBehaviorField[];    // source='behavior_fields' → fields_list
}

// --- Text Result ---

export interface TextResultField {
  id: number;
  category: number;
  name: string;
  order: number;
  student_type: 'all' | 'regular' | 'special';
  student_class: number[];      // ADD THIS
  student_kind: 'normal' | 'special' | 'combined';  // ADD THIS
}

export interface TextResultCategory {
  id: number;
  name: string;
  description?: string | null;
  school_section?: number | null;
  academic_period?: number | null;  // REMOVED 'session'
  order: number;
  teachers: number[];
  fields_list?: TextResultField[];
  student_class: number[];      // ADD THIS
  student_kind: 'normal' | 'special' | 'combined';  // ADD THIS
}

// --- Comment Templates ---

export interface ResultCommentTemplate {
  id: number;
  configuration_group: number;
  comment_type: 'form_teacher' | 'head_teacher';
  comment_text: string;
  created_at: string;
  min_score: string;
  max_score: string;
}

// --- Student Comments ---

export interface StudentResultComment {
  id: number;
  student: number;
  student_name?: string;
  session: number;
  academic_period: number;
  period_name?: string;
  form_teacher_comment?: string | null;
  head_teacher_comment?: string | null;
  custom_comments?: Record<string, string>;
  behavior_ratings?: Record<string, number>;
  total_attendance?: number | null;
  present_attendance?: number | null;
  attendance_pct?: number | null;         // computed field from serializer
  updated_at?: string;
  updated_by?: number | null;
}

// --- Result Storage ---

// One subject entry inside result_data (score-based)
export interface ScoreResultEntry {
  subject_name: string;
  subject_code: string;
  fields: Record<string, number>;
  total_ca: number;
  total: number;
  grade: string;
  remark: string;
  position: number | null;
  midterm_total: number | null;
  midterm_grade: string | null;
  midterm_remark: string | null;
  midterm_position: number | null;
  // Merged from statistics in ResultDetailSerializer
  highest_in_class?: number | null;
  lowest_in_class?: number | null;
  class_average?: number | null;
  students_counted?: number | null;
  midterm_highest?: number | null;
  midterm_average?: number | null;
}

// One field entry inside result_data (text-based)
export interface TextResultEntry {
  field_name: string;
  category_name: string;
  rating: string;
  comment: string;
}

export interface ResultModel {
  id: number;
  student: number;
  student_name?: string;
  session: number;
  academic_period: number;
  period_name?: string;
  class_configuration: number;
  class_name?: string;
  result_type: 'score' | 'text' | 'combined';
  result_data: Record<string, ScoreResultEntry | TextResultEntry>;
  result_data_with_stats?: Record<string, ScoreResultEntry>;  // from ResultDetailSerializer
  total_score: string | null;             // DecimalField → string
  number_of_subjects: number | null;
  average_score: string | null;
  comment?: StudentResultComment | null;  // from ResultDetailSerializer
  field_list?: ResultField[];             // from ResultDetailSerializer
  grade_list?: ResultGrade[];             // from ResultDetailSerializer
}

// --- Statistics ---

export interface ResultStatistics {
  id: number;
  class_configuration: number;
  class_name?: string;
  session: number;
  academic_period: number;
  subject: number;
  subject_name?: string;
  highest_score: string | null;
  lowest_score: string | null;
  average_score: string | null;
  total_students: number;
  students_counted: number;
  statistics_data: Record<string, any>;
  is_published: boolean;
}

// --- Upload Tracking ---

export interface ResultUploadTracking {
  id: number;
  class_configuration: number;
  session: number;
  academic_period: number;
  subject: number;
  subject_name?: string;
  ca_uploaded: boolean;
  exam_uploaded: boolean;
  is_complete: boolean;                   // computed field from serializer
  uploaded_by?: number | null;
  uploaded_at?: string;
}

// --- Spreadsheet ---

export interface ResultSpreadsheetRow {
  student_id: number;
  student_name: string;
  reg_number: string;
  scores: Record<string, number>;
  total: number | null;
  grade: string | null;
  remark: string | null;
  position: number | null;
  midterm_total: number | null;
  midterm_grade: string | null;
  midterm_position: number | null;
}

export interface ResultSpreadsheet {
  class_name: string;
  subject_name: string;
  period_name: string;
  session_name: string;
  fields: ResultField[];
  rows: ResultSpreadsheetRow[];
  statistics: ResultStatistics | null;
  upload_tracking: ResultUploadTracking | null;
}

// --- Cumulative ---

export interface CumulativeSubject {
  name: string;
  code: string;
  terms: Record<string, number>;          // period_order → score
  total: number;
  average: number;
  grade: string;
  remark: string;
}

export interface CumulativeResult {
  student_id: number;
  student_name?: string;
  session_name?: string;
  subjects: Record<string, CumulativeSubject>;
  periods: Array<{ order: number; name: string }>;
  overall_total: number;
  overall_average: number;
  overall_grade: string;
  overall_remark: string;
}

// --- Readiness ---

export interface ConfigurationReadiness {
  class_name: string;
  is_ready: boolean;                      // was 'ready' — wrong
  errors: string[];
}

// --- Template Registry ---

export interface ResultTemplate {
  id: string;
  name: string;
  type: 'score' | 'text' | 'combined';
  directory: string;
  preview_image: string | null;
  description: string | null;
  is_active: boolean;
}

export interface ActiveTemplates {
  score: { selected_id: string | null; template: ResultTemplate | null };
  text: { selected_id: string | null; template: ResultTemplate | null };
  combined: { selected_id: string | null; template: ResultTemplate | null };
}

// --- Upload payloads (frontend → backend) ---

export interface StudentScoreRow {
  student_id: number;
  scores: Record<string, number>;
}

export interface ResultUploadPayload {
  class_config_id: number;
  subject_id: number;
  academic_period_id: number;
  student_scores: StudentScoreRow[];
}

export interface TextFieldEntry {
  rating: string;
  comment?: string;
}

export interface TextResultUploadPayload {
  student_id: number;
  class_config_id: number;
  academic_period_id: number;
  field_data: Record<string, TextFieldEntry>;
}


// --- Publish ---

export interface ResultPublish {
  id: number;
  session: number;
  session_name: string;
  academic_period: number;
  period_name: string;
  result_type: 'midterm' | 'end_of_term';
  school_section: number | null;
  section_name: string;
  is_published: boolean;
  published_by_name?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishStats {
  total_students: number;
  computed_results: number;
  percentage: number;
}