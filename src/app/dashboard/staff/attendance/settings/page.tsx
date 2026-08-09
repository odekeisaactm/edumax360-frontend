'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { attendanceSettingsAPI } from '@/lib/service/attendance';
import { AttendanceSettings, AttendanceMethod } from '@/lib/types/attendance';
import {
  Settings, Edit3, Check, X, AlertCircle, Loader2, RefreshCw,
  ClipboardCheck, Clock, Bell, ScanLine, Zap, Lock, CheckCircle2,
  Timer, Users, Wallet,
} from 'lucide-react';

// ─── Default form ──────────────────────────────────────────────────────────────
const DEFAULT_FORM: Partial<AttendanceSettings> = {
  gate_primary_method: 'FINGERPRINT',
  gate_fallback_method: 'BARCODE',
  class_primary_method: 'MANUAL',
  class_fallback_method: 'MANUAL',
  is_subject_attendance_enabled: false,

  student_expected_entry_time: '07:00:00',
  student_minimum_departure_time: '12:00:00',
  student_late_grace_minutes: 15,

  staff_expected_entry_time: '07:30:00',
  staff_minimum_departure_time: '15:00:00',
  staff_late_grace_minutes: 10,

  temp_exit_return_timer_minutes: 120,
  staff_to_parent_alert_delay_minutes: 30,
  parent_alert_enabled_for_temp_exit: true,

  online_event_min_duration_minutes: 20,

  is_sms_compulsory: false,
  is_email_compulsory: false,
  sms_payer: 'PARENT',
  low_school_sms_balance_threshold: '500.00',
  low_sms_balance_threshold_per_ward: '50.00',
};

function settingsToForm(s: AttendanceSettings): Partial<AttendanceSettings> {
  return { ...DEFAULT_FORM, ...s };
}

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  FINGERPRINT: 'Fingerprint',
  BARCODE: 'Barcode',
  MANUAL: 'Manual Roll Call',
};

function formatTime(t?: string | null) {
  if (!t) return '—';
  return t.slice(0, 5); // "HH:MM:SS" → "HH:MM"
}

// ─── Reusable components (same shape as the result settings page) ─────────────

function Toggle({ checked, onChange, label, description }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex-shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function StatusBadge({ value, activeLabel = 'Enabled', inactiveLabel = 'Disabled', danger = false }: {
  value: boolean; activeLabel?: string; inactiveLabel?: string; danger?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      value
        ? danger ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
        : 'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${value ? danger ? 'bg-red-500' : 'bg-emerald-500' : 'bg-slate-400'}`} />
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

function SettingRow({ icon: Icon, iconBg, label, value, description }: {
  icon: any; iconBg: string; label: string; value: React.ReactNode; description: string;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-4 hover:bg-slate-50/70 rounded-xl transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 truncate">{description}</p>
      </div>
      <div className="flex-shrink-0">{value}</div>
    </div>
  );
}

const inputCls = "w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white";
const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5";
const selectCls = inputCls;

// ─── Settings Modal ────────────────────────────────────────────────────────────
function SettingsModal({ settings, isSaving, onSave, onClose }: {
  settings: AttendanceSettings | null;
  isSaving: boolean;
  onSave: (f: Partial<AttendanceSettings>) => Promise<void>;
  onClose: () => void;
}) {
  type Tab = 'methods' | 'time_windows' | 'escalation' | 'notifications';
  const [activeTab, setActiveTab] = useState<Tab>('methods');
  const [form, setForm] = useState<Partial<AttendanceSettings>>(
    settings ? settingsToForm(settings) : DEFAULT_FORM
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof AttendanceSettings>(key: K, value: AttendanceSettings[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    try {
      await onSave(form);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.detail) {
        setSaveError(data.detail);
      } else if (typeof data === 'object') {
        const msgs = Object.entries(data)
          .map(([f, m]: [string, any]) => `${f.replace(/_/g, ' ')}: ${Array.isArray(m) ? m.join(', ') : m}`)
          .join('\n');
        setSaveError(msgs);
      } else {
        setSaveError(err?.message || 'Failed to save attendance settings.');
      }
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'methods', label: 'Methods & Scope', icon: ScanLine },
    { id: 'time_windows', label: 'Time Windows', icon: Clock },
    { id: 'escalation', label: 'Escalation', icon: Timer },
    { id: 'notifications', label: 'Notifications & Billing', icon: Bell },
  ];

  const methodOptions = (
    <>
      <option value="FINGERPRINT">Fingerprint</option>
      <option value="BARCODE">Barcode</option>
      <option value="MANUAL">Manual Roll Call</option>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col h-[85vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {settings ? 'Edit Attendance Settings' : 'Create Attendance Settings'}
          </h3>
          <button onClick={onClose} disabled={isSaving}
            className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {saveError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{saveError}</span>
            <button onClick={() => setSaveError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-4 flex-shrink-0 gap-0.5 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === t.id ? 'text-blue-600 border-blue-600' : 'text-slate-400 border-transparent hover:text-slate-600'
              }`}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <form id="attendance-settings-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0">
          <div className="p-6 space-y-4">

            {/* ── Methods & Scope ── */}
            {activeTab === 'methods' && (
              <div className="space-y-5">
                <p className="text-xs text-slate-400">Which clock-in method applies at the gate vs. in class, and whether subject-level attendance is tracked.</p>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gate</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Primary Method</label>
                      <select value={form.gate_primary_method} onChange={e => set('gate_primary_method', e.target.value as AttendanceMethod)} className={selectCls}>
                        {methodOptions}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Fallback Method</label>
                      <select value={form.gate_fallback_method} onChange={e => set('gate_fallback_method', e.target.value as AttendanceMethod)} className={selectCls}>
                        {methodOptions}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Class</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Primary Method</label>
                      <select value={form.class_primary_method} onChange={e => set('class_primary_method', e.target.value as AttendanceMethod)} className={selectCls}>
                        {methodOptions}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Fallback Method</label>
                      <select value={form.class_fallback_method} onChange={e => set('class_fallback_method', e.target.value as AttendanceMethod)} className={selectCls}>
                        {methodOptions}
                      </select>
                    </div>
                  </div>
                </div>

                <Toggle checked={!!form.is_subject_attendance_enabled}
                  onChange={v => set('is_subject_attendance_enabled', v)}
                  label="Enable Subject-Level Attendance"
                  description="Track attendance per subject period, not just per class/gate" />

                <div>
                  <label className={labelCls}>Online Event Minimum Duration (minutes)</label>
                  <input type="number" min={1}
                    value={form.online_event_min_duration_minutes}
                    onChange={e => set('online_event_min_duration_minutes', Number(e.target.value))}
                    className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">Minimum time in an online event's meeting link to be marked present</p>
                </div>
              </div>
            )}

            {/* ── Time Windows ── */}
            {activeTab === 'time_windows' && (
              <div className="space-y-6">
                <p className="text-xs text-slate-400">
                  A tap before the minimum departure time is treated as a temporary exit, not a final departure.
                  Student and staff windows are kept separate since staff typically stay later.
                </p>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Students</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Expected Entry Time</label>
                      <input type="time" value={form.student_expected_entry_time?.slice(0, 5)}
                        onChange={e => set('student_expected_entry_time', `${e.target.value}:00`)}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Minimum Departure Time</label>
                      <input type="time" value={form.student_minimum_departure_time?.slice(0, 5)}
                        onChange={e => set('student_minimum_departure_time', `${e.target.value}:00`)}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Late Grace (minutes)</label>
                      <input type="number" min={0}
                        value={form.student_late_grace_minutes}
                        onChange={e => set('student_late_grace_minutes', Number(e.target.value))}
                        className={inputCls} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Staff</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Expected Entry Time</label>
                      <input type="time" value={form.staff_expected_entry_time?.slice(0, 5)}
                        onChange={e => set('staff_expected_entry_time', `${e.target.value}:00`)}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Minimum Departure Time</label>
                      <input type="time" value={form.staff_minimum_departure_time?.slice(0, 5)}
                        onChange={e => set('staff_minimum_departure_time', `${e.target.value}:00`)}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Late Grace (minutes)</label>
                      <input type="number" min={0}
                        value={form.staff_late_grace_minutes}
                        onChange={e => set('staff_late_grace_minutes', Number(e.target.value))}
                        className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Escalation ── */}
            {activeTab === 'escalation' && (
              <div className="space-y-5">
                <p className="text-xs text-slate-400">
                  A temporary exit (tap before minimum departure time) that isn't returned within the timer escalates:
                  staff are alerted first, then the parent — unless covered by an excursion/exception.
                </p>

                <div>
                  <label className={labelCls}>Temporary Exit Return Timer (minutes)</label>
                  <input type="number" min={1}
                    value={form.temp_exit_return_timer_minutes}
                    onChange={e => set('temp_exit_return_timer_minutes', Number(e.target.value))}
                    className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">How long before staff are alerted that someone hasn't returned</p>
                </div>

                <div>
                  <label className={labelCls}>Staff → Parent Alert Delay (minutes)</label>
                  <input type="number" min={1}
                    value={form.staff_to_parent_alert_delay_minutes}
                    onChange={e => set('staff_to_parent_alert_delay_minutes', Number(e.target.value))}
                    className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">Delay after the staff alert before the parent is alerted, if still unresolved</p>
                </div>

                <Toggle checked={!!form.parent_alert_enabled_for_temp_exit}
                  onChange={v => set('parent_alert_enabled_for_temp_exit', v)}
                  label="Enable Parent Alerts"
                  description="If off, only staff are ever alerted about unreturned temporary exits" />
              </div>
            )}

            {/* ── Notifications & Billing ── */}
            {activeTab === 'notifications' && (
              <div className="space-y-5">
                <p className="text-xs text-slate-400">Compulsory notification channels, who pays for SMS, and low-balance alert thresholds.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Toggle checked={!!form.is_sms_compulsory}
                    onChange={v => set('is_sms_compulsory', v)}
                    label="SMS Compulsory"
                    description="Overrides individual parent opt-out preference" />
                  <Toggle checked={!!form.is_email_compulsory}
                    onChange={v => set('is_email_compulsory', v)}
                    label="Email Compulsory"
                    description="Overrides individual parent opt-out preference" />
                </div>

                <div>
                  <label className={labelCls}>SMS Payer</label>
                  <select value={form.sms_payer} onChange={e => set('sms_payer', e.target.value as any)} className={selectCls}>
                    <option value="SCHOOL">School</option>
                    <option value="PARENT">Parent</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Low Balance Alert — Per Ward (₦)</label>
                    <input type="number" step="0.01" min="0"
                      value={form.low_sms_balance_threshold_per_ward}
                      onChange={e => set('low_sms_balance_threshold_per_ward', e.target.value)}
                      className={inputCls} />
                    <p className="text-xs text-slate-400 mt-1">Multiplied by a parent's active ward count for their effective threshold</p>
                  </div>
                  <div>
                    <label className={labelCls}>Low Balance Alert — School (₦)</label>
                    <input type="number" step="0.01" min="0"
                      value={form.low_school_sms_balance_threshold}
                      onChange={e => set('low_school_sms_balance_threshold', e.target.value)}
                      className={inputCls} />
                  </div>
                </div>

                {/* Platform-locked fields — read-only, never rendered as inputs */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Platform-Controlled</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-slate-400">Cost per SMS</p>
                      <p className="font-semibold text-slate-600">₦{settings?.sms_cost_per_message ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">School SMS Balance</p>
                      <p className="font-semibold text-slate-600">₦{settings?.school_sms_balance ?? '—'}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2">Set by the platform, not editable here.</p>
                </div>
              </div>
            )}

          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl flex-shrink-0">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="attendance-settings-form" disabled={isSaving}
            className="px-5 py-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-blue-200">
            {isSaving
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              : <><Check className="h-4 w-4" />{settings ? 'Save Changes' : 'Create Settings'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendanceSettingsPage() {
  const { hasPermission, user } = useAuth();
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<'not_found' | 'fetch_error' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const canEdit = user?.is_superuser || hasPermission('attendance.manage_attendance_settings');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await attendanceSettingsAPI.get();
      setSettings(data);
    } catch {
      setPageError('fetch_error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (form: Partial<AttendanceSettings>) => {
    setIsSaving(true);
    try {
      const updated = await attendanceSettingsAPI.update(form);
      setSettings(updated);
      setIsEditing(false);
      setPageError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ──
  if (loading) return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
        <p className="text-slate-400 text-sm">Loading attendance settings...</p>
      </div>
    </div>
  );

  // ── Fetch error ──
  if (pageError === 'fetch_error') return (
    <div className="min-h-[600px] flex items-center justify-center">
      <div className="max-w-sm text-center bg-white rounded-2xl shadow-xl border border-red-100 p-8 space-y-4">
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="h-7 w-7 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Failed to Load</h3>
        <p className="text-sm text-slate-500">Couldn't load attendance settings. Please try again.</p>
        <button onClick={fetchSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    </div>
  );

  const s = settings!;

  return (
    <div className="space-y-6 pb-10">

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg shadow-emerald-100">
            <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-800">Attendance settings saved successfully!</p>
          </div>
        </div>
      )}

      {isEditing && <SettingsModal settings={s} isSaving={isSaving} onSave={handleSave} onClose={() => setIsEditing(false)} />}

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-200">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            Attendance Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1 pl-12">Methods, time windows, escalation, and notification rules</p>
        </div>
        {canEdit && (
          <button onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200">
            <Edit3 className="h-4 w-4" /> Edit Settings
          </button>
        )}
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gate Method', value: METHOD_LABELS[s.gate_primary_method], icon: ScanLine, color: 'from-blue-500 to-blue-600' },
          { label: 'Student Entry', value: formatTime(s.student_expected_entry_time), icon: Clock, color: 'from-emerald-500 to-teal-600' },
          { label: 'Subject Attendance', value: s.is_subject_attendance_enabled ? 'Enabled' : 'Disabled', icon: CheckCircle2, color: s.is_subject_attendance_enabled ? 'from-emerald-500 to-teal-600' : 'from-slate-400 to-slate-500' },
          { label: 'SMS Payer', value: s.sms_payer === 'SCHOOL' ? 'School' : 'Parent', icon: Wallet, color: 'from-violet-500 to-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 truncate">{label}</p>
              <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Three cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Methods & Scope */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <ScanLine className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Methods & Scope</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={ScanLine} iconBg="bg-blue-50 text-blue-600"
              label="Gate Primary" description="Main gate clock-in method"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{METHOD_LABELS[s.gate_primary_method]}</span>} />
            <SettingRow icon={ScanLine} iconBg="bg-indigo-50 text-indigo-600"
              label="Gate Fallback" description="Used if primary method fails"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{METHOD_LABELS[s.gate_fallback_method]}</span>} />
            <SettingRow icon={Users} iconBg="bg-violet-50 text-violet-600"
              label="Class Primary" description="In-class roll call method"
              value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{METHOD_LABELS[s.class_primary_method]}</span>} />
            <SettingRow icon={CheckCircle2} iconBg="bg-emerald-50 text-emerald-600"
              label="Subject Attendance" description="Track attendance per subject period"
              value={<StatusBadge value={s.is_subject_attendance_enabled} />} />
          </div>
        </div>

        {/* Time Windows */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Time Windows</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Clock} iconBg="bg-emerald-50 text-emerald-600"
              label="Student Entry / Departure" description="Expected entry → minimum departure"
              value={<span className="text-xs font-bold text-slate-700">{formatTime(s.student_expected_entry_time)} – {formatTime(s.student_minimum_departure_time)}</span>} />
            <SettingRow icon={Clock} iconBg="bg-teal-50 text-teal-600"
              label="Staff Entry / Departure" description="Expected entry → minimum departure"
              value={<span className="text-xs font-bold text-slate-700">{formatTime(s.staff_expected_entry_time)} – {formatTime(s.staff_minimum_departure_time)}</span>} />
            <SettingRow icon={AlertCircle} iconBg="bg-amber-50 text-amber-600"
              label="Student Late Grace" description="Minutes after entry time before marked late"
              value={<span className="text-xs font-bold text-slate-700">{s.student_late_grace_minutes} min</span>} />
          </div>
        </div>

        {/* Escalation */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
              <Timer className="h-3.5 w-3.5 text-orange-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">Escalation</h3>
          </div>
          <div className="p-2">
            <SettingRow icon={Timer} iconBg="bg-orange-50 text-orange-600"
              label="Return Timer" description="Before staff are alerted"
              value={<span className="text-xs font-bold text-slate-700">{s.temp_exit_return_timer_minutes} min</span>} />
            <SettingRow icon={Bell} iconBg="bg-red-50 text-red-600"
              label="Staff → Parent Delay" description="Before parent is alerted, if unresolved"
              value={<span className="text-xs font-bold text-slate-700">{s.staff_to_parent_alert_delay_minutes} min</span>} />
            <SettingRow icon={Bell} iconBg="bg-rose-50 text-rose-600"
              label="Parent Alerts" description="Whether parents are ever alerted"
              value={<StatusBadge value={s.parent_alert_enabled_for_temp_exit} />} />
          </div>
        </div>
      </div>

      {/* ── Notifications & Billing card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
          <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
            <Bell className="h-3.5 w-3.5 text-purple-600" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Notifications & Billing</h3>
        </div>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2">
          <SettingRow icon={Bell} iconBg="bg-purple-50 text-purple-600"
            label="SMS Compulsory" description="Overrides individual parent opt-out"
            value={<StatusBadge value={s.is_sms_compulsory} />} />
          <SettingRow icon={Bell} iconBg="bg-indigo-50 text-indigo-600"
            label="Email Compulsory" description="Overrides individual parent opt-out"
            value={<StatusBadge value={s.is_email_compulsory} />} />
          <SettingRow icon={Wallet} iconBg="bg-violet-50 text-violet-600"
            label="SMS Payer" description="Who is charged for SMS notifications"
            value={<span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">{s.sms_payer === 'SCHOOL' ? 'School' : 'Parent'}</span>} />
          <SettingRow icon={Lock} iconBg="bg-slate-100 text-slate-500"
            label="Cost Per SMS" description="Platform-controlled, not editable here"
            value={<span className="text-xs font-bold text-slate-700">₦{s.sms_cost_per_message}</span>} />
        </div>
      </div>

      {/* Last updated */}
      {s.updated_at && (
        <p className="text-xs text-slate-400 text-right">
          Last updated: {new Date(s.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}