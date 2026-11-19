// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/debug.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { ErrorDescription, ErrorHint, ErrorSummary } from '@nelyx/core/foundation/diagnostics';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { CupertinoLocalizationsScope } from './cupertino-localizations.ts';

export function debugCheckHasCupertinoLocalizations(context: BuildContext): true {
  if (
    FoundationBuildMode.debug &&
    !context.maybeDependOn(CupertinoLocalizationsScope) &&
    !context.maybeDependOn(Localizations)
  ) {
    throw FlutterError.fromParts([
      new ErrorSummary('No CupertinoLocalizations found.'),
      new ErrorDescription(`${context.widget.constructor.name} requires Cupertino localizations.`),
      new ErrorHint('Use CupertinoApp or provide a CupertinoLocalizationsScope.'),
    ]);
  }
  return true;
}
