// Supabase Edge Function: store-geo
// Returns the visitor's APPROXIMATE country (and city when known), used only to show nearby listings first.
// The IP address is read from the request, used for this one lookup, and NEVER stored or logged.
//
// Order of lookup:
//   1. Headers added by the edge network (cf-ipcountry / cf-ipcity), when present. No third party involved.
//   2. Optional: a geo-IP provider you configure with GEOIP_URL, e.g. https://ipapi.co/{ip}/json/
//      ({ip} is replaced by the visitor's IP; the response must contain country_code / country and city).
//      Setting GEOIP_URL sends the visitor's IP to that provider, so mention it in your privacy policy.
// If neither works, it answers {country:null} and the app falls back to the city in the user's profile.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const code = (v: string | null) => (v && /^[A-Za-z]{2}$/.test(v) && v.toUpperCase() !== 'XX' && v.toUpperCase() !== 'T1' ? v.toUpperCase() : null);

  let country = code(req.headers.get('cf-ipcountry'));
  let city: string | null = req.headers.get('cf-ipcity');

  const tpl = Deno.env.get('GEOIP_URL');
  if (!country && tpl) {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || '';
    if (ip && /^[0-9a-fA-F:.]+$/.test(ip)) {
      try {
        const r = await fetch(tpl.replace('{ip}', encodeURIComponent(ip)), { signal: AbortSignal.timeout(2500) });
        if (r.ok) {
          const j = await r.json();
          country = code(j.country_code ?? j.countryCode ?? j.country ?? null);
          city = typeof j.city === 'string' ? j.city : city;
        }
      } catch { /* no location: the client falls back to the profile city */ }
    }
  }
  return json({ country, city: city && city.length <= 80 ? city : null });
});
