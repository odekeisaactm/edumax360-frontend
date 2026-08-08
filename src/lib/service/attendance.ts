// ============================================================
// lib/service/attendance.ts

// ============================================================

import api from '@/lib/api';
import type {
  AttendanceSettings,
  AttendanceDevice,
  DeviceCredential,
  AttendanceEvent,
  ManualAttendanceEventInput,
  AttendanceDailyRecord,
  AttendanceRecordCorrectionInput,
  AttendanceException,
  AttendanceExceptionWrite,
  EventAttendanceRecord,
  EventCheckInInput,
  PickupLog,
  PickupLogInput,
  KnownVisitor,
  VisitorLog,
  VisitorSignInInput,
  VisitorSignOutInput,
  ParentNotificationPreference,
  MissingCredentialStudent,
} from '@/lib/types/attendance';

const BASE = '/attendance';

// A generic paginated-list shape matching the rest of the codebase's
// DRF pagination (parentsAPI.list() pattern: { results, count }).
interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

// ============================================================
// SETTINGS (singleton)
// ============================================================

export const attendanceSettingsAPI = {
  get: async (): Promise<AttendanceSettings> => {
    const res = await api.get(`${BASE}/settings/`);
    return res.data.data;
  },
  update: async (payload: Partial<AttendanceSettings>): Promise<AttendanceSettings> => {
    const res = await api.put(`${BASE}/settings/`, payload);
    return res.data.data;
  },
};

// ============================================================
// DEVICES
// ============================================================

export const attendanceDevicesAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<AttendanceDevice>> => {
    const res = await api.get(`${BASE}/devices/`, { params });
    return res.data;
  },
  get: async (id: number): Promise<AttendanceDevice> => {
    const res = await api.get(`${BASE}/devices/${id}/`);
    return res.data;
  },
  create: async (payload: Partial<AttendanceDevice>): Promise<AttendanceDevice> => {
    const res = await api.post(`${BASE}/devices/`, payload);
    return res.data;
  },
  update: async (id: number, payload: Partial<AttendanceDevice>): Promise<AttendanceDevice> => {
    const res = await api.patch(`${BASE}/devices/${id}/`, payload);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/devices/${id}/`);
  },
};

// ============================================================
// DEVICE CREDENTIALS
// ============================================================

export const deviceCredentialsAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<DeviceCredential>> => {
    const res = await api.get(`${BASE}/credentials/`, { params });
    return res.data;
  },
  get: async (id: number): Promise<DeviceCredential> => {
    const res = await api.get(`${BASE}/credentials/${id}/`);
    return res.data;
  },
  create: async (payload: Partial<DeviceCredential>): Promise<DeviceCredential> => {
    const res = await api.post(`${BASE}/credentials/`, payload);
    return res.data;
  },
  update: async (id: number, payload: Partial<DeviceCredential>): Promise<DeviceCredential> => {
    const res = await api.patch(`${BASE}/credentials/${id}/`, payload);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/credentials/${id}/`);
  },
};

// ============================================================
// RAW EVENTS (read-only) + MANUAL ATTENDANCE
// ============================================================

export const attendanceEventsAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<AttendanceEvent>> => {
    const res = await api.get(`${BASE}/events/`, { params });
    return res.data;
  },
  get: async (id: number): Promise<AttendanceEvent> => {
    const res = await api.get(`${BASE}/events/${id}/`);
    return res.data;
  },
  recordManual: async (payload: ManualAttendanceEventInput): Promise<AttendanceEvent[]> => {
    const res = await api.post(`${BASE}/manual/`, payload);
    return res.data.data;
  },
};

// ============================================================
// DAILY RECORDS
// ============================================================

export const attendanceRecordsAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<AttendanceDailyRecord>> => {
    const res = await api.get(`${BASE}/records/`, { params });
    return res.data;
  },
  get: async (id: number): Promise<AttendanceDailyRecord> => {
    const res = await api.get(`${BASE}/records/${id}/`);
    return res.data;
  },
  resolve: async (id: number, payload: AttendanceRecordCorrectionInput): Promise<AttendanceDailyRecord> => {
    const res = await api.post(`${BASE}/records/${id}/resolve/`, payload);
    return res.data.data;
  },
};

// ============================================================
// EXCEPTIONS / EXCURSIONS
// ============================================================

export const attendanceExceptionsAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<AttendanceException>> => {
    const res = await api.get(`${BASE}/exceptions/`, { params });
    return res.data;
  },
  get: async (id: number): Promise<AttendanceException> => {
    const res = await api.get(`${BASE}/exceptions/${id}/`);
    return res.data;
  },
  create: async (payload: AttendanceExceptionWrite): Promise<AttendanceException> => {
    const res = await api.post(`${BASE}/exceptions/`, payload);
    return res.data;
  },
  update: async (id: number, payload: Partial<AttendanceExceptionWrite>): Promise<AttendanceException> => {
    const res = await api.patch(`${BASE}/exceptions/${id}/`, payload);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/exceptions/${id}/`);
  },
};

// ============================================================
// EVENT ATTENDANCE
// ============================================================

export const eventAttendanceAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<EventAttendanceRecord>> => {
    const res = await api.get(`${BASE}/event-attendance/`, { params });
    return res.data;
  },
  checkIn: async (payload: EventCheckInInput): Promise<EventAttendanceRecord> => {
    const res = await api.post(`${BASE}/event-attendance/check_in/`, payload);
    return res.data.data;
  },
};

// ============================================================
// PICKUP LOG
// ============================================================

export const pickupLogAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<PickupLog>> => {
    const res = await api.get(`${BASE}/pickups/`, { params });
    return res.data;
  },
  record: async (payload: PickupLogInput): Promise<PickupLog> => {
    const res = await api.post(`${BASE}/pickups/record/`, payload);
    return res.data.data;
  },
};

// ============================================================
// KNOWN VISITORS & VISITOR LOG
// ============================================================

export const knownVisitorsAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<KnownVisitor>> => {
    const res = await api.get(`${BASE}/known-visitors/`, { params });
    return res.data;
  },
  get: async (id: number): Promise<KnownVisitor> => {
    const res = await api.get(`${BASE}/known-visitors/${id}/`);
    return res.data;
  },
  create: async (payload: Partial<KnownVisitor>): Promise<KnownVisitor> => {
    const res = await api.post(`${BASE}/known-visitors/`, payload);
    return res.data;
  },
  update: async (id: number, payload: Partial<KnownVisitor>): Promise<KnownVisitor> => {
    const res = await api.patch(`${BASE}/known-visitors/${id}/`, payload);
    return res.data;
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/known-visitors/${id}/`);
  },
};

export const visitorLogAPI = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<VisitorLog>> => {
    const res = await api.get(`${BASE}/visitors/`, { params });
    return res.data;
  },
  signIn: async (payload: VisitorSignInInput): Promise<VisitorLog> => {
    const res = await api.post(`${BASE}/visitors/sign_in/`, payload);
    return res.data.data;
  },
  signOut: async (payload: VisitorSignOutInput): Promise<VisitorLog> => {
    const res = await api.post(`${BASE}/visitors/sign_out/`, payload);
    return res.data.data;
  },
};

// ============================================================
// PARENT NOTIFICATION PREFERENCE (self-service)
// ============================================================

export const parentNotificationPreferenceAPI = {
  get: async (): Promise<ParentNotificationPreference> => {
    const res = await api.get(`${BASE}/notification-preference/`);
    return res.data.data;
  },
  update: async (payload: Partial<ParentNotificationPreference>): Promise<ParentNotificationPreference> => {
    const res = await api.put(`${BASE}/notification-preference/`, payload);
    return res.data.data;
  },
};

// ============================================================
// REPORTS
// ============================================================

export const attendanceReportsAPI = {
  missingCredentials: async (params?: { scope?: string; date?: string }): Promise<MissingCredentialStudent[]> => {
    const res = await api.get(`${BASE}/report/missing-credentials/`, { params });
    return res.data.data;
  },
};