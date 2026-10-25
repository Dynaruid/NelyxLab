import type { ReactNode } from "react";

import type {BlendMode} from "@nelyx/skia-native/skia/types/Paint/BlendMode";
import type {Color} from "@nelyx/skia-native/skia/types/Color";
import type {InputMatrix} from "@nelyx/skia-native/skia/types/Drawing";
import type {InputRRect, SkRRect} from "@nelyx/skia-native/skia/types/RRect";
import type {PaintStyle, SkPaint, StrokeCap, StrokeJoin} from "@nelyx/skia-native/skia/types/Drawing";
import type {SkPath} from "@nelyx/skia-native/skia/types/Drawing";
import type {SkRect} from "@nelyx/skia-native/skia/types/Rect";
import type {Transforms3d} from "@nelyx/skia-native/skia/types/Matrix4";
import type {Vector} from "@nelyx/skia-native/skia/types/Point";

export type SkEnum<T> = Uncapitalize<keyof T extends string ? keyof T : never>;

export type PathDef = string | SkPath;

export type ClipDef = SkRRect | SkRect | PathDef;

export type Fit =
  | "cover"
  | "contain"
  | "fill"
  | "fitHeight"
  | "fitWidth"
  | "none"
  | "scaleDown";

export type Radius = number | Vector;

export interface ChildrenProps {
  children?: ReactNode | ReactNode[];
}

export interface RectCtor {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface RRectCtor extends RectCtor {
  r?: Radius;
}

export type RectDef = RectCtor | { rect: SkRect };
export type RRectDef = RRectCtor | { rect: InputRRect };

export interface PointCircleDef {
  c?: Vector;
  r: number;
}

export interface ScalarCircleDef {
  cx: number;
  cy: number;
  r: number;
}

export type CircleDef = PointCircleDef | ScalarCircleDef;

export interface TransformProps {
  transform?: Transforms3d;
  origin?: Vector;
  matrix?: InputMatrix;
}

export interface CTMProps extends TransformProps {
  clip?: ClipDef;
  invertClip?: boolean;
  layer?: SkPaint | boolean;
}

export interface PaintProps extends ChildrenProps {
  color?: Color;
  strokeWidth?: number;
  blendMode?: SkEnum<typeof BlendMode>;
  style?: SkEnum<typeof PaintStyle>;
  strokeJoin?: SkEnum<typeof StrokeJoin>;
  strokeCap?: SkEnum<typeof StrokeCap>;
  strokeMiter?: number;
  opacity?: number;
  antiAlias?: boolean;
  dither?: boolean;
}

export interface GroupProps extends PaintProps, CTMProps {
  zIndex?: number;
}
