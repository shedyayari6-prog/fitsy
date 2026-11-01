import { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, MapPin, Search } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useT, UI_LANGUAGES } from '@/i18n';
import { Button, Field, Input, Select, Notice, CardSkeleton } from '@/components/ui';
import { BudgetPicker, CategoryPicker, ColorPicker, OccasionPicker, ShoppingPicker, SizeFields, StylePicker } from '@/components/profile/Pickers';
import { MascotMessage } from '@/components/mascot/MascotMessage';
import { LANGUAGES } from '@/config/options';
import { listSavedOutfits } from '@/lib/data';
import { getWeatherProvider, type GeoResult } from '@/lib/weather';
import { errMessage } from '@/lib/util';
import type { Profile, SavedOutfit } from '@/types';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function ProfilePage() {
  const { profile, saveProfile } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, setLang } = useT();
  const [draft, setDraft] = useState<Profile | null>(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedOutfit[] | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installHelp, setInstallHelp] = useState<string | null>(null);
  const provider = getWeatherProvider();

  useEffect(() => { if (profile && !draft) setDraft(profile); }, [profile, draft]);
  useEffect(() => { void listSavedOutfits(user!.id).then(setSaved).catch(() => setSaved([])); }, [user]);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); setInstallHelp(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const topStyles = useMemo(() => {
    const m = new Map<string, number>();
    saved?.forEach((s) => { if (s.outfit.style) m.set(s.outfit.style, (m.get(s.outfit.style) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [saved]);

  if (!draft || !profile) return <div className="page"><CardSkeleton lines={5} /></div>;
  const set = (patch: Partial<Profile>) => setDraft({ ...draft, ...patch });
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  const save = async () => {
    setSaving(true);
    try {
      await saveProfile({
        display_name: draft.display_name?.trim() || null, preferred_language: draft.preferred_language,
        style_preferences: draft.style_preferences, preferred_occasions: draft.preferred_occasions,
        preferred_categories: draft.preferred_categories, preferred_colors: draft.preferred_colors,
        budget_preference: draft.budget_preference, shopping_preferences: draft.shopping_preferences, sizes: draft.sizes,
        location_city: draft.location_city, location_lat: draft.location_lat, location_lon: draft.location_lon,
        weather_enabled: draft.weather_enabled && draft.location_lat !== null,
      });
      toast(t('Profile saved.'), 'success');
    } catch (e) { toast(errMessage(e, t('Could not save your profile.')), 'error'); }
    finally { setSaving(false); }
  };

  const search = async () => {
    if (!provider || cityQuery.trim().length < 2) return;
    setGeoError(null);
    try {
      const r = await provider.geocode(cityQuery.trim());
      setResults(r);
      if (!r.length) setGeoError(t('No matching place found.'));
    } catch (e) { setGeoError(errMessage(e, t('Location search failed.'))); }
  };

  const installApp = async () => {
    if (!installPrompt) {
      const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      setInstallHelp(isAppleMobile
        ? t('On iPhone or iPad, tap Share, then choose Add to Home Screen.')
        : t('Open your browser menu and choose Install app or Add to Home Screen.'));
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <div className="page">
      <header className="page__head"><h1>{t('Your style profile')}</h1><p className="muted">{t('These answers shape every suggestion. Change them any time.')}</p></header>

      {!installed && <section className="card stack-sm" aria-labelledby="install-app-title">
        <h2 id="install-app-title" className="card__title">{t('Get the app on your phone')}</h2>
        <p className="muted small">{t('Install Fitsy on your home screen for quick access.')}</p>
        <div className="row">
          <Button variant="soft" icon={<Download size={16} />} onClick={() => void installApp()}>{t('Install Fitsy app')}</Button>
        </div>
        {installHelp && <p className="field__hint" role="status">{installHelp}</p>}
      </section>}

      <MascotMessage mood="happy" action={topStyles.length ? 'recommending' : 'idle'}>
        {topStyles.length ? t("You save {style} looks the most. I'll keep that in mind.", { style: topStyles[0][0].toLowerCase() }) : t("Save a few outfits and I'll show which styles you gravitate to.")}
      </MascotMessage>

      {topStyles.length > 0 && (
        <section className="card" aria-labelledby="ev"><h2 id="ev" className="card__title">{t('Styles you save most')}</h2>
          <ul className="bars">{topStyles.map(([s, n]) => <li key={s}><span>{s}</span><i style={{ width: `${(n / topStyles[0][1]) * 100}%` }} aria-hidden /><b>{n}</b></li>)}</ul>
        </section>
      )}

      <section className="card stack" aria-labelledby="basic">
        <h2 id="basic" className="card__title">{t('Basics')}</h2>
        <div className="grid-2">
          <Field label={t('Name or nickname')} htmlFor="p-name"><Input id="p-name" value={draft.display_name ?? ''} maxLength={60} onChange={(e) => set({ display_name: e.target.value })} /></Field>
          <Field label={t('Language')} htmlFor="p-lang"
            hint={UI_LANGUAGES.includes(draft.preferred_language) ? undefined : t("Sage's replies will use this language. The app interface is available in English, Français and Arabic for now.")}>
            <Select id="p-lang" value={draft.preferred_language} onChange={(e) => { set({ preferred_language: e.target.value }); setLang(e.target.value); }}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
          </Field>
        </div>
      </section>

      <section className="card stack" aria-labelledby="sty"><h2 id="sty" className="card__title">{t('Styles')}</h2>
        <StylePicker value={draft.style_preferences} onChange={(v) => set({ style_preferences: v })} /></section>
      <section className="card stack" aria-labelledby="occ"><h2 id="occ" className="card__title">{t('Occasions & categories')}</h2>
        <OccasionPicker value={draft.preferred_occasions} onChange={(v) => set({ preferred_occasions: v })} />
        <CategoryPicker value={draft.preferred_categories} onChange={(v) => set({ preferred_categories: v })} /></section>
      <section className="card stack" aria-labelledby="col"><h2 id="col" className="card__title">{t('Colours & budget')}</h2>
        <ColorPicker value={draft.preferred_colors} onChange={(v) => set({ preferred_colors: v })} />
        <BudgetPicker value={draft.budget_preference} onChange={(v) => set({ budget_preference: v })} /></section>
      <section className="card stack" aria-labelledby="shop"><h2 id="shop" className="card__title">{t('Shopping & sizes')} <span className="muted small">({t('optional')})</span></h2>
        <ShoppingPicker value={draft.shopping_preferences} onChange={(v) => set({ shopping_preferences: v })} />
        <SizeFields value={draft.sizes} onChange={(v) => set({ sizes: v })} /></section>

      <section className="card stack" aria-labelledby="loc"><h2 id="loc" className="card__title"><MapPin size={18} aria-hidden /> {t('Weather location')} <span className="muted small">({t('optional')})</span></h2>
        {!provider ? <Notice title={t('Weather is switched off')}>{t('No weather provider is configured for this deployment.')}</Notice> : (
          <>
            <p>{draft.location_city ? <>{t('Current city:')} <strong>{draft.location_city}</strong>. </> : `${t('No city set.')} `}
              {draft.location_city && <button className="link-btn" onClick={() => set({ location_city: null, location_lat: null, location_lon: null, weather_enabled: false })}>{t('Remove')}</button>}</p>
            <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void search(); }}>
              <label className="sr-only" htmlFor="p-city">{t('Search for a city')}</label>
              <Input id="p-city" value={cityQuery} placeholder={t('Search for a city')} onChange={(e) => setCityQuery(e.target.value)} />
              <Button type="submit" variant="soft" icon={<Search size={16} />}>{t('Search')}</Button>
            </form>
            {geoError && <p className="field__error" role="alert">{geoError}</p>}
            {results && results.length > 0 && (
              <ul className="results">{results.map((r) => (
                <li key={`${r.lat}-${r.lon}`}><button type="button" className="option" onClick={() => {
                  set({ location_city: r.city, location_lat: Math.round(r.lat * 100) / 100, location_lon: Math.round(r.lon * 100) / 100, weather_enabled: true }); setResults(null);
                }}>{r.city}{r.country ? `, ${r.country}` : ''}</button></li>
              ))}</ul>
            )}
          </>
        )}
      </section>

      <div className="savebar">
        <span className="muted small">{dirty ? t('You have unsaved changes.') : t('All changes saved.')}</span>
        <Button onClick={() => void save()} loading={saving} disabled={!dirty}>{t('Save changes')}</Button>
      </div>
      <p className="muted small"><a href="https://vintrexshop.store" target="_blank" rel="noopener noreferrer">Vintrex Shop <ExternalLink size={13} aria-hidden style={{ verticalAlign: '-2px' }} /></a></p>
    </div>
  );
}
