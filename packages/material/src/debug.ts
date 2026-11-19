// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/debug.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { ErrorDescription, ErrorHint, ErrorSummary } from '@nelyx/core/foundation/diagnostics';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { LookupBoundary } from '@nelyx/core/framework/widgets/lookup-boundary';
import { Material } from './material.ts';
import { MaterialLocalizationsScope } from './material-localizations.ts';
import { Scaffold } from './scaffold.ts';
import { ScaffoldMessenger } from './scaffold-messenger.ts';

export function debugCheckHasMaterial(context: BuildContext): true {
  if (
    FoundationBuildMode.debug &&
    !LookupBoundary.findAncestorWidgetOfExactType(context, Material)
  ) {
    const hidden = LookupBoundary.debugIsHidingAncestorWidgetOfExactType(context, Material);
    throw FlutterError.fromParts([
      new ErrorSummary(
        hidden
          ? 'No Material widget found within the closest LookupBoundary.'
          : 'No Material widget found.',
      ),
      new ErrorDescription(`${context.widget.constructor.name} requires a Material ancestor.`),
      new ErrorHint(
        'Provide Material directly or use a Card, Dialog, Drawer, or Scaffold that provides it.',
      ),
    ]);
  }
  return true;
}

export function debugCheckHasMaterialLocalizations(context: BuildContext): true {
  if (
    FoundationBuildMode.debug &&
    !context.maybeDependOn(MaterialLocalizationsScope) &&
    !context.maybeDependOn(Localizations)
  ) {
    throw FlutterError.fromParts([
      new ErrorSummary('No MaterialLocalizations found.'),
      new ErrorDescription(`${context.widget.constructor.name} requires Material localizations.`),
      new ErrorHint('Use MaterialApp or provide a MaterialLocalizationsScope.'),
    ]);
  }
  return true;
}

export function debugCheckHasScaffold(context: BuildContext): true {
  if (
    FoundationBuildMode.debug &&
    !(context.widget instanceof Scaffold) &&
    !context.findAncestorWidgetOfExactType(Scaffold)
  ) {
    throw FlutterError.fromParts([
      new ErrorSummary('No Scaffold widget found.'),
      new ErrorDescription(`${context.widget.constructor.name} requires a Scaffold ancestor.`),
    ]);
  }
  return true;
}

export function debugCheckHasScaffoldMessenger(context: BuildContext): true {
  if (FoundationBuildMode.debug && !context.findAncestorWidgetOfExactType(ScaffoldMessenger)) {
    throw FlutterError.fromParts([
      new ErrorSummary('No ScaffoldMessenger widget found.'),
      new ErrorDescription(
        `${context.widget.constructor.name} requires a ScaffoldMessenger ancestor.`,
      ),
      new ErrorHint('MaterialApp supplies a ScaffoldMessenger to its routed content.'),
    ]);
  }
  return true;
}
