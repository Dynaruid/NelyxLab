// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/material/menu_anchor.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { invariant } from '@nelyx/core/foundation/errors';
import { graphemeBoundaries } from '@nelyx/core/foundation/grapheme-boundaries';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { VoidCallbackIntent } from '@nelyx/core/framework/widgets/actions';
import { Text } from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import {
  Element,
  InheritedWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { isCurrentRoute } from '@nelyx/core/framework/widgets/navigation';
import { MenuController } from '@nelyx/core/framework/widgets/raw-menu-anchor';
import { CharacterActivator, ShortcutRegistry } from '@nelyx/core/framework/widgets/shortcuts';
import type { ShortcutRegistryEntry } from '@nelyx/core/framework/widgets/shortcuts';
import type { HardwareKeyboard } from '@nelyx/core/services/hardware-keyboard';
import { TextDecoration } from '@nelyx/core/ui/typography';

export interface MenuAcceleratorCallbackBindingOptions extends WidgetOptions {
  readonly child: Widget;
  readonly onInvoke?: (() => void) | null;
  readonly hasSubmenu?: boolean;
}

export class MenuAcceleratorCallbackBinding extends InheritedWidget {
  readonly onInvoke: (() => void) | null;
  readonly hasSubmenu: boolean;

  constructor({
    child,
    key = null,
    onInvoke = null,
    hasSubmenu = false,
  }: MenuAcceleratorCallbackBindingOptions) {
    super(child, key);
    this.onInvoke = onInvoke;
    this.hasSubmenu = hasSubmenu;
  }

  static maybeOf(context: BuildContext): MenuAcceleratorCallbackBinding | null {
    return context.maybeDependOn(MenuAcceleratorCallbackBinding) ?? null;
  }

  static of(context: BuildContext): MenuAcceleratorCallbackBinding {
    const binding = this.maybeOf(context);
    invariant(
      binding,
      'missing-menu-accelerator-binding',
      'No MenuAcceleratorCallbackBinding ancestor was found',
    );
    return binding;
  }

  override updateShouldNotify(old: MenuAcceleratorCallbackBinding): boolean {
    return old.onInvoke !== this.onInvoke || old.hasSubmenu !== this.hasSubmenu;
  }
}

export type MenuAcceleratorChildBuilder = (
  context: BuildContext,
  label: string,
  index: number,
) => Widget;

export interface MenuAcceleratorLabelOptions extends WidgetOptions {
  readonly builder?: MenuAcceleratorChildBuilder;
}

function characters(text: string): string[] {
  const boundaries = graphemeBoundaries(text);
  return boundaries.slice(0, -1).map((start, index) => text.slice(start, boundaries[index + 1]));
}

function parseLabel(label: string): { text: string; index: number; accelerator: string | null } {
  const source = characters(label);
  const display: string[] = [];
  let index = -1;
  let accelerator: string | null = null;
  for (let i = 0; i < source.length; ++i) {
    const current = source[i]!;
    if (current !== '&') {
      display.push(current);
      continue;
    }
    const next = source[++i];
    if (next === undefined) break;
    if (index < 0 && next !== '&' && next.trim() !== '') {
      index = display.length;
      accelerator = next.toLowerCase();
    }
    display.push(next);
  }
  return { text: display.join(''), index, accelerator };
}

export function usesSymbolicMenuModifiers(): boolean {
  const platform = FoundationPlatform.defaultTargetPlatform;
  return platform === 'macOS' || platform === 'iOS';
}

export class MenuAcceleratorLabel extends StatefulWidget {
  readonly builder: MenuAcceleratorChildBuilder;
  private readonly parsed: ReturnType<typeof parseLabel>;

  constructor(
    readonly label: string,
    {
      key = null,
      builder = MenuAcceleratorLabel.defaultLabelBuilder,
    }: MenuAcceleratorLabelOptions = {},
  ) {
    super(key);
    this.builder = builder;
    this.parsed = parseLabel(label);
  }

  get displayLabel(): string {
    return this.parsed.text;
  }
  get hasAccelerator(): boolean {
    return this.parsed.accelerator !== null;
  }
  /** @internal Grapheme index and key to register for the displayed text. */
  get marker(): Readonly<ReturnType<typeof parseLabel>> {
    return this.parsed;
  }

  static stripAcceleratorMarkers(
    label: string,
    { setIndex }: { readonly setIndex?: (index: number) => void } = {},
  ): string {
    const parsed = parseLabel(label);
    setIndex?.(parsed.index);
    return parsed.text;
  }

  static defaultLabelBuilder(context: BuildContext, label: string, index: number): Widget {
    if (index < 0) return new Text(label);
    const boundaries = graphemeBoundaries(label);
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (start === undefined || end === undefined) return new Text(label);
    const style = DefaultTextStyle.of(context)?.style ?? new TextStyle();
    return Text.rich(
      new TextSpan({
        style,
        children: [
          new TextSpan({ text: label.slice(0, start) }),
          new TextSpan({
            text: label.slice(start, end),
            style: style.copyWith({ decoration: TextDecoration.underline }),
          }),
          new TextSpan({ text: label.slice(end) }),
        ],
      }),
    );
  }

  override createState(): State<MenuAcceleratorLabel> {
    return new MenuAcceleratorLabelState();
  }
}

class MenuAcceleratorLabelState extends State<MenuAcceleratorLabel> {
  private keyboard: HardwareKeyboard | null = null;
  private registry: ShortcutRegistry | null = null;
  private binding: MenuAcceleratorCallbackBinding | null = null;
  private submenuOpen = false;
  private showAccelerator = false;
  private registration: ShortcutRegistryEntry | null = null;

  private updateRegistration(): void {
    this.registration?.dispose();
    this.registration = null;
    const { accelerator } = this.widget.marker;
    const invoke = this.binding?.onInvoke;
    if (
      !this.showAccelerator ||
      !accelerator ||
      !invoke ||
      (this.binding?.hasSubmenu && this.submenuOpen)
    )
      return;
    this.registration =
      this.registry?.addAll(
        new Map([
          [
            new CharacterActivator(accelerator, { alt: true, includeRepeats: false }),
            new VoidCallbackIntent(invoke),
          ],
        ]),
      ) ?? null;
  }

  private readonly handleKeyboard = (): boolean => {
    const show = this.keyboard?.isAltPressed === true;
    if (
      show !== this.showAccelerator &&
      this.mounted &&
      this.context instanceof Element &&
      this.context.active
    ) {
      this.setState(() => {
        this.showAccelerator = show;
      });
      this.updateRegistration();
    }
    return false;
  };

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const context = this.context;
    const keyboard =
      context instanceof Element && !usesSymbolicMenuModifiers() && isCurrentRoute(context)
        ? context.owner.keyboard
        : null;
    if (keyboard !== this.keyboard) {
      this.keyboard?.removeHandler(this.handleKeyboard);
      this.keyboard = keyboard;
      keyboard?.addHandler(this.handleKeyboard);
    }
    this.showAccelerator = keyboard?.isAltPressed === true;
    this.registry = keyboard ? ShortcutRegistry.maybeOf(context) : null;
    this.binding = keyboard ? MenuAcceleratorCallbackBinding.maybeOf(context) : null;
    this.submenuOpen = keyboard ? MenuController.maybeIsOpenOf(context) === true : false;
    this.updateRegistration();
  }

  override didUpdateWidget(old: MenuAcceleratorLabel): void {
    super.didUpdateWidget(old);
    if (old.label !== this.widget.label) this.updateRegistration();
  }

  override deactivate(): void {
    this.registration?.dispose();
    this.registration = null;
    this.keyboard?.removeHandler(this.handleKeyboard);
    this.keyboard = null;
    super.deactivate();
  }

  override dispose(): void {
    this.registration?.dispose();
    this.keyboard?.removeHandler(this.handleKeyboard);
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    return this.widget.builder(
      context,
      this.widget.displayLabel,
      this.showAccelerator ? this.widget.marker.index : -1,
    );
  }
}
