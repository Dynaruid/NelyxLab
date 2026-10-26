# Native source builds

Pinned source preparation and vendor build recipes for the [Skia renderer](../../README.md). Run these tools explicitly while preparing native supply; application execution does not start a vendor download or source build.

## Matching module inputs

`prepare-rn-modules.py` extracts the exact locked Skia/libwebp source inputs for SVG, Skottie, SG, resources, JSON, and WebP, including their licenses. It does not rebuild or replace the pinned Skia core binary.

From the repository root, with matching archives already available:

```text
python Nelyx/skia/eng/source-build/prepare-rn-modules.py --archive <Skia-source-archive> --webp-archive <libwebp-source-archive> --lock <native-SDK-lock.json> --output <new-module-directory>
```

Use the target's m153 native SDK lock from `Nelyx/skia/vendor/`. `rn-modules.cmake` compiles the prepared modules into the native target. Source archives and the core binary must belong to the same pinned revision family.

## Vendor build recipes

Build the Nelyx paragraph binding with inputs matching the current source lock
and patch. Keep a single owned source/build directory for the selected runtime.

`build-canvaskit.py` prepares and builds the owned Web paragraph binding from
[`canvaskit.lock.json`](canvaskit.lock.json). It verifies the m153 source archive,
the dependency revisions and the exact before/after patch hashes. Emscripten 4.0.7
is installed inside that build root; shell profiles and global activation are not
changed. The patch exposes unscaled ascent, UTF-16 line lookup and the soft-hyphen
switch. It also restores the supplier's omitted CanvasKit build target and uses
Skia's bundled raw-pointer fallback because this standalone DEPS has no
partition_alloc input. Rendering, font and codec features stay enabled.

Use a persistent Linux/WSL directory; `/tmp` can disappear when WSL stops. From
the repository root in Linux/WSL, run each phase with the 20-minute limit:

```text
timeout --kill-after=10s 1190s python3 Nelyx/skia/eng/source-build/build-canvaskit.py prepare --root <owned-persistent-directory> --archive <locked-m153-source-archive>
timeout --kill-after=10s 1190s python3 Nelyx/skia/eng/source-build/build-canvaskit.py build --root <same-directory> --jobs 4
```

The result is `out/nelyx-canvaskit`. Its manifest uses the owned
`m153-nelyx-paragraph.1` identity, distinct from npm CanvasKit 0.41.0. A successful
build is not runtime acceptance. Select that directory explicitly with
`NELYX_WEB_RUNTIME_ROOT` for Web builds and the paragraph/browser checks, and
preserve their manifest hashes when supplying a candidate. Prepare the package
with `node Nelyx/skia/eng/prepare-web-runtime.mjs <owned-runtime-directory>` from
the repository root. `--adopt` explicitly updates the tracked manifest when
selecting a new built candidate. `--check` verifies an already prepared package.
After adoption, the package carries the new bytes under `generated/runtime`.
If a source update marks the manifest `requires-build`, build and adopt the
matching runtime before preparing a Web application. The npm dependency supplies
public type declarations. Full dependency notice qualification remains PARTIAL.

| File | Purpose |
| --- | --- |
| [`source-lock.json`](source-lock.json) | Vendor source pins |
| [`libwebp.lock.json`](libwebp.lock.json) | Matching libwebp source pin |
| [`prepare-vendor.py`](prepare-vendor.py) | Explicit vendor source preparation |
| [`build-windows-dawn.ps1`](build-windows-dawn.ps1) | Windows Dawn build |
| [`windows-dawn.args.gn`](windows-dawn.args.gn) | Dawn GN build settings |
| [`rn-modules.cmake`](rn-modules.cmake) | Matching module compilation |

Use the [Windows](../../README.md#windows-native-inputs) or [Linux](../../README.md#linux-native-inputs) supply instructions to assemble consumer inputs. Build success, binary/source correspondence, runtime execution, and physical-platform qualification are separate checks.
