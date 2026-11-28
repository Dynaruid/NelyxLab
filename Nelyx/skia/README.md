# Nelyx Skia

**English** | [한국어](README.ko.md)

Browsers and Tauri WebViews use the default WebGL2 build of the pinned npm package `canvaskit-wasm@0.42.0`. The frontend builder reads its installed JS and Wasm files, checks the hashes in the manifest and publishes both files as local app assets. [Runtime manifest](packages/web/native-manifest.json)

Run `npm install` before `npm run build:sdk`. `npm run build:skia` compiles the Web adapter.

Opted-in Tauri windows replay transparent clears, translations, rectangular clips, rectangles, rounded rectangles, and lines from Web frame wire v1 in native Skia. The SDK verifies the pinned archive size and SHA-256 before building with the Cargo lockfile. The Windows adapter uploads premultiplied BGRA pixels to DirectComposition through D3D11. The Android adapter posts premultiplied RGBA pixels to a transparent `TextureView`. The Linux adapter draws premultiplied BGRA pixels through Cairo in `GtkOverlay`. The iOS and macOS adapters use Metal to copy clipped, premultiplied BGRA pixels into a drawable from a transparent `CAMetalLayer`. [Supply manifest](../sdk/tooling/cli/templates/tauri/skia-foreground/supply.json) · [Standalone Windows check](eng/build-native-foreground.mjs)

Run the check from the repository root.

```powershell
node Nelyx/skia/eng/build-native-foreground.mjs test
```

The source recipe, patches and licenses describe the reused Skia and React Native Skia code. [Third party notices](THIRD_PARTY_NOTICES.md) · [Package](packages/web/README.md)
