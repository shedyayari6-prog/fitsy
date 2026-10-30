import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { Mascot } from '@/components/mascot/Mascot';
import { brand } from '@/config/brand';
import { dur, ease, spring } from '@/lib/animations';
import { useT } from '@/i18n';

type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; text: string }
interface CelebrationData { title: string; subtitle?: string; xp?: number; badges?: string[]; victory?: boolean }

interface Ctx {
  toast: (text: string, kind?: ToastKind) => void;
  celebrate: (data: CelebrationData) => void;
}
const ToastCtx = createContext<Ctx | null>(null);

const CONFETTI = Array.from({ length: 18 }, (_, i) => i);
const COLORS = [brand.palette.sage, brand.palette.clay, brand.palette.forest, '#EFEADD'];

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [party, setParty] = useState<CelebrationData | null>(null);
  const idRef = useRef(1);
  const timer = useRef<number | undefined>(undefined);
  const reduced = useReducedMotion();
  const { t } = useT();

  const toast = useCallback((text: string, kind: ToastKind = 'info') => {
    const id = idRef.current++;
    setToasts((cur) => [...cur.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 4500);
  }, []);

  const celebrate = useCallback((data: CelebrationData) => {
    setParty(data);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setParty(null), 3600);
  }, []);

  const value = useMemo(() => ({ toast, celebrate }), [toast, celebrate]);
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info };

  return (
    <ToastCtx.Provider value={value}>
      {children}

      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((item) => {
            const I = Icon[item.kind];
            return (
              <motion.div
                key={item.id}
                layout
                className={`toast toast--${item.kind}`}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: spring }}
                exit={{ opacity: 0, y: 8, transition: { duration: dur.fast } }}
              >
                <I size={18} aria-hidden />
                <span>{t(item.text)}</span>
                <button className="icon-btn icon-btn--tiny" aria-label={t('Dismiss notification')}
                  onClick={() => setToasts((x) => x.filter((y) => y.id !== item.id))}>
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {party && (
          <motion.div
            className="celebrate"
            role="dialog"
            aria-live="assertive"
            aria-label={party.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: dur.base, ease } }}
            exit={{ opacity: 0, transition: { duration: dur.fast } }}
            onClick={() => setParty(null)}
          >
            {!reduced && CONFETTI.map((i) => (
              <motion.span
                key={i}
                className="confetti"
                style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length] }}
                initial={{ y: -40, opacity: 1, rotate: 0 }}
                animate={{ y: '105vh', rotate: 360 + i * 20, opacity: [1, 1, 0], transition: { duration: 2.2 + (i % 5) * 0.25, ease: 'easeIn', delay: (i % 6) * 0.08 } }}
              />
            ))}
            <motion.div
              className="celebrate__card"
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0, transition: spring }}
              onClick={(e) => e.stopPropagation()}
            >
              <Mascot action={party.victory ? 'victory' : 'celebrating'} mood="excited" size="md" decorative />
              <h2>{party.title}</h2>
              {party.subtitle && <p>{party.subtitle}</p>}
              {typeof party.xp === 'number' && party.xp > 0 && <span className="xp-pill">+{party.xp} XP</span>}
              {party.badges?.map((b) => <span key={b} className="badge badge--clay">{t('Achievement: {name}', { name: t(b) })}</span>)}
              <button className="btn btn--soft btn--sm" onClick={() => setParty(null)}>{t('Nice!')}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
