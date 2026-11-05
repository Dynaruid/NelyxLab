# Nelyx 엔진 v2 — 공통 C++ 백엔드 설계·구축 계획

설계: **2026-11-04 KST** · 구현 갱신: **2026-11-05 KST** · 상태: **재개 / PARTIAL — 그래픽·일반 runner·통합 예산 구간 검증, 전체 기존 API 호환 미완료**

**재개:** 사용자의 `이어서 해줘` 요청으로 작업을 재개했다. 현재 진행 상태는 [2부 재개 현황](work8-2.md#현재-재개-현황)을 우선하며 아래 중단 기록은 과거 상태다.

이번 재개에서 affine/path/effect·정적 native extension·App geometry 경계, 일반 Windows/두 Web runner와 실제 archive 소비자, 단일 예산 ledger·Native Hermes heap 합산을 연결했다. 기능 검사 **242개**의 구간과 현재 공급은 [2부 검증](work8-2.md#이번-재개의-검증)에 기록했다. 기존 public API 전체의 생성자·동작 호환이 사용자 기준이며, [전체 API gate](work8-2.md#전체-기존-api-호환의-남은-작업)는 **실패/PARTIAL**이다. 물리 입력/display·성능 수락을 승격하지 않는다.

`work8-2a.md` 작업으로 API gate 입력·원래 공개 표면 고정·overload/member별 동작 증거·실제 경로 보고·복합 종료 오류를 보완했다. Native 출력 경합을 재현·수정했고 archive 소비자 범위를 두 디자인/설치 compiler/세 host로 확장했다. 이 후속 작업의 최신 검증·공급·잔여 P1–P5는 [2a 현재 현황](work8-2a.md#현재-구현-현황)을 우선한다. 아래 242개와 이전 공급 수치는 이전 실행 구간의 기록이며 전체 API gate는 계속 실패다.

**이전 중단 기록:** 2026-11-05 17:33 KST 사용자의 `잠시 중간 마무리하자` 요청으로 구현·빌드·실행을 중단했다. 그래픽·통합 ledger의 중간 코어 검사 **193/193** 이후 provider·접근성·SDK 일반 runner 소스를 추가했으며 이 최신 변경은 통합 검증하지 않았다. **기존 engine/dist는 이전 공급으로 현재 소스와 불일치한다.** 정확한 구현 경계·실패·재개 순서는 [2부 현재 중단 상태](work8-2.md#현재-중단-상태)를 우선한다. 아래의 기존 205개 검사와 공급 hash는 이전 완료 구간의 기록이다. 사용자 재개 요청 전 자동으로 작업하지 않는다.

설계·구축 계획을 아래 **3부**로 나누었다. 기존 절 번호(§1–19)와 구현 단계(W8-00–10)를 유지한다.

| 문서 | 원문 범위 | 주요 내용 |
| --- | --- | --- |
| [1부 — 구조·상태·입력 계약](work8-1.md) | §1–7 | 목표·현재 구조·전체 흐름·실행 owner·transaction/ABI·scheduler·입력/scroll |
| [2부 — 렌더링·플랫폼·API 이식](work8-2.md) | §8–14 | Render node·layout/text·retained scene·hit-test/편집/접근성·가상화·플랫폼·API 이식·대안 검토 |
| [2a — API 호환·검증·종료 후속](work8-2a.md) | 2부 보완 | 원래 공개 표면·동작 gate·실제 경로·복합 종료·archive/npm·잔여 작업 |
| [3부 — 구현 순서·검증·완료 기준](work8-3.md) | §15–19 | 소스 구조·W8 구현 단계·필수 기능/배포 검사·공급·완료/제품 전환·현재 상태 |

처음 읽을 때는 1부 → 2부 → 3부 순서로 읽는다. 각 문서의 상단과 하단에서 앞뒤 문서로 이동할 수 있다.

구현 순서는 **W8-00 → W8-01 → W8-02 → W8-03**이며, 세부 완료 조건은 [3부 §16](work8-3.md#16-구현-순서와-단계별-완료-조건)에 둔다. 이번 1부 실행의 구현·검증·잔여 작업은 [1부 현황](work8-1.md#이번-실행의-구현검증-상태), 전체 요약은 [3부 §19](work8-3.md#19-작성-시점의-상태)에 반영한다. W8-00/01 전체 gate는 아직 PARTIAL이다.

공통 C++ 백엔드 구축과 TypeScript UI Runtime·SDK 연결이 주목표다. Web은 threaded/non-shared single-worker 두 engine 공급과 수정하지 않은 npm 공식 CanvasKit을 사용하도록 설계한다. 백엔드 완료와 제품의 물리 입력·체감·성능 수락은 구분한다.

공통 C++ 코어·C ABI·TS/SDK 진입점과 Windows 자체 host·공식 CanvasKit을 사용하는 두 Web profile을 연결했다. 실제 primitive 장면에서 C++ layout·paragraph 측정·fallback font 전달과 작업 집계·화면·독립 owner/협력 실행·입력·지연·resize/복구·close를 확인했다. 공개 Core/SDK export와 현재 engine/dist를 빌드하고 실행하는 명령·증거·범위는 [1부 연결 실행 현황](work8-1.md#연결-실행-현황)에 있다. 전체 Widget/layout/편집·Android와 전체 W8 gate는 PARTIAL이다. 기존 `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/성능 `notVerified`와 [work7의 물리 재확인 대기](history/26/11/04/work7-summary.md)는 유지한다.

2부의 현재 구현은 C++ intrinsic/dry query·Widget/State/Key diff·native editing document·Windows TSF/UIA·Web DOM/ARIA까지 연결했다. 현재 Testbed와 검증·남은 필수 범위는 [2부 현황](work8-2.md#이번-작업의-구현검증-현황)을 따른다. 명시적 Material/Cupertino v2 control·lazy builder/anchor·표준 pointer·IME 종료 교섭을 추가했다. 전체 API·Android와 W8 gate는 계속 PARTIAL이다.

2026-11-05 재검토에서 layout 조합·leaf padding과 paint/입력 좌표·compositor caret clock·Widget build/dispose 예외 복구를 구현했다. 남은 1·2부 계약은 [잔여 작업 표](work8-2.md#2026-11-05-잔여-작업-재검토)에서 확인한다.

사용자의 두 문서 잔여 검토·전체 작업 요청으로 2026-11-05 재개했다. 수평 lazy list/먼 index seek·raw observer/App 제어 입력·게시 snapshot 보유·focus/caret ancestor reveal·Windows clipboard 실패 처리를 보완했다. 현재 공급 검증과 전체 미완료 범위는 [2부 재개 현황](work8-2.md#2026-11-05-재개--입력-publication과-list-계약)에 기록한다. 전체 backend/API·Android·물리 입력/성능 수락은 계속 PARTIAL이다.
