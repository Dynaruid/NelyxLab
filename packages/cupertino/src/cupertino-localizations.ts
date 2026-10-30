// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selection messages from the pinned localization tables; date/time families remain separate.
import { InheritedWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import { selectionMessages } from './generated/localizations/selection-localizations-data.ts';
import { clearButtonLabels } from './internal/input/clear-localizations.ts';
export class CupertinoLocalizations {
  private readonly messages: Readonly<Record<string, string>>;
  constructor(readonly locale = 'en') {
    const parts = locale.replaceAll('-', '_').split('_'),
      language = parts[0]!,
      script = parts.find((value) => value.length === 4),
      region = parts.find(
        (value) => (value.length === 2 && value !== language) || value.length === 3,
      );
    const candidates = [
      language,
      ...(script ? [language + '_' + script] : []),
      ...(region ? [language + '_' + region] : []),
      parts.join('_'),
    ];
    this.messages = Object.freeze(
      Object.assign(
        { clearButtonLabel: clearButtonLabels.en },
        selectionMessages.en,
        ...candidates.map((key) => ({
          ...selectionMessages[key],
          ...(clearButtonLabels[key] === undefined
            ? {}
            : { clearButtonLabel: clearButtonLabels[key] }),
        })),
      ),
    );
  }
  static of(context: BuildContext): CupertinoLocalizations {
    return (
      context.maybeDependOn(CupertinoLocalizationsScope)?.data ??
      new CupertinoLocalizations(context.maybeDependOn(Localizations)?.locale ?? 'en')
    );
  }
  static get supportedLocales(): readonly string[] {
    return Object.freeze(Object.keys(selectionMessages));
  }
  protected message(key: string): string {
    const value = this.messages[key];
    if (value === undefined) throw new Error('Missing Cupertino selection localization: ' + key);
    return value;
  }
  get cutButtonLabel(): string {
    return this.message('cutButtonLabel');
  }
  get clearButtonLabel(): string {
    return this.message('clearButtonLabel');
  }
  get copyButtonLabel(): string {
    return this.message('copyButtonLabel');
  }
  get pasteButtonLabel(): string {
    return this.message('pasteButtonLabel');
  }
  get selectAllButtonLabel(): string {
    return this.message('selectAllButtonLabel');
  }
  get lookUpButtonLabel(): string {
    return this.message('lookUpButtonLabel');
  }
  get searchWebButtonLabel(): string {
    return this.message('searchWebButtonLabel');
  }
  get shareButtonLabel(): string {
    return this.message('shareButtonLabel');
  }
}
export class DefaultCupertinoLocalizations extends CupertinoLocalizations {
  constructor() {
    super('en');
  }
}
export class CupertinoLocalizationsScope extends InheritedWidget {
  constructor(
    readonly data: CupertinoLocalizations,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return old.data !== this.data;
  }
}
