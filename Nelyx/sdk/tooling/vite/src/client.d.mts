import type { ComponentType } from 'react';
import type { WebApplicationOptions } from '@nelyx/sdk/frontend/dom/application';

export interface FrontendProps {
  readonly options: Omit<
    WebApplicationOptions,
    'canvas' | 'input' | 'button' | 'replaceCanvas' | 'signal' | 'localeBoundary'
  >;
}
export function startFrontend(component: ComponentType<FrontendProps>): void;
/** Load the app module and prepare CanvasKit concurrently at startup. */
export function startLazyFrontend(loadComponent: () => Promise<ComponentType<FrontendProps>>): void;
