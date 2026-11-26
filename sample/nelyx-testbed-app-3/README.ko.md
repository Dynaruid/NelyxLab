# Nelyx Testbed 3

[English](README.md) | **한국어**

`DorotiLab/samples/DorotiTestbedApp`의 기본 Material 3 샘플을 Nelyx 위젯으로 옮겼습니다. Components 화면에서 버튼, 탐색, 선택, 입력과 이미지 예제를 실행할 수 있습니다. Color, Typography, Elevation 화면은 현재 테마의 속성을 보여 줍니다. 색상은 시드나 앱에 포함된 이미지에서 생성합니다. 넓은 화면에서는 탐색 레일과 두 열의 컴포넌트 갤러리가 표시됩니다.

Platform views는 호스트의 HTML 컨트롤로 겹침과 포커스를 시험합니다. WebView는 로컬 HTML을 iframe으로 실행하며, Web 타깃에서는 사이트가 허용하는 외부 URL도 열 수 있습니다. Texture는 Canvas에 실시간 프레임을 표시합니다. 카메라와 WebCodecs는 호스트에서 지원하고 필요한 권한을 허용할 때 사용할 수 있습니다. 지원되는 Windows 11 Tauri 창에는 Acrylic 전환 버튼이 표시됩니다.

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

Windows에서는 같은 앱 디렉터리에서 `npm.cmd run dev:tauri -- --platform windows`를 실행할 수 있습니다.

## 출처

- Material 3 샘플은 DorotiTestbedApp과 Flutter 샘플을 바탕으로 만들었습니다. [Flutter 라이선스](LICENSE.flutter)
- 로컬 사진은 Mae Mu의 Unsplash 사진입니다. [원본 사진](https://unsplash.com/photos/9002s2VnOAY)
- 테마 이미지 여섯 장은 Flutter API 문서의 에셋입니다. [이미지 출처](https://github.com/flutter/assets-for-api-docs/tree/main/assets/material) · [에셋 라이선스](assets/theme/LICENSE.txt)
- Roboto는 Doroti 샘플에 포함된 글꼴을 사용합니다. Texture 테스트 영상도 Doroti 샘플에서 가져왔으며, FFmpeg의 `testsrc2`로 생성한 테스트 패턴입니다. [Roboto 라이선스](assets/fonts/LICENSE.roboto.txt)
