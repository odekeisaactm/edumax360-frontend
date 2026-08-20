import api from './api';
import type {
  InventoryCategory,
  InventoryLocation,
  InventorySupplier,
  InventoryItem,
  InventoryItemList,
  StockIn,
  StockInPayload,
  StockInFilters,
  StockOut,
  StockOutPayload,
  StockOutFilters,
  StockTransfer,
  StockTransferPayload,
  Sale,
  SalePayload,
  SaleFilters,
  InventoryItemFormValues,
  InventoryItemFilters,
  InventorySetting,
  InventorySettingPayload,
  StaffShopAccessPayload,
  StaffShopAccess,
  BannedDebtUserPayload,
  BannedDebtUser,
  PurchaseOrder,
  PurchaseOrderPayload,
  PurchaseOrderStatusPayload,
  PurchaseAdvance,
  PurchaseAdvancePayload,
  PurchaseAdvanceCompletePayload,
  InventoryAssignment,
  InventoryAssignmentPayload,
  CollectionGenerationJob,
  AssignmentJobStartPayload,
  PaginatedResponse
} from '@/lib/types';

// Helper to safely extract data from deeply nested APIResponse wrapper
const unwrap = (response: any) => {
  const resData = response?.data;

  // Case 1: Non-paginated APIResponse: { success: true, data: [...] }
  if (resData?.success && resData.data !== undefined) {
    return resData.data;
  }

  // Case 2: Paginated DRF wrapping APIResponse: { count, next, previous, results: { success: true, data: [...] } }
  if (resData?.results?.success && resData.results.data !== undefined) {
    return {
      count: resData.count,
      next: resData.next,
      previous: resData.previous,
      results: resData.results.data // Extract the actual array here
    };
  }

  // Case 3: Standard DRF Pagination: { count, next, previous, results: [...] }
  if (resData?.results !== undefined) {
    return resData;
  }

  // Case 4: Raw array or object
  return resData;
};

// ── Categories ───────────────────────────────────────────────

export const inventoryCategoryAPI = {
  list: async (): Promise<InventoryCategory[]> => {
    const r = await api.get('/api/inventory/categories/');
    const data = unwrap(r);
    return Array.isArray(data) ? data : data?.results || [];
  },
  get: async (id: number): Promise<InventoryCategory> => {
    const r = await api.get(`/api/inventory/categories/${id}/`);
    return unwrap(r);
  },
  create: async (data: Partial<InventoryCategory>): Promise<InventoryCategory> => {
    const r = await api.post('/api/inventory/categories/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<InventoryCategory>): Promise<InventoryCategory> => {
    const r = await api.patch(`/api/inventory/categories/${id}/`, data);
    return unwrap(r);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/inventory/categories/${id}/`);
  },
};

// ── Locations ────────────────────────────────────────────────

export const inventoryLocationAPI = {
  list: async (): Promise<PaginatedResponse<InventoryLocation> | InventoryLocation[]> => {
    const r = await api.get('/api/inventory/locations/');
    const data = unwrap(r);
    return Array.isArray(data) ? data : data?.results || [];
  },
  get: async (id: number): Promise<InventoryLocation> => {
    const r = await api.get(`/api/inventory/locations/${id}/`);
    return unwrap(r);
  },
  create: async (data: Partial<InventoryLocation>): Promise<InventoryLocation> => {
    const r = await api.post('/api/inventory/locations/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<InventoryLocation>): Promise<InventoryLocation> => {
    const r = await api.patch(`/api/inventory/locations/${id}/`, data);
    return unwrap(r);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/inventory/locations/${id}/`);
  },
};

// ── Suppliers ────────────────────────────────────────────────

export const inventorySupplierAPI = {
  list: async (params?: Record<string, any>): Promise<any> => {
    const r = await api.get('/api/inventory/suppliers/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<InventorySupplier> => {
    const r = await api.get(`/api/inventory/suppliers/${id}/`);
    return unwrap(r);
  },
  create: async (data: Partial<InventorySupplier>): Promise<InventorySupplier> => {
    const r = await api.post('/api/inventory/suppliers/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<InventorySupplier>): Promise<InventorySupplier> => {
    const r = await api.patch(`/api/inventory/suppliers/${id}/`, data);
    return unwrap(r);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/inventory/suppliers/${id}/`);
  },
};

// ── Items ────────────────────────────────────────────────────

export const inventoryItemAPI = {
  list: async (params?: InventoryItemFilters): Promise<any> => {
    const r = await api.get('/api/inventory/items/', { params });
    return unwrap(r); // Returns paginated object { count, next, previous, results }
  },
  get: async (id: number): Promise<InventoryItem> => {
    const r = await api.get(`/api/inventory/items/${id}/`);
    return unwrap(r);
  },
  create: async (data: InventoryItemFormValues): Promise<InventoryItem> => {
    const r = await api.post('/api/inventory/items/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<InventoryItemFormValues>): Promise<InventoryItem> => {
    const r = await api.patch(`/api/inventory/items/${id}/`, data);
    return unwrap(r);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/inventory/items/${id}/`);
  },
};

// ── Stock in ─────────────────────────────────────────────────

export const stockInAPI = {
  list: async (params?: StockInFilters): Promise<any> => {
    const r = await api.get('/api/inventory/stock-in/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<StockIn> => {
    const r = await api.get(`/api/inventory/stock-in/${id}/`);
    return unwrap(r);
  },
  create: async (data: StockInPayload): Promise<StockIn> => {
    const r = await api.post('/api/inventory/stock-in/', data);
    return unwrap(r);
  },
};

// ── Stock Out ────────────────────────────────────────────────

export const stockOutAPI = {
  list: async (params?: StockOutFilters): Promise<any> => {
    const r = await api.get('/api/inventory/stock-out/', { params });
    return unwrap(r);
  },
  create: async (data: StockOutPayload): Promise<StockOut> => {
    const r = await api.post('/api/inventory/stock-out/', data);
    return unwrap(r);
  },
};

// ── Stock Transfers ──────────────────────────────────────────

export const stockTransferAPI = {
  list: async (params?: any): Promise<any> => {
    const r = await api.get('/api/inventory/transfers/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<StockTransfer> => {
    const r = await api.get(`/api/inventory/transfers/${id}/`);
    return unwrap(r);
  },
  create: async (data: StockTransferPayload): Promise<StockTransfer> => {
    const r = await api.post('/api/inventory/transfers/', data);
    return unwrap(r);
  },
};

// ── POS Sales ────────────────────────────────────────────────

// Inside saleAPI in inventory.service.ts
export const saleAPI = {
  list: async (params?: SaleFilters): Promise<any> => {
    const r = await api.get('/api/inventory/sales/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<Sale> => {
    const r = await api.get(`/api/inventory/sales/${id}/`);
    return unwrap(r);
  },
  create: async (data: SalePayload): Promise<Sale> => {
    const r = await api.post('/api/inventory/sales/', data);
    return unwrap(r);
  },
  refund: async (id: number): Promise<Sale> => {
    const r = await api.post(`/api/inventory/sales/${id}/refund/`);
    return unwrap(r);
  },
};

// ── Reports ──────────────────────────────────────────────────

export const inventoryReportAPI = {
  get: async (params: { type: 'low_stock' | 'sales_summary' | 'top_selling' }): Promise<any> => {
    const r = await api.get('/api/inventory/reports/', { params });
    return unwrap(r);
  },
};

// ── POS Settings (Singleton) ────────────────────────────────

export const inventorySettingAPI = {
  get: async (): Promise<InventorySetting> => {
    const r = await api.get('/api/inventory/settings/');
    return unwrap(r);
  },
  update: async (data: InventorySettingPayload): Promise<InventorySetting> => {
    const r = await api.patch('/api/inventory/settings/', data);
    return unwrap(r);
  },
};

// ── Staff Shop Access ────────────────────────────────────────

export const shopAccessAPI = {
  list: async (params?: Record<string, any>): Promise<any> => {
    const r = await api.get('/api/inventory/shop-access/', { params });
    return unwrap(r);
  },
  myAccess: async (): Promise<{ is_superuser: boolean; shop: number | null; shop_name: string | null; shop_code?: string }> => {
    const r = await api.get('/api/inventory/shop-access/me/');
    return unwrap(r);
  },
  create: async (data: StaffShopAccessPayload): Promise<StaffShopAccess> => {
    const r = await api.post('/api/inventory/shop-access/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<StaffShopAccessPayload>): Promise<StaffShopAccess> => {
    const r = await api.patch(`/api/inventory/shop-access/${id}/`, data);
    return unwrap(r);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/inventory/shop-access/${id}/`);
  },
};


// ── Banned Debt Users ────────────────────────────────────────

export const bannedDebtUserAPI = {
  list: async (params?: Record<string, any>): Promise<any> => {
    const r = await api.get('/api/inventory/debt-bans/', { params });
    return unwrap(r);
  },
  create: async (data: BannedDebtUserPayload): Promise<BannedDebtUser> => {
    const r = await api.post('/api/inventory/debt-bans/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<BannedDebtUserPayload>): Promise<BannedDebtUser> => {
    const r = await api.patch(`/api/inventory/debt-bans/${id}/`, data);
    return unwrap(r);
  },
};

// ── Purchase Orders ──────────────────────────────────────────

export const purchaseOrderAPI = {
  list: async (params?: Record<string, any>): Promise<any> => {
    const r = await api.get('/api/inventory/purchase-orders/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<PurchaseOrder> => {
    const r = await api.get(`/api/inventory/purchase-orders/${id}/`);
    return unwrap(r);
  },
  create: async (data: PurchaseOrderPayload): Promise<PurchaseOrder> => {
    const r = await api.post('/api/inventory/purchase-orders/', data);
    return unwrap(r);
  },
  updateStatus: async (id: number, data: PurchaseOrderStatusPayload): Promise<PurchaseOrder> => {
    const r = await api.post(`/api/inventory/purchase-orders/${id}/status/`, data);
    return unwrap(r);
  },
};

// ── Purchase Advances ────────────────────────────────────────

export const purchaseAdvanceAPI = {
  list: async (params?: Record<string, any>): Promise<any> => {
    const r = await api.get('/api/inventory/advances/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<PurchaseAdvance> => {
    const r = await api.get(`/api/inventory/advances/${id}/`);
    return unwrap(r);
  },
  create: async (data: PurchaseAdvancePayload): Promise<PurchaseAdvance> => {
    const r = await api.post('/api/inventory/advances/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<PurchaseAdvancePayload>): Promise<PurchaseAdvance> => {
    const r = await api.patch(`/api/inventory/advances/${id}/`, data);
    return unwrap(r);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/inventory/advances/${id}/`);
  },
  complete: async (id: number, data: PurchaseAdvanceCompletePayload): Promise<StockIn> => {
    const r = await api.post(`/api/inventory/advances/${id}/complete/`, data);
    return unwrap(r);
  },
};

// ── Assignments ──────────────────────────────────────────────

export const inventoryAssignmentAPI = {
  list: async (params?: Record<string, any>): Promise<any> => {
    const r = await api.get('/api/inventory/assignments/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<InventoryAssignment> => {
    const r = await api.get(`/api/inventory/assignments/${id}/`);
    return unwrap(r);
  },
  create: async (data: InventoryAssignmentPayload): Promise<InventoryAssignment> => {
    const r = await api.post('/api/inventory/assignments/', data);
    return unwrap(r);
  },
  update: async (id: number, data: Partial<InventoryAssignmentPayload>): Promise<InventoryAssignment> => {
    const r = await api.patch(`/api/inventory/assignments/${id}/`, data);
    return unwrap(r);
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/inventory/assignments/${id}/`);
  },
};

// ── Background Jobs ──────────────────────────────────────────

export const inventoryJobAPI = {
  list: async (params?: Record<string, any>): Promise<any> => {
    const r = await api.get('/api/inventory/jobs/', { params });
    return unwrap(r);
  },
  generateCollections: async (data: AssignmentJobStartPayload): Promise<CollectionGenerationJob> => {
    const r = await api.post('/api/inventory/jobs/generate-collections/', data);
    return unwrap(r);
  },
  getStatus: async (jobId: string): Promise<CollectionGenerationJob> => {
    const r = await api.get(`/api/inventory/jobs/${jobId}/status/`);
    return unwrap(r);
  },
};

export const allocationManagementAPI = {
  manualAssign: async (data: { assignment_id: number; student_id: number }): Promise<any> => {
    const r = await api.post('/api/inventory/assignments/manual-assign/', data);
    return unwrap(r);
  },
  terminate: async (allocationItemId: number): Promise<any> => {
    const r = await api.post(`/api/inventory/allocations/${allocationItemId}/terminate/`);
    return unwrap(r);
  },
  listByAssignment: async (assignmentId: number, params?: any): Promise<any> => {
    const r = await api.get(`/api/inventory/assignments/${assignmentId}/allocations/`, { params });
    return unwrap(r);
  },
};

// ── Allocations ─────────────────────────────────────────────

export const allocationAPI = {
  list: async (params?: AllocationFilters): Promise<PaginatedResponse<AllocationList> | AllocationList[]> => {
    const r = await api.get('/api/inventory/allocations/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<Allocation> => {
    const r = await api.get(`/api/inventory/allocations/${id}/`);
    return unwrap(r);
  },
  getByStudent: async (studentId: number): Promise<Allocation[]> => {
    const r = await api.get(`/api/inventory/allocations/student/${studentId}/`);
    return unwrap(r);
  },
};

// ── Collection Events ───────────────────────────────────────

export const collectionEventAPI = {
  list: async (params?: CollectionEventFilters): Promise<PaginatedResponse<CollectionEventList> | CollectionEventList[]> => {
    const r = await api.get('/api/inventory/collection-events/', { params });
    return unwrap(r);
  },
  get: async (id: number): Promise<CollectionEvent> => {
    const r = await api.get(`/api/inventory/collection-events/${id}/`);
    return unwrap(r);
  },
  record: async (data: CollectionRecordPayload): Promise<CollectionEvent> => {
    const r = await api.post('/api/inventory/collections/record/', data);
    return unwrap(r);
  },
  returnItem: async (data: CollectionReturnPayload): Promise<{ return_id: number }> => {
    const r = await api.post('/api/inventory/collections/return/', data);
    return unwrap(r);
  },
};

// ── Returns ─────────────────────────────────────────────────

export const returnAPI = {
  list: async (params?: ReturnFilters): Promise<PaginatedResponse<InventoryReturn> | InventoryReturn[]> => {
    const r = await api.get('/api/inventory/returns/', { params });
    return unwrap(r);
  },
};

// ── Enhanced Reports ────────────────────────────────────────

export const inventoryReportAPI_v2 = {
  stockLevel: async (params?: StockLevelReportFilters): Promise<StockLevelReport> => {
    const r = await api.get('/api/inventory/reports/stock-level/', { params });
    return unwrap(r);
  },
  salesAnalysis: async (params?: SalesAnalysisFilters): Promise<SalesAnalysisReport> => {
    const r = await api.get('/api/inventory/reports/sales-analysis/', { params });
    return unwrap(r);
  },
  staffSales: async (params?: StaffSalesFilters): Promise<StaffSalesReport> => {
    const r = await api.get('/api/inventory/reports/staff-sales/', { params });
    return unwrap(r);
  },
};