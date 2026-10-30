// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Pinned web_ui engine/mouse/cursor.dart map and default removal behavior.
const styles: Readonly<Record<string, string>> = Object.freeze({
  alias: 'alias',
  allScroll: 'all-scroll',
  basic: 'default',
  cell: 'cell',
  click: 'pointer',
  contextMenu: 'context-menu',
  copy: 'copy',
  forbidden: 'not-allowed',
  grab: 'grab',
  grabbing: 'grabbing',
  help: 'help',
  move: 'move',
  none: 'none',
  noDrop: 'no-drop',
  precise: 'crosshair',
  progress: 'progress',
  text: 'text',
  resizeColumn: 'col-resize',
  resizeDown: 's-resize',
  resizeDownLeft: 'sw-resize',
  resizeDownRight: 'se-resize',
  resizeLeft: 'w-resize',
  resizeLeftRight: 'ew-resize',
  resizeRight: 'e-resize',
  resizeRow: 'row-resize',
  resizeUp: 'n-resize',
  resizeUpDown: 'ns-resize',
  resizeUpLeft: 'nw-resize',
  resizeUpRight: 'ne-resize',
  resizeUpLeftDownRight: 'nwse-resize',
  resizeUpRightDownLeft: 'nesw-resize',
  verticalText: 'vertical-text',
  wait: 'wait',
  zoomIn: 'zoom-in',
  zoomOut: 'zoom-out',
});
interface Target {
  readonly value: string;
  readonly priority: string;
  applied?: string;
}
/** One app's canvas and actual published DOM controls; never a document singleton. */
export class BrowserMouseCursor {
  private readonly targets = new Map<HTMLElement, Target>();
  private live = true;
  private active: string | undefined;
  constructor(readonly canvas: HTMLElement) {
    this.add(canvas);
  }
  add(element: HTMLElement): void {
    if (!this.live) throw new Error('Browser cursor owner is closed');
    if (element.ownerDocument !== this.canvas.ownerDocument)
      throw new Error('Cursor target belongs to a different View document');
    if (!this.targets.has(element))
      this.targets.set(element, {
        value: element.style.getPropertyValue('cursor'),
        priority: element.style.getPropertyPriority('cursor'),
      });
    this.apply(element);
  }
  remove(element: HTMLElement): void {
    const target = this.targets.get(element);
    if (!target) return;
    this.targets.delete(element);
    this.restore(element, target);
  }
  activate(kind: string): void {
    if (!this.live) throw new Error('Browser cursor owner is closed');
    this.active = Object.hasOwn(styles, kind) ? styles[kind]! : 'default';
    for (const element of this.targets.keys()) this.apply(element);
  }
  private apply(element: HTMLElement): void {
    if (this.active === undefined) return;
    const target = this.targets.get(element)!;
    target.applied = this.active === 'default' ? '' : this.active;
    if (target.applied === '') element.style.removeProperty('cursor');
    else element.style.setProperty('cursor', target.applied);
  }
  private restore(element: HTMLElement, target: Target): void {
    if (
      target.applied === undefined ||
      element.style.getPropertyValue('cursor') !== target.applied ||
      element.style.getPropertyPriority('cursor') !== ''
    )
      return;
    if (target.value) element.style.setProperty('cursor', target.value, target.priority);
    else element.style.removeProperty('cursor');
  }
  dispose(): void {
    if (!this.live) return;
    this.live = false;
    const targets = [...this.targets];
    this.targets.clear();
    for (const [element, target] of targets) this.restore(element, target);
  }
}
