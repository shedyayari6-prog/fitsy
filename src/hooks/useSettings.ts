import { useCallback, useEffect, useState } from 'react';

/** Per-device preferences, stored in this browser only. */
export interface DeviceSettings {
  voiceReplies: boolean;
  voiceRate: number;
  promoAdSound: boolean;
  reminders: boolean;
  weeklySummary: boolean;
}
const KEY = 'sage.settings';
const DEFAULTS: DeviceSettings = { voiceReplies: false, voiceRate: 1, promoAdSound: true, reminders: false, weeklySummary: false };

function read(): DeviceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch { return DEFAULTS; }
}

export function useSettings() {
  const [settings, setSettings] = useState<DeviceSettings>(read);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  }, [settings]);

  useEffect(() => {
    const sync = () => setSettings(read());
    window.addEventListener('sage-settings-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('sage-settings-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = useCallback((patch: Partial<DeviceSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    window.dispatchEvent(new Event('sage-settings-change'));
  }, [settings]);
  return [settings, update] as const;
}
