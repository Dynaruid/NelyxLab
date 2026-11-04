# Nelyx 엔진 v2 — 공통 C++ 백엔드 설계·구축 계획

작성·심화 검토·구현: **2026-11-04 KST** · 상태: **PAUSED / PARTIAL / host·CanvasKit·owner thread 소스 연결 중 / 실제 화면 미검증**

설계·구축 계획을 아래 **3부**로 나누었다. 기존 절 번호(§1–19)와 구현 단계(W8-00–10)를 유지한다.

| 문서 | 원문 범위 | 주요 내용 |
| --- | --- | --- |
| [1부 — 구조·상태·입력 계약](work8-1.md) | §1–7 | 목표·현재 구조·전체 흐름·실행 owner·transaction/ABI·scheduler·입력/scroll |
| [2부 — 렌더링·플랫폼·API 이식](work8-2.md) | §8–14 | Render node·layout/text·retained scene·hit-test/편집/접근성·가상화·플랫폼·API 이식·대안 검토 |
| [3부 — 구현 순서·검증·완료 기준](work8-3.md) | §15–19 | 소스 구조·W8 구현 단계·필수 기능/배포 검사·공급·완료/제품 전환·현재 상태 |

처음 읽을 때는 1부 → 2부 → 3부 순서로 읽는다. 각 문서의 상단과 하단에서 앞뒤 문서로 이동할 수 있다.

구현 순서는 **W8-00 → W8-01 → W8-02 → W8-03**이며, 세부 완료 조건은 [3부 §16](work8-3.md#16-구현-순서와-단계별-완료-조건)에 둔다. 이번 1부 실행의 구현·검증·잔여 작업은 [1부 현황](work8-1.md#이번-실행의-구현검증-상태), 전체 요약은 [3부 §19](work8-3.md#19-작성-시점의-상태)에 반영한다. W8-00/01 전체 gate는 아직 PARTIAL이다.

공통 C++ 백엔드 구축과 TypeScript UI Runtime·SDK 연결이 주목표다. Web은 threaded/non-shared single-worker 두 engine 공급과 수정하지 않은 npm 공식 CanvasKit을 사용하도록 설계한다. 백엔드 완료와 제품의 물리 입력·체감·성능 수락은 구분한다.

문서 분할 뒤 1부 작업에서 C++ 코어·C ABI·TS/SDK 명시 진입점과 Native/두 Wasm headless 계약 검사를 추가했다. 후속 요청으로 Windows host·공식 CanvasKit·owner thread·SDK 브라우저 surface와 고정 장면의 소스를 작성하던 중 사용자의 외출 요청으로 **중단했다**. Host compile/link·browser bundle/asset 공급·실제 화면·독립 실행은 미검증이다. 재개 요청 전에는 실행을 이어가지 않는다. 정확한 변경 범위·검증 경계·재개 순서는 [1부 중간 마무리](work8-1.md#중간-마무리--사용자-외출로-명시-중단)에 남겼다. 이전 schema의 엔진 dist는 삭제가 자동 승인 검토에서 차단되어 남아 있으므로 재사용하지 않는다. 현재 공급 builder는 여전히 headless 전용이다. Headless 실행의 `contentIndependent=false`를 실제 owner 실행 결과로 바꾸지 않는다. 기존 제품의 `PARTIAL`, `performanceAccepted=false`, `resizePerformanceAccepted=false`와 v2 실제 surface·성능·물리 입력의 `notVerified`, 선행 [work7의 물리 재확인 대기](history/26/11/04/work7-summary.md)를 유지한다.
