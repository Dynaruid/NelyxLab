# Doroti 대비 Nelyx 기능·구현 격차와 작업 계획

작성일 2026-11-28 KST · 상태 **코드 비교 완료 / 구현 대기**

비교 기준은 NelyxLab `8a015b53c3e284f6dd37e563ca8127d694d07074`와 인접 DorotiLab `3a9e07cc3eb087f0c623c1d73651ba865c92cb8b`다. 두 저장소의 공개 export, 프레임워크 구현, 실제 앱 진입점에서 플랫폼 호스트까지 연결되는 경로를 확인했다. Doroti 소스 링크는 인접 로컬 체크아웃을 가리킨다. 아래 플랫폼 실행 기록은 각 이력의 해당 빌드 기준이다. [Nelyx 제품 진입점](README.ko.md) · [Doroti 제품 진입점](../DorotiLab/README.ko.md)

## 1. 우선순위

Nelyx의 격차는 **OS 창·메뉴와 외부 드롭**, **접근성 갱신 비용**, **GPU 자원을 위젯 장면에 연결하는 계약**에서 가장 크다. GPU 효과는 CanvasKit의 SkSL로 자식·배경 샘플링부터 구현한다. WGSL 소스 호환이 필요한 경우 WebGL2용 GLSL ES 3.00 변환과 실행을 다룬다. 날짜 현지화, Windows Acrylic, 기본 PlatformView는 이미 제품 경로에 들어가 있다. [현지화](history/26/11/26/work6-summary.md) · [Windows Acrylic](history/26/11/27/work8-summary.md) · [PlatformView](history/26/11/27/work9-summary.md)

| 우선순위 | 작업 | 순서의 근거 |
| --- | --- | --- |
| P0 | 01 접근성 증분 갱신, 02 OS 드롭, 03 데스크톱 창·메뉴 | 01은 스크롤·리사이즈·편집기의 공통 경로다. 02와 03은 현재 Web·Tauri 호스트에서 각각 시작할 수 있다. |
| P1 | 04 GPU 셰이더·가변 블러, 05 PlatformView·WebView, 06 외부 텍스처, 07 앱 현지화, 08 생명주기·복구, 09 플러그인 | 04는 현재 CanvasKit에서 셰이더 입력을 먼저 연결한다. 05는 호스트별로 기존 단일 컨트롤부터 검증한 뒤 확대한다. 08의 창별 복구는 03의 창 수명을 사용하고 05의 배포형 사용자 팩터리는 09에 연결한다. |
| P2 | 10 위젯·캐러셀, 11 문단·텍스트 품질, 12 Tauri 네이티브 렌더링 검토 | 위젯은 실제 앱에서 필요한 묶음부터 이식한다. 문단과 렌더러 변경은 현재 공급에서 재현한 결함이나 비용으로 채택을 결정한다. |

제품 진입점은 `src/index.ts`의 TypeScript 위젯과 `backend/src/lib.rs`의 Rust 명령이다. Web·PWA와 Tauri의 기존 앱을 비교 기준으로 삼고, Core는 위젯·레이아웃·장면, SDK는 호스트 계약과 어댑터, CLI는 자산·설정·패키징을 맡는다. 위젯의 생성·build·콜백 순서는 Flutter에서 가져온 계약을 따른다. [Core 구조](Nelyx/README.ko.md) · [SDK 구조](Nelyx/sdk/README.ko.md)

## 2. P0 · 접근성과 데스크톱 앱 기능

### 01 · 접근성 트리의 위치 증분 갱신

Doroti는 뷰별 투영을 보존해 좌표·스크롤만 바뀐 노드와 영향을 받은 자손을 갱신한다. Web은 변경 목록을 보내고 Windows·Qt도 지원 ABI에서 순번 있는 패치를 사용한다. Nelyx는 기존 DOM 노드와 리스너를 재사용하고 콘텐츠 변경과 기하 변경을 이미 구분한다. 다만 새 스냅샷을 게시할 때 Core에서 트리를 다시 투영하고 DOM에서도 `flattenSemantics`로 노드 맵을 만들고 계층을 순회한다. 위치만 바뀐 프레임의 추가 비용 후보는 이 두 단계다. [Doroti 투영](../DorotiLab/Doroti/src/Doroti.Ui/RetainedSemanticsProjection.cs) · [Doroti Web 전송](../DorotiLab/packages/platforms/web/Doroti.Host.Web/BrowserSemanticsTransport.cs) · [Nelyx 투영](Nelyx/src/framework/rendering/semantics-transport.ts) · [Nelyx DOM 게시](Nelyx/sdk/src/backends/browser/interaction.ts)

- **작업.** `FrameworkRoot`의 기존 스냅샷 캐시와 dirty 노드부터 재사용한다. 뷰·세대별 기준 순번을 두고 좌표·스크롤과 구조·역할·액션 변경을 각각 반영한다. 조상 변환·클립의 영향 범위를 갱신하고 최초 게시, 기준 누락, 표시 계층 변경에는 전체 스냅샷을 적용한다. 현재 편집 요소와 IME 조합, PlatformView의 Tab 순서를 유지한다. [프레임 생명주기](Nelyx/src/framework/widgets/root.ts)
- **수락.** Demo의 목록 스크롤·창 리사이즈와 Testbed 3의 편집기·모달에서 전체 재계산 결과와 bounds·읽기 순서·액션이 일치한다. 위치 변경 동안 동일한 DOM 노드·포커스·선택을 확인한다. Web과 Windows WebView2에서 순회 노드 수·DOM 쓰기·게시 p95를 비교하고 Android TalkBack과 Windows Narrator의 탐색·발화를 확인한다. Doroti의 과거 계측은 비교 설계 참고로 사용한다. [Doroti 검증 이력](../DorotiLab/history/26/11/26/incremental-semantics-summary.md)

### 02 · OS 파일·텍스트·링크 드롭

Doroti는 `IOsDragDropHostCapability`로 창 안의 수신 영역, Enter/Over/Leave/Drop, 허용 형식과 파일 읽기 권한을 연결한다. Windows App SDK·Web·Qt·AppKit 등의 수신 범위가 다르며 Qt에는 텍스트·링크 등의 OS 송신 경로도 있다. Nelyx의 `Draggable`/`DragTarget`은 위젯 트리 안에서 동작하고 파일 서비스는 picker로 선택한 파일을 제공한다. Finder·Explorer 등 외부에서 가져오는 데이터의 공개 수신 계약이 남아 있다. [Doroti 수신 계약](../DorotiLab/Doroti/src/Doroti.Ui/OsDragDrop.cs) · [Qt 서비스](../DorotiLab/packages/platforms/qt/Doroti.Host.Qt/QtNativeServices.cs) · [Nelyx 위젯 드래그](Nelyx/src/framework/widgets/drag-target.ts) · [Nelyx 파일 API](Nelyx/sdk/src/devices.ts)

- **작업.** Web DataTransfer와 Windows Tauri 파일 드롭에서 호스트가 실제로 제공하는 형식을 확인하고 뷰별 수신 영역과 연결한다. 파일 권한에는 picker와 같은 앱 범위·취소·정리 정책을 쓰고, 필요한 경우 기존 `DeviceFile.read()`를 유지하면서 제한된 읽기와 해제 계약을 확장한다. 지원 형식을 호스트에서 알려 주고 macOS·Linux의 수신과 OS 송신은 별도로 연결한다.
- **수락.** Testbed 3에서 실제 Explorer와 브라우저로 파일을 넣어 이름과 일부 바이트를 확인한다. 지원 호스트는 텍스트·URI도 구분한다. 모달 뒤 영역, 다른 창, 취소·이탈, DPR 변경, 뷰 종료 뒤 파일 읽기와 늦은 이벤트를 확인한다. 파일을 선택하는 기존 버튼도 같은 앱에서 동작한다.

### 03 · 실행 중 창 생성, 창 소유권, 네이티브 메뉴

Doroti의 `IWindowService`는 창 종류·소유자·생성·동작·닫기 상태를 공개한다. Windows App SDK·AppKit에는 소유 창과 네이티브 메뉴 연결이 있고 Qt는 일반 창 중심이다. Nelyx의 Tauri 창은 앱 설정에서 선언하고 현재 창의 제목과 Windows Acrylic 등을 제어한다. Material의 별도 대화상자에는 `window.open`을 사용하는 DOM 경로가 있고 Material `MenuBar`는 위젯 안에 그린다. 실행 중 만드는 OS 창의 생명주기와 네이티브 메뉴의 항목·단축키 연결이 부족하다. [Doroti 창·메뉴 계약](../DorotiLab/Doroti/src/Doroti.Ui/Windowing.cs) · [Windows 창 호스트](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsAppSdkDesktopWindowHost.cs) · [Qt 정책](../DorotiLab/packages/platforms/qt/Doroti.Host.Qt/QtDesktopWindowPolicy.cs) · [Nelyx 창 설정](Nelyx/sdk/src/runtime/config.ts) · [별도 DOM 창](Nelyx/sdk/src/frontend/dom/dialog-windows.ts) · [Material 메뉴](packages/material/src/menu-anchor.ts)

- **작업.** Windows Tauri에서 일반 보조 창, 소유 대화상자, 포커스·닫기 처리부터 연결한다. 선언한 창 종류와 권한만 생성할 수 있도록 SDK의 창 상태와 Tauri 호스트의 라벨을 연결한다. 닫힌 창의 이벤트·리소스를 정리하고 네이티브 메뉴 항목과 가속키를 현재 창으로 보낸다. macOS·Linux의 창 종류·메뉴·외형은 각 호스트의 지원 범위에서 추가한다. AppKit의 Liquid Glass와 Qt의 Acrylic은 외형 후속 항목이다. [Doroti 창 외형](../DorotiLab/Doroti/README.ko.md#창-외형)
- **수락.** Testbed 3에서 두 OS 창의 입력·라우트·IME가 독립적으로 동작한다. 모달에서 부모의 입력을 막고 닫기 취소 및 부모 종료 때 자식 정리를 확인한다. 메뉴 클릭과 가속키가 활성 창에서 각각 한 번 실행된다. Web 팝업이 막히면 기존 인앱 대화상자가 열린다. Windows Acrylic과 창 리사이즈도 확인한다.

## 3. P1 · 그래픽과 SDK 확장

### 04 · GPU 셰이더, 자식·배경 필터와 가변 블러

Web과 Tauri WebView에서 Nelyx 전체 장면의 GPU 백엔드는 CanvasKit Ganesh/WebGL2다. `direct`·`worker-transfer`·`worker-shared`는 같은 GPU API에서 사용하는 실행·프레임 전달 방식이다. CanvasKit `RuntimeEffect.Make`는 SkSL 소스를 받아 Skia의 그리기 파이프라인에 합친다. Naga가 생성한 GLSL ES 3.00을 사용하려면 WebGL2가 프로그램을 컴파일·링크하고, CanvasKit의 장면과 입출력 텍스처를 연결하는 효과 패스가 필요하다. [Nelyx WebGL2 표면](Nelyx/skia/packages/web/src/surface.ts) · [CanvasKit 연결](Nelyx/skia/packages/web/src/paint-effects.ts) · [Skia Runtime Effects](https://skia.org/docs/user/sksl/) · [WebGL 2.0 셰이더 사양](https://registry.khronos.org/webgl/specs/latest/2.0/)

| 기능 | Doroti | Nelyx의 현재 구현과 격차 |
| --- | --- | --- |
| 그리기 셰이더 | SkSL과 렌더러별 기능 조회가 있다. | SkSL `RuntimeShader`가 float uniform 배열을 `RuntimeEffect.Make`와 `makeShader`에 넘긴다. Material InkSparkle이 사용한다. 앱 작성자가 사용할 자산 선언·타입 있는 파라미터·컴파일 진단과 텍스처 입력을 확장할 수 있다. |
| 후처리 | `GpuEffect`는 자식 이미지를, `GpuBackdropEffect`는 현재 Skia 레이어의 앞서 그린 픽셀을 샘플링한다. `ImageFilter.variableBlur`는 위치별 블러 강도를 지원한다. | 표준 Gaussian, 색·행렬·팽창·침식 등은 구현돼 있다. `ImageFilter.shader()`와 CanvasKit의 `bounds` 지정 Gaussian 경로는 예외로 종료한다. 현재 `RuntimeShader`는 float uniform 입력만 받아, 위젯 장면을 입력으로 하는 후처리와 가변 블러가 격차다. |
| WGSL 공급 | `DorotiGpuEffect` 입력을 빌드에서 Naga로 검증해 Vulkan SPIR-V, Metal MSL, WebGPU WGSL, WebGL2 GLSL 변형과 C# uniform 코드를 생성한다. WebGL2는 변환된 셰이더를 텍스처 기반 효과 패스에서 실행한다. | 패키지 소유 `.sksl`을 JS에 포함하는 빌드 도구가 있다. WGSL 입력을 추가할 경우 출력 대상은 WebGL2용 GLSL ES 3.00 한 종류면 충분하며 uniform·sampler 바인딩 정보를 함께 생성한다. 장면에서 실행하려면 그 정보를 쓰는 WebGL2 패스까지 연결한다. |

[Nelyx 셰이더](Nelyx/src/ui/shader.ts) · [이미지 필터](Nelyx/src/ui/image-filter.ts) · [SkSL 자산 빌드](Nelyx/eng/shader-assets.mjs) · [Doroti 효과 위젯](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/GpuEffect.cs) · [가변 블러](../DorotiLab/Doroti/src/Doroti.Ui/ImageFilter.VariableBlur.cs) · [WGSL 도구](../DorotiLab/tools/Doroti.Wgsl/README.md) · [Web 효과 호스트](../DorotiLab/packages/platforms/web/Doroti.Host.Web/DorotiWebWorkerSurface.GpuEffects.cs)

- **1차 · CanvasKit.** 현재 공급이 선언한 `makeShaderWithChildren`와 레이어·스냅샷 경로의 실제 사용 가능 범위를 확인한다. 앱 자산에서 불러온 SkSL 효과의 uniform과 입력 이미지 수를 검증한다. 자식 색 변환, 경계가 있는 가변 블러를 순서대로 구현한다. `Picture`·worker 메시지에 프로그램 식별자와 리소스 참조를 연결하고, 효과 영역과 입력으로 샘플링할 영역을 계산한다. 컨텍스트가 교체되면 프로그램·GPU 이미지의 수명을 새 세대에 맞춘다. [CanvasKit 장면 재생](Nelyx/skia/packages/web/src/replay.ts) · [프로그램 캐시](Nelyx/src/hosting/runtime-program-cache.ts)
- **2차 · WGSL 소스 호환이 필요한 경우.** Doroti의 Naga `webgl2-fragment` 변환을 참고한다. 입력 텍스처 한 개와 uniform을 쓰는 fragment 효과에서 시작해 WebGL2용 `#version 300 es`, 고정 vertex shader, sampler·uniform 메타데이터를 만든다. 브라우저 링크와 바인딩부터 확인한 뒤 CanvasKit의 기하·클립과 맞는 영역을 캡처하고, 출력 FBO 텍스처를 위젯 장면으로 합성한다. 같은 컨텍스트에서 텍스처를 전달할 수 있는지 현재 CanvasKit 공급으로 확인하고, GL 상태·동기화·텍스처 소유권과 컨텍스트 복구를 검증한다. 빌드 변환과 제품 장면의 픽셀 검증은 각각 완료해야 한다. [Doroti GLSL 생성](../DorotiLab/tools/Doroti.Wgsl/src/lib.rs) · [WebGL2 효과 패스](../DorotiLab/packages/platforms/web/Doroti.Host.Web/Web/doroti.web.gpu-effects.ts)
- **수락.** Testbed 3의 동일 장면에서 그림 색상, 자식 필터, 배경 블러, 효과 경계·알파와 스크롤 클립을 비교한다. Web과 Windows WebView2의 `direct`·`worker-transfer`·`worker-shared`에서 실제 선택된 경로를 확인한다. uniform만 바꿀 때 자식 레이아웃과 히트테스트가 유지되며 효과 픽셀은 바뀐다. 잘못된 소스·uniform은 위치와 함께 진단하고, 컨텍스트 복구·닫기·반복 전환에서 표면과 프로그램이 정리된다. 캡처 면적·GPU 메모리·프레임 제출 비용을 측정한다. 네이티브 컨트롤 픽셀에 걸친 효과는 05의 합성 장면에서 검증한다. [렌더러 검사](Nelyx/eng/check-web-renderers.mjs)

### 05 · 다중 PlatformView, 네이티브 WebView와 합성 효과

Doroti는 뷰 타입과 호스트별로 오버레이·교차 합성·텍스처·스냅샷 지원을 보고하고, 지원되는 경로에서 여러 네이티브 뷰와 제한된 배경 효과를 합성한다. `WebViewController`는 로드·탐색·이벤트를 뷰 수명에 연결한다. Nelyx의 Core 팩터리·DOM 합성·기본 네이티브 컨트롤은 동작하는 경로가 있다. Tauri 전경 경로는 화면에 동시에 보이는 OS 컨트롤 한 개와 최상단 그리기 구간 하나를 받으며, 같은 프레임에서 DOM PlatformView와 함께 보이는 경우에도 제한이 있다. Testbed의 WebView 패널은 iframe을 사용한다. [Doroti 합성 정책](../DorotiLab/Doroti/src/Doroti.Hosting/PlatformCompositionPlan.cs) · [Doroti WebView](../DorotiLab/Doroti/src/Doroti.Framework.Services/WebViewController.cs) · [Nelyx 네이티브 배치](Nelyx/sdk/src/backends/browser/native-platform-views.ts) · [Nelyx WebView 패널](sample/nelyx-testbed-app-3/src/webview-panel.tsx)

- **작업.** W9의 `PAUSED / PARTIAL` 항목인 Windows 이동 중 정렬, Galaxy 입력 표시 지연, Apple Xcode·VoiceOver, Linux ARM64 실기기 확인부터 해당 호스트에서 처리한다. 단일 컨트롤 기준을 통과한 호스트에서 `그림 → 뷰 A → 그림 → 뷰 B → 그림`을 조합하고, 뷰별 클립·가림·포인터·Tab·효과 지원을 보고한다. 기본 네이티브 WebView는 앱 콘텐츠 로드·뒤로/앞으로·이벤트부터 제공하고 각 뷰의 탐색 정책을 적용한다. 라이브 네이티브 배경 샘플링은 소스 표면을 지원하는 호스트에서 확장한다. [W9 재개 지점](history/26/11/27/work9-summary.md#재개-지점)
- **수락.** 두 컨트롤의 스크롤·창 모서리 드래그·DPR 변경에서 같은 합성 프레임의 슬롯과 픽셀 위치를 비교한다. 가려진 컨트롤로 입력이 전달되는 조건, 모달까지의 Tab 순서, 편집·IME 상태 보존, 창 닫기와 생성 완료의 경합을 확인한다. 대체 장면과 WebView 탐색 거절도 샘플에서 확인한다. [Core 검사](Nelyx/eng/check-platform-view-core.mjs) · [DOM 검사](Nelyx/eng/check-platform-views-dom.mjs) · [수명 검사](Nelyx/eng/check-platform-view-lifecycle.mjs)

### 06 · 공개 Texture 위젯과 외부 프레임 공급

Doroti는 뷰별 `TextureRegistry`와 `Texture` 위젯으로 CPU RGBA, 브라우저 Canvas·동영상·프레임 및 호스트별 네이티브 GPU 버퍼를 장면에 넣는다. Nelyx Testbed 3도 Video·Camera·ImageBitmap·VideoFrame·WebCodecs를 보여주지만 React 패널의 별도 2D Canvas에 `drawImage`한다. Nelyx 장면 안에서 프레임을 위젯으로 배치하고 갱신·해제하는 공개 계약이 남아 있다. [Doroti 텍스처 등록](../DorotiLab/Doroti/src/Doroti.Ui/TextureContracts.cs) · [네이티브 프레임 소유권](../DorotiLab/Doroti/src/Doroti.Ui/NativeTextureContracts.cs) · [Nelyx Texture 패널](sample/nelyx-testbed-app-3/src/texture-panel.tsx)

- **작업.** 먼저 CPU RGBA와 브라우저 Canvas·VideoFrame을 `ResourceRegistry`와 기존 direct·worker 자원 수명에 연결한다. 최신 프레임 교체, freeze·resize, 업로드 한도와 소비 완료 시 반환을 정의한다. Android AHB/Surface와 Windows D3D11 등은 기기·컨텍스트별 제로카피 가능 범위와 복사 비용을 확인한 뒤 추가한다.
- **수락.** Testbed 3에서 영상을 Nelyx 위젯의 클립·회전·오버레이 아래에 놓고 pause·seek·freeze·recreate를 확인한다. 느린 소비자, 프레임 드롭, 창 닫기, 카메라 종료, 컨텍스트 교체 때 각 프레임과 카메라 구독이 정리된다. 실제 업로드 경로·메모리 최고치·드롭 프레임을 기록한다. [Nelyx 자원 계약](Nelyx/src/hosting/resources.ts) · [Doroti Web 텍스처 검사](../DorotiLab/packages/platforms/web/tests/browser-textures.mjs)

### 07 · 타입 있는 앱 ARB와 OS 로케일 연결

Doroti는 앱의 ARB에서 타입 있는 API·delegate를 생성하고 placeholder·중첩 plural/select·포맷 오류에 소스 위치를 제공한다. Windows·Apple 등의 호스트는 OS 언어 목록을 받는다. Nelyx는 Widgets·Material·Cupertino ARB 카탈로그와 `IntlProvider`, 로케일 전환·RTL·날짜 입력을 구현했다. 현재 공급 도구는 고정 Flutter 위젯 자료를 대상으로 하고 Demo의 앱 문구는 TypeScript 맵이다. Tauri UI도 WebView의 `navigator.languages`와 `languagechange`를 사용한다. [Doroti ARB 생성기](../DorotiLab/tools/Doroti.Localization.Generator/README.md) · [Doroti AppKit 언어](../DorotiLab/packages/platforms/maui/Doroti.Host.Maui/MauiViewEnvironment.MacOS.cs) · [Nelyx ARB 가져오기](tools/Nelyx.FrameworkToTypeScript/import-flutter-localizations.mjs) · [Demo 앱 문구](sample/nelyx-demo-app/src/localization-screen.ts) · [WebView 환경](Nelyx/sdk/src/backends/browser/platform-messages.ts)

- **작업.** CLI/Vite에서 앱 ARB를 선택적으로 읽고 TypeScript 메시지 함수·delegate·지원 태그를 만든다. 기존 `IntlProvider`로 언어별 포맷을 처리한다. Web은 브라우저 언어, Tauri는 가능한 호스트의 우선 언어 목록과 변경 알림을 공급한다. 앱 명시 선택·OS 선호·지원 목록 fallback 순서를 검증한다.
- **수락.** Demo의 앱 문구를 한·영·아랍어 ARB로 옮겨 복수형·숫자·날짜·RTL, 누락 키와 잘못된 인자 진단, 빠른 언어 전환과 실패 복구를 확인한다. 실제 OS·앱별 언어를 바꾼 Tauri와 이미 열려 있는 편집기·대화상자를 포함한다. [기존 현지화 검사](sample/nelyx-demo-app/eng/check-localization.mjs)

### 08 · 앱 생명주기, 내비게이션과 초안 복구

Doroti는 `AppLifecycleListener`와 호스트 생명주기, 네이티브 앱별 파일 체크포인트, 문서 초안 복구 샘플을 갖고 있다. Nelyx에도 `ServicesBinding`의 생명주기 관찰, 복원 버킷, 라우트 복원과 앱 저장소가 있다. 기본 DOM 복원은 `sessionStorage`를 사용하고 생명주기는 문서의 포커스·가시성에서 읽는다. OS가 앱을 재시작했을 때 복원하는 공용 진입점과 OS 생명주기 이벤트의 범위를 늘릴 수 있다. [Doroti 생명주기](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/app_lifecycle_listener.cs) · [파일 복원](../DorotiLab/Doroti/src/Doroti.Hosting/FileRestorationStore.cs) · [초안 샘플](../DorotiLab/samples/DorotiTestbedApp/src/MaterialSample/DocumentRecoverySample.cs) · [Nelyx 바인딩](Nelyx/src/services/binding.ts) · [DOM 복원](Nelyx/sdk/src/backends/browser/platform-messages.ts)

- **작업·수락.** 공개 생명주기 리스너를 기존 바인딩에 얹고 Tauri 창 종료, 모바일 중단·복귀를 연결한다. 앱이 선택한 복원 범위에서 앱 저장소와 원자적 체크포인트를 연결한다. 새로고침·앱 재실행·모바일 프로세스 종료 후 라우트·초안이 복구되고, 손상된 체크포인트와 창 두 개가 같은 키를 갱신하는 경우도 확인한다.

### 09 · 재사용할 수 있는 앱 플러그인 공급

Doroti Runner SDK는 패키지의 ID·채널·코덱·버전·RID·ABI·자산을 빌드에서 검증하고 등록 정보를 내장한다. 런타임에 타입 있는 호출과 취소 가능한 이벤트 구독 계약이 있다. Nelyx는 `PluginPlatformMessagePort`와 Rust `Registry`, 창별 명령 허용 목록, 앱 소유 Android·iOS 오버레이가 있다. 재사용 패키지가 Web 구현과 Tauri 네이티브 어댑터를 같은 공개 계약에 등록하고 검증하는 경로가 부족하다. [Doroti 패키지 등록](../DorotiLab/Doroti/src/Doroti.Runner.Sdk/Sdk/Doroti.Plugins.targets) · [관리 코드 호출](../DorotiLab/Doroti/src/Doroti.Ui/ManagedPluginContracts.cs) · [이벤트 계약](../DorotiLab/Doroti/src/Doroti.Hosting/DorotiPluginEvents.cs) · [Nelyx 메시지 포트](Nelyx/sdk/src/runtime/plugin-port.ts) · [Rust 등록](Nelyx/backend/crates/nelyx-backend-core/src/lib.rs) · [Tauri 호스트 생성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs)

- **작업·수락.** 기존 Rust 등록과 TS 메시지 포트를 사용해 호출·이벤트·해제와 플랫폼 지원을 한 패키지에서 선언한다. 독립 스타터 한 개가 기존 장치 API에 포함되지 않은 샘플 플러그인을 Web과 Windows Tauri에서 소비한다. 중복 등록, 지원하지 않는 타깃, 창 권한, 폐기 뒤 이벤트와 잘못된 버전의 진단을 확인한다.

## 4. P2 · 위젯과 렌더링 품질

### 10 · Core 위젯과 커스텀 캐러셀

Doroti에는 `AnimatedList`·`AnimatedGrid` 및 Sliver 변형, `OverlayPortal`, 범용 `UndoHistory`가 있다. Nelyx에는 List/Grid·Sliver, `AnimatedSwitcher`, `OverlayEntry`, `EditableText` 전용 undo가 있다. 삽입·삭제 인덱스를 추적하는 리스트/그리드 애니메이션, 호출 위치의 상속 데이터와 수명을 유지하는 오버레이, 편집기 밖에서도 쓰는 undo API가 비교 대상이다. 앱에서 쓰는 묶음부터 Core에 이식하고 키·스크롤 오프셋·선택 상태·컨트롤러 해제의 회귀를 확인한다. [Doroti AnimatedList·Grid](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/animated_scroll_view.cs) · [Doroti OverlayPortal](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/overlay.cs) · [Doroti UndoHistory](../DorotiLab/Doroti/src/Doroti.Framework.Widgets/undo_history.cs) · [Nelyx Overlay](Nelyx/src/framework/widgets/overlay.ts) · [Nelyx 편집기](Nelyx/src/framework/widgets/editable-text.ts)

Doroti의 별도 `CustomCarousel`은 무한 루프, 선택 항목의 겹침 순서, 정규화된 위치에 따른 사용자 효과, 휠 입력 후 스냅을 제공한다. Nelyx Material `CarouselView`의 고정/가중 크기와 일반 스냅 위에 사용자 효과가 필요한 경우 별도 위젯으로 검토한다. 정밀 휠·드래그·프로그램 이동과 루프 경계에서 항목의 상태가 유지되는 것을 수락 기준으로 삼는다. [Doroti 커스텀 캐러셀](../DorotiLab/packages/Doroti.CustomCarousel/README.md) · [Nelyx Material Carousel](packages/material/src/carousel.ts)

### 11 · 복합 문자 조판, 캐럿과 접근성 좌표

Doroti의 선택형 합성 문단은 HarfBuzz와 Unicode 분석·단어 사전으로 그리기·캐럿·선택·접근성에 같은 UTF-16 클러스터와 좌표를 제공한다. Nelyx는 CanvasKit SkParagraph를 사용해 줄바꿈, 글꼴 기능·가변 축, 단어 경계와 클러스터 좌표를 질의한다. DOM 의미 트리 호스트는 `captureTextGeometry: false`로 편집 서비스의 좌표와 브라우저 노출을 사용한다. 먼저 현재 공급에서 태국어·크메르어 단어 경계, 아랍어 양방향, 한글 조합, ZWJ/결합 문자와 글꼴 fallback의 레이아웃·선택·접근성 좌표를 확인한다. 같은 fixture에서 근거가 생긴 조판·재배치·좌표 전달의 병목부터 수정한다. [Doroti 문단 설계와 검증](../DorotiLab/Doroti/docs/localization/paragraph-feasibility.md) · [Nelyx SkParagraph](Nelyx/skia/packages/web/src/library.ts) · [Nelyx 텍스트 옵션](Nelyx/skia/packages/web/src/text-style.ts) · [Nelyx DOM 접근성 호스트](Nelyx/sdk/src/backends/browser/interaction.ts)

### 12 · Tauri 네이티브 전체 장면 렌더링 검토

Doroti의 네이티브 호스트는 Windows·Android·Linux의 Vulkan과 Apple의 Metal로 전체 장면을 그린다. Nelyx는 Tauri WebView 안에서 CanvasKit Ganesh/WebGL2로 전체 장면을 그린다. Tauri의 네이티브 Skia 경로는 PlatformView 앞의 제한된 도형을 CPU에서 그리고 네이티브 표면에 게시한다. [Doroti 플랫폼별 렌더러](../DorotiLab/README.ko.md#플랫폼별-구현) · [Nelyx 현재 Skia 공급](Nelyx/skia/README.ko.md)

Tauri 전체 장면의 네이티브 렌더링은 텍스트·이미지·Picture·필터 재생과 재생 후 입력·시맨틱스가 일치하는 공급 후보가 생겼을 때 검토한다. 동일 앱과 기기에서 초기 로드, GPU 메모리, 입력부터 GPU 제출·완료·표시까지의 구간과 컨텍스트 상실 복구를 현재 경로와 비교한다. [Nelyx 기존 렌더 경로 비교](history/26/11/25/work4-summary.md)

## 5. 구현 후 검증 기준

- **앱에서 확인.** SDK 공급본으로 Demo·Testbed 3와 독립 스타터를 빌드해 공개 import 및 일반 CLI 경로를 확인한다. Web/PWA와 설치된 Tauri의 프런트엔드 빌드 ID 및 실제 선택 렌더러를 대조한다. 기존 입력·날짜·클립보드·Windows Acrylic·WebView 화면은 영향을 받는 작업과 함께 검사한다. [CLI 실행 안내](Nelyx/sdk/tooling/cli/README.ko.md) · [Windows 패키지 검사](Nelyx/eng/check-tauri-windows.mjs)
- **검증 환경.** Web·Windows WebView2를 첫 비교 환경으로 삼는다. 모바일 관련 기능은 Android x64 에뮬레이터와 ARM64 실기기를 각각 확인하고, Apple·Linux 네이티브 관련 항목은 해당 실행 환경에서 확인한다. 실제 접근성 발화, 입력과 표시 관측, 서명·배포는 수행한 범위만 기록한다. 자동 검증은 호출당 20분 제한을 적용하고 검증용 임시 산출물은 실행 종료 시 정리한다.
- **현재 상태.** 이 문서는 두 체크아웃의 코드 검토 결과와 후속 작업 순서를 기록한다. 제품 코드 변경, 앱 빌드·재실행 및 신규 성능 측정은 후속 구현에 포함한다.
