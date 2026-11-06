// SPDX-License-Identifier: BSD-3-Clause
import { nativeRenderMetadata, nativeShape } from '@nelyx/core/framework/rendering/object';
import type { RenderObject, NativePaintEntry } from '@nelyx/core/framework/rendering/object';
import { RenderPhysicalShape, RenderPhysicalModel } from '@nelyx/core/framework/rendering/clip';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { RenderCustomPaint } from '@nelyx/core/framework/rendering/custom-paint';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { CircleBorder } from '@nelyx/core/framework/painting/circle-border';
import { RenderDecoratedBox } from '@nelyx/core/framework/rendering/boxes';
import { RenderOpacity } from '@nelyx/core/framework/rendering/opacity';
import { RenderMouseRegion } from '@nelyx/core/framework/rendering/mouse-region';
import { RenderSemanticsAnnotations } from '@nelyx/core/framework/rendering/semantics-annotations';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SemanticsProperties } from '@nelyx/core/framework/semantics/semantics';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Offset } from '@nelyx/core/ui/offset';
import { PointerDeviceKind } from '@nelyx/core/ui/pointer';
import { PointerEnterEvent, PointerExitEvent } from '@nelyx/core/framework/gestures/events';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import type { NodeOptions } from './widgets.ts';
import { protocol as p } from './schema.ts';

export interface OriginalControlConfiguration {
  readonly options: NodeOptions;
  readonly paint?: readonly NativePaintEntry[];
  readonly foreground?: readonly NativePaintEntry[];
  readonly suppressChildren?: boolean;
  readonly mergeText?: boolean;
}
const semanticsDefaults = new SemanticsProperties();
// Semantics owns a private canonical render subtype. Resolve its exact identity
// through the configuration factory, then dispose the unattached metadata.
const semanticsProbe = new Semantics().createRenderObject();
const widgetSemanticsPrototype: unknown = Object.getPrototypeOf(semanticsProbe);
semanticsProbe.dispose();
const semanticFields = new Set([
  'enabled',
  'checked',
  'toggled',
  'selected',
  'button',
  'link',
  'textField',
  'slider',
  'readOnly',
  'focusable',
  'focused',
  'hidden',
  'identifier',
  'label',
  'hint',
  'textDirection',
  'onTap',
  'onLongPress',
  'onFocus',
  'onIncrease',
  'onDecrease',
]);
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
      let metadata;
      try {
        metadata = nativeRenderMetadata(painter);
      } catch {
        return fail('native-border-shape');
      }
      if (!metadata || metadata.kind !== 'border') return fail('custom-painter');
      return metadata.shape ? [{ kind: 'border', color: 0, shape: metadata.shape }] : [];
    };
    return {
      options: { pointerHitTest: source.painter ? 'self' : 'proxy' },
      paint: read(source.painter),
      foreground: read(source.foregroundPainter),
    };
  }
  let metadata;
  try {
    metadata = nativeRenderMetadata(render);
  } catch {
    return fail('native-render-configuration');
  }
  if (metadata?.kind === 'inputPadding') {
    if (metadata.width || metadata.height) return fail('padded-button-hit-test');
    return { options: {} };
  }
  if (metadata?.kind === 'ink')
    return {
      options: { pointerHitTest: metadata.absorbHitTest ? 'self' : 'proxy' },
      paint: metadata.entries,
    };
  if (prototype === RenderOpacity.prototype) {
    const source = render as RenderOpacity;
    return {
      options: { properties: { opacity: source.alpha / 255 } },
      suppressChildren: source.alpha === 0 && !source.alwaysIncludeSemantics,
    };
  }
  if (prototype === RenderDecoratedBox.prototype) {
    const source = render as RenderDecoratedBox,
      decoration = source.decoration;
    if (Object.getPrototypeOf(decoration) !== BoxDecoration.prototype)
      return fail('custom-decoration');
    const box = decoration as BoxDecoration;
    if (
      box.image ||
      box.border ||
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
    return {
      options: {
        color: box.color ?? 0,
        radius: value,
        roundedHitTest: true,
        pointerHitTest: 'self',
      },
    };
  }
  if (prototype === RenderMouseRegion.prototype) {
    const source = render as RenderMouseRegion;
    if (source.onHover) return fail('mouse-hover-details');
    return {
      options: {
        pointerHitTest: source.hitTestBehavior === 'opaque' ? 'self' : source.hitTestBehavior,
        mouseRegion: { opaque: source.opaque },
        canonicalGestures: true,
        onGesture: (event) => {
          if (event.kind !== 'mouseEnter' && event.kind !== 'mouseExit') return;
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
            else source.onExit?.(new PointerExitEvent(eventOptions));
          });
        },
      },
    };
  }
  if (
    prototype === RenderSemanticsAnnotations.prototype ||
    prototype === widgetSemanticsPrototype
  ) {
    const source = render as RenderSemanticsAnnotations,
      properties = source.properties;
    if (
      Object.getPrototypeOf(properties) !== SemanticsProperties.prototype ||
      source.localeForSubtree ||
      source.blockUserActions
    )
      return fail('custom-semantics-configuration');
    for (const key of Object.keys(properties) as (keyof SemanticsProperties)[])
      if (!semanticFields.has(key) && properties[key] !== semanticsDefaults[key])
        return fail('semantics-property:' + key);
    let flags = 0,
      actions = 0;
    if (properties.enabled === false) flags |= p.semanticsFlags.disabled;
    if (properties.hidden) flags |= p.semanticsFlags.hidden;
    if (properties.checked || properties.toggled) flags |= p.semanticsFlags.checked;
    if (properties.selected) flags |= p.semanticsFlags.selected;
    if (properties.focusable) flags |= p.semanticsFlags.focusable;
    if (properties.readOnly) flags |= p.semanticsFlags.readOnly;
    if (properties.onTap) actions |= p.semanticsActions.activate;
    if (properties.onLongPress) actions |= p.semanticsActions.longPress;
    if (properties.onFocus) actions |= p.semanticsActions.focus;
    if (properties.onIncrease) actions |= p.semanticsActions.increment;
    if (properties.onDecrease) actions |= p.semanticsActions.decrement;
    const role = properties.button
      ? 'button'
      : properties.link
        ? 'link'
        : properties.textField
          ? 'textField'
          : properties.slider
            ? 'slider'
            : properties.checked !== null || properties.toggled !== null
              ? 'checkbox'
              : 'group';
    return {
      options: {
        semantics: {
          role,
          flags,
          actions,
          label: properties.label ?? '',
          hint: properties.hint ?? '',
        },
        semanticsMergeIntoParent: !source.container && !source.explicitChildNodes,
        onFocusChanged: (focused) => {
          if (focused) invoke(properties.onFocus);
        },
        onAction: (action) =>
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
          ),
      },
      suppressChildren: source.excludeSemantics,
      mergeText: !source.explicitChildNodes && !source.excludeSemantics,
    };
  }
  return undefined;
}
