'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fingerprintsAPI } from '@/lib/api';
import { Student, StudentSettings } from '@/lib/types';
import {
  Fingerprint, AlertCircle, Loader2, Check, X, RefreshCw,
  Trash2, ScanLine, Wifi, WifiOff, AlertTriangle
} from 'lucide-react';

interface Props {
  student: Student;
  settings: StudentSettings | null;
  refreshStudent: () => void;
}

// Matching Django Model FINGER_CHOICES exactly (lowercase)
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

function titleCase(str: string): string {
  return (str || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Types for the global Window object
declare global {
  interface Window {
    Fingerprint?: any;
    WebSdk?: any;
  }
}

const REQUIRED_SCANS = 4;

export default function FingerprintsTab({ student, settings, refreshStudent }: Props) {
  const [prints, setPrints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scanner State
  const [apiReady, setApiReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [selectedFinger, setSelectedFinger] = useState('');
  const [readers, setReaders] = useState<string[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  // Keep ref in sync whenever state changes so SDK callbacks always see current value
  const handleFingerChange = (value: string) => {
    setSelectedFinger(value);
    selectedFingerRef.current = value;
  };

  // React Refs to hold persistent non-render state and beat stale closures
  const apiRef = useRef<any>(null);
  const collectedScansRef = useRef<string[]>([]);
  const isCapturingRef = useRef<boolean>(false);
  const selectedFingerRef = useRef<string>(''); // Ref so callbacks always read the latest value

  // Helper to sync state and ref together
  const updateCaptureState = useCallback((capturing: boolean) => {
    setIsCapturing(capturing);
    isCapturingRef.current = capturing;
  }, []);

  // 1. Load Scripts sequentially and Initialize API globally
  useEffect(() => {
    let isMounted = true;

    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = false; // CRITICAL: Forces sequential script execution so WebSdk is defined before fingerprint@v1 runs

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
          setupFingerprintAPI(); // Initialize once
        }
      } catch (e) {
        console.error('SDK Load Error', e);
        if (isMounted) {
          setStatusMsg('Failed to load Fingerprint SDK. Check your internet connection.');
          setStatusType('error');
        }
      }
    };
    init();

    // Cleanup: Stop capture and disconnect when leaving the tab
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
  }, []);

  // 2. Load existing prints from DB
  useEffect(() => {
    fingerprintsAPI.list(student.id).then(setPrints).finally(() => setLoading(false));
  }, [student.id]);

  // 3. Setup the API instance and event listeners
  const setupFingerprintAPI = () => {
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

    // Core scan listener using Refs to avoid React stale closures
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

    setTimeout(() => {
      updateReadersList();
    }, 1000);
  };

  const updateReadersList = async () => {
    if (!apiRef.current) return;
    try {
      const devs = await apiRef.current.enumerateDevices();
      const connected = devs && devs.length > 0;
      setReaders(devs || []);
      setDeviceStatus(connected ? 'connected' : 'disconnected');
      if (connected) {
        setStatusMsg(`${devs.length} device(s) connected`);
        setStatusType('success');
      } else {
        setStatusMsg('No devices connected');
        setStatusType('warning');
      }
    } catch (e) {
      setReaders([]);
      setDeviceStatus('error');
      setStatusMsg('Error detecting devices');
      setStatusType('error');
    }
  };

  const startCapture = async () => {
    if (!apiRef.current) return alert('SDK not loaded');
    if (!selectedFinger) {
      setStatusMsg('⚠️ Please select a finger to register');
      setStatusType('warning');
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
      console.error('Error starting capture:', error);
      setStatusMsg(`Failed to start capture: ${error.message}`);
      setStatusType('error');
      updateCaptureState(false);
    }
  };

  const stopCapture = async () => {
    if (!apiRef.current) return;
    try {
      await apiRef.current.stopAcquisition();
    } catch (error) {
      console.error('Error stopping capture:', error);
    } finally {
      resetCaptureUI();
    }
  };

  const resetCaptureUI = () => {
    updateCaptureState(false);
    setScanCount(0);
    collectedScansRef.current = [];
  };


  const saveFingerprintToServer = async (finalScans: string[]) => {
    // Read from ref — NOT state — to avoid the stale closure problem.
    // onSamplesAcquired is set up once on mount, so it always captures the
    // original selectedFinger = ''. The ref is kept in sync by handleFingerChange.
    const fingerName = selectedFingerRef.current;

    if (!fingerName) {
      setStatusMsg('❌ No finger selected. Please select a finger and try again.');
      setStatusType('error');
      resetCaptureUI();
      return;
    }

    try {
      // Join the 4 FMD samples with a delimiter into one template string.
      // The backend FingerprintSerializer stores this as a single TextField.
      const template = finalScans.join('|');

      await fingerprintsAPI.add(student.id, {
        finger_name: fingerName,
        fingerprint_template: template,
      });

      setStatusMsg('✅ Fingerprint enrolled successfully!');
      setStatusType('success');

      fingerprintsAPI.list(student.id).then(setPrints);
      refreshStudent();

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
    }
  };


  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this fingerprint?')) return;
    try {
      await fingerprintsAPI.delete(id);
      fingerprintsAPI.list(student.id).then(setPrints);
      refreshStudent();
    } catch (e) {
      alert('Failed to delete fingerprint.');
    }
  };

  const maxFingerprints = settings?.max_fingerprint_count || 2;
  const canAddMore = prints.length < maxFingerprints;

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
              prints.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-blue-600 shadow-sm">
                      <Fingerprint className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.finger_name_display || titleCase(p.finger_name.replace('_', ' '))}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500">Captured: {new Date(p.created_at).toLocaleDateString()}</span>
                        {p.quality_score && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500">
                            Q: {Number(p.quality_score).toFixed(1)}/1.0
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Delete Fingerprint"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
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
          <button onClick={updateReadersList} title="Refresh Devices" className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </h3>

        {/* Scanner Hardware Status Box */}
        <div className={`p-3 rounded-xl border flex items-start gap-3 mb-4 ${
          deviceStatus === 'connected' ? 'bg-emerald-50 border-emerald-100' :
          deviceStatus === 'error' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="mt-0.5">
            {deviceStatus === 'connected' ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-slate-400" />}
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 mb-0.5">Scanner Status</p>
            <p className={`text-[11px] ${statusType === 'error' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
              {statusMsg || 'Initializing...'}
            </p>
            {readers.length > 0 && (
              <p className="text-[9px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-200/50">
                Connected: {readers[0]}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 flex-1">
           {/* Select Finger */}
           {canAddMore ? (
             <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Select Finger to Register</label>
              <select
                value={selectedFinger}
                onChange={e => handleFingerChange(e.target.value)}
                disabled={isCapturing || !apiReady || deviceStatus !== 'connected'}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <option value="">-- Choose a finger --</option>
                {FINGER_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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

           {/* Scan Progress Visualization (Only visible during capture) */}
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

           {/* Action Buttons */}
           {canAddMore && (
             <div className="grid grid-cols-1 gap-3 mt-auto pt-2">
               {!isCapturing ? (
                 <button
                  onClick={startCapture}
                  disabled={!apiReady || deviceStatus !== 'connected' || !selectedFinger}
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
    </div>
  );
}