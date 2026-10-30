/**
 * Persistence for the avatar and saved looks.
 *
 * With Supabase configured, rows live in `avatars` and `avatar_outfits` (see
 * supabase/migrations). Row Level Security restricts every row to its owner. Without Supabase
 * (demo mode, like the wardrobe page) data stays in this browser's localStorage.
 *
 * Only measurements and appearance preferences are stored. There is no photo field anywhere.
 */
import { supabase } from '@/lib/supabase';
import { sanitizeConfig } from '@/features/avatar/body';
import type { AvatarConfig, Outfit, SavedLook } from '@/features/avatar/types';

const AVATAR_KEY = (uid: string) => `fitsy.avatar.${uid}`;
const LOOKS_KEY = (uid: string) => `fitsy.avatar.looks.${uid}`;

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64;

export function sanitizeOutfit(raw: unknown): Outfit {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const one = (v: unknown) => (isId(v) ? v : null);
  return {
    top: one(r.top), outer: one(r.outer), bottom: one(r.bottom), dress: one(r.dress), shoes: one(r.shoes),
    accessories: Array.isArray(r.accessories) ? r.accessories.filter(isId).slice(0, 12) : [],
  };
}

function sanitizeColors(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (isId(k) && typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v;
    }
  }
  return out;
}

function toLook(raw: unknown): SavedLook | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isId(r.id) || typeof r.name !== 'string') return null;
  return {
    id: r.id,
    name: r.name.slice(0, 60),
    outfit: sanitizeOutfit(r.slots ?? r.outfit),
    colors: sanitizeColors(r.colors),
    favorite: r.favorite === true,
    created_at: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
  };
}

function readLocal<T>(key: string, fallback: T): T {
  try { const t = localStorage.getItem(key); return t ? (JSON.parse(t) as T) : fallback; } catch { return fallback; }
}
function writeLocal(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { throw new Error('Could not save in this browser. Storage may be full or turned off.'); }
}

// ── avatar ─────────────────────────────────────────────────────────────────

export async function loadAvatar(uid: string): Promise<AvatarConfig | null> {
  if (!supabase) return sanitizeConfig(readLocal<unknown>(AVATAR_KEY(uid), null));
  const { data, error } = await supabase.from('avatars').select('config').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? sanitizeConfig((data as { config: unknown }).config) : null;
}

export async function saveAvatar(uid: string, config: AvatarConfig): Promise<void> {
  const clean = sanitizeConfig(config);
  if (!clean) throw new Error('That avatar could not be saved.');
  if (!supabase) return writeLocal(AVATAR_KEY(uid), clean);
  const { error } = await supabase.from('avatars').upsert({ user_id: uid, config: clean, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Deletes the avatar, its measurements and all saved looks. */
export async function deleteAvatar(uid: string): Promise<void> {
  if (!supabase) {
    try { localStorage.removeItem(AVATAR_KEY(uid)); localStorage.removeItem(LOOKS_KEY(uid)); } catch { /* nothing to remove */ }
    return;
  }
  const a = await supabase.from('avatar_outfits').delete().eq('user_id', uid);
  if (a.error) throw a.error;
  const b = await supabase.from('avatars').delete().eq('user_id', uid);
  if (b.error) throw b.error;
}

// ── saved looks ────────────────────────────────────────────────────────────

export async function listLooks(uid: string): Promise<SavedLook[]> {
  if (!supabase) return readLocal<unknown[]>(LOOKS_KEY(uid), []).map(toLook).filter((l): l is SavedLook => !!l);
  const { data, error } = await supabase.from('avatar_outfits').select('*').eq('user_id', uid).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toLook).filter((l): l is SavedLook => !!l);
}

export async function saveLook(uid: string, name: string, outfit: Outfit, colors: Record<string, string>): Promise<SavedLook> {
  const clean = { name: name.trim().slice(0, 60) || 'My look', slots: sanitizeOutfit(outfit), colors: sanitizeColors(colors) };
  if (!supabase) {
    const look: SavedLook = {
      id: crypto.randomUUID(), name: clean.name, outfit: clean.slots, colors: clean.colors, favorite: false, created_at: new Date().toISOString(),
    };
    writeLocal(LOOKS_KEY(uid), [look, ...(await listLooks(uid))]);
    return look;
  }
  const { data, error } = await supabase.from('avatar_outfits').insert({ user_id: uid, ...clean }).select('*').single();
  if (error) throw error;
  const look = toLook(data);
  if (!look) throw new Error('The saved look came back in an unexpected shape.');
  return look;
}

export async function setLookFavorite(uid: string, id: string, favorite: boolean): Promise<void> {
  if (!supabase) {
    writeLocal(LOOKS_KEY(uid), (await listLooks(uid)).map((l) => (l.id === id ? { ...l, favorite } : l)));
    return;
  }
  const { error } = await supabase.from('avatar_outfits').update({ favorite }).eq('id', id).eq('user_id', uid);
  if (error) throw error;
}

export async function deleteLook(uid: string, id: string): Promise<void> {
  if (!supabase) {
    writeLocal(LOOKS_KEY(uid), (await listLooks(uid)).filter((l) => l.id !== id));
    return;
  }
  const { error } = await supabase.from('avatar_outfits').delete().eq('id', id).eq('user_id', uid);
  if (error) throw error;
}
