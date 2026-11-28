# Nelyx

[English](README.md) | **한국어**

Nelyx는 Flutter의 위젯과 렌더링 모델을 TypeScript로 구현한 SDK입니다. React DOM이 공용 위젯 트리의 화면을 관리하고 CanvasKit/Ganesh가 그립니다. `src/index.ts`는 화면 진입점이고 `backend/src/lib.rs`는 공용 Rust 명령을 등록합니다. 웹은 Wasm으로 Rust를 호출하고 Tauri는 생성한 네이티브 호스트에 같은 Rust 라이브러리를 링크합니다.

## Testbed와 Demo 실행

Node.js 24.3 이상 24.x와 npm 11을 사용합니다. `npm install`가 고정된 CanvasKit 런타임을 설치합니다. SDK를 빌드하려면 Rust Wasm 타깃과 wasm-bindgen-cli 0.2.128을 설치합니다. [CanvasKit 런타임](Nelyx/skia/README.ko.md)

저장소 루트에서 PowerShell로 실행합니다. 루트 빌드 명령은 SDK를 공급한 뒤 현재 공급과 일치하는 앱 의존성을 재사용합니다. 설치나 갱신이 필요하면 앱 디렉터리에서 `npm install`을 실행합니다. 경로를 바꿔 Testbed에도 적용할 수 있습니다.

```powershell
npm.cmd install
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.128 --locked
npm.cmd run build:web -- --app sample/nelyx-demo-app
npm.cmd run build:tauri -- --app sample/nelyx-demo-app --platform windows
```

앱 디렉터리에서 필요한 개발 또는 실행 명령을 사용합니다.

```powershell
Set-Location sample/nelyx-demo-app
npm.cmd run dev:web
npm.cmd run dev:tauri -- --platform windows
npm.cmd run run:web -- --base /demo/
npm.cmd run run:tauri -- --platform windows
```

앱 TypeScript 위젯의 호환되는 `build()` 수정은 웹과 Tauri에서 현재 화면에 적용됩니다. CLI에서 문서나 호스트의 재시작 사유와 빌드 단계별 산출물 재사용 여부를 확인할 수 있습니다. [Nelyx CLI 개발 안내](Nelyx/sdk/tooling/cli/README.ko.md#앱-개발)

### 샘플 배포 헬퍼

`npm.cmd run deploy`에서 Demo, Testbed 또는 Testbed3를 골라 Web, Windows, Android, iOS에 배포할 수 있습니다. macOS와 Linux에서는 `npm run deploy`를 사용합니다. [배포 옵션과 준비 절차](helpers/deploy-helper/README.ko.md)

### Android에서 Demo 실행

Android 도구를 준비한 뒤 x86_64 에뮬레이터에는 `--architecture x64`, ARM64 휴대폰에는 `arm64`를 사용합니다. `run:tauri`에 ADB 시리얼을 전달합니다. [Demo Android 준비 및 연결](sample/nelyx-demo-app/README.ko.md#android에서-실행)

## 문서

| 경로 | 내용 |
| --- | --- |
| [Core](Nelyx/README.ko.md) | 위젯과 프레임워크 |
| [SDK](Nelyx/sdk/README.ko.md) | 공용 DOM 화면, 호스트 서비스와 자산 |
| [Rust 백엔드](Nelyx/backend/) | 공통 API, Wasm 어댑터와 Tauri 플러그인 |
| [Skia](Nelyx/skia/README.ko.md) | CanvasKit 공급과 렌더링 |
| [CLI](Nelyx/sdk/tooling/cli/README.ko.md) | 앱 생성, SDK 공급과 타깃별 명령 |
| [Demo](sample/nelyx-demo-app/README.ko.md), [Testbed 2](sample/nelyx-testbed-app-2/README.ko.md), [Testbed 3](sample/nelyx-testbed-app-3/README.ko.md) | 샘플 앱 |
| [Web·Tauri 빌드 개편](history/26/11/23/work-summary.md) | 빌드 개편과 플랫폼 결과 |
| [작업 이력](history/README.md) | 이전 작업 |

Nelyx 코드는 BSD 3-Clause를 사용합니다. 이식한 코드에는 각 원본의 라이선스가 적용됩니다. [라이선스](Nelyx/LICENSE.md) · [Skia 고지](Nelyx/skia/THIRD_PARTY_NOTICES.md)
