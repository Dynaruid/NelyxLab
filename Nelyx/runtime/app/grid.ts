// SPDX-License-Identifier: BSD-3-Clause
import { GridView, ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Padding } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { SliverConstraints, GrowthDirection } from '@nelyx/core/framework/rendering/sliver';
import { ScrollDirection } from '@nelyx/core/framework/rendering/viewport-offset';
import { Axis, AxisDirection } from '@nelyx/core/framework/painting/basic-types';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { nativeRegularGridLayout } from '@nelyx/core/internal/framework/rendering/native-grid';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { OriginalNativeNode } from './native-node.ts';

/** Regular source grids reuse the bounded native list owner by rows. LayoutBuilder
 * receives Content constraints; the original delegate derives tile parameters.
 * Child measurement, placement, clipping and scroll motion remain in Core. */
export function originalNativeGrid(
  grid: GridView,
  context: BuildContext,
  fail: (reason: string) => never,
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
