import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { Mascot, type MascotSize } from './Mascot';
import { cn } from '@/lib/util';
import { dur, ease } from '@/lib/animations';
import type { MascotState } from '@/types';

interface Props {
  mood?: MascotState;
  action?: MascotState;
  size?: MascotSize;
  /** Optional floating speech bubble. */
  bubble?: ReactNode;
  bubbleKey?: string;
  className?: string;
  waveOnClick?: boolean;
}

/** A composed scene: soft sage blob, drifting accents and the mascot. */
export function MascotStage({ mood, action, size = 'lg', bubble, bubbleKey, className, waveOnClick }: Props) {
  const reduced = useReducedMotion();
  return (
    <div className={cn('stage', className)}>
      <span className="stage__blob" aria-hidden />
      {[0, 1, 2].map((i) => (
        <motion.i key={i} className={`stage__dot stage__dot--${i}`} aria-hidden
          animate={reduced ? undefined : { y: [0, -10, 0], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.6 }} />
      ))}
      <Mascot mood={mood} action={action} size={size} waveOnClick={waveOnClick} />
      <AnimatePresence mode="wait">
        {bubble && (
          <motion.div key={bubbleKey ?? 'b'} className="stage__bubble" role="status"
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: dur.base, ease } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}>
            {bubble}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
