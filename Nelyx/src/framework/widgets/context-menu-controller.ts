// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed widgets/context_menu_controller.dart at the pinned Flutter revision.
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { Element, InheritedWidget, State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import { InheritedTheme } from './inherited-theme.ts';
import { Builder, ColoredBox } from './basic.ts';
import { Directionality, Localizations } from './app-data.ts';
import { ExcludeFocus } from './focus-scope.ts';
import type { FocusNode, KeyEventResult } from './focus.ts';
import type { KeyEvent } from '../../ui/input.ts';

export function isContextMenuKey(event: KeyEvent): boolean {
  return (
    event.kind === 'down' &&
    !event.repeat &&
    !event.control &&
    !event.alt &&
    !event.meta &&
    (event.key === 'ContextMenu' || event.key === 'Menu' || (event.shift && event.key === 'F10'))
  );
}

export class ContextMenuController {
  private builder: ((context: BuildContext) => Widget) | null = null;
  private releaseKeys: (() => void) | null = null;
  private readonly items = new Set<ContextMenuButtonFocusState>();
  private activeItem: ContextMenuButtonFocusState | null = null;
  private direction: 'ltr' | 'rtl' = 'ltr';
  private static shownInstance: ContextMenuController | null = null;
  private static entry: OverlayEntry | null = null;
  readonly onRemove: (() => void) | null;
  constructor({ onRemove = null }: { readonly onRemove?: (() => void) | null } = {}) {
    this.onRemove = onRemove;
  }
  show({
    context,
    contextMenuBuilder,
    focusNode,
    debugRequiredFor: _debugRequiredFor,
  }: {
    readonly context: BuildContext;
    readonly contextMenuBuilder: (context: BuildContext) => Widget;
    readonly focusNode?: FocusNode | null;
    readonly debugRequiredFor?: Widget | null;
  }): void {
    const overlay = Overlay.of(context, { rootOverlay: true });
    const themes = InheritedTheme.capture(context, overlay.context);
    const direction = (this.direction = Directionality.maybeOf(context) ?? 'ltr');
    const localizations = context.maybeDependOn(Localizations);
    this.builder = () => {
      const child = new Directionality(
        direction,
        new ContextMenuScope(this, new Builder((buildContext) => contextMenuBuilder(buildContext))),
      );
      return themes.wrap(localizations?.wrap(child) ?? child);
    };
    if (this.isShown && ContextMenuController.entry?.overlay === overlay) {
      ContextMenuController.entry?.markNeedsBuild();
      return;
    }
    const builder = this.builder;
    ContextMenuController.removeAny();
    if (ContextMenuController.shownInstance !== null) return;
    this.builder = builder;
    const entry = new OverlayEntry({
      builder: (buildContext) => (this.builder ?? builder)(buildContext),
    });
    ContextMenuController.entry = entry;
    ContextMenuController.shownInstance = this;
    try {
      overlay.insert(entry);
      if (context instanceof Element && focusNode) {
        const manager = context.owner.focus;
        const handle = (event: KeyEvent): KeyEventResult =>
          focusNode.hasPrimaryFocus ? this.handleKey(event) : 'ignored';
        manager.addEarlyKeyEventHandler(handle);
        this.releaseKeys = () => manager.removeEarlyKeyEventHandler(handle);
      }
    } catch (error) {
      ContextMenuController.entry = null;
      this.builder = null;
      ContextMenuController.shownInstance = null;
      try {
        entry.dispose();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Context menu insertion and rollback failed');
      }
      throw error;
    }
  }
  static removeAny(): void {
    const entry = ContextMenuController.entry,
      shown = ContextMenuController.shownInstance;
    // Retire the old owner before application callbacks can show a replacement.
    ContextMenuController.entry = null;
    ContextMenuController.shownInstance = null;
    const errors: unknown[] = [];
    if (shown) {
      shown.builder = null;
      shown.activeItem = null;
      shown.items.clear();
      try {
        shown.releaseKeys?.();
      } catch (error) {
        errors.push(error);
      }
      shown.releaseKeys = null;
    }
    if (entry !== null) {
      if (entry.overlay !== null)
        try {
          entry.remove();
        } catch (error) {
          errors.push(error);
        }
      try {
        entry.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      shown?.onRemove?.();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Context menu retirement failed');
  }
  get isShown(): boolean {
    return (
      ContextMenuController.shownInstance === this && ContextMenuController.entry?.overlay != null
    );
  }
  markNeedsBuild(): void {
    if (FoundationBuildMode.debug)
      invariant(
        this.isShown,
        'hidden-context-menu',
        'Context menu must be shown before marking it dirty',
      );
    if (this.isShown) ContextMenuController.entry?.markNeedsBuild();
  }
  remove(): void {
    if (ContextMenuController.shownInstance === this) ContextMenuController.removeAny();
  }
  /** @internal Registers a button in overlay build order. */
  registerButton(item: ContextMenuButtonFocusState): void {
    this.items.add(item);
  }
  /** @internal */
  unregisterButton(item: ContextMenuButtonFocusState): void {
    this.items.delete(item);
    if (this.activeItem === item) this.activeItem = null;
  }
  private handleKey(event: KeyEvent): KeyEventResult {
    if (!this.isShown || event.kind !== 'down' || event.alt || event.control || event.meta)
      return 'ignored';
    if (event.key === 'Escape' || event.key === 'Esc') {
      this.remove();
      return 'handled';
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      if (this.activeItem?.isNavigable) {
        if (!event.repeat) this.activeItem.activateButton();
        return 'handled';
      }
      return 'ignored';
    }
    const forward = this.direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight',
      backward = this.direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const step =
      event.key === 'Tab'
        ? event.shift
          ? -1
          : 1
        : event.key === forward || event.key === 'ArrowDown'
          ? 1
          : event.key === backward || event.key === 'ArrowUp'
            ? -1
            : 0;
    if (step === 0) return 'ignored';
    const buttons = [...this.items].filter((item) => item.isNavigable);
    if (!buttons.length) return 'ignored';
    const index = this.activeItem ? buttons.indexOf(this.activeItem) : -1;
    const next =
      buttons[(Math.max(index, step < 0 ? 0 : -1) + step + buttons.length) % buttons.length]!;
    this.activeItem?.highlight(false);
    this.activeItem = next;
    next.highlight(true);
    return 'handled';
  }
}

class ContextMenuScope extends InheritedWidget {
  constructor(
    readonly controller: ContextMenuController,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.controller !== this.controller;
  }
}

/** Keeps the owner's native text connection focused while navigating menu buttons. */
export class ContextMenuButtonFocus extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly onPressed: (() => void) | null,
  ) {
    super();
  }
  createState(): State<ContextMenuButtonFocus> {
    return new ContextMenuButtonFocusState();
  }
}

class ContextMenuButtonFocusState extends State<ContextMenuButtonFocus> {
  private controller: ContextMenuController | null = null;
  private highlighted = false;
  get isNavigable(): boolean {
    return (
      this.mounted &&
      this.widget.onPressed !== null &&
      (this.context.findRenderObject()?.isDisplayed ?? false)
    );
  }
  override didChangeDependencies(): void {
    const controller = this.context.maybeDependOn(ContextMenuScope)?.controller ?? null;
    if (controller === this.controller) return;
    this.controller?.unregisterButton(this);
    this.controller = controller;
    controller?.registerButton(this);
  }
  override dispose(): void {
    this.controller?.unregisterButton(this);
    super.dispose();
  }
  activateButton(): void {
    this.widget.onPressed?.();
  }
  highlight(value: boolean): void {
    if (this.mounted && this.highlighted !== value)
      this.setState(() => {
        this.highlighted = value;
      });
  }
  build(): Widget {
    if (!this.controller) return this.widget.child;
    return new ExcludeFocus(
      new ColoredBox({
        color: this.highlighted && this.widget.onPressed ? 0x332196f3 : 0x00000000,
        child: this.widget.child,
      }),
    );
  }
}
