// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source numeric policy; Content owns measurement, placement and hit projection.
import {
  NativeLayoutBuilder,
  nativeLayoutExpression as expr,
  nativeLayoutInput as input,
} from '@nelyx/core/framework/rendering/object';
import type {
  NativeLayoutProgram,
  NativeLayoutScalar as Scalar,
} from '@nelyx/core/framework/rendering/object';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { Size } from '@nelyx/core/ui/geometry';
import type { ChipRenderOptions } from './chip-render.ts';

const add = (a: Scalar, b: Scalar) => expr('add', a, b),
  sub = (a: Scalar, b: Scalar) => expr('subtract', a, b),
  mul = (a: Scalar, b: Scalar) => expr('multiply', a, b),
  half = (a: Scalar) => expr('divide', a, 2),
  max = (a: Scalar, b: Scalar) => expr('max', a, b),
  min = (a: Scalar, b: Scalar) => expr('min', a, b),
  cap = (a: Scalar, upper: Scalar) => expr('clamp', a, 0, upper),
  finiteBound = (value: number): Scalar => (value === Infinity ? input.unbounded : value);

function childBounds(c: BoxConstraints | null, content: Scalar) {
  return c
    ? ([c.minWidth, finiteBound(c.maxWidth), c.minHeight, finiteBound(c.maxHeight)] as const)
    : ([content, content, content, content] as const);
}

/** Slots are in Source paint order: avatar, delete icon, then label. */
export function nativeChipLayout(
  o: ChipRenderOptions,
  direction: 'ltr' | 'rtl',
): NativeLayoutProgram {
  const t = o.theme,
    p = t.padding,
    lp = t.labelPadding,
    showingAvatar = t.showCheckmark || t.showAvatar,
    showingDelete = !o.deleteDrawerAnimation.isDismissed,
    b = new NativeLayoutBuilder(),
    raw = b.child(2, [0, input.maxWidth, 0, input.maxHeight]),
    content = b.value(max(32 - p.vertical + lp.vertical, add(raw.height, lp.vertical))),
    avatar = b.child(0, childBounds(o.avatarBoxConstraints, content)),
    avatarWidth = b.value(
      showingAvatar ? mul(t.showAvatar ? avatar.width : content, o.avatarDrawerAnimation.value) : 0,
    ),
    avatarHeight = showingAvatar ? avatar.height : content,
    deletion = b.child(1, childBounds(o.deleteIconBoxConstraints, content)),
    deleteWidth = b.value(showingDelete ? mul(deletion.width, o.deleteDrawerAnimation.value) : 0),
    deleteHeight = showingDelete ? deletion.height : content,
    free = b.value(
      max(0, sub(sub(sub(input.maxWidth, avatarWidth), deleteWidth), lp.horizontal + p.horizontal)),
    ),
    label = b.child(2, [
      0,
      expr('select', expr('finite', free), free, raw.width),
      raw.height,
      content,
    ]),
    labelWidth = b.value(add(label.width, lp.horizontal)),
    labelHeight = add(label.height, lp.vertical),
    innerWidth = b.value(add(add(avatarWidth, labelWidth), deleteWidth)),
    density = t.visualDensity.baseSizeAdjustment.dy / 2,
    rawWidth = add(innerWidth, p.horizontal),
    rawHeight = add(content, density + p.vertical),
    width = b.value(expr('clamp', rawWidth, input.minWidth, input.maxWidth)),
    height = b.value(expr('clamp', rawHeight, input.minHeight, input.maxHeight)),
    centerY = (childHeight: Scalar) => half(add(sub(content, childHeight), density)),
    avatarX = showingAvatar
      ? direction === 'rtl'
        ? sub(innerWidth, avatarWidth)
        : sub(avatarWidth, avatar.width)
      : 0,
    labelX = direction === 'rtl' ? deleteWidth : avatarWidth,
    labelY = add(centerY(labelHeight), p.top + lp.top),
    deleteX = showingDelete
      ? direction === 'rtl'
        ? 0
        : add(sub(add(avatarWidth, labelWidth), deletion.width), deleteWidth)
      : 0;

  b.place(0, add(p.left, avatarX), showingAvatar ? add(p.top, centerY(avatarHeight)) : p.top);
  b.place(1, add(p.left, deleteX), showingDelete ? add(p.top, centerY(deleteHeight)) : p.top);
  b.place(2, add(p.left + lp.left, labelX), labelY);
  b.size(width, height);
  b.baseline(
    add(labelY, label.baseline),
    label.hasBaseline,
    add(labelY, label.ideographicBaseline),
    label.hasIdeographicBaseline,
  );

  const available = sub(width, p.horizontal),
    accessible = min(
      mul(available, 0.499),
      min(add(lp.right, deletion.width), add(24, half(deletion.width))),
    ),
    threshold = cap(
      direction === 'rtl' ? add(p.left, accessible) : add(p.left, sub(available, accessible)),
      width,
    );
  b.hitRoute(
    1,
    [
      direction === 'rtl' ? 0 : threshold,
      0,
      direction === 'rtl' ? threshold : sub(width, threshold),
      height,
    ],
    [0, half(deletion.width), 0, half(deletion.height)],
  );
  b.hitRoute(2, [0, 0, width, height], [0, half(label.width), 0, half(label.height)]);
  if (showingDelete)
    b.hitSelf([
      direction === 'rtl' ? 0 : add(deleteX, p.left),
      0,
      add(deleteWidth, p.right),
      rawHeight,
    ]);
  if (t.canTapBody) {
    const start = direction === 'rtl' && showingDelete ? add(deleteWidth, p.right) : 0,
      extent =
        direction === 'rtl'
          ? sub(rawWidth, start)
          : showingDelete
            ? add(add(avatarWidth, labelWidth), p.left)
            : rawWidth;
    b.hitSelf([start, 0, extent, rawHeight]);
  } else if (!showingDelete) b.hitSelf([0, 0, 0, 0]);

  const intrinsicWidth = (maximum: boolean) => {
    const q = new NativeLayoutBuilder();
    q.result(
      add(
        p.horizontal + lp.horizontal,
        add(
          add(
            q.query(0, maximum ? 'maxWidth' : 'minWidth', input.extent),
            q.query(2, maximum ? 'maxWidth' : 'minWidth', input.extent),
          ),
          q.query(1, maximum ? 'maxWidth' : 'minWidth', input.extent),
        ),
      ),
    );
    return q.commands;
  };
  const intrinsicHeight = new NativeLayoutBuilder();
  intrinsicHeight.result(
    max(32, add(p.vertical + lp.vertical, intrinsicHeight.query(2, 'minHeight', input.extent))),
  );
  return {
    children: 3,
    forwardHitTest: true,
    layout: b.commands,
    minWidth: intrinsicWidth(false),
    maxWidth: intrinsicWidth(true),
    minHeight: intrinsicHeight.commands,
    maxHeight: intrinsicHeight.commands,
  };
}

/** The Source tap-padding proxy projects y while preserving the actual x. */
export function nativeChipTapLayout(c: BoxConstraints): NativeLayoutProgram {
  const b = new NativeLayoutBuilder(),
    lowW = expr('clamp', c.minWidth, input.minWidth, input.maxWidth),
    highW = expr('clamp', finiteBound(c.maxWidth), input.minWidth, input.maxWidth),
    lowH = expr('clamp', c.minHeight, input.minHeight, input.maxHeight),
    highH = expr('clamp', finiteBound(c.maxHeight), input.minHeight, input.maxHeight),
    child = b.child(0, [lowW, highW, lowH, highH]);
  b.place(0, 0, 0);
  b.size(child.width, child.height);
  b.baseline(
    child.baseline,
    child.hasBaseline,
    child.ideographicBaseline,
    child.hasIdeographicBaseline,
  );
  b.hitRoute(0, [0, 0, child.width, child.height], [1, 0, 0, half(child.height)]);
  const query = (kind: 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight') => {
    const q = new NativeLayoutBuilder();
    const horizontal = kind.endsWith('Width'),
      low = horizontal ? c.minWidth : c.minHeight,
      high = horizontal ? c.maxWidth : c.maxHeight;
    if (Number.isFinite(high) && low === high) q.result(low);
    else {
      const value = q.query(0, kind, input.extent);
      q.result(low === Infinity ? value : expr('clamp', value, low, finiteBound(high)));
    }
    return q.commands;
  };
  return {
    children: 1,
    layout: b.commands,
    minWidth: query('minWidth'),
    maxWidth: query('maxWidth'),
    minHeight: query('minHeight'),
    maxHeight: query('maxHeight'),
  };
}

export function nativeChipSemanticsLayout(minimum: Size): NativeLayoutProgram {
  const b = new NativeLayoutBuilder(),
    child = b.child(0, [input.minWidth, input.maxWidth, input.minHeight, input.maxHeight]);
  b.place(0, 0, 0);
  b.size(child.width, child.height);
  b.baseline(
    child.baseline,
    child.hasBaseline,
    child.ideographicBaseline,
    child.hasIdeographicBaseline,
  );
  const width = max(minimum.width, child.width),
    height = max(minimum.height, child.height);
  b.semanticsRect([half(sub(child.width, width)), half(sub(child.height, height)), width, height]);
  const query = (kind: 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight') => {
    const q = new NativeLayoutBuilder();
    q.result(q.query(0, kind, input.extent));
    return q.commands;
  };
  return {
    children: 1,
    layout: b.commands,
    minWidth: query('minWidth'),
    maxWidth: query('maxWidth'),
    minHeight: query('minHeight'),
    maxHeight: query('maxHeight'),
  };
}
