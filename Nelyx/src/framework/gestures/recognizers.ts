// SPDX-License-Identifier: BSD-3-Clause
import type { PointerEvent } from '../../ui/input.ts';
import type { GestureArenaManager, GestureArenaMember } from './arena.ts';
interface Track {
  start: PointerEvent;
  last: PointerEvent;
  entry: { resolve: (accepted: boolean) => void };
  accepted: boolean;
  dragging: boolean;
  up: boolean;
}
export class TapDragRecognizer implements GestureArenaMember {
  private tracks = new Map<number, Track>();
  private closed = false;
  constructor(
    private readonly arena: GestureArenaManager,
    public onTap: (() => void) | undefined,
    public onDrag: ((dx: number, dy: number) => void) | undefined,
    public onDragEnd: ((vx: number, vy: number) => void) | undefined = undefined,
    readonly slop = 12,
  ) {}
  handle(event: PointerEvent): void {
    if (this.closed) return;
    if (event.kind === 'down') {
      if (event.buttons !== 0 && (event.buttons & 1) === 0) return;
      this.tracks.set(event.pointer, {
        start: event,
        last: event,
        entry: this.arena.add(event.pointer, this),
        accepted: false,
        dragging: false,
        up: false,
      });
      return;
    }
    const track = this.tracks.get(event.pointer);
    if (!track) return;
    if (event.kind === 'move') {
      const distance = Math.hypot(event.x - track.start.x, event.y - track.start.y),
        dx = event.x - track.last.x,
        dy = event.y - track.last.y;
      track.last = event;
      if (!track.dragging && distance > this.slop) {
        if (this.onDrag) {
          track.dragging = true;
          if (!track.accepted) track.entry.resolve(true);
        } else {
          if (!track.accepted) track.entry.resolve(false);
          this.tracks.delete(event.pointer);
          return;
        }
      }
      if (track.accepted && track.dragging && this.onDrag) this.onDrag(dx, dy);
    } else if (event.kind === 'up') {
      track.up = true;
      if (track.accepted) {
        this.tracks.delete(event.pointer);
        if (track.dragging) {
          const seconds = Math.max(0.001, (event.timestamp - track.start.timestamp) / 1000);
          this.onDragEnd?.(
            (event.x - track.start.x) / seconds,
            (event.y - track.start.y) / seconds,
          );
        } else if (Math.hypot(event.x - track.start.x, event.y - track.start.y) <= this.slop)
          this.onTap?.();
      } else
        track.entry.resolve(
          Math.hypot(event.x - track.start.x, event.y - track.start.y) <= this.slop && !!this.onTap,
        );
    } else if (event.kind === 'cancel') {
      if (!track.accepted) track.entry.resolve(false);
      this.tracks.delete(event.pointer);
    }
  }
  acceptGesture(pointer: number): void {
    const track = this.tracks.get(pointer);
    if (!track) return;
    track.accepted = true;
    if (track.up) {
      this.tracks.delete(pointer);
      if (track.dragging) {
        const seconds = Math.max(0.001, (track.last.timestamp - track.start.timestamp) / 1000);
        this.onDragEnd?.(
          (track.last.x - track.start.x) / seconds,
          (track.last.y - track.start.y) / seconds,
        );
      } else this.onTap?.();
    }
  }
  rejectGesture(pointer: number): void {
    this.tracks.delete(pointer);
  }
  dispose(): void {
    this.closed = true;
    const snapshot = [...this.tracks.values()];
    for (const track of snapshot) if (!track.accepted) track.entry.resolve(false);
    this.tracks.clear();
  }
}
