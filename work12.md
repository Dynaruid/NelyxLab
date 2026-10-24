# work12 — Doroti 참조 디자인 패키지 구조 개선·잔여 기능·실제 환경 완성 계획

작성일: **2026-10-18 KST**. 종료일: **2026-10-19 KST**. 계획: **CLOSED / SUPERSEDED BY W13**, 실행: **SUPERSEDED**, 종료 시 제품 전체: **PARTIAL**, `wholePlanComplete=false`.

사용자 요청으로 W12를 종료하고 남은 **11단계**를 [work13.md](work13.md)로 이관했다. 이후 W13도 종료돼 **유일한 활성 계획은 [W14](work14.md)**이며 `ACTIVE / READY 계획 · PAUSED 실행 · PARTIAL 제품`이다. 재개는 [W14 §7](work14.md#7-현재-상태와-다음-재개)을 따른다. 아래 목표·체크리스트·다음 작업·checkpoint/receipt 참조는 **W12 당시 이력이며 현재 실행 지시가 아니다**. 누적 검증 산출물은 삭제됐으며 복구·재생성을 요구하지 않는다. 이번 종료는 제품 전체 완료나 새 build/runtime/native/물리 검증을 뜻하지 않는다. 종료·이관 범위는 §9를 따른다.

## 0. 목표와 유지할 결정

목표는 W8/W9/W10/W11에서 승계한 기능·공개 API·성능·안정성·개발·공급 요구를 실제 Nelyx TypeScript 제품과 기능 동등성 검증으로 완성하는 것이다. 기존 선정 구현과 유효한 증거를 재사용하고, 남은 조건만 아래 실행 단계로 관리한다.

**향후 개발 방향:** Nelyx 기능을 확장할 때도 Doroti의 계층·패키지·기능별 책임 분리를 먼저 참고한다. 이번 구조 개선의 구체적 실행 범위는 두 디자인 패키지와 그 공개 API·Core 접점이다. 공통 Core는 기존 단일 identity를 유지하고 실제 기능에 필요한 접점만 보완하며, 이 요청을 Core 전체 재작성으로 확대하지 않는다.

| 항목 | W12 실행 기준 |
| --- | --- |
| Material 범위 | **M3 only**. M2·`useMaterial3`·M2 전용 factory/overlay·2014/2018 typography 이관과 deprecated alias는 제외한다. current/2023 M3, 공통 색상/shape, 명시적 ink factory/hairline과 M3 플랫폼 정책은 유지한다. 제거한 API를 재생성으로 되살리지 않는다. |
| 두 디자인 패키지 | `packages/cupertino`·`packages/material`을 **Doroti 참조 구조로 먼저 정리**하고 기능 family·공통 의존성 묶음으로 최대한 일괄 개발·보완한다. 기존 전체 mapping과 구현을 재사용한다. |
| 설계·소스 기준 | **Doroti.Cupertino / Doroti.Material의 패키지 경계·기능별 파일·Widget/State/theme/helper 책임 분리가 1차 설계 기준**이다. 제품은 Nelyx TS와 단일 Core로 구현한다. pinned Flutter는 API·기본값·동작·숫자 의미를 확인하는 보조 원본이며, 기존 생성 코드는 유효 범위에서 재사용한다. 새 family를 Flutter 변환부터 시작하거나 Doroti를 막힌 경우에만 검토하지 않는다. |
| 기능 동등성 | 실제 공개/default API, 상태 전이, layout/paint/hit/clip, 입력/focus/selection, 오류·취소·복원·종료와 자원 수명으로 판단한다. 파일 수·IR·marker·타입검사를 완료율로 세지 않는다. |
| Core·소유권 | 단일 Widget/Element/State/RenderObject·Core identity, caller 소유 focus/controller와 View별 자원을 유지한다. generated base/effective/product 3-way merge 또는 명시적인 adopted 전환으로 직접 수정과 재생성을 보호한다. |
| 타입·숫자·출처 | 구체적인 TS 타입과 analyzer-resolved 숫자 의미를 유지한다. 기존 `@dartType`·`@dartParam`·`@dartReturn`을 제품 TS와 공개 `.d.ts`까지 보존한다. 값/이름으로 provenance를 추정하거나 자체 코드에 허위 Dart 출처를 붙이지 않는다. |
| 구현 경계 | 필요한 유한한 compiler/adapter 보정은 가능하다. 범용 Dart/C# 컴파일러, 전수 source hierarchy·SDK closure를 제품 완료의 선행 조건으로 만들지 않는다. `any`·stub·가짜 기본값으로 미지원 의미를 통과시키지 않는다. |
| 제품 공급 | 제품 build/runtime은 Dart SDK·변환기·scratch·Doroti .NET runtime에 의존하지 않는다. 코드·데이터·font/icon/shader/asset의 pin/hash/license/notice는 유지한다. |
| 선택 정적 분석 | 구조 이동·기능 보완 시 **필요하면 Oxlint**로 미사용 코드·금지 import·순환 의존 등을 먼저 점검한다. §6.5의 진단→제한 도입→선택 확장 순서를 따르고, 실제 타입검사·기능/수명 검증은 별도로 유지한다. |

**이번 사용자 요청은 이전 “Flutter 변환 우선 → 막힌 family만 Doroti 비교”의 우선순위를 대체한다.** Doroti 구조를 참조한다는 것은 C# 문법·namespace·runtime shim을 복제하거나 C# 전체 자동 변환을 선행한다는 뜻이 아니다. Doroti에서 기능의 구성과 책임을 먼저 읽고 Nelyx Core의 실제 계약에 맞게 TS로 구현한다. C#/Dart 변환은 해당 묶음의 비용을 줄일 때만 선택한다. 기존 검증된 생성 구현을 구조 개편 때문에 다시 작성하지 않는다. Doroti의 M2/deprecated API·영어 기본 locale·과거 변환 특성은 Nelyx의 요구를 덮어쓰지 않는다.

### 0.1 초기 변환 도구 정리 이후의 검증

W11에서 사용자 요청으로 삭제한 `tools/Nelyx.FrameworkToTypeScript/checks` 전체와 `dart/bin/extract_platform_fixture.dart`는 복구·확장·상시 회귀 대상이 아니다. 변환기 본체·제품 TS·생성 데이터·출처/숫자 주석은 유지한다. 현재 제품 소스와 이 계획을 기준으로 재개한다. 삭제한 과거 ledger나 checks를 복구하도록 요구하지 않는다.

삭제한 `w11-resume.mjs`·`run-check.mjs`나 validator를 요구하는 과거 `resume all`·validate/promote 명령을 실행하지 않는다. recipe를 다시 사용해야 하면 **현재 제품 기준의 명시적 검증 경로를 먼저 연결**한다. 검증 누락은 PASS가 아니다. 과거 27 recipe/6 fixture 결과는 당시 범위의 증거로 보존하며 W12의 반복 실행 목록으로 바꾸지 않는다.

### 0.2 변환 ledger 폴더 제거 — 2026-10-18

사용자 요청으로 이전 변환 ledger 폴더를 제거했다. 필요한 패키지 등록·recipe/수정 입력·생성 소유권·디자인 mapping은 `tools/Nelyx.FrameworkToTypeScript/data`로, source notice는 `Nelyx/licenses/support-origins.json`으로 분리했다. W12 현재 상태는 이 문서에서 관리한다. 누적 검증 기록·handoff·checkpoint JSON은 긴급 정리로 삭제했다.

이전 W8~W11 실행 보고서·checkpoint와 로컬 복구 archive도 긴급 정리로 삭제했다. 제품 소스·출처·생성 소유권은 유지하며 과거 기록 복구를 재개의 선행 조건으로 두지 않는다.

## 1. 승계한 상태와 증거 경계

### 1.1 이관 시 확인한 기준선

| 대상 | 현재 확인/승계 범위 |
| --- | --- |
| 저장소 | HEAD `3b917f0286d25986c5bf77d45061fbf09ed0c6e3`. 이관 전 tracked 변경 없음, 사용자 생성의 빈 `work12.md`만 untracked. |
| Flutter pin | `.tmp/work6/flutter-source` HEAD `71e4717a61786faab4c7aa39825989305ed29e8a` 확인. Doroti를 새로 선택할 때는 해당 checkout HEAD/bytes를 다시 확인한다. |
| W11 무결성 | 현재 입력 **969개**, immutable receipt **670개**, plan/progress/handoff·승계 ledger·도구 정리 연결 **5개**의 hash 일치. 변경 전 문서/control은 이관 기록에 exact bytes로 보존한다. |
| W10 이력 | 입력621개는 역사적 ledger로 보존하고 W11의 변경·supersession·의도적 삭제를 따른다. immutable receipt **12,927개** hash 일치. 과거 입력 전체가 현재 제품과 같다고 주장하지 않는다. |
| 제품 기반 | 최신 W11 선정 기록의 owning source **738개**, promoted batch **27개**를 보존한다. 이 수는 기능 동등성이나 단계 완료율이 아니다. |
| 이관 검증 | 문서·단계 대응·입력/receipt/control 연결만 확인했다. 제품 build·runtime·native·물리 환경 결과를 새로 추가하지 않았다. |

### 1.2 재사용할 구현과 아직 남은 조건

아래는 **선정 범위의 구현·검증 이력**이다. 정확한 source/artifact·환경·제한은 [W11 실행 이력](work11.md#9-구현-실행--2026-10-18-kst), 해당 part와 receipt를 따른다. 관련 입력이 달라지면 영향 범위의 유효성을 다시 판단한다.

| 재사용할 기반 | 남은 판단/작업 |
| --- | --- |
| 양쪽 palette·swatch·theme/text-theme·ColorScheme 역할과 선정 App/route/Router/locale·복원 | seed 생성, 전체 M3 typography/locale별 scale, 나머지 theme/App/default 공개 API와 전체 locale/RTL·공급을 마쳐야 한다. |
| 버튼·activity/progress·RefreshProgressIndicator·Slider/RangeSlider·Material/Ink/InkWell·Chip/Tooltip·Icon 목록/폰트·AnimatedSwitcher·VisualDensity | family 전체 API/default/diagnostics·shape/font/motion 계약의 잔여를 감사한다. **swipe RefreshIndicator는 과거 선정 구현의 선정 공개 API·실제 Core/Web·공급을 구현·검증했다.** sheet/scroll 조합과 native/물리 조건은 잔여다. 이미 구현한 RefreshProgressIndicator·Icon/font를 신규 미구현으로 되돌리지 않는다. |
| Divider/ListTile·CupertinoListTile/ListSection·세 toggle theme data/M3 defaults | 전체 M3 Radio/Switch API/State/painter·theme 적용과 CheckboxListTile/RadioListTile/SwitchListTile가 다음 묶음이다. |
| 표준 Material Checkbox·CupertinoCheckbox·Checkbox.adaptive·source toggle 입력/이동 motion·HSL/HSV·typed const List·Color/Size 보정 | Checkbox의 pointer focus·이동 중 motion·adaptive는 W11 과거 선정 구현의 보완 범위를 재사용한다. Radio/Switch의 전체 source 시각/동작을 기존 finite 구현으로 완료 처리하지 않는다. |
| wheel/2D/tree/Viewer/Scrollbar/behavior 및 기존 editor/app/service/restore 경로 | 남은 scroll·편집·앱·runtime 조합, 실제 플랫폼 입력/수명·성능·최신 공급을 W12-02~08에서 닫는다. |
| InkSparkle/runtime shader·wire11·View별 program cache | Windows AMD Vulkan offscreen, hardware WebGL, 격리 Android emulator APK/JSI·터치·픽셀·해제의 당시 scoped 결과를 보존한다. 이후 제품 변경의 최신 전체 native parity·물리 입력·scanout/FPS·production signing을 증명하지 않는다. |

W11 과거 선정 구현의~9.27의 “다음 작업” 중 후속 절에서 구현한 항목은 역사적 지시다. 현재 우선순위는 §3과 W12 checkpoint를 따른다. `PASS / PARTIAL / FAIL / SKIPPED / notVerified`를 구분하고 기술 결과는 `검증 완료`·`완료 기준 충족`으로 기록한다.

### 1.3 현재 구조 검토 — 2026-10-18 KST

이번 개정 전 Nelyx HEAD는 `fef0034105d49d4d32835fc65ecf4b772aa228da`, tracked/untracked 변경은 없었다. 활성 plan/progress/handoff/checkpoint 연결과 현재 입력 **905개**의 hash가 일치했다. §1.1의 HEAD·dirty 수치는 이관 당시 이력이며 이 검토의 기준선과 구분한다. Doroti 참조 HEAD는 `6778077f9f71ffd0d31652a51efca0163dcc348f`, 검토한 두 디자인 패키지와 icon 패키지에 변경은 없었다. 후속 구현은 참조 HEAD와 사용할 파일 bytes를 다시 확인한다.

| 검토 대상 | 확인한 구조와 개선 필요 |
| --- | --- |
| 파일 구성 | Nelyx Cupertino `src` **42 TS / 4,759줄**, Material **103 TS / 20,137줄**. Doroti는 각각 **52 C# / 44,954줄**, **202 C# / 184,852줄**이다. Nelyx 줄 수에는 icon catalog·selection locale 데이터가 각각 2,368 / 10,380줄 포함된다. 이 수치로 기능 완료율을 계산하지 않는다. |
| 공개 집계와 구현 혼재 | 양쪽 [Cupertino widgets](packages/cupertino/src/widgets.ts)·[Material widgets](packages/material/src/widgets.ts)에 export와 실제 NavigationBar/PageScaffold/Scaffold/TextField/AlertDialog 구현이 섞여 있다. 현재 해당 구현은 공통 AppTheme와 간단한 Row/Column/EditableText 조합이다. Doroti의 별도 `nav_bar.cs`·`page_scaffold.cs`·`scaffold.cs`·`text_field.cs`·`dialog.cs`를 기준으로 공개 API·State·inset·route·입력·layout 책임을 분리하고 기능 차이를 따로 기록해야 한다. |
| 기능별 소유자 불명확 | `buttons.ts`에 여러 Material 버튼, 양쪽 `toggle-controls.ts`에 Radio/Switch가 함께 정의된다. Material [theme.ts](packages/material/src/theme.ts)가 `ThemeData`를 정의하고 [theme-data.ts](packages/material/src/theme-data.ts)는 VisualDensity/MaterialTapTargetSize를 정의한다. Doroti의 `button_style_button.cs`·개별 버튼·`radio.cs`·`switch.cs`·`theme.cs`·`theme_data.cs`처럼 파일명과 소유 책임을 맞춘다. |
| 공개·내부·생성 코드 혼재 | `src` 루트에 공개 모듈과 `*-build`·`*-render`·`*-source-adapter`·`*.generated.ts`가 섞여 있다. 일부 수작업 함수/클래스도 매우 긴 한 줄로 작성돼 상태/정리 경로를 검토하기 어렵다. 내부 helper와 생성 결과의 위치·수정 권한을 구분하고 읽을 수 있는 TS 형식으로 정돈한다. 짧은 재export 파일은 단일 owner를 잇는 경우 유지할 수 있다. |
| 경계 검사와 목표의 불일치 | 현재 [check-package-boundaries.mjs](Nelyx/eng/check-package-boundaries.mjs)는 모든 `ExportDeclaration`을 `Re-export/barrel` 오류로 처리한다. 기존 공개 재export와 이번 목표를 구분하지 못하므로 구조 작업에서 검사 정책을 함께 정리해야 한다. 이번 검토에서 검사기를 실행하거나 PASS로 기록하지 않았다. |
| 패키지 책임 | [Doroti.Cupertino.csproj](../DorotiLab/packages/Doroti.Cupertino/Doroti.Cupertino.csproj)·[Doroti.Material.csproj](../DorotiLab/packages/Doroti.Material/Doroti.Material.csproj)는 Core framework 의존, 독립 icon 패키지, Material→Cupertino, Material 색상 utility와 shader 소유를 명시한다. Nelyx도 이미 Material→Cupertino와 peer Core 경계를 갖고 있다. 필요한 방향은 유지하고 공통 입력/렌더링은 Core, 디자인 정책은 각 패키지, icon/font·locale·shader는 명시적 owner로 관리한다. |
| 범위와 증거 | Doroti에는 navigation/scaffold, form/input, menu/dialog/sheet/picker, card/table/search 등 독립 기능 모듈이 있다. Nelyx의 간소화된 동명 클래스·파일 존재와 선정 PASS는 해당 전체 기능의 증거가 아니다. Doroti의 reviewed marker도 최신 Flutter 동등성·전체 locale·실제 플랫폼 PASS가 아니다. |

**판단:** 현재 부족함은 미구현 기능뿐 아니라 집계 파일의 제품 구현, 기능 owner와 파일명 불일치, 생성/내부 코드 혼재, 기능별 공개 API와 검증 범위의 추적 부족에 있다. 먼저 구조를 정리하고 그 구조 안에서 잔여 기능을 완성한다. 이는 정적 소스·manifest 검토 결과이며 build/runtime/native/물리 검증을 새로 수행한 결과가 아니다.

## 2. W11 → W12 잔여 단계 대응

W11-00의 계획 이관은 완료 이력으로 보존한다. 나머지 **11개 단계**를 아래에 전부 대응시킨다. 상태는 기존 구현의 진행 상태이며 새 계획 작성으로 기능 상태를 올리지 않는다.

| W12 단계 | 승계 단계 | 시작 상태 | 남은 범위와 종료 기준 |
| --- | --- | --- | --- |
| **W12-00 종료·계획 이관** | W11 종료/이관 | COMPLETE (문서만) | W11 CLOSED/SUPERSEDED·잔여11단계 대응·증거/제품 보존·W12 plan/progress/checkpoint/handoff 연결. |
| **W12-01 Doroti 참조 구조·디자인·locale** | W11-01 DESIGN-0~4 | PARTIAL | **STRUCTURE-0~3 구조 정리부터** 기능 owner·export·내부/생성 경계·dependency·ownership을 확립한 후 M3 Radio/Switch·toggle tile, 전체 디자인 family·App·공개/default API·theme/locale/asset·독립 소비·영향 공급. |
| **W12-02 scroll·viewport** | W11-02 | PARTIAL | 잔여 animated API·Page/Nested/header/refresh/reorder/dismiss/sheet·mixed sliver/first seek·keyed State/selection·입력/resize/mutation/restore/close·성능/공급. |
| **W12-03 runtime·paint·text·입력** | W11-03 | PARTIAL | service/worker 초기화·stop·cache/retirement·wide-gamut/output·image/font/text·pointer/animation/physics·backend 오류/복구/drain·수명. |
| **W12-04 편집·Form·입력** | W11-04 | PARTIAL | grapheme/formatter/style/API·undo/autofill/toolbar/selection·multi-View/provider·OS touch/menu/keyboard/caret·실제 IME·복원/해제. |
| **W12-05 앱·라우팅·복원** | W11-05 | PARTIAL | 공개/default App·Navigator/Router/overlay/Hero·async/locale·OS link→nested Form/list/dialog→Back→process recreation/restore/close·native drain. |
| **W12-06 플랫폼 runtime/tooling** | W11-06 | PARTIAL | 여섯 host/tool·SDK/CLI/Metro/provider·runner/template·native/Skia/texture·선택 설치/로드·Core identity·역의존 제거·공급/배포 구성. |
| **W12-07 개발 갱신·inspector** | W11-07 | OPEN | 실제 hot reload/reassemble·State 유지·reload/remount 정책·diagnostics/inspector·source map/preview/service extension·실패 회복/cleanup. |
| **W12-08 우선 실제 환경·감사·공급** | W11-08 | PARTIAL | 최신 Windows/Android/Web·물리 IME/caret/FPS·resize/hidden/resume/GPU loss·복구/종료·archive/외부 소비·version/lock·signing/clean-machine·출처/재현. |
| **W12-09 후속 A 접근성** | W11-09 | DEFERRED | 설정→View/MediaData·semantics tree/ack/action/metadata·실패 owner 회복·reader·Apple/Linux producer 코드·영향 기능. |
| **W12-10 후속 B native/HTML view** | W11-10 | DEFERRED | 생성/부착/배치/합성·clip/transform/z-order·focus/input·해제/복구·route/scroll/overlay/reload 결합. |
| **W12-11 최종 통합·정리** | W11-11 | OPEN | 후속 영향 회귀·최종 실제 환경/공급·기능/출처/consumer/배포 감사·재현 입력·문서/정리·전체 완료 판정. |

실행은 W12-01의 **구조 정리 → 그 구조에서 기능 묶음 완성** 순서로 시작하고 필요한 runtime·편집·앱·개발 접점을 W12-03/04/05/07에서 함께 공급한다. 구조 정리와 기능 추가의 diff·완료 기준을 구분한다. 이후 scroll 잔여와 플랫폼/우선 공급을 닫고 접근성·임베딩·최종 통합으로 진행한다. 단계 번호를 일괄 대기 장벽으로 사용하지 않는다.

## 3. W12-01 디자인 패키지 실행 계획

### 3.1 선행 묶음: Doroti 참조 구조 정리 (STRUCTURE-0~3)

**목표 구조:** Doroti처럼 `src`의 기능별 공개 모듈에서 해당 Widget/API를 찾을 수 있게 한다. TypeScript 파일은 kebab-case를 사용한다. family 내부 State/painter/helper는 같은 파일에 모으거나 규모·재사용·검증 필요가 있을 때만 `internal/<family>`로 분리한다. 생성 여부 때문에 공개 API 경로가 달라지지 않게 한다.

```text
packages/cupertino/                    packages/material/
  src/                                   src/
    widgets.ts       # export 전용          widgets.ts       # export 전용
    app.ts / theme.ts / theme-data.ts       app.ts / theme.ts / theme-data.ts
    button.ts / checkbox.ts                button-style-button.ts / filled-button.ts
    radio.ts / switch.ts                   text-button.ts / outlined-button.ts / elevated-button.ts
    nav-bar.ts / page-scaffold.ts           checkbox.ts / radio.ts / switch.ts
    tab-scaffold.ts / tab-view.ts           checkbox-theme.ts / radio-theme.ts / switch-theme.ts
    text-field.ts / dialog.ts               scaffold.ts / app-bar.ts / text-field.ts / dialog.ts
    ...                                    ...
    internal/<family>/                     internal/<family>/
    generated/<family>/                    generated/<family>/
  tests/<family>/                         tests/<family>/
  assets/ / licenses/                     assets/ / licenses/
  package.json / README.md                package.json / README.md
```

이 트리는 **구현 시 목표 배치**이며 기재한 새 파일이 현재 존재한다는 뜻은 아니다. `dist`·`.cache`는 빌드 출력이며 source owner로 세지 않는다. `tests`에는 제품 API/상태/입력/수명의 의미 있는 회귀 검증을 두며, 삭제한 변환기 checks를 복원하지 않는다.

| 경계 | 설계 규칙 |
| --- | --- |
| 공개 모듈 | 예: Doroti `page_scaffold.cs`→Nelyx `page-scaffold.ts`, `checkbox_list_tile.cs`→`checkbox-list-tile.ts`. 공개 타입·Widget과 관련 Options의 정의 owner는 하나다. `widgets.ts`는 명시적인 value/type 재export만 공급하고 구현·등록·부작용을 두지 않는다. package exports와 공개 `.d.ts`를 동기화한다. |
| theme/data/default | `theme.ts`는 inherited Theme와 ambient lookup, `theme-data.ts`는 ThemeData/value 계약, `*-theme.ts`는 해당 component theme 계약을 소유한다. local→global→M3/Cupertino default 해석 경로를 하나로 만들고 widget마다 별도 AppTheme fallback을 늘리지 않는다. 공통 defaults/helpers는 같은 family 내부에 둔다. |
| 내부·생성 | `internal/<family>`는 State/painter/layout/adapter 등 비공개 구현, `generated/<family>`는 재생성할 body/data/default를 소유한다. 공개 API는 기능 모듈에서 공급한다. 생성 파일 이름 변경·이동 시 recipe/destination/base/effective/product/ownership/notice를 함께 갱신한다. adopted로 바꾸면 소유권과 이전 재생성 대상의 폐기를 명시한다. |
| 의존 방향 | 디자인에 종속되지 않는 Widget/Element/State/RenderObject, Color, 입력/focus/ticker/semantics·View 자원은 Core가 소유한다. Core→design, Cupertino→Material, SDK/tooling으로의 runtime 역의존을 만들지 않는다. Material→Cupertino는 adaptive/theme 등 필요한 지점에서 공개 subpath를 사용한다. 내부 파일에서 자기 패키지의 `widgets` aggregate를 import하지 않아 순환을 방지한다. |
| icon·색상·asset | Doroti의 독립 icon 소유를 참고해 기존 catalog/font/notice의 owner와 공개 입구를 명확히 한다. icons-only 소비가 디자인 구현 전체를 로드하지 않는지 검증하고, 불충분하면 독립 icon package 분리를 STRUCTURE-0 이동표에서 확정한다. ColorScheme seed/image-color utility는 타입이 있는 순수 계산으로, shader는 Material의 asset/adapter로 분리하며 `.NET` utility/runtime을 가져오지 않는다. |

- [x] **STRUCTURE-0 대응·이동표:** 기존 [전체 mapping](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-package-plan.json)에 Doroti 참조 파일/HEAD/hash, Nelyx 현재/이동 후 module·symbol owner, Core 의존, 공개 export, generated/adopted, API 차이·M3 제외 사유, 검증과 이동 순서를 대응시킨다. 이전 mapping의 Flutter 우선은 역사적 방침이며 이 계획과 active progress의 Doroti 기준을 우선한다. 전체 inventory 재추출 대신 기존 mapping에 필요한 차이를 추가한다. 삭제한 ledger를 재건하지 않는다.
- [x] **STRUCTURE-1 공개 owner 정리:** `widgets.ts`의 Scaffold/NavBar/PageScaffold/TextField/Dialog/`showDialog`를 각 기능 파일로 옮긴다. Material ThemeData를 `theme-data.ts`로, VisualDensity/MaterialTapTargetSize를 같은 파일 또는 명시한 value module로 정리한다. buttons/toggle/theme의 혼재를 개별 기능 owner와 공통 기반으로 나눈다. 먼저 기존 동작을 유지하고 간소화 구현의 기능 부족은 §3.2~5에서 보완한다.
- [x] **STRUCTURE-2 내부·생성·가독성:** helper/adapter/generated를 목표 경계로 차례로 옮기고 import·생성 입력·edit guard·source map·출처를 갱신한다. 수작업 TS를 일반적인 여러 줄 형식으로 정돈해 State 갱신/구독/취소/해제 경로를 추적할 수 있게 한다. 생성 파일은 generator를 수정해 재생성하거나 명시적으로 adopt한다. family별로 옮기며 기존 숫자 주석과 단일 타입 identity를 보존한다.
- [ ] **STRUCTURE-3 공개·의존 검증:** `@nelyx/*/widgets`와 canonical subpath의 class/enum/const owner 일치, 생성 `.d.ts`·source map·외부 ESM/RN/Babel·archive asset/notice·Core peer identity·순환/역의존을 검증한다. 현재 경계 검사기의 일괄 재export 금지를 명시한 공개 aggregate/canonical facade만 허용하고 내부 aggregate import와 역의존을 차단하는 규칙으로 갱신한다. package README에 기능별 입구·owner·미완료 API를 적고 sample/SDK/consumer import도 맞춘다. 입구 변경 시 모든 consumer/fixture를 갱신하며 deprecated alias나 이전 구현을 호환용으로 남기지 않는다. 기존 aggregate 공개 입구는 정식 API로 유지한다.

STRUCTURE-0에서 §6.5 **LINT-0**의 도입 필요성을 판단한다. 도움이 되면 STRUCTURE-1~3의 이동/수정 파일에 일반 Oxlint 진단을 연결한다. Oxlint 규칙으로 표현하기 어려운 manifest/export·identity·생성 소유권 조건은 기존 경계 검사를 보완해 검증한다.

**구조 완료 기준:** 대응표·단일 owner·export 전용 aggregate·내부/생성 편집 경계·의존 방향·읽기 쉬운 TS·공개/독립 소비·재생성 보호를 갖추고 이동 전 기능을 보존한다. 해당 family의 strict 타입검사/build와 대표 상태/입력/수명의 회귀로 확인한다. 파일 이동을 기능 동등성 완료로 세지 않으며 전면 자동 변환이나 거대한 새 추상화 계층을 선행 조건으로 두지 않는다.

### 3.2 구조 정리 후 첫 기능: M3 Radio/Switch와 toggle ListTile

- [x] 기존 complete resolved control/list family IR·private helper·Core mapping과 [최신 Checkbox 기록](work11.md#928-전체-cupertinocheckboxadaptive와-공통-입력색상-값)을 재사용한다. 현재 Radio/Switch의 finite 지원과 원본 공개 API/State/painter/theme 간 실제 누락을 확정한다.
- [x] **M3 Radio/Switch 전체 비폐기 API·기본값·State/painter·theme 적용**을 공통 Core 입력/focus/gesture/ticker/semantics owner에 연결한다. source state 색상·shape/track/thumb/icon·오류/disabled·motion·RTL drag·keyboard/semantic action 및 제공할 adaptive 경로를 함께 다룬다.
- [x] **CheckboxListTile·RadioListTile·SwitchListTile**의 slot/layout/baseline·density·control affinity/RTL·selected/disabled·title/secondary·semantics merge·focus/ink/theme를 실제 ListTile/control과 연결한다. 중첩 child action·callback 중복·typed RadioGroup·keyed 이동·caller owner·종료를 검증한다.
- [ ] 전체 Widget API/테마 우선순위·원본의 독립 기대값·실제 Root paint/hit/입력·상태 교체/복원/오류/해제·공개 `.d.ts`/숫자 주석·독립 소비와 영향 backend를 묶음으로 검증한다. 신규 native 공급은 변경 범위와 artifact가 요구할 때 갱신한다.

**완료 기준:** 기존 finite 컨트롤을 전체 동등성으로 간주하지 않고 선정한 전체 API/상태/시각/입력/수명 조건을 실제 제품에서 충족한다. M2·deprecated alias·삭제한 checks를 추가하지 않는다.

### 3.3 DESIGN-0~2 기반·기본 control 잔여

- [ ] §3.1 대응표를 기준으로 Doroti의 기능별 API·State·theme·private helper와 Nelyx의 실제 채택 상태를 연결한다. Flutter source mapping/SCC·기존 생성 후보는 보조 자료로 재사용하고 기존 inventory를 다시 처음부터 생성하지 않는다.
- [ ] ColorScheme seed·전체 M3 typography와 locale별 scale·Cupertino dynamic/high-contrast/brightness·나머지 theme API/default 및 값/보간/diagnostics의 실제 누락을 보완한다. 2014/2018·M2는 제외한다.
- [ ] 기존 버튼/slider/range/progress/chip/ink/Icon/Tooltip, finite Cupertino Radio/Switch와 전체 ButtonStyle/IconButton의 공개/default API·style/theme·shape/font·gradient/elevation/haptic/motion·diagnostics 잔여를 감사해 필요한 범위만 완성한다. W11에서 검증한 기능은 같은 입력·환경·artifact 범위에서 재사용한다.
- [ ] 이미 공급한 icon catalog/font/shader와 View별 등록·cache/해제를 전체 디자인 소비에 연결하고 누락 asset/font/notice를 마친다. 기기 haptic·glyph·GPU 출력은 해당 실제 환경 증거로 구분한다.

### 3.4 DESIGN-3 복합 family와 패키지 전체 누락 감사

- [ ] 목록 후속·Form/text-field/editing/selection을 W12-04와 함께 처리한다. 전체 공개/default API·formatter/validation·focus/keyboard·toolbar/menu·scroll·복원/해제를 포함한다.
- [ ] menu/context-menu·dialog/sheet·picker/date/time을 Doroti 기능 모듈을 참조해 dependency component별 묶음으로 TS 개발·보완한다. Overlay/route·취소/오류·locale/RTL·State와 자원 소유권을 함께 검증한다. 기존 Tooltip·Cupertino 목록은 재사용한다.
- [x] **swipe RefreshIndicator 선정 범위**: 과거 선정 구현의 공개/default·실제 ListView touch·상태/비동기/취소/해제·116 locale label·Core CPU/Web GPU·독립 공급 검증을 마쳤다. 원문 부모/renderer 전수와 native/물리 조건은 별도다.
- [x] **M3 Badge·CircleAvatar 선정 범위**: 과거 선정 구현의 공개/default·테마·intrinsic/위치/dry baseline·반지름/색 전환·이미지 fallback/오류/해제·Core MediaQuery text scaling·선정 CPU/Web GPU·독립 공급을 검증했다. Banner와 나머지 복합 family는 계속한다.
- [ ] sheet/scroll 결합과 남은 scroll 복원/종료를 W12-02와 함께 완성한다. 선정 refresh 사용자 흐름과 전체 sheet/scroll family 완료를 구분한다.

Doroti의 디자인 기능 목록을 기준으로 **각 기능을 구현/부분/미구현/정책상 제외로 구분**하고, 기존의 짧은 우선 묶음에서 빠진 아래 범위도 대응표에 넣는다. 제외에는 M3-only/deprecated 등 구체적 근거를 적는다. 기능 단위로 판정하며 Doroti 파일 수/내부 hierarchy를 복제하지 않는다.

| 패키지 | 전체 감사에 반드시 포함할 기능 묶음 |
| --- | --- |
| Cupertino | navigation/sliver-nav/tab-bar/tab-scaffold/tab-view/page/route, segmented/sliding-segmented control, search-field, form-row/section/text-form-field, picker/date/time, context-menu/action/menu-anchor, dialog/action-sheet/sheet, refresh/scroll, text-field/selection/toolbar/magnifier, expansion/list와 theme/localization/asset. |
| Material M3 | app-bar/bottom-app-bar/scaffold/messenger/FAB/snack-bar, navigation-bar/drawer/rail/tabs, card/badge/banner/avatar, menu/dropdown/autocomplete/search, form/input-decoration/border/text-field/selectable-text/selection-area, dialog/bottom-sheet/date/time-picker, data-table/paginated-table/source, expansion/stepper/carousel/segmented-button, list/toggle-tile/reorder/refresh, button/ink/control와 각 theme/localization/asset. |

기본control과 공통theme를 정리한 뒤 의존 family별로 진행한다. 각 묶음에서 간소화 facade를 실제 공개/default API·State/layout/input/수명 구현으로 완성한다. family 누락을 compiler backlog로 분류하거나 동명class 존재만으로 완료 처리하지 않는다.

### 3.5 DESIGN-4 App·공개 API·locale·공급

- [ ] 양쪽 App/scaffold/bar/tab/navigation/route/Hero/adaptive의 남은 공개/default API·page/theme motion·system chrome·inspector 접점을 W12-05/07과 함께 완성한다.
- [ ] 전체 지원 locale delegate/data·resolution·메시지/날짜/시간·RTL·locale 전환 후 같은 State/편집/route 유지와 typography/font를 검증한다. 기존 영어/선정 locale 검증으로 전체 locale 완료를 주장하지 않는다.
- [ ] aggregate/subpath export·패키지 단독 설치/소비·Core 단일 identity·font/icon/shader/asset 등록·license/notice·현재 archive/설치 bytes·영향 browser/native 공급을 확인한다.

**W12-01 완료 기준:** STRUCTURE-0~3과 DESIGN-0~4의 남은 기능, 전체 기능 대응표의 비제외 범위, 공개/default API·지원 locale/RTL·출처/소유권·독립 소비·영향 공급 조건을 충족한다. Doroti 구조를 기준으로 새 기능의 위치/owner를 결정할 수 있어야 한다. source 파일 전수 변환이나 원본 내부 hierarchy 일치는 완료 조건이 아니다.

## 4. W12-02~08 필수 잔여 작업

### 4.1 W12-02 scroll·viewport

- [ ] 검증된 wheel/2D/tree/Viewer/Scrollbar/behavior를 기반으로 잔여 animated API·Page/Nested/header/refresh/reorder/dismiss/sheet의 실제 누락을 보완한다.
- [ ] mixed sliver·first seek·key/offset 복원, mutation/resize 중 keyed State/editor/focus/selection, selection auto-scroll와 active owner 종료를 검증한다.
- [ ] 입력·layout/paint/hit/clip·restore/close 및 영향 browser/packed/native 소비·성능 요구를 충족한다.

### 4.2 W12-03 runtime·paint·text·입력

- [ ] foundation/scheduler/services·service/worker 초기화·취소/stop·cache/retirement·오류/복구/drain과 앱/View 자원 수명을 완성한다. InkSparkle/program cache의 선정 구현·검증은 재사용한다.
- [ ] wide-gamut rendering/output·bitmap/image cache·font/typography·paragraph/style/strut/hyphens의 남은 출력·측정 계약을 완성한다.
- [ ] gestures/focus/keyboard·pointer/animation/physics와 나머지 공개 widget API·실제 backend 접점을 검증한다. 공통 identity·numeric/value owner·입력/이동 motion의 기존 보완을 보존한다.
- [x] **공개 SafeArea/SliverSafeArea 선정 접점**: 과거 선정 구현의 공개/default·box/sliver·MediaQuery inset/removal·ListView axis 소비·같은 State/offset·독립 Core 공급·선정 CPU/Web GPU를 검증했다. 전체 MediaQuery/InheritedModel·native producer·물리 키보드/IME는 별도다.

### 4.3 W12-04 편집·Form·입력

- [ ] editable/render editable·text input/editing/delta·formatter/grapheme·style/API·undo/autofill·toolbar/selection의 잔여를 보완한다.
- [ ] 여러 필드/Form·조합 안전·scroll·selection/paragraph fragments·복원/해제와 multi-View/provider·OS touch/menu/keyboard/caret를 검증한다.
- [ ] DOM/native transform·font/style·caret·hit/clip·동일 editor/focus 수명과 실제 IME 요구를 충족한다. synthetic composition과 Android emulator EditText는 물리 IME/caret pixels 증거와 구분한다.

### 4.4 W12-05 앱·라우팅·복원

- [ ] App/Navigator/Router/routes·Overlay/Hero·async·locale resolution의 기능/공개/default API 누락을 W12-01과 함께 닫는다.
- [ ] 기존 저장/URI producer로 OS link→nested Form/list/dialog→Back→locale 변화→process recreation/restore/close의 남은 조합을 검증한다.
- [ ] 현재 Windows/Android 공급 후보의 예외·취소·animation/overlay·native drain·종료 수명을 확인한다. 원본 NavigatorState 전체 컴파일은 요구하지 않는다.

### 4.5 W12-06 플랫폼 runtime/tooling

- [ ] 여섯 host/tool·SDK/CLI/Metro/provider·runner/template의 선택 설치/로드·runtime/tooling 역의존 제거·Core 단일 identity를 확인한다.
- [ ] 일반 native/Skia·공통 texture·OS adapter·앱/View 종료/ack와 target별 공급/배포 구성을 완성한다. wire11·cache 공급 후의 현재 artifact 호환성을 확인한다.
- [ ] 여섯 target 공통 코드·package/runner/template·공급 구성과 Windows/Android/Web의 필수 실제 환경 수명을 검증한다. 전용 native 예외는 §6.2를 유지한다.

### 4.6 W12-07 개발 갱신·inspector

- [ ] 최종 package 구조에서 Web 실제 코드 수정→hot reload/reassemble·State 유지·source map/preview·diagnostics/inspector/service extension을 연결한다.
- [ ] Windows/Android 실제 reload/remount 정책·State/자원 owner·실패 회복·cleanup을 검증한다. compiler draft/타입검사로 실제 개발 흐름 검증을 대체하지 않는다.

### 4.7 W12-08 우선 실제 환경·감사·공급

- [ ] 최신 Core/package의 source/JS/`.d.ts`/map·archive·설치 bytes를 확인하고 외부 consumer/browser/Windows/Android 공급 검증을 갱신한다. W11 중간 native 결과와 이후 source 변경을 대조한다.
- [ ] 실제 입력·**물리 IME/caret·성능/FPS·Windows editor pixels·hardware GPU**, resize·hidden/resume·GPU loss·복구·close/drain의 필수 조건을 검증한다. offscreen/CPU 시간·emulator 입력을 scanout/FPS/물리 입력으로 확대하지 않는다.
- [ ] package/version/range/lock·여섯 target 공급 구성·signing/clean-machine·출처/license/notice·재현/배포를 감사한 후 우선 범위 완료를 판정한다.

## 5. W12-09~11 후속과 최종 통합

### 5.1 W12-09 접근성

- [ ] 기존 Web/OS 설정 scoped 결과를 보존하며 native 설정/알림→실제 View/MediaData·semantics tree 제출/ack/해제·metadata/action을 완성한다.
- [ ] callback 교체/실패 owner 회복·실제 reader·영향 디자인/입력 수명과 Apple/Linux producer 코드를 기존 검증 예외 범위에 맞춰 완성한다.

### 5.2 W12-10 native/HTML view

- [ ] 임베딩 생성/부착/배치/합성·texture/ViewApi/header adapter·clip/transform/z-order·focus/input·해제/실패/복구를 완성한다.
- [ ] route/scroll/overlay/reload와 결합한 실제 합성·입력·종료를 검증한다. 일반 host·IME·keyboard/menu·앱/View 수명은 앞선 필수 단계에서 처리한다.

### 5.3 W12-11 최종 통합·정리

- [ ] 접근성·임베딩 영향 회귀와 최신 package/실제 환경/공급 증거를 갱신한다.
- [ ] 전체 선정 기능/API·locale·플랫폼/개발·성능/안정성·출처/consumer/배포 요구를 감사하고 재현 입력·문서·임시 자원을 정리한다.
- [ ] 필수 미구현·미해결 FAIL·검증 공백이 남지 않았는지 확인한 후 전체 완료를 판정한다. 후속 또는 필수 `notVerified`가 남으면 전체 `PARTIAL`을 유지한다.

## 6. 검증·완료 기준과 선택 backlog

### 6.1 영향 범위별 검증

| 변경 종류 | 필요한 증거 |
| --- | --- |
| 기능/통합 | 영향 package/dependent 타입·빌드, 독립 기대값의 API/실제 Root·사용자 흐름·오류/수명/복원·필요 실제 backend. |
| 선택 lint | 도입한 규칙·설정/버전·실제 검사 파일·진단/예외를 기록한다. 금지 import·순환·미사용 코드 등의 정적 결과이며 타입·기능·자원 수명·실제 플랫폼 완료의 증거로 확대하지 않는다. |
| 생성 코드/adapter | 제품에 반영하는 의미·공개 타입·숫자 출처·재생성 충돌/소유권 보존. recipe 재사용 시 현재 제품 검증 경로를 연결한다. 삭제한 checks 전체 회귀는 요구하지 않는다. |
| 공급/구조 전환 | 동일 source/artifact의 archive·외부 consumer·설치 bytes·실제 EXE/APK 실행/restore/close. 구조 전환/최종 후보에서 여섯 target 공급 구성을 확인한다. |
| 문서/control | 단계 대응·입력/receipt/control hash·코드/증거 보존·activePlan 연결. 제품 runtime 전체 재실행은 요구하지 않는다. |

같은 입력·도구·환경·artifact의 유효 결과를 재사용하고 변경·실패·필수 gate 누락이 있는 영향 범위만 다시 검증한다. 원본 유한 receiver·Core Root/CPU raster·Babel source 실행·browser·native offscreen·기기/물리 관측은 서로 다른 증거다. 구현을 복사한 기대값은 사용하지 않는다.

[저장소 지침](.github/copilot-instructions.md)에 따라 테스트 timeout은 **20분(1,200초)**으로 설정하고 대부분의 반복 검증은 30회 이내로 제한한다. 같은 checkout Dart 분석은 직렬 실행한다. 삭제한 timeout wrapper는 복구하지 않고 실행 환경에서 제한 시간을 설정한다. family마다 전체 SDK/native 공급을 반복하지 않는다.

### 6.2 플랫폼 범위

**Windows/Android/Web은 필수 실제 환경**이다. iOS/macOS/Linux 전용 native build/run·물리 입력·서명·전용 harness는 기존 사용자 결정의 **SKIPPED**, provider는 **notVerified**를 유지한다. 여섯 target 공통 TS·코드·package/runner/template·공급 구성 의무는 유지한다. 이 명시적 예외를 native 여섯 target PASS로 표현하지 않는다.

### 6.3 완료 판정

- **기능 묶음 완료:** 선정 기능과 공개/default API가 실제 제품에서 소비되고 상태/layout·입력/편집·오류/취소/복원·자원 수명·필요 성능·영향 플랫폼/공급·출처/소유권 조건을 충족한다.
- **우선 범위 완료:** W12-00~08의 필수 조건 충족 후 `우선 범위 완료 / 전체 PARTIAL`로 기록한다. W12-09/10은 계속 남는다.
- **전체 완료:** W12-09/10과 영향 통합/공급까지 마친 W12-11에서 판정한다. §6.2의 기존 전용 native 예외는 결과와 별도로 명시한다.

### 6.4 선택 compiler backlog

const collection spread/if/null-aware·추가 constant/list/or-join pattern·generator/collection loop·lazy global/member·extension-type/getter/setter owner 탐색·전체 source hierarchy/SDK closure, C# project/partial/global-using·상속/generic/runtime lowering은 **실제 제품 해결에 필요하거나 별도 요청된 경우만** 수행한다. 최신 typed const List 공급은 general const-list emission/full List API 완료를 뜻하지 않는다. 미지원 의미는 명시적 진단으로 유지하며 backlog 수를 필수 기능 잔여 수로 세지 않는다.

### 6.5 선택 Oxlint 활용 계획 — 2026-10-18 KST

**검토 결과:** root/package scripts와 lock에는 Oxlint 도입이 없고 별도 lint 설정도 없다. 검토 시작 시 TypeScript는 **5.9.3**이었으며 후속 사용자 요청으로 **7.0.2를 도입했다(§6.6)**. 두 디자인 패키지는 `tsconfig.build.json`만 사용한다. Oxlint는 Doroti 참조 구조로 이동하거나 기능을 보완할 때 빠른 정적 진단 도구로 활용할 수 있다. **Oxlint는 검토와 계획만 반영했으며 설치·설정 파일 생성·lint 실행·자동 수정은 하지 않았다.** 도입 자체를 W12 제품 완료의 필수 선행 조건으로 만들지 않는다.

| 활용 지점 | 제안하는 규칙·적용 경계 |
| --- | --- |
| 파일 분리와 수작업 TS | correctness 중심 진단과 `eslint/no-unused-vars`로 이동 뒤 남은 import/변수·잘못된 참조를 점검한다. `typescript/no-explicit-any`로 새 기능의 임의 타입 우회를 확인한다. source 계약상 필요한 미사용 callback 인자는 `_` 접두어 등 좁은 예외로 다룬다. 전체 style/pedantic 규칙을 한꺼번에 켜지 않는다. |
| 의존 방향·공개 입구 | 파일별 overrides와 `eslint/no-restricted-imports`로 Core→design, Cupertino→Material, 디자인→SDK/tooling, 내부→자기 `widgets` import를 제한한다. 공개 aggregate의 합법적 재export를 금지하는 포괄 규칙은 쓰지 않는다. manifest와 실제 해석 경로까지 검사할 필요가 있는 상대 경로 우회·공개 subpath·class identity 조건은 `check-package-boundaries.mjs`가 담당한다. |
| 순환 의존 | built-in `import` plugin의 `import/no-cycle`을 후보로 사용한다. 현재 `.ts` import·workspace package exports·빌드된 `.d.ts`와 resolver의 일치를 먼저 검증한다. 변경 파일만 검사한 결과로 패키지 전체 graph 완료를 주장하지 않고 구조 묶음 종료 시 두 패키지와 필요한 Core 접점의 graph를 확인한다. type-only cycle 처리와 탐색 깊이도 설정/보고에 명시한다. |
| 비동기·상태 callback | 호환성 확인 후 `typescript/no-floating-promises`·`typescript/no-misused-promises` 등 type-aware 규칙을 선택 검토한다. list onTap·dialog/route·취소/종료의 Promise 처리 누락을 찾는 데 사용하되 실제 error channel·callback 중복·dispose 이후 동작은 기능 검증으로 확인한다. 경고를 없애기 위한 무조건적인 `void`·빈 catch·타입 단언을 추가하지 않는다. |
| 생성·채택 코드 | 생성 body/data도 필요한 correctness/import 진단은 읽기 전용으로 수행하되 기계적 style 규칙·자동 수정은 제외한다. 수정이 필요하면 generator/adapter/recipe를 고치고 해당 결과만 재생성하거나 명시적으로 adopt한다. `.generated.ts` 이름뿐 아니라 기존 ownership 기록으로 대상을 구분하며 icon/locale catalog·shader 문자열과 숫자 출처 주석을 보존한다. |
| 한 줄 코드의 가독성 | Oxlint만으로 formatting 목표가 해결된다고 보지 않는다. STRUCTURE-2에서 수작업 파일을 읽기 쉬운 형식으로 정리하고, formatter가 필요하면 별도 도구인 Oxfmt 등을 작은 범위에서 비교한다. formatter 도입이나 전체 저장소 재정렬은 이 선택 lint 작업에 포함시키지 않는다. |

**타입 기반 검사의 현재 제한:** 확인한 [공식 type-aware 문서](https://oxc.rs/docs/guide/usage/linter/type-aware.html)는 추가 `oxlint-tsgolint`와 TypeScript 7.0+ 기반 호환 조건을 안내한다. 후속 요청으로 compiler의 7.0.2 도입은 완료했지만 이것이 typed lint 실행이나 호환성 검증을 뜻하지 않는다. `oxlint`·`oxlint-tsgolint` 설치와 project 탐색을 포함한 type-aware는 **DEFERRED / notVerified**로 두고 실제 필요가 확인된 경우 도입한다. 일반 lint는 타입 기반 엔진 없이 먼저 평가할 수 있다.

또한 [CLI 문서](https://oxc.rs/docs/guide/usage/linter/cli)에 따르면 type-aware의 project 탐색에는 `--tsconfig`가 적용되지 않는다. 두 디자인 패키지에 임의의 옵션만 붙여 typed PASS를 주장하지 않는다. 선택 도입 시 `tsconfig.json`의 `extends`/include 또는 project 구성을 검토해 기존 `tsconfig.build.json`과 같은 소스를 검사하게 하고, Core→Cupertino→Material의 의존 `.d.ts`를 준비해 누락 파일/타입이 없는지 확인한다. 기존 `tsc`·공개 `.d.ts`·build 검증은 유지하며 `--type-check`로 교체하지 않는다.

- [ ] **LINT-0 진단·필요성 판단 (선택):** 대표 family의 이동/수정 파일과 관련 import graph에서 얻을 결함·오탐·검사 범위를 평가한다. 유용하면 검증할 Oxlint 버전을 exact pin으로 고르고 설정/규칙/대상/예외를 기록한다. 도입하지 않으면 사유와 대체 경계 검증을 기록하며 제품 작업을 막지 않는다. 검사하지 않은 상태를 lint PASS로 쓰지 않는다.
- [ ] **LINT-1 일반 lint 연결 (LINT-0에서 채택 시):** root 개발 의존성과 lock, 하나의 `.oxlintrc.json`, root scripts를 함께 추가한다. root 설정의 overrides로 수작업/생성/테스트 및 패키지별 의존 규칙을 나누고 nested 설정과 섞지 않는다. `node_modules`·`dist`·`.cache`·`.tmp`·upstream reference는 제외한다. 초기에는 진단 수집으로 시작하고 정리한 family의 확정 규칙부터 error로 올린다. 채택한 검사 gate의 오류는 실제 실패로 기록한다. 전체 SDK/native 공급을 lint마다 재실행하지 않는다.
- [ ] **LINT-2 선택 확장 (현재 DEFERRED):** type-aware가 실제 결함 해결에 필요한지 판단하고 엔진/TS/project/의존 `.d.ts` 호환성을 확인한 후 별도 실행을 추가한다. 이후 필요하면 영향 Core/SDK/consumer로 일반 lint를 확대한다. 타입 엔진 도입이나 새 custom plugin 개발을 두 디자인 패키지 구조 개선의 선행 조건으로 두지 않는다.

도입 시 사용할 **script 후보**는 다음과 같다. 현재 `package.json`에 추가된 명령은 아니다.

```text
lint:designs        = oxlint -c .oxlintrc.json packages/cupertino/src packages/material/src
lint:designs:strict = npm run lint:designs -- --max-warnings 0
lint:designs:types  = oxlint -c .oxlintrc.json --type-aware packages/cupertino/src packages/material/src
```

`lint:designs:types`는 LINT-2 조건을 충족했을 때만 만든다. 일상 수정은 같은 root 설정으로 명시한 파일만 빠르게 점검하고, 구조 묶음 종료에는 해당 패키지 범위를 확인한다. 파일별 예외에는 이유를 남기며 사용하지 않는 disable도 점검한다. ignore/경로 문제로 **실제 검사 파일이 0개이면 PASS가 아니며**, 검사 대상 누락을 먼저 해결한다. lint 결과에는 version·config hash·대상 파일 수·진단·exit code와 일반/type-aware 구분을 남긴다.

자동 수정은 검토한 **수작업 변경 파일에만** 적용하고 diff·숫자 주석·공개 API를 확인한다. unsafe fix·suggestion 일괄 적용, 생성물 직접 수정, 경고를 숨기기 위한 blanket disable을 기본 흐름으로 두지 않는다. lint 실행 제한은 기존 1,200초 기준을 사용한다. **lint PASS는 정적 규칙 범위의 결과**이며 Widget/State/theme 동등성·resource 해제·물리/플랫폼 검증과 구분한다.

검토 근거: [설정·overrides](https://oxc.rs/docs/guide/usage/linter/config), [금지 import](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-imports), [순환 의존](https://oxc.rs/docs/guide/usage/linter/rules/import/no-cycle), [타입 기반 검사](https://oxc.rs/docs/guide/usage/linter/type-aware.html), [CLI](https://oxc.rs/docs/guide/usage/linter/cli), [별도 formatter Oxfmt](https://oxc.rs/docs/guide/usage/formatter). 도입 때 버전별 규칙/옵션을 다시 확인하고 성능 향상을 측정 없이 주장하지 않는다.

### 6.6 TypeScript 7 실제 도입 — 2026-10-18 KST

사용자의 “TypeScript 7.0도 도입할 수 있으면 도입” 요청에 따라 npm 배포와 실제 저장소 호환성을 확인하고 **정식 7.0.2**를 root와 변환기 개발 환경에 적용했다. [Microsoft의 공식 병행 설치 안내](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)를 따른다. 7.0은 기존 Compiler API를 공급하지 않으므로 현재 custom declaration transformer·AST emitter를 갑자기 native API로 교체하지 않는다.

| 역할 | 실제 적용 |
| --- | --- |
| `tsc` CLI | root와 변환기의 `@typescript/native: npm:typescript@7.0.2`. 기존 workspace/sample·CLI/Metro·변환기 검사 명령은 **7.0.2 native compiler**를 실행한다. preview/nightly는 도입하지 않았다. |
| Compiler API | `typescript: npm:@typescript/typescript6@6.0.2` 호환 패키지. lock으로 고정된 실제 API 구현은 **6.0.3**이다. 기존 `import ts from 'typescript'`를 사용하는 staged ESM/`.d.ts`/map build와 변환기는 이 API를 사용한다. 따라서 7로 검사하고 6 API로 emit하는 범위를 명시하며 native emit 전면 전환으로 표현하지 않는다. |
| Bun 타입 | 변환기의 `@types/bun`을 **1.4.3**으로 갱신해 7의 DOM/WebAssembly 타입과 기존 1.3.5 선언 간 충돌을 해소했다. source 타입검사를 느슨하게 하거나 `skipLibCheck`를 추가하지 않았다. |
| Node 선언 검사 | CLI/Metro의 명시 파일 검사에 `--types node`를 지정했다. 7의 ambient types 기본값 변경 때문에 필요한 설정이며 전체 global 타입을 자동 허용하지 않는다. |
| 생성 코드 호환성 | wheel physics 1곳·Material scrollbar 8곳의 `(value ?? null) ?? fallback`을 같은 평가 순서의 `value ?? fallback`으로 정리했다. 공통 emitter에 같은 AST 정규화를 연결하고 두 product 파일은 [명시적 adopted 전환](tools/Nelyx.FrameworkToTypeScript/data/work8/w12-typescript7-nullish-adoption.json)으로 보호했다. 역사적 base/fingerprint/source origin은 유지한다. 마지막 `?? null`은 보존한다. |
| 도구 identity | 호환 wrapper뿐 아니라 실제 6.0.3 compiler 구현·manifest bytes까지 fingerprint와 loaded-identity guard에 포함했다. 기존 cache를 새 compiler 결과로 오인하지 않으며 과거 전체 변환/checks replay는 하지 않는다. |

**검증 완료 범위:** 1,200초 제한 아래 전체 workspace와 sample의 `check:types`, CLI/Metro 선언 검사, 변환기의 native 타입검사와 호환 API 검사, Core/Cupertino/Material/tooling-contracts/SDK의 staged build를 통과했다. 실제 공개 ESM 소비에서 aggregate/canonical subpath와 공통 Icon identity가 일치했고 **827개 선언·827개 JS map·1,126개 숫자 출처 태그**를 확인했다. nullish 정규화는 **22개 값/평가 순서/오류 벡터**와 기존 숫자 주석 보존을 확인했다. 초기 7 후보의 TS2871·Bun 선언 충돌·NodeJS namespace 오류와 해결 후 결과를 구분해 기록한다.

정확한 설정·입력·결과는 typescript7.json (산출물 삭제)을 따른다. 이번 작업은 개발 compiler 도입과 필요한 호환 보정이며 **STRUCTURE-0~3이나 디자인 기능 완료가 아니다**. 새 native/물리/실제 앱 동작·FPS·전체 archive 공급을 검증하지 않았고 속도 향상도 측정 없이 주장하지 않는다. 여섯 target에서의 compiler 실행을 모두 검증한 것으로 확대하지 않는다. W12 단계 상태는 유지한다.

## 7. 종료 직전 상태와 재개 기준 (이력)

**2026-10-19 긴급 정리:** 사용자 요청으로 기능 구현은 **PAUSED / PARTIAL**이다. 개발 중 누적된 검증 기록 JSON·immutable receipt·checkpoint/history·임시 설치본·archive·browser profile·build/test 산출물을 삭제했다. 이전 checkpoint나 receipt 복구를 재개 조건으로 요구하지 않는다.

제품 소스·필수 회귀 fixture·출처/라이선스·숫자 주석·생성/채택 소유권과 고정 Flutter/Dart 참조 입력은 유지한다. 과거 선정 검증 결과를 현재 전체 제품 완료로 올리지 않는다. 마지막 OverflowBar/Core 배율 변경은 build/type/저장소 회귀까지 실행됐으나 독립 설치는 디스크 공간 부족으로 실패했으며 현재 공급 검증은 미완료다.

1. 사용자 재개 요청이 있으면 현재 git status/diff와 제품 소스·고정 참조 revision을 확인한다.
2. Doroti 책임 분리와 기존 단일 Core owner를 기준으로 남은 기능을 진행한다.
3. 대용량 작업 전에 여유 공간을 확인하고 임시 작업 디렉터리는 한 실행에 필요한 것만 만들며 종료 시 삭제한다. 이전 검증 산출물이나 소비자 설치본을 누적하지 않는다.
4. 검증 상태·남은 작업은 이 문서에 짧게 갱신한다. `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`와 삭제한 실행 기록·receipt/checkpoint 폴더를 생성·복구하지 않는다. 제품 사용 안내는 기존 README에 반영한다.

## 8. 실행 체크리스트

- [x] **W12-00:** W11 CLOSED/SUPERSEDED·잔여11단계 대응·변경 전 문서/control 보존·W12 활성 기록 연결. 문서 작업 완료.
- [ ] **W12-01:** Doroti 참조 STRUCTURE-0~3·기능별 단일owner·export/내부/생성/의존 경계 → M3 Radio/Switch·세 toggle tile·DESIGN-0~4/전체기능 대응표·지원 locale/asset·독립 소비·영향 공급.
- [ ] **W12-02:** 잔여 scroll/animation·mixed/first seek/keyed selection·복원/close·성능/공급.
- [ ] **W12-03:** service/worker·paint/image/font/text·입력/animation·오류/복구/drain·backend.
- [ ] **W12-04:** Form·grapheme/style/undo/autofill/toolbar/selection·multi-View·OS menu/keyboard/caret·실제 IME.
- [ ] **W12-05:** 공개/default App·route/overlay/Hero·OS link/Back/locale·cold restoration·native drain.
- [ ] **W12-06:** 여섯 host/tool·SDK/CLI/Metro·runner/template·Core identity·선택 공급 구조·필수 환경 수명.
- [ ] **W12-07:** 실제 hot reload/reassemble·State 유지·inspector/source map/preview·실패 회복/cleanup.
- [ ] **W12-08:** 최신 archive/native parity·물리 IME/caret/FPS·복구/종료·출처/배포/재현 감사·우선 범위 판정.
- [ ] **W12-09:** 설정→View·tree/ack/action·reader·실패 owner 회복·영향 기능.
- [ ] **W12-10:** native/HTML view 합성·입력/focus·route/scroll/overlay/reload·해제/복구.
- [ ] **W12-11:** 후속 회귀·최종 실제 환경/공급·전체 감사·문서/정리·전체 완료 판정.

W12는 **CLOSED / SUPERSEDED BY W13**이다. 위 체크리스트의 미완료 상태는 종료 당시 이력이며, W13도 종료된 현재 계획·잔여·재개 기준은 [work14.md](work14.md)를 따른다.

## 9. W12 종료와 W13 이관 — 2026-10-19 KST

- W12-00의 이전 계획 이관은 완료 이력으로 유지한다. 미완료 **W12-01~11 전부를 W13-01~11로 대응**했으며 상세 상태·잔여·완료 기준은 [W13 §2](work13.md#2-w12--w13-전-단계-대응)에 있다.
- STRUCTURE-0~2·control/theme/버튼·route·RefreshIndicator·SafeArea·Card/Badge/Avatar·TypeScript 7 등 현재 구현을 재사용한다. 오래된 미체크 항목만으로 기존 기능을 신규 미구현으로 돌리지 않는다.
- STRUCTURE-3, 마지막 OverflowBar/Core 배율 변경의 독립 설치/공급 실패, 전체 기능/locale·실제 환경·후속 접근성/임베딩·최종 통합의 남은 조건은 W13에 승계했다. 과거 선정 결과를 최신 전체 PASS로 올리지 않았다.
- 제품 소스·필수 회귀 fixture·출처/라이선스·숫자 주석·생성/채택 소유권을 유지한다. checkpoint/handoff·receipt·archive를 생성하거나 삭제한 기록을 복구하지 않았다.
- 당시 작업은 문서 이관이며 W13 단일 활성·실행 PAUSED·제품 PARTIAL이었다. 이후 W13도 종료됐으며 현재는 **유일한 활성 계획 W14 / 실행 PAUSED / 제품 PARTIAL / `wholePlanComplete=false`**다.
