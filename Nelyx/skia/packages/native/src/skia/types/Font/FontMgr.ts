import type {SkJSIInstance} from '../JsiInstance.ts';
import type {SkTypeface} from '../Typeface/Typeface.ts';

import type {FontStyle} from "../Drawing.ts";

export interface SkFontMgr extends SkJSIInstance<"FontMgr"> {
  countFamilies(): number;
  getFamilyName(index: number): string;
  matchFamilyStyle(name: string, style: FontStyle): SkTypeface;
}
