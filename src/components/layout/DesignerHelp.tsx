import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { brand } from '@/config/brand';

const MESSAGES = [
  {
    lang: 'ar',
    label: 'العربية',
    message: 'إذا كنت بحاجة إلى تخصيص أفضل، احصل على مساعدة من مصمم محترف.',
    contact: 'تواصل معنا عبر واتساب',
  },
  {
    lang: 'it',
    label: 'Italiano',
    message: 'Per una personalizzazione migliore, chiedi aiuto a un designer professionista.',
    contact: 'Contattaci su WhatsApp',
  },
  {
    lang: 'fr',
    label: 'Français',
    message: 'Pour une personnalisation plus poussée, faites appel à un designer professionnel.',
    contact: 'Contactez-nous sur WhatsApp',
  },
  {
    lang: 'en',
    label: 'English',
    message: 'Need more tailored customization? Get help from a professional designer.',
    contact: 'Contact us on WhatsApp',
  },
];

const POSITION_KEY = 'fitsy.designer-help.position';

interface Position { x: number; y: number }
interface DragState {
  pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean;
  lastX: number; lastY: number; shakeAxis: 'x' | 'y' | null; shakeDirection: number; shakeReversals: number;
  shakeDistance: number; shakeStartedAt: number;
}

function savedPosition(): Position | null {
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Position;
    return Number.isFinite(value.x) && Number.isFinite(value.y) ? value : null;
  } catch { return null; }
}

export function DesignerHelp() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [position, setPosition] = useState<Position | null>(savedPosition);
  const [shaken, setShaken] = useState(false);
  const widgetRef = useRef<HTMLElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickUntil = useRef(0);
  const current = MESSAGES[messageIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % MESSAGES.length);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
      lastX: event.clientX,
      lastY: event.clientY,
      shakeAxis: null,
      shakeDirection: 0,
      shakeReversals: 0,
      shakeDistance: 0,
      shakeStartedAt: Date.now(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    const widget = widgetRef.current;
    if (!drag || !widget || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const stepX = event.clientX - drag.lastX;
    const stepY = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    const axis = Math.abs(stepX) >= Math.abs(stepY) ? 'x' : 'y';
    const step = axis === 'x' ? stepX : stepY;
    if (Math.abs(step) >= 6) {
      const direction = Math.sign(step);
      if (Date.now() - drag.shakeStartedAt > 1800) {
        drag.shakeStartedAt = Date.now();
        drag.shakeReversals = 0;
        drag.shakeDistance = 0;
        drag.shakeAxis = null;
      }
      if (drag.shakeAxis === axis && drag.shakeDirection !== direction) drag.shakeReversals += 1;
      drag.shakeAxis = axis;
      drag.shakeDirection = direction;
      drag.shakeDistance += Math.abs(step);
      if (drag.shakeReversals >= 5 && drag.shakeDistance >= 100) setShaken(true);
    }
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - widget.offsetWidth, drag.originX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - widget.offsetHeight, drag.originY + dy)),
    });
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (drag.moved) {
      suppressClickUntil.current = Date.now() + 350;
      setPosition((next) => {
        if (next) {
          try { localStorage.setItem(POSITION_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
        }
        return next;
      });
    }
  };

  const advanceMessage = () => {
    if (Date.now() < suppressClickUntil.current) return;
    if (shaken) {
      setShaken(false);
      return;
    }
    setMessageIndex((index) => (index + 1) % MESSAGES.length);
  };

  return (
    <aside ref={widgetRef} className="designer-help" aria-label="Designer help"
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}>
      <button
        className="designer-help__image"
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={advanceMessage}
        aria-label={shaken ? 'Restore designer help message' : `Change message language. Current language: ${current.label}`}
        title={shaken ? 'Click to restore' : `${current.label} · click to change language`}
      >
        <img src={shaken ? '/mascot/crying.png' : '/mascot/streak_growing.png'} alt="" width="344" height="492" />
      </button>
      {!shaken && <div className="designer-help__message" lang={current.lang} dir={current.lang === 'ar' ? 'rtl' : 'ltr'}>
        <p>{current.message}</p>
        <a href={brand.whatsappUrl} target="_blank" rel="noreferrer noopener">
          {current.contact} <span>+39 350 865 3895</span> <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>}
    </aside>
  );
}