/**
 * Assessment Center API Service
 * assessment.service.ts
 *
 * All API calls for the assessment_center Django app.
 * Matches views.py endpoints exactly.
 */

import api from './api'; // your axios instance
import type {
  // AI
  AIServiceConfig,
  AssessmentAISettings,
  AssessmentAISettingsFormValues,
  // Infrastructure
  ExaminationHall,
  ExaminationHallFormValues,
  HallAvailability,
  AuthorizedDevice,
  DeviceApprovalRequest,
  DeviceCheckResponse,
  DeviceInfo,
  // Topics
  Topic,
  TopicFormValues,
  TopicDropdown,
  // Question Banks
  QuestionBank,
  QuestionBankFormValues,
  QuestionBankSearchParams,
  QuestionBankWithStats,
  // Questions
  Question,
  QuestionFormValues,
  QuestionAnalytics,
  BulkCreateQuestionsPayload,
  // Exams
  Exam,
  ExamFormValues,
  ExamDetail,
  ScheduleCreationStatus,
  ExamSchedulesStatusResponse,
  // Schedules
  ExamSchedule,
  ExamScheduleDetail,
  ExamScheduleUpdateFormValues,
  QuestionRequirementsFormValues,
  QuestionRequirementsResponse,
  ValidateQuestionsResponse,
  StudentsListResponse,
  // Sections
  ExamSection,
  ExamSectionFormValues,
  // Exam Questions
  ExamQuestion,
  ExamQuestionDetail,
  BulkAddQuestionsPayload,
  BulkAddQuestionsResponse,
  ReorderQuestionsPayload,
  // PINs
  StudentExamAccess,
  StudentPinsResponse,
  // Student flow
  ExamCodeVerifyResponse,
  ExamAuthResponse,
  ExamEntryValidationPayload,
  ExamEntryValidationResponse,
  ExamStartResponse,
  ExamSubmitResponse,
  ExamResultResponse,
  SaveAnswerPayload,
  BulkSaveAnswersPayload,
  StudentDashboardResponse,
  // Attempts & Answers
  StudentExamAttempt,
  StudentAnswer,
  MarkAnswerPayload,
  BulkMarkAnswersPayload,
  MarkingDashboardResponse,
  // Proctoring
  ProctoringEvent,
  ProctoringEventCreatePayload,
  ProctoringDashboardResponse,
  InvigilatorSession,
  // Scanned Sheets
  ScannedAnswerSheet,
  ScannedSheetProcessingStatus,
  // Result Transfer
  ExamResultTransferConfig,
  TransferPreviewResponse,
  TransferExecuteResponse,
  // AI Queue
  AIMarkingQueue,
  AIMarkingQueueStats,
  // Analytics
  ExamAnalyticsResponse,
  ClassPerformanceReportResponse,
  ExamMaxMarkResponse,
  // Teacher
  TeacherDashboardResponse,
  // Generic
  SuccessResponse,
  PaginatedResponse,
} from '@/lib/types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Unwrap paginated or direct list response.
 * DRF returns { count, results } for lists.
 */
function unwrapList<T>(data: any): T[] {
  if (data && Array.isArray(data.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * Unwrap direct object response.
 * DRF ModelViewSet returns the object directly on create/retrieve/update.
 */
function unwrap<T>(data: any): T {
  return data as T;
}

// ============================================================================
// AI CONFIGURATION
// ============================================================================

export const aiServicesAPI = {
  list: async (): Promise<AIServiceConfig[]> => {
    const res = await api.get('/api/assessment/ai-services/');
    return unwrapList<AIServiceConfig>(res.data);
  },

  get: async (id: number): Promise<AIServiceConfig> => {
    const res = await api.get(`/api/assessment/ai-services/${id}/`);
    return unwrap<AIServiceConfig>(res.data);
  },

  create: async (data: Omit<AIServiceConfig, 'id' | 'created_at' | 'updated_at' | 'tokens_used_this_month' | 'tokens_remaining' | 'usage_percentage'>): Promise<AIServiceConfig> => {
    const res = await api.post('/api/assessment/ai-services/', data);
    return unwrap<AIServiceConfig>(res.data);
  },

  update: async (id: number, data: Partial<AIServiceConfig>): Promise<AIServiceConfig> => {
    const res = await api.put(`/api/assessment/ai-services/${id}/`, data);
    return unwrap<AIServiceConfig>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/ai-services/${id}/`);
  },

  resetUsage: async (id: number): Promise<{ success: boolean; message: string; tokens_used_this_month: number }> => {
    const res = await api.post(`/api/assessment/ai-services/${id}/reset_usage/`);
    return res.data;
  },

  testConnection: async (id: number): Promise<{ success: boolean; message: string; details?: any }> => {
    const res = await api.post(`/api/assessment/ai-services/${id}/test_connection/`);
    return res.data;
  },
};

export const assessmentAISettingsAPI = {
  /** Get settings — pass schoolSectionId or null for global */
  get: async (schoolSectionId?: number | null): Promise<AssessmentAISettings | null> => {
    try {
      const params = schoolSectionId ? { school_section: schoolSectionId } : {};
      const res = await api.get('/api/assessment/ai-settings/', { params });
      const list = unwrapList<AssessmentAISettings>(res.data);
      return list[0] ?? null;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  create: async (data: AssessmentAISettingsFormValues): Promise<AssessmentAISettings> => {
    const res = await api.post('/api/assessment/ai-settings/', data);
    return unwrap<AssessmentAISettings>(res.data);
  },

  update: async (id: number, data: Partial<AssessmentAISettingsFormValues>): Promise<AssessmentAISettings> => {
    const res = await api.put(`/api/assessment/ai-settings/${id}/`, data);
    return unwrap<AssessmentAISettings>(res.data);
  },

  testMarking: async (id: number, testData: {
    question: string;
    answer: string;
    model_answer: string;
  }): Promise<any> => {
    const res = await api.post(`/api/assessment/ai-settings/${id}/test_marking/`, testData);
    return res.data;
  },
};

// ============================================================================
// EXAMINATION HALLS
// ============================================================================

export const examinationHallsAPI = {
  list: async (filters?: { school_section?: number; is_active?: boolean }): Promise<ExaminationHall[]> => {
    const res = await api.get('/api/assessment/examination-halls/', { params: filters });
    return unwrapList<ExaminationHall>(res.data);
  },

  get: async (id: number): Promise<ExaminationHall> => {
    const res = await api.get(`/api/assessment/examination-halls/${id}/`);
    return unwrap<ExaminationHall>(res.data);
  },

  create: async (data: ExaminationHallFormValues): Promise<ExaminationHall> => {
    const res = await api.post('/api/assessment/examination-halls/', data);
    return unwrap<ExaminationHall>(res.data);
  },

  update: async (id: number, data: Partial<ExaminationHallFormValues>): Promise<ExaminationHall> => {
    const res = await api.put(`/api/assessment/examination-halls/${id}/`, data);
    return unwrap<ExaminationHall>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/examination-halls/${id}/`);
  },

  checkAvailability: async (id: number, examScheduleId: number): Promise<HallAvailability> => {
    const res = await api.get(`/api/assessment/examination-halls/${id}/availability/`, {
      params: { exam_schedule_id: examScheduleId },
    });
    return res.data;
  },

  getAvailableHalls: async (examScheduleId: number): Promise<ExaminationHall[]> => {
    const res = await api.get('/api/assessment/examination-halls/available_halls/', {
      params: { exam_schedule_id: examScheduleId },
    });
    return Array.isArray(res.data) ? res.data : [];
  },
};

// ============================================================================
// AUTHORIZED DEVICES
// ============================================================================

export const authorizedDevicesAPI = {
  create: async (data: {
    device_name: string;
    device_type: 'desktop' | 'laptop' | 'tablet' | 'mobile';
    device_fingerprint: string;
    browser_fingerprint: string;
    ip_address: string;
    user_agent: string;
    is_active: boolean;
  }): Promise<AuthorizedDevice> => {
    const res = await api.post('/api/assessment/authorized-devices/', data);
    return unwrap<AuthorizedDevice>(res.data);
  },

  list: async (filters?: {
    is_authorized?: boolean;
    is_active?: boolean;
    is_blocked?: boolean;
    device_type?: string;
  }): Promise<AuthorizedDevice[]> => {
    const res = await api.get('/api/assessment/authorized-devices/', { params: filters });
    return unwrapList<AuthorizedDevice>(res.data);
  },

  get: async (id: number): Promise<AuthorizedDevice> => {
    const res = await api.get(`/api/assessment/authorized-devices/${id}/`);
    return unwrap<AuthorizedDevice>(res.data);
  },

  update: async (id: number, data: Partial<AuthorizedDevice>): Promise<AuthorizedDevice> => {
    const res = await api.put(`/api/assessment/authorized-devices/${id}/`, data);
    return unwrap<AuthorizedDevice>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/authorized-devices/${id}/`);
  },

  /** Capture current browser device info — staff use */
  captureCurrentDevice: async (fingerprint: string): Promise<{
    success: boolean;
    device_info: DeviceInfo & { suggested_name: string };
  }> => {
    const res = await api.post('/api/assessment/authorized-devices/capture_current_device/', {
      device_fingerprint: fingerprint,
    });
    return res.data;
  },

  /** Public — no auth required */
  checkDeviceStatus: async (fingerprint: string): Promise<DeviceCheckResponse> => {
    const res = await api.post('/api/assessment/authorized-devices/check_device_status/', {
      device_fingerprint: fingerprint,
    });
    return res.data;
  },

  /** Public — no auth required */
  requestApproval: async (fingerprint: string, suggestedDeviceName?: string): Promise<{
  success: boolean;
  message: string;
  request: DeviceApprovalRequest;
}> => {
  const res = await api.post('/api/assessment/authorized-devices/request_approval/', {
    device_fingerprint: fingerprint,
    suggested_device_name: suggestedDeviceName || '',
  });
  return res.data;
},

  /** Staff — approve a device request */
  approveRequest: async (data: {
    request_id: number;
    device_name: string;
  }): Promise<{ success: boolean; message: string; device: AuthorizedDevice }> => {
    const res = await api.post('/api/assessment/authorized-devices/approve_request/', data);
    return res.data;
  },

  /** Staff — reject a device request */
  rejectRequest: async (data: {
    request_id: number;
    rejection_reason?: string;
  }): Promise<SuccessResponse> => {
    const res = await api.post('/api/assessment/authorized-devices/reject_request/', data);
    return res.data;
  },

  block: async (id: number, reason: string): Promise<AuthorizedDevice> => {
    const res = await api.post(`/api/assessment/authorized-devices/${id}/block/`, { reason });
    return unwrap<AuthorizedDevice>(res.data);
  },

  unblock: async (id: number): Promise<AuthorizedDevice> => {
    const res = await api.post(`/api/assessment/authorized-devices/${id}/unblock/`);
    return unwrap<AuthorizedDevice>(res.data);
  },

  activate: async (id: number): Promise<AuthorizedDevice> => {
    const res = await api.post(`/api/assessment/authorized-devices/${id}/activate/`);
    return unwrap<AuthorizedDevice>(res.data);
  },

  deactivate: async (id: number): Promise<AuthorizedDevice> => {
    const res = await api.post(`/api/assessment/authorized-devices/${id}/deactivate/`);
    return unwrap<AuthorizedDevice>(res.data);
  },
};

// ============================================================================
// DEVICE APPROVAL REQUESTS
// ============================================================================

export const deviceApprovalRequestsAPI = {
  list: async (filters?: { status?: string }): Promise<DeviceApprovalRequest[]> => {
    const res = await api.get('/api/assessment/device-approval-requests/', { params: filters });
    return unwrapList<DeviceApprovalRequest>(res.data);
  },

  getPending: async (): Promise<{ count: number; requests: DeviceApprovalRequest[] }> => {
    const res = await api.get('/api/assessment/device-approval-requests/pending/');
    return res.data;
  },
};

// ============================================================================
// TOPICS
// ============================================================================

export const topicsAPI = {
  list: async (filters?: { subject?: number; student_class?: number }): Promise<Topic[]> => {
    const res = await api.get('/api/assessment/topics/', { params: filters });
    return unwrapList<Topic>(res.data);
  },

  get: async (id: number): Promise<Topic> => {
    const res = await api.get(`/api/assessment/topics/${id}/`);
    return unwrap<Topic>(res.data);
  },

  getDropdown: async (subjectId: number, classId: number): Promise<TopicDropdown[]> => {
    const res = await api.get('/api/assessment/topics/dropdown/', {
      params: { subject_id: subjectId, class_id: classId },
    });
    return unwrapList<TopicDropdown>(res.data);
  },

  search: async (query: string, subjectId?: number, classId?: number): Promise<TopicDropdown[]> => {
    const res = await api.get('/api/assessment/topics/search/', {
      params: { q: query, subject_id: subjectId, class_id: classId },
    });
    return unwrapList<TopicDropdown>(res.data);
  },

  create: async (data: TopicFormValues): Promise<Topic> => {
    const res = await api.post('/api/assessment/topics/', data);
    return unwrap<Topic>(res.data);
  },

  update: async (id: number, data: Partial<TopicFormValues>): Promise<Topic> => {
    const res = await api.put(`/api/assessment/topics/${id}/`, data);
    return unwrap<Topic>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/topics/${id}/`);
  },
};

// ============================================================================
// QUESTION BANKS
// ============================================================================

export const questionBanksAPI = {
  list: async (filters?: {
    subject?: number;
    student_class?: number;
    topic?: number;
    difficulty_level?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<QuestionBank[]> => {
    const res = await api.get('/api/assessment/question-banks/', { params: filters });
    return unwrapList<QuestionBank>(res.data);
  },

  get: async (id: number): Promise<QuestionBank> => {
    const res = await api.get(`/api/assessment/question-banks/${id}/`);
    return unwrap<QuestionBank>(res.data);
  },

  getDetailWithQuestions: async (id: number): Promise<QuestionBankWithStats> => {
    const res = await api.get(`/api/assessment/question-banks/${id}/detail_with_questions/`);
    return res.data;
  },

  /** Get banks valid for a specific exam schedule (matches subject + class) */
  getAvailableForSchedule: async (examScheduleId: number): Promise<{
    exam_schedule: { id: number; subject: string; class: string };
    count: number;
    banks: QuestionBank[];
  }> => {
    const res = await api.get('/api/assessment/question-banks/available_for_schedule/', {
      params: { exam_schedule_id: examScheduleId },
    });
    return res.data;
  },

  create: async (data: QuestionBankFormValues): Promise<QuestionBank> => {
    const res = await api.post('/api/assessment/question-banks/', data);
    return unwrap<QuestionBank>(res.data);
  },

  update: async (id: number, data: Partial<QuestionBankFormValues>): Promise<QuestionBank> => {
    const res = await api.put(`/api/assessment/question-banks/${id}/`, data);
    return unwrap<QuestionBank>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/question-banks/${id}/`);
  },

  search: async (data: QuestionBankSearchParams): Promise<{ count: number; banks: QuestionBank[] }> => {
    const res = await api.post('/api/assessment/question-banks/search_banks/', data);
    return res.data;
  },

  downloadBulkTemplate: async (bankId: number, params: any): Promise<void> => {
    const response = await api.post(`/api/assessment/question-banks/${bankId}/download_template/`, params, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a'); a.href = url;
    // We get filename from content-disposition usually, but if not we can use a fallback.
    const disposition = response.headers['content-disposition'];
    let filename = `question_upload_template_${bankId}.xlsx`;
    if (disposition && disposition.indexOf('attachment') !== -1) {
        var filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        var matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
    }
    a.setAttribute('download', filename);
    document.body.appendChild(a); a.click(); a.remove();
  },

  bulkUpload: async (bankId: number, file: File): Promise<{ upload_id: number; message: string }> => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post(`/api/assessment/question-banks/${bankId}/bulk_upload/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return r.data;
  },

  getBulkUploadStatus: async (uploadId: number): Promise<any> => {
    const r = await api.get(`/api/assessment/question-banks/upload_status/`, {
      params: { upload_id: uploadId }
    });
    return r.data;
  },

  downloadBulkErrorReport: async (uploadId: number): Promise<void> => {
    const response = await api.get(`/api/assessment/question-banks/download_error_report/`, {
      params: { upload_id: uploadId },
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a'); a.href = url;
    a.setAttribute('download', `error_report_${uploadId}.xlsx`);
    document.body.appendChild(a); a.click(); a.remove();
  },
};

// ============================================================================
// QUESTIONS
// ============================================================================

export const questionsAPI = {
  list: async (filters?: {
    question_bank?: number;
    question_type?: string;
    difficulty_level?: string;
    search?: string;
    // Server-side subject+class filtering (uses filterset_fields added to QuestionViewSet)
    question_bank__subject?: number;
    question_bank__student_class?: number;
    question_bank__topic?: number;
  }): Promise<Question[]> => {
    const res = await api.get('/api/assessment/questions/', { params: filters });
    return unwrapList<Question>(res.data);
  },

  get: async (id: number): Promise<Question> => {
    const res = await api.get(`/api/assessment/questions/${id}/`);
    return unwrap<Question>(res.data);
  },

  getByBank: async (bankId: number, questionType?: string): Promise<{ count: number; questions: Question[] }> => {
    const res = await api.get('/api/assessment/questions/by_bank/', {
      params: { bank_id: bankId, question_type: questionType },
    });
    return res.data;
  },

  /** Use FormData when question has a diagram file */
  create: async (data: FormData | QuestionFormValues): Promise<Question> => {
    const isFormData = data instanceof FormData;
    const res = await api.post('/api/assessment/questions/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return unwrap<Question>(res.data);
  },

  update: async (id: number, data: FormData | Partial<QuestionFormValues>): Promise<Question> => {
    const isFormData = data instanceof FormData;
    const res = await api.put(`/api/assessment/questions/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return unwrap<Question>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/questions/${id}/`);
  },

  bulkCreate: async (data: BulkCreateQuestionsPayload): Promise<{
    success: boolean;
    message: string;
    created_ids: number[];
    question_bank: { id: number; name: string; total_questions: number };
  }> => {
    const res = await api.post('/api/assessment/questions/bulk_create/', data);
    return res.data;
  },

  getAnalytics: async (id: number): Promise<{ question: Question; analytics: QuestionAnalytics }> => {
    const res = await api.get(`/api/assessment/questions/${id}/analytics/`);
    return res.data;
  },
};

// ============================================================================
// EXAMS
// ============================================================================

export const examsAPI = {
  list: async (filters?: {
    exam_type?: string;
    session?: number;
    term?: number;
    is_published?: boolean;
    is_active?: boolean;
    is_practice_mode?: boolean;
    search?: string;
  }): Promise<Exam[]> => {
    const res = await api.get('/api/assessment/exams/', { params: filters });
    return unwrapList<Exam>(res.data);
  },

  get: async (id: number): Promise<ExamDetail> => {
    const res = await api.get(`/api/assessment/exams/${id}/`);
    return unwrap<ExamDetail>(res.data);
  },

  create: async (data: ExamFormValues): Promise<Exam> => {
    const res = await api.post('/api/assessment/exams/', data);
    return unwrap<Exam>(res.data);
  },

  update: async (id: number, data: Partial<ExamFormValues>): Promise<Exam> => {
    const res = await api.put(`/api/assessment/exams/${id}/`, data);
    return unwrap<Exam>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/exams/${id}/`);
  },

  /** Poll this after creation to check if Celery finished creating schedules */
  getSchedulesCreationStatus: async (id: number): Promise<ScheduleCreationStatus> => {
    const res = await api.get(`/api/assessment/exams/${id}/schedules_creation_status/`);
    return res.data;
  },

  /** Fallback if Celery failed */
  createSchedulesManually: async (id: number): Promise<any> => {
    const res = await api.post(`/api/assessment/exams/${id}/create_schedules_manually/`);
    return res.data;
  },

  /** Main view after exam creation — schedules grouped by subject */
  getSchedulesStatus: async (id: number): Promise<ExamSchedulesStatusResponse> => {
    const res = await api.get(`/api/assessment/exams/${id}/schedules_status/`);
    return res.data;
  },

  /** Publish exam and generate student PINs */
  publish: async (id: number): Promise<{ success: boolean; message: string; pins_created: number }> => {
    const res = await api.post(`/api/assessment/exams/${id}/publish/`);
    return res.data;
  },

  unpublish: async (id: number): Promise<SuccessResponse> => {
    const res = await api.post(`/api/assessment/exams/${id}/unpublish/`);
    return res.data;
  },

  getPracticeExams: async (): Promise<{ count: number; exams: Exam[] }> => {
    const res = await api.get('/api/assessment/exams/practice_exams/');
    return res.data;
  },

  /** Get student PINs for an exam with optional filters */
  getStudentPins: async (id: number, filters?: {
    class_id?: number;
    class_section_id?: number;
     schedule_id?: number;
  }): Promise<StudentPinsResponse> => {
    const res = await api.get(`/api/assessment/exams/${id}/student_pins/`, { params: filters });
    return res.data;
  },

  /** Download PIN PDF — returns blob */
  downloadPinsPdf: async (id: number, options?: {
    class_id?: number;
    class_section_id?: number;
    students_per_row?: number;
  }): Promise<Blob> => {
    const res = await api.post(`/api/assessment/exams/${id}/download_pins_pdf/`, null, {
      params: options,
      responseType: 'blob',
    });
    return res.data;
  },
};

// ============================================================================
// EXAM SCHEDULES
// ============================================================================

export const examSchedulesAPI = {
  list: async (filters?: {
    exam?: number;
    subject?: number;
    class_configuration?: number;
    setup_status?: string;
  }): Promise<ExamSchedule[]> => {
    const res = await api.get('/api/assessment/exam-schedules/', { params: filters });
    return unwrapList<ExamSchedule>(res.data);
  },

  get: async (id: number): Promise<ExamScheduleDetail> => {
    const res = await api.get(`/api/assessment/exam-schedules/${id}/`);
    return unwrap<ExamScheduleDetail>(res.data);
  },

  update: async (id: number, data: Partial<ExamScheduleUpdateFormValues>): Promise<ExamSchedule> => {
    const res = await api.put(`/api/assessment/exam-schedules/${id}/`, data);
    return unwrap<ExamSchedule>(res.data);
  },

  setQuestionRequirements: async (
    id: number,
    data: QuestionRequirementsFormValues
  ): Promise<QuestionRequirementsResponse> => {
    const res = await api.post(`/api/assessment/exam-schedules/${id}/set_question_requirements/`, data);
    return res.data;
  },

  validateQuestions: async (id: number): Promise<ValidateQuestionsResponse> => {
    const res = await api.post(`/api/assessment/exam-schedules/${id}/validate_questions/`);
    return res.data;
  },

  /** Add questions to schedule (replaces all existing) */
  addQuestions: async (id: number, data: {
    question_ids: number[];
    custom_marks?: Record<string, number>;
    sections?: Record<string, number>;
    order?: number[];
  }): Promise<{ success: boolean; message: string; setup_status: string; questions_added: number }> => {
    const res = await api.post(`/api/assessment/exam-schedules/${id}/add_questions/`, data);
    return res.data;
  },

  getAssignedQuestions: async (id: number): Promise<{
    schedule_id: number;
    total_questions: number;
    questions: ExamQuestionDetail[];
  }> => {
    const res = await api.get(`/api/assessment/exam-schedules/${id}/assigned_questions/`);
    return res.data;
  },

  getAvailableForCopy: async (id: number): Promise<any[]> => {
    const res = await api.get(`/api/assessment/exam-schedules/${id}/available_for_copy/`);
    return res.data;
  },

  copy: async (id: number, data: {
    target_schedule_ids: number[];
    copy_questions?: boolean;
    copy_datetime?: boolean;
    copy_hall?: boolean;
    copy_invigilators?: boolean;
  }): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/api/assessment/exam-schedules/${id}/copy_schedule/`, data);
    return res.data;
  },

  aiGenerateQuestions: async (id: number, data: {
      question_type: string;
      difficulty: string;
      topics: number[];
      count: number;
      overhaul: boolean;
    }): Promise<{ success: boolean; added_count: number }> => {
      const res = await api.post(
        `/api/assessment/exam-schedules/${id}/ai_generate_questions/`,
        data,
        { timeout: 60000 }
      );
      return res.data;
    },

  markReady: async (id: number): Promise<SuccessResponse & { setup_status: string }> => {    const res = await api.post(`/api/assessment/exam-schedules/${id}/mark_ready/`);
    return res.data;
  },

  getStudentsList: async (id: number): Promise<StudentsListResponse> => {
    const res = await api.get(`/api/assessment/exam-schedules/${id}/students_list/`);
    return res.data;
  },

  getStudentAttemptDetail: async (id: number, studentId: number): Promise<{
    attempt: StudentExamAttempt;
    answers: StudentAnswer[];
    proctoring_events: ProctoringEvent[];
  }> => {
    const res = await api.get(`/api/assessment/exam-schedules/${id}/student_attempt_detail/`, {
      params: { student_id: studentId },
    });
    return res.data;
  },
};

// ============================================================================
// EXAM SECTIONS
// ============================================================================

export const examSectionsAPI = {
  list: async (examScheduleId: number): Promise<ExamSection[]> => {
    const res = await api.get('/api/assessment/exam-sections/', {
      params: { exam_schedule: examScheduleId },
    });
    return unwrapList<ExamSection>(res.data);
  },

  get: async (id: number): Promise<ExamSection> => {
    const res = await api.get(`/api/assessment/exam-sections/${id}/`);
    return unwrap<ExamSection>(res.data);
  },

  create: async (data: ExamSectionFormValues): Promise<ExamSection> => {
    const res = await api.post('/api/assessment/exam-sections/', data);
    return unwrap<ExamSection>(res.data);
  },

  update: async (id: number, data: Partial<ExamSectionFormValues>): Promise<ExamSection> => {
    const res = await api.put(`/api/assessment/exam-sections/${id}/`, data);
    return unwrap<ExamSection>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/exam-sections/${id}/`);
  },
};

// ============================================================================
// EXAM QUESTIONS (assigned to schedule)
// ============================================================================

export const examQuestionsAPI = {
  list: async (filters?: {
    exam_schedule?: number;
    exam_section?: number;
  }): Promise<ExamQuestion[]> => {
    const res = await api.get('/api/assessment/exam-questions/', { params: filters });
    return unwrapList<ExamQuestion>(res.data);
  },

  bulkAdd: async (data: BulkAddQuestionsPayload): Promise<BulkAddQuestionsResponse> => {
    const res = await api.post('/api/assessment/exam-questions/bulk_add/', data);
    return res.data;
  },

  reorder: async (data: ReorderQuestionsPayload): Promise<SuccessResponse> => {
    const res = await api.post('/api/assessment/exam-questions/reorder/', data);
    return res.data;
  },

  bulkDelete: async (questionIds: number[]): Promise<SuccessResponse> => {
    const res = await api.delete('/api/assessment/exam-questions/bulk_delete/', {
      data: { question_ids: questionIds },
    });
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/assessment/exam-questions/${id}/`);
  },
};

// ============================================================================
// EXAM ENTRY (public endpoints — no login required)
// ============================================================================

export const examEntryAPI = {
  /** Validate exam code + admission number + PIN */
  validateEntry: async (data: ExamEntryValidationPayload): Promise<ExamEntryValidationResponse> => {
    const res = await api.post('/api/assessment/exam-entry/validate-entry/', data);
    return res.data;
  },
};

// ============================================================================
// STUDENT EXAM FLOW (authenticated)
// ============================================================================

export const studentExamAPI = {
  /** Step 1: Check exam code exists */
  verifyCode: async (examCode: string): Promise<ExamCodeVerifyResponse> => {
    const res = await api.post('/api/assessment/student/exam-code-verify/', { exam_code: examCode });
    return res.data;
  },

  /** Step 2: Auth with password, get exam details */
  authenticate: async (data: {
    exam_schedule_id: number;
    password?: string;
  }): Promise<ExamAuthResponse> => {
    const res = await api.post('/api/assessment/student/exam-authenticate/', data);
    return res.data;
  },

  /** Step 3: Start attempt, get questions */
  start: async (data: {
    exam_schedule_id: number;
    device_info?: any;
    examination_hall_id?: number;
  }): Promise<ExamStartResponse> => {
    const res = await api.post('/api/assessment/student/exam-start/', data);
    return res.data;
  },

  /** Auto-save single answer */
  saveAnswer: async (data: SaveAnswerPayload): Promise<{
    success: boolean;
    answer_id: number;
    saved_at: string;
    save_count: number;
  }> => {
    const res = await api.post('/api/assessment/student/answer-save/', data);
    return res.data;
  },

  /** Submit exam */
  submit: async (attemptId: string): Promise<ExamSubmitResponse> => {
    const res = await api.post('/api/assessment/student/exam-submit/', { attempt_id: attemptId });
    return res.data;
  },

  /** Get result after submission */
  getResult: async (attemptId: string): Promise<ExamResultResponse> => {
    const res = await api.get(`/api/assessment/student/exam-result/${attemptId}/`);
    return res.data;
  },

  /** Student dashboard — upcoming, in_progress, completed, practice */
  getDashboard: async (): Promise<StudentDashboardResponse> => {
    const res = await api.get('/api/assessment/student/dashboard/');
    return res.data;
  },
};

// ============================================================================
// EXAM ATTEMPTS (ViewSet — attempt_id based)
// ============================================================================

export const examAttemptsAPI = {
  /** Get questions for an active attempt */
  getQuestions: async (attemptId: string): Promise<any> => {
    const res = await api.get(`/api/assessment/exam-attempts/${attemptId}/questions/`);
    return res.data;
  },

  /** Bulk save answers (auto-save) */
  saveAnswers: async (attemptId: string, answers: BulkSaveAnswersPayload['answers']): Promise<SuccessResponse> => {
    const res = await api.post(`/api/assessment/exam-attempts/${attemptId}/save-answers/`, { answers });
    return res.data;
  },

  /** Submit attempt */
  submit: async (attemptId: string, autoSubmit = false): Promise<{
    success: boolean;
    message: string;
    attempt_id: string;
    submitted_at: string;
  }> => {
    const res = await api.post(`/api/assessment/exam-attempts/${attemptId}/submit/`, {
      auto_submit: autoSubmit,
    });
    return res.data;
  },

  /** Log proctoring event from student side */
  logEvent: async (attemptId: string, data: {
    event_type: string;
    severity?: string;
    event_data?: Record<string, any>;
  }): Promise<SuccessResponse> => {
    const res = await api.post(`/api/assessment/exam-attempts/${attemptId}/log-event/`, data);
    return res.data;
  },
};

// ============================================================================
// PROCTORING
// ============================================================================

export const proctoringAPI = {
  list: async (filters?: {
    attempt?: number;
    event_type?: string;
    severity?: string;
    reviewed?: boolean;
    action_taken?: string;
  }): Promise<ProctoringEvent[]> => {
    const res = await api.get('/api/assessment/proctoring-events/', { params: filters });
    return unwrapList<ProctoringEvent>(res.data);
  },

  /** Create event — use FormData if attaching snapshot */
  create: async (data: FormData | ProctoringEventCreatePayload): Promise<ProctoringEvent> => {
    const isFormData = data instanceof FormData;
    const res = await api.post('/api/assessment/proctoring-events/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return unwrap<ProctoringEvent>(res.data);
  },

  review: async (id: number, data: {
    action_taken: 'ignored' | 'warning' | 'invalidated' | 'pending';
    review_notes?: string;
  }): Promise<{ success: boolean; message: string; event: ProctoringEvent }> => {
    const res = await api.post(`/api/assessment/proctoring-events/${id}/review/`, data);
    return res.data;
  },

  bulkReview: async (data: {
    event_ids: number[];
    action_taken: string;
    review_notes?: string;
  }): Promise<{ success: boolean; message: string; count: number }> => {
    const res = await api.post('/api/assessment/proctoring-events/bulk_review/', data);
    return res.data;
  },

  getPendingReview: async (): Promise<{ total_pending: number; by_severity: any }> => {
    const res = await api.get('/api/assessment/proctoring-events/pending_review/');
    return res.data;
  },

  /** Real-time dashboard for invigilators */
  getDashboard: async (examScheduleId: number): Promise<ProctoringDashboardResponse> => {
    const res = await api.get(`/api/assessment/proctoring/dashboard/${examScheduleId}/`);
    return res.data;
  },
};

// ============================================================================
// INVIGILATOR SESSIONS
// ============================================================================

export const invigilatorSessionsAPI = {
  list: async (filters?: {
    exam_schedule?: number;
    is_active?: boolean;
    invigilator?: number;
  }): Promise<InvigilatorSession[]> => {
    const res = await api.get('/api/assessment/invigilator-sessions/', { params: filters });
    return unwrapList<InvigilatorSession>(res.data);
  },

  startMonitoring: async (examScheduleId: number): Promise<{
    success: boolean;
    message: string;
    session: InvigilatorSession;
  }> => {
    const res = await api.post('/api/assessment/invigilator-sessions/start_monitoring/', {
      exam_schedule_id: examScheduleId,
    });
    return res.data;
  },

  endSession: async (id: number): Promise<{ success: boolean; message: string; duration_seconds: number }> => {
    const res = await api.post(`/api/assessment/invigilator-sessions/${id}/end_session/`);
    return res.data;
  },
};

// ============================================================================
// TEACHER DASHBOARD & MARKING
// ============================================================================

export const teacherDashboardAPI = {
  get: async (): Promise<TeacherDashboardResponse> => {
    const res = await api.get('/api/assessment/teacher/dashboard/');
    return res.data;
  },

  getMarkingDashboard: async (examScheduleId?: number): Promise<MarkingDashboardResponse> => {
    const res = await api.get('/api/assessment/teacher/marking-dashboard/', {
      params: examScheduleId ? { exam_schedule_id: examScheduleId } : {},
    });
    return res.data;
  },

  markAnswer: async (data: MarkAnswerPayload): Promise<{
    success: boolean;
    message: string;
    answer: StudentAnswer;
  }> => {
    const res = await api.post('/api/assessment/teacher/mark-answer/', data);
    return res.data;
  },

  bulkMarkAnswers: async (marks: MarkAnswerPayload[]): Promise<{
    success: boolean;
    marked_count: number;
    errors?: string[];
  }> => {
    const res = await api.post('/api/assessment/teacher/bulk-mark/', { marks });
    return res.data;
  },
};

// ============================================================================
// SCANNED ANSWER SHEETS
// ============================================================================

export const scannedSheetsAPI = {
  list: async (filters?: {
    attempt?: number;
    ocr_status?: string;
    ai_grading_status?: string;
  }): Promise<ScannedAnswerSheet[]> => {
    const res = await api.get('/api/assessment/scanned-sheets/', { params: filters });
    return unwrapList<ScannedAnswerSheet>(res.data);
  },

  upload: async (data: FormData): Promise<ScannedAnswerSheet> => {
    const res = await api.post('/api/assessment/scanned-sheets/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap<ScannedAnswerSheet>(res.data);
  },

  bulkUpload: async (data: FormData): Promise<{
    success: boolean;
    message: string;
    sheet_ids: number[];
  }> => {
    const res = await api.post('/api/assessment/scanned-sheets/bulk_upload/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  process: async (id: number): Promise<{ success: boolean; message: string; task_id: string }> => {
    const res = await api.post(`/api/assessment/scanned-sheets/${id}/process/`);
    return res.data;
  },

  getProcessingStatus: async (id: number): Promise<ScannedSheetProcessingStatus> => {
    const res = await api.get(`/api/assessment/scanned-sheets/${id}/processing_status/`);
    return res.data;
  },
};


// ============================================================================
// AI MARKING QUEUE
// ============================================================================

export const aiMarkingQueueAPI = {
  list: async (filters?: { status?: string }): Promise<AIMarkingQueue[]> => {
    const res = await api.get('/api/assessment/ai-marking-queue/', { params: filters });
    return unwrapList<AIMarkingQueue>(res.data);
  },

  getStats: async (): Promise<AIMarkingQueueStats> => {
    const res = await api.get('/api/assessment/ai-marking-queue/queue_stats/');
    return res.data;
  },

  retry: async (id: number): Promise<{ success: boolean; message: string; task_id: string }> => {
    const res = await api.post(`/api/assessment/ai-marking-queue/${id}/retry/`);
    return res.data;
  },
};

// ============================================================================
// ANALYTICS
// ============================================================================

export const assessmentAnalyticsAPI = {
  getExamAnalytics: async (examId: number): Promise<ExamAnalyticsResponse> => {
    const res = await api.get(`/api/assessment/analytics/exam/${examId}/`);
    return res.data;
  },

  getClassPerformance: async (params: {
    class_config_id: number;
    session_id: number;
    term_id: number;
  }): Promise<ClassPerformanceReportResponse> => {
    const res = await api.get('/api/assessment/analytics/class-performance/', { params });
    return res.data;
  },

  getExamMaxMark: async (classConfigurationId: number): Promise<ExamMaxMarkResponse> => {
    const res = await api.get('/api/assessment/get-exam-max-mark/', {
      params: { class_configuration_id: classConfigurationId },
    });
    return res.data;
  },
};

// ============================================================================
// RESULT TRANSFER
// ============================================================================

export const resultTransferAPI = {
  list: async (params?: { exam?: number; new_transfer?: string }): Promise<ExamResultTransferConfig[]> => {
    const res = await api.get('/api/assessment/result-transfers/', { params });
    return unwrapList<ExamResultTransferConfig>(res.data);
  },

  get: async (id: number): Promise<ExamResultTransferConfig> => {
    const res = await api.get(`/api/assessment/result-transfers/${id}/`);
    return unwrap<ExamResultTransferConfig>(res.data);
  },

  create: async (data: { exam: number; result_field: number; round_to_nearest_half?: boolean }): Promise<ExamResultTransferConfig> => {
    const res = await api.post('/api/assessment/result-transfers/', data);
    return unwrap<ExamResultTransferConfig>(res.data);
  },

  update: async (id: number, data: Partial<ExamResultTransferConfig>): Promise<ExamResultTransferConfig> => {
    const res = await api.put(`/api/assessment/result-transfers/${id}/`, data);
    return unwrap<ExamResultTransferConfig>(res.data);
  },

  previewTransfer: async (id: number): Promise<TransferPreviewResponse | any> => {
    const res = await api.get(`/api/assessment/result-transfers/${id}/transfer_preview/`);
    return res.data;
  },

  executeTransfer: async (id: number, data?: {
    exempted_class_ids?: number[];
    class_overrides?: Record<number, { scale: boolean }>;
  }): Promise<TransferExecuteResponse | any> => {
    const res = await api.post(`/api/assessment/result-transfers/${id}/execute-transfer/`, data || {});
    return res.data;
  },
};

// ============================================================================
// SCANNED EXAMS
// ============================================================================

export const scannedExamsAPI = {
  list: async (params?: any): Promise<any[]> => {
    const res = await api.get('/api/assessment/scanned-exams/', { params });
    return res.data.results || res.data;
  },

  get: async (id: number): Promise<any> => {
    const res = await api.get(`/api/assessment/scanned-exams/${id}/`);
    return res.data;
  },

  create: async (data: any): Promise<any> => {
    const res = await api.post('/api/assessment/scanned-exams/', data);
    return res.data;
  },

  createSchedules: async (id: number): Promise<any> => {
    const res = await api.post(`/api/assessment/scanned-exams/${id}/create_schedules/`);
    return res.data;
  },

  getSchedules: async (examId: number): Promise<any[]> => {
    const res = await api.get('/api/assessment/scanned-exam-schedules/', { params: { scanned_exam: examId } });
    return res.data.results || res.data;
  },

  getSchedule: async (id: number): Promise<any> => {
    const res = await api.get(`/api/assessment/scanned-exam-schedules/${id}/`);
    return res.data;
  },

  uploadQuestionFile: async (scheduleId: number, files: File[]): Promise<any> => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    const res = await api.post(`/api/assessment/scanned-exam-schedules/${scheduleId}/upload_question_file/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  getQuestionStatus: async (scheduleId: number): Promise<any> => {
    const res = await api.get(`/api/assessment/scanned-exam-schedules/${scheduleId}/question_setup_status/`);
    return res.data;
  },

  confirmQuestions: async (scheduleId: number): Promise<any> => {
    const res = await api.post(`/api/assessment/scanned-exam-schedules/${scheduleId}/confirm_questions/`);
    return res.data;
  },

  getSubmissions: async (scheduleId: number): Promise<any[]> => {
    const res = await api.get('/api/assessment/scanned-student-submissions/', { params: { schedule: scheduleId } });
    return res.data.results || res.data;
  },

  uploadStudentAnswer: async (scheduleId: number, studentId: number, files: File[]): Promise<any> => {
    const fd = new FormData();
    fd.append('schedule_id', scheduleId.toString());
    fd.append('student_id', studentId.toString());
    files.forEach(f => fd.append('files', f));
    const res = await api.post('/api/assessment/scanned-student-submissions/upload_student_answer/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  publishMarking: async (scheduleId: number, confirm = false): Promise<any> => {
    const res = await api.post(`/api/assessment/scanned-exam-schedules/${scheduleId}/publish_marking/`, { confirm });
    return res.data;
  },
};

// ============================================================================
// DASHBOARD
// ============================================================================

export const dashboardAPI = {
  getStats: async (): Promise<any> => {
    const res = await api.get('/api/assessment/dashboard/stats/');
    return res.data;
  },
};
