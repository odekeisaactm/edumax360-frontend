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
  if (_cachedApiUrl) return _cachedApiUrl;
  if (typeof window === 'undefined') return '';

  // Strip www. prefix before building API url
  const hostname = window.location.hostname.replace(/^www\./, '');

  if (hostname.endsWith('.vercel.app')) {
    _cachedApiUrl = 'https://api.demo.edumax360.balablutech.com';
    return _cachedApiUrl;
  }

  if (hostname in EXEMPTIONS) {
    _cachedApiUrl = EXEMPTIONS[hostname];
    return _cachedApiUrl;
  }

  _cachedApiUrl = `https://api.${hostname}`;
  return _cachedApiUrl;
}


// done