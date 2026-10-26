# W7 — 세션 목표 단위 구현과 일반 sliver 요약

원문: `work7.md` · 작성일: 2026-10-12 KST · 중간 마무리: 2026-10-13 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W8 / 제품 PARTIAL**. 마지막 sliver 세션도 `sessionComplete=false`, `wholePlanComplete=false`다.

## 변경

- 작은 선언마다 원본/모든 runtime/패키징을 반복하던 방식을 세션 목표 선정 → 관련 구현 → 통합 검증 → 결과 한 번 기록으로 바꿨다. W6의 선정 구현·출처와 미완료 범위는 승계했다.
- OS 서비스·drawing/layer/image·text/selection·gesture/focus/keyboard·편집·scroll·앱/디자인·플랫폼/개발·최종 공급을 사용자 흐름 묶음으로 구성했다.
- 실제 platform service/owner, raw keyboard·pointer protocol, recognizer·TapRegion/cursor·Overlay/drag-drop와 scroll physics·metrics 수명을 확장했다.
- 마지막에는 일반/축소 Viewport·SliverConstraints/Geometry·child manager·가변/fixed/varied/prototype List·Grid와 공개 CustomScrollView/ListView/GridView·PrimaryScrollController를 연결했다.
- 실제 scroll position/controller·Idle/Hold/Drag/Ballistic/Driven activity·Ticker·PageStorage를 View owner에 연결하고 key reorder·keep-alive·RTL/axis·예외 복구를 보강했다.

## 기록된 검증

마지막 최신 bytes의 **30 groups = mounted Root 28 + direct protocol 2**가 통과했다. shrinkWrap·hit/intrinsic·공개 List/Grid·scroll owner·10,000행 lazy·attach/detach 실패·복수 View/reduced motion을 포함한다. 선정 10,000행 CPU fixture의 peak active row/render 6·종료 owner 0은 실제 native text/FPS 증거가 아니다.

Core/SDK build·types·package 선언 검사와 이전 scroll metrics의 debug/release 각 49개 원본 비교 결과를 유지했다. 중간 마무리 때 불필요한 전체 검증은 반복하지 않았고 이번 일반 sliver 변경의 새 native/archive 공급은 하지 않았다.

## 남은 범위

MatrixUtils·viewport reveal/ensureVisible·dirty layout focus reveal, default scrollbar/overscroll·restoration·selection auto-scroll과 animation 잔여가 남았다. source span/adoption·독립 감사·새 원본 oracle·mixed 가변 목록/Grid의 실제 브라우저 통합도 미수락이었다.

당시 live node 256·수렴 상한은 해당 구현의 정책이며 최신 W18 전체 메모리 기준이 아니다. 기존 source review·envelope 수를 새 sliver 완료로 복사하지 않는다. W7-01~14의 플랫폼/물리 IME·reader·표시·공급·배포 잔여는 W8로 승계했다.

[전체 이력](../../../README.md) · [W8 자동생성과 패키지 분리](../13/work8-summary.md)
