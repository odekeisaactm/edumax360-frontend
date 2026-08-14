// src/lib/api/fee.service.ts

import api from './api';
import type {
  FeeGroup,
  Fee,
  FeeStructure,
  PeriodFeeAmount,
  FeeSetting,
  Discount,
  ClassDiscountTier,
  StudentDiscountEnrollment,
  DiscountApplication,
  StudentDiscount,
  FeeWaiver,
  InvoiceCorrectionBatch,
  Invoice,
  InvoiceItem,
  FamilyInvoice,
  OtherPayment,
  PaymentReceipt , FundingSource, Allocation,InvoicePaymentSummary,
  InvoiceGenerationJob,
  StudentFinancialDashboard,
  PaginatedLedgerResponse
} from '@/lib/fee.types';

// ============================================================
// BASE PATH VARIABLE
// ============================================================

const FEE_API_BASE = '/api/fee';

/**
 * Cleanly format backend Django REST Framework error structures
 */
const getDrfError = (error: any): string => {
  const data = error?.response?.data;
  if (data && typeof data === 'object') {
    if (data.detail) return String(data.detail);
    if (data.message) return String(data.message);
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
      return String(data.non_field_errors[0]);
    }

    // Format field-specific errors cleanly
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
// COMMON LIST FILTER INTERFACES
// ============================================================

export interface FeeListFilters {
  search?: string;
  occurrence?: string;
  parent_bound?: boolean;
}

export interface InvoiceListFilters {
  student?: number;
  parent?: number;
  session?: number;
  period?: number;
  status?: string;
  search?: string;
  page?: number;
}

export interface ReceiptListFilters {
  status?: string;
  external_payment_mode?: string;
  search?: string;
  page?: number;
}

export interface OtherPaymentListFilters {
  student?: number;
  session?: number;
  period?: number;
  status?: string;
  category?: string;
  search?: string;
}

// ============================================================
// 1. FEE GROUPS
// ============================================================

export const feeGroupsAPI = {
  list: async (search?: string): Promise<FeeGroup[]> => {
    const response = await api.get(`${FEE_API_BASE}/groups/`, { params: { search } });
    return response.data?.results || response.data || [];
  },

  create: async (data: { name: string; description?: string }): Promise<FeeGroup> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/groups/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  get: async (id: number): Promise<FeeGroup> => {
    const response = await api.get(`${FEE_API_BASE}/groups/${id}/`);
    return response.data;
  },

  update: async (id: number, data: Partial<FeeGroup>): Promise<FeeGroup> => {
    try {
      const response = await api.put(`${FEE_API_BASE}/groups/${id}/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${FEE_API_BASE}/groups/${id}/`);
  },
};

// ============================================================
// 2. FEES (PRICE LIST DEFINITIONS)
// ============================================================

export const feesAPI = {
  list: async (filters?: FeeListFilters): Promise<Fee[]> => {
    const response = await api.get(`${FEE_API_BASE}/fees/`, { params: filters });
    return response.data?.results || response.data || [];
  },

  create: async (data: Partial<Fee>): Promise<Fee> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/fees/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  get: async (id: number): Promise<Fee> => {
    const response = await api.get(`${FEE_API_BASE}/fees/${id}/`);
    return response.data;
  },

  update: async (id: number, data: Partial<Fee>): Promise<Fee> => {
    try {
      const response = await api.put(`${FEE_API_BASE}/fees/${id}/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${FEE_API_BASE}/fees/${id}/`);
  },
};

// ============================================================
// 3. FEE STRUCTURES (FEE MASTERS)
// ============================================================

export const feeStructuresAPI = {
  list: async (params?: { fee?: number; group?: number; search?: string }): Promise<FeeStructure[]> => {
    const response = await api.get(`${FEE_API_BASE}/structures/`, { params });
    return response.data?.results || response.data || [];
  },

  create: async (data: Partial<FeeStructure>): Promise<FeeStructure> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/structures/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  get: async (id: number): Promise<FeeStructure> => {
    const response = await api.get(`${FEE_API_BASE}/structures/${id}/`);
    return response.data;
  },

  update: async (id: number, data: Partial<FeeStructure>): Promise<FeeStructure> => {
    try {
      const response = await api.put(`${FEE_API_BASE}/structures/${id}/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${FEE_API_BASE}/structures/${id}/`);
  },

  setPeriodAmounts: async (id: number, amounts: { period: number; amount: string | number }[]): Promise<PeriodFeeAmount[]> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/structures/${id}/set-period-amounts/`, amounts);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
  simulate: async (data: { class_id: number; period_id: number; section_id?: number; discount_ids?: number[] }): Promise<any> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/structures/simulate/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};

// ============================================================
// 4. FEE SETTINGS (SINGLETON)
// ============================================================

export const feeSettingsAPI = {
  get: async (): Promise<FeeSetting | null> => {
    try {
      const response = await api.get(`${FEE_API_BASE}/settings/retrieve_settings/`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) return null;
      throw new Error(getDrfError(error));
    }
  },

  update: async (data: Partial<FeeSetting>): Promise<FeeSetting> => {
    try {
      const response = await api.patch(`${FEE_API_BASE}/settings/update_settings/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};

// ============================================================
// 5. DISCOUNTS & CONCESSION TIERS (OPTION A)
// ============================================================

export const discountsAPI = {
  list: async (params?: { search?: string; occurrence?: string; discount_type?: string }): Promise<Discount[]> => {
    const response = await api.get(`${FEE_API_BASE}/discounts/`, { params });
    return response.data?.results || response.data || [];
  },

  create: async (data: Partial<Discount>): Promise<Discount> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/discounts/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  get: async (id: number): Promise<Discount> => {
    const response = await api.get(`${FEE_API_BASE}/discounts/${id}/`);
    return response.data;
  },

  update: async (id: number, data: Partial<Discount>): Promise<Discount> => {
    try {
      const response = await api.put(`${FEE_API_BASE}/discounts/${id}/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${FEE_API_BASE}/discounts/${id}/`);
  },
};

export const discountTiersAPI = {
  list: async (params?: { discount?: number; student_class?: number }): Promise<ClassDiscountTier[]> => {
    const response = await api.get(`${FEE_API_BASE}/discount-tiers/`, { params });
    return response.data?.results || response.data || [];
  },

  create: async (data: { discount: number; student_class: number; tier_amount: string | number }): Promise<ClassDiscountTier> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/discount-tiers/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  update: async (id: number, data: Partial<ClassDiscountTier>): Promise<ClassDiscountTier> => {
    try {
      const response = await api.put(`${FEE_API_BASE}/discount-tiers/${id}/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${FEE_API_BASE}/discount-tiers/${id}/`);
  },
};

export const discountEnrollmentsAPI = {
  list: async (params?: { student?: number; discount?: number; is_active?: boolean; search?: string }): Promise<StudentDiscountEnrollment[]> => {
    const response = await api.get(`${FEE_API_BASE}/discount-enrollments/`, { params });
    return response.data?.results || response.data || [];
  },
  grouped: async (params?: any): Promise<any> => {
    const response = await api.get(`${FEE_API_BASE}/discount-enrollments/grouped/`, { params });
    return response.data;
  },
  create: async (data: { student_id: number; discount: number; is_active?: boolean }): Promise<StudentDiscountEnrollment> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/discount-enrollments/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  update: async (id: number, data: Partial<StudentDiscountEnrollment>): Promise<StudentDiscountEnrollment> => {
    try {
      const response = await api.put(`${FEE_API_BASE}/discount-enrollments/${id}/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  delete: async (id: number, params?: { remove_applied?: boolean }): Promise<void> => {
    await api.delete(`${FEE_API_BASE}/discount-enrollments/${id}/`, { params });
  },
};

export const discountApplicationsAPI = {
  list: async (params?: { session?: string | number; period?: string | number; discount?: string | number }) => {
    const response = await api.get(`${FEE_API_BASE}/discount-applications/`, { params });
    return response.data?.results || response.data || [];
  },
};

export const appliedDiscountsAPI = {
  // Used by Tab 3 (Flat student history)
  list: async (params?: any) => {
    const response = await api.get(`${FEE_API_BASE}/student-discounts/`, { params });
    return response.data?.results || response.data || [];
  },

  // Used by Tab 1 (Grouped and Paginated)
  grouped: async (params?: any) => {
    const response = await api.get(`${FEE_API_BASE}/student-discounts/grouped/`, { params });
    return response.data; // Return full response to keep .count for pagination
  },
};

// ============================================================
// 6. FEE WAIVERS
// ============================================================

export const feeWaiversAPI = {
  list: async (params?: { status?: string; invoice_item?: number; family_invoice_item?: number }): Promise<FeeWaiver[]> => {
    const response = await api.get(`${FEE_API_BASE}/waivers/`, { params });
    return response.data?.results || response.data || [];
  },

  create: async (data: { invoice_item?: number; family_invoice_item?: number; amount_waived: string | number; reason: string }): Promise<FeeWaiver> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/waivers/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

   getWaivableItems: async (studentId: number | string): Promise<any[]> => {
    try {
      const response = await api.get(`${FEE_API_BASE}/waivers/waivable-items/`, {
        params: { student_id: studentId }
      });
      return response.data?.items || response.data || [];
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  bulkCreate: async (payload: {
    requests: Array<{
      invoice_item_id?: number | null;
      family_invoice_item_id?: number | null;
      other_payment_id?: number | null;
      amount_waived: string | number;
      reason?: string;
    }>;
    global_reason?: string;
  }): Promise<any> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/waivers/bulk-create/`, payload);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  approve: async (id: number): Promise<FeeWaiver> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/waivers/${id}/approve/`);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  reject: async (id: number, rejection_reason: string): Promise<FeeWaiver> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/waivers/${id}/reject/`, { rejection_reason });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
    bulkApprove: async (ids: number[]): Promise<FeeWaiver[]> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/waivers/bulk-approve/`, { ids });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  bulkReject: async (ids: number[], rejection_reason: string): Promise<FeeWaiver[]> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/waivers/bulk-reject/`, { ids, rejection_reason });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};

// ============================================================
// 7. INVOICES (STUDENT & FAMILY)
// ============================================================

export const invoicesAPI = {
  list: async (filters?: InvoiceListFilters): Promise<any> => {
    const response = await api.get(`${FEE_API_BASE}/invoices/`, { params: filters });
    return response.data;
  },

  get: async (id: number): Promise<Invoice> => {
    const response = await api.get(`${FEE_API_BASE}/invoices/${id}/`);
    return response.data;
  },

  createManual: async (data: { student: number; session: number; period: number }): Promise<Invoice> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/invoices/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  generateSingle: async (data: { student_id: number; session_id: number; period_id: number }) => {
    try {
      const response = await api.post(`${FEE_API_BASE}/invoices/generate-single/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  void: async (id: number): Promise<Invoice> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/invoices/${id}/void/`);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
  listCorrectionBatches: async (params?: any) => {
    const response = await api.get(`${FEE_API_BASE}/invoice-correction-batches/`, { params });
    return response.data;
  },
  getCorrectionBatchDetails: async (id: number) => {
  const response = await api.get(`${FEE_API_BASE}/invoice-correction-batches/${id}/details/`);
  return response.data;
},

atomicRebill: async (data: {
  title: string;
  reason: string;
  execution_mode: string;
  student_invoice_ids: number[];
  family_invoice_ids: number[];
}) => {
  const response = await api.post(`${FEE_API_BASE}/invoice-correction-batches/atomic-rebill/`, data);
  return response.data;
},

getRebillStatus: async (batchId: number) => {
  const response = await api.get(`${FEE_API_BASE}/invoice-correction-batches/${batchId}/rebill-status/`);
  return response.data;
},

  getPendingStudents: async (params: { session_id: number; period_id: number }): Promise<{ count: number; students: any[] }> => {
    const response = await api.get(`${FEE_API_BASE}/invoices/pending-students/`, { params });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    try {
      await api.delete(`${FEE_API_BASE}/invoices/${id}/`);
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  addItem: async (data: { invoice_id: number; fee_master_id: number }): Promise<InvoiceItem> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/invoice-items/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  removeItem: async (itemId: number): Promise<void> => {
    try {
      await api.delete(`${FEE_API_BASE}/invoice-items/${itemId}/`);
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};

export const familyInvoicesAPI = {
  list: async (filters?: InvoiceListFilters): Promise<any> => {
    const response = await api.get(`${FEE_API_BASE}/family-invoices/`, { params: filters });
    return response.data;
  },

  get: async (id: number): Promise<FamilyInvoice> => {
    const response = await api.get(`${FEE_API_BASE}/family-invoices/${id}/`);
    return response.data;
  },

  void: async (id: number): Promise<FamilyInvoice> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/family-invoices/${id}/void/`);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};


// ============================================================
// 8. MASTER CHECKOUTS & RECEIPTS
// ============================================================

export const receiptsAPI = {
  list: async (filters?: ReceiptListFilters): Promise<any> => {
    const response = await api.get(`${FEE_API_BASE}/checkouts/`, { params: filters });
    return response.data;
  },

  listPending: async (): Promise<PaymentReceipt[]> => {
    const response = await api.get(`${FEE_API_BASE}/checkouts/pending/`);
    return response.data?.results || response.data || [];
  },

  getPosTerms: async (params: { parent_id?: number; student_id?: number }): Promise<any> => {
    const response = await api.get(`${FEE_API_BASE}/checkouts/pos-terms/`, { params });
    return response.data;
  },

  checkout: async (data: FormData | any): Promise<PaymentReceipt> => {
    const isFormData = data instanceof FormData;
    try {
      const response = await api.post(`${FEE_API_BASE}/checkouts/checkout/`, data, {
        headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  confirm: async (id: number, allocations: Allocation[]): Promise<PaymentReceipt> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/checkouts/${id}/confirm/`, { allocations });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  decline: async (id: number, reason: string): Promise<PaymentReceipt> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/checkouts/${id}/decline/`, { reason });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  revert: async (id: number, reason: string): Promise<PaymentReceipt> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/checkouts/${id}/revert/`, { reason });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  emailReceipt: async (id: number): Promise<{ detail: string }> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/checkouts/${id}/email_receipt/`);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
  getPublicBanks: async (params?: { purpose?: 'fee_payment' | 'wallet_funding' }): Promise<any[]> => {
    const response = await api.get(`${FEE_API_BASE}/public-banks/`, { params });
    return response.data;
  },

};


// ============================================================
// 9. ANCILLARY DEBTS & CLEARANCES
// ============================================================

export const otherPaymentsAPI = {
  list: async (filters?: OtherPaymentListFilters): Promise<OtherPayment[]> => {
    const response = await api.get(`${FEE_API_BASE}/other-payments/`, { params: filters });
    return response.data?.results || response.data || [];
  },

  create: async (data: Partial<OtherPayment>): Promise<OtherPayment> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/other-payments/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  update: async (id: number, data: Partial<OtherPayment>): Promise<OtherPayment> => {
    try {
      const response = await api.put(`${FEE_API_BASE}/other-payments/${id}/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`${FEE_API_BASE}/other-payments/${id}/`);
  },
};


// ============================================================
// 10. GENERATION JOBS & DASHBOARD
// ============================================================

export const generationJobsAPI = {
  list: async (params?: any): Promise<any> => {
    // 2. Pass the params in the Axios config object
    const response = await api.get(`${FEE_API_BASE}/generation-jobs/`, { params });
    // 3. Return the raw data so the UI can access response.data.results AND response.data.count
    return response.data;
  },

  start: async (data: { session_id: number; period_id: number; class_ids: number[] }): Promise<InvoiceGenerationJob> => {
    try {
      const response = await api.post(`${FEE_API_BASE}/generation-jobs/start/`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },

  getStatus: async (id: number): Promise<any> => {
    const response = await api.get(`${FEE_API_BASE}/generation-jobs/${id}/job_status/`);
    return response.data;
  },
};

export const studentDashboardAPI = {
  get: async (studentId: number, params?: { invoice_id?: number; session_id?: number; period_id?: number }): Promise<StudentFinancialDashboard> => {
    try {
      const response = await api.get(`${FEE_API_BASE}/students/${studentId}/dashboard/`, { params });
      return response.data;
    } catch (error: any) {
      throw new Error(getDrfError(error));
    }
  },
};


// ============================================================
// 11. BILLING LEDGER (STATEMENT OF ACCOUNT)
// ============================================================

export const billingLedgerAPI = {
 get: async (params: { session_id: number | string; period_id: number | string; mode?: string; page?: number; q?: string; parent_id?: number | string; student_id?: number | string; }): Promise<PaginatedLedgerResponse> => {
    const response = await api.get(`${FEE_API_BASE}/ledger/`, { params });
    return response.data;
  },

  bulkAction: async (payload: {
    action: 'send_reminders' | 'send_summaries';
    target_type: 'parent' | 'student';
    // Either explicit target_ids OR send_to_all=true with filter params
    target_ids?: number[];
    send_to_all?: boolean;
    session_id?: number;
    period_id?: number;
    class_id?: number;
    section_id?: number;
    debtors_only?: boolean;
    min_debt?: number;
  }): Promise<{ detail: string; recipient_count?: number }> => {
    const response = await api.post(`${FEE_API_BASE}/ledger/`, payload);
    return response.data;
  }
};

// ============================================================
// EXPORT ALL API SERVICES AS A SINGLE OBJECT
// ============================================================

export const feeAPI = {
  groups: feeGroupsAPI,
  fees: feesAPI,
  structures: feeStructuresAPI,
  settings: feeSettingsAPI,
  discounts: discountsAPI,
  discountTiers: discountTiersAPI,
  discountEnrollments: discountEnrollmentsAPI,
  discountApplications: discountApplicationsAPI,
  appliedDiscounts: appliedDiscountsAPI,
  waivers: feeWaiversAPI,
  invoices: invoicesAPI,
  familyInvoices: familyInvoicesAPI,
  receipts: receiptsAPI,
  otherPayments: otherPaymentsAPI,
  billingLedger: billingLedgerAPI,
  generationJobs: generationJobsAPI,
  studentDashboard: studentDashboardAPI,

};

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default feeAPI;