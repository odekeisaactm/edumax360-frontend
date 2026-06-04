'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { authorizedDevicesAPI, deviceApprovalRequestsAPI } from '@/lib/api';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { AuthorizedDevice, DeviceApprovalRequest } from '@/lib/types';
import {
  Shield,
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Zap,
  Loader2,
  Monitor,
  Tablet,
  SmartphoneIcon,
  Laptop,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Link,
} from 'lucide-react';

type TabType = 'devices' | 'pending';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d;
    if (d.detail) return String(d.detail);
    if (d.error) return String(d.error);
    if (d.message) return String(d.message);
    if (d.non_field_errors?.length) return d.non_field_errors[0];
    if (typeof d === 'object') {
      const msgs = Object.entries(d)
        .map(([f, v]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
        .join('\n');
      if (msgs) return msgs;
    }
  }
  return err?.message || 'An unexpected error occurred.';
}

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug whitespace-pre-line">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmModal({ open, deviceName, isDeleting, onConfirm, onCancel }: {
  open: boolean; deviceName: string; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Device</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-700">"{deviceName}"</span>?
          This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</>
              : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Device type icon helper ───────────────────────────────────────────────────
function getDeviceIcon(type: string) {
  switch (type) {
    case 'mobile': return SmartphoneIcon;
    case 'tablet': return Tablet;
    case 'laptop': return Laptop;
    default: return Monitor;
  }
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DevicesPage() {
  const { hasPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('devices');
  const [devices, setDevices] = useState<AuthorizedDevice[]>([]);
  const [pendingRequests, setPendingRequests] = useState<DeviceApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AuthorizedDevice | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingDevice, setDeletingDevice] = useState<AuthorizedDevice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [capturingDevice, setCapturingDevice] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<DeviceApprovalRequest | null>(null);
  const [approvalDeviceName, setApprovalDeviceName] = useState('');
  const [currentDeviceFingerprint, setCurrentDeviceFingerprint] = useState<string | null>(null);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<DeviceApprovalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Copy link state
  const [linkCopied, setLinkCopied] = useState(false);

  // Block modal state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockingDevice, setBlockingDevice] = useState<AuthorizedDevice | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    device_name: '',
    device_type: 'desktop' as 'desktop' | 'laptop' | 'tablet' | 'mobile',
    device_fingerprint: '',
    browser_fingerprint: '',
    ip_address: '',
    user_agent: '',
    is_active: true,
  });

  // Permission checks
  const canView   = user?.is_superuser || hasPermission('assessment_center.view_authorizeddevicemodel');
  const canCreate = user?.is_superuser || hasPermission('assessment_center.add_authorizeddevicemodel');
  const canEdit   = user?.is_superuser || hasPermission('assessment_center.change_authorizeddevicemodel');
  const canDelete = user?.is_superuser || hasPermission('assessment_center.delete_authorizeddevicemodel');

  // ── Toast helpers ──
  const showToast = (type: ToastItem['type'], message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // ── Fingerprint init (UNTOUCHED) ──
  useEffect(() => {
    const initFingerprint = async () => {
      try {
        const fp = await getDeviceFingerprint();
        setCurrentDeviceFingerprint(fp);
        console.log('Current device fingerprint:', fp);
      } catch (error) {
        console.error('Failed to get fingerprint:', error);
      }
    };
    initFingerprint();
  }, []);

  useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [canView, activeTab]);

  // ── isCurrentDeviceAuthorized (UNTOUCHED) ──
  const isCurrentDeviceAuthorized = (): boolean => {
    if (!currentDeviceFingerprint) return false;
    return devices.some(device =>
      device.device_fingerprint === currentDeviceFingerprint &&
      device.is_authorized &&
      !device.is_blocked
    );
  };

  // ── fetchData (UNTOUCHED) ──
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'devices') {
        const devicesData = await authorizedDevicesAPI.list();
        console.log('Fetched devices:', devicesData);
        setDevices(devicesData);
      } else {
        const pendingData = await deviceApprovalRequestsAPI.getPending();
        console.log('Fetched pending requests:', pendingData);
        setPendingRequests(pendingData.requests);
      }
    } catch (error: any) {
      console.error('Fetch error:', error);
      setError(error.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // ── handleCaptureCurrentDevice (UNTOUCHED) ──
  const handleCaptureCurrentDevice = async () => {
    setCapturingDevice(true);
    setError(null);
    try {
      const fingerprint = await getDeviceFingerprint();
      console.log('Captured fingerprint:', fingerprint);
      const response = await authorizedDevicesAPI.captureCurrentDevice(fingerprint);
      console.log('Device info:', response);
      setFormData({
        device_name: response.device_info.suggested_name || '',
        device_type: response.device_info.device_type,
        device_fingerprint: response.device_info.device_fingerprint,
        browser_fingerprint: response.device_info.device_fingerprint,
        ip_address: response.device_info.ip_address,
        user_agent: response.device_info.user_agent,
        is_active: true,
      });
      setShowForm(true);
    } catch (error: any) {
      console.error('Capture error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to capture device information');
    } finally {
      setCapturingDevice(false);
    }
  };

  // ── handleSubmit (UNTOUCHED) ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const submitData = {
        ...formData,
        browser_fingerprint: formData.device_fingerprint,
      };
      let result: AuthorizedDevice;
      if (editingDevice) {
        result = await authorizedDevicesAPI.update(editingDevice.id, formData);
        setDevices(prev => prev.map(d => d.id === result.id ? result : d));
        showToast('success', 'Device updated successfully!');
      } else {
        result = await authorizedDevicesAPI.create(formData);
        setDevices(prev => [result, ...prev]);
        showToast('success', 'Device authorized successfully!');
      }
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      console.error('Submit error:', error);
      let errorMessage = 'Failed to save device';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (typeof error.response.data === 'object') {
          const errors = Object.entries(error.response.data)
            .map(([field, msgs]: [string, any]) => {
              const fieldName = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              const messages = Array.isArray(msgs) ? msgs : [msgs];
              return `${fieldName}: ${messages.join(', ')}`;
            })
            .join('\n');
          if (errors) errorMessage = errors;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      console.error('Submit error:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── handleEdit (UNTOUCHED) ──
  const handleEdit = (device: AuthorizedDevice) => {
    setEditingDevice(device);
    setFormData({
      device_name: device.device_name,
      device_type: device.device_type,
      device_fingerprint: device.device_fingerprint,
      browser_fingerprint: device.device_fingerprint,
      ip_address: device.ip_address,
      user_agent: device.user_agent,
      is_active: device.is_active,
    });
    setShowForm(true);
  };

  // ── handleDelete (UNTOUCHED) ──
  const handleDelete = async () => {
    if (!deletingDevice) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await authorizedDevicesAPI.delete(deletingDevice.id);
      setDevices(prev => prev.filter(d => d.id !== deletingDevice.id));
      setShowDeleteModal(false);
      setDeletingDevice(null);
      showToast('success', 'Device deleted successfully!');
    } catch (error: any) {
      console.error('Delete error:', error);
      showToast('error', error.response?.data?.message || error.message || 'Failed to delete device');
      setShowDeleteModal(false);
      setDeletingDevice(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── handleBlock — opens modal ──
  const handleBlock = (device: AuthorizedDevice) => {
    setBlockingDevice(device);
    setBlockReason('');
    setShowBlockModal(true);
  };

  // ── handleBlockSubmit ──
  const handleBlockSubmit = async () => {
    if (!blockingDevice) return;
    setIsBlocking(true);
    try {
      await authorizedDevicesAPI.block(blockingDevice.id, blockReason.trim());
      setDevices(prev => prev.map(d =>
        d.id === blockingDevice.id ? { ...d, is_blocked: true, block_reason: blockReason.trim() } : d
      ));
      showToast('success', 'Device blocked successfully!');
      setShowBlockModal(false);
      setBlockingDevice(null);
      setBlockReason('');
    } catch (error: any) {
      console.error('Block error:', error);
      showToast('error', extractError(error));
    } finally {
      setIsBlocking(false);
    }
  };

  // ── handleActivateDeactivate ──
  const handleActivateDeactivate = async (device: AuthorizedDevice) => {
    try {
      await authorizedDevicesAPI.update(device.id, { is_active: !device.is_active });
      setDevices(prev => prev.map(d => d.id === device.id ? { ...d, is_active: !device.is_active } : d));
      showToast('success', device.is_active ? 'Device deactivated.' : 'Device activated.');
    } catch (error: any) {
      console.error('Activate/Deactivate error:', error);
      showToast('error', extractError(error));
    }
  };

  // ── handleApproveRequest
  // CHANGED: pre-fill approvalDeviceName from suggested_device_name if available
  const handleApproveRequest = (request: DeviceApprovalRequest) => {
    setApprovingRequest(request);
    setApprovalDeviceName(
      request.suggested_device_name?.trim()
        ? request.suggested_device_name.trim()
        : `Device ${devices.length + 1}`
    );
    setShowApprovalModal(true);
  };

  // ── handleApprovalSubmit (UNTOUCHED logic) ──
  const handleApprovalSubmit = async () => {
    if (!approvingRequest || !approvalDeviceName.trim()) {
      setError('Please enter a device name');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await authorizedDevicesAPI.approveRequest({
        request_id: approvingRequest.id,
        device_name: approvalDeviceName,
      });
      setPendingRequests(prev => prev.filter(r => r.id !== approvingRequest.id));
      await fetchData();
      setShowApprovalModal(false);
      setApprovingRequest(null);
      setApprovalDeviceName('');
      showToast('success', 'Device approved successfully!');
    } catch (error: any) {
      console.error('Approval error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to approve device');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── handleRejectRequest ──
  const handleRejectRequest = (request: DeviceApprovalRequest) => {
    setRejectingRequest(request);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // ── handleRejectSubmit ──
  const handleRejectSubmit = async () => {
    if (!rejectingRequest) return;
    setIsRejecting(true);
    try {
      await authorizedDevicesAPI.rejectRequest({
        request_id: rejectingRequest.id,
        rejection_reason: rejectReason.trim() || undefined,
      });
      setPendingRequests(prev => prev.filter(r => r.id !== rejectingRequest.id));
      showToast('success', 'Request rejected successfully!');
      setShowRejectModal(false);
      setRejectingRequest(null);
      setRejectReason('');
    } catch (error: any) {
      console.error('Rejection error:', error);
      showToast('error', error.response?.data?.error || error.message || 'Failed to reject request');
    } finally {
      setIsRejecting(false);
    }
  };

  // ── handleCopyDeviceCheckLink ──
  const handleCopyDeviceCheckLink = () => {
    const url = `${window.location.origin}/assessment/device-check`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  // ── resetForm (UNTOUCHED) ──
  const resetForm = () => {
    setFormData({
      device_name: '',
      device_type: 'desktop',
      device_fingerprint: '',
      browser_fingerprint: '',
      ip_address: '',
      user_agent: '',
      is_active: true,
    });
    setEditingDevice(null);
  };

  // ── Derived stats ──
  const totalActive   = devices.filter(d => d.is_active && d.is_authorized && !d.is_blocked).length;
  const totalBlocked  = devices.filter(d => d.is_blocked).length;
  const totalInactive = devices.filter(d => !d.is_active || !d.is_authorized).length;

  const filteredDevices = devices.filter(d =>
    d.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.device_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-white";
  const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";

  // ── Access guard ──
  if (!canView) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Access Denied</h2>
        <p className="text-sm text-slate-500">You don't have permission to view authorized devices.</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* ── Confirm Delete Modal ── */}
      <ConfirmModal
        open={showDeleteModal}
        deviceName={deletingDevice?.device_name ?? ''}
        isDeleting={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => { setShowDeleteModal(false); setDeletingDevice(null); }}
      />

      {/* ── Add / Edit Device Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="h-4 w-4" />
                {editingDevice ? 'Edit Device' : 'Authorize Device'}
              </h3>
              <button onClick={() => { setShowForm(false); setError(null); }} disabled={isSubmitting}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="whitespace-pre-line flex-1">{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0"><X className="h-4 w-4" /></button>
              </div>
            )}

            <form id="device-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
              <div className="p-6 space-y-4">

                <div>
                  <label className={labelCls}>Device Name <span className="text-red-400 normal-case">*</span></label>
                  <input type="text" required value={formData.device_name}
                    onChange={e => setFormData({ ...formData, device_name: e.target.value })}
                    placeholder="e.g. John's Laptop" className={inputCls} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Device Type <span className="text-red-400 normal-case">*</span></label>
                    <select required value={formData.device_type}
                      onChange={e => setFormData({ ...formData, device_type: e.target.value as any })}
                      className={inputCls}>
                      <option value="desktop">Desktop</option>
                      <option value="laptop">Laptop</option>
                      <option value="tablet">Tablet</option>
                      <option value="mobile">Mobile</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>IP Address <span className="text-red-400 normal-case">*</span></label>
                    <input type="text" required value={formData.ip_address}
                      onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                      placeholder="e.g. 192.168.1.100" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Device Fingerprint <span className="text-red-400 normal-case">*</span></label>
                  <input type="text" required value={formData.device_fingerprint}
                    onChange={e => setFormData({ ...formData, device_fingerprint: e.target.value })}
                    placeholder="Auto-generated unique identifier"
                    className={`${inputCls} font-mono text-xs`} />
                  <p className="text-xs text-slate-400 mt-1">Unique identifier for this device</p>
                </div>

                <div>
                  <label className={labelCls}>User Agent <span className="text-red-400 normal-case">*</span></label>
                  <textarea required value={formData.user_agent}
                    onChange={e => setFormData({ ...formData, user_agent: e.target.value })}
                    rows={2} placeholder="Browser user agent string"
                    className={`${inputCls} font-mono text-xs resize-none`} />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Active</p>
                    <p className="text-xs text-slate-400 mt-0.5">Device can be used for exams</p>
                  </div>
                  <button type="button" role="switch" aria-checked={formData.is_active}
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-4 ${formData.is_active ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${formData.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

              </div>
            </form>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
              <button type="button" onClick={() => { setShowForm(false); setError(null); }} disabled={isSubmitting}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" form="device-form" disabled={isSubmitting}
                className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{editingDevice ? 'Updating...' : 'Authorizing...'}</>
                  : <><Check className="h-4 w-4" />{editingDevice ? 'Update Device' : 'Authorize Device'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approval Modal ── */}
      {showApprovalModal && approvingRequest && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">

            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Approve Device Request
              </h3>
              <button onClick={() => { setShowApprovalModal(false); setApprovingRequest(null); setError(null); }}
                disabled={isSubmitting}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
              </div>
            )}

            <div className="p-6 space-y-4">
              {/* Request info card */}
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Device Type</span>
                  <p className="mt-1 font-medium text-slate-800 capitalize">{approvingRequest.device_type}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">IP Address</span>
                  <p className="mt-1 font-mono text-slate-800">{approvingRequest.ip_address}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Requested</span>
                  <p className="mt-1 text-slate-700">{new Date(approvingRequest.requested_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fingerprint</span>
                  <p className="mt-1 font-mono text-xs text-slate-600 break-all">{approvingRequest.device_fingerprint?.slice(0, 20)}...</p>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  Device Name <span className="text-red-400 normal-case">*</span>
                  {/* Show a hint if the student provided a suggested name */}
                  {approvingRequest.suggested_device_name?.trim() && (
                    <span className="normal-case font-normal text-emerald-600 ml-1">
                      (suggested by student)
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={approvalDeviceName}
                  onChange={e => setApprovalDeviceName(e.target.value)}
                  placeholder="e.g. Lab Computer 1, Student's Phone"
                  className={inputCls}
                />
                <p className="text-xs text-slate-400 mt-1">
                  You can keep the student's suggested name or enter a different one.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => { setShowApprovalModal(false); setApprovingRequest(null); setError(null); }}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleApprovalSubmit} disabled={isSubmitting || !approvalDeviceName.trim()}
                className="px-5 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-emerald-200">
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Approving...</>
                  : <><Check className="h-4 w-4" /> Approve Device</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {showRejectModal && rejectingRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Reject Device Request
              </h3>
              <button onClick={() => { setShowRejectModal(false); setRejectingRequest(null); setRejectReason(''); }}
                disabled={isRejecting}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Device Type</span>
                  <p className="mt-1 font-medium text-slate-800 capitalize">{rejectingRequest.device_type}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">IP Address</span>
                  <p className="mt-1 font-mono text-slate-800">{rejectingRequest.ip_address}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Requested</span>
                  <p className="mt-1 text-slate-700">{new Date(rejectingRequest.requested_at).toLocaleString()}</p>
                </div>
                {/* Show student-suggested name if available */}
                {rejectingRequest.suggested_device_name?.trim() && (
                  <div className="col-span-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Student's Device Name</span>
                    <p className="mt-1 text-slate-700">{rejectingRequest.suggested_device_name}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Rejection Reason <span className="normal-case font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Unrecognised device, not from approved lab..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition bg-white resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => { setShowRejectModal(false); setRejectingRequest(null); setRejectReason(''); }}
                disabled={isRejecting}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleRejectSubmit} disabled={isRejecting}
                className="px-5 py-2 text-sm bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-red-200">
                {isRejecting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Rejecting...</>
                  : <><X className="h-4 w-4" /> Reject Request</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Block Device Modal ── */}
      {showBlockModal && blockingDevice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                  <Ban className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Block Device</h3>
                  <p className="text-xs text-slate-400 mt-0.5">"{blockingDevice.device_name}"</p>
                </div>
              </div>
              <button onClick={() => { setShowBlockModal(false); setBlockingDevice(null); setBlockReason(''); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-slate-600 mb-4">
                Blocking this device will prevent it from being used for exams. You can unblock it later.
              </p>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Reason <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                placeholder="Enter reason for blocking this device..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => { setShowBlockModal(false); setBlockingDevice(null); setBlockReason(''); }}
                disabled={isBlocking}
                className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleBlockSubmit} disabled={isBlocking}
                className="px-5 py-2 text-sm bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold rounded-xl hover:from-red-700 hover:to-rose-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-red-200">
                {isBlocking
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Blocking...</>
                  : <><Ban className="h-4 w-4" /> Block Device</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-emerald-200">
              <Shield className="h-5 w-5 text-white" />
            </div>
            Authorized Devices
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Manage devices authorized to access the examination system</p>
        </div>

        {canCreate && activeTab === 'devices' && (
          <div className="flex items-center gap-3 flex-wrap">
            {isCurrentDeviceAuthorized() ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-medium text-emerald-800">This device is authorized</span>
              </div>
            ) : (
              <button onClick={handleCaptureCurrentDevice} disabled={capturingDevice}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200 disabled:opacity-50">
                {capturingDevice
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Capturing...</>
                  : <><Zap className="h-4 w-4" /> Approve This Device</>}
              </button>
            )}
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
              <Plus className="h-4 w-4" /> Add Device Manually
            </button>
          </div>
        )}
      </div>

      {/* ── Stat Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Devices', value: devices.length, icon: Shield, color: 'from-emerald-500 to-teal-600' },
          { label: 'Active', value: totalActive, icon: CheckCircle, color: 'from-blue-500 to-cyan-600' },
          { label: 'Inactive', value: totalInactive, icon: XCircle, color: 'from-slate-400 to-slate-500' },
          { label: 'Blocked', value: totalBlocked, icon: Ban, color: 'from-red-500 to-rose-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-lg font-bold text-slate-800">{loading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Page-level error ── */}
      {error && !showForm && !showApprovalModal && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1 whitespace-pre-line">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* ── Main Card with Tabs ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Tab bar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5">
          <div className="flex">
            <button onClick={() => setActiveTab('devices')}
              className={`flex items-center gap-2 py-4 px-1 mr-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'devices'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}>
              <Shield className="h-4 w-4" />
              Authorized Devices
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'devices' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>{devices.length}</span>
            </button>

            <button onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'pending'
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}>
              <Clock className="h-4 w-4" />
              Pending Approvals
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Search + refresh (devices tab only) */}
          {activeTab === 'devices' && (
            <div className="flex items-center gap-2 py-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input type="text" placeholder="Search devices..." value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none w-44" />
              </div>
              <button onClick={fetchData} title="Refresh"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div className="p-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
            <p className="mt-2 text-sm text-slate-400">Loading...</p>
          </div>

        ) : activeTab === 'devices' ? (
          // ── Devices Tab ──
          filteredDevices.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-7 w-7 text-emerald-300" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">
                {searchTerm ? 'No devices match your search' : 'No Authorized Devices'}
              </h3>
              <p className="text-sm text-slate-400 mb-5">
                {searchTerm ? 'Try different keywords.' : 'Get started by authorizing your first device.'}
              </p>
              {!searchTerm && canCreate && (
                <div className="flex items-center justify-center gap-3">
                  <button onClick={handleCaptureCurrentDevice} disabled={capturingDevice}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-200 disabled:opacity-50">
                    {capturingDevice ? <><Loader2 className="h-4 w-4 animate-spin" /> Capturing...</> : <><Zap className="h-4 w-4" /> Approve This Device</>}
                  </button>
                  <button onClick={() => { resetForm(); setShowForm(true); }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-200">
                    <Plus className="h-4 w-4" /> Add Manually
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_140px] items-center gap-4 px-5 py-3 bg-slate-50/60 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Device</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">IP Address</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Used</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</span>
              </div>

              <div className="divide-y divide-slate-50">
                {filteredDevices.map(device => {
                  const DeviceIcon = getDeviceIcon(device.device_type);
                  const isThisDevice = currentDeviceFingerprint && device.device_fingerprint === currentDeviceFingerprint;
                  const isFullyActive = device.is_active && device.is_authorized && !device.is_blocked;

                  return (
                    <div key={device.id}>
                      <div className="grid grid-cols-[1fr_auto_auto_auto_140px] items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">

                        {/* Device name + type */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isFullyActive ? 'bg-emerald-100' : device.is_blocked ? 'bg-red-100' : 'bg-slate-100'
                          }`}>
                            <DeviceIcon className={`h-4 w-4 ${
                              isFullyActive ? 'text-emerald-600' : device.is_blocked ? 'text-red-500' : 'text-slate-400'
                            }`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-slate-900 truncate">{device.device_name}</p>
                              {isThisDevice && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md whitespace-nowrap flex-shrink-0">YOU</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 capitalize">{device.device_type}</p>
                          </div>
                        </div>

                        {/* IP */}
                        <span className="text-sm font-mono text-slate-600 whitespace-nowrap">{device.ip_address}</span>

                        {/* Last used */}
                        <div className="text-sm text-slate-500 whitespace-nowrap text-right">
                          <p>{device.last_used ? new Date(device.last_used).toLocaleDateString() : 'Never'}</p>
                          {device.times_used > 0 && <p className="text-xs text-slate-400">{device.times_used}×</p>}
                        </div>

                        {/* Status badge */}
                        {device.is_blocked ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <Ban className="h-3 w-3" /> Blocked
                          </span>
                        ) : isFullyActive ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                          </span>
                        ) : device.status_display === 'Pending Approval' ? (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full whitespace-nowrap">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> {device.status_display || 'Inactive'}
                          </span>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1">
                          {/* Block / Unblock */}
                          {canEdit && (
                            device.is_blocked ? (
                              <button title="Unblock"
                                onClick={async () => {
                                  try {
                                    await authorizedDevicesAPI.unblock(device.id);
                                    setDevices(prev => prev.map(d =>
                                      d.id === device.id ? { ...d, is_blocked: false, block_reason: '' } : d
                                    ));
                                    showToast('success', 'Device unblocked successfully!');
                                  } catch (error: any) {
                                    showToast('error', error.response?.data?.message || 'Failed to unblock device');
                                  }
                                }}
                                className="p-2 rounded-lg text-emerald-600 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-all">
                                <CheckCircle className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button onClick={() => handleBlock(device)} title="Block"
                                className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            )
                          )}

                          {/* Edit */}
                          {canEdit && (
                            <button onClick={() => handleEdit(device)} title="Edit"
                              className="p-2 rounded-lg text-amber-600 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-all">
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          {canDelete && (
                            <button onClick={() => { setDeletingDevice(device); setShowDeleteModal(true); }} title="Delete"
                              className="p-2 rounded-lg text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 transition-all">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Expand */}
                          <button onClick={() => setExpandedId(expandedId === device.id ? null : device.id)} title="Details"
                            className="p-2 rounded-lg text-slate-500 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-all">
                            {expandedId === device.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded row */}
                      {expandedId === device.id && (
                        <div className="px-5 pb-4">
                          <div className="ml-12 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Device ID</span>
                              <p className="mt-1 text-slate-700 font-medium">#{device.id}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Times Used</span>
                              <p className="mt-1 text-slate-700 font-medium">{device.times_used ?? 0}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Authorized</span>
                              <p className={`mt-1 font-medium ${device.is_authorized ? 'text-emerald-600' : 'text-red-500'}`}>
                                {device.is_authorized ? 'Yes' : 'No'}
                              </p>
                            </div>
                            {device.block_reason && (
                              <div className="col-span-2 sm:col-span-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Block Reason</span>
                                <p className="mt-1 text-red-600">{device.block_reason}</p>
                              </div>
                            )}
                            <div className="col-span-2 sm:col-span-3">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Fingerprint</span>
                              <p className="mt-1 font-mono text-xs text-slate-600 break-all">{device.device_fingerprint}</p>
                            </div>
                            {device.user_agent && (
                              <div className="col-span-2 sm:col-span-3">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">User Agent</span>
                                <p className="mt-1 font-mono text-xs text-slate-500 break-all">{device.user_agent}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer count */}
              <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40">
                <p className="text-xs text-slate-400">
                  Showing {filteredDevices.length} of {devices.length} device{devices.length !== 1 ? 's' : ''}
                  {searchTerm ? ' · filtered' : ''}
                </p>
              </div>
            </>
          )

        ) : (
          // ── Pending Approvals Tab ──
          pendingRequests.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Clock className="h-7 w-7 text-amber-300" />
              </div>
              <h3 className="font-semibold text-slate-700 mb-1">No Pending Requests</h3>
              <p className="text-sm text-slate-400">All device approval requests have been processed.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pendingRequests.map(request => {
                const DeviceIcon = getDeviceIcon(request.device_type);
                return (
                  <div key={request.id} className="p-5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <DeviceIcon className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-900 capitalize">{request.device_type} Device</h3>
                            {/* Show student's suggested name as a badge if provided */}
                            {request.suggested_device_name?.trim() && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                <Smartphone className="h-3 w-3" />
                                {request.suggested_device_name}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                              <Clock className="h-3 w-3" /> Pending
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                            <div className="flex gap-2">
                              <span className="text-slate-400 flex-shrink-0">IP:</span>
                              <span className="font-mono text-slate-700">{request.ip_address}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-slate-400 flex-shrink-0">Requested:</span>
                              <span className="text-slate-600">{new Date(request.requested_at).toLocaleString()}</span>
                            </div>
                            <div className="flex gap-2 sm:col-span-2">
                              <span className="text-slate-400 flex-shrink-0">Fingerprint:</span>
                              <span className="font-mono text-xs text-slate-500 break-all">{request.device_fingerprint}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleApproveRequest(request)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
                          <Check className="h-4 w-4" /> Approve
                        </button>
                        <button onClick={() => handleRejectRequest(request)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors shadow-sm">
                          <X className="h-4 w-4" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── Info card ── */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-900 mb-1">About Device Authorization</h3>
            <p className="text-sm text-emerald-800 mb-3">
              Device authorization ensures exam security by restricting access to approved devices only.
              Use "Approve This Device" for quick one-click authorization, or add devices manually for more control.
            </p>
            <ul className="space-y-1 text-sm text-emerald-800 mb-4">
              {[
                'Each device is uniquely identified using browser fingerprinting',
                'Blocked devices cannot access the system even if previously authorized',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-emerald-600 mt-2 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* Device check link */}
            <div className="bg-white border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Link className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-900">Device Check Page</p>
                <p className="text-xs text-slate-500 truncate font-mono mt-0.5">/assessment/device-check</p>
              </div>
              <button
                onClick={handleCopyDeviceCheckLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex-shrink-0 ${
                  linkCopied
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                {linkCopied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Link</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}