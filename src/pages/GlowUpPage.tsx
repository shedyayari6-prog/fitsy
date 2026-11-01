import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Clock, Coins, Flame, Lock, Sparkles, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button, CardSkeleton, Chip, ErrorNotice, Modal, Notice } from '@/components/ui';
import { Mascot } from '@/components/mascot/Mascot';
import { errMessage } from '@/lib/util';
import { completeNode, loadJourney, localDate, setDailyGoal, setSound, soundOn } from '@/lib/glowup';
import JourneyMap from '@/features/glowup/JourneyMap';
import ChallengeModal from '@/features/glowup/ChallengeModal';
import { levelInfo } from '@/features/glowup/levels';
import type { GqNode, Journey } from '@/features/glowup/types';

const GOALS: { value: 3 | 5 | 7; label: string }[] = [
  { value: 3, label: 'Beginner · 3' }, { value: 5, label: 'Normal · 5' }, { value: 7, label: 'Advanced · 7' },
];
const DIFF: Record<GqNode['difficulty'], string> = { easy: 'Easy', normal: 'Normal', hard: 'Challenging' };
const lengthOf = (n: GqNode) => (n.kind === 'timer' ? (n.duration_seconds < 60 ? `${n.duration_seconds} sec` : `${n.duration_seconds / 60} min`) : 'About 1 min');

export default function GlowUpPage() {
  const { demo } = useAuth();
  const { toast } = useToast();
  const [j, setJ] = useState<Journey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GqNode | null>(null);
  const [playing, setPlaying] = useState<GqNode | null>(null);
  const [sound, setSoundState] = useState(soundOn);
  const [savingGoal, setSavingGoal] = useState(false);

  const refresh = useCallback(async () => {
    try { setJ(await loadJourney()); setError(null); }
    catch (e) { setError(errMessage(e, 'Could not load your journey.')); }
  }, []);
  useEffect(() => { if (!demo) void refresh(); }, [refresh, demo]);

  const currentId = useMemo(() => j?.nodes.find((n) => !j.done.has(n.id))?.id ?? null, [j]);
  const prevOf = (n: GqNode) => {
    if (!j) return null;
    const i = j.nodes.findIndex((x) => x.id === n.id);
    return i > 0 ? j.nodes[i - 1] : null;
  };

  if (demo) {
    return (
      <div className="page">
        <header className="page__head"><h1>GlowUp Quest</h1></header>
        <Notice title="Needs Supabase" tone="warn">GlowUp Quest saves your progress to your account, so it is not available in demo mode.</Notice>
      </div>
    );
  }
  if (error && !j) return <div className="page"><ErrorNotice message={error} onRetry={() => void refresh()} /></div>;
  if (!j) return <div className="page"><CardSkeleton /><CardSkeleton /></div>;

  const { profile, today } = j;
  const lv = levelInfo(profile.xp);
  // The server resets a broken streak the next time a goal is completed; until then show the honest value.
  const yesterday = localDate(profile.timezone, new Date(Date.now() - 864e5));
  const alive = !!profile.last_goal_date && profile.last_goal_date >= yesterday;
  const streak = alive ? profile.current_streak : 0;
  const lost = !alive && profile.current_streak > 0;
  const goalLeft = Math.max(0, profile.daily_goal - today.completed_count);
  const pct = Math.min(100, Math.round((today.completed_count / profile.daily_goal) * 100));
  const doneAll = j.nodes.length > 0 && !currentId;
  const currentNode = j.nodes.find((n) => n.id === currentId) ?? null;

  const hello = doneAll ? { mood: 'celebrating' as const, text: 'You finished the whole journey! GlowUp Legend!' }
    : today.goal_completed ? { mood: 'celebrating' as const, text: 'Daily goal done! Anything else today is a bonus.' }
    : today.completed_count > 0 ? { mood: 'encouraging' as const, text: `Nice! ${goalLeft} more to reach today's goal. No pressure.` }
    : lost ? { mood: 'encouraging' as const, text: 'No worries! Every new day is another chance to grow.' }
    : { mood: 'greeting' as const, text: 'Hey! Ready for another step towards your best self?' };

  const open = (n: GqNode) => setPreview(n);
  const statusOf = (n: GqNode) => (j.done.has(n.id) ? 'done' : n.id === currentId ? 'current' : 'locked');
  const start = (n: GqNode) => { setPreview(null); setPlaying(n); };

  const finish = async (id: string) => {
    const r = await completeNode(id);
    if (r.ok) void refresh();
    return r;
  };

  const changeGoal = async (g: 3 | 5 | 7) => {
    if (g === profile.daily_goal || savingGoal) return;
    setSavingGoal(true);
    try { await setDailyGoal(g); await refresh(); toast('Daily goal updated.', 'success'); }
    catch (e) { toast(errMessage(e, 'Could not change your goal.'), 'error'); }
    finally { setSavingGoal(false); }
  };

  const pv = preview;
  const pvStatus = pv ? statusOf(pv) : null;
  const pvPrev = pv ? prevOf(pv) : null;

  return (
    <div className="gq">
      <header className="gq__top card card--sage">
        <div className="gq__stats">
          <div className="gq__level">
            <span className="gq__badge" aria-hidden>{lv.level}</span>
            <div>
              <strong>Level {lv.level}: {lv.name}</strong>
              <div className="progress gq__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lv.pct} aria-label="Progress to next level">
                <div className="progress__fill progress__fill--clay" style={{ width: `${lv.pct}%` }} />
              </div>
              <span className="muted small">{lv.next ? `${lv.toNext} XP to ${lv.next}` : 'Top level reached'} · {profile.xp} XP</span>
            </div>
          </div>
          <div className="gq__pills">
            <span className="streak-pill" aria-label={`${streak} day streak`}><Flame size={16} aria-hidden /> {streak} day{streak === 1 ? '' : 's'}</span>
            <span className="streak-pill gq__coins" aria-label={`${profile.coins} coins`}><Coins size={16} aria-hidden /> {profile.coins}</span>
          </div>
        </div>
        <div className="mascot-message">
          <Mascot size="sm" mood={hello.mood} decorative />
          <p className="bubble" role="status">{hello.text}</p>
        </div>
      </header>

      {error && <ErrorNotice message={error} onRetry={() => void refresh()} />}

      <div className="gq__grid">
        <div className="gq__map">
          {j.nodes.length === 0
            ? <Notice title="The map is empty">No chapters were found. Run the GlowUp Quest database migration, then refresh.</Notice>
            : <JourneyMap chapters={j.chapters} nodes={j.nodes} done={j.done} onOpen={open} />}
        </div>

        <aside className="gq__side">
          <section className="card" aria-labelledby="gq-today">
            <h2 className="card__title" id="gq-today"><Sparkles size={16} aria-hidden /> Today</h2>
            <p><strong>{today.completed_count}</strong> of <strong>{profile.daily_goal}</strong> challenges{today.goal_completed ? ' · goal reached 🎉' : ''}</p>
            <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Daily goal progress">
              <div className="progress__fill progress__fill--sage" style={{ width: `${pct}%` }} />
            </div>
            {currentNode && <Button onClick={() => open(currentNode)}>{today.completed_count ? 'Next challenge' : 'Start today'}</Button>}
            <p className="muted small">Best streak: {profile.longest_streak} {profile.longest_streak === 1 ? 'day' : 'days'}</p>
          </section>

          <section className="card" aria-labelledby="gq-goal">
            <h2 className="card__title" id="gq-goal">Daily goal</h2>
            <div className="chips" role="group" aria-label="Daily goal">
              {GOALS.map((g) => <Chip key={g.value} selected={profile.daily_goal === g.value} disabled={savingGoal} onClick={() => void changeGoal(g.value)}>{g.label}</Chip>)}
            </div>
            <p className="field__hint">These are habit targets, not medical or fitness advice. Rest days are healthy, so only pick what feels realistic.</p>
          </section>

          <label className="toggle card">
            <span>Success sound<small>A short chime when you finish a challenge.</small></span>
            <input type="checkbox" checked={sound} onChange={(e) => { setSoundState(e.target.checked); setSound(e.target.checked); }} />
            <i aria-hidden />
          </label>
        </aside>
      </div>

      <Modal open={!!pv} onClose={() => setPreview(null)} title={pv?.title ?? ''}>
        {pv && (
          <>
            <div className="tags">
              <span className="tag">{DIFF[pv.difficulty]}</span>
              <span className="tag"><Clock size={12} aria-hidden /> {lengthOf(pv)}</span>
              <span className="tag tag--clay">+{pv.xp_reward} XP</span>
              <span className="tag tag--sage">+{pv.coin_reward} coins</span>
              {pv.is_milestone && <span className="tag"><Star size={12} aria-hidden /> Milestone</span>}
              <span className="tag">{pvStatus === 'done' ? 'Completed' : pvStatus === 'current' ? 'Available' : 'Locked'}</span>
            </div>
            <p>{pv.description}</p>
            {pvStatus === 'locked' && (
              <Notice title="Locked"><span className="gq__lock"><Lock size={15} aria-hidden /> Finish {pvPrev ? `“${pvPrev.title}”` : 'the previous challenge'} first.</span></Notice>
            )}
            {pvStatus === 'done' && <Notice title="Nice work">You already completed this challenge.</Notice>}
            {pvStatus === 'current' && <div className="row-end"><Button size="lg" onClick={() => start(pv)}>Start challenge</Button></div>}
          </>
        )}
      </Modal>

      <AnimatePresence>
        {playing && <ChallengeModal key={playing.id} node={playing} sound={sound} onFinish={finish} onClose={() => setPlaying(null)} />}
      </AnimatePresence>
    </div>
  );
}
