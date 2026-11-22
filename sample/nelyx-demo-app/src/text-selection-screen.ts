// SPDX-License-Identifier: BSD-3-Clause
import { Directionality, Localizations } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { ContextMenuButtonItem } from '@nelyx/core/framework/widgets/context-menu-button-item';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
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
import { AdaptiveTextSelectionToolbar } from '@nelyx/material/adaptive-text-selection-toolbar';
import { AppBar } from '@nelyx/material/app-bar';
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
import { getWebDeployment } from '@nelyx/sdk/platforms/web/environment';

const greeting = '안녕하세요 Nelyx 👋 שלום';
const selectionSurface = (id: string, child: Widget) =>
  new Semantics({ identifier: 'w6-' + id, container: true, explicitChildNodes: true, child });
const multiline = `${greeting}\nSecond line 선택 영역 🚀\nمرحبا · Edge scrolling`;
const rich = (text: string) =>
  new TextSpan({
    text,
    children: [new TextSpan({ text: ' · 강조 😊', style: new TextStyle({ color: 0xff7260c8 }) })],
  });
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
  };
  override dispose(): void {
    for (const field of Object.values(this.fields)) field.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const theme = Theme.of(context),
      deployment = getWebDeployment();
    const messenger = context.services.binaryMessenger;
    const desktopBrowser =
      deployment.host === 'browser' && !['android', 'iOS'].includes(deployment.os);
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
        ...options,
      });
    const section = (title: string, child: Widget): Widget[] => [
      new Text(title, { fontSize: 14 }),
      new SizedBox(undefined, 6),
      child,
    ];
    return new Scaffold({
      appBar: new AppBar({
        title: new Text('Text selection'),
        leading: new TextButton({
          child: new Text('Back'),
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
      body: new ListView({
        primary: false,
        padding: EdgeInsets.all(20),
        children: [
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
            }),
          ),
          ...section(
            'Cupertino multiline',
            new CupertinoTextField({
              id: 'w6-cupertino-multiline',
              placeholder: 'Cupertino multiline',
              controller: f.cupertinoMultiline,
              minLines: 3,
              maxLines: 3,
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
              SelectableText.rich(rich('읽기 전용 Material 👋')),
            ),
          ),
          ...section(
            'Core SelectableText.rich',
            selectionSurface(
              'core-readonly',
              CoreSelectableText.rich(rich('Core selection · 한글'), {
                selectionControls: materialTextSelectionHandleControls,
                magnifierConfiguration: TextMagnifier.adaptiveMagnifierConfiguration,
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
                child: new ListView({
                  primary: false,
                  children: [
                    selectionSurface(
                      'paragraph-selection',
                      new Text('첫 문단 Select across lines 👋'),
                    ),
                    Text.rich(rich('Second paragraph — שלום')),
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
        ].flatMap((child) => [child, new SizedBox(undefined, 12)]),
      }),
    });
  }
}
