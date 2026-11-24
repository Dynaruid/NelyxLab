import { defineApp } from '@nelyx/sdk/app';
import { ComponentsGallery } from './gallery.ts';
export function createApplicationState() {
    return { initialText: '안녕하세요, Nelyx!' };
}
export function defineApplication(state, options = {}) {
    return defineApp({
        id: 'nelyx.components-gallery',
        defaultFont: 'sample-font',
        accessibilityEnabled: options.accessibilityEnabled ?? true,
        semanticsUpdateInterval: 300,
        createRoot: () => new ComponentsGallery(state.initialText),
    });
}
export function main(state = createApplicationState(), options = {}) {
    return { state, definition: defineApplication(state, options) };
}
