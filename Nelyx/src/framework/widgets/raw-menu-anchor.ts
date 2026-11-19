// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '../../foundation/errors.ts';
import { bounds } from '../../ui/geometry.ts';
import type { Size } from '../../ui/geometry.ts';
import type { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { RenderBox } from '../rendering/object.ts';
import { HitTestBehavior } from '../rendering/pointer-listener.ts';
import { DismissAction } from './actions.ts';
import type { DismissIntent } from './actions.ts';
import { Directionality, MediaQuery } from './app-data.ts';
import { Builder, SizedBox } from './basic.ts';
import type { FocusNode } from './focus.ts';
import { Element, InheritedWidget, State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { GlobalKey } from './global-key.ts';
import { InheritedTheme } from './inherited-theme.ts';
import { LayoutBuilder } from './layout-builder.ts';
import { LocalHistoryEntry, Navigator, isCurrentRoute, routeTokenOf } from './navigation.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import type { OverlayState } from './overlay.ts';
import type { ScrollPosition } from './scroll-position.ts';
import { Scrollable } from './scrollable.ts';
import { TapRegion } from './tap-region.ts';

export interface RawMenuOverlayInfoOptions {
  readonly anchorRect: Rect;
  readonly overlaySize: Size;
  readonly tapRegionGroupId: object;
  readonly position?: Offset | null;
}

export class RawMenuOverlayInfo {
  readonly anchorRect: Rect;
  readonly overlaySize: Size;
  readonly tapRegionGroupId: object;
  readonly position: Offset | null;
  constructor({
    anchorRect,
    overlaySize,
    tapRegionGroupId,
    position = null,
  }: RawMenuOverlayInfoOptions) {
    this.anchorRect = anchorRect;
    this.overlaySize = overlaySize;
    this.tapRegionGroupId = tapRegionGroupId;
    this.position = position;
  }
}

export type RawMenuAnchorOverlayBuilder = (
  context: BuildContext,
  info: RawMenuOverlayInfo,
) => Widget;
export type RawMenuAnchorChildBuilder = (
  context: BuildContext,
  controller: MenuController,
  child: Widget | null,
) => Widget;
export type RawMenuAnchorOpenRequestedCallback = (
  position: Offset | null,
  showOverlay: () => void,
) => void;
export type RawMenuAnchorCloseRequestedCallback = (hideOverlay: () => void) => void;

const attached = new WeakMap<MenuController, MenuBranch>();

export class MenuController {
  get isOpen(): boolean {
    return attached.get(this)?.isOpen ?? false;
  }
  open({ position = null }: { readonly position?: Offset | null } = {}): void {
    const anchor = attached.get(this);
    invariant(
      anchor,
      'unattached-menu-controller',
      'Attach the MenuController before opening a menu',
    );
    anchor.open(position);
  }
  close(): void {
    attached.get(this)?.close();
  }
  closeChildren(): void {
    const anchor = attached.get(this);
    invariant(
      anchor,
      'unattached-menu-controller',
      'Attach the MenuController before closing submenus',
    );
    anchor.closeChildren();
  }
  static maybeOf(context: BuildContext): MenuController | null {
    const element = context.getElementForInheritedWidgetOfExactType(MenuControllerScope);
    return (element?.widget as MenuControllerScope | undefined)?.branch.controller ?? null;
  }
  static maybeIsOpenOf(context: BuildContext): boolean | null {
    return context.maybeDependOn(MenuControllerScope)?.isOpen ?? null;
  }
}

/** Closes the menu tree containing a leaf action. */
export function dismissMenu(controller: MenuController): void {
  attached.get(controller)?.root.close();
}

export class DismissMenuAction extends DismissAction {
  constructor({ controller }: { readonly controller: MenuController }) {
    super();
    this.controller = controller;
  }
  readonly controller: MenuController;
  override invoke(_intent: DismissIntent): void {
    dismissMenu(this.controller);
  }
  override isEnabled(_intent: DismissIntent): boolean {
    return attached.has(this.controller);
  }
}

interface MenuBranch {
  readonly controller: MenuController;
  readonly root: MenuBranch;
  readonly isOpen: boolean;
  readonly children: Set<MenuBranch>;
  readonly overlay: OverlayState | null;
  open(position: Offset | null): void;
  close(): void;
  closeChildren(): void;
  changed(): void;
}

class MenuControllerScope extends InheritedWidget {
  readonly controller: MenuController;
  readonly isOpen: boolean;
  constructor(
    readonly branch: MenuBranch,
    child: Widget,
  ) {
    super(child);
    this.controller = branch.controller;
    this.isOpen = branch.isOpen;
  }
  override updateShouldNotify(old: MenuControllerScope): boolean {
    return (
      this.branch !== old.branch || this.controller !== old.controller || this.isOpen !== old.isOpen
    );
  }
}

abstract class MenuBranchState<W extends StatefulWidget & { readonly controller: MenuController }>
  extends State<W>
  implements MenuBranch
{
  readonly children = new Set<MenuBranch>();
  protected parent: MenuBranch | null = null;
  abstract get isOpen(): boolean;
  abstract get overlay(): OverlayState | null;
  abstract open(position: Offset | null): void;
  abstract close(): void;

  get controller(): MenuController {
    return this.widget.controller;
  }
  get root(): MenuBranch {
    return this.parent?.root ?? this;
  }
  private attachController(controller: MenuController): void {
    invariant(
      !attached.has(controller),
      'duplicate-menu-controller',
      'A MenuController can own one menu',
    );
    attached.set(controller, this);
  }
  override initState(): void {
    super.initState();
    this.attachController(this.controller);
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const next = this.context.maybeDependOn(MenuControllerScope)?.branch ?? null;
    if (next !== this.parent) {
      this.parent?.children.delete(this);
      this.parent = next;
      next?.children.add(this);
    }
  }
  override didUpdateWidget(old: W): void {
    super.didUpdateWidget(old);
    if (old.controller !== this.controller) {
      this.attachController(this.controller);
      attached.delete(old.controller);
    }
  }
  runAfterBuild(operation: () => void): void {
    const owner = (this.context as Element).owner;
    if (owner.building)
      owner.postFrame(() => {
        if (this.mounted && this.context.mounted) operation();
      });
    else operation();
  }
  changed(): void {
    this.runAfterBuild(() => {
      if (this.mounted) this.setState(() => {});
    });
    this.parent?.changed();
  }
  closeChildren(): void {
    for (const child of [...this.children]) child.close();
  }
  override dispose(): void {
    this.parent?.children.delete(this);
    if (attached.get(this.controller) === this) attached.delete(this.controller);
    super.dispose();
  }
}

export interface RawMenuAnchorOptions extends WidgetOptions {
  readonly controller: MenuController;
  readonly overlayBuilder: RawMenuAnchorOverlayBuilder;
  readonly child?: Widget | null;
  readonly builder?: RawMenuAnchorChildBuilder | null;
  readonly childFocusNode?: FocusNode | null;
  readonly restoreFocusOnClose?: boolean;
  readonly consumeOutsideTaps?: boolean;
  readonly useRootOverlay?: boolean;
  readonly onOpen?: (() => void) | null;
  readonly onClose?: (() => void) | null;
  readonly onOpenRequested?: RawMenuAnchorOpenRequestedCallback;
  readonly onCloseRequested?: RawMenuAnchorCloseRequestedCallback;
}

export class RawMenuAnchor extends StatefulWidget {
  readonly options: Readonly<RawMenuAnchorOptions>;
  constructor(options: RawMenuAnchorOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  get controller(): MenuController {
    return this.options.controller;
  }
  override createState(): State<RawMenuAnchor> {
    return new RawMenuAnchorState();
  }
}

class RawMenuAnchorState extends MenuBranchState<RawMenuAnchor> {
  private readonly key = new GlobalKey('Menu anchor bounds');
  private entry: OverlayEntry | null = null;
  private history: LocalHistoryEntry | null = null;
  private position: Offset | null = null;
  private scroll: ScrollPosition | null = null;
  private viewSize: Size | null = null;
  private requestVersion = 0;
  private closing = false;

  override get overlay(): OverlayState | null {
    return (
      this.entry?.overlay ??
      this.parent?.overlay ??
      Overlay.maybeOf(this.context, { rootOverlay: this.widget.options.useRootOverlay ?? false })
    );
  }
  override get isOpen(): boolean {
    return this.entry?.overlay != null;
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const next = Scrollable.maybeOf(this.context)?.position ?? null;
    if (next !== this.scroll) {
      this.scroll?.removeListener(this.ancestorMoved);
      this.scroll = next;
      next?.addListener(this.ancestorMoved);
    }
    const media = this.context.maybeDependOn(MediaQuery)?.data;
    if (
      media &&
      this.viewSize &&
      (media.width !== this.viewSize.width || media.height !== this.viewSize.height)
    )
      this.close();
    this.viewSize = media ? { width: media.width, height: media.height } : null;
    if (!isCurrentRoute(this.context)) this.close();
    this.entry?.markNeedsBuild();
  }
  override didUpdateWidget(old: RawMenuAnchor): void {
    super.didUpdateWidget(old);
    this.entry?.markNeedsBuild();
  }
  private readonly ancestorMoved = () => this.close();
  private readonly outside = () => this.root.close();

  override open(position: Offset | null): void {
    const version = ++this.requestVersion;
    this.closing = false;
    const show = () =>
      this.runAfterBuild(() => {
        if (version === this.requestVersion && this.mounted && isCurrentRoute(this.context))
          this.show(position);
      });
    const requested = this.widget.options.onOpenRequested;
    if (requested) requested(position, show);
    else show();
  }

  private show(position: Offset | null): void {
    for (const sibling of this.parent?.children ?? []) if (sibling !== this) sibling.close();
    this.position = position;
    if (this.entry) {
      this.entry.markNeedsBuild();
      return;
    }
    const overlay = this.overlay;
    invariant(overlay, 'missing-menu-overlay', 'RawMenuAnchor requires an Overlay ancestor');
    const themes = InheritedTheme.capture(this.context, overlay.context);
    const direction = Directionality.maybeOf(this.context);
    const entry = new OverlayEntry({
      builder: () => {
        const building = new LayoutBuilder((context, constraints) => {
          const anchorElement = this.key.currentElement;
          const overlayElement = overlay.context as Element;
          if (!anchorElement?.active || !overlayElement.active) return new SizedBox();
          const anchor = anchorElement.findRenderObject();
          const host = overlayElement.findRenderObject();
          if (
            !(anchor instanceof RenderBox) ||
            !anchor.attached ||
            !anchor.hasSize ||
            !host?.attached
          )
            return new SizedBox();
          const rect = bounds(anchor.getTransformTo(host), anchor.size);
          const panel = this.widget.options.overlayBuilder(
            context,
            new RawMenuOverlayInfo({
              anchorRect: Rect.fromLTWH(rect.x, rect.y, rect.width, rect.height),
              overlaySize: { width: constraints.maxWidth, height: constraints.maxHeight },
              position: this.position,
              tapRegionGroupId: this.root.controller,
            }),
          );
          return new MenuControllerScope(this, panel);
        });
        return themes.wrap(direction ? new Directionality(direction, building) : building);
      },
    });
    overlay.insert(entry);
    this.entry = entry;
    this.addHistory();
    this.widget.options.childFocusNode?.requestFocus();
    this.changed();
    this.widget.options.onOpen?.();
  }

  private addHistory(): void {
    if (this.root !== this && this.parent?.overlay === this.entry?.overlay) return;
    const navigator = Navigator.maybeOf(this.context);
    const token = routeTokenOf(this.context);
    if (navigator && token) {
      const entry = new LocalHistoryEntry({
        impliesAppBarDismissal: false,
        onRemove: () => {
          if (this.history === entry) this.close();
        },
      });
      navigator.addLocalHistoryEntry(token, entry);
      this.history = entry;
    }
  }

  override close(): void {
    if (this.closing) return;
    const version = ++this.requestVersion;
    if (!this.entry) return;
    this.closing = true;
    this.closeChildren();
    this.runAfterBuild(() => {
      if (version !== this.requestVersion) return;
      const hide = () =>
        this.runAfterBuild(() => {
          if (version === this.requestVersion && this.mounted) this.hide(true);
        });
      const requested = this.widget.options.onCloseRequested;
      if (requested) requested(hide);
      else hide();
    });
  }

  private hide(notify: boolean): void {
    const entry = this.entry;
    this.entry = null;
    this.closing = false;
    if (!entry) return;
    if (entry.overlay) entry.remove();
    entry.dispose();
    const history = this.history;
    this.history = null;
    history?.remove();
    if (notify) {
      if (this.widget.options.restoreFocusOnClose !== false && isCurrentRoute(this.context))
        this.widget.options.childFocusNode?.requestFocus();
      this.changed();
      this.widget.options.onClose?.();
    }
  }

  override build(): Widget {
    const { builder, child = null, consumeOutsideTaps = false } = this.widget.options;
    return new MenuControllerScope(
      this,
      new TapRegion(
        new Builder(
          (context) => builder?.(context, this.controller, child) ?? child ?? new SizedBox(),
          { key: this.key },
        ),
        {
          behavior: HitTestBehavior.translucent,
          groupId: this.root.controller,
          consumeOutsideTaps: this.root.isOpen && consumeOutsideTaps,
          onTapOutside: this.outside,
        },
      ),
    );
  }

  override dispose(): void {
    ++this.requestVersion;
    this.scroll?.removeListener(this.ancestorMoved);
    this.hide(false);
    super.dispose();
  }

  override deactivate(): void {
    ++this.requestVersion;
    this.hide(false);
    super.deactivate();
  }
}

export class RawMenuAnchorGroup extends StatefulWidget {
  readonly child: Widget;
  readonly controller: MenuController;
  constructor({
    child,
    controller,
    key = null,
  }: WidgetOptions & { readonly child: Widget; readonly controller: MenuController }) {
    super(key);
    this.child = child;
    this.controller = controller;
  }
  override createState(): State<RawMenuAnchorGroup> {
    return new RawMenuAnchorGroupState();
  }
}

class RawMenuAnchorGroupState extends MenuBranchState<RawMenuAnchorGroup> {
  override get isOpen(): boolean {
    return [...this.children].some((child) => child.isOpen);
  }
  override get overlay(): OverlayState | null {
    return this.parent?.overlay ?? null;
  }
  override open(_position: Offset | null): void {}
  override close(): void {
    this.closeChildren();
  }
  override build(): Widget {
    return new MenuControllerScope(this, this.widget.child);
  }
}
