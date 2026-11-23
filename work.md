# Nelyx Rust 백엔드와 Web·Tauri 빌드 개편 계획

2026-11-23 · 기준 브랜치 `tauri-backend` · 기준 커밋 `9c87fcb6` · **PLANNED — 구현 전**

## 1. 결정

**앱에는 `src/` 하나를 두고, 웹과 Tauri WebView 모두 `src/index.ts`에서 같은 앱을 시작한다.** Tauri를 사용하는 앱은 같은 폴더에 Rust 호스트 진입점도 둔다. 공용 Rust 백엔드의 원본은 Nelyx SDK가 소유한다. 웹 빌드는 이를 WebAssembly로 브라우저 안에서 실행하고, Tauri 빌드는 해당 OS·아키텍처의 네이티브 라이브러리로 컴파일해 호스트에 링크한다.

이 구조에서 백엔드가 처음 맡을 기능은 **호스트 정보와 클립보드 기능 판정**이다. 실제로 두 타깃에서 같은 정책을 실행하고, 웹 권한과 네이티브 권한의 차이도 확인할 수 있다. 위젯 생성, 레이아웃, 포인터·IME 처리, 프레임 스케줄링과 CanvasKit 그리기는 화면을 소유한 브라우저 또는 WebView에서 처리한다. 따라서 스크롤 한 프레임을 그리는 데 네이티브 IPC 왕복이 필요하지 않다.

현재 사용자가 한 명이므로 **공개 규약은 한 번에 교체한다.** 앱 설정, CLI, 스타터, Demo, Testbed와 CI를 같은 전환에서 갱신하고 이전 설정 판독기와 빌드 별칭을 삭제한다. 두 타깃을 모두 배포할 때에는 Vite 프런트엔드 두 벌을 만든다. Tauri용 한 벌은 모든 네이티브 OS가 재사용한다. 웹 쪽에 추가되는 백엔드 Wasm의 크기와 초기화 시간은 첫 릴리스에서 측정한다.

## 2. 현재 코드에서 확인한 구조

| 위치 | 현재 동작 | 개편에 미치는 영향 |
| --- | --- | --- |
| [CLI 진입점](Nelyx/sdk/tooling/cli/src/main.mjs) · [Tauri 빌드](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs) | `build --target web`과 `pwa`는 같은 PWA를 만든다. `build --platform`은 거부하고, `pack --platform`은 기존 PWA를 검증해 `frontendDist`로 넘긴 뒤 빌드 ID를 다시 확인한다. | 브라우저 독립 빌드는 이미 있다. 교체할 부분은 Tauri 빌드의 필수 입력인 PWA와 그 검증 규약이다. |
| [앱 설정](Nelyx/sdk/src/runtime/config.ts) · [Vite 러너](Nelyx/sdk/tooling/vite/src/runner.mjs) · [호스트 판별](Nelyx/sdk/src/platforms/web/environment.ts) | 공통 UI 진입점이 `nelyx.pwa.component`에 속한다. 러너 경로는 `web/runner`로 고정되고, 시작 시 `getWebDeployment()`가 `window.isTauri`를 읽어 호스트를 구분한다. | 공통 UI, 웹 설치 옵션, 빌드 시 선택한 백엔드를 각각 표현해야 한다. |
| [Demo의 앱 정의](sample/nelyx-demo-app/src/index.ts) · [러너 시작](sample/nelyx-demo-app/web/runner/main.ts) · [Demo 화면 조립](sample/nelyx-demo-app/web/runner/App.tsx) | 현재 HTML은 러너의 `main.ts`를 연다. 러너가 React 컴포넌트를 마운트하면 그 안에서 `virtual:nelyx-app`을 통해 `src/index.ts`의 `main()`을 호출한다. | 앱이 이미 공유하는 상태·위젯 생성 코드를 활용하고, 두 타깃 모두 HTML에서 같은 앱 모듈로 들어가게 한다. |
| [DOM 앱 조립](Nelyx/sdk/src/platforms/web/application.ts) · [플랫폼 메시지](Nelyx/sdk/src/backends/browser/platform-messages.ts) · [OS 서비스](Nelyx/sdk/src/runtime/os-services.ts) | `openApplication`이 CanvasKit과 플랫폼 서비스를 조립한다. 브라우저 모듈 안에서 `window.__TAURI__?.clipboardManager`와 `navigator.clipboard`를 선택한다. `OsServiceHost`와 `PluginPlatformMessagePort`가 이미 서비스 주입 지점을 제공한다. | 기존 메시지 코덱과 위젯 호출을 활용하고 호스트 접근만 어댑터로 옮길 수 있다. |
| [스타터의 Rust 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/lib.rs) · [Demo 호스트](sample/nelyx-demo-app/src-tauri/src/lib.rs) · [Testbed 호스트](sample/nelyx-testbed-app-2/src-tauri/src/lib.rs) | 세 곳에 `host_info`와 페이지 로드 처리가 복제돼 있다. Demo와 스타터는 네이티브 클립보드를 등록하고, Testbed의 설정에는 해당 플러그인과 권한이 없다. Android 여백 처리는 Demo의 Rust·Kotlin·TS에만 있다. | 공통 구현은 SDK로 올리고 각 앱의 권한과 OS별 기능 선택은 앱에 둔다. |
| [릴리스 검증](Nelyx/sdk/tooling/vite/src/release.mjs) · [패키징 CI](.github/workflows/pwa-tauri.yml) · [Windows WebView2 검사](Nelyx/eng/check-tauri-windows.mjs) | 현재 `runtime/canvaskit.wasm`은 렌더러다. CI는 PWA 한 벌을 전달하고 Windows 검사는 PWA 빌드 ID와 WebView2가 실제 읽은 자산 해시를 비교한다. | 새 백엔드 Wasm에 별도 위치와 식별자가 필요하다. 네이티브 패키지 검사의 기준 입력도 Tauri용 프런트엔드로 바뀐다. |

## 3. 소스 배치와 실행 경계

아래는 목표 배치다. Rust 크레이트의 정본은 `Nelyx/backend` 한 곳에 둔다.

```text
Nelyx/
  backend/
    Cargo.toml                         # 세 크레이트를 묶는 workspace
    Cargo.lock
    crates/
      nelyx-backend-core/              # 공통 데이터 형식, 기능 판정, 오류
      nelyx-backend-wasm/              # core + wasm-bindgen
      tauri-plugin-nelyx-backend/      # core + Tauri 명령, 권한 정의, android/ 플러그인
    packages/
      wasm/                            # @nelyx/backend-wasm 배포 단위
      tauri/                           # @nelyx/backend-tauri 배포 단위
  sdk/src/
    frontend/dom/                      # 브라우저와 WebView가 공유하는 화면·입력
    backends/                          # TS 서비스 계약과 web-wasm, tauri 어댑터
  sdk/tooling/                         # CLI, Vite, 설치 패키지와 릴리스 검증
  skia/                                # CanvasKit 빌드와 렌더러
sample/<app>/
  package.json, package-lock.json      # 앱 설정과 앱 자체의 npm 설치
  index.html, vite.config.ts, tsconfig.json
  src/
    index.ts                           # Web과 Tauri WebView의 공용 앱 진입점
    app.ts, app-surface.tsx, style.css  # 위젯·상태, 앱별 화면 조립과 스타일
    main.rs                            # Tauri 선택 시, 데스크톱 실행 파일 진입점
    lib.rs                             # Tauri 선택 시, 호스트 등록과 모바일 진입점
  assets/
  Cargo.toml, Cargo.lock, build.rs     # Tauri 선택 시, 앱 루트의 Cargo 패키지
  tauri.conf.json                     # 앱 식별자·창·패키징 설정
  capabilities/, icons/               # 해당 앱에 허용한 명령과 번들 아이콘
  gen/android/, gen/apple/            # 해당 플랫폼을 준비할 때 만드는 Gradle·Xcode 프로젝트
```

### 하나의 앱 진입점

- **웹.** 앱 루트의 `index.html`에서 Vite가 `appEntry`로 지정한 `./src/index.ts`를 모듈로 연다. 진입점은 `./app.ts`의 앱 팩터리와 필요한 화면 컴포넌트를 가져와 SDK에 등록한다. SDK는 웹 어댑터와 Wasm을 초기화한 뒤 마운트한다. 웹 전용 앱은 이 경로와 JS 패키지만으로 개발·배포할 수 있다.
- **Tauri.** 데스크톱은 `src/main.rs`가 `src/lib.rs`의 호스트를 시작하고, 모바일은 `#[cfg_attr(mobile, tauri::mobile_entry_point)]`가 붙은 라이브러리 진입점을 사용한다. 호스트가 연 WebView도 같은 HTML과 `src/index.ts`를 실행한다. 이 번들에는 네이티브 백엔드에 연결하는 IPC 어댑터를 넣는다. [Tauri 프로젝트 구조](https://v2.tauri.app/start/project-structure/) · [Cargo 기본 배치](https://doc.rust-lang.org/cargo/guide/project-layout.html)
- **앱 코드 이관.** 기존 `main(state, options)`의 상태·정의 생성은 순수 함수로 `src/app.ts`에 둔다. `src/index.ts`가 팩터리를 등록하면 화면 컴포넌트가 마운트될 때 이를 호출한다. Demo의 `App.tsx`에 있는 진단 콜백·렌더 옵션과 Testbed의 오류 표시는 `src/app-surface.tsx`로 옮긴다. 이 컴포넌트는 팩터리를 인자로 받아 진입점을 다시 import하지 않는다. [Testbed 화면 조립](sample/nelyx-testbed-app-2/web/runner/App.tsx)

**경로 확인 결과.** 프로젝트에 설치된 Tauri CLI 2.12.6은 `TAURI_APP_PATH` 또는 현재 디렉터리에서 설정을 먼저 찾는다. Windows 임시 앱에서 두 Tauri 경로 변수를 앱 루트로 지정한 뒤 `tauri inspect wix-upgrade-code`로 루트 설정을 읽고, `cargo metadata --no-deps --offline`으로 `src/lib.rs`와 `src/main.rs`를 확인했다. Vite 8.3.8로는 같은 HTML과 `src/index.ts`에서 타깃 값이 다른 두 번들을 만들었다. 실제 Nelyx 샘플의 실행·패키징은 7절의 인수 항목이다. [고정 버전의 Tauri 경로 탐색](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.6/crates/tauri-cli/src/helpers/app_paths.rs) · [Vite HTML 진입점](https://vite.dev/guide/#index-html-and-project-root)

### 타깃별 백엔드

| 빌드 타깃 | 실행 경로 | 외부 기능 접근 |
| --- | --- | --- |
| `web` | 앱 → SDK → web-wasm 어댑터 → 브라우저 탭 안의 Rust/Wasm | 호스트 어댑터가 Clipboard·Permissions API를 호출하고 DOM 계층이 CSS 여백을 읽는다. 정적 파일 서버로 배포할 수 있다. |
| `tauri` | 앱 → SDK → Tauri 어댑터 → 허용된 IPC 명령 → 호스트 프로세스의 Rust | Tauri 플러그인과 모바일 OS API가 앱에 허용된 기능을 제공한다. Cargo 컴파일 타깃은 Windows x64의 `x86_64-pc-windows-msvc`, Android arm64의 `aarch64-linux-android`처럼 OS·CPU로 결정된다. |

두 어댑터 크레이트가 각각 `nelyx-backend-core`를 의존한다. 코어의 입력과 출력은 일반 Rust 값으로 정의하고 `Window`, Tauri 핸들, OS 권한 요청은 어댑터가 소유한다. 웹은 `wasm32-unknown-unknown`과 `wasm-bindgen --target web`의 ES 모듈 초기화를 사용한다. Tauri는 플러그인 크레이트를 앱 빌드에 링크하고 앱의 `build.rs`에서 Tauri 컨텍스트를 생성한다. [Rust Wasm 타깃](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html) · [wasm-bindgen 배포 형식](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html) · [Tauri 플러그인](https://v2.tauri.app/develop/plugins/)

### 첫 공통 기능

1. **백엔드 초기화.** Vite가 개발·릴리스 모두에서 `virtual:nelyx-backend`를 선택한 타깃의 진입점 하나에 연결한다. 웹은 Wasm을 로드하고 Tauri는 `plugin:nelyx-backend|describe`를 호출한다. 양쪽 Rust 구현이 반환한 `backendVersion`, `protocolVersion`, 실행 종류와 호스트 기능을 SDK가 확인한 뒤 마운트한다. 앱 버전은 별도 필드다. 필수 모듈 누락이나 프로토콜 불일치는 시작 오류에 기대값·실제값을 표시한다.
2. **클립보드.** 코어는 호스트 종류, 읽기·쓰기 API의 유무, 권한 상태를 받아 읽기·쓰기 가능 여부와 메뉴를 열 때 내용을 조회해도 되는지 결정한다. 같은 입력에는 Wasm과 네이티브 빌드가 같은 결과를 내야 한다. 웹 어댑터는 사용자 동작 시점에 `navigator.clipboard`를 호출한다. Tauri 어댑터는 앱이 허용한 클립보드 명령을 호출하고, 플러그인을 쓰지 않는 Testbed에서는 WebView의 Clipboard API를 사용 가능한 범위에서 제공한다. 명령 실행 시 권한 거부는 호출자에게 그대로 전달한다. 빈 클립보드, `permission-required`, `permission-denied`, `unsupported`를 구분한다. 모바일 메뉴의 사전 조회는 내용을 읽지 않고 권한 상태를 돌려준다. [기존 클립보드 계약](Nelyx/sdk/src/runtime/clipboard-service.ts)
3. **Android 화면 여백.** Demo의 `SafeAreaPlugin.kt`와 `watch_safe_area`를 SDK 모바일 플러그인으로 옮기고 Demo 패키지명에 묶인 등록을 제거한다. WebView별 구독으로 최초 값과 변경만 보내며, 어댑터가 물리 px을 CSS px로 한 번 변환한다. 웹과 네이티브 여백을 제공하지 않는 호스트는 CSS 여백을 사용한다. 캔버스 좌표 보정과 키보드의 시각 뷰포트 측정은 DOM에서 수행한다. [Kotlin 구현](sample/nelyx-demo-app/src-tauri/gen/android/app/src/main/java/dev/nelyx/demo/tauri/SafeAreaPlugin.kt) · [현재 단위 변환](sample/nelyx-demo-app/web/runner/android-safe-area.ts) · [SDK 여백 계약](Nelyx/sdk/src/backends/browser/environment.ts)

SDK는 선택된 어댑터를 `openApplication`에 주입하고, 동기식 환경 조회에는 마지막 기능 상태를 제공한다. 권한 변경과 여백은 이벤트로 갱신한다. 직접 제공한 `platformMessages`, 다중 뷰, HMR 종료는 기존 소유권·취소 경로에 연결한다. 뷰 종료 시 구독을 해제하고 이전 세대의 응답을 폐기한다. `getWebDeployment()`를 사용하던 선택 메뉴, 서비스 워커와 Demo의 OS별 설정도 새 타깃·호스트 정보를 읽게 한다. [앱 조립](Nelyx/sdk/src/platforms/web/application.ts) · [서비스 종료](Nelyx/sdk/src/runtime/plugin-port.ts) · [선택 메뉴](Nelyx/sdk/src/backends/browser/selection-context-menu.ts)

Tauri 앱은 플러그인 등록, 모바일 진입점, 앱별 capability를 소유한다. 플러그인의 명령 선언과 앱의 허용 목록을 함께 전환한다. 메인 WebView와 허용된 앱 페이지 범위, 앱별 클립보드 권한, Android 개발 프록시와 데스크톱 창 제목 처리를 이관한다. 기능 조회 결과는 UI 표시용이고 각 명령의 실행 권한은 Tauri가 판정한다. [Demo 권한](sample/nelyx-demo-app/src-tauri/capabilities/main.json) · [Testbed 권한](sample/nelyx-testbed-app-2/src-tauri/capabilities/main.json) · [Tauri capability](https://v2.tauri.app/security/capabilities/)

## 4. 앱 설정과 빌드 결과

`nelyx.app/v4`의 앱 진입점 설정은 `appEntry` 하나이며 기본값은 `./src/index.ts`다. Vite가 이 값에서 HTML의 모듈 태그를 만들어 개발 서버와 릴리스에 적용한다. 화면 컴포넌트는 앱 코드에서 import한다. 웹 설치 옵션은 `targets.web.pwa`에 둔다. `targets.web: {}`는 일반 정적 웹이고, `targets.tauri`만 선언해도 같은 진입점에서 빌드할 수 있다. 공통 빌드 식별에는 npm 패키지 이름과 버전을 쓰며 브라우저 설치 ID와 Tauri 번들 식별자는 해당 플랫폼에서 읽는다. 아래는 Demo의 설정 발췌다.

```json
{
  "schema": "nelyx.app/v4",
  "name": "NelyxDemoApp",
  "appEntry": "./src/index.ts",
  "targets": {
    "web": { "pwa": { "id": "/apps/nelyx-demo", "shortName": "Nelyx Demo", "themeColor": "#101827" } },
    "tauri": {}
  }
}
```

**개편 후 Demo 앱 루트에서 사용할 명령**이다. `--target`은 백엔드 실행 방식을, `--platform`과 `--architecture`는 네이티브 패키지의 OS와 CPU를 지정한다.

```powershell
npx.cmd --no-install nelyx dev   --app . --target web
npx.cmd --no-install nelyx build --app . --target web
npx.cmd --no-install nelyx run   --app . --target web --base /demo/

npx.cmd --no-install nelyx prepare --app . --target tauri --platform windows
npx.cmd --no-install nelyx build   --app . --target tauri --platform windows
npx.cmd --no-install nelyx run     --app . --target tauri --platform windows
```

| 명령 | 결과와 입력 규약 |
| --- | --- |
| `build --target web` | `.nelyx/web/`에 정적 HTML·JS·앱 자산, CanvasKit, `runtime/backend/`의 바인딩 JS와 백엔드 Wasm을 게시한다. PWA를 설정한 앱에는 설치 manifest와 오프라인 서비스 워커를 추가한다. |
| `build --target tauri --platform <os>` | 공용 앱 소스로 `.nelyx/tauri/frontend/`를 만들고 OS·CPU용 Rust를 빌드해 `.nelyx/tauri/<os>-<arch>/`에 게시한다. WebView 자산에 포함되는 Wasm은 CanvasKit이며 Nelyx 백엔드는 실행 파일 또는 앱 네이티브 라이브러리에 들어간다. |
| `build --target tauri --frontend-only` | CI가 네이티브 도구 없이 Tauri용 프런트엔드만 한 번 생성한다. `pack --target tauri --platform <os> --frontend <dir>`가 이 결과를 검증한 뒤 네이티브 패키지를 만든다. 브라우저용 릴리스를 입력하면 예상 타깃과 실제 타깃을 표시하고 중단한다. |

각 프런트엔드의 `build.json`은 앱 이름·버전, 타깃, 백엔드 종류·버전·프로토콜, 렌더러 프로필과 정렬한 파일별 크기·SHA-256으로 `buildId`를 계산한다. 같은 버전으로 Rust를 다시 빌드한 경우도 구분하도록 기대하는 코어 소스 해시를 포함하고 초기화 시 Rust가 반환한 값과 맞춘다. 네이티브 패키지에는 **실제 내장한 Tauri 프런트엔드의 `frontendBuildId`**, Rust 타깃과 네이티브 산출물 해시를 기록한다. Web과 Tauri 사이에서는 공유 폰트·이미지·CanvasKit의 해시를 비교한다. CanvasKit 공급 검증과 렌더러의 `wireAbi`는 별도 계약으로 관리한다. [현재 릴리스 식별](Nelyx/sdk/tooling/vite/src/release.mjs) · [렌더러 공급 규약](Nelyx/sdk/providers/web.json)

### 앱 루트 통합에 필요한 CLI 수정

| 대상 | 수정할 동작 |
| --- | --- |
| Tauri 탐색과 준비 | `hostPath(app)`을 앱 루트로 바꾸고 `TAURI_APP_PATH`, `TAURI_FRONTEND_PATH`도 그 루트로 지정한다. 현재 `prepare`는 호스트 디렉터리가 없을 때만 템플릿을 통째로 복사한다. 새 방식은 루트의 필수 파일을 검사하고 필요한 파일만 설치한다. 재실행·실패 때 사용자가 작성한 `src/`, 설정, 권한 파일을 보존한다. `pack`이 현재 앱과 호스트에 거는 두 잠금은 같은 경로가 되므로 앱 잠금을 한 번 획득해 내부 단계에 전달한다. [Tauri 러너](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs) · [게시 잠금](Nelyx/sdk/tooling/cli/src/publication.mjs) |
| 빌드와 개발 서버 | `tauri.conf.json`의 `frontendDist`는 루트 기준 `.nelyx/tauri/frontend`로 지정하고, 실제 패키징 입력은 검증된 디렉터리만 사용한다. Vite의 HTML 변환에서 `appEntry`를 모듈 분석 전에 삽입한다. `publicDir: false`와 명시적 자산 목록을 사용하고, TS·CSS 변경은 Vite가, Rust·Cargo·Tauri 설정 변경은 호스트가 처리한다. 개발 서버의 파일 제공 범위와 양쪽 감시 범위를 조정해 네이티브 소스·설정의 웹 노출 및 이중 재시작을 막는다. [현재 Vite 설정](Nelyx/sdk/tooling/vite/src/config.mjs) |
| 모바일 프로젝트 | 기존 `src-tauri/gen/android`를 앱 루트의 `gen/android`로 옮기고 AndroidManifest·Gradle 설정·`MainActivity`의 edge-to-edge 처리를 이관한다. Gradle의 `rootDirRel`과 Xcode 빌드 스크립트가 새 Cargo 루트 및 앱에 설치된 CLI를 찾는지 확인한다. iOS 프로젝트의 기준 경로는 `gen/apple`이다. [Android 설정](sample/nelyx-demo-app/src-tauri/gen/android/app/build.gradle.kts) · [Gradle의 CLI 재호출](sample/nelyx-demo-app/src-tauri/gen/android/buildSrc/src/main/java/dev/nelyx/demo/tauri/kotlin/BuildTask.kt) · [Demo 액티비티](sample/nelyx-demo-app/src-tauri/gen/android/app/src/main/java/dev/nelyx/demo/tauri/MainActivity.kt) |

## 5. SDK 공급

- **SDK 제작자**는 `cargo build --manifest-path Nelyx/backend/Cargo.toml --locked -p nelyx-backend-wasm --target wasm32-unknown-unknown --release`로 웹용 Rust를 컴파일한다. 바인딩 생성 CLI 버전을 크레이트와 맞추고 JS·Wasm·타입 선언·해시 manifest·라이선스를 `@nelyx/backend-wasm`에 담는다. 배포된 SDK로 웹 앱을 만드는 사람에게 필요한 것은 Node/npm과 공급된 파일이다.
- **Tauri 소비 앱**에는 `@nelyx/backend-tauri`로 같은 버전의 코어와 플러그인 소스, 모바일 코드, 빌드 스크립트, 권한 정의, 라이선스를 공급한다. `supply`가 검증한 Cargo 소스 트리를 앱의 `.nelyx/sdk/rust/`에 게시한다. **앱 루트**의 `Cargo.toml`에서 `.nelyx/sdk/rust/crates/tauri-plugin-nelyx-backend`를 상대 경로로 참조한다. 공급본 안에서 코어 의존성과 workspace 상속이 완결돼야 한다. 플러그인 추가 시 앱과 스타터의 `Cargo.lock`을 갱신하고 이후 패키징은 `--locked`로 실행한다.
- **앱 설치 위치**는 앱 루트 하나로 통합한다. 두 샘플은 저장소 루트 npm `workspaces`에서 빼고 자체 `package.json`과 잠금 파일로 관리한다. 이렇게 해야 새 checkout에서 루트 `npm ci`가 샘플용 SDK tarball을 먼저 요구하지 않는다. SDK 공급 후 각 앱에서 `npm.cmd ci --workspaces=false`를 실행하고 같은 루트의 `node_modules`와 설치 잠금을 검증한다. 루트의 샘플 스크립트와 CI도 이 앱 경로를 사용한다. [현재 workspace](package.json) · [현재 공급 위치](Nelyx/sdk/tooling/cli/src/supply-runner.mjs)
- **패키지 도구**는 `build:sdk`, `pack:sdk`, `supply`와 설치 검증을 연결한다. 선언한 타깃에 필요한 패키지를 공급하고 웹 전용 앱은 네이티브 패키지·Tauri CLI 설치 없이 동작하게 한다. 현재 TS sourcemap 검사를 Rust 패키지에 적용하면 생성 JS와 Wasm의 출처를 판정할 수 없다. Rust 소스·lock·빌드 도구·생성 파일 해시를 대응시켜 오래된 산출물을 거부한다. 최종 확인은 저장소 밖의 새 앱에서 제공된 tarball과 격리 설치한 러너로 한다. [패키지 제작](Nelyx/eng/prepare-sample.mjs) · [소스 입력 검사](Nelyx/eng/package-source-inputs.mjs) · [설치본 검증](Nelyx/sdk/tooling/contracts/src/installed-supply.cjs)

Nelyx 자체를 개발할 때는 아래 루트 명령이 Rust 입력 변경을 감지해 선택한 타깃을 빌드하고 샘플까지 연결한다. 웹 명령은 새 Wasm을 제작·공급한 뒤 앱을 빌드한다. Tauri 명령은 네이티브 소스를 공급한 뒤 앱의 Cargo 빌드를 호출한다. 입력이 같으면 현재 공급본을 재사용한다. 두 명령 모두 최종 빌드에는 샘플에 설치한 CLI를 사용한다.

```powershell
npm.cmd run build:web -- --app sample/nelyx-demo-app
npm.cmd run build:tauri -- --app sample/nelyx-demo-app --platform windows
```

## 6. 구현 순서

- [ ] **1. 두 Rust 빌드로 첫 기능을 연결한다.** workspace, 세 크레이트, 백엔드 프로토콜과 클립보드 판정 함수를 만든다. 호스트 Rust 단위 검사와 실제 Wasm 바인딩에 같은 입력 표를 적용한다. `cargo tree -p nelyx-backend-wasm --target wasm32-unknown-unknown`으로 웹 의존성 그래프를 확인한다. 완료 기준은 두 실행 결과의 일치와 웹 그래프의 Tauri 의존성 0개다.
- [ ] **2. SDK를 독립적으로 공급한다.** 루트 npm workspace와 패키지 제작·공급 목록에 두 패키지를 등록한다. Rust workspace 밖에 설치한 tarball에서 Wasm을 초기화하고, 설치된 소스 경로를 참조하는 최소 Tauri 호스트를 `--locked`로 빌드한다. 소스 변경 후 재공급, 바인딩 누락, 버전 불일치를 검사한다.
- [ ] **3. SDK와 호스트를 연결한다.** `startPwa`와 `definePwaConfig`에서 공용 마운트·자산 로딩을 꺼내고 PWA 설치·서비스 워커 처리를 웹 진입점에 둔다. Rust 정보 조회·클립보드 정책·Android 여백을 실제 채널과 연결한다. `@nelyx/sdk`의 exports, 렌더러 레지스트리와 생성기를 함께 고쳐 새 DOM 경로를 패키지에서 열 수 있게 한다. 브라우저 전용 번들에 Tauri 모듈이나 전역 참조가 들어가면 Vite가 실패하도록 검사한다. [현재 시작점](Nelyx/sdk/tooling/vite/src/client.mjs) · [레지스트리](Nelyx/sdk/src/runtime/providers.ts) · [생성기](Nelyx/eng/generate-providers.mjs) · [Vite 모듈 검사](Nelyx/sdk/tooling/vite/src/config.mjs)
- [ ] **4. CLI와 산출물 계약을 교체한다.** 4절의 루트 탐색·준비·잠금·모바일 경로를 `doctor/prepare/dev/build/pack/run`에 적용한다. 개발·배포가 같은 앱 진입점과 타깃별 어댑터를 쓰게 하고, Vite 캐시와 생성 설정은 타깃별로 둔다. SDK의 공용 Rust 변경은 웹에서 Wasm 재생성·페이지 재로드로, Tauri에서 네이티브 재빌드·호스트 재시작으로 반영한다. 웹은 하위 경로 기준 URL, Wasm MIME, PWA 캐시 목록에 새 런타임을 반영한다. 네이티브 패키징은 검증한 입력 ID, staging 정리, 실행 중인 Windows 파일 보호를 적용한다. [서비스 워커](Nelyx/sdk/tooling/vite/src/service-worker.mjs)
- [ ] **5. 모든 소비자를 한 번에 전환한다.** Demo·Testbed·생성 템플릿의 앱 코드를 단일 `src/`로 합치고 `web/runner`와 `src-tauri`를 제거한다. HTML·npm·Cargo·Tauri 설정은 앱 루트에 둔다. `create`·`supply`, CLI의 앱 루트 탐색, import·tsconfig·잠금 파일, 루트·앱 npm 스크립트와 한·영 README를 갱신한다. 앱 식별자·서명·창 설정·권한을 이관하고 Demo의 중복 Rust/Kotlin/TS 연결 코드를 제거한다. `nelyx.app/v2·v3` 판독, `--target pwa`, `.nelyx/pwa` 패키징과 구형 별칭을 정리한다. CI는 앱 루트에서 설치하고 OS별 작업에 Tauri 전용 프런트엔드와 네이티브 SDK 공급본을 전달한다.
- [ ] **6. 새 진입점으로 인수한다.** 아래 표를 Demo·Testbed와 필요한 외부 소비 앱에 적용한다. 소스와 의존성 검토 → 기능 단위 검사 → 패키지 빌드와 실행 순서로 진행한다. 각 검사는 저장소 규칙에 따라 제한 시간을 20분으로 두고 임시 프로필·소비 앱·staging은 실행 종료 시 정리한다. [저장소 지침](.github/copilot-instructions.md)

## 7. 완료 기준

| 대상 | 통과 조건 |
| --- | --- |
| 공용 진입점 | 새로 생성한 앱과 두 샘플에서 `src/index.ts`가 가져오는 초기 화면 문구를 한 번 수정한다. 웹 브라우저와 패키징한 Tauri 창 모두에서 그 변경을 확인하고, 양쪽 Vite 모듈 그래프가 동일한 앱 파일을 가리키는지 검사한다. `prepare`를 반복해도 앱 소스·권한이 보존되고 예전 러너 폴더가 생성되지 않아야 한다. |
| 웹 독립 빌드 | Tauri CLI·Rust·Cargo 매니페스트·호스트 Rust 파일이 없는 외부 앱에서 공급된 SDK로 `dev/build/run --target web` 성공. 일반 정적 웹은 서비스 워커 없이 동작한다. PWA는 `/`와 `/demo/`에서 설치·오프라인 재시작·갱신에 성공하고 손상된 백엔드 Wasm 갱신은 마지막 정상 버전을 보존한다. 실제 Wasm 호출 결과와 자산 응답의 MIME·바이트를 확인한다. |
| Windows Tauri | 웹 빌드를 선행하지 않고 Demo·Testbed를 빌드한다. EXE/NSIS 생성, WebView2 오프라인 첫 실행, Rust `describe` 응답, 창 제목, 각 앱의 클립보드 권한을 확인한다. WebView가 읽은 JS·CanvasKit 해시와 `frontendBuildId`가 Tauri 전용 입력과 일치하고 백엔드 Wasm 요청과 서비스 워커 등록은 0건이어야 한다. |
| Android Tauri | x64 에뮬레이터와 arm64 기기용 빌드를 구분한다. Demo에서 여백 최초 값·회전·키보드·복귀, 한글 선택·복사·붙여넣기, 개발 HMR 후 구독 수를 확인한다. 새 식별자의 생성 앱에서도 여백 플러그인이 로드돼야 한다. APK/AAB 생성, 기기 실행, 배포 서명은 각각 실제 결과를 기록한다. |
| Linux·macOS·iOS | 기존 플랫폼·아키텍처 매핑으로 Linux 바이너리/deb, macOS app/dmg, iOS 시뮬레이터 app 또는 기기용 IPA를 해당 환경에서 확인한다. 빌드, 설치·실행, IPC, 서명·공증의 결과를 따로 기록하고 미실행 환경은 미검증으로 남긴다. [현재 매핑](Nelyx/sdk/tooling/cli/src/tauri-platforms.mjs) |
| 오류·회귀 | 다른 앱·타깃의 프런트엔드, 누락·변조된 자산, 맞지 않는 백엔드 프로토콜로 패키징 또는 부팅이 실패해야 한다. 패키징 실패 뒤 마지막 정상 출력으로 실행할 수 있어야 한다. Material/Cupertino, 한글 IME, 선택 메뉴, 스크롤을 두 타깃에서 확인하고 웹 콜드 스타트와 스크롤 중 IPC 횟수를 기존 빌드와 비교한다. |
