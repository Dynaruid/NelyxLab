// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source slot policy recorded as finite commands; Content owns all measurements.
import {
  NativeLayoutBuilder,
  nativeLayoutExpression as expr,
  nativeLayoutInput as input,
} from '@nelyx/core/framework/rendering/object';
import type {
  NativeLayoutProgram,
  NativeLayoutScalar as Scalar,
} from '@nelyx/core/framework/rendering/object';
import type { DecorationLayoutConfiguration, DecorationSlot } from './input-decorator-layout.ts';

export const inputPaintValues = Object.freeze({
  x: 0,
  width: 1,
  height: 2,
  gapStart: 3,
  gapExtent: 4,
});
export function nativeInputDecorationLayout(
  slots: readonly DecorationSlot[],
  c: DecorationLayoutConfiguration,
): NativeLayoutProgram {
  const add = (a: Scalar, b: Scalar) => expr('add', a, b),
    sub = (a: Scalar, b: Scalar) => expr('subtract', a, b),
    mul = (a: Scalar, b: Scalar) => expr('multiply', a, b),
    max = (...values: Scalar[]): Scalar => values.reduce((a, b) => expr('max', a, b)),
    min = (a: Scalar, b: Scalar) => expr('min', a, b),
    half = (a: Scalar) => expr('divide', a, 2),
    positive = (a: Scalar) => max(0, a),
    has = (slot: DecorationSlot) => slots.includes(slot),
    p = c.padding;
  const intrinsicWidth = (
    b: NativeLayoutBuilder,
    maximum: boolean,
    height: Scalar,
    when?: Scalar,
  ): Scalar => {
    const get = (slot: DecorationSlot) =>
      has(slot) ? b.query(slots.indexOf(slot), maximum ? 'maxWidth' : 'minWidth', height, when) : 0;
    const icon = get('icon'),
      prefixIcon = get('prefixIcon'),
      suffixIcon = get('suffixIcon'),
      value = get('input'),
      hint = get('hint'),
      label = get('label'),
      prefix = get('prefix'),
      suffix = get('suffix'),
      helper = get('helperError'),
      counter = get('counter');
    const start = has('prefixIcon') ? add(prefixIcon, 4) : p.left + c.inputGap,
      finish = has('suffixIcon') ? add(suffixIcon, 4) : p.right + c.inputGap,
      content = add(
        add(
          add(
            max(
              value,
              c.isEmpty || c.maintainHintSize ? hint : 0,
              c.labelVisible || c.maintainLabelSize ? label : 0,
            ),
            prefix,
          ),
          suffix,
        ),
        (has('prefix') ? 4 : 0) + (has('suffix') ? 4 : 0),
      );
    return add(
      icon,
      max(
        add(add(start, content), finish),
        add(add(p.horizontal, helper), add(counter, has('counter') ? 16 : 0)),
      ),
    );
  };
  const measure = (
    b: NativeLayoutBuilder,
    width: Scalar,
    maxHeight: Scalar,
    intrinsic: boolean,
  ) => {
    b.assert(expr('finite', width));
    if (c.expands && !intrinsic) b.assert(expr('finite', maxHeight));
    const metrics = new Map<DecorationSlot, { width: Scalar; height: Scalar; baseline: Scalar }>();
    const child = (
      slot: DecorationSlot,
      maxWidth: Scalar,
      height: Scalar,
      minWidth: Scalar = 0,
    ) => {
      if (!has(slot)) return { width: 0, height: 0, baseline: 0 };
      const measured = b.child(slots.indexOf(slot), [minWidth, maxWidth, 0, height]),
        baseline = b.value(
          expr(
            'select',
            c.baseline === 'alphabetic' ? measured.hasBaseline : measured.hasIdeographicBaseline,
            c.baseline === 'alphabetic' ? measured.baseline : measured.ideographicBaseline,
            measured.height,
          ),
        ),
        value = { width: measured.width, height: measured.height, baseline };
      metrics.set(slot, value);
      return value;
    };
    const icon = child('icon', width, maxHeight),
      containerWidth = b.value(positive(sub(width, icon.width))),
      prefixIcon = child('prefixIcon', containerWidth, maxHeight),
      suffixIcon = child('suffixIcon', positive(sub(containerWidth, prefixIcon.width)), maxHeight),
      start = has('prefixIcon')
        ? add(prefixIcon.width, 4)
        : (c.direction === 'rtl' ? p.right : p.left) + c.inputGap,
      finish = has('suffixIcon')
        ? add(suffixIcon.width, 4)
        : (c.direction === 'rtl' ? p.left : p.right) + c.inputGap,
      inlineWidth = b.value(positive(sub(sub(containerWidth, start), finish))),
      prefix = child('prefix', inlineWidth, maxHeight),
      suffix = child('suffix', positive(sub(inlineWidth, prefix.width)), maxHeight),
      inputWidth = b.value(
        positive(
          sub(
            sub(sub(inlineWidth, prefix.width), suffix.width),
            (has('prefix') ? 4 : 0) + (has('suffix') ? 4 : 0),
          ),
        ),
      ),
      counter = child('counter', positive(sub(containerWidth, p.horizontal)), input.unbounded),
      helper = child(
        'helperError',
        positive(
          sub(sub(containerWidth, p.horizontal), add(counter.width, has('counter') ? 16 : 0)),
        ),
        input.unbounded,
      ),
      footerHeight = max(counter.height, helper.height),
      footerAscent = max(counter.baseline, helper.baseline),
      footer = b.value(
        expr(
          'select',
          expr('greater', footerHeight, 0),
          add(
            add(4, footerAscent),
            max(sub(counter.height, counter.baseline), sub(helper.height, helper.baseline)),
          ),
          0,
        ),
      ),
      floating = c.hasLabel && !c.outline && !c.isCollapsed ? c.floatingLabelHeight : 0,
      maxInputHeight = positive(sub(maxHeight, add(p.vertical + floating, footer))),
      value = child('input', inputWidth, maxInputHeight, inputWidth),
      hint = child('hint', inputWidth, maxInputHeight),
      labelScale = 1 - 0.25 * c.labelProgress,
      label = child('label', positive(expr('divide', inlineWidth, labelScale)), input.unbounded),
      useHint = c.isEmpty || c.maintainHintSize,
      labelInRow = c.hasLabel && c.labelProgress === 0 && (c.labelVisible || c.maintainLabelSize),
      ascent = b.value(
        max(
          value.baseline,
          prefix.baseline,
          suffix.baseline,
          useHint ? hint.baseline : 0,
          labelInRow ? label.baseline : 0,
        ),
      ),
      descent = max(
        sub(value.height, value.baseline),
        sub(prefix.height, prefix.baseline),
        sub(suffix.height, suffix.baseline),
        useHint ? sub(hint.height, hint.baseline) : 0,
        labelInRow ? sub(label.height, label.baseline) : 0,
      ),
      rowHeight = b.value(add(ascent, descent)),
      naturalHeight = max(
        c.isDense || c.isCollapsed ? 0 : 48,
        add(p.vertical + floating + c.density.height, rowHeight),
        prefixIcon.height,
        suffixIcon.height,
      ),
      availableHeight = positive(sub(maxHeight, footer)),
      containerHeight = b.value(
        c.expands && !intrinsic ? availableHeight : min(positive(naturalHeight), availableHeight),
      ),
      height = b.value(max(icon.height, add(containerHeight, footer)));
    if (intrinsic) return height;
    const containerX = c.direction === 'ltr' ? icon.width : 0,
      contentTop = Math.max(0, p.top + floating + c.density.height / 2),
      contentBottom = sub(containerHeight, p.bottom + c.density.height / 2),
      available = positive(sub(sub(contentBottom, contentTop), rowHeight)),
      rowTop = add(
        contentTop,
        mul(available, ((c.vertical?.y ?? (c.outline ? -0.0 : -1)) + 1) / 2),
      ),
      baseline = b.value(add(rowTop, ascent)),
      inputStart = add(add(start, prefix.width), has('prefix') ? 4 : 0);
    const place = (slot: DecorationSlot, x: Scalar, y: Scalar) => {
      if (!has(slot)) return;
      b.place(
        slots.indexOf(slot),
        add(
          containerX,
          c.direction === 'ltr' ? x : sub(sub(containerWidth, x), metrics.get(slot)!.width),
        ),
        y,
      );
    };
    place('input', inputStart, sub(baseline, value.baseline));
    place('hint', inputStart, sub(baseline, hint.baseline));
    place('prefix', start, sub(baseline, prefix.baseline));
    place('suffix', sub(sub(containerWidth, finish), suffix.width), sub(baseline, suffix.baseline));
    place('prefixIcon', 0, half(sub(containerHeight, prefixIcon.height)));
    place(
      'suffixIcon',
      sub(containerWidth, suffixIcon.width),
      half(sub(containerHeight, suffixIcon.height)),
    );
    if (has('icon'))
      b.place(
        slots.indexOf('icon'),
        c.direction === 'ltr' ? 0 : containerWidth,
        half(sub(containerHeight, icon.height)),
      );
    const inlineLabelY = c.alignLabelWithHint
        ? sub(baseline, label.baseline)
        : half(sub(containerHeight, label.height)),
      floatingLabelY = c.outline
        ? sub(mul(label.height, -0.375), c.borderStrokeOffset / 2)
        : p.top + c.density.height / 2,
      floatingStart = (c.direction === 'rtl' ? p.right : p.left) + (c.outline ? c.inputGap : 0),
      floatingX = b.value(
        add(
          floatingStart,
          mul(
            sub(sub(containerWidth, p.horizontal), mul(label.width, 0.75)),
            (c.labelAlignment + 1) / 2,
          ),
        ),
      ),
      logicalLabelX = add(mul(inputStart, 1 - c.labelProgress), mul(floatingX, c.labelProgress));
    if (has('label')) {
      b.place(
        slots.indexOf('label'),
        add(
          containerX,
          c.direction === 'ltr'
            ? logicalLabelX
            : sub(sub(containerWidth, logicalLabelX), mul(label.width, labelScale)),
        ),
        add(mul(inlineLabelY, 1 - c.labelProgress), mul(floatingLabelY, c.labelProgress)),
      );
      b.scale(slots.indexOf('label'), labelScale, labelScale);
    }
    place(
      'helperError',
      (c.direction === 'rtl' ? p.right : p.left) + c.inputGap,
      sub(add(add(containerHeight, 4), footerAscent), helper.baseline),
    );
    place(
      'counter',
      sub(
        containerWidth,
        add((c.direction === 'rtl' ? p.left : p.right) + c.inputGap, counter.width),
      ),
      sub(add(add(containerHeight, 4), footerAscent), counter.baseline),
    );
    if (has('container')) {
      b.child(slots.indexOf('container'), [
        containerWidth,
        containerWidth,
        containerHeight,
        containerHeight,
      ]);
      b.place(slots.indexOf('container'), containerX, 0);
    }
    b.paintValue(inputPaintValues.x, containerX);
    b.paintValue(inputPaintValues.width, containerWidth);
    b.paintValue(inputPaintValues.height, containerHeight);
    b.paintValue(
      inputPaintValues.gapStart,
      has('label') ? (c.direction === 'rtl' ? sub(containerWidth, floatingX) : floatingX) : -1,
    );
    b.paintValue(inputPaintValues.gapExtent, mul(label.width, 0.75));
    b.size(width, height);
    b.baseline(baseline, 1, baseline, 1);
    return height;
  };
  const layout = new NativeLayoutBuilder();
  measure(layout, input.maxWidth, input.maxHeight, false);
  const widthMode = (maximum: boolean) => {
    const b = new NativeLayoutBuilder();
    b.result(intrinsicWidth(b, maximum, input.extent));
    return b.commands;
  };
  const heightMode = (maximum: boolean) => {
    const b = new NativeLayoutBuilder(),
      fallback = intrinsicWidth(
        b,
        maximum,
        input.unbounded,
        expr('equal', expr('finite', input.extent), 0),
      ),
      width = b.value(expr('select', expr('finite', input.extent), input.extent, fallback));
    b.result(measure(b, width, input.unbounded, true));
    return b.commands;
  };
  return {
    children: slots.length,
    layout: layout.commands,
    minWidth: widthMode(false),
    maxWidth: widthMode(true),
    minHeight: heightMode(false),
    maxHeight: heightMode(true),
  };
}
