export const cn = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const todayUTC = () => new Date().toISOString().slice(0, 10);

export function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function errMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return fallback;
}

export function outfitToText(o: { name: string; pieces: { name: string; color?: string }[]; shoes?: string; accessories: string[]; outerwear?: string; whyItWorks: string }): string {
  const lines = [o.name, ...o.pieces.map((p) => `• ${p.color ? p.color + ' ' : ''}${p.name}`)];
  if (o.outerwear) lines.push(`• ${o.outerwear}`);
  if (o.shoes) lines.push(`• ${o.shoes}`);
  if (o.accessories.length) lines.push(`• ${o.accessories.join(', ')}`);
  lines.push('', o.whyItWorks);
  return lines.join('\n');
}
