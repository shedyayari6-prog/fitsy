/**
 * Matches the pieces an AI outfit calls for to real, live Fitsy Store listings.
 * Pure functions with no network access, so they are easy to test. The AI never invents
 * a store item: it can only point at a listing that exists right now.
 */
import type { OutfitData, StoreListing, WardrobeCategory } from '@/types';

/** Maps free text from the stylist ("white sneakers", "denim jacket") to a store category. */
const EXACT: WardrobeCategory[] = ['tops', 'trousers', 'jeans', 'jackets', 'coats', 'shoes', 'bags', 'accessories', 'dresses'];

export function storeCategoryFor(category: string, name = ''): WardrobeCategory | null {
  const exact = category.trim().toLowerCase() as WardrobeCategory;
  if (EXACT.includes(exact)) return exact;   // the stylist already uses these exact names
  const t = `${category} ${name}`.toLowerCase();
  if (/dress|gown|jumpsuit|romper/.test(t)) return 'dresses';
  if (/jean|denim/.test(t) && !/jacket/.test(t)) return 'jeans';
  if (/coat|parka|trench|overcoat/.test(t)) return 'coats';
  if (/jacket|blazer|bomber|cardigan|outerwear/.test(t)) return 'jackets';
  if (/shoe|sneaker|boot|loafer|sandal|heel|trainer|footwear/.test(t)) return 'shoes';
  if (/bag|tote|backpack|purse|handbag/.test(t)) return 'bags';
  if (/trouser|pant|chino|short|skirt|legging|jogger|bottom/.test(t)) return 'trousers';
  if (/top|shirt|tee|t-shirt|sweater|hoodie|blouse|knit|jumper|polo|tank/.test(t)) return 'tops';
  if (/accessor|scarf|belt|hat|cap|watch|jewel|glasses|sunglass|necklace|bracelet|ring/.test(t)) return 'accessories';
  return null;
}

/** Categories that can stand in for each other (a jeans listing suits a "trousers" need). */
const SIBLINGS: Partial<Record<WardrobeCategory, WardrobeCategory[]>> = {
  trousers: ['trousers', 'jeans'], jeans: ['jeans', 'trousers'], jackets: ['jackets', 'coats'], coats: ['coats', 'jackets'],
};

export interface Want { label: string; category: WardrobeCategory; color?: string; name: string }
/** ai = the stylist itself chose this listing for the piece. Otherwise it is our best match for a missing piece. */
export interface Pick { listing: StoreListing; want: string; score: number; ai: boolean }

/** The pieces this outfit still needs: anything not already in the user's wardrobe. */
export function wantsFromOutfit(o: OutfitData, skip: Set<string> = new Set()): Want[] {
  const wants: Want[] = [];
  const have = new Set<WardrobeCategory>();
  for (const p of o.pieces ?? []) {
    const cat = storeCategoryFor(p.category, p.name);
    if (!cat) continue;
    if (p.fromWardrobe) have.add(cat);
    else if (p.storeListingId && skip.has(p.name)) have.add(cat);   // already covered by the stylist's own pick
    else wants.push({ label: p.name, category: cat, color: p.color, name: p.name });
  }
  const extra = (text: string | undefined, kind: string) => {
    if (!text) return;
    const cat = storeCategoryFor(kind, text);
    if (cat && !have.has(cat) && !wants.some((w) => w.category === cat)) wants.push({ label: text, category: cat, name: text });
  };
  extra(o.shoes, 'shoes');
  extra(o.outerwear, 'jacket');
  return wants;
}

const STOP = new Set(['the', 'and', 'with', 'for', 'light', 'dark', 'classic', 'simple', 'casual', 'piece', 'your']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));

export function pickStoreItems(
  o: OutfitData, listings: StoreListing[],
  opts: { uid: string; extraScore?: (l: StoreListing) => number; max?: number; perWant?: number },
): Pick[] {
  const { uid, extraScore, max = 4, perWant = 2 } = opts;
  const style = (o.style ?? '').toLowerCase();
  const used = new Set<string>();
  const out: Pick[] = [];
  const byId = new Map(listings.map((l) => [l.id, l]));
  const usable = (l: StoreListing | undefined): l is StoreListing =>
    !!l && l.status === 'active' && l.seller_id !== uid && new Date(l.expires_at).getTime() > Date.now();

  // 1. Listings the stylist chose itself (the server only keeps ids it really showed the model).
  const covered = new Set<string>();
  for (const p of o.pieces ?? []) {
    const l = p.storeListingId ? byId.get(p.storeListingId) : undefined;
    if (usable(l) && !used.has(l.id) && out.length < max) { used.add(l.id); covered.add(p.name); out.push({ listing: l, want: p.name, score: 100, ai: true }); }
  }

  // 2. Best matches for any other piece the user still needs.
  for (const want of wantsFromOutfit(o, covered)) {
    const cats = SIBLINGS[want.category] ?? [want.category];
    const wordsWanted = new Set(words(want.name));
    const ranked = listings
      .filter((l) => l.status === 'active' && l.seller_id !== uid && cats.includes(l.category) && new Date(l.expires_at).getTime() > Date.now())
      .map((l) => {
        let score = l.category === want.category ? 2 : 1;
        const lc = l.color.trim().toLowerCase(), wc = (want.color ?? '').trim().toLowerCase();
        if (wc && (lc === wc || lc.includes(wc) || wc.includes(lc))) score += 4;
        const hay = `${l.title} ${l.description} ${l.color}`.toLowerCase();
        let hits = 0;
        for (const w of wordsWanted) if (hay.includes(w)) hits++;
        score += Math.min(hits, 3);
        if (style && l.style_tags.some((s) => s.toLowerCase() === style)) score += 2;
        score += Math.min(extraScore?.(l) ?? 0, 6);
        return { l, score };
      })
      .sort((a, b) => b.score - a.score || +new Date(b.l.created_at) - +new Date(a.l.created_at));

    let n = 0;
    for (const r of ranked) {
      if (n >= perWant || out.length >= max) break;
      if (used.has(r.l.id)) continue;
      used.add(r.l.id);
      out.push({ listing: r.l, want: want.label, score: r.score, ai: false });
      n++;
    }
  }
  return out.sort((a, b) => Number(b.ai) - Number(a.ai) || b.score - a.score);
}
