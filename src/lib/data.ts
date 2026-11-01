/**
 * Data access layer. Every function takes the current user id.
 *  - With Supabase configured: talks to Postgres/Storage under the user's JWT (RLS enforced).
 *  - In demo mode (no Supabase credentials): uses localStorage ONLY. Nothing is sent anywhere,
 *    and the UI labels it as local demo data.
 */
import { supabase } from './supabase';
import { todayUTC } from './util';
import type {
  Achievement, ChatMessage, CompleteResult, Conversation, EarnedAchievement, Outfit, OutfitData,
  Profile, Progress, Quest, QuestCompletion, SavedOutfit, WardrobeDraft, WardrobeItem,
} from '@/types';

export const DEMO_ID = 'demo-local';
const isDemo = (uid: string) => uid === DEMO_ID || !supabase;
const sb = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

// ── local (demo) store ────────────────────────────────────────────────────────
const LS = 'sage.demo.';
function lget<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function lset<T>(key: string, value: T) {
  try { localStorage.setItem(LS + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}
export function clearDemoData() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(LS) || k === 'sage.demo').forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

// ── static quest/achievement definitions (used in demo mode; the DB holds the real ones) ──
interface QuestDef extends Quest { verifier: string }
const QUEST_DEFS: QuestDef[] = [
  { id: 'complete_profile', slug: 'complete_profile', title: 'Finish your style profile', description: 'Complete onboarding so Sage can personalise advice.', quest_type: 'once', xp_reward: 30, verifier: 'onboarding_done' },
  { id: 'ask_stylist', slug: 'ask_stylist', title: 'Ask your stylist a question', description: 'Send Sage a message about what to wear.', quest_type: 'daily', xp_reward: 10, verifier: 'asked' },
  { id: 'outfit_suggested', slug: 'outfit_suggested', title: 'Discover a new look', description: 'Get an outfit idea from Sage today.', quest_type: 'daily', xp_reward: 15, verifier: 'suggested' },
  { id: 'save_outfit', slug: 'save_outfit', title: 'Save an outfit you love', description: 'Save one outfit today.', quest_type: 'daily', xp_reward: 15, verifier: 'saved_today' },
  { id: 'wardrobe_3', slug: 'wardrobe_3', title: 'Add three pieces to your wardrobe', description: 'Build your digital closet to at least three items.', quest_type: 'once', xp_reward: 20, verifier: 'wardrobe_3' },
  { id: 'wardrobe_outfit', slug: 'wardrobe_outfit', title: 'Style what you already own', description: 'Create an outfit from your own wardrobe.', quest_type: 'daily', xp_reward: 20, verifier: 'wardrobe_outfit' },
  { id: 'learn_tip', slug: 'learn_tip', title: 'Learn one styling tip', description: "Read today's tip and take it in.", quest_type: 'daily', xp_reward: 5, verifier: 'none' },
];
const ACHIEVEMENT_DEFS: Achievement[] = [
  { id: 'first_steps', code: 'first_steps', name: 'First steps', description: 'Finished your style profile.', icon: 'footprints', xp_reward: 10 },
  { id: 'first_save', code: 'first_save', name: 'Keeper', description: 'Saved your first outfit.', icon: 'heart', xp_reward: 10 },
  { id: 'closet_starter', code: 'closet_starter', name: 'Closet starter', description: 'Added five pieces to your wardrobe.', icon: 'shirt', xp_reward: 20 },
  { id: 'chatty', code: 'chatty', name: 'Style chat', description: 'Sent five messages to your stylist.', icon: 'message-circle', xp_reward: 10 },
  { id: 'streak_3', code: 'streak_3', name: 'Three-day glow', description: 'Were active three days in a row.', icon: 'flame', xp_reward: 20 },
  { id: 'level_3', code: 'level_3', name: 'Level 3', description: 'Reached level 3.', icon: 'trophy', xp_reward: 0 },
];

export const levelFor = (xp: number) => 1 + Math.floor(xp / 100);

// ── profile ───────────────────────────────────────────────────────────────────
export const emptyProfile = (id: string): Profile => ({
  id, display_name: null, preferred_language: 'en', style_preferences: [], preferred_colors: [],
  preferred_occasions: [], preferred_categories: [], shopping_preferences: [], budget_preference: null,
  sizes: {}, location_city: null, location_lat: null, location_lon: null, weather_enabled: false,
  ai_share_wardrobe: true, onboarding_completed: false,
});

export async function getProfile(uid: string): Promise<Profile> {
  if (isDemo(uid)) return lget('profile', emptyProfile(uid));
  const { data, error } = await sb().from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;
  const { data: created, error: e2 } = await sb().from('profiles').insert({ id: uid }).select('*').single();
  if (e2) throw e2;
  return created as Profile;
}

export async function updateProfile(uid: string, patch: Partial<Profile>): Promise<Profile> {
  const { id: _ignored, ...clean } = patch;
  if (isDemo(uid)) {
    const next = { ...lget('profile', emptyProfile(uid)), ...clean };
    lset('profile', next);
    return next;
  }
  const { data, error } = await sb().from('profiles').update(clean).eq('id', uid).select('*').single();
  if (error) throw error;
  return data as Profile;
}

// ── wardrobe ──────────────────────────────────────────────────────────────────
export async function listWardrobe(uid: string): Promise<WardrobeItem[]> {
  if (isDemo(uid)) return lget<WardrobeItem[]>('wardrobe', []);
  const { data, error } = await sb().from('wardrobe_items').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WardrobeItem[];
}

export async function saveWardrobeItem(uid: string, draft: WardrobeDraft, id?: string): Promise<WardrobeItem> {
  if (isDemo(uid)) {
    const list = lget<WardrobeItem[]>('wardrobe', []);
    if (id) {
      const next = list.map((i) => (i.id === id ? { ...i, ...draft } : i));
      lset('wardrobe', next);
      return next.find((i) => i.id === id)!;
    }
    const item: WardrobeItem = { ...draft, id: newId(), user_id: uid, created_at: new Date().toISOString(), image_path: null };
    lset('wardrobe', [item, ...list]);
    return item;
  }
  if (id) {
    const { data, error } = await sb().from('wardrobe_items').update(draft).eq('id', id).select('*').single();
    if (error) throw error;
    return data as WardrobeItem;
  }
  const { data, error } = await sb().from('wardrobe_items').insert({ ...draft, user_id: uid }).select('*').single();
  if (error) throw error;
  return data as WardrobeItem;
}

export async function deleteWardrobeItem(uid: string, item: WardrobeItem): Promise<void> {
  if (isDemo(uid)) {
    lset('wardrobe', lget<WardrobeItem[]>('wardrobe', []).filter((i) => i.id !== item.id));
    return;
  }
  const { error } = await sb().from('wardrobe_items').delete().eq('id', item.id);
  if (error) throw error;
  if (item.image_path) await sb().storage.from('wardrobe').remove([item.image_path]);
}

const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function uploadWardrobeImage(uid: string, file: File): Promise<string> {
  if (isDemo(uid)) throw new Error('Photo upload needs Supabase Storage. It is not available in demo mode.');
  if (!ALLOWED_IMAGES.includes(file.type)) throw new Error('Please choose a JPG, PNG or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('That image is larger than 5 MB.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${uid}/${newId()}.${ext}`;
  const { error } = await sb().storage.from('wardrobe').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeStoredImage(uid: string, path: string): Promise<void> {
  if (isDemo(uid)) return;
  await sb().storage.from('wardrobe').remove([path]);
}

export async function signedImageUrl(path: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from('wardrobe').createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

// ── conversations ─────────────────────────────────────────────────────────────
export async function listConversations(uid: string): Promise<Conversation[]> {
  if (isDemo(uid)) return [];
  const { data, error } = await sb().from('conversations').select('id, title, updated_at')
    .order('updated_at', { ascending: false }).limit(30);
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

export async function getMessages(uid: string, conversationId: string): Promise<ChatMessage[]> {
  if (isDemo(uid)) return [];
  const { data, error } = await sb().from('messages').select('id, role, content, structured, created_at')
    .eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(200);
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function deleteConversation(uid: string, id: string): Promise<void> {
  if (isDemo(uid)) return;
  const { error } = await sb().from('conversations').delete().eq('id', id);
  if (error) throw error;
}

// ── outfits ───────────────────────────────────────────────────────────────────
export async function saveOutfit(uid: string, o: OutfitData): Promise<SavedOutfit> {
  if (isDemo(uid)) {
    const outfit: Outfit = { id: newId(), title: o.name, occasion: o.occasion ?? null, style: o.style ?? null, outfit_data: o, created_at: new Date().toISOString() };
    const saved: SavedOutfit = { id: newId(), outfit_id: outfit.id, is_favorite: false, created_at: outfit.created_at, outfit };
    lset('saved', [saved, ...lget<SavedOutfit[]>('saved', [])]);
    return saved;
  }
  const { data: outfit, error } = await sb().from('outfits').insert({
    user_id: uid, title: o.name.slice(0, 120), occasion: o.occasion?.slice(0, 80) ?? null,
    style: o.style?.slice(0, 60) ?? null, outfit_data: o,
  }).select('*').single();
  if (error) throw error;
  const { data: saved, error: e2 } = await sb().from('saved_outfits')
    .insert({ user_id: uid, outfit_id: outfit.id }).select('id, outfit_id, is_favorite, created_at').single();
  if (e2) {
    await sb().from('outfits').delete().eq('id', outfit.id);
    throw e2;
  }
  return { ...(saved as Omit<SavedOutfit, 'outfit'>), outfit: outfit as Outfit };
}

export async function listSavedOutfits(uid: string): Promise<SavedOutfit[]> {
  if (isDemo(uid)) return lget<SavedOutfit[]>('saved', []);
  const { data, error } = await sb().from('saved_outfits')
    .select('id, outfit_id, is_favorite, created_at, outfit:outfits(*)')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return ((data ?? []) as unknown as SavedOutfit[]).filter((s) => s.outfit);
}

export async function removeSavedOutfit(uid: string, saved: SavedOutfit): Promise<void> {
  if (isDemo(uid)) {
    lset('saved', lget<SavedOutfit[]>('saved', []).filter((s) => s.id !== saved.id));
    return;
  }
  // Deleting the outfit cascades to its saved_outfits row.
  const { error } = await sb().from('outfits').delete().eq('id', saved.outfit_id);
  if (error) throw error;
}

export async function setFavorite(uid: string, saved: SavedOutfit, value: boolean): Promise<void> {
  if (isDemo(uid)) {
    lset('saved', lget<SavedOutfit[]>('saved', []).map((s) => (s.id === saved.id ? { ...s, is_favorite: value } : s)));
    return;
  }
  const { error } = await sb().from('saved_outfits').update({ is_favorite: value }).eq('id', saved.id);
  if (error) throw error;
}

// ── gamification ──────────────────────────────────────────────────────────────
const defaultProgress = (uid: string): Progress => ({
  user_id: uid, total_xp: 0, quest_coins: 0, level: 1, current_streak: 0, longest_streak: 0, last_activity_date: null,
});
const demoProgress = (uid: string): Progress => {
  const saved = lget<Progress>('progress', defaultProgress(uid));
  return { ...defaultProgress(uid), ...saved, quest_coins: saved.quest_coins ?? lget<QuestCompletion[]>('completions', []).length };
};

export async function getProgress(uid: string): Promise<Progress> {
  if (isDemo(uid)) return demoProgress(uid);
  const { data, error } = await sb().from('user_progress').select('*').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return (data as Progress | null) ?? defaultProgress(uid);
}

export async function listQuests(uid: string): Promise<Quest[]> {
  if (isDemo(uid)) return QUEST_DEFS.map(({ verifier: _v, ...q }) => q);
  const { data, error } = await sb().from('quests').select('id, slug, title, description, quest_type, xp_reward').eq('active', true).order('xp_reward');
  if (error) throw error;
  return (data ?? []) as Quest[];
}

export async function listCompletions(uid: string): Promise<QuestCompletion[]> {
  if (isDemo(uid)) return lget<QuestCompletion[]>('completions', []);
  const { data, error } = await sb().from('quest_completions').select('quest_id, period_key, completion_date, xp_awarded')
    .order('completion_date', { ascending: false }).limit(300);
  if (error) throw error;
  return (data ?? []) as QuestCompletion[];
}

export async function listAchievements(uid: string): Promise<{ all: Achievement[]; earned: EarnedAchievement[] }> {
  if (isDemo(uid)) return { all: ACHIEVEMENT_DEFS, earned: lget<EarnedAchievement[]>('earned', []) };
  const [a, e] = await Promise.all([
    sb().from('achievements').select('id, code, name, description, icon, xp_reward'),
    sb().from('user_achievements').select('achievement_id, earned_at'),
  ]);
  if (a.error) throw a.error;
  if (e.error) throw e.error;
  return { all: (a.data ?? []) as Achievement[], earned: (e.data ?? []) as EarnedAchievement[] };
}

/**
 * Real mode: calls the security-definer SQL function complete_quest(), which verifies the
 * action server-side and enforces idempotency. Clients cannot write XP directly.
 * Demo mode: a local mirror of the same rules, for the local sandbox only.
 */
export async function completeQuest(uid: string, slug: string): Promise<CompleteResult> {
  if (!isDemo(uid)) {
    const { data, error } = await sb().rpc('complete_quest', { p_slug: slug });
    if (error) throw error;
    return data as CompleteResult;
  }
  const q = QUEST_DEFS.find((d) => d.slug === slug);
  if (!q) return { awarded: false, reason: 'unknown_quest' };
  const today = todayUTC();
  const profile = lget('profile', emptyProfile(uid));
  const wardrobe = lget<WardrobeItem[]>('wardrobe', []);
  const saved = lget<SavedOutfit[]>('saved', []);
  const ok =
    q.verifier === 'onboarding_done' ? profile.onboarding_completed :
    q.verifier === 'wardrobe_3' ? wardrobe.length >= 3 :
    q.verifier === 'saved_today' ? saved.some((s) => s.created_at.slice(0, 10) === today) :
    q.verifier === 'none';
  if (!ok) return { awarded: false, reason: 'requirements_not_met' };

  const completions = lget<QuestCompletion[]>('completions', []);
  const period = q.quest_type === 'once' ? 'once' : today;
  if (completions.some((c) => c.quest_id === q.id && c.period_key === period)) {
    return { awarded: false, reason: 'already_completed' };
  }
  lset('completions', [{ quest_id: q.id, period_key: period, completion_date: today, xp_awarded: q.xp_reward }, ...completions]);

  const prog = demoProgress(uid);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const streak = prog.last_activity_date === today ? Math.max(prog.current_streak, 1)
    : prog.last_activity_date === yesterday ? prog.current_streak + 1 : 1;
  let total = prog.total_xp + q.xp_reward;
  let gain = q.xp_reward;

  const earned = lget<EarnedAchievement[]>('earned', []);
  const newly: { code: string; name: string; icon: string }[] = [];
  const check: Record<string, boolean> = {
    first_steps: profile.onboarding_completed,
    first_save: saved.length > 0,
    closet_starter: wardrobe.length >= 5,
    streak_3: streak >= 3,
    level_3: levelFor(total) >= 3,
  };
  for (const a of ACHIEVEMENT_DEFS) {
    if (check[a.code] && !earned.some((x) => x.achievement_id === a.id)) {
      earned.push({ achievement_id: a.id, earned_at: new Date().toISOString() });
      total += a.xp_reward; gain += a.xp_reward;
      newly.push({ code: a.code, name: a.name, icon: a.icon });
    }
  }
  lset('earned', earned);
  const questCoins = (prog.quest_coins ?? 0) + 1;
  lset('progress', { ...prog, total_xp: total, quest_coins: questCoins, level: levelFor(total), current_streak: streak,
    longest_streak: Math.max(prog.longest_streak, streak), last_activity_date: today });
  return { awarded: true, quest: q.slug, xp: q.xp_reward, quest_coins: questCoins, xp_total_gain: gain, total_xp: total, level: levelFor(total), streak, new_achievements: newly };
}

// ── account ───────────────────────────────────────────────────────────────────
export async function deleteAccount(uid: string): Promise<void> {
  if (isDemo(uid)) { clearDemoData(); return; }
  const { error } = await sb().functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  if (error) throw new Error('Could not delete the account. Make sure the delete-account function is deployed.');
  await sb().auth.signOut();
}

export async function exportMyData(uid: string): Promise<Record<string, unknown>> {
  const [profile, wardrobe, saved, conversations] = await Promise.all([
    getProfile(uid), listWardrobe(uid), listSavedOutfits(uid), listConversations(uid),
  ]);
  const messages: Record<string, ChatMessage[]> = {};
  for (const c of conversations) messages[c.id] = await getMessages(uid, c.id);
  return { exportedAt: new Date().toISOString(), profile, wardrobe, savedOutfits: saved, conversations, messages };
}

// ── notifications ─────────────────────────────────────────────────────────────
export interface NotificationPrefs {
  daily_reminder: boolean;
  weekly_summary: boolean;
  push_enabled: boolean;
  email_enabled: boolean;
  reminder_hour: number;
  timezone: string;
}
export const defaultPrefs = (): NotificationPrefs => ({
  daily_reminder: false, weekly_summary: false, push_enabled: false, email_enabled: false, reminder_hour: 18,
  timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })(),
});

export async function getNotificationPrefs(uid: string): Promise<NotificationPrefs> {
  if (isDemo(uid)) return defaultPrefs();
  const { data, error } = await sb().from('notification_prefs')
    .select('daily_reminder, weekly_summary, push_enabled, email_enabled, reminder_hour, timezone')
    .eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return (data as NotificationPrefs | null) ?? defaultPrefs();
}

export async function saveNotificationPrefs(uid: string, prefs: NotificationPrefs): Promise<void> {
  if (isDemo(uid)) throw new Error('Notifications need Supabase. They are not available in demo mode.');
  const { error } = await sb().from('notification_prefs').upsert({ user_id: uid, ...prefs }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function savePushSubscription(uid: string, sub: PushSubscriptionJSON): Promise<void> {
  if (isDemo(uid)) throw new Error('Push needs Supabase. It is not available in demo mode.');
  const keys = sub.keys ?? {};
  if (!sub.endpoint || !keys.p256dh || !keys.auth) throw new Error('This browser returned an incomplete push subscription.');
  const { error } = await sb().from('push_subscriptions').upsert(
    { user_id: uid, endpoint: sub.endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent.slice(0, 300) },
    { onConflict: 'user_id,endpoint' },
  );
  if (error) throw error;
}

export async function removePushSubscription(uid: string, endpoint: string): Promise<void> {
  if (isDemo(uid)) return;
  await sb().from('push_subscriptions').delete().eq('user_id', uid).eq('endpoint', endpoint);
}

export async function sendTestNotification(uid: string): Promise<{ push: number; email: boolean }> {
  if (isDemo(uid)) throw new Error('Notifications need Supabase. They are not available in demo mode.');
  const { data, error } = await sb().functions.invoke('send-notifications', { body: { test: true } });
  if (error) {
    let msg = 'Could not send the test. Make sure the send-notifications function is deployed.';
    const ctx = (error as { context?: unknown }).context;
    if (ctx && typeof (ctx as Response).json === 'function') {
      try { const j = await (ctx as Response).json(); if (j?.message) msg = j.message; } catch { /* keep default */ }
    }
    throw new Error(msg);
  }
  return data as { push: number; email: boolean };
}
