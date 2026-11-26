// SPDX-License-Identifier: BSD-3-Clause
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { defineApp } from '@nelyx/sdk/app';
import { DemoApplication } from './demo-application.ts';
import type { DemoRenderSettings, DemoWindowAcrylic } from './settings-screen.ts';
export { DemoApplication } from './demo-application.ts';
export const applicationName = 'NelyxDemoApp';

export interface ApplicationState {
  readonly initialText: string;
}
export interface ApplicationOptions {
  readonly accessibilityEnabled?: boolean;
  /** Experimental cold PageView production inside the date picker only. */
  readonly calendarPreparation?: boolean;
  readonly renderSettings?: DemoRenderSettings;
  readonly windowAcrylic?: DemoWindowAcrylic;
}
export function createApplicationState(): ApplicationState {
  return { initialText: '안녕하세요, Nelyx!' };
}
export function defineApplication(
  state: ApplicationState,
  options: ApplicationOptions = {},
): ApplicationDefinition {
  return defineApp({
    id: 'nelyx.demo',
    // Keep the canvas clear transparent so the gallery can reveal the native backdrop.
    ...(options.windowAcrylic ? { background: 0 } : {}),
    defaultFont: 'sample-font',
    accessibilityEnabled: options.accessibilityEnabled ?? true,
    semanticsUpdateInterval: 300,
    createRoot: () =>
      new DemoApplication(
        state.initialText,
        options.calendarPreparation,
        options.renderSettings,
        options.windowAcrylic,
      ),
  });
}

export function main(
  state: ApplicationState = createApplicationState(),
  options: ApplicationOptions = {},
): { state: ApplicationState; definition: ApplicationDefinition } {
  return { state, definition: defineApplication(state, options) };
}
