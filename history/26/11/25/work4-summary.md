# 격리 웹 렌더러의 CanvasKit·Picture·프레임 제출

원문 `work4.md` · 작성·실행 2026-11-25 KST · 기준 `9c883ded` · CanvasKit `0.42.0` · 보관 2026-11-28 KST · 원문 조회 `git show 92b34484:work4.md`

**구현과 지정 기능 검증 완료, 종단 성능 판정 보류.** [세 렌더 경로와 기본값](../24/work3-summary.md)

## 구현

- CanvasKit JS·Wasm의 해시 검증 결과를 불변 Blob과 준비 Promise로 재사용한다. 메인과 워커는 각자의 CanvasKit 인스턴스를 초기화한다. 워커 정책 차단 시 직접 경로로 복구하고, 메인의 Wasm Blob 연결이 차단되면 검증한 바이트로 기동한다.
- `worker-shared`의 표시용 Picture는 메인에서 명령 캡처와 lease를 보관하고 워커에서 처음 컴파일한다. 메인 CPU·GPU 객체는 동기 readback이나 직접 복구에 필요할 때 생성한다. 메인과 워커의 캐시 예산에 실제 사용 바이트를 정산한다.
- 새 리소스 묶음과 첫 사용 프레임을 같은 메시지에 실어 워커가 의존 순서대로 등록한 뒤 그리게 했다. 공유 슬롯 소비와 GPU fence의 lease 반환을 각 수명에 맞춰 처리한다. 대형 프레임은 전송 버퍼를 쓰며 퇴출·부분 실패·세대 교체를 검사했다.

## 당시 검증과 성능

Windows Chrome과 Radeon 780M 하드웨어 WebGL2에서 같은 Demo 목록 이동 `0 → 120 → 0`을 전후 3회씩 비교했다. 캐시와 서비스 워커를 제한한 조건에서 CanvasKit JS·Wasm 원본 요청은 파일별 1회가 됐다. 공유 경로의 메인 Picture 컴파일은 54–56회 → 0회였고 첫 사용 프레임의 등록 ACK 대기도 0회였다.

| 격리 경로 | 첫 GPU 완료 중앙값 전 → 후 | 입력 → GPU 제출 p95 중앙값 전 → 후 | 메인 프레임 작업 p95 중앙값 전 → 후 |
| --- | --- | --- | --- |
| direct | 796.88 → 805.82ms | 29.19 → 25.00ms | 3.76 → 3.78ms |
| worker-transfer | 905.37 → 871.42ms | 30.18 → 32.06ms | 2.96 → 3.51ms |
| worker-shared | 873.68 → 901.17ms | 31.31 → 31.05ms | 2.38 → 2.74ms |

첫 GPU 완료와 공유 경로 지표의 반복 범위가 겹쳤다. 전송 경로는 메인 작업 p95가 늘고 완료 프레임 중앙값이 40 → 38로 줄었다. 기능 검사는 격리 세 경로와 비격리 전송의 픽셀·선택, PWA 오프라인·업데이트, 중첩 readback과 복구를 통과했다. Windows x64 패키지 `67cde4623369`는 오프라인 WebView2의 `auto`에서 격리 `worker-shared`를 선택했고 공유 슬롯 2개를 소비했다. [Web 비교 검사](../../../../Nelyx/eng/check-web-renderers.mjs) · [Windows 패키지 검사](../../../../Nelyx/eng/check-tauri-windows.mjs)
