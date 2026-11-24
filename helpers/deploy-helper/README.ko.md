# Nelyx 샘플 배포

[English](README.md) | **한국어**

저장소 루트에서 `npm run deploy`를 실행해 플랫폼과 Demo 또는 Testbed를 고릅니다. 헬퍼는 기존 SDK 공급, 앱별 npm 설치와 빌드 경로를 사용합니다. Windows PowerShell에서는 `npm.cmd`를 사용합니다. [저장소 준비 절차](../../README.ko.md#testbed와-demo-실행)

```powershell
npm.cmd run deploy
npm.cmd run deploy -- --list
npm.cmd run deploy -- --platform web --app Demo
npm.cmd run deploy -- --platform windows --app Testbed --no-launch
npm.cmd run deploy -- --platform android --target emulator --list
```

```sh
npm run deploy -- --platform ios --app Demo --target simulator
```

다른 작업 폴더에서는 `node <NelyxLab 경로>/helpers/deploy-helper/deploy.mjs`에 같은 옵션을 넘깁니다. `--platform`과 `--app`을 지정하면 해당 선택 메뉴를 건너뜁니다. 사용할 수 있는 모바일 기기가 하나면 자동으로 선택합니다. 여러 대가 연결됐으면 메뉴에서 선택하거나 `--list`에 나온 ID를 `--device`에 넘깁니다. `q` 또는 Ctrl+C로 취소할 수 있습니다. `--dry-run`은 명령과 산출물 경로를 출력하며, 모바일에서는 먼저 기기 목록을 조회합니다.

| 플랫폼 | 빌드와 실행 | `--no-launch` 사용 시 |
| --- | --- | --- |
| Web | `.nelyx/web/`에 게시한 뒤 `127.0.0.1`에서 제공하고 기본 브라우저를 엽니다. | 서버를 시작하고 직접 열 수 있는 URL을 출력합니다. |
| Windows | `.nelyx/tauri/windows-x64/`에 Tauri x64 EXE와 NSIS 설치 파일을 생성하고, 실행한 앱 창을 닫을 때까지 기다립니다. | 패키지 생성 후 종료합니다. |
| Android | `.nelyx/tauri/android-<아키텍처>/`에 디버그 APK와 릴리스 AAB를 생성하고, 선택한 기기에 APK를 설치해 실행합니다. | 패키지를 생성하고 APK를 설치합니다. |
| iOS | macOS에서 `.nelyx/tauri/ios-<아키텍처>/`에 시뮬레이터 앱 또는 기기용 서명 IPA를 생성합니다. 선택한 시뮬레이터를 필요한 경우 부팅한 뒤 앱을 설치하고 실행합니다. | 앱을 빌드하고 설치합니다. |

- **Web.** 기본으로 빈 포트를 배정합니다. `--port 4173`으로 포트를 고정하고 `--base /demo/`로 하위 경로에서 열 수 있습니다. Ctrl+C로 서버를 종료합니다.
- **Windows.** Visual Studio C++ x64 빌드 도구, Windows SDK, Rust MSVC 타깃과 WebView2를 준비합니다. [Tauri 준비](../../Nelyx/sdk/tooling/cli/README.ko.md#tauri-빌드와-실행)
- **Android.** 패키징에 `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`을 설정합니다. 목록 조회에는 `ANDROID_HOME` 또는 `ANDROID_SDK_ROOT`를 사용하고, 둘 다 비어 있으면 `PATH`에서 `adb`를 찾습니다. 기기 ABI를 읽어 `arm64` 또는 `x64`를 고릅니다. `--target device`나 `--target emulator`로 목록을 좁힐 수 있습니다. [Android 준비](../../sample/nelyx-demo-app/README.ko.md#android에서-실행)
- **iOS.** Xcode와 해당 Rust 타깃을 준비합니다. 시뮬레이터에는 iOS 런타임이 필요하고 실기기는 개발 서명이 필요합니다. `--target simulator`나 `--target device`로 목록을 좁힐 수 있습니다. 실기기에는 `arm64`를 사용하고 시뮬레이터는 Mac CPU에 따라 `arm64-sim` 또는 `x64-sim`을 선택합니다. [Tauri 준비](../../Nelyx/sdk/tooling/cli/README.ko.md#tauri-빌드와-실행)
