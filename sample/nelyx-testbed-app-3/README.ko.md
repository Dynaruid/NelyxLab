# Nelyx Testbed 3

[English](README.md) | **한국어**

`DorotiLab/samples/DorotiTestbedApp`의 기본 Material 3 샘플을 Nelyx 위젯으로 옮겼습니다. Components 화면에서 버튼, 탐색, 선택, 입력과 이미지 예제를 실행할 수 있습니다. Color, Typography, Elevation 화면은 현재 테마의 속성을 보여 줍니다. 색상은 시드나 앱에 포함된 이미지에서 생성합니다. 넓은 화면에서는 탐색 레일과 두 열의 컴포넌트 갤러리가 표시됩니다.

Platform views는 호스트의 HTML 컨트롤로 겹침과 포커스를 시험합니다. WebView는 로컬 HTML을 iframe으로 실행하며, Web 타깃에서는 사이트가 허용하는 외부 URL도 열 수 있습니다. Texture는 Canvas에 실시간 프레임을 표시합니다. 카메라와 WebCodecs는 호스트에서 지원하고 필요한 권한을 허용할 때 사용할 수 있습니다. 지원되는 Windows 11 Tauri 창에는 Acrylic 전환 버튼이 표시됩니다.

## Composited views

탐색 막대의 **Composited views**를 엽니다. 접힌 탐색 레일에서는 마지막 레이어 아이콘을 누릅니다. 편집기와 iframe 위에 보이는 **+**는 Nelyx 카운터를 올립니다. 반투명 카드에서 **+** 바깥을 누르면 아래 HTML 컨트롤로 입력이 전달됩니다. **Hide overlay**, **Reverse views**, 스크롤로 편집 값과 iframe 상태가 유지되는지 확인할 수 있습니다. **Open composited views modal**을 열면 아래 컨트롤의 클릭과 Tab 진입이 차단됩니다.

Web과 Tauri WebView에서 동일한 `PlatformView` 위젯과 DOM 팩터리를 사용합니다. Web에서는 `platformFrame` 쿼리 매개변수로 준비 메시지를 보내는 별도 출처 HTTP(S) 문서를 지정할 수 있습니다. 준비 메시지의 출처와 발신 창을 확인한 뒤 로드 상태를 표시합니다. Tauri는 앱 안에 포함된 HTML 문서를 사용합니다. [위젯과 팩터리](src/platform-views.ts) · [수락 기준](../../work9.md)

Windows에서는 **Open Win32 editor demo**, Android에서는 **Open Android editor demo**, Linux에서는 **Open GTK editor demo**를 눌러 OS 편집기 위에서 같은 **+** 버튼을 시험할 수 있습니다. Windows는 계층형 Win32 `EDIT`를 WebView2와 같은 부모 창에 두고 DirectComposition에 카드를 그립니다. Android는 `EditText`와 투명 `TextureView`를 사용하며 소프트 키보드가 열리면 OS 인셋을 스크롤 영역에 반영합니다. Linux에서는 `GtkTextView`와 투명 Skia 전경을 `GtkOverlay`에 배치합니다. 창 높이를 줄이고 스크롤하면 편집기가 뷰포트 경계에서 잘리는 모습을 확인할 수 있습니다. [플랫폼별 확인 결과](../../work9.md#7-실행-현황)

iOS의 **Open UIKit editor demo**는 `UITextView` 위에 카드를 표시하고 소프트 키보드가 가리는 높이를 스크롤 영역에 반영합니다. macOS의 **Open AppKit editor demo**는 `NSTextView` 위에 카드를 표시합니다. 두 호스트 모두 WKWebView와 같은 부모에 편집기와 투명 `CAMetalLayer`를 배치합니다. 패키지의 실제 합성·키보드·VoiceOver 확인에는 Xcode 호스트가 필요합니다. [Apple 실행 명령](../../work9.md#5-구현-후-실행할-검증-명령)

## 실행

저장소 루트에서 실행합니다. [SDK 준비](../../README.ko.md#testbed와-demo-실행)

```powershell
npm.cmd run deploy -- --platform web --app Testbed3
npm.cmd run deploy -- --platform windows --app Testbed3
```

앱 디렉터리에서 개발 모드로 실행하려면 SDK를 먼저 공급합니다.

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- --app sample/nelyx-testbed-app-3
Set-Location sample/nelyx-testbed-app-3
npm.cmd install --workspaces=false
npm.cmd run prepare:web
npm.cmd run typecheck
npm.cmd run dev:web
```

Windows에서는 같은 앱 디렉터리에서 `npm.cmd run dev:tauri -- --platform windows`를 실행할 수 있습니다. GTK 3와 WebKitGTK 4.1 개발 패키지가 설치된 Linux에서는 SDK를 공급한 앱 디렉터리에서 다음 명령을 실행합니다.

```sh
npm run prepare:tauri -- --platform linux
npm run build:tauri -- --platform linux
npm run run:tauri -- --platform linux
```

## 출처

- Material 3 샘플은 DorotiTestbedApp과 Flutter 샘플을 바탕으로 만들었습니다. [Flutter 라이선스](LICENSE.flutter)
- 로컬 사진은 Mae Mu의 Unsplash 사진입니다. [원본 사진](https://unsplash.com/photos/9002s2VnOAY)
- 테마 이미지 여섯 장은 Flutter API 문서의 에셋입니다. [이미지 출처](https://github.com/flutter/assets-for-api-docs/tree/main/assets/material) · [에셋 라이선스](assets/theme/LICENSE.txt)
- Roboto는 Doroti 샘플에 포함된 글꼴을 사용합니다. Texture 테스트 영상도 Doroti 샘플에서 가져왔으며, FFmpeg의 `testsrc2`로 생성한 테스트 패턴입니다. [Roboto 라이선스](assets/fonts/LICENSE.roboto.txt)
