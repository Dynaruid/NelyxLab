# Nelyx CLI

[English](README.md) | **한국어**

## 앱 생성과 공급

고정된 CanvasKit과 Rust Wasm 도구를 준비한 뒤 Nelyx 저장소에서 실행합니다.

```powershell
npm.cmd ci
npm.cmd run build:sdk
npm.cmd run pack:sdk -- C:/dev/nelyx-packages
node Nelyx/sdk/tooling/cli/src/main.mjs create C:/dev/MyApp --name MyApp --packages C:/dev/nelyx-packages
Set-Location C:/dev/MyApp
npm.cmd ci --workspaces=false
npx.cmd --no-install nelyx prepare --app . --target web
npm.cmd run typecheck
npx.cmd --no-install nelyx dev --app . --target web
```

`create`는 기본적으로 두 디자인 패키지와 두 타깃을 설정합니다. `--designs none`, `--designs material`, `--designs cupertino`로 필요한 디자인을 고릅니다. `--target web --static --no-backend`는 SDK 기본 Wasm을 쓰는 일반 정적 웹을 구성합니다. `--target tauri`는 설치 앱을 구성합니다. Linux와 macOS에서는 `npm`과 `npx`를 사용합니다.

SDK를 갱신할 때는 앱 루트에서 `nelyx supply --app . --packages C:/dev/nelyx-packages`와 `npm.cmd ci --workspaces=false`를 순서대로 실행합니다. 앱의 npm 잠금 파일과 `prepare`가 만드는 `backend/locks/<target>/Cargo.lock`을 버전 관리합니다. Cargo 의존성을 변경하면 영향을 받는 타깃마다 `prepare --update-lock`을 실행합니다. 빌드는 타깃의 잠금 파일을 복원해 Cargo에 `--locked`를 전달합니다.

## 웹 배포

```powershell
npx.cmd --no-install nelyx build --app . --target web
npx.cmd --no-install nelyx run --app . --target web --base /demo/
```

`run`에 `--port 0`을 넘기면 미리보기 서버가 빈 포트를 배정받습니다.

`.nelyx/web/` 전체를 배포합니다. 서버의 Wasm MIME은 `application/wasm`을 사용합니다. 앱 경로의 HTML fallback에는 배포 디렉터리를 base로 지정하고, 빠진 자산은 404로 응답합니다. `targets.web.pwa`가 있으면 설치 manifest와 서비스 워커가 포함됩니다. 서비스 워커는 앱 백엔드 Wasm까지 검증한 뒤 캐시에 저장합니다. `sw.js`와 이름이 고정된 자산은 캐시 재검증을 사용합니다.

### 웹 렌더링과 출처 간 격리

웹의 기본 렌더링 모드는 `direct`입니다. 검증할 앱에서 URL에 `?renderMode=auto`를 붙이거나 SDK의 `ApplicationSurface` 옵션에 `renderMode: 'auto'`를 지정하면, 해당 화면의 전용 워커와 WebGL2를 먼저 검사합니다. 격리된 문서와 워커에서 공유 메모리 왕복 검사가 통과하면 공유 슬롯을 사용합니다. 그 외에 워커 WebGL2 검사가 통과하면 전송 버퍼를 사용합니다. 워커를 열 수 없으면 메인 스레드에서 렌더링합니다. `worker-transfer`와 `worker-shared`는 경로 비교에 사용할 수 있으며 실패 시 사용 가능한 경로로 복구합니다.

`nelyx dev`와 `nelyx run`에 `--target web --cross-origin-isolated`를 추가하면 localhost에서 격리를 시험할 수 있습니다. 실제 격리 배포는 HTTPS에서 문서 응답에 `Cross-Origin-Opener-Policy: same-origin`과 `Cross-Origin-Embedder-Policy: require-corp`를 설정하고 워커 스크립트에도 호환되는 COEP를 보냅니다. 다른 출처의 자산에는 요청 방식에 맞는 CORS 또는 CORP가 필요합니다. iframe은 상위 문서와 권한 정책도 확인합니다. COOP `same-origin`은 다른 출처 팝업과의 `window.opener` 연결을 끊습니다. [출처 간 격리 배포](https://web.dev/articles/coop-coep)

CSP를 사용한다면 앱과 같은 출처의 렌더 워커와 CanvasKit 초기화에 쓰이는 검증한 blob 스크립트를 허용하는지 확인합니다. PWA는 캐시된 버전의 문서와 렌더 워커를 재검증해 동일한 릴리스의 정책 변경을 반영합니다. SDK의 `readWebApplicationDiagnostics()`와 앱의 `rendering`에서 경로, 격리 상태, 복구 사유와 프레임 지표를 확인할 수 있습니다.

## Tauri 빌드와 실행

```powershell
npx.cmd --no-install nelyx prepare --app . --target tauri --platform windows
npx.cmd --no-install nelyx doctor --app . --target tauri --platform windows
npx.cmd --no-install nelyx build --app . --target tauri --platform windows
npx.cmd --no-install nelyx run --app . --target tauri --platform windows
```

`dev --target tauri --platform windows`는 Vite에 연결한 WebView를 엽니다. CI에서는 `build --target tauri --frontend-only`로 `.nelyx/tauri/frontend/`를 게시한 뒤, 같은 앱 소스와 SDK 공급본으로 `pack --target tauri --platform <os> --frontend <directory>`를 실행합니다. CLI가 `.nelyx/tauri/host/`를 생성하고 Cargo.lock을 복원해 앱에 설치한 Tauri CLI를 실행합니다. 패키지는 `.nelyx/tauri/<os>-<architecture>/`에 게시하며 내장한 프런트엔드 빌드 ID와 Rust 타깃을 기록합니다.

앱 식별자, 창 크기와 권한은 `targets.tauri`에 선언합니다. 아래 항목을 `targets.tauri.windows`에 추가하면 `main` WebView에서 텍스트 클립보드, Android 화면 여백, 모바일 햅틱, Android 시스템 뒤로 가기를 사용할 수 있습니다.

```json
{
  "label": "main",
  "clipboard": { "read": true, "write": true },
  "safeArea": true,
  "haptics": true,
  "androidBack": true
}
```

`clipboard`를 생략하면 WebView 클립보드를 사용합니다. 읽기·쓰기에 명시한 `false`는 해당 작업을 끕니다. `haptics`를 생략하면 WebView 진동을 사용하고 `false`는 햅틱을 끕니다. `haptics: true`이면 Android·iOS에서 네이티브 플러그인을 사용하고 데스크톱 호출은 조용히 완료됩니다. Android는 뒤로 가기를 요청한 프레임워크 소유자가 있는 동안 시스템 리스너를 등록합니다. 생성한 권한은 지정된 WebView 라벨에만 적용됩니다. 플러그인을 도입할 때 `prepare --target tauri --platform <os> --update-lock`을 실행합니다.

`targets.tauri.windows[]`의 `deviceServices`에 `["location", "files", "store"]`처럼 기능을 지정합니다. CLI가 해당 WebView에 필요한 플러그인과 권한을 생성합니다. iOS용 `location`, `camera`·`barcode`, `nfc`, `biometrics`를 사용하면 `targets.tauri.deviceUsage`에 앱의 사용 목적을 작성합니다. 바코드는 `camera` 문구를 사용합니다. 링크를 수신하려면 창의 `deviceServices`에 `deepLinks`를 넣고 `targets.tauri.deepLinks.schemes`를 설정합니다. 선택적 `domains`는 `host`와 `pathPrefix`를 받습니다. HTTPS 연결에는 플랫폼 연결 파일과 서명 설정도 필요합니다. [Tauri 딥링크](https://v2.tauri.app/plugin/deep-linking/)

앱 아이콘은 `platform/icons/`에 둡니다. Android와 Apple의 사용자 파일은 생성 프로젝트 기준 상대 경로로 각각 `platform/android/project/`와 `platform/ios/project/`에 둡니다. 선택적인 `platform/<os>/tauri.conf.json`은 번들 설정과 CSP를 받습니다. 서명 키는 플랫폼 도구나 빌드 환경에서 제공합니다.

Android와 iOS에서 `run --no-launch`는 게시한 앱을 설치한 뒤 종료합니다.

Android x86_64 에뮬레이터는 `--architecture x64`, ARM64 기기는 `arm64`를 사용합니다. `dev`와 `run`의 `--device`에는 ADB 시리얼을 입력합니다. Android dev의 기기 이름은 연결 목록에서 고유해야 합니다. iOS 시뮬레이터는 `arm64-sim` 또는 `x64-sim`을 사용합니다. iOS 실기기 dev는 기기 이름과 신뢰된 HTTPS로 접근할 수 있는 `--host`가 필요합니다. 실기기 run은 기기 식별자를 받습니다. [Tauri 플랫폼 준비](https://v2.tauri.app/start/prerequisites/)
