import { useEffect, useState } from 'react';
import { getConsent, onConsentChange } from '@/lib/cookieConsent';

/**
 * Meta Pixel + TikTok Pixel injection.
 * Activated only when env vars are set AND in production builds.
 * - VITE_META_PIXEL_ID
 * - VITE_TIKTOK_PIXEL_ID
 * Respects DNT (Do Not Track).
 */
const META_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const TIKTOK_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID as string | undefined;

const isDNT = () => {
  if (typeof navigator === 'undefined') return false;
  return navigator.doNotTrack === '1' || (window as any).doNotTrack === '1';
};

const loadMeta = (id: string) => {
  if ((window as any).fbq) return;
  const f = window as any;
  const n: any = (f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  });
  if (!f._fbq) f._fbq = n;
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  n('init', id);
  n('track', 'PageView');
};

const loadTikTok = (id: string) => {
  if ((window as any).ttq) return;
  const w = window as any;
  w.TiktokAnalyticsObject = 'ttq';
  const ttq: any = (w.ttq = w.ttq || []);
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
  ttq.setAndDefer = function (t: any, e: string) {
    t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); };
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.load = function (e: string) {
    const r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r;
    ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
    ttq._o = ttq._o || {}; ttq._o[e] = {};
    const s = document.createElement('script');
    s.async = true;
    s.src = `${r}?sdkid=${e}&lib=ttq`;
    document.head.appendChild(s);
  };
  ttq.load(id);
  ttq.page();
};

const MarketingPixels = () => {
  const [marketingOk, setMarketingOk] = useState<boolean>(() => getConsent()?.marketing === true);
  useEffect(() => onConsentChange((c) => setMarketingOk(c.marketing === true)), []);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    if (isDNT()) return;
    if (!marketingOk) return;
    if (META_ID) loadMeta(META_ID);
    if (TIKTOK_ID) loadTikTok(TIKTOK_ID);
  }, [marketingOk]);
  return null;
};

export default MarketingPixels;