# Nelyx SDK

**English** | [한국어](README.ko.md)

Consumer projects require **TypeScript >=7.0.0**; generated runners pin **7.0.2**. Runner checks resolve the installed compiler through its public package metadata and verify its executable version. Generated configuration uses relative paths and an explicit app root without the removed `baseUrl` option.

`@nelyx/sdk` connects the [Core framework](../README.md) to platform applications, rendering surfaces, input, assets, OS services, and host lifetime. Shared application code stays in `src/`; each platform runner supplies registration and build configuration.

Start with the [Testbed guide](../../sample/nelyx-testbed-app-2/README.md) for a complete application or the [CLI](tooling/cli/README.md) to create a new one.

## Experimental v2 packet port

`@nelyx/sdk/engine-v2` exports `connectEngineV2Host(host, options)`. Supply a v2 packet transport with an `identity` containing `engine: 'v2'`, `abiMajor`, and `schema`. The facade checks bundle/host identity, then the C++ handshake checks requested capabilities. The [Core v2 guide](../README.md#experimental-v2-engine-protocol) covers build commands, ACK retry, activation, and close/drain.

`createBrowserEngineV2Surface(canvas, { root: new URL('/engine/', location.href), profile: 'auto' })` connects the supplied worker runtime to a fresh canvas. Serve the whole current engine dist at `root`. The returned surface provides a packet host, an App port, diagnostics, and asynchronous `close()`. The Main thread forwards bounded input and viewport updates; C++ owns scene coordinates, scrolling, and hit-testing. `auto` selects threaded when isolation/shared memory is available and single-worker otherwise. A missing explicit capability or broken supply fails startup; it does not enable a v1 fallback. Close drains providers and workers, and a new session requires a new canvas. Pass the App worker to `surface.createAppPort(appWorker)` so the surface owns its terminal cleanup. The standard launcher does this automatically. The surface stops registered App workers before returning their host reservations; a port without a registered worker cannot request the synchronous paragraph service.

Hidden pages clear preparation caches and lower the GPU cache limit. An embedder receiving its own memory pressure signal can also call `surface.setMemoryPressure(true)`, then pass `false` when pressure clears. This requests a policy change; `diagnostics['memory-pressure']` reports its application by the actual owners. Active publications remain usable and necessary new scenes still prepare under pressure. The Windows host observes OS low-memory resource notifications directly. Cache reduction does not establish immediate release of the Wasm heap, in-flight GPU resources, or driver memory.

The standalone Windows host and both Web profiles run the Testbed with v2 Widgets/State/Keys, C++ layout and intrinsic/dry queries, editing documents and semantics. Browser surfaces install a `dom-textarea/aria` input carrier and peers using published geometry; pointer packets, DOM focus/keys and App edit/focus/action requests share the Main input queue. App ports admit 24 requests/3 MiB, reserving the rest of the total 32 requests/4 MiB for Main input. Windows connects real TSF contexts and UIA Fragment/Value/Text/Invoke on its STA UI owner. The [Core guide](../README.md#experimental-v2-engine-protocol) covers build/run commands and APIs. Full Widget/Material/Cupertino, gesture and Android migration, physical IME/reader and performance remain PARTIAL; see the [work8 execution record](../../history/26/11/04/work8-2-summary.md#이번-작업의-구현검증-현황) and [active work9 plan](../../work9.md).

### General v2 projects

New candidate apps default-export `defineApp({ build, ready, dispose })` from `@nelyx/sdk/app`. `build` returns the original framework Widget. One BuildOwner sends scene configuration directly to the common SceneWriter; there is no intermediate data-Widget tree or OriginalRoot marker.

New projects use `nelyx.json` with `schema: "nelyx.app/1"`, a relative `entry`, an `assets` map and an optional `supply`. Their common declarations use ES2022, `types: []`, NodeNext and `skipLibCheck: false`. Continue to pass `--engine v2` while the candidate path is being qualified. The previous `nelyx.v2.json` remains a transitional input; conflicting config files or `package.json.nelyx` settings fail explicitly. The CLI links previous original-App definitions directly to `launchApp`; the temporary data launcher only accepts data Widgets. Pack the Tooling Contracts archive along with Core, SDK, CLI, Metro and Static AOT.

Engine supply builds produce hosts, providers, protocol and bundled fonts independently of App packages and Testbed UI. Repository run commands prepare the App packages and build the existing Testbed candidate in `sample/nelyx-testbed-app-2/engine-v2` as a separate App bundle. `@nelyx/sdk/engine` exposes packet/surface services without loading an App frontend; `@nelyx/sdk/app` owns the original Widget entry.

The original App entry binds one messenger for canonical `Clipboard` calls and editing shortcuts. App OS service version 2 runs clipboard operations on the Windows UI owner, Android HostView UI owner or Web Main owner. Requests are bounded by 32 operations, 65,536 UTF-16 units and aggregate byte credits. Closing gates new work, cancels unstarted native operations and drains admitted callbacks before releasing the messenger. Unsupported OS channels fail before admission. Web uses the browser Clipboard API and its permissions; permission failures remain errors. Other OS services and full VM/lifecycle behavior remain unfinished.

Native-owned render objects route tap, long-press and focus feedback through their accepted scene's semantic ancestry without attaching to a TS semantics pipeline. Android sends these notifications to a current virtual-node identity and executes the original system-sound/haptic mappings on UI. Windows and Web ignore these node-feedback notifications as their previous embeddings did; Windows/Web system sound and haptics remain unavailable. General accessibility announcements and other unsupported channel operations still fail explicitly. Direct feedback callbacks share the service admission and close drain with clipboard requests.

Native App bundling resolves module/main entries without the browser condition. Windows Hermes enables `ES6BlockScoping`; Android enables `EnableBlockScoping` and compiles with `-block-scoping`, preserving per-iteration callback and CommonJS getter capture. This is scoped language qualification; the current Windows evaluator still lacks equivalent TDZ exceptions for access before lexical initialization.

App and Content resolve unavailable font families through the declared fallback order and bundled default using the same font revision. Windows Segoe UI and Android Roboto retain actual system faces under the font quota. Web uses the supplied App font cohort. Full API, catalog, physical-input and performance acceptance remains partial.

Windows engine v2 uses a single Windows App SDK host. Normal Windows create/doctor/build/run/dev/pack commands select `windows-app-sdk` by default; generated apps also record it in `nelyx.json`. The executable pins `Microsoft.WindowsAppSDK@1.8.260508005` and ships its unpackaged/self-contained runtime, MSVC CRT and licenses. Missing runtime files, obsolete host settings or supplier mismatches fail admission. RNW 0.83.2 public clipboard source is adapted to the App SDK dispatcher with cancellation and terminal drain; originals, modified source, hashes and MIT license ship under `windows-app-sdk/sources/rnw`. See the [native API port inventory](../engine/platform/native-api-ports.md) for remaining input/IME/UIA/settings ports. [work9](../../work9.md) tracks full API, physical input and performance acceptance separately.

For the repository Testbed, run `npm.cmd run build:engine-v2`, then `npm.cmd run run:engine-v2:windows`. `V2_WINDOWS_HOST` reports the actual host/dispatcher path; `V2_INPUT_SOURCE` reports DirectManipulation input admission/rejection counts. Injected wheel and automated UIA checks do not approve physical precision trackpad behavior.

The full v2 supply build checks a prepared `m153-nelyx-paragraph.6` CanvasKit manifest, file hashes, paragraph API 1, font-reference Picture API 3 and immutable font-collection API 1. Missing or mismatched inputs fail the build; follow the [owned runtime preparation guide](../skia/eng/source-build/README.md). The npm CanvasKit dependency supplies types. App startup does not download or build vendor inputs.

Create a standalone project from the matching Core, SDK, CLI, Metro, Static AOT and Tooling Contracts package archives. Add `--designs material,cupertino` and their archives when needed. Install once at the app root:

```powershell
nelyx create MyApp --engine v2 --packages <archive-directory>
npm.cmd --prefix MyApp install --workspaces=false
cd MyApp
npx --no-install nelyx build --engine v2 --target web --engine-inputs <current-engine-dist>
npx --no-install nelyx run --engine v2 --target web --port 8192
```

The optional `supply` selects the engine directory; `--engine-inputs` overrides it. `build(context)` returns an original Widget and can await `context.asset(name)`; `context.view` exposes the versioned packet client. FontLoader and common asset/buffer/image services are bound before build. `dispose` runs before Widgets, providers and the engine drain.

Repeated close requests share one result. App, Widget, transport and browser surface cleanup all run even when earlier owners fail. A single failure retains its identity; multiple failures return an `AggregateError` with ordered `errors`, the first `cause`, and messages that survive native/worker reporting. The host drains providers/Core before returning a failed close result.

Windows waits up to three seconds for App disposal and gives the App owner 250 ms to exit. If evaluated JavaScript keeps running, the host requests a Hermes async break, joins the owner and drains the engine as a failed session. This interrupts JavaScript loops; it does not authorize freeing resources still held by a native/GPU consumer.

Build output defaults to `dist/v2-web`, `dist/v2-windows` or `dist/v2-android`. Use `--target windows` for the selected standalone Hermes/Skia host. `doctor` verifies the selected supplier; `prepare` builds the App bundle. `pack --engine v2 --target web` creates `dist/v2-web-package`, including the verified engine supplier. `run --engine v2 --target web --package dist/v2-web-package` runs that portable package. The server exposes `/isolated/` for automatic threaded selection and `/plain/` for the functional single-worker profile. Apple and Linux v2 hosts are not supplied.

Android uses a standalone Activity/JNI host with Hermes and Skia Graphite/Dawn/Vulkan. Select HotSpot JDK 21 in `JAVA_HOME` and install Android SDK 36/build-tools 36.0.0; the supplied project pins Gradle 8.14.3/AGP 8.13.1. Use an Android engine supplier built with `npm.cmd run build:engine-v2:android` at this repository root. The separate repository run command prepares Core, SDK and both design packages before building the App. Minimum Android is API 26; arm64-v8a selects hardware Vulkan and x86_64 selects the explicit emulator profile.

```sh
npx --no-install nelyx doctor --engine v2 --target android --engine-inputs <dist-android>
npx --no-install nelyx build --engine v2 --target android --engine-inputs <dist-android> --architecture x86_64
npx --no-install nelyx run --engine v2 --target android --device emulator-5554
npx --no-install nelyx dev --engine v2 --target android --engine-inputs <dist-android> --architecture x86_64 --device emulator-5554
npx --no-install nelyx pack --engine v2 --target android
npx --no-install nelyx run --engine v2 --target android --package dist/v2-android-package --device emulator-5554
```

For a device build, select `--architecture arm64-v8a`. The current APK is signed with a development debug key. Run verifies installation, the loaded source identity, matching native/SDK work and the first GPU frame. Recoverable GPU/context/surface loss drains the old App, Content and Render owners before starting a new session. State resets; automatic recovery is limited to two attempts per Activity. Startup, fatal and disposal/drain failures show a terminal error. The [Android sample](../../sample/nelyx-engine-v2-android) and [current qualification](../../work9-4.md#현재-android-구현과-실행) cover input, accessibility, lifetime and emulator evidence. Full original API/catalog, production signing and physical/performance acceptance remain incomplete.

Android `dev` follows the same generation replacement contract. It prepares the new APK, correlates the installed process/native owner and close ticket, and installs only after App disposal, worker/GPU drain and a zero ledger. A force-stop does not establish a graceful drain. Only the development profile enables the debuggable close control and local HTTP; ordinary builds disable both in their manifest. Run the repository sample with `npm.cmd run dev:engine-v2:android -- --device=emulator-5554`.

The Original Android sample explicitly selects `ThemeData({ splashFactory: InkRipple.splashFactory })`. The default Android InkSparkle native shader and full design catalog remain unconnected. Qualified editing covers Material TextField with `decoration: null` and the default single-line CupertinoTextField, with broader options still unqualified.

`npx --no-install nelyx dev --engine v2 --target web --engine-inputs <current-engine-dist>` watches App source, configuration and assets from startup. It also supports `--target windows`, the selected `windowsHost`, and a custom `--output`. A preparation failure keeps the current application running. Successful preparation drains the previous App, providers and workers, or the Windows VM/window, before starting a new session. App State resets; this does not preserve state across reloads. Disposal or owner shutdown failure terminates the development run with a failure result.

The development Web server requires loopback, allows up to eight clients, and waits up to 15 seconds for their drain acknowledgements. Generation URLs retain only the current and immediately previous bundle; expired requests return 410. An old session never receives a replacement bundle's assets. Ctrl+C closes the watcher, host/server and temporary candidate/retired bundles.

Build and launch verify Core/host ABI, protocol schema, supplier source identity and every declared file hash. Asset names and file paths stay within their declared roots; aggregate App assets are limited to 32 MiB. A failed build preserves the previous bundle. Package output includes the current supplier, its licenses and the application; it requires no Testbed entry or repository asset lookup. Generated projects include a pinned TypeScript compiler in their own dev dependencies.

The transitional data App imports Widgets from `@nelyx/core/v2`, `@nelyx/material/v2` and `@nelyx/cupertino/v2`. Canonical foundation values/notifiers/keys, physics calculations, curves, selected geometry/painting values and Material colors can retain their original public imports. The runner records selected imports in `routing`, checks all four packages' actual input files, and rejects unported implementations and foreign Core copies even through direct paths. App-ready reports `execution` with native ACK counters and rejected fallback reasons; the previous constant fallback count is removed. This admission does not establish full legacy Widget/constructor/behavior compatibility. The [active work9 API plan](../../work9-2.md#8-기존-공개-api-호환-작업) carries the compatibility gate forward; [work8 evidence](../../history/26/11/05/work8-2a-summary.md#현재-구현-현황) records the closure boundary.

### Partial original Element/State bridge

The previous `defineOriginalEngineV2App` from `@nelyx/sdk/engine-v2-original` forwards to `defineApp`. New code uses `@nelyx/sdk/app`; direct embedders use its `launchApp`. Canonical constructors, imports and Element/State/Inherited/GlobalKey lifetimes remain on App. Standard render configuration becomes C++ nodes; the bridge runs no TS layout, paint or hit-test.

```typescript
import { defineOriginalEngineV2App } from '@nelyx/sdk/engine-v2-original';
import { SizedBox, ColoredBox } from '@nelyx/core/framework/widgets/basic';

export default defineOriginalEngineV2App({
  build() {
    return new SizedBox(160, 80, new ColoredBox({ color: 0xff2468ac }));
  },
});
```

Supported render configuration currently covers ConstrainedBox, Padding, default ColoredBox, Align/Center alignment and size factors, Flex sizing/spacing/Expanded/overflow clipping with RTL/up directions, and non-positioned Stack with loose/passthrough/expand sizing, numeric alignment and none/hardEdge clipping. Unbounded Flex main constraints are connected when there are no flexible children. Unported settings such as baseline alignment, positioned children and anti-alias clipping, other render objects, instance hooks, custom pointer/semantics hooks and unavailable App services fail explicitly. Full Text, controller and design API compatibility remains unfinished.

Plain `Text` uses the provider's font cohort for LTR/RTL, alignment, locale, wrapping, maxLines, ellipsis and soft hyphens. Size, color, scaling, `DefaultTextStyle`, paragraph height, signed spacing, leading/height behavior, tight/loose sizing, basic text semantics and clip/visible overflow are connected. Weights 100–900 and a single `fontFamily` request retain their existing provider selection: Native can use available installed and bundled fonts; Web uses declared provider fonts with bundled fallbacks. The same request can select different actual fonts across cohorts. `CupertinoSystemText` aliases the bundled default. `RichText` and `Text.rich` also preserve non-interactive canonical `TextSpan` inheritance, per-run size/weight/italic/locale/family lists, solid foreground/background colors, decorations, OpenType features, explicit variations and text shadows. Source still constructs the spans and applies its text scaler; C++ shapes and places the runs. Strut font/height/leading, forced line height and leading distribution are connected. Original `RichText` and `Text.rich` support up to 64 canonical `WidgetSpan` children. Core measures their loose inline constraints, applies the canonical text scale and alphabetic/ideographic baselines, then positions children using Content placeholder boxes. Ellipsis hides omitted subtrees from paint, input and semantics. A forced strut may leave child ink outside the line box; paragraph overflow controls painting and pointer admission stays within the paragraph box. Custom fonts/fontId, interactive/selectable TextSpan and additional paint styles remain unfinished.

`ClipRect` from `framework/widgets/basic` and affine `Transform` (including translate, rotate, scale and flip) use C++ layout and published frame geometry. Content resolves origin and directional alignment against the final size, including after resize. Singular transforms suppress the child. Perspective/3D matrices, non-null `filterQuality` and `transformHitTests: false` currently fail explicitly.

The separate `framework/widgets/clip` API supports default `ClipRect`, `ClipRRect`, `ClipOval` and `ClipPath`, all four clip behaviors, and directional elliptical corner radii. `ClipPath` uses its default rectangle. Custom clippers fail before App clip queries run. Default rect/rrect/path widgets hit their proxy rectangle; `ClipOval` retains its ellipse for hit testing with `Clip.none`, matching the original API.

Original vertical `ListView` and `ListView.builder` support finite fixed `itemExtent` lists. Bounded lists with `preparation: 'disabled'` also support `SectionExtentIndex` variable heights, explicit padding and optional `capacity` 0–8. The original Sliver Element, keyed State, explicit KeepAlive and shared ViewWorkBudget own child lifetimes. Capacity limits optional retention; visible children and the previous published window remain required until replacement. Core requests children using actual parent constraints, measures zero or positive heights, maintains its metric cache and prepares coverage before activation. App does not run sliver layout.

The original `ScrollController`, position, synchronous listeners and default delegate wrappers remain connected. Numeric Source-list jumps use Core's metric cache, and `SectionExtentIndex.requestItem(index, { offset })` seeks the measured item and its inside offset. Replacing the controller retains the same position and runs its attach/detach callbacks. `animateTo` supports `Curves.linear` within prepared content, up to 1,900ms. Explicit cache extents, automatic preparation, nondefault drag-start policy, arbitrary extent builders, reverse, restoration, custom physics and full keyboard/reader behavior remain unfinished and fail explicitly. A scene admits at most 128 required/explicit list children. Overall compatibility remains `partial`.

Canonical `Icon` retains its private Source paragraph, fixed box, centering, RTL mirroring and label policy through module-owned native configuration. Its private glyph is excluded from descendant semantics. Alphabetic and ideographic text-style baselines survive uniform and mixed paragraph runs in the common Native Skia/Web CanvasKit providers. Font selection still uses the declared App font cohort.

Original `GestureDetector` from `framework/widgets/gesture-detector` connects tap down/up/move/cancel, `onTap`, `onDoubleTap`, primary long-press callbacks and pan/horizontal/vertical drag callbacks to C++. Callbacks receive the canonical `Tap*Details`, `LongPress*Details` and `Drag*Details` objects. C++ computes global/local positions, deltas, timestamps and end velocities; `dragStartBehavior` and `onlyAcceptDragOnThreshold` are supported. A pressed-state `setState` and its native ACK preserve the capture for the same input's up/cancel. Callbacks and State run on App.

Default/opaque/translucent hit configuration and tap/long-press semantic actions are connected. Secondary buttons, double-tap details, scale/force, custom settings, device filters, combined pan and directional drag recognizers, and the full nested arena/overflow ancestor hit contract remain unported. Unsupported options fail explicitly. Overall compatibility remains `partial`.

Canonical `CupertinoButton`, `filled` and `tinted` from `@nelyx/cupertino/button` retain the existing theme, ControlInteraction, WidgetStatesController and FocusNode. Tap/long press, hover state, disabling, basic semantics and Tab/Enter activation are connected. Basic background decoration, uniform rounded corners and Opacity layers run in C++. Canonical `AnimationController` and post-frame callbacks advance from requested host frame timestamps; native frames do not wait for App callbacks. Direct `OriginalWidgetHost` embedders must provide `platform` or configure canonical `FoundationPlatform` first. The original SDK app entry configures the Native/browser environment. OS cursor shape changes, the full focus/shortcut/semantics contract, complex decoration and the full Material/Cupertino API remain unfinished.

Web treats the canvas and its owned semantic DOM peers as one input surface. Hover survives pointer-capture handoff and exits when the pointer leaves that surface. The representative browser integration covers button activation, hover, actual opacity pixels and resource drain in both single-worker and threaded profiles.

The original BuildOwner now has a View-owned `SemanticsBinding` connected to the existing SDK messenger's dispatcher. Its rectangles come from the native published tree, including clipping and generational node ids; metrics/device changes, hiding and closing clear the observation. Tap, long-press, increase and decrease listeners run before the original action callback. An action from an older publication receives no rectangle from a newer one. Service stop ends observation and action delivery while the binding lease remains available through Source unmount. The original TapRegion surface and region now use native published hit paths, retained down paths for pointer-up, group registration order, outside consumption and native semantic classification. Source keeps group equality and callbacks; semantic callbacks run at the original Source listener position. Chrome in both profiles and both Windows hosts passed the basic paths and released all reservations on normal close. Callback-time policy changes and exceptions still need an equivalent native consumption decision. Android input, OS accessibility-feature ingress, focus/range listener parity and the complete semantics API remain unfinished.

Original Offstage keeps child layout and State while reporting the incoming minimum size and suppressing paint, hit tests and semantics. Focus and keyboard stay available; a hidden leader does not link a visible follower. Both Chrome profiles passed State and focus retention, keyboard and animation progress, observed sizes, semantic hiding, screenshot pixels and single disposal. Both Windows hosts passed visible hide/show and retained keyboard handling. Native-owned `RenderBox.hasSize` and `size` read the actual published layout observation; missing publication, metrics/device changes, hidden or closed Views and replaced handles invalidate it. Ordinary TS-owned render boxes retain their existing size path. This does not complete synchronous constraints, layout-state or geometry APIs. Android input and hidden Web EditableText IME remain unverified.

Original `BlockSemantics` and `ExcludeSemantics` provide exact Source configuration to Content. C++ limits blocking to earlier paint siblings in the same semantic boundary, omits excluded child semantics, and preserves paint, pointer and focus behavior. Basic labels and nonconflicting actions merge in the published Frame; actions retain their original callback source and merged focus peer. Feedback follows native merge/block observations and publication fences. Both Chrome profiles and both Windows hosts passed basic visibility, callback, pointer/focus and normal close checks. Windows and Android accessibility consume the final Frame metadata. Merge-conflict rules, role merging, sorting, custom actions and full focus/range parity remain unfinished. Android input and hidden Web editor IME are unverified.

Original `Semantics.scopesRoute` and `namesRoute` now feed a Content-owned route decision at successful publication. The first nonempty exposed name in the selected subtree supplies an edge announcement; changing its label alone keeps the selection and does not announce again. Offstage, exclusion and blocking affect route exposure. Route containers stay outside accessibility focus while separate input focus remains available. Both Chrome profiles passed route insertion, nesting, pop, hiding, repeated names and close through fresh installed standalone packages. Both Windows hosts passed OS pointer input, published UIA/GPU updates and actual UIA notification reception without duplicate announcements on a name change. Android provides pane-title/window-state transport and passed both ABI builds and Java compilation; its route events and screen-reader speech remain unverified. Full semantics merge, sorting, custom actions and physical/display/performance acceptance remain unfinished.

Original `LayoutBuilder` now runs its Source Element and build scope from actual Content layout inputs. Content suspends before child layout and sends a versioned demand; App validates the current configuration and transaction before running the original builder and submitting its children with the acknowledged constraints. The active scene remains available during that exchange. Nested/tight/unbounded inputs, invalidation, scoped State updates, inherited dependencies, rebuild policy, GlobalKey moves and Offstage passed Core/Source checks and both Chrome profiles. Both Windows hosts passed OS pointer input, UIA/GPU updates and normal close. Fresh installed packages passed strict ES2022 declarations and standalone Web execution. Intrinsic/dry queries reject speculative tree mutation; general synchronous constraints and Android runtime/physical/performance acceptance remain unfinished.

Original `SnapshotWidget` keeps Source layout, input and semantics live while Render freezes actual child pixels. Shared C++ policy owns capture/reuse, controller clear, DPR/device, autoresize, mode and bounded tokens; Native Skia and CanvasKit own raster images. Default painting stretches the capture; original Material Zoom painters declare live/cached scale, opacity and scrim recipes. Both Chrome profiles and both Windows hosts passed freeze/clear/resize/reparent and normal close checks; C++ raster checks cover outer clips and nested invalidation. Unknown painters, custom rasterizers and unported PlatformViews remain explicit limitations. A first capture beneath a noninvertible ancestor fails explicitly; an existing image may remain cached. Web runtime failures halt new admission while allowing resource retirement and ordered close; both profiles returned zero reservations after the deliberate capture failure. Android capture/input, physical display and performance acceptance are unverified.

The Original SDK entry supplies synchronous App-owned C++ paragraph queries to canonical `TextPainter.layout()` through its normal `ParagraphContext`. Service version 12 and Content share the builder policy and initial bundled font cohort. Flat and rich runs support immediate metrics and UTF-16 boxes, hits, glyphs, word and line queries. `ParagraphBuilder.addPlaceholder()` and `TextPainter.setPlaceholderDimensions()` preserve all six alignments, alphabetic/ideographic baselines, scale and writing direction. Their fixed placeholder boxes are returned synchronously. Standalone TextPainter queries use supplied dimensions; Original RichText/Text.rich connect automatic child layout to Core. Forced strut can leave ink outside its line box, which painting preserves until a surrounding clip applies. Rich runs preserve printable four-byte OpenType features (up to 64), explicit variation coordinates (up to 64) and text shadows (up to 16) per run. An explicit `wght` axis takes precedence over the derived font weight; shadow offsets and blur extend the Picture recording bounds. The Core `fontResources` capability exposes bounded upload/read primitives on `EngineViewClient`: a catalog admits up to 16 MiB, chunks up to 256 KiB, within the unchanged 1 MiB packet and 32 MiB resource limits. Upload tokens fence retries and cancellation; generation-bound paragraph/scene holders keep older resources readable after producer release. `setFontCatalog` is a Core control that requires the embedder to prepare every provider owner first. Native Content and both Web profiles resolve immutable collections for these resources. Web Content reads catalogs in bounded chunks; independent Render owners prepare their own collections before accepting the Pictures. Picture API 3 matches actual C++ font streams and collection indices to supplied faces, then records source identities and variation coordinates. Equal family names can refer to different font bytes. `beginFontTransition`, owner preparation ACKs, `commitFontTransition` and `abortFontTransition` fence a Core revision change by token and input watermark. Content and Render prepare their actual collections before acknowledging; commit requires App/Content/Render readiness. Cancellation and decode refusal preserve the active revision. `releaseFontResource` retires a producer independently of document transactions. Source recordings pin the resource/revision measured by their App paragraph. The App coordinator retains Core producers until the last Source recording or captured-scene lease. Desired and unacknowledged scenes keep bounded independent holds even after their Canvas is disposed. Fonts and images share one SDK slot allocator across views; commit uncertainty requires a known terminal ACK. Cached TextPainter layout and template metrics refresh when the observed cohort changes.

```ts
import { defineOriginalEngineV2App } from '@nelyx/sdk/engine-v2-original';
import { Text } from '@nelyx/core/framework/widgets/basic';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';

import { FontLoader } from '@nelyx/core/services/font-loader';
import { rootBundle } from '@nelyx/core/services/asset-bundle';

export default defineOriginalEngineV2App({
  async build(context) {
    const loader = new FontLoader('ReviewFont');
    loader.addFont(rootBundle.load('font.ttf'));
    await loader.load();
    return new Text('Example', {
      direction: 'ltr',
      style: new TextStyle({ fontFamily: 'ReviewFont' }),
    });
  },
});
```

Declare `font.ttf` in the app asset manifest. The font owner is ready before `build`; use FontLoader in async build or later callbacks. The optional `fontCatalog` runs first. Call addFont for every asset in a family before calling load once. The protected loadFont hook remains available to subclasses.

App service 12 retains immutable font generations for synchronous queries and recordings, including rollback and retirement at the last holder. `layout(input, revision)` and `snapshot(revision)` select a held cohort, so the previous Source revision remains usable while activation awaits Core. Unknown or retired selections fail; an invalid observed Core revision prevents further Source layout. Older late publications cannot replace a newer observed cohort. After App quota admission, the optional `fontCatalog` runs before user build and Source mount. The Original SDK installs its default FontLoader owner before invoking build. Runtime `context.fonts.replace(catalog)` prepares every owner and returns the committed revision; `replace(null)` restores the bundled catalog. `cancel()` cancels admitted active and queued font loads, while `recover()` resolves an uncertain terminal before another update. One candidate is admitted at a time. A committed cohort change notifies the Original View’s canonical system-font listeners. The existing relayout mixin coalesces callbacks on that View’s scheduler; scope replacement, disposal and closing cancel pending work. Native render objects retain configuration ownership without attaching to a TS PipelineOwner, and existing recordings keep their geometry and font revision. The Source FontLoader addFont/load path and public `loadFontFromList` from `@nelyx/core/ui/fonts` are available through the Original SDK. Call `await loadFontFromList(bytes, { fontFamily: 'ReviewFont' })` for an alias, or omit the options to use the intrinsic family. Omitted, null or empty families are queried from the actual Native/Web C++ decoder after capturing the input and admitting temporary memory. Success publishes the coordinated cohort and its Source notification; malformed fonts, quota refusal and cancellation preserve the prior cohort. Packaged rootBundle loading is connected to the shared App owner. ImageDescriptor/Codec immutable-buffer consumers are connected as scoped below; OS font loading/notifications remain unfinished. Without a configured catalog, Original apps start with the bundled `NelyxDefault`, `NelyxArabic`, `NelyxHebrew` and `NelyxEmoji` family aliases; `CupertinoSystemText` maps to the default. Missing service/version/font identity fails explicitly. Replacing or disposing a painter retires its paragraph through the Source resource registry and actual holders. App service 12 retains one immutable catalog in its pending App stage and exposes bounded copied chunks of the exact bytes decoded by C++. Stage credit covers caller/SDK catalog plus snapshot and bounded transport; finish/rollback retires it. Web keeps a separate 128 MiB initial/256 MiB maximum CanvasKit heap with a host reservation of 320 MiB until worker termination; the session ledger ceiling is 768 MiB, with its 128 MiB GPU ceiling retained.

FontLoader and loadFontFromList append to the current immutable catalog and keep its existing family faces and fallback order. The SDK admits at most 32 active/queued loads and 16 MiB of captured font bytes, reserving App credit before snapshots, bounded reads, catalog composition and transfer. `context.fonts.replace` reports busy while these loads are pending. Closing cancels admitted work and releases its credit; a Source asset future that resolves later retains its original owner and cannot migrate to another App. App service 12 snapshots expose `fontBuffers` and `fontBufferBytes`; foreign and duplicate credit returns fail. Quota admission can reject a load before C++ allocation.

After an asset's transport has closed and delivery is confirmed, its temporary read/verification copies retire. The caller's bytes plus a 65,536-byte guard remain credited until the App realm terminates. Web font decoding admits one temporary font slice at a time in addition to the separately reserved Wasm heap and font collection. This prepares the Testbed's three real fonts (12,317,400 bytes) within the existing 320 MiB App quota and 256 MiB maximum CanvasKit heap. It does not complete the Testbed catalog or offscreen snapshot/rasterization APIs.

Canonical native paint metadata can carry a `paragraph` resource recorded by `TextPainter.paint(Canvas, offset)`. Content independently measures the copied immutable declarations, checks font revision and geometry, and places the prepared picture using the final parent layout. Threaded Web transfers the C++ Picture with references to the already supplied fonts and their actual variation coordinates; Render restores it without re-layout or embedding another copy of the font files. This preserves backgrounds, decoration paths, glyph positions and paint order. A Canvas recording keeps its paragraph alive after painter disposal. Unbounded paragraph layout remains separate from finite recording bounds. Interleaved and foreground paragraph order, save/restore and rectangular clips remain connected, with widget children drawn at the boundary and each resource painted only through its stream. Arbitrary Canvas/Picture/custom hooks, additional paint styles and general synchronous RenderBox geometry remain unfinished. `execution.appText` compares actual C++ layouts/queries with SDK calls and reports zero TS fallback; `sdkPaintCaptures` counts immutable recording captures. Provider `fontReferencePictures`, `fontReferenceImports` and `fontReferenceBytes` report actual rich Picture transport work.

World-dependent native paint programs and referenced paint paragraphs use C++ frame geometry without App or Content calls. Frame snapshots expose `framePaintWork`, `framePaintNodes` and `framePlacementNodes`; provider `livePaints`/`livePaintEntries` count live stream entries on node entry, while `orderedParagraphs` and `foregroundPaints` count actual inline paragraph and foreground draws. Static paint stays in Content Pictures. A stream containing paragraph references or a child boundary is resolved by Core and drawn by Render; its raw entries share a limit of 65, with the existing expanded-command, path and operation limits retained. Per-frame expression/path budgets and owned memory leases also cover live evaluation. Invalid live expressions fail explicitly and preserve the last publication.

State values change immediately on App and retain their desired values after a native NACK. The existing native scene remains intact; inactive Elements finalize after a known native ACK or terminal close. Original RenderBox synchronous geometry remains unavailable: TS layout/query/hit-test calls fail explicitly. `context.view.layoutSnapshot()` asynchronously returns the last activated layout with parent-local coordinates and document/metrics epochs. Composed transforms and property overlays belong to the published frame's geometry. Execution reports `appModel: 'original-elements'`, `compatibility: 'partial'` and actual native ACK counts.

`BuildContext.services.readMetrics('logicalWidth', 'scale')` returns an immutable observation of the last Core viewport received by App. Observed resize and scale changes rebuild Elements that read the changed fields; omitting fields subscribes to all metrics. Physical sizes use the provider's pixel rounding. Unavailable native context/surface generations remain `null`. The observed viewport revision can differ from the activated layout revision; it does not provide synchronous RenderBox geometry.

Canonical Material `TextButton`, `FilledButton`/tonal, `OutlinedButton` and `ElevatedButton` retain their source theme, State and controllers. Default rrect/stadium/circle shapes, borders, physical shadows, highlights and InkRipple use C++ geometry with Native/Web painting. Active pointer up/cancel survives App document replacement with unchanged target/ancestor geometry within an eight-publication bound. Basic activation, disabling, hover, Enter and actual animation output were verified on Windows App SDK and both Web profiles. Padded tap targets, custom shapes/rectangles, other ink factories and the full design API remain unfinished. See the [current implementation record](../../work9-3.md#현재-구현검증과-잔여-작업).

Canonical boolean/tristate `Checkbox` and `Radio`/`RadioGroup` retain source State, themes, Toggleable motion and group callbacks. C++ resolves marks, box insets, circle centers and radii. Both Web profiles cover click, Enter/Space, disabled state, the three-state cycle, Radio deselection, arrow navigation, group Tab/Shift+Tab, ARIA and actual output. Nonvisual Windows UIA checks cover mixed state, Radio SelectionItem/group Selection and `RemoveFromSelection` on a selected `toggleable` Radio. Deselection sends a distinct request to the Source callback and preserves the selected value until acknowledgment. Normal Radio deselection and disabled, stale-publication or closed requests are rejected; removing an unselected Radio completes without a change. Current Native selection/focus display, user input, external readers and the full selection API remain unfinished or unverified. See the [current scope and remaining work](../../work9-3.md#현재-구현검증과-잔여-작업).

Original FocusNode and Actions/Shortcuts stay in the App tree. C++ associates focus owners with semantic peers and rejects stale requests using exact focus sessions. FocusNode rect/offset/size read C++ geometry for the currently observed published document, metrics and device; missing or known-stale publication fails. Arbitrary RenderBox synchronous layout/geometry and full API compatibility remain unavailable. Tests cover source shortcuts such as Control+K on Web and callback order, GlobalKey moves and key down/repeat/up in nonvisual Native integration. Complete scan/layout/raw keyboard, character/IME and reader contracts remain unfinished.

Original `CupertinoSlider` and Material `Slider` retain Source State for controlled values, divisions, callbacks, RTL and disabled input. C++ resolves their geometry, gestures and painting. Material's canonical rectangular/rounded/gapped tracks, round/handle thumbs, overlay and ticks use Source theme and animation values; bounded paint expressions use the final Content layout. Material labels use the required App text service. With a canonical `Overlay` ancestor, the default `DropSliderValueIndicatorShape` and modern `RoundedRectSliderValueIndicatorShape` (`year2023: false`) use the existing Source indicator policy, State, animation and LayerLink, including the recorded text. Both always-visible and on-drag policies are connected, including the zero-scale animation start. The Drop background uses a single compound path so translucent contour overlap and strokes follow Source painting. C++ reevaluates world-dependent paint and recorded-text placement from each frame's current scroll and LayerLink transforms, while reusing prepared glyphs and Pictures. The tail follows its anchor while the bubble and text retain their own screen correction. The actual Source default Drop scene is covered during App delays in both Web profiles and Content delays in threaded; single-worker recovers after its bounded Content work. Native CPU raster covers the same live paint path; native window, physical input and performance acceptance remain separate. Other indicator/custom shapes, the debug shadow override and the full Slider/Raw extension contracts remain unfinished and fail explicitly when needed. ACKed Original builds request a Core App-frame turn when Source post-frame callbacks are pending. The internal Slider surface reads size/globalToLocal only from the last observed valid publication; this does not provide general synchronous layout queries. Canonical tap, horizontal/vertical/pan RawGestureDetector factories and View-owned teams are partially connected. Custom recognizers, buttons/devices/timers/velocity/semantics/team settings fail explicitly.

Original `CompositedTransformTarget` and `CompositedTransformFollower` connect View-owned `LayerLink` anchors, offsets and unlinked visibility to C++ composition. Child painting, pointer targets and semantics use the same published coordinates and follow Core scrolling. Their canonical Source `.layer` objects, `LayerLink.leader/leaderSize`, `FollowerLayer.getLastTransform()` and `RenderFollowerLayer.getCurrentTransform()` observe completed native publications; ACK alone does not advance composition. Before first publication `.layer` is null. An unlinked or unavailable follower transform returns null, and `getCurrentTransform()` retains its identity fallback. Layer handles retain Source object identity, and closing the View detaches its mirrors and drops View references even when an App retains a handle. Native Source layers are observation mirrors: direct layer mutation, App SceneBuilder composition, annotation search and Source rasterization are not connected. General synchronous layout queries and the full custom/layer API remain unfinished. Duplicate leaders, sharing links across Views, invalid handles and incorrect paint order fail. This partial support does not establish Native physical display or reader acceptance.

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
