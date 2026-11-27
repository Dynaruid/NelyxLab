// SPDX-License-Identifier: BSD-3-Clause
// Adapted from DorotiTestbedApp and the Flutter Material 3 sample. See LICENSE.flutter.
import { ValueKey } from '@nelyx/core/foundation/key';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { AutomaticKeepAliveClientMixin } from '@nelyx/core/framework/widgets/automatic-keep-alive';
import {
  Center,
  Column,
  Expanded,
  Padding,
  Row,
  SizedBox,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import {
  State,
  StatefulWidget,
  type BuildContext,
  type Widget,
} from '@nelyx/core/framework/widgets/framework';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import { RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import {
  CustomScrollView,
  ListView,
  SingleBoxScrollView,
} from '@nelyx/core/framework/widgets/scroll-view';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { Color } from '@nelyx/core/ui/color';
import { Radius } from '@nelyx/core/ui/radius';
import * as M from '@nelyx/material/widgets';
import { ComponentImage } from './component-image.ts';

type Update = (change: () => void) => void;
type Example = (context: BuildContext, update: Update) => Widget;
type Demo = readonly [label: string, build: Example];
type InputState = 'normal' | 'error' | 'disabled';
const { Icons } = M;
const sectionRadius = Radius.circular(12);
const groupShape = (first: boolean, last: boolean) =>
  new RoundedRectangleBorder({
    borderRadius: BorderRadius.only({
      topLeft: first ? sectionRadius : undefined,
      topRight: first ? sectionRadius : undefined,
      bottomLeft: last ? sectionRadius : undefined,
      bottomRight: last ? sectionRadius : undefined,
    }),
  });
const flow = (...children: Widget[]) =>
  new Wrap(children, { spacing: 10, runSpacing: 8, alignment: 'center' });
const column = (...children: Widget[]) =>
  new Column(children, { crossAlign: 'stretch', mainSize: 'min', spacing: 8 });
const action = (text: string, onPressed: () => void) =>
  new M.TextButton({ child: new Text(text), onPressed });
const navigationItems = [
  ['Explore', Icons.explore_outlined, Icons.explore],
  ['Commute', Icons.directions_bus_outlined, Icons.directions_bus],
  ['Saved', Icons.bookmark_border, Icons.bookmark],
] as const;
const barDestinations = navigationItems.map(
  ([label, icon, selected]) =>
    new M.NavigationDestination({ label, icon: new Icon(icon), selectedIcon: new Icon(selected) }),
);
const railDestinations = navigationItems.map(
  ([label, icon, selected]) =>
    new M.NavigationRailDestination({
      label: new Text(label),
      icon: new Icon(icon),
      selectedIcon: new Icon(selected),
    }),
);

function notify(context: BuildContext, message: string) {
  if (!context.mounted) return;
  const messenger = M.ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    new M.SnackBar({
      content: new Text(message),
      behavior: M.SnackBarBehavior.floating,
      action: new M.SnackBarAction({ label: 'Close', onPressed: () => {} }),
    }),
  );
}

class GallerySection extends StatefulWidget {
  constructor(
    readonly group: string,
    readonly demo: Demo,
    readonly first: boolean,
    readonly last: boolean,
  ) {
    super(new ValueKey(`${group}/${demo[0]}`));
  }
  override createState() {
    return new SectionState();
  }
}

class SectionState extends AutomaticKeepAliveClientMixin<GallerySection> {
  protected get wantKeepAlive(): boolean {
    return true;
  }

  private readonly updateExample: Update = (change) => {
    if (this.mounted) this.setState(change);
    else change();
  };

  override build(context: BuildContext): Widget {
    super.build(context);
    const {
      group,
      demo: [label, build],
      first,
      last,
    } = this.widget;
    const { colorScheme, textTheme } = M.Theme.of(context);
    return new Padding(
      EdgeInsets.only({ bottom: last ? 10 : 0 }),
      new M.Card({
        margin: EdgeInsets.zero,
        elevation: 0,
        shape: groupShape(first, last),
        color: new Color(colorScheme.surfaceContainerHighest).withAlpha(77),
        child: new Padding(
          EdgeInsets.only({ top: first ? 20 : 0, bottom: last ? 20 : 0 }),
          new Column(
            [
              ...(first
                ? [
                    new Text(group, { style: textTheme.titleLarge ?? undefined }),
                    new SizedBox(undefined, 10),
                  ]
                : []),
              label === group
                ? build(context, this.updateExample)
                : new Padding(
                    EdgeInsets.symmetric({ horizontal: 10, vertical: 10 }),
                    new Column(
                      [
                        new Text(label, { style: textTheme.titleMedium ?? undefined }),
                        new SizedBox(
                          450,
                          undefined,
                          new RepaintBoundary(
                            new M.Card({
                              margin: EdgeInsets.zero,
                              elevation: 0,
                              shape: new RoundedRectangleBorder({
                                borderRadius: BorderRadius.circular(12),
                                side: new BorderSide({ color: colorScheme.outlineVariant }),
                              }),
                              child: new Padding(
                                EdgeInsets.symmetric({ horizontal: 8, vertical: 16 }),
                                new Center(build(context, this.updateExample)),
                              ),
                            }),
                          ),
                        ),
                      ],
                      { mainSize: 'min', spacing: 8 },
                    ),
                  ),
            ],
            { mainSize: 'min' },
          ),
        ),
      }),
    );
  }
}

export class ComponentsScreen extends StatefulWidget {
  constructor(readonly wide: boolean) {
    super();
  }
  override createState() {
    return new ComponentsState();
  }
}

class ComponentsState extends State<ComponentsScreen> {
  private readonly firstColumn = new ScrollController({ debugLabel: 'Components' });
  private readonly secondColumn = new ScrollController({ debugLabel: 'More components' });
  private readonly fields = [false, true].map(() => ({
    normal: new TextEditingController(),
    error: new TextEditingController(),
    disabled: new TextEditingController(),
  }));
  private readonly radioToken = {};
  private favorite = false;
  private segment = 'Day';
  private segments = new Set(['M']);
  private badgeIndex = 0;
  private animateProgress = false;
  private sheet: M.PersistentBottomSheetController | null = null;
  private navIndex = 0;
  private railIndex = 0;
  private searchColor: string | null = null;
  private readonly checks: (boolean | null)[] = [true, false, null];
  private filter = true;
  private inputChip = true;
  private date = M.DateTime.now();
  private time = new M.TimeOfDay({ hour: 9, minute: 30 });
  private radio = 0;
  private slider = 30;
  private discreteSlider = 60;
  private range = new M.RangeValues(20, 80);
  private switched = false;
  private iconSwitch = true;

  private readonly groups: readonly (readonly [string, readonly Demo[]])[] = [
    [
      'Actions',
      [
        ['Common buttons', (context) => this.commonButtons(context)],
        ['Floating action buttons', (context) => this.floatingButtons(context)],
        ['Icon buttons', (_context, update) => this.iconButtons(update)],
        ['Segmented buttons', (_context, update) => this.segmented(update)],
      ],
    ],
    [
      'Communication',
      [
        ['Badges', (_context, update) => this.badges(update)],
        ['Progress indicators', (_context, update) => this.progress(update)],
        [
          'Snackbar',
          (context) => action('Show snackbar', () => notify(context, 'This is a snackbar')),
        ],
      ],
    ],
    [
      'Containment',
      [
        ['Bottom sheet', (context, update) => this.bottomSheet(context, update)],
        ['Cards', (context) => this.cards(context)],
        ['Carousel', (context) => this.carousel(context)],
        ['Dialog', (context) => this.dialogs(context)],
        ['Dividers', () => new M.Divider()],
      ],
    ],
    [
      'Navigation',
      [
        ['Bottom app bar', (context) => this.bottomAppBar(context)],
        [
          'Navigation bar',
          (_context, update) =>
            new M.NavigationBar({
              destinations: barDestinations,
              selectedIndex: this.navIndex,
              onDestinationSelected: (index) =>
                update(() => {
                  this.navIndex = index;
                }),
            }),
        ],
        [
          'Navigation drawer',
          (context) =>
            action('Show navigation drawer', () => M.Scaffold.of(context).openEndDrawer()),
        ],
        [
          'Navigation rail',
          (_context, update) =>
            new SizedBox(
              undefined,
              248,
              new M.NavigationRail({
                scrollable: true,
                labelType: M.NavigationRailLabelType.all,
                destinations: railDestinations,
                selectedIndex: this.railIndex,
                onDestinationSelected: (index) =>
                  update(() => {
                    this.railIndex = index;
                  }),
              }),
            ),
        ],
        ['Tabs', () => this.tabs()],
        ['Search', (_context, update) => this.search(update)],
        ['Top app bars', (context) => this.topAppBars(context)],
      ],
    ],
    [
      'Selection',
      [
        ['Checkboxes', (_context, update) => this.checkboxes(update)],
        ['Chips', (context, update) => this.chips(context, update)],
        [
          'Date picker',
          (context, update) =>
            action('Show date picker', () => {
              void this.pickDate(context, update);
            }),
        ],
        [
          'Time picker',
          (context, update) =>
            action('Show time picker', () => {
              void this.pickTime(context, update);
            }),
        ],
        ['Menus', (context) => this.menus(context)],
        ['Radio buttons', (_context, update) => this.radios(update)],
        ['Sliders', (_context, update) => this.sliders(update)],
        ['Switches', (_context, update) => this.switches(update)],
      ],
    ],
    ['Text inputs', [['Text fields', () => this.textInputs()]]],
    ['Image demo', [['Image demo', () => new ComponentImage()]]],
  ];

  private readonly sections = this.groups.map(([name, demos]) =>
    demos.map(
      (demo, index) => new GallerySection(name, demo, index === 0, index === demos.length - 1),
    ),
  );
  private readonly openingSections = this.sections.slice(0, 3).flat();
  private readonly remainingSections = this.sections.slice(3).flat();
  private readonly allSections = this.sections.flat();

  override dispose(): void {
    this.sheet?.close();
    this.firstColumn.dispose();
    this.secondColumn.dispose();
    for (const group of this.fields) for (const field of Object.values(group)) field.dispose();
    super.dispose();
  }

  private list(children: readonly Widget[], controller: ScrollController): Widget {
    // Each column lays out visible examples and keeps the state of previously visited sections.
    return new ListView({
      children,
      controller,
      primary: false,
      cacheExtent: 0,
      padding: EdgeInsets.all(10),
    });
  }

  override build(): Widget {
    const wide = this.widget.wide;
    return new Row(
      [
        new Expanded(this.list(wide ? this.openingSections : this.allSections, this.firstColumn)),
        ...(wide ? [new Expanded(this.list(this.remainingSections, this.secondColumn))] : []),
      ],
      { crossAlign: 'stretch' },
    );
  }

  private commonButtons(context: BuildContext): Widget {
    const press = (label: string) => () => notify(context, `${label} button pressed`);
    const row = (enabled: boolean) =>
      flow(
        new M.ElevatedButton({
          child: new Text('Elevated'),
          onPressed: enabled ? press('Elevated') : null,
        }),
        new M.FilledButton({
          child: new Text('Filled'),
          onPressed: enabled ? press('Filled') : null,
        }),
        M.FilledButton.tonal({
          child: new Text('Filled tonal'),
          onPressed: enabled ? press('Filled tonal') : null,
        }),
        new M.OutlinedButton({
          child: new Text('Outlined'),
          onPressed: enabled ? press('Outlined') : null,
        }),
        new M.TextButton({ child: new Text('Text'), onPressed: enabled ? press('Text') : null }),
      );
    return column(
      row(true),
      flow(
        M.ElevatedButton.icon({
          icon: new Icon(Icons.add),
          label: new Text('Elevated'),
          onPressed: press('Elevated'),
        }),
        M.FilledButton.icon({
          icon: new Icon(Icons.add),
          label: new Text('Filled'),
          onPressed: press('Filled'),
        }),
        M.FilledButton.tonalIcon({
          icon: new Icon(Icons.add),
          label: new Text('Filled tonal'),
          onPressed: press('Filled tonal'),
        }),
        M.OutlinedButton.icon({
          icon: new Icon(Icons.add),
          label: new Text('Outlined'),
          onPressed: press('Outlined'),
        }),
        M.TextButton.icon({
          icon: new Icon(Icons.add),
          label: new Text('Text'),
          onPressed: press('Text'),
        }),
      ),
      row(false),
    );
  }

  private floatingButtons(context: BuildContext): Widget {
    const options = {
      heroTag: null,
      onPressed: () => notify(context, 'Create'),
      child: new Icon(Icons.add),
    };
    return flow(
      M.FloatingActionButton.small({ ...options, tooltip: 'Small floating action button' }),
      new M.FloatingActionButton({ ...options, tooltip: 'Floating action button' }),
      M.FloatingActionButton.large({ ...options, tooltip: 'Large floating action button' }),
      M.FloatingActionButton.extended({
        heroTag: null,
        label: new Text('Create'),
        icon: new Icon(Icons.add),
        onPressed: options.onPressed,
      }),
    );
  }

  private iconButtons(update: Update): Widget {
    const options = (label: string) => ({
      icon: new Icon(Icons.favorite_border, { semanticLabel: label }),
      selectedIcon: new Icon(Icons.favorite, { semanticLabel: label }),
      tooltip: label,
      isSelected: this.favorite,
      onPressed: () =>
        update(() => {
          this.favorite = !this.favorite;
        }),
    });
    return flow(
      new M.IconButton(options('Favorite')),
      M.IconButton.filled(options('Filled favorite')),
      M.IconButton.filledTonal(options('Tonal favorite')),
      M.IconButton.outlined(options('Outlined favorite')),
      new M.IconButton({
        icon: new Icon(Icons.favorite_border, { semanticLabel: 'Disabled favorite' }),
        onPressed: null,
      }),
    );
  }

  private segmented(update: Update): Widget {
    return column(
      new Center(
        new M.SegmentedButton<string>({
          segments: ['Day', 'Week', 'Month'].map(
            (value) => new M.ButtonSegment({ value, label: new Text(value) }),
          ),
          selected: new Set([this.segment]),
          onSelectionChanged: (values) =>
            update(() => {
              this.segment = [...values][0]!;
            }),
        }),
      ),
      new Center(
        new M.SegmentedButton<string>({
          segments: ['S', 'M', 'L', 'XL'].map(
            (value) => new M.ButtonSegment({ value, label: new Text(value) }),
          ),
          multiSelectionEnabled: true,
          emptySelectionAllowed: true,
          selected: this.segments,
          onSelectionChanged: (values) =>
            update(() => {
              this.segments = new Set(values);
            }),
        }),
      ),
    );
  }

  private badges(update: Update): Widget {
    const badges = [
      ['Mail', Icons.mail_outline, '999+'],
      ['Chat', Icons.chat_bubble_outline, '10'],
      ['Groups', Icons.group_outlined, null],
      ['Tasks', Icons.check_circle_outline, '3'],
    ] as const;
    return new M.NavigationBar({
      selectedIndex: this.badgeIndex,
      onDestinationSelected: (index) =>
        update(() => {
          this.badgeIndex = index;
        }),
      destinations: badges.map(
        ([label, icon, count]) =>
          new M.NavigationDestination({
            label,
            icon: new M.Badge({ label: count ? new Text(count) : null, child: new Icon(icon) }),
          }),
      ),
    });
  }

  private progress(update: Update): Widget {
    const value = this.animateProgress ? null : 0.7;
    const label = this.animateProgress ? 'Stop progress' : 'Start progress';
    return new Row(
      [
        new M.IconButton({
          tooltip: label,
          icon: new Icon(this.animateProgress ? Icons.pause : Icons.play_arrow, {
            semanticLabel: label,
          }),
          onPressed: () =>
            update(() => {
              this.animateProgress = !this.animateProgress;
            }),
        }),
        new M.CircularProgressIndicator({ value }),
        new Expanded(new M.LinearProgressIndicator({ value })),
      ],
      { crossAlign: 'center', spacing: 16 },
    );
  }

  private bottomSheet(context: BuildContext, update: Update): Widget {
    const content = (close: () => void) =>
      new SafeArea({
        top: false,
        child: new SingleBoxScrollView({
          padding: EdgeInsets.all(20),
          primary: false,
          child: column(
            new Text('Bottom sheet', {
              style: M.Theme.of(context).textTheme.titleLarge ?? undefined,
            }),
            ...['Share', 'Add to', 'Trash', 'Archive', 'Settings', 'Favorite'].map(
              (label) =>
                new M.ListTile({
                  title: new Text(label),
                  onTap: () => {
                    close();
                    notify(context, label);
                  },
                }),
            ),
          ),
        }),
      });
    return flow(
      action('Show modal bottom sheet', () => {
        void M.showModalBottomSheet(context, {
          showDragHandle: true,
          constraints: new BoxConstraints(0, 640),
          builder: (sheetContext) => content(() => Navigator.of(sheetContext).pop()),
        });
      }),
      action(this.sheet ? 'Hide bottom sheet' : 'Show bottom sheet', () => {
        if (this.sheet) {
          this.sheet.close();
          return;
        }
        const sheet = M.Scaffold.of(context).showBottomSheet({
          showDragHandle: true,
          builder: () => content(() => this.sheet?.close()),
        });
        update(() => {
          this.sheet = sheet;
        });
        void sheet.closed.then(() => {
          if (this.mounted && this.sheet === sheet)
            update(() => {
              this.sheet = null;
            });
        });
      }),
    );
  }

  private cards(context: BuildContext): Widget {
    const card = (label: string) =>
      new SizedBox(
        114,
        76,
        new M.InkWell({
          onTap: () => notify(context, `${label} card`),
          child: new Center(new Text(label)),
        }),
      );
    return flow(
      new M.Card({ child: card('Elevated') }),
      M.Card.filled({ child: card('Filled') }),
      M.Card.outlined({ child: card('Outlined') }),
    );
  }

  private carousel(context: BuildContext): Widget {
    const carousel = (itemSnapping: boolean) =>
      new SizedBox(
        undefined,
        112,
        new M.CarouselView({
          itemExtent: 136,
          shrinkExtent: 72,
          itemSnapping,
          backgroundColor: new Color(M.Theme.of(context).colorScheme.secondaryContainer),
          children: Array.from(
            { length: 8 },
            (_, index) => new Center(new Text(`Item ${index + 1}`)),
          ),
        }),
      );
    return column(
      new Text('Uncontained Carousel'),
      carousel(false),
      new Text('Uncontained Carousel with snapping effect'),
      carousel(true),
    );
  }

  private dialogs(context: BuildContext): Widget {
    return flow(
      action('Show dialog', () => {
        void M.showDialog(context, {
          builder: (dialogContext) =>
            new M.AlertDialog({
              title: new Text('What is a dialog?'),
              content: new Text(
                'A dialog is a modal window that appears in front of the app content.',
              ),
              actions: [
                action('Dismiss', () => Navigator.of(dialogContext).pop()),
                new M.FilledButton({
                  child: new Text('Okay'),
                  onPressed: () => Navigator.of(dialogContext).pop(),
                }),
              ],
            }),
        });
      }),
      action('Show full-screen dialog', () => {
        void Navigator.of(context).push(
          new M.MaterialPageRoute({
            fullscreenDialog: true,
            builder: (routeContext) =>
              new M.Scaffold({
                appBar: new M.AppBar({ title: new Text('Full-screen dialog') }),
                body: new Center(action('Close', () => Navigator.of(routeContext).pop())),
              }),
          }),
        );
      }),
    );
  }

  private bottomAppBar(context: BuildContext): Widget {
    return new SizedBox(
      undefined,
      80,
      new M.Scaffold({
        bottomNavigationBar: new M.BottomAppBar({
          child: new Row([
            this.menu(context, true),
            new M.IconButton({
              icon: new Icon(Icons.search, { semanticLabel: 'Search' }),
              tooltip: 'Search',
              onPressed: () => notify(context, 'Search'),
            }),
            new M.IconButton({
              icon: new Icon(Icons.favorite, { semanticLabel: 'Favorite item' }),
              tooltip: 'Favorite item',
              onPressed: () => notify(context, 'Favorite'),
            }),
          ]),
        }),
        floatingActionButtonLocation: M.FloatingActionButtonLocation.endContained,
        floatingActionButton: new M.FloatingActionButton({
          heroTag: null,
          elevation: 0,
          tooltip: 'Add',
          child: new Icon(Icons.add, { semanticLabel: 'Add' }),
          onPressed: () => notify(context, 'Add'),
        }),
      }),
    );
  }

  private tabs(): Widget {
    const tabs = [
      ['Video', Icons.videocam_outlined],
      ['Photos', Icons.photo_outlined],
      ['Audio', Icons.audiotrack],
    ] as const;
    return new M.DefaultTabController({
      length: tabs.length,
      child: new SizedBox(
        undefined,
        132,
        new Column(
          [
            new M.TabBar({
              tabs: tabs.map(([text, icon]) => new M.Tab({ text, icon: new Icon(icon) })),
            }),
            new Expanded(
              new M.TabBarView({ children: tabs.map(([text]) => new Center(new Text(text))) }),
            ),
          ],
          { crossAlign: 'stretch' },
        ),
      ),
    });
  }

  private search(update: Update): Widget {
    const colors = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Indigo', 'Violet'];
    return column(
      M.SearchAnchor.bar({
        barHintText: 'Search colors',
        suggestionsBuilder: (_context, controller) => {
          const matches = colors.filter((color) =>
            color.toLowerCase().includes(controller.text.trim().toLowerCase()),
          );
          return matches.length
            ? matches.map(
                (color) =>
                  new M.ListTile({
                    title: new Text(color),
                    onTap: () => {
                      update(() => {
                        this.searchColor = color;
                      });
                      controller.closeView(color);
                    },
                  }),
              )
            : [new M.ListTile({ title: new Text('No matching colors') })];
        },
      }),
      new Text(this.searchColor ? `Last selected color is ${this.searchColor}` : 'Select a color'),
    );
  }

  private topAppBars(context: BuildContext): Widget {
    const leading = new M.IconButton({
      tooltip: 'Back',
      icon: new Icon(Icons.arrow_back, { semanticLabel: 'Back' }),
      onPressed: () => notify(context, 'Back'),
    });
    const actions = [
      new M.IconButton({
        tooltip: 'More options',
        icon: new Icon(Icons.more_vert, { semanticLabel: 'More options' }),
        onPressed: () => notify(context, 'More options'),
      }),
    ];
    return column(
      new SizedBox(
        undefined,
        56,
        new M.AppBar({
          leading,
          actions,
          title: new Text('Center-aligned'),
          centerTitle: true,
          primary: false,
        }),
      ),
      new SizedBox(
        undefined,
        56,
        new M.AppBar({ leading, actions, title: new Text('Small'), primary: false }),
      ),
      new SizedBox(
        undefined,
        112,
        new CustomScrollView({
          primary: false,
          slivers: [
            M.SliverAppBar.medium({ leading, actions, title: new Text('Medium'), primary: false }),
          ],
        }),
      ),
      new SizedBox(
        undefined,
        152,
        new CustomScrollView({
          primary: false,
          slivers: [
            M.SliverAppBar.large({ leading, actions, title: new Text('Large'), primary: false }),
          ],
        }),
      ),
    );
  }

  private checkboxes(update: Update): Widget {
    return column(
      ...[...this.checks, true].map(
        (value, index) =>
          new M.CheckboxListTile({
            title: new Text(`Option ${index + 1}`),
            value,
            tristate: index === 2,
            onChanged:
              index === 3
                ? null
                : (checked) =>
                    update(() => {
                      this.checks[index] = checked;
                    }),
          }),
      ),
    );
  }

  private chips(context: BuildContext, update: Update): Widget {
    return column(
      flow(
        new M.ActionChip({
          avatar: new Icon(Icons.event),
          label: new Text('Assist'),
          onPressed: () => notify(context, 'Assist'),
        }),
        new M.FilterChip({
          label: new Text('Filter'),
          selected: this.filter,
          onSelected: (selected) =>
            update(() => {
              this.filter = selected;
            }),
        }),
        new M.InputChip({
          label: new Text('Input'),
          selected: this.inputChip,
          onSelected: (selected) =>
            update(() => {
              this.inputChip = selected;
            }),
        }),
        new M.ActionChip({
          label: new Text('Suggestion'),
          onPressed: () => notify(context, 'Suggestion'),
        }),
      ),
      flow(
        new M.ActionChip({ label: new Text('Assist') }),
        new M.FilterChip({ label: new Text('Filter'), onSelected: null }),
        new M.InputChip({ label: new Text('Input'), isEnabled: false }),
        new M.ActionChip({ label: new Text('Suggestion') }),
      ),
    );
  }

  private async pickDate(context: BuildContext, update: Update) {
    const year = M.DateTime.now().year;
    const date = await M.showDatePicker({
      context,
      initialDate: this.date,
      firstDate: new M.DateTime(year - 10, 1, 1),
      lastDate: new M.DateTime(year + 10, 12, 31),
    });
    if (!this.mounted || date === null) return;
    update(() => {
      this.date = date;
    });
    notify(context, `Selected date: ${date.day}/${date.month}/${date.year}`);
  }

  private async pickTime(context: BuildContext, update: Update) {
    const time = await M.showTimePicker({ context, initialTime: this.time });
    if (!this.mounted || time === null) return;
    update(() => {
      this.time = time;
    });
    if (context.mounted) notify(context, `Selected time: ${time.format(context)}`);
  }

  private menu(context: BuildContext, icon: boolean): Widget {
    return new M.MenuAnchor({
      menuChildren: [
        ...['Item 1', 'Item 2'].map(
          (label) =>
            new M.MenuItemButton({
              child: new Text(label),
              onPressed: () => notify(context, label),
            }),
        ),
        new M.SubmenuButton({
          child: new Text('Item 3'),
          menuChildren: ['Menu 1', 'Menu 2'].map(
            (label) =>
              new M.MenuItemButton({
                child: new Text(label),
                onPressed: () => notify(context, label),
              }),
          ),
        }),
      ],
      builder: (_context, controller) => {
        const toggle = () => {
          if (controller.isOpen) controller.close();
          else controller.open();
        };
        return icon
          ? new M.IconButton({
              tooltip: 'Show menu',
              icon: new Icon(Icons.menu, { semanticLabel: 'Show menu' }),
              onPressed: toggle,
            })
          : action('Show menu', toggle);
      },
    });
  }

  private menus(context: BuildContext): Widget {
    return column(
      new Center(this.menu(context, false)),
      flow(
        new M.DropdownMenu<string>({
          label: new Text('Color'),
          width: 140,
          enableFilter: true,
          dropdownMenuEntries: ['Red', 'Green', 'Blue'].map(
            (label) => new M.DropdownMenuEntry({ value: label, label }),
          ),
        }),
        new M.DropdownMenu<string>({
          label: new Text('Icon'),
          width: 140,
          dropdownMenuEntries: navigationItems.map(
            ([label, icon]) =>
              new M.DropdownMenuEntry({ value: label, label, leadingIcon: new Icon(icon) }),
          ),
        }),
      ),
    );
  }

  private radios(update: Update): Widget {
    return new RadioGroup<number>({
      typeToken: this.radioToken,
      groupValue: this.radio,
      onChanged: (value) => {
        if (value !== null)
          update(() => {
            this.radio = value;
          });
      },
      child: column(
        ...[0, 1, 2].map(
          (value) =>
            new M.RadioListTile({
              groupToken: this.radioToken,
              value,
              title: new Text(`Option ${value + 1}`),
              enabled: value !== 2,
            }),
        ),
      ),
    });
  }

  private sliders(update: Update): Widget {
    return column(
      new M.Slider({
        min: 0,
        max: 100,
        value: this.slider,
        onChanged: (value) =>
          update(() => {
            this.slider = value;
          }),
      }),
      new M.Slider({
        min: 0,
        max: 100,
        value: this.discreteSlider,
        divisions: 10,
        label: String(this.discreteSlider),
        onChanged: (value) =>
          update(() => {
            this.discreteSlider = value;
          }),
      }),
      new M.RangeSlider({
        min: 0,
        max: 100,
        values: this.range,
        divisions: 10,
        onChanged: (value) =>
          update(() => {
            this.range = value;
          }),
      }),
    );
  }

  private switches(update: Update): Widget {
    return flow(
      new M.Switch({
        value: this.switched,
        onChanged: (value) =>
          update(() => {
            this.switched = value;
          }),
      }),
      new M.Switch({
        value: this.iconSwitch,
        onChanged: (value) =>
          update(() => {
            this.iconSwitch = value;
          }),
      }),
      new M.Switch({ value: false, onChanged: null }),
      new M.Switch({ value: true, onChanged: null }),
    );
  }

  private textInputs(): Widget {
    const field = (outlined: boolean, state: InputState) => {
      const group = this.fields[Number(outlined)]!;
      const controller = group[state];
      const mirror = (text: string) => {
        for (const other of Object.values(group))
          if (other !== controller && other.text !== text) other.text = text;
      };
      return new M.TextField({
        id: `testbed-${outlined ? 'outlined' : 'filled'}-${state}`,
        controller,
        enabled: state !== 'disabled',
        maxLength: state === 'error' && !outlined ? 10 : null,
        onChanged: mirror,
        decoration: new M.InputDecoration({
          labelText: state === 'disabled' ? 'Disabled' : outlined ? 'Outlined' : 'Filled',
          hintText: 'hint text',
          helperText: 'supporting text',
          errorText: state === 'error' ? 'error text' : null,
          filled: !outlined || state !== 'normal',
          border: outlined ? new M.OutlineInputBorder() : null,
          prefixIcon: new Icon(Icons.search),
          suffixIcon: new M.IconButton({
            tooltip: 'Clear text',
            icon: new Icon(Icons.close, { semanticLabel: 'Clear text' }),
            onPressed:
              state === 'disabled'
                ? null
                : () => {
                    controller.clear();
                    mirror('');
                  },
          }),
        }),
      });
    };
    return column(
      ...[false, true].flatMap((outlined) => [
        field(outlined, 'normal'),
        new Row(
          [new Expanded(field(outlined, 'error')), new Expanded(field(outlined, 'disabled'))],
          { spacing: 8 },
        ),
      ]),
    );
  }
}
