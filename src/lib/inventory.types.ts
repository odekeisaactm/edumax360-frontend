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
}

// Lightweight for dropdowns/tables
export interface InventoryItemList {
  id: number;
  name: string;
  barcode?: string | null;
  category_name?: string;
  unit: InventoryUnit;
  current_selling_price: string;
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
  date_removed: string;
  notes?: string | null;
  academic_period?: number | null;
  created_by?: number | null;
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
  created_at: string;
  items: SaleItem[];
  subtotal?: string; // Read-only
  total_amount?: string; // Read-only
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
  initial_quantity?: string; // Used only on create
  initial_location_id?: number; // Used only on create
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
    batch_number?: string;
    expiry_date?: string;
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