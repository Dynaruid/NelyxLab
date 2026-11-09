// SPDX-License-Identifier: BSD-3-Clause
// Components layout inspired by DorotiDemoApp; see LICENSE.flutter.
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ValueKey } from '@nelyx/core/foundation/key';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import {
  Align,
  Center,
  Column,
  Row,
  Expanded,
  Padding,
  Text,
  SizedBox,
  DecoratedBox,
} from '@nelyx/core/framework/widgets/basic';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import {
  Curve,
  Curves,
  Interval,
  nativeCurveConfiguration,
  registerNativeCurveConfiguration,
} from '@nelyx/core/framework/animation/curves';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { TextFieldTapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { CustomSemanticsAction, OrdinalSortKey } from '@nelyx/core/framework/semantics/semantics';
import type { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Theme } from '@nelyx/material/theme';
import { FilledButton } from '@nelyx/material/filled-button';
import { ElevatedButton } from '@nelyx/material/elevated-button';
import { OutlinedButton } from '@nelyx/material/outlined-button';
import { TextButton } from '@nelyx/material/text-button';
import { IconButton } from '@nelyx/material/icon-button';
import { Icons } from '@nelyx/material/icons';
import { Card } from '@nelyx/material/card';
import { Badge } from '@nelyx/material/badge';
import { Divider } from '@nelyx/material/divider';
import { Checkbox } from '@nelyx/material/checkbox';
import { Radio } from '@nelyx/material/radio';
import { Switch } from '@nelyx/material/switch';
import { Slider } from '@nelyx/material/slider';
import { RangeSlider } from '@nelyx/material/range-slider';
import { RangeValues, RangeLabels } from '@nelyx/material/range-slider-values';
import { SliderTheme } from '@nelyx/material/slider-theme';
import {
  LinearProgressIndicator,
  CircularProgressIndicator,
} from '@nelyx/material/progress-indicator';
import { ActionChip } from '@nelyx/material/action-chip';
import { ChoiceChip } from '@nelyx/material/choice-chip';
import { FilterChip } from '@nelyx/material/filter-chip';
import { TextField } from '@nelyx/material/text-field';
import { InputDecoration } from '@nelyx/material/input-decoration';
import { OutlineInputBorder } from '@nelyx/material/input-border';
import { showDialog } from '@nelyx/material/dialog';
import { GallerySection, GallerySectionExtents, GalleryUpdates } from './gallery-section.ts';
import { ImageDemo } from './image-demo.ts';
import { column, flow, inset, icon } from './layout.ts';
import { demoRangeTheme } from './range-demo-shapes.ts';

const messageCurve = new Interval(0.1, 0.9, { curve: Curves.easeInOutCubicEmphasized });
class MessageScrollCurve extends Curve {
  protected override transformInternal(t: number): number {
    return messageCurve.transform(t);
  }
}
registerNativeCurveConfiguration(MessageScrollCurve.prototype, () =>
  nativeCurveConfiguration(messageCurve),
);
const curvedMessageScroll = new MessageScrollCurve();

const groups = [
  'Actions',
  'Communication',
  'Containment',
  'Navigation',
  'Selection',
  'Text inputs',
  'Images',
] as const;
type Group = (typeof groups)[number];
interface Demo {
  readonly id: string;
  readonly title: string;
  readonly group: Group;
}
const demos: readonly Demo[] = [
  { id: 'buttons', title: 'Common buttons', group: 'Actions' },
  { id: 'icon-buttons', title: 'Icon buttons', group: 'Actions' },
  { id: 'badges', title: 'Badges', group: 'Communication' },
  { id: 'progress', title: 'Progress indicators', group: 'Communication' },
  { id: 'cards', title: 'Cards', group: 'Containment' },
  { id: 'dialog', title: 'Dialogs', group: 'Containment' },
  { id: 'dividers', title: 'Dividers', group: 'Containment' },
  { id: 'navigation', title: 'Destinations and drawer', group: 'Navigation' },
  { id: 'checkboxes', title: 'Checkboxes', group: 'Selection' },
  { id: 'chips', title: 'Chips', group: 'Selection' },
  { id: 'radios', title: 'Radio buttons', group: 'Selection' },
  { id: 'sliders', title: 'Sliders', group: 'Selection' },
  { id: 'switches', title: 'Switches', group: 'Selection' },
  { id: 'text-fields', title: 'Text fields', group: 'Text inputs' },
  { id: 'image', title: 'Local and network images', group: 'Images' },
];

export class ComponentsScreen extends StatefulWidget {
  constructor(
    readonly navigator: NavigatorController,
    readonly initialText: string,
    readonly dark: boolean,
    readonly toggleBrightness: () => void,
  ) {
    super();
  }
  createState(): State<ComponentsScreen> {
    return new ComponentsState();
  }
}

class ComponentsState extends State<ComponentsScreen> {
  private readonly updates = new GalleryUpdates();
  private readonly firstScroll = new ScrollController({ debugLabel: 'demo-first' });
  private readonly secondScroll = new ScrollController({ debugLabel: 'demo-second' });
  private readonly firstExtents = new GallerySectionExtents();
  private readonly secondExtents = new GallerySectionExtents();
  private readonly sectionKeys = new Map(
    demos.map(
      (demo) =>
        [
          demo.id,
          demo.id === 'text-fields' ? new GlobalKey('Demo editors') : new ValueKey(demo.id),
        ] as const,
    ),
  );
  private readonly primaryMessageScroll = new ScrollController();
  private readonly alternateMessageScroll = new ScrollController();
  private messageAlternate = false;
  private get messageScroll(): ScrollController {
    return this.messageAlternate ? this.alternateMessageScroll : this.primaryMessageScroll;
  }
  private messageAnimation = 0;
  private readonly keyboardFocus = new FocusNode({ debugLabel: 'Demo keyboard' });
  private keyboardMessage =
    'Choose Test keyboard, then press a key. Tab moves to the next control.';
  private readonly radioToken = {};
  private filled!: TextEditingController;
  private outlined!: TextEditingController;
  private group: Group | null = null;
  private lastAction = 'Try a component to see it in action.';
  private multilineMessage = true;
  private obscureMessage = false;
  private interactiveMessage = true;
  private checked: boolean | null = true;
  private mixed: boolean | null = null;
  private selectedRadio = 'first';
  private switched = false;
  private favorite = false;
  private chip = 'Day';
  private filtered = true;
  private slider = 30;
  private range = new RangeValues(20, 80);
  private customRange = new RangeValues(25, 75);
  private rangeEnabled = true;
  private rangeRtl = false;
  private rangeCustom = true;
  private progress = false;
  private messages = 9;
  private readonly markMessagesRead = new CustomSemanticsAction({
    label: 'Mark all messages as read',
  });
  private destination = 'Home';

  override initState(): void {
    this.filled = new TextEditingController(this.widget.initialText);
    this.outlined = new TextEditingController('Material 3');
    this.keyboardFocus.onKeyEvent = (_, event) => {
      this.updates.change('text-fields', () => {
        this.keyboardMessage = `${event.kind === 'up' ? 'Up' : event.repeat ? 'Repeat' : 'Down'} · ${event.key} · ${event.physicalKey.debugName}`;
      });
      return event.key === 'Tab' ? 'ignored' : 'handled';
    };
  }
  override dispose(): void {
    ++this.messageAnimation;
    this.updates.dispose();
    this.firstScroll.dispose();
    this.secondScroll.dispose();
    this.primaryMessageScroll.dispose();
    this.alternateMessageScroll.dispose();
    this.keyboardFocus.dispose();
    this.filled.dispose();
    this.outlined.dispose();
    super.dispose();
  }
  private record(action: string): void {
    this.lastAction = action;
    this.updates.status.notifyListeners();
  }
  private select(group: Group | null): void {
    this.firstExtents.reset();
    this.secondExtents.reset();
    this.setState(() => {
      this.group = group;
    });
    for (const controller of [this.firstScroll, this.secondScroll])
      if (controller.hasClients) controller.jumpTo(0);
    this.record(group ? group + ' components' : 'All components');
  }
  private openDialog(): void {
    const navigator = this.widget.navigator;
    void showDialog(
      navigator,
      (context) =>
        new LayoutBuilder((_, constraints) => {
          const colors = Theme.of(context).colorScheme;
          return new SizedBox(
            Math.min(440, constraints.maxWidth - 48),
            undefined,
            new DecoratedBox(
              inset(
                24,
                column(
                  new Text('What is a dialog?', { fontSize: 24, color: colors.onSurface }),
                  new Text(
                    'A dialog keeps your place while you make a decision. Close this dialog to return to the gallery.',
                    { color: colors.onSurface },
                  ),
                  new FilledButton({
                    id: 'demo-dialog-close',
                    child: new Text('Close'),
                    onPressed: () => {
                      void navigator.pop();
                    },
                  }),
                ),
              ),
              colors.surface,
              24,
            ),
          );
        }),
    )
      .then(() => {
        if (this.mounted) this.record('Dialog closed');
      })
      .catch((error) => {
        if (this.mounted) this.record(String(error));
      });
  }
  private openDrawer(): void {
    const navigator = this.widget.navigator;
    void showDialog<string>(
      navigator,
      (context) =>
        new LayoutBuilder((_, constraints) => {
          const width = Math.min(320, constraints.maxWidth);
          const colors = Theme.of(context).colorScheme;
          return new Align(
            new SizedBox(
              width,
              constraints.maxHeight,
              new DecoratedBox(
                inset(
                  20,
                  column(
                    new Row([
                      new Expanded(
                        new Text('Nelyx Demo', { fontSize: 22, color: colors.onSurface }),
                      ),
                      new IconButton({
                        icon: icon(Icons.close),
                        tooltip: 'Close drawer',
                        onPressed: () => {
                          void navigator.pop();
                        },
                      }),
                    ]),
                    new Text('Explore components', { color: colors.onSurfaceVariant }),
                    new Divider(),
                    new Expanded(
                      new ListView({
                        children: ['All components', ...groups].map(
                          (label, index) =>
                            new TextButton({
                              child: new Text(label),
                              onPressed: () => {
                                void navigator.pop(index === 0 ? 'all' : groups[index - 1]!);
                              },
                            }),
                        ),
                        primary: false,
                      }),
                    ),
                  ),
                ),
                colors.surface,
              ),
            ),
            { alignment: { x: 1, y: 0 } },
          );
        }),
      { name: 'component-drawer', barrierLabel: 'Close drawer' },
    )
      .then((selected) => {
        if (this.mounted && selected !== undefined)
          this.select(selected === 'all' ? null : (selected as Group));
      })
      .catch((error) => {
        if (this.mounted) this.record(String(error));
      });
  }
  build(): Widget {
    return new LayoutBuilder((context, constraints) => {
      const colors = Theme.of(context).colorScheme;
      const twoColumns = constraints.maxWidth > 1000 && this.group === null;
      const compact = constraints.maxWidth < 600;
      const items = demos.filter((demo) => this.group === null || demo.group === this.group);
      // Editors stay with one scroll owner when the window crosses the breakpoint.
      const primary = items.filter((demo, index) => demo.id === 'text-fields' || index % 2 === 0);
      const secondary = items.filter((demo, index) => demo.id !== 'text-fields' && index % 2 !== 0);
      const list = (entries: readonly Demo[], controller: ScrollController): Widget =>
        ListView.builder({
          controller,
          primary: false,
          extentIndex: (controller === this.firstScroll
            ? this.firstExtents
            : this.secondExtents
          ).forItems(entries.map((entry) => entry.id)),
          metricRevision: Theme.of(context),
          childPolicy: { mode: 'bounded', capacity: 2, preparation: 'disabled' },
          padding: EdgeInsets.only({ bottom: 20 }),
          itemCount: entries.length,
          findChildIndexCallback: (key) => {
            const index = entries.findIndex((entry) => this.sectionKeys.get(entry.id) === key);
            return index < 0 ? null : index;
          },
          itemBuilder: (_, index) => {
            const entry = entries[index]!;
            return new GallerySection(
              new RepaintBoundary(
                new ListenableBuilder(this.updates.section(entry.id), (itemContext) =>
                  this.section(itemContext, entry),
                ),
              ),
              entry.id === 'text-fields',
              this.sectionKeys.get(entry.id)!,
            );
          },
        });
      return new DecoratedBox(
        new Column(
          [
            new Padding(
              EdgeInsets.fromLTRB(compact ? 16 : 28, 12, compact ? 8 : 20, 12),
              new Row(
                [
                  new Expanded(
                    column(
                      new Text('Components', {
                        fontSize: compact ? 24 : 28,
                        color: colors.onSurface,
                      }),
                      new Text('Nelyx Demo · Material 3', {
                        fontSize: 12,
                        color: colors.onSurfaceVariant,
                      }),
                    ),
                  ),
                  new TextFieldTapRegion(
                    new IconButton({
                      id: 'toggle-theme',
                      icon: icon(this.widget.dark ? Icons.light_mode : Icons.dark_mode),
                      tooltip: this.widget.dark ? 'Switch to light mode' : 'Switch to dark mode',
                      onPressed: this.widget.toggleBrightness,
                    }),
                  ),
                  new IconButton({
                    id: 'open-drawer',
                    icon: icon(Icons.menu),
                    tooltip: 'Explore components',
                    onPressed: () => this.openDrawer(),
                  }),
                ],
                { crossAlign: 'center', spacing: 8 },
              ),
            ),
            new Divider({ height: 1 }),
            ...(this.group === null
              ? []
              : [
                  new Padding(
                    EdgeInsets.symmetric({ horizontal: 16, vertical: 8 }),
                    flow(
                      new Text(this.group, { color: colors.primary }),
                      new TextButton({
                        child: new Text('Show all'),
                        onPressed: () => this.select(null),
                      }),
                    ),
                  ),
                ]),
            new Expanded(
              new Padding(
                EdgeInsets.fromLTRB(compact ? 12 : 24, 16, compact ? 12 : 24, 0),
                new Row(
                  [
                    new Expanded(list(twoColumns ? primary : items, this.firstScroll)),
                    ...(twoColumns
                      ? [new SizedBox(20), new Expanded(list(secondary, this.secondScroll))]
                      : []),
                  ],
                  { crossAlign: 'stretch' },
                ),
              ),
            ),
            new Padding(
              EdgeInsets.fromLTRB(20, 6, 20, 10),
              new ListenableBuilder(
                this.updates.status,
                () =>
                  new Text(this.lastAction, {
                    fontSize: 12,
                    color: colors.onSurfaceVariant,
                    maxLines: 1,
                    overflow: 'ellipsis',
                  }),
              ),
            ),
          ],
          { crossAlign: 'stretch', mainSize: 'max' },
        ),
        colors.surface,
      );
    });
  }
  private section(context: BuildContext, demo: Demo): Widget {
    const colors = Theme.of(context).colorScheme;
    return new Padding(
      EdgeInsets.only({ bottom: 16 }),
      Card.outlined({
        margin: EdgeInsets.zero,
        child: inset(
          20,
          column(
            new Text(demo.group, { fontSize: 11, color: colors.primary }),
            new Text(demo.title, { fontSize: 18, color: colors.onSurface }),
            new SizedBox(0, 2),
            this.demo(context, demo.id),
          ),
        ),
      }),
    );
  }
  private demo(context: BuildContext, id: string): Widget {
    const update = (change: () => void) => this.updates.change(id, change);
    const colors = Theme.of(context).colorScheme;
    switch (id) {
      case 'navigation':
        return column(
          flow(
            ...['Home', 'Favorites', 'Settings'].map(
              (label) =>
                new ChoiceChip({
                  label: new Text(label),
                  selected: this.destination === label,
                  onSelected: () =>
                    update(() => {
                      this.destination = label;
                    }),
                }),
            ),
          ),
          new Text(this.destination + ' selected'),
          new OutlinedButton({
            child: new Text('Show navigation drawer'),
            onPressed: () => this.openDrawer(),
          }),
        );
      case 'image':
        return new ImageDemo();
      case 'buttons': {
        const press = (name: string) => () => this.record(name + ' pressed');
        return column(
          flow(
            new ElevatedButton({
              id: 'demo-elevated',
              child: new Text('Elevated'),
              onPressed: press('Elevated'),
            }),
            new FilledButton({
              id: 'demo-filled',
              child: new Text('Filled'),
              onPressed: press('Filled'),
            }),
            FilledButton.tonal({
              id: 'demo-tonal',
              child: new Text('Tonal'),
              onPressed: press('Tonal'),
            }),
            new OutlinedButton({
              id: 'demo-outlined',
              child: new Text('Outlined'),
              onPressed: press('Outlined'),
            }),
            new TextButton({ id: 'demo-text', child: new Text('Text'), onPressed: press('Text') }),
          ),
          flow(
            FilledButton.icon({
              id: 'demo-icon-filled',
              icon: icon(Icons.add),
              label: new Text('Create'),
              onPressed: press('Create'),
            }),
            new FilledButton({ id: 'demo-disabled', child: new Text('Disabled'), onPressed: null }),
          ),
        );
      }
      case 'icon-buttons': {
        const options = {
          icon: icon(Icons.favorite_border),
          selectedIcon: icon(Icons.favorite),
          isSelected: this.favorite,
          onPressed: () =>
            update(() => {
              this.favorite = !this.favorite;
            }),
        };
        return flow(
          new IconButton({ ...options, id: 'favorite-standard', tooltip: 'Favorite' }),
          IconButton.filled({ ...options, id: 'favorite-filled', tooltip: 'Filled favorite' }),
          IconButton.filledTonal({ ...options, id: 'favorite-tonal', tooltip: 'Tonal favorite' }),
          IconButton.outlined({
            ...options,
            id: 'favorite-outlined',
            tooltip: 'Outlined favorite',
          }),
        );
      }
      case 'badges': {
        const markRead = () => {
          update(() => {
            this.messages = 0;
          });
          this.record('Messages marked as read');
        };
        return column(
          new Semantics({
            identifier: 'demo-inbox',
            label: 'Inbox',
            explicitChildNodes: true,
            customSemanticsActions: this.messages
              ? new Map([[this.markMessagesRead, markRead]])
              : null,
            child: flow(
              new Semantics({
                identifier: 'demo-add-message',
                sortKey: new OrdinalSortKey(2, { name: 'inbox' }),
                child: Badge.count({
                  count: this.messages,
                  child: new IconButton({
                    id: 'badge-mail',
                    icon: icon(Icons.mail_outline),
                    tooltip: 'Add message',
                    onPressed: () =>
                      update(() => {
                        this.messages++;
                      }),
                  }),
                }),
              }),
              new Semantics({
                identifier: 'demo-message-count',
                sortKey: new OrdinalSortKey(1, { name: 'inbox' }),
                child: new Text(this.messages + ' messages', { fontSize: 12 }),
              }),
              new Semantics({
                identifier: 'demo-mark-read',
                sortKey: new OrdinalSortKey(3, { name: 'inbox' }),
                child: new TextButton({
                  child: new Text('Mark all as read'),
                  onPressed: this.messages ? markRead : null,
                }),
              }),
            ),
          }),
          flow(
            Badge.count({
              count: 9999,
              child: new SizedBox(48, 32, new Center(icon(Icons.notifications_none))),
            }),
            new Badge({ child: new SizedBox(40, 32, new Center(icon(Icons.mail_outline))) }),
          ),
        );
      }
      case 'progress':
        return column(
          new Row(
            [
              new RepaintBoundary(
                new CircularProgressIndicator({ value: this.progress ? null : 0.65 }),
              ),
              new SizedBox(20),
              new Expanded(
                new RepaintBoundary(
                  new LinearProgressIndicator({ value: this.progress ? null : 0.65 }),
                ),
              ),
            ],
            { crossAlign: 'center' },
          ),
          new TextButton({
            id: 'toggle-progress',
            child: new Text(this.progress ? 'Stop animation' : 'Animate progress'),
            onPressed: () =>
              update(() => {
                this.progress = !this.progress;
              }),
          }),
        );
      case 'cards': {
        const content = (label: string): Widget =>
          inset(
            16,
            column(
              icon(Icons.landscape, colors.primary, 28),
              new Text(label, { fontSize: 13 }),
              new Text('Build something beautiful.', {
                fontSize: 11,
                color: colors.onSurfaceVariant,
              }),
            ),
          );
        return column(
          new Card({ margin: EdgeInsets.zero, child: content('Elevated card') }),
          Card.filled({ margin: EdgeInsets.zero, child: content('Filled card') }),
          Card.outlined({ margin: EdgeInsets.zero, child: content('Outlined card') }),
        );
      }
      case 'dialog':
        return new OutlinedButton({
          id: 'open-dialog',
          child: new Text('Open basic dialog'),
          onPressed: () => this.openDialog(),
        });
      case 'dividers':
        return column(
          new Text('Above', { fontSize: 12 }),
          new Divider(),
          new Text('Below', { fontSize: 12 }),
        );
      case 'checkboxes':
        return flow(
          new Checkbox({
            id: 'check-value',
            value: this.checked,
            onChanged: (value) =>
              update(() => {
                this.checked = value;
              }),
          }),
          new Text(this.checked ? 'Checked' : 'Unchecked', { fontSize: 12 }),
          new Checkbox({
            id: 'check-mixed',
            value: this.mixed,
            tristate: true,
            onChanged: (value) =>
              update(() => {
                this.mixed = value;
              }),
          }),
          new Checkbox({ id: 'check-disabled', value: true, onChanged: null }),
        );
      case 'chips':
        return column(
          flow(
            ...['Day', 'Week', 'Month'].map(
              (label) =>
                new ChoiceChip({
                  label: new Text(label),
                  selected: this.chip === label,
                  onSelected: () =>
                    update(() => {
                      this.chip = label;
                    }),
                }),
            ),
          ),
          flow(
            new FilterChip({
              label: new Text('Filter'),
              selected: this.filtered,
              onSelected: (value) =>
                update(() => {
                  this.filtered = value;
                }),
            }),
            new ActionChip({
              avatar: icon(Icons.add, colors.primary, 18),
              label: new Text('Add item'),
              onPressed: () => this.record('Chip added an item'),
            }),
          ),
        );
      case 'radios':
        return new RadioGroup<string>({
          typeToken: this.radioToken,
          groupValue: this.selectedRadio,
          onChanged: (value) =>
            update(() => {
              if (value !== null) this.selectedRadio = value;
            }),
          child: flow(
            ...['first', 'second', 'third'].map(
              (value, index) =>
                new Row(
                  [
                    new Radio({ id: 'radio-' + value, value, groupToken: this.radioToken }),
                    new Text(['First', 'Second', 'Third'][index]!, { fontSize: 12 }),
                  ],
                  { mainSize: 'min', crossAlign: 'center' },
                ),
            ),
          ),
        });
      case 'sliders':
        return column(
          new Slider({
            id: 'slider-value',
            value: this.slider,
            min: 0,
            max: 100,
            divisions: 10,
            label: String(this.slider),
            onChanged: (value) =>
              update(() => {
                this.slider = value;
              }),
          }),
          new Text('Value ' + Math.round(this.slider), { fontSize: 12 }),
          new RangeSlider({
            id: 'range-value',
            values: this.range,
            labels: new RangeLabels(
              String(Math.round(this.range.start)),
              String(Math.round(this.range.end)),
            ),
            min: 0,
            max: 100,
            divisions: 10,
            onChanged: (values) =>
              update(() => {
                this.range = values;
              }),
          }),
          new Text('Range ' + Math.round(this.range.start) + ' – ' + Math.round(this.range.end), {
            fontSize: 12,
          }),
          new Directionality(
            this.rangeRtl ? 'rtl' : 'ltr',
            new SliderTheme(
              this.rangeCustom ? demoRangeTheme : SliderTheme.of(context),
              new RangeSlider({
                id: 'range-custom',
                values: this.customRange,
                min: 0,
                max: 100,
                divisions: 200,
                labels: new RangeLabels(
                  this.customRange.start.toFixed(1),
                  this.customRange.end.toFixed(1),
                ),
                onChanged: this.rangeEnabled
                  ? (values) =>
                      update(() => {
                        this.customRange = values;
                      })
                  : null,
              }),
            ),
          ),
          new Text(
            `Custom range ${this.customRange.start.toFixed(1)} – ${this.customRange.end.toFixed(1)}`,
            { fontSize: 12 },
          ),
          flow(
            new TextButton({
              id: 'range-toggle-enabled',
              child: new Text(this.rangeEnabled ? 'Disable range' : 'Enable range'),
              onPressed: () =>
                update(() => {
                  this.rangeEnabled = !this.rangeEnabled;
                }),
            }),
            new TextButton({
              id: 'range-toggle-direction',
              child: new Text(this.rangeRtl ? 'Use LTR' : 'Use RTL'),
              onPressed: () =>
                update(() => {
                  this.rangeRtl = !this.rangeRtl;
                }),
            }),
            new TextButton({
              id: 'range-toggle-style',
              child: new Text(this.rangeCustom ? 'Use standard shapes' : 'Use custom shapes'),
              onPressed: () =>
                update(() => {
                  this.rangeCustom = !this.rangeCustom;
                }),
            }),
          ),
        );
      case 'switches':
        return flow(
          new Switch({
            id: 'switch-value',
            value: this.switched,
            onChanged: (value) =>
              update(() => {
                this.switched = value;
              }),
          }),
          new Text(this.switched ? 'On' : 'Off', { fontSize: 12 }),
          new Switch({ id: 'switch-disabled', value: true, onChanged: null }),
        );
      case 'text-fields':
        return column(
          new Focus(
            column(
              new TextButton({
                id: 'demo-test-keyboard',
                child: new Text('Test keyboard'),
                onPressed: () => this.keyboardFocus.requestFocus(),
              }),
              new Semantics({
                child: new Text(this.keyboardMessage, { fontSize: 12 }),
                identifier: 'demo-keyboard-result',
                liveRegion: true,
              }),
            ),
            { focusNode: this.keyboardFocus },
          ),
          new TextField({
            id: 'field-filled',
            controller: this.filled,
            maxLength: 20,
            enableInteractiveSelection: this.interactiveMessage,
            obscureText: this.obscureMessage,
            decoration: new InputDecoration({
              filled: true,
              labelText: 'Write something',
              hintText: 'Korean · emoji · 20 graphemes',
              helperText: '조합 입력은 확정 후 길이를 제한합니다.',
            }),
            onSubmitted: (text) => this.record('Submitted: ' + text),
          }),
          new TextField({
            id: 'field-outlined',
            controller: this.outlined,
            scrollController: this.messageScroll,
            enableInteractiveSelection: this.interactiveMessage,
            minLines: this.multilineMessage ? 2 : null,
            maxLines: this.multilineMessage ? 4 : 1,
            decoration: new InputDecoration({
              labelText: 'Your message',
              border: new OutlineInputBorder(),
              helperText: this.multilineMessage
                ? 'Enter로 줄바꿈 · Ctrl+Enter로 제출'
                : 'Enter로 제출',
              errorText: this.outlined.text.length === 0 ? '메시지를 입력하세요.' : null,
            }),
            onChanged: () => update(() => {}),
            onSubmitted: () => this.record('Message submitted'),
          }),
          new TextFieldTapRegion(
            flow(
              new TextButton({
                id: 'toggle-secure-input',
                child: new Text(this.obscureMessage ? 'Show input' : 'Secure input'),
                onPressed: () =>
                  update(() => {
                    this.obscureMessage = !this.obscureMessage;
                  }),
              }),
              new TextButton({
                child: new Text('Clear messages'),
                onPressed: () => {
                  if (!this.filled.isComposing && !this.outlined.isComposing) {
                    this.filled.clear();
                    this.outlined.clear();
                    update(() => {});
                  }
                },
              }),
              new TextButton({
                child: new Text('Undo message'),
                onPressed: () => {
                  this.outlined.undo();
                  update(() => {});
                },
              }),
            ),
          ),
          new TextFieldTapRegion(
            flow(
              new TextButton({
                id: 'toggle-message-lines',
                child: new Text(this.multilineMessage ? 'Use one line' : 'Use multiple lines'),
                onPressed: () =>
                  update(() => {
                    this.multilineMessage = !this.multilineMessage;
                  }),
              }),
              new TextButton({
                id: 'toggle-message-selection',
                child: new Text(this.interactiveMessage ? 'Disable selection' : 'Enable selection'),
                onPressed: () =>
                  update(() => {
                    this.interactiveMessage = !this.interactiveMessage;
                  }),
              }),
            ),
          ),
          new TextFieldTapRegion(
            flow(
              ...[false, true].map(
                (end) =>
                  new TextButton({
                    id: end ? 'message-scroll-end' : 'message-scroll-top',
                    child: new Text(end ? 'Scroll to end' : 'Scroll to top'),
                    onPressed: () => {
                      if (
                        this.messageScroll.hasClients &&
                        this.messageScroll.position.hasContentDimensions
                      ) {
                        ++this.messageAnimation;
                        this.messageScroll.jumpTo(
                          end ? this.messageScroll.position.maxScrollExtent : 0,
                        );
                        this.record(end ? 'Message scroll end' : 'Message scroll top');
                      }
                    },
                  }),
              ),
              new TextButton({
                id: 'message-load-long',
                child: new Text('Load long message'),
                onPressed: () => {
                  this.outlined.text = Array.from(
                    { length: 12 },
                    (_, i) => `${i + 1}. 안녕하세요 · Nelyx 🌿`,
                  ).join('\n');
                  update(() => {});
                },
              }),
              new TextButton({
                id: 'message-scroll-curve',
                child: new Text('Animate message'),
                onPressed: () => {
                  if (
                    !this.messageScroll.hasClients ||
                    !this.messageScroll.position.hasContentDimensions
                  )
                    return;
                  const revision = ++this.messageAnimation,
                    target =
                      this.messageScroll.offset < this.messageScroll.position.maxScrollExtent / 2
                        ? this.messageScroll.position.maxScrollExtent
                        : 0;
                  this.record('Message scrolling…');
                  void this.messageScroll
                    .animateTo(target, { duration: 900, curve: curvedMessageScroll })
                    .then(
                      () => {
                        if (this.mounted && revision === this.messageAnimation)
                          this.record('Message scroll finished');
                      },
                      (error: unknown) => {
                        if (this.mounted && revision === this.messageAnimation)
                          this.record('Message scroll failed: ' + String(error));
                      },
                    );
                },
              }),
              new TextButton({
                id: 'message-scroll-cancel',
                child: new Text('Stop scrolling'),
                onPressed: () => {
                  ++this.messageAnimation;
                  if (this.messageScroll.hasClients)
                    this.messageScroll.jumpTo(this.messageScroll.offset);
                  this.record('Message scrolling stopped');
                },
              }),
              new TextButton({
                id: 'message-scroll-controller',
                child: new Text('Switch scroll controller'),
                onPressed: () => {
                  ++this.messageAnimation;
                  update(() => {
                    this.messageAlternate = !this.messageAlternate;
                  });
                  this.record('Message scroll controller changed');
                },
              }),
            ),
          ),
        );
      default:
        throw Error('Unknown component: ' + id);
    }
  }
}
