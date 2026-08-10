'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { attendanceDevicesAPI } from '@/lib/service/attendance';
import type { AttendanceDevice, DeviceType } from '@/lib/types/attendance';
import {
  ScanLine, Plus, Edit3, Trash2, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, RefreshCw,
  Fingerprint, Barcode, MapPin, Wifi, WifiOff, Info,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
let _toastId = 0;
interface ToastItem { id: number; type: 'success' | 'error'; message: string; }

function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d.slice(0, 150);
    if (d.detail) return String(d.detail).slice(0, 150);
    if (d.message) return String(d.message).slice(0, 150);
  }
  return err?.message || 'An unexpected error occurred.';
}

const DEVICE_TYPE_META: Record<DeviceType, { label: string; icon: any; color: string; bg: string; border: string }> = {
  ZKTECO:           { label: 'ZKTeco',          icon: Fingerprint, color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  R4500:            { label: 'DigitalPersona R4500', icon: Fingerprint, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
  BARCODE_SCANNER:  { label: 'Barcode Scanner', icon: Barcode,     color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  OTHER:            { label: 'Other',           icon: ScanLine,    color: 'text-slate-700',   bg: 'bg-slate-100',  border: 'border-slate-200' },
};

// ─── Toast Stack ───────────────────────────────────────────────────────────────
function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm
          ${t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          {t.type === 'success'
            ? <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-emerald-600" />
            : <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-500" />}
          <p className="text-sm font-medium flex-1 leading-snug">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="opacity-50 hover:opacity-100 flex-shrink-0 ml-2">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────
function ConfirmDeleteModal({ open, device, isDeleting, onConfirm, onCancel }: {
  open: boolean; device: AttendanceDevice | null; isDeleting: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open || !device) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 text-center mb-1">Delete Device</h3>
        <p className="text-sm text-slate-500 text-center mb-6">
          Remove <span className="font-semibold text-slate-700">"{device.name}"</span>? Historical attendance events already recorded through this device are kept — only the device registration is removed.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isDeleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting...</> : <><Trash2 className="h-4 w-4" /> Delete</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Device Modal ───────────────────────────────────────────────────────────────
interface DeviceFormValues {
  device_id: string;
  name: string;
  device_type: DeviceType;
  location: string;
  is_active: boolean;
}

function DeviceModal({ editing, isSaving, onSave, onClose, showToast }: {
  editing: AttendanceDevice | null; isSaving: boolean;
  onSave: (data: Partial<AttendanceDevice>) => Promise<void>; onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [form, setForm] = useState<DeviceFormValues>(
    editing ? {
      device_id: editing.device_id,
      name: editing.name,
      device_type: editing.device_type,
      location: editing.location || '',
      is_active: editing.is_active,
    } : {
      device_id: '',
      name: '',
      device_type: 'ZKTECO',
      location: '',
      is_active: true,
    }
  );

  const set = <K extends keyof DeviceFormValues>(key: K, value: DeviceFormValues[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.device_id.trim()) { showToast('error', 'Device serial number / ID is required.'); return; }
    if (!form.name.trim()) { showToast('error', 'A friendly device name is required.'); return; }
    try {
      await onSave(form);
    } catch (err) {
      showToast('error', extractError(err));
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white font-medium text-slate-800";
  const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            {editing ? 'Edit Device' : 'Register Device'}
          </h3>
          <button onClick={onClose} disabled={isSaving} className="text-white/80 hover:text-white p-1 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          <form id="device-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={labelCls}>Device Type <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(DEVICE_TYPE_META) as DeviceType[]).map(type => {
                  const meta = DEVICE_TYPE_META[type];
                  const active = form.device_type === type;
                  return (
                    <button key={type} type="button" onClick={() => set('device_type', type)}
                      className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 text-xs font-bold transition-all ${
                        active ? `${meta.bg} ${meta.color} ${meta.border}` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      }`}>
                      <meta.icon className="h-4 w-4" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Any device type can be used for either capture/enrollment or gate authentication — this is just what the physical unit is, not what role it plays.
              </p>
            </div>

            <div>
              <label className={labelCls}>Friendly Name <span className="text-red-500">*</span></label>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Main Gate ZKTeco, Front Office R4500" className={inputCls} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Device Serial / ID <span className="text-red-500">*</span></label>
                <input required type="text" value={form.device_id} onChange={e => set('device_id', e.target.value)}
                  placeholder="e.g. serial number" className={inputCls + ' font-mono'} disabled={!!editing} />
                {editing && <p className="text-[11px] text-slate-400 mt-1">Locked after registration.</p>}
              </div>
              <div>
                <label className={labelCls}>Location</label>
                <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                  placeholder="e.g. Main Gate, Front Office" className={inputCls} />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-800">Active</p>
                <p className="text-xs text-slate-500">Inactive devices stop being polled/accepted for new events</p>
              </div>
              <button type="button" role="switch" aria-checked={form.is_active} onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0 ml-3 ${form.is_active ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </form>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl">
            Cancel
          </button>
          <button type="submit" form="device-form" disabled={isSaving} className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2">
            {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" />{editing ? 'Updating...' : 'Saving...'}</> : <><Check className="h-4 w-4" />{editing ? 'Update Device' : 'Register Device'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendanceDevicesPage() {
  const { hasPermission, user } = useAuth();

  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [activeTypeFilter, setActiveTypeFilter] = useState<DeviceType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AttendanceDevice | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingDevice, setDeletingDevice] = useState<AttendanceDevice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const canCreate = user?.is_superuser || hasPermission('attendance.add_attendancedevicemodel');
  const canEdit   = user?.is_superuser || hasPermission('attendance.change_attendancedevicemodel');
  const canDelete = user?.is_superuser || hasPermission('attendance.delete_attendancedevicemodel');

  const showToast = (type: 'success' | 'error', message: string) => {
    const id = ++_toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const res = await attendanceDevicesAPI.list({ page_size: 500 });
      setDevices(res.results || []);
    } catch (err) {
      setPageError(extractError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const openCreate = () => { setEditingDevice(null); setShowModal(true); };
  const openEdit = (device: AttendanceDevice) => { setEditingDevice(device); setShowModal(true); };

  const handleSave = async (form: Partial<AttendanceDevice>) => {
    setIsSaving(true);
    try {
      if (editingDevice) {
        const updated = await attendanceDevicesAPI.update(editingDevice.id, form);
        setDevices(prev => prev.map(d => d.id === updated.id ? updated : d));
        showToast('success', `"${updated.name}" updated successfully.`);
      } else {
        const created = await attendanceDevicesAPI.create(form);
        setDevices(prev => [created, ...prev]);
        showToast('success', `"${created.name}" registered successfully.`);
      }
      setShowModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDevice) return;
    setIsDeleting(true);
    try {
      await attendanceDevicesAPI.delete(deletingDevice.id);
      setDevices(prev => prev.filter(d => d.id !== deletingDevice.id));
      showToast('success', `"${deletingDevice.name}" removed successfully.`);
      setDeletingDevice(null);
    } catch (err) {
      showToast('error', extractError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const activeTypesInUse = Array.from(new Set(devices.filter(d => d.is_active).map(d => d.device_type)));
  const hasMixedDeviceTypes = activeTypesInUse.length > 1;

  const typeCounts = (Object.keys(DEVICE_TYPE_META) as DeviceType[]).reduce((acc, type) => {
    acc[type] = devices.filter(d => d.device_type === type).length;
    return acc;
  }, {} as Record<DeviceType, number>);

  const filteredDevices = devices
    .filter(d => activeTypeFilter === 'all' || d.device_type === activeTypeFilter)
    .filter(d =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.location || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter(d => !showActiveOnly || d.is_active);

  const activeCount = devices.filter(d => d.is_active).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      <ConfirmDeleteModal open={!!deletingDevice} device={deletingDevice} isDeleting={isDeleting}
        onConfirm={handleDelete} onCancel={() => setDeletingDevice(null)} />

      {showModal && (
        <DeviceModal editing={editingDevice} isSaving={isSaving} onSave={handleSave} onClose={() => setShowModal(false)} showToast={showToast} />
      )}

      {!loading && hasMixedDeviceTypes && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl flex-shrink-0 shadow-sm"><Info className="h-5 w-5" /></div>
          <div>
            <h4 className="text-sm font-bold text-amber-950">Multiple Device Types Active</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              You have {activeTypesInUse.map(t => DEVICE_TYPE_META[t].label).join(', ')} devices all active.
              Fingerprint templates are not interchangeable across reader brands — make sure a person is enrolled
              on the <em>same device type</em> they'll actually be authenticated on (e.g. a template captured
              on an R4500 will not be recognized by a ZKTeco gate reader, and vice versa).
            </p>
          </div>
        </div>
      )}

      {pageError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {pageError}
          </div>
          <button onClick={fetchDevices} className="text-sm text-red-700 underline flex items-center gap-1 flex-shrink-0">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Attendance Devices</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Gate terminals, enrollment stations, and barcode scanners</p>
          </div>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Register Device
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Devices', value: devices.length, icon: ScanLine, color: 'from-blue-600 to-indigo-600' },
          { label: 'Active', value: activeCount, icon: Wifi, color: 'from-emerald-500 to-teal-600' },
          { label: 'Inactive', value: devices.length - activeCount, icon: WifiOff, color: 'from-slate-400 to-slate-500' },
          { label: 'Device Types in Use', value: activeTypesInUse.length, icon: Info, color: hasMixedDeviceTypes ? 'from-amber-500 to-orange-600' : 'from-violet-500 to-purple-600' },
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

      <div className="flex border-b border-slate-200 gap-6 px-2 overflow-x-auto">
        <button type="button" onClick={() => setActiveTypeFilter('all')}
          className={`flex items-center gap-2 py-3.5 text-sm font-bold border-b-2 transition-all -mb-px whitespace-nowrap ${
            activeTypeFilter === 'all' ? 'text-blue-600 border-blue-600' : 'text-slate-500 border-transparent hover:text-slate-800'
          }`}>
          All Devices
          <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${activeTypeFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>{devices.length}</span>
        </button>
        {(Object.keys(DEVICE_TYPE_META) as DeviceType[]).filter(t => typeCounts[t] > 0).map(type => {
          const meta = DEVICE_TYPE_META[type];
          const active = activeTypeFilter === type;
          return (
            <button key={type} type="button" onClick={() => setActiveTypeFilter(type)}
              className={`flex items-center gap-2 py-3.5 text-sm font-bold border-b-2 transition-all -mb-px whitespace-nowrap ${
                active ? `${meta.color} border-current` : 'text-slate-500 border-transparent hover:text-slate-800'
              }`}>
              <meta.icon className="h-4 w-4" /> {meta.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${active ? `${meta.bg} ${meta.color}` : 'bg-slate-100 text-slate-500'}`}>{typeCounts[type]}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search by name, serial, or location..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <button type="button" role="switch" aria-checked={showActiveOnly} onClick={() => setShowActiveOnly(v => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showActiveOnly ? 'bg-blue-600' : 'bg-slate-200'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showActiveOnly ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm font-semibold text-slate-700">Active Only</span>
          </label>
          <button onClick={fetchDevices} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-slate-400 font-medium">Loading devices...</p>
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
            <ScanLine className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 text-base mb-1">
            {searchTerm ? 'No matching devices found' : 'No Devices Registered'}
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            {searchTerm ? 'Try adjusting your search query.' : 'Register your gate terminals and enrollment stations to start using attendance.'}
          </p>
          {!searchTerm && canCreate && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold rounded-xl shadow-md">
              <Plus className="h-4 w-4" /> Register First Device
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredDevices.map(device => {
            const meta = DEVICE_TYPE_META[device.device_type];
            return (
              <div key={device.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
                <div className={`h-1.5 w-full bg-gradient-to-r ${device.is_active ? 'from-blue-500 to-indigo-500' : 'from-slate-300 to-slate-400'}`} />
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg} ${meta.color}`}>
                        <meta.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 truncate text-base">{device.name}</h3>
                        <p className="text-xs text-slate-500 font-medium truncate">{meta.label}</p>
                      </div>
                    </div>
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${device.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {device.is_active ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {device.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200/60">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Serial / ID</p>
                      <p className="font-mono font-bold text-slate-900 text-sm mt-0.5 truncate">{device.device_id}</p>
                    </div>
                    <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Location</p>
                      <p className="font-semibold text-slate-700 text-sm mt-0.5 flex items-center sm:justify-end gap-1 truncate">
                        {device.location ? <><MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" /> {device.location}</> : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    {canEdit && (
                      <button onClick={() => openEdit(device)} title="Edit Device"
                        className="p-2 rounded-lg text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all">
                        <Edit3 className="h-4 w-4" />
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => setDeletingDevice(device)} title="Delete Device"
                        className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}