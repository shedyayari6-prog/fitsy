import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Mascot } from './Mascot';
import { cn } from '@/lib/util';
import { dur, ease } from '@/lib/animations';
import type { MascotState } from '@/types';

interface Props {
  /** Changing `messageKey` re-triggers the entrance animation. */
  messageKey?: string;
  mood?: MascotState;
  action?: MascotState;
  children: ReactNode;
  className?: string;
}

/** The mascot beside a speech bubble: used for guidance, hints and empty states. */
export function MascotMessage({ messageKey, mood = 'happy', action = 'idle', children, className }: Props) {
  return (
    <div className={cn('mascot-message', className)}>
      <Mascot size="sm" mood={mood} action={action} decorative />
      <AnimatePresence mode="wait">
        <motion.div
          key={messageKey ?? 'm'}
          className="bubble"
          role="status"
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: dur.base, ease } }}
          exit={{ opacity: 0, transition: { duration: dur.fast } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
