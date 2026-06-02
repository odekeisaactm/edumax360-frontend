/**
 * Communication API Service
 * communication.service.ts
 *
 * API calls for the communication Django app configurations and logs.
 */

import api from './api'; // your axios instance
import type {
  WhatsAppConfig,
  WhatsAppConfigFormValues,
  ActivityLog,
} from '@/types/communication.types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Unwrap paginated or direct list response.
 * DRF returns { count, results } for lists.
 */
function unwrapList<T>(data: any): T[] {
  if (data && Array.isArray(data.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * Unwrap direct object response.
 * DRF ModelViewSet returns the object directly on create/retrieve/update.
 */
function unwrap<T>(data: any): T {
  return data as T;
}

// ============================================================================
// WHATSAPP CONFIGURATIONS
// ============================================================================

export const whatsAppConfigAPI = {
  list: async (): Promise<WhatsAppConfig[]> => {
    const res = await api.get('/api/communication/whatsapp-configs/');
    return unwrapList<WhatsAppConfig>(res.data);
  },

  get: async (id: number): Promise<WhatsAppConfig> => {
    const res = await api.get(`/api/communication/whatsapp-configs/${id}/`);
    return unwrap<WhatsAppConfig>(res.data);
  },

  create: async (data: WhatsAppConfigFormValues): Promise<WhatsAppConfig> => {
    const res = await api.post('/api/communication/whatsapp-configs/', data);
    return unwrap<WhatsAppConfig>(res.data);
  },

  update: async (id: number, data: Partial<WhatsAppConfigFormValues>): Promise<WhatsAppConfig> => {
    const res = await api.put(`/api/communication/whatsapp-configs/${id}/`, data);
    return unwrap<WhatsAppConfig>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/whatsapp-configs/${id}/`);
  },

  /** Set a specific WhatsApp config as the active one */
  setActive: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/api/communication/whatsapp-configs/${id}/set-active/`);
    return res.data;
  },

  /** Test sending a WhatsApp message using this config */
  testSend: async (id: number, data: { phone_number: string; message?: string }): Promise<{ success: boolean; message: string; details?: any }> => {
    const res = await api.post(`/api/communication/whatsapp-configs/${id}/test-send/`, data);
    return res.data;
  },
};

// ============================================================================
// ACTIVITY LOGS (AUDIT TRAIL)
// ============================================================================

export const activityLogsAPI = {
  /**
   * Read-only list. Supports filtering by category, action_type, session, and search.
   */
  list: async (filters?: {
    category?: string;
    action_type?: string;
    session_period__is_current?: boolean;
    search?: string;
  }): Promise<{ count: number; results: ActivityLog[] } | ActivityLog[]> => {
    const res = await api.get('/api/communication/activity-logs/', { params: filters });
    // Returning raw data so components can use pagination info (count) if needed,
    // or you can wrap it with unwrapList if you just want the array.
    return res.data;
  },

  /** Read-only retrieve */
  get: async (id: number): Promise<ActivityLog> => {
    const res = await api.get(`/api/communication/activity-logs/${id}/`);
    return unwrap<ActivityLog>(res.data);
  },
};

// ============================================================================
// IN-APP NOTIFICATIONS (UI BELL DROPDOWN)
// ============================================================================

export const inAppNotificationsAPI = {
  /**
   * Fetches the unread count and the 15 most recent notifications.
   * Perfect for the 60-second polling interval in the Header.
   */
  getRecent: async (): Promise<InAppNotificationResponse> => {
    const res = await api.get('/api/communication/notifications/');
    // Our backend returns { success: true, data: { unread_count, notifications } }
    return res.data.data as InAppNotificationResponse;
  },

  /**
   * Marks a specific notification as read.
   */
  markAsRead: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/api/communication/notifications/${id}/mark-read/`);
    return res.data;
  },

  /**
   * Marks all unread notifications for the current user as read.
   */
  markAllAsRead: async (): Promise<{ success: boolean; message: string }> => {
    const res = await api.post(`/api/communication/notifications/mark-all-read/mark-read/`);
    return res.data;
  },
};