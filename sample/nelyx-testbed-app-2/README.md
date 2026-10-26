# Nelyx Material · Cupertino Testbed

To compare accessibility update/rendering costs on Windows, add `-DisableAccessibility` to `start-windows-static-aot.ps1` (include `-RefreshSdk` for the first run after SDK changes). The default is enabled. The disabled build skips semantics tree creation/update/publication, accessibility actions/announcements and OS accessibility preference observation while keeping rendering, pointer/keyboard handling and editing/IME active. Rebuild without the switch to return to the app default. Keep the same engine, build mode and input sequence for both runs; the switch itself does not measure performance.

In either Text inputs page, enter several short lines in the message, then use Scroll to top / Scroll to end. These buttons use the public TextField scrollController and move the actual Core paragraph without changing text or selection. Wheel and vertical touch gestures scroll an overflowing message; at its boundary the enclosing page can scroll. Single/multiple-line policy changes keep the same controller. Core offset restoration has separate Root coverage; design text/controller and actual process recreation qualification remain open.

Use Disable selection / Enable selection beside the message controls in either Text inputs page. The same controller, text and selection survive the toggle. Disabled selection still focuses on a tap; Ctrl+A and clipboard shortcuts leave the value unchanged. Reenable selection to use Core handles, toolbar and shortcuts. Cut applies immediately; paste uses the current selection when clipboard data arrives. Same-text selection during observed composition retains its OS range. Advanced text services, new active-composition values and full restoration remain W14 work.

[한국어 및 실행 방법](README.ko.md)

A Nelyx Testbed app inspired by the Components page in DorotiTestbedApp. Seven categories retain the reference order of 29 sections. Twelve demos use the current Material components, two expose their current basic APIs, and fifteen sections are explicitly marked as planned. The gallery includes category navigation, four seed colors, light/dark themes, and one or two independently scrolling columns. Scroll continuously through the selected catalog; **준비 중 포함** includes planned sections. Text inputs alone uses the full width. In All, its editor section stays with the primary scroll owner across column changes. Ordinary sections are lazy; mounted editor/Form sections stay alive outside the viewport and retire when removed by a category/design change. Screen-owned values and message controllers survive navigation.

Open **Cupertino** from Material and return with **Material 3**. The Cupertino page has six categories and twenty continuously scrolling sections: seven component demos, three basic API demos, and ten planned sections. It uses the actual Cupertino App, scaffold/bar, buttons, activity indicator, lists, controls, text field, dialog and icon font. Themes, accents, selected values and text survive design-page changes. The previous App/editor tree retires before the next design mounts.

This is the common implementation and integration app for [W14](../../history/26/10/22/work14-summary.md). Each feature batch implements its product owner, consumes its public API in this app, verifies the relevant input/error/cancel/restore/disposal flows, and updates the guide and plan. `ready` means a demo is available; `basic` means a limited product API demo; `planned` means no demo yet. None of these labels proves family or plan completion. Complete Cupertino editing/restoration, full modal actions, large-title/tabs and the planned families remain W14 work.

Cupertino → Text inputs uses the Stateful CupertinoTextField with rounded decoration, prefix, a 20-grapheme limit, 1–3 lines, clear and Undo. Enter inserts a newline; Ctrl/Meta+Enter submits. CupertinoTextFormFieldRow consumes public Form section/row, name/email validation, Next/Done, save and reset. Message content survives navigation; the page owns and retires the contact form. Advanced editing/restoration, remaining OS input providers and physical IME/caret qualification remain open. The selected Android font regression has the scope described below.

Run `npm run check --workspace @nelyx/testbed-2` and `npm test --workspace @nelyx/testbed-2` for types and real Root integration flows. The latter covers controls, dialogs, image decoding, design/theme/viewport changes, retained editors and resource disposal with a host IO fixture; actual OS IME and native execution require separate verification.

In Cupertino → Navigation, open the named route, increment its counter and return a result (or use Back). The gallery retains its values; reopening creates a new route counter. Default Cupertino route transitions and keyboard focus use the product implementations.

Material → Text inputs now provides filled/outlined M3 fields, error feedback, a 20-grapheme limit, a Secure input/Show input toggle, clear/undo and name/email Form validation, save and reset. Enter Korean/emoji, commit composition, then change theme and width to inspect retained text/focus. Form editors retire when leaving the page; the upper message controllers remain screen-owned. Advanced editing/selection, Cupertino field/Form completion and current native font/physical IME/caret qualification remain W14 work.

The outlined message grows from two to four lines and scrolls internally after that. Enter inserts a line; Ctrl/Meta+Enter submits. Use one line / Use multiple lines changes its policy while retaining existing text and selection. Clear then Undo restores the message, including newlines. Core fixed/ranged/expanded layout has separate Root coverage; full advanced editing/selection and native font/physical IME/caret qualification remain open.

Both design fields expose Core outside-tap policy. Desktop/browser outside clicks release editing focus; native mobile touch preserves it. Theme, secure/line configuration and Undo controls use the public `TextFieldTapRegion` so editing and composition can continue. A custom `groupId` and `onTapOutside`/`onTapUpOutside` can select a different external-control group or override the default focus policy.

The root `package.json` is the application configuration source; `app.json`, `application.json`, `nelyx.config.ts` and root bootstrap files are unnecessary. Keep the npm package `name` separate from `nelyx.name`, which must match the native application registration name. `nelyx.displayName` retains the human-readable label. When adding bundled images (or fonts on Apple/Linux), add literal `require` entries to the runner main asset map so Metro includes their bytes. Windows maps all declared assets to host URIs; Android maps declared fonts to hash-qualified native asset URIs. CLI preparation still writes build-owned `runner/app-config.json` for native build tools; edit the root package configuration and rerun prepare to refresh it.

Asset and notice `sha256` fields are optional and are omitted from the starter configuration. Runner preparation, type checking and Metro startup calculate them from the current files and write portable runtime metadata to generated `runner/app-config.json`; they never add hashes to the root package. Each runner main validates that generated asset metadata before registration. Package assets are compared with their installed source bytes before copying, and existing edited destinations are preserved and rejected. Explicit hash pins, when supplied, are still checked.

## ListView page

Open **ListView** from the Material gallery header to browse 1,000 rows. Tap a row to select it and update the status below the list. The page provides first/last scrolling and clear selection controls, and inherits the gallery theme. Use the back button to return to the gallery; reopening starts with a fresh list selection and scroll position.

## Web

In Chrome, Core/Skia paints ordinary message text, selection, composing underline and caret; EditContext connects OS input and Core geometry. Try pointer/keyboard selection, long-text scrolling, theme/width changes, and clear during composition followed by Undo. Secure/autofill and EditContext-disabled paths use nonvisual input/textarea carriers. Their candidate-window geometry and precise composition range, remaining native provider migration and physical OS IME/reader qualification remain open.

After building the current Web runner, `npm run test:web-input` from the repository root checks real Chrome CDP input/composition events, Core character-bounds responses, theme/width changes, Next/submit/reset, clear during composition and Undo. It also checks a browser fallback without state-preserving DOM moves. The test needs the offline Playwright 1.64.0 cache and removes its temporary installation/profile/server in finally. This does not qualify physical OS keyboard/IME input.

`npm run test:web-catalog` checks the current Testbed's 29 Material and 20 Cupertino declarations through its real browser semantics tree, including the declared placeholders. It exercises button/list callbacks, Favorite selection, message counts, named-route return and state across design replacement. Planned entries remain placeholders; this check does not establish all control behavior, native execution or display timing. Its temporary Playwright installation, browser and server retire in finally.

From the repository root:

```powershell
npm ci
npm run build:sdk
npm run check --workspace @nelyx/testbed-2
npm run prepare:runner --workspace @nelyx/testbed-2 -- web
npm --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts
npm run build:web --workspace @nelyx/testbed-2
npm run dev:web --workspace @nelyx/testbed-2
```

The current TextField and Dialog APIs are labeled as basic. Unimplemented components are catalog entries, without substitute implementations. Windows/Android runners share the same application; their native toolchains and current supplied packages are required separately. See the Korean guide for target commands and source attribution. Source/type/Web results do not qualify native or physical-device execution.

The original Flutter BSD notice is retained in [LICENSE.flutter](LICENSE.flutter). The bundled Mae Mu / Unsplash photo is a 960×1440 WebP derivative of the reference image, sized for the codec resource budget. Noto Sans KR, Material Icons and Cupertino Icons notices are supplied with the assets. Cupertino demos directly compose the current Nelyx public APIs.

## Windows

Run all commands below from **PowerShell at the repository root**. On first use, or after SDK/native source changes, follow [Prepare Windows](#prepare-windows) first. Close the existing Testbed window before rebuilding the same output.

### Experimental direct Hermes host

After building and supplying the current SDK/Windows runner packages, run either mode from the repository root:

```powershell
node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode
node Nelyx/eng/run-native-hermes.mjs --hermes-mode static-aot
```

These commands prepare the pinned direct Hermes supplier and build the same application entry with the HWND/Skia/TSF/UIA host. They require Windows x64, the current pinned Skia inputs, VS C++ tools, LLVM and CMake/Ninja. Close the window before rebuilding its current package. The outputs are `.nelyx/native-windows/current-bytecode` and `current-static-aot` inside this app. For external apps, use the installed CLI's [`--host native-hermes` commands](../../Nelyx/sdk/tooling/cli/README.md#native-prerequisites).

RNW remains the default host and Hermes remains the default engine. The common native package owns rendering, text and JSI bindings; the direct host does not resolve the RN adapter. Direct-host performance, physical Korean IME/trackpad input and matching display acceptance remain open in the archived [W18 summary](../../history/26/10/25/work18-summary.md).

This Testbed also has a developer probe for programmatic ListView/catalog scrolling:

```powershell
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --scope diagnostic --catalog
node Nelyx/eng/run-native-scroll.mjs --hermes-mode static-aot --viewport maximized --scope gc --catalog
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --input os --scope cpu --viewport both --catalog
node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --scope cpu --viewport maximized --resource-cycles 6
```

`--resource-cycles 3..30` repeats the real app's ListView cold/revisit scrolls, first/last rows and return to the gallery after the programmatic diagnostic. It requires baseline Core producers, tree and drained native frame owners, and reports cache residency for every cycle. It does not impose a fixed cache size or identical tail residency; the chosen cache owner supplies its retention/release policy. Private process memory, GPU memory, physical input, display and full H4 acceptance remain separate.

A separate memory probe exercises the current delivered packages through UIA and guarded OS wheel input, without another JS entry or AOT image:

```powershell
node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode --build-only
node Nelyx/eng/run-native-hermes.mjs --hermes-mode static-aot --build-only
node Nelyx/eng/run-native-memory.mjs --hermes-mode both --viewport both --cycles 6
```

This attempts 24 route cycles across four fresh processes and stops at the first invalid observation. `--cycles` is bounded to 3..30 per process and at most 30 across one invocation. Each process reports private commit, working set, peak private commit and Vulkan allocation/import counters after returning to the gallery, including all samples and the final three-point changes. These measurements have no fixed global byte caps, plateau band or zero-growth requirement. W18 permits memory needed by the selected architecture; purpose, retention/release policy, actual performance and owner retirement are evaluated separately. Successful observation reports `assessment: observation-only` and `memoryAccepted: false`; it does not prove a leak or its absence. Signed/absolute native wheel volume, process identity, viewport and focus must remain valid. Input frame trace is enabled for memory observations; CPU performance qualification is separate. Vulkan allocator bytes do not establish GPU driver residency, physical input, display or full H4 acceptance. An invalid observation exits with code 1 after stopping its owned application. The probe stops its owned applications on success, failure or interruption and retains no log or temporary package.

The external client also reports bounded, read-only address-space scans and changes at new or previously observed allocation bases. These non-atomic scans do not identify allocation stacks or prove object lifetimes. MEM_PRIVATE region totals do not replace PSAPI private commit; raw addresses and process-memory dumps are not emitted.

Keep desktop input idle while its window is measuring. The probe rejects foreground/input intrusion and incomplete receipts, prints bounded CPU/checkpoint/heap/surface summaries, and removes its temporary entry and package on exit. Programmatic runs park the cursor on the owned title bar; keyboard messages, UIA actions, focus changes or unexpected desktop input invalidate a phase. `cpu`, `gc` and inclusive `diagnostic` spans are separate scopes; the latter distinguishes `Paint.record` from `Paint.compose`. Bytecode also supports `--scope sampling`: a separate 1,000 Hz Hermes PC profile mapped through its exact bundle source map. Its counts are observations, not milliseconds; `--details` prints all mapped stacks instead of the top eight functions. These programmatic diagnostics remain `diagnostic-only`: matching OS-input comparisons and physical display acceptance are still required.

`--input os` sends guarded Windows wheel input from a separate native thread and verifies its cookie, quantity, direction and Core-to-surface correspondence. It supports ListView and the complete Material/Cupertino catalog with `--scope cpu`. Catalog cold/revisit coverage joins each Core-visible section to the exact native surface content frame; fast runs report skipped sections. A separate bytecode `--scope sampling` diagnosis supports ListView. OS catalog sampling, GC and inclusive diagnostic combinations are rejected. Use `static-aot` for the other engine mode. `--viewport both` builds one diagnostic bundle, then measures fresh default and maximized processes in sequence. Frame callback/checkpoint and input-dispatch costs are reported separately. These runs remain diagnostic evidence; matching baseline, physical input and display acceptance are still required.

After building the current package, `node Nelyx/eng/run-native-uia-focus.mjs static-aot --product` tests its actual category button and editor with an external UIA client, verifies focus and closes the app. Use `bytecode` for the HBC package. This checks automated UIA behavior; physical Korean IME and screen-reader acceptance remain separate.

Add `--range` to `--product` to verify absolute UIA RangeValue requests on the actual Material/Cupertino sliders and both range-slider thumbs, including discrete values, thumb ordering, invalid values and disabled controls. [RangeValue setters may round to the control's supported values](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationcore/nf-uiautomationcore-irangevalueprovider-setvalue); the probe waits for the value published by Core.

Add `--pointer` to use OS mouse clicks for category navigation and editor focus, followed by the external UIA focus checks. `--product` also checks the recorded original code sources and owner package manifests against the current app and installed dependencies; rebuild the package when these inputs change.

### Choose an execution mode

| Purpose | Engine and execution | Configuration | Command |
|---|---|---|---|
| Normal use | Hermes · HBC99, optimized policy | Release | `start:windows:hermes` |
| V8 comparison | V8 · source JS bundle | Release | `start:windows:v8` |
| JavaScriptCore | JSC · source JS, JIT enabled | Release | `start:windows:jsc` |
| JavaScriptCore interpreter | JSC · source JS, code generation disabled | Release | `start:windows:jsc:interpreter` |
| Static Hermes AOT experiment | Hermes · native Metro root + selected type specialization | Release only | `start-windows-static-aot.ps1` below |
| Original Hermes compiler comparison | Hermes · bytecode, `debug`(`-Og`) | Release | `start:windows:hermes:debug` |
| Development session | Hermes · Metro | Debug | `dev` command below |
| Reopen the last build | Engine and mode recorded in the last package | Last build configuration | `run:windows` |

Normal builds select Hermes with the qualified `optimized` compiler policy. RNW remains the default host; V8/JSC are explicit choices. The Static Hermes AOT mode is `static-aot`, with build tooling `@nelyx/static-aot`. Use current supplied packages and rebuild after SDK/native changes.

**V8 (explicit comparison)**

```powershell
npm.cmd run start:windows:v8 --workspace "@nelyx/testbed-2"
```

**JavaScriptCore (Windows x64, JIT or interpreter)**

The existing launch script also accepts JSC. Prepare the Windows renderer first;
add `-RefreshSdk` after source changes to rebuild and install current packages.

```powershell
# Prepare, build and launch JSC with JIT
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode jit

# Prepare, build and launch JSC with its interpreter
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -Engine jsc -JscMode interpreter

# Once prepared, build and launch through npm
npm.cmd run start:windows:jsc --workspace "@nelyx/testbed-2"
npm.cmd run start:windows:jsc:interpreter --workspace "@nelyx/testbed-2"
```

Direct CLI builds use `--engine jsc --jsc-mode jit|interpreter`. JIT is the JSC
default. Both modes consume a JavaScript source bundle. The mode travels in the
verified package (`jsc-mode.txt`) and requires a fresh process. Interpreter mode
disables JS and regular-expression JIT and WebAssembly before VM creation; VM
admission checks the actual assembler state. JIT mode enables normal tiered JSC
execution; individual functions may still start in the interpreter.

The first preparation downloads pinned Playwright WebKit build 2272 / WebKit
26.4 and builds the RNW0.83.2 JSI21 host with Visual Studio C++ tools. It requires
20 GiB free space. Only the current reusable supplier is kept; download and
compiler trees are removed after preparation. JSC is Windows-only in this SDK;
the Hermes debugger/Metro development command remains a separate path. Engine
licenses and source links accompany the package. Hermes remains the app's
normal build default.

**Hermes bytecode (optimized profile)**

```powershell
npm.cmd run start:windows:hermes --workspace "@nelyx/testbed-2"
```

**Static Hermes AOT (experimental Windows x64 Release)**

Repeated builds cache Metro code together with frontend evidence. Unchanged AOT inputs, compiler/options and output DLL hashes skip native compilation; changed units rebuild independently. One current object/evidence cache is replaced in `.nelyx/windows/static-aot-cache`, outside the delivered package. Deleting it forces regeneration. First builds and changes to the whole app unit still pay for the large C translation unit at `-O3`. Use `-RefreshSdk` after SDK changes rather than on every launch.

Prepare the runner/native inputs first, then use the [launch script](./start-windows-static-aot.ps1). It prepares the Static Hermes AOT compiler/runtime, builds an `optimized` Release package and launches the app, stopping immediately if a step fails. Initial preparation builds the pinned compiler/runtime for reuse by later builds. It needs 20 GiB free space, Visual Studio C++ tools, LLVM clang/clang-cl, CMake and Ninja.

```powershell
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1

# Also rebuild the SDK, supply packages and reinstall the runner after source changes
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -RefreshSdk

# Compare with accessibility processing disabled
.\sample\nelyx-testbed-app-2\start-windows-static-aot.ps1 -RefreshSdk -DisableAccessibility
```

`-DisableAccessibility` passes `accessibilityEnabled: false` to this build, skipping accessibility tree work, publication, accessibility-only frame requests and OS preference observation while retaining normal input/IME. Rebuild without the switch to use the app default again. It changes no source files and restores an explicit caller `NELYX_ACCESSIBILITY_ENABLED=true|false` after success or failure. Missing or empty values are removed so repeated launches in the same PowerShell session cannot leave an invalid empty override. The switch also works with V8/JSC.

`-RefreshSdk` requires installed repository dependencies (`npm.cmd ci`). Add `-NativeInputs "C:\path\to\supplier\inputs.json"` to connect a renderer supplier, or `-EngineInputs "C:\path\to\toolchain"` to reuse a verified compiler/runtime. Both options can be combined with `-RefreshSdk`. If cache cleanup deleted the saved Static Hermes supplier directory, preparation rebuilds the compiler/runtime in the app's `.nelyx/windows/static-hermes-build` and updates the saved path only after success. This takes the same time as initial preparation. Existing supplier integrity failures and explicit `-EngineInputs` errors still fail the command. Relative input paths resolve from the caller's directory, and the script restores that working directory on exit.

The whole Metro graph compiles to native code in one VM. The automatic policy specializes checked scalar bodies, guards their arguments and retains ordinary JS operations for dynamic values, fields, getters and callbacks. Builds require complete source/body/native correspondence and policy evidence; missing coverage fails the build. The supplied AOT VM disables eval/JIT and rejects source or bytecode execution after native startup. Native functionality, diagnostics and performance have separate acceptance gates in [W15A summary](../../history/26/10/23/work15a-summary.md). `npm.cmd run inspect:static-aot-runtime` inspects the installed Release graph without building or launching a native package.

**Hermes bytecode (original `-Og` comparison)**

```powershell
npm.cmd run start:windows:hermes:debug --workspace "@nelyx/testbed-2"
```

To reopen the last built package, use the command below. It neither changes the engine nor rebuilds. The `build:windows*` commands only build; use `start:windows:*` or the following run command to open a window.

```powershell
npm.cmd run run:windows --workspace "@nelyx/testbed-2"
```

### Build and run options

Use the Windows runner's `build` command directly when changing options. The app's `build:windows` script selects Hermes `optimized`; use an engine-specific script or explicit runner options for V8/JSC and compiler comparisons. In PowerShell, use `npm.cmd` and `--` to pass options.

| Option | Commands | Values and purpose |
|---|---|---|
| `--engine` | `prepare:native`, `build` | `v8` or `hermes`. The runner CLI defaults to Hermes; the app's normal build script selects V8. |
| `--hermes-mode` | `prepare:native`, `build` | `bytecode` (default) or `static-aot`. Static AOT requires Hermes and Release. |
| `--hermes-profile` | `build` | `debug` (`-Og`) or `optimized`. The bytecode CLI defaults to `debug`; Static Hermes AOT requires `optimized`. |
| `--configuration` | `build` | `Release` (default) or `Debug`. Native Debug configuration is separate from the compiler's `debug` profile. |
| `--native-inputs` | `prepare:native`, `build` | Matching Skia/RNW `inputs.json`. Preparation remembers it for subsequent builds. |
| `--engine-inputs` | `prepare:native`, `build` | Verified V8 supplier or Static Hermes AOT compiler/runtime directory, separate from the renderer's `--native-inputs`. |
| `--package` | `run` | Run the specified package directory; omit to run the last built package. |

```powershell
# Build and run Hermes bytecode with native Debug configuration
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-mode bytecode --hermes-profile debug --configuration Debug
if ($LASTEXITCODE -eq 0) { npm.cmd run run:windows --workspace "@nelyx/testbed-2" }

# Explicitly open the fixed Release package instead of the last build
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run run -- --package ../../.nelyx/windows/packages/Release
```

`run` validates the package's recorded engine and mode; it does not accept engine switching options. Rebuild with the desired mode to switch engines. Relative `--package` paths resolve from the Windows runner directory. To select a GPU vendor, set `$env:NELYX_WINDOWS_GPU_VENDOR = '4098'` (AMD) before running; use `Remove-Item Env:NELYX_WINDOWS_GPU_VENDOR` to return to the default hardware adapter attached to the primary display.

### Development session

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run dev -- --port 8081
```

This starts the Hermes Metro/native Debug session. `--host` accepts `127.0.0.1` or `localhost`; `--port` defaults to 8081. Add `--launch false` to start Metro without launching the native app. Stop the session with Ctrl+C. V8 and Static Hermes AOT development refresh are unsupported.

The default Windows ApplicationSurface connects nonvisual TSF protocol3 input and Core UIA semantics protocol4. Core/Skia paints text, caret, selection and composing; close waits for native input retirement before releasing Core/GPU resources. It uses no visible editor/font registry. Resupply, install and rebuild the EXE after SDK/native changes.

### Prepare Windows

Use Visual Studio C++ tools, the Windows SDK and the matching x64 Release renderer supplier. See the [Skia supply guide](../../Nelyx/skia/README.md#windows-native-inputs). Supply current target packages, including Static Hermes AOT tooling, before installing the runner. Run `npm.cmd ci` at the repository root first if repository dependencies are not installed.

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- windows
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner install --ignore-scripts --workspaces=false
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --native-inputs "C:\path\to\supplier\inputs.json"
```

Replace the path with the current native supplier's actual `inputs.json`. Omit `--native-inputs` when a matching input is already prepared. Proceed only after each preparation/install step succeeds. Before the first V8 launch, prepare its supplier once with the following command, then use a launch command above. Static Hermes AOT uses its dedicated preparation command above.

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run prepare:native -- --engine v8
```

**This Testbed uses Hermes for Windows Release builds.** The normal `build:windows` command selects the qualified optimized HBC99 policy; `run:windows` executes the last built package. V8 remains available through its explicit script. Reuse a prepared V8 supplier with prepare’s `--engine-inputs <supplier-directory>`.

The default `optimized` HBC99 policy omits the reproduced loop/CFG failure pass and disables inlining. Packages record its exact flags and policy ID and reject a different VM supplier. Current Windows Release templates and CLI use that policy. For `-Og` comparison, run `npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine hermes --hermes-profile debug` from the root.

From the Windows runner, connect a native supplier with `npx --no-install nelyx prepare --app ../.. --target windows --native-inputs <inputs.json>` when required.

To prepare/build V8 directly, run `npx --no-install nelyx prepare --app ../.. --target windows --engine v8` from `windows/runner`, then run `npm.cmd --prefix sample/nelyx-testbed-app-2/windows/runner run build -- --engine v8` and the usual run command from the repository root. Preparation builds RNW 0.83.2 with native RN 0.83.4 and pinned Microsoft V8 24.1.10; `--engine-inputs <supplier-directory>` reuses a verified supplier. Its `rn-v8-graphite-vulkan` profile and `rn-0.83.10-v8` cohort use a source bundle. Close the current Release app before replacing it. V8's Hermes inspector and development refresh remain unsupported.

V8 preparation requires MSVC v145 and Windows SDK 10.0.26100.0. Use `npm.cmd` in PowerShell to preserve the option separator. The pinned C ABI microtask completion bit is adapted to RN JSI semantics; startup checks a real Promise chain, a host microtask and an empty queue. This adaptation is bounded to the [pinned upstream source](https://github.com/microsoft/v8-jsi/blob/c1877966a8285b7cbacbdd03e26ca003496436bc/src/jsi_abi/jsi_abi_v8.cpp#L1481).


Windows builds use fixed `.nelyx/windows/packages/Release/` and `Debug/` outputs without timestamps. A staged package is verified before replacing the same configuration and updating `last-package.json`; failure restores the previous package. Close an app running from that output before rebuilding. Staging and replacement backups are removed at exit. Successful builds also remove this app's old timestamped packages, retaining running ones until a later build after exit. The other fixed configuration, external outputs, foreign/modified packages and links are preserved; `cleanup.removed` and `cleanup.retained` report cleanup results.

Use the rebuilt Release runner when checking animation performance. Core batches canvas scopes, retains page and child recordings, and synchronizes only changed Element branches. Material progress phase/color ticks repaint their painter without rebuilding the widget tree. After changing Core or the design packages, run `npm run build:core` and `npm run build:designs` before the prepare/install/build steps above so the independent Windows runner receives the changes. `npm run test:paint-recording` covers recording budgets, transforms/clips, independent resource lifetime, repaint invalidation and progress listener retirement.

The host semantics tree stays enabled. Offset-only motion preserves semantic configurations while refreshing clipped bounds and visibility. The host-tree path skips unused engine packet encoding, validated immutable snapshots cross SDK boundaries without another copy, and unchanged metadata does not notify React. Actions still resolve the latest Core callback; changed bounds, focus, editing revisions and native surface stamps are published. After SDK changes, also run `npm run build --workspace @nelyx/sdk` before preparing the runner. `npm run test:semantics-updates` checks publication, retry and owner retirement; historical Windows results and remaining work are in [W14 summary](../../history/26/10/22/work14-summary.md).

The app sets `widgetApplication({semanticsUpdateInterval: 50, ...})` to coalesce motion-only accessibility updates until 50 ms after the previous publication, then publish the latest state on the next available host frame. Geometry-only AnimatedBuilder rebuilds also coalesce; rebuilds that invalidate semantic content, focus changes, input geometry and View/metrics changes bypass the interval. IME/caret/selection coordinates keep their frame contract. Actions from the pending snapshot request an earlier frame and execute once only if the same source is still enabled and visible in the fresh snapshot. Superseded actions stay revoked; pending work is cancelled when the View hides or closes. The Core default is `0` for immediate publication. The native fixture can compare `NELYX_ANIMATION_SEMANTICS_INTERVAL=0` and `50` with otherwise identical installed code; each phase reports its actual interval.

From the repository root, `npm run test:windows-animation` builds a temporary Release host using the installed Windows runner packages, the pinned V8 supplier and unminified source bundle and the actual gallery. It measures progress, scrolling, activity and route transitions at a verified 800×600 logical viewport (sized for the actual desktop DPI), verifies GPU/input retirement and deletes its temporary project. Reported native completion rates/intervals are not display scanout FPS. Use `NELYX_ANIMATION_MODE=cpu-timing` for minimal whole-frame CPU timing with per-method wrappers disabled. Set `NELYX_ANIMATION_TRACE=1` for CPU timing wrappers: `Frame.cpu` measures the complete RAF callback that builds a Core frame, and idle polls are separate. `NELYX_ANIMATION_DIAGNOSTIC=1` adds command counts and Hermes allocation/GC diagnostics; its overhead is included. `NELYX_ANIMATION_NATIVE_TRACE=1` separates native stages; adding `NELYX_ANIMATION_NATIVE_CORE_TRACE=1` compiles an isolated timing overlay from the exact installed Vulkan source. These diagnostics keep full rendering and accessibility enabled. Historical results and limits are in [W14 summary](../../history/26/10/22/work14-summary.md).

`NELYX_ANIMATION_WHEEL_INPUT=queued` feeds small deltas from an owned native queue through the actual SDK wheel adapter and Core without injecting OS mouse input. Keep this comparison workload separate from `WHEEL_INPUT=1`, OS/physical trackpad qualification and scanout FPS.

Set `NELYX_ANIMATION_RESIZE=1` for border dragging, 19 size changes across the gallery and native failure/close regression checks. This mode moves the pointer and requires the fixture window to acquire foreground activation with the physical mouse button released. Resize runs are functional checks, not fixed-size performance comparisons. UI task failures preserve their original message/HRESULT in the error and `NelyxWindowsHost.getStatus().uiFailure`. After a native failure, an explicit close exits with code 2 while retaining uncertain resources until process exit; normal close still requires confirmed GPU/input drain.

From the repository root, `node --test --test-timeout=1200000 Nelyx/eng/tests/windows-input-surface.test.mjs` builds a separate GPU fixture using the current runner packages and native supplier. The default is the public Hermes optimized/HBC99 path; `NELYX_WINDOWS_INPUT_ENGINE=v8` selects the explicit V8/source comparison. It requires foreground ownership and checks Core/TSF documents, OS scan codes, standalone WM_CHAR/Unicode VK_PACKET, caret screen bounds and GPU/input retirement, then removes its temporary project.

With a Korean keyboard layout already active, set `NELYX_WINDOWS_INPUT_IME=1` to include actual TSF composition/commit, active clear/Undo/Redo/reset, focus and resize. The fixture preserves the layout and restores its thread's original IME modes before closing. Default testbed provider/nonvisual UIA migration and physical IME/reader qualification remain W14 work.

## Android

Use JDK 21, Android SDK/build tools 36, NDK `27.1.12297006`, an x86_64 Vulkan emulator and the matching Skia Android 154.1.0 supply.

The current Windows setup builds with Temurin 21.0.11; its default GraalVM 21 fails the Android JDK image `jlink` step. Adjust the JDK path below to your installed standard OpenJDK 21.

```powershell
$env:JAVA_HOME='C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npm.cmd run prepare:runner --workspace @nelyx/testbed-2 -- android
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner install --workspaces=false --ignore-scripts
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner exec --no -- nelyx build --app sample/nelyx-testbed-app-2 --target android --architecture x86_64 --configuration Release
npm.cmd --prefix sample/nelyx-testbed-app-2/android/runner exec --no -- nelyx run --app sample/nelyx-testbed-app-2 --target android --device emulator-5554
```

Run these commands from the repository root. Replace `emulator-5554` with the serial shown by `adb devices -l`; CLI `run` installs and launches the registered Release APK. The JDK selection applies to the current PowerShell session and its child processes.

For temporary emulator checks, `-read-only -no-snapshot` keeps the session disposable; [Android documents that read-only guest disk changes are discarded on exit](https://developer.android.com/studio/releases/emulator). Activity startup/back checks remain separate from native drain, physical input and display timing acceptance.

Android uses a nonvisual View/BaseInputConnection protocol4 for OS input, including explicit withdrawal of unavailable Core geometry. Core/Skia paints the text, selection, composing underline and caret; Core also supplies the IME caret baseline and lazy UTF-16 character bounds. Gradle copies declared, hash-verified font bytes for the Skia loader; native editor font registration is no longer required. Font changes still require resupply, installation and an APK rebuild. Use a standard OpenJDK 21 distribution.

The Android Skia surface uses non-coalescing pointer protocol1, including actual MotionEvent history, so a busy JS frame cannot collapse a drag into one move. Use matching SDK/Skia RN archives and rebuild the native APK. Core gesture and admission regressions run with `npm run test:android-pointer`.

After building/installing the Debug APK, run the API26+ native input regression from `android`:

```powershell
.\gradlew.bat :app:assembleDebugAndroidTest -PreactNativeArchitectures=x86_64 --no-daemon --max-workers=2
adb -s <serial> install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s <serial> shell am instrument -w com.nelyxtestbed2.test/dev.nelyx.sdk.editing.InputConnectionInstrumentation
```

Require `status=PASS-scoped` in the output; `am instrument` can exit zero even for a failed assertion. This checks actual BaseInputConnection composition/commit, directional selection, invalid UTF-16 rollback, cancellation/autofill after real finish/close callbacks, Core supersession, retired/disabled input and readOnly, zero native View pixels and actual MotionEvent history/multitouch/cancel serialization. Application/Skia pixels, actual OS IME/keyboard interaction, readers and physical input/FPS require separate checks.

For the installed Debug app, select a prepared Vulkan emulator and run the application input flow below. Historical work and remaining qualifications are recorded in [W14](../../history/26/10/22/work14-summary.md); [W13](../../history/26/10/19/work13-summary.md) retains the earlier scoped results.

```powershell
$env:NELYX_ANDROID_TEST_SERIAL = 'emulator-5580'
npm run test:android-input
```

The test owns Metro and only its reverse-port mapping, and closes them in finally. It checks injected ASCII input, keyboard-sized viewport changes, clear/Undo, Next/Done, Form save/reset and values after design return. Physical IME/caret, readers and hardware FPS remain separate.

For the combined native gallery and OS editing/lifecycle check, set NELYX_ANIMATION_MODE=full-runtime-regression, NELYX_ANIMATION_ENGINE=hermes, NELYX_ANIMATION_HERMES_MODE=static-aot and NELYX_STATIC_HERMES_INPUTS to the verified supplier, then run npm run test:windows-animation from the repository root. This is a functional check and does not contribute timing samples. The Static AOT input-surface fixture also requires full-runtime native coverage and a zero-fallback VM audit; physical IME candidates and reader interaction remain separate.

### Grouped lazy children

`SliverChildGroupedDelegate` lets a normal `ListView.custom` declare independent lazy boundaries inside logical sections. It expands at most 4,096 descriptors and builds Widgets only when requested by the sliver. Group and child keys use `Key` equality; identical child keys in different groups stay distinct. `firstIndexOfGroup(key)` and `indexOfChild(groupKey, childKey)` return the current flat index.

```ts
import {ValueKey} from '@nelyx/core/foundation/key';
import {Text} from '@nelyx/core/framework/widgets/basic';
import {ListView} from '@nelyx/core/framework/widgets/scroll-view';
import {SliverChildGroupedDelegate} from '@nelyx/core/framework/widgets/scroll-delegate';

const childrenDelegate = new SliverChildGroupedDelegate([
  {key: new ValueKey('section-a'), children: [
    {key: new ValueKey('title'), builder: () => new Text('Section A')},
    {key: new ValueKey('body'), builder: () => new Text('Independent content')},
  ]},
]);
const list = ListView.custom({childrenDelegate});
```

A group is metadata; keep a shared Form, editor or Wrap layout inside one child when it needs one owner. Recreating the delegate rebuilds currently owned children and remaps their keys. Existing ListView cache and keep-alive behavior is unchanged. The galleries still use their current builders while the W16 engine acceptance gate is pending.

From the repository root, `npm run test:scroll-engine` checks the common engine and `node Nelyx/eng/tests/check-scroll-supply.mjs` checks the installed Windows Core consumer after package refresh. Run `node Nelyx/eng/tests/run-windows-scroll.mjs hermes 1` for optimized Release Hermes bytecode or use `static-aot` for Static Hermes. `matrix 3` runs both modes × default/maximized × three repetitions: 12 native runs per baseline or candidate supply. Run each supply separately for a before/after comparison. `v8` remains an explicit compatibility check. Both Hermes modes use the same qualified VM/GC supplier; the tool reports HBC/compiler, AOT, VM and host hashes. Set `$env:NELYX_SCROLL_DIAGNOSTIC='1'` for a separate, instrumented default-window `hermes 1` or `static-aot 1` run, excluded from performance acceptance; clear it afterward with `Remove-Item Env:NELYX_SCROLL_DIAGNOSTIC`. The tool enables accessibility, fixes the semantics interval at 50ms and restores the previous runner configuration. OS wheel injection requires the owned foreground window; activation occurs only at phase boundaries. Native surface completion does not establish physical trackpad or display timing acceptance. The last recorded results and remaining gates are in the archived [W18 summary](../../history/26/10/25/work18-summary.md).

A ListView with fixed `itemExtent` or an `extentIndex` can opt into `childPolicy: {mode: 'bounded', preparation: 'disabled'}`. The default `legacy` policy retains existing behavior. Optional retention shares budgets of 8 children per sliver and 16 children / 2,048 Elements per View, extending the same item State lifetime without pausing listeners or tickers. Explicit keep-alive requests remain separate. Explicit `cacheExtent`/`scrollCacheExtent`, shrink wrapping, general/varied/prototype lists and nested bounded owners are unsupported. Fixed and indexed section slivers accept the same `childPolicy`. Requesting `preparation: 'observed-budget'` leaves automatic preparation disabled on current hosts because they provide no observed deadline. Native acceptance for this opt-in path is tracked in [W16](../../history/26/10/24/work16-summary.md).

The default OS workload covers both complete gallery catalogs, including planned sections. Each column receives uninterrupted wheel input to its edge and a reverse revisit; every section must enter the viewport during cold and revisit phases. Fast traversal checks delivery and the edge, reporting skipped sections separately. The fixed ListView workload also measures each inserted item's creation through first layout. `$env:NELYX_SCROLL_CATALOG='bounded'` selects the former bounded-distance diagnostic workload, excluded from full-catalog acceptance. Supply validation checks all Core source/dist/package files. Only when deliberately retaining the pre-change installed baseline, set `NELYX_SCROLL_REFERENCE_CORE_DIGEST` to its exact reported installed digest.

Wheel pacing uses a high-resolution timer for every interval, charging guard and send work to the interval before waiting. Reports include the `high-resolution-relative-start-completion-v1` policy and actual send-completion interval p50/p95/max. Qualification rejects older pacing policies and missing or invalid actual intervals; a requested interval alone does not establish matching input conditions.

While using the desktop, add `$env:NELYX_SCROLL_INPUT='queued'` to the diagnostic settings to observe SDK queue delivery. All instrumented diagnostics use the bounded workload and are excluded from OS wheel performance. `$env:NELYX_SCROLL_AFTER_DIAGNOSTIC='1'` verifies hashes of the same HBC/AOT compiler output, prepares separate native diagnostic hosts, then runs native/JS/Core attribution once per mode in fresh processes after timing. An external helper observes sync JSI thread PCs and uses exact image hashes with PDB/native maps to report VM functions, AOT function ranges and source candidates. These observations include waits and thread suspension overhead; PC frequencies are not CPU-time shares or performance acceptance. Diagnostics are also attempted after a timing failure while retaining the first failure. Do not combine this setting with `NELYX_SCROLL_DIAGNOSTIC`. Injected calls and received events are reported separately; absolute/signed distance, native sequence continuity and dispatch correspondence must agree. Latency for combined native events starts at the received event timestamp. Clear used `NELYX_SCROLL_*` environment variables after qualification.

Diagnostic Hermes bytecode builds also generate an execution-owned Metro map. On a reported Core build failure, `SCROLL_FAILURE.javaScriptSymbols` links its stack to the original module and position before cleanup. Missing or unreadable symbols supplement the original failure; regular timing builds do not generate this diagnostic map. Native PC diagnostics require resolved symbols for the actual VM. For a separate JS/native-stage diagnostic without external PC collection, explicitly set `$env:NELYX_SCROLL_NATIVE_PC='0'` together with `NELYX_SCROLL_DIAGNOSTIC='1'`; clear it afterward. This scope reports `nativePc:false` and cannot qualify VM PC attribution. `SCROLL_RUN.lifecycle` preserves observed completion/normal-close markers even when later diagnostic processing fails.

Add `NELYX_SCROLL_AFTER_POLICY='1'` to `NELYX_SCROLL_AFTER_DIAGNOSTIC='1'` to reuse compiler output for maximized policy diagnostics in both modes. The fixture opts supported ListViews into bounded/observed-budget and checks actual retention hits, shared View bounds and normal teardown. Current Windows clocks advertise no observed deadline, so preparation passes must remain zero. Separate policy experiments can select `NELYX_SCROLL_CHILD_POLICY='bounded'` or `'observed-budget'`; these are distinct from G6 legacy measurements.

Set `$env:NELYX_SCROLL_WAIT_FOR_INPUT='1'` to finish building and wait at `SCROLL_INPUT_READY` for either OS input or the queued diagnostic. The queued diagnostic also brings its window to the foreground. Once the desktop is available, stop using the mouse and trackpad, then create the printed temporary `file` with `New-Item -ItemType File -Path '<path>'` to start the run. The full run has a 20-minute deadline including this wait, with time reserved for cleanup. The signal and candidate are deleted on completion, failure or interruption. Clear the environment variable afterward.
