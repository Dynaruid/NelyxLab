import type { SkData } from '../Data/Data.ts';

import type { SkTypeface } from './Typeface.ts';

export interface TypefaceFactory {
  MakeFreeTypeFaceFromData(data: SkData): SkTypeface | null;
}
