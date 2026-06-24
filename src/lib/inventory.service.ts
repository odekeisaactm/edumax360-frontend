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
} from '@/lib/types';

// Helper to safely extract data from APIResponse wrapper
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
  list: async (): Promise<InventoryLocation[]> => {
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