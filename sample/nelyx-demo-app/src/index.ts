// SPDX-License-Identifier: BSD-3-Clause
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { createApplicationState, defineApplication } from './app.ts';
import type { ApplicationOptions, ApplicationState } from './app.ts';

export const applicationName = 'NelyxDemoApp';

export function main(
  state: ApplicationState = createApplicationState(),
  options: ApplicationOptions = {},
): { state: ApplicationState; definition: ApplicationDefinition } {
  return { state, definition: defineApplication(state, options) };
}
