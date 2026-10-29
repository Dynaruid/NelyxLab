# Windows 창 크기 조절 및 All Components 스크롤 개선

- 작성일: 2026-10-27
- 상태: **PARTIAL — 2026-10-28 최신 AOT의 세 화면 연속 OS 휠·정상 종료 및 사용자 트랙패드 시작·연속·재접촉 확인 PASS-scoped. AOT 리사이즈 10사례·1,533캡처 통과. 51 geometry 변화/s·CPU p95 10ms는 미달이며 `resizePerformanceAccepted=false` 유지**
- 대상: `sample/nelyx-testbed-app-2` 및 공통 Windows 리사이즈·프레임 처리 경로
- 계획 기준 커밋: `708d9edffa5dab673e15e142c833286eeb4a6b72` / 구현 시작: `dd98826b25b19c158258d6df24ffc99d8c19af52`
- 성능 수락: **`resizePerformanceAccepted=false`**
- All Components 후속: **§22 사용자 즉시 종료 요청으로 중단 / PARTIAL. §21 AOT는 사용자 체감 미수락이다. §22 입력 경로 진단과 source 수정·257 PASS·typecheck까지 완료했고, native 12구간 검증은 중단했다. §22 변경은 새 AOT에 아직 반영되지 않았다. 마지막 전달 제품 지문은 §21이며 이전 AOT 임시 산출물 삭제 차단 상태는 유지한다.**

## 1. 목표와 선행 수정의 경계

사용자가 확인한 남은 문제는 Skia가 창 크기를 뒤늦게 따라오는 현상보다 **창의 실제 크기가 변하는 FPS 자체가 낮은 것**이다. 이전 동기화 수정을 유지하면서, 드래그 입력부터 실제 창 크기 변경과 콘텐츠 표시까지 걸리는 시간을 줄인다.

선행 수정의 프레임 사전 준비, 실제 크기 확인 후 적용, 최상위 HWND 직접 합성, 입력 전달과 종료 처리는 유지한다. 이번 작업은 이 경로의 처리량과 지연을 개선하는 후속 작업이다. 과거 엔진·컴파일러 작업 문서를 재개하지 않는다.

2026-10-27 사용자의 전체 작업 요청으로 구현을 시작했다. 2026-10-28 기반 전반 검토 요청에 따라 공통 Core의 paint·제출·무효화 계약도 개선했다. 최신 단계별 결과는 §8에 갱신한다.

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

- [x] 현재 Release 앱과 선행 정합성 검사를 짧게 재확인하고 기준 식별자를 갱신한다.
- [x] 고해상도 단조 시계와 경과 시간 기반 궤적으로 입력 fixture를 확장한다. 60Hz를 첫 비교 입력으로 사용하고, 필요하면 대표 조합에서 120Hz를 추가한다.
- [x] 요청한 입력 빈도와 실제 주입·처리 빈도를 모두 보고한다. OS의 mouse move 병합을 앱이 처리한 입력으로 세지 않는다.
- [x] 같은 크기를 반복 통지한 횟수를 제외하고 실제 HWND/client rect 변화 시각과 XYWH를 기록한다. 왕복 궤적의 재등장 크기도 새로운 변화로 센다.
- [x] 모니터/DPI/주사율, GPU, 엔진·compiler profile, 접근성 설정, warm-up, 측정 구간과 입력 속도를 고정한다.
- [x] Material·ListView·Cupertino의 우하단/좌상단을 기준 조합으로 하고, 높은 빈도의 장시간 측정은 대표 조합부터 시작한다.

**완료 조건:** 입력 빈도, geometry FPS, surface update 빈도, 캡처에서 관찰한 표시 변화 빈도가 분리된 기준 표가 있어야 한다. 기존 35ms fixture의 수치를 60fps 성능 기준으로 재사용하지 않는다.

### S1 — 한 resize transaction의 시간 분해

- [ ] 입력 수신, `WM_SIZING` 진입/종료, metrics 송신·JS 수신, 프레임 예약/실행, build/layout/paint/semantics, 기록·제출을 구분한다.
- [ ] native admission, worker 대기, raster, copy, fence retirement, ready, stage 13 클록 대기, actual geometry, 각 commit/flush의 시작·종료를 연결한다.
- [x] frame·surface·viewport·transaction 식별자와 clock domain을 보존한다. 서로 보정하지 않은 JS·QPC·capture 시각을 빼서 지연을 만들지 않는다.
- [x] critical path와 중첩 구간을 그린다. CPU 전체 비용을 단순히 Core build 비용으로 부르거나 겹치는 시간을 중복 합산하지 않는다.
- [x] 계측 켜기/끄기의 비용을 대표 사례에서 비교한다. bitmap readback과 고밀도 JS 래핑이 붙은 진단 실행은 최종 성능 수락에서 제외한다.

**완료 조건:** 낮은 FPS를 설명하는 주된 구간과 지불하지 않아도 될 것으로 의심되는 대기가 수치로 특정되어야 한다. 아래 단계는 확인된 병목의 순서대로 진행하며 불필요한 단계의 코드를 바꾸지 않는다.

### S2 — 프레임 예약과 직렬 대기 개선

- [x] resize 준비 요청이 이미 프레임 tick에 정렬됐는데 다시 다음 tick을 기다리는지 확인한다.
- [ ] 필요한 경우 현재 프레임 scheduler·owner/admission 계약 안에서 resize 준비의 우선순위나 예약 방식을 개선한다. 기존 forced frame 경로를 무조건 우회 호출하지 않는다.
- [ ] 같은 extent·scale의 중복 Arrange/status와 아직 제출하지 않은 오래된 metrics 작업을 줄인다. 입력 순서와 이미 제출된 recording의 upload/retirement는 보존한다.
- [x] pre-geometry clock, WinUI/native commit, 완료 대기, `DwmFlush` 각각의 역할을 검증한다. 측정 근거가 있는 중복 대기만 한 항목씩 줄이거나 합친다.
- [ ] 취소·실제 크기 불일치·DPI 변경·최소화·종료 시 즉시 기존 안전 경로로 수렴하게 한다.

**완료 조건:** 동일 입력에서 geometry 간격이 개선되고 기존 정합성 검사가 유지된다. timeout을 늘리거나 창이 콘텐츠보다 먼저 커지도록 바꾸는 것으로 완료하지 않는다.

### S3 — 크기 변경의 Core CPU 비용 절감

- [ ] S1에서 큰 것으로 확인한 build/layout/paint/semantics·직렬화 구간부터 최적화한다.
- [x] viewport 크기 변경과 environment/theme/DPI·renderer 교체의 invalidation 범위를 구분한다. 크기에 의존하는 위젯은 반드시 다시 계산한다.
- [ ] 불필요한 전체 subtree 재빌드, 반복 paragraph/layout 계산, 동일한 불변 데이터 생성과 semantics geometry 재작업을 확인한다.
- [ ] 기존 semantics 지연만으로 CPU를 숨기지 않는다. action·focus·텍스트 입력 geometry의 즉시성과 접근성 켜짐 상태를 유지한다.
- [x] 재사용을 도입하면 dependency·generation·해제 규칙을 함께 구현하고, 가변 label/callback/스타일이 오래된 값으로 남지 않는 회귀 검사를 붙인다.

**완료 조건:** 프레임 CPU의 실제 감소와 geometry FPS 개선이 함께 나타나야 한다. 빈 RAF나 idle 구간을 섞어서 평균만 낮추지 않는다.

### S4 — GPU·복사·준비 처리량 개선

- [x] S1에서 GPU나 admission 직렬화가 남은 병목일 때 진행한다. 현재는 CPU가 우선이므로 GPU 구조 변경을 진행하지 않는다.
- [ ] 현재 준비 프레임과 아직 제출하지 않은 최신 CPU 작업이 안전하게 겹칠 수 있는지 검토한다. 오래된 제안을 쌓는 queue를 만들지 않는다.
- [ ] surface/texture 생성, GPU copy, fence/commit 대기 비용을 분리하고 필요한 재사용만 적용한다.
- [ ] 늦게 끝난 프레임은 실제 크기·세대에 맞을 때만 표시한다. superseded 작업도 upload/retirement와 자원 해제를 끝낸다.
- [ ] 버퍼·bridge capacity 변경 시 Window/device owner의 보관·해제 정책과 실패 동작을 검증한다.

**완료 조건:** GPU/critical path 지연이 감소하고 취소·닫기 후 자원과 consumer가 남지 않는다. 근거 없이 swap chain이나 전체 renderer를 교체하지 않는다.

### S5 — 통합 수락·배포 출력·정리

- [x] 낮은/높은 입력 빈도, 양방향 왕복, 네 변과 모서리의 대표 사례, 창 이동을 동반하는 좌상단 변경을 확인한다.
- [x] 고정 typography 구간은 기존 glyph·marker 검사를 유지한다. 반응형 breakpoint를 넘는 별도 사례는 정상적인 글꼴·layout 전환의 예상값을 사용한다. 현재 short header 18px·padding 16↔28 범위이며 높이 600 이상 28/36px 제목은 별도 notVerified다.
- [ ] 실제 OS 입력으로 클릭·휠·capture loss·드래그 유지, 최대화/복원, 취소, 종료를 확인한다. 물리 IME·터치패드 미검증은 별도 표기한다.
- [x] 변경한 영역의 회귀 검사·typecheck, Release 빌드, 설치 header 바이트와 실행/패키지 SHA 일치를 확인한다. deadline·실패 취소 보완도 §9의 최신 AOT에 반영됐으며 §10에서 현재 공급·패키지와 세 화면 연속 OS 휠을 다시 확인했다. 최신 리사이즈 성능 검증은 별도다.
- [ ] 대표 사용자 드래그에서 창 자체의 부드러움과 콘텐츠 정합성을 함께 확인한다. 자동 캡처 결과로 사용자의 체감이나 전체 scanout을 대신 수락하지 않는다.
- [x] 최신 결과·미달 항목·다음 시작점만 이 문서에 남기고, 제품 실행 방법은 기존 README에 반영한다.

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

## 8. 현재 결과와 남은 작업

- 아래는 중간 마무리 당시의 결과다. **2026-10-28 / 리사이즈 PAUSED / PARTIAL / `resizePerformanceAccepted=false`**로 구현·고비용 검증을 중단했다. 이후 실제 AOT 사용 확인에서 사용자는 **창 크기 조절 FPS는 괜찮게 느껴진다**고 답했으나 §6 수치 수락으로 옮기지 않는다. 트랙패드와 마우스 휠의 간헐적 먹통 조사 이력은 §9, 이번 전체 작업 재개의 최신 상태는 §10을 따른다.
- 이번 재개 시작점은 `491ea1d`, 당시 dirty 없음이었다. 중간 마무리 뒤 저장소 HEAD가 `a09b23b0216f2827887de1a00a6a8bb8f8a2e251`이고 clean인 것을 확인했다. 추가 조사에서 새 commit은 만들지 않았다. 리사이즈 test·compiler는 멈췄으며 사용자 재현용 진단 앱은 §9에 따라 켜두었다. 과거 엔진·컴파일러 계획은 재개하지 않았다.

| 단계 | 상태 | 현재 결과와 남은 범위 |
| --- | --- | --- |
| S0 FPS 기준 | DONE-scoped | QPC·시간 기반 왕복 입력, 주입/WM_SIZING/연속 HWND rect/surface/desktop 변화 구분 |
| S1 시간 분해 | PARTIAL | Core metrics·예약·layout/paint/semantics/capture와 native frame을 QPC로 연결. 세부 native 구간·transaction 전체 연결과 지속적인 overhead 수락은 남음 |
| S2 예약·대기 | PARTIAL | width 68/68·height 101/101 metrics가 기존 예약 재사용. metrics→build p95 3.99/4.37ms. height의 native 대기도 분리했으나 동기화 변경은 없음 |
| S3 Core CPU | PARTIAL | 동일 primitive picture·불변 상태값·변경 batch의 하위 scope 재사용 검증. deadline 대기의 조기 Root 실행은 source에서 제거했지만 native FPS 개선·추가 build 감소는 입증하지 못함 |
| S4 GPU·처리량 | CONDITIONAL | 현재 CPU가 우선. GPU buffer/admission/renderer 구조와 자원 소유권 변경 없음 |
| S5 통합 수락 | PARTIAL | picture 재사용 Core의 10 resize 사례·실제 Release 스크롤 통과. 뒤이은 deadline 수정은 아직 실제 AOT에 미반영. 과거 실패·큰 창 전환 timeout·물리 표시 수락 경계 유지 |

### 구현과 보관·해제 계약

- 실제 extent·owner/view/viewport/surface 세대를 맞춘 prepared frame만 적용한다. 100ms 준비 deadline을 넘으면 USER32 제안을 실제 기존 rect로 되돌리고 canonical metrics를 복원한다. view별 취소 세대 fence가 늦은 producer의 표시를 막지만 upload/retirement는 완료한다. view unbind 때 fence를 해제한다. 과거 제안 queue나 장면·GPU 객체를 보관하지 않는다.
- GPU copy retirement → pre-geometry clock → 실제 geometry → WinUI/native commit 완료 → DwmFlush를 유지한다. 대기 제거 실험은 확장 화면 검사 실패로 철회했다. 배경 선행 칠하기·과거 이미지 확대·crop으로 정합성을 숨기지 않는다.
- Root paint 재사용·visual/submitted epoch·admission 기반 제출 생략은 명시적 redraw와 persistent callback의 두 번째 제출 누락(`1 !== 2`)으로 철회했다. `FrameworkRoot`는 요청 프레임마다 recordPaint → compose → capture → submit한다. repaint boundary의 paint 진입 version 보존은 유지한다.
- 새 수정은 **깊이 검증된 immutable primitive 명령과 resource owner가 같은 batch**에 한정한다. viewport bounds만 바뀌면 기존 PictureLayer의 bounds metadata를 현재 값으로 갱신하고 같은 picture producer를 이동한다. Picture는 CPU 명령의 소유자이며 이전 크기의 raster 이미지가 아니다. 독립 Scene/제출 프레임은 각자의 자원 hold를 유지한다. 명령·스타일·resource owner/generation 변경과 실패는 기존 재기록·해제 경로를 따른다. layer 퇴역 때 producer를 해제하며 전역 cache·임의 MB/capacity 제한을 추가하지 않는다.
- 수정 전 같은 primitive batch의 viewport 변경에서 컴파일 수 **`4 !== 2`** 실패를 재현했다. 수정 후 root/child layer 양쪽의 A→B→A, 현재 bounds, 바뀐 색, annotation 좌표, 이전 제출 프레임의 독립 수명과 정상 해제를 확인했다. 실제 CanvasKit 픽셀에서도 옛 bounds 밖의 내용이 새 viewport에서 정확히 드러나고 다시 가려지는 것을 확인했다.
- built-in Canvas/PaintingContext는 자원이 없는 save/restore 명령과 Core가 캡처한 불변 행렬의 transform 명령을 공유한다. 행렬의 finite SkScalar 검증은 유지한다. 임의의 frozen 외부 배열·stateful iterator는 새로 캡처·검증하며, custom recording hook에는 매번 독립적인 가변 인자를 준다. 행렬→명령과 명령→검증된 composition metadata는 WeakMap/WeakSet이므로 render/scene/recording이 놓은 값을 전역 cache가 붙들지 않는다. 캡처된 ResourceId 바인딩은 재바인딩할 수 없으므로 owner 비교 결과도 같은 수명을 따른다.
- 처음에는 기존의 큰 batch를 유지한다. 이후 명령 수와 op 순서가 맞는 직전 batch에서만 값·자원 owner를 비교하고, 바뀐 내용 주변의 state를 현재 composition program으로 옮겨 불변의 균형 잡힌 하위 scope를 분리·재사용한다. 연속 draw를 하나씩 분할하지 않는다. 분할 경계는 같은 내용의 다음 프레임에도 유지하고, 구조 변경은 전체 batch로 복귀한다. 보관 범위는 현재 body의 명령·part 수이며 검색 history·새 임의 capacity는 없다. body/Layer 퇴역 때 producer와 상태 hold를 해제하고, 기존 native picture LRU·frame budget·실패 rollback을 유지한다. 이전 제출 프레임은 독립 hold로 살아 있다.
- 실제 샘플의 **source recipe 진단**에서는 width 변경 때 backend compile에 넘긴 명령이 워밍업 뒤 **856→6개/frame**, source fixture의 FramePictureService 항목은 **32개**였다. 이 진단의 backend는 CPU fixture이며 실제 native compile 시간·GPU 수락이 아니다. 같은 V8 sampled-allocation 진단 24프레임에서 paint 표본은 **27.06→24.16MB**, 전체는 **66.00→63.24MB**, composition metadata 함수의 paint당 표본은 약 **120→38KB**였다. 이를 Hermes 메모리·FPS 개선율로 옮기지 않는다.
- 크기 변경 한 번 뒤 기존 semantics 간격 50ms를 기다리는 source 재현에서 Root가 **9회** 깨어났다. 새 `requestFrameAt`은 View의 같은 owner clock에서 deadline을 기다리며, 그 전 tick에는 Root를 build하지 않는다. due callback과 redraw는 같은 tick에 합쳐지고 일반·forced·action 요청은 먼저 실행될 수 있다. View/Root/scheduler 종료·숨김·실패 때 callback을 해제하며 다른 View의 예약을 취소하지 않는다. 시간 배율은 시스템 시각의 기존 deadline을 늦추지 않는다. 실제 요청 프레임은 계속 paint/capture/submit한다. source와 bytecode native 검사를 통과했지만 native의 추가 Root 실행과 FPS는 이전과 비슷하므로 주된 병목으로 확정하지 않는다.
- 후속 수명 검사에서 native 실패 통지 뒤 deferred callback이 owner 종료까지 남는 **`1 !== 0`**을 재현했다. 실패 통지·불확실 제출·제출 예외에서 callback을 즉시 놓도록 보완했고, 관련 **131/131** source 회귀를 다시 통과했다. 이 마지막 보완은 아래 bytecode 성능 측정 뒤 추가했으며 아직 실제 AOT에는 반영하지 않았다.
- 창의 수직·수평 휠을 이미 처리했으면 0을 반환해 자식 HWND의 동일 휠이 부모에서 재전달되지 않게 한다. 닫기를 수락하면 입력·가시성을 먼저 차단하고 창을 숨긴 뒤 기존 ACK/GPU drain으로 owner를 파괴한다. 신규 Skia binding은 active 세션에만 허가한다. 이 native 수정은 재개 전 최종 공급본을 유지한다.

### 동일 조건 비교와 최신 resize 결과

- 환경은 주 모니터 **2560×1600 / 165Hz / DPI 192**, AMD Radeon 780M이다. 비교 fixture는 **Hermes bytecode / optimized / x64 Release**, 실제 사용 패키지는 **Static Hermes / optimized / x64 Release**다. 두 모드의 성능을 합치지 않는다. 접근성 켜짐·semantics 간격 50ms, 준비 500ms, 캡처 hover 정리 300ms, 왕복 입력 4초를 사용했다.
- 초기 bounds 수정의 같은 설치 경로·Material 우하단·61Hz·capture on/trace off 한 쌍은 geometry **15.83→16.83/s**, desktop 변화 **15.59→16.58/s**, geometry 간격 p95 **72.86→66.72ms**, resize CPU p95 **40.93→32.20ms**였다. 화면 오류·timeout·제안 거절 0건, 취소·종료 drain PASS다. 이후 baseline 확장의 CPU는 **36.50~40.75ms**였다. 한 쌍의 32.20ms를 일관된 최종 성능으로 부르지 않는다.
- 고밀도 진단의 native picture compile은 **418/121→383/129 frame**, 즉 frame당 약 **3.45→2.97회**였다. 동일 primitive의 재컴파일 절감은 확인했지만 고밀도 진단의 CPU와 작은 실행 간 차이는 최종 FPS 수락에 쓰지 않는다.

아래는 deadline 수정 Core `18c6eaac04110daaea777ac29714283429ceab10b29d7bb3d0a85abbfa0ffe20`의 기본 6조합이며 capture on·trace off다. 입력·geometry·surface·desktop 변화의 정의는 §6을 따른다. 직전 picture 재사용 Core는 geometry **17.44~18.43/s**, resize CPU p95 **30.39~37.03ms**였다. 뚜렷한 추가 FPS 개선은 입증하지 못했으며 두 실행을 반복 분포나 최종 성능 수락으로 확대하지 않는다.

| 장면 / 모서리 | 실제 입력Hz | geometry/s | desktop 변화/s | geometry 간격 p95 | resize CPU p95 |
| --- | --- | --- | --- | --- | --- |
| Material / bottom-right | 60.98 | 17.91 | 17.66 | 66.57ms | 34.69ms |
| Material / top-left | 60.98 | 18.13 | 17.89 | 60.79ms | 30.08ms |
| ListView / bottom-right | 60.99 | 17.86 | 17.61 | 66.69ms | 34.56ms |
| ListView / top-left | 60.98 | 17.98 | 17.73 | 61.04ms | 34.12ms |
| Cupertino / bottom-right | 60.99 | 17.76 | 17.51 | 66.71ms | 37.51ms |
| Cupertino / top-left | 60.99 | 17.72 | 17.72 | 66.67ms | 34.35ms |

- deadline Core의 **10 resize 사례**(기본 6·최소 계측·width/height QPC·breakpoint)는 **종료 코드 0**이다. capture on 7사례의 **1,538개**에서 배경·glyph 크기·우측 marker·예상 origin·실제 geometry/generation 오류 0건이다. capture off 3사례는 화면 `notObserved`다. **5개 앱** 모두 정상 close/drain이다. 최소 계측 Material 우하단은 **17.27 geometry/s**, CPU p95 **37.77ms**로 여전히 목표 미달이다. 직전 picture 재사용 Core의 10사례·1,540캡처 통과와 구분한다.
- metadata 재사용 직전의 같은 scope 분할본에서도 13사례를 통과했다. 120ms 강제 지연은 timeout·제안 거절 **각 2건** 뒤 실제 기존 크기로 복귀했다. 120Hz 입력의 geometry는 **17.93/s**, height-only 위/아래는 **26.45/26.74/s**, CPU p95 **12.40/13.18ms**였다. 이전 bounds-only 16사례/3,016캡처·두 추가 진단도 통과했으나 현재 Core의 전체 네 변·20Hz 재실행으로 대체하지 않는다. 이전 왼쪽/오른쪽 **16.24/16.08/s**, 20/120Hz 실제 입력 **20.00/119.98Hz** 기록도 그 당시 범위다.
- 최신 600 logical px breakpoint는 **16.03 geometry/s**, CPU p95 **91.38ms**, timeout·제안 거절 **각 4건**이다. 캡처 219개에서 source-defined origin 두 전환과 최대 오차 **0px**를 확인했다. 제목은 short header의 **18px 고정**이며 padding **16↔28 logical px**만 변한다. 앞선 별도 진단의 **1208px에서 x=59 / 1190px에서 x=35**, 217캡처·CPU p95 103.97ms·각 4 timeout/거절 기록도 같은 구분을 뒷받침한다. 첫 일반 origin 검사의 35→59px는 정상 padding 전환이었다. 높이 600 logical px 이상 제목 **28/36px** 전환은 별도 `notVerified`다.

### QPC 진단의 범위

```mermaid
flowchart LR
  proposal[WM_SIZING 제안] --> arrange[Arrange와 native layout 요청]
  arrange --> metrics[Core metrics 수신]
  metrics --> scheduled[기존 예약과 Core build]
  scheduled --> cpu[layout와 paint와 semantics와 capture]
  cpu --> submit[같은 frame의 native 제출]
  submit --> gpu[producer와 UI copy와 retirement]
  gpu --> ready[prepared copy]
  ready --> clock[pre-geometry clock]
  clock --> actual[실제 HWND geometry]
  actual --> commit[WinUI와 native commit과 DwmFlush]
  cpu -. 다음 프레임 예약 .-> scheduled
```

한 프레임의 의존 순서다. 다음 JS callback과 이미 제출한 native packet의 worker/retirement는 겹칠 수 있다. 이를 구간별 p95 합계로 해석하지 않는다.

- opt-in trace에서 JS Core metrics 수신·기존 예약 유무·새 예약·Root 실행·layout·recordPaint·compose·semantics·capture의 시작/끝을 **native QPC 직접 호출**로 기록한다. JS performance 시각과 보정하지 않은 뺄셈을 하지 않는다. View/owner/viewport/surface/context/frame 식별자를 유지하고 관찰은 실행별 숫자 배열 4,096개 이내이며 장면·callback·파일 로그를 보관하지 않는다.
- 최신 width 진단은 **2,022 event·invalid 0**, metrics **68/68회** 기존 예약 재사용, 첫 build **68/68개**가 정확한 native prepared copy에 대응했다. 총 build는 **139개**다. native layout 요청→Core metrics 수신 p95 **3.67ms**, metrics→build **3.99ms**, metrics→prepared copy retirement **47.78ms**다. 이 cohort의 p95는 Root build **34.87ms**, recordPaint **17.50ms**, compose **6.90ms**, capture **0.25ms**, build 종료→native 제출 **1.69ms**다. layout은 136 flush / p95 **11.92ms**, semantics는 3 flush / p95 **10.96ms**다. 직전 138 build / 67 metrics와 비슷하며 여전히 paint/layout 비용이 크다.
- 최신 height 진단은 **3,003 event·invalid 0**, metrics **101/101회** 기존 예약 재사용, 첫 build **101/101개**가 prepared copy에 대응하며 총 build는 **207개**다. 해당 Root build의 중앙값/p95는 **7.51/17.11ms**, recordPaint **1.85/5.97ms**, compose **1.05/2.13ms**다. metrics→build p95 **4.37ms**, metrics→prepared copy retirement p95 **29.79ms**인데 geometry는 **25.02/s**다. UI 측 prepare-after-arrange 중앙값은 **18.51ms**이며, 그 뒤 pre-geometry clock **3.05ms**, WinUI commit **0.38ms**, native commit 완료 **7.27ms**, DwmFlush tail **5.00ms**의 각 중앙값을 관찰했다. 직전 212 build / 103 metrics와 비슷하다. 준비와 native 동기화 양쪽을 계속 줄여야 하며 이 구간들의 p95를 합하지 않는다.
- 전체 활성 프레임의 Root build/layout/paint/semantics/capture는 중첩된다. 전체 활성 프레임의 제출 대기를 resize 준비의 critical path로 대체하지 않는다. native prepared copy는 실제 표시 receipt가 아니며, GPU producer/queue와 copy/retirement도 순수 GPU 실행 시간이 아니다. 첫 진단의 63/63 기존 예약 재사용과 같은 결과이므로 별도의 double-tick 낭비는 관찰하지 못했다.
- 이전 capture off의 trace off/on은 geometry **15.59/15.40/s**, CPU p95 **39.61/43.89ms**였다. 최신 같은 비교는 **17.27/16.60/s**, **37.77/36.43ms**다. 작은 실행 간 분산 때문에 overhead의 크기나 방향을 고정하지 않는다. 최종 성능 기준은 최소 계측 실행이며 지속적인 overhead 수락은 남는다.

### 회귀·공급·Release 패키지

- 마지막 native 실패 취소 보완 전, paint/scene/semantics/liveness·bounds와 분할의 실제 픽셀·resource 세대·root metrics·backpressure/close·frame terminal·QPC·responsive glyph·native scene와 접근성 회귀 **275/275 PASS**, 전체 workspace typecheck **PASS**였다. 당시 deadline 전용 8검사는 조기 build·취소·숨김·다중 View·action·scheduler 종료 경계를 확인했다. 후속 보완 뒤 131/131 targeted 회귀와 typecheck를 다시 통과했으며 두 검사 수를 합산하지 않는다. 테스트 timeout은 모두 **20분**이다. 분할의 픽셀 비교는 clip·affine/perspective/singular matrix·offscreen/backdrop filter 등 9 recipe의 A→B→A, 총 27회다. 외부 값·custom recording hook·이전 프레임의 자원 수명과 실패 rollback도 유지한다.
- picture 재사용 단계의 설치 Core source **623개**·dist **2,492개**, Windows header **50개**(SDK 29 + Skia RN 14 + 공통 host 7)가 원본과 byte 일치했다. 당시 Core archive는 `4786402144b0781fa37236b6552b979eb0ca145c0e9f3b64981e22faabf89787`다. SDK `e7facda71b17e847ff019666cf255f41ffde748201c310e4262dd711d443822f`, Skia RN `6d5b6075730db5c7013fb84c207fb5e3cc5ad6ec86e01ecd8e8f5c105eea1175`와 native supplier `9fa53dc1f48284aa645f3efbb63a8d7d1a03d18df227e986c8357273596bc13b`는 유지한다. archive 파일명 digest와 실제 SHA가 일치한다.
- 아래 **Static Hermes / optimized / x64 Release 전체 앱 빌드 PASS**는 picture 재사용 Core `4786402144b0781fa37236b6552b979eb0ca145c0e9f3b64981e22faabf89787`를 포함한다. 1,774파일 inventory·runtime·build/package/locator digest 검사 PASS-scoped다. deadline와 마지막 실패 취소 보완은 아직 이 AOT에 미반영이다. **현재 공급·설치 Core는 `9c2a4bd08e5548ce0e5b2c1130b178e6364d9e376579288ac439687bd35b9804`**이며 source 623개·dist 2,492개가 원본과 byte 일치한다. 최신 targeted source 회귀 131/131과 전체 typecheck는 PASS다. `qualification=notVerified`는 유지한다.

| 실제 Release 출력 — picture 재사용 반영 / deadline 수정 전 | SHA-256 |
| --- | --- |
| exe | `d14cb237b976f99caef7e689e84f643167c352ad4585347315ed0a56bdb9ed88` |
| AOT DLL | `3a2ee95ec6ee5088a6569a7ad935be5d23d5948c478ee4d74c4dd28bbe0fba39` |
| package manifest | `a432f27b96300c3cd7d0166d82bf1fd516603d7cf1c83211bd9f6117677ee9d6` |

### 일반 스크롤·입력·닫기

- 재개 직후 최종 native header의 held-producer 종료 검사(`NELYX_WINDOWS_INPUT_CLOSE_ONLY=1`) **PASS**. `admitted=1 before=active after=closing`, 좌표 매핑 12회 동안 입력 객체 동일성, `views=0 consumers=0 gpuDrained=1 inputRetired=1`을 확인했다. 당시 Core는 이전 공급본이며 이 검사를 새 Core 전체 TSF/UIA/IME 수락으로 옮기지 않는다.
- 사용자는 이전 재현 구간에서는 **“현재는 정상 동작함”**이라고 답했지만, 중간 마무리 뒤 같은 실제 AOT에서 **트랙패드와 마우스 휠 모두 간헐적 먹통**을 다시 보고했다. 정상 확인과 자동 OS 휠 통과를 장시간 물리 입력의 해결로 확대하지 않는다. 최신 원인 조사 범위는 §9를 따른다.
- 새 Core가 포함된 위 실제 Release 패키지의 `test:windows-continuous-scroll`도 **PASS**. 세 화면에서 방향을 반전하는 3초 연속 OS 휠을 2회씩, 입력 직후 닫기를 실행했다. Material은 최대화·복원과 포인터 이동도 포함했다. UIA는 초기 화면 선택에만 사용했고 JS offset이나 UIA 변화로 표시를 대신 수락하지 않았다.

| 화면 | 입력 중 최대 픽셀 변화 간격 | 숨김 | HWND 파괴 | 프로세스 종료 |
| --- | --- | --- | --- | --- |
| Material | 218.38ms | 2.07ms | 662.41ms | 706.82ms |
| ListView | 168.05ms | 2.03ms | 1,823.55ms | 1,896.37ms |
| Cupertino | 194.02ms | 1.96ms | 1,776.22ms | 1,838.71ms |

- 세 실행 모두 exit **0**, `REACT_ERROR` 등 오류 **0**, 정상 입력/GPU drain이다. Material 최대화/복원의 `actual-frame`·`actual-commit` timeout은 여전히 **각 2회**다. 새 연속 스크롤 통과를 큰 창 전환의 화면/FPS 통과로 확대하지 않는다.
- 앞선 두 전체 실행은 Cupertino 휠 시작 전 `Own caption is occluded`로 종료됐다. 고정 좌표 대신 해당 앱 HWND·DPI·실제 HTCAPTION을 확인하는 활성화로 검사를 보강했다. 전체 세 화면 통과 뒤 `-CaptionActivation`으로 fallback을 직접 실행했고, owned caption 클릭·Cupertino 연속 휠·exit 0·drain까지 통과했다. 이 harness 실패를 renderer 정지로 기록하지 않는다.

### 실패·정리·다음 시작점

- 과거 native commit 완료 대기 제거의 **11px**, DwmFlush 제거 확장 검사의 변/timeout **6/4px**, 복원 후 Cupertino 좌상단의 **6px**, 최초 기준의 **8px** 일시적 marker 실패는 과거 실패로 유지한다. 과거 최소 계측의 준비 timeout 2건도 보존한다. 이번 성공한 행렬로 그 원인이 증명되거나 전체 scanout 수락이 끝났다고 보지 않는다.
- 이전 중단 폴더 `C:\Users\parti\AppData\Local\Temp\nelyx-windows-input-surface-DkFyS3`는 남아 있다. 검증한 절대 경로에 대한 PowerShell 삭제가 재개 때도 자동 승인 검토에서 **`blocked by policy`**로 거부됐다. 우회 삭제나 archive 이동은 하지 않는다. 새 native fixture·공급 임시 디렉터리·AOT staging은 실행의 `finally`에서 정리하고 이전 dist·archive·receipt·consumer·profile·history를 누적하지 않는다.
- 현재 실행은 저장소 루트의 `npm run run:windows --workspace @nelyx/testbed-2`다. 검사·진단 사용법은 Testbed 한·영 README에 둔다.
- **재개 시작점:** 먼저 diff·위 supply/package SHA와 설치 바이트를 확인한다. `windows-animation.tsx`에 추가한 scheduler 단계별 `resizeRequestSources`(횟수·단계당 1개/1,800자 stack)는 아직 native 실행 검증 전이다. 이 계측을 검토한 뒤 **`NELYX_ANIMATION_HERMES_MODE=static-aot`**, live-resize / optimized / semantics 50ms / 61Hz / 4초의 같은 기본 6조합·최소 계측·width/height QPC·600px breakpoint를 실행한다. Static AOT 비교 시도는 결과를 확보하지 못했고 중간 마무리 확인 때 관련 프로세스·임시 폴더가 없었다. 이를 AOT 성능 검사 통과로 세지 않는다.
- 그 다음 필요 변경을 source·native에서 검증하고 **`npm run build:windows:static-aot --workspace @nelyx/testbed-2`**의 전체 종료 코드 0을 기다린 뒤 package inventory·runtime·locator/hash와 실제 연속 스크롤을 확인한다. 중간 마무리 때 실행은 위 표의 picture 재사용 AOT였으며 최신 deadline 소스와 달랐다. 그 뒤 입력 예방 보강용으로 갱신한 패키지는 §9를 따른다. width **139 build/68 metrics**·height **207 build/101 metrics**의 추가 요청 원인과 width layout/paint·height native 동기화가 남았다. 접근성 간격·action/focus/input geometry 즉시성, 모든 실제 요청의 paint/capture/submit과 paint 중 무효화를 보존한다. 철회한 Root 재사용·admission 기반 제출 생략을 재도입하지 않는다. native 대기를 바꾸기 전 source frame·desktop frame·composition commit의 관계를 더 연결한다.
- 일시적 marker 실패의 source frame·viewport·desktop frame·composition commit 연결, 큰 최대화/복원, 비-short typography, 물리 DPI 전환·IME·장시간 트랙패드·사용자 resize 체감·전체 scanout은 **notVerified / 미수락**이다. §6 목표가 미달하므로 전체 계획을 완료로 바꾸지 않는다.
- 중간 마무리 당시 exe·AOT DLL·package manifest SHA와 last-package locator가 위 표와 일치했다. 새 fixture·공급 임시 폴더와 staging은 남지 않았고 현재 dist·각 패키지의 최신 공급 archive만 유지했다. 당시 작업 소유 실행 프로세스 0개, 새 commit 없음이었다. work·한/영 README 3문서의 local link 22개·anchor·fence·공백과 `git diff --check`가 통과했다. 이는 문서·출력 확인이며 추가 native·AOT 성능 수락이 아니다. 이후 사용자가 확인할 앱을 실행했고 최신 진단 실행 상태는 §9를 따른다.

## 9. 별도 수정 — Windows 트랙패드 반복 스크롤 중단 (2026-10-27)

- 아래는 재개 전 조사 이력이다. 당시 상태는 **REOPENED / 예방 보강 후 물리 재현 — 실행 경로 차이 조사 중**이었다. 앞선 수정본의 반복 스크롤·ListView 왕복은 한 차례 정상 확인을 받았으나, 뒤이은 사용자 확인에서는 **트랙패드와 마우스 휠 모두 손을 떼고 다시 스크롤하면 회복되다가 간헐적으로 먹통**이 된다고 답했다. 이 과거 재현을 삭제하지 않으며, 최신 Flutter 주기 반영 AOT의 자동·사용자 확인 범위는 §10을 따른다.
- 실행에서 확인한 원인: 같은 Skia 화면의 부팅 중 DirectManipulation 객체가 **17개** 생성됐고 스크롤 중에도 추가 생성됐다. `TextInputSkiaSurface::resolve`가 서비스·접근성 요소의 좌표 매핑 요청마다 트랙패드 viewport까지 등록하고, 화면은 마지막 객체만 약한 참조로 관찰했다. 좌표 독자의 생성·해제가 실제 입력 소유자를 교체하는 구조였다.
- 수정: 실제 `WindowsSkiaViewState`가 입력 객체 하나를 소유한다. 좌표 매핑의 생성·해제는 이 객체를 교체하지 않는다. 입력 객체는 자신의 화면 매퍼를 유지하고, 매퍼는 화면을 약하게 참조한다. 화면 binding 종료 시 contact·viewport·clock과 매퍼를 함께 정리한다.
- 선행 제스처 수정: 접촉의 `BEGIN`/`END`와 초기화 중에도 compositor tick을 유지하고, 갱신 후 실제 `READY` 상태로 초기화 완료를 판정한다. 관성 없는 종료도 transform을 초기화하고 취소 시 native contact를 종료한다. 이 수정의 자동 검사 통과가 실제 재발 해결을 의미하지 않았음을 사용자 재현으로 확인했다.
- 회귀: `windows-precision`, `windows-window-pointer`, `windows-pointer-timing` **3/3 PASS**. 제어된 콜백의 12회 반복, 이동 전 대기, 관성 없는 종료 4회, 관성 중 재접촉, 취소 후 재입력을 검사했다. 추가 `windows-input-surface` 통합 검사 **PASS**: 실제 Fabric 화면에서 좌표 매핑 12회 생성·해제 후 입력 객체 동일성 유지, admitted producer 종료 중 입력·GPU drain 및 `views=0 consumers=0 gpuDrained=1 inputRetired=1` 확인. 추가 실행은 `NELYX_WINDOWS_INPUT_CLOSE_ONLY=1` 범위이며 전체 TSF/UIA/IME 수락이 아니다. 테스트 timeout은 모두 20분이다.
- 공급·빌드: 현재 SDK·Skia 패키지를 다시 공급·설치하고 설치 header와 원본의 SHA-256 일치를 확인했다. 기존 증분 native 입력을 재사용했다. **Static Hermes / optimized / x64 Release 빌드 PASS**. 현재 실행에서 트랙패드 초기화 객체 **1개**, `Responding=True`를 확인했다.
- 진단: `NELYX_TRACKPAD_DIAGNOSTICS=1`이면 native 상태·오류·JS 전달 및 host 오류를 현재 실행의 콘솔에 출력한다. 파일·이전 실행 로그는 누적하지 않는다. 일반 실행에서는 출력하지 않는다.
- 식별자: 실행 파일 SHA-256 `9f52c765b57e5d5ec2efeef71dc69988475478de9bad46957cbdf28c32d6406a`; native inputs SHA-256 `9fa53dc1f48284aa645f3efbb63a8d7d1a03d18df227e986c8357273596bc13b`.
- 실제 재확인: 사용자 반복 스크롤·ListView 왕복 중 초기화 객체와 입력 pointer가 **1개**로 유지됐고 native 시작·종료가 JS에 전달됐다. 수집한 진단 구간의 오류는 0건이었다. 사용자가 계속 조작 중인 수정 앱은 켜두었다. 다음 실행도 기존 `run:windows` 명령을 사용한다.
- 범위: 창 전환·리사이즈 후 물리 재입력과 다른 트랙패드 장치의 장시간 사용은 별도 **`notVerified`**이며, 리사이즈 FPS 성능 수락과 전체 TSF/UIA/IME 수락으로 확대하지 않는다.
- 추가 진단(2026-10-28): 같은 실제 Release 패키지를 **`NELYX_TRACKPAD_DIAGNOSTICS=1`와 `NELYX_WINDOWS_FRAME_DIAGNOSTICS=1`**로 새 실행했다. 사용자는 이 진단 창에서는 **“지금은 재현되지않음”**이라고 답했다. 확보한 로그에서 precision 객체 하나의 RUNNING/INERTIA/READY 전환과 native event writer 호출을 관찰했다. `js-delivered`라는 기존 로그는 native payload writer 내부 기록이므로 실제 SDK 수신·Core 처리·화면 표시의 완료 증거로 해석하지 않는다. 약 101ms의 JS frame work/queue 지연도 있었지만 신고된 먹통과 동일 구간인지 확인되지 않았다. 일반 실행과 진단 실행의 차이만으로 원인을 확정하거나 해결로 판정하지 않는다.
- 예방 보강 전 조사 범위: **공통 입력 순서·프레임 예약/admission·native UI/GPU completion과 실제 화면 변화 연결**을 먼저 확인한다. DirectManipulation reset 중 새 contact가 겹치는 경로도 후보이지만, 마우스 휠 재발을 함께 설명하는 증거는 아직 없다. 당시에는 runtime 수정·빌드·수정 완료 판정 없이 진단 앱을 사용자 재현용으로 켜두었다. 이후 변경·검증은 아래 예방 보강을 따른다. 재발 시점·화면(Material/ListView/Cupertino)을 받아 같은 실행의 입력 sequence와 프레임을 연결하는 것이 다음 시작점이다. 콘솔 로그·별도 checkpoint/history 파일은 보관하지 않는다.
- 접근성 포커스 가설(2026-10-28): `SemanticsComponent.h::syncFocus`는 Core의 focused 값과 native focused component가 다르면 `focusSurface`/`TryFocus` 또는 `focusCanvas`로 실제 포커스를 동기화한다. UIA의 명시적 `SetFocus`도 별도 이동 경로다. 따라서 가설은 조사 대상으로 유지한다. Windows semantics View는 `pointerEvents:'none'`이며, `SkiaView::precision`/`wheelPoint`의 입력 허용 조건에는 keyboardFocused 검사가 없다. 포커스 변경 하나만으로 공통 스크롤 정지의 원인을 확정하지 않는다.
- 같은 실행을 **120초간 읽기 전용으로 관찰**했다. 자기 앱 process로 필터링한 UIA focus 기록은 시작 시의 **Window 1건**, 관찰 오류 **0건**이었고 접근성 요소로의 이동은 관찰하지 못했다. native focus는 처음 앱 최상위 HWND였으며, 이후 앱이 foreground를 잃을 때 0으로 바뀌고 정상 cancel이 기록됐다. 관찰 구간에 native pan 이벤트도 있었다. 이 실행에서 사용자가 신고한 먹통은 재현되지 않았으므로 간헐적 포커스 경합을 배제하는 결과는 아니다. observer는 `finally`에서 해제했고 runtime 소스·설치 패키지는 바꾸지 않았다. 다음 재발에서 포커스·입력 sequence·프레임 지연을 같은 시각으로 연결한다.
### 예방 보강 (2026-10-28)

- 사용자 요청에 따라 포커스·정밀 스크롤의 확인 가능한 취약 경로를 보강한다. 최초 간헐적 먹통의 원인은 아직 확정하지 않았으며 물리 입력 해결 판정은 `notVerified`다. §8 리사이즈 성능 작업은 **PAUSED / PARTIAL**을 유지한다.
- 접근성: geometry·selection·metadata만 갱신되는 snapshot은 native 포커스를 다시 가져오거나 아직 Core가 승인하지 않은 UIA 포커스를 해제하지 않는다. 실제 논리 포커스 전환만 활성 island 안에서 동기화하며 비활성 island의 passive 갱신·peer 해제는 다른 창의 포커스를 가져오지 않는다. 명시적 UIA `SetFocus`와 Core의 실제 focus/blur 전환 경로는 유지한다.
- 정밀 스크롤: 새 contact 직전에 이전 reset의 callback을 먼저 처리하고 `READY` 확인 후 접촉을 등록한다. reset 중 합성 callback을 실제 제스처로 해석하지 않는다. 화면 좌표를 얻지 못해 precision 시작을 내보내지 않은 stream은 fallback 휠을 차단하지 않는다.
- 제어된 회귀에서 수정 전 포커스 반복 요청·reset 직후 빠른 재접촉·좌표 없는 관성의 휠 차단 실패를 확인했다. 수정 후 회귀에는 미승인 UIA 포커스 해제 방지도 포함한다. `windows-precision`, `windows-semantics-text`, `windows-window-pointer`, `windows-pointer-timing` **4/4 PASS**, 접근성 tree·packet·action·편집 검사 **31/31 PASS**, 전체 workspace typecheck **PASS**. 실제 Fabric/UIA·TSF 전체 통합 검사도 **PASS**다. UIA blur/focus 8회, Core 승인 전 새 commit에서도 native peer 유지(22→23), 캔버스 포커스의 passive 갱신 보존과 명시적 UIA 복원, 텍스트·선택·privacy·range reveal·OS keyboard/Unicode·픽셀·backing resize를 확인했다. `views=0 consumers=0 gpuDrained=1 inputRetired=1`, exit 0이다. Hermes supplier / optimized bytecode 범위이며 물리 IME·reader 수락은 아니다. 모든 테스트 timeout은 20분이다.
- 공급을 갱신하고 Core source **623개**·dist **2,492개**, Windows header **54개**(SDK 33 + Skia RN 14 + 공통 host 7)가 설치본과 byte 일치함을 확인했다. Core `9c2a4bd08e5548ce0e5b2c1130b178e6364d9e376579288ac439687bd35b9804`, SDK `0800feb9c44111b2ff63788aabe7eefbdbc8a15e7068aa21ec00bcb91d64b640`, Skia RN `9444254ae37889bcde4033e0d61047dd263cee5f37aea1fa2f9399b4add52cc3`, Skia Native archive `e4cdb6c3909405305f17977e6c572cdfb3d68ceeb3a2d4ae0e0d26e7aaa1fad0`다. 첫 통합 시도의 이전 compiled-source manifest 불일치를 native 증분 빌드·재준비로 해소했으며 새 native inputs는 `e020d665ac6bb962b5ce7bfeac4a7ec14576443fd776f6685920d34637ac0ccd`다.
- 기존 진단 앱은 정상 닫기로 종료했다. exit **0**, `views=0 consumers=0 gpuDrained=1 inputRetired=1`을 확인했다. 새 Static Hermes / optimized / x64 Release AOT 앱의 빌드·패키징 **PASS / exit 0**다. 이전 AOT에 없던 최신 Core deadline·실패 취소 보완과 이번 native 입력 보강이 포함된다. 1,774개 파일 inventory·runtime·last-package locator digest 검사를 통과했다. 이 빌드의 성공을 §8 리사이즈 성능 재검증으로 확대하지 않는다. 새 패키지의 `test:windows-continuous-scroll`도 **PASS**다. 세 화면마다 양방향 3초 OS 휠, 입력 후 닫기와 실제 desktop pixel 변화를 확인했다. 세 프로세스 모두 exit 0·drain 정상이다. 별도 로그·history·checkpoint는 만들지 않는다.

| 예방 보강·최신 Core 반영 Release 출력 | SHA-256 |
| --- | --- |
| exe | `92cb6b450ded733095987108742cfe63bdee0ecb0ab76c10053c007d396515f1` |
| AOT DLL | `66cd390bb8839f0cb08a5cc89a2b6f1026c37755820040389a497a4ce3fdc16b` |
| package manifest | `968a2fb37ce6448690fd0d2868913e71703f658a2fb1cbc177a4e4593a6ace1f` |

| 예방 보강 AOT의 실제 연속 OS 휠 | 입력 중 최대 픽셀 변화 간격 | 숨김 | HWND 파괴 | 프로세스 종료 |
| --- | --- | --- | --- | --- |
| Material | 219.13ms | 2.19ms | 1,800.29ms | 1,845.94ms |
| ListView | 146.01ms | 2.65ms | 1,838.62ms | 1,904.22ms |
| Cupertino | 170.09ms | 1.95ms | 627.60ms | 691.80ms |

- Material 최대화·복원과 포인터 이동도 포함했다. 기존과 같이 큰 창 전환에서 `actual-frame`·`actual-commit` timeout이 각 2회 있었다. 이를 새 회귀 실패나 리사이즈 성능 통과로 바꾸지 않으며 §8의 미수락 경계를 유지한다. 장시간 실제 마우스·트랙패드와 원래 간헐적 먹통의 해소는 아직 `notVerified`다.
- 진단 옵션을 끈 일반 `npm run run:windows --workspace @nelyx/testbed-2`로 수정 패키지를 사용자 재확인용으로 실행해두었다. PID **10436**, `NelyxTestbed2`, visible·`Responding=True`를 확인했다. native 통합 임시 폴더·AOT staging은 정리됐고 별도 로그·이전 dist·archive·checkpoint는 추가 보관하지 않았다. 기존 자동 승인 검토에서 거절된 임시 폴더는 위 기록대로 유지한다.

### 예방 보강 후 재현·실행 경로 분리 (2026-10-28)

- 사용자는 위 예방 보강 AOT에서도 **스크롤 막힘이 재현됐다**고 답했다. 따라서 원래 간헐적 문제는 미해결이다. 앞선 회귀·UIA/TSF·자동 OS 휠 통과 범위를 유지하되 물리 입력 해결로 판정하지 않는다. 발생 화면은 아직 특정하지 못했다.
- 추가 단서: **에이전트가 켜둔 창을 대화 종료 후 조작할 때만 막히고, 사용자 직접 실행이나 에이전트 테스트 중에는 재현되지 않는다**는 사용자 보고다. 실행 세션·출력 연결·활성화 차이를 먼저 분리한다. `startWindowsProcess`는 stdout/stderr를 CLI의 stderr로 pipe한다. 그러나 남아 있던 일반 실행에서 확보한 출력은 시작·종료뿐이라 출력 폭주나 backpressure가 원인이라고 확정하지 않는다. 기존 PID 10436은 exit 0으로 종료됐고 재발 구간의 내부 입력 로그는 없었다.
- 제품 바이너리는 바꾸지 않고 같은 exe SHA `92cb6b450ded733095987108742cfe63bdee0ecb0ab76c10053c007d396515f1`를 **desktop Explorer 자동화를 통해 독립 실행**했다. 현재 앱 **PID 6692**, parent **explorer PID 9668**, visible·`Responding=True`다. 단순 `Shell.Application.ShellExecute`의 첫 시도는 parent가 pwsh로 남아 정상 닫은 뒤, desktop의 실제 Shell automation으로 다시 실행해 Explorer parent를 확인했다.
- `Nelyx/eng/windows-scroll-observer.ps1`를 추가했다. 관찰자도 Explorer 자식으로 독립 실행하며 현재 **PID 28564**, 공유 메모리 `Local\NelyxScrollObserver.v1.6692`다. 최대 20분 동안 QPC·이 앱 위의 OS 휠 수·합계·포커스/capture·foreground·커서 소유창·UI WM_NULL 응답·CPU 누계·화면 hash를 약 200ms 간격으로 읽는다. 최근 512개 표본(약 102초)만 RAM에 두고 이미지·키보드 내용·파일 로그는 저장하지 않는다. 앱 종료 시 hook을 해제하고 마지막 기록을 최대 2분 유지한다. 시간 만료나 `-Stop`은 hook·GDI·메모리를 정리한다.
- 범위: 휠 감지는 **OS mouse hook 관찰**이며 앱의 WM_MOUSEWHEEL·SDK 수신·Core 소비의 완료 증거가 아니다. 모든 DirectManipulation 제스처를 감지하지는 않는다. 화면 hash도 32×64 축소 표본으로 전체 화면/FPS/scanout 수락이 아니다. native→SDK→Core 상세 계측은 이번 실행 경로 비교 결과가 필요할 때 추가한다.
- 관찰 도구 검증: C# 컴파일·공유 메모리 읽기·제한 시간 종료·메모리 제거·`-Stop` 협력 종료와 앱 응답 유지 **PASS-scoped**다. 초기 휠 필터의 보정 입력 누락을 발견해 현재 커서의 소유창으로 필터를 보완했다. 보완 후 앱 안의 OS 주입 휠 **3회 / delta -360**이 관찰됐고 같은 구간에 desktop hash **3개**, UI timeout **0**을 확인했다. 현재 관찰자는 보정 뒤 새로 시작해 카운터 0이며 hook error 0이다. 이전 관찰 프로세스는 모두 종료됐다. 이는 관찰기의 기능 검증이며 신고된 재현을 포착한 결과가 아니다.
- 사용법은 Testbed 한·영 README에 반영했다. 재현 직후 앱을 열어둔 채 다음 명령으로 현재 관찰을 읽는다. 대화 종료 뒤의 독립 실행에서도 발생하는지는 다음 사용자 확인 사항이다. 이번 단계에는 제품 runtime 변경·재빌드가 없으며 §8 리사이즈 작업은 PAUSED다.

```powershell
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId 6692 -Read
```

### 독립 실행 재현과 약 1초 스크롤 화면 정지 진단 (2026-10-28)

- 사용자는 Explorer에서 독립 실행한 PID 6692에서도 **트랙패드 재현**을 보고했다. 증상은 창이 계속 멈추는 것이 아니라 **스크롤 중 약 1초 화면 움직임이 끊겼다가 이어지는 현상**이다. 입력은 계속되지만 화면 갱신이 밀릴 수 있다는 사용자 가설을 포함해, native 입력→SDK→Core→프레임→화면의 시간 간격을 비교한다. CLI pipe 연결만으로 원인을 확정하지 않는다.
- 즉시 읽은 외부 관찰 512개 표본에서 조작 구간의 native HWND focus는 일정하고 capture는 0이었다. UI WM_NULL timeout 0, 해당 구간 최대 응답 약 **1.79ms**였다. 이는 창 전체의 응답성 관찰이며 1초 스크롤 끊김을 부정하거나 UIA의 논리 focus 이동을 배제하는 증거가 아니다. 일부 초 단위 구간은 화면 hash가 유지됐지만 물리 입력 시점과 연결할 내부 기록이 없어 그 구간을 신고된 정지로 확정할 수 없다. OS mouse-wheel count 0은 DirectManipulation 트랙패드 입력 중단의 증거가 아니다.
- 새 진단은 `NELYX_WINDOWS_INPUT_TRACE=1`로만 활성화한다. `WindowsInputTrace.h`가 현재 process의 32개 단계별 누계·최신값과 최대 **8,192개 numeric entry**를 공유 메모리에 유지한다. 일반 갱신은 16회당 1개를 표본화하고, 상태 전환·거절·200ms 이상 SDK/Core 입력 지연·100ms 이상 JS frame work·250ms 이상 단계 간격은 남긴다. console/file 출력·scene/callback/resource 보관·추가 입력/pump·예약/admission 변경은 없다. 비활성 시 메모리도 할당하지 않는다.
- native DirectManipulation 상태·contact·clock/tick·content·발행/거절, RNW payload 작성, 실제 SDK 수신/세대·순서 거절, Core queue·controller 처리 시작/종료, frame request/clock/JS·UI 작업, native 제출·producer 완료·surface update·retirement, canvas/UIA focus를 관찰한다. **native packet sequence와 Core 내부 input counter를 따로 기록**하며 Core 관찰로 둘을 연결한다. SDK/Core의 지연은 같은 시계 domain 안에서 계산하고, 관찰 시각은 native QPC다. 기존 `js-delivered` 문구는 실제 의미인 `payload-written`으로 바꾼다.
- `windows-input-trace.ps1 -TargetProcessId <PID>`가 기록을 읽고 `-Raw`로 현재 표본을 반환한다. 읽기에는 JS·UI callback이 필요 없고 파일을 쓰지 않는다. native retirement/surface update는 실제 desktop pixel receipt가 아니므로, 다음 진단에는 기존 화면 관찰기를 **`-NoHook`**로 실행해 OS input hook 없이 화면 hash와 연결한다. 외부 관찰기는 이미 정상 종료했으며 기존 앱도 닫힌 상태다. 기존 앱 ExitCode는 독립적으로 검증하지 못해 종료 코드 0으로 기록하지 않는다.
- 회귀: 새 recorder의 opt-in/미할당·표본화·희귀 거절 보존·RAII 정리, SDK 수신/거절 관찰, 진단 callback 실패 시 입력 보존, Core queue/dispatch/거절/원래 예외 보존과 frame/backpressure·clock 검사 **38/38 PASS**. 전체 workspace typecheck **PASS**. precision·UIA text·runtime close는 **15/15 PASS**였고 window-pointer standalone의 새 common-header include 누락을 harness에서 고친 뒤 해당 검사 **1/1 PASS**다. 진단을 켠 실제 Fabric/UIA·TSF 전체 통합도 **PASS**다(Hermes supplier optimized bytecode, 약 162.5초). 8회 UIA blur/focus·queued native focus·canvas 보존·text/selection/privacy·pixel·backing resize·정상 close/drain을 유지했다. native recorder와 PowerShell reader를 실제 별도 프로세스로 연결한 protocol 검사도 PASS다. 새 Static Hermes / optimized / x64 Release AOT 빌드·패키징 **PASS / exit 0**다. 최종 1,775개 파일 inventory·runtime·last-package digest 검사도 PASS이며 SDK source 113개도 설치본과 byte 일치한다. 모든 테스트 timeout은 20분이다. SDK의 optional property type 오류는 공급 전 빌드 단계에서 수정했다.
- 새 Core·SDK dist 및 네이티브 패키지를 다시 공급·설치했다. native source manifest는 `c46d594817e80d8514165c7f84faf7c17004ec7b725678a7d6af4feb3ad0e148`다. 이전 실제 AOT의 예방 보강과 이번 계측 소스를 구분한다. 현재 설치 Core source 623개·dist 2,492개, Windows header 55개(SDK 33 + RN 14 + host 8)가 원본과 byte 일치한다. 현재 archive SHA는 Core `88017afdfabc914e2f1de458acfa80dbcb80e99cf2e302cda5b2ff7a6debb98a`, SDK `3c7f5900c877527da688c8287c968a63155d73c4314e4f16c3abe2fd6c0baa99`, RN `174c7f10547a9a36f3d5359e3357acae56c0aabe1800920be627748b5ab15ef6`, Skia Native `98a3e1fc0649116c4358bcb641458b7710635ea27361900d16928a1fe0573e28`다. 원래 약 1초 끊김은 계속 **미해결 / notVerified**, 리사이즈 성능 작업은 **PAUSED / PARTIAL**이다.

| 약 1초 스크롤 끊김 진단을 포함한 Release 출력 | SHA-256 |
| --- | --- |
| exe | `38c6bfb5c8a111fa5a6cefee092c44b25e74001c9b7b8794f17c1b9406486edf` |
| AOT DLL | `f93c29d1d65f6a59ff59133c7ea9d427bc4bdab80c37b0a6f64f9efe1f18333a` |
| package manifest | `337c33f5bd171d2b1e896c4246add14097449b3c0638a5b71ba58ba6aad84802` |

- 당시 진단 앱 **PID 27828**, `NelyxTestbed2`, visible·`Responding=True`를 확인했다. Explorer에서 시작한 독립 launcher가 이 앱에만 `NELYX_WINDOWS_INPUT_TRACE=1`을 전달했고 npm/도구의 stdout pipe에 묶지 않았다. 실제 native 공유 메모리와 SDK/Core 관찰이 활성화됐고 화면 관찰자 **PID 23844**는 **`-NoHook` / hookInstalled=false**였다. 이 앱과 관찰자는 이후 종료됐으며 종료 코드는 독립 검증하지 않았다. 아래 재현 분석은 재현 직후 읽었던 기록을 기준으로 한다.
- 실제 AOT의 owned foreground canvas에 주입한 OS 휠 **3회씩 2묶음(총 6회)**으로 진단 경로를 확인했다. 마지막 묶음의 native packet **52 → SDK 52 → Core nativeInput 52**, Core counter **52 → frame-retired counter 52**가 연결됐고 마지막 Core 처리까지의 입력 지연은 **7.69ms**였다. 같은 초에 외부 desktop hash **4개**를 관찰했고 UI timeout은 0이다. 이는 계측의 연결 검증이며 사용자의 물리 트랙패드 재현이나 원인 규명 결과가 아니다. 새 패키지의 3화면 연속 OS 휠을 다시 실행했다고 기록하지 않는다.
- 현재 기록의 약 199.6ms JS frame work 1건은 초기 첫 프레임이며 1초 스크롤 정지 원인으로 해석하지 않는다. Microsoft [compositor clock 안내](https://learn.microsoft.com/en-us/windows/win32/directcomp/compositor-clock/compositor-clock)도 확인했다. 문서는 display가 갱신되는 동안 compositor가 idle이어도 clock 신호가 진행된다고 설명한다. 소스의 1000ms wait timeout 숫자와 신고된 정지 시간의 유사성만으로 clock 원인을 확정하지 않는다.
- 재현 후 앱을 닫기 전에 아래 두 기록을 같은 QPC 구간으로 읽는다. native의 `gaps`는 500ms 이상 단계 표본 간격과 그동안의 이동 입력 표본 수를 보여주며 정상 idle도 포함할 수 있다. 상세 표본은 `-Raw -Tail 512`로 제한해 읽을 수 있다. 다음 물리 재현에서 입력이 진행되는 동안 frame/surface/pixel 갱신이 밀리는지를 판별한다. 파일 로그·이전 dist·별도 receipt/history를 추가 보관하지 않는다. 기존 거절된 임시 폴더는 앞선 기록을 유지한다.

```powershell
pwsh -NoProfile -File Nelyx/eng/windows-input-trace.ps1 -TargetProcessId 27828
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId 27828 -Read
```

### 물리 재현의 조기 종료·초기화 경로 보강 (2026-10-28)

- 사용자는 **후반부에 재현됐고 손가락을 계속 움직이는 도중** 약 0.7~1초 끊긴다고 명확히 했다. 종료·관성 취소가 보였다는 이유로 해당 공백을 정상적인 제스처 사이 대기로 해석했던 판단을 철회한다. §8 리사이즈 작업은 **PAUSED / PARTIAL**을 유지한다.
- 직전 진단의 누계는 native 입력·payload 작성·SDK 수신·Core 처리 시작/종료가 각각 **4,272건**이며 SDK/Core drop·frame failure는 없었다. 마지막 30초의 보존된 관찰에서 SDK 지연 최대 약 34.74ms, Core 처리 종료까지 약 121.52ms, JS frame work 약 43.12ms였다. 1초 입력 backlog나 JS CPU 정지가 이 구간에서 확인되지는 않았으나, native에서 이미 끝난 것으로 처리해 발행하지 못한 물리 입력까지 이 누계로 정상 판정하지 않는다. 마지막 조작 구간에 명시적 UIA focus 전환 기록도 없었다.
- 실제 연속 native submission **3009 → 3010** 사이에 **713.42ms** 공백이 있었다. QPC **23846489.8973**의 RUNNING→INERTIA 직전 flags **107**, **23846505.6152**의 INERTIA→READY 직전 flags **109** 모두 `interacting=true`다. 그 사이 `panZoomEnd`가 발행됐고 READY 직후 **23846505.6162**에 `inertiaCancel`, 이어 합성 RUNNING→READY 초기화가 실행됐다. 다음 start는 **23847203.5017**이었다. 이것은 실제 종료·초기화 순서의 증거이며 해당 callback을 물리 손 떼기의 증거로 해석하지 않는다.
- 소스에서 `status(READY)`가 interaction 활성 여부와 관계없이 즉시 `inertiaCancel`·`ZoomToRect`를 실행하던 경로를 보강했다. READY의 취소·초기화는 보류하고 `Update`의 callback 처리가 끝난 뒤 interaction·RUNNING·INERTIA가 모두 종료된 경우에만 적용한다. 그 전에 새 RUNNING이 오면 이전 보류를 폐기해 계속되는 입력의 transform을 초기화하지 않는다. 합성 초기화의 BEGIN/END는 실제 interaction 소유권을 변경하지 않으며, 창 비활성화·명시적 취소는 보류된 취소까지 정확히 정리한다. **조기 초기화가 이번 물리 증상의 확정 원인인지는 수정 앱에서 별도 확인해야 한다.**
- Windows의 [상태 callback 안내](https://learn.microsoft.com/en-us/windows/win32/api/directmanipulation/nf-directmanipulation-idirectmanipulationviewporteventhandler-onviewportstatuschanged)도 통지가 비동기이므로 callback 안의 GetStatus와 통지 상태가 다를 수 있음을 명시한다. 상태 통지 하나를 실제 손동작 종료와 동일시하지 않는다.
- `windows-input-trace.ps1`에 `frameGaps`를 추가했다. 300ms 이상 간격에서 native submission id가 연속인지와 주변 start/end/cancel을 함께 보여준다. `consecutiveSubmissions=true`만 실제 연속 제출 공백이며 표본 누락 간격과 구분한다. 종료·취소가 포함된 공백을 정상 idle로 자동 분류하지 않는다. 현재 테스트는 실제 C++ 공유 메모리→PowerShell 판독으로 **700ms 연속 제출 공백과 terminal 보존·submission 16개 생략·다른 surface 제외**를 확인했다. 입력 recorder 검사 **1/1 PASS**다.
- 네이티브 회귀는 active interaction의 READY 후 초기화 보류, 보류 중 새 RUNNING의 정상 update, 실제 END 후 취소·초기화 정리, 합성 BEGIN/END 소유권 보존, 명시적 취소 시 보류 취소 정리를 추가했다. precision·native window pointer·compositor clock **3/3 PASS**다. 물리 접촉 주입 검사는 아니며 기존 12회 반복·stationary·관성 없는 종료·재접촉·cancel/close 경로도 유지했다. 모든 테스트 timeout은 20분이며 임시 디렉터리는 finally에서 정리했다.
- 공급한 RN·Skia Native의 공통 헤더와 설치 헤더 SHA-256은 **`3a5a32ba2beb82ca2734b3205fb9097026788bdf7ac58ff7a9329a0b6b1b67a2`**로 일치한다. 새 native inputs는 **`a24ef05b9de6298335840f11262bb6e1ccb3a2ec81d7996d30251e2883366e23`**다. RN archive는 `6b148e0f236726ed3c17bc3f5189e59c5df1cfb4d02a44a2f69598027b5311f3`, Skia Native archive는 `215dc514da82a7a8a3f8dd2b180ff8843372d799f14c35b70a023beacbaae95f`다. Core·SDK TypeScript는 이번 단계에서 변경하지 않았다. 실제 Static Hermes / optimized / x64 Release 앱 빌드·패키징은 **PASS / exit 0**이며 1,775개 파일 inventory·runtime·last-package locator 검사를 통과했다. 물리 스크롤 해결 판정은 **`notVerified`**다.
- 새 실제 패키지의 ListView에서 양방향 각각 3초 OS 휠을 확인했다. 입력 530/534개, 입력 중 화면 변화 123/116개, 최대 화면 변화 간격 **30.00/146.67ms**였다. 창 숨김 **2.01ms**, HWND 파괴 약 **2,078.74ms**, 프로세스 종료 약 **2,140.03ms**, exit 0·`views=0 consumers=0 gpuDrained=1 inputRetired=1`을 확인했다. 이번 단계에서 Material/Cupertino나 리사이즈 성능 검사를 다시 실행한 것으로 기록하지 않는다. 물리 트랙패드 재현 해결과 별도의 자동 검증이다.
- 사용자 재확인용 수정 앱 **PID 15972**, `NelyxTestbed2`, visible·`Responding=True`를 확인했다. Explorer가 시작한 숨김 launcher를 통해 독립 실행했고 앱에만 `NELYX_WINDOWS_INPUT_TRACE=1`을 전달했다. 콘솔용 trackpad/frame 진단은 끄고 native 공유 메모리 활성 상태를 읽었다. 화면 관찰자 **PID 23380**, **`-NoHook` / hookInstalled=false**, 최대 20분이다. 앱이 닫히기 전에 아래 명령으로 같은 실행의 기록을 읽는다. 새 AOT staging·supply 임시 디렉터리는 모두 0개이며 별도 로그·receipt·history는 만들지 않았다.

| 조기 종료·초기화 보강 Release 출력 | SHA-256 |
| --- | --- |
| exe | `c9e7d8954797b9be921f26c9d00c7e94d9a15478dd06c19a590c1ea4d6b9887e` |
| AOT DLL | `b1ffa3c021199bbb512b86e28a6ec57919b85e405f0ea6ccd0b2f79798f04c8b` |
| package manifest | `c3bbee4d0d4d30471f2f843d08a02d82e1cd79d6abc11ce87eb00195df167e88` |

```powershell
pwsh -NoProfile -File Nelyx/eng/windows-input-trace.ps1 -TargetProcessId 15972
pwsh -NoProfile -File Nelyx/eng/windows-scroll-observer.ps1 -TargetProcessId 15972 -Read
```

### Flutter Windows 입력·프레임 주기 적용과 합성 reset 회귀 수정 (2026-10-28)

- 직전 중단 상태: **PAUSED / PARTIAL — 사용자 외출·마무리 요청으로 구현·검증 중단점 정리 완료**. 당시 최신 AOT 빌드·공급 검증과 추가 종료 전용 검사는 통과했고 세 화면 연속 휠 재검과 물리 트랙패드 수락이 남았다. 이후 전체 작업 재개 요청에 따른 결과는 §10을 따른다.
- 사용자는 위 PID 15972 수정본에서도 **스크롤이 약 0.7초 늦게 끊기듯 움직인다**고 보고했고, Flutter와 비슷한 방식의 수정을 요청했다. 따라서 앞선 조기 초기화 보강은 문제 해결이 아니며 **REOPENED / 물리 입력 notVerified**다. §8 리사이즈 작업은 **PAUSED / PARTIAL**을 유지한다.
- 재현 직후 읽은 RAM 기록에서 native·payload·SDK·Core 처리 누계는 각각 **3,805건**이며 drop·frame failure는 없었다. 한 실제 구간은 native start **26322047.9436** → SDK **26322048.1514** → Core 처리 종료 **26322049.3484**였지만 첫 이동은 **26322230.4772**에 발행됐다. 시작 인식보다 **첫 이동 발행까지 약 182.53ms 공백 후 deltaY 약 749.93 logical units가 전달되는 경로**가 확인됐다. 일반 clock 기록은 표본이므로 표본 간 간격만으로 모든 clock 대기 시간을 확정하지 않는다.
- 앞선 보강에는 회귀도 있었다. 초기화를 Update 뒤로 미루면서 같은 Update 안의 `GetStatus(READY)`로 합성 억제를 너무 일찍 해제했다. 뒤늦은 합성 RUNNING→READY가 실제 panZoomStart/update/end로 새어 나갔다. 보존된 start/end 127구간 중 54구간은 1ms 미만이었으며, 예를 들어 **26330478.6081~26330478.6338**의 짧은 제스처가 초기화 직후 SDK/Core에 전달된 것을 확인했다. 기존 회귀 fixture는 실제 native transform이 identity라 이 callback을 만들지 않아 놓쳤다.
- Flutter 공식 [Windows 입력 구현](https://api.flutter.dev/windows-embedder/classflutter_1_1_flutter_window.html)은 DirectManipulation을 14ms HWND timer로 갱신한다. [Windows 엔진의 OnVsync·FrameInterval](https://api.flutter.dev/windows-embedder/flutter__windows__engine_8cc_source.html)은 DWM 주기로 다음 tick을 계산한다. [DirectManipulation 상태 처리](https://api.flutter.dev/windows-embedder/direct__manipulation_8cc_source.html)는 reset 콜백을 합성으로 억제하고 native inertia 이동과 framework momentum을 구분한다. 현재 [hit slop](https://api.flutter.dev/flutter/gestures/computeHitSlop.html)은 Flutter와 같아 임계값을 줄이는 변경은 하지 않았다.
- 트랙패드의 compositor 대기 worker를 제거하고 활성 입력 동안 **14ms HWND timer**로 Update를 실행한다. idle·종료 시 자기 timer를 정리하며 다른 WM_TIMER를 소비하지 않는다. 프레임 clock은 **DWM refresh 주기와 QPC phase를 기준으로 한 취소 가능한 고해상도 waitable timer**로 다음 요청을 예약한다. DWM 정보를 얻지 못하면 Flutter처럼 60Hz 기본 주기를 사용한다. 입력 시작에 새 compositor 활동을 기다리는 의존을 제거하며, 이 tick을 실제 vblank·표시 receipt로 판정하지 않는다.
- 이전 READY 취소·초기화 보류 변경을 철회하고 Flutter의 상태 처리 순서로 되돌렸다. 합성 reset은 READY까지 억제하고, GetStatus 보정도 **해당 reset 이후의 Update를 실제로 처리한 경우에만** 허용하도록 reset serial을 확인한다. 실제 새 제스처 직전 reset drain, 명시적 취소·fallback 휠·단일 입력 소유권은 유지한다. SDK의 두 네이티브 호스트도 더 이상 precision 입력용 UI-post callback을 전달하지 않는다.
- 관련 회귀 **40/40 PASS**다. 기존 frame/backpressure·native receipt·SDK sequence·정상 취소 외에 실제 HWND timer의 stationary 갱신·idle 정리·다른 timer 제외, **실제 nonidentity native transform의 ZoomToRect reset callback**을 추가했다. native frame clock의 요청 8회 최대 대기는 **6.54ms**, idle 중 자체 tick 0, stop 후 callback 0이었다. 이는 clock 검사이며 앱 FPS·물리 스크롤 해결 수치가 아니다. 모든 테스트 timeout은 20분이고 임시 폴더는 finally에서 정리했다.
- 공통 precision/header 설치본은 원본과 byte 일치한다. precision SHA-256은 `9b0dfed73feb0fedb3f2e0ebdc82a304c4e00abc1bd06197ca1475d00f746f08`, frame clock은 `c484cfd9bdf44034b936c11d188d6fc9c2e03e8225d0e5ef8c969cdb7f3abb0c`다. SDK archive `a73020207bb0359707dca069b6928c7b58ac7f065020aacd7828b4bf9d1a5edd`, RN `928e829c4b7f7ff0dcbc907e92e69952260895219aa7de761938172ee483bf63`, Skia Native `5cce6cfc42562e8eaf29862440bc7538cd19211531b58c523703393b444cc1ae`를 설치했고 새 native inputs는 `bd21dc7581ae9c71cc5cf7ed970aedc6578ace752009c272d29665c822e21a9e`다. Core·SDK TypeScript 변경은 없다.
- 이전 진단 앱은 정상 닫기 요청 뒤 종료를 확인했고 관찰자도 협력 종료했다. 종료 코드 조회는 null이라 exit 0으로 기록하지 않는다. Flutter 주기 반영 AOT 빌드·패키징은 exit 0이며, 전체 native UI 통합 검증도 **PASS**였다(Hermes supplier optimized bytecode, 약 165.89초). 실제 Fabric/UIA·TSF·픽셀·입력 소유자 1개·정상 close/drain 범위다. 새 물리 재현 해결 판정은 아직 **notVerified**다. raw 로그·별도 receipt·history는 보관하지 않는다.
- 뒤이은 실제 AOT 세 화면의 연속 OS 휠 검사에서는 Material 최대 화면 변화 간격 **169.64ms**, ListView **98.25ms**, Cupertino **98.11ms**였다. 세 프로세스 모두 exit 0·drain을 관찰했지만 **Cupertino 종료 중 `Windows UI requires its active JS platform` / `REACT_ERROR`가 발생해 전체 검사는 FAIL**이다. Material 창 전환의 기존 actual-frame/actual-commit resize timeout 각 2회도 유지했다. 이를 스크롤·리사이즈 성능 수락으로 바꾸지 않는다.
- 종료 경합 보강: UI의 Composition 상태가 이미 closing/closed/failed이면 큐에 남아 있던 JS frame batch와 그 안의 다음 callback을 실행하지 않는다. UI close에서 JS shutdown handler 도착까지의 틈에 새 UI 작업을 시작하지 않도록 `RNSkWindowsHost::canDeliverFrames`를 추가했다. 이미 승인된 GPU producer의 별도 drain permit은 유지한다. **수정 후 실제 종료 전용 통합 1/1 PASS**다(약 145.00초, supplier optimized bytecode). native producer가 active에서 승인된 뒤 closing에서 완료되고 `views=0 consumers=0 gpuDrained=1 inputRetired=1`로 종료됐다. harness에 위 React/platform 오류가 없어야 한다는 조건도 추가했다. **최신 AOT의 원래 세 화면 검사 전체는 사용자 마무리 요청으로 다시 실행하지 않았다.**
- 최신 RN archive는 **`080765e384fd55284142d34fa508cc40e8d2a41fc73736f795903d9a065c45b0`**, 설치·원본 host header는 **`f8e006f74ffe71f6084ea76a5782f20b077c442e6183c295b9dfd8ecfac4eab1`**로 일치한다. native inputs `bd21dc7581ae9c71cc5cf7ed970aedc6578ace752009c272d29665c822e21a9e`와 위 precision/frame clock·SDK·Core 공급은 그대로다. 최신 Static Hermes / optimized / x64 Release 빌드·패키징은 **PASS / exit 0**, 1,775개 파일 inventory·runtime·last-package locator 검증도 PASS다.

| 현재 중단점의 최종 Release 출력 | SHA-256 |
| --- | --- |
| exe | `adc6f7c306c17a0f330979bde39509e118f5d48509b3ac46d99392900e1f089b` |
| AOT DLL | `a7277de3c12f69e2a033733c975043cb4ffbe13c6db14fff0bf3cfb2142c3f60` |
| package manifest | `7e357735ba60b25a200922839c7f2eb23558094abc4aa9a216170136c0fa9cbb` |

- 재개 순서: 최신 패키지의 `test:windows-continuous-scroll`을 다시 실행해 Cupertino 종료 오류 보강을 원래 조건에서 확인한 뒤, 사용자의 실제 트랙패드 시작 지연·연속 움직임·제스처 전환을 확인한다. 자동 휠 통과만으로 물리 문제 해결을 선언하지 않는다. 수정 패키지는 아래 기존 명령으로 실행할 수 있다. 현재 진단 앱·화면 관찰자·진행 중 검증은 종료된 상태이며 새 임시 staging·추가 로그를 남기지 않는다. 기존 자동 승인에서 거절된 옛 임시 폴더는 재시도하지 않았다.

```powershell
npm.cmd run test:windows-continuous-scroll
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

## 10. 전체 작업 재개 (2026-10-28)

- 시작 HEAD `8ea9db8`, dirty 없음, 시작 work SHA-256 `ed88d0dcfa905f6a036e70c467955b1154490f030e883fda6e34cf1a99c19c8f`. 저장소의 20분 timeout·실행별 finally 정리·로그/receipt/history 비누적 규칙을 적용한다. 과거에 거절된 임시 폴더 삭제는 재시도하지 않는다.
- 최신 package locator manifest SHA-256은 §9 최종 표의 `7e357735ba60b25a200922839c7f2eb23558094abc4aa9a216170136c0fa9cbb`와 일치한다. 패키지 inventory/runtime 검증 뒤 같은 실제 Static Hermes / optimized / x64 Release 앱의 `test:windows-continuous-scroll` **1/1 PASS**(약 59.81초). 세 화면 양방향 각 3초 연속 OS 휠, Material 최대화·복원/포인터 이동, 입력 직후 닫기를 확인했다.

| 화면 | 입력 중 최대 화면 변화 간격 | 숨김 | HWND 파괴 | 프로세스 종료 |
| --- | --- | --- | --- | --- |
| Material | 144.88ms | 2.04ms | 1,886.22ms | 1,936.54ms |
| ListView | 115.09ms | 3.48ms | 1,870.79ms | 1,930.12ms |
| Cupertino | 115.01ms | 2.24ms | 1,836.50ms | 1,896.04ms |

- 세 프로세스 모두 exit 0·`views=0 consumers=0 gpuDrained=1 inputRetired=1`. 직전 Cupertino 종료의 React/platform 오류는 재현되지 않았다. Material 최대화·복원의 기존 actual-frame/actual-commit timeout 각 2회는 남았다. 자동 OS 휠 통과는 물리 트랙패드의 시작 지연·연속 동작·재접촉 해결 판정이 아니며 **`notVerified`**를 유지한다.
- 아래 Static AOT 리사이즈 기본 6조합, 최소 계측, width/height QPC 및 600px breakpoint를 같은 실행의 빌드에서 측정했다. CPU와 native 동기화 비용이 남아 있으며 GPU 구조·대기 제거 변경은 추가하지 않았다.
- AOT fixture가 native 실행 전 타입 오류로 중단되는 문제를 수정했다. 통계 helper를 타입이 있는 공통 `.ts`로 바꾸고 recording/배열 구분·RenderBox 좌표 접근·QPC 통계 키를 바로잡았다. 묶음 실행에서도 AOT 초기화와 실제 선택 함수 호출을 확인한다. 948모듈 사전 검사 PASS, 통계·glyph·정확한 세대/취소 native 회귀 **8/8 PASS**, 전체 workspace typecheck PASS다. 제품 Core·SDK·native 로직은 이번 재개에서 아직 변경하지 않았다.
- 현재 Core source 623개·dist 2,492개, SDK source 113개와 Windows 3개 원본/설치 디렉터리의 전체 파일이 byte 일치한다. 실제 Release exe·AOT DLL·manifest SHA는 §9 최종 표와 같다. 제품 패키지를 새 빌드로 교체한 것으로 기록하지 않는다.
- 리사이즈 기본 궤적은 live-resize에서 4초 왕복으로 맞췄다(다른 검사 모드의 기존 2초는 유지). 단기 V8/CanvasKit·CPU picture fixture의 표본은 추가 최적화 후보를 좁히는 진단이며 Hermes 성능이나 실제 표시 수락으로 쓰지 않는다. path 기록은 이 소스 진단에서 paint 비용의 작은 부분이므로 최적화하지 않았다.

### 현재 Static AOT 리사이즈 결과

- 현재 설치 Core·native host, Static Hermes / optimized / x64 Release, semantics 50ms, 요청 61Hz·4초 왕복이다. 5개 프로세스에서 기본 6·최소 계측·width/height QPC·600px breakpoint **총 10사례 PASS / exit 0**다. 전체 실행 약 **1,069.27초**, 테스트 timeout 20분 안에 완료했다. 앱 전체 native AOT 커버리지와 각 실행의 초기화·실제 선택 함수 호출도 확인했다. 컴파일 약 800.74초, host 빌드 약 182.25초는 성능 표의 프레임 비용과 구분한다.

| 장면 / 모서리 | 실제 입력Hz | geometry/s | desktop 변화/s | geometry 간격 p95 | resize CPU p95 |
| --- | --- | --- | --- | --- | --- |
| Material / bottom-right | 60.99 | 19.95 | 19.71 | 54.99ms | 22.34ms |
| Material / top-left | 60.98 | 20.00 | 19.76 | 55.00ms | 23.85ms |
| ListView / bottom-right | 60.97 | 19.29 | 19.04 | 60.31ms | 25.41ms |
| ListView / top-left | 60.99 | 19.36 | 19.11 | 60.39ms | 26.98ms |
| Cupertino / bottom-right | 60.99 | 20.10 | 19.85 | 55.27ms | 23.13ms |
| Cupertino / top-left | 60.98 | 19.18 | 18.93 | 60.69ms | 26.60ms |

- capture on 7사례 **1,533개**에서 배경 노출·glyph 변형/누락·우측 marker·잘못된 geometry/generation·예상 origin 오류 0건이다. 전체 10사례의 준비 timeout·제안 거절도 0건이다. capture off 3사례의 화면은 `notObserved`다. 각 프로세스에서 보이지 않는 후보 준비 취소·실제 geometry 복원과 `views=0 consumers=0 gpuDrained=1 inputRetired=1`을 확인했다. §8의 과거 marker 실패와 큰 창 전환 timeout을 소급해 해결로 바꾸지 않는다.
- 최소 계측은 **19.68 geometry/s, resize CPU p95 26.05ms**다. 캡처 기본 결과와 작은 차이만으로 overhead의 방향을 확정하지 않는다. §8은 bytecode, 이번 표는 Static AOT이므로 수치 차이를 이번 코드 수정의 개선율로 계산하지 않는다. **51 geometry/s·CPU p95 10ms 목표 미달**이며 `resizePerformanceAccepted=false`다.
- width QPC: **1,618 event / invalid 0**, metrics **82/82**가 기존 예약과 합쳐졌고 첫 build 82개 모두 정확한 prepared-copy와 연결됐다. 총 Root build **93개**, metrics→build p95 **8.78ms**, metrics→copy retirement **36.20ms**다. exact resize Root p95 **24.28ms**, layout flush **7.57ms**, recordPaint **9.11ms**, compose **4.04ms**, capture **0.18ms**다. layout·paint·semantics는 Root와 중첩되므로 합산하지 않는다.
- height QPC: **3,064 event / invalid 0**, metrics **103/103**이 기존 예약과 합쳐졌다. 총 build **211개**이고 첫 build 103개 중 **102개**만 prepared-copy와 연결됐다. exact prepared-copy frame 자체는 103개다. 모든 첫 build가 준비에 사용됐다고 기록하지 않는다. exact resize Root p95 **11.28ms**, layout flush **2.56ms**, recordPaint **3.61ms**, compose **1.66ms**, capture **0.14ms**다. metrics→copy retirement p95 **24.90ms**, geometry **25.47/s**다. UI prepare-after-arrange 중앙값 **17.10ms**, 뒤이은 pre-geometry clock **3.64ms**, WinUI commit **0.43ms**, native commit completion **6.90ms**, DwmFlush tail **5.78ms**를 각각 관찰했다.
- 추가 프레임 요청 계측도 실제 AOT에서 동작했다. width는 idle **15회**·transient **11회**, height는 idle **99회**·transient **14회**가 예약을 만들었다. idle에서 처음 보존한 stack은 mouse exit→highlight/state→layout 요청, transient의 첫 stack은 animation tick이었다. 단계당 첫 stack 하나이므로 같은 단계의 전체 횟수를 한 원인에 귀속하지 않는다. 입력·hover·애니메이션의 실제 요청을 버리는 최적화는 하지 않았다. GPU producer/queue·copy/retirement는 순수 GPU 실행 시간이나 표시 receipt가 아니다.
- breakpoint는 **18.58 geometry/s, resize CPU p95 58.97ms**다. 218캡처에서 예상 padding 전환 4회·origin 최대 오차 **0px**, glyph 변화 0건이다. 여전히 18px short header 범위이며 큰 제목의 28/36px 전환은 `notVerified`다.

### 사용자 트랙패드 확인과 남은 범위

- 같은 제품 패키지를 Explorer가 시작한 숨김 launcher에서 독립 실행했다. 앱 **PID 11420**, `NelyxTestbed2`, visible·`Responding=True`다. 앱에만 `NELYX_WINDOWS_INPUT_TRACE=1`을 전달하고 콘솔 trackpad/frame 진단은 껐다. RAM 화면 관찰은 **NoHook / hookInstalled=false**로 실행했다.
- 사용자 확인: ListView의 처음 스크롤·10초 이상 연속 이동·손을 뗀 뒤 재접촉에 대해 **“시작·연속·재접촉 모두 정상”**이라고 답했다. 이 실행의 물리 입력 확인은 **PASS-scoped**다. 과거 0.7~1초 끊김의 모든 장치·장시간 재발을 배제한 것으로 확대하지 않는다.
- 같은 실행에서 native 입력→payload→SDK 수신→Core 처리 시작/종료가 모두 **2,590건**으로 일치했다. SDK/Core drop·frame failure 표본은 없고, 마지막 native submission **3,118**은 Core input **2,590**까지 surface update·retirement로 연결됐다. 이는 입력 보존·native 완료 관찰이며 표시/scanout 완료 receipt가 아니다. 보존된 JS frame work 197.14ms·112.65ms 표본 두 건은 별도로 남기며, 사용자에게 정상 확인을 받은 동작을 1초 정지로 재해석하지 않는다. reader의 300ms 이상 frameGaps는 모두 submissionDelta>1인 표본 누락 간격이어서 연속 제출 정지로 세지 않는다.
- 관찰자는 협력 종료했고 worker 0개를 확인했다. 사용자 앱은 계속 사용할 수 있게 열어두었다. 실행의 finally 뒤 새 검증 임시 디렉터리·AOT staging·동적 runner entry는 모두 0개다. 파일 로그·receipt·별도 history는 추가하지 않았다. work·한/영 README의 local link/anchor 22개·fence와 `git diff --check`도 PASS다. 문서 검사 결과를 추가 제품 수락으로 세지 않는다.
- 남은 구현/수락: width layout·paint 비용, height의 추가 요청별 원인과 native 동기화의 중첩 가능성, source frame/commit/desktop frame 연결, 큰 최대화·복원 timeout, 큰 제목 전환, 물리 DPI·IME·다른 장치/장시간 사용과 전체 scanout이다. 현재 수치로 전체 계획을 완료로 바꾸지 않는다. 다음 변경은 동일 AOT 조건의 시간 분해를 기준으로 한 병목 하나에 한정하고, 이미 실패한 native 대기 제거·Root paint/제출 생략을 재도입하지 않는다.

## 11. 텍스트필드 구간 스크롤 후속 (2026-10-28)

- **PARTIAL / SDK 수정·runner 설치·제품 AOT 반영 완료, 텍스트필드의 물리 스크롤·IME 수락은 notVerified**. 최신 빌드·실행 상태는 §14를 따른다. 사용자가 일반 `npm run run:windows --workspace @nelyx/testbed-2`에서 텍스트필드가 있는 구간만 특히 버벅인다고 범위를 좁혔다. §10의 ListView 트랙패드 PASS-scoped를 이 구간의 수락으로 확대하지 않는다. 시작 HEAD `2208b94ae8f5fd48930e2dc4743fd9d14b727794`, dirty 없음, 시작 work SHA-256 `04ab5e792d7ac88f9742bb05428e2fb03ff1227d5f961c02a6f9bf2a0d88cf33`.
- 같은 일반 명령으로 기존 패키지를 실행해 `NelyxTestbed2` PID 20060의 Material 텍스트필드 구간에 OS 휠로 접근했다. 화면 관찰 중 물리 Escape로 Computer Use가 중단되어 이후 앱 조작을 멈췄다. 새 SDK를 반영한 제품 실행·표시 성능은 확인하지 않았다.
- 공통 `NativeInteraction.updateGeometry`는 입력 좌표를 native port에 전달한 뒤, 필드 bounds가 움직일 때마다 전체 호스트 store도 발행했다. 실제 Material gallery CPU fixture의 동일 24프레임 진단에서 일반 selection 구간은 24회, text 구간은 **120회(프레임당 5회)** 발행했다. Windows의 nonvisual TSF에는 backing control 위치 변경이 필요 없는데, 필드 4개가 각자 이전 semantics snapshot의 React 트리를 다시 갱신하도록 알린다. 이 중복 발행은 확인된 비용이며 실제 사용자가 느낀 전체 정지의 유일한 원인으로 확정하지 않는다.
- `NativeInteractionPolicy.inputControl`로 nonvisual 입력을 명시하고 `WindowsInteraction`에 적용했다. 입력 geometry·bounds 저장·TSF 전달·configuration/수명 알림을 유지하며 필드 이동만으로 전체 store를 발행하지 않는다. 완성된 semantics snapshot이 해당 프레임의 접근성 트리를 갱신한다. Android 등 기존 visual 입력은 bounds 변경 알림을 유지한다. 같은 CPU fixture에서 text 구간 발행은 **120→24회**다. React/native 실행이 없는 진단이므로 앱 FPS나 체감 개선율로 계산하지 않는다.
- `windows-editor-scroll.test.mjs`에서 실제 Core ListView의 필드 4개를 스크롤하며 Windows 접근성 on/off·Android의 호스트 발행 횟수, 모든 입력창 좌표/epoch 전달, semantics의 동일 프레임 geometry, 텍스트 보존을 확인했다. 기존 native editing/query·retirement·Windows service/view와 함께 **54/54 PASS**, 모두 20분 timeout이다. `test:windows-input`에 새 회귀를 연결했다. SDK build와 `git diff --check`도 PASS다.
- SDK archive는 `83a2cee8cb86b8bfa7af5ab1c41b183f616652f4301712625c3610ef152e85ce`다. 이 절의 직전 중단 시점에는 공급 참조만 갱신했고 설치본·앱은 이전 바이트였다. 이후 설치·제품 재빌드를 마쳤으며 §12의 자동 갱신 명령을 사용한다. 남은 수락은 Material·Cupertino의 텍스트필드/폼 구간을 비포커스·포커스 상태로 실제 스크롤해 확인하는 것이다.
- 이번 진단용 `.tmp/text-field-scroll-profile.mjs`와 supply staging은 정리했다. 별도 로그·receipt·history를 남기지 않았다. 제품 성능 수락과 물리 IME는 `notVerified`, 기존 리사이즈 `PARTIAL / resizePerformanceAccepted=false`는 유지한다.

## 12. Windows run의 SDK 자동 갱신 (2026-10-28)

- **자동 갱신·재빌드·실행 구현과 검증 완료.** 텍스트필드 체감·물리 IME·전체 성능 수락은 별도 `notVerified`다.
- 사용자는 SDK 변경 시 `run`이 빌드 후 실행하도록 요청했다. Testbed `run:windows`에 저장소 소스/설치본 내용 비교를 연결했고, 변경된 패키지의 오래된 TypeScript 출력만 빌드한 뒤 공급·설치한다. 새 CLI는 설치 뒤에 로드해 이전 모듈을 재사용하지 않으며 기존 신호·native close/drain 처리를 유지한다.
- 공통 RNW `run`은 설치된 Nelyx 패키지의 내용 SHA-256과 앱 manifest의 `sdkInputsSha256`을 비교한다. 변경이 있거나 이전 manifest에 기록이 없으면 마지막 패키지의 엔진·AOT/bytecode·compiler profile·Debug/Release로 재빌드한다. 같은 내용이면 재빌드하지 않는다. 명시한 `--package`는 선택한 패키지를 그대로 검증·실행한다. 빌드 중 설치본 변경이나 빌드 실패 시 이전 실행 파일로 진행하지 않는다. 현재 패키지가 실행 중이면 기존 교체 방지 규칙을 유지한다.
- 새 검사는 같은 버전·mtime의 소스/JS/header 변경, 추가·삭제, 저장소 자동 빌드/공급/설치, 새 미참조 TS 모듈의 emit, 변경 없는 실행, 빌드/설치 실패, 실행 인자 전달과 Hermes AOT/bytecode·JSC interpreter·V8 설정 유지를 다룬다. 실행 회귀 **15/15 PASS**, 별도 기존 패키지 교체·rollback 회귀 **16/16 PASS**, CLI 선언 typecheck와 `git diff --check` PASS. 변경한 한/영 README 4개의 local link 44개·fence도 PASS다. 모든 테스트 timeout 20분, 임시 폴더는 finally 정리다.
- CLI가 SDK 지문을 runner에 전달하고 기존 `NelyxAppConfig.h`에 포함시킨다. 같은 버전·오래된 archive mtime의 헤더 교체도 native TU를 다시 컴파일하며 `last-build.json`의 같은 지문을 확인한 뒤에만 패키지를 발행한다. 템플릿만 먼저 갱신해 기존 sample runner의 기록이 누락된 중간 통합은 **exit 1 / 앱 실행 없음**으로 중단됐다. sample runner도 템플릿과 byte 일치하도록 수정했고 일치 회귀를 추가했다. 최종 실행에서 SDK 지문이 포함된 헤더에 따라 C++ host 24,429개 함수가 실제 재컴파일된 것을 확인했다.
- 실제 일반 명령 `npm run run:windows --workspace @nelyx/testbed-2`에서 CLI·Metro·Static AOT tooling의 기존 설치 내용 차이도 감지해 자동 공급·재설치했다. §11의 수정 SDK도 설치·AOT 앱 반영을 마쳤다. 최종 구성은 기존 **Static Hermes AOT / optimized / x64 Release**다. 최종 보강 실행 PID 13860의 visible title·`Responding=True`와 정상 close 후 CLI **exitCode 0**을 확인했다. 이후 같은 명령을 다시 실행했을 때 SDK build/supply/install·native/AOT build 출력 없이 기존 패키지에서 앱 **PID 3180 / NelyxTestbed2 / Responding=True**가 시작됐다. 이 앱은 사용자가 확인할 수 있게 열어두었다.
- 실제 패키지 1,775파일 inventory·runtime·locator manifest, 설치 SDK 지문·build acknowledgement·generated header·앱 manifest의 일치를 확인했다. AOT 소스에 `inputControl: 'nonvisual'`과 중복 발행 억제 분기가 포함됐다. SDK 지문 `9ce3abc29bf108ba72077e76f3088fb7d73bdcc269762ebf0c8e273200722f55`, exe SHA `e5b854da9e074d3989f4da643d4b493f11d2fb07d052cad97adcd44909f2d15c`, AOT DLL `f74b1cf0ad07cb2b7bb6eabcedc9e1b2477a13158a19cf37165cf41388393095`, manifest `aaab608eb1c801f3110cfbe71d6aa82ba4ef604bedb3ba0a1b3c023495f388ea`다. 변경 없는 SDK 확인의 별도 읽기 진단도 약 1.75초·추가 build/install 0회였다. 이 시간은 앱 전체 시작 시간이나 표시 성능이 아니다.
- 이번 supply staging·native AOT staging은 모두 finally 정리됐다. 별도 로그·receipt·history를 남기지 않았고 이전 삭제 거절 경로는 건드리지 않았다. 원래 `resizePerformanceAccepted=false` 및 텍스트필드의 물리 스크롤/IME `notVerified`를 유지한다.

## 13. 접근성 스크롤 갱신 간격 (2026-10-29)

- **PARTIAL / 구현·Core 회귀·Windows UIA 진단·일반 AOT 재빌드/실행 완료, 물리 체감 수락 notVerified.** 사용자가 접근성 위젯 전반에서 버벅임이 남는다고 보고했고 갱신을 약 1초로 제한하자고 제안했다. §11의 중복 발행 제거와 §12의 재빌드 성공을 체감 해결로 취급하지 않는다.
- 기존 설치본의 Windows Hermes bytecode 진단에서 호스트 전달을 켠/보류한 text 구간 frame CPU p95는 **30.65/30.20ms**로 비슷했다. 전달 보류 중에도 Core 계산은 유지했다. 접근성 계산이 매 프레임 실행되는 비용을 먼저 줄이는 근거이며, 호스트 비용만을 원인으로 확정하지 않는다.
- Gallery `semanticsUpdateInterval`을 **1000ms**로 설정했다. 텍스트필드도 위치만 변하면 계산을 합치고, 마지막 semantic invalidation 뒤 **100ms** 또는 1초 상한 중 이른 시점에 최신 snapshot을 발행한다. 같은 dirty 집합에 새 움직임이 추가되는 경우도 revision으로 구분하며 clock polling·관계없는 프레임은 quiet deadline을 연장하지 않는다. TSF 입력 geometry는 계속 매 프레임 commit한다. 위젯 상태·포커스·뷰 수명 변경과 접근성 요청은 기존 즉시 갱신 경로를 유지한다.
- 지연 중 text/selection/range 요청은 새 snapshot을 먼저 요청하고 내용·selection revision·editing owner·privacy·readOnly·source visibility를 재검사한 뒤 실행한다. 이전 내용에 대한 요청이나 disabled/retired 필드의 요청은 수행하지 않는다. 입력 geometry/paragraph가 있는 snapshot을 idle paint에 재사용하지 않는다.
- 실제 Core ListView의 필드 4개·20프레임/1초에서 접근성 계산 1회와 매 프레임 입력 geometry를 확인했다. 정지 100ms 후 최종 좌표, 즉시 값 변경, 지연 edit·selection·range reveal, 변경된 revision/disabled 요청 거절과 wake 취소를 검증했다. 관련 기존 회귀 **202/202 PASS**, 추가 지연 selection/range 포함 편집 회귀 **12/12 PASS**, timeout은 모두 20분이다. 한/영 sample README에 동작을 반영했다.
- Windows Hermes bytecode/optimized의 같은 프로그램 스크롤 진단에서 selection/text 접근성 capture는 **45/84→9/3회**, frame CPU p95는 **13.86/30.65→11.76/22.46ms**였다. 변경 후 측정에는 일반 앱 AOT 컴파일이 동시에 실행됐고 단일 비교이므로 전체 FPS나 체감 개선율로 확대하지 않는다. native UIA에서 실제 selection 컨트롤과 text-field의 정지 후 bounds가 Core·DPI 좌표와 1px 이내로 일치했다. fixture는 `closed views=0 consumers=0 gpuDrained=1 inputRetired=1`로 정상 종료했고 임시 빌드·runner entry를 finally 정리했다.
- 일반 `npm run run:windows --workspace @nelyx/testbed-2`가 Core 변경을 감지해 공급·설치 후 기존 **Static Hermes AOT/optimized/x64 Release**로 자동 재빌드했다. 설치 Core와 저장소 출력이 일치하고, 1,775개 제품 파일·runtime·locator와 SDK 지문/빌드 acknowledgement/manifest 일치를 확인했다. AOT 소스에도 `1000ms`, quiet deadline `100ms`, 지연 text action 재검사가 포함됐다. 앱 **PID 26320 / NelyxTestbed2 / Responding=True**와 정상 close 후 CLI **exitCode 0**을 확인했다. 같은 명령으로 다시 실행했을 때 SDK 공급·설치·AOT/native 재빌드 없이 앱 **PID 23232 / Responding=True**가 열렸다. 사용자가 확인할 수 있게 열어두었다.
- 최신 SDK 지문은 `c3dba9489554226de7a4f11dec2d0570a42f3235059d62adc9a96b630ad4985a`, 제품 manifest SHA-256은 `094927a42d531f3af968826bf2a5a51caf5ad80069d5d1569209dd461b34abe4`다. native AOT·supply staging과 Windows fixture 임시 폴더/entry는 모두 정리됐고 현재 Release 패키지만 남는다. 별도 로그·receipt·history는 추가하지 않았다. 물리 스크롤·IME와 전체 성능 수락은 **notVerified**, 기존 `resizePerformanceAccepted=false`는 유지한다.

## 14. 접근성 위치 갱신 300ms 조정 (2026-10-29)

- **사용자 요청으로 작업 종료 / 설정·회귀 PASS, 새 제품 패키지 반영·실행 미완료.** 사용자 요청에 따라 Gallery의 `semanticsUpdateInterval`을 1000ms에서 **300ms**로 변경했다. 정지 후 100ms 최종 갱신, 포커스·값·활성 상태·접근성 동작·IME 좌표의 즉시 반영은 유지한다. Core와 SDK 코드는 추가 변경하지 않았다.
- 실제 Core ListView의 필드 4개를 18프레임/900ms 동안 이동시켜 접근성 계산·발행 3회와 매 프레임 입력 geometry를 확인했다. 정지 후 100ms 최종 좌표, 즉시 값 변경, 지연 편집·revision 거절·wake 취소를 포함한 관련 회귀 **4/4 PASS**, timeout 20분이다. 한/영 sample README도 300ms로 맞췄다.
- `npm run start:windows:static-aot --workspace @nelyx/testbed-2`의 재빌드 도중 사용자가 외출을 위해 종료를 요청했다. 해당 npm/CLI 빌드 프로세스 트리를 중단했고 새 앱은 실행하지 않았다. 현재 배포 Release 패키지는 §13의 **1000ms 설정**이며 300ms 소스의 제품 반영은 완료하지 않았다. 새 native AOT staging·package staging은 남아 있지 않다. 재개 요청이 오면 같은 명령으로 빌드·패키징부터 이어갈 수 있다. §13의 성능 수치·UIA 결과와 제품 manifest는 이전 1000ms 설정의 기록이다. 300ms의 물리 스크롤 체감·IME와 전체 성능 수락은 **notVerified**이며 기존 `resizePerformanceAccepted=false`를 유지한다.

## 15. All Components 트랙패드 스크롤 후속 (2026-10-29)

- **PARTIAL / 엔진·SDK 구현, source 회귀 118 PASS·1 optional profile SKIP, 전체 typecheck·native 진단·최신 AOT 제품 반영/실행 PASS-scoped. 최초 섹션 생성의 긴 프레임과 물리 체감 수락은 남아 있다.** 사용자는 ListView의 FPS는 허용 가능하지만 All Components에서 트랙패드 스크롤이 버벅인다고 보고했다. 시작 HEAD `3db13678d8f0073b088da06c9b1d1e529feca81c`, dirty 없음. 일반 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 기존 Static Hermes 앱을 실행해 All Components의 OS 휠 이동과 정상 종료 `exitCode 0`을 확인했다. 이는 사용자가 확인한 물리 트랙패드 재현이나 300ms 소스의 패키지 반영 확인이 아니다. 기존 패키지는 §14의 1000ms 상태였다.
- Node/CanvasKit에서 실제 Gallery·ListView 위젯을 동일한 작은 창으로 구성해 CPU 단계를 분리했다. 복잡한 섹션의 최초 생성/layout이 긴 프레임을 만들고, 텍스트필드 구간을 지난 뒤에는 보존된 편집기의 입력 좌표를 계산하며 부모의 재귀적 `isDisplayed`를 각 부모에서 반복 조회했다. 입력 좌표 생성뿐 아니라 SDK의 glyph/selection query에서도 같은 중복이 발생했다. `RenderObject`는 일반 상속 getter를 건너뛰고 실제 visibility override를 조회한다. 숨김·instance override·View/paint/geometry epoch 검사는 유지하며 descriptor cache는 한 query/commit 안에서만 사용한다.
- Core가 검증·deep capture한 `TextInputGeometry`만 WeakSet으로 식별해 SDK에서 재복사하지 않는다. 외부의 `Object.freeze`만으로 신뢰하지 않으며, 같은 mutable packet이 재사용되어도 매번 재검증/캡처한다. SDK의 원본 참조만 비교하던 shortcut도 제거했다. 입력 좌표는 계속 매 프레임 commit하며 300ms 접근성 간격과 정지 후 100ms 갱신은 유지한다.
- 공통 `SliverChildPolicy`의 bounded 모드에 목록별 `capacity: 0..8`을 추가했다(생략 시 기존 8). View 전체 optional child 16개·Element 2,048개 한도와 명시적 편집기 keep-alive를 유지하고, capacity 축소는 일반 layout 경로로 정리한다. Material·Cupertino Gallery는 `capacity: 2, preparation: 'disabled'`를 사용한다. 최근 섹션의 실제 State와 paint recording을 재사용하되 복잡한 최초 생성은 demand-driven으로 남는다. 제한 없이 적용한 중간 실험은 paragraph producer 목표를 초과해 채택하지 않았다. 최종 전체 Material 탐색은 producer peak **92**, resident paragraph peak **115**로 기존 128/256 목표 안이다.
- source 검증은 deep visibility·숨김/instance 변경, immutable/mutable geometry, native caret/hit/IME revision, bounded capacity 축소·압력·GlobalKey·retirement, optional preparation, 실제 Gallery의 연속 precision pan contact·동작·레이아웃·편집 소유권을 포함해 **118 PASS / 1 optional CPU profile SKIP / 0 FAIL**다. 전체 workspace `check:types`도 PASS다. 모두 timeout 20분이다. `Nelyx/eng/profile-gallery-scroll.mjs`는 콘솔로만 단계·선택적 CPU 표본을 출력하고 profile 파일을 보관하지 않는다. Windows fixture의 `gallery-scroll` 모드는 실제 ListView와 Gallery 최초/재방문/보존/텍스트 구간을 측정한다. 프로그램 스크롤·OS 휠·물리 트랙패드·표시 수락을 구분한다.
- Windows Hermes bytecode/optimized의 native `gallery-scroll` 진단은 5구간과 정상 close/drain을 통과했다. aggregate trace를 켠 CPU p95는 ListView 22.99ms, Gallery 최초 48.84ms, 재방문 29.68ms, 보존 구간 11.04ms, text 구간 29.88ms였다. 최초 구간 최대는 179.75ms여서 cold 생성이 해결됐다고 쓰지 않는다. 보존 구간은 103프레임이며 cache reuse hit도 관찰했다. 이는 source alias를 쓰는 프로그램 스크롤·bytecode·계측 조건의 진단이고 실제 AOT 제품 FPS나 트랙패드/표시 수락이 아니다. 이후 visibility 조회의 임시 배열 할당도 제거했고, 최신 출력의 관련 집중 회귀 6/6과 전체 typecheck를 다시 통과했다.
- 일반 `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 Core·SDK를 자동 공급/설치한 뒤 기존 **Static Hermes AOT / optimized / x64 Release**로 재빌드했다. native host 24,429개 함수와 AOT 43,305개 함수가 컴파일됐으며 소스·설치본 Core/SDK, generated header, build acknowledgement, 제품 manifest의 SDK 지문이 일치한다. 제품 1,775파일 inventory는 기존 CLI 검증을 통과했다. AOT 소스에서도 300ms 설정·visibility 경로·검증된 geometry 재사용·두 Gallery의 capacity 2를 확인했다. SDK 지문 `444d7aeefc59fbe943e669259d1a10fb53c990e48d2fcb91d481bd08a610712c`, 제품 manifest `3f62daf60cec2f024354cb0184fcad8d5babf97337d750af7b2f71b3ae96fd1a`, exe `a31108f1d75456a0b03f756ef42f7b6155246fdd52f8acc015f5af5e4ca5d744`, AOT DLL `821fc913be0da46f31c41ff5dbf216ee9fc427724fcf60968583cc3fa1d0cd33`이다.
- 실제 제품 앱 **PID 16064 / NelyxTestbed2 / Responding=True**에서 All Components의 selection→text 구간 OS 휠, text field의 표시 커서·포커스 후 역방향 이동, ListView의 항목 0013~0016 이동·Gallery 복귀와 텍스트 보존, Cupertino 전환·스크롤을 화면으로 확인했다. 정상 종료 뒤 CLI **exitCode 0**을 확인했다. 이는 클릭/OS 휠과 표시 내용의 범위이며 연속 FPS·물리 트랙패드·IME 전체 수락으로 확대하지 않는다. 같은 일반 명령을 다시 실행했을 때 공급/설치/native/AOT 재빌드 없이 **PID 4292 / Responding=True**가 열렸다. All Components 첫 화면을 확인해 사용자 트랙패드 확인용으로 열어두었고 체감 피드백을 요청했다.
- 임시 native fixture 폴더/runner entry·supply staging은 0개이고 이전 SDK archive나 dist 사본을 누적하지 않았다. 제품 Release만 유지하며 별도 로그·receipt·history는 추가하지 않았다. 한/영 README와 work의 local link 22개·fence, `git diff --check` PASS. 복잡한 섹션 최초 생성의 긴 프레임과 물리 체감·전체 표시 수락은 **notVerified / PARTIAL**로 남기며 기존 resize `PARTIAL / resizePerformanceAccepted=false`는 별도다.

## 16. 연속 트랙패드 끊김 재확인 후 추가 개선 (2026-10-29)

- **PARTIAL / 엔진·SDK 구현, source/native 회귀·최신 AOT 제품 반영·일반 실행/정상 종료 PASS-scoped. 새 제품의 물리 트랙패드 수락 대기, 최초 섹션 생성 지연 잔존.** 사용자가 §15 AOT 앱에서 **“연속 스크롤도 계속 끊김”**이라고 답했다. §15 빌드의 물리 체감은 미수락이며, 최초 생성만 남았다고 한정하지 않는다. 실제 창의 넓은 두 열 상태도 관찰해 진단 범위를 compact와 1280×약 730 logical의 두 열 화면으로 늘렸다. 기존 제품 PID 4292는 추가 반영을 위해 정상 종료했고 일반 runner의 `exitCode 0`을 확인했다.
- `RenderRichParagraph`의 dry 크기·기준선 질의는 `TextPainter`의 최대 두 너비 geometry cache를 공유한다. CPU source는 재사용하되 임시 native paragraph producer는 질의 안에서 해제한다. layout·font·detach 무효화는 geometry cache도 비운다. `RenderEditable`의 실제 layout은 표시 문단을 먼저 완성하고 그 geometry에서 높이/기준선을 읽어, 같은 문서를 임시 측정 후 다시 shaping하던 중복을 없앴다. 방향·정렬·width basis 24조합이 독립 표시 문단과 일치했고 편집기 최초/문서 교체는 본문 layout 1회를 확인했다.
- input geometry는 `isDisplayed`뿐 아니라 실제 부모의 `paintsChild`도 확인한다. offstage 및 sliver keep-alive bucket의 편집기는 glyph/selection getter를 읽기 전에 geometry를 철회한다. 실제 Windows SDK 연결에서 화면 밖 반복 이동 중 glyph 질의 0회, 최초 native null publication 1회, 복귀 후 같은 editor State·문서와 유효 geometry 복원을 검증했다. 일반 hook-only branch의 visibility 조회 0회, custom visibility/paint hook·frame epoch 검사는 유지한다.
- 최신 Core 출력의 관련 8파일 검증은 **152 PASS / 1 optional CPU profile SKIP / 0 FAIL**, 별도 inline WidgetSpan·RichText 수명 4/4 및 전체 workspace typecheck도 PASS다. 기존 전체 Material 탐색 목표를 변경하지 않았고 실제 producer peak 92 / paragraph peak 114였다. 테스트 timeout은 20분이다.
- Native input trace에 명시적 `NELYX_WINDOWS_INPUT_TRACE_FULL=1` 모드를 추가했다. 기본 16회 표본화·비활성 무할당은 유지하며, 전체 모드도 기존 8,192개 숫자 ring만 사용한다. 기본·전체·희귀 drop 보존·owner 종료/임시 파일 정리를 C++/PowerShell reader 통합 검사로 확인했다. 프로파일러의 `--entries`·`--viewport=wide`와 한/영 사용 설명도 반영했다. 별도 log/profile/receipt 파일은 보관하지 않는다.
- 프로그램 스크롤의 maximized Hermes bytecode 진단은 ListView→All Components 최초/재방문/보존→text 5구간과 정상 native drain을 통과했다. 보존 구간 CPU p95 약 11.3ms인데도 native surface update 간격이 주로 36ms여서 JS 시간만으로 연속 끊김이 해결됐다고 판단하지 않는다. 실제 AOT·물리 트랙패드·표시 수락은 이 측정에 포함되지 않는다. §15 수치와 viewport·엔진 조건이 달라 단일 개선율로 비교하지 않는다.
- Native 계측에서 같은 backing의 보존 구간 36프레임 동안 약 61/76MB scratch 할당이 매번 반복돼 총 74회·약 4.93GB가 할당됐다. publish는 약 0.5ms였지만 recording insert의 큰 할당이 약 11–13ms를 차지했다. 시작 시 Context 예산만 160MiB로 바꾼 진단은 프레임별 계산이 덮어써 효과가 없었고 채택하지 않았다. 실제 backing 2560×1459의 예산 계산을 40→48 bytes/physical pixel로 조정한 격리 비교에서 보존 83프레임의 allocator 할당은 **0회**, insert p95 **0.33ms**, native surface 간격 중앙값 **13.46ms / p95 22.96ms**였다. 재방문은 181프레임에 작은 할당 16회·총 1.30MB였다. 이는 AMD Radeon 780M·계측·프로그램 스크롤 조건이며 표시 FPS나 물리 체감 수락이 아니다.
- 공통 Windows Vulkan 경로에 48 bytes/physical pixel 계산을 반영했다. 기존 Context 96–192MiB 범위, Graphite allocator 256MiB 상한, backing-size 변경 시 정리와 wrapper retirement를 유지한다. 위 비교에서 Context 캐시는 약 153MB, allocator live 최대 약 202MB이며 전체 purge fallback은 없었다. fixture는 실제 warmed Gallery의 프레임당 할당량과 기존 두 메모리 상한을 검사한다. canonical source preparation과 native supplier 재빌드를 완료했다. 최초 복잡한 섹션 CPU 최대 약 155ms는 여전히 관찰돼 해결로 기록하지 않는다.
- 임시 예산 override 없이 현재 제품 소스로 native 5구간 회귀 **PASS / 0 FAIL**를 확인했다. 보존 92프레임의 새 allocator 할당은 **0회**, recording insert p95 **0.331ms**, surface 간격 **중앙값 12.19ms / p95 24.11ms**였다. 재방문 182프레임은 작은 할당 17회·1.20MB였다. Context 예산 179,281,920 bytes와 allocator live 최대 201,544,560 bytes는 기존 한도 안이며 purge fallback 없이 `closed views=0 consumers=0 gpuDrained=1 inputRetired=1`로 종료했다. native fixture 임시 폴더·entry는 finally 정리된다. 이 수치도 source alias·Hermes bytecode·프로그램 입력의 범위다.
- 소스와 설치된 Nelyx 패키지 9개의 내용 및 1,795파일 native inventory가 일치한다. 새 SDK 지문은 `8f9b0d208224691084071cead9705416ee829f8ae56148abfa0f27aa30d03a7c`, native input은 `65a93f4652c6f653b9a8cfaf6c69192cc3bf9c7ab1a002d1050fb2807725926e`다. 새 입력을 앱에 prepare했고 일반 `npm.cmd run run:windows --workspace @nelyx/testbed-2`에서 **Static Hermes AOT / optimized / x64 Release**로 재빌드·실행했다. AOT 함수 43,308개가 포함됐으며 실제 제품 1,775파일 inventory·1,386개 source map module, locator·build acknowledgement·SDK/native 지문을 검증했다. AOT 소스에 이번 문단/visibility/검증된 geometry 코드가 포함돼 있다.
- 최신 제품 manifest SHA-256은 `3cf864bfd50503d01b6f1efe156095b59b0a4f5d6bc2bcfe95f0525e398b9e43`, exe는 `60dbcd74c58c1f276686e54eb4848f267e5310d98f9a58ccf2843311e793a175`, AOT DLL은 `b023878b0d78ab631cde6faaecbe7c11ace92056096454d6731ce242a3cbb708`, AOT 소스는 `74318d08ac2d7dfcf46f4dc50aec54f10af450b4618e9ef01c3b217363ca6867`다. 실제 제품 **PID 10804 / NelyxTestbed2 / Responding=True**에서 두 열의 OS 휠 이동, text field 포커스·표시 커서와 화면 밖으로의 역방향 이동을 확인했다. 전체 input ring `sampleEvery=1`이 동작했고 SDK/Core drop·frame failure 기록은 없었다. 다만 실제 AOT에서도 cold 섹션 생성 CPU 약 **129.6ms**를 관찰했다. 정상 종료 뒤 일반 runner **exitCode 0**을 확인했으며, 이 범위를 물리 트랙패드·표시 FPS 수락으로 확대하지 않는다.
- 같은 일반 명령의 재실행은 SDK 공급/설치·native/AOT 재빌드 없이 **PID 17068 / NelyxTestbed2 / Responding=True**로 열렸다. All Components 첫 화면을 최대화해 트랙패드 왕복 확인을 요청했다. 사용자는 전반적인 FPS 개선을 체감했으나 텍스트필드 hover 시 잔끊김을 보고했다(§17). 입력 trace는 현재 앱의 고정 숫자 ring만 사용하며 별도 파일을 쓰지 않는다. native fixture·supply·AOT staging은 실행 종료 시 정리했고, 한/영 README와 work의 local link 68개·fence PASS다. 기존 resize `PARTIAL / resizePerformanceAccepted=false`는 별도 유지한다.

## 17. 스크롤 중 텍스트필드 hover 잔끊김 (2026-10-29)

- **사용자 외출 요청으로 작업 일시정지 / PARTIAL. hover 구현·검증 및 SDK 설치 완료, 새 AOT 제품 반영·실행·물리 체감 미확인.** 사용자는 §16 새 AOT에서 “전반적인 fps자체가 개선이 체감되긴한다”라고 답했다. 새 섹션이 나타날 때의 lazy 생성 지연은 이해하지만, 텍스트필드가 나타난 뒤 특히 스크롤 중 마우스 포인터가 그 위에 위치할 때 자잘한 버벅임이 남는다고 구체화했다. 전체 스크롤 수락으로 확대하지 않으며 hover·hit test·cursor·입력 장식 갱신을 대상으로 삼았다.
- 같은 PID 17068에서 Windows Precision pan 입력을 실제로 관찰했다. 마지막 보존 ring의 움직임 구간 약 5.31초·pan update 114개에서 native producer 지연은 중앙값 6.37ms / p95 9.87ms, active CPU는 중앙값 11.28ms / p95 36.54ms / 최대 75.99ms였다. SDK/Core drop·frame failure 기록은 없었다. surface 간격 분포에는 contact 사이 공백이 섞여 있으므로 전체 FPS로 해석하지 않는다. 이는 bounded ring의 마지막 구간이며 물리 finger lift·scanout을 증명하지 않는다. 사용자 피드백과 함께 CPU/hover 경로의 추가 진단 근거로만 사용한다.
- PID 17068을 정상 종료(`exitCode 0`)한 뒤 hover 경로를 분리했다. 실제 Gallery의 같은 24프레임을 비교하면 기존 hover에서 decoration build/layout 각 32회, editor build 6회가 발생했다. 문단 shaping은 0회여서 glyph 재측정이 주원인이라는 가정은 채택하지 않았다. `InputDecorator`는 색상·border 애니메이션을 paint notifier로 전달하고 동일한 슬롯 Widget을 재사용한다. border는 공통 `RenderRepaintBoundary`의 recording·retirement를 사용하며 gap 변경도 cache를 무효화한다. layout 설정이 같으면 장식 layout을 다시 요청하지 않는다. `TextField`는 같은 Widget·style·controller·focus의 편집기 Widget을 재사용하되 inherited 변경과 hover 상태별 사용자 스타일은 반영한다.
- 같은 Node/CanvasKit 진단에서 decoration build는 6회, 장식 layout과 editor build는 0회로 줄었다. timing은 Node 실행별 변동이 있어 제품 FPS 개선율로 쓰지 않는다. retained section의 실제 픽셀 hover 색상, layout/shaping/editor paint 0회, composing 문서·native owner 유지, hover 글꼴 16→22→16, notifier/ticker 해제를 검증했다. 실제 Gallery 고정 포인터 회귀와 입력 geometry·semantics·bounded sliver·paragraph·repaint·Material 회귀를 합쳐 **181 PASS / 1 optional profile SKIP / 0 FAIL**, 전체 workspace `check:types` PASS다(20분 timeout). Windows fixture에 같은 경로의 hover 안팎 2구간을 추가했다.
- Windows maximized/optimized Hermes bytecode의 새 7구간 source 진단은 **PASS**, 고정 포인터·focus 유지와 native drain도 통과했다. 텍스트필드 안팎의 같은 0↔176 스크롤에서 CPU p95는 밖 17.50ms / 안 17.03ms, 안쪽 native surface 간격은 중앙값 13.03ms / p95 23.09ms였다. warmed Gallery 95프레임과 hover 182프레임의 allocator 새 할당은 0회였고 기존 메모리 한도·purge fallback 검사를 통과했다. SDK를 갱신하기 전 §16 설치본 지문 `8f9b0d…d03a7c`와 새 hover 코드가 없는 것을 확인한 뒤 같은 7구간을 적용했다. 이전 설치본도 정상 종료했으며 CPU p95는 밖 19.01ms / 안 31.30ms, hover의 layout p95 3.26ms와 surface 간격 p95 36.64ms였다. 새 소스 hover의 layout p95는 0.54ms다. 이는 같은 native supplier·프로그램 스크롤·합성 Core 마우스·계측의 순차 비교이며 제품 AOT·물리 트랙패드나 표시 FPS 수락이 아니다.
- 검토 중 border 두께/outline gap이 바뀌면 라벨 위치 layout도 갱신해야 하는 경우를 보완했다. paint만 바꾸는 경로는 같은 위치 설정에 한정하며, 고정된 text style에서도 outline 1→5→1 두께 애니메이션과 floating label 위치가 일치하는 회귀를 추가했다. 이 보완 후 Material build 및 관련 **14/14 PASS**를 확인했다. 새 테스트를 포함한 고유 source 회귀 합계는 **182 PASS / 1 optional profile SKIP**다.
- 일반 `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 변경된 Core·Material을 공급/설치했다. 소스와 설치된 Nelyx 패키지 9개 및 현재 source map 입력은 일치하며 새 SDK 지문은 `fb46d16d2e56d93443b67fdde2b09cae77def782f97473a5094cb0330404e13f`다. 네이티브 호스트 빌드와 새 AOT 소스 생성까지 진행했고, AOT 소스 지문 `42d5b9e6c3c186bc1d94aa72605cefd42c604f727f2fce3935b6e5f3b6140e93`에 paint notifier·layout 판별·editor cache가 포함된 것을 확인했다. 사용자가 **“이제 외출해야해서 작업마무리해줘”**라고 요청해 `nelyx_app.c` native 컴파일을 중단했다. 새 AOT DLL·제품 패키지·앱 실행은 완료하지 않았다.
- 빌드 프로세스 트리는 모두 종료됐고 AOT staging·supply staging·package staging·native fixture 임시 폴더/entry는 **0개**다. 새 로그·receipt·profile·history나 이전 package 사본을 추가하지 않았다. 현재 locator의 §16 **Static Hermes AOT / optimized / x64 Release**는 inventory 1,775파일과 manifest `3cf864bfd50503d01b6f1efe156095b59b0a4f5d6bc2bcfe95f0525e398b9e43`, 이전 SDK `8f9b0d…d03a7c`가 검증돼 온전하다. 이 패키지에는 hover 수정이 없다. 다음 재개 시 같은 일반 명령으로 AOT 재빌드·패키징·실제 실행부터 이어간다. 현재 native build output의 혼합 중간 파일을 새 제품으로 간주하지 않는다. 새 hover 제품의 물리 트랙패드·IME·표시 성능은 **notVerified**, 기존 `resizePerformanceAccepted=false`는 별도 유지한다. 한/영 README와 work의 local link 68개·fence 검사는 PASS다.

## 18. 텍스트필드·버튼 hover 중 스크롤 잔끊김 후속 (2026-10-29)

- **구현·검증·최신 AOT 반영 PASS-scoped / 물리 체감 대기 / PARTIAL.** 사용자가 이전 수정으로 버벅임이 많이 완화됐지만 텍스트필드와 버튼 위에 포인터가 있을 때 여전히 남는다고 보고했다. 시작 HEAD `0d7b3499a893f14b3dbf4e6823f1c188b4da38df`, dirty 없음. 시작 locator는 §17 중단 당시와 달리 SDK `fb46d16d2e56d93443b67fdde2b09cae77def782f97473a5094cb0330404e13f`의 Static Hermes AOT 제품을 가리켰다. 일반 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 PID 28168을 실행해 두 열의 버튼 위 OS 휠 경로를 확인하고 정상 종료 `exitCode 0`을 확인했다. 기존 hover 수정이 제품에 없어서 발생한 문제로 한정하지 않는다.
- 공통 hit test에서 zero-offset wrapper의 소유된 identity affine product를 재사용한다. mutable·외부 frozen·signed-zero 값은 계산 경로를 유지한다. sliver 내부 bridge는 immutable transform part를 캡처하고 실제 소비되는 경로의 곱만 계산한다. 공개 source hit result의 즉시 실패·16-lane 변환·entry metadata 계약은 유지한다. 멈춘 포인터에 enter/exit callback이 없으면 source 이벤트도 만들지 않는다.
- Material 내부 shape/elevation/tint/shadow 애니메이션은 기존 ticker와 실제 `RenderPhysicalShape`에 paint 값을 전달한다. tick마다 State build와 sliver layout을 예약하지 않으며 내부 잉크·텍스트 recording은 공통 RepaintBoundary가 소유한다. shape/direction 변경은 clip·border를 갱신하고 State 종료 시 renderer 참조·paint notifier·ticker listener를 해제한다. 표준 physical renderer의 색·그림자 변화는 paint만 무효화하며 사용자 semantics override에는 기존 경로를 유지한다.
- 실제 Gallery 회귀에서 그림자가 계속 움직이는 동안 paint-only hover tick 6회의 추가 section layout **0회**를 확인했다. 전체 Material 탐색의 paragraph producer peak **92**, resident paragraph peak **114**를 유지했다. mutable/signed-zero/perspective 변환, source entry, 사용자 semantics override, shape/tint/RTL·중단/재시작/0-duration 애니메이션, notifier/ticker 해제, 입력·그림자·편집기·전체 Gallery 회귀와 Babel/import 검증은 고유 **141 PASS / 1 optional CPU profile SKIP / 0 FAIL**이며 workspace `check:types`도 PASS다. 테스트 timeout은 모두 20분이다.
- Windows fixture와 콘솔 profiler의 hover 비교에 실제 All Components 첫 열의 ElevatedButton 구간을 추가했다. maximized/optimized Hermes bytecode에서 기존 설치본과 수정 source alias 모두 **9구간 PASS** 및 `views=0 consumers=0 gpuDrained=1 inputRetired=1`로 종료했다. 수정본 텍스트필드 hover는 179 CPU 프레임에서 CPU p95 **20.89ms**, layout p95 **0.49ms**, native surface 간격 중앙값 **13.83ms / p95 23.35ms**였다. 버튼 hover는 223 CPU 프레임에서 CPU p95 **16.25ms**, layout p95 **0.52ms**, surface 간격 중앙값 **17.71ms / p95 25.96ms**였다. 설치본 일부 구간에는 source 검사가 겹쳤고 source alias·설치본의 번들 조건도 구분하므로 단일 개선율이나 AOT·물리 입력·표시 FPS 수락으로 해석하지 않는다. 복잡한 cold 섹션의 CPU 최대 약 **181.54ms**는 남아 있다.
- 일반 실행 명령이 변경 Core·Material을 공급·설치한 뒤 **Static Hermes AOT / optimized / x64 Release**로 재빌드했다. native host 24,429개와 AOT 43,358개 함수가 컴파일됐다. 소스·설치본 Nelyx 패키지 9개의 내용, build acknowledgement, 제품 manifest의 SDK 지문 `36a3a8f5b3163a2fa0e367b6474d57b17ad431d0eb46b5cbeb054aeeba61bb37`이 일치한다. native input `65a93f4652c6f653b9a8cfaf6c69192cc3bf9c7ab1a002d1050fb2807725926e`는 유지한다. 제품 1,782파일 inventory·locator 검증을 통과했고 AOT 소스의 새로운 변환·paint 경로 5개 marker도 확인했다.
- 제품 manifest SHA-256은 `506759f3e0d600846927501108006a3b13eaaf4eab8311e4fcd5bb95fc8b66b0`, exe는 `9df97a6fbe2622d5a27e881fb364a75e6498725e7fdc1a64d1de52f7f73ffb7c`, AOT DLL은 `e6e77cbfefd61f762bb121f102bedb0d8a9336363079e85e19280e8daed748d4`, AOT 소스는 `d4cd4c89a49ec852b5b70a038f122fb3689fc8603fa5f03ecd8354174bc3cb3f`다. 실제 제품 **PID 1604**에서 All Components 버튼 위 양방향 OS 휠, Text inputs의 실제 editor 포커스·표시 caret, 양방향 휠 후 focus·문서 보존을 화면과 UIA로 확인했다. 정상 종료 후 일반 runner **exitCode 0**을 확인했다. 같은 명령의 재실행은 공급/설치·native/AOT 재빌드 없이 **PID 13164 / NelyxTestbed2**로 열렸고 사용자 트랙패드 확인용으로 최대화했다. 이 관찰은 OS 휠·포커스·표시 내용 범위다.
- 이번 실행의 native fixture/runner entry·supply staging·새 AOT staging은 **0개**, 제품 폴더는 현재 `Release`만 유지한다. 이전 실행이 남긴 `windows/x64/Release/.nelyx-sh-mfB4Na`는 9파일·363,531,899 bytes·tracked 0·reparse 0·사용 중인 compiler 0임을 확인했지만, 자동 승인 검토가 계산 경로 및 고정 literal 경로의 삭제를 모두 `blocked by policy`로 차단해 유지한다. 제품에도 기존 잔여 staging의 7파일이 포함돼 정상 파일 1,775개에 더해 inventory가 1,782개이며, 이를 새 검증 로그나 기록으로 별도 보관하지 않았다. 한/영 README와 work의 local link 22개·fence, `git diff --check`를 확인했다.
- 사용자는 새 제품 PID 13164에 대해 **“개선됐지만 아직 남음”**이라고 답했다. §18 hover의 물리 체감은 **미수락 / 잔끊김 미해결**이다. 해당 앱을 정상 종료(`exitCode 0`)한 뒤 같은 제품을 `NELYX_WINDOWS_INPUT_TRACE=1`, `NELYX_WINDOWS_INPUT_TRACE_FULL=1`로 재실행한 **PID 20992**의 메모리 ring을 읽었다. 보존 입력은 hover뿐이며 연속 스크롤 재현은 관찰하지 못했다. PID 20992도 정상 종료(`exitCode 0`)했다. IME·표시 FPS 수락은 **notVerified**이며 기존 resize `PARTIAL / resizePerformanceAccepted=false`는 별도 유지한다.

## 19. 잔끊김 후속 — hover 재구성 중 접근성 갱신 (2026-10-29)

- §18 사용자 피드백에 따라 작업을 계속했다. 기존 단일 Text inputs 구간에 더해 실제 All Components 두 열의 첫 열 텍스트필드도 콘솔·Windows fixture 진단에 추가했다. Node/CanvasKit의 동일한 24프레임에서 필드 hover의 접근성 snapshot은 10회, 포인터가 없으면 2회였다.
- 값이 같은 Core Semantics wrapper는 원시 속성·동일 함수 참조를 비교해 갱신을 생략한다. mutable collection·derived properties·사용자 정의 render hook은 보수적 갱신을 유지한다. Focus와 Material semantic delegate는 hover 중 재사용하되 실제 focus owner나 사용자 callback이 바뀌면 delegate도 교체해 기존 snapshot action을 폐기한다. 커서 annotation과 metadata가 같은 단순 Text의 색상 변경은 paint만 갱신한다.
- 스크롤 위치 알림과 동일 visibility의 연결된 follower 이동은 source configuration을 재계산할 필요는 있지만 label/action의 변경은 아니다. 기존 geometry 갱신 큐로 넘겨 hover build가 겹쳐도 기존 접근성 주기 300ms·quiet 100ms를 유지한다. extent·scrollability·visibility·action·label 변경은 계속 즉시 갱신한다. IME geometry commit은 매 프레임 유지한다.
- 수정 후 Node/CanvasKit All Components 필드 hover의 snapshot은 24프레임 **2회**였다. 같은 진단의 CPU p95 관찰값은 수정 전 **15.42ms**, 수정 후 **8.43ms**였지만 Node 실행·계측 변동이 있으므로 제품 FPS·물리 입력 수락이나 단일 개선율로 해석하지 않는다.
- 최종 source 회귀와 fresh import 검사 14파일은 **198 PASS / 1 optional CPU profile SKIP / 0 FAIL**, 전체 workspace `check:types` PASS다. 같은 callback 함수가 든 동등한 새 properties도 실제 callback receiver는 최신 객체를 유지하며, 변경된 callback·focus owner는 이전 snapshot action을 폐기하는 것을 검증했다. Semantics 단독 fresh import도 확인했다. 테스트 timeout은 모두 20분이다.
- 좌표 갱신 분류를 적용한 maximized/optimized Hermes bytecode source alias의 **11구간 PASS**, 고정 포인터·focus 보존 및 `closed views=0 consumers=0 gpuDrained=1 inputRetired=1`을 확인했다. All Components 필드 hover 159 native 프레임의 surface 간격은 중앙값 **17.16ms / p95 24.52ms**, native Device CPU p95 **2.66ms**였다. context 예산 179,281,920 bytes·allocator live 최대 201,608,560 bytes로 기존 한도를 지켰고 purge fallback은 없었다. 이 수치는 native 제출·surface 갱신 진단이며 AOT·물리 트랙패드·표시 FPS 수락이 아니다. 마지막 equivalent-properties receiver 대입 보완은 위 source 회귀와 새 제품 실행으로 검증한다. fixture 임시 폴더·runner entry는 모두 정리됐다.
- 일반 `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 변경 Core·Material을 공급·설치한 뒤 **Static Hermes AOT / optimized / x64 Release**로 재빌드했다. AOT native 함수 43,368개가 포함됐다. 소스·설치본 Nelyx 패키지 9개 내용과 SDK 지문 `c6a2c90cadab115a3296860a6548e8a82418bce1e647a0aa0ab829901c19830d`이 일치한다. native input `65a93f4652c6f653b9a8cfaf6c69192cc3bf9c7ab1a002d1050fb2807725926e`는 유지한다. 제품 1,782파일 inventory·portable source map·locator·build acknowledgement·동작 모드 및 AOT 소스의 새 코드 7개 marker 검증을 통과했다.
- 최신 제품 manifest SHA-256은 `cd7464b09ff7f86e17dddf5d1760ca70b1d8a3df2fdea5b127f4f004187c362d`, exe는 `0c58ec94bf150dd218ad6dc35ae1a484d8771bab836b7dc56c10a7e1ee338673`, AOT DLL은 `236ceabff706b571dfebe622516ed79bd8d0c88af85a2e46d90bc11716cd745e`, AOT 소스는 `59355015db7f9a59be17ed2dbd07cb4df16076697647bff40d550bc6752b7141`다. **§18 지문은 이전 수정본**이다.
- 실제 최신 제품 **PID 16580**에서 All Components 두 열을 최대화해 ElevatedButton 실행(`1 · Elevated pressed`), 버튼·텍스트필드 위 양방향 OS 휠을 확인했다. 첫 열의 실제 filled editor에 `-OK`를 입력하고 왕복 휠 후 다시 `!`를 입력해 값 `안녕하세요, Nelyx!-OK!`·표시 caret·입력 포커스 보존을 확인했다. 정상 종료 후 일반 runner **exitCode 0**을 확인했다. 이 관찰은 OS 휠·단순 편집·화면 내용의 범위이며 IME 조합이나 물리 트랙패드·표시 FPS 수락이 아니다.
- 같은 일반 명령의 재실행은 공급/설치·native/AOT 재빌드 없이 최신 제품 **PID 23516 / NelyxTestbed2**로 열렸고 최대화했다. 후속 물리 입력 진단을 위해 이 실행만 `NELYX_WINDOWS_INPUT_TRACE=1`, `NELYX_WINDOWS_INPUT_TRACE_FULL=1`을 적용했다. 수치는 bounded 메모리 ring에만 유지하고 별도 로그·profile·receipt를 저장하지 않는다. 새 사용자 체감 답변 전까지 hover의 물리 성능은 **확인 대기 / 미수락**, IME·표시 FPS는 **notVerified**, resize는 별도 **PARTIAL / resizePerformanceAccepted=false**다.
- 이번 native fixture `4iN7tP`, supply staging `inObCf`, AOT staging `Rqsb4E`와 runner entry는 모두 정리됐다. 이전부터 자동 승인 검토가 `blocked by policy`로 삭제를 차단한 `windows/x64/Release/.nelyx-sh-mfB4Na`는 §18 상태 그대로 유지하며 삭제를 재시도하지 않았다.

## 20. Hover 없는 밀집 구간 프레임 드랍 (2026-10-29)

- 사용자는 최신 §19 AOT가 **“비슷하거나 더 끊김”**, 버튼·텍스트필드 hover 없이 **스크롤바만 조작해도 밀집 구간이 나타날 때 프레임 드랍**이 있다고 답했다. §19의 source/native 검사 통과를 물리 성능 수락으로 취급하지 않으며 기존 확인 대기는 **미수락 / 미해결**로 갱신한다.
- PID 23516의 bounded ring 마지막 기록에 pointer move 525개가 있는 약 2.66초 구간이 남았다. 해당 구간 JS CPU 108프레임은 중앙값 **17.68ms / p95 37.71ms / 최대 70.83ms**였다. 입력 dispatch 자체 p95 **0.97ms**, native production→SDK 관찰 p95 **40.00ms**, native→Core dispatch p95 **41.55ms**, 제출→surface 갱신 p95 **9.05ms**다. 입력 지연은 긴 JS 프레임과 겹치며 drop/failure는 관찰하지 못했다. surface 간격 p95 **63.82ms**는 이 보존 구간의 진단이며 scanout/FPS 수락이 아니다.
- 사용자가 **전체화면의 2개 컬럼에서 특히 심하다**고 추가 보고해 maximized 두 열을 우선 재현 조건으로 정했다. 작은 창으로 복원된 PID 23516도 다시 최대화해 All Components 두 열을 확인했다. Node/CanvasKit의 hover 없는 compact 진단에서 밀집 구간 cold 최대 **127.36ms** 중 layout **99.67ms**·paragraph 요청 **36회**, 재방문 최대 **47.41ms** 중 layout **39.27ms**가 나타났다. 실제 native Picture 경로를 켠 wide 진단도 cold **118.21ms / layout 88.28ms**, 재방문 **29.73ms / layout 20.18ms**였다. 이 Node 수치를 실제 제품 FPS로 해석하지 않으며, 이미 유지 중인 구간과 진입/재방문을 나눠 maximized native CPU 단계를 조사한다.
- maximized/optimized Hermes bytecode의 동일 계측 조건에서, 기존 All Components 필드 no-hover 143프레임의 CPU 중앙값 **16.39ms / p95 23.21ms** 중 합성 중앙값 **4.05ms / p95 7.94ms**였다. native Picture leaf 자체는 대부분 프레임당 1개만 생성돼 64-entry 캐시를 늘릴 근거는 없었다. 유지된 EngineLayer의 state/child 목록을 매 프레임 펼치는 공통 경로를 추가 원인으로 좁혔다.
- 공통 Scene의 immutable retained recording은 기존 app-local Picture 소유자를 통해 전체 state와 자식 그림을 한 번 캡처해 재사용한다. 바뀌는 부모 위치·클립은 매 프레임 바깥에서 반영하고 CPU 소비자는 원래 목록을 유지한다. 기존 **64-entry / 32MiB** 예산을 늘리지 않으며, 원래 레이어가 사라져도 이미 캡처된 프레임·GPU 자원은 별도 hold로 유지하고 마지막 참조에서 해제한다. 실패한 native compile은 목적 Canvas를 rollback하고 원본 레이어로 재시도할 수 있다.
- RenderEditable은 현재 attached paragraph·producer를 매번 검증한 뒤, Core가 deep capture한 immutable layout과 같은 selection epoch·size·caret 설정·내부 스크롤에 한해 local geometry를 재사용한다. 외부 frozen layout·사용자 geometry override는 기존 계산 경로를 유지한다. 부모 transform·clip과 View/IME geometry commit은 계속 매 프레임 갱신하며 detach/dispose에서 캐시 참조를 해제한다.
- 수정 전후 maximized native 11구간은 모두 PASS 및 `views=0 consumers=0 gpuDrained=1 inputRetired=1`로 정상 종료했다. All Components no-hover CPU는 **p95 23.21→15.95ms**(수정 후 195프레임), 필드 hover는 **22.97→19.18ms**(197프레임), 버튼 no-hover는 **16.45→11.01ms**(244프레임)였다. All 필드 no-hover 합성 p95는 **7.94→5.27ms**였다. 단일 전후 계측 진단이며 AOT·물리 입력·표시 FPS 수락이 아니다. cold 최대는 **182.85→173.82ms**, 해당 layout 최대는 **125.53→122.58ms**로 여전히 길며, 첫 진입/재방문의 큰 프레임을 해결했다고 선언하지 않는다.
- Node/CanvasKit Picture 경로의 짧은 retained 구간에서 최종 명령 중앙값은 **286→38개**였다. 회귀 18파일 **265 PASS / 1 optional profile SKIP / 0 FAIL**, 전체 workspace `check:types` PASS다. 기존 batching 검사도 첫 retained 프레임의 1회 aggregate 생성 뒤 추가 compile이 없는지와 원본/이전 프레임의 자원 보존을 검증하도록 갱신했다. 실제 native Picture 경로의 clip·difference clip·rounded/path clip·affine/singular/perspective·image filter·backdrop filter 9종을 CanvasKit 픽셀과 비교했다. 전체 29개 Material 섹션의 두 열/한 열 연속 탐색도 native Picture를 켜서 기존 예산과 paragraph peak **92 producers / 114 paragraphs**를 확인했다. 테스트 timeout은 모두 20분이며 로그·profile 파일을 저장하지 않았다.
- PID 23516을 정상 종료(`exitCode 0`)한 뒤 일반 `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 변경 Core를 공급·설치하고 **Static Hermes AOT / optimized / x64 Release**를 재빌드했다. AOT native 함수 **43,375개**, AOT 빌드 **523.63초**이며 소스·설치본 Nelyx 패키지 9개 내용, portable source map, locator, build acknowledgement와 제품 1,782파일 inventory가 일치한다. SDK 지문은 **`1c5ca5ad4404ea3bbe7001470d6ad7ac682b52d555e521361a1cd392bd8163ad`**이며 native input `65a93f4652c6f653b9a8cfaf6c69192cc3bf9c7ab1a002d1050fb2807725926e`는 유지한다. 새 AOT 소스의 retained native recording·local geometry 경로 4개 marker도 확인했다. **§19 지문은 이전 제품**이다.
- 최신 제품 manifest SHA-256은 `8285ae9950d6f4a3e91abeb1146be3f38cdf36238ef33f2134f1df6f697560b4`, exe는 `c57b3bd7e0e3f2c5aa1567ae1d9d24e73a19a46d3009d52b9ffe6494cbd52c82`, AOT DLL은 `72c149ac5bda2b88debc4052ca6790d19846c2592779f45304c10273febd5330`, AOT 소스는 `356fdc712b0f702f01d15aee1407a4c1960c93139136583937d2d3115122b37c`다.
- 최신 제품 **PID 12976**을 최대화해 실제 All Components 두 열, ElevatedButton 실행(`1 · Elevated pressed`), 버튼 위 양방향 OS 휠을 확인했다. 첫 열의 스크롤바 thumb를 실제 드래그해 hover 없이 Text inputs 밀집 구간에 진입하고 역방향 이동도 확인했다. filled editor에 `-OK`를 입력하고 필드 위 왕복 휠 뒤 다시 `!`를 입력해 **`안녕하세요, Nelyx!-OK!`**, 표시 caret·문서·입력 포커스 보존을 확인했다. 정상 종료 후 일반 runner **exitCode 0**을 확인했다. 이 검사는 입력·화면 내용 범위이며 물리 트랙패드·IME 조합·표시 FPS 수락이 아니다.
- 같은 일반 명령은 공급/설치·native/AOT 재빌드 없이 **PID 26800 / NelyxTestbed2**로 다시 실행됐고 사용자 확인용으로 최대화한 두 컬럼 All Components를 열어두었다. 이 실행은 추가 input trace 환경변수를 켜지 않았다. 새 제품의 스크롤바 왕복·최초 진입/재방문 체감 답변을 기다리며, 답변 전 성능 수락은 **대기 / PARTIAL**이다. 첫 진입의 큰 CPU 프레임, 물리 트랙패드·IME·표시 FPS, 기존 resize `PARTIAL / resizePerformanceAccepted=false`는 별도 유지한다.
- 이번 native fixture·runner entry·supply staging `iMqJAM`·AOT staging `HwnqWO`는 모두 정리됐고 현재 package 폴더는 `Release`만 있다. 기존 `windows/x64/Release/.nelyx-sh-mfB4Na`는 앞서 자동 승인 검토가 삭제를 `blocked by policy`로 차단한 상태를 유지하며 재시도하지 않았다. 검증 로그·profile·receipt·이전 package 사본을 추가하지 않았다. 한/영 README와 work의 local link 22개·fence, `git diff --check`를 확인했다.

## 21. 커서가 버튼·텍스트필드를 통과할 때의 잔끊김 (2026-10-29)

- 사용자는 §20 최신 AOT에 대해 **“거의 없어지긴했는데 텍스트필드나 버튼 위를 커서가 지날때 버벅이는거같네”**라고 답했다. 스크롤바 왕복의 체감 개선은 해당 사용자 경로의 확인으로 기록하되 hover 문제의 해결이나 전체 표시 FPS 수락으로 확대하지 않는다. PID 26800의 §20 제품은 유지한 상태에서 공통 hover/합성 계산을 추가 조사한다.
- 실제 두 열 Gallery의 Node/CanvasKit Picture 경로에서 hover 중에는 `RecordedCompositionLayer.applyTransform`의 동일 scope 행렬 재구성과 곱셈이 반복됐다. sealed recording에서 실제 좌표 질의를 받은 scope만 immutable 행렬을 준비하고 소유된 입력 행렬의 정확한 순서별 결과를 scope당 한 개 재사용하도록 수정했다. 부모가 같은 값을 새로 캡처해도 16개 lane을 `Object.is`로 비교하며 signed zero를 구별한다. 공개 mutable/frozen caller 행렬은 매번 계산하며, seal 이전의 동적 변환·detach 관찰·공개 재부착도 유지한다. 전역 행렬 연산이나 연산 결합 순서는 바꾸지 않는다.
- 기본 MouseCursorManager는 정상 갱신에서 cursor 후보만 읽고 제거 시에만 event를 사용한다. MouseTracker의 cursor-only 갱신에서 source PointerEvent를 중복 생성하지 않으며 실제 enter/exit callback과 제거 이벤트는 전달한다. 사용자 정의 cursor update hook은 기존 source 이벤트 경로를 유지한다.
- Material TextField와 ButtonStyleButton의 전체 그림을 각자의 RepaintBoundary로 보존한다. border·caret·ink·physical shadow가 바뀔 때 같은 섹션의 다른 컨트롤 recording을 다시 펼치는 비용을 줄인다. clip이나 Picture 캐시 한도를 늘리지 않았고 사용자 정의 상태별 크기·style 변경은 정상 build/layout 경로를 유지한다. Node/CanvasKit native Picture 경로의 동일 pointer-sweep에서 최종 command 중앙값은 필드 **154→130**, 고정 포인터로 스크롤하는 버튼 구간은 **78→71**이었다. CPU 표본은 변동성이 있어 이 command 비교를 성능 수락으로 해석하지 않는다.
- 현재 출력의 13개 source 회귀는 **219 PASS / 1 optional profile SKIP / 0 FAIL**, 전체 workspace typecheck는 PASS다. 커서 activation·custom hook의 source event·mutable/frozen 행렬·signed zero·perspective·clip/filter 픽셀 일치·이전 frame 수명·실제 hover 색과 그림자·입력/포커스·상태별 editor font 변경 및 native Picture를 켠 29개 Material 섹션의 두 열/한 열 탐색을 포함한다. 모두 timeout 20분이다.
- TextField의 hover 픽셀 회귀도 native Picture 소유자를 켜서 다시 확인했다. 보존된 section에서 배경 pixel이 red→green으로 바뀌고 편집기 교체·문단 shaping·border tick의 editor repaint 없이 입력 소유권을 유지한다. 해당 8개 회귀 **8/8 PASS**이며 앞선 219개와 중복 집계하지 않는다.
- 같은 maximized/optimized Hermes bytecode source alias의 **11구간 PASS**와 정상 drain `views=0 consumers=0 gpuDrained=1 inputRetired=1`을 확인했다. §20 대비 All Components 필드 hover CPU p95는 **19.18→18.04ms**(최종 193프레임), 버튼 hover는 **13.46→12.21ms**(260프레임)였다. 필드 no-hover p95는 **15.95→15.79ms**(192프레임)다. 효과는 제한적이며 고정 포인터·프로그램 스크롤·계측 조건의 진단이다. AOT·물리 입력·표시 FPS 수락으로 쓰지 않는다. 최초 구간 최대 **206.81ms**가 남으므로 cold 생성 해결로 기록하지 않는다. fixture 임시 폴더/runner entry는 정리됐다.
- 이전 제품 PID 26800을 정상 종료하고 일반 runner **exitCode 0**을 확인했다. 같은 `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 Core·Material을 공급/설치한 뒤 **Static Hermes AOT / optimized / x64 Release**로 재빌드했다. AOT native 함수 **43,379개**이며 build 499.39초 중 앱 native compile은 456.25초였다. 소스·설치본 패키지 9개 내용, 1,782파일 inventory, 1,386개 portable source map module, locator·build acknowledgement와 AOT 소스의 변경 marker 4개를 검증했다.
- 최신 SDK SHA-256은 `bcbf776a852be122e70de1edeca8e931b40fc34185b86d7d591158f3fcffebde`, native input은 기존 `65a93f4652c6f653b9a8cfaf6c69192cc3bf9c7ab1a002d1050fb2807725926e`다. 제품 manifest는 `5eb4ced2bc2465dc45e9edbb395f68cd963432be5668bb5f0ea0486b9c2160bc`, EXE는 `715aa1d94e1a6acf9d13d8f9dc6627a3cf47b6d842792cd968096736f9c9b364`, AOT DLL은 `db3218f1d7b6a96a57985319cb63cb26e91506a5667aecd635dac980b6fe3493`, AOT 소스는 `718ae9aff71274dcec61441d4ff7a9c7fa4ce0eacc7748145f0a0447ac820caa`다. **§20 지문은 이전 제품**이다.
- 실제 최신 제품 **PID 21420**에서 All Components 두 컬럼을 최대화해 버튼 실행(`2 · Elevated pressed`), 버튼 위 양방향 OS 휠, 실제 스크롤바 drag로 필드 밀집 구간 진입을 확인했다. filled editor에 `-OK` 입력 후 필드 위 왕복 휠과 재포커스 없는 `!` 입력으로 값 **`안녕하세요, Nelyx!-OK!`**, 17/20 표시·caret·포커스 보존을 확인했다. 정상 종료 후 일반 runner **exitCode 0**을 확인했다. 이 범위는 OS 휠·단순 편집·화면 내용이며 물리 트랙패드나 IME 조합·표시 FPS 수락으로 확대하지 않는다.
- 같은 일반 명령은 공급/설치·native/AOT 재빌드 없이 최신 제품 **PID 29616 / NelyxTestbed2 / Responding=True**로 다시 열렸다. 추가 input trace 환경변수 없이 사용자 체감 확인용으로 두 컬럼 All Components를 최대화했다. 새 hover 성능 답변은 **확인 대기 / PARTIAL**이며 cold 생성의 긴 프레임과 IME·표시 FPS는 notVerified, resize는 별도 **PARTIAL / resizePerformanceAccepted=false**다.
- native fixture 임시 폴더/runner entry·supply staging `ZvOsWZ`·새 AOT staging `ojr55z`는 정리됐으며 현재 제품 package는 `Release`만 있다. 이전부터 자동 승인 검토가 삭제를 `blocked by policy`로 차단한 `windows/x64/Release/.nelyx-sh-mfB4Na`는 유지하며 삭제를 재시도하지 않았다. 별도 로그·profile·receipt·이전 package 사본을 추가하지 않았다. 한/영 README와 work의 local link 22개·fence 및 `git diff --check`를 확인했다.

## 22. 시맨틱/OS 요소와 실제 트랙패드 입력 경로 조사 (2026-10-29)

- 사용자는 §21 AOT에 대해 **“여전히 동일한 증상”**이라고 답하며 트랙패드 scroll signal을 시맨틱 node 또는 OS 컴포넌트가 가로채는지 의심했다. §21의 사용자 hover 성능은 **미수락 / PARTIAL**이다. 사용자 피드백을 이전의 source/프로그램 스크롤 진단으로 덮지 않는다.
- 현재 WindowsSemantics renderer는 `pointerEvents: 'none'`인 Composition View를 사용하고, Core Windows editor는 별도 가시적 OS TextBox를 겹치지 않는다. `TextInputSkiaSurface`의 좌표 lease는 기존 canvas의 단일 DirectManipulation 소유자를 재사용한다. 이는 소스 구조의 확인이며, 실제 물리 입력이 누락되지 않는다는 증거로 대신하지 않는다. 같은 최신 AOT에서 bounded 메모리 input trace로 native 수신→SDK→Core→frame 제출의 시각을 비교한다.
- 같은 §21 AOT를 추가 빌드 없이 `NELYX_WINDOWS_INPUT_TRACE=1`, `NELYX_WINDOWS_INPUT_TRACE_FULL=1`로 일반 실행했다. PID 22076을 최대화했고 사용자가 **“트랙패드로 증상 재현함”**을 확인했다. 보존된 메모리 ring은 약 **5.55초**, moving 입력 범위는 **4.05초**다. 해당 시각 범위의 native-input·SDK 수신·Core dispatch는 각각 **281개**, drop/failure 기록은 **0개**, precision owner는 **1개**였다. native→SDK p95 **24.02ms**, Core dispatch까지 **24.95ms**, JS frame CPU p95 **18.04ms / max 30.62ms**, UI queue p95 **0.149ms**였다. 긴 JS 처리 주변에는 hover packet이 몰려 있었다. 보존된 구간에서 입력 전달의 중간 누락은 관찰되지 않았으며, 이 기록만으로 native 진입 전 OS 손실까지 부정하지 않는다. 중간 pause나 end/cancel을 손가락을 뗐다는 증거로 해석하지 않는다. 별도 log/profile 파일은 저장하지 않았다.
- hover가 들어올 때 Root가 MouseTracker에 전달하려고 시맨틱·텍스트 대상까지 모든 hit transform을 펼치고, sliver→legacy→Root 변환에서 같은 경로를 다시 캡처했다. MouseTracker는 source hit entry를 그대로 받아 annotation을 고른 뒤 transform을 읽는다. 공통 HitTestResult의 private WeakMap은 이미 캡처된 sliver 변환의 snapshot만 Root까지 보존한다. 일반 외부/frozen entry, custom entry 및 callback/factory가 바뀐 경로는 기존 eager 처리를 유지한다. 이벤트·hit target·시맨틱·스크롤 resolver를 제거하거나 wheel을 합치지 않는다. 공개 matrix 연산 순서와 전체 16 lane, parent 변경 전 snapshot, entry 종류·callback 순서는 유지한다.
- 직접 회귀에서 두 hover 입력이 handler 없는 시맨틱 ancestor의 변환을 **32회** 읽던 실패를 재현했고 수정 후 **0회**로 통과했다. 실제 두 컬럼 Gallery에서 source 24프레임·96 hover packet의 같은 부하를 비교하면 hit transform 조회는 **4,732→1,516회**, pointer handler 없는 대상의 조회는 **2,224→192회**였다. 전체 CPU 시간은 160.56→151.33ms였으며 Node/CanvasKit 진단이지 제품 FPS나 체감 수락이 아니다.
- 최신 source 18파일 회귀는 **257 PASS / 1 optional profile SKIP / 0 FAIL**, 전체 workspace typecheck는 PASS다. hover enter/exit·실제 handler의 local 좌표, captured/외부 entry·변경된 factory의 보수 경로, signed zero·perspective·순서별 matrix, sliver 수명·보존·닫기, 실제 Gallery 입력/편집/그림자와 29개 섹션의 두 열/한 열 탐색을 포함한다. 모두 timeout 20분이다. queued hover를 포함한 maximized native 12구간과 새 AOT 반영은 진행 중이다.
- 사용자는 외출을 위해 작업 마무리를 요청했다. 추가 물리 입력이나 체감 답변은 요청하지 않으며, 최종 제품·검증·미수락 범위를 이 절에 남긴다. 진단 앱 PID 22076은 정상 종료했고 일반 runner exitCode 0을 확인했다.
- **사용자의 후속 “바로 종료해줘” 요청으로 즉시 중단했다.** 실행 중 native 12구간 검증을 취소했다. §22 source/dist 수정과 257 PASS·typecheck는 남아 있지만 새 AOT 공급/빌드·제품 실행 검증·사용자 체감 수락은 **미완료**다. 마지막 전달 제품은 §21의 SDK `bcbf776a852be122e70de1edeca8e931b40fc34185b86d7d591158f3fcffebde`이며, 수정된 workspace Core와 설치된 제품은 현재 서로 다르다. 재개 시 native 12구간 검증부터 확인한 뒤 일반 명령으로 공급/빌드해야 한다.
- 중단 후 검증용 node/컴파일러/InputSurface 프로세스가 남지 않은 것을 확인했다. `%TEMP%/nelyx-windows-animation-zkq0ti` 정리는 자동 승인 검토가 **`blocked by policy`**로 거부했다. 해당 임시 폴더는 남겨두었고 다른 도구나 경로로 삭제를 재시도하지 않았다.
