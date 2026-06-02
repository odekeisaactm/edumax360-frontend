import FingerprintJS from '@fingerprintjs/fingerprintjs';

let fpPromise: Promise<any> | null = null;

/**
 * Initialize fingerprint library (singleton)
 */
const initFingerprint = () => {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
};

/**
 * Get device fingerprint
 */
export const getDeviceFingerprint = async (): Promise<string> => {
  try {
    const fp = await initFingerprint();
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    console.error('Error generating fingerprint:', error);
    // Fallback to simple fingerprint
    return generateSimpleFingerprint();
  }
};

/**
 * Fallback: Simple fingerprint based on navigator info
 */
const generateSimpleFingerprint = (): string => {
  const nav = window.navigator;
  const screen = window.screen;

  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
};