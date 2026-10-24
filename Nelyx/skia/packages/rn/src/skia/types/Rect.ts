import type {SkJSIInstance} from './JsiInstance.ts';

export interface SkRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SkHostRect extends SkRect, SkJSIInstance<"Rect"> {
  setXYWH(x: number, y: number, width: number, height: number): void;
  setLTRB(left: number, top: number, right: number, bottom: number): void;
}

export const isRect = (def: unknown): def is SkRect => {
  "worklet";
  if (typeof def === "object" && def !== null) {
    const rect = def as SkRect;
    return (
      typeof rect.x === "number" &&
      typeof rect.y === "number" &&
      typeof rect.width === "number" &&
      typeof rect.height === "number"
    );
  }
  return false;
};
