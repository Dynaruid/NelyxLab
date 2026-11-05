# work9-1 — 1부: 범위·기준선·Windows 호스트·공통 경계

작성·검토: **2026-11-05 KST** · 상태: **ACTIVE / Windows·Web 우선 계획, 신규 구현 미착수, 기존 구현 PARTIAL**

[전체 목차](work9.md) · [다음: 2부](work9-2.md)

**범위:** 원문 §1–4·§7. Windows/Web 우선 범위, work8 기준점, Windows App SDK·RNW 선별 재사용, 최소 공통 embedder 경계를 다룬다.

**실행 순서:** Windows/Web 1차는 [3부 §12.2의 실행 묶음](work9-3.md#122-windowsweb-1차-실행-순서)을 따른다. 이후 **[4부의 Android·Linux 2차](work9-4.md) → [후속 5부의 iOS·macOS 3차](work9-5.md)**로 진행하며 후속 플랫폼을 Windows/Web 1차 완료의 선행 조건으로 두지 않는다.

## 1. 이번 계획의 결정과 범위

**1차 개발·완료 대상은 Windows와 Web이다.** Windows는 Windows App SDK + C++/WinRT host로 전환하고 현재 Graphite/Vulkan renderer를 재사용한다. Web은 기존 DOM·Worker·공식 npm CanvasKit host에서 **threaded와 non-shared single-worker를 함께** 개발한다. 공통 기능은 Windows와 두 Web profile에 같은 사례를 연결해 진행한다.

**Windows/Web 1차 다음은 [4부의 Android·Linux 2차](work9-4.md)이며, 그다음은 [후속 5부의 iOS·macOS 3차](work9-5.md)다.** 플랫폼별 설계·미완료 항목은 보존하고 해당 차수에서 toolchain·prototype·입력 adapter·배포를 진행한다. 후속 플랫폼과 모바일 RN 소스 추출은 Windows/Web 1차 완료의 선행 조건으로 두지 않는다. Web의 브라우저 helper도 실제 재현 사례가 있을 때만 선별한다. 채택 범위·의존성 제거·입력 상태 계약·실행 검증은 [§11](work9-2.md#11-web모바일에서-유지할-범위)을 따른다.

**Windows의 RNW 소스 선별 재사용은 1차 개발에 포함한다.** 기존 Nelyx/v2 Windows 구현을 먼저 사용하고 RNW의 필요한 입력·focus·UIA·OS 서비스 처리와 회귀 사례를 보완한다. 파일 전체 복사 여부보다 중립 host에서 독립 실행 가능한 범위를 기준으로 선택한다. 구체적인 후보와 제외 경계는 [§4.1](#41-windows-rnw-소스-선별-재사용)을 따른다.

TypeScript Widget/Element/State·디자인 패키지는 유지하고 C++ core가 layout·editing·gesture·retained scene·compositor를 소유한다. 먼저 현재 Windows/Web의 작은 실행 경로와 원래 API의 실행 모델을 확인하고, 필요한 공통 경계만 추출한 뒤 기능을 확장한다. 여러 OS를 위한 전체 폴더 재배치나 모바일 adapter 추출부터 시작하지 않는다.

`work8.md`, `work8-1.md`, `work8-2.md`, `work8-2a.md`, `work8-3.md`는 **CLOSED / SUPERSEDED**다. 사용자 요청으로 원문 작성일에 맞춘 history 요약 5개에 설계·실행·실패와 미완료 상태를 보존하고 루트 원문은 삭제했다. [work8 보관 목차](history/26/11/04/work8-summary.md)에서 각 요약으로 이동할 수 있다. 이후 일정·완료 조건·플랫폼 선택은 이 문서가 우선한다.

분할 전 검토에서는 작업 순서와 의존성을 검토해 **work9 문서만 수정**했다. 당시 CMake·API audit·CLI/runner·host 검사와 Windows/Web 공식 문서를 대조했다. 제품 소스·공급은 변경하지 않았고 빌드·기능 테스트·API audit·성능 측정을 새로 실행하지 않았다. 아래 구현 단계와 검증표는 **앞으로 수행할 작업**이다.

Windows/Web 기술 완료, 기존 공개 API 호환, 제품의 물리 입력·체감 성능 수락을 각각 판정한다. **Windows/Web 1차 완료와 전체 플랫폼 완료를 구분**하고 후속 플랫폼은 계속 미완료로 남긴다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 IME/reader/trackpad·display/scanout `notVerified`를 이어받는다.

## 2. work8에서 이어받는 기준점

Work8 종료 문서의 검토 기준은 HEAD **`b2f18fc12f7c`**와 당시 이미 존재한 `work8-2a.md`의 Flutter 비교 미커밋 변경이다. 해당 변경의 내용은 2a 보관 요약에 보존했다. 아래 숫자는 [2a의 마지막 구현 검증 기록](history/26/11/05/work8-2a-summary.md#이번-검증)이며 이번 문서 작업의 재검증 결과가 아니다.

| 항목 | 종료 시점의 기록과 이월 경계 |
| --- | --- |
| 공통 engine·기존 host | C++/C ABI·TS client·ACK/NACK·layout/query·Widget diff·편집/semantics·bounded lazy list. Windows 자체 HWND와 Web 두 profile의 구간 구현 |
| 마지막 기능 검사 | Core **214/214**, API 검사 자체 **7/7**, lifecycle **3/3**, host **5/5**, 일반 runner **8/8**. 전체 공개 API 호환 성공이나 새 OS host의 성공을 뜻하지 않음 |
| 실제 실행 근거 | 해당 Testbed에서 SDK ACK 명령 **1210 = C++ transactionWork 1210**, layoutWork **445**, graphics record **14**, native extension **1**. 미이식 Widget 거부 대조와 ACK 전 `observed=false` 확인 |
| 공개 API 기준 | `public-api.json`의 **4개 패키지·834 subpath·4526 code export 발생 항목 + 15 non-code 항목**. Reexport를 포함하며 고유 기능 수나 완료율이 아님 |
| 전체 API gate | **FAIL / inputValid=false / compatible=false**. 전체 선언 동시 해석에서 의존 전역 충돌 81건, 원래 scope 차이 0건이라는 당시 기록. Workspace `skipLibCheck` 통과와 구별 |
| 공급 | ABI major **2**, schema **2587795476**, `host-integration-candidate`, **33파일/4 font**. 마지막 source SHA-256은 `c69b2977dced7e94fb1f454b2ae7c9fa653938d6d5b3ad193057f3c70f2608f0`. 현재 소스/파일 hash는 다음 구현 실행에서 다시 확인 |
| 그래픽·메모리 | Affine/path/clip/stroke/shadow/opacity/blur와 단일 ledger의 일부 구현. 총 **384 MiB / GPU 예약 128 MiB**는 owned reservation/관측 정책이며 RSS·driver VRAM의 hard cap이 아님 |
| 일반 프로젝트 | Windows/Web의 create/build/run/pack·7개 archive 설치 소비·두 디자인·설치 compiler 검사. `dev`는 build 후 run이며 generation reload는 없음 |
| npm 종료 | 과거 install의 **0xC0000409 두 번**과 보완 후 runner 통과를 함께 보존. 원인 미확정이며 engine ledger 초과로 단정하지 않음 |

이전 문서의 69·117·184·193·211·242개 및 오래된 공급 hash는 각 실행 구간의 기록이다. 마지막 기록을 합산하거나 과거의 `fallbacks=0`을 현재 독립 계측으로 재사용하지 않는다.

### 이월 대응표

| work8의 미완료 범위 | work9 작업 |
| --- | --- |
| W8-00/01 범위·API 의미·플랫폼/공급 계약 | W9-00/01/13 |
| W8-02/08 최소 Android·Apple/Linux port와 graphics 복구 | 1차 Windows/Web은 W9-02/12-A, 2차 Android/Linux는 W9-12-B(Android)/03, 3차 iOS/macOS는 W9-12-B(iOS)/04 |
| W8-03/04 전체 gesture·motion·layout/text·invalidation | W9-05/07/09/10 |
| W8-05/06 Widget·list·focus/editing·semantics | W9-06/07 |
| W8-07 Material/Cupertino·overlay/navigation | W9-08 |
| W8-09/10 통합 기능·SDK/CLI/template·설치 공급 | W9-13 |
| 2a P1 기존 Widget/Element/State/Key/context | W9-06 |
| 2a P2 layout/scroll/gesture/editing/paint/custom hook | W9-05/06/07 |
| 2a P3 전체 디자인·SDK API | W9-08 |
| 2a P4 남은 host·reload·archive·예산/회수 | 1차 W9-01/02/09/12-A/13, 2차 W9-12-B(Android)/03, 3차 W9-12-B(iOS)/04. 각 후속 대상의 W9-13/14는 별도 수행 |
| 2a P5 전체 통합·물리/성능 | W9-13/14 |
| Flutter 비교의 표현력·자원 재사용·frame clock·외부 콘텐츠·pressure | W9-05/07/09/10/11 |

P0에서 보완한 원래 표면 고정·gate 입력·동작 의무·실제 경로 보고·복합 종료 처리는 유지할 기반이다. 전체 API gate가 실패하므로 P0 검사의 통과를 P1–P5 완료로 올리지 않는다.

## 3. 플랫폼별 채택 구조

| 대상 | 개발 차수 | 호스트·UI owner | 그래픽 연결의 계획 | 필수 범위와 현재 상태 |
| --- | --- | --- | --- | --- |
| Windows | **1차 우선** | **Windows App SDK + C++/WinRT**, AppWindow·DispatcherQueue와 HWND interop | 현재 **Skia Graphite/Vulkan → HWND**를 먼저 유지 | Windows 11 x64를 초기 실행 기준으로 고정. App SDK 전환은 **미착수**, 기존 HWND host 구간만 검증 기록 있음 |
| Web | **1차 우선** | 기존 Main·App worker·engine worker, 두 실행 profile | 수정하지 않은 공식 npm `canvaskit-wasm@0.41.0/full` | Windows의 Chrome·Edge를 초기 실제 브라우저 검증 대상으로 두고 정확한 버전은 W9-00에서 기록. 두 profile·전체 API·복구는 PARTIAL. 다른 browser/OS는 별도 검증 전 지원 완료로 표시하지 않음 |
| Linux | **2차 / 4부** | **GTK4**, GtkApplication/GtkApplicationWindow·GLib main context | Render worker의 **Graphite/Vulkan → DMA-BUF → GdkTexture → GTK snapshot** | GTK **4.16 이상**, Linux x86_64, **Wayland와 X11 각각**을 계획. V2 host는 **미착수 / DEFERRED** |
| macOS | **3차 / 후속 5부** | **AppKit**, NSApplication/NSWindow/NSView, Objective-C++ adapter | **Skia Graphite/Metal → CAMetalLayer** | macOS **14 이상**, arm64를 초기 대상으로 계획. V2 host는 **미착수 / DEFERRED**. x86_64 공급은 별도 target 상태로 관리 |
| Android | **2차 / 4부** | Kotlin/Java의 Activity/View + native engine. 기존 Nelyx/RN의 OS 연결 코드를 선별 이식 | Native surface와 검증한 Skia 공급 | arm64-v8a 최소 port·InputConnection/접근성·RN 의존성 분리·독립 실행을 이월. **소스 검토 / 구현 미착수 / DEFERRED** |
| iOS | **3차 / 후속 5부** | **UIKit**의 UIApplication/UIView·UITextInput. RN의 예외 처리·서비스를 선별 이식 | Native Metal surface와 검증한 Skia 공급 | UIKit host·RN 의존성 분리·공급을 이월. AppKit을 iOS에 적용하지 않음. **소스 검토 / 구현 미착수 / DEFERRED** |

위 OS/ABI는 초기 검증 대상의 계획이다. W9-00에서는 **Windows App SDK/NuGet·Skia/Hermes/CRT·Emscripten/CanvasKit·실제 browser**의 정확한 버전·artifact hash·최저 환경을 고정한다. Android toolchain·GTK/GLib는 2차 착수 때, Xcode·Apple toolchain은 3차 착수 때 고정한다. `latest`나 로컬에 우연히 설치된 SDK를 제품 의존성으로 삼지 않는다. 다른 OS/ABI는 검사 전 지원 완료로 표시하지 않는다.

현재 [v2 CLI](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)는 Windows/Web만 공급한다. 기존 [Linux template](Nelyx/sdk/tooling/cli/templates/nelyx-app/linux/CMakeLists.txt)는 React Native Linux에, [macOS runner](Nelyx/sdk/tooling/cli/templates/nelyx-app/macos/runner/README.md)는 React Native macOS에 의존한다. 이 파일들의 존재를 새 v2 host 구현으로 세지 않는다. 새 desktop v2 실행의 필수 기반은 위 OS host이며, 기존 runner는 전환 gate 전까지 유지한다.

## 4. Windows — Windows App SDK 호스트

**기존 HWND host에 Windows App SDK의 실제 창 관리·dispatcher 수명을 연결하는 방식으로 전환한다.** AppWindow는 top-level HWND와 연결되며 Win32 UI와 함께 사용할 수 있다. Nelyx Widget을 그리기 위해 WinUI 3 XAML visual tree를 먼저 도입할 필요는 없다. 이는 채택 설계이며 App SDK가 자동으로 기존 Vulkan renderer를 교체한다는 뜻이 아니다. [Microsoft AppWindow 안내](https://learn.microsoft.com/en-us/windows/apps/develop/ui/manage-app-windows)

W9-02-A에서는 **작은 App SDK 창 → 실제 C++ scene → 입력 → resize → close → unpackaged 소비 실행**을 먼저 연결한다. 전체 Widget 이식이나 대규모 common 추출을 기다리지 않고 창·dispatcher·GPU·배포 수명의 결합을 확인한다. 이후 같은 host에 전체 공통 corpus를 확장한다. 기존 HWND host는 전환 중 회귀 대조로 유지하고 App SDK 성공으로 기록하지 않는다.

| 작업 | 고정할 계약·완료 증거 |
| --- | --- |
| 시작·배포 | C++ host 실행 프로젝트에서 고정 NuGet을 참조하고 CMake core/provider를 연결. 초기 배포는 **unpackaged/self-contained**로 계획. 선택한 SDK의 앱 로컬 초기화·필수 runtime/CRT·license를 포함하고 깨끗한 소비 환경에서 실행. Framework-dependent를 추가하면 bootstrap/runtime 설치 계약을 별도로 제공 |
| UI loop | STA UI thread가 `Microsoft.UI.Dispatching.DispatcherQueueController`·AppWindow·HWND를 소유. 기존 USER32 pump와 통합하고 중첩 resize/modal loop도 검사. `Windows.System` dispatcher와 App SDK dispatcher 타입을 섞지 않음 |
| 실제 App SDK 사용 | 단순 link나 manifest 이름이 아니라 AppWindow 생성/interop·크기/표시/변경·dispatcher callback·종료를 실제로 실행. Host 보고에 `windows-app-sdk`와 정확한 runtime/package identity 포함 |
| Surface | 현재 [Vulkan/Graphite provider](Nelyx/engine/platform/windows/skia_provider.hpp)를 Render owner에서 재사용. UI가 HWND와 metrics lifetime을 보장하고 device/scene의 늦은 결과를 세대로 차단. HWND/WSI teardown은 GPU/provider hold drain 뒤 수행 |
| DPI·resize | Client 물리 px와 engine 논리 단위의 변환을 한 adapter에서 처리. `WM_DPICHANGED`·AppWindow 변경을 하나의 metrics revision으로 합치며, live resize·다중 모니터·최소화·zero-size·restore 때 이전/새 surface의 게시 순서를 검증 |
| 입력·접근성 | 기존 [TSF/UIA](Nelyx/engine/platform/windows/interaction.hpp)와 clipboard·게시 geometry를 유지. Keyboard/text의 중복 적용, focus/capture 이탈, precision trackpad source/phase와 wheel 구분, 조합 종료 교섭을 새 window 수명에서 재검증 |
| 종료 | Close 요청은 한 terminal로 합치고 UI pump를 살린 채 App → Widget/client → Content/Render/provider → HWND/AppWindow → dispatcher/runtime 순서로 정리. UI callback을 기다리는 owner를 UI에서 blocking join하지 않음. 원래 오류와 cleanup 오류를 모두 보존 |

App SDK의 창 변경은 UI 호스트 전환이다. **D3D/ANGLE·Composition swapchain 전환은 이번 채택의 전제에 넣지 않는다.** 향후 다른 renderer를 추가할 때는 capability·픽셀·수명·실행 identity를 독립 검증한다.

배포와 dispatcher 수명은 [self-contained 배포](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/self-contained-deploy/deploy-self-contained-apps), [framework-dependent bootstrap](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/deploy-unpackaged-apps), [DispatcherQueue](https://learn.microsoft.com/en-us/windows/apps/develop/dispatcherqueue)를 기준으로 구현한다. Self-contained와 framework-dependent의 초기화 절차를 한 경로에 혼합하지 않는다.

### 4.1 Windows RNW 소스 선별 재사용

**RNW의 Windows OS 처리와 회귀 사례를 1차 재사용 후보로 채택한다.** RNW의 New Architecture는 Win32·Windows App SDK와 Composition을 사용하므로 Windows host의 입력·focus·접근성 경계를 비교할 수 있다. 다만 Nelyx의 현재 Vulkan renderer에 대한 직접 연결 가능성을 뜻하지 않는다. [RNW 공식 구조 설명](https://microsoft.github.io/react-native-windows/docs/new-architecture/)

이번 소스 비교 기준은 실제 Windows runner 설치본의 **`react-native-windows@0.83.2`**다. 위치는 `sample/nelyx-testbed-app-2/windows/runner/node_modules/react-native-windows`이며 아래 RNW 경로는 그 안의 `Microsoft.ReactNative/` 기준이다. 이는 비교 기준이고 실제 추출·standalone compile/link·물리 입력 검증은 **미착수**다. 도입할 파일의 원본 commit/package integrity·파일 hash·license는 W9-00에서 고정하고 기존 RN/RNW·Hermes/JSI 공급을 자동 갱신하지 않는다.

| 범위 | 확인한 소스와 재사용 후보 | Nelyx 적용 경계 |
| --- | --- | --- |
| 기존 Nelyx 기반 | v2 `platform/windows/interaction.hpp`, 기존 `sdk/native/windows/TextInputService.h`·`SemanticsTextProvider.h`, `skia/native/host/windows/WindowsPrecisionTrackpad.h` | V2 TSF/UIA를 우선 유지. 기존 helper의 필요한 OS 처리만 중립 callback/packet에 연결하고 RN 값 타입·Fabric peer 의존성은 분리. 이미 있는 기능을 RNW 코드로 중복 구현하지 않음 |
| Keyboard·pointer·focus | RNW `Utils/KeyboardUtils.cpp`, `Fabric/Composition/CompositionEventHandler.cpp`·`ReactNativeIsland.cpp`의 키 매핑·capture 이탈·focus·이벤트 연결/해제 | 필요한 OS handler와 사례를 추출. React tag·ComponentView hit-test·Fabric event emitter는 engine node/session·게시 geometry·canonical input으로 교체. Wheel을 precision trackpad의 contact/phase 증거로 바꾸지 않음 |
| TextInput·IME | RNW `Fabric/Composition/TextInput/WindowsTextInputComponentView.cpp`의 RichEdit/ITextHost·키/선택·입력 경계 처리 | RNW 파일은 RichEdit·Fabric text state/layout에 결합됨. 필요한 OS 예외 처리와 회귀 사례만 이식하고 Nelyx의 C++ editing document·paragraph·TSF를 권위 상태로 유지. 별도 RichEdit 편집/레이아웃을 자동 도입하지 않음 |
| UI Automation | RNW `Fabric/Composition/CompositionDynamicAutomationProvider.cpp`·`CompositionRootAutomationProvider.cpp`의 fragment·pattern·focus/hosted child 연결 | ComponentView/React tag/props를 Core semantic snapshot·node generation·게시 bounds에 매핑. Stale node·focus·range/action·종료를 실제 UIA peer에서 확인 |
| OS 서비스·설정 | RNW `Modules/ClipboardModule.cpp`·`AccessibilityInfoModule.cpp`, `Fabric/Composition/Theme.cpp`의 clipboard·시스템 설정 조회/변경 알림 | ReactContext/ReactPromise·RN dispatcher 대신 owned UI dispatcher·중립 결과/취소를 사용. 필요한 서비스부터 선택하고 늦은 완료·이벤트 구독을 close 때 정리 |

**도입 순서:** W9-00에서 실제 필요한 Windows 사례와 출처·의존성을 고정 → W9-01에서 선택한 handler/값·callback만 최소 분리 → W9-02-A에서 App SDK 일반 앱의 입력/focus/close로 실행 → W9-07/08에서 편집·UIA·서비스 corpus 확장 → W9-13에서 설치본의 compile/link/runtime 의존성과 고지 확인. RNW 파일을 하나도 가져오지 않아도 기존 구현으로 사례를 해결했다면 그 근거를 기록한다. 전체 RNW 추출은 W9-02-A의 선행 조건이 아니다.

새 standalone host의 선택한 경로는 ReactNativeHost/ReactContext·FabricUIManager·ComponentView registry·React renderer 없이 동작해야 한다. OS callback은 bounded engine port에 연결하며 RNW ScrollView/gesture 판정·React scheduler·Composition renderer·VM을 두 번째 상태/일정/렌더링 소유자로 들이지 않는다. RNW ContentIsland/Composition 전용 코드는 HWND host와의 적용성을 먼저 확인하고 필요하면 알고리즘·사례만 참고한다. 원래 저작권·MIT 및 해당 파일의 제3자 고지는 보존한다.

## 7. 공통 embedder·runtime 경계

[현재 CMake](Nelyx/engine/CMakeLists.txt)와 [Windows host](Nelyx/engine/platform/windows/host.cpp)는 provider/runtime/UI 처리가 Windows 경로에 모여 있다. W9-01은 **Windows/Web에서 실제 공유할 lifecycle·mailbox·provider 계약에 필요한 최소 추출**로 제한한다. 후속 host 전용 adapter·모바일 RN helper나 전체 디렉터리 개편을 완료 조건으로 넣지 않는다. 아래 경로는 **목표 책임 배치**이며 새 경로를 미리 모두 만들라는 지시나 존재하는 파일에 대한 링크가 아니다.

```text
Nelyx/engine/
  core/                         # 기존 OS 독립 document/layout/interaction/scheduler
  include/ + bindings/          # 기존 versioned C ABI/wire
  platform/common/              # App runtime, owner mailboxes, host lifecycle
  platform/windows/             # Windows App SDK + HWND/TSF/UIA
  platform/linux/               # 2차 GTK4 + GDK/IM/AT-SPI
  platform/macos/               # 3차 AppKit + text input/NSAccessibility
  platform/android/             # 2차 중립 Kotlin/Java·JNI 입력/서비스·surface adapter
  platform/ios/                 # 3차 중립 Objective-C++·UIKit/UITextInput·Metal adapter
  render/skia-native/           # 공통 Picture/paragraph/image 준비·retained replay
  render/canvaskit-web/          # 기존 공식 npm CanvasKit provider
```

Host 계약에는 surface/metrics·frame clock·input·text input·semantics·clipboard/services·wake·resource release·close를 포함한다. HWND/GObject/Objective-C 객체와 toolkit allocator를 공통 core/wire에 넣지 않는다. CPU Picture/paragraph 준비와 platform GPU presenter를 분리하고, OS별 font/ICU 결과를 공통 text corpus로 확인한다.

UI·App·Content·Render owner의 권한과 mailbox 상한, `DocumentAccepted`/`PreparationId`/publication·node/resource generation을 보존한다. 1차 Windows와 Web threaded는 **App/Content와 독립된 준비 scene 합성**을 요구한다. Web single-worker는 `contentIndependent=false`와 유한 분할/점유 후 회복을 구분한다. 후속 native host도 같은 독립 합성 계약을 따른다. UI의 실제 게시 adapter를 사용한다는 이유로 Content나 TS에서 매 frame raster하도록 바꾸지 않는다.

각 host 보고는 engine/host/backend·OS/ABI·VM/compiler·Skia·schema·source/asset identity·owner 배치·capability를 함께 제공한다. `native`라는 profile 하나에 서로 다른 OS binary를 덮어쓰지 않고 공급 manifest를 target별로 구별한다. 정확한 manifest version은 W9-00/01에서 정하고 기존 소비자의 불일치는 명확히 거부한다.
