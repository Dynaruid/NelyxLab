import type {BlurStyle} from '../../skia/types/MaskFilter.ts';

import type {SkEnum} from './Common.ts';

export interface BlurMaskFilterProps {
  style: SkEnum<typeof BlurStyle>;
  blur: number;
  respectCTM: boolean;
}
