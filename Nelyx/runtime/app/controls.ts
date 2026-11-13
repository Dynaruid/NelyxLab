// SPDX-License-Identifier: BSD-3-Clause
import { nativeRenderMetadata, nativeShape } from '@nelyx/core/framework/rendering/object';
import type { RenderObject, NativePaintEntry } from '@nelyx/core/framework/rendering/object';
import { RenderPhysicalShape, RenderPhysicalModel } from '@nelyx/core/framework/rendering/clip';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { RenderCustomPaint } from '@nelyx/core/framework/rendering/custom-paint';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import { RenderDecoratedBox } from '@nelyx/core/framework/rendering/boxes';
import { nativeMouseRegionConfiguration } from '@nelyx/core/framework/rendering/mouse-region';
import {
  PlaceholderSpanIndexSemanticsTag,
  TextParentData,
  RenderParagraph,
} from '@nelyx/core/framework/rendering/paragraph';
import { nativeRadioDeselect } from '@nelyx/core/internal/framework/widgets/native-radio-semantics';
import { nativeSemanticsRange } from '@nelyx/core/framework/rendering/object';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Border, BorderDirectional } from '@nelyx/core/framework/painting/box-border';
import { Offset } from '@nelyx/core/ui/offset';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { SemanticsAction } from '@nelyx/core/ui/semantics-action';
import { RenderSemanticsAnnotations } from '@nelyx/core/framework/rendering/semantics-annotations';
import {
  PointerEnterEvent,
  PointerExitEvent,
  PointerHoverEvent,
} from '@nelyx/core/framework/gestures/events';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import type { SceneNodeOptions } from '../engine-client/scene.ts';
import { protocol as p } from '../engine-client/schema.ts';

export interface OriginalControlConfiguration {
  /** Exact module output has already copied scalar metadata and action data. */
  readonly directData?: boolean;
  readonly options: SceneNodeOptions;
  /** Simple immutable semantics invalidate through the canonical render setters. */
  readonly cacheableSemantics?: boolean;
  /** Paint depends on descendant visibility, independently of this node's dirtiness. */
  readonly dynamicPaint?: boolean;
  readonly dependencies?: readonly RenderObject[];
  readonly kind?: 'stack';
  readonly children?: readonly RenderObject[];
  readonly paint?: readonly NativePaintEntry[];
  readonly foreground?: readonly NativePaintEntry[];
}
export interface SemanticsProjectionDiagnostics {
  metadataCalls: number;
  metadataMs: number;
}
function invoke(callback: (() => void) | null | undefined): void {
  try {
    callback?.();
  } catch (exception) {
    FlutterError.reportError(new FlutterErrorDetails({ exception, library: 'native controls' }));
  }
}
/** These canonical render objects describe configuration; no App paint/hit/layout hook runs. */
export function originalControlConfiguration(
  render: RenderObject,
  fail: (reason: string) => never,
  diagnostics?: SemanticsProjectionDiagnostics,
): OriginalControlConfiguration | undefined {
  const prototype = Object.getPrototypeOf(render);
  if (prototype === RenderPhysicalShape.prototype || prototype === RenderPhysicalModel.prototype) {
    const source = render as RenderPhysicalShape;
    let shape;
    try {
      if (prototype === RenderPhysicalShape.prototype) {
        if (Object.getPrototypeOf(source.clipper) !== ShapeBorderClipper.prototype)
          return fail('physical-custom-clipper');
        const clipper = source.clipper as ShapeBorderClipper;
        shape = nativeShape(clipper.shape, clipper.textDirection);
      } else {
        const model = render as RenderPhysicalModel;
        if (model.clipper) return fail('physical-custom-clipper');
        shape = nativeShape(
          model.shape === 'circle'
            ? new CircleBorder()
            : new RoundedRectangleBorder(
                model.borderRadius ? { borderRadius: model.borderRadius } : {},
              ),
          null,
        );
      }
    } catch {
      return fail('physical-shape');
    }
    return {
      options: {},
      paint: [
        {
          kind: 'physical',
          color: source.color,
          shape,
          elevation: source.elevation,
          shadowColor: source.shadowColor,
          clip: source.clipBehavior,
        },
      ],
    };
  }
  if (prototype === RenderCustomPaint.prototype) {
    const source = render as RenderCustomPaint;
    const read = (painter: object | null): readonly NativePaintEntry[] => {
      if (!painter) return [];
      if (
        ['paint', 'hitTest', 'semanticsBuilder', 'shouldRepaint', 'shouldRebuildSemantics'].some(
          (name) => Object.hasOwn(painter, name),
        )
      )
        return fail('instance-painter-hook');
      let metadata;
      try {
        metadata = nativeRenderMetadata(painter);
      } catch {
        return fail('native-border-shape');
      }
      if (metadata?.kind === 'paint') return metadata.entries;
      if (!metadata || metadata.kind !== 'border') return fail('custom-painter');
      return metadata.shape ? [{ kind: 'border', color: 0, shape: metadata.shape }] : [];
    };
    return {
      options: {
        pointerHitTest: source.painter ? 'self' : 'proxy',
        ...(!source.children.length
          ? {
              layout: { childConstraints: 'inherit', enforceBounds: true },
              horizontal: {
                kind: 'finite',
                min: source.preferredSize.width,
                max: source.preferredSize.width,
              },
              vertical: {
                kind: 'finite',
                min: source.preferredSize.height,
                max: source.preferredSize.height,
              },
            }
          : {}),
      },
      paint: read(source.painter),
      foreground: read(source.foregroundPainter),
    };
  }
  let metadata;
  const measured = diagnostics && render instanceof RenderSemanticsAnnotations;
  const started = measured
    ? typeof performance === 'undefined'
      ? Date.now()
      : performance.now()
    : 0;
  try {
    metadata = nativeRenderMetadata(render);
  } catch (error) {
    return fail(
      'native-render-configuration:' + render.constructor.name + ':' + String(error).slice(0, 256),
    );
  } finally {
    if (measured) {
      ++diagnostics.metadataCalls;
      diagnostics.metadataMs +=
        (typeof performance === 'undefined' ? Date.now() : performance.now()) - started;
    }
  }
  if (metadata?.kind === 'overlay') {
    if (metadata.clip !== 'none' && metadata.clip !== 'hardEdge')
      return fail('overlay-antialias-clip');
    if (
      !Number.isInteger(metadata.skipCount) ||
      metadata.skipCount < 0 ||
      metadata.skipCount > render.children.length
    )
      return fail('overlay-skip-count');
    return {
      kind: 'stack',
      children: render.children.slice(metadata.skipCount),
      options: {
        layout: {
          childConstraints: 'expand',
          alignment: metadata.alignment,
          canonicalStack: true,
          expandEmpty: true,
          clipOverflow: metadata.clip === 'hardEdge',
        },
      },
    };
  }
  if (metadata?.kind === 'paint')
    return {
      options: { layout: { childConstraints: 'inherit', enforceBounds: true } },
      paint: metadata.entries,
    };
  if (metadata?.kind === 'singleChild') {
    if (render.children.length !== 1) return fail('single-child-metadata');
    return { options: { layout: { childConstraints: 'inherit' } } };
  }
  if (metadata?.kind === 'inputPadding') {
    return {
      options: {
        horizontal: { kind: 'unbounded', min: metadata.width },
        vertical: { kind: 'unbounded', min: metadata.height },
        layout: { inputPadding: true, enforceBounds: true, alignment: { x: 0, y: 0 } },
        pointerHitTest: 'proxy',
      },
    };
  }
  if (metadata?.kind === 'inlineScale')
    return { options: { layout: { inlineScale: metadata.scale }, pointerHitTest: 'proxy' } };
  if (metadata?.kind === 'sizedSurface')
    return {
      options: {
        layout: {
          childConstraints: 'inherit',
          preferredSize: true,
          expandPreferredWidth: metadata.expandWidth,
        },
        properties: { width: metadata.width, height: metadata.height },
      },
      ...(metadata.hitRegion ? { paint: [metadata.hitRegion] } : {}),
    };
  if (metadata?.kind === 'ink')
    return {
      dynamicPaint: metadata.dependencies ? false : (metadata.dependsOnChildVisibility ?? true),
      ...(metadata.dependencies ? { dependencies: metadata.dependencies } : {}),
      options: { pointerHitTest: metadata.absorbHitTest ? 'self' : 'proxy' },
      paint: metadata.entries,
    };
  if (prototype === RenderDecoratedBox.prototype) {
    const source = render as RenderDecoratedBox,
      decoration = source.decoration;
    if (Object.getPrototypeOf(decoration) !== BoxDecoration.prototype) {
      let metadata;
      try {
        metadata = nativeRenderMetadata(decoration, source.configuration.textDirection);
      } catch {
        return fail('native-decoration-shape');
      }
      if (metadata?.kind !== 'decoration') return fail('custom-decoration');
      return {
        options: { pointerHitTest: 'self' },
        ...(source.position === 'foreground'
          ? { foreground: metadata.entries }
          : { paint: metadata.entries }),
      };
    }
    const box = decoration as BoxDecoration;
    if (
      box.image ||
      box.gradient ||
      box.backgroundBlendMode ||
      box.boxShadow?.length ||
      box.shape !== 'rectangle' ||
      source.position !== 'background'
    )
      return fail('decoration-style');
    const radius = box.borderRadius?.resolve(source.configuration.textDirection),
      corners = radius
        ? [radius.topLeft, radius.topRight, radius.bottomRight, radius.bottomLeft]
        : [],
      value = radius?.topLeft.x ?? 0;
    if (corners.some((corner) => corner.x !== value || corner.y !== value))
      return fail('nonuniform-decoration-radius');
    const border = box.border;
    if (
      border &&
      ((Object.getPrototypeOf(border) !== Border.prototype &&
        Object.getPrototypeOf(border) !== BorderDirectional.prototype) ||
        !border.isUniform)
    )
      return fail('nonuniform-or-custom-decoration-border');
    const side = border?.top;
    return {
      options: {
        color: box.color ?? 0,
        radius: value,
        roundedHitTest: true,
        pointerHitTest: 'self',
      },
      ...(side?.style === 'solid'
        ? {
            paint: [
              {
                kind: 'border' as const,
                color: 0,
                shape: {
                  kind: 'rrect' as const,
                  radii: Array<number>(8).fill(value),
                  strokeWidth: side.width,
                  strokeColor: side.color,
                  strokeAlign: side.strokeAlign,
                },
              },
            ],
          }
        : {}),
    };
  }
  const mouse = nativeMouseRegionConfiguration(render);
  if (mouse) {
    const source = mouse.region;
    return {
      options: {
        layout: { childConstraints: 'inherit', expandEmpty: !source.child },
        pointerHitTest: source.hitTestBehavior === 'opaque' ? 'self' : source.hitTestBehavior,
        mouseRegion: { opaque: mouse.exclusive || source.opaque, exclusive: mouse.exclusive },
        canonicalGestures: true,
        onGesture: (event) => {
          if (
            event.kind !== 'mouseEnter' &&
            event.kind !== 'mouseExit' &&
            event.kind !== 'mouseHover'
          )
            return;
          const details = event.details ?? fail('native-mouse-details');
          const eventOptions = {
            position: new Offset(event.x, event.y),
            kind: PointerDeviceKind[details.pointerKind],
            timeStamp: details.timestamp * 1000,
            buttons: details.buttons,
            transform: [1, 0, 0, 1, details.localX - event.x, details.localY - event.y] as const,
          };
          invoke(() => {
            if (source.debugDisposed) return;
            if (event.kind === 'mouseEnter') source.onEnter?.(new PointerEnterEvent(eventOptions));
            else if (event.kind === 'mouseExit')
              source.onExit?.(new PointerExitEvent(eventOptions));
            else source.onHover?.(new PointerHoverEvent(eventOptions));
          });
        },
      },
    };
  }
  if (metadata?.kind === 'semantics') {
    const { source, configuration } = metadata,
      properties = source.properties,
      tag = properties.tagForChildren,
      range = nativeSemanticsRange(source),
      progress = properties.role === SemanticsRole.progressBar,
      loading = properties.role === SemanticsRole.loadingSpinner;
    const inlineTag =
      tag instanceof PlaceholderSpanIndexSemanticsTag &&
      Object.getPrototypeOf(tag) === PlaceholderSpanIndexSemanticsTag.prototype &&
      render.parentData instanceof TextParentData &&
      render.parentData.span !== null &&
      render.parent instanceof RenderParagraph &&
      Object.getPrototypeOf(render.parent) === RenderParagraph.prototype &&
      render.parent.children[tag.index] === render;
    if (tag && !inlineTag) return fail('semantics-property:tagForChildren');
    let flags = 0,
      actions = 0;
    if (properties.scopesRoute && !source.explicitChildNodes)
      return fail('route-requires-explicit-semantics');
    if (properties.enabled === false) flags |= p.semanticsFlags.disabled;
    if (properties.hidden) flags |= p.semanticsFlags.hidden;
    if (properties.checked || properties.toggled) flags |= p.semanticsFlags.checked;
    if (properties.mixed) flags |= p.semanticsFlags.mixed;
    if (properties.selected) flags |= p.semanticsFlags.selected;
    if (properties.focusable) flags |= p.semanticsFlags.focusable;
    if (properties.readOnly) flags |= p.semanticsFlags.readOnly;
    if (properties.scopesRoute) flags |= p.semanticsFlags.scopesRoute;
    if (properties.namesRoute) flags |= p.semanticsFlags.namesRoute;
    if (properties.accessibilityFocusBlockType === 'blockNode') {
      flags |= p.semanticsFlags.blockAccessibilityFocus;
      flags &= ~p.semanticsFlags.focusable;
    }
    if (properties.onTap) actions |= p.semanticsActions.activate;
    if (properties.onLongPress) actions |= p.semanticsActions.longPress;
    if (properties.onFocus) actions |= p.semanticsActions.focus;
    if (properties.onIncrease) actions |= p.semanticsActions.increment;
    if (properties.onDecrease) actions |= p.semanticsActions.decrement;
    if (range.actions) actions |= p.semanticsActions.setValue;
    if (properties.customSemanticsActions !== null) actions |= p.semanticsActions.custom;
    const role =
      properties.role === SemanticsRole.dialog
        ? 'dialog'
        : progress
          ? 'progressBar'
          : loading
            ? 'loadingSpinner'
            : properties.role === SemanticsRole.radioGroup
              ? 'radioGroup'
              : properties.inMutuallyExclusiveGroup && properties.checked !== null
                ? 'radio'
                : properties.button
                  ? 'button'
                  : properties.link
                    ? 'link'
                    : properties.textField
                      ? 'textField'
                      : properties.slider
                        ? 'slider'
                        : properties.toggled !== null
                          ? 'switchControl'
                          : properties.checked !== null || properties.mixed
                            ? 'checkbox'
                            : 'group';
    const deselect = nativeRadioDeselect(properties.onTap);
    if (role === 'radio' && properties.checked && properties.enabled !== false && deselect)
      actions |= p.semanticsActions.deselect;
    const merge = configuration._nativeMergeConfiguration();
    return {
      directData: true,
      cacheableSemantics:
        Object.isFrozen(properties) &&
        !range.range &&
        !range.actions &&
        Object.values(properties).every((value) => value === null || typeof value !== 'object'),
      options: {
        ...(merge.annotated
          ? {
              semantics: {
                role,
                flags,
                actions,
                configuration: merge,
                identifier: configuration.identifier,
                textDirection: configuration.textDirection,
                sortKey: metadata.sortKey,
                customActions: metadata.customActions,
                label: properties.label ?? '',
                hint: [properties.hint, properties.tooltip]
                  .filter((value) => value != null && value !== '')
                  .join('\n'),
                ...(properties.value != null ? { value: properties.value } : {}),
                ...(properties.increasedValue != null
                  ? { increasedValue: properties.increasedValue }
                  : {}),
                ...(properties.decreasedValue != null
                  ? { decreasedValue: properties.decreasedValue }
                  : {}),
                ...(range.range
                  ? {
                      range: {
                        minimum: range.range.min,
                        maximum: range.range.max,
                        value: range.range.value,
                        smallChange: range.range.smallChange ?? 0,
                        largeChange: range.range.largeChange ?? 0,
                        readOnly:
                          !range.actions || properties.enabled === false || !!properties.readOnly,
                      },
                    }
                  : {}),
              },
            }
          : {}),
        semanticsPolicy: {
          boundary: configuration.isSemanticBoundary,
          mergeIntoParent: !configuration.isSemanticBoundary,
          mergeDescendants: !source.explicitChildNodes && !source.excludeSemantics,
          excludeChildren: source.excludeSemantics,
          explicitChildren: source.explicitChildNodes,
          forceMergeDescendants: configuration.isMergingSemanticsOfDescendants,
          blockActions: source.blockUserActions,
        },
        onAction: (action, event) => {
          if (action === 'custom') {
            if (event)
              invoke(() => configuration.getActionHandler(SemanticsAction.customAction)?.(event.x));
            return;
          }
          if (action === 'deselect') {
            invoke(deselect);
            return;
          }
          if (action === 'setValue' && range.actions && event) {
            invoke(() => range.actions!.setValue(event.x));
            return;
          }
          invoke(
            action === 'activate'
              ? properties.onTap
              : action === 'longPress'
                ? properties.onLongPress
                : action === 'focus'
                  ? properties.onFocus
                  : action === 'increment'
                    ? properties.onIncrease
                    : action === 'decrement'
                      ? properties.onDecrease
                      : null,
          );
        },
      },
    };
  }
  return undefined;
}
