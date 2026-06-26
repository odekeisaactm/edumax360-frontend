// src/lib/api/finance.service.ts

import api from './api';
import { getApiUrl } from './getApiUrl';
import type {
  FinanceSettings,
  FinanceSettingsFormValues,
  SchoolBankDetail,
  SchoolBankDetailFormValues,
  SchoolBankDetailListFilters,
  StudentFunding,
  StudentFundingFormValues,
  StudentFundingListFilters,
  StudentFundingActionPayload,
  StaffFunding,
  StaffFundingFormValues,
  StaffFundingListFilters,
  StaffFundingActionPayload,
  IncomeCategory,
  IncomeCategoryFormValues,
  Income,
  IncomeFormValues,
  IncomeListFilters,
  ExpenseCategory,
  ExpenseCategoryFormValues,
  Expense,
  ExpenseFormValues,
  ExpenseListFilters,
  SupplierPayment,
  SupplierPaymentFormValues,
  SupplierPaymentListFilters,
  PurchaseAdvancePayment,
  PurchaseAdvancePaymentFormValues,
  PurchaseAdvancePaymentListFilters,
  AdvanceSettlement,
  AdvanceSettlementFormValues,
  AdvanceSettlementListFilters,
  FinanceDashboardStats,
  PaginatedResponse,
} from '@/lib/finance.types';

// ============================================================
// 1. FINANCE SETTINGS (Singleton)
// ============================================================

export const financeSettingsAPI = {
  /**
   * Get finance settings
   * Returns null if doesn't exist (404) - THIS IS NOT AN ERROR!
   */
  get: async (): Promise<FinanceSettings | null> => {
    try {
      const response = await api.get('/api/finance/settings/');
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  create: async (data: FinanceSettingsFormValues) => {
    const response = await api.put('/api/finance/settings/', data);
      return response.data.data;
    },

  /**
   * Update finance settings
   */
  update: async (data: Partial<FinanceSettingsFormValues>): Promise<FinanceSettings> => {
    const response = await api.put('/api/finance/settings/', data);
    return response.data.data;
  },
};

// ============================================================
// 2. SCHOOL BANK DETAILS
// ============================================================

export const bankDetailsAPI = {
  /**
   * List all bank details with optional filters
   */
  list: async (filters?: SchoolBankDetailListFilters): Promise<SchoolBankDetail[]> => {
    const response = await api.get('/api/finance/bank-details/', { params: filters });
    return response.data.data || [];
  },

  /**
   * Create a new bank detail
   */
  create: async (data: SchoolBankDetailFormValues): Promise<SchoolBankDetail> => {
    const response = await api.post('/api/finance/bank-details/', data);
    return response.data.data;
  },

  /**
   * Get bank detail by ID
   */
  get: async (id: number): Promise<SchoolBankDetail> => {
    const response = await api.get(`/api/finance/bank-details/${id}/`);
    return response.data.data;
  },

  /**
   * Update bank detail
   */
  update: async (id: number, data: Partial<SchoolBankDetailFormValues>): Promise<SchoolBankDetail> => {
    const response = await api.put(`/api/finance/bank-details/${id}/`, data);
    return response.data.data;
  },

  /**
   * Delete bank detail
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/finance/bank-details/${id}/`);
  },
};

// ============================================================
// 3. STUDENT WALLET FUNDING
// ============================================================

export const studentFundingAPI = {
  /**
   * List student fundings with pagination and filters
   */
  list: async (filters?: StudentFundingListFilters): Promise<PaginatedResponse<StudentFunding>> => {
    const response = await api.get('/api/finance/student-funding/', { params: filters });
    // The view uses StandardResultsSetPagination which returns paginated response
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new student funding
   */
  create: async (data: StudentFundingFormValues | FormData): Promise<StudentFunding> => {
    const isFormData = data instanceof FormData;
    const response = await api.post('/api/finance/student-funding/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data;
  },

  /**
   * Get student funding by ID
   */
  get: async (id: number): Promise<StudentFunding> => {
    const response = await api.get(`/api/finance/student-funding/${id}/`);
    return response.data.data;
  },

  /**
   * Perform action on student funding (confirm/decline/revert)
   */
  action: async (id: number, payload: StudentFundingActionPayload): Promise<{ message: string }> => {
    const response = await api.post(`/api/finance/student-funding/${id}/action/`, payload);
    return response.data;
  },
};

// ============================================================
// 4. STAFF WALLET FUNDING
// ============================================================

export const staffFundingAPI = {
  /**
   * List staff fundings with pagination and filters
   */
  list: async (filters?: StaffFundingListFilters): Promise<PaginatedResponse<StaffFunding>> => {
    const response = await api.get('/api/finance/staff-funding/', { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new staff funding
   */
  create: async (data: StaffFundingFormValues | FormData): Promise<StaffFunding> => {
    const isFormData = data instanceof FormData;
    const response = await api.post('/api/finance/staff-funding/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data;
  },

  /**
   * Get staff funding by ID
   */
  get: async (id: number): Promise<StaffFunding> => {
    const response = await api.get(`/api/finance/staff-funding/${id}/`);
    return response.data.data;
  },

  /**
   * Perform action on staff funding (confirm/decline/revert)
   */
  action: async (id: number, payload: StaffFundingActionPayload): Promise<{ message: string }> => {
    const response = await api.post(`/api/finance/staff-funding/${id}/action/`, payload);
    return response.data;
  },
};

// ============================================================
// 5. INCOME CATEGORIES
// ============================================================

export const incomeCategoriesAPI = {
  /**
   * List all income categories
   */
  list: async (): Promise<IncomeCategory[]> => {
    const response = await api.get('/api/finance/income-categories/');
    return response.data.data || [];
  },

  /**
   * Create a new income category
   */
  create: async (data: IncomeCategoryFormValues): Promise<IncomeCategory> => {
    const response = await api.post('/api/finance/income-categories/', data);
    return response.data.data;
  },

  /**
   * Get income category by ID
   */
  get: async (id: number): Promise<IncomeCategory> => {
    const response = await api.get(`/api/finance/income-categories/${id}/`);
    return response.data.data;
  },

  /**
   * Update income category
   */
  update: async (id: number, data: Partial<IncomeCategoryFormValues>): Promise<IncomeCategory> => {
    const response = await api.put(`/api/finance/income-categories/${id}/`, data);
    return response.data.data;
  },

  /**
   * Delete income category
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/finance/income-categories/${id}/`);
  },
};

// ============================================================
// 6. INCOME RECORDS
// ============================================================

export const incomeAPI = {
  /**
   * List income records with pagination and filters
   */
  list: async (filters?: IncomeListFilters): Promise<PaginatedResponse<Income>> => {
    const response = await api.get('/api/finance/incomes/', { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new income record
   */
  create: async (data: IncomeFormValues | FormData): Promise<Income> => {
    const isFormData = data instanceof FormData;
    const response = await api.post('/api/finance/incomes/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data;
  },

  /**
   * Get income record by ID
   */
  get: async (id: number): Promise<Income> => {
    const response = await api.get(`/api/finance/incomes/${id}/`);
    return response.data.data;
  },

  /**
   * Update income record
   */
  update: async (id: number, data: Partial<IncomeFormValues> | FormData): Promise<Income> => {
    const isFormData = data instanceof FormData;
    const response = await api.put(`/api/finance/incomes/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data;
  },

  /**
   * Delete income record
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/finance/incomes/${id}/`);
  },
};

// ============================================================
// 7. EXPENSE CATEGORIES
// ============================================================

export const expenseCategoriesAPI = {
  /**
   * List all expense categories
   */
  list: async (): Promise<ExpenseCategory[]> => {
    const response = await api.get('/api/finance/expense-categories/');
    return response.data.data || [];
  },

  /**
   * Create a new expense category
   */
  create: async (data: ExpenseCategoryFormValues): Promise<ExpenseCategory> => {
    const response = await api.post('/api/finance/expense-categories/', data);
    return response.data.data;
  },

  /**
   * Get expense category by ID
   */
  get: async (id: number): Promise<ExpenseCategory> => {
    const response = await api.get(`/api/finance/expense-categories/${id}/`);
    return response.data.data;
  },

  /**
   * Update expense category
   */
  update: async (id: number, data: Partial<ExpenseCategoryFormValues>): Promise<ExpenseCategory> => {
    const response = await api.put(`/api/finance/expense-categories/${id}/`, data);
    return response.data.data;
  },

  /**
   * Delete expense category
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/finance/expense-categories/${id}/`);
  },
};

// ============================================================
// 8. EXPENSE RECORDS
// ============================================================

export const expenseAPI = {
  /**
   * List expense records with pagination and filters
   */
  list: async (filters?: ExpenseListFilters): Promise<PaginatedResponse<Expense>> => {
    const response = await api.get('/api/finance/expenses/', { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new expense record
   */
  create: async (data: ExpenseFormValues | FormData): Promise<Expense> => {
    const isFormData = data instanceof FormData;
    const response = await api.post('/api/finance/expenses/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data;
  },

  /**
   * Get expense record by ID
   */
  get: async (id: number): Promise<Expense> => {
    const response = await api.get(`/api/finance/expenses/${id}/`);
    return response.data.data;
  },

  /**
   * Update expense record
   */
  update: async (id: number, data: Partial<ExpenseFormValues> | FormData): Promise<Expense> => {
    const isFormData = data instanceof FormData;
    const response = await api.put(`/api/finance/expenses/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data;
  },

  /**
   * Delete expense record
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/finance/expenses/${id}/`);
  },
};

// ============================================================
// 9. SUPPLIER PAYMENTS
// ============================================================

export const supplierPaymentsAPI = {
  /**
   * List supplier payments with pagination and filters
   */
  list: async (filters?: SupplierPaymentListFilters): Promise<PaginatedResponse<SupplierPayment>> => {
    const response = await api.get('/api/finance/supplier-payments/', { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new supplier payment
   */
  create: async (data: SupplierPaymentFormValues): Promise<SupplierPayment> => {
    const response = await api.post('/api/finance/supplier-payments/', data);
    return response.data.data;
  },

  /**
   * Get supplier payment by ID
   */
  get: async (id: number): Promise<SupplierPayment> => {
    const response = await api.get(`/api/finance/supplier-payments/${id}/`);
    return response.data.data;
  },
};

// ============================================================
// 10. PURCHASE ADVANCE PAYMENTS
// ============================================================

export const advancePaymentsAPI = {
  /**
   * List purchase advance payments with pagination and filters
   */
  list: async (filters?: PurchaseAdvancePaymentListFilters): Promise<PaginatedResponse<PurchaseAdvancePayment>> => {
    const response = await api.get('/api/finance/advance-payments/', { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new purchase advance payment
   */
  create: async (data: PurchaseAdvancePaymentFormValues): Promise<PurchaseAdvancePayment> => {
    const response = await api.post('/api/finance/advance-payments/', data);
    return response.data.data;
  },

  /**
   * Get purchase advance payment by ID
   */
  get: async (id: number): Promise<PurchaseAdvancePayment> => {
    const response = await api.get(`/api/finance/advance-payments/${id}/`);
    return response.data.data;
  },
};

// ============================================================
// 11. ADVANCE SETTLEMENTS
// ============================================================

export const advanceSettlementsAPI = {
  /**
   * List advance settlements with pagination and filters
   * Note: This endpoint may not exist yet in your URLs,
   * but keeping it ready for when you add it.
   */
  list: async (filters?: AdvanceSettlementListFilters): Promise<PaginatedResponse<AdvanceSettlement>> => {
    const response = await api.get('/api/finance/advance-settlements/', { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new advance settlement
   */
  create: async (data: AdvanceSettlementFormValues): Promise<AdvanceSettlement> => {
    const response = await api.post('/api/finance/advance-settlements/', data);
    return response.data.data;
  },

  /**
   * Get advance settlement by ID
   */
  get: async (id: number): Promise<AdvanceSettlement> => {
    const response = await api.get(`/api/finance/advance-settlements/${id}/`);
    return response.data.data;
  },

  /**
   * Update advance settlement
   */
  update: async (id: number, data: Partial<AdvanceSettlementFormValues>): Promise<AdvanceSettlement> => {
    const response = await api.put(`/api/finance/advance-settlements/${id}/`, data);
    return response.data.data;
  },

  /**
   * Delete advance settlement
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/finance/advance-settlements/${id}/`);
  },
};

// ============================================================
// 12. FINANCE DASHBOARD
// ============================================================

export const financeDashboardAPI = {
  /**
   * Get finance dashboard statistics
   */
  getStats: async (params?: { session_id?: number; period_id?: number }): Promise<FinanceDashboardStats> => {
    const response = await api.get('/api/finance/dashboard/stats/', { params });
    return response.data.data;
  },
};

// ============================================================
// Export all finance APIs as a single object (optional)
// ============================================================

export const financeAPI = {
  settings: financeSettingsAPI,
  bankDetails: bankDetailsAPI,
  studentFunding: studentFundingAPI,
  staffFunding: staffFundingAPI,
  incomeCategories: incomeCategoriesAPI,
  income: incomeAPI,
  expenseCategories: expenseCategoriesAPI,
  expense: expenseAPI,
  supplierPayments: supplierPaymentsAPI,
  advancePayments: advancePaymentsAPI,
  advanceSettlements: advanceSettlementsAPI,
  dashboard: financeDashboardAPI,
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default financeAPI;