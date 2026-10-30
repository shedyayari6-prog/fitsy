// Supabase Edge Function: send-auth-email  (Auth "Send Email" hook)
//
// Supabase Auth calls this function instead of its own mailer whenever it needs to send an auth email
// (confirm signup, reset password, change email, magic link, invite, reauthentication).
// The email is sent through the Resend HTTP API, in French or English depending on user_metadata.lang.
// No SMTP settings are needed.
//
// Secrets:
//   RESEND_API_KEY          Resend API key (account whose domain is verified)
//   AUTH_EMAIL_FROM         e.g. "Fitsy <hello@yourdomain.com>"   (falls back to RESEND_FROM)
//   SEND_EMAIL_HOOK_SECRET  the "v1,whsec_..." secret Supabase shows when you create the hook
// Enable: Dashboard → Authentication → Hooks → Send Email → Supabase Edge Function → send-auth-email.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('AUTH_EMAIL_FROM') ?? Deno.env.get('RESEND_FROM') ?? '';
const HOOK_SECRET = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/$/, '');

interface HookPayload {
  user: { id: string; email: string; new_email?: string; user_metadata?: Record<string, unknown> };
  email_data: {
    token: string; token_hash: string; token_new?: string; token_hash_new?: string;
    redirect_to: string; site_url: string; email_action_type: string;
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

interface Copy { subject: string; title: string; body: string; cta?: string; note: string }
const T: Record<string, Record<string, Copy>> = {
  en: {
    signup: { subject: 'Confirm your email', title: 'Welcome to Fitsy', body: 'Thanks for signing up. Confirm your email to finish creating your account.', cta: 'Confirm my email', note: 'If you did not create an account, you can ignore this email.' },
    invite: { subject: 'You have been invited', title: 'You have been invited', body: 'Accept the invitation to create your account.', cta: 'Accept invitation', note: 'If you were not expecting this, ignore this email.' },
    magiclink: { subject: 'Your sign-in link', title: 'Sign in', body: 'Use the button below to sign in. The link works once.', cta: 'Sign in', note: 'If you did not ask for this, ignore this email.' },
    recovery: { subject: 'Reset your password', title: 'Reset your password', body: 'We received a request to reset your password. The link works once and expires quickly.', cta: 'Choose a new password', note: 'If you did not ask for this, ignore this email: your password stays the same.' },
    email_change: { subject: 'Confirm your new email', title: 'Confirm your new email', body: 'Confirm this address to finish changing the email on your account.', cta: 'Confirm new email', note: 'If you did not request this change, secure your account and ignore this email.' },
    reauthentication: { subject: 'Your confirmation code', title: 'Your confirmation code', body: 'Enter this code to confirm it is you:', note: 'If you did not request this, ignore this email.' },
  },
  fr: {
    signup: { subject: 'Confirme ton e-mail', title: 'Bienvenue sur Fitsy', body: 'Merci de ton inscription. Confirme ton adresse e-mail pour terminer la création de ton compte.', cta: 'Confirmer mon e-mail', note: 'Si tu n’as pas créé de compte, tu peux ignorer cet e-mail.' },
    invite: { subject: 'Tu as été invité(e)', title: 'Tu as été invité(e)', body: 'Accepte l’invitation pour créer ton compte.', cta: 'Accepter l’invitation', note: 'Si tu ne t’y attendais pas, ignore cet e-mail.' },
    magiclink: { subject: 'Ton lien de connexion', title: 'Connexion', body: 'Utilise le bouton ci-dessous pour te connecter. Le lien ne fonctionne qu’une fois.', cta: 'Me connecter', note: 'Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.' },
    recovery: { subject: 'Réinitialise ton mot de passe', title: 'Réinitialise ton mot de passe', body: 'Nous avons reçu une demande de réinitialisation de ton mot de passe. Le lien ne fonctionne qu’une fois et expire vite.', cta: 'Choisir un nouveau mot de passe', note: 'Si tu n’es pas à l’origine de cette demande, ignore cet e-mail : ton mot de passe reste inchangé.' },
    email_change: { subject: 'Confirme ta nouvelle adresse e-mail', title: 'Confirme ta nouvelle adresse e-mail', body: 'Confirme cette adresse pour terminer le changement d’e-mail de ton compte.', cta: 'Confirmer la nouvelle adresse', note: 'Si tu n’as pas demandé ce changement, sécurise ton compte et ignore cet e-mail.' },
    reauthentication: { subject: 'Ton code de confirmation', title: 'Ton code de confirmation', body: 'Saisis ce code pour confirmer que c’est bien toi :', note: 'Si tu n’es pas à l’origine de cette demande, ignore cet e-mail.' },
  },
};
const UI = { en: { fallback: 'If the button does not work, copy this link into your browser:' }, fr: { fallback: 'Si le bouton ne fonctionne pas, copie ce lien dans ton navigateur :' } };

function html(lang: string, c: Copy, url: string | null, code: string | null): string {
  const ui = UI[lang as 'en' | 'fr'] ?? UI.en;
  return `<!doctype html><html lang="${esc(lang)}"><body style="margin:0;background:#F7F4ED;font-family:Helvetica,Arial,sans-serif;color:#344E41">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;border:1px solid #E6E0D2">
<tr><td style="padding:28px 28px 4px;font-size:24px;font-weight:700">Fitsy</td></tr>
<tr><td style="padding:0 28px"><div style="height:4px;width:48px;background:#A3B18A;border-radius:4px"></div></td></tr>
<tr><td style="padding:20px 28px 0;font-size:20px;font-weight:700">${esc(c.title)}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.6">${esc(c.body)}</td></tr>
${code ? `<tr><td style="padding:16px 28px 8px;font-size:28px;font-weight:700;letter-spacing:6px">${esc(code)}</td></tr>` : ''}
${url && c.cta ? `<tr><td style="padding:24px 28px 8px"><a href="${esc(url)}" style="display:inline-block;background:#344E41;color:#F7F4ED;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:700;font-size:15px">${esc(c.cta)}</a></td></tr>
<tr><td style="padding:8px 28px 20px;font-size:12px;line-height:1.5;color:#6B7A6F;word-break:break-all">${esc(ui.fallback)}<br><a href="${esc(url)}" style="color:#C78665">${esc(url)}</a></td></tr>` : ''}
<tr><td style="padding:16px 28px;border-top:1px solid #E6E0D2;font-size:12px;line-height:1.5;color:#6B7A6F">${esc(c.note)}</td></tr>
</table></td></tr></table></body></html>`;
}

function link(tokenHash: string, type: string, redirectTo: string): string {
  const q = new URLSearchParams({ token: tokenHash, type, redirect_to: redirectTo });
  return `${SUPABASE_URL}/auth/v1/verify?${q.toString()}`;
}

async function send(to: string, subject: string, htmlBody: string, text: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html: htmlBody, text }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

const fail = (message: string, status = 500) =>
  new Response(JSON.stringify({ error: { http_code: status, message } }), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!RESEND_KEY || !FROM || !HOOK_SECRET) return fail('Auth email hook is not configured (RESEND_API_KEY, AUTH_EMAIL_FROM, SEND_EMAIL_HOOK_SECRET).');

  const raw = await req.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(HOOK_SECRET).verify(raw, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return fail('Invalid signature.', 401);
  }

  const { user, email_data: d } = payload;
  const lang = typeof user.user_metadata?.lang === 'string' && T[user.user_metadata.lang as string] ? (user.user_metadata.lang as string) : 'en';
  const type = d.email_action_type;
  const copy = T[lang][type] ?? T[lang].magiclink;
  const redirect = d.redirect_to || d.site_url;

  try {
    if (type === 'reauthentication') {
      await send(user.email, copy.subject, html(lang, copy, null, d.token), `${copy.body} ${d.token}`);
    } else if (type === 'email_change') {
      // Secure email change sends one message to the old address and one to the new address.
      const jobs: Promise<void>[] = [];
      if (user.new_email) {
        const url = link(d.token_hash_new ?? d.token_hash, type, redirect);
        jobs.push(send(user.new_email, copy.subject, html(lang, copy, url, null), `${copy.body}\n${url}`));
        if (d.token_hash_new) {
          const url2 = link(d.token_hash, type, redirect);
          jobs.push(send(user.email, copy.subject, html(lang, copy, url2, null), `${copy.body}\n${url2}`));
        }
      } else {
        const url = link(d.token_hash, type, redirect);
        jobs.push(send(user.email, copy.subject, html(lang, copy, url, null), `${copy.body}\n${url}`));
      }
      await Promise.all(jobs);
    } else {
      const url = link(d.token_hash, type, redirect);
      await send(user.email, copy.subject, html(lang, copy, url, null), `${copy.body}\n${url}`);
    }
  } catch (e) {
    console.error('send-auth-email failed', e instanceof Error ? e.message : e);
    return fail('Could not send the email.');
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
});