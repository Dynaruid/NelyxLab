import type { ViewProps } from "react-native";
import { createElement } from "react";
import type { FunctionComponentElement } from "react";

import {SkiaView} from '../views/SkiaView.web.tsx';
import type {SkiaViewProps} from '../views/SkiaView.web.tsx';

export interface NativeProps extends ViewProps {
  opaque?: boolean;
  highBitDepth?: boolean;
  nativeID: string;
  androidSurfaceType?: "auto" | "SurfaceView" | "TextureView";
  androidZOrderOnTop?: boolean;
}

const SkiaViewNativeComponent = ({
  nativeID,
  onLayout,
  // Surface settings, never reach the DOM
  opaque: _opaque,
  highBitDepth: _highBitDepth,
  androidSurfaceType: _androidSurfaceType,
  androidZOrderOnTop: _androidZOrderOnTop,
  ...viewProps
}: NativeProps): FunctionComponentElement<SkiaViewProps> => {
  return createElement(SkiaView, {
    nativeID,
    onLayout,
    ...viewProps,
  });
};
// eslint-disable-next-line import/no-default-export
export default SkiaViewNativeComponent;
