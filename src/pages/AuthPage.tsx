import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { brand } from '@/config/brand';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { Button, Field, Input, Logo, Notice, SetupNotice } from '@/components/ui';
import { MascotMessage } from '@/components/mascot/MascotMessage';
import { FullScreenLoader } from '@/components/layout/Guards';

type Mode = 'login' | 'signup' | 'forgot';

export default function AuthPage() {
  const { user, loading, configured, signIn, signUp, requestReset, startDemo } = useAuth();
  const { t, lang } = useT();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to={loc.state?.from ?? '/app'} replace />;

  const switchMode = (m: Mode) => { setMode(m); setError(null); setInfo(null); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError(t('Please enter a valid email address.'));
    if (mode !== 'forgot' && password.length < 8) return setError(t('Your password needs at least 8 characters.'));
    setBusy(true);
    try {
      if (mode === 'login') {
        const err = await signIn(email.trim(), password);
        if (err) setError(err); else nav(loc.state?.from ?? '/app', { replace: true });
      } else if (mode === 'signup') {
        const r = await signUp(email.trim(), password, lang);
        if (r.error) setError(r.error);
        else if (r.needsVerification) setInfo(t('Almost there! We sent a confirmation link to your email. Open it to finish creating your account.'));
        else nav('/onboarding', { replace: true });
      } else {
        const err = await requestReset(email.trim());
        if (err) setError(err); else setInfo(t('If an account exists for that email, a reset link is on its way.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? t('Welcome back') : mode === 'signup' ? t('Create your account') : t('Reset your password');

  return (
    <div className="auth">
      <div className="auth__side">
        <Logo />
        <MascotMessage mood="happy" action={mode === 'forgot' ? 'thinking' : 'greeting'} messageKey={`${mode}-${lang}`}>
          {mode === 'signup' ? t("Hi! I'm {name}. Let's find your style together.", { name: brand.mascotName })
            : mode === 'login' ? t("Good to see you again. Ready for today's look?")
            : t("No worries, it happens to everyone. Let's get you back in.")}
        </MascotMessage>
      </div>

      <main id="main" className="auth__panel">
        <h1>{title}</h1>

        {!configured && (
          <div className="stack">
            <SetupNotice what={t("Supabase isn't configured yet")} steps={[
              t('Copy .env.example to .env and add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
              t('Restart the dev server.'),
            ]} />
            <Notice title={t('Want to look around first?')}>
              {t('Demo mode stores everything locally in this browser only: no account, no backend, no AI.')}
            </Notice>
            <Button variant="clay" onClick={() => { startDemo(); nav('/onboarding'); }}>{t('Continue in demo mode')}</Button>
          </div>
        )}

        {configured && (
          <form onSubmit={submit} className="stack" noValidate>
            <Field label={t('Email')} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            {mode !== 'forgot' && (
              <Field label={t('Password')} htmlFor="password" hint={mode === 'signup' ? t('At least 8 characters.') : undefined}>
                <Input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </Field>
            )}
            {error && <p className="field__error" role="alert">{t(error)}</p>}
            {info && <p className="notice" role="status"><Mail size={18} aria-hidden /> {info}</p>}
            <Button type="submit" loading={busy} size="lg">
              {mode === 'login' ? t('Sign in') : mode === 'signup' ? t('Create account') : t('Send reset link')}
            </Button>

            <div className="auth__alt">
              {mode === 'login' && <>
                <button type="button" className="link-btn" onClick={() => switchMode('forgot')}>{t('Forgot password?')}</button>
                <span>{t('New here?')} <button type="button" className="link-btn" onClick={() => switchMode('signup')}>{t('Create an account')}</button></span>
              </>}
              {mode === 'signup' && <span>{t('Already have an account?')} <button type="button" className="link-btn" onClick={() => switchMode('login')}>{t('Sign in')}</button></span>}
              {mode === 'forgot' && <button type="button" className="link-btn" onClick={() => switchMode('login')}>{t('Back to sign in')}</button>}
            </div>
          </form>
        )}
        <p className="muted small">{t('By continuing you agree to the')} <Link to="/terms">{t('Terms')}</Link> {t('and')} <Link to="/privacy">{t('Privacy Policy')}</Link>.</p>
      </main>
    </div>
  );
}
