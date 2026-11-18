# W8 · Flutter의 달력 생성·갱신 순서를 유지하는 Nelyx 렌더링 성능 계획

2026-11-18 · 설계 기준 `d6cfa40e` · 실행 기준 `129f1bae` · 최초 두 Core 후보 미채택 · Material Ink 수정(7절) · Core 렌더 트리 수명주기 개편(8절) · `performanceAccepted=false`

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

두 후보의 절감 상한이 모두 작으면 Dart와 Hermes가 같은 build 본문을 실행할 때 드는 동적 호출·할당을 긴 프레임에 맞춰 다시 분해한다. CPU Scene이 이미 제때 완성되는 구간은 submit 대기와 fence→desktop 지연을 따로 추적한다. 1–5절의 수치는 설계 당시의 기록이다. 이번 실행 결과는 6절에 기록했다.

## 6. W8 실행 결과

**두 후보 모두 제품 적용을 중단했다.** 같은 layout callback에서 성공한 경로를 다시 읽는 현상은 확인됐다. 다만 Windows Hermes에서 그 검사와 render 자식 동기화가 차지한 비중으로는 달력의 긴 프레임을 설명하기 어려웠다. Core·Material 배포 코드와 달력의 날짜 생성 시점은 W7 공급과 같다. 아래 수치는 W8에서 다시 측정했다.

### 권한 검사와 render 자식 동기화

권한 검사는 현재 노드의 owner 확인, callback root까지의 탐색, 범위 밖 dirty 노드 판정 순서로 실행된다. 일반 callback과 분리된 준비 pipeline 모두 같은 스택에 범위를 넣고 `finally`에서 꺼낸다. 진단은 실제로 읽은 부모를 기록하고, 같은 범위에서 성공한 경로의 어디까지를 재사용할 수 있었는지 계산했다. 조상 연결 해제·detach 때는 중첩된 모든 범위의 기록을 비웠다. 커스텀 getter도 포함해 재사용 기회를 넉넉하게 계산했으며, 모든 허용·거부는 원래 코드가 결정했다. 시간은 경로를 기록하지 않는 별도 프로세스에서 검사 함수 전체를 감싸 측정했다. [조상 탐색 진단](Nelyx/eng/check-calendar-layout-membership.mjs)

| W7 고정 입력 | 검사 호출 | 실제 parent 읽기 | 재사용 가능한 판정 / parent 읽기 상한 | 전체 검사 ms / 첫 Scene ms¹ |
| --- | ---: | ---: | ---: | ---: |
| 1·2월 정방향 중간점 | 1,269 | 7,455 | 1,035 / 6,764 | 0.548 / 52.710 |
| 1·2월 역방향 중간점 | 1,270 | 7,455 | 1,035 / 6,764 | 0.439 / 41.329 |
| 3월 첫 10% | 525 | 1,929 | 356 / 1,600 | 0.262 / 40.840 |

¹ Node/V8 단일 진단의 wall time이며 타이머 비용이 들어 있다. 중간점을 넘지 않은 양방향 대조 입력에서는 검사 호출이 0회였다. 중첩 callback에서 범위 밖의 깨끗한 자식을 거부했고, getter 예외 뒤의 재진입과 조상 이동 뒤에도 원래 판정이 유지됐다.

다른 Node 진단에서 정방향 중간점은 날짜 59개를 다시 build하고 render 설정과 자식 비교를 각각 531회 수행했다. 날짜 아래 실제 link/unlink는 0회였다. 이때 날짜 아래 등록·admission·비교의 배타 시간 합은 1.706ms였고, 새 3월에서는 1.008ms였다. 새 3월은 날짜 아래 render 279개를 모두 연결했다. Windows Hermes의 별도 CPU 샘플링에서 빠른 역방향 33.33ms 초과 프레임 7개의 표본 530개 중 권한 검사가 5개(0.94%), 등록·admission·flush·commit 중 하나가 25개(4.72%)였다. 실제 구조 변경, 유효성 검사와 가상 훅까지 포함한 표본이다. 이 관측으로는 제품의 동기화 계약을 좁힐 근거가 부족했다. [Node 구간 분석](Nelyx/eng/calendar-midpoint-intervals.mjs) · [Hermes 표본 귀속](Nelyx/eng/windows-jank-representation-profile.mjs)

### 같은 기기의 Flutter release와 Nelyx direct Hermes

동일한 2560×1459 client, 192 DPI, 165Hz 화면에서 360×400 논리 픽셀의 달력을 가운데 놓았다. 2025-02-15, 영어, 같은 Material seed와 NotoSansKR 폰트, 접근성 활성 상태로 시작했다. 두 앱에 같은 PowerShell 가상 touch 좌표와 60Hz 일정(48/30/60개)을 보냈다. desktop에서 손가락과 헤더를 벗어난 날짜 영역을 같은 GDI 방식으로 읽고, 접근성 헤더로 정착 월을 확인했다. Flutter는 Windows release AOT, Nelyx는 별도 계측 없는 최적화 direct Hermes bytecode `legacy`다. [실행기](Nelyx/eng/check-windows-calendar-content.mjs) · [날짜 영역 관측기](Nelyx/eng/windows-calendar-content.cs)

| 입력 | 제품 | 이동한 월 수 | 첫 입력→첫 / 마지막 내용 변화 ms | 첫~마지막 변화 사이 관측 변화/초 | 최장 변화 간격 ms | ≥100ms 간격 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 보통 정방향 | Flutter | +5 | 45.0 / 1428.0 | 62.18 | 31.0 | 0 |
| | Nelyx | +4 | 152.7 / 1431.7 | 28.93 | 153.5 | 5 |
| 빠른 정방향 | Flutter | +5 | 41.8 / 928.0 | 62.06 | 31.0 | 0 |
| | Nelyx | +3 | 150.4 / 1237.0 | 32.21 | 189.6 | 4 |
| 빠른 역방향 | Flutter | −10 | 42.6 / 1527.7 | 59.93 | 32.1 | 0 |
| | Nelyx | −6 | 143.2 / 1525.0 | 20.26 | 198.0 | 7 |

각 제품 1회. Flutter 3.50.0 / Dart 3.14.0, release `app.so` SHA-256 앞 16자리 `188c15e407ac1848`, Nelyx fixture HBC `08ef4d2fff8e49de`. 내용 관측 자체의 최장 샘플 간격은 Flutter 23.1ms, Nelyx 31.5ms였다. 변화율은 날짜 영역 픽셀이 달라진 관측 사이에서 계산했다. 제품의 모든 프레임 수, 패널 scanout, 물리 trackpad는 측정하지 않았다. 동일 입력에서도 정착 거리가 달라 월당 비용이나 런타임 단독 기여율은 이 표에서 구할 수 없다.

별도로 실행한 Flutter profile의 보통 정방향·빠른 정방향·역방향에서 해당 입력 창 안에 raster가 끝난 프레임은 각각 206/182/227개였다. 최대 UI 시간은 6.94/6.52/7.08ms, 최대 raster 시간은 2.24/2.44/1.97ms였다. 이 실행에는 Nelyx와 대응시킬 33.33ms 초과 Flutter UI 프레임이 없었다.

### 동작 보존

3월 첫 Scene에 날짜 31개와 고유 render 객체 279개가 있고 월 변경 콜백은 0회였다. 처음 드러난 3월 2일의 접근성 bounds와 실제 보이는 영역의 교차점에 touch를 보내 선택을 확인했다. Flutter widget test에서도 31일과 날짜 하위 render Element 279개, 같은 중간점 콜백 순서를 확인했다. [Nelyx fixture](Nelyx/eng/calendar-midpoint-fixture.mjs) · [Flutter oracle](Nelyx/eng/flutter-calendar-midpoint_test.dart)

정·역방향 중간점에서는 59일의 Element·State·FocusNode가 유지됐고 커스텀 delegate가 만든 날짜가 일자 순서대로 predicate에 전달됐다. 1월을 회수한 뒤에는 눌렀던 포인터의 up과 이전 접근성 action이 날짜를 선택하지 않았고, 재진입 때는 새 identity를 확인했다. RTL·locale, 키보드 포커스 이동, 선택·확정·취소, resize와 닫기 후 자원 계수, 세로 목록 안 가로 목록의 회수·재생성도 통과했다. [상호작용 검증](Nelyx/eng/calendar-interaction-fixture.mjs) · [슬롯·GlobalKey·커스텀 layout 검증](Nelyx/eng/check-child-reconciliation.mjs)

### Hermes에서 긴 프레임에 들어간 일

별도 CPU 샘플링의 빠른 역방향에서 33.33ms 초과 프레임은 7개였고, 날짜 최초 build 182회와 기존 날짜 rebuild 154회가 관측됐다. 524개 표본을 가장 가까운 Element·Sliver 수명주기 메서드로 분류하면 생성 185, 갱신 86, 회수 29, 기타 172, GC 52였다. 가장 긴 프레임은 276.16ms였고 59일이 새로 생겼다. 이 프레임의 140개 표본은 각각 75/7/12/30/16개였다. 새 월을 생성하는 프레임에도 기존 자식 갱신과 회수가 함께 들어갔다.

같은 524개 표본에서 생성된 달력 클래스의 `build`가 스택에 있는 경우는 33개, final 필드 보호는 6개, 정수 검사는 1개, Dart 런타임 타입 처리는 4개였다. 이 수치는 포함 관계가 있어 합산할 수 없다. GC와 interval을 함께 본 별도 진단에서 보통·빠른 정방향·빠른 역방향의 Hermes 전체 할당 증가량은 각각 123.67/98.61/129.62MB, GC는 32/26/34회였다. 앱과 계측의 할당이 함께 들어 있다. 달력 build 본문만의 할당 바이트나 Dart AOT 대비 동적 호출 시간은 분리되지 않았다. 현재 근거는 새 월 생성·기존 자식 갱신·회수가 겹치는 CPU 프레임을 가리킨다. [샘플 분류](Nelyx/eng/windows-jank-representation-profile.mjs) · [Hermes 힙 계수](Nelyx/eng/windows-jank-heap-profile.ts)

interval 진단의 역방향 최대 layout은 frame 169의 212.17ms였다. 권한 검사 3,046회가 1.61ms였고, render owner admission 4,890회가 21.15ms였다. 이 프레임에서 등록 자체의 배타 시간은 2.73ms, flush와 commit 배타 시간 합은 2.98ms였다. admission에는 실제 자식 생성과 타이머 안에서 경과한 GC·스케줄링 시간이 포함될 수 있다. 같은 실행의 양쪽 정방향 피크에서는 admission 전체가 각각 1.42/1.55ms였다. 한 프레임의 21.15ms 전부를 기존 슬롯의 중복 비교를 줄여 회수할 수 있다고 보기는 어렵다. [프레임별 계측](Nelyx/eng/windows-jank-framework-profile.ts)

CPU Scene 생성이 33.33ms 이내이고 같은 frame ID로 연결된 구간의 p95는 아래와 같다. 마지막 열은 desktop marker까지 관측된 프레임만 포함한다. 분포의 분위수는 서로 더하지 않았다.

| 입력 | fence / desktop 대응 프레임 | Scene 종료→submit 시작 ms | submit 호출 ms | submit 시작→fence ms | fence→desktop 관측 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 보통 정방향 | 39 / 32 | 11.15 | 2.14 | 9.46 | 8.36 |
| 빠른 정방향 | 25 / 21 | 10.04 | 1.77 | 9.60 | 9.14 |
| 빠른 역방향 | 19 / 14 | 13.93 | 2.20 | 14.80 | 14.57 |

### Demo 제품 기준선과 Gallery·Testbed

**제품 판정은 `performanceAccepted=false`다.** W8에서 제품에 반영한 후보가 없어 동일한 legacy 기준선을 3회 실행했다. 계측 프로파일을 끄고 기존 surface fence와 desktop marker로 측정했다. 각 회차의 정착 월은 모두 +4/+3/−6이었고, 세 입력의 48/30/60개 touch가 모두 수신·수락됐다. 아래 범위는 실행별 통계의 최솟값~최댓값이다.

| 입력 | 엔진 FPS 1/2/3회 | desktop FPS 1/2/3회 | ≥100ms 엔진 간격 / 정체 횟수 | ≥100ms desktop 간격 / 정체 횟수 | 입력→surface p95 / p99=최장 ms |
| --- | --- | --- | --- | --- | --- |
| 보통 정방향 | 33.870 / 33.109 / 33.369 | 29.830 / 27.106 / 26.640 | 6–7 / 7 | 6–7 / 7 | 249.8–278.6 / 266.6–294.6 |
| 빠른 정방향 | 31.860 / 29.407 / 38.096 | 27.416 / 24.274 / 30.865 | 4–5 / 4–6 | 4 / 4–5 | 388.3–473.4 / 388.3–473.4 |
| 빠른 역방향 | 26.205 / 22.449 / 27.225 | 22.258 / 19.029 / 23.307 | 6–7 / 6–7 | 6–7 / 6–7 | 390.2–583.6 / 392.6–600.6 |

| 입력 | >50ms 엔진 횟수 / 총시간 ms | >50ms desktop 횟수 / 총시간 ms | desktop 최장 간격 ms |
| --- | --- | --- | --- |
| 보통 정방향 | 9 / 996.4–1013.2 | 9 / 990.7–1022.7 | 131.5–142.7 |
| 빠른 정방향 | 5–6 / 702.6–749.4 | 5–7 / 716.4–795.4 | 181.2–211.7 |
| 빠른 역방향 | 8 / 1106.3–1330.7 | 8–9 / 1103.0–1343.3 | 210.3–303.2 |

Gallery와 Testbed 가변 목록을 각각 1회 왕복했다. cold down / return up / warm down의 desktop FPS 하한은 Gallery 70.97 / 61.10 / 61.07, Testbed 81.98 / 59.90 / 58.74였다. 양쪽 모두 엔진·desktop의 100ms 이상 간격과 정체는 0회였다. Gallery cold에서 50ms 초과 desktop 간격이 2회(합계 150.23ms)였고 Testbed는 세 구간 모두 0회였다.

**공급 확인.** Core 647개, Material 275개 emit의 캡처 입력과 현재 소스가 일치했다. Demo·Testbed의 패키지 입력 해시가 각각 workspace와 같았고, tgz 파일 내용 해시는 Core `9334ec5992ed197e`, Material `06f81b86ee93d090`으로 두 설치본에서 같았다. SHA-256 앞 16자리 기준 Demo 기준선 HBC는 3회 모두 `fa158f7e95605645`, Gallery `d3ac90243c39f14e`, Testbed list `4458351c877a351d`였다. CPU 샘플 진단 `67592b4090bfb589`와 interval·GC 진단 `a52883a974b2329e`는 별도 HBC다. 임시 entry, Windows 패키지, Flutter 프로젝트와 원시 계측 파일은 실행 종료 시 정리했다.

### 재실행

저장소 루트의 PowerShell에서 실행한다. Windows 화면 검사는 같은 전경 화면을 사용하므로 하나씩 실행한다. 검사당 제한은 20분이다.

```powershell
node Nelyx/eng/check-calendar-layout-membership.mjs
node Nelyx/eng/check-calendar-interaction.mjs
node Nelyx/eng/calendar-midpoint-profile.mjs --diagnose
node Nelyx/eng/check-child-reconciliation.mjs
node Nelyx/eng/check-flutter-calendar.mjs
node Nelyx/eng/check-windows-calendar-content.mjs
pwsh -NoProfile -Command '$env:NELYX_NATIVE_CPU_PROFILE="1"; $env:NELYX_JANK_REPRESENTATION_PROFILE="1"; node Nelyx/eng/check-windows-jank.mjs --child --diagnostic --no-screen'
pwsh -NoProfile -Command '$env:NELYX_JANK_SLIVER_PROFILE="1"; $env:NELYX_NATIVE_GC_STATS="1"; node Nelyx/eng/check-windows-jank.mjs --child --diagnostic'
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -Runs 3
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -Runs 1
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario list -App testbed -Runs 1
```

## 7. 후속 수정 · 날짜별 Material Ink 초기화와 갱신

새 날짜 하나에서 `InkResponse`와 `Ink`가 build 중 각각 Material 조상을 검증하고, 안쪽 Builder가 실제 잉크 장식을 만들면서 같은 렌더러를 다시 찾았다. 기존 날짜의 갱신 때도 앞의 두 조회가 반복됐다. Flutter 원본은 두 검증을 assert 안에 둔다. Nelyx에서도 기본 검증을 debug 모드로 옮기고, 장식·스플래시·하이라이트를 만들 때는 실제 컨트롤러를 조회하도록 했다. 사용자 정의 `debugCheckContext` 훅은 기존 build 호출을 받는다. [InkResponse](packages/material/src/ink-well.ts) · [Ink](packages/material/src/ink-decoration.ts) · [Flutter InkResponse](reference/flutter-master/packages/flutter/lib/src/material/ink_well.dart#L1339) · [Flutter Ink](reference/flutter-master/packages/flutter/lib/src/material/ink_decoration.dart#L298)

중첩된 InkResponse는 기존 inherited provider로 가장 가까운 부모 상태를 찾고 변경 통지를 받는다. 자식의 눌림, 스플래시, 하이라이트를 추적하는 두 Set과 한 Map은 각각 처음 사용할 때 만든다. 활성 효과가 있을 때에는 갱신·해제 도중 콜백이 컬렉션을 바꿔도 순서를 보존하도록 스냅샷을 사용한다.

**같은 입력에서 줄어든 작업.** 3월 첫 10% 노출에서 `Material.of` 호출은 기존 93회(날짜별 3회)에서 31회(장식 생성)로 줄었다. 이미 존재하는 1·2월의 정·역방향 중간점은 각각 121회에서 0회였다. 날짜 31개와 하위 render 객체 279개, 59일의 identity, 첫 장면의 날짜 bounds·선택·semantics 검사를 통과했다. 회귀 검사는 release의 유휴 build, debug의 조상 검사, 실제 터치가 컨트롤러를 조회하는 경우를 각각 확인한다. [상호작용 검사](Nelyx/eng/calendar-interaction-fixture.mjs)

Node/V8에서 기존판과 수정판의 실행 순서를 바꿔 비교한 6쌍에서 3월 첫 build+layout 중앙값은 26.13→23.38ms였고, 여섯 쌍 모두 짧아졌다. 첫 Scene 전체는 31.47→28.87ms였다. 기존 월 중간점의 첫 Scene은 정방향 26.81→27.48ms, 역방향 26.20→27.30ms였다. 조회 감소가 기존 월의 CPU Scene 시간 단축으로 이어지지는 않았다. 재실행 명령은 `node Nelyx/eng/calendar-midpoint-profile.mjs --before 129f1bae`이다.

**Windows 제품 측정.** 같은 기기에서 기존판 3회 후 Material 패키지를 교체하고 수정판 3회를 실행했다. 각 실행은 동일한 legacy Demo 시나리오와 48/30/60개 가상 touch를 사용했고, 정착 월은 모두 +4/+3/−6이었다. 아래 값은 이번 후속 측정으로, FPS는 회차별 desktop 하한의 중앙값이다.

| 입력 | desktop FPS 기존→수정 | 수정판 1 / 2 / 3회 | 수정판 ≥100ms 진행 정체 횟수 | desktop 최장 간격 기존→수정 범위(ms) |
| --- | ---: | --- | --- | --- |
| 보통 정방향 | 26.752→32.558 | 32.558 / 33.425 / 26.522 | 7 / 6 / 7 | 135.4–242.9 → 162.7–200.9 |
| 빠른 정방향 | 22.856→23.566 | 22.116 / 26.170 / 23.566 | 4 / 5 / 4 | 174.6–213.8 → 170.2–212.0 |
| 빠른 역방향 | 19.664→21.198 | 21.198 / 21.376 / 9.988 | 7 / 6 / 7 | 179.5–217.9 → 189.0–291.4 |

빠른 역방향의 입력→surface p95 중앙값은 414.55→463.20ms였고, 수정판 한 회차의 desktop 하한은 9.988 FPS까지 내려갔다. 월 생성 시의 중복 조회는 제거됐지만 역방향 표시 지연은 남았다. 전체 구간의 30 FPS 및 100ms 이상 정체 0회 조건을 충족하지 못해 `performanceAccepted=false`를 유지한다. 실기 측정은 전후 교차 실행이 아니므로 FPS 차이를 패치 단독 효과로 확정하지 않는다.

수정판 Gallery와 Testbed 목록을 각각 한 차례 왕복했다. 세 구간 모두 엔진·desktop의 100ms 이상 간격과 진행 정체는 0회였다. 기존 잉크 paint 회귀 9개 사례가 원본과 Hermes lowering에서 통과했다. 두 Windows runner의 Material 설치 입력과 workspace dist가 일치했고, 공급 tgz SHA-256 앞 16자리는 `64b182a6ab0911e1`이었다. 달력 측정 HBC는 기존 `fa158f7e95605645`, 수정 `53265c0dfc9fe60e`로 각 3회 동일했다. 일반 Demo도 `npm.cmd run build:windows --workspace @nelyx/demo`로 빌드했고, 해당 HBC `b7e5f859651f9098`로 direct Hermes host가 surface 4프레임을 완료한 뒤 종료 코드 0을 반환했다.

## 8. Core 렌더 트리의 연결과 회수

월 경계에서 렌더 트리가 생기고 사라질 때마다 엔진은 파이프라인의 전환 깊이, 레이아웃 큐 두 개, 객체의 분리 이력과 복구 상태를 전역 약한 참조 컬렉션 다섯 개에서 찾았다. 전환 깊이와 큐는 이제 해당 `PipelineOwner`가 직접 관리한다. 각 `RenderObject`는 분리 횟수와 복구 여부를 보관한다. 분리 훅이 실패하면 횟수를 확인해 필요한 기본 정리를 한 번 수행하고, 형제의 오류도 발생 순서대로 전달한다. 정상적인 하위 트리 분리에서는 객체마다 오류 배열을 만들던 비용도 없앴다. [Core 구현](Nelyx/src/framework/rendering/object.ts)

입력 좌표를 게시해야 하는 객체가 생기거나 사라질 때는 각 부모가 자기 작업과 작업이 있는 직계 자식 수를 센다. 가지가 처음 채워지거나 마지막 작업이 사라질 때만 상위로 전파한다. 공통 부모를 가진 두 편집 관찰자를 다른 파이프라인으로 옮기고 하나씩 제거·재삽입하는 검사에서 해당 루트의 콜백 순서와 대상을 확인했다. 분리 훅의 `super.detach()` 전후 예외, 기본 분리를 누락한 연결 실패, 독립 파이프라인의 레이아웃과 실패 후 재사용도 확인했다. [회귀 검사](Nelyx/eng/check-render-initialization.mjs)

3월이 처음 10% 보이는 장면에서 기존판과 수정판은 모두 렌더 객체 368개를 연결했고, 그중 날짜 31개 아래에 279개가 있었다. 해당 장면에서 위 다섯 컬렉션의 연산은 3,683회에서 0회로, 입력 좌표 작업을 전파하면서 노드의 카운터를 갱신한 횟수는 55회에서 19회로 줄었다. 기존 월 사이의 중간점을 지날 때는 정방향 198회, 역방향 210회의 컬렉션 연산이 사라졌다. 이 횟수는 Node에서 메모리에 계측을 삽입해 측정했다.

시간 비교에서는 Material을 고정하고 Core 렌더링 소스만 바꿨다. Node에서 실행 순서를 교대한 6쌍의 첫 Scene 시간 차이(수정−기존) 중앙값은 기존 월의 정방향 −0.43ms, 역방향 −0.08ms, 3월 첫 노출 +0.48ms였다. 세 구간 모두 실행별 차이가 양쪽에 걸쳤다. 재실행 명령은 `node Nelyx/eng/calendar-midpoint-profile.mjs --render-before 129f1bae`다.

### Windows Demo 달력

기존 엔진을 3회 측정한 뒤 Core만 교체하고 같은 기기에서 수정판을 3회 측정했다. 두 공급의 달력 HBC SHA-256 앞 16자리는 각각 `53265c0dfc9fe60e`, `f0a133bcadd226b1`이었다. 여섯 회차 모두 48/30/60개 가상 터치를 수락했고 정착 월은 +4/+3/−6이었다. FPS는 desktop marker에서 확인한 표시 하한이다.

| 입력 | 표시 FPS 중앙값 기존 → 수정 | 수정판 표시 FPS 1 / 2 / 3회 | ≥100ms 표시 진행 정체 기존 → 수정(회차별) | 입력→surface p95 중앙값 기존 → 수정(ms) |
| --- | ---: | --- | --- | ---: |
| 보통 정방향 | 28.424 → 31.718 | 31.718 / 33.369 / 27.281 | 8·6·6 → 6·5·7 | 274.832 → 325.669 |
| 빠른 정방향 | 25.678 → 25.329 | 23.842 / 25.329 / 25.957 | 5·5·5 → 5·5·5 | 393.481 → 385.407 |
| 빠른 역방향 | 18.081 → 20.628 | 18.004 / 20.628 / 23.728 | 8·6·9 → 7·8·8 | 405.609 → 403.027 |

빠른 역방향의 표시 하한 중앙값은 올랐고 보통 정방향의 입력 지연은 늘었다. 순차 측정이라 FPS 변화에서 패치 단독 효과를 분리할 수 없다. 모든 입력 구간 30 FPS 및 100ms 이상 정체 0회 기준은 미달이며 `performanceAccepted=false`다. Core 647개와 Material 275개 모듈의 소스 입력을 확인했고, Demo·Testbed runner의 설치 입력이 workspace와 같았다. 측정 당시 Core 공급 tgz는 `b7b61f0a973f45cd`였고 최종 소스 서식을 담은 두 runner의 Core는 `34844c146dd0a636`이다. Material은 `64b182a6ab0911e1`이다. 최종 공급으로 다시 빌드한 일반 Demo와 달력 검사 HBC는 각각 측정 당시와 바이트 단위로 일치했다. 화면 계측을 끈 마지막 달력 확인에서도 입력 48/30/60개와 월 이동 +4/+3/−6을 확인했다.

Gallery와 Testbed 가변 목록을 각각 한 번 왕복했다. 처음 내리기 / 되돌리기 / 다시 내리기의 표시 FPS 하한은 Gallery 84.73 / 60.08 / 62.05, Testbed 79.74 / 61.31 / 59.95였다. 여섯 구간의 엔진·desktop 진행 정체는 모두 0회였고 desktop 최장 간격은 47.75ms였다. 첫 Gallery 시도는 PowerShell이 12번째 wheel 입력의 시한을 4.35ms 넘겨 중단했다. 동일 조건으로 다시 성공한 실행을 집계했다. 일반 Demo도 현재 Core로 빌드해 direct Hermes host가 surface 4프레임을 완료하고 종료 코드 0을 반환했다. 일반 앱 HBC는 `e6e89cfe2f8ebc45`다.

같은 화면 조건에서 날짜 격자의 픽셀 변화를 직접 센 별도 실행도 진행했다. 보통 정방향 / 빠른 정방향 / 빠른 역방향의 초당 내용 변화는 Nelyx 36.22 / 32.81 / 21.00, Flutter Windows release 61.57 / 62.15 / 60.49였다. 같은 가상 터치에서 정착한 이동량은 각각 +4/+3/−6개월과 +5/+5/−10개월이었다. 빠른 역방향의 100ms 이상 내용 변화 간격은 Nelyx 6회(최장 248.29ms), Flutter 0회(최장 31.27ms)였다. Nelyx의 첫 변화까지는 149.20ms, Flutter는 41.95ms가 걸렸다. [실제 콘텐츠 비교](Nelyx/eng/check-windows-calendar-content.mjs)
