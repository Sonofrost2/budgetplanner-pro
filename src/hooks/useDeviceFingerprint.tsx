import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Generates a stable client-side fingerprint and registers it for the current
 * authenticated user. Used by admins to detect multi-account abuse.
 *
 * The fingerprint is intentionally lightweight (no canvas, no WebGL):
 *   sha256( userAgent | platform | timezone | language | screenSize | colorDepth )
 * Stored once per (user, fingerprint), updated on each session via last_seen_at.
 */
async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const useDeviceFingerprint = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const parts = [
          navigator.userAgent,
          (navigator as any).platform || '',
          Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          navigator.language || '',
          `${screen.width}x${screen.height}`,
          String(screen.colorDepth),
          String((navigator as any).hardwareConcurrency || ''),
        ].join('|');
        const fingerprint = await sha256(parts);
        if (cancelled) return;

        // Upsert: insert or bump last_seen_at
        const { error } = await supabase.from('device_fingerprints').upsert(
          {
            user_id: user.id,
            fingerprint,
            user_agent: navigator.userAgent,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,fingerprint' }
        );
        if (error) console.warn('[fingerprint] upsert error:', error.message);
      } catch (e) {
        console.warn('[fingerprint] failed:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);
};
