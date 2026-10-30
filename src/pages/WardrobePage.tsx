import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ImagePlus, Pencil, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { Button, CardSkeleton, Chip, EmptyState, ErrorNotice, Field, Input, Modal, Select, Textarea, Notice } from '@/components/ui';
import { CATEGORY_OPTIONS, SEASON_OPTIONS, STYLE_OPTIONS } from '@/config/options';
import { MAX_IMAGE_BYTES, deleteWardrobeItem, listWardrobe, removeStoredImage, saveWardrobeItem, signedImageUrl, uploadWardrobeImage } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { errMessage, toggle } from '@/lib/util';
import { pop, stagger } from '@/lib/animations';
import type { Season, WardrobeCategory, WardrobeDraft, WardrobeItem } from '@/types';

/** Tops, outerwear and dresses hang on the rail. Everything else sits on a shelf per category. */
const HANGING = new Set<string>(['tops', 'jackets', 'coats', 'dresses']);

function ItemImage({ path, alt }: { path: string | null; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (path) void signedImageUrl(path).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path]);
  if (!path || !url) return <div className="item__ph" aria-hidden>{alt.slice(0, 1).toUpperCase()}</div>;
  return <img src={url} alt={alt} loading="lazy" className="item__img" />;
}

function Piece({ it, hang, onView, onEdit, onDelete }: {
  it: WardrobeItem; hang: boolean;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { t } = useT();
  return (
    <motion.li variants={pop} layout exit={{ opacity: 0, scale: 0.9 }} className={`piece ${hang ? 'piece--hang' : 'piece--shelf'}`}>
      {hang && (
        <svg className="piece__hanger" viewBox="0 0 64 28" aria-hidden>
          <path d="M32 2a5 5 0 0 1 5 5c0 3-5 4-5 8M32 15 4 26h56L32 15Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <button className="piece__btn" onClick={onView} aria-label={t('View {name}', { name: it.name })}>
        <ItemImage path={it.image_path} alt={it.name} />
      </button>
      <span className="piece__name" title={it.name}>{it.name}</span>
      <div className="piece__actions">
        <button className="icon-btn icon-btn--tiny" onClick={onEdit} aria-label={t('Edit {name}', { name: it.name })}><Pencil size={15} /></button>
        <button className="icon-btn icon-btn--tiny" onClick={onDelete} aria-label={t('Delete {name}', { name: it.name })}><Trash2 size={15} /></button>
      </div>
    </motion.li>
  );
}

const blank = (): WardrobeDraft => ({
  name: '', category: 'tops', color: null, season: 'all', style_tags: [], image_path: null, brand: null, purchase_price: null, notes: null,
});

export default function WardrobePage() {
  const { t } = useT();
  const { user } = useAuth();
  const { tryComplete } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [items, setItems] = useState<WardrobeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<WardrobeCategory | ''>('');
  const [season, setSeason] = useState<Season | ''>('');
  const [editing, setEditing] = useState<WardrobeItem | 'new' | null>(null);
  const [draft, setDraft] = useState<WardrobeDraft>(blank());
  const [file, setFile] = useState<File | null>(null);
  const [price, setPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WardrobeItem | null>(null);
  const [viewing, setViewing] = useState<WardrobeItem | null>(null);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = user!.id;
  const canUpload = !!supabase;

  const load = useCallback(async () => {
    setError(null);
    try { setItems(await listWardrobe(uid)); } catch (e) { setError(errMessage(e, t('Could not load your wardrobe.'))); }
  }, [uid, t]);
  useEffect(() => { void load(); }, [load]);
  // The doors slide open by themselves once the wardrobe has loaded.
  const opened = useRef(false);
  useEffect(() => {
    if (items && items.length && !opened.current) { opened.current = true; const id = window.setTimeout(() => setDoorsOpen(true), 450); return () => window.clearTimeout(id); }
  }, [items]);

  const shown = useMemo(() => (items ?? []).filter((i) =>
    (!cat || i.category === cat) && (!season || i.season === season) &&
    (!q || [i.name, i.color, i.brand].some((f) => f?.toLowerCase().includes(q.toLowerCase())))), [items, cat, season, q]);

  // Tops, outerwear and dresses hang on the rail. Everything else sits on one shelf per category.
  const hanging = useMemo(() => shown.filter((i) => HANGING.has(i.category)), [shown]);
  const shelves = useMemo(() => {
    const order = CATEGORY_OPTIONS.map((c) => c.value as string);
    const groups = new Map<string, WardrobeItem[]>();
    for (const it of shown) {
      if (HANGING.has(it.category)) continue;
      groups.set(it.category, [...(groups.get(it.category) ?? []), it]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
      .map(([value, list]) => ({
        value,
        label: CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value,
        list,
      }));
  }, [shown]);

  const open = (it: WardrobeItem | 'new') => {
    setFormError(null); setFile(null);
    if (it === 'new') { setDraft(blank()); setPrice(''); }
    else {
      const { id: _i, user_id: _u, created_at: _c, ...rest } = it;
      setDraft(rest); setPrice(it.purchase_price?.toString() ?? '');
    }
    setEditing(it);
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setFormError(t('Please choose a JPG, PNG or WebP image.'));
    if (f.size > MAX_IMAGE_BYTES) return setFormError(t('That image is larger than 5 MB.'));
    setFormError(null); setFile(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!draft.name.trim()) return setFormError(t('Give the piece a name.'));
    const priceNum = price.trim() === '' ? null : Number(price);
    if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) return setFormError(t('Price must be a positive number.'));
    setBusy(true);
    let newPath: string | null = null;
    try {
      const existing = editing && editing !== 'new' ? editing : null;
      let image_path = draft.image_path;
      if (file) { newPath = await uploadWardrobeImage(uid, file); image_path = newPath; }
      await saveWardrobeItem(uid, { ...draft, name: draft.name.trim(), purchase_price: priceNum, image_path }, existing?.id);
      if (file && existing?.image_path) await removeStoredImage(uid, existing.image_path);
      setEditing(null);
      await load();
      toast(existing ? t('Piece updated.') : t('Added to your wardrobe.'), 'success');
      if (!existing) await tryComplete('wardrobe_3');
    } catch (err) {
      if (newPath) void removeStoredImage(uid, newPath);
      setFormError(errMessage(err, t('Could not save this piece.')));
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try { await deleteWardrobeItem(uid, confirmDelete); setItems((x) => (x ?? []).filter((i) => i.id !== confirmDelete.id)); toast(t('Piece removed.'), 'info'); }
    catch (e) { toast(errMessage(e, t('Could not delete that piece.')), 'error'); }
    finally { setConfirmDelete(null); }
  };

  return (
    <div className="page">
      <header className="page__head row-between">
        <div><h1>{t('Wardrobe')}</h1><p className="muted">{items ? t(items.length === 1 ? '{n} piece' : '{n} pieces', { n: items.length }) : ' '}</p></div>
        <div className="row">
          <Button variant="clay" icon={<Sparkles size={16} />} disabled={!items?.length}
            onClick={() => nav('/app/stylist', { state: { prompt: t('Create an outfit from my wardrobe.') } })}>{t('Outfit from my wardrobe')}</Button>
          <Button icon={<Plus size={16} />} onClick={() => open('new')}>{t('Add piece')}</Button>
        </div>
      </header>

      {!canUpload && <Notice title={t('Photos are off in demo mode')}>{t('You can still add and organise pieces. Photo upload needs Supabase Storage.')}</Notice>}
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}

      <div className="filters" role="search" aria-label={t('Filter wardrobe')}>
        <Field label={t('Search')} htmlFor="w-q">
          <div className="input-icon"><Search size={16} aria-hidden /><Input id="w-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Name, colour or brand')} /></div>
        </Field>
        <Field label={t('Category')} htmlFor="w-c">
          <Select id="w-c" value={cat} onChange={(e) => setCat(e.target.value as WardrobeCategory | '')}>
            <option value="">{t('All')}</option>{CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
          </Select>
        </Field>
        <Field label={t('Season')} htmlFor="w-s">
          <Select id="w-s" value={season} onChange={(e) => setSeason(e.target.value as Season | '')}>
            <option value="">{t('All')}</option>{SEASON_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
          </Select>
        </Field>
      </div>

      {items === null && !error && <div className="items"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}
      {items && items.length === 0 && (
        <EmptyState title={t('Your closet is empty')} body={t('Add the pieces you already own. Sage will use them to build outfits.')}
          mood="sad"
          action={<Button onClick={() => open('new')} icon={<Plus size={16} />}>{t('Add your first piece')}</Button>} />
      )}
      {items && items.length > 0 && shown.length === 0 && <p className="muted">{t('No pieces match your filters.')}</p>}

      {items && items.length > 0 && shown.length > 0 && (
        <div className="armoire">
          <div className="armoire__cornice" aria-hidden />
          <div className="armoire__body">
          <div className="armoire__inside" aria-hidden={!doorsOpen}>
          <div className="cabinet">
          {hanging.length > 0 && (
            <section className="cabinet__bay" aria-label={t('Hanging rail')}>
              <div className="cabinet__rail" aria-hidden />
              <motion.ul className="cabinet__row" variants={stagger(0.04)} initial="hidden" animate="show">
                <AnimatePresence>
                  {hanging.map((it) => (
                    <Piece key={it.id} it={it} hang onView={() => setViewing(it)} onEdit={() => open(it)} onDelete={() => setConfirmDelete(it)} />
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          )}
          {shelves.map((s) => (
            <section className="cabinet__bay cabinet__bay--shelf" key={s.value} aria-label={t('{label} shelf', { label: t(s.label) })}>
              <h2 className="cabinet__label">{t(s.label)}</h2>
              <motion.ul className="cabinet__row cabinet__row--shelf" variants={stagger(0.04)} initial="hidden" animate="show">
                <AnimatePresence>
                  {s.list.map((it) => (
                    <Piece key={it.id} it={it} hang={false} onView={() => setViewing(it)} onEdit={() => open(it)} onDelete={() => setConfirmDelete(it)} />
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          ))}
          </div>
          </div>
          {(['l', 'r'] as const).map((side) => (
            <motion.button key={side} type="button" className={`armoire__door armoire__door--${side}`}
              aria-label={doorsOpen ? t('Close the wardrobe') : t('Open the wardrobe')} aria-expanded={doorsOpen}
              tabIndex={doorsOpen ? -1 : 0}
              animate={{ x: doorsOpen ? (side === 'l' ? '-104%' : '104%') : '0%' }}
              transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1], delay: side === 'r' ? 0.06 : 0 }}
              style={{ pointerEvents: doorsOpen ? 'none' : 'auto' }}
              onClick={() => setDoorsOpen(true)}>
              <span className="armoire__mirror" aria-hidden />
              <span className="armoire__handle" aria-hidden />
              {side === 'l' && <span className="armoire__hint">{t('Tap to open')}</span>}
            </motion.button>
          ))}
          </div>
          <div className="armoire__plinth" aria-hidden />
        </div>
      )}

      {items && items.length > 0 && shown.length > 0 && (
        <div className="row-end">
          <Button variant="soft" size="sm" onClick={() => setDoorsOpen((o) => !o)}>{doorsOpen ? t('Close the wardrobe') : t('Open the wardrobe')}</Button>
        </div>
      )}

      <Modal open={editing !== null} onClose={() => !busy && setEditing(null)} title={editing === 'new' ? t('Add a piece') : t('Edit piece')}>
        <form className="stack" onSubmit={submit} noValidate>
          <Field label={t('Name')} htmlFor="i-name"><Input id="i-name" value={draft.name} maxLength={80} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder={t('e.g. Beige overshirt')} /></Field>
          <div className="grid-2">
            <Field label={t('Category')} htmlFor="i-cat">
              <Select id="i-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as WardrobeCategory })}>
                {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
              </Select>
            </Field>
            <Field label={t('Season')} htmlFor="i-sea">
              <Select id="i-sea" value={draft.season} onChange={(e) => setDraft({ ...draft, season: e.target.value as Season })}>
                {SEASON_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
              </Select>
            </Field>
            <Field label={t('Colour')} htmlFor="i-col"><Input id="i-col" value={draft.color ?? ''} maxLength={40} onChange={(e) => setDraft({ ...draft, color: e.target.value || null })} /></Field>
            <Field label={t('Brand')} htmlFor="i-brand"><Input id="i-brand" value={draft.brand ?? ''} maxLength={60} onChange={(e) => setDraft({ ...draft, brand: e.target.value || null })} /></Field>
            <Field label={t('Purchase price (optional)')} htmlFor="i-price"><Input id="i-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          </div>
          <div>
            <span className="label">{t('Style')}</span>
            <div className="chips" role="group" aria-label={t('Style tags')}>
              {STYLE_OPTIONS.map((s) => <Chip key={s} selected={draft.style_tags.includes(s)} onClick={() => setDraft({ ...draft, style_tags: toggle(draft.style_tags, s) })}>{t(s)}</Chip>)}
            </div>
          </div>
          <Field label={t('Notes')} htmlFor="i-notes"><Textarea id="i-notes" rows={2} maxLength={500} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value || null })} /></Field>
          <Field label={t('Photo (optional)')} htmlFor="i-photo" hint={canUpload ? t('JPG, PNG or WebP up to 5 MB. Stored privately; only you can see it. A cut-out on a transparent background looks best on the rail.') : t('Photo upload needs Supabase Storage.')}>
            <input ref={fileRef} id="i-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={!canUpload} onChange={(e) => onFile(e.target.files?.[0])} />
            <Button type="button" variant="soft" size="sm" icon={<ImagePlus size={16} />} disabled={!canUpload} onClick={() => fileRef.current?.click()}>
              {file ? file.name : draft.image_path ? t('Replace photo') : t('Choose photo')}
            </Button>
          </Field>
          {formError && <p className="field__error" role="alert">{formError}</p>}
          <div className="row-end">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>{t('Cancel')}</Button>
            <Button type="submit" loading={busy}>{t('Save piece')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? ''}>
        {viewing && (
          <>
            <div className="viewer-photo"><ItemImage path={viewing.image_path} alt={viewing.name} /></div>
            <div className="tags">
              <span className="tag">{t(CATEGORY_OPTIONS.find((c) => c.value === viewing.category)?.label ?? 'Other')}</span>
              {viewing.season !== 'all' && <span className="tag tag--sage">{t(SEASON_OPTIONS.find((x) => x.value === viewing.season)?.label ?? viewing.season)}</span>}
              {viewing.color && <span className="tag">{viewing.color}</span>}
              {viewing.brand && <span className="tag">{viewing.brand}</span>}
              {viewing.style_tags.map((x) => <span className="tag" key={x}>{t(x)}</span>)}
            </div>
            {viewing.notes && <p className="muted">{viewing.notes}</p>}
          </>
        )}
        <div className="row-end">
          <Button variant="ghost" onClick={() => setViewing(null)}>{t('Close')}</Button>
          <Button variant="soft" icon={<Pencil size={16} />} onClick={() => { const it = viewing; setViewing(null); if (it) open(it); }}>{t('Edit piece')}</Button>
        </div>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={t('Delete this piece?')}>
        <p>{t('“{name}” and its photo will be removed permanently.', { name: confirmDelete?.name ?? '' })}</p>
        <div className="row-end">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>{t('Keep it')}</Button>
          <Button variant="danger" onClick={() => void doDelete()}>{t('Delete')}</Button>
        </div>
      </Modal>
    </div>
  );
}