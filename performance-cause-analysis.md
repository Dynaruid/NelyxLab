# Windows 달력 스크롤 성능 미달 원인 분석

작성일: 2026-11-17

대상: [work.md](work.md)의 Windows Hermes 달력 30fps 이상·진행 정체 감소 목표

분석 기준: HEAD `720d22d6`와 현재 작업 트리. 측정값은 기존 `work.md` 기록을 인용했다. 이 문서 작성 과정에서는 성능 실행이나 엔진 코드를 변경하지 않았다.

## 1. 결론

가장 유력한 원인은 **복잡한 월 페이지의 생성·기존 자식 갱신·회수 작업이 프레임의 동기 build/layout 경로에 몰리는 것**이다. 월 페이지는 날짜 문자열만 바꾸는 화면이 아니라 Focus·입력 반응·Ink·Text·Semantics를 포함한 상호작용 트리다. 화면에 새 페이지가 필요하면 layout 안에서 그 트리를 생산하고 연결하는 작업까지 끝내야 한다.

월 변경은 이미 살아 있는 페이지의 재빌드도 유발할 수 있다. 이때 실제 RenderObject 자식 구조가 그대로여도 동기화 대상 등록·정렬·자식 투영 및 비교가 발생할 수 있다. 이 부분은 줄일 여지가 있는 **후속 가설**이다. 다만 현재 코드에는 owner 중복 제거와 동일 자식 비교가 이미 있으므로, 이를 “매 rebuild마다 전체 렌더 트리를 다시 만드는 결함”으로 설명하면 부정확하다.

현재 근거로는 하나의 함수나 GC·Hermes·GPU 중 하나를 단독 원인으로 확정할 수 없다. 정상적인 재빌드 정책 자체가 버그라는 증거도 없다. 우선순위는 **공통 엔진에서 한 페이지를 처리하는 데 필요한 동기 작업량을 줄이는 것**이며, 정적 helper 수 감소만으로 목표를 달성할 것이라는 가설은 기존 비교에서 지지받지 못했다.

| 판단 | 근거 수준 |
| --- | --- |
| 새 sliver 자식의 build·연결이 layout 중 동기적으로 수행된다 | 코드에서 확인 |
| 월 변경 시 새 delegate가 기존 소유 자식의 갱신을 요청한다 | 코드에서 확인 |
| 복잡한 자식 트리의 생산·갱신이 주요 부담이다 | 코드와 별도 build 진단이 함께 지지하는 우선 가설 |
| 속성 갱신에 따른 동기화 준비 중 일부를 줄일 수 있다 | 코드상 가능성. 횟수와 시간 비중은 미확정 |
| 역방향 알고리즘 결함, GC 또는 특정 VM이 단독 원인이다 | 현재 근거로 확정 불가 |

## 2. 월 변경에서 프레임 지연까지의 코드 경로

```text
PageView의 보고 페이지 변경
  → MonthPicker의 setState + 상위 표시 월 변경 callback
  → PageView.builder와 SliverChildBuilderDelegate 갱신
  → sliver가 현재 소유한 자식의 갱신을 예약
  → Root의 flushLayout
      → childManager.didStartLayout: 예약된 자식 build
      → 필요한 새 페이지: createChild → buildScope → subtree 연결
      → 범위를 벗어난 페이지: keep-alive / 보존 / 제거 판단
      → 자식 layout
  → paint / compose / 입력 geometry / semantics 등
  → 프레임 종료 시 남은 inactive tree 정리
```

이 경로는 매 pointer move가 전체 달력을 재빌드한다는 뜻이 아니다. [PageView.reportPage](Nelyx/src/framework/widgets/page-view.ts#L447)는 같은 페이지 보고를 억제하고, ScrollUpdateNotification의 page 값을 반올림해 변경을 보고한다. 핵심은 **페이지 경계를 넘으며 발생하는 작업 묶음**이다.

### 2.1 월 변경은 기존 페이지에도 갱신을 전달한다

[MonthPicker의 월 변경 처리](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1284)는 `setState`로 표시 월을 갱신하고 상위 callback을 호출한다. 상위 [CalendarDatePicker의 처리](packages/material/src/generated/date/calendar_date_picker.generated.ts#L603)도 `setState`를 수행한다. 그 뒤 [build 내부의 PageView.builder 호출](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1672)이 새 Widget 구성을 만든다.

[PageView.builder](Nelyx/src/framework/widgets/page-view.ts#L398)는 호출마다 새 `SliverChildBuilderDelegate`를 만든다. [shouldRebuild](Nelyx/src/framework/widgets/scroll-delegate.ts#L158)는 `true`이고, [SliverMultiBoxAdaptorElement.update](Nelyx/src/framework/widgets/sliver.ts#L273)는 이 정책에 따라 자식 갱신을 예약한다. [performRebuild](Nelyx/src/framework/widgets/sliver.ts#L368)는 **현재 소유한 자식 슬롯**을 처리한다. 선택 가능한 모든 월을 한꺼번에 만드는 로직은 아니다.

여기서 구분할 점이 두 가지 있다.

- [dartMethodTearOff](Nelyx/src/foundation/dart-method-tear-off.ts#L7)는 receiver와 method에 대한 callback을 캐시한다. 따라서 매번 다른 itemBuilder 함수가 만들어지는 것이 원인이라고 단정할 수 없다.
- 같은 callback도 변경된 State를 읽어 다른 결과를 낼 수 있다. callback identity만으로 delegate를 고정하거나 전역 `shouldRebuild=false`를 적용하면 필요한 화면 갱신을 누락할 수 있다.

이 갱신 정책은 번역 오류로 판정할 근거가 없다. 로컬 Flutter 저장소의 고정 원본 commit `71e4717a61786faab4c7aa39825989305ed29e8a`를 `git show`로 읽어 비교했으며, 같은 월 변경 `setState`와 builder delegate의 `shouldRebuild=true`를 확인했다. 현재 Flutter 작업 트리 HEAD는 이 pin과 다르므로 원본 근거로 사용하지 않았다. 이번 비교는 코드 계약 확인이며 Flutter 실행·성능 비교는 아니다.

### 2.2 한 월의 생산 단위가 크다

[_buildItems](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1581)는 월을 key로 하는 `_DayPicker`를 반환한다. [_DayPickerState](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1810)는 월의 요일 머리글과 날짜 항목을 만들며, 새 State의 초기화에서는 날짜별 [FocusNode](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1842)도 생성한다. 활성화된 날짜 항목의 build에는 [Ink·Text](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2196), [Semantics](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2219), [InkResponse](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2228)가 포함된다.

또한 [SliverChildBuilderDelegate의 decoration](Nelyx/src/framework/widgets/scroll-delegate.ts#L77)은 RepaintBoundary·IndexedSemantics·AutomaticKeepAlive 등의 wrapper를 적용한다. 각 wrapper에는 화면·접근성·수명 계약이 있으므로 개수만 보고 제거 대상으로 삼을 수 없다.

여기서 비용은 다음처럼 나뉜다.

| 구분 | 실제 수행하는 작업 | 해석 시 주의점 |
| --- | --- | --- |
| 새 페이지 mount | Widget 구성, Element·State·RenderObject 생성, FocusNode 등 초기화, 트리 연결 | 살아 있는 기존 State의 rebuild와 다름 |
| 기존 페이지 update/rebuild | 새 Widget 구성과 설정 전달, 필요 자식 재빌드 | 같은 type/key이면 Element·State를 보존할 수 있음 |
| 구조 동기화 준비 | owner 등록, 순서 정렬, 예상 자식 투영·비교 | 실제 insert/remove가 없는 경우도 있음 |
| 페이지 회수 | deactivate/unmount/dispose, 자원 해제, 이후 GC 대상 발생 | 범위 밖이라는 이유만으로 항상 즉시 회수되는 것은 아님 |

[Widget.canUpdate 및 자식 조정](Nelyx/src/framework/widgets/framework.ts#L1330)은 type/key에 따라 기존 Element를 재사용한다. 따라서 “재빌드 1만 회 = 새 Element·FocusNode 1만 개 생성”이라는 해석은 틀리다. 반대로 identity를 보존했다고 해서 Widget 구성과 rebuild 비용이 없어지는 것도 아니다.

### 2.3 layout 시간에는 Widget 생산 시간도 들어간다

[RenderSliverFixedExtentBoxAdaptor.performLayout](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts#L191)은 `didStartLayout` 이후 필요한 자식을 확보한다. 없는 자식은 insert-and-layout 경로에서 child manager에 생성을 요청한다. [createChild](Nelyx/src/framework/widgets/sliver.ts#L459)는 `owner.buildScope` 안에서 delegate를 실행하고 자식을 갱신한 뒤 [finishQueuedChildren](Nelyx/src/framework/widgets/sliver.ts#L444)으로 render 연결과 pending offset을 정리한다.

또한 [didStartLayout](Nelyx/src/framework/widgets/sliver.ts#L588) 자체가 예약된 sliver 자식 갱신을 isolated build scope 안에서 처리한다. Root의 일반 [flushBuild](Nelyx/src/framework/widgets/root.ts#L656)가 끝났더라도 [flushLayout](Nelyx/src/framework/widgets/root.ts#L669) 중에 추가 Widget build가 수행될 수 있다. 따라서 프레임 진단의 layout 구간이 길다고 해서 기하 계산만 느리다고 판단하면 안 된다.

필수 layout 뒤의 선택적 준비는 이미 가시 영역에서 요구된 새 페이지의 생산 비용을 소급해서 없앨 수 없다. 이 비용은 현재 프레임이 먼저 지불한다.

## 3. 회수와 역방향 결과의 해석

[PageView 기본 설정](Nelyx/src/framework/widgets/page-view.ts#L379)은 `allowImplicitScrolling=false`, offscreen layout cache extent 0 viewport다. 이는 항상 페이지 하나만 존재한다는 뜻이 아니다. 스크롤 중 부분적으로 보이는 두 페이지와 명시적으로 keep-alive되는 자식은 함께 존재할 수 있다.

범위를 벗어난 자식은 [_destroyOrCacheChild](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts#L384)에서 keep-alive 또는 child manager의 보존 여부를 확인한 뒤 제거한다. 기본 PageView의 [SliverFillViewport 내부 Widget](Nelyx/src/framework/widgets/sliver-fill.ts#L65)은 별도 childPolicy를 전달하지 않으며, [undefined 정책은 legacy](Nelyx/src/framework/widgets/view-work-budget.ts#L21)로 정규화된다. 기존 observed-budget 준비 기능이 기본 PageView에서도 동작한다고 전제할 수 없다.

제거되는 subtree에 GlobalKey가 없고 layout 중 회수 조건을 만족하면 [_retireInactiveSubtreeWithoutGlobalKeys](Nelyx/src/framework/widgets/framework.ts#L685)를 통해 즉시 unmount할 수 있다. GlobalKey의 재취득 가능성은 프레임 종료까지 보존한다. 남은 inactive subtree 정리도 Root의 [finalizeTree](Nelyx/src/framework/widgets/root.ts#L1115)에서 수행한다.

따라서 **이전에 방문한 월도 살아 있는 subtree가 이미 회수됐다면 다시 생산해야 한다.** 문단 cache가 남아 있어도 Element·State 전체가 남아 있다는 뜻은 아니다. 다만 실제 성능 실행에서 월별 eviction/remount 횟수를 기록하지 않았으므로, 이 경로가 역방향 비용의 몇 %인지 확정할 수 없다.

현재 달력 시나리오는 보통 정방향 6회, 빠른 정방향 6회, 빠른 역방향 12회의 제스처이며 월 정착의 이동량도 각각 4·3·6개월이다. 역방향은 빠른 정방향보다 제스처와 페이지 경계가 많아 연속 작업 길이도 다르다. 따라서 **역방향 FPS가 더 낮다는 결과만으로 방향 의존 알고리즘 결함을 증명할 수 없다.** 방향 자체를 분리하려면 이동 거리·제스처 수·시간·초기 보존 상태를 맞춘 별도 실험이 필요하다. 기존 수락 시나리오의 결과는 그대로 유지해야 한다.

## 4. render children 동기화는 어디까지 의심할 수 있는가

[Element.rebuild](Nelyx/src/framework/widgets/framework.ts#L1290)는 `performRebuild` 전에 nearest RenderObjectElement의 동기화를 등록한다. 속성만 바뀌는 rebuild도 이 경로를 지나므로 구조가 동일한 갱신에서 준비 비용이 발생할 수 있다.

하지만 현재 구현에는 다음 최적화가 이미 있다.

1. [OwnerTransaction](Nelyx/src/runtime/owner-transaction.ts#L10)의 pending `Set`이 같은 owner 등록을 합친다. rebuild 횟수와 commit 횟수는 같지 않다.
2. commit은 pending이 없으면 바로 반환한다. [flushScope 끝의 commit](Nelyx/src/framework/widgets/framework.ts#L833) 뒤 `finishQueuedChildren`이 다시 flush하더라도 두 번째가 실제 작업을 수행한다고 단정할 수 없다.
3. [synchronizeRenderObjectChildren](Nelyx/src/framework/widgets/framework.ts#L2071)는 예상/실제 자식의 identity와 순서를 비교해 같으면 반환한다. 항상 `setChildren`을 호출하지 않는다.
4. [removeChild](Nelyx/src/framework/widgets/sliver.ts#L479)는 dirty build 또는 pending offset이 있을 때만 후속 동기화를 실행한다.

따라서 남는 가설은 **“이미 중복 제거된 서로 다른 owner들에 대해서도 불필요한 등록·정렬·투영·비교가 남는가”**다. 한 batch의 owner 수가 R이면 정렬은 일반적으로 O(R log R)이고 자식 투영·비교 비용이 추가된다. 현재 자료로 전체 동작을 O(N²)라고 판정하거나 이 비용이 프레임 대부분이라고 주장할 수 없다.

구조 변경에 따른 등록은 검토할 가치가 있다. 다만 다음 계약이 먼저 보존되어야 한다.

- 실제 insert/move/remove, slot과 parent data 변경, GlobalKey 이동을 놓치지 않는다.
- custom Element·자식 projection getter·동기화 hook의 관측 순서를 보존한다. 증명하지 못한 경로는 기존 방식으로 처리한다.
- 자식 owner가 부모보다 먼저 commit되는 순서, 실패한 owner 재시도, commit 중 새로 등록된 작업의 다음 경계 처리를 보존한다.
- 새 subtree는 실제 구조 변경을 일으킨다. 속성 갱신의 준비 비용을 줄이는 것만으로 cold 생산 비용까지 해결했다고 간주하지 않는다.

현재 `Element.rebuild`의 등록 한 줄만 삭제하는 수정은 이 계약을 만족한다고 볼 수 없다. 이 후보는 아직 구현하지 않았다.

## 5. 기존 관측이 지지하는 것과 지지하지 않는 것

### 5.1 build 진단: 작업량은 크지만 생성 횟수·단일 프레임 시간은 아니다

[work.md의 별도 build 진단](work.md#L443)은 앞 두 phase에서 Element rebuild **13,024 / 8,607회**, outer build scope 누적 시간 **470.608 / 356.189ms**를 기록했다. 공통 Focus·MouseRegion·Text·Ink·Semantics 등에 비용이 분산됐고, 빠른 phase의 문단 cache 증분은 **150 hit / 3 miss**였다. 문단 cache miss 하나만을 우선 원인으로 보는 설명보다 공통 자식 처리 경로를 먼저 살펴볼 이유가 된다.

[진단 구현](Nelyx/eng/windows-jank-build-profile.ts#L3)은 rebuild 실행을 세며 새 객체 수를 세지 않는다. 시간은 phase 누적이며 한 프레임에 470ms가 걸렸다는 뜻도 아니다. Widget별 시간은 자식 처리 시간을 포함할 수 있으므로 종류별 합계를 다시 scope 시간에 더하면 중복 계산한다.

이 진단의 역방향은 입력 deadline 7.643ms 초과로 거부됐다. 앞 두 phase의 값은 원인 탐색 단서로만 사용하며, 전체 실행의 기능 PASS나 유효 FPS 비교로 올리지 않는다. 기존 기록에는 dirty flush와 render commit의 세부 시간 분해가 남아 있지 않아 동기화 비중을 산출할 수 없다.

### 5.2 TDZ 제거: 정적 감소가 안정적인 프레임 개선으로 이어지지 않았다

[work.md §9](work.md#L552)의 같은 입력·host·toolchain 조건 3회 비교에서 표시 FPS 하한의 최솟값~최댓값은 다음과 같다. 이는 신뢰구간이나 개선율이 아니라 관측 범위다.

| 구간 | pruning off | pruning on | ≥100ms 표시 진행 정체 횟수: off → on |
| --- | --- | --- | --- |
| 보통 정방향 | 26.377~35.148 | 26.051~29.023 | 6/7/7 → 6/7/8 |
| 빠른 정방향 | 23.702~28.513 | 22.937~30.241 | 4/4/5 → 5/4/5 |
| 빠른 역방향 | 9.720~20.844 | 15.013~17.679 | 6/6/7 → 7/6/7 |

Source lowering fixture의 local helper 8,592개 중 2,450개를 제거했지만, 이 비율은 동적 실행 횟수나 CPU 시간 감소율이 아니다. 비교는 기본 활성화를 지지할 만큼 일관된 FPS·정체 개선을 보이지 않았고, 최종 기본은 bytecode + pruning off다. 이 결과가 모든 VM 실행 비용의 부재를 증명하지는 않는다.

### 5.3 목록과 달력의 차이는 생산 단위 가설을 지지한다

[최종 기본 공급 회귀](work.md#L595)에서 Gallery와 실제 가변 높이 목록은 각 3회, 관측 표시 FPS 하한 30 이상과 ≥100ms 진행 정체 0회를 기록했다. 가변 목록의 cold 구간은 **71.059 / 72.417 / 72.842 FPS**였다. 같은 기본 경로의 달력 확인 1회는 보통/빠른 정방향/역방향 **31.056 / 24.516 / 14.827 FPS**, 정체 **8 / 5 / 7회**였다.

이는 모든 화면에서 같은 정도의 공통 scheduler 고정 비용만 발생한다는 설명보다 workload 차이를 먼저 살펴볼 근거다. 다만 목록 한 행과 달력 한 월은 상호작용·자식 수·paint 내용이 다르므로 같은 조건의 미세 benchmark는 아니다. 목록의 전체 데이터 1,000행이 한 번에 mount된다는 뜻도 아니다.

표시 FPS는 합성된 desktop 화면에서 식별한 표시 프레임의 **관측 하한**, engine FPS는 고유 surface-copy fence 완료를 세는 지표다. 둘 다 실제 scanout 측정이 아니며 CPU 시간의 역수로 환산하지 않는다. 기능·입력 보존 PASS도 성능 PASS와 별개다.

## 6. 다른 원인을 배제하지 못하는 이유

| 후보 | 확인한 내용 | 현재 판단 |
| --- | --- | --- |
| 할당·GC | [별도 진단](work.md#L482)의 phase 할당 증분 약 112.4/94.5/123.6MB, GC pause 증분 137.9/102.4/157.6ms, 기록된 최대 단일 pause 19.512ms | 할당 부담은 존재한다. phase 합계를 단일 stall과 같게 볼 수 없고 GC 전 mutex 대기는 이 최대값에 포함되지 않는다. 단독 원인 또는 무관함 모두 미확정 |
| Hermes·AOT | [typed 큐 연결](work.md#L536) 뒤에도 역방향 engine FPS 27.501/22.787/29.472 | 부분 typed 전환만으로 목표 미달. 전체 framework가 typed였던 실험은 아니므로 AOT·VM 비용 전체에 대한 결론은 불가 |
| paint·GPU·접근성 | 날짜별 Ink·Text·Semantics 경로가 존재하며 최신 비교에서 각 비용을 분리하지 않음 | 추가 기여 가능. semantics를 끄는 방식은 기능 계약을 깨므로 해결책으로 채택할 수 없음 |
| 입력 처리 지연 | [runtime.buildPending](Nelyx/src/hosting/runtime.ts#L620)은 scene을 동기 호출하고 [pump](Nelyx/src/hosting/runtime.ts#L851)가 입력 flush와 프레임 생산을 진행 | 긴 scene 작업은 다음 JS dispatch/tick을 늦출 수 있다. native 수신·전달·수락 개수 일치는 최종 보존 근거이며 낮은 지연의 증거가 아님 |

할당 증분은 live heap 증가량이나 누수량이 아니다. 입력 지연 가설 또한 OS가 입력 수신을 중단하거나 모든 GPU 작업이 정지한다는 뜻이 아니다. 현재 증거가 지지하는 경계는 JS가 소유한 동기 작업과 다음 처리 기회 사이의 관계다.

## 7. 다음 접근법

### 7.1 먼저 적용할 설계: 변경이 없는 구조의 준비 비용 줄이기

공통 framework의 stock Element 경로에서 **구조가 바뀌는 경우를 빠짐없이 식별할 수 있는 범위**부터 render children 동기화 등록을 제한한다. 등록 횟수만 줄이는 것이 목표가 아니라, custom 경로와 실패 복원 계약을 보존하면서 불필요한 owner 정렬·projection을 줄이는 것이 목표다.

설계 검토에는 등록 시도 수, batch별 고유 owner 수, 동일 자식으로 끝난 commit 수, 실제 구조 변경 수를 구분해야 한다. 기존 build profile의 `dirtyFlushMs`와 `renderCommitMs`를 함께 보면 retained update 비용과 동기화 준비 비용을 나눌 수 있다. **이 문서 단계에서는 해당 새 계수나 측정을 추가하지 않았다.**

### 7.2 함께 남는 과제: cold 생산·회수의 공통 비용

새 페이지 생성·연결·회수는 실제 작업이므로 동기화 등록 축소만으로 없어지지 않는다. Widget 구성, Element 재사용, mount/unmount와 자원 등록의 공통 경로에서 반복 탐색·임시 할당·변화 없는 상태 전파를 줄일 수 있는지 검토해야 한다. 같은 type/key라는 이유만으로 설정 갱신을 생략하거나, 달력 전용으로 Focus·입력·Semantics를 축소하지 않는다.

한정된 보존이나 사전 준비는 그 다음 후보다. 현재 [bounded 정책 허용 대상](Nelyx/src/framework/widgets/sliver.ts#L117)은 FixedExtentList·SectionList이므로 PageView에 단순 옵션 하나를 켜서 적용할 수 없다. 확장하려면 Element 수와 live 자원 예산, State·focus·semantics·ticker의 비가시 상태, eviction·GlobalKey 계약을 별도로 설계해야 한다. 모든 월 keep-alive나 무제한 cache는 동기 작업과 메모리를 다른 시점으로 옮길 뿐이다.

Widget 결과 재사용도 입력·의존성 revision이 그대로라는 명시적 증명이 있을 때만 검토한다. builder 함수 identity가 같다는 것은 그 증명을 대신하지 않는다.

### 7.3 구현 뒤의 확인 순서

1. 코드에서 stock/custom 경계, 구조 변경 경로, 실패 재시도를 먼저 검토하고 수정한다.
2. child reconciliation·retained paint·GlobalKey 이동·owner 순서와 실패 복원을 대상으로 필요한 회귀를 실행한다.
3. 원인 분해용 진단과 성능 비교를 분리한다. 진단은 새/재사용/회수 자식과 build/commit 비중을 확인하며 FPS 표본에 섞지 않는다.
4. 동일 공급·viewport·VM·render 설정·입력 조건의 기존 달력 시나리오를 변경 전후 각 3회 비교한다. 테스트는 20분 timeout을 적용하고 주입 실패·foreground 이탈 표본을 제외한다. 임시 산출물은 실행 종료 시 회수한다.
5. engine·관측 표시 FPS 모두 30 이상, 진행 정체 감소, 입력·월 정착·UIA·자원 수명 보존을 확인한다. 방향 자체를 조사하는 대칭 실험은 별도로 둔다.

현재 전체 판정은 **PARTIAL / performanceAccepted=false**다. 이 문서는 코드 경로와 기존 근거를 정리한 원인 분석이며, 후속 Source 변경의 구현 완료나 새 성능 수락을 의미하지 않는다.
