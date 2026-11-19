// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import { Column, Expanded, Text, Center } from '@nelyx/core/framework/widgets/basic';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SliverFixedExtentList } from '@nelyx/core/framework/widgets/sliver';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import {
  AlwaysScrollableScrollPhysics,
  BouncingScrollPhysics,
} from '@nelyx/core/framework/widgets/scroll-physics';
import { CupertinoSliverRefreshControl } from '@nelyx/cupertino/refresh';
import { CupertinoScrollBehavior } from '@nelyx/cupertino/scroll-behavior';

const physics = new BouncingScrollPhysics({ parent: new AlwaysScrollableScrollPhysics() });
const cupertinoBehavior = new CupertinoScrollBehavior();
const scrollBehavior = cupertinoBehavior.copyWith({
  dragDevices: new Set([...cupertinoBehavior.dragDevices, PointerDeviceKind.mouse]),
  scrollbars: false,
});

export class CupertinoRefreshDemo extends StatefulWidget {
  constructor(readonly record: (message: string) => void) {
    super(null);
  }
  override createState(): State<CupertinoRefreshDemo> {
    return new CupertinoRefreshDemoState();
  }
}

class CupertinoRefreshDemoState extends State<CupertinoRefreshDemo> {
  private refreshCount = 0;
  private running = false;
  private cancelWait: (() => void) | undefined;

  private async refresh(): Promise<void> {
    this.setState(() => {
      this.running = true;
    });
    this.widget.record('Cupertino refresh started');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 650);
      this.cancelWait = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    this.cancelWait = undefined;
    if (!this.mounted) return;
    this.setState(() => {
      this.running = false;
      this.refreshCount++;
    });
    this.widget.record(`Cupertino refresh completed: ${this.refreshCount}`);
  }

  override dispose(): void {
    this.cancelWait?.();
    super.dispose();
  }

  override build(): Widget {
    const message = this.running
      ? 'Cupertino refresh started'
      : this.refreshCount > 0
        ? `Cupertino refresh completed: ${this.refreshCount}`
        : 'Pull down from the top of the list to load another item.';
    return new Column(
      [
        new Text(message, { fontSize: 13 }),
        new Expanded(
          new Semantics({
            container: true,
            explicitChildNodes: true,
            label: 'Refresh items',
            child: new CustomScrollView({
              primary: false,
              scrollBehavior,
              physics,
              slivers: [
                new CupertinoSliverRefreshControl({ onRefresh: () => this.refresh() }),
                SliverFixedExtentList.builder({
                  itemExtent: 36,
                  itemCount: this.refreshCount + 24,
                  itemBuilder: (_context, index) =>
                    new Center(new Text(`Item ${this.refreshCount + 24 - index}`)),
                }),
              ],
            }),
          }),
        ),
      ],
      { spacing: 8, crossAlign: 'stretch' },
    );
  }
}
