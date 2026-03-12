import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if already subscribed
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, [user]);

  const subscribe = useCallback(async () => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') { setLoading(false); return false; }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
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

  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  return { permission, subscribed, subscribe, unsubscribe, loading, isSupported };
};
