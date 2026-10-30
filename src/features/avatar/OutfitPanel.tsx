import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Heart, Plus, Save, Trash2 } from 'lucide-react';
import { Button, CardSkeleton, Chip, EmptyState, Input, Notice, Select } from '@/components/ui';
import { signedImageUrl } from '@/lib/data';
import type { WardrobeItem } from '@/types';
import { COLOR_SWATCHES, NOT_CONNECTED, SLOT_LABEL, slotFor } from './garments';
import type { Outfit, SavedLook } from './types';

type Filter = 'all' | keyof typeof SLOT_LABEL;

function Thumb({ path, name }: { path: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (path) signedImageUrl(path).then((u) => { if (live) setUrl(u); }).catch(() => { /* keep placeholder */ });
    return () => { live = false; };
  }, [path]);
  if (!url) return <div className="item__ph" aria-hidden>{name.slice(0, 1).toUpperCase()}</div>;
  return <img src={url} alt="" className="item__img" loading="lazy" />;
}

export interface CompareState { on: boolean; lookId: string | null }

interface Props {
  items: WardrobeItem[] | null;
  outfit: Outfit;
  colors: Record<string, string>;
  /** Item ids whose photo could not be turned into a texture. They are shown as plain colour. */
  failed: Set<string>;
  looks: SavedLook[];
  compare: CompareState;
  savingLook: boolean;
  onToggleItem: (it: WardrobeItem) => void;
  onColor: (id: string, hex: string | null) => void;
  onClear: () => void;
  onSaveLook: (name: string) => Promise<boolean>;
  onLoadLook: (l: SavedLook) => void;
  onFavorite: (l: SavedLook) => void;
  onDeleteLook: (l: SavedLook) => void;
  onCompare: (c: CompareState) => void;
}

export default function OutfitPanel(p: Props) {
  const nav = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [name, setName] = useState('');

  const byId = useMemo(() => new Map((p.items ?? []).map((i) => [i.id, i])), [p.items]);
  const worn = useMemo(() => {
    const ids = [p.outfit.dress, p.outfit.top, p.outfit.bottom, p.outfit.outer, p.outfit.shoes, ...p.outfit.accessories];
    return ids.map((id) => (id ? byId.get(id) : undefined)).filter((i): i is WardrobeItem => !!i);
  }, [p.outfit, byId]);
  const wornIds = useMemo(() => new Set(worn.map((i) => i.id)), [worn]);

  const shown = useMemo(
    () => (p.items ?? []).filter((i) => slotFor(i.category) !== 'accessory' && (filter === 'all' || slotFor(i.category) === filter)),
    [p.items, filter],
  );
  const filters = useMemo(() => {
    const present = new Set((p.items ?? []).map((i) => slotFor(i.category)));
    return (Object.keys(SLOT_LABEL) as (keyof typeof SLOT_LABEL)[]).filter((k) => k !== 'accessory' && present.has(k));
  }, [p.items]);

  const looks = p.looks.filter((l) => !favOnly || l.favorite);

  const save = async () => {
    if (await p.onSaveLook(name || `Look ${p.looks.length + 1}`)) setName('');
  };

  if (p.items === null) return <div className="stack-sm"><CardSkeleton /><CardSkeleton /></div>;

  if (p.items.length === 0) {
    return (
      <EmptyState title="Nothing to try on yet"
        body="Add a few pieces to your wardrobe, then come back to dress your avatar in them."
        action={<Button onClick={() => nav('/app/wardrobe')} icon={<Plus size={16} />}>Go to my wardrobe</Button>} />
    );
  }

  return (
    <div className="stack">
      <Notice title="A visual preview, not a fit simulation">
        Garments are shaped to your avatar&rsquo;s proportions and painted with your wardrobe photo. Real fabric drape, sizing and fit can differ.
      </Notice>

      <section className="stack-sm" aria-labelledby="op-worn">
        <div className="row-between">
          <h3 className="h3" id="op-worn">Wearing now</h3>
          <Button variant="ghost" size="sm" disabled={worn.length === 0} onClick={p.onClear}>Clear outfit</Button>
        </div>
        {worn.length === 0 && <p className="muted small">Pick pieces below. A dress replaces the top and bottom; a top and bottom replace a dress.</p>}
        <ul className="worn">
          {worn.map((it) => {
            const isAcc = slotFor(it.category) === 'accessory';
            const picked = p.colors[it.id];
            return (
              <li key={it.id} className="worn__row">
                <div className="worn__head">
                  <strong>{it.name}</strong>
                  <button type="button" className="link-btn" onClick={() => p.onToggleItem(it)}>Remove</button>
                </div>
                {p.failed.has(it.id) && <p className="field__hint">Couldn&rsquo;t use this photo, so it&rsquo;s shown as a plain colour.</p>}
                {!isAcc && (
                  <div className="swatches swatches--sm" role="group" aria-label={`Colour for ${it.name}`}>
                    <Chip selected={!picked} onClick={() => p.onColor(it.id, null)}>Original</Chip>
                    {COLOR_SWATCHES.map((hex) => (
                      <button key={hex} type="button" className="swatch swatch--sm" style={{ background: hex }} aria-label={`Tint ${hex}`} aria-pressed={picked === hex}
                        onClick={() => p.onColor(it.id, hex)}>{picked === hex && <Check size={12} aria-hidden />}</button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack-sm" aria-labelledby="op-wardrobe">
        <h3 className="h3" id="op-wardrobe">Your wardrobe</h3>
        <div className="chips" role="group" aria-label="Filter wardrobe by type">
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>All</Chip>
          {filters.map((f) => <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>{SLOT_LABEL[f]}</Chip>)}
        </div>
        <ul className="tryon-grid">
          {shown.map((it) => {
            const on = wornIds.has(it.id);
            return (
              <li key={it.id}>
                <button type="button" className={`tryon ${on ? 'tryon--on' : ''}`} aria-pressed={on} onClick={() => p.onToggleItem(it)}>
                  <Thumb path={it.image_path} name={it.name} />
                  <span className="tryon__name">{it.name}</span>
                  {on && <span className="tryon__check" aria-hidden><Check size={14} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="stack-sm" aria-labelledby="op-save">
        <h3 className="h3" id="op-save">Save this look</h3>
        <div className="inline-form">
          <label htmlFor="op-name" className="sr-only">Look name</label>
          <Input id="op-name" value={name} maxLength={60} placeholder={`Look ${p.looks.length + 1}`} onChange={(e) => setName(e.target.value)} />
          <Button icon={<Save size={16} />} loading={p.savingLook} disabled={worn.length === 0} onClick={() => void save()}>Save look</Button>
        </div>
      </section>

      <section className="stack-sm" aria-labelledby="op-looks">
        <div className="row-between">
          <h3 className="h3" id="op-looks">Saved looks</h3>
          {p.looks.some((l) => l.favorite) && <Chip selected={favOnly} onClick={() => setFavOnly(!favOnly)}>Favourites</Chip>}
        </div>
        {p.looks.length === 0 && <p className="muted small">Saved looks and favourites appear here.</p>}
        <ul className="looks">
          {looks.map((l) => (
            <li key={l.id} className="look">
              <button type="button" className={`icon-btn icon-btn--tiny ${l.favorite ? 'icon-btn--on' : ''}`} aria-pressed={l.favorite}
                aria-label={l.favorite ? `Remove ${l.name} from favourites` : `Add ${l.name} to favourites`} onClick={() => p.onFavorite(l)}>
                <Heart size={16} fill={l.favorite ? 'currentColor' : 'none'} aria-hidden />
              </button>
              <span className="look__name" title={l.name}>{l.name}</span>
              <Button variant="soft" size="sm" onClick={() => p.onLoadLook(l)}>Wear</Button>
              <button type="button" className="icon-btn icon-btn--tiny" aria-label={`Delete ${l.name}`} onClick={() => p.onDeleteLook(l)}><Trash2 size={15} aria-hidden /></button>
            </li>
          ))}
        </ul>

        {p.looks.length > 0 && (
          <div className="stack-sm avx-compare">
            <label className="toggle">
              <span>Compare side by side<small>Your current look next to a saved one</small></span>
              <input type="checkbox" checked={p.compare.on}
                onChange={(e) => p.onCompare({ on: e.target.checked, lookId: p.compare.lookId ?? p.looks[0]?.id ?? null })} />
              <i aria-hidden />
            </label>
            {p.compare.on && (
              <div className="field">
                <label htmlFor="op-cmp">Compare with</label>
                <Select id="op-cmp" value={p.compare.lookId ?? ''} onChange={(e) => p.onCompare({ on: true, lookId: e.target.value || null })}>
                  {p.looks.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </Select>
              </div>
            )}
          </div>
        )}
      </section>

      <details className="avx-services">
        <summary>Not connected yet</summary>
        <p className="small muted">Your preview uses the built-in texture method. These would make it more realistic once connected:</p>
        <ul className="small">
          {NOT_CONNECTED.map((s) => <li key={s.id}><strong>{s.label}.</strong> {s.does}</li>)}
        </ul>
      </details>
    </div>
  );
}