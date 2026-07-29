// salary_management.service.ts
// ====================================================================
// Salary Management - API Service Layer
// ====================================================================

import api from './api';
import type {
  // Core models
  PaginatedResponse,
  SalarySetting,
  SalarySettingWrite,
  SalaryStructure,
  SalaryStructureWrite,
  SalaryRecord,
  SalaryRecordWrite,
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
  ProcessPayrollResponse,
  MarkSalaryPaidPayload,
  MarkSalaryPaidResponse,
  SalaryAdvanceActionPayload,
  StaffLoanActionPayload,
  RecordLoanRepaymentPayload,
  // Dashboard
  SalaryDashboardStats,
} from './salary_management.types';

// ====================================================================
// 1. SALARY SETTINGS
// ====================================================================

export const salarySettingsAPI = {
  list: async (): Promise<SalarySetting[]> => {
    const response = await api.get('/api/salary-management/settings/');
    return response.data.data || [];
  },

  create: async (data: SalarySettingWrite): Promise<SalarySetting> => {
    const response = await api.post('/api/salary-management/settings/', data);
    return response.data.data;
  },

  get: async (id: number): Promise<SalarySetting> => {
    const response = await api.get(`/api/salary-management/settings/${id}/`);
    return response.data.data;
  },

  update: async (id: number, data: SalarySettingWrite): Promise<SalarySetting> => {
    const response = await api.put(`/api/salary-management/settings/${id}/`, data);
    return response.data.data;
  },

  patch: async (id: number, data: Partial<SalarySettingWrite>): Promise<SalarySetting> => {
    const response = await api.patch(`/api/salary-management/settings/${id}/`, data);
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/settings/${id}/`);
  },
};

// ====================================================================
// 2. SALARY STRUCTURES
// ====================================================================

export const salaryStructuresAPI = {
  /**
   * List salary structures with optional filters
   */
  list: async (filters?: SalaryStructureListFilters): Promise<PaginatedResponse<SalaryStructure>> => {
      const response = await api.get('/api/salary-management/structures/', { params: filters });
      return response.data;
    },

  /**
   * Create a new salary structure
   */
  create: async (data: SalaryStructureWrite): Promise<SalaryStructure> => {
      const response = await api.post('/api/salary-management/structures/', data);
      return response.data.data || response.data;
    },

  /**
   * Retrieve a salary structure by ID
   */
  get: async (id: number): Promise<SalaryStructure> => {
  const response = await api.get(`/api/salary-management/structures/${id}/`);
  return response.data.data || response.data;
},

update: async (id: number, data: SalaryStructureWrite): Promise<SalaryStructure> => {
  const response = await api.put(`/api/salary-management/structures/${id}/`, data);
  return response.data.data || response.data;
},

patch: async (id: number, data: Partial<SalaryStructureWrite>): Promise<SalaryStructure> => {
  const response = await api.patch(`/api/salary-management/structures/${id}/`, data);
  return response.data.data || response.data;
},
  /**
   * Delete a salary structure
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/structures/${id}/`);
  },
   bulkChangeSetting: async (payload: BulkChangeSettingPayload): Promise<BulkChangeSettingResult> => {
    const response = await api.post('/api/salary-management/structures/bulk-change-setting/', payload);
    return response.data.data || response.data;
  },
};

// ====================================================================
// 3. PAYROLL PROCESSING & RECORDS
// ====================================================================

export const payrollAPI = {
  /**
   * Process payroll (generate payslips) for a given month/year
   */
  process: async (payload: ProcessPayrollPayload): Promise<ProcessPayrollResponse> => {
  const response = await api.post('/api/salary-management/payroll/process/', payload);
  return response.data;
},
  /**
   * List salary records (payslips) with optional filters
   */
  listRecords: async (filters?: SalaryRecordListFilters): Promise<SalaryRecord[]> => {
    const response = await api.get('/api/salary-management/payroll/records/', { params: filters });
    return response.data.results || response.data;
  },

  /**
   * Retrieve a single salary record by ID
   */
  getRecord: async (id: number): Promise<SalaryRecord> => {
    const response = await api.get(`/api/salary-management/payroll/records/${id}/`);
    return response.data;
  },

  /**
   * Update a salary record (e.g., notes) – most fields are read-only
   */
  patchRecord: async (id: number, data: Partial<SalaryRecordWrite>): Promise<SalaryRecord> => {
    const response = await api.patch(`/api/salary-management/payroll/records/${id}/`, data);
    return response.data;
  },

  /**
   * Delete a salary record
   */
  deleteRecord: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/payroll/records/${id}/`);
  },

  /**
   * Mark a salary record as paid (or update payment details)
   */
  markPaid: async (id: number, payload?: MarkSalaryPaidPayload): Promise<MarkSalaryPaidResponse> => {
    const response = await api.post(`/api/salary-management/payroll/records/${id}/mark-paid/`, payload || {});
    return response.data;
  },
};



// ====================================================================
// 4. BONUSES
// ====================================================================
export const bonusCategoriesAPI = {
  /**
   * List bonus categories with optional filters
   */
  list: async (filters?: { is_active?: boolean }): Promise<BonusCategory[]> => {
    const response = await api.get('/api/salary-management/bonus-categories/', { params: filters });
    const res = response.data;

    // Unwrap: { count, next, previous, results: { success, data: [...] } }
    if (res.results) {
      return res.results.data || (Array.isArray(res.results) ? res.results : []);
    }
    // Unwrap: { success, data: [...] }
    return res.data || (Array.isArray(res) ? res : []);
  },

  /**
   * Create a new bonus category
   */
  create: async (data: BonusCategoryWrite): Promise<BonusCategory> => {
    const response = await api.post('/api/salary-management/bonus-categories/', data);
    return response.data.data || response.data;
  },

  /**
   * Retrieve a bonus category by ID
   */
  get: async (id: number): Promise<BonusCategory> => {
    const response = await api.get(`/api/salary-management/bonus-categories/${id}/`);
    return response.data.data || response.data;
  },

  /**
   * Update a bonus category (PUT)
   */
  update: async (id: number, data: BonusCategoryWrite): Promise<BonusCategory> => {
    const response = await api.put(`/api/salary-management/bonus-categories/${id}/`, data);
    return response.data.data || response.data;
  },

  /**
   * Partial update a bonus category (PATCH)
   */
  patch: async (id: number, data: Partial<BonusCategoryWrite>): Promise<BonusCategory> => {
    const response = await api.patch(`/api/salary-management/bonus-categories/${id}/`, data);
    return response.data.data || response.data;
  },

  /**
   * Delete a bonus category
   */
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
      return { results: Array.isArray(data) ? data : [], count: d.count || 0, stats: d.results.stats || null }; // CHANGED d.stats to d.results.stats
    }
    const data = d.data || d;
    return { results: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0, stats: d.stats || null };
  },
   myList: async (filters?: Pick<BonusListFilters, 'month' | 'year' | 'status' | 'academic_period' | 'session' | 'page' | 'page_size'>): Promise<any> => {
    const response = await api.get('/api/salary-management/bonuses/my/', { params: filters });
    const d = response.data;
    if (d.results) {
      const data = d.results.data || d.results;
      return { results: Array.isArray(data) ? data : [], count: d.count || 0, stats: d.results.stats || null };
    }
    const data = d.data || d;
    return { results: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0, stats: d.stats || null };
  },
  create: async (data: BonusWrite): Promise<Bonus> => {
    const response = await api.post('/api/salary-management/bonuses/', data);
    return response.data.data || response.data;
  },
  get: async (id: number): Promise<Bonus> => {
    const response = await api.get(`/api/salary-management/bonuses/${id}/`);
    return response.data.data || response.data;
  },
  update: async (id: number, data: BonusWrite): Promise<Bonus> => {
    const response = await api.put(`/api/salary-management/bonuses/${id}/`, data);
    return response.data.data || response.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/bonuses/${id}/`);
  },
  markPaid: async (id: number): Promise<Bonus> => {
    const response = await api.post(`/api/salary-management/bonuses/${id}/mark-paid/`);
    return response.data.data || response.data;
  },
};

// ====================================================================
// 5. SALARY ADVANCES
// ====================================================================

export const salaryAdvancesAPI = {
  /**
   * List salary advances with optional filters
   */
  list: async (filters?: SalaryAdvanceListFilters): Promise<SalaryAdvance[]> => {
    const response = await api.get('/api/salary-management/advances/', { params: filters });
    return response.data.results || response.data;
  },

  /**
   * Create a new salary advance request
   */
  create: async (data: SalaryAdvanceWrite): Promise<SalaryAdvance> => {
    const response = await api.post('/api/salary-management/advances/', data);
    return response.data;
  },

  /**
   * Retrieve a salary advance by ID
   */
  get: async (id: number): Promise<SalaryAdvance> => {
    const response = await api.get(`/api/salary-management/advances/${id}/`);
    return response.data;
  },

  /**
   * Update a salary advance (PUT)
   */
  update: async (id: number, data: SalaryAdvanceWrite): Promise<SalaryAdvance> => {
    const response = await api.put(`/api/salary-management/advances/${id}/`, data);
    return response.data;
  },

  /**
   * Partial update a salary advance (PATCH)
   */
  patch: async (id: number, data: Partial<SalaryAdvanceWrite>): Promise<SalaryAdvance> => {
    const response = await api.patch(`/api/salary-management/advances/${id}/`, data);
    return response.data;
  },

  /**
   * Delete a salary advance
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/advances/${id}/`);
  },

  /**
   * Perform an action on a salary advance (approve/reject/disburse)
   */
  action: async (id: number, payload: SalaryAdvanceActionPayload): Promise<SalaryAdvance> => {
    const response = await api.post(`/api/salary-management/advances/${id}/action/`, payload);
    return response.data;
  },
};

// ====================================================================
// 6. STAFF LOANS
// ====================================================================

export const staffLoansAPI = {
  /**
   * List staff loans with optional filters
   */
  list: async (filters?: StaffLoanListFilters): Promise<StaffLoan[]> => {
    const response = await api.get('/api/salary-management/loans/', { params: filters });
    return response.data.results || response.data;
  },

  /**
   * Create a new staff loan request
   */
  create: async (data: StaffLoanWrite): Promise<StaffLoan> => {
    const response = await api.post('/api/salary-management/loans/', data);
    return response.data;
  },

  /**
   * Retrieve a staff loan by ID
   */
  get: async (id: number): Promise<StaffLoan> => {
    const response = await api.get(`/api/salary-management/loans/${id}/`);
    return response.data;
  },

  /**
   * Update a staff loan (PUT)
   */
  update: async (id: number, data: StaffLoanWrite): Promise<StaffLoan> => {
    const response = await api.put(`/api/salary-management/loans/${id}/`, data);
    return response.data;
  },

  /**
   * Partial update a staff loan (PATCH)
   */
  patch: async (id: number, data: Partial<StaffLoanWrite>): Promise<StaffLoan> => {
    const response = await api.patch(`/api/salary-management/loans/${id}/`, data);
    return response.data;
  },

  /**
   * Delete a staff loan
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/loans/${id}/`);
  },

  /**
   * Perform an action on a staff loan (approve/reject/disburse)
   */
  action: async (id: number, payload: StaffLoanActionPayload): Promise<StaffLoan> => {
    const response = await api.post(`/api/salary-management/loans/${id}/action/`, payload);
    return response.data;
  },

  /**
   * Record a loan repayment for a specific staff member
   */
  recordRepayment: async (staffPk: number, payload: RecordLoanRepaymentPayload): Promise<StaffLoanRepayment> => {
    const response = await api.post(`/api/salary-management/loans/staff/${staffPk}/repay/`, payload);
    return response.data;
  },
};

// ====================================================================
// 7. STAFF BANK DETAILS
// ====================================================================

export const staffBankDetailsAPI = {
  /**
   * List staff bank details with optional filters
   */
  list: async (filters?: StaffBankDetailListFilters): Promise<StaffBankDetail[]> => {
    const response = await api.get('/api/salary-management/bank-details/', { params: filters });
    return response.data.results || response.data;
  },

  /**
   * Create a new staff bank detail entry
   */
  create: async (data: StaffBankDetailWrite): Promise<StaffBankDetail> => {
    const response = await api.post('/api/salary-management/bank-details/', data);
    return response.data;
  },

  /**
   * Retrieve a staff bank detail by ID
   */
  get: async (id: number): Promise<StaffBankDetail> => {
    const response = await api.get(`/api/salary-management/bank-details/${id}/`);
    return response.data;
  },

  /**
   * Update a staff bank detail (PUT)
   */
  update: async (id: number, data: StaffBankDetailWrite): Promise<StaffBankDetail> => {
    const response = await api.put(`/api/salary-management/bank-details/${id}/`, data);
    return response.data;
  },

  /**
   * Partial update a staff bank detail (PATCH)
   */
  patch: async (id: number, data: Partial<StaffBankDetailWrite>): Promise<StaffBankDetail> => {
    const response = await api.patch(`/api/salary-management/bank-details/${id}/`, data);
    return response.data;
  },

  /**
   * Delete a staff bank detail
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/salary-management/bank-details/${id}/`);
  },
};

// ====================================================================
// 8. DASHBOARD (Optional - if you implement a dashboard endpoint)
// ====================================================================

export const salaryDashboardAPI = {
  /**
   * Get salary management dashboard statistics
   * (This endpoint is not defined in the provided URLs, but you can add if needed)
   */
  getStats: async (): Promise<SalaryDashboardStats> => {
    const response = await api.get('/api/salary-management/dashboard/stats/');
    return response.data;
  },
};
