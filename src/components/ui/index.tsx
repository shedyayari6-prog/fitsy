import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { brand } from '@/config/brand';
import { cn } from '@/lib/util';
import { dur, ease, spring, tap } from '@/lib/animations';
import { Mascot } from '@/components/mascot/Mascot';
import { useT } from '@/i18n';
import type { MascotState } from '@/types';

// ── Button ─────────────────────────────────────────────────────────────────
type Variant = 'primary' | 'clay' | 'soft' | 'ghost' | 'danger';
export const buttonClass = (variant: Variant = 'primary', size: 'md' | 'sm' | 'lg' = 'md', extra?: string) =>
  cn('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, extra);

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'> {
  variant?: Variant;
  size?: 'md' | 'sm' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}
export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest }: BtnProps) {
  return (
    <motion.button
      whileTap={disabled || loading ? undefined : tap}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="spin" size={18} aria-hidden /> : icon}
      {children}
    </motion.button>
  );
}
export function LinkButton({ to, variant = 'primary', size = 'md', icon, children, className }:
  { to: string; variant?: Variant; size?: 'md' | 'sm' | 'lg'; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <Link to={to} className={buttonClass(variant, size, className)}>{icon}{children}</Link>;
}

// ── Chip (toggle) ──────────────────────────────────────────────────────────
export function Chip({ selected, onClick, children, swatch, disabled }:
  { selected?: boolean; onClick?: () => void; children: ReactNode; swatch?: string; disabled?: boolean }) {
  return (
    <motion.button type="button" whileTap={tap} className={cn('chip', selected && 'chip--on')}
      aria-pressed={selected} onClick={onClick} disabled={disabled}>
      {swatch && <i className="chip__swatch" style={{ background: swatch }} aria-hidden />}
      {children}
      {selected && <span className="sr-only"> (selected)</span>}
    </motion.button>
  );
}

// ── Form fields ────────────────────────────────────────────────────────────
export function Field({ label, hint, error, children, htmlFor }:
  { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && <p className="field__error" role="alert"><AlertTriangle size={14} aria-hidden /> {error}</p>}
    </div>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn('input', p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cn('input', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cn('input', p.className)} />;

// ── Progress ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, label, tone = 'sage' }:
  { value: number; max?: number; label: string; tone?: 'sage' | 'clay' | 'forest' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <motion.div className={`progress__fill progress__fill--${tone}`} initial={{ width: 0 }}
        animate={{ width: `${pct}%`, transition: { duration: dur.slow, ease } }} />
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────
export const Skeleton = ({ h = 18, w = '100%', r = 12 }: { h?: number; w?: number | string; r?: number }) =>
  <span className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />;

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  const { t } = useT();
  return (
    <div className="card" aria-busy="true" aria-label={t('Loading')}>
      <Skeleton h={22} w="45%" />
      <div className="stack-sm" style={{ marginTop: 14 }}>
        {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} w={`${90 - i * 12}%`} />)}
      </div>
    </div>
  );
}

// ── Empty / error states ───────────────────────────────────────────────────
export function EmptyState({ title, body, action, mood = 'encouraging' }:
  { title: string; body: string; action?: ReactNode; mood?: MascotState }) {
  return (
    <div className="empty">
      <Mascot size="md" mood={mood} decorative />
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div className="notice notice--error" role="alert">
      <AlertTriangle size={18} aria-hidden />
      <div><strong>{t('Something went wrong.')}</strong><p>{t(message)}</p></div>
      {onRetry && <Button size="sm" variant="soft" onClick={onRetry}>{t('Try again')}</Button>}
    </div>
  );
}

export function Notice({ title, children, tone = 'info' }: { title: string; children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={cn('notice', tone === 'warn' && 'notice--warn')} role="note">
      <div><strong>{title}</strong><div className="notice__body">{children}</div></div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-back" onMouseDown={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: dur.fast } }}>
          <motion.div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}
            onMouseDown={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1, transition: spring }}
            exit={{ opacity: 0, y: 12, transition: { duration: dur.fast } }}>
            <header className="modal__head">
              <h2>{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label={t('Close')}><X size={18} /></button>
            </header>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Logo ───────────────────────────────────────────────────────────────────
export function Logo({ to = '/' }: { to?: string }) {
  const { t } = useT();
  return (
    <Link to={to} className="logo" aria-label={t('{name} home', { name: brand.name })}>
      <span className="logo__mark" aria-hidden>
        <img src="/favicon.png" width="40" height="40" alt="" />
      </span>
      <span>{brand.wordmark}</span>
    </Link>
  );
}

export function DemoBanner() {
  const { t } = useT();
  return (
    <div className="demo-banner" role="note">
      <strong>{t('Demo mode.')}</strong> {t('Supabase is not configured, so everything here stays in this browser only. Nothing is saved to a backend and the AI stylist is unavailable.')}
    </div>
  );
}

export function SetupNotice({ what, steps }: { what: string; steps: string[] }) {
  return (
    <div className="notice notice--warn" role="note">
      <div>
        <strong>{what}</strong>
        <ol className="notice__body">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
    </div>
  );
}
