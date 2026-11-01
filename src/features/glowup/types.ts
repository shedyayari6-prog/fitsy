export type NodeKind = 'check' | 'reps' | 'timer';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GqChapter { id: number; title: string; blurb: string; theme: string }

export interface GqNode {
  id: string; chapter_id: number; node_order: number; title: string; description: string;
  kind: NodeKind; duration_seconds: number; difficulty: Difficulty; xp_reward: number; coin_reward: number;
  steps: string[]; easier: string | null; tip: string | null; is_milestone: boolean;
}

export interface GqProfile {
  xp: number; coins: number; level: number; current_streak: number; longest_streak: number;
  last_goal_date: string | null; daily_goal: number; timezone: string;
}

export interface GqDaily { completed_count: number; goal_completed: boolean }

export interface Journey {
  chapters: GqChapter[];
  nodes: GqNode[];          // sorted: chapter, then order
  done: Set<string>;
  profile: GqProfile;
  today: GqDaily;
  todayDate: string;        // the user's local calendar day, yyyy-mm-dd (display only; the server decides)
}

export type CompleteResult =
  | { ok: true; xp_gain: number; coin_gain: number; level: number; leveled_up: boolean; streak: number;
      streak_milestone: number | null; goal_hit: boolean; week_bonus: boolean; daily_count: number;
      chapter_done: boolean; journey_done: boolean }
  | { ok: false; reason: 'unauthorized' | 'not_found' | 'already_completed' | 'locked' };
