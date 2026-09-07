'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api, { studentsAPI, staffAPI } from '@/lib/api';
import {
  Fingerprint, Barcode, ScanLine, Search, X, Check,
  AlertCircle, AlertTriangle, Loader2, UserCircle,
  ArrowRightCircle, LogIn, LogOut, Info, Clock
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function extractError(err: any): string {
  const d = err?.response?.data;
  if (d) {
    if (typeof d === 'string') return d.slice(0, 150);
    if (d.detail) return String(d.detail).slice(0, 150);
    if (d.message) return String(d.message).slice(0, 150);
  }
  return err?.message || 'An unexpected error occurred.';
}

function extractListData(res: any): any[] {
  const data = res?.data || res;
  if (data?.success && Array.isArray(data.data)) return data.data;
  if (data?.results?.data && Array.isArray(data.results.data)) return data.results.data;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type HeroStatus = {
  type: 'success' | 'error' | 'idle';
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  state?: string;
  time?: string;
};

type LiveEvent = {
  id: string | number;
  personName: string;
  role: string;
  method: string;
  state: string;
  time: string;
  success: boolean;
  errorMsg?: string;
};

type SearchResult = {
  id: number;
  type: 'student' | 'staff';
  name: string;
  identifier: string;
  display_class?: string;
  image_url?: string | null;
};

const ZK_AGENT_BASE = 'http://127.0.0.1:8891';
const STORAGE_TAB = 'gate_attendance_tab';
const STORAGE_REASON = 'gate_attendance_reason';

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function GateAttendanceDashboard() {
  const { user } = useAuth();

  // -- UI State --
  const [activeTab, setActiveTab] = useState<'scanner' | 'manual'>('scanner');
  const [hero, setHero] = useState<HeroStatus>({ type: 'idle', title: 'Waiting for scan...', subtitle: 'Ready' });
  const [liveFeed, setLiveFeed] = useState<LiveEvent[]>([]);

  // -- Hardware Status --
  const [dpStatus, setDpStatus] = useState({ connected: false, text: 'Initializing...' });
  const [zkStatus, setZkStatus] = useState({ connected: false, text: 'Polling...' });
  const [barcodeStatus, setBarcodeStatus] = useState({ connected: true, text: 'Listening for keystrokes' });

  // -- Manual Entry State --
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<SearchResult | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [manualState, setManualState] = useState<'IN' | 'OUT' | 'OUT_TEMP' | 'NOT_ARRIVED'>('IN');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [checkingState, setCheckingState] = useState(false);

  // Refs for background loops
  const dpApiRef = useRef<any>(null);
  const isListeningZkRef = useRef(false);

  // 1. Initialize Local Storage Preferences
  useEffect(() => {
    const savedTab = localStorage.getItem(STORAGE_TAB);
    if (savedTab === 'scanner' || savedTab === 'manual') setActiveTab(savedTab);
    const savedReason = localStorage.getItem(STORAGE_REASON);
    if (savedReason) setManualReason(savedReason);
  }, []);

  const changeTab = (tab: 'scanner' | 'manual') => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_TAB, tab);
  };

  const updateReason = (val: string) => {
    setManualReason(val);
    localStorage.setItem(STORAGE_REASON, val);
  };

  // 2. Add to Live Feed & Hero Card
  const pushEvent = (event: LiveEvent, isHero: boolean = true) => {
    setLiveFeed(prev => [event, ...prev].slice(0, 20)); // Keep last 20
    if (isHero) {
      if (event.success) {
        setHero({
          type: 'success',
          title: event.personName,
          subtitle: `${event.role} • via ${event.method}`,
          state: event.state,
          time: event.time,
        });
      } else {
        setHero({
          type: 'error',
          title: 'Scan Failed',
          subtitle: event.errorMsg || 'Unknown Error',
          time: new Date().toLocaleTimeString(),
        });
        // Optional: Play a short error beep
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300, ctx.currentTime);
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
        } catch(e) {}
      }
    }
  };

  // 3. Central Submission to Host Scan Backend
  const handleHostScan = async (deviceType: string, scanValue: string) => {
    try {
      const res = await api.post('/api/attendance/host-scan/', {
        device_id: deviceType === 'BARCODE_SCANNER' ? 'USB_BARCODE' : 'USB_BIOMETRIC',
        device_type: deviceType,
        scan_value: scanValue
      });

      const data = res.data?.data; // AttendanceEventSerializer
      if (!data) {
        // Ignored duplicate/debounced
        return;
      }

      const isStudent = !!data.student;
      pushEvent({
        id: data.id,
        personName: data.student_name || data.staff_name || 'Unknown',
        role: isStudent ? 'Student' : 'Staff',
        method: deviceType.replace('_', ' '),
        state: data.resulting_state,
        time: new Date(data.event_time).toLocaleTimeString(),
        success: true
      });
    } catch (err: any) {
      pushEvent({
        id: Date.now(),
        personName: 'Unknown',
        role: '--',
        method: deviceType.replace('_', ' '),
        state: 'ERROR',
        time: new Date().toLocaleTimeString(),
        success: false,
        errorMsg: extractError(err)
      });
    }
  };

  // ─── HARDWARE LISTENERS ────────────────────────────────────────────────────────

  // Barcode Listener
  useEffect(() => {
    let buffer = '';
    let barcodeTimer: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in the manual search/reason boxes
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          e.preventDefault();
          handleHostScan('BARCODE_SCANNER', buffer);
          buffer = '';
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        buffer += e.key;
        if (barcodeTimer) clearTimeout(barcodeTimer);
        barcodeTimer = setTimeout(() => { buffer = ''; }, 100);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // DigitalPersona Listener
  useEffect(() => {
    let isMounted = true;
    const loadScript = (src: string) => new Promise<void>((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src; script.async = false;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });

    const initDP = async () => {
      await loadScript('https://unpkg.com/@digitalpersona/websdk@v1');
      await loadScript('https://unpkg.com/@digitalpersona/fingerprint@v1');
      if (!isMounted) return;

      if (typeof window.Fingerprint !== 'undefined' && window.Fingerprint.WebApi) {
        const dpApi = new window.Fingerprint.WebApi();
        dpApiRef.current = dpApi;

        dpApi.onDeviceConnected = () => setDpStatus({ connected: true, text: 'Ready & Listening' });
        dpApi.onDeviceDisconnected = () => setDpStatus({ connected: false, text: 'Scanner disconnected' });
        dpApi.onCommunicationFailed = () => setDpStatus({ connected: false, text: 'Agent not running' });

        dpApi.onSamplesAcquired = async (event: any) => {
          try {
            const samples = JSON.parse(event.samples);
            const fmd = typeof samples[0] === 'object' ? samples[0].Data : samples[0];
            if (fmd) handleHostScan('DIGITAL_PERSONA', fmd);
          } catch(e) {}
        };

        try {
          await dpApi.enumerateDevices();
          await dpApi.startAcquisition(window.Fingerprint.SampleFormat.PngImage);
        } catch (e) {
          setDpStatus({ connected: false, text: 'Failed to start acquisition' });
        }
      }
    };
    initDP();

    return () => {
      isMounted = false;
      if (dpApiRef.current) dpApiRef.current.stopAcquisition().catch(() => {});
    };
  }, []);

  // ZKTeco Listener (Infinite Poll)
  useEffect(() => {
    isListeningZkRef.current = true;

    const pollZkAgent = async () => {
      while (isListeningZkRef.current) {
        try {
          const statusRes = await fetch(`${ZK_AGENT_BASE}/status`);
          const statusData = await statusRes.json();
          setZkStatus({ connected: statusData.connected, text: statusData.connected ? 'Ready & Listening' : 'Agent disconnected' });

          if (statusData.connected) {
             const capRes = await fetch(`${ZK_AGENT_BASE}/capture`, { method: 'POST' });
             const capData = await capRes.json();
             if (capData.success && capData.template) {
                await handleHostScan('ZKTECO', capData.template);
             }
          } else {
            await new Promise(r => setTimeout(r, 2000));
          }
        } catch (e) {
          setZkStatus({ connected: false, text: 'Cannot reach ZK Agent' });
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    };

    pollZkAgent();
    return () => { isListeningZkRef.current = false; };
  }, []);

  // ─── MANUAL ENTRY LOGIC ────────────────────────────────────────────────────────

  // Unified Search
  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [stdRes, staffRes] = await Promise.all([
          studentsAPI.list({ search, status: 'active', page_size: 5 } as any),
          staffAPI.list({ search, status: 'active', page_size: 5 } as any)
        ]);

        const stdData = extractListData(stdRes);
        const staffData = extractListData(staffRes);

        setSearchResults([
          ...stdData.map((s: any) => ({
            id: s.id, type: 'student' as const, name: s.full_name || `${s.first_name} ${s.last_name}`,
            identifier: s.registration_number, image_url: s.image_url,
            display_class: `${s.current_class_name || ''} ${s.current_class_section_name || ''}`.trim(),
          })),
          ...staffData.map((s: any) => ({
            id: s.id, type: 'staff' as const, name: s.full_name || `${s.first_name} ${s.last_name}`,
            identifier: s.staff_id, image_url: s.image_url,
          })),
        ]);
      } catch (err) {} finally { setIsSearching(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Smart State Defaults
  const selectPersonForManual = async (person: SearchResult) => {
    setSelectedPerson(person);
    setSearch('');
    setSearchResults([]);
    setCheckingState(true);

    try {
      // Find today's record to guess if they are arriving or leaving
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get('/api/attendance/records/', {
        params: {
          [person.type === 'student' ? 'student' : 'staff']: person.id,
          date: today, scope: 'GATE'
        }
      });
      const records = extractListData(res);
      if (records.length > 0 && records[0].current_state === 'IN') {
        setManualState('OUT');
      } else {
        setManualState('IN');
      }
    } catch (e) {
      setManualState('IN');
    } finally {
      setCheckingState(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!selectedPerson) return;
    if (!manualReason.trim()) { alert('Please provide a reason for manual entry.'); return; }

    setIsSubmittingManual(true);
    try {
      const payload = {
        scope: 'GATE',
        resulting_state: manualState,
        override_reason: manualReason.trim(),
        ...(selectedPerson.type === 'student' ? { student_ids: [selectedPerson.id] } : { staff_ids: [selectedPerson.id] })
      };

      const res = await api.post('/api/attendance/manual/', payload);
      const data = res.data?.data?.[0]; // Array returned

      if (data) {
        pushEvent({
          id: data.id,
          personName: selectedPerson.name,
          role: selectedPerson.type === 'student' ? 'Student' : 'Staff',
          method: 'Manual Entry',
          state: data.resulting_state,
          time: new Date(data.event_time).toLocaleTimeString(),
          success: true
        });
      }
      setSelectedPerson(null);
    } catch (err: any) {
      pushEvent({
        id: Date.now(),
        personName: selectedPerson.name,
        role: '--',
        method: 'Manual Entry',
        state: 'ERROR',
        time: new Date().toLocaleTimeString(),
        success: false,
        errorMsg: extractError(err)
      });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto pb-12 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-md">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Gate Attendance</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Live hardware monitoring and manual overrides</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: CONTROLS */}
        <div className="lg:col-span-5 flex flex-col gap-6">

          {/* Tab Switcher */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex">
            <button onClick={() => changeTab('scanner')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'scanner' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <ScanLine className="h-4 w-4" /> Hardware Scanners
            </button>
            <button onClick={() => changeTab('manual')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'manual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <UserCircle className="h-4 w-4" /> Manual Override
            </button>
          </div>

          {/* TAB: HARDWARE */}
          {activeTab === 'scanner' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-snug">
                  Hardware listeners are active globally. You do not need to click or focus anything to scan a barcode or place a fingerprint.
                </p>
              </div>

              {[
                { label: 'Barcode Scanner', icon: Barcode, status: barcodeStatus, color: 'text-purple-600', bg: 'bg-purple-100' },
                { label: 'DigitalPersona (USB)', icon: Fingerprint, status: dpStatus, color: 'text-blue-600', bg: 'bg-blue-100' },
                { label: 'ZKTeco (USB)', icon: ScanLine, status: zkStatus, color: 'text-emerald-600', bg: 'bg-emerald-100' },
              ].map((dev, i) => (
                <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${dev.status.connected ? 'border-emerald-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50/50'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dev.status.connected ? dev.bg : 'bg-slate-200'}`}>
                      <dev.icon className={`h-5 w-5 ${dev.status.connected ? dev.color : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{dev.label}</h4>
                      <p className={`text-xs font-medium mt-0.5 ${dev.status.connected ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {dev.status.text}
                      </p>
                    </div>
                  </div>
                  {dev.status.connected && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB: MANUAL */}
          {activeTab === 'manual' && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              {!selectedPerson ? (
                <div className="p-5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Search Person</label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Type name, reg number, or staff ID..."
                      className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                    />
                    {isSearching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-3 border border-slate-100 rounded-xl divide-y divide-slate-50 max-h-64 overflow-y-auto shadow-sm">
                      {searchResults.map(p => (
                        <button key={`${p.type}-${p.id}`} onClick={() => selectPersonForManual(p)} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 text-left transition-colors">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-800 truncate">{p.name}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{p.identifier} {p.display_class && `• ${p.display_class}`}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${p.type === 'student' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {p.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                        {selectedPerson.image_url ? (
                          <img src={selectedPerson.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <UserCircle className="h-6 w-6 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-900">{selectedPerson.name}</h4>
                        <p className="text-xs text-slate-500">{selectedPerson.identifier}</p>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPerson(null)} className="p-1.5 bg-slate-100 text-slate-500 hover:text-red-600 rounded-lg">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                        Action
                        {checkingState && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                      </label>
                      <select value={manualState} onChange={e => setManualState(e.target.value as any)} className="w-full px-3 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700">
                        <option value="IN">Mark IN (Arrival)</option>
                        <option value="OUT">Mark OUT (Final Departure)</option>
                        <option value="OUT_TEMP">Mark OUT (Temporary Exit)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Override Reason</label>
                      <input
                        type="text" value={manualReason} onChange={e => updateReason(e.target.value)}
                        placeholder="e.g., Forgot ID card, Scanner issue..."
                        className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <button onClick={handleManualSubmit} disabled={isSubmittingManual || !manualReason.trim()} className="mt-6 w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                    {isSubmittingManual ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                    Submit Override
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: HERO & FEED */}
        <div className="lg:col-span-7 flex flex-col gap-6">

          {/* HERO CARD */}
          <div className={`relative overflow-hidden rounded-3xl border shadow-xl transition-all duration-500 ${
            hero.type === 'idle' ? 'bg-slate-50 border-slate-200' :
            hero.type === 'success' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-600' :
            'bg-gradient-to-br from-red-500 to-rose-600 border-red-600'
          }`}>
            <div className="p-8 md:p-10 flex flex-col items-center justify-center text-center min-h-[280px]">
              {hero.type === 'idle' ? (
                <>
                  <div className="w-20 h-20 bg-white/50 rounded-full flex items-center justify-center mb-4">
                    <ScanLine className="h-10 w-10 text-slate-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-400">Waiting for scan...</h2>
                </>
              ) : (
                <div className="animate-in zoom-in-95 duration-300">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl border-4 border-white overflow-hidden">
                    {hero.avatarUrl ? (
                      <img src={hero.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : hero.type === 'success' ? (
                      <UserCircle className="h-14 w-14 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-12 w-12 text-red-500" />
                    )}
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tight mb-2 drop-shadow-md">{hero.title}</h2>
                  <p className="text-white/90 font-medium text-lg mb-6">{hero.subtitle}</p>

                  {hero.type === 'success' && hero.state && (
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md border border-white/30 px-5 py-2.5 rounded-2xl shadow-inner">
                      {hero.state.includes('IN') ? <LogIn className="h-5 w-5 text-white" /> : <LogOut className="h-5 w-5 text-white" />}
                      <span className="text-lg font-bold text-white tracking-widest">{hero.state.replace('_', ' ')}</span>
                      <span className="text-white/60 mx-1">•</span>
                      <span className="text-white font-mono">{hero.time}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* LIVE FEED */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden min-h-[300px]">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" /> Recent Activity
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white border border-slate-200 px-2 py-1 rounded">Live Feed</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {liveFeed.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                  <ArrowRightCircle className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">No recent scans</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {liveFeed.map((ev, i) => (
                    <div key={`${ev.id}-${i}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors animate-in slide-in-from-top-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${ev.success ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {ev.success ? (ev.state.includes('IN') ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />) : <AlertTriangle className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${ev.success ? 'text-slate-800' : 'text-red-700'}`}>{ev.personName}</p>
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            <span>{ev.role}</span>
                            <span>•</span>
                            <span>{ev.method}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {ev.success ? (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ev.state.includes('IN') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            {ev.state.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-500 font-bold max-w-[120px] truncate block" title={ev.errorMsg}>{ev.errorMsg}</span>
                        )}
                        <p className="text-[11px] font-mono text-slate-400 mt-1">{ev.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}