// SPDX-License-Identifier: BSD-3-Clause
export type IconPoint = readonly [x: number, y: number];
type PointTrack = readonly IconPoint[];

type PathCommand =
  | readonly [kind: 'moveTo' | 'lineTo', points: PointTrack]
  | readonly [kind: 'cubicTo', control1: PointTrack, control2: PointTrack, points: PointTrack]
  | readonly [kind: 'close'];

export interface AnimatedIconFrames {
  readonly width: number;
  readonly matchTextDirection: boolean;
  readonly paths: readonly {
    readonly opacities: readonly number[];
    readonly commands: readonly PathCommand[];
  }[];
}
