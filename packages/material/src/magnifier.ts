// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned material/magnifier.dart: geometry, constants, line-jump timing and listener lifetime.
import { StatelessWidget, StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { AnimatedPositioned } from '@nelyx/core/framework/widgets/implicit-animations';
import { ColoredBox } from '@nelyx/core/framework/widgets/basic';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  RawMagnifier,
  MagnifierDecoration,
  MagnifierController,
  TextMagnifierConfiguration,
} from '@nelyx/core/framework/widgets/magnifier';
import type { MagnifierInfo } from '@nelyx/core/framework/widgets/magnifier';
import type { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { Size } from '@nelyx/core/ui/size';
import type { Clip } from '@nelyx/core/ui/clip';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { CupertinoTextMagnifier } from '@nelyx/cupertino/magnifier';
export interface MagnifierOptions extends WidgetOptions {
  readonly additionalFocalPointOffset?: Offset;
  readonly borderRadius?: BorderRadius;
  readonly filmColor?: number;
  readonly shadows?: readonly BoxShadow[];
  readonly clipBehavior?: Clip;
  readonly size?: Size;
}
export class Magnifier extends StatelessWidget {
  static readonly kDefaultMagnifierSize = new Size(77.37, 37.9);
  static readonly kStandardVerticalFocalPointShift = 22;
  readonly additionalFocalPointOffset: Offset;
  readonly borderRadius: BorderRadius;
  readonly filmColor: number;
  readonly shadows: readonly BoxShadow[];
  readonly clipBehavior: Clip;
  readonly size: Size;
  constructor({
    key = null,
    additionalFocalPointOffset = Offset.zero,
    borderRadius = BorderRadius.circular(40),
    filmColor = 0x089e9e9e,
    shadows = [
      new BoxShadow({
        blurRadius: 1.5,
        offset: new Offset(0, 2),
        spreadRadius: 0.75,
        color: 0x19000000,
      }),
    ],
    clipBehavior = 'hardEdge',
    size = Magnifier.kDefaultMagnifierSize,
  }: MagnifierOptions = {}) {
    super(key);
    this.additionalFocalPointOffset = additionalFocalPointOffset;
    this.borderRadius = borderRadius;
    this.filmColor = filmColor;
    this.shadows = Object.freeze([...shadows]);
    this.clipBehavior = clipBehavior;
    this.size = size;
  }
  build(_context: BuildContext): Widget {
    return new RawMagnifier({
      size: this.size,
      magnificationScale: 1.25,
      focalPointOffset: new Offset(
        0,
        Magnifier.kDefaultMagnifierSize.height / 2 + Magnifier.kStandardVerticalFocalPointShift,
      ).add(this.additionalFocalPointOffset),
      decoration: new MagnifierDecoration({
        shape: new RoundedRectangleBorder({ borderRadius: this.borderRadius }),
        shadows: this.shadows,
      }),
      clipBehavior: this.clipBehavior,
      child: new ColoredBox({ color: this.filmColor }),
    });
  }
}
export class TextMagnifier extends StatefulWidget {
  static readonly jumpBetweenLinesAnimationDuration = 70;
  private static readonly adaptiveConfigurations = new Map<string, TextMagnifierConfiguration>();
  private static adaptiveOverride: TextMagnifierConfiguration | null = null;
  static set adaptiveMagnifierConfiguration(value: TextMagnifierConfiguration) {
    this.adaptiveOverride = value;
  }
  static get adaptiveMagnifierConfiguration(): TextMagnifierConfiguration {
    if (this.adaptiveOverride !== null) return this.adaptiveOverride;
    const platform = FoundationPlatform.defaultTargetPlatform,
      previous = this.adaptiveConfigurations.get(platform);
    if (previous) return previous;
    const configuration = new TextMagnifierConfiguration({
      shouldDisplayHandlesInMagnifier: platform === 'iOS',
      magnifierBuilder: (_context, controller, magnifierInfo) => {
        switch (FoundationPlatform.defaultTargetPlatform) {
          case 'iOS':
            return new CupertinoTextMagnifier({ controller, magnifierInfo });
          case 'android':
            return new TextMagnifier({ magnifierInfo });
          default:
            return null;
        }
      },
    });
    this.adaptiveConfigurations.set(platform, configuration);
    return configuration;
  }
  readonly magnifierInfo: ValueNotifier<MagnifierInfo>;
  constructor({
    magnifierInfo,
    key = null,
  }: {
    readonly magnifierInfo: ValueNotifier<MagnifierInfo>;
  } & WidgetOptions) {
    super(key);
    this.magnifierInfo = magnifierInfo;
  }
  createState(): State<TextMagnifier> {
    return new TextMagnifierState();
  }
}
class TextMagnifierState extends State<TextMagnifier> {
  private position: Offset | null = null;
  private focal = Offset.zero;
  private timer: {
    dispose(): void;
  } | null = null;
  private generation = 0;
  override initState(): void {
    super.initState();
    this.widget.magnifierInfo.addListener(this.determinePosition);
  }
  override didChangeDependencies(): void {
    this.determinePosition();
    super.didChangeDependencies();
  }
  override didUpdateWidget(old: TextMagnifier): void {
    if (old.magnifierInfo !== this.widget.magnifierInfo) {
      old.magnifierInfo.removeListener(this.determinePosition);
      this.widget.magnifierInfo.addListener(this.determinePosition);
      this.determinePosition();
    }
    super.didUpdateWidget(old);
  }
  private readonly determinePosition = () => {
    if (!this.mounted) return;
    const info = this.widget.magnifierInfo.value,
      media = MediaQuery.of(this.context),
      size = Magnifier.kDefaultMagnifierSize;
    const x = Math.max(
      info.currentLineBoundaries.left,
      Math.min(info.globalGesturePosition.dx, info.currentLineBoundaries.right),
    );
    const original = Rect.fromLTWH(
      x - size.width / 2,
      info.caretRect.center.dy - (size.height + Magnifier.kStandardVerticalFocalPointShift),
      size.width,
      size.height,
    );
    const adjusted = MagnifierController.shiftWithinBounds({
        rect: original,
        bounds: Rect.fromLTWH(0, 0, media.width, media.height),
      }),
      inset = size.width / 2 / 1.25;
    const focalX =
      info.fieldBounds.width < inset * 2
        ? info.fieldBounds.center.dx
        : Math.max(
            info.fieldBounds.left + inset,
            Math.min(adjusted.center.dx, info.fieldBounds.right - inset),
          );
    if (this.position !== null && adjusted.top !== this.position.dy) {
      if (this.timer !== null) this.timer.dispose();
      const generation = ++this.generation;
      this.timer = schedule(() => {
        if (this.mounted && generation === this.generation)
          this.setState(() => {
            this.timer = null;
          });
      }, TextMagnifier.jumpBetweenLinesAnimationDuration);
    }
    this.setState(() => {
      this.position = adjusted.topLeft;
      this.focal = new Offset(focalX - adjusted.center.dx, original.top - adjusted.top);
    });
  };
  build(_context: BuildContext): Widget {
    return new AnimatedPositioned({
      left: this.position!.dx,
      top: this.position!.dy,
      duration: this.timer === null ? 0 : TextMagnifier.jumpBetweenLinesAnimationDuration,
      child: new Magnifier({ additionalFocalPointOffset: this.focal }),
    });
  }
  override dispose(): void {
    this.generation++;
    this.widget.magnifierInfo.removeListener(this.determinePosition);
    if (this.timer !== null) this.timer.dispose();
    this.timer = null;
    super.dispose();
  }
}
// A cancellable host timer; the view-owned State also guards queued callbacks.
function schedule(
  callback: () => void,
  milliseconds: number,
): {
  dispose(): void;
} {
  const host = globalThis as unknown as {
    setTimeout?: (callback: () => void, delay: number) => unknown;
    clearTimeout?: (handle: unknown) => void;
  };
  if (!host.setTimeout || !host.clearTimeout)
    throw new Error('Material magnifier requires host one-shot timers');
  let active = true;
  const handle = host.setTimeout(() => {
    if (active) {
      active = false;
      callback();
    }
  }, milliseconds);
  return {
    dispose() {
      if (active) {
        active = false;
        host.clearTimeout!(handle);
      }
    },
  };
}
