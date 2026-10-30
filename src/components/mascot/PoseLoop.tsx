import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { brand } from '@/config/brand';
import { cn } from '@/lib/util';

/** Frames shown one after another, forever, in this order. */
const FRAMES = [brand.mascotPoses.thinking, brand.mascotPoses.streak, brand.mascotPoses.jump];
const STEP_MS = 1700;

/**
 * Endless loop of three mascot poses (thinking → streak_growing → jumping_happy → …).
 * A frame whose image file is missing is skipped; with reduced motion it stays on the first frame.
 */
export function PoseLoop({ size = 150, className }: { size?: number; className?: string }) {
  const reduced = useReducedMotion();
  const [missing, setMissing] = useState<string[]>([]);
  const frames = FRAMES.filter((f) => !missing.includes(f));
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduced || frames.length < 2) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % frames.length), STEP_MS);
    return () => window.clearInterval(id);
  }, [reduced, frames.length]);

  const src = frames[i % Math.max(frames.length, 1)] ?? brand.mascotFallbackSrc;

  return (
    <div className={cn('poseloop', className)} style={{ width: size }} aria-hidden>
      <AnimatePresence initial={false}>
        <motion.img
          key={src}
          src={src}
          alt=""
          draggable={false}
          className="poseloop__img"
          onError={() => setMissing((m) => (m.includes(src) ? m : [...m, src]))}
          initial={reduced ? false : { opacity: 0, scale: 0.88, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 18 } }}
          exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.25 } }}
        />
      </AnimatePresence>
    </div>
  );
}
