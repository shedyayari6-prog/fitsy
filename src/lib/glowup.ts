/** GlowUp Quest data layer. Reads are plain selects; every write goes through a server function. */
import { supabase } from './supabase';
import type { CompleteResult, GqChapter, GqDaily, GqNode, GqProfile, Journey } from '@/features/glowup/types';

const sb = () => {
  if (!supabase) throw new Error('GlowUp Quest needs Supabase. It is not available in demo mode.');
  return supabase;
};

export const localTimezone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};
/** The user's calendar day, yyyy-mm-dd, in a given timezone. */
export const localDate = (tz: string, d = new Date()) => {
  try { return d.toLocaleDateString('en-CA', { timeZone: tz }); } catch { return d.toISOString().slice(0, 10); }
};

const NODE_COLS = 'id, chapter_id, node_order, title, description, kind, duration_seconds, difficulty, xp_reward, coin_reward, steps, easier, tip, is_milestone';

export async function loadJourney(): Promise<Journey> {
  const client = sb();
  const tz = localTimezone();
  const { data: p, error: pErr } = await client.rpc('gq_ensure_profile', { p_tz: tz });
  if (pErr) throw pErr;
  const profile = p as GqProfile;
  const todayDate = localDate(profile.timezone);

  const [ch, nd, cp, dy] = await Promise.all([
    client.from('gq_chapters').select('id, title, blurb, theme').order('id'),
    client.from('gq_nodes').select(NODE_COLS).order('chapter_id').order('node_order'),
    client.from('gq_completions').select('node_id'),
    client.from('gq_daily').select('completed_count, goal_completed').eq('day', todayDate).maybeSingle(),
  ]);
  for (const r of [ch, nd, cp, dy]) if (r.error) throw r.error;

  return {
    chapters: (ch.data ?? []) as GqChapter[],
    nodes: (nd.data ?? []) as GqNode[],
    done: new Set((cp.data ?? []).map((r: { node_id: string }) => r.node_id)),
    profile,
    today: (dy.data as GqDaily | null) ?? { completed_count: 0, goal_completed: false },
    todayDate,
  };
}

export async function completeNode(id: string): Promise<CompleteResult> {
  const { data, error } = await sb().rpc('gq_complete_node', { p_node: id, p_tz: localTimezone() });
  if (error) throw error;
  return data as CompleteResult;
}

export async function setDailyGoal(goal: 3 | 5 | 7): Promise<void> {
  const { data, error } = await sb().rpc('gq_set_goal', { p_goal: goal });
  if (error) throw error;
  if (!data?.ok) throw new Error('Could not change your daily goal.');
}

export const REASONS: Record<string, string> = {
  locked: 'Finish the previous challenge first.',
  already_completed: 'You already completed this one.',
  not_found: 'That challenge is no longer available.',
  unauthorized: 'Please sign in again.',
};

// sound preference (off by default)
const SOUND_KEY = 'fitsy.gq.sound';
export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; } };
export const setSound = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* ignore */ } };
export function playDing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880, 1100].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.11 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.11 + 0.25);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.11); o.stop(ctx.currentTime + i * 0.11 + 0.3);
    });
    setTimeout(() => void ctx.close(), 900);
  } catch { /* no audio available */ }
}
