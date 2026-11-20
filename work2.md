# Nelyx SDK에 Windows Tauri 실행 경로 추가

**2026-11-20 · 구현 및 검증 완료**

설치된 `@nelyx/cli`에서 `--target windows --host tauri`를 선택하면 앱의 기존 Web 화면을 WebView2 창으로 연다. 릴리스 빌드는 정적 Web 자산을 내장한 Windows x64 EXE 하나를 만들고, 개발 창은 같은 앱의 Metro 서버에 연결한다. Demo에서 SDK 경로를 먼저 검증한 뒤 Testbed와 저장소 밖의 새 Web 앱에서 재사용을 확인했다. [실행 결과](#5-실행-결과) · [초기 Demo 실험](work.md#4-실행-결과)

## 1. 호스트 선택과 프런트엔드 입력

| 기존 코드 | 설계 결정 |
| --- | --- |
| CLI는 Windows의 `doctor`·`prepare`·`build`·`run`·`pack`에서 `--host`를 호스트 이름으로 읽는다. `dev`의 `--host`는 Metro 바인딩 주소에도 쓰인다. [CLI 옵션과 디스패치](Nelyx/sdk/tooling/cli/src/main.mjs) | Windows에서 값이 `tauri`인 경우를 옵션 검사 전에 판별한다. Tauri 명령의 옵션은 별도로 정의하고, 기존 Windows 개발 명령의 루프백 주소는 기존 분기로 전달한다. |
| `readApplication(app, target)`은 `<app>/<target>/runner`와 그곳의 설치된 패키지를 읽는다. [앱 설정](Nelyx/sdk/tooling/cli/src/application.mjs) | CLI 결과는 `target: windows`, `host: tauri`로 표시한다. 앱과 렌더러는 `readApplication(app, 'web')`으로 읽고 `ganesh-webgl2`를 사용한다. Web 구성만 가진 앱도 이 경로를 선택할 수 있다. |
| Demo와 Testbed는 각자의 Web 러너에서 공용 `main()`과 `ApplicationSurface`를 연다. [Demo Web 화면](sample/nelyx-demo-app/web/runner/App.tsx) · [Testbed Web 화면](sample/nelyx-testbed-app-2/web/runner/App.tsx) | SDK CLI는 빌드와 실행을 담당하고, 앱의 `src-tauri/`는 창 설정·앱 식별자·아이콘·Rust 명령을 소유한다. 소비자용 호스트 초기 소스는 CLI 패키지에 포함한다. |

비교 기준은 SDK CLI에서 호스트를 생략했을 때 선택되는 RNW, `--host native`와 `--host native-hermes`, 샘플의 `run:windows`가 여는 direct Hermes, 그리고 브라우저 `dev:web`이다. Tauri에서도 기존 `nelyx.app/v2`의 `targets.web`과 앱 자산 선언을 사용한다. [CLI 가이드](Nelyx/sdk/tooling/cli/README.ko.md) · [Demo의 기본 Windows 진입점](sample/nelyx-demo-app/eng/run-windows.mjs) · [앱 스키마](Nelyx/sdk/src/runtime/config.ts)

## 2. 사용할 명령

Web 러너를 공급·설치하고 앱 루트에 `npm.cmd install --save-dev --save-exact @tauri-apps/cli@2.12.6`을 실행한다. Demo와 Testbed처럼 npm workspace에 포함된 앱은 저장소 루트에서 해당 workspace를 지정한다. 빌드 환경은 Windows x64, Rust `x86_64-pc-windows-msvc`, Visual Studio C++ 빌드 도구와 Windows SDK, WebView2 Evergreen을 사용한다. [Web 공급과 설치](Nelyx/sdk/tooling/cli/README.ko.md#공급과-설치) · [Tauri Windows 준비 사항](https://v2.tauri.app/start/prerequisites/#windows)

| 명령 | 계약 |
| --- | --- |
| `doctor` | Web 설정과 설치 상태, `src-tauri/`, 앱 루트의 Tauri CLI 버전, Rust/MSVC 및 WebView2를 점검한다. 빠진 준비 조건과 해당 경로를 알려준다. |
| `prepare` | Web 러너 설정을 준비한다. `src-tauri/`가 없으면 SDK 템플릿으로 처음 생성한다. 기존 `src-tauri/`가 있으면 파일과 설정을 검사한다. |
| `build` | 검증된 정적 자산을 네이티브 EXE에 내장하고 앱의 `.nelyx/tauri/windows-x64/nelyx-tauri.exe`에 게시한다. 결과에 실제 경로와 바이트 수를 포함한다. |
| `run` | 앱의 현재 EXE를 직접 실행해 종료를 기다린다. `--` 뒤의 실행 인자를 EXE에 전달한다. EXE가 없으면 해당 앱의 빌드 명령을 안내한다. |
| `dev [--port <port>]` | 앱의 `build.devUrl`을 사용해 Metro를 열고 준비가 확인된 뒤 Tauri 창을 시작한다. `--port`는 이 세션에 적용하며, 새 호스트 템플릿의 기본 주소는 `http://127.0.0.1:1420/`이다. |

설치한 `<app>/web/runner/`에서 실행할 명령이다.

```powershell
npx.cmd --no-install nelyx doctor --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx prepare --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx build --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx run --app ../.. --target windows --host tauri
npx.cmd --no-install nelyx dev --app ../.. --target windows --host tauri --port 1420
```

새 앱은 기존 `create --target web`, `supply --target web` 절차를 거친 뒤 이 명령으로 호스트를 붙인다. 배포에 사용하는 파일은 `build`가 게시한 EXE다. [앱 생성과 Web 공급](Nelyx/sdk/tooling/cli/README.ko.md)

## 3. 구현 순서

### 3.1 CLI 분기와 사전 점검

- [x] [CLI 진입점](Nelyx/sdk/tooling/cli/src/main.mjs)에 Windows Tauri 분기를 추가하고 `src/windows-tauri-runner.mjs`를 그 분기에서 로드한다. Tauri의 지원 동작과 옵션은 §2를 기준으로 한다. 다른 타깃과 `--host tauri`를 조합하거나, 이 호스트에 `pack`·Hermes·JSC·native-inputs 전용 옵션을 전달하면 파일을 쓰거나 자식을 시작하기 전에 명령 오류를 반환한다.
- [x] 기존 `nelyx.doctor/v3` 등 동작별 결과 형식에 호스트, 프런트엔드 타깃, 렌더링 프로필을 명시한다. `run`·`dev`는 기존 CLI의 종료 코드 전달 경로를 사용한다.
- [x] `doctor`는 설치된 Web 러너의 cohort와 로컬 공급, 앱 루트의 `@tauri-apps/cli` 선언 및 설치 버전, Rust x64 MSVC 타깃과 C++ 도구, WebView2 Evergreen 버전을 읽는다. `readApplication`은 러너용 설정을 쓸 수 있으므로 상태 보고에서는 설치 검사와 설정 읽기를 사용하고, 설정 생성은 `prepare`에서 수행한다. [Web 러너 설치 검사](Nelyx/sdk/tooling/metro/src/web-config.cjs) · [WebView2 설치 확인](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#detect-if-a-webview2-runtime-is-already-installed)

### 3.2 앱이 소유하는 Tauri 소스

- [x] `Nelyx/sdk/tooling/cli/templates/windows-tauri/`에 `Cargo.toml`, `Cargo.lock`, `build.rs`, `tauri.conf.json`, `capabilities/main.json`, `src/main.rs`, `src/host-info.js`, 기본 ICO와 ignore 템플릿을 둔다. Demo에서 확인한 Tauri CLI `2.12.6`, Rust `tauri = 2.12.7`, `tauri-build = 2.7.6`을 초기 고정값으로 사용한다. 빌드와 개발에서 Cargo `--locked`를 적용한다. [Demo crate](sample/nelyx-demo-app/src-tauri/Cargo.toml) · [CLI의 npm 포함 파일](Nelyx/sdk/tooling/cli/package.json)
- [x] 새 호스트의 이름은 앱의 `displayName` 또는 `name`에서, 기본 식별자는 `dev.nelyx.<소문자 앱 이름>.tauri`로 생성한다. 앱별 표시 버전은 Tauri 설정에 기록하고 템플릿 crate 이름·의존성 정보와 `Cargo.lock`은 서로 일치시킨다. 기본 ICO는 `src-tauri` 안에 두며 Demo는 기존 식별자·제목·아이콘을 사용한다. 새 호스트는 검증한 임시 디렉터리에서 준비한 뒤 게시한다. 이미 있는 호스트를 다시 준비할 때는 편집된 파일의 내용이 보존되는지 확인한다.
- [x] Rust는 메인 WebView의 `Finished` 이벤트와 실제 origin을 확인해 `host_info` 호출 스크립트를 실행한다. Rust 응답은 `{ version, os }`이며, 스크립트는 각 앱의 표시 이름과 응답으로 실제 창 제목을 설정한다. 표준 권한은 `allow-host-info`와 `core:window:allow-set-title`을 메인 창에 부여한다. 릴리스 origin과 CSP는 Demo의 `https://tauri.localhost/` 및 CanvasKit Blob·Wasm 조건을 사용한다. [Demo 창 설정](sample/nelyx-demo-app/src-tauri/tauri.conf.json) · [Rust 호출](sample/nelyx-demo-app/src-tauri/src/main.rs) · [Demo 권한](sample/nelyx-demo-app/src-tauri/capabilities/main.json)

### 3.3 Web 빌드 재사용과 EXE 게시

- [x] [Web 러너](Nelyx/sdk/tooling/cli/src/web-runner.mjs)에서 준비된 러너의 `build.mjs`에 명시 출력 디렉터리를 넘기는 코드를 공용화한다. 브라우저용 Web 빌드는 기존 Web 패키지 게시 흐름으로 이어진다. Tauri 빌드는 실행마다 빈 Web 작업 디렉터리를 사용한다.
- [x] 초기 Demo 런처의 검증을 SDK 쪽으로 옮긴다. `build.json`의 `nelyx.web-build/v1`, `development: false`, `ganesh-webgl2`, 파일 SHA-256과 CanvasKit JS/Wasm manifest를 확인한다. 매니페스트의 파일은 Web 작업 경로 안에서 해석한다. 설치된 Web 러너의 자산 검증으로 앱 폰트·이미지·notice를 검사하고 `licenses/`와 진입 파일을 확인한다. [SDK Tauri 러너](Nelyx/sdk/tooling/cli/src/windows-tauri-runner.mjs) · [Web 빌더](Nelyx/sdk/tooling/metro/src/web-build.mjs)
- [x] Cargo 캐시는 `%LOCALAPPDATA%\Nelyx\tauri\<정규화한 앱 절대 경로의 해시>\target`을 사용하고, Web 작업 디렉터리도 이 앱의 캐시 아래에 잠시 둔다. 앱 디렉터리 전체를 Metro가 감시하므로 외부 앱에서도 두 경로가 감시 루트 밖에 있는지 확인한다. 앱 루트를 기준으로 설치된 Tauri CLI를 해석하고, 자식에만 절대 `CARGO_TARGET_DIR`을 전달한다. [Metro 감시 루트](Nelyx/sdk/tooling/metro/src/web-config.cjs)
- [x] 앱 루트에서 `tauri build --no-bundle --target x86_64-pc-windows-msvc --config <JSON> -- --locked`를 실행한다. `build.frontendDist`는 `path.toNamespacedPath()`로 만든 Windows 확장 절대 경로를 사용한다. Demo에서 일반 드라이브 경로가 URL로 해석돼 자산이 빠진 사례를 확인했다. `tauri-build`의 `CodegenContext`가 정적 자산 경로 변경을 감지하도록 유지한다. [Tauri frontendDist](https://v2.tauri.app/reference/config/#frontenddist) · [고정 버전 codegen](https://github.com/tauri-apps/tauri/blob/tauri-build-v2.7.6/crates/tauri-build/src/codegen/context.rs)
- [x] 빌드 성공 뒤 Cargo 결과에서 앱 바이너리를 확인하고 x64 PE를 게시한다. 앱별 빌드 잠금으로 동일 앱의 동시 게시를 제어한다. 게시할 EXE는 목적지와 같은 디렉터리에서 준비해 최종 경로를 한 번에 교체한다. 컴파일 실패나 열린 EXE의 파일 잠금으로 교체에 실패하면 기존 실행본이 보존되는지 검증한다. 자식 종료 이후 `finally`에서 이번 Web 작업 경로와 게시 임시 파일을 삭제한다.

### 3.4 개발 창과 종료

- [x] 설치된 CLI의 Web `dev`를 별도 Node 자식으로 실행한다. `build.devUrl`과 선택적 `--port`에서 얻은 같은 루프백 URL을 자식 Metro와 Tauri에 넘긴다. `127.0.0.1` 또는 `localhost`의 HTTP 루트 주소를 사용한다.
- [x] 소유한 Web 자식의 stderr에서 `nelyx.dev.ready`를 읽고 URL과 러너 경로를 확인한다. `/__nelyx/status`의 앱·러너까지 일치하면 `tauri dev`를 시작한다. `--port`를 적용한 경우 Tauri 설정도 같은 URL로 덮어써 Rust의 origin 검사에 실제 값이 들어가게 한다. `--exit-on-panic`과 `--locked`를 붙인다. [준비 이벤트](Nelyx/sdk/tooling/cli/src/web-runner.mjs) · [Tauri dev 옵션](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.6/crates/tauri-cli/src/dev.rs)
- [x] [자식 프로세스 도구](Nelyx/sdk/tooling/cli/src/commands.mjs)의 완료 대기와 프로세스 트리 정리를 재사용한다. stderr 행 관측이 필요하면 선택 옵션으로 추가한다. Metro·Tauri 중 한쪽이 조기에 끝나거나 Ctrl+C가 오면 해당 세션의 자식들을 정리하고 완료를 기다린다. HMR `/hot`과 SSE `/__nelyx/events`는 기존 Web 러너에서 처리한다. [Web 새로고침](Nelyx/sdk/tooling/metro/src/web-refresh.cjs)

### 3.5 샘플 전환과 패키지 검증

- [x] 현재 SDK의 `npm pack` 산출물을 Demo의 Web 러너에 공급한다. 설치된 CLI로 먼저 빌드·실행하고 통과하면 기존 `build:tauri:windows`, `run:tauri:windows`, `dev:tauri:windows` 스크립트를 SDK 호출로 연결한다. Demo 전용 런처의 중복 동작을 걷어내고 README의 EXE 경로를 갱신한다.
- [x] Testbed의 기존 Web 러너에 같은 CLI를 공급하고 공용 템플릿으로 호스트를 준비한다. 앱별 제목·아이콘·로컬 자산과 ListView 내비게이션이 실제로 Testbed의 것인지 확인한다. Demo와 Testbed 개발 창을 동시에 열 때는 서로 다른 포트를 사용한다.
- [x] 저장소 밖의 빈 임시 작업공간에서 `create --target web`으로 앱을 만들고 현재 tarball을 공급한다. Web 러너와 앱 루트의 Tauri CLI 설치본에서 §2의 명령을 실행한다. CLI tarball에서 Rust 템플릿, `Cargo.lock`, 아이콘과 고지의 포함 여부를 확인하고, 코드와 실행 경로가 tarball 설치본을 가리키는지 확인한다. CLI와 두 샘플의 한·영 README에 준비 순서, 실행 명령과 실제 산출물을 적는다. [CLI 가이드](Nelyx/sdk/tooling/cli/README.ko.md) · [Demo 가이드](sample/nelyx-demo-app/README.ko.md) · [Testbed 가이드](sample/nelyx-testbed-app-2/README.ko.md)

## 4. 완료 판정

| 검증 | 통과 조건 |
| --- | --- |
| CLI 경로 | 설치된 CLI에서 Windows Tauri의 `doctor`·`prepare`·`build`·`run`·`dev`가 각 동작으로 연결된다. 유효하지 않은 옵션 조합은 시작 전에 명시적으로 실패한다. Windows 기본 및 RNW·direct Hermes 선택과 Web·네이티브 개발의 루프백 `--host` 처리도 확인한다. |
| 준비와 설치 | 새 Web 앱에서 준비를 두 번 해도 템플릿이 중복 생성되지 않는다. 앱에서 편집한 `src-tauri`가 보존된다. Web 러너·Tauri CLI·WebView2 누락은 각각 올바른 단계와 경로로 안내한다. 공백·한글이 있는 앱 경로에서도 빌드한다. |
| 독립 EXE | Demo와 Testbed의 EXE를 각각 빈 디렉터리에 옮겨 Metro를 끄고 실행한다. WebView2에서 실제 화면, WebGL2, 앱별 버전 제목을 확인한다. Playwright로 로드된 CanvasKit JS·Wasm과 폰트·이미지 응답의 경로·SHA-256을 확인한다. [WebView2 연결](https://playwright.dev/docs/webview2) |
| 입력과 기존 Web | PowerShell 가상 입력으로 Demo의 스크롤·`Filled favorite` 11회·텍스트·Tab·리사이즈 후 재클릭을 확인한다. Testbed의 ListView에서 스크롤과 행 선택을 확인하고 텍스트 화면에 입력한다. 두 앱의 브라우저 `dev:web`과 샘플 기본 `run:windows`도 회귀 검증에 포함한다. |
| 재빌드와 복구 | 첫 EXE에서 검증용 자산을 읽고 Rust 소스를 그대로 둔 정상 재빌드에서 검증용 자산이 사라지는지 확인한다. Cargo 실패·빌드 취소·실행 중 파일 잠금에서 기존 EXE의 해시가 유지되고 이번 Web 작업 경로가 정리된다. |
| 개발 세션 | 앱별 HMR 수정과 `POST /reload` 뒤 실제 갤러리와 창 제목을 확인한다. 포트 점유 시 기존 서버가 계속 응답한다. 창 닫기·Ctrl+C·Tauri 시작 실패 때 소유한 앱·Metro 트리가 종료되고 포트가 반환된다. |
| 소비자 설치본 | 저장소 밖의 앱이 같은 tarball로 준비·빌드·개발·실행되고 현재 EXE를 직접 열 수 있어야 한다. 최종 기록에 Demo·Testbed·외부 앱에서 확인한 명령, 실제 EXE 경로와 크기, WebView2 버전을 남긴다. |

자동 검증은 항목당 20분 제한과 30회 이내 반복을 기본으로 한다. 검증용 브라우저 프로필·EXE 복사본·소비자 설치본은 실행별 임시 경로에 두고 `finally`에서 정리한다. 결과는 이 문서에 한 번 기록하고 미통과 항목은 `PARTIAL`과 다음 재개 단계로 남긴다. [저장소 검증 지침](.github/copilot-instructions.md)

## 5. 실행 결과

Windows x64에서 Node.js 24.15.0, Rust 1.95.0, Windows SDK 10.0.26100.0, WebView2 Evergreen **157.0.4341.60**으로 확인했다. Demo·Testbed·외부 앱의 Web 러너에 같은 `@nelyx/cli` 0.11.0 tarball을 설치했다. tarball의 SHA-256은 `aa742d7ce0edecc52fe4baf56a34280999d0d2c550f212a331c6ab65edbfe6f8`이다.

| 앱 | EXE 경로 | 바이트 | 실제 창 제목 |
| --- | --- | ---: | --- |
| Demo | `sample/nelyx-demo-app/.nelyx/tauri/windows-x64/nelyx-tauri.exe` | 29,467,136 | `Nelyx Demo · Tauri 0.1.0 (windows)` |
| Testbed | `sample/nelyx-testbed-app-2/.nelyx/tauri/windows-x64/nelyx-tauri.exe` | 26,453,504 | `Nelyx Testbed 2 · Tauri 0.1.0 (windows)` |
| 외부 Web 앱 | `C:\Users\parti\AppData\Local\Temp\nelyx-work2-oAwvwz\외부 앱 Work2\.nelyx\tauri\windows-x64\nelyx-tauri.exe` | 30,915,584 | `외부 Nelyx · Tauri 0.8.2 (windows)` |

두 샘플의 경로는 저장소 루트 기준이다. 외부 앱 경로는 검증 당시 경로이며 EXE와 설치본을 임시 작업공간과 함께 정리했다.

| 검증 | 결과 |
| --- | --- |
| CLI 분기 | 설치된 CLI에서 Tauri의 다섯 명령을 실행했다. 다른 타깃, `pack`, 엔진·native-inputs 옵션, 잘못된 포트, 일반 동작에 붙인 실행 인자를 시작 전에 거부했다. Windows 기본·RNW·`native`·`native-hermes` 선택과 Web·Windows 네이티브 `dev --host 127.0.0.1`도 확인했다. |
| 준비와 설치 | Web 러너 및 Tauri CLI 누락과 WebView2 레지스트리 조회가 비어 있는 경우의 진단을 확인했다. 새 앱의 `doctor`는 러너 설정을 쓰기 전 상태를 보존했다. 외부 앱에서 `prepare`를 두 번 실행해 편집한 호스트 스크립트가 보존되는지 확인했다. tarball에 Rust 템플릿, `Cargo.lock`, 권한 설정, ICO와 고지가 포함됐다. |
| 독립 실행과 자산 | Demo·Testbed·외부 앱의 EXE를 각각 빈 경로에 복사해 독립 실행했다. WebView2의 내장 HTTPS origin에서 화면, WebGL2, IPC 버전 제목을 확인했다. 두 샘플에서 Playwright로 실제 `application.js`, CanvasKit JS·Wasm, 앱 폰트와 로컬 WebP 응답의 SHA-256을 대조했다. 각 EXE의 아이콘은 해당 호스트의 설정 파일에서 지정한 ICO와 일치했다. `run -- --work2-probe "space value"`로 실행 인자 전달도 확인했다. |
| 입력과 회귀 | PowerShell 가상 입력으로 Demo의 스크롤, `Filled favorite` 11회 전환, 텍스트, Tab과 리사이즈 후 클릭을 확인했다. Testbed에서 ListView 스크롤과 행 선택, 텍스트 입력을 확인했다. 두 샘플의 Chrome `dev:web`이 동작했다. 두 샘플의 기본 `run:windows`도 각각 `NelyxHermesHost.exe`와 `NelyxRNHost.exe`를 열고 종료 코드 0을 반환했다. |
| 재빌드와 복구 | 첫 EXE에서 검증용 자산의 내용을 읽었다. Rust 소스를 그대로 둔 정상 재빌드에서는 해당 URL이 Tauri의 `index.html` 폴백을 반환했다. Cargo 컴파일 실패, 실행 중인 EXE의 게시 잠금, 빌드 중 Ctrl+C에서 정상 EXE의 SHA-256이 유지됐다. 동일 앱의 두 번째 빌드는 앱별 잠금에서 거부됐다. 자식 종료 뒤 이번 Web 작업 경로와 게시 임시 파일을 정리했다. |
| 개발 세션 | Demo 1420, Testbed 1421에서 개발 창을 동시에 열었다. 앱별 `/hot` 갱신과 `POST /reload` 후 갤러리 및 버전 제목을 확인했다. 창 닫기, Ctrl+C, Tauri 시작 실패에서 Metro 포트가 반환됐다. 포트 충돌 시 기존 서버가 계속 응답했다. |
| 외부 설치본 | 저장소 밖의 한글·공백 경로에서 기본 `create --target web`으로 생성한 앱에 같은 tarball을 공급했다. §2의 다섯 명령, 직접 EXE 실행, HMR 및 `POST /reload`를 확인했다. 일반 `build --target web`도 Web 패키지를 게시했다. |

두 샘플의 `doctor`와 `prepare`는 설치된 `web/runner/`에서 §2 명령으로 실행했다. Demo와 Testbed의 빌드 및 실행에는 저장소 루트의 `npm.cmd run build:tauri:windows --workspace <앱>`과 `npm.cmd run run:tauri:windows --workspace <앱>`도 사용했다. 개발 검증에서는 Demo에 `dev:tauri:windows` workspace 스크립트를, Testbed와 외부 앱에 설치된 CLI의 `dev`와 `--port`를 사용했다.

외부 기본 스타터에서 기존 애니메이션 API 호출로 첫 화면이 실패하는 문제를 확인했다. 스타터에서 현재 `AnimationController`와 위젯 ticker 수명주기를 사용하도록 고친 뒤 새 tarball로 기본 앱을 다시 생성해 확인했다. [스타터 소스](Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts)

### 사용자 직접 실행 소감

사용자는 Windows Tauri 호스트를 직접 실행해 조작했다. 기존 네이티브 Windows 실행 경로보다 화면 움직임이 훨씬 부드럽게 느껴졌으며, 체감상 120Hz에 가까웠다고 보고했다.
