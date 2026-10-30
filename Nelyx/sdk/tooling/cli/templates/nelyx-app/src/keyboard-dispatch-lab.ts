// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget, State, Element } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { Column, Text } from '@nelyx/core/framework/widgets/basic';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { KeyboardListener } from '@nelyx/core/framework/widgets/keyboard-listener';
import { RawKeyboardListener } from '@nelyx/core/framework/widgets/raw-keyboard-listener';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { FocusManager, KeyEventResult } from '@nelyx/core/framework/widgets/focus';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import type { KeyEvent } from '@nelyx/core/services/hardware-keyboard';
import { RawKeyDownEvent } from '@nelyx/core/services/raw-key-event';
import { RawKeyEventDataWindows } from '@nelyx/core/services/raw-keyboard-windows';
import { OptionalMethodChannel } from '@nelyx/core/services/platform-channel';
import { StandardMethodCodec } from '@nelyx/core/services/message-codecs';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';

export class KeyboardDispatchLab extends StatefulWidget {
  constructor(readonly onBack: () => void) {
    super();
  }
  createState(): State {
    return new KeyboardDispatchState();
  }
}
class KeyboardDispatchState extends State<KeyboardDispatchLab> {
  private manager!: FocusManager;
  private readonly target = new FocusNode({ debugLabel: 'Keyboard dispatch target' });
  private readonly modernListener = new FocusNode({ debugLabel: 'Modern listener scope' });
  private readonly rawListener = new FocusNode({ debugLabel: 'Raw listener scope' });
  private capture = true;
  private early = 0;
  private focused = 0;
  private late = 0;
  private pressed = 'none';
  private trace: string[] = [];
  private rawDown = 0;
  private lastRaw = 'none';
  private listenerRawDown = 0;
  private listenerModernDown = 0;
  private keyboardSnapshot = 'not read';
  private readingSnapshot = false;
  private async readKeyboardState(): Promise<void> {
    if (this.readingSnapshot) return;
    this.readingSnapshot = true;
    try {
      const services = (this.context as Element).owner.services.platformServices;
      const value = services
        ? await new OptionalMethodChannel(
            'flutter/keyboard',
            new StandardMethodCodec(),
            services.defaultBinaryMessenger,
          ).invokeMapMethod('getKeyboardState')
        : null;
      if (this.mounted)
        this.setState(() => {
          this.keyboardSnapshot = value === null ? 'unavailable' : `${value.size} observed pressed`;
        });
    } catch {
      if (this.mounted)
        this.setState(() => {
          this.keyboardSnapshot = 'error';
        });
    } finally {
      this.readingSnapshot = false;
    }
  }
  private record(stage: string, event: KeyEvent): void {
    if (!(event instanceof KeyDownEvent)) return;
    this.setState(() => {
      this.trace = [...this.trace, `${stage}:${event.logicalKey.keyLabel}`].slice(-8);
      this.pressed =
        [...this.manager.keyboard.logicalKeysPressed].map((key) => key.keyLabel).join(' + ') ||
        'none';
    });
  }
  private accepts(event: KeyEvent, key: LogicalKeyboardKey): boolean {
    return (
      event instanceof KeyDownEvent &&
      event.logicalKey.equals(key) &&
      this.manager.keyboard.isControlPressed
    );
  }
  private readonly before = (event: KeyEvent): KeyEventResult => {
    this.record('early', event);
    if (this.capture && this.accepts(event, LogicalKeyboardKey.keyE)) {
      this.setState(() => {
        this.early++;
      });
      return 'handled';
    }
    return 'ignored';
  };
  private readonly after = (event: KeyEvent): KeyEventResult => {
    this.record('late', event);
    if (this.accepts(event, LogicalKeyboardKey.keyL)) {
      this.setState(() => {
        this.late++;
      });
      return 'handled';
    }
    return 'ignored';
  };
  override initState(): void {
    if (!(this.context instanceof Element)) throw new Error('Keyboard dispatch requires Element');
    this.manager = this.context.owner.focus;
    this.manager.addEarlyKeyEventHandler(this.before);
    this.manager.addLateKeyEventHandler(this.after);
  }
  override dispose(): void {
    this.manager.removeEarlyKeyEventHandler(this.before);
    this.manager.removeLateKeyEventHandler(this.after);
    this.target.dispose();
    this.modernListener.dispose();
    this.rawListener.dispose();
  }
  build(context: BuildContext): Widget {
    const color = AppTheme.of(context).foreground;
    return new RawKeyboardListener(
      new KeyboardListener(
        new Focus(
          new Scaffold(
            'Keyboard dispatch',
            new Column(
              [
                new Text('Ctrl+E: global capture · Ctrl+K: focused control · Ctrl+L: fallback', {
                  fontSize: 15,
                  color,
                }),
                new Text(`Early ${this.early} · Focused ${this.focused} · Late ${this.late}`, {
                  fontSize: 22,
                  color,
                }),
                new Text(`Pressed during dispatch: ${this.pressed}`, { fontSize: 14, color }),
                new Text(`Route: ${this.trace.join(' → ') || 'none'}`, { fontSize: 14, color }),
                new Text(`Raw down callbacks ${this.rawDown} · Last ${this.lastRaw}`, {
                  fontSize: 14,
                  color,
                }),
                new Text(
                  `Listener raw ${this.listenerRawDown} · modern ${this.listenerModernDown}`,
                  { fontSize: 14, color },
                ),
                new Text(`Keyboard state: ${this.keyboardSnapshot}`, { fontSize: 14, color }),
                new FilledButton(
                  'dispatch-capture',
                  this.capture ? 'Disable global capture' : 'Enable global capture',
                  () =>
                    this.setState(() => {
                      this.capture = !this.capture;
                    }),
                ),
                new FilledButton('dispatch-focus', 'Focus key target', () =>
                  this.target.requestFocus(),
                ),
                new FilledButton('dispatch-snapshot', 'Read keyboard state', () => {
                  void this.readKeyboardState();
                }),
              ],
              { spacing: 14, crossAlign: 'stretch' },
            ),
            new FilledButton('dispatch-back', 'Back', this.widget.onBack),
          ),
          {
            focusNode: this.target,
            autofocus: true,
            includeSemantics: false,
            onKeyEvent: (_node, event) => {
              this.record('focus', event);
              if (this.accepts(event, LogicalKeyboardKey.keyK)) {
                this.setState(() => {
                  this.focused++;
                });
                return 'handled';
              }
              return 'ignored';
            },
            onKey: (_node, event) => {
              if (event instanceof RawKeyDownEvent)
                this.setState(() => {
                  this.rawDown++;
                  this.lastRaw = event.data.keyLabel || event.logicalKey.debugName || 'unlabeled';
                  if (event.data instanceof RawKeyEventDataWindows)
                    this.lastRaw += ` (scan ${event.data.scanCode.toString(16)}, modifiers ${event.data.modifiers.toString(16)})`;
                });
              return 'ignored';
            },
          },
        ),
        {
          focusNode: this.modernListener,
          includeSemantics: false,
          onKeyEvent: (event) => {
            if (event instanceof KeyDownEvent)
              this.setState(() => {
                this.listenerModernDown++;
              });
          },
        },
      ),
      {
        focusNode: this.rawListener,
        includeSemantics: false,
        onKey: (event) => {
          if (event instanceof RawKeyDownEvent)
            this.setState(() => {
              this.listenerRawDown++;
            });
        },
      },
    );
  }
}
