// salary_management.types.ts
// ====================================================================
// Salary Management - TypeScript definitions
// Matching the Django models, serializers, and API endpoints
// ====================================================================

import { Staff, AcademicSessionPeriod, User } from './type';

// ====================================================================
// ENUMS & CHOICES
// ====================================================================

export type SalaryRecordPaymentStatus =
  | 'not_processed'
  | 'pending'
  | 'paid'
  | 'partially_paid';

export type BonusType = 'staff' | 'volunteer';
export type BonusStatus = 'paid' | 'unpaid';

export type AdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'completed' | 'rejected';
export type LoanStatus = 'pending' | 'approved' | 'disbursed' | 'completed' | 'rejected';

export type GlobalPasswordType = 'none' | 'staff_id' | 'mobile_last_4' | 'bank_account_last_4';
export type BatchStatus = 'pending' | 'in_progress' | 'success' | 'partial' | 'failure';


// ====================================================================
// MODEL TYPES
// ====================================================================

// ---------- SalaryGlobalSetting (Singleton) ----------
export interface SalaryGlobalSetting {
  id: number;
  allow_custom_overrides: boolean;
  require_payroll_approval: boolean;
  auto_deduct_loans: boolean;
  send_payslip_via_email: boolean;
  default_payslip_note?: string | null;
  payslip_password_protection: boolean;
  payslip_password_type: GlobalPasswordType;
  updated_by?: number | User | null;
  updated_at: string;
}

export interface SalaryGlobalSettingWrite {
  allow_custom_overrides?: boolean;
  require_payroll_approval?: boolean;
  auto_deduct_loans?: boolean;
  send_payslip_via_email?: boolean;
  default_payslip_note?: string | null;
  payslip_password_protection?: boolean;
  payslip_password_type?: GlobalPasswordType;
}

// ---------- StaffBankDetail ----------
export interface StaffBankDetail {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  bank_name: string;
  account_name: string;
  bank_code?: string | null;
  beneficiary_code?: string | null;
  branch_sort_code?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  account_number: string;
}

export interface StaffBankDetailWrite {
  staff: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  bank_code?: string | null;
  beneficiary_code?: string | null;
  branch_sort_code?: string | null;
  is_active?: boolean;
}

// ---------- SalarySetting ----------
export interface BasicComponent {
  code: string;
  name: string;
  percentage: number;
}

export interface AllowanceConfig {
  name: string;
  is_active?: boolean;
  calculation_type: 'percentage' | 'fixed' | 'combined';
  annual_only?: boolean;
  based_on?: string;
  based_on_type?: 'component' | 'additional_field';
  percentage?: number;
  fixed_amount?: number;
}

export interface TaxBracket {
  limit?: number | null;
  rate: number;
}

export interface ReliefConfig {
  name: string;
  is_active?: boolean;
  calculation_type: 'percentage' | 'fixed' | 'combined';
  based_on?: string;
  based_on_type?: 'component' | 'additional_field' | 'gross_income';
  percentage?: number;
  fixed_amount?: number;
}

export interface StatutoryDeductionConfig {
  name: string;
  is_active?: boolean;
  calculation_type: 'percentage' | 'fixed' | 'combined';
  based_on?: string;
  based_on_type?: 'component' | 'additional_field';
  percentage?: number;
  fixed_amount?: number;
}

export interface OtherDeductionConfig {
  name: string;
  linked_to?: 'staff_loan' | 'salary_advance' | null;
  display_rule?: 'show_if_filled' | 'always_show';
}

export interface SalarySetting {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  is_locked: boolean;
  effective_from: string;
  effective_to?: string | null;
  leave_allowance_percentage: string;
  basic_components: Record<string, BasicComponent>;
  allowances: AllowanceConfig[];
  include_leave_in_gross: boolean;
  reliefs_exemptions: ReliefConfig[];
  tax_brackets: TaxBracket[];
  income_items: any[];
  statutory_deductions: StatutoryDeductionConfig[];
  other_deductions_config: OtherDeductionConfig[];
  additional_fields: any[];
  created_by?: number | User | null;
  created_at: string;
  updated_at: string;
}

export interface SalarySettingWrite {
  name: string;
  description?: string | null;
  is_active?: boolean;
  effective_from?: string;
  effective_to?: string | null;
  leave_allowance_percentage?: string | number;
  basic_components?: Record<string, Partial<BasicComponent>>;
  allowances?: Partial<AllowanceConfig>[];
  include_leave_in_gross?: boolean;
  reliefs_exemptions?: Partial<ReliefConfig>[];
  tax_brackets?: TaxBracket[];
  income_items?: any[];
  statutory_deductions?: Partial<StatutoryDeductionConfig>[];
  other_deductions_config?: Partial<OtherDeductionConfig>[];
  additional_fields?: any[];
}

// ---------- SalaryStructure ----------
export interface SalaryStructure {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  staff_detail: {
    id: number;
    staff_id: string;
    full_name: string;
    department_name: string | null;
    position_name: string | null;
  } | null;
  salary_setting: number | SalarySetting;
  salary_setting_name?: string;
  monthly_salary: string;
  allowance_overrides: Record<string, number | string>;
  deduction_overrides: Record<string, number | string>;
  additional_field_values: Record<string, any>;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  annual_salary?: string;
}

export interface SalaryStructureWrite {
  staff: number;
  salary_setting: number;
  monthly_salary: string | number;
  allowance_overrides?: Record<string, number | string>;
  deduction_overrides?: Record<string, number | string>;
  additional_field_values?: Record<string, any>;
  effective_from?: string;
  effective_to?: string | null;
  is_active?: boolean;
}

export interface BulkChangeSettingPayload {
  target: 'all' | 'selected';
  ids?: number[];
  search?: string;
  salary_setting: number;
}

export interface BulkChangeSettingResult {
  updated: number;
  skipped: number;
}

// ---------- SalaryRecord (Payslip) ----------
export interface BasicComponentBreakdown {
  name: string;
  percentage: number;
  amount: string;
}

export interface AllowanceBreakdown {
  calculation_type: string;
  amount: string;
  annual_only?: boolean;
}

export interface StatutoryDeductionBreakdown {
  calculation_type: string;
  amount: string;
  based_on?: string;
  based_on_type?: string;
}

export interface OtherDeductionBreakdown {
  amount: string;
  linked_to?: string | null;
}

export interface SalaryRecord {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  staff_id?: string;
  staff_detail: {
    id: number;
    staff_id: string;
    full_name: string;
    department_name: string | null;
    position_name: string | null;
  } | null;
  salary_structure: number | SalaryStructure;
  salary_setting: number | SalarySetting;
  month: number;
  year: number;
  month_name?: string;
  academic_period?: number | AcademicSessionPeriod | null;
  monthly_salary: string;
  annual_salary: string;
  basic_components_breakdown: Record<string, BasicComponentBreakdown>;
  allowances_breakdown: Record<string, AllowanceBreakdown>;
  additional_income: Record<string, string>;
  additional_field_values: Record<string, any>;
  bonus: string;
  total_income: string;
  gross_salary: string;
  statutory_deductions: Record<string, StatutoryDeductionBreakdown>;
  total_statutory_deductions: string;
  other_deductions: Record<string, OtherDeductionBreakdown>;
  total_other_deductions: string;
  annual_gross_income: string;
  total_reliefs: string;
  taxable_income: string;
  annual_tax: string;
  monthly_tax: string;
  other_taxes: string;
  total_taxation: string;
  effective_tax_rate: string;
  net_salary: string;
  payment_status: SalaryRecordPaymentStatus;
  amount_paid: string;
  paid_date?: string | null;
  paid_by?: number | User | null;
  payslip_emailed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: number | User | null;
  balance_due?: string;
}

export interface SalaryRecordWrite {
  notes?: string | null;
}

// ---------- SalaryProcessingBatch (Async Tracker) ----------
export interface SalaryProcessingBatch {
  id: number;
  month: number;
  year: number;
  academic_period?: number | null;
  academic_period_name?: string;
  status: BatchStatus;
  status_display: string;
  total_targets: number;
  processed_targets: number;
  failed_targets: number;
  execution_log: any[];
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_by?: number | null;
  created_by_name?: string;
  created_at: string;
}

// ---------- Bonus Category ----------
export interface BonusCategory {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  bonus_count: number;
  created_by?: number | User | null;
  created_at: string;
  updated_at: string;
}

export interface BonusCategoryWrite {
  name: string;
  code?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

// ---------- Bonus ----------
export interface Bonus {
  id: number;
  type: 'staff' | 'volunteer';
  category: number | BonusCategory;
  staff?: number | any | null;
  staff_name?: string;
  staff_detail?: any;
  volunteer_name?: string | null;
  amount: string;
  month: number;
  year: number;
  due_date: string;
  status: 'paid' | 'unpaid';
  academic_period?: number | any | null;
  notes?: string | null;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface BonusWrite {
  type?: BonusType;
  category: number;
  staff?: number | null;
  volunteer_name?: string | null;
  amount: string | number;
  due_date?: string;
  status?: BonusStatus;
  academic_period?: number | null;
  notes?: string | null;
}

// ---------- SalaryAdvance ----------
export interface SalaryAdvance {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  amount: string;
  reason: string;
  request_date: string;
  status: AdvanceStatus;
  repaid_amount: string;
  academic_period?: number | AcademicSessionPeriod | null;
  approved_by?: number | User | null;
  approved_date?: string | null;
  created_at: string;
  balance?: string;
}

export interface SalaryAdvanceWrite {
  staff: number;
  amount: string | number;
  reason: string;
  request_date?: string;
  academic_period?: number | null;
}

// ---------- StaffLoan ----------
export interface StaffLoan {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  amount: string;
  reason: string;
  repayment_plan?: string | null;
  request_date: string;
  status: LoanStatus;
  repaid_amount: string;
  academic_period?: number | AcademicSessionPeriod | null;
  approved_by?: number | User | null;
  approved_date?: string | null;
  created_at: string;
  balance?: string;
}

export interface StaffLoanWrite {
  staff: number;
  amount: string | number;
  reason: string;
  repayment_plan?: string | null;
  request_date?: string;
  academic_period?: number | null;
}

// ---------- StaffLoanRepayment ----------
export interface StaffLoanRepayment {
  id: number;
  staff: number | Staff;
  staff_name?: string;
  amount_paid: string;
  payment_date: string;
  academic_period?: number | AcademicSessionPeriod | null;
  created_at: string;
  created_by?: number | User | null;
}

export interface StaffLoanRepaymentWrite {
  staff: number;
  amount_paid: string | number;
  payment_date?: string;
  academic_period?: number | null;
}

// ====================================================================
// FILTERS & PAGINATION
// ====================================================================

export interface SalaryRecordListFilters {
  staff?: number;
  month?: number;
  year?: number;
  from_month?: number;
  from_year?: number;
  to_month?: number;
  to_year?: number;
  academic_period?: number;
  session?: number;
  payment_status?: SalaryRecordPaymentStatus;
  search?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface SalaryStructureListFilters {
  staff?: number;
  is_active?: boolean;
  salary_setting?: number;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface SalaryAdvanceListFilters {
  staff?: number;
  status?: AdvanceStatus;
  academic_period?: number;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StaffLoanListFilters {
  staff?: number;
  status?: LoanStatus;
  academic_period?: number;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StaffBankDetailListFilters {
  staff?: number;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface BonusListFilters {
  month?: number;
  year?: number;
  from_month?: number;
  from_year?: number;
  to_month?: number;
  to_year?: number;
  status?: string;
  search?: string;
  academic_period?: number;
  session?: number;
  staff_id?: number;
  category?: number;
  page?: number;
  page_size?: number;
}

// ====================================================================
// API REQUEST & RESPONSE TYPES
// ====================================================================

export interface ProcessPayrollRecordPayload {
  structure_id: number;
  month: number;
  year: number;
  bonus?: string | number;
  custom_deductions?: Record<string, string | number>;
  additional_income?: Record<string, string | number>;
  amount_paid?: string | number;
  academic_period?: number;
}

export interface MarkSalaryPaidPayload {
  record_ids: number[];
  amount_paid?: string | number;
  notes?: string;
}

export interface EmailPayslipsPayload {
  record_ids: number[];
  force_resend?: boolean;
}

export interface SalaryAdvanceActionPayload {
  action: 'approve' | 'reject' | 'disburse';
}

export interface StaffLoanActionPayload {
  action: 'approve' | 'reject' | 'disburse';
}

export interface RecordLoanRepaymentPayload {
  amount_paid: string | number;
  payment_date?: string;
  academic_period?: number | null;
}

// ====================================================================
// FORM VALUES (for React Hook Form / Formik)
// ====================================================================

export interface SalaryGlobalSettingFormValues {
  allow_custom_overrides: boolean;
  require_payroll_approval: boolean;
  auto_deduct_loans: boolean;
  send_payslip_via_email: boolean;
  default_payslip_note: string;
  payslip_password_protection: boolean;
  payslip_password_type: GlobalPasswordType;
}

export interface SalarySettingFormValues {
  name: string;
  description?: string;
  is_active?: boolean;
  effective_from?: string;
  effective_to?: string | null;
  leave_allowance_percentage?: string | number;
  basic_components?: Record<string, Partial<BasicComponent>>;
  allowances?: Partial<AllowanceConfig>[];
  include_leave_in_gross?: boolean;
  reliefs_exemptions?: Partial<ReliefConfig>[];
  tax_brackets?: TaxBracket[];
  income_items?: any[];
  statutory_deductions?: Partial<StatutoryDeductionConfig>[];
  other_deductions_config?: Partial<OtherDeductionConfig>[];
  additional_fields?: any[];
}

export interface SalaryStructureFormValues {
  staff: number;
  salary_setting: number;
  monthly_salary: string | number;
  allowance_overrides?: Record<string, number | string>;
  deduction_overrides?: Record<string, number | string>;
  additional_field_values?: Record<string, any>;
  effective_from?: string;
  effective_to?: string | null;
  is_active?: boolean;
}

export interface BonusFormValues {
  type?: BonusType;
  category?: BonusCategory;
  staff?: number | null;
  volunteer_name?: string | null;
  amount: string | number;
  due_date?: string;
  status?: BonusStatus;
  academic_period?: number | null;
  notes?: string | null;
}

export interface SalaryAdvanceFormValues {
  staff: number;
  amount: string | number;
  reason: string;
  request_date?: string;
  academic_period?: number | null;
}

export interface StaffLoanFormValues {
  staff: number;
  amount: string | number;
  reason: string;
  repayment_plan?: string;
  request_date?: string;
  academic_period?: number | null;
}

export interface StaffLoanRepaymentFormValues {
  amount_paid: string | number;
  payment_date?: string;
  academic_period?: number | null;
}

export interface StaffBankDetailFormValues {
  staff: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  bank_code?: string;
  beneficiary_code?: string;
  branch_sort_code?: string;
  is_active?: boolean;
}