import type {SkPoint} from './Point.ts';
import type {SkRect} from './Rect.ts';

export interface SkRRect {
  readonly rect: SkRect;
  readonly rx: number;
  readonly ry: number;
}

export interface NonUniformRRect {
  readonly rect: SkRect;
  readonly topLeft: SkPoint;
  readonly topRight: SkPoint;
  readonly bottomRight: SkPoint;
  readonly bottomLeft: SkPoint;
}

export type InputRRect = SkRRect | NonUniformRRect;

// We have an issue to check property existence on JSI backed instances
export const isRRect = (def: unknown): def is SkRRect => {
  "worklet";
  return (
    typeof def === "object" &&
    def !== null &&
    typeof (def as any).rect === "object"
  );
};
