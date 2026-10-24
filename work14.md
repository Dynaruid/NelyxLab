# work14 — Doroti 컴포넌트 비교를 기준으로 한 Nelyx 테스트베드·엔진 완성 계획

현재 기준: **2026-10-22 KST**. 사용자 “일단 중간마무리하자” 요청으로 전체 개편 구현을 **PAUSED**했다. 그 범위·공급·검증·재개 지점은 §8을 따른다. 별도 요청한 §9의 미타입 AOT와 [W15](work15.md)의 선정 typed 실험은 과거 자료다. 전체 앱 typed AOT 후속 계획은 [work15a.md](work15a.md)의 **ACTIVE / READY · 구현 NOT_STARTED**다. 이번 후속 요청은 문서 작성만이며 전체 개편을 재개하지 않는다. 제품 전체: **PARTIAL**, `wholePlanComplete=false`.

사용자 요청으로 [work13.md](work13.md)를 **CLOSED / SUPERSEDED BY W14**로 종료한다. **테스트베드·엔진 전체 개편의 현행 계획은 work14.md**이며 전체 앱 typed AOT의 후속 범위는 work15a.md에서 관리한다. W15는 CLOSED / SUPERSEDED BY W15A인 선정 실험 기록이다. W13-01~11과 R0~R6의 필수 잔여를 §4에 전부 이관하고, `sample/nelyx-testbed-app-2`를 실제로 사용할 수 있도록 완성하는 순서로 재구성한다. 최초 작성은 소스 검토·계획·문서 이관이며, 이후 사용자의 전체 작업 요청으로 구현 실행을 재개했다. §7은 이전 중간 마무리의 역사적 상태이며 전체 개편의 재개 범위는 §8에 기록한다.

## 0. 목표와 개발 기준

목표는 DorotiTestbedApp의 Components 페이지에서 가능한 조작을 Nelyx의 공개 API와 Core/Skia 렌더링으로 제공하고, 그 과정에서 드러나는 엔진·디자인 패키지·플랫폼·공급의 부족을 실제 제품 owner에서 해결하는 것이다. **샘플의 섹션 수를 맞추는 것과 제품 기능을 완성하는 것은 별도 완료 조건**이다. Material 29개·Cupertino 20개는 출발점이며 전체 API와 W13 승계 범위의 상한이 아니다.

| 기준 | W14 적용 방침 |
| --- | --- |
| 시각·상태 소유권 | 기본 UI의 상태·layout/paint/hit/clip·text/caret/selection/composing·menu/dialog/picker는 **Core/Skia**가 소유한다. 플랫폼은 surface·입력·IME·접근성·OS 서비스를 연결한다. 좌표는 Core → View transform/clip/DPI → OS 방향으로 전달한다. |
| 실행 순서 | **공통 엔진 개선·현재 공급본 검증을 먼저 완료한 뒤 컴포넌트를 확장한다.** W14-00 → 01 → 02 → 03 → 11의 엔진 공통 범위 → 12의 1차 공급 검증 → §5.2의 선행 조건 충족 → 04~10 순서다. 기존 갤러리는 엔진의 재현·회귀·측정 앱으로 계속 사용한다. |
| 제품과 샘플 | `Nelyx/src`, `packages/material/src`, `packages/cupertino/src`, SDK/Skia의 실제 owner를 수정하고 같은 묶음에서 샘플이 공개 API로 소비한다. 샘플 내부 painter·버튼 조합·route shim으로 미구현 제품을 대체하지 않는다. |
| 기존 구현 재사용 | Core RenderEditable/TextPainter·Form·controller/undo·route/overlay·sliver·wheel·색/테마·기본 control·InkSparkle와 최근 성능 수정을 보존한다. 존재하는 기능을 다시 만드는 대신 누락 계약과 검증 공백을 닫는다. |
| 참조 소스 | 현재 Doroti의 기능 책임·조작 흐름·모듈 분리를 비교한다. pinned Flutter는 API/default·layout/paint/입력·숫자 의미의 독립 비교 근거다. Doroti의 native UI 선택이나 내부 C# hierarchy를 복제하지 않는다. |
| 구현 방식 | 제품 TypeScript에서 직접 개발한다. 변환 도구는 필요한 공통 결함 수정·출처/ownership 정합성에 한정한다. family 전용 변환기·recipe 확장, 원본 전체 변환을 선행 목표로 만들지 않는다. |
| Material 정책 | **M3 only**. M2·`useMaterial3`·deprecated API/alias를 복구하지 않는다. 기존 current/2023 M3 및 공통 색상·shape·명시적 ink factory/hairline은 유지한다. |
| identity·타입 | Widget/Element/State/RenderObject·Color·focus/편집/자원은 단일 Core identity를 사용한다. Core→design·Cupertino→Material·runtime→SDK/tooling 역의존을 금지한다. 구체 타입과 유효한 `@dartType`·`@dartParam`·`@dartReturn`을 공개 `.d.ts`까지 보존한다. |
| 생성 소유권 | 직접 수정할 생성 소스는 명시적으로 adopt하고 필요한 owner 정보만 갱신한다. 유지하는 생성 경로의 merge/edit guard와 출처/license를 보존한다. `any`·stub·가짜 default로 미지원 의미를 통과시키지 않는다. |
| 플랫폼·예외 | Windows/Android/Web은 필수 실제 환경이다. iOS/macOS/Linux 전용 native build/run·물리 입력·서명·전용 harness는 기존 **SKIPPED**, provider는 **notVerified** 예외를 유지한다. 여섯 target 공통 코드·계약·package/runner/template·공급 구성은 필수다. |
| 기록 | 현재 계획·짧은 진행 상태·잔여는 이 문서에, 사용법은 기존 README에 둔다. [저장소 지침](.github/copilot-instructions.md)에 따라 삭제한 ledger/checkpoint/archive·변환기 checks와 `Nelyx/docs/plans/`, `Nelyx/docs/migrations/`를 복원하지 않는다. |

## 1. 계획 작성 시 확인한 기준선과 부족

이 절은 구현 재개 전의 정적 비교 기준선이다. 변경 후 현재 구현·실행 결과와 남은 제한은 §7을 따른다.

### 1.1 비교 범위와 증거의 한계

- Nelyx HEAD: `bf1fd6f671396c40bdeac0a0004e28083b8749bb`. 시작 시 dirty는 빈 `work14.md` 한 개였다. 현재 소스를 읽었으며 W13 중단 당시의 dirty 178개를 현재 변경 상태로 복사하지 않는다.
- Doroti HEAD: `8f94d23b840cad737bb54f40be2458835da07996`. 비교 대상 `samples/DorotiTestbedApp`에는 현재 dirty가 없었다.
- 비교 원본: [Components.cs](../DorotiLab/samples/DorotiTestbedApp/src/MaterialSample/Components.cs), [Selection.cs](../DorotiLab/samples/DorotiTestbedApp/src/MaterialSample/Selection.cs), [Decorations.cs](../DorotiLab/samples/DorotiTestbedApp/src/MaterialSample/Decorations.cs), [ImageDemo.cs](../DorotiLab/samples/DorotiTestbedApp/src/MaterialSample/ImageDemo.cs).
- Nelyx: [Material gallery](sample/nelyx-testbed-app-2/src/gallery.ts), [Cupertino gallery](sample/nelyx-testbed-app-2/src/cupertino-gallery.ts), 두 catalog, 제품 Widget/공개 export, Core text/route/overlay/sliver/편집 경로, [Root 회귀](sample/nelyx-testbed-app-2/tests/gallery.test.mjs)를 확인했다.
- 이번에는 앱을 새로 실행하거나 화면을 캡처하지 않았고 제품 build·test·native/물리 검증도 실행하지 않았다. 아래 수치는 **현재 소스의 정적 분류**이며 W13/research의 실행 결과는 각각 당시 조건의 기록이다. 사용자가 본 외형 차이 전부의 원인을 이번 정적 검토만으로 확정하지 않는다.

### 1.2 카탈로그 상태와 실제 기능을 분리해야 한다

| 페이지 | 전체 | `ready` | `basic` | `planned` | 현재 의미 |
| --- | ---: | ---: | ---: | ---: | --- |
| Material | 29 | 12 | 2 | 15 | 14개 데모 제공. Dialog·TextField는 제한된 API 데모다. |
| Cupertino | 20 | 7 | 3 | 10 | 10개 데모 제공. navigation·dialog·text-field가 basic이다. |

근거는 [catalog.ts](sample/nelyx-testbed-app-2/src/catalog.ts)와 [cupertino-catalog.ts](sample/nelyx-testbed-app-2/src/cupertino-catalog.ts)다. `ready`는 데모 제공 표시이며 family 완료가 아니다. Cupertino의 `form`은 `planned`지만 실제 `text-field` 데모 안에는 Form row/section·validation/save/reset이 이미 있다. 이 경우는 **제품 미구현과 카탈로그/진입점 불일치를 구분**해야 한다.

### 1.3 핵심 검토 결과

| 구분 | 소스에서 확인한 내용 | 작업 판단 |
| --- | --- | --- |
| 제품 기능 누락 | FAB·SegmentedButton·ScaffoldMessenger/SnackBar·AppBar/BottomAppBar·navigation/tab·menu/search·picker·carousel 등은 theme/enum이 있어도 실제 Widget/공개 기능 정의를 확인하지 못했다. | 제품 family를 구현하고 샘플에 연결한다. theme 파일 수를 구현률로 계산하지 않는다. |
| 간소화 | [Scaffold](packages/material/src/scaffold.ts)는 title/body/trailing과 고정 배치, [Material dialog](packages/material/src/dialog.ts)·[Cupertino dialog](packages/cupertino/src/dialog.ts)는 고정 Close UI다. [Cupertino nav-bar](packages/cupertino/src/nav-bar.ts)·[page-scaffold](packages/cupertino/src/page-scaffold.ts)도 제한된 title/back 배치다. | 슬롯·State·inset·모달·결과/취소·focus·복원 계약까지 실제로 완성한다. |
| 갤러리의 엔진 제약 노출 | 양쪽 gallery는 `catalog.slice(pageIndex * 2, ... + 2)`로 한 번에 두 섹션만 표시한다. Material은 per-View text resource 제한을 이유로 명시한다. | 단순히 페이지당 개수를 늘리지 않는다. 문단·레이아웃·가상화·자원 수명을 먼저 개선해 연속 탐색을 제공한다. |
| 실제 자원 상한 | [text.ts](Nelyx/src/ui/text.ts)의 정상 live paragraph producer는 64, retained resource는 256, 문단 입력은 4,096 UTF-16 units·128 lines로 제한된다. 교체/transient 측정은 별도 gate가 있다. | 현재 API가 보장할 콘텐츠 규모를 정의하고 정상 화면이 임의의 작은 상한에 걸리는 경로를 해결한다. 안전 gate 무제한 해제나 상수 증대만으로 완료하지 않는다. |
| 샘플의 변형 부족 | ready 섹션도 버튼 종류별 enabled/disabled/icon 조합, toggle tile, InputChip 삭제, badge+navigation, 여러 TextField 상태 등 Doroti의 사용 변형을 충분히 노출하지 않는다. | 이미 있는 제품 API의 데모 보완과 제품 결함 수정을 나눠 진행한다. |
| 편집은 구현 보존 필요 | 현재 [RenderEditable](Nelyx/src/framework/rendering/editable.ts)는 TextPainter와 Core paint를 사용한다. W13 §7.13에는 Core 편집·OS bridge·UIA의 선정 구현이 기록돼 있다. | W13 앞부분의 이전 hosted-editor 설명을 최신 소스의 전면 미구현으로 읽지 않는다. 기본 provider·전체 입력 순서·접근성 결합·실제 환경 잔여를 이어간다. |
| 검증 범위 | Root 회귀는 실제 Core Widget·CanvasKit 측정과 상태/수명을 다루지만 host editing IO는 fixture다. | Root 통과 외에 현재 Web/EXE/APK의 픽셀·실제 조작·OS 입력·reader·GPU/표시를 분리해 검증한다. |
| 안정성·성능 잔여 | [research.md](research.md)와 W13 §7.20~7.21은 최적화 후에도 할당/전환 지연·물리 FPS 미검증, 원래 resize 멈춤의 원인 미확정을 남긴다. | 기존 개선을 보존하고 재현·원인별 수정·정상/실패 종료를 검증한다. 오류 노출 개선을 원래 멈춤 해결로 판정하지 않는다. |

## 2. Doroti Material 29개 섹션의 대응 작업

표의 현재 상태는 카탈로그 표시다. 모든 행은 정상/disabled/error 중 해당 상태, pointer/keyboard/focus, theme/scale/RTL, 취소/복원/해제를 §6 기준으로 검증한다. **C01~C29 전부**가 추적 대상이며 이미 ready인 항목도 필요한 변형·제품 잔여가 있으면 PARTIAL이다.

| ID | Doroti 섹션 | Nelyx 현재 | 완성할 실제 흐름과 제품 책임 | 실행 묶음 |
| --- | --- | --- | --- | --- |
| C01 | Common buttons | ready | Elevated/Filled/Tonal/Outlined/Text의 enabled·disabled·icon/label·focus/hover/pressed·style/theme 우선순위·ink/tooltip. | W14-07 |
| C02 | Floating action buttons | planned | 크기/extended·icon/label·disabled·Scaffold 배치/충돌·motion·semantics와 호출 결과. | W14-04 |
| C03 | Icon buttons | ready | standard/filled/tonal/outlined의 선택·미선택·disabled·selectedIcon·tooltip·keyboard와 최소 hit 영역. | W14-07 |
| C04 | Segmented buttons | planned | 단일/다중 선택·선택 해제 정책·disabled segment·selected icon·방향키·RTL·controlled 값 변경. | W14-04 |
| C05 | Badges | ready | dot/label/count·overflow 표시·위치/크기·NavigationDestination 선택과 결합·semantics. | W14-07/05 |
| C06 | Progress indicators | ready | 선형/원형·determinate/indeterminate·시작/정지·theme·offstage/route 종료 시 ticker/paint 격리. | W14-07/11 |
| C07 | Snackbar | planned | Messenger의 queue/show/hide/remove·action·timeout·floating 위치·닫기 이유·route/IME와 종료. | W14-04 |
| C08 | Bottom sheet | planned | persistent/modal 열기·닫기·결과/취소·drag/scroll·barrier·keyboard inset·Scaffold와 focus 복원. | W14-06 |
| C09 | Cards | ready | elevated/filled/outlined·shape/border/clip/elevation·theme·내용 hit/semantics·좁은 폭 배치. | W14-07 |
| C10 | Carousel | planned | 실제 CarouselView/controller·snapping/non-snapping·viewport/resize·drag/keyboard·선택·자원 해제. | W14-06 |
| C11 | Dialog | basic | Dialog/AlertDialog/SimpleDialog·가변 actions/content·scroll·barrier/Back/Escape·typed result·focus/restore. | W14-03/06 |
| C12 | Dividers | ready | 수평/수직·indent/endIndent·thickness·색/공간·RTL·card/list 조합. | W14-07 |
| C13 | Bottom app bar | planned | BottomAppBar의 슬롯·FAB 위치/shape·safe-area·스크롤/resize·Scaffold 배치와 입력. | W14-04 |
| C14 | Navigation bar | planned | destination 선택·indicator/label·badge·disabled/focus·본문/route State와 복원. | W14-05 |
| C15 | Navigation drawer | planned | destination/group/header/divider·선택·modal/nonmodal·outside/Back·focus 진입/복귀·Scaffold 상태. | W14-05 |
| C16 | Navigation rail | planned | label/extended·leading/trailing·destination 선택·keyboard traversal·좁은 폭 전환과 State. | W14-05 |
| C17 | Tabs | planned | TabController/DefaultTabController·TabBar/TabBarView·tap/swipe/animation 동기화·중첩 scroll·각 tab의 State/focus/offset. | W14-05 |
| C18 | Search | planned | SearchBar/SearchAnchor·query/history/suggestions·선택/취소·async stale/error·keyboard·route 결과/편집 복원. | W14-05/08 |
| C19 | Top app bars | planned | AppBar와 필요한 SliverAppBar 변형·title/actions·collapse/pinned/floating·NestedScrollView·system inset/배율. | W14-04/05 |
| C20 | Checkboxes | ready | binary/tristate/disabled/error·CheckboxListTile·MergeSemantics·theme/keyboard·controlled 값과 수명. | W14-07 |
| C21 | Chips | ready | Action/Choice/Filter/InputChip·assist/suggestion 표현·avatar/delete·disabled·선택/삭제 focus와 wrap. | W14-07 |
| C22 | Date picker | planned | calendar/input·날짜/범위·first/last/selectable day·validation·locale/RTL·선택/취소·결과/복원. | W14-08 |
| C23 | Time picker | planned | dial/input·12/24시간·범위/입력 오류·locale·keyboard·선택/취소·결과/복원. | W14-08 |
| C24 | Menus | planned | popup/menu anchor/submenu·DropdownMenu의 필터·controller·선택/취소·outside/shortcut·anchor 이동/clip·해제. | W14-03/08 |
| C25 | Radio buttons | ready | RadioGroup의 단일 선택·toggle/disabled·RadioListTile·arrow traversal/RTL·theme·caller owner. | W14-07 |
| C26 | Sliders | ready | 연속/분할·disabled·label/value indicator·RangeSlider thumb 충돌/선택·drag/tap/keyboard·RTL. | W14-07 |
| C27 | Switches | ready | on/off/disabled·thumb icon·SwitchListTile·drag/keyboard·adaptive/theme와 변경 callback. | W14-07 |
| C28 | Text fields | basic | filled/outlined의 정상/error/disabled/readOnly·prefix/suffix/helper/counter·한글/emoji·Form·IME/선택/toolbar/복원·다중 행. | W14-07/01/14 |
| C29 | Image demo | ready | local/URL·loading/error/retry·cover/contain·ColorScheme.fromImageProvider의 light/dark palette·stale 요청·decode/cache 수명. | W14-07/11 |

제품 owner는 `packages/material/src`의 해당 기능 모듈과 Core 공통 계약이다. 기존 Checkbox/Radio/SwitchListTile·InputChip·Image.network·ColorScheme.fromImageProvider가 있는 부분은 샘플에 우선 연결하고, 노출 중 발견한 실제 결함만 제품에서 고친다.

## 3. Cupertino와 공통 엔진 보완 범위

### 3.1 Cupertino 20개 섹션

Cupertino는 Material Components와 일대일 외형 복제 대상이 아니다. 같은 Core/Skia·입력·수명 기반 위에서 Cupertino 공개 API와 디자인 동작을 완성한다. `Cupertino→Material` 의존을 만들지 않는다.

| catalog ID | 현재 | 제품·샘플 완료 범위 |
| --- | --- | --- |
| buttons | ready | plain/filled/tinted·크기·disabled·press/focus·theme·semantics의 전체 선정 API. |
| segmented | planned | segmented/sliding segmented·선택/drag·disabled·RTL·animation·caller 값 변경. |
| context-menu | planned | long press·preview/actions·anchor/overlay·취소·focus/gesture 경합·route/해제. |
| activity | ready | determinate/indeterminate·start/stop·offstage·ticker/paint 격리·theme. |
| lists | ready | tile/section·inset grouped·leading/trailing·tap/disabled·separator·scale/RTL·semantics. |
| dialog | basic | 가변 content/actions·destructive/default·scroll·barrier/Back·결과/취소·focus/복원. |
| action-sheet, sheet | planned 2개 | ActionSheet와 sheet route/transition·actions/cancel·drag/scroll/inset·결과·해제. |
| refresh | planned | 실제 sliver refresh·pull/armed/refresh/done·비동기 오류/취소·scroll physics·종료. |
| navigation | basic | PageScaffold/NavigationBar 슬롯·safe-area·large/sliver title·route/back·입력/테마·복원. |
| tabs | planned | TabBar/TabScaffold/TabView·nested Navigator·각 tab State/focus/scroll·선택 복원. |
| switches, checkboxes, radios, sliders | ready 4개 | 기존 제품 재사용·전체 비폐기 API/default·disabled/gesture/keyboard/RTL·theme/semantics·caller 수명. |
| picker, date-picker | planned 2개 | wheel·날짜/시간/타이머·bounds/locale·12/24시간·선택/취소·scroll/controller·복원. |
| text-field | basic | 기존 Core 편집·장식·clear/Undo·Form 연결 보존, selection/toolbar·전체 입력/복원/OS bridge 잔여. |
| search | planned | SearchTextField의 편집/clear/submit·decoration·focus·IME/취소·semantics. |
| form | planned 표기·본문 일부 존재 | 기존 FormRow/FormSection/TextFormFieldRow를 독립 진입점과 catalog에 맞추고 validation/save/reset·오류 배치·focus/restore/해제를 완성. |

주 실행은 W14-09이며 공통 편집/overlay/scroll·렌더링·입력 기반은 W14-01/02/03/11에서 먼저 검증한다. 엔진 선행 조건 충족 후 W14-07/09에서 디자인별 control·장식·공개 API와 데모를 완성한다.

### 3.2 엔진 검토와 해결 우선순위

| ID·우선순위 | 확인된 사실과 아직 미확정인 부분 | 제품 owner·해결 목표 | 확인할 결과 |
| --- | --- | --- | --- |
| E01·P0 자원 규모/수명 | 두 섹션 pagination과 text producer/retained gate가 실제 존재한다. 전체 갤러리에서 어느 소비자가 상한을 먼저 넘는지는 미측정이다. | `ui/text.ts`·TextPainter/text-layout service·paragraph·ResourceRegistry·Skia backend. visible/retained/in-flight 구분, 교체/measure/eviction·문단 재사용·가상화·앱/View 종료를 설계한다. | 전체 섹션 방문/왕복·메뉴와 편집 동시 표시에서 bounded 사용량·올바른 retire·오류 회복. 정상 사용 가능 규모와 초과 정책을 명시. |
| E02·P1 layout/scroll/State | Doroti는 SectionList·extent index·visited/keep-alive·focus materialization을 쓰고 Nelyx는 두 항목 ListView와 화면 소유 값으로 제한한다. Core sliver/Page/Nested/wheel 등 구현은 이미 있다. | Core viewport/sliver/scroll/focus/keyed Element·갤러리 section owner. 기존 구현의 지원 한계와 first seek/anchor·가변 높이·부분 무효화를 보완한다. | 연속 스크롤·직접 섹션 이동·가로세로/열 전환·테마/배율/locale·mutation에서 offset/State/editor/selection 보존, 보이지 않는 영역의 불필요한 생성 방지. |
| E03·P1 modal/overlay/focus | 일반 Route와 OverlayEntry 기반은 있으나 showDialog는 기본 opaque Route를 push한다. `navigation.ts`의 controller형 Overlay와 `overlay.ts`의 OverlayEntry형이 함께 존재한다. | Core route/overlay/focus/actions/gesture. 실제 소비자를 조사해 canonical 소유권을 정하고 modal barrier·root/nested navigator·focus 복원·anchor/clip·back/result를 공통 구현한다. | 뒤 UI hit/action 차단·Escape/Back/outside 동작·nested overlay 순서·단일 결과 완료·stale callback 차단. 이름만 같은 두 경로의 불일치는 실제 소비 전환으로 해소. |
| E04·P0 Windows 입력/접근성 결합 | Core 편집·TSF/UIA 일부 구현은 W13에 있다. 기본 surface/provider, Fabric root focus, 실제 TIP 비대칭 키 소비와 전체 문자 FIFO 등은 잔여다. | SDK Windows input/semantics·native WindowsInputView/Fabric·Core focus/editing. 기존 ContentIsland root 설치를 중복 구현하지 않고 기본 경로를 완성한다. | root focus↔carrier·keyup/문자 순서·range reveal/retained range 철회·metadata 알림·실패/cohort/owner 교체·실제 한국어 조합과 종료. UI thread가 JS 응답을 동기 대기하지 않음. |
| E05·P0 Windows resize/복구 | 최초 예외 보존·실패 close exit 2 개선은 있다. 사용자가 겪은 원래 멈춤/빈 영역은 미재현·원인 미확정이다. | SDK Windows UI admission·Skia CompositionSurface/Session·viewport/backing epoch. 기존 오류 구분을 사용해 원인별 재현·수정·정상/실패 close를 검증한다. | 드래그 resize·DPI·hidden/resume·입력/animation 중 세대 일치·재표시·응답/종료. 실패 종료를 GPU drain 성공으로 기록하지 않음. |
| E06·P1 성능/프레임 | 기존 최적화 후에도 문단/scene/semantics 할당·GC·native recording/import/cache·전환 build/layout이 잔여다. callback 완료율은 물리 FPS가 아니다. | Core root/layer/semantics/scheduler·Skia recording/fence/import/cache·host pacing. 단계별 시간을 분리해 실제 병목을 수정한다. | 현재 동일 공급본에서 allocation/GC·CPU p50/p95·완료/표시 간격·긴 프레임·메모리·drain을 함께 확인. 접근성을 끄거나 fence를 제거해 수치를 만들지 않음. |
| E07·P1 플랫폼/공급 일치 | runner는 workspace 소스가 아닌 hash가 있는 archive를 설치한다. 최근 shader 분리 후 native 전체 실행과 변경 후 Android APK 검증은 별도 잔여다. | package exports/JS/`.d.ts`·prepare-runner·SDK/CLI/Metro·Skia/assets. 현재 source→dist→archive→설치→최종 bundle의 일치를 검증한다. | source alias 없이 공개 소비·단일 Core identity·font/icon/shader/license·실제 EXE/APK/Web의 같은 기능 흐름. |

P0는 정상 사용을 막는 경로의 우선순위다. 이미 통과한 같은 입력의 회귀를 반복하는 대신 부족한 기본 연결과 재현 조건을 조사한다. **E01~E07의 엔진 공통 범위를 먼저 보완·검증하고 §5.2의 조건을 충족한 뒤 신규 컴포넌트 family에 착수한다.** 기존 control은 엔진 검증에 사용하며 공통 결함은 실제 엔진 owner에서 해결한다. 각 family를 추가한 뒤에는 그 변경으로 영향받은 엔진 계약·성능·공급을 다시 확인한다.

## 4. W13 종료와 필수 잔여의 전량 이관

### 4.1 W13-01~11 대응

아래 **11개 행 전부**가 W14의 필수 범위다. W13의 당시 source/실행/공급 이력은 [work13.md](work13.md)에 남기되 새 실행 지시로 사용하지 않는다. 계획 종료는 제품 완료가 아니다.

| W13 종료 범위 | W14 실행 owner | 그대로 승계하는 필수 잔여 |
| --- | --- | --- |
| W13-01 디자인·공개 구조·locale | W14-04~10/12 | 양쪽 전체 비제외 공개/default API·간소화/미구현 family·theme/typography·전체 지원 locale/RTL·font/icon/shader·독립 소비/공급. 기존 구조·OverflowBar·type/numeric 성과 재사용. |
| W13-02 scroll·viewport | W14-02/05/06/09/10 | animated/Page/Nested/header/refresh/reorder/dismiss/sheet의 실제 제한·mixed sliver/first seek·keyed State/selection·restore/close·성능/공급. 기존 구현을 전면 미구현으로 재분류하지 않음. |
| W13-03 runtime·paint·text·입력 | W14-01/02/03/07/11/12 | service/worker 오류/취소/stop·cache/retirement·font/fallback/strut/hyphens·wide-gamut/output·image/bitmap·pointer/animation/physics·backend 복구/drain·앱/View 수명. |
| W13-04 편집·Form·OS 입력 | W14-01/02/07/09/11/14 | Core 편집·selection/handle/toolbar/magnifier·bidi/affinity·남은 controller/style/formatter API·autofill·multi-View/provider·물리 IME·복원/해제와 실제 bridge. 공통 renderer/입력 계약을 먼저 검증하고 디자인별 장식·API를 연결. |
| W13-05 앱·라우팅·복원 | W14-03/05/06/08/09/10 | App/Navigator/Router·Overlay/Hero·async/locale·predictive/native producer·OS link→nested Form/list/dialog→Back→locale→process recreation/restore/close. |
| W13-06 플랫폼 runtime/tooling | W14-01/12 | 여섯 target 공통 host/SDK/CLI/Metro/provider·runner/template·선택 설치/로드·역의존 제거·Core identity·Skia/texture/OS adapter·기본 경로/공급·종료. |
| W13-07 개발 갱신·inspector | W14-13 | 실제 Widget 수정→State 유지/reassemble·reload/remount 정책·source map/preview·inspector/service extension·Windows/Android 실패 회복/cleanup. |
| W13-08 실제 환경·감사·공급 | W14-01/11/12 | 현재 source/archive/설치·Windows/Android/Web·실제 OS/물리 IME/caret·GPU/FPS·resize/hidden/resume/loss/복구/종료·version/lock·signing/clean-machine·출처/재현. |
| W13-09 접근성 | W14-14 및 각 family | 설정→View/MediaData·semantics tree/ack/action/metadata·callback 교체/실패 owner 회복·reader·Apple/Linux producer 코드·Core geometry·중복 action/tree 제거. DEFERRED는 후속 순서이며 면제가 아님. |
| W13-10 명시적 native/HTML view | W14-15 | PlatformView/HtmlElementView/AndroidView/UiKitView 계열의 생성/부착/합성·clip/transform/z-order·focus/input·route/scroll/overlay/reload·오류/복구/해제. |
| W13-11 최종 통합·정리 | W14-16 | 후속 영향 회귀·전체 API/locale·플랫폼/개발·성능/안정성·독립 소비/배포/출처 감사·문서/정리·전체 완료 판정. |

### 4.2 R0~R6와 최신 잔여의 승계

| W13 횡단 조건 | W14 대응과 현재 의미 |
| --- | --- |
| R0 경로 감사 | W14-00/01/12. 현재 소스의 Core/SDK/host/proxy/공급을 확인하며 초기 W13의 owner 불일치를 모두 현재 실패로 복사하지 않는다. |
| R1 Core 편집 renderer | W14-02/07/11. 기존 glyph/caret/selection/composing paint와 paragraph geometry를 재사용하고 나머지 API·selection UI·scale/bidi·자원/복원 잔여를 완성한다. |
| R2 OS bridge | W14-01/07/12/14. Windows 기본 provider/Fabric focus·문자/키 순서, Android 소비 키/Backspace keyup·빠른 Core 명령 순서, Web composition과 접근성 수명 분리를 포함한다. |
| R3 TextField/Form 통합 | W14-07/09. 양쪽 전체 비제외 API·여러 필드·validation/clear/Undo/reset·IME/viewport·controller 복원·실제 공급본을 검증한다. |
| R4 기본 UI/semantics | W14-03~10/14. 모든 family의 Core paint/hit·focus와 단일 Core action을 확인한다. |
| R5 이전 경로/공급 정리 | W14-12/13. visible editor 전용 등록/필수 font 검사·obsolete alias/fallback을 실제 소비 전환 후 제거하고 비시각적 carrier와 Skia font 공급을 유지한다. ReactHost focus-ready·폐기 예정 RN core Clipboard 경고도 해결/판정한다. |
| R6 실제 환경/소유권 증명 | W14-10~12/14/16. 현재 Skia 장면과 OS/물리 입력·reader·GPU/scanout·설치본을 각각 확인한다. |

- **편집 상세 잔여:** 임의 active composing value/range 명령·advanced lookup/search/share/live-text·공개 controller/디자인 text 복원, 조합 중 clip/재배치·후보창·native producer의 setText/setSelection/알림을 유지한다. 미지원 의미는 구체적 상태와 원인으로 남긴다.
- **최신 성능/resize:** W13 §7.14/§7.16~7.21과 research의 개선은 보존한다. 최초 resize 멈춤의 원인, 남은 allocation/semantics/recording/import/cache·전환/pacing은 W14-01/11의 OPEN/PARTIAL 작업이다.
- **최근 변경:** W13 §7.15의 CLI 앱 구성 통합과 §7.22의 `packages/material/assets/shaders/ink_sparkle.sksl` 분리를 유지한다. 과거 TS shader 문자열이나 옛 runner 구성을 복원하지 않는다. 새 native/브라우저 검증이 필요하면 현재 공급본으로 수행한다.
- **과거 정리 예외:** W13 §7.13의 정책 거부/EPERM 임시 경로 4개는 과거 미정리 기록이다. 이번에는 삭제를 실행하거나 완료로 바꾸지 않았다. 후속 정리 때 현재 존재·소유/참조·정확한 절대 경로를 다시 확인한다. 삭제한 checkpoint/receipt를 재개 조건으로 요구하지 않는다.
- **선택 항목 유지:** 기존 TypeScript 7 검사와 Compiler API 역할 분리를 유지한다. Oxlint 도입은 선택, type-aware lint는 DEFERRED/notVerified다. 범용 Dart/C# compiler 확장은 완료 조건에 포함하지 않는다.

## 5. 실행 묶음과 의존 순서

**엔진 선행 개선 → 기존 앱으로 엔진 검증 → 컴포넌트 확장 → 전체 통합** 순서로 진행한다. 각 묶음은 **제품 수정 → 공개 API의 샘플 소비 → 정상/오류/입력/취소/복원/종료 검증 → 필요한 공급 갱신 → 짧은 상태 갱신**으로 끝낸다. 공통 의존성은 실제 Core owner에서 해결한다. 기존 대응표를 유지하도록 W14 번호는 보존하며, 아래 표는 주 착수 순서로 배치했다. W14-11을 엔진 선행 단계로 앞당기고 W14-12는 1차 엔진 공급 검증과 이후 기능/최종 공급 검증으로 나눈다.

| 묶음 | 우선순위·착수 의존 | 구체 산출물과 종료 기준 |
| --- | --- | --- |
| **W14-00 기준선·실제 재현** | P0·첫 작업 | §1~4의 정적 대응을 현재 설치본/Web 화면·사용자가 겪는 조작으로 확인한다. source/dist/archive/설치 identity·문제 조건·기대 결과를 고정한다. 정적 검토 완료, runtime 기준선은 OPEN. |
| **W14-01 사용을 막는 엔진·입력/창 수명** | P0·00 | E01/E04/E05의 자원 초과·기본 Windows 입력/접근성·resize/close를 재현하고 원인별 수정한다. 정상/실패 drain·epoch/세대·원인 보존, 필수 Android 현재 APK 재검증까지 연결한다. |
| **W14-02 layout·연속 scroll·State 보존** | P1·00, 필요한 01 | 기존 ListView/sliver/viewport를 기반으로 section의 lazy 생성·extent/anchor·부분 무효화·focus materialization·열 전환을 완성한다. 두 섹션 제한 해소는 자원 수명 검증 후 적용한다. |
| **W14-03 modal·overlay·focus 공통 계약** | P1·00/02의 공통 기반 | route/overlay의 canonical owner, barrier·nested/root 선택·anchor·focus/keyboard·typed result/cancel·restore/종료를 구현한다. 뒤 UI 차단과 pop/reverse 중 단일 완료를 검증한다. |
| **W14-11 runtime·렌더링·성능 선행 개선** | P1·00에서 측정, 01/02/03과 엔진 선행 수행 | E01/E06과 service/worker·cache/retirement·bitmap/image·wide-gamut/output·font/text·Core 편집/좌표·pointer/animation/physics의 공통 잔여를 먼저 해결한다. 기존 갤러리와 공개 Core 시나리오로 할당/GC·frame 비용·recording/import/cache·복구/drain을 검증한다. 이후 04~10에서는 기능 증가로 영향받은 범위와 새로 드러난 병목을 갱신한다. |
| **W14-12 플랫폼·공개 공급·배포** | **1차: 01/02/03/11 후, 컴포넌트 착수 전**. 이후 family별·최종 10/11 | 1차로 개선 엔진의 source→dist→archive→설치→최종 bundle 일치와 Windows/Android/Web 실제 입력/표시·resize/복구/종료를 확인한다. 여섯 target 공통 SDK/CLI/Metro/provider/runner/template·선택 공급·Core identity·공개 타입/JS/map·font/icon/shader/notice도 확인한다. 이후 기능별 공급을 갱신하고 최종 version/lock·signing/clean-machine·전체 물리 검증을 마친다. |
| **W14-04 Material shell·actions·messages** | P1·**엔진 선행 조건 충족 후** | Scaffold/State·AppBar/SliverAppBar/BottomAppBar·FAB·ScaffoldMessenger/SnackBar/MaterialBanner·SegmentedButton을 기능 모듈로 공급한다. C02/04/07/13/19를 같은 앱의 실제 흐름으로 연결한다. |
| **W14-05 navigation·tabs·search·앱 복원** | P1·**엔진 선행 조건 충족 후**·04, 디자인 편집은 07과 함께 | C14~19의 destination·drawer/rail·tabs·search를 구현한다. 공통 App/Router/Hero·predictive/native producer·OS link→중첩 Form/list/dialog→Back→locale→cold restoration을 같은 앱에서 검증한다. |
| **W14-06 dialog·sheet·carousel** | P1·**엔진 선행 조건 충족 후**·04 | C08/10/11의 가변 dialog/actions·modal/persistent sheet·scroll/drag·carousel/controller를 구현한다. 열린 overlay에서 resize·keyboard·route 변경·취소·owner 종료를 검증한다. |
| **W14-07 기존 controls·편집/Form·image·theme** | P1·**엔진 선행 조건 충족 후** | ready/basic family의 디자인별 비제외 API/default와 변형을 감사해 실제 누락을 수정한다. C01/03/05/06/09/12/20/21/25~29·양쪽 장식/Form·theme/typography/locale를 완성한다. Core 편집·입력·문단 수명은 선행 엔진 성과를 소비하고 새 공통 결함만 실제 owner에서 보완한다. |
| **W14-08 menus·autocomplete·date/time** | P1·**엔진 선행 조건 충족 후**·07 | C22~24·menu anchor/submenu/dropdown·Autocomplete·Search 접점, 날짜/범위·시간/타이머의 입력/선택·locale/delegate·결과/취소/복원을 구현한다. 공통 wheel·editing·overlay를 재사용한다. |
| **W14-09 Cupertino 전체 family** | P1·**엔진 선행 조건 충족 후**·07의 필요한 디자인 API | §3.1의 20개를 완성한다. segmented/context menu·sheet/refresh·sliver navigation/tabs·search/picker·Form 진입점과 기존 control을 연결한다. Material 구현 완료를 선행 조건으로 두지 않는다. |
| **W14-10 카탈로그 밖 필수 기능·갤러리 통합** | P1·**엔진 선행 조건 충족 후**·관련 family, 최종 04~09 | DataTable/PaginatedDataTable/DataTableSource·ExpansionTile/ExpansionPanel·Stepper·Cupertino expansion 등 W13 필수 복합 기능을 추가한다. page/nested/header/reorder/dismiss/sheet의 기능별 잔여와 mixed sliver/first seek·keyed selection을 통합한다. Material 29·Cupertino 20 및 추가 시나리오를 현재 제품으로 실제 조작한다. |
| **W14-13 개발 갱신·inspector** | P2·02/03/07, 12의 공급과 연결 | 실제 Widget 변경→State 유지/reassemble와 remount 경계를 구현·검증한다. source map/preview·service extension·Core Widget/RenderObject/paragraph/paint/focus/semantics·OS bridge 진단과 reload 실패/해제를 완성한다. |
| **W14-14 접근성 전체** | 입력 필수 접점은 01부터, 전체는 P2 | 설정→View/MediaData·semantics tree/ack/action/metadata·native/DOM 비시각적 proxy·reader와 owner 실패 회복을 완성한다. Apple/Linux producer 코드는 공통 요구에 포함하고 전용 실행 예외는 §0을 따른다. |
| **W14-15 명시적 native/HTML view** | P2·03/12/14 | 공개 PlatformView 계열의 합성·clip/transform/z-order·focus/input·scroll/route/overlay/reload·복구/해제를 구현한다. 기본 control의 미구현을 외부 view로 우회하지 않는다. |
| **W14-16 최종 통합·전체 완료 판정** | 00~15의 비제외 필수 조건 | 전체 API/default/locale·Core/Skia owner·개발/플랫폼·접근성/임베딩·실제 환경/공급·출처를 감사한다. 문서/임시 자원을 정리하고 §6.4에 따라 전체 완료 여부를 판정한다. |

### 5.1 엔진 우선 실행 순서

1. **W14-00 기준선**: 현재 source/설치본·재현 조건·자원 사용량·frame 비용·입력/창 수명을 확인한다. §5.2에서 검증할 문단/콘텐츠·동시 편집/View·scroll/overlay 부하의 목표 규모를 여기서 정한다.
2. **W14-01 → 02 → 03**: 문단·편집/입력·창/자원 수명과 P0 결함 → layout/lazy scroll/State/focus → modal/overlay/route 공통 계약을 개선한다. 기존 TSF/paragraph/route 구현을 재사용하고 필요한 공통 Core 편집·접근성 연결을 함께 완성한다.
3. **W14-11 엔진 공통 범위**: 렌더링·text/font/image·service/worker·allocation/GC·semantics·recording/import/cache·frame pacing을 먼저 개선한다. 측정과 원인 조사는 00부터 시작하며 수정은 01~03의 실제 의존성에 맞춰 진행한다.
4. **W14-12 1차 엔진 공급 검증 → §5.2 선행 조건 판정**: 현재 Windows/Android/Web 공급본에서 기존 갤러리의 입력·연속 탐색·resize·성능/복구/종료를 검증한다. 엔진 선행 조건을 충족하기 전에는 04~10의 컴포넌트 확장을 시작하지 않는다.
5. **W14-04/07 → 05/06/08/09 → 10**: 검증된 엔진 위에서 Material shell·기존 디자인 control·Cupertino와 복합 기능을 완성한다. 공통 기반의 재사용을 확인하고 기능 추가로 영향받은 11/12 검증을 갱신한다.
6. **W14-13/14/15 → 16**: 개발 갱신·전체 접근성·명시적 임베딩·최종 통합을 닫는다. 입력에 필수인 접근성·기본 진단/공급 접점은 엔진 선행 단계에서 이미 연결한다.

엔진 단계에서도 `sample/nelyx-testbed-app-2`의 기존 controls·Form·이미지·animation·route를 재현/측정 앱으로 사용한다. 엔진에 필요한 검증은 공개 Core 시나리오로 보완한다. 신규 디자인 컴포넌트 구현이나 샘플 전용 대체 UI를 엔진 검증의 선행 조건으로 만들지 않는다. 단일 Widget마다 전체 SDK/native build를 반복하지 않고 변경·실패·새 부하로 영향받은 검증만 갱신한다.

### 5.2 컴포넌트 착수 전 엔진 선행 조건

엔진 선행 범위는 **§3.2 E01~E07의 공통 계약과 W14-00에서 정한 현재 갤러리/공개 Core 부하**로 고정한다. 아래 조건을 현재 제품과 공급본으로 충족하면 컴포넌트 확장에 착수한다. 이 판정과 전체 제품 완료는 §6.4에서 구분한다.

| 조건 | 엔진 단계에서 확인할 결과 |
| --- | --- |
| 자원·콘텐츠 규모 | 합의한 문단/텍스트/동시 편집·View 규모에서 lazy 생성·재사용·교체/측정·retained/in-flight 수명이 성립한다. 기존 데모의 연속 탐색을 두 섹션 제한에 의존하지 않고 검증하며, 상한·초과 오류/회복·종료 회수를 확인한다. |
| layout·scroll·State | 가변 높이·first seek/anchor·열/폭/theme/scale 변경에서 값·controller·keyed State·focus/selection·offset이 정의한 정책대로 유지되고 paint/hit/clip이 일치한다. |
| Core text·편집/OS 입력 | 같은 Skia paragraph가 glyph/caret/selection/composing·hit/scroll·IME/semantics geometry를 소유한다. 공통 controller 명령·키/문자 순서·조합/취소·focus/provider/View 교체·기본 접근성 입력 연결을 현재 Windows/Android/Web 경로로 검증한다. |
| modal·overlay·focus | 공통 barrier·anchor/clip·nested/root route·뒤 UI hit/action 차단·Back/Escape/결과/취소·focus 복귀·reverse/owner 종료를 실제 Core 계약으로 확인한다. |
| 렌더링·runtime·성능 | 공통 paint/text/font/image·service/worker·cache/retirement·오류 회복과 §6.2의 선정 부하별 frame/할당/GC 목표를 충족한다. 실제 표시 증거와 callback/CPU 수치를 구분한다. |
| 창·surface·복구/종료 | resize/DPI·hidden/resume·surface/backing 교체·GPU loss에서 세대/좌표·재표시·입력이 일치한다. 정상 drain과 실패 종료/최초 원인을 구분하고 필수 미해결 P0가 없어야 한다. |
| 실제 공급 일치 | 개선 엔진의 source/dist/archive/설치/bundle·공개 타입/identity·font/icon/shader가 일치한다. 1차 Windows/Android/Web 실제 실행과 여섯 target 공통 계약/공급 구성을 확인한다. |

필수 미구현·FAIL·notVerified가 남으면 선행 검증은 **PARTIAL**이며 해당 엔진 작업을 계속한다. 신규 컴포넌트 부하에서 추가로 드러난 결함은 같은 엔진 owner로 돌아가 수정하고 영향 검증을 갱신한다. 기존 선행 검증 전체를 매번 재작성하거나 과거 검증 산출물을 누적하지 않는다.

## 6. 검증과 완료 기준

### 6.1 기능·화면·입력·수명

- **API/default:** 각 family의 비폐기 공개 API·default·theme/style 우선순위와 지원 제한을 확정한다. source/theme/enum 존재·타입검사·mapping의 `reviewed`를 기능 완료로 계산하지 않는다.
- **실제 화면:** 같은 font bytes·theme/locale·폭/높이·scale 조건을 맞춰 Doroti의 대응 Widget과 비교한다. 색/shape·간격·baseline·clip·elevation·상태/animation의 의도적 차이는 이유와 기대 결과를 남긴다. 전체 screenshot과 별도로 실제 Core paint/Skia 장면에 glyph/caret/selection/composing이 포함되는지 확인한다.
- **대표 화면 조건:** 우선 390×844·800×600·1440×1000 logical, light/dark, 대표 seed/accent, text scale 1/1.5/2, 한국어/영어와 RTL locale를 선택 조합한다. 키보드로 높이가 줄어든 화면·DPI 변경도 포함한다. 모든 조건의 무조건적인 전수 곱 대신 family의 위험에 맞는 조합을 고른다.
- **입력/모달:** pointer/touch/wheel/keyboard·Tab/방향키/Enter/Space/Escape·disabled·drag/cancel·root/nested focus·Back/outside·IME 조합/확정/취소·autofill/clipboard·readOnly/obscure·late/stale 응답을 확인한다.
- **State/복원:** 값·controlled controller/focus·keyed State·offset/anchor·selection·route/tab·Form validation 상태의 보존/초기화 정책을 정한다. category/열/폭/theme/locale·process recreation·provider/View 교체에서 정책대로 동작해야 한다. caller 자원은 caller가 해제한다.
- **오류/자원:** 실패 frame·backend loss·loader 실패·route 취소·owner 종료·reentrant callback에서도 자원이 누수되지 않고 이전 세대 좌표/action을 사용하지 않아야 한다. 전체 섹션을 왕복한 뒤 live/retained/in-flight 사용량이 소유 관계와 일치하고 종료 시 해당 owner의 자원이 회수되어야 한다.

### 6.2 성능·안정성 판정

기준 장치/빌드/renderer/Hermes 설정·viewport·동작·워밍 조건을 먼저 고정한다. 새 기능의 영향이 없는 과거 비교 수치를 최신 기준선으로 그대로 사용하지 않는다.

- JS build/layout/paint/compose/semantics·allocation/GC와 native recording/import/GPU wait/present를 구분한다. 중첩 구간을 합산하지 않는다.
- 60Hz 기준의 개발 목표는 steady-state CPU frame p95 **16.7ms 이내**, native 완료 간격 p95 **20ms 이내**, 정상 반복 조작의 **100ms 이상 긴 프레임 제거**다. 첫 로드·전환은 별도 분포로 측정하고 남은 긴 프레임의 원인을 닫는다. 이 목표 충족만으로 물리 60FPS를 선언하지 않는다.
- 물리 표시/scanout·입력 지연은 실제 표시 경로에서 확인한다. callback 완료율·rAF·오프스크린·에뮬레이터 결과를 물리 FPS로 바꾸어 기록하지 않는다.
- resize/hidden/resume/DPI/GPU loss 중 정상 경로는 최종 backing/viewport/geometry 세대 일치와 정상 input/GPU drain을 확인한다. 실패 경로는 최초 원인·복구 또는 명시적 비정상 종료를 확인하고 정상 drain과 구분한다.
- 전체 연속 갤러리·편집+overlay·animation+scroll·route 전환에서 메모리/자원 사용이 정의한 범위로 안정화되어야 한다. 상한만 높이거나 접근성을 끄는 방식은 완료 기준을 충족하지 않는다.

### 6.3 검사·공급 실행 방법

현재 존재하는 명령을 필요한 영향 범위에서 사용한다. 아래는 **재개 후 실행 목록**이며 이번 문서 작업에서 실행한 결과가 아니다.

```powershell
npm run check:types
npm run check:cli-types
npm run check:metro-types
npm run check:package-boundaries
npm run check:design-ownership
npm test --workspace @nelyx/testbed-2
```

기능 변경에는 해당 제품 회귀와 Root 통합 회귀를 선택한다. 필요할 때 `test:design-structure`, `test:design-delivery`, `test:paint-recording`, 편집/scroll 회귀를 실행한다. 영향 package build → `prepare:runner` → 해당 runner 설치/빌드 → 실제 Web/Windows/Android 흐름으로 검증한다. [앱 README](sample/nelyx-testbed-app-2/README.ko.md)의 현재 명령을 사용하며 deleted validator·옛 `resume all`·`run-check.mjs`를 복원하지 않는다.

- 모든 테스트는 **20분(1,200초) timeout**, 대체로 동일 조건 반복은 **30회 이내**다. 장시간 harness에도 프로세스 트리 종료·finally 정리를 적용한다. 제품/원본의 독립 기대값으로 검증하고 구현 코드를 복사한 기대값을 만들지 않는다.
- **대용량 build/pack/독립 설치/browser/native 전에 작업 드라이브 여유 공간 확인**. 20GB 미만이면 새 산출물을 만들지 않고 해당 실행의 임시 산출물부터 정리한다.
- source·dist·archive·설치·최종 bundle/map의 같은 본문과 identity를 대조한다. workspace alias로만 통과한 결과를 독립 소비로 기록하지 않는다. borrowed source/data/font/icon/shader의 pin/hash/license/notice도 확인한다.
- 임시 설치·browser profile·서버·에뮬레이터 연결/port·staging/이전 dist는 성공/실패/중단 시 `finally`에서 정리한다. 사용자 프로세스와 기존 서버는 보존한다. 새 receipt/checkpoint/archive·원시 profile/로그를 누적하지 않는다.

### 6.4 상태와 완료 범위

| 판정 | 필수 조건 |
| --- | --- |
| 묶음 검증 완료 | 해당 API/default·Core/Skia 상태/layout/paint/hit·입력·오류/복원/종료·공개 타입·출처/소유권·필요 실제 환경/공급을 충족한다. 데모의 ready/basic/planned와 별도로 판정한다. |
| 엔진 선행 검증 완료 | W14-01/02/03/11의 공통 범위와 12의 1차 공급 검증이 §5.2를 충족한다. 이후 04~10의 컴포넌트 확장을 시작하며 신규 부하의 영향 회귀를 계속한다. 이 판정은 디자인 family·최종 성능/공급·전체 제품 완료를 대신하지 않는다. |
| 갤러리 기능 완료 | C01~C29·Cupertino 20개와 추가 필수 시나리오를 공개 API로 조작하고 §6.1의 화면·입력·State/자원을 확인한다. 연속 탐색을 임의의 두 섹션 제한으로 유지하지 않는다. 이 판정만으로 전체 제품 완료가 되지는 않는다. |
| 우선 범위 완료 | W13 R0~R6·01~08을 승계한 W14-00~12의 해당 필수 조건을 충족하고 입력에 필요한 접근성도 연결한다. **우선 범위 완료 / 전체 PARTIAL**로 기록하며 13~15 잔여를 유지한다. |
| 전체 완료 | W14-00~15의 비제외 필수 요구를 16에서 현재 source/공급/실제 환경으로 확인한다. 필수 미구현·미해결 FAIL·필수 notVerified가 없어야 한다. §0의 기존 전용 native SKIPPED/provider notVerified 예외는 별도로 명시한다. |

`PASS / PARTIAL / FAIL / SKIPPED / notVerified`를 구분한다. 기술 결과는 `검증 완료`·`완료 기준 충족`으로 표현한다. visible editor/native control이 기본 UI를 대신 그리는 경로·검증되지 않은 간소화·필수 API/플랫폼 공백이 있으면 전체 **PARTIAL**을 유지한다.

<a id="7-현재-상태와-다음-재개"></a>

## 7. 이전 Windows 스크롤 검증과 중간 마무리

**이전 중간 마무리 기록 — 아래 PAUSED는 §8의 사용자 재개 요청으로 해제됨.**

**Windows V8 연속 스크롤 후속 (2026-10-21).** 사용자가 위젯 로딩 후에도 트랙패드에서 간헐적 프레임 하락을 확인해 재조사했다. 이번 시작 HEAD는 `00c94abe`, dirty 없음이었다. 현재 수정은 미커밋이며 사용자 요청으로 구현 실행을 **PAUSED**한다. **계획 ACTIVE / 제품 PARTIAL / wholePlanComplete=false**. 엔진 선행 단계도 PARTIAL이며 신규 디자인 family 확장은 보류한다. 명시적 재개 요청 전 추가 최적화/검증을 진행하지 않는다.

**현재 제품 수정**

- Windows semantics tree는 store를 한 번 구독하고 standalone node는 자체 구독을 유지한다. 24개 node의 트리에서 중복 구독 **25 → 1**을 재현·검증했다. 최신 bounds/commit/action과 unsubscribe를 보존한다.
- native backpressure에서는 GPU와 겹쳐 준비하는 CPU scene을 한 개 유지하며, 거절될 scene을 매 tick 다시 build하지 않는다. native의 retained front recording까지 capacity에 포함한다. submit/lease가 최종 수락·수명 authority이며 hint로 소유권을 반환하지 않는다. 입력 geometry용 forced build는 최신 상태를 읽도록 병합을 우회한다. resize·hide/resume의 stale scene 폐기·close·잘못된 retirement 실패를 보존한다.
- 일반 박스의 동일 offset/기본 local transform, 소유한 불변 affine의 paint inverse/마지막 합성을 재사용한다. offset·가상 getter는 매번 읽으며 변경 가능한 외부 배열, signed zero, 비유한 산술과 overflow 경로를 유지한다. 좌표 캐시는 노드/행렬당 제한된 최근 값이며 전체 입력의 hit-test를 생략하지 않는다.
- RN native paragraph builder는 같은 TypefaceFontProvider의 FontCollection을 최대 16개 builder까지 공유해 font matching을 재사용한다. text-shape cache는 끄고 16개 뒤 collection을 교체한다. registerFont는 캐시를 무효화하고 dispose는 참조를 해제한다. 기존 builder/paragraph 수명과 잘못된 provider의 엄격한 거절을 보존한다. TS 공개 API는 바꾸지 않으며 변경된 native binding을 새 source hash로 공급했다.
- 앞선 W14의 viewport 소비자 갱신·layout 무효화 합치기·편집 geometry 가지 추적·reconciliation·행렬 캡처·250px section cache·compositor clock·GPU scratch cache·불변 Paint/semantics 재사용과 V8 기본값을 보존한다.

**검증과 측정 범위**

- 8개 workspace `check:types` PASS. 좌표/scene/paint/semantics/갤러리 선정 **95개**, 최종 forced geometry 포함 행렬/좌표/backpressure **18개**, paragraph lifetime/좌표/semantics tree 선정 **23개** PASS(서로 겹치는 선정은 합산하지 않음). CPU 갤러리 최고 paragraph producer **106 / resident 127**로 기존 128/256 목표 안이다.
- 최신 공급본의 native V8 갤러리: Material **29**·Cupertino **20**개 mount, native 편집 text/selection ACK, 디자인 왕복의 controller 보존, **6회 resize**, hide/show·minimize/restore, GPU/input 정상 drain **exit0**, 의도적 실패 종료 **exit2 / owners retained** PASS. fixture project/entry/config는 finally 정리했다.
- native FontCollection 회귀는 font 등록 전후, 400/700 weight·wght variation을 포함한 **17회 builder/collection 교체**, 잘못된 provider 거절, dispose 후 거절과 기존 builder의 유효성을 fresh provider의 실제 metrics와 비교해 PASS했다.
- 입력 fixture는 요청 간격과 실제 전송 간격을 구분한다. 작은 간격에는 high-resolution waitable timer를 사용하며 실제 간격을 기록한다. OS wheel 메시지는 합쳐질 수 있어 누적 거리를 검사하고, owned queue는 개수도 검사한다. warmup의 카운터 범위 누락·초기 scroll extent 준비 대기·10번째 반복 후 불필요한 대기도 수정했다.
- **로딩 없는 상태를 별도 재현했다.** Ryzen 7 8845HS/780M, Release V8·비압축 JS·50ms semantics·source alias OFF. 같은 48px 범위를 먼저 왕복한 뒤 **±1 × 480개 / 총 192 logical pixel**, 요청 **4ms**(실제 전송 p50 약 **4.38~4.51ms**, p95 **4.57~4.66ms**)로 반복했다. 두 viewport 모두 Element mount/unmount **0/0**을 검사했다. Core viewport 중앙의 hover device를 하나로 통제하고 종료까지 확인했다(OS cursor는 이동하지 않음). CPU 최소 측정 + native trace, JS diagnostic/Core trace OFF. 아래 CPU는 build가 발생한 callback 전체 시간이며 native 완료 간격은 scanout/FPS가 아니다.

| 최종 로딩 없는 스크롤 (logical / physical, DPI2) | CPU p50 / p95 / max (ms) | Native 완료 간격 p50 / p95 (ms) |
|---|---:|---:|
| 기본 창 487×464.5 / 974×929 | 3.56 / **6.29** / 15.91 | 6.07 / **8.78** |
| 최대화 1280×729.5 / 2560×1459 | 4.50 / **8.68** / 19.24 | 12.10 / **14.87** |

이 선정 조건의 p95는 §6.2의 60Hz 개발 목표 안이지만 primary display의 **165Hz(약 6.06ms)** 예산은 계속 충족하지 못한다. 전원 상태·사용자의 외부 프로세스·창 가림은 통제하지 않았다. 과거 hover가 달랐던 수치나 diagnostic 결과와 혼합해 개선율을 계산하지 않는다. 완전한 부드러움/물리 trackpad 수락으로 확대하지 않는다.

**미해결:** 큰 범위 고속 왕복(±24 × 480개 / 총 4608 logical pixel, warmup 포함)은 이전 방문 영역도 lazy 정책상 다시 mount한다. 최신 font 재사용 후에도 기본 창 CPU p95 **23.81ms / max157.71ms**, 최대화 p95 **53.74ms / max152.46ms**로 남았다(Core trace ON, OS hover 비통제인 별도 부하). 최대화 diagnostic의 긴 프레임은 mount615/unmount594·paragraph42개·layout **102.47ms**를 포함했다. native Core trace에서 import p95 약 **1.87ms**, present p95 약 **5.28ms**였던 별도 기본 창 표본은 CPU 긴 프레임과 GPU wait를 구분하는 근거이며 모든 창의 보편 비용은 아니다. section 재생성/layout을 줄이는 후속 작업이 필요하다. **100ms 이상 정상 반복 긴 프레임 제거 조건은 미충족**이다.

**공급·공개 실행**

최종 5개 JS 모듈(Core runtime/render object/geometry, Windows semantics, RN renderer)의 source/dist/declaration/map **25개 파일**과 native header **3개**, 합계 **28개**의 archive/설치 byte 일치 및 최종 bundle map 내용을 확인했다. native Release 재빌드 **17/17** PASS. 공급본은 **1,795개 파일 / 224,432,619 bytes / 18 libraries**, native inputs `ffe30357bd5b4aa311137a1429b35f59212f60265f6ee93b1830ff9bb2c0f99e`로 app locator와 global current를 갱신·검증했다.

최종 공개 V8 Release **1,776개 파일 / 367,274,002 bytes**, EXE `dc566ec545bc1cda4d0b3814afb5b8c3fbc4fae637ef449b435992d4ccfc7054`, bundle `2fbe7e966d0000de7d7405891db1564e77b2bfd3d58fda5bf89c9dff4d60f019`, map `5a3b4a40062e6543baa018bae85977b436e3dececc8dbbd805f7e1c9f1dd2eb4` inventory PASS. Core archive `2ffd17bb9c70b7f2ebcdad8759bb40b1e7d92e5a5cc1ebbaa02e57d3592ece38`, SDK `285b76dd32b8db5fe64211266044adbe11afd3f5f3389fbc3466f322b68b066f`, Skia RN `5bfa392c6452548df7afd0233778a85eae1c271c4872a6e8771a6dcd926e838d`다. 일반 `npm run run:windows --workspace @nelyx/testbed-2`로 **PID43684 / NelyxTestbed2 / Responding=True**, 해당 package의 Microsoft.ReactNative.dll·v8jsi.dll 로드와 협력적 close **exit0**을 확인했다. 검증 창은 닫았다. `run:windows`는 이 마지막 build 결과를 실행한다. 최신 Web/Android 전체 실제 재공급·물리 precision trackpad/IME 후보창/reader·scanout은 notVerified다.

**남은 작업**

1. 큰 범위 고속 왕복의 section 재생성/layout 비용 감소와 165Hz 부하의 hover/input/frame 비용 추가 개선. 이미 로딩된 상태와 lazy 재생성 비용을 함께 평균내지 않는다. 다시 시작할 때 현재 diff/공급 hash를 비교한다. 선정 fixture는 `NELYX_ANIMATION_ENGINE=v8`, `VIEWPORT=both`, `WHEEL_INPUT=queued`, `WHEEL_INTERVAL_MS=4`, `WHEEL_DELTA=1`, `WHEEL_WARMUP=1`, `OWNED_HOVER=1`, `MODE=cpu-timing`, `NATIVE_TRACE=1`(모두 `NELYX_ANIMATION_` 접두어), `TRACE/DIAGNOSTIC/NATIVE_CORE_TRACE=0`으로 고정하고 `node --test --test-timeout=1200000 Nelyx/eng/tests/windows-animation.test.mjs`를 실행했다. ±24 부하는 별도 기록한다.
2. 실제 OS/precision trackpad 및 scanout, 최신 Web/Android 수락과 §5.2의 나머지 엔진 조건. 이후 W14-04~10/13을 진행하고 14~16 잔여를 유지한다.

정리: 새 fixture의 임시 project/entry/config는 finally로 삭제했다. 작업 소유 native/test/build 프로세스와 검증 창은 종료됐다. 현재 dist/archive/설치/public package와 native `ffe30357…`는 실행에 필요한 최종 공급본으로 유지한다. 교체 전 app native `348731…` cache는 아직 남아 있다. 과거 자동 승인 검토가 `blocked by policy`(추가 사유 없음)로 거부한 native 공급/Android 임시 파일/paint-cost 출력은 재시도하거나 우회하지 않는다. 이번에도 과거 중단 fixture `nelyx-animation-32204.tsx`, `nelyx-animation-main-32204.tsx`, `%TEMP%/nelyx-windows-animation-lZr0JK` 정리가 같은 이유로 거부돼 남아 있다. 중간 마무리의 `.tmp/w14-jank-native-build` 및 `.tmp/w14-jank-*.log` 정리도 실행 전에 같은 사유로 거부됐다. 이 거부된 삭제를 재시도하거나 다른 도구로 우회하지 않는다.

## 8. research 엔진 개편

**공개 실행 갱신 전 후속 후보:** Core의 정상 size/layout/build·parent-data 경로에서 오류 설명 문자열을 만들지 않고 실패 시에만 같은 설명을 생성하도록 변경했다. 검증 조건은 유지하며 관련18개와 Core build/타입 PASS다. Coree114c3b7…/RNa7ed2015…의 source→archive→설치207/177/207개와 gallery23개(profile1 SKIP) PASS이며 실제 기본/최대화 native PASS203.45초다. warm p95는6.44/10.08ms, input p95는12.21/17.43ms, 재방문 max는84.07/118.51ms여서100ms 수락은 남았다. 단일 전후 측정으로 일관된 전체 성능 개선을 선언하지 않는다. 아래 공개 공급·실행·수치는 변경 전 Core782ad6f0…/RNa7ed2015…의 선정 기준본이다.

2026-10-21 사용자의 `/goal research.md 대로 전체 개편 작업해줘`로 §7의 PAUSED를 해제했고, **2026-10-22 “일단 중간마무리하자” 요청으로 다시 PAUSED / PARTIAL / wholePlanComplete=false**다. 시작 HEAD `8d05c221`, dirty 없음이었고 현재 수정은 미커밋으로 보존한다. 범위는 research §6의0~6이며 W14 디자인 family 확장은 시작하지 않았다.

**중간 마무리와 재개 지점:** 현재 소스·dist·archive·설치의 Core는 후보 `e114c3b7dc485378c25ba48b18a6423e264bdffcbbf1fb706067cb1135d38a55`다. 정상 경로의 진단 문자열 지연 생성 변경과 `Nelyx/eng/tests/layout-diagnostics.test.mjs`를 보존한다. 공개 Windows/Web/Android 출력과 아래 실행 증거는 Core782 기준이며 후보로 재빌드하지 않았다. 재개 시 이 공급 차이를 먼저 확인하고, 후보를 선정하면 공개 출력·source map·실행을 함께 갱신한다. 최대화 재방문118.51ms와 고주사율 예산은 여전히 미충족이다. 작업 소유 검증 창·InputSurface/NelyxRNHost·emulator는 종료됐고 추가 구현·검증은 멈췄다. 새 checkpoint/history 파일은 만들지 않는다.

**현재 구현**

- 목록 전용 공통 Material/clip으로 selected·hover·splash의 실제 paint owner를 목록 사각형으로 한정한다. 제목 recording을 유지하며 수정 전 제목4회 repaint FAIL→수정 후0회 PASS와 실제 Windows selected/title/footer 픽셀을 확인했다.
- Windows QPC 시각·순서·precision pan/zoom·관성 취소·OS wheel 설정을 source pointer에 전달한다. 실제 HWND/clip의 DirectManipulation과 중복 wheel 억제·fallback,256-entry mailbox의 contact/key/focus/metrics 경계를 유지한다. compositor/JS clock 보정과 immutable owner/viewport/surface/context/frame/input/submission identity를 surface terminal까지 연결한다.
- GPU worker가 Vulkan producer/D3D consumer fence CPU 대기를 맡고 UI는 prepare/publish를 소유한다. GpuContext mutex 밖에서 기다리고 lock 안에서 Graphite wrapper를 회수한다. visual supersede 후에도 제출 upload/recording은 실행·회수한다. texture1개·CPU 준비1개·native recording2개와4096px/64MiB 상한을 유지한다. 적체 중 CPU frame은 한 개만 준비하고, credit 복귀 때 최신 dirty scene으로 교체한다. 교체 capture가 성공할 때까지 옛 caller lease를 유지하며 이미 제출한 native 의존성은 버리지 않는다.
- preparing 중 첫 frame을 허용하고 matching surface 갱신 뒤 show gate를 연다.30초 deadline·시작 Close·bundle 실패를 분리한다. WM_SIZE의 RNW Arrange와 active epoch1개/최신 pending1개로 실제 sizing loop 중 re-layout한다. old-front 확대는 continuity이고 다른 epoch의 pointer/IME/semantics geometry는 unavailable이다. 편집 문서·키보드 수명은 유지한다.
- 문단별 전체 entries 재합산을 없애고 logical producer/resident/UTF-16/직렬화 비용을 증감·실제 retirement ACK에서 계산한다. View별128-key live index에 별도 cache owner lease를 더했다. cache는64개/64Ki UTF-16 units/직렬화 input+key1MiB의 FIFO이며 동결된 data snapshot만 보관한다. transient 측정·Paint 의존·callback/symbol/opaque 확장은 제외하고 font catalog 변경/reentry를 fence한다. resident 압박 시 idle owner만 회수한 뒤 같은 admission 비용으로 재확인한다. cache residency가 released logical producer의 query 권한을 되살리지 않는다.
- Overlay는 onstage만 layout/paint/hit/semantics에 참여시키며 covered State/controller와 isolated build scope·GlobalKey 이동·suppressed layout queue를 유지한다. detach 및 owner-chain 중복을 줄이고 실제 build revision으로50ms semantics interval을 지킨다. label/action/input geometry/metrics는 즉시 갱신한다. TextStyle/typography의 소유 snapshot과 MediaQuery aspect·ListTile 내부 SafeArea projection, locale script category 조회를 재사용하며 mutable Paint·Proxy/private getter·custom scaler·scope·static-of 교체는 유지한다.
- Windows V8 Metro는 RN0.83.10의 Flow/JSX/modules·Babel env/overrides·개발 refresh를 유지하며 native ES2022 class/field/private 등을 사용한다. compiler ACK/package 정책은 `nelyx.v8-native-es2022-rn0.83.10/v2`다. Hermes와 RN import 기본값은 유지한다.
- RN replay는 효과 없는 완전 투명 srcOver 도형만 생략한다. captured command·frame admission·resource lookup/lease는 유지하며 layer/image/effect·다른 blend는 실행한다. 새 native Paint의 평범한 fill은 constructor 기본값을 사용하고 색만 설정한다. 일반 scalar 재설정 함수와 효과 생성·실패/retirement 경로는 유지한다.

**현재 회귀**

전체8개 workspace 타입, cache/budget/backpressure/native replay 선정29개, gallery23개(profile1 SKIP) PASS다. CanvasKit continuous Material 부하에서107 producers/115 paragraphs를 유지하고 route/전체 close 후 회수한다. 앞선 paragraph lifetime·editing/semantics·GlobalKey/metrics/MediaQuery·Material/typography 및 native clock/precision·package/design ownership 회귀도 통과했다. package boundary942개 파일/505 facades와 design ownership56 moved/8 adopted/11 managed owner도 PASS다. ListTileSafeArea의 현재 handwritten helper hash/policy만 관리 manifest에 반영하고 historical base/fingerprint·generator API 입력은 보존했다. 서로 겹치는 선정을 합산하지 않으며 물리 입력·표시 증거로 확대하지 않는다.

**현재 native 최소 계측**

Core782ad6f0…/SkiaRNa7ed2015…/Materialc15477d9… 실제 설치본의 기본·최대화 묶음 PASS207.39초다. Release V8·source alias/compiler override/diagnostic/Core trace OFF·numeric native trace ON·semantics50ms다. 기본487×464.5 logical/974×929 physical, 최대화1280×729.5/2560×1459, DPI2다. OS wheel240개/4ms·10회 반왕복에서 이미 생성된 행만 움직이며 mount/unmount0/0이다. 전원·다른 프로세스·OS file cache는 통제하지 않았다. Frame.cpu는 callback의 performance.now 경과 시간으로 JS↔native 호출/대기를 포함하며 OS thread CPU와 같지 않다.

| 범위 | 기본 창 | 최대화 창 |
|---|---:|---:|
| warm CPU p50/p95/max(ms) | n185:4.37/**6.62**/16.90 | n164:5.47/**9.18**/13.35 |
| latest input→surface p95/p99/max(ms) | n171:**13.39**/16.99/22.44 | n112:**17.30**/20.02/20.87 |
| cold 목록/먼 위치 CPU max(ms) |116.38/107.62 |134.57/134.28 |
| 먼 재방문8회 CPU p95/max(ms) | n24:82.72/**83.95** | n24:114.23/**119.17** |
| 재방문 mount/unmount |6512/6512 |8288/8288 |
| cache-only paragraph hit/전체 hit/miss |100/350/2 |125/447/1 |
| resize CPU p95/max(ms) | n73:39.56/45.93 | n73:40.36/46.51 |
| drag24회/35ms의 중간 surface epoch |23개 |21개 |
| resize request→surface p95/max(ms) | n26:75.54/80.26 | n23:78.74/79.77 |

warm CPU와 native 수신→surface 제안의 p95/p99는60Hz 예산 안이다.120Hz에서는 기본 창만 충족하며165Hz는 두 창 모두 충족하지 않는다. 정상 반복100ms 이상 제거도 최대화에서 미충족이다. 주 display mode는 읽기 전용 EnumDisplaySettingsW에서2560×1600·명목165Hz를 확인했으며 실제 scanout FPS가 아니다. input 집계는 warm 시작 뒤 받은 입력의 첫 matching surface만 세고 이전 입력의 늦은 완료를 제외했다(제외0/0). resize trace는 드래그 중 ring을 drain하며 fixture numeric buffer4096개 상한과 matching latency 필수 검사를 사용한다. 과거 표본이 없는 resize 회차를 수락으로 사용하지 않는다.

selected/title/footer 픽셀, OS cursor/sizing loop·UI probe·epoch/terminal, 정상 `views=0 consumers=0 gpuDrained=1 inputRetired=1 / exit0` PASS다. 의도한 presentation/bundle 실패 exit2·시작 Close exit0는 정상 drain과 구분한다. first-content 이전 visibleBefore=0을 확인했다. 빈 RN root의30초 deadline은 동일 native/SDK의 별도32.04초/exit2·owner 보존 증거다. process-entry→matching surface는3.517/1.835초, show는3.527/1.844초였고 UI probe는0.289/0.204ms였다. OS cold/이전 제품 전체 비교/physical FPS 증거가 아니다.

**공개 선정 기준본의 공급과 검증**

native inputs1795개/224976281bytes/18 libraries, SHA-256 `cf218f5831ffa57be820cbada5f32d99c6612c3ee62f21a0c63e032039ca8efd`. Core `782ad6f0488a65c36c039e41059cf6976f81e66ff379de5032ec9f7096e797d6`, Skia RN `a7ed2015b99eb222efa9ac47e95517142952d6bec63f6c337dbbfbfa5aa19ade`, Skia Web `1da0b3f2cd988fac8524b861df5c674c1e8628e71825acbc8967f5e0f7bc6ad4`, Material `c15477d990376f84f97a584434cca70d6324c778dc10d0e52987a38c6013c808`다. Metro4d5de65f…/CLI7fb4da47…는 유지했다. source/dist/d.ts/maps/export·변경 native/template·생성 Vulkan source→archive→설치207/177/207개 PASS다. 변경 package만 pack하고 임시 참조는 finally로 삭제한다.

Windows V8/Web 공개 빌드 PASS101.76/28.30초(병렬 build이며 성능 비교 아님), Android x86_64 Release 공개 빌드도 PASS259.91초다(Temurin21·119 tasks,51 executed/68 up-to-date). Windows inventory1750개/361680773bytes, manifest `ed04aa70c666a8b12cdced4d5f72cd107a16d829d094ac32289e966eeef8d38f`, EXE `74b3396f7eabc7c60ea668b9f11f036ec5f478877a80a14d40c52e07a6564c87`, bundle `d657d17dba12d474351d261b9ad04b1a64c931a605fb8c90603327c8d572b2c6`, map `4378b818438bd993c228a4ec2d78cc5a7056e8523f90b479bf4ce11f00205052`다. v2 compiler ACK/package와 Core4개 native class 보존 PASS다.

Web bundle `8f565cc733f42a76db8206abc0f63cdb4e41134ee2004f417f58210d3a88ca9b`, map `ace1965c0da7c2d17efdba05520f9e633186e3b85af1a1884bed9db43c03cdc3`다. Chrome EditContext/moveBefore·fallback·DOM3경로에서 목록 pointer/wheel/처음·끝/resize A→B→A/back 후 편집 PASS89.21초다. 임시 profile/서버는 finally로 정리했다. Web notice/sourceRebuild의 PARTIAL/notVerified는 유지한다.

공개 기준본 source map의 모듈 본문 Windows29/Web22/Android27개가 Core782 기준과 일치한다. Windows의 source/dist renderer와 SDK lifecycle·Core frame을 함께 대조했다. Android APK `b79343bfe7e26a02cdf8b1a8c98712fd75c6e39b1e091d84d5b976802e2f2ac2`, HBC96 `38df2e68e33a62012b6bc13e4b125f782564aba229b400d6a188be0a40b4b989`, map `09610f710a5339755d64330330af84dcf1ac642215423de8b4031f31f8f6b644`다. native Skia14554856bytes/SHA240fcb50…는 유지됐다. production signing/physical device는 notVerified다. Android는 읽기 전용 Pixel_5/API33/x86_64/Vulkan emulator-5580의 동일 Release PID3407에서 목록 선택/footer·scroll·처음/끝·회전 A→B→A·back 후 native EditText focus/입력·keyboard resize/dismiss·문서 유지와 logcat PASS다. 소유 VM/XML은 정리했다. Windows GPU caret·TSF/UIA/privacy·OS key/Unicode·resize NOLAYOUT/document·정상 GPU/input drain PASS172.86초다. 별도 editing-resize도 같은 공급에서 PASS212.35초다. maximize/restore·OS Tab/ShiftTab·theme/Undo·hide/show·minimize/restore·hidden GPU 중단과 문서/selection·focus 유지, 정상 GPU/input drain을 확인했다. 공개 CLI PID29044/NelyxTestbed2/Responding=True와 현재 package의 RN/V8 DLL 경로를 확인했다. 협력적 Close/CLI exit0와 실행 후 inventory 불변도 PASS이며 검증 창을 닫았다.

**진단과 잔여**

공개 기준본 Core782/RNa7ed의3구간 V8 sampling/PDB 진단 PASS194.18초는 warm634/재방문611/resize585 ticks, JS leaf90/91/90이다. nearest-JS source는 warm RenderObject72·RN replay59·frame45, 재방문 RenderObject153·Element74·semantics pipeline30, resize Element66·RenderObject59·RN replay46 samples다. native 아래를 포함한 nearest-JS와 JS self를 구분하며 constructor/VM builtins·ntdll을 임의 CPU/wait 시간으로 바꾸지 않는다. DLL SHA106b7a59…·PDB GUID4198a213-96a1-ef01-4c4c-44205044422e/age1/image33824768bytes를 대조했다. GC는 warm5회23.7ms/max5.2, 재방문3회21.4ms/max7.4, resize4회33.9ms/max12.8이고 process peak880332800bytes다. 별도 profile 조건의 GC/전체 process 관측이며 최소 CPU·VM 최고 heap/GPU 분해·scanout 수락이 아니다. raw log/map/RVA는 해독 뒤 finally로 버렸다. 공개 공급의 임시 project/entry/config·browser profile·emulator/XML과 검증 창도 정리했다.

1. 큰 창의 정상 반복 재방문은 공개 기준본119.17ms, 후속 후보118.51ms로100ms 미만 수락이 남았다. 후보의 진단 문자열 지연 생성은 위 회귀·native 검증까지 마쳤으며 단일 측정으로 일관된 성능 개선을 주장하지 않는다. 별도 Node/CanvasKit4회 seek 진단에서 layoutMutationAllowed는21405회/parent129787회, 계측 합10.91ms이며 먼 frame당 약1.3ms였다. 이 경로를 주원인으로 보고 복잡한 ancestry cache를 도입하지 않는다. 후보의 별도 Node CPU profile은 inspector overhead를 제외하면 freezeRunStyle·visitAncestorElements·freezePaintCommand·validateChild 등을 후속 조사점으로 보였다. Windows native CPU와 동일한 증거로 읽지 않는다. 재개 후 실제 비용을 확인하며 mount/build/layout·scene/semantics·native replay를 분리하고 접근성을 유지한다. warm은 layout 요청0이므로 문단 cache를 전체 비용 원인으로 단정하지 않는다.1000행 keepAlive/무제한 native cache는 사용하지 않는다.
2. 실제 precision trackpad·IME 후보창/reader·monitor DPI 이동·물리 scanout, startup OS cache cold/이전 제품 비교, VM 최고 heap/GPU 분해와 더 넓은 resize+input/loss/refresh 수락은 notVerified다. research §7 요구/증거를 대조하기 전 goal을 완료로 표시하지 않는다.

미선정 native 이름 cache·TextStyle copy/recolor·ListTile 스타일 cache·semantics 초기 할당/flag/retained child 검증 후보는 원복했다. getter/Proxy/private receiver/오류 순서·불변값/재진입·typed flag/cycle 회귀는 보존했다. 과거 후보 수치와 현재 공급을 혼합하지 않는다.

정리 제한: 과거 자동 승인 검토가 `.tmp/research-native`, app native cache `eef84c930fb0badc307a023e3d3e065460f34b5b12502e377e458b54c4b05aec`·`268846eaaf0b6d68fcfa2fdfab40773a3ff8c81ba6291a7222d282b28a95d54a` 삭제를 실행 전에 `blocked by policy`(추가 사유 없음)로 거부했다. §7의 거부 경로와 함께 재시도/우회하지 않는다. 공개 run의 임시 log/강제 종료/정리를 묶은 명령도 실행 전에 같은 이유로 거부돼 임시 폴더가 생성되지 않았으며, 삭제/강제 종료 없는 foreground CLI·협력적 Close로 검증했다. 새 fixture의 project/entry/config와 raw profile은 실행별 finally로 정리한다.

## 9. Windows Static Hermes 실험

2026-10-22 사용자의 “진행해줘” 범위인 **AOT 실험 경로 구현·1차 비교 완료 / 제품 PARTIAL / 기본 전환 보류**. 시작 HEAD `903ac8af`, dirty 없음, C: 여유 약177GiB. §8의 나머지 개편·디자인 확장은 재개하지 않는다. 현재 Core 후보e114·SkiaRNa7ed·native inputs cf218을 사용하며 §8의 옛 Core782 수치와 혼합하지 않는다.

**구현:** 기존 Hermes1.0.0/HBC99의 Microsoft exact source `94aa5e1d40a4ce99df79d951cbe45310ec40680c`에서 shermes와 같은 VM을 빌드한다. 전체 비압축 Metro JS→untyped C→clang22 `-O3`→`NelyxApp.aot.dll`이며 기존 no-CFG/no-inline 정책을 유지한다. RNW의 Node-API adapter 때문에 runtime의 native script loader에 exact entry marker 진입점을 추가했다. interpreter 안에서 직접 SHUnit을 재진입하면 VM 상태가 깨져 이를 거절하며, root native admission으로만 실행한다. 프로세스당 앱1회·native image exit까지 pin·Windows x64 Release 한정이다. typed·Debug·refresh·기본 V8 변경은 포함하지 않는다. 일반 엔진으로 복귀할 때 원본 Hermes DLL을 명시적으로 복구한다.

**공급·기초 검증:** source archive SHA `24582814145b28d2abced182d217e1b55564c8cfe9639d962973c1078b312806`, runtime `635a4d8a92aafa973825d30a981e1c20985e8c7d70bf320f7705ccb9614581a0`, toolchain `8be05e4e140db77bf25d3b12cd797c75e9cff6e2f77748510115423bd82906a4`다. 재사용 toolchain은 `Nelyx/.cache/native/windows-static-hermes`이고 app locator가 이를 가리킨다. 재준비 때 이 cache를 재사용하며 별도 app-local toolchain이 생기지 않는 것도 확인했다. CLI archive `082d2b3e…`·SDK `a4348be3…`의 변경11개 파일 source→archive→설치 byte 일치, runner/template은 줄바꿈 정규화 후 일치다. CLI 타입·package boundary PASS. admission/GC·closure·getter·microtask·native callback·interpreter/반복 root 진입 거절·누락 DLL·패키지 수명·기존 Hermes/V8 계약 **22/22 PASS**다.

공개 AOT package **1749개 파일 / 417761943bytes**, input용 portable map1376 modules/sources PASS다. manifest `9e24b307…`, EXE `6309ac99…`, unit `184212e5…`/**59150336bytes(56.4MiB)**, input JS `e4dfc7a4…`다. 최종 설치 CLI의 `run:windows`에서 **PID9264 / NelyxTestbed2 / Responding=True**, 해당 package의 RNW·Hermes·AOT DLL 실제 로드와 협력적 close **CLI exit0**을 확인했다. 검증 창은 닫았다. 마지막 공개 출력은 AOT이며 일반 `build:windows`의 기본 선택은 V8다.

**입력 수락 PARTIAL:** AOT에서 실제 GPU caret/pixel·TSF/UIA·OS 키/Unicode·privacy·resize 문서 검사는2회 통과했다. 정상 GPU/input drain은1회 관측했으나 최종 suite는 close 중 `Windows native GPU owner/phase failed admission` / **exit2, gpuDrained=0, ownersRetainedUntilProcessExit=1**로 실패했다. 이를 정상 drain으로 수락하거나 검사 조건을 완화하지 않는다. AOT만의 문제인지 기존 비동기 종료 경계인지 원인 분리는 남았다. 별도 AOT research fixture는 정상 drain/exit0 및 의도한 presentation·bundle 실패/시작 Close 경계를 통과했다.

**같은 부하의 1차 비교:** Ryzen7 8845HS/780M, Release, 기본487×464.5 logical/974×929 physical(DPI2), semantics50ms, source alias/JS diagnostic/Core trace OFF·numeric native trace ON이다. 각 경로1회이며 실행 구간에 다른 빌드/검증 창은 없었다. Hermes 두 경로는 같은 위 runtime(HV64/Hades/JIT OFF)·RN Babel 변환·비압축 입력·최적화 정책을 사용했다. 바이트코드 컴파일러도 같은94aa pin이다. V8은 기존 native ES2022 변환을 유지하므로 엔진과 번들 경로의 비교이며 순수 compiler 효과는 Hermes 두 경로에서만 비교한다. 입력은 OS wheel240개/요청4ms(실제 p50 약4.52~4.54ms·p95 약4.86~4.89ms)다. warm mount/unmount0/0, 재방문6512/6512는 모두 같다.

| 현재 공급의 기본 창 | warm callback p50/p95/max(ms) | 재방문 callback p95/max(ms) | 입력 수신→surface p95(ms) | process peak working set(MiB) |
|---|---:|---:|---:|---:|
| Hermes bytecode, 같은 custom VM | n77:12.92/18.07/24.04 | n24:256.22/256.93 | n72:23.72 |314.3|
| Static Hermes untyped AOT | n87:11.22/17.05/24.81 | n24:247.00/254.50 | n83:23.42 |331.5|
| V8, native ES2022 | n176:4.87/7.48/11.72 | n40:79.28/89.77 | n171:13.58 |526.3|

resize callback p95는 bytecode/AOT/V8 **147.22/155.59/40.17ms**, matching resize request→surface p95는 n10/n10/n24 **184.57/295.28/76.00ms**였다. 세 research 실행 모두 정상 close와 예상 실패 경계 PASS다. 전체 test 시간은 AOT730.81s/bytecode206.80s/V8172.30s이며 초기 toolchain 빌드는 제외하고 native fixture 빌드·검증을 포함한다. callback 시간은 JS↔native 호출/대기를 포함하는 wall time이고 OS thread CPU·scanout FPS가 아니다. process peak는 JS heap만의 크기가 아니다. 전원·외부 프로세스·OS cache는 통제하지 않았으며 단일 표본의 차이를 일관된 개선율로 일반화하지 않는다.

**판정·잔여:** 이 미타입 AOT 표본의 warm 개선은 작고 재방문 긴 프레임과 V8 차이는 해소되지 않았다. native unit56.4MiB·긴 빌드·입력 종료 실패까지 고려해 기본 V8 빌드를 유지한다. typed 전환/최신 upstream 교체는 수행하지 않았다. 다음 범위는 GPU 종료 실패의 실제 phase/owner 원인 분리, 큰 창과 반복 표본·physical input/scanout 수락이며 완료로 표시하지 않는다. §8의 나머지 개편은 계속 PAUSED/PARTIAL이다.

현재 AOT 패키지는 `npm.cmd run run:windows --workspace "@nelyx/testbed-2"`로 바로 실행한다. 재빌드는 `start:windows:static-hermes`, 기존 V8 빌드·실행은 `start:windows:v8`이다. 새 fixture project/entry/config와 C/obj/lib/exp·현재 검증 log는 정리했다. 재사용 toolchain·현재 dist/archive/설치/public package만 유지한다. §7/8의 과거 거부된 정리는 재시도하지 않았다.

typed AOT의 당시 선정 구현·평가는 [work15.md](work15.md) §9에 보존한다. W15는 **CLOSED / SUPERSEDED BY W15A**이며 전체 앱 전환과 잔여 작업의 현행 계획은 [work15a.md](work15a.md)다. 기존27회 비교와 채택 미달은 역사적 결과이며 G3 전체 앱 증거가 아니다. 이 절의 미타입 실험 증거와 PARTIAL 경계, §8의 나머지 작업 PAUSED 상태는 유지한다.
