import { useCallback, useEffect, useState } from 'react';
import {
  defaultPrefs, getNotificationPrefs, removePushSubscription, saveNotificationPrefs, savePushSubscription,
  sendTestNotification, type NotificationPrefs,
} from '@/lib/data';
import { currentSubscription, pushSupported, subscribeToPush, unsubscribeFromPush, vapidPublicKey } from '@/lib/push';

export type NotifBusy = 'save' | 'push' | 'test' | null;

export function useNotifications(uid: string, available: boolean) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs());
  const [loading, setLoading] = useState(available);
  const [busy, setBusy] = useState<NotifBusy>(null);
  const [browserSubscribed, setBrowserSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    pushSupported() ? Notification.permission : 'unsupported',
  );

  useEffect(() => {
    if (!available) { setLoading(false); return; }
    let live = true;
    (async () => {
      try {
        const [p, sub] = await Promise.all([getNotificationPrefs(uid), currentSubscription().catch(() => null)]);
        if (!live) return;
        setPrefs(p);
        setBrowserSubscribed(!!sub);
      } catch { /* keep defaults; the UI shows the setup hint */ }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [uid, available]);

  const update = useCallback(async (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setBusy('save');
    try { await saveNotificationPrefs(uid, next); }
    catch (e) { setPrefs(prefs); throw e; }
    finally { setBusy(null); }
  }, [prefs, uid]);

  const enablePush = useCallback(async () => {
    setBusy('push');
    try {
      const sub = await subscribeToPush();
      setPermission(Notification.permission);
      await savePushSubscription(uid, sub.toJSON());
      setBrowserSubscribed(true);
      const next = { ...prefs, push_enabled: true };
      await saveNotificationPrefs(uid, next);
      setPrefs(next);
    } catch (e) {
      if (pushSupported()) setPermission(Notification.permission);
      throw e;
    } finally { setBusy(null); }
  }, [prefs, uid]);

  const disablePush = useCallback(async () => {
    setBusy('push');
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await removePushSubscription(uid, endpoint);
      setBrowserSubscribed(false);
      const next = { ...prefs, push_enabled: false };
      await saveNotificationPrefs(uid, next);
      setPrefs(next);
    } finally { setBusy(null); }
  }, [prefs, uid]);

  const test = useCallback(async () => {
    setBusy('test');
    try { return await sendTestNotification(uid); } finally { setBusy(null); }
  }, [uid]);

  return {
    prefs, loading, busy, update, enablePush, disablePush, test,
    browserSubscribed, permission,
    pushSupported: pushSupported(), pushConfigured: !!vapidPublicKey,
  };
}
