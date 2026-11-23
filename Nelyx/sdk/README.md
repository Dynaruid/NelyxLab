# Nelyx SDK

**English** | [한국어](README.ko.md)

`src/index.ts` calls `startFrontend` with a React component. The component passes its widget definition and the supplied options to `ApplicationSurface` from `@nelyx/sdk/frontend/dom/surface`. The frontend validates the Rust backend before mounting. The shared DOM implementation handles canvas resources, pointer and keyboard input, IME, selection and accessibility.

`getFrontendHost()` reports the target, OS and backend identity. Use `invokeAppBackend('app.example', 10)` from `@nelyx/sdk/frontend/dom/environment` to call a command registered in the app's Rust library. The Web backend uses Wasm and browser Clipboard and Permissions APIs. The Tauri backend uses IPC, the declared clipboard commands and the Android safe-area plugin. CanvasKit rendering and frame scheduling stay in the DOM.

Declare `nelyx.app/v4` in the app's package.json with `appEntry`, optional `backend.manifest`, `targets.web` and/or `targets.tauri`. Font and image references are app-relative. The CLI verifies the bytes and includes declared notices. [CLI guide](tooling/cli/README.md) · [Core](../README.md) · [Renderer](../skia/README.md)
