# Nelyx Testbed

[English](README.md) | **한국어**

Core, Material, Cupertino의 목록·편집·접근성 동작을 확인하는 갤러리입니다.

## 준비와 개발

Node.js 24.x와 고정된 CanvasKit·Rust Wasm 도구를 준비합니다. 저장소 루트에서 SDK를 공급한 뒤 앱 디렉터리로 이동합니다. [SDK 준비](../../README.ko.md#testbed와-demo-실행)

```powershell
npm.cmd install
npm.cmd run build:sdk
npm.cmd run prepare:sample -- --app sample/nelyx-testbed-app-2
Set-Location sample/nelyx-testbed-app-2
npm.cmd install --workspaces=false
npm.cmd run prepare:web
npm.cmd run typecheck
npm.cmd run dev:web
```

## 웹과 Tauri

저장소 루트에서는 `npm.cmd run deploy -- --app Testbed`로 이 샘플을 빌드하고 실행합니다. [배포 헬퍼](../../helpers/deploy-helper/README.ko.md)

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
