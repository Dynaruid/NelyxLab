import type { SkFontMgr } from '../Font/FontMgr.ts';
import type { SkTypeface } from '../Typeface/Typeface.ts';

export interface SkTypefaceFontProvider extends SkFontMgr {
  /**
   * Registers a given typeface with the given family name.
   * @param typeface - Typeface.
   * @param family
   */
  registerFont(typeface: SkTypeface, familyName: string): void;
}
