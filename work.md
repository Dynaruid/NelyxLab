# Nelyx Rust 백엔드와 Web·Tauri 빌드 개편 계획

2026-11-23 · 기준 브랜치 `tauri-backend` · 기준 커밋 `ba26ba1a` · **PLANNED — 구현 전**

## 1. 결정

**앱 개발자가 편집하는 소스는 두 곳이다. `src/`에는 TypeScript 화면과 위젯을, `backend/src/`에는 Nelyx용 Rust 백엔드를 둔다.** 웹과 설치 앱의 UI는 `src/index.ts`에서 시작한다. 두 타깃에서 실행할 앱 로직은 `backend/src/lib.rs`에서 제공하고, 재사용할 서비스 계약과 타깃별 어댑터는 SDK의 `Nelyx/backend/`에서 공급한다.

Nelyx CLI가 빌드 시 앱 백엔드를 Cargo 경로 의존성으로 연결한다. `--target web`은 얇은 Wasm 바인딩과 앱 백엔드를 한 모듈로 컴파일한다. `--target tauri`는 내부 호스트 프로젝트를 생성해 Tauri CLI에 넘기고, Tauri가 같은 백엔드를 해당 OS용으로 컴파일·링크한다. 앱 개발자는 Tauri의 Rust 진입점이나 IPC 등록 코드를 관리할 필요가 없다.

이 구조에서 백엔드가 처음 맡을 기능은 **호스트 정보와 클립보드 기능 판정**이다. 실제로 두 타깃에서 같은 정책을 실행하고, 웹 권한과 네이티브 권한의 차이도 확인할 수 있다. 위젯 생성, 레이아웃, 포인터·IME 처리, 프레임 스케줄링과 CanvasKit 그리기는 화면을 소유한 브라우저 또는 WebView에서 처리한다. 따라서 스크롤 한 프레임을 그리는 데 네이티브 IPC 왕복이 필요하지 않다.

현재 사용자가 한 명이므로 **공개 규약은 한 번에 교체한다.** 앱 설정, CLI, 스타터, Demo, Testbed와 CI를 같은 전환에서 갱신하고 이전 설정 판독기와 빌드 별칭을 삭제한다. 두 타깃을 모두 배포할 때에는 Vite 프런트엔드 두 벌을 만든다. Tauri용 한 벌은 모든 네이티브 OS가 재사용한다. 웹 쪽에 추가되는 백엔드 Wasm의 크기와 초기화 시간은 첫 릴리스에서 측정한다.

## 2. 현재 코드에서 확인한 구조

| 위치 | 현재 동작 | 개편에 미치는 영향 |
| --- | --- | --- |
| [CLI 진입점](Nelyx/sdk/tooling/cli/src/main.mjs) · [Tauri 빌드](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs) | 현재 웹 빌드는 PWA를 만든다. `pack --platform`은 이 PWA를 검증해 `frontendDist`로 넘긴다. `hostPath(app)`은 `src-tauri`로 고정돼 있지만 호출부는 이미 `TAURI_APP_PATH`와 `TAURI_FRONTEND_PATH`를 따로 지정한다. | 이 호출부를 재사용해 Tauri에는 생성한 호스트 경로와 검증한 WebView 자산을 각각 넘길 수 있다. |
| [앱 설정](Nelyx/sdk/src/runtime/config.ts) · [Vite 러너](Nelyx/sdk/tooling/vite/src/runner.mjs) · [호스트 판별](Nelyx/sdk/src/platforms/web/environment.ts) | 공통 UI 진입점이 `nelyx.pwa.component`에 속한다. 러너 경로는 `web/runner`로 고정되고, 시작 시 `getWebDeployment()`가 `window.isTauri`를 읽어 호스트를 구분한다. | 공통 UI, 웹 설치 옵션, 빌드 시 선택한 백엔드를 각각 표현해야 한다. |
| [Demo의 앱 정의](sample/nelyx-demo-app/src/index.ts) · [러너 시작](sample/nelyx-demo-app/web/runner/main.ts) · [Demo 화면 조립](sample/nelyx-demo-app/web/runner/App.tsx) | 현재 HTML은 러너의 `main.ts`를 연다. 러너가 React 컴포넌트를 마운트하면 그 안에서 `virtual:nelyx-app`을 통해 `src/index.ts`의 `main()`을 호출한다. | 앱이 이미 공유하는 상태·위젯 생성 코드를 활용하고, 두 타깃 모두 HTML에서 같은 앱 모듈로 들어가게 한다. |
| [DOM 앱 조립](Nelyx/sdk/src/platforms/web/application.ts) · [플랫폼 메시지](Nelyx/sdk/src/backends/browser/platform-messages.ts) · [OS 서비스](Nelyx/sdk/src/runtime/os-services.ts) | `openApplication`이 CanvasKit과 플랫폼 서비스를 조립한다. 브라우저 모듈 안에서 `window.__TAURI__?.clipboardManager`와 `navigator.clipboard`를 선택한다. `OsServiceHost`와 `PluginPlatformMessagePort`가 이미 서비스 주입 지점을 제공한다. | 기존 메시지 코덱과 위젯 호출을 활용하고 호스트 접근만 어댑터로 옮길 수 있다. |
| [스타터의 Rust 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/lib.rs) · [Demo 호스트](sample/nelyx-demo-app/src-tauri/src/lib.rs) · [Testbed 호스트](sample/nelyx-testbed-app-2/src-tauri/src/lib.rs) | 세 곳에 `host_info`와 페이지 로드 처리가 복제돼 있다. Demo와 스타터는 네이티브 클립보드를 등록하고, Testbed의 설정에는 해당 플러그인과 권한이 없다. Android 여백 처리는 Demo의 Rust·Kotlin·TS에만 있다. | 공통 구현은 SDK로 올리고 각 앱의 권한과 OS별 기능 선택은 앱에 둔다. |
| [릴리스 검증](Nelyx/sdk/tooling/vite/src/release.mjs) · [패키징 CI](.github/workflows/pwa-tauri.yml) · [Windows WebView2 검사](Nelyx/eng/check-tauri-windows.mjs) | 현재 `runtime/canvaskit.wasm`은 렌더러다. CI는 PWA 한 벌을 전달하고 Windows 검사는 PWA 빌드 ID와 WebView2가 실제 읽은 자산 해시를 비교한다. | 새 백엔드 Wasm에 별도 위치와 식별자가 필요하다. 네이티브 패키지 검사의 기준 입력도 Tauri용 프런트엔드로 바뀐다. |

## 3. 소스 배치와 실행 경계

아래는 목표 배치다. SDK의 Rust 소스와 각 앱이 작성하는 Rust 소스는 서로 다른 Cargo 패키지다. `.nelyx/` 아래는 버전 관리하는 입력에서 다시 만들 수 있다.

```text
Nelyx/
  backend/
    Cargo.toml                         # 세 크레이트를 묶는 workspace
    Cargo.lock
    crates/
      nelyx-backend-core/              # 앱이 사용하는 Rust API, 공통 서비스와 오류
      nelyx-backend-wasm/              # WebAssembly 바인딩을 지원하는 SDK 어댑터
      tauri-plugin-nelyx-backend/      # Tauri 명령, 권한 정의, android/ 플러그인
    packages/
      rust/, wasm/, tauri/             # 공통 Rust API와 타깃별 SDK 공급본
  sdk/src/
    frontend/dom/                      # 브라우저와 WebView가 공유하는 화면·입력
    backends/                          # TS 서비스 계약과 web-wasm, tauri 어댑터
  sdk/tooling/                         # CLI, Vite, 설치 패키지와 릴리스 검증
  skia/                                # CanvasKit 빌드와 렌더러
sample/<app>/
  package.json, package-lock.json      # 앱 설정과 앱 자체의 npm 설치
  index.html, vite.config.ts, tsconfig.json
  src/                                 # 앱 프런트엔드 소스
    index.ts                           # Web과 Tauri WebView의 공용 앱 진입점
    app.ts, app-surface.tsx, style.css  # 위젯·상태, 앱별 화면 조립과 스타일
  backend/                             # 앱의 Nelyx Rust 라이브러리
    Cargo.toml                         # 앱 패키지 이름과 Rust 의존성
    src/lib.rs                         # 두 빌드가 직접 참조하는 앱 백엔드 진입점
    locks/web/Cargo.lock               # Wasm 바인딩을 포함한 최종 빌드의 잠금
    locks/tauri/Cargo.lock             # 네이티브 호스트를 포함한 최종 빌드의 잠금
  assets/
  platform/                            # 앱별 패키징 입력. 필요한 OS 설정·아이콘·모바일 파일
  .nelyx/
    sdk/rust/                          # 이 앱에 공급한 버전의 SDK Rust 소스
    wasm/host/                         # 생성한 cdylib 크레이트와 Wasm 진입점
    web/                               # 배포할 웹 자산과 컴파일된 백엔드 Wasm
    tauri/host/                        # 생성한 Cargo.toml, build.rs, src/, Tauri 설정, gen/
    tauri/frontend/                    # WebView에 포함할 Vite 결과
    tauri/<os>-<arch>/                 # 실행 파일과 플랫폼 패키지
```

### 두 소스 영역의 연결

- **프런트엔드**는 두 타깃 모두 `index.html → src/index.ts`로 들어간다. 기존 `main(state, options)`의 순수 생성 로직은 `src/app.ts`, Demo의 진단 콜백·렌더 옵션과 Testbed의 오류 표시는 `src/app-surface.tsx`로 옮긴다. UI는 SDK를 통해 백엔드를 호출한다. [현재 화면 조립](sample/nelyx-testbed-app-2/web/runner/App.tsx) · [Vite HTML 진입점](https://vite.dev/guide/#index-html-and-project-root)
- **앱 백엔드**는 일반 Rust 라이브러리다. 제안하는 진입점 `pub fn register(registry: &mut nelyx_backend_core::Registry)`에서 앱의 기능을 등록한다. 입력·결과·오류는 Nelyx 계약으로 선언한다. Tauri 핸들, IPC 명령 매크로와 wasm-bindgen 내보내기는 각 어댑터가 소유한다. 예를 들어 앱이 등록한 계산 함수를 UI에서 호출하면 양쪽 빌드가 같은 Rust 함수에 도달한다.
- **생성한 호스트**는 양쪽 모두 아래와 같이 앱 크레이트를 참조한다. CLI가 선택한 매니페스트의 실제 패키지 이름과 디렉터리 상대 경로를 넣는다. Cargo가 원래 위치의 소스를 컴파일하므로 앱의 기능 수정은 `backend/src/` 한 곳에서 끝난다. [Cargo 경로 의존성](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#specifying-path-dependencies)

```toml
# .nelyx/wasm/host/Cargo.toml 또는 .nelyx/tauri/host/Cargo.toml의 생성 예시
[dependencies.app_backend]
package = "nelyx-demo-backend"
path = "../../../backend"
```

### 타깃별 백엔드

| 빌드 타깃 | 실행 경로 | 외부 기능 접근 |
| --- | --- | --- |
| `web` | `src/index.ts` → SDK → Wasm 바인딩 → 앱 백엔드 | 브라우저 어댑터가 Clipboard·Permissions API를 호출하고 DOM이 CSS 여백을 읽는다. 정적 파일 서버로 배포할 수 있다. |
| `tauri` | 같은 UI → SDK → 허용된 IPC 명령 → 네이티브 프로세스에 링크된 앱 백엔드 | Tauri 플러그인과 모바일 OS API가 앱에 허용된 기능을 제공한다. Cargo는 Windows x64의 `x86_64-pc-windows-msvc`, Android arm64의 `aarch64-linux-android` 등 선택한 OS·CPU를 대상으로 컴파일한다. |

웹용 호스트는 `app_backend::register`를 연결한 `cdylib`를 `--target wasm32-unknown-unknown --lib`로 빌드하고 `wasm-bindgen --target web`으로 ES 모듈을 만든다. 네이티브 호스트에서는 SDK가 생성한 `src/lib.rs`가 같은 등록 함수를 Tauri 플러그인 초기화에 전달한다. 데스크톱의 `main.rs`, 모바일의 `tauri::mobile_entry_point`, 컨텍스트를 만드는 `build.rs`는 모두 `.nelyx/tauri/host/` 안에 있다. [Rust Wasm 타깃](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html) · [wasm-bindgen 배포 형식](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html) · [Tauri 플러그인](https://v2.tauri.app/develop/plugins/)

**확인한 범위.** Windows 임시 앱에서 위 두 Cargo 호스트가 같은 `backend/Cargo.toml`을 참조하도록 구성했다. Edge는 wasm-bindgen 0.2.128이 만든 모듈로 함수를 호출했고, Tauri CLI 2.12.6으로 `build --debug --no-bundle`한 실행 파일은 WebView2의 `invoke`로 같은 함수를 호출했다. 입력을 10으로 두고 **앱의 `backend/src/lib.rs` 한 줄만** 수정해 다시 빌드하자 양쪽 모두 21에서 22로 바뀌었다. 이 검사는 빌더 위임과 호출 경로를 확인했다. SDK 생성기, Demo·Testbed, 설치 패키지와 모바일 인수는 6~7절에 남아 있다.

### 첫 공통 기능

1. **백엔드 초기화.** Vite가 개발·릴리스 모두에서 `virtual:nelyx-backend`를 선택한 타깃의 진입점 하나에 연결한다. 웹은 Wasm을 로드하고 Tauri는 `plugin:nelyx-backend|describe`를 호출한다. 양쪽 Rust 구현이 반환한 `backendVersion`, `protocolVersion`, 실행 종류와 호스트 기능을 SDK가 확인한 뒤 마운트한다. 앱 버전은 별도 필드다. 필수 모듈 누락이나 프로토콜 불일치는 시작 오류에 기대값·실제값을 표시한다.
2. **클립보드.** 코어는 호스트 종류, 읽기·쓰기 API의 유무, 권한 상태를 받아 읽기·쓰기 가능 여부와 메뉴를 열 때 내용을 조회해도 되는지 결정한다. 같은 입력에는 Wasm과 네이티브 빌드가 같은 결과를 내야 한다. 웹 어댑터는 사용자 동작 시점에 `navigator.clipboard`를 호출한다. Tauri 어댑터는 앱이 허용한 클립보드 명령을 호출하고, 플러그인을 쓰지 않는 Testbed에서는 WebView의 Clipboard API를 사용 가능한 범위에서 제공한다. 명령 실행 시 권한 거부는 호출자에게 그대로 전달한다. 빈 클립보드, `permission-required`, `permission-denied`, `unsupported`를 구분한다. 모바일 메뉴의 사전 조회는 내용을 읽지 않고 권한 상태를 돌려준다. [기존 클립보드 계약](Nelyx/sdk/src/runtime/clipboard-service.ts)
3. **Android 화면 여백.** Demo의 `SafeAreaPlugin.kt`와 `watch_safe_area`를 SDK 모바일 플러그인으로 옮기고 Demo 패키지명에 묶인 등록을 제거한다. WebView별 구독으로 최초 값과 변경만 보내며, 어댑터가 물리 px을 CSS px로 한 번 변환한다. 웹과 네이티브 여백을 제공하지 않는 호스트는 CSS 여백을 사용한다. 캔버스 좌표 보정과 키보드의 시각 뷰포트 측정은 DOM에서 수행한다. [Kotlin 구현](sample/nelyx-demo-app/src-tauri/gen/android/app/src/main/java/dev/nelyx/demo/tauri/SafeAreaPlugin.kt) · [현재 단위 변환](sample/nelyx-demo-app/web/runner/android-safe-area.ts) · [SDK 여백 계약](Nelyx/sdk/src/backends/browser/environment.ts)

SDK는 선택된 어댑터를 `openApplication`에 주입하고, 동기식 환경 조회에는 마지막 기능 상태를 제공한다. 권한 변경과 여백은 이벤트로 갱신한다. 직접 제공한 `platformMessages`, 다중 뷰, HMR 종료는 기존 소유권·취소 경로에 연결한다. 뷰 종료 시 구독을 해제하고 이전 세대의 응답을 폐기한다. `getWebDeployment()`를 사용하던 선택 메뉴, 서비스 워커와 Demo의 OS별 설정도 새 타깃·호스트 정보를 읽게 한다. [앱 조립](Nelyx/sdk/src/platforms/web/application.ts) · [서비스 종료](Nelyx/sdk/src/runtime/plugin-port.ts) · [선택 메뉴](Nelyx/sdk/src/backends/browser/selection-context-menu.ts)

앱은 사용할 기능과 허용할 창·명령을 선언한다. Nelyx가 이 선언으로 내부 호스트의 플러그인 등록과 capability 파일을 생성한다. 앱 기능 등록 자체가 OS 권한을 부여하지 않도록 클립보드 등 권한이 필요한 호출은 각 Tauri 명령의 권한 검사를 거친다. 메인 WebView와 허용된 앱 페이지 범위, Demo·Testbed의 서로 다른 클립보드 권한, Android 개발 프록시와 데스크톱 창 제목 처리를 이관한다. [Demo 권한](sample/nelyx-demo-app/src-tauri/capabilities/main.json) · [Testbed 권한](sample/nelyx-testbed-app-2/src-tauri/capabilities/main.json) · [Tauri capability](https://v2.tauri.app/security/capabilities/)

## 4. 앱 설정과 빌드 결과

`nelyx.app/v4`에서 `appEntry`는 UI 진입점, `backend.manifest`는 앱의 Rust 라이브러리를 지정한다. 스타터와 두 샘플은 두 경로를 명시한다. `targets.web: {}`는 일반 정적 웹이며 PWA 설치 옵션은 `targets.web.pwa`에 둔다. `targets.tauri`만 선언해도 두 소스 영역에서 설치 앱을 빌드할 수 있다. 공통 식별에는 npm 패키지 이름·버전을 쓰고, 브라우저 설치 ID와 네이티브 번들 식별자는 각 타깃 설정에서 읽는다. 아래는 Demo의 설정 발췌다.

```json
{
  "schema": "nelyx.app/v4",
  "name": "NelyxDemoApp",
  "appEntry": "./src/index.ts",
  "backend": { "manifest": "./backend/Cargo.toml" },
  "targets": {
    "web": { "pwa": { "id": "/apps/nelyx-demo", "shortName": "Nelyx Demo", "themeColor": "#101827" } },
    "tauri": { "identifier": "dev.nelyx.demo.tauri" }
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
| `build --target web` | 앱 백엔드를 선언한 경우 Wasm 호스트를 컴파일한다. `.nelyx/web/`에 정적 HTML·JS·앱 자산, CanvasKit, `runtime/backend/`의 바인딩 JS와 앱 백엔드 Wasm을 게시한다. PWA를 설정한 앱에는 설치 manifest와 오프라인 서비스 워커를 추가한다. |
| `build --target tauri --platform <os>` | `.nelyx/tauri/frontend/`를 만들고 내부 호스트를 Tauri CLI에 전달한다. OS·CPU용 앱 백엔드가 링크된 결과를 `.nelyx/tauri/<os>-<arch>/`에 게시한다. WebView 자산에는 CanvasKit Wasm이 들어간다. |
| `build --target tauri --frontend-only` | CI가 앱 백엔드의 소스·계약 식별값을 읽어 Tauri UI 한 벌을 만든다. OS별 작업의 `pack --target tauri --platform <os> --frontend <dir>`가 이 결과, 일치하는 앱 소스와 잠금 파일, SDK 공급본으로 내부 호스트를 구성하고 빌드한다. 브라우저용 릴리스나 다른 앱 백엔드를 전달하면 게시 전에 실패한다. |

각 프런트엔드의 `build.json`은 앱 이름·버전, 타깃, 백엔드 종류·프로토콜, SDK 버전, 렌더러 프로필과 파일별 크기·SHA-256으로 `buildId`를 계산한다. 앱 백엔드의 소스·매니페스트·로컬 경로 의존성 해시를 포함하고 초기화 시 Rust가 반환한 식별값과 맞춘다. 타깃별 빌드에는 최종 Cargo 잠금, SDK 어댑터·템플릿, 도구 버전과 실제 컴파일 옵션도 반영한다. 네이티브 패키지에는 실제 내장한 `frontendBuildId`, Rust 타깃과 산출물 해시를 기록한다. Web과 Tauri에서 공유한 폰트·이미지·CanvasKit 해시와 렌더러의 `wireAbi`는 별도로 확인한다. [현재 릴리스 식별](Nelyx/sdk/tooling/vite/src/release.mjs) · [렌더러 공급 규약](Nelyx/sdk/providers/web.json)

### Nelyx CLI가 Tauri 빌더에 넘기는 입력

| 대상 | 수정할 동작 |
| --- | --- |
| 호스트 생성 | `prepare/dev/build/pack`이 같은 생성기를 사용한다. SDK 템플릿, 앱 백엔드의 Cargo 경로, 타깃 설정과 앱의 플랫폼 파일로 `.nelyx/tauri/host/`를 준비한다. 템플릿·설정이 바뀌면 생성 파일을 갱신하고 앱 Rust 구현만 바뀌면 기존 호스트에서 Cargo를 다시 실행한다. 생성과 패키징은 같은 입력을 잠근 상태로 진행하며, 실패해도 소스와 마지막 정상 배포본을 보존한다. [기존 템플릿](Nelyx/sdk/tooling/cli/templates/tauri/Cargo.toml) · [게시 잠금](Nelyx/sdk/tooling/cli/src/publication.mjs) |
| Tauri 호출 | 앱에 설치한 CLI를 앱 루트에서 실행한다. `TAURI_APP_PATH=<app>/.nelyx/tauri/host`, `TAURI_FRONTEND_PATH=<app>`으로 분리하고, 생성한 설정의 `frontendDist`는 호스트 기준 `../frontend`로 둔다. 외부 `--frontend` 입력은 검증한 경로로 덮어쓴다. Windows에서는 기존 경로 변환을 적용한다. 데스크톱은 `tauri build`, 모바일은 `tauri android build` 또는 `tauri ios build`로 넘긴다. [현재 빌더 호출](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs) · [Tauri CLI 2.12.6 경로 탐색](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-cli-v2.12.6/crates/tauri-cli/src/helpers/app_paths.rs) |
| 의존성 잠금 | 새 앱을 준비할 때 각 최종 호스트의 의존성 그래프로 `backend/locks/web/Cargo.lock`과 `backend/locks/tauri/Cargo.lock` 중 필요한 파일을 생성해 버전 관리한다. 빌드 시 해당 파일을 생성 호스트의 `Cargo.lock`으로 복원하고 `--locked`를 사용한다. 의존성 변경 시 준비 단계에서 명시적으로 갱신한다. 앱 라이브러리 자체의 잠금만으로는 Tauri·Wasm 어댑터 의존성까지 고정할 수 없다. |
| 설정과 모바일 | 앱의 타깃 선언·`platform/` 원본에서 식별자, 창, 아이콘, CSP, capability, 서명 설정 참조를 생성한다. Demo의 AndroidManifest·Gradle 사용자 설정과 `MainActivity`는 `platform/android/`에 이관해 내부 `host/gen/android/`에 적용한다. 같은 원칙으로 iOS 입력은 `host/gen/apple/`에 적용한다. Gradle의 `rootDirRel`, Xcode 스크립트와 IDE 재호출이 생성 호스트와 앱에 설치된 CLI를 찾는지 확인한다. [Android 설정](sample/nelyx-demo-app/src-tauri/gen/android/app/build.gradle.kts) · [Gradle 재호출](sample/nelyx-demo-app/src-tauri/gen/android/buildSrc/src/main/java/dev/nelyx/demo/tauri/kotlin/BuildTask.kt) · [Demo 액티비티](sample/nelyx-demo-app/src-tauri/gen/android/app/src/main/java/dev/nelyx/demo/tauri/MainActivity.kt) |

## 5. SDK 공급

- **SDK 공통 공급본** `@nelyx/backend-rust`에는 앱에서 참조할 `nelyx-backend-core` 소스·버전·라이선스를 담는다. `supply`가 검증한 소스를 `.nelyx/sdk/rust/crates/`에 게시한다. 앱의 `backend/Cargo.toml`은 여기의 코어를 참조하고, 각 내부 호스트가 같은 버전의 코어와 선택한 어댑터를 사용한다. 공급본의 Cargo 매니페스트는 저장소 밖에서도 모든 경로와 버전을 해석할 수 있어야 한다.
- **웹 공급본** `@nelyx/backend-wasm`에는 앱과 함께 빌드할 바인딩 소스, 맞는 wasm-bindgen CLI 버전, 타입 선언과 라이선스를 담는다. **앱 Rust를 작성한 웹 빌드**에는 Rust·`wasm32-unknown-unknown`·wasm-bindgen이 필요하며, 정적 배포 서버에는 완성된 파일만 올린다. 앱 전용 Rust가 없는 웹 앱에는 SDK 제작자가 미리 빌드한 기본 Wasm도 제공한다. `backend.manifest`가 있거나 관례 위치의 `backend/`가 존재하면 해당 앱 소스를 빌드하고, 매니페스트·도구 누락이나 컴파일 오류를 그대로 보고한다.
- **네이티브 공급본** `@nelyx/backend-tauri`에는 플러그인 소스·모바일 코드·권한 정의를 담는다. CLI가 소유한 호스트 템플릿과 조합하여 앱마다 빌드한다. SDK 제작자가 사용하는 저장소 경로, 전역 설치한 Tauri CLI, 이전 실행에서 생성한 호스트에 의존하지 않도록 외부 앱 설치로 검사한다.
- **앱 설치 위치**는 앱 루트 하나로 통합한다. 두 샘플은 저장소 루트 npm `workspaces`에서 빼고 자체 `package.json`과 잠금 파일로 관리한다. 이렇게 해야 새 checkout에서 루트 `npm ci`가 샘플용 SDK tarball을 먼저 요구하지 않는다. SDK 공급 후 각 앱에서 `npm.cmd ci --workspaces=false`를 실행하고 같은 루트의 `node_modules`와 설치 잠금을 검증한다. 루트의 샘플 스크립트와 CI도 이 앱 경로를 사용한다. [현재 workspace](package.json) · [현재 공급 위치](Nelyx/sdk/tooling/cli/src/supply-runner.mjs)
- **패키지 도구**는 `build:sdk`, `pack:sdk`, `supply`와 설치 검증을 연결한다. 선언한 타깃에 필요한 패키지를 공급하고 웹 전용 앱은 네이티브 패키지·Tauri CLI 설치 없이 동작하게 한다. 현재 TS sourcemap 검사를 Rust 패키지에 적용하면 생성 JS와 Wasm의 출처를 판정할 수 없다. Rust 소스·lock·빌드 도구·생성 파일 해시를 대응시켜 오래된 산출물을 거부한다. 최종 확인은 저장소 밖의 새 앱에서 제공된 tarball과 격리 설치한 러너로 한다. [패키지 제작](Nelyx/eng/prepare-sample.mjs) · [소스 입력 검사](Nelyx/eng/package-source-inputs.mjs) · [설치본 검증](Nelyx/sdk/tooling/contracts/src/installed-supply.cjs)

Nelyx 자체를 개발할 때는 아래 루트 명령이 변경된 SDK를 샘플에 공급한 뒤 앱에 설치한 CLI로 선택한 타깃을 빌드한다. 샘플의 `backend/src/`만 수정하면 기존 SDK 공급본을 재사용하고 앱 백엔드부터 다시 컴파일한다.

```powershell
npm.cmd run build:web -- --app sample/nelyx-demo-app
npm.cmd run build:tauri -- --app sample/nelyx-demo-app --platform windows
```

## 6. 구현 순서

- [ ] **1. 앱 백엔드 하나를 두 호스트에 연결한다.** SDK 코어·두 어댑터·등록 계약을 만들고 스타터용 `backend/src/lib.rs`에서 기능 하나를 제공한다. 두 호스트 생성기에서 Cargo 경로 의존성과 바인딩을 생성한다. 앱 함수 수정이 브라우저의 Wasm 호출과 WebView의 네이티브 IPC 결과에 모두 반영되는지 확인한다. 이어서 공통 클립보드 판정 입력 표를 실행하고 최종 웹 호스트의 `cargo tree --target wasm32-unknown-unknown`에 Tauri 의존성이 없는지 검사한다.
- [ ] **2. SDK를 독립적으로 공급한다.** 공통 소스와 타깃별 패키지를 루트 npm workspace, `build:sdk`, `pack:sdk`, `supply`에 등록한다. 저장소 밖에서 tarball만 설치한 앱의 백엔드를 두 타깃으로 빌드한다. 준비 단계의 잠금 파일 생성·복원, `--locked` 재빌드, 소스 변경 후 재공급, 앱 매니페스트 누락과 버전 불일치를 검사한다.
- [ ] **3. SDK와 호스트를 연결한다.** `startPwa`와 `definePwaConfig`에서 공용 마운트·자산 로딩을 꺼내고 PWA 설치·서비스 워커 처리를 웹 진입점에 둔다. Rust 정보 조회·클립보드 정책·Android 여백을 실제 채널과 연결한다. `@nelyx/sdk`의 exports, 렌더러 레지스트리와 생성기를 함께 고쳐 새 DOM 경로를 패키지에서 열 수 있게 한다. 브라우저 전용 번들에 Tauri 모듈이나 전역 참조가 들어가면 Vite가 실패하도록 검사한다. [현재 시작점](Nelyx/sdk/tooling/vite/src/client.mjs) · [레지스트리](Nelyx/sdk/src/runtime/providers.ts) · [생성기](Nelyx/eng/generate-providers.mjs) · [Vite 모듈 검사](Nelyx/sdk/tooling/vite/src/config.mjs)
- [ ] **4. CLI와 산출물 계약을 교체한다.** 4절의 내부 호스트 경로·생성·잠금·모바일 처리를 `doctor/prepare/dev/build/pack/run`에 적용한다. Vite는 `src/`와 UI 자산을, Nelyx CLI는 `backend/`와 SDK Rust 입력을 감시한다. Rust 변경은 웹에서 Wasm 재생성·페이지 재로드로, Tauri에서 재빌드·호스트 재시작으로 반영한다. 생성물의 변경은 감시 입력에서 제외한다. 웹의 하위 경로·MIME·PWA 캐시, 네이티브 게시 잠금·staging 정리·실행 중인 Windows 파일 보호를 확인한다. [서비스 워커](Nelyx/sdk/tooling/vite/src/service-worker.mjs)
- [ ] **5. 모든 소비자를 한 번에 전환한다.** Demo·Testbed·스타터에 UI `src/`와 Rust `backend/src/`를 마련하고 `web/runner`의 앱 코드를 UI 쪽으로 옮긴다. 기존 `src-tauri`에서 공용 명령·모바일 플러그인은 SDK로, 호스트 시작 코드는 생성 템플릿으로, 앱 식별자·서명·창 설정·권한·플랫폼 사용자 파일은 앱 설정과 `platform/`으로 이관한 뒤 예전 폴더를 제거한다. `create`·`supply`, tsconfig·잠금 파일, npm 스크립트와 한·영 README를 갱신한다. `nelyx.app/v2·v3` 판독과 PWA 전용 패키징 별칭을 정리한다. OS별 CI는 같은 리비전의 앱 백엔드와 잠금 파일, Tauri UI 및 SDK 공급본에서 호스트를 다시 생성한다.
- [ ] **6. 새 진입점으로 인수한다.** 아래 표를 Demo·Testbed와 필요한 외부 소비 앱에 적용한다. 소스와 의존성 검토 → 기능 단위 검사 → 패키지 빌드와 실행 순서로 진행한다. 각 검사는 저장소 규칙에 따라 제한 시간을 20분으로 두고 임시 프로필·소비 앱·staging은 실행 종료 시 정리한다. [저장소 지침](.github/copilot-instructions.md)

## 7. 완료 기준

| 대상 | 통과 조건 |
| --- | --- |
| 소스 소유권과 재생성 | 생성 앱과 두 샘플에서 `src/index.ts`의 화면 변경을 양쪽에서 확인한다. `backend/src/lib.rs`의 함수만 수정해 Wasm과 네이티브 IPC 결과가 함께 바뀌는지 확인하고, `cargo metadata`에서 두 빌드가 원래 앱 크레이트를 가리키는지 검사한다. 외부 소비 앱의 새 작업 디렉터리에서 SDK를 다시 공급하고 호스트를 재생성해도 앱 소스·권한·잠금과 결과가 일치해야 한다. |
| 웹 독립 빌드 | Tauri CLI·네이티브 호스트 없이 앱 Rust 소스로 `dev/build/run --target web`에 성공한다. 별도로 앱 Rust가 없는 웹 앱은 Rust 도구 없이 공급된 SDK 기본 Wasm으로 빌드한다. 일반 정적 웹과 PWA를 각각 실행한다. PWA는 `/`와 `/demo/`에서 설치·오프라인 재시작·갱신에 성공하고 손상된 백엔드 Wasm 갱신은 마지막 정상 버전을 보존한다. 실제 Wasm 호출 결과와 응답 MIME·바이트를 확인한다. |
| Windows Tauri | 웹 빌드를 선행하지 않고 생성 호스트에서 Demo·Testbed의 EXE/NSIS를 만든다. WebView2 오프라인 첫 실행, 앱 Rust 함수와 `describe` 응답, 창 제목, 앱별 클립보드 권한을 확인한다. WebView가 읽은 JS·CanvasKit 해시와 `frontendBuildId`가 Tauri 전용 입력과 일치하고 백엔드 Wasm 요청과 서비스 워커 등록은 0건이어야 한다. |
| Android Tauri | x64 에뮬레이터와 arm64 기기용 빌드를 구분한다. Demo에서 여백 최초 값·회전·키보드·복귀, 한글 선택·복사·붙여넣기, 개발 HMR 후 구독 수를 확인한다. 새 식별자의 생성 앱에서도 여백 플러그인이 로드돼야 한다. APK/AAB 생성, 기기 실행, 배포 서명은 각각 실제 결과를 기록한다. |
| Linux·macOS·iOS | 기존 플랫폼·아키텍처 매핑으로 Linux 바이너리/deb, macOS app/dmg, iOS 시뮬레이터 app 또는 기기용 IPA를 해당 환경에서 확인한다. 빌드, 설치·실행, IPC, 서명·공증의 결과를 따로 기록하고 미실행 환경은 미검증으로 남긴다. [현재 매핑](Nelyx/sdk/tooling/cli/src/tauri-platforms.mjs) |
| 오류·회귀 | 다른 앱·타깃의 프런트엔드, 누락·변조된 자산, 맞지 않는 백엔드 프로토콜로 패키징 또는 부팅이 실패해야 한다. 패키징 실패 뒤 마지막 정상 출력으로 실행할 수 있어야 한다. Material/Cupertino, 한글 IME, 선택 메뉴, 스크롤을 두 타깃에서 확인하고 웹 콜드 스타트와 스크롤 중 IPC 횟수를 기존 빌드와 비교한다. |
