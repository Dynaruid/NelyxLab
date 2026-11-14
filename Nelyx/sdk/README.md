# Nelyx SDK

**English** | [한국어](README.ko.md)

Consumer projects require **TypeScript >=7.0.0**; generated runners pin **7.0.2**. Runner checks resolve the installed compiler through its public package metadata and verify its executable version. Generated configuration uses relative paths and an explicit app root without the removed `baseUrl` option.

`@nelyx/sdk` connects the [Core framework](../README.md) to platform applications, rendering surfaces, input, assets, OS services, and host lifetime. Shared application code stays in `src/`; each platform runner supplies registration and build configuration.

Start with the [Testbed guide](../../sample/nelyx-testbed-app-2/README.md) for a complete application or the [CLI](tooling/cli/README.md) to create a new one.

## Source application entry

SDK 0.21.0 defines applications with defineApp({ id, createRoot, defaultFont, assets, startup }) from @nelyx/sdk/app. createRoot is synchronous and receives the actual View services and Source scheduler. A runner loads main().definition and bootstrapApplication creates the existing FrameworkRoot. Asset loading and optional asynchronous startup finish before the first Source frame.

The former build/ready/dispose native scene launcher, native widget adapters and engine-v2 application exports have been removed. Update application code to createRoot and the existing ApplicationDefinition startup/owned disposal contract. Use declared font assets and the selected backend's font service. Keep app-owned cleanup in the disposable returned by startup. There are no deprecated aliases, second Widget models or automatic fallback renderers.

The CLI and generated templates use the same Source definition. Windows native/Hermes, RN platform surfaces and the Web CanvasKit surface reuse their existing drawing/resource/OS backends; none installs a per-widget native policy adapter. Backend capability errors remain explicit. [Current acceptance](../../work12.md#11-현재-구현과-확인-범위) records the original comparisons and outstanding platform/IME/reader/performance work.

## Application APIs

Import exact subpaths from `@nelyx/sdk`. Supported target names are `windows`, `android`, `ios`, `macos`, `linux`, and `web`.

| Module                               | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| `platforms/<target>/application`     | Compose the shared application with a backend      |
| `platforms/<target>/surface`         | Present the application surface                    |
| `platforms/<native-target>/controls` | Native control integration                         |
| `runtime/config`                     | Read and validate application configuration        |
| `runtime/assets`                     | Load and validate configured assets                |
| `runtime/providers`                  | Resolve provider profiles and runtime requirements |
| `runtime/plugin-port`                | Connect application-owned platform plugins         |
| `runtime/worker-messages`            | Connect an explicit background message endpoint    |

Public exports are listed in [package.json](package.json). The [Web surface component](../../sample/nelyx-testbed-app-2/web/runner/App.tsx) shows how the runner connects `main().definition` to `ApplicationSurface`.

Windows `ApplicationSurface` defaults to `windowsSurfaceStatusMode="lifecycle"`: it receives the first valid update of each backing and lifecycle transitions. It requires surface-status protocol 1, so resupply and rebuild the native host together with the SDK. Public `SkiaGraphiteView` keeps continuous callbacks by default. `ApplicationSurface` also accepts `windowsSurfaceStatusMode="continuous"` for delivery comparisons; surface callbacks acknowledge native updates, not display scanout.

RN `ApplicationSurface` offers experimental `nativeInputGeometry="retained"` for C++ editor-coordinate preparation. Omit it or pass `false` for the default TS path; `'snapshot'` selects the older independent candidate. Choose once per mounted owner and remount to switch. Custom render hooks retain TS behavior. This option does not enable a native hit-test index. Supply matching rebuilt native inputs, renderer and SDK; current runtime validation is limited to Windows. Performance adoption is recorded in the repository's [work5.md](../../history/26/11/03/work5-summary.md).

Explicit C++ service requests fail startup when their native capability is missing. Windows launches report selected candidates, native geometry commits and TS fallback reasons separately. Standalone cadence and regression tools have been removed; selecting an option or finding its API does not establish execution or performance acceptance.

## Configuration and providers

Declare application settings in the root `package.json` under `nelyx`. For example:

```json
{
  "nelyx": {
    "schema": "nelyx.app/v2",
    "name": "MyApp",
    "displayName": "My application",
    "appEntry": "./src/index.ts",
    "assets": [
      {
        "id": "app-font",
        "kind": "font",
        "path": "./assets/AppFont.ttf",
        "fontFamily": "AppFont",
        "notice": {"path": "./assets/AppFont-LICENSE.txt"}
      }
    ],
    "targets": {
      "web": {
        "profile": "ganesh-webgl2",
        "component": "./web/runner/App.tsx"
      }
    }
  }
}
```

Use real font and notice files, and keep the npm package name separate from `nelyx.name`, the native registration name. `displayName` is the user-facing label. The [sample configuration](../../sample/nelyx-testbed-app-2/package.json) includes Windows and Android profiles.

The runner generates `app-config.json` from this configuration. Edit the root package and rerun preparation to update it. Each runner's `main.ts(x)` imports the platform component and calls `registerApplication`.

[Provider manifests](providers/) describe each target's profile, capabilities, and runtime cohort. Keep Core, SDK, renderer packages, native binaries, and engine inputs compatible. Provider qualification is recorded separately from available capabilities.

## Assets

V2 SDK apps declare assets in `nelyx.v2.json`. Both App models expose the same packaged bytes through `context.asset(name)` and canonical `rootBundle`/`PlatformAssetBundle`; Original `DefaultAssetBundle.of(context)` uses the App root independently of ImageService and preserves inherited overrides. The CLI generates the canonical binary manifest and its Web JSON/base64 representation, including Nx variants. UTF-8 names and spaces are supported. Structured cache misses bypass the string cache, and failed parsing can retry from fresh bytes.

Importing the canonical buffer API declares its synchronous-copy requirement; the SDK prepares shared App services before build when that requirement is present. Asset reads share those services; Web uses their 128 MiB CanvasKit heap and 320 MiB host reservation. Native obtains file size before allocation. Web uses HEAD metadata or the generated asset index, streams into the admitted size and verifies SHA-256. Ordinary HTTP hosting can omit HEAD and the supplier hash header. The bounded index has its own credit, which is returned at logical close. Failed or cancelled reads return undelivered credit. At most 32 IO requests, 64 admitted buffers and 32 MiB of cumulative admitted data fit within the unchanged App quota; each read reserves `3 * size + 65536` bytes for IO/copies and cached UTF-16 text. Delivered ByteData can escape into caller JS, so its credit stays until the App realm terminates. Clear/evict drops Source cache entries; it cannot reclaim caller bytes. Arbitrary parser results remain caller-managed. Close cancels owned IO and rejects new reads before draining; logical close preserves delivered-byte credit until Native runtime/Web worker teardown. These bounded paths do not complete every AssetBundle API.

Canonical `AssetBundle.loadBuffer()` and `ImmutableBuffer` (also exported from `@nelyx/core/ui/immutable-buffer`) create engine-owned read-only bytes. `fromUint8List()` copies the selected view before returning its Promise; later caller mutation cannot change it. `fromAsset()` uses the packaged App owner, and Native `fromFilePath()` reads a local UTF-8 path. Web file loading fails explicitly. Native stores SkData; Web stores a CanvasKit allocation and the SDK copies upload/readback bytes. Dispose every public buffer. An internal engine holder or in-flight read keeps its allocation and credit until the last holder retires. Close refuses live buffers/readers and failed releases. Each allocation reserves `2 * size + 65536` bytes before copying, with 64 live handles/allocations, 32 MiB of live data and 32 pending IO requests per owner. Buffer-only asset staging returns after capture; escaped mutable ByteData retains its separate realm credit. `debugDisposed` and duplicate/reentrant-dispose guards are available in every build. The added required `loadBuffer` method extends the original structural class signatures; their compatibility review remains open.

```ts
import { rootBundle } from '@nelyx/core/services/asset-bundle';

export async function assetByteLength(key: string): Promise<number> {
  const buffer = await rootBundle.loadBuffer(key);
  try {
    return buffer.length;
  } finally {
    buffer.dispose();
  }
}
```

`NetworkAssetBundle` takes a base URL string and resolves relative keys, queries, fragments and absolute HTTP(S) keys. Each load fetches again; only the platform HTTP stack can cache. Only HTTP 200 succeeds. Windows uses asynchronous WinHTTP with gzip/deflate, the OS proxy/TLS policy, five redirects and 30-second IO timeouts. Web uses fetch streaming and the browser CORS, TLS and redirect policies. The shared App owner cancels both startup and runtime IO.

Standalone Android uses Android HttpURLConnection on a separate native IO worker. Its corpus covers UTF-8 and spaces in URLs, queries/fragments, five redirects and cross-origin credential removal. Connect/read timeouts are 3/2 seconds. Closing sets a cancellation flag and retains credit until bounded IO finishes and the actual connection/stream and callback owner retire. UI never joins the network worker. Local emulator HTTP is enabled only in the development profile.

Before starting HTTP, each request admits 512 KiB for owned metadata and callback/transport copies. The shared IO limit is 32. Declared lengths admit storage before reading; unknown or compressed streams grow their `3 * capacity + 65536` byte credit before allocating, and trim to the exact delivered length. The 32 MiB cumulative data limit and App quota still apply. Raw caller bytes keep realm credit; `loadBuffer` returns internal staging after immutable capture. Native retains request credit through its last close callback and borrowed JSI copy. Browser/OS network buffering is outside measured owned memory. Both Data and Original App declarations support Native ES2022 without DOM ambient types; browser surface arguments keep their exact Web types.

```ts
import { NetworkAssetBundle } from '@nelyx/core/services/asset-bundle';

export async function remoteAssetByteLength(baseUrl: string, key: string): Promise<number> {
  const buffer = await new NetworkAssetBundle(baseUrl).loadBuffer(key);
  try {
    return buffer.length;
  } finally {
    buffer.dispose();
  }
}
```

App-ready timing includes service preparation in `buildElapsedMs` and reports `servicesPreparationElapsedMs` separately.

Web App bootstrap contract 1 also cancels the quota wait, service-module request and CanvasKit/font downloads when the App closes or startup fails. A failed provider download aborts its siblings and waits for them before releasing staging credit. WebAssembly initialization cannot be aborted; disposal waits for its result and prevents a late backend from reaching Source build or asset readers. Its committed heap and the fixed 320 MiB host reservation survive logical disposal until actual worker termination. Missing bootstrap capability fails before provider initialization.

- Declare fonts and images in `nelyx.assets`, with stable IDs referenced by the application.
- Include the license file through `notice.path`; packaging carries declared notices with the assets.
- Optional `sha256` values pin bytes explicitly. Otherwise tooling calculates hashes in generated runner metadata.
- `packageSource` copies exported package assets and notices into the application. Existing edited files are preserved and reported as conflicts.
- Add literal asset `require` entries where the runner's Metro asset map requires them.

Font changes require refreshing package supply and rebuilding the native application. The [Metro guide](tooling/metro/README.md) explains asset preparation.

## Platform services

The application receives its platform services through SDK startup/View contexts. Services include clipboard operations, environment and locale observation, platform messaging, and editing/semantics integration. Unsupported or denied OS operations report typed platform errors.

Platform message endpoints belong to the application. A background connection uses an endpoint supplied by the host; creating a Worker or native worker runtime is the host's responsibility. Await connection disposal before terminating its worker.

## Image descriptors and codecs

Both v2 App models bind canonical `ui/image-descriptor` and `ui/image-decoder` before user build. Importing ImageDescriptor requires App image service 2; missing service fails before build. `ImageDescriptor.encoded(buffer)` inspects the actual Skia decoder, while synchronous `raw(buffer, {width, height, rowBytes, pixelFormat})` accepts premultiplied rgba8888/bgra8888 and row padding. A descriptor retains immutable backing independently of the public buffer; codecs retain their descriptor, and returned canonical Images own independent frames through ImageService/ResourceRegistry. Dispose each owned handle. The convenience instantiateImageCodecFromBuffer/WithSize functions take buffer ownership, including failure; instantiateImageCodec(bytes) captures caller bytes before yielding.

```ts
import {instantiateImageCodec} from '@nelyx/core/ui/image-decoder';

export async function firstImagePixels(encoded: Uint8Array): Promise<Uint8Array | null> {
  const codec = await instantiateImageCodec(encoded);
  try {
    const {image} = await codec.getNextFrame();
    try { return await image.toByteData(); }
    finally { image.dispose(); }
  } finally { codec.dispose(); }
}
```

Current decoder controls cover actual Native SkCodec and the existing owned CanvasKit heap: PNG, two-frame GIF order/duration/repetition, RGBA/BGRA, resize, clone/read and cancellation/retirement. The 16 MiB encoded, 8192 dimension, 16 Mi-pixel, 32 descriptor/codec, 64 frame and 64 MiB resident limits admit working memory before pixel allocation. Native descriptors share SkData; Web copies encoded/raw transport within admitted credit. Returned premultiplied rawRgba/rawUnmodified ByteData has separate credit (64 results, 32 MiB total), retained until App realm termination. Image disposal retires its native pixels after the last holder/read.

This v2 path currently rejects floating-point raw/target formats and PNG/straight-alpha readback. Canvas drawing integration and remaining image formats/recovery acceptance are unfinished. Decoder checks do not establish displayed image frames or performance acceptance.

The v2 `ImageResource` path streams large encoded images in 256 KiB chunks within the unchanged 1 MiB packet and 32 MiB resource budgets. `EngineViewClient` exposes `beginImageUpload`, `appendImageUpload`, `finishImageUpload`, `readImageResource` and `releaseImageResource`. A candidate becomes a resource only after complete upload; tokens make identical retries idempotent and reject changed bytes. SceneWriter snapshots large payloads before yielding and retains uncertain uploads until replay resolves the terminal. Content reads are scoped to the preparation or held frame, so producer release and slot reuse cannot replace older image bytes. Native Content records decoded pixels; Web Content loads bounded chunks and passes Pictures to Render. Canonical RawImage uses the separate Scene snapshot contract below. CPU and Web pixel checks do not establish physical display or performance acceptance.

The default Original App bridge now paints canonical `RawImage`/`RenderImage` frames through immutable RGBA Scene resources. App image service 2 is required before the user build. Images and clones from one App share a single admitted snapshot; disposing the caller Image or codec cannot invalidate retained Scene/Picture pixels. Snapshot credit is independent of delivered `toByteData` credit and remains held through accepted older trees, uncertain uploads and final retirement. Core resolves image size/scale, all BoxFit modes, alignment, repeat tiles, RTL flip and nine-patch placement, including paint overflow bounds. Native Skia and CanvasKit consume that placement with opacity, tint/blend, inversion and filter quality; detached Source render objects observe opacity changes through their View scheduler. Canvas integration and the remaining formats/recovery work are unfinished. Native CPU and Web pixels do not establish physical display or performance acceptance.

The default Original App connects the canonical Image widget and MemoryImage, AssetImage, ResizeImage and NetworkImage to the shared ImageService/ImageCache and the same admitted immutable-buffer decoder. Native FileImage uses absolute file:/// URIs; Web local-file IO remains unsupported. Image frames and timers use the View's actual Core timestamps and absolute deadlines, with bounded callbacks and cancellation at eviction/close. TickerMode pauses animated streams without advancing pixels. NetworkImage forwards bounded caller headers, reports received-byte progress and cancels pending reads; the default Original App requires HTTP header service 2 before user build. Native preserves an exact URL with an empty asset key and removes caller Authorization/Cookie headers on a cross-origin redirect. Public asset/file/network ByteData credit survives until realm termination, independently of decoder and Scene credit. Native decoder/IO controls and normal Web pixel checks cover cache reuse, resize, GIF frames and retirement; visibility/recovery, Canvas integration and physical/performance acceptance remain separate.

## Ownership and lifecycle

| Owner           | Responsibility                                                  |
| --------------- | --------------------------------------------------------------- |
| Core            | Widgets, state, layout, hit testing, and logical semantics      |
| SDK TypeScript  | Backend composition, input, assets, services, and View lifetime |
| SDK native host | VM/bootstrap, windows, event loop, and application close        |
| Skia packages   | Rendering, paragraphs, images, GPU submission, and retirement   |
| Platform runner | Dependencies, registration, Metro/Babel, and native build files |

Release application-owned services and await asynchronous disposal. Closing a View stops new input and frame admission before native/GPU drain. Failed drain retains unconfirmed dependencies; preserve the reported failure when handling shutdown.

Native host sources live in [native/](native/), and runtime pins/overlays in [../upstream/](../upstream/). The [project guide](../../README.md#project-status) describes platform limitations.

## Build and check

From the repository root, after `npm ci`:

```powershell
npm run build:sdk
npm run check --workspace @nelyx/sdk
```

The SDK build also builds Core, design and renderer packages, then prepares provider and CLI inputs. Use the [CLI guide](tooling/cli/README.md) for target builds and the [Metro guide](tooling/metro/README.md) for runner configuration.

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported notices remain in [licenses/](licenses/).
