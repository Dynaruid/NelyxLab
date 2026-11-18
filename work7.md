# W7 · 부모가 전달한 위젯의 갱신 순서와 달력 월 전환 비용

2026-11-18 · 설계 대조 기준 `0b934a96` · 구현 작업 트리 기준 `471df5eb` · **구현 및 검증 결과는 §5**

첫 수정 대상으로 **부모의 build가 기존 자식에게 새 Widget을 전달하는 경로**를 제안한다. Flutter는 이 호출 안에서 일반 자식의 설정과 하위 트리를 갱신한다. Nelyx는 같은 자식을 dirty 큐에 등록하고, 나중에 꺼내 build와 자식 조정을 이어간다. 이를 고치면 사용자 코드가 관찰하는 갱신 순서를 맞출 수 있다. 월 전환이 얼마나 빨라지는지는 별도 판정한다. 특히 새 월 최초 생성의 중복 렌더 설정은 기존 두 월 갱신과 독립적으로 줄일 수 있다.

## 1. 월이 바뀔 때 어떤 일이 일어나는가

PageView가 스크롤 알림에서 반올림한 페이지 번호가 달라지면 `onPageChanged`를 호출한다. 월 선택기는 현재 월과 필요한 경우 포커스 날짜를 갱신하고, 상위 달력에 표시 월을 통지하고, 접근성 안내를 요청한다. 상위 달력과 월 선택기의 State가 갱신될 수 있다. 날짜 Grid는 해당 월의 날짜로 새 목록과 `SliverChildListDelegate`를 만든다. 날짜의 값 키와 기존 FocusNode는 다음 구성으로 전달된다. 새 목록을 받은 delegate는 자식 목록 identity 변경을 보고한다. Flutter의 달력도 같은 구조다. 따라서 날짜가 같다는 이유로 날짜 build나 표시 월 통지를 생략하면 잘못된 선택·포커스·안내가 남을 수 있다. [PageView](Nelyx/src/framework/widgets/page-view.ts#L466) · [월 변경](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1284) · [날짜 목록](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1943) · [delegate](Nelyx/src/framework/widgets/scroll-delegate.ts#L243) · [Flutter 달력](reference/flutter-master/packages/flutter/lib/src/material/calendar_date_picker.dart#L694)

| 관측 구간 | 기존 자료 | W7에서 설명해야 할 비용 |
| --- | --- | --- |
| 두 월이 이미 보이는 중간점 | `ref.md`에서 양쪽 모두 날짜 build 59회, 날짜 하위 `updateRenderObject` 472회. Nelyx의 layout 안 dirty flush 18.9ms | 큐 처리, 실제 build, 자식 조정, 렌더 속성 설정과 같은 프레임의 헤더·Sliver 작업에 각각 얼마가 드는가 |
| 3월 페이지 첫 진입 | 양쪽 모두 날짜 31개와 그 아래 render 객체 248개 생성. Nelyx에서 초기 update 217회 추가 | 생성 시 끝난 설정과 첫 update에서 비로소 적용되는 설정을 구별하면 첫 표시가 얼마나 빨라지는가 |
| Windows 빠른 역방향 | W6 단일 `legacy` 진단 frame 176에서 월 재생성·회수가 겹쳤다. layout 199.679ms 중 dirty rebuild 배타 시간 142.840ms. W6 최종 역방향 엔진 FPS 중앙값 17.63 | 실제 입력에서는 기존 월 갱신·새 월 생성·이탈 월 회수가 겹친다. 각 작업과 최종 표시 지연을 연결할 수 있는가 |

18.9ms는 큐 자체의 배타 시간이 아니다. 472회는 날짜 **아래**의 집계다. 217회는 **새 월**의 집계다. `ref.md`에는 원자료와 재현 코드의 실제 경로가 없어 이 수치들은 제공된 관측값으로 사용한다. W6의 Windows 프레임과도 같은 표본으로 간주할 수 없다. [병목 가설](ref.md) · [W6 역방향 프레임](work6.md#L202) · [제품 기준선](work6.md#L210)

## 2. Nelyx와 Flutter 구현 대조

비교 대상은 현재 체크아웃의 TypeScript와 로컬 Flutter 소스다. 비교에 사용한 Dart `framework.dart`의 SHA-256 접두사는 `a01402e62e07`이다.

| 경로 | Nelyx의 현재 동작 | Flutter 동작과 수정 방향 |
| --- | --- | --- |
| 동일 Widget / 호환 Widget | 단일 자식은 `canUpdate(typeToken, sameKey)`로 후보를 고른 뒤 slot을 바꾸고 Widget 참조가 다르면 `update`한다. | Flutter의 `updateChild`는 같은 Widget이면 slot만 갱신하고, 호환되는 새 Widget이면 같은 Element에서 `update`한다. Nelyx에서도 소유권·키 예약을 지킨 뒤 동일 참조를 먼저 처리할 수 있다. 독자적으로 dirty인 자식은 그대로 처리한다. [Nelyx](Nelyx/src/framework/widgets/framework.ts#L2126) · [Flutter](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L4000) |
| 기존 Component 갱신 | 기본 `Element.update`가 Widget 교체·inherited index 갱신 뒤 가상 `markNeedsBuild`를 호출한다. Stateful은 이어서 `State.update → didUpdateWidget`, Proxy는 `updated(old)`를 실행한다. 자식 build는 큐를 비울 때 실행된다. | Stateless는 즉시 강제 rebuild, Stateful은 새 설정 설치와 `didUpdateWidget(old)` 뒤 강제 rebuild, Proxy는 `updated(old)` 뒤 강제 rebuild한다. 이 차이는 형제 A의 자손이 갱신되는 시점과 형제 B의 콜백에서 볼 수 있는 상태에 영향을 준다. [Nelyx 기본](Nelyx/src/framework/widgets/framework.ts#L1908) · [Stateful·Proxy](Nelyx/src/framework/widgets/framework.ts#L2578) · [Flutter Stateless](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L5910) · [Stateful](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L6004) · [Proxy](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L6161) |
| RenderObject 설정 / 자식 | 기본 RenderObjectElement는 mount에서 create·attach하고, 예약된 첫 build에서 설정 훅과 `childWidgets` 조정을 수행한다. 설정을 완결했다고 명시한 Widget에는 첫 훅을 건너뛰는 장치가 있다. 이후 기본 rebuild도 속성과 자식을 함께 처리한다. | Flutter는 mount의 create·attach로 최초 render 설정을 끝낸다. 새 Widget 전달 시 render 설정을 즉시 적용하며 Single/Multi가 자식을 조정한다. 의존성으로 인한 render rebuild는 설정 훅만 수행한다. Nelyx의 동적 `childWidgets`와 사용자 정의 Element에는 기존 경로가 필요하다. [Nelyx](Nelyx/src/framework/widgets/framework.ts#L2747) · [Flutter render](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L6807) · [Flutter single](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L7139) |
| 여러 자식과 State 보존 | 일치하는 앞부분은 이미 순서대로 소비한다. 첫 불일치부터 남은 이전 자식을 Set과 선택적 키 맵에 넣고, 키 없는 자식은 이전 배열의 같은 인덱스에서 찾는다. | Flutter는 일치하는 뒷부분도 먼저 찾아두고 중간만 키로 조정한 뒤, 뒷부분을 앞에서부터 올바른 slot으로 갱신한다. 예를 들어 타입이 다른 무키 자식 `[A, B] → [X, A, B]`에서 현 Nelyx는 A·B를 새로 만들 수 있고 Flutter는 두 State를 유지한다. 순서·identity 호환성의 독립 수정 대상이다. [Nelyx 목록 조정](Nelyx/src/framework/widgets/framework.ts#L2161) · [Flutter 목록 조정](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L4143) |
| Sliver / layout 경계 | Sliver 전용 BuildScope의 예약이 layout을 깨우고, `didStartLayout`의 callback이 dirty와 render commit을 비운다. `performRebuild`는 delegate 조건에 따라 기존 인덱스를 재매핑하고 자식을 갱신한다. | Flutter Sliver는 새 delegate의 타입 또는 `shouldRebuild` 조건을 만족하면 `update` 안에서 기존 슬롯을 재조정한다. 새 가시 슬롯 생산은 layout의 `createChild`에서 이뤄진다. 기존 슬롯 갱신 시점과 실제 constraints로 새 슬롯을 요구하는 시점을 구별한다. [Nelyx update](Nelyx/src/framework/widgets/sliver.ts#L328) · [layout 경계](Nelyx/src/framework/widgets/sliver.ts#L766) · [Flutter](reference/flutter-master/packages/flutter/lib/src/widgets/sliver.dart#L953) |

Nelyx에는 이미 자식 insert·move·remove 훅이 있다. 동시에 모든 `Element.rebuild`가 자신 또는 가까운 render owner를 동기화 대상으로 등록한다. owner의 Set은 중복을 합치지만 commit에서 배치를 만들고 깊이순으로 정렬한다. 기본 훅은 예상 render 자식과 실제 목록을 비교한다. 단일 자식은 기존 projection을 전달하고, 여러 자식은 펼친 목록을 만든다. 따라서 구조가 같은 수백 건의 설정 전달에서 **owner 등록·비교가 실제로 얼마나 남는지**가 큐와 별개의 후보다. `flushScope`의 render commit은 dirty flush 타이머 종료 뒤에 있다. [갱신 시 등록](Nelyx/src/framework/widgets/framework.ts#L2084) · [commit 경계](Nelyx/src/framework/widgets/framework.ts#L1491) · [목록 비교](Nelyx/src/framework/widgets/framework.ts#L2945) · [owner 배치](Nelyx/src/runtime/owner-transaction.ts#L31)

## 3. 패치 순서와 선택 기준

### W7-1 · 중간점의 관측 계약을 정하고 기존 자식 갱신을 고친다

1. **한 입력에 대한 기준선을 확보한다.** 동일한 월·선택일·locale·테마·화면 크기에서, 두 페이지를 먼저 materialize한 뒤 35%→45%와 45%→55%를 비교한다. 역방향은 같은 상태에서 65%→55%와 55%→45%로 비교한다. 3월 최초 진입은 새 fixture에서 시작한다. 원본 fixture를 사용할 수 없으면 실제 CalendarDatePicker와 PageView를 쓰는 작은 Source fixture에 입력을 고정하고, 표시 월 콜백과 월 Element identity로 조건을 입증한다. Flutter 대조도 같은 날짜·입력·종료 조건을 쓴다. 환경이나 관측 수가 달라지면 그 차이를 적는다.
2. **계측은 설계한 경계에만 붙인다.** 부모→자식 update와 독립 dirty를 구분해 queue schedule/pop, Widget/State의 build 본문, slot·key 매칭/설정 전달, `updateRenderObject`, render owner 등록·목록 비교·실제 구조 변경을 센다. 날짜 하위와 월·헤더·Sliver를 나누고, 중첩 stack으로 자식 시간을 차감한다. flush의 callback 시간, 별도 render commit, 계측 밖 잔여 시간을 남긴다. 기존 queue observer만 사용하면 이후 동기 rebuild가 통째로 빠지므로 공통 rebuild 경계에서 어느 진입점이 호출했는지 기록한다. 같은 입력의 계측 OFF 전체 build+layout과 첫 반영 frame도 전후에 측정한다. [기존 build 계측](Nelyx/eng/windows-jank-build-profile.ts#L3) · [배타 시간 집계 예](Nelyx/eng/windows-jank-child-profile.ts#L44)
3. **프레임워크의 첫 패치는 기존 일반 자식에 한정한다.** `Element.update`의 설정 교체·검사·inherited index 처리를 예약과 분리한다. Stateless, Stateful, Proxy 및 검토한 표준 render Element가 부모 갱신 중 같은 활성 BuildScope에 있으면 앞 표의 순서로 그 자리에서 처리한다. 새 설정을 받은 clean Element도 한 번 build할 수 있어야 한다. `didUpdateWidget`와 `updated`가 끝나기 전에 자식 build가 실행되지 않게 한다. RenderObject의 설정 적용과 자식 조정을 분리해 한 update에 설정 훅이 두 번 실행되지 않게 한다. 기본 Element를 상속하는 외부 사용자, 다른 scope, build 밖 직접 `update`의 기존 진입점은 기존 지연 경로로 연결한다. 확장 타입도 계약을 입증한 경로부터 옮긴다.
4. **queued dirty의 원인을 잃지 않는다.** 부모 update가 이미 대기 중인 자식을 실제로 build하면 그 시점까지의 dirty를 소비한다. 같은 scope에 남은 항목은 pop 시 clean이면 건너뛰는 방식부터 적용한다. build 뒤 새로 발생한 invalidation은 다음 유효 처리까지 남긴다. 동일 Widget을 다시 전달했을 때는 자식 고유의 dirty를 지우지 않는다. `currentElement`의 중첩 저장·복원, `dependenciesPending`, metrics reader 귀속, `parentRebuilt`와 GlobalKey retake 정리, 오류 시 ErrorWidget 대체·회수를 기존 rebuild 경계에서 함께 수행한다. 같은 scope를 재귀 flush하지 않는다. [BuildScope](Nelyx/src/framework/widgets/framework.ts#L230) · [dirty 소비·에러 복구](Nelyx/src/framework/widgets/framework.ts#L2435) · [State 훅](Nelyx/src/framework/widgets/framework.ts#L2557)
5. **중간점의 남은 비용에서 한 곳을 선택한다.** 매칭이 지배하면 동일 참조/단일 자식 경로의 중복 검사와 임시 배열, 속성 설정이 지배하면 상위 한 타입의 setter·값 비교·할당, 구조 동기화가 지배하면 표준 Element에서 구조 보존이 확실한 경우의 owner 등록을 줄인다. 마지막 경로에서는 삽입·제거·순서 이동·자손 render 교체·GlobalKey 이동이 이전/새 owner를 깨우는지 먼저 확인한다. Table과 Viewport 같은 가상 동기화 훅에는 원래 commit을 전달한다. 패치별로 추가 시간을 가장 많이 설명한 구간과 OFF 결과를 기록한다. 큐 인출을 751회 줄인 기존 실험도 시간 개선을 보이지 않았다. [ref.md](ref.md) · [Table 훅](Nelyx/src/framework/widgets/table.ts#L65) · [Viewport 훅](Nelyx/src/framework/widgets/viewport.ts#L183)

### W7-2 · 목록 조정과 특수 Element의 갱신 경계를 맞춘다

- **목록의 뒤쪽 State 보존을 별도 패치로 적용한다.** 기존 duplicate-key 사전 검사와 일치 prefix를 유지하고, suffix는 범위만 확정한다. 가운데의 이전 무키 자식을 retire하고 키 있는 자식만 lookup한다. 새 중간과 보존한 suffix는 새 순서로 처리해 `IndexedSlot(index, previousElement)`를 계산한다. 콜백 도중 다른 부모가 retake한 자식은 매번 소유권을 재확인한다. 실패 중 새로 mount한 자식, 남은 예약, RenderObject의 순서까지 검사한다. 이 변경의 합격 기준은 Flutter와 같은 State identity 및 생명주기 순서다. 달력의 날짜 슬롯은 Sliver가 직접 조정하므로 이 패치의 성능 기여는 별도 측정한다. [기존 회귀 검사](Nelyx/eng/check-child-reconciliation.mjs#L227)
- **Sliver를 이행할 때 순서를 명시한다.** 새 widget을 설치하고 render 설정을 한 번 적용한 뒤 기존 delegate 조건을 평가한다. 이미 보유한 인덱스의 remap·update는 허용된 owner 구간에서 수행하고, 미보유 인덱스의 최초 생산·keep-alive 회수는 layout child manager가 담당한다. 수정 전·후 같은 입력에서 build로 옮겨간 시간과 layout에 남은 시간을 합산한다. `_currentlyUpdatingChildIndex`, layoutOffset, 슬롯 삽입 기준, underflow, delegate 교체·역방향 retake를 보존한다. 기존 보유 슬롯을 즉시 바꾸는 것이 render mutation 또는 재진입 계약을 깨는 경로는 전용 scope에 남기고 차이와 관찰 가능한 콜백 순서를 기록한다. [슬롯 갱신](Nelyx/src/framework/widgets/sliver.ts#L451) · [기존 슬롯 재구성](Nelyx/src/framework/widgets/sliver.ts#L490) · [필수 슬롯 생산](Nelyx/src/framework/widgets/sliver.ts#L618)
- **동기 mount는 기존 자식 update와 별도 변경이다.** Flutter 일반 Component의 첫 build는 mount 안에서 일어난다. Nelyx는 기본 mount에서 schedule하고, Stateful 하위 클래스가 뒤이어 State를 만든다. 일반 신규 자식까지 맞출 때는 State attach·initState·첫 didChangeDependencies와 render 생성·attach가 끝난 구체 타입에서 first build를 시작한다. 기존 사용자 mount override가 `super.mount` 뒤에 완료하는 초기화를 보존한다. 깊은 트리에서 Hermes 호출 스택 한계도 검사한다. `split` 준비는 비공개 세대·yield·취소·승격의 원자 단위를 유지한다. [Nelyx mount](Nelyx/src/framework/widgets/framework.ts#L1880) · [Flutter Component mount](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L5793) · [준비 작업](Nelyx/src/framework/widgets/framework.ts#L853)
- **예외 경로는 해당 계약으로 검사한다.** LayoutBuilder는 constraints를 받는 layout callback에서 builder를 호출한다. ListWheel·2D viewport·prototype extent는 자체 rebuild·자식 저장소를 가진다. InheritedNotifier는 구독 교체와 합쳐진 알림, ParentData는 자손 render에 적용되는 순서가 중요하다. 기본 클래스에 일괄 동기 rebuild를 추가하면 이 경로들의 작업이 중복되거나 너무 일찍 실행된다. [LayoutBuilder](Nelyx/src/framework/widgets/layout-builder.ts#L152) · [ListWheel](Nelyx/src/framework/widgets/list-wheel-widget-adapter.ts#L127) · [2D viewport](Nelyx/src/framework/widgets/two-dimensional-viewport-adapter.ts#L472) · [prototype extent](Nelyx/src/framework/widgets/sliver-prototype-extent-list.ts#L96) · [InheritedNotifier](Nelyx/src/framework/widgets/inherited-notifier.ts#L34)

### W7-3 · 새 월의 최초 render 설정을 완결한다

이 패치는 W7-1과 같은 기준선에서 독립 비교할 수 있다. 생성 결과와 의존성이 모두 같다고 입증한 **구체 구현**에만 기존 `_hasInitialRenderObjectConfiguration()`을 적용한다. 이용자가 상속하거나 인스턴스 훅·getter를 교체한 구현, 생성과 첫 build 사이 설정이 바뀔 수 있는 mutable options는 기존 첫 update를 실행하거나 동등성을 입증할 수 있는 입력으로 범위를 좁힌다. 생성 직후 inherited·metrics 무효화 또는 Widget 교체가 일어나면 새 설정을 한 번 적용한다. [기존 opt-in 계약](Nelyx/src/framework/widgets/framework.ts#L2747) · [기존 확장 보호 사례](Nelyx/src/framework/widgets/basic.ts#L1073)

| 구체 타입 / 기존 관측 | 소스에서 확인한 설정과 작업 |
| --- | --- |
| Semantics · 93회 | 첫 후보. create가 `getTextDirection(context)`를 읽고 `RenderSemantics` 생성자가 구조 플래그, properties, locale, host 옵션, transport ID/range/actions까지 설정한다. source와 host 호환 생성형 모두에서 첫 semantics 게시와 다음 label·action 교체를 비교한다. [Widget](Nelyx/src/framework/widgets/semantics.ts#L201) · [생성자](Nelyx/src/framework/widgets/semantics.ts#L317) |
| MouseRegion · 31회 | 생성자는 enter/exit/hover, cursor, opaque, hit-test 기본값을 넣고 첫 update가 이를 다시 전달한다. 기본값·명시값, 다음 callback 교체와 hover/exit를 검사한다. [Widget](Nelyx/src/framework/widgets/mouse-region.ts#L13) · [렌더 생성자](Nelyx/src/framework/rendering/mouse-region.ts#L44) |
| Listener · 31회 | RawGestureDetector가 import하는 source Listener는 behavior를 넣어 생성하고 생성자가 pointer/pan-zoom 콜백을 설정한다. 같은 이름의 legacy DTO Listener는 첫 update에서 `onPointer`를 설치하므로 구체 생성자를 식별해 적용한다. [실제 import](Nelyx/src/framework/widgets/raw-gesture-detector.ts#L35) · [source](Nelyx/src/framework/widgets/listener.ts#L54) · [렌더](Nelyx/src/framework/rendering/pointer-listener.ts#L132) · [legacy](Nelyx/src/framework/widgets/gesture-detector.ts#L407) |
| Padding · 31회 | `make`는 padding만 넣고 `configure`에서 Directionality 구독과 textDirection 설정을 완성한다. 생성 시 같은 context에서 두 값을 확정할 수 있도록 바꾼 뒤 opt-in한다. RTL 전환과 방향 의존 inset으로 첫 배치와 재배치를 확인한다. [Padding](Nelyx/src/framework/widgets/basic.ts#L213) |
| Center · 31회 | 상속한 Align의 `make`는 빈 RenderPositionedBox를 만든다. alignment, direction, shrink, width/height factor를 생성 단계에 한 번 적용해야 한다. Center의 기본값과 명시적 factor, Align 하위 클래스의 override를 검사한다. [Align·Center](Nelyx/src/framework/widgets/basic.ts#L242) |

217회는 제거 가능한 상한 후보다. 초기 update 호출을 create 안으로 옮긴 것만으로는 실행량이 줄지 않을 수 있다. 타입별 create+초기 설정의 합계, 유지된 31개 날짜·248개 render 객체, 첫 layout·semantics와 첫 표시 시간을 함께 본다. 기존 날짜의 정상 후속 update는 유지한다.

## 4. 검증과 완료 판정

| 검증 단위 | 통과 조건 |
| --- | --- |
| 호출 순서와 identity | 부모 아래 형제 A·B와 각각의 자손으로 Flutter/Nelyx 이벤트 열을 비교한다. `A.didUpdateWidget → A.build → A 자손 update → B.didUpdateWidget`, 동일 Widget의 slot만 바뀌는 경우, 부모·자식이 이미 dirty인 경우, inherited 통지와 setState가 겹치는 경우를 포함한다. 같은 입력에서 callback 누락·중복이 없어야 한다. |
| 구조와 복구 | 무키 suffix 삽입/삭제, 혼합 keyed/unkeyed reorder, 충돌 키·중복 키, 같은 frame의 GlobalKey 재부착, render 자손만 바뀌는 component, build 실패와 다음 frame 복구를 검사한다. 준비 세대는 취소·승격 후 공개 트리와 자원 소유권이 일치해야 한다. |
| 달력 기능 | 기존 날짜의 Element·State·FocusNode identity, 월별 콜백 순서/횟수, 키보드 날짜 이동, 클릭과 확정값, disabled 날짜, 접근성 label/selected/action, locale·방향·resize·닫기/재열기를 대조한다. 회수된 월이 나중에 새 State로 생성되는 정상 수명도 확인한다. |
| 변경별 성능 | 기준 → 기존 자식 갱신만 → 초기 설정만 → 통합을 같은 조건에서 비교한다. 목록·Sliver 등 큰 변경은 각각의 기능·시간 차이를 먼저 기록한다. 정·역방향 모두 대조 구간, 중간점, cold 첫 표시를 구별하고 계측 OFF 중앙값과 범위·최장 지연을 제시한다. 특정 phase 단축이 다음 phase로 이동했는지 입력→표시 전체 지연과 정착 월로 판별한다. |
| Windows 제품 | 동일 Source/dist/설치 패키지·실행 bundle 계보를 확인하고 같은 기기·viewport/DPI·빌드 모드에서 기준/후보를 번갈아 각 3회 실행한다. 기본 direct Hermes bytecode `legacy`를 판정하고 `split`의 기능·준비 경계도 확인한다. W6의 보통/약 2배 정방향/약 2배 역방향 입력과 정착 월을 유지한다. 엔진 및 desktop marker 관측 FPS 각 30 이상, ≥100ms 프레임 간격과 진행 정체 각 0회, >50ms 빈도·시간 및 입력→surface 꼬리 지연, Gallery·Testbed 회귀 여부를 함께 기록한다. [기존 합격 기준·입력](work6.md#L68) |

아래는 **구현 후** 사용할 기존 진입점이다. Source 검사는 관련 변경을 묶어 수행하고, Windows 실행 전에는 Demo/Testbed 공급을 갱신한다. 저장소 지침대로 검사별 20분 제한을 적용하고 해당 실행의 임시 산출물을 정리한다. [저장소 지침](.github/copilot-instructions.md) · [공급·제품 비교 절차](work6.md#L63)

```powershell
npm.cmd run build:core
npm.cmd run check --workspace @nelyx/core
node Nelyx/eng/check-child-reconciliation.mjs
node Nelyx/eng/check-source-framework.mjs
node Nelyx/eng/check-inherited-ancestor.mjs
node Nelyx/eng/check-frame-publication.mjs
node Nelyx/eng/check-frame-publication.mjs --subtree-preparation
node Nelyx/eng/check-semantics-geometry.mjs
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -Preparation legacy -Runs 3
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -Runs 1
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -App testbed -Scenario list -Runs 1
```

완료 기록에는 **Flutter 갱신 순서 일치 범위**, **기존 월 중간점 지연**, **새 월 첫 표시 지연**, **Windows 제품 목표**를 각각 판정한다. 순서가 일치하고 제품 성능이 그대로라면 호환성 수정으로 기록한다. 양방향 제품 기준까지 통과할 때 성능을 수락한다. 제품 판정 전까지 `performanceAccepted=false`로 둔다.

## 5. 구현 및 검증 결과

- **일반 자식:** 같은 활성 BuildScope에서 부모가 전달한 설정은 `didUpdateWidget`/`updated` 뒤 기존 rebuild 경계에서 처리한다. 관측 이벤트는 `A.update → A.build → A.child → B.update → B.build → B.child`였다. 부모와 자식이 모두 dirty인 경우 중복 build가 없고, B 갱신 시 A를 다시 무효화하면 A가 한 번 더 build된다. 동일 Widget 전달은 독립 dirty를 소비하지 않는다. [Source 회귀](Nelyx/eng/check-source-framework.mjs) · [Flutter 대조](Nelyx/eng/flutter-parent-update-order_test.dart)
- **범위:** 정확한 표준 Stateless/Stateful, Inherited/ParentData, 일반·Leaf·Single·Multi render Element에 한정한다. 첫 build는 State 초기화 또는 render attach 뒤 시작한다. 사용자 정의 Element, 다른 scope, build 밖 직접 update, 미공개 준비 세대는 예약 경로를 유지한다. 깊은 트리는 인라인 32단에서 큐로 이어지므로 그 경계까지 Flutter와 완전히 동일한 순서를 보장하는 것은 아니다. 가상 render commit 및 동적 `childWidgets` 처리는 유지했다. [실제 Hermes bytecode 검사](Nelyx/eng/check-hermes-deep-tree.mjs)에서 128단 Builder의 mount·update 모두 인라인 깊이 32에 도달한 후 큐로 세 번 이상 이어졌고, 스택 초과 없이 같은 leaf Element를 유지했다.
- **구조와 예외:** 목록은 prefix와 suffix를 보존하고 가운데의 keyed 자식만 검색한다. 기존과 같은 순서로 남는 suffix 자식은 새 slot과 이전 형제가 결정된 후 갱신한다. 무키 suffix 삽입/삭제, GlobalKey 재부착, 키 충돌 및 실패 정리 검사를 통과했다. Sliver는 설정 적용 뒤 delegate를 판정하지만 기존 슬롯의 자식 갱신은 layout에 남겼다. 부모 update에서 scope 진입과 render 변경을 시도하면 보호 검사가 거부한다. 역순으로 이동한 세 자식은 identity를 유지했고 네 번째 자식은 offset 75에 한 번 생성됐다. LayoutBuilder·ListWheel·2D·prototype·InheritedNotifier·ParentData 회귀도 확인했다. [목록 검사](Nelyx/eng/check-child-reconciliation.mjs) · [특수 Element 검사](Nelyx/eng/check-source-framework.mjs)
- **첫 설정:** Semantics, MouseRegion, source Listener, Padding, Center의 검토한 구성만 opt-in한다. 사용자 정의 getter/hook, mutable 옵션 등 동등성이 불명확한 경우에는 첫 훅을 실행한다. 생성 이후의 무효화는 첫 훅 생략 대상이 아니다. 각 타입의 첫 생략과 다음 갱신 1회, RTL, semantics와 입력 callback 교체를 Source와 Hermes lowering에서 확인했다. [렌더 초기화 검사](Nelyx/eng/check-render-initialization.mjs)
- **달력 기능:** [현재 Source 상호작용 검사](Nelyx/eng/check-calendar-interaction.mjs)에서 1·2월 59개 날짜의 Element·State·FocusNode를 유지했고, 회수 후 돌아온 1월 31개는 모두 새 identity였다. 월 콜백은 `[2, 1, 3, 1]`이었다. LTR·RTL 키보드 이동과 비활성 날짜 건너뛰기, 클릭·resize 후 1월 17일 확정, 접근성 label·selected·action, locale 전파와 좌우 반전, 다시 열기·취소를 확인했다. 아랍어 날짜 번역이나 브라우저 haptics를 검증했다는 뜻은 아니다.
- **공통 검사:** Core·Material 빌드 및 타입 검사, 자식 조정·Source framework·inherited ancestor·frame publication·subtree preparation·semantics geometry 검사를 통과했다. 준비의 yield·취소·승격·게시 경계를 그대로 검사했다.

### Source·Flutter 측정

**판정:** 같은 입력에서 기존 월의 갱신 순서는 바뀌고 새 날짜의 중복 render 설정은 사라졌다. 그러나 양방향 중간점이나 cold 첫 장면이 일관되게 빨라졌다는 증거는 없다. Source CPU 측정은 Windows 제품 FPS 판정이 아니다.

**조건:** Windows, Node 24.15.0/V8. [Source fixture](Nelyx/eng/calendar-midpoint-fixture.mjs)는 실제 `CalendarDatePicker`와 내부 `PageView`를 사용한다. 360×400, DPR 1, `en-US`, light, 2025년 1~3월, 오늘 1월 15일. 정·역방향은 각각 새 fixture에서 1월 15일을 선택하고 35% 또는 65%로 먼저 이동해 1·2월을 만든다. `jumpToWithoutSettling`과 16ms 가상 frame 하나로 끝낸다. 대조/교차 전후 두 월 Element는 동일했고 월 콜백은 대조 0회, 교차 정방향 `[2]`·역방향 `[1]`이었다. Cold는 2월 15일 선택의 새 fixture에서 2월 단독 → 2월+3월(10% 노출), 월 변경 콜백 0회. Nelyx는 첫 장면에서 날짜 48×48, 새 March semantics label 5개였고 재구성 기준/후보 간 label·role·상태가 같았다. 텍스트 폭·폰트·플랫폼 전송은 테스트 대역이다. 모의 시계가 아니라 실제 경과 시간을 쟀다.

**계측 OFF:** 내부 계측 없이 `flushBuild`와 `flushLayout` 호출 시간만 합한 값(BL), 입력 직전부터 첫 CPU Scene 반환·해제까지(S). 각각 1회 워밍업 후 버전 실행 순서를 번갈아 6쌍 측정했다. `471df5eb`와 설계 기준 `0b934a96`의 core/material Source 차이는 없다. 재빌드 전에 기존 dist JS 921개(집합 해시 `7ed6be7a59c2…`)를 메모리에 고정한 최초 BL 중앙값은 정방향 교차 29.93→28.38, 역방향 24.28→25.97, cold 38.86→49.59ms였다. 아래는 동일 기준 Source를 메모리에서 재구성해 범위까지 검증한 별도 실행이다. 백그라운드 빌드·제품 측정이 있는 공유 데스크톱으로 실행 간 편차가 크다. 서로 다른 실행의 표본을 섞지 않았다.

| 입력 | BL 기준 → 통합, 중앙값 [최소–최대] ms | S 기준 → 통합, 중앙값 [최소–최대] ms | Flutter pump, 중앙값 [최소–최대] ms |
|---|---|---|---|
| 정 대조 35→45% | 0.26 [0.25–0.47] → 0.24 [0.22–0.25] | 3.91 [3.55–4.88] → 3.89 [3.56–12.44] | 4.09 [3.91–4.65] |
| 정 교차 45→55% | 19.91 [18.41–24.63] → 20.87 [19.74–35.62] | 27.94 [26.22–36.25] → 29.93 [27.87–44.81] | 32.70 [25.32–58.82] |
| 역 대조 65→55% | 0.28 [0.23–0.30] → 0.29 [0.25–0.41] | 3.68 [3.34–4.92] → 3.90 [3.13–5.50] | 4.03 [2.98–7.79] |
| 역 교차 55→45% | 20.31 [17.53–24.21] → 20.71 [19.01–33.62] | 30.14 [24.95–36.78] → 32.59 [27.10–43.44] | 30.96 [22.24–41.67] |
| 3월 cold | 27.15 [23.36–41.52] → 29.25 [25.32–35.92] | 33.70 [29.21–48.04] → 36.34 [31.49–43.66] | 33.38 [25.30–35.30] |

Flutter 3.50.0 (`ab2912035e`, Dart 3.14.0) 테스트 엔진, 워밍업 1회+5회. 같은 날짜·테마·viewport·입력·종료 조건, 월 identity와 콜백을 검사했다. Flutter 값은 입력+`WidgetTester.pump` 벽시계이며, Nelyx BL·S와 동일한 phase나 display/GPU 완료가 아니다. Flutter 부모 갱신 순서 oracle도 같은 실행에서 통과했다.

**분리 실험:** 아래 각 행은 같은 프로세스에서 상태를 독립시킨 두 모듈 그래프의 6쌍이다. Δ는 각 쌍의 `후−전`을 구한 뒤의 중앙값·범위이므로 두 중앙값을 뺀 것과 다를 수 있다. 부모 갱신만 실험할 때 mount·단일/목록 조정·예약 함수와 나머지 모듈은 기준 구현을 썼다. 초기 설정만은 5가지 Widget과 두 실제 생성 경로의 변경을 함께 적용했다. 모두 진단용 조합이며 별도 제품 빌드는 아니다.

| 변경 / 입력 | BL 중앙값 전→후 ms | BL 쌍 Δ 중앙값 [범위] ms | S 중앙값 전→후 ms | S 쌍 Δ 중앙값 [범위] ms |
|---|---:|---:|---:|---:|
| 부모 갱신만 / 정 교차 | 30.60→28.00 | +3.18 [−7.10,+9.49] | 45.31→42.28 | +3.04 [−9.44,+4.54] |
| 부모 갱신만 / 역 교차 | 26.66→24.83 | +1.37 [−10.96,+27.77] | 37.17→35.70 | −0.60 [−11.36,+30.73] |
| 초기 설정만 / cold | 39.31→36.33 | −2.05 [−5.31,+2.88] | 49.98→45.73 | −4.43 [−15.60,+0.33] |
| 나머지 W7 적용 뒤 초기 설정 추가 / cold | 41.20→43.01 | −0.15 [−7.34,+16.19] | 49.73→50.53 | −3.08 [−7.56,+15.20] |
| 통합 위에 단일 자식 배열 재사용 실험 / 정 교차 | 24.44→26.81 | +1.40 [−0.42,+10.25] | 33.74→37.26 | +2.78 [−1.47,+13.77] |
| 같은 실험 / 역 교차 | 23.69→22.16 | −0.97 [−4.25,+3.45] | 33.77→32.15 | −3.21 [−8.70,+2.87] |

**계측 ON:** [중첩 계측](Nelyx/eng/calendar-midpoint-intervals.mjs)은 공통 rebuild에서 진입 원인을 구분하고, 각 행에 `[횟수, 배타 ms, 포함 ms]`를 낸다. 실제 Widget/State `build`, render create/update는 호출 지점에서 관측해 opt-in 훅 identity를 바꾸지 않는다. 포함 시간은 합산하지 않는다. 다음은 입력별 1회 진단이며 OFF 성능 판정에 넣지 않았다.

- 정 교차 날짜 subtree: `_Day.build` 59회와 하위 render update 531회(양쪽 동일). 전체 날짜 subtree build 본문 590회, 배타 6.98→14.84ms. 기준의 단일/목록 매칭+설정 전달 7.13ms, render update 4.93ms, 부모 schedule+pop 1.07ms였다. 통합에서는 1,298개가 부모 경로로 즉시 rebuild되고 59개가 dirty 경로로 처리됐다. 부모 원인 schedule/pop 1,357/1,357→59/59; 독립 schedule 59회는 남았다. render owner 등록 1,357회, 실제 owner 예약 시도 944회, 자식 비교 531회, 날짜 하위 link/unlink 0회는 양쪽 같았다. scope 밖 비용과 빌드 본문을 queue 비용에 포함하지 않았다.
- 같은 정 교차의 월·헤더·Sliver build 본문 배타 시간은 기준 4.21/0.66/0.22ms, 통합 6.27/0.87/0.32ms였다. Sliver 범주의 flush 합계 포함 시간은 37.58→54.87ms(그 안 scope callback 0.020→0.021ms). 별도 render commit 포함 시간은 약 1.46→1.74ms. 최상위 build/layout 포함 시간 13.24/42.03→19.00/60.91ms, 진단 밖 잔여 16.00→16.09ms였다. 역 교차 build/layout 6.59/31.93→8.83/40.09ms, 잔여 10.51→14.06ms. 이 숫자는 계측 오버헤드도 포함한다.
- 선택한 W7-1.5 후보는 매칭 뒤 기존 단일 자식이 같을 때 `children` 배열 할당을 생략하는 것이었다. 위 OFF에서 두 방향 결과가 엇갈려 **채택하지 않았다**. 구조 커밋 억제나 날짜 build 생략도 적용하지 않았다.
- Cold 날짜 하위: 두 버전 모두 31일·render 생성 279회. 기준 초기 update 248회(Semantics 93, MouseRegion 31, Listener 31, Padding 62, Center 31) → **0회**. 생성+초기 update의 배타 합은 4.99+0.78→5.67+0.00ms였다. Flutter의 cold 장면에도 동일한 279개 render Element(같은 248개+RichText 31)가 있었다. Flutter 값은 첫 장면의 생존 객체 census이지 create 훅 시간을 뜻하지 않는다. 이 fixture에는 날짜마다 Padding이 두 개여서 §1의 과거 248개 생성·217개 update를 그대로 재현한 것이 아니다.

재현(체크당 20분 제한, 과거 패키지/로그/Flutter 프로젝트 보관 없음). `--before` 등은 지정 커밋과 **작업 트리**의 차이를 사용하므로 변경이 커밋된 뒤에도 동작한다. 재구성 모듈은 현재 Source의 TypeScript emit이 실제 dist와 일치하는지 먼저 확인한다.

```powershell
npm.cmd run build:core
npm.cmd run build --workspace @nelyx/material
$probe = 'Nelyx\eng\calendar-midpoint-profile.mjs'
node $probe --before 471df5eb
node $probe --parent-only 471df5eb
node $probe --cold-only 471df5eb
node $probe --cold-before 471df5eb
node $probe --trial-single-child
node $probe --diagnose-before 471df5eb
node $probe --diagnose
node Nelyx\eng\check-flutter-calendar.mjs
```

### Windows 제품 측정

**판정: `performanceAccepted=false`.** 빠른 역방향 엔진/desktop FPS 중앙값은 19.263/18.091에서 22.384/20.242로 올랐지만 후보 세 번 모두 30 FPS 미만이었다. 세 입력 구간 모두에서 100ms 이상 프레임 간격과 진행 정체가 남았다. 빠른 정방향 desktop 중앙값은 오히려 22.138→19.967이었다. 달력의 월 정착이나 입력 보존 실패는 없었다.

**조건·계보.** Windows 콘솔의 동일 기기·전경, 최대화 surface 2560×1459, 192 DPI, 165Hz. direct Hermes JSI optimized bytecode, native surface-copy fence와 desktop frame marker, 진단/프로파일 OFF. 보통 정방향/빠른 정방향/빠른 역방향 각각 60Hz touch 48/30/60개, 6/6/12개 제스처, 실제 정착 +4/+3/−6개월. 각 검사는 20분 제한. `471df5eb` 작업 시작 시 기존 Demo 설치본의 Core JS 전체(646개)가 당시 dist와 일치했다. 초기 Testbed 설치본은 달라서 그 smoke는 아래 비교에서 제외하고 Demo의 같은 기준 Core·Material 공급으로 갱신했다. 후보는 조율한 Core→Material 빌드 뒤 양쪽 Windows runner에 두 패키지만 공급·재설치했다. 후보 Source emit 확인 통과; Core 647개 및 Material 275개 JS 트리가 각각 dist와 두 설치본에서 일치했다.

다음은 SHA-256 **앞 16자리**, 기준→후보. Core tgz `0b6875550a63fe15`→`9334ec5992ed197e`, Material tgz `a103626570b935ce`→`06f81b86ee93d090`, 공통 설치 SDK 입력 `f669b27236d3ea54`→`bb6df5ab6aa4e1e0`. 실제 실행 HBC: 달력 legacy `40b934eadc53dc7f`→`3a8f04450fdd1a6d`(각 3회 불변), split `7a7b73f39c1d32fc`→`5cbaf95dfb08f8a9`, Gallery `f8744a8c80b65d22`→`e80f1e5095c67cef`, Testbed list `c87754b4533e4595`→`b8addd2499f7c871`, mixed `bc223c2f655b543d`→`db2eff513cedf302`. Hermes toolchain `003eba84c3f3a322`. 공유 작업공간에 기존 `.windows-jank-probe.ts`가 있어 수정·삭제하지 않았다. 같은 [실행기](Nelyx/eng/check-windows-jank.mjs)의 child에서 실행별 소유 entry/output 이름만 바꿨고, 기준·후보 모두 동일한 이름·계측·입력을 사용했다. 이전 공급을 별도로 보관하지 않아 **기준 3회 후 후보 3회**이지 교차 반복은 아니다. 따라서 성능 차이를 패치 단독 효과로 확정하지 않는다.

**Legacy · 3회.** FPS는 실행별 값(각 행의 최솟값~최댓값이 범위). 나머지는 3회 최솟값~최댓값. E=엔진, D=desktop marker 하한. `>50`은 구간당 횟수와 해당 간격의 총 ms, `≥100`은 프레임 간격 횟수와 진행 정체 횟수다.

| 입력 | 판 | E FPS (1/2/3회) | D FPS (1/2/3회) | >50 E 횟수; 총 ms | >50 D 횟수; 총 ms | ≥100 E 간격; 정체 | ≥100 D 간격; 정체 |
|---|---|---|---|---|---|---|---|
| 보통 정방향 | 기준 | 31.548/34.708/29.388 | 26.835/30.351/25.276 | 8–9; 921.250–1037.655 | 8–9; 925.864–1024.754 | 5–7; 6–8 | 4–7; 5–8 |
| | 후보 | 32.671/33.220/32.489 | 29.267/30.436/25.704 | 9; 964.120–1021.689 | 9; 992.730–1024.743 | 6–8; 6–8 | 6–7; 6–7 |
| 빠른 정방향 | 기준 | 25.086/31.469/27.547 | 22.138/27.861/21.737 | 5–6; 683.564–773.766 | 5–6; 688.005–799.663 | 3–5; 5 | 4–5; 4–5 |
| | 후보 | 27.674/19.672/27.344 | 21.761/18.555/19.967 | 5–6; 663.423–786.306 | 5–6; 731.105–804.441 | 5; 5 | 4–5; 5 |
| 빠른 역방향 | 기준 | 18.864/19.263/23.950 | 18.091/15.879/19.986 | 7–9; 1106.587–1251.844 | 7–10; 1112.596–1251.462 | 6–8; 6–8 | 5–8; 7–8 |
| | 후보 | 22.384/26.346/16.838 | 20.242/23.546/14.776 | 7–8; 1122.221–1209.827 | 8–9; 1176.970–1280.558 | 6–7; 6–7 | 6–8; 6–8 |

**표시 지연(ms).** 각 셀은 3회 각각에서 구한 분위수의 최솟값~최댓값(표본을 합치지 않음). 이 측정에서는 각 실행의 p99가 최장과 일치했다. 입력→surface는 native fence까지이며 물리 scanout까지의 지연이 아니다.

| 입력 | 판 | E 간격 p95; p99=최장 | D 간격 p95; p99=최장 | 입력→surface p95; p99=최장 |
|---|---|---|---|---|
| 보통 정방향 | 기준 | 118.255–155.537; 143.925–186.850 | 118.042–166.287; 139.665–179.056 | 233.648–332.512; 244.142–349.512 |
| | 후보 | 121.335–127.784; 136.004–159.056 | 122.737–130.164; 139.263–155.512 | 251.300–260.627; 260.784–272.363 |
| 빠른 정방향 | 기준 | 174.866–200.473; 177.868–202.124 | 176.019–196.694; 179.567–200.314 | 348.055–404.042; 348.055–404.042 |
| | 후보 | 130.249–193.128; 193.128–214.081 | 145.256–198.738; 198.738–211.364 | 387.051–422.898; 387.051–422.898 |
| 빠른 역방향 | 기준 | 182.923–201.062; 194.162–238.649 | 175.705–203.622; 200.601–244.325 | 383.276–499.151; 385.283–515.151 |
| | 후보 | 183.199–273.671; 200.077–318.904 | 188.822–279.756; 193.065–320.255 | 374.455–566.099; 393.158–582.099 |

**Split · 각 1회, 기능·준비 경계.** E/D FPS(보통/빠른 정방향/역방향): 기준 34.099/28.013, 26.842/22.802, 21.861/18.326 → 후보 32.701/27.227, 25.540/22.801, 18.587/17.211. 후보 E/D ≥100ms 간격은 6/6, 4/4, 5/6회, 진행 정체는 7/7, 5/5, 6/7회. 입력→surface 최장은 기준 274.341/356.787/467.158ms → 후보 290.174/395.123/513.080ms. 양쪽 모두 +4/+3/−6, 입력 158/158, 시작 4·게시 3·취소 1·강제 1, 종료 시 active/elements/producer 모두 0. budget miss 1→0. Legacy는 준비 시작 0. Split은 제품 성능 수락을 대체하지 않는다.

**Gallery·Testbed · 각 1회.** 순서는 cold down/return up/warm down. Gallery E/D FPS 기준 76.024/65.062, 81.526/59.616, 86.755/60.791 → 후보 83.273/78.044, 87.676/59.789, 87.791/62.109. Testbed list는 88.967/75.672, 90.216/58.964, 92.423/62.490 → 92.437/79.880, 100.788/61.339, 90.096/59.715. 둘 다 모든 구간 E/D ≥100ms 간격·진행 정체 0회 유지. Gallery 후보 return에서 desktop >50ms 1회(60.065ms; 기준 0); list는 전 구간 >50ms 0회 유지. UIA 목록 멤버십 왕복, mixed 카운터·한글/이모지 편집·스크롤 통과(양쪽 입력 121/121, 정상 종료). 후보 추가 native boundaries 검사 정상 종료. 모든 측정의 수신 입력은 전부 수락됐다. 단일 smoke로 일반적 무회귀를 보증하지 않으며 물리 trackpad·실제 scanout은 측정하지 않았다. 자체 생성한 probe·번들·임시 디렉터리는 정리했고 과거 설치본이나 원시 로그는 보관하지 않았다.
