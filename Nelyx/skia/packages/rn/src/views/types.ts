import type { ViewProps,NativeSyntheticEvent } from "react-native";
import type { SharedValue } from '../runtime/shared-value.ts';

import type {SkGraphiteContext} from '../skia/types/Graphite.ts';
import type {SkImage} from "../skia/types/Drawing.ts";
import type {SkPicture} from "../skia/types/Drawing.ts";
import type {SkRect} from '../skia/types/Rect.ts';
import type {SkSize} from '../skia/types/Size.ts';

export type AndroidSurfaceType = "SurfaceView" | "TextureView";

export interface AndroidCanvasProps {
  /**
   * Backing view. Defaults to `SurfaceView` when the canvas is `opaque` and to
   * `TextureView` otherwise; both composite correctly in React Native stacking
   * order without further flags.
   */
  surfaceType?: AndroidSurfaceType;
  /**
   * SurfaceView only: composite above every React Native view in the window,
   * ignoring `zIndex`. Ignored for TextureView. Defaults to false.
   */
  zOrderOnTop?: boolean;
}

export interface ISkiaViewApi {
  mouseCursorVersion?:()=>number;
  web?: boolean;
  setJsiProperty: <T>(nativeId: number, name: string, value: T) => void;
  requestRedraw: (nativeId: number) => void;
  /**
   * Reads the shared values into the recording held for the view and
   * schedules a redraw. Native only; called from a worklet on every frame.
   * Until the view registers, the recording is queued for it and kept
   * current all the same. Ignored when the recording `recorderId` is neither
   * held by the view nor queued for it.
   */
  applyUpdates: (
    nativeId: number,
    recorderId: number,
    values: SharedValue<unknown>[]
  ) => void;
  makeImageSnapshot: (nativeId: number, rect?: SkRect) => SkImage;
  makeImageSnapshotAsync: (nativeId: number, rect?: SkRect) => Promise<SkImage>;
  size: (nativeId: number) => SkSize;
  /**
   * The recording side of a view: its native id, the layout size in points,
   * and the props its surface format follows from.
   */
  makeGraphiteContext: (
    nativeId: number,
    width: number,
    height: number,
    opaque: boolean,
    highBitDepth: boolean,
    pixelDensity?: number
  ) => SkGraphiteContext;
}

/** The props every Skia view takes, whichever way it is drawn. */
export interface SkiaBaseViewProps extends ViewProps {
  /** Actual native canvas cursor kind, supplied by the app-owned SDK port. */
  mouseCursor?:string;
  onNativeMouseEvent?:(event:NativeSyntheticEvent<NativeMouseEvent>)=>void;
  /** Non-coalescing Android contact samples, including native MotionEvent history. */
  onAndroidPointer?:(event:NativeSyntheticEvent<AndroidPointerEvent>)=>void;
  /** Windows raw wheel input in logical coordinates; SDK owns routing and current-generation admission. */
  onWindowsWheel?:(event:NativeSyntheticEvent<WindowsWheelEvent>)=>void;
  /** Owned Windows pointer port; full native source and view lifetime are required. */
  onWindowsPointer?:(event:NativeSyntheticEvent<WindowsPointerEvent>)=>void;
  onWindowsKey?:(event:NativeSyntheticEvent<WindowsKeyEvent>)=>void;
  onWindowsKeyboardFocus?:(event:NativeSyntheticEvent<WindowsKeyboardFocusEvent>)=>void;
  onWindowsText?:(event:NativeSyntheticEvent<WindowsTextEvent>)=>void;
  /** Windows per-view binding/backing status; visible scanout is a separate check. */
  onWindowsSurfaceStatus?: (event:NativeSyntheticEvent<WindowsSurfaceStatus>)=>void;
  /** Apple per-view backing/lifetime metadata; native qualification is separate. */
  onAppleSurfaceStatus?: (event:NativeSyntheticEvent<AppleSurfaceStatus>)=>void;
  /** Linux Fabric view lifecycle/capability status. It does not certify GPU pixels. */
  onLinuxSurfaceStatus?: (event:NativeSyntheticEvent<LinuxSurfaceStatus>)=>void;
  /**
   * Declares that the canvas covers every pixel of its bounds. On Android an
   * opaque canvas is backed by a `SurfaceView` by default, the cheapest path
   * (see `android.surfaceType`). Defaults to false.
   */
  opaque?: boolean;

  /**
   * Renders into a surface with more than 8 bits per channel (16-bit float on
   * iOS, 10-bit on Android) to avoid banding in subtle gradients. On Android
   * the extra precision survives composition only when combined with `opaque`.
   */
  highBitDepth?: boolean;

  /** Android-only rendering options. Ignored on iOS and web. */
  android?: AndroidCanvasProps;

  // On web, only 16 WebGL contextes are allowed. If the drawing is non-animated, set
  // __destroyWebGLContextAfterRender to true to release the context after each draw.
  __destroyWebGLContextAfterRender?: boolean;
}
export interface LinuxSurfaceStatus {
  readonly phase:string;readonly reason:string;readonly nativeId:number;
  readonly width:number;readonly height:number;readonly gpuPrepared:boolean;
  readonly logicalWidth:number;readonly logicalHeight:number;readonly scale:number;
  readonly surfaceGeneration:number;
  readonly bound:boolean;readonly mapped:boolean;
}
/** Untrusted native event fields are validated by the owning SDK ingress. */
export interface AndroidPointerSample {readonly kind:string;readonly device:string;readonly pointer:number;readonly buttons:number;readonly x:number;readonly y:number;readonly timestamp:number}
export interface AndroidPointerEvent {readonly protocol:number;readonly nativeId:number;readonly samples:readonly AndroidPointerSample[]}
export interface NativeMouseEvent {readonly protocol:number;readonly nativeId:number;readonly kind:string;readonly device:string;readonly pointer:number;readonly buttons:number;readonly x:number;readonly y:number;readonly timestamp:number}
export interface AppleSurfaceStatus {
  readonly phase:string;readonly reason:string;readonly nativeId:number;
  readonly viewGeneration:number;readonly surfaceGeneration:number;
  readonly logicalWidth:number;readonly logicalHeight:number;readonly width:number;readonly height:number;readonly scale:number;
  readonly bound:boolean;readonly visible:boolean;
  readonly layoutRevision?:number;readonly resizePending?:boolean;readonly pointerGeometryReady?:boolean;
}
export interface WindowsSurfaceStatus {
  readonly preparing:boolean;
  readonly framePipelineVersion:2;
  readonly pointerVersion:1;
  readonly keyboardVersion:2;
  readonly visibilityVersion:1;
  readonly phase:string;readonly reason:string;readonly nativeId:number;readonly reactTag:number;
  readonly viewGeneration:number;readonly surfaceGeneration:number;readonly frames:number;
  readonly logicalWidth:number;readonly logicalHeight:number;readonly width:number;readonly height:number;readonly scale:number;
  readonly bound:boolean;readonly visible:boolean;
  readonly layoutRevision?:number;readonly resizePending?:boolean;readonly pointerGeometryReady?:boolean;
}
export interface WindowsWheelEvent {readonly x:number;readonly y:number;readonly deltaX:number;readonly deltaY:number;readonly surfaceGeneration:number;readonly timestamp?:number;readonly sequence?:number;readonly sourceTimestamp?:number;readonly pointer?:number;readonly device?:'mouse'|'trackpad'}
export interface WindowsPointerEvent {
  readonly protocol:1;readonly kind:'down'|'move'|'up'|'cancel'|'hover'|'leave'|'panZoomStart'|'panZoomUpdate'|'panZoomEnd'|'inertiaCancel';
  readonly pointer:number;readonly device:'mouse'|'touch'|'pen'|'trackpad'|'unknown';readonly buttons:number;
  readonly x:number;readonly y:number;readonly surfaceGeneration:number;
  readonly timestamp?:number;readonly sequence?:number;
  readonly panX?:number;readonly panY?:number;readonly deltaX?:number;readonly deltaY?:number;readonly scale?:number;readonly rotation?:number;
}
export interface WindowsKeyboardFocusEvent {readonly protocol:1;readonly sequence:number;readonly focused:boolean;readonly viewGeneration:number}
export interface WindowsTextEvent {readonly protocol:1;readonly sequence:number;readonly viewGeneration:number;readonly characterCodePoint:number;readonly repeatCount:number;readonly focusEpoch:number}
export interface WindowsKeyEvent {
  readonly protocol:1;readonly sequence:number;readonly viewGeneration:number;
  readonly kind:'down'|'up';readonly keyCode:number;readonly scanCode:number;readonly characterCodePoint:number;readonly modifiers:number;
  readonly repeat:boolean;readonly repeatCount:number;readonly dead:boolean;
  readonly focusEpoch:number;
  readonly capsLock:boolean;readonly numLock:boolean;readonly scrollLock:boolean;
}

export interface SkiaPictureViewNativeProps extends SkiaBaseViewProps {
  picture?: SkPicture;
}

export type SkiaGraphiteViewNativeProps = SkiaBaseViewProps;
