import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type TargetAndTransition } from 'motion/react';
import { Check, CloudRain, Flame, Heart, Sparkles, X } from 'lucide-react';
import { brand } from '@/config/brand';
import { useT } from '@/i18n';
import { cn } from '@/lib/util';
import type { MascotState } from '@/types';

/**
 * The mascot is the supplied character artwork, never redrawn or stretched.
 *  • Poses: each state maps to one of the extra pose images (see brand.mascotPoses). Poses cross-fade with a
 *    little squash-and-pop. A missing image falls back to the base artwork.
 *  • Motion: whole-figure transforms only (float, tilt, hop, sway), plus a ground shadow that breathes with it.
 *  • Life: idle fidgets every few seconds, and tapping the mascot makes it react.
 *  • Overlays: separate elements (dots, tears, sparkles, flame, hearts…), so the face is never warped.
 * All motion is disabled for users who prefer reduced motion.
 */
const SIZES = { xs: 64, sm: 110, md: 170, lg: 260, xl: 360 } as const;
export type MascotSize = keyof typeof SIZES | number;

type PoseKey = keyof typeof brand.mascotPoses;
const POSE_FOR: Partial<Record<MascotState, PoseKey>> = {
  happy: 'jump',
  greeting: 'wave', waving: 'wave',
  thinking: 'thinking', loading: 'thinking', confused: 'thinking',
  surprised: 'shocked',
  celebrating: 'jump', excited: 'jump',
  'outfit-approved': 'victory', victory: 'victory',
  'outfit-rejected': 'sad', sad: 'sad',
  crying: 'crying',
  streak: 'streak',
};

/** Poses whose image failed to load (module-level so it's remembered across mounts). */
const missing = new Set<PoseKey>();
let preloaded = false;
function preload() {
  if (preloaded || typeof window === 'undefined') return;
  preloaded = true;
  (Object.keys(brand.mascotPoses) as PoseKey[]).forEach((k) => {
    const img = new Image();
    img.onerror = () => missing.add(k);
    img.src = brand.mascotPoses[k];
  });
}

const loop = (duration: number, extra: object = {}) => ({ duration, repeat: Infinity, ease: 'easeInOut' as const, ...extra });
const times = (duration: number, repeat: number) => ({ duration, repeat, ease: 'easeInOut' as const });

const MOTION: Record<MascotState, TargetAndTransition> = {
  idle: { y: [0, -6, 0], scale: [1, 1.012, 1], transition: loop(4.2) },
  happy: { y: [0, -8, 0], transition: loop(2.6) },
  excited: { y: [0, -16, 0], rotate: [0, -2, 2, 0], transition: loop(0.9) },
  greeting: { rotate: [0, -4, 4, -4, 4, 0], y: [0, -4, 0], transition: times(1.7, 1) },
  waving: { rotate: [0, -5, 5, -5, 5, 0], y: [0, -5, 0], transition: times(1.5, 2) },
  thinking: { rotate: [0, -3, 0, -3, 0], y: [0, -3, 0], transition: loop(3.4) },
  talking: { y: [0, -4, 0, -2, 0], transition: loop(0.8) },
  listening: { rotate: [0, 3, 0], scale: [1, 1.02, 1], transition: loop(2.4) },
  surprised: { y: [0, -14, 0], scale: [1, 1.06, 1], transition: times(0.55, 1) },
  confused: { rotate: [0, -4, 3, -2, 0], transition: times(1.8, 1) },
  encouraging: { y: [0, -5, 0], scale: [1, 1.02, 1], transition: loop(2.2) },
  celebrating: { y: [0, -30, 0, -16, 0], rotate: [0, -4, 4, 0], transition: times(1.1, 3) },
  walking: { x: [-6, 6, -6], y: [0, -5, 0, -5, 0], rotate: [-1.5, 1.5, -1.5], transition: loop(1.8) },
  recommending: { x: [0, 12, 0], rotate: [0, 2.5, 0], transition: times(1.8, 2) },
  'outfit-approved': { scale: [1, 1.08, 1], y: [0, -12, 0], transition: times(0.7, 1) },
  'outfit-rejected': { x: [0, -6, 6, -4, 4, 0], y: [0, 3, 0], transition: times(0.6, 0) },
  loading: { y: [0, -4, 0], transition: loop(1.4) },
  sleeping: { y: [0, 3, 0], scale: [1, 1.01, 1], transition: loop(5.5) },
  sad: { y: [0, 3, 0], rotate: [0, -1.5, 0], transition: loop(4.5) },
  crying: { x: [-2, 2, -2, 2, 0], y: [0, 2, 0], transition: times(0.7, 3) },
  victory: { y: [0, -22, 0, -10, 0], scale: [1, 1.06, 1], transition: times(1, 2) },
  streak: { scale: [1, 1.05, 1], y: [0, -8, 0], transition: loop(1.6) },
};

const FIDGET: Record<'hop' | 'tilt' | 'wave', TargetAndTransition> = {
  hop: { y: [0, -18, 0, -6, 0], scale: [1, 1.03, 1], transition: { duration: 0.8, ease: 'easeOut' } },
  tilt: { rotate: [0, -6, 5, 0], transition: { duration: 1.1, ease: 'easeInOut' } },
  wave: { rotate: [0, -5, 5, -5, 0], y: [0, -4, 0], transition: { duration: 1.4, ease: 'easeInOut' } },
};

const LABELS: Record<MascotState, string> = {
  idle: 'relaxed', happy: 'happy', excited: 'excited', greeting: 'saying hello', waving: 'waving',
  thinking: 'thinking', talking: 'talking', listening: 'listening', surprised: 'surprised', confused: 'a bit confused',
  encouraging: 'encouraging you', celebrating: 'celebrating', walking: 'out walking', recommending: 'pointing out ideas',
  'outfit-approved': 'approving the outfit', 'outfit-rejected': 'not convinced by the outfit', loading: 'working on it', sleeping: 'resting',
  sad: 'feeling sad', crying: 'crying', victory: 'celebrating a win', streak: 'proud of your streak',
};

const FLOATY: MascotState[] = ['idle', 'happy', 'excited', 'encouraging', 'loading', 'sleeping', 'walking', 'talking', 'thinking', 'listening', 'streak', 'sad'];

function Overlay({ state, burst }: { state: MascotState; burst: number }) {
  const reduced = useReducedMotion();
  const confetti = ['var(--clay)', 'var(--sage)', 'var(--forest)', '#EFEADD', 'var(--clay)', 'var(--sage)'];
  switch (state) {
    case 'thinking':
    case 'loading':
      return (
        <span className="mascot__dots" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.i key={i} animate={reduced ? undefined : { y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
          ))}
        </span>
      );
    case 'confused': return <span className="mascot__glyph mascot__glyph--clay" aria-hidden>?</span>;
    case 'surprised': return <span className="mascot__glyph mascot__glyph--clay" aria-hidden>!</span>;
    case 'sleeping': return <span className="mascot__glyph mascot__glyph--sage" aria-hidden>z<small>z</small></span>;
    case 'listening':
      return (
        <span className="mascot__rings" aria-hidden>
          {[0, 1].map((i) => (
            <motion.i key={i} initial={{ scale: 0.6, opacity: 0.6 }}
              animate={reduced ? { opacity: 0.35, scale: 1 } : { scale: [0.6, 1.25], opacity: [0.55, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.9, ease: 'easeOut' }} />
          ))}
        </span>
      );
    case 'talking':
      return (
        <span className="mascot__wave" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <motion.i key={i} animate={reduced ? undefined : { scaleY: [0.4, 1, 0.5] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }} />
          ))}
        </span>
      );
    case 'celebrating':
    case 'excited':
    case 'victory':
    case 'recommending':
    case 'encouraging':
      return (
        <>
          <Sparkles className="mascot__spark mascot__spark--a" size={22} aria-hidden />
          <Sparkles className="mascot__spark mascot__spark--b" size={16} aria-hidden />
          {!reduced && (state === 'celebrating' || state === 'victory') && (
            <span className="mascot__burst" aria-hidden>
              {confetti.map((c, i) => (
                <motion.i key={i} style={{ background: c }}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{ x: Math.cos((i / confetti.length) * Math.PI * 2) * 110, y: Math.sin((i / confetti.length) * Math.PI * 2) * 90 - 30, opacity: [1, 1, 0], rotate: 240 }}
                  transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 0.8, ease: 'easeOut', delay: i * 0.04 }} />
              ))}
            </span>
          )}
        </>
      );
    case 'outfit-approved': return <span className="mascot__badge mascot__badge--ok" aria-hidden><Check size={22} /></span>;
    case 'outfit-rejected': return <span className="mascot__badge mascot__badge--no" aria-hidden><X size={22} /></span>;
    case 'sad': return <CloudRain className="mascot__cloud" size={34} aria-hidden />;
    case 'crying':
      return (
        <span className="mascot__tears" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.i key={i} className={`mascot__tear mascot__tear--${i % 2}`}
              initial={{ y: 0, opacity: 0 }}
              animate={reduced ? { opacity: 0.8 } : { y: [0, 56], opacity: [0, 1, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.45, ease: 'easeIn' }} />
          ))}
        </span>
      );
    case 'streak':
      return (
        <motion.span className="mascot__flame" aria-hidden
          animate={reduced ? undefined : { scale: [1, 1.18, 1], rotate: [-4, 4, -4] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}>
          <Flame size={34} />
        </motion.span>
      );
    default:
      return burst > 0 && !reduced ? (
        <span className="mascot__hearts" aria-hidden key={burst}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} initial={{ y: 0, x: (i - 1) * 16, opacity: 0, scale: 0.6 }}
              animate={{ y: -70 - i * 12, opacity: [0, 1, 0], scale: 1 }}
              transition={{ duration: 1.3, delay: i * 0.12, ease: 'easeOut' }}>
              <Heart size={18} fill="currentColor" />
            </motion.span>
          ))}
        </span>
      ) : null;
  }
}

interface MascotProps {
  mood?: MascotState;
  action?: MascotState;
  size?: MascotSize;
  className?: string;
  /** Hide from assistive tech when the surrounding text already conveys the state. */
  decorative?: boolean;
  label?: string;
  /** Disable tap reactions and idle fidgets (e.g. tiny inline mascots). */
  still?: boolean;
  /** Show the waving pose while pressed; restore the state-driven pose on pointer leave. */
  waveOnClick?: boolean;
}

export function Mascot({ mood = 'happy', action = 'idle', size = 'md', className, decorative, label, still, waveOnClick = false }: MascotProps) {
  const { t } = useT();
  const reduced = useReducedMotion();
  const [, force] = useState(0);
  const [fidget, setFidget] = useState<'hop' | 'tilt' | 'wave' | null>(null);
  const [burst, setBurst] = useState(0);
  const [baseBroken, setBaseBroken] = useState(false);
  const [clickedWave, setClickedWave] = useState(false);
  const fidgetTimer = useRef<number | undefined>(undefined);

  useEffect(() => { preload(); }, []);

  const px = typeof size === 'number' ? size : SIZES[size];
  const active: MascotState = action !== 'idle' ? action : mood;
  const calm = active === 'idle' || active === 'happy';

  // Idle life: every 7–12 s the mascot does something small.
  useEffect(() => {
    if (reduced || still || !calm) return;
    let alive = true;
    const schedule = () => {
      fidgetTimer.current = window.setTimeout(() => {
        if (!alive) return;
        const options: ('hop' | 'tilt' | 'wave')[] = ['hop', 'tilt', ...(missing.has('wave') ? [] : ['wave' as const])];
        setFidget(options[Math.floor(Math.random() * options.length)]);
        window.setTimeout(() => alive && setFidget(null), 1500);
        schedule();
      }, 7000 + Math.random() * 5000);
    };
    schedule();
    return () => { alive = false; window.clearTimeout(fidgetTimer.current); };
  }, [calm, reduced, still]);

  const poke = useCallback(() => {
    if (reduced || still) return;
    setFidget('hop');
    setBurst((b) => b + 1);
    window.setTimeout(() => setFidget(null), 900);
  }, [reduced, still]);

  const pressToWave = useCallback(() => setClickedWave(true), []);

  const poseKey: PoseKey | undefined = clickedWave || fidget === 'wave' ? 'wave' : POSE_FOR[active];
  const usePose = poseKey && !missing.has(poseKey) ? poseKey : undefined;
  const src = usePose ? brand.mascotPoses[usePose] : null;

  const animate = reduced ? undefined : clickedWave ? FIDGET.wave : fidget ? FIDGET[fidget] : MOTION[active] ?? MOTION.idle;
  const duration = ((MOTION[active]?.transition as { duration?: number } | undefined)?.duration) ?? 4;
  const floaty = FLOATY.includes(active) && !fidget;

  const aria = decorative
    ? { 'aria-hidden': true as const }
    : waveOnClick
      ? { role: 'button' as const, tabIndex: 0, 'aria-label': label ?? `${brand.mascotName}, ${t('your stylist')}, ${t(LABELS[active])}` }
      : { role: 'img' as const, 'aria-label': label ?? `${brand.mascotName}, ${t('your stylist')}, ${t(LABELS[active])}` };

  return (
    <div className={cn('mascot', className)} style={{ width: px }} {...aria}
      onPointerDown={waveOnClick ? pressToWave : poke}
      onPointerLeave={waveOnClick ? () => setClickedWave(false) : undefined}
      onBlur={waveOnClick ? () => setClickedWave(false) : undefined}
      onKeyDown={waveOnClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pressToWave(); }
      } : undefined}>
      <motion.span className="mascot__shadow" aria-hidden
        animate={reduced ? undefined : floaty ? { scaleX: [1, 0.84, 1], opacity: [0.3, 0.16, 0.3] } : { scaleX: 1, opacity: 0.3 }}
        transition={floaty ? { duration, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }} />
      <motion.div className="mascot__body" animate={animate} style={{ transformOrigin: '50% 92%' }}>
        <AnimatePresence initial={false}>
          <motion.div key={src ?? 'base'} className="mascot__layer"
            initial={reduced ? false : { opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
            exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.18 } }}>
            {src ? (
              <img src={src} alt="" decoding="async" draggable={false}
                onError={() => { if (usePose) { missing.add(usePose); force((n) => n + 1); } }} />
            ) : baseBroken ? (
              <svg className="mascot__fallback" viewBox="0 0 720 950" role="presentation">
                <rect width="720" height="950" rx="120" fill={brand.palette.sage} />
                <g fill="none" stroke={brand.palette.forest} strokeWidth="46" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M360 330a50 50 0 1 1 50 50" /><path d="M360 380 150 600h420L360 380Z" />
                </g>
              </svg>
            ) : (
              <picture>
                <source srcSet={brand.mascotSrc} type="image/webp" />
                <img src={brand.mascotFallbackSrc} alt="" width={720} height={950} draggable={false}
                  decoding="async" onError={() => setBaseBroken(true)} />
              </picture>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <Overlay state={active} burst={burst} />
    </div>
  );
}
