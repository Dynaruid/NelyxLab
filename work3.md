# COOP·COEP 상태에 맞춘 Nelyx 웹 렌더링 작업계획

2026-11-24 · 기준 브랜치 `tauri-backend` · 기준 커밋 `37224b4` · 설계 제안

## 1. 권장 구조

**CanvasKit/Ganesh WebGL2는 한 종류로 공급하고, 화면을 열 때 그릴 위치와 프레임을 전달할 방법을 선택한다.** 워커를 사용할 수 있으면 메인 스레드가 만든 그리기 명령을 전용 워커가 `OffscreenCanvas`에서 재생하고 GPU에 제출한다. 격리 환경에서는 메인과 워커가 명령 버퍼를 공유한다. 비격리 환경에서는 같은 명령을 `ArrayBuffer`의 소유권을 넘겨 전달한다. 워커를 열 수 없는 환경에는 현재의 메인 스레드 렌더러가 있다.

아래는 검증을 마친 뒤의 자동 선택 순서다. Web과 Tauri WebView 모두 같은 SDK 진입점으로 들어간다. 앱의 위젯, 프런트엔드 빌드 명령, Rust 백엔드 호출에 격리 분기를 추가할 필요가 없다.

| 화면을 열 때 확인한 조건 | 실행 경로 | 실제 프레임 처리 |
| --- | --- | --- |
| 화면과 워커가 모두 격리 상태이고 공유 버퍼 왕복 및 워커 WebGL2 검사가 성공 | 워커 + 공유 버퍼 | 메인이 빈 슬롯에 명령을 쓰고 `Atomics`로 게시한다. 워커가 읽어 화면에 그린다. |
| 격리 미충족, 공유 버퍼 사용 불가 또는 공유 검사 실패. 워커 렌더링 검사는 성공 | 워커 + 전송 버퍼 | 메인이 전용 버퍼를 `postMessage`의 전송 목록에 넣는다. 같은 워커가 같은 명령을 재생한다. |
| 워커 생성·캔버스 이전·워커 WebGL2·메모리 예산 중 하나가 충족되지 않고 메인 WebGL2 사용 가능 | 메인 스레드 직접 렌더링 | 현재 `WebSkiaLibrary.submit()` 경로로 첫 프레임부터 그린다. |
| 메인과 워커 모두 사용 가능한 WebGL2 컨텍스트가 없음 | 기존 그래픽 초기화 오류 | 확인된 실패 단계를 보고한다. COOP·COEP 헤더를 추가해도 WebGL2 지원은 별도로 필요하다. |

판정은 캔버스를 소유한 `ownerDocument.defaultView`에서 시작한다. 보안 컨텍스트와 `crossOriginIsolated === true`를 확인한 뒤에만 공유 버퍼 생성을 시도한다. 워커에서도 자신의 격리 상태를 확인하고, 작은 버퍼에 값을 써서 응답해야 공유 경로를 선택한다. 헤더 문자열, 사용자 에이전트, Tauri 타깃 이름으로 실행 경로를 추정하면 iframe의 권한 정책이나 실제 WebView 제약을 놓친다. [HTML 표준의 격리 상태 판정](https://html.spec.whatwg.org/multipage/webappapis.html#dom-crossoriginisolated) · [격리 배포와 iframe·워커 조건](https://web.dev/articles/coop-coep)

## 2. 현재 코드와 확인한 범위

| 현재 동작 | 설계에 미치는 영향 |
| --- | --- |
| `openWebApplication()`이 `ganesh-webgl2` 프로필에 맞는 CanvasKit을 읽고, DOM 캔버스를 받아 `WebSkiaLibrary`를 한 개 만든다. `createWebServices()`는 이 객체를 renderer, text, paths, images, pictures, rasterization에 연결한다. [앱 조립](Nelyx/sdk/src/frontend/dom/application.ts) · [서비스 조립](Nelyx/sdk/src/backends/browser/services.ts) · [프로필](Nelyx/sdk/providers/web.json) | 실행 경로를 결정할 곳은 SDK의 화면 초기화 지점이다. 그리기 코드 안에서 명령마다 격리를 검사할 필요가 없다. |
| `layout()`, 글리프·범위 질의, `contains()`와 Picture의 동기 이미지 생성에는 호출 중에 결과가 필요하다. 화면 제출은 `replay → surface.flush → fenceSync` 순서다. 프레임 추정 크기는 최대 512 KiB이고 GPU 완료 대기는 최대 2개다. [WebSkiaLibrary](Nelyx/skia/packages/web/src/library.ts) · [동기 래스터화](Nelyx/src/hosting/rasterization.ts) | 화면에 그리는 작업과 위젯이 동기 호출하는 서비스를 나눌 수 있다. 워커 응답을 기다리느라 입력·레이아웃을 멈추는 설계는 피한다. |
| CanvasKit 로더는 로컬 JS·Wasm의 SHA-256과 바인딩 버전을 검사한 후 `document.createElement('script')`로 초기화한다. 한 인스턴스의 Wasm 선형 메모리는 초기 128 MiB, 최대 256 MiB다. [로더](Nelyx/sdk/src/backends/browser/canvaskit.ts) · [매니페스트](Nelyx/skia/packages/web/native-manifest.json) | 파일 검증은 재사용하고 워커용 초기화만 추가한다. 메인 인스턴스가 있는 페이지에서 첫 워커를 열면 선형 메모리 초기 크기 합계만 256 MiB다. GPU 캐시와 이미지 복사본은 별도로 계산해야 한다. |
| 프레임 인코더는 버전 11이고 리소스를 숫자 ID와 세대로 기록한다. 현재 Web provider의 `wireAbi` 선언은 10이다. 기존 SDK 워커 메시지는 플랫폼 채널 요청·응답용이다. [프레임 인코더](Nelyx/src/ui/frame-wire.ts) · [provider 선언](Nelyx/sdk/providers/web.json) · [플랫폼 메시지](Nelyx/sdk/src/runtime/worker-messages.ts) | 렌더 워커는 자신의 프로토콜 버전과 프레임 버전을 시작 시 대조한다. 기존 provider ABI 값이나 플랫폼 메시지 채널을 렌더 프로토콜로 간주하지 않는다. |

과거 엔진 v2 계획에도 격리·비격리용 워커 프로필이 있었다. 현재 앱의 진입점은 위 표의 DOM 직접 경로다. 당시 기록에서 새 캔버스로 복구하는 조건과 세대별 소유권 검사를 가져오고, 현재 공급된 CanvasKit으로 두 환경을 다시 검증한다. [이전 워커 설계와 검증 범위](history/26/11/04/work8-3-summary.md)

**최소 실험 결과.** 저장소 매니페스트와 두 파일의 해시가 일치하는 `m153-nelyx-paragraph.8`로, 로컬 HTTP 서버에서 같은 페이지를 헤더만 바꿔 열었다. Chrome 158.0.8127.88 헤드리스와 SwiftShader에서 DOM 캔버스를 전용 워커로 이전하고, 받은 명령으로 8×8 WebGL2 surface를 지운 뒤 픽셀 한 개와 fence 상태를 읽었다.

| 응답 헤더 | 화면 / 워커의 `crossOriginIsolated` | 전달 확인 | 읽은 RGBA / GPU fence |
| --- | --- | --- | --- |
| 두 헤더 없음 | `false / false` | 4바이트 `ArrayBuffer` 전송 후 송신 측 길이 0 | `[212, 24, 36, 255]` / 완료 |
| COOP `same-origin` + COEP `require-corp` | `true / true` | 양쪽이 같은 4바이트 슬롯에 `Atomics.store/load` | `[212, 24, 36, 255]` / 완료 |

이 실험에서 확인한 범위는 현재 CanvasKit 바이너리의 워커 로딩, 두 전달 방식, WebGL2 그리기와 완료 신호다. Nelyx 앱의 프레임 재생, 실제 GPU의 속도, Safari와 Tauri WebView는 아래 인수 대상으로 남는다. 첫 구현은 JS 스레드 사이에 명령 버퍼만 공유하므로 기존 CanvasKit 두 파일을 사용할 수 있다. 향후 Skia 내부 작업까지 Wasm pthreads로 병렬화하려면 스레드용·일반용 바이너리를 따로 공급해야 한다. [Emscripten pthreads 빌드 조건](https://emscripten.org/docs/porting/pthreads.html#compiling-with-pthreads-enabled)

## 3. 렌더러의 실행 경계

| 소유자 | 맡을 일 |
| --- | --- |
| 메인 스레드 | DOM, 입력·IME·접근성, `requestAnimationFrame`, 위젯 레이아웃, 프레임 캡처 및 제출 승인. 텍스트 측정·히트 테스트와 경로 질의를 현재처럼 동기로 처리한다. |
| 렌더 워커 | 표시용 `OffscreenCanvas`, CanvasKit 인스턴스, WebGL2 컨텍스트와 surface, 이 인스턴스의 폰트·이미지·Picture·셰이더 캐시를 소유한다. 명령 재생, flush, fence 확인과 context loss 통지도 여기서 수행한다. |
| SDK 브라우저 어댑터 | 화면별 경로 선택, 워커 준비·종료, 리소스 등록 순서와 프레임 승인 상태를 소유한다. DOM에서 측정한 크기·DPR·가시성과 세대를 워커에 보내고, 완료를 기존 `RendererNotification`으로 연결한다. |

**화면과 동기 API.** `WebSkiaLibrary`에서 화면 surface·명령 재생·GPU 완료 처리를 먼저 추출해 직접 경로와 워커가 같은 구현을 호출하게 한다. 워커 사용 시 메인의 CanvasKit은 폰트 측정과 로컬 리소스를 담당한다. `Picture.toImageSync()`처럼 실제 GPU readback이 필요한 동기 호출은 메인 전용 보조 캔버스의 컨텍스트를 최초 호출 시 생성해 처리한다. 그 결과 이미지를 화면에서 사용할 때만 워커에 등록한다. 보조 컨텍스트도 뷰의 메모리 예산, context loss 및 종료 처리에 포함한다. [현재 Picture·이미지 처리](Nelyx/skia/packages/web/src/library.ts) · [브라우저 서비스 연결](Nelyx/sdk/src/backends/browser/services.ts)

**프레임과 리소스.** `encodeFrame()`을 기준으로 양쪽 전송 방식이 같은 바이트를 만들고, 워커에 길이·버전·opcode·리소스 세대를 검증하는 디코더를 둔다. `ResourceLease`와 CanvasKit 객체는 생성한 쪽에 둔다. 워커에는 뷰 ID·세대에 속하는 숫자 리소스 ID와 재구성에 필요한 데이터를 등록한다. 폰트·번들 이미지는 검증한 원본 바이트를 재사용하고, 문단은 동일한 폰트 카탈로그·레이아웃 입력으로, retained Picture는 그 캡처와 의존 ID로 재구성한다. 동적 이미지·코덱 프레임에는 정확한 프레임의 픽셀 형식·크기·색 공간을 기록한다. 변경 없는 리소스는 한 번 등록해 여러 프레임에서 참조한다. 등록 완료 전에는 해당 리소스를 쓰는 프레임 승인을 보류하고, 완료 또는 실패 응답으로 다시 스케줄한다. [프레임 포맷](Nelyx/src/ui/frame-wire.ts) · [Picture와 의존 리소스 수명](Nelyx/src/hosting/pictures.ts)

wire의 숫자 범위와 부동소수점 정밀도는 현재 JS 재생 경로와 차이가 있다. 기존 앱이 쓰는 명령 중 왕복 표현이 달라지는 경우에는 인코더·디코더를 함께 보완한 뒤 워커 기본값을 활성화한다. Picture 재구성 비용이 큰 장면은 현재 바이너리가 제공하는 Picture API3 직렬화와 비교한다. 이때 폰트의 원본 식별자·컬렉션 인덱스·가변 축이 수신 쪽에서도 같은 글리프를 만드는지 확인한다. [Picture API3 바인딩](Nelyx/skia/eng/source-build/canvaskit-picture.cpp)

**프레임 전달과 완료.** 전송 경로는 워커가 다 읽은 `ArrayBuffer`를 돌려주어 재사용한다. 공유 경로는 생산자 하나와 소비자 하나에 고정 슬롯을 두고, 쓰기를 마친 뒤 길이·순번을 원자적으로 게시한다. 준비 알림은 메시지로 보내 메인 스레드가 대기하지 않게 한다. 슬롯은 워커가 다 읽은 뒤 재사용할 수 있다. 리소스의 lease는 그보다 오래, GPU fence가 완료되거나 사용 종료를 확정할 때까지 유지한다. 패킷의 **실제 인코딩 길이**도 제한한다. wire 길이는 프레임의 `estimatedBytes`와 다르므로, 직접 경로가 처리하는 유효 프레임이 슬롯보다 클 때는 상한을 검증한 전송 버퍼로 보낸다.

**제출 계약.** 대기열과 GPU 처리 중 프레임을 합해 기존의 두 자리 안에서 승인한다. 자리가 없으면 동기로 `busy`를 반환한다. 어댑터가 승인할 때 lease를 넘겨받고 호출 안에서 `submitted`를 발행해야 현재 `ViewRuntime`이 제출 토큰을 등록할 수 있다. 워커의 실제 GPU 제출 시점은 별도 진단값으로 기록한다. fence 응답에는 뷰·컨텍스트 세대와 제출 번호를 넣고, 해당 세대의 대기 건만 정확히 한 번 반환한다. 늦은 메시지는 새 뷰에 적용하지 않는다. 전송 성공 여부가 불명확하면 신규 승인을 멈추고 소유한 워커·컨텍스트의 종료를 확인한 뒤 정리한다. [View의 제출 계약](Nelyx/src/hosting/runtime.ts) · [제출·완료 이벤트](Nelyx/src/hosting/renderer-events.ts)

## 4. 초기화, 복구와 배포

1. **표시 캔버스를 넘기기 전에 경로를 정한다.** 임시 캔버스로 워커 스크립트 로드, CanvasKit API 버전, OffscreenCanvas/WebGL2 그리기와 fence를 검사한다. 워커 전용 기능이나 CSP에서 실패하면 정리 후 직접 경로를 연다. 공통 Wasm의 해시·바인딩 불일치는 어느 경로에서도 초기화 오류로 처리한다. `transferControlToOffscreen()` 뒤 원래 요소에는 메인 WebGL 컨텍스트를 다시 만들 수 없다. SDK가 캔버스를 소유하는 `ApplicationSurface`와 팝업은 이전 후 초기화 실패 시 새 캔버스로 직접 경로를 열 수 있게 한다. 교체 권한 없이 호출자가 넘긴 캔버스는 기본적으로 직접 경로를 사용한다. [캔버스 이전 규칙](https://html.spec.whatwg.org/multipage/canvas.html#dom-canvas-transfercontroltooffscreen) · [SDK surface 수명](Nelyx/sdk/src/frontend/dom/surface.tsx) · [팝업 생성](Nelyx/sdk/src/frontend/dom/dialog-windows.ts)
2. **새 컨텍스트의 첫 프레임을 복구 단위로 삼는다.** resize·DPR 변경 시 메인이 논리 크기와 세대를 보내고, 워커는 해당 세대의 첫 유효 프레임을 제출할 때 backing 크기를 바꾼다. 워커 context loss 시 승인을 막고 이전 세대 작업을 폐기한 뒤 리소스를 재등록하고 전체 프레임을 요청한다. 워커가 복구되지 않으면 기존 작업을 drain하고 새 캔버스와 렌더러 세대로 직접 경로를 연다. 이때 앱 상태·포커스를 보존하고 입력 리스너와 관찰자를 새 요소에 다시 묶는다. 뷰 닫기·StrictMode 재마운트 중에도 같은 종료 절차를 사용한다. [현재 resize·입력·복구 연결](Nelyx/sdk/src/backends/browser/services.ts) · [종료 계약](Nelyx/sdk/src/runtime/owned-disposal.ts)
3. **워커를 일반 릴리스 자산으로 공급한다.** DOM 스크립트 주입과 워커에서 검증된 JS를 실행하는 초기화 코드를 분리한다. JS·Wasm 해시 및 Paragraph API1·Picture API3·Font API1 검사를 양쪽에서 수행한다. 전용 워커 엔트리를 Vite dev, 정적 릴리스 인벤토리, PWA 캐시와 Tauri 프런트엔드에 포함한다. 서브경로와 Tauri 로컬 URL에서도 검증된 앱 루트로 자산을 해석한다. 워커 스크립트나 blob 실행이 정책상 차단된 경우를 테스트한다. [런타임 공급](Nelyx/sdk/tooling/contracts/src/web-runtime.mjs) · [Vite 러너](Nelyx/sdk/tooling/vite/src/runner.mjs) · [릴리스 검증](Nelyx/sdk/tooling/vite/src/release.mjs)
4. **헤더는 배포자가 선택한다.** 개발 서버와 정적 미리보기에는 격리를 켜는 선택 옵션을 두고 일반 배포도 계속 지원한다. 격리 배포 예시는 HTTPS 또는 신뢰 가능한 localhost에서 문서 응답에 `Cross-Origin-Opener-Policy: same-origin`과 `Cross-Origin-Embedder-Policy: require-corp`를 설정하고, 워커 스크립트에도 호환되는 COEP를 보낸다. 다른 출처의 이미지·폰트에는 요청 방식에 맞는 CORS 또는 CORP가 필요하다. iframe의 상위 문서·권한 정책과 외부 팝업 연동도 인수 시 확인한다. [브라우저 배포 조건](https://web.dev/articles/coop-coep) · [Vite 개발 서버](Nelyx/sdk/tooling/vite/src/config.mjs) · [CLI 정적 서버](Nelyx/sdk/tooling/cli/src/web-runner.mjs)
5. **PWA의 하위 경로 응답을 수정한다.** 현재 서비스 워커는 캐시한 루트 문서를 그대로 반환하지만, 하위 경로에서는 `<base>`를 삽입하면서 `Content-Type`만 가진 새 응답을 만든다. 원본 문서의 COOP·COEP·Permissions-Policy·CSP를 새 응답에 보존하고, 재작성한 본문과 맞지 않는 길이·인코딩·검증자 헤더는 제거한다. 비격리 원본에는 격리 헤더를 합성하지 않는다. 헤더 설정만 바꾼 재배포에서도 캐시된 문서 정책을 갱신하도록 릴리스 리비전 또는 문서 재검증 절차에 반영한다. [서비스 워커의 탐색 처리](Nelyx/sdk/tooling/vite/src/service-worker.mjs) · [PWA 업데이트 검사](Nelyx/eng/check-pwa-update.mjs)

## 5. 구현 순서와 인수 기준

| 순서 | 작업 | 다음 단계로 넘어갈 증거 |
| --- | --- | --- |
| 1 | 직접 렌더링 기준선 수집. SDK 진단에 화면별 격리 상태, 선택 경로, 선택 실패 단계와 사유를 추가한다. | 같은 앱 빌드를 헤더 두 개·한 개씩·없음으로 서빙하고 매번 첫 프레임 픽셀, 텍스트 선택, 스크롤 결과를 저장한다. |
| 2 | 직접 경로에서 공통 replay·surface·fence 처리를 추출한 뒤 워커 로더와 전송 버퍼 경로를 연결한다. | 헤더 없는 새 브라우저 세션에서 공유 API를 참조할 필요 없이 앱이 열린다. 글리프 위치, 폰트 대체, 클립, 이미지, 중첩 Picture, 셰이더와 동기 readback을 직접 경로와 비교한다. |
| 3 | 같은 워커에 공유 슬롯을 연결하고 `auto` 선택과 강제 경로 테스트를 추가한다. | 동일 앱·동일 입력에서 두 전달 방식의 결과가 일치한다. 실제 슬롯 게시·소비, 전송 후 버퍼 분리, GPU fence 완료가 각각 관측된다. 공유 검사 실패를 주입하면 전송 경로로 열린다. |
| 4 | 복구·종료와 메모리 예산을 통합한다. | 워커 차단·초기화 실패는 직접 경로로 첫 프레임을 그린다. 두 프레임 대기 중 resize·숨김·context loss·워커 종료·뷰 닫기를 실행해 중복 반환, 오래된 프레임 표시, 잔류 워커를 검사한다. 메모리 상한은 보조 컨텍스트·팝업·폰트·이미지 복사본까지 포함해 정한다. |
| 5 | Demo와 Testbed의 배포 및 성능을 검증한 환경부터 워커 자동 선택을 활성화한다. | 격리·비격리 각각 루트, 하위 경로 직접 진입, SW 제어 후 오프라인 재시작에서 기대 경로와 실제 픽셀을 확인한다. 브라우저 엔진별 결과와 Tauri WebView2·WKWebView·Android WebView 결과를 구분해 기록한다. |

성능 판단에는 같은 기기·해상도·장면에서 갤러리 스크롤과 텍스트 선택을 반복한다. 세 경로의 첫 프레임 시간, 메인 스레드 프레임 작업 p95, 입력에서 제출까지의 p95, 워커의 명령 재생 시간, fence 지연, 인코딩·복사 바이트와 최대 메모리를 함께 비교한다. 격리된 페이지에서 전송 경로도 강제로 실행하면 워커 이동 효과와 공유 버퍼 자체의 효과를 구분할 수 있다. 메인 스레드 시간 개선이 반복 측정 편차보다 크고, 첫 화면·입력 지연·메모리가 기준선으로 정한 예산에 드는 환경부터 기본값을 바꾼다. [스크롤 픽셀 검사](sample/nelyx-demo-app/eng/check-web-scroll-clipping.mjs) · [텍스트 선택 검사](sample/nelyx-demo-app/eng/check-text-selection.mjs) · [프레임 진단](Nelyx/src/ui/frame-diagnostics.ts)

## 6. 구현 및 인수 기록

2026-11-24 · macOS 27.2.1 · Apple M1 · 8 GiB

- Web과 Tauri가 같은 SDK에서 `direct`, `worker-transfer`, `worker-shared`를 실행한다. `auto`는 캔버스의 문서와 워커가 보고한 격리 상태를 읽고, 실제 WebGL2 픽셀·fence 검사와 공유 메모리 왕복 검사 결과로 경로를 선택한다.
- 메인 스레드는 동기 텍스트·경로 질의와 Picture readback을 담당한다. 화면용 워커는 동일한 CanvasKit으로 등록한 폰트·문단·이미지·Picture를 재생한다. 명령 패킷은 Web용 정밀도를 기록하고, 공유 슬롯보다 크면 전송 버퍼를 사용한다.
- 프레임 두 개까지 GPU 완료를 추적한다. 리소스 등록이 끝난 프레임을 다음 화면 갱신에서 먼저 제출한다. 워커를 다시 시작할 때 리소스를 재등록하며, 직접 경로로 복구할 때도 새 캔버스에 기존 뷰와 입력을 연결한다.
- 릴리스 인벤토리와 PWA 캐시에는 렌더 워커가 포함된다. 탐색 문서와 워커 스크립트는 같은 릴리스의 정책을 재검증한다. CLI의 `--cross-origin-isolated`는 Web 개발·미리보기 서버에서 쓸 수 있다. [CLI 웹 배포](Nelyx/sdk/tooling/cli/README.ko.md#웹-렌더링과-출처-간-격리)

### 렌더링과 배포 확인

| 실행 환경 | 확인 결과 |
| --- | --- |
| Chrome 158.0.8127.88 · Apple Metal | 작업 시작 커밋 `25cc4f5`의 Demo를 COOP·COEP 각각 단독, 둘 다, 둘 다 생략한 네 조건에서 실행했다. 첫 버튼 픽셀, 스크롤 클립 픽셀과 텍스트 선택 범위·좌표가 일치했다. 첫 버튼 영역의 주 색상은 `#65558f`였다. 새 Demo의 직접·전송·공유 경로도 같은 픽셀과 선택을 보였다. |
| Chrome 158 · 재생 검증 장면 | 가변 폰트와 폰트 대체, 경로 클립, 번들 이미지, 중첩 Picture, 동기 GPU readback 및 SkSL을 검증했다. 세 경로의 화면 픽셀이 일치했고 readback은 `[212, 24, 36, 255]`였다. 공유 경로에서도 대형 프레임을 전송 버퍼로 보냈다. |
| Chrome 158 · 복구와 PWA | 공유 검사 실패, 워커 차단, 워커의 CanvasKit blob 차단, 캔버스 이전 후 실패, 공통 Wasm 해시 불일치, 메인과 워커 WebGL2 경로가 모두 막힌 초기화 오류, 두 프레임이 대기 중일 때의 크기·DPR 변경과 숨김·context loss·워커 종료·뷰 닫기를 검사했다. iframe 권한 정책에 따른 전송 선택과 팝업의 직접 경로를 확인했다. Demo와 Testbed에서 격리·비격리 배포의 루트, 하위 경로, 서비스 워커 제어, 오프라인 재시작 및 헤더만 바꾼 재배포를 확인했다. |
| Chrome 158 · 외부 팝업과 StrictMode | 비격리 문서에서 외부 팝업의 `window.opener.postMessage` 콜백을 받았고, COOP `same-origin`이 적용된 문서에서는 opener 연결이 끊겼다. React 개발 모드에서 화면을 제거하자 워커가 종료됐고, 재마운트에서 효과를 다시 실행한 뒤 새 워커가 같은 픽셀을 그렸다. |
| WebKit 27.2 · Playwright | Demo의 직접·전송·공유 경로에서 첫 버튼과 스크롤 클립 픽셀, 텍스트 선택이 일치했다. |
| Firefox 157.0 · Playwright | Demo의 직접·전송·공유 경로에서 첫 버튼과 스크롤 클립 픽셀, 텍스트 선택이 일치했다. |
| macOS Tauri · WKWebView | Testbed ARM64 앱의 `tauri:` URL에서 `auto`가 비격리 워커 전송을 골랐다. 프레임 두 개가 fence 완료됐고 캔버스에서 서로 다른 RGB 값 329개를 읽었다. |
| iOS Tauri · WKWebView 실기기 | iPhone 12의 iOS 27.0.1에서 진단 출력을 추가한 개발 서명 Testbed IPA를 설치해 `direct`와 `auto`로 각각 실행했다. `tauri:` URL에서 `auto`가 비격리 `worker-transfer`를 골랐고 버퍼를 3회 반환했다. 직접 프레임 2개와 워커 프레임 3개가 fence 완료됐다. DPR 3의 1170×2289 캔버스를 128×96으로 샘플링한 RGBA 해시가 일치했고 두 경로에서 서로 다른 RGB 값 292개를 읽었다. |
| Windows Tauri · WebView2 | 사용자 요청에 따라 추가 기기 검증은 iOS 실기기에서 진행했다. Windows에서 `--render-mode=auto`를 지정해 Demo 패키지의 경로·픽셀·릴리스 자산을 확인할 수 있다. [WebView2 로컬 검사](Nelyx/eng/check-tauri-windows.mjs) |
| Android Tauri · Android WebView | 사용자 요청에 따라 이번 인수 범위에서 제외했다. |

macOS에서 실행 가능한 `.app`으로 WKWebView를 확인했다. CLI의 DMG 생성은 Finder AppleEvent 시간 초과로 종료됐다.

프레임 wire의 길이·opcode·세대·숫자 범위 검사와 기존 wire 11 인코딩을 별도로 확인했다. PWA 업데이트 검사에서는 손상된 백엔드 Wasm이 배포됐을 때 기존 릴리스가 살아 있고, 정상 릴리스 도착 후 다른 앱의 캐시를 보존하면서 전환되는 것도 확인했다. [wire 검사](Nelyx/eng/check-web-frame-wire.mjs) · [브라우저 인수 검사](Nelyx/eng/check-web-renderers.mjs) · [PWA 업데이트 검사](Nelyx/eng/check-pwa-update.mjs)

### 기본 경로 결정

Chrome에서 같은 Demo와 1280 × 760 화면, DPR 1로 경로별 세 번 반복했다. 표는 반복별 측정값의 중앙값이다. 메인 작업은 진단에 기록된 주요 프레임 단계의 합이며, RSS는 Chrome 렌더러와 GPU 프로세스의 세 시점 표본 중 최댓값이다.

| 화면 경로 | 첫 GPU 프레임까지 (ms) | 메인 프레임 작업 p95 (ms) | 메인 제출 p95 (ms) | 입력 → 실제 제출 p95 (ms) | 워커 재생 p95 (ms) | fence p95 (ms) | 표본 RSS (MiB) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 직접, 격리 | 676 | 16.76 | 3.79 | 69.60 | — | 16.27 | 761 |
| 전송, 비격리 | 788 | 26.90 | 0.50 | 88.90 | 2.20 | 8.30 | 824 |
| 전송, 격리 | 794 | 27.52 | 0.50 | 87.45 | 2.50 | 8.36 | 835 |
| 공유, 격리 | 794 | 27.59 | 0.53 | 87.61 | 2.51 | 8.35 | 837 |

워커 경로 한 회에서 인코딩한 프레임은 약 183 KiB였고 리소스 등록 전송은 약 17 MiB였다. 공유 슬롯은 메인에서 직접 채우므로 중간 프레임 버퍼의 복사가 없다. 전송 경로에서는 전송 직후 버퍼 분리와 워커 소비 후 반환·재사용을 관측했다. 메모리 예약은 SDK 실행 영역에 추가 워커 하나를 허용하고, 두 Wasm 인스턴스의 상한, 화면·보조 GPU 캐시와 복제 리소스 예산을 반영한다.

워커 제출 자체는 짧아졌고 메인 전체 프레임 작업·첫 화면·입력 지연은 늘었다. 반복 측정 기준에 따라 기본값을 `direct`로 설정했다. `?renderMode=auto` 또는 SDK의 `renderMode: 'auto'`로 기능 검사를 거치는 자동 선택을 사용할 수 있다.

### iPhone 실기기 스크롤 측정

iPhone 12의 iOS 27.0.1에서 Testbed 갤러리의 같은 터치 스크롤 입력을 경로마다 세 번 재생했다. 한 회에 스와이프 6개를 사용했다. DPR 3, 1170×2157 캔버스에서 각 회의 스크롤 범위는 약 1620 논리 픽셀이었다. 표는 각 회의 측정값을 모은 중앙값이다.

| 경로 | 렌더러 시작 → 첫 GPU 완료 (ms) | 메인 프레임 작업 p95 (ms) | 입력 → GPU 제출 p95 (ms) | JS 프레임 콜백 간격 p95 (ms) | GPU 완료 프레임 수 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `direct` | 332 | 5 | 23.3 | 20 | 240 |
| `worker-transfer` | 598 | 2 | 31.0 | 17 | 217 |

워커에서 메인 프레임 작업과 JS 콜백 간격이 줄었다. 직접 경로의 GPU 제출과 첫 GPU 완료가 빨랐고 GPU 완료 프레임 수도 많았다. 이 갤러리 부하에서도 성능 기준에 따라 기본값은 `direct`다.

실기기에 설치한 비교용 Testbed에서 상단의 `직접`과 `워커` 버튼을 눌러 `direct → worker-transfer → direct`로 전환했다. 전환마다 새 캔버스의 GPU 완료를 확인했다.

### 브라우저 검사 재현

재현할 때는 빌드한 릴리스 디렉터리를 인수 검사에 넘긴다. `--baseline`에는 기존 직접 렌더링 Demo 릴리스를, `--fixture`에는 검증 장면을 엔트리로 사용해 빌드한 Demo 복사본의 릴리스를 넘길 수 있다. `--report`를 지정하면 픽셀 해시, 선택 좌표와 프레임 지표를 JSON으로 저장한다. [검증 장면](Nelyx/eng/fixtures/web-renderer-scene.mjs)

StrictMode 재마운트 검사는 검증 장면을 쓰는 개발 서버에 격리를 켜고 `--suite strict --dev <URL>`을 넘겨 실행한다. 외부 팝업만 검사할 때는 `--suite popup`을 지정한다.

```sh
node Nelyx/eng/check-web-frame-wire.mjs
node Nelyx/eng/check-pwa-update.mjs
node Nelyx/eng/check-web-renderers.mjs \
  --demo sample/nelyx-demo-app/.nelyx/web \
  --testbed sample/nelyx-testbed-app-2/.nelyx/web \
  --trials 3
```

## 7. iPhone 기동 및 터치 프레임 개편

터치가 화면을 변경하면 뷰가 입력 처리를 마치는 시점에 예약된 프레임을 앞당긴다. 브라우저 프레임 시계는 같은 갱신 구간의 연속 입력을 합치고, 일반 애니메이션과 이미지 콜백에는 디스플레이 갱신 시각을 전달한다. 닫힌 뷰의 예약은 취소한다. 워커가 리소스 등록을 확인하면 메인이 보관 중인 프레임의 세대와 lease를 검사해 바로 제출한다. [뷰 런타임](Nelyx/src/hosting/runtime.ts) · [브라우저 프레임 시계](Nelyx/sdk/src/backends/browser/frame-clock.ts)

Demo·Testbed와 새 앱 템플릿은 앱 화면 모듈을 별도 청크로 읽으면서 네이티브 백엔드와 CanvasKit을 준비한다. 뷰를 열 때는 선언된 자산을 미리 읽고 해시를 검증한 뒤 디코딩한다. iOS용 Tauri 호스트는 설치된 앱에서 프런트엔드 자산의 Brotli 해제를 생략한다. [Vite 진입점](Nelyx/sdk/tooling/vite/src/client.mjs) · [Tauri 호스트 생성](Nelyx/sdk/tooling/cli/src/tauri-host.mjs)

같은 iPhone 12와 iOS 27.0.1에서 개편 전후 빌드를 각각 측정했다. Testbed 갤러리 화면은 DPR 3, 1170×2157이었다. 한 회에 같은 터치 스와이프 6개를 뷰 입력 경계에 재생했고, 아래 값은 경로별 3회 중앙값이다. 첫 프레임 시간은 페이지 탐색 시작부터 첫 GPU 완료 표시까지 측정했다.

| 측정값 | 직접 경로 개편 전 → 후 | 워커 전송 개편 전 → 후 |
| --- | ---: | ---: |
| 첫 GPU 프레임 (ms) | 709 → 627 | 946 → 811 |
| 입력 → GPU 제출 p95 (ms) | 23.0 → 17.7 | 32.0 → 22.3 |
| 메인 프레임 작업 p95 (ms) | 4 → 5 | 2 → 2 |
| JS 프레임 콜백 간격 p95 (ms) | 20 → 19 | 18 → 20 |
| GPU 완료 프레임 수 | 238 → 254 | 211 → 246 |

직접 경로가 첫 프레임과 입력 제출에서 가장 빨라 기본값을 `direct`로 유지했다. 개발 서명 IPA는 11.38 → 12.83 MiB, IPA 안의 압축 해제된 앱 파일 합계는 14.25 → 32.58 MiB였다. iPhone에서 직접 → 워커 → 직접으로 전환해 확인한 128×96 캔버스 샘플은 세 번 모두 동일한 RGBA 해시와 RGB 값 283개를 보였다. [프레임 시계 검사](Nelyx/eng/check-browser-frame-clock.mjs) · [브라우저 터치·복구·배포 검사](Nelyx/eng/check-web-renderers.mjs)

Chrome에서 브라우저가 전달한 터치로 두 경로의 스크롤을 확인했다. iPhone에서 별도로 시도한 XCTest 드래그 검사는 기기의 UI 자동화 모드 활성화 단계에서 두 차례 시간 초과됐다.
