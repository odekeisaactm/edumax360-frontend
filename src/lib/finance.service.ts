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
  MyFundingListParams,
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
  PaymentGatewayConfig,
  WalletTransfer,
  WalletTransferFormValues,
  WalletTransferListFilters,
  WalletTransferListResponse,
  PaginatedResponse,

} from '@/lib/finance.types';

// ============================================================
// BASE PATH VARIABLE
// ============================================================

const FINANCE_API_BASE = '/api/finance';

const getDrfError = (error: any): string => {
  const data = error?.response?.data;
  if (data && typeof data === 'object') {
    if (data.detail) return String(data.detail);
    if (data.message) return String(data.message);
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
      return String(data.non_field_errors[0]);
    }

    // Format field-specific errors cleanly (e.g., "Name: income category model with this name already exists.")
    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val) && val.length > 0) {
        const fieldName = key.charAt(0).toUpperCase() + key.slice(1);
        return `${fieldName}: ${val[0]}`;
      }
      if (typeof val === 'string') return val;
    }
  }
  return error?.message || 'An error occurred';
};

// ============================================================
// 1. FINANCE SETTINGS (Singleton)
// ============================================================
export const financeSettingsAPI = {
  get: async (): Promise<FinanceSettings | null> => {
    try {
      const response = await api.get(`${FINANCE_API_BASE}/settings/`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw error;
    }
  },

  create: async (data: FinanceSettingsFormValues) => {
    // Hits POST /api/finance/settings/
    const response = await api.post(`${FINANCE_API_BASE}/settings/`, data);
    return response.data;
  },

  update: async (data: any) => {
    try {
      const response = await api.put(`${FINANCE_API_BASE}/settings/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};

// ============================================================
// 2. SCHOOL BANK DETAILS (Fixed to /bank-accounts/)
// ============================================================

export const bankDetailsAPI = {
  list: async (filters?: SchoolBankDetailListFilters): Promise<SchoolBankDetail[]> => {
    const response = await api.get(`${FINANCE_API_BASE}/bank-accounts/`, { params: filters });
    return response.data.data || response.data.results || [];
  },

  create: async (data: SchoolBankDetailFormValues): Promise<SchoolBankDetail> => {
    const response = await api.post(`${FINANCE_API_BASE}/bank-accounts/`, data);
    return response.data.data || response.data;
  },

  get: async (id: number): Promise<SchoolBankDetail> => {
    const response = await api.get(`${FINANCE_API_BASE}/bank-accounts/${id}/`);
    return response.data.data || response.data;
  },

  update: async (id: number, data: Partial<SchoolBankDetailFormValues>): Promise<SchoolBankDetail> => {
    const response = await api.put(`${FINANCE_API_BASE}/bank-accounts/${id}/`, data);
    return response.data.data || response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${FINANCE_API_BASE}/bank-accounts/${id}/`);
  },

  /**
   * Manual balance correction for a specific Bank Account or Cash Vault
   */
  adjustBalance: async (
    id: number,
    payload: { adjustment_type: 'add' | 'subtract' | 'set'; amount: string; reason: string }
  ): Promise<SchoolBankDetail> => {
    const response = await api.post(`${FINANCE_API_BASE}/bank-accounts/${id}/adjust_balance/`, payload);
    return response.data.data || response.data;
  },

  /**
   * Manual balance correction targeting the user's active physical Cash Vault
   */
  adjustCashBalance: async (payload: {
    adjustment_type: 'add' | 'subtract' | 'set';
    amount: string;
    reason: string;
  }): Promise<{ vault_id: number; vault_name: string; current_balance: string }> => {
    const response = await api.post(`${FINANCE_API_BASE}/bank-accounts/adjust-cash/`, payload);
    return response.data.data || response.data;
  },

  /**
   * Internal transfers across Cash Vaults and Bank Accounts
   * Pass null/undefined for source_bank_id to withdraw from Cash Box to Bank
   * Pass null/undefined for destination_bank_id to withdraw from Bank to Cash Box
   */
  transferFunds: async (payload: {
    source_bank_id?: number | null;
    destination_bank_id?: number | null;
    amount: string;
    reason: string;
  }): Promise<{ detail: string }> => {
    const response = await api.post(`${FINANCE_API_BASE}/bank-accounts/transfer/`, payload);
    return response.data;
  },
};

// ============================================================
// 3. STUDENT WALLET FUNDING (Fixed to /student-fundings/)
// ============================================================

export const studentFundingAPI = {
  list: async (filters?: any): Promise<any> => {
    const response = await api.get(`${FINANCE_API_BASE}/student-fundings/`, { params: filters });
    return response.data;
  },

  create: async (data: any): Promise<any> => {
    const isFormData = data instanceof FormData;
    const response = await api.post(`${FINANCE_API_BASE}/student-fundings/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data || response.data;
  },

  get: async (id: number): Promise<any> => {
    const response = await api.get(`${FINANCE_API_BASE}/student-fundings/${id}/`);
    return response.data.data || response.data;
  },

  action: async (id: number, payload: { action: string; reason?: string }): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/student-fundings/${id}/${payload.action}/`, {
      reason: payload.reason,
    });
    return response.data;
  },

  confirm: async (id: number): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/student-fundings/${id}/confirm/`, {});
    return response.data;
  },

  decline: async (id: number, payload: { reason: string }): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/student-fundings/${id}/decline/`, payload);
    return response.data;
  },

  revert: async (id: number, payload: { reason: string }): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/student-fundings/${id}/revert/`, payload);
    return response.data;
  },
};

// ============================================================
// 4. STAFF WALLET FUNDING (Fixed to /staff-fundings/)
// ============================================================


export const staffFundingAPI = {
  list: async (filters?: any): Promise<any> => {
    const response = await api.get(`${FINANCE_API_BASE}/staff-fundings/`, { params: filters });
    return response.data;
  },

  create: async (data: any): Promise<any> => {
    const isFormData = data instanceof FormData;
    const response = await api.post(`${FINANCE_API_BASE}/staff-fundings/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data || response.data;
  },

  get: async (id: number): Promise<any> => {
    const response = await api.get(`${FINANCE_API_BASE}/staff-fundings/${id}/`);
    return response.data.data || response.data;
  },

  action: async (id: number, payload: { action: string; reason?: string }): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/staff-fundings/${id}/${payload.action}/`, {
      reason: payload.reason,
    });
    return response.data;
  },

  confirm: async (id: number): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/staff-fundings/${id}/confirm/`, {});
    return response.data;
  },

  decline: async (id: number, payload: { reason: string }): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/staff-fundings/${id}/decline/`, payload);
    return response.data;
  },

  revert: async (id: number, payload: { reason: string }): Promise<any> => {
    const response = await api.post(`${FINANCE_API_BASE}/staff-fundings/${id}/revert/`, payload);
    return response.data;
  },
};

// ==================== WALLET TRANSFERS API ====================
export const walletTransferAPI = {
  list: async (params?: WalletTransferListFilters): Promise<WalletTransferListResponse> => {
    const response = await api.get(`${FINANCE_API_BASE}/wallet-transfers/`, { params });
    return response.data;
  },
  get: async (id: number): Promise<WalletTransfer> => {
    const response = await api.get(`${FINANCE_API_BASE}/wallet-transfers/${id}/`);
    return response.data;
  },
  create: async (data: WalletTransferFormValues): Promise<WalletTransfer> => {
    const response = await api.post(`${FINANCE_API_BASE}/wallet-transfers/`, data);
    return response.data;
  },
  confirm: async (id: number): Promise<WalletTransfer> => {
    const response = await api.post(`${FINANCE_API_BASE}/wallet-transfers/${id}/confirm/`);
    return response.data;
  },
  decline: async (id: number, reason: string): Promise<{ detail: string }> => {
    const response = await api.post(`${FINANCE_API_BASE}/wallet-transfers/${id}/decline/`, { reason });
    return response.data;
  },
  revert: async (id: number, reason: string): Promise<WalletTransfer> => {
    const response = await api.post(`${FINANCE_API_BASE}/wallet-transfers/${id}/revert/`, { reason });
    return response.data;
  },
};

// ============================================================
// 13. AUDIT LEDGERS (New Additions for Read-Only Views)
// ============================================================

export const auditLedgersAPI = {
  getBankLedger: async (params?: any) => {
    const response = await api.get(`${FINANCE_API_BASE}/bank-ledger/`, { params });
    return response.data;
  },
  getStudentWalletLedger: async (params?: any) => {
    const response = await api.get(`${FINANCE_API_BASE}/student-wallet-ledger/`, { params });
    return response.data;
  },
  getStaffWalletLedger: async (params?: any) => {
    const response = await api.get(`${FINANCE_API_BASE}/staff-wallet-ledger/`, { params });
    return response.data;
  },
};


// ==================== SELF-SERVICE MY FUNDING API ====================

export const myFundingAPI = {
  /**
   * Fetch logged-in staff member's profile, live wallet balance, and funding history.
   * Hits: GET /api/finance/my-funding/staff/
   */
  getStaffFunding: async (params?: MyFundingListParams) => {
    try {
      const response = await api.get(`${FINANCE_API_BASE}/my-funding/staff/`, { params });
      // Returns the unwrapped data payload (handles DRF paginated or custom envelope structures)
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /**
   * Fetch logged-in student/ward funding history.
   * Hits: GET /api/finance/my-funding/student/
   */
  getStudentFunding: async (params?: MyFundingListParams) => {
    try {
      const response = await api.get(`${FINANCE_API_BASE}/my-funding/student/`, { params });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

// ============================================================
// 5. INCOME CATEGORIES
// ============================================================

export const incomeCategoriesAPI = {
  /**
   * List all income categories
   */
   list: async (params?: any): Promise<any> => {
    try {
      const response = await api.get(`${FINANCE_API_BASE}/income-categories/`, { params });
      // ─── RETURN THE FULL DATA OBJECT, DON'T STRIP IT ───
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Create a new income category
   */
  create: async (data: IncomeCategoryFormValues): Promise<IncomeCategory> => {
    try {
      const response = await api.post(`${FINANCE_API_BASE}/income-categories/`, data);
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Get income category by ID
   */
  get: async (id: number): Promise<IncomeCategory> => {
    try {
      const response = await api.get(`${FINANCE_API_BASE}/income-categories/${id}/`);
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Update income category
   */
  update: async (id: number, data: Partial<IncomeCategoryFormValues>): Promise<IncomeCategory> => {
    try {
      const response = await api.put(`${FINANCE_API_BASE}/income-categories/${id}/`, data);
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Delete income category
   */
  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`${FINANCE_API_BASE}/income-categories/${id}/`);
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};

// ============================================================
// 6. INCOME RECORDS
// ============================================================

export const incomeAPI = {
  /**
   * List income records with pagination and filters
   */
  list: async (filters?: IncomeListFilters): Promise<any> => {
    const response = await api.get(`${FINANCE_API_BASE}/incomes/`, { params: filters });
    return response.data;
  },

  /**
   * Create a new income record
   */
  create: async (data: IncomeFormValues | FormData): Promise<Income> => {
    const isFormData = data instanceof FormData;
    const response = await api.post(`${FINANCE_API_BASE}/incomes/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data || response.data;
  },

  /**
   * Get income record by ID
   */
  get: async (id: number): Promise<Income> => {
    const response = await api.get(`${FINANCE_API_BASE}/incomes/${id}/`);
    return response.data.data || response.data;
  },

  /**
   * Update income record
   */
  update: async (id: number, data: Partial<IncomeFormValues> | FormData): Promise<Income> => {
    const isFormData = data instanceof FormData;
    const response = await api.put(`${FINANCE_API_BASE}/incomes/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data || response.data;
  },

  /**
   * Delete income record
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${FINANCE_API_BASE}/incomes/${id}/`);
  },
};

// ============================================================
// 7. EXPENSE CATEGORIES
// ============================================================

export const expenseCategoriesAPI = {
  /**
   * List all expense categories
   */
  list: async (params?: any): Promise<any> => {
    try {
      // 1. Pass the params to the GET request
      const response = await api.get(`${FINANCE_API_BASE}/expense-categories/`, { params });

      // 2. Return the FULL response data (so React can see response.count and response.results)
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Create a new expense category
   */
  create: async (data: ExpenseCategoryFormValues): Promise<ExpenseCategory> => {
    try {
      const response = await api.post(`${FINANCE_API_BASE}/expense-categories/`, data);
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Get expense category by ID
   */
  get: async (id: number): Promise<ExpenseCategory> => {
    try {
      const response = await api.get(`${FINANCE_API_BASE}/expense-categories/${id}/`);
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Update expense category
   */
  update: async (id: number, data: Partial<ExpenseCategoryFormValues>): Promise<ExpenseCategory> => {
    try {
      const response = await api.put(`${FINANCE_API_BASE}/expense-categories/${id}/`, data);
      return response.data?.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Delete expense category
   */
  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`${FINANCE_API_BASE}/expense-categories/${id}/`);
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
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
    const response = await api.get(`${FINANCE_API_BASE}/expenses/`, { params: filters });
    return response.data.results || response.data || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new expense record
   */
  create: async (data: ExpenseFormValues | FormData): Promise<Expense> => {
    const isFormData = data instanceof FormData;
    const response = await api.post(`${FINANCE_API_BASE}/expenses/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data.data || response.data;
  },

  /**
   * Get expense record by ID
   */
  get: async (id: number): Promise<Expense> => {
    const response = await api.get(`${FINANCE_API_BASE}/expenses/${id}/`);
    return response.data.data || response.data;
  },

  /**
   * Update expense record
   */
  update: async (id: number, data: Partial<ExpenseFormValues> | FormData | any): Promise<Expense> => {
    const isFormData = data instanceof FormData;
    // Changed api.put to api.patch:
    const response = await api.patch(`${FINANCE_API_BASE}/expenses/${id}/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
    });
    return response.data?.data || response.data;
  },

  /**
   * Delete expense record
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${FINANCE_API_BASE}/expenses/${id}/`);
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
    const response = await api.get(`${FINANCE_API_BASE}/supplier-payments/`, { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new supplier payment
   */
  create: async (data: SupplierPaymentFormValues): Promise<SupplierPayment> => {
    const response = await api.post(`${FINANCE_API_BASE}/supplier-payments/`, data);
    return response.data.data;
  },

  /**
   * Get supplier payment by ID
   */
  get: async (id: number): Promise<SupplierPayment> => {
    const response = await api.get(`${FINANCE_API_BASE}/supplier-payments/${id}/`);
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
    const response = await api.get(`${FINANCE_API_BASE}/advance-payments/`, { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new purchase advance payment
   */
  create: async (data: PurchaseAdvancePaymentFormValues): Promise<PurchaseAdvancePayment> => {
    const response = await api.post(`${FINANCE_API_BASE}/advance-payments/`, data);
    return response.data.data;
  },

  /**
   * Get purchase advance payment by ID
   */
  get: async (id: number): Promise<PurchaseAdvancePayment> => {
    const response = await api.get(`${FINANCE_API_BASE}/advance-payments/${id}/`);
    return response.data.data;
  },
};

// ============================================================
// 11. ADVANCE SETTLEMENTS
// ============================================================

export const advanceSettlementsAPI = {
  /**
   * List advance settlements with pagination and filters
   */
  list: async (filters?: AdvanceSettlementListFilters): Promise<PaginatedResponse<AdvanceSettlement>> => {
    const response = await api.get(`${FINANCE_API_BASE}/advance-settlements/`, { params: filters });
    return response.data.results || { count: 0, next: null, previous: null, results: [] };
  },

  /**
   * Create a new advance settlement
   */
  create: async (data: AdvanceSettlementFormValues): Promise<AdvanceSettlement> => {
    const response = await api.post(`${FINANCE_API_BASE}/advance-settlements/`, data);
    return response.data.data;
  },

  /**
   * Get advance settlement by ID
   */
  get: async (id: number): Promise<AdvanceSettlement> => {
    const response = await api.get(`${FINANCE_API_BASE}/advance-settlements/${id}/`);
    return response.data.data;
  },

  /**
   * Update advance settlement
   */
  update: async (id: number, data: Partial<AdvanceSettlementFormValues>): Promise<AdvanceSettlement> => {
    const response = await api.put(`${FINANCE_API_BASE}/advance-settlements/${id}/`, data);
    return response.data.data;
  },

  /**
   * Delete advance settlement
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`${FINANCE_API_BASE}/advance-settlements/${id}/`);
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
    const response = await api.get(`${FINANCE_API_BASE}/dashboard/stats/`, { params });
    return response.data.data;
  },
};


// ============================================================
// 14. PAYMENT GATEWAY CONFIGURATIONS
// ============================================================

export const gatewayAPI = {
  /**
   * List all institutional payment gateways
   */
  list: async (): Promise<PaymentGatewayConfig[]> => {
    const response = await api.get(`${FINANCE_API_BASE}/gateways/`);
    return response.data.data || response.data.results || response.data || [];
  },

  /**
   * Register a new payment gateway provider
   */
  create: async (data: any): Promise<PaymentGatewayConfig> => {
    try {
      const response = await api.post(`${FINANCE_API_BASE}/gateways/`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Get specific gateway details by ID
   */
  get: async (id: number): Promise<PaymentGatewayConfig> => {
    const response = await api.get(`${FINANCE_API_BASE}/gateways/${id}/`);
    return response.data.data || response.data;
  },

  /**
   * Update existing gateway configuration
   */
  update: async (id: number, data: any): Promise<PaymentGatewayConfig> => {
    try {
      const response = await api.put(`${FINANCE_API_BASE}/gateways/${id}/`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Delete gateway configuration
   */
  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`${FINANCE_API_BASE}/gateways/${id}/`);
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Set specific gateway as the institutional default
   */
  setDefault: async (id: number): Promise<PaymentGatewayConfig> => {
    try {
      const response = await api.post(`${FINANCE_API_BASE}/gateways/${id}/set-default/`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};


// ============================================================
// 15. ONLINE PAYMENT TRANSACTIONS (Paystack / Flutterwave Initiate)
// ============================================================
export const onlinePaymentAPI = {
  /**
   * List online payment audit trail
   */
  list: async (params?: any) => {
    const response = await api.get(`${FINANCE_API_BASE}/online-transactions/`, { params });
    return response.data.results || response.data;
  },

  /**
   * Initiate online checkout session
   */
  initiate: async (payload: {
    payment_type: 'student_funding' | 'staff_funding';
    payment_id: number;
    amount: string | number;
    email?: string; // <-- Added to allow frontend email overrides/fallbacks
  }) => {
    try {
      const response = await api.post(`${FINANCE_API_BASE}/online-transactions/initiate/`, payload);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  /**
   * Synchronously verify a transaction reference with the payment gateway
   */
  verifyLive: async (reference: string) => {
    try {
      const response = await api.post(`${FINANCE_API_BASE}/online-transactions/verify-live/`, { reference });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};

// Add this to your api.ts file (e.g., inside financeAPI or as a standalone export)
export const walletAdminAPI = {
  withdrawFunds: async (payload: { student_id: number; amount: string; wallet_type: string; bank_account_id: number; reason: string; }) => {
    const res = await api.post('/api/finance/wallets/withdraw/', payload);
    return res.data;
  },
  reconcileBalance: async (payload: { student_id: number; amount: string; wallet_type: string; action: string; reason: string; }) => {
    const res = await api.post('/api/finance/wallets/reconcile/', payload);
    return res.data;
  }
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
  gateways: gatewayAPI,
  onlinePayments: onlinePaymentAPI,
  auditLedgers: auditLedgersAPI,
  walletTransfer: walletTransferAPI,
  myFunding: myFundingAPI,
};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default financeAPI;