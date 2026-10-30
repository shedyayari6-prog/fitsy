import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Palette, Ruler, Save, Shirt, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button, CardSkeleton, Chip, ErrorNotice, Modal } from '@/components/ui';
import { listWardrobe } from '@/lib/data';
import { errMessage, toggle } from '@/lib/util';
import { deleteAvatar, deleteLook, listLooks, loadAvatar, saveAvatar, saveLook, setLookFavorite } from '@/lib/avatarData';
import type { WardrobeItem } from '@/types';
import AvatarSetup from '@/features/avatar/AvatarSetup';
import { BodyPanel, LookPanel } from '@/features/avatar/BodyPanel';
import OutfitPanel, { type CompareState } from '@/features/avatar/OutfitPanel';
import { loadGarmentTexture, outfitSpecs, slotFor, type TextureMap } from '@/features/avatar/garments';
import { EMPTY_OUTFIT, type AvatarConfig, type Outfit, type SavedLook } from '@/features/avatar/types';

// three.js is heavy, so it only loads when the avatar page is opened (same approach as ModelViewer).
const AvatarViewer = lazy(() => import('@/features/avatar/AvatarViewer'));

type Tab = 'body' | 'look' | 'outfit' | 'stylist';
const TABS: { id: Tab; label: string; icon: typeof Ruler }[] = [
  { id: 'body', label: 'Body', icon: Ruler },
  { id: 'look', label: 'Look', icon: Palette },
  { id: 'outfit', label: 'Outfit', icon: Shirt },
  { id: 'stylist', label: 'Stylist', icon: Sparkles },
];

const OCCASIONS = ['Casual day', 'Work', 'Date night', 'Party', 'Wedding guest', 'Travel'];
const WEATHER = ['Hot', 'Mild', 'Cool', 'Cold', 'Rainy'];
const NOTE = 'This avatar is an estimate built from the measurements you entered. It may not match your real body exactly. No photo is ever used.';

/** Puts an item on (or takes it off). A dress and a top/bottom pair never combine. */
function toggleInOutfit(o: Outfit, it: WardrobeItem): Outfit {
  const slot = slotFor(it.category);
  if (slot === 'accessory') return { ...o, accessories: toggle(o.accessories, it.id) };
  const next: Outfit = { ...o };
  if (o[slot] === it.id) { next[slot] = null; return next; }
  next[slot] = it.id;
  if (slot === 'dress') { next.top = null; next.bottom = null; }
  if (slot === 'top' || slot === 'bottom') next.dress = null;
  return next;
}

function ViewerFallback() {
  return <div className="avx__viewer avx__viewer--wait"><span className="mv__loader">Loading 3D view…</span></div>;
}

export default function AvatarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const uid = user?.id ?? '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [cfg, setCfg] = useState<AvatarConfig | null>(null);
  const [savedJson, setSavedJson] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<WardrobeItem[] | null>(null);
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [outfit, setOutfit] = useState<Outfit>(EMPTY_OUTFIT);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [compare, setCompare] = useState<CompareState>({ on: false, lookId: null });
  const [savingLook, setSavingLook] = useState(false);
  const [tab, setTab] = useState<Tab>('body');
  const [tex, setTex] = useState<TextureMap>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [weather, setWeather] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const requested = useRef(new Set<string>());
  const appliedPre = useRef(false);

  // ── load ────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!uid) return;
    setLoading(true); setLoadError(null); setItemsError(null);
    const [a, w, l] = await Promise.allSettled([loadAvatar(uid), listWardrobe(uid), listLooks(uid)]);
    if (a.status === 'fulfilled') { setCfg(a.value); setSavedJson(a.value ? JSON.stringify(a.value) : null); }
    else setLoadError(errMessage(a.reason, 'Could not load your avatar.'));
    if (w.status === 'fulfilled') setItems(w.value); else setItemsError(errMessage(w.reason, 'Could not load your wardrobe.'));
    if (l.status === 'fulfilled') setLooks(l.value);
    setLoading(false);
  }, [uid]);
  useEffect(() => { void loadAll(); }, [loadAll]);

  const itemsById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  // The stylist can send people here with a suggested outfit: nav('/app/avatar', { state: { tryOnItemIds } }).
  const preselect = (loc.state as { tryOnItemIds?: unknown } | null)?.tryOnItemIds;
  useEffect(() => {
    if (!items || appliedPre.current || !Array.isArray(preselect)) return;
    appliedPre.current = true;
    let o = EMPTY_OUTFIT;
    for (const id of preselect) {
      const it = typeof id === 'string' ? itemsById.get(id) : undefined;
      if (it) o = toggleInOutfit(o, it);
    }
    setOutfit(o);
    setTab('outfit');
  }, [items, itemsById, preselect]);

  // Warn before leaving with unsaved avatar changes.
  const dirty = !!cfg && JSON.stringify(cfg) !== savedJson;
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // ── garment textures ────────────────────────────────────────────────────
  const compareLook = compare.on ? looks.find((l) => l.id === compare.lookId) : undefined;
  const wanted = useMemo(() => {
    const ids = new Set<string>();
    for (const o of [outfit, compareLook?.outfit]) {
      if (!o) continue;
      for (const id of [o.top, o.outer, o.bottom, o.dress, o.shoes]) if (id) ids.add(id);
    }
    return [...ids].map((id) => itemsById.get(id)).filter((i): i is WardrobeItem => !!i);
  }, [outfit, compareLook, itemsById]);

  useEffect(() => {
    for (const it of wanted) {
      if (!it.image_path) continue;
      const key = `${it.id}|${it.image_path}`;
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      loadGarmentTexture(it.image_path).then(
        (t) => setTex((p) => ({ ...p, [it.id]: t })),
        () => { requested.current.delete(key); setTex((p) => ({ ...p, [it.id]: 'failed' })); },
      );
    }
  }, [wanted]);

  const busy = wanted.some((it) => it.image_path && tex[it.id] === undefined);
  const failed = useMemo(() => new Set(Object.entries(tex).filter(([, v]) => v === 'failed').map(([k]) => k)), [tex]);
  const specs = useMemo(() => outfitSpecs(outfit, itemsById, colors, tex), [outfit, itemsById, colors, tex]);
  const specsB = useMemo(() => (compareLook ? outfitSpecs(compareLook.outfit, itemsById, compareLook.colors, tex) : []), [compareLook, itemsById, tex]);

  const wornNames = [outfit.dress, outfit.top, outfit.bottom, outfit.outer, outfit.shoes].map((id) => (id ? itemsById.get(id)?.name : null)).filter(Boolean);
  const label = wornNames.length ? `Your avatar wearing ${wornNames.join(', ')}` : 'Your avatar, not wearing any wardrobe pieces yet';

  // ── actions ─────────────────────────────────────────────────────────────
  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try { await saveAvatar(uid, cfg); setSavedJson(JSON.stringify(cfg)); toast('Avatar saved.', 'success'); }
    catch (e) { toast(errMessage(e, 'Could not save your avatar.'), 'error'); }
    finally { setSaving(false); }
  };

  const wipe = async () => {
    try {
      await deleteAvatar(uid);
      setCfg(null); setSavedJson(null); setLooks([]); setOutfit(EMPTY_OUTFIT); setColors({}); setCompare({ on: false, lookId: null });
      toast('Your avatar and measurements were deleted.', 'info');
    } catch (e) { toast(errMessage(e, 'Could not delete your avatar.'), 'error'); }
    finally { setConfirmDelete(false); }
  };

  const onSaveLook = async (name: string) => {
    setSavingLook(true);
    try {
      const l = await saveLook(uid, name, outfit, colors);
      setLooks((x) => [l, ...x]);
      toast('Look saved.', 'success');
      return true;
    } catch (e) { toast(errMessage(e, 'Could not save this look.'), 'error'); return false; }
    finally { setSavingLook(false); }
  };

  const onFavorite = async (l: SavedLook) => {
    const next = !l.favorite;
    setLooks((x) => x.map((i) => (i.id === l.id ? { ...i, favorite: next } : i)));
    try { await setLookFavorite(uid, l.id, next); }
    catch (e) {
      setLooks((x) => x.map((i) => (i.id === l.id ? { ...i, favorite: l.favorite } : i)));
      toast(errMessage(e, 'Could not update favourites.'), 'error');
    }
  };

  const onDeleteLook = async (l: SavedLook) => {
    try {
      await deleteLook(uid, l.id);
      const rest = looks.filter((i) => i.id !== l.id);
      setLooks(rest);
      setCompare((c) => (c.lookId === l.id ? { on: c.on && rest.length > 0, lookId: rest[0]?.id ?? null } : c));
      toast('Look removed.', 'info');
    } catch (e) { toast(errMessage(e, 'Could not delete that look.'), 'error'); }
  };

  const onLoadLook = (l: SavedLook) => {
    const missing = [l.outfit.top, l.outfit.outer, l.outfit.bottom, l.outfit.dress, l.outfit.shoes, ...l.outfit.accessories].filter((id) => id && !itemsById.has(id)).length;
    const keep = (id: string | null) => (id && itemsById.has(id) ? id : null);
    setOutfit({
      top: keep(l.outfit.top), outer: keep(l.outfit.outer), bottom: keep(l.outfit.bottom), dress: keep(l.outfit.dress), shoes: keep(l.outfit.shoes),
      accessories: l.outfit.accessories.filter((id) => itemsById.has(id)),
    });
    setColors(l.colors);
    toast(missing ? `Look loaded. ${missing} ${missing === 1 ? 'piece is' : 'pieces are'} no longer in your wardrobe.` : 'Look loaded.', missing ? 'info' : 'success');
  };

  const tryOnClothes = () => {
    setTab('outfit');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
  };

  const askStylist = () => {
    const parts = ['Create an outfit from my wardrobe'];
    if (occasion) parts.push(`for ${occasion.toLowerCase()}`);
    if (weather) parts.push(`in ${weather.toLowerCase()} weather`);
    nav('/app/stylist', { state: { prompt: `${parts.join(' ')}. I'll preview it on my 3D avatar.` } });
  };

  const onTabKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(n);
    document.getElementById(`avx-tab-${n}`)?.focus();
  };

  // ── render ──────────────────────────────────────────────────────────────
  if (loading) return <div className="avx"><CardSkeleton /><CardSkeleton /></div>;
  if (loadError) return <div className="avx"><ErrorNotice message={loadError} onRetry={() => void loadAll()} /></div>;
  if (!cfg) {
    return <AvatarSetup onCreate={(c) => { setCfg(c); setTab('body'); toast('Avatar created. Adjust it, then save when you are happy.', 'success'); }} />;
  }

  const viewer = (c: AvatarConfig, g: typeof specs, l: string, compact: boolean) => (
    <Suspense fallback={<ViewerFallback />}>
      <AvatarViewer config={c} garments={g} label={l} compact={compact} busy={busy}
        badge={g.length > 0 ? 'Visual preview, not a fit simulation' : undefined} />
    </Suspense>
  );

  return (
    <div className="avx">
      <header className="page__head row-between">
        <div>
          <p className="eyebrow">Virtual fitting room</p>
          <h1>My 3D Avatar</h1>
        </div>
        <Button variant="clay" icon={<Shirt size={16} />} onClick={tryOnClothes}>Try on my clothes</Button>
      </header>

      <div className="avx__grid">
        <div className="avx__stage">
          {compareLook ? (
            <div className="avx__compare">
              <figure>{viewer(cfg, specs, label, true)}<figcaption>Current look</figcaption></figure>
              <figure>{viewer(cfg, specsB, `Your avatar wearing the saved look ${compareLook.name}`, true)}<figcaption>{compareLook.name}</figcaption></figure>
            </div>
          ) : viewer(cfg, specs, label, false)}
          <p className="muted small avx__note">{NOTE}</p>
        </div>

        <aside className="card avx__panel" aria-label="Avatar controls" ref={panelRef}>
          <div className="row-between avx__save">
            <span className={`tag ${dirty || savedJson === null ? 'tag--clay' : 'tag--sage'}`} role="status">
              {savedJson === null ? 'Not saved yet' : dirty ? 'Unsaved changes' : 'Saved'}
            </span>
            <Button size="sm" icon={<Save size={15} />} loading={saving} disabled={!dirty && savedJson !== null} onClick={() => void save()}>Save avatar</Button>
          </div>

          <div className="avx__tabs" role="tablist" aria-label="Avatar sections">
            {TABS.map((t, i) => (
              <button key={t.id} id={`avx-tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`avx-pane-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} onKeyDown={(e) => onTabKey(e, i)}>
                <t.icon size={16} aria-hidden /> {t.label}
              </button>
            ))}
          </div>

          <div id={`avx-pane-${tab}`} role="tabpanel" aria-labelledby={`avx-tab-${tab}`} className="avx__pane">
            {tab === 'body' && (
              <>
                <BodyPanel cfg={cfg} onChange={setCfg} />
                <button type="button" className="link-btn avx__danger" onClick={() => setConfirmDelete(true)}>Delete my avatar and measurements</button>
              </>
            )}
            {tab === 'look' && <LookPanel cfg={cfg} onChange={setCfg} />}
            {tab === 'outfit' && (itemsError
              ? <ErrorNotice message={itemsError} onRetry={() => void loadAll()} />
              : (
                <OutfitPanel items={items} outfit={outfit} colors={colors} failed={failed} looks={looks} compare={compare} savingLook={savingLook}
                  onToggleItem={(it) => setOutfit((o) => toggleInOutfit(o, it))}
                  onColor={(id, hex) => setColors((c) => { const n = { ...c }; if (hex) n[id] = hex; else delete n[id]; return n; })}
                  onClear={() => { setOutfit(EMPTY_OUTFIT); setColors({}); }}
                  onSaveLook={onSaveLook} onLoadLook={onLoadLook} onFavorite={(l) => void onFavorite(l)} onDeleteLook={(l) => void onDeleteLook(l)}
                  onCompare={setCompare} />
              ))}
            {tab === 'stylist' && (
              <div className="stack">
                <p className="muted">Tell the Fitsy stylist what you&rsquo;re dressing for. It builds an outfit from the pieces in your wardrobe.</p>
                <div>
                  <span className="label" id="st-occ">Occasion</span>
                  <div className="chips" role="group" aria-labelledby="st-occ">
                    {OCCASIONS.map((o) => <Chip key={o} selected={occasion === o} onClick={() => setOccasion(occasion === o ? null : o)}>{o}</Chip>)}
                  </div>
                </div>
                <div>
                  <span className="label" id="st-wx">Weather</span>
                  <div className="chips" role="group" aria-labelledby="st-wx">
                    {WEATHER.map((w) => <Chip key={w} selected={weather === w} onClick={() => setWeather(weather === w ? null : w)}>{w}</Chip>)}
                  </div>
                </div>
                <Button icon={<Sparkles size={16} />} disabled={!items?.length} onClick={askStylist}>Ask the Fitsy stylist</Button>
                {items && items.length === 0 && <p className="field__hint">Add pieces to your wardrobe first so the stylist has something to work with.</p>}
              </div>
            )}
          </div>
        </aside>
        <p className="muted small avx__note avx__note--after">{NOTE}</p>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your avatar?">
        <p>Your measurements, appearance choices and saved looks will be removed permanently. Your wardrobe is not affected.</p>
        <div className="row-end">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button variant="danger" onClick={() => void wipe()}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
