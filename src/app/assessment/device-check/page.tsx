'use client';

import React, { useState, useEffect } from 'react';
import { authorizedDevicesAPI } from '@/lib/api';
import { getDeviceFingerprint } from '@/lib/fingerprint';
import { DeviceCheckResponse } from '@/lib/types';
import {
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertCircle,
  Smartphone,
  RefreshCw,
  Ban,
} from 'lucide-react';

// Standardized error parser
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

export default function DeviceCheckPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [deviceStatus, setDeviceStatus] = useState<DeviceCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // SSR-safe browser name
  const [browserName, setBrowserName] = useState('Unknown');

  // Device name state for approval request
  const [suggestedDeviceName, setSuggestedDeviceName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // Safely extract browser name on the client side only
    if (typeof window !== 'undefined') {
      const match = navigator.userAgent.match(/(?:Chrome|Firefox|Safari|Edge)\/[\d.]+/);
      if (match) setBrowserName(match[0]);
      else if (navigator.userAgent.includes('Safari')) setBrowserName('Safari');
      else setBrowserName('Web Browser');
    }

    checkDevice();
  }, []);

  const checkDevice = async () => {
    setLoading(true);
    setError(null);

    try {
      const fp = await getDeviceFingerprint();
      console.log('Device fingerprint:', fp);
      setFingerprint(fp);

      const status = await authorizedDevicesAPI.checkDeviceStatus(fp);
      console.log('Device status:', status);
      setDeviceStatus(status);
    } catch (error: any) {
      console.error('Error checking device:', error);
      setError(extractError(error));
      setDeviceStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!fingerprint) {
      setError('Device fingerprint not available');
      return;
    }

    // Validate device name
    if (!suggestedDeviceName.trim()) {
      setNameError('Please enter a name for your device');
      return;
    }
    setNameError(null);

    setRequesting(true);
    setError(null);

    try {
      // Pass suggested_device_name to the API
      const response = await authorizedDevicesAPI.requestApproval(
        fingerprint,
        suggestedDeviceName.trim()
      );
      console.log('Request response:', response);

      setDeviceStatus({
        status: 'pending',
        request_id: response.request.id,
        message: 'Approval request submitted successfully',
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (error: any) {
      console.error('Error requesting approval:', error);
      setError(extractError(error));
    } finally {
      setRequesting(false);
    }
  };

  const handleRecheck = async () => {
    setChecking(true);
    await checkDevice();
    setChecking(false);
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
            <Shield className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Checking Device...</h2>
            <p className="text-gray-600 mt-1">Please wait while we verify your device</p>
          </div>
        </div>
      </div>
    );
  }

  // Derive header gradient based on status
  const headerGradient = (() => {
    switch (deviceStatus?.status) {
      case 'approved': return 'bg-gradient-to-r from-green-600 to-emerald-600';
      case 'pending':  return 'bg-gradient-to-r from-amber-600 to-orange-600';
      case 'blocked':  return 'bg-gradient-to-r from-red-600 to-rose-700';
      default:         return 'bg-gradient-to-r from-blue-600 to-purple-600';
    }
  })();

  // Derive header icon based on status
  const HeaderIcon = (() => {
    switch (deviceStatus?.status) {
      case 'approved': return <CheckCircle className="h-8 w-8 text-white" />;
      case 'pending':  return <Clock className="h-8 w-8 text-white" />;
      case 'blocked':  return <Ban className="h-8 w-8 text-white" />;
      default:         return <Shield className="h-8 w-8 text-white" />;
    }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Success Toast */}
        {showSuccess && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm font-medium text-green-900">
                Approval request submitted successfully!
              </p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className={`px-8 py-6 ${headerGradient}`}>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                {HeaderIcon}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-white">Device Authorization</h1>
                <p className="text-white/90 text-sm mt-1">
                  Examination System Access Control
                </p>
              </div>
              <button
                onClick={handleRecheck}
                disabled={checking}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors disabled:opacity-50"
                title="Recheck status"
              >
                <RefreshCw className={`h-5 w-5 text-white ${checking ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* FALLBACK: If API fails to return a status */}
            {!deviceStatus && !error && (
              <div className="text-center space-y-4 py-8">
                <XCircle className="h-12 w-12 text-gray-400 mx-auto" />
                <h2 className="text-xl font-bold text-gray-900">Status Unknown</h2>
                <p className="text-gray-600">
                  We couldn't determine your device's authorization status.
                </p>
                <button
                  onClick={handleRecheck}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> Try Again
                </button>
              </div>
            )}

            {/* APPROVED */}
            {deviceStatus?.status === 'approved' && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Device Authorized
                  </h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    This device is authorized to access the examination system. You can proceed with your exams.
                  </p>
                </div>
                {deviceStatus.device_name && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <Smartphone className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      {deviceStatus.device_name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* PENDING */}
            {deviceStatus?.status === 'pending' && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full">
                  <Clock className="h-10 w-10 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Approval Pending
                  </h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Your device authorization request is pending review by the administrator.
                    Please check back later or contact your institution.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">
                    Waiting for approval
                  </span>
                </div>
              </div>
            )}

            {/* BLOCKED / SUSPENDED */}
            {deviceStatus?.status === 'blocked' && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full">
                  <Ban className="h-10 w-10 text-red-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Device Suspended
                  </h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    This device has been suspended from the examination system.
                    Contact your administrator for assistance.
                  </p>
                </div>
                {deviceStatus.reason && (
                  <div className="inline-flex items-start gap-3 px-5 py-4 bg-red-50 border border-red-200 rounded-xl max-w-md mx-auto text-left">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 mb-1">Reason</p>
                      <p className="text-sm text-red-700">{deviceStatus.reason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* UNKNOWN — request form with device name */}
            {deviceStatus?.status === 'unknown' && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Device Not Authorized
                  </h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    This device is not authorized to access the examination system.
                    Enter your device name and request authorization below.
                  </p>
                </div>

                {/* Device name input */}
                <div className="max-w-sm mx-auto text-left space-y-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Device Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={suggestedDeviceName}
                    onChange={e => {
                      setSuggestedDeviceName(e.target.value);
                      if (nameError) setNameError(null);
                    }}
                    placeholder="e.g. John's Laptop, My iPhone"
                    className={`w-full px-4 py-2.5 text-sm border rounded-xl outline-none transition focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      nameError ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
                    }`}
                  />
                  {nameError && (
                    <p className="text-xs text-red-600 mt-1">{nameError}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    This helps the administrator identify whose device to approve.
                  </p>
                </div>

                <button
                  onClick={handleRequestApproval}
                  disabled={requesting}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {requesting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      Request Device Authorization
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Device Info */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Device Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Device ID</p>
                  <p className="text-sm font-mono text-gray-900 truncate">
                    {fingerprint ? `${fingerprint.substring(0, 20)}...` : 'Loading...'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Browser</p>
                  <p className="text-sm text-gray-900 truncate">
                    {browserName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              Having issues? Contact your institution's IT support for assistance.
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                About Device Authorization
              </h3>
              <p className="text-sm text-blue-800">
                For security purposes, only authorized devices can access the examination system.
                Each device must be approved by an administrator before use. This helps prevent
                unauthorized access and ensures exam integrity.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}