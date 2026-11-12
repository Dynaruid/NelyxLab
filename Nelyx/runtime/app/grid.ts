// SPDX-License-Identifier: BSD-3-Clause
import { GridView, ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Padding } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { SliverConstraints, GrowthDirection } from '@nelyx/core/framework/rendering/sliver';
import { ScrollDirection } from '@nelyx/core/framework/rendering/viewport-offset';
import { Axis, AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import {
  nativeRegularGridLayout,
  nativeViewportGridPolicy,
} from '@nelyx/core/internal/framework/rendering/native-grid';
import {
  nativeLayoutInput as input,
  nativeLayoutExpression as expression,
} from '@nelyx/core/framework/rendering/object';
import type {
  NativeLayoutProgram,
  NativeLayoutCommand,
} from '@nelyx/core/framework/rendering/object';
import type { NativeViewportGridPolicy } from '@nelyx/core/internal/framework/rendering/native-grid';
import { SliverChildListDelegate } from '@nelyx/core/framework/widgets/scroll-delegate';
import { protocol as p } from '../engine-client/schema.ts';
import type { EngineNodeSnapshot, EngineResponse, EngineEvent } from '../engine-client/codec.ts';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { OriginalNativeNode } from './native-node.ts';
import { immutableSceneData } from '../engine-client/scene.ts';

const unsupportedQuery: NativeLayoutProgram['minWidth'] = [
  { kind: 'assert', values: [0] },
  { kind: 'result', values: [0] },
];
function program(children: number, layout: NativeLayoutProgram['layout']): NativeLayoutProgram {
  return {
    children,
    layout,
    minWidth: unsupportedQuery,
    maxWidth: unsupportedQuery,
    minHeight: unsupportedQuery,
    maxHeight: unsupportedQuery,
  };
}
/** Two Content programs share the viewport extent through tight child bounds.
 * No Source constraints, measurement, or provisional LayoutBuilder reply. */
export function viewportGridPrograms(
  policy: NativeViewportGridPolicy,
  count: number,
  rtl: boolean,
) {
  const { columns, rows, maximumRowExtent } = policy;
  const rowCount = Math.ceil(count / columns);
  const extent = expression('min', maximumRowExtent, expression('divide', input.maxHeight, rows));
  const height = expression('multiply', extent, rowCount);
  const viewport = program(1, [
    { kind: 'assert', values: [expression('finite', input.maxWidth)] },
    { kind: 'assert', values: [expression('finite', input.maxHeight)] },
    {
      kind: 'layout',
      child: 0,
      target: 0,
      values: [input.maxWidth, input.maxWidth, height, height],
    },
    { kind: 'position', child: 0, values: [0, 0] },
    { kind: 'size', values: [input.maxWidth, input.maxHeight] },
  ]);
  const width = expression('divide', input.maxWidth, columns);
  const tileHeight = rowCount ? expression('divide', input.maxHeight, rowCount) : 0;
  const layout: NativeLayoutCommand[] = [];
  for (let index = 0; index < count; index++) {
    const column = rtl ? columns - 1 - (index % columns) : index % columns;
    // A completed child's measurements are unused. Reuse six scratch registers
    // instead of spending the variable budget on each cell.
    layout.push(
      { kind: 'layout', child: index, target: 0, values: [width, width, tileHeight, tileHeight] },
      {
        kind: 'position',
        child: index,
        values: [
          expression('multiply', width, column),
          expression('multiply', tileHeight, Math.floor(index / columns)),
        ],
      },
    );
  }
  layout.push({ kind: 'size', values: [input.maxWidth, input.maxHeight] });
  return immutableSceneData({ viewport, tiles: program(count, layout) });
}

// One current numeric policy per original GridView Element, never a page or
// historical-scene cache. Count/theme/direction changes replace that value.
const viewportPrograms = new WeakMap<
  BuildContext,
  {
    key: string;
    programs: ReturnType<typeof viewportGridPrograms>;
  }
>();

type ViewportGridOwner = (
  build: (
    observe: (node: EngineNodeSnapshot, snapshot: EngineResponse) => void,
    terminal: (event: EngineEvent) => void,
  ) => Widget,
) => Widget;

/** Regular source grids reuse the bounded native list owner by rows. LayoutBuilder
 * receives Content constraints; the original delegate derives tile parameters.
 * Child measurement, placement, clipping and scroll motion remain in Core. */
export function originalNativeGrid(
  grid: GridView,
  context: BuildContext,
  fail: (reason: string) => never,
  viewportOwner?: ViewportGridOwner,
): Widget {
  if (
    grid.scrollDirection !== Axis.vertical ||
    grid.reverse ||
    grid.shrinkWrap ||
    grid.center ||
    grid.anchor !== 0 ||
    grid.restorationId ||
    grid.scrollBehavior ||
    grid.cacheExtent !== null ||
    grid.scrollCacheExtent !== null ||
    grid.buildChildLayout !== GridView.prototype.buildChildLayout
  )
    return fail('native-grid-options');
  const count = grid.childrenDelegate.estimatedChildCount;
  if (count === null || !Number.isSafeInteger(count) || count < 0 || count > 1_000_000)
    return fail('native-grid-finite-count');
  const direction = Directionality.of(context);
  const padding =
    grid.padding?.resolve(direction) ?? MediaQuery.maybePaddingOf(context) ?? EdgeInsets.zero;
  // A finite source list and an explicit fitted-grid policy prove that every
  // child is visible. Large/lazy grids keep their bounded row materialization.
  const fitted =
    viewportOwner &&
    count <= p.limits.layoutProgramChildren &&
    Object.getPrototypeOf(grid.childrenDelegate) === SliverChildListDelegate.prototype
      ? nativeViewportGridPolicy(grid.gridDelegate, count)
      : undefined;
  if (fitted) {
    const key = `${fitted.columns}/${fitted.rows}/${fitted.maximumRowExtent}/${count}/${direction}`;
    let current = viewportPrograms.get(context);
    if (current?.key !== key) {
      current = { key, programs: viewportGridPrograms(fitted, count, direction === 'rtl') };
      viewportPrograms.set(context, current);
    }
    const programs = current.programs;
    return new Padding(
      padding,
      viewportOwner!((observe, terminal) => {
        const children: Widget[] = [];
        for (let index = 0; index < count; index++) {
          const child = grid.childrenDelegate.build(context, index);
          if (!child) return fail('native-grid-null-before-count');
          children.push(
            new OriginalNativeNode('box', [child], {
              ...(child.key ? { key: child.key } : {}),
              keepAliveChildren: true,
              sourceCollectionIndex: index,
              layout: { childConstraints: 'inherit' },
            }),
          );
        }
        return new OriginalNativeNode(
          'scrollViewport',
          [new OriginalNativeNode('box', children, { layout: {}, layoutProgram: programs.tiles })],
          {
            pointerHitTest: 'self',
            layout: {},
            layoutProgram: programs.viewport,
            onLayout: observe,
            onScrollTerminal: terminal,
          },
        );
      }),
    );
  }
  return new Padding(
    padding,
    new LayoutBuilder((_rowContext, bounds) => {
      if (!Number.isFinite(bounds.maxWidth) || !Number.isFinite(bounds.maxHeight))
        return fail('native-grid-bounded-viewport');
      const layout = nativeRegularGridLayout(
        grid.gridDelegate,
        new SliverConstraints({
          axisDirection: AxisDirection.down,
          growthDirection: GrowthDirection.forward,
          userScrollDirection: ScrollDirection.idle,
          scrollOffset: 0,
          precedingScrollExtent: 0,
          overlap: 0,
          remainingPaintExtent: bounds.maxHeight,
          crossAxisExtent: bounds.maxWidth,
          crossAxisDirection: direction === 'rtl' ? AxisDirection.left : AxisDirection.right,
          viewportMainAxisExtent: bounds.maxHeight,
          remainingCacheExtent: bounds.maxHeight,
          cacheOrigin: 0,
        }),
      );
      // Row grouping is exact when there is no extra trailing main-axis gap.
      if (!(layout.childMainAxisExtent > 0) || layout.mainAxisStride !== layout.childMainAxisExtent)
        return fail('native-grid-main-spacing');
      const columns = layout.crossAxisCount,
        rows = Math.ceil(count / columns),
        gap = layout.crossAxisStride - layout.childCrossAxisExtent;
      if (gap < 0 || !Number.isFinite(gap)) return fail('native-grid-cross-spacing');
      return ListView.builder({
        controller: grid.controller,
        primary: grid.primary,
        physics: grid.physics,
        padding: EdgeInsets.zero,
        dragStartBehavior: grid.dragStartBehavior,
        clipBehavior: grid.clipBehavior,
        hitTestBehavior: grid.hitTestBehavior,
        itemExtent: layout.mainAxisStride,
        itemCount: rows,
        addAutomaticKeepAlives: false,
        addRepaintBoundaries: false,
        addSemanticIndexes: false,
        itemBuilder: (childContext, row) => {
          const children: Widget[] = [];
          for (let index = row * columns; index < Math.min(count, (row + 1) * columns); index++) {
            const child = grid.childrenDelegate.build(childContext, index);
            if (child === null) return fail('native-grid-null-before-count');
            children.push(
              new OriginalNativeNode('box', [child], {
                ...(child.key ? { key: child.key } : {}),
                keepAliveChildren: true,
                sourceCollectionIndex: index,
                layout: { childConstraints: 'inherit', enforceBounds: true },
                vertical: {
                  kind: 'finite',
                  min: layout.childMainAxisExtent,
                  max: layout.childMainAxisExtent,
                },
              }),
            );
          }
          return new OriginalNativeNode('grid', children, {
            layout: { columns, gap, reverseMain: layout.reverseCrossAxis },
          });
        },
      });
    }),
  );
}
