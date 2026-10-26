# Nelyx SDK

**English** | [한국어](README.ko.md)

`@nelyx/sdk` connects the [Core framework](../README.md) to platform applications, rendering surfaces, input, assets, OS services, and host lifetime. Shared application code stays in `src/`; each platform runner supplies registration and build configuration.

Start with the [Testbed guide](../../sample/nelyx-testbed-app-2/README.md) for a complete application or the [CLI](tooling/cli/README.md) to create a new one.

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
