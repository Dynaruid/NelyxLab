# Nelyx SDK

**English** | [한국어](README.ko.md)

`src/index.ts` calls `startFrontend` with a React component. The component passes its widget definition and the supplied options to `ApplicationSurface` from `@nelyx/sdk/frontend/dom/surface`. The frontend validates the Rust backend before mounting. The shared DOM implementation handles canvas resources, pointer and keyboard input, IME, selection and accessibility.

`getFrontendHost()` reports the target, OS, backend identity and window features. Use `invokeAppBackend('app.example', 10)` from `@nelyx/sdk/frontend/dom/environment` to call a command registered in the app's Rust library. CanvasKit rendering and frame scheduling run in the DOM.

Widgets use the standard `Clipboard` and `HapticFeedback` APIs. On web and PWA, the app backend Wasm binds browser clipboard, permission changes and vibration to the canvas owner's window. Clipboard menus only pre-read text on a desktop browser with a confirmed read grant. On Android and iOS, apps can opt into the Tauri haptics plugin per window. Android windows can also opt into dispatching system Back through the active navigator. The CLI guide shows the window settings and fallback behavior.

Use `deviceServicesFor(context.services)` from `@nelyx/sdk/devices` in a widget, or pass the context received by `AppDefinition.startup`. Each service is exposed as an optional property. For example, call `devices?.location?.current()` from a user action or begin a location watch and dispose of its subscription when the widget no longer needs updates.

A selected file handle exposes its name and byte-reading method. Camera streams and Bluetooth connections have a `dispose()` method. Closing the view releases its subscriptions and device handles. WebAuthn returns an assertion for the server that issued the challenge. For native NFC, the OS reader controls the active tag session.

Device bindings use backend protocol 3. Refresh the SDK supply and regenerate the app's platform locks together. SDK contributors can run `npm run generate:backend-bindings` to refresh the wasm-bindgen and Specta declarations. The Wasm supply build and `npm run check:backend-bindings` compare the generated contracts.

Declare `nelyx.app/v4` in the app's package.json with `appEntry`, optional `backend.manifest`, `targets.web` and/or `targets.tauri`. Font and image references are app-relative. The CLI verifies the bytes and includes declared notices. [CLI guide](tooling/cli/README.md) · [Core](../README.md) · [Renderer](../skia/README.md)
