// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed control declarations from the pinned widgets/text_selection.dart.
import { FoundationPlatform } from '../../foundation/platform.ts';
import { ContextMenuButtonItem, ContextMenuButtonType } from './context-menu-button-item.ts';
import { SizedBox } from './basic.ts';
import type { Widget, BuildContext } from './framework.ts';
import type { Offset } from '../../ui/offset.ts';
import { Offset as OffsetValue } from '../../ui/offset.ts';
import { Size } from '../../ui/size.ts';
import type { TextSelectionHandleType } from '../rendering/selection.ts';
import { ValueNotifier } from '../../foundation/notifier.ts';
import type { ValueListenable } from '../../foundation/notifier.ts';
import { ServicesBinding } from '../../services/binding.ts';
import type { AppLifecycleState } from '../../services/binding.ts';
import { Clipboard } from '../../services/clipboard.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorDescription } from '../../foundation/diagnostics.ts';
import { ListenableBuilder } from './listenable-builder.ts';
import type { TextSelectionDelegate } from '../../services/text-input.ts';
import { SelectionChangedCause } from '../../services/text-input.ts';
import type { Rect } from '../../ui/rect.ts';
import type { TextSelectionPoint } from '../rendering/editable.ts';
export class ClipboardStatus {
  static readonly pasteable = new ClipboardStatus(0, 'pasteable');
  static readonly unknown = new ClipboardStatus(1, 'unknown');
  static readonly notPasteable = new ClipboardStatus(2, 'notPasteable');
  static readonly values = Object.freeze([this.pasteable, this.unknown, this.notPasteable]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'ClipboardStatus.' + this.name;
  }
}
export interface EditableContextMenuOptions {
  readonly clipboardStatus: ClipboardStatus | null;
  readonly onCopy: (() => void) | null;
  readonly onCut: (() => void) | null;
  readonly onPaste: (() => void) | null;
  readonly onSelectAll: (() => void) | null;
  readonly onLookUp: (() => void) | null;
  readonly onSearchWeb: (() => void) | null;
  readonly onShare: (() => void) | null;
  readonly onLiveTextInput: (() => void) | null;
  readonly showDisabledPaste?: boolean;
  readonly allowUnknownPaste?: boolean;
}
/** Pinned EditableText.getEditableButtonItems, shared by both design packages. */
export function getEditableButtonItems(
  options: EditableContextMenuOptions,
): ContextMenuButtonItem[] {
  const result: ContextMenuButtonItem[] = [],
    {
      clipboardStatus,
      onCopy,
      onCut,
      onPaste,
      onSelectAll,
      onLookUp,
      onSearchWeb,
      onShare,
      onLiveTextInput,
    } = options;
  const add = (callback: (() => void) | null, type: ContextMenuButtonType) => {
    if (callback !== null) result.push(new ContextMenuButtonItem({ onPressed: callback, type }));
  };
  const android = FoundationPlatform.defaultTargetPlatform === 'android';
  add(onCut, ContextMenuButtonType.cut);
  add(onCopy, ContextMenuButtonType.copy);
  if (
    clipboardStatus === null ||
    clipboardStatus === ClipboardStatus.pasteable ||
    (clipboardStatus === ClipboardStatus.unknown && options.allowUnknownPaste)
  ) {
    add(onPaste, ContextMenuButtonType.paste);
  } else if (onPaste !== null && options.showDisabledPaste) {
    result.push(new ContextMenuButtonItem({ onPressed: null, type: ContextMenuButtonType.paste }));
  }
  if (android) add(onShare, ContextMenuButtonType.share);
  add(onSelectAll, ContextMenuButtonType.selectAll);
  add(onLookUp, ContextMenuButtonType.lookUp);
  add(onSearchWeb, ContextMenuButtonType.searchWeb);
  if (!android) add(onShare, ContextMenuButtonType.share);
  add(onLiveTextInput, ContextMenuButtonType.liveTextInput);
  return result;
}
export class ClipboardStatusNotifier extends ValueNotifier<ClipboardStatus> {
  private disposed = false;
  private observation: Disposable | null = null;
  private readonly services: ServicesBinding | undefined;
  /** Explicit ServicesBinding keeps clipboard and lifecycle attached to their application. */
  constructor({
    value = ClipboardStatus.unknown,
    services,
  }: { readonly value?: ClipboardStatus; readonly services?: ServicesBinding } = {}) {
    super(value);
    this.services = services;
  }
  async update(): Promise<void> {
    if (this.disposed) return;
    let hasStrings: boolean;
    try {
      hasStrings = await Clipboard.hasStrings(this.services?.defaultBinaryMessenger);
    } catch (exception) {
      FlutterError.reportError(
        new FlutterErrorDetails({
          exception,
          library: 'widget library',
          context: new ErrorDescription('while checking if the clipboard has strings'),
        }),
      );
      if (!this.disposed) this.value = ClipboardStatus.unknown;
      return;
    }
    if (!this.disposed)
      this.value = hasStrings ? ClipboardStatus.pasteable : ClipboardStatus.notPasteable;
  }
  override addListener(listener: () => void): void {
    this.ensureAlive();
    if (!this.hasListeners)
      this.observation = (this.services ?? ServicesBinding.instance).addObserver(this);
    if (this.value === ClipboardStatus.unknown) void this.update();
    super.addListener(listener);
  }
  override removeListener(listener: () => void): void {
    super.removeListener(listener);
    if (!this.disposed && !this.hasListeners) {
      this.observation?.dispose();
      this.observation = null;
    }
  }
  didChangeAppLifecycleState(state: AppLifecycleState): void {
    if (state === 'resumed') void this.update();
  }
  override dispose(): void {
    this.observation?.dispose();
    this.observation = null;
    this.disposed = true;
    super.dispose();
  }
}
export interface TextSelectionControls {
  /** @deprecated Use contextMenuBuilder. */
  buildToolbar?(
    context: BuildContext,
    globalEditableRegion: Rect,
    textLineHeight: number,
    selectionMidpoint: Offset,
    endpoints: readonly TextSelectionPoint[],
    delegate: TextSelectionDelegate,
    clipboardStatus: ValueListenable<ClipboardStatus> | null,
    lastSecondaryTapDownPosition: Offset | null,
  ): Widget;
}

export abstract class TextSelectionControls {
  abstract buildHandle(
    context: BuildContext,
    type: TextSelectionHandleType,
    textLineHeight: number,
    onTap?: (() => void) | null,
  ): Widget;
  abstract getHandleAnchor(type: TextSelectionHandleType, textLineHeight: number): Offset;
  abstract getHandleSize(textLineHeight: number): Size;

  canCut(delegate: TextSelectionDelegate): boolean {
    return delegate.cutEnabled && !delegate.textEditingValue.selection.isCollapsed;
  }
  canCopy(delegate: TextSelectionDelegate): boolean {
    return delegate.copyEnabled && !delegate.textEditingValue.selection.isCollapsed;
  }
  canPaste(delegate: TextSelectionDelegate): boolean {
    return delegate.pasteEnabled;
  }
  canSelectAll(delegate: TextSelectionDelegate): boolean {
    const { text, selection } = delegate.textEditingValue;
    return delegate.selectAllEnabled && text.length > 0 && selection.isCollapsed;
  }
  handleCut(delegate: TextSelectionDelegate): void {
    delegate.cutSelection(SelectionChangedCause.toolbar);
  }
  handleCopy(delegate: TextSelectionDelegate): void {
    delegate.copySelection(SelectionChangedCause.toolbar);
  }
  handlePaste(delegate: TextSelectionDelegate): Promise<void> {
    return delegate.pasteText(SelectionChangedCause.toolbar);
  }
  handleSelectAll(delegate: TextSelectionDelegate): void {
    delegate.selectAll(SelectionChangedCause.toolbar);
  }

  protected buildToolbarItems(
    context: BuildContext,
    delegate: TextSelectionDelegate,
    clipboardStatus: ValueListenable<ClipboardStatus> | null,
    toolbar: (context: BuildContext, items: readonly ContextMenuButtonItem[]) => Widget,
  ): Widget {
    const build = (buildContext: BuildContext): Widget => {
      const status = clipboardStatus?.value;
      const canPaste = this.canPaste(delegate);
      if (canPaste && status === ClipboardStatus.unknown) return SizedBox.shrink();
      const items: ContextMenuButtonItem[] = [];
      const add = (type: ContextMenuButtonType, onPressed: () => void) =>
        items.push(new ContextMenuButtonItem({ type, onPressed }));
      if (this.canCut(delegate)) add(ContextMenuButtonType.cut, () => this.handleCut(delegate));
      if (this.canCopy(delegate)) add(ContextMenuButtonType.copy, () => this.handleCopy(delegate));
      if (canPaste && status === ClipboardStatus.pasteable) {
        add(
          ContextMenuButtonType.paste,
          () =>
            void this.handlePaste(delegate).catch((exception) => {
              FlutterError.reportError(
                new FlutterErrorDetails({ exception, library: 'widget library' }),
              );
            }),
        );
      }
      if (this.canSelectAll(delegate)) {
        add(ContextMenuButtonType.selectAll, () => this.handleSelectAll(delegate));
      }
      return items.length ? toolbar(buildContext, items) : SizedBox.shrink();
    };
    return clipboardStatus ? new ListenableBuilder(clipboardStatus, build) : build(context);
  }
}
export class EmptyTextSelectionControls extends TextSelectionControls {
  override canCopy(_delegate: TextSelectionDelegate): boolean {
    return false;
  }
  override canCut(_delegate: TextSelectionDelegate): boolean {
    return false;
  }
  override canPaste(_delegate: TextSelectionDelegate): boolean {
    return false;
  }
  override canSelectAll(_delegate: TextSelectionDelegate): boolean {
    return false;
  }
  override getHandleSize(_height: number): Size {
    return Size.zero;
  }
  override buildHandle(
    _context: BuildContext,
    _type: TextSelectionHandleType,
    _textLineHeight: number,
    _onTap?: (() => void) | null,
  ): Widget {
    return SizedBox.shrink();
  }
  override getHandleAnchor(_type: TextSelectionHandleType, _textLineHeight: number): Offset {
    return OffsetValue.zero;
  }
}
export const emptyTextSelectionControls: TextSelectionControls = new EmptyTextSelectionControls();
