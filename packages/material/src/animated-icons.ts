// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { lerpDouble } from '@nelyx/core/internal/ui/lerp-double.generated';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { clampDouble } from '@nelyx/core/ui/math';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import type { TextDirection } from '@nelyx/core/ui/typography';
import { animatedIconFrames } from './generated/animated-icons/animated-icon-frames.generated.ts';
import type { AnimatedIconFrames, IconPoint } from './internal/animated-icon-frames.ts';

export abstract class AnimatedIconData {
  constructor() {}
  abstract get matchTextDirection(): boolean;
}

const framesFor = new WeakMap<AnimatedIconData, AnimatedIconFrames>();
class VectorIconData extends AnimatedIconData {
  constructor(
    readonly matchTextDirection: boolean,
    frames: AnimatedIconFrames,
  ) {
    super();
    framesFor.set(this, frames);
    Object.freeze(this);
  }
}

function icon(name: keyof typeof animatedIconFrames): AnimatedIconData {
  const frames = animatedIconFrames[name];
  return new VectorIconData(frames.matchTextDirection, frames);
}

export class AnimatedIcons {
  private constructor() {}
  static readonly add_event = icon('add_event');
  static readonly arrow_menu = icon('arrow_menu');
  static readonly close_menu = icon('close_menu');
  static readonly ellipsis_search = icon('ellipsis_search');
  static readonly event_add = icon('event_add');
  static readonly home_menu = icon('home_menu');
  static readonly list_view = icon('list_view');
  static readonly menu_arrow = icon('menu_arrow');
  static readonly menu_close = icon('menu_close');
  static readonly menu_home = icon('menu_home');
  static readonly pause_play = icon('pause_play');
  static readonly play_pause = icon('play_pause');
  static readonly search_ellipsis = icon('search_ellipsis');
  static readonly view_list = icon('view_list');
}

Object.freeze(AnimatedIcons);

export interface AnimatedIconOptions extends WidgetOptions {
  readonly icon: AnimatedIconData;
  readonly progress: Animation<number>;
  readonly color?: Color | null;
  readonly size?: number | null;
  readonly semanticLabel?: string | null;
  readonly textDirection?: TextDirection | null;
}

export class AnimatedIcon extends StatelessWidget {
  readonly icon: AnimatedIconData;
  readonly progress: Animation<number>;
  readonly color: Color | null;
  readonly size: number | null;
  readonly semanticLabel: string | null;
  readonly textDirection: TextDirection | null;

  constructor({
    icon,
    progress,
    color = null,
    size = null,
    semanticLabel = null,
    textDirection = null,
    key = null,
  }: AnimatedIconOptions) {
    super(key);
    this.icon = icon;
    this.progress = progress;
    this.color = color;
    this.size = size;
    this.semanticLabel = semanticLabel;
    this.textDirection = textDirection;
  }

  override build(context: BuildContext): Widget {
    const frames = framesFor.get(this.icon);
    invariant(frames, 'invalid-animated-icon-data', 'Use an icon supplied by AnimatedIcons');
    const theme = IconTheme.of(context);
    const size = this.size ?? theme.size!;
    const direction = this.textDirection ?? Directionality.of(context);
    const opacity = theme.opacity!;
    let color = this.color ?? theme.color!;
    if (opacity !== 1) color = color.withOpacity(color.opacity * opacity);
    return new Semantics({
      label: this.semanticLabel,
      child: new CustomPaint(undefined, {
        size: { width: size, height: size },
        painter: new AnimatedIconPainter(
          frames,
          this.progress,
          color,
          size / frames.width,
          direction === 'rtl' && frames.matchTextDirection,
        ),
      }),
    });
  }
}

function sample<T>(
  values: readonly T[],
  progress: number,
  interpolate: (a: T, b: T, ratio: number) => T,
): T {
  const index = (values.length - 1) * progress;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return lower === upper
    ? values[lower]!
    : interpolate(values[lower]!, values[upper]!, index - lower);
}

function lerpFrame(a: number, b: number, t: number): number {
  return lerpDouble(a, b, t)!;
}

function lerpPoint(a: IconPoint, b: IconPoint, t: number): IconPoint {
  return [lerpFrame(a[0], b[0], t), lerpFrame(a[1], b[1], t)];
}

class AnimatedIconPainter extends CustomPainter {
  constructor(
    readonly frames: AnimatedIconFrames,
    readonly progress: Animation<number>,
    readonly color: Color,
    readonly scale: number,
    readonly mirror: boolean,
  ) {
    super({ repaint: progress });
  }

  override paint(canvas: Canvas, size: Size): void {
    if (this.mirror) {
      canvas.rotate(Math.PI);
      canvas.translate(-size.width, -size.height);
    }
    canvas.scale(this.scale);
    const progress = clampDouble(this.progress.value, 0, 1);
    for (const frame of this.frames.paths) {
      const opacity = sample(frame.opacities, progress, lerpFrame);
      const path = new Path();
      for (const command of frame.commands) {
        switch (command[0]) {
          case 'moveTo':
            path.moveTo(...sample(command[1], progress, lerpPoint));
            break;
          case 'lineTo':
            path.lineTo(...sample(command[1], progress, lerpPoint));
            break;
          case 'cubicTo':
            path.cubicTo(
              ...sample(command[1], progress, lerpPoint),
              ...sample(command[2], progress, lerpPoint),
              ...sample(command[3], progress, lerpPoint),
            );
            break;
          case 'close':
            path.close();
        }
      }
      canvas.drawPath(
        path,
        new Paint({ color: this.color.withOpacity(this.color.opacity * opacity).toARGB32() }),
      );
    }
  }

  override shouldRepaint(old: CustomPainter): boolean {
    return (
      !(old instanceof AnimatedIconPainter) ||
      old.progress.value !== this.progress.value ||
      !old.color.equals(this.color) ||
      old.frames !== this.frames ||
      old.scale !== this.scale ||
      old.mirror !== this.mirror
    );
  }

  override shouldRebuildSemantics(_old: CustomPainter): boolean {
    return false;
  }
}
