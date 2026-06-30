/**
 * RGPD cookie consent helper.
 * Stores user preferences in localStorage and notifies listeners via a custom event.
 */
export type CookieCategory = 'necessary' | 'analytics' | 'marketing';

export type CookieConsent = {
  necessary: true; // always granted
  analytics: boolean;
  marketing: boolean;
  updatedAt: string; // ISO date
  version: number;
};

const STORAGE_KEY = 'bp_cookie_consent_v1';
const EVENT_NAME = 'bp:cookie-consent-changed';
export const CONSENT_VERSION = 1;

export const getConsent = (): CookieConsent | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setConsent = (consent: Omit<CookieConsent, 'necessary' | 'updatedAt' | 'version'>) => {
  const value: CookieConsent = {
    necessary: true,
    analytics: consent.analytics,
    marketing: consent.marketing,
    updatedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: value }));
  return value;
};

export const acceptAll = () => setConsent({ analytics: true, marketing: true });
export const rejectAll = () => setConsent({ analytics: false, marketing: false });

export const onConsentChange = (cb: (consent: CookieConsent) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<CookieConsent>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
};

export const openCookieSettings = () => {
  window.dispatchEvent(new CustomEvent('bp:open-cookie-settings'));
};