# Nelyx 날짜 선택기와 앱 현지화 보강 계획

**IMPLEMENTED** · 2026-11-26 KST · 기준 `main` `c5dbc005` · 검증 환경과 남은 항목은 §8

한·영 앱에서 날짜 선택과 입력이 같은 로케일 규칙을 따르고, 앱 언어가 바뀌면 위젯 문구·방향·접근성 언어가 함께 바뀌게 한다. Flutter의 Widgets·Material·Cupertino 위젯 번역을 한 명령으로 가져올 수 있게 한다. 영어 기본 동작과 로케일을 직접 지정하는 앱도 검증한다.

## 1. Doroti의 작업에서 적용할 범위

Doroti는 확정된 로케일과 리소스의 일괄 적용, 전환 실패 시 이전 리소스 유지, Gregorian 날짜의 표시·파싱 일치를 검증했다. Nelyx의 `WidgetsApp`에는 로케일 해석, 타입 있는 delegate, `Directionality`가 있고 두 디자인 패키지에는 위젯 번역이 있다. 이 경로에서 위 세 가지 동작을 완성한다. [Doroti 작업 요약](../DorotiLab/history/26/11/13/intl-localization-summary.md) · [WidgetsApp](Nelyx/src/framework/widgets/app.ts#L334) · [Material delegate](packages/material/src/material-localizations.ts#L490) · [Cupertino delegate](packages/cupertino/src/cupertino-localizations.ts#L323)

Web과 Tauri는 TypeScript 프런트엔드를 공유한다. 날짜·숫자·복수형은 브라우저와 WebView의 `Intl`을 사용하고, 문단의 글리프·단어 경계·선택 좌표는 기존 CanvasKit에서 계산한다. Doroti에서 .NET WASM ICU 파일과 합성 문단 통합을 검증한 범위는 Nelyx에서 `Intl` 로케일 지원과 기존 문단의 입력·선택 회귀를 확인하는 데 참고한다. [프런트엔드 구성](README.ko.md#L5) · [기존 Intl 사용](packages/material/src/material-localizations.ts#L227) · [CanvasKit 문단](Nelyx/skia/packages/web/src/library.ts#L1284)

## 2. W6-01. Material 날짜 표시와 입력 규칙 통일

### 공용 IntlProvider 구성

`IntlProvider`는 `@nelyx/core`의 공용 TypeScript 모듈로 둔다. Web과 Tauri는 같은 기본 구현을 사용하고, 포맷은 각 브라우저·WebView의 `globalThis.Intl`이 수행한다. SDK provider 레지스트리는 빌드와 렌더러 구성을 담당한다. [공용 프런트엔드](README.ko.md#L5) · [SDK provider 계약](Nelyx/sdk/src/runtime/providers.ts#L73)

| 구성 | 책임 |
| --- | --- |
| `WidgetsApp` / `Localizations` | 앱 설정과 플랫폼 언어 목록에서 로케일을 결정한다. W6-02에서 로드에 성공한 리소스를 해당 트리에 적용한다. |
| `IntlProvider.forLocale(tag)` | 정규화된 태그로 날짜·숫자 포매터를 제공한다. 포매터는 필요할 때 만들고 로케일과 옵션을 기준으로 재사용한다. 복수형 포맷도 같은 구조를 따른다. |
| Material·Cupertino delegate | 기존 `load(locale)`에서 `locale.toLanguageTag()`로 공용 provider를 호출하고, 해당 로케일의 포매터와 위젯 번역을 묶어 반환한다. 날짜 입력 규칙과 번역 문구는 각 위젯 패키지가 관리한다. |

`ko-KR` 앱에서 `en-US`를 명시한 다이얼로그는 `forLocale('en-US')`로 자신의 날짜 리소스를 만들고, 앱 화면은 이미 확정한 `ko-KR` 리소스를 계속 쓴다. 첫 연결은 Material 날짜 입력에 필요한 `Intl.DateTimeFormat`·`Intl.NumberFormat`과 Cupertino의 월 이름 포맷에 적용한다. [delegate 계약](Nelyx/src/framework/widgets/app-data.ts#L599) · [Material delegate](packages/material/src/material-localizations.ts#L490) · [Cupertino 월 이름](packages/cupertino/src/cupertino-localizations.ts#L225)

provider는 각 `Intl` 생성자의 `supportedLocalesOf()`와 필요한 메서드의 유무를 확인한다. 달력 등 필수 옵션은 생성한 포매터의 `resolvedOptions()`와 대조한다. 런타임이 필요한 기능을 제공할 수 없으면 그 상태를 위젯 패키지에 전달해 해당 패키지의 기본 포맷 규칙을 적용하게 한다. [포매터 기능 확인](Nelyx/src/framework/widgets/intl-provider.ts)

### Material 날짜 선택기 적용

기본 `MaterialLocalizations`는 영문 월·요일명과 `mm/dd/yyyy`를 쓰는 `SourceDateLocalizations`를 상속한다. `showDatePicker`, `CalendarDatePicker`, `InputDatePickerFormField`는 이 경로를 쓴다. `DateRangePickerDialog`만 전용 어댑터를 적용해 날짜를 현지화한다. 따라서 `ko-KR`에서 버튼이 한국어여도 단일 날짜 선택기의 월명과 입력 규칙은 미국식이다. [단일 날짜 포맷·파서](packages/material/src/generated/date/material_localizations.generated.ts#L143) · [달력의 리소스 조회](packages/material/src/generated/date/calendar_date_picker.generated.ts#L506) · [날짜 범위의 리소스 조회](packages/material/src/date-range-picker.ts#L289)

1. `range-localizations.ts`의 날짜 입력 규칙을 Material 공용 내부 구현으로 옮겨 기본 `MaterialLocalizations`의 날짜 멤버에 연결한다. `IntlProvider`가 공급한 포매터에서 파서 패턴을 구성하고 해당 날짜 리소스에서 재사용한다. 단일·범위 달력과 독립 날짜 입력 필드는 기존 `GregorianCalendarDelegate`의 호출 경로에서 같은 리소스를 받는다. `DefaultMaterialLocalizations`와 기존 `en`·`en-US`의 결과를 보존하고, 앱의 `MaterialLocalizationsScope`·사용자 delegate·`CalendarDelegate`가 제공한 메서드를 우선한다. [공용 날짜 포매터](packages/material/src/internal/date/date-localizations.ts) · [Gregorian 위임](packages/material/src/generated/date/date.generated.ts#L360) · [날짜 위젯 유지보수 규칙](packages/material/src/generated/date/README.md#maintaining-the-date-picker)
2. 월·연도 제목, 요일 헤더, 주 시작 요일, 선택 날짜의 접근성 이름, 입력 예시와 형식 오류를 함께 맞춘다. `ko`·`ko-KR`의 날짜 문구는 기존 Material 데이터에서 재사용할 수 있는 항목을 우선한다. 빠진 단일 날짜 문구만 보완한다. 날짜 입력 예시 또는 힌트는 실제 파서가 받는 형식을 보여 준다. `Intl`의 요일 정보 API가 없는 환경에서도 두 달력이 같은 기본값을 사용한다. [기존 날짜 문구](packages/material/src/internal/date/range-labels.ts#L1066) · [입력 힌트와 검증](packages/material/src/generated/date/input_date_picker_form_field.generated.ts#L306)
3. 포맷과 파서는 Gregorian 연·월·일을 같은 순서와 구분자로 처리한다. `formatToParts`를 사용해 날짜 필드 순서를 얻고, 지원하는 숫자와 방향 제어 문자 처리를 일치시킨다. `DateTime`의 로컬 날짜 의미를 유지하고 UTC 이동으로 날짜가 바뀌지 않게 한다. provider가 해당 로케일이나 기능을 제공하지 못하면 기존 기본 포맷·힌트·파서를 한 세트로 적용한다. 파싱 후 연·월·일을 다시 비교해 잘못된 윤일과 월말을 거부하고, 선택 가능 범위는 기존 위젯 검증을 따른다. [공용 날짜 파서](packages/material/src/internal/date/date-localizations.ts) · [Core DateTime](Nelyx/src/foundation/date-time.ts#L15)
4. `showDatePicker`의 명시 `locale` → 테마 로케일 → 상속 로케일 순서와 두 다이얼로그의 명시적 `textDirection` 우선권을 보존한다. 다이얼로그 내부에서 같은 유효 로케일을 날짜 포맷, 방향 기본값, 입력 접근성에 적용한다. 열린 달력은 선택일과 표시 중인 월을 유지한다. 입력 도중 전환되면 편집을 마칠 때까지 해당 필드의 입력 형식과 원문을 보존하고, 확정된 날짜는 새 형식으로 표시한다. 범위 필드의 `syncFields()`가 로케일 변경만으로 입력값이나 선택을 초기화하는 경우를 함께 고친다. [단일 날짜 locale 지정](packages/material/src/generated/date/date_picker.generated.ts#L1539) · [범위 날짜 locale 지정](packages/material/src/date-range-picker.ts#L131) · [범위 입력 동기화](packages/material/src/date-range-picker.ts#L289)

## 3. W6-02. 앱 로케일과 리소스를 한 번에 적용

브라우저 플랫폼 메시지는 소유 뷰의 `navigator.languages`와 `languagechange`를 전달한다. `WidgetsApp`은 환경 변경을 구독하고 새 로케일을 해석한다. 요청 번호로 늦은 응답은 걸러내지만, 동기 오류를 보고한 뒤 또는 `Promise.allSettled`로 실패를 모은 뒤에도 일부 리소스만 담긴 지도를 확정한다. 이때 `build()`는 확정된 로케일에 현재 `options.messages`와 `supportedLocales`의 첫 항목을 조합한다. [환경 전달](Nelyx/sdk/src/backends/browser/platform-messages.ts#L176) · [변경 구독](Nelyx/src/framework/widgets/app.ts#L237) · [현재 리소스 확정](Nelyx/src/framework/widgets/app.ts#L351)

1. 명시 로케일과 플랫폼 우선 언어 목록의 현재 우선권을 유지한다. 목록 콜백, 단일 로케일 콜백, 기본 매칭의 순서도 보존한다. `canonicalLocaleTag`와 `localeFromTag`를 재사용해 요청 비교, `Intl` 호출과 DOM 속성에 같은 유효 태그를 쓴다. 앱 `messages`의 기존 키와 fallback은 `Localizations.text()`로 계속 조회할 수 있게 한다. [로케일 해석](Nelyx/src/framework/widgets/app-locales.ts#L99) · [문구 조회](Nelyx/src/framework/widgets/app-data.ts#L630)
2. 요청 하나에 로케일, 선택된 delegate, 앱 메시지와 fallback을 함께 캡처한다. 지원하는 첫 delegate를 리소스 타입마다 선택하는 현재 규칙을 따르고 선택된 delegate가 모두 성공한 뒤 확정한다. 이미 확정된 상태가 있으면 요청 진행 중과 실패 후에 그 상태를 유지한다. 확정된 로케일에서 메시지나 fallback만 바뀌면 기존 리소스를 재사용한다. 전환이 진행 중인 요청의 메시지가 바뀌면 새로 확정할 상태에 함께 반영한다. 재시도는 로케일 또는 delegate 입력 변화로 시작하며 환경 알림이나 재빌드만으로 실패를 반복 보고하지 않게 한다. [delegate 계약](Nelyx/src/framework/widgets/app-data.ts#L599) · [현재 재로드 판정](Nelyx/src/framework/widgets/app.ts#L334)
3. 초기 비동기 로드는 첫 콘텐츠를 그리기 전까지 완료를 기다린다. 최초 요청 실패 시 아직 시도하지 않은 `supportedLocales`의 첫 로케일로 한 번 복구한다. 복구도 실패하거나 동일한 후보라면 기존 오류 보고와 `ErrorWidget` 경로로 종료해 빈 대기 화면에 머무르지 않게 한다. 동기 delegate의 정상 기동은 같은 프레임에서 완료한다. 요청을 덮어쓰거나 뷰를 닫을 때는 늦은 성공·실패가 화면을 변경하거나 종료된 뷰에 오류를 다시 보고하지 않게 한다. [현재 첫 콘텐츠 대기](Nelyx/src/framework/widgets/app.ts#L407) · [기존 ErrorWidget](Nelyx/src/framework/widgets/framework.ts#L3195)

## 4. W6-03. 방향과 DOM 접근성 언어 연결

Core에는 `Semantics.localeForSubtree`와 상속 계산이 있지만 호스트용 노드에는 유효 로케일이 전달되지 않는다. DOM 어댑터는 이름의 일부에 붙은 `LocaleStringAttribute`를 `span.lang`으로 내보낸다. 활성 편집 요소와 일반 접근성 노드에는 확정된 뷰·하위 트리의 로케일을 적용할 경로가 필요하다. Demo는 앱의 첫 언어가 `en`이고 문서 초기 선언은 `lang="ko"`다. [Core 언어 상속](Nelyx/src/framework/rendering/semantics-pipeline.ts#L352) · [호스트 노드 변환](Nelyx/src/framework/rendering/semantics-transport.ts#L435) · [DOM 접근성 이름](Nelyx/sdk/src/backends/browser/interaction.ts#L144) · [Demo 앱](sample/nelyx-demo-app/src/demo-application.ts#L101) · [Demo HTML](sample/nelyx-demo-app/index.html#L2)

1. 확정된 앱 로케일을 기존 `Directionality`와 semantics 경계에 함께 전달한다. 다이얼로그처럼 로케일을 지정한 하위 트리는 내부에서만 해당 로케일을 사용하고 명시한 `textDirection`을 우선한다. 호스트 노드가 유효 로케일과 방향을 전달하고 DOM 노드의 갱신 비교에 이 값을 포함한다. 텍스트가 같고 언어 또는 방향만 바뀌는 경우에도 해당 접근성 노드의 `lang`·`dir`이 바뀌어야 한다. 기존 텍스트 구간별 언어 속성도 보존한다. [앱 상속 위젯](Nelyx/src/framework/widgets/app.ts#L441) · [semantics 위젯](Nelyx/src/framework/widgets/semantics.ts#L75) · [DOM 변경 비교](Nelyx/sdk/src/backends/browser/interaction.ts#L54)
2. SDK가 문서를 소유하는 단일 앱은 문서의 초기 언어를 앱 기본값과 맞추고 이후 확정된 값을 반영한다. 공유 문서의 여러 뷰와 로케일을 지정한 하위 트리는 각자 소유한 DOM 경계에서 속성을 적용한다. 중첩 및 별도 다이얼로그의 로케일과 종료 시 복구를 확인한다. [DOM 뷰 시작점](Nelyx/sdk/src/frontend/dom/application.ts#L285) · [별도 다이얼로그](Nelyx/sdk/src/frontend/dom/dialog-windows.ts#L41)
3. 실제 `<input>`·`<textarea>`와 EditContext 편집 요소의 언어 메타데이터를 기존 세션에서 갱신한다. 활성 편집기 변경 경로, 접근성 사용 여부, 캐리어 교체·재사용을 함께 다룬다. 언어·방향 변경 중에도 논리 포커스, 입력값, 선택과 진행 중인 IME 조합을 보존한다. 접근성에 보이는 이름과 언어를 확인하고 암호 값은 기존 마스킹 규칙을 따른다. [DOM 편집 세션](Nelyx/sdk/src/backends/browser/interaction.ts#L312) · [DOM 접근성 갱신](Nelyx/sdk/src/backends/browser/interaction.ts#L819) · [편집 중 설정 변경 처리](Nelyx/src/framework/widgets/editable-text.ts#L4037)

## 5. W6-04. Flutter 위젯 ARB 일괄 가져오기

현재 Nelyx는 Material 시간 선택기와 Cupertino 날짜 선택기 등의 키를 개별 스크립트로 추출한다. Core의 라디오 버튼 힌트는 Flutter에서 생성된 Dart 번역을 읽는다. 세 묶음의 ARB에 대해 하나의 가져오기 명령을 만든다. 현재 Flutter 고정 리비전 `71e4717a61786faab4c7aa39825989305ed29e8a`의 입력은 Widgets 117개, Material 116개, Cupertino 115개다. [Material 추출기](tools/Nelyx.FrameworkToTypeScript/generate-material-time-localizations.mjs#L47) · [Cupertino 추출기](tools/Nelyx.FrameworkToTypeScript/generate-cupertino-picker-localizations.mjs#L21) · [Core 라디오 추출기](tools/Nelyx.FrameworkToTypeScript/generate-cupertino-radio-data.mjs#L120) · [Flutter 고정 리비전 파일 목록](https://api.github.com/repos/flutter/flutter/contents/packages/flutter_localizations/lib/src/l10n?ref=71e4717a61786faab4c7aa39825989305ed29e8a)

1. `node tools/Nelyx.FrameworkToTypeScript/import-flutter-localizations.mjs <flutter-repo>`를 새 진입점으로 만든다. `openFlutterSource()`로 지정한 Git 저장소의 고정 커밋에서 `packages/flutter_localizations/lib/src/l10n/`의 `widgets_*.arb`, `material_*.arb`, `cupertino_*.arb`를 모두 읽는다. 각 묶음의 영어 기준 파일로 키와 메타데이터를 검증한다. 상속을 적용한 뒤에도 빠진 필수 키와 해석할 수 없는 항목은 원본 경로와 키를 함께 보고한다. [고정 소스 읽기](tools/Nelyx.FrameworkToTypeScript/flutter-source.mjs#L27) · [Flutter 위젯 번역 생성기](https://raw.githubusercontent.com/flutter/flutter/71e4717a61786faab4c7aa39825989305ed29e8a/dev/tools/localization/bin/gen_localizations.dart)
2. `$placeholder`, `@` 메타데이터의 `parameters`·`plural`·`optional`·`x-flutter-type`, `Zero`·`One`·`Other` 등 복수형 분기와 `timeOfDayFormat`·`scriptCategory` 같은 형식 필드를 보존한다. 지역 파일의 부분 번역은 Flutter의 생성 결과와 대조해 부모 로케일에서 상속한다. `pt-PT`, `es-419`, `zh-Hant-HK` 등 지역·스크립트 변형을 포함한다. 숫자 표시와 복수형 분류에는 해당 로케일의 `IntlProvider`를 사용하고, 메시지가 선언한 인자와 분기 우선순위를 검증한다. [Material 영어 ARB](https://raw.githubusercontent.com/flutter/flutter/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter_localizations/lib/src/l10n/material_en.arb) · [Cupertino 영어 ARB](https://raw.githubusercontent.com/flutter/flutter/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter_localizations/lib/src/l10n/cupertino_en.arb) · [Widgets 영어 ARB](https://raw.githubusercontent.com/flutter/flutter/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter_localizations/lib/src/l10n/widgets_en.arb)
3. 전체 입력을 한 번에 TypeScript 카탈로그로 생성하고 Core·Material·Cupertino의 `LocalizationsDelegate`에 연결한다. 기존 getter와 ARB 키의 대응을 먼저 작성해 라디오 힌트, 날짜·시간 선택기, 선택 메뉴부터 공용 카탈로그를 읽게 한다. 짝이 있는 개별 추출 데이터는 대조한 뒤 교체하고, Nelyx 전용 문구와 날짜·숫자 입력 규칙은 기존 패키지에서 관리한다. 앱의 `supportedLocales`가 실제 선택 가능한 언어를 결정한다. 생성된 데이터의 로케일 목록과 화면 검증을 끝낸 범위를 기록한다. [Core 힌트 조회](Nelyx/src/framework/widgets/radio-localizations.ts#L8) · [Material 리소스 조회](packages/material/src/material-localizations.ts#L278) · [Cupertino 리소스 조회](packages/cupertino/src/cupertino-localizations.ts#L99)
4. 같은 커밋의 입력으로 항상 같은 파일을 생성하고 `--check`에서 현재 출력과 비교한다. 전체 입력을 검증한 뒤 생성 대상 파일을 갱신한다. 입력 커밋·원본 상대 경로와 해시를 기존 출처 기록 형식으로 남기고 Flutter 저작권 및 BSD-3-Clause 고지를 배포 패키지에 포함한다. 앱은 빌드된 TypeScript 카탈로그를 사용한다. [기존 출처 기록](packages/cupertino/licenses/cupertino-picker-sources.json) · [Flutter 라이선스](https://raw.githubusercontent.com/flutter/flutter/71e4717a61786faab4c7aa39825989305ed29e8a/LICENSE)

## 6. W6-05. 샘플 적용과 검증

- [x] W6-01의 공용 `IntlProvider` 연결과 두 선택기·독립 날짜 필드의 포맷·파싱, Cupertino 월 이름, 사용자 delegate의 우선권을 확인했다.
- [x] W6-02의 초기 로드·실패·경합을 제어 가능한 delegate로 검사했다. W6-03의 전환은 위젯·DOM 편집·접근성에서 확인했다.
- [x] W6-04의 세 묶음을 모두 가져왔고 타입 검사와 재생성 비교를 통과했다. Demo·Testbed의 위젯 문구와 접근성 이름을 확인했다.
- [x] Demo의 기본 언어와 `en-US`·`ko-KR`·시스템 언어 선택, 단일·범위 달력, 텍스트 입력, 별도 로케일 다이얼로그를 확인했다. Testbed의 Material 날짜·시간 다이얼로그와 Cupertino 날짜·타이머 휠을 회귀 검사에 사용했다. [Demo 화면](sample/nelyx-demo-app/src/localization-screen.ts) · [Testbed 검사](sample/nelyx-demo-app/eng/check-localization.mjs)
- [x] 같은 SDK 공급본으로 Web 릴리스, Windows 설치 패키지 안의 실행 파일, Android x86_64 에뮬레이터를 구동했다. 각 환경에서 확인한 범위를 §8에 기록했다. [호스트 현지화 검사](sample/nelyx-demo-app/eng/check-localization.mjs)

| 검사 | 완료 기준 |
| --- | --- |
| IntlProvider | Web과 Tauri에서 공용 provider를 연결한 delegate로 `ko-KR` 앱과 `en-US` 다이얼로그를 열고 각 로케일의 날짜 규칙이 적용되는지 확인한다. 필요한 로케일이나 `formatToParts`를 제공하지 못하는 경우 기존 기본 날짜 포맷·힌트·파서가 함께 적용된다. |
| Flutter ARB 일괄 가져오기 | 고정 커밋의 348개 입력이 모두 집계되고 두 번째 생성 결과가 같으며 `--check`가 통과한다. 필수 키·placeholder 오류와 지역별 부분 상속을 검사한다. 한·영, 지역 변형 하나와 RTL 표본에서 실제 위젯 문구, 복수형과 접근성 이름을 확인한다. |
| 날짜 표시와 파싱 | `en`·`en-US`의 기존 월명과 입력 형식을 확인한다. `ko`·`ko-KR`에서 단일·범위의 동일 날짜와 요일 헤더, 접근성 문구와 입력 힌트가 일치한다. 중립 태그, 기존 범위 선택기의 `en-GB`, RTL 숫자 표본도 확인한다. |
| 날짜 선택과 편집 | `2024-02-29`가 포맷 후 같은 날짜로 파싱되고 `2023-02-29`·잘못된 월말·범위 밖 날짜는 각 입력 규칙에 따라 오류로 처리한다. 다른 시간대에서 동일한 연·월·일이 왕복한다. 날짜 선택, 이전 값 복원, 취소·확인, 열린 달력의 언어 전환, 사용자 포매터 우선권을 검사한다. |
| 초기 로드와 전환 | 동기·비동기 성공, 초기/복구 실패, 전환 실패, `en-US → ko-KR → en-US`의 응답 역순과 닫힌 뷰에 도착한 응답을 확인한다. 성공한 확정 상태만 화면에 나타나고 첫 콘텐츠, 라우트, 기존 편집 상태가 정상이다. 시스템 언어 모드에서 환경 이벤트를 반영하고, 명시 로케일이 있으면 기존 우선권을 따른다. |
| 방향·입력·접근성 | 같은 문구의 로케일만 바꾸거나 RTL 다이얼로그를 열어 해당 DOM 경계, 포커스된 입력과 접근성 노드의 `lang`·`dir`을 관찰한다. 각 뷰와 하위 트리는 자신의 로케일을 적용한다. 한글 조합과 RTL 혼합 텍스트에서 입력·선택·캐럿을 확인한다. 실제 IME와 스크린 리더 발화를 확인한 환경을 기록한다. |

SDK 빌드 후 앱의 실제 진입점을 구동하고 패키지와 페이지의 `buildId`를 대조했다. §8의 검사에는 20분 제한을 적용했다. 각 실행의 임시 파일·서버·프로필은 `finally`에서 정리한다. [공용 빌드 스크립트](package.json#L20) · [저장소 검증 규칙](.github/copilot-instructions.md)

## 7. 앱 번역 규모가 커질 때

현재 앱 자체의 문구는 `messages`와 `Localizations.text(key)`로 공급할 수 있다. 여러 앱에서 앱 소유 ARB의 ICU `plural`·`select`와 placeholder를 빌드 시점에 확인해야 할 때, Doroti의 생성기처럼 타입 있는 TypeScript 메시지와 delegate를 생성하는 계획을 잡는다. [Nelyx 앱 템플릿](Nelyx/sdk/tooling/cli/templates/nelyx-app/src/app.ts#L636) · [Doroti ARB 생성기](../DorotiLab/tools/Doroti.Localization.Generator/README.md)

## 8. 구현과 검증 결과

- Material 단일·범위 달력과 독립 날짜 입력란이 같은 Gregorian 포매터, 입력 예시, 파서를 사용한다. 날짜 입력란은 언어 전환 중 편집 중인 값과 파서를 유지하고 유효한 입력이 끝나면 새 로케일로 표시한다. 범위 달력은 언어 변경 시 현재 표시 월을 유지하고 화면 밖 월에 쓰는 문단 리소스를 줄였다. Cupertino 월명도 공용 `IntlProvider`를 사용한다. [IntlProvider](Nelyx/src/framework/widgets/intl-provider.ts) · [Material 날짜 처리](packages/material/src/internal/date/date-localizations.ts)
- `WidgetsApp`은 성공한 delegate 리소스, 로케일, 앱 문구와 fallback을 함께 적용한다. 초기 실패 시 첫 지원 로케일을 한 번 시도하고, 이후 전환 실패는 마지막으로 확정된 화면을 유지한다. 문서와 뷰·다이얼로그의 접근성 언어를 갱신하고, 연결된 DOM 편집기는 같은 세션으로 언어와 방향을 받는다. 별도 Material 창은 자체 `Overlay`를 소유한다. [앱 로케일 확정](Nelyx/src/framework/widgets/app.ts) · [DOM 편집과 접근성](Nelyx/sdk/src/backends/browser/interaction.ts) · [별도 Material 창](packages/material/src/dialog.ts)
- 고정 커밋의 348개 ARB를 Widgets 117개, Material 116개, Cupertino 115개로 가져왔다. 생성 카탈로그에는 스크립트 기본값과 지역 별칭을 포함해 각각 122개, 121개, 120개 태그가 있다. Flutter ARB에서 자리표시자 이름이 맞지 않던 세 곳을 바로잡고 바스크어 접미사가 붙은 두 곳에 자리표시자 경계를 표시했다. 원본 blob과 SHA-256, 정규화 내용을 출처 파일에 남겼다. 기존 시간 입력용 숫자 데이터와 Cupertino 휠 날짜 규칙은 계속 사용한다. [일괄 가져오기](tools/Nelyx.FrameworkToTypeScript/import-flutter-localizations.mjs) · [Widgets 출처](Nelyx/licenses/flutter-localizations-sources.json) · [Material 출처](packages/material/licenses/flutter-localizations-sources.json) · [Cupertino 출처](packages/cupertino/licenses/flutter-localizations-sources.json)
- Demo의 Material 메뉴에서 **Language and dates**를 열면 한·영 및 시스템 언어, 단일·범위 날짜 입력, 영어·포르투갈어·아랍어 다이얼로그를 확인할 수 있다. `?dialogWindows=1`로 열면 범위 다이얼로그에 별도 창을 사용한다. Testbed의 Material 시간 입력은 숫자 키보드와 일치하도록 한 줄 편집기를 쓴다. [Demo 화면](sample/nelyx-demo-app/src/localization-screen.ts) · [Playwright 검사](sample/nelyx-demo-app/eng/check-localization.mjs)

| 환경 | 확인 결과 | 빌드 ID |
| --- | --- | --- |
| Demo Web 릴리스 | 단일·범위 달력, 독립 날짜 필드, 사용자 delegate 우선권, 로케일 경합과 실패 복구, RTL·별도 다이얼로그, `INPUT`의 포커스·선택·한글 조합 유지 통과 | `3822cd6f012826aa7e5970b53ad87b29f2cabc9968e367d0dfdf1c131a194a8e` |
| Testbed Web 릴리스 | Material 날짜·시간 다이얼로그와 Cupertino 날짜·타이머 휠 통과. W11 전체 회귀도 통과 | `555ce0ddbd598c266532232cf4d7e1c31b6347ed0c0ed22647db7d6077f79425` |
| Windows x64 Tauri | NSIS 패키지의 해시를 대조한 뒤 추출본을 WebView2에서 구동했다. 날짜 다이얼로그, 독립 날짜 필드, RTL, EditContext의 포커스·선택·한글 조합 유지 통과 | `831c4e85559040b45509aabc89eb0461687efddc957abb5416d557328785e236` |
| Android 13 x86_64 에뮬레이터 | 서명된 디버그 APK를 `emulator-5554`에 설치했다. WebView 109에서 영어를 지정한 다이얼로그, 시스템 언어 테스트 이벤트, `INPUT`의 포커스·선택 유지 통과 | `831c4e85559040b45509aabc89eb0461687efddc957abb5416d557328785e236` |

두 시간대 `Pacific/Kiritimati`와 `America/Los_Angeles`에서 윤일 왕복, 잘못된 날짜, Intl 기본값과 로케일 변형을 검사했다. ARB의 필수 키·자리표시자 오류와 지역 상속을 검사했고, 고정 Flutter 커밋으로 재생성한 결과가 `--check`를 통과했다. Core·Material·Cupertino 공급본의 세 아카이브에서 컴파일된 카탈로그, 원본 해시 기록, Flutter 저작권 고지를 확인했다. [브라우저 검사](Nelyx/eng/fixtures/w6-localizations.mjs)

W11 회귀 검사에서 한국어 탭의 순서 설명과 시간 다이얼의 캔버스 동작을 관찰하도록 했다. Cupertino 액션 시트에서 한 차례 클릭 타이밍으로 실패했고 마지막 전체 실행에서는 통과했다. [W11 회귀 검사](sample/nelyx-testbed-app-2/eng/check-w11-design-demos.mjs)

### 재현 명령

```powershell
node tools/Nelyx.FrameworkToTypeScript/import-flutter-localizations.mjs C:/Users/parti/flutter --check
npm.cmd run build:web -- --app sample/nelyx-demo-app
node sample/nelyx-demo-app/eng/check-localization.mjs
npm.cmd run build:web -- --app sample/nelyx-testbed-app-2
node sample/nelyx-demo-app/eng/check-localization.mjs --testbed
node sample/nelyx-testbed-app-2/eng/check-w11-design-demos.mjs
npm.cmd run build:tauri -- --app sample/nelyx-demo-app --platform windows
node sample/nelyx-demo-app/eng/check-localization.mjs --windows
npm.cmd run build:tauri -- --app sample/nelyx-demo-app --platform android --architecture x64 --apk-only
node sample/nelyx-demo-app/eng/check-localization.mjs --android
```

시스템 언어 전환은 Playwright에서 언어 목록과 `languagechange` 이벤트를 주입해 확인했다. Demo Web과 Windows의 한글 조합은 CDP 입력으로 재현했다. Android 13에서 ADB로 앱별 언어를 `ko-KR`로 설정했을 때 WebView 109의 `navigator.languages`는 `en-US`를 유지했다. 앱별 언어 설정과 기존 APK를 복구했다. OS 전체 언어 전환, 기기 키보드 조합과 스크린 리더 발화는 실기기 확인 항목으로 남았다.
