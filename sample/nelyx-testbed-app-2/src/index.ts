import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import {createApplicationState, defineApplication} from './app.ts';
import type {ApplicationState,ApplicationOptions} from './app.ts';

export const applicationName = 'NelyxTestbed2';

/** Common entry: each platform runner starts an independent application. */
export function main(state: ApplicationState = createApplicationState(),options:ApplicationOptions={}): {state: ApplicationState; definition: ApplicationDefinition} {
  return {state, definition: defineApplication(state,options)};
}
