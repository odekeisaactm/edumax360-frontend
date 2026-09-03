// salary_management.service.ts
// ====================================================================
// Salary Management - API Service Layer
// ====================================================================

import api from './api';
import type {
  // Core models
  PaginatedResponse,
  SalaryGlobalSetting,
  SalaryGlobalSettingWrite,
  SalarySetting,
  SalarySettingWrite,
  SalaryStructure,
  SalaryStructureWrite,
  SalaryRecord,
  SalaryRecordWrite,
  SalaryProcessingBatch,
  BonusCategory,
  BonusCategoryWrite,
  Bonus,
  BonusWrite,
  SalaryAdvance,
  SalaryAdvanceWrite,
  StaffLoan,
  StaffLoanWrite,
  StaffLoanRepayment,
  StaffLoanRepaymentWrite,
  StaffBankDetail,
  StaffBankDetailWrite,
  // Filters
  SalaryRecordListFilters,
  SalaryStructureListFilters,
  BonusListFilters,
  SalaryAdvanceListFilters,
  StaffLoanListFilters,
  StaffBankDetailListFilters,
  // Request payloads
  ProcessPayrollPayload,
  MarkSalaryPaidPayload,
  EmailPayslipsPayload,
  SalaryAdvanceActionPayload,
  StaffLoanActionPayload,
  RecordLoanRepaymentPayload,
  BulkChangeSettingPayload,
  BulkChangeSettingResult,
  // Dashboard
  SalaryDashboardStats,
} from './salary_management.types';

// ====================================================================
// HELPER: Safe Unwrapper
// ====================================================================
// Handles both standard DRF pagination {count, results: []}
// and our custom APIResponse {success, data: []} seamlessly.
const unwrapData = (res: any) => res.data?.data ?? res.data;
const unwrapPaginated = (res: any) => {
  const data = res.data;
  // If wrapped inside DRF's standard pagination results
  if (data?.results?.data) {
    return { ...data, results: data.results.data };
  }
  return data;
};

// ====================================================================
// 0. GLOBAL SETTINGS (Singleton)
// ====================================================================

export const salaryGlobalSettingsAPI = {
  get: async (): Promise<SalaryGlobalSetting> => {
    const response = await api.get('/api/salary-management/global-settings/');
    return unwrapData(response);
  },

  patch: async (data: SalaryGlobalSettingWrite): Promise<SalaryGlobalSetting> => {
    const response = await api.patch('/api/salary-management/global-settings/', data);
    return unwrapData(response);
  },
};

// ====================================================================
// 1. SALARY SETTINGS
// ====================================================================

export const salarySettingsAPI = {
  list: async (): Promise<SalarySetting[]> => {
    const response = await api.get('/api/salary-management/settings/');
    return unwrapData(response) || [];
  },

  create: async (data: SalarySettingWrite): Promise<SalarySetting> => {
    const response = await api.post('/api/salary-management/settings/', data);
    return unwrapData(response);
  },

  get: async (id: number): Promise<SalarySetting> => {
    const response = await api.get(`/api/salary-management/settings/${id}/`);
    return unwrapData(response);
  },

  update: async (id: number, data: SalarySettingWrite): Promise<SalarySetting> => {
    const response = await api.put(`/api/salary-management/settings/${id}/`, data);
    return unwrapData(response);
  },

  patch: async (id: number, data: Partial<SalarySettingWrite>): Promise<SalarySetting> => {
    const response = await api.patch(`/api/salary-management/settings/${id}/`, data);
    return unwrapData(response);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/settings/${id}/`);
  },
};

// ====================================================================
// 2. SALARY STRUCTURES
// ====================================================================

export const salaryStructuresAPI = {
  list: async (filters?: SalaryStructureListFilters): Promise<PaginatedResponse<SalaryStructure>> => {
    const response = await api.get('/api/salary-management/structures/', { params: filters });
    return unwrapPaginated(response);
  },

  create: async (data: SalaryStructureWrite): Promise<SalaryStructure> => {
    const response = await api.post('/api/salary-management/structures/', data);
    return unwrapData(response);
  },

  get: async (id: number): Promise<SalaryStructure> => {
    const response = await api.get(`/api/salary-management/structures/${id}/`);
    return unwrapData(response);
  },

  update: async (id: number, data: SalaryStructureWrite): Promise<SalaryStructure> => {
    const response = await api.put(`/api/salary-management/structures/${id}/`, data);
    return unwrapData(response);
  },

  patch: async (id: number, data: Partial<SalaryStructureWrite>): Promise<SalaryStructure> => {
    const response = await api.patch(`/api/salary-management/structures/${id}/`, data);
    return unwrapData(response);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/structures/${id}/`);
  },

  bulkChangeSetting: async (payload: BulkChangeSettingPayload): Promise<BulkChangeSettingResult> => {
    const response = await api.post('/api/salary-management/structures/bulk-change-setting/', payload);
    return unwrapData(response);
  },
};

// ====================================================================
// 3. PAYROLL PROCESSING & RECORDS
// ====================================================================

export const payrollAPI = {
  /**
   * Process payroll asynchronously (Returns a Batch Tracker)
   */
  process: async (payload: ProcessPayrollPayload): Promise<SalaryProcessingBatch> => {
    const response = await api.post('/api/salary-management/payroll/process/', { records: payload });
    return unwrapData(response);
  },

  /**
   * Poll this endpoint to update the frontend progress bar
   */
  getBatchStatus: async (id: number): Promise<SalaryProcessingBatch> => {
    const response = await api.get(`/api/salary-management/payroll/batches/${id}/`);
    return unwrapData(response);
  },

  listRecords: async (filters?: SalaryRecordListFilters): Promise<PaginatedResponse<SalaryRecord> | SalaryRecord[]> => {
    const response = await api.get('/api/salary-management/records/', { params: filters });
    return unwrapPaginated(response);
  },

  myRecords: async (filters?: SalaryRecordListFilters): Promise<PaginatedResponse<SalaryRecord> | SalaryRecord[]> => {
    const response = await api.get('/api/salary-management/records/my/', { params: filters });
    return unwrapPaginated(response);
  },

  getRecord: async (id: number): Promise<SalaryRecord> => {
    const response = await api.get(`/api/salary-management/records/${id}/`);
    return unwrapData(response);
  },

  patchRecord: async (id: number, data: Partial<SalaryRecordWrite>): Promise<SalaryRecord> => {
    const response = await api.patch(`/api/salary-management/records/${id}/`, data);
    return unwrapData(response);
  },

  deleteRecord: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/records/${id}/`);
  },

  markPaid: async (payload: MarkSalaryPaidPayload): Promise<any> => {
    const response = await api.post('/api/salary-management/records/mark-paid/', payload);
    return unwrapData(response);
  },

  emailPayslips: async (payload: EmailPayslipsPayload): Promise<any> => {
    const response = await api.post('/api/salary-management/records/email-payslips/', payload);
    return unwrapData(response);
  }
};

// ====================================================================
// 4. BONUSES
// ====================================================================

export const bonusCategoriesAPI = {
  list: async (filters?: { is_active?: boolean }): Promise<PaginatedResponse<BonusCategory> | BonusCategory[]> => {
    const response = await api.get('/api/salary-management/bonus-categories/', { params: filters });
    return unwrapPaginated(response);
  },

  create: async (data: BonusCategoryWrite): Promise<BonusCategory> => {
    const response = await api.post('/api/salary-management/bonus-categories/', data);
    return unwrapData(response);
  },

  get: async (id: number): Promise<BonusCategory> => {
    const response = await api.get(`/api/salary-management/bonus-categories/${id}/`);
    return unwrapData(response);
  },

  update: async (id: number, data: BonusCategoryWrite): Promise<BonusCategory> => {
    const response = await api.put(`/api/salary-management/bonus-categories/${id}/`, data);
    return unwrapData(response);
  },

  patch: async (id: number, data: Partial<BonusCategoryWrite>): Promise<BonusCategory> => {
    const response = await api.patch(`/api/salary-management/bonus-categories/${id}/`, data);
    return unwrapData(response);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/bonus-categories/${id}/`);
  },
};

export const bonusesAPI = {
  list: async (filters?: BonusListFilters): Promise<any> => {
    const response = await api.get('/api/salary-management/bonuses/', { params: filters });
    const d = response.data;
    if (d.results) {
      const data = d.results.data || d.results;
      return {
        results: Array.isArray(data) ? data : [],
        count: d.count || 0,
        stats: d.results.stats || d.stats || null
      };
    }
    const data = d.data || d;
    return {
      results: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0,
      stats: d.stats || null
    };
  },

  myList: async (filters?: Pick<BonusListFilters, 'month' | 'year' | 'status' | 'academic_period' | 'session' | 'page' | 'page_size'>): Promise<any> => {
    const response = await api.get('/api/salary-management/bonuses/my/', { params: filters });
    const d = response.data;
    if (d.results) {
      const data = d.results.data || d.results;
      return {
        results: Array.isArray(data) ? data : [],
        count: d.count || 0,
        stats: d.results.stats || d.stats || null
      };
    }
    const data = d.data || d;
    return {
      results: Array.isArray(data) ? data : [],
      count: Array.isArray(data) ? data.length : 0,
      stats: d.stats || null
    };
  },

  create: async (data: BonusWrite): Promise<Bonus> => {
    const response = await api.post('/api/salary-management/bonuses/', data);
    return unwrapData(response);
  },

  get: async (id: number): Promise<Bonus> => {
    const response = await api.get(`/api/salary-management/bonuses/${id}/`);
    return unwrapData(response);
  },

  update: async (id: number, data: BonusWrite): Promise<Bonus> => {
    const response = await api.put(`/api/salary-management/bonuses/${id}/`, data);
    return unwrapData(response);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/bonuses/${id}/`);
  },

  markPaid: async (id: number): Promise<Bonus> => {
    const response = await api.post(`/api/salary-management/bonuses/${id}/mark-paid/`);
    return unwrapData(response);
  },
};

// ====================================================================
// 5. SALARY ADVANCES
// ====================================================================

export const salaryAdvancesAPI = {
  list: async (filters?: SalaryAdvanceListFilters): Promise<PaginatedResponse<SalaryAdvance> | SalaryAdvance[]> => {
    const response = await api.get('/api/salary-management/advances/', { params: filters });
    return unwrapPaginated(response);
  },

  create: async (data: SalaryAdvanceWrite): Promise<SalaryAdvance> => {
    const response = await api.post('/api/salary-management/advances/', data);
    return unwrapData(response);
  },

  get: async (id: number): Promise<SalaryAdvance> => {
    const response = await api.get(`/api/salary-management/advances/${id}/`);
    return unwrapData(response);
  },

  update: async (id: number, data: SalaryAdvanceWrite): Promise<SalaryAdvance> => {
    const response = await api.put(`/api/salary-management/advances/${id}/`, data);
    return unwrapData(response);
  },

  patch: async (id: number, data: Partial<SalaryAdvanceWrite>): Promise<SalaryAdvance> => {
    const response = await api.patch(`/api/salary-management/advances/${id}/`, data);
    return unwrapData(response);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/advances/${id}/`);
  },

  action: async (id: number, payload: SalaryAdvanceActionPayload): Promise<SalaryAdvance> => {
    const response = await api.post(`/api/salary-management/advances/${id}/action/`, payload);
    return unwrapData(response);
  },
};

// ====================================================================
// 6. STAFF LOANS
// ====================================================================

export const staffLoansAPI = {
  list: async (filters?: StaffLoanListFilters): Promise<PaginatedResponse<StaffLoan> | StaffLoan[]> => {
    const response = await api.get('/api/salary-management/loans/', { params: filters });
    return unwrapPaginated(response);
  },

  create: async (data: StaffLoanWrite): Promise<StaffLoan> => {
    const response = await api.post('/api/salary-management/loans/', data);
    return unwrapData(response);
  },

  get: async (id: number): Promise<StaffLoan> => {
    const response = await api.get(`/api/salary-management/loans/${id}/`);
    return unwrapData(response);
  },

  update: async (id: number, data: StaffLoanWrite): Promise<StaffLoan> => {
    const response = await api.put(`/api/salary-management/loans/${id}/`, data);
    return unwrapData(response);
  },

  patch: async (id: number, data: Partial<StaffLoanWrite>): Promise<StaffLoan> => {
    const response = await api.patch(`/api/salary-management/loans/${id}/`, data);
    return unwrapData(response);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/loans/${id}/`);
  },

  action: async (id: number, payload: StaffLoanActionPayload): Promise<StaffLoan> => {
    const response = await api.post(`/api/salary-management/loans/${id}/action/`, payload);
    return unwrapData(response);
  },

  recordRepayment: async (staffPk: number, payload: RecordLoanRepaymentPayload): Promise<StaffLoanRepayment> => {
    const response = await api.post(`/api/salary-management/loans/staff/${staffPk}/repay/`, payload);
    return unwrapData(response);
  },
};

// ====================================================================
// 7. STAFF BANK DETAILS
// ====================================================================

export const staffBankDetailsAPI = {
  list: async (filters?: StaffBankDetailListFilters): Promise<PaginatedResponse<StaffBankDetail> | StaffBankDetail[]> => {
    const response = await api.get('/api/salary-management/bank-details/', { params: filters });
    return unwrapPaginated(response);
  },

  create: async (data: StaffBankDetailWrite): Promise<StaffBankDetail> => {
    const response = await api.post('/api/salary-management/bank-details/', data);
    return unwrapData(response);
  },

  get: async (id: number): Promise<StaffBankDetail> => {
    const response = await api.get(`/api/salary-management/bank-details/${id}/`);
    return unwrapData(response);
  },

  update: async (id: number, data: StaffBankDetailWrite): Promise<StaffBankDetail> => {
    const response = await api.put(`/api/salary-management/bank-details/${id}/`, data);
    return unwrapData(response);
  },

  patch: async (id: number, data: Partial<StaffBankDetailWrite>): Promise<StaffBankDetail> => {
    const response = await api.patch(`/api/salary-management/bank-details/${id}/`, data);
    return unwrapData(response);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/bank-details/${id}/`);
  },
};

// ====================================================================
// 8. DASHBOARD
// ====================================================================

export const salaryDashboardAPI = {
  getStats: async (): Promise<SalaryDashboardStats> => {
    const response = await api.get('/api/salary-management/dashboard/stats/');
    return unwrapData(response);
  },
};