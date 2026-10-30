# Fitsy - AI personal stylist

React + Vite + TypeScript front end, Supabase (Auth, Postgres + RLS, Storage, Edge Functions) back end.
The product name, mascot asset and copy live in `src/config/brand.ts`.

> **Status:** the code was written in a sandbox that could not reach the npm registry, so it has **not been
> installed, built or run**. Run the checks in "First run" and fix any reported errors before relying on it.

## First run

```bash
npm install
cp .env.example .env        # then fill in the two VITE_ values (optional for demo mode)
npm run typecheck && npm run build
npm run dev
```

Without Supabase credentials the app starts in **clearly labelled demo mode**: data stays in your browser's
localStorage, photo upload is off and the AI stylist is unavailable (it never fakes AI replies).

## Supabase setup

1. Create a project at supabase.com.
2. **Schema + RLS + storage + XP logic:** run `supabase/migrations/20261027000001_schema.sql`, then
   `supabase/migrations/20261028000001_notifications.sql` (notification preferences + push subscriptions)
   
   (`supabase link --project-ref <ref> && supabase db push`, or paste it into the SQL editor).
   It creates all tables, RLS policies, the private `wardrobe` bucket and its policies, seed quests/achievements,
   the signup trigger and the `complete_quest()` function.
3. **Auth** (Dashboard → Authentication):
   - Providers → Email enabled. Keep "Confirm email" on if you want email verification.
   - URL Configuration → Site URL = your site (`http://localhost:5173` locally); add redirect URLs
     `http://localhost:5173/app` and `http://localhost:5173/reset-password` (and the production equivalents).
4. **Storage:** the migration creates the private `wardrobe` bucket (5 MB, JPG/PNG/WebP). Images are served via
   short-lived signed URLs. Nothing is public.
5. **Edge Functions + AI provider:**
   ```bash
   supabase functions deploy ai-stylist
   supabase functions deploy delete-account
   supabase functions deploy send-notifications --no-verify-jwt   # see "Notifications" below
   supabase secrets set AI_API_KEY=... AI_MODEL=... 
   # optional: AI_API_URL (any OpenAI-compatible /chat/completions endpoint), ALLOWED_ORIGIN=https://your-site
   ```
   `AI_MODEL` has no default on purpose: set the model your provider offers.
   Keys are only read inside the functions. They are never in `VITE_` variables.
6. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.

## Weather

Default provider is Open-Meteo (free, no key). Users type a city; the browser's geolocation is never requested.
Set `VITE_WEATHER_PROVIDER=none` to disable. Add providers in `src/lib/weather.ts`.

## Languages

The interface is translated for **English and French** (`src/i18n/`). The English text is the key:
`t('Find Your Style')`; a missing translation falls back to English, so nothing breaks. Choosing a language on the
landing page, in onboarding, Profile or Settings switches the whole app immediately, is remembered in the browser
and saved on the profile (it follows the user across devices). Sage's chat replies use the profile language for
all six listed languages (en, fr, ar, es, de, it); only en/fr have a translated interface.

To add a language: create `src/i18n/<code>.ts` exporting a `Record<string,string>` (copy `fr-a/b/c.ts` as a
starting point) and register it in `DICTS` in `src/i18n/index.tsx`. Quest/achievement text stored in the database is
translated on the client through the same dictionary.

## Mascot poses

Put these files in `public/mascot/` (same framing as `sage.png`: character centred, portrait, cream or transparent
background; ~600–800 px tall PNGs are plenty, run them through an optimiser):

| File | Used for |
|---|---|
| `happywave.png` | greeting, welcome, landing |
| `jumping_happy.png` | celebrating, excited |
| `victory.png` | level up, all quests done, outfit approved |
| `thinking.png` | loading, waiting for the AI, confused |
| `shocked.png` | surprised moments |
| `sad.png` | empty states, no results, errors |
| `crying.png` | hard failures, account deletion |
| `streak_growing.png` | active streaks |

A missing file falls back to the base artwork, so you can add them one by one. The mapping is
`mascotPoses` in `src/config/brand.ts` and `POSE_FOR` in `src/components/mascot/Mascot.tsx`. On top of the poses,
the mascot has idle breathing, random fidgets (hop / tilt / wave), a tap reaction, a ground shadow and
state-specific overlays (confetti, sparkles, tears…). Everything respects `prefers-reduced-motion`.

## Email with Resend

Two separate things use Resend:

### 1. Auth emails (confirm signup, forgot password, change email, password changed)

Supabase sends these. Point it at Resend over SMTP:

1. In Resend: **Domains → Add domain**, add the DNS records, wait for "Verified". Then **API Keys → Create**.
2. In Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**
   - Host `smtp.resend.com`, port `465`
   - Username `resend`, password = your Resend API key
   - Sender email `hello@yourdomain.com` (on the verified domain), sender name `Sage`
3. **Authentication → Emails → Templates**: paste the files from `supabase/email-templates/` into the matching
   template (Confirm signup, Reset password, Change email address, Password changed) and set the subject.
   The templates are bilingual: they read `user_metadata.lang`, which the app sets at sign-up and updates whenever the
   user changes language. Subjects are a single string per template in Supabase, so use a neutral one such as
   `Sage — Confirm your email / Confirme ton e-mail`.
4. **Authentication → Rate Limits**: raise the email limit; the built-in Supabase mailer is capped at a handful per hour.
5. **URL Configuration**: Site URL + redirect URLs (see above) so the reset link lands on `/reset-password`.

"Change password" in Settings sends the reset email through this same path.
Users who signed up before this change have no `lang` and get English until they change their language once.

### 2. Reminder / summary emails

Sent by the `send-notifications` function through the Resend HTTP API (see below).

## Notifications

Opt-in, off by default, at most one message per user per day (a Sunday weekly summary replaces the daily reminder).
Channels: **browser push** (Web Push + `public/sw.js`) and **email** (Resend). Users manage them in Settings.

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Frontend `.env`: `VITE_VAPID_PUBLIC_KEY=<public key>`
3. Server secrets:
   ```bash
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@yourdomain.com \
     RESEND_API_KEY=re_... RESEND_FROM="Sage <hello@yourdomain.com>" \
     SITE_URL=https://your-site.example CRON_SECRET=$(openssl rand -hex 32)
   supabase functions deploy send-notifications --no-verify-jwt
   ```
   (`--no-verify-jwt` is also set in `supabase/config.toml`; the function checks the user's JWT for test sends and
   the `x-cron-secret` header for scheduled runs itself.)
4. Schedule it **hourly** (it picks the users whose local time matches their chosen hour). In the SQL editor:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   select cron.schedule('sage-notifications', '0 * * * *', $$
     select net.http_post(
       url     := 'https://<project-ref>.supabase.co/functions/v1/send-notifications',
       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
       body    := '{}'::jsonb);
   $$);
   ```
   Alternatively use any scheduler (GitHub Actions, cron-job.org) that POSTs with the `x-cron-secret` header.
5. Settings → Notifications → **Send a test** to verify both channels.

Notes: push needs HTTPS (or localhost), a user gesture to grant permission, and on iOS the site must be added to the
Home Screen. Dead push subscriptions (404/410) are removed automatically. The service-role key is used inside the
function only (to read preferences and e-mail addresses).

## How the pieces fit

| Area | Where |
|---|---|
| Mascot (moods/actions, reduced-motion aware) | `src/components/mascot/` |
| AI client → Edge Function | `src/lib/ai-stylist.ts` → `supabase/functions/ai-stylist` |
| Data layer (Supabase or demo) | `src/lib/data.ts` |
| XP / streak / achievements (server-verified, idempotent) | `complete_quest()` in the migration |
| Account deletion | `supabase/functions/delete-account` |
| Translations | `src/i18n/` |
| Notifications (UI / push / sender) | `src/hooks/useNotifications.ts`, `public/sw.js`, `supabase/functions/send-notifications` |
| Auth email templates | `supabase/email-templates/` |

## Security notes

- RLS is enabled on every table; clients can only read their own rows. XP, streaks and achievements tables are
  read-only to clients; awards happen only through `complete_quest()`, which verifies the action and uses a
  unique key per user/quest/period.
- `ai-stylist` authenticates the JWT, rate-limits (40 messages/hour/user), validates input and model output, and
  discards wardrobe ids the model invents. Email, exact location, sizes and photos are not sent to the provider.
- The service-role key is only used in `delete-account` and `send-notifications`, server-side.

## Known limits

- Replies are returned whole (no token streaming); a typing indicator covers the wait.
- The mascot art is one flat image: whole-figure motion and overlays only. The face doesn't blink or lip-sync.
  Swap in layered poses or Lottie/Rive inside `Mascot.tsx` when you have them.
- Outfit "images" are palette illustrations, labelled as such. No AI image generation is configured.
- The interface is translated for English and French only; Sage replies in any of the six listed languages.
- Reminder timing is hourly granularity; delivery depends on the scheduler you set up.
- `src/pages/LegalPage.tsx` is a template, so have it reviewed before launch.
