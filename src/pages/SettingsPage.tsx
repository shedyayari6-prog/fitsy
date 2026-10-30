import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Download, LogOut, Mail, Trash2 } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/useToast';
import { useNotifications } from '@/hooks/useNotifications';
import { useT, UI_LANGUAGES } from '@/i18n';
import { Button, Field, Input, Modal, Notice, Select } from '@/components/ui';
import { Mascot } from '@/components/mascot/Mascot';
import { LANGUAGES } from '@/config/options';
import { deleteAccount, exportMyData } from '@/lib/data';
import { speechSupport } from '@/lib/voice';
import { cn, errMessage } from '@/lib/util';

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn('toggle', disabled && 'toggle--disabled')}>
      <span><strong>{label}</strong>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden />
    </label>
  );
}

export default function SettingsPage() {
  const { profile, saveProfile } = useApp();
  const { user, signOut, requestReset, demo } = useAuth();
  const { toast } = useToast();
  const { t, setLang } = useT();
  const nav = useNavigate();
  const [settings, update] = useSettings();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [confirm, setConfirm] = useState('');
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const notif = useNotifications(user?.id ?? '', !!user && !demo);

  if (!profile || !user) return null;

  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    try { await fn(); if (ok) toast(ok, 'success'); }
    catch (e) { toast(errMessage(e), 'error'); }
    finally { setBusy(null); }
  };

  const download = () => run('export', async () => {
    const data = await exportMyData(user.id);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'sage-my-data.json'; a.click();
    URL.revokeObjectURL(url);
  }, t('Your data was downloaded.'));

  const remove = () => run('delete', async () => {
    await deleteAccount(user.id);
    nav('/', { replace: true });
    if (demo) window.location.reload();
  });

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const anyReminder = notif.prefs.daily_reminder || notif.prefs.weekly_summary;
  const needsChannel = anyReminder && !notif.prefs.push_enabled && !notif.prefs.email_enabled;

  const setPref = (patch: Parameters<typeof notif.update>[0]) =>
    void run('notif', async () => { await notif.update(patch); });

  const togglePush = (on: boolean) => void run('push', async () => {
    if (on) { await notif.enablePush(); } else { await notif.disablePush(); }
  }, on ? t('Browser notifications are on.') : t('Browser notifications are off.'));

  const sendTest = () => void run('test', async () => {
    const r = await notif.test();
    if (r.push === 0 && !r.email) throw new Error(t('Nothing was sent. Turn on browser notifications or email first.'));
    toast(t('Test sent: {push} browser, {email} email.', { push: r.push, email: r.email ? 1 : 0 }), 'success');
  });

  return (
    <div className="page">
      <header className="page__head"><h1>{t('Settings')}</h1></header>

      <section className="card stack" aria-labelledby="s-prof">
        <h2 id="s-prof" className="card__title">{t('Profile')}</h2>
        <Field label={t('Name or nickname')} htmlFor="s-name"><Input id="s-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('Language')} htmlFor="s-lang"
          hint={UI_LANGUAGES.includes(profile.preferred_language)
            ? t("The whole app and Sage's replies use this language.")
            : t("Sage's replies will use this language. The app interface is available in English and Français for now.")}>
          <Select id="s-lang" value={profile.preferred_language}
            onChange={(e) => { const code = e.target.value; setLang(code); void run('lang', async () => { await saveProfile({ preferred_language: code }); }, t('Language updated.')); }}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </Select>
        </Field>
        <div className="row-end"><Button variant="soft" loading={busy === 'name'} disabled={name.trim() === (profile.display_name ?? '')}
          onClick={() => void run('name', async () => { await saveProfile({ display_name: name.trim() || null }); }, t('Name updated.'))}>{t('Save name')}</Button></div>
        <p className="muted small">{t('Style, colour, budget and location answers live on your')} <Link to="/app/profile">{t('Profile')}</Link>.</p>
      </section>

      <section className="card stack" aria-labelledby="s-voice">
        <h2 id="s-voice" className="card__title">{t('Voice')}</h2>
        {!speechSupport.recognition && !speechSupport.synthesis && <Notice title={t("Voice isn't supported in this browser")}>{t('Typing works everywhere. Try a recent Chrome, Edge or Safari for voice.')}</Notice>}
        <Toggle checked={settings.voiceReplies} onChange={(v) => update({ voiceReplies: v })} disabled={!speechSupport.synthesis}
          label={t("Speak Sage's replies")} hint={speechSupport.synthesis ? t("Uses your browser's built-in voice.") : t('Not supported in this browser.')} />
        <Field label={t('Speaking speed: {rate}×', { rate: settings.voiceRate.toFixed(1) })} htmlFor="s-rate">
          <input id="s-rate" type="range" min={0.7} max={1.4} step={0.1} value={settings.voiceRate} disabled={!speechSupport.synthesis}
            onChange={(e) => update({ voiceRate: Number(e.target.value) })} />
        </Field>
        <p className="muted small">{t('The microphone is only used while you press the mic button in the chat, and your browser asks permission first.')}</p>
      </section>

      <section className="card stack" aria-labelledby="s-notif">
        <h2 id="s-notif" className="card__title"><BellRing size={18} aria-hidden /> {t('Notifications')}</h2>
        {demo ? (
          <Notice title={t('Needs Supabase')} tone="warn">{t('Notifications are not available in demo mode.')}</Notice>
        ) : (
          <>
            <p className="muted">{t('Gentle, optional nudges. Off by default, one per day at most, and you can switch them off any time.')}</p>

            <Toggle checked={notif.prefs.daily_reminder} disabled={notif.loading || notif.busy === 'save'}
              label={t('Daily style reminder')} hint={t('A friendly prompt to ask Sage what to wear.')}
              onChange={(v) => setPref({ daily_reminder: v })} />
            <Toggle checked={notif.prefs.weekly_summary} disabled={notif.loading || notif.busy === 'save'}
              label={t('Weekly progress summary')} hint={t('A short recap every Sunday.')}
              onChange={(v) => setPref({ weekly_summary: v })} />

            <Field label={t('Send at')} htmlFor="s-hour" hint={t('Your local time ({tz}).', { tz: notif.prefs.timezone })}>
              <Select id="s-hour" value={notif.prefs.reminder_hour} disabled={notif.loading || !anyReminder}
                onChange={(e) => setPref({ reminder_hour: Number(e.target.value), timezone: notif.prefs.timezone })}>
                {hours.map((h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
              </Select>
            </Field>

            <h3 className="h3">{t('How should we reach you?')}</h3>
            <Toggle checked={notif.prefs.push_enabled && notif.browserSubscribed}
              disabled={!notif.pushSupported || !notif.pushConfigured || notif.busy === 'push'}
              label={t('Browser notifications')}
              hint={!notif.pushSupported ? t("This browser doesn't support push notifications.")
                : !notif.pushConfigured ? t('Not set up yet: add VITE_VAPID_PUBLIC_KEY (see the README).')
                : notif.permission === 'denied' ? t('Blocked in your browser settings. Allow notifications for this site, then try again.')
                : t('Works on this device while the browser is installed and allowed.')}
              onChange={togglePush} />
            <Toggle checked={notif.prefs.email_enabled} disabled={notif.loading || notif.busy === 'save'}
              label={t('Email')} hint={user.email ? t('Sent to {email} through Resend.', { email: user.email }) : undefined}
              onChange={(v) => setPref({ email_enabled: v })} />

            {needsChannel && <Notice title={t('Pick a channel')} tone="warn">{t('Turn on browser notifications or email so reminders have somewhere to go.')}</Notice>}

            <div className="row">
              <Button variant="soft" size="sm" icon={<BellRing size={16} />} loading={notif.busy === 'test'}
                disabled={!notif.prefs.push_enabled && !notif.prefs.email_enabled} onClick={sendTest}>{t('Send a test')}</Button>
              <span className="muted small"><Mail size={14} aria-hidden style={{ verticalAlign: '-2px' }} /> {t('Scheduled sending needs the send-notifications function and a cron job (see the README).')}</span>
            </div>
          </>
        )}
      </section>

      <section className="card stack" aria-labelledby="s-priv">
        <h2 id="s-priv" className="card__title">{t('Privacy')}</h2>
        <Toggle checked={profile.ai_share_wardrobe} label={t('Let Sage see my wardrobe items')}
          hint={t('Names, categories and colours are sent to the AI provider to build outfits. Photos never are.')}
          onChange={(v) => void run('share', async () => { await saveProfile({ ai_share_wardrobe: v }); }, v ? t('Sage can use your wardrobe.') : t('Sage will no longer see your wardrobe.'))} />
        <div className="row">
          <Button variant="soft" icon={<Download size={16} />} loading={busy === 'export'} onClick={() => void download()}>{t('Download my data')}</Button>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDelOpen(true)}>{t('Delete my account')}</Button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="s-acct">
        <h2 id="s-acct" className="card__title">{t('Account')}</h2>
        <p className="muted">{demo ? t('Demo mode: no account, data stays in this browser.') : <>{t('Signed in as')} <strong>{user.email}</strong></>}</p>
        <div className="row">
          {!demo && user.email && <Button variant="soft" loading={busy === 'pw'}
            onClick={() => void run('pw', async () => { const e = await requestReset(user.email!); if (e) throw new Error(e); }, t('Password reset email sent.'))}>{t('Change password')}</Button>}
          <Button variant="ghost" icon={<LogOut size={16} />} onClick={() => void signOut().then(() => nav('/', { replace: true }))}>{t('Sign out')}</Button>
        </div>
      </section>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title={t('Delete your account?')}>
        <div className="center"><Mascot size="sm" action="crying" mood="sad" decorative still /></div>
        <p>{t("We'll be sad to see you go. This permanently removes your profile, wardrobe, photos, conversations, saved outfits and progress. It cannot be undone.")}</p>
        <Field label={t('Type DELETE to confirm')} htmlFor="del-confirm">
          <Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
        <div className="row-end">
          <Button variant="ghost" onClick={() => setDelOpen(false)}>{t('Cancel')}</Button>
          <Button variant="danger" disabled={confirm !== 'DELETE'} loading={busy === 'delete'} onClick={() => void remove()}>{t('Delete everything')}</Button>
        </div>
      </Modal>
    </div>
  );
}
