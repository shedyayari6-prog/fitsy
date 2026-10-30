import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Award, Flame, Footprints, Heart, MessageCircle, Shirt, Sparkles, Trophy, type LucideIcon } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { CardSkeleton, ErrorNotice, ProgressBar } from '@/components/ui';
import { QuestRow } from '@/components/gamification/QuestRow';
import { XPBar } from '@/components/gamification/XPBar';
import { MascotMessage } from '@/components/mascot/MascotMessage';
import { listAchievements, listCompletions, listQuests } from '@/lib/data';
import { cn, errMessage, todayUTC } from '@/lib/util';
import { fadeUp, stagger } from '@/lib/animations';
import type { Achievement, EarnedAchievement, Quest, QuestCompletion } from '@/types';

const ICONS: Record<string, LucideIcon> = {
  footprints: Footprints, heart: Heart, shirt: Shirt, 'message-circle': MessageCircle, flame: Flame, trophy: Trophy, sparkles: Sparkles,
};
const WHERE: Record<string, { to: string; hint: string }> = {
  complete_profile: { to: '/app/profile', hint: 'Finish your profile first.' },
  ask_stylist: { to: '/app/stylist', hint: 'Send Sage a message today, then come back and check.' },
  outfit_suggested: { to: '/app/stylist', hint: 'Ask Sage for an outfit today.' },
  save_outfit: { to: '/app/stylist', hint: 'Save an outfit today (from a chat).' },
  wardrobe_3: { to: '/app/wardrobe', hint: 'Add three pieces to your wardrobe.' },
  wardrobe_outfit: { to: '/app/stylist', hint: 'Save an outfit that uses your wardrobe items.' },
};

export default function ChallengesPage() {
  const { user } = useAuth();
  const { progress, tryComplete } = useApp();
  const { toast } = useToast();
  const { t } = useT();
  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [completions, setCompletions] = useState<QuestCompletion[]>([]);
  const [ach, setAch] = useState<{ all: Achievement[]; earned: EarnedAchievement[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const uid = user!.id;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [q, c, a] = await Promise.all([listQuests(uid), listCompletions(uid), listAchievements(uid)]);
      setQuests(q); setCompletions(c); setAch(a);
    } catch (e) { setError(errMessage(e, t('Could not load quests.'))); }
  }, [uid, t]);
  useEffect(() => { void load(); }, [load]);

  const today = todayUTC();
  const done = useMemo(() => {
    const s = new Set<string>();
    completions.forEach((c) => { if (c.period_key === 'once' || c.period_key === today) s.add(c.quest_id); });
    return s;
  }, [completions, today]);

  const weekDays = useMemo(() => {
    const cutoff = Date.now() - 6 * 86_400_000;
    return new Set(completions.filter((c) => new Date(c.completion_date).getTime() >= cutoff - 86_400_000).map((c) => c.completion_date)).size;
  }, [completions]);

  const check = async (q: Quest) => {
    setBusy(q.slug);
    const r = await tryComplete(q.slug);
    if (r && !r.awarded) {
      if (r.reason === 'requirements_not_met') toast(t(WHERE[q.slug]?.hint ?? 'Not quite yet. Complete the action first.'), 'info');
      if (r.reason === 'already_completed') toast(t('Already completed. Nice!'), 'info');
    }
    await load();
    setBusy(null);
  };

  const earnedIds = new Set(ach?.earned.map((e) => e.achievement_id));
  const remaining = quests?.filter((q) => !done.has(q.id)).length ?? 0;
  const allDone = !!quests && remaining === 0;

  return (
    <div className="page">
      <header className="page__head"><h1>{t('Quests')}</h1><p className="muted">{t('Small actions, real progress. XP is only awarded after the app verifies you did the thing.')}</p></header>

      {error && <ErrorNotice message={error} onRetry={() => void load()} />}

      <motion.div className="dash__grid" variants={stagger(0.08)} initial="hidden" animate="show">
        <motion.section variants={fadeUp} className="card card--sage">
          <h2 className="card__title">{t('Level & streak')}</h2>
          {progress ? <XPBar progress={progress} /> : <CardSkeleton lines={2} />}
        </motion.section>

        <motion.section variants={fadeUp} className="card">
          <h2 className="card__title">{t('Weekly goal')}</h2>
          <p>{t('Be active on 3 different days this week.')}</p>
          <div className="row-between small"><span>{t('{n} of 3 days', { n: Math.min(weekDays, 3) })}</span></div>
          <ProgressBar value={Math.min(weekDays, 3)} max={3} label={t('Weekly goal progress')} tone="clay" />
          <p className="muted small">{t('Optional, and with no penalty. Skipping a day never removes XP.')}</p>
        </motion.section>
      </motion.div>

      <MascotMessage mood={allDone ? 'excited' : 'encouraging'} action={allDone ? 'victory' : (progress?.current_streak ?? 0) >= 2 ? 'streak' : 'idle'}>
        {!quests ? t('Loading your quests…') : allDone ? t("All done for today. You're on a roll!")
          : remaining === 1 ? t('1 quest left. Tap “Check” after you\'ve done one.') : t('{n} quests left. Tap “Check” after you\'ve done one.', { n: remaining })}
      </MascotMessage>

      <section className="card" aria-labelledby="ql">
        <h2 id="ql" className="card__title">{t("Today's quests")}</h2>
        {!quests ? <CardSkeleton lines={4} /> : (
          <ul className="quests">
            {quests.map((q) => (
              <QuestRow key={q.id} quest={q} done={done.has(q.id)} busy={busy === q.slug}
                goTo={WHERE[q.slug]?.to} onCheck={() => void check(q)} />
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="al">
        <h2 id="al" className="card__title"><Award size={18} aria-hidden /> {t('Achievements')}</h2>
        {!ach ? <CardSkeleton lines={3} /> : (
          <ul className="achievements">
            {ach.all.map((a) => {
              const got = earnedIds.has(a.id);
              const Icon = ICONS[a.icon] ?? Trophy;
              return (
                <li key={a.id} className={cn('achievement', got && 'achievement--on')}>
                  <span className="achievement__icon"><Icon size={22} aria-hidden /></span>
                  <strong>{t(a.name)}</strong>
                  <span className="small">{t(a.description)}</span>
                  <span className="tag">{got ? t('Earned') : t('Locked')}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
