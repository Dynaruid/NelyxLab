# Nelyx CLI

[English](README.md) | **한국어**

## 앱 생성과 공급

고정된 CanvasKit과 Rust Wasm 도구를 준비한 뒤 Nelyx 저장소에서 실행합니다.

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run pack:sdk -- C:/dev/nelyx-packages
node Nelyx/sdk/tooling/cli/src/main.mjs create C:/dev/MyApp --name MyApp --packages C:/dev/nelyx-packages
Set-Location C:/dev/MyApp
npm.cmd ci --workspaces=false
npx.cmd --no-install nelyx prepare --app . --target web
npm.cmd run typecheck
npx.cmd --no-install nelyx dev --app . --target web
```

`create`는 기본적으로 두 디자인 패키지와 두 타깃을 설정합니다. `--designs none`, `--designs material`, `--designs cupertino`로 필요한 디자인을 고릅니다. `--target web --static --no-backend`는 SDK 기본 Wasm을 쓰는 일반 정적 웹을 구성합니다. `--target tauri`는 설치 앱을 구성합니다. Linux와 macOS에서는 `npm`과 `npx`를 사용합니다.

SDK를 갱신할 때는 앱 루트에서 `nelyx supply --app . --packages C:/dev/nelyx-packages`와 `npm.cmd ci --workspaces=false`를 순서대로 실행합니다. 앱의 npm 잠금 파일과 `prepare`가 만드는 `backend/locks/<target>/Cargo.lock`을 버전 관리합니다. Cargo 의존성을 변경하면 영향을 받는 타깃마다 `prepare --update-lock`을 실행합니다. 빌드는 타깃의 잠금 파일을 복원해 Cargo에 `--locked`를 전달합니다.

## 웹 배포

```powershell
npx.cmd --no-install nelyx build --app . --target web
npx.cmd --no-install nelyx run --app . --target web --base /demo/
```

`run`에 `--port 0`을 넘기면 미리보기 서버가 빈 포트를 배정받습니다.

`.nelyx/web/` 전체를 배포합니다. 서버의 Wasm MIME은 `application/wasm`을 사용합니다. 앱 경로의 HTML fallback에는 배포 디렉터리를 base로 지정하고, 빠진 자산은 404로 응답합니다. `targets.web.pwa`가 있으면 설치 manifest와 서비스 워커가 포함됩니다. 서비스 워커는 앱 백엔드 Wasm까지 검증한 뒤 캐시에 저장합니다. `sw.js`와 이름이 고정된 자산은 캐시 재검증을 사용합니다.

## Tauri 빌드와 실행

```powershell
npx.cmd --no-install nelyx prepare --app . --target tauri --platform windows
npx.cmd --no-install nelyx doctor --app . --target tauri --platform windows
npx.cmd --no-install nelyx build --app . --target tauri --platform windows
npx.cmd --no-install nelyx run --app . --target tauri --platform windows
```

`dev --target tauri --platform windows`는 Vite에 연결한 WebView를 엽니다. CI에서는 `build --target tauri --frontend-only`로 `.nelyx/tauri/frontend/`를 게시한 뒤, 같은 앱 소스와 SDK 공급본으로 `pack --target tauri --platform <os> --frontend <directory>`를 실행합니다. CLI가 `.nelyx/tauri/host/`를 생성하고 Cargo.lock을 복원해 앱에 설치한 Tauri CLI를 실행합니다. 패키지는 `.nelyx/tauri/<os>-<architecture>/`에 게시하며 내장한 프런트엔드 빌드 ID와 Rust 타깃을 기록합니다.

앱 식별자, 창 크기와 권한은 `targets.tauri`에 선언합니다. 창 별로 `clipboard: { read: true, write: true }`, `safeArea: true`와 `windowTitle`을 설정할 수 있습니다. 앱 아이콘은 `platform/icons/`에 둡니다. Android와 Apple의 사용자 파일은 생성 프로젝트 기준 상대 경로로 각각 `platform/android/project/`와 `platform/ios/project/`에 둡니다. 선택적인 `platform/<os>/tauri.conf.json`은 번들 설정과 CSP를 받습니다. 서명 키는 플랫폼 도구나 빌드 환경에서 제공합니다.

Android와 iOS에서 `run --no-launch`는 게시한 앱을 설치한 뒤 종료합니다.

Android x86_64 에뮬레이터는 `--architecture x64`, ARM64 기기는 `arm64`를 사용합니다. `dev`와 `run`의 `--device`에는 ADB 시리얼을 입력합니다. Android dev의 기기 이름은 연결 목록에서 고유해야 합니다. iOS 시뮬레이터는 `arm64-sim` 또는 `x64-sim`을 사용합니다. iOS 실기기 dev는 기기 이름과 신뢰된 HTTPS로 접근할 수 있는 `--host`가 필요합니다. 실기기 run은 기기 식별자를 받습니다. [Tauri 플랫폼 준비](https://v2.tauri.app/start/prerequisites/)
