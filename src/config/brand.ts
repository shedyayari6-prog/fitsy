/**
 * Central brand configuration.
 * Change the product name, copy, mascot asset and links here — nothing else
 * in the app hard-codes them.
 */
export const brand = {
  name: 'Fitsy',
  /** Short wordmark shown next to the logo. */
  wordmark: 'Fitsy',
  tagline: 'Your style. Your rules. Your AI stylist.',
  description:
    'Personal outfit advice that knows your taste, your budget, your weather and the clothes you already own.',
  /** The mascot is addressed by this name in the UI. */
  mascotName: 'Sage',
  mascotSrc: '/mascot/sage.webp',
  mascotFallbackSrc: '/mascot/sage.png',
  /**
   * Extra poses. Drop these files in public/mascot/. A pose whose file is missing silently falls back
   * to the base artwork, so the app never breaks. Use the same framing as sage.png (character centred,
   * portrait, cream or transparent background).
   */
  mascotPoses: {
    wave: '/mascot/happy_wave.png',
    jump: '/mascot/jumping_happy.png',
    victory: '/mascot/victory.png',
    thinking: '/mascot/thinking.png',
    shocked: '/mascot/shocked.png',
    sad: '/mascot/sad.png',
    crying: '/mascot/crying.png',
    streak: '/mascot/streak_growing.png',
  },
  contactEmail: 'hello@example.com',
  whatsappUrl: 'https://wa.me/393508653895',
  whatsappDisplay: '+39 350 865 3895',
  /** Leave empty to hide the social links in the footer. */
  social: [] as { label: string; href: string }[],
  palette: {
    cream: '#F7F4ED',
    sage: '#A3B18A',
    forest: '#344E41',
    clay: '#C78665',
  },
} as const;
