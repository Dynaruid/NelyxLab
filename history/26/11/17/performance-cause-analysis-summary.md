# Windows 달력 스크롤 성능 미달 원인 분석

원문 `performance-cause-analysis.md` · 작성 2026-11-17 KST · 분석 기준 `720d22d6` · 보관 11-20 · 원문 스냅샷 `ffe5c5a2`

**코드 분석 완료 · 원인별 기여도 미확정**. 기존 측정과 고정 Flutter 원본 `71e4717a61786faab4c7aa39825989305ed29e8a`를 대조했다. 분석 과정의 새 성능 표본이나 엔진 변경은 없었다. [선행 엔진 작업과 측정](../16/work-summary.md)

## 관측을 설명하는 코드 경로

- 월 변경 `setState`는 새 `SliverChildBuilderDelegate`를 만들고 `shouldRebuild=true`를 통해 현재 소유한 슬롯의 갱신을 요청한다. Flutter 원본도 같은 정책을 사용한다. callback이나 월 번호만으로 갱신을 생략하면 변경된 상태가 누락될 수 있다. [PageView](../../../../Nelyx/src/framework/widgets/page-view.ts) · [슬리버 자식 갱신](../../../../Nelyx/src/framework/widgets/sliver.ts)
- 보이는 새 월이 필요하면 Sliver layout이 누락 슬롯을 요청하고, 그 안에서 날짜 Grid와 Focus·Ink·텍스트·Semantics 하위 트리를 생산한다. 따라서 layout 시간에는 Widget 생산과 재조정이 함께 들어간다. 이탈한 월은 keep-alive 또는 보존 자격을 얻지 못하면 deactivate 후 finalize에서 회수된다.
- `Element.rebuild`가 등록한 render owner는 이미 Set으로 중복을 제거하며 자식 순서가 같을 때 기존 경로를 재사용한다. rebuild 호출 횟수를 실제 링크 변경 또는 commit 횟수로 환산할 수 없다. 구조가 그대로일 때의 등록 비용을 먼저 분리하려면 사용자 정의 훅, GlobalKey 이동, 실패 복구 순서를 함께 확인해야 한다.

## 기존 수치와 한계

- 별도 build 진단에서 첫 두 입력 구간의 rebuild는 13,024 / 8,607회, outer scope 누적 시간은 470.608 / 356.189ms였다. 빠른 구간의 문단 캐시는 150 hit / 3 miss였다. 수치는 여러 프레임과 중첩 작업을 포함한다.
- 같은 기본 공급의 Gallery와 가변 목록은 각 3회, 표시 하한 30 FPS 이상과 100ms 이상 진행 정체 0회를 기록했다. 달력 1회는 31.056 / 24.516 / 14.827 FPS와 정체 8 / 5 / 7회였다. 역방향의 입력 횟수와 월 이동량도 달라 방향 자체의 결함은 미확정이다.
- TDZ 제거의 정적 이득은 안정적인 표시 개선으로 이어지지 않았다. 관측된 최대 단일 GC pause 19.512ms에는 GC 전 mutex 대기가 포함되지 않는다. 부분 typed AOT, GC, GPU 또는 host 대기 각각의 단독 기여는 미확정이다.

당시 후속 설계는 구조가 같은 갱신의 비용과 실제 cold 생산·회수를 구분해 살폈다. [자식 수명 및 JSC 비교](work2-summary.md)
