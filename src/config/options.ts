import type { Season, WardrobeCategory } from '@/types';

export const STYLE_OPTIONS = [
  'Casual', 'Minimalist', 'Streetwear', 'Old money', 'Smart casual', 'Elegant',
  'Sporty', 'Vintage', 'Formal', 'Modest fashion', 'Trend-focused', 'Alternative',
];

export const OCCASION_OPTIONS = [
  'University', 'Work', 'Date', 'Party', 'Wedding', 'Interview', 'Everyday', 'Travel', 'Workout',
];

export const COLOR_OPTIONS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#222622' }, { name: 'White', hex: '#F4F1EA' }, { name: 'Beige', hex: '#D9C8A9' },
  { name: 'Olive', hex: '#6B7048' }, { name: 'Sage', hex: '#A3B18A' }, { name: 'Forest', hex: '#344E41' },
  { name: 'Navy', hex: '#27374D' }, { name: 'Grey', hex: '#9A9C98' }, { name: 'Brown', hex: '#7A5A44' },
  { name: 'Terracotta', hex: '#C78665' }, { name: 'Burgundy', hex: '#6D2E3A' }, { name: 'Denim blue', hex: '#5F7FA3' },
];

export const CATEGORY_OPTIONS: { value: WardrobeCategory; label: string }[] = [
  { value: 'tops', label: 'Tops' }, { value: 'trousers', label: 'Trousers' }, { value: 'jeans', label: 'Jeans' },
  { value: 'jackets', label: 'Jackets' }, { value: 'coats', label: 'Coats' }, { value: 'shoes', label: 'Shoes' },
  { value: 'bags', label: 'Bags' }, { value: 'accessories', label: 'Accessories' },
  { value: 'dresses', label: 'Dresses' }, { value: 'other', label: 'Other' },
];

export const SEASON_OPTIONS: { value: Season; label: string }[] = [
  { value: 'all', label: 'All year' }, { value: 'spring', label: 'Spring' }, { value: 'summer', label: 'Summer' },
  { value: 'autumn', label: 'Autumn' }, { value: 'winter', label: 'Winter' },
];

export const BUDGET_OPTIONS = [
  { value: 'budget', label: 'Budget-friendly', hint: 'Smart basics, thrift & high street' },
  { value: 'mid', label: 'Mid-range', hint: 'A mix of quality and value' },
  { value: 'premium', label: 'Premium', hint: 'Invest in standout pieces' },
  { value: 'flexible', label: 'It depends', hint: 'Depends on the piece' },
] as const;

export const SHOPPING_OPTIONS = [
  'Thrifting & second-hand', 'High street', 'Online shopping', 'Sustainable brands',
  'Designer & luxury', 'Local boutiques',
];

export const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'fr', label: 'Français' }, { code: 'ar', label: 'العربية' },
  { code: 'es', label: 'Español' }, { code: 'de', label: 'Deutsch' }, { code: 'it', label: 'Italiano' },
];

export const SIZE_FIELDS = [
  { key: 'tops', label: 'Tops' }, { key: 'bottoms', label: 'Bottoms' }, { key: 'shoes', label: 'Shoes' },
];

export const STYLER_PROMPTS = [
  'I have a date tonight. What should I wear?',
  'I have a job interview tomorrow.',
  'A casual outfit that still looks expensive',
  'What colors go with olive green?',
  'Help me dress better without spending too much',
  'I need an outfit for university tomorrow',
];

/** Curated static styling tips (not AI generated). One is shown per day. */
export const DAILY_TIPS = [
  { title: 'The rule of three colours', body: 'Keep an outfit to three colours at most. One neutral base, one supporting tone, one accent.' },
  { title: 'Tonal dressing', body: 'Wear different shades of one colour, like sage with forest, for an effortless, expensive look.' },
  { title: 'Mind the proportions', body: 'Pair something roomy with something fitted. A relaxed hoodie works best with slimmer or straight trousers.' },
  { title: 'Shoes set the tone', body: 'Clean white or cream sneakers lift a casual outfit. Scuffed ones undo it, so wipe them down.' },
  { title: 'Texture beats pattern', body: 'If you avoid prints, add interest with texture: knit, corduroy, linen or brushed cotton.' },
  { title: 'Fit over fashion', body: 'A well-fitting basic beats a trendy piece that does not fit. Check shoulders and sleeve length first.' },
  { title: 'One statement piece', body: 'Let one item be the star, whether a bag, jacket or shoes, and keep everything else quiet.' },
];
