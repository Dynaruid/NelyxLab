// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State, Element } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import { Focus } from './focus-scope.ts';
import type { FocusNode, FocusHighlightMode, FocusManager } from './focus.ts';
import { Actions } from './actions.ts';
import type { IntentType, ActionHandle } from './actions.ts';
import { Shortcuts } from './shortcuts.ts';
import type { ShortcutMap } from './shortcuts.ts';
import { MouseRegion } from './mouse-region.ts';
import { GlobalKey } from './global-key.ts';
import { MediaQuery } from './app-data.ts';
import { invariant } from '../../foundation/errors.ts';
import { MouseCursor } from '../../services/mouse-cursor.ts';
export interface FocusableActionDetectorOptions extends WidgetOptions {
  readonly enabled?: boolean;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly descendantsAreFocusable?: boolean;
  readonly descendantsAreTraversable?: boolean;
  readonly skipTraversal?: boolean | null;
  readonly mouseCursor?: MouseCursor;
  readonly shortcuts?: ShortcutMap | null;
  readonly actions?: ReadonlyMap<IntentType, ActionHandle> | null;
  readonly onShowFocusHighlight?: (value: boolean) => void;
  readonly onShowHoverHighlight?: (value: boolean) => void;
  readonly onFocusChange?: (value: boolean) => void;
  readonly includeFocusSemantics?: boolean;
}
/** Focus/action/hover/cursor composition through the owning View. */
export class FocusableActionDetector extends StatefulWidget {
  readonly options: Readonly<FocusableActionDetectorOptions>;
  constructor(
    readonly child: Widget,
    options: FocusableActionDetectorOptions = {},
  ) {
    super(options.key ?? null);
    for (const value of [
      options.enabled,
      options.autofocus,
      options.descendantsAreFocusable,
      options.descendantsAreTraversable,
      options.skipTraversal,
      options.includeFocusSemantics,
    ])
      invariant(
        value == null || typeof value === 'boolean',
        'invalid-focus-detector-flags',
        'Detector flags must be boolean',
      );
    this.options = Object.freeze({ ...options });
  }
  get enabled(): boolean {
    return this.options.enabled ?? true;
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  get mouseCursor(): MouseCursor {
    return this.options.mouseCursor ?? MouseCursor.defer;
  }
  get descendantsAreFocusable(): boolean {
    return this.options.descendantsAreFocusable ?? true;
  }
  get descendantsAreTraversable(): boolean {
    return this.options.descendantsAreTraversable ?? true;
  }
  get skipTraversal(): boolean | null {
    return this.options.skipTraversal ?? null;
  }
  get actions(): ReadonlyMap<IntentType, ActionHandle> | null {
    return this.options.actions ?? null;
  }
  get shortcuts(): ShortcutMap | null {
    return this.options.shortcuts ?? null;
  }
  get includeFocusSemantics(): boolean {
    return this.options.includeFocusSemantics ?? true;
  }
  get onShowFocusHighlight(): ((value: boolean) => void) | undefined {
    return this.options.onShowFocusHighlight;
  }
  get onShowHoverHighlight(): ((value: boolean) => void) | undefined {
    return this.options.onShowHoverHighlight;
  }
  get onFocusChange(): ((value: boolean) => void) | undefined {
    return this.options.onFocusChange;
  }
  createState(): State {
    return new FocusableActionDetectorState();
  }
}
class FocusableActionDetectorState extends State<FocusableActionDetector> {
  private readonly mouseRegionKey = new GlobalKey('FocusableActionDetector mouse region');
  private manager!: FocusManager;
  private focused = false;
  private hovering = false;
  private canShowHighlight = false;
  private shownFocus = false;
  private shownHover = false;
  private readonly highlightChanged = (mode: FocusHighlightMode) => {
    if (this.mounted && (this.context as Element).active)
      this.change(() => {
        this.canShowHighlight = mode === 'traditional';
      });
  };
  private readonly entered = () => {
    if (!this.hovering)
      this.change(() => {
        this.hovering = true;
      });
  };
  private readonly exited = () => {
    if (this.hovering)
      this.change(() => {
        this.hovering = false;
      });
  };
  private readonly focusChanged = (value: boolean) => {
    if (value !== this.focused) {
      this.change(() => {
        this.focused = value;
      });
      this.widget.onFocusChange?.(value);
    }
  };
  override initState(): void {
    super.initState();
    invariant(
      this.context instanceof Element,
      'invalid-focus-context',
      'FocusableActionDetector requires an Element',
    );
    this.manager = this.context.owner.focus;
    this.manager.addHighlightModeListener(this.highlightChanged);
    this.context.owner.postFrame(() => {
      if (this.mounted && (this.context as Element).active)
        this.highlightChanged(this.manager.highlightMode);
    });
  }
  private canRequestFocus(widget: FocusableActionDetector): boolean {
    return MediaQuery.maybeNavigationModeOf(this.context) === 'directional' || widget.enabled;
  }
  private change(task?: () => void, _oldWidget?: FocusableActionDetector): void {
    if (!this.mounted) return;
    const oldFocus = this.shownFocus,
      oldHover = this.shownHover;
    task?.();
    const focus = this.focused && this.canShowHighlight && this.canRequestFocus(this.widget),
      hover = this.hovering && this.widget.enabled && this.canShowHighlight;
    this.shownFocus = focus;
    this.shownHover = hover;
    if (oldFocus !== focus) this.widget.onShowFocusHighlight?.(focus);
    if (oldHover !== hover) this.widget.onShowHoverHighlight?.(hover);
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    (this.context as Element).owner.postFrame(() => {
      if (this.mounted && (this.context as Element).active) this.change();
    });
  }
  override activate(): void {
    super.activate();
    (this.context as Element).owner.postFrame(() => {
      if (this.mounted && (this.context as Element).active)
        this.highlightChanged(this.manager.highlightMode);
    });
  }
  override didUpdateWidget(old: FocusableActionDetector): void {
    super.didUpdateWidget(old);
    if (old.enabled !== this.widget.enabled)
      (this.context as Element).owner.postFrame(() => {
        if (this.mounted && (this.context as Element).active) this.change(undefined, old);
      });
  }
  override dispose(): void {
    this.manager.removeHighlightModeListener(this.highlightChanged);
    super.dispose();
  }
  build(_context: BuildContext): Widget {
    let child: Widget = new MouseRegion(
      new Focus(this.widget.child, {
        focusNode: this.widget.focusNode,
        autofocus: this.widget.autofocus,
        descendantsAreFocusable: this.widget.descendantsAreFocusable,
        descendantsAreTraversable: this.widget.descendantsAreTraversable,
        skipTraversal: this.widget.skipTraversal,
        canRequestFocus: this.canRequestFocus(this.widget),
        onFocusChange: this.focusChanged,
        includeSemantics: this.widget.includeFocusSemantics,
      }),
      {
        key: this.mouseRegionKey,
        onEnter: this.entered,
        onExit: this.exited,
        cursor: this.widget.mouseCursor,
      },
    );
    if (this.widget.enabled && this.widget.actions?.size)
      child = new Actions({ actions: this.widget.actions, child });
    if (this.widget.enabled && this.widget.shortcuts?.size)
      child = new Shortcuts({ shortcuts: this.widget.shortcuts, child });
    return child;
  }
}
