# W8 — 일괄 자동생성·패키지 분리·선택 기능 요약

원문: `work8.md` · 작성일: 2026-10-13 KST · 마지막 기능 상태 갱신: 2026-10-14 KST · 아카이브: 2026-10-27 KST

원문 상태: **PAUSED / PARTIAL**, `sessionComplete=false`, `wholePlanComplete=false`. 후속 구현은 W9 이후로 승계됐다.

## 방향과 구현

- 사용자 결정으로 고정 Flutter 분석 → 의존성별 일괄 생성 → 기존 구현과 합성 → 묶음 검증 → 제품 반영 → 수동 보정을 기본으로 삼았다. 생성 후 TS 직접 수정도 허용했다.
- 선정 Material/Cupertino를 독립 패키지로 옮기고 Core의 옛 디자인 module을 제거했다. 당시 core0.16.0/SDK0.20.0·Skia0.6.0·CLI/Metro0.10.0·디자인0.1.0이었다.
- animation listener·Tween/Sequence/Curve2D/AnimationStyle/Color·explicit/implicit transition, Container·retained opacity/filter·physical clip/shadow를 실제 render 경로로 확장했다. wire9는 shadow/full clip을 전달하고 wire1~8 수신을 유지했다.
- Unicode 16.0/characters1.4.1 grapheme·word boundary·TextPainter caret/box, 선택 fragment/container·auto-scroll·tap-and-drag·editing intent·overlay/status/Region을 연결했다.
- 기본 text-editing shortcuts와 macOS selector 42개를 추가했다. 마지막 DOM 메뉴 WIP는 View-owned host·Core render binding·SDK DOM/range/pointer/channel 연결이었다.

## 기록된 검증과 정합성

- 마지막 공통 types, Region Root **9 groups**, 원본 Region **24시나리오 × assertions on/off**, shortcut Root **10 groups**가 통과했다.
- 25개 scoped proof 중 직접 입력이 맞는 24개와 과거 overlay proof 1개를 구분했다. 129개 참조 hash 확인은 runtime 재실행이 아니었다.
- 자동 배치 6개/origin36 중 `matrix`·`tween-sequence-item`은 의존 hash 변경으로 재수락이 필요했고, 수동 origin 10개의 destination/supporting drift도 남았다.
- 원본/Root/CanvasKit pixels·Chrome·packed 소비·Windows offscreen 증거는 각 당시 범위다. 최신 DOM provider의 실제 브라우저 동작 증거로 승격하지 않았다.

## 남은 범위와 이관

DOM shutdown ingress를 drain 전에 차단하는 처리·late input·재진입/부분 bind·hit/clip/paint order·복수 View·실제 우클릭 수락이 남았다. 마지막 DOM WIP는 **빌드·타입 수준 PARTIAL / runtime notVerified**다.

SelectionArea·디자인 control·공개 exports/외부 소비·origin/공급, 새 boundary/box native header 실행과 여섯 runner 최신 수락도 미완료였다. 전체 디자인/locale·host/tool 물리 분리·물리 IME/reader/FPS·복구/배포는 후속 범위다. 당시 checkpoint/복구 archive는 이후 삭제됐으며 현재 복구 요구가 아니다.

[전체 이력](../../../README.md) · [W9 독립 구현과 자체 수락](../14/work9-summary.md)
