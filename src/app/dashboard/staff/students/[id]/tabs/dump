// src/app/dashboard/staff/students/[id]/components/tabs/FingerprintsTab.tsx
import React, { useState, useEffect, useRef } from 'react';
import { fingerprintsAPI } from '@/lib/api';
import { Student, StudentSettings } from '@/lib/types';
import {
  Fingerprint, AlertCircle, Loader2, Check, X, RefreshCw,
  Trash2, ScanLine, Video, Wifi, WifiOff
} from 'lucide-react';

interface Props {
  student: Student;
  settings: StudentSettings | null;
  refreshStudent: () => void;
}

// Matching Django Model FINGER_CHOICES exactly
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

// Types for the global Window object
declare global {
  interface Window {
    Fingerprint?: any;
  }
}

export default function FingerprintsTab({ student, settings, refreshStudent }: Props) {
  const [prints, setPrints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Scanner State
  const [apiReady, setApiReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [collectedScans, setCollectedScans] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [selectedFinger, setSelectedFinger] = useState('');
  const [readers, setReaders] = useState<string[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');

  const videoRef = useRef<HTMLVideoElement>(null);
  const REQUIRED_SCANS = 4;

  // 1. Load Scripts
  useEffect(() => {
    const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = reject;
      document.body.appendChild(script);
    });

    const init = async () => {
      try {
        await loadScript('https://unpkg.com/@digitalpersona/websdk@v1');
        await loadScript('https://unpkg.com/@digitalpersona/fingerprint@v1');
        setApiReady(true);
        initializeFingerprintAPI(); // Initialize SDK immediately
      } catch (e) {
        console.error('SDK Load Error', e);
        setStatusMsg('Failed to load Fingerprint SDK');
        setStatusType('error');
      }
    };
    init();
  }, []);

  // 2. Load existing prints
  useEffect(() => {
    fingerprintsAPI.list(student.id).then(setPrints).finally(() => setLoading(false));
  }, [student.id]);

  // 3. Initialize SDK & Attach Handlers (Ported from HTML version)
  const initializeFingerprintAPI = () => {
    if (typeof window.Fingerprint === 'undefined' || !window.Fingerprint.WebApi) return;

    const api = new window.Fingerprint.WebApi({ debug: true });

    // Helper to update UI based on status
    const updateScannerStatus = (connected: boolean, message: string) => {
      setDeviceStatus(connected ? 'connected' : 'disconnected');
      setStatusMsg(message);
      setStatusType(connected ? 'success' : 'error');
    };

    // Communication Failed
    api.onCommunicationFailed = (event: any) => {
      setStatusMsg(`Connection error: ${event.error?.message || 'Unknown error'}`);
      setStatusType('error');
      setDeviceStatus('error');
    };

    // Device Connected
    api.onDeviceConnected = (event: any) => {
      updateReadersList();
      setStatusMsg(`Device connected: ${event.deviceUid}`);
      setStatusType('success');
    };

    // Device Disconnected
    api.onDeviceDisconnected = (event: any) => {
      updateReadersList();
      setStatusMsg(`Device disconnected: ${event.deviceUid}`);
      setStatusType('warning');
    };

    // Acquisition Started
    api.onAcquisitionStarted = (event: any) => {
      if (scanCount === 0) {
        setStatusMsg(`👆 Scan 1 of ${REQUIRED_SCANS} — place finger on scanner...`);
      }
    };

    // Acquisition Stopped
    api.onAcquisitionStopped = (event: any) => {
      if (scanCount === 0 && collectedScans.length === 0) {
        setStatusMsg('Capture cancelled.');
      }
    };

    // Samples Acquired (THE CORE LOGIC)
    api.onSamplesAcquired = (event: any) => {
      try {
        const samples = JSON.parse(event.samples);
        if (!samples || samples.length === 0) throw new Error('No samples');

        const fmd = samples[0];
        const fmdData = typeof fmd === 'object' ? fmd.Data : fmd;

        if (!fmdData) throw new Error('No FMD Data field in sample');

        setCollectedScans(prev => [...prev, fmdData]); // Add to collection

        setScanCount(prev => {
          const newCount = prev + 1;

          if (newCount < REQUIRED_SCANS) {
            setStatusMsg(`✅ Scan ${newCount} of ${REQUIRED_SCANS} done. Lift finger and place again...`);
          } else {
            setStatusMsg('⏳ All 4 scans collected. Enrolling...');
            // Stop capture automatically after 4 scans
            if (api && api.stopAcquisition) {
                api.stopAcquisition();
            }
            setIsCapturing(false);
            // Trigger save
            saveFingerprintToServer([...collectedScans, fmdData]);
          }
          return newCount;
        });

      } catch (error: any) {
        setStatusMsg(`Error: ${error.message}`);
        setStatusType('error');
        resetCaptureUI();
      }
    };

    // Quality Reported
    api.onQualityReported = (event: any) => {
      console.log('Quality reported:', event.quality);
    };

    // Error Occurred
    api.onErrorOccurred = (event: any) => {
      setStatusMsg(`Scanner error: ${event.error?.message || 'Unknown error'}`);
      setStatusType('error');
      resetCaptureUI();
    };

    // Helper to update readers list
    const updateReadersList = async () => {
      try {
        const readers = await api.enumerateDevices();
        setReaders(readers || []);
      } catch (e) {
        setReaders([]);
      }
    };
  };

  const startCapture = async () => {
    if (!window.Fingerprint) return alert('SDK not loaded');
    if (!selectedFinger) return setStatusMsg('⚠️ Please select a finger to register');

    const api = new window.Fingerprint.WebApi({ debug: true });
    setIsCapturing(true);
    setScanCount(0);
    setCollectedScans([]);
    setStatusMsg('');

    try {
      await api.startAcquisition(window.Fingerprint.SampleFormat.Intermediate);
      setDeviceStatus('connected');
      setStatusMsg(`👆 Scan 1 of ${REQUIRED_SCANS} — place finger on scanner...`);
    } catch (error: any) {
      console.error('Error starting capture:', error);
      setStatusMsg(`Failed to start capture: ${error.message}`);
      setStatusType('error');
      setIsCapturing(false);
    }
  };

  const stopCapture = async () => {
    if (!window.Fingerprint) return;
    try {
      const api = new window.Fingerprint.WebApi({ debug: true });
      await api.stopAcquisition();
    } catch (error) {
      console.error('Error stopping capture:', error);
    } finally {
      setIsCapturing(false);
      resetCaptureUI();
    }
  };

  const resetCaptureUI = () => {
    setIsCapturing(false);
    setScanCount(0);
    setCollectedScans([]);
  };

  const saveFingerprintToServer = async (finalScans: string[]) => {
    try {
      // You need to add this endpoint to your API
      // Assuming it matches the HTML version structure: { student_id, finger_name, raw_fmds }
      await fingerprintsAPI.add(student.id, {
        finger_name: selectedFinger as any,
        // NOTE: The HTML version sent 'raw_fmds' as an array.
        // If your Django API expects a single string field 'fingerprint_template', we join it.
        // Based on your serializer earlier, it expects 'fingerprint_template'. We will join with a delimiter.
        fingerprint_template: JSON.stringify(finalScans) // Safest way to store array in text field
      });

      setStatusMsg('✅ Fingerprint enrolled successfully!');
      setStatusType('success');
      refreshStudent();
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err: any) {
      setStatusMsg(`❌ ${err?.response?.data?.detail || err?.message || 'Enrollment failed'}`);
      setStatusType('error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this fingerprint?')) return;
    try {
      await fingerprintsAPI.delete(id);
      refreshStudent();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const maxFingerprints = settings?.max_fingerprint_count || 2;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* LEFT COLUMN: LIST */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
              <Fingerprint className="h-3.5 w-3.5" />
            </div>
            Registered Prints
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
                      <p className="text-sm font-medium text-slate-800">{p.finger_name_display}</p>
                      <p className="text-[10px] text-slate-500">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
            <ScanLine className="h-3.5 w-3.5" />
          </div>
          Capture New Print
        </h3>

        <div className="space-y-4 flex-1">
           {/* Select Finger */}
           <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Select Finger</label>
            <select
              value={selectedFinger}
              onChange={e => setSelectedFinger(e.target.value)}
              disabled={prints.length >= maxFingerprints || !apiReady}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Choose a finger --</option>
              {FINGER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
           </div>

           {/* Video Feed / Status Area */}
           <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 min-h-[200px] relative overflow-hidden flex items-center justify-center">
             {/* Hidden Video Element for SDK to access stream */}
             <video
               ref={videoRef}
               autoPlay
               playsInline
               muted
               className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
             />

             {!apiReady ? (
               <div className="z-10 text-center space-y-2">
                 <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto" />
                 <p className="text-xs text-slate-500">Loading Biometric SDK...</p>
               </div>
             ) : (
               <div className="z-10 text-center w-full">
                 {deviceStatus === 'connected' && isCapturing ? (
                   <div className="space-y-3">
                     <Fingerprint className="h-16 w-16 text-blue-600 animate-pulse mx-auto" />
                     <p className="text-sm font-medium text-slate-700">Scanning Finger...</p>
                     <div className="flex gap-2 justify-center">
                       {[1, 2, 3, 4].map(i => (
                         <div key={i} className={`h-2 w-2 rounded-full transition-colors duration-300 ${i <= scanCount ? 'bg-blue-600' : 'bg-slate-300'}`} />
                       ))}
                     </div>
                   </div>
                 ) : (
                   <div className="space-y-3">
                     <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${deviceStatus === 'connected' ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                       {deviceStatus === 'connected' ? <Wifi className="h-6 w-6 text-emerald-600" /> : <WifiOff className="h-6 w-6 text-slate-400" />}
                     </div>
                     <p className="text-xs font-medium text-slate-700 min-h-[40px]">
                       {statusMsg || (deviceStatus === 'connected' ? 'Scanner Ready' : 'Scanner Disconnected')}
                     </p>
                   </div>
                 )}
               </div>
             )}
           </div>

           {/* Action Buttons */}
           <div className="grid grid-cols-2 gap-3">
             <button
              onClick={startCapture}
              disabled={!apiReady || isCapturing || !selectedFinger || prints.length >= maxFingerprints}
              className="py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm shadow-blue-200 transition-all"
            >
              {isCapturing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Scanning...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" /> Capture
                </span>
              )}
            </button>

             <button
               onClick={stopCapture}
               disabled={!isCapturing}
               className="py-3 bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all"
             >
               <X className="h-4 w-4" /> Cancel
             </button>
           </div>

           {prints.length >= maxFingerprints && (
             <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs text-center border border-amber-100 mt-2">
               Maximum fingerprints ({maxFingerprints}) reached for this student.
             </div>
           )}
        </div>
      </div>
    </div>
  );
}