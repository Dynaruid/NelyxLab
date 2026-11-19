// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/search.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import type { Animation, AnimationStatus } from '@nelyx/core/framework/animation/animation';
import {
  ProxyAnimation,
  kAlwaysDismissedAnimation,
} from '@nelyx/core/framework/animation/animations';
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueKey } from '@nelyx/core/foundation/key';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { AnimatedSwitcher } from '@nelyx/core/framework/widgets/animated-switcher';
import { KeyedSubtree } from '@nelyx/core/framework/widgets/basic';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import type { NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import type { EditingKeyboardType, TextInputAction } from '@nelyx/core/hosting/interaction';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { SystemUiOverlayStyle } from '@nelyx/core/services/system-ui-overlay-style';
import { SemanticsInputType } from '@nelyx/core/ui/semantics';
import { AppBar } from './app-bar.ts';
import { AppBarThemeData } from './app-bar-theme.ts';
import { Colors } from './colors.ts';
import { InputBorder } from './input-border.ts';
import { InputDecoration } from './input-decoration.ts';
import { InputDecorationThemeData } from './input-decoration-theme-data.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Scaffold } from './scaffold.ts';
import { TextField } from './text-field.ts';
import { Theme } from './theme.ts';
import type { ThemeData } from './theme-data.ts';

type SearchBody = 'suggestions' | 'results';
const searchDuration = 300;
const searchResources = Symbol('searchResources');
let nextSearchFieldId = 0;

interface SearchResources<T> {
  route: SearchPageRoute<T> | null;
  query: string;
  disposed: boolean;
  readonly animation: ProxyAnimation;
}

export interface SearchDelegateOptions {
  readonly searchFieldLabel?: string | null;
  readonly searchFieldStyle?: TextStyle | null;
  readonly searchFieldDecorationTheme?: InputDecorationThemeData | null;
  readonly keyboardType?: EditingKeyboardType | null;
  readonly textInputAction?: TextInputAction;
  readonly autocorrect?: boolean;
  readonly enableSuggestions?: boolean;
}

export abstract class SearchDelegate<T = unknown> {
  readonly searchFieldLabel: string | null;
  readonly searchFieldStyle: TextStyle | null;
  readonly searchFieldDecorationTheme: InputDecorationThemeData | null;
  readonly keyboardType: EditingKeyboardType | null;
  readonly textInputAction: TextInputAction;
  readonly autocorrect: boolean;
  readonly enableSuggestions: boolean;
  automaticallyImplyLeading: boolean | null = null;
  leadingWidth: number | null = null;
  readonly [searchResources]: SearchResources<T> = {
    route: null,
    query: '',
    disposed: false,
    animation: new ProxyAnimation(kAlwaysDismissedAnimation),
  };

  protected constructor({
    searchFieldLabel = null,
    searchFieldStyle = null,
    searchFieldDecorationTheme = null,
    keyboardType = null,
    textInputAction = 'search',
    autocorrect = true,
    enableSuggestions = true,
  }: SearchDelegateOptions = {}) {
    invariant(
      searchFieldStyle === null || searchFieldDecorationTheme === null,
      'conflicting-search-field-style',
      'SearchDelegate takes either searchFieldStyle or searchFieldDecorationTheme',
    );
    this.searchFieldLabel = searchFieldLabel;
    this.searchFieldStyle = searchFieldStyle;
    this.searchFieldDecorationTheme = searchFieldDecorationTheme;
    this.keyboardType = keyboardType;
    this.textInputAction = textInputAction;
    this.autocorrect = autocorrect;
    this.enableSuggestions = enableSuggestions;
  }

  abstract buildSuggestions(context: BuildContext): Widget;
  abstract buildResults(context: BuildContext): Widget;
  abstract buildLeading(context: BuildContext): Widget | null;
  abstract buildActions(context: BuildContext): readonly Widget[] | null;

  buildBottom(_context: BuildContext): PreferredSizeWidget | null {
    return null;
  }

  buildFlexibleSpace(_context: BuildContext): Widget | null {
    return null;
  }

  appBarTheme(context: BuildContext): ThemeData {
    const theme = Theme.of(context);
    const dark = theme.colorScheme.brightness === 'dark';
    return theme.copyWith({
      appBarTheme: new AppBarThemeData({
        systemOverlayStyle: dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
        backgroundColor: dark ? Colors.grey.shade900 : Colors.white,
        iconTheme: theme.primaryIconTheme.copyWith({ color: Colors.grey }),
        titleTextStyle: theme.textTheme.titleLarge,
        toolbarTextStyle: theme.textTheme.bodyMedium,
      }),
      inputDecorationTheme:
        this.searchFieldDecorationTheme ??
        new InputDecorationThemeData({
          hintStyle: this.searchFieldStyle ?? theme.inputDecorationTheme.hintStyle,
          border: InputBorder.none,
        }),
    });
  }

  get query(): string {
    const state = this[searchResources];
    return state.route?.query ?? state.query;
  }

  set query(value: string) {
    const state = this[searchResources];
    if (state.route) state.route.query = value;
    else state.query = value;
  }

  get transitionAnimation(): Animation<number> {
    return this[searchResources].animation;
  }

  showResults(_context: BuildContext): void {
    this[searchResources].route?.showResults();
  }

  showSuggestions(_context: BuildContext): void {
    const route = this[searchResources].route;
    invariant(route !== null, 'inactive-search-delegate', 'SearchDelegate has no active search');
    route.showSuggestions();
  }

  close(_context: BuildContext, result: T): void {
    this[searchResources].route?.close(result);
  }

  dispose(): void {
    const state = this[searchResources];
    state.disposed = true;
    state.animation.parent = null;
  }
}

export interface ShowSearchOptions<T> {
  readonly context: BuildContext;
  readonly delegate: SearchDelegate<T>;
  readonly query?: string | null;
  readonly useRootNavigator?: boolean;
  readonly maintainState?: boolean;
}

export function showSearch<T>({
  context,
  delegate,
  query = '',
  useRootNavigator = false,
  maintainState = false,
}: ShowSearchOptions<T>): Promise<T | null> {
  const state = delegate[searchResources];
  invariant(!state.disposed, 'disposed-search-delegate', 'SearchDelegate has been disposed');
  invariant(
    state.route === null,
    'search-delegate-in-use',
    'SearchDelegate already has an active search',
  );
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator });
  const route = new SearchPageRoute(delegate, navigator, query ?? state.query, maintainState);
  state.route = route;
  try {
    const result = navigator.push<T>(route);
    state.animation.parent = route.animation ?? kAlwaysDismissedAnimation;
    return result.then(
      (value) => value ?? null,
      (error: unknown) => {
        route.releaseDelegate();
        throw error;
      },
    );
  } catch (error) {
    route.releaseDelegate();
    throw error;
  }
}

class SearchPageRoute<T> extends PageRoute<T> {
  private page: SearchPageState<T> | null = null;
  body: SearchBody | null = 'suggestions';
  readonly barrierColor = null;
  readonly barrierLabel = null;
  readonly transitionDuration = searchDuration;

  constructor(
    readonly delegate: SearchDelegate<T>,
    private readonly navigator: NavigatorController,
    private savedQuery: string,
    readonly maintainState: boolean,
  ) {
    super();
  }

  get query(): string {
    return this.page?.controller.text ?? this.savedQuery;
  }

  set query(value: string) {
    if (this.page) this.page.controller.text = value;
    else this.savedQuery = value;
  }

  attachPage(page: SearchPageState<T>): void {
    this.page = page;
  }

  detachPage(page: SearchPageState<T>): void {
    if (this.page !== page) return;
    this.savedQuery = page.controller.text;
    this.page = null;
  }

  private setBody(body: SearchBody | null): void {
    if (this.body === body) return;
    this.body = body;
    this.page?.refresh();
  }

  showResults(): void {
    this.page?.focusNode.unfocus();
    this.setBody('results');
  }

  showSuggestions(): void {
    this.setBody('suggestions');
    this.page?.focusNode.requestFocus();
  }

  close(result?: T): void {
    this.setBody(null);
    this.page?.focusNode.unfocus();
    while (this.navigator.routes.some((entry) => entry.route === this)) {
      if (this.navigator.routes.at(-1)?.route === this) {
        this.navigator.pop(result);
        return;
      }
      if (!this.navigator.pop()) return;
    }
  }

  releaseDelegate(): void {
    const state = this.delegate[searchResources];
    if (state.route !== this) return;
    state.query = this.query;
    state.route = null;
    this.setBody(null);
  }

  override didComplete(result: unknown): void {
    super.didComplete(result);
    this.releaseDelegate();
  }

  override buildPage(_context: BuildContext, animation: Animation<number>): Widget {
    return new SearchPage(this, animation);
  }

  override buildTransitions(
    _context: BuildContext,
    animation: Animation<number>,
    _secondaryAnimation: Animation<number>,
    child: Widget,
  ): Widget {
    return new FadeTransition({ opacity: animation, child });
  }
}

class SearchPage<T> extends StatefulWidget {
  constructor(
    readonly route: SearchPageRoute<T>,
    readonly animation: Animation<number>,
  ) {
    super();
  }

  createState(): State<SearchPage<T>> {
    return new SearchPageState<T>();
  }
}

class SearchPageState<T> extends State<SearchPage<T>> {
  // Each mounted editor owns its controller so a retiring route can fade out while the delegate is reused.
  controller!: TextEditingController;
  private readonly fieldId = 'search-page-field-' + ++nextSearchFieldId;
  readonly focusNode = new FocusNode({
    onKeyEvent: (_node, event) => {
      if (!(event instanceof KeyDownEvent) || event.logicalKey !== LogicalKeyboardKey.escape)
        return 'ignored';
      this.widget.route.close();
      return 'handled';
    },
  });

  readonly refresh = (): void => {
    if (this.mounted) this.setState(() => {});
  };

  private readonly onFocus = (): void => {
    if (this.focusNode.hasFocus && this.widget.route.body === 'results') {
      this.widget.route.showSuggestions();
    }
  };

  private readonly onAnimation = (status: AnimationStatus): void => {
    if (!status.isCompleted) return;
    this.widget.animation.removeStatusListener(this.onAnimation);
    const route = this.widget.route;
    if (route.isCurrent && route.body === 'suggestions') this.focusNode.requestFocus();
  };

  override initState(): void {
    super.initState();
    const { route, animation } = this.widget;
    this.controller = new TextEditingController(route.query);
    this.controller.addListener(this.refresh);
    this.focusNode.addListener(this.onFocus);
    route.attachPage(this);
    if (animation.isCompleted) this.onAnimation(animation.status);
    else animation.addStatusListener(this.onAnimation);
  }

  override dispose(): void {
    this.widget.animation.removeStatusListener(this.onAnimation);
    this.widget.route.detachPage(this);
    this.focusNode.removeListener(this.onFocus);
    this.focusNode.dispose();
    this.controller.removeListener(this.refresh);
    this.controller.dispose();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { delegate, body } = this.widget.route;
    const theme = delegate.appBarTheme(context);
    const label = delegate.searchFieldLabel ?? MaterialLocalizations.of(context).searchFieldLabel;
    const bodyWidget =
      body === null
        ? null
        : new KeyedSubtree({
            key: new ValueKey(body),
            child:
              body === 'results'
                ? delegate.buildResults(context)
                : delegate.buildSuggestions(context),
          });
    return new Semantics({
      explicitChildNodes: true,
      scopesRoute: true,
      namesRoute: true,
      label: theme.platform === 'iOS' || theme.platform === 'macOS' ? '' : label,
      child: new Theme(
        theme,
        new Scaffold({
          appBar: new AppBar({
            leadingWidth: delegate.leadingWidth,
            automaticallyImplyLeading: delegate.automaticallyImplyLeading ?? true,
            leading: delegate.buildLeading(context),
            title: new Semantics({
              inputType: SemanticsInputType.search,
              child: new TextField({
                id: this.fieldId,
                controller: this.controller,
                focusNode: this.focusNode,
                style: delegate.searchFieldStyle ?? theme.textTheme.titleLarge,
                textInputAction: delegate.textInputAction,
                autocorrect: delegate.autocorrect,
                enableSuggestions: delegate.enableSuggestions,
                ...(delegate.keyboardType === null ? {} : { keyboardType: delegate.keyboardType }),
                onSubmitted: () => delegate.showResults(context),
                decoration: new InputDecoration({ hintText: label }),
              }),
            }),
            flexibleSpace: delegate.buildFlexibleSpace(context),
            actions: delegate.buildActions(context),
            bottom: delegate.buildBottom(context),
          }),
          body: new AnimatedSwitcher({ duration: searchDuration, child: bodyWidget }),
        }),
      ),
    });
  }
}
