/** Level names and XP thresholds. The thresholds must match gq_level() in the SQL migration. */
export const LEVELS = [
  { name: 'Beginner', xp: 0 }, { name: 'Getting Started', xp: 100 }, { name: 'Consistent', xp: 250 },
  { name: 'Improving', xp: 450 }, { name: 'Dedicated', xp: 700 }, { name: 'Rising', xp: 1000 },
  { name: 'Advanced', xp: 1400 }, { name: 'Elite', xp: 1900 }, { name: 'Master', xp: 2500 }, { name: 'GlowUp Legend', xp: 3200 },
];

export function levelInfo(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const next = LEVELS[i + 1];
  const into = xp - LEVELS[i].xp;
  const span = next ? next.xp - LEVELS[i].xp : 1;
  return { level: i + 1, name: LEVELS[i].name, next: next?.name ?? null, into, span, pct: next ? Math.min(100, Math.round((into / span) * 100)) : 100, toNext: next ? next.xp - xp : 0 };
}

/** Chapter palettes. Add a theme here when you add a chapter. */
export const THEMES: Record<string, { sky: string; ground: string; leaf: string; accent: string; road: string }> = {
  dawn:       { sky: '#F4E9D3', ground: '#DDE4D0', leaf: '#8DA06F', accent: '#E4A98B', road: '#F7F4ED' },
  clean:      { sky: '#DCEBEA', ground: '#CFE2DC', leaf: '#6E9C93', accent: '#7FB5C9', road: '#F4F8F6' },
  move:       { sky: '#F6E0CF', ground: '#EBD3B8', leaf: '#B5835B', accent: '#C78665', road: '#FBF4EA' },
  glow:       { sky: '#F6DDE0', ground: '#EED5CF', leaf: '#B07E78', accent: '#E3A4B0', road: '#FCF5F1' },
  confidence: { sky: '#E6E0F0', ground: '#D9D6E8', leaf: '#8A7FB0', accent: '#A898D0', road: '#F7F5FB' },
  evolution:  { sky: '#F1E8C6', ground: '#DFE3C0', leaf: '#6F8447', accent: '#D9B64B', road: '#FAF7E8' },
};
