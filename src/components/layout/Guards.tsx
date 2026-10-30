import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { Mascot } from '@/components/mascot/Mascot';
import { ErrorNotice } from '@/components/ui';
import { useT } from '@/i18n';

export function FullScreenLoader({ text }: { text?: string }) {
  const { t } = useT();
  return (
    <div className="fullscreen" role="status" aria-live="polite">
      <Mascot size="md" action="loading" mood="thinking" decorative />
      <p>{text ?? t('Getting things ready…')}</p>
    </div>
  );
}

/** Requires a session. Unauthenticated users are sent to /auth and returned afterwards. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}

/** Requires a completed profile; otherwise onboarding. */
export function RequireOnboarded() {
  const { profile, loading, error, reload } = useApp();
  const { t } = useT();
  if (error && !profile) {
    return <div className="page-narrow"><ErrorNotice message={error} onRetry={() => void reload()} /></div>;
  }
  if (loading || !profile) return <FullScreenLoader text={t('Loading your profile…')} />;
  if (!profile.onboarding_completed) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
