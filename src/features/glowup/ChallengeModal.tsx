import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Pause, Play, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { errMessage } from '@/lib/util';
import { REASONS, playDing } from '@/lib/glowup';
import { LEVELS } from './levels';
import Confetti from './Confetti';
import type { CompleteResult, GqNode } from './types';

type Phase = 'ready' | 'saving' | 'done' | 'error';
type Done = Extract<CompleteResult, { ok: true }>;

const RING = 2 * Math.PI * 54;
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const lengthLabel = (s: number) => (s % 60 === 0 ? `${s / 60} minute${s === 60 ? '' : 's'}` : `${s} second`);

interface Props {
  node: GqNode;
  sound: boolean;
  onClose: () => void;
  /** Saves the completion on the server. Resolves with the server's answer. */
  onFinish: (id: string) => Promise<CompleteResult>;
}

export default function ChallengeModal({ node, sound, onClose, onFinish }: Props) {
  const reduce = useReducedMotion();
  const total = node.kind === 'timer' ? node.duration_seconds || 60 : 60;
  const [phase, setPhase] = useState<Phase>('ready');
  const [timerOn, setTimerOn] = useState(node.kind === 'timer');
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const [ticked, setTicked] = useState<boolean[]>(() => node.steps.map(() => false));
  const [result, setResult] = useState<Done | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const endAt = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const finish = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRunning(false);
    setPhase('saving');
    setErr(null);
    try {
      const r = await onFinish(node.id);
      if (r.ok) { setResult(r); setPhase('done'); if (sound) playDing(); }
      else { setErr(REASONS[r.reason] ?? 'Could not save this challenge.'); setPhase('error'); }
    } catch (e) {
      setErr(errMessage(e, 'Could not save this challenge. Please try again.'));
      setPhase('error');
    } finally { busy.current = false; }
  }, [node.id, onFinish, sound]);

  // Countdown, based on the clock so it stays accurate if the tab is throttled.
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) { window.clearInterval(id); void finishRef.current(); }
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  // Dialog basics: focus, Escape, no background scroll.
  useEffect(() => {
    box.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  const close = () => { if (phase !== 'saving') onClose(); };

  const start = () => { endAt.current = Date.now() + left * 1000; setRunning(true); };
  const pause = () => setRunning(false);
  const allTicked = ticked.every(Boolean);
  const timerShown = node.kind === 'timer' || timerOn;
  const started = left < total || running;
  const eyebrow = node.kind === 'timer' ? `${lengthLabel(total)} challenge` : node.kind === 'reps' ? 'Go at your own pace' : 'Quick check-in';

  return (
    <div className="gqc" role="dialog" aria-modal="true" aria-labelledby="gqc-title" tabIndex={-1} ref={box}
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      {phase === 'done' && <Confetti count={60} />}
      <button type="button" className="icon-btn gqc__x" aria-label="Close" onClick={close} disabled={phase === 'saving'}><X size={22} /></button>

      <motion.div className="gqc__card" initial={reduce ? false : { opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <div className="gqc__mascot" aria-hidden>
          <img src={phase === 'done' ? '/mascot/chadcong.png' : '/mascot/thinking.png'} alt="" draggable={false} />
        </div>

        {phase !== 'done' && (
          <>
            <p className="eyebrow">{eyebrow}</p>
            <h1 id="gqc-title" className="gqc__title">{node.title}</h1>
            <p className="muted">{node.description}</p>

            {timerShown && (
              <div className="gqc__ring" role="timer" aria-live="off" aria-label={`${left} seconds left`}>
                <svg viewBox="0 0 120 120" aria-hidden>
                  <circle cx="60" cy="60" r="54" className="gqc__ring-bg" />
                  <circle cx="60" cy="60" r="54" className="gqc__ring-fg" strokeDasharray={RING} strokeDashoffset={RING * (1 - left / total)} transform="rotate(-90 60 60)" />
                </svg>
                <span className="gqc__time">{fmt(left)}</span>
              </div>
            )}

            {node.kind === 'check' ? (
              <ul className="gqc__steps" aria-label="Steps">
                {node.steps.map((s, i) => (
                  <li key={i}>
                    <label className="check"><input type="checkbox" checked={ticked[i]} onChange={(e) => setTicked((t) => t.map((v, j) => (j === i ? e.target.checked : v)))} /><span>{s}</span></label>
                  </li>
                ))}
              </ul>
            ) : (
              <ol className="gqc__steps gqc__steps--ol">{node.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            )}

            {node.easier && (
              <details className="gqc__easier"><summary>Need an easier version?</summary><p>{node.easier}</p></details>
            )}
            {node.tip && <p className="gqc__tip"><Sparkles size={15} aria-hidden /> {node.tip}</p>}
            {node.kind !== 'check' && <p className="field__hint">You can rest or stop at any time. Do only what feels comfortable.</p>}

            {err && <p className="field__error" role="alert">{err}</p>}

            <div className="gqc__actions">
              {timerShown && (running
                ? <Button variant="soft" size="lg" icon={<Pause size={18} />} onClick={pause}>Pause</Button>
                : <Button size="lg" icon={<Play size={18} />} onClick={start} disabled={phase === 'saving'}>{started ? 'Resume' : 'Start timer'}</Button>)}
              {node.kind === 'reps' && !timerOn && <Button variant="ghost" onClick={() => setTimerOn(true)}>Use a 60-second timer</Button>}
              <Button variant={timerShown ? 'ghost' : 'primary'} size={timerShown ? undefined : 'lg'} loading={phase === 'saving'} disabled={node.kind === 'check' && !allTicked}
                onClick={() => void finish()}>{phase === 'error' ? 'Try again' : node.kind === 'check' ? 'Mark as done' : timerShown ? "I'm done" : 'I did it'}</Button>
              <Button variant="ghost" onClick={close} disabled={phase === 'saving'}>Cancel</Button>
            </div>
          </>
        )}

        {phase === 'done' && result && (
          <div className="gqc__done" role="status">
            <p className="eyebrow">Challenge complete</p>
            <h1 id="gqc-title" className="gqc__title">LET&rsquo;S GOOO!</h1>
            <p className="gqc__gain"><strong>+{result.xp_gain} XP</strong> · <strong>+{result.coin_gain}</strong> coins</p>
            <ul className="gqc__bonus">
              {result.goal_hit && <li>Daily goal reached! Your streak is now {result.streak} {result.streak === 1 ? 'day' : 'days'}.</li>}
              {result.streak_milestone && <li>{result.streak_milestone} DAYS! You&rsquo;re building something amazing!</li>}
              {result.week_bonus && <li>A full week of goals. Bonus XP!</li>}
              {result.leveled_up && <li>Level up! You are now level {result.level}: {LEVELS[result.level - 1]?.name ?? ''}.</li>}
              {result.chapter_done && <li>NEW AREA UNLOCKED! You finished a whole chapter.</li>}
              {result.journey_done && <li>You completed the entire journey. GlowUp Legend!</li>}
              {!result.goal_hit && <li className="muted">{result.daily_count} done today. Every step counts.</li>}
            </ul>
            <Button size="lg" onClick={onClose}>Continue</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
