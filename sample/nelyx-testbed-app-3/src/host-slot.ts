// SPDX-License-Identifier: BSD-3-Clause
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget, type Widget } from '@nelyx/core/framework/widgets/framework';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { tickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { Offset } from '@nelyx/core/ui/offset';
import { Theme } from '@nelyx/material/theme';

export type HostPage = 'platform' | 'webview' | 'texture';
export interface HostPlacement {
  readonly page: HostPage;
  readonly visible: boolean;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly dark: boolean;
  readonly surface: number;
  readonly container: number;
  readonly onSurface: number;
  readonly primary: number;
  readonly onPrimary: number;
  readonly outline: number;
}

export class HostSlot extends StatefulWidget {
  constructor(
    readonly page: HostPage,
    readonly publish: (placement: HostPlacement | null) => void,
    readonly visible: boolean,
  ) {
    super();
  }
  override createState() {
    return new HostSlotState();
  }
}

class HostSlotState extends State<HostSlot> {
  private scheduled = false;
  private placement: HostPlacement | null = null;

  override build(): Widget {
    return new LayoutBuilder((context) => {
      const scheme = Theme.of(context).colorScheme;
      if (!this.scheduled) {
        this.scheduled = true;
        tickerScheduler(context).addPostFrameCallback(() => {
          this.scheduled = false;
          if (!this.mounted || !context.mounted) return;
          const box = context.findRenderObject();
          if (!(box instanceof RenderBox) || !box.hasSize) return;
          const { x, y } = box.localToGlobal(Offset.zero);
          const { width, height } = box.size;
          const next: HostPlacement = {
            page: this.widget.page,
            visible: this.widget.visible,
            left: x,
            top: y,
            width,
            height,
            dark: scheme.brightness === 'dark',
            surface: scheme.surface,
            container: scheme.surfaceContainer,
            onSurface: scheme.onSurface,
            primary: scheme.primary,
            onPrimary: scheme.onPrimary,
            outline: scheme.outlineVariant,
          };
          const previous = this.placement;
          if (
            !previous ||
            (Object.keys(next) as (keyof HostPlacement)[]).some(
              (key) => next[key] !== previous[key],
            )
          ) {
            this.placement = next;
            this.widget.publish(next);
          }
        });
      }
      return SizedBox.expand();
    });
  }

  override dispose(): void {
    this.widget.publish(null);
    super.dispose();
  }
}
