import { useEffect, useState } from 'react';
import { MapPin, Clock } from 'lucide-react';
import { storeImageUrl, daysLeft, countryName, CONDITIONS, type Match } from '@/lib/store';
import { CATEGORY_OPTIONS } from '@/config/options';
import { useT } from '@/i18n';
import type { StoreListing } from '@/types';

export function StoreImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    setBad(false);
    void storeImageUrl(path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path]);
  if (!url || bad) return <div className="listing__ph" aria-hidden>{alt.slice(0, 1).toUpperCase()}</div>;
  return <img src={url} alt={alt} className="listing__img" onError={() => setBad(true)} />;
}

export const money = (l: Pick<StoreListing, 'price' | 'currency'>, lang: string) => {
  try { return new Intl.NumberFormat(lang, { style: 'currency', currency: l.currency, maximumFractionDigits: l.price % 1 ? 2 : 0 }).format(l.price); }
  catch { return `${l.price} ${l.currency}`; }
};

export function ListingCard({ l, match, onOpen }: { l: StoreListing; match?: Match; onOpen: () => void }) {
  const { t, lang } = useT();
  const left = daysLeft(l);
  const cond = CONDITIONS.find((c) => c.value === l.condition)?.label ?? l.condition;
  return (
    <li className="listing">
      <button type="button" className="listing__btn" onClick={onOpen} aria-label={t('View {name}', { name: l.title })}>
        <div className="listing__media">
          <StoreImage path={l.image_path} alt={l.title} />
          {l.status === 'sold' && <span className="listing__sold">{t('Sold')}</span>}
          {match && match.score > 0 && l.status === 'active' && <span className="listing__match">{t('Matches you')}</span>}
        </div>
        <div className="listing__body">
          <strong className="listing__price">{money(l, lang)}</strong>
          <span className="listing__title">{l.title}</span>
          <span className="listing__meta">{t(CATEGORY_OPTIONS.find((c) => c.value === l.category)?.label ?? 'Other')} · {l.size} · {t(cond)}</span>
          <span className="listing__meta"><MapPin size={13} aria-hidden /> {l.city}, {countryName(l.country, lang)}</span>
          <span className="listing__meta"><Clock size={13} aria-hidden /> {t(left === 1 ? '{n} day left' : '{n} days left', { n: left })}</span>
        </div>
      </button>
    </li>
  );
}
