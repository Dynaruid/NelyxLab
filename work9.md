# W9 · Nelyx PlatformView와 네이티브 Skia 전경 합성

**PAUSED / PARTIAL** · 2026-11-28 · 기준 `main` `3327645f` · [설계 원안](idea.md) · [실행 현황](#7-실행-현황) · [재개 지점](#8-재개-지점)

네이티브 편집기 위에 Nelyx의 반투명 카드와 버튼을 올린다. 카드 아래에서 편집기의 글자와 커서가 보이고, 버튼을 누르면 Nelyx 콜백이 한 번 실행되며, 옆을 누르면 같은 편집기에서 한글 입력을 이어갈 수 있어야 한다. 이 장면을 Testbed 3의 공개 위젯 API로 작성해 렌더링·입력·접근성을 함께 검증한다.

| 대상 | W9에서 만들 경로 | 첫 수락 장면 |
| --- | --- | --- |
| Web / PWA, Tauri의 HTML 콘텐츠 | **같은 브라우저 문서 또는 기존 WebView 안에서** 배경 캔버스 → DOM 요소 → 필요한 경우에만 투명 전경 캔버스를 쌓는다. | HTML 편집기와 iframe 위의 Nelyx 버튼. 겹침이 없는 화면은 캔버스 한 장으로 그린다. |
| Windows / Android의 실제 OS 컨트롤 | 기존 WebView의 CanvasKit 배경 → 실제 OS 자식 뷰 → **추가 네이티브 Skia 표면 한 장**을 OS가 합성한다. | Win32 `EDIT`와 Android `EditText` 위에서 같은 장면을 재현한다. |
| iOS / macOS / Linux | 같은 계약에 각각 UIKit, AppKit, GTK 호스트를 붙이는 후속 포트다. | 대상별 실제 컨트롤·전경 표면·입력·보조기술이 통과한 조합을 기록한다. |

첫 이정표는 Web과 패키징한 Windows 앱, 다음은 Android다. 한 장의 네이티브 전경으로 **여러 Nelyx 컨트롤을 한 OS 뷰 위에** 그리는 경우부터 지원한다. 네이티브 뷰가 여러 층 사이에 교차하는 장면, 외부 영상 텍스처, 화면 전체의 네이티브 Skia 전환은 §6에서 결정한다.

## 1. 설계 검토에서 수정한 부분

| 현재 코드에서 확인한 사실 | W9의 결정 |
| --- | --- |
| Testbed 3의 `HostSlot`은 build에서 예약한 프레임 후 콜백으로 좌표와 크기를 읽는다. React의 `HostPanel`은 Surface의 형제이고 샘플이 팝업 상태를 전달해 숨긴다. | 앱이 넘기는 좌표·가림 플래그를 SDK 계약으로 승격하면 스크롤 중 조상만 움직이는 경우와 실제 Nelyx 모달을 놓친다. 최종 레이어에서 위치와 순서를 얻고, 기존 HTML 장면과 새 장면을 비교한다. [자리 계산](sample/nelyx-testbed-app-3/src/host-slot.ts#L45) · [패널 장착](sample/nelyx-testbed-app-3/src/app-surface.tsx#L50) · [팝업 처리](sample/nelyx-testbed-app-3/src/app.ts#L437) |
| `SceneBuilder`는 retained 자식을 포함한 장면을 마지막에 평탄화한다. 선택적인 `SceneCompositionService`의 현재 결과는 그림 명령 범위와 save/restore이며, 루트는 배경 clear를 뒤늦게 앞에 삽입한다. | 뷰 표식을 retained recording에 남기고 평탄화 전에 순서 있는 그림 구간을 만든다. 배경 clear는 배경에만 적용한다. 선택적 서비스가 없는 기본 경로와 캐시 재사용 경로도 같은 결과를 내야 한다. [합성 계약](Nelyx/src/hosting/scene-composition.ts) · [장면 내보내기](Nelyx/src/ui/scene.ts#L799) · [배경 clear](Nelyx/src/framework/widgets/root.ts#L799) |
| `FrameworkRoot`의 `sceneComposition.commit()`은 CPU 프레임 작성 중 호출된다. 워커의 큐 수락은 외부에 `submitted` 알림을 내보내지만, 실제 GPU 제출 응답은 나중에 별도로 처리한다. | 기존 `submitted`의 의미를 바꾸면 기존 소비자가 영향을 받는다. 합성 담당자에게만 실제 제출 시점을 연결한다. 큐에 들어갔다가 폐기된 프레임은 뷰를 움직이거나 클릭 대상을 바꿀 수 없다. [CPU commit](Nelyx/src/framework/widgets/root.ts#L1230) · [수락 알림](Nelyx/src/hosting/renderer-events.ts#L35) · [워커 큐 수락](Nelyx/sdk/src/backends/browser/render-worker-frames.ts#L248) · [GPU 제출 응답](Nelyx/sdk/src/backends/browser/render-worker-frames.ts#L320) |
| `encodeFrame()`에는 두 바이트 형식이 있다. 기존 native v11은 세대·순번에 uint32, 좌표에 float32를 쓰고 배율을 16 이하로 제한한다. 웹 형식은 32비트를 넘는 세대·순번과 더 정밀한 좌표를 검사한다. | 새 네이티브 전경 디코더의 그림 본문은 **기존 Web frame wire v1**로 정한다. 창·View 식별, 구간 배치, 입력 영역은 별도 버전의 호스트 메시지에 둔다. 기존 두 형식과 소비자를 보존한다. [인코더의 두 경로](Nelyx/src/ui/frame-wire.ts#L238) · [native v11 헤더](Nelyx/src/ui/frame-wire.ts#L280) · [기존 경계값 검사](Nelyx/eng/check-web-frame-wire.mjs#L14) |
| `hasPlatformViewAt()`은 hit 경로에 네이티브 표식이 있는지를 반환한다. Core semantics에는 `platformViewId`가 있지만, 호스트용 `SemanticsNode`와 DOM 접근성 어댑터에는 임베디드 컨트롤 연결 계약이 없다. | 픽셀 배치와 별도로 **맨 앞에서 입력을 받을 영역**과 **접근성 탐색 위치**를 전달한다. 불투명한 장식은 입력을 통과시킬 수 있고, 투명한 모달 배리어는 입력을 막을 수 있어야 한다. [hit test](Nelyx/src/framework/gestures/binding.ts#L508) · [Core semantics](Nelyx/src/framework/semantics/semantics.ts#L3905) · [호스트 노드](Nelyx/src/ui/types.ts#L418) · [DOM 접근성](Nelyx/sdk/src/backends/browser/interaction.ts) |
| 현재 패키지가 공급하는 Skia는 CanvasKit WebGL2다. Vulkan helper에는 Win32 프레임과 오프스크린 표면 인터페이스가 있지만 Tauri 크레이트는 네이티브 Skia 렌더러를 링크하지 않는다. | 네이티브 Skia의 공급, 명령 재생기, 표시 표면, 자원 수명을 독립 작업으로 잡는다. 로컬 캐시의 라이브러리 없이 새로 생성한 호스트에서도 빌드할 수 있어야 한다. [현재 Skia 공급](Nelyx/skia/README.ko.md) · [GPU helper](Nelyx/engine/render/vulkan/gpu_context.h#L21) · [Tauri 의존성](Nelyx/backend/crates/tauri-plugin-nelyx-backend/Cargo.toml) |

Flutter에서는 `PlatformViewLayer`의 장면 삽입과 캡처 제약, Web의 그림·DOM 교차 배치, Android의 실제 뷰 위 전경 분할을 참고한다. Doroti에서는 등록 타입별 지원 판정과 장면을 구간으로 나누는 부분을 참고한다. Nelyx에는 CanvasKit 배경과 OS 전경 사이의 전송·표시 계약이 추가로 필요하다. [Flutter 레이어](https://api.flutter.dev/flutter/rendering/PlatformViewLayer-class.html) · [Flutter Web 합성](https://api.flutter.dev/flutter/widgets/HtmlElementView-class.html) · [Flutter Android 합성](https://docs.flutter.dev/platform-integration/android/platform-views) · [로컬 Doroti 구간 계획](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsPlatformViewHost.cs#L297)

## 2. 공통 동작 계약

- **생성과 수명.** 공개 `PlatformView`는 `key`, `viewType`, 최초 생성 인자, 이벤트, `fallbackBuilder`를 받는다. 상태가 `(ViewOwner.id, ViewOwner.generation, instanceId)`를 예약하고 양축이 유한한 첫 배치에서 숨겨진 컨트롤을 한 번 만든다. 이후 값 변경은 타입별 컨트롤러로 보낸다. 같은 소유자에서 State와 타입을 유지하면 이동·클립·재표시 때 같은 인스턴스를 쓴다. 0 크기·offstage에서는 표시·입력·접근성을 끄고, 소유자 종료·타입 교체 시 해제한다. 늦은 생성 성공도 회수하며 중복 해제는 한 번만 수행한다. 앱 루트의 `PlatformDispatcher` ID와 인스턴스 ID는 각각의 수명을 따른다. [루트 View 등록](Nelyx/sdk/src/runtime/bootstrap.ts#L313)
- **프레임.** 레이아웃과 위젯 콜백은 기존 트리에서 한 번 실행한다. 해당 `FrameBuildToken`에 그림 구간, 뷰 배치, 클립, 입력 영역을 함께 보관한다. 논리 좌표는 Surface 기준으로 유지하고 DOM에서 viewport 위치로, OS 어댑터에서 실제 부모 좌표로 바꾼다. 원래 뷰의 크기와 보이는 클립을 구분해 스크롤로 편집기의 절반이 잘려도 줄바꿈이 달라지지 않게 한다. [프레임 소유자와 metrics](Nelyx/src/ui/types.ts#L19) · [뷰포트 계산](Nelyx/sdk/src/backends/browser/services.ts#L150)
- **제출과 복구.** 배경과 전경에 같은 순번을 사용한다. direct는 해당 표면들이 제출된 뒤, worker는 해당 구간의 실제 제출 응답 뒤에 준비된 배치와 입력 영역을 적용한다. 준비 중 더 최신 프레임이 오면 독립적으로 재생 가능한 최신 전체 상태로 합친다. 거절·폐기·창 종료·context loss는 미적용 배치를 폐기하고 소유 자원을 회수한다. 한쪽만 적용된 상태에서는 어긋난 영역의 입력을 막고 마지막 유효 상태 또는 대체 화면을 복구한다. GPU fence는 자원 해제에 사용하며 실제 표시 시차는 별도로 측정한다. [프레임 제출](Nelyx/src/hosting/runtime.ts#L912) · [direct flush와 fence](Nelyx/skia/packages/web/src/surface.ts#L184)
- **가림과 대체.** 첫 합성 범위는 평행이동, 축 정렬 사각 클립, 같은 최상단에서의 일반 알파 합성이다. 그리기와 hit-test 경계를 재현할 수 없는 경우, 공급자가 없는 경우, 네이티브 자원 복원에 실패한 경우의 사유를 앱에 전달한다. 대체 위젯은 일반 위젯 build 단계에서 준비하고, 합성 중 지원 불가를 발견하면 입력부터 차단한 뒤 대체 장면을 제출한다. 실제 뷰와 대체 위젯 중 한쪽만 입력·접근성에 참여한다. 입력 중인 문서 값은 컨트롤러에 보관하고 IME 조합 종료는 OS의 결과를 따른다.
- **포인터와 보조기술.** 실제 표시할 배치에 대응하는 hit 영역을 호스트가 소유한다. down에서 정한 대상이 up·cancel까지 받는다. 모달 전환, 캡처 상실, 포커스 상실, 퇴장 때 취소·정리를 한 번 수행한다. Nelyx 포인터는 기존 `ViewRuntime.dispatchPointer`로, 원래 컨트롤의 입력은 OS 또는 DOM으로 보낸다. Nelyx → 편집기 → 다음 Nelyx 위젯의 Tab·역방향 탐색, IME, 스크린 리더를 각각 연결한다. [현재 입력 진입점](Nelyx/src/hosting/runtime.ts#L440)

## 3. 작업 순서와 완료 조건

W9-01과 W9-02가 공통 선행 작업이다. 이어서 W9-03은 같은 문서 안의 Web 경로를, W9-04는 W9-05·06이 사용할 네이티브 경로를 준비한다. 회귀 검증은 해당 플랫폼 통합 시점에 수행하고 후속 포트는 대상별로 완료 여부를 기록한다.

### W9-01 · Core 위젯, 렌더 객체, 팩터리

- [x] 새 공개 경로 `@nelyx/core/framework/widgets/platform-view`에 `PlatformView`를 추가하고 `RenderPlatformView`가 `alwaysNeedsCompositing`인 레이어를 삽입하게 한다. Core에 호스트 서비스 계약을 두고 SDK 부트스트랩이 각 View에 팩터리 등록·지원 조회·생성·갱신·해제 기능을 연결한다. OS와 DOM 객체는 해당 어댑터가 소유한다. [Core 패키지 exports](Nelyx/package.json) · [View 서비스](Nelyx/src/hosting/services.ts) · [SDK 부트스트랩](Nelyx/sdk/src/runtime/bootstrap.ts) · [레이어 삽입](Nelyx/src/framework/painting/context.ts#L274)
- [x] 호스트 대역으로 최초 생성 1회, 같은 키의 재정렬, 타입 변경, 다른 View에서 같은 인스턴스 번호, 무한 제약, 0 크기, 생성 중 dispose를 검사한다. 종료 후 남은 컨트롤과 이전 세대의 이벤트 반영은 각각 0건이어야 한다.

### W9-02 · 장면 분할과 프레임 수명

- [x] `SceneBuilder`의 retained recording에 뷰 표식을 추가한다. 원래 순서대로 `그림 → 뷰 → 그림`을 내보내고 각 구간에서 누적 변환·클립과 균형 잡힌 save/restore를 복원한다. 뷰를 포함한 조상의 단일 Picture 캐시에도 표식이 보존되어야 한다. 그룹 `saveLayer`·필터가 경계를 가로지르면 지원 판정으로 넘긴다. 뷰가 없는 프레임은 기존 단일 캔버스 경로를 사용한다. [retained 삽입](Nelyx/src/ui/scene.ts#L751) · [프레임 기록](Nelyx/src/ui/frame.ts#L482)
- [x] 공개 렌더러 알림의 기존 호출 순서를 보존하면서 direct·worker의 제출/폐기와 호스트 배치 수명을 연결한다. `RepaintBoundary` 아래에서 부모만 스크롤, 두 겹 클립, 입력만 막는 전경, 반환 순서 역전, 렌더러 교체를 확인한다. 실제 뷰 레이어의 `supportsRasterization()`은 false를 반환한다. `SnapshotWidget`에서는 기존 normal 오류, permissive의 실시간 그리기, forced에서 재현 가능한 Nelyx 픽셀만 캡처하는 결과를 각각 확인한다. [스냅샷 분기](Nelyx/src/framework/widgets/snapshot-widget.ts#L332) · [제출 순서 검사](Nelyx/eng/check-platform-view-lifecycle.mjs)

### W9-03 · Web과 Tauri DOM의 문서 내 합성

- [x] `ApplicationSurface`의 기존 viewport 안에 배경 캔버스, 뷰별 DOM 컨테이너, 필요한 전경 캔버스를 배치한다. 무가림은 한 장, DOM 위에 그릴 콘텐츠가 생기면 한 장을 추가한다. 두 캔버스가 하나의 앱·스케줄러를 사용한다. WebGL 자원은 컨텍스트별로 복원하고 worker 모드에서는 각 표시 캔버스의 OffscreenCanvas 소유권·교체·해제를 관리한다. StrictMode 재마운트와 워커 복구에서 편집기·구독이 이전 Surface에 남지 않아야 한다. [Surface 소유권](Nelyx/sdk/src/frontend/dom/surface.tsx#L24) · [OffscreenCanvas 이전](Nelyx/sdk/src/backends/browser/renderer.ts#L245) · [WebGL 표면](Nelyx/skia/packages/web/src/surface.ts#L48)
- [x] 전경 캔버스는 `pointer-events: none`으로 두고 지원하는 Nelyx hit 영역에만 입력용 DOM 요소를 배치한다. 표시된 버튼은 기존 제스처 경로에 연결하고, 장식·버튼 바깥은 HTML 컨트롤 또는 iframe이 직접 받는다. iframe 안에서 시작한 드래그는 해당 문서가 처리한다. 모달은 렌더링·차단 영역·Tab 범위를 함께 적용한다. 다른 출처 iframe과도 부모의 입력 영역만으로 동작해야 한다. [기존 캔버스 캡처](Nelyx/sdk/src/backends/browser/input.ts#L45) · [iframe 입력 제약](https://api.flutter.dev/flutter/widgets/HtmlElementView-class.html)
- [x] Testbed 3에 동일한 Nelyx 위젯 트리로 버튼·편집기·iframe 장면을 추가한다. 기존 WebView·Texture 데모의 동작을 회귀 비교에 쓴다. Chrome과 패키징한 WebView2에서 DOM 경로를 확인하고, 추가 캔버스가 생겨도 선택·접근성 요소와 Surface 크기가 맞아야 한다. [Testbed 화면](sample/nelyx-testbed-app-3/src/platform-views.ts) · [기존 호스트 예제](sample/nelyx-testbed-app-3/README.ko.md)
- [x] Testbed 3의 Playwright 검사에서 서로 다른 두 로컬 origin으로 iframe 삽입 허용·거부를 재현한다. 격리 배포(COOP/COEP)에서도 허용된 콘텐츠의 포인터 소유권과 대체 안내를 확인한다. 테스트 문서는 출처와 발신 창을 확인한 준비 메시지로 로드를 판정한다. 임의의 외부 문서에 대한 iframe의 load 이벤트만으로 삽입 성공을 단정할 수 없다. 외부 URL은 현재 샘플의 Web 대상 범위를 유지하고 Tauri에서는 로컬 문서로 같은 경로를 검사한다. [샘플의 대상 선택](sample/nelyx-testbed-app-3/src/webview-panel.tsx#L45) · [격리 환경](work3.md) · [CSP frame-ancestors](https://w3c.github.io/webappsec-csp/#directive-frame-ancestors)

### W9-04 · Tauri 등록과 네이티브 Skia 공급

- [x] 원본 생성기와 SDK 공급 경로에 Skia 소스 리비전, 빌드 옵션·GPU 백엔드, 대상 ABI, 해시·라이선스를 고정한다. 앱에 등록된 `viewType`과 창 기능으로 팩터리를 선택하고, 네이티브 전경을 쓰는 타깃에만 해당 라이브러리와 Rust 명령 권한을 넣는다. Web과 DOM 전용 Tauri 앱은 기존 CanvasKit 공급을 쓴다. [호스트 Cargo 생성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs) · [호출 WebView 검사](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/lib.rs#L66)
- [x] 초기 네이티브 디코더는 해당 배경과 짝을 이룬 전경의 소유자·세대·순번, 바이트 길이와 명령 수, 지원하는 op와 자원 참조를 검사한다. 사각형·선·알파·클립부터 재생하고, 도형이 `drawPicture`로 묶였을 때도 원본 명령을 펼쳐 그린다. 문자·이미지를 추가할 때는 원본 폰트·문단·이미지를 최초 등록 후 세대별로 참조한다. 프레임 IPC에는 그림 명령과 자원 참조를 싣고, 자원 해제는 두 소비자의 마지막 사용이 끝난 뒤 수행한다. 실제 호출 WebView·창·허용한 앱 페이지에 범위를 묶고, 패키징한 Windows와 Android에서 해제된 세대를 거절하는 것을 확인했다. [wire 정의](Nelyx/src/ui/web-frame-wire-format.ts) · [자원 복원 선례](Nelyx/sdk/src/backends/browser/render-worker-resources.ts#L94)
- [x] 패키징한 호스트가 현재 SDK 공급본만으로 실제 네이티브 Skia 표면에 도형을 그리는지 확인한다. 실행 중인 frontend build ID, 네이티브 라이브러리, 실제 선택한 경로를 대조한 뒤 OS 컨트롤과 통합한다.

### W9-05 · Windows 자식 HWND와 투명 Skia 전경

- [x] 실제 `EDIT`·`BUTTON`을 WebView2와 같은 부모 창에 만들고 기존 `windowsRetainedViewport`의 음수 X, DPR, 부모 client 원점을 반영한다. 일반 Tauri 창과 retained 창의 실제 자식 HWND를 열거했다. retained 창의 왼쪽 크기 변경은 WebView2와 세션이 소유한 자식 HWND만 있는 경우 `WVR_VALIDRECTS`로 정렬한다. [유효 사각형 적용](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs#L338) · [기존 네 모서리 분석](work7.md)
- [x] 부모 HWND의 최상단 대상에 네이티브 Skia 출력을 연결한 뒤 투명 자식 HWND에 별도 DirectComposition 대상을 두는 경로를 시험했다. 현재 전경은 자식 HWND의 알파 지원 표면에 표시한다. 버튼의 실제 hit 영역에 대응하는 OS 입력 경로를 두고 카드의 빈 곳에서는 원래 HWND가 입력을 받는다. 전경을 열 수 없는 호스트는 지원 사유와 사각형 슬롯 대체 동작을 제공한다. [DirectComposition 합성 순서](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createtargetforhwnd)
- [x] 실제 `EDIT` 위에 반투명 카드와 선 두 개로 만든 `+` 버튼을 그린다. 같은 편집기 핸들, 카드 알파와 커서, 버튼 클릭 1회, 빈 영역의 마우스·한글 입력, 모달 뒤 클릭 0회, 닫은 뒤 전경·입력 영역 제거를 확인했다. Skia 전경을 켜고 끈 동일 패키지·장면의 움직임과 메모리를 비교했다. 크기 변경 중의 동적 표시 수락은 §7에 남겼다.

### W9-06 · Android 자식 뷰와 전경 순서

- [x] Kotlin 플러그인이 기존 WebView의 부모 `ViewGroup`에 원래 크기의 `EditText`와 클립 컨테이너를 만든다. 투명 `TextureView`에 NDK Skia 출력을 연결하고 UI 스레드에서 뷰 배치·입력·IME 포커스를 관리한다. 표면 파괴와 Activity 재생성 때 이전 렌더 작업을 정리한 뒤 새 세대를 연결한다. [WebView 부모 접근](Nelyx/backend/crates/tauri-plugin-nelyx-backend/android/src/main/java/dev/nelyx/backend/SafeAreaPlugin.kt#L68) · [TextureView 제약](https://developer.android.com/reference/android/view/TextureView)
- [x] x86_64 에뮬레이터에서 터치·회전·키보드 인셋·백그라운드 복귀·퇴장 중 생성과 한글 IME 조합을 확인했다. 일반 View와 별도 `SurfaceView`의 전경 순서를 실제 화면에서 비교했다.
- [x] x86_64 에뮬레이터에서 TalkBack으로 전경 버튼과 실제 편집기를 탐색하고, 모달의 제목과 닫기 버튼까지 이동했다. 모달이 열린 동안 배경 컨트롤은 Android 접근성 트리에서 제외됐다.
- [x] 실제 지도 SDK 표면을 시험한다. x64 에뮬레이터의 Testbed 슬롯에서 MapLibre Native 13.6.1의 Vulkan `SurfaceView`와 `TextureView` 모드의 합성·입력을 확인했다.
- [x] Galaxy S25 ARM64에서 실제 터치와 MapLibre Native의 두 표면을 확인하고, 화면 녹화로 편집기와 전경의 표시 시차를 측정했다.
- [x] Galaxy S25 ARM64에서 TalkBack의 키보드 단축키와 가상 터치스크린 제스처로 `+`와 실제 편집기를 왕복했다. `+`를 한 번 실행했고 모달 제목과 닫기 버튼의 발화를 확인했다.

### W9-07 · 후속 네이티브 포트와 패키지 회귀

- [x] **iOS·macOS**는 Tauri `with_webview`에서 찾은 WKWebView와 같은 부모에 UIKit `UITextView` 또는 AppKit `NSTextView`와 투명 `CAMetalLayer`를 붙인다. 물리 픽셀을 point로 변환하고 AppKit 부모의 Y축 방향을 반영한다. iOS 소프트 키보드의 가림 영역을 전송하며 하드웨어 Tab과 Shift+Tab을 Nelyx 포커스 경로에 연결한다. [공통 Apple 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/apple_platform_views.rs) · [CAMetalLayer](https://developer.apple.com/documentation/quartzcore/cametallayer)
- [ ] **iOS**는 패키지에서 겹침·터치·키보드 인셋·IME·VoiceOver·화면 재진입을 확인한다. **macOS**는 실제 창에서 겹침·Y축·배율·탭 순서·선택 범위·VoiceOver를 확인한다.
- [x] **Linux**는 생성된 WebKitGTK 부모에서 GTK 편집기와 전경을 같은 `GtkOverlay`에 넣었다. X11과 Wayland에서 클립·포커스·클릭 통과와 투명 전경을 확인했다. [GTK 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/linux_platform_views.rs) · [GTK Overlay](https://docs.gtk.org/gtk3/class.Overlay.html)
- [x] Testbed 3의 재현 동선과 각 플랫폼의 지원 효과를 샘플 가이드에 반영한다. 일반 Nelyx 화면, 기존 iframe·Texture 예제, Demo의 Acrylic·텍스트 편집을 같은 SDK 공급본으로 회귀 확인한다. 플랫폼별 빌드, 기능, 접근성, 표시 성능과 미확인 조합을 이 문서에 기록한다.

## 4. 판정 기준

| 항목 | 통과 기준과 확인 방법 |
| --- | --- |
| 겹침과 입력 | 전경 버튼 클릭 1회에 Nelyx 콜백 1회, 뒤 컨트롤 0회. 빈 영역은 실제 편집기가 받는다. 모달이 열리면 뒤 컨트롤 클릭·Tab 진입 0회. 창 밖 드래그·취소·닫기 후에 이전 대상에 이벤트가 남지 않는다. DOM 이벤트와 실제 OS 입력을 각각 사용한다. |
| 상태와 접근성 | 같은 키 재정렬·스크롤·클립 후 동일 인스턴스와 편집 값·선택 유지. Tab/Shift+Tab 왕복, 한글 조합 확정·취소, 스크린 리더가 컨트롤을 한 번씩 읽는지 확인한다. 폼 값 대입만으로 IME 수락을 판정하지 않는다. |
| 위치와 표시 | 분수 DPR·모니터 이동·네 모서리 resize·스크롤 후 정지 상태의 경계 오차 목표는 물리 1px 이내다. 움직이는 동안 같은 화면 프레임에 잡힌 슬롯·OS 컨트롤·버튼의 상대 오차 p95/최대, 표시 간격 p95, 입력 지연, 추가 메모리를 전경 없는 동일 장면과 비교한다. Windows는 PowerShell 입력과 데스크톱 합성 캡처를 사용한다. 역방향 튐·오입력이 재현되면 해당 조합의 수락을 보류한다. |
| 경합과 자원 | 입력·모달 전환 중 resize, 오래된 worker 응답, 생성 중 제거, 부분 제출 실패, 그래픽 context loss, 창 닫기·재열기를 재현한다. 잔존 컨트롤·활성 입력 영역·미해제 lease는 해제 완료 후 0개다. 화면을 반복 왕복해도 OS/GPU 자원이 계속 증가하지 않아야 한다. |
| 일반 화면과 렌더 모드 | PlatformView가 없는 프레임은 추가 표면·배치 IPC 0건. direct·worker-transfer·worker-shared를 지원 환경에서 각각 선택해 **실제 선택된 경로**를 기록한다. `worker-shared`의 격리 요건, 기존 `auto` 대체, 앱·worker 종료 동작을 보존한다. |

## 5. 구현 후 실행할 검증 명령

저장소 루트의 PowerShell 기준이다. 변경 묶음별 코어 검사를 먼저 하고 Web·Windows·Android 공급 빌드는 각 경로가 통합된 시점에 실행한다. 아래 기존 검사는 wire·백엔드·패키지 회귀를 담당한다. §3의 새 겹침 장면은 Web에서는 Playwright로, Windows에서는 패키지와 OS 입력으로, Android에서는 대상 기기로 확인한다. 모든 검사는 저장소의 20분 제한을 적용하고 임시 프로필·캡처는 해당 실행 종료 시 정리한다. [검증 규칙](.github/copilot-instructions.md) · [20분 실행 래퍼](Nelyx/sdk/tooling/cli/src/commands.mjs#L22)

```powershell
npm.cmd run build:sdk
node --input-type=module -e "import {execute} from './Nelyx/sdk/tooling/cli/src/commands.mjs'; await execute(process.execPath, ['Nelyx/eng/check-web-frame-wire.mjs'])"
npm.cmd run build:web -- --app sample/nelyx-testbed-app-3
npm.cmd --prefix sample/nelyx-testbed-app-3 run typecheck
node Nelyx/eng/check-backend-web.mjs sample/nelyx-testbed-app-3
```

```powershell
npm.cmd --prefix sample/nelyx-testbed-app-3 run prepare:tauri -- --platform windows
npm.cmd run build:tauri -- --app sample/nelyx-testbed-app-3 --platform windows
node Nelyx/eng/check-tauri-windows.mjs sample/nelyx-testbed-app-3 --render-mode=direct
```

같은 Windows 패키지에서 `--render-mode=worker-transfer`와 `--render-mode=worker-shared`도 확인한다. 기존 Windows 검사는 패키지 정보와 frontend build ID를 대조한다. 네이티브 Skia 라이브러리의 식별값과 실제 HWND·전경 선택 결과는 W9에서 여기에 추가한다. [Windows 검사 진입점](Nelyx/eng/check-tauri-windows.mjs#L33)

```powershell
adb devices -l
npm.cmd --prefix sample/nelyx-testbed-app-3 run prepare:tauri -- --platform android --architecture x64
npm.cmd run build:tauri -- --app sample/nelyx-testbed-app-3 --platform android --architecture x64 --apk-only
```

에뮬레이터 실행은 샘플의 `run:tauri -- --platform android --device <ADB 시리얼>`을 사용한다. 실기기에서는 준비·빌드의 아키텍처를 `arm64`로 바꾸고 해당 시리얼로 실행한다. [Android 실행 예](sample/nelyx-demo-app/README.ko.md#android에서-실행)

`node Nelyx/eng/check-tauri-android-platform-views.mjs <ADB 시리얼> --lifecycle`은 기기가 보고한 ABI에 맞는 Debug APK를 설치하고 실행 중인 Skia 공급과 Testbed 빌드를 대조한다. [Android 실제 컨트롤 검사](Nelyx/eng/check-tauri-android-platform-views.mjs)

Apple Silicon Mac에서 Xcode와 iOS Simulator 런타임을 준비한 뒤 저장소 루트에서 실행한다.

```sh
npm run build:tauri -- --app sample/nelyx-testbed-app-3 --platform macos
npm --prefix sample/nelyx-testbed-app-3 run run:tauri -- --platform macos
npm run build:tauri -- --app sample/nelyx-testbed-app-3 --platform ios --architecture arm64-sim
npm --prefix sample/nelyx-testbed-app-3 run run:tauri -- --platform ios --architecture arm64-sim
```

**Composited views**에서 Mac은 **Open AppKit editor demo**, iOS는 **Open UIKit editor demo**를 연다. `+`와 편집기의 클릭·터치, 스크롤 클립, 모달 복귀, Tab 왕복을 확인한다. iOS에서는 키보드를 열고 닫을 때 편집기가 가려지는지 확인하고, Mac에서는 배율이 다른 화면을 오가며 편집기 선택과 슬롯 경계를 확인한다.

## 6. 첫 구현 이후의 결정

- **여러 네이티브 뷰 사이의 전경**은 `뷰 A → Nelyx 카드 → 뷰 B → 메뉴`가 실제 같은 위치에서 교차하는 장면으로 판단한다. OS가 중간에 표면을 삽입할 수 있는지, 표면 재사용과 메모리 비용, 클릭 순서까지 확인한 뒤 지원 범위를 넓힌다.
- **효과와 영상**은 반투명 색·직사각 클립부터 제공한다. 지도 아래 픽셀이 필요한 backdrop blur나 표면을 가로지르는 그룹 투명도는 OS 합성 효과 또는 공급자가 제공하는 프레임이 있어야 한다. 카메라·영상 자막은 별도 텍스처 경로에서 프레임 운반 비용과 수명을 평가한다.
- **네이티브 주 렌더러 전환**은 전경 재생 범위, WebView↔네이티브 전송량, 중복 자원, 텍스트 기준선·성능 측정값을 바탕으로 결정한다. W9의 전경 수락은 해당 OS·표면·명령 범위에만 적용한다.

## 7. 실행 현황

| 작업 | 구현 및 확인 범위 |
| --- | --- |
| W9-01 | 공개 `PlatformView`, View 세대별 등록·컨트롤러, 유한 배치에서의 지연 생성과 늦은 해제를 구현했다. 대역 검사에서 중복 생성·해제, 0 크기, 이전 세대의 이벤트, 생성 완료 전 퇴장을 확인했다. [Core 수명 검사](Nelyx/eng/check-platform-view-core.mjs) |
| W9-02 | retained 그림에 위치·순서를 유지하고 실제 direct 제출 또는 worker 제출 응답 때 배치를 적용한다. 두 겹 클립, 조상만 이동하는 retained 뷰, 모달 차단 순서, 스냅샷 모드와 그룹 효과의 대체를 검사했다. [장면 분할](Nelyx/src/ui/platform-view-scene.ts) |
| W9-03 | Chrome 빌드 `e5ae0b22df22`에서 direct·worker-transfer·worker-shared, 교차 출처 iframe 허용·거부, 스크롤·재정렬·이름이 있는 모달·Tab을 확인했다. direct에서 WebGL 컨텍스트 복구 후 동일 편집기·입력값·버튼을 확인했다. StrictMode 수명 검사에서 direct·worker-transfer와 worker WebGL 복구를 확인했다. Windows WebView2 패키지 `b449bdf77bbd`에서 세 렌더 경로와 로컬 iframe을 검사했다. [Testbed 안내](sample/nelyx-testbed-app-3/README.ko.md) · [DOM 검사](Nelyx/eng/check-platform-views-dom.mjs) |
| W9-04 | Tauri는 창별로 등록한 네이티브 뷰만 열 수 있다. 패키징 전에 고정한 바이트 길이·해시를 검사하고, Web v1 그림 본문과 버전이 지정된 배치·입력 정보를 보낸다. CPU Skia는 사각형·둥근 사각형·선·사각 클립·평행이동·알파를 재생한다. [공급 매니페스트](Nelyx/sdk/tooling/cli/templates/tauri/skia-foreground/supply.json) |
| W9-05 | Windows x64 패키지 `b449bdf77bbd`의 세 렌더 모드에서 실제 `EDIT` 위 카드의 알파, PowerShell `+` 클릭 한 번, 편집기 입력과 Win32 커서, Tab·Shift+Tab, 이름이 있는 모달과 동일 편집기 HWND 복귀를 확인했다. UI Automation에서 전경 창은 키보드 포커스를 받지 않았다. 전경 끄기·모달·퇴장 뒤 해당 전경 HWND가 제거되는 것을 확인했다. 독립 Rust 검사에서 자식 창의 배치 순서, 픽셀 재사용, 부분 클립과 전경 HWND·포인터 캡처 해제를 확인했다. [Win32 검사](Nelyx/eng/fixtures/testbed-win32-platform-views.mjs) |
| W9-06 | Android 패키지 `b449bdf77bbd`의 direct 모드를 x64 에뮬레이터와 Galaxy S25 ARM64에서 확인했다. 실제 `EditText`와 Skia `TextureView`, `+` 터치 한 번, 카드 픽셀, 키보드 인셋과 모달 뒤 0, 모달·회전·백그라운드 복귀 후 값 유지 및 이전 소유자 거절을 확인했다. x64·ARM64 APK의 v2 서명과 SHA-256, 지정 ABI의 ELF 라이브러리 한 개를 대조했다. 이전 DOM 공급 `ac6c5a30df85`에서 HTML 편집기와 로컬 iframe을 확인했다. [Android 호스트](Nelyx/sdk/tooling/cli/templates/tauri/android/PlatformViewsPlugin.kt) · [Android 검사](Nelyx/eng/check-tauri-android-platform-views.mjs) |
| W9-07 | Linux x64 패키지 `b633c8ab4b68`의 DEB에서 꺼낸 실행 파일로 `GtkTextView`와 Skia 전경을 Xvfb X11·Sway Wayland에서 확인했다. Chrome direct에서 Testbed 3 기존 WebView와 Texture를 확인했다. Windows Demo 패키지 `9b4bd1fae5cd`에서 Acrylic 왕복 전환과 Material 입력란의 한글 입력을 확인했다. Apple AppKit·UIKit 호스트와 Skia Metal 전경을 추가했으며 Xcode에서 링크·실행·실제 입력을 확인하는 단계가 남아 있다. |

네이티브 첫 경로는 한 번에 컨트롤 하나와 최상단 투명 전경 하나를 사용한다. Windows는 CPU Skia의 BGRA 픽셀을 D3D11에 업로드하고, Android는 JNI의 RGBA 픽셀을 `TextureView`에 게시한다. Linux는 BGRA 픽셀을 Cairo 표면으로 `GtkOverlay`에 그린다. Apple 호스트는 클립 범위의 BGRA 픽셀을 Metal로 `CAMetalLayer`에 복사한다.

Apple용 Skia 아카이브 다섯 개의 바이트 길이와 SHA-256을 검증했다. 생성한 Testbed 3의 `main` 뷰에 Apple 명령 권한이 붙고 Windows 호스트에는 붙지 않는 것을 확인했다. Windows에서 동일 Cargo 잠금 파일로 `cargo check --locked --lib`를 실행해 macOS ARM64·x64, iOS 기기 ARM64, iOS Simulator ARM64·x64 타깃을 확인했다. Xcode 링크·번들링과 실제 UIKit·AppKit 입력 및 합성은 남아 있다. [Apple Skia 공급](Nelyx/sdk/tooling/cli/templates/tauri/skia-foreground/supply.json) · [호스트 생성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs)

Win32 편집기의 접근성 이름은 같은 부모의 보이지 않는 `STATIC`에서 가져온다. 네이티브 UI Automation 클라이언트에서 이름과 기본 Document 역할, Text·Value 패턴을 확인했다. 패키지 세 모드의 회귀 검사에서 UI Automation에 보이는 편집기는 한 개였고 MSAA 이름과 Text 역할이 확인됐다. 모달을 열면 보이는 편집기가 0개, 닫으면 같은 HWND 한 개로 복구됐다. 이 검사는 UI Automation·MSAA 노출과 탐색 범위를 확인한다. [Win32 접근성 검사](Nelyx/eng/fixtures/testbed-win32-controls.ps1) · [Microsoft Win32 레이블 안내](https://learn.microsoft.com/en-us/windows/win32/winauto/ensure-that-ui-elements-are-named-correctly)

Windows 내레이터 `10.0.26100.9949`의 음성 요약에서 모달 이름이 `알림 그룹`으로 읽히는 것을 확인했다. 브라우저 어댑터에서 `SemanticsRole.alertDialog`를 `alertdialog`로 전달하고, Material `AlertDialog`의 역할과 접근성 이름을 같은 시맨틱 노드에 배치했다. Testbed의 모달 이름은 화면 제목 `Composited views modal`과 같다. [브라우저 접근성 역할](Nelyx/sdk/src/backends/browser/interaction.ts) · [Material 모달](packages/material/src/dialog.ts) · [WAI-ARIA 알림 대화상자 패턴](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)

수정한 Windows x64 패키지 `b449bdf77bbd`의 direct 모드에서 실제 편집기를 클릭하고 Tab으로 전경 버튼에 이동했다. 내레이터 음성 요약에 `Composited Win32 editor`와 `Add above editor`가 각각 한 번 남았다. Enter로 모달을 열고 Tab을 누르자 `Composited views modal 알림 대화상자`와 `Close modal`이 각각 한 번 기록됐다. 모달이 열린 동안 편집기는 숨겨졌고, 닫자 동일한 HWND가 돌아왔다. 검사 뒤 내레이터를 기존의 꺼짐 상태로 복원했다. [내레이터 음성 요약 단축키](https://support.microsoft.com/en-us/accessibility/windows/narrator/appendix-b-narrator-keyboard-commands-and-touch-gestures)

별도로 열리는 Testbed 3 네이티브 편집기 화면에 Material의 본문·제목 스타일과 표면색을 적용했다. [네이티브 편집기 화면](sample/nelyx-testbed-app-3/src/platform-views.ts)

Windows Microsoft IME에 가상 키를 보내 `하`를 조합한 뒤 Backspace로 지웠고, 다시 `한글`을 조합해 확정한 문자열을 Win32 `EDIT`에서 확인했다. Android는 기본 소프트 키보드 인셋과 키 입력 전달을 확인했다. x64 패키지 `b633c8ab4b68`로 실행한 별도 테스트 IME가 에뮬레이터의 `EditText`에 `InputConnection`으로 `ㄴ → 뉴 → 뉼`을 보내는 동안 조합 문자열을 읽고, 취소 시 원문 복원과 재조합 후 `뉼릭스` 확정을 확인했다. 같은 테스트에서 회전과 모달 후 값이 유지됐고 기존 키보드를 복원했다. Galaxy ARM64 결과는 아래에 기록했다. Apple VoiceOver 확인이 남아 있다.

Android x64 에뮬레이터의 TalkBack 14.2에서 패키지 `67fc51553709`는 모달 열기 버튼 다음 스와이프에 이름 없는 편집기 자리로 이동했다. 패키지 `9673bd65950a`는 실제 DOM 컨트롤을 연결한 자리를 접근성 트리에 노출한다. Android의 실제 편집기는 OS 트리에 한 번 나타나며, Web에서 표시 중인 HTML 편집기는 `aria-owns` 연결을 유지한다. [DOM 접근성](Nelyx/sdk/src/backends/browser/interaction.ts) · [뷰 연결](Nelyx/sdk/src/backends/browser/platform-views.ts)

수정한 APK의 SHA-256과 실행 중 frontend build ID를 대조한 뒤, 에뮬레이터 터치스크린의 오른쪽 스와이프로 오버레이 숨기기 → 모달 열기 → `+` → `EditText`에 도달했다. 각 이동에서 해당 컨트롤의 접근성 포커스 이벤트가 한 번 발생했다. 왼쪽 스와이프는 `+`와 모달 열기로 돌아왔고, `+`에 대한 더블 탭은 카운터를 한 번 올렸다. 더블 탭으로 모달을 열고 스와이프로 제목과 닫기 버튼에 도달했다. 모달이 열리면 Android 접근성 트리에서 배경 편집기와 버튼이 사라졌고, 닫은 뒤 편집기 한 개와 같은 카운터 값이 돌아왔다.

TalkBack 음성 출력 자막에서 오버레이 숨기기, 모달 열기, `+`, 실제 편집기의 영문 본문, 모달 제목과 본문, 닫기 버튼을 확인했다. 모달 안의 이름 없는 그룹 포커스가 일부 남아 있다. 편집기의 한글 자막은 앞선 빌드에서 확인했다. 검사 후 TalkBack 서비스와 음성 자막 설정을 복원했다. [TalkBack 탐색 안내](https://support.google.com/accessibility/android/answer/6151827?hl=en)

Android 키보드가 열린 상태에서 모달을 접근성 버튼의 동작으로 열면 `48365ae69270`에서는 실제 편집기를 가린 뒤에도 키보드가 남았다. `67fc51553709`에서는 화면에서 숨기거나 제거하는 편집기가 포커스 또는 활성 입력 연결을 소유할 때 Android에 IME 닫힘을 요청한다. 같은 에뮬레이터 검사에서 키보드가 닫히고 인셋이 0으로 돌아왔으며, 모달을 닫은 뒤 편집 값이 유지됐다. [Android 입력기 표시 제어](https://developer.android.com/develop/ui/views/touch-and-input/keyboard-input/visibility) · [회귀 검사](Nelyx/eng/check-tauri-android-platform-views.mjs)

패키지 `b449bdf77bbd`의 x64 Debug APK를 증분 빌드했을 때 ZIP 내부에 137,549,024바이트의 빈 구간이 생겨 파일이 282,378,592바이트였다. 기본 Gradle 프로젝트는 Nelyx 패키지 캐시가 빗나갈 때 생성된 Debug APK를 새로 쓰고, 캐시가 적중하면 서명과 ABI를 검사해 패키지를 재사용한다. `x64 → arm64 → x64` 순서에서 새 APK 크기는 각각 144,833,964바이트와 144,847,991바이트였고 마지막 x64 빌드는 Gradle 호출 없이 같은 SHA-256을 재사용했다. 각 APK의 SHA-256과 지정 ABI의 ELF 한 개를 확인했다. [Tauri 패키징](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs) · [Android Zipflinger 증분 갱신](https://android.googlesource.com/platform/tools/base/+/refs/heads/mainline-prod/zipflinger/)

Galaxy S25 `SM-S931N`의 Android API 37에서 ARM64 Debug APK `b449bdf77bbd`를 USB로 설치했다. 기기 `base.apk`의 SHA-256은 `4d1c7b0fcc7326a44c7c5234ebee248a8b0c01e0a975b161b49f6327ca242a66`으로 공급과 같았고, 실행 중 빌드 ID와 `aarch64-linux-android` Skia 공급도 일치했다. direct 모드의 실제 `EditText` 위에서 ADB 터치 `+` 한 번에 카운터가 한 번 증가했고, 카드 RGB는 `(213, 206, 236)`, 카드 제거 뒤 같은 픽셀은 `(255, 255, 255)`였다. 키보드 인셋은 293 논리 px였고, 이름이 있는 모달을 열면 편집기가 숨고 인셋이 0으로 돌아왔다. 모달·회전·백그라운드 복귀 뒤 편집값을 확인했고 퇴장 뒤 이전 소유자의 생성 요청은 거절됐다. [실기기 검사](Nelyx/eng/check-tauri-android-platform-views.mjs)

갤럭시의 기본 삼성 한글 키보드에서 `ㅎ`, `ㅏ`, `ㄴ`을 차례로 눌러 실제 `EditText`에 `한`이 나타나는 것을 확인했다. 키보드의 삭제 키로 빈 값으로 돌아간 뒤 `한글`을 다시 입력했고, 키보드를 닫은 뒤에도 같은 값이 남았다.

같은 Galaxy의 가로 화면에서 카드 켬·끔으로 96 물리 px 터치 스크롤을 양방향 두 번씩 재현하고, `screenrecord` 1560×720 영상에서 편집기와 `+` 경계를 비교했다. 편집기 이동 범위는 양쪽 모두 36 물리 px였다. 두 경계를 읽을 수 있는 전경 켬 프레임은 200장 중 80장이었고, 편집기만 읽은 전경 끔 프레임은 192장 중 73장이었다. 인접한 편집기 위치 갱신 중 180ms 이내 간격의 p95는 켬 41.68ms, 끔 16.54ms였다. 전경 켬 상태의 이동 구간에서 편집기와 `+`의 세로 상대 오차는 p95 9px, 최대 10.5px였다. 기기 화면 녹화의 타임스탬프를 사용했고 패널 주사·물리 입력 지연은 별도 측정이 필요하다.

같은 앱 프로세스에서 전경 켬과 끔을 세 번씩 번갈아 적용했다. 전환 후 550ms에 Android `dumpsys meminfo`로 읽은 전체 PSS 차이는 짝마다 +29.4MiB, +35.8MiB, +26.0MiB였다. `Graphics`는 첫 쌍에서 −0.1MiB, 다음 두 쌍에서 +18.9MiB와 +18.5MiB였다. 이 값은 메인 앱 프로세스의 순간 표본이다.

전경 켬·끔의 입력 표시 지연 비교는 남아 있다. 편집기를 비우고 반복 가상 키를 보내는 계측에서 `EditText`의 글자 변경을 재현하지 못했다. IME를 연 조건의 한 시도에서는 Android 입력 포커스가 WebView로 이동했다. 따라서 녹화 프레임의 글자 표시를 해당 키 입력과 비교할 수 있는 표본이 없다.

Galaxy의 TalkBack `17.1.0.1003738110`과 Android System WebView `157.0.8103.50` 조합에서 실제 `EditText`가 접근성 포커스를 받았고, 음성 출력 자막에서 영문·한글 본문을 확인했다. 이름 있는 `Hide overlay`, `Add above editor`, `Open composited views modal`은 Android 접근성 트리에 나타났다. `uinput` 테스트 터치스크린의 탐색 제스처에서는 WebView와 이름 없는 그룹이 포커스를 받았으며 세 버튼의 발화와 동작은 확인되지 않았다. 실제 편집기를 제거하고 같은 WebView에 표시한 기본 HTML 버튼 두 개도 가상 터치 탐색으로 이름을 읽지 못했다. 계측기를 종료하고 TalkBack 자막을 관찰하는 조건에서도 이름이 나오지 않았다. 검사 뒤 가상 터치스크린과 계측 APK를 제거하고 TalkBack 서비스와 자막 설정을 복원했다. [Android 테스트 입력](https://android.googlesource.com/platform/frameworks/base/+/HEAD/cmds/uinput/) · [TalkBack 탐색](https://support.google.com/accessibility/android/answer/6151827?hl=en)

같은 Galaxy와 APK `b449bdf77bbd`에서 Android `uinput`이 외장 키보드로 등록한 장치로 TalkBack 단축키를 보냈다. Action+오른쪽 화살표로 `Hide overlay`, `Open composited views modal`, `Add above editor`, 실제 `EditText`에 차례로 이동했다. 각 이동의 대상은 Android 접근성 포커스 이벤트로 대조했다. Action+왼쪽 화살표로 `+`에 돌아와 Action+Space를 눌렀을 때 카운터가 한 번 증가했다. 역방향으로 모달 열기 버튼에 돌아가 모달을 열자 배경 편집기와 전경 버튼이 접근성 트리에서 사라졌다. 음성 출력 자막에 모달 제목과 `Close modal`이 표시됐고, 단축키로 닫은 뒤 편집기 한 개와 클릭값 1이 유지됐다. 모달 탐색에는 이름 없는 그룹도 포함됐다. [TalkBack 키보드 단축키](https://support.google.com/accessibility/android/answer/6110948?hl=en) · [Android 가상 입력 장치](https://android.googlesource.com/platform/frameworks/base/+/HEAD/cmds/uinput/)

이어서 가상 키보드를 등록하지 않은 상태에서 앱을 새로 열고 테스트 터치스크린을 사용했다. 화면 상단에서 첫 터치 탐색을 보낸 뒤 105–125ms 오른쪽 스와이프로 `Hide overlay` → 모달 열기 → `+` → `EditText`에 이동했다. 왼쪽 스와이프로 `+`에 돌아가 더블 탭했을 때 `TYPE_VIEW_CLICKED`는 한 번이었고 카운터가 1이 됐다. 더블 탭으로 모달을 열고, 오른쪽 스와이프로 제목과 닫기 버튼에 이동해 모달을 닫았다. 음성 출력 자막에 `+`, 편집기의 영문·한글 본문, 모달 제목과 닫기 버튼이 표시됐다. 모달 전환 동안 배경 노드가 빠졌다가 편집기 한 개와 클릭값 1이 돌아왔다. 가상 입력 장치·계측 APK를 제거하고 TalkBack 서비스와 자막 설정을 복원했다. 이 검사는 실제 Galaxy에서 Android 입력 장치를 통해 보낸 제스처를 사용했다. [TalkBack 제스처](https://support.google.com/accessibility/android/answer/6151827?hl=en)

Android x64 Testbed의 실제 편집기 슬롯에 검사용 `SurfaceView`를 끼워 같은 전경을 합성했다. 기본 표면에서 바탕 RGB `(0, 121, 132)`, 반투명 카드 `(39, 115, 152)`, 버튼 `(78, 60, 126)`을 읽었다. `setZOrderOnTop(true)`에서는 세 지점 모두 표면색이었다. 공개 Android 등록 타입은 `nelyx.android.edit`다. [Android SurfaceView 표면 순서](https://developer.android.com/reference/android/view/SurfaceView#setZOrderOnTop(boolean))

x64 패키지 `67fc51553709`의 같은 슬롯에 임시 계측 APK로 MapLibre Native `org.maplibre.gl:android-sdk:13.6.1`의 `MapView`를 넣었다. 기본 Vulkan `SurfaceView`와 `textureMode(true)`로 얻은 `TextureView`에서 오프라인 스타일 위에 Nelyx 카드와 `+`를 합성했다. 두 조합에서 바탕·카드·버튼은 각각 `#007884`, `#277298`, `#4e3c7e`였다. Android 터치로 `+`를 모드별로 한 번씩 눌렀고, 버튼 밖의 드래그에서 지도 카메라 경도가 약 0.060° 바뀌는 동안 클릭 횟수는 그대로였다. `ACCESS_NETWORK_STATE`는 계측 세션에서만 부여했다. [MapLibre Android 공급](https://maplibre.org/maplibre-native/android/examples/data/rendering-engine/) · [MapLibre TextureView](https://maplibre.org/maplibre-native/android/api/-map-libre%20-native%20-android/org.maplibre.android.maps/-map-libre-map-options/texture-mode.html)

Galaxy S25 ARM64의 패키지 `b449bdf77bbd`에서도 같은 SDK의 `MapLibreVulkanSurfaceView`와 `android.view.TextureView`를 Testbed 슬롯에 넣었다. 두 모드에서 바탕·카드·버튼 픽셀은 각각 `#007884`, `#277298`, `#4e3c7e`였다. 모드마다 `+` 터치가 콜백을 한 번 실행했고, 버튼 밖 드래그에서 지도 경도가 0.05997° 바뀌는 동안 카운터는 그대로였다. 계측 APK를 제거한 뒤 공식 Testbed를 다시 실행했다.

Chrome의 React 개발 루트에서 direct와 worker-transfer의 StrictMode 효과 반복과 재마운트를 확인했다. 각 Surface의 편집기를 한 번 생성·해제했고, 이전 편집기의 구독과 캔버스를 회수했다. worker-transfer에서는 실제 제출 응답 순서를 뒤집어 최신 배치 유지를 확인하고, WebGL 상실로 워커와 캔버스가 교체됐을 때 같은 편집기와 값이 복구되는 것을 확인했다. [수명 및 제출 순서 검사](Nelyx/eng/check-platform-view-lifecycle.mjs)

Linux x64는 GTK 3.24.52와 WebKitGTK 2.52.6에서 ELF와 DEB를 생성했다. Xvfb에는 XTest, Sway에는 Wayland 가상 입력 장치를 사용했다. x64 DEB의 두 환경에서 `+` 한 번, 흰 편집기 위 카드 RGB `(213, 206, 236)`, 전경 제거 뒤 같은 지점 `(255, 255, 255)`을 확인했다. 앞선 `6ec3ea282b21`에서는 카드 아래 편집기 선택과 입력, Tab 왕복, 모달과 동일 편집기 복귀도 확인했다. 원래 높이 168px인 편집기의 표시 영역을 44px로 줄인 뒤 스크롤과 창 크기를 복원해 입력값을 확인했다.

Linux x64 DEB `b633c8ab4b68`의 SHA-256과 추출 ELF의 GNU build ID를 확인한 뒤 Xvfb와 독립 D-Bus 세션에서 AT-SPI를 검사했다. `Composited GTK editor`라는 이름의 편집 가능한 Text 컨트롤은 한 개였고, `Add above editor`의 접근성 동작으로 카운터가 한 번 증가했다. 모달 제목과 닫기 버튼이 노출되고, 모달이 열린 동안 배경 편집기와 전경 버튼이 탐색 범위에서 빠졌다. 닫은 뒤 동일 AT-SPI 편집기 객체가 돌아왔다. [AT-SPI 접근성 객체](https://gnome.pages.gitlab.gnome.org/at-spi2-core/libatspi/class.Accessible.html)

같은 Linux x64 DEB를 Orca 50.3과 Speech Dispatcher 0.12.1의 독립 세션에서 실행했다. AT-SPI로 편집기와 전경 버튼에 포커스를 옮겼고, Orca의 발화 로그에 `Composited GTK editor`와 편집기 한글 본문, `Add above editor`가 각각 한 번 기록됐다. 모달은 AT-SPI 탐색까지 확인했다. [Orca와 Speech Dispatcher](https://orca.gnome.org/source)

Linux ARM64는 Ubuntu 교차 빌드로 공급 `00a9dd628d09`의 ELF와 DEB를 생성했다. `readelf`와 `dpkg-deb`로 AArch64·arm64를 확인했고 DEB의 SHA-256은 `ee9a57cbe7b584707ed736ed4f2e9d503edc786ef7982c3ac0225a16b0b463a3`이다. DEB에서 추출한 실행 파일을 QEMU 사용자 모드와 Xvfb에서 실행해 Testbed 3 창과 ARM64 WebKit 하위 프로세스 시작을 확인했다. 이 조합의 물리 장치 합성과 입력 시험은 남아 있다.

### Windows 크기 변경과 입력 측정

기준 패키지 `b633c8ab4b68`의 일반 창과 retained 창은 같은 프런트엔드를 사용했다. 200%와 125% 모니터를 실제로 이동했다. Win32 `EDIT`와 `BUTTON`은 WebView2와 같은 부모에서 생성됐고, 정지 상태의 경계 오차는 0–1 물리 px였다. retained WebView2의 부모 기준 X는 각각 −255px와 −57px였다. 두 창에서 실제 마우스로 `BUTTON`을 눌러 콜백 한 번을 확인했다.

200% 화면에서 네 모서리 각각에 60 Hz로 가로 약 ±98px와 세로 약 ±59px의 대각선 움직임을 보냈다. 같은 DXGI Desktop Duplication 이미지에서 WebView2 슬롯 기준 표식, `EDIT`의 흰 경계, `+` 버튼의 경계를 읽었다. 다음 표의 시간은 `EDIT` 화면 갱신 간격 p95이고, 위치는 전경을 켠 상태에서 기준 표식과 편집기 오른쪽 경계 사이 상대 오차 p95/최대다. [DXGI 합성 화면 타임스탬프](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/ns-dxgi1_2-dxgi_outdupl_frame_info)

| 모서리 | 일반 창 전경 켬 / 끔 ms | retained 창 전경 켬 / 끔 ms | 일반 창 오차 px | retained 창 오차 px |
| --- | ---: | ---: | ---: | ---: |
| 왼쪽 위 | 13.9 / 15.9 | 19.2 / 18.2 | 28 / 28 | 28 / 41 |
| 오른쪽 위 | 13.8 / 14.4 | 19.4 / 18.5 | 28 / 44 | 15 / 27 |
| 왼쪽 아래 | 18.1 / 13.9 | 19.4 / 18.5 | 28 / 42 | 28 / 29 |
| 오른쪽 아래 | 31.4 / 29.9 | 32.7 / 37.8 | 28 / 44 | 16 / 16 |

125% 왼쪽 위 드래그에서 오른쪽 오차 p95/최대는 일반 창 27/42px, retained 창 28/29px였다. 정지 상태에서 키 입력 후 `EDIT` 픽셀이 바뀔 때까지 걸린 시간은 전경 켬/끔 각각 일반 창 11.1/16.3ms, retained 창 9.5/11.2ms였다. 조건별 5번의 가상 키 입력을 사용했다. 같은 정지 위치에서 읽은 앱과 WebView2 자식 프로세스의 GPU 커밋 메모리는 전경을 켰을 때 각각 약 17.1MiB와 14.3MiB 높았다. GPU 카운터는 프로세스 트리의 한 시점이다.

후속 패키지 `00a9dd628d09`에서는 표시 중인 편집기·전경·클릭 영역을 마지막 프레임의 WebView 좌표에 보관하고, retained WebView2의 위치나 클립이 바뀌면 그 좌표를 새 부모 영역에 적용한다. 클릭 영역이 움직이면 진행 중인 포인터를 취소한다. 새 Skia 픽셀은 먼저 업로드하고 Win32 자식 배치를 끝낸 후 DirectComposition에 표시를 커밋한다. `WVR_VALIDRECTS`를 자식 컨트롤이 있는 창으로 확대하는 시도는 일부 모서리의 화면 갱신 간격이 늘어 제외했다. [Windows 호스트 배치](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_platform_views.rs#L270) · [전경 커밋](Nelyx/sdk/tooling/cli/templates/tauri/skia-foreground/src/win32.rs#L183)

같은 후속 패키지의 일반 창과 retained 창에서 두 배율의 정지 경계 오차는 0–1px였다. 200%에서 두 창의 실제 `BUTTON`을 각각 눌러 콜백 한 번을 확인했다. 200% retained 창 왼쪽 위·아래의 `+` 가로 이동 폭은 기준 재측정의 43px에서 각각 31px와 29px로 줄었다. 같은 화면에서 실제 CanvasKit 버튼 테두리와 `EDIT` 오른쪽 픽셀을 비교한 결과는 다음과 같다. 이동 중 모든 경계가 읽힌 DXGI 프레임을 사용했다.

| 조건 | CanvasKit과 EDIT 오차 p95/최대 px | EDIT와 + 오차 p95/최대 px |
| --- | ---: | ---: |
| 일반 200%, 왼쪽 위 | 28 / 42 | 0 / 42 |
| 일반 200%, 왼쪽 아래 | 28 / 42 | 0 / 14 |
| retained 200%, 왼쪽 위 | 35 / 43 | 34 / 43 |
| retained 200%, 왼쪽 아래 | 28 / 42 | 28 / 42 |
| 일반 125%, 왼쪽 위 | 16 / 31 | 14 / 21 |
| retained 125%, 왼쪽 위 | 21 / 29 | 16 / 28 |

200% 오른쪽 모서리도 전경을 켜고 끈 상태에서 시험했다. 전경을 켠 retained 창의 오른쪽 아래에서 CanvasKit과 `EDIT` 오차가 최대 58px였다. 왼쪽 모서리에서 역방향 움직임이 남아 동적 표시 수락은 보류한다. 같은 패키지 화면을 8번 왕복했으며 퇴장 후 매번 WebView2만 남았다. 호스트 GDI 객체는 19개였고 USER 객체와 프로세스 핸들은 각각 38–39개, 380–382개 범위에서 마지막 5회 같은 값이었다. 장시간 GPU 메모리 추적은 남아 있다.

패키지 `f8c3458fdb1b`는 왼쪽 드래그로 retained 가로 원점이 바뀌는 창에 자식 HWND가 여러 개 있으면 실제 위치를 적용한 뒤 WebView2에 크기를 보낸다. 이때 `WM_SIZING`의 제안 크기와 `DwmFlush` 대기를 생략한다. `WM_NCCALCSIZE`의 valid-rect 보정도 같은 자식 수 조건을 사용한다. [Windows 리사이즈 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs#L171) · [DwmFlush](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmflush)

패키지 `48365ae69270`과 `f8c3458fdb1b`를 같은 Testbed 장면의 direct 모드에서 비교했다. 모서리마다 60Hz로 가로 ±98px와 세로 약 ±59px의 드래그를 보내고, 전경을 켰을 때 한 DXGI 데스크톱 프레임에서 읽은 경계를 비교했다. 아래 각 셀은 기준에서 변경 후로 바뀐 값이다.

| 배율과 모서리 | CanvasKit–`EDIT` 오차 p95 / 최대 px | `EDIT`–`+` 오차 p95 / 최대 px | `EDIT` 갱신 간격 p95 ms |
| --- | ---: | ---: | ---: |
| 200% 왼쪽 위 | 28 / 35 → 14 / 29 | 28 / 34 → 14 / 15 | 12.7 → 12.4 |
| 200% 왼쪽 아래 | 28 / 42 → 14 / 29 | 28 / 41 → 15 / 15 | 19.0 → 17.5 |
| 200% 오른쪽 위 | 16 / 16 → 16 / 16 | 14 / 16 → 14 / 16 | 18.1 → 18.6 |
| 200% 오른쪽 아래 | 16 / 16 → 16 / 16 | 14 / 16 → 14 / 16 | 30.5 → 37.7 |
| 125% 왼쪽 위 | 22 / 30 → 15 / 16 | 23 / 29 → 15 / 16 | 24.0 → 12.8 |

변경 후 두 배율에서 정지 배치 오차는 0px였고 드래그를 놓은 뒤 세 경계가 같은 상대 위치로 돌아왔다. 125%에서 전경을 켠 변경 후 캡처는 이동 중 215프레임 중 201프레임에서 경계를 읽었다. 전경을 끈 200% 왼쪽 아래의 편집기 갱신 간격 p95도 24.5ms에서 13.1ms로 줄었다. 왼쪽 모서리에서 `+`의 가로 이동 폭은 29px였고 오른쪽 아래의 화면 갱신 간격 p95는 이번 측정에서 늘었다. 동적 표시 수락은 보류한다.

별도 Win32 검증 창에서 투명 DirectComposition 자식 창과 계층형 `EDIT`를 같은 부모에 두고 `DeferWindowPos`로 옮겼다. 이동 전후에 편집기 배경과 스크롤바 위의 알파 합성이 유지되고 카드의 빈 영역 히트 테스트가 `EDIT`에 도달했다. [DeferWindowPos](https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-deferwindowpos)

Testbed 패키지 `7d1f4f5cb23a`는 Skia 전경을 편집기와 같은 부모의 픽셀 전용 자식 창에 표시한다. 새 BGRA 픽셀에서 알파가 있는 사각형만 GPU에 올린다. 200% 배율 검증 창에서 편집기는 1568×336px, 카드 전경 창은 332×176px였다. Win32 배치에는 편집기·전경·클릭 영역을 함께 넣고 retained 원점이 바뀔 때 WebView2의 자식 창 위치도 같은 배치에서 적용한다. 새 Skia 표면의 표시는 배치가 끝난 뒤 DirectComposition에 커밋한다. 전경을 끄면 픽셀 전용 창을 제거한다. [Windows 호스트 배치](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_platform_views.rs) · [Windows Skia 전경](Nelyx/sdk/tooling/cli/templates/tauri/skia-foreground/src/win32.rs) · [DirectComposition 대상](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createtargetforhwnd)

기준 `f8c3458fdb1b`와 변경 후 `7d1f4f5cb23a`를 다시 같은 60Hz 드래그로 비교했다. 전경을 켠 상태에서 모서리별 결과는 아래와 같다.

| 배율과 모서리 | CanvasKit–`EDIT` 오차 p95 / 최대 px | `EDIT`–`+` 오차 p95 / 최대 px | `EDIT` 갱신 간격 p95 ms |
| --- | ---: | ---: | ---: |
| 200% 왼쪽 위 | 15 / 28 → 14 / 35 | 15 / 28 → 14 / 35 | 12.09 → 12.87 |
| 200% 왼쪽 아래 | 14 / 15 → 14 / 28 | 15 / 15 → 14 / 28 | 17.00 → 17.45 |
| 200% 오른쪽 위 | 16 / 30 → 16 / 16 | 14 / 16 → 16 / 16 | 18.53 → 19.08 |
| 200% 오른쪽 아래 | 26 / 30 → 16 / 16 | 14 / 30 → 16 / 16 | 30.74 → 33.23 |
| 125% 왼쪽 위 | 15 / 28 → 15 / 27 | 15 / 16 → 15 / 16 | 18.59 → 17.90 |

변경 후 정지 위치 오차는 두 배율에서 0px였다. 200% 왼쪽 두 모서리의 `+` 가로 이동 폭은 각각 29px였다. 125% 전경 켬에서 이동 중 232프레임 중 196프레임에서 경계를 읽었다. 가상 키 입력 뒤 실제 `EDIT` 픽셀이 바뀔 때까지의 p95는 전경 켬 10.70ms, 끔 15.77ms였다. 조건마다 다섯 번 측정했다. 움직이는 동안 편집기와 전경 사이의 위치 오차가 남아 동적 표시 수락은 보류한다.

같은 공급으로 생성한 일반 창의 정지 위치 오차는 두 배율에서 0–1px였다. 200%에서 실제 Win32 `BUTTON` 클릭 한 번을 확인했다. 전경을 켠 왼쪽 위 동작의 CanvasKit–`EDIT` 오차 p95/최대는 200%에서 42/56px, 125%에서 29/44px였다. 전경을 끈 같은 동작에서는 각각 28/42px와 15/43px였다.

retained 패키지에서 편집기 화면을 여덟 번 왕복했다. 진입할 때마다 전경 HWND가 하나였고 퇴장 뒤에는 WebView2 자식 창만 남았다. 퇴장 뒤 GDI 객체는 19개, USER 객체는 38–39개, 호스트 핸들은 379–381개였다.

#### 부모 창의 크기 변경과 자식 창 정렬

패키지 `82a65d6184ba`부터 이미 표시한 전경과 새 Skia BGRA 픽셀이 같으면 자식 창 위치만 갱신한다. 최대 1MiB의 픽셀을 비교용으로 보관하며, 색상이나 크기가 바뀌면 다시 업로드한다. 전부 보이는 `EDIT`는 HWND의 경계로 클립하고, 명시적 창 영역은 부분 클립에 적용한다. Rust 검사에서 픽셀 재사용·색상 변경과 부분 클립 해제·재설정을 확인했다. [Windows Skia 전경](Nelyx/sdk/tooling/cli/templates/tauri/skia-foreground/src/win32.rs) · [Win32 창 영역](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowrgn)

`82a65d6184ba`에서 200% 왼쪽 위·아래 드래그 중 최상위 창의 오른쪽 좌표는 고정됐고, WebView2와 `EDIT`, 전경 HWND의 좌표는 29–30px 움직였다. `f37570e3cae2`는 WebView2와 세션이 소유한 자식 창만 있을 때 부모의 `WM_NCCALCSIZE` 유효 사각형에 보정 이동을 포함한다. 자식 창이 여럿일 때는 실제 배치 뒤 WebView2에 크기를 전달한다. 같은 드래그에서 WebView2의 가로 이동 폭은 2px, `EDIT`와 전경 HWND 오른쪽 경계의 이동 폭은 3px이었다. 이 값은 DXGI 프레임을 받은 뒤 읽은 HWND 좌표다. 실제 화면에서 왼쪽 아래 `+`의 가로 이동 폭은 29px에서 3px로 줄었다. [부모 창 배치](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs) · [세션의 자식 창 확인](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_platform_views.rs)

두 패키지의 direct 모드에서 같은 60Hz 가상 마우스 드래그로 전경을 켰을 때의 화면을 비교했다. 위치 오차는 한 DXGI 화면에서 각 경계 사이의 간격을 정지 상태와 비교한 값이다.

| 배율과 모서리 | CanvasKit–`EDIT` 오차 p95 / 최대 px | `EDIT`–`+` 오차 p95 / 최대 px | `EDIT` 화면 갱신 간격 p95 ms |
| --- | ---: | ---: | ---: |
| 200% 왼쪽 위 | 14 / 35 → 14 / 15 | 14 / 35 → 14 / 14 | 13.13 → 12.26 |
| 200% 오른쪽 위 | 16 / 16 → 16 / 16 | 16 / 16 → 16 / 16 | 18.88 → 19.09 |
| 200% 왼쪽 아래 | 14 / 15 → 14 / 15 | 14 / 15 → 14 / 14 | 21.67 → 24.82 |
| 200% 오른쪽 아래 | 16 / 16 → 16 / 16 | 16 / 16 → 16 / 16 | 33.08 → 32.66 |
| 125% 왼쪽 위 | 15 / 16 → 15 / 27 | 15 / 16 → 15 / 16 | 16.79 → 17.79 |

두 배율의 정지 오차는 0px였다. 125% 전경 켬에서 움직이는 프레임 230장 중 195장에서 세 경계를 읽었다. 200% 재측정에서도 왼쪽 두 모서리의 자식 HWND 이동 폭은 2–3px였고, 왼쪽 아래 `+`의 가로 이동 폭은 2px였다. 왼쪽 위의 `EDIT`–`+` 최대 오차는 재측정에서 35px였다. 200%에서 다섯 번의 가상 키 입력 뒤 `EDIT` 픽셀이 바뀔 때까지의 p95는 전경 켬 9.78ms, 끔 11.23ms였다. 합성 화면의 `EDIT`와 전경 위치 오차와 오른쪽 아래의 갱신 간격이 남아 동적 표시 수락은 보류한다.

`f37570e3cae2`에서 편집기 화면을 여덟 번 왕복했다. 퇴장할 때마다 WebView2 자식 창 하나가 남았고, GDI 객체는 19개, USER 객체는 37–38개, 호스트 핸들은 377–379개였다. 두 번째 퇴장부터 세 카운터가 같은 값을 유지했다.

#### Win32 편집기 다시 그리기 비교

계측용 x64 빌드 `d0d68148c8cb`의 direct 모드에서 200% 배율, 전경 켬, 60Hz 가상 마우스로 비교했다. 기존 배치를 두 번 실행하고, 기존 `EDIT` 크기를 바꿀 때 `SWP_NOCOPYBITS`를 적용하는 경우, 자동 다시 그리기를 막고 `RedrawWindow`를 호출하는 경우, `RedrawWindow` 뒤 `GdiFlush`를 호출하는 경우를 각각 같은 실행 파일로 측정했다. 각 경우의 `EDIT`–`+` 오차 p95는 왼쪽 위·아래 14px, 오른쪽 아래 16px였다. 왼쪽 아래에서 화면상 편집기 너비와 슬롯 기준 너비의 차이 p95는 27–28px였고, 촬영 직후 읽은 편집기 HWND 오른쪽 좌표의 이동 폭은 3px였다. [Win32 배치 플래그](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos) · [다시 그리기 호출](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-redrawwindow)

`SWP_DEFERERASE` 실험은 왼쪽 위 드래그에서 편집기와 전경을 모두 읽을 수 있는 프레임이 198장 중 6장이었다. 끝부분에는 편집기 내부의 표본점이 WebView 배경과 같은 색이었고 전경 HWND도 잡히지 않았다. 계측용 옵션을 제거했다. HWND 정렬과 별도로 실제 편집기 픽셀과 전경의 표시 오차가 남아 있다.

#### 크기 변경 프레임의 표시 오차 분리

Windows x64 패키지 `b449bdf77bbd`의 direct 모드에서 200% 화면의 왼쪽 위·아래를 가로 ±28px 범위로 60Hz 드래그했다. 편집기가 부모 창에 잘리지 않는 범위를 사용했다. 정상 제출에서는 `EDIT`와 `+` 오른쪽 경계의 상대 오차 p95가 두 모서리 모두 14px였다. 화면 캡처 약 2–3ms 뒤 읽은 `EDIT`와 전경 HWND의 오른쪽 좌표 이동 폭은 각각 3px였다.

WebView2 스크립트를 디버거에서 일시 정지하고 같은 드래그를 재현했을 때 `EDIT`–`+` 오차 p95는 0px였고 최대는 왼쪽 위 0px, 왼쪽 아래 1px였다. WebView2가 계속 배경을 그리고 24개의 네이티브 프레임 제출만 보류한 비교에서도 두 모서리의 `EDIT`–`+` 오차는 p95와 최대가 모두 0px였다. 슬롯 너비는 1589–1630px로 변했고, `EDIT` HWND 너비는 1568px로 유지됐다. 정상 제출에서 입력을 250ms 간격으로 보냈을 때도 움직인 직후 화면의 `EDIT`–`+` 오차 p95가 14px였으며, 다음 입력 직전의 마지막 캡처에서는 0px였다. 프레임 제출과 함께 `EDIT` 너비가 바뀌는 구간이 오차를 재현한다. [WebView 디버거 일시정지](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/#event-paused) · [DXGI 화면 타임스탬프](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/ns-dxgi1_2-dxgi_outdupl_frame_info)

계측 패키지 `15e897227110`을 사용해 `EDIT` 자체의 `WM_NCCALCSIZE`에서 `WVR_ALIGNRIGHT`와 오른쪽에 맞춘 `WVR_VALIDRECTS`를 각각 적용했다. 모서리당 21–22회 적용을 확인했고, 양쪽 방식의 `EDIT`–`+` 오차 p95는 기본 배치와 같은 14px였다. 계측용 분기를 제거했다. [Win32 클라이언트 영역 다시 계산](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-nccalcsize)

같은 패키지의 기본 배치에서 부모 창을 고정하고 WebView2에 오른쪽 경계가 고정된 너비 변경을 250ms 간격으로 여덟 번 전달했다. `EDIT`의 HWND 너비가 1540–1596px로 바뀌는 동안, 같은 DXGI 화면 193장에서 슬롯과 `+`의 오른쪽 픽셀은 고정됐다. `EDIT`의 오른쪽 픽셀은 ±14px 이동했고 `EDIT`–`+` 오차는 p95 0px, 최대 14px였다. 캡처 약 2–3ms 뒤 읽은 두 자식 HWND의 오른쪽 좌표는 고정됐다. 이 조건에서도 너비 변경 직후의 표시 오차가 재현됐다.

별도 Win32 검증 창에서 `CreateSurfaceFromHwnd`로 계층형 `EDIT`를 DirectComposition의 시각 요소에 붙이고, 원래 HWND에 `DWMWA_CLOAK`를 적용했다. DWM 플래그는 1이었고 `EDIT`의 흰 배경은 같은 위치에서 보였다. `WindowFromPoint`는 부모 창을 반환했고, 그 자리에서 실제 Win32 마우스 입력을 보낸 뒤에도 편집기 바깥에 포커스가 남았다. [계층형 창 표면](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createsurfacefromhwnd) · [DWM 창 속성](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwmwindowattribute)

별도 Win32 검증 창의 200% 화면에서 `EDIT` 오른쪽을 고정하고 너비를 952px와 1008px 사이에서 60Hz로 26회 전환했다. 일반 계층형 `EDIT` 배치와 `WM_PRINTCLIENT`로 그린 비트맵·좌표·크기를 `UpdateLayeredWindow` 한 번에 넘기는 방식을 비교했다. 같은 DXGI 프레임에서 고정된 전경 표식과 `EDIT`의 상대 오차 p95는 양쪽 모두 56px였다. 측정 중 오른쪽 HWND 좌표와 전경 표식은 고정됐고, 두 방식에서 `WindowFromPoint`와 키보드 포커스는 실제 `EDIT`에 도달했다. 전환 뒤의 표본에서는 일반 배치 p95 0px, 비트맵 제출 방식 p95 56px가 나왔다. 이 계측 경로를 제품에 적용하지 않았다. [계층형 창 위치와 크기 업데이트](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-updatelayeredwindow)

#### 계층형 편집기의 표면과 접근성 좌표

별도 Win32 검증 창에서 같은 952–1008px 전환을 재현했다. `EDIT` HWND의 너비를 1140px로 고정하고 오른쪽을 기준으로 `SetWindowRgn`과 `EM_SETRECTNP`의 왼쪽 경계를 움직였을 때, 고정된 전경 표식에 대한 오른쪽 픽셀 오차 p95/최대는 기존 56/56px에서 0/0px로 줄었다. 움직이는 왼쪽 표식에 대한 왼쪽 픽셀 오차 p95는 양쪽 모두 56px였고 정지한 뒤 0px였다. 선택 범위 `[5, 14]`, 너비별 줄 수 12/11, 클립 안의 클릭과 키보드 포커스를 두 방식에서 확인했다. 고정 너비 방식은 UI Automation이 왼쪽 경계를 보이는 영역보다 132px 넓게 보고했다. `IAccPropServices`로 경계를 지정하는 비교에서 `get_CurrentBoundingRectangle`은 `E_INVALIDARG`를 반환했다. [Win32 창 영역](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowrgn) · [편집기 서식 사각형](https://learn.microsoft.com/en-us/windows/win32/controls/em-setrectnp) · [UI Automation 속성 주석](https://learn.microsoft.com/en-us/windows/win32/winauto/dynamic-annotation-api)

패키지 `b449bdf77bbd`의 동일한 `EDIT` HWND에서 불투명 알파(`LWA_ALPHA`, 255)와 `LWA_COLORKEY`를 비교했다. Testbed direct 모드의 네 모서리에서 한 번씩 60Hz로 가로 ±98px와 세로 약 ±59px를 움직였고, 두 배율에서 각각 같은 DXGI 프레임의 오른쪽 경계를 읽었다. 수치는 `EDIT`–`+` 상대 오차 p95/최대이며 물리 px 단위다. [계층형 창 속성](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setlayeredwindowattributes)

| 배율 | 모서리 | 불투명 알파 | 색상 키 |
| --- | --- | ---: | ---: |
| 200% | 왼쪽 위 | 14 / 42 | 2 / 14 |
| 200% | 오른쪽 위 | 16 / 30 | 0 / 14 |
| 200% | 왼쪽 아래 | 14 / 28 | 2 / 14 |
| 200% | 오른쪽 아래 | 16 / 16 | 2 / 14 |
| 125% | 왼쪽 위 | 15 / 16 | 3 / 14 |
| 125% | 오른쪽 위 | 16 / 16 | 1 / 14 |
| 125% | 왼쪽 아래 | 15 / 16 | 1 / 14 |
| 125% | 오른쪽 아래 | 16 / 16 | 1 / 3 |

두 배율의 정지 오차는 0px였다. 색상 키에서도 오른쪽 모서리의 `EDIT`–슬롯 오차 p95는 최대 14px였다. 알파 254 비교에서 `EDIT`–`+` 오차 p95는 200%의 왼쪽 14px·오른쪽 16px, 125%에서 15–16px였다. 좌상단 한 픽셀을 제외한 복합 창 영역도 200% 왼쪽 두 모서리의 오차 p95가 14px였다. `CLR_INVALID`를 키로 넘긴 별도 비교에서는 흰 편집기 픽셀 자리에 WebView 배경색이 나타났다. 키와 일치하는 픽셀은 표시와 히트 테스트에서 빠지므로 색상 키 비교는 계측에 한정했다. [계층형 창의 히트 테스트](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features#layered-windows)

#### 스크롤바 분리와 공통 DirectComposition 대상

Testbed 3 direct에서 125%·200% 배율의 각 모서리에 60Hz로 가로 ±98px와 세로 약 ±59px의 가상 마우스 드래그를 보냈다. `EDIT`의 세로 스크롤바만 별도 Win32 `SCROLLBAR` HWND로 옮겨 기존 전경과 함께 배치한 실험에서는 여덟 조합의 `EDIT`–`+` 가로 오차가 p95 14px, 최대 14–16px였다. 200% 왼쪽 위·아래의 p95는 기존과 같은 14px였다. 같은 프런트엔드의 기존 `EDIT`에서 자식 창 배치 직전 또는 DirectComposition 커밋 직후에 `DwmFlush`를 호출한 두 실험은 모두 p95 14–16px였다. 두 변경을 되돌린 Windows x64 패키지 `bcf4a74aab09`에서 direct 실제 클릭, 편집기 포커스와 Tab 왕복, UI Automation·MSAA 접근성, 모달 뒤 동일 HWND 복귀를 확인했다. [Win32 패키지 검사](Nelyx/eng/fixtures/testbed-win32-platform-views.mjs) · [DwmFlush](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmflush)

별도 Win32 창에서는 200% 배율, 고정된 부모와 오른쪽 경계에서 `EDIT` 너비를 982px와 1038px 사이로 60Hz에서 26회 전환했다. 불투명한 배경을 둔 고정 크기 DirectComposition 대상에 `EDIT`와 전경 표식을 함께 올려도 기본 비클라이언트 스크롤바를 사용하면 본문 오른쪽 경계 오차가 p95/최대 35/35px였다. 같은 합성 대상에 테두리를 뺀 `EDIT`, 별도 `SCROLLBAR`, 전경 표식을 올리고 각 영역의 변환과 클립을 함께 적용하자 71개 DXGI 프레임에서 본문 경계와 전체 바깥 경계의 상대 오차가 모두 0/0px였다. 실제 `EDIT`의 불투명도를 1/255로 두었을 때도 투영은 불투명하게 표시됐으며 가상 마우스 클릭이 실제 `EDIT`에 포커스를 주었다. Testbed에 이 경로를 연결한 상태의 네 모서리 표시, 실제 스크롤바 입력, 캐럿·IME·접근성은 확인이 남았다. [계층형 HWND 투영](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createsurfacefromhwnd)

### 확인 명령

```powershell
node Nelyx/eng/check-platform-view-core.mjs
node Nelyx/eng/check-platform-views-dom.mjs
node Nelyx/eng/check-platform-view-lifecycle.mjs
node Nelyx/eng/check-tauri-windows.mjs sample/nelyx-testbed-app-3 --render-mode=direct --platform-views
node Nelyx/eng/check-tauri-windows.mjs sample/nelyx-testbed-app-3 --render-mode=direct --win32-platform-views
node Nelyx/eng/check-tauri-android-platform-views.mjs emulator-5554 --lifecycle
node Nelyx/skia/eng/build-native-foreground.mjs test
node Nelyx/eng/check-tauri-windows.mjs sample/nelyx-demo-app --render-mode=direct --demo-controls
```

## 8. 재개 지점

현재 구현과 검증 스크립트를 작업 트리에 보존했다. Web과 Windows의 세 렌더 모드, Windows 실제 편집기·내레이터, Android x64·Galaxy ARM64 실제 편집기·TalkBack, Linux x64 X11·Wayland의 결과는 §7에 기록했다. 갤럭시에는 Testbed APK `b449bdf77bbd`가 설치되어 있으며, 계측 앱을 제거하고 TalkBack과 자막 설정을 복원했다. 사용자 요청이 오면 아래 항목에서 이어간다.

| 대상 | 남은 검증과 재개 위치 |
| --- | --- |
| Windows | Testbed direct의 125%·200% 네 모서리에서 이동 중 불투명 알파 경로의 오차 p95는 14–16px다. 스크롤바와 실제 `EDIT`의 투영을 Skia 전경과 같은 고정 크기 DirectComposition 대상에 올린 단독 창의 결과를 제품 경로에서 재현하는 작업이 남았다. 같은 DXGI 프레임에서 슬롯·편집기·버튼 경계, 스크롤바 입력, 캐럿·IME와 접근성을 확인한다. 드래그 도중의 모니터 간 배율 전환과 장시간 GPU 메모리 검증도 남았다. [후속 실험](#스크롤바-분리와-공통-directcomposition-대상) · [편집기 배치](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_platform_views.rs) · [전경 표시](Nelyx/sdk/tooling/cli/templates/tauri/skia-foreground/src/win32.rs) |
| Android ARM64 | 갤럭시에서 TalkBack으로 `+`, 실제 편집기, 모달 열기·닫기를 확인했다. 전경 켬·끔의 입력 표시 지연은 편집기에 글자가 들어가는 입력에서 다시 계측한다. 직전 계측은 일부 입력에서 포커스가 WebView로 이동했고 유효한 지연 표본을 얻지 못했다. [실행 현황](#7-실행-현황) |
| iOS·macOS | Windows 교차 타깃의 Rust 검사와 Apple Skia 공급 해시 확인까지 마쳤다. Apple Silicon Mac에서 §5의 명령으로 Xcode 링크·패키징·실행을 검증하고, UIKit·AppKit 편집기와 전경의 겹침·입력·VoiceOver를 확인한다. [Apple 작업 항목](#w9-07--후속-네이티브-포트와-패키지-회귀) · [실행 명령](#5-구현-후-실행할-검증-명령) |
| Linux ARM64 | AArch64 ELF·DEB와 QEMU에서의 Testbed 창 시작을 확인했다. ARM64 실기기에서 패키지를 실행해 GTK 편집기와 전경 합성, 입력을 검증한다. [실행 현황](#7-실행-현황) |
