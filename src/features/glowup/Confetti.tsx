import { useMemo } from 'react';

const COLORS = ['#C78665', '#A3B18A', '#344E41', '#F0DCCF', '#DDE4D0', '#D9B64B'];

/** Pure CSS confetti. Motion is switched off globally when the user prefers reduced motion. */
export default function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100, delay: Math.random() * 0.5, dur: 1.8 + Math.random() * 1.6,
      color: COLORS[i % COLORS.length], w: 6 + Math.random() * 6, h: 10 + Math.random() * 8, rot: Math.random() * 360,
    })),
    [count],
  );
  return (
    <div className="gq-confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, width: p.w, height: p.h, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}
