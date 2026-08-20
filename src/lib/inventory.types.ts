// ============================================================
// INVENTORY APP TYPES
// ============================================================

// --- Enums & Unions ---

export type InventoryUnit = 'piece' | 'pack' | 'box' | 'kg' | 'carton';
export type InventoryLocationType = 'store' | 'shop' | 'generic';
export type StockInSource = 'purchase' | 'return' | 'adjustment' | 'transfer' | 'donation';
export type StockOutReason = 'staff_collection' | 'damage' | 'expired' | 'adjustment' | 'wastage' | 'transfer' | 'disbursement';
export type StockOutDepartment = 'cleaning' | 'drivers' | 'clinic' | 'admin' | 'cafeteria' | 'maintenance';
export type SalePaymentMethod = 'cash' | 'student_wallet' | 'staff_wallet' | 'pos';
export type SaleStatus = 'completed' | 'refunded';

export type PurchaseOrderStatus = 'draft' | 'submitted' | 'partially_received' | 'received' | 'cancelled';
export type PurchaseAdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'completed' | 'cancelled';
export type AssignmentGender = 'male' | 'female' | 'both';
export type BackgroundJobStatus = 'pending' | 'in_progress' | 'success' | 'failure';

// --- Base Configurations ---

export interface InventoryCategory {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: number | null;
}

export interface InventoryLocation {
  id: number;
  name: string;
  code: string;
  location_type: InventoryLocationType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventorySupplier {
  id: number;
  name: string;
  contact_person?: string | null;
  phone_number?: string | null;
  email?: string | null;
  address?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: number | null;
}

// --- Core Item & Location Tracking ---

export interface ItemLocationStock {
  id: number;
  location: number;
  location_name?: string;
  location_type?: InventoryLocationType;
  quantity: string;
}

export interface InventoryItem {
  id: number;
  category: number | InventoryCategory;
  category_name?: string;
  name: string;
  barcode?: string | null;
  unit: InventoryUnit;
  current_selling_price: string;
  reorder_level: string;
  is_active: boolean;

  // Denormalized total stock for fast list loading
  total_quantity: string;

  // Computed properties
  is_low_stock?: boolean;
  last_cost_price?: string;

  // Nested location stocks for detail view
  location_stocks?: ItemLocationStock[];

  created_at: string;
  updated_at: string;
  created_by?: number | null;
  created_by_name?: string | null;
}

// Lightweight for dropdowns/tables
export interface InventoryItemList {
  id: number;
  name: string;
  barcode?: string | null;
  category_name?: string;
  unit: InventoryUnit;
  current_selling_price: string;
  last_cost_price: string;
  location_quantity: number | null;
  total_quantity: string;
  is_low_stock?: boolean;
  is_active: boolean;
}

// --- Stock In ---

export interface StockInItem {
  id?: number;
  item: number;
  item_name?: string; // Read-only
  quantity_received: string;
  unit_cost: string;
  batch_number?: string | null;
  expiry_date?: string | null;
  line_total?: string; // Read-only
}

export interface StockIn {
  id: number;
  receipt_number: string;
  source: StockInSource;
  supplier?: number | InventorySupplier | null;
  supplier_name?: string | null;
  purchase_order?: number | null;
  date_received: string;
  location: number | InventoryLocation;
  location_name?: string;
  notes?: string | null;
  academic_period?: number | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  items: StockInItem[];
  total_cost?: string; // Read-only
}

// --- Stock Out ---

export interface StockOut {
  id: number;
  item: number;
  item_name?: string;
  location: number;
  location_name?: string;
  destination_location?: number | null;
  destination_location_name?: string | null;
  quantity_removed: string;
  unit_cost?: string;
  reason: StockOutReason;
  department?: StockOutDepartment | null;
  staff_recipient?: number | null;
  staff_recipient_name?: string | null;
  date_removed: string;
  notes?: string | null;
  academic_period?: number | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
}

// --- Stock Transfer ---

export interface StockTransferItem {
  id?: number;
  item: number;
  item_name?: string; // Read-only
  quantity: string;
}

export interface StockTransfer {
  id: number;
  receipt_number: string;
  from_location: number;
  from_location_name?: string;
  to_location: number;
  to_location_name?: string;
  transfer_date: string;
  notes?: string | null;
  academic_period?: number | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  items: StockTransferItem[];
}

// --- POS Sales ---

export interface SaleItem {
  id?: number;
  item: number;
  item_name?: string; // Read-only
  quantity: string;
  unit_price: string;
  unit_cost?: string; // Snapshot
  line_total?: string; // Read-only
  profit?: string; // Read-only
}

export interface Sale {
  id: number;
  transaction_id: string;
  sale_date: string;
  location: number | InventoryLocation;
  location_name?: string;
  customer?: number | null;
  customer_name?: string | null;
  staff_customer?: number | null;
  staff_customer_name?: string | null;
  discount: string;
  payment_method: SalePaymentMethod;
  status: SaleStatus;
  academic_period?: number | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_at: string;
  items: SaleItem[];
  subtotal?: string; // Read-only
  total_amount?: string; // Read-only
  idempotency_key?: string | null;
}

// --- Form Payloads (Frontend -> Backend) ---

export interface InventoryItemFormValues {
  category: number;
  name: string;
  barcode?: string;
  unit: InventoryUnit;
  current_selling_price: string;
  reorder_level: string;
  is_active: boolean;
  initial_stocks?: Array<{
    location_id: number;
    quantity: string;
  }>;
}

export interface StockInPayload {
  source: StockInSource;
  supplier?: number | null;
  location: number;
  date_received?: string;
  notes?: string;
  items: Array<{
    item: number;
    quantity_received: string;
    unit_cost: string;
    batch_number?: string | null;
    expiry_date?: string | null;
  }>;
  price_updates?: Array<{
    item_id: number;
    new_selling_price: string;
  }>;
}

export interface StockOutPayload {
  item: number;
  location: number;
  destination_location?: number | null;
  quantity_removed: string;
  reason: StockOutReason;
  department?: StockOutDepartment;
  staff_recipient?: number;
  notes?: string;
}

export interface StockTransferPayload {
  from_location: number;
  to_location: number;
  notes?: string;
  items: Array<{
    item: number;
    quantity: string;
  }>;
}

export interface SalePayload {
  location: number; // The specific shop making the sale
  customer?: number | null;
  staff_customer?: number | null;
  discount: string;
  payment_method: SalePaymentMethod;
  idempotency_key?: string | null;
  items: Array<{
    item: number;
    quantity: string;
    unit_price: string;
  }>;
}

// --- List Filters ---

export interface InventoryItemFilters {
  search?: string;
  category?: number;
  location?: number;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}

export interface StockInFilters {
  search?: string;
  page?: number;
  page_size?: number;
}

export interface StockOutFilters {
  search?: string;
  reason?: StockOutReason;
  page?: number;
  page_size?: number;
}

export interface SaleFilters {
  search?: string;
  status?: SaleStatus;
  page?: number;
  page_size?: number;
}

export type SaleRedirectTarget = 'index' | 'new_sale' | 'detail';

export interface InventorySetting {
  id: number;
  allow_discount: boolean;
  allow_student_debt: boolean;
  allow_staff_debt: boolean;
  max_student_debt: string;
  max_staff_debt: string;
  allow_walkin_sale: boolean;
  allow_cash: boolean;
  allow_pos: boolean;
  max_individual_sale_amount: string | null;
  max_daily_sale_amount: string | null;
  max_refund_grace_period_hours: number | null;
  default_sale_redirect: SaleRedirectTarget;
  auto_print_receipt: boolean;
  updated_at: string;
  updated_by?: number | null;
  updated_by_name?: string | null;
}

export type InventorySettingPayload = Partial<Omit<InventorySetting, 'id' | 'updated_at' | 'updated_by'>>;

export interface StaffShopAccess {
  id: number;
  staff: number;
  staff_name?: string;
  shop: number;
  shop_name?: string;
  assigned_at: string;
  assigned_by?: number | null;
}

export interface StaffShopAccessPayload {
  staff: number;
  shop: number;
}

export interface BannedDebtUser {
  id: number;
  student?: number | null;
  student_name?: string | null;
  staff?: number | null;
  staff_name?: string | null;
  reason: string;
  is_active: boolean;
  banned_at: string;
  banned_by?: number | null;
}

export interface BannedDebtUserPayload {
  student?: number | null;
  staff?: number | null;
  reason: string;
  is_active?: boolean;
}

// ============================================================
// PURCHASE ORDERS
// ============================================================

export interface PurchaseOrderItem {
  id?: number;
  item?: number | null;
  item_name?: string; // Read-only
  item_description: string;
  quantity: string;
  unit_cost: string;
  line_total?: string; // Read-only
  is_stocked_in?: boolean; // Read-only
}

export interface PurchaseOrder {
  id: number;
  order_number: string;
  supplier: number;
  supplier_name?: string; // Read-only
  order_date: string;
  expected_date?: string | null;
  status: PurchaseOrderStatus;
  notes?: string | null;
  academic_period?: number | null;
  created_at: string;
  created_by?: number | null;
  created_by_name?: string; // Read-only
  total_amount?: string; // Read-only
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderPayload {
  supplier: number;
  expected_date?: string | null;
  notes?: string | null;
  items: Array<{
    item?: number | null;
    item_description: string;
    quantity: string;
    unit_cost: string;
  }>;
}

export interface PurchaseOrderStatusPayload {
  status: PurchaseOrderStatus;
}

// ============================================================
// PURCHASE ADVANCES
// ============================================================

export interface PurchaseAdvanceItem {
  id?: number;
  item?: number | null;
  item_name?: string; // Read-only
  item_description: string;

  // Pre-Market Estimates
  quantity: string;
  estimated_unit_cost: string;
  line_total?: string; // Read-only

  // Post-Market Actuals
  quantity_bought?: string;
  actual_unit_cost?: string;
  actual_line_total?: string; // Read-only
}

export interface PurchaseAdvance {
  id: number;
  advance_number: string; // Read-only
  staff: number;
  staff_name?: string; // Read-only
  purpose: string;

  requested_amount: string;
  approved_amount: string;
  disbursed_amount: string;
  actual_total: string;
  balance_due: string; // Read-only

  request_date: string; // Read-only
  approved_date?: string | null;
  disbursed_date?: string | null;
  report_date?: string | null;
  report_notes?: string | null;

  status: PurchaseAdvanceStatus;
  academic_period?: number | null;
  created_at: string; // Read-only

  approved_by_name?: string; // Read-only
  disbursed_by_name?: string; // Read-only
  items: PurchaseAdvanceItem[];
}

export interface PurchaseAdvancePayload {
  staff: number;
  purpose: string;
  report_notes?: string;
  items: Array<{
    id?: number; // Needed when updating actuals
    item?: number | null;
    item_description: string;
    quantity?: string; // Optional on update
    estimated_unit_cost?: string; // Optional on update
    quantity_bought?: string;
    actual_unit_cost?: string;
  }>;
}

export interface PurchaseAdvanceCompletePayload {
  location_id: number;
}

// ============================================================
// ASSIGNMENTS & JOBS
// ============================================================

export interface InventoryAssignment {
  id: number;
  item: number;
  title: string;
  item_name?: string; // Read-only
  quantity_per_student: string;
  student_classes: number[];
  gender: AssignmentGender;
  is_mandatory: boolean;
  is_free: boolean;
  is_active: boolean;
  notes?: string | null;
  academic_period?: number | null;
  created_at: string;
  updated_at: string;
  created_by?: number | null;
  updated_by?: number | null;
}

export interface InventoryAssignmentPayload {
  item: number;
  title: string;
  quantity_per_student: string;
  student_classes: number[];
  gender: AssignmentGender;
  is_mandatory: boolean;
  is_free: boolean;
  is_active?: boolean;
  academic_period?: number | null;
  notes?: string | null;
}

export interface CollectionGenerationJob {
  job_id: string; // UUID
  assignment: number;
  item_name?: string; // Read-only
  status: BackgroundJobStatus;
  status_display?: string; // Read-only
  total_students: number;
  processed_students: number;
  created_collections: number;
  skipped_students: number;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  created_by?: number | null;
}

export interface AssignmentJobStartPayload {
  assignment_id: number;
}

// ============================================================
// ALLOCATIONS & COLLECTION EVENTS (NEW)
// ============================================================

export type AllocationStatus = 'pending' | 'partially_collected' | 'collected' | 'returned';
export type CollectionEventStatus = 'completed' | 'reversed';
export type CollectionPaymentMethod = 'cash' | 'student_wallet' | 'pos';
export type ReturnReason = 'damaged' | 'wrong_size' | 'excess' | 'duplicate' | 'student_left' | 'other';

export interface AllocationItem {
  id: number;
  assignment: number;
  assignment_item_name: string;
  assignment_item_unit: string;
  assignment_item_price: string;
  assignment_is_mandatory: boolean;
  assignment_is_free: boolean;
  quantity_assigned: string;
  quantity_collected: string;
  outstanding_quantity: string;
  amount_due: string;
  amount_collected: string;
  amount_outstanding: string;
  status: AllocationStatus;
  status_display?: string;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Allocation {
  id: number;
  student: number;
  student_name: string;
  student_registration_number: string;
  student_class_name: string;
  student_image_url?: string | null;
  academic_period?: number | null;
  status: AllocationStatus;
  status_display?: string;
  items: AllocationItem[];
  total_items: number;
  total_quantity_assigned: string;
  total_quantity_collected: string;
  total_quantity_outstanding: string;
  total_amount_due: string;
  total_amount_paid: string;
  total_amount_outstanding: string;
  collection_events?: CollectionEvent[];
  created_at: string;
  updated_at: string;
}

export interface AllocationList {
  id: number;
  student: number;
  student_name: string;
  student_registration_number: string;
  student_class_name: string;
  academic_period?: number | null;
  status: AllocationStatus;
  status_display?: string;
  total_items: number;
  total_quantity_outstanding: string;
  total_amount_outstanding: string;
  created_at: string;
}

export interface CollectionEventItem {
  id: number;
  allocation_item: number;
  item_name: string;
  unit_display: string;
  quantity_collected: string;
  unit_price: string;
  amount: string;
}

export interface CollectionEvent {
  id: number;
  allocation: number;
  student_name: string;
  location: number;
  location_name: string;
  payment_method: CollectionPaymentMethod;
  payment_method_display?: string;
  total_amount: string;
  total_quantity?: string;
  status: CollectionEventStatus;
  status_display?: string;
  reference: string;
  collected_by_staff?: number | null;
  collected_by_staff_name?: string;
  collection_date: string;
  notes?: string | null;
  items: CollectionEventItem[];
}

export interface CollectionEventList {
  id: number;
  reference: string;
  allocation: number;
  student_name: string;
  student_registration_number: string;
  location_name: string;
  payment_method: CollectionPaymentMethod;
  payment_method_display?: string;
  total_amount: string;
  total_quantity: string;
  total_items_count: number;
  collected_by_staff_name?: string;
  collection_date: string;
  status: CollectionEventStatus;
}

export interface InventoryReturn {
  id: number;
  allocation_item: number;
  student_name: string;
  item_name: string;
  quantity_returned: string;
  return_reason: ReturnReason;
  return_reason_display?: string;
  return_date: string;
  item_condition: string;
  received_by_name?: string;
  notes?: string | null;
}

export interface CollectionRecordPayload {
  allocation_id: number;
  items: Array<{
    allocation_item_id: number;
    quantity: string;
  }>;
  location_id: number;
  payment_method: CollectionPaymentMethod;
}

export interface CollectionReturnPayload {
  allocation_item_id: number;
  quantity_to_return: string;
  return_reason: ReturnReason;
  item_condition?: string;
  notes?: string;
}

export interface AllocationFilters {
  academic_period?: number;
  class_id?: number;
  section_id?: number;
  status?: AllocationStatus;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface CollectionEventFilters {
  student_id?: number;
  location?: number;
  payment_method?: CollectionPaymentMethod;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface ReturnFilters {
  reason?: ReturnReason;
  student_id?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

// ============================================================
// REPORT TYPES (NEW)
// ============================================================

export interface StockLevelReportItem {
  id: number;
  name: string;
  barcode?: string | null;
  category: string;
  unit: string;
  quantity: string;
  reorder_level: string;
  last_cost_price: string;
  current_selling_price: string;
  stock_value_at_cost: string;
  stock_value_at_selling: string;
  is_low_stock: boolean;
  is_out_of_stock: boolean;
  location_breakdown: Array<{
    location_id: number;
    location_name: string;
    location_type: InventoryLocationType;
    quantity: string;
  }>;
}

export interface StockLevelReportSummary {
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_value_at_cost: string;
  total_value_at_selling: string;
}

export interface StockLevelReport {
  summary: StockLevelReportSummary;
  items: StockLevelReportItem[];
}

export interface SalesAnalysisItem {
  item_id: number;
  item_name: string;
  category: string;
  quantity_sold: string;
  revenue: string;
  cost: string;
  profit: string;
  profit_margin: string;
}

export interface SalesAnalysisSummary {
  total_revenue: string;
  total_profit: string;
  profit_margin: string;
  total_transactions: number;
  payment_breakdown: {
    cash: string;
    student_wallet: string;
    staff_wallet: string;
    pos: string;
  };
  date_range: {
    start_date: string;
    end_date: string;
  };
}

export interface DailyTrend {
  date: string;
  revenue: string;
  transactions: number;
  profit: string;
}

export interface SalesAnalysisReport {
  summary: SalesAnalysisSummary;
  top_items: SalesAnalysisItem[];
  daily_trend: DailyTrend[];
}

export interface StaffSalesReportItem {
  staff_id: number;
  staff_name: string;
  staff_code: string;
  total_sales: number;
  total_amount: string;
  cash_total: string;
  student_wallet_total: string;
  staff_wallet_total: string;
  pos_total: string;
}

export interface StaffSalesReportSummary {
  total_staff: number;
  total_sales: number;
  total_amount: string;
  cash_total: string;
  student_wallet_total: string;
  staff_wallet_total: string;
  pos_total: string;
}

export interface StaffSalesReport {
  summary: StaffSalesReportSummary;
  staff_report: StaffSalesReportItem[];
  date_range: {
    start_date: string;
    end_date: string;
  };
}

export interface StockLevelReportFilters {
  location?: 'all' | 'shop' | 'store';
  category?: number;
  stock_status?: 'all' | 'low' | 'out';
  search?: string;
}

export interface SalesAnalysisFilters {
  start_date?: string;
  end_date?: string;
  location?: number;
  payment_method?: 'all' | SalePaymentMethod;
  sort_by?: 'quantity' | 'revenue' | 'profit' | 'name';
  sort_order?: 'asc' | 'desc';
}

export interface StaffSalesFilters {
  start_date?: string;
  end_date?: string;
  location?: number;
  staff?: number;
}

// Update StockOutReason to include class_disbursement
export type StockOutReason =
  | 'staff_collection'
  | 'class_disbursement'
  | 'damage'
  | 'expired'
  | 'adjustment'
  | 'wastage'
  | 'transfer'
  | 'disbursement';

// Update StockOutDepartment to include classroom
export type StockOutDepartment =
  | 'cleaning'
  | 'drivers'
  | 'clinic'
  | 'admin'
  | 'cafeteria'
  | 'maintenance'
  | 'classroom';