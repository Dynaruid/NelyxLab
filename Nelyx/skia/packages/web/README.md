# Nelyx Skia for Web

`@nelyx/skia-web` implements CanvasKit/Ganesh WebGL2 rendering and text layout. The [Web SDK](../../../sdk/README.md) connects it to DOM input and application lifetime.

## API and resource lifetime

Import the renderer from `@nelyx/skia-web/library`; the package has no aggregate root API.

Assets are checked against source hashes and byte budgets. Submission leases are returned after actual WebGL fence retirement or an owned close drain. The renderer manages visibility, context loss, error propagation, and shutdown resources. Complete graphics recovery and physical/accessibility/memory qualification remain open.

`WebSkiaLibrary.dispose()` closes admission before resource callbacks and returns the same Promise to every caller, including reentrant calls. Retirement errors reject that Promise; subsequent calls preserve the failure and unconfirmed dependencies instead of reporting successful completion. Cleanup runs synchronously until that Promise settles.

The package targets `m153-nelyx-paragraph.1`, built from locked Skia source with
the Nelyx paragraph binding. The source build supplies full native line-metric fields, UTF16
line lookup and soft-hyphen visibility. The engine currently reports the same
value for ascent and unscaled ascent; the adapter preserves that engine value.
Paragraph style conversion follows the pinned Flutter engine's disabled hinting,
tab replacement and disabled rounding hack. Older native JSI bindings need the
matching paragraph API1 update; Web runtime and native JSI qualification are separate.

The runtime must be built from the current Nelyx source and patch. Previous
binaries are not accepted. After a source build, supply the new runtime with
`node Nelyx/skia/eng/prepare-web-runtime.mjs <built-runtime-directory> --adopt`
from the repository root. Until then, the package manifest reports `requires-build`.

## Build and use

From the repository root after installing workspace dependencies:

```powershell
npm run build:skia
npm run check --workspace @nelyx/skia-web
```

The first command prepares renderer packages; the second performs compiler typechecking. To build and run the browser application, follow the [Web sample guide](../../../../sample/nelyx-testbed-app-2/README.md#web).

For a fresh source checkout, prepare the locked Web runtime explicitly using the
[source-build recipe](../../eng/source-build/README.md). Run
`node Nelyx/skia/eng/prepare-web-runtime.mjs <owned-build-output>` before Web
package supply. `prepare-sample.mjs web` rejects missing or changed prepared
runtime bytes. App startup does not download or build a replacement engine.

## License

Nelyx contributions use [BSD-3-Clause](LICENSE.md). Imported notices remain in [`licenses/`](licenses/).
