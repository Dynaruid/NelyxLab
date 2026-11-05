# 작업 이력

작업 문서의 변경·결론·검증 범위·미완료 상태를 날짜별 요약으로 보관한다. 폴더는 `YY/MM/DD`이며 **원문에 적힌 작성일**을 우선한다. 분석에서 계획을 재작성하고 구현한 문서는 그 기준일을 사용하고, 여러 날의 실행·갱신일은 각 요약에 별도로 남긴다. 보관일이나 파일 수정 시각으로 작업 날짜를 바꾸지 않는다.

이력의 PASS·PARTIAL·NO_ADOPTION·notVerified·공급 식별은 **당시 범위**이며 현재 제품의 재검증 결과가 아니다. 같은 `workN.md` 이름을 재사용한 문서도 날짜와 주제로 구분한다.

## 2026-11-05 현재 후속 계획

현재 진행 문서는 [work9 — 엔진 v2 잔여 구현·네이티브 데스크톱 호스트 전환](../work9.md)이다. Work8 계열 5개는 아래 날짜별 요약에 **CLOSED / SUPERSEDED** 상태로 보존하고 루트 원문을 삭제했다. 현재 계획과 RN 소스 선별 재사용 방침은 work9에서 관리한다.

문서 종료와 구현 완료는 구분한다. 전체 API gate **FAIL / PARTIAL**, 물리 입력/display **notVerified**, 성능 acceptance 두 값 **false**를 work9로 이월했다. 아래 10월의 work8/work9 이력은 이름이 같아도 다른 작업이다.

## 2026-11-05 보관한 work8 문서

원문에 적힌 설계·작성일을 기준으로 요약 5개를 배치했다. 1·2·3부와 목차의 11월 5일 구현/종료를 최초 설계일과 구별하고, 2a는 작성일인 11월 5일에 둔다. [보관 목차](26/11/04/work8-summary.md)는 문서별 범위와 work9 이월을 연결한다.

| 원문 | 배치 기준일·근거 | 요약 | 종료·미완료 상태 |
| --- | --- | --- | --- |
| `work8.md` | 2026-11-04 설계, 11-05 갱신·종료 | [전체 구조·종료·이월](26/11/04/work8-summary.md) | CLOSED/SUPERSEDED, 전체 API FAIL·구현 PARTIAL |
| `work8-1.md` | 2026-11-04 설계·최초 연결, 11-05 갱신 | [구조·상태·입력 계약](26/11/04/work8-1-summary.md) | 공통 core·실제 host 구간 구현, 전체 gate PARTIAL |
| `work8-2.md` | 2026-11-04 설계, 11-05 구현·종료 | [layout·렌더링·플랫폼·API](26/11/04/work8-2-summary.md) | Windows/Web 구간 구현, 전체 API/플랫폼 PARTIAL |
| `work8-2a.md` | 2026-11-05 작성·구현·소스 비교 | [최종 API·검증·npm·Flutter 비교](26/11/05/work8-2a-summary.md) | API gate FAIL, npm 원인 미확정, P1–P5 이월 |
| `work8-3.md` | 2026-11-04 설계, 11-05 갱신·종료 | [W8 단계·Web/제품 평가·완료 기준](26/11/04/work8-3-summary.md) | W8-00–10 전체 PARTIAL, 제품 전환 미수락 |

최종 구현 수치는 2a 기록을 우선하며 과거 구간 수치를 합산하지 않는다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/display `notVerified`를 보존했다. 이번 보관은 문서·링크·삭제 범위 검사이고 제품 빌드·runtime·API audit·성능 재검증은 수행하지 않았다.

## 2026-11-04 보관한 문서

요청된 루트 원문 7개를 각각 요약했다. 기존 10월 30일 `work-summary.md`는 선행 기록이므로 이번 `work.md` 요약과 별도로 유지한다.

| 원문 | 배치 기준일·근거 | 요약 | 종료·미완료 상태 |
| --- | --- | --- | --- |
| `work.md` | 2026-10-30 작성, 11-02까지 갱신 | [Flutter 비교·스크롤 엔진](26/10/30/scroll-engine-summary.md) | CLOSED/SUPERSEDED, 후보 철회·PARTIAL 유지 |
| `work2.md` | 2026-11-02 작성·종료 | [공통 엔진 비용 검토](26/11/02/work2-summary.md) | CLOSED, 60fps 미달·최대화 실패를 work3으로 이관 |
| `work3.md` | 2026-11-02 시작, 11-03까지 실행 | [C++ 배치·입력·시각 회귀](26/11/02/work3-summary.md) | 구현·평가 종료, 입력/시각 PASS-scoped·제품 PARTIAL |
| `work4.md` | 2026-11-03 작성·실행 | [반복 통지·입력 비용·shadow](26/11/03/work4-summary.md) | 통지 감소·회귀 수정 채택, 우열 소폭 개선·60fps 미달 |
| `work5.md` | 2026-11-03 작성·실행 | [retained geometry·재감사·수동 모드](26/11/03/work5-summary.md) | 실행 오판 철회·독립 재실험·preview 구현, NO_ADOPTION |
| `work6.md` | 2026-11-03 작성·실행 | [전체 구간 검증·N1~N4](26/11/03/work6-summary.md) | 후보 구현·all 통합·검증 완료, 기본 TS·NO_ADOPTION |
| `work7.md` | 11-03 분석, **11-04 계획 재작성·구현** | [scroll 입력·frame 재개・starvation](26/11/04/work7-summary.md) | 수정 자동 회귀 scoped-pass, **물리 재확인 대기/PARTIAL** |

7개 문서 모두 기존 `performanceAccepted=false`·`resizePerformanceAccepted=false`를 보존한다. 이번 보관은 요약·링크·삭제 범위의 문서 검사이며 빌드·runtime·물리 입력·표시 성능 수락을 추가하지 않는다. 당시 후속 루트 `work8.md`는 이후 위의 11월 5일 보관 요약으로 이관했고 현재 계획은 `work9.md`다.

## 이전 이력

| 기준일 | 요약 |
| --- | --- |
| 2026-10-07 | [Nelyx SDK 설계 초안 v2](26/10/07/nelyx-draft-v2-summary.md) |
| 2026-10-09 | [W3 React Native 데스크톱 전환](26/10/09/work3-summary.md) |
| 2026-10-10 | [W4 제품 구조·검증 구성 정리](26/10/10/work4-summary.md) · [W5 TS 반자동 이식](26/10/10/work5-summary.md) |
| 2026-10-11 | [W6 Flutter 참조 기능·플랫폼 기반](26/10/11/work6-summary.md) |
| 2026-10-12 | [W7 세션 목표·일반 sliver](26/10/12/work7-summary.md) |
| 2026-10-13 | [W8 자동생성·패키지 분리](26/10/13/work8-summary.md) |
| 2026-10-14 | [W9 독립 구현·편집·서비스·스크롤](26/10/14/work9-summary.md) |
| 2026-10-16 | [W10 TS 기능 동등성·생성 코드](26/10/16/work10-summary.md) |
| 2026-10-18 | [W11 M3 디자인·control](26/10/18/work11-summary.md) · [W12 Doroti 구조·TS7](26/10/18/work12-summary.md) |
| 2026-10-19 | [W13 Core/Skia UI·편집·성능](26/10/19/work13-summary.md) |
| 2026-10-22 | [W14 테스트베드·공통 엔진](26/10/22/work14-summary.md) · [W15 Typed Static Hermes](26/10/22/work15-summary.md) |
| 2026-10-23 | [Windows AOT 스크롤 조사](26/10/23/research-summary.md) · [W15A 전체 앱 AOT·JSC](26/10/23/work15a-summary.md) |
| 2026-10-24 | [W16 Hermes 공통 스크롤 엔진](26/10/24/work16-summary.md) |
| 2026-10-25 | [W17 직접 Hermes host·native 서비스](26/10/25/work17-summary.md) · [W18 Runtime·Engine·Host](26/10/25/work18-summary.md) |
| 2026-10-27 | [Windows 표시·resize·트랙패드](26/10/27/work-summary.md) |
| 2026-10-30 | [10월 27~30일 resize·스크롤·코드 품질](26/10/30/work-summary.md) |
