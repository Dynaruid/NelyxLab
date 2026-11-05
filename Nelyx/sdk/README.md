# Nelyx SDK

**English** | [한국어](README.ko.md)

`@nelyx/sdk` connects the [Core framework](../README.md) to platform applications, rendering surfaces, input, assets, OS services, and host lifetime. Shared application code stays in `src/`; each platform runner supplies registration and build configuration.

Start with the [Testbed guide](../../sample/nelyx-testbed-app-2/README.md) for a complete application or the [CLI](tooling/cli/README.md) to create a new one.

## Experimental v2 packet port

`@nelyx/sdk/engine-v2` exports `connectEngineV2Host(host, options)`. Supply a v2 packet transport with an `identity` containing `engine: 'v2'`, `abiMajor`, and `schema`. The facade checks bundle/host identity, then the C++ handshake checks requested capabilities. The [Core v2 guide](../README.md#experimental-v2-engine-protocol) covers build commands, ACK retry, activation, and close/drain.

`createBrowserEngineV2Surface(canvas, { root: new URL('/engine/', location.href), profile: 'auto' })` connects the supplied worker runtime to a fresh canvas. Serve the whole current engine dist at `root`. The returned surface provides a packet host, an App port, diagnostics, and asynchronous `close()`. The Main thread forwards bounded input and viewport updates; C++ owns scene coordinates, scrolling, and hit-testing. `auto` selects threaded when isolation/shared memory is available and single-worker otherwise. A missing explicit capability or broken supply fails startup; it does not enable a v1 fallback. Close drains providers and workers, and a new session requires a new canvas.

The standalone Windows host and both Web profiles run the Testbed with v2 Widgets/State/Keys, C++ layout and intrinsic/dry queries, editing documents and semantics. Browser surfaces install a `dom-textarea/aria` input carrier and peers using published geometry; App edit/focus/action requests share the Main input queue. App ports admit 24 requests/3 MiB, reserving the rest of the total 32 requests/4 MiB for Main input. Windows connects real TSF contexts and UIA Fragment/Value/Text/Invoke on its STA UI owner. The [Core guide](../README.md#experimental-v2-engine-protocol) covers build/run commands and APIs. Full Widget/Material/Cupertino, gesture and Android migration, physical IME/reader and performance remain PARTIAL; see the [work8 execution record](../../history/26/11/04/work8-2-summary.md#이번-작업의-구현검증-현황) and [active work9 plan](../../work9.md).

### General v2 projects

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

Build output defaults to `dist/v2-web` or `dist/v2-windows`. Use `--target windows` for the standalone Hermes/Skia HWND host. `dev` builds and runs, including a custom `--output`. `doctor` verifies the selected supplier; `prepare` builds the App bundle. `pack --engine v2 --target web` creates `dist/v2-web-package`, including the verified engine supplier. `run --engine v2 --target web --package dist/v2-web-package` runs that portable package. The server exposes `/isolated/` for automatic threaded selection and `/plain/` for the functional single-worker profile. Android, Apple and Linux v2 hosts are not supplied.

Build and launch verify Core/host ABI, protocol schema, supplier source identity and every declared file hash. Asset names and file paths stay within their declared roots; aggregate App assets are limited to 32 MiB. A failed build preserves the previous bundle. Package output includes the current supplier, its licenses and the application; it requires no Testbed entry or repository asset lookup. Generated projects include a pinned TypeScript compiler in their own dev dependencies.

Import Widgets from `@nelyx/core/v2`, `@nelyx/material/v2` and `@nelyx/cupertino/v2`. Canonical foundation values/notifiers/keys, physics calculations, curves, selected geometry/painting values and Material colors can retain their original public imports. The runner records selected imports in `routing`, checks all four packages' actual input files, and rejects unported implementations and foreign Core copies even through direct paths. App-ready reports `execution` with native ACK counters and rejected fallback reasons; the previous constant fallback count is removed. This admission does not establish full legacy Widget/constructor/behavior compatibility. The [active work9 API plan](../../work9-2.md#8-기존-공개-api-호환-작업) carries the compatibility gate forward; [work8 evidence](../../history/26/11/05/work8-2a-summary.md#현재-구현-현황) records the closure boundary.

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
