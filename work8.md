# W8 · Flutter의 달력 생성·갱신 순서를 유지하는 Nelyx 렌더링 성능 계획

2026-11-18 · 코드 기준 `d6cfa40e` · 설계 단계 · `performanceAccepted=false`

**첫 후보는 새 월을 만드는 동안 Nelyx가 같은 렌더 조상을 몇 번씩 확인하는 비용이다.** Flutter의 Material 달력처럼 PageView가 월을 요청하고, 그 월의 Grid가 정해진 인덱스 범위의 날짜를 만들도록 한다. 3월이 10% 드러난 W7 장면에서도 31일 전체가 생성되는 것이 기준이다. 두 월이 이미 보일 때도 부모 갱신, delegate의 기존 슬롯 재조정, 날짜 build를 그대로 실행한다. 이번 계획에서 바꾸는 것은 이 호출들을 처리하는 Core와 Hermes 쪽의 비용이다. [Flutter 날짜 목록](reference/flutter-master/packages/flutter/lib/src/material/calendar_date_picker.dart#L1143) · [Flutter Grid의 범위](reference/flutter-master/packages/flutter/lib/src/rendering/sliver_grid.dart#L606) · [W7 첫 장면](work7.md#L135)

## 1. Flutter는 무엇을 더 싸게 하는가

| 비교점 | Flutter에서 확인한 동작 | Nelyx에서 내릴 수 있는 판단 |
| --- | --- | --- |
| 기존 트리의 재사용 | 같은 Widget을 다시 받으면 기존 Element를 사용하고 불필요한 하향 갱신을 멈춘다. layout도 깨끗한 자식에 같은 제약이 오면 이전 결과를 활용한다. | Nelyx에도 동일 Widget을 알아보는 경로와 규칙 Grid 배치 재사용이 있다. 월마다 새 날짜 목록과 Widget이 공급되면 동일 참조 경로를 쓰기 어렵다. [Flutter 설계](https://docs.flutter.dev/resources/inside-flutter) · [Flutter updateChild](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L4032) · [Nelyx 자식 조정](Nelyx/src/framework/widgets/framework.ts#L2185) · [Nelyx Grid 재사용 조건](Nelyx/src/framework/rendering/sliver-grid.ts#L421) |
| 달력의 작업 단위 | Flutter의 Material 달력도 날짜 목록을 만들고 세로 Grid에 넘긴다. Grid는 자신의 **주 스크롤 축**에서 처음·마지막 인덱스를 구한다. W7의 Flutter cold 장면에도 날짜 아래 render Element 279개가 살아 있었다. | Flutter가 이 사례에서 날짜 트리를 작게 만든다는 설명은 성립하지 않는다. 같은 날짜 트리가 첫 장면에 생기는 조건을 고정하면, 생성과 연결의 실행 비용을 비교할 수 있다. [Flutter 달력](reference/flutter-master/packages/flutter/lib/src/material/calendar_date_picker.dart#L1143) · [Flutter Grid](reference/flutter-master/packages/flutter/lib/src/rendering/sliver_grid.dart#L606) · [W7 cold 대조](work7.md#L135) |
| UI 코드 실행 | 네이티브 배포용 Dart는 x64·ARM 기계어로 AOT 컴파일할 수 있다. Nelyx의 Windows 기준은 생성된 TypeScript에서 온 최적화 Hermes bytecode다. 날짜 생성 하나에도 값 키, 정수 검사, 위젯의 final 필드 보호와 동적 메서드 호출이 있다. | 같은 수의 Widget을 방문해도 CPU 비용은 다를 수 있다. 과거 **같은 앱 JS와 renderer**의 3회 교차 실험에서 빠른 역방향 desktop FPS 하한 중앙값은 Hermes 22.373, JSC interpreter 8.693, JIT 허용 37.566이었다. JIT에서도 100ms 이상 표시 진행 정체 중앙값은 2회였다. 실행 방식이 이 부하에 영향을 준다는 직접 근거다. Flutter AOT의 기여율이나 현재 W7 공급의 성능 차이는 이 실험으로 산출할 수 없다. [Dart 네이티브 컴파일](https://dart.dev/overview) · [Nelyx 날짜 생성](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1943) · [필드 보호 구현](Nelyx/src/ui/value-math.ts#L100) · [동일 renderer 실험](work2.md#L883) |
| 장면 생성과 GPU | Flutter는 UI 쪽에서 layer tree를 만들고 raster 쪽에서 GPU에 그린다. 변경이 없는 engine layer를 다음 Scene에 재사용할 수 있다. Impeller의 사전 셰이더 컴파일은 raster 쪽 지연을 줄이는 수단이다. | Nelyx도 repaint boundary의 기록을 재사용하지만 다음 Scene의 build는 동기 경로다. W6의 빠른 역방향 한 프레임은 layout 199.679ms 중 dirty rebuild 배타 시간이 142.840ms였다. 이 프레임을 고칠 첫 지점은 자식 생산이다. 이후 CPU Scene이 제때 나와도 표시가 늦으면 submit·fence·desktop 순으로 확인한다. [Flutter UI·raster](https://docs.flutter.dev/perf/ui-performance#review-the-threads) · [Flutter retained layer](reference/flutter-master/packages/flutter/lib/src/rendering/layer.dart#L708) · [Impeller](https://docs.flutter.dev/perf/impeller) · [Nelyx retained paint](Nelyx/src/framework/rendering/retained-paint.ts#L27) · [Nelyx Scene 생산](Nelyx/src/hosting/runtime.ts#L718) · [W6 frame 176](work6.md#L202) |

**이 Windows 기기에서 Flutter가 얼마나 빠른지는 아직 미측정이다.** W7의 정방향 중간점에서 Flutter의 입력과 테스트 엔진 `pump`는 32.70ms, Nelyx의 Node/V8 입력부터 첫 CPU Scene까지는 29.93ms였다. 런타임도 끝점도 다르다. 제품 표시 성능으로 확인된 것은 Nelyx의 빠른 역방향 엔진/desktop 중앙값 **22.384/20.242 FPS**, 후보 3회 각각의 desktop 최장 간격 **193.065~320.255ms**다. 같은 후보의 Gallery와 Testbed 목록에서는 100ms 이상 표시 간격과 진행 정체가 관측되지 않았다. 따라서 달력에서 큰 단위로 발생하는 작업을 먼저 겨냥한다. [W7 테스트 조건과 시간](work7.md#L103) · [Windows 결과](work7.md#L155)

## 2. 같은 입력에서 보존할 동작

| 입력 | Flutter에서 기준으로 삼을 동작 | Nelyx에서 확인할 결과 |
| --- | --- | --- |
| 2월에서 3월을 처음 10% 노출 | PageView 안의 Grid가 자신의 주축 제약으로 연속 슬롯을 요청한다. 월 경계 진입과 표시 월 변경 통지는 서로 다른 사건이다. | 31일과 W7에서 확인한 날짜 아래 render 객체 279개가 첫 장면에 존재한다. 같은 입력에서 월 변경 콜백 0회, 같은 날짜 bounds·semantics·hit target을 확인한다. |
| 이미 존재하는 1·2월의 중간점 통과 | 부모가 새 구성을 전달하고 delegate가 기존 자식을 갱신한다. 호환되는 타입·키는 Element와 State를 보존한다. | 표시 월 콜백은 정방향 [2], 역방향 [1]. 같은 59개 날짜의 Element·State·FocusNode, 클릭·키보드 선택·안내를 확인한다. 날짜 build와 render 설정 호출은 기준선과 대조한다. |
| 역전·회수·재진입 | 기존 keep-alive 및 실제 슬롯 회수 조건에 따라 자식이 빠지고, 필요하면 재생성된다. | 회수된 날짜의 dispose와 재진입 시 새 identity, 활성 포인터와 포커스, 접근성 액션의 대상을 대조한다. 빠른 역방향에서는 생성·갱신·회수 시간을 한 프레임 안에서도 구분한다. |

이 기준에서 보이는 열부터 mount하는 방식은 생성 시점을 바꾸고, 날짜 Widget을 별도로 캐시하는 방식은 부모가 새 설정을 전달할 때 실행되는 build를 바꾼다. 두 제안은 이번 실행 계획에서 철회했다. 위 수치는 W7의 특정 날짜·테마·크기에서 얻은 관측값이다. [W7 Source와 Flutter 조건](work7.md#L103) · [달력 상호작용 검사](Nelyx/eng/check-calendar-interaction.mjs)

한 가지 기존 차이도 비교에 남겨야 한다. Flutter Sliver는 delegate 교체 조건을 만족하면 `update` 안에서 기존 슬롯을 재조정하고, 새 슬롯은 layout의 `createChild`에서 만든다. Nelyx W7은 기존 슬롯 조정도 layout까지 미룬다. 일반 자식의 동기 갱신 역시 Hermes에서 깊이 32 이후 큐로 이어진다. 이 때문에 양쪽의 ‘layout ms’에 포함된 일이 다르다. 구현 호환성을 좁힐 때는 Flutter와 콜백·slot·render 변경 순서를 먼저 대조하고, 성능은 동일 입력에서 첫 완성 Scene까지로 판단한다. [Flutter Sliver](reference/flutter-master/packages/flutter/lib/src/widgets/sliver.dart#L953) · [Nelyx Sliver](Nelyx/src/framework/widgets/sliver.ts#L372) · [W7 갱신 순서와 한계](work7.md#L94)

## 3. 첫 패치 후보 · layout 변경을 허용한 조상의 반복 탐색 줄이기

**코드에서 확인한 차이.** Flutter의 렌더 트리에는 변경 허용 여부나 순환 여부를 `assert` 안에서 조상을 따라 확인하는 경로가 있다. Nelyx는 활성 layout 중 자식 삽입이나 layout 속성 변경 시 `layoutMutationAllowed()`를 런타임에서 호출한다. 소유자가 일치하면 현재 노드에서 callback의 root까지 parent를 따라 올라간다. 한 layout callback 안에서 날짜의 여러 겹을 차례로 붙이면 서로 겹치는 조상 경로를 반복해서 읽을 수 있다. W6의 142.840ms는 전체 dirty rebuild의 배타 시간이고, 이 검사 하나의 시간은 아직 모른다. [Flutter 변경 검사](reference/flutter-master/packages/flutter/lib/src/rendering/object.dart#L2342) · [Flutter adoptChild](reference/flutter-master/packages/flutter/lib/src/rendering/object.dart#L2171) · [Nelyx 허용 판정](Nelyx/src/framework/rendering/object.ts#L1552) · [Nelyx 자식 변경](Nelyx/src/framework/rendering/object.ts#L1809)

**작은 구현 단위.** 활성 callback 하나에서 같은 표준 render 객체의 **성공한 소속 판정**만 재사용하는 후보부터 작성한다. callback과 owner가 같고 그 사이 기존 부모 연결이 끊기거나 이동하지 않았을 때만 유효하다. 새 자식 추가는 이미 확인한 부모의 조상을 바꾸지 않는다. detach·reparent·실패 복구는 첫 연결 변경 전에 기존 판정을 무효화하고, 중첩 callback은 별도 범위를 쓴다. 사용자 정의 getter·훅, scope 밖 dirty 객체, 오류 경로에는 기존 판정을 호출한다. callback 종료 때 저장한 참조를 해제한다. 날짜 생성, render attach, layout, paint와 접근성 게시 순서는 동일하게 둔다. [callback 범위](Nelyx/src/framework/rendering/object.ts#L1583) · [연결·회수](Nelyx/src/framework/rendering/object.ts#L1729)

**채택 조건.** 소스 대조 뒤 진단 한 번으로 호출 수, 실제 parent 방문 수, 같은 callback의 재사용 가능 횟수와 검사 배타 시간을 본다. 중첩·조상 이동·예외 재진입에서 기존 판정과 결과가 달라지면 후보를 폐기한다. 전체 검사 시간을 절약해도 긴 프레임을 의미 있게 줄일 여지가 작으면 여기서 종료한다. 가능성이 있을 때만 계측을 끄고 새 월 첫 Scene과 역방향 전체 시간을 비교한다.

## 4. 다음 후보 · Flutter처럼 구조가 변할 때 렌더 자식을 연결하기

Flutter의 표준 RenderObjectElement는 attach·slot 이동·detach에서 부모의 insert·move·remove를 호출한다. Nelyx도 이 훅을 호출하지만 일반 `Element.rebuild`에서 render owner를 동기화 대상으로 등록하고, 뒤의 commit에서 예상 자식 목록과 실제 목록을 비교한다. W7의 정방향 중간점 1회에서는 날짜 하위 render 설정 531회, 자식 목록 비교 531회, 실제 link/unlink 0회였다. 같은 진단의 별도 render commit 포함 시간은 약 1.74ms였다. 이 값은 등록·준비를 포함한 전체 절감량과 다르며, 그 자체로 100ms 정체를 설명하기에는 작다. [Flutter 연결](reference/flutter-master/packages/flutter/lib/src/widgets/framework.dart#L6940) · [Nelyx rebuild](Nelyx/src/framework/widgets/framework.ts#L2142) · [Nelyx 연결·commit](Nelyx/src/framework/widgets/framework.ts#L2984) · [W7 계측](work7.md#L132)

첫 후보의 절감 여지가 작고 등록·조정 비용이 실제로 클 때 시도한다. insert·move·remove 및 자손의 render 교체가 기대 순서를 모두 확정하는 표준 Element 경로에 한해 뒤의 목록 대조를 줄인다. 날짜 build와 render 속성 설정은 매번 실행한다. 형제 순서가 나중 build에서 확정되는 경우, GlobalKey 이동, 동적 자식 목록, 사용자 정의 Element와 가상 동기화 훅은 기존 commit을 사용한다. 기존/새 owner의 실제 자식 순서와 parent data를 대조하고 정·역방향 첫 Scene에 이득이 없으면 종료한다. [기존 동기화 계약 분석](performance-cause-analysis.md#L93) · [자식 조정 회귀](Nelyx/eng/check-child-reconciliation.mjs)

## 5. Windows에서 판정하는 순서

1. **같은 논리 작업인지 먼저 확인한다.** W7의 실제 CalendarDatePicker fixture로 양방향 대조·교차와 3월 첫 노출을 분리한다. 날짜 수, State·FocusNode identity, 콜백 순서, 새 render 생성·설정 횟수, 가시 결과를 비교하고 날짜와 무관한 중첩 목록에서도 같은 Core 경로를 검사한다. 커스텀 predicate와 delegate의 호출, RTL·locale·선택 변경, resize·닫기 후 자원 회수도 확인한다. [고정 입력](Nelyx/eng/calendar-midpoint-fixture.mjs) · [Flutter 대조 진입점](Nelyx/eng/check-flutter-calendar.mjs)
2. **같은 기기에서 Flutter 제품과 직접 비교한다.** Flutter Windows release와 Nelyx 최적화 direct Hermes bytecode `legacy`를 같은 viewport·DPI·주사율·테마·날짜·접근성 상태에 맞춘다. 동일한 PowerShell 가상 touch로 실제 콘텐츠의 첫 이동·최종 정착과 desktop 프레임 간격을 같은 관측 방식으로 읽는다. Flutter profile의 UI/raster와 Nelyx의 build/layout/submit/fence는 각 제품 내부 원인 분해에 쓴다. [Flutter 성능 측정](https://docs.flutter.dev/perf/ui-performance) · [Windows 화면 관측기](Nelyx/eng/windows-jank-screen.cs)
3. **제품 채택은 Nelyx 변경 전후로 판정한다.** 패키지·설치본·실행 HBC 계보를 확인한 뒤 기준과 후보 각 3회, 가능한 경우 교차 순서로 실행한다. 세 입력은 보통 정방향·약 2배 정방향·약 2배 역방향이며 정착 월은 +4/+3/−6이다. 각 실행의 모든 구간에서 엔진·desktop 평균 FPS 하한 각각 30 이상, 100ms 이상 프레임 간격과 진행 정체 각각 0회를 확인한다. 50ms 초과 간격의 빈도·총시간, 입력→surface p95/p99/최장, Gallery·Testbed 회귀도 함께 본다. 각 검사의 제한은 20분이다. [수락 기준](work6.md#L66) · [실행기](Nelyx/eng/check-windows-jank.ps1) · [저장소 지침](.github/copilot-instructions.md)

두 후보의 절감 상한이 모두 작으면 Dart와 Hermes가 같은 build 본문을 실행할 때 드는 동적 호출·할당을 긴 프레임에 맞춰 다시 분해한다. CPU Scene이 이미 제때 완성되는 구간은 submit 대기와 fence→desktop 지연을 따로 추적한다. 이번 개정의 완료 범위는 소스 대조와 설계이며, 위 성능 수치는 기존 실행 기록이다.
