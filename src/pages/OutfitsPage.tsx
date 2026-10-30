import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, Wand2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { Button, CardSkeleton, Chip, EmptyState, ErrorNotice, LinkButton, Select, Field } from '@/components/ui';
import { OutfitCard } from '@/components/outfit/OutfitCard';
import { MascotMessage } from '@/components/mascot/MascotMessage';
import { listSavedOutfits, removeSavedOutfit, setFavorite } from '@/lib/data';
import { OCCASION_OPTIONS } from '@/config/options';
import { errMessage } from '@/lib/util';
import { stagger } from '@/lib/animations';
import type { SavedOutfit } from '@/types';

export default function OutfitsPage() {
  const { user } = useAuth();
  const { profile } = useApp();
  const { toast } = useToast();
  const { t } = useT();
  const nav = useNavigate();
  const [items, setItems] = useState<SavedOutfit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [occasion, setOccasion] = useState('');
  const [style, setStyle] = useState('');
  const [color, setColor] = useState('');
  const [onlyFav, setOnlyFav] = useState(false);
  const uid = user!.id;

  const load = useCallback(async () => {
    setError(null);
    try { setItems(await listSavedOutfits(uid)); } catch (e) { setError(errMessage(e, t('Could not load your outfits.'))); }
  }, [uid, t]);
  useEffect(() => { void load(); }, [load]);

  const styles = useMemo(() => [...new Set((items ?? []).map((i) => i.outfit.style).filter(Boolean))] as string[], [items]);
  const colors = useMemo(() => [...new Set((items ?? []).flatMap((i) => i.outfit.outfit_data.colorPalette.map((c) => c.toLowerCase())))].sort(), [items]);

  const shown = (items ?? []).filter((i) =>
    (!occasion || i.outfit.occasion === occasion) &&
    (!style || i.outfit.style === style) &&
    (!color || i.outfit.outfit_data.colorPalette.some((c) => c.toLowerCase() === color)) &&
    (!onlyFav || i.is_favorite));

  const remove = async (s: SavedOutfit) => {
    try { await removeSavedOutfit(uid, s); setItems((x) => (x ?? []).filter((i) => i.id !== s.id)); toast(t('Outfit removed.'), 'info'); }
    catch (e) { toast(errMessage(e, t('Could not remove that outfit.')), 'error'); }
  };
  const fav = async (s: SavedOutfit) => {
    try { await setFavorite(uid, s, !s.is_favorite); setItems((x) => (x ?? []).map((i) => (i.id === s.id ? { ...i, is_favorite: !i.is_favorite } : i))); }
    catch (e) { toast(errMessage(e, t('Could not update favourites.')), 'error'); }
  };

  const ask = (prompt: string) => nav('/app/stylist', { state: { prompt } });
  const quick = (profile?.preferred_occasions.length ? profile.preferred_occasions : OCCASION_OPTIONS.slice(0, 5));

  return (
    <div className="page">
      <header className="page__head">
        <h1>{t('Outfits')}</h1>
        <p className="muted">{t('Your saved looks. New ideas come from conversations with Sage.')}</p>
      </header>

      <section className="card card--sage" aria-labelledby="new-h">
        <h2 id="new-h" className="card__title"><Wand2 size={18} aria-hidden /> {t('Get fresh ideas')}</h2>
        <div className="chips">
          {quick.map((o) => <Chip key={o} onClick={() => ask(t('Suggest an outfit for {occasion}.', { occasion: t(o).toLowerCase() }))}>{t(o)}</Chip>)}
          <Button size="sm" variant="clay" onClick={() => ask(t('Create an outfit from my wardrobe.'))}>{t('From my wardrobe')}</Button>
        </div>
      </section>

      {error && <ErrorNotice message={error} onRetry={() => void load()} />}

      {items === null && !error && <div className="ocards"><CardSkeleton lines={5} /><CardSkeleton lines={5} /></div>}

      {items && items.length === 0 && (
        <EmptyState title={t('No saved outfits yet')} mood="recommending"
          body={t("Ask Sage for a look and tap “Save outfit” on the ones you love. They'll collect here.")}
          action={<LinkButton to="/app/stylist">{t('Ask Sage')}</LinkButton>} />
      )}

      {items && items.length > 0 && (
        <>
          <div className="filters" role="search" aria-label={t('Filter saved outfits')}>
            <Field label={t('Occasion')} htmlFor="f-occ">
              <Select id="f-occ" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
                <option value="">{t('All')}</option>
                {[...new Set(items.map((i) => i.outfit.occasion).filter(Boolean))].map((o) => <option key={o}>{o}</option>)}
              </Select>
            </Field>
            <Field label={t('Style')} htmlFor="f-sty">
              <Select id="f-sty" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="">{t('All')}</option>{styles.map((s) => <option key={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label={t('Colour')} htmlFor="f-col">
              <Select id="f-col" value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="">{t('All')}</option>{colors.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Chip selected={onlyFav} onClick={() => setOnlyFav((v) => !v)}><Heart size={14} aria-hidden /> {t('Favourites')}</Chip>
          </div>
          <p className="muted small">{t('Season and budget filters appear once outfits carry that data.')}</p>

          {shown.length === 0 ? (
            <MascotMessage mood="sad" action="sad">{t('Nothing matches those filters. Try clearing one.')}</MascotMessage>
          ) : (
            <motion.div className="ocards ocards--grid" variants={stagger(0.08)} initial="hidden" animate="show">
              {shown.map((s) => (
                <div key={s.id} className="ocard-wrap">
                  <OutfitCard outfit={s.outfit.outfit_data} saved onUnsave={() => void remove(s)}
                    onAsk={() => ask(t('Tell me more about "{name}" and how to vary it.', { name: s.outfit.title }))} />
                  <Button size="sm" variant={s.is_favorite ? 'clay' : 'ghost'} icon={<Heart size={14} />} onClick={() => void fav(s)}
                    aria-pressed={s.is_favorite}>{s.is_favorite ? t('Favourite') : t('Add to favourites')}</Button>
                </div>
              ))}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
