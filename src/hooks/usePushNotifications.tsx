import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

let cachedVapidKey: string | null = null;

async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) return cachedVapidKey;
  const { data, error } = await supabase.functions.invoke('get-vapid-key');
  if (error) throw new Error('Failed to fetch VAPID key');
  cachedVapidKey = data.vapidPublicKey;
  return cachedVapidKey!;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const checkedRef = useRef(false);

  // Dynamically re-check permission on focus (user may have changed it in browser settings)
  useEffect(() => {
    const checkPermission = () => {
      if (typeof Notification !== 'undefined') {
        setPermission(Notification.permission);
      }
    };

    // Check on mount
    checkPermission();

    // Re-check when window regains focus (user may have changed browser settings)
    window.addEventListener('focus', checkPermission);
    // Also check on visibility change (PWA returning to foreground)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkPermission();
    });

    return () => {
      window.removeEventListener('focus', checkPermission);
    };
  }, []);

  // Check if already subscribed using the PWA's own service worker
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || checkedRef.current) return;
    checkedRef.current = true;
    navigator.serviceWorker.ready.then(async (reg) => {
      try {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch (e) {
        console.warn('Could not check push subscription:', e);
      }
    });
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    setLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setLoading(false); return false; }

      // Fetch VAPID public key
      const vapidPublicKey = await getVapidPublicKey();
      if (!vapidPublicKey) {
        console.error('VAPID public key not available');
        setLoading(false);
        return false;
      }

      // Use the existing PWA service worker (which already imports sw-push.js)
      // Do NOT register a separate service worker — it conflicts with the PWA SW
      const swReg = await navigator.serviceWorker.ready;

      let sub = await swReg.pushManager.getSubscription();

      if (!sub) {
        sub = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
      }

      const subJson = sub.toJSON();
      const endpoint = subJson.endpoint!;
      const p256dh = subJson.keys!.p256dh!;
      const auth = subJson.keys!.auth!;

      // Upsert to database
      await supabase.from('push_subscriptions').upsert(
        { user_id: user.id, endpoint, p256dh, auth },
        { onConflict: 'user_id,endpoint' }
      );

      setSubscribed(true);
      setLoading(false);
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      setLoading(false);
      return false;
    }
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!user || !('serviceWorker' in navigator)) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint);
      }
      setSubscribed(false);
    } catch (e) {
      console.error('Push unsubscribe error:', e);
    }
    setLoading(false);
  }, [user]);

  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  return { permission, subscribed, subscribe, unsubscribe, loading, isSupported };
};
