import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { Button, Field, Input, Logo, Notice } from '@/components/ui';
import { FullScreenLoader } from '@/components/layout/Guards';
import { MascotMessage } from '@/components/mascot/MascotMessage';
import { useToast } from '@/hooks/useToast';

export default function ResetPasswordPage() {
  const { user, loading, recovery, updatePassword } = useAuth();
  const { t } = useT();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { toast } = useToast();

  if (loading) return <FullScreenLoader />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError(t('Your password needs at least 8 characters.'));
    if (pw !== pw2) return setError(t('The two passwords do not match.'));
    setBusy(true);
    const err = await updatePassword(pw);
    setBusy(false);
    if (err) return setError(err);
    toast(t('Password updated. You are all set.'), 'success');
    nav('/app', { replace: true });
  };

  return (
    <div className="auth auth--single">
      <main id="main" className="auth__panel">
        <Logo />
        <h1>{t('Choose a new password')}</h1>
        {!recovery && !user ? (
          <>
            <MascotMessage mood="sad" action="sad">{t('Hmm, that link has expired.')}</MascotMessage>
            <Notice title={t('This link is no longer valid')} tone="warn">
              {t('Reset links expire quickly.')} <Link to="/auth">{t('Request a new one')}</Link>.
            </Notice>
          </>
        ) : (
          <form onSubmit={submit} className="stack" noValidate>
            <Field label={t('New password')} htmlFor="pw" hint={t('At least 8 characters.')}>
              <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            </Field>
            <Field label={t('Confirm new password')} htmlFor="pw2">
              <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
            </Field>
            {error && <p className="field__error" role="alert">{t(error)}</p>}
            <Button type="submit" loading={busy} size="lg">{t('Update password')}</Button>
          </form>
        )}
      </main>
    </div>
  );
}
