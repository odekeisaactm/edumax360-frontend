

// ── Settings (singleton) ─────────────────────────────────────
import api from './api';
import type {
  ResultSettings,
  ResultTemplate,
  ActiveTemplates,
  ResultConfigurationGroup,
  ResultConfigurationGroupWrite,
  ResultGradeSet,
  ResultGrade,
  ResultPublish,
  PublishStats,
  ResultFieldSet,
  ResultField,
  ResultBehaviorCategory,
  ResultBehaviorField,
  TextResultCategory,
  TextResultField,
  ResultCommentTemplate,
  ResultUploadPayload,
  ResultUploadTracking,
  TextRatingOption,
  TextResultUploadPayload,
  StudentResultComment,
  ResultSpreadsheet,
  ResultStatistics,
  ResultModel,
  CumulativeResult,
  ConfigurationReadiness,
  PaginatedResponse
} from '@/lib/types';


export const resultSettingsAPI = {
  get: async (): Promise<ResultSettings | null> => {
    try {
      const r = await api.get('/api/result/settings/retrieve_settings/');
      return r.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  },
  update: async (data: Partial<ResultSettings>): Promise<ResultSettings> => {
    const r = await api.patch('/api/result/settings/update_settings/', data);
    return r.data;
  },
};

// ── Templates ─────────────────────────────────────────────────

export const resultTemplatesAPI = {
  list: async (type?: 'score' | 'text' | 'combined'): Promise<ResultTemplate[]> => {
    const r = await api.get('/api/result/templates/list_templates/', {
      params: type ? { type } : undefined,
    });
    return r.data.templates;
  },
  retrieve: async (id: string): Promise<ResultTemplate> => {
    const r = await api.get('/api/result/templates/retrieve_template/', { params: { id } });
    return r.data;
  },
  active: async (): Promise<ActiveTemplates> => {
    const r = await api.get('/api/result/templates/active/');
    return r.data;
  },
  select: async (payload: { type: 'score' | 'text' | 'combined'; template_id: string | null }): Promise<{
  updated: boolean;
  type: string;
  selected_id: string | null;
  template: ResultTemplate | null;
}> => {
  const r = await api.post('/api/result/templates/select/', payload);
  return r.data;
},
};

// ── Configuration Groups ──────────────────────────────────────

export const resultGroupsAPI = {
  list: async (params?: { is_active?: boolean; school_section?: number }): Promise<ResultConfigurationGroup[]> => {
    const r = await api.get('/api/result/groups/', { params });
    return r.data.results || r.data;
  },
  get: async (id: number): Promise<ResultConfigurationGroup> => {
    const r = await api.get(`/api/result/groups/${id}/`);
    return r.data;
  },
  create: async (data: ResultConfigurationGroupWrite): Promise<ResultConfigurationGroup> => {
    const r = await api.post('/api/result/groups/', data);
    return r.data;
  },
  update: async (id: number, data: Partial<ResultConfigurationGroupWrite>): Promise<ResultConfigurationGroup> => {
    const r = await api.patch(`/api/result/groups/${id}/`, data);
    return r.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/result/groups/${id}/`);
  },
  assignClasses: async (
    id: number,
    class_configuration_ids: number[],
    replace: boolean = true,
  ): Promise<{ assigned: number; group: ResultConfigurationGroup; warnings?: any }> => {
    const r = await api.post(`/api/result/groups/${id}/assign-classes/`, {
      class_configuration_ids,
      replace,
    });
    return r.data;
  },
  readiness: async (id: number): Promise<{
    all_ready: boolean;
    classes: Array<{ class: string; class_id: number; is_ready: boolean; errors: string[] }>;
  }> => {
    const r = await api.get(`/api/result/groups/${id}/readiness/`);
    return r.data;
  },
};

// ── Grade Sets ────────────────────────────────────────────────

export const resultGradeSetsAPI = {
  list: async (params?: { configuration_group?: number; is_active?: boolean }): Promise<ResultGradeSet[]> => {
    const r = await api.get('/api/result/grade-sets/', { params });
    return r.data.results || r.data;
  },
  get: async (id: number): Promise<ResultGradeSet> => {
    const r = await api.get(`/api/result/grade-sets/${id}/`);
    return r.data;
  },
  create: async (data: { name: string; description?: string; configuration_group: number; is_active?: boolean }): Promise<ResultGradeSet> => {
    const r = await api.post('/api/result/grade-sets/', data);
    return r.data;
  },
  update: async (id: number, data: Partial<ResultGradeSet>): Promise<ResultGradeSet> => {
    const r = await api.patch(`/api/result/grade-sets/${id}/`, data);
    return r.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/result/grade-sets/${id}/`);
  },
  activate: async (id: number): Promise<{
    activated: boolean;
    grade_set: ResultGradeSet;
    warnings?: string[];
  }> => {
    const r = await api.post(`/api/result/grade-sets/${id}/activate/`);
    return r.data;
  },
  validateCoverage: async (id: number): Promise<{
    end_of_term: { valid: boolean; message: string };
    midterm?: { valid: boolean; message: string };
  }> => {
    const r = await api.post(`/api/result/grade-sets/${id}/validate-coverage/`);
    return r.data;
  },
};

// ── Grades ────────────────────────────────────────────────────

export const resultGradesAPI = {
  list: async (params?: { grade_set?: number; grade_type?: string }): Promise<ResultGrade[]> => {
    const r = await api.get('/api/result/grades/', { params });
    return r.data.results || r.data;
  },
  create: async (data: Omit<ResultGrade, 'id'>): Promise<ResultGrade> => {
    const r = await api.post('/api/result/grades/', data);
    return r.data;
  },
  update: async (id: number, data: Partial<ResultGrade>): Promise<ResultGrade> => {
    const r = await api.patch(`/api/result/grades/${id}/`, data);
    return r.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/result/grades/${id}/`);
  },
};

// ── Publish ───────────────────────────────────────────────────

export const resultPublishAPI = {
  list: async (): Promise<ResultPublish[]> => {
    const r = await api.get('/api/result/publish/');
    return r.data;
  },
  toggle: async (id: number): Promise<ResultPublish> => {
    const r = await api.post(`/api/result/publish/${id}/toggle-publish/`);
    return r.data;
  },
  split: async (id: number): Promise<ResultPublish[]> => {
    const r = await api.post(`/api/result/publish/${id}/split/`);
    return r.data;
  },
  merge: async (id: number): Promise<ResultPublish> => {
    const r = await api.post(`/api/result/publish/${id}/merge/`);
    return r.data;
  },
  stats: async (params: { period_id: number; result_type: string; section_id?: number | null }): Promise<PublishStats> => {
    const r = await api.get('/api/result/publish/term_stats/', { params });
    return r.data;
  },
};

// ── Field Sets ────────────────────────────────────────────────

export const resultFieldSetsAPI = {
  list: async (params?: { configuration_group?: number; is_active?: boolean }): Promise<ResultFieldSet[]> => {
    const r = await api.get('/api/result/field-sets/', { params });
    return r.data.results || r.data;
  },
  get: async (id: number): Promise<ResultFieldSet> => {
    const r = await api.get(`/api/result/field-sets/${id}/`);
    return r.data;
  },
  create: async (data: { name: string; description?: string; configuration_group: number; is_active?: boolean }): Promise<ResultFieldSet> => {
    const r = await api.post('/api/result/field-sets/', data);
    return r.data;
  },
  update: async (id: number, data: Partial<ResultFieldSet>): Promise<ResultFieldSet> => {
    const r = await api.patch(`/api/result/field-sets/${id}/`, data);
    return r.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/result/field-sets/${id}/`);
  },
  activate: async (id: number): Promise<{
    activated: boolean;
    field_set: ResultFieldSet;
    warnings?: string[];
  }> => {
    const r = await api.post(`/api/result/field-sets/${id}/activate/`);
    return r.data;
  },
  validateTotals: async (id: number): Promise<{
    end_of_term: { valid: boolean; total: string; message: string };
    midterm?: { valid: boolean; total: string; message: string };
  }> => {
    const r = await api.post(`/api/result/field-sets/${id}/validate-totals/`);
    return r.data;
  },
};

// ── Fields ────────────────────────────────────────────────────

export const resultFieldsAPI = {
  list: async (params?: { field_set?: number; field_type?: string; is_midterm?: boolean }): Promise<ResultField[]> => {
    const r = await api.get('/api/result/fields/', { params });
    return r.data.results || r.data;
  },
  create: async (data: Omit<ResultField, 'id'>): Promise<ResultField> => {
    const r = await api.post('/api/result/fields/', data);
    return r.data;
  },
  update: async (id: number, data: Partial<ResultField>): Promise<ResultField> => {
    const r = await api.patch(`/api/result/fields/${id}/`, data);
    return r.data;
  },
  delete: async (id: number): Promise<{ deleted: boolean; warning?: string }> => {
    // Note: backend returns 200 with warning if field deletion breaks 100-mark total
    const r = await api.delete(`/api/result/fields/${id}/`);
    return r.data || { deleted: true };
  },
};

// ── Behavior ──────────────────────────────────────────────────

export const resultBehaviorAPI = {
  listCategories: async (params?: { school_section?: number }): Promise<ResultBehaviorCategory[]> => {
    const r = await api.get('/api/result/behavior-categories/', { params });
    return r.data.results || r.data;
  },
  createCategory: async (data: Omit<ResultBehaviorCategory, 'id' | 'fields_list'>): Promise<ResultBehaviorCategory> => {
    const r = await api.post('/api/result/behavior-categories/', data);
    return r.data;
  },
  updateCategory: async (id: number, data: Partial<ResultBehaviorCategory>): Promise<ResultBehaviorCategory> => {
    const r = await api.patch(`/api/result/behavior-categories/${id}/`, data);
    return r.data;
  },
  deleteCategory: async (id: number): Promise<void> => {
    await api.delete(`/api/result/behavior-categories/${id}/`);
  },
  listFields: async (params?: { category?: number }): Promise<ResultBehaviorField[]> => {
    const r = await api.get('/api/result/behavior-fields/', { params });
    return r.data.results || r.data;
  },
  createField: async (data: Omit<ResultBehaviorField, 'id'>): Promise<ResultBehaviorField> => {
    const r = await api.post('/api/result/behavior-fields/', data);
    return r.data;
  },
  updateField: async (id: number, data: Partial<ResultBehaviorField>): Promise<ResultBehaviorField> => {
    const r = await api.patch(`/api/result/behavior-fields/${id}/`, data);
    return r.data;
  },
  deleteField: async (id: number): Promise<void> => {
    await api.delete(`/api/result/behavior-fields/${id}/`);
  },
};

// ── Text Result Categories & Fields ───────────────────────────

export const textCategoriesAPI = {
  list: async (params?: {
    school_section?: number;
    period_id?: number;
    session?: number;
    academic_period?: number;
  }): Promise<TextResultCategory[]> => {
    const r = await api.get('/api/result/text-categories/', { params });
    return r.data.results || r.data;
  },
  get: async (id: number): Promise<TextResultCategory> => {
    const r = await api.get(`/api/result/text-categories/${id}/`);
    return r.data;
  },
  create: async (data: Omit<TextResultCategory, 'id' | 'fields_list'>): Promise<TextResultCategory> => {
    const r = await api.post('/api/result/text-categories/', data);
    return r.data;
  },
  update: async (id: number, data: Partial<TextResultCategory>): Promise<TextResultCategory> => {
    const r = await api.patch(`/api/result/text-categories/${id}/`, data);
    return r.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/result/text-categories/${id}/`);
  },
  copyFromLastSession: async (session_id: number): Promise<{ copied: number; message: string }> => {
    const r = await api.post('/api/result/text-categories/copy-from-last-session/', { session_id });
    return r.data;
  },
  listFields: async (params?: { category?: number }): Promise<TextResultField[]> => {
    const r = await api.get('/api/result/text-fields/', { params });
    return r.data.results || r.data;
  },
  createField: async (data: Omit<TextResultField, 'id'>): Promise<TextResultField> => {
    const r = await api.post('/api/result/text-fields/', data);
    return r.data;
  },
  updateField: async (id: number, data: Partial<TextResultField>): Promise<TextResultField> => {
    const r = await api.patch(`/api/result/text-fields/${id}/`, data);
    return r.data;
  },
  deleteField: async (id: number): Promise<void> => {
    await api.delete(`/api/result/text-fields/${id}/`);
  },
};

// ── Comment Templates ─────────────────────────────────────────

export const resultCommentTemplatesAPI = {
  list: async (params?: {
    configuration_group?: number;
    comment_type?: 'form_teacher' | 'head_teacher';
    applies_to?: 'end_of_term' | 'midterm' | 'both';
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<ResultCommentTemplate>> => {
    const r = await api.get<any>('/api/result/comment-templates/', { params });
    return {
      count: r.data?.count ?? 0,
      next: r.data?.next ?? null,
      previous: r.data?.previous ?? null,
      results: r.data?.results ?? (Array.isArray(r.data) ? r.data : []),
    };
  },
  create: async (data: Omit<ResultCommentTemplate, 'id'>): Promise<ResultCommentTemplate> => {
    const r = await api.post('/api/result/comment-templates/', data);
    return r.data;
  },
  update: async (id: number, data: Partial<ResultCommentTemplate>): Promise<ResultCommentTemplate> => {
    const r = await api.patch(`/api/result/comment-templates/${id}/`, data);
    return r.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/result/comment-templates/${id}/`);
  },
  preview: async (params: {
    group_id: number;
    score: number;
    type: 'form_teacher' | 'head_teacher';
  }): Promise<{ score: number; comment_type: string; auto_comment: string | null; has_match: boolean }> => {
    const r = await api.get('/api/result/comment-templates/preview/', { params });
    return r.data;
  },
};

// ── Upload (score) ────────────────────────────────────────────

export const resultUploadAPI = {
  myClasses: async (): Promise<Array<{ id: number; name: string; result_type: string }>> => {
    // Note: DRF action url uses hyphen not underscore
    const r = await api.get('/api/result/upload/my-classes/');
    return r.data.classes;
  },
  prepare: async (params: {
    class_config_id: number;
    subject_id: number;
    period_id?: number;
  }): Promise<{
    class_config_id: number;
    class_name: string;
    subject_id: number;
    subject_name: string;
    period_id: number;
    period_name: string;
    session_id: number;
    session_name: string;
    fields: Array<{ name: string; max_mark: number; field_type: string; is_midterm: boolean; order: number }>;
    students: Array<{ student_id: number; student_name: string; reg_number: string; scores: Record<string, number> }>;
    is_update: boolean;
  }> => {
    const r = await api.get('/api/result/upload/prepare/', { params });
    return r.data;
  },
  submit: async (data: ResultUploadPayload): Promise<{
    saved: number;
    has_ca: boolean;
    has_exam: boolean;
    errors: any[];
    message: string;
  }> => {
    const r = await api.post('/api/result/upload/submit/', data);
    return r.data;
  },
  tracking: async (params: {
    class_config_id: number;
    period_id?: number;
  }): Promise<{
    class_name: string;
    period_name: string;
    tracking: ResultUploadTracking[];
  }> => {
    const r = await api.get('/api/result/upload/tracking/', { params });
    return r.data;
  },
};

// ── Upload (text) ─────────────────────────────────────────────

export const textResultUploadAPI = {
  studentList: async (params: {
    class_config_id: number;
    student_type?: string;
    include_all?: boolean;
  }): Promise<{
    class_name: string;
    students: Array<{ id: number; name: string; reg_number: string; image: string | null; gender: string; has_result: boolean }>;
  }> => {
    // Note: DRF action url uses hyphen not underscore
    const r = await api.get('/api/result/text-upload/student-list/', { params });
    return r.data;
  },
  prepare: async (params: {
    student_id: number;
    class_config_id: number;
    period_id?: number;
  }): Promise<{
    student_id: number;
    student_name: string;
    image: string | null;
    class_config_id: number;
    class_name: string;
    period_id: number;
    period_name: string;
    is_form_teacher: boolean;
    rating_options: TextRatingOption[];
    categories: Array<{
      id: number;
      name: string;
      can_upload: boolean;
      fields: Array<{
        id: number;
        name: string;
        student_type: string;
        rating: string;
        comment: string;
      }>;
    }>;
    is_update: boolean;
  }> => {
    const r = await api.get('/api/result/text-upload/prepare/', { params });
    return r.data;
  },
  submit: async (data: TextResultUploadPayload): Promise<{
    saved: boolean;
    result_id: number;
    message: string;
  }> => {
    const r = await api.post('/api/result/text-upload/submit/', data);
    return r.data;
  },
};

// ── Exam Scripts ─────────────────────────────────────────────

export const examScriptAPI = {
  uploadQuestionPaper: async (data: FormData): Promise<any> => {
    const r = await api.post('/api/result/exam-scripts/upload_question_paper/', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return r.data;
  },
  getQuestionPaper: async (params: { class_config_id: number; subject_id: number; academic_period_id: number }): Promise<any> => {
    const r = await api.get('/api/result/exam-scripts/get_question_paper/', { params });
    return r.data;
  },
  uploadAnswerSheet: async (data: FormData): Promise<any> => {
    const r = await api.post('/api/result/exam-scripts/upload_answer_sheet/', data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return r.data;
  },
  getAnswerSheet: async (params: { student_id: number; class_config_id: number; subject_id: number; academic_period_id: number }): Promise<any> => {
    const r = await api.get('/api/result/exam-scripts/get_answer_sheet/', { params });
    return r.data;
  },
};

// ── Voice AI ──────────────────────────────────────────────────

export const resultVoiceAPI = {
  interpret: async (data: { transcript: string; context: any }): Promise<{
    intent: string;
    student_id?: number;
    field_name?: string;
    value?: number;
    rating?: string;
    text?: string;
    reason?: string;
    error?: string;
  }> => {
    const r = await api.post('/api/result/voice/interpret/', data, {
      timeout: 30000,  // Add 30 second timeout here
    });
    return r.data;
  },
  correctComment: async (data: { text: string }): Promise<{
    corrected_text: string;
    reason?: string;
    error?: string;
  }> => {
    const r = await api.post('/api/result/voice/correct-comment/', data, {
      timeout: 30000,  // Add timeout here too
    });
    return r.data;
  },
};

export const resultCommentsAPI = {
  get: async (params: {
    student_id: number;
    period_id: number;
  }): Promise<StudentResultComment | null> => {
    try {
      // Note: DRF action url uses hyphen not underscore
      const r = await api.get('/api/result/comments/retrieve-comment/', { params });
      return r.data;
    } catch (e: any) {
      if (e.response?.status === 404) return null;
      throw e;
    }
  },
  save: async (data: {
    student_id: number;
    period_id: number;
    class_config_id: number;
    form_teacher_comment?: string;
    head_teacher_comment?: string;
    custom_comments?: Record<string, string>;
    total_attendance?: number;
    present_attendance?: number;
    use_auto?: boolean;
  }): Promise<StudentResultComment> => {
    const r = await api.post('/api/result/comments/save-comment/', data);
    return r.data;
  },
  autoFillClass: async (data: {
    class_config_id: number;
    period_id: number;
  }): Promise<{ updated: number; message: string }> => {
    const r = await api.post('/api/result/comments/auto-fill-class/', data);
    return r.data;
  },
};

// ── Behavior Ratings ──────────────────────────────────────────

export const resultBehaviorRatingsAPI = {
  save: async (data: {
    student_id: number;
    session_id: number;
    academic_period_id: number;
    ratings: Record<string, number>;
  }): Promise<StudentResultComment> => {
    const r = await api.post('/api/result/behavior/save-ratings/', data);
    return r.data;
  },
};

// ── Spreadsheet / Detail / Cumulative ────────────────────────

export const resultViewAPI = {
  subjectSpreadsheet: async (params: {
    class_config_id: number;
    subject_id: number;
    period_id?: number;
    session_id?: number;
  }): Promise<ResultSpreadsheet> => {
    const r = await api.get('/api/result/spreadsheet/subject/', { params });
    return r.data;
  },
  fullClassSpreadsheet: async (params: {
    class_config_id: number;
    period_id?: number;
  }): Promise<{
    class_name: string;
    period_name: string;
    session_name: string;
    rows: any[];
    statistics: ResultStatistics[];
  }> => {
    const r = await api.get('/api/result/spreadsheet/full-class/', { params });
    return r.data;
  },
  sessionBroadsheet: async (params: {
    class_config_id: number;
    session_id: number;
  }): Promise<{
    class_name: string;
    session_name: string;
    rows: any[];
  }> => {
    const r = await api.get('/api/result/spreadsheet/session-broadsheet/', { params });
    return r.data;
  },
  studentSheet: async (params: {
    student_id: number;
    period_id?: number;
  }): Promise<ResultModel & { found: boolean; fee_blocked?: boolean; reason?: string }> => {
    const r = await api.get('/api/result/detail/student_sheet/', { params });
    return r.data;
  },
  classList: async (params: {
    class_config_id: number;
    period_id?: number;
  }): Promise<{
    class_name: string;
    period_name: string;
    results: ResultModel[];
  }> => {
    const r = await api.get('/api/result/detail/class-list/', { params });
    return r.data;
  },
  cumulative: async (params: {
    student_id: number;
    session_id: number;
    class_config_id: number;
  }): Promise<CumulativeResult> => {
    const r = await api.get('/api/result/cumulative/student-cumulative/', { params });
    return r.data;
  },
  statistics: async (params?: {
    class_configuration?: number;
    session?: number;
    academic_period?: number;
    subject?: number;
    is_published?: boolean;
  }): Promise<ResultStatistics[]> => {
    const r = await api.get('/api/result/statistics/', { params });
    return r.data.results || r.data;
  },
  recalculateStatistics: async (data: {
    class_config_id: number;
    period_id: number;
  }): Promise<{ recalculated: number; message: string }> => {
    const r = await api.post('/api/result/statistics/recalculate/', data);
    return r.data;
  },
  tracking: async (params?: {
    class_configuration?: number;
    session?: number;
    academic_period?: number;
    subject?: number;
  }): Promise<ResultUploadTracking[]> => {
    const r = await api.get('/api/result/tracking/', { params });
    return r.data.results || r.data;
  },

  trackingDashboard: async (params?: {
    result_type?: 'all' | 'score' | 'text' | 'special' | 'pending';
    search?: string;
    class_id?: number;
    page?: number;
    page_size?: number;
  }): Promise<{
    count: number;
    next: string | null;
    previous: string | null;
    results: any[];
  }> => {
    const r = await api.get('/api/result/tracking/dashboard/', { params });
    return r.data;
  },
};

// ── Readiness ─────────────────────────────────────────────────

export const resultReadinessAPI = {
  check: async (class_config_id: number): Promise<ConfigurationReadiness> => {
    const r = await api.get('/api/result/readiness/', { params: { class_config_id } });
    return r.data;
  },
};

// ── Analytics ─────────────────────────────────────────────────

export const resultAnalyticsAPI = {
  overview: async (params: { session_id: number; period_id: number }) => {
    const r = await api.get('/api/result/analytics/overview/', { params });
    return r.data;
  },
  comparison: async (params: any) => {
    const r = await api.get('/api/result/analytics/comparison/', { params });
    return r.data;
  },
  subjectTrend: async (params: { subject_id: number; class_id?: number }) => {
    const r = await api.get('/api/result/analytics/subject-trend/', { params });
    return r.data;
  },
  studentTracker: async (params: { student_id: number }) => {
    const r = await api.get('/api/result/analytics/student-tracker/', { params });
    return r.data;
  },
  genderAnalysis: async (params: { session_id?: number; period_id?: number; class_id?: number; section_id?: number }) => {
    const r = await api.get('/api/result/analytics/gender-analysis/', { params });
    return r.data;
  },
};

// ── Archive ───────────────────────────────────────────────────

export const resultArchiveAPI = {
  pastClassList: async (params: { session_id: number; period_id: number; class_id: number; result_type?: string }) => {
    const r = await api.get('/api/result/archive/past-class-list/', { params });
    return r.data;
  },
  studentHistory: async (params: { student_id: number }) => {
    const r = await api.get('/api/result/archive/student-history/', { params });
    return r.data;
  },
  // NEW ENDPOINTS FOR STEP 2 & 3
  listStudents: async (params: any) => api.get('/api/result/archive/list_students/', { params }),
  getSpreadsheet: async (params: any) => api.get('/api/result/archive/get_spreadsheet/', { params }),
  prepareEdit: async (params: any) => api.get('/api/result/archive/prepare_edit/', { params }),
  updateRecord: async (data: any) => api.post('/api/result/archive/update_record/', data),
};