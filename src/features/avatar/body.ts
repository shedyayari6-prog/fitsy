/**
 * Parametric body model for the Fitsy mascot (big round head, small chubby body). Pure maths, no three.js, so it is cheap to import and easy to test.
 *
 * Height and weight give BMI, which scales girths. The body shape preset and the six optional
 * sliders then refine the result. Sex only picks a starting set of proportions. It is never the
 * whole definition of a body: every proportion can be moved afterwards.
 *
 * Units are metres. The avatar stands on y = 0, faces +z, and its left side is +x.
 */
import type { Adjust, AvatarConfig, HairStyle, Sex, Shape } from './types';

export const LIMITS = { height: [120, 230], weight: [30, 250] } as const;

export const ZERO_ADJUST: Adjust = { shoulders: 0, chest: 0, waist: 0, hips: 0, legs: 0, muscle: 0 };

export const SHAPES: { value: Shape; label: string; hint: string }[] = [
  { value: 'slim', label: 'Slim', hint: 'Lean, lighter build' },
  { value: 'athletic', label: 'Athletic', hint: 'Broader shoulders, defined' },
  { value: 'average', label: 'Average', hint: 'Balanced proportions' },
  { value: 'curvy', label: 'Curvy', hint: 'Fuller hips and bust' },
  { value: 'plus', label: 'Plus-size', hint: 'Fuller overall' },
];

export const SKIN_TONES = [
  { hex: '#EBD9BA', label: 'Clay' },
  { hex: '#F6D9C3', label: 'Porcelain' },
  { hex: '#EBC09B', label: 'Light' },
  { hex: '#D39B73', label: 'Medium' },
  { hex: '#B07650', label: 'Tan' },
  { hex: '#8A5636', label: 'Deep' },
  { hex: '#5B3A27', label: 'Rich' },
];

export const HAIR_COLORS = [
  { hex: '#1F1B18', label: 'Black' },
  { hex: '#3B2A20', label: 'Dark brown' },
  { hex: '#6B4A32', label: 'Brown' },
  { hex: '#D2B070', label: 'Blonde' },
  { hex: '#A8512C', label: 'Ginger' },
  { hex: '#B9B6B0', label: 'Grey' },
];

export const HAIR_STYLES: { value: HairStyle; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
  { value: 'bun', label: 'Bun' },
  { value: 'curly', label: 'Curly' },
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function defaultConfig(sex: Sex, heightCm: number, weightKg: number, shape: Shape): AvatarConfig {
  return {
    sex, heightCm, weightKg, shape, adjust: { ...ZERO_ADJUST },
    skin: SKIN_TONES[0].hex, hair: 'none', hairColor: HAIR_COLORS[1].hex,
  };
}

export type MeasureResult =
  | { ok: true; height: number; weight: number }
  | { ok: false; errors: { height?: string; weight?: string } };

/** Accepts text from the inputs. Allows a comma as the decimal mark. */
export function validateMeasurements(heightText: string, weightText: string): MeasureResult {
  const parse = (t: string) => (t.trim() === '' ? NaN : Number(t.trim().replace(',', '.')));
  const h = parse(heightText);
  const w = parse(weightText);
  const errors: { height?: string; weight?: string } = {};
  const [hMin, hMax] = LIMITS.height;
  const [wMin, wMax] = LIMITS.weight;
  if (!Number.isFinite(h)) errors.height = 'Enter your height in centimetres.';
  else if (h < hMin || h > hMax) errors.height = `Height should be between ${hMin} and ${hMax} cm.`;
  if (!Number.isFinite(w)) errors.weight = 'Enter your weight in kilograms.';
  else if (w < wMin || w > wMax) errors.weight = `Weight should be between ${wMin} and ${wMax} kg.`;
  if (!errors.height && !errors.weight) {
    const bmi = w / (h / 100) ** 2;
    if (bmi < 13 || bmi > 65) errors.weight = 'That height and weight look unusual together. Please double-check them.';
  }
  if (errors.height || errors.weight) return { ok: false, errors };
  return { ok: true, height: Math.round(h * 10) / 10, weight: Math.round(w * 10) / 10 };
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
const num = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;

/** Never trust stored JSON: rebuild a valid config from whatever came back, or return null. */
export function sanitizeConfig(raw: unknown): AvatarConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.sex !== 'female' && r.sex !== 'male') return null;
  const shapes: Shape[] = ['slim', 'athletic', 'average', 'curvy', 'plus'];
  const hairs: HairStyle[] = ['none', 'short', 'long', 'bun', 'curly'];
  const shape = shapes.includes(r.shape as Shape) ? (r.shape as Shape) : 'average';
  const a = (r.adjust && typeof r.adjust === 'object' ? r.adjust : {}) as Record<string, unknown>;
  return {
    sex: r.sex,
    heightCm: num(r.heightCm, LIMITS.height[0], LIMITS.height[1], 170),
    weightKg: num(r.weightKg, LIMITS.weight[0], LIMITS.weight[1], 65),
    shape,
    adjust: {
      shoulders: num(a.shoulders, -1, 1, 0), chest: num(a.chest, -1, 1, 0), waist: num(a.waist, -1, 1, 0),
      hips: num(a.hips, -1, 1, 0), legs: num(a.legs, -1, 1, 0), muscle: num(a.muscle, -1, 1, 0),
    },
    skin: isHex(r.skin) ? r.skin : SKIN_TONES[0].hex,
    hair: hairs.includes(r.hair as HairStyle) ? (r.hair as HairStyle) : 'none',
    hairColor: isHex(r.hairColor) ? r.hairColor : HAIR_COLORS[1].hex,
  };
}

// ── derived geometry ───────────────────────────────────────────────────────

const SHAPE_MULT: Record<Shape, { sh: number; chest: number; waist: number; hip: number; limb: number; muscle: number }> = {
  slim:     { sh: 0.96, chest: 0.94, waist: 0.92, hip: 0.95, limb: 0.88, muscle: 0 },
  athletic: { sh: 1.06, chest: 1.07, waist: 0.96, hip: 0.99, limb: 1.06, muscle: 0.6 },
  average:  { sh: 1,    chest: 1,    waist: 1,    hip: 1,    limb: 1,    muscle: 0.2 },
  curvy:    { sh: 0.98, chest: 1.05, waist: 0.93, hip: 1.14, limb: 1.06, muscle: 0.1 },
  plus:     { sh: 1.04, chest: 1.14, waist: 1.12, hip: 1.14, limb: 1.18, muscle: 0.1 },
};

// Half-widths and limb radii as a fraction of height.
const BASE = {
  male:   { sh: 0.112, chest: 0.100, waist: 0.085, hip: 0.094, thigh: 0.050, upper: 0.029, fore: 0.021, wrist: 0.0125, calf: 0.036, knee: 0.034, ankle: 0.020 },
  female: { sh: 0.102, chest: 0.085, waist: 0.073, hip: 0.102, thigh: 0.054, upper: 0.025, fore: 0.018, wrist: 0.011,  calf: 0.034, knee: 0.033, ankle: 0.019 },
};

export interface Body {
  H: number;
  sex: Sex;
  muscle: number;
  bust: number;
  bustY: number;
  chestA: number;
  shoulderX: number;
  shoulderJointX: number;
  shoulderJointY: number;
  crotchY: number;
  hipY: number;
  waistY: number;
  neckBaseY: number;
  neck: { r: number; y0: number; y1: number };
  head: { y: number; rx: number; ry: number; rz: number; z: number };
  arm: { upperR: number; foreR: number; wristR: number; upperLen: number; foreLen: number; handR: number; theta: number };
  leg: { x: number; thighR: number; kneeR: number; calfR: number; ankleR: number; kneeY: number; ankleY: number };
  foot: { len: number; w: number; h: number };
  /** Torso cross-section (ellipse semi-axes) at any height between the crotch and the neck. */
  ringAt: (y: number) => { a: number; b: number };
  /** Estimates of the person's real measurements in cm, shown next to the sliders. */
  est: { waist: number; hips: number; chest: number; shoulders: number; inseam: number };
}

/** Ramanujan's approximation for the perimeter of an ellipse. */
export const ellipseCirc = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

interface Key { y: number; a: number; b: number }

/** Cubic Hermite through keyframes with finite-difference tangents (handles uneven spacing). */
function makeRingAt(keys: Key[]) {
  const n = keys.length;
  const tangent = (i: number, f: 'a' | 'b') => {
    const p = keys[Math.max(0, i - 1)], q = keys[Math.min(n - 1, i + 1)];
    return (q[f] - p[f]) / (q.y - p.y || 1);
  };
  return (y: number) => {
    if (y <= keys[0].y) return { a: keys[0].a, b: keys[0].b };
    if (y >= keys[n - 1].y) return { a: keys[n - 1].a, b: keys[n - 1].b };
    let i = 0;
    while (y > keys[i + 1].y) i++;
    const k0 = keys[i], k1 = keys[i + 1], h = k1.y - k0.y, t = (y - k0.y) / h;
    const t2 = t * t, t3 = t2 * t;
    const herm = (f: 'a' | 'b') =>
      (2 * t3 - 3 * t2 + 1) * k0[f] + (t3 - 2 * t2 + t) * h * tangent(i, f) +
      (-2 * t3 + 3 * t2) * k1[f] + (t3 - t2) * h * tangent(i + 1, f);
    return { a: herm('a'), b: herm('b') };
  };
}

const REAL = {
  male:   { sh: 0.112, chest: 0.100, waist: 0.085, hip: 0.094 },
  female: { sh: 0.102, chest: 0.085, waist: 0.073, hip: 0.102 },
};

/**
 * What the person's real body is likely to measure, from height, weight, shape and sliders.
 * This only feeds the cm readouts. The mascot itself is a cartoon and does not use these sizes.
 */
function estimateMeasurements(cfg: AvatarConfig, mass: number, muscle: number): Body['est'] {
  const H = cfg.heightCm / 100;
  const male = cfg.sex === 'male';
  const B = male ? REAL.male : REAL.female;
  const sm = SHAPE_MULT[cfg.shape];
  const adj = cfg.adjust;
  const g = (k: number) => 1 + k * mass;
  const shoulderX = B.sh * H * sm.sh * (1 + 0.12 * adj.shoulders) * (1 + 0.06 * muscle) * g(0.06);
  const chestA = B.chest * H * sm.chest * (1 + 0.18 * adj.chest) * (1 + 0.04 * muscle) * g(0.16);
  const waistA = B.waist * H * sm.waist * (1 + 0.18 * adj.waist) * (1 - 0.02 * muscle) * g(0.22);
  const hipA = B.hip * H * sm.hip * (1 + 0.18 * adj.hips) * g(0.17);
  const waistB = waistA * (0.72 + (0.08 * Math.max(0, mass)) / 1.6);
  const bust = male ? 0.004 * H * (0.4 + muscle) : 0.017 * H * (1 + 0.4 * adj.chest) * (0.85 + 0.2 * Math.max(0, mass));
  return {
    waist: Math.round(ellipseCirc(waistA, waistB) * 100),
    hips: Math.round(ellipseCirc(hipA, hipA * 0.75) * 100),
    chest: Math.round((ellipseCirc(chestA, chestA * 0.7) + 2 * bust) * 100),
    shoulders: Math.round(2 * shoulderX * 100),
    inseam: Math.round((0.465 + 0.03 * adj.legs) * H * 100),
  };
}

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Mascot proportions, as fractions of total height H, measured from the character reference:
 * head about 40% of the height, short torso, stubby legs, round mitten hands, no visible neck.
 * Weight makes the character chubbier, body shape and sliders change the widths, and the
 * height slider scales everything. Sex only nudges shoulder and hip width slightly.
 */
export function deriveBody(cfg: AvatarConfig): Body {
  const H = cfg.heightCm / 100;
  const male = cfg.sex === 'male';
  const sm = SHAPE_MULT[cfg.shape];
  const adj = cfg.adjust;
  const mass = clamp((cfg.weightKg / (H * H) - 22) / 8, -0.5, 1.6);
  const g = (k: number) => 1 + k * mass;
  const muscle = clamp(sm.muscle + 0.5 * adj.muscle, 0, 1);
  const sexSh = male ? 1.04 : 0.98;
  const sexHip = male ? 0.98 : 1.03;

  const shoulderX = 0.145 * H * sm.sh * sexSh * (1 + 0.12 * adj.shoulders) * (1 + 0.06 * muscle);
  const chestA = 0.152 * H * sm.chest * (1 + 0.18 * adj.chest) * g(0.14);
  const waistA = 0.15 * H * sm.waist * (1 + 0.18 * adj.waist) * g(0.2);
  const hipA = 0.152 * H * sm.hip * sexHip * (1 + 0.18 * adj.hips) * g(0.16);
  const depth = 0.86;
  const limb = sm.limb * g(0.16) * (1 + 0.08 * muscle);

  const L = adj.legs;
  const crotchY = (0.275 + 0.03 * L) * H;
  const hipY = crotchY + 0.035 * H;
  const waistY = (0.37 + 0.01 * L) * H;
  const chestY = (0.45 + 0.008 * L) * H;
  const shoulderY = 0.535 * H;
  const neckBaseY = 0.565 * H;

  const keys: Key[] = [
    { y: crotchY, a: hipA * 0.9, b: hipA * 0.9 * depth },
    { y: hipY, a: hipA, b: hipA * depth },
    { y: (hipY + waistY) / 2, a: lerpN(hipA, waistA, 0.5), b: lerpN(hipA, waistA, 0.5) * depth },
    { y: waistY, a: waistA, b: waistA * depth },
    { y: chestY, a: chestA, b: chestA * depth },
    { y: shoulderY - 0.012 * H, a: shoulderX * 0.92, b: chestA * depth * 0.85 },
    { y: neckBaseY, a: 0.075 * H, b: 0.07 * H },
  ];

  const thighR = 0.076 * H * limb;

  return {
    H, sex: cfg.sex, muscle, bust: 0, bustY: chestY, chestA, shoulderX,
    shoulderJointX: shoulderX * 0.98, shoulderJointY: shoulderY - 0.02 * H,
    crotchY, hipY, waistY, neckBaseY,
    neck: { r: 0.07 * H, y0: 0.5 * H, y1: 0.6 * H },
    head: { y: 0.755 * H, rx: 0.205 * H, ry: 0.192 * H, rz: 0.19 * H, z: 0.006 * H },
    arm: {
      upperR: 0.052 * H * limb, foreR: 0.047 * H * limb, wristR: 0.041 * H * limb,
      upperLen: 0.105 * H, foreLen: 0.09 * H, handR: 0.06 * H, theta: 0.3,
    },
    leg: {
      x: Math.max(hipA * 0.5, thighR * 0.9), thighR, kneeR: 0.068 * H * limb, calfR: 0.062 * H * limb, ankleR: 0.056 * H * limb,
      kneeY: crotchY * 0.6, ankleY: 0.066 * H,
    },
    foot: { len: 0.21 * H, w: 0.11 * H, h: 0.066 * H },
    ringAt: makeRingAt(keys),
    est: estimateMeasurements(cfg, mass, muscle),
  };
}