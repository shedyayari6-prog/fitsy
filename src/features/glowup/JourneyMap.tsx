import { useEffect, useMemo, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Lock, Play, Star } from 'lucide-react';
import { THEMES } from './levels';
import type { GqChapter, GqNode } from './types';

const HEAD = 150;   // chapter banner height (px)
const STEP = 118;   // vertical distance between nodes (px)
const PAD = 110;    // space after the last node (px)

export type NodeStatus = 'done' | 'current' | 'locked';

/** Deterministic random numbers, so the scenery is the same on every visit. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nodePos = (chapterIdx: number, i: number) => ({ x: 50 + 20 * Math.sin(i * 0.95 + chapterIdx * 1.7), y: HEAD + i * STEP + 50 });

function Prop({ kind }: { kind: string }) {
  switch (kind) {
    case 'tree': return (
      <svg viewBox="0 0 44 60" aria-hidden><rect x="19" y="38" width="6" height="20" rx="3" className="gqs-trunk" />
        <circle cx="22" cy="24" r="17" className="gqs-leaf" /><circle cx="12" cy="32" r="10" className="gqs-leaf gqs-leaf--b" /><circle cx="32" cy="31" r="10" className="gqs-leaf gqs-leaf--b" /></svg>);
    case 'bush': return (
      <svg viewBox="0 0 44 26" aria-hidden><circle cx="12" cy="16" r="10" className="gqs-leaf gqs-leaf--b" /><circle cx="24" cy="12" r="12" className="gqs-leaf" /><circle cx="34" cy="17" r="9" className="gqs-leaf gqs-leaf--b" /></svg>);
    case 'rock': return (
      <svg viewBox="0 0 44 26" aria-hidden><path d="M3 25 Q5 8 20 6 Q37 5 41 25 Z" className="gqs-rock" /><path d="M12 14 Q18 9 26 10" className="gqs-rock-hi" /></svg>);
    case 'flower': return (
      <svg viewBox="0 0 24 32" aria-hidden><path d="M12 30 V14" className="gqs-stem" />
        {[0, 72, 144, 216, 288].map((r) => <circle key={r} cx="12" cy="7" r="4.2" className="gqs-petal" transform={`rotate(${r} 12 12) translate(0 -5)`} />)}
        <circle cx="12" cy="12" r="3.2" className="gqs-core" /></svg>);
    case 'pond': return (
      <svg viewBox="0 0 70 30" aria-hidden><ellipse cx="35" cy="18" rx="32" ry="10" className="gqs-water" /><ellipse cx="28" cy="16" rx="10" ry="2.6" className="gqs-shine" /></svg>);
    default: return (
      <svg viewBox="0 0 80 30" aria-hidden><ellipse cx="26" cy="20" rx="20" ry="9" className="gqs-cloud" /><ellipse cx="44" cy="14" rx="20" ry="11" className="gqs-cloud" /><ellipse cx="60" cy="21" rx="16" ry="8" className="gqs-cloud" /></svg>);
  }
}

interface Props {
  chapters: GqChapter[];
  nodes: GqNode[];
  done: Set<string>;
  onOpen: (n: GqNode, status: NodeStatus) => void;
}

export default function JourneyMap({ chapters, nodes, done, onOpen }: Props) {
  const reduce = useReducedMotion();
  const currentId = useMemo(() => nodes.find((n) => !done.has(n.id))?.id ?? null, [nodes, done]);

  // Bring the current node into view whenever it changes.
  useEffect(() => {
    if (!currentId) return;
    const el = document.getElementById('gq-current');
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [currentId, reduce]);

  return (
    <div className="gqm" role="group" aria-label="Your journey">
      {chapters.map((ch, ci) => {
        const list = nodes.filter((n) => n.chapter_id === ch.id);
        if (!list.length) return null;
        const H = HEAD + list.length * STEP + PAD;
        const th = THEMES[ch.theme] ?? THEMES.dawn;
        const doneCount = list.filter((n) => done.has(n.id)).length;
        const started = doneCount > 0 || list.some((n) => n.id === currentId);
        const pts = [{ x: 50, y: 0 }, ...list.map((_, i) => nodePos(ci, i)), { x: 50, y: H }];

        const r = rng(ch.id * 977 + 13);
        const props = Array.from({ length: 18 }, (_, k) => {
          const left = k % 2 === 0;
          const p = r();
          return {
            k, x: left ? 2 + r() * 13 : 85 + r() * 13, y: HEAD + 30 + r() * (H - HEAD - 130), s: 0.8 + r() * 0.6,
            kind: p < 0.38 ? 'tree' : p < 0.52 ? 'bush' : p < 0.64 ? 'rock' : p < 0.9 ? 'flower' : 'pond',
          };
        });
        const clouds = Array.from({ length: 4 }, (_, k) => ({ k, x: r() * 75 + 5, y: HEAD + r() * (H - HEAD - 60), s: 0.8 + r() * 0.7 }));

        const style = { '--gq-sky': th.sky, '--gq-ground': th.ground, '--gq-leaf': th.leaf, '--gq-accent': th.accent, '--gq-road': th.road, height: H } as CSSProperties;

        return (
          <section key={ch.id} className={`gqm__chapter ${started ? '' : 'gqm__chapter--locked'}`} style={style} aria-labelledby={`gq-ch-${ch.id}`}>
            <div className="gqm__scenery" aria-hidden>
              {clouds.map((c) => <span key={`c${c.k}`} className="gqs gqs--cloud" style={{ left: `${c.x}%`, top: c.y, transform: `scale(${c.s})` }}><Prop kind="cloud" /></span>)}
              {props.map((p) => <span key={p.k} className={`gqs gqs--${p.kind}`} style={{ left: `${p.x}%`, top: p.y, transform: `translate(-50%,-100%) scale(${p.s})` }}><Prop kind={p.kind} /></span>)}
            </div>

            <svg className="gqm__road" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden>
              {pts.slice(0, -1).map((a, i) => {
                const b = pts[i + 1], my = (a.y + b.y) / 2;
                const d = `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
                const passed = i === list.length ? list.every((n) => done.has(n.id)) : done.has(list[i]?.id ?? '');
                return (
                  <g key={i}>
                    <path d={d} className="gqm__road-base" vectorEffect="non-scaling-stroke" />
                    <path d={d} className="gqm__road-dash" vectorEffect="non-scaling-stroke" />
                    {passed && <path d={d} className="gqm__road-done" vectorEffect="non-scaling-stroke" />}
                  </g>
                );
              })}
            </svg>

            <header className="gqm__head">
              <span className="gqm__num" aria-hidden>{ch.id}</span>
              <div>
                <p className="eyebrow">Chapter {ch.id}</p>
                <h2 id={`gq-ch-${ch.id}`}>{ch.title}</h2>
                <p className="gqm__blurb">{ch.blurb}</p>
              </div>
              <span className="gqm__count" aria-label={`${doneCount} of ${list.length} done`}>{doneCount}/{list.length}</span>
            </header>

            <ol className="gqm__nodes">
              {list.map((n, i) => {
                const { x, y } = nodePos(ci, i);
                const status: NodeStatus = done.has(n.id) ? 'done' : n.id === currentId ? 'current' : 'locked';
                const Icon = status === 'done' ? Check : status === 'locked' ? Lock : n.is_milestone ? Star : Play;
                const label = `${n.title}, ${status === 'done' ? 'completed' : status === 'current' ? 'available now' : 'locked'}`;
                return (
                  <li key={n.id} className="gqm__item" style={{ left: `${x}%`, top: y }}>
                    {status === 'current' && (
                      <>
                        <span className="gqm__float" aria-hidden>+{n.xp_reward} XP</span>
                        <span className={`gqm__mascot ${x < 50 ? 'gqm__mascot--r' : 'gqm__mascot--l'}`} aria-hidden>
                          <motion.img src="/mascot/chad.png" alt="" draggable={false}
                            animate={reduce ? undefined : { y: [0, -5, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
                        </span>
                      </>
                    )}
                    <motion.button
                      type="button" id={status === 'current' ? 'gq-current' : undefined}
                      className={`gqn gqn--${status} ${n.is_milestone ? 'gqn--star' : ''}`}
                      aria-label={label}
                      onClick={() => onOpen(n, status)}
                      whileHover={reduce ? undefined : { scale: 1.08 }} whileTap={reduce ? undefined : { scale: 0.94 }}
                      animate={status === 'current' && !reduce ? { y: [0, -7, 0] } : { y: 0 }}
                      transition={status === 'current' ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}>
                      <Icon size={n.is_milestone ? 30 : 28} aria-hidden strokeWidth={2.6} />
                    </motion.button>
                    <span className="gqn__label">{n.title}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {!currentId && nodes.length > 0 && <p className="gqm__end">You reached the end of the journey. More chapters are coming.</p>}
    </div>
  );
}
