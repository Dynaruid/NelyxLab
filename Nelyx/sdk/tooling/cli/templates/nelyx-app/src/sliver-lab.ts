// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import {
  Column,
  Expanded,
  Text,
  SizedBox,
  DecoratedBox,
  SliverToBoxAdapter,
} from '@nelyx/core/framework/widgets/basic';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { ValueKey } from '@nelyx/core/foundation/key';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Scrollable } from '@nelyx/core/framework/widgets/scrollable';
import { SliverVariedExtentList, SliverGrid } from '@nelyx/core/framework/widgets/sliver';
import { SliverChildBuilderDelegate } from '@nelyx/core/framework/widgets/scroll-delegate';
import { SliverGridDelegateWithFixedCrossAxisCount } from '@nelyx/core/framework/rendering/sliver-grid';
import { ScrollBehavior } from '@nelyx/core/framework/widgets/scroll-configuration';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import { ScrollMetricsNotification } from '@nelyx/core/framework/widgets/scroll-position';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';

export class SliverLab extends StatefulWidget {
  constructor(readonly onBack: () => void) {
    super();
  }
  createState(): State {
    return new SliverLabState();
  }
}
class SliverLabState extends State<SliverLab> {
  private readonly controller = new ScrollController();
  private readonly target = new GlobalKey('mixed list heading');
  private readonly behavior = new ScrollBehavior();
  private readonly ids = Array.from({ length: 6000 }, (_, index) => index);
  private nextId = 6000;
  private large = false;
  private readonly changed = () => {
    if (this.mounted) this.setState(() => {});
  };
  override initState(): void {
    this.controller.addListener(this.changed);
  }
  override dispose(): void {
    this.controller.removeListener(this.changed);
    this.controller.dispose();
  }
  private mutate(): void {
    this.setState(() => {
      const moved = this.ids.shift()!;
      this.ids.splice(10, 0, moved);
      this.ids.unshift(this.nextId++);
      this.ids.pop();
      this.large = !this.large;
    });
  }
  build(context: BuildContext): Widget {
    const theme = AppTheme.of(context),
      offset = this.controller.hasClients ? Math.round(this.controller.offset) : 0;
    const rows = new SliverChildBuilderDelegate(
      (_context, index) => new MixedRow(this.ids[index]!, this.large),
      {
        childCount: this.ids.length,
        findChildIndexCallback: (key) => {
          if (!(key instanceof ValueKey)) return null;
          const index = this.ids.indexOf(key.value as number);
          return index < 0 ? null : index;
        },
      },
    );
    return new Scaffold(
      'Mixed list + grid',
      new Column(
        [
          new Wrap(
            [
              new FilledButton('mixed-back', 'Back', this.widget.onBack),
              new FilledButton('mixed-fling', 'Animate', () => {
                if (this.controller.hasClients)
                  void this.controller.animateTo(
                    Math.min(
                      this.controller.offset + 1200,
                      this.controller.position.maxScrollExtent,
                    ),
                    { duration: 600, curve: Curves.easeOut },
                  );
              }),
              new FilledButton('mixed-grid', 'Grid', () => {
                if (this.controller.hasClients)
                  this.controller.jumpTo(this.controller.position.maxScrollExtent);
              }),
              new FilledButton('mixed-mutate', 'Mutate', () => this.mutate()),
              new FilledButton('mixed-reveal', 'Reveal heading', () => {
                const target = this.target.currentContext;
                if (target) void Scrollable.ensureVisible(target, { alignment: 0 });
              }),
            ],
            { spacing: 8, runSpacing: 8 },
          ),
          new Text(`6,000 variable rows + 4,000 tiles · offset ${offset}`, {
            color: theme.foreground,
            fontSize: 14,
          }),
          new Expanded(
            new NotificationListener({
              notificationType: ScrollMetricsNotification,
              onNotification: (notification) => {
                if (notification.depth === 0) this.changed();
                return false;
              },
              child: new CustomScrollView({
                controller: this.controller,
                scrollBehavior: this.behavior,
                cacheExtent: 0,
                semanticChildCount: 10000,
                slivers: [
                  new SliverToBoxAdapter({
                    child: new SizedBox(
                      undefined,
                      60,
                      new Text('Tap a row, mutate, then reveal this heading.', {
                        color: theme.foreground,
                      }),
                      this.target,
                    ),
                  }),
                  new SliverVariedExtentList({
                    delegate: rows,
                    itemExtentBuilder: (index) =>
                      32 + (this.ids[index]! % 4) * 11 + (this.large ? 16 : 0),
                  }),
                  new SliverGrid({
                    gridDelegate: new SliverGridDelegateWithFixedCrossAxisCount({
                      crossAxisCount: 2,
                      mainAxisExtent: 84,
                      mainAxisSpacing: 4,
                      crossAxisSpacing: 4,
                    }),
                    delegate: new SliverChildBuilderDelegate(
                      (_context, index) =>
                        new DecoratedBox(
                          new Text(`Tile ${index}`, { color: theme.foreground }),
                          index % 2 ? theme.surface : theme.background,
                          4,
                        ),
                      { childCount: 4000, semanticIndexOffset: 6000 },
                    ),
                  }),
                ],
              }),
            }),
          ),
        ],
        { spacing: 8, crossAlign: 'stretch', mainSize: 'max' },
      ),
    );
  }
}
class MixedRow extends StatefulWidget {
  constructor(
    readonly id: number,
    readonly large: boolean,
  ) {
    super(new ValueKey(id));
  }
  createState(): State {
    return new MixedRowState();
  }
}
class MixedRowState extends State<MixedRow> {
  private taps = 0;
  build(context: BuildContext): Widget {
    const theme = AppTheme.of(context),
      id = this.widget.id;
    return new GestureDetector(
      new SizedBox(
        undefined,
        32 + (id % 4) * 11 + (this.widget.large ? 16 : 0),
        new DecoratedBox(
          new Text(`Row ${id} · taps ${this.taps}`, { color: theme.foreground }),
          id % 2 ? theme.surface : theme.background,
          4,
        ),
      ),
      {
        onTap: () =>
          this.setState(() => {
            this.taps++;
          }),
        semanticsId: 'mixed-row-' + id,
        label: `Row ${id}, taps ${this.taps}`,
      },
    );
  }
}
