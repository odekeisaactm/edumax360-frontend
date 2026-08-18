/**
 * Communication API Service
 * communication.service.ts
 *
 * API calls for the communication Django app configurations, logs,
 * bulk messaging, ticketing, and announcements.
 */

import api from './api'; // your axios instance
import type {
  WhatsAppConfig,
  WhatsAppConfigFormValues,
  ActivityLog,
  InAppNotificationResponse,
  Query,
  QueryFormValues,
  Announcement,
  AnnouncementFormValues,
  BulkRecipientType,
} from '@/lib/types'; // Update imports as needed to match your types file

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
    // Returning raw data so components can use pagination info (count) if needed
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

// ============================================================================
// BULK MESSAGE CAMPAIGNS (TIER 1)
// ============================================================================

export const bulkCampaignsAPI = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/api/communication/campaigns/', { params });
    return res.data; // Return raw data for pagination handling
  },

  get: async (id: number) => {
    const res = await api.get(`/api/communication/campaigns/${id}/`);
    return unwrap(res.data);
  },

  create: async (data: any) => {
    const res = await api.post('/api/communication/campaigns/', data);
    return unwrap(res.data);
  },

  update: async (id: number, data: any) => {
    const res = await api.patch(`/api/communication/campaigns/${id}/`, data);
    return unwrap(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/campaigns/${id}/`);
  },

  queue: async (id: number): Promise<{ detail: string }> => {
    const res = await api.post(`/api/communication/campaigns/${id}/queue/`);
    return res.data;
  },

  preview: async (data: { recipient_type: BulkRecipientType; filter_criteria: any; channels?: string[] }) => {
    const res = await api.post('/api/communication/campaigns/preview/', data);
    return res.data as { count: number; sample?: any[] };
  },
  retryFailed: async (id: number, channels: string[]) => {
    const res = await api.post(`/api/communication/campaigns/${id}/dispatch_campaign/`, {
      retry_only: true,
      channels: channels
    });
    return res.data;
  }
};

// ============================================================================
// QUERIES / HELPDESK TICKETS (TIER 2)
// ============================================================================

export const queriesAPI = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/api/communication/queries/', { params });
    return res.data;
  },

  get: async (id: number): Promise<Query> => {
    const res = await api.get(`/api/communication/queries/${id}/`);
    return unwrap<Query>(res.data);
  },

  // Updated to accept both standard JSON or FormData for attachments
  create: async (data: any | FormData): Promise<Query> => {
    // Detect if the payload contains files
    const isFormData = typeof window !== 'undefined' && data instanceof FormData;

    const res = await api.post('/api/communication/queries/', data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
    });
    return res.data; // or unwrap(res.data) depending on your setup
  },

  update: async (id: number, data: Partial<QueryFormValues> | FormData): Promise<Query> => {
    const res = await api.patch(`/api/communication/queries/${id}/`, data);
    return unwrap<Query>(res.data);
  },

  // Added missing method for ticket replies
  addFollowUp: async (id: number, data: any | FormData): Promise<any> => {
    const isFormData = typeof window !== 'undefined' && data instanceof FormData;

    const res = await api.post(`/api/communication/queries/${id}/follow-up/`, data, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : undefined
    });
    return res.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/queries/${id}/`);
  }
};

// ============================================================================
// ANNOUNCEMENTS (TIER 2)
// ============================================================================

export const announcementsAPI = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/api/communication/announcements/', { params });
    return res.data;
  },

  get: async (id: number): Promise<Announcement> => {
    const res = await api.get(`/api/communication/announcements/${id}/`);
    return unwrap<Announcement>(res.data);
  },

  create: async (data: AnnouncementFormValues): Promise<Announcement> => {
    const res = await api.post('/api/communication/announcements/', data);
    return unwrap<Announcement>(res.data);
  },

  update: async (id: number, data: Partial<AnnouncementFormValues>): Promise<Announcement> => {
    const res = await api.patch(`/api/communication/announcements/${id}/`, data);
    return unwrap<Announcement>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/announcements/${id}/`);
  }
};

// ============================================================================
// ADMISSION ENQUIRIES (TIER 3)
// ============================================================================

export const admissionEnquiriesAPI = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/api/communication/admission-enquiries/', { params });
    return res.data;
  },

  get: async (id: number) => {
    const res = await api.get(`/api/communication/admission-enquiries/${id}/`);
    return unwrap(res.data);
  },

  create: async (data: any) => {
    const res = await api.post('/api/communication/admission-enquiries/', data);
    return unwrap(res.data);
  },

  update: async (id: number, data: any) => {
    const res = await api.patch(`/api/communication/admission-enquiries/${id}/`, data);
    return unwrap(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/admission-enquiries/${id}/`);
  }
};

// ============================================================================
// MARQUEE MESSAGES (TIER 4)
// ============================================================================

export const marqueeAPI = {
  list: async (params?: Record<string, any>) => {
    const res = await api.get('/api/communication/marquee/', { params });
    return res.data;
  },

  get: async (id: number): Promise<MarqueeMessage> => {
    const res = await api.get(`/api/communication/marquee/${id}/`);
    return unwrap<MarqueeMessage>(res.data);
  },

  create: async (data: MarqueeMessageFormValues): Promise<MarqueeMessage> => {
    const res = await api.post('/api/communication/marquee/', data);
    return unwrap<MarqueeMessage>(res.data);
  },

  update: async (id: number, data: Partial<MarqueeMessageFormValues>): Promise<MarqueeMessage> => {
    const res = await api.patch(`/api/communication/marquee/${id}/`, data);
    return unwrap<MarqueeMessage>(res.data);
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/marquee/${id}/`);
  }
};

export const templatesAPI = {
  list: async (): Promise<NotificationTemplate[]> => {
    const res = await api.get('/api/communication/templates/');
    return Array.isArray(res.data?.results) ? res.data.results : res.data;
  },
  create: async (data: NotificationTemplateFormValues): Promise<NotificationTemplate> => {
    const res = await api.post('/api/communication/templates/', data);
    return res.data;
  },
  update: async (id: number, data: Partial<NotificationTemplateFormValues>): Promise<NotificationTemplate> => {
    const res = await api.patch(`/api/communication/templates/${id}/`, data);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/communication/templates/${id}/`);
  }
};

export const contactsAPI = {
  list: async (params: Record<string, any> = {}) => {
    const res = await api.get('/api/communication/custom-contacts/', { params });
    return res.data;
  },
  create: async (data: Partial<CustomContact>) => {
    const res = await api.post('/api/communication/custom-contacts/', data);
    return res.data;
  },
  update: async (id: number, data: Partial<CustomContact>) => {
    const res = await api.patch(`/api/communication/custom-contacts/${id}/`, data);
    return res.data;
  },
  delete: async (id: number) => {
    await api.delete(`/api/communication/custom-contacts/${id}/`);
  }
};