import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { useSettings } from "@/hooks/useSettings";
import mascot from "./fitsy-mascot.png";
import "./FitsyPromoAd.css";

export const WHATSAPP_NUMBER = "393508653895";

export const WHATSAPP_DISPLAY = "+39 350 865 3895";

type Props = {
  /** Override the number per use (defaults to WHATSAPP_NUMBER). */
  number?: string;
  /** If true, a closed ad stays closed for the rest of the browser session. */
  rememberDismissal?: boolean;
};

const STORAGE_KEY = "fitsy-promo-dismissed";
const AD_COPY = {
  en: {
    label: "Fitsy clothing customization offer",
    close: "Close advertisement",
    greeting: "Hi! 👋",
    title: "Want a more professional look for your clothes?",
    text: "Get personalized clothing customization from a professional!",
    contact: "Contact us on WhatsApp:",
    ariaContact: "Contact us on WhatsApp at",
  },
  fr: {
    label: "Offre de personnalisation de vêtements Fitsy",
    close: "Fermer la publicité",
    greeting: "Salut ! 👋",
    title: "Envie d’un style plus professionnel pour vos vêtements ?",
    text: "Profitez d’une personnalisation de vêtements par un professionnel !",
    contact: "Contactez-nous sur WhatsApp :",
    ariaContact: "Contactez-nous sur WhatsApp au",
  },
  ar: {
    label: "عرض Fitsy لتخصيص الملابس",
    close: "إغلاق الإعلان",
    greeting: "مرحبًا! 👋",
    title: "هل ترغب في إطلالة أكثر احترافية لملابسك؟",
    text: "احصل على تخصيص ملابس يناسبك على يد محترف!",
    contact: "تواصل معنا عبر واتساب:",
    ariaContact: "تواصل معنا عبر واتساب على الرقم",
  },
} as const;

export default function FitsyPromoAd({
  number = WHATSAPP_NUMBER,
  rememberDismissal = false,
}: Props) {
  const { lang } = useT();
  const [settings] = useSettings();
  const language = lang in AD_COPY ? (lang as keyof typeof AD_COPY) : "en";
  const copy = AD_COPY[language];
  const [open, setOpen] = useState<boolean>(() => {
    if (!rememberDismissal) return true;
    try {
      return sessionStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    if (rememberDismissal) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* storage unavailable: ignore */
      }
    }
  };

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setOpen(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !settings.promoAdSound) return;
    const sound = new Audio("/popup.mp3");
    sound.volume = 0.65;
    void sound.play().catch(() => undefined);
  }, [open, settings.promoAdSound]);

  // Keyboard users can also dismiss with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const digits = number.replace(/\D/g, "");
  const href = `https://wa.me/${digits}`;
  const shown = WHATSAPP_DISPLAY || `+${digits}`;

  return (
    <aside
      className="fpa"
      role="complementary"
      aria-label={copy.label}
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <button
        ref={closeRef}
        type="button"
        className="fpa__close"
        onClick={close}
        aria-label={copy.close}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="fpa__stage" aria-hidden="true">
        {/* floating clothing / customization icons */}
        <svg className="fpa__icon fpa__icon--shirt" viewBox="0 0 48 48">
          <path
            d="M16 6l-11 7 5 9 5-3v23h22V19l5 3 5-9-11-7c-1 4-4 6-8 6s-7-2-8-6z"
            fill="#fff"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M17 38h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 3"
            strokeLinecap="round"
          />
        </svg>
        <svg className="fpa__icon fpa__icon--star" viewBox="0 0 24 24">
          <path
            d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"
            fill="currentColor"
          />
        </svg>
        <svg className="fpa__icon fpa__icon--star2" viewBox="0 0 24 24">
          <path
            d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.1 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"
            fill="currentColor"
          />
        </svg>
        <svg className="fpa__icon fpa__icon--needle" viewBox="0 0 48 48">
          <path
            d="M8 40L38 8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <ellipse cx="36" cy="10.5" rx="1.6" ry="4" transform="rotate(45 36 10.5)" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
          <path
            className="fpa__thread"
            d="M35 12c-8 6 4 10-4 16s4 8-4 12"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>

        <span className="fpa__bubble">{copy.greeting}</span>

        <div className="fpa__mascot-wrap">
          <img
            className="fpa__mascot"
            src={mascot}
            alt=""
            width={150}
            height={225}
            decoding="async"
          />
          <span className="fpa__shadow" />
        </div>

        {/* stitched line under the mascot */}
        <svg className="fpa__stitch" viewBox="0 0 200 8" preserveAspectRatio="none">
          <path
            d="M2 4h196"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="7 7"
          />
        </svg>
      </div>

      <div className="fpa__body">
        <h2 className="fpa__title">{copy.title}</h2>
        <p className="fpa__text">{copy.text}</p>

        <p className="fpa__label">{copy.contact}</p>
        <a
          className="fpa__cta"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${copy.ariaContact} ${shown}`}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.2-1.200l-.3-.2-3 .8.8-2.900-.2-.3A8.200 8.200 0 1112 20.200zm4.500-6.100c-.2-.1-1.500-.7-1.700-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.200-.3.200-.5.100-1.400-.7-2.400-1.300-3.300-2.900-.2-.3.200-.3.600-1.100.1-.2 0-.4 0-.5l-.8-1.900c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.100-.7.300-.7.700-1 1.500-.9 2.400.2 1.100.7 2 1.500 2.900 1.300 1.600 3 2.800 5 3.400.9.300 1.600.2 2.200-.1.700-.4 1.100-1.100 1.200-1.800 0-.2 0-.3-.2-.4z"
            />
          </svg>
          <span className="fpa__number">{shown}</span>
        </a>
      </div>
    </aside>
  );
}
