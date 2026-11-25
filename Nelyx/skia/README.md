# Nelyx Skia

**English** | [한국어](README.ko.md)

Browsers and Tauri WebViews use the default WebGL2 build of the pinned npm package `canvaskit-wasm@0.42.0`. The frontend builder reads its installed JS and Wasm files, checks the hashes in the manifest and publishes both files as local app assets. [Runtime manifest](packages/web/native-manifest.json)

Run `npm install` before `npm run build:sdk`. `npm run build:skia` compiles the Web adapter.

The source recipe, patches and licenses describe the reused Skia and React Native Skia code. [Third party notices](THIRD_PARTY_NOTICES.md) · [Package](packages/web/README.md)
