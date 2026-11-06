# Nelyx SDK

**English** | [한국어](README.ko.md)

`@nelyx/sdk` connects the [Core framework](../README.md) to platform applications, rendering surfaces, input, assets, OS services, and host lifetime. Shared application code stays in `src/`; each platform runner supplies registration and build configuration.

Start with the [Testbed guide](../../sample/nelyx-testbed-app-2/README.md) for a complete application or the [CLI](tooling/cli/README.md) to create a new one.

## Experimental v2 packet port

`@nelyx/sdk/engine-v2` exports `connectEngineV2Host(host, options)`. Supply a v2 packet transport with an `identity` containing `engine: 'v2'`, `abiMajor`, and `schema`. The facade checks bundle/host identity, then the C++ handshake checks requested capabilities. The [Core v2 guide](../README.md#experimental-v2-engine-protocol) covers build commands, ACK retry, activation, and close/drain.

`createBrowserEngineV2Surface(canvas, { root: new URL('/engine/', location.href), profile: 'auto' })` connects the supplied worker runtime to a fresh canvas. Serve the whole current engine dist at `root`. The returned surface provides a packet host, an App port, diagnostics, and asynchronous `close()`. The Main thread forwards bounded input and viewport updates; C++ owns scene coordinates, scrolling, and hit-testing. `auto` selects threaded when isolation/shared memory is available and single-worker otherwise. A missing explicit capability or broken supply fails startup; it does not enable a v1 fallback. Close drains providers and workers, and a new session requires a new canvas.

Hidden pages clear preparation caches and lower the GPU cache limit. An embedder receiving its own memory pressure signal can also call `surface.setMemoryPressure(true)`, then pass `false` when pressure clears. This requests a policy change; `diagnostics['memory-pressure']` reports its application by the actual owners. Active publications remain usable and necessary new scenes still prepare under pressure. The Windows host observes OS low-memory resource notifications directly. Cache reduction does not establish immediate release of the Wasm heap, in-flight GPU resources, or driver memory.

The standalone Windows host and both Web profiles run the Testbed with v2 Widgets/State/Keys, C++ layout and intrinsic/dry queries, editing documents and semantics. Browser surfaces install a `dom-textarea/aria` input carrier and peers using published geometry; App edit/focus/action requests share the Main input queue. App ports admit 24 requests/3 MiB, reserving the rest of the total 32 requests/4 MiB for Main input. Windows connects real TSF contexts and UIA Fragment/Value/Text/Invoke on its STA UI owner. The [Core guide](../README.md#experimental-v2-engine-protocol) covers build/run commands and APIs. Full Widget/Material/Cupertino, gesture and Android migration, physical IME/reader and performance remain PARTIAL; see the [work8 execution record](../../history/26/11/04/work8-2-summary.md#이번-작업의-구현검증-현황) and [active work9 plan](../../work9.md).

### General v2 projects

Select the Windows App SDK candidate with `"windowsHost": "windows-app-sdk"` in `nelyx.v2.json`, then use the normal Windows build/run/pack commands. It requires the current supplier's `windows-app-sdk` profile and uses real AppWindow/Microsoft.UI dispatcher APIs with the existing Graphite/Vulkan renderer. The executable project pins `Microsoft.WindowsAppSDK@1.8.260508005` and deploys its unpackaged/self-contained runtime, MSVC CRT and licenses beside the executable. Missing runtime files or mismatched supplier identity fail admission. The existing default remains `windows-hwnd`; [work9](../../work9.md) tracks full API, physical input and performance acceptance separately.

For the repository Testbed, run `npm.cmd run build:engine-v2`, then `npm.cmd run run:engine-v2:windows-app-sdk`. `V2_WINDOWS_HOST` reports the actual host/dispatcher path; `V2_INPUT_SOURCE` reports DirectManipulation input admission/rejection counts. Injected wheel and automated UIA checks do not approve physical precision trackpad behavior.

The full v2 supply build checks a prepared `m153-nelyx-paragraph.1` CanvasKit manifest, file hashes and paragraph API 1. Missing or mismatched inputs fail the build; follow the [owned runtime preparation guide](../skia/eng/source-build/README.md). The npm CanvasKit dependency supplies types. App startup does not download or build vendor inputs.

Create a standalone project from the matching Core, SDK, CLI, Metro and Static AOT package archives. Add `--designs material,cupertino` and their archives when needed. Install once at the app root:

```powershell
nelyx create MyApp --engine v2 --packages <archive-directory>
npm.cmd --prefix MyApp install --workspaces=false
cd MyApp
npx --no-install nelyx build --engine v2 --target web --engine-inputs <current-engine-dist>
npx --no-install nelyx run --engine v2 --target web --port 8192
```

`nelyx.v2.json` declares `schema: "nelyx.app.v2/1"`, `engine: "v2"`, a relative `entry`, and an `assets` map from logical names to relative source files. The optional `supply` selects the engine directory; `--engine-inputs` overrides it. Export `defineEngineV2App({build, ready, dispose})` from the entry. `build(context)` returns a v2 Widget and can await `context.asset(name)`; `context.view` exposes the versioned packet client. `dispose` runs before Widgets, providers and the engine drain.

Repeated close requests share one result. App, Widget, transport and browser surface cleanup all run even when earlier owners fail. A single failure retains its identity; multiple failures return an `AggregateError` with ordered `errors`, the first `cause`, and messages that survive native/worker reporting. The host drains providers/Core before returning a failed close result.

Windows waits up to three seconds for App disposal and gives the App owner 250 ms to exit. If evaluated JavaScript keeps running, the host requests a Hermes async break, joins the owner and drains the engine as a failed session. This interrupts JavaScript loops; it does not authorize freeing resources still held by a native/GPU consumer.

Build output defaults to `dist/v2-web` or `dist/v2-windows`. Use `--target windows` for the selected standalone Hermes/Skia host. `doctor` verifies the selected supplier; `prepare` builds the App bundle. `pack --engine v2 --target web` creates `dist/v2-web-package`, including the verified engine supplier. `run --engine v2 --target web --package dist/v2-web-package` runs that portable package. The server exposes `/isolated/` for automatic threaded selection and `/plain/` for the functional single-worker profile. Android, Apple and Linux v2 hosts are not supplied.

`npx --no-install nelyx dev --engine v2 --target web --engine-inputs <current-engine-dist>` watches App source, configuration and assets from startup. It also supports `--target windows`, the selected `windowsHost`, and a custom `--output`. A preparation failure keeps the current application running. Successful preparation drains the previous App, providers and workers, or the Windows VM/window, before starting a new session. App State resets; this does not preserve state across reloads. Disposal or owner shutdown failure terminates the development run with a failure result.

The development Web server requires loopback, allows up to eight clients, and waits up to 15 seconds for their drain acknowledgements. Generation URLs retain only the current and immediately previous bundle; expired requests return 410. An old session never receives a replacement bundle's assets. Ctrl+C closes the watcher, host/server and temporary candidate/retired bundles.

Build and launch verify Core/host ABI, protocol schema, supplier source identity and every declared file hash. Asset names and file paths stay within their declared roots; aggregate App assets are limited to 32 MiB. A failed build preserves the previous bundle. Package output includes the current supplier, its licenses and the application; it requires no Testbed entry or repository asset lookup. Generated projects include a pinned TypeScript compiler in their own dev dependencies.

Import Widgets from `@nelyx/core/v2`, `@nelyx/material/v2` and `@nelyx/cupertino/v2`. Canonical foundation values/notifiers/keys, physics calculations, curves, selected geometry/painting values and Material colors can retain their original public imports. The runner records selected imports in `routing`, checks all four packages' actual input files, and rejects unported implementations and foreign Core copies even through direct paths. App-ready reports `execution` with native ACK counters and rejected fallback reasons; the previous constant fallback count is removed. This admission does not establish full legacy Widget/constructor/behavior compatibility. The [active work9 API plan](../../work9-2.md#8-기존-공개-api-호환-작업) carries the compatibility gate forward; [work8 evidence](../../history/26/11/05/work8-2a-summary.md#현재-구현-현황) records the closure boundary.

### Partial original Element/State bridge

Explicitly select `defineOriginalEngineV2App` from `@nelyx/sdk/engine-v2-original` to return original Widgets from `build`. Canonical constructors, imports and Element/State/Inherited/GlobalKey lifetimes remain on App. Standard render configuration becomes C++ nodes; the bridge runs no TS layout, paint or hit-test.

```typescript
import { defineOriginalEngineV2App } from '@nelyx/sdk/engine-v2-original';
import { SizedBox, ColoredBox } from '@nelyx/core/framework/widgets/basic';

export default defineOriginalEngineV2App({
  build() {
    return new SizedBox(160, 80, new ColoredBox({ color: 0xff2468ac }));
  },
});
```

Supported render configuration currently covers ConstrainedBox, Padding, default ColoredBox, Align/Center alignment and size factors, Flex sizing/spacing/Expanded/overflow clipping with RTL/up directions, and non-positioned Stack with loose/passthrough/expand sizing, numeric alignment and none/hardEdge clipping. Unbounded Flex main constraints are connected when there are no flexible children. Unported settings such as baseline alignment, positioned children and anti-alias clipping, other render objects, instance hooks, pointer/semantics callbacks and unavailable App services fail explicitly. Full Text, controller and design API compatibility remains unfinished.

Plain `Text` uses the provider's font cohort for LTR/RTL, start/end/left/right/center/justify alignment, locale, wrapping, maxLines, ellipsis and manual soft hyphens. Paragraph configuration also supports hidden hyphens. Size, color, scaling, `DefaultTextStyle`, paragraph height, signed spacing, leading/height behavior, tight/loose sizing, basic text semantics and clip/visible overflow are connected. Weights 100–900 and a single `fontFamily` request are forwarded. Native selects from available installed and bundled fonts; Web selects from declared provider fonts with bundled fallbacks. The same family request may select different actual fonts depending on the supplied cohort. `CupertinoSystemText` uses the bundled cohort. Web caches at most 16 varied typefaces and releases them under pressure. Custom fonts/fontId, fonts from other App services, fontFamilyFallback, rich spans, italic, strut and additional styles remain unfinished. Synchronous text service queries fail explicitly.

`ClipRect` from `framework/widgets/basic` and affine `Transform` (including translate, rotate, scale and flip) use C++ layout and published frame geometry. Content resolves origin and directional alignment against the final size, including after resize. Singular transforms suppress the child. Perspective/3D matrices, non-null `filterQuality` and `transformHitTests: false` currently fail explicitly.

The separate `framework/widgets/clip` API supports default `ClipRect`, `ClipRRect`, `ClipOval` and `ClipPath`, all four clip behaviors, and directional elliptical corner radii. `ClipPath` uses its default rectangle. Custom clippers fail before App clip queries run. Default rect/rrect/path widgets hit their proxy rectangle; `ClipOval` retains its ellipse for hit testing with `Clip.none`, matching the original API.

Original `ListView` and `ListView.builder` from `framework/widgets/scroll-view` connect to the C++ lazy list for vertical fixed `itemExtent`, a finite item count and `childPolicy: { mode: 'bounded' }`. They retain the original `ScrollController`, position, synchronous listeners and default delegate key/keep-alive/repaint/semantic-index wrappers. Distant `jumpTo` calls use a native seek followed by the exact pixel offset. `animateTo` supports `Curves.linear` within prepared content, up to 1,900ms, and completes on the native terminal event. Replacing the controller retains the same position and scroll offset, including transfers to and from the internal controller, and runs the original attach/detach callbacks. Variable extents, reverse, padding, restoration, custom physics and full keyboard/reader behavior remain unfinished. Overall API compatibility remains `partial`.

Original `GestureDetector` from `framework/widgets/gesture-detector` connects tap down/up/move/cancel, `onTap`, `onDoubleTap`, primary long-press callbacks and pan/horizontal/vertical drag callbacks to C++. Callbacks receive the canonical `Tap*Details`, `LongPress*Details` and `Drag*Details` objects. C++ computes global/local positions, deltas, timestamps and end velocities; `dragStartBehavior` and `onlyAcceptDragOnThreshold` are supported. A pressed-state `setState` and its native ACK preserve the capture for the same input's up/cancel. Callbacks and State run on App.

Default/opaque/translucent hit configuration and tap/long-press semantic actions are connected. Secondary buttons, double-tap details, scale/force, custom settings, device filters, combined pan and directional drag recognizers, and the full nested arena/overflow ancestor hit contract remain unported. Unsupported options fail explicitly. Overall compatibility remains `partial`.

Canonical `CupertinoButton`, `filled` and `tinted` from `@nelyx/cupertino/button` retain the existing theme, ControlInteraction, WidgetStatesController and FocusNode. Tap/long press, hover state, disabling, basic semantics and Tab/Enter activation are connected. Basic background decoration, uniform rounded corners and Opacity layers run in C++. Canonical `AnimationController` and post-frame callbacks advance from requested host frame timestamps; native frames do not wait for App callbacks. Direct `OriginalWidgetHost` embedders must provide `platform` or configure canonical `FoundationPlatform` first. The original SDK app entry configures the Native/browser environment. OS cursor shape changes, the full focus/shortcut/semantics contract, complex decoration and the full Material/Cupertino API remain unfinished.

Web treats the canvas and its owned semantic DOM peers as one input surface. Hover survives pointer-capture handoff and exits when the pointer leaves that surface. The representative browser integration covers button activation, hover, actual opacity pixels and resource drain in both single-worker and threaded profiles.

State values change immediately on App and retain their desired values after a native NACK. The existing native scene remains intact; inactive Elements finalize after a known native ACK or terminal close. Original RenderBox synchronous geometry remains unavailable: TS layout/query/hit-test calls fail explicitly. `context.view.layoutSnapshot()` asynchronously returns the last activated layout with parent-local coordinates and document/metrics epochs. Composed transforms and property overlays belong to the published frame's geometry. Execution reports `appModel: 'original-elements'`, `compatibility: 'partial'` and actual native ACK counts.

`BuildContext.services.readMetrics('logicalWidth', 'scale')` returns an immutable observation of the last Core viewport received by App. Observed resize and scale changes rebuild Elements that read the changed fields; omitting fields subscribes to all metrics. Physical sizes use the provider's pixel rounding. Unavailable native context/surface generations remain `null`. The observed viewport revision can differ from the activated layout revision; it does not provide synchronous RenderBox geometry.


Canonical Material `TextButton`, `FilledButton`/tonal, `OutlinedButton` and `ElevatedButton` retain their source theme, State and controllers. Default rrect/stadium/circle shapes, borders, physical shadows, highlights and InkRipple use C++ geometry with Native/Web painting. Active pointer up/cancel survives App document replacement with unchanged target/ancestor geometry within an eight-publication bound. Basic activation, disabling, hover, Enter and actual animation output were verified on Windows App SDK and both Web profiles. Padded tap targets, custom shapes/rectangles, other ink factories and the full design API remain unfinished. See the [current implementation record](../../work9-3.md#현재-구현검증과-잔여-작업).

Canonical boolean/tristate `Checkbox` and `Radio`/`RadioGroup` retain source State, themes, Toggleable motion and group callbacks. C++ resolves marks, box insets, circle centers and radii. Both Web profiles cover click, Enter/Space, disabled state, the three-state cycle, Radio deselection, arrow navigation, group Tab/Shift+Tab, ARIA and actual output. Nonvisual Windows UIA checks cover mixed state and Radio SelectionItem/group Selection. Current Native selection/focus display and user input, UIA toggleable deselection and the full selection API remain unfinished or unverified. See the [current scope and remaining work](../../work9-3.md#현재-구현검증과-잔여-작업).

Original FocusNode and Actions/Shortcuts stay in the App tree. C++ associates focus owners with semantic peers and rejects stale requests using exact focus sessions. FocusNode rect/offset/size read C++ geometry for the currently observed published document, metrics and device; missing or known-stale publication fails. Arbitrary RenderBox synchronous layout/geometry and full API compatibility remain unavailable. Tests cover source shortcuts such as Control+K on Web and callback order, GlobalKey moves and key down/repeat/up in nonvisual Native integration. Complete scan/layout/raw keyboard, character/IME and reader contracts remain unfinished.

## Application APIs

Import exact subpaths from `@nelyx/sdk`. Supported target names are `windows`, `android`, `ios`, `macos`, `linux`, and `web`.

| Module | Purpose |
| --- | --- |
| `platforms/<target>/application` | Compose the shared application with a backend |
| `platforms/<target>/surface` | Present the application surface |
| `platforms/<native-target>/controls` | Native control integration |
| `runtime/config` | Read and validate application configuration |
| `runtime/assets` | Load and validate configured assets |
| `runtime/providers` | Resolve provider profiles and runtime requirements |
| `runtime/plugin-port` | Connect application-owned platform plugins |
| `runtime/worker-messages` | Connect an explicit background message endpoint |

Public exports are listed in [package.json](package.json). The [Web surface component](../../sample/nelyx-testbed-app-2/web/runner/App.tsx) shows how the runner connects `main().definition` to `ApplicationSurface`.

Windows `ApplicationSurface` defaults to `windowsSurfaceStatusMode="lifecycle"`: it receives the first valid update of each backing and lifecycle transitions. It requires surface-status protocol 1, so resupply and rebuild the native host together with the SDK. Public `SkiaGraphiteView` keeps continuous callbacks by default. `ApplicationSurface` also accepts `windowsSurfaceStatusMode="continuous"` for delivery comparisons; surface callbacks acknowledge native updates, not display scanout.

RN `ApplicationSurface` offers experimental `nativeInputGeometry="retained"` for C++ editor-coordinate preparation. Omit it or pass `false` for the default TS path; `'snapshot'` selects the older independent candidate. Choose once per mounted owner and remount to switch. Custom render hooks retain TS behavior. This option does not enable a native hit-test index. Supply matching rebuilt native inputs, renderer and SDK; current runtime validation is limited to Windows. Performance adoption is recorded in the repository's [work5.md](../../history/26/11/03/work5-summary.md).

Explicit C++ service requests fail startup when their native capability is missing. Windows launches report selected candidates, native geometry commits and TS fallback reasons separately. Repository cadence checks require matching SDK/native counts and at least 95% native coverage for the warm Mixed comparison; choosing an option or finding its API is insufficient. See `npm.cmd run test:retained-input-geometry` for the actual Gallery → Mixed regression and activation failure cases.

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

- Declare fonts and images in `nelyx.assets`, with stable IDs referenced by the application.
- Include the license file through `notice.path`; packaging carries declared notices with the assets.
- Optional `sha256` values pin bytes explicitly. Otherwise tooling calculates hashes in generated runner metadata.
- `packageSource` copies exported package assets and notices into the application. Existing edited files are preserved and reported as conflicts.
- Add literal asset `require` entries where the runner's Metro asset map requires them.

Font changes require refreshing package supply and rebuilding the native application. The [Metro guide](tooling/metro/README.md) explains asset preparation.

## Platform services

The application receives its platform services through SDK startup/View contexts. Services include clipboard operations, environment and locale observation, platform messaging, and editing/semantics integration. Unsupported or denied OS operations report typed platform errors.

Platform message endpoints belong to the application. A background connection uses an endpoint supplied by the host; creating a Worker or native worker runtime is the host's responsibility. Await connection disposal before terminating its worker.

## Ownership and lifecycle

| Owner | Responsibility |
| --- | --- |
| Core | Widgets, state, layout, hit testing, and logical semantics |
| SDK TypeScript | Backend composition, input, assets, services, and View lifetime |
| SDK native host | VM/bootstrap, windows, event loop, and application close |
| Skia packages | Rendering, paragraphs, images, GPU submission, and retirement |
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
