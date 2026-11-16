/**
 * Invoice Cart — flexible, audited edits to a student's invoice for any period
 * of the current session. Backed by /api/fee/invoices/cart/ (GET) and
 * /api/fee/invoices/cart/apply/ (POST).
 */
import api from './api';

export type CartTarget = 'student' | 'family';

export interface CartPeriod {
  id: number;
  name: string;
  order: number;
  is_current: boolean;
  has_invoice: boolean;
}

export interface CartInvoiceSummary {
  id: number;
  invoice_number: string;
  status: 'unpaid' | 'partially_paid' | 'paid' | string;
  total: string;
  discount: string;
  waived: string;
  paid: string;
  balance: string;
}

export interface CartItem {
  uid: string;
  target: CartTarget;
  id: number;
  fee_master_id: number;
  fee_id: number;
  fee_name: string;
  group_name: string;
  occurrence: 'periodic' | 'annually' | 'one_time' | string;
  description: string;
  amount: string;
  discount: string;
  waived: string;
  paid: string;
  balance: string;
  pending_waivers: number;
  removable: boolean;
  block_reason: string | null;
}

export interface CartCatalogEntry {
  fee_master_id: number;
  fee_id: number;
  fee_name: string;
  fee_code: string;
  group_name: string;
  occurrence: string;
  occurrence_label: string;
  target: CartTarget;
  in_scope: boolean;
  utility_ok: boolean;
  standard_amount: string | null;
  suggested_amount: string | null;
  price_source: 'period' | 'fee_period' | 'other_period' | 'none';
  price_note: string | null;
  warnings: string[];
  disabled_reason: string | null;
}

export interface CartHistoryEntry {
  id: number;
  action: 'add' | 'remove';
  target: CartTarget;
  description: string;
  amount: string;
  standard_amount: string | null;
  reason: string;
  notes: string[];
  period_name: string;
  by: string;
  at: string;
}

export interface InvoiceCart {
  student: {
    id: number;
    name: string;
    registration_number: string | null;
    class_name: string | null;
    section_name: string | null;
    has_parent: boolean;
    parent_name: string | null;
  };
  session: { id: number; label: string };
  periods: CartPeriod[];
  period: { id: number; name: string };
  editable: boolean;
  student_invoice: CartInvoiceSummary | null;
  family_invoice: CartInvoiceSummary | null;
  items: CartItem[];
  catalog: CartCatalogEntry[];
  history: CartHistoryEntry[];
}

export interface CartApplyPayload {
  student_id: number;
  period_id: number;
  reason: string;
  adds: { fee_master_id: number; amount: string }[];
  removes: { target: CartTarget; item_id: number }[];
}

function errorMessage(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
  }
  return err?.message || 'Something went wrong.';
}

export const invoiceCartAPI = {
  get: async (studentId: number, periodId?: number | null): Promise<InvoiceCart> => {
    try {
      const response = await api.get('/api/fee/invoices/cart/', {
        params: { student_id: studentId, ...(periodId ? { period_id: periodId } : {}) },
      });
      return response.data;
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  },
  apply: async (payload: CartApplyPayload): Promise<InvoiceCart> => {
    try {
      const response = await api.post('/api/fee/invoices/cart/apply/', payload);
      return response.data;
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  },
};
