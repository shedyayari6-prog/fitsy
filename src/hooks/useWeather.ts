import { useEffect, useState } from 'react';
import { getWeatherProvider } from '@/lib/weather';
import type { Profile, WeatherSnapshot } from '@/types';

export type WeatherStatus = 'off' | 'no-location' | 'loading' | 'ready' | 'error';

/** Only fetches when the user opted in AND chose a location. Never requests browser geolocation. */
export function useWeather(profile: Profile | null) {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [status, setStatus] = useState<WeatherStatus>('off');

  const lat = profile?.location_lat ?? null;
  const lon = profile?.location_lon ?? null;
  const city = profile?.location_city ?? null;
  const enabled = profile?.weather_enabled ?? false;

  useEffect(() => {
    const provider = getWeatherProvider();
    if (!enabled || !provider) { setStatus('off'); setData(null); return; }
    if (lat === null || lon === null || !city) { setStatus('no-location'); setData(null); return; }
    let live = true;
    setStatus('loading');
    provider.snapshot(lat, lon, city)
      .then((w) => { if (live) { setData(w); setStatus('ready'); } })
      .catch(() => { if (live) { setData(null); setStatus('error'); } });
    return () => { live = false; };
  }, [enabled, lat, lon, city]);

  return { weather: data, status };
}
