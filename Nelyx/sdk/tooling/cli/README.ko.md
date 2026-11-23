# Nelyx CLI

[English](README.md) | **한국어**

## 앱 생성과 공급

고정 CanvasKit 런타임을 준비한 다음 Nelyx 저장소에서 실행합니다.

```
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run pack:sdk -- C:/dev/nelyx-packages
node Nelyx/sdk/tooling/cli/src/main.mjs create C:/dev/MyApp --name MyApp --packages C:/dev/nelyx-packages
Set-Location C:/dev/MyApp/web/runner
npm.cmd ci --workspaces=false
npx.cmd --no-install nelyx prepare --app ../..
npm.cmd run typecheck
npx.cmd --no-install nelyx dev --app ../..
```

스타터는 두 디자인 패키지를 사용합니다. --designs none, --designs material, --designs cupertino로 선택할 수 있습니다. 기존 러너에는 nelyx supply --app ../.. --packages C:/dev/nelyx-packages를 실행한 뒤 npm.cmd ci --workspaces=false로 설치합니다. Linux와 macOS에서는 npm과 npx를 사용합니다.

## PWA 배포

```
npx.cmd --no-install nelyx build --app ../..
npx.cmd --no-install nelyx run --app ../.. --base /demo/
```

빌드 결과는 .nelyx/pwa에 나옵니다. 전체 경로를 HTTPS에 배포하고 브라우저에서 설치합니다. 서비스 워커 캐시가 준비되면 오프라인으로 다시 엽니다. 같은 파일을 루트와 하위 경로에서 사용할 수 있습니다. 경로 기반 탐색을 제공할 때는 앱 경로에만 배포 루트가 포함된 HTML을 제공하고 누락된 자산은 404를 반환합니다. sw.js·HTML과 고정 파일명은 재검증하도록 설정합니다.

## Tauri 호스트 추가

앱 루트에서 npm.cmd install --save-dev --save-exact @tauri-apps/cli@2.12.6을 실행합니다. web/runner에서 이어서 실행합니다.

```
npx.cmd --no-install nelyx prepare --app ../.. --platform windows
npx.cmd --no-install nelyx doctor --app ../.. --platform windows
npx.cmd --no-install nelyx pack --app ../.. --platform windows --package ../../.nelyx/pwa
npx.cmd --no-install nelyx run --app ../.. --platform windows
```

`dev --platform windows`로 Vite에 연결된 WebView 창을 실행합니다. 데스크톱 패키징에는 해당 OS가 필요하며 iOS는 macOS와 Xcode를 사용합니다.

Android 패키징에는 JDK·SDK·NDK·adb·Rust 타깃이 필요합니다. x86_64 에뮬레이터는 `--architecture x64`, arm64 기기는 `--architecture arm64`로 패키징합니다. `dev`와 `run`은 `--device`의 adb 시리얼로 기기 ABI를 읽습니다. Tauri 개발 명령에서도 해당 기기를 지정할 수 있도록 연결된 기기마다 고유한 이름을 사용합니다. APK는 로컬 디버그 서명 설정, AAB는 앱의 릴리스 서명 설정을 사용합니다.

iOS 시뮬레이터는 `--architecture arm64-sim` 또는 `x64-sim`을 사용합니다. iOS 실기기에서 개발할 때 `--architecture arm64`, `--device`의 기기 이름, `--host`에 해당하는 기기가 신뢰하는 HTTPS 서버가 필요합니다. `run`의 `--device`에는 기기 식별자를 지정합니다. IPA는 `--export-method debugging`, `release-testing`, `app-store-connect` 중 하나를 선택할 수 있습니다.

prepare는 기존 src-tauri 프로젝트를 보존합니다. 앱의 Tauri 공통·OS별 설정에서 식별자, 권한, 아이콘, 서명을 관리합니다. Nelyx CLI로 패키징 또는 개발할 때는 Tauri 설정의 beforeBuildCommand, beforeBundleCommand, beforeDevCommand를 비워 둡니다. 결과는 .nelyx/tauri/<os>-<architecture>에 게시됩니다.

## 기존 v2 앱 전환

공용 앱 소스는 유지하면서 스타터의 index.html, vite.config.ts와 Vite 진입점 연결을 적용합니다. 편집한 resolver·transformer 설정은 Vite 플러그인으로 옮기고 React import와 DOM 요소를 사용합니다. 새 archive 공급 뒤 러너를 다시 설치합니다. targets.web.component는 메모리에서 읽으며 이전 cohort 선언은 제거합니다. 기존 OS별 설정은 Tauri 설정으로 옮깁니다. doctor에서 해당 경로와 전환 안내를 확인할 수 있습니다.

[Tauri 도구 설치](https://v2.tauri.app/start/prerequisites/) · [환경별 검증](../../../../history/26/11/20/work3-summary.md)
