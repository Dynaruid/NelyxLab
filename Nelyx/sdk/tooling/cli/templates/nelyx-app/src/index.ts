import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { createApplicationState, defineApplication } from './app.ts';
import type { ApplicationState } from './app.ts';

export const applicationName = 'NelyxTestbed';

/** Common entry: each platform runner starts an independent application. */
export function main(state: ApplicationState = createApplicationState()): {
  state: ApplicationState;
  definition: ApplicationDefinition;
} {
  return { state, definition: defineApplication(state) };
}
