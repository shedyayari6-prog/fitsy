import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button, Chip, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { CATEGORY_OPTIONS, COLOR_OPTIONS, STYLE_OPTIONS } from '@/config/options';
import { COUNTRIES, CONDITIONS, CONTACT_TYPES, CURRENCIES, countryName, createListing, removeStoreImage, uploadStoreImage } from '@/lib/store';
import { MAX_IMAGE_BYTES } from '@/lib/data';
import { errMessage, toggle } from '@/lib/util';
import { useT } from '@/i18n';
import type { Profile, StoreDraft } from '@/types';

const blank = (p: Profile | null): StoreDraft => ({
  title: '', category: 'tops', style_tags: [], color: '', size: '', condition: 'good', description: '', price: '', currency: 'TND',
  seller_name: p?.display_name ?? '', seller_info: '', country: 'TN', city: p?.location_city ?? '', contact_type: 'whatsapp', contact_value: '',
});

/** Every field is mandatory, including the photo and a way to reach the seller. */
export function SellForm({ open, uid, profile, onClose, onCreated }:
  { open: boolean; uid: string; profile: Profile | null; onClose: () => void; onCreated: () => void }) {
  const { t, lang } = useT();
  const [d, setD] = useState<StoreDraft>(() => blank(profile));
  const [file, setFile] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (open) { setD(blank(profile)); setFile(null); setAgree(false); setErr(null); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof StoreDraft>(k: K, v: StoreDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setErr(t('Please choose a JPG, PNG or WebP image.'));
    if (f.size > MAX_IMAGE_BYTES) return setErr(t('That image is larger than 5 MB.'));
    setErr(null); setFile(f);
  };

  const validate = (): string | null => {
    if (d.title.trim().length < 3) return t('Give the piece a title (at least 3 characters).');
    if (!d.color.trim()) return t('Tell us the colour.');
    if (!d.size.trim()) return t('Tell us the size.');
    if (d.description.trim().length < 10) return t('Describe the piece (at least 10 characters).');
    const price = Number(d.price);
    if (!d.price.trim() || !Number.isFinite(price) || price <= 0) return t('Enter a price above zero.');
    if (d.seller_name.trim().length < 2) return t('Enter the seller name.');
    if (d.seller_info.trim().length < 10) return t('Tell buyers a little about yourself (at least 10 characters).');
    if (d.city.trim().length < 2) return t('Enter the city where the piece is.');
    if (!file) return t('Add a photo of the piece.');
    const v = d.contact_value.trim();
    const okContact = d.contact_type === 'email' ? /^\S+@\S+\.\S+$/.test(v)
      : d.contact_type === 'other' ? v.length >= 5
      : v.replace(/\D/g, '').length >= 6;
    if (!okContact) return t('Enter a valid contact (email or phone number).');
    if (!agree) return t('Please confirm the statement at the bottom.');
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) return setErr(problem);
    setErr(null); setBusy(true);
    let path: string | null = null;
    try {
      path = await uploadStoreImage(uid, file!);
      await createListing(uid, d, path);
      onCreated();
    } catch (x) {
      if (path) void removeStoreImage(path);
      setErr(errMessage(x, t('Could not publish this listing.')));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={t('Sell a piece')}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="muted small">{t('All fields are required. Your listing stays online for 30 days, then it is deleted automatically.')}</p>

        <Field label={t('Photo')} htmlFor="s-photo" hint={t('JPG, PNG or WebP up to 5 MB.')}>
          <input ref={fileRef} id="s-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="sell__photo">
            {preview && <img src={preview} alt="" />}
            <Button type="button" variant="soft" size="sm" icon={<ImagePlus size={16} />} onClick={() => fileRef.current?.click()}>
              {file ? file.name : t('Choose photo')}
            </Button>
          </div>
        </Field>

        <Field label={t('Title')} htmlFor="s-title"><Input id="s-title" value={d.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder={t('e.g. Beige wool coat')} /></Field>
        <div className="grid-2">
          <Field label={t('Type of piece')} htmlFor="s-cat">
            <Select id="s-cat" value={d.category} onChange={(e) => set('category', e.target.value as StoreDraft['category'])}>
              {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
            </Select>
          </Field>
          <Field label={t('Condition')} htmlFor="s-cond">
            <Select id="s-cond" value={d.condition} onChange={(e) => set('condition', e.target.value as StoreDraft['condition'])}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
            </Select>
          </Field>
          <Field label={t('Colour')} htmlFor="s-col">
            <Input id="s-col" list="s-colors" value={d.color} maxLength={40} onChange={(e) => set('color', e.target.value)} />
            <datalist id="s-colors">{COLOR_OPTIONS.map((c) => <option key={c.name} value={c.name} />)}</datalist>
          </Field>
          <Field label={t('Size')} htmlFor="s-size"><Input id="s-size" value={d.size} maxLength={20} onChange={(e) => set('size', e.target.value)} placeholder={t('e.g. M or 42')} /></Field>
          <Field label={t('Price')} htmlFor="s-price"><Input id="s-price" inputMode="decimal" value={d.price} onChange={(e) => set('price', e.target.value.replace(',', '.'))} /></Field>
          <Field label={t('Currency')} htmlFor="s-cur">
            <Select id="s-cur" value={d.currency} onChange={(e) => set('currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
          </Field>
        </div>
        <div>
          <span className="label">{t('Style')}</span>
          <div className="chips" role="group" aria-label={t('Style tags')}>
            {STYLE_OPTIONS.map((s) => <Chip key={s} selected={d.style_tags.includes(s)} onClick={() => set('style_tags', toggle(d.style_tags, s))}>{t(s)}</Chip>)}
          </div>
        </div>
        <Field label={t('Description')} htmlFor="s-desc" hint={t('Fabric, fit, any flaws, why you are selling.')}>
          <Textarea id="s-desc" rows={3} maxLength={800} value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <h3 className="h3">{t('About the seller')}</h3>
        <div className="grid-2">
          <Field label={t('Seller name')} htmlFor="s-sn"><Input id="s-sn" value={d.seller_name} maxLength={60} onChange={(e) => set('seller_name', e.target.value)} /></Field>
          <Field label={t('Country')} htmlFor="s-country">
            <Select id="s-country" value={d.country} onChange={(e) => set('country', e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{countryName(c, lang)}</option>)}
            </Select>
          </Field>
          <Field label={t('City where the piece is')} htmlFor="s-city"><Input id="s-city" value={d.city} maxLength={80} onChange={(e) => set('city', e.target.value)} /></Field>
        </div>
        <Field label={t('A few words about you')} htmlFor="s-si" hint={t('For example how you prefer to meet or ship, and when you are available.')}>
          <Textarea id="s-si" rows={2} maxLength={400} value={d.seller_info} onChange={(e) => set('seller_info', e.target.value)} />
        </Field>

        <h3 className="h3">{t('Contact')}</h3>
        <div className="grid-2">
          <Field label={t('How can buyers reach you?')} htmlFor="s-ct">
            <Select id="s-ct" value={d.contact_type} onChange={(e) => set('contact_type', e.target.value as StoreDraft['contact_type'])}>
              {CONTACT_TYPES.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
            </Select>
          </Field>
          <Field label={t('Phone number or email')} htmlFor="s-cv"><Input id="s-cv" value={d.contact_value} maxLength={120} onChange={(e) => set('contact_value', e.target.value)} /></Field>
        </div>
        <p className="muted small">{t('Your contact is hidden. Signed-in buyers see it only when they tap “Show contact”, and each buyer can view a limited number per day.')}</p>

        <label className="check">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>{t('I own this piece, the information is true, and I accept that it is removed after 30 days.')}</span>
        </label>

        {err && <p className="field__error" role="alert">{err}</p>}
        <div className="row-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>{t('Cancel')}</Button>
          <Button type="submit" loading={busy}>{t('Publish for 30 days')}</Button>
        </div>
      </form>
    </Modal>
  );
}
