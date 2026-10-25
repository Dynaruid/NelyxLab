import type {SkData} from '../Data/Data.ts';
import type {SkFontMgr} from '../Font/FontMgr.ts';

import type {SkSVG} from './SVG.ts';

export interface SVGFactory {
  MakeFromData(
    data: SkData,
    fontMgr?: SkFontMgr | null,
    assets?: Record<string, SkData | null>
  ): SkSVG | null;
  MakeFromString(
    str: string,
    fontMgr?: SkFontMgr | null,
    assets?: Record<string, SkData | null>
  ): SkSVG | null;
}
