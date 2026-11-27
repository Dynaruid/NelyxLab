# W9 · Nelyx PlatformView와 네이티브 Skia 전경 합성

**PLANNED** · 2026-11-27 KST · 기준 `main` `3327645f` · [설계 원안](idea.md)

네이티브 편집기 위에 Nelyx의 반투명 카드와 버튼을 올린다. 카드 아래에서 편집기의 글자와 커서가 보이고, 버튼을 누르면 Nelyx 콜백이 한 번 실행되며, 옆을 누르면 같은 편집기에서 한글 입력을 이어갈 수 있어야 한다. 이 장면을 Testbed 3의 공개 위젯 API로 작성해 렌더링·입력·접근성을 함께 검증한다.

| 대상 | W9에서 만들 경로 | 첫 수락 장면 |
| --- | --- | --- |
| Web / PWA, Tauri의 HTML 콘텐츠 | **같은 브라우저 문서 또는 기존 WebView 안에서** 배경 캔버스 → DOM 요소 → 필요한 경우에만 투명 전경 캔버스를 쌓는다. | HTML 편집기와 iframe 위의 Nelyx 버튼. 겹침이 없는 화면은 캔버스 한 장으로 그린다. |
| Windows / Android의 실제 OS 컨트롤 | 기존 WebView의 CanvasKit 배경 → 실제 OS 자식 뷰 → **추가 네이티브 Skia 표면 한 장**을 OS가 합성한다. | Win32 `EDIT`와 Android `EditText` 위에서 같은 장면을 재현한다. |
| iOS / macOS / Linux | 같은 계약에 각각 UIKit, AppKit, GTK 호스트를 붙이는 후속 포트다. | 대상별 실제 컨트롤·전경 표면·입력·보조기술이 통과한 조합을 기록한다. |

첫 이정표는 Web과 패키징한 Windows 앱, 다음은 Android다. 한 장의 네이티브 전경으로 **여러 Nelyx 컨트롤을 한 OS 뷰 위에** 그리는 경우부터 지원한다. 네이티브 뷰가 여러 층 사이에 교차하는 장면, 외부 영상 텍스처, 화면 전체의 네이티브 Skia 전환은 §6에서 결정한다. 현재 상태는 소스 검토와 작업계획 작성까지다.

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

- [ ] 새 공개 경로 `@nelyx/core/framework/widgets/platform-view`에 `PlatformView`를 추가하고 `RenderPlatformView`가 `alwaysNeedsCompositing`인 레이어를 삽입하게 한다. Core에 호스트 서비스 계약을 두고 SDK 부트스트랩이 각 View에 팩터리 등록·지원 조회·생성·갱신·해제 기능을 연결한다. OS와 DOM 객체는 해당 어댑터가 소유한다. [Core 패키지 exports](Nelyx/package.json) · [View 서비스](Nelyx/src/hosting/services.ts) · [SDK 부트스트랩](Nelyx/sdk/src/runtime/bootstrap.ts) · [레이어 삽입](Nelyx/src/framework/painting/context.ts#L274)
- [ ] 호스트 대역으로 최초 생성 1회, 같은 키의 재정렬, 타입 변경, 다른 View에서 같은 인스턴스 번호, 무한 제약, 0 크기, 생성 중 dispose를 검사한다. 종료 후 남은 컨트롤과 이전 세대의 이벤트 반영은 각각 0건이어야 한다.

### W9-02 · 장면 분할과 프레임 수명

- [ ] `SceneBuilder`의 retained recording에 뷰 표식을 추가한다. 원래 순서대로 `그림 → 뷰 → 그림`을 내보내고 각 구간에서 누적 변환·클립과 균형 잡힌 save/restore를 복원한다. 뷰를 포함한 조상의 단일 Picture 캐시에도 표식이 보존되어야 한다. 그룹 `saveLayer`·필터가 경계를 가로지르면 지원 판정으로 넘긴다. 뷰가 없는 프레임은 기존 단일 캔버스 경로를 사용한다. [retained 삽입](Nelyx/src/ui/scene.ts#L751) · [프레임 기록](Nelyx/src/ui/frame.ts#L482)
- [ ] 공개 렌더러 알림의 기존 호출 순서를 보존하면서 direct·worker의 제출/폐기와 호스트 배치 수명을 연결한다. `RepaintBoundary` 아래에서 부모만 스크롤, 두 겹 클립, 입력만 막는 전경, 반환 순서 역전, 렌더러 교체를 확인한다. 실제 뷰 레이어의 `supportsRasterization()`은 false를 반환한다. `SnapshotWidget`에서는 기존 normal 오류, permissive의 실시간 그리기, forced에서 재현 가능한 Nelyx 픽셀만 캡처하는 결과를 각각 확인한다. [스냅샷 분기](Nelyx/src/framework/widgets/snapshot-widget.ts#L332)

### W9-03 · Web과 Tauri DOM의 문서 내 합성

- [ ] `ApplicationSurface`의 기존 viewport 안에 배경 캔버스, 뷰별 DOM 컨테이너, 필요한 전경 캔버스를 배치한다. 무가림은 한 장, DOM 위에 그릴 콘텐츠가 생기면 한 장을 추가한다. 두 캔버스가 하나의 앱·스케줄러를 사용한다. WebGL 자원은 컨텍스트별로 복원하고 worker 모드에서는 각 표시 캔버스의 OffscreenCanvas 소유권·교체·해제를 관리한다. StrictMode 재마운트와 워커 복구에서 편집기·구독이 이전 Surface에 남지 않아야 한다. [Surface 소유권](Nelyx/sdk/src/frontend/dom/surface.tsx#L24) · [OffscreenCanvas 이전](Nelyx/sdk/src/backends/browser/renderer.ts#L245) · [WebGL 표면](Nelyx/skia/packages/web/src/surface.ts#L48)
- [ ] 전경 캔버스는 `pointer-events: none`으로 두고 지원하는 Nelyx hit 영역에만 입력용 DOM 요소를 배치한다. 표시된 버튼은 기존 제스처 경로에 연결하고, 장식·버튼 바깥은 HTML 컨트롤 또는 iframe이 직접 받는다. iframe 안에서 시작한 드래그는 해당 문서가 처리한다. 모달은 렌더링·차단 영역·Tab 범위를 함께 적용한다. 다른 출처 iframe과도 부모의 입력 영역만으로 동작해야 한다. [기존 캔버스 캡처](Nelyx/sdk/src/backends/browser/input.ts#L45) · [iframe 입력 제약](https://api.flutter.dev/flutter/widgets/HtmlElementView-class.html)
- [ ] Testbed 3에 동일한 Nelyx 위젯 트리로 버튼·편집기·iframe 장면을 추가한다. 기존 WebView·Texture 데모의 동작을 회귀 비교에 쓴다. Chrome과 패키징한 WebView2에서 DOM 경로를 확인하고, 추가 캔버스가 생겨도 선택·접근성 요소와 Surface 크기가 맞아야 한다. [Testbed 화면](sample/nelyx-testbed-app-3/src/app.ts#L437) · [기존 호스트 예제](sample/nelyx-testbed-app-3/README.ko.md)
- [ ] Testbed 3의 Playwright 검사에서 서로 다른 두 로컬 origin으로 iframe 삽입 허용·거부를 재현한다. 격리 배포(COOP/COEP)에서도 허용된 콘텐츠의 포인터 소유권과 대체 안내를 확인한다. 테스트 문서는 출처와 발신 창을 확인한 준비 메시지로 로드를 판정한다. 임의의 외부 문서에 대한 iframe의 load 이벤트만으로 삽입 성공을 단정할 수 없다. 외부 URL은 현재 샘플의 Web 대상 범위를 유지하고 Tauri에서는 로컬 문서로 같은 경로를 검사한다. [샘플의 대상 선택](sample/nelyx-testbed-app-3/src/webview-panel.tsx#L45) · [격리 환경](work3.md) · [CSP frame-ancestors](https://w3c.github.io/webappsec-csp/#directive-frame-ancestors)

### W9-04 · Tauri 등록과 네이티브 Skia 공급

- [ ] 원본 생성기와 SDK 공급 경로에 Skia 소스 리비전, 빌드 옵션·GPU 백엔드, 대상 ABI, 해시·라이선스를 고정한다. 앱에 등록된 `viewType`과 창 기능으로 팩터리를 선택하고, 네이티브 전경을 쓰는 타깃에만 해당 라이브러리와 Rust 명령 권한을 넣는다. Web과 DOM 전용 Tauri 앱은 기존 CanvasKit 공급을 쓴다. [호스트 Cargo 생성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs#L124) · [창별 capability](Nelyx/sdk/tooling/cli/src/tauri-host.mjs#L322) · [호출 WebView 검사](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/lib.rs#L66)
- [ ] 초기 네이티브 디코더는 해당 배경과 짝을 이룬 전경의 소유자·세대·순번, 바이트 길이와 명령 수, 지원하는 op와 자원 참조를 검사한다. 사각형·선·알파·클립부터 재생하고, 도형이 `drawPicture`로 묶였을 때도 원본 명령을 등록하거나 펼쳐 그린다. 문자·이미지를 추가할 때는 원본 폰트·문단·이미지를 최초 등록 후 세대별로 참조한다. 프레임 IPC에는 그림 명령과 자원 참조를 싣고, 자원 해제는 두 소비자의 마지막 사용이 끝난 뒤 수행한다. 실제 호출 WebView·창·허용한 앱 페이지를 기준으로 외부 페이지·다른 창의 핸들·해제된 세대를 거절한다. [wire 정의](Nelyx/src/ui/web-frame-wire-format.ts) · [자원 복원 선례](Nelyx/sdk/src/backends/browser/render-worker-resources.ts#L94)
- [ ] 패키징한 호스트가 현재 SDK 공급본만으로 실제 네이티브 Skia 표면에 도형을 그리는지 확인한다. 실행 중인 frontend build ID, 네이티브 라이브러리, 실제 선택한 경로를 대조한 뒤 OS 컨트롤과 통합한다.

### W9-05 · Windows 자식 HWND와 투명 Skia 전경

- [ ] 실제 `EDIT`·`BUTTON`을 WebView2와 같은 부모 창에 만들고 기존 `windowsRetainedViewport`의 음수 X, DPR, 부모 client 원점을 반영한다. 직접 자식이 추가되면 바뀌는 `WVR_VALIDRECTS` 조건을 일반 창과 retained 창 모두에서 확인한다. [자식 수 검사](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs#L301) · [WebView 배치](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs#L367) · [기존 네 모서리 분석](work7.md)
- [ ] 첫 전경은 부모 HWND의 최상단 DirectComposition target과 알파 지원 DXGI 표면을 후보로 삼는다. 같은 창의 기존 target 소유 여부를 확인한 뒤 네이티브 Skia 출력을 연결한다. 해당 visual은 픽셀을 담당한다. 버튼의 실제 hit 영역에 대응하는 OS 입력 경로를 별도로 두고 빈 곳에서는 원래 HWND가 입력을 받게 한다. 최상단 사용이 불가능한 호스트는 지원 사유와 사각형 슬롯 대체 동작을 제공한다. [DirectComposition 합성 순서](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createtargetforhwnd) · [DXGI 합성 표면](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/nf-dxgi1_2-idxgifactory2-createswapchainforcomposition)
- [ ] 실제 `EDIT` 위에 반투명 카드와 선 두 개로 만든 `+` 버튼을 그린다. 부모·클래스와 같은 편집기 핸들을 확인한다. 카드 아래 글자와 커서, 버튼 클릭 1회, 빈 영역의 마우스·한글 입력, 모달 뒤 클릭 0회, 닫은 뒤 잔상·보이지 않는 클릭 영역 0개를 확인한다. Skia 전경을 켜고 끈 동일 패키지·장면으로 §4의 움직임과 메모리를 비교한다.

### W9-06 · Android 자식 뷰와 전경 순서

- [ ] Kotlin 플러그인이 기존 WebView의 부모 `ViewGroup`에 원래 크기의 `EditText`와 클립 컨테이너를 만든다. 투명 `TextureView`에 NDK Skia 출력을 연결하고 UI 스레드에서 뷰 배치·입력·IME 포커스를 관리한다. 표면 파괴와 Activity 재생성 때 이전 렌더 작업을 정리한 뒤 새 세대를 연결한다. [WebView 부모 접근](Nelyx/backend/crates/tauri-plugin-nelyx-backend/android/src/main/java/dev/nelyx/backend/SafeAreaPlugin.kt#L68) · [TextureView 제약](https://developer.android.com/reference/android/view/TextureView)
- [ ] x86_64 에뮬레이터에서 터치·회전·키보드 인셋·백그라운드 복귀·퇴장 중 생성을 확인한다. ARM64 실기기에서 실제 터치·TalkBack·표시 시차를 확인한다. 일반 View, 별도 `SurfaceView`, 실제 지도 SDK의 표면을 각각 시험하고 확인한 공급자·표면 조합에만 지원을 표시한다. 지도 SDK의 별도 설정이 필요하면 편집기와 로컬 표면 검증부터 끝낸다.

### W9-07 · 후속 네이티브 포트와 패키지 회귀

- [ ] **iOS**는 기존 `with_webview`로 찾은 WKWebView의 부모에 `UIView` 편집기와 투명 Metal 전경을 두고 point 좌표·키보드·VoiceOver·화면 재진입을 확인한다. **macOS**는 AppKit `NSView`와 Metal 전경의 Y축 변환·배율·키보드 포커스를 실제 창에서 확인한다. [기존 iOS 연결](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/scroll_edge_effects.rs#L55) · [Metal 뷰](https://developer.apple.com/documentation/metal/creating-a-custom-metal-view)
- [ ] **Linux**는 생성된 WebKitGTK 부모에서 GTK 편집기와 전경을 같은 `GtkOverlay`에 넣을 수 있는지 확인한다. X11과 Wayland에서 클립·포커스·클릭 통과와 투명 전경을 각각 확인하고 지원 범위를 기록한다. [GTK Overlay](https://docs.gtk.org/gtk3/class.Overlay.html)
- [ ] Testbed 3의 재현 동선과 각 플랫폼의 지원 효과를 샘플 가이드에 반영한다. 일반 Nelyx 화면, 기존 iframe·Texture 예제, Demo의 Acrylic·텍스트 편집을 같은 SDK 공급본으로 회귀 확인한다. 플랫폼별 빌드, 기능, 접근성, 표시 성능과 미확인 조합을 이 문서에 기록한다.

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

## 6. 첫 구현 이후의 결정

- **여러 네이티브 뷰 사이의 전경**은 `뷰 A → Nelyx 카드 → 뷰 B → 메뉴`가 실제 같은 위치에서 교차하는 장면으로 판단한다. OS가 중간에 표면을 삽입할 수 있는지, 표면 재사용과 메모리 비용, 클릭 순서까지 확인한 뒤 지원 범위를 넓힌다.
- **효과와 영상**은 반투명 색·직사각 클립부터 제공한다. 지도 아래 픽셀이 필요한 backdrop blur나 표면을 가로지르는 그룹 투명도는 OS 합성 효과 또는 공급자가 제공하는 프레임이 있어야 한다. 카메라·영상 자막은 별도 텍스처 경로에서 프레임 운반 비용과 수명을 평가한다.
- **네이티브 주 렌더러 전환**은 전경 재생 범위, WebView↔네이티브 전송량, 중복 자원, 텍스트 기준선·성능 측정값을 바탕으로 결정한다. W9의 전경 수락은 해당 OS·표면·명령 범위에만 적용한다.
