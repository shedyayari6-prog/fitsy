import type { WardrobeCategory } from '@/types';

// Category -> default 3D model. Adjust keys to match your CATEGORY_OPTIONS values.
export const MODEL_BY_CATEGORY: Partial<Record<WardrobeCategory, string>> = {
  tops: '/models/tshirt.glb',
  trousers: '/models/jeans.glb',
  jackets: '/models/jacket.glb',
  dresses: '/models/dress.glb',
  shoes: '/models/sneakers.glb',  
  accessories: '/models/bag.glb',
};

// Which categories hang on the rail; everything else goes on shelves.
export const HANGING = new Set<string>(['tops', 'outerwear', 'dresses']);