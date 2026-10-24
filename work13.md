# work13 — Core/Skia 자체 UI 렌더링과 W12 잔여 기능·공급 완성 계획

작성/전면 재검토일: **2026-10-19 KST**, 종료일: **2026-10-21 KST**. 계획: **CLOSED / SUPERSEDED BY W14**, 실행: **SUPERSEDED**, 종료 시 제품 전체: **PARTIAL**, `wholePlanComplete=false`.

사용자 요청으로 W13을 종료하고 **W13-01~11 전부와 R0~R6의 필수 잔여**를 [work14.md](work14.md)로 이관했다. **유일한 활성 계획은 W14**이며 `ACTIVE / READY 계획 · PAUSED 실행 · PARTIAL 제품`이다. 현재 계획·짧은 상태·재개 순서는 W14를 따른다. 아래 목표·체크리스트·§7의 상태/다음 작업은 **W13 당시 이력이며 현재 실행 지시가 아니다**. 이번 종료는 제품 전체 완료나 새 build/runtime/native/물리 검증을 뜻하지 않는다.

Core/Skia 자체 UI·M3 only·제품 TS 직접 개발·공통 통합 앱과 기존 구현/출처/소유권을 유지한다. §7.13의 편집/OS bridge·§7.14/§7.16~7.20의 성능 수정·§7.21의 resize 미확정 원인·§7.15의 CLI 구성·§7.22의 셰이더 분리와 미검증 조건도 W14 §4에 승계했다. 세부 종료·이관은 §8을 따른다. 삭제한 checkpoint/receipt/archive를 복원하거나 재개 조건으로 요구하지 않는다.

## 0. 유지할 결정과 범위

목표는 **Nelyx Core가 기본 위젯의 상태·layout/paint/hit/clip·입력/focus/selection을 소유하고 Skia로 화면을 그리는 제품**을 완성하는 것이다. 편집 중인 문자·조합 표시·caret·선택 영역도 같은 렌더 트리와 장면을 사용한다. native/DOM의 역할과 명시적 임베딩 예외는 §0.4로 제한한다. 제품 TS에서 공개/default API·오류/취소·복원/종료·성능·공급의 남은 조건을 해결한다. `tools/Nelyx.FrameworkToTypeScript` 수정은 필요한 공통 부분으로 제한한다. 이 사용자 결정은 이전 문서의 host 편집기 확장·변환기 우선 지시보다 우선한다. 파일·테스트·IR·reviewed marker 수로 기능 완료율을 계산하지 않는다.

| 항목 | W13 실행 기준 |
| --- | --- |
| 렌더링 소유권 | **Core/Skia 자체 렌더링은 전 단계의 필수 조건**이다. 기본 control·text/editing·caret/selection·menu/dialog/picker를 OS widget이나 보이는 HTML control로 대체하지 않는다. 플랫폼별 외형은 디자인 패키지가 같은 Core 위에서 구현한다. |
| 제품 소스 중심 개발 | `Nelyx/src`와 `packages/cupertino/src`·`packages/material/src`, 필요한 SDK/플랫폼 제품 owner에서 기능을 직접 구현·수정한다. 기능별 누락·상태/layout/paint/input·테마/default·수명 문제는 해당 제품 모듈에서 해결한다. 실제 공통 runtime 문제는 Core 등 공통 제품 owner에 반영한다. |
| 공통 구현·통합 앱 | `sample/nelyx-testbed-app-2`의 Material·Cupertino 페이지에서 실제 공개 제품 API를 소비한다. 각 기능 묶음은 제품 구현과 샘플의 정상/오류·입력·취소/복원·종료 흐름을 함께 완성한다. Core·개발·플랫폼·접근성·임베딩도 같은 앱의 목적별 시나리오로 연결한다. §0.3을 따른다. |
| 변환 도구 수정 범위 | `tools/Nelyx.FrameworkToTypeScript`는 여러 기능에 공통 적용되는 타입/숫자 출처 처리·IR/emitter 공통 동작·출력/import·소유권/merge/edit guard·도구 호환성의 필요한 수정만 한다. 개별 Widget/family를 위해 변환 능력·추출 범위·전용 recipe/adapter·회귀 기반을 계속 확장하는 작업은 W13 실행 범위에서 제외한다. 세부 기준은 §0.2를 따른다. |
| 디자인 개발 | **Core/Skia 렌더링 소유권을 먼저 적용**하고 Doroti.Cupertino / Doroti.Material의 기능 모듈·Widget/State/theme/helper 분리를 참고한다. Doroti의 host/native 구현 선택은 승계하지 않는다. pinned Flutter는 자체 RenderObject/편집·API/default·동작·숫자 의미 비교에 사용한다. |
| 간소화·누락 해소 | §1.4와 §3.3의 간소화/미구현은 **실제 제품 구현을 마쳐야 하는 필수 작업**이다. Doroti와 비교한 공개 API·default·State·layout/paint·입력·theme·route·수명을 끝까지 연결한다. 기능 이름·값/theme·고정 Row/Column·EditableText 전달 facade만으로 해당 기능을 완료 처리하지 않는다. |
| Material | **M3 only**. M2·`useMaterial3`·M2 전용 factory/overlay·2014/2018 typography·deprecated API/alias를 추가하거나 재생성으로 복구하지 않는다. current/2023 M3와 M3에서도 쓰는 공통 색상·shape·명시적 ink factory/hairline은 유지한다. |
| 구조·identity | 기능별 canonical owner와 명시적 공개 aggregate를 유지한다. Widget/Element/State/RenderObject·Color·편집 상태/geometry·입력/focus/ticker/semantics·View 자원은 Core가 소유한다. Core→design, Cupertino→Material, runtime→SDK/tooling 역의존과 내부→자기 `widgets` aggregate import를 차단한다. Material→Cupertino는 필요한 공개 subpath를 사용한다. Core 전체를 갈아엎지 않되, 이 원칙과 충돌하는 hosted RenderEditable/SDK 연결은 실제 owner에서 교체한다. |
| 생성·채택 | 기존 제품 TS를 개발 기준으로 삼고 mapping·recipe는 필요한 출처/소유권 확인에 재사용한다. 생성 파일을 직접 개발할 때는 명시적으로 adopt하고 필요한 소유권 정보를 갱신한다. 유지하는 생성 경로에는 기존 3-way merge/edit guard를 적용한다. 이후 기능 변경마다 변환기 수정·재생성·전체 mapping 갱신을 요구하지 않는다. 이동 시 필요한 destination/import/ownership/notice만 맞춘다. |
| 타입·숫자·출처 | 구체적인 TS 타입과 analyzer-resolved 숫자 의미, `@dartType`·`@dartParam`·`@dartReturn`을 제품 TS와 공개 `.d.ts`까지 보존한다. 값/이름으로 provenance를 추정하거나 자체 구현에 허위 Dart 출처를 붙이지 않는다. `any`·stub·가짜 기본값으로 미지원 의미를 통과시키지 않는다. |
| 소유권·수명 | caller 소유 focus/controller/registry/provider는 caller가 해제한다. 앱/View별 자원과 오류·취소·retirement·drain을 실제 owner에 연결한다. |
| 제품 공급 | 일반 build/runtime은 Dart SDK·변환기·scratch·Doroti .NET runtime에 의존하지 않는다. 코드·데이터·font/icon/shader/asset의 pin/hash/license/notice를 유지한다. |
| 기록·정리 | 현재 계획·짧은 상태·잔여 작업은 이 문서에, 제품 사용 안내는 기존 README에 쓴다. [저장소 지침](.github/copilot-instructions.md)을 우선하며 삭제한 기록·archive를 다른 폴더로 옮겨 누적하지 않는다. |

### 0.1 삭제한 검증 도구와 기록

`tools/Nelyx.FrameworkToTypeScript/checks`·`dart/bin/extract_platform_fixture.dart`·과거 ledger·`w11-resume.mjs`·`run-check.mjs`·검증 보고서·immutable receipt·checkpoint/history·복구 archive는 복원·전체 회귀·재개의 선행 조건이 아니다. `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`를 생성·복구하거나 출력 경로로 쓰지 않는다.

필요한 패키지 등록·recipe/수정 입력·생성 소유권·디자인 mapping은 [변환 입력 data](tools/Nelyx.FrameworkToTypeScript/data/), source notice는 [support-origins.json](Nelyx/licenses/support-origins.json)과 각 패키지 `licenses/`를 따른다. recipe가 삭제된 validator를 가리키면 과거 `resume all`·validate/promote를 그대로 실행하지 않고 **현재 제품 기준의 검증 경로부터 연결**한다. 검증 누락은 PASS가 아니다.

### 0.2 제품 소스 개발과 변환 도구의 공통 수정

**기본 작업 흐름은 제품 소스 확인 → 필요한 원본 비교 → 제품 구현·수정 → 제품 검증**이다. 변환 도구의 개선·원본 전체 추출·새 recipe 작성·재생성을 기능 개발의 선행 단계로 두지 않는다.

1. 실제 공개 API와 실행 경로에서 누락·오류를 찾고 해당 기능의 canonical 제품 TS owner를 수정한다. 먼저 §0.4의 렌더링/입력 소유권을 확인한다. Doroti는 모듈 책임 분리, pinned Flutter는 자체 렌더링·편집·API/default/동작의 비교 근거로 사용하며 host/native UI 선택을 복제하지 않는다.
2. 공통 Widget/State/rendering·입력·숫자/value·서비스 문제는 Core 등 공통 **제품** owner에서 해결하고 여러 소비자가 같은 구현을 사용하게 한다. 제품 기능을 변환기 내부 helper나 runtime shim에 맡기지 않는다.
3. 기존 생성 소스의 직접 수정이 필요하면 generated/adopted 상태를 확인하고 **명시적 adopted 전환과 최소 소유권 갱신 후 제품 소스에서 개발**한다. 기존 출처/license·유효한 숫자 주석을 보존하고 변경된 의미에는 출처를 정확히 맞춘다. 자체 코드에 허위 Dart 주석을 추가하지 않는다. 유지하는 생성 경로가 제품 변경을 덮어쓰지 않게 보호한다.
4. 도구 수정은 여러 기능에 공통 적용되는 처리의 보정·결함·호환성 문제를 해결하는 범위로 제한한다. 특정 class 이름이나 특정 recipe에 묶이지 않는 이유와 영향 범위를 확인하고 **공통 수정에 필요한 최소 변경 및 영향 제품 검증**으로 한정한다. 기존 source path·출처·ownership 같은 필수 데이터 정합성 갱신은 가능하며 이를 새 변환 기능 확장으로 이어가지 않는다.
5. 개별 Widget/family의 미지원 문법·private helper·의존 closure·default/painter/State 누락은 제품 TS에서 구현·보완한다. 이를 이유로 Dart/C# lowering·전체 body/IR 추출·family 전용 generator/adapter/recipe·검증 기록 체계를 확장하지 않는다. 변환 불가 의미를 `any`·stub으로 통과시키지 않고 제품의 구체적인 타입과 실제 동작으로 해결한다.

**검증과 완료의 기준은 제품**의 타입/공개 `.d.ts`·상태/입력/layout/paint·자원 수명·독립 소비·필요 플랫폼/공급이다. 도구 공통 수정이 필요한 경우에만 해당 공통 경로의 검증을 추가한다. 삭제한 변환기 checks 복원이나 전체 변환 replay를 요구하지 않는다. 공통 도구 수정은 별도 제품 단계가 아니며 W13-01~11의 기능 완료를 대신하지 않는다.

### 0.3 테스트베드 중심 구현·통합 방식

**`sample/nelyx-testbed-app-2`를 W13 전 단계의 공통 실행 앱으로 사용한다.** Material·Cupertino 페이지는 제품을 실제로 조작하고 문제를 재현하는 입구다. 기존 29개 Material 섹션과 새 20개 Cupertino 섹션을 시작점으로 삼되, 이 카탈로그를 전체 제품 범위의 상한으로 삼지 않는다. 표·복합 scroll·route/복원·multi-View·접근성·임베딩 등 필요한 시나리오는 같은 앱에 추가한다. 화면이 필요 없는 내부 계약은 해당 제품 회귀와 연결한다.

1. **기능과 재현 흐름을 함께 정한다.** 각 묶음의 실제 누락·제품 owner·공개 API/default·관련 W13 단계를 확인하고, 해당 샘플 페이지의 조작 순서와 기대 결과를 정한다. 정상/disabled/error·keyboard/focus·취소/복원/종료 등 해당 family에 필요한 조건을 포함한다.
2. **제품을 구현하고 공개 API로 소비한다.** Core/디자인/SDK/플랫폼의 canonical 제품 owner를 수정한 뒤 샘플에 연결한다. 샘플 전용 Widget·painter·입력/route shim으로 누락 제품 기능을 대체하거나 내부 경로를 import하지 않는다. 공통 제품 결함은 실제 owner에서 해결한다.
3. **같은 흐름과 렌더링 owner를 통합 검증한다.** 필요한 제품 회귀와 샘플 Root 통합 검증을 실행하고 Web에서 실제 Skia 화면·pointer/keyboard·배율/테마·State/자원 수명을 확인한다. 편집 UI를 포함한 Core paint와 비시각적 OS 입력 연결을 분리해 확인하며, 관련 변경은 동일 앱의 Windows/Android runner와 현재 공급본에서 검증한다. 물리 IME/caret·GPU/FPS·접근성 reader는 별도 실제 관측을 유지한다.
4. **구현 상태와 검증 상태를 구분한다.** 카탈로그의 `planned`는 데모 미제공, `basic`은 제품 기본 API의 제한된 데모, `ready`는 현재 데모 제공을 뜻한다. `ready`만으로 family·W13 단계 완료를 뜻하지 않는다. 해당 제품 구현과 §3.5/6의 완료 조건을 충족한 뒤에만 작업을 닫는다. 제한이 해소될 때 해당 설명과 데모를 함께 갱신한다.
5. **현재 상태만 남긴다.** 이 문서에는 기능 묶음의 결과/제한·잔여·다음 작업을, 샘플 README에는 현재 사용법과 재현 순서를 쓴다. 샘플 내부에 별도 완료 ledger·보고서/archive 체계를 만들지 않는다.

| W13 범위 | 같은 테스트베드에서 완성할 사용 흐름 | 별도로 유지할 검증 조건 |
| --- | --- | --- |
| 01 디자인·locale | 양쪽 gallery의 실제 component·theme/default·locale/RTL·Form/route 조합. §3.3의 기능별 시나리오를 연결한다. | 독립 원본 기대값·공개 타입/identity·독립 패키지 소비·asset/notice. |
| 02 scroll·viewport | 긴 목록·mixed sliver·Page/Nested/sheet·선택/편집 중 resize/mutation·복원. | layout/paint/hit·성능·실제 backend·controller/State 수명. |
| 03 runtime·paint·입력 | image/font/text·animation·theme 변경·오류/복구·앱/View 반복 열기/닫기. | worker/cache/retirement/drain·wide-gamut·GPU와 실제 출력. |
| 04 편집·Form | 양쪽 text/Form 페이지의 다중 필드·validation·grapheme/조합·selection/scroll·undo·복원. | 실제 OS/물리 IME·caret pixels·multi-View/provider. |
| 05 앱·라우팅·복원 | 양쪽 기본/named/nested route·dialog·Back·locale·OS link·process recreation. | 실제 native producer·저장/복원·취소/drain/종료. |
| 06 플랫폼·공급 | 같은 앱의 Web/Windows/Android runner로 동일 공개 제품을 소비한다. | 여섯 target 공통 코드/공급 구성·선택 설치·독립 consumer·§6.2 예외. |
| 07 개발 갱신·inspector | 이 앱의 Widget 코드를 수정해 값/편집/route State 유지 또는 명시적 remount·진단·실패 회복을 확인한다. | 실제 dev 세션·reassemble/source map·native cleanup. |
| 08 실제 환경·감사 | 같은 앱의 현재 source/artifact로 전체 선정 흐름·resize·종료·안정성을 재현한다. | EXE/APK·물리 입력/FPS·GPU loss·signing/clean-machine·배포/출처. |
| 09 접근성 | 양쪽 control/Form/route의 설정 반영·semantics/action·focus/reader 흐름. | native 설정 producer·제출/ack·실제 reader·owner 실패 회복. |
| 10 임베딩 | 같은 앱의 native/HTML view 페이지에서 scroll/route/overlay/reload·clip/transform·focus/input·해제. | 실제 host 합성/texture/z-order·실패/복구·영향 공급. |
| 11 최종 통합 | 두 디자인 페이지와 추가 시나리오를 현재 공급본으로 검증하고 사용 안내를 정리한다. | 전체 비제외 요구·독립 소비·플랫폼/배포·출처와 `notVerified` 감사. |

갤러리 조작·스크린샷·샘플 build만으로 전체 제품 완료를 판정하지 않는다. **제품의 온전한 구현 → 샘플 공개 소비/실제 흐름 → 필요한 회귀·플랫폼·공급**을 한 묶음으로 닫는다. 이번 Cupertino 페이지 추가는 이 실행 기반의 확장이며 01C의 간소화·누락 구현을 완료 처리하지 않는다.

### 0.4 Core/Skia와 플랫폼의 필수 책임 분리

**기본 UI의 유일한 시각적 원본은 Core의 render tree와 Skia 장면이다.** 기존 Skia/SkParagraph·Graphite/Vulkan·Web Ganesh/WebGL2 및 런타임/호스팅 기반은 활용한다. RN/WinUI/Android/DOM을 창·surface·OS 서비스 연결에 쓰는 것과 OS control에 기본 위젯을 그리게 하는 것을 구분한다. RN 제거 또는 Dart 도입이 이번 수정의 목표는 아니다.

| 책임 | 최종 owner와 계약 |
| --- | --- |
| 기본 위젯의 layout/paint/hit/clip | Core RenderObject·painting·gesture 경로. Material M3/Cupertino는 이 경로를 조합한다. 버튼/슬라이더/목록뿐 아니라 AppBar·tab·dialog·sheet·menu·search·picker·table·overlay에도 동일하게 적용한다. |
| 글꼴·text layout·시각 | 앱의 검증된 font bytes와 Core TextPainter/SkParagraph를 사용해 glyph·fallback·weight/italic·spacing/strut·baseline·줄바꿈/RTL·text scale을 측정하고 Skia로 그린다. native 편집기의 font registry나 측정값을 기본 UI 렌더링의 선행 조건으로 두지 않는다. |
| 편집 UI | Core EditableText/RenderEditable·selection/overlay가 문자·obscure 표시·composing underline·caret 위치/색상/점멸·선택 영역/handle·toolbar/magnifier·scroll/hit/drag를 소유한다. 같은 paragraph geometry를 layout·paint·pointer→text position에 사용한다. |
| 편집 상태·IME | Core controller/selection/formatter/undo/Form이 제품 상태를 소유한다. OS IME가 발생시킨 실제 text delta/조합/선택/제출은 입력 bridge로 받아 동기화한다. session/revision/token·late callback·취소/종료를 검사하고, Core의 programmatic 상태와 native 입력 동기화 acknowledgement의 책임을 분리한다. 조합 완료/취소를 추측하거나 성공을 꾸미지 않는다. |
| 좌표 전달 방향 | **Core paragraph/caret/selection geometry → View transform·clip·DPI → OS IME 후보창/접근성 bounds**다. native RichEdit/UIA/EditText/DOM 선택 사각형을 Core 편집 UI의 layout/paint/hit 원본으로 역수입하지 않는다. 단위·matrix·scroll·epoch를 명시한다. |
| 플랫폼 연결 | window/surface/GPU·event loop·raw pointer/keyboard·IME/가상 키보드·autofill/clipboard·system chrome/haptic·locale·OS link·accessibility transport를 담당한다. OS IME 후보창·가상 키보드·시스템 autofill 제안은 OS UI이며 기본 위젯의 시각 owner를 바꾸지 않는다. |
| Web | canvas/Skia가 기본 UI와 편집 UI를 그린다. DOM input/textarea/contenteditable/EditContext 등은 필요한 IME/autofill/접근성 연결로 한정하고 보이는 문자·caret·선택/배경·브라우저 기본 control 외형을 중복 표시하지 않는다. 단순 `opacity:0` 적용을 전환 완료로 보지 않고 OS 조합/터치/포커스/좌표를 검증한다. |
| 접근성 proxy | Core semantics의 role/value/selection/bounds/action을 OS/DOM에 전달한다. 시각적으로 독립된 control 또는 별도 focus/validation/activation 정책을 만들지 않는다. 중복 click/key/action·중복 focus order·중복 reader node를 방지한다. |
| 명시적 native/HTML view | W13-10의 PlatformView 계열로 앱이 명시적으로 요청한 외부 view만 예외다. 경계·texture/z-order·clip/focus·수명과 예외 영역을 드러낸다. TextField·기본 dialog/menu/picker를 이 예외에 숨기지 않는다. |

Flutter의 자체 위젯 렌더링과 RenderEditable/TextInput 책임 분리를 비교 근거로 삼는다. RenderEditable은 text·선택·cursor를 그리며 시스템 입력 상태는 TextInput 연결로 동기화한다. 이 구분을 Nelyx의 Core/Skia와 플랫폼 bridge에 적용한다. [Flutter architecture](https://docs.flutter.dev/resources/architectural-overview#flutters-rendering-model), [RenderEditable](https://api.flutter.dev/flutter/rendering/RenderEditable-class.html), [TextInput](https://api.flutter.dev/flutter/services/TextInput-class.html).

### 0.5 아키텍처 전환의 우선 실행 순서

아래 **R0~R6은 기존 11단계를 대체하거나 축소하는 새 완료 목표가 아니라 그 단계들에 걸친 필수 선행 전환**이다. 현재 **R0/R1/R2 선정 구현 PARTIAL**, R3~R6은 OPEN이다. 전체 구현 실행은 사용자 요청으로 PAUSED이며 선정 구현/검증을 단계나 family 전체 완료로 올리지 않는다. 각 단계에서 필요한 OS 연결·접근성·공급은 함께 처리하며, 문서 작성만으로 완료하지 않는다.

| 순서 | 실제 구현·수정할 owner | 완료를 증명할 결과 |
| --- | --- | --- |
| **R0 경로 감사·계약 확정** | Core RenderEditable/EditableText/TextInput·SDK Web/RN surface/interaction·6개 target의 input/semantics/runner·기존 tests를 읽어 시각/상태/좌표 owner를 분류한다. raw input, Core 편집 명령, OS IME 상태 동기화와 acknowledgement를 분리하고 필요한 공개 API/default를 pinned Flutter와 비교한다. | 기본 위젯의 모든 보이는 native/DOM 경로와 우회 경로, 재사용/교체/삭제 대상·의존/전환 순서가 실제 소스와 대응한다. 파일 이름의 native 여부나 renderer class 존재만으로 통과시키지 않는다. |
| **R1 Core 편집 renderer** | `Nelyx/src/framework/rendering/editable.ts`, `widgets/editable-text.ts`, TextPainter/paragraph·selection/overlay. hosted 배치 전용 RenderEditable을 실제 text/selection/caret paint·hit/scroll owner로 완성한다. glyph 위치·줄/word/grapheme/UTF-16 affinity·bidi·baseline/strut·min/maxLines/expands·obscure·clip·caret blink/색상·composing 표시를 연결한다. | 여러 줄·한글/emoji/결합 문자·혼합 RTL·배율·font/style 변경에서 같은 Skia paragraph의 paint와 hit/selection/caret가 일치한다. 빈 값/마지막 개행·overflow/scroll·route/해제·자원 상한도 확인한다. |
| **R2 OS 입력 bridge** | Core TextInput/EditingHost 계약과 Web·Windows·Android SDK/native adapter를 재구성한다. OS text delta/조합·선택/제출·show/hide keyboard·readOnly/obscure·keyboard/capitalization·autofill/section·취소/복원을 연결하고 Core geometry를 OS로 전달한다. | 플랫폼별 실제 조합의 시작/변경/확정/취소·surrogate/selection·formatter·Undo/Redo·clear/reset·Next/Done·focus 변경·late/stale 요청·해제를 검증한다. native 내부 shadow state는 동기화용이며 glyph/geometry/UI 정책 owner가 되지 않는다. 미지원 API는 구체적 잔여로 남긴다. |
| **R3 양쪽 TextField/Form 통합** | Material/Cupertino의 기존 장식·Form·controller/focus 수명을 R1/R2에 연결하고 SDK surface가 일반 TextField를 보이는 native/DOM editor로 덮지 않게 전환한다. native/DOM typography와 geometry를 공급하던 의미를 Core owner와 OS bridge metadata로 분리한다. | 같은 테스트베드에서 양쪽 입력·validation·clear/Undo·reset·다중 필드/제출·keyboard resize·디자인/테마/locale 왕복·scroll/route/복원/해제를 현재 Windows/Android/Web 공급본으로 확인한다. |
| **R4 모든 기본 UI·semantics 감사** | 기존 01B·01C/scroll/route/overlay·Web/RN semantics proxy·keyboard/focus·inspector의 실행 경로를 감사한다. native button/text/menu/dialog/picker나 보이는 HTML을 기본 UI 구현으로 사용하는 경로를 제거/교체한다. 이후 새로 구현할 family에도 같은 기준을 적용한다. | 현재 구현의 기본 UI·입력 시각/상태/gesture/focus는 Core 경로이고, 접근성 action은 같은 상태에 한 번 도달한다. reader/OS keyboard 연결과 Core clip/transform·hit/semantics 일치를 별도로 검증한다. 아직 없는 family의 구현 완료를 이 선행 감사의 조건으로 섞지 않으며, 해당 family 완료 시 다시 확인한다. |
| **R5 이전 경로 정리·공급 전환** | 보이는 native/DOM 편집기 전용 component/port·font/style/geometry projection·host/template 등록·JS asset 입구의 native editor font 필수 검사·obsolete public alias와 회귀를 실제 사용 관계에 따라 제거/교체한다. bytes/hash/license·Skia font 공급·공통 Metro 초기화/수명 기반은 보존한다. | 기본 provider·생성 템플릿·6 target 공통 설정·README·package/exports/lock·현재 archive/독립 소비가 한 구조를 사용한다. 구형 visible editor를 자동 fallback이나 숨은 선택지로 유지하지 않는다. 필요한 비시각적 IME carrier와 명시적 임베딩은 §0.4 조건을 별도 충족한다. |
| **R6 렌더링 소유권·실제 환경 검증** | §6.1의 검증에 Core frame/paragraph/paint 경로 확인과 현재 Windows EXE·Android APK·Web의 입력/편집 실제 흐름을 결합한다. | Skia 장면 자체에 편집 glyph·caret·selection/composing paint가 있고 기본 UI를 native control texture로 우회하지 않음을 증명한다. 전체 창 screenshot·native font pixels·mock·타입검사만으로 통과시키지 않는다. OS 입력/reader·물리 IME/caret·GPU/FPS는 각각 필요한 실제 관측과 §6.2 경계를 유지한다. |

기존 native-control 전용 fixture가 계속 녹색인 것은 R1~R6 완료 증거가 아니다. 일반 계약 회귀는 새 owner의 실제 동작을 검사하도록 이관하고, 폐기 경로 회귀는 대체 검증과 소비자 전환을 마친 뒤 정리한다. 전환 중 기존 앱이 실행되더라도 아키텍처 조건 미충족 상태는 **PARTIAL**로 유지한다.

## 1. 이관 기준선과 재사용할 구현

### 1.1 최초 이관에서 확인한 상태

- 최초 이관 당시 Nelyx HEAD: `f884c61296b0f22bbab8a95d3dae0eb7fb4d1c1e`. 당시 편집 전 tracked 변경은 없었고 사용자 생성의 빈 `work13.md`만 untracked였다. 이후 W13 구현 변경과 현재 중단 상태는 §7을 따른다.
- W12는 긴급 정리 후 `PAUSED / PARTIAL`이었다. 과거 검증 산출물은 삭제됐으며 새 결과처럼 재작성하지 않는다.
- 기존 디자인 mapping의 Flutter pin은 `71e4717a61786faab4c7aa39825989305ed29e8a`다. 기록된 `.tmp/work6/flutter-source` 경로는 최초 이관 시 존재하지 않았다. 원본 비교가 필요한 묶음에서만 같은 revision의 필요한 입력을 확보하고 bytes를 확인한다. 과거 캐시·보고서 전체 복원을 요구하지 않는다.
- 최초 이관 시 Doroti checkout HEAD는 `52141798d2a8b3c80bd8ab8e74dca565cf612d12`이며 두 디자인 패키지에 scoped dirty 변경이 없었다. 이는 당시 참조 위치 확인이며 기능 동등성 검증이 아니다. 구현 재개 시 사용할 파일과 revision을 다시 확인한다.
- 최초 이관은 문서·소스/manifest·기존 테스트/소유권의 정적 확인과 단계 대응이었다. 이후 구현/선정 실행 결과는 §7에 한정한다. 이번 전면 재검토도 문서·현재 소스의 정적 확인이며 build·제품 테스트·browser·native·물리 검증을 새로 실행하지 않았다.

### 1.2 완료한 부분을 다시 시작하지 않을 기준

W12의 오래된 미체크 항목보다 현재 제품 소스와 후속 구현을 확인하되 **§0.4와 일치하는 책임만 재사용**한다. 아래는 재사용 후보와 과거 선정 검증 범위이며 이번 검토의 새 PASS가 아니다. API나 native-control fixture가 있다는 이유로 잘못된 렌더링 owner를 보존하지 않는다. 일반 기능 기반 보존과 충돌 경로 교체는 함께 진행한다.

| 재사용할 기반 | W13에서 남길 작업 |
| --- | --- |
| STRUCTURE-0~2의 기능 owner 분리, `widgets`의 명시적 export, `internal/<family>`·`generated/<family>`, 현재 boundary/ownership 검사 | §3.1의 **STRUCTURE-3 선정 검증 결과를 재사용**하고 이번 전환으로 영향받는 공개/독립 소비·공급을 갱신한다. 경계 검사기는 이미 공개 facade와 순환/역의존을 다루므로 과거의 일괄 재export 금지 상태로 되돌리지 않는다. |
| Material/Cupertino Radio·Switch·adaptive, Checkbox와 세 toggle ListTile, typed RadioGroup | 전체 공개/default·theme 우선순위·독립 기대값·Root 입력/paint·상태 교체/복원/해제·공개 타입과 영향 backend/공급의 남은 조건 감사. |
| ColorScheme seed/image 생성, M3 typography/script scale·locale geometry, adaptation/extension·theme bridge, ButtonStyle/IconButton·구체 버튼 family·component theme 값 | 이미 존재하는 기능을 신규 미구현으로 되돌리지 않는다. floating/wide-gamut 색·전체 locale/font·진단·motion·개별 control 연결 등 실제 누락만 보완한다. |
| `ThemeData.raw/copyWith/lerp`, factory/system-color 경로, `Theme`·`AnimatedTheme` 구현과 회귀 fixture | 현재 소스의 API/value/상태/수명·통합 계약을 감사한다. 과거 README의 “미완료” 문구만으로 전체를 재작성하지 않는다. |
| FadeForwards/Zoom/snapshot·Cupertino route/back gesture·predictive back와 PageTransitionsTheme | App/실제 route·플랫폼 producer·OS Back·theme/locale·복원/종료 통합과 최신 공급·실제 환경 조건. 유한 원본 receiver와 실제 Core/플랫폼 결과를 구분한다. |
| RefreshProgressIndicator·swipe RefreshIndicator, Card·Badge·CircleAvatar, SafeArea/SliverSafeArea, Icon/font·InkSparkle와 View별 cache | 선정 구현을 재사용하고 sheet/scroll·복합 family·locale·자원 수명·native/물리·최신 공급의 남은 조건을 닫는다. |
| Core OverflowBar와 MediaQuery/TextScaler 배율 접점 | 이관 당시 디스크 부족으로 독립 설치가 미완료였다. **§7.3에서 현재 archive/설치 bytes·Root·Web 공급 조건을 해결**했다. W12 결과를 최신 PASS로 재사용한 것이 아니다. |
| wheel/2D/tree/Viewer/Scrollbar/behavior, editor/app/service/restore, 과거 Windows/Android/Web 선정 결과 | 남은 기능 조합과 최신 source/artifact의 플랫폼 입력·성능·수명·공급을 검증한다. 과거 offscreen/emulator 결과로 물리 입력·scanout/FPS·최신 전체 native parity를 주장하지 않는다. |
| TypeScript 7 도입 | §6.4의 역할 분리를 유지한다. compiler 도입 완료와 제품/플랫폼 전체 완료를 구분한다. |

### 1.3 현재 디자인 소스에서 구현을 확인한 범위 — 2026-10-19 KST

아래는 **제품 본문·공개 export/manifest·관련 테스트 선언/본문의 정적 확인**이다. `구현 존재`는 신규 구현 대상으로 다시 잡지 않는다는 뜻이며 전체 API 동등성·현재 테스트 PASS·독립 공급·native/물리 검증 완료를 뜻하지 않는다. 이번 검토에서는 테스트/build를 실행하지 않았다. §1.4의 간소화·미구현과 §1.5의 통합/실제 환경 잔여를 별도로 진행한다.

| 범위 | 실제 확인한 제품 구현과 검증 접점 | 계획에 반영할 판단 |
| --- | --- | --- |
| 공개 구조 | 양쪽 `widgets.ts`의 명시적 재export, 기능별 단일 owner와 `internal/`·`generated/`, [경계 검사](Nelyx/eng/package-boundaries.mjs)·[소유권 검사](Nelyx/eng/check-design-ownership.mjs), [구조](packages/material/tests/structure.test.mjs)·[RN Babel](packages/material/tests/source-structure.test.mjs)·[import-order](packages/material/tests/import-order.test.mjs) 회귀가 있다. | STRUCTURE-0~2와 검사기 구현을 다시 만들지 않는다. §3.1의 STRUCTURE-3 결과를 재사용하고 현재 변경의 영향 검증/공급과 실제 발견한 결함을 처리한다. |
| controls/tile | [Material Radio](packages/material/src/radio.ts)·[Switch](packages/material/src/switch.ts), [Cupertino Radio](packages/cupertino/src/radio.ts)·[Switch](packages/cupertino/src/switch.ts), Checkbox와 세 toggle ListTile의 본문·adaptive/State·공통 Core 입력 연결, 대응 회귀가 있다. | 이전의 finite Radio/Switch만 존재하는 상태로 되돌려 계획하지 않는다. 공개/default·상태/paint/input·소유권 검증의 남은 조건만 닫는다. |
| 색·typography·theme | [ColorScheme](packages/material/src/color-scheme.ts)의 seed/image 경로, [Typography](packages/material/src/typography.ts), [ThemeData](packages/material/src/theme-data.ts)의 raw/factory/copyWith/lerp·값/진단·system-color 처리, [Theme/AnimatedTheme](packages/material/src/theme.ts)가 있다. [full-theme](packages/material/tests/full-theme.test.mjs)·theme-factory/theme-widget 회귀가 연결된다. | seed·typography·ThemeData raw/lerp·AnimatedTheme를 신규 미구현으로 잡지 않는다. 전체 locale/font·floating/wide-gamut·실제 control 소비/플랫폼 통합 잔여를 확인한다. |
| 버튼·theme 값 | ButtonStyle/IconButton·Filled/Elevated/Text/Outlined 버튼, component-theme 값/lookup, InputDecorationThemeData와 표준 InputBorder가 있다. [버튼 회귀](packages/material/tests/concrete-buttons.test.mjs)·[입력 theme 회귀](packages/material/tests/input-theme.test.mjs)·component-themes 회귀가 있다. | theme 값의 존재와 해당 Widget 구현을 구분한다. InputDecorator의 선정 구현은 §7.4이며 전체 입력·메뉴·picker의 잔여는 §1.4에 남긴다. |
| route/App 통합 | [MaterialPageRoute](packages/material/src/page.ts)는 Theme의 transition builder/duration과 실제 PageRoute owner를 사용한다. [MaterialApp](packages/material/src/app.ts)은 home/named route의 `pageRouteBuilder`에 이를 설치하고 AnimatedTheme를 사용한다. [Cupertino route](packages/cupertino/src/route.ts), PageTransitionsTheme·predictive back·snapshot 본문과 관련 회귀도 있다. | **MaterialPageRoute/AnimatedTheme를 MaterialApp에 새로 연결하는 작업은 제거**한다. CupertinoApp 기본 route 연결도 §3.4에서 선정 검증했다. OS Back/locale/복원·현재 공급/실제 환경의 잔여는 유지한다. |
| 복합 선정 구현·Core layout | RefreshIndicator·Card·Badge·CircleAvatar, Cupertino 목록, Core SafeArea/SliverSafeArea·[OverflowBar](Nelyx/src/framework/widgets/overflow-bar.ts)·MediaQuery 배율 helper와 회귀가 있다. | 신규 구현 목록에서 제외하고 실제 조합/자원 수명·영향 회귀/공급만 진행한다. OverflowBar의 마지막 독립 설치 조건은 §7.3에서 해결했다. |
| selection/localization | [SelectionArea](packages/material/src/selection-area.ts), Core SelectableText/SelectionOverlay·양쪽 toolbar/selection controls가 있다. [MaterialLocalizations](packages/material/src/material-localizations.ts)는 selection/refresh label·script category, [CupertinoLocalizations](packages/cupertino/src/cupertino-localizations.ts)는 selection 메시지를 공급한다. | selection을 전부 신규 개발하지 않는다. 현재 locale 목록/데이터를 전체 날짜/시간·일반 메시지·delegate API 구현으로 계산하지 않는다. |

### 1.4 실제 간소화·미구현으로 남은 디자인 범위

두 디자인 패키지와 Core의 제품 TS 정의 및 공개 입구를 검색하고, 아래 간소화 모듈은 본문까지 확인했다. **미구현**은 표에 적은 실제 Widget/함수 정의·공개 공급을 확인하지 못한 범위다. 동명의 `*ThemeData`/enum·원본/recipe가 있어도 Widget 구현으로 세지 않는다. 범용 기능의 M3-only/deprecated 제외는 §0을 따른다.

| 판정 | 현재 소스/범위 | 구체적으로 남길 제품 작업 |
| --- | --- | --- |
| 간소화 | [Material Scaffold](packages/material/src/scaffold.ts)는 title/body/trailing과 고정 Padding/Column·AppTheme 조합이다. | 실제 Scaffold slot/layout·inset/keyboard·app bar/FAB/drawer/messenger 등 선정 공개 API·State/수명 구현. |
| 선정 API/장식 구현 / 렌더링 전환 필수·PARTIAL | [Material TextField](packages/material/src/text-field.ts)와 [CupertinoTextField](packages/cupertino/src/text-field.ts)는 Stateful 장식·행 정책·같은 Core Form State/controller 수명을 소비한다(§7.4~7.7). 현재 glyph/caret/selection은 host editor에 의존한다. | R1~R3의 실제 Core/Skia RenderEditable·strut/caret/selection/toolbar·OS IME bridge·clear/reset·복원을 먼저 연결한다. native font/style projection 확장을 이 family의 완료 경로로 삼지 않는다. 남은 비제외 공개 API도 유지한다. |
| 간소화 | [Material AlertDialog/showDialog](packages/material/src/dialog.ts)는 고정 Close 버튼과 일반 Route, [CupertinoAlertDialog](packages/cupertino/src/dialog.ts)는 고정 Column/버튼 조합이다. | 선택 가능한 action/content/scroll/layout·modal route/barrier/focus·locale·결과/취소/복원과 해제. |
| 간소화·연결 누락 | [CupertinoNavigationBar](packages/cupertino/src/nav-bar.ts)·[PageScaffold](packages/cupertino/src/page-scaffold.ts)는 title/back·Row/Column 조합이다. [CupertinoApp](packages/cupertino/src/app.ts)의 기본 `pageRouteBuilder` 누락은 **§7.3에서 해결**했다. | navigation slot/시각·safe-area/inset·sliver/tab 연계는 남는다. 기본 Cupertino route와 기존 back-gesture 본문을 재사용한다. |
| 미구현: Material shell/navigation | AppBar/BottomAppBar·ScaffoldMessenger/FAB/SnackBar·NavigationBar/Drawer/Rail·TabBar/TabBarView·MaterialBanner 등의 실제 Widget. | 기존 theme 값과 Core route/overlay/layout 위에 M3 제품 기능을 구현한다. |
| Material 입력 잔여·미구현 menu/picker | InputDecoration/InputDecorator와 TextFormField의 선정 구현은 §7.4에 있다. MenuAnchor/MenuBar·DropdownMenu/Autocomplete·SearchBar/SearchAnchor, Dialog/BottomSheet·modal sheet·DatePicker/DateRangePicker/TimePicker Widget/공개 show 함수는 남아 있다. | 입력 family의 전체 API/동작·플랫폼을 마친 뒤 overlay/menu/dialog/sheet → locale/date/time·날짜 범위 입력 순으로 의존 묶음을 구현한다. |
| 미구현: Material 나머지 복합 | DataTable/PaginatedDataTable/DataTableSource·ExpansionTile/ExpansionPanel·Stepper·CarouselView·SegmentedButton 등의 실제 Widget. | 기존 component theme와 Core scroll/animation/semantics를 소비하는 실제 Widget/API·입력·수명 구현. |
| 미구현: Cupertino 복합 / Form 선정 구현 존재 | sliver-nav/tab-bar/tab-scaffold/tab-view·segmented/sliding-segmented·search-field·picker/date/time·context-menu/action-sheet·sliver refresh·expansion Widget 및 sheet route/transition·공개 함수는 남아 있다. form-row/section/text-form-field의 선정 구현은 §7.6에 있다. | 기존 App/theme/route·Core Form/편집·wheel/scroll/overlay를 활용해 미구현 family를 완성한다. Form family는 새로 만들지 않고 R1~R3 전환·전체 API/동작·공급 잔여를 닫는다. |

### 1.5 다른 단계의 기존 구현과 구체적인 잔여

| 단계 | 이미 있는 제품 소스 | 남은 조건 |
| --- | --- | --- |
| W13-02 | [PageView/PageController](Nelyx/src/framework/widgets/page-view.ts), [NestedScrollView](Nelyx/src/framework/widgets/nested-scroll-view.ts), persistent header·reorderable·dismissible·[DraggableScrollableSheet](Nelyx/src/framework/widgets/draggable-scrollable-sheet.ts)와 Core refresh가 있다. | Page의 `(0,1]` viewportFraction, Nested의 같은 View/axis outer+inner, sheet의 단일 vertical/non-reversed body 등 현재 명시적 지원 범위를 요구와 대조한다. 필요한 확장·mixed/first seek·변경 중 keyed selection·복원/종료·실제 환경을 남긴다. |
| W13-03/06 | [SDK bootstrap](Nelyx/sdk/src/runtime/bootstrap.ts)의 shutdown/drain·worker owner, Core image/picture/text·자원 owner, 여섯 target application과 CLI/Metro/runner 코드가 있다. | 초기화·worker·cache·provider/runner를 새로 만드는 작업으로 시작하지 않는다. 현재 오류/복구/종료·출력 계약·설치/선택 로드·최신 artifact/실제 플랫폼 검증의 공백을 확인한다. |
| W13-04 | [EditableText/controller](Nelyx/src/framework/widgets/editable-text.ts)의 composition 보호·undo/redo/delta/clipboard·formatter와 [Form](Nelyx/src/framework/widgets/form.ts)·AutofillGroup/Service·selection 기반이 있다. [RenderEditable](Nelyx/src/framework/rendering/editable.ts)은 host가 glyph/selection을 소유하는 배치 경로다. grapheme 알고리즘의 선정 회귀는 있다. | RenderEditable은 완성된 자체 renderer로 재사용할 수 없다. R0~R3에서 Core/Skia paint/hit/geometry·입력 상태 동기화 책임을 완성하고 Form/길이 제한·공개 style/API·multi-View·keyboard/IME/복원을 재연결한다. |
| W13-05 | WidgetsApp·Navigator·[Router](Nelyx/src/framework/widgets/router.ts)·Overlay/Hero·locale resolution·RestorationManager/typed scope와 route persistence가 있다. | 기본 앱/라우터/복원 기반을 재작성하지 않는다. §1.4의 Cupertino 기본 route와 실제 OS link→Form/list/dialog→Back→locale→cold restoration/close 조합을 검증한다. |
| W13-07 | [Web 개발 서버](Nelyx/sdk/tooling/metro/src/web-development.mjs)·[HMR/refresh/reload close handler](Nelyx/sdk/tooling/metro/src/web-refresh.cjs), [native Metro 개발 세션](Nelyx/sdk/tooling/cli/src/native-development.mjs), FrameworkRoot.describeTree 진단이 있다. | **OPEN에서 소스 기준 PARTIAL로 정정**한다. React Refresh/전체 reload와 Nelyx Widget State 유지·reassemble을 구분한다. Core reassemble/WidgetInspector service extension 등록 경로는 이번 검색에서 확인하지 못했으며 실제 연계·실패 회복 검증은 남는다. |
| W13-09 | [ServicesBinding](Nelyx/src/services/binding.ts)의 접근성 환경, Core semantics pipeline/transport·Root 연결, browser/RN 접근성 adapter가 있다. | DEFERRED는 후속 실행 순서다. 설정/semantics를 전부 신규 미구현으로 보지 않고 tree/ack/action·실패 회복·실제 reader·플랫폼 producer/디자인 연계의 잔여를 닫는다. |
| W13-10 | SkiaGraphiteView/ViewApi의 native canvas host와 앱/View 자원 수명은 있다. | 일반 canvas host를 자식 native/HTML view 임베딩 완료로 세지 않는다. 검토한 제품 Widget 범위에서 PlatformView/HtmlElementView/AndroidView/UiKitView 본체·공개 공급은 확인하지 못했으며 합성/입력/해제 통합을 남긴다. |

### 1.6 Doroti 본문 비교와 구현 책임 — 2026-10-19 KST

Doroti HEAD `52141798d2a8b3c80bd8ab8e74dca565cf612d12`의 두 디자인 패키지 scoped dirty 변경이 없는 상태에서 비교했다. **간소화된 핵심 모듈은 공개 속성/생성자·State·대표 layout/build/route 본문을 읽었고, 나머지 누락 family는 실제 class/API 정의와 구성 파일을 확인했다.** 모든 원본 메서드·renderer·플랫폼의 동등성을 전수 검증한 결과는 아니다. 후속 구현은 해당 묶음의 공개 계약과 private helper/의존 책임까지 비교해 아래 완료 조건을 충족한다.

| 비교한 Doroti 제품 원본 | Nelyx에서 실제로 채울 책임 |
| --- | --- |
| Material [scaffold.cs](../DorotiLab/packages/Doroti.Material/src/scaffold.cs): Scaffold/State·Messenger, slot별 MultiChildLayout, appBar/body/footer/bottom bar/FAB·drawer/sheet·복원 | 현재 title/body/trailing 조합을 전체 M3 Scaffold API·실제 slot 배치/겹침·inset·FAB 위치/이동·drawer·Messenger queue/controller와 State/종료 구현으로 보완한다. theme·layout·overlay·route의 공통 owner를 연결한다. |
| Material [text_field.cs](../DorotiLab/packages/Doroti.Material/src/text_field.cs)·[input_decorator.cs](../DorotiLab/packages/Doroti.Material/src/input_decorator.cs)·[text_form_field.cs](../DorotiLab/packages/Doroti.Material/src/text_form_field.cs): State·controller/focus·restoration, 실제 EditableText 옵션/selection/toolbar 연결, decoration·floating label/error/counter·baseline/border | InputDecoration/InputDecorator 본체와 Render/layout·animation을 구현하고 TextField/TextFormField가 실제 디자인/편집/validation 계약을 공급하게 한다. Core의 기존 편집·Form·undo/autofill을 재사용하고 필요한 style/grapheme/selection 접점을 제품 Core에 보완한다. |
| Cupertino [text_field.cs](../DorotiLab/packages/Doroti.Cupertino/src/text_field.cs)·[text_form_field_row.cs](../DorotiLab/packages/Doroti.Cupertino/src/text_form_field_row.cs): Stateful 편집·decoration·prefix/suffix/clear visibility·focus/selection·controller 수명 | placeholder 전달 이상의 전체 비폐기 API/default·내부/외부 controller/focus 소유권·clear/prefix/suffix 상태·실제 편집/scroll/복원·Form row 연결을 구현한다. |
| Material [dialog.cs](../DorotiLab/packages/Doroti.Material/src/dialog.cs): Dialog/AlertDialog/SimpleDialog, OverflowBar action 배치·scroll/inset·DialogRoute·theme capture/barrier/safe-area/focus | 고정 Close 버튼과 일반 Route 구성을 대체해 실제 action/content 선택·가변 layout·입력/keyboard inset·theme 전달·modal barrier/focus·결과/취소/복원/해제를 구현한다. 이미 있는 OverflowBar·Core route/overlay를 사용한다. |
| Cupertino [dialog.cs](../DorotiLab/packages/Doroti.Cupertino/src/dialog.cs): Stateful AlertDialog/ActionSheet/Action, content/action 별 scroll controller·렌더 배치 | dialog/action-sheet의 실제 Widget/State·여러 action/cancelButton·가변 내용/접근성 배율·스크롤·hit/semantics·입력/종료를 구현한다. caller controller와 내부 controller의 소유권을 구분한다. |
| Cupertino [nav_bar.cs](../DorotiLab/packages/Doroti.Cupertino/src/nav_bar.cs)·[page_scaffold.cs](../DorotiLab/packages/Doroti.Cupertino/src/page_scaffold.cs): Stateful navigation/sliver bar·large title·route 추론·Hero/blur/system overlay, obstruction·MediaQuery padding/viewInsets·status-bar scroll | leading/middle/trailing/large-title·원본 default/route 전환·실제 paint/clip·sliver 반응, top obstruction/키보드 inset 소비·primary scroll을 연결한다. 필요한 공통 paint/MediaQuery/scroll 기능은 Core에서 구현한다. |
| Cupertino [app.cs](../DorotiLab/packages/Doroti.Cupertino/src/app.cs): WidgetsApp `pageRouteBuilder`에서 CupertinoPageRoute 생성 | Nelyx CupertinoApp에도 기존 CupertinoPageRoute를 기본 route 생성에 연결하고 home/named/nested route·back gesture·State/locale/복원/종료를 함께 검증한다. MaterialApp의 이미 구현된 연결은 보존한다. |

**비교 적용 경계:** Doroti의 C# runtime shim·namespace·M2/deprecated 분기·기본 영어 locale·고유 확장 API·host/native 렌더링 선택을 그대로 복제하지 않는다. `showDialog`의 native `WindowPresentation/nativeSize`로 기본 modal을 구현하지 않고 Core Overlay/Route/Skia를 사용한다. OS 서비스와 명시적 PlatformView만 §0.4의 경계를 적용한다. 공개/default 동작은 M3-only 정책과 pinned Flutter 비교를 함께 적용하고, reviewed 표시나 native-control 실행만으로 동등성 PASS를 주지 않는다.

### 1.7 이번 전면 재검토에서 확인한 아키텍처 불일치

아래는 **전면 재검토 당시 소스의 정적 확인**이며 그 시점의 구현 수정·새 build/runtime 검증은 아니다. 재개 후 바뀐 Core 편집 renderer는 §7.13을 따른다. 기존 성공 결과를 지우거나 새 구조의 성공으로 옮기지 않고 의미를 재분류한다.

| 현재 경로/근거 | 새 계획의 판단 |
| --- | --- |
| [Core RenderEditable](Nelyx/src/framework/rendering/editable.ts)의 주석과 본문은 host가 glyph/selection/IME를 소유하고 Core가 배치하는 구조다. [EditableText](Nelyx/src/framework/widgets/editable-text.ts)는 host용 EditorStyle/geometry에 의존한다. | **전환 필수**. 같은 class/API가 있다는 이유로 text/caret/selection Skia renderer 구현 완료로 보지 않는다. TextPainter/paragraph·Form·controller의 유효 부분은 재사용한다. |
| [RN surface](Nelyx/sdk/src/backends/react-native/surface.tsx)가 SkiaGraphiteView와 별도로 TextField overlay를 만들고 [controls](Nelyx/sdk/src/backends/react-native/controls.tsx)가 public TextInput 또는 Android/Windows editor를 선택한다. | **전환 필수**. 기본 편집 UI의 native overlay 선택/스타일/geometry 공급은 R2~R5에서 비시각적 입력 bridge와 Core paint로 교체한다. Skia surface·런타임 host 전체를 폐기하지 않는다. |
| [Web interaction](Nelyx/sdk/src/backends/browser/interaction.ts)은 실제 input/textarea에 editor style과 selection 스타일을 적용한다. | **전환 필수**. DOM 조합/입력 연결은 필요한 부분을 이관하되 보이는 editor 외형·문자/selection과 DOM geometry의 렌더링 권한을 제거한다. Web도 기본 UI의 예외가 아니다. |
| [Android NelyxEditingPackage](Nelyx/sdk/native/android/NelyxEditingPackage.kt)의 EditText 및 [Windows EditingComponent](Nelyx/sdk/native/windows/EditingComponent.h)의 RichEditBox·XamlIsland. | visible editor로 확장/승격하는 계획은 **대체됨**. OS 입력 상태의 revision/조합/종료에 관한 아이디어는 새 bridge 계약으로 검토하되 native control 화면/폰트/geometry를 제품 기준으로 재사용하지 않는다. |
| Windows `EditingFonts.h`/`EditingStyle.h`·`EditingGeometry.h`, JS editor port와 CLI/sample host 등록, SDK asset의 native font registry 필수 확인. | **생산 경로 제거/교체 대상**. 새 native caret overlay도 만들지 않는다. Skia용 font bytes/hash/notice/asset 로더는 보존하고 native editor 등록 의존만 분리한다. 파일 삭제/회귀 교체는 R5에서 실제 사용 관계와 대체 경로를 확인해 수행한다. |
| Native/DOM button·text·semantics proxy 및 menu/dialog/picker/selection overlay의 다른 경로. | **전수 감사 대상**. 투명한 semantics proxy와 실제 시각/control owner를 구분한다. 발견하지 못한 경로를 준수 완료로 간주하지 않는다. |
| 기존 source/type/package 공급·Core 일반 기능·Skia 장면/자원 수명 회귀. | 바뀌지 않은 범위는 **재사용 후보**다. native/DOM editor를 보며 통과한 입력 UI/geometry/font pixels 결과는 이전 혼합 경로의 **PASS-scoped**에 한정하고 새 자체 렌더링은 **notVerified**로 둔다. |

## 2. W12 → W13 전 단계 대응

W12-00은 이전 계획 이관의 완료 이력이다. 미완료 **11단계 전부**를 같은 번호의 W13 단계로 승계한다. 아래는 §0.4와 §1.7의 재판정을 적용한 현재 계획이며, R0~R6 미완료 상태를 기존 기능/실행 PASS로 상쇄하지 않는다.

| W12 종료 시 단계 | W13 단계 | 현재 판정 | 남은 범위와 완료 기준 |
| --- | --- | --- | --- |
| W12 종료·이관 | **W13-00 계획 이관** | COMPLETE (문서만) | W12 CLOSED/SUPERSEDED, 잔여 11단계 대응, W13 단일 활성 계획과 README 안내 연결. |
| W12-01 | **W13-01 디자인·공개 구조·locale** | PARTIAL | 기존 control/theme/route·공개 구조/OverflowBar의 선정 기반 재사용. 모든 기본 Widget을 Core/Skia로 완성하고 입력은 R1~R3으로 전환한다. 전체 간소화/미구현 family·locale/asset·영향 공급은 §3. |
| W12-02 | **W13-02 scroll·viewport** | PARTIAL | Core scroll·hit/clip·Skia 편집 selection/auto-scroll을 통합한다. animated/Page/Nested/header/refresh/reorder/dismiss/sheet·mixed/first seek·keyed selection·복원/종료·성능/공급은 §4.1. |
| W12-03 | **W13-03 runtime·paint·text·입력** | PARTIAL | 기본/편집 UI 모두 Core paint→Skia를 사용한다. paragraph/font/strut·service/worker·cache/retirement·wide-gamut/image·입력/animation/physics·오류/복구/drain은 §4.2. |
| W12-04 | **W13-04 편집·Form·입력** | PARTIAL / 전환 필수 | R0~R3의 Core RenderEditable·paint/hit/caret/selection와 비시각적 OS IME bridge를 구현한다. 기존 Form/undo/formatter·전체 공개 API·multi-View·물리 IME·복원/해제는 §4.3. |
| W12-05 | **W13-05 앱·라우팅·복원** | PARTIAL | Core route/overlay·dialog/menu/sheet·focus/편집 복원을 같은 Skia 장면에 연결한다. App/Navigator/Router/Hero·async/locale·OS link/Back·cold restoration·native drain은 §4.4. |
| W12-06 | **W13-06 플랫폼 runtime/tooling** | PARTIAL / 전환 필수 | host는 surface/OS bridge, Core는 UI owner로 분리한다. visible editor의 provider/template/asset 의존을 교체하고 여섯 target 공통 공급·Core identity·선택 설치·native/Skia/texture 수명을 닫는다. §4.5. |
| W12-07 | **W13-07 개발 갱신·inspector** | PARTIAL (소스 기준) | 기존 HMR/dev 기반을 활용해 Core tree/paint owner·편집 State와 IME 연결의 reload 수명을 검증한다. Widget reassemble·source map·inspector·실패 회복/cleanup은 §4.6. |
| W12-08 | **W13-08 실제 환경·감사·공급** | PARTIAL | 새 구조의 Skia 장면·현재 Windows/Android/Web 실제 입력·물리 IME/caret/FPS·GPU loss/복구/종료·독립 소비·version/lock·signing/clean-machine·출처를 검증한다. 이전 visible editor 증거와 구분한다. §4.7. |
| W12-09 | **W13-09 접근성** | DEFERRED (입력 필수 접점은 R2/R4 병행) | Core semantics→OS/DOM 비시각적 proxy·bounds/action/selection·reader·ack/owner 회복·Apple/Linux producer 코드를 완성한다. proxy가 시각/control owner가 되지 않는다. §5.1. |
| W12-10 | **W13-10 명시적 native/HTML view** | DEFERRED | 앱이 명시한 외부 view의 생성/부착/합성·clip/transform/z-order·focus/input·route/scroll/overlay/reload·해제/복구. 기본 위젯 대체 용도로 사용하지 않는다. §5.2. |
| W12-11 | **W13-11 최종 통합·정리** | OPEN | R0~R6 및 01~10의 비제외 요구를 감사한다. 렌더링 소유권·기능/출처/consumer/배포·최신 실제 환경/공급·문서/정리의 실제 증거로 전체 완료를 판정한다. §5.3. |

재개 시 **R0 → R1/R2 → R3 → R4/R5 → R6**을 우선하고, 필요한 W13-03/04/06/09 접점과 공급은 함께 닫는다. 이후 검증된 01A 기반을 재사용해 01B의 실제 잔여와 **01C-1 전체 마무리 → 2 shell → 3 navigation/tab → 4 dialog/sheet → 5 menu/search → 6 picker → 7 복합 → 8 조합**을 진행한다. 01D의 App/locale/공급과 scroll·route·개발의 관련 조건은 각 묶음에서 처리하고 접근성 전체·명시적 임베딩·최종 통합을 잊지 않는다. 모든 단계는 §0.2의 제품 TS 직접 개발과 §0.4의 소유권을 적용한다.

## 3. W13-01 디자인 패키지 실행 계획

### 3.1 W13-01A 공개 구조와 중단된 공급 마무리

- [x] **소스 검토 완료 — STRUCTURE-0~2 구현 존재:** 기능별 owner·공개 aggregate·내부/생성 배치와 현재 경계 검사 구현을 확인했다. 이는 최신 실행/공급 PASS가 아니다. 후속 제품 변경 시 [기존 mapping](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-package-plan.json)·[module ownership](tools/Nelyx.FrameworkToTypeScript/data/work8/w12-product-module-layout.json)은 변경한 owner/경로의 필수 정보만 맞추고 §0.2에 따라 직접 개발한다.
- [x] **STRUCTURE-3 선정 구조/독립 소비 검증 완료:** 현재 aggregate/canonical subpath의 runtime export 단일 identity, 공개 `.d.ts`·JS/declaration map의 설치 소스 참조·숫자 주석, RN/Babel·Core peer·디자인 순환/역의존·icons-only 로드 경계를 확인했다. 독립 설치는 workspace 링크 없이 현재 archive를 사용하며 README/sample/Web runner도 현재 입구를 소비한다. 전용 native/전체 기능 완료와 구분한다.
- [x] **OverflowBar/Core 배율 독립 공급 검증 완료:** 현재 Core/디자인 archive의 전체 설치 파일 bytes·공개 타입/ESM·font/notice hash가 일치했다. 기존 Root/layout/dry/baseline/intrinsic·keyed State/paint/hit·비선형 배율 회귀를 재사용했다. 최신 Web 공급본의 Cupertino route에서 공개 OverflowBar/MediaQuery 배율 제한을 소비하고 390px의 세로 action 배치·키보드 입력·결과 반환을 실제 Chrome으로 확인했다. 이전 디스크 부족으로 실패한 독립 설치 조건은 해결했다.
- [x] 기존 boundary/ownership·import-order/제품 회귀를 재사용했다. STRUCTURE-3를 이유로 검사기/mapping 전체를 재작성하거나 deprecated 경로를 복원하지 않았다. `test:design-delivery`의 임시 설치/archive는 `finally`로 삭제한다.

**완료 기준:** 기능별 단일 owner·정식 공개 입구·내부/생성 경계·재생성 보호와 독립 소비/현재 공급 조건을 충족한다. §0.4와 충돌하는 기존 경로는 구조 보존 대상에서 제외한다. 파일 이동과 구조 검증을 전체 기능 동등성 완료로 계산하지 않는다.

### 3.2 W13-01B 기존 control·theme·기본 디자인 잔여

- [x] **소스 검토 완료 — 기존 control/theme 기반:** §1.3의 Radio/Switch·tile·색/typography·ThemeData·AnimatedTheme·버튼 본문/공개 입구와 회귀 구현을 확인했다. 이 항목들을 다시 개발하는 작업은 잡지 않는다. 아래는 아직 확인하지 못한 계약과 실제 결함의 보완/검증이다.
- [ ] M3/Cupertino Radio/Switch·adaptive·Checkbox·세 toggle ListTile의 전체 비폐기 API/default·theme 우선순위·색/shape/thumb/icon·오류/disabled·RTL/drag/keyboard/semantics·caller owner·교체/복원/해제를 감사하고 **실제 누락만** 보완한다. CPU pixels·Root·reader·GPU/native 결과를 나눈다.
- [ ] ColorScheme seed/image·typography/script scale·Cupertino dynamic/high-contrast/brightness·ThemeData raw/factory/copy/lerp·extension/adaptation·AnimatedTheme의 실제 값/보간/진단·상태·system-color·locale/font 계약을 감사한다. floating/wide-gamut와 전체 지원 locale의 남은 범위는 W13-03/08과 연결한다.
- [ ] ButtonStyle/IconButton·구체 버튼·slider/range/progress/chip/ink/Tooltip/Icon의 공개/default·style/theme·shape/font·gradient/elevation/haptic/motion·diagnostics 잔여를 완성한다. 기존 구현과 fixture를 재사용한다.
- [ ] View별 font/icon/shader 등록·cache/해제, 누락 asset/notice·icons-only 소비를 확인한다. 필요할 때만 독립 icon package 분리 여부를 결정하며 기기 haptic/glyph/GPU 출력은 실제 환경에서 판정한다.
- [ ] 각 control의 보이는 text/shape/ink/focus/hover/tooltip이 Core/Skia paint인지 확인한다. RN/DOM 접근성 proxy가 별도 외형·gesture·focus/activation 정책을 만들면 R4/R5에서 교체한다.

**완료 기준:** 선정한 공개 API·독립 원본 기대값·§0.4의 Core/Skia paint/hit/입력·상태 교체/오류/복원/종료·공개 타입/숫자 출처·독립 소비와 영향 backend 조건을 충족한다. 새 native 공급은 변경 범위와 artifact가 요구할 때 갱신한다.

### 3.3 W13-01C 간소화·미구현의 실제 제품 구현

- [x] **현재 소스 분류와 Doroti 비교 완료:** §1.3의 구현 존재, §1.4의 간소화/미구현, §1.5의 Core/통합 기반과 §1.6의 책임 차이를 확인했다. 아래는 감사 목록을 반복 작성하는 작업이 아니라 **남은 기능을 실제로 구현하는 필수 묶음**이다. 기존 mapping은 보조 근거로 사용하며 전체 mapping/IR 재작성은 요구하지 않는다.

| 순서 | Doroti 비교 원본과 구현 묶음 | Nelyx의 필수 구현/완료 범위 |
| --- | --- | --- |
| **01C-1 입력·Form** | §1.6의 양쪽 text-field·Material input-decorator/text-form-field, Cupertino [form_row.cs](../DorotiLab/packages/Doroti.Cupertino/src/form_row.cs)·[form_section.cs](../DorotiLab/packages/Doroti.Cupertino/src/form_section.cs) | R1~R3의 Core/Skia 편집 renderer와 OS 입력 bridge를 연결한다. 기존 InputDecoration/InputDecorator·양쪽 TextField·Form row/section/text-form-field의 유효 구현을 보존하고 label/helper/error/counter·prefix/suffix/clear·border/배율/baseline·controller/focus/입력 옵션·validation/selection/toolbar·grapheme/복원/해제의 전체 잔여를 W13-04와 닫는다. |
| **01C-2 shell·scaffold** | §1.6의 Scaffold/NavBar/PageScaffold, Material [app_bar.cs](../DorotiLab/packages/Doroti.Material/src/app_bar.cs)·[bottom_app_bar.cs](../DorotiLab/packages/Doroti.Material/src/bottom_app_bar.cs)·[floating_action_button.cs](../DorotiLab/packages/Doroti.Material/src/floating_action_button.cs)·[snack_bar.cs](../DorotiLab/packages/Doroti.Material/src/snack_bar.cs) | 양쪽 scaffold/nav-bar의 간소화 배치를 실제 API/State/layout으로 완성한다. M3 app/bottom bar·FAB·Messenger/SnackBar/Banner·drawer/sheet slots·keyboard/safe-area·overlay/route 수명을 구현한다. |
| **01C-3 navigation·tabs** | Material [navigation_bar.cs](../DorotiLab/packages/Doroti.Material/src/navigation_bar.cs)·navigation_drawer/navigation_rail·[tabs.cs](../DorotiLab/packages/Doroti.Material/src/tabs.cs)와 tab_controller, Cupertino [tab_scaffold.cs](../DorotiLab/packages/Doroti.Cupertino/src/tab_scaffold.cs)·bottom_tab_bar/tab_view·nav_bar | navigation destination·선택/indicator·keyboard/semantics·tab controller/page 동기화·nested Navigator·선택하지 않은 tab State/focus/복원·sliver/large-title와 Cupertino 기본 page route를 구현한다. W13-02/05와 연결한다. |
| **01C-4 dialog·sheet** | §1.6의 양쪽 dialog, Material [bottom_sheet.cs](../DorotiLab/packages/Doroti.Material/src/bottom_sheet.cs), Cupertino [sheet.cs](../DorotiLab/packages/Doroti.Cupertino/src/sheet.cs) | Dialog/AlertDialog/SimpleDialog·ActionSheet·BottomSheet/공개 modal 함수·CupertinoSheetRoute/Transition의 가변 layout/action/scroll·barrier/focus·drag/scroll 결합·결과/취소·복원/종료를 구현한다. 고정 Close UI로 대체하지 않는다. |
| **01C-5 menu·search** | Material [menu_anchor.cs](../DorotiLab/packages/Doroti.Material/src/menu_anchor.cs)·popup_menu·dropdown_menu·[autocomplete.cs](../DorotiLab/packages/Doroti.Material/src/autocomplete.cs)·search_anchor, Cupertino [context_menu.cs](../DorotiLab/packages/Doroti.Cupertino/src/context_menu.cs)·context_menu_action·menu_anchor·search_field | anchor/overlay 위치·submenu/controller·focus/방향키/shortcut·선택/취소·outside action·search/editing·async options와 stale/오류·locale/RTL·owner 해제를 구현한다. 필요한 공통 menu/overlay 계약은 Core 제품 소스에서 보완한다. |
| **01C-6 picker·date/time** | Material [date_picker.cs](../DorotiLab/packages/Doroti.Material/src/date_picker.cs)·calendar_date_picker/input_date_picker_form_field·[time_picker.cs](../DorotiLab/packages/Doroti.Material/src/time_picker.cs), Cupertino [picker.cs](../DorotiLab/packages/Doroti.Cupertino/src/picker.cs)·[date_picker.cs](../DorotiLab/packages/Doroti.Cupertino/src/date_picker.cs) | wheel/날짜·날짜 범위·시간/타이머 선택 및 입력 모드·범위/disabled/validation·선택/취소·12/24시간·날짜 순서·calendar/locale/RTL·focus/scroll·복원/해제를 구현한다. date/time localization/delegate도 01D와 함께 공급한다. |
| **01C-7 table·확장·복합** | Material [data_table.cs](../DorotiLab/packages/Doroti.Material/src/data_table.cs)·paginated_data_table/data_table_source·expansion_tile/expansion_panel·stepper·[carousel.cs](../DorotiLab/packages/Doroti.Material/src/carousel.cs)·segmented_button, Cupertino segmented_control/sliding_segmented_control·expansion_tile | 실제 row/cell/source·정렬/선택/페이지·controller/listener 수명, 펼침/step 상태·focus/semantics·segmented 선택/drag·carousel layout/scroll·theme·keyed State/복원/해제를 구현한다. theme data만 공급하고 완료하지 않는다. |
| **01C-8 refresh·목록·선정 구현 조합** | Cupertino [refresh.cs](../DorotiLab/packages/Doroti.Cupertino/src/refresh.cs), 기존 Nelyx RefreshIndicator·Card/Badge/Avatar·Cupertino 목록/selection | 누락된 Cupertino sliver refresh를 실제 sliver layout/scroll/비동기 상태/취소·해제로 구현하고 W13-02와 연결한다. 이미 있는 선정 Widget은 재사용하고 sheet/목록/selection·locale/입력·수명·공급의 남은 조합만 완성한다. |

**01C-1~8 전체의 시각적 구현은 Core/Skia를 사용한다.** OS 표준 dialog/menu/date picker·보이는 DOM select/input으로 family를 대신 구현하지 않는다. modal barrier·선택 handle·context toolbar·popup·sheet·blur/transition도 같은 장면/overlay/clip 정책을 따른다. OS IME/keyboard/autofill 제안과 명시적 외부 view는 §0.4의 별도 책임이다.

각 묶음 착수 시 **공개 API/default와 M3/deprecated 제외 → 시각/상태/좌표 owner → 기존 구현/실제 누락 → Core 접점 → 제품 구현 → 테스트베드 공개 소비/실제 흐름 → 영향 검증**을 확인한다. Doroti에 있는 세부 기능이 Nelyx 요구와 다르면 적용/제외 이유를 명시한다. 검토 중 발견한 추가 비제외 누락은 같은 묶음에 포함하며 임의로 작은 API 집합만 구현하고 family 완료로 올리지 않는다.

| 구현 묶음 | `sample/nelyx-testbed-app-2`에서 함께 완성할 시나리오 |
| --- | --- |
| 01C-1 | 양쪽 Text inputs의 glyph/caret/selection/composing 표시를 Skia 장면에서 확인하고 decoration/clear/prefix/suffix·Form validation/error·다중 필드·실제 OS IME·resize/복원/해제를 연결한다. 보이는 native/DOM editor를 제거한 새 흐름으로 `basic` 제한을 해소한다. |
| 01C-2 | Material bar/FAB/SnackBar·Messenger와 Cupertino scaffold/nav-bar에 실제 slot/inset·keyboard/safe-area·overlay/route 수명을 연결한다. 갤러리의 공통 외형만으로 shell 완료를 판정하지 않는다. |
| 01C-3 | 양쪽 Navigation에 destination/tab 선택·nested route·비활성 tab State/focus·Back/복원·Cupertino large-title/sliver와 기본 route를 연결한다. |
| 01C-4 | 양쪽 Containment에서 여러 dialog action/result·cancel/barrier/focus·긴 내용/배율·sheet drag/scroll·Back/종료를 실행한다. 현재 고정 Close 데모의 제한을 해소한다. |
| 01C-5 | Material menu/search와 Cupertino context-menu/search에 실제 anchor/submenu·keyboard·outside 취소·비동기 stale/error·해제를 연결한다. |
| 01C-6 | 양쪽 Selection에 wheel/날짜·범위/시간·입력 모드·disabled/validation·선택/취소·locale/RTL·복원을 연결한다. |
| 01C-7 | Material table/정렬/선택/페이지·expansion/stepper/carousel과 양쪽 segmented/확장 상태·keyboard/drag·keyed 복원/해제를 추가한다. 기존 카탈로그에 없는 항목도 같은 앱에서 다룬다. |
| 01C-8 | Cupertino sliver refresh와 기존 양쪽 목록/refresh/selection을 실제 scroll·비동기 완료/실패/취소·route/종료 흐름으로 결합한다. |

| 패키지 | 전체 감사에 포함할 기능 묶음 |
| --- | --- |
| Cupertino | navigation/sliver-nav/tab-bar/tab-scaffold/tab-view/page/route, segmented/sliding-segmented, search-field, form-row/section/text-form-field, picker/date/time, context-menu/action/menu-anchor, dialog/action-sheet/sheet, refresh/scroll, text-field/selection/toolbar/magnifier, expansion/list, theme/localization/asset. |
| Material M3 | app-bar/bottom-app-bar/scaffold/messenger/FAB/snack-bar, navigation-bar/drawer/rail/tabs, card/badge/banner/avatar, menu/dropdown/autocomplete/search, form/input-decoration/border/text-field/selectable-text/selection-area, dialog/bottom-sheet/date/time-picker, data-table/paginated-table/source, expansion/stepper/carousel/segmented-button, list/toggle-tile/reorder/refresh, button/ink/control와 각 theme/localization/asset. |

기본 control·공통 theme에 의존하는 순서로 묶어 진행한다. 간소화 facade의 누락은 제품 기능 잔여로 관리하며 compiler backlog로 넘기지 않는다. 필요한 Core의 layout/paint/focus/semantics/route 기능이 부족하면 해당 제품 owner를 함께 구현하고 구체적인 타입과 동작으로 검증한다.

### 3.4 W13-01D App·locale·공개 공급

- [x] **CupertinoApp→CupertinoPageRoute 기본 연결**을 구현하고 home/named prefix·명시적 factory owner·locale/theme State·back/result/reverse/종료를 선정 검증했다. 기존 MaterialApp→MaterialPageRoute/AnimatedTheme 연결은 보존했다.
- [ ] §3.3의 실제 scaffold/bar/tab/navigation과 양쪽 App/route/Hero/adaptive의 잔여 공개/default·system chrome·inspector를 W13-05/07과 함께 완성한다.
- [ ] 전체 지원 locale delegate/data·resolution·메시지/날짜/시간·RTL·font/typography와 locale 전환 후 같은 State/편집/route 유지를 검증한다. 선정 영어/locale·radio hint·refresh label 결과를 전체 localization 완료로 확대하지 않는다.
- [ ] aggregate/subpath·단독 설치/소비·Core identity·font/icon/shader/asset 등록·license/notice·현재 archive/설치 bytes·영향 browser/native 공급을 확인한다.

**W13-01 완료 기준:** 01A~D의 잔여와 전체 기능 대응표의 비제외 범위, §0.4/3.5의 렌더링 소유권·공개/default API·지원 locale/RTL·출처/소유권·독립 소비·영향 공급을 충족한다. source 전수 변환이나 원본 내부 hierarchy 일치는 요구하지 않는다.

### 3.5 간소화·누락 구현의 공통 완료 조건

- [ ] **공개 계약:** 해당 family의 비제외 공개 API·옵션/타입·default/null/오류·callback/결과·진단을 비교해 실제 소비 경로에 연결한다. 읽어두기만 하는 옵션·고정 값 반환·무시한 callback·동명 theme/facade로 구현을 대신하지 않는다. TS/host에 맞춘 API 차이는 동작/소유권과 함께 명시한다.
- [ ] **State/자원:** 소유/차용 controller/focus/listener/ticker·async/stale/error·업데이트/keyed 이동/상태 유지·취소/복원/종료를 실제 owner에서 구현한다. 빌린 자원을 해제하거나 dispose 이후 callback을 실행하지 않는다.
- [ ] **실제 UI/입력:** constraints/intrinsic/dry/baseline·text scaling/RTL/inset·paint/clip/hit/overlay·pointer/keyboard/focus/selection·semantics와 local→global→M3/Cupertino default 해석을 실제 Root에서 검증한다. family에 해당하는 계약을 빠짐없이 확인한다.
- [ ] **렌더링 소유권:** §0.4의 Core 상태/geometry·Skia paint와 비시각적 OS 연결이 실제 실행 경로에 적용된다. 기본 위젯의 visible native/DOM control·native text texture·별도 native caret overlay로 통과시키지 않는다. 접근성 proxy와 명시적 임베딩의 범위·중복 입력 부재를 확인한다.
- [ ] **독립 비교/사용자 흐름:** Doroti의 책임 구조와 필요한 pinned Flutter의 API/default/동작을 독립 기대값으로 비교한다. 정상/disabled/error·취소/복원/종료, 필요한 scroll/route/Form/locale 조합을 확인한다. 구현을 복사한 기대값이나 고정 mock 화면만으로 완료하지 않는다.
- [ ] **테스트베드 통합:** §0.3과 §3.3의 해당 시나리오가 `sample/nelyx-testbed-app-2`에서 공개 제품 API로 실행되고, 관련 `basic`/`planned` 제한·README·필수 Root 회귀를 함께 갱신했다. Web 조작과 필요한 Windows/Android 결과·남은 `notVerified`를 구분한다. 샘플 카탈로그 밖의 필수 API도 검증 범위에서 누락하지 않는다.
- [ ] **공개 공급:** 실제 `.d.ts`/ESM·aggregate/canonical identity·숫자 출처/소유권·asset/font/notice·독립 소비와 영향 backend를 검증하고 변경한 소비자/fixture/README를 갱신한다. 필요한 native/물리 증거의 공백은 `notVerified`로 남긴다.

**간소화·stub·필수 API/동작 누락 또는 렌더링 owner 불일치가 남은 family는 PARTIAL**이다. 소스 존재/타입검사/파일 이동·theme 값·제한된 선정 검증·native control의 기능 동작만으로 완료 처리하지 않는다. Doroti의 C# 내부 hierarchy 일치는 요구하지 않지만 위 실제 기능 책임은 제품에서 충족해야 한다.

## 4. W13-02~08 필수 잔여 작업

### 4.1 W13-02 scroll·viewport

- [x] **소스 검토 완료:** 기존 wheel/2D/tree/Viewer/Scrollbar/behavior 외에 PageView/Controller·NestedScrollView·persistent header·refresh·reorder/dismiss·DraggableScrollableSheet 구현도 있다. 이를 신규 미구현으로 되돌리지 않는다.
- [ ] 현재 Page/Nested/sheet의 명시적 지원 제한을 요구와 대조해 필요한 API/조합을 확장한다. animated API·Cupertino sliver refresh·sheet 결합의 실제 누락은 §3.3과 보완한다.
- [ ] mixed sliver·first seek·key/offset 복원, mutation/resize 중 keyed State/editor/focus/selection, selection auto-scroll·active owner 종료를 검증한다.
- [ ] 기본 scroll/scrollbar/selection/편집 auto-scroll은 Core offset·paragraph/viewport geometry를 사용하고 Skia paint/hit/clip과 일치시킨다. native editor 내부 scroll을 Core scroll/선택 geometry의 기준으로 삼지 않는다. Core scroll 후 IME 후보창/semantics bounds도 같은 transform으로 갱신한다.
- [ ] 입력·layout/paint/hit/clip·restore/close·성능과 영향 browser/packed/native 소비 조건을 충족한다.

### 4.2 W13-03 runtime·paint·text·입력

- [x] **소스 검토 완료:** SDK bootstrap의 shutdown/drain·worker owner와 Core services·image/picture/text 자원 기반이 있다. 초기화·worker·cache 전체를 새로 만드는 작업으로 시작하지 않는다.
- [ ] 기존 foundation/scheduler/services·worker의 오류/취소/stop·cache/retirement·복구/drain·앱/View 수명에서 실제 누락/검증 공백만 닫는다. InkSparkle/program cache 구현을 활용하고 §3.3에 필요한 공통 paint/text 접점을 같은 제품 owner에서 완성한다.
- [ ] wide-gamut rendering/output·bitmap/image cache·font/typography·paragraph/style/strut/hyphens의 남은 출력/측정 계약을 완성한다.
- [ ] 일반 text와 편집 text가 같은 font bytes·fallback·SkParagraph/TextPainter의 shaping/줄바꿈/bidi/selection box/caret hit 결과를 사용하게 한다. renderer에 필요한 metric/position API가 실제로 없으면 Core↔Skia backend 계약에서 구현하고 OS 편집기 측정으로 우회하지 않는다. 편집 표시의 cache invalidation·style/scale·GPU 자원 수명도 포함한다.
- [ ] gestures/focus/keyboard·pointer/animation/physics·나머지 공개 widget API와 실제 backend 접점을 검증한다. SafeArea/SliverSafeArea와 OverflowBar/Core 배율 구현·공통 numeric/value owner를 보존한다.

### 4.3 W13-04 Core/Skia 편집·Form·OS 입력

- [x] **기반의 소스 확인:** EditableText/controller·Form/TextFormField·autofill·selection·undo/redo/delta/clipboard·formatter 경로가 있다. host가 glyph/selection을 그리는 RenderEditable은 **미완료/전환 필수**로 정정한다. Core 모델의 유효 API/알고리즘만 재사용한다.
- [x] **grapheme 알고리즘 선정 검증 범위:** 고정 characters 엔진의 결합 문자/emoji/국기/한글 자모·UTF-16 방향 selection 보정 회귀가 있다. 기존 active composition·delta/undo/redo/host 해제 결과는 이전 입력 연결 범위이며 새 bridge와 재검증한다. 현재 0 허용 정책과 Flutter MaxLengthEnforcement/플랫폼별 default의 전체 차이는 여전히 잔여다.
- [ ] **R1 실제 renderer:** text·composing underline·obscure·caret/색/점멸·selection/handle/toolbar/magnifier를 Core/Skia에서 그린다. paragraph fragments·bidi/affinity·word/grapheme·baseline/strut·min/maxLines/expands·가로/세로 scroll·text scaling·font/style 변경·pointer/touch/drag hit와 clip을 같은 측정에 연결한다.
- [ ] **R2 OS bridge:** Windows/Android/Web의 실제 IME 조합·텍스트 delta·선택·제출/Next/Done·show/hide keyboard·keyboard type/capitalization·readOnly/password·autofill/section을 연결한다. Core caret/selection geometry를 화면 좌표로 변환해 후보창과 OS에 전달하고 visible editor의 geometry는 읽어오지 않는다. 정확한 session/revision·native ack·교체/취소·late callback/실패/해제 의미를 정의한다.
- [ ] Core controller/formatter/undo/redo·clear/reset·Form validation/save와 입력 동기화의 순서를 재검토한다. native UI의 snapshot을 기다려야만 controller를 바꾸던 기존 규칙을 무조건 보존하지 않는다. Core 편집 명령과 OS 입력 동기화/취소의 실제 완료를 분리해 callback·history·경쟁·종료를 검증한다.
- [ ] 양쪽 TextField의 전체 비제외 style/focus/keyboard/selection/toolbar·길이 제한/카운터·복원 옵션을 §3.3의 01C-1 API에 연결한다. 새 Core renderer·TextInput 계약에 필요한 공개 API 누락을 pinned Flutter와 비교해 완성하며 Doroti는 모듈 분리 참고로 제한한다.
- [ ] 같은 테스트베드의 여러 필드/Form·혼합 RTL/한글/emoji·OS 조합·selection/auto-scroll·resize/theme/font/scale·route/복원·multi-View와 provider 교체/해제를 검증한다. Web DOM helper 또는 native carrier는 실제 OS 연결을 유지하면서 기본 UI 픽셀을 그리지 않아야 한다.
- [ ] 현재 공급본의 Skia 장면과 실제 EXE/APK/Web에서 편집 UI를 확인한다. synthetic composition·shadow input/에뮬레이터·물리 IME/caret pixels·reader/FPS는 각각의 증거로 구분한다. 이전 EditText/RichEditBox font/geometry PASS는 이 조건을 충족하지 않는다.

### 4.4 W13-05 앱·라우팅·복원

- [x] **소스 검토 완료:** WidgetsApp/Navigator/Router·Overlay/Hero·locale/restoration 기반과 MaterialApp→MaterialPageRoute/AnimatedTheme 연결이 있다. route transition·snapshot·predictive back의 기존 구현을 보존한다.
- [x] **CupertinoApp 기본 pageRouteBuilder 연결**을 Doroti app.cs와 비교해 구현하고 §7.3의 Root/Web 흐름을 확인했다.
- [ ] 남은 App/route 공개/default·Overlay/Hero·async/locale·predictive/native producer 통합을 W13-01과 닫는다. 이미 연결된 Material 경로 전체를 다시 만들지 않는다.
- [ ] OS link→nested Form/list/dialog→Back→locale 변화→process recreation/restore/close를 기존 저장/URI producer로 검증한다.
- [ ] 현재 Windows/Android 후보의 예외/취소·animation/overlay·native producer/drain·종료 수명을 확인한다. 원본 NavigatorState 전체 컴파일은 요구하지 않는다.
- [ ] dialog/menu/sheet/route transition은 Core Overlay/Skia로 구현하고 route 변경 시 Core 편집 상태·focus와 OS IME 연결을 정리/복원한다. 기본 UI를 새 native window/widget으로 치환하지 않는다. OS link/Back/system chrome producer는 유지한다.

### 4.5 W13-06 플랫폼 runtime/tooling

- [x] **소스 검토 완료:** 여섯 target application·CLI/Metro/runner와 공통 bootstrap 코드가 있다. 이는 여섯 native 환경의 build/run PASS가 아니다.
- [ ] 여섯 host/tool·SDK/CLI/Metro/provider·runner/template의 선택 설치/로드·runtime/tooling 역의존 제거·Core identity를 확인한다.
- [ ] 일반 native/Skia·공통 texture·OS adapter·앱/View 종료/ack·wire/cache와 현재 artifact 호환성·target별 공급/배포 구성을 완성한다.
- [ ] 여섯 target 공통 코드/package/runner/template/공급 구성과 Windows/Android/Web의 필수 실제 수명을 검증한다. 전용 native 예외는 §6.2를 따른다.
- [ ] R2/R5의 새 비시각적 input/semantics bridge를 6 target 계약/설정에 연결한다. RN/DOM surface의 visible TextInput/editor 선택·native style/geometry 투영·native editor font 필수 검사와 template/host 등록을 제거/교체하고 구형 provider 자동 fallback을 없앤다. 공통 raw input·keyboard·Metro façade 초기화·Skia GPU/자원 기반은 보존한다.

### 4.6 W13-07 개발 갱신·inspector

- [x] **소스 검토 완료 — PARTIAL:** Web Metro/HMR·React Refresh/전체 reload/close handler, native dev 세션, Root.describeTree가 있다. 개발 서버·reload·기본 트리 진단을 신규 미구현으로 잡지 않는다.
- [ ] 실제 Nelyx Widget 코드 수정→State 유지·reassemble·source map/preview·inspector/service extension을 기존 갱신 흐름에 연결한다. React Refresh와 전체 reload가 보장하는 범위를 구분하고 필요한 Core 제품 hook을 구현한다.
- [ ] Windows/Android의 실제 reload/remount 정책·State/자원 owner·실패 회복/cleanup을 검증한다. draft/타입검사로 실제 개발 흐름을 대체하지 않는다.
- [ ] inspector는 Core Widget/RenderObject·paragraph/paint/focus/semantics와 OS bridge 상태를 연결해 보여준다. native control tree만 표시하거나 visible editor를 HMR로 복구하는 방식으로 자체 renderer의 State 유지 증거를 대신하지 않는다.

### 4.7 W13-08 실제 환경·감사·공급

- [ ] 최신 Core/package의 source/JS/`.d.ts`/map·archive·설치 bytes와 외부 consumer/browser/Windows/Android 공급을 검증한다. 과거 native 결과 이후 변경을 대조한다.
- [ ] **Skia가 직접 그린 편집 glyph/caret/selection/composing pixels·실제 OS/물리 IME·성능/FPS·hardware GPU**, resize·hidden/resume·GPU loss·복구·close/drain을 검증한다. 전체 창/native editor pixels·offscreen/CPU 시간·emulator를 Core paint 소유권·scanout/FPS·물리 입력 증거로 확대하지 않는다.
- [ ] package/version/range/lock·여섯 target 공급 구성·signing/clean-machine·출처/license/notice·재현/배포를 감사한 뒤 우선 범위 완료를 판정한다.

## 5. W13-09~11 후속과 최종 통합

### 5.1 W13-09 접근성

- [x] **소스 검토 완료:** 접근성 환경·semantics pipeline/transport·Root·browser/RN adapter 기반이 있다. DEFERRED는 후속 실행 순서이며 전부 미구현이라는 뜻이 아니다.
- [ ] 기존 Web/OS 설정 구현을 활용해 native 설정/알림→실제 View/MediaData·semantics tree 제출/ack/해제·metadata/action을 완성한다.
- [ ] callback 교체/실패 owner 회복·실제 reader·영향 디자인/입력 수명·Apple/Linux producer 코드를 §6.2 예외에 맞춰 완성한다. toggle-tile MergeSemantics/host transport와 reader도 포함한다.
- [ ] Core semantics/value/selection·Core geometry를 비시각적 native/DOM proxy로 전달하고 reader의 이동/편집/선택 action을 같은 Core 모델에 적용한다. duplicate tree·double activation·별도 native focus/validation을 제거한다. proxy가 없으면 입력이 불가능해지는지와 proxy가 기본 UI를 실제로 그리는지는 따로 검증한다.

### 5.2 W13-10 명시적 native/HTML view

- [ ] 앱이 공개 PlatformView/HtmlElementView/AndroidView/UiKitView 계열로 명시한 외부 view만 §0.4의 시각 예외로 한정한다. 기본 TextField/menu/dialog/picker의 미구현을 이 기능으로 우회하지 않으며 일반 Skia host와 구분한다.
- [ ] 생성/부착/배치/합성·texture/ViewApi/header adapter·clip/transform/z-order·focus/input·해제/실패/복구를 완성한다.
- [ ] route/scroll/overlay/reload 결합의 실제 합성·입력·종료를 검증한다. 일반 host·IME·keyboard/menu·앱/View 수명은 앞선 필수 단계에 남긴다.

### 5.3 W13-11 최종 통합·정리

- [ ] 접근성/임베딩의 영향 회귀와 최신 package·실제 환경·공급 검증을 갱신한다.
- [ ] 전체 선정 기능/API·locale·플랫폼/개발·성능/안정성·출처/consumer/배포 요구를 감사하고 문서·재현 방법·임시 자원을 정리한다.
- [ ] 필수 미구현·미해결 FAIL·검증 공백이 없는지 확인한다. 필수 또는 후속 `notVerified`가 남으면 전체 `PARTIAL`을 유지한다.
- [ ] 모든 기본 UI의 Core 상태/layout/hit/Skia paint owner와 비시각적 OS bridge, 명시적 임베딩 예외를 실제 source/runtime/supply 경로별로 감사한다. R0~R6·W13-01~10의 비제외 요구 중 하나라도 어긋나면 전체 완료로 올리지 않는다.

## 6. 검증·완료 기준과 선택 작업

### 6.1 영향 범위별 검증과 자원 정리

| 변경 종류 | 검증 기준 |
| --- | --- |
| 문서 이관 | 잔여 11단계/완료 이력 대응·상태/링크·단일 활성 계획·제품 소스 보존을 확인한다. 제품 테스트를 새로 실행하지 않는다. |
| 아키텍처/편집 전환 | R0~R6의 owner·상태/좌표 방향·실제 Core paint/hit·Skia 장면·OS 입력 bridge·접근성·provider/template 전환을 확인한다. 기존 visible editor가 그린 screenshot/font pixels·UIA/DOM 사각형·native ack 회귀를 새 renderer의 증거로 사용하지 않는다. |
| 구조/기능 | 영향 package/dependent 타입·빌드, 독립 기대값의 API/Root·사용자 흐름·오류/수명/복원·필요 실제 backend를 확인한다. |
| 테스트베드 변경 | 앱 타입 검사·영향 Root 통합 회귀와 실제 Web 화면/조작·반응형/테마·State/자원 수명을 확인한다. 제품/asset 공급이 바뀌면 현재 runner 입력을 갱신하고 해당 build/소비를 검증한다. 관련 native/물리 조건은 별도 판정한다. |
| 생성 소스 직접 개발 | 명시적 adopted 전환·공개 타입·숫자 출처·제품 의미·ownership과 유지하는 생성 경로의 overwrite 보호를 확인한다. 제품 회귀·공개 소비를 검증하며 기능 변경마다 recipe/재생성을 요구하지 않는다. |
| 변환 도구 공통 수정 | §0.2의 공통 처리 조건과 최소 변경 범위를 확인한다. 영향 공통 경로·제품 출력/공개 타입·숫자 출처·merge/edit guard 및 해당 제품 회귀만 검증한다. 삭제한 checks 복원·전체 변환 replay는 요구하지 않는다. |
| 공급 전환/최종 후보 | 같은 source/artifact의 archive·외부 consumer·설치 bytes·실제 EXE/APK 실행/restore/close와 여섯 target 공급 구성을 확인한다. |
| 선택 lint | 실제 버전/설정·검사 범위·진단/예외·exit code를 구분한다. 정적 결과를 기능/플랫폼 완료로 확대하지 않는다. |

현재 존재하는 `check:types`, `check:cli-types`, `check:metro-types`, `check:package-boundaries`, `check:design-ownership`, `test:design-structure`와 영향 package build/회귀를 필요한 범위에서 재사용한다. `import-order.test.mjs` 등 유효 회귀는 유지한다. `test:windows-editing`의 기존 RichEditBox 전용 검증과 이전 Android/Web visible editor 회귀는 교체/이관 대상을 먼저 확인한다. 그 명령을 다시 통과시키는 것을 R1/R2의 최초 목표로 삼지 않는다. 새 renderer/IME 계약에 필요한 회귀는 실제 구현과 함께 마련하며 존재하지 않는 명령을 이미 제공한다고 적지 않는다. 명령 존재는 실행 PASS가 아니다.

**R6에서 필수로 구분할 증거:**

- **Core paint와 hit:** 실제 paragraph의 glyph/line/word/grapheme/UTF-16·bidi/affinity/strut와 동일한 geometry가 paint·caret/selection·pointer/drag/scroll을 결정한다. 비동기 프레임·style/font/scale·clip/transform·View 교체 때 stale geometry/자원을 사용하지 않는다.
- **Skia 장면 단독 확인:** 현재 frame/paragraph/paint 경로와 GPU 출력에서 편집 glyph·caret·선택/조합 표시가 포함되는지 확인한다. 별도 OS/DOM overlay 또는 native control snapshot texture가 화면을 대신 그려 전체 screenshot만 맞는 경우는 통과하지 않는다. 새로운 누적 receipt/시각 보고서 체계를 만들지 않는다.
- **실제 OS 연결:** 같은 앱의 현재 Windows EXE·Android APK·Web에서 입력·조합/후보창 위치·touch/keyboard·autofill/clipboard·focus/다중 필드·clear/reset/Undo·Next/Done·readOnly/obscure·복원/해제를 검증한다. OS IME의 상태/취소 완료를 synthetic 이벤트나 Core 렌더링 성공만으로 대체하지 않는다.
- **접근성·예외:** Core semantics와 proxy의 bounds/선택/action·reader를 확인하고 시각적 중복·double action을 배제한다. 명시적 PlatformView의 화면/합성은 기본 UI와 구분하며 §6.2 전용 native 예외를 그대로 적용한다.
- **공급·검증 범위:** native-control 전용 코드/필수 font 검사/host 등록·fallback이 정상 제품과 템플릿에서 제거/교체됐는지 source·exports·독립 설치·현재 artifact로 확인한다. 타입/CPU·Skia offscreen·에뮬레이터·물리 입력/scanout/FPS의 증거를 섞지 않는다.

테스트는 **20분(1,200초) timeout**, 대부분의 반복 검증은 **30회 이내**로 제한한다. 동일 checkout Dart 분석은 직렬 실행한다. 같은 입력/도구/환경/artifact의 유효 결과를 활용하고 변경·실패·필수 검증 누락이 있는 범위만 다시 확인한다. 유한 원본 receiver·Core CPU·Babel·browser·native offscreen·기기/물리 관측을 구분하고 구현을 복사한 기대값을 쓰지 않는다.

대용량 build/pack/독립 설치/browser/native 전에 작업 드라이브 여유 공간을 확인한다. **20GB 미만이면 새 산출물을 만들지 않고 해당 작업의 임시 산출물부터 정리한다.** 검증 임시 디렉터리는 한 실행에 필요한 것만 만들고 성공/실패/중단 시 `finally`로 삭제한다. 이전 dist/staging·설치본·browser profile·보고서/receipt/checkpoint/archive를 누적하지 않으며 package build는 현재 `dist`만 남긴다. 영구 기록은 이 문서의 짧은 현재 결과/제한/다음 작업이다.

### 6.2 플랫폼과 상태의 경계

**Windows/Android/Web은 필수 실제 환경**이다. 기존 사용자 결정에 따라 iOS/macOS/Linux 전용 native build/run·물리 입력·서명·전용 harness는 **SKIPPED**, provider는 **notVerified**를 유지한다. 여섯 target 공통 TS·코드·package/runner/template·공급 구성 의무는 유지한다. 이 예외를 여섯 target native PASS로 표현하지 않는다.

`PASS / PARTIAL / FAIL / SKIPPED / notVerified`를 구분한다. 기술 결과는 `검증 완료`·`완료 기준 충족`으로 쓴다. 삭제한 과거 산출물을 현재 hash/실행 검증으로 포장하지 않는다.

### 6.3 완료 판정

- **기능 묶음 완료:** §0.4와 §3.5에 따라 해당 family의 비제외 공개/default API·Core 상태/layout/hit/Skia paint·OS 입력 동기화·오류/취소/복원·수명·성능·영향 플랫폼/공급·출처/소유권을 충족한다. 보이는 native/DOM 위젯을 그대로 쓰거나 임의의 작은 API 집합/간소화 facade로 family 전체 완료를 판정하지 않는다.
- **우선 범위 완료:** **R0~R6과 W13-00~08**의 필수 조건을 충족했을 때 `우선 범위 완료 / 전체 PARTIAL`로 기록한다. 입력에 필수인 접근성 연결은 이미 충족해야 하며 W13-09 전체/10은 남는다.
- **전체 완료:** R0~R6·W13-01~10의 비제외 요구를 W13-11에서 현재 source/공급/실제 환경과 대조해 판정한다. 기본 UI의 visible editor/fallback이나 native editor geometry를 시각적 원본으로 쓰는 의존·필수 `notVerified`가 남으면 **PARTIAL**이다. §6.2의 전용 native 예외는 별도로 명시한다.

### 6.4 기존 TypeScript 7 도입 유지

현재 root 설정은 native CLI `@typescript/native: npm:typescript@7.0.2`와 Compiler API용 `typescript: npm:@typescript/typescript6@6.0.2`를 분리한다. W12 기록의 lock상 실제 API는 6.0.3이다. 타입검사는 7, 기존 AST/declaration emitter는 호환 API를 사용하는 역할을 유지하며 native emit 전면 전환으로 표현하지 않는다. 상세 도입 이력은 [W12 §6.6](work12.md#66-typescript-7-실제-도입--2026-10-18-kst)을 따른다.

nullish 정규화와 [명시적 adopted 소유권](tools/Nelyx.FrameworkToTypeScript/data/work8/w12-typescript7-nullish-adoption.json), compiler wrapper/실제 구현 identity guard·숫자 주석을 보존한다. 재설치/갱신 시 현재 lock/도구 호환성을 확인한다. 이미 끝낸 compiler 도입을 필수 잔여로 다시 세지 않는다.

### 6.5 선택 backlog

**Oxlint는 선택 사항**이다. W12의 LINT-0 진단·필요성 판단 → 채택 시 LINT-1 exact pin/root 설정·scripts/lock 연결 → 필요할 때만 LINT-2 type-aware 확장을 승계한다. 현재 계획 이관에서 설치/실행하지 않았다. 도입 시 공식 버전별 문서를 확인하고 생성물은 읽기 전용 진단, 자동 수정은 검토한 수작업 파일로 제한한다. 검사 파일 0개·blanket disable·빈 catch/무조건 `void`로 진단을 숨기지 않는다. 타입/기능 검증은 유지한다. 도입하지 않아도 제품 완료를 막지 않으며 type-aware는 **DEFERRED / notVerified**다. 상세 후보 규칙은 [W12 §6.5](work12.md#65-선택-oxlint-활용-계획--2026-10-18-kst)의 검토 이력이다.

**compiler 기능 확장 backlog는 W13 실행 범위에서 제외**한다. const collection spread/if/null-aware·추가 pattern·generator/collection loop·lazy global/member·extension-type/getter/setter 탐색·전체 hierarchy/SDK closure·C# project/partial/global-using/상속/generic/runtime lowering의 미지원 때문에 제품 개발을 대기시키지 않는다. 해당 기능은 제품 TS에서 구현하며 변환 도구는 §0.2의 공통 수정만 적용한다. 미지원 변환 의미는 명시적 진단으로 유지한다.

## 7. 현재 상태와 재개 순서

**이 절은 W13 종료 전 진행·중단·당시 재개 순서의 이력이다.** 현재 계획은 [W14](work14.md)이며 구현 PAUSED · 제품 PARTIAL · `wholePlanComplete=false`를 유지한다. 아래 §7.13~7.22의 변경·검증은 각각 당시 조건의 결과이며 새 OS bridge나 전체 완료로 확대하지 않는다. 아래 번호 목록은 현재 재개 지시가 아니다.

1. 현재 git diff/dirty와 §7.12의 중단 파일 hash를 대조해 사용자 변경과 미검증 작업을 보존한다. 삭제한 checkpoint/receipt/history·과거 캐시를 복원하지 않는다.
2. §1.7의 owner 불일치를 실제 Core/SDK/Web/RN/native/semantics 경로별로 감사하고 R0의 입력·상태·좌표 계약을 확정한다. 기존 helper의 숨김 처리나 RichEditBox geometry/스타일 검증 재실행으로 이 단계를 대신하지 않는다.
3. 기존 Core TextPainter/SkParagraph·Form·focus/undo/formatter·Material/Cupertino 장식·route·Skia/Metro/자원 수명의 유효 구현을 활용해 R1/R2 → R3 → R4/R5 → R6을 진행한다. 전환으로 무효화된 범위는 새 owner에서 다시 검증한다.
4. 이어 §2/3의 모든 family와 scroll·runtime·route·개발·플랫폼·접근성·명시적 임베딩·최종 공급 요구를 마친다. 입력 renderer 전환만으로 전체 11단계가 완료되지는 않는다.
5. 이 문서에는 현재 범위/제한·잔여만 유지하고 사용법은 기존 README에 반영한다. 임시 build/설치/browser/native 자원은 §6.1에 따라 정리한다.

### 7.1 테스트베드 기준선

- 공통 앱은 [nelyx-testbed-app-2](sample/nelyx-testbed-app-2/README.ko.md)다. Material/Cupertino gallery·theme/accent·반응형 페이지·실제 callback/화면 소유 State와 현재 font/image/notice 입력을 재사용한다.
- 이전 샘플과 설치본을 되살리지 않는다. 6개 target 템플릿·독립 runner·공개 제품 소비를 유지한다. 카탈로그의 ready/basic/planned는 데모 상태이며 family 완료가 아니다.
- 기존 Root/Web 조작은 검사한 기능/수명 범위만 재사용한다. 보이는 DOM/native 편집기를 사용한 입력 화면은 새 자체 렌더링의 완료 증거에서 제외한다.

### 7.2 Cupertino 페이지와 공통 통합 앱

- 두 디자인의 동작을 같은 앱에서 검증한다. Cupertino 데모 State의 route owner·slider/toggle/radio/button·theme/locale·목록/선정 조합의 유효 기반을 보존한다.
- 01C-1~8과 §0.3의 모든 시나리오를 유지한다. 누락 Widget을 샘플 전용 painter/route shim·OS control로 대신하지 않는다. R3 이후 양쪽 입력/Form을 새 Core/Skia 경로로 다시 확인한다.

### 7.3 공개 구조·grapheme·공통 기반의 재사용 범위

- W13-01A의 canonical export/identity·독립 archive 소비·map/source/notice와 OverflowBar/MediaQuery 배율의 선정 검증은 해당 구조/기능 범위에서 재사용한다. 신규 기능/공급 변경이 무효화한 범위만 다시 확인한다.
- Core grapheme 제한·CupertinoApp 기본 route·named route/factory/result·Back/State 수명 구현을 보존한다. 일반 controller/focus/clipboard·formatting/undo 기반과 native-control에 종속된 동기화 규칙을 R0에서 구분한다.
- Core renderer의 문자/caret/selection paint는 §7.13에서 추가했다. 이 구조/route 성과만으로 R0~R6을 닫지 않으며 OS bridge·selection UI·공급/실제 환경은 계속 필수다.

### 7.4 Material 입력·Form

- Stateful TextField·InputDecoration/InputDecorator의 장식/label/helper/error/counter·border/RTL/motion·Form/validation/controller 소유권의 선정 구현과 관련 출처/회귀를 재사용한다.
- EditableText가 연결되어 있다는 이유로 전체 입력 완료로 보지 않는다. R1~R3의 실제 Skia 편집 UI, 전체 공개/default/복원/selection/toolbar와 동일 테스트베드 흐름을 §3.3/4.3에 따라 완성한다.

### 7.5 Core 행 정책·제출·controller

- minLines/maxLines/expands·paragraph 측정/cache·baseline·controller 교체·grapheme/제출·Form reset/Undo의 일반 기능을 참고한다. 이는 hosted 배치 경로에서 확보한 선정 범위다.
- 실제 caret/selection/hit/scroll은 Core paragraph geometry로 구현한다. 기존 native geometry를 controller에 저장하는 경로나 native UI snapshot 이후에만 값을 확정하던 callback/ack 정책은 새 Core/IME 계약과 대조해 교체한다. 동기 해제·late callback·취소/경쟁의 안전성은 유지한다.

### 7.6 Cupertino Form

- FormRow/Section/TextFormFieldRow의 공개 API·공유 Core Form State·validation·controller/focus 소유권과 원본 notice를 보존한다.
- native editor 외형이나 geometry를 Core Form의 정상 동작 조건으로 만들지 않는다. Core renderer/OS bridge 전환 후 validation/save/reset·다중 필드·오류/복원/해제를 다시 연결한다.

### 7.7 Cupertino TextField

- Stateful object API·prefix/suffix/placeholder/clear visibility·locale clear 메시지·장식과 Core controller 연결의 유효 구현을 재사용한다.
- native/DOM clear·Undo와 조합 취소에 관한 이전 회귀를 새 bridge 계약으로 이관한다. 보이는 glyph/caret/selection·toolbar/magnifier·scroll·전체 공개/default·IME/복원은 Core/Skia에서 닫는다.

### 7.8 Android 폰트 공급의 재분류

- 앱/패키지 font bytes·hash/notice·Skia에 공급하는 검증/복사·asset 예산과 정상 로딩 경로는 재사용한다. font alias/fallback·weight/style·baseline/strut·selection metrics의 시각 원본은 SkParagraph/TextPainter다.
- EditText에 같은 font를 등록하고 native 400/700 pixels를 비교한 결과는 이전 native-control typography의 PASS-scoped다. Core/Skia 편집 출력의 증거로 쓰지 않는다.
- native editor font registry/ABI를 Skia asset 로딩의 필수 조건으로 둔 연결은 R5에서 분리/제거한다. 비시각적 IME carrier가 필요하면 OS 연결 요구만 충족하고 font/line/caret geometry의 authority를 갖지 않는다.

### 7.9 이전 Android/Web 앱 검증의 재분류

- 이전 Android APK의 가상 키보드·clear/Undo·Next/Done/save/reset·keyboard resize·디자인 왕복과 Web DOM editor의 조합/이동/focus 회귀는 **이전 혼합 경로의 PASS-scoped**다. OS 상태 동기화/수명의 참고 범위는 유지하되 새 Core 렌더링·물리 IME/caret·reader/FPS 완료로 확대하지 않는다.
- Core/SDK/디자인 build·workspace 타입·독립 공급·일반 디자인/Root 회귀의 바뀌지 않은 범위는 재사용 후보이며, 새로운 paint/hit/IME 계약으로 영향받는 입력 회귀는 다시 검증한다.
- R3/R6에서 같은 앱의 현재 Windows/Android/Web 공급본과 실제 Skia 편집 장면을 확인한다. 아키텍처 수정 문서만으로 기존 artifact를 새 후보로 재분류하지 않는다.

### 7.10 Windows native session 경로의 처리

- 기존 public RN TextInput 및 staged RichEditBox session은 기본 편집 UI의 최종 owner가 아니다. RichEditBox 기반 glyph/caret/selection·native geometry 관측을 확대하거나 WindowsInteraction의 visible editor capability를 승격하는 작업은 **대체됨**이다.
- UI thread·revision·UTF-16 방향 selection·지연 native 변경·same-value ack·close/마지막 owner 해제·오류 보고 검사는 이전 native session의 한정된 증거다. 일반 수명/transport 요구는 R2의 비시각적 OS 입력 계약에 필요한 범위로 재설계/이관한다.
- 새 bridge의 실제 native API 선택·조합/cancel·keyboard/autofill·Core geometry→OS 좌표·실패/해제는 미완료다. 기존 session fixture 통과를 새 provider의 첫 목표로 삼지 않는다.

### 7.11 Windows component·native style/geometry의 처리

- RNW component/JS port·XamlIsland/RichEditBox·native font/style·host/template 등록은 visible editor를 완성하는 생산 경로로 유지하지 않는다. native caret overlay 추가 계획도 종료한다. 제거/교체는 R0의 사용 관계 확인과 R2/R3/R5의 대체 구현·공급 전환으로 수행한다. 이번 문서 수정에서 파일을 삭제하거나 기본 provider를 바꾸지는 않았다.
- native font bytes/metadata·실제 custom/system·400/700 pixels·방향 selection/스타일 reset 및 작은 RNW/Hermes bridge의 기존 PASS는 **그 native 경로의 선정 검증**으로만 유지한다. 직전 JS 입력/스타일/폰트 15개도 검사한 계약 범위이며 새 renderer의 완료 증거가 아니다.
- 공통 Metro façade InitializeCore 선행·중복 제거·사용자 hook 보존, 일반 host/Skia/자원 및 검증된 bytes/hash/notice 기반은 독립된 유효 수정으로 재사용한다. 새 renderer 때문에 무효화되지 않은 범위는 다시 시작하지 않는다.
- geometry 착수 직전 3 target의 Core/SDK/Material/Cupertino 설치 파일 5,310개씩·Metro/CLI 본문 일치와 target별 archive 7개를 확인했다. 중단된 geometry 변경은 아직 공급하지 않았다. 이 공급본을 Core/Skia 편집 전환 완료본으로 표현하지 않는다.

### 7.12 재개 전 중단 변경의 보존 기준선

- 사용자 요청으로 native geometry 검증 중 MSBuild/process tree를 중단했고 fixture의 finally가 소유 임시 project/bundle/font/EXE와 runner JS entry를 정리했다. 중단 실행의 종료코드 1은 제품 결함의 판정이 아니며, 새 geometry 코드의 컴파일/실행은 **notVerified**다.
- 현재 EditingGeometry.h의 native caret/UIA rectangle→Core 변환, Session의 layout/scroll/geometry dedup, Component의 snapshot 전달과 bridge의 observed geometry 검사는 **미검증·아키텍처 교체 대상**이다. 이를 완성한 뒤 native caret/style을 이어가라는 이전 재개 지시는 폐기한다.
- 아래 hash는 기존 미검증 변경을 보호하기 위한 현재 비교값이다. 재개 시 diff와 hash부터 확인하되 **§0.5 R0의 소유권 감사/입력 계약 → Core/Skia renderer·OS bridge 전환**으로 진행한다. 기존 test:windows-editing 재실행을 필수 선행 단계로 두지 않는다.
- 이 절은 구현 재개 전의 문서 재검토/중단 기준선이다. 당시 build/테스트/앱 실행·재공급은 하지 않았다. 후속 전체 작업 요청으로 구현한 뒤 현재 사용자 요청으로 PAUSED이며 최신 결과는 §7.13을 따른다. 별도 checkpoint/history/검증 보고서는 만들지 않는다.

| 보존할 중단 파일 | SHA-256 |
| --- | --- |
| `Nelyx/sdk/native/windows/EditingGeometry.h` | `2476c1c6c6e6a7fd82c855551efb779d24dee8bf7f48635a34c9c4c34658ead6` |
| `Nelyx/sdk/native/windows/EditingSession.h` | `f9150ae10d8b3de919901db91a2f5386a5261682dcaacc48ae5224b4eb2bae19` |
| `Nelyx/sdk/native/windows/EditingComponent.h` | `fbec9f843947cb666b8b62af6da308fd8ae9268e24cb0640121c10439c5b33e6` |
| `Nelyx/eng/tests/windows-editing-bridge.tsx` | `ae2ae66ed753911ab5c17a96b184b66f4f4da835c2632ed0dbf29f0dcaed46fb` |


### 7.13 현재 구현·검증 상태 — 일시정지

**당시 PAUSED / PARTIAL / wholePlanComplete=false.** 아래는 W13 중단 당시 기록이다. 현재는 W13 CLOSED/SUPERSEDED이며 R0~R6·W13-01~11의 필수 잔여는 [W14 §4](work14.md#4-w13-종료와-필수-잔여의-전량-이관)로 승계했다. §7.12의 기존 native 파일 4개 SHA-256과 아래 입력/공급 값은 당시 이력이며 현재 bytes로 간주하지 않는다. 사용 안내는 기존 Core/SDK/샘플 README를 따른다.

- **Windows 샘플 실행(2026-10-20 KST):** 사용자 요청으로 `sample/nelyx-testbed-app-2`의 Release 앱을 빌드·실행했다. Windows SDK의 전역 `InputScope`와 WinUI 타입 충돌을 `EditingComponent.h`의 `Input::InputScope`/`Input::InputScopeName`으로 해소했다. 현재 앱 설정에서 Windows bootstrap/asset manifest를 다시 생성해 Cupertino icon font도 반영했다. Windows runner의 SDK archive SHA-256은 `336d9922d7b347e256fa8f8ee257c7130e25eca7f58fa3a5dcfed685fdccf1bd`이며 아래 공급 기록의 Windows SDK 값을 대체한다. Android/Web SDK 공급은 기존 값이다. native 입력은 기존 `6af9f7f5e0dcae28f54c9d23a6d12ae643a3093b182fd33d9a75000bb2be0a91`을 사용했다. Release 빌드·패키지 inventory 검증과 `NelyxTestbed2` 창 생성/응답을 확인했고 앱은 사용자 조작용으로 실행해 두었다. 전체 입력·화면 흐름 검증은 수행하지 않았으며 W13은 PAUSED/PARTIAL을 유지한다.

- **사용자 실행용 임시 정리 스크립트:** 루트 `cleanup-w13-temp.ps1`은 아래 정리 예외 4개 경로만 대상으로 한다. PowerShell 구문 검사와 `-WhatIf`의 4개 경로·링크 검사를 통과했으며 실제 삭제는 실행하지 않았다. 루트에서 `pwsh -NoProfile -File .\cleanup-w13-temp.ps1`로 사용자가 실행한 뒤 불필요해진 스크립트는 제거할 수 있다. W13 구현은 PAUSED를 유지하며 기존 정리 예외를 삭제 완료로 바꾸지 않는다.

- **중간 마무리(2026-10-20 KST):** 사용자 요청으로 구현·build·테스트·재공급을 멈췄다. 중단 확인 시 dirty 경로는 178개이며 기존 변경을 보존했다. 작업 관련 MSBuild/cl/InputSurface 및 검증 node/python 프로세스는 0개다. §7.12의 보호 파일 4개와 아래 Fabric UIA header 2개의 hash가 일치함을 다시 확인했다. Windows 재사용 native 입력 `Nelyx/.cache/native/windows/current/inputs.json` SHA-256은 `6af9f7f5e0dcae28f54c9d23a6d12ae643a3093b182fd33d9a75000bb2be0a91`이다. SDK `surface.tsx` / `windows-semantics.tsx` / `windows-semantics-packet.ts` SHA-256은 각각 `4e4fa586de1c4c090dd946253ad93325725fbdd7abffa5c55aded4d21c5ed3eb` / `804eab01d244e8ba6a8067425342e82a29dfdd72560e6f3c6f419000f2a9b9ce` / `b55f20b568ddfe3ff4a3b9e756280092dcf64d45cba25c9dcee60ff65ce3afb3`이다. 별도 checkpoint/history는 만들지 않았다. 명시적 재개 요청 뒤 현재 diff·소스/native 입력·공급 hash를 먼저 대조하고, 아래 **잔여/다음**의 Fabric root focus와 Core/TSF carrier 결합부터 이어간다. 아래 통과 결과는 중단 전 검증이며 중단 정리 중 재실행하지 않았다.

- **R0/R1:** Core controller·방향 selection·formatter/history/Form과 OS 조합·동기화 acknowledgement를 분리했다. 같은 View의 TextPainter/SkParagraph가 glyph·선택/composing/caret·hit/clip·baseline/bounds를 소유한다. 현재 EditableText/RenderEditable 소스 SHA-256은 각각 `0eb1df6412162f119e957de43ae66bf355d945e5f3ef2ef47876cd455895488f` / `84900f3c7565aa55227c9ef47c5a33a44a578ba322194166edf29679454bffd8`다.
- **formatter·delegate:** native/public formatter는 공통 원자적 오류 보고와 logical owner/revision fence를 사용한다. 오류 때 미포맷 입력을 유지하고 native 선택/range-only 관측은 재실행하지 않는다. 실제 OS 조합은 수정하지 않으며 확정 때 보존한 조합 전 문서를 기준으로 검증한다. 이 기준은 Nelyx transport 정책이며 Flutter의 현재 oldValue와 같다고 표현하지 않는다. 재진입 formatter·geometry provider·observer의 새 문서가 이전 native 관측보다 우선한다. delegate의 cause별 clipboard/선택·enableInteractiveSelection·callback 정책, paste 응답 시점의 같은 편집기 값, 실제 조합 range를 보존하는 selection-only transport를 유지한다. 임의의 새 active range나 고급 OS 서비스를 제공한다고 판정하지 않는다.
- **공개 스크롤:** Core scrollController/scrollPhysics/scrollBehavior/restorationId를 실제 Scrollable/ScrollPosition에 연결했다. 차용 controller 교체·viewport/content dimensions·wheel/touch·animateTo·기본 iOS 한 줄 physics와 offset 복원을 실제 paragraph paint/hit/caret에 적용한다. disabled는 내부 사용자 스크롤도 막으며 caller 명령은 유지한다. 자동 로컬 caret reveal은 paint 뒤 실행하고 실제 문단/viewport 변화에 반응한다. 같은 문단/viewport 재배치는 명시적 스크롤을 되돌리지 않으며 scroll observer 재진입 뒤 낡은 drag/reveal은 종료한다. Core restorationId는 위치만 복원하며 text는 caller 소유다. 디자인 text/controller 복원은 잔여다.
- **양쪽 공개 소비:** Material/Cupertino TextField의 scrollController/scrollPhysics와 같은 샘플의 top/end 조작을 연결했다. 두 샘플 조작은 문서·선택을 유지하며 포인터 클릭으로 입력 포커스를 가져가지 않는다. 기존 Disable selection / Enable selection·Form·다중 필드·theme/viewport·State 수명 흐름을 보존한다. 샘플 전용 renderer나 native visible editor를 새 편집 UI의 원본으로 쓰지 않는다.
- **focus/좌표·R2 hosts:** pointer 시각→View gesture→deferred focus→native carrier와 Android protocol4의 실제 Back 뒤 오래된 IME 재표시 억제를 유지한다. 정상 frame의 같은 epoch Core geometry만 IME/semantics에 발행하며 dirty/null·실패 frame·singular projection·stale query는 철회한다. Web 비시각적 EditContext/DOM, Android View/BaseInputConnection(protocol4·semantics2·pointer1·keyboard host3)을 사용하고 input/semantics 수명을 분리한다. Windows 실제 TSF/service/module/RNW-Hermes와 bound Skia→화면 좌표·GPU/입력 결합 종료는 선정 검증했다. 기본 provider/키/IME 라우팅은 PARTIAL/notVerified다. native expression animation은 실제 위치를 바꿔도 getter에 base 값이 남으므로 이를 현재 screen map으로 사용하지 않는다.
- **Windows surface producer:** 실제 native factory의 weak identity·Core owner·Skia view/backing 세대를 확인하는 `TextInputSkiaSurface`를 host에 설치했다. 정적 SDK NativeLayer의 실제 layout과 ContentIsland converter를 사용하며 native clip·화면 밖 hit·같은 Core frame의 native surface 세대 및 재진입 mapping 변경을 검사한다. 외부 native transform/animation·ScrollView·사용자 clip은 전용 mapper가 필요하다. 크기/DPI 변경 중 이전 좌표를 철회하고 살아 있는 OS 문서는 유지하며, 숨긴 정적 container는 빈 bounds/miss를 제공한다. 소수 bounds는 Floor/Ceiling으로 바깥쪽에 맞추고 clipping 판정에서 부동소수점 너비의 단순 동등 비교를 제거했다. backing/컴포넌트 종료는 해당 service와 관찰자만 먼저 해제한다. 실제 converter의 clip·소수/0너비 bounds·nearest/화면 밖 hit, mapping 재진입·세대 교체, 형제 service 유지·구독 중 종료와 foreign UserData 거부를 선정 검증했다. producer/Skia header SHA-256은 `997ed3ad9a829f6bdfc6cb6824966a772a2ab88a1e594d69107da0c248c2248d` / `1b7ac35ccfe5baee15ecb9699e5caf8c961ba19dd54887f44b8810f71b23803e`다. 실제 GPU의 Core paragraph/glyph/caret 픽셀을 TSF 화면 bounds와 대조하고, 조합 밑줄은 caret와 분리해 관측했다. backing resize 중 이전 geometry의 NOLAYOUT·문서/선택/실제 조합 보존·GPU/입력 해제 뒤 정상 process 종료코드 0을 확인했다. Core geometry commit과 GPU/DWM presentation은 다른 단계이므로 실제 새 caret 픽셀을 관측한 뒤 대조한다. 실제 Fabric React tag를 공통 metrics에 보존하고 tag/View owner 교체를 거부한다. 기본 provider·현재 테스트베드 EXE·물리 하드웨어/IME는 잔여다.
- **Windows 입력 수명/키:** `WindowsInputView`는 Core 바인딩별 client를 자동 생성하고 semantics clip/제거와 입력 수명을 분리한다. 초기 enabled/focusable·readOnly·multiline·InputScope를 port/focus 전에 적용하고 세대 교체·부분 연결·종료에서 실제 native 해제를 기다린다. input protocol3·Skia keyboard port2의 `bindKeyboard`는 같은 Core View owner/generation만 허용하며 native key/focus/독립 문자 packet을 복사해 Core 단축키·native 명령·관측된 편집 응답 순서로 처리한다. 이전/암시적 요청 응답이 새 명령을 완료시키지 않으며 종료·세대 교체를 차단하고 5초 응답 기한을 적용한다. geometry/query 응답은 문서 키 대기를 막지 않는다. 일반 문자는 실제 focus된 TSF shadow에 쓰고 native 관측으로 알리며 stale·write lock·readOnly/disabled·조합·UTF-16/budget 조건을 검사한다. 같은 확정 frame의 재발행은 native 문자/caret 캐시를 보존해 TSF 재요청 순환을 끊는다. 실제 OS scan-code Ctrl+A/a/b/Backspace/c가 `ac`로 관측됐고 같은 frame의 geometry 발행은 최대 2회였다. 실제 queued WM_CHAR만 한 번 소비하는 owner token과 TSF focus 세대를 붙여 독립 문자/UTF-16 surrogate·repeat를 같은 키 sequence로 전달한다. dead/system/legacy IME 메시지는 text proof가 아니며, focus가 바뀐 뒤 오래된 문자는 새 필드에 쓰지 않는다. 실제 Ω WM_CHAR·😀 Unicode VK_PACKET가 Core/TSF에 각 한 번 반영됐고 오래된 focus 세대의 native 쓰기는 거부됐다. 공개 controller의 연속 text/selection setter도 실제 native 문서와 수렴했다. 현재 활성 한국어 layout의 실제 TSF 조합/확정·Shift 조합·조합 중 Clear/Undo/Redo/Reset·focus 해제/재획득·backing resize를 확인했다. IME text는 일반 문자 writer를 거치지 않으며 취소 전 완료 callback을 실행하지 않는다. keyup 경계 뒤 native/modern/raw pressed state가 모두 비었고 같은 frame geometry 발행은 최신 UIA·문단 조회·좌표 재진입 확장 시나리오에서 최대 3회였다. Root가 TSF 호출 전에 canvas focus 세대를 고정하고 성공한 소비 keyup만 같은 세대의 관측 press로 해제한다. pending down을 먼저 발행하고 미관측 key·다른 owner·blur/refocus의 새 press는 해제하지 않는다. 이 소비-up 연결의 pending/owner/재진입/ABA 계약은 portable 회귀로 확인했으며 실제 TIP의 비대칭 소비 분기는 별도 notVerified다. 검증 thread의 원래 IME 모드 값은 종료 전에 복원하며 layout을 바꾸지 않는다. bridge와 실제 InputSite HWND를 구분하며 association 복원 뒤 thread focus가 남아 있으면 이전/외부 문서를 명시적으로 복원한다. 실제 TSF focus 확인 뒤에만 Core에 알리고, 종료된 root/thread/service/session은 RNW worker의 최종 해제에서 close를 반복하지 않는다. Windows Skia font loader의 legacy registry 의존성은 제거했으며 정상 host/template의 기존 control 정리는 기본 provider·nonvisual UIA·전체 IME/키 라우팅 전환과 함께 남아 있다. 관리자 소스 SHA-256은 `66e4896a725998b1d6cac82a5482ddc1f50180e7be8ffb5b9306c91f8ed01910`다.
- **접근성 편집·UIA 본문:** Core semantics의 typed setText/setSelection을 사용자 편집 delegate에 연결해 formatter/history·방향 선택·실제 조합 취소 ack를 사용한다. disabled/readOnly/interactive-selection·문서 revision·source node/편집 owner 세대를 검사하며 같은 text/revision의 controller 교체와 전역 listener 재진입·중복/늦은 callback을 차단한다. 같은 확정 Core 문단의 grapheme·엔진 word·실제 wrapped-line 경계를 immutable/cache snapshot으로 발행하고 비밀번호에는 발행하지 않는다. `SemanticsTextDocument.h`·`SemanticsTextProvider.h`의 UIA Text/Text2/Value 본문은 이 Core unit 경계·좌표 callback을 소비하고 문서 수정에 따른 live range·선택/caret·이동/검색·Core 명령·비밀번호·동일 세대/COM apartment·retirement를 처리한다. 없는 좌표는 unavailable이며 native text layout/비율 보간을 사용하지 않는다. 같은 native 문단의 range/hit을 Core 변환·clip·실제 화면 mapper에 연결했다. Core 본문 전용 `textRevision`도 발행하며 실제 본문 변경만 증가하고 선택·포커스·transport ack는 유지한다. 한 frame 안의 본문 변경 후 원복도 이 counter로 보존한다. 이 counter를 native snapshot으로 읽고 실제 확정 Core 발행의 TextChanged/선택 알림과 Fabric field peer에 연결했다. root focus·range reveal·나머지 property/metadata 알림·기본 provider 연결·reader는 잔여다. native COM 회귀는 제어된 snapshot/좌표/command를 사용하며 실제 reader나 기본 경로의 완료가 아니다.
- **원본 문단 native 조회:** Core가 같은 private SkParagraph의 resource/ticket·paint origin(정렬·스크롤 포함)을 현재 확정 geometry와 함께 발행한다. native는 실제 platform context·owner/resource 세대·원본 UTF-8/UTF-16 body·layout 준비 상태를 검증한다. JSI/paint/read가 같은 gate를 사용하고 UI 조회는 busy일 때 즉시 unavailable이다. 재layout·dispose·context 종료는 ticket을 영구 철회하며 일반 큰 public paragraph의 기존 layout/paint는 유지한다. `SemanticsTextGeometry.h`는 같은 원본 range/glyph hit·Core grapheme stop과 double 4×4 변환·clip을 소비하고 live surface mapper 전후의 좌표 revision·source ticket을 재검사한다. native 재shape/비율 사각형/JS 동기 응답 대기는 없다. 실제 bundled font/SkParagraph의 Unicode·wrapped range·hit/affinity, 회전 후 clip·완전 clip/known hidden·perspective inverse·빈 문단/retirement·nonblocking gate를 kernel에서 확인했다. 실제 Windows GPU fixture에서 동일 Core/native 원본 range와 Core→실제 화면 range·visible·hit, foreign context/resource 거부와 mapping 재진입 철회를 확인했다. 물리 reader·기본 provider 완료는 아니다. 현재 native query cpp / Windows geometry header SHA-256은 `d5bff129653dfbbd99a856a74447af72ed881e5b3e48a1c95897f303bea6a478` / `2a81e005f32049bd031258cb1bd716ef79a96b6ea1dec1435421bdb3b86cc4a9`다. Android를 포함한 이전 native 앱은 새 binding으로 재빌드해야 하며, 구 ABI에서 임의 fallback하지 않는다.
- **비시각적 Fabric UIA 연결:** `SemanticsSnapshot.h`·`SemanticsComponent.h`와 SDK packet/tree adapter를 추가했다. 실제 Core revision/본문 revision/편집 owner·navigation·원본 문단과 화면 mapper를 읽고 source/commit/revision/세대가 다른 native action을 거부한다. 비밀번호 본문·unit/ticket은 native props 전에 제거한다. native parser는 음수 revision·비밀번호 plaintext·UTF-16 scalar를 쪼갠 unit을 거부하며, 일시적 navigation/geometry 부재를 native 분할이나 재layout으로 대체하지 않는다. plain Composition View는 Core snapshot/range와 RNW fragment 상속 관계를 사용하며 시각 콘텐츠나 native editor를 만들지 않는다. peer는 `UseComThreading`이며 agile/marshaler를 노출하지 않음을 실제 생성 때 확인한다. 확정 Core 발행에만 기존 Text provider의 알림·live range를 갱신하고 unmount/종료는 문서·자기 surface observer를 철회한다. 실제 별도 MTA UIA client가 중복 없는 Fabric tag·Edit role·Text/Text2/Value 본문 일치·원본 문단의 screen range/visible/hit·active caret를 읽고, selection/replacement를 Core controller에 반영한 뒤 TextChanged와 기존 live range 갱신을 확인했다. 최신 fixture는 공개 Core API만 사용하고 native build 전에 엄격 타입 검사를 통과한다. SDK의 opt-in `interactionControls` 경로로 검증했으며 sample/template은 component 등록과 UIA link를 공급한다. Windows 기본 provider는 아직 전환하지 않았다. RNW root의 native focus 경로와 Core focus/TSF carrier 결합·range reveal·나머지 metadata/property 알림·실제 reader 및 제거/교체의 retained-range 검증은 잔여다. snapshot/component header SHA-256은 `0efaa083c1b07ac3730f9f6315e97edb3a802bc9c3feda5d4796c1a8190d3ca6` / `7e8421c9cdf3a70fcf762b2f321a3f6d399df1ff80e2b05faf28bacf79309344`다.
- **제품 검증:** 변경하지 않은 편집/Form/두 gallery 선정 152개·이전 스크롤/포커스 영향 67개·Core frame 회귀 63개·후속 renderer/native editing 48개와 font 5개의 결과는 유효 범위에서 재사용한다. 현재 SDK build·전체 타입과 이전 패키지 경계(937 files/505 facades/7,699 runtime edges·design cycle0)·출처/소유권·독립 선언 소비의 무효화되지 않은 범위가 통과했다. 현재 편집/렌더링/접근성 96개(12,115ms), SDK 입력/tag/키/semantics packet 37개(5,350ms), Android 입력 수명 1개(2,143ms), UIA native COM 1개(3,995ms), Windows store/document·native 문자/소비 keyup provenance 1개(6,357ms), 원본 SkParagraph query/geometry kernel 1개(5,510ms), 실제 ContentIsland/TSF/module/Hermes 1개(147,684ms), 실제 Core/Skia GPU surface·Fabric UIA 통합 1개(142,686ms), runner 공급/교체/rollback 1개(6,003ms)가 통과했다. 앞 통합 fixture의 geometry/소비 키 응답은 제어된 값이며 실제 focus의 UTF-16 writer·readOnly/blur/조합 보호를 추가했다. surface fixture는 실제 OS scan-code·독립 WM_CHAR/Unicode VK_PACKET·stale-focus 거부·공개 controller text/selection 연속 setter와 Core/TSF 문서·selection, 실제 한국어 TSF 조합/확정·Shift/keyup의 native/modern/raw 해제·조합 중 Clear/Undo/Redo/Reset·focus 왕복·조합 중 backing resize를 확인했다. 최신 공급본의 controller/semantics 본문 revision 일치도 실제 OS 입력 후 확인했다. 같은 frame geometry는 문단 조회 중 좌표 변경 알림과 UIA 편집을 포함해 최대 3회였고 paragraph/glyph/caret·조합 밑줄 픽셀, TSF bounds·이전 좌표 NOLAYOUT·문서/선택/조합 보존·GPU/입력 해제·일반 실행 종료코드 0을 확인했다. legacy editor module/font registry를 등록하지 않으며 선정 nonvisual Fabric UIA 연결은 확인했지만 기본 provider·reader·물리 입력의 검증은 아니다. 직전 Web Chrome moveBefore/이전 move/비시각적 DOM fallback 3개(152,443ms)의 top/end·wheel·문서/선택/포커스·조합/clear/Undo/Form 결과와 Android InputConnection/조합 span/0 native pixels의 선정 결과는 바뀌지 않은 범위에서 유지한다. 본문 revision 추가 뒤 Web은 최신 build/body 대조 범위이며 Chrome을 중복 실행하지 않았다. 이번 Windows 전용 변경 뒤 Web JS/map bytes는 동일하다. controlled·browser·에뮬레이터·OS 키 주입·선정 desktop 픽셀 결과를 물리 IME·reader·hardware/scanout/FPS 증거로 올리지 않는다.
- **현재 공급:** 세 runner의 hash-qualified archive 각7개·설치 payload(Android/Windows6,974개·Web5,693개), workspace 공통 payload(Android/Windows5,651개·Web5,693개), Windows input/semantics header17개와 영향 Skia header5개가 일치한다. 현재 source Windows native binding 18개 라이브러리를 재빌드했고 재사용 제품 입력은 `Nelyx/.cache/native/windows/current/inputs.json`에 둔다. 검증용 독립 설치본/이전 출력은 누적하지 않는다. 현재 CLI archive SHA-256은 `528ae6eca97d334007e059de6ce1b5873f13edc3176de798cd214e4be6d44d93`이며 Windows template의 component 등록/UIA link와 설치 bytes가 일치한다. 현재 Core archive SHA-256은 `741f9d8397129aa0c1b579d9c030f8e522693c3bed4f3d60f5217fe995c11dab`이며 SDK/Skia RN archive SHA-256은 `23308c233166adf6fbab1638e39ffa38ef4131aeb93a04570fd1421af4b556d1` / `688b49b7ca3ad100b4115cff0d3b359c6dda3d7e371df30759bb7256a0441d10`다. 새 Web JS/map SHA-256은 `a293f86545a1615b8efd30cf17e83fc6c8b9dd3a7b2cd63fbf0a40efdd74332d` / `e057ae724bba92290345f22e0ccda8b06e1c0f1dc08500c464712891b8e69e70`이며 현재 Core/design/browser/sample 본문23개가 일치한다. Android의 직전 x86_64 Release/Hermes96·`-Og` APK는 `d08d4663bd70a8cdd358b3fdfbebd74b35f1e90434c3748d51f8d96ada89c9c4`이며 당시 설치 base.apk 일치와 API33 read-only host-Vulkan 입력 흐름 419,640ms의 PASS-scoped는 그 APK의 증거다. 직전 APK의 관련 본문18개 대조는 당시 증거이며 render object·ui/editing·SDK surface/controls·Core typed semantics/편집 owner 세대/본문 revision·문단 navigation·native paragraph ticket/조회 gate 변경은 해당 APK에 들어 있지 않아 재빌드/현재 앱 재검증이 필요하다. 이전 실행은 keyboard resize·tap/Back·새 tap 재표시·Core Ctrl+A/delete/Undo·ASCII·secure/plain·Cupertino clear/Undo·Form Next/Done/save/reset·디자인 왕복 범위이며 이번 source-current Android 검증으로 확대하지 않는다. Web CanvasKit source rebuild는 notVerified·notice qualification은 PARTIAL이고 local development signing은 production signing이 아니다.
- **잔여/다음:** WindowsInputView의 기본 SDK surface/provider 연결·전체 OS 키/문자 라우팅과 nonvisual semantics의 동시 전환을 이어간다. 선정한 일반 OS 키·standalone WM_CHAR/VK_PACKET·공개 controller text/selection·실제 한국어 TSF 조합과 Clear/Undo/Redo/Reset·focus/resize·Shift/keyup 상태 해제는 확인했다. 소비 keyup의 관측 press 해제와 focus 세대 guard는 구현·계약 검증했다. 실제 TIP의 비대칭 소비 분기·전체 focus/문자 FIFO와 나머지 공개 controller 명령 순서는 notVerified다. 실제 bound Skia/React tag/입력 HWND·선정 화면 좌표·GPU/입력 정상 종료 기반은 확인했으며 같은 검증을 반복하는 대신 기본 경로의 남은 입력/접근성을 연결한다. 실제 ContentIsland root 설치/종료는 이미 native host에 있으므로 중복 구현하지 않는다. 소비 키·focus/문자 순서를 기본 전환에 연결한다. UIA Text/Text2/Value 본문과 Core typed action/unit 경계·원본 문단/native query·실제 Core 화면 range/hit/visible 좌표는 구현·선정 검증했으므로 다음에는 Fabric root focus와 Core/입력 carrier의 결합·range reveal·나머지 property/metadata 알림·등록 누락/cohort 실패 경로·peer 제거/편집 owner 교체 때 실제 retained range 철회와 기본 surface/provider를 연결·검증한다. UIA 동기 호출에서 UI thread를 막고 JS 응답을 기다리지 않으며 dirty/clip/backing 세대의 좌표는 명시적으로 unavailable로 유지한다. RNW 일반 View의 ValuePattern만으로 Text/selection pattern을 제공하지 않는다. Android APK 재빌드·현재 source/runtime 대조도 남는다. R1의 임의 active composing value/범위 명령·advanced lookup/search/share/live-text·나머지 공개 편집/controller/복원, 디자인 text/controller 복원은 잔여다. R2/R4의 나머지 OS 조합 중 clip/재배치·후보창·native 접근성 producer의 setText/setSelection/알림·reader, Android 가상 Backspace keyup/IME 소비 키·빠른 Core 명령/일반 문자 순서, Web 조합/접근성 수명 분리와 R5 ReactHost focus-ready·폐기 예정 RN core Clipboard 경고도 미해결이다. R3~R6·W13-01~11의 나머지 기본 UI/플랫폼/공급·감사는 유효하다. 물리 IME/caret·reader·predictive Back gesture·scanout/FPS는 notVerified이며 iOS/macOS/Linux 전용 실행은 §6.2의 SKIPPED 예외를 유지한다.

정리 예외: 자동 승인 검토가 `sample/nelyx-testbed-app-2/android/app/build/generated/nelyx-editor-fonts`, `C:\Users\parti\AppData\Local\Temp\nelyx-w13-android-plf_say0`, `sample/nelyx-testbed-app-2/android/build/reports/problems/problems-report.html` 삭제를 `blocked by policy`로 거부했다. 위 세 미참조 출력과 `C:\Users\parti\AppData\Local\Temp\nelyx-windows-input-surface-5ZPOXi`가 남아 있다. 후자는 이전 원인의 native 진단 출력으로 현재 후보가 아니다. 정리 중 EPERM 뒤 명시적 삭제도 자동 승인 검토가 `blocked by policy`로 거부했으며 우회 삭제하지 않는다. 소유 app/Metro/reverse·에뮬레이터·browser/Windows 임시 실행 자원과 공급 staging은 해제했고 package에는 현재 dist만 남겼다. 기존 Python8765 서버는 보존했다.

### 7.14 Windows 애니메이션 성능 수정 — 2026-10-20 KST

사용자의 Windows 갤러리 성능 수정 범위만 실행했다. W13 전체 구현은 **PAUSED / PARTIAL / wholePlanComplete=false**를 유지한다. 애니메이션 성능은 개선됐으나 안정적인 60FPS 완료 기준은 충족하지 않았다.

- **원인/수정:** AMD Radeon 780M의 Graphite/Vulkan 제출은 동작하며 주요 병목은 Core의 CPU 처리였다. primitive Picture 배치·immutable 명령/retained scene 재사용에 더해, 이미 dirty인 Layer의 중복 조상 전파·단위 변환과 불필요한 scope·프레임 명령 중간 복사를 줄였다. Element 동기화는 변경된 가지로 한정하고 오류 뒤 재시도를 유지한다. boundary는 가장 가까운 하위 boundary 목록을 재사용하며, Navigator는 페이지 내용과 전환 범위를 각각 격리한다. 전환 boundary를 Offstage 밖에 두어 가려진 페이지의 임시 snapshot 이미지도 제때 해제한다. Material progress의 phase/valueColor는 위젯 재빌드 없이 painter를 갱신한다. 접근성 트리/입력 좌표 갱신은 유지하고 순수 이동 clip의 역행렬 계산을 단순화했다. Hermes bytecode99 / 기존 `-Og` 정책과 native 공급 소스는 유지했다.
- **실제 설치본 측정(PASS-scoped):** 같은 1000×1000 Release native host/컴파일된 실행 파일과 실제 갤러리, 계측 wrapper·source alias를 끈 조건에서 기존/현재 runner 설치본을 비교했다. 진행 표시/activity는 각각 약 2초, 스크롤은 800ms 왕복 2회, 전환은 push/pop 3회(액션 간 550ms)다. 아래는 native frame 완료율과 완료 간격이며 물리 scanout FPS가 아니다. 전환 완료율에는 액션 사이의 유휴 시간과 새 페이지 생성 비용도 포함한다.

| 시나리오 | 완료/초 이전 → 현재 | 간격 p50 ms 이전 → 현재 | 간격 p95 ms 이전 → 현재 |
| --- | ---: | ---: | ---: |
| Material 진행 표시 | 22.3 → 57.1 | 43.67 → 16.48 | 54.36 → 26.00 |
| Material 스크롤 | 25.3 → 33.0 | 39.54 → 29.88 | 48.40 → 36.21 |
| Cupertino activity | 40.4 → 55.8 | 24.23 → 17.44 | 29.83 → 22.48 |
| Cupertino 화면 전환 | 22.5 → 27.5 | 41.33 → 33.06 | 72.44 → 59.90 |

- **검증:** Core/design dist·declaration 빌드, 전체 `check:types`와 `check:package-boundaries`, 관련 편집/선택/스크롤·route/snapshot·갤러리 회귀 **178개** 통과. `npm run test:paint-recording`의 27개는 저장/clip/변환과 예산, 독립 resource hold, retained/취소/실패, nested boundary·변경 가지·정상화 실패 재시도, 이동하는 페이지/앱 배경 보존, progress phase/color/null fallback/외부 컨트롤러·listener 해제, 이동 clip과 일반 3D 역변환의 동등성을 검사한다.
- **공급/native:** Windows runner Core/Material archive와 lock을 재공급·설치했고, 설치된 Core 변경 10개 모듈과 Material progress의 dist bytes가 현재 제품 출력과 일치했다. 일반 Release 빌드·패키지 검증, 같은 11개 모듈의 packager source-map 내용과 현재 출력 일치·최종 bytecode99, `NelyxTestbed2` 창 생성/응답·정상 닫기와 `run:windows` exitCode=0도 확인했다. `npm run test:windows-animation`으로 재현할 수 있는 native fixture를 추가했다. 실제 설치본의 네 시나리오 진행과 `views=0 consumers=0 gpuDrained=1 inputRetired=1` 종료를 확인했으며 임시 프로젝트/runner entry/config는 finally에서 삭제됐다. 현재 runner manifest/lock을 공급 기준으로 사용한다.
- **잔여:** 스크롤·전환의 CPU 비용과 새 페이지 생성 시 긴 프레임이 남아 있다. 특히 화면 전환의 p95는 약 60ms로 여전히 끊김이 가능하며, 안정적인 60FPS를 달성했다고 판정하지 않는다. 물리 표시 FPS·OS 입력/reader·Android/Web native 실행은 이번 변경으로 재검증하지 않았다. 기존 §7.13의 미완료와 정리 예외는 별도이며 이번 native fixture 정리와 혼동하지 않는다.
- **고정 빌드 출력/정리:** 사용자 후속 요청으로 Windows CLI 기본 출력을 시간 없는 `.nelyx/windows/packages/Release`·`Debug`로 고정했다. staging 검증 후 같은 구성의 폴더를 교체하고 locator를 원자 갱신하며, 실패 시 기존 폴더/locator를 복원하고 staging·미게시 출력·교체용 백업을 정리한다. 같은 고정 출력의 앱이 실행 중이면 종료 후 다시 빌드하도록 안내하고 기존 출력을 보존한다. 다른 고정 구성·관리 폴더 밖 출력·다른 앱·수정된 파일·링크는 보존하며 명시적 `--output`은 새 디렉터리가 필요하다. 성공 후 같은 앱의 이전 시간별 폴더만 추가 정리하며, 실행 중인 시간별 출력은 종료 후 다음 빌드에서 정리한다. `cleanup.removed`/`cleanup.retained`에 정리 결과와 이유를 표시한다.
- **정리 검증/현재 출력:** 반복 고정 경로 교체·copy/stage/최종 검증/locator 실패 복원·실행 중/외부/수정/링크 보호·동시 게시 차단을 포함한 회귀 **13개**, CLI 타입·패키지 경계가 통과했다. Windows runner에 새 CLI를 공급·설치했고 변경 모듈 3개 bytes 일치와 일반 Release 빌드 2회의 같은 경로 사용·정상 교체를 확인했다. 실제 고정 출력의 앱 실행 중에는 native 컴파일 전에 빌드를 거부하고 기존 locator와 last-build를 보존했으며 검증용 앱도 강제 종료 없이 exitCode=0으로 닫았다. 이전 시간별 패키지는 정리됐고 현재 `packages`에는 검증된 `Release` 1개만 있으며 locator가 이를 가리킨다. 정리 보존/오류 항목·staging·교체용 백업·임시 locator는 없다. 기존 §7.13의 별도 정리 예외는 유지한다. 이번 후속 작업은 빌드 출력 범위이며 성능 측정이나 W13 전체 구현을 재개하지 않았다.


### 7.15 CLI 앱 구성 통합 — 2026-10-20 KST

별도 사용자 요청 범위의 수정이다. W13 전체 실행은 **PAUSED / PARTIAL**을 유지한다.

- 템플릿과 현재 샘플의 앱 정보·자산·대상 profile/cohort는 루트 `package.json`의 `nelyx`로 통합했다. `app.json`, `application.json`, `nelyx.config.ts`, 루트 플랫폼 bootstrap과 생성 API/CLI export를 제거했다. 각 runner main이 직접 `registerApplication`을 호출하며 Apple native 도구도 패키지에서 이름을 읽는다.
- CLI 생성·준비는 같은 JSON 구성을 검증하고 자산/notice hash 검증을 유지한다. 빌드·런타임용 `runner/app-config.json`은 자동 생성되는 내부 출력으로 유지한다. 후속 사용자 요청으로 에셋과 notice의 수동 `sha256`을 템플릿·샘플 구성에서 제거했다. 준비·타입 검사·Metro 시작에서 실제 bytes의 hash를 자동 계산하고 내부 출력에만 기록하며 루트 패키지는 수정하지 않는다. 런타임은 `defineAssetManifest`로 이 출력을 확인하므로 기존 자산 identity·Android 폰트 경로·로딩 검증을 유지한다. Metro 정적 자산 import는 runner main에서 관리하며 Windows 전체 자산/Android 폰트는 기존 URI 계약을 유지한다. 사용 안내는 기존 README에 반영했다.
- SDK 빌드, 생성·등록/JSON·자산 회귀 10개, 실제 설치본 준비 1개, 공통/Windows·Android·Web 타입 검사, CLI/Metro 타입, 패키지 경계와 세 플랫폼 Metro 번들이 통과했다. 샘플 세 runner에 현재 패키지를 재공급·설치했고 검증용 임시 디렉터리는 정리했다.
- 이번 변경의 네이티브 빌드·실행과 Apple/Linux 실제 실행은 `notVerified`다. 이전 네이티브 실행/성능 기록은 당시 소스·공급 범위를 유지한다.

### 7.16 Windows 접근성 갱신 성능 수정 — 2026-10-20 KST

사용자가 별도로 요청한 `sample/nelyx-testbed-app-2`의 Windows 저FPS·접근성 갱신 검토 범위다. W13 전체 구현은 **PAUSED / PARTIAL / wholePlanComplete=false**를 유지한다.

이 절의 수치는 이전 접근성 수정 시점의 비교다. 후속 원인과 현재 엔진·공급 상태는 §7.17을 따른다.

- **확인한 비용:** 기존 실제 runner의 1000×1000 Release/Hermes99 `-Og` 갤러리에서 스크롤 native 완료율은 약 33.9/초였다. 별도 CPU 계측의 Core `flushSemantics` 중앙값은 약 10.0ms였다. 위치 이동이 구성 갱신으로 전파되고, 호스트 트리와 별도로 엔진 패킷도 생성 후 즉시 폐기하며, SDK가 같은 트리를 다시 검증·복사하고 매번 React에 알리는 경로를 확인했다.
- **제품 수정:** `layoutOffset`은 구성/parent data를 유지하고 geometry만 무효화한다. geometry만 바뀐 하위 트리도 clip·가시성·노드 조립을 갱신하며 같은 대상의 중복 조립을 줄인다. 호스트 트리를 소비하는 FrameworkRoot는 엔진 패킷 직렬화를 생략한다. 일반 source owner의 기본 엔진 패킷 경로와 traversal/owner/action/dirty retirement는 유지한다. `freezeSemantics`가 만든 검증된 immutable 트리만 경계에서 재사용하며 공개 `Object.freeze` 입력은 계속 검증한다. SDK는 callback의 존재와 실제 metadata를 비교하고 변경이 없으면 React 알림을 생략하되 최신 callback map은 교체한다. 좌표·focus·편집 revision/세대·native surface 변경은 발행하고 알림 실패는 같은 metadata에서도 재시도한다.
- **검증 완료:** 관련 Core/SDK·편집/접근성·스크롤·route/snapshot·실제 갤러리·Windows surface 회귀 **116개**, `test:paint-recording` **28개**(일부 중복), 전체 `check:types`, package boundaries와 design ownership 검사 통과. 새 회귀는 offset-only clip/숨김/재노출/동일 source ID, 최신 callback·제거/재추가·형태/revision 갱신·실패 재시도/재진입, source/host-tree owner의 traversal·action·retirement를 검사한다.
- **현재 공급/실행:** Core/SDK를 빌드하고 Windows runner에 재공급·설치했다. 일반 Release 빌드와 고정 패키지 검증, 실제 실행 번들의 Core dist 4개와 SDK source 2개가 제품/설치본과 일치함, 최종 bytecode99를 확인했다. `NelyxTestbed2` 창 생성·응답과 정상 닫기, `run:windows` exitCode=0을 확인했다. 현재 출력은 `.nelyx/windows/packages/Release`다. native 공급 ABI·기존 `-Og` 정책은 유지한다. 빌드의 기존 Hermes 전역 선언·Skia/MSVC 경고는 남아 있다.
- **검증 경계:** 접근성 트리를 끄지 않았다. 실제 reader/물리 표시 FPS·OS 입력 전체·Android/Web 실행은 이번 성능 수정으로 검증하지 않았다. 기본 Windows provider 전환과 §7.13의 미완료는 그대로 남는다. 안정적인 60FPS 달성 여부는 native 완료율과 구분한다.

**실제 설치본 비교(PASS-scoped):** AMD Radeon 780M, 같은 1000×1000 Release native host 소스·공급과 Hermes99 `-Og`, source alias와 CPU 계측 wrapper를 끈 실제 갤러리다. 진행 표시/activity는 약 2초, 스크롤은 800ms 왕복 2회, 전환은 push/pop 3회다. 최종 유지한 6개 모듈은 기존 일반 Release 번들·설치본과 bytes를 대조했다. 아래 수치는 native frame 완료율/간격이며 물리 scanout FPS가 아니다. 전환 완료율에는 유휴 시간과 페이지 생성 비용이 포함된다.

| 시나리오 | 완료/초 이전 → 현재 | 간격 p50 ms 이전 → 현재 | 간격 p95 ms 이전 → 현재 |
| --- | ---: | ---: | ---: |
| Material 진행 표시 | 59.5 → 74.9 | 15.79 → 12.52 | 24.54 → 20.57 |
| Material 스크롤 | 33.9 → 35.3 | 29.13 → 28.04 | 33.84 → 33.29 |
| Cupertino activity | 54.8 → 63.5 | 18.27 → 15.55 | 21.97 → 18.94 |
| Cupertino 화면 전환 | 28.6 → 27.5 | 31.78 → 33.84 | 60.79 → 67.32 |

별도 CPU 계측에서 스크롤 `flushSemantics` 중앙값은 약 **10.0 → 8.5ms**였다. 스크롤 개선은 작고 화면 전환 개선은 확인하지 못했다. 스크롤·전환은 **안정적인 60FPS 미달**이며 Core geometry/semantics·paint/페이지 생성의 CPU 비용과 실행 간 편차가 잔여다. 이 결과를 전체 저FPS 해결로 판정하지 않는다. 추가 affine 행렬 합성 실험은 실측 이점이 확인되지 않아 최종 제품에서 제외했다. native fixture의 진행·GPU/input drain과 `views=0 consumers=0 gpuDrained=1 inputRetired=1` 종료를 확인했고 임시 project/entry/config는 finally에서 정리했다.

### 7.17 Windows geometry 중복 계산과 입력 좌표 순회 수정 — 2026-10-20 KST

사용자의 `research.md` 원인 조사·엔진 수정 요청 범위다. 전체 W13은 **PAUSED / PARTIAL / wholePlanComplete=false**를 유지한다. 상세 원인·측정 조건·현재 비교는 [research.md](research.md)를 따른다.

- **확인·수정:** 형제 의미 노드의 공통 렌더 경로/clip을 한 flush 안에서 재사용하고 분기·끝점만 복사한다. 캐시는 pipeline별 `finally`에서 제거한다. 일반 박스의 평행이동은 source `translateByDouble`을 직접 사용해 불필요한 4×4 생성을 없앴다. 편집기 없는 노드는 입력 좌표 순회 중 조상 가시성을 반복 조회하지 않으며 모든 commit/discard hook은 유지한다. 접근성 트리와 일반 3D 행렬 경로는 유지한다.
- **실제 설치본 비교:** AMD 780M, 같은 1000×1000 Release/Hermes99 `-Og`, source alias·CPU wrapper 없는 실행이다. 수정 직전 → 최종 2회에서 스크롤 native 완료율 **33.4 → 48.6~49.8/초**, 간격 p95 **36.53 → 24.09~25.03ms**였다. 진행 표시 **58.9 → 81.2~91.2/초**, activity **59.4 → 75.8~77.7/초**, 전환 **28.5 → 30.8/초**다. 물리 표시 FPS가 아니며 전환에는 유휴·생성 시간이 포함된다.
- **별도 CPU 계측:** 스크롤 `flushSemantics` p50 **9.39 → 3.73ms**, 입력 geometry commit **2.73 → 0.56ms**, `Root.build` **25.43 → 16.74ms**. 전환 `Root.build` p95는 **64.16 → 55.23ms**다. 중첩 구간과 계측 없는 완료율을 구분한다.
- **검증 완료:** 최종 Core 빌드, 관련 Core/SDK·접근성·편집·paint·route·갤러리 회귀 **117개**, 전체 `check:types`, package boundaries와 design ownership 검사 통과. 공통 경로 10회→1회, 비편집 20단계 트리 가시성 조회 230회→0회를 재현했으며 clip·숨김/재노출·source ID·편집 epoch/실패 회복과 원근 행렬 결과를 확인했다.
- **현재 공급:** Windows runner 재공급·설치와 일반 Release 빌드·1,745개 파일 패키지 검증 통과. 최종 번들의 변경 Core 모듈 2개가 제품 dist·설치본과 일치하고 진단 fixture는 포함되지 않는다. `.nelyx/windows/packages/Release`의 일반 앱 창 생성·응답·정상 종료(exitCode=0, 강제 종료 없음)를 확인했다. native fixture의 GPU/input drain과 임시 파일 `finally` 정리도 확인했다. 기존 Hermes 전역 선언 경고는 남는다.
- **잔여:** 저FPS 전체는 **PARTIAL**이다. 스크롤 frame 여유, 전환의 페이지 생성·build/layout·paint composition 지연, 실제 present/scanout·물리 FPS·reader/OS 입력 전체·Android/Web 실행은 남는다. 이번 결과로 안정적인 60FPS나 W13 전체 완료를 판정하지 않는다.

### 7.18 Windows 저FPS 확대 원인 조사 — 2026-10-20 KST

사용자의 추가 원인 조사 요청 범위다. 제품 수정은 §7.17을 유지하고 이번 변경은 진단 fixture와 [research.md](research.md)다. 전체 W13은 **PAUSED / PARTIAL / wholePlanComplete=false**다. **2026-10-20 20:53 KST 사용자 요청으로 이번 성능 조사도 중간 마무리/PAUSED**했다. 실행 중인 작업과 남은 임시 project/overlay/entry/config는 없으며 추가 엔진 최적화는 미착수다. 재개 시 research.md 「남은 범위」 1번의 Core allocation/조립 축소부터 시작한다.

- **Core:** 스크롤 226개 RenderObject 트리에서도 JS wrapper 없는 실행의 누적 할당은 약 6.0MB/프레임·GC 229회/154프레임이었다. 마지막 세부 진단의 `Root.build` p50/p95는 17.84/20.68ms, root 할당 p50은 5.80MB였다. compose·의미 geometry·host snapshot 재조립이 남았고 스크롤 Element rebuild는 0회였다. 진행 표시/activity의 SDK React 알림도 0회였다.
- **native/전환:** 스크롤 표시 경로 p50은 9.43ms이며 Graphite recording 삽입 4.19ms, import 1.16ms, GPU 완료 대기 0.84ms, cache purge 0.83ms였다. 후속 retirement는 0.004ms였다. 전환에는 widget/layout의 긴 지연과 약 5.85개/프레임의 native Picture 컴파일이 남았다. 중첩 경과시간을 합산하거나 GPU execution time으로 해석하지 않는다.
- **대조/경계:** clear-only replay로 native 비용을 줄여도 스크롤 완료율은 약 43/초에 머물렀다. host 의미 트리 고정 결과는 정상 실행 편차 안이었다. 현재 RNW rAF는 dispatcher 재게시를 사용하며 물리 vsync/scanout을 관측하지 않는다. `-O`는 communication 선택 뒤 45초 watchdog exit 2로 실패했고 기본 `-Og`는 유지한다. 이 실패 실행의 정상 drain은 확인하지 못했다.
- **검증/다음 범위:** 두 native fixture 실행은 각각 20분 이내였고 설정 11개 중 정상 10개가 네 동작·GPU/input drain을 완료했다. 전체 typecheck와 fixture 문법/수치/실제 timing object 링크 검사를 확인하고 임시 project/overlay/entry/config를 finally에서 삭제했다. 추가 engine/공급 변경과 일반 Release 재빌드는 하지 않았다. 남은 우선순위는 Core allocation/조립 축소, recording 삽입·공유 자원/캐시 수명, 전환 build/layout과 실제 display pacing이다. 안정적인 60FPS·물리 FPS는 미검증이다.

### 7.19 Core 할당 경로와 layer 수명 추가 연구 — 2026-10-20 KST

새 `research.md` 연구 요청 범위다. 제품 구현·공급 변경은 없으며 전체 W13은 **PAUSED / PARTIAL / wholePlanComplete=false**를 유지한다. 상세 조건·근거·수정 순서는 [research.md의 추가 연구](research.md#추가-연구-core-할당-경로와-수정-우선순위)를 따른다.

- **확인:** root body 교체와 보존 자식 재부착이 layer detach/attach·depth·callback 순회를 반복하고 `children` getter마다 frozen 배열을 만든다. 실제 갤러리의 별도 Core 실행에서 변경 없는 강제 프레임의 compose만으로 container detach/attach 각각 **93회**, `children` 배열 **718회**를 재현했다. 의미 snapshot도 전체 render 식별·traversal·action을 다시 조립한다. 검증된 immutable 명령 값 재사용은 이미 구현돼 있다.
- **증거 범위:** Node 24.15.0/V8·800×600 logical·실제 Core/문단 layout·계수용 Picture backend의 **24 step** allocation sampling이다. Windows/Hermes의 FPS·6MB/프레임 배분이나 native 비용으로 확대하지 않는다. 9개 모듈의 source/dist 본문 일치, probe 1개와 기존 관련 회귀 **28개 통과**, compile/retire 계수 일치와 임시 파일 정리를 확인했다. 원시 profile은 보관하지 않았다.
- **다음:** layer 내부 배열/반복 부착·root 조립 → 의미 revision/action 수명 → Vulkan import/recorder·purge 정책 → 전환/pacing 순서다. 자체 D3D texture는 이미 보존되며 Vulkan import가 반복된다. 공급 헤더 원본의 `freeGpuResources`를 shader pipeline cache 전체 초기화로 단정하지 않는다. 고정 Hermes sampling은 GC 회수 표본을 지우므로 누적 할당·GC와 구간 계측을 함께 사용한다. 실제 Windows 재측정과 안정적인 60FPS·scanout은 남는다.

### 7.20 Core 조립·layer·의미 snapshot 할당 수정 — 2026-10-20 KST

추가 연구 뒤 사용자의 수정 요청 범위다. 아래 Core 최적화와 Windows 재측정을 진행했으며 전체 W13은 **PAUSED / PARTIAL / wholePlanComplete=false**를 유지한다. 최신 수치와 정확한 전후 조건은 [research.md의 이번 수정](research.md#이번-수정)을 따른다.

- **제품:** 값 명령·삽입 위치·부모·소유 구조가 같은 root body를 보존해 retained subtree의 반복 detach/attach를 생략한다. children snapshot을 구조 변경 때만 교체하고 callback aggregate count와 한 배열의 깊이 순회를 사용한다. 내부 scene은 중간 CPU Picture/frame 없이 최종 Canvas로 전달하되 독립 resource hold·rollback·동일 admission 검사를 유지한다. host 의미 식별은 produced source fragment 색인을 사용하고 결과 속성을 직접 구성한다. action/editor 세대는 계속 갱신하며 접근성·일반 그림·GPU 대기·Hermes `-Og`를 유지한다.
- **검증:** 최종 관련 회귀 **72개**, 전체 typecheck, package boundaries와 design ownership 검사 통과. 공개 snapshot 불변성·callback 변경/재부착/폐기·Leader/Follower 좌표·외부 구조 변경·실패 재시도·in-flight Picture·streaming 자원 수명/registry 충돌/expanded budget을 확인했다. 기본 공급 경로로 Core를 재공급·설치하고 변경 **6개 모듈**의 source/dist/설치본 일치를 확인했다. 중간 단계의 실제 갤러리 V8 24-step 대조에서는 root 할당 표본 약 **28% 감소**, 강제 프레임 compose detach/attach **93/93 → 0/0**, host 식별 render 방문 **476 → 0**을 확인했다. 이 V8 결과를 Windows 전체 할당이나 FPS로 확대하지 않는다.
- **Windows:** 설치본·Release·1000×1000·Hermes99 `-Og`, source alias/JS wrapper/native overlay를 끈 직전 1회 → 최종 2회에서 스크롤 native 완료율 **39.14 → 53.63~53.87/초**, 간격 p95 **29.50 → 22.05~22.69ms**였다. 진행 표시는 개선되지 않았고 activity·전환의 편차와 긴 전환 프레임은 남는다. 별도 JS 진단까지 **3회 모두** 네 동작과 GPU/input drain을 완료했으며 fixture 임시 파일을 finally에서 삭제했다. wrapper 없는 현재 스크롤의 누적 할당은 약 **4.87MB/완료 프레임**이었다.
- **일반 앱:** Release 빌드와 **1,745개 파일** inventory·Hermes 공급·최종 번들 검증 통과. 최종 번들의 변경 6개 모듈이 제품 dist와 일치하고 진단 fixture는 포함되지 않는다. 처음 smoke는 숨김 창 식별 실패로 강제 정리했으며, 검사 도구를 PID·창 제목 기반으로 고친 뒤에는 창 생성·응답·`WM_CLOSE` 정상 종료(exitCode=0, 강제 종료 없음)를 확인했다. package qualification은 `notVerified`를 유지한다.
- **잔여:** 같은 조립의 반복 부착·중간 Picture·host render 전수 순회는 줄였지만 source semantics geometry/설정 갱신과 나머지 할당, snapshot revision 분리, native recording/import/cache 수명, 전환 build/layout과 실제 display pacing은 남는다. 안정적인 60FPS·물리 scanout·reader/OS 입력 전체·Android/Web 실행과 W13 전체 완료를 판정하지 않는다.

### 7.21 Windows 테두리 크기 변경 장애 대응 — 2026-10-20 KST

사용자의 실제 테두리 드래그 중 마지막 화면/빈 영역·native drain 오류·닫기 불가 보고에 대한 별도 수정이다. 전체 W13은 **PAUSED / PARTIAL / wholePlanComplete=false**, 크기 변경 장애는 **PARTIAL**이다. 상세 근거는 [research.md](research.md#창-크기-변경-장애--2026-10-20-kst)를 따른다.

- **제품:** Windows UI 작업의 최초 예외/HRESULT를 보존하고 후속 오류·status에 노출한다. admission 종료와 대기열 포화를 구분한다. 실패한 native 세션을 명시적으로 닫을 때는 불확실한 JSI/GPU owner를 프로세스 회수 때까지 보존한 채 **exit 2**로 종료하며 GPU drain 성공을 기록하지 않는다. 정상 종료의 GPU/input drain 조건은 유지한다.
- **검증 완료:** 설치본·Release·Hermes99 `-Og`, source alias/JS 성능 wrapper/native timing overlay 없는 두 실행에서 각각 실제 마우스 드래그의 **24 WM_SIZING**, 프로그램 크기 변경 **19회**, 네 동작과 정상 GPU/input drain을 확인했다. 마지막 실행은 새 surface 세대·Core viewport·native backing과 일치하는 프레임 retirement **19회**도 확인했다. 실제 표시 직후 native 오류 주입 + `WM_CLOSE`는 **exit 2 / gpuDrained=0**으로 종료했다. 독립 UI 오류 주입에서 admission/close의 최초 원인 보존, 관련 Node 회귀 **16개**와 package boundaries/design ownership 검사도 통과했다. 크기 변경 결과를 성능 수치로 비교하지 않는다.
- **현재 공급:** runner 재공급·설치와 일반 Release 빌드·**1,745개 파일** inventory·Hermes99 검증 통과. 변경 native 헤더 **3개**의 설치본 일치, 최종 EXE의 새 오류/종료 문구와 기존 Core 변경 **6개 모듈**의 최종 번들 일치를 확인했다. 일반 앱 창 생성·응답·`WM_CLOSE` 후 **exit 0 / 강제 종료 없음**을 확인했다. 현재 `.nelyx/windows/packages/Release`의 qualification은 `notVerified`다. 기존 MSVC/Skia 경고는 남으며 임시 native host/entry/config는 정리했다.
- **잔여:** 원래 멈춤은 아직 재현하지 못했으므로 최초 표시 실패·빈 영역의 원인과 전체 크기 변경 안정성은 미확정이다. 재발 시 보존한 최초 UI 예외나 명확해진 대기열 포화 오류로 이어서 진단한다. 물리 표시 픽셀/FPS·reader·전체 OS 입력·Android/Web 실행과 W13 전체 완료로 확대하지 않는다.

### 7.22 패키지 셰이더 파일 분리 — 2026-10-20 KST

별도 사용자 요청 범위이며 전체 W13은 **PAUSED / PARTIAL / wholePlanComplete=false**를 유지한다.

- **제품:** Doroti Material의 파일 구성을 참고해 canonical 소스를 `packages/material/assets/shaders/ink_sparkle.sksl`로 옮기고 기존 TS 문자열 모듈을 제거했다. 공통 패키지 빌드가 소유 패키지의 `.sksl` 기본 import를 JS에 포함한다. 파일 누락·빈 내용·ASCII/크기 제한·소유 경계 위반은 dist 교체 전에 실패한다. 실행 시 파일·네트워크·변환기·Flutter checkout이 필요하지 않다.
- **출처/사용:** 이전 런타임 소스 3,449바이트와 28개 float uniform 순서를 그대로 유지했다. 생성 목적지·hash/소유권·Flutter 라이선스와 패키지 안내를 갱신했다. 파일 수정 후 `npm run build --workspace @nelyx/material`로 반영한다.
- **검증 완료:** Material 최종 빌드, 전체 8개 workspace 타입검사, package boundaries/design ownership, 관련 회귀 **13개** 통과. 실제 Core ink paint·CanvasKit 오프스크린 실행·프로그램 캐시/종료와 독립 archive 설치본의 공개 ESM/타입·원본 asset 포함/동일 소스 사용을 확인했다. 이전 shader dist와 staging은 남기지 않았다. 실제 브라우저·Windows/Android native 실행은 이번 변경에서 재검증하지 않았으며 기존 플랫폼 검증 범위를 확대하지 않는다.

## 8. W13 종료와 W14 이관 — 2026-10-21 KST

- W13-00의 이전 계획 이관과 선정 구현·검증은 완료 이력으로 유지한다. **미완료 W13-01~11 전부**는 [W14 §4.1](work14.md#41-w13-0111-대응)의 11개 행에 대응한다. **R0~R6**는 W14 §4.2에 대응한다.
- `sample/nelyx-testbed-app-2`와 Doroti Components 비교에서 드러난 실제 Widget 미구현·간소화·두 섹션 제한·문단 자원/모달/State·입력/성능/resize·공급 잔여를 W14의 구현 묶음으로 재구성했다. 카탈로그 밖의 table/expansion/stepper·전체 locale·개발/접근성/임베딩도 필수 범위에 남는다.
- §7.13의 기본 Windows provider/Fabric focus·OS 입력 순서·현재 Android APK/물리 검증, §7.20의 성능 한계와 §7.21의 원래 resize 멈춤 원인 미확정, §7.22 변경 뒤 실제 환경 미재검증을 완료로 올리지 않았다. 정책 거부/EPERM 정리 예외도 삭제 완료로 바꾸지 않았다.
- 이번 작업은 문서 검토·이관이다. **유일한 활성 계획 W14 / 실행 PAUSED / 제품 PARTIAL / `wholePlanComplete=false`**다. 별도 checkpoint/history/receipt/archive는 만들지 않았다.
