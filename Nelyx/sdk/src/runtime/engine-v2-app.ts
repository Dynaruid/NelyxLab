// SPDX-License-Identifier: BSD-3-Clause
import { WidgetHost } from '@nelyx/core/v2';
import type { Widget } from '@nelyx/core/v2';
import { launchAppSession } from './app-session.ts';
import type { AppSessionDefinition } from './app-session.ts';
export type { EngineV2AppContext } from './app-session.ts';
/** Transitional data-Widget API. New applications use @nelyx/sdk/app. */
export interface EngineV2App extends AppSessionDefinition<Widget> {}
export function defineEngineV2App(app: EngineV2App): EngineV2App {
  return app;
}
/** Transitional data launcher. The CLI links original Apps to launchApp directly. */
export function launchEngineV2App(definition: EngineV2App): void {
  launchAppSession(
    definition as EngineV2App,
    (view, onError, onExecution) => new WidgetHost(view, { onError, onExecution }),
  );
}
