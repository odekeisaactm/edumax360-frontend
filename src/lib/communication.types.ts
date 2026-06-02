// ==================== COMMUNICATION MODULE TYPES ====================
// Auto-generated from backend models, serializers, and views
// communication/models.py + serializers.py + views.py

// ============================================================================
// SHARED / PRIMITIVE TYPES
// ============================================================================

export type ConfigStatus = 'active' | 'inactive';
export type CommunicationChannel = 'email' | 'sms' | 'whatsapp' | 'in_app';
export type BulkRecipientType = 'students' | 'parents' | 'staff' | 'custom';
export type LogRecipientType = 'student' | 'parent' | 'staff';
export type NotificationLogStatus = 'pending' | 'sent' | 'failed' | 'delivered';
export type QueryStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type QueryType = 'general' | 'complaint' | 'request' | 'feedback';
export type MessageFlow = 'incoming' | 'outgoing';
export type AnnouncementPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AnnouncementTargetAudience =
  | 'all'
  | 'students'
  | 'parents'
  | 'staff'
  | 'specific_class'
  | 'specific_section';

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'promote'
  | 'payment'
  | 'login'
  | 'flagged'
  | 'other';

export type ActivityCategory =
  | 'finance'
  | 'academic'
  | 'admission'
  | 'proctoring'
  | 'hr'
  | 'general_admin';

export type SMSProviderType = 'africastalking' | 'twilio' | 'nexmo' | 'termii' | 'other';
export type WhatsAppProviderType = 'meta_cloud' | 'twilio' | 'termii' | 'custom';

// ============================================================================
// GATEWAY CONFIGURATIONS
// ============================================================================

export interface SMTPConfiguration {
  id: number;
  name: string;
  email: string;
  host: string;
  port: number;
  username: string;
  password?: string; // write-only, not returned on read
  use_tls: boolean;
  use_ssl: boolean;
  status: ConfigStatus;
  created_at: string;
  updated_at: string;
}

export interface SMTPConfigurationFormValues {
  name: string;
  email: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  use_tls: boolean;
  use_ssl: boolean;
  status: ConfigStatus;
}

export interface SMSConfiguration {
  id: number;
  name: string;
  provider: SMSProviderType;
  api_key?: string; // write-only, not returned on read
  secret_key?: string | null; // write-only, not returned on read
  sender_id?: string | null;
  status: ConfigStatus;
  created_at: string;
  updated_at: string;
}

export interface SMSConfigurationFormValues {
  name: string;
  provider: SMSProviderType;
  api_key: string;
  secret_key?: string;
  sender_id?: string;
  status: ConfigStatus;
}

export interface WhatsAppConfig {
  id: number;
  name: string;
  provider: WhatsAppProviderType;
  provider_display?: string;
  is_active: boolean;
  from_phone_number: string;
  registered_school_numbers: string[]; // parsed from JSON array
  parent_portal_url?: string | null;
  // Meta Cloud
  meta_phone_number_id?: string | null;
  meta_waba_id?: string | null;
  meta_access_token_input?: string; // write-only proxy field
  meta_webhook_verify_token_input?: string; // write-only proxy field
  // Twilio
  twilio_account_sid?: string | null;
  twilio_auth_token_input?: string; // write-only proxy field
  // Termii
  termii_api_key_input?: string; // write-only proxy field
  // Custom Provider
  custom_api_base_url?: string | null;
  custom_api_key_input?: string; // write-only proxy field
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConfigFormValues {
  name: string;
  provider: WhatsAppProviderType;
  is_active: boolean;
  from_phone_number: string;
  registered_school_numbers: string[];
  parent_portal_url?: string;
  meta_phone_number_id?: string;
  meta_waba_id?: string;
  meta_access_token_input?: string;
  meta_webhook_verify_token_input?: string;
  twilio_account_sid?: string;
  twilio_auth_token_input?: string;
  termii_api_key_input?: string;
  custom_api_base_url?: string;
  custom_api_key_input?: string;
}

// ============================================================================
// TEMPLATES
// ============================================================================

export type NotificationTemplateEventType =
  | 'student_registration'
  | 'fee_payment'
  | 'fee_reminder'
  | 'result_published'
  | 'attendance_alert'
  | 'exam_schedule'
  | 'announcement'
  | 'custom';

export interface NotificationTemplate {
  id: number;
  event_type: NotificationTemplateEventType;
  name: string;
  email_subject?: string | null;
  email_body?: string | null;
  sms_message?: string | null; // Max 160 chars
  whatsapp_message?: string | null;
  send_email: boolean;
  send_sms: boolean;
  send_whatsapp: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplateFormValues {
  event_type: NotificationTemplateEventType;
  name: string;
  email_subject?: string;
  email_body?: string;
  sms_message?: string;
  whatsapp_message?: string;
  send_email: boolean;
  send_sms: boolean;
  send_whatsapp: boolean;
  is_active: boolean;
}

// ============================================================================
// MESSAGES & BULK OUTBOX
// ============================================================================

export interface Message {
  id: number;
  title: string;
  message: string;
  attachment?: string | null; // URL string
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  sent_messages?: SentMessageSummary[];
}

export interface MessageFormValues {
  title: string;
  message: string;
  attachment?: File | null;
}

export interface SentMessageSummary {
  id: number;
  message: number;
  medium: 'email' | 'sms' | 'whatsapp';
  recipient_type: BulkRecipientType;
  recipients: any; // Raw JSON payload of recipient IDs or numbers
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  sent_by?: number | null;
  sent_at: string;
}

export interface BulkSendMessagePayload {
  message_id: number;
  mediums: Array<'email' | 'sms' | 'whatsapp'>;
  recipient_type: BulkRecipientType;
  target_ids?: number[]; // Specific student/parent/staff IDs if filtered
  custom_recipients?: string[]; // Raw numbers or emails for custom list type
}

// ============================================================================
// NOTIFICATION LOGGING (AUDIT TRAIL)
// ============================================================================

export interface NotificationLog {
  id: number;
  template?: number | null;
  event_type: string;
  subject?: string | null;
  message: string;
  channel: CommunicationChannel;
  recipient_type: LogRecipientType;
  recipient_id: number;
  recipient_contact: string;
  status: NotificationLogStatus;
  error_message?: string | null;
  external_id?: string | null;
  sent_at: string;
  delivered_at?: string | null;
}

// ============================================================================
// QUERIES & HELP DESK TICKETS
// ============================================================================

export interface Query {
  id: number;
  title: string;
  message: string;
  query_type: QueryType;
  flow: MessageFlow;
  recipient_type: LogRecipientType;
  student?: number | null;
  student_name?: string | null;
  parent?: number | null;
  parent_name?: string | null;
  staff?: number | null;
  staff_name?: string | null;
  status: QueryStatus;
  created_by?: number | null;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  follow_ups?: QueryFollowUp[];
}

export interface QueryFormValues {
  title: string;
  message: string;
  query_type: QueryType;
  flow: MessageFlow;
  recipient_type: LogRecipientType;
  student?: number | null;
  parent?: number | null;
  staff?: number | null;
  assigned_to?: number | null;
  status: QueryStatus;
}

export interface QueryFollowUp {
  id: number;
  query: number;
  message: string;
  sent_by?: number | null;
  sent_by_name?: string | null;
  attachment?: string | null; // URL string
  created_at: string;
}

export interface QueryFollowUpFormValues {
  query: number;
  message: string;
  attachment?: File | null;
}

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

export interface Announcement {
  id: number;
  title: string;
  content: string;
  target_audience: AnnouncementTargetAudience;
  specific_classes: number[]; // ID references
  specific_sections: number[]; // ID references
  priority: AnnouncementPriority;
  is_published: boolean;
  publish_date?: string | null;
  expiry_date?: string | null;
  attachment?: string | null; // URL string
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementFormValues {
  title: string;
  content: string;
  target_audience: AnnouncementTargetAudience;
  specific_classes?: number[];
  specific_sections?: number[];
  priority: AnnouncementPriority;
  is_published: boolean;
  publish_date?: string | null;
  expiry_date?: string | null;
  attachment?: File | null;
}

// ============================================================================
// SECURITY ACTIVITY LOGS (AUDIT TRAIL)
// ============================================================================

export interface ActivityLog {
  id: number;
  actor_name: string; // resolved via method field
  action_type: ActivityActionType;
  action_type_display: string;
  category: ActivityCategory;
  category_display: string;
  description: string;
  target_object_repr?: string | null; // text descriptor of GFK target
  target_object_id?: number | null;
  target_model?: string | null;
  session_period_name?: string | null; // target active period string reference
  ip_address?: string | null;
  created_at: string;
}

export interface InAppNotification {
  id: number;
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface InAppNotificationResponse {
  unread_count: number;
  notifications: InAppNotification[];
}