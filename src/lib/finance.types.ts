// ==================== FINANCE MANAGEMENT TYPES ====================
import type { PaginatedResponse } from '@/lib/type';
export type { PaginatedResponse };

// ==================== CHOICE TYPES ====================

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'reverted' | 'declined';
export type WalletType = 'canteen' | 'fee';
export type PaymentMethod = 'cash' | 'pos' | 'bank_teller' | 'bank_transfer' | 'card' | 'cheque' | 'dollar_pay' | 'others';
export type PaymentMode = 'offline' | 'online';
export type Currency = 'naira' | 'dollar';
export type SupplierPaymentStatus = 'completed' | 'reverted';
export type AdvanceSettlementType = 'refund' | 'payment';

// ==================== FINANCE SETTINGS ====================

export interface FinanceSettings {
  id?: number;
  allow_partial_payments: boolean;
  send_payment_receipt_email: boolean;
  // New settings from Task 1
  default_currency: Currency;
  require_proof_for_funding: boolean;
  auto_confirm_funding: boolean;
  max_funding_amount: string | null;  // DecimalField → string from DRF
  voucher_prefix: string;
  default_expense_payment_method: PaymentMethod;
  // Meta
  updated_by_name?: string;
  updated_by?: number | null;
  updated_at: string;
}

export interface FinanceSettingsFormValues {
  allow_partial_payments: boolean;
  send_payment_receipt_email: boolean;
  default_currency: Currency;
  require_proof_for_funding: boolean;
  auto_confirm_funding: boolean;
  max_funding_amount: string | null;
  voucher_prefix: string;
  default_expense_payment_method: PaymentMethod;
}

// ==================== SCHOOL BANK DETAILS ====================

export interface SchoolBankDetail {
  id: number;
  bank_name: string;
  account_number: string;  // Now plain, no encryption
  account_name: string;
  is_for_funding: boolean;
  is_for_fees: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolBankDetailFormValues {
  bank_name: string;
  account_number: string;
  account_name: string;
  is_for_funding: boolean;
  is_for_fees: boolean;
  is_active: boolean;
}

export interface SchoolBankDetailListFilters {
  is_active?: boolean;
  is_for_funding?: boolean;
  is_for_fees?: boolean;
  search?: string;
}

// ==================== STUDENT FUNDING ====================

export interface StudentFunding {
  id: number;
  student: number;
  student_name?: string;
  wallet_type: WalletType;
  amount: string;  // DecimalField → string
  proof_of_payment?: string | null;
  proof_of_payment_url?: string | null;
  method: PaymentMethod;
  mode: PaymentMode;
  status: PaymentStatus;
  academic_period?: number | null;
  academic_period_name?: string | null;
  teller_number?: string | null;
  decline_reason?: string | null;
  reference?: string | null;
  refund_reason?: string | null;
  created_at: string;
  created_by?: number | null;
  created_by_name?: string;
  reverted_by?: number | null;
  reverted_by_name?: string;
  reverted_at?: string | null;
}

export interface StudentFundingFormValues {
  student: number;
  wallet_type: WalletType;
  amount: string;
  proof_of_payment?: File | string | null;
  method: PaymentMethod;
  mode: PaymentMode;
  status: PaymentStatus;
  teller_number?: string;
  reference?: string;
}

export interface StudentFundingListFilters {
  status?: PaymentStatus;
  student_id?: number;
  wallet_type?: WalletType;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StudentFundingActionPayload {
  action: 'confirm' | 'decline' | 'revert';
  reason?: string;
}

// ==================== STAFF FUNDING ====================

export interface StaffFunding {
  id: number;
  staff: number;
  staff_name?: string;
  amount: string;  // DecimalField → string
  proof_of_payment?: string | null;
  proof_of_payment_url?: string | null;
  method: PaymentMethod;
  mode: PaymentMode;
  status: PaymentStatus;
  academic_period?: number | null;
  academic_period_name?: string | null;
  teller_number?: string | null;
  decline_reason?: string | null;
  reference?: string | null;
  refund_reason?: string | null;
  created_at: string;
  created_by?: number | null;
  created_by_name?: string;
  reverted_by?: number | null;
  reverted_by_name?: string;
  reverted_at?: string | null;
}

export interface StaffFundingFormValues {
  staff: number;
  amount: string;
  proof_of_payment?: File | string | null;
  method: PaymentMethod;
  mode: PaymentMode;
  status: PaymentStatus;
  teller_number?: string;
  reference?: string;
}

export interface StaffFundingListFilters {
  status?: PaymentStatus;
  staff_id?: number;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StaffFundingActionPayload {
  action: 'confirm' | 'decline' | 'revert';
  reason?: string;
}

// ==================== INCOME CATEGORIES ====================

export interface IncomeCategory {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  created_by?: number | null;
}

export interface IncomeCategoryFormValues {
  name: string;
  description?: string;
  is_active: boolean;
}

// ==================== INCOME ====================

export interface Income {
  id: number;
  category: number;
  category_name?: string;
  currency: Currency;
  description: string;
  amount: string;  // DecimalField → string
  bank_account?: number | null;
  bank_account_name?: string;
  income_date: string;  // Date → string
  source?: string | null;
  reference?: string | null;
  receipt?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  academic_period?: number | null;
  created_at: string;
  updated_at: string;
  created_by?: number | null;
  created_by_name?: string;
}

export interface IncomeFormValues {
  category: number;
  currency: Currency;
  description: string;
  amount: string;
  bank_account?: number | null;
  income_date: string;
  source?: string;
  reference?: string;
  receipt?: File | string | null;
  notes?: string;
}

export interface IncomeListFilters {
  category?: number;
  currency?: Currency;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ==================== EXPENSE CATEGORIES ====================

export interface ExpenseCategory {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  created_by?: number | null;
}

export interface ExpenseCategoryFormValues {
  name: string;
  description?: string;
  is_active: boolean;
}

// ==================== EXPENSE ====================

export interface Expense {
  id: number;
  category: number;
  category_name?: string;
  amount: string;  // DecimalField → string
  expense_date: string;  // Date → string
  payment_method: PaymentMethod;
  currency: Currency;
  bank_account?: number | null;
  bank_account_name?: string;
  name?: string | null;
  reference?: string | null;
  description?: string | null;
  receipt?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  voucher_number: string;
  vote_and_subhead?: string | null;
  line_items: Record<string, any>;  // JSONField
  prepared_by?: number | null;
  prepared_by_name?: string;
  authorised_by?: number | null;
  authorised_by_name?: string;
  collected_by?: number | null;
  collected_by_name?: string;
  collected_by_other?: string | null;
  cheque_number?: string | null;
  bank_name?: string | null;
  cheque_by?: string | null;
  cheque_prepared_date?: string | null;
  cheque_signed_date?: string | null;
  academic_period?: number | null;
  created_at: string;
  updated_at: string;
  created_by?: number | null;
  created_by_name?: string;
}

export interface ExpenseFormValues {
  category: number;
  amount: string;
  expense_date: string;
  payment_method: PaymentMethod;
  currency: Currency;
  bank_account?: number | null;
  name?: string;
  reference?: string;
  description?: string;
  receipt?: File | string | null;
  notes?: string;
  vote_and_subhead?: string;
  line_items?: Record<string, any>;
  prepared_by?: number;
  authorised_by?: number;
  collected_by?: number;
  collected_by_other?: string;
  cheque_number?: string;
  bank_name?: string;
  cheque_by?: string;
  cheque_prepared_date?: string;
  cheque_signed_date?: string;
}

export interface ExpenseListFilters {
  category?: number;
  payment_method?: PaymentMethod;
  currency?: Currency;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ==================== SUPPLIER PAYMENT ====================

export interface SupplierPayment {
  id: number;
  supplier: number;
  supplier_name?: string;
  purchase_orders: number[];  // Many-to-many IDs
  amount: string;  // DecimalField → string
  payment_date: string;  // Date → string
  payment_method: PaymentMethod;
  reference?: string | null;
  receipt_number: string;
  notes?: string | null;
  status: SupplierPaymentStatus;
  academic_period?: number | null;
  created_at: string;
  created_by?: number | null;
  created_by_name?: string;
}

export interface SupplierPaymentFormValues {
  supplier: number;
  purchase_orders?: number[];
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface SupplierPaymentListFilters {
  supplier?: number;
  status?: SupplierPaymentStatus;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ==================== PURCHASE ADVANCE PAYMENT ====================

export interface PurchaseAdvancePayment {
  id: number;
  advance: number;
  advance_number?: string;
  staff_name?: string;
  amount: string;  // DecimalField → string
  payment_date: string;  // Date → string
  payment_method: PaymentMethod;
  reference?: string | null;
  voucher_number: string;
  notes?: string | null;
  academic_period?: number | null;
  created_at: string;
  created_by?: number | null;
  created_by_name?: string;
}

export interface PurchaseAdvancePaymentFormValues {
  advance: number;
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface PurchaseAdvancePaymentListFilters {
  advance?: number;
  payment_method?: PaymentMethod;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ==================== ADVANCE SETTLEMENT ====================

export interface AdvanceSettlement {
  id: number;
  advance: number;
  advance_number?: string;
  staff_name?: string;
  settlement_type: AdvanceSettlementType;
  amount: string;  // DecimalField → string
  settlement_date: string;  // Date → string
  payment_method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  academic_period?: number | null;
  created_at: string;
  created_by?: number | null;
  created_by_name?: string;
}

export interface AdvanceSettlementFormValues {
  advance: number;
  settlement_type: AdvanceSettlementType;
  amount: string;
  settlement_date: string;
  payment_method: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface AdvanceSettlementListFilters {
  advance?: number;
  settlement_type?: AdvanceSettlementType;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ==================== FINANCIAL DASHBOARD ====================

export interface FinanceDashboardStats {
  total_income: string;
  total_expenses: string;
  net_profit: string;
  total_student_fundings: string;
  total_staff_fundings: string;
  pending_fundings: number;
  recent_transactions: number;
  income_by_category: Array<{
    category_name: string;
    total: string;
    percentage: number;
  }>;
  expenses_by_category: Array<{
    category_name: string;
    total: string;
    percentage: number;
  }>;
  monthly_trend: Array<{
    month: string;
    income: string;
    expenses: string;
  }>;
}

// ==================== API RESPONSE TYPES ====================

// Paginated Responses
export interface StudentFundingListResponse extends PaginatedResponse<StudentFunding> {}
export interface StaffFundingListResponse extends PaginatedResponse<StaffFunding> {}
export interface IncomeListResponse extends PaginatedResponse<Income> {}
export interface ExpenseListResponse extends PaginatedResponse<Expense> {}
export interface SupplierPaymentListResponse extends PaginatedResponse<SupplierPayment> {}
export interface PurchaseAdvancePaymentListResponse extends PaginatedResponse<PurchaseAdvancePayment> {}
export interface AdvanceSettlementListResponse extends PaginatedResponse<AdvanceSettlement> {}