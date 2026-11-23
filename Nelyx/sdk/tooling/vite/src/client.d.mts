import type { ComponentType } from 'react';
import type { WebApplicationOptions } from '@nelyx/sdk/frontend/dom/application';

export interface FrontendProps {
  readonly options: Omit<WebApplicationOptions, 'canvas' | 'input' | 'button'>;
}
export function startFrontend(component: ComponentType<FrontendProps>): void;
