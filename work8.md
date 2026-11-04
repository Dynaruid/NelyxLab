# Nelyx 엔진 v2 — 공통 C++ 백엔드 설계·구축 계획

설계: **2026-11-04 KST** · 구현 갱신: **2026-11-05 KST** · 상태: **PARTIAL / intrinsic·dry query·Widget·편집·접근성 연결 / 전체 backend·물리 입력·성능 미완료**

설계·구축 계획을 아래 **3부**로 나누었다. 기존 절 번호(§1–19)와 구현 단계(W8-00–10)를 유지한다.

| 문서 | 원문 범위 | 주요 내용 |
| --- | --- | --- |
| [1부 — 구조·상태·입력 계약](work8-1.md) | §1–7 | 목표·현재 구조·전체 흐름·실행 owner·transaction/ABI·scheduler·입력/scroll |
| [2부 — 렌더링·플랫폼·API 이식](work8-2.md) | §8–14 | Render node·layout/text·retained scene·hit-test/편집/접근성·가상화·플랫폼·API 이식·대안 검토 |
| [3부 — 구현 순서·검증·완료 기준](work8-3.md) | §15–19 | 소스 구조·W8 구현 단계·필수 기능/배포 검사·공급·완료/제품 전환·현재 상태 |

처음 읽을 때는 1부 → 2부 → 3부 순서로 읽는다. 각 문서의 상단과 하단에서 앞뒤 문서로 이동할 수 있다.

구현 순서는 **W8-00 → W8-01 → W8-02 → W8-03**이며, 세부 완료 조건은 [3부 §16](work8-3.md#16-구현-순서와-단계별-완료-조건)에 둔다. 이번 1부 실행의 구현·검증·잔여 작업은 [1부 현황](work8-1.md#이번-실행의-구현검증-상태), 전체 요약은 [3부 §19](work8-3.md#19-작성-시점의-상태)에 반영한다. W8-00/01 전체 gate는 아직 PARTIAL이다.

공통 C++ 백엔드 구축과 TypeScript UI Runtime·SDK 연결이 주목표다. Web은 threaded/non-shared single-worker 두 engine 공급과 수정하지 않은 npm 공식 CanvasKit을 사용하도록 설계한다. 백엔드 완료와 제품의 물리 입력·체감·성능 수락은 구분한다.

공통 C++ 코어·C ABI·TS/SDK 진입점과 Windows 자체 host·공식 CanvasKit을 사용하는 두 Web profile을 연결했다. 실제 primitive 장면에서 C++ layout·paragraph 측정·fallback font 전달과 작업 집계·화면·독립 owner/협력 실행·입력·지연·resize/복구·close를 확인했다. 공개 Core/SDK export와 현재 engine/dist를 빌드하고 실행하는 명령·증거·범위는 [1부 연결 실행 현황](work8-1.md#연결-실행-현황)에 있다. 전체 Widget/layout/편집·Android와 전체 W8 gate는 PARTIAL이다. 기존 `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/성능 `notVerified`와 [work7의 물리 재확인 대기](history/26/11/04/work7-summary.md)는 유지한다.

2부의 현재 구현은 C++ intrinsic/dry query·Widget/State/Key diff·native editing document·Windows TSF/UIA·Web DOM/ARIA까지 연결했다. 현재 Testbed와 검증·남은 필수 범위는 [2부 현황](work8-2.md#이번-작업의-구현검증-현황)을 따른다. Material/Cupertino·lazy builder/anchor·Android와 전체 W8 gate는 계속 PARTIAL이다.
