# Nelyx 디바이스 API의 Tauri 플러그인·web-sys 바인딩 계획

2026-11-24 · 기준 브랜치 `tauri-backend` · 기준 커밋 `7cb6ab32` · **설계 검토 완료, 구현 예정**

## 1. 적용 결정

**첫 이관 대상은 클립보드와 햅틱이다.** 앱은 지금처럼 `Clipboard`, `HapticFeedback`과 위젯을 사용한다. 웹·PWA에서는 이미 로드하는 앱 백엔드 Wasm에 `web-sys` 바인딩을 추가한다. 설치 앱에서는 생성된 Tauri 호스트가 해당 창과 OS에 허용한 공식 플러그인을 호출한다. 뒤이어 Android 뒤로 가기를 Tauri 코어 이벤트에 연결한다. [현재 백엔드 구조](work.md) · [Tauri 공식 플러그인과 플랫폼 지원표](https://v2.tauri.app/plugin/) · [wasm-bindgen의 web-sys 가이드](https://wasm-bindgen.github.io/wasm-bindgen/web-sys/index.html)

| Nelyx 기능 | 현재 코드에서 확인한 동작 | 적용 결정 |
| --- | --- | --- |
| 클립보드 읽기·쓰기·내용 유무 | Rust가 사전 조회 정책을 판정한다. 웹의 실제 I/O와 권한 변경 관찰은 TS가 맡는다. Tauri Demo는 이미 `clipboard-manager`의 텍스트 명령을 사용한다. | **1차.** 웹 I/O·권한 관찰을 `web-sys`로 옮기고 Tauri의 기존 읽기·쓰기 권한을 재사용한다. 모바일 플러그인이 지원하는 일반 텍스트는 현재 공개 계약과 일치한다. [공개 API](Nelyx/src/services/clipboard.ts) · [현재 바인딩](Nelyx/sdk/src/backends/browser/clipboard.ts) · [Tauri Clipboard](https://v2.tauri.app/plugin/clipboard/) |
| 햅틱 8종 | 두 타깃 모두 `navigator.vibrate?.(duration)`를 사용한다. 선택, 충격, 성공·경고·오류가 세기별 단일 진동으로 축약된다. Cupertino Picker와 Material Time Picker 등이 이 경로를 사용한다. | **1차.** 웹은 `Navigator::vibrate_with_duration`, Android·iOS 설치 앱은 선택적으로 `tauri-plugin-haptics`에 연결한다. [현재 호스트](Nelyx/sdk/src/backends/browser/platform-messages.ts) · [호출 8종](Nelyx/src/services/haptic-feedback.ts) · [Cupertino Picker](packages/cupertino/src/picker.ts) · [Tauri Haptics](https://v2.tauri.app/plugin/haptics/) |
| 뒤로 가기와 라우트 | `SystemNavigator.pop`은 브라우저 history를 사용한다. `setFrameworkHandlesBack`은 웹 호스트에서 조기 반환한다. Tauri도 DOM 프런트엔드에서 이 조건을 탄다. | **2차.** 일반 웹은 현재 history를 사용하고 Android는 Tauri 코어의 `onBackButtonPress`와 Nelyx의 `popRoute` 응답을 연결한다. [SystemNavigator](Nelyx/src/services/system-navigator.ts) · [라우트 수신 처리](Nelyx/src/services/binding.ts) · [Tauri 2.12.7의 Android back 계약](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-v2.12.7/packages/api/src/app.ts) |
| 화면 여백·키보드·시스템 바 스타일 | Android는 자체 플러그인이 시스템 바·컷아웃 여백을 물리 px로 보내고 SDK가 CSS px로 한 번 변환한다. 웹은 CSS 환경 변수와 시각 뷰포트를 사용한다. 스타일은 프레임 제출 후 별도로 요청하며 웹 판정에서 건너뛴다. | 여백은 기존 구독과 DOM 좌표 계산을 사용한다. 상태 바 색·아이콘 제어는 OS별로 적용할 수 있는 필드를 정의한 뒤 별도 모바일 어댑터로 검토한다. [Android 여백](Nelyx/backend/crates/tauri-plugin-nelyx-backend/android/src/main/java/dev/nelyx/backend/SafeAreaPlugin.kt) · [뷰 환경](Nelyx/sdk/src/backends/browser/environment.ts) · [스타일 호출부](Nelyx/src/framework/widgets/root.ts) |
| OS·언어·밝기·접근성·수명주기 | 네이티브 OS는 Rust `describe`에 있다. 언어 우선순위와 변경은 `navigator.languages`와 `languagechange`, 밝기와 접근성 설정은 `matchMedia`, 활성 상태는 문서 포커스·가시성으로 결정한다. | 기존 환경 스냅숏과 이벤트를 사용한다. OS 버전·아키텍처·OS 로캘이 필요한 앱에 한해 `os`를 검토한다. 앱의 언어 선택에는 브라우저가 제공한 선호 순서를 반영한다. [환경 계약](Nelyx/src/services/binding.ts) · [환경 관찰](Nelyx/sdk/src/backends/browser/platform-messages.ts) · [Tauri OS Information](https://v2.tauri.app/plugin/os-info/) |
| 시스템 사운드·텍스트 서비스·세션 복원 | 웹의 `SystemSound.play`는 무음이다. `ProcessText`와 철자 제안에는 채널이 있지만 브라우저 OS 호스트에 해당 핸들러가 없다. 복원 데이터는 뷰의 `sessionStorage`에 앱 키별로 최대 4 MiB를 쓴다. | 사운드·텍스트 서비스는 OS와 반환 형식이 맞는 구현을 찾을 때까지 기존 계약을 따른다. IME·자동 완성·접근성 트리·포인터·프레임은 DOM 소유로 둔다. 영구 설정용 Store는 별도 API로 다룬다. [시스템 채널](Nelyx/src/services/system-channels.ts) · [텍스트 액션](Nelyx/src/services/process-text.ts) · [철자 제안](Nelyx/src/services/spell-check.ts) · [DOM 서비스](Nelyx/sdk/src/backends/browser/services.ts) |

## 2. 바인딩을 넣을 위치

1. **공개 API와 메시지 계약.** `flutter/platform`의 기존 메서드명, 코덱, 응답 모양과 `Promise<void>`를 보존한다. 기본 경로는 위젯 → 앱의 `BinaryMessenger` → `PluginPlatformMessagePort` → `OsServiceHost`이다. `openApplication`이 `canvas.ownerDocument.defaultView`와 타깃별 `BackendConnection`을 사용해 클립보드·햅틱을 주입하도록 확장한다. 앱이 `platformMessages`를 직접 제공하면 그 포트가 소유한다. [앱 조립](Nelyx/sdk/src/frontend/dom/application.ts) · [OS 서비스](Nelyx/sdk/src/runtime/os-services.ts) · [백엔드 계약](Nelyx/sdk/src/backends/backend-contract.ts)
2. **Rust 코어와 호스트 I/O.** `nelyx-backend-core`에는 순수 클립보드 정책과 직렬화할 호스트 기능을 둔다. 앱 명령용 `Registry`의 핸들러는 동기식 `Fn(Value) -> BackendResult + Send + Sync`이다. 브라우저의 Window·Promise·이벤트 리스너는 `nelyx-backend-wasm`에서 뷰별로 소유한다. Tauri 쪽은 선택한 플러그인의 타입이 정해진 명령만 SDK의 네이티브 어댑터에서 호출한다. [Rust 코어](Nelyx/backend/crates/nelyx-backend-core/src/lib.rs) · [Wasm 내보내기 매크로](Nelyx/backend/crates/nelyx-backend-wasm/src/lib.rs) · [Tauri 어댑터](Nelyx/sdk/src/backends/tauri.ts)
3. **웹 Wasm 공급.** 현재 `export_backend!`의 내보내기는 `describe`, `invoke`, `clipboard_policy` 세 개다. 여기에 뷰를 받는 디바이스 바인딩을 더해 앱 Rust를 빌드하는 경로와 미리 빌드한 기본 Wasm이 같은 API를 제공하게 한다. `wasm32-unknown-unknown` 쪽에 저장소의 `wasm-bindgen 0.2.128`과 맞는 `web-sys 0.3.105`를 직접 선언한다. 1차 Cargo feature는 `Window`, `Navigator`, `Clipboard`, `Permissions`, `PermissionStatus`, `PermissionState`, `EventTarget`과 실제 콜백에 쓰는 타입으로 한정한다. 워크스페이스 잠금 파일에 있는 전이 의존성만으로는 웹 어댑터가 해당 API를 사용할 수 없다. [Wasm Cargo.toml](Nelyx/backend/crates/nelyx-backend-wasm/Cargo.toml) · [현재 잠금](Nelyx/backend/Cargo.lock) · [기본 Wasm](Nelyx/backend/default/src/lib.rs) · [web-sys 0.3.105](https://docs.rs/web-sys/0.3.105/web_sys/)
4. **타깃 선택과 뷰 수명.** `virtual:nelyx-backend`에서 웹은 Wasm, Tauri는 네이티브 IPC를 한 번 선택한다. Tauri에서 WebView 대체 경로를 쓰는 기능은 해당 뷰의 TS DOM 바인딩을 사용하므로 설치 앱 백엔드는 네이티브 한 벌로 배포한다. 현재 팝업은 `backend` 옵션 없이 `openApplication`을 호출한다. 웹 팝업에는 자식 Window로 바인딩한 Wasm 서비스를 제공하고, Tauri 팝업의 네이티브 권한은 자신의 WebView가 승인된 경우에만 연다. 종료·HMR·팝업 닫기에서 리스너를 해제하고 이전 뷰의 Promise 응답을 폐기한다. [Vite 타깃 선택](Nelyx/sdk/tooling/vite/src/config.mjs) · [팝업 조립](Nelyx/sdk/src/frontend/dom/dialog-windows.ts) · [포트 수명](Nelyx/sdk/src/runtime/plugin-port.ts)

### 2.1. wasm-bindgen과 tauri-specta 도입 판단

**웹은 이미 사용하는 `wasm-bindgen`의 생성 타입을 SDK 로더까지 연결한다. Tauri는 자체 플러그인의 `describe`와 `clipboard_policy` 두 명령부터 `tauri-specta`를 적용한다.** 전자는 Rust/Wasm 함수와 브라우저 JS 사이의 호출 경계를 만들고, 후자는 Rust 명령 선언에서 Tauri IPC용 TypeScript 호출 함수와 타입을 생성한다. [wasm-bindgen CLI](https://wasm-bindgen.github.io/wasm-bindgen/reference/cli.html) · [Tauri Specta v2](https://raw.githubusercontent.com/specta-rs/tauri-specta/v2.0.0-rc.29/src/lib.rs)

| 대상 | 현재 중복 또는 제약 | 구현 결정 |
| --- | --- | --- |
| 웹 모듈의 함수 서명 | 현재 고정한 `wasm-bindgen 0.2.128`과 같은 버전의 CLI가 `--target web`으로 `backend.js`와 `backend.d.ts`를 생성한다. SDK의 `web-wasm.ts`는 같은 서명을 `WasmModule`로 다시 선언한다. | 기본 Wasm에서 생성한 선언을 SDK 로더의 타입으로 사용하고 앱별 Wasm도 같은 공개 함수 계약을 만족하는지 검사한다. `describe()`의 생성 반환 타입은 `string`이므로 파싱한 값은 기존 `validateBackend`로 검사한다. 새 클립보드·햅틱 함수는 `web-sys`의 Window·Clipboard·Navigator를 사용한다. [Wasm 로더](Nelyx/sdk/src/backends/web-wasm.ts) · [생성 파일 목록](Nelyx/sdk/tooling/contracts/src/backend-supply.mjs) |
| Nelyx가 소유한 네이티브 IPC | `tauri.ts`에서 명령 이름과 `request<BackendDescription>`, `request<ClipboardPolicy>`의 결과 타입을 수기로 지정한다. Rust 필드나 인자명이 바뀌어도 이 TS 호출은 컴파일될 수 있다. | 두 명령에 `#[specta::specta]`, 입출력 타입에 `specta::Type` 파생을 적용하고 `plugin_name("nelyx-backend")`로 호출 함수를 생성한다. `ErrorHandlingMode::Throw`로 Promise 거부를 전달해 SDK가 오류와 종료 신호를 처리한다. 권한은 생성 호스트의 ACL과 Rust의 `allowed()`가 판단한다. [네이티브 호출부](Nelyx/sdk/src/backends/tauri.ts) · [플러그인 명령](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/lib.rs) · [Specta 빌더](https://raw.githubusercontent.com/specta-rs/tauri-specta/v2.0.0-rc.29/src/builder.rs) |

**버전 검토.** 2026-11-24에 현재 Nelyx 플러그인 소스와 `clipboard-manager 2.5.0`을 참조하는 임시 매니페스트에서 `cargo generate-lockfile`을 실행했다. Tauri `2.12.7`, `tauri-specta =2.0.0-rc.29`, `specta =2.0.0-rc.28`, `specta-typescript =0.0.15`가 각각 단일 버전으로 해석됐다. 이 조합은 생성 도구에 고정할 후보이며, 실제 바인딩 생성·컴파일과 WebView 호출은 구현 단계에서 검증한다. [rc.29 릴리스](https://github.com/specta-rs/tauri-specta/releases/tag/v2.0.0-rc.29) · [릴리스의 Cargo 의존성](https://raw.githubusercontent.com/specta-rs/tauri-specta/v2.0.0-rc.29/Cargo.toml)

- **생성 위치.** 현재 `build:sdk`는 TypeScript SDK를 먼저 빌드하고 Rust 공급본을 만든다. SDK 제작 시 두 생성기의 결과를 소스에 반영하고 CI에서 같은 입력으로 재생성해 차이를 검사한다. 이렇게 하면 깨끗한 체크아웃에서도 TS 빌드가 이전 `dist`에 의존하지 않는다. Specta는 SDK 생성용 Cargo feature에서만 켠다. 현재 플러그인 명령은 `R: Runtime` 제네릭이므로 생성 도구에는 구체적인 런타임 타입을 넘기고, 제품 플러그인은 기존 비동기 핸들러를 등록한다. 생성한 명령의 이름은 제품 핸들러와 권한 생성 목록에도 있어야 한다. [루트 빌드 순서](package.json) · [플러그인 권한 생성](Nelyx/backend/crates/tauri-plugin-nelyx-backend/build.rs) · [제네릭 명령 수집 규칙](https://raw.githubusercontent.com/specta-rs/tauri-specta/v2.0.0-rc.29/src/macros.rs)
- **적용 범위.** 생성된 네이티브 호출 함수가 import하는 `@tauri-apps/api/core`는 Tauri 전용 공급본에서 해석되도록 한다. 공식 Clipboard·Haptics에는 해당 플러그인의 명령 계약을 사용한다. 앱이 동적으로 등록하는 `invoke(command, Value)`는 앱에서 개별 입출력 스키마를 제공해야 명령별 타입을 생성할 수 있다. 화면 여백 구독은 Rust의 현재 `Channel`을 실제 페이로드에 맞는 `Channel<T>`로 명시하고 구독 해제까지 확인한 뒤 전환한다. [동적 앱 레지스트리](Nelyx/backend/crates/nelyx-backend-core/src/lib.rs) · [타깃별 번들 경계](Nelyx/sdk/tooling/vite/src/config.mjs) · [Specta의 TS 생성 코드](https://raw.githubusercontent.com/specta-rs/tauri-specta/v2.0.0-rc.29/src/lang/js_ts.rs)
- **채택 기준.** 고정한 버전으로 생성한 두 함수를 SDK에서 타입 검사하고, 실제 WebView에서 `describe`의 펼쳐진 필드·`null`, `clipboard_policy`의 열거값, 권한 거부 시 `PlatformException.code`가 기존 호출과 일치하는지 확인한다. 웹 번들의 Tauri 런타임 import는 0건이어야 한다. 이 조건을 통과하면 이후 Nelyx 자체 디바이스 명령에도 같은 생성 경로를 적용한다. [응답 검증과 오류 변환](Nelyx/sdk/src/backends/backend-contract.ts)

## 3. 클립보드·햅틱의 동작 계약

**클립보드.** `createClipboard`는 현재 세 번째 인수가 있으면 네이티브 호스트로 간주해 권한을 `granted`로 시작한다. Wasm 구현을 여기에 그대로 넘기면 브라우저의 사전 조회 정책이 달라진다. 호스트 종류와 실제 I/O 함수를 독립적으로 주입하고 기존 `clipboard_policy`를 재사용한다. [클립보드 구현](Nelyx/sdk/src/backends/browser/clipboard.ts) · [메시지 응답 형식](Nelyx/sdk/src/runtime/clipboard-service.ts)

- 명시적 복사·붙여넣기는 사용자 입력 처리 중 Wasm의 동기 진입점에서 `Clipboard::read_text` 또는 `write_text`를 **즉시 호출해 Promise를 얻고**, 결과만 비동기로 기다린다. 모듈 초기화와 권한 관찰은 뷰를 열 때 시작한다. 보안 컨텍스트와 해당 Window에서 메서드가 실제로 존재하는지 확인한다. [web-sys Clipboard](https://docs.rs/web-sys/0.3.105/web_sys/struct.Clipboard.html) · [W3C 클립보드 권한과 사용자 활성화](https://www.w3.org/TR/clipboard-apis/#permissions-api-integration)
- 메뉴의 `hasStrings`는 최신 권한을 확인한다. 모바일 메뉴는 권한 상태까지만 확인하고, 데스크톱 브라우저는 읽기 권한이 확인된 경우에만 내용을 미리 읽는다. `Permissions.query`가 해당 권한 이름을 인식하지 못하면 상태를 미확인으로 두고 사용자 붙여넣기 기회를 보존한다. 권한 변경은 리스너와 기존 revision을 통해 반영한다. [web-sys Permissions](https://docs.rs/web-sys/0.3.105/web_sys/struct.Permissions.html) · [PermissionStatus](https://docs.rs/web-sys/0.3.105/web_sys/struct.PermissionStatus.html)
- 빈 문자열은 정상 결과이고, 내용을 확인해 텍스트가 비어 있으면 `hasStrings`는 `false`다. 사전 조회에 필요한 권한은 `permission-required`, 실행 거부는 `permission-denied`, API 부재는 `unsupported`로 전달한다. 스냅숏은 기존 세 값 `available / permission-required / unavailable`을 사용한다. 현재 Tauri `request`는 문자열 오류를 먼저 `platform-error`로 감싸므로, 알려진 플러그인 권한·빈 내용 오류는 어댑터 경계에서 분류한 뒤 채널에 넘긴다. [오류 변환](Nelyx/sdk/src/backends/backend-contract.ts) · [Tauri 호출 경로](Nelyx/sdk/src/backends/tauri.ts)
- Tauri는 창 설정에서 `clipboard`를 생략한 경우에만 기존 WebView 클립보드를 선택한다. 명시적으로 끈 작업과 거절된 네이티브 요청은 해당 결과로 끝낸다. Demo의 양방향 허용, Testbed의 설정 생략, 읽기 전용·쓰기 전용·모두 끔을 각각 확인한다. [Demo 설정](sample/nelyx-demo-app/package.json) · [Testbed 설정](sample/nelyx-testbed-app-2/package.json)

**햅틱.** Android·iOS용 도입 후보는 `tauri-plugin-haptics 2.4.2`다. 이 버전의 Android 구현은 스타일별 진동 패턴을, iOS 구현은 충격·선택·알림용 시스템 생성기를 사용한다. 웹에서는 현재 위젯이 기대하는 밀리초 매핑을 보존한다. [고정 버전 IPC 명세](https://raw.githubusercontent.com/tauri-apps/plugins-workspace/haptics-v2.4.2/plugins/haptics/guest-js/bindings.ts) · [Android 구현](https://raw.githubusercontent.com/tauri-apps/plugins-workspace/haptics-v2.4.2/plugins/haptics/android/src/main/java/HapticsPlugin.kt) · [iOS 구현](https://raw.githubusercontent.com/tauri-apps/plugins-workspace/haptics-v2.4.2/plugins/haptics/ios/Sources/HapticsPlugin.swift)

| 기존 Nelyx 호출 | 허용된 Tauri 모바일 명령 | 웹의 요청 시간 |
| --- | --- | --- |
| `vibrate()` | `vibrate`에 50 ms 전달 | 50 ms |
| `lightImpact / mediumImpact / heavyImpact` | `impact_feedback`에 `light / medium / heavy` 전달 | 10 / 20 / 30 ms |
| `selectionClick` | `selection_feedback` | 10 ms |
| `successNotification / warningNotification / errorNotification` | `notification_feedback`에 `success / warning / error` 전달 | 20 / 20 / 30 ms |

창 설정에 선택적 `haptics`를 추가한다. 생략한 기존 앱은 WebView 동작을 이어가고, `false`는 해당 창에서 끄며, `true`는 지원하는 모바일 타깃에서 네이티브 경로 하나를 선택한다. 데스크톱에서 네이티브 햅틱을 요청하거나 웹에 진동 API가 없으면 위젯 호출은 기존처럼 조용히 끝난다. 실제 호출이 권한 오류로 실패하면 그 오류를 전달한다. 웹의 `vibrate` 반환값은 요청 처리 여부이며 촉감 확인은 실기기에서 한다. Demo는 이미 Android WebView의 기본 터치 햅틱을 끄므로 위젯 탭당 한 경로만 실행되는지 확인할 수 있다. [Navigator 바인딩](https://docs.rs/web-sys/0.3.105/web_sys/struct.Navigator.html#method.vibrate_with_duration) · [W3C Vibration](https://www.w3.org/TR/vibration/) · [Demo MainActivity](sample/nelyx-demo-app/platform/android/project/app/src/main/java/dev/nelyx/demo/tauri/MainActivity.kt)

## 4. Android 뒤로 가기

현재 Tauri 2.12.7은 리스너가 없으면 WebView 기록 또는 Android의 기본 back 동작을 수행한다. `onBackButtonPress`를 등록하면 이 결정을 앱이 맡고 이벤트에는 `canGoBack`가 들어온다. Nelyx의 `ServicesBinding`은 이미 `popRoute`를 관찰자에게 전달해 처리 여부를 반환한다. [Tauri Android 이벤트 구현](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-v2.12.7/crates/tauri/mobile/android/src/main/java/app/tauri/AppPlugin.kt) · [Nelyx 환경·라우트 바인딩](Nelyx/src/services/binding.ts)

- 창별 Android back 기능을 선언하고, 입력을 처리할 프레임워크 소유자가 있을 때만 리스너 하나를 등록한다. 마지막 소유자 해제나 뷰 종료 때 `unregister()`한다. 등록과 해제 권한을 함께 생성한다. [Tauri 코어 권한](https://raw.githubusercontent.com/tauri-apps/tauri/tauri-v2.12.7/crates/tauri/permissions/app/autogenerated/reference.md)
- `SystemNavigator.setFrameworkHandlesBack`의 웹 조기 반환은 해당 메신저의 호스트 기능을 보도록 좁힌다. 입력 한 건에 `popRoute`를 한 번 보내고, 처리되면 종료한다. 미처리이고 WebView 기록이 있으면 history를 한 번 되돌린다. 루트에서 미처리면 현재 입력을 Android 기본 동작으로 한 번 위임한다. 리스너 해제는 현재 입력을 재생하지 않으므로, 필요하면 SDK Android 어댑터에서 재진입을 막고 기본 back을 전달한다. [현재 조기 반환](Nelyx/src/services/system-navigator.ts) · [프레임워크의 플랫폼 판정](Nelyx/src/foundation/platform.ts)
- 일반 웹의 단일·다중 history, `popstate`, 앱 루트 URL 검사를 보존한다. Tauri의 이 이벤트로 확인할 수 있는 범위는 back 입력 완료 시점이다. 예측형 back의 시작·진행·취소를 제공하려면 해당 OS 이벤트와 `flutter/backgesture`를 별도로 연결해야 한다. [기존 history 처리](Nelyx/sdk/src/backends/browser/platform-messages.ts) · [예측형 back 이벤트](Nelyx/src/services/predictive-back-event.ts)

## 5. 추가 디바이스 API 후보

다음 기능은 현재 Nelyx 공개 디바이스 계약에 새로 추가할 후보들이다. 첫 확장 후보는 **전경 위치**다. 한 번 읽기와 관찰·해제를 양쪽 타깃에서 대응시킬 수 있어, 권한 및 구독 계약을 실제 앱 기능으로 검증할 수 있다.

| 기능 | Tauri 설치 앱 | 웹·PWA와 채택 조건 |
| --- | --- | --- |
| 전경 위치 | 공식 Geolocation은 Android·iOS용이다. `getCurrentPosition`, `watchPosition`과 `clearWatch`를 묶고 Android 위치 권한과 iOS 사용 목적 문구를 준비한다. | `web_sys::Geolocation`을 사용한다. 한 번 조회·구독·취소, 거부·시간 초과·위치 획득 불가, 정확도와 타임스탬프 단위를 계약에 넣는다. 데스크톱 Tauri는 WebView 위치 제공과 권한 처리를 기종별로 확인한 경우에만 제공한다. [Tauri Geolocation](https://v2.tauri.app/plugin/geolocation/) · [web-sys Geolocation](https://docs.rs/web-sys/0.3.105/web_sys/struct.Geolocation.html) |
| 로컬 알림 | Notification의 권한 확인·요청과 즉시 표시를 후보로 둔다. Windows 인수는 설치 패키지로 수행한다. | `Notification`과 모바일의 서비스 워커 `show_notification`을 검토한다. 권한을 요청하는 동작, 로컬 표시, 원격 push 수신은 각각 별도 기능이다. [Tauri Notifications](https://v2.tauri.app/plugin/notification/) · [웹 알림 표준](https://notifications.spec.whatwg.org/) · [web-sys 서비스 워커](https://docs.rs/web-sys/0.3.105/web_sys/struct.ServiceWorkerRegistration.html) |
| 파일 선택·읽기 | Dialog로 사용자가 선택하고 File System으로 허용된 파일을 읽는다. 데스크톱 경로, Android `content://`, iOS 파일 URI를 처리한다. 모바일 폴더 선택에는 제한이 있다. | `HtmlInputElement`의 `FileList`와 `File`로 이름·크기·내용을 제공한다. 공통 결과는 선택 파일에 대한 핸들과 취소 상태로 정의한다. 파일 선택 UI와 앱의 Material·Cupertino 대화상자는 독립적이다. [Tauri Dialog](https://v2.tauri.app/plugin/dialog/) · [File System](https://v2.tauri.app/plugin/file-system/) · [Web File API](https://www.w3.org/TR/FileAPI/) |
| 외부 URL·딥링크·저장 | Opener는 외부 앱 열기, Deep Linking은 설치 앱으로 들어오는 URL, Store는 영구 키·값 저장에 대응한다. | 웹은 사용자 동작에 따른 링크 열기, 앱 시작 URL·History, 용도에 맞는 브라우저 저장소를 사용한다. 외부 URL의 허용 스킴, 내부 라우트, 탭별 복원과 영구 설정의 수명을 계약별로 정한다. [Opener](https://v2.tauri.app/plugin/opener/) · [Deep Linking](https://v2.tauri.app/plugin/deep-linking/) · [Store](https://v2.tauri.app/plugin/store/) |
| 카메라·바코드·NFC·생체 인증 | Barcode Scanner, NFC, Biometric은 각각 모바일 전용 작업을 제공한다. 범용 카메라·마이크 스트림은 별도의 기능이다. | 카메라 입력은 `MediaDevices`로 얻을 수 있지만 디코딩도 필요하다. 고정한 `web-sys` 타입 목록에는 `BarcodeDetector`·`NDEFReader`가 없다. WebAuthn의 자격증명 서명은 네이티브 로컬 생체 확인과 결과가 다르다. 개별 기능에 웹 구현과 지원 기종이 확인될 때 확장한다. [모바일 스캐너](https://v2.tauri.app/plugin/barcode-scanner/) · [NFC](https://v2.tauri.app/plugin/nfc/) · [Biometric](https://v2.tauri.app/plugin/biometric/) · [web-sys 타입 목록](https://docs.rs/web-sys/0.3.105/web_sys/) · [WebAuthn](https://www.w3.org/TR/webauthn-3/) |

배터리·센서·Bluetooth·공유는 웹 API 노출 여부와 Tauri 측 공급자·실기기 지원을 기능별로 조사한다. 공식 목록이 별도 커뮤니티 항목으로 안내하는 플러그인은 의존성 후보로 따로 평가한다. HTTP·WebSocket·SQL·Shell·Updater·전역 단축키 등도 해당 기능을 요청하는 앱에서 선택하며 기본 디바이스 번들에 자동으로 포함하지 않는다. [Tauri 공식 기능·커뮤니티 목록](https://v2.tauri.app/plugin/) · [web-sys Navigator](https://docs.rs/web-sys/0.3.105/web_sys/struct.Navigator.html)

## 6. 구현 순서와 완료 기준

- [ ] **1. 계약과 호환성.** `BackendConnection`에 선택적 뷰별 서비스 주입 지점을 추가한다. 제안하는 앱 설정은 `targets.tauri.windows[]`의 `haptics?: boolean`과 `androidBack?: boolean`이다. Rust `WindowFeatures`, `describe`와 TS 판독기는 생략·허용·명시적 끔과 OS 지원 여부를 일관되게 처리한다. 새 Wasm 내보내기와 호스트 설명을 요구하는 SDK는 Rust `PROTOCOL_VERSION`과 tooling의 `backendProtocol`을 함께 올린다. 기존 `nelyx.app/v4` 설정을 읽고 구버전 프런트엔드·호스트 혼합은 시작 단계에서 식별한다. [설정 검사](Nelyx/sdk/src/runtime/config.ts) · [공급 계약](Nelyx/sdk/tooling/contracts/src/backend-supply.mjs) · [호스트 응답 검사](Nelyx/sdk/src/backends/backend-contract.ts)
- [ ] **2. 웹 바인딩.** 2.1절의 생성 선언을 SDK 로더에 연결한 뒤 클립보드 I/O·권한 관찰·진동을 Wasm에 연결한다. 기존 Rust 정책을 초기화 후에도 사용하고 독립 DOM 임베딩에는 기존 기본값을 둔다. 뷰마다 종료할 때 `PermissionStatus` 리스너를 제거한 뒤 Rust 콜백을 해제한다. 기본 Wasm과 앱별 Wasm 양쪽에서 공개 API를 통해 같은 결과가 나와야 한다. [웹 어댑터](Nelyx/sdk/src/backends/web-wasm.ts) · [앱 Wasm 생성기](Nelyx/sdk/tooling/cli/src/backend-project.mjs) · [기본 공급본 생성](Nelyx/backend/eng/build-supply.mjs)
- [ ] **3. Tauri 플러그인과 권한 생성.** 설정을 읽어 모바일 전용 Cargo 의존성, 조건부 `.plugin(...)` 등록, 창별 capability, `describe`의 기능 정보를 함께 생성한다. 햅틱은 `haptics:` 아래 `allow-vibrate`, `allow-impact-feedback`, `allow-selection-feedback`, `allow-notification-feedback`를 부여한다. Android는 플러그인 매니페스트의 `VIBRATE` 병합도 확인한다. 클립보드는 읽기·쓰기를 각각 부여한다. 직접 플러그인 IPC에는 Tauri ACL이 적용되고 Nelyx 자체 명령에는 기존 창·앱 페이지 검사도 적용된다. 다중 WebView 창은 승인한 WebView 라벨만 대상으로 한다. 앱의 IPC 허용과 OS·브라우저의 실행 권한을 각각 확인하고, Android에서 `Webview::url()`을 조회하는 자체 명령은 비동기로 유지한다. [호스트 생성기](Nelyx/sdk/tooling/cli/src/tauri-host.mjs) · [자체 플러그인](Nelyx/backend/crates/tauri-plugin-nelyx-backend/src/lib.rs) · [Tauri capability](https://v2.tauri.app/reference/acl/capability/#webviews) · [햅틱 플러그인 매니페스트](https://raw.githubusercontent.com/tauri-apps/plugins-workspace/haptics-v2.4.2/plugins/haptics/android/src/main/AndroidManifest.xml)
  - [ ] `describe`·`clipboard_policy`의 Specta 호출 함수를 공급하고 2.1절의 타입·권한·번들 검사를 통과한다.
- [ ] **4. Android back 연결.** 4절의 소유자 등록·해제, 라우트 응답, 기본 동작 위임을 적용한다. 내부 라우트·모달·루트에서 버튼과 시스템 back 제스처를 각각 사용해 한 번의 입력으로 한 번만 이동하는지 확인한다. 일반 브라우저의 앞·뒤로 가기도 함께 확인한다.
- [ ] **5. 공급·샘플·문서.** SDK Cargo 잠금을 갱신하고 공급본을 다시 만든 뒤 Demo·Testbed의 영향받는 `backend/locks/<target>/Cargo.lock`을 갱신한다. Demo만 새 모바일 기능을 켜서 기존 위젯에서 확인하고, Testbed는 설정 생략 호환성을 확인한다. 스타터와 한·영 SDK/CLI 문서에 사용 예를 반영한다. 생성한 `.nelyx/` 디렉터리의 원본은 SDK 생성기와 앱 설정이다. [SDK 공급 절차](Nelyx/sdk/tooling/cli/README.ko.md) · [스타터](Nelyx/sdk/tooling/cli/templates/nelyx-app/package.json.template)

| 인수 환경 | 구현 후 확인할 결과 |
| --- | --- |
| 웹·PWA | 실제 버튼과 편집 메뉴로 일반 텍스트 왕복, 빈 값, 권한 거부·변경, 권한 조회 미지원, 사용자 활성화 유지, 모바일 메뉴 사전 읽기 0회를 확인한다. 팝업 종료와 HMR 후 중복 이벤트는 0건이어야 한다. Demo의 앱별 Wasm과 `create --target web --static --no-backend`의 기본 Wasm을 각각 자신의 릴리스 해시·SDK 프로토콜과 대조한다. 웹 프런트엔드와 Wasm Cargo 의존성에 Tauri 모듈이 섞이는지도 확인한다. [기존 웹 검사](Nelyx/eng/check-backend-web.mjs) · [스타터 생성 옵션](Nelyx/sdk/tooling/cli/README.ko.md) |
| Windows Tauri | Demo는 허용 작업 성공, Testbed는 네이티브 명령 미허용과 기존 WebView 대체 동작, 권한이 다른 창은 해당 권한만 행사해야 한다. 네이티브 IPC 실패 후 다른 경로로 재호출되지 않아야 한다. WebView가 읽은 빌드 ID와 패키지를 대조한다. [기존 Windows 검사](Nelyx/eng/check-tauri-windows.mjs) |
| Android·iOS Tauri | Android 에뮬레이터는 시작·IPC·권한·back·여백 회귀를 확인한다. Android ARM64 실기기와 iOS 실기기는 텍스트 왕복·모바일 사전 조회와 햅틱 유형별 촉감을 확인한다. OS 설정, 실행한 ABI·빌드, 호출 성공과 물리 관찰을 구분해 기록한다. iOS 빌드는 macOS/Xcode에서 수행한다. Linux·macOS 데스크톱 지원을 표시할 때도 각 호스트에서 텍스트 왕복과 폴백을 확인한다. [플랫폼별 빌드 절차](Nelyx/sdk/tooling/cli/README.ko.md) |

웹 바인딩 추가 비용은 같은 앱·브라우저 조건에서 기존 검사가 출력하는 `wasmBytes`와 `backendStartupMs`의 변경 전후 값으로 기록한다. 릴리스 프로토콜 검사와 함께 실제 위젯 경유 검증을 추가한다. 각 테스트의 제한 시간은 20분이다. 코어 정책 테스트 `cargo test --locked --manifest-path Nelyx/backend/Cargo.toml -p nelyx-backend-core`는 저장소의 20분 제한 실행기로 수행한다. [웹 검사](Nelyx/eng/check-backend-web.mjs) · [실행기](Nelyx/sdk/tooling/cli/src/commands.mjs) · [저장소 검증 지침](.github/copilot-instructions.md)

아래 명령은 SDK Cargo 잠금을 갱신한 뒤 저장소 루트에서 실행한다. Testbed에도 같은 공급·빌드 절차를 적용한다.

```powershell
npm.cmd run build:sdk
npm.cmd run prepare:sample -- --app sample/nelyx-demo-app
npm.cmd --prefix sample/nelyx-demo-app ci --workspaces=false
npm.cmd --prefix sample/nelyx-demo-app run prepare:web -- --update-lock
npm.cmd --prefix sample/nelyx-demo-app run prepare:tauri -- --platform windows --update-lock
npm.cmd --prefix sample/nelyx-demo-app run build:web
node Nelyx/eng/check-backend-web.mjs sample/nelyx-demo-app
npm.cmd --prefix sample/nelyx-demo-app run build:tauri -- --platform windows
node Nelyx/eng/check-tauri-windows.mjs sample/nelyx-demo-app
```
