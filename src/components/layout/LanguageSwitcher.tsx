import { Languages } from 'lucide-react';
import { LANGUAGES } from '@/config/options';
import { UI_LANGUAGES, useT } from '@/i18n';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useT();
  return (
    <label className="language-switcher">
      <Languages size={17} aria-hidden="true" />
      <span className="sr-only">{t('Language')}</span>
      <select aria-label={t('Language')} value={lang} onChange={(e) => setLang(e.target.value)}>
        {LANGUAGES.filter((language) => UI_LANGUAGES.includes(language.code)).map((language) => (
          <option key={language.code} value={language.code}>{language.label}</option>
        ))}
      </select>
    </label>
  );
}