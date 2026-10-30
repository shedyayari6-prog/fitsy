import type { WeatherSnapshot } from '@/types';

/**
 * Weather-provider abstraction. The default provider is Open-Meteo (free, no API key).
 * Add another provider by implementing WeatherProvider and returning it from getWeatherProvider().
 */
export interface GeoResult { city: string; country?: string; lat: number; lon: number }
export interface WeatherProvider {
  readonly name: string;
  geocode(query: string): Promise<GeoResult[]>;
  snapshot(lat: number, lon: number, city: string): Promise<WeatherSnapshot>;
}

const WMO: Record<number, string> = {
  0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'freezing fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain',
  66: 'freezing rain', 67: 'freezing rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 77: 'snow grains',
  80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers', 85: 'snow showers', 86: 'snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};

const openMeteo: WeatherProvider = {
  name: 'open-meteo',
  async geocode(query) {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`,
    );
    if (!res.ok) throw new Error('Location search is unavailable right now.');
    const json = await res.json();
    return (json.results ?? []).map((r: { name: string; country?: string; latitude: number; longitude: number }) => ({
      city: r.name, country: r.country, lat: r.latitude, lon: r.longitude,
    }));
  },
  async snapshot(lat, lon, city) {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
        `&timezone=auto&forecast_days=1`,
    );
    if (!res.ok) throw new Error('Weather is unavailable right now.');
    const j = await res.json();
    return {
      city,
      tempC: j.current.temperature_2m,
      minC: j.daily.temperature_2m_min[0],
      maxC: j.daily.temperature_2m_max[0],
      rainChance: j.daily.precipitation_probability_max?.[0] ?? 0,
      summary: WMO[j.current.weather_code as number] ?? 'mixed conditions',
      fetchedAt: new Date().toISOString(),
    };
  },
};

export function getWeatherProvider(): WeatherProvider | null {
  const p = import.meta.env.VITE_WEATHER_PROVIDER ?? 'open-meteo';
  if (p === 'none') return null;
  return openMeteo;
}

/** A general layering guide derived ONLY from the numbers; it is not an AI recommendation. */
export function layeringGuide(w: WeatherSnapshot, t: (s: string) => string = (s) => s): string {
  const parts: string[] = [];
  if (w.tempC <= 8) parts.push(t('Bring a warm coat and layer a knit under it.'));
  else if (w.tempC <= 16) parts.push(t('A light jacket or overshirt over a tee or knit works well.'));
  else if (w.tempC <= 24) parts.push(t('Light layers: a tee or shirt, with a thin jacket to carry.'));
  else parts.push(t('Breathable fabrics such as cotton or linen will keep you comfortable.'));
  if (w.rainChance >= 50) parts.push(t('Rain looks likely, so choose water-friendly shoes and a hood or umbrella.'));
  return parts.join(' ');
}
