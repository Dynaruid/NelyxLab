// SPDX-License-Identifier: BSD-3-Clause
import { Directionality, Localizations, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  IndexedSemantics,
  Padding,
  SizedBox,
  SliverToBoxAdapter,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { ContextMenuButtonItem } from '@nelyx/core/framework/widgets/context-menu-button-item';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import type { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { TextMagnifierConfiguration } from '@nelyx/core/framework/widgets/magnifier';
import type { MagnifierInfo } from '@nelyx/core/framework/widgets/magnifier';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { CustomScrollView, ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { SelectableText as CoreSelectableText } from '@nelyx/core/framework/widgets/selectable-text';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SpellCheckConfiguration } from '@nelyx/core/framework/widgets/spell-check';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BrowserContextMenu } from '@nelyx/core/services/browser-context-menu';
import { SuggestionSpan } from '@nelyx/core/services/spell-check';
import { SelectionChangedCause } from '@nelyx/core/services/text-input';
import { TextRange } from '@nelyx/core/ui/text-range';
import { CupertinoSearchTextField } from '@nelyx/cupertino/search-field';
import { CupertinoTextField } from '@nelyx/cupertino/text-field';
import { CupertinoTextMagnifier } from '@nelyx/cupertino/magnifier';
import { AdaptiveTextSelectionToolbar } from '@nelyx/material/adaptive-text-selection-toolbar';
import { AppBar } from '@nelyx/material/app-bar';
import { IconButton } from '@nelyx/material/icon-button';
import { Icons } from '@nelyx/material/icons';
import { InputDecoration } from '@nelyx/material/input-decoration';
import { TextMagnifier } from '@nelyx/material/magnifier';
import { Scaffold } from '@nelyx/material/scaffold';
import { SelectableText } from '@nelyx/material/selectable-text';
import { SelectionArea } from '@nelyx/material/selection-area';
import { TextButton } from '@nelyx/material/text-button';
import { TextField } from '@nelyx/material/text-field';
import { TextFormField } from '@nelyx/material/text-form-field';
import {
  materialTextSelectionControls,
  materialTextSelectionHandleControls,
} from '@nelyx/material/text-selection';
import { Theme } from '@nelyx/material/theme';
import { getFrontendHost } from '@nelyx/sdk/frontend/dom/environment';

const greeting = '안녕하세요 Nelyx 👋 שלום';
const selectionSurface = (id: string, child: Widget) =>
  new Semantics({ identifier: 'w6-' + id, container: true, explicitChildNodes: true, child });
const multiline = [
  greeting,
  'Second line 선택 영역 🚀',
  'مرحبا · Edge scrolling',
  'Fourth line · 한글',
  'Fifth line · Wrap a selection 😊',
  '마지막 줄 Select to the edge',
].join('\n');
const selectionStyle = new TextStyle({
  fontFamilyFallback: ['NelyxHebrew', 'NelyxArabic', 'NelyxEmoji'],
});
const rich = (text: string) =>
  new TextSpan({
    text,
    style: selectionStyle,
    children: [new TextSpan({ text: ' · 강조 😊', style: new TextStyle({ color: 0xff7260c8 }) })],
  });
const materialReadOnly = rich('읽기 전용 Material 👋');
const coreReadOnly = rich('Core selection · 한글');

function selectionExamples(children: readonly Widget[], safeArea: EdgeInsets): Widget {
  // Mount these finite examples when entering the route so scrolling can reuse
  // their editors and paint recordings. Each sliver culls its own row.
  return new CustomScrollView({
    primary: false,
    semanticChildCount: children.length,
    slivers: children.map(
      (child, index) =>
        new SliverToBoxAdapter({
          child: new Padding(
            EdgeInsets.fromLTRB(
              20 + safeArea.left,
              index === 0 ? 20 : 0,
              20 + safeArea.right,
              12 + (index === children.length - 1 ? 20 + safeArea.bottom : 0),
            ),
            new IndexedSemantics({ index, child: new RepaintBoundary(child) }),
          ),
        }),
    ),
  });
}

declare global {
  interface Window {
    nelyxDemoSelectionProbe?: (id: string, text: string) => void;
    nelyxDemoMagnifierProbe?: (
      id: string,
      read: () => { info: MagnifierInfo; exists: boolean; shown: boolean },
    ) => void;
  }
}

const nullMagnifier = new TextMagnifierConfiguration({ magnifierBuilder: () => null });
const cupertinoMagnifier = new TextMagnifierConfiguration({
  magnifierBuilder: (_context, controller, magnifierInfo) =>
    new CupertinoTextMagnifier({ controller, magnifierInfo }),
});

function reportReadOnlySelection(id: string, span: TextSpan, anchor: number, focus: number) {
  window.nelyxDemoSelectionProbe?.(
    id,
    span.toPlainText().slice(Math.min(anchor, focus), Math.max(anchor, focus)),
  );
}

const spellCheckConfiguration = new SpellCheckConfiguration({
  spellCheckService: {
    async fetchSpellCheckSuggestions(_locale, text) {
      const start = text.indexOf('teh');
      return start < 0
        ? []
        : [new SuggestionSpan(new TextRange({ start, end: start + 3 }), ['the'])];
    },
  },
});

export class TextSelectionScreen extends StatefulWidget {
  constructor(readonly navigator: NavigatorController) {
    super();
  }
  createState(): State<TextSelectionScreen> {
    return new TextSelectionScreenState();
  }
}

class TextSelectionScreenState extends State<TextSelectionScreen> {
  private readonly observedMagnifiers = new Map<string, TextMagnifierConfiguration>();
  private observeMagnifier(
    id: string,
    configuration: TextMagnifierConfiguration,
  ): TextMagnifierConfiguration {
    const probe = window.nelyxDemoMagnifierProbe;
    if (!probe || configuration === TextMagnifierConfiguration.disabled) return configuration;
    let observed = this.observedMagnifiers.get(id);
    if (!observed) {
      observed = new TextMagnifierConfiguration({
        shouldDisplayHandlesInMagnifier: configuration.shouldDisplayHandlesInMagnifier,
        magnifierBuilder: (context, controller, info) => {
          probe(id, () => ({
            info: info.value,
            exists: controller.overlayEntry !== null,
            shown: controller.shown,
          }));
          return configuration.magnifierBuilder(context, controller, info);
        },
      });
      this.observedMagnifiers.set(id, observed);
    }
    return observed;
  }
  private readonly fields = {
    material: new TextEditingController(greeting),
    materialMultiline: new TextEditingController(multiline),
    cupertino: new TextEditingController(greeting),
    cupertinoMultiline: new TextEditingController(multiline),
    empty: new TextEditingController(),
    readOnly: new TextEditingController(greeting),
    password: new TextEditingController('SamplePassword'),
    noSelection: new TextEditingController(greeting),
    disabled: new TextEditingController(greeting),
    search: new TextEditingController('Nelyx 검색'),
    rtl: new TextEditingController('שלום Nelyx · 한글 😊'),
    legacy: new TextEditingController('Legacy selection controls'),
    spell: new TextEditingController('Fix teh word'),
    noLens: new TextEditingController(greeting),
    nullLens: new TextEditingController(greeting),
  };
  override dispose(): void {
    for (const field of Object.values(this.fields)) field.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const theme = Theme.of(context),
      deployment = getFrontendHost();
    const messenger = context.services.binaryMessenger;
    const desktopBrowser =
      deployment.target === 'web' && !['android', 'iOS'].includes(deployment.os);
    const nativeMenu = BrowserContextMenu.usesNativeMenu(
      context.services.nativeSelectionContextMenu,
      messenger,
    );
    const f = this.fields;
    const field = (
      id: string,
      label: string,
      controller: TextEditingController,
      options: Partial<import('@nelyx/material/text-field').TextFieldOptions> = {},
    ) =>
      new TextField({
        id: 'w6-' + id,
        controller,
        decoration: new InputDecoration({ labelText: label }),
        style: selectionStyle,
        ...options,
        magnifierConfiguration: this.observeMagnifier(
          id,
          options.magnifierConfiguration ?? TextMagnifier.adaptiveMagnifierConfiguration,
        ),
      });
    const section = (title: string, child: Widget): Widget[] => [
      new Text(title, { fontSize: 14 }),
      new SizedBox(undefined, 6),
      child,
    ];
    const safeArea = MediaQuery.paddingOf(context);
    return new Scaffold({
      appBar: new AppBar({
        title: new Text('Text selection'),
        leading: new IconButton({
          icon: new Icon(Icons.arrow_back, { semanticLabel: 'Back' }),
          tooltip: 'Back',
          onPressed: () => {
            void this.widget.navigator.pop();
          },
        }),
        actions:
          desktopBrowser && messenger
            ? [
                new TextButton({
                  child: new Text(nativeMenu ? 'Use Nelyx menus' : 'Use browser menus'),
                  onPressed: () => {
                    void (
                      nativeMenu
                        ? BrowserContextMenu.disableContextMenu(messenger)
                        : BrowserContextMenu.enableContextMenu(messenger)
                    )
                      .then(() => {
                        if (this.mounted) this.setState(() => {});
                      })
                      .catch((error) => context.services.reportError?.(error));
                  },
                }),
              ]
            : [],
      }),
      body: selectionExamples(
        [
          field('material', 'Material single line', f.material),
          field('multiline', 'Material multiline', f.materialMultiline, {
            minLines: 3,
            maxLines: 3,
          }),
          ...section(
            'Cupertino single line',
            new CupertinoTextField({
              id: 'w6-cupertino',
              placeholder: 'Cupertino single line',
              controller: f.cupertino,
              style: selectionStyle,
            }),
          ),
          ...section(
            'Cupertino multiline',
            new CupertinoTextField({
              id: 'w6-cupertino-multiline',
              placeholder: 'Cupertino multiline',
              controller: f.cupertinoMultiline,
              style: selectionStyle,
              minLines: 3,
              maxLines: 3,
              ...(window.nelyxDemoMagnifierProbe
                ? {
                    magnifierConfiguration: this.observeMagnifier(
                      'cupertino-multiline',
                      cupertinoMagnifier,
                    ),
                  }
                : {}),
            }),
          ),
          field('empty', 'Empty field', f.empty),
          field('read-only', 'Read-only field', f.readOnly, { readOnly: true }),
          field('password', 'Password field', f.password, { obscureText: true }),
          field('no-selection', 'Selection disabled', f.noSelection, {
            enableInteractiveSelection: false,
          }),
          field('disabled', 'Disabled field', f.disabled, { enabled: false }),
          ...section(
            'Material SelectableText.rich',
            selectionSurface(
              'material-readonly',
              SelectableText.rich(materialReadOnly, {
                magnifierConfiguration: this.observeMagnifier(
                  'material-readonly',
                  TextMagnifier.adaptiveMagnifierConfiguration,
                ),
                onSelectionChanged: ({ baseOffset, extentOffset }) =>
                  reportReadOnlySelection(
                    'material-readonly',
                    materialReadOnly,
                    baseOffset,
                    extentOffset,
                  ),
              }),
            ),
          ),
          ...section(
            'Core SelectableText.rich',
            selectionSurface(
              'core-readonly',
              CoreSelectableText.rich(coreReadOnly, {
                onSelectionChanged: ({ anchor, focus }) =>
                  reportReadOnlySelection('core-readonly', coreReadOnly, anchor, focus),
                selectionControls: materialTextSelectionHandleControls,
                magnifierConfiguration: this.observeMagnifier(
                  'core-readonly',
                  TextMagnifier.adaptiveMagnifierConfiguration,
                ),
                contextMenuBuilder: (_context, state) =>
                  AdaptiveTextSelectionToolbar.buttonItems({
                    anchors: state.contextMenuAnchors,
                    buttonItems: state.contextMenuButtonItems,
                  }),
              }),
            ),
          ),
          ...section(
            'SelectionArea paragraphs',
            new SizedBox(
              undefined,
              130,
              new SelectionArea({
                magnifierConfiguration: this.observeMagnifier(
                  'paragraph-selection',
                  TextMagnifier.adaptiveMagnifierConfiguration,
                ),
                onSelectionChanged: (content) =>
                  window.nelyxDemoSelectionProbe?.('paragraph-selection', content?.plainText ?? ''),
                child: new ListView({
                  primary: false,
                  children: [
                    selectionSurface(
                      'paragraph-selection',
                      new Text('첫 문단 Select across lines 👋'),
                    ),
                    selectionSurface(
                      'paragraph-second',
                      Text.rich(rich('Second paragraph — שלום')),
                    ),
                    new Text('세 번째 문단\nA second line about selection 🚀'),
                    new Text('Fourth paragraph\nMove a handle to the edge.'),
                    Text.rich(rich('마지막 문단 — end of the list')),
                  ],
                }),
              }),
            ),
          ),
          ...section(
            'SelectionArea with menu disabled',
            new SelectionArea({
              contextMenuBuilder: null,
              child: selectionSurface(
                'no-region-menu',
                new Text('이 문단은 메뉴 없이 선택할 수 있습니다.'),
              ),
            }),
          ),
          new TextFormField({
            id: 'w6-form',
            initialValue: 'Form 편집',
            decoration: new InputDecoration({ labelText: 'Text form field' }),
          }),
          ...section(
            'Cupertino search field',
            new CupertinoSearchTextField({
              id: 'w6-search',
              controller: f.search,
              placeholder: 'Cupertino search',
            }),
          ),
          new SizedBox(
            undefined,
            64,
            new Overlay({
              initialEntries: [
                new OverlayEntry({
                  builder: () =>
                    new Localizations(
                      'ko-KR',
                      {},
                      'ko-KR',
                      new Directionality(
                        'rtl',
                        new Theme(
                          theme.copyWith({
                            colorScheme: theme.colorScheme.copyWith({
                              primary: 0xff00695c,
                              onSurface: 0xff005246,
                            }),
                          }),
                          field('rtl', 'Local theme and RTL', f.rtl, {
                            contextMenuBuilder: (_context, state) =>
                              AdaptiveTextSelectionToolbar.buttonItems({
                                anchors: state.contextMenuAnchors,
                                buttonItems: [
                                  ...state.contextMenuButtonItems,
                                  new ContextMenuButtonItem({
                                    label: '문장 선택',
                                    onPressed: () => state.selectAll(SelectionChangedCause.toolbar),
                                  }),
                                ],
                              }),
                          }),
                        ),
                      ),
                    ),
                }),
              ],
            }),
          ),
          field('legacy', 'Legacy selection menu', f.legacy, {
            selectionControls: materialTextSelectionControls,
          }),
          field('spell', 'Spell check suggestions', f.spell, { spellCheckConfiguration }),
          field('no-lens', 'Magnifier disabled', f.noLens, {
            magnifierConfiguration: TextMagnifierConfiguration.disabled,
          }),
          field('null-lens', 'Custom magnifier returns null', f.nullLens, {
            magnifierConfiguration: nullMagnifier,
          }),
        ],
        safeArea,
      ),
    });
  }
}
