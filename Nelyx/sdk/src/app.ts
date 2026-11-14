// SPDX-License-Identifier: BSD-3-Clause
import { widgetApplication } from '@nelyx/core/framework/widgets/root';
import type { WidgetApplicationOptions } from '@nelyx/core/framework/widgets/root';
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';

/** One Source Widget/Element/RenderObject pipeline per View. The selected backend consumes drawing. */
export type AppDefinition = WidgetApplicationOptions & {
  readonly startup?: ApplicationDefinition['startup'];
};
export type App = ApplicationDefinition;
export function defineApp(options: AppDefinition): App {
  const allowed = new Set([
    'id',
    'background',
    'assets',
    'defaultFont',
    'accessibilityEnabled',
    'semanticsUpdateInterval',
    'createRoot',
    'startup',
  ]);
  if (Object.keys(options).some((key) => !allowed.has(key)))
    throw Error('Unknown Source application option');
  if (typeof options.createRoot !== 'function')
    throw Error('Source applications require a synchronous createRoot callback');
  return {
    ...widgetApplication(options),
    ...(options.startup ? { startup: options.startup } : {}),
  };
}
