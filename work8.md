# Nelyx Windows 창 아크릴

**IMPLEMENTED** · 2026-11-27 KST · Nelyx 기준 `32e8c3bb` · Doroti 비교 `35475819`

Windows Tauri 앱의 창 뒤에 있는 바탕 화면과 다른 창을 Windows Desktop Acrylic으로 합성한다. Demo는 불투명하게 시작하며 **Settings → Acrylic window**에서 같은 창의 효과를 켜고 끌 수 있게 한다.

## 1. 소스 비교

| 경로 | 배경을 만드는 단계 |
| --- | --- |
| Doroti Windows App SDK | 최상위 HWND에 `DesktopAcrylicController`를 붙이고 Vulkan 콘텐츠를 premultiplied alpha로 합성한다. DWM에는 `DWMSBT_TRANSIENTWINDOW`를 설정해 기본 제목 표시줄과 크기 변경 시의 바탕에도 아크릴을 적용한다. [Vulkan 호스트](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsManagedVulkanPresenter.cs#L553) · [DWM 제목 표시줄](../DorotiLab/packages/platforms/windowsappsdk/native/src/exports.cpp#L2352) |
| Doroti Testbed | 지원 환경에서 네이티브 아크릴을 시작할 때 준비한다. 샘플 스위치는 같은 창의 콘텐츠 배경을 투명하게 바꿔 효과를 드러낸다. [창 시작 옵션](../DorotiLab/samples/DorotiTestbedApp/src/App.cs#L148) · [Material 토글](../DorotiLab/samples/DorotiTestbedApp/src/MaterialSample/SampleApp.cs#L157) |
| Nelyx Windows Tauri | Tauri가 HWND와 WebView2를 만든다. WebView2의 기본 배경, Demo의 `html/body` 배경, 위젯의 `Scaffold`와 탭 배경에서 각각 불투명 픽셀이 생긴다. CanvasKit은 alpha를 지원하며, `FrameworkRoot`가 프레임의 첫 명령으로 기본 불투명색 `0xff101827`을 그린다. [Tauri 창 생성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs) · [CanvasKit 컨텍스트](Nelyx/skia/packages/web/src/surface.ts#L53) · [프레임 배경색](Nelyx/src/framework/widgets/root.ts#L799) · [Demo 위젯](sample/nelyx-demo-app/src/demo-application.ts) |

Nelyx에서는 WebView2를 투명 배경으로 준비하고, 최상위 HWND의 `DWMWA_SYSTEMBACKDROP_TYPE`과 Demo 배경의 알파를 함께 바꾸면 기존 렌더러에서 Desktop Acrylic을 드러낼 수 있다. DWM의 `DWMSBT_TRANSIENTWINDOW`는 Windows 11 빌드 22621 이상에서 지원된다. Windows의 투명 효과 정책에 따라 DWM은 단색 재질을 표시할 수 있다. [DWM 재질](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/ne-dwmapi-dwm_systembackdrop_type) · [WebView2 배경](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2controller2#get_defaultbackgroundcolor) · [Windows 아크릴](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic)

## 2. 구현 순서

- [x] **W8-01. 창별 설정과 권한.** `nelyx.targets.tauri.windows[]`에 `windowsAcrylic: true`를 추가했다. Windows에서 선택한 창만 투명 WebView2와 아크릴 명령 권한을 갖는다.
- [x] **W8-02. DWM과 프런트엔드 연결.** 허용된 앱 페이지와 최상위 창을 확인한다. DWM 재질 속성을 읽어 지원 여부와 현재 상태를 전달한다. 스위치를 켜면 `DWMSBT_TRANSIENTWINDOW`를 적용하고 끄면 `DWMSBT_AUTO`로 복원한다. [네이티브 구현](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/window_acrylic.rs) · [SDK 연결](Nelyx/sdk/src/frontend/dom/environment.ts)
- [x] **W8-03. Demo 토글.** 지원 창에서는 `defineApp`의 `background: 0`으로 CanvasKit에 투명색을 전달한다. 적용 성공 후 DOM 배경을 투명하게 하고 갤러리 배경을 반투명하게 그린다. 끄면 기존 색을 사용한다. 요청이 실패하면 직전에 표시한 배경과 스위치 상태를 유지한다.
- [x] **W8-04. 실행 검증.** Windows Demo의 direct·worker-shared·worker-transfer에서 다른 창의 패턴이 실제로 흐려지는 것을 확인했다. 스위치, 제목 표시줄, 창 크기 변경과 Chrome의 불투명 기본 동작을 확인했다.

## 3. 판정 기준

- Windows에서 **Settings → Acrylic window**를 켜면 배경 패턴의 큰 색 변화는 들어오고 날카로운 경계는 흐려져야 한다. 끄면 같은 화면 위치의 앱 배경이 뒤쪽 패턴에 반응하지 않아야 한다.
- 창 테두리, 제목 표시줄 버튼, resize, 탭 이동과 텍스트 입력이 계속 동작해야 한다. 동일 HWND와 WebView 문서에서 반복 전환을 마쳐야 한다.
- 지원되지 않는 환경에서는 스위치를 생략하고 불투명 배경으로 표시한다. DWM 속성값과 실제 화면의 합성 결과를 각각 확인한다.

## 4. 실행과 앱 설정

저장소 루트에서 Windows Demo를 빌드하고 실행한다.

```powershell
npm.cmd run build:tauri -- --app sample/nelyx-demo-app --platform windows
npm.cmd --prefix sample/nelyx-demo-app run run:tauri -- --platform windows
```

하단 **Settings** 탭의 **Acrylic window**를 켠다. 현재 실행에서 끄려면 같은 스위치를 다시 사용한다. 새 창은 불투명하게 시작한다.

다른 앱은 `package.json`의 `nelyx.targets.tauri.windows[]`에서 대상 창에 `"windowsAcrylic": true`를 지정한다. `@nelyx/sdk/frontend/dom/environment`의 `windowAcrylicFor()`는 지원 창에서 `enabled`와 `setEnabled(boolean)`을 제공한다. `setEnabled(true)`가 완료되면 캔버스의 `defineApp({ background: 0, … })` 설정과 함께 DOM 및 위젯 배경을 투명하게 해 효과를 드러낼 수 있다. Demo는 배경색에 알파 184/255를 적용해 글자 대비를 확보한다. [Demo 앱 정의](sample/nelyx-demo-app/src/app.ts) · [배경과 스위치 상태](sample/nelyx-demo-app/src/app-surface.tsx)

## 5. 실행 검증

- Windows 11 26H2, WebView2 158.0.4370.33, 200% 배율에서 Demo 뒤에 두 색의 패턴을 표시한 창을 놓고 색 위치를 교환했다. 아크릴을 켜면 Demo의 빈 배경에서 같은 위치의 RGB 채널값이 최대 57만큼 따라 바뀌었다. 원본 경계에서 인접 픽셀의 최대 채널 차이는 211이었고, Demo 배경에서는 1, 네이티브 제목 표시줄에서는 4였다. 끈 상태에서 같은 위치의 변화는 0이었다.
- DWM 속성은 같은 HWND에서 `0 → 3 → 0`으로 전환됐고 캔버스와 WebView 문서도 유지됐다. 창 크기 변경, 제목 표시줄의 최대화·복원, 최소화 후 복원, 스페이스 키 전환과 `aria-checked` 상태를 확인했다. Cupertino에 입력한 문장과 다크 모드는 전환 후에도 유지됐다.
- Windows EXE의 SHA-256과 WebView2의 프런트엔드 빌드 ID `4b4edeb060bbbdb02a9107d7a46880fdd76f360f5db3bc540a2f8a022dc30c3a`를 패키지 정보와 대조했다. 기존 Windows 검사에서 앱 Rust IPC, 클립보드, 제목, 내장 자산도 확인했다. [Windows 패키지 검사](Nelyx/eng/check-tauri-windows.mjs)
- 생성기에서 창별 opt-in과 권한, 잘못된 값 거부, Android·iOS·Linux·macOS 호스트 설정에서의 Windows 옵션 제외를 확인했다. Chrome의 direct·worker-shared·worker-transfer는 불투명 배경으로 시작했고 아크릴 조작 항목을 표시하지 않았다.
- Windows·Web 빌드와 생성된 백엔드 바인딩 검사는 통과했다. 현지화 입력란의 아랍어 대체 글꼴을 `TextFieldOptions.style`로 전달하도록 수정한 뒤 Demo 전체 `typecheck`와 Windows 설치 패키지 `2503b34c1615`의 현지화 입력 및 날짜 대화상자 검사도 통과했다. [현지화 입력란](sample/nelyx-demo-app/src/localization-screen.ts#L107) · [현지화 검사](sample/nelyx-demo-app/eng/check-localization.mjs)
