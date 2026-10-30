import type { Texture } from 'three';

export type Sex = 'female' | 'male';
export type Shape = 'slim' | 'athletic' | 'average' | 'curvy' | 'plus';
export type HairStyle = 'none' | 'short' | 'long' | 'bun' | 'curly';

/** Fine-tune sliders, each -1..1 relative to the shape generated from height, weight and body shape. */
export interface Adjust {
  shoulders: number;
  chest: number;
  waist: number;
  hips: number;
  legs: number;
  muscle: number;
}

/** Everything stored for an avatar. Measurements and appearance only. Never a photo. */
export interface AvatarConfig {
  sex: Sex;
  heightCm: number;
  weightKg: number;
  shape: Shape;
  adjust: Adjust;
  skin: string;
  hair: HairStyle;
  hairColor: string;
}

/** Slots an outfit can fill. A dress takes the place of a top and a bottom. */
export type Slot = 'top' | 'outer' | 'bottom' | 'dress' | 'shoes';
export type BottomKind = 'pants' | 'skirt' | 'shorts';

export interface Outfit {
  top: string | null;
  outer: string | null;
  bottom: string | null;
  dress: string | null;
  shoes: string | null;
  /** Saved with the look, but not drawn in 3D yet (see INTEGRATION.md). */
  accessories: string[];
}

export const EMPTY_OUTFIT: Outfit = { top: null, outer: null, bottom: null, dress: null, shoes: null, accessories: [] };

export interface SavedLook {
  id: string;
  name: string;
  outfit: Outfit;
  /** Per-item colour overrides, keyed by wardrobe item id. */
  colors: Record<string, string>;
  favorite: boolean;
  created_at: string;
}

/** One garment as the 3D viewer receives it. */
export interface GarmentSpec {
  key: string;
  slot: Slot;
  kind?: BottomKind;
  /** Wardrobe photo prepared as a texture. Null means a plain coloured garment. */
  texture: Texture | null;
  /** Tint. With a texture this multiplies the photo, so '#ffffff' means the original colours. */
  color: string;
}
