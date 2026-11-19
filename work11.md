# W11 · Flutter Material 3와 Cupertino 일괄 이식

2026-11-19 · `PAUSED / PARTIAL`

Flutter의 동일 리비전에서 Material 3와 Cupertino의 전체 공개 API를 해석하고, 두 디자인 패키지의 누락 기능을 의존성이 연결된 단위로 일괄 이식한다. 속성·기본값·상태 전이·레이아웃·입력·접근성까지 원본과 대조한다. Dart 변환기의 공통 한계는 먼저 해결하고, 플랫폼과 맞닿는 동작은 Nelyx Core와 호스트에 연결한다. 완성된 패키지는 Demo와 Testbed의 정상 실행 경로에서 사용한다.

## 1. 현재 소스에서 확인한 범위

Flutter Git의 고정 커밋 `71e4717a61786faab4c7aa39825989305ed29e8a`를 직접 읽었다. Nelyx 쪽은 패키지 `exports`의 타입 엔트리를 현재 TS 소스에 매핑하고 TypeScript checker로 공개 이름을 확인했다. 아래는 2026-11-19 체크아웃의 소스 조사다. [Flutter 입력 검증](tools/Nelyx.FrameworkToTypeScript/flutter-source.mjs) · [Material exports](packages/material/package.json) · [Cupertino exports](packages/cupertino/package.json)

| 패키지 | Flutter `lib/src`의 Dart 파일 | 해당 공개 라이브러리가 직접 export하는 자체 라이브러리 | 현재 Nelyx 타입이 있는 공개 서브패스 |
| --- | ---: | ---: | ---: |
| Material | 198 | 181 | 184 |
| Cupertino | 52 | 52 | 38 |

두 Flutter 공개 라이브러리는 `widgets.dart`도 재공개한다. Nelyx 서브패스 수는 `./internal/*`과 파일 자산을 제외한 수다. 구현 진행률은 W11-00에서 확인할 **원본 공개 선언과 멤버의 범위**로 계산한다. 예를 들어 `DataTableThemeData` export가 있어도 `DataTable`과 `PaginatedDataTable`은 현재 공개 경로에서 찾을 수 없다.

| 구역 | 현재 공개 소스에서 확인한 사례 | 이식이 필요한 대표 사례 |
| --- | --- | --- |
| Material 3 | `MaterialApp`, `RangeSlider`, `showDatePicker`, `DataTableThemeData` | `AppBar`, `FloatingActionButton`, `SegmentedButton`, `NavigationBar`·`NavigationRail`, `TabBar`, `MenuAnchor`·`SearchAnchor`, `DataTable`·`PaginatedDataTable`, `Stepper`, `CarouselView`, `showTimePicker`·`showModalBottomSheet` |
| Cupertino | `CupertinoApp`, `CupertinoNavigationBar`, `CupertinoTextField`, `CupertinoFormSection` | `CupertinoPicker`·`CupertinoDatePicker`·`CupertinoTimerPicker`, 두 segmented control, `CupertinoContextMenu`·`CupertinoMenuAnchor`, `CupertinoActionSheet`, `CupertinoTabScaffold`, `CupertinoSliverRefreshControl`, `CupertinoSearchTextField`, `showCupertinoSheet` |

Testbed에는 SDK API가 이미 있어도 데모가 `planned`인 경우가 있다. `showDatePicker`가 대표적이다. W11에서 패키지 공개 API와 Testbed 시연 항목을 연결하고, 데모의 상태는 실제 진입점 실행 결과에 따라 갱신한다. [Material 카탈로그](sample/nelyx-testbed-app-2/src/catalog.ts) · [Cupertino 카탈로그](sample/nelyx-testbed-app-2/src/cupertino-catalog.ts)

현재 코드는 생성 코드와 이식 코드가 함께 동작한다. 예를 들어 `RangeValues`·`RangeLabels`와 기본 shape들은 Dart로부터 생성하고, `RangeSlider`의 상태·제스처·렌더·접근성은 Core에 합성한다. 자동 이식은 둘의 소유권과 공개 진입점을 먼저 읽어야 한다. [생성 shape](packages/material/src/generated/slider/range-slider-parts.generated.ts) · [RangeSlider](packages/material/src/range-slider.ts) · [Material 안내](packages/material/README.md) · [Cupertino 안내](packages/cupertino/README.md)

## 2. 가져올 범위와 소유권

- **기준 원본**은 고정 커밋의 `material.dart`와 `cupertino.dart`를 통해 도달하는 공개 타입·함수·상수와 공개 멤버다. 생성자와 기본값, 공개 extension, 재공개 alias, 구현에 필요한 private helper와 `part`, 현지화·아이콘·셰이더와 관련 라이선스까지 의존성에 포함한다. 공통 `widgets.dart`의 재공개 대상은 Core의 기존 심벌에 연결하고, 거기서 발견한 실제 의존성 누락은 Core 작업으로 등록한다.
- **Material 3 범위**는 현재 `@nelyx/material`의 M3 전용 정책을 따른다. M3에서 쓰는 공개 동작과 공용 구현을 이식한다. W11-00에서 M2 전용 분기·API와 M3에서도 쓰이는 공용 선언을 원본 위치별로 식별한다. Cupertino는 동일 pin의 공개 동작 전체를 조사한다. `adaptive` API의 플랫폼 선택, 테마와 접근성 기본값도 범위에 포함한다.
- **제품 API**는 `@nelyx/material/widgets`·`@nelyx/cupertino/widgets`와 기능별 서브패스에서 제공한다. 기존 호출자가 쓰는 생성 옵션 객체, 상속 및 제네릭, controlled 값, 이벤트 순서, controller·FocusNode의 소유권을 호환성 검사에 넣는다. Dart의 named constructor나 기본 매개변수는 Nelyx 기존 공개 패턴에 대응시키고, 원본 signature에 대한 대응표로 옵션 누락을 검사한다.
- **실행 소유자**는 Core의 한 `Widget/Element/State/RenderObject` 트리다. Focus·Gesture·Ticker·Navigator·Overlay·Restoration과 텍스트·접근성은 해당 Core 수명 주기에 연결한다. 플랫폼 IME·클립보드·접근성·back 등의 외부 효과는 SDK/호스트 서비스에 연결한다. 두 패키지는 같은 Core를 사용하고 디자인 패키지 간 참조 방향은 Material에서 Cupertino로 둔다. 공용 프리미티브는 실제 소유자에 한 번 배치한다. [렌더 트리](Nelyx/src/framework/rendering/object.ts) · [라우팅](Nelyx/src/framework/widgets/navigation.ts) · [복원](Nelyx/src/framework/widgets/restoration.ts) · [SDK](Nelyx/sdk/README.md)
- **생성 및 채택**은 원본 심벌마다 결정한다. 재생성 가능한 TS는 생성기가 소유한다. 이미 동작하는 수동 이식 및 Nelyx 특화 경로는 테스트와 원본 매핑을 가진 채택 코드로 연결한다. 외부 효과나 Core와 다른 구조는 좁은 어댑터로 묶는다. `RangeSlider`의 마우스 직접 반영·눈금 묶음 그리기와 [W10 스크롤](work10.md)은 이식 기준판과 회귀 항목에 넣는다. [제품 모듈 매핑](tools/Nelyx.FrameworkToTypeScript/product-module-layout.mjs) · [이식 출처](tools/Nelyx.FrameworkToTypeScript/framework-ports.mjs)

## 3. 일괄 처리 경로

`고정 Git blob → 해석된 공개 API와 의존성 → 변환 단위 → Body IR → 생성 또는 어댑터 합성 → 검증 → 공개 패키지 반영`

1. **해석된 인벤토리**. `flutter-source.mjs`로 원본을 읽고 pin에 맞는 Dart SDK와 package config를 준비한다. Analyzer가 library namespace, `export show/hide`, `part of`, 재공개, 상속 및 실제 참조를 해석하도록 한다. 같은 이름의 private 심벌은 library URI와 소유 선언·멤버를 포함한 식별자로 구별한다. 파일/blob과 선언 span, 공개 엔트리, API 형태, 전이 의존성, Nelyx 소유자와 검증 항목을 연결한다. [원본 로더](tools/Nelyx.FrameworkToTypeScript/flutter-source.mjs) · [현재 패키지 인벤토리](Nelyx/eng/framework-inventory.mjs)
2. **의존성 단위**. 타입 참조와 실행 시 초기화 참조를 그래프에 표시한다. 상호 참조가 있는 구현은 강한 연결 요소(SCC)로 묶고, 타입과 값 import 및 초기화 순서를 확인한다. 하나의 공개 기능에 필요한 private helper, 기본 테마·focus·overlay를 함께 생성하고 검증한다. 변환기에서 공통으로 막히는 패턴은 진단별로 수집하여 한 번 고치고 영향을 받은 단위를 재생성한다. 단위 간 Core 의존성이 생기면 공통 소유자의 작업으로 올린다.
3. **기존 파이프라인 재사용**. `body_ir.dart → body-ir.ts → dart-emitter.ts`를 body 변환 경로로 사용한다. `batch.ts`의 generate/compose/validate/promote 흐름에 기능군 recipe와 현재 validator를 연결한다. 기존 `generate-*` 도구가 이미 관리하는 테마·아이콘·날짜·숫자 타입 출력은 해당 도구의 소유권을 유지하고, 기능군 실행에서 해당 생성기를 호출한다. 두 생성기가 같은 제품 파일을 관리하는 경우에는 먼저 한 소유자를 확정한다. [Body IR](tools/Nelyx.FrameworkToTypeScript/dart/bin/body_ir.dart) · [IR 스키마](tools/Nelyx.FrameworkToTypeScript/src/body-ir.ts) · [Dart emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts) · [batch](tools/Nelyx.FrameworkToTypeScript/src/batch.ts) · [도구 안내](tools/Nelyx.FrameworkToTypeScript/README.md)
4. **기존 카탈로그 접합**. `design_catalog.dart`의 구문 인벤토리와 이전 W11/W12 소유권 표에서 파일·기능군·목적지 연결을 가져와 현재 해석 결과에 대조한다. 이전 `design-package-plan.mjs`는 고정된 임시 경로를 가정하고 W12가 채택한 매핑을 다시 쓰려 하면 중단한다. W11 입력은 호출자가 원본과 출력 위치를 지정할 수 있게 만들고, 기존 매핑은 비교 입력으로 사용한다. 현재 `batch scan/plan`은 등록 recipe를 연결하는 기능이므로, W11에서는 두 공개 라이브러리 전체를 조사하고 해석된 그래프에서 recipe 후보를 만든다. 실행은 한 번의 호출로 전체 또는 지정 기능군을 받아 의존성이 준비된 단위부터 진행한다. 차단된 단위의 진단과 계속 실행할 수 있는 단위를 출력한다. [과거 카탈로그](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-package-plan.json) · [카탈로그 생성기](tools/Nelyx.FrameworkToTypeScript/design-package-plan.mjs) · [batch 계획](tools/Nelyx.FrameworkToTypeScript/src/batch-plan.ts)
5. **결정론적 승격**. 원본 pin·blob·선택 span, SDK/analyzer와 도구·recipe·binding 해시를 기준으로 입력을 확인한다. 깨끗한 임시 위치에서 생성·포맷 후 반복 결과의 바이트 일치를 검사한다. 원본과 채택 코드가 모두 바뀐 경우에는 기존 base와 현재 제품 diff로 충돌을 표시한다. 현재 작업트리의 로컬 수정도 기준에 포함한다. 통과한 단위의 코드·공개 export·출처·소유권을 함께 반영한다. [생성 소유권 안내](tools/Nelyx.FrameworkToTypeScript/data/README.md) · [현재 모듈 소유권](tools/Nelyx.FrameworkToTypeScript/data/work8/w12-product-module-layout.json)

### 컴파일러·컨버터에서 바꿀 지점

현재 IR은 지원하지 않는 AST나 바인딩을 선언 단위에서 거절한다. 예를 들어 `body_ir.dart`는 generator body를 거절하고, `class-model.ts`는 제네릭·제약·상태가 있는 mixin에 검증된 적용 규칙을 요구한다. 생성 규칙은 실제 기능군에서 반복되는 패턴부터 추가한다. 헷갈리는 lowering은 원본의 최소 예제를 Dart와 TS 양쪽에서 실행해 의미를 먼저 확정한다. [Analyzer body 수집](tools/Nelyx.FrameworkToTypeScript/dart/bin/body_ir.dart) · [클래스 모델](tools/Nelyx.FrameworkToTypeScript/src/class-model.ts)

| 변환 경계 | 구현 방향과 통과 확인 |
| --- | --- |
| library 해석과 진단 | API 인벤토리와 body 참조에 동일 심벌 ID를 사용한다. IR 버전, 최초 미지원 노드, 원본 위치, 영향을 받는 기능군을 출력한다. 잘못된 pin·스키마·미해결 외부 참조를 입력 단계에서 검출한다. |
| 생성자·클래스·믹스인 | factory/redirect/adaptive 생성자, super 기본값, 제네릭 bound·mixin 순서와 초기화 순서를 실사용 패턴으로 확장한다. `SegmentedButton<T>`의 선택 타입과 `CupertinoSheetRoute<T>`의 전환 mixin처럼 공개 생성과 상속까지 검증한다. |
| 타입·값·제어 흐름 | Dart null-safety, named/필수 인자, 상수, enum, record/pattern, 타입 좁히기와 순회 순서를 비교한다. 숫자 provenance와 reified 타입 경계에는 Core의 `dart-numeric`·`dart-type-witness`를 쓴다. map/set의 값 동등성, `late` 초기화와 오류의 동작도 검증한다. [숫자](Nelyx/src/foundation/dart-numeric.ts) · [타입 증인](Nelyx/src/foundation/dart-type-witness.ts) |
| 위젯과 렌더링 | `build`·`didUpdateWidget`·`dispose`와 render/layout/paint를 Core의 실제 진입점에 연결한다. constraints와 baseline, overlay 삽입·제거, focus 복귀, gesture cancel, 접근성 자식 순서와 bounds를 계약으로 둔다. `dart:ui`의 그림·텍스트·이미지 관련 참조는 Core/Skia 작업으로 연결한다. |
| 비동기와 플랫폼 | `Future`·`Stream`·`TickerFuture`, route 결과·취소·오류, 외부 서비스 응답의 순서를 검증한다. 필요한 플랫폼 기능은 해당 호스트에 어댑터를 추가하고 지원 플랫폼과 검증 상태를 API에 연결한다. |
| 제품 컴파일과 배포 | 정확히 같은 패키지 export와 TS 타입을 Node/Metro 및 각 호스트에서 확인한다. 정적 Hermes 지원 경로도 후보의 source/body/native 대응 검사로 검증한다. 결과 차이가 확인된 lowering만 AOT 도구에서 수정한다. [패키지 컴파일](Nelyx/eng/build-packages.mjs) · [Static Hermes AOT](Nelyx/sdk/tooling/static-aot/README.md) |

한 기능군의 자동 변환이 Core나 호스트의 새 기능을 요구하면 그 바인딩을 먼저 연결한다. 변환 규칙이 해당 기능에만 적용되고 재사용 효과가 작으면 수동 이식이나 좁은 합성 어댑터를 택할 수 있다. 두 경로 모두 원본 대응·동작 검증·패키지 진입점 검증을 통과해야 한다. 미해결 선언은 사유와 의존 단위를 드러내고 그 기능의 완료를 보류한다.

## 4. 실행 순서

W11-00에서 실제 의존 그래프를 얻고 W11-01의 예비 이식으로 변환 규칙을 검증한다. 이후 기능군 단위로 생성·수정·검증한다. 공통 문제는 도구·Core에 수정해 해당 기능군을 함께 다시 검증한다.

| 단계 | 주요 작업 | 종료 조건 |
| --- | --- | --- |
| **W11-00 · 전체 분모와 기준판** | 두 umbrella의 공개 선언·멤버와 전이 의존성을 해석한다. 현재 공개 API, 채택 코드, M2 전용 항목, Core/호스트 선행 기능을 매핑한다. 현재 패키지 빌드와 Windows Demo의 스크롤·RangeSlider를 기준으로 삼는다. | 공개 심벌과 필요한 의존성이 모두 소유자·기능군·검증 항목에 연결된다. 미해결 바인딩마다 원본 위치와 영향 범위가 나온다. |
| **W11-01 · 변환기와 대표 이식** | 공개 API 스캔·recipe 생성, 해결된 심벌 바인딩과 진단을 현재 도구에 붙인다. `SegmentedButton<T>`와 `CupertinoSlidingSegmentedControl<T>`을 먼저 생성·이식한다. `CupertinoPicker`의 wheel controller 및 private render 의존성을 대상으로 다음 단위의 차단 패턴을 분류한다. | 두 대표 컨트롤이 실제 패키지 import로 실행된다. 선택·비활성화·키보드·RTL·접근성 및 제네릭 옵션이 원본 대조를 통과한다. 같은 입력의 재생성 결과가 일치한다. |
| **W11-02 · 디자인 기반과 공통 소유자** | Theme/ThemeData, `copyWith`·`lerp`·동등성, 색·타이포그래피, WidgetState, theme default와 아이콘·셰이더를 채운다. Flutter `flutter_localizations`에서 필요한 locale·delegate와 문자열·날짜 규칙을 확인하고 기존 자산·locale 생성 경로에 연결한다. 뒤 단계에서 사용하는 Focus/Actions, Overlay/Navigator, scroll·restoration·semantics의 누락을 실제 참조에서 확인해 Core에 보완한다. | light/dark, high contrast, text scale, RTL, locale/delegate 변경을 대표 앱에서 비교한다. Material Color Utilities 대응과 palette·locale·asset의 pin/출처 및 라이선스를 확인한다. |
| **W11-03 · 컨트롤·작은 조합** | 버튼·FAB, segmented, chip, toggle, 단일/범위 slider, 진행률·활동 표시, list tile·form row의 공개 멤버와 기본값을 기능군으로 채운다. 현재 확인된 구현도 누락된 생성자·콜백·theme option 기준으로 검사한다. | controlled 값·focus·hover·drag·disabled 및 소유 객체 교체/해제 경로가 동작한다. 기존 W10 RangeSlider 회귀와 새 컨트롤 검증이 통과한다. |
| **W11-04 · 화면 구조·내비게이션·오버레이** | Material Scaffold/ScaffoldMessenger·AppBar·Drawer·Navigation 계열, tabs, dialogs/sheets, Snackbar, MenuAnchor·dropdown·SearchAnchor를 이식한다. Cupertino page/sliver navigation, tab/nested route, sheet, action sheet, context menu와 전환·back gesture를 연결한다. | 화면과 route가 열리고 종료·취소 시 결과와 focus가 귀환한다. 중첩 탐색·barrier·키보드 IME inset·접근성 dismiss를 정상 앱에서 확인한다. |
| **W11-05 · 입력·폼·날짜/시간** | Material TextField/Form·Autocomplete, DatePicker와 TimePicker의 공개 옵션/입력 모드를 채운다. 기존 날짜 생성기와 달력 경로를 재사용한다. Cupertino wheel picker·date/time/timer picker·search·form과 복원·localization을 이식한다. | 편집·검증·선택·취소 후 값과 호출 순서가 맞는다. 끝 범위, locale, 달력 입력 모드, keyboard/IME·스크롤, 복원 수명 사례를 실제 진입점에서 통과한다. |
| **W11-06 · 데이터·복합 스크롤** | Material DataTable·PaginatedDataTable, Stepper·ExpansionPanel, CarouselView, SliverAppBar와 복합 목록을 처리한다. Cupertino SliverRefreshControl과 큰 목록·고정/축소 내비게이션 조합의 미해결 동작을 완료한다. | row/selection 업데이트, 페이지·정렬, 중첩 스크롤, lazy/keep-alive, 스크롤 복귀, 언마운트·리소스 해제를 검증한다. |
| **W11-07 · 라이브러리 전체 대조와 패키지** | 대표 목록 이후 남은 전체 공개 선언·공개 멤버·필요한 private body를 `W11-00` 분모로 닫는다. aliases, docs, package export와 resource/notice 표를 최신 생성 및 채택 코드에 맞춘다. | 범위 내 미구현 API·미해결 바인딩·사유 없는 불일치가 0개다. ESM·선언·서브패스가 현재 패키지에서 해석되고 독립 앱에서 단일 Core를 사용한다. |
| **W11-08 · 제품 통합과 재생성** | Demo의 실제 조작 경로와 Testbed의 Material/Cupertino 데모를 최신 공급에서 검증한다. Web·Windows·Android에서 릴리스 경로와 배포 자산을 확인한다. Apple 호스트는 대응 툴체인에서 iOS/macOS 앱과 플랫폼 기능을 확인한다. 마지막으로 현재 pin의 전체 선택 단위를 재생성해 제품 소스·배포 결과와 대조한다. | 공개 API와 각 호스트의 실행 근거를 범위별로 기록한다. 실제 환경을 확보하지 못한 항목은 해당 호스트의 검증 대기 상태로 남는다. 재생성과 기존 앱 회귀 검사가 통과한다. |

## 5. 검증 및 완료 기준

- **원본과 실행 결과**. Source/IR 분석을 먼저 하고, 각 수정 단위 뒤에 필요한 검증을 실행한다. 공개 선언 대조에는 생성자·기본값·제네릭·상속·alias와 동작 변경의 근거를 포함한다. 통합 fixture는 pin의 실제 Flutter 위젯 테스트 또는 Flutter oracle과 동일 입력으로 콜백·상태·focus·geometry·semantics를 비교한다. 테마 색·RTL·글자 크기와 다른 효과의 픽셀 검사는 동일 viewport·폰트·배율에서 판정한다. 세부 비교의 tolerance는 렌더 차이가 있는 항목과 이유를 명시한다.
- **실제 앱 사용성**. 브라우저는 Testbed의 정상 웹 진입점과 Playwright로 확인한다. Windows에서는 Demo의 direct Hermes 및 Testbed의 패키지 경로를 실행한 뒤 PowerShell/Win32·UI Automation으로 실제 컨트롤을 조작한다. Android는 현재 Release APK를 지정한 에뮬레이터 또는 기기에 설치한다. Apple 검증에는 UIKit/AppKit, 복원·IME·접근성 등 기능군별 실제 플랫폼 동작을 포함한다. 호스트별 비교에는 실행 패키지와 사용한 입력 조건을 기록한다. [Demo 실행](sample/nelyx-demo-app/README.md) · [Testbed 실행](sample/nelyx-testbed-app-2/README.md)
- **성능과 회귀**. W10의 왼쪽 열 스크롤, 200분할 RangeSlider의 연속 마우스 입력, 달력 월 이동, 새 Cupertino wheel·sheet를 포함한다. 비교할 공급의 Core/Material/Cupertino·러너/번들 identity와 OS·DPI·refresh·viewport·입력 주기를 맞춘다. build/layout/paint와 화면의 고유 이동 프레임·p95 간격·긴 정체를 관측한다. 60Hz 목표는 이동 명령·단계 수가 충분한 장면에서 16.67ms 프레임 예산으로 확인한다. 가상 입력 결과와 물리 장치에서 측정한 조건을 각각 명시한다. [W10 Windows 측정](work10.md) · [RangeSlider 회귀](packages/material/eng/check-range-slider-hover.mjs)
- **배포 단위**. 현 체크아웃으로 Core 및 두 패키지 dist를 빌드하고, 공급·설치된 패키지의 export/type/runtime 바이트와 소스 identity를 확인한다. 현지화·Material/Cupertino 아이콘 폰트·필요한 셰이더와 BSD 및 자산별 notice가 독립 소비자 앱에서도 해석돼야 한다. 새로운 API와 기존 호출 방식을 모두 실제 진입점에서 사용한다. [앱 패키지 공급](Nelyx/eng/prepare-app-packages.mjs) · [Material 출처](packages/material/licenses/design-foundation-sources.json) · [Cupertino 출처](packages/cupertino/licenses/design-foundation-sources.json)
- **실행 예산과 작업물**. 각 검증은 20분 timeout을 적용하고 대부분의 반복은 30회 이내에서 원인 판정에 필요한 만큼 수행한다. 준비·빌드가 오래 걸리면 도구 단계와 기능군을 작게 나눈다. 임시 Flutter 분석·비교·소비자 디렉터리와 브라우저 프로필, 진단 번들은 성공·실패·중단 모두 `finally`에서 정리한다. 유지되는 자료는 현재 소스·recipe·출처·소유권과 현재 dist/공급이다. 새 단계의 결과는 이 문서의 단계 행에 요약한다. [저장소 지침](.github/copilot-instructions.md)

현재 저장소에서 W11 시작과 회귀 확인에 쓰는 진입점이다. 새 자동 변환 명령과 기능군 검증기는 W11-01에서 구현한다. 아래 테스트 호출은 20분 제한을 집행하는 검증 runner로 실행한다.

```powershell
$flutterRepo = 'C:/Users/parti/flutter'
node Nelyx/eng/framework-inventory.mjs --source $flutterRepo --module '@nelyx/material/widgets'
node Nelyx/eng/framework-inventory.mjs --source $flutterRepo --module '@nelyx/cupertino/widgets'
npm.cmd run build:designs
node packages/material/eng/check-range-slider-hover.mjs
npm.cmd run run:windows --workspace @nelyx/demo -- -- 2500
npm.cmd run run:windows --workspace @nelyx/testbed-2
```

**W11 완료**는 W11-00의 Material 3·Cupertino 공개 범위가 제품에 연결되고, 기능군별 원본/실행 대조 및 현재 패키지 소비 앱 검증이 통과한 상태다. 남은 API와 기능, 호스트 검증 대기는 해당 단계에 기록한다.

## 6. 실행 결과

| 단계 | 현재 결과 | 남은 작업 |
| --- | --- | --- |
| W11-00 | **PARTIAL.** 고정 Dart와 Analyzer lock으로 788개 소스, 74,300개 선언을 다시 해석해 소스 오류 0개를 확인했다. 두 umbrella의 의존성 폐쇄는 773개 파일, 선언·멤버 74,006개, 외부 바인딩 821개다. Material 자체 공개 선언·멤버 6,049개와 Cupertino 1,224개에 아이콘 상수 필드 8,825개와 1,324개를 원본 위치와 함께 연결했다. 선언마다 타입·실행·초기화·문서 참조를 구분했다. Windows Demo 왼쪽 열 스크롤과 RangeSlider 회귀도 통과했다. | M2 전용 분기와 API의 전수 판정, 제품 후보의 원본 signature와 동작 검토, 생성된 모듈의 ESM 초기화 순서 검증. |
| W11-01 | **PARTIAL.** 실행 그래프의 참조를 최상위 선언 단위로 모아 Body IR 입력을 만들었다. 고정 Dart에서 대표 기능군 43개 선언을 36개 변환 단위로 해석했고 반복 결과 바이트가 일치했다. `ButtonSegment<T>`를 포함한 9개 단위에서 결정론적 TS 후보를 얻었다. 대표 컨트롤 두 개와 `CupertinoPicker`는 공개 패키지에 수동 이식했고 원본 span과 제품 해시를 연결했다. 고정 Flutter의 두 segmented control 테스트 중 10개를 실행해 통과했다. | Emitter에서 27개 단위가 차단됐다. Material Map·Core 렌더, Cupertino mixin·타입 바인딩을 해결하고 제품 recipe와 타입·동작 검증을 승격에 연결한다. 동일 입력의 레이아웃·RTL·접근성 대조가 남아 있다. |
| W11-02 | 기존 생성 아이콘 표와 현재 공개 타입을 스캔에 연결했다. | 테마·텍스트 배율·명암·locale·Core/호스트 의존성 전체 대조. |
| W11-03 | 대표 segmented control 두 가지를 추가했다. `SegmentedButtonState<T>`를 공개하고 세그먼트 객체별 상태 컨트롤러의 선택·비활성·제거·해제를 연결했다. 현재 Material 빌드에서 기존 RangeSlider 회귀가 통과했다. | FAB, 칩, 토글과 컨트롤 공개 옵션 및 기본값의 전체 대조. |
| W11-04 | 미착수. | 화면 구조, 내비게이션, 중첩 route, 메뉴·검색, sheet·overlay의 이식과 검증. |
| W11-05 | **PARTIAL.** 기존 Material 날짜 대화상자를 Testbed `Date picker` 시연에 연결했다. `CupertinoPicker`의 list·looping·builder와 선택 overlay, Core controller, 확대·원통 투영, 조절 가능한 접근성 노드를 연결했다. 원본 picker 테스트 27개와 Testbed Web의 반복 목록 방향키, 유한 목록의 행 클릭·마우스 휠과 선택 콜백을 확인했다. | picker의 RTL·확대 픽셀·컨트롤러 교체·빈 항목·iOS 효과를 원본과 직접 대조하고, 편집·폼·날짜·시간 옵션, Cupertino date·time·timer, 복원과 IME를 검증한다. |
| W11-06 | 미착수. | 데이터 테이블, Stepper, CarouselView, 복합 스크롤과 Cupertino sliver refresh. |
| W11-07 | 공개 재공개를 실제 TS 선언 소유자에 매핑하고 `TextAffinity` 두 공개 경로에서 이를 확인했다. 독립 소비자의 세 패키지에서 대표 컨트롤 제네릭과 단일 Core를 검증했다. Web·Windows 번들의 두 아이콘 폰트와 notice가 패키지 바이트와 일치했다. | 스캔에서 Material 2,917개와 Cupertino 686개의 자체 공개 선언·멤버에 제품 후보가 필요하다. Material은 M2 범위를 판정하고 두 패키지의 후보를 전수 대조한다. 독립 소비 앱의 전체 범위와 자산·현지화·셰이더를 검증한다. |
| W11-08 | **PARTIAL.** Testbed Web Release에서 두 segmented control과 날짜 대화상자 회귀, Cupertino wheel의 포인터·방향키·접근성 값이 통과했다. Windows direct Hermes에서 UIA로 두 segmented control의 비활성과 wheel의 선택 값·콜백을 확인했다. Android x86_64 Release APK를 설치해 wheel의 두 터치 선택과 접근성 값·콜백을 확인했다. | Windows UIA 세그먼트 선택 상태, Android 세그먼트 조작과 시각 대조, Windows RNW·Apple 제품 검증, 원본과 제품의 기능군별 대조, 성능과 전체 재생성. |

- **스캔과 Body IR.** 전체 재분석으로 기존 기준판의 선언 74,297개에 3개를 더했고 공개 이름 수 및 기존 선언의 signature·공개 여부·멤버·상위 타입이 일치했다. 검증한 기준판을 현재 coverage에 반영했다. `CupertinoPicker`의 문서 링크, overlay 인자 기본값, Material 선택 타입 및 런타임 타입 검사, 공개 타입 재공개를 고정 원본에 대조했다. 실행 참조 단위는 선언·멤버 수준에서 15,878개, Body IR 수준에서 1,683개다. 상속·상수 참조 그래프의 순환은 0개였다. 상속된 기본값 출처를 상대 경로와 원본 span으로 기록해 서로 다른 임시 경로에서 분석한 결과 바이트가 일치했다. 고정 Dart `e9c89888…`와 로컬 Dart `fa8c1270…`의 W11-01 Body IR 해시도 `e32c6e1c…`로 일치했다. [재분석](tools/Nelyx.FrameworkToTypeScript/design-resolve.mjs) · [디자인 스캔](tools/Nelyx.FrameworkToTypeScript/design-inventory.mjs) · [Body IR 점검](tools/Nelyx.FrameworkToTypeScript/design-body-probe.mjs)
- **대표 컨트롤.** 고정 Windows `flutter_tester`에서 세그먼트 삭제 시 컨트롤러 해제, 단일·다중·빈 선택, 포커스 유지와 접근성, Cupertino 방향키·비활성 항목 건너뛰기 등 원본 10개가 통과했다. Nelyx 위젯 트리에서 눌림 상태를 준 세그먼트 삭제, 객체 교체, selection 콜백과 접근성 상태 및 컨트롤러 리스너 해제를 확인했다. Cupertino thumb는 Core의 `easeOutCubic`과 둥근 사각형을 사용하며 Flutter의 스프링·테두리·그림자·누름 애니메이션 차이는 원본 대조가 남아 있다. [Material](packages/material/src/segmented-button.ts) · [Cupertino](packages/cupertino/src/sliding-segmented-control.ts)
- **Windows Demo 기준판.** direct Hermes 기동과 종료 코드 0을 확인했다. PowerShell에서 16ms 간격의 가상 정밀 트랙패드로 왼쪽 열을 20회 움직여 기존 슬라이더·텍스트 입력 5개를 지나 시작점으로 돌아왔다. 수락 입력 922건, 거부 0건, 송신 간격 p95는 16.03ms였다. 물리 장치와 화면 표시 프레임 배치는 검증 대기다. [기준판 PowerShell 검사](sample/nelyx-demo-app/eng/test-all-components-scroll.ps1) · [RangeSlider 회귀](packages/material/eng/check-range-slider-hover.mjs)
- **Cupertino wheel 원본.** 고정 커밋의 Dart와 Windows `flutter_tester`에서 원본 `picker_test.dart` 27개가 통과했다. 원본 테마, 빈 라벨의 접근성 동작, 스크롤 완료 콜백, 가상 iOS 햅틱 호출, 방향성 overlay, 컨트롤러 분리 검사가 포함된다. Nelyx 포트는 생성 Core wheel을 사용한다. 반복 목록의 음수 인덱스를 Core 접근성에 전달하고 각 행의 라벨을 조절 가능한 하나의 항목으로 조립한다. [포트](packages/cupertino/src/picker.ts)
- **Testbed Web.** 현재 Core·Cupertino·SDK와 상태 컨트롤러를 수정한 Material을 공급하고 Release 번들 `a538fd28…`에서 시연을 확인했다. 1,280×900 Playwright Chromium에서 두 segmented control의 선택·비활성, Cupertino 방향키·thumb 드래그, 날짜 대화상자의 열기·취소를 확인했다. wheel에서는 접근성 방향키로 `Apple → Peach → Apple` 순환, 유한 builder의 하한, 투영된 행 클릭으로 `Medium` 선택, 마우스 휠로 `Large` 선택과 콜백을 확인했다. 브라우저 조절 노드에 포커스가 있을 때 공통 방향키 처리가 앞서 소비하던 문제를 수정했다. Testbed TypeScript 엄격 검사가 통과했다. [정상 Web 빌드 검증](sample/nelyx-testbed-app-2/eng/check-w11-design-demos.mjs)
- **Testbed Windows.** 대표 두 컨트롤 검증용 direct Hermes 번들 `0198e69d…`에서 PowerShell UIA `Invoke`로 `List → Grid`, `Daily → Weekly`를 선택했다. 전후 화면 샘플에서 기존 세그먼트와 새 세그먼트의 색이 모두 바뀌었고 `Map`과 `Yearly`는 UIA에서 비활성 상태였다. UIA의 `SelectionItem.IsSelected` 값은 조회되지 않아 호스트 읽기 상태 검증은 남아 있다. RNW 실행 경로와 화면 프레임 배치도 검증 대기다.
- **Windows wheel.** 최신 direct Hermes Release 번들 `1ab14232…`에서 PowerShell/Win32 마우스 휠로 유한 picker를 `Small → Medium`으로 바꾸고, 반복 picker의 위쪽 행을 클릭해 `Apple → Peach`로 순환했다. UIA `ValuePattern`과 콜백 메시지의 두 변경을 읽고 테스트 창을 종료했다. 가상 입력을 사용했다.
- **Testbed Android.** Metro가 참조하던 이전 `engine-v2` 이미지 경로를 공용 `assets` 경로로 수정했다. Temurin JDK 21, NDK `27.1.12297006`에서 최신 x86_64 Release APK `833ae810…`을 만들었다. Pixel 5/API 33의 읽기 전용 Vulkan 에뮬레이터에서 실제 앱의 wheel로 이동한 뒤 ADB 터치로 `Small → Medium`, `Apple → Peach`를 선택했다. `uiautomator`에서 두 접근성 값과 앱 콜백을 읽었고 에뮬레이터를 종료했다. Android 세그먼트 입력, 픽셀 대조, 물리 기기와 프로덕션 서명은 검증 대기다. 실행 정책이 이미 교체된 W11 Android 패키지 디렉터리의 재귀 삭제를 차단해 이전 패키지 한 개가 남아 있다. [Android 엔트리](sample/nelyx-testbed-app-2/android/runner/main.ts)
- **패키지 일치.** wheel 검증 시점의 Web·Windows·Android 설치 파일 해시가 각각의 검증에 공급한 Core·SDK·Material·Cupertino 패키지와 일치했다. Web 설치본의 `@nelyx/cupertino/widgets`와 `@nelyx/cupertino/picker`가 동일한 picker와 Core controller를 내보내는 것도 확인했다. Material 상태 컨트롤러 변경을 공급한 최신 실행 검증은 Web에서 수행했다.

## 7. 중간 마무리

2026-11-19에 사용자 요청으로 일시정지했다. 변경 파일과 로컬 coverage 기준판을 작업트리에 보존했다. 마지막 작업은 W11-05의 `CupertinoSearchTextField`에서 고정 Flutter의 편집·복원·현지화 동작과 현재 `CupertinoTextField`의 연결 지점을 조사하는 단계였다. 검색 필드 구현과 실행 검증은 시작 전이며 Testbed 검색 항목은 `planned` 상태다.

재개 시 검색 제출과 지우기 콜백, 외부 controller·FocusNode 교체, 내부 controller 복원, placeholder 현지화를 기존 편집 소유자에 연결하고 Testbed에서 검증한다. M2 범위 판정, emitter 차단 27개와 제품 승격, 나머지 공개 API 이식, 최신 Windows·Android 패키지 재검증, RNW·Apple 호스트와 성능 검증도 남아 있다. 단계별 검증 범위는 6절에 기록했다.
