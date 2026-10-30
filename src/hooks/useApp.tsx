import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { completeQuest, getProfile, getProgress, listCompletions, listQuests, updateProfile } from '@/lib/data';
import { errMessage, todayUTC } from '@/lib/util';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import type { CompleteResult, Profile, Progress } from '@/types';

interface AppState {
  profile: Profile | null;
  progress: Progress | null;
  dailyXpToday: number | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<Profile>;
  refreshProgress: () => Promise<void>;
  /** Ask the backend to verify + award a quest. Safe to call repeatedly (idempotent). */
  tryComplete: (slug: string, opts?: { silent?: boolean }) => Promise<CompleteResult | null>;
}
const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { celebrate, toast } = useToast();
  const { t } = useT();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dailyXpToday, setDailyXpToday] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);
  uidRef.current = user?.id ?? null;

  const reload = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const [p, g] = await Promise.all([getProfile(uid), getProgress(uid)]);
      let xpToday: number | null = null;
      try {
        const [quests, completions] = await Promise.all([listQuests(uid), listCompletions(uid)]);
        const dailyQuestIds = new Set(quests.filter((quest) => quest.quest_type === 'daily').map((quest) => quest.id));
        xpToday = completions
          .filter((completion) => completion.completion_date === todayUTC() && dailyQuestIds.has(completion.quest_id))
          .reduce((total, completion) => total + completion.xp_awarded, 0);
      } catch { /* Daily XP is optional for the main profile load. */ }
      if (uidRef.current === uid) { setProfile(p); setProgress(g); setDailyXpToday(xpToday); }
    } catch (e) {
      setError(errMessage(e, t('Could not load your profile.')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void reload();
    else { setProfile(null); setProgress(null); setDailyXpToday(null); setError(null); }
  }, [user?.id, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    const uid = uidRef.current;
    if (!uid) throw new Error('Not signed in');
    const next = await updateProfile(uid, patch);
    setProfile(next);
    // Keep the language used by Resend-sent auth emails (read from user_metadata.lang) in sync.
    if (patch.preferred_language && supabase) {
      void supabase.auth.updateUser({ data: { lang: patch.preferred_language } }).catch(() => { /* non-critical */ });
    }
    return next;
  }, []);

  const refreshProgress = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) return;
    try {
      const [nextProgress, quests, completions] = await Promise.all([
        getProgress(uid), listQuests(uid), listCompletions(uid),
      ]);
      const dailyQuestIds = new Set(quests.filter((quest) => quest.quest_type === 'daily').map((quest) => quest.id));
      const xpToday = completions
        .filter((completion) => completion.completion_date === todayUTC() && dailyQuestIds.has(completion.quest_id))
        .reduce((total, completion) => total + completion.xp_awarded, 0);
      if (uidRef.current === uid) { setProgress(nextProgress); setDailyXpToday(xpToday); }
    } catch { /* keep the last known progress and daily XP */ }
  }, []);

  const tryComplete = useCallback(async (slug: string, opts?: { silent?: boolean }) => {
    const uid = uidRef.current;
    if (!uid) return null;
    try {
      const r = await completeQuest(uid, slug);
      if (r.awarded) {
        await refreshProgress();
        if (!opts?.silent) {
          celebrate({
            title: (r.level ?? 1) > (progress?.level ?? 1) ? t('Level {n}!', { n: r.level ?? 1 }) : t('Quest complete!'),
            subtitle: t('Nice work. Your style journey just moved forward.'),
            xp: r.xp_total_gain ?? r.xp,
            badges: r.new_achievements?.map((a) => t(a.name)),
          });
        }
      }
      return r;
    } catch (e) {
      if (!opts?.silent) toast(errMessage(e, t('Could not check that quest.')), 'error');
      return null;
    }
  }, [celebrate, toast, t, refreshProgress, progress?.level]);

  const value = useMemo(
    () => ({ profile, progress, dailyXpToday, loading, error, reload, saveProfile, refreshProgress, tryComplete }),
    [profile, progress, dailyXpToday, loading, error, reload, saveProfile, refreshProgress, tryComplete],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
