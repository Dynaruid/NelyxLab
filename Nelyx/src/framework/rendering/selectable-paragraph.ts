// SPDX-License-Identifier: BSD-3-Clause
import { RenderParagraph, captureRichParagraphConfiguration } from './paragraph.ts';
import type { RichParagraphConfiguration } from './paragraph.ts';
import type { ParagraphContext } from '../../ui/paragraph.ts';
import { TextSpan } from '../painting/text-span.ts';
import { TextSelection } from '../../services/text-editing.ts';
import { Paint } from '../../ui/paint.ts';
import { invariant } from '../../foundation/errors.ts';
import type { TextSelectionController } from '../painting/text-selection-controller.ts';
import {
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
  PointerCancelEvent,
} from '../gestures/events.ts';
import type { PointerEvent } from '../gestures/events.ts';
import type { HitTestEntry } from '../gestures/hit-test.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';
import type { KeyEvent } from '../../ui/input.ts';
import type { BoxConstraints } from './constraints.ts';
import type { Size } from '../../ui/geometry.ts';
import type { PaintingContext } from '../painting/context.ts';
import type { GestureArenaManager, GestureArenaMember } from '../gestures/arena.ts';
interface Drag {
  readonly start: PointerEvent;
  readonly anchor: number;
  focus: number;
  won: boolean;
  up: boolean;
  resolve(accepted: boolean): void;
}
/** Mouse/pen selection and horizontal touch drag, sharing the scroll arena. */
export class RenderSelectableParagraph extends RenderParagraph implements GestureArenaMember {
  private readonly release: () => void;
  private readonly drags = new Map<number, Drag>();
  private textSnapshot: string;
  private preferredX: number | undefined;
  private movingSelection = false;
  requestFocus: () => void = () => {};
  constructor(
    configuration: RichParagraphConfiguration,
    context: ParagraphContext,
    readonly controller: TextSelectionController,
    private readonly arena: GestureArenaManager,
  ) {
    configuration = captureRichParagraphConfiguration(configuration);
    super(
      configuration.span,
      {
        ...configuration.painterOptions,
        ...configuration.paragraphOptions,
        textDirection: configuration.painterOptions?.textDirection ?? 'ltr',
        baseStyle: configuration.style,
        textScaler: configuration.scaler,
        devicePixelRatio: configuration.scale,
      },
      context,
      configuration,
    );
    invariant(
      configuration.span.toPlainText({ includeSemanticsLabels: false }) === controller.text,
      'selection-text-mismatch',
      'Selectable paragraph text must match its controller',
    );
    this.selectionColor = 0x667aaaff;
    this.textSnapshot = controller.text;
    this.release = controller.attach(this);
    controller.addListener(this.changed);
  }
  private readonly changed = () => {
    if (this.debugDisposed) return;
    if (!this.movingSelection) this.preferredX = undefined;
    if (this.textSnapshot !== this.controller.text) {
      this.preferredX = undefined;
      this.cancelDrags();
      this.textSnapshot = this.controller.text;
      this.text = new TextSpan({ text: this.textSnapshot, style: this.text.style });
      if (this.semantics) this.semantics = { ...this.semantics, name: this.textSnapshot };
    }
    this.markNeedsPaint();
  };
  private position(event: PointerEvent): number {
    this.ensureTextLayout();
    return this.painter.getGraphemePositionForOffset(event.localPosition).offset;
  }
  /** Arena membership follows a source contact, not a reused native device id. */
  override handleEvent(event: PointerEvent, _entry: HitTestEntry): void {
    this.pointer(event);
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    this.preferredX = undefined;
    return super.performLayout(constraints);
  }
  /** Logical character/word movement; visual bidi traversal is a separate contract. */
  handleSelectionKey(event: KeyEvent): boolean {
    if (event.kind !== 'down' || event.alt || !this.attached || !this.paragraph || this.needsLayout)
      return false;
    this.ensureTextLayout();
    const key = event.key,
      range = this.controller.selection,
      text = this.controller.text,
      backward = key === 'ArrowLeft',
      forward = key === 'ArrowRight';
    let position = range.focus;
    if (
      (backward || forward) &&
      !event.meta &&
      !(!event.shift && range.anchor !== range.focus && !event.control) &&
      !(event.control ? this.painter.hasWordBoundarySupport : this.painter.hasGlyphBoundarySupport)
    )
      return false;
    if ((key === 'ArrowUp' || key === 'ArrowDown') && !this.painter.hasGlyphBoundarySupport)
      return false;
    if (backward || forward) {
      const direction = backward === (this.textDirection !== 'rtl') ? 'backward' : 'forward';
      if (!event.shift && range.anchor !== range.focus && !event.control && !event.meta)
        position =
          direction === 'backward'
            ? Math.min(range.anchor, range.focus)
            : Math.max(range.anchor, range.focus);
      else if (event.meta) position = direction === 'backward' ? 0 : text.length;
      else if (event.control) {
        if (direction === 'backward' && position > 0)
          position = this.painter.getWordBoundary({
            offset: this.painter.getOffsetBefore(position)!,
          }).start;
        else if (direction === 'forward' && position < text.length)
          position = this.painter.getWordBoundary({ offset: position }).end;
      } else {
        const next = this.painter.getGraphemeOffset(position, direction);
        if (next === null) return false;
        position = next;
      }
    } else if (key === 'Home' || key === 'End') {
      const boundary =
        event.control || event.meta
          ? { start: 0, end: text.length }
          : this.painter.getLineBoundary({ offset: position });
      position = key === 'Home' ? boundary.start : boundary.end;
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      if (event.control || event.meta) return false;
      const lines = this.paragraph.lines;
      let index = lines.findIndex((line) => position >= line.start && position < line.end);
      if (index < 0)
        for (let i = 0; i < lines.length; i++) if (lines[i]!.start <= position) index = i;
      if (index < 0) return false;
      const target = lines[index + (key === 'ArrowUp' ? -1 : 1)];
      if (!target) position = key === 'ArrowUp' ? 0 : text.length;
      else {
        if (this.preferredX === undefined) {
          const glyph = position < text.length ? this.painter.getGlyphInfoAt(position) : null,
            previous = !glyph && position > 0 ? this.painter.getGlyphInfoAt(position - 1) : null;
          this.preferredX = glyph
            ? glyph.bounds.x + (glyph.direction === 'rtl' ? glyph.bounds.width : 0)
            : previous
              ? previous.bounds.x + (previous.direction === 'ltr' ? previous.bounds.width : 0)
              : lines[index]!.bounds.x;
        }
        position = this.painter.getGraphemePositionForOffset({
          x: this.preferredX + this.paintOffsetX,
          y: target.bounds.y + target.bounds.height / 2,
        }).offset;
      }
    } else return false;
    if (key !== 'ArrowUp' && key !== 'ArrowDown') this.preferredX = undefined;
    this.movingSelection = true;
    try {
      this.controller.selection = {
        anchor: event.shift ? range.anchor : position,
        focus: position,
      };
    } finally {
      this.movingSelection = false;
    }
    return true;
  }
  private update(drag: Drag): void {
    this.controller.selection = { anchor: drag.anchor, focus: drag.focus };
  }
  private pointer(event: PointerEvent): void {
    if (!this.paragraph || this.needsLayout) return;
    if (event instanceof PointerDownEvent) {
      if (this.drags.size || (event.buttons !== 0 && (event.buttons & 1) === 0)) return;
      this.preferredX = undefined;
      const position = this.position(event),
        entry = this.arena.add(event.pointer, this),
        drag: Drag = {
          start: event,
          anchor: position,
          focus: position,
          won: false,
          up: false,
          resolve: (accepted) => entry.resolve(accepted),
        };
      this.drags.set(event.pointer, drag);
      if (event.kind !== PointerDeviceKind.touch) entry.resolve(true);
      return;
    }
    const drag = this.drags.get(event.pointer);
    if (!drag) return;
    if (event instanceof PointerCancelEvent) {
      drag.resolve(false);
      this.drags.delete(event.pointer);
      return;
    }
    if (!(event instanceof PointerMoveEvent) && !(event instanceof PointerUpEvent)) return;
    drag.focus = this.position(event);
    if (event instanceof PointerMoveEvent && !drag.won) {
      const dx = Math.abs(event.localPosition.dx - drag.start.localPosition.dx),
        dy = Math.abs(event.localPosition.dy - drag.start.localPosition.dy);
      if (Math.hypot(dx, dy) > 12) drag.resolve(dx > dy);
    }
    if (event instanceof PointerUpEvent) {
      drag.up = true;
      if (!drag.won) drag.resolve(true);
    }
    if (drag.won) {
      this.update(drag);
      if (drag.up) this.drags.delete(event.pointer);
    }
  }
  acceptGesture(pointer: number): void {
    const drag = this.drags.get(pointer);
    if (!drag) return;
    drag.won = true;
    this.requestFocus();
    this.update(drag);
    if (drag.up) this.drags.delete(pointer);
  }
  rejectGesture(pointer: number): void {
    this.drags.delete(pointer);
  }
  private cancelDrags(): void {
    const snapshot = [...this.drags.values()];
    for (const drag of snapshot) drag.resolve(false);
    this.drags.clear();
  }
  override detach(): void {
    this.preferredX = undefined;
    this.cancelDrags();
    super.detach();
  }
  protected override paintLocal(context: PaintingContext): void {
    if (!this.paragraph) return;
    this.ensureTextLayout();
    context.save();
    try {
      context.clip({ x: 0, y: 0, ...this.size });
      if (this.selectionColor !== null) {
        const range = this.controller.selection,
          selection = new TextSelection({ baseOffset: range.anchor, extentOffset: range.focus }),
          paint = new Paint({ color: this.selectionColor });
        for (const box of this.getBoxesForSelection(selection))
          context.canvas.drawRect(box.toRect(), paint);
      }
      super.paintLocal(context);
    } finally {
      context.restore();
    }
  }
  override dispose(): void {
    if (this.debugDisposed) return;
    const errors: unknown[] = [];
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    } finally {
      if (this.debugDisposed) {
        this.controller.removeListener(this.changed);
        this.cancelDrags();
        this.release();
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Selectable paragraph teardown failed');
  }
}
