# W10 — TypeScript 기능 동등성과 생성 코드 통합 요약

원문: `work10.md` · 작성일: 2026-10-16 KST · 방향 변경·종료: 2026-10-18 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W11 / 제품 PARTIAL**. W10-00·01 완료, W10-02 PARTIAL이며 종료 전 실행은 PAUSED였다.

## 구현과 방향 변경

- W9의 최신 입력과 advanced scroll WIP를 승계했다. 첫 wheel/viewport19 묶음의 생성·Core 통합·검증·재생성 및 수정/충돌 보존을 수락했다.
- wheel·2D·tree·InteractiveViewer·RawScrollbar/WidgetState·Cupertino/Material theme·scroll behavior/stretch의 선정 전체 source를 생성·통합하고 실제 Core·browser·Windows/Android 공급/cold restore를 범위별로 확인했다.
- 변환기에 generic witness·numeric provenance·const identity·factory/constructor·record/pattern·mixin·collection·연산자·평가 순서와 내용 기반 AST/compiler cache를 보강했다. 이 compiler 작업을 전체 제품 기능 완료로 환산하지 않았다.
- 후반에는 Dart 본문/전이 closure 우선 방식을 **Nelyx TS 직접 구현과 기능 동등성**으로 바꿨다. 기존 검증된 생성물은 재사용하고 compiler backlog를 제품 필수 기능과 분리했다.
- Cupertino/Material 전체를 기능 family·공통 의존성 단위로 처리하고, Flutter 변환 제약이 큰 family는 Doroti 포트와 비용을 비교하는 계획을 추가했다.

## 검증의 범위

원본 비교·actual Root·fresh package·browser·native 공급은 각 기록된 후보에만 적용한다. 중단 시 입력·receipt·26개 fresh fixture와 기존 owning/state/sample 코드를 확인했지만 이는 정책 변경 이후 새 제품 수락을 뜻하지 않았다. 오래된 source-first 실행 순서·checkpoint는 현재 지시가 아니다.

## 전량 이관한 잔여

| W10 범위 | W11 후속 |
| --- | --- |
| 06 디자인·locale·App/asset/notice·외부 소비 | W11-01 |
| 02 scroll, 03 runtime/paint/text/input, 04 편집/Form, 05 앱/복원 | W11-02~05 |
| 07 플랫폼/runtime/tooling, 08 reload/inspector, 09 실제 환경·성능·공급 | W11-06~08 |
| 10 접근성, 11 native/HTML 임베딩, 12 최종 통합 | W11-09~11 |

Page/Nested/header/refresh/reorder/dismiss/sheet·mixed sliver·key/selection 복원, 물리 IME·reader·FPS/scanout·배포/서명 등은 완료되지 않았다. 디자인 DESIGN-0~4는 종료 시 미실행이었다. W11로 계획을 옮긴 문서 작업 자체는 새 build/runtime 검증이 아니다.

[전체 이력](../../../README.md) · [W11 디자인 패키지](../18/work11-summary.md)
