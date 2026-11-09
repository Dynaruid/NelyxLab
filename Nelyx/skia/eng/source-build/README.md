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
switch. The locked `canvaskit-picture.cpp` binding serializes Pictures with bounded font references and actual variation coordinates. Picture API3 matches the exact font stream and collection index against supplied base faces, rather than an intrinsic family name. The C++ paint stream embeds each source identity; the receiving owner verifies it before restoring the Picture. A provider-owned cache reuses exact base-face identities and sorted variation coordinates across imports, holds at most 16 variants, and clears them on memory pressure and close. Its font API1 builds immutable TypefaceFontProvider collections from existing decoded faces, so fallback replacement shares the bundled faces. It also restores the supplier's omitted CanvasKit build target and uses
Skia's bundled raw-pointer fallback because this standalone DEPS has no
partition_alloc input. Rendering, font and codec features stay enabled.
The supplier keeps its 128 MiB initial linear heap and has an explicit 256 MiB
maximum per instance. Separate App, Content and Render owners retain separate heaps.
The `.7` runtime exports each instance's `wasmMemory`; the v2 owner reserves the
actual page growth before calling `Memory.grow` and restores credit on native
growth failure. Paragraph builders share one `FontCollection` per immutable font
catalog, released on catalog retirement, memory pressure, and provider close.

Use a persistent Linux/WSL directory; `/tmp` can disappear when WSL stops. From
the repository root in Linux/WSL, run each phase with the 20-minute limit:

```text
timeout --kill-after=10s 1190s python3 Nelyx/skia/eng/source-build/build-canvaskit.py prepare --root <owned-persistent-directory> --archive <locked-m153-source-archive>
timeout --kill-after=10s 1190s python3 Nelyx/skia/eng/source-build/build-canvaskit.py build --root <same-directory> --jobs 4
```

An existing verified owned source root can run `prepare` without `--archive`.
Only exact locked before/after files are accepted; current files are retained and
new hunks apply only to their verified before contents. Use `--dependency-inputs`
only for matching pinned Git inputs, which remain identity-checked.

The result is `out/nelyx-canvaskit`. Its manifest uses the owned
`m153-nelyx-paragraph.7` identity, distinct from npm CanvasKit 0.41.0. A successful
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
