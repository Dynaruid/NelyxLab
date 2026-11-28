// SPDX-License-Identifier: BSD-3-Clause
import { ValueKey } from '@nelyx/core/foundation/key';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import {
  ClipRect,
  ColoredBox,
  Column,
  Padding,
  Positioned,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import { PlatformView } from '@nelyx/core/framework/widgets/platform-view';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import * as M from '@nelyx/material/widgets';
import type { DomPlatformViewFactories } from '@nelyx/sdk/frontend/dom/application';
import { getFrontendHost } from '@nelyx/sdk/frontend/dom/environment';
import readyScript from './platform-frame-document.js?url&no-inline';

const editorType = 'testbed.composited-editor';
const frameType = 'testbed.composited-frame';
const initialText =
  'This is the native HTML editor.\nDrag to select text across the tinted card.\n한글을 입력하거나 선택할 수 있습니다.';

export const nativeEditorDemos = {
  windows: {
    type: 'nelyx.win32.edit',
    query: 'win32PlatformView',
    title: 'Composited Win32 editor',
    control: 'Win32 EDIT control',
    link: 'Open Win32 editor demo',
  },
  android: {
    type: 'nelyx.android.edit',
    query: 'androidPlatformView',
    title: 'Composited Android editor',
    control: 'Android EditText control',
    link: 'Open Android editor demo',
  },
  linux: {
    type: 'nelyx.gtk.edit',
    query: 'gtkPlatformView',
    title: 'Composited GTK editor',
    control: 'GTK TextView control',
    link: 'Open GTK editor demo',
  },
  iOS: {
    type: 'nelyx.apple.edit',
    query: 'iosPlatformView',
    title: 'Composited UIKit editor',
    control: 'UIKit UITextView control',
    link: 'Open UIKit editor demo',
  },
  macOS: {
    type: 'nelyx.apple.edit',
    query: 'macosPlatformView',
    title: 'Composited AppKit editor',
    control: 'AppKit NSTextView control',
    link: 'Open AppKit editor demo',
  },
} as const;

export function nativeEditorHost(
  os: string | undefined,
): keyof typeof nativeEditorDemos | undefined {
  if (os === 'windows' || os === 'android' || os === 'linux' || os === 'iOS' || os === 'macOS')
    return os;
}

export const platformViewFactories: DomPlatformViewFactories = {
  [editorType]: {
    create({ document, creationParams, signal, emit }) {
      const editor = document.createElement('textarea');
      editor.setAttribute('aria-label', 'Composited HTML editor');
      editor.style.cssText =
        'display:block;resize:none;padding:12px;font:16px/1.5 system-ui;' +
        'border:1px solid #817e88;background:#faf8ff;color:#24212a;user-select:text';
      editor.value = typeof creationParams === 'string' ? creationParams : '';
      editor.addEventListener('input', () => emit({ kind: 'input', value: editor.value }), {
        signal,
      });
      return {
        element: editor,
        update(value) {
          if (typeof value === 'string' && value !== editor.value) editor.value = value;
        },
      };
    },
  },
  [frameType]: {
    create({ document, signal, emit }) {
      const window = document.defaultView!;
      const frame = document.createElement('iframe');
      frame.title = 'Composited HTML document';
      frame.style.cssText = 'display:block;border:1px solid #817e88;background:#faf8ff';
      const external =
        getFrontendHost(window).target === 'web'
          ? new URL(window.location.href).searchParams.get('platformFrame')
          : null;
      let expected = window.origin;
      if (external) {
        const url = new URL(external);
        if (!['http:', 'https:'].includes(url.protocol))
          throw new Error('Use an HTTP or HTTPS document');
        expected = url.origin;
        frame.src = url.href;
      } else {
        frame.srcdoc = `<!doctype html><html lang="en"><meta charset="utf-8">
<style>body{margin:0;padding:12px;font:16px/1.5 system-ui;background:#faf8ff;color:#24212a}</style>
<title>Composited HTML document</title><button id="frame-counter">Frame clicks: 0</button>
<p>Select this text by dragging inside the iframe.</p>
<script defer src="${new URL(readyScript, document.baseURI).href}"></script>`;
      }
      const timer = window.setTimeout(() => emit({ kind: 'frame-unavailable' }), 3500);
      window.addEventListener(
        'message',
        (event) => {
          if (
            event.source !== frame.contentWindow ||
            event.origin !== expected ||
            event.data?.kind !== 'testbed/platform-frame-ready'
          )
            return;
          window.clearTimeout(timer);
          emit({ kind: 'frame-ready' });
        },
        { signal },
      );
      return { element: frame, dispose: () => window.clearTimeout(timer) };
    },
  },
};

class PlusPainter extends CustomPainter {
  override paint(canvas: Canvas, size: Size): void {
    const x = size.width / 2;
    const y = size.height / 2;
    const paint = new Paint({ color: 0xffffffff, strokeWidth: 2 });
    canvas.drawLine({ x: x - 8, y }, { x: x + 8, y }, paint);
    canvas.drawLine({ x, y: y - 8 }, { x, y: y + 8 }, paint);
  }

  override shouldRepaint(): boolean {
    return false;
  }
}

const plusPainter = new PlusPainter();
const action = (label: string, onPressed: () => void) =>
  new M.OutlinedButton({ child: new Text(label), onPressed });

export class PlatformViewsScreen extends StatefulWidget {
  constructor(readonly nativeEditor?: keyof typeof nativeEditorDemos) {
    super();
  }

  override createState() {
    return new PlatformViewsState();
  }
}

class PlatformViewsState extends State<PlatformViewsScreen> {
  private readonly editor = new TextEditingController(initialText);
  private readonly editorButtonFocus = new FocusNode();
  private readonly frameButtonFocus = new FocusNode();
  private overlay = true;
  private reversed = false;
  private clicks = 0;
  private keyboardInset = 0;
  private frameState: 'checking' | 'ready' | 'unavailable' = 'checking';

  private readonly add = () =>
    this.setState(() => {
      this.clicks++;
    });

  private readonly hostEvent = (event: unknown) => {
    if (!event || typeof event !== 'object' || !('kind' in event)) return;
    if (event.kind === 'input' && 'value' in event && typeof event.value === 'string') {
      this.editor.text = event.value;
    } else if (
      event.kind === 'keyboard' &&
      'bottom' in event &&
      typeof event.bottom === 'number' &&
      Number.isFinite(event.bottom)
    ) {
      const bottom = Math.max(0, event.bottom);
      if (bottom !== this.keyboardInset)
        this.setState(() => {
          this.keyboardInset = bottom;
        });
    } else if (event.kind === 'frame-ready' || event.kind === 'frame-unavailable') {
      const ready = event.kind === 'frame-ready';
      this.setState(() => {
        this.frameState = ready ? 'ready' : 'unavailable';
      });
    }
  };

  private embed(label: string, type: string, content: Widget): Widget {
    const focus = type === frameType ? this.frameButtonFocus : this.editorButtonFocus;
    const overlay = this.overlay
      ? [
          new Positioned(new IgnorePointer(new ColoredBox({ color: 0x517c64c4 })), {
            top: 12,
            right: 12,
            width: 166,
            height: 88,
          }),
          new Positioned(
            new Semantics({
              container: true,
              label,
              button: true,
              focusable: true,
              onTap: this.add,
              onFocus: () => focus.requestFocus(),
              child: new Focus(
                new GestureDetector(
                  new ColoredBox({
                    color: 0xff4e3c7e,
                    child: new CustomPaint(undefined, { painter: plusPainter }),
                  }),
                  { behavior: HitTestBehavior.opaque, onTap: this.add, excludeFromSemantics: true },
                ),
                {
                  focusNode: focus,
                  includeSemantics: false,
                  onKeyEvent: (_node, event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return 'ignored';
                    if (event.kind === 'down' && !event.repeat) this.add();
                    return 'handled';
                  },
                },
              ),
            }),
            { top: 24, right: 24, width: 44, height: 44 },
          ),
        ]
      : [];
    return new RepaintBoundary(
      new SizedBox(undefined, 168, new ClipRect(new Stack([Positioned.fill(content), ...overlay]))),
      new ValueKey(type),
    );
  }

  override build(context: BuildContext): Widget {
    const native = this.widget.nativeEditor;
    const demo = native ? nativeEditorDemos[native] : undefined;
    const currentEditor = demo?.type ?? editorType;
    const changeHost = (nextHost?: typeof native) => {
      const next = new URL(location.href);
      for (const { query } of Object.values(nativeEditorDemos)) next.searchParams.delete(query);
      if (nextHost) next.searchParams.set(nativeEditorDemos[nextHost].query, '1');
      location.assign(next.href);
    };
    const openModal = () => {
      const title = 'Composited views modal';
      void M.showDialog(context, {
        barrierDismissible: false,
        barrierColor: new Color(0),
        builder: (dialogContext) =>
          new M.AlertDialog({
            semanticLabel: title,
            title: new Text(title),
            content: new Text('The underlying editor and iframe are blocked while this is open.'),
            actions: [action('Close modal', () => Navigator.of(dialogContext).pop())],
          }),
      });
    };
    const text = demo
      ? this.editor.text.replace('native HTML editor', demo.control)
      : this.editor.text;
    const editor = this.embed(
      'Add above editor',
      currentEditor,
      new PlatformView({
        viewType: currentEditor,
        creationParams: native === 'windows' ? text.replaceAll('\n', '\r\n') : text,
        onEvent: this.hostEvent,
        fallbackBuilder: (_context, reason) =>
          new Column([
            new Text(reason ?? (native ? 'Preparing native editor' : 'Preparing HTML editor')),
            new M.TextField({
              id: 'composited-editor-fallback',
              controller: this.editor,
              maxLines: 3,
            }),
          ]),
      }),
    );
    const toggle = action(this.overlay ? 'Hide overlay' : 'Show overlay', () =>
      this.setState(() => {
        this.overlay = !this.overlay;
      }),
    );
    if (demo) {
      const theme = M.Theme.of(context);
      const content = new DefaultTextStyle(
        theme.textTheme.bodyMedium!,
        new Padding(
          EdgeInsets.all(24),
          new Column(
            [
              new Text(demo.title, { style: theme.textTheme.titleLarge ?? undefined }),
              new Text('Nelyx clicks: ' + this.clicks),
              action('Return to Testbed 3', () => changeHost()),
              toggle,
              action('Open composited views modal', openModal),
              editor,
              ...(native === 'linux' || native === 'macOS' ? [new SizedBox(undefined, 220)] : []),
            ],
            { crossAlign: 'stretch', mainSize: 'min', spacing: 12 },
          ),
        ),
      );
      const scroll = native === 'windows' ? content : new SingleBoxScrollView({ child: content });
      const viewport = new ColoredBox({
        color: theme.colorScheme.surface,
        child: scroll,
      });
      return native === 'android' || native === 'iOS'
        ? new Padding(
            EdgeInsets.only({
              bottom: Math.max(MediaQuery.viewInsetsOf(context).bottom, this.keyboardInset),
            }),
            viewport,
          )
        : viewport;
    }
    const unavailable = () => new Text('The iframe did not send a verified ready message.');
    const frame = this.embed(
      'Add above iframe',
      frameType,
      this.frameState === 'unavailable'
        ? unavailable()
        : new PlatformView({
            viewType: frameType,
            onEvent: this.hostEvent,
            fallbackBuilder: (_context, reason) => new Text(reason ?? 'Preparing HTML document'),
          }),
    );
    const host = getFrontendHost();
    const nativeHost = host.target === 'tauri' ? nativeEditorHost(host.os) : undefined;
    return new SingleBoxScrollView({
      child: new Padding(
        EdgeInsets.all(24),
        new Column(
          [
            new Text('Composited platform views'),
            new Text('Select text through the tinted card or press the + buttons.'),
            toggle,
            ...(nativeHost
              ? [action(nativeEditorDemos[nativeHost].link, () => changeHost(nativeHost))]
              : []),
            ...(this.reversed ? [frame, editor] : [editor, frame]),
            new ClipRect(new Text('Nelyx clicks: ' + this.clicks)),
            new ClipRect(
              new Text(
                this.frameState === 'ready'
                  ? 'HTML document ready'
                  : this.frameState === 'checking'
                    ? 'Checking HTML document'
                    : 'HTML document unavailable',
              ),
            ),
            new ClipRect(
              action('Reverse views', () =>
                this.setState(() => {
                  this.reversed = !this.reversed;
                }),
              ),
            ),
            new ClipRect(action('Open composited views modal', openModal)),
            new SizedBox(undefined, 160),
          ],
          { crossAlign: 'stretch', mainSize: 'min', spacing: 12 },
        ),
      ),
    });
  }

  override dispose(): void {
    this.editorButtonFocus.dispose();
    this.frameButtonFocus.dispose();
    this.editor.dispose();
  }
}
