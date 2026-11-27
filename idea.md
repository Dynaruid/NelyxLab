# Nelyx에 네이티브 뷰를 넣는 방법

설계 제안 · 2026-11-27 · Nelyx `3327645f` 기준

**Nelyx가 위젯의 배치와 그리기 순서를 정하고, 호스트가 실제 네이티브 컨트롤을 소유하는 `PlatformView`를 권한다.** Web은 DOM 요소를 배치한다. 네이티브 플랫폼에서 지도 위에 Nelyx 버튼까지 올리려면 **투명한 네이티브 Skia 뷰 한 장에 전경을 그리는 방식**을 먼저 실험한다. 이렇게 하면 지도가 계속 움직이는 동안 버튼의 모양과 상태도 기존 Nelyx 위젯이 관리할 수 있다. Testbed 3의 첫 대상으로는 한글 입력과 클릭을 확인하기 쉬운 Win32 `EDIT`와 Nelyx 버튼을 고른다.

## 1. 지금 있는 코드에서 출발할 곳

| 현재 구현 | 설계에 주는 단서 |
| --- | --- |
| Testbed 3의 `HostSlot`은 `LayoutBuilder`에서 등록한 프레임 후 콜백으로 `localToGlobal(Offset.zero)`와 크기를 읽는다. React는 그 좌표에 `ApplicationSurface`의 형제인 HTML 패널을 놓는다. | 이미 화면 한 구역을 빌려줄 수 있다. 다만 배치 정보에는 조상의 클립이나 뒤에 그린 위젯이 없다. 샘플의 가림막과 대화상자도 HTML이며, Nelyx 팝업은 앱이 직접 패널을 숨긴다. [자리 계산](sample/nelyx-testbed-app-3/src/host-slot.ts#L45) · [패널 장착](sample/nelyx-testbed-app-3/src/app-surface.tsx) · [HTML 컨트롤](sample/nelyx-testbed-app-3/src/host-panel.tsx#L47) · [팝업 처리](sample/nelyx-testbed-app-3/src/app.ts#L437) |
| Web과 Tauri가 같은 `ApplicationSurface`와 CanvasKit 렌더러를 쓴다. `WebView` 예제는 iframe이고 `Texture` 예제는 별도 2D 캔버스에 프레임을 그린다. | HTML 편집기나 웹 지도는 Tauri 안에서도 DOM으로 제공할 수 있다. Win32 컨트롤이나 Android 지도 SDK를 요청한 앱에는 별도의 OS 팩터리가 필요하다. [공용 Surface](Nelyx/sdk/src/frontend/dom/surface.tsx#L19) · [iframe](sample/nelyx-testbed-app-3/src/webview-panel.tsx) · [텍스처 샘플](sample/nelyx-testbed-app-3/src/texture-panel.tsx#L81) |
| Core에는 `PaintingContext.addLayer`, 네이티브 hit-test 표식, 자식 없는 semantics 노드의 `platformViewId`가 있다. `PlatformDispatcher`에 등록되는 ID는 앱의 루트 View를 식별한다. | 레이어 위치, 입력 대상, 접근성 연결점을 재사용한다. 한 화면에 넣을 개별 컨트롤의 ID와 그 컨트롤을 만드는 팩터리는 새로 정의한다. [레이어 삽입](Nelyx/src/framework/painting/context.ts#L274) · [hit test](Nelyx/src/framework/gestures/binding.ts#L508) · [semantics](Nelyx/src/framework/semantics/semantics.ts#L3905) · [루트 View 식별자](Nelyx/src/ui/platform-dispatcher.ts#L33) |

Flutter에서 가져올 부분은 위젯의 `State`가 컨트롤 수명을 관리하고, `PlatformViewLayer`가 장면에 뷰의 ID와 위치를 남기는 구조다. 로컬 DorotiLab에도 이 둘을 잇는 예가 있다. `RenderPlatformView`는 유한한 크기를 받고 레이어를 추가한다. Windows 팩터리는 요청한 효과와 호스트 구성을 확인해 지원 범위를 돌려준다. Nelyx에서는 이 구조를 WebView와 CanvasKit 사이에 연결해야 한다. [Flutter 위젯 수명](https://api.flutter.dev/flutter/widgets/PlatformViewLink-class.html) · [Flutter 렌더 레이어](https://api.flutter.dev/flutter/rendering/PlatformViewLayer-class.html) · [Doroti 렌더 객체](../DorotiLab/Doroti/src/Doroti.Framework.Rendering/PlatformViewSurface.cs) · [Doroti HWND 팩터리](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsHwndPlatformViewFactory.cs#L48)

## 2. 어떤 방식이 필요한가

| 앱에서 필요한 동작 | 구현 방식 | 선택 기준과 비용 |
| --- | --- | --- |
| 페이지 안에서 HTML 편집기, iframe, 웹 지도 사용 | `ApplicationSurface` 안에 DOM 요소를 배치 | Web과 Tauri에서 공유하기 쉽고 브라우저의 포커스·IME를 쓸 수 있다. 단일 캔버스 위에 놓으면 Nelyx가 나중에 그린 픽셀도 요소 뒤에 보인다. iframe 안에서 시작한 포인터는 부모 캔버스가 받을 수 없다. [Flutter Web의 입력·오버레이 설명](https://api.flutter.dev/flutter/widgets/HtmlElementView-class.html) |
| 네이티브 지도 SDK, OS 편집기처럼 자체 입력과 접근성이 필요한 뷰 | Tauri WebView와 같은 창의 네이티브 자식 컨트롤로 배치 | 실제 컨트롤이 선택·한글 조합·터치를 직접 받는다. WebView 바깥의 뷰까지 배치와 가림을 동기화해야 한다. **첫 OS 구현으로 권장한다.** |
| 카메라·영상 프리뷰 위에 Nelyx 자막이나 버튼을 자유롭게 표시 | 생산자가 내주는 영상 프레임을 CanvasKit에서 텍스처로 그리기 | 텍스처에는 픽셀만 전달된다. 1920×1080 RGBA를 초당 60장 복사하면 약 475 MiB/s다. Tauri IPC에는 제어값만 보내고, 생산자와 WebView 렌더러 사이의 프레임 전달·반납 경로를 따로 검증한다. 보호 영상은 공급자가 허용하는 경로를 사용한다. |
| 네이티브 지도 **위에** Nelyx 반투명 카드가 움직여야 함 | 배경 캔버스 → 호스트 뷰 → 투명한 전경을 순서대로 합성 | DOM 뷰는 캔버스를 분할해 같은 문서에서 쌓을 수 있다. 형제 HWND·UIView 위에 올릴 전경은 OS 합성기에 제출한다. 네이티브 Skia를 쓰면 지도를 이미지로 복사할 필요가 없다. [Flutter Web의 캔버스 분할](https://api.flutter.dev/flutter/widgets/HtmlElementView-class.html) · [WebView2 호스팅 방식](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/windowed-vs-visual-hosting) |

파일 선택처럼 결과 하나만 돌려받는 기능은 기존 디바이스 서비스로 충분하다. 스캐너가 화면 전체를 차지하고 완료 후 닫히는 제품이라면 네이티브 화면을 열고 결과를 돌려주는 플러그인이 더 단순하다. `PlatformView`의 이득은 Nelyx 레이아웃 안에 살아 있는 컨트롤을 계속 둘 때 생긴다. [현재 SDK 디바이스 서비스](Nelyx/sdk/README.ko.md)

### 네이티브 Skia 뷰를 한 장 더 두는 설계

지도 오른쪽 위의 확대 버튼을 예로 들면 창 안에 아래 순서로 쌓는다.

| 아래에서 위로 | 무엇을 그리고 누가 입력을 받는가 |
| --- | --- |
| 1. 기존 WebView의 CanvasKit | Nelyx 페이지 배경과 지도보다 먼저 그리는 콘텐츠를 담당한다. |
| 2. 실제 네이티브 지도 뷰 | 지도 SDK가 자기 표면에 그리고, 지도 영역에서 시작한 드래그와 핀치를 받는다. |
| 3. 투명한 네이티브 Skia 표면 | Nelyx가 기록한 확대 버튼과 반투명 카드를 그린다. 버튼 영역에서 시작한 터치는 기존 Nelyx 콜백으로 보낸다. |

`FrameworkRoot` 하나가 위젯의 build·layout·paint를 맡는다. `SceneBuilder`가 장면을 단일 `PaintFrame`으로 펼치기 전에 `PlatformViewLayer`를 경계로 배경 명령, 네이티브 뷰 배치, 전경 명령을 만든다. 각 그리기 명령은 한쪽 표면에만 보낸다. 전경 표면은 겹침이 생길 때 확보해 재사용한다. 새 표면과 이전 그림이 사라진 자리는 투명색으로 지우고 premultiplied alpha로 합성한다. 조상의 변환과 클립은 두 그리기 구간에 복원한다. Flutter의 Android hybrid composition도 실제 뷰 위에 필요한 전경을 별도 표면에 그린다. [Nelyx의 paint와 배경 clear](Nelyx/src/framework/widgets/root.ts#L783) · [장면을 펼치는 위치](Nelyx/src/ui/scene.ts#L798) · [Flutter Android 합성](https://docs.flutter.dev/platform-integration/android/platform-views)

Core의 **`encodeFrame()`은 전경 명령을 전달하는 데 재사용할 수 있다.** 현재 Web과 Tauri가 공급하는 렌더러는 CanvasKit/Ganesh WebGL2다. 저장소의 Vulkan helper에는 오프스크린 표면과 Win32 프레임을 만드는 인터페이스가 있다. Tauri 쪽에는 네이티브 Skia 라이브러리의 빌드·패키징, 전경 명령을 해석할 렌더러, OS가 표시할 표면 연결을 추가해야 한다. [배포 중인 렌더러](Nelyx/skia/README.ko.md) · [프레임 인코더](Nelyx/src/ui/frame-wire.ts#L43) · [GPU helper](Nelyx/engine/render/vulkan/gpu_context.h#L21) · [Tauri 호스트 구성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs#L163)

- **명령과 자원.** 바뀐 전경 구간은 독립적으로 다시 그릴 수 있는 명령 묶음으로 보내고 배치·입력 영역에도 같은 프레임 순번을 붙인다. `drawPicture`에는 원본 그림 명령을, 폰트·이미지에는 원본 자산을 최초 한 번 등록해 네이티브 핸들을 만든다. 이후에는 ID와 세대만 참조하고 GPU 작업이 끝나면 자원을 해제할 수 있다. 텍스트를 지원할 때는 같은 폰트로 그린 두 렌더러의 줄바꿈과 기준선을 대조한다. [자원 매핑](Nelyx/src/ui/frame-wire.ts#L57) · [기존 worker의 자원 복원](Nelyx/sdk/src/backends/browser/render-worker-resources.ts#L94)
- **입력과 포커스.** 호스트가 표시 중인 전경의 hit-test 영역으로 포인터의 첫 수신자를 정한다. 확대 버튼은 기존 `ViewRuntime.dispatchPointer`로, 지도는 원래 OS 뷰로 보내고 종료·취소까지 같은 대상이 받는다. 따라서 투명한 모달 배리어도 지도 조작을 막을 수 있다. 키보드·IME는 포커스를 가진 편집기가, 접근성은 원래 버튼과 지도가 각각 제공한다. [Nelyx 포인터 진입점](Nelyx/src/hosting/runtime.ts#L440)
- **플랫폼 표면.** Windows의 첫 후보는 부모 HWND의 최상단 DirectComposition visual에 알파 지원 Skia 출력 표면을 연결하는 것이다. 이 visual은 자식 HWND 위에 합성할 수 있다. 해당 창의 최상단 target 사용 여부를 확인하고, 버튼 영역의 OS 입력 수신은 별도로 연결한다. Android는 일반 `View` 위의 투명 `TextureView`, Apple은 뷰 계층의 `CAMetalLayer`를 후보로 둔다. Android 지도나 영상 SDK가 별도 `SurfaceView`를 쓰면 그 표면의 실제 순서까지 확인해야 한다. [DirectComposition의 자식 창 합성 순서](https://learn.microsoft.com/en-us/windows/win32/api/dcomp/nf-dcomp-idcompositiondevice-createtargetforhwnd) · [Android TextureView](https://developer.android.com/reference/android/view/TextureView) · [Apple의 Metal 뷰](https://developer.apple.com/documentation/metal/creating-a-custom-metal-view)

한 장이면 **지도 한 개 위에 여러 Nelyx 버튼·카드**를 그릴 수 있다. `지도 A → Nelyx 카드 → 네이티브 뷰 B → Nelyx 메뉴`가 같은 위치에서 겹치면 A와 B 사이에도 OS가 표면을 끼울 수 있어야 한다. 서로 다른 그리기 구간에 필요한 만큼만 표면을 빌려 재사용한다. 지도 위의 반투명 색은 일반 알파 합성으로 표현할 수 있다. 지도 픽셀을 읽는 `BackdropFilter`나 두 표면에 걸친 그룹 투명도는 OS 효과 또는 공급자가 제공하는 프레임이 필요할 수 있다. [Doroti Windows의 혼합 레이어 처리](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsPlatformViewHost.cs#L297)

**네이티브 빌드의 주 화면까지 Skia가 그리는 선택**도 가능하다. 그러면 배경과 전경이 같은 네이티브 렌더러에서 폰트·이미지 캐시와 GPU 컨텍스트를 공유할 수 있다. TypeScript 위젯 트리는 당분간 WebView에서 실행할 수 있고, 이 경우 배경 명령도 호스트로 넘어간다. 전체 그리기 명령 재생, 텍스트 측정과 실제 출력의 일치, 현재 DOM에 연결된 입력·IME·접근성의 재연결까지 비용에 넣어야 한다. 우선 전경 한 장으로 겹침을 검증하고 주 렌더러 전환을 결정할 수 있다. Windows에서 기존 CanvasKit 전경을 활용하는 다른 구성은 투명 WebView 아래에 지도를 놓고 해당 영역의 알파를 지우는 것이다. 이 경우도 아래 지도에 입력을 전달하는 호스트 지원이 필요하다. [현재 DOM Surface](Nelyx/sdk/src/frontend/dom/surface.tsx#L19) · [투명 WebView 선례](work8.md)

## 3. 위젯 작성자와 플러그인 작성자가 만나는 API

아래는 제안하는 사용 형태다. `testbed/button`은 Web에서 HTML `button`, Windows에서 Win32 `BUTTON`을 등록한다. 앱은 두 구현에서 같은 `pressed` 이벤트를 받는다.

```ts
new SizedBox(
  160,
  44,
  new PlatformView({
    key: new ValueKey('save'),
    viewType: 'testbed/button',
    creationParams: { label: '저장' },
    onEvent: (event) => {
      if (event.type === 'pressed') save();
    },
    fallbackBuilder: () => new FilledButton({ onPressed: save, child: new Text('저장') }),
  }),
);
```

- **앱**은 타입 이름, 생성 인자, 이벤트, 대체 위젯을 지정한다. `creationParams`는 최초 생성 값이다. 이후 편집기 값이나 지도 위치는 플러그인의 컨트롤러 메서드로 바꾼다. 대체 편집기도 같은 값을 보여줘야 하면 앱이 편집 변경 이벤트로 문서 상태를 보관한다. 실제 OS SDK가 필요한 타입은 지원 대상에만 등록한다.
- **Core**의 `PlatformView` 상태가 인스턴스 ID를 먼저 예약하고 컨트롤러를 소유한다. 내부 `RenderPlatformView`는 양축이 유한한 부모 제약으로 크기를 정하고, `alwaysNeedsCompositing`을 켜서 `PlatformViewLayer`를 그리기 순서에 삽입한다. 스크롤 방향의 크기가 무한한 리스트에서는 호출자가 높이 또는 너비를 준다. 컨트롤러는 첫 유효 배치에서 호스트에 생성을 한 번 요청한다.
- **SDK와 호스트**는 대상별로 같은 `viewType`의 팩터리를 등록한다. 팩터리는 표현 방식(DOM 또는 OS 뷰)과 지원하는 클립·변환·입력·접근성을 알려준다. 호스트는 `create → applyFrame → dispose`를 구현하고 활성 인스턴스에 속성 변경과 포커스 요청을 받는다. 핸들은 `(ViewOwner.id, ViewOwner.generation, instanceId)`로 식별한다. DOM 팩터리는 해당 Surface의 document를 받고, Tauri 팩터리는 창의 UI 스레드에서 OS 객체를 다룬다.
- **Tauri 플러그인**에는 앱이 등록한 타입과 창별 권한만 노출한다. Rust 명령에서 실제 호출 WebView와 허용된 앱 페이지를 확인하고, 핸들을 발급한 창·View와 대조한다. 외부 문서를 표시하는 자식 WebView의 콘텐츠에는 이 관리 권한을 주지 않는다. 기존 CLI의 capability 생성과 플러그인의 `allowed()`가 연결 지점이다. [호스트 생성기](Nelyx/sdk/tooling/cli/src/tauri-host.mjs#L322) · [호출자 검사](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/lib.rs#L66) · [Tauri 권한 모델](https://v2.tauri.app/security/capabilities/)

## 4. 스크롤, 가림, 입력이 어긋나지 않게 하는 계약

**배치는 그 프레임의 최종 레이어에서 얻는다.** 스크롤할 때 자식 위젯과 편집기의 내용이 그대로여도 조상의 이동량과 클립은 달라진다.

1. `PaintingContext.addLayer`가 기록한 순서대로 `SceneBuilder`가 뷰 위치를 수집한다. 각 항목에 인스턴스 ID, 원래 사각형, 누적 변환, 조상 클립, 그리기 순서를 담는다. `RepaintBoundary`가 이전 장면을 재사용할 수 있도록 그림 구간과 뷰 표식을 나눠 저장하고 현재 조상의 변환을 다시 적용한다. 전체를 `drawPicture` 하나로 캐시하면 내부 뷰의 위치가 사라진다. 뷰 레이어의 `supportsRasterization()`은 `false`를 반환해 기존 `SnapshotWidget`에 캡처 제약을 알린다. [장면 작성](Nelyx/src/framework/widgets/root.ts#L783) · [장면을 그리기 명령으로 펼치는 위치](Nelyx/src/ui/scene.ts#L798) · [스냅샷 처리](Nelyx/src/framework/widgets/snapshot-widget.ts#L318)
2. 보이는 뷰의 전체 배치 목록을 `FrameBuildToken`에 묶는다. 교체·거절된 프레임의 목록은 폐기한다. direct에서는 제출 수락 후, worker에서는 같은 sequence의 `submitted` 응답 후 적용하는 것을 출발점으로 삼는다. worker의 `accepted`는 큐에 들어간 시점이다. UI 스레드에는 변경된 목록을 한 묶음만 보내고, 처리 중 쌓인 배치는 최신으로 합친다. 빈 목록은 모두 숨긴다는 뜻이다. 호스트는 오래된 세대·순번을 무시하며 입력 차단과 해제 요청을 별도로 확인한다. 실제 표시 시차는 화면에서 측정한다. [프레임 소유자와 세대](Nelyx/src/ui/types.ts#L19) · [제출 분기](Nelyx/src/hosting/runtime.ts#L912) · [worker 응답](Nelyx/sdk/src/backends/browser/render-worker-frames.ts#L293)
3. 위치의 기준은 해당 Surface의 **논리 좌표**다. SDK가 viewport 요소의 `getBoundingClientRect()`와 프레임의 논리 크기로 사각형 양 끝을 WebView 좌표로 옮긴다. 네이티브 어댑터가 이를 부모 컨테이너 좌표로 변환한다. DOM은 CSS px, Windows와 Android는 부모 영역의 물리 px, Apple은 뷰의 point를 사용한다. 클립은 원래 크기의 컨트롤을 감싸는 컨테이너에 적용한다. 편집기 절반을 가려도 텍스트 줄바꿈은 원래 폭을 따라야 한다. [뷰포트와 DPR](Nelyx/sdk/src/backends/browser/services.ts#L150) · [같은 좌표계의 입력 계산](Nelyx/sdk/src/backends/browser/input.ts#L79)

| 상황 | 전경 표면을 사용할 수 없는 사각형 슬롯의 동작 |
| --- | --- |
| 평상시 또는 리스트 스크롤 | 평행이동과 축 정렬 직사각형 클립을 지원한다. 지도 내부에서 시작한 드래그는 종료·취소까지 지도가, 바깥에서 시작한 스크롤은 Nelyx가 받는다. 이렇게 하면 제스처 하나에 소유자가 하나다. [캔버스의 포인터 캡처](Nelyx/sdk/src/backends/browser/input.ts#L45) |
| Nelyx 다이얼로그·메뉴가 열림 | 모달 전환에서 호스트 입력·포커스를 먼저 끊고 뷰를 숨긴다. OS 적용을 확인한 뒤 모달을 활성화한다. 닫히면 다음 유효한 배치에서 같은 인스턴스를 드러내고 원래 포커스가 유효하면 복원한다. 반투명 배리어 아래에는 앱의 대체 위젯이 보인다. |
| 일반 `Stack`의 일부 가림, 회전, 둥근 클립, 그룹 투명도, backdrop blur | 뒤에 그린 콘텐츠의 보수적인 경계가 슬롯과 겹치거나, 경계를 알 수 없거나, 조상 효과를 팩터리가 재현할 수 없으면 해당 프레임에는 뷰 전체를 숨기고 대체 위젯을 그린다. 대체 위젯의 공간은 슬롯이 계속 예약한다. 이런 화면에서 네이티브 뷰가 계속 보여야 하면 2절의 전경 합성이 필요하다. |
| 오프스크린, 재배치, 제거 | 살아 있는 같은 State·`viewType`은 인스턴스를 유지한다. 잠시 숨길 때 표시·입력·접근성을 함께 끈다. State 폐기, 타입 변경, 창 종료 때 해제하고, 중복 해제는 한 번만 처리한다. 생성 도중 제거되면 늦게 도착한 객체도 해제한다. 폐기된 인스턴스의 이벤트는 무시한다. |

새 컨트롤은 숨긴 채 만든다. 첫 배치가 적용되면 대체 위젯에서 컨트롤로 입력·접근성 소유권을 넘기고, 생성에 실패하면 대체 위젯을 유지한다. 호스트가 표현할 수 없는 가림이 발견되면 숨김·입력 차단을 먼저 확인하고 대체 위젯이 그려진 프레임을 제출한다. 숨김에 실패하면 호스트 컨테이너를 닫아 입력 해제를 확인한 뒤 전환한다. 전경 Skia 표면이 지원하는 모달은 네이티브 뷰를 화면에 유지하면서 그 뒤의 입력과 접근성 탐색을 차단한다.

접근성에서는 슬롯에 자식 없는 연결 노드를 두고 실제 버튼·텍스트·선택 값은 호스트의 DOM, UI Automation 또는 모바일 접근성 트리가 제공한다. 창 안에서 Nelyx → 호스트 → 다음 Nelyx 위젯으로 Tab과 역방향 탐색이 이어져야 한다. 호스트 편집기에 포커스가 있는 동안 Nelyx의 숨은 편집 입력을 비활성화하고 한글 조합·선택은 원래 컨트롤이 처리한다. 대체 위젯이 활성화되는 순간에는 내장 컨트롤의 접근성 노출도 닫아 같은 버튼이 두 번 읽히는 일을 막는다. [DOM 입력·접근성 연결](Nelyx/sdk/src/backends/browser/interaction.ts) · [키보드 입력 경계](Nelyx/sdk/src/backends/browser/input.ts#L177)

## 5. 플랫폼별로 어디에 붙일까

| 대상 | 첫 어댑터 후보와 확인할 점 |
| --- | --- |
| Web / PWA | `ApplicationSurface`마다 캔버스와 같은 viewport 안에 전용 DOM 컨테이너를 둔다. 컨테이너의 빈 공간은 입력을 통과시키고 보이는 슬롯만 포인터를 받는다. canvas 교체나 React 재마운트 시 해당 Surface가 만든 요소와 이벤트 구독을 함께 정리한다. [Surface 수명](Nelyx/sdk/src/frontend/dom/surface.tsx#L24) |
| Windows / Tauri | 최상위 창의 client 영역에 Win32 자식 `BUTTON`·`EDIT`를 두고 WebView2의 형제로 배치한다. Testbed 3는 `windowsRetainedViewport`를 켜므로 WebView의 음수 X 오프셋을 포함해 좌표를 변환해야 한다. 기존 `WM_NCCALCSIZE` 경로는 자식 창이 하나일 때만 `WVR_VALIDRECTS`를 반환한다. 형제 HWND를 추가하면 이 최적화 조건도 바뀐다. 일반 창과 retained 창의 네 모서리 리사이즈를 모두 확인할 이유다. [Testbed 설정](sample/nelyx-testbed-app-3/package.json#L180) · [자식 창 수 검사](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs#L301) · [WebView 배치](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs#L367) |
| Android / Tauri | Kotlin 플러그인이 WebView의 부모 `ViewGroup`에 사각형 컨테이너를 두고 `EditText`부터 붙인다. 기존 `SafeAreaPlugin.load(webView)`가 부모를 얻는 예다. 터치, 키보드 인셋, Activity 재생성을 먼저 확인한다. 별도 표면을 사용하는 `SurfaceView` 계열은 공급자별로 합성·접근성을 확인한 뒤 지원한다. [기존 Kotlin 연결](Nelyx/backend/crates/tauri-plugin-nelyx-backend/android/src/main/java/dev/nelyx/backend/SafeAreaPlugin.kt#L68) · [Android 합성 방식 비교](https://docs.flutter.dev/platform-integration/android/platform-views) |
| iOS / macOS / Tauri | iOS는 메인 스레드에서 Tauri의 `WKWebView`를 얻는 기존 경로를 사용해 같은 부모에 `UIView`를 배치한다. macOS는 `NSView`로 구현하고 부모 좌표계의 Y 방향을 변환한다. iOS 키보드·VoiceOver와 macOS 포커스 이동은 각 호스트에서 확인한다. [기존 iOS 연결](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/scroll_edge_effects.rs#L55) · [UIKit 임베딩](https://docs.flutter.dev/platform-integration/ios/platform-views) · [AppKit 임베딩](https://docs.flutter.dev/platform-integration/macos/platform-views) |
| Linux / Tauri | WebKitGTK가 붙은 컨테이너에 `GtkOverlay`와 GTK 입력 위젯을 넣는 방식을 후보로 둔다. 생성된 호스트에서 부모 구성, 포커스, 클립을 X11과 Wayland 각각 확인한 조합만 노출한다. [GTK Overlay](https://docs.gtk.org/gtk3/class.Overlay.html) |

## 6. Testbed 3에서의 구현 순서와 판정 기준

1. **Core와 DOM을 먼저 연결한다.** 기존 데모와 비교할 수 있게 새 슬롯에 버튼과 편집기를 하나씩 넣는다. 같은 키로 형제 순서를 바꾸고, 리스트를 스크롤하고, `RepaintBoundary` 아래에서 조상만 이동시킨다. 보이는 위치와 클릭 위치가 함께 움직이고 입력 값·선택·인스턴스가 유지되어야 한다. 뷰가 없는 기존 화면은 추가 표면 생성이나 배치 IPC 없이 그려야 한다.
2. **Windows에서 같은 화면에 실제 HWND를 넣는다.** OS 클래스와 부모 HWND를 확인하고 편집기에 한글을 조합한다. Nelyx 다이얼로그를 열었을 때 가려진 버튼의 클릭 0회, 닫은 뒤 첫 클릭 1회, Tab 왕복, 스크린 리더의 단일 노출을 확인한다. 창 배율 변경과 네 모서리 드래그에서 슬롯 테두리와 OS 컨트롤을 같은 화면 프레임으로 비교한다. 정지 후 경계 오차는 물리 1px 이내를 목표로 하고, 드래그 중 배치 지연과 표시 간격은 direct·worker-shared·worker-transfer 각각에서 기록한다.
3. **같은 Windows 화면에 투명 Skia 전경 한 장을 추가한다.** 실제 `EDIT`의 일부를 반투명 카드로 덮고, 선 두 개로 그린 Nelyx `+` 버튼을 카드 위에 둔다. 이 단계는 폰트 공급 전에 도형·클립·알파만으로 시험할 수 있다. 카드 아래의 글자가 비치고, 버튼 클릭은 기존 Nelyx 카운터를 한 번 올리고, 옆을 클릭하면 같은 `EDIT`에서 한글 입력이 이어져야 한다. 전경을 닫은 뒤에는 잔상과 보이지 않는 클릭 영역이 모두 사라져야 한다. 스크롤과 네 모서리 resize 중에는 같은 화면에 찍힌 배경·편집기·버튼의 어긋남, 클릭 위치, 프레임 간격 p95, 추가 메모리를 2단계와 비교한다. 프레임 순번만으로 동시 표시를 판정할 수 없으므로 실제 표시 시차를 채택 기준에 넣는다.
4. **Android에서 수명과 표면 순서를 검증한다.** 같은 편집기를 `EditText`로 등록해 전경 버튼과의 겹침을 재현한 뒤 실제 지도 SDK의 표면에서도 확인한다. 회전, 키보드 열기·닫기, 백그라운드 복귀, 라우트 제거, 생성 도중 화면 닫기를 거친다. 폐기된 뷰의 이벤트 반영 0건, 라우트 제거 후 잔존 컨트롤 0개, TalkBack이 각 컨트롤을 한 번씩 읽는 것을 기준으로 삼는다. 영상 위 자막처럼 생산자가 프레임을 제공하는 화면은 텍스처 경로의 복사량과 표시 지연도 비교한다.
