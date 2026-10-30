// Supabase Edge Function: store-cleanup
// Permanently deletes listings older than their 30 days (rows, contacts, reports, photos).
// Run it daily with the x-cron-secret header (same CRON_SECRET as send-notifications).
// Expired listings are already invisible to other users through RLS, so this is the hard delete.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { json } from '../_shared/cors.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!CRON_SECRET || given.length !== CRON_SECRET.length || given !== CRON_SECRET) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let deleted = 0;
  // Loop in batches so a large backlog cannot time out.
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.from('store_listings').select('id, image_path').lt('expires_at', new Date().toISOString()).limit(200);
    if (error) { console.error('select failed', error.message); return json({ error: 'query_failed', deleted }, 500); }
    if (!data?.length) break;
    const paths = data.map((r) => r.image_path).filter(Boolean) as string[];
    if (paths.length) {
      const { error: rmErr } = await admin.storage.from('store').remove(paths);
      if (rmErr) console.error('storage remove failed', rmErr.message);
    }
    const { error: delErr } = await admin.from('store_listings').delete().in('id', data.map((r) => r.id));
    if (delErr) { console.error('delete failed', delErr.message); return json({ error: 'delete_failed', deleted }, 500); }
    deleted += data.length;
  }
  return json({ ok: true, deleted });
});
