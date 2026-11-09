# Nelyx Skia for Web

`@nelyx/skia-web` provides CanvasKit/Ganesh WebGL2 rendering and text layout. The [SDK](../../../sdk/README.md) connects it to browser input and application lifetime.

## API and resources

Import the renderer from `@nelyx/skia-web/library`; see [package.json](package.json) for public exports.

Assets are checked against declared hashes. Frames retain resource leases until WebGL fence retirement or an owned close drain. Await `WebSkiaLibrary.dispose()`; reentrant callers receive the same Promise. Retirement failures preserve that error and unconfirmed dependencies.

## Prepare the runtime

The package uses the source-built `m153-nelyx-paragraph.6` CanvasKit runtime with Nelyx paragraph API1, font-reference Picture API3 and immutable font-collection API1. Picture API3 identifies supplied faces by exact C++ font streams and collection indices, preserving source identities and variation coordinates across owners. It rejects substituted references even when the other face has the same family name. Each receiving provider owns a bounded 16-entry variation cache, reuses exact base-face/coordinate pairs, and clears it on memory pressure and close. The manifest identifies the required source revision, patch, and JavaScript/Wasm files. The npm CanvasKit dependency supplies public type declarations. Each instance keeps the supplier 128 MiB initial linear heap and has an explicit 256 MiB maximum.

Follow the [source-build recipe](../../eng/source-build/README.md#vendor-build-recipes), then supply its output from the repository root:

```text
node Nelyx/skia/eng/prepare-web-runtime.mjs <built-runtime-directory>
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
```

When explicitly selecting a new built candidate, append `--adopt` to update the tracked runtime manifest. Web package supply rejects missing or mismatched prepared bytes. Application startup does not download or build the runtime.

## Build and use

From the repository root, after `npm ci`:

```powershell
npm run build:skia
npm run check --workspace @nelyx/skia-web
```

Follow the [Web sample guide](../../../../sample/nelyx-testbed-app-2/README.md#web) to build and serve an app. Full graphics recovery, physical input/IME, screen readers, and performance require further qualification.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported notices remain in [licenses/](licenses/).
