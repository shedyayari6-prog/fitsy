import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';

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

const WHATSAPP_URL = 'https://wa.me/3508653895';

export function DesignerHelp() {
  const [messageIndex, setMessageIndex] = useState(0);
  const current = MESSAGES[messageIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % MESSAGES.length);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const advanceMessage = () => setMessageIndex((index) => (index + 1) % MESSAGES.length);

  return (
    <aside className="designer-help" aria-label="Designer help">
      <button
        className="designer-help__image"
        type="button"
        onClick={advanceMessage}
        aria-label={`Change message language. Current language: ${current.label}`}
        title={`${current.label} · click to change language`}
      >
        <img src="/mascot/streak_growing.png" alt="" width="344" height="492" />
      </button>
      <div className="designer-help__message" lang={current.lang} dir={current.lang === 'ar' ? 'rtl' : 'ltr'}>
        <p>{current.message}</p>
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
          {current.contact} <span>3508653895</span> <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}