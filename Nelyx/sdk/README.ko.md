# Nelyx SDK

[English](README.md) | **한국어**

`src/index.ts`가 React 컴포넌트와 함께 `startFrontend`를 호출합니다. 컴포넌트는 위젯 정의와 전달받은 옵션을 `@nelyx/sdk/frontend/dom/surface`의 `ApplicationSurface`에 넘깁니다. 백엔드 식별값을 확인한 뒤 화면을 마운트합니다. 공용 DOM 구현이 캔버스 리소스, 포인터·키보드, IME, 선택과 접근성을 처리합니다.

`getFrontendHost()`는 타깃, OS, 백엔드 식별값과 창 기능을 돌려줍니다. `@nelyx/sdk/frontend/dom/environment`의 `invokeAppBackend('app.example', 10)`으로 앱 Rust 라이브러리에서 등록한 명령을 호출할 수 있습니다. CanvasKit 렌더링과 프레임 스케줄링은 DOM에서 처리합니다.

위젯에서는 `Clipboard`와 `HapticFeedback`을 사용합니다. 웹과 PWA에서 앱 백엔드 Wasm은 클립보드·권한 변경·진동을 캔버스가 속한 창에 연결합니다. 데스크톱 브라우저의 편집 메뉴는 읽기 권한을 확인한 경우에만 텍스트를 미리 읽습니다. Tauri의 Android·iOS 창은 햅틱 플러그인을 선택적으로 사용하고, Android 창은 시스템 뒤로 가기를 현재 내비게이터에 연결할 수 있습니다. 창 설정과 대체 동작은 CLI 가이드를 참고하세요.

위젯에서는 `@nelyx/sdk/devices`의 `deviceServicesFor(context.services)`로 뷰의 서비스에 접근합니다. 앱의 `startup`에서는 받은 컨텍스트를 그대로 넘깁니다. 서비스는 `devices?.location`처럼 확인합니다. 사용자 동작에서 `current()`로 위치를 읽거나 `watch()`로 구독하고 위젯에서 관찰이 끝나면 구독의 `dispose()`를 호출합니다.

선택한 파일 핸들은 이름과 바이트 읽기 메서드를 제공합니다. 카메라 스트림과 Bluetooth 연결에는 `dispose()`가 있습니다. 뷰를 닫으면 해당 구독과 디바이스 핸들을 해제합니다. WebAuthn은 챌린지를 발급한 서버에서 검증할 자격증명 서명을 반환합니다. 네이티브 NFC의 활성 태그 세션은 OS 리더가 제어합니다.

디바이스 바인딩은 백엔드 프로토콜 3을 사용합니다. SDK 공급본과 앱의 플랫폼별 잠금 파일을 함께 갱신합니다. SDK를 개발할 때 `npm run generate:backend-bindings`로 wasm-bindgen 선언과 Specta 바인딩을 갱신합니다. Wasm 공급 빌드와 `npm run check:backend-bindings`는 각각 생성 결과가 소스와 일치하는지 검사합니다.

앱의 package.json에 `nelyx.app/v4`, `appEntry`, 선택적인 `backend.manifest`와 `targets.web` 또는 `targets.tauri`를 선언합니다. 폰트와 이미지에는 앱 상대 경로를 사용합니다. CLI가 자산을 검증하고 선언된 고지를 포함합니다. [CLI 가이드](tooling/cli/README.ko.md) · [Core](../README.ko.md) · [렌더러](../skia/README.ko.md)
