import { useEffect, useRef } from 'react';

/**
 * Version-check safety net: polls `/version.json` and fires a global
 * `app:update-available` CustomEvent when a new deploy is detected. This
 * runs independently of the service worker — if the SW misses an update
 * (broken registration, `NetworkFirst` served a cached HTML, etc.), the
 * PWAUpdatePrompt still surfaces the update.
 *
 * Design:
 *  - Uses `__APP_BUILD_ID__` (injected by Vite) as the baseline.
 *  - Fetches `/version.json?ts=<now>` to defeat any intermediate cache.
 *  - Polls every 5 min + on window focus + on `online` event.
 *  - Only runs in production, not in Capacitor native, not in iframes.
 */

const POLL_INTERVAL_MS = 60_000;
const BUILD_ID: string | undefined =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : undefined;

const shouldSkip = () => {
  if (!import.meta.env.PROD) return true;
  if (typeof window === 'undefined') return true;
  try {
    if ((window as any)?.Capacitor?.isNativePlatform?.()) return true;
  } catch { /* ignore */ }
  try {
    if (window.self !== window.top) return true; // preview iframe
  } catch { return true; }
  const host = window.location.hostname;
  if (host.startsWith('id-preview--') || host.startsWith('preview--')) return true;
  if (host === 'lovableproject.com' || host.endsWith('.lovableproject.com')) return true;
  return false;
};

let dispatched = false;
const dispatchOnce = (remote: string) => {
  if (dispatched) return;
  dispatched = true;
  window.dispatchEvent(
    new CustomEvent('app:update-available', { detail: { current: BUILD_ID, remote } }),
  );
};

export const useVersionCheck = () => {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    if (shouldSkip() || !BUILD_ID) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled || dispatched) return;
      try {
        const res = await fetch(`/version.json?ts=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'omit',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.version && data.version !== BUILD_ID) {
          dispatchOnce(String(data.version));
        }
      } catch { /* offline / network hiccup — retry later */ }
    };

    // Initial check after a short delay (let the app settle).
    const t0 = window.setTimeout(check, 5_000);
    const interval = window.setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => { check(); };
    const onOnline = () => { check(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      window.clearTimeout(t0);
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, []);
};

export default useVersionCheck;