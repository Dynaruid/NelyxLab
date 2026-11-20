# Nelyx Skia

**English** | [한국어](README.ko.md)

The @nelyx/skia-web package supplies the pinned CanvasKit/Ganesh WebGL2 runtime for browsers and Tauri WebViews. Vite development and PWA builds read the CanvasKit JS and Wasm from the installed package and verify the hashes in native-manifest.json.

On a fresh checkout build and prepare the owned CanvasKit runtime before npm run build:sdk. npm run build:skia verifies the prepared runtime and emits the Web adapter. [Source recipe and pins](eng/source-build/README.md)

The source recipe, patches and licenses describe the reused Skia and React Native Skia code. [Third party notices](THIRD_PARTY_NOTICES.md) · [Package](packages/web/README.md)
