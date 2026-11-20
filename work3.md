# Nelyx의 Vite 기반 PWA 단일 빌드와 Tauri 플랫폼 전환 계획

**2026-11-20 · `tauri-backend` · 기준 커밋 `6ad9540c` · PLANNED**

이 분기는 **Vite를 유일한 프런트엔드 빌드 도구와 개발 서버**로 사용한다. 앱 코드를 바꾸면 Vite가 설치·오프라인 실행이 가능한 PWA를 한 번 만든다. 브라우저에는 그 디렉터리를 배포하고, Windows·Android·Linux·macOS·iOS에서는 Tauri가 같은 디렉터리를 내장한다. 창·설치 형식·OS 권한만 바뀌면 해당 Tauri 패키지만 다시 만든다.

첫 이정표는 **Demo의 PWA를 한 번 빌드해 브라우저에 설치하고, 같은 빌드 ID를 가진 Windows 앱을 네트워크 없이 처음 실행하는 것**이다. 그다음 Android 시스템 WebView와 Linux WebKitGTK에서 같은 입력을 사용해 두 엔진 계열을 확인하고 Apple 대상으로 확장한다. 기존 Windows 실험의 실행 결과는 출발점으로 사용한다. [Windows 실험](work.md) · [SDK 통합 결과](work2.md)

## 1. 현재 코드에서 바꿔야 할 지점

| 영역 | 현재 동작 | 개편 작업 |
| --- | --- | --- |
| 진입점 | CLI가 네이티브 러너를 정적으로 import하고 일반 명령의 타깃 기본값은 Windows다. `--host tauri`는 Windows의 다섯 동작에만 연결된다. 샘플의 기본 `run:windows`도 별도 네이티브 런처로 간다. | 기본 명령을 PWA에 연결하고 OS를 지정한 패키징·실행은 Tauri로만 보낸다. [CLI 분기](Nelyx/sdk/tooling/cli/src/main.mjs) · [Demo 명령](sample/nelyx-demo-app/package.json) · [Testbed 명령](sample/nelyx-testbed-app-2/package.json) |
| 웹 호스트 | 웹 런타임이 React Native Web에서 사용하는 API는 앱 등록용 `AppRegistry`, 표면 컨테이너 `View`, 입력 요소 `TextInput`이다. CanvasKit 호출, 텍스트 편집과 접근성 트리는 이미 Nelyx가 관리한다. | 이 세 API를 React DOM과 HTML 요소로 교체하고 Web 러너·SDK·도구에서 `react-native-web` 의존성을 제거한다. [앱 등록](Nelyx/sdk/src/platforms/web/application.ts) · [표면](Nelyx/sdk/src/platforms/web/surface.tsx) · [DOM 입력과 접근성](Nelyx/sdk/src/backends/browser/interaction.ts) |
| 웹 빌드 | Metro `runBuild()`가 고정 이름의 `application.js`와 소스맵을 만들고 Nelyx가 HTML·CanvasKit JS/Wasm·앱 자산·고지를 쓴다. HTML에 설치 manifest나 서비스 워커 등록이 없다. 샘플 기본 출력은 `.nelyx/web`, SDK CLI 출력은 매번 새 Web 패키지 디렉터리다. | 샘플·CLI·외부 앱을 Vite HTML 진입점과 같은 PWA 빌더로 연결한다. 패키지 검증기는 해시가 붙은 실제 JS·CSS 청크를 읽는다. [Metro 빌더](Nelyx/sdk/tooling/metro/src/web-build.mjs) · [샘플 빌더](sample/nelyx-demo-app/web/runner/build.mjs) · [SDK Web 러너](Nelyx/sdk/tooling/cli/src/web-runner.mjs) |
| 개발 서버 | CLI가 `metro.config.cjs`를 읽고 Metro HMR과 SSE를 연다. 러너는 `@nelyx/metro/web-refresh`에 종료 함수를 등록한다. Tauri는 CLI의 준비 이벤트와 HTTP 상태 응답을 둘 다 대조한다. | Vite의 개발 서버를 사용한다. Nelyx가 제어하는 전체 새로고침과 Tauri의 앱·포트 확인 절차를 이식한다. [현재 서버](Nelyx/sdk/tooling/metro/src/web-development.mjs) · [새로고침 처리](Nelyx/sdk/tooling/metro/src/web-refresh.cjs) |
| Tauri 패키징 | Windows 러너가 임시 디렉터리에 `buildWebInto()`를 호출하고 해시를 확인한 뒤 `tauri build --no-bundle`로 x64 EXE를 게시한다. 앱별 잠금·실패 복구·개발 세션 종료 처리가 이미 있다. | 검증과 프로세스 관리를 재사용한다. 패키징 입력을 앞에서 만든 PWA로 바꾸고 설치 번들까지 확장한다. [Tauri 러너](Nelyx/sdk/tooling/cli/src/windows-tauri-runner.mjs) · [기존 패키지 검증](Nelyx/sdk/tooling/cli/src/runner-package.mjs) |
| SDK 공급 | 루트 `build:sdk`는 native/RN Skia를 빌드한다. 샘플 준비는 기본적으로 native/RN/AOT까지 패킹하고, CLI와 Metro는 `@nelyx/static-aot`를 직접 의존한다. Web 전용 앱을 생성해도 생성기가 Android 템플릿을 먼저 읽는다. | 빌드·생성·공급·설치에서 네이티브 의존성을 함께 끊는다. [루트 workspace](package.json) · [샘플 준비](Nelyx/eng/prepare-sample.mjs) · [앱 생성](Nelyx/sdk/tooling/cli/src/create-app.mjs) · [tarball 공급](Nelyx/sdk/tooling/cli/src/supply-runner.mjs) |
| 플랫폼 주소 | CanvasKit 로더와 자산 서비스가 모두 루트 URL을 HTTP(S)로 제한한다. Rust는 릴리스 페이지를 `https://tauri.localhost/`와 대조한다. 따라서 Apple·Linux의 `tauri://localhost/`에 템플릿만 복사하면 자산 로딩부터 막힌다. | SDK의 자산·라우팅 검사와 Rust의 로컬 페이지 판정을 함께 수정한다. [CanvasKit 로더](Nelyx/sdk/src/backends/browser/canvaskit.ts) · [자산 서비스](Nelyx/sdk/src/backends/browser/services.ts) · [Rust 페이지 처리](Nelyx/sdk/tooling/cli/templates/windows-tauri/src/main.rs) · [Tauri WebView URL](https://v2.tauri.app/reference/javascript/api/namespacewebview/) |
| 앱 소유 파일 | 템플릿과 두 샘플에 `src-tauri/`가 있다. 템플릿은 데스크톱 `main.rs`와 ICO 하나로 구성되고, Demo는 이전 Windows RN 프로젝트 안의 ICO를 참조한다. | 공용 Rust 진입점과 플랫폼별 아이콘을 준비하고, Demo 아이콘을 먼저 앱 소유 경로로 옮긴다. [기존 템플릿](Nelyx/sdk/tooling/cli/templates/windows-tauri) · [Demo 설정](sample/nelyx-demo-app/src-tauri/tauri.conf.json) · [Testbed 설정](sample/nelyx-testbed-app-2/src-tauri/tauri.conf.json) |

## 2. 앱과 SDK의 구조

```text
<app>/
  package.json             앱 이름·버전, Nelyx 진입점, PWA 설정
  src/                     공유 위젯과 앱 로직
  assets/                  앱 자산, 고지, PWA 아이콘
  web/runner/              index.html, main.ts, App.tsx, vite.config.ts와 설치된 도구
  src-tauri/               플랫폼 패키징을 선택한 앱이 소유
    Cargo.toml, Cargo.lock, build.rs, tauri.conf.json
    src/lib.rs, src/main.rs, capabilities/, icons/
    gen/android/, gen/apple/     해당 모바일 플랫폼을 준비할 때 생성
  .nelyx/pwa/              웹 배포 디렉터리이자 모든 Tauri 릴리스의 입력
  .nelyx/tauri/<os>-<arch>/     해당 플랫폼 패키징 결과
```

- **UI와 렌더러** — Core의 Widget·Element·RenderObject, Material·Cupertino, SDK의 `ApplicationSurface`를 공통으로 사용한다. 웹 호스트에는 `react`와 `react-dom`을 사용하고 CanvasKit/Ganesh/WebGL2가 위젯을 그린다. 브라우저와 모든 Tauri WebView가 이 경로를 공유한다. SDK 내부 provider는 `web`과 `ganesh-webgl2`를 선택하고, SDK·CLI 결과에 배포 형식 `pwa`, 호스트 `browser` 또는 `tauri`, 실제 OS를 각각 기록한다. 위젯의 OS별 동작·테마 판별은 유지한다. [Web 표면](Nelyx/sdk/src/platforms/web/surface.tsx) · [Web provider 선택](Nelyx/sdk/src/platforms/web/application.ts) · [OS 판별](Nelyx/sdk/src/platforms/web/environment.ts)
- **SDK와 호스트** — SDK는 앱 부팅·브라우저 서비스·접근성·자산 해석을 소유한다. CLI 패키지는 공용 Tauri 초기 템플릿과 명령 연결을 공급한다. 앱의 `src-tauri/`가 식별자·아이콘·창·권한·플러그인·서명 설정을 소유한다. 일반 PWA는 Rust와 Tauri CLI 없이 생성·개발·빌드할 수 있어야 한다. OS 기능이 필요한 앱만 Tauri 명령을 선언하고, 브라우저에서는 해당 기능의 사용 가능 여부를 조회할 수 있게 한다. [기존 브라우저 서비스](Nelyx/sdk/src/backends/browser/platform-messages.ts) · [Tauri 권한 범위](https://v2.tauri.app/security/capabilities/)
- **설정 전환** — 새 스타터의 `package.json#nelyx`는 `nelyx.app/v3`로 작성한다. `name`, `displayName`, `appEntry`, `assets`를 유지하고 `pwa` 아래에 `component`, 설치 식별자 `id`, `shortName`, 아이콘, 테마색을 둔다. 새 앱에는 기본 아이콘을 공급한다. OS별 `component`와 렌더러 선언은 종료한다. 패키징 플랫폼은 CLI에서 고르고 Tauri의 공통 설정과 플랫폼별 설정 파일을 병합한다. [현재 설정 검증기](Nelyx/sdk/src/runtime/config.ts) · [Tauri 플랫폼별 설정](https://v2.tauri.app/develop/configuration-files/)
- **기존 앱** — v2의 `targets.web`이 있으면 그 `component`, 공용 진입점, 자산과 표시 이름을 메모리에서 새 형식으로 읽는다. 설치 메타데이터가 없으면 `/apps/<소문자 앱 이름>`, `displayName` 또는 `name`, SDK의 기본 아이콘을 빌드 출력에 사용한다. 함께 선언한 RN 타깃은 전환 안내에 열거한다. 네이티브 타깃만 있는 앱에는 추가할 Web 러너와 바꿀 플랫폼 import를 알려준다. `doctor`와 `prepare`가 소비자의 설정·편집된 Rust 파일을 덮어쓰지 않도록 한다. 두 샘플은 명시적으로 v3로 옮겨 예제로 제공한다.

예를 들어 Demo의 v3 설정에서 기존 `targets` 자리를 아래 필드가 맡는다. `id`는 설치 후 표시 이름이나 버전을 바꿔도 유지한다. 아이콘의 `src`는 앱 루트 기준 경로이며 빌더가 출력 manifest의 URL로 변환한다.

```json
{
  "pwa": {
    "component": "./web/runner/App.tsx",
    "id": "/apps/nelyx-demo",
    "shortName": "Nelyx Demo",
    "themeColor": "#101827",
    "icons": [
      { "src": "./assets/pwa/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "./assets/pwa/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
}
```

### React Native Web을 대체하는 세 지점

| 현재 사용처 | 교체 방법과 보존할 동작 |
| --- | --- |
| `AppRegistry` | SDK의 `registerApplication(name, component, rootTag)` 안에서 `react-dom/client`의 `createRoot(rootTag)`로 마운트하고 `root.render(createElement(component))`를 호출한다. 기존 반환값 `close()`·`dispose()`와 중복 등록 검사를 유지한다. 종료는 `root.unmount()` 후 SDK가 진행 중인 표면·CanvasKit 해제까지 기다린다. [루트 소유권](Nelyx/sdk/src/platforms/web/application.ts) · [React DOM 루트 API](https://react.dev/reference/react-dom/client/createRoot) |
| `View` | `ApplicationSurface`의 바깥 요소를 `div`로 바꾼다. RN Web이 적용하던 세로 flex, 상대 위치, 박스 크기와 앱이 넘긴 `style`의 우선순위를 CSS로 명시한다. 기본 480×640과 샘플의 부모 채우기, 리사이즈 후 캔버스 크기·포인터 좌표가 일치하는지 확인한다. [현재 표면 스타일](Nelyx/sdk/src/platforms/web/surface.tsx) · [샘플 크기 지정](sample/nelyx-demo-app/web/runner/App.tsx) |
| `TextInput` | 표준 `input`을 비제어 요소로 마운트해 기존 `HTMLInputElement` ref를 넘긴다. 브라우저 입력 서비스가 포커스·선택·IME 조합과 여러 줄 입력용 `textarea`를 계속 소유한다. 숨은 입력 요소·버튼의 부모 관계, 캔버스의 `aria-hidden`, 의미 트리와 종료 시 요소 복원을 유지한다. 팝업 경로는 이미 같은 서비스에 DOM 요소를 직접 전달한다. [DOM 편집·의미 트리](Nelyx/sdk/src/backends/browser/interaction.ts) · [팝업 구현](Nelyx/sdk/src/platforms/web/dialog-windows.ts) |

두 샘플과 스타터는 React 훅·`StrictMode`를 `react`에서 직접 import한다. 기존 소비자가 쓰는 `webBackend().react`는 전환기에 같은 React 인스턴스를 제공한다. `webBackend().native`, `react-native`, `react-native-web`을 직접 사용하는 소비자에게는 해당 import와 교체 방법을 안내한다.

### Vite가 맡을 빌드와 개발 서버

새 도구 패키지는 `Nelyx/sdk/tooling/vite/`의 `@nelyx/vite`다. 앱의 `vite.config.ts`는 이 패키지의 공용 설정을 사용하고 CLI는 러너 설치본의 Vite JS API를 호출한다. 기본 빌드 도구를 `vite@8.3.8`로 고정하고, 러너가 읽는 TypeScript 설정에 `jsx: "react-jsx"`를 둔다. Vite가 JSX·TSX를 직접 변환하므로 PWA 빌드와 Tauri 패키징에 React 플러그인 설치 단계는 필요 없다. [Vite의 JSX 지원](https://vite.dev/guide/features#jsx) · [Vite JS API](https://vite.dev/guide/api-javascript)

Demo와 Testbed의 React 컴포넌트는 `main()`이 만든 앱을 `ApplicationSurface`에 연결한다. 앱 화면의 위젯 트리와 상태는 Nelyx가 관리한다. React 화면을 직접 작성해 편집 중 호환되는 컴포넌트의 훅 상태를 유지하고 싶은 앱만 러너의 개발 의존성에 `@vitejs/plugin-react`를 추가하고 자체 `vite.config.ts`에 `react()`를 등록한다. 기본 SDK·스타터·두 샘플은 이 옵션 없이 공급한다. [Demo Web 진입점](sample/nelyx-demo-app/web/runner/App.tsx) · [Demo 위젯 루트](sample/nelyx-demo-app/src/app.ts) · [React Fast Refresh 플러그인](https://vite.dev/plugins/#vitejs-plugin-react)

| 경계 | 이식할 동작과 확인 방법 |
| --- | --- |
| 모듈 해석과 타입 | Vite의 `root`를 앱의 `web/runner`로 잡고 HTML의 모듈 스크립트가 `./main.ts`를 연다. `../../src`에서 import해도 React·React DOM과 Nelyx 공개 exports는 같은 러너의 설치본에서 해석한다. `resolve.dedupe`와 실제 경로 검사를 적용한다. 기존 Metro의 RN→RN Web 별칭을 폐기하고, 개발·릴리스 그래프에 두 패키지의 import나 native/Node 모듈이 들어오면 해당 import 경로를 진단한다. 기존 변환기가 처리하던 순환 import의 초기화 순서를 Core·Material·Cupertino의 실제 첫 화면에서 확인한다. 타입 검사는 러너의 기존 TypeScript 컴파일러로 별도 수행한다. [현재 해석기](Nelyx/sdk/tooling/metro/src/web-config.cjs) · [변환기](Nelyx/sdk/tooling/metro/src/web-transformer.cjs) · [Vite 모듈 해석](https://vite.dev/config/shared-options#resolve-dedupe) |
| 자산과 CanvasKit | Metro 안의 `assets.cjs`와 `installed-supply.cjs`에서 앱 자산·고지·설치본을 확인하는 함수를 기존 `@nelyx/tooling-contracts`의 Node 전용 진입점으로 옮긴다. CLI와 새 Vite 플러그인이 같은 검사를 호출한다. `web-runtime.mjs`의 고정 JS/Wasm·manifest 검사도 이식한다. 개발에서는 검증된 파일을 `/runtime/`·`/assets/`로 제공하고 릴리스에는 같은 경로와 바이트로 복사한다. `publicDir: false`로 두고 앱이 선언한 파일과 고지만 게시한다. [자산 검증](Nelyx/sdk/tooling/metro/src/assets.cjs) · [설치본 검증](Nelyx/sdk/tooling/metro/src/installed-supply.cjs) · [런타임 판독](Nelyx/sdk/tooling/metro/src/web-runtime.mjs) |
| 개발과 새로고침 | `nelyx dev`는 Vite `createServer()`를 한 번 호출하고 `server.strictPort: true`로 요청 포트에 바인딩한다. 준비된 뒤 `nelyx.dev.ready`와 `/__nelyx/status`에 세션·앱·러너·실제 URL을 담는다. CSS 수정은 Vite HMR로 반영한다. 기본 러너에서 Nelyx 위젯·앱 진입점·SDK가 바뀌거나 `POST /reload`를 받으면 Nelyx의 Vite 플러그인이 기본 전체 reload 전송을 대신해 전용 WebSocket 이벤트를 보낸다. 러너는 `await closeAllWebApplications()` 성공 후 페이지를 한 번 새로 열어 새 위젯 상태로 시작한다. 정리에 실패하면 현재 문서에 오류를 표시한다. 앱이 선택적으로 React Fast Refresh를 켠 경우에는 해당 플러그인이 처리할 React 컴포넌트 변경을 그대로 전달한다. [현재 종료 처리](Nelyx/sdk/tooling/metro/src/web-refresh.cjs) · [Vite HMR](https://vite.dev/guide/api-hmr) · [고정 버전의 이벤트 처리](https://github.com/vitejs/vite/blob/v8.3.8/packages/vite/src/shared/hmr.ts) |
| 릴리스 | 러너의 Vite `build()`에 `base: './'`, `build.assetsDir: 'chunks'`, `build.manifest: true`와 이번 스테이징 경로를 넘긴다. 번들 청크와 선언 자산(`assets/`)의 이름 충돌을 피한다. 빌드가 끝난 뒤 Vite manifest로 진입점·정적/동적 import·CSS를 찾고 실제 파일 목록과 대조해 §4의 오프라인 캐시와 `build.json`을 만든다. `.vite/manifest.json`은 빌더 내부 입력이고, 브라우저의 설치 정보는 `manifest.webmanifest`에 쓴다. [Vite 상대 경로 빌드](https://vite.dev/guide/build#relative-base) · [Vite 빌드 manifest](https://vite.dev/config/build-options#build-manifest) |

기존 v2 앱은 설정 읽기와 러너 교체를 각각 진행한다. 기본 템플릿의 `metro.config.cjs`, `build.mjs`, `main.ts`의 `web-refresh` import와 러너 의존성·lockfile을 새 스타터에 맞춰 이식한다. 앱이 직접 편집한 resolver·transformer·엔트리는 `doctor`가 해당 파일과 옮길 설정을 알려준다. 앱 코드와 편집된 구성을 보존하면서 새 러너로 전환할 수 있어야 한다.

## 3. 공개 명령과 호환 경로

다음은 **구현할 CLI 계약**이다. `--app`에는 앱 루트를 전달한다. `--platform` 값은 `windows`, `android`, `linux`, `macos`, `ios`다.

| 명령 | 구현 후 동작 |
| --- | --- |
| `nelyx create <dir>` · `nelyx supply --app . --packages <dir>` | 공용 앱과 `web/runner`만 생성하고 같은 러너에 Web용 tarball을 공급한다. 디자인 패키지 선택을 유지한다. |
| `nelyx doctor` · `nelyx prepare` | 기본은 PWA다. 설정, 설치 패키지, CanvasKit, 앱 자산·고지를 검사하고 `prepare`가 러너용 설정을 생성한다. |
| `nelyx dev` · `nelyx build` · `nelyx run` | 각각 Vite 개발 서버와 변경 사항 자동 반영, Vite로 만든 `.nelyx/pwa/` 릴리스 게시, 마지막 PWA의 로컬 정적 미리보기다. `build --target pwa`도 같은 빌드다. |
| `nelyx doctor --platform <os>` · `nelyx prepare --platform <os>` | Tauri CLI와 해당 OS 도구를 진단한다. 준비 단계는 앱의 호스트가 없을 때 생성하고 모바일은 필요한 `tauri android init` 또는 `tauri ios init`을 한 번 수행한다. 재실행 시 기존 프로젝트를 보존한다. |
| `nelyx pack --platform <os> [--package <pwa-dir>]` | 기본 입력은 `.nelyx/pwa/`다. 지정 디렉터리의 앱 ID·버전·해시를 확인한 뒤 Tauri만 실행한다. 결과에 입력 `buildId`, 플랫폼·아키텍처, 실제 파일 경로·형식·서명 상태를 반환한다. 입력이 없거나 다른 앱의 것이면 필요한 빌드 명령과 함께 종료한다. |
| `nelyx dev --platform <os>` · `nelyx run --platform <os>` | 개발은 CLI가 시작한 Vite 서버의 실제 URL을 `devUrl`로 넘겨 Tauri WebView에서 연다. 실행은 마지막 로컬 실행본을 열거나 선택한 기기·시뮬레이터에 설치해 연다. `run`에 필요한 실행본이 없으면 대상의 `pack` 명령을 안내한다. |

예를 들어 전환 후 Windows에서 아래 순서로 실행한다. 독립 앱은 Web 패키지를 공급·설치한 후, Tauri 패키징을 추가할 때 앱 루트에서 `npm.cmd install --save-dev --save-exact @tauri-apps/cli@2.12.6`을 한 번 실행한다. 두 샘플에는 이 의존성이 이미 선언되어 있다. 아래 명령의 작업 디렉터리는 앱의 `web/runner/`다. 다른 OS의 패키징 작업에는 첫 명령에서 만든 디렉터리를 전달한다.

```powershell
npx.cmd --no-install nelyx build --app ../..
npx.cmd --no-install nelyx prepare --app ../.. --platform windows
npx.cmd --no-install nelyx pack --app ../.. --platform windows --package ../../.nelyx/pwa
npx.cmd --no-install nelyx run --app ../.. --platform windows
```

전환 기간에 `--target web`과 샘플 `build:web`·`dev:web`는 PWA 경로의 별칭으로 둔다. 두 샘플의 `run:windows`·`dev:windows`는 Tauri를 기본으로 연결한다. 기존 `build:tauri:windows`와 샘플 `build:windows`는 명시적으로 `build:pwa`와 `pack:windows`를 차례로 호출하는 편의 명령으로 둔다. 여러 OS에 배포하는 표준 명령은 `build:pwa` 한 번과 각 `pack:<os>`다. 이전 CLI의 `build --target windows --host tauri`에는 두 새 명령을, 이전 네이티브 엔진·호스트 옵션에는 해당 플랫폼의 Tauri 명령을 안내하고 시작 전에 종료한다.

## 4. PWA 릴리스와 오프라인 동작

1. **산출물과 동일성** — Vite 빌드 한 번으로 `index.html`과 `chunks/` 아래의 해시 이름 JS·CSS를 얻는다. 여기에 `manifest.webmanifest`, 아이콘, `runtime/{native-manifest.json,canvaskit.js,canvaskit.wasm}`, 앱 폰트·이미지·고지와 `licenses/`를 담는다. Vite 내부 manifest는 읽은 뒤 배포 디렉터리에서 제거한다. 지연 로딩 청크까지 포함한 사전 캐시 목록으로 `sw.js`를 생성한다. `build.json`의 `nelyx.pwa-build/v1`에 앱 ID·버전·렌더러, 실제 진입 청크와 정렬된 파일 경로·바이트 수·SHA-256을 기록한다. 워커를 포함한 최종 목록에서 `buildId`를 구하고 `build.json` 자신은 해시 입력에서 제외한다. 소스맵은 디버깅 출력으로 분리한다. 지금 `application.js`·맵·Metro 라이선스를 고정 검사하는 곳도 실제 배포 파일·의존성 기준으로 전환한다. [기존 패키지 검사](Nelyx/sdk/tooling/cli/src/runner-package.mjs) · [Tauri의 기존 입력 검사](Nelyx/sdk/tooling/cli/src/windows-tauri-runner.mjs)
2. **설치와 주소** — HTML에 manifest를 연결한다. 앱별로 안정적인 같은 출처의 `id`, 이름, `display: standalone`, 192·512px PNG 아이콘과 색상을 제공한다. `start_url`과 `scope`는 manifest 디렉터리 기준 `./`로 둔다. 시작 시 앱 루트를 한 번 정해 Wasm·폰트·아이콘·워커가 같은 루트를 쓰게 한다. `/`와 `/demo/`에 같은 파일을 올려 시작 URL·다시 열기·뒤로 가기를 확인한다. 경로 기반 링크를 제공하는 정적 호스트는 앱 경로에만 셸과 해당 배포 루트를 제공한다. 누락된 JS·Wasm에는 404를 반환한다. 정적 미리보기도 manifest와 Wasm의 올바른 MIME을 보낸다. [샘플 부팅 코드](sample/nelyx-demo-app/web/runner/main.ts) · [Web App Manifest 표준](https://www.w3.org/TR/appmanifest/) · [설치 요건](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
3. **오프라인과 갱신** — 브라우저 릴리스를 HTTPS 또는 localhost에서 열 때만 워커를 등록한다. 캐시 키에는 앱 ID·등록 scope·사전 캐시 파일 목록과 워커 코드의 버전을 반영한다. 셸·청크·CanvasKit JS/Wasm·로컬 자산·아이콘·고지를 미리 받아 해시를 확인한다. 한 파일이라도 실패하면 새 캐시만 폐기하고 이전 설치본을 계속 사용한다. 활성 워커는 해당 범위의 등록된 GET 자산과 앱 내 탐색만 처리한다. API·외부 이미지·Vite 개발 클라이언트·HMR·IPC는 제외한다. 열린 이전 탭들이 닫힌 후 새 워커를 활성화하고 자기 앱의 이전 캐시를 정리한다. 서버는 `sw.js`, HTML 및 고정 이름 자산을 재검증하도록 응답한다. 개발과 정적 미리보기는 다른 포트를 사용한다. [서비스 워커 수명주기](https://web.dev/articles/service-worker-lifecycle)
4. **Tauri 내장과 게시** — 같은 디렉터리를 읽기 전용 `frontendDist`로 넘긴다. 패키저는 앱 설정과 PWA 파일 목록·실제 바이트를 확인해 완성된 입력만 받는다. `beforeBuildCommand`에서 Vite를 다시 호출하는 설정도 진단한다. Tauri가 문서 시작 때 제공하는 `window.isTauri`를 확인해 SW 등록을 건너뛴다. 브라우저의 설치 창은 `standalone`에서도 SW를 사용한다. Tauri의 첫 오프라인 부팅은 내장 파일로, 새 버전 적용은 OS 패키지 교체로 확인한다. [Tauri 정적 자산 내장](https://v2.tauri.app/reference/config/#frontenddist) · [Tauri 호스트 판별](https://v2.tauri.app/reference/javascript/api/namespacecore/#istauri)
5. **실패와 동시 실행** — SDK는 스테이징에서 PWA를 검증한 뒤 앱별 잠금 아래 현재 출력을 교체한다. 패키징은 동일한 잠금 아래 고정한 입력을 사용해 빌드 도중 새 JS가 이전 Wasm과 섞이는 일을 막는다. Windows에서 게시 실패·취소·열린 EXE로 인한 잠금이 발생하면 이전 PWA와 실행본을 복구하고 이번 임시 경로를 정리한다.

## 5. Tauri 호스트와 플랫폼별 완료 조건

공용 템플릿은 `templates/windows-tauri/`에서 `templates/tauri/`로 승계한다. `src/lib.rs`에 공통 `run()`과 `#[cfg_attr(mobile, tauri::mobile_entry_point)]`를 두고 데스크톱 `main.rs`에서 호출한다. Cargo에는 모바일 라이브러리 형식을 선언한다. 현재 검증 조합인 npm CLI `2.12.6`, Rust `tauri 2.12.7`, `tauri-build 2.7.6`과 `Cargo.lock`에서 시작한다. 창 크기·제목 변경은 데스크톱 설정에, 앱 식별자·번들 아이콘·모바일 권한은 앱의 공통/OS별 설정에 둔다. 기존 W2 앱은 식별자와 Windows HTTPS 스킴을 유지하고 업데이트 후 기존 WebView 저장소를 읽을 수 있는지 확인한다. [현재 Cargo 템플릿](Nelyx/sdk/tooling/cli/templates/windows-tauri/Cargo.toml) · [Tauri 프로젝트 구조](https://v2.tauri.app/start/project-structure/)

| 대상 | 빌드 환경과 첫 배포 형식 | 실제 환경에서 확인할 항목 |
| --- | --- | --- |
| 브라우저 PWA | WebGL2 지원 브라우저, HTTPS 배포 또는 localhost 미리보기 | Chromium에서 설치·독립 창 실행, Android와 iOS에서 홈 화면 실행, 사전 캐시 후 오프라인 재시작과 A→B 갱신. 브라우저·OS별 결과를 기록한다. |
| Windows | Windows x64, Rust MSVC·Windows SDK·WebView2. 기존 단독 EXE와 NSIS 설치본 | W2의 독립 EXE·입력·HMR 결과를 기준으로 새 PWA ID를 확인한다. 실행 중 파일 잠금과 설치·제거를 확인한다. [Windows 설치 형식](https://v2.tauri.app/distribute/windows-installer/) |
| Android | Rust Android 타깃, JDK·SDK·NDK. 기기 설치용 APK와 배포용 AAB | 에뮬레이터와 arm64 기기에서 시스템 WebView의 Wasm·WebGL2, 뒤로 가기, 소프트 키보드, 회전·복귀, 첫 오프라인 실행을 확인한다. APK 설치와 서명한 AAB 생성을 따로 기록한다. [Android 번들](https://v2.tauri.app/distribute/google-play/) |
| Linux | Linux 빌드 호스트, Rust·WebKitGTK 4.1. 우선 x64 `.deb` | 실제 WebKitGTK 창에서 `tauri://localhost/` 자산, WebGL2와 GPU fence, 한글 입력·접근성, 설치 후 재실행을 확인한다. 사용한 배포판·WebKitGTK 버전을 남긴다. |
| macOS | macOS 빌드 호스트와 Apple 도구. 우선 arm64 `.app`와 `.dmg` | WKWebView의 CanvasKit·폰트·트랙패드·IME와 앱 재실행을 확인한다. 외부 배포용 서명·공증은 유효한 배포 자격으로 실행한 결과를 기록한다. |
| iOS | macOS와 Xcode, Rust iOS 타깃. 시뮬레이터 앱과 기기·배포용 서명 IPA | WKWebView의 터치·safe area·키보드·백그라운드 복귀, 기기 첫 오프라인 실행을 확인한다. 시뮬레이터, 실기기, 서명 IPA마다 상태를 기록한다. [Apple 배포](https://v2.tauri.app/distribute/app-store/) |

CI에서는 PWA 빌드 작업 하나가 검증된 디렉터리를 각 OS 패키징 작업에 전달한다. 각 작업은 해당 플랫폼 도구로 패키징하고, WebView에서 읽은 `buildId`와 앱 JS·Wasm·대표 자산의 해시를 원본과 대조한다. Tauri가 CSP를 위해 처리하는 HTML은 셸 로딩과 정책 적용으로 판정한다. OS별 서명과 스토어 게시는 별도 배포 상태로 기록한다. [웹뷰 엔진](https://v2.tauri.app/reference/webview-versions/) · [플랫폼 준비 도구](https://v2.tauri.app/start/prerequisites/) · [Tauri CSP 처리](https://v2.tauri.app/security/csp/)

## 6. 실행 순서

### W3-01 · Vite 도구 패키지와 SDK 공급

- [ ] 루트 workspace와 `build:sdk`·`build:skia`, 샘플 준비 목록을 Web용으로 좁힌다. `build-packages.mjs`·`generate-providers.mjs`의 네이티브 engine helper 준비와 `prepare-cli.mjs`의 RN Linux 복사를 기본 빌드에서 걷어낸다. 고정 Wasm은 기존 소스 레시피로 준비해 `@nelyx/skia-web`에 공급하고, 소비자는 설치한 패키지의 검증된 바이트를 사용한다. [provider 생성기](Nelyx/eng/generate-providers.mjs) · [CLI 준비](Nelyx/eng/prepare-cli.mjs) · [CanvasKit 공급](Nelyx/skia/eng/prepare-web-runtime.mjs)
- [ ] `@nelyx/vite` workspace·tarball을 추가하고 §2의 공용 자산·설치 검사를 옮긴다. 생성기·공급기에서 `nelyx-metro-*.tgz` 기준을 `@nelyx/vite`로 바꾸고 두 샘플, 스타터, 루트의 패키지 선언과 잠금 파일을 맞춘다. 이전에 공급한 앱을 재설치해도 설치본이 새 tarball을 가리켜야 한다. [앱 생성](Nelyx/sdk/tooling/cli/src/create-app.mjs) · [설치본 교체](Nelyx/sdk/tooling/cli/src/supply-runner.mjs)
- [ ] §2의 React DOM 등록과 DOM 표면을 먼저 이식한다. 이어서 루트·SDK·스타터·두 샘플에서 `react-native`, `react-native-web`, RN용 Skia·Metro 패키지와 선택적 peer 선언을 제거한다. SDK의 RN 전용 타입, 소스 포함 범위, 조건부 `exports`와 npm `files`도 맞춘다. `create --packages`는 Web용 archive만으로 동작하게 한다. [SDK 빌드 설정](Nelyx/sdk/tsconfig.build.json) · [SDK 패키지](Nelyx/sdk/package.json) · [루트 workspace](package.json)
- [ ] 현재 Web provider는 호스트를 `react-dom`으로 표시하면서도 설치 조합은 `web-0.21.3`과 `framework: react-native-web`로 검증한다. 새 조합은 러너에 설치된 `react`·`react-dom`의 정확한 버전으로 정의한다. 정의·검증기·생성 JSON/스키마와 Web·Tauri `doctor`를 함께 갱신한다. v2 설정이 이전 조합을 명시하면 새 러너 재공급과 재빌드를 안내하고, 기존 패키지의 검증 결과는 이전 조합에 귀속한다. [현재 provider](Nelyx/sdk/providers/web.json) · [설치 조합 검증기](Nelyx/sdk/src/runtime/cohorts.ts) · [런타임 정의](Nelyx/sdk/src/runtime/providers.ts) · [Tauri 검사](Nelyx/sdk/tooling/cli/src/windows-tauri-runner.mjs)
- **완료 기준** — Core, SDK, Skia Web, Vite 도구, CLI, tooling-contracts와 선택한 디자인 패키지를 깨끗한 checkout에서 공급한다. 저장소 밖 러너에서 타입 검사와 고정 자산 검사를 실행한다. tarball·잠금 파일·설치 트리에서 RN·RN Web·플랫폼별 RN 호스트·Metro·네이티브 Skia·Nelyx Static AOT·직접 요구하던 Hermes 컴파일러가 빠졌는지 확인한다.

### W3-02 · Vite 개발·빌드와 CLI 전환

- [ ] v3 설정과 v2 읽기, Web provider 등록, §3의 CLI 분기를 적용한다. 생성기·스타터·두 샘플의 개발과 릴리스 명령을 각 러너의 `vite.config.ts`에 연결한다. 앱 루트와 러너에서 실행해도 같은 설정·패키지·진입점을 써야 한다. [Core 플랫폼 식별](Nelyx/src/hosting/platform.ts) · [SDK registry](Nelyx/sdk/src/runtime/providers.ts)
- [ ] §2의 ESM 앱 등록, 자산 플러그인과 제어된 전체 새로고침을 구현한다. `server.fs.allow`에 앱의 공유 소스·러너·설정 등 실제 입력을 지정해 독립 설치본과 monorepo에서 같은 파일을 읽게 한다. 종료 시 `server.close()`까지 기다려 watcher·소켓과 CLI 자식을 정리한다. `nelyx run`은 게시된 PWA를 검증하는 정적 서버를 사용한다. [Vite 파일 제공 범위](https://vite.dev/config/server-options#server-fs-allow)
- **완료 기준** — RN·RN Web·`@vitejs/plugin-react`가 설치되지 않은 Demo·Testbed·외부 스타터에서 Vite dev와 프로덕션 빌드의 첫 화면이 열린다. React StrictMode 아래 마운트·종료·새로고침에서 캔버스가 중복되지 않는지, 리사이즈 후 클릭·Tab 초점 이동·한글 IME 조합·선택과 여러 줄 입력이 정상인지 확인한다. CSS 수정은 현재 화면에 반영되고 위젯 수정은 이전 root·CanvasKit 해제 후 한 번 반영돼야 한다. 번들 오류 복구, 포트 충돌·Ctrl+C, v2 앱의 이행 결과도 확인한다.

### W3-03 · 설치 가능한 PWA 릴리스

- [ ] §4의 빌드·서비스 워커·미리보기를 구현하고 Demo·Testbed·외부 스타터에 같은 SDK tarball을 공급한다. 두 샘플에 각자의 설치 이름·아이콘을 지정한다.
- **완료 기준** — `/`와 `/demo/`에서 설치한 PWA를 오프라인으로 다시 열고 처음 방문하는 지연 로딩 화면·한글·이모지·로컬 이미지를 확인한다. A 탭이 열린 상태로 정상 B와 필수 청크 또는 Wasm이 손상된 B 업데이트를 각각 검사한다. 같은 origin의 다른 앱 캐시를 보존하고 릴리스에 `/@vite/client`·React Refresh·Metro 런타임이 들어오지 않았는지 확인한다.

### W3-04 · 같은 PWA로 Windows 패키징

- [ ] 기존 Tauri 러너를 공용 입력 검증과 Windows 도구·게시로 나눈다. `buildWebInto()` 재호출을 없애고 `frontendDist`에 완성된 PWA를 넘긴다. 개발은 CLI가 Vite 세션과 Tauri 자식을 소유하고 `beforeDevCommand`에서 두 번째 서버가 시작되는 구성을 진단한다. Windows 확장 경로 처리와 앱별 Cargo 잠금·캐시를 승계한다. Cargo·스테이징·PWA 출력·`src-tauri`는 Vite 프런트엔드 감시에서 제외한다. Demo의 ICO를 이전하고 샘플 기본 명령을 전환한다. [Tauri와 Vite 설정](https://v2.tauri.app/start/frontend/vite/)
- [ ] Tauri가 대조하는 준비 이벤트와 상태 응답에는 내부 provider `web`을 일관되게 쓰고 외부 출력 형식은 `pwa`로 기록한다. 개발용 `devCsp`에서 해당 세션의 Vite 모듈과 HMR WebSocket을 실제 창으로 확인한다. 릴리스 CSP는 내장 청크·CanvasKit·IPC에 맞춰 검증한다. [Tauri 개발 CSP](https://v2.tauri.app/reference/config/#devcsp)
- **완료 기준** — 기본 의존성으로 Demo·Testbed·외부 앱에서 첫 이정표를 재현한다. Vite 서버를 끄고 빈 프로필로 WebView2 창을 열어 입력·IPC 응답과 PWA `buildId`를 확인한다. `pack` 중 새 Vite 빌드 호출이 0회여야 한다. 개발 창의 CSS 갱신과 위젯 수정 후 새로고침, 공백·한글 경로, 게시 실패·동시 패키징, 기존 `src-tauri` 재준비도 검사한다.

### W3-05 · Android와 Linux 호스트

- [ ] Android 초기화·기기 선택·APK/AAB와 Linux 번들을 연결한다. 공통 러너에서 `LOCALAPPDATA`·`.exe`·고정 Rust 타깃 사용을 걷어내고 호스트별 도구·캐시·산출물 탐색을 붙인다. Linux에서 WebKit용 로컬 주소 처리를 구현한다.
- **완료 기준** — §5의 Android·Linux 행을 실행한다. Linux에서 앱 등록, 런타임과 폰트 로딩, WebGL2 첫 프레임을 확인한 뒤 같은 주소 처리 코드를 Apple에 사용한다.

### W3-06 · macOS와 iOS 호스트

- [ ] 공용 crate와 Apple 설정을 연결하고 데스크톱·시뮬레이터·기기 실행 및 패키지 게시를 추가한다. 재준비 시 앱이 관리하는 Xcode 프로젝트 변경을 보존한다.
- **완료 기준** — §5의 Apple 두 행을 해당 호스트에서 검증한다. 자격이나 실기기가 없는 항목에는 `미검증`과 필요한 환경을 적고 검증된 형식만 지원표에 올린다.

### W3-07 · 이전 호스트 제거와 독립 소비자 인수

- [ ] 두 샘플과 외부 앱이 전환되면 `@nelyx/metro` workspace, Metro 설정·변환기·개발 클라이언트, 루트의 `@react-native/metro-*`와 샘플의 이전 명령을 제거한다. 참조가 끊긴 RNW·Android·Apple·Linux RN 러너, direct Hermes/V8/JSC·Static AOT 경로, Graphite 네이티브 패키지와 템플릿을 정리한다. 루트·SDK·CLI·Skia·두 샘플의 한·영 README, 관련 lockfile과 CI 명령을 맞춘다.
- **완료 기준** — 이전 SDK·러너 캐시가 없는 외부 앱에서 README의 생성→Vite 개발→PWA 배포→Tauri 패키징→실행이 끝까지 작동한다. 루트와 독립 러너의 잠금 파일·`npm ls --all`, SDK/CLI tarball의 공개 import, Vite가 실제 번들에 넣은 모듈을 검사한다. `react-native`, `react-native-web`, `@react-native/*`, 플랫폼별 RN 패키지, `@nelyx/skia-rn`과 Metro 런타임·설정이 제품 의존성에서 빠져야 한다. CanvasKit 소스 레시피·패치와 재사용한 Skia 코드의 출처·라이선스는 검증 대상에 포함한다. [Skia 출처 고지](Nelyx/skia/THIRD_PARTY_NOTICES.md)

### 구현 중 주의할 세 곳

- **로컬 주소와 IPC** — 브라우저 HTTP(S), Windows·Android의 설정된 `https://tauri.localhost/`, WebKit 호스트의 `tauri://localhost/`를 실제 문서 주소와 대조한다. 사용자 지정 스킴에서는 `origin` 문자열 `null`끼리의 비교로 페이지를 신뢰하지 않는다. scheme·host·port와 앱 루트 경계를 확인하는 로직을 CanvasKit, 폰트·이미지, 탐색, Rust 페이지 처리에 일관되게 적용한다. WebView의 호스트 표식은 SW 선택에만 쓰고 IPC 권한은 메인 WebView와 앱의 capability가 결정한다. Vite가 출력한 모듈 스크립트와 동적 import의 URL·MIME, WebGL2/fence, WebCrypto, Blob 스크립트와 Wasm 컴파일을 실제 WebView와 해당 CSP에서 검사한다. [브라우저 탐색](Nelyx/sdk/src/backends/browser/platform-messages.ts) · [WebGL2 표면](Nelyx/skia/packages/web/src/library.ts) · [현행 권한](Nelyx/sdk/tooling/cli/templates/windows-tauri/capabilities/main.json)
- **모바일 개발 연결** — 데스크톱 Vite 서버는 loopback을 기본으로 한다. Android는 선택한 기기의 `adb reverse`, iOS 실기기는 Tauri가 제공한 `TAURI_DEV_HOST`와 기기가 신뢰하는 HTTPS 또는 터널에 맞춘다. 기기에서 접근할 Vite HTTP(S)·HMR WebSocket 주소, Tauri `devUrl`, Rust의 개발 페이지 검사를 같은 세션 설정에서 결정한다. 종료 시 소유한 서버와 포트 포워딩을 정리한다. [Tauri 모바일 개발](https://v2.tauri.app/develop/) · [Vite 서버 설정](https://vite.dev/config/server-options)
- **의존성 정리와 복구** — `native`라는 이름으로 일괄 삭제하면 Web에 필요한 `runtime/native-manifest.json`과 CanvasKit 빌드 입력까지 잃는다. Workspace→패키지 exports→설치한 러너→실제 번들의 순서로 참조를 추적한다. 교체 구간은 PWA 빌더, Tauri 패키징, 기존 호스트 삭제 순으로 쪼개어 실패한 구간만 되돌릴 수 있게 한다. 실행 파일과 임시 소비자 설치본을 백업용으로 복제하지 않는다. [CanvasKit 공급 검사](Nelyx/skia/eng/prepare-web-runtime.mjs) · [소스 빌드 레시피](Nelyx/skia/eng/source-build/README.md) · [패키지 빌더](Nelyx/eng/build-packages.mjs)

## 7. 최종 인수와 현재 상태

두 샘플의 갤러리에서 도형·폰트·이미지 표시 외에 Demo의 `Filled favorite` 연속 클릭, Testbed의 ListView 스크롤·행 선택, 텍스트 입력·포커스·뒤로 가기를 확인한다. Windows는 실제 창에 PowerShell 가상 입력을 보내고 모바일은 터치·IME·앱 복귀를 해당 기기에서 확인한다. DOM 접근성 트리와 스크린 리더 실사용 결과를 구분해 적는다. W2의 부드럽다는 사용자 소감은 관찰 기록으로 두고 성능 수치를 낼 때에는 같은 기기·장면의 프레임 간격을 측정한다. [W2 입력 결과와 사용자 소감](work2.md#5-실행-결과)

단계마다 코드·의존성·호출 경로를 먼저 검토한 뒤 변경한 경계부터 실행한다. 자동 검증은 항목당 20분 제한, 반복은 일반적으로 30회 이내다. 임시 앱·프로필·스테이징은 `finally`에서 정리하고 현재 결과만 남긴다. 지원표에는 확인한 OS·아키텍처·WebView 버전·패키지 형식, 설치·오프라인 실행·서명의 결과를 기록한다. [저장소 검증 지침](.github/copilot-instructions.md)

**작성 시점** — 코드와 기존 실행 기록을 검토해 세운 계획이다. W2가 확인한 범위는 Metro와 RN Web을 쓰는 기존 Windows x64 EXE·개발 창이다. W3의 React DOM 호스트 전환, Vite PWA 빌드와 새 Tauri 패키징 검증은 착수 전이다. W3-01에서 웹 호스트의 RN Web 사용처를 교체하고 자산·설치 검사를 옮긴 뒤, 새 SDK와 `@nelyx/vite`를 독립 러너에 공급한다.
