# Nelyx Windows 창 크기 변경 추종

**IMPLEMENTED** · 2026-11-26 KST · Nelyx 기준 `14851cf0` · Doroti 비교 `35475819`

**Testbed 3 왼쪽 위 드래그의 래스터 순간 이동 수정** · 2026-11-27 KST · 수정한 Windows 패키지와 합성 화면 측정은 §10에 기록했다. 전체 크기 변경 성능의 이전 측정과 남은 범위는 §8에 있다.

Windows Tauri Demo에서 테두리를 드래그할 때 글자, 원형 아이콘, 고정 높이 위젯의 비율을 유지하고 콘텐츠가 새 창 크기에 빠르게 따라오게 한다. 같은 DOM 경로를 사용하는 브라우저와 별도 다이얼로그도 확인한다.

## 1. 코드에서 확인한 원인

| 경로 | 창 크기와 프레임을 맞추는 방법 |
| --- | --- |
| Doroti Windows App SDK | `WM_SIZING`의 후보 영역에서 같은 세대의 layout과 raster를 준비한다. 왼쪽이나 위쪽처럼 원점이 이동하면 실제 `WINDOWPOS`와 맞는 프레임을 이어서 표시한다. 프로그램이 변경한 크기와 DPI 변경은 실제 `WM_SIZE`에서 처리한다. [Windows 호스트](../DorotiLab/packages/platforms/windowsappsdk/native/src/exports.cpp#L408) · [actual-size 처리](../DorotiLab/packages/platforms/windowsappsdk/native/src/exports.cpp#L1451) |
| Doroti Web | 표시 캔버스의 자연 크기를 사용하고 고정된 픽셀 배율로 변환한다. 부모 뷰포트가 픽셀을 자르므로 크기가 바뀌는 동안 이전 픽셀의 비율이 유지된다. 루트 DOM 크기와 DPR은 별도로 읽고 변경 세대를 게시한다. [래스터 표시](../DorotiLab/packages/platforms/web/Doroti.Host.Web/Web/doroti.web.ts#L581) · [크기 관찰](../DorotiLab/packages/platforms/web/Doroti.Host.Web/Web/doroti.web.ts#L658) |
| Nelyx Web·Tauri | SDK의 캔버스는 가로·세로가 각각 `100%`다. 캔버스 박스는 브라우저 레이아웃에서 먼저 바뀌고 그에 맞는 CanvasKit 버퍼는 새 프레임을 제출할 때 생성된다. 워커 경로는 여기에 프레임 전송과 워커 제출이 이어진다. 빈 구간에 브라우저의 `object-fit: fill`이 적용되어 이전 프레임을 두 축에서 서로 다른 비율로 늘릴 수 있다. [메인 캔버스](Nelyx/sdk/src/frontend/dom/surface.tsx) · [팝업 캔버스](Nelyx/sdk/src/frontend/dom/dialog-windows.ts) · [CanvasKit 제출](Nelyx/skia/packages/web/src/surface.ts#L88) · [캔버스 표시 규칙](https://html.spec.whatwg.org/multipage/canvas.html#the-canvas-element) |

Nelyx는 이미 `ViewMetrics`를 프레임에 캡처하며 현재 세대와 다른 제출을 거부한다. 변형은 버퍼가 바뀌기 전 브라우저가 이전 픽셀을 표시하는 단계에서도 발생할 수 있다. 임베디드 영역은 `ResizeObserver`가 rAF 뒤 레이아웃 단계에서 알려 주므로 다음 rAF에 그리면 한 번의 화면 갱신 기회가 더 걸린다. 기존 브라우저 서비스는 같은 변경의 크기·환경을 확인한 뒤 다시 읽어 게시했다. [세대 검사](Nelyx/src/hosting/runtime.ts#L573) · [브라우저 크기 변경](Nelyx/sdk/src/backends/browser/services.ts) · [브라우저 렌더링 순서](https://html.spec.whatwg.org/multipage/webappapis.html#update-the-rendering)

Windows EXE는 Tauri/Wry가 `WM_SIZE`에서 WebView2 컨트롤러의 `Bounds`를 설정하고, WebView2가 자체 레이아웃과 합성을 수행한다. Doroti Windows의 DWM 표시 대기 조건에 해당하는 완료 신호는 이 경로에서 확보해야 한다. 이번 구현은 DOM 뷰포트가 크기를 받은 뒤의 레이아웃·픽셀 표시를 개선한다. Windows 캡처에서 WebView2의 창 경계와 콘텐츠 사이 지연을 따로 확인한다. [WebView2 Bounds](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/overview-features-apis#sizing-positioning-and-visibility)

## 2. 구현 순서

- [x] **W7-01. 뷰포트와 표시 픽셀의 크기 분리.** SDK가 생성한 메인·팝업 컨테이너에서 레이아웃 크기를 읽는다. 캔버스는 자연 픽셀 크기로 표시하고 두 축에 동일한 값으로 래스터 배율을 CSS 픽셀로 환산한다. 새 프레임 전에는 확장된 영역에 컨테이너 배경이 드러날 수 있고, 축소된 영역은 뷰포트에서 잘린다. 포인터·입력기·접근성·텍스트 선택은 뷰포트의 논리 좌표를 사용한다. 직접 제공된 캔버스는 기존 DOM 크기 계약을 따른다.
- [x] **W7-02. 최신 크기를 현재 화면 갱신에 반영.** 창 `resize`는 기존 rAF 전에 metrics를 게시한다. 레이아웃 뒤 도착한 `ResizeObserver`의 기하 변경은 이미 예약된 일반 뷰 프레임을 앞당긴다. 입력에 쓰는 조기 실행 한도를 공유하고, 최신 metrics·DPR·여백을 한 세대로 전달한다. 프레임 시작과 복원 시 DPR을 확인해서 크기 이벤트 없이 배율만 달라진 경우에도 반영한다. 일반 애니메이션 스케줄과 renderer credit·lease 규칙을 유지한다. [브라우저 metrics](Nelyx/sdk/src/backends/browser/services.ts) · [프레임 예약](Nelyx/sdk/src/backends/browser/frame-clock.ts)
- [x] **W7-03. Windows에서 버퍼 재사용.** 같은 래스터 배율에서 버퍼의 절반 이상을 쓰는 크기는 기존 버퍼를 재사용한다. 확장 시 커지는 축에 최대 기존 크기의 25%만큼 여유를 확보하고 GPU 크기 한도와 기존 워커 메모리 예산을 적용한다. 새 프레임의 뷰포트로 그리기 영역을 자르고 바깥쪽 픽셀을 비운다. [CanvasKit 버퍼 선택과 그리기](Nelyx/skia/packages/web/src/surface.ts)
- [x] **W7-04. 실사용 경로 검증.** Chrome에서 direct·worker 경로, 분수 DPR, 서로 다른 가로·세로 변경, 부모만 변경, 최종 프레임 크기와 입력 정렬을 확인했다. Windows Demo EXE의 빌드 ID와 WebView2 렌더러를 확인하고 OS 마우스 입력으로 오른쪽과 왼쪽 위 테두리를 움직여 화면을 캡처했다. 최소화·복원과 최대화·복원도 확인했다. Windows 연속 표시 측정 범위는 §5에 기록했다.

## 3. 판정 기준

- 이전 프레임이 표시되는 구간에도 고정 크기 표식의 너비·높이가 유지되어야 한다. 정적인 최종 화면과 별도로 중간 화면에서 판정한다.
- 창이 멈추면 레이아웃과 그린 영역이 최종 뷰포트에 맞아야 한다. 버퍼 용량이 뷰포트보다 클 수 있다. 빠른 왕복에서 마지막 크기를 잃거나 프레임 대기열이 계속 쌓이면 실패다.
- 가로·세로 반응, 크기 변경 중 표시 지연, 빈 영역 노출을 따로 기록한다. GPU fence 완료와 Windows 캡처에서 관찰한 픽셀 변화는 각각 해당 관측값으로 기록한다.

## 4. 실행 검증

- Chrome 158의 125% 배율에서 워커의 프레임 두 개를 보류하고 뷰포트를 `1280 × 760 → 1065 × 805`로 바꿨다. 종전 빌드 `3822cd6f0128`는 같은 화면 영역의 PNG 픽셀이 바뀌었다. 수정 빌드는 같은 영역의 픽셀이 일치했다. 그런 다음 200%로 전환하고 `2130 × 1610` 버퍼와 정지된 이전 프레임 폐기, 워커 컨텍스트 복구를 확인했다. [워커 복구 검사](Nelyx/eng/check-web-renderers.mjs)
- 같은 Chrome에서 문서 크기 `1280 × 760`를 그대로 두고 부모만 `1100 × 640`으로 줄였다. 다음 rAF 콜백 전에 새 프레임을 한 번 제출했고, 캔버스 표시 범위는 부모와 일치했다. Windows의 `1600 × 950` 버퍼를 그대로 사용했다. [부모 크기와 프레임 검사](Nelyx/eng/check-web-renderers.mjs) · [조기 실행과 해제 검사](Nelyx/eng/check-browser-frame-clock.mjs)
- Windows 200% WebView2에서 재사용을 켜기 전에는 왼쪽 위와 오른쪽 드래그로 `1200 × 780 → 1022 × 665 → 873 × 665`를 만들 때 버퍼를 두 번 다시 만들었다. 재사용을 켠 빌드 `96d2cb166d3d5`에서는 같은 두 번의 드래그 동안 `2400 × 1560` 버퍼를 유지했고 위젯은 각 창 크기로 다시 배치됐다. 이 두 표본에서 DOM 크기 알림부터 CanvasKit 제출까지 약 65 ms와 38 ms였다. `worker-shared`에서 별도의 왼쪽 위 드래그 한 번은 약 26 ms에 워커 제출을 마쳤다. 모두 Windows 합성 이전에 측정한 값이다.
- 최대화, 일반 크기 복원, 최소화 후 복원에서 Demo 화면이 다시 창 크기를 따랐다. DevTools가 전환 도중 뷰포트와 다른 크기의 합성 캡처도 반환했다. 같은 크기로 수렴한 캡처에서는 제목의 픽셀 경계가 초기 화면과 일치했다.
- 최종 Windows EXE의 SHA-256과 WebView2가 읽은 빌드 ID `4255072a415818ada9adc45f5d0b47d4f4559ec53319b318ccc6d1a8f0d70f51`를 패키지 정보와 대조했다. 기본 direct의 왼쪽 위 드래그와 `worker-shared`의 오른쪽 드래그에서 버퍼 재사용과 최종 제목 픽셀 경계를 다시 확인했다. direct에서 크기 변경 후 화면의 **Filled** 버튼이 마우스 클릭을 받았다.
- 최종 Web 빌드 `9e233cfa5d05bc98954c34f22ee460db4b1f9da24fbd38500304141f981e0c25`에서 direct·worker-transfer·worker-shared의 픽셀·스크롤·텍스트 선택을 비교했다. 날짜 입력의 포커스 유지와 별도 다이얼로그를 닫은 뒤의 부모 언어 복원도 확인했다. [렌더러 검사](Nelyx/eng/check-web-renderers.mjs) · [입력과 다이얼로그 검사](sample/nelyx-demo-app/eng/check-localization.mjs)

저장소 루트에서 다음 명령으로 검증한 Windows Demo를 실행할 수 있다.

```powershell
npm.cmd --prefix sample/nelyx-demo-app run run:tauri -- --platform windows
```

## 5. Windows 표시 확인 범위

WebView2가 DOM에 새 뷰포트를 알린 뒤의 픽셀 배율과 프레임 제출을 개선했다. 첫 검증에서 DOM이 보고한 크기 변경은 드래그당 한 번이었다. 이후 §6에서 짧은 간격으로 계속 움직이는 동안의 표시를 측정했다.

## 6. 60 Hz 연속 드래그 후속 (2026-11-27 KST)

- 창과 시각 뷰포트의 크기 변경에도 `ResizeObserver`와 같은 조기 실행 기회를 준다. 먼저 들어온 이벤트에서 기하 변경을 게시한 경우에도 예약한 프레임을 현재 화면 갱신에 포함한다. 배율·여백 환경의 값이 같으면 기존 객체를 재사용한다. [브라우저 크기 변경](Nelyx/sdk/src/backends/browser/services.ts)
- 같은 너비 구간의 Material 갤러리는 기존 위젯을 새 크기로 배치한다. 1,000 논리 px의 양쪽 120px 안에서는 반대쪽에 150ms 머물렀을 때 열 구성을 바꾼다. 이 범위를 벗어나면 즉시 전환한다. 처음 시도한 숨은 열 유지 방식에서는 숨은 뷰포트의 레이아웃 비용이 일반 크기에서도 발생했다. [갤러리 레이아웃](sample/nelyx-demo-app/src/components.ts)
- 접근성에 같은 스크롤 범위와 위치가 반영됐으면 후속 크기 알림에서 중복으로 갱신을 요청하지 않는다. 스크롤 크기 알림은 계속 전달한다. [스크롤 접근성](Nelyx/src/framework/rendering/scroll-semantics.ts)
- 한 축이 커지면 GPU 한도와 메모리 예산 안에서 반대 축의 버퍼 용량도 유지한다. 렌더 워커는 새 크기의 첫 유효 프레임을 메시지를 받은 시점에 그린다. 이미 도착한 이전 세대의 프레임은 기존 검사에서 폐기하고 전송 버퍼와 제출 슬롯을 반환한다. [버퍼 선택](Nelyx/skia/packages/web/src/surface.ts) · [워커 제출](Nelyx/sdk/src/backends/browser/renderer-worker.ts)

AMD Radeon 780M의 2560 × 1600 / 165 Hz 화면에서 Windows Demo EXE를 200% 배율로 실행했다. 오른쪽과 왼쪽 위 테두리를 잡고 Win32 `SendInput`으로 16.67 ms 간격의 108개 마우스 위치를 보냈다. 가로 이동은 기준점에서 양쪽 각각 234 물리 픽셀이고, 왼쪽 위 드래그에서는 세로 크기도 반대 방향으로 최대 140 물리 픽셀 바꿨다. 창의 실제 클라이언트 경계, CanvasKit 제출, 합성 화면에 보이는 Material 탭의 픽셀 위치를 각각 기록했다. 합성 화면은 DXGI Desktop Duplication의 QPC 타임스탬프로 정렬했다. [DXGI 화면 타임스탬프](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/ns-dxgi1_2-dxgi_outdupl_frame_info)

Windows 창 경계는 초당 약 59.4회 바뀌었다. 아래 표는 방향별 약 1.78초 왕복 구간에서 관찰한 값이다. 표시 갱신률은 합성 화면에서 Material 탭의 가로 위치가 바뀐 횟수로 계산했다. 시작 너비는 테두리를 포함한 물리 픽셀이다.

| 시작 너비 · 렌더러 · 방향 | CanvasKit 제출/초 기존 → 수정 | 표시 갱신/초 기존 → 수정 | 표시 간격 p95 기존 → 수정 |
| --- | ---: | ---: | ---: |
| 1440 · direct · 오른쪽 | 49.9 → 56.1 | 49.9 → 56.1 | 26.4 → 25.9 ms |
| 1440 · direct · 왼쪽 위 | 53.3 → 58.3 | 51.0 → 57.2 | 29.7 → 25.7 ms |
| 1440 · worker-shared · 오른쪽 | 49.3 → 57.2 | 49.3 → 55.5 | 30.8 → 24.7 ms |
| 1440 · worker-shared · 왼쪽 위 | 51.6 → 57.8 | 48.8 → 57.2 | 36.7 → 24.1 ms |
| 1880 · direct · 오른쪽 | 39.3 → 56.6 | 38.7 → 56.1 | 69.8 → 25.5 ms |
| 1880 · direct · 왼쪽 위 | 42.6 → 57.8 | 40.9 → 55.5 | 38.8 → 27.7 ms |

- 1880px에서 오른쪽 테두리를 움직일 때 표시 갱신 사이 최대 공백은 117.2 → 32.7 ms였고, 프레임 시작부터 GPU fence 예약까지 p95는 43.5 → 16.4 ms였다. 1440px direct의 왼쪽 위 왕복에서는 백킹 캔버스 크기 속성 변경 합계가 12회에서 1회로 줄었다.
- 1440px worker-shared 대각선 왕복에서 폐기한 프레임은 18회에서 8회로 줄었다. 모든 드래그에서 정지 후 실제 클라이언트 크기와 DOM 크기가 1 논리 px 이내로 일치했고 렌더러의 제출 슬롯이 회수됐다.
- 최종 표시 간격 p95는 24.1–27.7 ms로 60fps의 16.7 ms 간격 기준보다 길었다. 창 경계가 바뀐 뒤 해당 탭 위치가 합성 화면에 보이기까지 p95는 최종 direct에서 40.7–46.5 ms였다. 넓은 창 대각선 드래그에서 하단 탭 바의 세로 위치 오차 p95는 32 물리 px였다. 측정 범위는 합성 화면과 프로그램이 보낸 마우스 입력이다.
- 기존 Windows WebView2의 빌드 ID는 `2503b34c1615`, 수정 EXE의 빌드 ID는 `da28595aaad5`였다. 파일 SHA-256과 실행 중인 WebView2 빌드 ID를 패키지 정보와 대조했다. 최대화·최소화 후 복원, 좁은 창과 넓은 창 전환, **Filled** 버튼 클릭을 확인했다. Chrome에서는 125%·300% 배율의 임베디드 영역 변경과 버퍼 재사용, direct·worker-transfer·worker-shared의 픽셀과 입력, 워커 복구와 별도 팝업을 확인했다. [브라우저 회귀 검사](Nelyx/eng/check-web-renderers.mjs)

## 7. Doroti 방식으로 Windows WebView2 크기 변경 개선 (2026-11-27 KST)

Doroti의 Windows 호스트는 표면 용량을 유지하고, 왼쪽·위쪽 드래그에서 후보 크기로 그린 프레임과 실제 창 위치를 맞춰 표시한다. Doroti Web은 처리 가능한 크기 변경 수를 제한하고 대기 중에는 최신 크기를 보관한다. Nelyx는 이 두 경로의 표면 재사용과 크기 전달 방식을 적용했다. [Doroti Windows 표면](../DorotiLab/packages/platforms/windowsappsdk/native/src/exports.cpp#L1478) · [Doroti Web 크기 전달](../DorotiLab/packages/platforms/web/Doroti.Host.Web/Web/doroti.web.ts#L1964)

Windows Demo는 작업 영역을 담을 크기의 WebView2 자식 표면을 만들고 실제 클라이언트 영역으로 자른다. 표면 용량이 충분한 동안에는 `WM_SIZE`마다 WebView2 크기를 다시 설정하던 작업을 피한다. 호스트는 실제 클라이언트 크기를 문서에 전달하고, 브라우저 배율로 환산해 루트 DOM과 캔버스를 배치한다. JavaScript 호출은 진행 중인 하나와 대기 중인 최신 크기 하나만 보관한다. 문서 로드가 끝나면 현재 크기를 다시 전달한다. [Windows 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs) · [문서 크기 처리](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.js)

`windowsRetainedViewport`는 문서를 채우는 Nelyx 앱이 Windows 창별로 선택한다. `window.innerWidth`, `window.innerHeight`, CSS 뷰포트 단위는 WebView2 표면을 기준으로 한다. 앱의 레이아웃은 클라이언트 크기에 맞춘 컨테이너를 읽는다. [CLI 설정](Nelyx/sdk/tooling/cli/README.ko.md#tauri-빌드와-실행)

§6과 같은 화면과 배율에서 60 Hz 입력을 가하고, 같은 Material 화면에서 기존 §6 EXE와 새 패키지의 기본 `direct` 경로를 비교했다. 창 경계는 각 드래그에서 초당 59.4회 바뀌었다. 표시 지연은 창 경계가 바뀐 뒤 해당 탭 위치가 합성 화면에 나타난 시점까지의 p95다.

| 시작 너비 · 방향 | 창 경계 → DOM p95 | 창 경계 → 화면 p95 | 화면 갱신/초 | 표시 간격 p95 |
| --- | ---: | ---: | ---: | ---: |
| 1440 · 오른쪽 | 17.5 → 11.9 ms | 43.7 → 37.7 ms | 56.6 → 58.3 | 23.8 → 19.5 ms |
| 1440 · 왼쪽 위 | 20.6 → 7.3 ms | 42.1 → 31.0 ms | 57.2 → 58.9 | 24.8 → 20.8 ms |
| 1880 · 오른쪽 | 6.4 → 6.3 ms | 29.3 → 28.7 ms | 58.3 → 58.9 | 19.9 → 26.6 ms |
| 1880 · 왼쪽 위 | 20.1 → 6.8 ms | 42.0 → 28.4 ms | 56.1 → 58.3 | 26.3 → 25.8 ms |

- 1880px 오른쪽 드래그의 최대 표시 공백은 48.6 → 27.0 ms였고 p95 간격은 늘었다. 왼쪽 위 드래그의 하단 탭 세로 오차 p95는 두 너비 모두 18 → 16 물리 px였다. 캡처는 합성 화면의 갱신을 기록했다.
- 크기를 WebView2 메시지로 모두 보내는 초기 시험에서는 1440px 오른쪽 드래그의 초반 메시지가 밀려 지연 p95가 71.1 ms까지 늘었다. 진행 중인 호출이 끝날 때 최신 크기를 꺼내면서 이 구간의 대기를 줄였다. 패키지에서는 창이 활성화될 때 WebView2 포커스를 강제로 요청하던 처리를 제거해 Win32 테두리 드래그를 유지했다.
- Windows x64 패키지 빌드 ID는 `3ad55d49bfd8`이고 EXE SHA-256은 `77ba4a0497db36670de8322ab7dd6c38f85d1bd06105f4fe385c4c3a92906c1f`다. EXE의 해시와 실제 WebView의 내장 빌드 ID를 대조했다. 드래그 후 캔버스와 창 크기는 1 논리 px 이내로 일치했다. **Filled** 버튼 클릭, 문서 새로고침, 최대화, 최소화와 복원을 확인했다.
- 같은 패키지의 1440px `worker-shared` 경로는 오른쪽과 왼쪽 위에서 각각 초당 56.6회·56.1회 표시를 갱신했다. Acrylic을 켠 기본 `direct` 경로에서는 초당 50.5회·52.7회 갱신했고 창 경계에서 표시까지 p95는 44.7 ms·43.9 ms였다. Windows 호스트의 Acrylic 상태와 드래그 후 캔버스 크기, 클릭을 확인했다.
- Windows 패키지 회귀 검사는 오프라인 실행과 내장 자산, Rust IPC, 시작·실행 중 딥 링크, 클립보드 권한, 창 제목을 확인했다. Windows 옵션을 켠 창과 끈 창을 한 설정에서 생성했고 Linux·iOS 생성 구성에서도 Windows 전용 초기화 분기를 확인했다. [Windows 회귀 검사](Nelyx/eng/check-tauri-windows.mjs)
- `build:tauri`에서 Rust 공급 모듈을 불러올 때 이전 SDK의 앱 설정 검증기가 함께 로드되던 순서를 고쳤다. Windows 패키지와 웹 빌드가 통과했고 브라우저는 `/`와 `/demo/`에서 Wasm 백엔드를 호출했다. [앱 백엔드 빌드](Nelyx/sdk/tooling/cli/src/backend-project.mjs) · [웹 회귀 검사](Nelyx/eng/check-backend-web.mjs)

## 8. Testbed 3 대각선 드래그 중간 마무리 (2026-11-27 KST)

**PAUSED / PARTIAL.** 사용자 요청으로 중단했다. 중단 시점의 Windows x64 EXE SHA-256은 `9405468e663189be6ecf2ffdc0fde31e855b496b191c2e3e15497aa8b44888a9`이고, 실행 중인 프런트엔드와 Rust 호스트가 보고한 빌드 ID는 모두 `b674a1ede2c47bc6e32b502fc4b4f1aacf7b9d079eb720d92eb85025ae87763d`였다. 현재 패키지는 §9에 기록했다.

Doroti Windows는 최상위 HWND를 직접 만든다. Windows가 드래그로 제안한 사각형을 `WM_SIZING`에서 받아 프레임을 미리 준비한다. Composition 경로에서 왼쪽·위쪽을 끌 때는 원점과 프레임을 함께 식별하고, 실제 창 위치가 확정되는 시점에 준비한 프레임을 표시한다. 최상위 창에는 `WS_EX_NOREDIRECTIONBITMAP`을 설정한다. [Doroti 창 생성](../DorotiLab/packages/platforms/windowsappsdk/native/src/exports.cpp#L1557) · [크기 변경과 프레임 준비](../DorotiLab/packages/platforms/windowsappsdk/native/src/exports.cpp#L408) · [창 스타일](../DorotiLab/packages/platforms/windowsappsdk/native/src/exports.cpp#L1218)

Testbed 3에는 §7의 표면 재사용 옵션이 빠져 있었다. 이를 켜고, 크기 조절 중 같은 탐색 구성에서는 기존 위젯에 새 제약을 전달한다. 갤러리 목록은 보이는 예제를 배치하고 방문한 섹션의 상태를 유지하며, 고정 폭 예제의 그리기 경계를 분리했다. 색상과 높이 예제에서도 같은 카드를 매번 만드는 작업을 줄였다. [앱 설정](sample/nelyx-testbed-app-3/package.json) · [탐색 레이아웃](sample/nelyx-testbed-app-3/src/app.ts#L477) · [갤러리](sample/nelyx-testbed-app-3/src/components.ts) · [Doroti 갤러리의 캐시 범위](../DorotiLab/samples/DorotiTestbedApp/src/MaterialSample/Components.cs#L375)

Nelyx의 Windows 호스트는 Tauri 최상위 창의 `WM_SIZING`에서 후보 클라이언트 크기를 WebView2에 보내고, `WM_WINDOWPOSCHANGED`에서 실제 사각형으로 보정한다. 왼쪽을 끌 때 유지한 자식 표면의 가로 위치를 조정하고 세로 원점은 제목 표시줄을 따라간다. 최상위 창의 별도 리디렉션 비트맵을 끄기 전에는 WebView에 고정한 기준점까지 가로로 약 한 입력 단계씩 튀었다. WebView2 크기 알림은 비동기로 전달한다. [Nelyx Windows 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs) · [문서 좌표](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.js) · [Windows 크기 변경 메시지](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-sizing)

### 같은 합성 프레임에서 본 네 모서리

AMD Radeon 780M, 2560 × 1600, 165 Hz, 200% 배율에서 실제 Testbed 3의 Components 화면을 열었다. 각 모서리에 60 Hz Win32 마우스 입력 96개를 보내 가로와 세로가 함께 커졌다 작아지도록 했다. 1690px 창에서는 가로 ±150px, 2300px 창에서는 ±108px로 움직였고 세로 이동량은 가로의 60%였다. DXGI 합성 화면 한 장 안에서 창의 닫기 버튼과 앱 오른쪽 아이콘의 가로 간격을 읽고 정지 상태와 비교했다. 아래는 앱 레이아웃 최적화까지 적용한 중간 빌드 `b351d4451bcc`에서 현재 빌드로 바뀐 95백분위 절대 오차다. 단위는 물리 픽셀이다.

| 시작 창 너비 | 왼쪽 위 | 왼쪽 아래 | 오른쪽 위 | 오른쪽 아래 |
| --- | ---: | ---: | ---: | ---: |
| 1690px | 20 → 1 | 20 → 1 | 20 → 20 | 20 → 20 |
| 2300px | 28 → 1 | 28 → 1 | 28 → 28 | 29 → 24 |

왼쪽 모서리에서는 창 오른쪽이 고정된다. 2300px에서 닫기 버튼의 가로 위치가 그대로인데 앱 아이콘만 직전 합성 화면보다 3px 이상 움직인 횟수는 왼쪽 위 72 → 4회, 왼쪽 아래 57 → 0회였다. 현재 빌드에서 각 모서리를 끄는 동안 창 경계는 초당 59.4회 바뀌었고, 두 아이콘의 세로 간격 오차 p95는 모두 0px였다. 오른쪽 모서리를 끌 때는 오른쪽 테두리도 움직여서 앱 아이콘의 가로 추종 지연이 남았다.

### Components 본문이 새 위치에 표시되기까지

이 비교의 기준은 작업 시작 당시의 Testbed 3 EXE `f93266aff187`다. 60 Hz 왕복 드래그에서 앱 제목과 본문의 `Actions` 글자를 캡처해 본문 위치가 바뀐 횟수와 해당 창 크기가 화면에 반영되기까지의 지연을 구했다. 이 표의 왼쪽 위 궤적은 가로로 커질 때 세로로 작아진다.

| 시작 너비 · 조건 | 표시 갱신/초 기존 → 현재 | 창 경계 → 본문 표시 p95 |
| --- | ---: | ---: |
| 1690px · 오른쪽 | 46.7 → 59.4 | 49.4 → 18.1 ms |
| 1690px · 왼쪽 위 | 45.5 → 59.4 | 55.1 → 25.0 ms |
| 2300px · 오른쪽 | 37.3 → 58.7 | 66.8 → 22.3 ms |
| 2300px · 왼쪽 위 | 29.7 → 56.8 | 75.3 → 36.0 ms |
| 2024px · 1열/2열 전환 · 왼쪽 위 | 32.2 → 49.3 | 76.8 → 42.9 ms |
| 2300px · Acrylic · 왼쪽 위 | 24.0 → 56.2 | 142.6 → 41.5 ms |

2300px 일반 창의 왼쪽 위 왕복에서 표시 사이의 최대 공백은 62.1 → 31.0ms였다. 1열/2열을 반복 전환할 때는 현재 빌드에서 최대 121.2ms였다. 측정은 프로그램 입력과 Windows 합성 화면까지다.

### 확인한 기능과 남은 범위

- 현재 빌드에서 타입 검사, 색상·높이 예제의 재배치, 갤러리 스크롤 왕복, 편집한 값 보존, 크기 조절 중 열린 모달의 중앙 정렬, iframe 높이 변경, Texture 탭, 새로고침을 확인했다. 창 이동·최대화·최소화·복원 후 Win32 클릭으로 **Filled** 버튼의 알림이 표시됐다.
- 오른쪽 모서리의 가로 추종, 1열/2열 전환 시 표시 공백, 물리 마우스 체감은 남아 있다. 위쪽을 끌 때 아래쪽 탭 글자의 세로 위치를 추적한 별도 측정은 221장 중 153장에서만 글자를 식별해 결론을 보류했다. 느린 왕복 일부에서는 지정한 60 Hz 입력 수보다 창 경계 변화가 더 많아 최종 비교에서 제외했다.
- 현재 공유 호스트로 Testbed 3와 Demo의 정식 `check-tauri-windows.mjs` 회귀 검사, Demo 재패키징, Testbed 3 웹 빌드와 `check-backend-web.mjs`는 중단 시점에 미실행이다. 앞 절의 통과 기록은 그 절에 명시된 빌드에 해당한다.

## 9. Testbed 3 왼쪽 위 드래그의 순간 이동 재현

**수정 전 재현.** Windows 11의 200% 배율에서 Testbed 3 Components를 열고, 시작 창 너비 1690px에서 60Hz 대각선 입력을 보냈다. DXGI 합성 화면에서 닫기 버튼의 가로 좌표가 2065px로 고정된 동안 앱 아이콘은 `2073 → 2090 → 2072px`로 움직였다. 같은 구간에서 WebView2 자식 창의 왼쪽 경계는 `13 → 31 → 13px`로 바뀌었다. 비교 빌드에서 캔버스 밖에 고정한 HTML 표식도 순간 이동했다.

부모 창이 움직인 뒤 `WM_WINDOWPOSCHANGED`에서 자식 창의 상대 위치를 되돌리는 사이에 중간 좌표가 표시될 수 있다. 당시에는 캔버스 기준점 고정, 네이티브 보정 시점 변경, 자식 창 리디렉션과 픽셀 복사 설정을 각각 비교했다. 1690px·2300px 및 아크릴 조건을 함께 만족하지 못한 실험은 되돌렸다. [Win32 위치 변경 메시지](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-windowposchanged)

비교에 사용한 기존 호스트 EXE의 SHA-256은 `5785ff3a24d4ede27fdf23cf03731f052f9dc7627c6b24647dc0948cf2db943d`이며, 실행 중인 프런트엔드와 Rust 호스트의 빌드 ID는 §8의 값과 일치했다.

## 10. 왼쪽 위 드래그의 래스터 위치 고정

왼쪽 테두리를 끌면 Windows 호스트가 `WM_NCCALCSIZE`에서 이전·새 클라이언트 영역의 겹치는 픽셀을 지정한다. Windows가 부모 창과 WebView2 자식 창의 가로 위치를 함께 바꾸고, 호스트가 마지막 물리 픽셀을 명시적으로 이동해 합성기에 자식 위치를 알린다. 가로 오프셋이 바뀌는 드래그에서는 `DwmFlush`로 직전 합성을 기다린다. [Windows 호스트](Nelyx/sdk/tooling/cli/templates/tauri/src/windows_viewport.rs#L72) · [WM_NCCALCSIZE](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-nccalcsize) · [DwmFlush](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmflush)

캔버스의 가로 원점은 WebView 안에서 고정하고, CanvasKit이 각 프레임을 그릴 때 그 프레임에 해당하는 가로 오프셋을 적용한다. 다음 창 크기가 먼저 도착해도 이미 표시된 그림은 제자리에 있다. 워커도 같은 크기 세대의 오프셋을 사용하며 버퍼 예산에 왼쪽 여백을 포함한다. [DOM 뷰포트](Nelyx/sdk/src/backends/browser/services.ts#L181) · [CanvasKit 그리기](Nelyx/skia/packages/web/src/surface.ts#L142)

Windows 11, Radeon 780M, 2560 × 1600, 165Hz, 200% 배율에서 패키지 EXE로 Components 화면을 열었다. 시작 너비 1690·2024·2300px에서 60Hz Win32 입력으로 왼쪽 위 모서리를 11차례 드래그했다. 일반·아크릴 창, 느린 드래그, 수평에 가까운 드래그, 1열↔2열 전환, `direct`·`worker-shared`·`worker-transfer`를 포함했다. 전환 구간은 넓은 레이아웃과 좁은 레이아웃의 오른쪽 아이콘을 각각 식별했다.

- 합성 화면 1,752장 모두에서 제목 표시줄 닫기 버튼과 앱 아이콘을 함께 식별했다. 정지 상태 대비 두 아이콘 사이 간격의 최대 오차는 가로 1px, 세로 0px였다. 닫기 버튼이 고정된 채 앱 아이콘만 가로로 3px 이상 움직인 횟수는 0회였다. 캔버스 밖의 고정 HTML 표식도 함께 측정한 1,072장에서는 표식의 가로 오차가 0px였다.
- 두 시작 너비에서 네 모서리를 확인했다. 오른쪽 아래 드래그는 각 96개 입력 동안 창 경계가 초당 59.4회 바뀌었고 앱 아이콘의 움직임은 93회 관측됐다. 별도 본문 추적에서 왼쪽 위 드래그 중 표시 갱신은 1690px에서 초당 59.4회, 2300px에서 55.6회, 1열↔2열을 넘나들 때 49.9회였다. 전환 구간의 최대 표시 공백은 67.6ms였다. 측정 범위는 자동 마우스 입력과 Windows 합성 화면까지다.
- 드래그 도중 Esc로 취소하면 창과 자식 창의 좌표, DOM 크기가 모두 복원됐다. 최대화·최소화·복원 후 네이티브 클릭, 갤러리 스크롤, 색상 예제의 열 배치, 모달의 중앙 정렬과 입력값 유지, iframe 리사이즈, 새로고침을 확인했다. Windows 패키지 검사에도 새 크기를 적용한 직후 이전 래스터의 위치를 확인하는 회귀 검사를 추가했다. Testbed 3의 타입 검사와 Web 빌드, 루트와 하위 경로의 Web 백엔드 검사를 통과했다. [Windows 패키지 검사](Nelyx/eng/check-tauri-windows.mjs#L144) · [Web 백엔드 검사](Nelyx/eng/check-backend-web.mjs)

저장소 루트에서 `npm.cmd run deploy -- --platform windows --app Testbed3`로 빌드하고 실행한다. 실행 중인 프런트엔드·Rust 호스트의 빌드 ID는 `4377e8e4a09d2db533a218b31aa675afed0fa913325500defc7ebf68d1384bc3`다. 패키지와 대조한 SHA-256은 EXE `26143cb268edb7c97187dcef31557f6126ebcc75a17422347229c5c9d2da68e6`, NSIS `457663f07d62261ce3e7dc2f6d1238d5b435b26713150ab59ea2176717461629`다. [Testbed 3 EXE](sample/nelyx-testbed-app-3/.nelyx/tauri/windows-x64/nelyx-tauri.exe)
