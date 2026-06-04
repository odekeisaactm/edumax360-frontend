// Domains that don't follow the api.{domain} convention
const EXEMPTIONS: Record<string, string> = {
  'localhost':                                    'http://localhost:8000',
  'school-saas-frontend-lyart.vercel.app':        'https://api.demo.edumax360.balablutech.com', // update when you have a staging backend
  'demo.edumax360.balablutech.com':               'https://api.demo.edumax360.balablutech.com', // update when you have a staging backend
  'demo.edumax360.com':                           'https://api.demo.edumax360.balablutech.com', // update when you have a staging backend
  'demo.edumax360.com.ng':                        'https://api.demo.edumax360.balablutech.com', // update when you have a staging backend
};

let _cachedApiUrl: string | null = null;

export function getApiUrl(): string {
  // Return cached value if already resolved
  if (_cachedApiUrl) return _cachedApiUrl;

  // SSR safety — no window on the server
  if (typeof window === 'undefined') return '';

  const hostname = window.location.hostname;

  // Catch any *.vercel.app preview deployments
  if (hostname.endsWith('.vercel.app')) {
    _cachedApiUrl = 'https://api.demo.edumax360.balablutech.com'; //
    return _cachedApiUrl;
  }

  // Check explicit exemptions
  if (hostname in EXEMPTIONS) {
    _cachedApiUrl = EXEMPTIONS[hostname];
    return _cachedApiUrl;
  }

  // Default rule for all school domains: api.{domain}
  // e.g. daisies.com → https://api.daisies.com
  _cachedApiUrl = `https://api.${hostname}`;
  return _cachedApiUrl;
}