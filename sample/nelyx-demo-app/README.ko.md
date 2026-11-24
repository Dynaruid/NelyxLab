# Nelyx Demo

[English](README.md) | **한국어**

아래 탭을 이용해 Material과 Cupertino 갤러리를 전환합니다. 선택과 편집, 슬라이더, 메뉴, 액션 시트와 다이얼로그를 확인할 수 있습니다.

## 준비와 개발

Node.js 24.x와 고정된 CanvasKit·Rust Wasm 도구를 준비합니다. 저장소 루트에서 SDK를 공급한 뒤 앱 디렉터리로 이동합니다. [SDK 준비](../../README.ko.md#testbed와-demo-실행)

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run prepare:sample -- --app sample/nelyx-demo-app
Set-Location sample/nelyx-demo-app
npm.cmd ci --workspaces=false
npm.cmd run prepare:web
npm.cmd run typecheck
npm.cmd run dev:web
```

## 웹과 Tauri

저장소 루트에서는 `npm.cmd run deploy -- --app Demo`로 이 샘플을 빌드하고 실행합니다. [배포 헬퍼](../../helpers/deploy-helper/README.ko.md)

앱 루트에서 배포할 타깃의 명령을 실행합니다.

```powershell
npm.cmd run build:web
npm.cmd run run:web -- --base /demo/
```

웹은 `.nelyx/web/`에 게시합니다. `targets.web.pwa` 설정에 따라 설치와 오프라인 실행을 지원합니다.

```powershell
npm.cmd run prepare:tauri -- --platform windows
npm.cmd run build:tauri -- --platform windows
npm.cmd run run:tauri -- --platform windows
```

`dev:tauri`는 Vite에 연결된 WebView를 엽니다. `build:tauri`는 Tauri용 프런트엔드와 네이티브 호스트를 생성합니다. 다른 OS에서 해당 도구를 준비해 플랫폼을 지정합니다. 앱 소스와 설정은 `src/`, `backend/`, 자산과 `platform/`에 둡니다. [CLI 명령](../../Nelyx/sdk/tooling/cli/README.ko.md#tauri-빌드와-실행)

## Android에서 실행

SDK 공급과 npm 설치를 마친 뒤 앱 디렉터리에서 실행합니다. JDK 21, SDK 플러그인용 Android Platform 36, Android SDK Platform과 Build-Tools 37.0, Platform-Tools, NDK 30.0.14904198을 설치합니다.

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk-21'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk\30.0.14904198'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
adb devices -l
rustup target add x86_64-linux-android
npm.cmd run prepare:tauri -- --platform android --architecture x64
npm.cmd run build:tauri -- --platform android --architecture x64
npm.cmd run run:tauri -- --platform android --device emulator-5554
```

ARM64 휴대폰은 `rustup target add aarch64-linux-android`를 실행한 뒤 `x64`를 `arm64`로 바꿉니다. `adb devices -l`에 표시된 휴대폰 시리얼을 전달합니다. USB 디버깅 요청은 휴대폰에서 승인합니다. Wi-Fi 연결은 Android Studio에서 페어링할 수 있습니다. [Android 무선 디버깅](https://developer.android.com/studio/run/device?hl=ko#wireless)

`run:tauri`는 게시된 디버그 APK를 설치하고 시작합니다. CPU별 산출물 디렉터리에 APK, AAB와 서명 상태가 기록됩니다.
