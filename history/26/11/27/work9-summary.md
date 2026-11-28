# W9 · PlatformView와 네이티브 Skia 전경 합성

원문 `work9.md` · 계획 작성 2026-11-27 KST · 실행·중간 마무리 11-28 · 기준 `main` `3327645f` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work9.md`

**PAUSED / PARTIAL.** Web·Windows·Android·Linux의 겹침 장면을 확인했다. Windows의 이동 중 정렬, Android ARM64의 입력 표시 지연, Apple Xcode·VoiceOver와 Linux ARM64 실기기 확인이 남았다. 설계 원안은 `git show 92b34484:idea.md`에서 조회할 수 있다.

## 구현 범위

- Core의 공개 `PlatformView`는 뷰 소유자·세대·인스턴스별 팩터리를 사용한다. 유한한 첫 배치에서 생성하고 동일 키·타입에서 제어 객체와 값·선택을 유지한다. retained 장면의 `그림 → 뷰 → 그림` 순서와 클립을 보존한다. direct·worker의 실제 제출에 배치와 입력 영역을 연결하고 오래된 프레임·폐기·늦은 생성은 해당 세대에서 정리한다. 지원 범위를 벗어난 효과는 대체 장면을 사용한다.
- Web·Tauri DOM은 같은 문서에서 CanvasKit 배경, HTML 편집기·iframe, 겹침이 필요한 곳의 투명 전경을 합성한다. 입력 영역과 시맨틱 순서를 장면에 연결한다. Testbed 3의 **Composited views**에서 `+` 버튼, 편집기·iframe, 가림과 모달을 확인할 수 있다. [Testbed 3 안내](../../../../sample/nelyx-testbed-app-3/README.ko.md#composited-views)
- Tauri 네이티브 경로는 등록된 창·뷰 타입의 OS 컨트롤 하나와 투명 전경 한 장을 합성한다. Web frame wire v1과 세대가 붙은 호스트 배치·입력 메시지를 쓰며 ABI별 Skia 라이브러리의 길이와 해시를 대조한다. CPU Skia가 사각형·둥근 사각형·선·알파·사각 클립을 재생한다. Windows는 BGRA/D3D11·DirectComposition, Android는 JNI RGBA·`TextureView`, Linux는 BGRA/Cairo·`GtkOverlay`, Apple은 BGRA·`CAMetalLayer`에 게시한다.
- 여러 네이티브 뷰가 교차하는 장면, 경계를 넘는 그룹 효과나 backdrop blur, 화면 전체의 네이티브 Skia 전환은 후속 설계 범위다.

## 수락 기준

- 전경 `+` 한 번에 Nelyx 콜백 한 번, 카드 빈 영역에서는 편집기 입력을 확인한다. 모달은 뒤 컨트롤의 포인터와 Tab을 막고 닫으면 같은 편집기와 상태를 복원한다. Tab·Shift+Tab, IME 확정·취소, 스크린 리더의 컨트롤별 발화를 확인한다.
- 스크롤·DPR·네 모서리 resize 뒤 정지 위치는 물리 1px 이내를 목표로 한다. 이동 중에는 같은 합성 프레임에서 슬롯·편집기·버튼의 상대 오차와 표시 간격을 비교한다. GPU fence, 입력 표시 지연과 추가 메모리는 각각의 관측값을 사용한다.
- 렌더러 복구·창 종료·세대 경합 뒤 이전 컨트롤·활성 입력 영역·lease를 해제한다. PlatformView가 없는 프레임의 추가 표면·배치 IPC는 0건이다. 지원 환경에서는 세 렌더 모드의 실제 선택을 확인한다.

## 플랫폼별 검증

| 플랫폼 | 당시 확인 범위 |
| --- | --- |
| Core·Web·Windows WebView2 DOM | Core 생성·해제와 두 겹 클립, 조상만 이동하는 retained 장면, 스냅샷 모드와 대체 처리를 확인했다. Chrome `e5ae0b22df22`와 Windows WebView2 `b449bdf77bbd`의 세 렌더 경로에서 DOM 장면을 확인했다. Chrome은 교차 출처 iframe 허용·거부, 모달·Tab, StrictMode 재마운트, 제출 순서 역전과 WebGL 복구 뒤 편집값 유지도 검사했다. |
| Windows Win32 x64 | 패키지 `b449bdf77bbd`의 세 렌더 모드에서 실제 계층형 `EDIT` 위 Skia 알파, 클릭 1회, 빈 영역 입력, Tab 왕복과 모달 뒤 동일 HWND를 확인했다. UI Automation·MSAA는 편집기 한 개를 노출했다. direct의 내레이터 음성 요약은 편집기·`+`·이름 있는 모달·닫기를 확인했다. Microsoft IME의 가상 키 입력으로 조합 취소와 한글 확정을 확인했다. |
| Android x64 에뮬레이터·Galaxy S25 ARM64 | `b449bdf77bbd` direct에서 실제 `EditText`·전경 픽셀·`+` 한 번, 키보드 인셋·모달·회전·백그라운드 복귀와 이전 소유자 거절을 확인했다. APK 서명·설치 해시·ABI와 공급을 대조했다. 에뮬레이터는 별도 테스트 IME의 `InputConnection`으로 조합·취소·확정을 확인했고 Galaxy는 기본 삼성 한글 키보드로 조합·삭제·재입력을 확인했다. |
| Android TalkBack | 에뮬레이터의 터치 탐색·음성 자막을 확인했다. Galaxy에서는 가상 외장 키보드와 Android 테스트 터치스크린으로 탐색, `+` 동작 1회, 편집기·모달·닫기의 음성 자막과 배경 트리 가림을 확인했다. 모달 안 이름 없는 그룹 포커스가 일부 남았다. 계측 APK·입력 장치를 제거하고 TalkBack 설정을 복원했다. |
| Android 표면 비교 | 별도 계측에서 기본 `SurfaceView`와 MapLibre의 Vulkan `SurfaceView`·`TextureView` 위로 카드를 합성했다. MapLibre 에뮬레이터·Galaxy 양쪽에서 버튼 밖 드래그는 지도에 도달했다. `setZOrderOnTop(true)` 표면은 전경을 가렸다. 공개 등록 타입은 `nelyx.android.edit`다. |
| Linux x64·ARM64 | x64 DEB `b633c8ab4b68`의 GTK 편집기 및 전경을 Xvfb X11·Sway Wayland에서 확인했다. AT-SPI는 동일 편집기와 모달 탐색을 확인했고 Orca 로그에 편집기·한글 본문·전경 버튼 발화가 남았다. ARM64 `00a9dd628d09` ELF·DEB는 QEMU와 Xvfb에서 Testbed 창 및 ARM64 WebKit 프로세스 시작을 확인했다. |
| iOS·macOS | UIKit `UITextView`·AppKit `NSTextView`와 WKWebView 옆의 투명 Metal 표면을 구현했다. Apple Skia 아카이브 5개의 해시와 macOS x64·ARM64, iOS 기기 ARM64, Simulator x64·ARM64의 잠긴 Cargo 검사를 확인했다. |

기존 WebView·Texture와 Demo `9b4bd1fae5cd`의 Windows Acrylic·한글 편집을 회귀 확인했다. Android Debug APK의 증분 ZIP 공백 문제를 정리하고 x64 → ARM64 → x64에서 마지막 x64 패키지가 Gradle 호출 없이 같은 해시로 재사용되는 것을 확인했다.

## Windows 동적 정렬

- 125%·200% 네 모서리 direct 드래그를 60Hz Win32 입력과 DXGI 합성 화면으로 비교했다. 정지 오차는 0px로 수렴했다. 전경을 켠 불투명 알파 경로의 `EDIT`–`+` 이동 중 오차 p95는 14–16px였다. 픽셀 재사용과 자식 HWND 배치를 개선해 실제 자식 위치 이동을 줄였고 편집기 픽셀의 오차는 남았다.
- 같은 너비 변경에서 네이티브 프레임 제출만 보류하면 `EDIT`–`+` 오차가 0px였다. 부모 창을 고정한 실험에서도 `EDIT` 너비가 바뀐 직후 편집기 픽셀이 최대 14px 움직였다. Win32 다시 그리기 플래그, `DwmFlush` 위치 변경, 색상 키, 별도 스크롤바 HWND만 배치하는 시도는 제품 경로에 채택하지 않았다. 색상 키는 표시와 히트 테스트에도 영향을 줬다.
- 독립 Win32 창에서 테두리 없는 실제 `EDIT`와 별도 `SCROLLBAR`, 전경을 같은 고정 크기 DirectComposition 대상에 투영하자 71개 DXGI 프레임에서 본문과 바깥 경계의 상대 오차가 p95/최대 0/0px였다. 비교의 실제 편집기는 가상 마우스 클릭으로 포커스를 받았다. Testbed 통합은 재개 항목이다. 별도 스크롤바만 배치한 실험을 되돌린 패키지 `bcf4a74aab09`에서 클릭·Tab·UI Automation·MSAA·모달 뒤 동일 HWND 복귀를 다시 확인했다. [Win32 편집기 배치](../../../../Nelyx/sdk/tooling/cli/templates/tauri/src/windows_platform_views.rs) · [Skia 전경 표시](../../../../Nelyx/sdk/tooling/cli/templates/tauri/skia-foreground/src/win32.rs)

## 재개 지점

| 대상 | 남은 작업과 확인 |
| --- | --- |
| Windows | 같은 DirectComposition 대상의 투영을 Testbed 경로에서 재현한다. 두 배율의 네 모서리에서 슬롯·편집기·버튼을 같은 DXGI 프레임으로 비교한다. 실제 스크롤바 입력·캐럿·IME·접근성, 드래그 도중 모니터 간 배율 변경과 장시간 GPU 메모리도 확인한다. |
| Android ARM64 | Galaxy 가로 화면에서 녹화로 확인한 편집기 위치 갱신 간격 p95는 전경 켬 41.68ms·끔 16.54ms였고 켬의 편집기–버튼 상대 오차는 p95 9px·최대 10.5px였다. 전경 켬의 PSS 증가 표본은 26.0–35.8MiB였다. 가상 키 시험에서 편집기에 유효한 글자 변경을 얻지 못했으므로 입력 표시 지연은 편집기 포커스와 문자 변화를 확인한 뒤 다시 측정한다. 패널 주사와 물리 입력 지연은 별도 확인 범위다. |
| iOS·macOS | Apple Silicon Mac에서 Xcode 링크·패키징·실행을 검증한다. 실제 편집기와 전경, iOS 키보드 인셋·IME, macOS Y축·배율·탭 이동 및 양쪽 VoiceOver를 확인한다. |
| Linux ARM64 | 실제 ARM64 장치에서 DEB의 GTK 편집기·Skia 전경 합성과 입력을 확인한다. |

Core·DOM·수명과 OS별 회귀는 해당 저장소 검사기로 재현할 수 있다. [Core](../../../../Nelyx/eng/check-platform-view-core.mjs) · [DOM](../../../../Nelyx/eng/check-platform-views-dom.mjs) · [수명](../../../../Nelyx/eng/check-platform-view-lifecycle.mjs) · [Windows](../../../../Nelyx/eng/check-tauri-windows.mjs) · [Android](../../../../Nelyx/eng/check-tauri-android-platform-views.mjs)

## Apple 실행 명령

Apple Silicon Mac에 Xcode와 iOS Simulator 런타임을 준비하고 저장소 루트에서 실행한다.

```sh
npm run build:tauri -- --app sample/nelyx-testbed-app-3 --platform macos
npm --prefix sample/nelyx-testbed-app-3 run run:tauri -- --platform macos
npm run build:tauri -- --app sample/nelyx-testbed-app-3 --platform ios --architecture arm64-sim
npm --prefix sample/nelyx-testbed-app-3 run run:tauri -- --platform ios --architecture arm64-sim
```

**Composited views**의 **Open AppKit editor demo** 또는 **Open UIKit editor demo**에서 전경 클릭·편집기 입력, 스크롤 클립, 모달 복귀와 Tab을 확인한다. iOS는 키보드 인셋을, macOS는 배율이 다른 창에서 선택과 슬롯 경계를 함께 확인한다.
