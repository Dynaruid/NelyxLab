# Nelyx 웹·Tauri 핫 리로드와 빌드 속도 개선 계획

2026-11-25 · 핫 리로드 조사 `a30b5771` · 빌드 캐시 조사 `daba4751` · Vite `8.3.8` · **구현 계획**

웹의 `dev:web`과 네이티브 설치 앱의 `dev:tauri`는 같은 Vite 프런트엔드를 사용한다. 기본 샘플에서 CSS는 문서를 유지한 채 갱신되지만, 실제 화면을 그리는 `.ts` 위젯은 저장하면 문서 전체를 다시 연다. 따라서 화면이 자동으로 바뀌어도 현재 라우트, 텍스트 편집 상태, 스크롤 위치 같은 메모리 상태는 초기화된다. Rust 변경은 웹에서 Wasm 다시 빌드 후 문서 재시작, Tauri에서 네이티브 호스트 다시 빌드 후 프로세스 재기동으로 처리된다. [Vite 변경 분기](Nelyx/sdk/tooling/vite/src/config.mjs#L248) · [웹 Wasm 감시](Nelyx/sdk/tooling/cli/src/web-runner.mjs#L247) · [Tauri 개발 실행](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L479)

핫 리로드의 인수 기준은 저장 전의 `State` 인스턴스로 수정된 `build()`가 실행되고, 같은 화면에 변경 결과가 나타나는 것이다. 이를 두 개발 명령의 기본 위젯 작업에 제공한다. 적용 범위를 벗어난 변경은 사유와 함께 문서 또는 호스트를 재시작한다. Flutter도 기존 상태를 보존하는 위젯 재빌드와 초기화를 다시 거치는 재시작을 구분한다. [Flutter 핫 리로드](https://docs.flutter.dev/tools/hot-reload)

## 1. 현재 동작과 근거

| 변경 또는 실행 경로 | 브라우저 | Tauri WebView |
| --- | --- | --- |
| 기본 앱에서 import한 CSS | Vite CSS HMR 경로. 문서와 위젯 상태 유지 | HMR 소켓이 연결된 경우 같은 동작 |
| Demo·Testbed 화면 `.ts`, 엔트리·설정·자산 | 일반 위젯 수정은 `nelyx:reload`로 전달된다. 프런트엔드 종료를 기다린 뒤 문서를 재시작한다. HTML 변경은 Vite의 자체 문서 재시작도 발생할 수 있다. | 같은 프런트엔드 동작. UI만 바꾼 경우 Tauri 프로세스는 살아 있어도 WebView의 JS 상태는 초기화된다. |
| 앱이 별도로 추가한 React Fast Refresh | `vite:react-refresh` 플러그인이 있을 때 일부 앱 `.jsx`·`.tsx` 파일을 Vite에 넘긴다. 기본 샘플과 템플릿은 `defineAppConfig()`만 호출한다. | 같은 조건. React 컴포넌트의 상태 보존과 Nelyx 위젯의 상태 보존은 별도다. |
| 앱 Rust, 네이티브 프로젝트 입력 | 앱 크레이트가 있으면 Wasm 컴파일과 바인딩을 검증한 뒤 문서를 재시작한다. 기본 Wasm을 쓰는 정적 앱은 자체 Rust 감시 목록이 비어 있다. | Rust·`platform/` 입력 계약이 바뀌면 CLI가 호스트를 다시 생성하고 Tauri를 재기동한다. |
| `run:web`, `run:tauri` | 게시된 정적 웹 또는 PWA 실행 | 게시된 네이티브 산출물 실행 |

현재 소스와 Demo·Testbed 설치본의 Vite·CLI 구현을 대조했다. 실제 샘플은 기본 Vite 설정으로 동작한다. [기본 Demo Vite 설정](sample/nelyx-demo-app/vite.config.ts) · [Testbed Vite 설정](sample/nelyx-testbed-app-2/vite.config.ts) · [생성 앱 Vite 설정](Nelyx/sdk/tooling/cli/templates/nelyx-app/vite.config.ts)

코드 분석 뒤 Testbed의 `dev` 경로를 Chrome 158.0.8127.37과 Windows WebView2에서 실행했다. 두 환경에서 앱 경로에 임시 CSS·TypeScript 모듈을 두고 각각 한 번 저장했다. CSS 값이 바뀌면서 문서 `performance.timeOrigin`과 캔버스가 유지됐다. TypeScript는 새 문서·캔버스와 새 모듈 값을 확인했고 이전 문서의 메모리 표식이 사라졌다. Windows의 Tauri PID와 Vite 세션은 유지됐다. Chrome의 기본 설정 첫 시도는 12초 대기 한도에 걸렸고 SwiftShader 재시도에서 완료했다. 이 검사는 현재 변경 경로를 확인한 범위이며, 실제 위젯의 상태 보존과 오류 복구는 §5의 구현 인수 항목이다.

Android 개발 모드는 이전 x64 에뮬레이터에서 HMR 및 문서 재시작 뒤 구독 교체 기록이 있다. 이번에는 Android·Linux·macOS·iOS 실행 미검증이다. [이전 플랫폼 검증](history/26/11/20/work3-summary.md) · [Android 구독 검증](work.md#L192)

## 2. 위젯 상태가 초기화되는 원인

1. `frontendSession()`의 `hotUpdate`는 `.css`를 Vite에 맡긴다. 선택적인 React Fast Refresh 분기는 앱 엔트리를 제외한 `.jsx`·`.tsx`에만 적용된다. Demo의 `TextSelectionScreenState.build()`와 Testbed의 `GalleryState.build()`는 `.ts`에 있으므로 기본적으로 `nelyx:reload`를 받는다. [변경 판정](Nelyx/sdk/tooling/vite/src/config.mjs#L248) · [Demo 텍스트 위젯](sample/nelyx-demo-app/src/text-selection-screen.ts#L133) · [Testbed 갤러리](sample/nelyx-testbed-app-2/src/gallery.ts#L125)
2. `dev-client.mjs`는 `nelyx:reload`를 받으면 React 루트와 열린 애플리케이션을 정리하고 `location.reload()`를 호출한다. `ApplicationSurface`도 `definition`이나 `options`의 참조가 달라지면 현재 애플리케이션을 종료하고 새 캔버스를 연다. React Fast Refresh로 바깥 컴포넌트가 갱신돼도 이 경로에서 `FrameworkRoot`가 다시 만들어질 수 있다. [재시작 클라이언트](Nelyx/sdk/tooling/vite/src/dev-client.mjs#L5) · [DOM 루트 정리](Nelyx/sdk/src/frontend/dom/application.ts#L147) · [캔버스 수명](Nelyx/sdk/src/frontend/dom/surface.tsx#L24)
3. `FrameworkRoot`는 첫 프레임에 `createRoot()`로 `Element`를 만들고, 이후 프레임에서 기존 트리를 빌드한다. `Widget.canUpdate()`는 `typeToken`과 키를 비교하며 기본 토큰은 생성자다. Vite가 다시 평가한 클래스는 새 생성자를 얻는다. 기존 `State`가 호출하는 메서드도 이전 클래스에 연결되어 있어서, 모듈을 다시 가져오거나 트리만 다시 빌드하는 것으로는 동작 교체가 끝나지 않는다. 호환 변경에서는 기존 클래스와 `State`를 유지하며 실행할 `build()`만 교체하는 경로가 필요하다. [FrameworkRoot 빌드](Nelyx/src/framework/widgets/root.ts#L643) · [타입과 키 비교](Nelyx/src/framework/widgets/framework.ts#L59) · [State 소유권](Nelyx/src/framework/widgets/framework.ts#L2685)

## 3. 공통 프런트엔드 개선

### W5-01. 문서 재시작과 오류 복구

- Vite 플러그인에서 변경 묶음의 순번과 사유를 정한다. CSS는 현재 HMR로 보내고, 엔트리·HTML·호환되지 않는 UI 코드·자산 설정 변경과 수동 `POST /reload`는 프런트엔드 종료를 기다리는 경로로 모은다. 고정된 Vite 8.3.8은 `hotUpdate`가 `[]`를 반환해도 HTML 변경에 `full-reload`를 보낼 수 있다. 활성 개발 클라이언트에 전달되는 `full-reload`를 Nelyx 재시작 이벤트로 치환해 중복 탐색을 막는다. `vite:beforeFullReload`는 비동기 리스너를 기다리지만 리스너 실패를 새로고침 취소로 처리하지 않으므로, 실패 때 탐색을 멈춰야 하는 앱 재시작은 Nelyx 클라이언트가 결정한다. Vite 설정 변경과 소켓 재연결에는 라이브러리의 자동 탐색도 있으므로 현재 버전에서 전송 경로를 대조하고, 설정 변경 때는 Vite가 닫히기 전에 정리 요청을 전달할 수 있는 연결 지점을 검증한다. [현재 Vite 플러그인](Nelyx/sdk/tooling/vite/src/config.mjs#L198) · [Vite HMR 이벤트](https://vite.dev/guide/api-hmr.html#hot-on-event-cb)
- `package.json`과 자산 갱신은 다음 설정, 검증된 파일 집합, 가상 백엔드 모듈의 메타데이터를 함께 준비한 뒤 교체한다. 현재 코드는 설정 검사 중 실패하면 모든 개발 자산 요청에 `503`을 응답한다. 실패한 변경은 오류 오버레이로 알리고 마지막 정상 파일을 계속 제공한다. 다음 저장에서 복구할 수 있도록 새 설정에서 확인한 자산 경로의 생성·교체도 감시한다. Wasm 빌드도 현재의 성공 후 교체를 유지한다. [자산 서빙과 설정 갱신](Nelyx/sdk/tooling/vite/src/config.mjs#L221) · [Wasm 빌드 검증](Nelyx/sdk/tooling/cli/src/backend-project.mjs#L299)
- 연속 저장은 최신 정상 변경을 한 번 적용한다. 탭이나 WebView가 절전 또는 네트워크 변경 후 돌아오면 세션과 적용 순번을 대조해 누락된 변경을 복구한다. 호환성을 확인할 수 없으면 소유권 정리를 거친 문서 재시작으로 합류한다. 정리 중 오류는 화면과 CLI에서 사유를 표시하고, 해당 상태에서 개발자가 수동으로 재시작할 수 있게 한다. 이전 뷰의 워커·타이머·IPC 구독은 기존 소유권 정리 순서를 따른다. [DOM 런타임 종료](Nelyx/sdk/src/frontend/dom/application.ts#L147) · [SDK 종료](Nelyx/sdk/src/runtime/bootstrap.ts#L131)

### W5-02. 앱 위젯의 `build()`를 상태 보존 갱신에 연결

1. `@nelyx/vite`의 개발 플러그인에서 앱 소유 TypeScript를 분석한다. 첫 구현은 해석할 수 있는 `StatelessWidget` 및 `State` 클래스의 `build()` 본문 변경을 지원한다. 원본 모듈과 클래스에는 최초 로드부터 안정적인 호출 지점을 두고, 갱신 가능한 구현은 Vite의 개발용 가상 모듈에서 제공한다. ID는 앱 기준 모듈 경로와 클래스 선언으로 정한다. 교체 함수에는 기존 리시버와 인자를 전달하고, 기존 모듈의 import·헬퍼·상수 참조는 최초 로드 모듈을 통해 읽는다. 후보 구현을 가져올 때 원본 모듈의 최상위 실행과 클래스 생성은 반복하지 않는다. [Vite 모듈 갱신 경계](https://vite.dev/guide/api-hmr.html#hot-accept-cb) · [앱 엔트리](sample/nelyx-demo-app/src/index.ts)
2. 변경 전후 AST에서 지원하는 메서드 본문을 제외한 선언·import·export·상속·필드·초기화가 같고 새 본문의 자유 변수를 안전하게 연결할 수 있을 때만 교체한다. 텍스트·색·레이아웃과 `build()` 안에서 새로 만드는 콜백을 첫 지원 사례로 삼는다. 생성자·`createState()`·`initState()`·필드 구조·모듈 초기화가 달라지거나, 메서드의 `super`·JS `#private`처럼 현재 변환이 보장할 수 없는 동작이 생기면 문서 재시작을 사용한다. 파일 추가·삭제·이름 변경도 이 기준에 따른다. 함수 후보는 Vite가 컴파일한 모듈로 로드하며 문법·모듈 오류가 있으면 이전 구현을 계속 실행하고 다음 저장을 받는다.
3. 후보 모듈 전체를 준비한 뒤 같은 개발 세션의 최신 변경만 한 번 반영한다. 이미 마운트한 위젯은 교체된 함수로 빌드하며 기존 상태·컨트롤러를 사용한다. 변경으로 키나 자식 위젯 타입이 달라진 가지는 현재 reconciliation 규칙에 따라 교체된다. `ApplicationSurface`의 정상적인 설정 변경과 React 플러그인 옵션은 기존 계약대로 처리한다. SDK·디자인 패키지 소스는 `build:sdk`와 앱 공급·설치를 거쳐 검증된 패키지로 교체한다. 현재 워처의 `node_modules/@nelyx/*/dist` 감시는 저장소의 SDK 소스 편집을 직접 반영할 수 없다. [모듈 확인과 SDK 감시](Nelyx/sdk/tooling/vite/src/config.mjs#L72) · [재사용과 교체](Nelyx/src/framework/widgets/framework.ts#L2207) · [SDK 공급 절차](Nelyx/sdk/tooling/cli/README.ko.md#앱-생성과-공급)

### W5-03. 위젯 재빌드를 기존 프레임 순서에 연결

1. 앱 세션에서 살아 있는 `FrameworkRoot`가 개발 갱신을 받는 내부 진입점을 둔다. 업데이트는 프레임 사이에 적용한다. `Element.visitChildren()`과 기존 dirty·스케줄링 경로를 사용해 마운트된 트리를 다시 빌드하고, 이미 준비한 CPU 프레임과 선택적 준비 작업은 무효화한다. 기존 `build → layout → paint → semantics` 순서와 프레임 lease 반환을 지킨다. 화면 밖에 보관된 Element는 재진입 시 최신 구현을 쓰도록 검증한다. [프레임 빌드와 준비](Nelyx/src/framework/widgets/root.ts#L643) · [준비된 프레임의 제출 조건](Nelyx/src/framework/widgets/root.ts#L1726) · [ViewController 계약](Nelyx/src/hosting/runtime.ts#L142)
2. 재빌드에는 기존 `State`를 사용한다. 탐색·텍스트 컨트롤러와 포커스, 스크롤 컨트롤러, CanvasKit·렌더 워커, 현재 백엔드 연결은 기존 뷰의 소유권 아래에서 이어진다. 등록된 뷰가 여럿이면 살아 있는 뷰에만 최신 변경 순번을 적용한다. 대상 뷰가 열리는 중이거나 숨겨져 있으면 다음 유효 프레임에 반영하고, 종료된 뷰의 등록은 회수한다. 실제 실행 중 새 `build()`에서 오류가 나면 기존 빌드 오류 경로에 보고하고 정상 코드의 다음 저장 또는 제어된 재시작으로 복구한다. [Element 빌드와 오류 처리](Nelyx/src/framework/widgets/framework.ts#L2553) · [뷰의 종료 단계](Nelyx/src/hosting/runtime.ts#L1180)

## 4. Tauri 호스트와 전송 경로

### W5-04. Rust 수정 후 재기동과 WebView 접속 복구

- Tauri 워처는 Rust·잠금 파일·`platform/`의 앱 소유 입력을 추적한다. 파일이 없을 때도 부모를 통해 생성과 에디터의 원자적 저장을 감지하고, 변경 탐지 후 실제 계약 해시가 같은 입력은 건너뛴다. 현재는 새 Tauri 빌드가 오류로 끝나면 `dev`가 종료되어 Vite와 감시도 함께 닫힌다. 호스트를 담당하는 루프를 고쳐 빌드 실패 때 Vite·장치 연결·파일 감시를 유지하고 다음 수정으로 다시 빌드한다. 호스트 생성과 재기동은 한 작업씩 수행하고, 빌드 동안 추가 저장이 오면 최신 입력으로 수렴한다. 잠금 파일 오류는 해당 타깃의 `prepare --update-lock` 명령을 안내한다. [백엔드 워처](Nelyx/sdk/tooling/cli/src/backend-watch.mjs#L15) · [Tauri 입력 해시](Nelyx/sdk/tooling/cli/src/tauri-host.mjs#L53) · [현재 실패와 재기동](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L563)
- 프런트엔드 변경은 같은 프로세스에서 적용한다. Rust 또는 플랫폼 설정이 바뀌면 새 호스트가 일치하는 `describe` 응답을 줄 때 새 백엔드가 준비된 것으로 표시한다. 호스트 교체 동안에는 백엔드 갱신을 대기 상태로 표시하고 이전 연결과 새 빌드 식별자가 섞이지 않게 한다. 실패하면 빌드 오류와 대기 상태를 표시하고 다음 저장을 받는다. 웹 Wasm은 정상 바인딩·Wasm·식별자를 한 세대로 게시한 뒤 문서를 한 번 재시작한다. [가상 백엔드 모듈](Nelyx/sdk/tooling/vite/src/config.mjs#L139) · [Tauri 백엔드 연결](Nelyx/sdk/src/backends/tauri.ts#L29)
- 개발 준비 확인에 WebView의 Vite HMR 소켓 연결 여부를 포함한다. 현재 CLI의 `nelyx.dev.ready`와 `/__nelyx/status`는 Vite HTTP의 준비를 확인한다. Android는 선택한 시리얼과 CLI가 만든 `adb reverse`, 실제 WebView 소켓 주소를 함께 확인한다. iOS 시뮬레이터의 로컬 경로와 실기기의 신뢰된 HTTPS/WSS 경로를 실제 호스트에서 검증한다. 개발용 `connect-src`에는 해당 소켓 주소를 넣고, 종료 시 이 세션이 만든 reverse 매핑을 회수한다. [Vite 소켓 설정](Nelyx/sdk/tooling/cli/src/web-runner.mjs#L137) · [Tauri 상태 확인과 CSP](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L529) · [ADB 매핑](Nelyx/sdk/tooling/cli/src/tauri-platforms.mjs#L193) · [Tauri의 Vite 설정](https://v2.tauri.app/start/frontend/vite/)

## 5. 구현 순서와 완료 기준

- [ ] W5-01과 W5-04로 공통 재시작 및 백엔드 실패 복구를 정리한다. 현행 CSS, JS 문서 재시작, Rust 저장 시점의 이벤트와 종료 흐름을 먼저 소스에 대조한 뒤 같은 입력으로 확인한다.
- [ ] W5-02와 W5-03으로 Demo의 텍스트 선택 화면 및 Testbed의 갤러리부터 `build()`의 상태 보존 갱신을 연결한다. 기본 설정의 새 생성 앱에서도 같은 경로를 확인한다. [Demo 화면](sample/nelyx-demo-app/src/text-selection-screen.ts#L188) · [Testbed 화면](sample/nelyx-testbed-app-2/src/gallery.ts#L292) · [앱 생성](Nelyx/sdk/tooling/cli/README.ko.md#앱-생성과-공급)
- [ ] 아래 검사표를 실제 브라우저와 WebView에서 수행하고, 기존 렌더러·PWA·Tauri 릴리스 검사로 배포 경로를 확인한다. 환경이나 기기가 없는 항목은 해당 플랫폼의 실행 미검증으로 기록한다. [웹 렌더러 검사](Nelyx/eng/check-web-renderers.mjs) · [PWA 업데이트 검사](Nelyx/eng/check-pwa-update.mjs) · [Windows 설치본 검사](Nelyx/eng/check-tauri-windows.mjs)

| 저장 및 실행 시나리오 | 관찰할 결과 |
| --- | --- |
| CSS 1회, 위젯 `.ts`의 문구·레이아웃·인라인 콜백 변경 | CSS는 실제 스타일이 바뀐다. 위젯은 새 문구와 동작이 실제 캔버스·입력에서 확인된다. 두 경우 모두 문서 `performance.timeOrigin`, 뷰 소유자 ID·세대, Tauri PID가 같다. 위젯 편집 전후 `State` 객체, 열린 라우트, 입력한 한글과 선택 범위, 스크롤 위치를 비교한다. `State` 초기화 횟수와 텍스트·IPC 구독 수도 확인한다. |
| 지원하는 본문에 문법 오류 저장 후 수정, 여러 파일 또는 빠른 연속 저장 | 오류 동안 마지막 정상 화면과 편집 데이터를 유지한다. 정상 저장 후 최신 변경이 한 번 반영된다. 스타일과 코드가 함께 바뀌거나 앱이 백그라운드에서 돌아올 때도 최신 화면에 수렴한다. |
| HTML, 엔트리, 위젯 필드 구조, 자산 목록 변경 | 원인이 표시되고 문서가 한 번 재시작된다. 기존 루트·워커·구독의 종료 완료가 새 문서보다 앞선다. 자산 검증이 실패하면 기존 파일 제공을 유지하고 수정 후 정상 시작한다. |
| Rust 정상 수정 또는 빌드 오류로 저장 후 수정 | 웹은 성공한 Wasm의 `sourceId`와 새 IPC 결과를 확인한다. Tauri는 Vite 세션을 유지하며 새 PID·백엔드 `sourceId`와 새 호출 결과를 확인한다. 빌드 오류 동안 동일한 감시 세션으로 다음 수정을 받아 복구한다. |
| 렌더링과 플랫폼 | 브라우저 `direct`와 `worker-transfer`·`worker-shared`를 실제 선택된 경로에서 확인한다. Windows WebView2, Android x64 에뮬레이터와 ARM64 기기, Linux WebKitGTK, macOS WKWebView, iOS 시뮬레이터와 실기기는 실행 환경을 각각 기록한다. Android에서 역방향 매핑 소유권, 회전·복귀 후 여백 구독, 한글 입력 포커스를 확인한다. |
| 게시된 Web·PWA와 Tauri 패키지 | 배포 HTML·JS에 개발 클라이언트와 갱신 가상 모듈이 빠져 있고, PWA 오프라인 재실행과 Tauri 내장 프런트엔드가 정상 기동한다. |

기존에 공급·설치한 Demo 디렉터리에서 아래 명령을 플랫폼별로 실행한다. Testbed도 같은 스크립트를 사용한다. Android에서는 실행할 장치의 실제 시리얼과 ABI를 사용한다. macOS와 Linux에서는 `npm`을 사용한다. 브라우저 검사는 새 컨텍스트 또는 별도 개발 포트를 사용해 기존 PWA의 서비스 워커 영향을 피한다. 각 검사는 20분 제한을 적용하고, 자신이 띄운 프로세스·프로필·임시 파일은 종료 시 정리한다. [Demo 개발 명령](sample/nelyx-demo-app/README.ko.md#준비와-개발) · [플랫폼별 CLI 명령](Nelyx/sdk/tooling/cli/README.ko.md#tauri-빌드와-실행)

```powershell
Set-Location sample/nelyx-demo-app
npm.cmd run dev:web
npm.cmd run dev:tauri -- --platform windows
npm.cmd run dev:tauri -- --platform android --architecture x64 --device emulator-5554
```

## 6. 현재 빌드 캐시와 반복 작업

Cargo는 앱별 고정 경로에 빌드 결과를 남긴다. CLI는 내용이 같은 생성 파일의 쓰기를 건너뛴다. 저장소 루트의 `build:web`, `build:tauri`와 `deploy`에서 기존 npm 설치를 재사용하도록 바꿨다. 앱 화면만 바꿔도 SDK 전체 빌드, 패키지 압축과 잠금 파일 갱신은 실행되므로 이 중복 작업을 다음 단계에서 줄인다. [루트 빌드 실행기](Nelyx/eng/build-sample.mjs) · [배포 헬퍼](helpers/deploy-helper/deploy.mjs#L123) · [Cargo 캐시 경로](Nelyx/sdk/tooling/cli/src/backend-project.mjs#L191)

| 단계 | 현재 재사용 범위와 반복 비용 |
| --- | --- |
| TypeScript SDK | `build:sdk`가 Core·Cupertino·Material·Tooling Contracts·Skia Web·SDK를 순서대로 빌드한다. 각 패키지는 빈 staging에서 TS 7 타입 검사와 TS 6 `createProgram` 검사·emit을 거친다. 빌드 상태 파일과 패키지 단위 변경 판정이 없어 입력이 같아도 검사와 emit을 반복한다. [빌드 명령](package.json#L20) · [패키지 컴파일러](Nelyx/eng/build-packages.mjs#L129) |
| SDK 압축과 설치 | 앱 공급 아카이브는 내용 해시 이름을 쓰고, Rust 투영본이 현재 공급과 일치하면 교체를 생략한다. `prepareSample()`은 매번 SDK 패키지 전체를 임시 압축하고, 공급 시 `npm install --package-lock-only` 및 Rust 아카이브 풀기를 실행한다. 이어서 공개 잠금과 설치 기록, 설치된 패키지 버전 및 공급 해시를 대조한다. 유효하면 앱 설치를 건너뛰고, 갱신이 필요하면 `npm install --workspaces=false`를 실행한다. [SDK 압축](Nelyx/eng/prepare-sample.mjs#L35) · [공급과 npm 잠금 갱신](Nelyx/sdk/tooling/cli/src/supply-runner.mjs#L165) · [앱 설치 확인](Nelyx/eng/build-sample.mjs) · [Rust 투영](Nelyx/sdk/tooling/cli/src/rust-supply.mjs#L84) |
| Rust 및 Wasm | SDK는 `Nelyx/backend/.cache/cargo`를, 앱은 앱 경로별 Cargo `target`을 사용한다. 앱 Wasm 호스트와 Cargo.lock은 바이트가 같으면 유지한다. Cargo가 기존 컴파일 산출물을 사용해도 SDK 기본 Wasm과 앱 Wasm 모두 `wasm-bindgen`을 다시 실행한다. Rust SDK는 세 패키지의 `dist`도 다시 게시한다. 자체 백엔드가 없는 웹 앱은 SDK에 포함한 Wasm을 읽는다. [SDK Wasm 공급](Nelyx/backend/eng/build-supply.mjs#L70) · [생성 파일 쓰기](Nelyx/sdk/tooling/cli/src/backend-project.mjs#L28) · [앱 Wasm](Nelyx/sdk/tooling/cli/src/backend-project.mjs#L299) |
| Vite와 Tauri | `.nelyx/vite`는 개발 의존성 사전 번들 등을 재사용한다. 릴리스 빌드는 웹·Tauri 모두 새 staging에서 Vite 패키징과 파일 해시를 다시 계산한다. 이미 만든 Tauri 프런트엔드는 `pack:tauri -- --frontend <경로>`에서 검증한 뒤 여러 OS에 재사용할 수 있다. UI 변경으로 `buildId`가 바뀌면 새 ID와 자산을 포함하는 호스트 및 번들을 갱신해야 하며 Cargo는 앞단 의존성 산출물을 재사용할 수 있다. [Vite 설정](Nelyx/sdk/tooling/vite/src/config.mjs#L27) · [릴리스 빌드](Nelyx/sdk/tooling/vite/src/release.mjs#L156) · [Tauri 호스트 생성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs#L189) · [Vite 사전 번들 캐시](https://vite.dev/guide/dep-pre-bundling.html#caching) |
| Android Gradle | 생성된 Demo·Testbed의 `gradle.properties`는 `org.gradle.configuration-cache=true`를 설정한다. 프로젝트 설정에는 `org.gradle.caching`이 없고 생성된 `BuildTask.kt`에는 산출물 선언이 없어, 일반 태스크의 출력 재사용과 Rust 콜백의 실행 여부는 따로 확인해야 한다. Android 패키징은 Debug APK와 Release AAB를 각각 빌드하며 기기 설치에는 APK를 사용한다. `platform/android/` 입력 해시가 바뀌면 생성 프로젝트 전체를 다시 초기화한다. [생성 프로젝트 재사용 조건](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L143) · [Android 산출물 빌드](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L280) · [Gradle 설정 캐시](https://docs.gradle.org/current/userguide/configuration_cache.html) · [Gradle 빌드 캐시](https://docs.gradle.org/current/userguide/build_cache.html) |

코드 분석 뒤 Windows의 설치된 Testbed에서 앱 Wasm과 Web 릴리스 생성 단계만 같은 Node 프로세스로 두 번 실행했다. Cargo의 반복 실행에서 `compiler-artifact` 41개가 모두 `fresh`였다. 앱 Wasm 단계는 0.36초와 0.29초였고 바인딩을 매번 실행했다. 프런트엔드 생성과 검증은 2.66초와 1.70초였으며, Vite는 두 번 모두 1,099개 모듈을 변환했고 결과 `buildId`는 같았다. 루트 SDK·npm과 실제 네이티브 패키징 이득은 아래 기준선으로 측정한다. [Cargo 산출물 메시지](https://doc.rust-lang.org/cargo/reference/external-tools.html#artifact-messages)

## 7. 빌드 개선 순서와 완료 기준

W5-06의 앱 설치 경로와 설치 안내를 먼저 갱신했다. W5-05로 기준선을 잡은 뒤 W5-06에 남은 SDK 공급 재사용을 적용한다. W5-07의 Wasm 결과 재사용은 W5-01의 개발 갱신에, W5-08의 네이티브 생성 입력 판정은 W5-04의 재기동에 연결한다.

### W5-05. 단계별 시간과 재사용 여부 측정

- 현재 루트 `build:web`·`build:tauri`, 샘플 내부의 빌드 명령과 Android `deploy`에서 SDK 검사·emit, `npm pack`, 공급·의존성 설치, Cargo, `wasm-bindgen`, Vite, Gradle·OS 번들을 따로 잰다. 실행 시간과 함께 실제 실행한 검사·패키지 수, Cargo `compiler-artifact.fresh`, Gradle `UP-TO-DATE`·`FROM-CACHE`·설정 캐시 적중, 이전·현재 출력의 ID와 해시를 기록한다. 각 실행의 적중·재빌드 사유는 CLI에서 볼 수 있게 한다. [명령 실행기](Nelyx/sdk/tooling/cli/src/commands.mjs) · [현재 패키지 식별 자료](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L341)
- 콜드 1회와 같은 입력의 반복 3회를 동일한 앱·플랫폼·ABI·프로필·툴체인에서 비교한다. npm·Cargo·Gradle 다운로드 시간과 로컬 작업 시간을 따로 잰다. 사용자 작업 캐시는 보존하고 필요하면 단일 임시 검증 범위를 사용한다. 20분 검증 제한과 임시 출력 정리 규칙을 적용한다. 단계별 시간 절감과 전체 반복 빌드의 중앙값이 함께 개선됐을 때 속도 개선으로 기록한다. [저장소 검증 규칙](.github/copilot-instructions.md)

### W5-06. SDK 설치 재사용과 증분 공급

1. SDK 패키지의 TypeScript 프로젝트 입력과 실제 빌드 의존성으로 지문을 만든다. 소스 추가·삭제, 해석에 쓰는 의존 패키지의 선언·exports, TS 설정과 컴파일러 버전, 셰이더 입력, provider 정의 생성기를 포함한다. `dist`의 필수 파일과 목록·해시를 확인한 뒤 같은 패키지를 재사용한다. 바뀐 패키지와 그 변경으로 다시 검사가 필요한 소비 패키지만 기존 순서로 빌드한다. 셰이더와 provider 결과는 실제 출력 검증에 포함한다. 변경 패키지 안의 컴파일 비용이 여전히 크면 안정된 `tsBuildInfoFile`과 증분 컴파일러 API를 별도로 측정한다. 빈 staging에 전체 산출물이 필요한 현재 구조에서는 `.tsbuildinfo`만 설정하면 빠진 JS·선언이 생길 수 있으므로 출력 목록 검증과 함께 적용한다. [소스 맵 검사](Nelyx/eng/package-source-inputs.mjs#L15) · [셰이더 변환](Nelyx/eng/shader-assets.mjs#L32) · [provider 생성](Nelyx/eng/generate-providers.mjs#L203) · [TypeScript 증분 옵션](https://www.typescriptlang.org/tsconfig/incremental.html)
2. 압축 입력에는 실제 배포 파일, 패키지 메타데이터와 라이선스를 포함한다. 바뀐 패키지만 압축하고 `supplyRunner({ reuseCurrent: true })`로 현재 앱의 검증된 아카이브를 재사용한다. JS 패키지만 바뀌면 Rust 아카이브와 투영본을 대조해 반복 압축 해제도 줄인다. 공급이 바뀔 때만 앱 파일을 갱신해 Vite 사전 번들의 재실행을 줄인다. [아카이브 재사용 옵션](Nelyx/sdk/tooling/cli/src/supply-runner.mjs#L92) · [Rust 투영 확인](Nelyx/sdk/tooling/cli/src/rust-supply.mjs#L61)
3. 루트 빌드와 `deploy`는 SDK를 공급하는 앱 잠금 아래에서 설치를 확인한다. 공개·설치 잠금과 설치된 패키지가 일치하고 `assertInstalledSupply()`를 통과하면 재사용한다. 최초 설치나 서로 다른 공급본·설치 패키지 누락에는 `npm install`을 사용하며, `package-lock.json`으로 의존성 버전을 관리한다. CLI 복구 문구와 현재 설치 안내에도 같은 명령을 적용했다. 설치 기록에 드러나지 않는 개별 패키지 파일 손상의 검사와 해당 패키지만 복구하는 경로를 이어서 구현한다. [루트 설치 호출](Nelyx/eng/build-sample.mjs) · [설치 공급 검증](Nelyx/sdk/tooling/contracts/src/installed-supply.cjs#L8) · [스타터 안내](Nelyx/sdk/tooling/cli/templates/nelyx-app/README.ko.md) · [npm install의 잠금 처리](https://docs.npmjs.com/cli/v12/commands/npm-install/#how-npm-install-uses-package-lockjson)
4. 앱과 SDK의 빌드·공급 소유권 잠금을 사용하고 성공한 출력과 일치할 때만 최신 지문을 기록한다. 이미 게시한 정상 릴리스는 새 빌드가 검증을 통과한 뒤 교체한다. 상태는 현재 `dist`·공급·설치에 필요한 정보만 유지하고, 교체에 쓴 staging·백업은 작업이 끝나면 정리한다. [게시 잠금과 교체](Nelyx/sdk/tooling/cli/src/publication.mjs#L31) · [검증 출력 관리](.github/copilot-instructions.md)

Windows의 npm 12.2.3에서 임시 로컬 패키지를 사용해 같은 버전의 새 아카이브 설치와 변경 없는 패키지 재사용을 확인했다. 설치된 JS 파일 하나가 누락된 경우에는 해당 패키지를 다시 설치해 복구했다. 구현 후에는 임시 Testbed에서 루트 `build:web`이 최초 설치와 웹 릴리스를 완료했고, 이어서 루트 `build:tauri --frontend-only`가 기존 설치를 재사용해 프런트엔드를 만들었다. 두 번째 빌드 뒤 설치 잠금과 변경 없는 패키지의 표식이 그대로였으며 임시 앱과 빌드 캐시를 정리했다. [루트 빌드 실행기](Nelyx/eng/build-sample.mjs) · [저장소 설치 안내](README.ko.md)

### W5-07. Wasm 바인딩과 릴리스 프런트엔드 재사용

1. 앱 Wasm은 Cargo에 freshness 판단을 맡긴다. 결과 Wasm의 SHA-256, `wasm-bindgen` 버전·인자와 SDK 선언 계약이 같으면 검증된 바인딩과 런타임 파일을 재사용한다. 누락·손상됐거나 출력 Wasm이 바뀌면 바인딩과 선언을 다시 확인하고 한 묶음으로 게시한다. 앱별 최신 결과를 웹 개발 시작·재시작과 릴리스 빌드에서 함께 쓴다. SDK 기본 Wasm도 현재 Rust 입력·lock·도구·옵션과 공급 파일 검증이 일치하면 재사용하고, Rust 공급의 각 `dist`는 내용이 바뀐 경우에만 게시한다. [앱 Wasm 바인딩과 사후 검사](Nelyx/sdk/tooling/cli/src/backend-project.mjs#L299) · [기본 Wasm과 공급 검증](Nelyx/backend/eng/build-supply.mjs#L52) · [Cargo 프로필](https://doc.rust-lang.org/cargo/reference/profiles.html#incremental)
2. Tauri는 기존 `--frontend-only`와 `pack --frontend` 경로를 활용해 검증한 한 프런트엔드를 여러 OS에서 패키징한다. 자동으로 Vite 호출을 생략하는 것은 입력을 추적할 수 있는 기본 설정부터 적용한다. 앱 모듈·HTML·CSS·자산과 라이선스, Vite 설정·빌드 환경, 설치 공급본, CanvasKit·백엔드 계약을 포함한 입력 지문이 현재 출력에 대응해야 한다. 사용자 플러그인의 외부 입력을 파악할 수 없는 빌드는 Vite를 실행한다. 출력은 기존 `verifyFrontend()`의 파일 해시·`buildId`·타깃 검증을 통과해야 하며, Wasm·서비스 워커를 포함하는 Web과 Tauri의 프런트엔드 지문은 각 타깃에 둔다. [Tauri 프런트엔드와 팩 분리](Nelyx/sdk/tooling/cli/README.ko.md#tauri-빌드와-실행) · [릴리스 검증](Nelyx/sdk/tooling/vite/src/release.mjs#L274)
3. Vite가 실제로 실행되는 빌드에서는 로그용 gzip 크기 계산의 비용도 측정한다. `build.reportCompressedSize: false`에서 산출물 해시가 같고 시간이 줄면 기본 옵션에 반영한다. [Vite 압축 크기 보고 옵션](https://vite.dev/config/build-options.html#build-reportcompressedsize)

### W5-08. Android 설치 반복 비용과 네이티브 패키징 확인

- Android 기기 설치용 Debug APK만 빌드하는 옵션을 추가하고 `deploy`의 기기 설치 경로에 연결한다. 해당 ABI의 APK·서명 상태·빌드 식별자를 확인하고 정확히 그 APK를 설치한다. Debug APK 산출물은 배포 패키지와 별도 경로에 게시해 기존 Release AAB를 보존한다. 정식 `build:tauri`·`pack:tauri`는 현재의 APK·AAB 계약을 따른다. [빌드와 설치 호출](helpers/deploy-helper/deploy.mjs#L123) · [Tauri 패키지 메타데이터](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L341)
- Kotlin·Java·Android 리소스 태스크의 로컬 Gradle 출력 캐시 효과를 측정하고, `org.gradle.caching=true` 사용 여부를 결정한다. Rust 빌드의 판정은 Cargo에 맡긴다. CLI·앱 식별자·프로젝트 구조 변경으로 재생성이 필요한 경우와 앱 소유 오버레이만 바뀐 경우를 판별해, 후자는 바뀐 파일만 적용할 수 있는지 검증한다. 파일 삭제 시 생성 기본값을 복원하고, 캐시 적중 때도 딥링크 필터·권한·자산이 최종 APK에 들어있는지 확인한다. [오버레이와 Gradle 콜백](Nelyx/sdk/tooling/cli/src/tauri-host.mjs#L344) · [딥링크 필터 갱신](Nelyx/sdk/tooling/cli/src/tauri-device-host.mjs#L119) · [Gradle 출력 캐시](https://docs.gradle.org/current/userguide/build_cache.html#sec:task_output_caching)
- 같은 입력의 네이티브 패키징이 반복 비용으로 확인되면 현재 검증된 개발 패키지 재사용도 적용한다. `frontendBuildId`, 호스트·백엔드 입력, OS·ABI·프로필, 패키징 도구와 형식, 산출물 해시가 모두 맞는 경우로 제한한다. 새 서명이 필요한 빌드와 도구나 입력을 추적하기 어려운 빌드는 패키저를 실행한다. [Tauri 패키지 확인](Nelyx/sdk/tooling/cli/src/tauri-runner.mjs#L374)

| 재검증 입력 | 완료 조건 |
| --- | --- |
| 설치가 없는 앱, 같은 버전의 새 SDK와 설치 복구 | `npm install`로 최초 설치와 복구가 완료되고, 같은 버전의 새 SDK 코드가 실제로 실행된다. 영향받지 않은 설치 패키지는 재사용하고 복구에서 잠긴 의존성 해석을 확인한다. 루트 빌드·배포·복구와 활성 설치 안내가 모두 같은 명령을 사용한다. |
| 같은 입력으로 루트 Web·Windows 빌드를 재실행 | 검증된 SDK의 컴파일·압축·의존성 설치 호출은 0회다. 앱 Wasm 입력에서 Cargo 산출물은 fresh이며 bindgen은 0회다. Vite·패키징 재사용 여부와 걸린 시간은 실제 실행 수로 확인하고 같은 출력의 `buildId`·파일 해시를 대조한다. |
| 앱 UI만 편집한 뒤 Web과 Windows 빌드 | SDK 공급과 설치가 적중한다. 최신 화면을 포함한 프런트엔드 `buildId`를 얻는다. Windows 실행본은 그 ID를 보고하고 최신 자산을 렌더링한다. |
| 앱 Rust, Core 및 셰이더, 공급 잠금, 빌드 도구 또는 ABI를 변경 | 값이 달라진 단계와 의존 단계만 갱신한다. 같은 버전의 다른 SDK 아카이브도 교체된다. 삭제·손상된 산출물은 정상 재빌드로 복구된다. 동시 실행 또는 중단 뒤에도 게시된 정상 출력이 유지되고, 다음 빌드는 설치를 검증한 뒤 진행한다. |
| Android x64·arm64에서 Debug APK 빌드와 일반 패키징 | 기기용은 Release AAB 태스크가 0회이며 지정한 ABI의 새 APK를 설치한다. 일반 패키징은 APK와 AAB를 발행한다. 각 경우 실제 자산, 설정, 서명 상태와 딥링크를 검증한다. 다른 Tauri OS는 해당 도구에서 팩 및 실행 여부를 기록한다. |

SDK 설치가 이미 현재 소스와 일치할 때는 샘플 디렉터리의 기존 `npm.cmd run build:web`을 사용해 앱 빌드를 바로 실행할 수 있다. Tauri는 같은 위치에서 `npm.cmd run build:tauri -- --frontend-only`로 프런트엔드를 만든 뒤 `npm.cmd run pack:tauri -- --platform windows --frontend .nelyx/tauri/frontend`로 재사용한다. 위의 자동 건너뛰기와 APK 전용 옵션은 이 작업계획의 구현 항목이다. [샘플 스크립트](sample/nelyx-demo-app/package.json#L7) · [CLI 프런트엔드·팩 안내](Nelyx/sdk/tooling/cli/README.ko.md#tauri-빌드와-실행)
