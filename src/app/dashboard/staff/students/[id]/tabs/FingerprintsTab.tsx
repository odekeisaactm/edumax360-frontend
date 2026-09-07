'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fingerprintsAPI } from '@/lib/api';
import { attendanceDevicesAPI } from '@/lib/service/attendance';
import { Student, StudentSettings } from '@/lib/types';
import type { DeviceType } from '@/lib/types/attendance';
import {
  Fingerprint, AlertCircle, Loader2, Check, X, RefreshCw,
  Trash2, ScanLine, Wifi, WifiOff, AlertTriangle
} from 'lucide-react';

interface Props {
  student: Student;
  settings: StudentSettings | null;
  refreshStudent: () => void;
}

const FINGER_OPTIONS = [
  { value: 'left_thumb', label: 'Left Thumb' },
  { value: 'left_index', label: 'Left Index' },
  { value: 'left_middle', label: 'Left Middle' },
  { value: 'left_ring', label: 'Left Ring' },
  { value: 'left_little', label: 'Left Little' },
  { value: 'right_thumb', label: 'Right Thumb' },
  { value: 'right_index', label: 'Right Index' },
  { value: 'right_middle', label: 'Right Middle' },
  { value: 'right_ring', label: 'Right Ring' },
  { value: 'right_little', label: 'Right Little' },
];

// Device types that are real HOST capture hardware (excludes barcode/other).
const CAPTURE_DEVICE_TYPES = ['DIGITAL_PERSONA', 'ZKTECO'];
const ZK_AGENT_BASE = 'http://127.0.0.1:8891';

function titleCase(str: string): string {
  return (str || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

declare global {
  interface Window {
    Fingerprint?: any;
    WebSdk?: any;
  }
}

const REQUIRED_SCANS = 4;
const STORAGE_KEY = 'attendance_capture_device_pref';

export default function FingerprintsTab({ student, settings, refreshStudent }: Props) {
  const [prints, setPrints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [registeredTypes, setRegisteredTypes] = useState<DeviceType[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const selectedTypeRef = useRef<string>(''); // fixes stale closure in DP callback

  const [apiReady, setApiReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [selectedFinger, setSelectedFinger] = useState('');
  const [readers, setReaders] = useState<string[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  // Delete confirmation modal state (replaces window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFingerChange = (value: string) => {
    setSelectedFinger(value);
    selectedFingerRef.current = value;
  };

  const handleTypeChange = (val: string) => {
    setSelectedType(val);
    selectedTypeRef.current = val;
    if (val && readers.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: val, uid: readers[0] }));
    }
  };

  const apiRef = useRef<any>(null);
  const collectedScansRef = useRef<string[]>([]);
  const isCapturingRef = useRef<boolean>(false);
  const selectedFingerRef = useRef<string>('');
  const zkCancelRef = useRef<boolean>(false);

  const updateCaptureState = useCallback((capturing: boolean) => {
    setIsCapturing(capturing);
    isCapturingRef.current = capturing;
  }, []);

  // 1. Fetch Registered HOST Devices (real capture hardware only)
  useEffect(() => {
    attendanceDevicesAPI.list({ page_size: 500 }).then(res => {
      const hostDevices = res.results.filter(
        d => d.integration_type === 'HOST' && d.is_active && CAPTURE_DEVICE_TYPES.includes(d.device_type)
      );
      const uniqueTypes = Array.from(new Set(hostDevices.map(d => d.device_type)));
      setRegisteredTypes(uniqueTypes);
    }).catch(console.error);
  }, []);

  // 2. Auto-pick when only one type registered; else remember last choice per device UID
  useEffect(() => {
    if (registeredTypes.length === 0) return;

    if (registeredTypes.length === 1) {
      handleTypeChange(registeredTypes[0]);
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (registeredTypes.includes(parsed.type)) {
          handleTypeChange(parsed.type);
        }
      } catch (e) { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredTypes]);

  // 3. Load DigitalPersona scripts only when that type is in play
  useEffect(() => {
    if (selectedType !== 'DIGITAL_PERSONA') return;
    let isMounted = true;

    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });

    const init = async () => {
      try {
        await loadScript('https://unpkg.com/@digitalpersona/websdk@v1');
        await loadScript('https://unpkg.com/@digitalpersona/fingerprint@v1');
        if (isMounted) {
          setApiReady(true);
          setupDigitalPersonaAPI();
        }
      } catch (e) {
        if (isMounted) {
          setStatusMsg('Failed to load Fingerprint SDK. Check your internet connection.');
          setStatusType('error');
        }
      }
    };
    init();

    return () => {
      isMounted = false;
      if (isCapturingRef.current && apiRef.current) {
        apiRef.current.stopAcquisition().catch(console.error);
      }
      if (apiRef.current) {
        apiRef.current.onCommunicationFailed = null;
        apiRef.current.onDeviceConnected = null;
        apiRef.current.onDeviceDisconnected = null;
        apiRef.current.onSamplesAcquired = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  // 4. Poll ZK agent status when that type is in play
  useEffect(() => {
    if (selectedType !== 'ZKTECO') return;
    setApiReady(true);

    const checkZkStatus = async () => {
      try {
        const res = await fetch(`${ZK_AGENT_BASE}/status`);
        const data = await res.json();
        setDeviceStatus(data.connected ? 'connected' : 'disconnected');
        setStatusMsg(data.connected ? 'ZK9500 connected' : 'No ZK9500 detected — is the capture agent running?');
        setStatusType(data.connected ? 'success' : 'warning');
        if (data.connected) setReaders(['ZK9500']);
      } catch (e) {
        setDeviceStatus('error');
        setStatusMsg('Cannot reach capture agent on this PC. Is it running?');
        setStatusType('error');
      }
    };

    checkZkStatus();
    const interval = setInterval(checkZkStatus, 3000);
    return () => clearInterval(interval);
  }, [selectedType]);

  // 5. Load existing prints from DB
  useEffect(() => {
    fingerprintsAPI.list(student.id).then(setPrints).finally(() => setLoading(false));
  }, [student.id]);

  // --- DigitalPersona setup (unchanged logic, stale-closure fixed via ref) ---
  const setupDigitalPersonaAPI = () => {
    if (typeof window.Fingerprint === 'undefined' || !window.Fingerprint.WebApi) return;

    if (!apiRef.current) {
      apiRef.current = new window.Fingerprint.WebApi({ debug: true });
    }
    const api = apiRef.current;

    api.onCommunicationFailed = (event: any) => {
      setStatusMsg(`Connection error: ${event.error?.message || 'Unknown error'}`);
      setStatusType('error');
      setDeviceStatus('error');
    };

    api.onDeviceConnected = (event: any) => {
      updateReadersList();
      setStatusMsg(`Device connected: ${event.deviceUid}`);
      setStatusType('success');
    };

    api.onDeviceDisconnected = (event: any) => {
      updateReadersList();
      setStatusMsg(`Device disconnected: ${event.deviceUid}`);
      setStatusType('warning');
    };

    api.onAcquisitionStarted = () => {
      if (collectedScansRef.current.length === 0) {
        setStatusMsg(`👆 Scan 1 of ${REQUIRED_SCANS} — place finger on scanner...`);
        setStatusType('info');
      }
    };

    api.onAcquisitionStopped = () => {
      if (collectedScansRef.current.length === 0 && !isCapturingRef.current) {
        setStatusMsg('Capture cancelled.');
        setStatusType('info');
      }
    };

    api.onErrorOccurred = (event: any) => {
      setStatusMsg(`Scanner error: ${event.error?.message || 'Unknown error'}`);
      setStatusType('error');
      resetCaptureUI();
    };

    api.onSamplesAcquired = (event: any) => {
      try {
        const samples = JSON.parse(event.samples);
        if (!samples || samples.length === 0) throw new Error('No samples');

        const fmd = samples[0];
        const fmdData = typeof fmd === 'object' ? fmd.Data : fmd;
        if (!fmdData) throw new Error('No FMD Data field in sample');

        collectedScansRef.current.push(fmdData);
        const currentCount = collectedScansRef.current.length;
        setScanCount(currentCount);

        if (currentCount < REQUIRED_SCANS) {
          setStatusMsg(`✅ Scan ${currentCount} of ${REQUIRED_SCANS} done. Lift finger and place again...`);
          setStatusType('info');
        } else {
          setStatusMsg('⏳ All 4 scans collected. Enrolling...');
          setStatusType('info');
          api.stopAcquisition().catch(console.error);
          updateCaptureState(false);
          saveFingerprintToServer([...collectedScansRef.current]);
        }
      } catch (error: any) {
        setStatusMsg(`Error: ${error.message}`);
        setStatusType('error');
        resetCaptureUI();
      }
    };

    setTimeout(() => updateReadersList(), 1000);
  };

  const updateReadersList = async () => {
    if (!apiRef.current) return;
    try {
      const devs = await apiRef.current.enumerateDevices();
      const connected = devs && devs.length > 0;
      setReaders(devs || []);
      setDeviceStatus(connected ? 'connected' : 'disconnected');
      setStatusMsg(connected ? `${devs.length} device(s) connected` : 'No devices connected');
      setStatusType(connected ? 'success' : 'warning');
    } catch (e) {
      setReaders([]);
      setDeviceStatus('error');
      setStatusMsg('Error detecting devices');
      setStatusType('error');
    }
  };

  // --- Capture: branches by device type ---
  const startCapture = async () => {
    if (!selectedFinger) {
      setStatusMsg('⚠️ Please select a finger to register');
      setStatusType('warning');
      return;
    }
    if (!selectedTypeRef.current) {
      setStatusMsg('⚠️ Please select your scanner hardware type.');
      setStatusType('error');
      return;
    }

    if (selectedTypeRef.current === 'DIGITAL_PERSONA') {
      return startDigitalPersonaCapture();
    }
    if (selectedTypeRef.current === 'ZKTECO') {
      return startZkCapture();
    }
  };

  const startDigitalPersonaCapture = async () => {
    if (!apiRef.current) {
      setStatusMsg('⚠️ Fingerprint SDK is not loaded.');
      setStatusType('error');
      return;
    }
    updateCaptureState(true);
    setScanCount(0);
    collectedScansRef.current = [];
    setStatusMsg('');

    try {
      await apiRef.current.startAcquisition(window.Fingerprint.SampleFormat.PngImage);
      setDeviceStatus('connected');
    } catch (error: any) {
      setStatusMsg(`Failed to start capture: ${error.message}`);
      setStatusType('error');
      updateCaptureState(false);
    }
  };

  const startZkCapture = async () => {
    updateCaptureState(true);
    setScanCount(0);
    collectedScansRef.current = [];
    zkCancelRef.current = false;
    setStatusMsg(`👆 Scan 1 of ${REQUIRED_SCANS} — place finger on scanner...`);
    setStatusType('info');

    for (let i = 0; i < REQUIRED_SCANS; i++) {
      if (zkCancelRef.current) {
        resetCaptureUI();
        setStatusMsg('Capture cancelled.');
        setStatusType('info');
        return;
      }
      try {
        const res = await fetch(`${ZK_AGENT_BASE}/capture`, { method: 'POST' });
        const data = await res.json();

        if (!data.success) {
          setStatusMsg(`❌ ${data.message || 'Capture failed'}`);
          setStatusType('error');
          resetCaptureUI();
          return;
        }

        collectedScansRef.current.push(data.template);
        const currentCount = collectedScansRef.current.length;
        setScanCount(currentCount);

        if (currentCount < REQUIRED_SCANS) {
          setStatusMsg(`✅ Scan ${currentCount} of ${REQUIRED_SCANS} done. Lift finger and place again...`);
          setStatusType('info');
        }
      } catch (e) {
        setStatusMsg('❌ Cannot reach capture agent. Is it running on this PC?');
        setStatusType('error');
        resetCaptureUI();
        return;
      }
    }

    setStatusMsg('⏳ All 4 scans collected. Enrolling...');
    setStatusType('info');
    updateCaptureState(false);
    saveFingerprintToServer([...collectedScansRef.current]);
  };

  const stopCapture = async () => {
    if (selectedTypeRef.current === 'DIGITAL_PERSONA' && apiRef.current) {
      try { await apiRef.current.stopAcquisition(); } catch (e) { /* ignore */ }
    }
    if (selectedTypeRef.current === 'ZKTECO') {
      zkCancelRef.current = true;
    }
    resetCaptureUI();
  };

  const resetCaptureUI = () => {
    updateCaptureState(false);
    setScanCount(0);
    collectedScansRef.current = [];
  };

  const saveFingerprintToServer = async (finalScans: string[]) => {
    const fingerName = selectedFingerRef.current;
    const deviceType = selectedTypeRef.current;

    if (!fingerName) {
      setStatusMsg('❌ No finger selected. Please select a finger and try again.');
      setStatusType('error');
      resetCaptureUI();
      return;
    }
    if (!deviceType) {
      setStatusMsg('❌ Hardware type not resolved. Please select a scanner type.');
      setStatusType('error');
      resetCaptureUI();
      return;
    }

    setIsSaving(true);
    try {
      const template = finalScans.join('|');
      const currentUid = readers.length > 0 ? readers[0] : 'Unknown_UID';

      await fingerprintsAPI.add(student.id, {
        finger_name: fingerName,
        fingerprint_template: template,
        device_type: deviceType,
        capture_device: currentUid
      });

      setStatusMsg('✅ Fingerprint enrolled successfully!');
      setStatusType('success');

      fingerprintsAPI.list(student.id).then(setPrints);
      refreshStudent();
      setSelectedFinger('');
      selectedFingerRef.current = '';

      setTimeout(() => setStatusMsg('Ready for next scan'), 3000);
    } catch (err: any) {
      const apiDetails = err?.response?.data?.details;
      let detail = '';
      if (apiDetails && typeof apiDetails === 'object') {
        detail = Object.entries(apiDetails)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join(' | ');
      }
      const msg = detail ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        'Enrollment failed';
      setStatusMsg(`❌ ${msg}`);
      setStatusType('error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Delete flow: opens confirm modal instead of window.confirm ---
  const requestDelete = (id: number, label: string) => {
    setDeleteTarget({ id, label });
  };

  const cancelDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await fingerprintsAPI.delete(deleteTarget.id);
      fingerprintsAPI.list(student.id).then(setPrints);
      refreshStudent();
      setStatusMsg('✅ Fingerprint deleted successfully');
      setStatusType('success');
      setDeleteTarget(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to delete fingerprint. Please try again.';
      setStatusMsg(`❌ ${msg}`);
      setStatusType('error');
    } finally {
      setIsDeleting(false);
    }
  };

  const maxFingerprints = settings?.max_fingerprint_count || 2;
  const canAddMore = prints.length < maxFingerprints;
  const isBlockedByNoDevices = registeredTypes.length === 0 && !loading;
  const capturedFingerNames = new Set(prints.map(p => p.finger_name));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* LEFT COLUMN: LIST */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <Fingerprint className="h-3.5 w-3.5" />
            </div>
            Registered Fingerprints
          </span>
          <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-full">
            {prints.length}/{maxFingerprints}
          </span>
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-1">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div> :
            prints.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Fingerprint className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm">No fingerprints registered yet.</p>
              </div>
            ) : (
              prints.map(p => {
                const label = p.finger_name_display || titleCase(p.finger_name.replace('_', ' '));
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm">
                        <Fingerprint className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-500">Captured: {new Date(p.created_at).toLocaleDateString()}</span>
                          {p.quality_score && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                              Q: {Number(p.quality_score).toFixed(1)}/1.0
                            </span>
                          )}
                          {p.device_type && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 rounded uppercase">
                              {p.device_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => requestDelete(p.id, label)}
                      className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Fingerprint"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })
            )}
        </div>
      </div>

      {/* RIGHT COLUMN: CAPTURE */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <ScanLine className="h-3.5 w-3.5" />
            </div>
            Capture New Print
          </div>
          <button
            onClick={selectedType === 'ZKTECO' ? undefined : updateReadersList}
            title="Refresh Devices"
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </h3>

        {/* Scanner Hardware Status Box */}
        <div className={`p-3 rounded-xl border flex flex-col gap-2 mb-4 ${
          deviceStatus === 'connected' ? 'bg-emerald-50 border-emerald-100' :
          deviceStatus === 'error' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {deviceStatus === 'connected' ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-slate-400" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-800 mb-0.5">Scanner Status</p>
              <p className={`text-[11px] ${statusType === 'error' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                {statusMsg || 'Initializing...'}
              </p>
              {readers.length > 0 && (
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-200/50">
                  <p className="text-[9px] text-slate-400 font-mono">
                    Session UID: {readers[0]}
                  </p>
                </div>
              )}
            </div>
          </div>

          {isBlockedByNoDevices && (
            <div className="mt-1 p-2 bg-red-100 border border-red-200 rounded-lg flex items-start gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] font-semibold leading-snug">
                No USB (HOST) devices are registered. Please add one in Attendance Devices settings before capturing.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 flex-1">

          {registeredTypes.length > 1 && canAddMore && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Select Scanner Type</label>
              <select
                value={selectedType}
                onChange={(e) => handleTypeChange(e.target.value)}
                disabled={isCapturing}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              >
                <option value="">-- Choose hardware type --</option>
                {registeredTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {canAddMore ? (
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Select Finger to Register</label>
              <select
                value={selectedFinger}
                onChange={e => handleFingerChange(e.target.value)}
                disabled={isCapturing || !apiReady || deviceStatus !== 'connected' || isBlockedByNoDevices || isSaving}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <option value="">-- Choose a finger --</option>
                {FINGER_OPTIONS.map(opt => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    disabled={capturedFingerNames.has(opt.value)}
                  >
                    {opt.label}{capturedFingerNames.has(opt.value) ? ' — already registered' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-sm text-center border border-amber-200 flex flex-col items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              <p className="font-semibold">Maximum Limit Reached</p>
              <p className="text-xs text-amber-700/80">You can only register {maxFingerprints} fingerprints per student. Delete an existing one to add a new one.</p>
            </div>
          )}

          {isCapturing && (
            <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 text-center animate-in fade-in">
              <Fingerprint className="h-12 w-12 text-blue-600 animate-pulse mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Scan Progress</p>
              <div className="flex gap-2 justify-center mb-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`h-2.5 w-8 rounded-full transition-colors duration-300 ${
                    i <= scanCount ? 'bg-emerald-500' :
                    i === scanCount + 1 ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'
                  }`} />
                ))}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">{scanCount} of {REQUIRED_SCANS} scans completed</p>
            </div>
          )}

          {isSaving && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-xs font-semibold text-blue-700">Saving fingerprint...</p>
            </div>
          )}

          {canAddMore && (
            <div className="grid grid-cols-1 gap-3 mt-auto pt-2">
              {!isCapturing ? (
                <button
                  onClick={startCapture}
                  disabled={!apiReady || deviceStatus !== 'connected' || !selectedFinger || isBlockedByNoDevices || (registeredTypes.length > 1 && !selectedType) || isSaving}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-md shadow-blue-200 transition-all"
                >
                  <Fingerprint className="h-4 w-4" /> Start Capture (4 Scans Required)
                </button>
              ) : (
                <button
                  onClick={stopCapture}
                  className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 flex justify-center items-center gap-2 transition-all"
                >
                  <X className="h-4 w-4" /> Cancel Capture
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Delete fingerprint?</h4>
                <p className="text-xs text-slate-500 mt-1">
                  This will permanently remove the <span className="font-semibold">{deleteTarget.label}</span> fingerprint for {student.first_name ?? 'this student'}. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}