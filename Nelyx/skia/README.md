# Nelyx Skia

**English** | [한국어](README.ko.md)

Nelyx's rendering layer: shared native graphics and text, React Native surface adapters, and CanvasKit rendering for the browser. The [SDK](../sdk/README.md) connects renderers to application hosts and input.

## Renderer layout

| Path | Purpose |
| --- | --- |
| [native/](native/) | Common renderer, GPU, and text implementation |
| [packages/native/](packages/native/README.md) | Shared native renderer, resources, paragraphs, and JSI bindings |
| [packages/rn/](packages/rn/README.md) | React Native components, surfaces, and adapters |
| [packages/web/](packages/web/README.md) | CanvasKit/Ganesh WebGL2 renderer and text |
| [vendor/](vendor/) | Pinned native input locks and supplier configuration |
| [eng/source-build/](eng/source-build/README.md) | Vendor source preparation and build recipes |

Android/Apple use the pinned m154/154.1.0 supply. Windows/Linux use the matching m153 Vulkan SDK and module sources. Each target requires compatible ABI, source inventory, and runtime inputs.

## Package build

From the repository root, after `npm ci`:

```powershell
npm run build:skia
```

This prepares generated native sources and builds the native/RN/Web TypeScript packages. Native binaries require a separate target build. Use `npm run build:sdk` for the full SDK package set.

Preparation requires Python 3 and may download pinned SDK headers on first use.

## Web runtime

Web uses the source-built Nelyx CanvasKit runtime. Follow the [vendor build recipe](eng/source-build/README.md#vendor-build-recipes), supply its output, and verify it before preparing a Web application:

```powershell
node Nelyx/skia/eng/prepare-web-runtime.mjs --check
```

The package manifest identifies the required files; missing or mismatched runtime bytes must be prepared explicitly.

## Windows native inputs

Use Python, the Windows C++ toolchain, and the inputs in [windows-rn-supplier.lock.json](vendor/windows-rn-supplier.lock.json). The binding requires RNW 0.83.2 / JSI21, x64 Release, and the MD runtime. Reusable binaries are supplied under `vendor/inputs/windows-x64/`.

Install the Windows runner as described in the [sample guide](../../sample/nelyx-testbed-app-2/README.md#prepare-windows), then run from the repository root:

```powershell
node Nelyx/skia/eng/prepare-native.mjs
python Nelyx/skia/eng/build-windows-rn.py --runner sample/nelyx-testbed-app-2/windows/runner --supplier Nelyx/skia/vendor/inputs/windows-x64 --output .nelyx/windows-rnw-native
```

Keep one current owned output; append `--resume` when updating that build. The result includes `<output>/supplier/inputs.json`. Pass it to the installed runner CLI:

```text
nelyx prepare --app <app> --target windows --native-inputs <inputs.json>
```

After canonical C++/JSI sources change, rerun source preparation, rebuild the supplier, and prepare the app with its new manifest. The default uses stock RNW Core.

On Windows, Graphite's cache budget follows the physical backing size at 48 bytes per pixel, clamped to 96–192 MiB. This leaves room for offscreen/layer resources alongside MSAA attachments so large scratch surfaces can be reused during scrolling. The allocator's separate 256 MiB limit and cleanup on backing-size changes still apply. The native `gallery-scroll` diagnostic can check warmed scratch reuse with `NELYX_ANIMATION_NATIVE_TRACE=1` and `NELYX_ANIMATION_NATIVE_CORE_TRACE=1`; it does not establish physical trackpad or display performance.

## Linux native inputs

Use the SDK in [linux-graphite-probe.lock.json](vendor/linux-graphite-probe.lock.json) and matching RNL/RN 0.81.6 sources. Prepare modules with [prepare-rn-modules.py](eng/source-build/prepare-rn-modules.py), then create a relocatable supplier:

```text
python Nelyx/skia/eng/prepare-linux-inputs.py --cache <SDK-cache> --modules <prepared-modules> --output <new-supplier>
```

Recipes live in [native/vulkan/CMakeLists.txt](packages/rn/native/vulkan/CMakeLists.txt) and [native/linux/CMakeLists.txt](packages/rn/native/linux/CMakeLists.txt). See [Linux CLI supply](../sdk/tooling/cli/README.md#linux-supply) for RNL archives. Names containing `probe` identify pinned input profiles.

## Compatibility and resources

Install matching Core, SDK, and renderer packages together. Native source changes require rebuilt suppliers; runtime handshakes reject incompatible bindings.

Runtime shaders use captured SkSL and per-frame uniform values. Compiled programs belong to the renderer's cache owner and retire through its shutdown/context lifecycle. Frames, recordings, and GPU submissions retain their own resource leases.

Platform readiness and graphics-recovery limits are described in the [project guide](../../README.md#project-status).

## License and provenance

Source pins and notices are recorded in [upstream.json](upstream.json), [upstream/](upstream/), and [vendor/](vendor/). Nelyx-authored code uses [BSD-3-Clause](LICENSE.md); imported code retains [third-party notices](THIRD_PARTY_NOTICES.md) and [licenses](licenses/), including React Native Skia's MIT license.
