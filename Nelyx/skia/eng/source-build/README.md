# CanvasKit source build

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
The `.8` build queues both shader stages for new WebGL drawing programs and
checks their link result before resolving uniforms or using the program.

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
`m153-nelyx-paragraph.8` identity, distinct from npm CanvasKit 0.41.0. A successful
build is not runtime acceptance. Prepare the package
with `node Nelyx/skia/eng/prepare-web-runtime.mjs <owned-runtime-directory>` from
the repository root. `--adopt` explicitly updates the tracked manifest when
selecting a new built candidate. `--check` verifies an already prepared package.
After adoption, the package carries the new bytes under `generated/runtime`.
If a source update marks the manifest `requires-build`, build and adopt the
matching runtime before preparing a Web application. The npm dependency supplies
public type declarations. Full dependency notice qualification remains PARTIAL.

Run `node Nelyx/skia/eng/source-build/check-webgl-shader-validation.mjs` after
adopting the runtime. Chromium checks both a successful draw and a deliberately
invalid shader, including the order of compile and link calls.
