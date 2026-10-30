// Supabase Edge Function: send-notifications
//
// Two ways to call it:
//   1) Signed-in user, body {"test": true}  → sends one test notification to that user (push + email).
//   2) Scheduler, header "x-cron-secret: <CRON_SECRET>" → sends due daily reminders / weekly summaries.
//      Run it HOURLY. The function decides who is due in their own timezone, at most one message per user per day.
//
// Secrets (supabase secrets set …):
//   RESEND_API_KEY      Resend API key                     (email)
//   RESEND_FROM         e.g. "Sage <hello@yourdomain.com>"  (must be on a domain verified in Resend)
//   VAPID_PUBLIC_KEY    same value as VITE_VAPID_PUBLIC_KEY  (web push)
//   VAPID_PRIVATE_KEY   private half of the VAPID pair        (web push)
//   VAPID_SUBJECT       "mailto:you@yourdomain.com"
//   SITE_URL            https://your-site.example (links in messages)
//   CRON_SECRET         long random string for the scheduler
// Either channel can be left unconfigured; it is then skipped and reported as such.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import webpush from 'npm:web-push@3.6.7';
import { corsHeaders, json } from '../_shared/cors.ts';

const SITE_URL = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? '';
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const pushReady = !!(VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT);
if (pushReady) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

type Kind = 'daily' | 'weekly' | 'test';
interface Msg { title: string; body: string; cta: string; path: string }
interface Stats { weekXp: number; weekDays: number; streak: number; level: number }

// ── copy (English + French; other languages fall back to English) ─────────────
const COPY: Record<string, {
  daily: (n: string) => Omit<Msg, 'path'>; weekly: (n: string, s: Stats) => Omit<Msg, 'path'>; test: () => Omit<Msg, 'path'>;
  open: string; why: string; manage: string; hi: (n: string) => string; bye: string;
}> = {
  en: {
    daily: (n) => ({ title: 'What are we wearing today?', body: `${n ? n + ', ask' : 'Ask'} Sage for today's look. It takes a minute.`, cta: 'Ask Sage' }),
    weekly: (n, s) => ({
      title: 'Your week with Sage',
      body: `${n ? n + ', this' : 'This'} week you were active on ${s.weekDays} day${s.weekDays === 1 ? '' : 's'} and earned ${s.weekXp} XP. You are level ${s.level}` +
        (s.streak > 0 ? ` with a ${s.streak}-day streak.` : '.'),
      cta: 'See my progress',
    }),
    test: () => ({ title: 'Notifications are working', body: 'This is a test from Sage. You will only get messages you switched on.', cta: 'Open Sage' }),
    open: 'Open Sage', why: 'You are receiving this because you turned on notifications in Sage.', manage: 'Change or turn off notifications',
    hi: (n) => (n ? `Hi ${n},` : 'Hi,'), bye: 'Your stylist, Sage',
  },
  fr: {
    daily: (n) => ({ title: "Qu'est-ce qu'on porte aujourd'hui ?", body: `${n ? n + ', demande' : 'Demande'} le look du jour à Sage. Ça prend une minute.`, cta: 'Demander à Sage' }),
    weekly: (n, s) => ({
      title: 'Ta semaine avec Sage',
      body: `${n ? n + ', cette' : 'Cette'} semaine, tu as été actif(ve) ${s.weekDays} jour${s.weekDays > 1 ? 's' : ''} et gagné ${s.weekXp} XP. Tu es niveau ${s.level}` +
        (s.streak > 0 ? ` avec une série de ${s.streak} jour${s.streak > 1 ? 's' : ''}.` : '.'),
      cta: 'Voir ma progression',
    }),
    test: () => ({ title: 'Les notifications fonctionnent', body: "Ceci est un test de Sage. Tu ne recevras que les messages que tu as activés.", cta: 'Ouvrir Sage' }),
    open: 'Ouvrir Sage', why: 'Tu reçois ce message car tu as activé les notifications dans Sage.', manage: 'Modifier ou désactiver les notifications',
    hi: (n) => (n ? `Salut ${n},` : 'Salut,'), bye: 'Ton styliste, Sage',
  },
};
const copyFor = (lang: string) => COPY[lang] ?? COPY.en;

function buildMessage(kind: Kind, lang: string, name: string, stats?: Stats): Msg {
  const c = copyFor(lang);
  if (kind === 'weekly') return { ...c.weekly(name, stats ?? { weekXp: 0, weekDays: 0, streak: 0, level: 1 }), path: '/app/quests' };
  if (kind === 'test') return { ...c.test(), path: '/app/settings' };
  return { ...c.daily(name), path: '/app/stylist' };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

function emailHtml(lang: string, name: string, m: Msg): string {
  const c = copyFor(lang);
  const url = `${SITE_URL}${m.path}`;
  return `<!doctype html><html lang="${esc(lang)}"><body style="margin:0;background:#F7F4ED;font-family:Helvetica,Arial,sans-serif;color:#344E41">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #E6E0D2">
<tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:700;color:#344E41">Sage</td></tr>
<tr><td style="padding:8px 28px 0;font-size:18px;font-weight:700">${esc(m.title)}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.6"><p style="margin:0 0 12px">${esc(c.hi(name))}</p><p style="margin:0">${esc(m.body)}</p></td></tr>
<tr><td style="padding:24px 28px"><a href="${esc(url)}" style="display:inline-block;background:#344E41;color:#F7F4ED;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;font-size:15px">${esc(m.cta)}</a></td></tr>
<tr><td style="padding:0 28px 24px;font-size:14px;color:#344E41">${esc(c.bye)}</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E6E0D2;font-size:12px;line-height:1.5;color:#6B7A6F">${esc(c.why)}<br>
<a href="${esc(SITE_URL + '/app/settings')}" style="color:#C78665">${esc(c.manage)}</a></td></tr>
</table></td></tr></table></body></html>`;
}

// ── channels ──────────────────────────────────────────────────────────────────
interface Sub { id: string; endpoint: string; p256dh: string; auth: string }
// deno-lint-ignore no-explicit-any
type Admin = any;

async function sendPush(admin: Admin, subs: Sub[], m: Msg, kind: Kind): Promise<number> {
  if (!pushReady || !subs.length) return 0;
  const payload = JSON.stringify({ title: m.title, body: m.body, url: `${SITE_URL}${m.path}` || m.path, tag: `sage-${kind}` });
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(s.id); // subscription is gone: clean it up
      else console.error('push failed', status);
    }
  }));
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);
  return sent;
}

async function sendEmail(to: string, lang: string, name: string, m: Msg): Promise<boolean> {
  if (!RESEND_KEY || !RESEND_FROM || !to) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject: m.title,
      html: emailHtml(lang, name, m),
      text: `${copyFor(lang).hi(name)}\n\n${m.body}\n\n${SITE_URL}${m.path}\n\n${copyFor(lang).why}\n${SITE_URL}/app/settings`,
      headers: { 'List-Unsubscribe': `<${SITE_URL}/app/settings>` },
    }),
  });
  if (!res.ok) console.error('resend failed', res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

// ── helpers ───────────────────────────────────────────────────────────────────
/** Local date (YYYY-MM-DD), hour and weekday (0 = Sunday) for a timezone; falls back to UTC if the zone is invalid. */
function localTime(tz: string, now = new Date()) {
  let fmt: Intl.DateTimeFormat;
  try { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short' }); }
  catch { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', weekday: 'short' }); }
  const p = Object.fromEntries(fmt.formatToParts(now).map((x) => [x.type, x.value]));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: days.indexOf(p.weekday) };
}

async function statsFor(admin: Admin, uid: string): Promise<Stats> {
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: prog }, { data: comps }] = await Promise.all([
    admin.from('user_progress').select('level, current_streak').eq('user_id', uid).maybeSingle(),
    admin.from('quest_completions').select('completion_date, xp_awarded').eq('user_id', uid).gte('completion_date', since),
  ]);
  const rows = (comps ?? []) as { completion_date: string; xp_awarded: number }[];
  return {
    weekXp: rows.reduce((a, r) => a + r.xp_awarded, 0),
    weekDays: new Set(rows.map((r) => r.completion_date)).size,
    streak: prog?.current_streak ?? 0,
    level: prog?.level ?? 1,
  };
}

interface Target { uid: string; email?: string; lang: string; name: string; push: boolean; mail: boolean }

async function deliver(admin: Admin, t: Target, kind: Kind) {
  const stats = kind === 'weekly' ? await statsFor(admin, t.uid) : undefined;
  const m = buildMessage(kind, t.lang, t.name, stats);
  let push = 0;
  if (t.push) {
    const { data } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', t.uid);
    push = await sendPush(admin, (data ?? []) as Sub[], m, kind);
  }
  const email = t.mail ? await sendEmail(t.email ?? '', t.lang, t.name, m) : false;
  return { push, email };
}

async function loadTarget(admin: Admin, uid: string, push: boolean, mail: boolean): Promise<Target> {
  const [{ data: prof }, { data: u }] = await Promise.all([
    admin.from('profiles').select('display_name, preferred_language').eq('id', uid).maybeSingle(),
    admin.auth.admin.getUserById(uid),
  ]);
  return { uid, email: u?.user?.email ?? undefined, lang: prof?.preferred_language ?? 'en', name: prof?.display_name ?? '', push, mail };
}

// ── entry point ───────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Scheduler mode
  const cron = req.headers.get('x-cron-secret');
  if (cron !== null) {
    if (!CRON_SECRET || cron.length !== CRON_SECRET.length || cron !== CRON_SECRET) return json({ error: 'unauthorized' }, 401);
    const { data: rows, error } = await admin.from('notification_prefs')
      .select('user_id, daily_reminder, weekly_summary, push_enabled, email_enabled, reminder_hour, timezone, last_daily_sent, last_weekly_sent')
      .or('daily_reminder.eq.true,weekly_summary.eq.true')
      .limit(5000);
    if (error) { console.error(error); return json({ error: 'query_failed' }, 500); }

    let sentDaily = 0, sentWeekly = 0, skipped = 0, failed = 0;
    for (const r of rows ?? []) {
      if (!r.push_enabled && !r.email_enabled) { skipped++; continue; }
      const lt = localTime(r.timezone);
      if (lt.hour !== r.reminder_hour) { skipped++; continue; }
      const dueWeekly = r.weekly_summary && lt.weekday === 0 && r.last_weekly_sent !== lt.date;
      const dueDaily = r.daily_reminder && r.last_daily_sent !== lt.date;
      if (!dueWeekly && !dueDaily) { skipped++; continue; }
      try {
        const kind: Kind = dueWeekly ? 'weekly' : 'daily'; // at most one message per user per day
        const target = await loadTarget(admin, r.user_id, r.push_enabled, r.email_enabled);
        const res = await deliver(admin, target, kind);
        if (res.push === 0 && !res.email) { failed++; continue; } // nothing reached them: try again next hour
        const patch: Record<string, string> = kind === 'weekly' ? { last_weekly_sent: lt.date, last_daily_sent: lt.date } : { last_daily_sent: lt.date };
        await admin.from('notification_prefs').update(patch).eq('user_id', r.user_id);
        if (kind === 'weekly') sentWeekly++; else sentDaily++;
      } catch (e) { console.error('deliver failed', e); failed++; }
    }
    return json({ ok: true, sentDaily, sentWeekly, skipped, failed });
  }

  // Test mode (signed-in user)
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { data: who, error: whoErr } = await userClient.auth.getUser();
  if (whoErr || !who.user) return json({ error: 'unauthorized' }, 401);
  const body = await req.json().catch(() => ({}));
  if (body?.test !== true) return json({ error: 'bad_request', message: 'Unsupported request.' }, 400);

  const uid = who.user.id;
  const { data: prefs } = await admin.from('notification_prefs').select('push_enabled, email_enabled, last_test_at').eq('user_id', uid).maybeSingle();
  if (!prefs || (!prefs.push_enabled && !prefs.email_enabled)) {
    return json({ error: 'no_channel', message: 'Turn on browser notifications or email first.' }, 400);
  }
  if (prefs.last_test_at && Date.now() - new Date(prefs.last_test_at).getTime() < 30_000) {
    return json({ error: 'rate_limited', message: 'Please wait a few seconds before sending another test.' }, 429);
  }
  await admin.from('notification_prefs').update({ last_test_at: new Date().toISOString() }).eq('user_id', uid);

  const target = await loadTarget(admin, uid, prefs.push_enabled, prefs.email_enabled);
  const res = await deliver(admin, target, 'test');
  const notes: string[] = [];
  if (prefs.push_enabled && !pushReady) notes.push('Push is not configured on the server (VAPID secrets).');
  if (prefs.email_enabled && (!RESEND_KEY || !RESEND_FROM)) notes.push('Email is not configured on the server (RESEND_API_KEY / RESEND_FROM).');
  return json({ ...res, notes });
});
