// ==================== COMMON / MINI TYPES ====================

export interface MiniUser {
  id: number;
  username: string;
  full_name: string;
}

export interface MiniBankAccount {
  id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
}

// ==================== FEE MANAGEMENT ENUMS & UNIONS ====================

export type WalletField = 'fee' | 'canteen';
export type PaymentMode = 'cash' | 'bank_transfer' | 'bank_teller' | 'pos' | 'wallet' | 'online' | 'others';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'reverted';
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'void';
export type FeeOccurrence = 'periodic' | 'annually' | 'one_time';
export type DiscountType = 'percentage' | 'fixed';
export type DiscountOccurrence = 'periodic' | 'annually' | 'one_time';
export type WaiverStatus = 'pending' | 'approved' | 'rejected';
export type OtherPaymentCategory = 'historical' | 'fine' | 'damage' | 'other';
export type OtherPaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

// ==================== WALLET SNAPSHOTS ====================

export interface StudentWallet {
  id: number;
  student: number;
  student_name?: string;
  fee_balance: string;
  canteen_balance: string;
  updated_at?: string;
}

// ==================== FEE STRUCTURE ====================

export interface FeeGroup {
  id: number;
  name: string;
  description?: string;
  structure_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Fee {
  id: number;
  name: string;
  code: string;
  description?: string;
  occurrence: FeeOccurrence;
  occurrence_display?: string;
  payment_period?: number | null;
  payment_period_name?: string;
  required_utility?: number | null;
  required_utility_name?: string;
  is_protected?: boolean;
  parent_bound: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PeriodFeeAmount {
  id: number;
  period: number;
  period_name?: string;
  amount: string;
}

export interface FeeMasterScope {
  id?: number;
  student_class: number;
  class_section: number | null;
}

export interface FeeStructure {
  id: number;
  group: number;
  group_name?: string;
  fee: number;
  fee_name?: string;
  scopes: FeeMasterScope[];
  period_amounts: PeriodFeeAmount[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ==================== DISCOUNTS & CONCESSIONS (OPTION A) ====================

export interface ClassDiscountTier {
  id: number;
  discount: number;
  student_class: number;
  student_class_name?: string;
  tier_amount: string;
  created_at?: string;
  updated_at?: string;
}

export interface Discount {
  id: number;
  title: string;
  discount_type: DiscountType;
  discount_type_display?: string;
  amount?: string | null;
  occurrence: DiscountOccurrence;
  occurrence_display?: string;
  payment_period?: number | null;
  payment_period_name?: string;
  applicable_fees: number[];
  applicable_classes: number[];
  class_tiers?: ClassDiscountTier[];
  is_protected?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StudentDiscountEnrollment {
  id: number;
  student: number;
  student_name?: string;
  discount: number;
  discount_title?: string;
  is_active: boolean;
  created_at?: string;
}

export interface DiscountApplication {
  id: number;
  discount: number;
  discount_title?: string;
  session?: number | null;
  session_display?: string;
  period?: number | null;
  period_display?: string;
  discount_type: DiscountType;
  discount_amount: string;
  tier_snapshots?: Record<string, string>;
  created_at?: string;
}

export interface StudentDiscount {
  id: number;
  student: number;
  student_name?: string;
  discount_application: number;
  discount_title?: string;
  invoice_item?: number | null;
  family_invoice_item?: number | null;
  amount_discounted: string;
  created_at?: string;
}

// ==================== WAIVERS ====================

export interface FeeWaiver {
  id: number;
  invoice_item?: number | null;
  family_invoice_item?: number | null;
  item_description?: string;
  amount_waived: string;
  reason: string;
  status: WaiverStatus;
  status_display?: string;
  rejection_reason?: string | null;
  requested_by?: number | null;
  requested_by_name?: string;
  reviewed_by?: number | null;
  reviewed_by_name?: string;
  reviewed_at?: string | null;
  created_at?: string;
}

// ==================== INVOICING ====================

export interface InvoiceCorrectionBatch {
  id: number;
  reason: string;
  created_by?: number | null;
  created_by_name?: string;
  created_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice?: number;
  fee_master: number;
  description: string;
  amount: string;
  amount_paid: string;
  discounts_applied?: StudentDiscount[];
  waivers?: FeeWaiver[];
  total_discount: string;
  total_waived: string;
  amount_after_adjustments: string;
  balance: string;
}

export interface FamilyInvoiceItem {
  id: number;
  invoice?: number;
  fee_master: number;
  description: string;
  amount: string;
  amount_paid: string;
  discounts_applied?: StudentDiscount[];
  waivers?: FeeWaiver[];
  total_discount: string;
  total_waived: string;
  amount_after_adjustments: string;
  balance: string;
}

// Tiny interface for the new JSON history on invoices
export interface InvoicePaymentSummary {
  reference: string;
  date: string;
  total_amount: string;
}

export interface Invoice {
  id: number;
  student: number;
  student_name?: string;
  session: number;
  session_display?: string;
  period: number;
  period_display?: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  status_display?: string;
  items: InvoiceItem[];
  payments?: InvoicePaymentSummary[];
  total_amount: string;
  total_discount: string;
  total_waived: string;
  amount_after_adjustments?: string;
  amount_paid: string;
  balance: string;
  voided_at?: string | null;
  voided_by?: number | null;
  correction_batch?: number | null;
  created_at?: string;
}

export interface FamilyInvoice {
  id: number;
  parent: number;
  parent_name?: string;
  session: number;
  session_display?: string;
  period: number;
  period_display?: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  status_display?: string;
  items: FamilyInvoiceItem[];
  payments?: InvoicePaymentSummary[];
  total_amount: string;
  total_discount: string;
  total_waived: string;
  amount_after_adjustments?: string;
  amount_paid: string;
  balance: string;
  voided_at?: string | null;
  voided_by?: number | null;
  correction_batch?: number | null;
  created_at?: string;
}

// ==================== MASTER PAYMENTS (NEW ARCHITECTURE) ====================

export interface FundingSource {
  source_type: 'wallet' | 'external';
  wallet_student_id?: number | null;
  wallet_type?: 'fee' | null;
  amount: string;
}

export interface Allocation {
  target_type: 'invoice' | 'family_invoice' | 'ancillary_debt' | 'wallet_funding';
  target_id?: number | null;
  amount: string;
}

export interface PaymentReceipt {
  id: number;
  parent?: number | null;
  parent_name?: string;
  student?: number | null;
  student_name?: string;
  total_amount: string;
  external_payment_mode?: string | null;
  external_amount: string;
  bank_account?: number | null;
  bank_account_detail?: MiniBankAccount;
  proof_of_payment?: string | null;

  funding_sources: FundingSource[];
  allocations: Allocation[];

  date: string;
  reference: string;
  status: PaymentStatus;
  status_display?: string;
  notes?: string | null;

  confirmed_by?: number | null;
  confirmed_by_name?: string;
  confirmed_at?: string | null;
  reverted_by?: number | null;
  reverted_at?: string | null;
  reversal_reason?: string | null;
  created_at: string;
}

// ==================== ANCILLARY DEBTS & CLEARANCES ====================

export interface OtherPayment {
  id: number;
  student: number;
  session?: number | null;
  period?: number | null;
  description: string;
  category: OtherPaymentCategory;
  category_display?: string;
  amount: string;
  amount_paid: string;
  balance: string;
  status: OtherPaymentStatus;
  status_display?: string;
  notes?: string | null;
  created_at: string;
}
// Note: OtherPaymentClearance was deleted, as debts are now cleared via the Master Receipt Cart.

// ==================== DASHBOARD & JOBS ====================

export interface StudentFinancialDashboard {
  student_id: number;
  student_name: string;
  student_class: string;
  registration_number: string;
  current_invoice: Invoice | null;
  family_invoice: FamilyInvoice | null;
  family_fee_note: string;
  invoice_history: Invoice[];
  wallet: StudentWallet | null;
  other_payments_outstanding: OtherPayment[];
  total_outstanding: string;
}

export interface InvoiceGenerationJob {
  id: number;
  job_id: string;
  session: number;
  period: number;
  classes_to_invoice: number[];
  status: 'pending' | 'in_progress' | 'success' | 'partial' | 'failure';
  status_display?: string;
  is_complete?: boolean;
  total_students: number;
  processed_students: number;
  failed_students: number;
  progress_pct?: number;
  error_message?: string | null;
  created_by?: number | null;
  created_by_name?: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

// ==================== SETTINGS ====================

export interface FeeSetting {
  id: number;
  allow_partial_payments: boolean;
  minimum_online_payment_amount: string;
  online_payment_enabled: boolean;
  default_gateway?: number | null;
  online_payment_auto_confirm: boolean;
  allow_teller_upload: boolean;
  auto_generate_invoice_on_enrollment: boolean;
  invoice_due_days_after_period_start: number;
  enable_auto_reminder: boolean;
  reminder_start_days_after_invoice: number;
  reminder_interval_days: number;
  send_payment_receipt_email: boolean;
  send_invoice_whatsapp: boolean;
  whatsapp_bot_enabled: boolean;
  bot_allow_proof_upload: boolean;
  bot_send_receipt: boolean;
  updated_at?: string;
}

// ==================== BILLING LEDGER (STATEMENT OF ACCOUNT) ====================

export interface LedgerStudent {
  student_id: number;
  student_name: string;
  registration_number: string;
  class_name: string;
  invoice: Invoice | null;
  other_payments: OtherPayment[];
  student_total_outstanding: string;
}

export interface LedgerParent {
  parent_id: number;
  parent_name: string;
  phone: string;
  family_invoice: FamilyInvoice | null;
  students: LedgerStudent[];
  grand_total_outstanding: string;
}

export interface PaginatedLedgerResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: LedgerParent[];
}

// ==================== REPORTS & ANALYTICS (NEW) ====================

export interface CollectionReportRow {
  id: number;
  name: string;
  gross_billed: string | number;
  discounts: string | number;
  waivers: string | number;
  net_expected: string | number;
  paid: string | number;
  balance: string | number;
  pct_paid: number;
}

export interface DashboardKPIs {
  total_billed: string;
  total_discounts: string;
  net_expected: string;
  total_paid: string;
  total_outstanding: string;
  collection_rate: number;
}

export interface AgingBuckets {
  '0_30': string | number;
  '31_60': string | number;
  '61_90': string | number;
  '90_plus': string | number;
}

export interface PaymentTrend {
  date: string;
  amount: string | number;
}