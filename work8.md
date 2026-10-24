# work8 — Flutter 일괄 자동생성·수동 보정·독립 패키지 전환 계획

> 2026-10-18 정리: 이전 변환 ledger 폴더를 제거했다. 이 문서의 보고서·validator·재개 지시는 과거 이력이며, 현재 계획과 재개 기록은 [work12.md](work12.md)를 따른다. 필요한 생성 입력/소유권은 변환기 `data`로 옮겼고, 제거 전 자료는 로컬 복구 archive에 보관했다.

작성일: **2026-10-13 KST**. 상태: **PAUSED / 사용자 요청으로 중간 마무리**. 제품 상태: **PARTIAL**.

현황 갱신: **2026-10-14 KST**. 현재 재개 기준은 **§0·§10.23**과 pause-checkpoint.json (보관된 과거 기록 `pause-checkpoint.json`)이다. 이번 갱신은 문서 정리이며 구현은 일시 중지 상태를 유지한다. 전체 W8 완료나 최종 공급 수락을 뜻하지 않는다.

사용자의 **“자동생성 허용하게 작업 방향을 바꿀께”** 결정을 반영한다. 앞으로는 **고정 Flutter 소스 분석 → 의존성별 일괄 자동생성 → 기존 구현과 합성 → 묶음 검증 → 제품 소스에 자동 반영 → 미지원·실패 부분 수동 보정**을 기본으로 한다. 생성 후 제품 코드를 직접 수정하는 것도 허용한다. 파일·선언마다 사람이 이식하고 승인해야 다음으로 넘어가는 방식은 기본 경로에서 제외한다.

이 문서는 [work7.md](work7.md)의 미완료 범위를 승계할 새 실행 계획이다. 계획 작성 단계 이후 사용자의 전체 작업 요청으로 구현을 시작했다. 실행 기록은 §10에 누적한다. W7 문서의 종료와 제품 완성 판정은 §2에 따라 구분한다.

## 0. 현재 상태 — 2026-10-14 KST

문서 갱신 직전 HEAD는 **`9a55033`**이고 작업 트리는 clean이었다. 체크포인트의 제품 소스 기준은 **`3992130`**이며, `9a55033`은 중간 마무리 문서·체크포인트 커밋이다. 아래 상태는 현재 파일·manifest·checkpoint와 저장된 증거의 해시를 확인한 결과다. 이번 문서 갱신에서 build/runtime 검증을 다시 실행하지 않았다.

| 항목 | 현재 상태 | 수락 범위·남은 작업 |
| --- | --- | --- |
| 전체 작업 | **PAUSED / PARTIAL**, `sessionComplete:false`, `wholePlanComplete:false` | 사용자 요청으로 중간 마무리. W8 전체 범위는 유지 |
| 현재 재개 기록 | pause-checkpoint (보관된 과거 기록 `pause-checkpoint.json`), selection-progress (보관된 과거 기록 `selection-progress.json`), §10.23 | 이전 strict checkpoint (보관된 과거 기록 `checkpoint.json`)는 TextStyle 공급 cohort의 과거 증거 |
| 제품 버전 | core **0.16.0**, SDK **0.20.0**, Skia RN/Web **0.6.0**, CLI/Metro **0.10.0**, Material/Cupertino **0.1.0** | 현재 package manifest 기준. 같은 버전의 과거 archive가 최신 소스를 포함한다는 뜻은 아님 |
| 디자인 분리 | `packages/material`, `packages/cupertino`에 선정 소형 구현 이동, core의 옛 디자인 모듈 제거 | 전체 canonical theme/control family·localization은 PARTIAL. `packages/localizations`와 여섯 `host-*`/`tool-*` 패키지의 최종 물리 분리는 남음 |
| 고정 원본 | Flutter **`71e4717a61786faab4c7aa39825989305ed29e8a`** | 실제 source checkout HEAD 일치 확인. `localSnapshotMatchesPin:false`인 inventory 경계는 유지 |
| 자동생성 | **6개 반영 배치 / 36개 origin 기록** | `matrix`, `tween-sequence-item`은 `ui/types.ts` 의존 해시 변경으로 재수락 필요. 나머지 4개는 기록된 직접 입력 해시 일치. 일반 inheritance/mixin/async/collection lowering과 잔여 SCC 실행은 PARTIAL |
| selection 작업 checkpoint | 제품 입력 **68개**, 도구 입력 **34개**, scoped proof family **25개** | 직접 product/tool 입력이 일치하는 증거 **24개**, Region 소스 변경으로 과거 증거가 된 `selection-overlay-root` **1개**. 전체 제품/플랫폼 수락 개수로 환산하지 않음 |
| 마지막 영향 범위 검증 | 공통 타입 검사 PASS, Region Root **9 groups PASS**, Region 원본 **24시나리오 × assertions on/off PASS**, 기본 shortcut Root **10 groups PASS** | 중간 마무리 당시 검증. Web browser hook은 제어 수신기이며 새 기본 DOM provider 실행 증거가 아님 |
| DOM native 메뉴 | **`3992130` WIP / runtime notVerified** | View-owned host·Core render binding·SDK DOM/range/pointer/channel/bootstrap 초안. shutdown ingress 차단, 실제 Root/브라우저 및 source platform-view API 검증이 남음 |
| 출처·공급 정합성 | 수동 origin **10개**의 destination/supporting hash drift | 새 selection 모듈의 public exports·외부 소비, origin/coverage, 변경 배치·archive·여섯 runner 공급을 다시 연결해야 함 |
| native 계약 | `wordBoundaryVersion:2`, `textBoxVersion:1`, draw wire **9** | 새 boundary/box header native build/runtime은 **notVerified**. 과거 DLL·APK·browser 공급 증거를 최신 selection 소스에 승계하지 않음 |
| 최종 플랫폼 수락 | Windows/Android/Web 실제 기능·IME/reader/FPS·복구·배포는 OPEN | iOS/macOS/Linux 전용 native build/run/harness는 기존 사용자 정책대로 **SKIPPED**, provider **notVerified**, 공통 TS 검사는 유지 |

최근 구현에는 Unicode 16.0 / characters 1.4.1 grapheme table, 고정 Dart property table을 사용하는 word boundary, TextPainter caret/box·선택 fragment/container·scroll selection, tap-and-drag, editing value/intent, overlay·status/listener·Region과 전체 기본 text-editing shortcuts/macOS selector 42개가 포함된다. 범위별 원본·Root 증거는 §10.11~10.22에 있다. 이 소스 반영만으로 전체 EditableText/IME·SelectionArea/디자인 controls·public package 공급을 완료한 것은 아니다.

마지막 저장 coverage 집계는 **missing 62,153 / partial 5,641 / adapted 6,494 / implemented 1 / notApplicable 8**, required **74,297**, public **47,282**, source diagnostics **0**이다. 현재 파일 bytes는 이전 strict checkpoint의 기록과 일치하지만, 이후 selection/DOM 변경의 새 출처·목적지 수락은 아직 반영하지 않았다. 따라서 이 수치를 최신 구현률이나 전체 완료율로 사용하지 않는다.

재개 순서는 다음과 같다.

1. 현재 diff와 pause checkpoint의 해시·pin을 확인하고 관련 `.tmp/work6`·`.tmp/work8` 증거를 보존한다.
2. **DOM shutdown ingress를 drain 전에 차단**하고 late-input·재진입·부분 bind 실패·해제를 검증한다.
3. 기본 DOM 경로의 실제 Core hit/transform·가림/clip/paint order·다중 View, pointer capture·선택 Range·enable/disable와 브라우저 우클릭을 검증한다.
4. SelectionArea/디자인 controls와 선택 모듈 공개·외부 소비를 연결하고 origin/coverage·변경 배치를 갱신한다. origin/dependency/artifact 입력을 갱신하기 전에는 strict checkpoint writer를 재실행하지 않는다.
5. 현재 archive·여섯 runner/native/UI 수락을 갱신하고 §6~7의 나머지 서비스·편집·고급 scroll·route/semantics·디자인/locale·provider/tooling·reload/inspector·최종 감사를 이어간다.

## 1. 착수 전 검토 결과 — 2026-10-13 이력

§1.1~1.3은 계획 수립 당시 확인한 상태를 보존한 기록이다. 당시 버전·도구 제약과 미구현 설명은 현재 상태가 아니며, 최신 판단은 §0과 §10.23을 따른다.

### 1.1 착수 전 기준

| 항목 | 이번 검토에서 확인한 상태 | 계획에 미치는 영향 |
| --- | --- | --- |
| 작업 트리 | HEAD `01656ab`, 시작 시 tracked 변경 없음, 빈 `work8.md`만 미추적 | 현재 구현을 기준으로 시작하되, 실제 착수 때 diff를 다시 확인 |
| 제품 버전 | core `0.15.0`, SDK `0.19.0`, Skia RN/Web `0.5.0`, CLI/Metro `0.9.0` | W7 작성 초기의 core 0.9 / SDK 0.11을 현재 기준으로 사용하지 않음 |
| Flutter 기준 | `71e4717a61786faab4c7aa39825989305ed29e8a` | 같은 pin의 잔여 구현을 처리하며 최신 master 추종은 추가하지 않음 |
| 원본 checkout | `.tmp/work6/flutter-source`의 Git root와 HEAD가 해당 pin임을 확인 | `reference/flutter-master`라는 폴더 이름만으로 원본을 선택하지 않음 |
| 선언 inventory | 74,297 records / public 47,282 / evidence 77개 / source diagnostics 0 | 선언·member·private 의존성·상수가 섞인 수치이며 구현률·예상 시간으로 환산하지 않음 |
| 착수 전 coverage | missing 63,276 / partial 2,996 / adapted 8,007 / implemented 7 / notApplicable 11 | 당시 반영 기준이며 당시 일반 sliver 구현의 출처 반영은 별도로 남아 있었음 |
| 이식 manifest | `framework-imports.json` selections 1,066개 | 기존 qualified ID·pin·출처·채택 이력을 유지하고 새 자동생성 상태를 연결 |
| W7 중단점 | §9.45 및 `sliver-viewport/pause-checkpoint.json`: PAUSED / sessionComplete false / wholePlanComplete false | viewport reveal부터 이어지는 잔여를 새 계획에서 빠뜨리지 않음 |
| 중단 당시 증거 | 제품 파일 478개 해시, 원본 44개, 최신 30 groups PASS를 기록 | 과거 checkpoint 범위의 증거로 승계; 이번 검토에서 runtime을 재실행한 것은 아님 |

`flutter-coverage.json`은 약 109 MB다. 배치마다 전체 Dart 분석·전체 coverage 재작성·과거 모든 수락 재실행을 반복하지 않는다. 기존 resolved inventory를 재사용하고 변경된 source/tool/schema/목적지에 대해서만 갱신한다. 현재 inventory의 `localSnapshotMatchesPin:false`도 유지한다. 로컬 reference와 pin의 차이를 무시하고 자동생성하지 않는다.

### 1.2 자동화의 실제 출발점

현재 [이식 도구](tools/Nelyx.FrameworkToTypeScript/README.md)는 필요한 기반 일부를 이미 갖고 있다.

- 공식 Dart analyzer 기반의 선언·signature·member·의존성·conditional import/export·private override·source span 분석.
- qualified source ID, 정확한 source hash, 외부 패키지 lock/pin, TypeScript compiler를 사용한 실제 목적지 확인.
- 제한된 C# AST → TypeScript 초안 생성, 기존 수동 Dart 포트의 출처·coverage 관리.

하지만 [main.ts](tools/Nelyx.FrameworkToTypeScript/src/main.ts)는 **automatic Dart selection을 명시적으로 거절**한다. Dart 경로는 `manual-port-required` 분석 기록만 출력한다. [inventory.dart](tools/Nelyx.FrameworkToTypeScript/dart/bin/inventory.dart)의 영속 결과도 선언·관계 중심이며 실행 본문을 변환하는 typed IR가 아니다. **일괄 실행 wrapper만 추가해서 Flutter 전체를 자동 변환할 수 있는 상태는 아니다.**

추가로 [paths.ts](tools/Nelyx.FrameworkToTypeScript/src/paths.ts)는 출력 경로를 `.tmp/work5`·`.tmp/work6`로 제한하고, [coverage.ts](tools/Nelyx.FrameworkToTypeScript/src/coverage.ts)는 core의 tsconfig·exports·source root를 기준으로 분석한다. [selection.ts](tools/Nelyx.FrameworkToTypeScript/src/selection.ts)의 import mapping도 상대 `.ts` 경로만 허용한다. W8에서는 새 배치 작업 경로, 제품 반영 단계, 여러 패키지의 목적지 분석과 공개 subpath mapping을 정식 지원해야 한다.

따라서 새 도구를 처음부터 별도로 만들지 않고 **기존 analyzer·inventory·hash·coverage 기반에 resolved 실행 IR, TS emitter, 배치 실행·재개·병합 기능을 추가**한다. C# 경로는 기존 구현의 비교·참조용으로 유지하되 Flutter → Doroti C# → TS의 연쇄 변환을 기본 경로로 삼지 않는다. Nelyx 제품 빌드·실행은 DorotiLab·Dart·이식 도구를 요구하지 않는다.

### 1.3 DorotiLab에서 확인하고 가져올 방식

다음은 로컬 DorotiLab의 현재 파일을 읽어 확인한 구조다. 해당 제품의 모든 기능·플랫폼 수락이 끝났다는 의미는 아니다.

| 확인한 파일 | 적용할 방식 |
| --- | --- |
| [Doroti 디자인 패키지](../DorotiLab/packages/README.md), [Material 프로젝트](../DorotiLab/packages/Doroti.Material/Doroti.Material.csproj), [Cupertino 프로젝트](../DorotiLab/packages/Doroti.Cupertino/Doroti.Cupertino.csproj) | core와 디자인 구현의 물리적 소유권·패키지·버전 분리. Material은 필요한 Cupertino 구현을 소비할 수 있고 역방향 의존은 금지 |
| [현재 플랫폼 분리 기록](../DorotiLab/Doroti/docs/migrations/design-platform/README.md), [Web provider](../DorotiLab/packages/platforms/web/README.md) | 공통 계약과 플랫폼 runtime·개발 도구의 분리, provider별 공급과 호환 범위 |
| [DartToCSharp 도구](../DorotiLab/tools/Doroti.DartToCSharp/README.md), `src/Application/PortCompiler.cs` | resolved 분석·IR·구조화 emitter, generated base와 수동 입력의 합성, 재생성·adoption 상태 관리 |

Doroti의 `packages/README.md`에는 플랫폼 이동을 pending으로 표현한 과거 설명이 남아 있지만, 현재 migration 기록과 실제 `packages/platforms/`에는 provider가 존재한다. 계획은 실제 소유 파일과 현재 기록을 기준으로 한다. C# partial class·NuGet·MSBuild 구조를 TypeScript에 그대로 복제하지 않는다.

## 2. W7 종료와 범위 승계

**W7은 `CLOSED / SUPERSEDED BY W8`로 닫았고, 미완료 제품 범위를 W8로 승계했다.** W7-01~14를 먼저 수동으로 전부 완성한 뒤에야 자동화를 시작하는 순서는 채택하지 않는다.

- W8-00에서 실제 현황·잔여 담당·checkpoint 연결을 확인하고 work7의 문서 상태와 재개 안내를 갱신했다. 기존 실행 기록과 실패 증거는 보존한다.
- W7 문서 종료는 구현 완료나 전체 제품 PASS가 아니다. 제품은 PARTIAL이고 W8이 전체 잔여의 실행 기준이 된다.
- W7 중단점의 새 일반 sliver 구현에는 현재 native/archive 재공급이 없다. Windows 최신 UI도 당시 native Computer Use pipe 문제로 notVerified다. 기존 설치본·선행 UI 관찰을 새 코드의 수락으로 승계하지 않는다.
- 기존 pin·공개 기능·필수 내부 의존성·deprecated/conditional API·외부 dependency·전체 대상 locale 범위를 유지한다. 자동화가 어렵다는 이유로 제외하지 않는다.
- Windows·Android·Web은 실제 실행·입력/IME·reader·성능/복구·개발 갱신·최종 공급 수락 대상이다.
- iOS·macOS·Linux는 실제 port·등록·호출·오류·수명·runner/template·배포 코드까지 구성한다. 기존 사용자 결정대로 전용 native build/run·물리 입력·서명·전용 harness는 **SKIPPED**, provider는 **notVerified**로 기록한다. 공통 TS 검사는 유지한다.
- Dart VM/ABI 및 기존 Flutter plugin의 무수정 호환은 새 목표로 추가하지 않는다. UI가 관찰하는 의미는 자동 규칙 또는 명시한 Nelyx port로 처리한다.

W7-01~14의 구체적인 W8 담당은 §7에 모두 배정한다. 어떤 항목도 “자동생성 예정”이라는 말만으로 완료 처리하지 않는다.

## 3. 목표 패키지 구조

### 3.1 core·디자인·플랫폼의 소유권

기존 core/SDK/Skia/CLI/Metro의 패키지 정체성은 유지하면서, **디자인과 플랫폼 provider를 별도 패키지로 분리**한다. core 내부 foundation/rendering/widgets 등의 모듈 구분은 유지한다. 이번 단계에서 모든 계층을 수십 개의 npm 패키지로 다시 나누는 작업은 추가하지 않는다.

아래는 **목표 경로와 패키지 이름**이다. 선정 Material/Cupertino와 tooling-contracts 분리는 반영했다. localizations 및 여섯 플랫폼 runtime/tooling 패키지의 최종 물리 분리는 남아 있으며, 목표 트리 전체가 생성·수락된 것은 아니다.

```text
Nelyx/
  src/                            @nelyx/core: UI·공통 framework·host 계약
  sdk/                            @nelyx/sdk: 앱/View 조합·provider 수명
    tooling/contracts/            @nelyx/tooling-contracts: 도구 계약
    tooling/cli/                  @nelyx/cli: 공통 명령·provider 도구 선택
    tooling/metro/                @nelyx/metro: 공통 resolver·asset·refresh
  skia/packages/{rn,web}/          기존 @nelyx/skia-rn / @nelyx/skia-web
  migration/                      추적할 배치·mapping·보정·반영 상태
  upstream/                       고정 원본·coverage·출처
packages/
  material/                       @nelyx/material
  cupertino/                      @nelyx/cupertino
  localizations/                  @nelyx/localizations: 선택형 전체 locale
  platforms/
    windows/{runtime,tooling}/     @nelyx/host-windows / @nelyx/tool-windows
    android/{runtime,tooling}/     @nelyx/host-android / @nelyx/tool-android
    web/{runtime,tooling}/         @nelyx/host-web / @nelyx/tool-web
    ios/{runtime,tooling}/         @nelyx/host-ios / @nelyx/tool-ios
    macos/{runtime,tooling}/        @nelyx/host-macos / @nelyx/tool-macos
    linux/{runtime,tooling}/        @nelyx/host-linux / @nelyx/tool-linux
tools/Nelyx.FrameworkToTypeScript/ 개발 전용 analyzer·IR·변환·batch
sample/nelyx-testbed-app/          현행 sample 위치 유지
.tmp/work8/                       재생성 가능한 base·effective·cache·log
```

각 디자인 패키지는 `package.json`, tsconfig, `src/`, `dist/`, README, license/notice와 필요한 assets를 소유한다. runtime/tooling도 별도 package manifest와 supply identity를 가진다. 생성기 설정·수동 보정 입력은 `tools/Nelyx.FrameworkToTypeScript/data/`에 추적하고 앱 build input이 `.tmp`를 요구하게 만들지 않는다.

### 3.2 의존성 규칙

| 소비자 | 허용할 주요 의존성 | 금지할 역방향·암묵 의존 |
| --- | --- | --- |
| core | 공통 TS 기능·실제 공통 계약 | Material/Cupertino·SDK·React·특정 OS runtime·변환기 |
| Cupertino | core, 검토한 외부 공통 라이브러리 | Material·특정 host |
| Material | core, 고정 Flutter 의존성이 요구하는 Cupertino | core를 통해 디자인을 우회 로드하는 경로 |
| localizations | core·해당 디자인의 localization 계약 | core/디자인이 전체 locale 패키지를 역으로 요구하는 cycle |
| SDK·Skia | core 계약, 필요한 renderer/runtime API | 디자인 패키지, build용 Dart/analyzer |
| host-* | core/SDK의 공통 host 계약, 필요한 Skia backend·OS binding | 다른 OS host, 플랫폼 build 도구의 runtime 로드 |
| tool-* | tooling-contracts, 해당 OS build/pack 실행 도구 | host 모듈의 import/초기화로 native runtime을 띄우는 경로 |
| CLI·Metro | 공통 도구 계약·선택된 tool/profile | 모든 host/tool을 항상 설치·로드하는 고정 결합 |

Material → Cupertino는 실제 참조가 필요한 모듈에만 연결한다. 현재 소형 Cupertino 구현이 Material에 의존하는 것으로 오인하지 않는다. CLI는 provider descriptor로 선택한 tool을 실행하며 runtime host를 로드하지 않는다. 공통 계약은 작은 `@nelyx/tooling-contracts`가 소유해 tool → CLI → tool cycle을 막는다.

디자인 패키지는 core의 호환 범위를 peer contract로 선언하고 개발 시 workspace의 동일 core를 소비한다. 지원 범위는 실제 후보 소비 결과로 정한다. 같은 이름의 Widget/State/Key가 서로 다른 core 복사본에서 만들어져 identity가 갈리는 설치를 거절한다.

### 3.3 이동 범위와 호환 이행

- 선정된 소형 Material/Cupertino 구성은 `packages/material/src/widgets.ts`와 `packages/cupertino/src/widgets.ts`로 옮겼고 core의 옛 디자인 모듈·exports를 제거했다. 이후 원본 library별 direct module과 전체 family로 확장한다. 이 이동만으로 Flutter 디자인 family 완료로 표시하지 않는다.
- `widgets/app-data.ts`의 현재 공통 Theme/ThemeData와 실제 Flutter Material Theme·CupertinoTheme를 구분한다. 디자인 전용 구현을 core에 남기거나 동일 이름만으로 canonical API에 대응하지 않는다. 공통 theme adapter의 소비자도 함께 이행한다.
- 공통 WidgetsLocalizations·locale resolution은 core, 각 디자인의 localization 계약과 기본 문구는 해당 디자인, Flutter 전체 번역 delegate·locale data는 선택형 localizations가 소유한다. 디자인이 전체 번역 패키지를 필수 의존하지 않는다.
- 디자인/locale/icon/shader 자산과 notice는 소유 패키지 또는 명시한 앱 자산으로 공급한다. 샘플이 폰트를 우연히 설치한 상태를 패키지 기본 동작으로 오인하지 않는다.
- OS window/editor/input/service bridge와 플랫폼 build 코드는 provider가, Skia replay/text/GPU·ABI 코드는 Skia가 소유한다. 현재 native header/ViewApi 결합을 먼저 조사하고 파일·symbol마다 단일 소유자를 정한다. 이동으로 native supplier/cohort 검사를 약화하지 않는다.
- 패키지 내부 상대 import는 `.ts`, 산출 ESM/declaration의 상대 참조는 `.js`를 유지한다. 패키지 간에는 공개 direct subpath를 사용하며 barrel/re-export를 만들지 않는다.
- 예: 기존 `@nelyx/core/framework/material/widgets` 소비는 새 디자인 direct subpath로 수정한다. core에 새 디자인을 재수출하는 호환 facade는 만들지 않는다. breaking version·migration 안내·sample/template를 같은 통합 지점에서 이행한다.
- root workspaces·lock, `build-packages.mjs`의 고정 4개 경로, coverage의 core 전용 분석, CLI/Metro resolver의 고정 패키지 목록, provider 생성·template 동기화·runner 공급을 함께 갱신한다. source 조건과 dist 조건이 서로 다른 core identity를 로드하지 않게 확인한다.
- 목적지 package/module 이동은 기존 qualified source ID를 바꾸지 않는다. 목적지 schema에 package owner를 추가하고 실제 exports·constructor/factory·getter/setter·protected/private compiler identity를 새 위치에서 확인한다. import mapping은 패키지 내부 상대 `.ts`와 패키지 간 공개 subpath를 구분해 검증한다.

## 4. 자동생성·수동 수정 정책

### 4.1 생성과 반영을 기본 경로로 전환

1. 고정 source·lock·도구·package mapping으로 배치를 결정한다. 대상은 파일 수가 아니라 source library와 필요한 의존성 closure다.
2. resolved AST를 실행 본문·형식·참조 identity가 있는 typed IR로 만든다. 기존 inventory ID와 연결하지만 inventory를 실행 IR로 가장하지 않는다.
3. 의미 lowering → 구조화 TS AST → 실제 direct import·source map·diagnostic·출처를 생성한다. regex 치환으로 Dart 문법만 바꾸지 않는다.
4. 기존 수락 구현·수동 port·새 생성 결과를 합성한 effective package를 만든다. 공통 dependency와 import cycle을 포함해 검사한다.
5. 정해진 배치 수락을 통과하면 생성 소유 제품 파일과 package/mapping/출처 상태를 **일괄 자동 반영**한다. 선언마다 수동 승인·복사를 요구하지 않는다.
6. 미지원 의미·충돌·실패만 수동으로 보정한다. 같은 원인의 미지원이 많으면 개별 파일 수정보다 변환 규칙 하나를 고쳐 해당 배치를 다시 생성한다.

생성 TS가 최종 제품 소스가 되는 것을 허용한다. 제품 `src/`는 일반 빌드가 읽는 추적 가능한 소스이며 Dart·generator·scratch 없이 빌드한다. 초안 생성만 반복하고 제품 반영을 끝없이 미루는 운영으로 되돌아가지 않는다.

### 4.2 생성 후 직접 수정과 재생성

TypeScript에는 C# partial class 합성을 그대로 적용하지 않는다. **파일 단위 소유권을 기본으로** 하고 기존 여러 선언이 섞인 수동 파일을 임의의 member 치환으로 덮어쓰지 않는다.

| 소유 방식 | 처리 |
| --- | --- |
| generated | 수정이 없는 생성 파일은 다음 수락 결과로 자동 교체 가능 |
| generated + local edits | 제품 파일 직접 수정을 허용. 이전 generated base·현재 제품·새 generated 결과의 3-way 병합으로 보존 |
| replacement/adopted | 기존 검토 구현이나 전체 파일 수동 교체가 authoritative. 새 생성 결과와 차이를 보여주되 자동 덮어쓰지 않음 |
| native/host adapter | Dart의 engine/OS 결합을 실제 Nelyx 계약으로 구현. 생성된 호출은 명시한 adapter mapping으로 연결 |

소유 manifest에는 qualified source ID, 목적지 package/module, origin mode, base fingerprint, 현재 제품 hash, 보정 입력·규칙 버전을 기록한다. 직접 수정은 다음 배치 시작 시 diff로 포착하고 재현 가능한 보정 입력 또는 adopted 파일로 추적한다. 현재 제품 파일의 수정은 그대로 허용한다.

generated base/effective/cache/log는 `.tmp/work8/`에 두어도 된다. **수동 입력과 재생성 recipe·반영 state는 추적 파일로 남긴다.** 이전 base는 pin+tool/lock+selection+mapping fingerprint로 재현 가능해야 하며 해당 도구 기준도 Git으로 특정한다. cache가 없어 재현할 수 없으면 현재 수정 파일을 유지하고 충돌로 보고한다. cache 유실을 이유로 수동 수정을 덮어쓰지 않는다.

반영 직전에 제품 hash를 다시 확인해 생성 중 IDE 수정도 보호한다. 파일 목록·삭제·이동은 소유 manifest로 제한하고 staging/backup으로 부분 반영을 복구한다. 다른 배치와 같은 제품 파일을 동시에 반영하지 않는다. 기존 W6/W7 one-shot adopt/audit writer는 새 배치 재개 명령으로 재사용하지 않는다.

### 4.3 자동으로 처리할 의미와 수동 port 경계

| 영역 | 규칙으로 자동화할 내용·주의점 |
| --- | --- |
| 선언·호출 | nullability, named/default 인자, named/factory constructor, getter/setter, enum/operator, callback identity, 원본 평가 순서 |
| 객체·형식 | inheritance/override/super, mixin 순서와 super 해석, generic 및 `is/as` runtime token, library-private/part identity |
| 값·컬렉션 | Dart 값 equality/hash, Map/Set key 의미, const identity가 관찰되는 경로, numeric/bit·division·remainder, Duration 단위 |
| 제어·비동기 | statements/closure/initializer, async/Future/Stream·취소·오류·UI가 관찰하는 callback/microtask 순서 |
| framework 결합 | 기존 Element/RenderObject/scheduler/owner 계약, 실제 구현에 대한 symbol mapping, paint/text/semantics adapter |
| 대량 데이터 | icon·theme token·localization·상수 family를 pin·생성 규칙·font/asset notice와 함께 처리 |

전 항목을 범용 언어 compiler로 완성한 뒤 제품 작업을 시작하지 않는다. 첫 실제 묶음에 필요한 규칙부터 추가하고 이후 전체 스캔의 공통 blocker를 우선 해소한다. 기존 수락된 구현·동작은 mapping으로 재사용한다.

engine external/native/DOM/IME/GPU·VM 특수 API는 실제 port가 필요하다. 아직 없는 의미를 `any`·빈 메서드·항상 성공·임의 기본값·출시용 throwing stub으로 대체하지 않는다. 미지원 단위는 diagnostic과 누락 의존성을 남기고 제품 반영에서 제외한다. 다른 독립 배치는 계속 처리한다. 실제 dependency closure가 해결되지 않은 단위는 생성 파일이 있어도 수락하지 않는다.

## 5. 일괄 실행 방식

### 5.1 전체 대상을 한 번에 계획하고 묶음으로 실행

고정 inventory의 모든 필수 대상에 package owner와 실행 방식을 배정한다. 과거 W6/W7 ID는 유지하고 W8 배치 담당을 추가한다. 기존 adapted/implemented 구현은 유지·보정·재생성 대상을 구분한다.

**의존성 graph의 강결합 묶음(SCC)과 실제 import 초기화 경계를 함께 고려**해 순서를 정한다. member마다 별도 파일·작업·수락을 생성하지 않는다. private dependency, conditional branch, 외부 dependency를 closure에 포함하고 runtime에 맞는 branch·adapter를 고정한다.

첫 자동생성 묶음은 **누락된 geometry/MatrixUtils 계열 + animation/physics 계열 + 상수/데이터 계열**에서 실제 원본과 기존 core mapping을 사용해 선택한다. 빈 예제 클래스만 변환해 emitter 완료로 판정하지 않는다. 이후에는 다음 순서로 처리한다.

1. 공통 foundation/math/animation/physics 및 기존 framework와 연결할 수 있는 누락.
2. rendering/painting/widgets의 scroll·layout·text·input·app closure.
3. Cupertino·Material·localizations와 연결되는 공통 위젯.
4. engine/OS 결합·고급 편집/접근성/native composition의 수동 port와 생성 코드 연결.

전체 스캔과 지원 가능한 배치 실행을 제공하되 **모든 원본이 첫 실행에 완전 변환된다고 가정하지 않는다.** unsupported 이유를 공통 규칙별로 모아 수정 후 이어 간다. 74,297행을 생성 파일 수나 완료 개수로 제시하지 않는다.

### 5.2 재개·cache·반영 상태

아래 상태는 **새 배치 상태**이며 기존 coverage의 implementation 상태를 대체하지 않는다.

```text
planned → analyzed → generated → composed → validated → promoted
                    ↘ blocked-semantic / manual-port-required
                                   ↘ conflict / failed
unchanged: 정확한 fingerprint와 유효한 수락이 같은 배치만 재사용
```

cache key에는 source pin/bytes·Dart/analyzer lock·IR/lowering 버전·TS compiler·package/adapter mapping·수동 입력·영향 의존성을 포함한다. 배치별 산출과 실패를 분리하고 재개 시 실패/변경 배치와 영향을 받은 dependent만 다시 실행한다. 분석·생성은 제한된 worker로 병렬화하고 최종 report/제품 반영은 단일 소유자로 처리한다.

필요한 명령 기능은 **scan/plan, generate, compose, validate, promote, resume, compare**다. 기존 `port` 진입점을 확장하며 CLI 철자·옵션은 구현과 문서를 함께 확정한다. 이 문서에 아직 없는 실행 명령을 현행 명령처럼 적지 않는다. 배치 상태·coverage 요약·짧은 인계 하나를 사용하며 별도 dashboard나 반복 보고 체계는 만들지 않는다.

## 6. 구현 순서와 종료 조건

| ID | 함께 수행할 작업 | 그 단계의 종료 조건 |
| --- | --- | --- |
| W8-00 | 현재 diff/checkpoint 확인, 기존 478파일·pending 출처의 기준 보존, 전체 W7 잔여 배정, W7 문서 종료/승계 | W7은 CLOSED/SUPERSEDED, 제품 PARTIAL; 모든 잔여의 담당·유효 증거·다음 시작점이 W8에 연결 |
| W8-01 | 디자인 소유권 이동, core/디자인/theme/localization 경계, 다중 package build·coverage·resolver, provider/tool 계약과 목적지 소유 inventory | core-only/Cupertino/Material/both 소비가 실제 분리되고 단일 core identity 유지. 기존 선정 디자인 흐름 동작; 플랫폼 파일의 새 소유 경계 확정 |
| W8-02 | resolved body IR·TS lowering/emitter, 새 scratch 경로, batch/compose/promote/resume, 기존 수동 구현 mapping과 직접 수정 병합 | 첫 실제 Flutter 묶음이 생성→검증→제품 반영까지 통과. 동일 입력 재생성 결과 안정, 수동 수정 보존·충돌·실패 재개 확인 |
| W8-03 | 전체 inventory 계획·지원 배치 일괄 실행, 공통 미지원 규칙 보강, dependency/conditional/external mapping | 모든 필수 대상이 배치 또는 수동 port 담당을 가지며 독립 지원 배치가 자동 반영됨. 누락·실패는 명시하고 후속 구현에서 계속 해소 |
| W8-04 | W7-06 중단점: MatrixUtils·reveal/ensureVisible·layout flush, scrollbar/overscroll·restoration·selection auto-scroll·나머지 animation/transition | 실제 mixed 10,000 가변 list/grid의 mutation·key/State·위치·fling·resize·hidden/resume·close 통합 흐름, 원본 비교·출처 반영·wide/phone Web 수락 |
| W8-05 | W7-01~04 잔여: binding/service·worker·image/layer/effect/asset·rich text/selection·pointer/gesture/focus/key의 전체 미완료 계약 | 공통 서비스→합성/본문→입력 흐름에서 생성 결과와 실제 backend/owner 연결. 과거 선정 PASS 밖의 잔여 구현·목적지 검토 완료 |
| W8-06 | 편집/Form/IME·autofill/undo/toolbar·caret reveal, Page/NestedScroll/header/refresh/reorder/2D/tree/zoom | 여러 필드 편집→검증/제출 및 고급 scroll 사용자 흐름 통합. 실제 IME 관찰은 누적하고 부족한 환경 수락은 W8-11에 연결 |
| W8-07 | WidgetsApp/route/router/deep link/Back·Overlay/Hero/restoration, async/state 위젯, locale resolution·semantics bridge | link→nested route/form/list→dialog→Back/복원→환경/locale 변경→접근성 action까지 연결 |
| W8-08 | 독립 Material/Cupertino의 전체 family·theme/control/form·복합 UI/adaptive, 전체 locale·icon/data·asset 공급 | Material 업무 흐름과 Cupertino tab/form/picker/back을 실제 소비. 고정 inventory의 디자인·locale 잔여를 해소하며 ko/en 예시만으로 완료하지 않음 |
| W8-09 | 플랫폼 runtime/tooling 실제 패키지 이동, SDK/CLI/Metro의 선택형 provider, native view/texture/menu·OS 잔여·Apple/Linux 코드 | Windows/Android/Web의 실제 composition·입력·수명·provider 공급 연결. 여섯 target 코드·등록·runner/template 완결; Apple/Linux native 검증 SKIPPED 유지 |
| W8-10 | inspector/source map/preview·service extension·state-preserving reassemble와 reload, 이식 후 개발 갱신 | 실제 Web 수정/State 유지·필요한 remount와 Windows/Android native reload·cleanup을 관찰. 최종 디자인·provider 구조에서 실행 |
| W8-11 | Windows/Android/Web 기능·물리 IME·reader·성능·복구의 최종 후보 수락 | 합의한 실제 환경의 필수 수락 완료. 자동화·emulator·submit/retire와 물리 입력/FPS/scanout 증거 구분 |
| W8-12 | mandatory coverage/dependency 최종 감사, 전 패키지 버전/range·6 target 공급, 외부 앱·배포·license/notice·정리 | §9의 제품 완료 조건 충족. 보존/제거한 증거를 정확히 기록하고 잔여가 있으면 PARTIAL 유지 |

**실행 우선순위:** W8-00 → 01 → 02 → 03의 첫 일괄 반영 → 04로 빠르게 실제 기능에 연결한다. W8-03의 전체 미지원 해소가 끝나야 04를 시작하는 gate는 두지 않는다. 04~10에서는 생성과 보정을 반복하며 공통 blocker를 도구에 환류한다. 디자인은 필요한 core closure가 준비되는 순서로 생성·연결한다.

W8-01은 디자인과 도구 계약을 먼저 분리한다. OS별 native 파일의 실제 이동·runtime/tooling 분리는 W8-09에서 해당 backend·공급을 함께 수락한다. 그 전에 native/API가 바뀌면 영향 target의 설치/실행 확인을 앞당긴다. 플랫폼 확인을 마지막까지 전부 미루지 않는다.

### 6.1 W8-04에서 반드시 이어받을 중단점

1. `qualified-source/43-matrix_utils.dart`는 확보만 했고 `matrix-utils.ts` 구현은 없다. 자동화 규칙이 준비되면 이 실제 closure에 사용하고 필요한 adapter를 보정한다.
2. `RenderAbstractViewport/RevealedOffset` → viewport `getOffsetToReveal/scrollOffsetOf/maxScrollObstructionExtentBefore/showInViewport` → `ScrollPosition.ensureVisible/Scrollable.ensureVisible`를 연결한다.
3. 기존 finite scroll·`RenderObject.showOnScreen(rect)`·EditableText와 호환시킨다. Root focus reveal은 widget dirty가 없어도 render layout dirty를 flush해야 하는 문제를 포함한다.
4. 현재 fixture의 `scrollbars:false, overscroll:false` 및 non-null restorationId 거절을 실제 default chrome·복원 구현으로 해소한다. reader collection metadata도 별도 미완료다.
5. 이번 general-sliver cohort의 source span/adoption/hash/public coverage·새 curve/sliver/layout 원본 비교·실제 mixed browser 장면을 완료한다. checkpoint의 선행 `sourceReview/sourceAudit`를 이번 cohort PASS로 복사하지 않는다.

## 7. W7 잔여 전체 이관표

| W7 | 승계할 잔여 범위 | W8 담당 |
| --- | --- | --- |
| 01 | ServicesBinding/SystemChannels·native/DOM update·OS/worker/default owner·plugin·서비스 전체 계약 | 03·05·07·09, 실제 환경 11 |
| 02 | paint/layer/filter/shader/image/decoration·retained/GPU/restore·실제 합성·자원 수명 | 03·05·09, 복구/성능 11 |
| 03 | text/font/selection 전체 member·고급 typography/selection·native pixels/lease | 03·05·06, 물리/reader 11 |
| 04 | pointer/gesture/focus/key 전체 계약·native physical packet/handled·late input·UIA/reader | 03·05·06·09·11 |
| 05 | controller/delta/RenderEditable·formatter/undo/autofill·Form·IME/selection UI | 06, native 09, 실제 IME 11 |
| 06 | 현재 reveal 중단점·일반 sliver/scroll owner·animation/listener/Tween/Curve/transition·출처/장면 수락 | 02~04, 소비 보정 06~08 |
| 07 | page/nested/header/refresh/reorder/dismiss/sheet/wheel/2D/tree/zoom | 03·06·08 |
| 08 | app/route/router/overlay/restoration·async/state·전체 locale·semantics | 03·07·08, bridge/reader 09·11 |
| 09 | Material 기반/theme/shell·모든 control·폼·state/adaptive | 01~03·08 |
| 10 | Material 복합 UI·Cupertino 전체 family·localization/icon/asset | 01~03·08 |
| 11 | native/HTML view/texture/menu·live composition·남은 서비스·여섯 target 코드 | 09, 실제 수락 11 |
| 12 | hot reload/reassemble·inspector/preview·source/오류/성능 진단·native reload 공급 | 10, package 연결 01·09·12 |
| 13 | Windows/Android/Web 실제 입력/IME/reader·성능/FPS/복구·기기/환경별 수락 | 각 기능에서 누적, 최종 11 |
| 14 | 전체 mandatory coverage·dependency·최종 archive/외부 소비·서명/배포/clean-machine·notice·정리 | 12; 기능 누락은 03~10 담당으로 반환 |

W7 §7의 W6 이관표와 현재 coverage `task/required/dependencies`도 함께 유지한다. 위의 사용자 흐름 예시 밖에 있는 필수 member·private closure·deprecated API·조건부 구현·외부 라이브러리·locale를 자동 제외하지 않는다.

## 8. 검증과 공급을 묶는 시점

### 8.1 자동생성 수락과 기능 수락

| 시점 | 필요한 확인 | 결과의 의미 |
| --- | --- | --- |
| 도구 규칙/첫 배치 | 실제 고정 Dart source → IR/emit/합성, 의미가 달라지기 쉬운 대표 경계, deterministic 결과·수동 수정 보존·실패 재개 | 해당 규칙/배치의 자동 반영 가능. 전체 framework 완료 아님 |
| 기능 묶음 종료 | 변경 package types/build, 해당 source 의미·목표 UI 흐름·인접 수명/오류 회귀, 영향 backend | 해당 사용자 결과 수락. 무관한 과거 전체 oracle/native 재공급을 반복하지 않음 |
| 패키지 구조·공급 변경 | 실제 packed direct import/ESM/declaration, core-only/Cupertino/Material/both, resolver/Metro/Hermes 영향, 관련 runner 설치본 | workspace 우회 없는 소비와 core identity·선택형 의존 확인 |
| 최종 제품 후보 | Windows/Android/Web 실제 기능·IME/reader·성능/복구, 최종 외부 소비·배포 | 전체 제품 판정의 근거. 과거 scoped PASS를 현재 후보로 확대하지 않음 |

auto-generated·typecheck PASS만으로 coverage를 adapted/implemented로 승격하지 않는다. **검증한 lowering 규칙, 실제 source/destination identity, 해당 배치의 의미·소비 수락**이 연결되면 자동으로 evidence와 상태를 반영할 수 있다. 사람이 모든 member를 따로 승인하는 절차는 강제하지 않는다. 미검토·미지원 의미는 missing/partial로 남기며 과거 evidence는 당시 hash 범위를 유지한다.

같은 의미의 단순 getter/상수/스타일마다 독립 Dart oracle·native 앱·수백 번의 반복을 만들지 않는다. 원본 비교는 equality/numeric/constructor/mixin·callback 순서·layout 등 의미 위험이 큰 규칙과 관련 묶음에 집중한다. OS bridge는 원본 scalar 비교만으로 수락하지 않고 실제 연결을 확인한다.

### 8.2 통합 지점

- **I1 — W8-01~04:** 새 패키지 소비·첫 일괄 생성/재생성·현재 scroll 통합 장면·출처 정리. 같은 세션에서 이미 유효하게 통과한 확인은 재사용한다.
- **I2 — W8-05~08:** 편집·고급 scroll·route·디자인·전체 locale의 앱 통합. 필요한 core/SDK/디자인/Skia·provider range와 설치 공급을 한 후보로 맞춘다.
- **I3 — W8-09~10:** 최종 provider/runtime/tooling 구조·실제 native view·개발 갱신·package 소비. 여섯 target의 공급 구성을 함께 이행한다.
- **최종 — W8-11~12:** 최종 설치 후보와 repository 밖 앱에서 필수 실제 환경·배포 수락. signing/clean-machine/물리 장비가 필요한 잔여는 정확히 기록한다.

개발 중에는 workspace를 우선 사용한다. 실제 runner가 archive를 요구하면 그 target의 관련 패키지만 갱신해 현재 코드를 실행한다. 매 배치마다 버전 변경·여섯 target archive·fresh 외부 앱을 반복하지 않는다. 패키지/ABI/wire/cohort가 바뀐 통합 지점에서는 관련 version/range/peer·provider·CLI/Metro·template·lock·native supplier를 함께 이행한다. 동일 version의 서로 다른 archive가 캐시에서 섞이지 않게 기존 공급 identity를 유지한다.

### 8.3 현행 명령과 비용 제한

다음은 현재 실제 존재하는 명령이다. W8에서 새 패키지와 스크립트를 추가하면 이 목록도 실제 상태에 맞게 갱신한다.

```powershell
npm.cmd run check:types
npm.cmd run build:core
npm.cmd run build:sdk
npm.cmd run check:cli-types
npm.cmd run check:metro-types
git diff --check
```

`build:sdk`는 core·Skia·SDK build와 provider/CLI 준비를 포함한다. 앞뒤에 같은 build를 중복하지 않는다. export/resolver 변경 시 실제 `.ts` source·`.js` ESM/declaration·Metro/Hermes 소비를 확인하고, wire/native ownership 변경은 대응 backend의 좁은 경계 검사를 먼저 한다.

저장소 [.github/copilot-instructions.md](.github/copilot-instructions.md)에 따라 **테스트 timeout은 20분(1,200초)**이며 동일 시나리오 반복은 대부분 30회 이내로 한다. 배치 실행은 단계별 종료/재개를 지원해 무제한 프로세스를 두지 않는다. 실패 수정·새 변경·무효화된 증거가 있을 때만 관련 검사를 다시 실행한다. 문서만 수정한 이번 검토에서는 제품 build/runtime 테스트를 반복하지 않았다.

## 9. 완료 판정과 기록

### 9.1 서로 다른 완료 조건

- **W7 문서 종료:** 이관표·checkpoint·담당과 PARTIAL 경계를 보존하고 CLOSED/SUPERSEDED를 반영했다.
- **자동화 기반 완료:** 실제 Flutter 배치가 분석→생성→합성→검증→제품 반영되며, 생성 후 직접 수정·재생성·충돌·재개·출처가 재현된다. 자동화 기반 완료가 전체 이식 완료는 아니다.
- **패키지 분리 완료:** core에 디자인/OS provider 역의존이 없고 각 구현·asset·native/tool의 단일 소유권·독립 버전·실제 packed 소비·선택형 template/runner가 작동한다.
- **기능 완료:** 고정 inventory의 필수 missing/partial과 미연결 dependency가 0이며 adapted/notApplicable에 근거가 있다. 생성·수동 구현 모두 포함해 여섯 target 코드 구성을 완료했다.
- **W8 전체 완료:** 기능·패키지 완료와 Windows/Android/Web의 필수 실제 실행·IME·reader·성능/복구·개발 갱신·외부 소비·배포/notice 수락을 완료했다. Apple/Linux는 코드 구성과 사용자 지정 SKIPPED/provider notVerified를 정확히 기록했다.

생성량·타입 검사·선정 UI 흐름·과거 설치 증거만으로 전체 완료를 선언하지 않는다. PASS / PARTIAL / FAIL / SKIPPED / notVerified를 구분한다. W7 문서 종료 후에도 W8 전체 미완료가 남으면 제품 상태는 PARTIAL이다.

### 9.2 짧은 실행 기록

세션은 여러 파트를 연결한 사용자 결과 단위로 운영한다. 배치마다 장문 보고서를 추가하지 않고 아래 형식으로 한 번 기록한다.

```text
목표 / W8 담당 / 배치·패키지:
자동 반영한 범위 / 수동 보정한 공통 원인:
사용자 결과 / source·tool·product 식별:
수락: 명령·환경 / PASS·PARTIAL·FAIL:
잔여: blocker·notVerified·SKIPPED / 다음 담당:
다음 시작점 / 재개 state / 보존할 입력·증거:
```

전체 inventory 분석은 source pin·frontend/lock·schema가 바뀌거나 최종 감사가 필요할 때 수행한다. 분석 입력이 같으면 resolved cache를 재사용한다. 일반 파일 수정마다 전체 source/hash·모든 과거 oracle·모든 설치형 수락을 반복하지 않는다. 중간 failure log와 cache는 재사용하고, 단계 종료 때만 소유 allowlist와 실제 절대경로를 확인해 정리한다. `.tmp/work6`·`.tmp/work7`의 현재 인계/qualified source를 초기 정리 대상으로 삼지 않는다.

### 9.3 재개 시 읽을 최소 자료

1. 이 문서 **§0·10.23**, W8 pause checkpoint (보관된 과거 기록 `pause-checkpoint.json`), selection 진행 기록 (보관된 과거 기록 `selection-progress.json`)과 현재 Git/dirty 상태.
2. 해당 작업의 제품/도구 파일과 source pin, 관련 `framework-imports.json` selection·coverage subset 및 immutable receipt. 새 DOM provider는 runtime notVerified 상태에서 시작한다.
3. W8-04의 일반 sliver/reveal 잔여를 작업할 때 [work7 §9.45](work7.md), [당시 pause checkpoint](.tmp/work7/sliver-viewport/pause-checkpoint.json), [resume 기록](.tmp/work7/sliver-viewport/resume-progress.md)을 함께 읽는다.
4. `before-viewport-reveal/`과 `qualified-source/43-matrix_utils.dart`는 W8-04의 기준으로 보존한다. 이전 strict checkpoint는 과거 공급 cohort이며, 과거 실행 기록 전체나 완료된 writer를 매번 다시 실행하지 않는다.

현재 첫 재개 작업은 **DOM 메뉴 초안의 shutdown ingress 차단과 실제 수명/입력 검증**이다. W7 종료/이관·선정 디자인 분리·첫 자동 배치는 이미 반영했으며, 일반 lowering·잔여 closure와 전체 제품 수락을 같은 실행 계획에서 계속한다.

## 10. 실행 기록 — 2026-10-13~14

**현재 PAUSED / 제품 PARTIAL / wholePlanComplete false.** 전체 W8 범위로 착수했고 사용자 요청으로 §10.23에서 중간 마무리했다. 아래 절의 ACTIVE·당시 수치·다음 시작점은 각 실행 시점의 이력이며 최신 상태는 §0·10.23을 따른다. pause checkpoint (보관된 과거 기록 `pause-checkpoint.json`)와 selection 진행 기록 (보관된 과거 기록 `selection-progress.json`)이 최신 소스 기준이고, 이전 strict checkpoint (보관된 과거 기록 `checkpoint.json`)는 과거 TextStyle 공급 cohort다. [배치 상태](tools/Nelyx.FrameworkToTypeScript/data/work8/state.json)와 [수동 출처](tools/Nelyx.FrameworkToTypeScript/data/work8/manual-origins.json)의 현재 hash drift도 함께 확인한다.

### 10.1 반영한 코드

- **W8-00:** 시작 HEAD `d9e0dc7`와 clean tracked 상태를 확인했다. W7 checkpoint의 제품 478파일 해시가 모두 일치함을 확인한 뒤 W7을 CLOSED/SUPERSEDED로 전환했다. W7 source snapshot·중단 기록·실패 증거를 보존하고 전체 잔여를 이관했다. 478은 착수 시 baseline이며 현재 후보 전체의 검증 개수가 아니다.
- **W8-01:** 선정 Material/Cupertino 구현을 각각 독립 패키지로 물리 이동했다. core의 해당 exports를 제거하고 sample·template·resolver·실제 packed 소비를 이행했다. 공통 adapter는 `AppTheme/AppThemeData/darkAppTheme/lightAppTheme`로 이름을 구분했다. 순수 `@nelyx/tooling-contracts/provider` 계약, workspace 기반 build 탐색, package owner·공개 subpath mapping과 다중 package coverage를 추가했다. 전체 canonical theme/localization 및 플랫폼 runtime/tooling 이동은 남아 있다.
- **W8-02~03:** analyzer의 resolved 실행 본문 IR, 구조화 TS emitter, scalar/null/identity·constructor·Duration·상수 의존 순서 lowering과 명시적 unsupported 진단을 추가했다. `scan/plan/generate/compose/validate/promote/resume/compare`를 연결했다. 3-way 병합, 직접 수정의 보정 입력 포착, 단일 writer, 반영 직전 hash 재검사, journal/rollback과 cache 유실 시 보존을 구현했다. 모든 **74,297 required records / 763 libraries / 155 SCCs**에 담당을 배정했다. 실제 지원 recipe는 MatrixUtils scalar closure·physics 비교·bounce·gesture 상수의 **4개 배치 / 34 origins**이며 모두 자동 반영됐다. 그중 compiler/span/의미 수락이 맞는 **33개만** coverage에 adapted로 연결했다. private bounce의 public anchor 매핑은 남아 있다.
- **W8-04:** MatrixUtils base/adapter, RenderAbstractViewport/RevealedOffset와 viewport reveal·obstruction·showInViewport, ScrollPosition/Scrollable.ensureVisible, Root focus 후 layout flush를 연결했다. Desktop 기본 RawScrollbar의 painting·wheel·thumb drag·track tap·fade/hover와 Android/Fuchsia 기본 GlowingOverscrollIndicator의 pull/impact/recede·억제 알림을 연결했다. 공통 RestorationManager/Bucket·scope·채널 get/put/push와 scroll-end offset 저장/복원을 추가했다. EdgeDraggingAutoScroller와 CurvedAnimation/기본 constant animation adapter도 추가했다. 전체 RawScrollbar customization, RestorationMixin/property family, SelectionArea의 자동 선택 확장과 나머지 animation/transition family를 완료한 것은 아니다.
- **실제 브라우저에서 찾은 보정:** 먼 grid 이동에서 paragraph producer 64개 제한을 넘던 문제를 재현했다. 모든 lazy adaptor가 layout garbage collection 중 불필요한 inactive child를 조기에 정리하도록 고쳤다. GlobalKey의 같은 frame retake와 이미 제출한 frame resource lease는 보존했다. producer 제한을 늘리지 않았다. 통합 장면은 알려진 높이를 제공하는 `SliverVariedExtentList` 6,000 rows + grid 4,000 tiles로 구성했다. 일반 measured `SliverList` 첫 장거리 탐색 성능은 별도 잔여다.

Native 준비 스크립트가 RN 패키지의 Windows keyboard 출처 고지를 덮어쓰지 않도록 고쳤고 offline 준비 후 기존 고지 복원을 확인했다. 이 notice-only 수정은 위 runtime 검증 이후이며 전체 native binary notice 수락은 W8-12에 남아 있다.

현재 cohort: **core 0.16.0 / SDK 0.20.0 / Skia RN·Web 0.6.0 / CLI·Metro 0.10.0 / Material·Cupertino·tooling-contracts 0.1.0**. 일반 제품 build는 Dart·generator·`.tmp/work8`를 읽지 않는다. batch 도구의 실행 파일·lock·runtime·mapping·transitive dependency 해시는 기록했지만, 변경된 도구 기준을 새 Git commit으로 특정하는 작업은 수행하지 않았다. 따라서 clean Git만으로 모든 과거 base를 재현하는 조건까지 완료했다고 표시하지 않는다.

### 10.2 수락과 증거 경계

| 확인 | 결과와 범위 |
| --- | --- |
| 첫 4개 자동 배치 | PASS — 고정 실제 Dart 본문 → IR → emit → effective package types·의미 비교 → 제품 반영. 상수와 행렬·physics·bounce의 선정 scalar 수락 |
| 배치 수명 검사 | PASS 6 scenarios — 같은 입력 재사용, 직접 수정 보존, 충돌, base 유실, source drift, 검증 후 외부 수정 보호 |
| 실제 Root reveal | PASS 6 groups — 네 방향·generic/shrink viewport·정렬 정책·matrix adapter·render layout flush |
| 인접 sliver/scroll 수명 회귀 | PASS 30 groups, lazy GlobalKey 8 groups — 과거 fixture를 현재 runtime으로 실행한 해당 계약 범위 |
| 리소스 고갈 회귀 | PASS — 이전 실패 재현, 현재 producer peak 57, 이전 frame의 11 resources는 lease 반환까지 유지. 실제 font/GPU 성능 수치는 아님 |
| 기본 chrome·복원·edge scroll | PASS 9 groups — 실제 View/gesture arena·scroll positions·paint commands, 제어한 timer, 새 View 복원·live root 교체·채널 codec·route 종료 |
| scrollbar·CurvedAnimation 원본 비교 | PASS — 고정 원본의 변경 없는 thumb/track 본문 7 cases, parent mixin/CurvedAnimation 4 transitions. Metrics/Curve/driver는 명시한 scalar receiver이며 engine oracle이 아님 |
| 패키지 소비 | core-only/Cupertino/Material/both의 repository 밖 archive 설치·strict declaration·ESM·단일 core·미선택 디자인 제외를 검사. 선택형 CLI template의 별도 Web runner 4개도 검사 |
| 타입·build·경계 | core/design/contracts/Skia/SDK/sample types·관련 build·CLI/Metro declarations와 core/design/contracts 356 source files의 import/export/peer 경계를 검사 |
| Web 통합 장면 | 최신 archive의 wide/390×844에서 row State·순서/높이 mutation·offset·heading reveal·grid 이동·기본 scrollbar drag를 실제 Chrome으로 관찰. Drag 후 offset 194999, 두 번째 Grid 이동 후 Tile 3999, resize 후 extent 보정과 route 재진입을 확인했다. 현재 build 이후 console runtime errors 0. 정확한 입력 타이밍·browser hidden/resume·FPS·물리 reader·일반 measured list 수락으로 확대하지 않음 |
| Android 후보 빌드 | PASS-scoped — 현재 archive 설치·runner typecheck, x86_64 Release / emulator-vulkan APK. GraalVM JDK 21의 JdkImageTransform/jlink 실패 후 해당 build 프로세스에만 설치된 Temurin 21.0.11을 적용해 성공. 앱 실행·물리 입력·reader·production signing은 notVerified |
| 최종 설치/플랫폼 | 여섯 target 공급 설정과 Windows/Android의 새 설치·실행 수락은 다르다. 현재 Windows/Android 후보의 native·물리 IME·reader·scanout/FPS·서명/clean-machine은 notVerified. Apple/Linux 전용 native build/run/harness는 사용자 결정대로 SKIPPED, provider notVerified |

최신 coverage는 **missing 62,827 / partial 4,683 / adapted 6,778 / implemented 1 / notApplicable 8**, public 47,282, source diagnostics 0이다. qualified IDs와 mandatory scope를 유지했고 `localSnapshotMatchesPin:false`를 숨기지 않았다. 변경된 목적지의 과거 hash 수락은 무효화했다. 이름이 새로 일치한 항목과 수동 출처 29건을 자동 adapted로 올리지 않았다.

### 10.3 남은 필수 작업과 재개 경로

| 담당 | 남은 작업 |
| --- | --- |
| W8-01·09 | 전체 localization 경계·자산, 최종 여섯 host/tool 패키지 이동·선택형 SDK/CLI/Metro와 native header/ViewApi 소유 분리 |
| W8-02·03 | generic/mixin/async/collection/수치 표현 등 미지원 lowering·adapter 보강, 나머지 SCC의 실제 실행, Git으로 특정한 도구/base 재현 |
| W8-04 | 일반 sliver cohort의 전체 source adoption/audit와 추가 원본 layout/curve 비교, measured first-seek 성능, 전체 scrollbar/restoration customization·SelectionArea 자동 선택 확장·나머지 animation/transition 계약, hidden/resume/close의 전체 실제 browser 통합 |
| W8-05~08 | 전체 서비스·합성·text/font/selection·pointer/focus/key 잔여, 편집/Form/IME·고급 scroll, route/router/overlay/state 복원·semantics, Material/Cupertino 전체 family·전체 locale/icon/asset |
| W8-10~12 | 최종 패키지 구조의 state-preserving reload/reassemble·inspector, Windows/Android/Web 필수 실제 환경·성능/복구·reader 수락, mandatory coverage/dependency 0 잔여 감사·최종 배포/notice |

이 절의 시작점은 초기 실행 당시 기록이다. **현재 재개 위치는 §0·10.23과 pause checkpoint의 DOM 메뉴 수명/입력 잔여**다. 아래는 생성 배치 조작 명령이며 실행 전에 해당 입력의 현재성·충돌을 확인한다. 과거 one-shot adoption writer는 재개 명령이 아니다.

```powershell
node .tmp/work8/run.mjs bun tools/Nelyx.FrameworkToTypeScript/src/main.ts batch resume all
node .tmp/work8/run.mjs bun tools/Nelyx.FrameworkToTypeScript/src/main.ts batch scan
npm.cmd run check:types
node Nelyx/eng/check-package-boundaries.mjs
```

이전 W6/W7 scratch, 현재 generated base·effective cache, 외부 소비 앱과 `.tmp/work8`의 receipt·source oracle·브라우저 실패/성공 이미지를 보존한다. 상태는 ACTIVE/PARTIAL이며 PAUSED나 전체 완료로 바꾸지 않는다.

### 10.4 W8-04 animation·transition 추가 구현 — 2026-10-14

공통 listener mixin 4개를 재사용 가능한 TypeScript mixin으로 이식했다. 값 listener는 같은 callback의 중복 등록을 한 번 알리고, status listener는 등록 횟수대로 알리는 원본 차이를 유지한다. 알림 도중 제거·추가, 오류 보고와 lazy 구독의 시작/해제를 보존하며 AnimationController도 같은 helper를 사용한다. Proxy/Reverse/TrainHopping/Compound/Mean/Max/Min, Animatable/Tween/ReverseTween 및 전용 tween, TweenSequence, Curve2D/CatmullRomSpline/CatmullRomCurve, AnimationStyle을 추가했다. 숫자 IntTween/StepTween은 JS의 정확한 정수 범위를 검사하며 사용자 연산자는 typed interpolator로 명시한다. unrestricted Dart int 이식 완료로 표시하지 않는다.

`ui/color`에는 부동소수 Color와 sRGB·extendedSRGB·displayP3 값/변환을 추가했다. 고정 pin의 identity/clamp 동작까지 원본 실행 결과와 비교했다. 기존 Paint의 ARGB transport와 실제 wide-gamut 출력 수락은 별도 잔여다. Curve2D의 결정적 샘플링에 쓰는 Dart SDK seeded MWC는 SDK version/revision/file hash와 완전한 Dart license를 보존한다.

AnimatedWidget, 기존 direct module의 ListenableBuilder와 cached child/object options, AnimatedBuilder, slide/matrix/scale/rotation/size/fade/sliver-fade/position/relative-position/decoration/align transition을 연결했다. RenderAnimatedOpacityMixin·box/sliver opacity와 RenderProxySliver를 추가하고, Transform.filterQuality를 실제 retained ImageFilterLayer로 연결했다. DefaultTextStyleTransition, implicit animation, 전체 instrumentation·정수 adapter·일반 sliver/selection 계약은 남아 있다.

| 추가 확인 | 결과와 범위 |
| --- | --- |
| animation 원본 비교 | PASS — debug/release 각각 20 groups, spline samples 29개·closed samples 33개, 별도 representation/adaptation 검사 16개. 원본 animation/Tween/Sequence/Curve/Style/Color/geometry/observer 선언 본문을 변경하지 않고 실행. foundation 진단/instrumentation receiver는 명시한 fixture |
| transition 구성·수명 원본 비교 | PASS 12 groups — 변경 없는 Dart transitions/RelativeRect 본문과 명시한 Widget/State/primitive DTO receiver. 엔진 rendering oracle로 확대하지 않음 |
| 현재 실제 Root 흐름 | PASS 10 groups — listener 교체·coalescing·child identity, RTL/크기/행렬, 실제 filter/opacity paint 및 semantics·hit test·attach/detach, sliver geometry·Stack parent data·route 제거 |
| 인접 회귀·패키지 | 현재 코드로 chrome/restoration 9 groups와 sliver/scroll 30 groups PASS. root 전체 types, core/design/contracts/Skia/SDK build, 366 source files의 package boundary PASS. 저장소 밖의 새 core archive 소비 앱에서 reusable mixin subclassing·strict NodeNext declarations·실제 ESM 직접 import PASS |
| 실제 Web 후보 | 새 archive를 runner에 설치하고 최신 bundle을 build/reload했다. wide 및 390×844에서 정/역방향·완료·Repeat/Stop·shape 제거/복원·재생 중 resize·반복 중 Back·재진입 초기화를 확인했다. Stop 후 진행 문구가 남던 샘플 문제를 setState로 고치고 재확인했다. runtime error/warn 0. 현재 bundle SHA256 `ffab773c08ec79c49764d86805222c3a9af6aba586d472fa28636ec485806a88`, source map 628 sources |
| hidden/resume·native | 다른 owned tab을 열었지만 문서가 visible로 관찰되어 actual hidden/resume은 notVerified. 기존 Android APK와 이전 mixed list/grid Web receipt는 기록된 과거 archive의 증거이며 새 animation 코드의 native/전체 UI 수락이 아님 |

현재 [수동 출처](tools/Nelyx.FrameworkToTypeScript/data/work8/manual-origins.json)는 이 단계에서 **79건 / PARTIAL**이었다. 원본 file/pin hash, analyzer의 checkout line ending/UTF-16 span과 canonical LF span을 구분했다. 새 이름 일치나 수동 구현만으로 adapted를 부여하지 않았다. cached inventory를 갱신한 coverage는 **missing 62,560 / partial 5,163 / adapted 6,565 / implemented 1 / notApplicable 8**, source diagnostics 0, `localSnapshotMatchesPin:false`다. 변경된 목적지의 과거 adapted hash가 해제된 결과도 그대로 기록한다. 자동 batch 4개/34 origins/33 compiler-span 수락은 당시 입력에서 `unchanged`로 재사용됐다. 다음 단계의 갱신은 §10.5에 기록한다.

### 10.5 resolved generic data class 자동 반영 — 2026-10-14

analyzer가 해석한 interface/type parameter의 qualified identity·type arguments·nullable·bound와 field-formal의 실제 field identity를 IR에 보존했다. 전체 클래스의 final 공개 필드와 단일 field-formal constructor, 원본 assert initializer를 구조화 TS AST로 생성한다. 지원하지 않는 member/상속/initializer 등이 하나라도 있으면 클래스 전체를 보류한다. `dynamic`/미확인 타입·generic 호출의 타입 인자·const 객체의 canonicalization을 지우거나 추측해 통과시키지 않는다. 이름 mapping의 prototype 상속 문제도 수정했다.

실제 Flutter **TweenSequenceItem 전체 클래스**를 생성→effective package typecheck→고정 Dart 원본 비교→제품 반영했다. [tween-sequence-item.ts](Nelyx/src/framework/animation/tween-sequence-item.ts)가 단일 구현을 소유하고 TweenSequence·샘플·template은 해당 direct module을 소비한다. 기존 수동 중복 클래스는 제거했으며 [retirement 기록](tools/Nelyx.FrameworkToTypeScript/data/work8/manual-retirements.json)에 이전 출처를 보존했다. 수동 출처는 **78건 / PARTIAL**이다.

두 Dart assertion 모드에서 weight 6경계, 저장된 tween identity·readonly 필드·string/null generic 전파를 비교했다. strict NodeNext 소비자의 타입 오류 4건과 lowering guard 7건도 확인했다. 이 수락은 Dart const 객체 동일성·generic runtime token·generic method/mixin/async/collection 전체 lowering의 수락이 아니다.

현재 자동 배치는 **5개 / 35 origins / 35 compiler-span 수락**이다. private `_bounce`를 Curves public anchor 아래의 실제 private compiler 선언에 연결했다. 최신 coverage는 **missing 62,527 / partial 5,194 / adapted 6,567 / implemented 1 / notApplicable 8**, 필수 ID 74,297개, diagnostics 0, `localSnapshotMatchesPin:false`다. constructor/필드의 이름 일치만으로 추가 adapted를 부여하지 않았다. 과거 도구/base의 Git 특정과 재현은 여전히 남아 있다.

전체 package/sample typecheck와 저장소 외부 packed ESM·declaration 소비가 통과했다. 이 단계의 core archive SHA-256은 `a9e462dff3df2f4df440e45f5c8a7862a5f191c64822e32a4b38c9b14faeb199`이다. §10.4의 실제 browser 관찰은 그곳에 기록한 이전 bundle 범위이며 이 archive의 native/browser 전체 수락으로 확대하지 않는다. **W8은 ACTIVE / PARTIAL**이고 §10.3의 필수 잔여는 계속 작업한다.

§10.4의 증거는 `.tmp/work8/animation-family-result.json`, `transitions-result.json`, `transitions-source-result.json`, `animation-consumer-result.json`, `animation-browser-result.json`과 [당시 화면](.tmp/work8/animation-wide-current.png), [390×844 화면](.tmp/work8/animation-phone.png)에 보존했다. 임시 viewport와 owned tabs/server를 정리했으며 template도 동기화했다. 이후 실행은 아래에 기록한다.

### 10.6 implicit animation·텍스트·실제 picture culling 수정 — 2026-10-14

`ImplicitlyAnimatedWidget`/State·`AnimatedWidgetBaseState`, typed tween visitor, value tween 8종과 **implicit widget 12종**을 구현했다. Container/Padding/Align/Positioned/PositionedDirectional/Scale/Rotation/Slide/Opacity/SliverOpacity/DefaultTextStyle/FractionallySizedBox가 현재 값에서 재타깃하고 최신 onEnd를 호출한다. nullable 크기 계수와 curve만 교체할 때의 기존 연결은 고정 원본 동작을 보존했다. `Container`, ColoredBox, ClipPath와 실제 engine path hit testing·장식 padding·제약·변환을 연결했다. Native path service는 기존 `surface.tsx` 공급을 사용하며 native runtime 수락을 새로 주장하지 않는다.

DefaultTextStyleTransition과 AnimatedDefaultTextStyle을 실제 inherited Text·Text.rich에 연결했다. softWrap, clip/fade/ellipsis/visible, textWidthBasis가 plain/rich render 경로에 전달되고 fade는 실제 gradient mask로 기록된다. 현재 노출된 TextStyle 필드의 lerp와 font variation axis-list 처리를 추가했다. 원본 비교에서 발견한 **FontWeight.lerp 100..900 제한**을 수정했고 생성자의 1..1000 범위와 deprecated index·문자열 표시는 유지했다. 색상은 기존 ARGB transport이며 foreground/background Paint·textBaseline·package/debug label 등 전체 TextStyle은 아직 PARTIAL이다.

실제 Chrome에서 layout/semantics가 정상인데 한글·영문 본문이 그려지지 않는 문제를 발견했다. 같은 CanvasKit CPU 재현에서 DPR 1은 본문이 있고 **DPR 2는 ink 0**이었다. Native picture의 FLT_MAX cull bounds를 실제 draw bounds로 계산하도록 바꾸자 본문이 복구됐다. 작은 advisory cull bounds 밖의 음수·먼 양수 그리기도 유지했다. RN web recorder도 native SkRTreeFactory와 같은 bounds 계산을 사용한다. 임시 진단 코드는 제품과 최종 application.js에서 제거했다.

| 검증 | 결과와 경계 |
| --- | --- |
| implicit State/render | **14개 묶음 PASS** — 실제 Root·ticker·layer·layout·parent-data·sliver geometry·제거/해제. 고정 원본 State와 명시한 controlled controller receiver 비교, 실제 locked Dart vector_math 2.4.3의 Matrix4Tween 12경계 비교를 구분 |
| text/style | **7개 묶음 PASS** — 현재 필드의 원본 TextStyle.lerp 18경계/두 assertion 모드, axis-list·weight·상속 guard, 실제 Root 전달과 deterministic text geometry receiver |
| 실제 CanvasKit 픽셀 | **8개 묶음 PASS** — DPR 1/2/3·wrap 양쪽·direct/retained glyph, advisory bounds, RN web recorder와 borrow/리소스 해제. CPU surface이며 native/GL/FPS 수락으로 확대하지 않음 |
| 실제 Chrome | **19개 관찰 PASS-scoped** — wide·390×844, 본문 픽셀 복구, 완료 전 재타깃·완료 횟수, plain/rich wrap·overflow 모드 전환, 실행 중 제거/재생성·resize·Back/재진입 초기화. 경고/오류 0 |
| build/소비 | 전체 SDK build·package/sample typecheck, 371파일 package boundary, 외부 packed NodeNext/ESM와 custom implicit State/typed visitor 소비 PASS |

현재 browser bundle은 `2822359912d9fe14f1d077d6e1315a7c08e025334f4ad4b1607e0a98f6ca1ce5`이며 core/Skia web archive는 각각 `909e3cf9e242409bacfb00c80ccd5f4ad9faeaab1cbdb8872d414c061f7ff80a`, `1b22b61bac0fc03fb4541a20ce4df2dca45b6c23a3f505c4fb1823f556f6ff77`이다. [wide 화면](.tmp/work8/implicit-wide-current.png), [phone fade 화면](.tmp/work8/implicit-phone-fade.png), `.tmp/work8/{implicit-animations,text-transitions,paragraph-pictures,implicit-browser}-result.json`에 해당 범위를 기록했다. 샘플의 ellipsis 모드는 선택했지만 본문이 두 줄에 들어갈 수 있어 그 상태의 강제 ellipsis glyph를 수락한 것으로 기록하지 않았다. viewport·owned tab·HTTP server를 정리했다.

수동 출처는 **132건 / PARTIAL**, 자동 배치는 현재 입력에서 재검증한 **5개 / 35 origins / 35 compiler-span 수락**이다. 최신 coverage는 **missing 62,223 / partial 5,535 / adapted 6,530 / implemented 1 / notApplicable 8**, 필수 ID 74,297개·diagnostics 0·`localSnapshotMatchesPin:false`다. private State도 public module anchor 아래의 실제 compiler 선언에 연결했으며 새 수동 출처·이름 일치로 adapted를 올리지 않았다.

**전체 W8은 ACTIVE / PARTIAL**이다. AnimatedPhysicalModel, 전체 TextStyle/inline placeholder 제약, 나머지 instrumentation/정수 의미, SelectionArea·일반 sliver 원본 감사, 나머지 SCC와 Git 특정 도구/base 재현, W8-05..12 전체 구현·Windows/Android/Web 최종 수락을 계속한다. 실제 hidden/resume·물리 IME/reader·FPS/scanout·복구 및 이 새 후보의 native runtime은 아직 notVerified다. Apple/Linux 전용 native 검증 SKIPPED와 코드 구현 의무도 유지한다.

### 10.7 Git으로 특정한 base 재현·inline paragraph 제약 — 2026-10-14

도구 기준을 Git revision `63c6fb932088d985d82981a98fbc34b3c24ed1e5`로 특정했다. tool-base.json (보관된 과거 기록 `tool-base.json`)은 102개 실행 입력과 5개 Flutter source 파일의 Git blob·원시 byte hash·LF/CRLF 재구성 정보를 보존한다. 기존 `bin/` ignore에 가려진 Dart 도구 진입 파일 4개도 추적한다. 디자인 패키지의 임시 `.cache`는 추적에서 제외하고 로컬 파일은 보존했다. Git push는 수행하지 않았다.

[base-reproduction.mjs](tools/Nelyx.FrameworkToTypeScript/checks/base-reproduction.mjs)는 batch cache가 없는 독립 Git checkout에서 **5개 배치의 동일 fingerprint·base hash와 35개 compiler identity/source span**을 재현했다. 재생성한 base를 이용한 compose에서 직접 수정도 보존했다. 부분 clone의 누락된 과거 object 때문에 local clone은 실패했으며, 고정 pin의 sparse worktree로 재현했다. 설치된 registry dependency와 hash로 특정한 Dart SDK를 재사용하므로 clean-machine 또는 native 수락을 뜻하지 않는다. 이후 변경 뒤에는 인자 없이 기록된 revision을 재현하며 새 수락 기준을 기록할 때만 `--record`를 사용한다.

RichText에 inline Container와 `softWrap:false`를 조합하면 실제 CanvasKit에서 `Paragraph intrinsic width exceeds its layout budget`로 실패하는 것을 재현했다. 문단의 no-wrap 폭과 inline child의 부모 제약을 분리하고, intrinsic query는 child의 min/max intrinsic width를 각각 사용하도록 고쳤다. bounded layout의 불필요한 intrinsic prepass도 제거했다. **실제 Root/SkParagraph 10개 그림 검증**, inline Container 4개 overflow 모드, 별도 min/max·1×/2× scaling·baseline·dry layout 비변경을 확인했다. 원본 Dart의 완전한 method 6개를 그대로 실행해 8개 wrap/overflow 조합을 assertions on/off로 비교했다. 관련 text 7개·implicit animation 14개 검증도 통과했다.

브라우저 bundle `282235…`의 §10.6 관찰은 inline 제약 수정 이전 byte에 대한 기록으로 보존한다. 이번 수정의 실제 browser/native 공급은 아직 notVerified다. 전체 W8은 **ACTIVE / PARTIAL**이며 나머지 animation/selection/sliver·SCC·W8-05..12 구현과 최종 수락을 계속한다.

### 10.8 AnimatedPhysicalModel·공통 native wire 9 — 2026-10-14

AnimatedPhysicalModel을 실제 PhysicalModel/render object에 연결했다. BorderRadius·elevation·색/그림자 색의 실시간 재타깃, animateColor/animateShadowColor와 비애니메이션 shape, debug shadow outline을 원본처럼 처리한다. 고정 Flutter engine의 tonal/directional SkShadowUtils 연산을 공통 native core가 소유하고 RN JSI binding도 이 경로를 호출한다. Web·RN web은 실제 CanvasKit shadow를 사용한다. retained clip layer와 `antiAliasWithSaveLayer`의 `drawPaint` 순서·해제를 유지한다. 기존 ARGB transport와 View별 DPR은 명시적 adapter다.

직접 renderer 외의 serialized 경로를 점검하면서 새 명령이 encoder에서 빠질 수 있는 누락을 찾았다. **wire 9 / opcode 36 drawShadow / opcode 37 drawPaint**를 encoder·native preflight/replay·RN guard·여섯 provider와 native manifest에 반영했다. ABI는 1, 이전 wire 1~8 수신은 유지한다. exhaustive encoder 분기로 이후 새 typed 명령의 조용한 누락도 차단한다.

| 확인 | 실제 범위 |
| --- | --- |
| 원본 State | AnimatedPhysicalModel·private State·BorderRadiusTween의 완전한 Dart 선언 3개, assertions on/off, 6개 상태를 실제 Root 값과 비교. controller/BorderRadius/PhysicalModel DTO 경계 명시 |
| Root/lifecycle | implicit 16 groups PASS — 그림자 retarget·discrete flags·debug/release outline·clip layer 해제 포함 |
| 실제 CanvasKit | physical 5 groups PASS — DPR 1/2/3, 4 clip 모드의 direct/retained 그림자·본문, RN web binding 픽셀 일치, invalid 입력·borrow 수명 |
| 실제 Windows native | 격리한 현재 C ABI DLL build와 offscreen Graphite/Vulkan **10장면·잘못된 packet 12개 사전 거부·wire 1~8 수신** PASS. 기존 wire 6 effects 장면의 지정 픽셀도 유지. native window·물리 입력·scanout 수락 아님 |
| 현재 Web | wire 9 bundle `875f19794af44e7bb46ac02e039d3f2f370a03bfc05f03d0abc3ccdb99973d5d`, 636 sources, wide/390×844의 그림자·완료·plain/rich/inline 본문·제거/재생성 6관찰, 경고/오류 0. 이전 `9f2870…` 후보의 18관찰은 해당 byte의 retarget/색 옵션/Back 증거로 구분 |
| 현재 Android | x86_64 Release APK `41b505a7bccededd44b5c98645941aa53100b0c170e8fa68aa59daedd59ac945`, 67,880,847 bytes. 새 JSI/common core C++ compile/link PASS, 실행·물리 UI는 notVerified |
| 공급/소비 | 여섯 runner의 wire 9 provider/source 공급과 저장소 밖 packed core의 strict NodeNext/실제 ESM 소비 PASS-scoped. Apple/Linux dedicated native 검증 SKIPPED/provider notVerified 유지 |

Back 직후 viewport reset의 즉시 캡처가 한 번 비어 있었고 다음 재진입은 정상 표시됐다. **연속 resize frame 보존을 PASS로 판정하지 않는다.** 이 경계는 잔여로 기록했다. 이전 `282235…` Web build의 보관 단계가 잘못된 실행 경로로 실패했으나 Git 소스·고정 archive에서 원래 application.js hash를 정확히 복구했다. 재생성 source map은 원래 hash와 다르므로 derivative로 구분하며 원래 map을 복구했다고 표시하지 않는다. 현재와 `9f2870…`, 이전 explicit animation build의 bundle/map은 별도 보관했다.

수동 출처는 137개 모두 PARTIAL이며 engine shadow 출처·완전한 license·backend hash를 support origins에 보존한다. 자동 5개/35개 원본 수락은 유지한다. 공통 paint 의존성 변경으로 matrix와 TweenSequenceItem fingerprint가 바뀌어 검증 후 재반영했으며 새 Git 특정 기록을 작성한다. **전체 W8은 ACTIVE / PARTIAL**이다. PhysicalShape·전체 TextStyle/selection/sliver·나머지 SCC·instrumentation·W8-05..12 및 최종 실제 플랫폼 수락을 계속한다.

현재 5개 fingerprint는 Git `012b3eb0147012449e230cc203c3eaa06b0d0752`의 102개 입력·5개 source 파일로 cache 없는 독립 checkout에서 모두 재현했다. 35개 source span/identity·base hash와 직접 수정 합성도 일치한다. `base-records/`에 이전 `63c6fb…` 기록을 보존하며 `--revision <qualified-revision>`으로 재현할 수 있다. 현재 checkpoint의 **제품 646개·도구 37개·전체 입력 734개 hash와 evidence 33개**를 대조했다. 최신 coverage는 missing 62,188 / partial 5,585 / adapted 6,515 / implemented 1 / notApplicable 8, 필수 74,297개, diagnostics 0, `localSnapshotMatchesPin:false`다. 이 기록은 전체 이식·최종 플랫폼 완료 판정이 아니다.

### 10.9 SpringDescription 전체 생성·PhysicalShape·실제 runner 설치 — 2026-10-14

resolved class IR/emitter에 명명 생성자·factory의 전체 본문, public method/getter, `this`와 문자열 보간, 정확한 qualified 상수와 receiver adapter를 추가했다. SpringDescription 전체 클래스를 기존 `framework/physics/spring-simulation` 모듈에 자동 반영했다. 옵션 타입·SpringType·실제 SpringSimulation/ScrollSpringSimulation과 private 해법은 [추적된 수동 선언 입력](tools/Nelyx.FrameworkToTypeScript/data/work8/inputs/spring-simulation.manual.ts)으로 합성한다. 별도 runtime generator나 중복 canonical 클래스를 추가하지 않았다. 입력 path·본문 hash가 fingerprint에 포함되며, 입력 변경과 직접 product 수정을 함께 합성하는 실제 검사도 통과했다.

명시한 정수 adapter는 JS safe integer 범위와 Dart의 ties-away-from-zero 반올림을 검사한다. Duration은 정수 milliseconds, 숫자 진단은 `toStringAsFixed(1)` 경계다. 정수 mutation·미검사 int constructor parameter·generic named/static construction·inheritance/mixin/async/collection·const canonicalization을 처리했다고 표시하지 않는다. 두 assertion 모드 각각 **25 class cases·9 운동 구성**, 별도 숫자 **18 cases**, strict 소비 타입 4개와 lowering 거부 조건을 원본 전체 class와 비교했다. 기존 다섯 배치의 생성 본문 hash는 그대로 유지하며 현재 **6개 배치 / 36 origins**를 수락했다.

PhysicalShape/RenderPhysicalShape와 공유하는 수동 physical base를 추가했다. 실제 arbitrary Path·even-odd 구멍·clip/saveLayer·그림자·reclip 구독/교체·hit testing·retained ClipPathLayer 해제를 연결했다. PhysicalModel의 상속된 custom clipper를 나중에 설정해도 hit testing에 반영하도록 보정했으며, clipper가 없는 기본 circle의 rectangular hit 동작은 이 pin대로 유지했다. 완전한 Dart 선언 3개를 두 assertion 모드·8구성에서 actual Root command와 비교했고, actual CanvasKit CPU DPR 1/2/3에서 24 direct/retained 그림·실제 engine containment·수명을 확인했다.

기존 physical 그림자 검사가 Root의 기본 어두운 배경을 그림자로 셀 수 있음을 발견했다. 이전 receipt는 보존하고 이 한계를 [background audit](.tmp/work8/physical-shadow-background-audit.json)에 명시했다. 흰 배경과 shadow-command-off 대조군으로 고쳤으며, 실제 Windows offscreen Graphite/Vulkan에서도 zero-elevation 대조군·triangle/hole을 포함한 **15장면**, 잘못된 packet 12개 사전 거부와 wire 1~8을 확인했다. 그림자 연산식 자체를 바꾼 것은 아니다.

공급 manifest만 갱신하고 runner 설치를 빠뜨린 첫 Web 후보에서는 `PhysicalShape is not a constructor`와 후속 closed-picture-owner 오류가 발생했다. 실패 bundle `15ede21…`·map·로그·이미지를 보존했다. 현재 CLI의 supply가 설치를 수행하지 않는다는 경계를 유지하고, 공통 Metro runner 검사가 manifest archive path/SHA-512를 실제 npm 설치 receipt와 비교하도록 보강했다. 같은 버전의 이전 archive도 거절하며 명시한 개발 source mapping은 유지한다. 이 검사는 설치된 모든 파일의 변조 방지나 native 수락을 뜻하지 않는다. **여섯 runner의 현재 archive 실제 설치·공통 타입 검사**와 저장소 밖 packed core의 strict NodeNext/실제 ESM SpringDescription·PhysicalShape 소비를 통과했다.

| 현재 후보 | 확인한 범위 |
| --- | --- |
| Web | bundle `7975d0d9354487f62eb18887b835746224dc6b330ff7912a1385d531edb47535`, map `0173c6d3ce0186fb5b19b4be2e7056bb6c52dbc38b561e468f67a6e649c37791`, 636 sources. 실제 Chrome wide/390×844의 path 전환·resize 도중 animation 후 완료·제거/재생성 7관찰, 경고/오류 0. 이전 `d73017…`의 Back/재진입 포함 11관찰은 해당 byte에 귀속 |
| Android | x86_64 Release / emulator-vulkan APK `40579f5ff7d376896dfad698dcc7990bb2bbaaab6f90608fc68785e1fe0531c6`, 67,886,351 bytes. 현재 JS/HBC class 이름·설치 header와 compiled JSI shadow binding을 확인. 설치/실행·물리 UI·IME/reader/FPS/production signing은 notVerified |
| 자동화/출처 | 자동 6배치·36 origins, 수동 139개 모두 PARTIAL. 제품 647개·도구 42개·추적 수동 입력 1개·evidence 46개 checkpoint hash. 현재 여섯 fingerprint는 Git `5b88a4508721651830d33aef339c7d36ae157409`의 108개 입력·6개 Flutter source로 cache 없는 독립 checkout에서 재현. 원본 span/identity·base hash와 직접 수정 합성 일치, 과거 `012b3eb…`/`63c6fb…` 기록 보존 |

새 탭과 탭 전환 shortcut을 사용해도 테스트 앱은 계속 visible로 관찰됐다. **실제 hidden/resume를 수락하지 않는다.** 이번 Back+viewport reset 장면은 정상 표시됐지만 연속 모든 frame 보존을 증명하지 않으며, 이전 빈 캡처와 build-error recovery는 잔여로 유지한다. 전용 Apple/Linux native 검증은 SKIPPED/provider notVerified다.

최신 coverage는 **missing 62,173 / partial 5,621 / adapted 6,494 / implemented 1 / notApplicable 8**, 필수 74,297개, diagnostics 0, `localSnapshotMatchesPin:false`다. 변경된 목적지의 이전 수락을 무효화했고 단순 이름 일치를 승격하지 않았다. **전체 W8은 ACTIVE / PARTIAL**이며 full TextStyle·SelectionArea·일반 sliver adoption/원본 layout·나머지 SCC 및 W8-05..12 구현/최종 수락을 계속한다.

### 10.10 TextStyle 값·Paint·자원 소유권과 coverage 수락 보정 — 2026-10-14

**W8-04 / 수동 포트:** TextStyle에 foreground/background Paint, textBaseline, package 글꼴 이름/fallback, debugLabel, overflow와 copyWith·apply·merge·lerp·compareTo·equality/hash·진단·getTextStyle/getParagraphStyle을 연결했다. Paint는 원본의 객체 동일성을 유지하고 paragraph 생성 시 값으로 캡처한다. `ui/paragraph-style`은 글꼴 기본값·override·scaling·strut·hyphens metadata를 전달하는 값 경계다. 전체 dart:ui encoder/StrutStyle/hyphen rendering을 완료한 것으로 표시하지 않는다. ARGB 색·불변 list·안정적인 local hash는 명시한 host adapter다.

완전한 원본 TextStyle 클래스와 variation list를 변경 없이 실행해 **debug/release 각각 30사례**를 비교했다. package만 지정했을 때의 `packages/<package>/null`, null-target backgroundColor lerp, Paint 우선순위·동일성, apply/merge와 진단 순서도 pin대로 유지한다. 생성자는 subclass 초기화 전에 재정의 가능한 snapshot 메서드를 호출하지 않는다. 저장소 밖 현재 core archive의 strict NodeNext/실제 ESM에서 subclass override, typed options와 direct ParagraphStyle identity까지 확인했다.

**실제 paragraph / 12 groups PASS:** Web의 foreground/background Paint·gradient stroke·filter/mask·Shadow·image shader를 실제 Root/SkParagraph에 연결했다. 독립 SkParagraph와 DPR 1/2/3의 **24 direct/retained 그림**이 픽셀 해시까지 같고, RN TypeScript 경로의 **4그림**도 실제 CanvasKit 및 JSI-web Paint wrapper를 사용하는 명시한 ParagraphBuilder/metrics 수신기와 일치한다. 이 수신기 검사는 native JSI 실행 증거가 아니다. Shader 이미지의 UI producer가 끝나도 마지막 paragraph/frame 참조까지 보유하며, 실패와 최종 해제 경로를 확인했다.

검증 중 Offset의 getter 좌표가 객체 전개에서 빠지던 오류, 중복 image ID 정리 전에 외부 소유 참조가 숨겨지던 오류를 재현하고 수정했다. font snapshot의 소유권 binding을 보존하고 TextPainter의 layout/measurement cache 조회 전에도 font·paint image 소유자를 확인한다. 실패 기록과 초기 archive `8cf9af…`의 receipt를 보존했으며 현재 후보는 `c50465e37d15dbdb9a629ab5b4ec15a321066b4eee19fb94552e2dda951f579e`다.

**W8-03 / coverage 보정:** 생성 destination이 같아도 dependency/tool/fixture가 달라졌다면 과거 automatic review를 재사용할 수 없도록 했다. 이전 수락이 남던 경로와 철회한 초기 coverage 기록은 [감사 증거](.tmp/work8/text-paint-evidence-audit.json)에 연결한다. 실제 batch hash reader와 review retention의 6 groups를 통과했고, 변경된 public exports 기준으로 여섯 배치를 재분석·합성·의미 검증·반영했다. **6개 생성 base와 product 본문은 모두 byte-identical**이며 새 fingerprint의 36개 원본만 최신 coverage에 수락했다. 새 여섯 fingerprint는 Git `d0fbb624c4b501044a15f1c7bb1f1739d6b5ee93`의 **108개 입력·6개 원본**으로 cache 없는 독립 checkout에서 재현했다. source span/identity·base hash와 직접 수정 합성이 일치하며, 이전 Git-qualified 기록은 `base-records/`에 보존했다.

| 현재 후보 | 확인한 범위 |
| --- | --- |
| Web | bundle `bc37358c7c94520ddfba854a5bfb13ee0ed100772033ed8bcbde2932d3f0d898`, map `69e9a8aa151f69b0dfab2b1d725b29a4d3d55ad05669d5a41612283acae1be82`, 638 sources. 실제 Chrome default/390×844의 Paint 윤곽→채움·한국어/배경·완료·제거/재생성·Back/재진입 16관찰, 경고/오류 0. [wide](.tmp/work8/text-paint-wide-b.png), [phone](.tmp/work8/text-paint-phone-b.png) |
| Android | x86_64 Release / emulator-vulkan APK `1a28f489e668191addcc27f63f6ad43237cb18633f5d22b4eb38e1969887e962`, 67,904,419 bytes. 현재 JS/HBC 예제·baseline 문자열, 설치된 paragraph/paint header와 native shadow binary 확인. 실행·물리 text pixels·IME/reader/FPS/production signing은 notVerified |
| 공급/출처 | sample/template Paint 예제, 여섯 runner 현재 archive 실제 설치·공통 타입 검사, core-only 외부 소비 PASS-scoped. 수동 출처 142개는 모두 PARTIAL. checkpoint 제품 649개·도구 46개·수동 입력 1개·evidence 56개 hash 대조 |

현재 coverage는 **missing 62,153 / partial 5,641 / adapted 6,494 / implemented 1 / notApplicable 8**, 필수 74,297개·public 47,282개·diagnostics 0·`localSnapshotMatchesPin:false`다. 전용 Apple/Linux native 검증은 SKIPPED/provider notVerified를 유지한다. **전체 W8은 ACTIVE / PARTIAL**이다. SelectionArea/SelectableRegion·paragraph fragment/registrar·선택 자동 스크롤, 일반 sliver 원본 adoption/layout, 전체 typography/나머지 SCC와 W8-05..12를 계속한다. 실제 hidden/resume·연속 resize frame 보존·native window/input/reader/FPS/복구 잔여는 이번 수락으로 닫지 않는다.

### 10.11 선택 처리 선행 구현 — 2026-10-14, 진행 중

`MultiSelectableSelectionContainerDelegate`와 `StaticSelectionContainerDelegate`의 화면 순서, 양방향 edge 탐색, 선택 내용/범위·기하 합성, 새 자식의 반대 edge 복원, 경계 선택, 세분/방향 확장, 핸들 clipping을 이식했다. 예약 갱신은 실제 View의 scheduler에 연결하고, 중첩 post-frame 등록·delegate 교체·View 종료 후 callback을 처리한다.

`TextPosition`·`TextRange`·`TextSelection`·`TextLayoutMetrics`와 character/line/paragraph/document 경계, `WordBoundary`·단어 이동 경계도 추가했다. grapheme은 공식 archive SHA-256을 확인한 `characters 1.4.1`의 Unicode 16 테이블을 재생성하고, 공백/문장부호 판정은 고정 Dart runtime의 전체 code point 분류로 생성한다. 제품은 Dart와 host 정규식/ICU 버전을 요구하지 않는다. 원본·SDK·생성 hash와 전체 BSD/Unicode notices를 보존한다. 전체 Characters/RegExp API 완료를 뜻하지 않는다.

TextPainter의 caret·방향성 text box·원본 UTF-16 hit·단어 affinity를 연결했다. 기존 grapheme hit 보정은 단일 본문 편집 adapter로 옮겼다. template은 값 metrics만 캐시하고 transient engine producer를 즉시 반환한다. plain/rich render object는 동일 JSON 비교 전에 font/paint image 소유자를 검증하며 font 복사에도 owner를 보존한다. RN word boundary binding은 **version 2**, directional text box binding은 **version 1**이고 draw wire는 **9**를 유지한다.

| 확인 범위 | 증거 |
| --- | --- |
| Delegate 원본 | 변경하지 않은 두 Dart 선언과 selection 값/이벤트·container base, 12개 시나리오 × assertions on/off, 모드당 128개 관찰 |
| 실제 Root | 등록·제거·중첩 microtask·disabled scope·delegate 교체/재사용·scheduler 종료 후 해제 4 groups |
| 값·grapheme/문단 경계 | 값 26개·문자열 15개 × 두 모드, Unicode 16 grapheme 1,093개·emoji 5,042개를 한 차례 비교 |
| Caret/box/hit/word | 선택한 완전한 원본 메서드와 독립 CPU SkParagraph receiver, 구성 19개·caret 920개·box 질의 456개, 원본 두 assertion 모드·단어 양 affinity 비교 |
| WordBoundary | 변경하지 않은 전체 선언·이동 helper, 24개 입력 × 두 모드, 고정 property table의 전체 1,114,112 code point lookup 비교 |
| 소유권·native TS ABI | plain/rich constructor·동일 JSON update 8 groups, 실제 CanvasKit을 받는 native TS packet receiver 7 groups. 이전 paragraph에 묶인 WordBoundary의 해제도 확인. Native JSI 실행 증거가 아님 |

현재 소스 변경과 proof hash는 selection-progress.json (보관된 과거 기록 `selection-progress.json`)에 기록한다. §10.10의 공급·browser·APK 및 이전 strict checkpoint는 **이전 후보의 증거**로 보존한다. 새 public export/외부 소비, origin·coverage·자동 batch의 변경 입력, 여섯 runner 공급, 새 native header build/runtime 수락은 아직 갱신 중이다. 이 항목들의 수락을 이전 archive에서 승계하지 않는다.

다음은 전체 paragraph fragment/registrar·중첩 WidgetSpan 경계·선택 paint/handles와 SelectableRegion/SelectionArea·포인터/키보드/clipboard·자동 스크롤이다. 일반 sliver, 전체 typography/나머지 SCC, W8-05..12 및 §7의 최종 수락도 계속한다. **전체 W8은 ACTIVE / PARTIAL**이며 새 선택 기능 전체 완료나 전체 계획 완료로 판정하지 않는다.

현재 후보의 기존 text paint·paragraph picture·text transition 29 groups도 통과했다. 이 실행에서 기존 결과 경로 세 개를 재사용해 이전 receipt bytes가 교체된 점을 바로잡았다. 원래 hash는 이전 Git checkpoint에 남기고, 현재 결과는 `.tmp/work8/selection-regressions/`에 별도 보존했다. 보관된 이전 core/SDK/RN/Web archive 네 개와 Git `d0fbb62`의 원래 check를 격리된 package resolution으로 다시 실행해 이전 범위 12·10·7 groups를 확인했다. 보정 기록 (보관된 과거 기록 `text-paint-historical-requalification.json`)은 원래 receipt bytes를 복원했다고 주장하지 않으며, fresh historical proof와 현재 proof를 구분한다.

새 check에는 source hash를 쓰기 전에 package의 현재 source와 emitted inline source map을 대조하고 JS/map digest를 남기는 guard를 추가했다. 실제로 미빌드 변경을 거절한 후 core를 다시 빌드해 새 일곱 proof family를 확인했다. 현재 Core의 실행 module 381개를 대조하며, C++ header를 TS 빌드나 source hash만으로 native 실행 수락하지 않는다. 새 source 후보의 public 공급·native/UI 및 전체 W8 수락은 계속 미완료다.

결과 경로 재사용 시 이전 bytes를 SHA-256별 immutable history에 먼저 보존하는 공통 writer를 새 일곱 check와 기존 세 regression check에 연결했다. 실제 이전 bytes·hash 보존과 같은 결과의 재기록을 확인했고, 새 일곱 check는 이 writer로 다시 실행해 이전 proof와의 연결을 남겼다. 원래 bytes가 교체됐던 세 개에 대한 unavailable 표시는 그대로 유지한다.

### 10.12 paragraph fragment·명시한 RichText 선택 등록 — 2026-10-14, 진행 중

원본 `_SelectableFragment`의 문자/단어/문단 edge, origin 경계 유지와 edge 교차, 중첩 WidgetSpan 조상 좌표, 세분/방향 확장, geometry·선택 배경·핸들 layer를 이식했다. fragment는 U+FFFC를 제외하고 자식 텍스트가 별도로 등록된다. `RenderRichParagraph`가 공통 `RenderParagraph`를 상속하도록 연결해 원본의 조상 paragraph 판정을 유지했다. `RichText`의 명시한 `selectionRegistrar`/`selectionColor`, layout cache 무효화, 텍스트/registrar 교체와 해제를 연결했다. 색은 기존 host의 ARGB number adapter를 사용한다.

수정하지 않은 전체 Dart fragment와 source selection/text 값·경계 선언을 **24개 시나리오 × assertions on/off, 706개 관찰**로 비교했다. geometry·word/layout·paint/layer는 명시한 monospace UTF-16 수신기이며 실제 engine layout 증거와 구분한다. 원본의 nonzero fragment offset 계산과 양 edge의 비대칭 분기도 보존한다. [원본 비교](.tmp/work8/paragraph-fragments-result.json).

**실제 Root·CPU SkParagraph 3 groups PASS:** WidgetSpan 양쪽 fragment와 자식 텍스트 선택, placeholder 제외, 선택/해제 raster 변화·복원, LeaderLayer 연결/해제, 텍스트 교체·registrar 이전·disabled scope, 줄바꿈 뒤 cache 교체를 확인했다. Root 종료 후에도 마지막 frame lease로 그림을 재생할 수 있고 frame 해제 후 paragraph 자원이 0개가 된다. [Root 증거](.tmp/work8/paragraph-selection-root-result.json). 기존 paragraph picture 10그룹·자원 소유권 8그룹, SDK build·공통 타입 검사도 통과했다. receipt 교체 전의 history 보존은 유지한다.

현재 명시한 RichText 등록을 확인한 것이며 전체 Text의 전용 선택 container·inline delegate, SelectableRegion/SelectionArea 입력·keyboard/clipboard/자동 스크롤은 계속 구현한다. 새 public 공급·origin/coverage/자동 batch 갱신과 native header build/UI 수락도 남아 있다. §10.10 archive·browser·APK 증거를 새 소스에 승계하지 않는다. **전체 W8은 ACTIVE / PARTIAL**이며 다른 W8 단계와 최종 수락을 계속한다.

### 10.13 Text 선택 container·inline delegate — 2026-10-14, 진행 중

일반 `Text`와 `Text.rich`를 원본처럼 선택 container 아래에서 자동 등록하고, inline 전용 delegate의 문단 흡수·placeholder 위치 판정·양 edge 교차 시 반대 index 복원·first-box 순서·paragraph 절대 offset에서 local range 계산을 연결했다. 비선택 Text는 기존 plain/rich paragraph host를 사용한다. `DefaultSelectionStyle`의 fallback·merge·theme wrap·변경 알림과 Text의 기본 선택 색·text 마우스 커서도 연결했다. 기존 text input/layout host ABI와 ARGB number 색 adapter는 유지한다.

수정하지 않은 전체 `_SelectableTextContainerDelegate`·Multi/Static/base와 selection 값/이벤트를 **12개 시나리오 × assertions on/off, 172개 관찰**로 비교했다. 처음에는 서로 다른 Dart library를 한 파일에 합쳐 같은 이름의 private 메서드가 override되던 harness 문제가 있었다. 제품을 이 실패에 맞춰 바꾸지 않고 원본 library 경계를 유지하도록 고쳤다. 이전 차이와 [보정 감사](.tmp/work8/text-selection-delegate/library-boundary-audit.json)를 보존하며 새 [PASS receipt](.tmp/work8/text-selection-delegate-result.json)에 세 library의 byte hash를 기록한다.

실제 Root·CPU SkParagraph 검증은 **4 groups PASS**로 확장했다. plain/rich 자동 등록·중첩 WidgetSpan·전체 선택 범위/내용 일치·문단 선택의 inline text 흡수와 기본 색 변경 시 선택 유지까지 확인했다. 새 Text 구조에서 기존 paint/picture/transition **12·10·7 groups PASS**, SDK build와 공통 타입 검사도 통과했다. 현재 regression bytes는 SHA별 `.tmp/work8/selection-text-regressions/`에 보존하고 selection-progress (보관된 과거 기록 `selection-progress.json`)에 연결한다.

SelectableRegion/SelectionArea의 전체 state·포인터/keyboard/clipboard·자동 스크롤과 public exports/외부 소비·origin/coverage/자동 batch·공급/native/UI는 계속 미완료다. **전체 W8은 ACTIVE / PARTIAL**이며 §7의 최종 수락과 나머지 W8 작업을 계속한다.

### 10.14 Scrollable 선택 delegate·실제 자동 스크롤 — 2026-10-14, 진행 중

Scrollable이 부모 registrar를 발견하면 전용 selection handler를 만들도록 연결했다. 원본 delegate의 네 방향 고정 원점 좌표·양 edge의 scroll 위치별 갱신 기록·새 자식의 반대 edge 복원·pending/physics·keyboard edge 이동과 position 교체를 이식했다. 예약 layout 갱신은 View의 post-frame scheduler를 사용하고 종료/세대 guard를 둔다.

전체 원본 delegate와 원점 함수, library를 분리한 Multi/Static/base·값/이벤트 선언을 **14개 시나리오 × assertions on/off, 190개 관찰**로 비교했다. 이 원본은 dispose 때 position callback을 남기므로 host는 callback을 해제한다. 원본 흐름 비교와 이 수명 adapter의 차이를 별도로 확인한다. [원본 비교](.tmp/work8/scroll-selection-delegate-result.json). 이 비교의 auto-scroller는 제어한 수신기다.

**실제 Root·CPU SkParagraph 검증 6 groups PASS:** ListView/ScrollPosition의 driven activity와 실제 EdgeDraggingAutoScroller를 사용해 down/up/right/left 각각 **6 frame, 0→40px**, pending과 선택 내용 갱신을 확인했다. physics가 선택 edge 스크롤을 금지하면 움직이지 않으며, 선택 handler 제거 시 이전 position이 흡수·dispose되기 전에 callback이 해제된다. registrar dependency 변경은 새 position을 만들므로 동일 position 객체가 계속된다는 초기 fixture 가정은 수정했다. 다른 원본/Root 실패 receipt도 immutable history에 보존한다. [Root 증거](.tmp/work8/paragraph-selection-root-result.json). SDK build·공통 타입 검사도 통과했다.

이 증거는 직접 dispatch한 selection event와 실제 scheduler/engine의 통합 범위다. SelectableRegion/SelectionArea의 실제 pointer·keyboard·clipboard·overlay 입력, native/browser UI·물리 IME/reader·FPS 수락을 뜻하지 않는다. tap-and-drag·overlay/action 의존성과 Region state를 계속 구현하며, public 공급·origin/coverage·batch 및 나머지 W8 최종 수락도 남아 있다. **전체 W8은 ACTIVE / PARTIAL**이다.

### 10.15 tap-and-drag recognizer — 2026-10-14, 진행 중

Region 입력의 선행 의존성인 tap-and-drag detail 다섯 값·연속 tap tracker·base·horizontal/pan/deprecated recognizer를 이식했다. 연속 tap timeout/최대 횟수·기본 버튼·slop·arena 수락/거절·drag 시작 좌표·업데이트 throttle/final flush를 실제 View gesture binding과 timer port에 연결했다. deprecated 클래스도 원본의 별도 상속 경계를 유지한다. Duration은 millisecond timer port, count는 safe-number 정수 adapter다.

수정하지 않은 전체 원본 선언과 GestureRecognizer/OneSequence/OffsetPair·arena 클래스, 고정 상수/슬롭 함수를 별도 Dart library에서 실행해 **27개 시나리오 × assertions on/off, 304개 관찰**을 비교했다. detail 기본값/primary assert, 연속 tap, 경쟁 recognizer, transformed 좌표, throttle·취소/해제도 포함한다. 제품 쪽은 실제 GestureBinding/Arena/PointerRouter·concrete event를 사용하고 Dart 쪽 event/router·diagnostic/time은 명시한 수신기다. [증거](.tmp/work8/tap-and-drag-result.json).

**host 수명 6 groups PASS:** tap tracking/down/drag start/update callback 도중 dispose, throttle 설정을 null로 바꾼 뒤 남은 timer 해제, reset callback이 실패해도 route/timer 해제를 확인했다. callback 이후에 닫힌 recognizer가 새 작업을 만들지 않도록 guard하며, dispose는 현재 throttle 설정과 관계없이 기존 timer를 취소한다. Core build도 통과했다. 실제 Region widget·pointer/keyboard/clipboard/overlay, public 공급·origin/coverage·batch, native/browser UI와 나머지 W8 수락은 계속 남아 있다. **전체 W8은 ACTIVE / PARTIAL**이다.

### 10.16 editing value·intent·selection point — 2026-10-14, 진행 중

Region action/toolbar의 선행 값인 TextEditingValue·SelectionChangedCause·TextSelectionDelegate, 전체 text-editing intent 선언과 TextSelectionPoint를 추가했다. TextEditingValue의 constructor/copyWith·composing 유효성·JSON·replaced·equality/string을 연결했다. 같은 길이 replacement는 selection/composing 객체를 보존하고, 길이가 바뀌면 원본처럼 offset을 보정하고 selection affinity/direction을 기본값으로 만든다.

수정하지 않은 전체 원본 선언을 **값 28개·intent 27개 × assertions on/off**로 비교했다. JSON optional/default/cast/range 정책, malformed 입력, UTF-16·CRLF·invalid surrogate, subclass equality, replacement identity와 delegate 기본 flag를 확인했다. 실제 JSONMessageCodec의 wire 문자열과 왕복도 일치한다. [증거](.tmp/work8/text-input-values-result.json). 기존 codec의 Dart JSON 정수 token은 bigint를 사용하고 text offset은 safe-number로 좁힌다. 범위를 벗어난 정수는 거절하며 전체 Dart 정수 ABI를 주장하지 않는다. hash는 local adapter, Intent type은 constructor token이고 CopySelectionTextIntent의 private 생성자는 TS Actions type token을 위해 `@internal` public adapter다.

Core build는 통과했다. TextInput client/configuration/delta·플랫폼 IME 전체나 RenderEditable 전체를 구현한 것으로 표시하지 않는다. selection overlay/context menu 의존성과 Region의 pointer·keyboard·clipboard를 계속 연결하며, public 공급·origin/coverage·batch·native/browser UI와 나머지 W8 최종 수락도 남아 있다. **전체 W8은 ACTIVE / PARTIAL**이다.

### 10.17 selection overlay·context menu·magnifier controller — 2026-10-14, 진행 중

SelectionOverlay와 toolbar/handle의 두 private widget·State를 연결했다. 핸들의 방향·line height·endpoint 갱신, Apple/Web의 양 핸들 동시 drag 제한·차단 뒤 승격, collapsed 표시, 48px interactive padding·iOS slop, 실제 follower·fade·Pan recognizer와 toolbar·spell-check menu·magnifier 전환을 이식했다. ContextMenuButtonItem/type, toolbar anchors, MagnifierInfo/configuration/controller, legacy/handle-only/empty controls와 ClipboardStatusNotifier도 추가했다. 정수 millisecond animation과 공유 tap-group token은 host adapter이며 전체 EditableText/TextSelectionOverlay·RawMagnifier나 플랫폼별 디자인 controls를 완료한 것으로 표시하지 않는다.

수정하지 않은 전체 원본 값·control 선언은 **21사례와 control 12조합 × assertions on/off**로 비교했다. RTL 역방향 anchor, strict multiline threshold, clamping·diagonal transform·NaN/빈 endpoint, magnifier bounds의 assertion 정책과 handle-only action no-op을 확인했다. 전체 SelectionOverlay·두 widget/State·ContextMenuController 원본 선언은 **21시나리오 × assertions on/off, 시나리오당 27관찰**로 비교했다. 원본 쪽 framework/geometry/animation/overlay/gesture factory/scheduler는 명시한 수신기이며 제품은 실제 Root·Overlay·Elements와 live handle widget을 사용한다. [값/control 증거](.tmp/work8/selection-overlay-values-result.json), [전체 overlay 원본 비교](.tmp/work8/selection-overlay-source-result.json).

**실제 Root 8 groups PASS:** CPU CanvasKit의 retained follower/선택 핸들 그림, pointer hit path·arena·Pan, fade listener 해제, legacy/custom 메뉴와 magnifier ordering, 외부 animation controller 소유권, 두 controller 사이의 오래된 hide 경합·메뉴 제거 callback 재진입·예약 build 뒤 dispose를 확인했다. Clipboard/실제 JSONMethodCodec·ServicesBinding lifecycle은 제어한 BinaryMessenger 수신기로 검증했다. OS clipboard 전달·native/browser UI 증거는 아니다. 오래된 hide가 새 entry를 제거하지 않는 generation guard, callback 전에 이전 메뉴 owner를 해제하고 Root 종료 후 hidden으로 판정하는 처리는 source 흐름 비교와 구분한 host 수명 adapter다. [Root 증거](.tmp/work8/selection-overlay-root-result.json).

초기 Root 검증은 group 출력 뒤 관찰하지 않은 ServicesBinding 초기화가 실패했으므로 당시 PASS receipt를 철회했다. readiness를 기다리고 environment/keyboard codec 응답을 제공하도록 fixture를 고쳤으며, legacy toolbar fixture의 Positioned도 실제 Stack 아래로 옮겼다. 실패 로그·immutable receipt history와 [보정 감사](.tmp/work8/selection-overlay-fixture-audit.json)를 보존한다. 수정한 현재 검증은 process exit 0이다. Core/SDK build·공통 타입 검사도 통과했다.

현재 selection-progress (보관된 과거 기록 `selection-progress.json`)는 새 소스의 **16개 scoped proof family**를 구분한다. SelectableRegion/SelectionArea 전체 pointer·keyboard·clipboard/status, public exports/외부 소비·origin/coverage·batch·여섯 runner 공급·native/header build/UI와 나머지 W8 구현·최종 수락을 계속한다. §10.10의 archive·browser·APK를 새 소스에 승계하지 않는다. **전체 W8은 ACTIVE / PARTIAL**이다.

### 10.18 selection status·listener·Region 서비스 의존성 — 2026-10-14, 진행 중

SelectableRegionSelectionStatus와 notifier/scope, SelectionListener·State·delegate·notifier를 연결했다. 반복 `changing`은 매번 알리고, 이미 finalized인 상태를 다시 finalize하는 조건은 원본 debug assertion 정책을 유지한다. listener는 최초 비선택 geometry 알림만 억제하며, notifier를 바꿀 때 같은 delegate·선택 값을 유지한다. SelectionDetails는 structural interface, source private 생성/협업 접근은 `@internal` TS adapter다.

수정하지 않은 전체 원본 선언을 **6 groups × assertions on/off**로 비교했다. 원본 notifier/State/container/static-base·geometry query는 명시한 수신기다. 제품에서는 actual ChangeNotifier/Static base와 geometry query override를 사용했고, listener의 lazy 등록·교체·unmount와 status scope 조회는 **실제 Root·Elements·SelectionContainer**로 확인했다. [증거](.tmp/work8/selection-listener-status-result.json).

ProcessTextAction/Service/DefaultService와 BrowserContextMenu를 추가했다. query의 nullable map·오류 catch 경계·잘못된 map entry, process 결과의 nullable string/cast, subclass equality, debug-only setChannel과 browser enabled의 비동기 갱신을 유지했다. 별도 messenger를 지정하면 browser enabled 상태도 해당 application에 묶는 host extension을 제공한다. 수정하지 않은 전체 원본과 **12사례 × assertions on/off**를 비교했으며, 실제 MethodChannel/OptionalMethodChannel·Standard/JSON codec을 제어한 BinaryMessenger에 연결했다. 실패한 명령은 enabled를 바꾸지 않고, concurrent 응답은 원본처럼 완료 순서대로 반영된다. [증거](.tmp/work8/selection-region-services-result.json).

Core build는 통과했다. 이 증거는 OS process-text action 실행·브라우저 DOM context-menu interception·전체 Region 입력 수락이 아니다. selection-progress (보관된 과거 기록 `selection-progress.json`)의 scoped proof family는 현재 **18개**이며, SelectableRegion/SelectionArea state·입력과 provider 연결, public 공급·origin/coverage·batch·native/browser 및 나머지 W8 최종 수락을 계속한다. **전체 W8은 ACTIVE / PARTIAL**이다.

### 10.19 SelectableRegion state·실제 입력 통합 — 2026-10-14, 진행 중

SelectableRegion/State에 기존 selection container·registrar, tap-and-drag·long press·secondary tap, action·선택 상태·overlay·clipboard/process-text를 연결했다. 플랫폼별 consecutive tap·단어/문단·shift 확장·우클릭 유지/토글, edge의 pending post-frame 재시도·핸들/magnifier, 세분/방향 action과 one-shot secondary anchor를 이식했다. 원본 `_stopSelectionStartEdgeUpdate`가 end 좌표를 비우는 비대칭도 보존한다. 외부 FocusNode끼리 교체할 때 이전 callback을 제거하고, 지연 service 결과가 종료된 State를 조회하지 않도록 reporter를 캡처하는 것은 host 수명 adapter다. 전체 원본 State/action 비교와 실제 keyboard event/shortcut은 계속 검증한다.

**8 groups PASS:** actual Root·Elements·CPU SkParagraph에서 mouse drag의 내용/그림/status, double/triple tap의 단어/문단 선택, granular/directional Actions·clipboard codec, 우클릭 메뉴·secondary anchor, Android/iOS 정책의 실제 long-press timer·핸들/toolbar·haptic 요청, 외부 FocusNode 이전, pointer→Scrollable→EdgeDraggingAutoScroller **6 frame**과 지연 process action/query의 종료 경로를 확인했다. Clipboard/haptic은 제어한 BinaryMessenger와 실제 JSONMethodCodec 경로이며 OS 전달이 아니다. 마지막 그룹은 실제 Static delegate와 제어한 selectable로 callback 실패 뒤 owner/listener 해제를 확인한다. [증거](.tmp/work8/selectable-region-root-result.json).

선택한 nested container를 종료할 때 부모의 cached handle owner가 이미 종료된 자식 State를 가리키던 실패를 재현했다. pin은 deferred geometry update까지 owner를 유지하지만 host State는 종료 뒤 widget 조회를 금지하므로, remove 시 자식이 살아 있는 동안 핸들 연결을 해제하고 cached owner를 비운다. callback이 실패해도 listener 제거·geometry 예약을 마친 뒤 오류를 모아 보고한다. geometry 알림 자체의 deferred 흐름은 유지한다. 실패 receipt/history와 [감사](.tmp/work8/selectable-region-retirement-audit.json)를 보존했고, 영향을 받은 기존 delegate·container Root·paragraph Root·inline delegate·scroll delegate·listener/status **6개 family**도 다시 통과했다.

Core build는 통과했다. Browser native context menu는 DOM platform-view provider의 명시한 embedding 경계를 추가했으며, 해당 provider가 없는 Web desktop에서는 미지원 오류를 낸다. DOM interception을 구현했다고 표시하지 않는다. SelectionArea/디자인 controls, 전체 원본 State 비교·keyboard/shortcut, browser provider·public exports/외부 소비·origin/coverage·batch·여섯 runner 공급·native/header/UI와 나머지 W8 구현·최종 수락을 계속한다. 현재 scoped proof family는 **19개**, 전체 W8은 **ACTIVE / PARTIAL**이다.

### 10.20 전체 Region 원본 비교·실제 keyboard·tap group identity — 2026-10-14, 진행 중

수정하지 않은 전체 SelectableRegion/State·private action 선언 6개·status 선언·editing intents/delegate와 원본 overlay/control/magnifier/value를 실행했다. **24시나리오 × assertions on/off, 시나리오당 50관찰**에서 여섯 native 정책과 Web desktop/mobile, mouse/touch/stylus, 연속 tap 6회·drag·long press·우클릭 토글·Shift, pending 양 edge·원본 stop-start 비대칭, 핸들/magnifier 정보·action/menu/clipboard/process/share, reversed/missing edge·orientation을 비교했다. 원본 framework/focus/keyboard/geometry/selection delegate/scheduler/platform service/browser view는 제어한 수신기다. 제품은 actual Root·Elements·Overlay·Focus·Actions·post-frame scheduler/codec과 제어한 selectable query/event·browser enabled/hook을 사용한다. [전체 원본 증거](.tmp/work8/selectable-region-source-result.json).

원본 비교에서 action map의 adjacent-line/document-boundary 순서를 원본대로 보정했다. event 수신기의 null granularity 기본값은 canonical `character`로, enum 관찰은 이름으로 맞췄으며 원본 선언을 수정하지 않았다. 필수 TapDragEndDetails count·source typedef를 빠뜨린 초기 fixture도 고쳤다. 차이·보정은 [감사](.tmp/work8/selectable-region-source/fixture-audit.json)에 보존한다. 재사용 원본의 이전 receipt는 mutable 결과 경로 대신 immutable SHA 경로로 연결한다. 이전 Root/overlay 보정 감사의 당시·현재 receipt도 immutable bytes로 특정했다.

Region·핸들·toolbar의 TapRegion group을 실제 **SelectableRegion constructor token**으로 통일하고 임시 group 모듈을 제거했다. Core ESM cycle을 포함한 실제 Root 실행도 확인했다. Root 검증은 **9 groups PASS**로 확장했다. 실제 key transport→HardwareKeyboard→Focus/Shortcuts→Region action의 선택/복사/문자 확장과 tap tracking 시 Shift를 확인했다. activator map은 명시한 fixture이며 전체 플랫폼 기본 shortcut map·macOS selector를 수락한 것은 아니다. [Root 증거](.tmp/work8/selectable-region-root-result.json). 변경된 overlay 원본/Root·listener/status도 재검증했고 Core/SDK build·공통 타입 검사를 통과했다.

현재 selection-progress (보관된 과거 기록 `selection-progress.json`)의 scoped proof family는 **20개**다. 기본 text-editing shortcuts/macOS selectors, DOM native 메뉴 provider와 SelectionArea/디자인 controls, public exports/외부 소비·origin/coverage·automatic batch·여섯 runner 공급·native/header/UI 및 나머지 W8 구현·최종 수락을 계속한다. 전체 W8은 **ACTIVE / PARTIAL**이다.

### 10.21 ScrollIntent/Action·실제 keyboard scroll 선행 경로 — 2026-10-14, 진행 중

기본 text-editing shortcut의 선행 의존성인 ScrollIntent/ScrollAction을 추가했다. 가장 가까운 Scrollable과 primary controller의 notification context fallback, physics·axis 검사, line 50px·page 80% viewport와 100ms easeInOut 이동을 연결했다. ScrollIncrementDetails는 source named options와 기존 positional 생성 모두를 받으며, ScrollableDetails의 동일 객체 equality 조기 반환·local hash·Clip 진단 이름도 보완했다. 비동기 이동 실패는 캡처한 application reporter로 전달한다.

수정하지 않은 전체 ScrollableDetails·increment enum/details·intent/action을 **26사례 × assertions on/off**로 비교했다. 원본과 제품의 context lookup·controller/position/physics/calculator/curve 경계는 제어한 수신기다. 양 축/방향·line/page/custom·wrong-axis·unlaid·primary 없음/단일/다중·notification 없음·assertion 정책과 값의 copy/alias/equality/hash 함의를 확인했다. identity hash 표기는 정규화하며 Dart VM hash 수치와 동일하다고 주장하지 않는다. [원본 증거](.tmp/work8/scroll-actions-result.json).

**실제 Root 6 groups PASS:** 네 방향의 실제 ScrollableScope·position·DrivenScrollActivity에서 50px line의 **100→125→150, 0/50/100ms**와 page 80px을 확인했다. 실제 primary notification-context fallback, active scroll 중 Root 종료, physics/교차 축 거부도 확인했다. 처음에는 operation duration 대신 controller의 nullable 기본 duration을 조회한 fixture 가정이 잘못됐으며, 실제 elapsed frame 진행으로 검증하도록 고쳤다. 실패 receipt는 history에 보존한다. [Root 증거](.tmp/work8/scroll-actions-root-result.json).

Core build와 영향받은 paragraph Root·scroll selection delegate 재검증은 통과했다. 현재 scoped proof family는 **22개**다. 전체 기본 플랫폼 shortcut map/macOS selectors, browser DOM 메뉴·SelectionArea/디자인 controls, public 공급·origin/coverage·automatic batch·여섯 runner/native/UI 및 나머지 W8 최종 수락을 계속한다. 전체 W8은 **ACTIVE / PARTIAL**이다.

### 10.22 기본 text-editing shortcuts·macOS selectors·실제 키 경로 — 2026-10-14, 진행 중

고정 원본의 전체 DefaultTextEditingShortcuts class·selector 함수·editing intent 선언과 Scroll/Focus/Dismiss intent를 수정하지 않고 실행해 플랫폼 map을 추출했다. 8개 제품 map과 macOS selector **42개**를 실제 타입의 TS 생성자 호출로 저장하며 앱은 Dart나 생성기를 요구하지 않는다. 원본 Android/Fuchsia·macOS/iOS map 공유, native Apple/Web 내부 disabling scope와 Web Linux numpad 추가를 연결했다. [고정 recipe](Nelyx/upstream/text-editing-shortcuts.json)와 `generate-text-editing-shortcuts-data.mjs --check`로 LF 기준 원본·도구·fixture·출력 해시를 확인한다. 수정된 제품 파일은 덮어쓰지 않는다. 이 과정은 고정 데이터용 수동 지원 recipe이며 일반 resolved-IR compiler나 automatic batch 완료로 집계하지 않는다.

원본 대조에서 기존 SingleActivator/CharacterActivator의 잘못된 값 비교를 제거했다. 동일한 필드의 서로 다른 객체도 별도 map 항목이며 첫 매칭이 우선한다. SingleActivator의 modifier constructor 검사는 원본처럼 debug에만 적용하고 static key의 identity를 검사한다. Shortcuts는 원본 map 참조와 managed getter, debug label·includeSemantics 기본값을 반영했다. managed 생성자의 기존 Key 인수도 유지한다. 전체 shortcut 진단/menu serialization API 완료를 주장하지 않는다.

**원본 비교 PASS:** 전체 기본 map·wrapper의 **12개 native/Web 조합 × assertions on/off**, selector 42개, source identity로 남는 Web 중복 항목을 확인했다. 별도 전체 SingleActivator/CharacterActivator 원본 비교는 **26사례 × assertions on/off**에서 modifier 양쪽·동시 입력, clone key·repeat/up·NumLock·debug-only constructor 정책을 확인했다. Framework/key/keyboard/diagnostic 경계는 기록한 제어 수신기다. [기본 map 증거](.tmp/work8/default-text-editing-shortcuts-result.json), [activator 증거](.tmp/work8/shortcut-activators-source-result.json).

**실제 Root 10 groups PASS:** 여섯 native 정책의 전체 기본 map으로 실제 key transport→HardwareKeyboard→Focus→Shortcuts→Region의 선택·복사·문자 확장을 확인했다. Web 내부 disabling scope의 editor-style DoNothingAction 차단과 Region fall-through, 같은 필드의 두 activator 첫 매칭·disabled-first 정책, macOS PageDown의 실제 primary controller/DrivenScrollActivity **100→140→180, 0/50/100ms**도 확인했다. 실제 text raster는 CPU CanvasKit이고 clipboard·browser hook은 제어 수신기다. 최초 page fixture가 tight root 높이를 viewport 100으로 오인한 실패 receipt는 보존했고, 실제 100px viewport를 배치해 다시 검증했다. [Root 증거](.tmp/work8/default-text-editing-shortcuts-root-result.json), [fixture 감사](.tmp/work8/text-editing-shortcuts-fixture-audit.json).

Core/SDK build·공통 타입 검사와 영향받은 Region 원본/Root 검증을 통과했다. 현재 scoped proof family는 **25개**다. 실제 browser DOM 메뉴 provider·SelectionArea/디자인 controls, public exports/외부 소비·origin/coverage·automatic batch·여섯 runner 공급·native/header/UI 및 나머지 W8 구현·최종 수락을 계속한다. 전체 W8은 **ACTIVE / PARTIAL**이다.

### 10.23 사용자 요청 중간 마무리·DOM 메뉴 WIP 보존 — 2026-10-14

사용자의 **“일단 작업 중간 마무리하자”** 요청으로 새 구현을 멈췄다. 상태는 **PAUSED / PARTIAL**, `sessionComplete:false`, `wholePlanComplete:false`다. 기본 shortcut 수락 코드는 `36db170`, 이어서 작업하던 DOM 메뉴 연결 초안은 **`3992130`**에 WIP로 저장했다. 중간 체크포인트 (보관된 과거 기록 `pause-checkpoint.json`)와 selection 진행 기록 (보관된 과거 기록 `selection-progress.json`)에 제품·도구 해시, scoped 증거의 현재성, 미완료와 재개 순서를 보존한다. 기존 strict checkpoint와 W6/W7 scratch·과거 실패 증거를 유지한다.

DOM 초안은 View-owned synchronous native selection host 계약, Core PlatformSelectableRegionContextMenu/Render binding, SDK DOM element/style/range와 pointer forwarding·contextmenu channel, bootstrap 전달을 연결했다. 현재 SDK Web은 UI/DOM을 같은 realm에서 실행한다. 이 초안은 **빌드·타입 수준의 PARTIAL**이며 기본 DOM 경로의 실제 Root/브라우저·원본 비교·공급 수락은 **notVerified**다. Source platform-view registry/reset/testing API도 아직 완료하지 않았다.

중간 정리 시 Core/SDK 산출물이 현재 소스와 일치함을 확인하고 공통 타입 검사 **PASS**, 영향받은 Region Root **9 groups PASS**, 전체 Region 원본 **24시나리오 × assertions on/off PASS**, 기본 shortcut Root **10 groups PASS**를 확인했다. 이들 Region/Web 검증의 browser hook은 제어 수신기이므로 새 DOM provider 실행 증거로 승격하지 않는다. 이번 DOM 작업 중 실제 browser/native UI·OS 메뉴·IME/reader/FPS 또는 새 native header 실행은 하지 않았다.

재개 시 먼저 `git status`와 체크포인트의 해시·원본 pin을 확인한다. DOM host의 입력 callback은 현재 Surface.dispose까지 살아 있으므로 **shutdown ingress를 먼저 차단하는 처리와 drain 중 late-input 회귀 검증**부터 마무리한다. 그다음 실제 Core render/hit/transform·가림/clip/paint order·다중 View·callback 재진입/해제, DOM pointer capture/선택 Range·enable/disable와 실제 브라우저 우클릭을 검증한다. 현재 default DOM 경로의 동작을 검증된 것으로 전제하지 않는다.

이후 SelectionArea/디자인 controls, 선택 모듈의 public exports/외부 소비, origin/coverage와 바뀐 automatic batch 재수락, 여섯 runner 공급·필수 Windows/Android/Web 수락 및 나머지 W8 전체 범위를 이어간다. strict checkpoint writer는 origin/dependency/artifact 입력을 먼저 갱신하기 전에는 실행하지 않는다. Apple/Linux 전용 native 수락의 기존 **SKIPPED / provider notVerified** 정책도 유지한다. 이번 중간 구간에서 새 UI 서버·browser tab·ADB 작업은 시작하지 않았으며 종료하지 않은 검증 command도 없다.

### 10.24 현재 상황 문서 갱신 — 2026-10-14

사용자의 **“work8.md에 현재상황 반영해줘”** 요청으로 문서만 갱신했다. 문서 갱신 직전 HEAD `9a55033`과 clean 작업 트리, 현재 package 버전·디자인 소유 위치·고정 원본 HEAD를 확인했다. pause checkpoint의 제품/도구·증거·진행 기록·컴파일 receipt를 합친 **129개 참조 해시가 모두 일치**했다. 이는 저장된 증거 bytes와 현재 입력의 일치 확인이며 runtime 재실행이 아니다.

상단 §0에 현재 구현·검증·미수락·재개 순서를 모았다. **25개 scoped proof 중 직접 입력이 유효한 24개 / 과거 overlay Root 증거 1개**, 재수락할 자동 배치 2개와 수동 origin hash drift 10개, 새 native header·DOM provider·공급/UI 미수락을 구분했다. 초기 검토·당시 실행 기록은 이력으로 남기고, 이미 완료한 W7 승계와 선정 디자인 패키지 이동을 현재 서술에 반영했다. 구현과 기존 checkpoint를 변경하거나 검증을 다시 실행하지 않았으며 **PAUSED / PARTIAL**을 유지한다.
