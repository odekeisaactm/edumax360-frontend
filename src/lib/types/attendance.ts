
// --- Enums / choice unions ---

export type AttendanceMethod = 'FINGERPRINT' | 'BARCODE' | 'MANUAL';
export type AttendanceScope = 'GATE' | 'CLASS' | 'SUBJECT';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'LEFT_EARLY';
export type ParticipantType = 'STUDENT' | 'STAFF' | 'PARENT' | 'VISITOR';
export type DeviceType = 'ZKTECO' | 'R4500' | 'BARCODE_SCANNER' | 'OTHER';
export type GateState = 'NOT_ARRIVED' | 'IN' | 'OUT_TEMP' | 'OUT';
export type NotificationPayer = 'SCHOOL' | 'PARENT';
export type ExceptionType = 'EXCURSION' | 'BUS_DEPARTURE' | 'APPROVED_EARLY_PICKUP' | 'OTHER';

// --- Settings (singleton) ---

export interface AttendanceSettings {
  id: number;
  gate_primary_method: AttendanceMethod;
  gate_fallback_method: AttendanceMethod;
  class_primary_method: AttendanceMethod;
  class_fallback_method: AttendanceMethod;
  is_subject_attendance_enabled: boolean;

  student_expected_entry_time: string;         // TimeField → "HH:MM:SS"
  student_minimum_departure_time: string;
  student_late_grace_minutes: number;

  staff_expected_entry_time: string;
  staff_minimum_departure_time: string;
  staff_late_grace_minutes: number;

  temp_exit_return_timer_minutes: number;
  staff_to_parent_alert_delay_minutes: number;
  parent_alert_enabled_for_temp_exit: boolean;

  online_event_min_duration_minutes: number;

  is_sms_compulsory: boolean;
  is_email_compulsory: boolean;
  sms_payer: NotificationPayer;
  // sms_cost_per_message and school_sms_balance are intentionally NOT
  // rendered as editable fields anywhere in the frontend — platform-locked,
  // managed via a management command. Do not add input fields for them even
  // though they appear in the API response.
  sms_cost_per_message: string;                // DecimalField → string
  school_sms_balance: string;
  low_school_sms_balance_threshold: string;
  low_sms_balance_threshold_per_ward: string;

  updated_at: string;
  created_at: string;
}

// --- Devices & Credentials ---

export interface AttendanceDevice {
  id: number;
  device_id: string;
  name: string;
  device_type: DeviceType;
  location?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeviceCredential {
  id: number;
  device_pin: string;
  device_type: DeviceType;
  participant_type: ParticipantType;
  student?: number | null;
  student_name?: string | null;
  staff?: number | null;
  staff_name?: string | null;
  parent?: number | null;
  parent_name?: string | null;
  known_visitor?: number | null;
  known_visitor_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Raw Events ---

export interface AttendanceEvent {
  id: number;
  student?: number | null;
  student_name?: string | null;
  staff?: number | null;
  staff_name?: string | null;
  participant_type: ParticipantType;
  scope: AttendanceScope;
  method_used: AttendanceMethod;
  device?: number | null;
  device_name?: string | null;
  event_time: string;
  resulting_state: GateState;
  device_log_ref?: string | null;
  academic_period?: number | null;
  class_config?: number | null;
  subject?: number | null;
  recorded_by?: number | null;
  is_manual_override: boolean;
  override_reason?: string | null;
  created_at: string;
}

export interface ManualAttendanceEventInput {
  student_ids?: number[];
  staff_ids?: number[];
  scope: AttendanceScope;
  resulting_state: GateState;
  event_time?: string;
  override_reason: string;
  academic_period_id?: number;
  class_config_id?: number;
  subject_id?: number;
}

// --- Daily Records ---

export interface AttendanceDailyRecord {
  id: number;
  student?: number | null;
  student_name?: string | null;
  staff?: number | null;
  staff_name?: string | null;
  participant_type: ParticipantType;
  scope: AttendanceScope;
  date: string;
  academic_period?: number | null;
  class_config?: number | null;
  class_name?: string | null;
  subject?: number | null;
  current_state: GateState;
  status: AttendanceStatus;
  entry_time?: string | null;
  final_exit_time?: string | null;
  is_late: boolean;
  temp_exit_started_at?: string | null;
  temp_exit_expected_return_by?: string | null;
  temp_exit_returned_at?: string | null;
  staff_alerted_at?: string | null;
  parent_alerted_at?: string | null;
  resolved_by?: number | null;
  resolved_by_name?: string | null;
  resolution_note?: string | null;
  excused_by_exception?: number | null;
  updated_at: string;
  created_at: string;
}

export interface AttendanceRecordCorrectionInput {
  resolution_note: string;
  mark_as_returned: boolean;
}

// --- Exceptions / Excursions ---

export interface AttendanceException {
  id: number;
  exception_type: ExceptionType;
  reason: string;
  students: number[];
  student_names?: string[];
  class_configs: number[];
  class_names?: string[];
  start_datetime: string;
  end_datetime: string;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface AttendanceExceptionWrite {
  exception_type: ExceptionType;
  reason: string;
  start_datetime: string;
  end_datetime: string;
  student_ids?: number[];
  class_config_ids?: number[];
}

// --- Event Attendance ---

export interface EventAttendanceRecord {
  id: number;
  event_id: number;
  participant_type: ParticipantType;
  student?: number | null;
  staff?: number | null;
  parent?: number | null;
  participant_name?: string | null;
  method_used: AttendanceMethod;
  status: AttendanceStatus;
  device?: number | null;
  joined_at?: string | null;
  left_at?: string | null;
  duration_minutes?: number | null;
  created_at: string;
}

export interface EventCheckInInput {
  event_id: number;
  participant_type: 'STUDENT' | 'STAFF' | 'PARENT';
  participant_id: number;
  method_used: AttendanceMethod;
  action: 'join' | 'leave' | 'mark_present';
}

// --- Pickup Log ---

export interface PickupLog {
  id: number;
  student: number;
  student_name?: string;
  parent?: number | null;
  other_guardian?: number | null;
  picked_up_by_name?: string | null;
  method_used: AttendanceMethod;
  pickup_time: string;
  resolved_daily_record?: number | null;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PickupLogInput {
  student_id: number;
  parent_id?: number;
  other_guardian_id?: number;
  method_used?: AttendanceMethod;
  pickup_time?: string;
  notes?: string;
}

// --- Known Visitors & Visitor Log ---

export interface KnownVisitor {
  id: number;
  full_name: string;
  phone?: string | null;
  photo?: string | null;
  device_type?: DeviceType | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisitorLog {
  id: number;
  known_visitor?: number | null;
  known_visitor_name?: string | null;
  visitor_name: string;
  visitor_phone?: string | null;
  purpose: string;
  host_staff?: number | null;
  host_staff_name?: string | null;
  sign_in_time: string;
  sign_out_time?: string | null;
  is_signed_out: boolean;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at: string;
}

export interface VisitorSignInInput {
  known_visitor_id?: number;
  visitor_name: string;
  visitor_phone?: string;
  purpose: string;
  host_staff_id?: number;
  sign_in_time?: string;
}

export interface VisitorSignOutInput {
  visitor_log_id: number;
  sign_out_time?: string;
}

// --- Parent Notification Preference ---

export interface ParentNotificationPreference {
  wants_sms: boolean;
  wants_email: boolean;
}

// --- Missing Credential Report ---

export interface MissingCredentialStudent {
  id: number;
  name: string;
  registration_number: string;
}