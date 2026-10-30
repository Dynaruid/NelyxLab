import { codegenNativeComponent, type ViewProps } from 'react-native';
import type {
  DirectEventHandler,
  Double,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

type AppleSurfaceEvent = Readonly<{
  phase: string;
  reason: string;
  nativeId: Double;
  viewGeneration: Double;
  surfaceGeneration: Double;
  logicalWidth: Double;
  logicalHeight: Double;
  width: Double;
  height: Double;
  scale: Double;
  bound: boolean;
  visible: boolean;
}>;
type NativeMouseEvent = Readonly<{
  protocol: Double;
  nativeId: Double;
  kind: string;
  device: string;
  pointer: Double;
  buttons: Double;
  x: Double;
  y: Double;
  timestamp: Double;
}>;

type AndroidPointerEvent = Readonly<{
  protocol: Double;
  nativeId: Double;
  samples: {
    kind: string;
    device: string;
    pointer: Double;
    buttons: Double;
    x: Double;
    y: Double;
    timestamp: Double;
  }[];
}>;

// @ts-ignore - pointerEvents needs to be redeclared for codegen to generate native bindings
export interface NativeProps extends ViewProps {
  mouseCursor?: string;
  onNativeMouseEvent?: DirectEventHandler<NativeMouseEvent>;
  onAndroidPointer?: DirectEventHandler<AndroidPointerEvent>;
  onAppleSurfaceStatus?: DirectEventHandler<AppleSurfaceEvent>;
  opaque?: boolean;
  highBitDepth?: boolean;
  androidSurfaceType?: WithDefault<'auto' | 'SurfaceView' | 'TextureView', 'auto'>;
  androidZOrderOnTop?: WithDefault<boolean, false>;
  pointerEvents?: WithDefault<'auto' | 'none' | 'box-none' | 'box-only', 'auto'>;
}

export default codegenNativeComponent<NativeProps>('SkiaView');
