// SPDX-License-Identifier: BSD-3-Clause
import type { SkCanvas } from './skia/types/Drawing.ts';
export const displayListVersion = 1;
export interface DisplayListTarget {
  nelyxReplayDisplayList(packet: ArrayBuffer, handles: readonly unknown[]): void;
}
export interface DisplayListCanvas extends SkCanvas {
  nelyxFlush(): void;
  nelyxParagraph(paragraph: unknown, x: number, y: number): void;
  nelyxFillRect(
    rect: { x: number; y: number; width: number; height: number },
    color: number,
    shape?: number,
    radius?: number,
  ): void;
}
/** One recording-scoped packet. Handles remain live through validation/replay
 * and retire in replayFrame's existing finally block, on the runtime owner. */
export function createDisplayListCanvas(target: DisplayListTarget): DisplayListCanvas {
  const words: number[] = [],
    handles: unknown[] = [],
    ids = new Map<unknown, number>();
  let commands = 0,
    flushed = false;
  const handle = (value: unknown) => {
    if (value == null) return -1;
    let id = ids.get(value);
    if (id !== undefined) return id;
    if (handles.length >= 65536) throw new Error('Native display-list handle budget exceeded');
    id = handles.length;
    ids.set(value, id);
    handles.push(value);
    return id;
  };
  const emit = (op: number, ...values: number[]) => {
    if (flushed) throw new Error('Native display-list already consumed');
    if (commands >= 65536 || words.length + values.length + 2 > 2 * 1024 * 1024)
      throw new Error('Native display-list packet exceeds16MiB');
    commands++;
    words.push(op, values.length, ...values);
  };
  const canvas = {
    save: () => emit(0),
    restore: () => emit(1),
    clear: (color: unknown) => emit(2, handle(color)),
    drawPaint: (paint: unknown) => emit(3, handle(paint)),
    drawRect: (rect: unknown, paint: unknown) => emit(4, handle(rect), handle(paint)),
    drawOval: (rect: unknown, paint: unknown) => emit(5, handle(rect), handle(paint)),
    drawRRect: (rect: unknown, paint: unknown) => emit(6, handle(rect), handle(paint)),
    drawLine: (x: number, y: number, x2: number, y2: number, paint: unknown) =>
      emit(7, x, y, x2, y2, handle(paint)),
    clipRect: (rect: unknown, op: number, aa: boolean) => emit(8, handle(rect), op, aa ? 1 : 0),
    clipRRect: (rect: unknown, op: number, aa: boolean) => emit(9, handle(rect), op, aa ? 1 : 0),
    drawPath: (path: unknown, paint: unknown) => emit(10, handle(path), handle(paint)),
    clipPath: (path: unknown, op: number, aa: boolean) => emit(11, handle(path), op, aa ? 1 : 0),
    concat: (matrix: unknown) => emit(12, handle(matrix)),
    nelyxConcat44: (matrix: number[]) => emit(13, ...matrix),
    drawImageRect: (image: unknown, src: unknown, dst: unknown, paint: unknown) =>
      emit(14, handle(image), handle(src), handle(dst), handle(paint)),
    drawImageRectOptions: (
      image: unknown,
      src: unknown,
      dst: unknown,
      filter: number,
      mipmap: number,
      paint: unknown,
    ) => emit(15, handle(image), handle(src), handle(dst), filter, mipmap, handle(paint)),
    drawImageRectCubic: (
      image: unknown,
      src: unknown,
      dst: unknown,
      b: number,
      c: number,
      paint: unknown,
    ) => emit(16, handle(image), handle(src), handle(dst), b, c, handle(paint)),
    drawImageNine: (
      image: unknown,
      center: unknown,
      dst: unknown,
      filter: number,
      paint: unknown,
    ) => emit(17, handle(image), handle(center), handle(dst), filter, handle(paint)),
    drawPicture: (picture: unknown) => emit(18, handle(picture)),
    nelyxParagraph: (paragraph: unknown, x: number, y: number) => emit(19, handle(paragraph), x, y),
    saveLayer: (paint: unknown, bounds: unknown, backdrop?: unknown) =>
      emit(20, handle(paint), handle(bounds), handle(backdrop)),
    nelyxDrawShadow: (
      path: unknown,
      color: number,
      elevation: number,
      transparent: boolean,
      dpr: number,
    ) => emit(21, handle(path), color >>> 0, elevation, transparent ? 1 : 0, dpr),
    nelyxFillRect: (
      rect: { x: number; y: number; width: number; height: number },
      color: number,
      shape = 0,
      radius = 0,
    ) => emit(22, shape, rect.x, rect.y, rect.width, rect.height, radius, radius, color >>> 0, 1),
    nelyxFlush() {
      if (flushed) throw new Error('Native display-list already consumed');
      flushed = true;
      const packet = new Float64Array(4 + words.length);
      packet.set([0x4e4c444c, displayListVersion, commands, handles.length]);
      packet.set(words, 4);
      try {
        target.nelyxReplayDisplayList(packet.buffer, handles);
      } finally {
        words.length = 0;
        handles.length = 0;
        ids.clear();
      }
    },
  };
  return canvas as unknown as DisplayListCanvas;
}
