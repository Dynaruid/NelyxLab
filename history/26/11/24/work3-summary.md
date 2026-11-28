# COOP·COEP와 Web·WebView 렌더 경로

원문 `work3.md` · 작성·실행 2026-11-24 KST · 기준 `tauri-backend` `37224b4` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work3.md`

**세 렌더 경로를 구현하고 측정 결과에 따라 기본값을 `direct`로 유지했다.**

## 구현

- CanvasKit/Ganesh WebGL2 공급 하나로 `direct`, `worker-transfer`, `worker-shared`를 실행한다. `auto`는 캔버스 소유 문서와 워커의 실제 격리 상태, 공유 메모리 왕복과 WebGL2 픽셀·fence 검사를 사용한다. 공유 검사가 실패하면 전송 경로를 검사하고, 워커 사용이 불가능하면 직접 경로로 연다. Web 개발·미리보기 서버는 `--cross-origin-isolated`를 제공한다.
- 메인 스레드는 DOM·스크롤·IME·동기 텍스트 질의와 readback을 담당한다. 워커는 같은 wire를 받아 화면용 OffscreenCanvas와 GPU 자원을 관리한다. 두 프레임의 GPU 완료를 추적하고 대형 공유 프레임은 전송 버퍼를 사용한다. 워커 복구나 직접 경로 전환 시 자원을 재등록하고 기존 뷰·입력을 새 캔버스에 연결한다.
- 워커를 릴리스 인벤토리와 PWA 캐시에 포함했다. 하위 경로 문서의 정책 헤더를 보존하고 헤더만 바뀐 재배포에서도 문서와 워커 정책을 재검증한다. COOP `same-origin`에서는 검증한 외부 팝업의 opener 콜백 연결이 끊겼다.

## 당시 검증과 기본값 결정

- Chrome·Playwright WebKit·Firefox에서 세 경로의 픽셀, 스크롤 클립과 텍스트 선택이 일치했다. Chrome에서 가변·대체 글꼴, 중첩 Picture·동기 readback, 큰 프레임, 워커 차단과 복구, PWA의 격리·비격리 오프라인 재시작과 StrictMode 수명을 확인했다. [렌더러 검사](../../../../Nelyx/eng/check-web-renderers.mjs)
- macOS ARM64 Tauri 앱과 iPhone 12의 개발 서명 Testbed IPA에서 WKWebView `auto`가 비격리 `worker-transfer`를 골랐다. iPhone에서는 직접·전송 경로의 캔버스 표본 해시가 일치했고 직접 → 워커 → 직접 전환 시 GPU 완료를 확인했다.
- M1 Chrome에서 직접·격리 전송·공유의 첫 GPU 프레임은 각각 676·794·794ms, 입력 → 실제 제출 p95는 69.60·87.45·87.61ms였다. 워커에서 메인 제출 호출은 짧아졌고 메인 전체 프레임 작업과 입력 지연은 늘었다.
- iPhone 후속은 터치 뒤 예약 프레임을 앞당기고, 화면 모듈 청크와 백엔드·CanvasKit 준비를 병행했으며, iOS 패키지가 프런트 자산의 Brotli 해제를 건너뛰도록 했다. 같은 갤러리 입력을 뷰 경계에 각 3회 재생했을 때 첫 GPU 완료는 direct 709 → 627ms, 전송 946 → 811ms였고 입력 → GPU 제출 p95는 각각 23.0 → 17.7ms, 32.0 → 22.3ms였다. 기본값은 direct를 유지했다.

macOS `.app`은 실행됐고 DMG 생성은 Finder AppleEvent 시간 초과였다. iPhone XCTest 드래그는 UI 자동화 활성화에서 두 번 시간 초과됐다. Android WebView는 사용자 요청으로 당시 인수에서 제외했고, Windows WebView2의 별도 확인은 후속 작업에 기록됐다. [원본 재사용과 Windows 패키지 확인](../25/work4-summary.md)
