// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Adapted from dart:ui text.dart at flutter-coverage.json's source pin.
import { FlutterError } from '../foundation/flutter-error.ts';
import { currentFontLoader } from './font-loader-binding.ts';

/** Load into the current App namespace and publish its font change before
 * completing. An omitted/null/empty family uses the C++ decoder's family name. */
export async function loadFontFromList(
  list: Uint8Array,
  options: { readonly fontFamily?: string | null } = {},
): Promise<void> {
  const backend = currentFontLoader();
  if (!backend) throw new FlutterError('loadFontFromList requires an initialized App font owner');
  await backend.loadFont(list, options.fontFamily ?? undefined);
}
