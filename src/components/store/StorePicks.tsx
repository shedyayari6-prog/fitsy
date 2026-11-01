import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Store as StoreIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { useT } from '@/i18n';
import { StoreImage, money } from '@/components/store/StoreBits';
import { approximateLocation, liveListings, matchListing, type Geo } from '@/lib/store';
import { pickStoreItems } from '@/lib/storePicks';
import type { OutfitData, StoreListing } from '@/types';

const GEO_PREF = 'fitsy.useGeo';
const NO_GEO: Geo = { country: null, city: null };

/**
 * "From the Fitsy Store": real, live listings that fill the pieces an outfit still needs.
 * Renders nothing when there is nothing relevant (or no store), so it is safe on any outfit card.
 */
export function StorePicks({ outfit, max = 4 }: { outfit: OutfitData; max?: number }) {
  const { user, demo } = useAuth();
  const { profile } = useApp();
  const { t, lang } = useT();
  const [listings, setListings] = useState<StoreListing[]>([]);
  const [geo, setGeo] = useState<Geo>(NO_GEO);

  useEffect(() => {
    if (demo) return;
    let live = true;
    void liveListings().then((d) => { if (live) setListings(d); }).catch(() => { /* the store is optional here */ });
    let useGeo = true;
    try { useGeo = localStorage.getItem(GEO_PREF) !== '0'; } catch { /* default on */ }
    if (useGeo) void approximateLocation().then((g) => { if (live) setGeo(g); });
    return () => { live = false; };
  }, [demo]);

  const picks = useMemo(
    () => pickStoreItems(outfit, listings, { uid: user?.id ?? '', max, extraScore: (l) => matchListing(l, profile, geo).score }),
    [outfit, listings, user?.id, profile, geo, max],
  );
  if (picks.length === 0) return null;

  return (
    <section className="picks" aria-label={t('From the Fitsy Store')}>
      <h4 className="picks__title"><StoreIcon size={15} aria-hidden /> {t('From the Fitsy Store')}</h4>
      <p className="muted small picks__sub">{t('Real pieces you can open and buy now.')}</p>
      <ul className="picks__row">
        {picks.map(({ listing: l, want, ai }) => (
          <li key={l.id}>
            <Link to={`/app/store?listing=${encodeURIComponent(l.id)}`} className="pick" aria-label={`${l.title}, ${money(l, lang)}`}>
              <span className="pick__img"><StoreImage path={l.image_path} alt="" /></span>
              <span className="pick__body">
                <strong className="pick__price">{money(l, lang)}</strong>
                <span className="pick__title">{l.title}</span>
                <span className="pick__meta">{l.size} · {l.city}</span>
                <span className="pick__why">{ai ? t('Picked for this look: {name}', { name: want }) : t('Matches: {name}', { name: want })}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
