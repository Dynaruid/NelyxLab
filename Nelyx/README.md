# Nelyx Core

**English** | [한국어](README.ko.md)

Consumer projects require **TypeScript >=7.0.0**; generated runners pin **7.0.2**. Runner checks resolve the installed compiler through its public package metadata and verify its executable version. Generated configuration uses relative paths and an explicit app root without the removed `baseUrl` option.

Workspace `tsc` uses native TypeScript 7.0.2 through the `@typescript/native` alias. Shader/declaration AST transforms and original API inventory retain Microsoft's TypeScript 6 compatibility API. Package builds require the native 7.x project check before compatibility-API emit. See [Microsoft's API transition guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

`@nelyx/core` is Nelyx's platform-independent TypeScript UI framework. It owns the Widget/Element/RenderObject trees, state, layout, painting, gestures, and application contracts. The [SDK](sdk/README.md) supplies platform integration, and [Skia](skia/README.md) supplies rendering.

For installation and the sample, start with the [project guide](../README.md).

## Experimental v2 engine protocol

`@nelyx/core/v2` exports the C++ engine's packet codec, commands, `EngineClient`, and `createWasmTransport`. The canonical protocol is [engine/schema/protocol.json](engine/schema/protocol.json); run `node Nelyx/engine/tools/generate-schema.mjs --check` from the repository root to check generated C++/TS agreement. `npm.cmd run build:core` builds this subpath together with the existing Core exports.

Run `npm.cmd run build:engine-v2` from the repository root. It supplies the HWND/Hermes/Skia host, two engine Wasm profiles, provider workers, bundled fonts and owned CanvasKit **m153-nelyx-paragraph.5** assets (the npm 0.41.0 package supplies declarations) in the current `Nelyx/engine/dist`. Wasm requires [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) **4.0.22**, resolved through `EMSDK` or the user cache's `.cache/tooling/emsdk`; Windows uses the pinned local Skia/Hermes suppliers and rejects missing or mismatched inputs. Engine builds do not build App packages or bundle Testbed UI. The run commands below prepare Core/Material/Cupertino/SDK and build the existing Testbed candidate separately in `sample/nelyx-testbed-app-2/engine-v2/dist/v2-<target>`. App changes invalidate the App bundle; native/provider/protocol changes invalidate the engine supply. Staging and previous output are removed after promotion.

- Windows: `npm.cmd run run:engine-v2:windows`. Scroll with the wheel or left pointer drag; `Ctrl+U` updates the App declaration. Close the window to drain and join its owners.
- Web: `npm.cmd run run:engine-v2:web`, then open `http://127.0.0.1:8192/isolated/` for automatic threaded selection or `/plain/` for non-isolated single-worker selection. `?profile=threaded` requires isolation; explicit requirements and asset/ABI errors fail without switching to a TS renderer. Use the CLI's `pack --engine v2 --target web` output for static deployment and provide consistent COOP/COEP headers on an isolated route's workers and assets.
- Development checks: use `npm.cmd run check:types`, `npm.cmd run lint`, `npm.cmd run format:check` and the product build/run commands above. Standalone regression tests and API audit tools were removed at the user's request on 2026-11-07.

Windows and threaded Web connect distinct Content/Render owners; single-worker is cooperative and reports `contentIndependent=false`. The Testbed declares v2 Widgets/State/Keys and uses C++ layout, intrinsic/dry queries, editing documents and semantics, including Arabic/Hebrew fallback and color emoji. Full Widget/Material/Cupertino APIs, gestures and Android remain **PARTIAL**. Physical IME/reader, trackpad and FPS acceptance are separate. See the [work8 implementation record](../history/26/11/04/work8-2-summary.md#이번-작업의-구현검증-현황) and [active work9 plan](../work9.md).

The client keeps accepted document epochs separate from scene activation. After an ACK timeout, use `queryCommitResult()` or `retryCommit()` with the retained bytes; a timeout does not undo an accepted change. Close returns `busy` while provider frames are held: the host must release those holds before completing close. `reservedBytes` measures internal reservations, not process RSS or the separate GPU/provider heaps.


Enable C++ layout with `commands.layout(node, options)`. It supports Box containers, Flex, Stack, Wrap, Grid and ScrollViewport primitives; children are laid out by C++. Options include `direction`, `mainSize`, `mainAlign`, `crossAlign`, `flex`/`fit`, `gap`/`runGap`, `columns`, and per-edge `padding`. Positive property widths/heights are preferred sizes within parent constraints; zero selects natural size. Use tight zero constraints for an explicitly empty box. Unbounded expand and unsupported alignment/layout combinations fail explicitly.

Text, Image and EditableText support padding through the same layout contract. Each node snapshot's `content` rectangle describes its paint area inside the border box; baseline and editing geometry include padding. Wrap/Grid stretch uses a separate child layout pass per run and supports horizontal baselines. Grid `mainAlign` distributes rows vertically and `mainSize: 'max'` fills finite height; `crossAlign` aligns children within each row. Box/Stack support start/center/end alignment, cross stretch/baseline and finite main-axis expansion. These are v2 primitive contracts, not complete Flutter API compatibility.

`view.dryLayout(node, horizontal, vertical)` and `view.intrinsic(node, 'minWidth'|'maxWidth'|'minHeight'|'maxHeight', oppositeExtent)` run asynchronously on Content and return their document/metrics/font identities. Dry queries use the real layout continuation without changing the active scene. A view admits one query and checks cancellation, timeout and metrics/font/device changes. Intrinsics for unsized viewports/slivers and expand queries are unsupported.

The same v2 subpath exports `WidgetHost`, `StatelessWidget`, `StatefulWidget`, `State`, `InheritedWidget`, `ValueKey`, `GlobalKey`, and `Box`, `Row`, `Column`, `Stack`, `Wrap`, `Grid`, `ScrollView`, `Text`, `Image`, `EditableText`, `Button`, `Semantics`. `mount`/`update`/`flush` diff against the last ACK, preserving keyed state through moves, NACKs and lost ACKs. Standard child layout stays in C++. Existing v1 Widget imports are not automatically routed here.

GlobalKey reparenting calls `deactivate`/`activate` and refreshes dependencies. `setState` is allowed in initialization/update lifecycle hooks before their build. Failed builds restore Element metadata and unsent allocations; arbitrary application side effects are not rolled back. Disposal remains terminal even when a hook throws. `WidgetHost.close()` cleans up every State and closes its native view, then reports the original error or an `AggregateError` containing multiple failures. A focused collapsed caret blinks on a C++ 500 ms deadline; composition holds it steady and selection/blur pauses it. Published frames expose `caretVisible`, and blinking does not rebuild Widgets or paragraphs.

`WidgetHost.execution` reports acknowledged native commands/transactions, App geometry declarations and rejected fallback attempts with reasons. `observed` stays false until an ACK; compare acknowledged commands with C++ `transactionWork` and the scene's actual layout/paint work. Unsupported Widgets fail with `fallbackPolicy: 'reject-unported'`; they do not invoke a TS renderer. Build manifests report the inspected import graph in `routing`. These observations replace the former constant `fallbacks=0` and are separate from performance or display acceptance.

The `fontResources` capability provides bounded font catalog upload/read (16 MiB catalogs, 256 KiB chunks), immutable paragraph bindings and a token-based preparation barrier. `beginFontTransition()` retains its candidate through producer release; each App/Content/Render owner acknowledges preparation, and `commitFontTransition()` requires all three plus the current input watermark. A known commit can be retried exactly. `abortFontTransition()` and owner decode failures preserve the active revision. `releaseFontResource()` is idempotent for a retired generation. Original apps can use the SDK-managed `fontCatalog` and `context.fonts` controls for coordinated loading, replacement, cancellation and recovery. Committed cohorts notify Original Source render objects through their View scheduler. The canonical Source FontLoader supports sequential family loading through the Original SDK. Public `loadFontFromList` from `@nelyx/core/ui/fonts` shares that App owner and infers an omitted family using the actual C++ decoder. Packaged rootBundle assets now use the SDK App owner and preallocation credit for both App models. `loadBuffer`/`ImmutableBuffer` add engine-owned immutable captures, Native local-file reads and last-holder retirement. Web byte upload/readback uses SDK copies into the owned CanvasKit heap. NetworkAssetBundle resolves HTTP(S) assets through the shared App owner with bounded streaming and cancellation; ImageDescriptor/Codec retain those buffers through actual Native/Web CPU decoding and canonical Image ownership; RawImage/RenderImage Scene drawing is supported; the default Original App also binds ImageProvider/ImageCache to the admitted decoder and Core clock; Canvas integration remains unfinished. Closing the Web App cancels provider startup and waits for any in-flight Wasm initialization before disposal. OS font notifications and the remaining asset APIs are unfinished; see the [SDK text contract](sdk/README.md).

The v2 `ImageResource` path streams large encoded images in 256 KiB chunks within the unchanged 1 MiB packet and 32 MiB resource budgets. `EngineViewClient` exposes `beginImageUpload`, `appendImageUpload`, `finishImageUpload`, `readImageResource` and `releaseImageResource`. A candidate becomes a resource only after complete upload; tokens make identical retries idempotent and reject changed bytes. WidgetHost snapshots large payloads before yielding and retains uncertain uploads until replay resolves the terminal. Content reads are scoped to the preparation or held frame, so producer release and slot reuse cannot replace older image bytes. Native Content records decoded pixels; Web Content loads bounded chunks and passes Pictures to Render. Canonical RawImage uses the separate Scene snapshot contract below. CPU and Web pixel checks do not establish physical display or performance acceptance.

The default Original App bridge now paints canonical `RawImage`/`RenderImage` frames through immutable RGBA Scene resources. App image service 2 is required before the user build. Images and clones from one App share a single admitted snapshot; disposing the caller Image or codec cannot invalidate retained Scene/Picture pixels. Snapshot credit is independent of delivered `toByteData` credit and remains held through accepted older trees, uncertain uploads and final retirement. Core resolves image size/scale, all BoxFit modes, alignment, repeat tiles, RTL flip and nine-patch placement, including paint overflow bounds. Native Skia and CanvasKit consume that placement with opacity, tint/blend, inversion and filter quality; detached Source render objects observe opacity changes through their View scheduler. Canvas integration and the remaining formats/recovery work are unfinished. Native CPU and Web pixels do not establish physical display or performance acceptance.

The default Original App connects the canonical Image widget and MemoryImage, AssetImage, ResizeImage and NetworkImage to the shared ImageService/ImageCache and the same admitted immutable-buffer decoder. Native FileImage uses absolute file:/// URIs; Web local-file IO remains unsupported. Image frames and timers use the View's actual Core timestamps and absolute deadlines, with bounded callbacks and cancellation at eviction/close. TickerMode pauses animated streams without advancing pixels. NetworkImage forwards bounded caller headers, reports received-byte progress and cancels pending reads; the default Original App requires HTTP header service 2 before user build. Native preserves an exact URL with an empty asset key and removes caller Authorization/Cookie headers on a cross-origin redirect. Public asset/file/network ByteData credit survives until realm termination, independently of decoder and Scene credit. Native decoder/IO controls and normal Web pixel checks cover cache reuse, resize, GIF frames and retirement; visibility/recovery, Canvas integration and physical/performance acceptance remain separate.

Attach an `EditingController('initial value')` to `EditableText`, call `refresh()` to obtain its revision, then use `edit({kind:'replace',revision,text,base,extent,policy})` for conditional writes. Core owns text/selection/composing and undo/redo. Use edit commands after attachment instead of changing the text seed on the same handle. App replacements can be rejected until the OS/browser acknowledges composition end. `semanticsSnapshot()` separates published world geometry from newer nonvisual editing values; `focus()`/`semanticAction()` validate publication, focus session and node generation. Windows connects TSF/UIA and Web selects `dom-textarea/aria`. Physical IME candidate geometry and the full keyboard/clipboard/reader matrix remain unverified.

`new ListView({generation: 1n, itemCount: 2000, estimatedExtent: 48, itemKey: i => i, itemBuilder: i => new Box([], {properties: {height: 48}})}, {properties: {width: 300, height: 400}})` builds a bounded vertical window. Change `generation` with the data/order; supply `findChildIndex` to retain a visible key through reordering. Native measured extents and activation-time anchor correction preserve input received during preparation. `cacheItems` is 8–128 (default 96), including focused and explicit keep-alive items. Async builders require `placeholder`, run at most four at once and receive `ListBuildSignal`; use its `nativeSignal` with Web fetch. Eviction, generation changes and disposal abort pending work; late results are ignored. Set `direction: 'horizontal'` for horizontal lists. After an activated layout has been observed, `key.currentState.scrollToIndex(index, alignment)` prepares a distant destination before changing its visual offset. The returned command receipt is pending; `onScrollTerminal` reports completion/cancel/timeout with its ID. User gestures cancel a pending seek; generation changes and a two-second preparation timeout also terminate it. Provider/GPU reservations are included in the session ledger; opaque instantaneous provider/driver peaks remain outside pre-allocation observation.

Use the explicit `@nelyx/material/v2` and `@nelyx/cupertino/v2` imports with these Core Widgets. Their supported constructors declare native buttons, selection controls, sliders/progress, editors and composed surfaces. The Testbed executes both packages and a 2,000-row list. `NavigatorController`/`Navigator` retain up to 32 routes and support modal barriers. These entry points have a smaller API than the v1 design packages; forms validation, complete theming/icons/transitions and complete constructor/behavior compatibility remain pending.

`new GestureDetector(child, protocol.gestures.tap | protocol.gestures.longPress, callback)` declares native recognition. Tap/double tap/long press, axis pan, two-contact pinch, hover and scrollbar drag use the C++ compositor. Control press/hover/value, slider stepping and keyboard activation do not wait for App callbacks. Pinch emits a result event; arbitrary content zoom transforms, the complete nested gesture arena and all physics remain pending.

`NodeOptions.onRawInput` receives bounded original samples and publication IDs. WidgetHost starts the subscription; `onRawGap(first, last)` reports overflow and ends it until an explicit `view.subscribeRaw()`. The observer holds 64 samples and polls at most 32 at a time; stalled observation never waits in the native scroll path. `appControlled(sample)` opts only that node into a per-sample asynchronous boolean decision: one outstanding sample per stream, a 100 ms deadline and explicit cancellation on overlap. Approval is applied once on Render's tick; late replies are stale. Other native streams remain independent.

Windows UI and Web Main stamp `InputPacket.publication` at collection, together with metrics and collection time. Admitted packets retain that Frame until consumed, so a newer publication cannot redirect them. An already retired publication is explicitly rejected before admission. Snapshot holds are bounded by the input limits and included in the Core byte ledger.

Explicit editor `commit`/`cancel` replacements wait for the host's actual composition-end acknowledgement. Native busy retries retain the same command ID/bytes; Web waits outside the serialized DOM input queue. A missing acknowledgement has a bounded failure result. Windows key movement/deletion uses the retained paragraph's grapheme, word and line geometry, with an explicit v2 query budget up to 65,536 UTF-16 units. Focus and newly prepared carets reveal through existing prepared ancestor scroll viewports on both axes; user scrolling clears that demand. Internal editor scrolling, automatic preparation of a distant focused lazy item, complete bidi affinity, EditContext character bounds and physical IME/clipboard/reader acceptance remain pending. Windows failed copy/cut/paste attempts preserve the document and release clipboard ownership.

`await view.layoutSnapshot()` returns the last activated layout. Node coordinates and baselines are local to their parent; `layoutDocument` and `layoutMetrics` identify those coordinates even while a newer document or host metrics are pending. `commands.text(node, value, size, color, {direction: 'rtl'})` selects RTL. The supplied Web fonts are verified against the manifest, and glyph runs retain their font identity across workers.

`commands.coverage(scrollNode, revision, {minimum, maximum})` declares prepared **visual offsets**, separately from logical scroll extent. `NeedChildren` requests are coalesced per coverage revision. Only a live engine-driven gesture can retain one deferred destination within one viewport; reversal/end/cancel/hide discard it. A phase-less wheel never accumulates deferred motion. Catch-up is limited to the lesser of 2,400 pixels/s and four viewports/s, with at most 1/60 second applied per tick. Programmatic destinations outside coverage terminate with `contentUnavailable`. `ListView` connects this coverage to a bounded App builder and native key anchor correction.

### Graphics, explicit App geometry and memory

`Transform(child, [a,b,c,d,tx,ty])`, `ClipRRect`, `ClipPath`, `PathShape(new VectorPath(segments, fillRule))` and `ImageFiltered(child, sigma)` declare affine transforms, rounded/path clips and subtree blur. `NodeOptions.graphics` also declares shadow and stroke. Paths accept move/line/quadratic/cubic/close, at most 1,024 commands; sigma is 0–64. An explicitly empty clip path clips everything. Drawing, input and accessibility consume the same published matrices. Curve hit testing uses bounded 0.25-unit flattening; raster antialiasing at the boundary is a separate tolerance.

`NativeSparkline(values, width, height, options)` is a statically compiled C++ extension: 2–256 normalized samples become an engine-owned path. Request `protocol.capabilities.nativeExtensions` in the App handshake. It requires finite declared geometry; changing its size requires a new extension declaration. `AppDrivenBoundary(width, height, children)` requires finite width and height on every descendant and disables native child layout there. App code supplies immutable positions outside the engine's layout/paint call stack.

The trusted host ledger admits owned Core/provider/transport/staging resources and GPU reservations against 768 MiB total and 128 MiB GPU ceilings. `state.memory` reports total/peak/rejected, committed engine/CanvasKit heaps and categories. Core allocations inside the engine heap are counted once. Windows also reports the Hermes App heap and external buffers at App packet/turn boundaries, using its `providerHeap` account. Native CPU and GPU figures include conservative reservations, not process RSS or measured driver VRAM. The owned CanvasKit supply keeps a 128 MiB initial and 256 MiB maximum linear heap per instance. Allocation/growth is observed at API boundaries; a committed-heap overage terminates the session. Original Apps reserve 320 MiB for their synchronous C++ paragraph query owner before loading it; that reservation stays held until the host terminates the App worker. Browser JavaScript heaps for App and host adapters and opaque provider/driver instantaneous peaks are not measured by this ledger. App packet ports cannot write host memory reports.

`Key`, `ValueKey`, `ObjectKey`, `UniqueKey` and the notifier family share their canonical foundation implementations across old value imports and `/v2`. Reconciliation preserves custom key equality and runtime type tokens; `ValueListenableBuilder` subscribes and disposes through the canonical listener contract. This does not port the old GlobalKey/RenderObject framework or its synchronous APIs.

The [SDK runner guide](sdk/README.md#general-v2-projects) covers project entries, assets and standalone packages. Legacy value APIs admitted by the runner retain their canonical source and constructors. The standalone API audit tool has been removed; full Widget/RenderObject/design/SDK compatibility remains incomplete. See the [active API compatibility plan](../work9-2.md#8-기존-공개-api-호환-작업) and [work8 record](../history/26/11/05/work8-2a-summary.md#현재-구현-현황).

Canonical Apps use `@nelyx/sdk/app` with the original Widget/Element/State classes. Box/Flex/Stack, alignment/padding, clipping, transforms, repaint boundaries and colored boxes provide their native configuration from their own Core modules. The scene compiler reads these exact registered prototypes; it does not execute TS layout/paint/hit-test or admit unregistered render subclasses. Paragraph/image and other render families still have remaining migration work in [work9-b](../work9-b.md).

## Modules

Import APIs from explicit subpaths. Core has no aggregate root API.

| Area | Responsibility | Example import |
| --- | --- | --- |
| [Foundation](src/foundation/) | Notifications, disposal, clocks, errors, and utilities | `@nelyx/core/foundation/notifier` |
| [UI](src/ui/) | Canvas, geometry, text, images, and frame contracts | `@nelyx/core/ui/canvas` |
| [Hosting](src/hosting/) | Application, View, resource, and service lifetimes | `@nelyx/core/hosting/runtime` |
| [Framework](src/framework/) | Widgets, rendering, scheduling, gestures, animation, and navigation | `@nelyx/core/framework/widgets/basic` |
| [Services](src/services/) | Editing, platform channels, keyboard, and OS-service contracts | `@nelyx/core/services/text-editing` |

Public subpaths are listed in [package.json](package.json). Core does not depend on React Native or OS APIs.

## Widget applications

```ts
import {widgetApplication} from '@nelyx/core/framework/widgets/root';
import {Column, Padding, Text} from '@nelyx/core/framework/widgets/basic';
import {allInsets} from '@nelyx/core/ui/geometry';

export function main() {
  return {
    definition: widgetApplication({
      id: 'hello',
      createRoot: () => new Padding(
        allInsets(24),
        new Column([
          new Text('Hello Nelyx', {fontId: 'app-font', fontSize: 24}),
        ]),
      ),
    }),
  };
}
```

Declare `app-font` in the application's `package.json` → `nelyx.assets`. Pass `main().definition` to the platform `ApplicationSurface`; the [Web runner](../sample/nelyx-testbed-app-2/web/runner/App.tsx) shows the complete integration.

Each View owns its BuildOwner, PipelineOwner, scheduler, focus, and mounted State. Use `StatefulWidget` and `State.setState` from `framework/widgets/framework` for local state, and keys to preserve identity when children move. The `createRoot(context, scheduler)` callback receives View services and the host-driven frame scheduler.

## Design package imports

| UI layer | Import |
| --- | --- |
| Common widgets | `@nelyx/core/framework/widgets/basic` |
| Material 3 | `@nelyx/material/widgets` |
| Cupertino | `@nelyx/cupertino/widgets` |

[Material](../packages/material/README.md) and [Cupertino](../packages/cupertino/README.md) own their components and canonical themes. Core's `AppTheme`/`AppThemeData` in `framework/widgets/app-data` provide the common Nelyx theme adapter. All three packages share one Core instance.

## Working with the framework

| Task | Modules |
| --- | --- |
| Layout and constraints | `framework/widgets/basic`, `framework/rendering/constraints` |
| Editable text | `framework/widgets/editable-text` |
| Lists and scrolling | `framework/widgets/scroll`, `framework/widgets/scroll-view` |
| Routes and navigation | `framework/widgets/navigation` |
| Focus and keyboard actions | `framework/widgets/focus-scope`, `framework/widgets/shortcuts` |
| Drawing | `ui/canvas`, `ui/paint`, `framework/widgets/custom-paint` |
| Images and decoration | `framework/widgets/image`, `framework/painting/box-decoration` |

Controllers, FocusNodes, images, and other resources supplied by the application retain their own lifetimes. Dispose them when their owner finishes. A TextEditingController belongs to one mounted EditableText; OS composition and selection are coordinated through the SDK's editing service.

Custom render objects use the common layout, paint, hit-test, and invalidation contracts in [framework/rendering/](src/framework/rendering/). Keep drawing in `paint`, invalidate layout or paint through the render object, and release owned resources during disposal.

Each requested frame paints and submits to the renderer. Renderer admission (`accepted`) does not confirm display. Matching geometry, paint versions or previous admission cannot suppress later redraw, animation or scrolling frames. Existing resource reuse within repaint boundaries and layers remains available.

For low-level scene consumers, `FrameworkRoot.build(scene)` returns a `FrameRecording`. Respect owner gates such as first-frame deferral through `shouldSubmitFrame()`, and call `frameSubmitted(token)` after renderer admission. The capture and disposal contracts live in [ui/frame.ts](src/ui/frame.ts); recordings and submitted GPU work have separate resource lifetimes.

## Build and check

From the repository root, after `npm ci`:

```powershell
npm run build:core
npm run check --workspace @nelyx/core
```

Use `npm run build:sdk` to build the complete package set. When consuming locally packed packages, supply and reinstall the runner after changes; see the [CLI guide](sdk/tooling/cli/README.md#supply-and-install).

Nelyx implements a subset of Flutter's APIs. Check a module's declarations and the [Testbed](../sample/nelyx-testbed-app-2/README.md) for available functionality. Platform readiness is described in the [project guide](../README.md#project-status).

## License

Nelyx-authored code uses [BSD-3-Clause](LICENSE.md). Imported source and assets retain their notices in [licenses/](licenses/); source pins and ownership metadata are maintained in [upstream/](upstream/).
