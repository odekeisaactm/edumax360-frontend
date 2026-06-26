import axios, { AxiosInstance, AxiosResponse } from 'axios';

import type {
  LoginRequest, LoginResponse, ApiResponse, PaginatedResponse,
  ClassModel, ClassSection, SchoolSection, SchoolAIConfig,
  SchoolInfo, SchoolSettings, Day, Session, AcademicPeriodType,
  AcademicSessionPeriod, HRSettings, Department, Position, Staff,
  CustomStaffField, StaffDocument, StaffLeave, BulkStaffUpload,
  StaffListFilters, LeaveListFilters, StaffFormValues, DepartmentFormValues,
  PositionFormValues, CustomFieldFormValues, LeaveFormValues, GroupFormValues,
  PermissionAssignmentFormValues, CustomFieldForForm, BulkDownloadRequest,
  AcademicSettings, ClassConfiguration, Subject, SubjectGroup,
  ClassSubjectConfiguration, PromotionMapping, BulkPromotionMappingFormValues,
  StudentClassHistory, Timetable, LeadershipRole, TimetableFormValues,
  LeadershipRoleFormValues, Group, Permission, StudentSettings, Utility,
  CustomField, Parent, Student, OtherGuardian, StudentDocument, Fingerprint,
  StudentDuplicateCheckResult, ParentDuplicateCheckResult, ParentFormValues,
  StudentFormValues, ParentListFilters, StudentListFilters, BulkStudentUpload,
  ResetPasswordPayload, ResetPasswordResponse, ToggleStatusPayload,
  ToggleStatusResponse, StudentListItem, ParentListItem, StudentWallet,
  WalletTransaction, Invoice, FamilyInvoice, FeePayment, FamilyFeePayment,
  OtherPayment, FeeGroup, Fee, FeeStructure, Discount, DiscountApplication,
  StudentDiscount, FeeWaiver, SchoolBankDetail, PaymentGatewayConfig,
  StudentFinancialDashboard, InvoiceGenerationJob, FeeSetting,
  InvoiceItem, FamilyInvoiceItem, ItemBreakdownEntry, FamilyItemBreakdownEntry,
  PeriodFeeAmount, WalletField, PaymentMode, PaymentStatus, InvoiceStatus,
  FeeOccurrence, DiscountType, WaiverStatus, GatewayPurpose,
  ClassFormValues, SubjectFormValues, SubjectGroupFormValues,
  DuplicateCheckResult,
  AcademicPeriod,
  Bank,


} from './types';

import { getApiUrl } from './getApiUrl';

// API base URL - dynamically resolved from current domain
const API_BASE_URL = typeof window !== 'undefined' ? getApiUrl() : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');

// Create axios instance with default configuration
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${getApiUrl()}/api/token/refresh/`, {
            refresh: refreshToken,
          });

          const { access } = response.data;
          localStorage.setItem('access_token', access);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await api.post<ApiResponse<LoginResponse>>('/api/auth/login/', data);

      if (response.data.data) {
        // Store tokens
        localStorage.setItem('access_token', response.data.data.token);
        localStorage.setItem('refresh_token', response.data.data.refresh);

        return response.data.data!;
      } else {
        throw new Error(response.data.error || 'Login failed');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Login failed');
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/api/auth/logout/');
    } catch (error) {
      // Even if logout fails, clear local storage
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
  },

  refreshToken: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await axios.post(`${getApiUrl()}/api/token/refresh/`, {
        refresh: refreshToken,
      });

      const { access } = response.data;
      localStorage.setItem('access_token', access);
    } catch (error) {
      throw new Error('Token refresh failed');
    }
  },

  getPermissions: async (): Promise<{ permissions: string[]; active_modules: any[] }> => {
    try {
      const response = await api.get('/api/auth/permissions/');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch permissions');
    }
  },
};

export const schoolInfoAPI = {
  /**
   * Get school information
   * Returns null if doesn't exist (404) - THIS IS NOT AN ERROR!
   * Only throws on actual errors (network, 500, etc.)
   */
  get: async (): Promise<SchoolInfo | null> => {
    try {
      const response = await api.get('/api/school/info/');
      return response.data.data!;
    } catch (error: any) {
      // If 404, school info doesn't exist yet - return null (valid state)
      if (error.response?.status === 404) {
        return null;
      }
      // Re-throw actual errors
      throw error;
    }
  },

  /**
   * Create new school information (for first-time setup)
   */
  create: async (data: Partial<SchoolInfo>): Promise<SchoolInfo> => {
    const response = await api.post('/api/school/info/', data);
    return response.data.data!;
  },

  /**
   * Update existing school information
   */
  update: async (data: Partial<SchoolInfo>): Promise<SchoolInfo> => {
    const response = await api.put('/api/school/info/', data);
    return response.data.data!;
  },

  /**
   * Upload school logo
   */
  uploadLogo: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await api.post('/api/school/upload-logo/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};


export const aiConfigAPI = {
  /**
   * List all AI configurations
   */
  list: async (): Promise<SchoolAIConfig[]> => {
  const response = await api.get('/api/school/ai-configs/');
  return Array.isArray(response.data) ? response.data : (response.data.results ?? []);
},
  /**
   * Create a new AI configuration
   * Note: 'api_key' is not in the TypeScript type but is required for creation
   */
  create: async (data: Partial<SchoolAIConfig> & { api_key?: string }): Promise<SchoolAIConfig> => {
    const response = await api.post('/api/school/ai-configs/', data);
    return response.data;
  },

  /**
   * Retrieve a specific AI configuration
   */
  get: async (id: number): Promise<SchoolAIConfig> => {
    const response = await api.get(`/api/school/ai-configs/${id}/`);
    return response.data;
  },

  /**
   * Update an existing AI configuration
   */
  update: async (id: number, data: Partial<SchoolAIConfig> & { api_key?: string }): Promise<SchoolAIConfig> => {
    const response = await api.put(`/api/school/ai-configs/${id}/`, data);
    return response.data;
  },

  /**
   * Delete an AI configuration
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/school/ai-configs/${id}/`);
  },

  // ============= Custom Actions =============

  /**
   * Reset monthly token usage for a specific config
   * POST /api/school/ai-configs/{id}/reset-usage/
   */
  resetUsage: async (id: number): Promise<{ tokens_used_this_month: number; detail: string }> => {
    const response = await api.post(`/api/school/ai-configs/${id}/reset-usage/`);
    return response.data;
  },

  /**
   * Test the connection/credentials for a specific config
   * POST /api/school/ai-configs/{id}/test-connection/
   */
  testConnection: async (id: number): Promise<{ detail: string; response?: string }> => {
    const response = await api.post(`/api/school/ai-configs/${id}/test-connection/`);
    return response.data;
  },
};

export const schoolSettingsAPI = {
  /**
   * Get school settings
   * Returns null if doesn't exist (404) - THIS IS NOT AN ERROR!
   * Only throws on actual errors (network, 500, etc.)
   */
  get: async (): Promise<SchoolSettings | null> => {
    try {
      const response = await api.get('/api/school/settings/');
      return response.data.data!;
    } catch (error: any) {
      // If 404, school settings don't exist yet - return null (valid state)
      if (error.response?.status === 404) {
        return null;
      }
      // Re-throw actual errors
      throw error;
    }
  },

  /**
   * Create new school settings (for first-time setup)
   */
  create: async (data: Partial<SchoolSettings>): Promise<SchoolSettings> => {
    const response = await api.post('/api/school/settings/', data);
    return response.data.data!;
  },

  /**
   * Update existing school settings
   */
  update: async (data: Partial<SchoolSettings>): Promise<SchoolSettings> => {
    const response = await api.put('/api/school/settings/', data);
    return response.data.data!;
  },
};


// Classes API
export const classesAPI = {
  list: async (params?: { school_section?: number }): Promise<ClassModel[]> => {
    try {
      const response = await api.get<ApiResponse<ClassModel[]>>('/api/classes/', { params });
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch classes');
    }
  },

  create: async (data: Partial<ClassModel>): Promise<ClassModel> => {
    try {
      const response = await api.post<ApiResponse<ClassModel>>('/api/classes/', data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create class');
    }
  },

  update: async (id: number, data: Partial<ClassModel>): Promise<ClassModel> => {
    try {
      const response = await api.put<ApiResponse<ClassModel>>(`/api/classes/${id}/`, data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update class');
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/classes/${id}/`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete class');
    }
  },
};

// Class Sections API
export const classSectionsAPI = {
  list: async (params?: { school_section?: number }): Promise<ClassSection[]> => {
    try {
      const response = await api.get<ApiResponse<ClassSection[]>>('/api/class-sections/', { params });
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch class sections');
    }
  },

  create: async (data: Partial<ClassSection>): Promise<ClassSection> => {
    try {
      const response = await api.post<ApiResponse<ClassSection>>('/api/class-sections/', data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create class section');
    }
  },

  update: async (id: number, data: Partial<ClassSection>): Promise<ClassSection> => {
    try {
      const response = await api.put<ApiResponse<ClassSection>>(`/api/class-sections/${id}/`, data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update class section');
    }
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/class-sections/${id}/`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete class section');
    }
  },
};

// Dashboard API
export const dashboardAPI = {
  getStats: async (): Promise<any> => {
    try {
      const response = await api.get('/api/dashboard/stats/');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch dashboard stats');
    }
  },
};

// ==================== STAFF DASHBOARD API ====================
export const staffDashboardAPI = {
  /**
   * Get dynamic, permission-filtered KPI summary for the staff dashboard
   */
  getSummary: async (): Promise<any> => {
    try {
      // Adjust the URL if you mapped it differently in your Django urls.py
      const response = await api.get('/api/human-resource/dashboard/summary/');

      // Our Django view returns Response({'success': True, 'data': summary})
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch dashboard summary');
    }
  },
};

// ==================== HR SETTINGS API ====================

export const hrSettingsAPI = {
  /**
   * Get HR settings
   * Returns null if doesn't exist (404) - THIS IS NOT AN ERROR!
   */
  get: async (): Promise<HRSettings | null> => {
    try {
      const response = await api.get<ApiResponse<HRSettings>>('/api/human-resource/settings/');
      return response.data.data!;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Create new HR settings (for first-time setup)
   */
  create: async (data: Partial<HRSettings>): Promise<HRSettings> => {
    const response = await api.post<ApiResponse<HRSettings>>('/api/human-resource/settings/', data);
    return response.data.data!;
  },

  /**
   * Update existing HR settings
   */
  update: async (data: Partial<HRSettings>): Promise<HRSettings> => {
    const response = await api.put<ApiResponse<HRSettings>>('/api/human-resource/settings/', data);
    return response.data.data!;
  },
};

// ==================== DEPARTMENTS API ====================

export const departmentsAPI = {
  /**
   * List all departments
   */
  list: async (): Promise<Department[]> => {
    const response = await api.get<ApiResponse<Department[]>>('/api/human-resource/departments/');
    return response.data.data || [];
  },

  /**
   * Create a new department
   */
  create: async (data: Partial<Department>): Promise<Department> => {
    const response = await api.post<ApiResponse<Department>>('/api/human-resource/departments/', data);
    return response.data.data!;
  },

  /**
   * Get department details
   */
  get: async (id: number): Promise<Department> => {
    const response = await api.get<ApiResponse<Department>>(`/api/human-resource/departments/${id}/`);
    return response.data.data!;
  },

  /**
   * Update department
   */
  update: async (id: number, data: Partial<Department>): Promise<Department> => {
    const response = await api.put<ApiResponse<Department>>(`/api/human-resource/departments/${id}/`, data);
    return response.data.data!;
  },

  /**
   * Delete department
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/human-resource/departments/${id}/`);
  },
};

// ==================== POSITIONS API ====================

export const positionsAPI = {
  /**
   * List all positions
   */
  list: async (): Promise<Position[]> => {
    const response = await api.get<ApiResponse<Position[]>>('/api/human-resource/positions/');
    return response.data.data || [];
  },

  /**
   * Create a new position
   */
  create: async (data: Partial<Position>): Promise<Position> => {
    const response = await api.post<ApiResponse<Position>>('/api/human-resource/positions/', data);
    return response.data.data!;
  },

  /**
   * Get position details
   */
  get: async (id: number): Promise<Position> => {
    const response = await api.get<ApiResponse<Position>>(`/api/human-resource/positions/${id}/`);
    return response.data.data!;
  },

  /**
   * Update position
   */
  update: async (id: number, data: Partial<Position>): Promise<Position> => {
    const response = await api.put<ApiResponse<Position>>(`/api/human-resource/positions/${id}/`, data);
    return response.data.data!;
  },

  /**
   * Delete position
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/human-resource/positions/${id}/`);
  },
};

// ==================== STAFF API ====================

// In your api.ts file, replace the entire staffAPI object with this:

export const staffAPI = {
  /**
   * List staff with filtering and pagination
   */
  list: async (filters?: StaffListFilters): Promise<Staff[]> => {
    const response = await api.get<any>('/api/human-resource/staff/', { params: filters });

    // Handle the actual response structure
    if (response.data?.results?.data) {
        console.log(response.data?.results?.data)
      return response.data.results.data;
    }

    // Return empty array if no data
    return [];
  },

  /**
 * Create a new staff member
 */
create: async (data: StaffFormValues | globalThis.FormData): Promise<Staff> => {
  const isFormData = data instanceof FormData;
  const response = await api.post<ApiResponse<Staff>>(
    '/api/human-resource/staff/create/',
    data,
    isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  );
  return response.data.data!;
},

/**
 * Get staff details
 */
get: async (id: number): Promise<Staff> => {
  const response = await api.get<ApiResponse<Staff>>(`/api/human-resource/staff/${id}/`);
  return response.data.data!;
},

/**
 * Update staff
 */
update: async (id: number, data: Partial<StaffFormValues> | globalThis.FormData): Promise<Staff> => {
  const isFormData = data instanceof FormData;
  const response = await api.put<ApiResponse<Staff>>(
    `/api/human-resource/staff/${id}/`,
    data,
    isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  );
  return response.data.data!;
},

  /**
   * Delete staff
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/human-resource/staff/${id}/`);
  },

  /**
   * Check for duplicate staff
   */
  checkDuplicate: async (data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    email?: string;
    mobile?: string;
  }): Promise<DuplicateCheckResult> => {
    const response = await api.post<ApiResponse<DuplicateCheckResult>>('/api/human-resource/utils/check-duplicate/', data);
    return response.data.data!;
  },
};

// ==================== CUSTOM FIELDS API ====================

export const customFieldsAPI = {
  /**
   * List all custom staff fields
   */
  list: async (): Promise<CustomStaffField[]> => {
  const response = await api.get<ApiResponse<CustomStaffField[]>>('/api/human-resource/custom-fields/');
  //                                                                ^^^^^ remove /utils/
  return response.data.data || [];
},

  /**
   * Create a new custom field
   */
  create: async (data: CustomFieldFormValues): Promise<CustomStaffField> => {
    const response = await api.post<ApiResponse<CustomStaffField>>('/api/human-resource/custom-fields/', data);
    return response.data.data!;
  },

  /**
   * Get custom field details
   */
  get: async (id: number): Promise<CustomStaffField> => {
    const response = await api.get<ApiResponse<CustomStaffField>>(`/api/human-resource/custom-fields/${id}/`);
    return response.data.data!;
  },

  /**
   * Update custom field
   */
  update: async (id: number, data: Partial<CustomFieldFormValues>): Promise<CustomStaffField> => {
    const response = await api.put<ApiResponse<CustomStaffField>>(`/api/human-resource/custom-fields/${id}/`, data);
    return response.data.data!;
  },

  /**
   * Delete custom field
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/human-resource/custom-fields/${id}/`);
  },

  /**
   * Get custom fields formatted for forms
   */
  getForForm: async (): Promise<CustomFieldForForm[]> => {
    const response = await api.get<ApiResponse<CustomFieldForForm[]>>('/api/human-resource/utils/custom-fields/');
    return response.data.data || [];
  },
};

// ==================== DOCUMENTS API ====================

export const documentsAPI = {
  /**
   * List documents for a staff member
   */
  list: async (staffId: number): Promise<StaffDocument[]> => {
    const response = await api.get<ApiResponse<StaffDocument[]>>(`/api/human-resource/staff/${staffId}/documents/`);
    return response.data.data || [];
  },

  /**
   * Upload a document for a staff member
   */
  upload: async (staffId: number, data: FormData): Promise<StaffDocument> => {
    const response = await api.post<ApiResponse<StaffDocument>>(
      `/api/human-resource/staff/${staffId}/documents/`,
      data,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data!;
  },

  /**
   * Get document details
   */
  get: async (id: number): Promise<StaffDocument> => {
    const response = await api.get<ApiResponse<StaffDocument>>(`/api/human-resource/documents/${id}/`);
    return response.data.data!;
  },

  /**
   * Update document metadata
   */
  update: async (staffId: number, id: number, data: object | FormData): Promise<StaffDocument> => {
      const isFormData = data instanceof FormData;
      const response = await api.patch<ApiResponse<StaffDocument>>(
        `/api/human-resource/documents/${id}/`,
        data,
        isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
      );
      return response.data.data!;
    },

  /**
   * Delete document
   */
  delete: async (staffId: number, id: number): Promise<void> => {
    await api.delete(`/api/human-resource/documents/${id}/`);
  },
};

// ==================== LEAVE API ====================

export const leaveAPI = {
  /**
   * List leave requests
   */
  list: async (filters?: LeaveListFilters): Promise<StaffLeave[]> => {
    const response = await api.get<ApiResponse<StaffLeave[]>>('/api/human-resource/leaves/', { params: filters });
    return response.data.data || [];
  },

  /**
   * List leaves for a specific staff
   */
  listForStaff: async (staffId: number): Promise<StaffLeave[]> => {
    const response = await api.get<ApiResponse<StaffLeave[]>>(`/api/human-resource/staff/${staffId}/leaves/`);
    return response.data.data || [];
  },

  /**
   * Create a new leave request
   */
  create: async (data: LeaveFormValues): Promise<StaffLeave> => {
    const response = await api.post<ApiResponse<StaffLeave>>('/api/human-resource/leaves/', data);
    return response.data.data!;
  },

    createForStaff: async (staffId: number, data: object): Promise<StaffLeave> => {
  const response = await api.post<ApiResponse<StaffLeave>>(`/api/human-resource/staff/${staffId}/leaves/`, data);
  return response.data.data!;
},

  /**
   * Get leave request details
   */
  get: async (id: number): Promise<StaffLeave> => {
    const response = await api.get<ApiResponse<StaffLeave>>(`/api/human-resource/leaves/${id}/`);
    return response.data.data!;
  },

  /**
   * Update leave request
   */
  update: async (id: number, data: Partial<LeaveFormValues>): Promise<StaffLeave> => {
    const response = await api.put<ApiResponse<StaffLeave>>(`/api/human-resource/leaves/${id}/`, data);
    return response.data.data!;
  },

    changeStatus: async (id: number, data: { status: string; actual_end_date?: string }): Promise<StaffLeave> => {
  const response = await api.post<ApiResponse<StaffLeave>>(`/api/human-resource/leaves/${id}/status/`, data);
  return response.data.data!;
},

  /**
   * Delete leave request
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/human-resource/leaves/${id}/`);
  },

  /**
   * Approve leave request
   */
  approve: async (id: number): Promise<StaffLeave> => {
    const response = await api.post<ApiResponse<StaffLeave>>(`/api/human-resource/leaves/${id}/approve/`);
    return response.data.data!;
  },

  /**
   * Decline leave request
   */
  decline: async (id: number, declineReason: string): Promise<StaffLeave> => {
    const response = await api.post<ApiResponse<StaffLeave>>(`/api/human-resource/leaves/${id}/decline/`, {
      decline_reason: declineReason,
    });
    return response.data.data!;
  },
};

export const academicCalendarAPI = {
  // --- Days (Read-only) ---
  listDays: async (): Promise<Day[]> => {
    try {
      const response = await api.get<ApiResponse<Day[]>>('/api/school/days/');
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch days');
    }
  },

  // --- Sessions (CRUD) ---
  listSessions: async (): Promise<Session[]> => {
    try {
      const response = await api.get<ApiResponse<Session[]>>('/api/school/sessions/');
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch sessions');
    }
  },

  createSession: async (data: Partial<Session>): Promise<Session> => {
  try {
    const response = await api.post<ApiResponse<Session>>('/api/school/sessions/', data);
    return response.data.data!;
  } catch (error: any) {
    throw error;  // ← rethrow original, don't wrap it
  }
},

updateSession: async (id: number, data: Partial<Session>): Promise<Session> => {
  try {
    const response = await api.put<ApiResponse<Session>>(`/api/school/sessions/${id}/`, data);
    return response.data.data!;
  } catch (error: any) {
    throw error;  // ← rethrow original
  }
},

  getSession: async (id: number): Promise<Session> => {
    try {
      const response = await api.get<ApiResponse<Session>>(`/api/school/sessions/${id}/`);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch session');
    }
  },

  deleteSession: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/school/sessions/${id}/`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete session');
    }
  },

  // --- School Sections (CRUD) ---
  listSchoolSections: async (): Promise<SchoolSection[]> => {
    try {
      const response = await api.get<ApiResponse<SchoolSection[]>>('/api/school/sections/');
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch school sections');
    }
  },

  createSchoolSection: async (data: Partial<SchoolSection>): Promise<SchoolSection> => {
    try {
      const response = await api.post<ApiResponse<SchoolSection>>('/api/school/sections/', data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create school section');
    }
  },

  getSchoolSection: async (id: number): Promise<SchoolSection> => {
    try {
      const response = await api.get<ApiResponse<SchoolSection>>(`/api/school/sections/${id}/`);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch school section');
    }
  },

  updateSchoolSection: async (id: number, data: Partial<SchoolSection>): Promise<SchoolSection> => {
    try {
      const response = await api.put<ApiResponse<SchoolSection>>(`/api/school/sections/${id}/`, data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update school section');
    }
  },

  deleteSchoolSection: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/school/sections/${id}/`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete school section');
    }
  },

  // --- Academic Period Types (CRUD) ---
  listPeriodTypes: async (): Promise<AcademicPeriodType[]> => {
    try {
      const response = await api.get<ApiResponse<AcademicPeriodType[]>>('/api/school/period-types/');
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch period types');
    }
  },

  createPeriodType: async (data: Partial<AcademicPeriodType>): Promise<AcademicPeriodType> => {
    try {
      const response = await api.post<ApiResponse<AcademicPeriodType>>('/api/school/period-types/', data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to create period type');
    }
  },

  getPeriodType: async (id: number): Promise<AcademicPeriodType> => {
    try {
      const response = await api.get<ApiResponse<AcademicPeriodType>>(`/api/school/period-types/${id}/`);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch period type');
    }
  },

  updatePeriodType: async (id: number, data: Partial<AcademicPeriodType>): Promise<AcademicPeriodType> => {
    try {
      const response = await api.put<ApiResponse<AcademicPeriodType>>(`/api/school/period-types/${id}/`, data);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to update period type');
    }
  },

  deletePeriodType: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/school/period-types/${id}/`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete period type');
    }
  },

  // --- Academic Period Blueprints (CRUD) ---
  listPeriods: async (params?: { period_type_id?: number; is_active?: boolean }): Promise<AcademicPeriod[]> => {
    try {
      const response = await api.get<ApiResponse<AcademicPeriod[]>>('/api/school/periods/', { params });
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch periods');
    }
  },

  getPeriod: async (id: number): Promise<AcademicPeriod> => {
    try {
      const response = await api.get<ApiResponse<AcademicPeriod>>(`/api/school/periods/${id}/`);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch period');
    }
  },

  // --- Academic Session Periods (CRUD) ---
  listSessionPeriods: async (params?: {
    session_id?: number;
    period_id?: number;
    school_section_id?: number;
  }): Promise<AcademicSessionPeriod[]> => {
    try {
      const response = await api.get<ApiResponse<AcademicSessionPeriod[]>>('/api/school/session-periods/', { params });
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch session periods');
    }
  },

  createSessionPeriod: async (data: Partial<AcademicSessionPeriod>): Promise<AcademicSessionPeriod> => {
  try {
    const response = await api.post<ApiResponse<AcademicSessionPeriod>>('/api/school/session-periods/', data);
    return response.data.data!;
  } catch (error: any) {
    throw error;  // ← rethrow original, don't wrap
  }
},

updateSessionPeriod: async (id: number, data: Partial<AcademicSessionPeriod>): Promise<AcademicSessionPeriod> => {
  try {
    const response = await api.put<ApiResponse<AcademicSessionPeriod>>(`/api/school/session-periods/${id}/`, data);
    return response.data.data!;
  } catch (error: any) {
    throw error;
  }
},

  getSessionPeriod: async (id: number): Promise<AcademicSessionPeriod> => {
    try {
      const response = await api.get<ApiResponse<AcademicSessionPeriod>>(`/api/school/session-periods/${id}/`);
      return response.data.data!;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to fetch session period');
    }
  },

  deleteSessionPeriod: async (id: number): Promise<void> => {
    try {
      await api.delete(`/api/school/session-periods/${id}/`);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to delete session period');
    }
  },

  // --- Current State Endpoints ---
  getCurrentSession: async (): Promise<Session> => {
    try {
      const response = await api.get<ApiResponse<Session>>('/api/school/sessions/current/');
      return response.data.data!;
    } catch (error: any) {
      // The new backend view returns a 'message' key for errors.
      throw new Error(error.response?.data?.message || 'Failed to fetch current session');
    }
  },

  getCurrentPeriod: async (schoolSectionId: number): Promise<AcademicSessionPeriod> => {
    if (!schoolSectionId) {
      throw new Error('A schoolSectionId must be provided to get the current period.');
    }
    try {
      const response = await api.get<ApiResponse<AcademicSessionPeriod>>('/api/school/session-periods/current/', {
        params: { school_section_id: schoolSectionId },
      });
      return response.data.data!;
    } catch (error: any) {
      // The new backend view returns a 'message' key for errors.
      throw new Error(error.response?.data?.message || 'Failed to fetch current period');
    }
  },
};

// ==================== BULK OPERATIONS API ====================
export const bulkOperationsAPI = {
  /**
   * Upload bulk staff file
   */
  upload: async (file: File): Promise<BulkStaffUpload> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ApiResponse<BulkStaffUpload>>(
      '/api/human-resource/bulk/upload/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data.data!;
  },

  /**
   * Get upload status
   */
  getUploadStatus: async (uploadId: number): Promise<BulkStaffUpload> => {
    const response = await api.get<ApiResponse<BulkStaffUpload>>(`/api/human-resource/bulk/upload/${uploadId}/status/`);
    return response.data.data!;
  },

  /**
   * Generate bulk credentials download
   */
  generateCredentialsDownload: async (data: BulkDownloadRequest): Promise<{ task_id: string }> => {
    const response = await api.post<ApiResponse<{ task_id: string }>>('/api/human-resource/bulk/download-credentials/', data);
    return response.data.data!;
  },
};

// ==================== GROUPS & PERMISSIONS API ====================

export const groupsAPI = {
  /**
   * List all groups
   */
  list: async (): Promise<Group[]> => {
    const response = await api.get<ApiResponse<Group[]>>('/api/human-resource/groups/');
    return response.data.data || [];
  },

  /**
   * Create a new group
   */
  create: async (data: GroupFormValues): Promise<Group> => {
    const response = await api.post<ApiResponse<Group>>('/api/human-resource/groups/', data);
    return response.data.data!;
  },

  /**
   * Get group details
   */
  get: async (id: number): Promise<Group> => {
    const response = await api.get<ApiResponse<Group>>(`/api/human-resource/groups/${id}/`);
    return response.data.data!;
  },

  /**
   * Update group
   */
  update: async (id: number, data: Partial<GroupFormValues>): Promise<Group> => {
    const response = await api.put<ApiResponse<Group>>(`/api/human-resource/groups/${id}/`, data);
    return response.data.data!;
  },
    assignPermissions: async (id: number, data: { permissions: string[] }): Promise<void> => {
  await api.post(`/api/human-resource/groups/${id}/permissions/`, data);
},

getGroupPermissions: async (id: number): Promise<Permission[]> => {
  const response = await api.get<ApiResponse<Permission[]>>(`/api/human-resource/groups/${id}/permissions/`);
  return response.data.data || [];
},

  /**
   * Delete group
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/human-resource/groups/${id}/`);
  },
};

export const permissionsAPI = {
  /**
   * List all available permissions
   */
  list: async (): Promise<Permission[]> => {
    const response = await api.get<ApiResponse<Permission[]>>('/api/human-resource/permissions/');
    return response.data.data || [];
  },

  /**
   * Get group permissions
   */

  getGroupPermissions: async (groupId: number): Promise<string[]> => {
    const response = await api.get<ApiResponse<{ permissions: string[] }>>(`/api/human-resource/groups/${groupId}/permissions/`);
    return response.data.data?.permissions || [];
  },

  /**
   * Update group permissions
   */
  updateGroupPermissions: async (groupId: number, permissions: string[]): Promise<void> => {
    await api.post(`/api/human-resource/groups/${groupId}/permissions/`, {
      permissions: permissions,
    });
  },
};

// ==================== UTILITY API ====================

export const utilityAPI = {
  /**
   * Get list of states
   */
  getStates: async (): Promise<string[]> => {
    const response = await api.get<ApiResponse<string[]>>('/api/human-resource/utils/states/');
    return response.data.data || [];
  },

  /**
   * Get LGAs for a state
   */
  getLGAs: async (state: string): Promise<string[]> => {
    const response = await api.get<ApiResponse<string[]>>('/api/human-resource/utils/lgas/', {
      params: { state },
    });
    return response.data.data || [];
  },

  /**
   * Get list of Nigerian banks
   */
  getBanks: async (): Promise<Bank[]> => {
    const response = await api.get<ApiResponse<Bank[]>>('/api/human-resource/utils/banks/');
    return response.data.data || [];
  },
};

// ==================== SECURITY API ====================

export const securityAPI = {
  /**
   * Reset staff password
   */
  resetPassword: async (staffId: number): Promise<void> => {
    await api.post(`/api/human-resource/staff/${staffId}/reset-password/`);
  },

  /**
   * Restore staff password to default
   */
  restorePassword: async (staffId: number): Promise<void> => {
    await api.post(`/api/human-resource/staff/${staffId}/restore-password/`);
  },

  /**
   * Send password reset link
   */
  sendResetLink: async (staffId: number): Promise<void> => {
    await api.post(`/api/human-resource/staff/${staffId}/send-reset-link/`);
  },
};


// ==================== ACADEMIC MANAGEMENT API ====================

export const academicAPI = {
  // --- Academic Settings ---
  getSettings: async (): Promise<AcademicSettings | null> => {
    try {
      const response = await api.get<ApiResponse<AcademicSettings>>('/api/academic/settings/');
      return response.data.data!;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  updateSettings: async (data: Partial<AcademicSettings>): Promise<AcademicSettings> => {
    const response = await api.put<ApiResponse<AcademicSettings>>('/api/academic/settings/', data);
    return response.data.data!;
  },

  // --- Class Sections ---
  listClassSections: async (params?: { school_section_id?: number }): Promise<ClassSection[]> => {
    const response = await api.get<ApiResponse<ClassSection[]>>('/api/academic/class-sections/', { params });
    return response.data.data || [];
  },

  createClassSection: async (data: Partial<ClassSection>): Promise<ClassSection> => {
    const response = await api.post<ApiResponse<ClassSection>>('/api/academic/class-sections/', data);
    return response.data.data!;
  },

  getClassSection: async (id: number): Promise<ClassSection> => {
    const response = await api.get<ApiResponse<ClassSection>>(`/api/academic/class-sections/${id}/`);
    return response.data.data!;
  },

  updateClassSection: async (id: number, data: Partial<ClassSection>): Promise<ClassSection> => {
    const response = await api.put<ApiResponse<ClassSection>>(`/api/academic/class-sections/${id}/`, data);
    return response.data.data!;
  },

  deleteClassSection: async (id: number): Promise<void> => {
    await api.delete(`/api/academic/class-sections/${id}/`);
  },

  // --- Classes ---
  listClasses: async (params?: { school_section_id?: number; is_active?: boolean }): Promise<ClassModel[]> => {
    const response = await api.get<ApiResponse<ClassModel[]>>('/api/academic/classes/', { params });
    return response.data.data || [];
  },

  createClass: async (data: ClassFormValues): Promise<ClassModel> => {
    const response = await api.post<ApiResponse<ClassModel>>('/api/academic/classes/', data);
    return response.data.data!;
  },

  getClass: async (id: number): Promise<ClassModel> => {
    const response = await api.get<ApiResponse<ClassModel>>(`/api/academic/classes/${id}/`);
    return response.data.data!;
  },

  updateClass: async (id: number, data: Partial<ClassFormValues>): Promise<ClassModel> => {
    const response = await api.put<ApiResponse<ClassModel>>(`/api/academic/classes/${id}/`, data);
    return response.data.data!;
  },

  deleteClass: async (id: number): Promise<void> => {
    await api.delete(`/api/academic/classes/${id}/`);
  },

  // --- Class Configurations ---
  listClassConfigurations: async (params?: { student_class_id?: number; is_active?: boolean }): Promise<ClassConfiguration[]> => {
    const response = await api.get<ApiResponse<ClassConfiguration[]>>('/api/academic/class-configurations/', { params });
    return response.data.data || [];
  },

  getClassConfiguration: async (id: number): Promise<ClassConfiguration> => {
    const response = await api.get<ApiResponse<ClassConfiguration>>(`/api/academic/class-configurations/${id}/`);
    return response.data.data!;
  },

  updateClassConfiguration: async (id: number, data: Partial<ClassConfiguration>): Promise<ClassConfiguration> => {
    const response = await api.put<ApiResponse<ClassConfiguration>>(`/api/academic/class-configurations/${id}/`, data);
    return response.data.data!;
  },

  deleteClassConfiguration: async (id: number): Promise<void> => {
    await api.delete(`/api/academic/class-configurations/${id}/`);
  },

  // --- Subjects ---
  listSubjects: async (params?: { school_section_id?: number; is_active?: boolean }): Promise<Subject[]> => {
    const response = await api.get<ApiResponse<Subject[]>>('/api/academic/subjects/', { params });
    return response.data.data || [];
  },

  createSubject: async (data: SubjectFormValues): Promise<Subject> => {
    const response = await api.post<ApiResponse<Subject>>('/api/academic/subjects/', data);
    return response.data.data!;
  },

  getSubject: async (id: number): Promise<Subject> => {
    const response = await api.get<ApiResponse<Subject>>(`/api/academic/subjects/${id}/`);
    return response.data.data!;
  },

  updateSubject: async (id: number, data: Partial<SubjectFormValues>): Promise<Subject> => {
    const response = await api.put<ApiResponse<Subject>>(`/api/academic/subjects/${id}/`, data);
    return response.data.data!;
  },

  deleteSubject: async (id: number): Promise<void> => {
    await api.delete(`/api/academic/subjects/${id}/`);
  },

  // --- Subject Groups ---
  listSubjectGroups: async (params?: { school_section_id?: number; is_active?: boolean }): Promise<SubjectGroup[]> => {
    const response = await api.get<ApiResponse<SubjectGroup[]>>('/api/academic/subject-groups/', { params });
    return response.data.data || [];
  },

  createSubjectGroup: async (data: SubjectGroupFormValues): Promise<SubjectGroup> => {
    const response = await api.post<ApiResponse<SubjectGroup>>('/api/academic/subject-groups/', data);
    return response.data.data!;
  },

  getSubjectGroup: async (id: number): Promise<SubjectGroup> => {
    const response = await api.get<ApiResponse<SubjectGroup>>(`/api/academic/subject-groups/${id}/`);
    return response.data.data!;
  },

  updateSubjectGroup: async (id: number, data: Partial<SubjectGroupFormValues>): Promise<SubjectGroup> => {
    const response = await api.put<ApiResponse<SubjectGroup>>(`/api/academic/subject-groups/${id}/`, data);
    return response.data.data!;
  },

  deleteSubjectGroup: async (id: number): Promise<void> => {
    await api.delete(`/api/academic/subject-groups/${id}/`);
  },

  // --- Class Subject Configurations ---
  listClassSubjectConfigurations: async (params?: { class_configuration_id?: number }): Promise<ClassSubjectConfiguration[]> => {
    const response = await api.get<ApiResponse<ClassSubjectConfiguration[]>>('/api/academic/class-subject-configurations/', { params });
    return response.data.data || [];
  },

  bulkCreateSubjectConfigurations: async (data: { class_configuration_id: number; subject_ids: number[] }): Promise<{ created_count: number; subject_ids: number[] }> => {
    const response = await api.post<ApiResponse<{ created_count: number; subject_ids: number[] }>>('/api/academic/class-subject-configurations/', data);
    return response.data.data!;
  },

  updateClassSubjectConfiguration: async (id: number, data: { teachers: number[] }): Promise<ClassSubjectConfiguration> => {
    const response = await api.put<ApiResponse<ClassSubjectConfiguration>>(`/api/academic/class-subject-configurations/${id}/`, data);
    return response.data.data!;
  },

  deleteClassSubjectConfiguration: async (id: number): Promise<void> => {
    await api.delete(`/api/academic/class-subject-configurations/${id}/`);
  },

  // --- Promotion Mappings ---
  getPromotionMappings: async (): Promise<{ mappings: PromotionMapping[]; suggestions: any[] }> => {
    const response = await api.get<ApiResponse<{ mappings: PromotionMapping[]; suggestions: any[] }>>('/api/academic/promotion-mappings/');
    return response.data.data!;
  },

  bulkSavePromotionMappings: async (data: BulkPromotionMappingFormValues): Promise<{ created_count: number; mappings: PromotionMapping[] }> => {
    const response = await api.post<ApiResponse<{ created_count: number; mappings: PromotionMapping[] }>>('/api/academic/promotion-mappings/', data);
    return response.data.data!;
  },

  deletePromotionMapping: async (id: number): Promise<void> => {
    await api.delete(`/api/academic/promotion-mappings/${id}/`);
  },

  // --- Student Class History (Read-only) ---
  listStudentClassHistory: async (studentId?: number): Promise<StudentClassHistory[]> => {
    const url = studentId
      ? `/api/academic/student-class-history/${studentId}/`
      : '/api/academic/student-class-history/';
    const response = await api.get<ApiResponse<StudentClassHistory[]>>(url);
    return response.data.data || [];
  },

    // Add to academicAPI object

// --- Timetable ---
listTimetable: async (params?: { class_configuration_id?: number; day_id?: number }): Promise<Timetable[]> => {
  const response = await api.get<ApiResponse<Timetable[]>>('/api/academic/timetable/', { params });
  return response.data.data || [];
},

getTimetableEntry: async (id: number): Promise<Timetable> => {
  const response = await api.get<ApiResponse<Timetable>>(`/api/academic/timetable/${id}/`);
  return response.data.data!;
},

createTimetableEntry: async (data: TimetableFormValues): Promise<Timetable> => {
  const response = await api.post<ApiResponse<Timetable>>('/api/academic/timetable/', data);
  return response.data.data!;
},

updateTimetableEntry: async (id: number, data: Partial<TimetableFormValues>): Promise<Timetable> => {
  const response = await api.put<ApiResponse<Timetable>>(`/api/academic/timetable/${id}/`, data);
  return response.data.data!;
},

deleteTimetableEntry: async (id: number): Promise<void> => {
  await api.delete(`/api/academic/timetable/${id}/`);
},

// --- Leadership Roles ---
listLeadershipRoles: async (params?: { role_type?: string; school_section_id?: number; is_current?: boolean }): Promise<LeadershipRole[]> => {
  const response = await api.get<ApiResponse<LeadershipRole[]>>('/api/academic/leadership-roles/', { params });
  return response.data.data || [];
},

getLeadershipRole: async (id: number): Promise<LeadershipRole> => {
  const response = await api.get<ApiResponse<LeadershipRole>>(`/api/academic/leadership-roles/${id}/`);
  return response.data.data!;
},

createLeadershipRole: async (data: LeadershipRoleFormValues): Promise<LeadershipRole> => {
  const response = await api.post<ApiResponse<LeadershipRole>>('/api/academic/leadership-roles/', data);
  return response.data.data!;
},

updateLeadershipRole: async (id: number, data: Partial<LeadershipRoleFormValues>): Promise<LeadershipRole> => {
  const response = await api.put<ApiResponse<LeadershipRole>>(`/api/academic/leadership-roles/${id}/`, data);
  return response.data.data!;
},

deleteLeadershipRole: async (id: number): Promise<void> => {
  await api.delete(`/api/academic/leadership-roles/${id}/`);
},
};


// ==================== STUDENT MANAGEMENT API ====================

export const studentSettingsAPI = {
  get: async (): Promise<StudentSettings | null> => {
    try {
      const response = await api.get<ApiResponse<StudentSettings>>('/api/student/settings/');
      return response.data.data!;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  create: async (data: Partial<StudentSettings>): Promise<StudentSettings> => {
    const response = await api.post<ApiResponse<StudentSettings>>('/api/student/settings/', data);
    return response.data.data!;
  },

  update: async (data: Partial<StudentSettings>): Promise<StudentSettings> => {
    const response = await api.put<ApiResponse<StudentSettings>>('/api/student/settings/', data);
    return response.data.data!;
  },
};

export const utilitiesAPI = {
  list: async (): Promise<Utility[]> => {
    const response = await api.get<ApiResponse<Utility[]>>('/api/student/utilities/');
    return response.data.data || [];
  },

  create: async (data: Partial<Utility>): Promise<Utility> => {
    const response = await api.post<ApiResponse<Utility>>('/api/student/utilities/', data);
    return response.data.data!;
  },

  get: async (id: number): Promise<Utility> => {
    const response = await api.get<ApiResponse<Utility>>(`/api/student/utilities/${id}/`);
    return response.data.data!;
  },

  update: async (id: number, data: Partial<Utility>): Promise<Utility> => {
    const response = await api.put<ApiResponse<Utility>>(`/api/student/utilities/${id}/`, data);
    return response.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/student/utilities/${id}/`);
  },
};

export const studentCustomFieldsAPI = {
  list: async (field_for?: 'student' | 'parent'): Promise<CustomField[]> => {
    const response = await api.get<ApiResponse<CustomField[]>>('/api/student/custom-fields/', {
      params: field_for ? { field_for } : {}
    });
    return response.data.data || [];
  },

  create: async (data: Partial<CustomField>): Promise<CustomField> => {
    const response = await api.post<ApiResponse<CustomField>>('/api/student/custom-fields/', data);
    return response.data.data!;
  },

  get: async (id: number): Promise<CustomField> => {
    const response = await api.get<ApiResponse<CustomField>>(`/api/student/custom-fields/${id}/`);
    return response.data.data!;
  },

  update: async (id: number, data: Partial<CustomField>): Promise<CustomField> => {
    const response = await api.put<ApiResponse<CustomField>>(`/api/student/custom-fields/${id}/`, data);
    return response.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/student/custom-fields/${id}/`);
  },

  getForForm: async (field_for: 'student' | 'parent'): Promise<any[]> => {
    const response = await api.get<ApiResponse<any[]>>('/api/student/utils/custom-fields/', {
      params: { field_for }
    });
    return response.data.data || [];
  },
};

export const parentsAPI = {
  list: async (filters?: ParentListFilters): Promise<PaginatedResponse<ParentListItem>> => {
    const response = await api.get<any>('/api/student/parents/', { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  create: async (data: FormData): Promise<Parent> => {
  const response = await api.post<ApiResponse<Parent>>('/api/student/parents/create/', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.data!;
},

  get: async (id: number): Promise<Parent> => {
    const response = await api.get<ApiResponse<Parent>>(`/api/student/parents/${id}/`);
    return response.data.data!;
  },

  update: async (id: number, data: FormData | Partial<ParentFormValues>): Promise<Parent> => {
  const response = await api.put<ApiResponse<Parent>>(`/api/student/parents/${id}/`, data, {
    headers: {
      'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json',
    },
  });
  return response.data.data!;
},

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/student/parents/${id}/`);
  },

  getWards: async (id: number): Promise<Student[]> => {
    const response = await api.get<ApiResponse<Student[]>>(`/api/student/parents/${id}/wards/`);
    return response.data.data || [];
  },

  checkDuplicate: async (data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    email?: string;
    mobile?: string;
  }): Promise<ParentDuplicateCheckResult> => {
    const response = await api.post<ApiResponse<ParentDuplicateCheckResult>>(
      '/api/student/utils/check-duplicate-parent/',
      data
    );
    return response.data.data!;
  },

    toggleStatus: async (id: number, status: string): Promise<ToggleStatusResponse> => {
    const response = await api.post<ApiResponse<ToggleStatusResponse>>(
        `/api/student/parents/${id}/toggle-status/`, { status }
    );
    return response.data.data!;
},

resetPassword: async (id: number, data: ResetPasswordPayload): Promise<ResetPasswordResponse> => {
    const response = await api.post<ApiResponse<ResetPasswordResponse>>(
        `/api/student/parents/${id}/reset-password/`, data
    );
    return response.data.data!;
},
changeUsername: async (id: number, username: string): Promise<{ username: string }> => {
  const response = await api.post<ApiResponse<{ username: string }>>(
    `/api/student/parents/${id}/change-username/`, { username }
  );
  return response.data.data!;
},

downloadListExcel: async (params?: object): Promise<void> => {
  const response = await api.get('/api/student/parents/download/list-excel/', {
    params, responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', 'guardians.xlsx');
  document.body.appendChild(a);
  a.click();
  a.remove();
},

downloadListPDF: async (params?: object): Promise<void> => {
  const response = await api.get('/api/student/parents/download/list-pdf/', {
    params, responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', 'guardians.pdf');
  document.body.appendChild(a);
  a.click();
  a.remove();
},

downloadPasswordSheet: async (params?: { ward_class?: number; ward_class_section?: number }): Promise<void> => {
    const response = await api.get('/api/student/parents/download/password-sheet/', {
        params,
        responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'parent_password_sheet.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
},

// --- Credential Methods ---
  getCredentials: async (params?: any): Promise<any> => {
    const response = await api.get<ApiResponse<any>>('/api/student/parents/credentials/', { params });
    return response.data;
  },

  downloadCredentialsExcel: async (params?: any): Promise<void> => {
    const response = await api.get('/api/student/parents/credentials/excel/', {
      params,
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'parent_credentials.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  downloadCredentialsPDF: async (params?: any): Promise<void> => {
    const response = await api.get('/api/student/parents/credentials/pdf/', {
      params,
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'parent_credentials.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

};

export const studentsAPI = {
  list: async (filters?: StudentListFilters): Promise<Student[]> => {
    const response = await api.get<any>('/api/student/students/', { params: filters });
    if (response.data?.results?.data) {
      return response.data.results.data;
    }
    return [];
  },

  create: async (data: StudentFormValues | globalThis.FormData): Promise<Student> => {
      const isFormData = data instanceof FormData;
      const response = await api.post<ApiResponse<Student>>(
        '/api/student/students/create/',
        data,
        isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
      );
      return response.data.data!;
    },

  get: async (id: number): Promise<Student> => {
    const response = await api.get<ApiResponse<Student>>(`/api/student/students/${id}/`);
    return response.data.data!;
  },

  update: async (id: number, data: Partial<StudentFormValues> | globalThis.FormData): Promise<Student> => {
    // 1. Check if the data is FormData (contains the image)
    const isFormData = data instanceof FormData;

    const response = await api.put<ApiResponse<Student>>(
      `/api/student/students/${id}/`,
      data,
      // 2. Set the correct headers only if it is FormData
      isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
    );

    return response.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/student/students/${id}/`);
  },

  getUtilities: async (id: number): Promise<Utility[]> => {
    const response = await api.get<ApiResponse<Utility[]>>(`/api/student/students/${id}/utilities/`);
    return response.data.data || [];
  },

    getSiblings: async (id: number): Promise<Student[]> => {
  const response = await api.get<ApiResponse<Student[]>>(`/api/student/students/${id}/siblings/`);
  return response.data.data || [];
},

  updateUtilities: async (id: number, utility_ids: number[]): Promise<Utility[]> => {
    const response = await api.post<ApiResponse<Utility[]>>(
      `/api/student/students/${id}/utilities/`,
      { utility_ids }
    );
    return response.data.data || [];
  },

  checkDuplicate: async (data: {
    first_name: string;
    middle_name?: string;
    last_name: string;
    parent_id?: number;
  }): Promise<StudentDuplicateCheckResult> => {
    const response = await api.post<ApiResponse<StudentDuplicateCheckResult>>(
      '/api/student/utils/check-duplicate-student/',
      data
    );
    return response.data.data!;
  },

    toggleStatus: async (id: number, status: string): Promise<ToggleStatusResponse> => {
    const response = await api.post<ApiResponse<ToggleStatusResponse>>(
        `/api/student/students/${id}/toggle-status/`, { status }
    );
    return response.data.data!;
},

resetPassword: async (id: number, data: ResetPasswordPayload): Promise<ResetPasswordResponse> => {
    const response = await api.post<ApiResponse<ResetPasswordResponse>>(
        `/api/student/students/${id}/reset-password/`, data
    );
    return response.data.data!;
},
getClassHistory: async (studentId: number): Promise<StudentClassHistory[]> => {
    const response = await api.get<ApiResponse<StudentClassHistory[]>>(
      `/api/academic/student-class-history/${studentId}/`
    );
    return response.data.data || [];
  },
changeUsername: async (id: number, username: string): Promise<{ username: string }> => {
    const response = await api.post<ApiResponse<{ username: string }>>(
      `/api/student/students/${id}/change-username/`,
      { username } // Payload matches the backend expectation
    );
    return response.data.data!;
  },

downloadPasswordSheet: async (params: { current_class: number; current_class_section?: number }): Promise<void> => {
    const response = await api.get('/api/student/students/download/password-sheet/', {
        params,
        responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'password_sheet.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
},

downloadListExcel: async (params?: object): Promise<void> => {
  const response = await api.get('/api/student/students/download/list-excel/', {
    params, responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', 'students.xlsx');
  document.body.appendChild(a);
  a.click();
  a.remove();
},

downloadListPDF: async (params?: object): Promise<void> => {
  const response = await api.get('/api/student/students/download/list-pdf/', {
    params, responseType: 'blob'
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', 'students.pdf');
  document.body.appendChild(a);
  a.click();
  a.remove();
},

downloadStudentList: async (params: { current_class: number; current_class_section?: number; status?: string }): Promise<void> => {
    const response = await api.get('/api/student/students/download/student-list/', {
        params,
        responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'student_list.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
},

  // Add inside studentsAPI object
  getCredentials: async (params?: any): Promise<any> => {
    const response = await api.get<ApiResponse<any>>('/api/student/students/credentials/', { params });
    return response.data;
  },

  downloadCredentialsExcel: async (params?: any): Promise<void> => {
    const response = await api.get('/api/student/students/credentials/excel/', {
      params,
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'student_credentials.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  downloadCredentialsPDF: async (params?: any): Promise<void> => {
    const response = await api.get('/api/student/students/credentials/pdf/', {
      params,
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'student_credentials.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

};



// New — guardians, documents, fingerprints APIs
export const otherGuardiansAPI = {
    list: async (studentId: number): Promise<OtherGuardian[]> => {
        const response = await api.get<ApiResponse<OtherGuardian[]>>(
            `/api/student/students/${studentId}/other-guardians/`
        );
        return response.data.data || [];
    },
    create: async (studentId: number, data: Partial<OtherGuardian>): Promise<OtherGuardian> => {
        const response = await api.post<ApiResponse<OtherGuardian>>(
            `/api/student/students/${studentId}/other-guardians/`, data
        );
        return response.data.data!;
    },
    update: async (id: number, data: Partial<OtherGuardian>): Promise<OtherGuardian> => {
        const response = await api.put<ApiResponse<OtherGuardian>>(
            `/api/student/other-guardians/${id}/`, data
        );
        return response.data.data!;
    },
    delete: async (id: number): Promise<void> => {
        await api.delete(`/api/student/other-guardians/${id}/`);
    },
};

export const studentDocumentsAPI = {
    list: async (studentId: number, document_type?: string): Promise<StudentDocument[]> => {
        const response = await api.get<ApiResponse<StudentDocument[]>>(
            `/api/student/students/${studentId}/documents/`,
            { params: document_type ? { document_type } : {} }
        );
        return response.data.data || [];
    },
    upload: async (studentId: number, data: FormData): Promise<StudentDocument> => {
        const response = await api.post<ApiResponse<StudentDocument>>(
            `/api/student/students/${studentId}/documents/`, data,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data.data!;
    },
    get: async (id: number): Promise<StudentDocument> => {
        const response = await api.get<ApiResponse<StudentDocument>>(
            `/api/student/documents/${id}/`
        );
        return response.data.data!;
    },
    delete: async (id: number): Promise<void> => {
        await api.delete(`/api/student/documents/${id}/`);
    },
};

export const fingerprintsAPI = {
    list: async (studentId: number): Promise<Fingerprint[]> => {
        const response = await api.get<ApiResponse<Fingerprint[]>>(
            `/api/student/students/${studentId}/fingerprints/`
        );
        return response.data.data || [];
    },
    add: async (studentId: number, data: Partial<Fingerprint>): Promise<Fingerprint> => {
        const response = await api.post<ApiResponse<Fingerprint>>(
            `/api/student/students/${studentId}/fingerprints/`, data
        );
        return response.data.data!;
    },
    delete: async (id: number): Promise<void> => {
        await api.delete(`/api/student/fingerprints/${id}/`);
    },
};

export const studentUtilsAPI = {
    getStates: async (): Promise<string[]> => {
        const response = await api.get<ApiResponse<string[]>>('/api/student/utils/states/');
        return response.data.data || [];
    },
    getLgas: async (state: string): Promise<string[]> => {
        const response = await api.get<ApiResponse<string[]>>(
            '/api/student/utils/lgas/', { params: { state } }
        );
        return response.data.data || [];
    },
};

// ==================== FEE MANAGEMENT API ====================

export const feeAPI = {
  // Dashboard
  getDashboard: async (params?: { session_id?: number; period_id?: number }) => {
    const response = await api.get<ApiResponse<any>>('/api/fee/dashboard/', { params });
    return response.data;
  },

  // Student financial dashboard
  getStudentDashboard: async (
    studentId: number,
    params?: { session_id?: number; period_id?: number; invoice_id?: number }
  ): Promise<StudentFinancialDashboard> => {
    const response = await api.get(`/api/fee/students/${studentId}/dashboard/`, { params });
    return response.data;
  },

  // Wallets
  getWalletByStudent: async (studentId: number): Promise<StudentWallet> => {
    const response = await api.get(`/api/fee/wallets/student/${studentId}/`);
    return response.data;
  },

  getWalletTransactions: async (studentId: number): Promise<WalletTransaction[]> => {
    const response = await api.get(`/api/fee/wallets/student/${studentId}/transactions/`);
    return response.data.results || response.data;
  },

  fundWallet: async (data: {
    student: number;
    amount: string;
    wallet_field: WalletField;
    notes?: string;
    reference?: string;
  }): Promise<{ wallet: StudentWallet; funding_record_id: number }> => {
    const response = await api.post('/api/fee/wallets/fund/', data);
    return response.data;
  },

  transferWalletField: async (data: {
    student_id: number;
    amount: string;
    from_field: WalletField;
    to_field: WalletField;
    reason: string;
  }): Promise<StudentWallet> => {
    const response = await api.post('/api/fee/wallets/transfer/field/', data);
    return response.data;
  },

  transferWalletSibling: async (data: {
    from_student_id: number;
    to_student_id: number;
    amount: string;
    from_field: WalletField;
    to_field: WalletField;
    reason: string;
  }): Promise<{ from_wallet: StudentWallet; to_wallet: StudentWallet }> => {
    const response = await api.post('/api/fee/wallets/transfer/sibling/', data);
    return response.data;
  },

  // Payments
  recordPayment: async (data: FormData | object): Promise<FeePayment> => {
    const isFormData = data instanceof FormData;
    const response = await api.post('/api/fee/payments/record/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return response.data;
  },

  confirmPayment: async (id: number): Promise<FeePayment> => {
    const response = await api.post(`/api/fee/payments/${id}/confirm/`);
    return response.data;
  },

  revertPayment: async (id: number, reason: string): Promise<FeePayment> => {
    const response = await api.post(`/api/fee/payments/${id}/revert/`, { reason });
    return response.data;
  },

  getPendingPayments: async (params?: object): Promise<FeePayment[]> => {
    const response = await api.get('/api/fee/payments/pending/', { params });
    return response.data.results || response.data;
  },

  getPaymentHistory: async (params?: object): Promise<FeePayment[]> => {
    const response = await api.get('/api/fee/payments/', { params });
    return response.data.results || response.data;
  },

  // Family payments
  recordFamilyPayment: async (data: object): Promise<FamilyFeePayment> => {
    const response = await api.post('/api/fee/family-payments/record/', data);
    return response.data;
  },

  confirmFamilyPayment: async (id: number): Promise<FamilyFeePayment> => {
    const response = await api.post(`/api/fee/family-payments/${id}/confirm/`);
    return response.data;
  },

  // Invoices
  getInvoices: async (params?: object): Promise<Invoice[]> => {
    const response = await api.get('/api/fee/invoices/', { params });
    return response.data.results || response.data;
  },

  createInvoice: async (data: {
    student: number;
    session: number;
    period: number;
  }): Promise<Invoice> => {
    const response = await api.post('/api/fee/invoices/', data);
    return response.data;
  },

  deleteInvoice: async (id: number): Promise<void> => {
    await api.delete(`/api/fee/invoices/${id}/`);
  },

  generateSingleInvoice: async (data: {
    student_id: number;
    session_id: number;
    period_id: number;
  }): Promise<{ created: boolean; invoice: Invoice | null; family_invoice: FamilyInvoice | null }> => {
    const response = await api.post('/api/fee/invoices/generate-single/', data);
    return response.data;
  },

  // Invoice items
  addInvoiceItem: async (data: {
    invoice_id: number;
    fee_master_id: number;
  }): Promise<InvoiceItem> => {
    const response = await api.post('/api/fee/invoice-items/', data);
    return response.data;
  },

  deleteInvoiceItem: async (id: number): Promise<void> => {
    await api.delete(`/api/fee/invoice-items/${id}/`);
  },

  // Generation jobs
  getGenerationJobs: async (params?: object): Promise<InvoiceGenerationJob[]> => {
    const response = await api.get('/api/fee/generation-jobs/', { params });
    return response.data.results || response.data;
  },

  startGenerationJob: async (data: {
    session_id: number;
    period_id: number;
    class_ids: number[];
  }): Promise<InvoiceGenerationJob> => {
    const response = await api.post('/api/fee/generation-jobs/start/', data);
    return response.data;
  },

  getJobStatus: async (id: string): Promise<InvoiceGenerationJob> => {
    const response = await api.get(`/api/fee/generation-jobs/${id}/job-status/`);
    return response.data;
  },

  // Fee groups
  getFeeGroups: async (): Promise<FeeGroup[]> => {
    const response = await api.get('/api/fee/groups/');
    return response.data.results || response.data;
  },

  createFeeGroup: async (data: Partial<FeeGroup>): Promise<FeeGroup> => {
    const response = await api.post('/api/fee/groups/', data);
    return response.data;
  },

  updateFeeGroup: async (id: number, data: Partial<FeeGroup>): Promise<FeeGroup> => {
    const response = await api.put(`/api/fee/groups/${id}/`, data);
    return response.data;
  },

  deleteFeeGroup: async (id: number): Promise<void> => {
    await api.delete(`/api/fee/groups/${id}/`);
  },

  // Fees (blueprints)
  getFees: async (): Promise<Fee[]> => {
    const response = await api.get('/api/fee/fees/');
    return response.data.results || response.data;
  },

  createFee: async (data: Partial<Fee>): Promise<Fee> => {
    const response = await api.post('/api/fee/fees/', data);
    return response.data;
  },

  updateFee: async (id: number, data: Partial<Fee>): Promise<Fee> => {
    const response = await api.put(`/api/fee/fees/${id}/`, data);
    return response.data;
  },

  deleteFee: async (id: number): Promise<void> => {
    await api.delete(`/api/fee/fees/${id}/`);
  },

  // Fee structures
  getFeeStructures: async (): Promise<FeeStructure[]> => {
    const response = await api.get('/api/fee/structures/');
    return response.data.results || response.data;
  },

  getFeeStructure: async (id: number): Promise<FeeStructure> => {
    const response = await api.get(`/api/fee/structures/${id}/`);
    return response.data;
  },

  createFeeStructure: async (data: Partial<FeeStructure>): Promise<FeeStructure> => {
    const response = await api.post('/api/fee/structures/', data);
    return response.data;
  },

  updateFeeStructure: async (id: number, data: Partial<FeeStructure>): Promise<FeeStructure> => {
    const response = await api.put(`/api/fee/structures/${id}/`, data);
    return response.data;
  },

  deleteFeeStructure: async (id: number): Promise<void> => {
    await api.delete(`/api/fee/structures/${id}/`);
  },

  setPeriodAmounts: async (id: number, amounts: { period: number; amount: string }[]): Promise<PeriodFeeAmount[]> => {
    const response = await api.post(`/api/fee/structures/${id}/set-period-amounts/`, amounts);
    return response.data;
  },

  // Discounts
  getDiscounts: async (): Promise<Discount[]> => {
    const response = await api.get('/api/fee/discounts/');
    return response.data.results || response.data;
  },

  createDiscount: async (data: Partial<Discount>): Promise<Discount> => {
    const response = await api.post('/api/fee/discounts/', data);
    return response.data;
  },

  updateDiscount: async (id: number, data: Partial<Discount>): Promise<Discount> => {
    const response = await api.put(`/api/fee/discounts/${id}/`, data);
    return response.data;
  },

  getDiscountApplications: async (): Promise<DiscountApplication[]> => {
    const response = await api.get('/api/fee/discount-applications/');
    return response.data.results || response.data;
  },

  createDiscountApplication: async (data: Partial<DiscountApplication>): Promise<DiscountApplication> => {
    const response = await api.post('/api/fee/discount-applications/', data);
    return response.data;
  },

  getAppliedDiscounts: async (params?: object): Promise<StudentDiscount[]> => {
    const response = await api.get('/api/fee/student-discounts/', { params });
    return response.data.results || response.data;
  },

  // Waivers
  getWaivers: async (params?: object): Promise<FeeWaiver[]> => {
    const response = await api.get('/api/fee/waivers/', { params });
    return response.data.results || response.data;
  },

  createWaiver: async (data: Partial<FeeWaiver>): Promise<FeeWaiver> => {
    const response = await api.post('/api/fee/waivers/', data);
    return response.data;
  },

  approveWaiver: async (id: number): Promise<FeeWaiver> => {
    const response = await api.post(`/api/fee/waivers/${id}/approve/`);
    return response.data;
  },

  rejectWaiver: async (id: number, rejection_reason: string): Promise<FeeWaiver> => {
    const response = await api.post(`/api/fee/waivers/${id}/reject/`, { rejection_reason });
    return response.data;
  },

  // Other payments
  getOtherPayments: async (params?: object): Promise<OtherPayment[]> => {
    const response = await api.get('/api/fee/other-payments/', { params });
    return response.data.results || response.data;
  },

  createOtherPayment: async (data: Partial<OtherPayment>): Promise<OtherPayment> => {
    const response = await api.post('/api/fee/other-payments/', data);
    return response.data;
  },

  // Bank accounts
  getBankAccounts: async (): Promise<SchoolBankDetail[]> => {
    const response = await api.get('/api/fee/bank-accounts/');
    return response.data.results || response.data;
  },

  createBankAccount: async (data: Partial<SchoolBankDetail>): Promise<SchoolBankDetail> => {
    const response = await api.post('/api/fee/bank-accounts/', data);
    return response.data;
  },

  updateBankAccount: async (id: number, data: Partial<SchoolBankDetail>): Promise<SchoolBankDetail> => {
    const response = await api.put(`/api/fee/bank-accounts/${id}/`, data);
    return response.data;
  },

  deleteBankAccount: async (id: number): Promise<void> => {
    await api.delete(`/api/fee/bank-accounts/${id}/`);
  },

  // Fee settings
  getSettings: async (): Promise<FeeSetting> => {
    const response = await api.get('/api/fee/settings/retrieve_settings/');
    return response.data;
  },

  updateSettings: async (data: Partial<FeeSetting>): Promise<FeeSetting> => {
    const response = await api.patch('/api/fee/settings/update_settings/', data);
    return response.data;
  },

  // Invoice PDF
  getInvoicePDF: async (invoiceId: number): Promise<string> => {
    return `${getApiUrl()}/api/fee/invoices/${invoiceId}/pdf/`;
  },

  getReceiptPDF: async (paymentId: number): Promise<string> => {
    return `${getApiUrl()}/api/fee/payments/${paymentId}/receipt-pdf/`;
  },

  // Gateway configurations
  getGatewayConfigs: async (): Promise<PaymentGatewayConfig[]> => {
    const response = await api.get('/api/fee/gateways/');
    return response.data.results || response.data;
  },

  createGatewayConfig: async (data: Partial<PaymentGatewayConfig>): Promise<PaymentGatewayConfig> => {
    const response = await api.post('/api/fee/gateways/', data);
    return response.data;
  },

  updateGatewayConfig: async (id: number, data: Partial<PaymentGatewayConfig>): Promise<PaymentGatewayConfig> => {
    const response = await api.put(`/api/fee/gateways/${id}/`, data);
    return response.data;
  },

  deleteGatewayConfig: async (id: number): Promise<void> => {
    await api.delete(`/api/fee/gateways/${id}/`);
  },
};


const fetchUploadableClasses = async (resultType: 'score' | 'text' | 'special') => {
  const response = await api.get('/api/academic/class-subjects/uploadable/', {
    params: { result_type: resultType }
  });
  return response.data.data.classes;
};


export const studentDashboardAPI = {
  getOverview: async () => {
    const r = await api.get('/api/student/dashboard/overview/');
    return r.data.data;
  },
  getAdmissions: async (params?: { class_id?: number }) => {
    const r = await api.get('/api/student/dashboard/admissions/', { params });
    return r.data.data;
  },
  getClassDistribution: async (params?: { session_id?: number }) => {
    const r = await api.get('/api/student/dashboard/class-distribution/', { params });
    return r.data.data;
  },
  getDemographics: async (params?: { class_id?: number; session_id?: number }) => {
    const r = await api.get('/api/student/dashboard/demographics/', { params });
    return r.data.data;
  },
  getGuardianStats: async () => {
    const r = await api.get('/api/student/dashboard/guardian-stats/');
    return r.data.data;
  },
  executeAction: async (action: string) => {
    const r = await api.post('/api/student/dashboard/actions/', { action });
    return r.data.data;
  },
};

export const bulkUploadAPI = {
  downloadParentTemplate: async (fields: string[]): Promise<void> => {
    const response = await api.get('/api/student/bulk/template/parent/', {
      params: { fields: fields.join(',') }, responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a'); a.href = url;
    a.setAttribute('download', 'guardian_upload_template.xlsx');
    document.body.appendChild(a); a.click(); a.remove();
  },

  downloadStudentTemplate: async (fields: string[]): Promise<void> => {
    const response = await api.get('/api/student/bulk/template/student/', {
      params: { fields: fields.join(',') }, responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a'); a.href = url;
    a.setAttribute('download', 'student_upload_template.xlsx');
    document.body.appendChild(a); a.click(); a.remove();
  },

  uploadParents: async (file: File): Promise<{ upload_id: number; task_id: string }> => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post('/api/student/bulk/upload/parent/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return r.data.data;
  },

  uploadStudents: async (file: File): Promise<{ upload_id: number; task_id: string }> => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post('/api/student/bulk/upload/student/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return r.data.data;
  },

  getStatus: async (uploadId: number) => {
    const r = await api.get(`/api/student/bulk/status/${uploadId}/`);
    return r.data.data;
  },

  downloadErrorReport: async (uploadId: number): Promise<void> => {
    const response = await api.get(`/api/student/bulk/error-report/${uploadId}/`, {
      responseType: 'blob'
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a'); a.href = url;
    a.setAttribute('download', `error_report_${uploadId}.xlsx`);
    document.body.appendChild(a); a.click(); a.remove();
  },
};


export const alumniAPI = {
  list: async (params?: {
    session_id?: string | number;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<any> => {
    const response = await api.get('/api/student/alumni/', { params });
    // backend wraps in APIResponse → results.data pattern (same as StudentListView)
    return response.data;
  },

  downloadExcel: async (params?: object): Promise<void> => {
    const response = await api.get('/api/student/alumni/download/excel/', {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'alumni.xlsx');
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  downloadPDF: async (params?: object): Promise<void> => {
    const response = await api.get('/api/student/alumni/download/pdf/', {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', 'alumni.pdf');
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};


// ==================== ASSESSMENT CENTER ====================
export * from './assessment.service';
export * from './communication.service';
export * from './learning.service';
export * from './result.service';
export * from './inventory.service';
export * from './finance.service';
export * from './salary_management.service';


// Export the default api instance for custom requests
export { api };
export default api;
