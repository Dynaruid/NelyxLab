# Nelyx SDK

**English** | [한국어](README.ko.md)

The application exports main() from src/index.ts and provides its widget definition to ApplicationSurface. Register the React component with registerApplication on a DOM container. close() unmounts the React root and waits for the canvas and native graphics resources to drain. The default Vite entry calls closeAllWebApplications before a controlled full reload.

The browser and Tauri execute the same SDK and CanvasKit renderer. Nelyx owns the canvas, resource lifetimes, selection and IME input, DOM accessibility and browser services. getWebDeployment reports the PWA format, browser or Tauri host, and the detected OS. For Tauri IPC the app owns its capabilities and the main WebView.

Use nelyx.app/v3 in package.json with appEntry, assets and pwa. The PWA component is a React component. Supply the app ID, short name, installation icons and theme color in pwa. A v2 Web reader maps targets.web and the shared fields in memory. Font and image assets use app-relative paths. The runner verifies their content and copies declared notices with the release.

[CLI and migration](tooling/cli/README.md) · [Core](../README.md) · [Renderer](../skia/README.md)
