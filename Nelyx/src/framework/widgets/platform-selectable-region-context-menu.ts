// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source Web selection callback; HtmlElementView is adapted to a View-owned DOM capability.
import { StatelessWidget, RenderObjectWidget, Element } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import { invariant } from '../../foundation/errors.ts';
import type {
  NativeSelectionContextMenuHost,
  NativeSelectionContextMenuBinding,
  NativeSelectionContextMenuGeometry,
  RegisterSelectionViewFactory,
} from '../../hosting/interaction.ts';
import type { ViewOwner } from '../../ui/types.ts';
import { sameOwner } from '../../ui/frame.ts';
import { RenderProxyBox } from '../rendering/boxes.ts';
import { RenderBox } from '../rendering/object.ts';
import type { PipelineOwner, HitTestEntry } from '../rendering/object.ts';
import type { PaintingContext } from '../painting/context.ts';
import type { SelectionContainerDelegate } from './selection-container.ts';
import { SelectWordSelectionEvent } from '../rendering/selection.ts';
import { MatrixUtils } from '../painting/matrix-utils.ts';
import { Offset } from '../../ui/offset.ts';

const requireWeb = (): void => {
  if (FoundationPlatform.hostEnvironment.kind !== 'web') {
    const error = new Error('PlatformSelectableRegionContextMenu only supports web');
    error.name = 'UnimplementedError';
    throw error;
  }
};
export type RegisterViewFactory = RegisterSelectionViewFactory;
export class PlatformSelectableRegionContextMenu extends StatelessWidget {
  private static activeClient: SelectionContainerDelegate | null = null;
  private static activeOwner: ViewOwner | null = null;
  private static clientGeneration = 0;
  private static registryGeneration = 0;
  static debugOverrideRegisterViewFactory: RegisterViewFactory | null = null;
  /** Reset registration only; the active selection client remains attached. */
  static debugResetRegistry(): void {
    requireWeb();
    PlatformSelectableRegionContextMenu.registryGeneration++;
  }
  constructor(
    readonly child: Widget,
    { key = null }: WidgetOptions = {},
  ) {
    super(key);
  }
  /** The optional owner prevents cross-View delivery in Nelyx's multiple-View host. */
  static attach(client: SelectionContainerDelegate, owner: ViewOwner | null = null): void {
    requireWeb();
    PlatformSelectableRegionContextMenu.clientGeneration++;
    PlatformSelectableRegionContextMenu.activeClient = client;
    PlatformSelectableRegionContextMenu.activeOwner = owner;
  }
  static detach(client: SelectionContainerDelegate): void {
    requireWeb();
    if (PlatformSelectableRegionContextMenu.activeClient === client) {
      PlatformSelectableRegionContextMenu.clientGeneration++;
      PlatformSelectableRegionContextMenu.activeClient = null;
      PlatformSelectableRegionContextMenu.activeOwner = null;
    }
  }
  static get debugActiveClient(): SelectionContainerDelegate | null {
    requireWeb();
    return PlatformSelectableRegionContextMenu.activeClient;
  }
  private static selectWord(
    localOffset: { readonly x: number; readonly y: number },
    viewOwner: ViewOwner | null = null,
  ): string | null {
    const client = this.activeClient,
      owner = this.activeOwner,
      generation = this.clientGeneration;
    if (client === null || (viewOwner !== null && owner !== null && !sameOwner(owner, viewOwner)))
      return null;
    const globalOffset = MatrixUtils.transformPoint(
      client.getTransformTo(null),
      new Offset(localOffset.x, localOffset.y),
    );
    if (generation !== this.clientGeneration) return null;
    client.dispatchSelectionEvent(new SelectWordSelectionEvent({ globalPosition: globalOffset }));
    if (generation !== this.clientGeneration) return null;
    const text = client.getSelectedContent()?.plainText ?? '';
    return generation === this.clientGeneration ? text : null;
  }
  build(context: BuildContext): Widget {
    requireWeb();
    const host = context.services.nativeSelectionContextMenu;
    invariant(
      host,
      'missing-browser-selection-context-menu',
      'Browser selection requires a synchronous DOM context-menu host',
    );
    // Core has no global document. Registration therefore occurs at the first
    // build with a live DOM capability, and the SDK isolates each document.
    host.registerViewFactory?.({
      generation: PlatformSelectableRegionContextMenu.registryGeneration,
      registerOverride: PlatformSelectableRegionContextMenu.debugOverrideRegisterViewFactory,
      selectWord: (point) => PlatformSelectableRegionContextMenu.selectWord(point),
    });
    return new NativeSelectionOverlay(
      this.child,
      host,
      context.services.owner,
      () => {
        if (context instanceof Element && context.mounted)
          context.owner.focus.applyFocusChangesIfNeeded();
      },
      (localOffset) => {
        const text = PlatformSelectableRegionContextMenu.selectWord(
          localOffset,
          context.services.owner,
        );
        return context instanceof Element && !context.mounted ? null : text;
      },
    );
  }
}

class NativeSelectionOverlay extends RenderObjectWidget {
  constructor(
    readonly child: Widget,
    readonly host: NativeSelectionContextMenuHost,
    readonly owner: ViewOwner,
    readonly prepareFocus: () => void,
    readonly selectWord: (point: { readonly x: number; readonly y: number }) => string | null,
  ) {
    super();
  }
  get childWidgets(): readonly Widget[] {
    return [this.child];
  }
  createRenderObject(): RenderNativeSelectionOverlay {
    return new RenderNativeSelectionOverlay(
      this.host,
      this.owner,
      this.prepareFocus,
      this.selectWord,
    );
  }
  updateRenderObject(_context: BuildContext, object: RenderBox): void {
    const render = object as RenderNativeSelectionOverlay;
    invariant(
      render.host === this.host && sameOwner(render.viewOwner, this.owner),
      'foreign-browser-selection-host',
      'A live native selection binding cannot transfer to another View',
    );
    render.prepareFocus = this.prepareFocus;
    render.selectWord = this.selectWord;
  }
}
class RenderNativeSelectionOverlay extends RenderProxyBox {
  private binding: NativeSelectionContextMenuBinding | null = null;
  private bindingEpoch = 0;
  constructor(
    readonly host: NativeSelectionContextMenuHost,
    readonly viewOwner: ViewOwner,
    public prepareFocus: () => void,
    public selectWord: (point: { readonly x: number; readonly y: number }) => string | null,
  ) {
    super();
  }
  // Like the source HtmlElementView, participate in the hit path even on empty
  // portions of the selection container; higher painted siblings still win.
  protected override hitTestSelf(): boolean {
    return true;
  }
  private geometry(): NativeSelectionContextMenuGeometry | null {
    if (!this.attached || this.debugDisposed || !this.hasSize || this.needsLayout) return null;
    const paintOrder: number[] = [];
    for (
      let node: import('../rendering/object.ts').RenderObject = this;
      node.parent;
      node = node.parent
    )
      paintOrder.unshift(node.parent.children.indexOf(node));
    return {
      width: this.size.width,
      height: this.size.height,
      transform: Array.from(this.getTransformTo(null)),
      paintOrder,
    };
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    if (this.binding !== null) return;
    const epoch = ++this.bindingEpoch;
    const binding = this.host.bind(this.viewOwner, {
      readGeometry: () => this.geometry(),
      selectWord: (point) => {
        if (this.geometry() === null) return null;
        let root: import('../rendering/object.ts').RenderObject = this;
        while (root.parent) root = root.parent;
        if (!(root instanceof RenderBox)) return null;
        const global = this.localToGlobal(point),
          hits: HitTestEntry[] = [];
        root.hitTest(root.globalToLocal(global), hits);
        if (!hits.some((hit) => hit.target === this)) return null;
        this.prepareFocus();
        if (this.geometry() === null) return null;
        return this.selectWord(point);
      },
    });
    if (epoch !== this.bindingEpoch || !this.attached || this.debugDisposed) binding.dispose();
    else this.binding = binding;
  }
  override paint(context: PaintingContext): void {
    this.binding?.update();
    super.paint(context);
  }
  private closeBinding(): void {
    this.bindingEpoch++;
    const binding = this.binding;
    this.binding = null;
    binding?.dispose();
  }
  override detach(): void {
    const errors: unknown[] = [];
    try {
      this.closeBinding();
    } catch (error) {
      errors.push(error);
    }
    try {
      super.detach();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Native selection binding detach failed');
  }
  override dispose(): void {
    const errors: unknown[] = [];
    try {
      this.closeBinding();
    } catch (error) {
      errors.push(error);
    }
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'Native selection binding disposal failed');
  }
}
