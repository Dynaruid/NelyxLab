# Semantics 형제 충돌 선별과 분할 생산 설계

원문 `work4.md` · 작성·실행 2026-11-17 KST · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**H4-00 선별 종료 · H4-01~03 미착수 · S0 동기 계약 PASS · PARTIAL · `performanceAccepted=false`**.

## 형제 충돌 인덱스

공통 Semantics의 형제 그룹에 공간 인덱스를 적용할 자격과 기존 관측 계약을 검토했다. 진단에서 `markConflicts` 외곽의 세 입력별 누적 시간은 20.868 / 13.206 / 24.997ms로, 선별한 긴 프레임 CPU 합계의 2.385% / 2.061% / 2.424%였다. 가장 긴 단일 호출은 약 1.99ms였다. 이 시간에는 비교·이전 상태 처리·충돌 Set 갱신·계측이 함께 들어간다. 전체 외곽조차 15% 선별선에 미달해 인덱스 구현과 제품 비교를 보류했다. 일반 스크롤의 전체 접근성 비용에는 별도 분석이 이어졌다. [W9 일반 스크롤](../18/work9-summary.md)

## 분할 생산과 원자적 게시

단일 live tree를 프레임 사이에 부분 변경하면 게시 중인 target과 입력·State·Focus·GlobalKey 계약이 흔들린다. View당 미게시 세대 하나, 입력 범위·metrics·tree revision 검증, 이전 게시를 유지한 채 커밋·취소하는 안을 설계했다. 선택 준비는 재개 가능한 작업으로 제한하고 필수 가시 영역은 기존 동기 동작을 보존하는 방향이었다. Coverage 밖 입력과 준비 중 lifecycle의 관측 규칙은 선행 설계 항목이었다.

- S0는 당시의 `check-frame-publication.mjs`에서 실제 AppSession·ViewRuntime·FrameworkRoot를 연결하고 clock·renderer만 제어했다. token의 View·입력 범위 검사를 보강한 뒤 4개 통합 시나리오, Source framework, retained paint, Core 타입·lint·format을 확인했다. 오류 시 부분 geometry·semantics·renderer 게시 없이 원래 오류를 보존했다.
- 이 시점에는 세대 격리, 분할 loop, S1~4, 새 공급과 성능 검증이 남아 있었다. 후속 문서는 별도 소유권과 달력 생산의 제한된 적용 결과를 기록했다. [분할 준비와 제품 연결](work5-summary.md)
