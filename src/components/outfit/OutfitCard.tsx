import { useState } from 'react';
import { motion } from 'motion/react';
import { Bookmark, BookmarkCheck, MessageCircle, Share2, Shirt, CloudSun, Wallet, Info } from 'lucide-react';
import { COLOR_OPTIONS } from '@/config/options';
import { brand } from '@/config/brand';
import { Button } from '@/components/ui';
import { cn, outfitToText } from '@/lib/util';
import { fadeUp, hoverLift } from '@/lib/animations';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import type { OutfitData } from '@/types';

const FALLBACKS = [brand.palette.sage, brand.palette.forest, brand.palette.clay, '#E9E2D0'];

/** Common colour words in the supported reply languages → the canonical English palette name. */
const ALIASES: Record<string, string> = {
  noir: 'Black', negro: 'Black', schwarz: 'Black', nero: 'Black',
  blanc: 'White', blanco: 'White', weiss: 'White', weiß: 'White', bianco: 'White', crème: 'White', creme: 'White', cream: 'White', ivoire: 'White',
  beige: 'Beige', sable: 'Beige', camel: 'Beige',
  olive: 'Olive', oliva: 'Olive',
  sauge: 'Sage', salvia: 'Sage', salbei: 'Sage',
  forêt: 'Forest', foret: 'Forest', bosque: 'Forest', wald: 'Forest', bosco: 'Forest',
  marine: 'Navy', 'bleu nuit': 'Navy', azul: 'Navy', navy: 'Navy',
  gris: 'Grey', gray: 'Grey', grau: 'Grey', grigio: 'Grey',
  marron: 'Brown', brun: 'Brown', café: 'Brown', marrón: 'Brown', braun: 'Brown', marrone: 'Brown',
  terre: 'Terracotta', terracota: 'Terracotta', rouille: 'Terracotta', orange: 'Terracotta',
  bordeaux: 'Burgundy', burdeos: 'Burgundy', bordò: 'Burgundy', vin: 'Burgundy',
  denim: 'Denim blue', jean: 'Denim blue', vaquero: 'Denim blue',
  vert: 'Forest', verde: 'Sage', grün: 'Sage',
};
const BY_NAME = new Map(COLOR_OPTIONS.map((c) => [c.name.toLowerCase(), c.hex]));

export function colorToHex(name: string, i = 0): string {
  const n = name.toLowerCase();
  const direct = COLOR_OPTIONS.find((c) => n.includes(c.name.toLowerCase()));
  if (direct) return direct.hex;
  for (const [word, canonical] of Object.entries(ALIASES)) {
    if (n.includes(word)) return BY_NAME.get(canonical.toLowerCase()) ?? FALLBACKS[i % FALLBACKS.length];
  }
  return FALLBACKS[i % FALLBACKS.length];
}

/** A designed placeholder built from the outfit's own colour palette. It is NOT a generated photo. */
export function OutfitVisual({ outfit }: { outfit: OutfitData }) {
  const { t } = useT();
  const colors = (outfit.colorPalette.length ? outfit.colorPalette : outfit.pieces.map((p) => p.color ?? '')).slice(0, 5);
  const list = colors.length ? colors : ['sage', 'forest', 'beige'];
  return (
    <div className="ovisual" role="img" aria-label={t('Colour palette: {colors}. Illustration, not a photo.', { colors: list.join(', ') })}>
      {list.map((c, i) => (
        <motion.span key={`${c}-${i}`} style={{ background: colorToHex(c, i), flexGrow: i === 0 ? 2 : 1 }}
          initial={{ scaleY: 0.4, opacity: 0 }} animate={{ scaleY: 1, opacity: 1, transition: { delay: i * 0.06, duration: 0.4 } }}>
          <em>{c}</em>
        </motion.span>
      ))}
    </div>
  );
}

interface Props {
  outfit: OutfitData;
  saved?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onUnsave?: () => void;
  onAsk?: () => void;
  compact?: boolean;
}

export function OutfitCard({ outfit, saved, saving, onSave, onUnsave, onAsk, compact }: Props) {
  const { toast } = useToast();
  const { t } = useT();
  const [open, setOpen] = useState(false);

  const share = async () => {
    const text = outfitToText(outfit);
    try {
      if (navigator.share) await navigator.share({ title: outfit.name, text });
      else { await navigator.clipboard.writeText(text); toast(t('Outfit copied to your clipboard.'), 'success'); }
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') toast(t('Could not share this outfit.'), 'error');
    }
  };

  return (
    <motion.article variants={fadeUp} initial="hidden" animate="show" whileHover={hoverLift} className={cn('ocard', compact && 'ocard--compact')}>
      <OutfitVisual outfit={outfit} />
      <div className="ocard__body">
        <div className="tags">
          {outfit.occasion && <span className="tag">{outfit.occasion}</span>}
          {outfit.style && <span className="tag tag--sage">{outfit.style}</span>}
        </div>
        <h3>{outfit.name}</h3>

        <ul className="pieces">
          {outfit.pieces.map((p, i) => (
            <li key={`${p.name}-${i}`}>
              <Shirt size={14} aria-hidden />
              <span>{p.color ? `${p.color} ` : ''}{p.name}</span>
              {p.fromWardrobe && <span className="tag tag--clay">{t('From your wardrobe')}</span>}
            </li>
          ))}
          {outfit.outerwear && <li><Shirt size={14} aria-hidden /><span>{outfit.outerwear}</span></li>}
          {outfit.shoes && <li><Shirt size={14} aria-hidden /><span>{outfit.shoes}</span></li>}
          {outfit.accessories.length > 0 && <li><Shirt size={14} aria-hidden /><span>{outfit.accessories.join(', ')}</span></li>}
        </ul>

        <p className="why"><strong>{t('Why it works.')}</strong> {outfit.whyItWorks}</p>

        {!compact && (outfit.weatherNote || outfit.budgetNote || outfit.alternatives.length > 0 || outfit.caveats) && (
          <>
            <button className="link-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? t('Hide details') : t('More details & alternatives')}
            </button>
            {open && (
              <div className="details">
                {outfit.weatherNote && <p><CloudSun size={14} aria-hidden /> {outfit.weatherNote}</p>}
                {outfit.budgetNote && <p><Wallet size={14} aria-hidden /> {outfit.budgetNote} <em>({t('rough guidance, not checked prices')})</em></p>}
                {outfit.alternatives.length > 0 && (
                  <div><strong>{t('Alternatives')}</strong><ul>{outfit.alternatives.map((a) => <li key={a}>{a}</li>)}</ul></div>
                )}
                {outfit.caveats && <p><Info size={14} aria-hidden /> {outfit.caveats}</p>}
              </div>
            )}
          </>
        )}

        <div className="ocard__actions">
          {saved ? (
            <Button size="sm" variant="soft" icon={<BookmarkCheck size={16} />} onClick={onUnsave} disabled={!onUnsave}>{t('Saved')}</Button>
          ) : (
            <Button size="sm" variant="clay" icon={<Bookmark size={16} />} loading={saving} onClick={onSave} disabled={!onSave}>{t('Save outfit')}</Button>
          )}
          <Button size="sm" variant="ghost" icon={<Share2 size={16} />} onClick={share}>{t('Share')}</Button>
          {onAsk && <Button size="sm" variant="ghost" icon={<MessageCircle size={16} />} onClick={onAsk}>{t('Ask Sage')}</Button>}
        </div>
      </div>
    </motion.article>
  );
}
