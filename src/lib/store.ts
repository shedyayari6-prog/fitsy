/** Fitsy Store data layer. Needs Supabase (there is no demo mode for a marketplace). */
import { supabase } from './supabase';
import { MAX_IMAGE_BYTES } from './data';
import type { ContactType, Profile, StoreDraft, StoreListing } from '@/types';

const sb = () => {
  if (!supabase) throw new Error('The store needs Supabase. It is not available in demo mode.');
  return supabase;
};
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export const CURRENCIES = ['TND', 'EUR', 'USD', 'GBP', 'MAD', 'DZD', 'EGP', 'AED', 'SAR', 'CAD', 'CHF', 'TRY'];
export const COUNTRIES = ['TN', 'DZ', 'MA', 'EG', 'LY', 'FR', 'BE', 'CH', 'CA', 'US', 'GB', 'DE', 'ES', 'IT', 'NL', 'PT', 'TR', 'AE', 'SA', 'QA', 'KW', 'JO', 'LB', 'SN', 'CI'];
export const CONDITIONS: { value: StoreListing['condition']; label: string }[] = [
  { value: 'new_with_tags', label: 'New with tags' }, { value: 'like_new', label: 'Like new' },
  { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' },
];
export const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' }, { value: 'phone', label: 'Phone' }, { value: 'email', label: 'Email' }, { value: 'other', label: 'Other' },
];

export const daysLeft = (l: Pick<StoreListing, 'expires_at'>) =>
  Math.max(0, Math.ceil((new Date(l.expires_at).getTime() - Date.now()) / 86_400_000));

export function countryName(code: string, lang: string): string {
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code; } catch { return code; }
}

const COLS = 'id, seller_id, title, category, style_tags, color, size, condition, description, price, currency, seller_name, seller_info, country, city, image_path, status, created_at, expires_at';

/** Live listings from other people + the user's own. RLS already hides expired / sold / reported ones. */
export async function listStore(): Promise<StoreListing[]> {
  const { data, error } = await sb().from('store_listings').select(COLS)
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(300);
  if (error) throw error;
  return (data ?? []) as StoreListing[];
}

export async function uploadStoreImage(uid: string, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('That image is larger than 5 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${uid}/${newId()}.${ext}`;
  const { error } = await sb().storage.from('store').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function storeImageUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from('store').createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export async function removeStoreImage(path: string): Promise<void> {
  if (supabase) await supabase.storage.from('store').remove([path]);
}

/** True when the signed-in user is a store admin. Only admins can publish listings (enforced by the database). */
export async function isStoreAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_store_admin');
  if (error) return false;
  return data === true;
}

export async function createListing(uid: string, d: StoreDraft, image_path: string): Promise<void> {
  const { data, error } = await sb().from('store_listings').insert({
    seller_id: uid, title: d.title.trim(), category: d.category, style_tags: d.style_tags, color: d.color.trim(), size: d.size.trim(),
    condition: d.condition, description: d.description.trim(), price: Number(d.price), currency: d.currency,
    seller_name: d.seller_name.trim(), seller_info: d.seller_info.trim(), country: d.country, city: d.city.trim(), image_path,
  }).select('id').single();
  if (error) {
    if (/admins_only/.test(error.message)) throw new Error('Only store admins can add listings.');
    if (/listing_limit/.test(error.message)) throw new Error('You already have 10 live listings. Remove one or wait for it to expire.');
    throw error;
  }
  const { error: cErr } = await sb().from('store_contacts').insert({ listing_id: data.id, contact_type: d.contact_type, contact_value: d.contact_value.trim() });
  if (cErr) {
    await sb().from('store_listings').delete().eq('id', data.id);
    throw cErr;
  }
}

export async function setListingStatus(id: string, status: 'active' | 'sold'): Promise<void> {
  const { error } = await sb().from('store_listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteListing(l: StoreListing): Promise<void> {
  const { error } = await sb().from('store_listings').delete().eq('id', l.id);
  if (error) throw error;
  await removeStoreImage(l.image_path);
}

export async function revealContact(id: string): Promise<{ type: ContactType; value: string }> {
  const { data, error } = await sb().rpc('get_listing_contact', { p_listing: id });
  if (error) throw error;
  if (!data?.ok) {
    if (data?.reason === 'rate_limited') throw new Error('You have viewed a lot of contacts today. Please try again tomorrow.');
    throw new Error('This listing is no longer available.');
  }
  return { type: data.type, value: data.value };
}

export async function reportListing(id: string, reason: string): Promise<void> {
  const { error } = await sb().rpc('report_listing', { p_listing: id, p_reason: reason });
  if (error) throw error;
}

// ── approximate location from the connection (country only; the IP is never stored) ──
export interface Geo { country: string | null; city: string | null }
const GEO_KEY = 'fitsy.geo';

export async function approximateLocation(): Promise<Geo> {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) return JSON.parse(cached) as Geo;
  } catch { /* storage unavailable */ }
  try {
    const { data, error } = await sb().functions.invoke('store-geo', { body: {} });
    if (error) throw error;
    const g = { country: data?.country ?? null, city: data?.city ?? null } as Geo;
    try { sessionStorage.setItem(GEO_KEY, JSON.stringify(g)); } catch { /* ignore */ }
    return g;
  } catch { return { country: null, city: null }; }
}

// ── matching ───────────────────────────────────────────────────────────────────
export interface Match { score: number; reasons: string[] }

/** Scores a listing against the buyer's saved preferences and location. Pure, so it is easy to test. */
export function matchListing(l: StoreListing, p: Profile | null, geo: Geo): Match {
  const reasons: string[] = [];
  let score = 0;
  if (p) {
    if (p.preferred_categories.includes(l.category)) { score += 3; reasons.push('Matches the clothing types you like'); }
    const styles = l.style_tags.filter((s) => p.style_preferences.includes(s));
    if (styles.length) { score += 2 * Math.min(styles.length, 2); reasons.push('Matches your style'); }
    if (p.preferred_colors.some((c) => c.toLowerCase() === l.color.trim().toLowerCase())) { score += 2; reasons.push('In a colour you like'); }
  }
  const sameCountry = !!geo.country && geo.country === l.country;
  const city = (geo.city ?? p?.location_city ?? '').trim().toLowerCase();
  if (sameCountry) { score += 2; reasons.push('In your country'); }
  if (city && l.city.trim().toLowerCase() === city) { score += 2; reasons.push('In your city'); }
  return { score, reasons };
}

// ── store credit ───────────────────────────────────────────────────────────────
export interface CreditTier { percent: number; cost: number }
export interface Coupon { id: string; percent: number; code: string; cost: number; expires_at: string; used_at: string | null }
export interface LedgerRow { id: number; delta: number; reason: 'purchase' | 'coupon'; created_at: string }
export interface CreditSummary { balance: number; tiers: CreditTier[]; coupons: Coupon[]; ledger: LedgerRow[] }
export interface SaleResult { final_price: number; discount: number; currency: string; points: number }

export const MAX_COUPONS = 3;
export const couponState = (c: Coupon): 'active' | 'used' | 'expired' =>
  c.used_at ? 'used' : new Date(c.expires_at).getTime() <= Date.now() ? 'expired' : 'active';

/** Only the signed-in user's own rows come back (row level security). */
export async function getCreditSummary(): Promise<CreditSummary> {
  const c = sb();
  const [a, t, cp, l] = await Promise.all([
    c.from('store_credit_accounts').select('balance').maybeSingle(),
    c.from('store_credit_tiers').select('percent, cost').order('percent'),
    c.from('store_coupons').select('id, percent, code, cost, expires_at, used_at').order('created_at', { ascending: false }).limit(20),
    c.from('store_credit_ledger').select('id, delta, reason, created_at').order('created_at', { ascending: false }).limit(10),
  ]);
  for (const r of [a, t, cp, l]) if (r.error) throw r.error;
  return {
    balance: (a.data as { balance: number } | null)?.balance ?? 0,
    tiers: (t.data ?? []) as CreditTier[],
    coupons: (cp.data ?? []) as Coupon[],
    ledger: (l.data ?? []) as LedgerRow[],
  };
}

export async function getCreditBalance(): Promise<number> {
  if (!supabase) return 0;
  const { data } = await supabase.from('store_credit_accounts').select('balance').maybeSingle();
  return (data as { balance: number } | null)?.balance ?? 0;
}

export async function exchangeQuestCoins(): Promise<{ questCoins: number; balance: number; converted: number }> {
  const { data, error } = await sb().rpc('gq_exchange_coins');
  if (error) throw error;
  if (!data?.ok) {
    if (data?.reason === 'not_enough') throw new Error('You need at least 10 quest coins to exchange.');
    throw new Error('Could not exchange quest coins.');
  }
  return { questCoins: data.coins, balance: data.balance, converted: data.converted };
}

export async function redeemCoupon(percent: number): Promise<{ code: string; balance: number }> {
  const { data, error } = await sb().rpc('store_redeem', { p_percent: percent });
  if (error) throw error;
  if (!data?.ok) {
    if (data?.reason === 'not_enough') throw new Error('You do not have enough credit points yet.');
    if (data?.reason === 'too_many') throw new Error('You already hold 3 unused coupons. Use one first.');
    throw new Error('Could not create that coupon.');
  }
  return { code: data.code, balance: data.balance };
}

/** Admin only. Marks the listing sold to the buyer, applies their coupon if given, and credits the buyer. */
export async function completeSale(listingId: string, buyerEmail: string, code: string): Promise<SaleResult> {
  const { data, error } = await sb().rpc('store_complete_sale', { p_listing: listingId, p_buyer_email: buyerEmail.trim(), p_code: code.trim() || null });
  if (error) throw error;
  if (!data?.ok) {
    const m: Record<string, string> = {
      buyer_not_found: 'No buyer found with that email.', bad_coupon: 'That coupon is not valid for this buyer.',
      self_sale: 'You cannot record a sale to yourself.', listing_unavailable: 'This listing is no longer available.',
      forbidden: 'Only store admins can record a sale.', no_rate: 'This currency is not set up for store credit.',
    };
    throw new Error(m[data?.reason as string] ?? 'Could not record this sale.');
  }
  return { final_price: data.final_price, discount: data.discount, currency: data.currency, points: data.points };
}

// ── shared cache of live listings (used by the stylist's store picks) ──────────
let liveCache: { at: number; data: StoreListing[] } | null = null;
let liveInflight: Promise<StoreListing[]> | null = null;

/** Live listings, cached for 60 seconds so several outfit cards share one request. Empty when there is no store. */
export async function liveListings(): Promise<StoreListing[]> {
  if (!supabase) return [];
  if (liveCache && Date.now() - liveCache.at < 60_000) return liveCache.data;
  liveInflight ??= listStore().then((d) => { liveCache = { at: Date.now(), data: d }; return d; }).finally(() => { liveInflight = null; });
  return liveInflight;
}

/** Drop the cache after a listing changes (sold, deleted, created). */
export const clearLiveListings = () => { liveCache = null; };