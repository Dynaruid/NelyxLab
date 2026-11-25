# Nelyx Skia for Web

`@nelyx/skia-web` provides CanvasKit/Ganesh WebGL2 rendering and text layout. The [SDK](../../../sdk/README.md) connects it to browser input and application lifetime.

## API and resources

Import the renderer from `@nelyx/skia-web/library`; see [package.json](package.json) for public exports.

Assets are checked against declared hashes. Frames retain resource leases until WebGL fence retirement or an owned close drain. Await `WebSkiaLibrary.dispose()`; reentrant callers receive the same Promise. Retirement failures preserve that error and unconfirmed dependencies.

## Runtime

The package depends on the default build of `canvaskit-wasm@0.42.0`. The Web and Tauri frontend builder verifies the installed files against the [runtime manifest](native-manifest.json) and publishes the npm JS, Wasm and license with the app. Each CanvasKit instance starts with 128 MiB of linear memory. The shipped Wasm declares a 2 GiB maximum.

The text adapter converts UTF-16 offsets for CanvasKit's line lookup, registers fonts through `TypefaceFontProvider`, and paints a hyphen when a manual soft hyphen ends a line. Workers record Pictures from the transferred drawing commands.

## Build and use

From the repository root, after `npm ci`:

```powershell
npm run build:skia
```

Follow the [Web sample guide](../../../../sample/nelyx-testbed-app-2/README.md#web) to build and serve an app. Full graphics recovery, physical input/IME, screen readers, and performance require further qualification.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported notices remain in [licenses/](licenses/).
