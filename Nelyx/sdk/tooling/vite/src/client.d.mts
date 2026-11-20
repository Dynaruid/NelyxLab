import type { ComponentType } from 'react';
import type { WebApplicationOptions } from '@nelyx/sdk/platforms/web/application';

export function startPwa(options: {
  config: { readonly name: string; readonly displayName?: string };
  assets: unknown;
  component: ComponentType;
  configure(options: Omit<WebApplicationOptions, 'canvas' | 'input' | 'button'>): void;
}): void;
