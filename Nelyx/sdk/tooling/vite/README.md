# @nelyx/vite

The Nelyx PWA runner uses the Vite JavaScript API from its own installation. The app owns the HTML, TypeScript and Vite configuration in web/runner.

    import { definePwaConfig } from '@nelyx/vite/config';

    export default definePwaConfig(import.meta.dirname);

The shared configuration resolves React and Nelyx packages from the runner. It serves verified app assets and CanvasKit in development and publishes them in the PWA. CSS uses Vite HMR. The default runner drains the React root and canvas before reloading application code. Apps with their own React UI can pass a Vite React plugin through the second argument to definePwaConfig.

See the [CLI guide](../cli/README.md) for supply, development, installation and Tauri packaging.
