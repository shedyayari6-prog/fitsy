import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, MapPin, Search, Check } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useT, UI_LANGUAGES } from '@/i18n';
import { Button, Field, Input, Notice, ProgressBar, Select, Logo } from '@/components/ui';
import { MascotStage } from '@/components/mascot/MascotStage';
import { FullScreenLoader } from '@/components/layout/Guards';
import { BudgetPicker, CategoryPicker, ColorPicker, OccasionPicker, ShoppingPicker, SizeFields, StylePicker } from '@/components/profile/Pickers';
import { CATEGORY_OPTIONS, LANGUAGES } from '@/config/options';
import { getWeatherProvider, type GeoResult } from '@/lib/weather';
import { saveWardrobeItem } from '@/lib/data';
import { errMessage } from '@/lib/util';
import { stepSlide } from '@/lib/animations';
import type { MascotState, Profile, WardrobeCategory } from '@/types';

interface StepDef { title: string; message: string; mood: MascotState; action: MascotState }

export default function OnboardingPage() {
  const { profile, saveProfile, tryComplete } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, lang, setLang } = useT();
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<Profile>>({});

  // wardrobe quick-add
  const [pieceName, setPieceName] = useState('');
  const [pieceCat, setPieceCat] = useState<WardrobeCategory>('tops');
  // weather
  const [cityQuery, setCityQuery] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  if (!profile || !user) return <FullScreenLoader />;
  if (profile.onboarding_completed) return <Navigate to="/app" replace />;

  const STEPS: StepDef[] = [
    { title: t('First, what should I call you?'), message: t("Hi! I'm Sage, your personal stylist. What's your name or nickname?"), mood: 'happy', action: 'greeting' },
    { title: t('What styles speak to you?'), message: t('Pick as many as you like. There are no wrong answers.'), mood: 'excited', action: 'recommending' },
    { title: t('Where do you need outfits?'), message: t('Tell me about your usual occasions and the kinds of clothes you wear.'), mood: 'happy', action: 'thinking' },
    { title: t('Colours and budget'), message: t('Colours you love make styling so much easier.'), mood: 'encouraging', action: 'encouraging' },
    { title: t('How do you like to shop?'), message: t('Totally optional. Sizes are only used to keep advice relevant.'), mood: 'happy', action: 'idle' },
    { title: t('Weather and your first piece'), message: t("Last step, and both parts are optional. You're doing great!"), mood: 'excited', action: 'excited' },
  ];

  const p = { ...profile, ...draft } as Profile;
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));
  const def = STEPS[step];
  const last = step === STEPS.length - 1;
  const weatherProvider = getWeatherProvider();

  const go = (d: 1 | -1) => { setDir(d); setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + d))); };

  const searchCity = async () => {
    if (!weatherProvider || cityQuery.trim().length < 2) return;
    setSearching(true); setGeoError(null);
    try {
      const r = await weatherProvider.geocode(cityQuery.trim());
      setResults(r);
      if (!r.length) setGeoError(t('No matching place found. Try another spelling or skip this step.'));
    } catch (e) {
      setGeoError(errMessage(e, t('Location search failed.')));
    } finally { setSearching(false); }
  };

  const finish = async () => {
    setSaving(true);
    try {
      await saveProfile({
        display_name: (p.display_name ?? '').trim() || null,
        preferred_language: p.preferred_language,
        style_preferences: p.style_preferences, preferred_occasions: p.preferred_occasions,
        preferred_categories: p.preferred_categories, preferred_colors: p.preferred_colors,
        budget_preference: p.budget_preference, shopping_preferences: p.shopping_preferences, sizes: p.sizes,
        location_city: p.location_city, location_lat: p.location_lat, location_lon: p.location_lon,
        weather_enabled: p.weather_enabled && p.location_lat !== null,
        onboarding_completed: true,
      });
      if (pieceName.trim()) {
        await saveWardrobeItem(user.id, {
          name: pieceName.trim().slice(0, 80), category: pieceCat, color: null, season: 'all',
          style_tags: [], image_path: null, brand: null, purchase_price: null, notes: null,
        });
      }
      await tryComplete('complete_profile');
      nav('/app', { replace: true });
    } catch (e) {
      toast(errMessage(e, t('Could not save your profile. Please try again.')), 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="onb">
      <header className="onb__top">
        <Logo to="/" />
        <span className="muted small">{t('Step {n} of {total}', { n: step + 1, total: STEPS.length })}</span>
      </header>
      <ProgressBar value={step + 1} max={STEPS.length} label={t('Onboarding progress')} tone="clay" />

      <div className="onb__grid">
        <MascotStage className="onb__stage" size="lg" mood={def.mood} action={saving ? 'victory' : def.action} bubbleKey={`${step}-${lang}`} bubble={def.message} />

        <main id="main" className="onb__panel">
          <AnimatePresence mode="wait" initial={false}>
            <motion.section key={step} {...stepSlide(dir)} className="stack">
              <h1>{def.title}</h1>

              {step === 0 && (
                <>
                  <Field label={t('Name or nickname')} htmlFor="nick" hint={t('Optional. You can change it any time.')}>
                    <Input id="nick" value={p.display_name ?? ''} maxLength={60} autoComplete="nickname"
                      onChange={(e) => set({ display_name: e.target.value })} />
                  </Field>
                  <Field label={t("Language")} htmlFor="lang"
                    hint={UI_LANGUAGES.includes(p.preferred_language)
                      ? t("The whole app and Sage's replies switch to this language right away.")
                      : t("Sage's replies will use this language. The app interface is available in English and Français for now.")}>
                    <Select id="lang" value={p.preferred_language} onChange={(e) => { set({ preferred_language: e.target.value }); setLang(e.target.value); }}>
                      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </Select>
                  </Field>
                </>
              )}

              {step === 1 && <StylePicker value={p.style_preferences} onChange={(v) => set({ style_preferences: v })} />}

              {step === 2 && (
                <>
                  <h2 className="h3">{t('Occasions')}</h2>
                  <OccasionPicker value={p.preferred_occasions} onChange={(v) => set({ preferred_occasions: v })} />
                  <h2 className="h3">{t('Clothing categories')}</h2>
                  <CategoryPicker value={p.preferred_categories} onChange={(v) => set({ preferred_categories: v })} />
                </>
              )}

              {step === 3 && (
                <>
                  <h2 className="h3">{t('Favourite colours')}</h2>
                  <ColorPicker value={p.preferred_colors} onChange={(v) => set({ preferred_colors: v })} />
                  <h2 className="h3">{t('Budget range')}</h2>
                  <BudgetPicker value={p.budget_preference} onChange={(v) => set({ budget_preference: v })} />
                </>
              )}

              {step === 4 && (
                <>
                  <h2 className="h3">{t('Shopping preferences')}</h2>
                  <ShoppingPicker value={p.shopping_preferences} onChange={(v) => set({ shopping_preferences: v })} />
                  <h2 className="h3">{t('Sizes')} <span className="muted small">({t('optional')})</span></h2>
                  <SizeFields value={p.sizes} onChange={(v) => set({ sizes: v })} />
                </>
              )}

              {step === 5 && (
                <>
                  <h2 className="h3">{t('Weather-aware outfits')} <span className="muted small">({t('optional')})</span></h2>
                  {!weatherProvider ? (
                    <Notice title={t('Weather is switched off')}>{t('This deployment has no weather provider configured.')}</Notice>
                  ) : p.location_city && p.location_lat !== null ? (
                    <div className="notice" role="status">
                      <Check size={18} aria-hidden />
                      <div><strong>{p.location_city}</strong><p>{t('Weather will help shape your suggestions.')}</p></div>
                      <Button size="sm" variant="ghost" onClick={() => set({ location_city: null, location_lat: null, location_lon: null, weather_enabled: false })}>{t('Change')}</Button>
                    </div>
                  ) : (
                    <>
                      <p className="muted">{t('Type a city. We never ask for your device location.')}</p>
                      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); void searchCity(); }}>
                        <label className="sr-only" htmlFor="city">{t('City')}</label>
                        <Input id="city" value={cityQuery} placeholder={t('e.g. Tunis')} onChange={(e) => setCityQuery(e.target.value)} />
                        <Button type="submit" variant="soft" loading={searching} icon={<Search size={16} />}>{t('Search')}</Button>
                      </form>
                      {geoError && <p className="field__error" role="alert">{geoError}</p>}
                      {results && results.length > 0 && (
                        <ul className="results" aria-label={t('Matching places')}>
                          {results.map((r) => (
                            <li key={`${r.lat}-${r.lon}`}>
                              <button type="button" className="option" onClick={() => {
                                set({ location_city: r.city, location_lat: Math.round(r.lat * 100) / 100, location_lon: Math.round(r.lon * 100) / 100, weather_enabled: true });
                                setResults(null);
                              }}>
                                <MapPin size={16} aria-hidden /> {r.city}{r.country ? `, ${r.country}` : ''}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}

                  <h2 className="h3">{t('Add a first piece to your wardrobe')} <span className="muted small">({t('optional')})</span></h2>
                  <div className="inline-form">
                    <label className="sr-only" htmlFor="piece">{t('Item name')}</label>
                    <Input id="piece" value={pieceName} maxLength={80} placeholder={t('e.g. Beige jacket')} onChange={(e) => setPieceName(e.target.value)} />
                    <label className="sr-only" htmlFor="piece-cat">{t('Category')}</label>
                    <Select id="piece-cat" value={pieceCat} onChange={(e) => setPieceCat(e.target.value as WardrobeCategory)}>
                      {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
                    </Select>
                  </div>
                  <p className="muted small">{t('You can add photos and more pieces later in your Wardrobe.')}</p>
                </>
              )}
            </motion.section>
          </AnimatePresence>

          <div className="onb__nav">
            <Button variant="ghost" onClick={() => go(-1)} disabled={step === 0 || saving} icon={<ArrowLeft size={18} />}>{t('Back')}</Button>
            {last ? (
              <Button variant="clay" size="lg" loading={saving} onClick={() => void finish()}>{t('Finish setup')}</Button>
            ) : (
              <Button size="lg" onClick={() => go(1)} icon={<ArrowRight size={18} />}>{t('Next')}</Button>
            )}
          </div>
          {!last && <p className="muted small center">{t('Everything here is optional. Skip ahead whenever you like.')}</p>}
        </main>
      </div>
    </div>
  );
}
