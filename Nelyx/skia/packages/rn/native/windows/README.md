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

The UI owner prepares a shared texture slot and publishes a completed native packet. One session worker replays native recordings and waits for Vulkan producer and D3D consumer completion. The GPU context lock protects Graphite access and is released during the producer fence wait. Packets contain native recordings, textures, fences and dispatcher tokens; JSI values and callbacks remain on their owners. An optional copy observer runs on the UI owner after native retirement for asynchronous frames; the synchronous diagnostic path also supports it. Pixel readback can add substantial diagnostic overhead.

CPU preparation remains limited to one frame and native recording lifetimes to two per target. A surface has one reusable producer slot and reuses it only after its consumer fence retires. Submitted uploads execute even if their visual update is superseded. Existing 4096px, 64MiB logical target and native allocation limits remain; these are separate budgets, not a measurement of total driver memory or an expansion of 4K/multiple-View qualification.

`nelyxReserveEpoch` captures the native surface generation and immutable target dimensions. `nelyxSubmitFrame` attaches Core owner/viewport/frame/input identity and timing. The fixed 256-entry numeric `drainFrameTrace` ring separates submission, producer completion, surface update, retirement, superseded visual, failure, layout request and layout admission. Layout observations have their own increasing revision, including A-B-A changes. A surface update is not physical display confirmation. Native input timestamps are QPC receive times; the SDK calibrates them into its JS monotonic domain and preserves raw OS observations separately.

Interactive resize prepares the proposed client extent inside `WM_SIZING`, before USER32 commits the new window rectangle. The host owns RNW Arrange and disables RNW's independent AppWindow layout callback. A full-window SDK `ApplicationSurface` declares `windowViewport`; the native host then supplies its canonical physical extent and DPI synchronously, without waiting for Fabric/Yoga mount delivery. Late Fabric layout cannot overwrite that declared viewport. Embedded surfaces leave this option unset and use Fabric layout. Readiness requires an actual request from a live declared window surface, preventing an empty pending set from being accepted as a rendered resize.

The HWND thread uses a 100ms frame-preparation rendezvous that pumps only the native Skia mailbox; it does not pump Win32/RNW messages or run raster work. `WindowsReactApp` creates a Composition-owned Win32 HWND and attaches RNW through its public AppWindow/ReactNativeWindow APIs, with an explicit [CompositorController](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.composition.core.compositorcontroller) for RNW's tree.

Declared full-window canvases present through a native [topmost DirectComposition target](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createtargetforhwnd) on that HWND. Their copied IDCompositionSurface and visual belong to the same native composition device and use the existing D3D device. This avoids publishing Skia pixels through the independently composed RNW child window. An empty brush occupies its RNW canvas visual. Because the native target is outside ContentIsland's visual input tree, the host observes client pointer/wheel messages on its own top-level and bridge HWNDs, maps their coordinates to that same window viewport, and owns mouse capture/cancellation until release or retirement. Keyboard, TSF and UIA retain their RNW island owners. Embedded canvases retain the WinUI drawing-surface/brush path and component-routed pointers. Full-window ownership is fixed while bound; remount before changing it, and mount it at the untransformed window client origin.

After proposed-frame copy retirement, the HWND thread waits up to 32ms for the [compositor clock](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-dcompositionwaitforcompositorclock) before allowing USER32 geometry and the native commit to proceed together. Trace stage 13 records the native status and elapsed microseconds. Unavailable, occluded and timed-out clocks still release the HWND through the actual-size path; this phase alignment is separate from displayed-pixel evidence.

Every interactive edge reserves an off-tree copied surface until entry to `WM_WINDOWPOSCHANGED` confirms the actual extent. It then publishes the candidate, submits the native composition batch, waits for [native commit processing](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-waitforcommitcompletion) and crosses a DwmFlush boundary before default window processing. Native commit completion does not require the HWND dispatcher. It and DwmFlush are separate from matching displayed-frame receipts; preparation deadlines do not bound those OS composition calls. GPU copy retirement is confirmed before this step. A cancelled proposal releases its candidate only after GPU retirement. Preparation timeouts are explicitly reported and recover through the actual-size path; they do not qualify as exact resize completion. The native root visual disconnects before view retirement and its surface, target and device references retire with their owning window/device.

The top-level HWND is created with [WS_EX_NOREDIRECTIONBITMAP](https://learn.microsoft.com/en-us/windows/win32/winmsg/extended-window-styles), since Composition supplies its client pixels. This avoids a separate USER32 redirection bitmap being resized independently of the prepared content. Its class requests full redraw on size changes, and the host sets SWP_NOCOPYBITS instead of preserving an old client bitmap.

The [DesktopChildSiteBridge size policy](https://learn.microsoft.com/en-us/windows/windows-app-sdk/api/winrt/microsoft.ui.content.desktopchildsitebridge.resizepolicy?view=windows-app-sdk-1.8) is also controlled by the host. Its HWND retains capacity for the attached monitor's work area, growing only when a requested client exceeds that capacity. The parent clips it to the exact visible client, avoiding repeated child-HWND redirection resizes. Window teardown releases the bridge; Skia textures, recorded layouts and published frames still use their exact requested dimensions.

Presentation uses top-left, one-to-one pixels, with no stretching, nine-grid padding or background fill. New-size surfaces replace the front only after EndDraw; interactive candidates also wait for native copy retirement and geometry approval. Ordinary asynchronous updates retain one immutable layout epoch and the latest pending request. Core reuses static semantic configurations while refreshing bounds, clipping and transforms. Apps opting into semanticsUpdateInterval also coalesce size-only accessibility geometry until resizing is quiet; content, child membership, scroll-action availability, focus, input geometry, DPI and environment changes publish immediately. A deferred accessibility action requests a fresh snapshot before dispatch. Pointer coordinates and TSF/semantics geometry remain unavailable while actual layout and the presented epoch differ. Keyboard/document lifetime stays independent of GPU credit, and published frame identities retain the epoch that produced their pixels.

Precision trackpad contact, fractional pan/scale, framework momentum and inertia cancellation use DirectManipulation on the actual input HWND. An unavailable viewport retains the OS wheel fallback. Duplicate suppression requires both a touchpad source and a currently owned precision stream. Physical trackpad/scanout qualification remains separate.

## Build and supply

Use the exact RNW 0.83.2 / JSI21 x64 Release/MD inputs and the recipe in the [Skia supply guide](../../../../README.md#windows-native-inputs). Consumer registration and commands are documented in the [Windows sample guide](../../../../../../sample/nelyx-testbed-app-2/README.md#windows).

The stock RNW Core remains the default. Private unload patches are preserved separately. Full reload/loss recovery and platform qualification remain `notVerified`; a successful native compile does not establish GPU presentation or physical input acceptance.
