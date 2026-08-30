// ==================== FINANCE MANAGEMENT TYPES ====================
import type { PaginatedResponse } from '@/lib/type';
export type { PaginatedResponse };

// ==================== CHOICE TYPES ====================

// General payment methods (used for expenses, supplier payments, etc.)
export type GeneralPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'others';

// Funding‑specific payment methods (for student/staff wallet top‑ups)
export type FundingPaymentMethod = 'cash' | 'pos' | 'bank_teller' | 'bank_transfer';

// Unified payment method (if you need a single type across the whole app)
export type PaymentMethod = GeneralPaymentMethod | FundingPaymentMethod;

export type FundingStatus = 'pending' | 'confirmed' | 'failed' | 'reverted' | 'declined';
export type WalletType = 'canteen' | 'fee';
export type FinancePaymentMode = 'offline' | 'online';
export type SupplierPaymentStatus = 'completed' | 'reverted';
export type BankPurpose = 'fee_payment' | 'wallet_funding' | 'both';
export type GatewayProvider = 'paystack' | 'flutterwave' | 'custom';
export type GatewayPurpose = 'fee_payment' | 'wallet_funding' | 'both';
export type GatewayStatus = 'initiated' | 'pending' | 'success' | 'failed' | 'abandoned';
export type BankTransactionDirection = 'credit' | 'debit';
export type AccountType = 'bank' | 'cash_vault';
export type AdjustmentType = 'add' | 'subtract' | 'set';
export type PurchaseAdvanceDirection = 'to_staff' | 'from_staff';
export type BankTransactionType =
  | 'opening_balance'
  | 'fee_payment'
  | 'family_payment'
  | 'income'
  | 'expense'
  | 'wallet_funding'
  | 'supplier_payment'
  | 'other_clearance'
  | 'bank_transfer'
  | 'manual_adjustment'
  | 'reversal';
export type WalletTransactionType =
  | 'funding'
  | 'fee_payment'
  | 'canteen_deduction'
  | 'transfer_out'
  | 'transfer_in'
  | 'refund'
  | 'adjustment';

// ==================== FINANCE SETTINGS ====================

export interface CurrencyConfig {
  base_currency: string; // e.g. 'NGN'
  supported_currencies: Record<
    string,
    {
      name: string;
      symbol: string;
      rate_to_base: number;
    }
  >;
}

export interface FinanceSettings {
  id?: number;
  allow_partial_payments: boolean;
  send_payment_receipt_email: boolean;
  currency_config: CurrencyConfig; // full JSON object
  strict_multi_currency: boolean;
  track_bank_balance: boolean;
  require_proof_for_funding: boolean;
  allow_inter_field_transfer: boolean;
  allow_sibling_transfer: boolean;
  auto_confirm_funding: boolean;
  max_funding_amount: string | null;
  voucher_prefix: string;
  reversal_window_hours?: number;
  notification_emails?: string[];
  default_expense_payment_method: GeneralPaymentMethod;
  updated_by: number | null;
  updated_by_name?: string; // from serializer
  updated_at: string;
}

export interface FinanceSettingsFormValues {
  allow_partial_payments: boolean;
  send_payment_receipt_email: boolean;
  currency_config: CurrencyConfig;
  strict_multi_currency: boolean;
  track_bank_balance: boolean;
  require_proof_for_funding: boolean;
  auto_confirm_funding: boolean;
  max_funding_amount: string | null;
  voucher_prefix: string;
  default_expense_payment_method: GeneralPaymentMethod;
}

// ==================== SCHOOL BANK DETAILS ====================

export interface SchoolBankDetail {
  id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  account_type: string;
  currency: string; // e.g. 'NGN'
  purpose: BankPurpose;
  purpose_display?: string; // from serializer
  opening_balance: string;
  current_balance: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolBankDetailFormValues {
  bank_name: string;
  account_number: string;
  account_name: string;
  currency: string;
  purpose: BankPurpose;
  account_type: AccountType;
  assigned_cashiers?: number[];
  opening_balance: string;
  is_active: boolean;
}

export interface SchoolBankDetailListFilters {
  is_active?: boolean;
  purpose?: BankPurpose;
  search?: string;
  account_type?: AccountType;
}

// ==================== STUDENT FUNDING ====================

export interface StudentFunding {
  id: number;
  student: number;
  student_detail?: any; // if you need full student object, otherwise use student_name
  student_name?: string;
  wallet_type: WalletType;
  amount: string;
  bank_account: number | null;
  bank_account_name?: string;
  foreign_currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  proof_of_payment: string | null; // URL string
  method: FundingPaymentMethod;
  mode: FinancePaymentMode;
  status: FundingStatus;
  academic_period: number | null;
  academic_period_name?: string | null;
  teller_number: string | null;
  decline_reason: string | null;
  reference: string | null;
  refund_reason: string | null;
  created_at: string;
  created_by: number | null;
  created_by_name?: string;
  reverted_by: number | null;
  reverted_by_name?: string;
  reverted_at: string | null;
}

export interface StudentFundingFormValues {
  student: number;
  wallet_type: WalletType;
  amount: string;
  bank_account: number | null;
  method: FundingPaymentMethod;
  mode: FinancePaymentMode;
  status: FundingStatus; // usually default 'pending'
  teller_number?: string;
  reference?: string;
  proof_of_payment?: File | string | null; // for upload
  foreign_currency?: string;
  foreign_amount?: string;
  exchange_rate?: string;
}

export interface StudentFundingListFilters {
  status?: FundingStatus;
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
  staff_detail?: any;
  staff_name?: string;
  amount: string;
  bank_account: number | null;
  bank_account_name?: string;
  foreign_currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  proof_of_payment: string | null;
  method: FundingPaymentMethod;
  mode: FinancePaymentMode;
  status: FundingStatus;
  academic_period: number | null;
  academic_period_name?: string | null;
  teller_number: string | null;
  decline_reason: string | null;
  reference: string | null;
  refund_reason: string | null;
  created_at: string;
  created_by: number | null;
  created_by_name?: string;
  reverted_by: number | null;
  reverted_by_name?: string;
  reverted_at: string | null;
}

export interface StaffFundingFormValues {
  staff: number;
  amount: string;
  bank_account: number | null;
  method: FundingPaymentMethod;
  mode: FinancePaymentMode;
  status: FundingStatus;
  teller_number?: string;
  reference?: string;
  proof_of_payment?: File | string | null;
  foreign_currency?: string;
  foreign_amount?: string;
  exchange_rate?: string;
}

export interface StaffFundingListFilters {
  status?: FundingStatus;
  staff_id?: number;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StaffFundingActionPayload {
  action: 'confirm' | 'decline' | 'revert';
  reason?: string;
}

// ==================== WALLET TRANSFERS ====================

export type WalletTransferType = 'cross_wallet' | 'sibling_transfer';

export interface WalletTransfer {
  id: number;
  transfer_type: WalletTransferType;
  transfer_type_display?: string;
  source_student: number;
  source_student_detail?: any; // Student object
  source_wallet_type: WalletType;
  destination_student: number;
  destination_student_detail?: any; // Student object
  destination_wallet_type: WalletType;
  amount: string;
  status: FundingStatus;
  status_display?: string;
  reference: string | null;
  reason: string | null;
  decline_reason: string | null;
  refund_reason: string | null;
  academic_period: number | null;
  created_at: string;
  created_by: number | null;
  created_by_name?: string;
  reverted_by: number | null;
  reverted_at: string | null;
}

export interface WalletTransferFormValues {
  transfer_type: WalletTransferType;
  source_student: number;
  source_wallet_type: WalletType;
  destination_student: number;
  destination_wallet_type: WalletType;
  amount: string;
  reason?: string;
}

export interface WalletTransferListFilters {
  transfer_type?: WalletTransferType;
  status?: FundingStatus;
  student_id?: number;
  source_wallet_type?: WalletType;
  destination_wallet_type?: WalletType;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface MyFundingListParams {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  student_id?: number; // Used by parents to filter specific wards
}

// ==================== INCOME CATEGORIES ====================

export interface IncomeCategory {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
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
  amount: string;
  payment_method?: string;
  foreign_currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  bank_account: number | null;
  bank_account_name?: string;
  income_date: string; // ISO date
  source: string | null;
  reference: string | null;
  receipt: string | null; // URL
  notes: string | null;
  academic_period: number | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  created_by_name?: string;
}

export interface IncomeFormValues {
  category: number;
  amount: string;
  payment_method?: GeneralPaymentMethod;
  foreign_currency?: string;
  foreign_amount?: string;
  exchange_rate?: string;
  bank_account?: number | null;
  income_date: string;
  source?: string;
  reference?: string;
  receipt?: File | string | null;
  notes?: string;
}

export interface IncomeListFilters {
  category?: number;
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
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: number | null;
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
  amount: string;
  foreign_currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  expense_date: string;
  payment_method: GeneralPaymentMethod;
  bank_account: number | null;
  bank_account_name?: string;
  name: string | null;
  reference: string | null;
  description: string | null;
  receipt: string | null;
  notes: string | null;
  line_items_json?: any;
  voucher_number: string;
  vote_and_subhead: string | null;
  line_items: Record<string, any>;
  prepared_by: number | null;
  prepared_by_name?: string;
  authorised_by: number | null;
  authorised_by_name?: string;
  collected_by: number | null;
  collected_by_name?: string;
  collected_by_other: string | null;
  cheque_number: string | null;
  bank_name: string | null;
  cheque_by: string | null;
  cheque_prepared_date: string | null;
  cheque_signed_date: string | null;
  academic_period: number | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  created_by_name?: string;
}

export interface ExpenseFormValues {
  category: number;
  amount: string;
  foreign_currency?: string;
  foreign_amount?: string;
  exchange_rate?: string;
  expense_date: string;
  payment_method: GeneralPaymentMethod;
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
  payment_method?: GeneralPaymentMethod;
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
  purchase_order: number | null;
  purchase_order_number?: string;
  amount: string;
  foreign_currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  bank_account: number | null;
  bank_account_name?: string;
  payment_date: string;
  payment_method: GeneralPaymentMethod;
  reference: string | null;
  receipt_number: string;
  notes: string | null;
  status: SupplierPaymentStatus;
  academic_period: number | null;
  created_at: string;
  created_by: number | null;
  created_by_name?: string;
}

export interface SupplierPaymentFormValues {
  supplier?: number;
  purchase_order: number;
  amount: string;
  foreign_currency?: string;
  foreign_amount?: string;
  exchange_rate?: string;
  bank_account?: number | null;
  payment_date: string;
  payment_method: GeneralPaymentMethod;
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
  amount: string;
  foreign_currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  bank_account: number | null;
  bank_account_name?: string;
  payment_date: string;
  payment_method: GeneralPaymentMethod;
  reference: string | null;
  voucher_number: string;
  direction: PurchaseAdvanceDirection;
direction_display?: string;
status: 'completed' | 'reverted';
status_display?: string;
  notes: string | null;
  academic_period: number | null;
  created_at: string;
  created_by: number | null;
  created_by_name?: string;
}

export interface PurchaseAdvancePaymentFormValues {
  advance: number;
  direction?: PurchaseAdvanceDirection;
  amount: string;
  foreign_currency?: string;
  foreign_amount?: string;
  exchange_rate?: string;
  bank_account?: number | null;
  payment_date: string;
  payment_method: GeneralPaymentMethod;
  reference?: string;
  notes?: string;
}

export interface PurchaseAdvancePaymentListFilters {
  advance?: number;
  payment_method?: GeneralPaymentMethod;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

/

// ==================== BANK & WALLET LEDGER ====================

export interface BankTransaction {
  id: number;
  bank_account: number | null; // null = cash box
  bank_account_detail?: SchoolBankDetail;
  transaction_type: BankTransactionType;
  transaction_type_display?: string;
  direction: BankTransactionDirection;
  direction_display?: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  foreign_currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  reference: string | null;
  reason: string | null;
  created_by: number | null;
  created_at: string;
  // Generic FK fields (not usually displayed)
  content_type?: number;
  object_id?: number;
}

export interface WalletTransaction {
  id: number;
  wallet: number;
  wallet_detail?: any; // StudentWalletModel
  transaction_type: WalletTransactionType;
  transaction_type_display?: string;
  wallet_field: 'fee' | 'canteen';
  wallet_field_display?: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  related_wallet: number | null;
  reason: string | null;
  reference: string | null;
  created_by: number | null;
  created_at: string;
}

// ==================== PAYMENT GATEWAY & ONLINE TRANSACTIONS ====================

export interface PaymentGatewayConfig {
  id: number;
  name: string;
  provider: GatewayProvider;
  provider_display?: string;
  purpose: GatewayPurpose;
  purpose_display?: string;
  public_key: string; // decrypted for display
  is_test_mode: boolean;
  is_active: boolean;
  is_default: boolean;
  webhook_url: string;
  webhook_secret: string | null; // usually masked
  default_settlement_bank: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentGatewayConfigFormValues {
  name: string;
  provider: GatewayProvider;
  purpose: GatewayPurpose;
  public_key: string;
  secret_key: string; // write‑only
  is_test_mode: boolean;
  is_active: boolean;
  is_default: boolean;
  webhook_secret?: string;
  default_settlement_bank?: number | null;
}

export interface OnlinePaymentTransaction {
  id: number;
  gateway: number;
  gateway_name?: string;
  bank_account: number | null;
  bank_account_detail?: SchoolBankDetail;
  gateway_reference: string;
  amount: string;
  currency: string;
  gateway_status: GatewayStatus;
  gateway_status_display?: string;
  gateway_response: Record<string, any>;
  initiated_at: string;
  completed_at: string | null;
  // Generic FK to the source object
  content_type?: number;
  object_id?: number;
}

// ==================== DASHBOARD ====================

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

export interface StaffWalletTransaction {
  id: number;
  wallet: number;
  staff_name?: string;
  transaction_type: 'funding' | 'deduction' | 'refund' | 'adjustment';
  transaction_type_display?: string;
  amount: string;
  balance_before: string;
  balance_after: string;
  reason: string | null;
  reference: string | null;
  created_by: number | null;
  created_at: string;
}


// ==================== FINANCE REPORTS ====================

export interface FinanceReportQueryParams {
  session_id?: string;
  period_id?: string;
  date_from?: string;   // YYYY-MM-DD
  date_to?: string;     // YYYY-MM-DD
  currency?: string;    // e.g. 'NGN', 'USD'
}

export interface DashboardKPIResponse {
  total_income: string;
  total_expenses: string;
  net_cash_position: string;
  bank_balances_total: string;
  outstanding_purchase_advances: string;
  monthly_trend: Array<{
    month: string;      // e.g. "Jan 2026"
    income: string;
    expense: string;
    net: string;
  }>;
  currency: string;
}

export interface IncomeSummaryGroup {
  name: string;
  amount: string;
  percentage: number;   // 0-100, can be decimal
}

export interface IncomeSummaryResponse {
  currency: string;
  total_income: string;
  groups: IncomeSummaryGroup[];
}

export interface ExpenseSummaryGroup {
  name: string;
  amount: string;
  percentage: number;
}

export interface ExpenseSummaryResponse {
  currency: string;
  total_expenses: string;
  groups: ExpenseSummaryGroup[];
}

export interface StatementLine {
  name: string;
  amount: string;
}

export interface IncomeExpenseStatementResponse {
  currency: string;
  revenue: StatementLine[];
  total_revenue: string;
  expenses: StatementLine[];
  total_expenses: string;
  net_income: string;
}

export interface CashFlowMonth {
  month: string;        // "YYYY-MM"
  inflow: string;
  outflow: string;
  net: string;
}

export interface CashFlowResponse {
  currency: string;
  months: CashFlowMonth[];
}

// ==================== API RESPONSE TYPES ====================

export type StudentFundingListResponse = PaginatedResponse<StudentFunding>;
export type StaffFundingListResponse = PaginatedResponse<StaffFunding>;
export type IncomeListResponse = PaginatedResponse<Income>;
export type ExpenseListResponse = PaginatedResponse<Expense>;
export type SupplierPaymentListResponse = PaginatedResponse<SupplierPayment>;
export type PurchaseAdvancePaymentListResponse = PaginatedResponse<PurchaseAdvancePayment>;
export type BankTransactionListResponse = PaginatedResponse<BankTransaction>;
export type WalletTransactionListResponse = PaginatedResponse<WalletTransaction>;
export type OnlinePaymentTransactionListResponse = PaginatedResponse<OnlinePaymentTransaction>;
export type PaymentGatewayConfigListResponse = PaginatedResponse<PaymentGatewayConfig>;
export type StaffWalletTransactionListResponse = PaginatedResponse<StaffWalletTransaction>;
export type WalletTransferListResponse = PaginatedResponse<WalletTransfer>;