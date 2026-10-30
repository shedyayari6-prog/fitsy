import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CloudSun, Lightbulb, Send, Shirt, Sparkles, Target, UserRound } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { useWeather } from '@/hooks/useWeather';
import { useT } from '@/i18n';
import { CardSkeleton, EmptyState, ErrorNotice, Input, LinkButton, Button, ProgressBar } from '@/components/ui';
import { MascotStage } from '@/components/mascot/MascotStage';
import { PoseLoop } from '@/components/mascot/PoseLoop';
import { OutfitCard, OutfitVisual } from '@/components/outfit/OutfitCard';
import { XPBar } from '@/components/gamification/XPBar';
import { QuestRow } from '@/components/gamification/QuestRow';
import { DAILY_TIPS, CATEGORY_OPTIONS } from '@/config/options';
import { listCompletions, listQuests, listSavedOutfits, listWardrobe } from '@/lib/data';
import { layeringGuide } from '@/lib/weather';
import { dayOfYear, errMessage, greetingFor, todayUTC } from '@/lib/util';
import { fadeUp, stagger } from '@/lib/animations';
import type { MascotState, Quest, QuestCompletion, SavedOutfit, WardrobeItem } from '@/types';

interface Data { wardrobe: WardrobeItem[]; saved: SavedOutfit[]; quests: Quest[]; completions: QuestCompletion[] }

export default function DashboardPage() {
  const { profile, progress, tryComplete } = useApp();
  const { user } = useAuth();
  const { t, lang } = useT();
  const { weather, status: weatherStatus } = useWeather(profile);
  const nav = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const uid = user!.id;

  const load = useCallback(async () => {
    setError(null);
    try {
      const [wardrobe, saved, quests, completions] = await Promise.all([
        listWardrobe(uid), listSavedOutfits(uid), listQuests(uid), listCompletions(uid),
      ]);
      setData({ wardrobe, saved, quests, completions });
    } catch (e) { setError(errMessage(e, t('Could not load your dashboard.'))); }
  }, [uid, t]);
  useEffect(() => { void load(); }, [load]);

  const tip = DAILY_TIPS[dayOfYear() % DAILY_TIPS.length];
  const today = todayUTC();
  const doneSet = useMemo(() => {
    const s = new Set<string>();
    data?.completions.forEach((c) => { if (c.period_key === 'once' || c.period_key === today) s.add(c.quest_id); });
    return s;
  }, [data, today]);

  const openQuests = data?.quests.filter((q) => !doneSet.has(q.id)).slice(0, 3) ?? [];
  const wardrobeCount = data?.wardrobe.length ?? 0;
  const savedCount = data?.saved.length ?? 0;
  const latest = data?.saved[0]?.outfit.outfit_data;
  const streak = progress?.current_streak ?? 0;

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    data?.wardrobe.forEach((i) => m.set(i.category, (m.get(i.category) ?? 0) + 1));
    return CATEGORY_OPTIONS.map((c) => ({ ...c, n: m.get(c.value) ?? 0 })).filter((c) => c.n > 0);
  }, [data]);
  const maxCat = Math.max(1, ...byCategory.map((c) => c.n));

  const name = profile?.display_name ?? '';
  const mascotLine =
    !data ? t('Let me take a look at your day…') :
    wardrobeCount === 0 ? t('Your wardrobe is empty. Add a few pieces and I can style what you already own.') :
    savedCount === 0 ? t('Ask me for a look and save your first outfit. It only takes a moment!') :
    streak >= 2 ? t('{n}-day streak. Lovely consistency!', { n: streak }) :
    t('Ready when you are. What are we dressing for?');
  const mascotAction: MascotState = streak >= 2 && data ? 'streak' : savedCount === 0 && data ? 'encouraging' : 'greeting';

  const submitAsk = (e: FormEvent) => {
    e.preventDefault();
    nav('/app/stylist', { state: { prompt: ask.trim() } });
  };

  const goals = [
    { label: t('Add 5 pieces to your wardrobe'), value: Math.min(wardrobeCount, 5), max: 5 },
    { label: t('Save 3 outfits you love'), value: Math.min(savedCount, 3), max: 3 },
    { label: t('Reach level 3'), value: Math.min(progress?.level ?? 1, 3), max: 3 },
  ];

  return (
    <motion.div className="dash" variants={stagger(0.08)} initial="hidden" animate="show">
      <motion.section variants={fadeUp} className="dash__hero card card--sage">
        <div>
          <p className="eyebrow">{t(greetingFor())}</p>
          <h1>{name ? t("{name}, let's find today's look.", { name }) : t("Let's find today's look.")}</h1>
          <form className="inline-form" onSubmit={submitAsk}>
            <label className="sr-only" htmlFor="quick-ask">{t('Ask your stylist')}</label>
            <Input id="quick-ask" value={ask} maxLength={300} onChange={(e) => setAsk(e.target.value)}
              placeholder={t('What should I wear to…')} />
            <Button type="submit" icon={<Send size={16} />}>{t('Ask Sage')}</Button>
          </form>
        </div>
        <MascotStage size="md" mood="happy" action={mascotAction} waveOnClick bubbleKey={`${mascotLine}-${lang}`} bubble={mascotLine} />
      </motion.section>

      {error && <ErrorNotice message={error} onRetry={() => void load()} />}

      <div className="dash__grid">
        <motion.section variants={fadeUp} className="card" aria-labelledby="tip-h">
          <h2 id="tip-h" className="card__title"><Lightbulb size={18} aria-hidden /> {t("Today's style tip")}</h2>
          <h3>{t(tip.title)}</h3>
          <p>{t(tip.body)}</p>
          <Button size="sm" variant="soft" onClick={() => void tryComplete('learn_tip')}>{t('I learned this (+XP)')}</Button>
        </motion.section>

        <motion.section variants={fadeUp} className="card" aria-labelledby="wx-h">
          <h2 id="wx-h" className="card__title"><CloudSun size={18} aria-hidden /> {t('Weather & layers')}</h2>
          {weatherStatus === 'ready' && weather ? (
            <>
              <p><strong>{Math.round(weather.tempC)}°C</strong>, {t(weather.summary)} — {weather.city} <span className="muted small">({t('current')})</span></p>
              <p className="muted small">{t("Today's forecast: {min}–{max}°C, rain chance {rain}%.", { min: Math.round(weather.minC), max: Math.round(weather.maxC), rain: Math.round(weather.rainChance) })}</p>
              <p>{layeringGuide(weather, t)}</p>
              <p className="muted small">{t('A general layering guide from the numbers, not an AI recommendation.')}</p>
            </>
          ) : weatherStatus === 'loading' ? <CardSkeleton lines={2} /> :
            weatherStatus === 'error' ? <p className="muted">{t('Weather is unavailable right now. Your styling still works without it.')}</p> : (
            <>
              <p className="muted">{t("Add a city in your profile and I'll factor the weather into outfit ideas. Totally optional.")}</p>
              <LinkButton to="/app/profile" size="sm" variant="soft">{t('Set a city')}</LinkButton>
            </>
          )}
        </motion.section>

        <motion.section variants={fadeUp} className="card dash__ootd" aria-labelledby="ootd-h">
          <h2 id="ootd-h" className="card__title"><Sparkles size={18} aria-hidden /> {t('Outfit of the day')}</h2>
          <PoseLoop size={140} />
          {!data ? <CardSkeleton /> : latest ? (
            <>
              <p className="muted small">{t('Your most recently saved look:')}</p>
              <OutfitCard outfit={latest} compact saved onAsk={() => nav('/app/stylist', { state: { prompt: t('How can I restyle "{name}" for today?', { name: latest.name }) } })} />
            </>
          ) : (
            <div className="ootd-empty">
              <h3>{t('No look picked yet')}</h3>
              <p className="muted">{t("Ask Sage for today's outfit, then save the one you like.")}</p>
              <LinkButton to="/app/stylist" icon={<ArrowRight size={16} />}>{t("Ask for today's outfit")}</LinkButton>
            </div>
          )}
        </motion.section>

        <motion.section variants={fadeUp} className="card" aria-labelledby="xp-h">
          <h2 id="xp-h" className="card__title">{t('Your progress')}</h2>
          {progress ? <XPBar progress={progress} /> : <CardSkeleton lines={2} />}
        </motion.section>

        <motion.section variants={fadeUp} className="card" aria-labelledby="q-h">
          <h2 id="q-h" className="card__title"><Target size={18} aria-hidden /> {t('Daily quests')}</h2>
          {!data ? <CardSkeleton /> : openQuests.length === 0 ? (
            <p className="muted">{t('All caught up. See you tomorrow!')}</p>
          ) : <ul className="quests">{openQuests.map((q) => <QuestRow key={q.id} quest={q} done={false} />)}</ul>}
          <Link to="/app/quests" className="link-btn">{t('All quests →')}</Link>
        </motion.section>

        <motion.section variants={fadeUp} className="card" aria-labelledby="g-h">
          <h2 id="g-h" className="card__title">{t('Style goals')}</h2>
          <div className="stack-sm">
            {goals.map((g) => (
              <div key={g.label}>
                <div className="row-between small"><span>{g.label}</span><span>{g.value}/{g.max}</span></div>
                <ProgressBar value={g.value} max={g.max} label={g.label} tone="sage" />
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="card" aria-labelledby="w-h">
          <h2 id="w-h" className="card__title"><Shirt size={18} aria-hidden /> {t('Wardrobe overview')}</h2>
          {!data ? <CardSkeleton /> : wardrobeCount === 0 ? (
            <EmptyState title={t('Your closet is waiting')} body={t('Add the pieces you own so Sage can build outfits from them.')}
              action={<LinkButton to="/app/wardrobe" size="sm">{t('Add a piece')}</LinkButton>} />
          ) : (
            <>
              <p><strong>{wardrobeCount}</strong> {wardrobeCount === 1 ? t('piece') : t('pieces')}</p>
              <ul className="bars">
                {byCategory.map((c) => (
                  <li key={c.value}><span>{t(c.label)}</span>
                    <i style={{ width: `${(c.n / maxCat) * 100}%` }} aria-hidden /><b>{c.n}</b></li>
                ))}
              </ul>
              <Link to="/app/wardrobe" className="link-btn">{t('Open wardrobe →')}</Link>
            </>
          )}
        </motion.section>

        <motion.section variants={fadeUp} className="card" aria-labelledby="avatar-h">
          <h2 id="avatar-h" className="card__title"><UserRound size={18} aria-hidden /> {t('Your 3D avatar')}</h2>
          <p>{t('Create an estimate of your shape and preview wardrobe pieces on your avatar.')}</p>
          <LinkButton to="/app/avatar" size="sm" icon={<ArrowRight size={16} />}>{t('Open avatar')}</LinkButton>
        </motion.section>

        <motion.section variants={fadeUp} className="card dash__recent" aria-labelledby="r-h">
          <h2 id="r-h" className="card__title">{t('Recently saved outfits')}</h2>
          {!data ? <CardSkeleton /> : data.saved.length === 0 ? (
            <p className="muted">{t('Saved outfits will show up here.')}</p>
          ) : (
            <ul className="mini-outfits">
              {data.saved.slice(0, 4).map((s) => (
                <li key={s.id}>
                  <OutfitVisual outfit={s.outfit.outfit_data} />
                  <strong>{s.outfit.title}</strong>
                  <span className="muted small">{s.outfit.occasion ?? t('Outfit')}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/app/outfits" className="link-btn">{t('All outfits →')}</Link>
        </motion.section>
      </div>
    </motion.div>
  );
}