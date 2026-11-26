# Nelyx Windows 창 크기 변경 추종

**IMPLEMENTED** · 2026-11-26 KST · Nelyx 기준 `14851cf0` · Doroti 비교 `35475819`

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

WebView2가 DOM에 새 뷰포트를 알린 뒤의 픽셀 배율과 프레임 제출을 개선했다. 자동으로 수행한 테두리 드래그에서 DOM이 보고한 크기 변경은 드래그당 한 번이었다. 손으로 천천히 왕복하는 동안의 DWM 표시 간격과 Doroti 네이티브 호스트와의 속도 차이는 추가 측정이 필요하다. 툴이 캡처한 전환 화면의 해상도와 뷰포트가 다를 때는 그 표본을 왜곡 여부 판정에서 제외한다.
