import type { BlurStyle } from '@nelyx/skia-native/skia/types/MaskFilter';

import type { SkEnum } from './Common.ts';

export interface BlurMaskFilterProps {
  style: SkEnum<typeof BlurStyle>;
  blur: number;
  respectCTM: boolean;
}
