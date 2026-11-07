// SPDX-License-Identifier: BSD-3-Clause
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { widgetApplication } from '@nelyx/core/framework/widgets/root';
import { ComponentsGallery } from './gallery.ts';
export interface ApplicationState {
  readonly initialText: string;
}
export interface ApplicationOptions {
  readonly accessibilityEnabled?: boolean;
}
export function createApplicationState(): ApplicationState {
  return { initialText: '안녕하세요, Nelyx!' };
}
export function defineApplication(
  state: ApplicationState,
  options: ApplicationOptions = {},
): ApplicationDefinition {
  return widgetApplication({
    id: 'nelyx.components-gallery',
    defaultFont: 'sample-font',
    accessibilityEnabled: options.accessibilityEnabled ?? true,
    semanticsUpdateInterval: 300,
    createRoot: () => new ComponentsGallery(state.initialText),
  });
}
