import { useEffect, useState } from 'react';

export interface GeoInfo {
  country: string | null;       // ISO alpha-2
  ip: string | null;
  city: string | null;
  loading: boolean;
  /** Heuristic: Datacenter ASN flagged by ipapi as 'org' starting with hosting keywords. */
  suspectedHosting: boolean;
}

const KEY = 'geo_country_v2';

/**
 * Detect the user's country from IP. Uses ipapi.co (free, no key, ~30k req/month).
 * Cached in sessionStorage to avoid re-querying. Used for phone country auto-pick
 * and for VPN/country-mismatch warnings.
 */
export const useGeoCountry = (): GeoInfo => {
  const [info, setInfo] = useState<GeoInfo>({
    country: null, ip: null, city: null, loading: true, suspectedHosting: false,
  });

  useEffect(() => {
    const cached = sessionStorage.getItem(KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setInfo({ ...parsed, loading: false });
        return;
      } catch { /* ignore */ }
    }
    let cancelled = false;
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const org = (data?.org || '').toLowerCase();
        const suspectedHosting = /amazon|google cloud|microsoft|digitalocean|ovh|hetzner|linode|vultr|hosting|datacenter|cloudflare|leaseweb|choopa|colocation|m247/.test(org);
        const next: GeoInfo = {
          country: data?.country_code || null,
          ip: data?.ip || null,
          city: data?.city || null,
          loading: false,
          suspectedHosting,
        };
        sessionStorage.setItem(KEY, JSON.stringify(next));
        setInfo(next);
      })
      .catch(() => setInfo(s => ({ ...s, loading: false })));
    return () => { cancelled = true; };
  }, []);

  return info;
};