/**
 * Turns wardrobe items into something the 3D viewer can wear.
 *
 * This file is imported by the page, so it must not import three.js at the top level (that would
 * pull the 3D engine into the main bundle). The texture code loads it with a dynamic import.
 */
import { signedImageUrl } from '@/lib/data';
import type { Texture } from 'three';
import type { WardrobeItem } from '@/types';
import type { BottomKind, GarmentSpec, Outfit, Slot } from './types';

export const SLOT_LABEL: Record<Slot | 'accessory', string> = {
  top: 'Tops', outer: 'Outerwear', bottom: 'Bottoms', dress: 'Dresses', shoes: 'Shoes', accessory: 'Accessories',
};

/**
 * Maps a wardrobe category to an outfit slot by keyword.
 * VERIFY against CATEGORY_OPTIONS in '@/config/options'. If your category values differ
 * (for example 'activewear'), add a keyword here. Unknown categories become accessories.
 */
export function slotFor(category: string): Slot | 'accessory' {
  const c = category.toLowerCase();
  if (/dress|jumpsuit|romper|gown/.test(c)) return 'dress';
  if (/outer|jacket|coat|blazer|cardigan|parka/.test(c)) return 'outer';
  if (/bottom|pant|trouser|jean|skirt|short|legging/.test(c)) return 'bottom';
  if (/shoe|sneaker|boot|footwear|sandal|heel/.test(c)) return 'shoes';
  if (/top|shirt|tee|sweater|knit|blouse|hoodie|jumper|tank/.test(c)) return 'top';
  return 'accessory';
}

export function bottomKind(it: Pick<WardrobeItem, 'name' | 'category'>): BottomKind {
  const t = `${it.name} ${it.category}`.toLowerCase();
  if (/skirt/.test(t)) return 'skirt';
  if (/short/.test(t) && !/shortsleeve|short sleeve/.test(t)) return 'shorts';
  return 'pants';
}

const NAMED: [RegExp, string][] = [
  [/black/, '#232323'], [/white|ivory/, '#F4F1EA'], [/grey|gray|charcoal/, '#8C8C8C'], [/navy/, '#1E2A44'],
  [/denim|indigo/, '#4F6D94'], [/blue/, '#3F6FB5'], [/beige|nude|sand/, '#D8C3A5'], [/cream/, '#EFE6D2'],
  [/khaki|tan|camel/, '#B79B6A'], [/brown|chocolate/, '#6B4A32'], [/olive/, '#6B7040'], [/sage/, '#A3B18A'],
  [/green|forest/, '#4F7352'], [/burgundy|maroon|wine/, '#6E2433'], [/red/, '#B23A32'], [/pink|blush/, '#E3A4B0'],
  [/purple|lilac|lavender/, '#8A6FB0'], [/yellow|mustard/, '#E2C14B'], [/orange|rust|terracotta/, '#D9803A'],
];

/** Free-text colour from the wardrobe form to a hex value. Falls back to brand sage. */
export function colorFromName(name: string | null): string {
  const c = (name ?? '').toLowerCase();
  return NAMED.find(([re]) => re.test(c))?.[1] ?? '#A3B18A';
}

export const COLOR_SWATCHES = [
  '#232323', '#F4F1EA', '#8C8C8C', '#1E2A44', '#4F6D94', '#A3B18A', '#344E41', '#6B4A32', '#D8C3A5', '#B23A32', '#C78665',
];

/** Texture state per wardrobe item: a ready texture, 'failed', or absent while loading. */
export type TextureMap = Record<string, Texture | 'failed' | undefined>;

export function outfitSpecs(
  outfit: Outfit, items: Map<string, WardrobeItem>, colors: Record<string, string>, tex: TextureMap,
): GarmentSpec[] {
  const out: GarmentSpec[] = [];
  for (const slot of ['dress', 'top', 'bottom', 'outer', 'shoes'] as const) {
    const id = outfit[slot];
    const it = id ? items.get(id) : undefined;
    if (!it) continue;
    const t = tex[it.id];
    const texture = t && t !== 'failed' ? t : null;
    // With a texture the colour is a multiplier (white = unchanged). Without one it is the fabric.
    const color = colors[it.id] ?? (texture ? '#ffffff' : colorFromName(it.color));
    out.push({ key: it.id, slot, kind: slot === 'bottom' ? bottomKind(it) : undefined, texture, color });
  }
  return out;
}

// ── wardrobe photo -> texture ──────────────────────────────────────────────

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // needed to read pixels. Your storage bucket must send CORS headers.
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the garment photo.'));
    img.src = url;
  });
}

/**
 * Cuts the garment out of its photo, crops to it, and fills everything else with the garment's
 * average colour. That filled area is what shows on the back and sides of the avatar.
 *
 * Fallback strategy: transparent PNGs use their alpha. Photos on a plain background are keyed out
 * with a flood fill from the border. For messy photos, replace this step with a segmentation
 * service (see NOT_CONNECTED below).
 */
async function makeTexture(img: HTMLImageElement): Promise<Texture> {
  const THREE = await import('three');
  const MAX = 512;
  const sc = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(8, Math.round(img.naturalWidth * sc)), h = Math.max(8, Math.round(img.naturalHeight * sc));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available.');
  ctx.drawImage(img, 0, 0, w, h);
  let px: Uint8ClampedArray;
  try { px = ctx.getImageData(0, 0, w, h).data; }
  catch { throw new Error('The garment photo cannot be read (check CORS on your image storage).'); }

  const mask = new Uint8Array(w * h);
  let transparent = 0;
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] < 200) transparent++;

  if (transparent / (w * h) > 0.03) {
    for (let i = 0; i < w * h; i++) mask[i] = px[i * 4 + 3] > 40 ? 1 : 0;
  } else {
    const med = (ch: number) => {
      const v: number[] = [];
      for (let x = 0; x < w; x += 3) { v.push(px[x * 4 + ch], px[((h - 1) * w + x) * 4 + ch]); }
      for (let y = 0; y < h; y += 3) { v.push(px[y * w * 4 + ch], px[(y * w + w - 1) * 4 + ch]); }
      return v.sort((a, b) => a - b)[v.length >> 1];
    };
    const br = med(0), bg = med(1), bb = med(2);
    const near = (i: number) => Math.hypot(px[i * 4] - br, px[i * 4 + 1] - bg, px[i * 4 + 2] - bb) < 42;
    const bgFlag = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0, tail = 0;
    const push = (i: number) => { if (!bgFlag[i] && near(i)) { bgFlag[i] = 1; queue[tail++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i / w) | 0;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    for (let i = 0; i < w * h; i++) mask[i] = bgFlag[i] ? 0 : 1;
  }

  // Erode one pixel to drop the halo where the garment edge blends with the background.
  const eroded = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (mask[i] && (!mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w])) eroded[i] = 0;
  }

  let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0, r = 0, g = 0, b = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!eroded[i]) continue;
    count++; r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const useAll = count < w * h * 0.04; // cut-out failed: use the whole photo rather than a speck
  if (useAll) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const n = Math.max(1, useAll ? w * h : count);
  let ar = 128, ag = 140, ab = 120;
  if (!useAll) { ar = r / n; ag = g / n; ab = b / n; }

  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = bw; out.height = bh;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('Canvas is not available.');
  const data = octx.createImageData(bw, bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const si = (y + y0) * w + (x + x0), di = (y * bw + x) * 4;
    const keep = useAll || eroded[si];
    data.data[di] = keep ? px[si * 4] : ar;
    data.data[di + 1] = keep ? px[si * 4 + 1] : ag;
    data.data[di + 2] = keep ? px[si * 4 + 2] : ab;
    data.data[di + 3] = 255;
  }
  octx.putImageData(data, 0, 0);

  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const cache = new Map<string, Promise<Texture>>();

/** Cached per image path. A failed load is not cached, so a retry can succeed. */
export function loadGarmentTexture(imagePath: string): Promise<Texture> {
  const hit = cache.get(imagePath);
  if (hit) return hit;
  const p = signedImageUrl(imagePath).then(loadImage).then(makeTexture);
  cache.set(imagePath, p);
  p.catch(() => cache.delete(imagePath));
  return p;
}

// ── optional services that are NOT connected yet ───────────────────────────

/**
 * Better-than-fallback pipeline stages. None of these are implemented or called yet, and the UI
 * lists them as "not connected" on purpose. See INTEGRATION.md, section "Connecting AI".
 */
export const NOT_CONNECTED = [
  { id: 'segmentation', label: 'Garment segmentation', does: 'Cleaner cut-outs from busy photos than the built-in background removal.' },
  { id: 'reconstruction', label: '3D garment reconstruction', does: 'Turns a 2D photo into a real 3D garment that is fitted to the avatar.' },
  { id: 'tryon', label: 'AI virtual try-on', does: 'Photoreal result, fed with a render of your avatar, never a photo of you.' },
] as const;
