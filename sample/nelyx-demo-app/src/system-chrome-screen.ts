// SPDX-License-Identifier: BSD-3-Clause
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Padding, Text } from '@nelyx/core/framework/widgets/basic';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import type { BinaryMessenger } from '@nelyx/core/services/binary-messenger';
import { PlatformException } from '@nelyx/core/services/message-codec';
import {
  DeviceOrientation,
  SystemChrome,
  SystemUiMode,
  SystemUiOverlay,
  SystemUiOverlayStyle,
} from '@nelyx/core/services/system-chrome';
import { Color } from '@nelyx/core/ui/color';
import { AppBar } from '@nelyx/material/app-bar';
import { Scaffold } from '@nelyx/material/scaffold';
import { ButtonSegment, SegmentedButton } from '@nelyx/material/segmented-button';
import { TextButton } from '@nelyx/material/text-button';
import { webViewScrollEdgeEffectsFor } from '@nelyx/sdk/frontend/dom/environment';
import type { TauriScrollEdgeEffect, TauriScrollEdgeEffects } from '@nelyx/sdk/runtime/config';

const edgeModes: Readonly<Record<TauriScrollEdgeEffect, string>> = {
  hidden: 'Off',
  automatic: 'Auto',
  soft: 'Soft',
  hard: 'Hard',
};
const edgeSegments = Object.entries(edgeModes).map(
  ([value, label]) =>
    new ButtonSegment({ value: value as TauriScrollEdgeEffect, label: new Text(label) }),
);

export class SystemChromeScreen extends StatefulWidget {
  override createState(): State<SystemChromeScreen> {
    return new SystemChromeScreenState();
  }
}

class SystemChromeScreenState extends State<SystemChromeScreen> {
  private darkHeader = false;
  private status = '';
  private messenger: BinaryMessenger | undefined;
  private changedMode = false;
  private changedOrientation = false;
  private busy = false;
  private readonly webViewEdges = webViewScrollEdgeEffectsFor();
  private effects: Required<TauriScrollEdgeEffects> | undefined;

  override initState(): void {
    super.initState();
    void this.webViewEdges?.get().then(
      (effects) => this.updateEffects(effects),
      (error: unknown) => {
        if (!(error instanceof PlatformException && error.code === 'unsupported'))
          this.finish(String(error));
      },
    );
  }

  private updateEffects(effects: Required<TauriScrollEdgeEffects>): void {
    if (this.mounted)
      this.setState(() => {
        this.effects = effects;
      });
  }

  private edgeControl(edge: 'top' | 'bottom', effects: Required<TauriScrollEdgeEffects>): Widget {
    return new SegmentedButton({
      segments: edgeSegments,
      selected: new Set([effects[edge]]),
      showSelectedIcon: false,
      onSelectionChanged: this.busy
        ? null
        : (selected) => {
            const [style] = selected;
            if (!style || style === effects[edge]) return;
            this.run(
              `${edge === 'top' ? 'Top' : 'Bottom'} edge · ${edgeModes[style]}`,
              async () => {
                this.updateEffects(await this.webViewEdges!.set({ ...effects, [edge]: style }));
              },
            );
          },
    });
  }

  private run(message: string, action: () => Promise<void>): void {
    if (this.busy) return;
    this.setState(() => {
      this.busy = true;
    });
    void action().then(
      () => this.finish(message),
      (error: unknown) => this.finish(String(error)),
    );
  }

  private finish(message: string): void {
    if (!this.mounted) return;
    this.setState(() => {
      this.busy = false;
      this.status = message;
    });
  }

  override dispose(): void {
    if (this.messenger) {
      if (this.changedMode)
        void SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge, {}, this.messenger).catch(
          () => {},
        );
      if (this.changedOrientation)
        void SystemChrome.setPreferredOrientations([], this.messenger).catch(() => {});
    }
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const services = context.services.platformServices;
    const messenger = services?.defaultBinaryMessenger;
    const available = messenger && services?.environment?.capabilities.systemChrome === 'available';
    const { bottom, left, right } = MediaQuery.paddingOf(context);
    const dark = this.darkHeader;
    const button = (label: string, action: () => void) =>
      new TextButton({
        child: new Text(label),
        onPressed: available && !this.busy ? action : null,
      });
    const setMode = (mode: SystemUiMode, message: string, overlays?: readonly SystemUiOverlay[]) =>
      this.run(message, () => {
        this.messenger = messenger;
        this.changedMode ||= mode !== SystemUiMode.edgeToEdge;
        return SystemChrome.setEnabledSystemUIMode(
          mode,
          overlays ? { overlays } : undefined,
          messenger,
        );
      });
    const setOrientation = (orientations: readonly DeviceOrientation[], message: string) =>
      this.run(message, () => {
        this.messenger = messenger;
        this.changedOrientation ||= orientations.length > 0;
        return SystemChrome.setPreferredOrientations(orientations, messenger);
      });
    return new Scaffold({
      appBar: new AppBar({
        title: new Text('SystemChrome'),
        backgroundColor: new Color(dark ? 0xff18233c : 0xffe8efff),
        foregroundColor: new Color(dark ? 0xffffffff : 0xff18233c),
        systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      }),
      body: new ListView({
        padding: EdgeInsets.fromLTRB(16 + left, 16, 16 + right, 16 + bottom),
        children: [
          ...(available
            ? []
            : [new Text('SystemChrome controls are available in the native mobile app.')]),
          new Text('Status bar appearance', { fontSize: 18 }),
          button(dark ? 'Use dark status bar icons' : 'Use light status bar icons', () =>
            this.setState(() => {
              this.darkHeader = !dark;
            }),
          ),
          ...(this.effects
            ? [
                new Padding(
                  EdgeInsets.only({ top: 16 }),
                  new Text('WebView scroll edge effects', { fontSize: 18 }),
                ),
                new Padding(EdgeInsets.only({ top: 8 }), new Text('Top edge')),
                this.edgeControl('top', this.effects),
                new Padding(EdgeInsets.only({ top: 8 }), new Text('Bottom edge')),
                this.edgeControl('bottom', this.effects),
              ]
            : []),
          new Padding(EdgeInsets.only({ top: 16 }), new Text('System overlays', { fontSize: 18 })),
          button('Show both bars', () => setMode(SystemUiMode.edgeToEdge, 'Both bars requested')),
          button('Show status bar only', () =>
            setMode(SystemUiMode.manual, 'Status bar requested', [SystemUiOverlay.top]),
          ),
          button('Hide status bar', () =>
            setMode(SystemUiMode.manual, 'Requested to hide the status bar', [
              SystemUiOverlay.bottom,
            ]),
          ),
          button('Full screen', () =>
            setMode(SystemUiMode.immersiveSticky, 'Full screen requested'),
          ),
          button('Restore last overlay mode', () =>
            this.run('Overlay mode restored', () =>
              SystemChrome.restoreSystemUIOverlays(messenger),
            ),
          ),
          new Padding(
            EdgeInsets.only({ top: 16 }),
            new Text('Screen orientation', { fontSize: 18 }),
          ),
          button('Portrait', () =>
            setOrientation([DeviceOrientation.portraitUp], 'Portrait requested'),
          ),
          button('Landscape', () =>
            setOrientation(
              [DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight],
              'Landscape requested',
            ),
          ),
          button('Allow rotation', () => setOrientation([], 'Automatic rotation requested')),
          new Semantics({
            identifier: 'system-chrome-result',
            liveRegion: true,
            child: new Text(this.status),
          }),
        ],
      }),
    });
  }
}
