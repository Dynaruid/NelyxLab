# Nelyx Skia

**English** | [한국어](README.ko.md)

Nelyx's renderer implementation and pinned native supply. The [SDK](../sdk/README.md) owns application hosts; Skia owns GPU devices, recording, text, and renderer surfaces.

## Renderer layout

| Path | Purpose |
| --- | --- |
| [`native/`](native/) | Common renderer, GPU, and text implementation |
| [`packages/rn/`](packages/rn/README.md) | React Native JSI, components, surfaces, and Graphite adapters |
| [`packages/web/`](packages/web/README.md) | CanvasKit/Ganesh WebGL2 renderer and text |
| [`vendor/`](vendor/) | Exact native input locks and explicitly supplied binaries |
| [`eng/source-build/`](eng/source-build/README.md) | Pinned source preparation and build recipes |

Android/Apple use the pinned m154/154.1.0 supply. Windows/Linux use the matching m153 native Vulkan SDK and module supplement. These are target-specific inputs; do not substitute another version or reuse binaries with a different ABI/source inventory.

## Package build

From the repository root after `npm ci`:

```powershell
npm run build:skia
```

This prepares generated native source and builds the RN/Web TypeScript packages. It does not build every target's native binaries. Use `npm run build:sdk` for the complete SDK package set.

Source preparation requires Python 3 and may download pinned SDK headers on the first run.

## Windows native inputs

Prepare Python, the Windows C++ toolchain, and inputs matching [`windows-rn-supplier.lock.json`](vendor/windows-rn-supplier.lock.json). The binding requires RNW 0.83.2 / JSI21, x64 Release, and the MD runtime. Required reusable binaries are supplied under `vendor/inputs/windows-x64/`.

From the repository root:

```powershell
python Nelyx/skia/eng/prepare-artifacts.py --profile windows-x64-graphite-text-probe
python Nelyx/skia/eng/build-windows-rn.py --runner sample/nelyx-testbed-app-2/windows/runner --supplier Nelyx/skia/vendor/inputs/windows-x64 --output Nelyx/.cache/native/windows/new-build
```

Install the Windows runner first as described in the [sample guide](../../sample/nelyx-testbed-app-2/README.md#windows). Use a fresh output directory. The native build creates `<output>/supplier/inputs.json`; pass it to the runner's installed CLI:

```text
nelyx prepare --app <app> --target windows --native-inputs <inputs.json>
```

The stock RNW Core is the default. Preserved private unload patches are not automatically adopted; see [project status](../../README.md#project-status).

## Linux native inputs

Use the exact x86_64 SDK in [`linux-graphite-probe.lock.json`](vendor/linux-graphite-probe.lock.json), plus matching installed RNL/RN 0.81.6 sources. Prepare the module inputs with [`prepare-rn-modules.py`](eng/source-build/prepare-rn-modules.py), then create a relocatable supplier:

```text
python Nelyx/skia/eng/prepare-linux-inputs.py --cache <SDK-cache> --modules <prepared-modules> --output <new-supplier>
```

Compile recipes live in [`native/vulkan/CMakeLists.txt`](packages/rn/native/vulkan/CMakeLists.txt) and [`native/linux/CMakeLists.txt`](packages/rn/native/linux/CMakeLists.txt). RNL archive preparation is covered by the [CLI guide](../sdk/tooling/cli/README.md#linux-supply).

Existing `*-probe` names identify pinned SDK profiles; there is no separate probe target. Linux GPU execution remains unverified.

## Validation and provenance

Source builds, binary/source correspondence, and platform qualification are separate checks. Apple native build/runtime/Metal/signing and full platform qualification remain unverified.

Upstream provenance is recorded in [`upstream.json`](upstream.json), [`upstream/`](upstream/), and [`vendor/`](vendor/). Nelyx-authored code uses [BSD-3-Clause](LICENSE.md); imported code retains [its notices](THIRD_PARTY_NOTICES.md) and [licenses](licenses/), including the RN Skia MIT license.

Runtime shaders use frame wire 11. Core captures bounded SkSL and float uniform values; the common native decoder checks counts, ASCII packing, shader compilation, float-only uniforms and unsupported child effects before any canvas mutation. Web and RN paint adapters compile the same SkSL and retire temporary effects/shaders through their existing owners. Matching native suppliers must be rebuilt; old binaries are rejected by the RN wire handshake. The source manifest derives its wire version from matching Core/native definitions. Compiled programs are cached per owner with a 16-program and 128 KiB ASCII-source budget. Uniform values stay per frame. Web context loss clears the cache; the RN SDK shares it across renderer/text/picture/rasterization paths and retires it after application drain. Native C ABI renderers own an equivalent cache. Existing native shaders and pictures retain independent program references through eviction. Unconfirmed wrapper deletion is retained and never retried. These bounds do not measure driver allocations or display FPS.
