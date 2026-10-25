import type React from 'react';
import type {SkGraphiteContext} from "@nelyx/skia-native/skia/types/Graphite";
import type {SkiaGraphiteViewNativeProps} from './types.ts';
export interface SkiaGraphiteViewRef {
  /**
   * The recording side of the view. Call it once the view is mounted. The
   * returned context can be captured into worklets and used from any runtime.
   */
  getContext(): SkGraphiteContext;
  getNativeId(): number;
  getMouseCursorVersion():number;
}

export interface SkiaGraphiteViewProps extends SkiaGraphiteViewNativeProps {
  ref?: React.Ref<SkiaGraphiteViewRef>;
}

