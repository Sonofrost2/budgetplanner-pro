/**
 * Google Tag Manager + Google Analytics 4 conversion tracking.
 *
 * IDs are loaded from Vite env vars so they can be swapped per environment:
 *   VITE_GTM_ID  = GTM-XXXXXXX  (Google Tag Manager container)
 *   VITE_GA4_ID  = G-XXXXXXXXXX (GA4 measurement, configured as a tag inside GTM)
 *
 * If VITE_GTM_ID is unset, analytics is disabled (dataLayer pushes become no-ops)
 * so previews and local dev never pollute production reporting.
 *
 * Standard events fired by the app:
 *   - sign_up         (Signup.tsx)         — method: 'email'
 *   - begin_trial     (PaymentPage.tsx)    — plan, value, currency
 *   - begin_checkout  (PaymentPage.tsx)    — plan, value, currency
 *   - purchase        (PaymentPage.tsx)    — transaction_id, value, currency, items
 */

export const GTM_ID = (import.meta.env.VITE_GTM_ID as string | undefined)?.trim() || '';
export const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim() || '';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

let initialized = false;

/** Inject GTM (and, via GTM, GA4) once. Safe to call multiple times. */
export function initAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

  if (!GTM_ID) return; // no container configured — dataLayer still queued for later.

  // GTM head snippet
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);

  // GTM <noscript> body fallback (best-effort; SPA still needs JS to render)
  const noscript = document.createElement('noscript');
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.googletagmanager.com/ns.html?id=${GTM_ID}`;
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  noscript.appendChild(iframe);
  document.body.appendChild(noscript);
}

/** Push a custom event onto the dataLayer. GTM forwards it to GA4 & other tags. */
export function trackEvent(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/** Track a virtual page view on SPA route change. Call after navigation. */
export function trackPageView(path: string, title?: string): void {
  trackEvent('page_view', {
    page_path: path,
    page_location: typeof window !== 'undefined' ? window.location.href : path,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : undefined),
  });
}