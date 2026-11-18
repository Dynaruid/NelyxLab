# W7 · 부모가 전달한 위젯의 갱신 순서와 달력 월 전환 비용

2026-11-18 · Nelyx 기준 `0b934a96` · **설계 완료 / 구현·성능 검증 대기**

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

완료 기록에는 **Flutter 갱신 순서 일치 범위**, **기존 월 중간점 지연**, **새 월 첫 표시 지연**, **Windows 제품 목표**를 각각 판정한다. 순서가 일치하고 제품 성능이 그대로라면 호환성 수정으로 기록한다. 양방향 제품 기준까지 통과할 때 성능을 수락한다. 현재 W7은 소스 대조와 설계 단계이며 `performanceAccepted=false`다.
