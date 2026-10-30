export type MascotState =
  | 'idle' | 'greeting' | 'thinking' | 'talking' | 'listening' | 'happy' | 'excited'
  | 'surprised' | 'confused' | 'encouraging' | 'celebrating' | 'waving' | 'walking'
  | 'recommending' | 'outfit-approved' | 'outfit-rejected' | 'loading' | 'sleeping'
  | 'sad' | 'crying' | 'victory' | 'streak';

export interface Profile {
  id: string;
  display_name: string | null;
  preferred_language: string;
  style_preferences: string[];
  preferred_colors: string[];
  preferred_occasions: string[];
  preferred_categories: string[];
  shopping_preferences: string[];
  budget_preference: 'budget' | 'mid' | 'premium' | 'flexible' | null;
  sizes: Record<string, string>;
  location_city: string | null;
  location_lat: number | null;
  location_lon: number | null;
  weather_enabled: boolean;
  ai_share_wardrobe: boolean;
  onboarding_completed: boolean;
}

export type WardrobeCategory =
  | 'tops' | 'trousers' | 'jeans' | 'jackets' | 'coats' | 'shoes' | 'bags' | 'accessories' | 'dresses' | 'other';
export type Season = 'all' | 'spring' | 'summer' | 'autumn' | 'winter';

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  category: WardrobeCategory;
  color: string | null;
  season: Season;
  style_tags: string[];
  image_path: string | null;
  brand: string | null;
  purchase_price: number | null;
  notes: string | null;
  created_at: string;
}
export type WardrobeDraft = Omit<WardrobeItem, 'id' | 'user_id' | 'created_at'>;

export interface OutfitPiece {
  name: string;
  category: string;
  color?: string;
  fromWardrobe: boolean;
  wardrobeItemId?: string;
}
export interface OutfitData {
  name: string;
  occasion?: string;
  style?: string;
  pieces: OutfitPiece[];
  colorPalette: string[];
  shoes?: string;
  accessories: string[];
  outerwear?: string;
  whyItWorks: string;
  weatherNote?: string;
  budgetNote?: string;
  alternatives: string[];
  caveats?: string;
}
export interface Outfit {
  id: string;
  title: string;
  occasion: string | null;
  style: string | null;
  outfit_data: OutfitData;
  created_at: string;
}
export interface SavedOutfit {
  id: string;
  outfit_id: string;
  is_favorite: boolean;
  created_at: string;
  outfit: Outfit;
}

export interface StructuredReply {
  outfits: OutfitData[];
  clarifyingQuestion: string | null;
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  structured?: StructuredReply | null;
  created_at: string;
}
export interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export interface Progress {
  user_id: string;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
}
export interface Quest {
  id: string;
  slug: string;
  title: string;
  description: string;
  quest_type: 'daily' | 'once';
  xp_reward: number;
}
export interface QuestCompletion {
  quest_id: string;
  period_key: string;
  completion_date: string;
  xp_awarded: number;
}
export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
}
export interface EarnedAchievement {
  achievement_id: string;
  earned_at: string;
}
export interface CompleteResult {
  awarded: boolean;
  reason?: 'unknown_quest' | 'requirements_not_met' | 'already_completed';
  quest?: string;
  xp?: number;
  xp_total_gain?: number;
  total_xp?: number;
  level?: number;
  streak?: number;
  new_achievements?: { code: string; name: string; icon: string }[];
}

export interface WeatherSnapshot {
  city: string;
  tempC: number;
  minC: number;
  maxC: number;
  rainChance: number;
  summary: string;
  /** "current" conditions vs. today's forecast range are reported separately. */
  fetchedAt: string;
}

export interface StylistRequest {
  message?: string;
  action?: 'more_formal' | 'more_casual' | 'cheaper' | 'alternatives' | 'try_another_style' | 'from_wardrobe';
  conversationId?: string | null;
  weather?: WeatherSnapshot | null;
}
export interface StylistResponse {
  conversationId: string;
  reply: string;
  outfits: OutfitData[];
  clarifyingQuestion: string | null;
}

// ── Fitsy Store ───────────────────────────────────────────────────────────────
export type StoreCondition = 'new_with_tags' | 'like_new' | 'good' | 'fair';
export type ContactType = 'phone' | 'whatsapp' | 'email' | 'other';

export interface StoreListing {
  id: string;
  seller_id: string;
  title: string;
  category: WardrobeCategory;
  style_tags: string[];
  color: string;
  size: string;
  condition: StoreCondition;
  description: string;
  price: number;
  currency: string;
  seller_name: string;
  seller_info: string;
  country: string;
  city: string;
  image_path: string;
  status: 'active' | 'sold';
  created_at: string;
  expires_at: string;
}

/** Everything the seller must fill in. Contact lives in its own table and is revealed on request. */
export interface StoreDraft {
  title: string; category: WardrobeCategory; style_tags: string[]; color: string; size: string;
  condition: StoreCondition; description: string; price: string; currency: string;
  seller_name: string; seller_info: string; country: string; city: string;
  contact_type: ContactType; contact_value: string;
}
