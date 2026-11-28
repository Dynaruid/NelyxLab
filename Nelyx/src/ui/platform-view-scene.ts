// SPDX-License-Identifier: BSD-3-Clause
import type {
  PlatformViewDrawRange,
  PlatformViewPlacement,
  PlatformViewScenePart,
  RecordedPlatformView,
} from '../hosting/platform-views.ts';
import { bounds, captureTransform, identity, intersect, multiply, translate } from './geometry.ts';
import type { TransformMatrix } from './geometry.ts';
import type { PaintCommand, PaintFrame, Rect, ResourceId } from './types.ts';
import { captureBorrowedFrame, disposeFrame, paintFrameLimits } from './frame.ts';
import { encodeFrame } from './frame-wire.ts';

interface CanvasState {
  x: number;
  y: number;
  clip: Rect;
  reason?: string;
  indices: number[];
}

const nonTranslation = 'Platform views require a translation-only transform';
const nonRectangularClip = 'Platform views require an intersecting rectangular clip';
const groupEffect = 'A layer or filter crosses the platform view boundary';

function translation(matrix: readonly number[]): readonly [number, number] | undefined {
  if (
    matrix.length === 6 &&
    matrix[0] === 1 &&
    matrix[1] === 0 &&
    matrix[2] === 0 &&
    matrix[3] === 1
  )
    return [matrix[4]!, matrix[5]!];
  if (
    matrix.length === 16 &&
    matrix.every(
      (value, index) => index === 12 || index === 13 || value === (index % 5 === 0 ? 1 : 0),
    )
  )
    return [matrix[12]!, matrix[13]!];
}

function project(rect: Rect, state: CanvasState): Rect {
  return { ...rect, x: rect.x + state.x, y: rect.y + state.y };
}

function roundedRect(values: readonly [number, number, number, number, ...number[]]): Rect {
  const [x, y, right, bottom] = values;
  return { x, y, width: right - x, height: bottom - y };
}

/** Partition the original replay into independently balanced surfaces. The
 * background clear is already at command zero, before all view markers. */
export function partitionPlatformViewScene(
  commands: readonly PaintCommand[],
  markers: readonly RecordedPlatformView[],
  viewport: Rect,
  picture?: (resource: ResourceId) => readonly PaintCommand[] | undefined,
): readonly PlatformViewScenePart[] {
  const stack: CanvasState[] = [{ x: 0, y: 0, clip: viewport, indices: [] }];
  const parts: PlatformViewScenePart[] = [];
  let nextMarker = 0;
  let painted = false;
  let start = 0;
  let prefix: readonly number[] = [];

  const finishDrawing = (end: number) => {
    if (!painted) return;
    parts.push({ draw: { start, end, prefix, restoreCount: stack.length - 1 } });
    painted = false;
  };

  for (let index = 0; index <= commands.length; index++) {
    const state = stack.at(-1)!;
    while (markers[nextMarker]?.index === index) {
      const marker = markers[nextMarker++]!;
      if ('barrier' in marker) {
        parts.push({ barrier: intersect(project(marker.barrier, state), state.clip) });
        continue;
      }
      const bounds = project(marker.rect, state);
      const clip = intersect(bounds, state.clip);
      const visible = marker.visible && !state.reason && clip.width > 0 && clip.height > 0;
      const placement: PlatformViewPlacement = {
        instanceId: marker.instanceId,
        bounds,
        clip,
        visible,
        ...(state.reason ? { unsupportedReason: state.reason } : {}),
      };
      if (visible) {
        finishDrawing(index);
        start = index;
        prefix = stack.flatMap(({ indices }) => indices);
      }
      parts.push({ view: placement });
    }
    if (index === commands.length) break;
    const command = commands[index]!;
    switch (command.op) {
      case 'save':
      case 'saveLayer':
      case 'saveBackdropFilter':
        stack.push({
          ...state,
          indices: [index],
          ...(command.op === 'save' ? {} : { reason: groupEffect }),
        });
        if (command.op !== 'save') painted = true;
        break;
      case 'restore':
        stack.pop();
        break;
      case 'transform': {
        const offset = translation(command.matrix);
        if (offset) {
          state.x += offset[0];
          state.y += offset[1];
        } else state.reason ??= nonTranslation;
        state.indices.push(index);
        break;
      }
      case 'clip':
      case 'clipRect':
        if (command.op === 'clipRect' && command.clipOp === 'difference')
          state.reason ??= nonRectangularClip;
        else state.clip = intersect(state.clip, project(command.rect, state));
        state.indices.push(index);
        break;
      case 'clipPath':
      case 'clipRRect':
        state.reason ??= nonRectangularClip;
        state.indices.push(index);
        break;
      default:
        painted = true;
    }
  }
  finishDrawing(commands.length);
  const placed: Rect[] = [];
  let split = false;
  let budget = 16_384;
  for (const part of parts) {
    if ('barrier' in part) continue;
    if ('view' in part) {
      if (part.view.visible) placed.push(part.view.clip);
      continue;
    }
    if (!placed.length) continue;
    const replay = platformViewDrawCommands(commands, part.draw);
    if (
      touchesPlatformViews(replay.slice(1), identity, viewport, placed, picture, () => --budget > 0)
    ) {
      split = true;
      break;
    }
  }
  if (!split)
    return [
      { draw: { start: 0, end: commands.length, prefix: [], restoreCount: 0 } },
      ...parts.filter((part) => !('draw' in part)),
    ];
  return parts;
}

function touchesPlatformViews(
  commands: readonly PaintCommand[],
  transform: TransformMatrix,
  clip: Rect,
  views: readonly Rect[],
  picture: ((resource: ResourceId) => readonly PaintCommand[] | undefined) | undefined,
  withinBudget: () => boolean,
  depth = 0,
): boolean {
  if (depth > 64) return true;
  const stack = [{ transform, clip }];
  const overlaps = (rect: Rect) =>
    views.some((view) => {
      const overlap = intersect(rect, view);
      return overlap.width > 0 && overlap.height > 0;
    });
  const project = (rect: Rect, matrix: TransformMatrix) => {
    const result = bounds(multiply(matrix, translate(rect.x, rect.y)), rect);
    return Number.isFinite(result.width) && Number.isFinite(result.height) ? result : undefined;
  };
  for (const command of commands) {
    if (!withinBudget()) return true;
    const current = stack.at(-1)!;
    switch (command.op) {
      case 'save':
        stack.push({ ...current });
        continue;
      case 'restore':
        stack.pop();
        continue;
      case 'transform':
        current.transform = multiply(current.transform, captureTransform(command.matrix));
        continue;
      case 'clip':
      case 'clipRect': {
        if (command.op === 'clipRect' && command.clipOp === 'difference') continue;
        const projected = project(command.rect, current.transform);
        if (projected) current.clip = intersect(current.clip, projected);
        continue;
      }
      case 'clipPath':
        continue;
      case 'clipRRect': {
        if (command.clipOp === 'difference') continue;
        const rounded = 'rect' in command ? command.rect : roundedRect(command.rrect.values);
        const projected = project(rounded, current.transform);
        if (projected) current.clip = intersect(current.clip, projected);
        continue;
      }
      case 'saveLayer': {
        const paint = command.paint;
        if (
          (paint.blendMode !== 'srcOver' || paint.imageFilter || paint.colorFilter) &&
          overlaps(current.clip)
        )
          return true;
        stack.push({ ...current });
        continue;
      }
      case 'saveBackdropFilter':
        if (overlaps(current.clip)) return true;
        stack.push({ ...current });
        continue;
    }
    if (!overlaps(current.clip)) continue;
    if (command.op === 'drawPicture') {
      const nested = picture?.(command.resource);
      if (!nested) return true;
      if (
        touchesPlatformViews(
          nested,
          current.transform,
          current.clip,
          views,
          picture,
          withinBudget,
          depth + 1,
        )
      )
        return true;
      continue;
    }
    if ('color' in command && command.op !== 'clear' && command.color >>> 24 === 0) continue;
    const paint = 'paint' in command ? command.paint : undefined;
    if (
      paint &&
      (paint.imageFilter || paint.maskFilter || paint.colorFilter || paint.blendMode !== 'srcOver')
    )
      return true;
    const rect =
      'rect' in command
        ? command.rect
        : 'rrect' in command
          ? roundedRect(command.rrect.values)
          : 'dst' in command
            ? command.dst
            : command.op === 'drawLine'
              ? {
                  x: Math.min(command.from.x, command.to.x),
                  y: Math.min(command.from.y, command.to.y),
                  width: Math.abs(command.from.x - command.to.x),
                  height: Math.abs(command.from.y - command.to.y),
                }
              : undefined;
    const stroke =
      paint && (paint.style === 'stroke' || command.op === 'drawLine')
        ? (paint.strokeWidth * Math.max(1, paint.strokeMiterLimit)) / 2
        : 0;
    const projected =
      rect &&
      project(
        {
          x: rect.x - stroke,
          y: rect.y - stroke,
          width: rect.width + stroke * 2,
          height: rect.height + stroke * 2,
        },
        current.transform,
      );
    // Allow a physical antialias fringe at fractional scale before moving a draw behind the slot.
    if (
      !projected ||
      overlaps(
        intersect(current.clip, {
          x: projected.x - 1,
          y: projected.y - 1,
          width: projected.width + 2,
          height: projected.height + 2,
        }),
      )
    )
      return true;
  }
  return false;
}

const clearTransparent = Object.freeze({ op: 'clear', color: 0 } as const);
const restore = Object.freeze({ op: 'restore' } as const);

/** The worker receives only indices alongside the existing frame wire. Check
 * both bounds and allowed prefix operations before replaying a received plan. */
export function platformViewDrawCommands(
  commands: readonly PaintCommand[],
  range: PlatformViewDrawRange,
): readonly PaintCommand[] {
  const { start, end, prefix, restoreCount } = range;
  if (
    !(
      Number.isInteger(start) &&
      Number.isInteger(end) &&
      start >= 0 &&
      start <= end &&
      end <= commands.length &&
      Number.isInteger(restoreCount) &&
      restoreCount >= 0 &&
      restoreCount <= commands.length &&
      prefix.length <= start
    )
  )
    throw new Error('Invalid platform view drawing range');

  const values: PaintCommand[] = start === 0 ? [] : [clearTransparent];
  let depth = 0;
  let last = -1;
  for (const index of prefix) {
    if (!Number.isInteger(index) || index <= last || index >= start)
      throw new Error('Invalid platform view drawing state index');
    last = index;
    const command = commands[index]!;
    switch (command.op) {
      case 'save':
        depth++;
        break;
      case 'transform':
      case 'clip':
      case 'clipRect':
        break;
      default:
        throw new Error('Invalid platform view drawing state');
    }
    values.push(command);
  }
  for (let index = start; index < end; index++) {
    const command = commands[index]!;
    switch (command.op) {
      case 'save':
      case 'saveLayer':
      case 'saveBackdropFilter':
        depth++;
        break;
      case 'restore':
        depth--;
        break;
    }
    if (depth < 0) throw new Error('Platform view drawing range restores past its canvas state');
    values.push(command);
  }
  if (depth !== restoreCount) throw new Error('Unbalanced platform view drawing range');
  for (let index = 0; index < restoreCount; index++) values.push(restore);
  return values;
}

/** Produce the initial shape-only native foreground in the existing Web wire.
 * Picture recipes stay borrowed while the source frame's resource lease is live. */
export function encodePlatformViewForeground(
  frame: PaintFrame,
  range: PlatformViewDrawRange,
  picture: (resource: ResourceId) => readonly PaintCommand[] | undefined,
  clip?: Rect,
): Uint8Array {
  if (range.start === 0)
    throw new Error('A native foreground requires a transparent drawing range');
  const values: PaintCommand[] = [];
  const save = { op: 'save' } as const;
  const append = (commands: readonly PaintCommand[], depth: number): void => {
    if (depth > paintFrameLimits.layers) throw new Error('Platform view picture nesting exceeded');
    for (const command of commands) {
      if (values.length >= paintFrameLimits.commands)
        throw new Error('Platform view drawing exceeds the command budget');
      if (command.op === 'drawPicture') {
        const recording = picture(command.resource);
        if (!recording) throw new Error('Platform view picture recording has retired');
        values.push(save);
        append(recording, depth + 1);
        values.push(restore);
      } else if (command.op === 'transform') {
        const offset = translation(command.matrix);
        if (!offset) throw new Error(nonTranslation);
        values.push({ op: 'transform', matrix: [1, 0, 0, 1, ...offset] });
      } else values.push(command);
    }
  };
  const commands = platformViewDrawCommands(frame.commands, range);
  if (clip) {
    values.push(clearTransparent, { op: 'clip', rect: clip });
    append(commands.slice(1), 0);
  } else append(commands, 0);
  const expanded = captureBorrowedFrame(frame.token, values);
  try {
    return encodeFrame(
      expanded,
      () => {
        throw new Error('The native shape foreground does not accept external drawing resources');
      },
      { format: 'web' },
    );
  } finally {
    disposeFrame(expanded);
  }
}
