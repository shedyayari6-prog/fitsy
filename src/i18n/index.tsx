import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fr } from './fr';

/**
 * Tiny i18n layer. The English text IS the key: t('Find Your Style').
 * - Missing translations fall back to the English text automatically.
 * - Placeholders use {name}: t('Hi {name}', { name }).
 * To add a language: create src/i18n/<code>.ts exporting a Record<string,string> and register it in DICTS.
 */
const DICTS: Record<string, Record<string, string>> = { fr };

/** Languages whose interface is translated. Others still get Sage's replies in that language. */
export const UI_LANGUAGES = ['en', ...Object.keys(DICTS)];

type Vars = Record<string, string | number>;
export type TFn = (text: string, vars?: Vars) => string;

const KEY = 'sage.lang';

function initial(): string {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved;
    const nav = navigator.language?.slice(0, 2);
    if (nav && UI_LANGUAGES.includes(nav)) return nav;
  } catch { /* storage unavailable */ }
  return 'en';
}

interface Ctx { lang: string; setLang: (l: string) => void; t: TFn; translated: boolean }
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<string>(initial);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const setLang = useCallback((l: string) => setLangState(l), []);

  const t = useCallback<TFn>((text, vars) => {
    const out = DICTS[lang]?.[text] ?? text;
    return vars ? out.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : out;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, translated: lang === 'en' || lang in DICTS }), [lang, setLang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx;
}
