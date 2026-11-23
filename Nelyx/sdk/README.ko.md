# Nelyx SDK

[English](README.md) | **한국어**

`src/index.ts`가 React 컴포넌트와 함께 `startFrontend`를 호출합니다. 컴포넌트는 위젯 정의와 전달받은 옵션을 `@nelyx/sdk/frontend/dom/surface`의 `ApplicationSurface`에 넘깁니다. 백엔드 식별값을 확인한 뒤 화면을 마운트합니다. 공용 DOM 구현이 캔버스 리소스, 포인터·키보드, IME, 선택과 접근성을 처리합니다.

`getFrontendHost()`는 타깃, OS와 백엔드 식별값을 돌려줍니다. `@nelyx/sdk/frontend/dom/environment`의 `invokeAppBackend('app.example', 10)`으로 앱 Rust 라이브러리에서 등록한 명령을 호출할 수 있습니다. 웹은 Wasm과 브라우저의 Clipboard·Permissions API를 사용합니다. Tauri는 IPC, 선언된 클립보드 명령과 Android 화면 여백 플러그인을 사용합니다. CanvasKit 렌더링과 프레임 스케줄링은 DOM에서 처리합니다.

앱의 package.json에 `nelyx.app/v4`, `appEntry`, 선택적인 `backend.manifest`와 `targets.web` 또는 `targets.tauri`를 선언합니다. 폰트와 이미지에는 앱 상대 경로를 사용합니다. CLI가 자산을 검증하고 선언된 고지를 포함합니다. [CLI 가이드](tooling/cli/README.ko.md) · [Core](../README.ko.md) · [렌더러](../skia/README.ko.md)
