// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import type { Color } from './color.ts';
import type { SystemColorProvider } from './system-color-provider.ts';
import { currentSystemColorProvider } from './system-color-provider.ts';
class UnsupportedError extends Error {
  override name = 'UnsupportedError';
}

const values = new WeakMap<SystemColorProvider, Map<string, SystemColor>>();
let createPalette: (brightness: 'light' | 'dark') => SystemColorPalette;
export class SystemColorPalette {
  private constructor(readonly brightness: 'light' | 'dark') {
    Object.freeze(this);
  }
  static {
    createPalette = (brightness) => new SystemColorPalette(brightness);
  }
  private read(name: string): SystemColor {
    const provider = currentSystemColorProvider();
    if (!provider) throw new UnsupportedError('SystemColor not supported on the current platform.');
    let palette = values.get(provider);
    if (!palette) values.set(provider, (palette = new Map()));
    const key = this.brightness + ':' + name;
    let color = palette.get(key);
    if (!color)
      palette.set(
        key,
        (color = new SystemColor({ name, value: provider.color(this.brightness, name) })),
      );
    return color;
  }
  get accentColor(): SystemColor {
    return this.read('AccentColor');
  }
  get accentColorText(): SystemColor {
    return this.read('AccentColorText');
  }
  get activeText(): SystemColor {
    return this.read('ActiveText');
  }
  get buttonBorder(): SystemColor {
    return this.read('ButtonBorder');
  }
  get buttonFace(): SystemColor {
    return this.read('ButtonFace');
  }
  get buttonText(): SystemColor {
    return this.read('ButtonText');
  }
  get canvas(): SystemColor {
    return this.read('Canvas');
  }
  get canvasText(): SystemColor {
    return this.read('CanvasText');
  }
  get field(): SystemColor {
    return this.read('Field');
  }
  get fieldText(): SystemColor {
    return this.read('FieldText');
  }
  get grayText(): SystemColor {
    return this.read('GrayText');
  }
  get highlight(): SystemColor {
    return this.read('Highlight');
  }
  get highlightText(): SystemColor {
    return this.read('HighlightText');
  }
  get linkText(): SystemColor {
    return this.read('LinkText');
  }
  get mark(): SystemColor {
    return this.read('Mark');
  }
  get markText(): SystemColor {
    return this.read('MarkText');
  }
  get selectedItem(): SystemColor {
    return this.read('SelectedItem');
  }
  get selectedItemText(): SystemColor {
    return this.read('SelectedItemText');
  }
  get visitedText(): SystemColor {
    return this.read('VisitedText');
  }
}

export class SystemColor {
  readonly name: string;
  readonly value: Color | null;
  constructor({ name, value = null }: { readonly name: string; readonly value?: Color | null }) {
    this.name = name;
    this.value = value;
    Object.freeze(this);
  }
  get isSupported(): boolean {
    return this.value !== null;
  }
  static get platformProvidesSystemColors(): boolean {
    return currentSystemColorProvider() !== null;
  }
  static readonly light = createPalette('light');
  static readonly dark = createPalette('dark');
}
