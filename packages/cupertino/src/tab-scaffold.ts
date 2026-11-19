// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/tab_scaffold.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueKey } from '@nelyx/core/foundation/key';
import { ChangeNotifier } from '@nelyx/core/foundation/notifier';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Builder,
  ColoredBox,
  Padding,
  Positioned,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { FocusScopeNode } from '@nelyx/core/framework/widgets/focus';
import { FocusScope } from '@nelyx/core/framework/widgets/focus-scope';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { HeroMode } from '@nelyx/core/framework/widgets/heroes';
import { Offstage } from '@nelyx/core/framework/widgets/offstage';
import { RestorableProperty, RestorationOwner } from '@nelyx/core/framework/widgets/restoration';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TickerMode } from '@nelyx/core/framework/widgets/ticker-mode';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import type { CupertinoTabBar } from './bottom-tab-bar.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoTheme } from './theme.ts';

function checkIndex(index: unknown): asserts index is number {
  invariant(
    typeof index === 'number' && Number.isSafeInteger(index) && index >= 0,
    'invalid-cupertino-tab-index',
    'Expected a nonnegative integer Cupertino tab index',
  );
}

export class CupertinoTabController extends ChangeNotifier {
  private current: number;

  constructor({ initialIndex = 0 }: { readonly initialIndex?: number } = {}) {
    super();
    checkIndex(initialIndex);
    this.current = initialIndex;
  }

  get index(): number {
    return this.current;
  }
  set index(value: number) {
    this.ensureAlive();
    checkIndex(value);
    if (value === this.current) return;
    this.current = value;
    this.notifyListeners();
  }
}

export class RestorableCupertinoTabController extends RestorableProperty<CupertinoTabController> {
  private readonly initialIndex: number;
  private current: CupertinoTabController;
  private readonly changed = () => this.notifyListeners();

  constructor({ initialIndex = 0 }: { readonly initialIndex?: number } = {}) {
    super();
    checkIndex(initialIndex);
    this.initialIndex = initialIndex;
    this.current = this.createDefaultValue();
    this.current.addListener(this.changed);
  }

  createDefaultValue(): CupertinoTabController {
    return new CupertinoTabController({ initialIndex: this.initialIndex });
  }
  fromPrimitives(data: unknown): CupertinoTabController {
    checkIndex(data);
    return new CupertinoTabController({ initialIndex: data });
  }
  toPrimitives(): number {
    return this.current.index;
  }
  get value(): CupertinoTabController {
    return this.current;
  }
  set value(value: CupertinoTabController) {
    this.ensureAlive();
    if (this.current === value) return;
    value.addListener(this.changed);
    const previous = this.current;
    this.current = value;
    previous.removeListener(this.changed);
    previous.dispose();
    this.notifyListeners();
  }
  restore(data: unknown): void {
    this.value = this.fromPrimitives(data);
  }
  reset(): void {
    this.value = this.createDefaultValue();
  }
  override dispose(): void {
    this.current.dispose();
    super.dispose();
  }
}

export interface CupertinoTabScaffoldOptions extends WidgetOptions {
  readonly tabBar: CupertinoTabBar;
  readonly tabBuilder: (context: BuildContext, index: number) => Widget;
  readonly controller?: CupertinoTabController | null;
  readonly backgroundColor?: CupertinoColor | null;
  readonly resizeToAvoidBottomInset?: boolean;
  readonly restorationId?: string | null;
}

export class CupertinoTabScaffold extends StatefulWidget {
  readonly tabBar: CupertinoTabBar;
  readonly tabBuilder: (context: BuildContext, index: number) => Widget;
  readonly controller: CupertinoTabController | null;
  readonly backgroundColor: CupertinoColor | null;
  readonly resizeToAvoidBottomInset: boolean;
  readonly restorationId: string | null;

  constructor({
    tabBar,
    tabBuilder,
    controller = null,
    backgroundColor = null,
    resizeToAvoidBottomInset = true,
    restorationId = null,
    key = null,
  }: CupertinoTabScaffoldOptions) {
    super(key);
    invariant(
      controller === null || controller.index < tabBar.items.length,
      'invalid-cupertino-tab-index',
      'Controller index must be in the tab bar range',
    );
    this.tabBar = tabBar;
    this.tabBuilder = tabBuilder;
    this.controller = controller;
    this.backgroundColor = backgroundColor;
    this.resizeToAvoidBottomInset = resizeToAvoidBottomInset;
    this.restorationId = restorationId;
  }
  override createState(): State<CupertinoTabScaffold> {
    return new CupertinoTabScaffoldState();
  }
}

class CupertinoTabScaffoldState extends State<CupertinoTabScaffold> {
  private controller!: CupertinoTabController;
  private ownedController: CupertinoTabController | null = null;
  private readonly visited = new Map<number, FocusScopeNode>();
  private readonly removed = new Set<FocusScopeNode>();
  private focusIndex: number | null = null;
  private parentScope: FocusScopeNode | null = null;
  private readonly persistence = new RestorationOwner(this, (bucket, _initial, needsRestore) => {
    if (bucket && this.ownedController) {
      if (needsRestore && bucket.contains('controller')) {
        const saved = bucket.read('controller');
        checkIndex(saved);
        this.ownedController.index = Math.min(saved, this.widget.tabBar.items.length - 1);
      }
      bucket.write('controller', this.ownedController.index);
    }
  });

  override initState(): void {
    super.initState();
    this.updateController();
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.updateRestoration();
  }
  override didUpdateWidget(old: CupertinoTabScaffold): void {
    super.didUpdateWidget(old);
    if (old.controller !== this.widget.controller) this.updateController();
    const count = this.widget.tabBar.items.length;
    if (this.controller.index >= count) this.controller.index = count - 1;
    for (const [index, node] of this.visited) {
      if (index >= count) {
        this.visited.delete(index);
        this.removed.add(node);
        (this.context as Element).owner.postFrame(() => {
          if (this.removed.delete(node)) node.dispose();
        });
      }
    }
    this.updateRestoration();
  }

  private updateController(): void {
    this.controller?.removeListener(this.selectionChanged);
    this.ownedController?.dispose();
    const external = this.widget.controller;
    this.ownedController =
      external === null
        ? new CupertinoTabController({ initialIndex: this.widget.tabBar.currentIndex })
        : null;
    this.controller = external ?? this.ownedController!;
    this.controller.addListener(this.selectionChanged);
  }
  private updateRestoration(): void {
    this.persistence.update(this.context, this.ownedController ? this.widget.restorationId : null);
  }
  private readonly selectionChanged = (): void => {
    const index = this.controller.index;
    invariant(
      index < this.widget.tabBar.items.length,
      'invalid-cupertino-tab-index',
      'Controller index must be in the tab bar range',
    );
    if (this.ownedController) this.persistence.bucket?.write('controller', index);
    this.setState(() => {});
  };

  private tabContents(context: BuildContext, index: number): Widget {
    let activeScope = this.visited.get(index);
    if (!activeScope) {
      activeScope = new FocusScopeNode({ debugLabel: `Cupertino tab ${index}` });
      this.visited.set(index, activeScope);
    }
    const parentScope = FocusScope.of(context);
    if (this.focusIndex !== index || this.parentScope !== parentScope) {
      this.focusIndex = index;
      this.parentScope = parentScope;
      const scope = activeScope;
      (context as Element).owner.postFrame(() => {
        if (
          this.mounted &&
          this.controller.index === index &&
          this.parentScope === parentScope &&
          scope.attached
        )
          parentScope.setFirstFocus(scope);
      });
    }
    return new Stack(
      [...this.visited].map(([tab, node]) => {
        const active = tab === index;
        return Positioned.fill(
          new HeroMode({
            enabled: active,
            child: new Offstage(
              new TickerMode(
                active,
                new FocusScope(
                  new Semantics({
                    role: SemanticsRole.tabPanel,
                    container: true,
                    explicitChildNodes: true,
                    child: new Builder((context) => this.widget.tabBuilder(context, tab)),
                  }),
                  {
                    node,
                    includeSemantics: false,
                    canRequestFocus: active,
                    descendantsAreFocusable: active,
                    descendantsAreTraversable: active,
                  },
                ),
              ),
              { offstage: !active },
            ),
          }),
          { key: new ValueKey(tab) },
        );
      }),
    );
  }

  override build(context: BuildContext): Widget {
    const { tabBar, backgroundColor, resizeToAvoidBottomInset } = this.widget;
    const active = this.controller.index;
    const media = MediaQuery.of(context);
    const insets = MediaQuery.viewInsetsOf(context);
    let padding = MediaQuery.paddingOf(context);
    let viewPadding = MediaQuery.viewPaddingOf(context);
    let contentInset = resizeToAvoidBottomInset ? insets.bottom : 0;
    if (resizeToAvoidBottomInset)
      viewPadding = viewPadding.copyWith({
        bottom: Math.max(0, viewPadding.bottom - insets.bottom),
      });
    if (!resizeToAvoidBottomInset || tabBar.height > insets.bottom) {
      const overlap = tabBar.height + padding.bottom;
      if (tabBar.opaque(context)) {
        contentInset = overlap;
        viewPadding = viewPadding.copyWith({
          bottom: Math.max(0, viewPadding.bottom - padding.bottom),
        });
        padding = padding.copyWith({ bottom: 0 });
      } else padding = padding.copyWith({ bottom: overlap });
    }
    const content = new MediaQuery(
      {
        ...media,
        safeArea: viewPadding,
        padding,
        viewPadding,
        keyboardInset: resizeToAvoidBottomInset ? 0 : media.keyboardInset,
        viewInsets: resizeToAvoidBottomInset ? insets.copyWith({ bottom: 0 }) : insets,
      },
      new Padding(EdgeInsets.only({ bottom: contentInset }), this.tabContents(context, active)),
    );
    const tabs = MediaQuery.withNoTextScaling({
      child: tabBar.copyWith({
        currentIndex: active,
        onTap: (index) => {
          this.controller.index = index;
          tabBar.onTap?.(index);
        },
      }),
    });
    return new ColoredBox({
      color:
        backgroundColor === null
          ? CupertinoTheme.of(context).scaffoldBackgroundColor
          : resolveCupertinoColor(backgroundColor, context).toARGB32(),
      child: new Stack([
        Positioned.fill(content),
        new Positioned(tabs, { left: 0, right: 0, bottom: 0 }),
      ]),
    });
  }

  override dispose(): void {
    this.controller.removeListener(this.selectionChanged);
    this.ownedController?.dispose();
    this.persistence.dispose();
    for (const node of this.visited.values()) node.dispose();
    for (const node of this.removed) node.dispose();
    this.visited.clear();
    this.removed.clear();
    super.dispose();
  }
}
