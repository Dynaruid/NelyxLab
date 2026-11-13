# 엔진 v2 1부 — 구조·상태·입력 계약 요약

원문: 루트 `work8-1.md` · 설계·최초 연결: **2026-11-04 KST** · 구현 갱신·종료: **2026-11-05 KST** · 보관: **2026-11-05 KST**

문서: **CLOSED / SUPERSEDED** · 구현: **PARTIAL**. 원문의 §1–7과 연결 실행 현황을 요약한다. 최종 구현·공급/검사 수치는 [2a 기록](../05/work8-2a-summary.md#현재-구현-현황)이 우선하며 이번 보관은 새 실행 증거가 아니다.

## 목표·owner와 실행 profile

공통 C++ 백엔드·C ABI·TS/SDK 연결이 주목표다. C++가 장기 document/layout·editing·scroll/motion·scene 상태를 소유하고 TS는 Widget/Element/State·Key·의존성과 앱 callback을 소유한다. 임의 동기 RenderObject 확장과 기존 동기 API 전체 호환은 자동으로 성립하지 않는다.

| owner/profile | 책임과 진행 계약 |
| --- | --- |
| Platform UI | OS 창·입력 수집·IME/접근성·metrics/visibility·host publication. App 응답을 기다리며 UI를 막지 않음 |
| App Runtime | TS Widget 선언·사용자 callback·transaction 생산과 결과 처리. 표준 gesture/frame마다 App ACK를 요구하지 않음 |
| Content | 승인 document의 layout/paragraph·resource 준비·retained record. 진행 중 준비와 최신 다음 수요를 구분 |
| Compositor/Render | 준비 scene의 input/scroll/motion·frame 합성·제출·게시 후보와 credit/회수. 오래된 scene/metrics 완료가 새 surface를 덮지 않음 |
| Native / Web threaded | 실제 host/provider READY 후 App/Content와 구분된 실행 owner. 준비된 scene은 App/Content 지연 중에도 진행하는 계약 |
| Web single-worker / headless | Content/Render의 논리 책임을 나누되 협력 실행. 실제 single-worker는 App worker와 분리되며 Content 동기 점유 후 회복 필수 |

## Transaction·ABI·준비 세대

Canonical [protocol schema](../../../../Nelyx/engine/schema/protocol.json)와 [C ABI](../../../../Nelyx/engine/include/nelyx/engine.h)는 major/schema·필수 capability를 검사한다. Opaque handle과 module 소유 해제, 복사한 packet, little-endian·정수 폭/BigInt·명시적 constraints/extent tag를 사용한다. 다른 Wasm module의 포인터/handle을 전달하지 않는다.

Create/properties/reparent/destroy/resource는 staging에서 최종 그래프·소속·세대·깊이를 검증하고 원자 설치한다. NACK은 기존 document/scene과 TS의 ACK 기준 diff/handle·State/dispose 정합성을 보존한다. `DocumentAccepted`는 layout/scene/표시 완료가 아니며 승인 뒤 준비 실패도 별도 terminal이다.

동일 ID·동일 bytes의 재시도, ID 재사용 거부, bounded 결과 창·ACK 하한·조회/재동기화를 둔다. 같은 document라도 metrics/font/device 변경은 `PreparationId`로 구별하고 late 결과·skipped epoch 명령·timeout/close를 정확히 끝내고 회수한다.

Constraints는 `finite/unbounded/expand`, 논리 scroll extent는 `finite/estimated/unbounded`를 구별한다. 임의 NaN/Infinity를 wire 좌표로 쓰지 않고 최종 layout/paint/hit-test 박스는 finite여야 한다. Unbounded extent를 허용하는 의미와 실제 pixels/coverage의 유한성을 혼동하지 않는다.

## Scheduler·입력·scroll 정합성

진행 중인 호환 준비는 새 document마다 취소하지 않고 최신 다음 수요를 합쳐 중간 scene의 활성화 기회를 보장한다. Tick의 입력 cut·유한 quota·frame credit·latest publication 대기·lost-wake 처리를 분리한다. 숨김/zero-size에서는 반복 frame clock을 멈추되 ACK/취소/해제·close는 진행하고 restore 시 App commit 없이 최신 metrics로 준비/재게시한다.

입력은 수집 publication·session/view/node·pointer/stream·sequence를 식별하고 admission snapshot을 hold한다. 표준 recognizer와 compositor의 property를 hit-test/semantics가 같은 snapshot으로 읽는다. Raw observer와 명시적 App 제어 입력은 bounded한 별도 경로이며 일반 gesture의 프레임 생산 경로와 구분한다.

OS가 해결한 wheel/momentum과 engine friction을 중복 실행하지 않는다. Nested scroll의 finite extent handoff·변환된 delta·gesture/ScrollTo/AnimateTo/anchor의 충돌·취소 terminal을 정의한다. 새 scene의 기본값이 준비 중 추가 scroll/motion을 되감지 않아야 한다.

미준비 콘텐츠에서는 requested/visual offset을 구별하고 coverage·NeedChildren와 제한된 추종을 사용한다. 반전/end/cancel/hide에서 오래된 수요를 폐기하며 미준비 목적지를 성공 이동으로 표시하지 않는다.

## 원문 1부의 고정값과 수락 경계

아래는 1부에 고정했던 정책의 기록이다. 그래픽·2a 후속 schema/통합 ledger의 최신 값은 canonical 소스와 [2a 공급](../05/work8-2a-summary.md#이번-검증)에서 확인하며, 과거 wire row 크기나 내부 reservation을 현재 전체 메모리 한도로 승계하지 않는다.

| 항목 | 당시 고정값/정책 |
| --- | --- |
| Tree/transaction | view 8·node/view 4096·depth 128·명령 4096·packet 1 MiB, slot+generation과 overflow 거부 |
| Input | session 합산 **256 = update 224 + boundary 예약 32**, 살아 있는 view별 admission quota·tick/view 32. received = consumed + canceled + rejected + queued, duplicate는 별도 |
| Content | step당 최대 64 slot, 진행 중/ready 후보 1·최신 다음 수요 1·active scene 1 |
| Frame/publication | view당 engine hold 2·session 최대 16, 게시 대기 최신 1. Provider hold를 임의 해제하지 않고 drain 전 close는 busy |
| Result/event/command | 결과/view 32·payload 1 MiB, event 256/poll 32, 대기 scroll command 64/최대 2초 |
| 초기 내부 예산 | Core reservation 64 MiB·resource 32 MiB/1024 slot. RSS·GPU/CanvasKit 전체 비용이 아니며 뒤의 통합 ledger와 구분 |

실제 Windows 자체 HWND host와 Web threaded/non-shared profile의 최소 scene·font/image·입력·50/100/200 ms App/Content 지연·resize/zero/minimize/restore·idle·close를 연결했다. [host 검사](../../../../Nelyx/engine/tests/hosts.test.mjs), [owner 검사](../../../../Nelyx/engine/tests/actors.test.mjs), [glyph 검사](../../../../Nelyx/engine/tests/glyphs.test.mjs)는 기능 범위의 증거다. Headless Chromium은 SwiftShader이며 visible hardware 창 확인도 hardware FPS나 물리 입력 수락이 아니다.

전체 API/gesture/physics·motion graph·Android port·물리 IME/reader·scanout·성능은 미완료였다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/표시 `notVerified`와 선행 work7의 물리 재확인 대기를 유지한다.

[보관 목차](work8-summary.md) · [2부](work8-2-summary.md) · [후속 work9](../05/work9-summary.md)
