// SPDX-License-Identifier: BSD-3-Clause
import { nativeBoxConfiguration } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { FlexParentData, StackParentData } from '@nelyx/core/framework/rendering/boxes';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { SceneNode, SceneNodeOptions } from '../engine-client/scene.ts';
import type { AxisBound } from '../engine-client/codec.ts';
import type { NativeLayoutBuilderConfiguration } from '@nelyx/core/framework/rendering/object';

function axis(min: number, max: number): AxisBound {
  if (min === Infinity && max === Infinity) return { kind: 'expand' };
  return max === Infinity ? { kind: 'unbounded', min } : { kind: 'finite', min, max };
}
export function bounds(value: BoxConstraints): Pick<SceneNodeOptions, 'horizontal' | 'vertical'> {
  return {
    horizontal: axis(value.minWidth, value.maxWidth),
    vertical: axis(value.minHeight, value.maxHeight),
  };
}
export interface BoxConfiguration {
  readonly children?: readonly RenderObject[];
  readonly paint?: NonNullable<ReturnType<typeof nativeBoxConfiguration>>['paint'];
  readonly foreground?: NonNullable<ReturnType<typeof nativeBoxConfiguration>>['foreground'];
  readonly tooltipPosition?: NonNullable<
    ReturnType<typeof nativeBoxConfiguration>
  >['tooltipPosition'];
  readonly builder?: NativeLayoutBuilderConfiguration;
  readonly kind: SceneNode['kind'];
  readonly options: SceneNodeOptions;
}
/** Compile each source module's declarations; no render class selection lives here. */
export function originalBoxConfiguration(
  render: RenderObject,
  unsupported: (reason: string) => never,
): BoxConfiguration | undefined {
  const config = nativeBoxConfiguration(render, unsupported);
  if (!config) return;
  const { padding, alignment } = config.layout;
  // Canonical EdgeInsets/Alignment values are Source value objects. Own the
  // wire scalars here, so a retained configuration does not keep an opaque
  // class instance that forces every ancestor through the encoder again.
  const layout = {
    ...config.layout,
    ...(padding
      ? {
          padding: {
            left: padding.left ?? 0,
            top: padding.top ?? 0,
            right: padding.right ?? 0,
            bottom: padding.bottom ?? 0,
          },
        }
      : {}),
    ...(alignment ? { alignment: { x: alignment.x, y: alignment.y } } : {}),
  };
  return {
    kind: config.kind,
    ...(config.children ? { children: config.children } : {}),
    ...(config.paint ? { paint: config.paint } : {}),
    ...(config.foreground ? { foreground: config.foreground } : {}),
    ...(config.tooltipPosition ? { tooltipPosition: config.tooltipPosition } : {}),
    ...(config.layoutBuilder ? { builder: config.layoutBuilder } : {}),
    options: {
      layout,
      ...(config.layoutProgram ? { layoutProgram: config.layoutProgram } : {}),
      ...(config.childAnchor ? { childAnchor: config.childAnchor } : {}),
      ...(config.intrinsicSizing ? { intrinsicSizing: config.intrinsicSizing } : {}),
      pointerHitTest: config.hitTest ?? 'proxy',
      ...(config.onPointerSample ? { onPointerSample: config.onPointerSample } : {}),
      ...(config.pointerBlock ? { pointerBlock: config.pointerBlock } : {}),
      ...(config.snapshot ? { snapshot: config.snapshot } : {}),
      ...(config.layoutBuilder
        ? {
            layoutBuilder: {
              revision: config.layoutBuilder.revision,
              ...(config.layoutBuilder.built
                ? {
                    built: {
                      revision: config.layoutBuilder.built.revision,
                      horizontal: axis(
                        config.layoutBuilder.built.constraints.minWidth,
                        config.layoutBuilder.built.constraints.maxWidth,
                      ),
                      vertical: axis(
                        config.layoutBuilder.built.constraints.minHeight,
                        config.layoutBuilder.built.constraints.maxHeight,
                      ),
                    },
                  }
                : {}),
            },
          }
        : {}),
      ...(config.semanticsPolicy ? { semanticsPolicy: config.semanticsPolicy } : {}),
      ...(config.constraints ? bounds(config.constraints) : {}),
      ...(config.color === undefined ? {} : { color: config.color }),
      ...(config.opacity === undefined ? {} : { properties: { opacity: config.opacity } }),
      ...(config.semantics ? { semantics: config.semantics } : {}),
      ...(config.clipStyle ? { clipStyle: config.clipStyle } : {}),
      ...(config.graphics ? { graphics: config.graphics } : {}),
    },
  };
}
export function parentLayout(render: RenderObject, options: SceneNodeOptions): SceneNodeOptions {
  const data = render.parentData;
  if (data instanceof StackParentData && data.isPositioned)
    return {
      ...options,
      layout: {
        ...options.layout,
        positioned: {
          ...(data.left === undefined ? {} : { left: data.left }),
          ...(data.top === undefined ? {} : { top: data.top }),
          ...(data.right === undefined ? {} : { right: data.right }),
          ...(data.bottom === undefined ? {} : { bottom: data.bottom }),
          ...(data.width === undefined ? {} : { width: data.width }),
          ...(data.height === undefined ? {} : { height: data.height }),
        },
      },
    };
  return data instanceof FlexParentData
    ? { ...options, layout: { ...options.layout, flex: data.flex, fit: data.fit } }
    : options;
}
