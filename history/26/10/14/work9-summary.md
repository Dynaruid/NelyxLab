# W9 — Nelyx 독립 구현·편집·서비스·스크롤 요약

원문: `work9.md` · 작성일: 2026-10-14 KST · 마지막 수락·중단: 2026-10-16 KST · 아카이브: 2026-10-27 KST

상태: **PAUSED / PARTIAL**. 마지막 공급 포함 수락과 그 이후 advanced scroll WIP를 구분하며 후속은 W10이다.

## 결정과 구현

- Flutter의 Widget → Element → RenderObject·제약 layout·선언적 UI를 계승하되 내부 구현과 최종 합격 기준은 Nelyx 기능·성능·안정성 명세로 전환했다. Dart 전체 내부 구조 복제는 필수 조건에서 제외했다.
- 자동생성은 계속 활용하며 원본 숫자 타입 주석·출처를 유지했다. 필요한 API/adapter mapping을 명시하고 빈 구현·무조건 성공·타입 은폐로 compiler 부족을 통과시키지 않도록 했다.
- Paragraph/Builder·TextPainter·RenderParagraph·WidgetSpan·font 통지·semantics/manifold·OS 알림·Feedback과 선택 UI를 확장했다.
- 서비스/worker 종료, 실제 native 복원 저장·Windows/Android URI, image 다섯 readback 형식·bitmap 결과 보존·미확인 native 완료 회복, animation·편집/AutofillGroup을 연결했다.
- 마지막 공급 포함 묶음은 Header/Nested와 Refresh·dismiss·reorder·sheet였다. keyed State·edge auto-scroll·controller 분배·취소/오류를 실제 소비에 연결했다.

## 마지막 수락과 새 WIP

Refresh 등 선정 controls39·Nested8·sliver5·Chromium4·producer policy7, 공통 types·외부 strict packed 소비가 통과했다. Windows/Android의 실제 refresh/reorder·편집/행 State 해제·종료를 확인했고 Android sheet는 약한 최초 조건을 제외한 뒤 별도 드래그로 재확인했다.

선정 Android Hermes supplier는 제품 easing이 `-O`에서 멈추고 `-Og`에서 Node와 같은 값을 내는 차이를 실제 VM에서 확인했다. 해당 compiler/cohort 정책의 근거이며 모든 Hermes나 성능으로 일반화하지 않는다.

그 이후 Tree·ListWheel·고정 셀 2D scroll·유한 painted InteractiveViewer·custom scrollbar WIP의 Core CPU/CanvasKit **50개**가 통과했다. 10,000행/10,000×10,000 셀 직접 이동의 bounded State 검사는 CPU fixture 범위다.

## 실패·남은 범위

마지막 Chromium의 **`Viewer updates actual DOM editor bounds`는 FAIL**이었다. full/visible bounds 계약인지 결함인지 미분류였고 scale2 글꼴도 18px로 남았다. 이 최신 WIP의 strict packed 소비·최종 browser·native/cold restore·공급은 미수행이며 이전 controls PASS로 대체하지 않았다.

편집/paint/typography/input·디자인/locale·platform/tooling·성능/최종 공급, 후속 접근성·임베딩이 남았다. 물리 IME/FPS·wide gamut 출력·전체 native loss/drain·서명은 notVerified다. 당시 실행 소유 프로세스는 종료했고 삭제된 checkpoint/receipt는 복원 조건이 아니다.

[전체 이력](../../../README.md) · [W10 기능 동등성 구현](../16/work10-summary.md)
