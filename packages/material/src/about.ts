// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/about.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { CupertinoDialogAction } from '@nelyx/cupertino/dialog';
import {
  LicenseEntryWithLineBreaks,
  LicenseParagraph,
  LicenseRegistry,
} from '@nelyx/core/foundation/licenses';
import type { LicenseEntry } from '@nelyx/core/foundation/licenses';
import { ValueKey } from '@nelyx/core/foundation/key';
import { decodeCompressedNotices } from '@nelyx/core/internal/foundation/license-notices';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Title } from '@nelyx/core/framework/widgets/app';
import { AnimatedSwitcher } from '@nelyx/core/framework/widgets/animated-switcher';
import { FutureBuilder } from '@nelyx/core/framework/widgets/async';
import {
  Center,
  Column,
  ConstrainedBox,
  Expanded,
  KeyedSubtree,
  Padding,
  Row,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import {
  Element,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { DefaultAssetBundle } from '@nelyx/core/framework/widgets/default-asset-bundle';
import { DraggableScrollableSheet } from '@nelyx/core/framework/widgets/draggable-scrollable-sheet';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import {
  LocalHistoryEntry,
  Navigator,
  routeTokenOf,
} from '@nelyx/core/framework/widgets/navigation';
import { PageStorageKey } from '@nelyx/core/framework/widgets/page-storage';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics } from '@nelyx/core/framework/widgets/semantics';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import type { AssetBundle } from '@nelyx/core/services/asset-bundle';
import { AssetManifest } from '@nelyx/core/services/asset-manifest';
import { FontWeight } from '@nelyx/core/ui/typography';
import { Radius } from '@nelyx/core/ui/radius';
import { BackButton } from './action-buttons.ts';
import { AppBar, kToolbarHeight } from './app-bar.ts';
import { Card } from './card.ts';
import { debugCheckHasMaterial, debugCheckHasMaterialLocalizations } from './debug.ts';
import { AlertDialog, showAdaptiveDialog, showDialog } from './dialog.ts';
import type { AlertDialogOptions } from './dialog.ts';
import type { ShowMaterialDialogOptions } from './dialog.ts';
import { Divider } from './divider.ts';
import { ListTile } from './list-tile.ts';
import { Material, MaterialType } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { MaterialPageRoute } from './page.ts';
import { CircularProgressIndicator } from './progress-indicator.ts';
import { Scaffold } from './scaffold.ts';
import { Scrollbar } from './scrollbar.ts';
import { TextButton } from './text-button.ts';
import { Theme } from './theme.ts';

export interface ApplicationAboutOptions {
  readonly applicationName?: string | null;
  readonly applicationVersion?: string | null;
  readonly applicationIcon?: Widget | null;
  readonly applicationLegalese?: string | null;
}

export interface AboutListTileOptions extends ApplicationAboutOptions, WidgetOptions {
  readonly icon?: Widget | null;
  readonly child?: Widget | null;
  readonly aboutBoxChildren?: readonly Widget[] | null;
  readonly dense?: boolean | null;
}

export interface AboutDialogOptions extends ApplicationAboutOptions, WidgetOptions {
  readonly children?: readonly Widget[] | null;
}

export interface ShowAboutDialogOptions
  extends
    AboutDialogOptions,
    Pick<
      ShowMaterialDialogOptions,
      | 'barrierDismissible'
      | 'barrierColor'
      | 'barrierLabel'
      | 'useRootNavigator'
      | 'routeSettings'
      | 'anchorPoint'
    > {
  readonly context: BuildContext;
}

export interface ShowLicensePageOptions extends ApplicationAboutOptions {
  readonly context: BuildContext;
  readonly useRootNavigator?: boolean;
}

const textSeparation = 18;
const gutterThreshold = 720;
const wideThreshold = 840;
const wideGutter = 24;
const narrowGutter = 12;
const masterWidth = 320;
const paneElevation = 4;
const masterRouteName = 'master';
const detailRouteName = 'detail';
type LicensePaneFocus = typeof masterRouteName | typeof detailRouteName;
const paneShape = new RoundedRectangleBorder({
  borderRadius: BorderRadius.vertical({ top: Radius.circular(3) }),
});

function appName(context: BuildContext, applicationName: string | null | undefined): string {
  return (
    applicationName ??
    Title.maybeOf(context) ??
    context.services.platformServices?.environment?.executableName ??
    ''
  );
}

function gutter(context: BuildContext): number {
  return MediaQuery.of(context).width >= gutterThreshold ? wideGutter : narrowGutter;
}

export class AboutListTile extends StatelessWidget {
  constructor(readonly options: AboutListTileOptions = {}) {
    super(options.key ?? null);
  }

  override build(context: BuildContext): Widget {
    debugCheckHasMaterial(context);
    debugCheckHasMaterialLocalizations(context);
    const { icon, child, dense, aboutBoxChildren, key: _key, ...application } = this.options;
    const localizations = MaterialLocalizations.of(context);
    return new ListTile({
      leading: icon ?? null,
      title:
        child ??
        new Text(localizations.aboutListTileTitle(appName(context, application.applicationName))),
      dense: dense ?? null,
      onTap: () => showAboutDialog({ context, ...application, children: aboutBoxChildren ?? null }),
    });
  }
}

export class AboutDialog extends StatelessWidget {
  private adaptsToPlatform = false;
  readonly options: AboutDialogOptions;

  constructor(options: AboutDialogOptions = {}) {
    super(options.key ?? null);
    this.options = Object.freeze({
      ...options,
      children: Object.freeze([...(options.children ?? [])]),
    });
  }

  static adaptive(options: AboutDialogOptions = {}): AboutDialog {
    const dialog = new AboutDialog(options);
    dialog.adaptsToPlatform = true;
    return dialog;
  }

  override build(context: BuildContext): Widget {
    debugCheckHasMaterialLocalizations(context);
    const { applicationName, applicationVersion, applicationIcon, applicationLegalese } =
      this.options;
    const theme = Theme.of(context);
    const text = theme.textTheme;
    const localizations = MaterialLocalizations.of(context);
    const apple = this.adaptsToPlatform && (theme.platform === 'iOS' || theme.platform === 'macOS');
    const content = new Column(
      [
        new Row(
          [
            ...(applicationIcon ? [new IconTheme(theme.iconTheme, applicationIcon)] : []),
            new Expanded(
              new Padding(
                EdgeInsets.symmetric({ horizontal: 24 }),
                new Column(
                  [
                    new Text(appName(context, applicationName), { style: text.headlineSmall! }),
                    new Text(applicationVersion ?? '', { style: text.bodyMedium! }),
                    new SizedBox(undefined, textSeparation),
                    new Text(applicationLegalese ?? '', { style: text.bodySmall! }),
                  ],
                  { mainSize: 'min', crossAlign: 'start' },
                ),
              ),
            ),
          ],
          { crossAlign: 'start' },
        ),
        ...(this.options.children ?? []),
      ],
      { mainSize: 'min', crossAlign: 'stretch' },
    );
    const actions = [
      {
        child: new Text(localizations.viewLicensesButtonLabel),
        onPressed: () =>
          showLicensePage({
            context,
            applicationName: applicationName ?? null,
            applicationVersion: applicationVersion ?? null,
            applicationIcon: applicationIcon ?? null,
            applicationLegalese: applicationLegalese ?? null,
          }),
      },
      {
        child: new Text(localizations.closeButtonLabel),
        onPressed: () => {
          Navigator.of(context).pop();
        },
      },
    ];
    const alertOptions: AlertDialogOptions = {
      content,
      constraints: new BoxConstraints(280, 560),
      scrollable: true,
      actions: actions.map((action) =>
        apple ? new CupertinoDialogAction(action) : new TextButton(action),
      ),
    };
    return this.adaptsToPlatform
      ? AlertDialog.adaptive(alertOptions)
      : new AlertDialog(alertOptions);
  }
}

export function showAboutDialog(options: ShowAboutDialogOptions): void {
  openAboutDialog(options, false);
}

export function showAdaptiveAboutDialog(options: ShowAboutDialogOptions): void {
  openAboutDialog(options, true);
}

function openAboutDialog(
  {
    context,
    barrierDismissible = true,
    barrierLabel = null,
    barrierColor = null,
    useRootNavigator = true,
    routeSettings = null,
    anchorPoint = null,
    ...options
  }: ShowAboutDialogOptions,
  adaptive: boolean,
): void {
  const show = adaptive ? showAdaptiveDialog : showDialog;
  const applicationName = appName(context, options.applicationName);
  void show<void>(context, {
    barrierDismissible,
    barrierColor,
    barrierLabel,
    useRootNavigator,
    routeSettings,
    anchorPoint,
    builder: () =>
      adaptive
        ? AboutDialog.adaptive({ ...options, applicationName })
        : new AboutDialog({ ...options, applicationName }),
  });
}

export function showLicensePage({
  context,
  useRootNavigator = false,
  ...options
}: ShowLicensePageOptions): void {
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator });
  const themes = InheritedTheme.capture(context);
  const applicationName = appName(context, options.applicationName);
  void navigator.push(
    new MaterialPageRoute<void>({
      builder: () => themes.wrap(new LicensePage({ ...options, applicationName })),
    }),
  );
}

export interface LicensePageOptions extends ApplicationAboutOptions, WidgetOptions {}

export class LicensePage extends StatefulWidget {
  constructor(readonly options: LicensePageOptions = {}) {
    super(options.key ?? null);
  }

  override createState(): State<LicensePage> {
    return new LicensePageState();
  }
}

interface PackageLicenses {
  readonly name: string;
  readonly entries: readonly LicenseEntry[];
}

async function* bundleLicenses(bundle: AssetBundle | null): AsyncIterable<LicenseEntry> {
  if (!bundle) return;
  const manifest = await AssetManifest.loadFromAssetBundle(bundle).catch(() => null);
  const compressed = manifest?.getAssetVariants('NOTICES.Z');
  const plain = manifest?.getAssetVariants('NOTICES');
  if (!compressed && !plain) return;
  const notices = compressed
    ? await bundle.loadStructuredBinaryData('NOTICES.Z', decodeCompressedNotices)
    : await bundle.loadString('NOTICES');
  for (const section of notices.split(/^-{80}\r?$/m)) {
    const notice = section.trim();
    const separator = /\r?\n\r?\n/.exec(notice);
    if (!separator) continue;
    const packages = notice
      .slice(0, separator.index)
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    const body = notice.slice(separator.index + separator[0].length);
    if (packages.length && body) yield new LicenseEntryWithLineBreaks(packages, body);
  }
}

async function collectPackages(bundle: AssetBundle | null): Promise<readonly PackageLicenses[]> {
  const entriesByPackage = new Map<string, LicenseEntry[]>();
  for (const stream of [bundleLicenses(bundle), LicenseRegistry.licenses]) {
    for await (const entry of stream) {
      for (const name of new Set(entry.packages)) {
        const entries = entriesByPackage.get(name);
        if (entries) entries.push(entry);
        else entriesByPackage.set(name, [entry]);
      }
    }
  }
  const packages = Array.from(entriesByPackage, ([name, entries]) => ({ name, entries }));
  const first = packages.shift();
  packages.sort((a, b) => {
    const left = a.name.toLowerCase(),
      right = b.name.toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  });
  if (first) packages.unshift(first);
  return packages;
}

class LicensePageState extends State<LicensePage> {
  private packages!: Promise<readonly PackageLicenses[]>;
  private bundle: AssetBundle | null | undefined;
  private selected: string | null = null;
  private focus: LicensePaneFocus = masterRouteName;
  private wide = false;
  private historyQueued = false;
  private detailHistory: LocalHistoryEntry | null = null;

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const images = this.context.services.images;
    const bundle =
      this.context.maybeDependOn(DefaultAssetBundle)?.bundle ??
      (images && !images.isClosed ? DefaultAssetBundle.of(this.context) : null);
    if (bundle !== this.bundle) {
      this.bundle = bundle;
      this.packages = collectPackages(bundle);
      const history = this.detailHistory;
      this.detailHistory = null;
      this.focus = masterRouteName;
      history?.remove();
    }
  }

  private openPackage(data: PackageLicenses): void {
    this.setState(() => {
      this.selected = data.name;
      this.focus = detailRouteName;
    });
    this.syncDetailHistory();
  }

  private queueHistoryUpdate(wide: boolean): void {
    if (this.wide === wide) return;
    this.wide = wide;
    if (this.historyQueued || !(this.context instanceof Element)) return;
    this.historyQueued = true;
    this.context.owner.postFrame(() => {
      this.historyQueued = false;
      if (this.mounted) this.syncDetailHistory();
    });
  }

  private syncDetailHistory(): void {
    if (this.wide || this.focus === masterRouteName) {
      const history = this.detailHistory;
      this.detailHistory = null;
      history?.remove();
      return;
    }
    if (this.detailHistory) return;
    const navigator = Navigator.maybeOf(this.context);
    const token = routeTokenOf(this.context);
    if (!token || !navigator?.routes.some((route) => route.token === token)) return;
    const history = new LocalHistoryEntry({
      onRemove: () => {
        if (!this.mounted || this.detailHistory !== history) return;
        this.detailHistory = null;
        this.setState(() => {
          this.focus = masterRouteName;
        });
      },
    });
    navigator.addLocalHistoryEntry(token, history);
    this.detailHistory = history;
  }

  private readonly closeDetail = (): void => {
    if (this.detailHistory) this.detailHistory.remove();
    else
      this.setState(() => {
        this.focus = masterRouteName;
      });
  };

  override dispose(): void {
    const history = this.detailHistory;
    this.detailHistory = null;
    history?.remove();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    debugCheckHasMaterialLocalizations(context);
    const localizations = MaterialLocalizations.of(context);
    const title = new Text(localizations.licensesPageTitle);
    const buildScaffold = (
      body: Widget,
      item: PackageLicenses | null = null,
      buildContext = context,
    ) =>
      new Scaffold({
        appBar: new AppBar({
          title: item ? packageTitle(buildContext, item) : title,
          leading: item ? new BackButton({ onPressed: this.closeDetail }) : null,
        }),
        body,
      });
    return new FutureBuilder({
      future: this.packages,
      builder: (context, snapshot) => {
        if (snapshot.hasError) return buildScaffold(new Center(new Text(String(snapshot.error))));
        if (!snapshot.hasData)
          return buildScaffold(
            pane(
              context,
              new Column([this.aboutProgram(context), new Center(new CircularProgressIndicator())]),
            ),
          );
        const packages = snapshot.requireData();
        return new LayoutBuilder((layoutContext, constraints) => {
          const wide = constraints.maxWidth >= wideThreshold;
          this.queueHistoryUpdate(wide);
          const explicitSelection = packages.find((item) => item.name === this.selected);
          const detail =
            !wide && this.focus === detailRouteName ? (explicitSelection ?? null) : null;
          const selected = explicitSelection ?? packages[0];
          const safe = MediaQuery.maybePaddingOf(layoutContext) ?? EdgeInsets.zero;
          const master = pane(
            layoutContext,
            ListView.builder({
              key: new PageStorageKey(masterRouteName),
              primary: false,
              itemCount: packages.length + 1,
              padding: EdgeInsets.fromLTRB(safe.left, 0, safe.right, safe.bottom),
              itemBuilder: (itemContext, index) => {
                if (index === 0) return this.aboutProgram(itemContext);
                const item = packages[index - 1]!;
                const theme = Theme.of(itemContext);
                return new ListTile({
                  title: new Text(item.name),
                  subtitle: new Text(localizations.licensesPackageDetailText(item.entries.length)),
                  selected: wide && item === selected,
                  tileColor: theme.cardColor,
                  selectedTileColor: theme.highlightColor,
                  onTap: () => this.openPackage(item),
                });
              },
            }),
          );
          if (!wide || !selected) {
            const contents = detail
              ? new Center(pane(layoutContext, new PackageLicenseList(detail)))
              : new Center(master);
            return buildScaffold(
              new AnimatedSwitcher({
                duration: 200,
                child: new KeyedSubtree({
                  key: new ValueKey(detail ? detailRouteName : masterRouteName),
                  child: contents,
                }),
                layoutBuilder: activeLicensePane,
              }),
              detail,
              layoutContext,
            );
          }
          return buildScaffold(
            new Row(
              [
                new SizedBox(masterWidth, undefined, master),
                new Expanded(
                  new Padding(
                    EdgeInsetsDirectional.only({ start: gutter(layoutContext) }),
                    new AnimatedSwitcher({
                      duration: 500,
                      child: new WidePackageLicensePane(selected),
                      layoutBuilder: activeLicensePane,
                    }),
                  ),
                ),
              ],
              { crossAlign: 'stretch' },
            ),
          );
        });
      },
    });
  }

  private aboutProgram(context: BuildContext): Widget {
    const { applicationName, applicationIcon, applicationVersion, applicationLegalese } =
      this.widget.options;
    const theme = Theme.of(context);
    return new Padding(
      EdgeInsets.symmetric({ horizontal: gutter(context), vertical: 24 }),
      new Column(
        [
          new Text(appName(context, applicationName), {
            style: theme.textTheme.headlineSmall!,
            textAlign: 'center',
          }),
          ...(applicationIcon ? [new IconTheme(theme.iconTheme, applicationIcon)] : []),
          ...(applicationVersion
            ? [
                new Padding(
                  EdgeInsets.only({ bottom: textSeparation }),
                  new Text(applicationVersion, {
                    style: theme.textTheme.bodyMedium!,
                    textAlign: 'center',
                  }),
                ),
              ]
            : []),
          ...(applicationLegalese
            ? [
                new Text(applicationLegalese, {
                  style: theme.textTheme.bodySmall!,
                  textAlign: 'center',
                }),
              ]
            : []),
          new SizedBox(undefined, textSeparation),
          new Text('Powered by Nelyx', { style: theme.textTheme.bodyMedium!, textAlign: 'center' }),
        ],
        { mainSize: 'min' },
      ),
    );
  }
}

function activeLicensePane(current: Widget | null, outgoing: readonly Widget[]): Widget {
  return new Stack(
    [
      ...outgoing.map((item) => new ExcludeFocus(new ExcludeSemantics(new IgnorePointer(item)))),
      ...(current ? [current] : []),
    ],
    { fit: 'expand' },
  );
}

function pane(context: BuildContext, child: Widget): Widget {
  return new ConstrainedBox(
    new Material({
      type: MaterialType.card,
      color: Theme.of(context).cardColor,
      elevation: paneElevation,
      child,
    }),
    new BoxConstraints(0, 600),
  );
}

function packageTitle(context: BuildContext, data: PackageLicenses): Widget {
  const theme = Theme.of(context);
  const titleStyle = theme.appBarTheme.titleTextStyle ?? theme.textTheme.titleLarge!;
  const subtitleStyle = theme.textTheme.titleSmall!;
  const tint = theme.appBarTheme.foregroundColor?.toARGB32();
  return new Column(
    [
      new Text(data.name, {
        style: tint === undefined ? titleStyle : titleStyle.copyWith({ color: tint }),
      }),
      new Text(MaterialLocalizations.of(context).licensesPackageDetailText(data.entries.length), {
        style: tint === undefined ? subtitleStyle : subtitleStyle.copyWith({ color: tint }),
      }),
    ],
    { mainSize: 'min', crossAlign: 'start' },
  );
}

class WidePackageLicensePane extends StatelessWidget {
  constructor(readonly data: PackageLicenses) {
    super(new ValueKey(data.name));
  }

  override build(context: BuildContext): Widget {
    const screenHeight = MediaQuery.of(context).height;
    const minSize = screenHeight <= kToolbarHeight ? 1 : 1 - kToolbarHeight / screenHeight;
    return new DraggableScrollableSheet({
      minChildSize: minSize,
      initialChildSize: minSize,
      expand: false,
      builder: (context, controller) =>
        new Card({
          color: Theme.of(context).cardColor,
          elevation: paneElevation,
          clipBehavior: 'antiAlias',
          margin: EdgeInsets.fromLTRB(paneElevation, 0, paneElevation, 0),
          shape: paneShape,
          child: new Column(
            [
              new Padding(EdgeInsets.all(16), packageTitle(context, this.data)),
              new Divider({ height: 1 }),
              new Expanded(new PackageLicenseList(this.data, controller)),
            ],
            { crossAlign: 'stretch' },
          ),
        }),
    });
  }
}

class PackageLicenseList extends StatefulWidget {
  constructor(
    readonly data: PackageLicenses,
    readonly scrollController: ScrollController | null = null,
  ) {
    super(new PageStorageKey(data.name));
  }

  override createState(): State<PackageLicenseList> {
    return new PackageLicenseListState();
  }
}

class PackageLicenseListState extends State<PackageLicenseList> {
  private ownedController: ScrollController | null = null;
  private readonly visited: (LicenseParagraph | null)[] = [];
  private paragraphs: Iterator<LicenseParagraph | null> | null = null;

  override didUpdateWidget(old: PackageLicenseList): void {
    super.didUpdateWidget(old);
    if (old.data.entries === this.widget.data.entries) return;
    this.visited.length = 0;
    this.paragraphs = null;
  }

  private paragraphAt(index: number): LicenseParagraph | null | undefined {
    while (this.visited.length <= index) {
      this.paragraphs ??= licenseParagraphs(this.widget.data.entries);
      const next = this.paragraphs.next();
      if (next.done) return undefined;
      this.visited.push(next.value);
    }
    return this.visited[index];
  }

  override dispose(): void {
    this.ownedController?.dispose();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const controller =
      this.widget.scrollController ?? (this.ownedController ??= new ScrollController());
    const padding = gutter(context);
    const safe = MediaQuery.maybePaddingOf(context) ?? EdgeInsets.zero;
    return new ScrollConfiguration({
      behavior: ScrollConfiguration.of(context).copyWith({ scrollbars: false }),
      child: new Scrollbar({
        controller,
        child: ListView.builder({
          controller,
          key: new PageStorageKey('license-paragraphs'),
          primary: false,
          padding: EdgeInsets.fromLTRB(
            padding + safe.left,
            0,
            padding + safe.right,
            padding + safe.bottom,
          ),
          itemBuilder: (_context, index) => {
            const paragraph = this.paragraphAt(index);
            if (paragraph === undefined) return null;
            return new Directionality(
              'ltr',
              paragraph === null
                ? new Padding(EdgeInsets.all(textSeparation), new Divider())
                : paragraphWidget(paragraph),
            );
          },
        }),
      }),
    });
  }
}

function* licenseParagraphs(
  entries: readonly LicenseEntry[],
): IterableIterator<LicenseParagraph | null> {
  for (const entry of entries) {
    yield null;
    yield* entry.paragraphs;
  }
}

const heading = new TextStyle({ fontWeight: FontWeight.bold });
function paragraphWidget(paragraph: LicenseParagraph): Widget {
  const centered = paragraph.indent === LicenseParagraph.centeredIndent;
  return new Padding(
    EdgeInsetsDirectional.only({
      top: centered ? 16 : 8,
      start: centered ? 0 : 16 * paragraph.indent,
    }),
    new Text(paragraph.text, {
      locale: 'en-US',
      ...(centered ? { textAlign: 'center', style: heading } : {}),
    }),
  );
}
