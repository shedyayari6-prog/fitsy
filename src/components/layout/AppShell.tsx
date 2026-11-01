import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Home, MessageCircle, Sparkles, Shirt, Trophy, User, Settings, Flame, Store, Box, Compass } from 'lucide-react';
import { Logo, DemoBanner } from '@/components/ui';
import { XPBar } from '@/components/gamification/XPBar';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { pageTransition } from '@/lib/animations';
import { Mascot } from '@/components/mascot/Mascot';
import { useT } from '@/i18n';

const NAV: { to: string; label: string; icon: typeof Home; end?: boolean }[] = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/stylist', label: 'Stylist', icon: MessageCircle },
  { to: '/app/outfits', label: 'Outfits', icon: Sparkles },
  { to: '/app/wardrobe', label: 'Wardrobe', icon: Shirt },
  { to: '/app/store', label: 'Fitsy Store', icon: Store },
  { to: '/app/quests', label: 'Quests', icon: Trophy },
];
const SECONDARY: { to: string; label: string; icon: typeof Home; end?: boolean }[] = [
  { to: '/app/glowup', label: 'GlowUp Quest', icon: Compass },
  { to: '/app/avatar', label: 'My 3D Avatar', icon: Box },
  { to: '/app/profile', label: 'Profile', icon: User },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export function AppShell() {
  const { demo } = useAuth();
  const { progress } = useApp();
  const { t } = useT();
  const loc = useLocation();

  return (
    <div className="shell">
      <aside className="sidebar" aria-label={t('Main')}>
        <Logo to="/app" />
        <nav className="sidebar__nav">
          {[...NAV, ...SECONDARY].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `navlink${isActive ? ' navlink--on' : ''}`}>
              <Icon size={20} aria-hidden /> <span>{t(label)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          <Mascot size="sm" mood="happy" decorative />
          {progress && <XPBar progress={progress} compact />}
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <Logo to="/app" />
          <div className="topbar__right">
            {progress && (
              <span className="streak-pill" aria-label={t('{n} day streak, level {level}', { n: progress.current_streak, level: progress.level })}>
                <Flame size={16} aria-hidden /> {progress.current_streak} · Lv {progress.level}
              </span>
            )}
            <Link to="/app/profile" className="icon-btn" aria-label={t('Profile')}><User size={20} /></Link>
            <Link to="/app/settings" className="icon-btn" aria-label={t('Settings')}><Settings size={20} /></Link>
          </div>
        </header>
        {demo && <DemoBanner />}
        <main id="main" className="content">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={loc.pathname} {...pageTransition}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <nav className="bottomnav" aria-label={t('Main')}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `bottomnav__link${isActive ? ' bottomnav__link--on' : ''}`}>
            <Icon size={22} aria-hidden /> <span>{t(label)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}