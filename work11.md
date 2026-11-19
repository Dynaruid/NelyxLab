# W11 · Flutter Material 3와 Cupertino 일괄 이식

2026-11-19 · `PAUSED / PARTIAL`

사용자 요청으로 현재 작업과 검증을 일시 중지했다. [9절](#9-현재-중단-지점)에서 현재 작업트리와 재개 지점을 확인할 수 있다.

고정 Flutter 리비전의 Material 3와 Cupertino 위젯 전체를 한 배치에 넣고, 생성 가능한 TypeScript를 두 패키지 소스에 먼저 이식한다. 첫 배치에서 드러난 오류는 두 패키지에 걸쳐 같은 원인끼리 고치고 영향받은 코드를 재생성한다. 그다음 위젯별 속성·기본값·상태 전이·레이아웃·입력·접근성을 원본과 대조하고, 공개 패키지를 Demo와 Testbed의 정상 경로에서 검증한다.

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

`두 패키지 전체 목록 → 일괄 변환 → 패키지 소스에 일괄 이식 → 공통 오류 수정·재생성 → 위젯별 보정 → 공개 API·앱 검증`

1. **해석된 인벤토리**. `flutter-source.mjs`로 원본을 읽고 pin에 맞는 Dart SDK와 package config를 준비한다. Analyzer가 library namespace, `export show/hide`, `part of`, 재공개, 상속 및 실제 참조를 해석하도록 한다. 같은 이름의 private 심벌은 library URI와 소유 선언·멤버를 포함한 식별자로 구별한다. 파일/blob과 선언 span, 공개 엔트리, API 형태, 전이 의존성, Nelyx 소유자와 검증 항목을 연결한다. [원본 로더](tools/Nelyx.FrameworkToTypeScript/flutter-source.mjs) · [현재 패키지 인벤토리](Nelyx/eng/framework-inventory.mjs)
2. **한 번에 넣을 입력**. 두 공개 라이브러리의 범위를 합쳐 기존 생성·채택 코드, 새로 변환할 선언, 근거가 있는 M2 전용 제외 항목을 원본에 매핑한다. M2 여부가 불분명한 선언도 추적한다. 새 위젯과 함께 필요한 private helper·테마·상태·렌더 선언을 선택하고, 타입 참조와 값 초기화 순환은 강한 연결 요소(SCC)로 묶어 배치 내부 순서를 정한다. 현재 등록 recipe가 없는 선언까지 W11-00 목록과 대조한다. [카탈로그](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-package-plan.json) · [batch 계획](tools/Nelyx.FrameworkToTypeScript/src/batch-plan.ts)
3. **첫 배치에서 실제 TS 쓰기**. 기존 `designs:probe --family all --graph --emitter`는 후보 해시와 차단 진단을 출력한다. W11-01에서 이 도구의 전체 그래프와 `body_ir.dart → body-ir.ts → dart-emitter.ts`를 재사용해, 한 번의 호출로 생성 가능한 모듈을 `packages/material/src`와 `packages/cupertino/src`의 소유 경로에 쓰도록 한다. 기존 테마·아이콘·날짜 생성물과 채택한 수동 이식은 원본 심벌을 현재 파일에 연결한다. 목적지에 로컬 수정이나 소유권 충돌이 있으면 해당 차이를 보존하고 다음 모듈로 진행한다. [전체 그래프](tools/Nelyx.FrameworkToTypeScript/design-body-probe.mjs) · [후보 생성](tools/Nelyx.FrameworkToTypeScript/src/design-emitter-probe.ts) · [모듈 소유권](tools/Nelyx.FrameworkToTypeScript/data/work8/w12-product-module-layout.json)
4. **첫 배치 마감**. 모듈 하나의 IR·emitter·외부 바인딩 오류는 원본 위치와 영향받는 선언에 기록하고 나머지 모듈을 끝까지 처리한다. 배치가 끝나면 두 패키지 각각에 대해 소스에 쓴 선언, 기존 구현에 연결한 선언, 차단된 선언, 범위 판정 대기 또는 제외한 선언을 W11-00 목록과 대조한다. 누락된 항목은 차단 사유에 포함한다. 실제 TS가 있는 이식분과 body를 생성하지 못한 항목을 구별하며, 빈 구현으로 차단 수를 줄이지 않는다. 개별 위젯의 실행 통과는 후속 검증에서 확인한다.
5. **오류 수정과 재생성**. 두 패키지의 차단 진단과 이식한 소스의 TypeScript 컴파일 오류를 모은다. 원본·IR·생성 코드에서 공통 원인을 찾아 전이 의존성이 많이 걸린 변환 규칙, import·초기화, Core 바인딩부터 수정한다. 해당 단위와 소비자를 함께 재생성하고 컴파일해 같은 원인의 오류가 양쪽에서 줄었는지 본다. 생성 코드의 수정은 emitter·recipe에, 기존 채택 코드의 수정은 해당 소유 파일에 반영한다. 공개 export와 서브패스는 구현·타입·동작이 확인된 뒤 기존 `batch.ts`의 검증·승격 절차를 활용해 연결한다. 같은 pin·SDK·recipe로 재생성한 결과와 제품 소스의 바이트를 대조한다. [Dart emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts) · [batch](tools/Nelyx.FrameworkToTypeScript/src/batch.ts) · [생성 소유권 안내](tools/Nelyx.FrameworkToTypeScript/data/README.md)

### 컴파일러·컨버터에서 바꿀 지점

현재 IR은 지원하지 않는 AST나 바인딩을 선언 단위에서 거절한다. 예를 들어 `body_ir.dart`는 generator body를 거절하고, `class-model.ts`는 제네릭·제약·상태가 있는 mixin에 검증된 적용 규칙을 요구한다. 첫 배치 후 반복되는 패턴의 Dart 원본·IR·생성 로직을 읽고 규칙을 수정한다. 의미 차이가 남는 lowering은 최소 예제를 Dart와 TS 양쪽에서 실행해 수정 결과를 확인한다. [Analyzer body 수집](tools/Nelyx.FrameworkToTypeScript/dart/bin/body_ir.dart) · [클래스 모델](tools/Nelyx.FrameworkToTypeScript/src/class-model.ts)

| 변환 경계 | 구현 방향과 통과 확인 |
| --- | --- |
| library 해석과 진단 | API 인벤토리와 body 참조에 동일 심벌 ID를 사용한다. IR 버전, 최초 미지원 노드, 원본 위치, 영향을 받는 기능군을 출력한다. 잘못된 pin·스키마·미해결 외부 참조를 입력 단계에서 검출한다. |
| 생성자·클래스·믹스인 | factory/redirect/adaptive 생성자, super 기본값, 제네릭 bound·mixin 순서와 초기화 순서를 실사용 패턴으로 확장한다. `SegmentedButton<T>`의 선택 타입과 `CupertinoSheetRoute<T>`의 전환 mixin처럼 공개 생성과 상속까지 검증한다. |
| 타입·값·제어 흐름 | Dart null-safety, named/필수 인자, 상수, enum, record/pattern, 타입 좁히기와 순회 순서를 비교한다. 숫자 provenance와 reified 타입 경계에는 Core의 `dart-numeric`·`dart-type-witness`를 쓴다. map/set의 값 동등성, `late` 초기화와 오류의 동작도 검증한다. [숫자](Nelyx/src/foundation/dart-numeric.ts) · [타입 증인](Nelyx/src/foundation/dart-type-witness.ts) |
| 위젯과 렌더링 | `build`·`didUpdateWidget`·`dispose`와 render/layout/paint를 Core의 실제 진입점에 연결한다. constraints와 baseline, overlay 삽입·제거, focus 복귀, gesture cancel, 접근성 자식 순서와 bounds를 계약으로 둔다. `dart:ui`의 그림·텍스트·이미지 관련 참조는 Core/Skia 작업으로 연결한다. |
| 비동기와 플랫폼 | `Future`·`Stream`·`TickerFuture`, route 결과·취소·오류, 외부 서비스 응답의 순서를 검증한다. 필요한 플랫폼 기능은 해당 호스트에 어댑터를 추가하고 지원 플랫폼과 검증 상태를 API에 연결한다. |
| 제품 컴파일과 배포 | 정확히 같은 패키지 export와 TS 타입을 Node/Metro 및 각 호스트에서 확인한다. 정적 Hermes 지원 경로도 후보의 source/body/native 대응 검사로 검증한다. 결과 차이가 확인된 lowering만 AOT 도구에서 수정한다. [패키지 컴파일](Nelyx/eng/build-packages.mjs) · [Static Hermes AOT](Nelyx/sdk/tooling/static-aot/README.md) |

Core나 호스트 기능이 필요한 선언은 첫 배치에서 해당 소유자와 누락된 바인딩을 기록한다. 공통 바인딩을 고친 뒤에도 특정 위젯에만 남는 차이는 수동 이식이나 좁은 어댑터로 보완한다. 생성 코드와 채택 코드 모두 원본 대응·동작·패키지 진입점을 검증한다.

## 4. 실행 순서

재개 순서는 **W11-00의 기존 목록 확인 → W11-01의 두 패키지 일괄 변환·소스 이식 → W11-02의 공통 오류 수정 → W11-03~06의 동작 보정 → W11-07~08의 패키지·앱 검증**이다. W11-03~06의 번호는 이식 후 남은 문제를 찾을 기능 영역을 가리킨다. 여러 영역에 걸친 결함은 같은 수정에서 처리한다.

| 단계 | 주요 작업 | 종료 조건 |
| --- | --- | --- |
| **W11-00 · 전체 분모와 기준판** | 기존 Analyzer 목록과 현재 소유 경로를 대조한다. M2 범위 판정 대기와 Core/호스트 의존성도 첫 배치 입력에 표시한다. 기존 패키지·Windows Demo 스크롤·RangeSlider 결과를 회귀 기준으로 사용한다. | 두 패키지의 공개 선언·멤버 및 필요한 의존성을 첫 배치 입력에서 추적할 수 있다. |
| **W11-01 · 전체 변환·소스 이식** | 3절의 파일 쓰기 경로를 연결하고 두 패키지 전체를 한 번에 처리한다. 기존 segmented control과 picker는 채택 구현으로 연결한다. | 각 패키지에 생성 가능한 TS를 실제로 썼고, W11-00 목록에서 각 선언의 목적지 또는 차단·범위 판정 사유를 찾을 수 있다. 이 시점의 컴파일·동작 오류를 다음 단계로 넘긴다. |
| **W11-02 · 공통 원인 수정·재생성** | 실제 배치 오류를 기준으로 생성자·mixin·상수·타입·import와 Core 바인딩을 고친다. Theme/ThemeData, WidgetState, 색·타이포그래피, 아이콘·셰이더, locale·delegate와 Focus/Actions·Overlay/Navigator·scroll·restoration·semantics의 공통 누락을 원본 소유자에 맞춰 보완한다. | 영향받은 양쪽 모듈과 소비자를 재생성·컴파일해 수정한 오류의 해소를 확인한다. 남은 선언과 기능별 차이는 W11-03~07에서 추적한다. 테마·locale·자산은 light/dark, high contrast, text scale, RTL 및 출처·라이선스를 대조한다. |
| **W11-03 · 컨트롤·작은 조합** | 이식된 버튼·FAB, segmented, chip, toggle, 단일/범위 slider, 진행률·활동 표시, list tile·form row의 누락된 생성자·콜백·테마 기본값을 보정한다. | controlled 값·focus·hover·drag·disabled 및 소유 객체 교체/해제 경로가 동작한다. 기존 W10 RangeSlider 회귀와 새 컨트롤 검증이 통과한다. |
| **W11-04 · 화면 구조·내비게이션·오버레이** | 이식된 Material Scaffold/ScaffoldMessenger·AppBar·Drawer·Navigation, tabs, dialogs/sheets, Snackbar, MenuAnchor·dropdown·SearchAnchor의 배치와 route 동작을 보정한다. Cupertino page/sliver navigation, tab/nested route, sheet, action sheet, context menu의 전환·back gesture를 연결한다. | 화면과 route가 열리고 종료·취소 시 결과와 focus가 귀환한다. 중첩 탐색·barrier·키보드 IME inset·접근성 dismiss를 정상 앱에서 확인한다. |
| **W11-05 · 입력·폼·날짜/시간** | 이식된 Material TextField/Form·Autocomplete, DatePicker·TimePicker 및 Cupertino wheel·date/time/timer picker·search·form의 옵션·입력 모드·복원·현지화를 보정한다. 기존 날짜 생성기와 달력 경로를 재사용한다. | 편집·검증·선택·취소 후 값과 호출 순서가 맞는다. 끝 범위, locale, 달력 입력 모드, keyboard/IME·스크롤, 복원 수명 사례를 실제 진입점에서 통과한다. |
| **W11-06 · 데이터·복합 스크롤** | 이식된 Material DataTable·PaginatedDataTable, Stepper·ExpansionPanel, CarouselView, SliverAppBar 및 복합 목록의 동작을 보정한다. Cupertino SliverRefreshControl과 큰 목록·고정/축소 내비게이션 조합을 대조한다. | row/selection 업데이트, 페이지·정렬, 중첩 스크롤, lazy/keep-alive, 스크롤 복귀, 언마운트·리소스 해제를 검증한다. |
| **W11-07 · 라이브러리 전체 대조와 패키지** | 첫 배치의 차단·충돌·범위 판정 대기 항목을 다시 대조한다. 전체 공개 선언·공개 멤버·필요한 private body를 W11-00 분모로 확인하고, aliases, docs, package export와 resource/notice 표를 갱신한다. | 범위 내 미구현 API·미해결 바인딩·사유 없는 불일치가 0개다. ESM·선언·서브패스가 현재 패키지에서 해석되고 독립 앱에서 단일 Core를 사용한다. |
| **W11-08 · 제품 통합과 재생성** | Demo의 실제 조작 경로와 Testbed의 Material/Cupertino 데모를 최신 공급에서 검증한다. Web·Windows·Android에서 릴리스 경로와 배포 자산을 확인한다. Apple 호스트는 대응 툴체인에서 iOS/macOS 앱과 플랫폼 기능을 확인한다. 마지막으로 현재 pin의 전체 선택 단위를 재생성해 제품 소스·배포 결과와 대조한다. | 공개 API와 각 호스트의 실행 근거를 범위별로 기록한다. 실제 환경을 확보하지 못한 항목은 해당 호스트의 검증 대기 상태로 남는다. 재생성과 기존 앱 회귀 검사가 통과한다. |

## 5. 검증 및 완료 기준

- **원본과 실행 결과**. Source/IR 분석을 먼저 하고, 각 수정 단위 뒤에 필요한 검증을 실행한다. 공개 선언 대조에는 생성자·기본값·제네릭·상속·alias와 동작 변경의 근거를 포함한다. 통합 fixture는 pin의 실제 Flutter 위젯 테스트 또는 Flutter oracle과 동일 입력으로 콜백·상태·focus·geometry·semantics를 비교한다. 테마 색·RTL·글자 크기와 다른 효과의 픽셀 검사는 동일 viewport·폰트·배율에서 판정한다. 세부 비교의 tolerance는 렌더 차이가 있는 항목과 이유를 명시한다.
- **실제 앱 사용성**. 브라우저는 Testbed의 정상 웹 진입점과 Playwright로 확인한다. Windows에서는 Demo의 direct Hermes 및 Testbed의 패키지 경로를 실행한 뒤 PowerShell/Win32·UI Automation으로 실제 컨트롤을 조작한다. Android는 현재 Release APK를 지정한 에뮬레이터 또는 기기에 설치한다. Apple 검증에는 UIKit/AppKit, 복원·IME·접근성 등 기능군별 실제 플랫폼 동작을 포함한다. 호스트별 비교에는 실행 패키지와 사용한 입력 조건을 기록한다. [Demo 실행](sample/nelyx-demo-app/README.md) · [Testbed 실행](sample/nelyx-testbed-app-2/README.md)
- **성능과 회귀**. W10의 왼쪽 열 스크롤, 200분할 RangeSlider의 연속 마우스 입력, 달력 월 이동, 새 Cupertino wheel·sheet를 포함한다. 비교할 공급의 Core/Material/Cupertino·러너/번들 identity와 OS·DPI·refresh·viewport·입력 주기를 맞춘다. build/layout/paint와 화면의 고유 이동 프레임·p95 간격·긴 정체를 관측한다. 60Hz 목표는 이동 명령·단계 수가 충분한 장면에서 16.67ms 프레임 예산으로 확인한다. 가상 입력 결과와 물리 장치에서 측정한 조건을 각각 명시한다. [W10 Windows 측정](work10.md) · [RangeSlider 회귀](packages/material/eng/check-range-slider-hover.mjs)
- **배포 단위**. 현 체크아웃으로 Core 및 두 패키지 dist를 빌드하고, 공급·설치된 패키지의 export/type/runtime 바이트와 소스 identity를 확인한다. 현지화·Material/Cupertino 아이콘 폰트·필요한 셰이더와 BSD 및 자산별 notice가 독립 소비자 앱에서도 해석돼야 한다. 새로운 API와 기존 호출 방식을 모두 실제 진입점에서 사용한다. [앱 패키지 공급](Nelyx/eng/prepare-app-packages.mjs) · [Material 출처](packages/material/licenses/design-foundation-sources.json) · [Cupertino 출처](packages/cupertino/licenses/design-foundation-sources.json)
- **실행 예산과 작업물**. 각 검증은 20분 timeout을 적용하고 대부분의 반복은 30회 이내에서 원인 판정에 필요한 만큼 수행한다. 준비·빌드가 오래 걸리면 도구 단계와 기능군을 작게 나눈다. 임시 Flutter 분석·비교·소비자 디렉터리와 브라우저 프로필, 진단 번들은 성공·실패·중단 모두 `finally`에서 정리한다. 유지되는 자료는 현재 소스·recipe·출처·소유권과 현재 dist/공급이다. 새 단계의 결과는 이 문서의 단계 행에 요약한다. [저장소 지침](.github/copilot-instructions.md)

아래는 전체 소스 배치와 이식 후 검증에 쓰는 진입점이다. 전체 배치의 `--write`와 `--check`는 Flutter pin이 요구하는 Dart SDK와 현재 Analyzer lock으로 실행한다. 테스트 호출은 20분 제한을 집행하는 검증 runner로 실행한다.

```powershell
$flutterRepo = 'C:/Users/parti/flutter'
$dart = 'C:/path/to/pinned/dart-sdk/bin/dart.exe'
node Nelyx/eng/framework-inventory.mjs --source $flutterRepo --module '@nelyx/material/widgets'
node Nelyx/eng/framework-inventory.mjs --source $flutterRepo --module '@nelyx/cupertino/widgets'
node tools/Nelyx.FrameworkToTypeScript/design-body-probe.mjs --source $flutterRepo --dart $dart --write --summary
node tools/Nelyx.FrameworkToTypeScript/design-body-probe.mjs --source $flutterRepo --dart $dart --check --summary
node tools/Nelyx.FrameworkToTypeScript/framework-ports.mjs --source $flutterRepo --dart $dart --write
node tools/Nelyx.FrameworkToTypeScript/framework-ports.mjs --source $flutterRepo --dart $dart --check
npm.cmd run build:designs
node packages/material/eng/check-range-slider-hover.mjs
npm.cmd run run:windows --workspace @nelyx/demo -- -- 2500
npm.cmd run run:windows --workspace @nelyx/testbed-2 -- --host native-hermes -- 2500
```

**W11 완료**는 W11-00의 Material 3·Cupertino 공개 범위가 제품에 연결되고, 기능군별 원본/실행 대조 및 현재 패키지 소비 앱 검증이 통과한 상태다. 남은 API와 기능, 호스트 검증 대기는 해당 단계에 기록한다.

## 6. 실행 결과

기존 기능군 검증 이력은 아래 표에 있고, 전체 배치 쓰기와 재생성 및 최신 제품 검증 결과는 8절에 있다.

| 단계 | 현재 결과 | 남은 작업 |
| --- | --- | --- |
| W11-00 | **PARTIAL.** 고정 Dart와 Analyzer lock으로 788개 소스, 74,300개 선언을 다시 해석해 소스 오류 0개를 확인했다. 두 umbrella의 의존성 폐쇄는 773개 파일, 선언·멤버 74,006개, 외부 바인딩 821개다. Material 자체 공개 선언·멤버 6,049개와 Cupertino 1,224개에 아이콘 상수 필드 8,825개와 1,324개를 원본 위치와 함께 연결했다. 선언마다 타입·실행·초기화·문서 참조를 구분했다. Windows Demo 왼쪽 열 스크롤과 RangeSlider 회귀도 통과했다. | M2 전용 분기와 API의 전수 판정, 제품 후보의 원본 signature와 동작 검토, 생성된 모듈의 ESM 초기화 순서 검증. |
| W11-01 | **PARTIAL.** 실행 그래프의 참조를 최상위 선언 단위로 모아 Body IR 입력을 만들었다. 대표 기능군 43개 선언을 36개 변환 단위로 해석했고 반복 결과 바이트가 일치했다. 현재 그래프는 `--with-dependencies`로 대표 36개에서 실행·타입 의존성까지 215개 단위를 선택한다. 제한된 enum 인덱스의 정수 바인딩을 추가해 결정론적 TS 후보를 9개에서 최소 10개로 늘렸다. 대표 컨트롤 두 개와 `CupertinoPicker`는 공개 패키지에 수동 이식했고 원본 span과 제품 해시를 연결했다. 고정 Flutter의 두 segmented control 테스트 중 10개를 실행해 통과했다. | Material Map·Core 렌더, Cupertino mixin·타입 바인딩을 해결하고 제품 recipe와 타입·동작 검증을 승격에 연결한다. 동일 입력의 레이아웃·RTL·접근성 대조가 남아 있다. |
| W11-02 | 기존 생성 아이콘 표와 현재 공개 타입을 스캔에 연결했다. | 테마·텍스트 배율·명암·locale·Core/호스트 의존성 전체 대조. |
| W11-03 | **PARTIAL.** 대표 segmented control 두 가지와 `SegmentedButtonState<T>`를 추가하고 선택·비활성 상태 및 컨트롤러 해제를 연결했다. [Material FAB](packages/material/src/floating-action-button.ts)의 기본·small·large·extended 변형을 공개했다. 테마·비활성·키보드 상태와 Core Hero 등록의 mounted 검사 및 RangeSlider 회귀가 통과했다. [classic Cupertino segmented](packages/cupertino/src/segmented-control.ts)의 controlled 값·비활성, 포인터, 키보드, RTL 균등 레이아웃도 제품 패키지에서 통과했다. | Scaffold 배치, Hero 비행 tween·테마 보간과 route 전환 대조, classic control의 원본 rounded superellipse·네이티브 접근성과 나머지 칩·토글 등 옵션·기본값 검증. |
| W11-04 | **PARTIAL.** [CupertinoActionSheet와 action](packages/cupertino/src/action-sheet.ts)을 공개하고 Testbed의 취소·기본·위험 동작을 Core 대화상자 route에 연결했다. 긴 본문과 액션의 독립 스크롤, 고정 취소 버튼, 키보드 inset 위 레이아웃을 확인했다. [Material bottom sheet](packages/material/src/bottom-sheet.ts)의 inline·modal과 타입 결과, 중첩·루트 route, barrier, safe area·IME inset을 검증했다. | Cupertino 팝업 애니메이션, 끌어서 선택, 포커스 복귀 및 네이티브 접근성. Material sheet의 드래그·사용자 애니메이션·Scaffold 접합, 나머지 화면 구조, 내비게이션, 중첩 route, 메뉴·검색, sheet·overlay 이식. |
| W11-05 | **PARTIAL.** 기존 Material 날짜 대화상자를 Testbed `Date picker` 시연에 연결했다. `CupertinoPicker`의 list·looping·builder와 선택 overlay, Core controller, 확대·원통 투영, 조절 가능한 접근성 노드를 연결했다. 원본 picker 테스트 27개와 Testbed Web의 반복 목록 방향키, 유한 목록의 행 클릭·마우스 휠과 선택 콜백을 확인했다. [CupertinoTimerPicker](packages/cupertino/src/timer-picker.ts)의 세 가지 모드와 간격·초깃값·변경 콜백을 공개하고 Testbed 키보드와 접근성 값으로 확인했다. | picker의 RTL·확대 픽셀·컨트롤러 교체·빈 항목·iOS 효과를 원본과 직접 대조하고, 편집·폼·날짜·시간 옵션, Cupertino date·time 및 timer 다국어·정확한 픽셀·iOS 피드백, 복원과 IME를 검증한다. |
| W11-06 | **PARTIAL.** [Material DataTable](packages/material/src/data-table.ts)의 정렬·선택·셀 제스처, keyed 행, table·row·header 의미 구조와 [ExpansionPanelList](packages/material/src/expansion-panel.ts)의 controlled/radio 접기를 공개했다. 실제 Web Testbed에서 정렬·선택, 패널 토글 및 기존 패널 닫힘이 새 패널 열림보다 먼저 보고되는 순서를 확인했다. [PaginatedDataTable](packages/material/src/paginated-data-table.ts) 및 [DataTableSource](packages/material/src/data-table-source.ts), [Stepper](packages/material/src/stepper.ts), [CupertinoSliverRefreshControl](packages/cupertino/src/refresh.ts)을 공개했다. 제품 패키지 테스트에서 페이지 이동·행 소스 교체/정리, Stepper 양방향 레이아웃과 controlled 상태, 실제 Core overscroll부터 비동기 갱신·복귀까지 확인했다. | 정렬 애니메이션·baseline, dropdown decoration, 혼합 선택의 네이티브 접근성, 패널 cross-fade·병합 그림자, 페이지 푸터·가로 스크롤, Stepper 전환·기본 라벨, SliverRefresh의 네이티브·고정 헤더 조합, Carousel·복합 스크롤. |
| W11-07 | 공개 재공개를 실제 TS 선언 소유자에 매핑하고 `TextAffinity` 두 공개 경로에서 이를 확인했다. 독립 소비자의 세 패키지에서 대표 컨트롤 제네릭과 단일 Core를 검증했다. Web·Windows 번들의 두 아이콘 폰트와 notice가 패키지 바이트와 일치했다. | 현재 스캔에서 Material 2,745개와 Cupertino 635개의 자체 공개 선언·멤버에 제품 후보가 더 필요하다. 후보가 있어도 구현이나 동작 일치를 뜻하지 않는다. Material의 M2 범위 판정, 두 패키지의 전체 대조, 독립 소비 앱 및 자산·현지화·셰이더 검증이 남아 있다. |
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

- **전체 변환 예비 실행.** `designs:probe --family all --graph --emitter --summary`가 1,683개 실행 단위의 1,728개 모듈을 검사했다. 2,081개 선언의 두 Body IR 결과가 바이트 단위로 일치했고 17개 선언은 IR에서 차단됐다. 공통 위젯 생성자의 Dart `key:`를 Core 위치 인수로 연결하고 해석된 Core 타입 바인딩을 추가한 뒤, `ProxyWidget`·`InheritedWidget`·`InheritedTheme`·`SingleChildRenderObjectWidget`의 child/key ABI까지 연결했다. 해석된 `dart:core` 생성자를 확인하고 정확한 정수 밀리초로 바꿀 수 있는 Duration 상수에 한해 lowering을 추가했다. 현재 모듈별 시도는 후보 462개, Emitter 차단 1,252개, IR 차단 14개다. superclass 생성자 어댑터 차단은 538개에서 308개로 줄었으며, 순서가 검증된 mixin 어댑터 119개와 불변 객체 상수 canonicalization 116개가 남았다. Flutter 소스는 고정 Git을 사용했고 Dart는 로컬 `fa8c1270…`(요구 pin `e9c89888…`와 다름)을 사용했다. 여기서 나온 후보는 구문 검사까지이며 제품에 자동 승격하지 않았다.

- **FAB·액션 시트 제품 확인.** 새 TypeScript 공개 진입점과 고정 원본 span을 연결했다. Testbed Web Release에서 extended FAB 실행과 비활성 FAB 노출, 액션 시트의 위험 선택·취소·바깥 클릭 결과를 확인했다. 브라우저가 Core의 dialog 역할을 일반 group으로 내보내던 문제를 수정했다. 기존 segmented, wheel, 검색, 날짜 선택 검증도 통과했다. Windows·Android·RNW·Apple과 픽셀 대조는 이번 실행에서 검증하지 않았다.

- **Classic segmented·Material sheet 제품 확인.** Testbed Web Release에서 classic control의 선택 변경과 비활성 세그먼트를 확인했다. Material modal sheet가 화면 하단에서 열리고 저장 결과와 barrier 취소를 전달하며 경로가 제거되는 것을 확인했다. Cupertino 및 Material 패키지의 mounted 검사, 고정 원본 47개 span·제품 해시, Testbed와 변환기 엄격 타입 검사가 통과했다. Windows direct Hermes의 일반 CLI 실행에서 최신 패키지 기동·종료 코드 0을 확인했고, 동일 번들의 UIA에서 Material modal 열기·저장 결과를 확인했다. Android x86_64 Release는 읽기 전용 Pixel 5/API 33에서 설치·기동, 접근성 트리 노출, 터치로 Material modal 열기·저장 및 저장 결과를 확인했다. RNW·Apple, 실기기·화면 정합·성능은 아직 검증하지 않았다.

- **Timer·DataTable·ExpansionPanel 제품 확인.** 고정 원본의 58개 span·제품 해시와 Testbed 엄격 타입을 확인했다. 최신 [Web Release 검사](sample/nelyx-testbed-app-2/eng/check-w11-design-demos.mjs)에서 타이머 휠의 접근성 값과 변경 콜백, 데이터 정렬과 행 선택, controlled/radio 패널을 확인했다. 브라우저에 table·row·cell·columnheader를 전달하고 정렬 버튼의 역할을 헤더 안에 별도로 보존한다. 이번 세 기능의 최신 네이티브 번들·실기기·원본 픽셀 대조는 검증 대기다.

- **Pagination·Stepper·SliverRefresh 제품 확인.** 최신 Testbed Web Release에서 다음 페이지와 페이지 크기 변경, Stepper의 다음 단계·선택·비활성 헤더, 독립 Cupertino 라우트에서 실제 가상 터치 overscroll로 refresh를 실행하고 새 항목이 목록에 나타나는 것을 확인했다. Core→Web의 `aria-checked="mixed"` 및 체크박스 역할도 패키지의 전체 선택 컨트롤에서 확인했다. 고정 원본 선언 70개와 제품 해시, 엄격 타입 검사 및 mounted 회귀가 통과했다. 최신 네이티브 번들, 픽셀과 실기기 대조는 남아 있다.

## 7. 이전 중간 마무리 이력

사용자 요청으로 전체 이식을 일시 중지했다. 마지막 제품 검증은 Pagination·Stepper·SliverRefresh를 포함한 Testbed Web Release, 엄격 타입 검사, 패키지 동작 검사와 원본 출처 확인이다. 소스와 테스트 변경 사항은 커밋하지 않고 현재 작업트리에 보존했다. Windows direct Hermes와 Android 에뮬레이터의 동작 확인은 앞선 Material modal 빌드까지이며, 그 이후 추가한 기능의 네이티브 검증은 남아 있다.

당시 재개 지점은 W11-01의 두 패키지 전체 변환과 소스 이식이었다. 예비 실행의 1,728개 모듈 중 462개는 구문 통과 후보였고 1,266개는 차단됐다(IR 14개, emitter 1,252개). 첫 전체 배치 결과는 8절에 기록했다.

`CupertinoDatePicker`도 첫 배치 입력에 포함한다. 중단 시점에는 고정 Flutter 원본과 Core wheel API를 조사했다. 해당 위젯에 남은 동작 차이와 Testbed 시연은 이식 후 W11-05에서 보완한다.

W11-05 작업 중 [CupertinoSearchTextField](packages/cupertino/src/search-field.ts)를 공개 서브패스와 `widgets`에 추가했다. 기존 Cupertino 편집 위젯에 검색 제출·지우기·교체 가능한 suffix, 외부 controller·FocusNode 연결, 내부 텍스트 복원 등록을 합성했다. [현지화 생성기](tools/Nelyx.FrameworkToTypeScript/generate-cupertino-search-localizations.mjs)는 고정 Flutter ARB에서 placeholder를 재생성하며, [이식 출처](tools/Nelyx.FrameworkToTypeScript/data/framework-ports.json)는 원본 선언 span과 제품 해시를 확인한다.

Testbed 검색 항목은 `basic`이다. [Web Release 검사](sample/nelyx-testbed-app-2/eng/check-w11-design-demos.mjs)에서 한국어 placeholder, 편집·Enter 제출, 지우기 콜백 및 빈 입력에서 suffix 제거를 확인했다. 비활성 검색 필드 검사에서 브라우저 EditContext의 `aria-disabled` 값이 제거되던 문제도 수정했다. 기존 segmented·wheel·날짜 회귀, RangeSlider 회귀와 Testbed 엄격 타입 검사가 통과했다.

검색 필드의 복원 왕복, 외부 controller·FocusNode 전환 및 소유권은 [mounted 검사](packages/cupertino/test/search-field.test.mjs)에서 검증했다. 스크롤 축소 시 fade, cursor radius·점멸, iOS 스마트 문장부호·IME 개인화와 호스트별 동작은 남아 있다. W11 전체는 완료되지 않았다. M2 범위, emitter의 미해결 바인딩, 나머지 공개 API 및 기능군, 최신 Windows·Android·RNW·Apple 및 성능 검증의 상태는 6절을 참조한다.

## 8. 전체 배치 재개 · 2026-11-19

| 단계 | 현재 결과 | 남은 작업 |
| --- | --- | --- |
| W11-00 | Flutter pin `71e4717a…`와 Dart pin `e9c89888…`를 사용했다. 요구 SDK는 해당 Flutter Git 트리의 content-aware engine artifact에서 확보했다. 두 임시 원본 경로에서 2,081개 Body IR 응답이 일치했다. M2 전용 기본값 클래스 24개와 그 멤버를 합친 316개 선언을 제외했다. 레일의 M2 기본 폭 참조는 공용 레이아웃 범위에 남겼다. | 나머지 Material 2 분기, `ToggleButtons` 및 공용 선언의 범위 판정. |
| W11-01 | **첫 전체 쓰기 완료.** 두 패키지 1,683개 실행 단위의 1,728개 모듈을 처리했다. 최초 Material 236개, Cupertino 186개 생성 파일을 두 소스 트리에 썼다. 실행 보고서에서 원본 위치·기존 소유자·생성 결과·차단 사유를 조회할 수 있다. | 기존 계약·공개 멤버·원본 동작 대조와 기능별 승격. |
| W11-02 | 해석된 Core 타입, 상위 생성자, `late`, 제네릭 제약, 엄격 모드 예약 이름을 연결했다. 검토한 단일 ticker/restoration mixin과 Radius·EdgeInsets 상수 경계를 추가했다. 마지막 전체 쓰기에서 Material 262개와 Cupertino 220개 후보가 엄격 타입 검사를 통과했다. | 마지막 집계의 차단은 emitter 871개와 IR 13개로 총 884개다. 객체 상수, 여러 mixin 적용 순서, 상위 생성자와 Dart 정수 표현을 계속 대조한다. 검색 공개 소유자 연결 이후 전체 재생성이 남아 있다. |
| W11-03 | Flutter `AnimatedIcon` 14종의 경로·투명도 트랙을 생성하고 Core Animation, IconTheme, CustomPaint에 연결했다. 고정 Git에서 14종 재생성이 통과했다. Web Testbed에서 재생 시 32×32 아이콘 이미지가 바뀌고 역재생 후 시작 이미지로 돌아왔다. | Flutter 원본 프레임과 렌더링 비교, 테마·입력 상태별 대조 및 기능군별 회귀. |
| W11-04 | Cupertino 팝업·액션 시트, Material `NavigationBar`·`NavigationRail`·`AppBar` 및 옵션 기반 `Scaffold`를 공개했다. Core에 방향성 toolbar, preferred size, 스크롤 알림을 추가했다. Cupertino 고정 내비게이션 바와 page scaffold를 새 객체 옵션 및 기존 생성 경로로 연결했다. Material 탭, Cupertino 시트, Snackbar 큐, 양쪽 Drawer와 NavigationDrawer를 추가했다. Cupertino 탭마다 독립 Navigator를 연결했다. Material 메뉴와 하위 메뉴를 Core `RawMenuAnchor`에 연결했다. | 최신 메뉴·Snackbar 조작, Cupertino 메뉴·컨텍스트 메뉴, Material sliver app bar, Cupertino 확장 내비게이션, 팝업 foldable 영역, 탭 복원과 호스트별 시각·입력 대조. |
| W11-05 | Cupertino 날짜·시간 피커 4가지 모드와 타이머의 고정 현지화, Core의 공용 `DateTime`을 추가했다. Material `TimeOfDay`와 다이얼·텍스트 시간 대화상자는 Flutter 시간 형식·라벨·숫자, 12/24시간 및 복원을 지원한다. `SearchAnchor`, `SearchBar`, `SearchController`를 공개했다. | Web 검색 뷰 열기와 결과 선택 검증, 원본 폭·픽셀, 화면 분할 anchor, 호스트 진동·IME, UIKit 피드백 및 기타 입력·폼 API. |
| W11-06 | 현 배치에서도 이전 Web 검증의 데이터 표·페이지 이동·Stepper·refresh 시연을 유지했다. | Carousel·복합 스크롤, 나머지 데이터 표·패널 옵션, 네이티브 접근성 및 원본 레이아웃·애니메이션 대조. |
| W11-07 | 소스 후보 435개의 첫 바이트 대조를 통과했다. 마지막 출처 대조는 고정 원본 span과 제품 해시 187개다. 설치된 Web 패키지의 공개 경로와 공용 Core 객체를 확인했다. 두 npm 패키지 배포 목록에서 후보 경로 제외와 picker 라이선스 포함을 확인했다. | 최신 검색·메뉴 수정 이후 출처 재생성과 최종 후보 바이트 대조, 전체 M3 범위와 승격, 독립 앱 및 최신 패키지 검증. |
| W11-08 | Testbed Web Release `b8887870…`에서 기존 컨트롤과 데이터 표 회귀, 내비게이션 바·레일·AppBar·시간 선택, Material 탭, Cupertino 이름 있는 라우트·날짜 휠·액션 시트·refresh·중첩 시트 저장과 드래그 닫기가 통과했다. Web `dc71adeb…`는 양쪽 Drawer 열기, 비활성 목적지, 선택, `Navigator.pop()` 및 Escape 닫기를 통과했다. Web `6c55f8c8…`는 AnimatedIcon 재생·역재생과 Cupertino 탭의 선택 표시·스택 보존·활성 탭의 Back을 통과했다. Android x86_64 Release `f0cbf5e5…`는 격리된 API 33 에뮬레이터에서 날짜 휠·팝업 결과·중첩 시트 저장을 통과했다. Windows direct Hermes `76b59971…` 기동·종료, RNW `56dfa838…` 기동과 UIA Cupertino 전환을 확인했다. Windows Demo `295d86d8…`에서 가상 입력으로 20회 스크롤하며 5개 컨트롤을 통과한 뒤 시작 위치로 돌아왔다. 입력 922건 수락, 거부 0건, 송신 간격 p95 16.02ms였다. | 최신 Web Release가 검색 뷰 열기에서 멈췄다. RNW 날짜·팝업 조작은 전경 창이 바뀌어 완료하지 못했다. 최신 네이티브 기능군의 검증과 Apple, 원본 픽셀·성능·물리 입력 검증이 남아 있다. |

생성 후보는 각 패키지의 `src/generated/flutter-design`에 있다. TypeScript 진단은 배치가 해당 파일을 직접 검사한다. 정식 패키지에서 사용할 선언은 원본 동작과 소비자 진입점 검증을 거쳐 승격한다. 목적지의 이전 생성 해시가 바뀌었으면 로컬 수정을 보존하고 충돌 사유를 출력한다. [배치 진입점](tools/Nelyx.FrameworkToTypeScript/design-body-probe.mjs) · [출력 소유권](tools/Nelyx.FrameworkToTypeScript/src/design-source-batch.ts)

날짜·타이머의 열 순서, 달력 숫자, 날짜 패턴, 복수형과 접근성 라벨은 고정 Flutter ARB 및 Dart intl 0.20.3에서 생성한다. 매체별 JS Intl 구현 차이의 영향을 피하기 위해 같은 테이블을 사용한다. [현지화 생성기](tools/Nelyx.FrameworkToTypeScript/generate-cupertino-picker-localizations.mjs) · [출처 및 라이선스](packages/cupertino/licenses/cupertino-picker-sources.json)

Material 시간 선택기에서 모델의 자정·정오, 복원 순서 `[minute, hour]`, 영어·한국어·캐나다 프랑스어 문자열을 확인했다. Web Testbed의 다이얼로 10시 20분을 반환했고 텍스트 입력 99시의 검증 오류를 확인한 뒤 오후 11시 45분을 반환했다. 동일 한국어 앱에서 날짜 대화상자의 확인·취소 라벨도 ARB를 사용한다. [시간 모델](packages/material/src/time.ts) · [시간 선택기](packages/material/src/time-picker.ts) · [현지화 생성기](tools/Nelyx.FrameworkToTypeScript/generate-material-time-localizations.mjs) · [출처 및 라이선스](packages/material/licenses/time-picker-sources.json)

## 9. 현재 중단 지점

소스, 생성 후보, 시연과 검사 변경을 커밋 없이 작업트리에 보존했다. Core, Material, Cupertino, SDK 빌드와 Testbed 엄격 타입 검사를 통과했다. 현재 Web Release의 `application.js` SHA-256은 `fa6874aa2014e62270561fa30c0712dccccd7549955ecf5302451ffb6cfbe861`이다. 해당 번들에서 Cupertino 탭과 Material Drawer·탭을 지나 `Search collections`를 클릭한 뒤 `Find a collection` 검색 뷰가 열리지 않아 12초 후 검사가 종료됐다. 제안 필터링, 선택 값 반환 및 같은 실행의 후속 메뉴·Snackbar 검증은 대기 중이다. [Web 검사](sample/nelyx-testbed-app-2/eng/check-w11-design-demos.mjs)

재개 시 `SearchAnchor.bar`의 포인터 경로부터 확인한다. Material `TextField`의 바깥 `GestureDetector`에 `onTap`이 있고 안쪽 Core `EditableText`가 텍스트 선택용 탭 recognizer를 소유한다. 안쪽에서 gesture arena를 이길 때 바깥의 검색 열기 콜백이 호출되지 않을 가능성이 있다. 이 경로의 수정과 검증은 남아 있다. 코드에서 입력 계약을 확인한 뒤 실제 클릭, 검색 뷰 입력, 오래된 비동기 제안 무시, 결과 선택과 닫기 순서로 확인한다. 이전 메뉴 검사에서는 비활성 메뉴 항목의 역할 중복과 하위 메뉴를 닫을 때 비활성화된 RenderObject 조회를 발견했다. 두 수정은 작업트리에 있으며 최신 Web에서 재검증해야 한다. [검색 위젯](packages/material/src/search-anchor.ts) · [Material TextField](packages/material/src/text-field.ts) · [Core EditableText](Nelyx/src/framework/widgets/editable-text.ts) · [Core 메뉴 오버레이](Nelyx/src/framework/widgets/raw-menu-anchor.ts)

Web Release와 기존 검사는 저장소 루트에서 실행할 수 있다. Web 검사는 내부에서 20분 제한을 적용한다. 전체 변환과 출처 대조는 5절의 명령을 사용한다. 현재 고정 Dart 실행 파일은 `.tmp/w11-pin-sdk-71e4717a/dart-sdk/bin/dart.exe`에 있다.

```powershell
npm.cmd run prepare:sample -- web
npm.cmd --prefix sample/nelyx-testbed-app-2/web/runner install --ignore-scripts --workspaces=false
npm.cmd run build:web --workspace @nelyx/testbed-2
node sample/nelyx-testbed-app-2/eng/check-w11-design-demos.mjs
```

작업에서 띄운 Android 에뮬레이터와 임시 네이티브 조작 스크립트는 정리했다. 기존 `emulator-5554`는 실행 중이다. 고정 Dart SDK와 다운로드 ZIP은 남아 있다. ZIP 삭제는 도구에서 거부됐다.
