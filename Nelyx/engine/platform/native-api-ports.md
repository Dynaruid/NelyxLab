# Native OS API source ports

W9B source/consumer inventory, 2026-11-09 KST. A selected source is **not a
completed port**. Windows public clipboard, keyboard modifier/lock queries,
canonical key/code mappings and Tooltip UIA notifications use modified upstream
implementations. Full keyboard layout qualification, pointer/IME/UIA provider and other rows remain W9B-03 and the
platform's W9-07/08/13 obligations. Linux and Apple remain DEFERRED.

## Pinned sources and availability

| Platform | Upstream and fixed source | Current source location / availability |
| --- | --- | --- |
| Windows | [RNW](https://github.com/microsoft/react-native-windows/tree/af0b597c18691c26d1e01a72d94edda46c1fab26/vnext), `react-native-windows@0.83.2`, tag `react-native-windows_v0.83.2`, commit `af0b597c18691c26d1e01a72d94edda46c1fab26` | Existing `sample/nelyx-testbed-app-2/windows/runner/node_modules/react-native-windows`. Clipboard, KeyboardUtils and AccessibilityInfo originals/adaptations, MIT license, hashes and npm integrity are owned in [windows/rnw/provenance.json](windows/rnw/provenance.json) and shipped with App SDK. Fixed Git originals match npm contents after CRLF normalization. No RNW runtime is linked. |
| Android / iOS | [RN](https://github.com/react/react-native/tree/ff4f96a23b85b30d8de9331dfac2895f385f67b0/packages/react-native), `react-native@0.83.10`, commit `ff4f96a23b85b30d8de9331dfac2895f385f67b0`, integrity `sha512-4gbmtAyfC0F4jU2hl/l/HZbRIfRl0d5RdHNpJLf7sT/0zhYDEhiFcFk7ii2utl7O8BIHRUmGe/anfWP3DNPTZw==` | `node_modules/react-native`; source selected, zero API ports in the standalone v2 host. The Android Hermes 0.14.1/JSI supplier is independent and must not be replaced by importing RN's VM. iOS host/toolchain not prepared here. |
| macOS | [RNM](https://github.com/microsoft/react-native-macos/tree/19f618c032c9f07967281ed5c462dc3259e8e7e1/packages/react-native), `react-native-macos@0.83.0`, commit `19f618c032c9f07967281ed5c462dc3259e8e7e1`, integrity `sha512-8hRb3b1QuKNC0xoHOq3BEErlsjrgJACyxXL5ny7dUr5zGxBCle5Tu9gPysCCITp1iyIINLEApHB/NkoRaKsU7Q==` | Existing macOS runner/template pins this package; not installed in the Windows checkout. Paths verified in the fixed remote tree. Zero v2 ports, AppKit/Metal/Xcode qualification pending. RNW is not its source. |
| Linux | [RNL](https://github.com/lucid-softworks/react-native-linux/tree/9412cf605c7cc77f920916401926ff9a9873ecd3), `@lucid-softworks/react-native-linux@0.0.1`, commit `9412cf605c7cc77f920916401926ff9a9873ecd3` | Existing Linux recipe and `cli/src/linux-inputs.mjs` pin this commit. Not installed here; fixed remote tree inspected. This is the **lucid-softworks GTK source**, not the similarly named Wayland/Skia repository. Zero v2 ports; GTK4 4.22, Wayland/X11 and toolchain qualification pending. |

RN/RNM identities come from their fixed npm version metadata. Before copying each
remaining file, retain its original and MIT license, hash both original and
adaptation, verify the package/commit match, and ship the selected dependency
closure. Do not install/copy all upstream packages into each validation app.

## Windows: RNW paths relative to Microsoft.ReactNative

| OS API | Selected actual implementation | Existing consumer -> replacement and remaining dependencies |
| --- | --- | --- |
| Public clipboard get/set/hasStrings | `Modules/ClipboardModule.cpp/.h`: UI dispatch, DataPackage, GetTextAsync and Completed status/error handling | **Ported** to `windows/rnw/ClipboardModule.cpp/.h`. `host.cpp` AppServices -> App SDK DispatcherQueue -> WinRT -> bounded copied reply. ReactContext, ReactPromise and codegen removed. Empty/non-text, quotas, rejected queue, canceled/unstarted writes, late completion and close drain added. `hasStrings` uses the same read with nonempty-text policy. No change subscription is registered. |
| Editing cut/copy/paste | Same Clipboard source; preserve OS input ordering before asynchronous Source actions | Source canonical Ctrl+V/Shift+Insert captures RNW `GetContent` on the UI key turn and retains the same async `GetTextAsync` completion. Bounded native snapshot tokens cross the Core key event; the original Paste Action reads that snapshot through App services and releases it on dispatch/discard. Source cut/copy use the RNW public service. Pending OS reads retain their ledger credits until terminal completion, including close. The noncanonical `interaction.hpp` -> `clipboard.hpp` synchronous path remains Nelyx-owned, and cut/write failure ordering plus full native key/IME ports remain pending. |
| Keyboard state and canonical key/code | `Utils/KeyboardUtils.cpp/.h` | **Ported canonical consumer** in `windows/rnw/KeyboardUtils.cpp/.h` -> `interaction.hpp` -> Core publication admission -> Source Focus/HardwareKeyboard. RNW InputKeyboardSource supplies modifiers/lock state; key/code tables supply copied labels/positions. WM_KEY scan/extended fields resolve both modifier edges and NumLock-independent keypad positions, NumpadEnter and locations. Numeric 24/32-byte ingress remains available for noncanonical consumers; canonical identity uses a bounded 48-byte header plus UTF-8 and an indexed event blob. VK label mapping retains upstream layout limits; unknown labels use the previous compatibility adapter. International/shifted-OEM/dead-key/IME and full pressing-state qualification remain pending. |
| Pointer / capture / focus / cursor | `Fabric/Composition/CompositionEventHandler.cpp`, `ReactNativeIsland.cpp` | `windows/host.cpp`, `interaction.hpp`, `input/WindowsPrecisionTrackpad.h` remain current consumers. Extract handler attach-detach; replace ComponentView/tag/hit-test with Core node generation and published geometry. Preserve DirectManipulation contact/phase carrier. ContentIsland coupling and focus/capture cancellation remain unported. |
| Text / IME / selection / keyboard visibility | `Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp` | `windows/interop/TextInput*.h`, `interaction.hpp` remain TSF carriers. Port OS handling; RichEdit/ITextHost cannot become a second document/layout authority. Core document, mirror/ACK, input generations and paragraph geometry remain Nelyx code. |
| Tooltip UIA notification | `Modules/AccessibilityInfoModule.cpp/.h::announceForAccessibility` | **Ported notification** in `windows/rnw/AccessibilityInfoModule.cpp/.h`. Bounded `flutter/accessibility` Tooltip channel -> App SDK service queue/close gate -> current Core UIA root -> upstream UiaRaiseNotificationEvent. BSTR is released and HRESULT propagated. Other announcements and accessibility settings remain explicitly unavailable. Web uses its owned ARIA live region; Android has no Tooltip service in its old supply. |
| UIA / semantics / focus / ranges / actions and accessibility settings | `Fabric/Composition/CompositionDynamicAutomationProvider.cpp`, `CompositionRootAutomationProvider.cpp`, remaining `Modules/AccessibilityInfoModule.cpp` | `windows/interop/Semantics*.h` remain current consumers. Replace React registry/props with Core semantic snapshot, generations and bounds. Retain COM apartment/range lifetime; port settings subscriptions/revocation and action ingress. The Tooltip notification port does not complete the provider or settings work. |
| Theme / contrast / scale / locale / OS environment / font notifications | `Modules/AppearanceModule.cpp`, `DeviceInfoModule.cpp`, `I18nManagerModule.cpp`, `PlatformConstantsWinModule.cpp`, `Fabric/Composition/Theme.cpp` | `host.cpp` metrics, `font_services.cpp`, `src/ui/platform-dispatcher.ts`, SDK Windows environment remain partial/direct. Port system queries and subscription attach/revoke to owned App SDK queue; OS font-change bridging and Core font revision remain pending. |
| Visibility / lifecycle / close / linking / system navigation | `Modules/AppStateModule.cpp`, `LinkingManagerModule.cpp`, `ReactNativeIsland.cpp` | `host.cpp`, `app_sdk.hpp` own current close/surface lifetime; AppWindow remains the single window owner. Port upstream event/service portions, replace React context/lifecycle emitters with app/session generation. URL service and all lifecycle states not yet supplied. |
| Network / file / image IO / feedback / other OS services | `Shared/Modules/HttpModule.cpp`, `FileReaderModule.cpp`, `BlobModule.cpp`, `Modules/AlertModule.cpp`; feature-specific source selection still required for feedback | `windows/app_http.hpp`, `app_images.hpp`, common font/image/buffer services remain direct. Port OS portions without bringing RN image caches, scheduler or VM. Feedback currently explicitly unavailable; source absence is not a completed port. |

## Android: paths relative to ReactAndroid/src/main/java/com/facebook/react

| OS API | Selected RN implementation | Existing consumer and retained Nelyx connection / dependency gap |
| --- | --- | --- |
| Clipboard / feedback | `modules/clipboard/ClipboardModule.kt`, `modules/vibration/VibrationModule.kt` | `android/project/.../HostView.java::appService`, `android/app_services.hpp`, common AppServices remain direct. Replace ReactApplicationContext/promise with owned Activity/View, copied JNI values and same quotas/close generation; sound/haptic mappings require checking feature coverage. |
| Keyboard / pointer / capture / focus / cursor | `uimanager/JSTouchDispatcher.kt`, `uimanager/JSPointerDispatcher.java`, `ReactRootView.java`, `views/view/ReactViewGroup.kt` | `HostView.java` motion/key handlers and `android/host.cpp` remain direct. Replace UIManager/event dispatcher/tags with canonical Core input and node IDs; actual pointer/capture/device behavior remains to qualify. |
| Text / IME / selection | `views/textinput/ReactEditText.kt`, `ReactEditTextInputConnectionWrapper.kt`, `ReactTextInputManager.kt` | `HostView.java` InputConnection and `android/shared/dev/nelyx/input/*` remain direct. Retain Core document, composing/selection revision, JNI mirror/ACK and lifecycle; no second RN text state. |
| Accessibility / semantics / feature settings | `uimanager/ReactAccessibilityDelegate.kt`, `modules/accessibilityinfo/AccessibilityInfoModule.kt` | `EngineAccessibility.java` and Core semantic packets remain direct. Port Android provider/action/settings implementation, replace React tags and state with Core generations/bounds, revoke listeners at detach. |
| Theme / scale / locale / OS / fonts | `modules/appearance/AppearanceModule.kt`, `deviceinfo/DeviceInfoModule.kt`, `i18nmanager/I18nManagerModule.kt`, `systeminfo/AndroidInfoModule.kt`, `views/text/ReactFontManager.kt` | Activity/HostView metrics, `android/font_services.cpp`, platform-dispatcher remain direct/partial. Port configuration listeners and lookups; preserve Core font cohort and App text service revision. |
| Lifecycle / navigation / linking / network | `modules/appstate/AppStateModule.kt`, `modules/intent/IntentModule.kt`, `ReactAndroidHWInputDeviceHelper.kt`, `modules/network/NetworkingModule.kt` | `MainActivity.java`, `HostView.java`, `HttpTransport.java`, `android/host.cpp` remain direct. Replace React instance callbacks with owned Activity/surface generations, cancellation and app ports. Do not import RN's Activity/VM/event loop wholesale. |

`project/...` means `project/app/src/main/java/dev/nelyx/engine/`.
Android source ports remain zero despite current native behavior and existing
engine input helpers. Kotlin/AndroidX/OkHttp dependencies must be extracted or
explicitly adapted per file before accepting an RN port.

## iOS and macOS: separate RN and RNM sources

The following paths are relative to their respective package roots. Shared file
names do not imply identical UIKit/AppKit implementations.

| OS API | RN iOS source | RNM macOS source | Current consumer / Nelyx connection and remaining dependency |
| --- | --- | --- | --- |
| Clipboard / OS services | `React/CoreModules/RCTClipboard.mm` | `React/CoreModules/RCTClipboard.mm` (AppKit branches) | Existing `sdk/native/apple` (UIKit/AppKit branches) and platform applications; no v2 host. Replace bridge/promise with copied service replies on main queue. Keep UIPasteboard and NSPasteboard implementations separate. |
| Keyboard / pointer / focus / cursor | `React/Fabric/RCTSurfaceTouchHandler.mm`, `RCTSurfacePointerHandler.mm` | Same RNM handler files plus `React/Views/RCTViewKeyboardEvent.m`, `RCTHandledKey.m` | Existing platform interaction/surface/native adapters. Extract UIKit/AppKit handlers, remove event emitter/tag/ComponentView dependency; Core input and geometry remain authoritative. |
| Text / IME / selection / undo | `Libraries/Text/TextInput/RCTBaseTextInputView.mm`, `RCTBackedTextInputDelegateAdapter.mm` | RNM versions of the same paths | Platform text-input carriers remain legacy. New UIKit/AppKit carrier must use Core mirror/revision/ACK and published paragraph; RN text shadow state/layout not admitted. |
| Accessibility / settings / semantics | `React/CoreModules/RCTAccessibilityManager.mm`, view accessibility implementation | RNM `RCTAccessibilityManager.mm` and AppKit view accessibility implementation | Existing native semantics providers only. Extract platform notifications/actions, bind Core generation/ranges/bounds, detach observers and guard stale callbacks. Native reader/voice checks DEFERRED. |
| Theme / locale / scale / fonts / OS | `React/CoreModules/RCTAppearance.mm`, `RCTDeviceInfo.mm`, `RCTI18nManager.mm`, `Libraries/Settings/RCTSettingsManager.mm` | RNM counterparts and AppKit branches | Existing SDK assets/environment and platform dispatcher. Main-queue subscriptions, font-change ingress and Core font revision still missing; bridge constants are values, not a second runtime. |
| Lifecycle / scene / navigation / linking / network | `React/CoreModules/RCTAppState.mm`, `Libraries/LinkingIOS/RCTLinkingManager.mm`, `Libraries/Network/RCTNetworking.mm`, `React/Base/RCTRootView.m` | RNM counterparts, AppKit window/application paths | Existing runner/delegate applications are selection inputs, not v2 ports. Separate UIKit scene/application and AppKit window lifecycles; replace RCTBridge/event dispatcher with generation-owned app ports and cancellation. |

Native view menus, keyboard visibility, system navigation, feedback, sensitive
content, restoration and font notifications need feature-level checks against
these files during W9B-03. A missing upstream operation must be recorded and
implemented as an explicit Nelyx connection with its remaining behavior visible.

## Linux: inspected fixed RNL tree and concrete gaps

| OS API | Available RNL implementation | Existing consumer / connection and remaining gap |
| --- | --- | --- |
| GTK application / window / lifecycle | `vnext/src/RNLinuxApplication.cpp`, `RNLinuxHost.cpp`, `AppContext.cpp` | Existing `sdk/native/linux`, `sdk/src/platforms/linux` and Linux template use a legacy RN host. Extract GTK main-context/window callbacks into new GTK4 host; remove Fabric mounting, TurboModule registry, Hermes/JsThread ownership. No v2 GTK host yet. |
| Input / focus / text / IME | `vnext/src/views/ViewComponentView.cpp`, `TextInputComponentView.cpp`, `components/TextInput.cpp` | Existing Linux SDK input service is legacy. Extract GTK controllers, focus and editable/IME handling; replace ComponentView/state/layout with Core node/document/mirror/ACK. Native GTK text cannot become final layout authority. |
| Locale / scale / environment | `vnext/src/locale/Locale.cpp`, `deviceinfo/DeviceInfo.cpp`, `modules/PlatformConstants.cpp` | Linux SDK/environment remains legacy. Port actual GLib/GTK lookups and event handling, preserve Nelyx generations/font service; theme/font-change subscription coverage must be added explicitly. |
| Network / file / notifications / keep-awake | `vnext/src/network/Network.cpp`, `filesystem/FileSystem.cpp`, `notifications/Notifications.cpp`, `keepawake/KeepAwake.cpp` | No v2 consumer. Extract OS implementation/dependency closure; adapt TurboModule values/callbacks to bounded app port and cancel IO at close. Extra native dependencies remain to qualify. |
| Clipboard / accessibility provider / linking / feedback | **No standalone implementation for these APIs in this fixed tree** | Inspect GTK clipboard usage inside view handlers when implementing; add GdkClipboard, GTK accessibility/AT context, URL-launch and feedback connections where upstream is insufficient. These additions are explicit missing behavior, not four completed RNL source ports. Preserve actual RNL source reuse for the rows above. |

## Common API coverage and acceptance

The public inventory is `src/services/system-channels.ts`, `src/ui/platform-dispatcher.ts`
and the SDK platform application/service surfaces. Clipboard, textInput, keyEvent,
lifecycle, system, accessibility and localization map to the platform rows above.
Navigation/backGesture, statusBar/system UI, processText, scribe, spellCheck,
undoManager, platform_views, mouseCursor, restoration, deferredComponent, menu,
contextMenu, keyboard and sensitiveContent are **not completed ports**. During
W9B-03, map their individual methods to the selected upstream view/service
implementations; where absent or coupled to RN runtime, name the exact gap and
required OS connection. `skia` is a renderer protocol, not an upstream OS service.

Asset/font/paragraph/image/network/buffer execution remains owned by Nelyx Core
and its current providers. Port native OS ingress/IO without adding React renderer,
Yoga, a second VM, layout, document, gesture arena or scheduler. TypeScript retains
the original Widget/State/theme/controller/callback APIs. Source selection and
cross-builds do not establish runtime/device, physical input, displayed frames,
scanout or performance acceptance.
