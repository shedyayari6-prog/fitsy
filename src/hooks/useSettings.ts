import { useCallback, useEffect, useState } from 'react';

/** Per-device preferences, stored in this browser only. */
export interface DeviceSettings {
  voiceReplies: boolean;
  voiceRate: number;
  reminders: boolean;
  weeklySummary: boolean;
}
const KEY = 'sage.settings';
const DEFAULTS: DeviceSettings = { voiceReplies: false, voiceRate: 1, reminders: false, weeklySummary: false };

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

  const update = useCallback((patch: Partial<DeviceSettings>) => setSettings((s) => ({ ...s, ...patch })), []);
  return [settings, update] as const;
}
