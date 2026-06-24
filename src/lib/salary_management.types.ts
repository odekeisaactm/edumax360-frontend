// salary_management.types.ts
// ====================================================================
// Salary Management - TypeScript definitions
// Matching the Django models, serializers, and API endpoints
// ====================================================================

import { Staff } from './hr.types';
import { AcademicSessionPeriodModel } from './academic.types';
import { User } from './index'; // adjust if needed

// ====================================================================
// ENUMS & CHOICES
// ====================================================================

export type SalaryRecordPaymentStatus =
  | 'not_processed'
  | 'pending'
  | 'paid'
  | 'partially_paid';

export type BonusType = 'staff' | 'volunteer';
export type BonusCategory =
  | 'vol_corp'
  | 'contractors'
  | 'staff_monthly'
  | 'transportation'
  | 'others';
export type BonusStatus = 'paid' | 'unpaid';

export type AdvanceStatus =
  | 'pending'
  | 'approved'
  | 'disbursed'
  | 'completed'
  | 'rejected';

export type LoanStatus =
  | 'pending'
  | 'approved'
  | 'disbursed'
  | 'completed'
  | 'rejected';

// ====================================================================
// MODEL TYPES
// ====================================================================

// ---------- StaffBankDetail ----------
export interface StaffBankDetail {
  id: number;
  staff: number | Staff;
  staff_name?: string; // read-only from serializer
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

// write payload: account_number is required on creation/update
export interface StaffBankDetailWrite {
  staff: number;
  bank_name: string;
  account_number: string; // plain text, encrypted on backend
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
  based_on?: string; // e.g., 'TOTAL' or component code
  based_on_type?: 'component' | 'additional_field';
  percentage?: number;
  fixed_amount?: number;
}

export interface TaxBracket {
  limit?: number | null; // null means unlimited
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

export interface AdditionalFieldConfig {
  // Not fully defined in model, but likely a JSON with field definitions
  [key: string]: any;
}

export interface SalarySetting {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  is_locked: boolean;
  effective_from: string; // date
  effective_to?: string | null;
  leave_allowance_percentage: string; // decimal
  basic_components: Record<string, BasicComponent>; // keyed by code
  allowances: AllowanceConfig[];
  include_leave_in_gross: boolean;
  reliefs_exemptions: ReliefConfig[];
  tax_brackets: TaxBracket[];
  income_items: any[]; // JSON list, maybe similar to allowances
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
  staff_name?: string; // read-only
  staff_detail: {
    id: number;
    staff_id: string;
    full_name: string;
    department_name: string | null;
    position_name: string | null;
  } | null;
  salary_setting: number | SalarySetting;
  salary_setting_name?: string; // read-only
  monthly_salary: string; // decimal
  additional_field_values: Record<string, any>;
  effective_from: string;
  effective_to?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  annual_salary?: string; // computed property
}

export interface SalaryStructureWrite {
  staff: number;
  salary_setting: number;
  monthly_salary: string | number;
  additional_field_values?: Record<string, any>;
  effective_from?: string;
  effective_to?: string | null;
  is_active?: boolean;
}

// ---------- SalaryRecord (Payslip) ----------
export interface BasicComponentBreakdown {
  name: string;
  percentage: number;
  amount: string; // decimal
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
  staff_id?: string; // read-only from serializer
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
  month_name?: string; // read-only
  academic_period?: number | AcademicSessionPeriodModel | null;
  monthly_salary: string;
  annual_salary: string;
  basic_components_breakdown: Record<string, BasicComponentBreakdown>;
  allowances_breakdown: Record<string, AllowanceBreakdown>;
  additional_income: Record<string, string>; // string decimal
  additional_field_values: Record<string, any>;
  bonus: string;
  total_income: string;
  gross_salary: string; // mapped from total_income in service
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
  notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: number | User | null;
  balance_due?: string; // computed property
}

// Write payload – most fields are read-only, but some can be updated (e.g., notes, payment status via action)
// For create/update via standard views, only some fields are writable (if any)
export interface SalaryRecordWrite {
  // Actually, most fields are read-only; only notes might be updatable
  notes?: string | null;
  // For creating, typically you use the process endpoint, not direct POST
}

// ---------- Bonus ----------
export interface Bonus {
  id: number;
  type: BonusType;
  category: BonusCategory;
  staff?: number | Staff | null;
  staff_name?: string; // read-only
  volunteer_name?: string | null;
  amount: string;
  month: number; // auto-set from due_date
  year: number;
  due_date: string;
  status: BonusStatus;
  academic_period?: number | AcademicSessionPeriodModel | null;
  notes?: string | null;
  created_by?: number | User | null;
  created_at: string;
  updated_at: string;
}

export interface BonusWrite {
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

// ---------- SalaryAdvance ----------
export interface SalaryAdvance {
  id: number;
  staff: number | Staff;
  staff_name?: string; // read-only
  amount: string;
  reason: string;
  request_date: string;
  status: AdvanceStatus;
  repaid_amount: string;
  academic_period?: number | AcademicSessionPeriodModel | null;
  approved_by?: number | User | null;
  approved_date?: string | null;
  created_at: string;
  balance?: string; // computed
}

export interface SalaryAdvanceWrite {
  staff: number;
  amount: string | number;
  reason: string;
  request_date?: string;
  academic_period?: number | null;
}

// For action (approve/reject/disburse)
export interface SalaryAdvanceActionPayload {
  action: 'approve' | 'reject' | 'disburse';
  // optionally add notes or amount adjustment?
}

// ---------- StaffLoan ----------
export interface StaffLoan {
  id: number;
  staff: number | Staff;
  staff_name?: string; // read-only
  amount: string;
  reason: string;
  repayment_plan?: string | null;
  request_date: string;
  status: LoanStatus;
  repaid_amount: string;
  academic_period?: number | AcademicSessionPeriodModel | null;
  approved_by?: number | User | null;
  approved_date?: string | null;
  created_at: string;
  balance?: string; // computed
}

export interface StaffLoanWrite {
  staff: number;
  amount: string | number;
  reason: string;
  repayment_plan?: string | null;
  request_date?: string;
  academic_period?: number | null;
}

// For action (approve/reject/disburse)
export interface StaffLoanActionPayload {
  action: 'approve' | 'reject' | 'disburse';
}

// ---------- StaffLoanRepayment ----------
export interface StaffLoanRepayment {
  id: number;
  staff: number | Staff;
  staff_name?: string; // read-only
  amount_paid: string;
  payment_date: string;
  academic_period?: number | AcademicSessionPeriodModel | null;
  created_at: string;
  created_by?: number | User | null;
}

export interface StaffLoanRepaymentWrite {
  staff: number; // path parameter? actually sent as staff_pk in URL
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
  payment_status?: SalaryRecordPaymentStatus;
  academic_period?: number;
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

export interface BonusListFilters {
  staff?: number;
  type?: BonusType;
  category?: BonusCategory;
  status?: BonusStatus;
  month?: number;
  year?: number;
  academic_period?: number;
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

// ====================================================================
// API REQUEST & RESPONSE TYPES
// ====================================================================

// Paginated responses (using common PaginatedResponse)
// import { PaginatedResponse } from './common.types'; // adjust if needed

// For the custom endpoints:

// Process Payroll
export interface ProcessPayrollPayload {
  month: number;
  year: number;
  staff_ids?: number[]; // if omitted, process all active staff
  bonus?: string | number;
  custom_deductions?: Record<string, string | number>;
  additional_income?: Record<string, string | number>;
  amount_paid?: string | number;
  academic_period?: number; // optional, will be auto-filled if not given?
}

export interface ProcessPayrollResponse {
  processed_count: number;
  created_count: number;
  updated_count: number;
  failed_staff_ids?: number[];
  message?: string;
}

// Mark Salary Paid
export interface MarkSalaryPaidPayload {
  amount_paid?: string | number; // if omitted, pays full net salary
  paid_date?: string;
  notes?: string;
}

export interface MarkSalaryPaidResponse {
  id: number;
  payment_status: SalaryRecordPaymentStatus;
  amount_paid: string;
  paid_date?: string;
  balance_due?: string;
}

// Mark Bonus Paid
export interface MarkBonusPaidPayload {
  // no extra fields, just POST to mark as paid
}

// Salary Advance Action
export interface SalaryAdvanceActionPayload {
  action: 'approve' | 'reject' | 'disburse';
  // maybe add notes? not in current view
}

// Staff Loan Action
export interface StaffLoanActionPayload {
  action: 'approve' | 'reject' | 'disburse';
}

// Record Loan Repayment (uses staff_pk in URL)
export interface RecordLoanRepaymentPayload {
  amount_paid: string | number;
  payment_date?: string;
  academic_period?: number | null;
}

// ====================================================================
// FORM VALUES (for React Hook Form / Formik)
// ====================================================================

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

// ====================================================================
// DASHBOARD / STATS (if needed)
// ====================================================================

export interface SalaryDashboardStats {
  total_staff_with_active_structure: number;
  pending_payroll_count: number;
  unpaid_salary_records: number;
  total_loan_balance: string;
  total_advance_balance: string;
  active_bonuses_unpaid: number;
  // etc.
}
