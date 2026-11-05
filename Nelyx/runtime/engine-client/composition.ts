// SPDX-License-Identifier: BSD-3-Clause
import {
  Box,
  Row,
  Column,
  Stack,
  NodeWidget,
  StatelessWidget,
  StatefulWidget,
  State,
} from './widgets.ts';
import type { Widget, NodeOptions, BuildContext } from './widgets.ts';
import type { NodeLayout, AxisBound } from './codec.ts';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
export {
  Listenable,
  ChangeNotifier,
  ValueListenable,
  ValueNotifier,
} from '@nelyx/core/foundation/notifier';
export interface EdgeInsets {
  readonly left?: number;
  readonly top?: number;
  readonly right?: number;
  readonly bottom?: number;
}
export const EdgeInsets = Object.freeze({
  all: (value: number): EdgeInsets => ({ left: value, top: value, right: value, bottom: value }),
  symmetric: (horizontal = 0, vertical = 0): EdgeInsets => ({
    left: horizontal,
    right: horizontal,
    top: vertical,
    bottom: vertical,
  }),
  only: (value: EdgeInsets): EdgeInsets => ({ ...value }),
});
export class Padding extends Box {
  constructor(child: Widget, insets: EdgeInsets, options: NodeOptions = {}) {
    super([child], { ...options, layout: { ...options.layout, padding: insets } });
  }
}
export type Alignment =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'centerLeft'
  | 'center'
  | 'centerRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';
export class Align extends Box {
  constructor(child: Widget, alignment: Alignment = 'center', options: NodeOptions = {}) {
    const horizontal =
      alignment.endsWith('Left') || alignment === 'centerLeft'
        ? 'start'
        : alignment.endsWith('Right') || alignment === 'centerRight'
          ? 'end'
          : 'center';
    const vertical = alignment.startsWith('top')
      ? 'start'
      : alignment.startsWith('bottom')
        ? 'end'
        : 'center';
    super([child], {
      ...options,
      layout: {
        ...options.layout,
        direction: 'vertical',
        mainAlign: vertical,
        crossAlign: horizontal,
      },
    });
  }
}
export class Center extends Align {
  constructor(child: Widget, options: NodeOptions = {}) {
    super(child, 'center', options);
  }
}
export class SizedBox extends Box {
  constructor(
    width: number | undefined,
    height: number | undefined,
    child?: Widget,
    options: NodeOptions = {},
  ) {
    super(child ? [child] : [], {
      ...options,
      properties: {
        ...options.properties,
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
      },
    });
  }
}
export class ConstrainedBox extends Box {
  constructor(
    child: Widget,
    horizontal: AxisBound,
    vertical: AxisBound,
    options: NodeOptions = {},
  ) {
    super([child], { ...options, horizontal, vertical });
  }
}
export class Flexible extends Box {
  constructor(
    child: Widget,
    flex = 1,
    fit: NodeLayout['fit'] = 'loose',
    options: NodeOptions = {},
  ) {
    super([child], { ...options, layout: { ...options.layout, flex, fit } });
  }
}
export class Expanded extends Flexible {
  constructor(child: Widget, flex = 1, options: NodeOptions = {}) {
    super(child, flex, 'tight', options);
  }
}
export class Spacer extends Box {
  constructor(flex = 1, options: NodeOptions = {}) {
    super([], { ...options, layout: { ...options.layout, flex, fit: 'tight' } });
  }
}
export class Positioned extends Box {
  constructor(
    child: Widget,
    x: number,
    y: number,
    width: number,
    height: number,
    options: NodeOptions = {},
  ) {
    super([child], { ...options, properties: { ...options.properties, x, y, width, height } });
  }
}
export class Opacity extends NodeWidget {
  constructor(child: Widget, opacity: number, options: NodeOptions = {}) {
    super('effect', [child], { ...options, properties: { ...options.properties, opacity } });
  }
}
export class DecoratedBox extends Box {
  constructor(
    child: Widget,
    decoration: Pick<NodeOptions, 'color' | 'radius' | 'graphics'>,
    options: NodeOptions = {},
  ) {
    super([child], { ...options, ...decoration });
  }
}
export class Builder extends StatelessWidget {
  constructor(
    readonly builder: (context: BuildContext) => Widget,
    options: Pick<NodeOptions, 'key'> = {},
  ) {
    super(options.key);
  }
  build(context: BuildContext): Widget {
    return this.builder(context);
  }
}
export class ValueListenableBuilder<T> extends StatefulWidget {
  constructor(
    readonly listenable: ValueListenable<T>,
    readonly builder: (context: BuildContext, value: T, child?: Widget) => Widget,
    readonly child?: Widget,
    options: Pick<NodeOptions, 'key'> = {},
  ) {
    super(options.key);
  }
  createState(): State {
    return new ValueBuilderState<T>();
  }
}
class ValueBuilderState<T> extends State<ValueListenableBuilder<T>> {
  private changed = () => {
    if (this.mounted) this.setState(() => {});
  };
  initState(): void {
    this.widget.listenable.addListener(this.changed);
  }
  didUpdateWidget(old: ValueListenableBuilder<T>): void {
    if (old.listenable !== this.widget.listenable) {
      old.listenable.removeListener(this.changed);
      this.widget.listenable.addListener(this.changed);
    }
  }
  dispose(): void {
    this.widget.listenable.removeListener(this.changed);
  }
  build(context: BuildContext): Widget {
    return this.widget.builder(context, this.widget.listenable.value, this.widget.child);
  }
}
export { Box, Row, Column, Stack };
