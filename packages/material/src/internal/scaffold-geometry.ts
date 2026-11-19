// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/scaffold.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { invariant } from '@nelyx/core/foundation/errors';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { Rect } from '@nelyx/core/ui/rect';

export interface ScaffoldGeometryOptions {
  readonly bottomNavigationBarTop?: number | null;
  readonly floatingActionButtonArea?: Rect | null;
}

/** The last layout of the scaffold's bottom bar and visible FAB. */
export class ScaffoldGeometry {
  readonly bottomNavigationBarTop: number | null;
  readonly floatingActionButtonArea: Rect | null;

  constructor({
    bottomNavigationBarTop = null,
    floatingActionButtonArea = null,
  }: ScaffoldGeometryOptions = {}) {
    this.bottomNavigationBarTop = bottomNavigationBarTop;
    this.floatingActionButtonArea = floatingActionButtonArea;
    Object.freeze(this);
  }

  copyWith({
    bottomNavigationBarTop,
    floatingActionButtonArea,
  }: ScaffoldGeometryOptions = {}): ScaffoldGeometry {
    return new ScaffoldGeometry({
      bottomNavigationBarTop: bottomNavigationBarTop ?? this.bottomNavigationBarTop,
      floatingActionButtonArea: floatingActionButtonArea ?? this.floatingActionButtonArea,
    });
  }
}

export class ScaffoldGeometryNotifier
  extends ChangeNotifier
  implements ValueListenable<ScaffoldGeometry>
{
  private bottomNavigationBarTop: number | null = null;
  private button: Rect | null = null;
  private scale = 1;
  private latest = new ScaffoldGeometry();

  constructor(private readonly isPainting: () => boolean) {
    super();
  }

  get value(): ScaffoldGeometry {
    if (FoundationBuildMode.debug)
      invariant(
        this.isPainting(),
        'scaffold-geometry-outside-paint',
        'Scaffold geometry can only be read during paint',
      );
    return this.latest;
  }

  /** Internal clip queries can run during hit testing as well as paint. */
  get clipGeometry(): ScaffoldGeometry {
    return this.latest;
  }

  updateLayout(bottomNavigationBarTop: number | null, button: Rect | null): void {
    this.bottomNavigationBarTop = bottomNavigationBarTop;
    this.button = button;
    this.publish();
  }

  updateScale(scale: number): void {
    if (this.scale === scale) return;
    this.scale = scale;
    this.publish();
  }

  private publish(): void {
    const { button, scale, bottomNavigationBarTop } = this;
    const area =
      !button || scale <= 0
        ? null
        : scale === 1
          ? button
          : Rect.fromCenter({
              center: button.center,
              width: button.width * scale,
              height: button.height * scale,
            });
    const last = this.latest;
    if (
      last.bottomNavigationBarTop === bottomNavigationBarTop &&
      (last.floatingActionButtonArea === area || last.floatingActionButtonArea?.equals(area))
    )
      return;
    this.latest = new ScaffoldGeometry({ bottomNavigationBarTop, floatingActionButtonArea: area });
    this.notifyListeners();
  }
}
