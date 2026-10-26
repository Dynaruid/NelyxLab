# Windows Skia binding

Windows device/session/renderer, JSI, native components, and surface implementation for [`@nelyx/skia-rn`](../../README.md).

## Ownership

The binding owns GPU and surface resources. The SDK's native Windows host owns app bootstrap, development bundle selection, and shutdown policy. Skia does not import the SDK.

Provider cohort, GPU readiness, owner generation, and shutdown drain checks apply to the native path.

The current View advertises framePipelineVersion2, pointerVersion1, keyboardVersion2 and visibilityVersion1.
It observes key/character/focus callbacks from the owning canvas or registered Core
semantics proxies, with one sequence and native View generation. The default SDK
uses nonvisual TSF input and Core-painted editors. Standalone queued characters
retain their actual native observation; consumed TSF key releases are fenced by
the observed down and focus generation.

The SDK host supplies actual AppWindow visibility and minimization to the native
session. Each View retains its backing while hidden, rejects new presentation and
pointer/key admission, and emits visibility to stop Core scheduling. Resuming
requests a current Core frame. View shutdown removes its visibility observer;
normal host drain rejects outstanding observers. Matching native host/View and
SDK visibility protocol1 are required. This does not qualify physical display
latency, GPU loss recovery or reader behavior.

The React context owns an observed keyboard registry shared by its focused canvas
and the RNSkiaModule `getKeyboardState` method. The method posts to the UI dispatcher
and returns protocol1 actual key/scan observations; it does not poll globally held
OS keys. Owner transfer, bounded snapshots and module retirement are explicit.
The SDK maps records and exposes the optional StandardMethodCodec startup method.

## Frame execution and timing

The UI owner prepares a shared texture slot and publishes a completed native packet. One session worker replays native recordings and waits for Vulkan producer and D3D consumer completion. The GPU context lock protects Graphite access and is released during the producer fence wait. Packets contain native recordings, textures, fences and dispatcher tokens; JSI values and callbacks remain on their owners. The explicit copy/readback observer uses the synchronous diagnostic path.

CPU preparation remains limited to one frame and native recording lifetimes to two per target. A surface has one reusable producer slot and reuses it only after its consumer fence retires. Submitted uploads execute even if their visual update is superseded. Existing 4096px, 64MiB logical target and native allocation limits remain; these are separate budgets, not a measurement of total driver memory or an expansion of 4K/multiple-View qualification.

`nelyxReserveEpoch` captures the native surface generation and immutable target dimensions. `nelyxSubmitFrame` attaches Core owner/viewport/frame/input identity and timing. The fixed 256-entry numeric `drainFrameTrace` ring separates submission, producer completion, surface update, retirement, superseded visual, failure, layout request and layout admission. Layout observations have their own increasing revision, including A-B-A changes. A surface update is not physical display confirmation. Native input timestamps are QPC receive times; the SDK calibrates them into its JS monotonic domain and preserves raw OS observations separately.

Live resize admits one immutable layout epoch and keeps only the latest pending request. After the active surface update retires, the next admission uses that latest request. The native visual can scale its previous front for continuity while the exact requested content is pending. Pointer coordinates and TSF/semantics geometry are unavailable while the actual layout and admitted epoch differ; keyboard/document lifetime remains independent of GPU credit. Published frame identities retain the epoch that produced their pixels.

Precision trackpad contact, fractional pan/scale, framework momentum and inertia cancellation use DirectManipulation on the actual input HWND. An unavailable viewport retains the OS wheel fallback. Duplicate suppression requires both a touchpad source and a currently owned precision stream. Physical trackpad/scanout qualification remains separate.

## Build and supply

Use the exact RNW 0.83.2 / JSI21 x64 Release/MD inputs and the recipe in the [Skia supply guide](../../../../README.md#windows-native-inputs). Consumer registration and commands are documented in the [Windows sample guide](../../../../../../sample/nelyx-testbed-app-2/README.md#windows).

The stock RNW Core remains the default. Private unload patches are preserved separately. Full reload/loss recovery and platform qualification remain `notVerified`; a successful native compile does not establish GPU presentation or physical input acceptance.
