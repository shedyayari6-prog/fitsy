import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Flag, Phone, Plus, Search, Store as StoreIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useApp } from '@/hooks/useApp';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { Button, CardSkeleton, Chip, EmptyState, ErrorNotice, Field, Input, Modal, Notice, Select } from '@/components/ui';
import { MascotMessage } from '@/components/mascot/MascotMessage';
import { ListingCard, StoreImage, money } from '@/components/store/StoreBits';
import { SellForm } from '@/components/store/SellForm';
import { CATEGORY_OPTIONS } from '@/config/options';
import {
  CONDITIONS, CONTACT_TYPES, approximateLocation, countryName, daysLeft, deleteListing, listStore, matchListing,
  reportListing, revealContact, setListingStatus, type Geo,
} from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { errMessage } from '@/lib/util';
import { stagger } from '@/lib/animations';
import type { ContactType, StoreListing } from '@/types';

type Tab = 'foryou' | 'all' | 'mine';
const GEO_PREF = 'fitsy.useGeo';
const REPORT_REASONS = [
  { value: 'scam', label: 'Looks like a scam' }, { value: 'prohibited', label: 'Not allowed here' },
  { value: 'wrong_info', label: 'Wrong information' }, { value: 'offensive', label: 'Offensive' }, { value: 'other', label: 'Other' },
];

function contactHref(type: ContactType, value: string): string | null {
  const v = value.trim();
  if (type === 'email' && /^\S+@\S+\.\S+$/.test(v)) return `mailto:${v}`;
  const digits = v.replace(/[^\d+]/g, '');
  if (type === 'phone' && /^\+?\d{6,15}$/.test(digits)) return `tel:${digits}`;
  if (type === 'whatsapp' && /^\+?\d{6,15}$/.test(digits)) return `https://wa.me/${digits.replace('+', '')}`;
  return null;
}

export default function StorePage() {
  const { user, demo } = useAuth();
  const { profile } = useApp();
  const { toast } = useToast();
  const { t, lang } = useT();
  const uid = user!.id;
  const [items, setItems] = useState<StoreListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('foryou');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [sellOpen, setSellOpen] = useState(false);
  const [open, setOpen] = useState<StoreListing | null>(null);
  const [contact, setContact] = useState<{ type: ContactType; value: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [useGeo, setUseGeo] = useState(() => { try { return localStorage.getItem(GEO_PREF) !== '0'; } catch { return true; } });
  const [geo, setGeo] = useState<Geo>({ country: null, city: null });

  const load = useCallback(async () => {
    setError(null);
    try { setItems(await listStore()); } catch (e) { setError(errMessage(e, t('Could not load the store.'))); }
  }, [t]);
  useEffect(() => { if (!demo) void load(); }, [load, demo]);

  useEffect(() => {
    try { localStorage.setItem(GEO_PREF, useGeo ? '1' : '0'); } catch { /* ignore */ }
    if (!useGeo || demo || !supabase) { setGeo({ country: null, city: null }); return; }
    let live = true;
    void approximateLocation().then((g) => { if (live) setGeo(g); });
    return () => { live = false; };
  }, [useGeo, demo]);

  const scored = useMemo(() => (items ?? []).map((l) => ({ l, m: matchListing(l, profile, geo) })), [items, profile, geo]);

  const shown = useMemo(() => {
    const text = q.trim().toLowerCase();
    let list = scored.filter(({ l }) =>
      (!cat || l.category === cat) &&
      (!text || [l.title, l.color, l.city, l.description].some((f) => f.toLowerCase().includes(text))));
    if (tab === 'mine') list = list.filter(({ l }) => l.seller_id === uid);
    else list = list.filter(({ l }) => l.seller_id !== uid && l.status === 'active');
    if (tab === 'foryou') list = list.filter(({ m }) => m.score > 0);
    return [...list].sort((a, b) => b.m.score - a.m.score || +new Date(b.l.created_at) - +new Date(a.l.created_at));
  }, [scored, tab, q, cat, uid]);

  const openListing = (l: StoreListing) => { setOpen(l); setContact(null); setReporting(false); };

  const showContact = async () => {
    if (!open) return;
    setBusy('contact');
    try { setContact(await revealContact(open.id)); }
    catch (e) { toast(errMessage(e), 'error'); }
    finally { setBusy(null); }
  };

  const report = async (reason: string) => {
    if (!open) return;
    setBusy('report');
    try { await reportListing(open.id, reason); toast(t('Thanks. We will review this listing.'), 'success'); setReporting(false); }
    catch (e) { toast(errMessage(e), 'error'); }
    finally { setBusy(null); }
  };

  const sold = async (l: StoreListing) => {
    setBusy('sold');
    try { await setListingStatus(l.id, l.status === 'sold' ? 'active' : 'sold'); setOpen(null); await load(); }
    catch (e) { toast(errMessage(e), 'error'); } finally { setBusy(null); }
  };
  const remove = async (l: StoreListing) => {
    setBusy('del');
    try { await deleteListing(l); setOpen(null); toast(t('Listing removed.'), 'info'); await load(); }
    catch (e) { toast(errMessage(e, t('Could not remove that listing.')), 'error'); } finally { setBusy(null); }
  };

  if (demo) {
    return (
      <div className="page">
        <header className="page__head"><h1>{t('Fitsy Store')}</h1></header>
        <Notice title={t('Needs Supabase')} tone="warn">{t('The store needs Supabase. It is not available in demo mode.')}</Notice>
      </div>
    );
  }

  const mine = open?.seller_id === uid;
  const href = contact ? contactHref(contact.type, contact.value) : null;

  return (
    <div className="page">
      <header className="page__head row-between">
        <div><h1>{t('Fitsy Store')}</h1><p className="muted">{t('Buy and sell second-hand pieces. Listings stay online for 30 days.')}</p></div>
        <Button icon={<Plus size={16} />} onClick={() => setSellOpen(true)}>{t('Sell a piece')}</Button>
      </header>

      <MascotMessage mood="happy" action="recommending">
        {t('Pieces that match your style, your colours and your area show up first. Check the “For you” tab.')}
      </MascotMessage>

      <label className="check check--card">
        <input type="checkbox" checked={useGeo} onChange={(e) => setUseGeo(e.target.checked)} />
        <span>
          <strong>{t('Show nearby listings first')}</strong>
          <small>{geo.country
            ? t('Your connection suggests you are in {country}. Your IP address is used for this lookup only and is never stored.', { country: countryName(geo.country, lang) })
            : t('We estimate your country from your connection. Your IP address is used for this lookup only and is never stored. Your profile city is used as a fallback.')}</small>
        </span>
      </label>

      <div className="tabs" role="tablist" aria-label={t('Store sections')}>
        {([['foryou', 'For you'], ['all', 'All listings'], ['mine', 'My listings']] as [Tab, string][]).map(([k, label]) => (
          <Chip key={k} selected={tab === k} onClick={() => setTab(k)}>{t(label)}</Chip>
        ))}
      </div>

      <div className="filters" role="search" aria-label={t('Filter listings')}>
        <Field label={t('Search')} htmlFor="st-q">
          <div className="input-icon"><Search size={16} aria-hidden /><Input id="st-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Title, colour or city')} /></div>
        </Field>
        <Field label={t('Category')} htmlFor="st-c">
          <Select id="st-c" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{t('All')}</option>{CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{t(c.label)}</option>)}
          </Select>
        </Field>
      </div>

      {error && <ErrorNotice message={error} onRetry={() => void load()} />}
      {items === null && !error && <div className="listings"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}

      {items && shown.length === 0 && (
        <EmptyState mood="sad"
          title={tab === 'mine' ? t('You have nothing for sale') : tab === 'foryou' ? t('No matches yet') : t('Nothing here yet')}
          body={tab === 'mine' ? t('Sell a piece you no longer wear. It takes two minutes.')
            : tab === 'foryou' ? t('Complete your style profile or browse all listings. New pieces are added every day.')
            : t('Be the first to list something.')}
          action={tab === 'foryou' ? <Button variant="soft" onClick={() => setTab('all')}>{t('Browse all listings')}</Button>
            : <Button icon={<StoreIcon size={16} />} onClick={() => setSellOpen(true)}>{t('Sell a piece')}</Button>} />
      )}

      {items && shown.length > 0 && (
        <motion.ul className="listings" variants={stagger(0.04)} initial="hidden" animate="show">
          {shown.map(({ l, m }) => <ListingCard key={l.id} l={l} match={m} onOpen={() => openListing(l)} />)}
        </motion.ul>
      )}

      <SellForm open={sellOpen} uid={uid} profile={profile} onClose={() => setSellOpen(false)}
        onCreated={() => { setSellOpen(false); toast(t('Your listing is live for 30 days.'), 'success'); setTab('mine'); void load(); }} />

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && (
          <>
            <div className="listing__big"><StoreImage path={open.image_path} alt={open.title} /></div>
            <p className="listing__price listing__price--big">{money(open, lang)}</p>
            <div className="tags">
              <span className="tag">{t(CATEGORY_OPTIONS.find((c) => c.value === open.category)?.label ?? 'Other')}</span>
              <span className="tag">{t(CONDITIONS.find((c) => c.value === open.condition)?.label ?? open.condition)}</span>
              <span className="tag">{t('Size')}: {open.size}</span>
              <span className="tag">{open.color}</span>
              {open.style_tags.map((s) => <span key={s} className="tag tag--sage">{t(s)}</span>)}
            </div>
            <p>{open.description}</p>
            <div className="seller">
              <strong>{open.seller_name}</strong>
              <span className="muted small">{open.city}, {countryName(open.country, lang)} · {t(daysLeft(open) === 1 ? '{n} day left' : '{n} days left', { n: daysLeft(open) })}</span>
              <p className="small">{open.seller_info}</p>
            </div>

            {scored.find((x) => x.l.id === open.id)?.m.reasons.length ? (
              <p className="small muted">{scored.find((x) => x.l.id === open.id)!.m.reasons.map((r) => t(r)).join(' · ')}</p>
            ) : null}

            {mine ? (
              <div className="row-end">
                <Button variant="soft" loading={busy === 'sold'} onClick={() => void sold(open)}>{open.status === 'sold' ? t('Mark as available') : t('Mark as sold')}</Button>
                <Button variant="danger" loading={busy === 'del'} onClick={() => void remove(open)}>{t('Delete listing')}</Button>
              </div>
            ) : (
              <>
                {!contact ? (
                  <Button icon={<Phone size={16} />} loading={busy === 'contact'} onClick={() => void showContact()}>{t('Show contact')}</Button>
                ) : (
                  <Notice title={t(CONTACT_TYPES.find((c) => c.value === contact.type)?.label ?? 'Contact')}>
                    {href ? <a href={href} target="_blank" rel="noopener noreferrer">{contact.value}</a> : contact.value}
                  </Notice>
                )}
                <p className="muted small">{t('Stay safe: meet in a public place, check the piece before paying, and never send money in advance.')}</p>
                {!reporting ? (
                  <button className="link-btn" onClick={() => setReporting(true)}><Flag size={13} aria-hidden /> {t('Report this listing')}</button>
                ) : (
                  <div className="chips" role="group" aria-label={t('Reason')}>
                    {REPORT_REASONS.map((r) => <Chip key={r.value} disabled={busy === 'report'} onClick={() => void report(r.value)}>{t(r.label)}</Chip>)}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
