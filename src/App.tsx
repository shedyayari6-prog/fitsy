import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth, RequireOnboarded } from '@/components/layout/Guards';
import { AppShell } from '@/components/layout/AppShell';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import LegalPage from '@/pages/LegalPage';
import OnboardingPage from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/DashboardPage';
import StylistPage from '@/pages/StylistPage';
import OutfitsPage from '@/pages/OutfitsPage';
import WardrobePage from '@/pages/WardrobePage';
import ChallengesPage from '@/pages/ChallengesPage';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import StorePage from '@/pages/StorePage';
import AvatarPage from '@/pages/AvatarPage';
import GlowUpPage from '@/pages/GlowUpPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { useApp } from '@/hooks/useApp';
import { useT } from '@/i18n';
import { DesignerHelp } from '@/components/layout/DesignerHelp';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/** When a profile loads, its saved language becomes the interface language (works across devices). */
function LangSync() {
  const { profile } = useApp();
  const { setLang } = useT();
  const code = profile?.preferred_language;
  useEffect(() => { if (code) setLang(code); }, [code, setLang]);
  return null;
}

function StandaloneLanguageSwitcher() {
  return <div className="language-switcher__floating"><LanguageSwitcher /></div>;
}

export default function App() {
  const { t } = useT();
  useEffect(() => {
    const hoverSound = new Audio('/hover.mp3');
    const clickSound = new Audio('/matthewvakaliuk73627-mouse-click-290204.mp3');
    const buttonFor = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>('button, a.btn, .chip, [role="button"]') : null;
    const play = (sound: HTMLAudioElement) => {
      sound.currentTime = 0;
      void sound.play().catch(() => undefined);
    };
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const button = buttonFor(event.target);
      if (!button || button.getAttribute('aria-disabled') === 'true' || button === buttonFor(event.relatedTarget)) return;
      play(hoverSound);
    };
    const onClick = (event: MouseEvent) => {
      const button = buttonFor(event.target);
      if (!button || button.getAttribute('aria-disabled') === 'true') return;
      play(clickSound);
    };
    document.addEventListener('pointerover', onPointerOver);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('pointerover', onPointerOver);
      document.removeEventListener('click', onClick);
    };
  }, []);
  return (
    <>
      <a href="#main" className="skip-link">{t('Skip to content')}</a>
      <LangSync />
      <ScrollToTop />
      <StandaloneLanguageSwitcher />
      <DesignerHelp />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />

        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route element={<RequireOnboarded />}>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="stylist" element={<StylistPage />} />
              <Route path="outfits" element={<OutfitsPage />} />
              <Route path="wardrobe" element={<WardrobePage />} />
              <Route path="store" element={<StorePage />} />
              <Route path="avatar" element={<AvatarPage />} />
              <Route path="glowup" element={<GlowUpPage />} />
              <Route path="quests" element={<ChallengesPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}