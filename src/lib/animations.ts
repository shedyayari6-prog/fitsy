import type { Variants, Transition } from 'motion/react';

/** One easing + timing vocabulary for the whole app. */
export const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
export const dur = { fast: 0.18, base: 0.35, slow: 0.6, milestone: 0.9 };
export const spring: Transition = { type: 'spring', stiffness: 260, damping: 22 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: dur.base, ease } },
};
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.base, ease } },
};
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: spring },
};
export const stagger = (gap = 0.07): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: 0.04 } },
});

export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: dur.base, ease } },
  exit: { opacity: 0, transition: { duration: dur.fast } },
};
export const stepSlide = (dir: 1 | -1) => ({
  initial: { opacity: 0, x: 28 * dir },
  animate: { opacity: 1, x: 0, transition: { duration: dur.base, ease } },
  exit: { opacity: 0, x: -28 * dir, transition: { duration: dur.fast } },
});
export const tap = { scale: 0.97 };
export const hoverLift = { y: -3 };
