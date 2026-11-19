// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/reorderable_list.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { Key, KeyMap } from '@nelyx/core/foundation/key';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { Axis } from '@nelyx/core/framework/painting/basic-types';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { ItemExtentBuilder } from '@nelyx/core/framework/rendering/sliver';
import { ScrollCacheExtent } from '@nelyx/core/framework/rendering/viewport';
import { CustomSemanticsAction } from '@nelyx/core/framework/semantics/semantics';
import { canonicalLocaleTag } from '@nelyx/core/framework/widgets/app';
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  KeyedSubtree,
  PositionedDirectional,
  SliverPadding,
  SliverToBoxAdapter,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import {
  ReorderableListView as CoreReorderableListView,
  ReorderableDelayedDragStartListener,
  ReorderableDragStartListener,
} from '@nelyx/core/framework/widgets/reorderable-list';
import type {
  ReorderDragBoundaryProvider,
  ReorderItemProxyDecorator,
} from '@nelyx/core/framework/widgets/reorderable-list';
import type { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import type { IndexedWidgetBuilder } from '@nelyx/core/framework/widgets/scroll-delegate';
import { CustomScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import type { ScrollViewOptions } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  WidgetState,
  WidgetStateProperty,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import {
  captureSourceMouseCursor,
  sourceMouseCursorType,
} from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Icons } from './icons.ts';
import { reorderActionLabels } from './internal/reorder-action-labels.ts';
import { Material } from './material.ts';
import { Theme } from './theme.ts';

export {
  ReorderableDelayedDragStartListener,
  ReorderableDragStartListener,
} from '@nelyx/core/framework/widgets/reorderable-list';
export type {
  ReorderDragBoundaryProvider,
  ReorderItemProxyDecorator,
  ReorderableDragStartListenerOptions,
} from '@nelyx/core/framework/widgets/reorderable-list';

export type ReorderCallback = (oldIndex: number, newIndex: number) => void;
type ReorderCallbacks =
  | {
      /** @deprecated Use onReorderItem for a post-removal destination index. */ readonly onReorder: ReorderCallback;
      readonly onReorderItem?: null;
    }
  | { readonly onReorder?: null; readonly onReorderItem: ReorderCallback };

interface ReorderableListCommonOptions
  extends
    WidgetOptions,
    Pick<
      ScrollViewOptions,
      | 'scrollDirection'
      | 'reverse'
      | 'primary'
      | 'physics'
      | 'shrinkWrap'
      | 'anchor'
      | 'cacheExtent'
      | 'scrollCacheExtent'
      | 'dragStartBehavior'
      | 'keyboardDismissBehavior'
      | 'restorationId'
      | 'clipBehavior'
    > {
  readonly onReorderStart?: ((index: number) => void) | null;
  readonly onReorderEnd?: ((index: number) => void) | null;
  readonly itemExtent?: number | null;
  readonly itemExtentBuilder?: ItemExtentBuilder | null;
  readonly prototypeItem?: Widget | null;
  readonly proxyDecorator?: ReorderItemProxyDecorator | null;
  readonly buildDefaultDragHandles?: boolean;
  readonly padding?: EdgeInsets | null;
  readonly header?: Widget | null;
  readonly footer?: Widget | null;
  readonly scrollController?: ScrollController | null;
  readonly autoScrollerVelocityScalar?: number | null;
  readonly dragBoundaryProvider?: ReorderDragBoundaryProvider | null;
  readonly mouseCursor?: MouseCursor | WidgetStateProperty<MouseCursor> | null;
}

export type ReorderableListViewOptions = ReorderableListCommonOptions &
  ReorderCallbacks & { readonly children: readonly Widget[] };
export type ReorderableListViewBuilderOptions = ReorderableListCommonOptions &
  ReorderCallbacks & {
    readonly itemBuilder: IndexedWidgetBuilder;
    readonly itemCount: number;
  };

export class ReorderableListView extends StatefulWidget {
  readonly itemBuilder: IndexedWidgetBuilder;
  readonly itemCount: number;
  readonly options: Readonly<ReorderableListViewOptions | ReorderableListViewBuilderOptions>;

  constructor(options: ReorderableListViewOptions | ReorderableListViewBuilderOptions) {
    super(options.key ?? null);
    invariant(
      [options.itemExtent, options.itemExtentBuilder, options.prototypeItem].filter(
        (value) => value != null,
      ).length <= 1,
      'conflicting-reorderable-extents',
      'Choose one reorderable item extent',
    );
    invariant(
      (options.onReorder == null) !== (options.onReorderItem == null),
      'invalid-reorder-callback',
      'Specify exactly one reorder callback',
    );
    this.options = Object.freeze({ ...options });
    if ('children' in options) {
      const children = [...options.children];
      const keys = new KeyMap<boolean>();
      for (const child of children) {
        invariant(
          child.key instanceof Key && !keys.has(child.key),
          'invalid-reorderable-key',
          'Every reorderable child needs a distinct stable key',
        );
        keys.set(child.key, true);
      }
      this.itemBuilder = (_context, index) => children[index]!;
      this.itemCount = children.length;
    } else {
      invariant(
        Number.isSafeInteger(options.itemCount) && options.itemCount >= 0,
        'invalid-reorderable-count',
        'Expected a nonnegative item count',
      );
      this.itemBuilder = options.itemBuilder;
      this.itemCount = options.itemCount;
    }
  }

  static builder(options: ReorderableListViewBuilderOptions): ReorderableListView {
    return new ReorderableListView(options);
  }

  get onReorder(): ReorderCallback | null {
    return this.options.onReorder ?? null;
  }
  get onReorderItem(): ReorderCallback | null {
    return this.options.onReorderItem ?? null;
  }
  get onReorderStart() {
    return this.options.onReorderStart ?? null;
  }
  get onReorderEnd() {
    return this.options.onReorderEnd ?? null;
  }
  get itemExtent() {
    return this.options.itemExtent ?? null;
  }
  get itemExtentBuilder() {
    return this.options.itemExtentBuilder ?? null;
  }
  get prototypeItem() {
    return this.options.prototypeItem ?? null;
  }
  get proxyDecorator() {
    return this.options.proxyDecorator ?? null;
  }
  get buildDefaultDragHandles() {
    return this.options.buildDefaultDragHandles ?? true;
  }
  get padding() {
    return this.options.padding ?? null;
  }
  get header() {
    return this.options.header ?? null;
  }
  get footer() {
    return this.options.footer ?? null;
  }
  get scrollDirection() {
    return this.options.scrollDirection ?? Axis.vertical;
  }
  get reverse() {
    return this.options.reverse ?? false;
  }
  get scrollController() {
    return this.options.scrollController ?? null;
  }
  get primary() {
    return this.options.primary ?? null;
  }
  get physics() {
    return this.options.physics ?? null;
  }
  get shrinkWrap() {
    return this.options.shrinkWrap ?? false;
  }
  get anchor() {
    return this.options.anchor ?? 0;
  }
  get cacheExtent() {
    return this.options.cacheExtent ?? null;
  }
  get scrollCacheExtent() {
    return this.options.scrollCacheExtent ?? null;
  }
  get dragStartBehavior() {
    return this.options.dragStartBehavior ?? DragStartBehavior.start;
  }
  get keyboardDismissBehavior() {
    return this.options.keyboardDismissBehavior ?? null;
  }
  get restorationId() {
    return this.options.restorationId ?? null;
  }
  get clipBehavior() {
    return this.options.clipBehavior ?? 'hardEdge';
  }
  get autoScrollerVelocityScalar() {
    return this.options.autoScrollerVelocityScalar ?? null;
  }
  get dragBoundaryProvider() {
    return this.options.dragBoundaryProvider ?? null;
  }
  get mouseCursor() {
    return this.options.mouseCursor ?? null;
  }

  createState(): State<ReorderableListView> {
    return new ReorderableListViewState();
  }
}

const defaultProxy: ReorderItemProxyDecorator = (child, _index, animation) =>
  new ListenableBuilder({
    listenable: animation,
    child,
    builder: (_context, child) =>
      new Material({
        child,
        animationDuration: 0,
        elevation: Curves.easeInOut.transform(animation.value) * 6,
      }),
  });

class ReorderableListViewState extends State<ReorderableListView> {
  private readonly dragging = new ValueNotifier(false);

  private commit(oldIndex: number, slot: number): void {
    const view = this.widget;
    if (view.onReorder !== null) {
      if (oldIndex !== slot) view.onReorder(oldIndex, slot);
      return;
    }
    const index = slot > oldIndex ? slot - 1 : slot;
    if (oldIndex !== index) view.onReorderItem?.(oldIndex, index);
  }

  private actions(context: BuildContext, index: number): Map<CustomSemanticsAction, () => void> {
    const locale = canonicalLocaleTag(context.maybeDependOn(Localizations)?.locale ?? 'en');
    const tags = locale.split('-');
    const candidates = tags.map((_, index) => tags.slice(0, index + 1).join('-'));
    const label = (key: number) =>
      candidates.reduce(
        (text, locale) => reorderActionLabels[locale]?.[key] ?? text,
        reorderActionLabels.en![key]!,
      );
    const actions = new Map<CustomSemanticsAction, () => void>();
    const horizontal = this.widget.scrollDirection === Axis.horizontal;
    const rtl = horizontal && Directionality.maybeOf(context) === 'rtl';
    const add = (key: number, slot: number) => {
      actions.set(new CustomSemanticsAction({ label: label(key) }), () => {
        if (this.mounted && !this.dragging.value && index < this.widget.itemCount)
          this.commit(index, slot);
      });
    };
    if (index > 0) {
      add(0, 0);
      add(horizontal ? (rtl ? 5 : 4) : 2, index - 1);
    }
    if (index < this.widget.itemCount - 1) {
      add(horizontal ? (rtl ? 4 : 5) : 3, index + 2);
      add(1, this.widget.itemCount);
    }
    return actions;
  }

  private cursor(): MouseCursor {
    const cursor = this.widget.mouseCursor;
    if (cursor === null)
      return this.dragging.value ? SystemMouseCursors.grabbing : SystemMouseCursors.grab;
    const states = emptyWidgetStateSet();
    if (this.dragging.value) states.add(WidgetState.dragged);
    return cursor instanceof MouseCursor
      ? WidgetStateProperty.resolveAs(
          sourceMouseCursorType,
          captureSourceMouseCursor(cursor),
          states,
        )
      : cursor.resolve(states);
  }

  private buildItem(context: BuildContext, index: number): Widget {
    const view = this.widget;
    const item = view.itemBuilder(context, index);
    invariant(
      item.key instanceof Key,
      'missing-reorderable-item-key',
      'Every reorderable item needs a stable key',
    );
    let content = item;
    if (view.buildDefaultDragHandles) {
      const platform = Theme.of(context).platform;
      if (platform === 'linux' || platform === 'windows' || platform === 'macOS') {
        const handle = new ReorderableDragStartListener({
          index,
          child: new ListenableBuilder({
            listenable: this.dragging,
            child: new Icon(Icons.drag_handle),
            builder: (_context, child) => new MouseRegion(child, { cursor: this.cursor() }),
          }),
        });
        const horizontal = view.scrollDirection === Axis.horizontal;
        content = new Stack([
          item,
          new PositionedDirectional(
            new Align(handle, {
              alignment: horizontal
                ? AlignmentDirectional.bottomCenter
                : AlignmentDirectional.centerEnd,
            }),
            horizontal ? { start: 0, end: 0, bottom: 8 } : { top: 0, bottom: 0, end: 8 },
          ),
        ]);
      } else {
        content = new ReorderableDelayedDragStartListener({ index, child: item });
      }
    }
    return new KeyedSubtree({
      key: item.key,
      child: new Semantics({
        container: true,
        customSemanticsActions: this.actions(context, index),
        child: content,
      }),
    });
  }

  private scrollView(list: Widget): Widget {
    const view = this.widget;
    const padding = view.padding ?? EdgeInsets.zero;
    let listPadding = padding;
    let startPadding = EdgeInsets.zero;
    let endPadding = EdgeInsets.zero;
    if (view.header !== null || view.footer !== null) {
      const start = (view.reverse ? view.footer : view.header) === null ? undefined : 0;
      const end = (view.reverse ? view.header : view.footer) === null ? undefined : 0;
      if (view.scrollDirection === Axis.horizontal) {
        listPadding = padding.copyWith({
          left: start ?? padding.left,
          right: end ?? padding.right,
        });
        startPadding = padding.copyWith({ left: 0 });
        endPadding = padding.copyWith({ right: 0 });
      } else {
        listPadding = padding.copyWith({
          top: start ?? padding.top,
          bottom: end ?? padding.bottom,
        });
        startPadding = padding.copyWith({ top: 0 });
        endPadding = padding.copyWith({ bottom: 0 });
      }
    }
    const slivers: Widget[] = [];
    if (view.header !== null)
      slivers.push(
        new SliverPadding({
          padding: view.reverse ? startPadding : endPadding,
          sliver: new SliverToBoxAdapter({ child: view.header }),
        }),
      );
    slivers.push(new SliverPadding({ padding: listPadding, sliver: list }));
    if (view.footer !== null)
      slivers.push(
        new SliverPadding({
          padding: view.reverse ? endPadding : startPadding,
          sliver: new SliverToBoxAdapter({ child: view.footer }),
        }),
      );
    return new CustomScrollView({
      slivers,
      scrollDirection: view.scrollDirection,
      reverse: view.reverse,
      controller: view.scrollController,
      primary: view.primary,
      physics: view.physics,
      shrinkWrap: view.shrinkWrap,
      anchor: view.anchor,
      scrollCacheExtent:
        view.scrollCacheExtent ??
        (view.cacheExtent === null ? null : ScrollCacheExtent.pixels(view.cacheExtent)),
      dragStartBehavior: view.dragStartBehavior,
      keyboardDismissBehavior: view.keyboardDismissBehavior,
      restorationId: view.restorationId,
      clipBehavior: view.clipBehavior,
      semanticChildCount: view.itemCount,
    });
  }

  build(): Widget {
    const view = this.widget;
    return CoreReorderableListView.builder({
      itemCount: view.itemCount,
      itemBuilder: (context, index) => this.buildItem(context, index),
      itemExtent: view.itemExtent,
      itemExtentBuilder: view.itemExtentBuilder,
      prototypeItem: view.prototypeItem,
      scrollDirection: view.scrollDirection,
      reverse: view.reverse,
      controller: view.scrollController,
      physics: view.physics,
      autoScrollVelocityScalar: view.autoScrollerVelocityScalar ?? 50,
      scrollViewBuilder: (list) => this.scrollView(list),
      proxyDecorator: view.proxyDecorator ?? defaultProxy,
      dragBoundaryProvider: view.dragBoundaryProvider,
      onDragStateChanged: (dragging) => {
        if (this.mounted) this.dragging.value = dragging;
      },
      onReorder: (oldIndex, slot) => this.commit(oldIndex, slot),
      onReorderStart: view.onReorderStart,
      onReorderEnd: view.onReorderEnd,
    });
  }

  override dispose(): void {
    this.dragging.dispose();
    super.dispose();
  }
}
