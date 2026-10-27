# Windows 창 크기 조절 FPS 개선 계획

- 작성일: 2026-10-27
- 상태: **PLANNED — 계획 작성만 완료, 구현 미착수**
- 대상: `sample/nelyx-testbed-app-2` 및 공통 Windows 리사이즈·프레임 처리 경로
- 기준 커밋: `708d9edffa5dab673e15e142c833286eeb4a6b72`
- 성능 수락: **`resizePerformanceAccepted=false`**

## 1. 목표와 선행 수정의 경계

사용자가 확인한 남은 문제는 Skia가 창 크기를 뒤늦게 따라오는 현상보다 **창의 실제 크기가 변하는 FPS 자체가 낮은 것**이다. 이전 동기화 수정을 유지하면서, 드래그 입력부터 실제 창 크기 변경과 콘텐츠 표시까지 걸리는 시간을 줄인다.

선행 수정의 프레임 사전 준비, 실제 크기 확인 후 적용, 최상위 HWND 직접 합성, 입력 전달과 종료 처리는 유지한다. 이번 작업은 이 경로의 처리량과 지연을 개선하는 후속 작업이다. 과거 엔진·컴파일러 작업 문서를 재개하지 않는다.

현재 턴에서는 소스를 읽고 이 계획만 작성한다. 이후 구현을 시작할 때 아래 단계의 상태와 최신 결과를 이 문서에 갱신한다.

## 2. 기준 상태와 아직 증명하지 않은 것

아래 실행 결과는 **앞선 작업에서 얻은 기록**이며 이번 계획 작성 중 다시 실행한 측정이 아니다.

| 항목 | 선행 기록 | 해석 |
| --- | --- | --- |
| 실행 구성 | Windows x64 Release, Hermes bytecode / optimized | 우선 비교할 실행 구성 |
| 실행 파일 SHA-256 | `99422cc8a9920dd9069059091d85a3f8d779ac5fdb4ee2b5f1ea1ce0b5573d1f` | 현재 빌드 manifest에서도 확인한 비교 식별자 |
| native inputs SHA-256 | `2bbc534572a81996b56325345cf190631c3399e35ea13e6fe3b31a957d38ea2e` | 현재 manifest의 공급 입력 식별자 |
| 화면 정합성 | Material·ListView·Cupertino × 우하단·좌상단, 총 6조합 / 304개 캡처 샘플 | 배경 노출·글자 크기 변화·표시 경계 불일치·준비 timeout 0건 |
| 실제 geometry 관찰 | 조합당 약 1초에 16~18회 | 낮은 갱신 빈도의 단서이며 정식 FPS 측정값은 아님 |
| JS 프레임 CPU p95 | 약 26~32ms | `Frame.cpu` 콜백 전체 비용이며 build/layout만의 비용은 아님 |
| 요청→surface update p95 | 약 58~83ms | 포인터 입력→geometry 또는 실제 표시 지연과 구분해야 함 |
| surface update 최대 간격 | 약 67~86ms | HWND 크기 변경 간격이나 scanout 간격으로 대체 해석하지 않음 |
| 일반 앱 확인 | 클릭·테마·휠·최대화·복원·종료 코드 0 | 연속 리사이즈 FPS 수락 근거는 아님 |

기존 입력 fixture는 기본 35ms 간격으로 24회 이동하며, 주기 허용 범위도 35~120ms다. 따라서 입력 발생 자체가 약 28.6Hz 이하로 제한되고, 이 검사로 60fps 개선을 입증할 수 없다. 기존의 최소 4회 갱신 조건은 멈춤 감지 조건으로만 유지한다.

새 작업의 시작 시 커밋, dirty 상태, 실행 구성, 공급 입력과 설치된 native header 바이트, 실제 실행 파일을 다시 확인한다. 버전 문자열이나 이전 실행 파일의 존재만으로 기준 일치를 인정하지 않는다.

## 3. 현재 코드에서 확인한 경로와 병목 후보

| 구간 | 주요 파일 | 확인할 비용 |
| --- | --- | --- |
| 제안 크기·실제 HWND 크기 처리 | `Nelyx/sdk/native/windows/WindowsAppHost.h` | `WM_SIZING`, `arrangeExtent`, `WM_WINDOWPOSCHANGED`, 중복 Arrange |
| UI 소유 작업·세대별 준비 대기 | `Nelyx/skia/packages/rn/native/windows/WindowsResizeCoordinator.h` | mailbox 도착, 실제 대기 시간, ready 판정, 취소된 제안 |
| Windows 프레임 예약 | `Nelyx/sdk/src/platforms/windows/frame-clock.ts` | native tick→JS dispatch, 다음 프레임까지의 예약 지연 |
| Core 프레임 처리 | `Nelyx/src/hosting/runtime.ts` | `updateMetrics`, pointer flush, pending 교체, frame 예약·admission |
| Widget·layout·paint·semantics | `Nelyx/src/framework/widgets/root.ts`, `Nelyx/src/framework/widgets/framework.ts`, `Nelyx/src/framework/rendering/semantics-pipeline.ts` | 크기 변경으로 발생하는 실제 재작업과 할당 |
| raster·copy·retirement | `Nelyx/skia/packages/rn/native/windows/RNSkWindowsWindowSurface.h`, `CompositionSurface.h` | worker 큐, GPU 처리·복사, fence, prepared frame 완료 |
| 합성·OS 대기 | `WindowsAppHost.h`, `Nelyx/skia/packages/rn/native/windows/CompositionDevice.h` | WinUI commit, native commit/`WaitForCommitCompletion`, `DwmFlush` |
| 계측·재현 | `Nelyx/skia/packages/rn/native/windows/WindowsFrameTrace.h`, `Nelyx/eng/tests/windows-animation.cpp`, `windows-animation.tsx`, `windows-resize-pixels.h` | 입력·geometry·표시 변화의 독립된 빈도와 지연 |

현재 `prepareSizing`은 최대 100ms의 프레임 준비 rendezvous 뒤 합성 클록을 최대 32ms 기다린다. 실제 크기가 확정되면 WinUI commit, native commit 처리 완료 대기, `DwmFlush`를 수행한다. **100ms와 32ms는 항상 소비하는 시간이 아니라 상한**이며, 실제 소비 시간과 겹치는 대기를 측정해야 한다. OS commit/flush 호출의 대기까지 이 상한으로 제한된다고 보지 않는다.

유력한 가설은 다음과 같다. 아직 원인 확정이나 제거할 대기의 목록으로 취급하지 않는다.

1. JS 프레임 예약, 준비 후 합성 클록, commit/flush가 여러 표시 주기를 직렬로 소비한다.
2. 크기 변경의 build/layout/paint/semantics 또는 프레임 직렬화 비용이 한 표시 주기의 예산을 넘는다.
3. 불필요한 native status, Arrange, pending frame 교체나 stale 작업 때문에 최신 크기의 준비가 늦어진다.
4. raster/copy/retirement의 admission 제약으로 CPU와 GPU가 겹쳐 일할 기회를 잃는다.

Doroti의 사전 준비·합성 클록 정렬·실제 geometry 직후 적용 방식은 참고하되, Nelyx의 D3D11 drawing surface와 JS 프레임 소유권에 필요한 대기를 별도로 증명한다. Doroti의 DXGI 표시 통계와 Nelyx의 commit 완료를 같은 완료 신호로 취급하지 않는다.

## 4. 유지해야 할 조건

- 배경 선행 칠하기, 오래된 이미지 확대·축소, padding·crop으로 미완성 영역을 숨기는 방식으로 FPS를 올리지 않는다.
- 실제 extent와 일치하는 prepared frame을 적용하고 owner/view/viewport/surface generation을 검증한다. A→B→A도 같은 세대로 간주하지 않는다.
- fence retirement, 취소·실패·닫기 완료와 native 객체의 UI/JS/GPU 소유권을 유지한다.
- resize 대기 중 일반 Win32/RNW 메시지를 재진입 처리하거나 UI 스레드에서 JS·raster를 실행하지 않는다.
- 입력, focus, IME, 접근성 action과 pointer capture를 성능용으로 끄거나 버리지 않는다. 크기만 바뀐 semantics geometry의 기존 지연 정책과 실제 action 처리를 구분한다.
- 같은 장면을 정확하게 더 빨리 처리하는 것을 우선한다. 엔진 전환, compiler 재설계나 샘플의 기능·위젯 수 감소를 기본 해법으로 삼지 않는다.
- 새로운 보관·재사용이 필요하면 owner, 보관 이익, 무효화·해제 시점, pressure/failure 동작을 명시한다. 임의의 전역 MB·cache 개수 상한으로 정당화하지 않는다.

## 5. 작업 단계

### S0 — FPS 재현과 비교 기준 확정

- [ ] 현재 Release 앱과 선행 정합성 검사를 짧게 재확인하고 기준 식별자를 갱신한다.
- [ ] 고해상도 단조 시계와 경과 시간 기반 궤적으로 입력 fixture를 확장한다. 60Hz를 첫 비교 입력으로 사용하고, 필요하면 대표 조합에서 120Hz를 추가한다.
- [ ] 요청한 입력 빈도와 실제 주입·처리 빈도를 모두 보고한다. OS의 mouse move 병합을 앱이 처리한 입력으로 세지 않는다.
- [ ] 같은 크기를 반복 통지한 횟수를 제외하고 실제 HWND/client rect 변화 시각과 XYWH를 기록한다. 왕복 궤적의 재등장 크기도 새로운 변화로 센다.
- [ ] 모니터/DPI/주사율, GPU, 엔진·compiler profile, 접근성 설정, warm-up, 측정 구간과 입력 속도를 고정한다.
- [ ] Material·ListView·Cupertino의 우하단/좌상단을 기준 조합으로 하고, 높은 빈도의 장시간 측정은 대표 조합부터 시작한다.

**완료 조건:** 입력 빈도, geometry FPS, surface update 빈도, 캡처에서 관찰한 표시 변화 빈도가 분리된 기준 표가 있어야 한다. 기존 35ms fixture의 수치를 60fps 성능 기준으로 재사용하지 않는다.

### S1 — 한 resize transaction의 시간 분해

- [ ] 입력 수신, `WM_SIZING` 진입/종료, metrics 송신·JS 수신, 프레임 예약/실행, build/layout/paint/semantics, 기록·제출을 구분한다.
- [ ] native admission, worker 대기, raster, copy, fence retirement, ready, stage 13 클록 대기, actual geometry, 각 commit/flush의 시작·종료를 연결한다.
- [ ] frame·surface·viewport·transaction 식별자와 clock domain을 보존한다. 서로 보정하지 않은 JS·QPC·capture 시각을 빼서 지연을 만들지 않는다.
- [ ] critical path와 중첩 구간을 그린다. CPU 전체 비용을 단순히 Core build 비용으로 부르거나 겹치는 시간을 중복 합산하지 않는다.
- [ ] 계측 켜기/끄기의 비용을 대표 사례에서 비교한다. bitmap readback과 고밀도 JS 래핑이 붙은 진단 실행은 최종 성능 수락에서 제외한다.

**완료 조건:** 낮은 FPS를 설명하는 주된 구간과 지불하지 않아도 될 것으로 의심되는 대기가 수치로 특정되어야 한다. 아래 단계는 확인된 병목의 순서대로 진행하며 불필요한 단계의 코드를 바꾸지 않는다.

### S2 — 프레임 예약과 직렬 대기 개선

- [ ] resize 준비 요청이 이미 프레임 tick에 정렬됐는데 다시 다음 tick을 기다리는지 확인한다.
- [ ] 필요한 경우 현재 프레임 scheduler·owner/admission 계약 안에서 resize 준비의 우선순위나 예약 방식을 개선한다. 기존 forced frame 경로를 무조건 우회 호출하지 않는다.
- [ ] 같은 extent·scale의 중복 Arrange/status와 아직 제출하지 않은 오래된 metrics 작업을 줄인다. 입력 순서와 이미 제출된 recording의 upload/retirement는 보존한다.
- [ ] pre-geometry clock, WinUI/native commit, 완료 대기, `DwmFlush` 각각의 역할을 검증한다. 측정 근거가 있는 중복 대기만 한 항목씩 줄이거나 합친다.
- [ ] 취소·실제 크기 불일치·DPI 변경·최소화·종료 시 즉시 기존 안전 경로로 수렴하게 한다.

**완료 조건:** 동일 입력에서 geometry 간격이 개선되고 기존 정합성 검사가 유지된다. timeout을 늘리거나 창이 콘텐츠보다 먼저 커지도록 바꾸는 것으로 완료하지 않는다.

### S3 — 크기 변경의 Core CPU 비용 절감

- [ ] S1에서 큰 것으로 확인한 build/layout/paint/semantics·직렬화 구간부터 최적화한다.
- [ ] viewport 크기 변경과 environment/theme/DPI·renderer 교체의 invalidation 범위를 구분한다. 크기에 의존하는 위젯은 반드시 다시 계산한다.
- [ ] 불필요한 전체 subtree 재빌드, 반복 paragraph/layout 계산, 동일한 불변 데이터 생성과 semantics geometry 재작업을 확인한다.
- [ ] 기존 semantics 지연만으로 CPU를 숨기지 않는다. action·focus·텍스트 입력 geometry의 즉시성과 접근성 켜짐 상태를 유지한다.
- [ ] 재사용을 도입하면 dependency·generation·해제 규칙을 함께 구현하고, 가변 label/callback/스타일이 오래된 값으로 남지 않는 회귀 검사를 붙인다.

**완료 조건:** 프레임 CPU의 실제 감소와 geometry FPS 개선이 함께 나타나야 한다. 빈 RAF나 idle 구간을 섞어서 평균만 낮추지 않는다.

### S4 — GPU·복사·준비 처리량 개선

- [ ] S1에서 GPU나 admission 직렬화가 남은 병목일 때 진행한다.
- [ ] 현재 준비 프레임과 아직 제출하지 않은 최신 CPU 작업이 안전하게 겹칠 수 있는지 검토한다. 오래된 제안을 쌓는 queue를 만들지 않는다.
- [ ] surface/texture 생성, GPU copy, fence/commit 대기 비용을 분리하고 필요한 재사용만 적용한다.
- [ ] 늦게 끝난 프레임은 실제 크기·세대에 맞을 때만 표시한다. superseded 작업도 upload/retirement와 자원 해제를 끝낸다.
- [ ] 버퍼·bridge capacity 변경 시 Window/device owner의 보관·해제 정책과 실패 동작을 검증한다.

**완료 조건:** GPU/critical path 지연이 감소하고 취소·닫기 후 자원과 consumer가 남지 않는다. 근거 없이 swap chain이나 전체 renderer를 교체하지 않는다.

### S5 — 통합 수락·배포 출력·정리

- [ ] 낮은/높은 입력 빈도, 양방향 왕복, 네 변과 모서리의 대표 사례, 창 이동을 동반하는 좌상단 변경을 확인한다.
- [ ] 고정 typography 구간은 기존 glyph·marker 검사를 유지한다. 반응형 breakpoint를 넘는 별도 사례는 정상적인 글꼴·layout 전환의 예상값을 사용한다.
- [ ] 실제 OS 입력으로 클릭·휠·capture loss·드래그 유지, 최대화/복원, 취소, 종료를 확인한다. 물리 IME·터치패드 미검증은 별도 표기한다.
- [ ] 변경한 영역의 회귀 검사·typecheck, Release 빌드, 설치 header 바이트와 실행/패키지 SHA 일치를 확인한다.
- [ ] 대표 사용자 드래그에서 창 자체의 부드러움과 콘텐츠 정합성을 함께 확인한다. 자동 캡처 결과로 사용자의 체감이나 전체 scanout을 대신 수락하지 않는다.
- [ ] 최신 결과·미달 항목·다음 시작점만 이 문서에 남기고, 제품 실행 방법은 기존 README에 반영한다.

## 6. 성능과 화면 품질의 수락 기준

아래 수치는 **개선 목표이며 아직 달성한 결과가 아니다.** 첫 성능 목표는 60Hz에 상응하는 연속 크기 변경이다. 실제 주사율과 입력 한계를 기록하고, 60Hz보다 낮은 환경은 도달 가능한 주기에 정규화한다. 제품에 60fps 고정 제한을 추가하는 뜻이 아니다.

`R = min(실제 표시 주사율, 60)`, `B = 1000/R ms`로 첫 목표를 정의한다. 입력 주입이 최소 `R`을 충족하고 계측 overhead가 통제된 구간에서 판정한다.

| 지표 | 목표 |
| --- | --- |
| 실제 geometry 변화 FPS | 각 기준 조합에서 `0.85 × R` 이상 — 60Hz 기준 51회/초 이상 |
| geometry 변화 간격 | 중앙값 `1.2B` 이하, p95 `2B` 이하, 최대 `4B` 이하 |
| 입력→일치하는 actual geometry 적용 | p95 `3B` 이하; 좌표·시계 연결이 유효한 표본만 사용 |
| metrics 수신→prepared copy ready | p95 `B` 이내를 목표로 critical path 단축 |
| CPU | 큰 CPU 구간을 별도 예산화하고, 프레임 CPU p95는 `0.6B` 이내를 목표로 함 |
| 표시 변화 빈도 | 같은 desktop frame의 caption/client 경계 변화로 별도 보고; capture 누락 시 수락 보류 |
| 기존 화면 품질 | 배경 노출·글자 늘어남·잘못된 세대 표시·marker X/Y 경계 불일치 0건 |
| 수명·입력 | cancel/close/focus/capture 회귀 없음, 정상 종료 시 GPU·입력 owner 정리 |

FPS는 측정 구간의 연속적인 rect 변화로 구한다. 전체 구간에서 서로 다른 width의 개수, `WM_SIZING` 호출 수, surface update 수를 표시 FPS로 대체하지 않는다. p95는 전체 유효 분포를 사용하고 시작·종료와 responsive reflow 비용을 따로 보고하되 숨기지 않는다.

목표에 미달하면 개선 전후 수치와 남은 critical path를 적고 **`PARTIAL` / `resizePerformanceAccepted=false`**로 남긴다. 단순한 배율 개선, 빌드 통과, 기존 정합성 검사 통과만으로 성능 수락을 완료하지 않는다.

## 7. 검증 운영

- 모든 테스트는 20분 timeout을 사용한다. 예: `node --test --test-timeout=1200000 <변경 영역의 test.mjs>`.
- 기준 측정→주요 병목별 대표 사례→전체 수락 조합 순서로 진행한다. 일반 검증은 30회 이내로 제한하고 같은 바이너리를 이유 없이 반복 실행하지 않는다.
- 동일 장면·궤적·설정으로 비교하고, 한 번에 원인이 다른 최적화를 섞지 않는다. 개선되지 않거나 화면 품질을 깨뜨린 변경은 제거한다.
- 드래그 시작 전 실제 OS move 입력으로 커서를 테두리에 옮기고 hover/포인터 피드백을 정리한다. 안정된 resting 캡처로 기준을 잡되 드래그 중 불리한 프레임은 버리지 않는다.
- 측정은 앱이 소유한 영역으로 제한한다. 원본 캡처·긴 trace·과거 실행 receipt·consumer 설치본·profile을 누적하지 않는다.
- 한 실행에 필요한 임시 디렉터리만 쓰고 `finally`에서 성공·실패·중단 모두 정리한다. 현재 실행 안에서는 가능하면 증분 native 빌드를 사용하되, 설치된 header의 내용 변경을 timestamp나 버전 문자열만으로 놓치지 않는다.
- 패키지는 현재 dist만 남기고 staging/이전 출력은 정리한다. `Nelyx/docs/plans/`, `Nelyx/docs/migrations/` 또는 새 history 보관 경로를 만들지 않는다.

## 8. 현재 진행 상태와 다음 시작점

| 단계 | 상태 | 다음 행동 |
| --- | --- | --- |
| 계획 작성 | DONE | 현재 소스·manifest 확인 및 이 문서 작성 |
| S0 FPS 기준 | NOT_STARTED | 35ms fixture의 입력 제한부터 해소하고 geometry 시각 측정 |
| S1 시간 분해 | NOT_STARTED | transaction별 예약·CPU·GPU·각 대기의 critical path 확인 |
| S2 예약·대기 | NOT_STARTED | S1에서 증명한 직렬 대기부터 개선 |
| S3 Core CPU | NOT_STARTED | 큰 CPU 구간에 한정해 변경 |
| S4 GPU·처리량 | NOT_STARTED | GPU/admission이 남은 병목인 경우 진행 |
| S5 통합 수락 | NOT_STARTED | 수치·화면 품질·사용자 체감 및 배포 출력 확인 |

이 계획 작성 중에는 코드 수정, 앱 실행, 빌드와 성능 재측정을 수행하지 않았다. 다음 구현은 S0에서 시작한다.
