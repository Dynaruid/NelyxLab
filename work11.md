# work11 — 디자인 패키지 일괄 처리와 Nelyx 기능 동등성 완성 계획

> 2026-10-21 W14 연결: 이 문서의 보고서·validator·재개 지시는 과거 이력이다. W12/W13도 종료됐으며 현재 계획·짧은 진행 상태·재개 기준은 [work14.md](work14.md)를 따르고 실행은 PAUSED다. 필요한 생성 입력/소유권과 라이선스는 유지한다. 과거 checkpoint/handoff·receipt·복구 archive는 삭제했으며 재개 조건으로 요구하거나 복구·재생성하지 않는다.

작성일: **2026-10-18 KST**. 계획: **CLOSED / SUPERSEDED BY W12**, 실행: **SUPERSEDED**, 종료 시 제품 전체: **PARTIAL**, `wholePlanComplete=false`.

사용자 요청으로 W11 계획을 종료하고 남은 필수 작업을 [work12.md](work12.md)로 이관했다. 이후 W12/W13도 종료돼 **유일한 활성 계획은 [W14](work14.md)**이며 현재 `ACTIVE / READY 계획 · PAUSED 실행 · PARTIAL 제품`이다. 재개는 W14 §7을 따르며 삭제한 checkpoint를 요구하지 않는다. 아래 목표·체크리스트·§9의 다음 작업/재개 지시는 당시 이력으로 보존하며 현재 실행 지시가 아니다. 제품 전체 완료나 새 native/물리 환경 검증을 뜻하지 않는다. W11 종료·전 항목 대응은 §10의 이력을 따른다.

## 0. 목표와 확정된 구현 방침

**Material은 M3만 지원한다.** 사용자 지시 “머터리얼2는 안가져올거야 없엘래”에 따라 M2 구현·기본값·선택 API·전용 factory/overlay와 향후 M2·2014/2018 typography 이관 작업을 제외한다. `useMaterial3` 호환 API는 남기지 않는다. 2023 M3 옵션과 M3에서도 사용하는 공통 색상·shape·명시적 ink factory·hairline은 유지한다. 아래 과거 §9의 M2 검증/미완료 언급은 당시 이력이며 현재 구현 또는 남은 목표가 아니다. M3 범위와 최신 증거는 마지막 실행 기록을 따른다.

목표는 기존 Nelyx 기능·공개 API·성능·안정성 요구를 **TypeScript 제품 구현과 기능 동등성 검증**으로 완성하는 것이다. W8/W9/W10에서 승계한 필수 미완료 요구는 유지하되, 남은 Dart 전체 본문 컴파일·전이 의존성 폐쇄·원본 내부 hierarchy 일치를 완료 조건으로 두지 않는다.

**Cupertino/Material 두 패키지는 최대한 일괄 처리한다.** 두 패키지 전체를 한 번에 계획하고, 실행은 기능 family와 공통 의존성 묶음으로 진행한다. **가능한 Flutter Dart 일괄 변환 → 제약 family의 Doroti C# 포트와 변환/보정 비용 비교 → 필요한 Nelyx TypeScript 보완/자체 구현**을 적용한다. 일괄 변환 후 수정도 허용한다. 다른 기능은 기존 Nelyx 기반과 검증된 생성물을 활용해 TypeScript로 구현·보완한다.

| 원칙 | 실행 기준 |
| --- | --- |
| 기능 동등성 | 공개 API·입력/상태 전이·layout/paint/hit/clip·focus/selection·오류/취소·복원/종료의 관찰 가능한 계약으로 판단 |
| 기존 성과 재사용 | 정상 소비 중인 Core/SDK/package·generated/adapter·recipe·cache와 유효한 receipt 보존. 이미 완료한 부분을 원본 구조 차이만으로 재작성하지 않음 |
| 소유권 | 단일 Widget/Element/State/RenderObject·Core identity와 자원 소유권 보존. generated base/effective/product의 3-way merge 또는 명시적 adopted 전환 |
| 타입·숫자 | 구체적인 TypeScript 타입 사용. 기존 Dart-derived `@dartType`·`@dartParam`·`@dartReturn`과 공개 `.d.ts` 숫자 의미 보존. 자체 코드에 허위 Dart provenance를 붙이지 않음 |
| 차이·오류 | 의도적인 API/동작 차이는 이유·영향·검증으로 기록. `any`·빈 구현·가짜 기본값·검증되지 않은 축소 구현으로 동등성을 주장하지 않음 |
| compiler 범위 | 현재 기능에 필요한 유한한 규칙/adapter 보정만 수행. Dart/C# 범용 컴파일러 완성을 제품 작업의 선행 목표로 만들지 않음 |
| 제품 의존성 | Dart SDK·변환기·scratch·Doroti .NET runtime을 제품 build/runtime에 요구하지 않음 |

### 0.1 초기 변환 도구 정리 방침 — 2026-10-18

`tools/Nelyx.FrameworkToTypeScript`는 초기 개발용 중간 변환 도구다. 사용자 요청에 따라 `checks` 전체와 그 안의 fixture·harness·재개/검증 스크립트, 별도 `dart/bin/extract_platform_fixture.dart`를 삭제한다. 변환기 본체와 제품 TypeScript·생성 데이터·출처/숫자 주석은 유지한다. 이후 변환기 fixture/checks의 복구·확장·상시 회귀를 W11 필수 작업이나 완료 조건으로 두지 않는다.

검증은 실제 제품의 공개 API·동작·상태·수명·영향 플랫폼/공급을 기준으로 수행한다. 과거 recipe·receipt·§9 실행 기록은 당시 증거로 보존하며 삭제한 스크립트의 실행 지시로 해석하지 않는다. 삭제된 validator를 가리키는 기존 recipe의 `resume all`·validate/promote를 그대로 실행하지 않는다. 필요한 recipe를 다시 사용할 경우 현재 제품 기준의 명시적 검증 경로를 먼저 연결하며, 검증 누락을 PASS로 처리하지 않는다. 임시 도구 자체의 장기 유지·회귀는 요구하지 않는다.

현재 `IN_PROGRESS / PAUSED / PARTIAL`과 M3 전용 방침, 제품 기능·실제 환경·출처·소유권 요구는 유지한다. 재개 시 삭제된 `w11-resume.mjs` 대신 활성 기록의 현재 입력/receipt/control hash와 의도적 삭제 목록을 확인한다. 의도적 삭제 목록은 도구 정리 기록 (보관된 과거 기록 `w11-intermediate-tooling-cleanup.json`)을 따른다.

기술 결과는 `검증 완료`·`완료 기준 충족`으로 표현하고 `PASS / PARTIAL / FAIL / SKIPPED / notVerified`를 구분한다. 계획·파일 수·IR 수·타입검사 성공을 제품 완료로 계산하지 않는다.

## 1. W10 종료와 승계한 현재 상태

### 1.1 종료 경계와 증거

W10-00·01은 완료 이력으로 보존한다. W10-02~12의 미완료 요구는 §2에서 W11 단계에 모두 대응시켰다. **W10 계획 종료는 제품 전체 완료를 뜻하지 않는다.** 과거 구현·원본 비교·실제 공급 결과는 [W10 실행 이력](work10.md#8-상태-클래스상속-compiler-확장--2026-10-16-kst)과 immutable receipt에 남긴다. 과거 문서·source part의 “다음 작업”은 현재 지시가 아니다.

| 승계 대상 | 현재 의미 |
| --- | --- |
| 시작 상태 | HEAD `49152f35c76c944387ff09a3ccb248692c1b020f`. 이전 계획 반영의 dirty 문서/control·검토 JSON과 빈 `work11.md`를 보존하며 시작 |
| 이관 전 무결성 | 입력621·receipt12927 및 progress/handoff/checkpoint 연결 hash 일치. 이관 후 최신 개수·연결은 W11 checkpoint 참조 |
| 제품 기반 | owning source605·promoted state26·sample/runner5 보존. wheel19·2D21·tree18/public7·typedef4·Viewer16·Scrollbar family43·behavior/stretch10의 scoped 통합 이력 재사용 |
| 최신 생성/언어 검증 | W10 §8.119의 fresh26 fixture·IR181·생성 출력39 byte 동일, const Set·generic 상수 및 영향 회귀. 이번 이관으로 재실행하거나 범위를 확대하지 않음 |
| 도구 | resolved Dart IR/body emitter·batch compose/validate/promote·내용/AST 캐시·실제 compiler bytes identity. C# draft reader/lowerer는 제한된 별도 경로 |
| 공급 이력 | W10 §8.95 archive의 Windows/Android48·각 cold3프로세스/7흐름·Android 실제 EditText는 해당 archive의 PASS-scoped |
| 최신 미검증 | W10 §8.119 Core3 변경 후 최신 archive/native source parity는 **notVerified**. 물리 IME/caret/FPS·Windows native 편집기 픽셀·hardware GPU와 전체 통합도 미완료 |
| 선택 compiler backlog | 과거 navigation recursive IR1826·unsupported45·위치6·SDK261/기타17, route emission NavigatorState binding BLOCKED. 제품 기능의 무조건적인 선행 조건에서 분리 |

위 결과는 입력·도구·환경·artifact가 같은 범위에서만 재사용한다. 과거 DOM bounds FAIL·Windows 장애·선택 source blocker를 최신 증거와 대조하지 않고 현재 제품 실패로 복사하지 않는다.

### 1.2 현재 기록과 과거 기록

| 용도 | 기록 |
| --- | --- |
| 활성 계획 | [work14.md](work14.md) — W13 종료 후 잔여 작업의 단일 활성 계획 |
| W11 역사적 진행 | w11-progress.json (보관된 과거 기록 `w11-progress.json`) — CLOSED/SUPERSEDED |
| W11 종료 checkpoint | w11-active-checkpoint.json (보관된 과거 기록 `w11-active-checkpoint.json`) — 과거 증거 연결 |
| 현재 진행·재개 | [work14.md §7](work14.md#7-현재-상태와-다음-재개) — 짧은 상태와 현재 소스 기준, 별도 handoff/checkpoint 없음 |
| 종료·이관 근거 | w11-plan-transfer.json (보관된 과거 기록 `w11-plan-transfer.json`) |
| W10 증거 ledger | w10-progress.json (보관된 과거 기록 `w10-progress.json`) — CLOSED/SUPERSEDED, 입력·receipt·qualification 이력 보존 |
| 디자인 소스 검토 | w10-design-package-source-review.json (보관된 과거 기록 `w10-design-package-source-review.json`) — 당시 정적 검토, 새 변환 검증 아님 |
| 기능 동등성 결정 이력 | w10-typescript-equivalence-handoff.json (보관된 과거 기록 `w10-typescript-equivalence-handoff.json`) |

기존 `archived record: work8`의 recipe/state/origin·immutable receipt와 `.tmp/work8`의 도구/cache 위치는 재사용한다. 새 계획 번호 때문에 source·schema·수천 개 receipt를 대규모 이전하거나 다시 생성하지 않는다. W10/W11 checkpoint는 종료 기록으로 남기며 재개는 W12 checkpoint를 따른다.

## 2. 남은 작업의 단계 이관표

단계 번호는 의존성 대기 순서가 아니다. **W11-01 디자인 일괄 처리부터 시작**하고 필요한 runtime·편집·앱·개발 접점을 W11-03/04/05/07에서 함께 공급한다. 이후 잔여 scroll·플랫폼/공급을 닫는다. 접근성·임베딩은 후속 범위를 유지한다.

| W11 단계 | 이관 출처 | 시작 상태 | 남은 범위·종료 조건 |
| --- | --- | --- | --- |
| **W11-00 계획 이관** | W10 종료·최신 정책 | COMPLETE (문서만) | W10 close·미완료 대응·증거/코드 보존·활성 계획/진행/checkpoint 연결. 제품 구현 완료로 세지 않음 |
| **W11-01 디자인·locale 일괄 처리** | W10-06·DESIGN-0~4 | PARTIAL | §9의 palette·theme·선정 App/locale·button/checkbox/radio/switch/activity/progress/slider/range 공급. 두 패키지 전체 계획·family 변환/보정·공개/default API·전체 지원 locale/RTL·data/icon/font/asset/notice·독립 소비는 계속 진행 |
| **W11-02 scroll·viewport·변환** | W10-02 | PARTIAL | 추가 animated API·Page/Nested/header/refresh/reorder/dismiss/sheet 복원·mixed sliver·first seek·keyed State/selection·입력/resize/mutation/restore/close·영향 공급/성능 |
| **W11-03 runtime·paint·text·입력** | W10-03 | PARTIAL | §9.20 runtime program cache·현재 Android default InkSparkle 입력/해제 선정 검증. 나머지 service/worker 초기화·stop·cache/retirement·wide-gamut/output·bitmap·font/typography·pointer/animation API·backend 오류/복구/drain·수명 |
| **W11-04 편집·Form·입력** | W10-04 | PARTIAL | grapheme/formatter·style/API·undo/autofill·toolbar/selection·multi-View/provider·OS touch/menu/keyboard/caret·실제 IME·복원/해제 |
| **W11-05 앱·라우팅·복원** | W10-05 | PARTIAL | app/navigator/router/routes·overlay/Hero·async·locale resolution·OS link→nested Form/list/dialog→Back→locale→process recreation/restore/close·drain |
| **W11-06 플랫폼 runtime/tooling** | W10-07 | PARTIAL | 여섯 host/tool·SDK/CLI/Metro/provider·runner/template·native/Skia/texture·배포·Core 단일 identity·선택 설치/로드·역의존 제거·공급 구성 |
| **W11-07 개발 갱신·inspector** | W10-08 | OPEN | 실제 hot reload/reassemble·diagnostics/inspector·source map/preview/service extension·State 유지·reload/remount·cleanup |
| **W11-08 우선 실제 환경·감사·공급** | W10-09 | PARTIAL | Windows/Android/Web 실제 입력·IME·성능/FPS·resize·hidden/resume·GPU loss·복구/종료·archive/외부 소비·version/lock·signing/clean-machine·출처/재현 |
| **W11-09 후속 A 접근성** | W10-10 | DEFERRED | 설정→View/MediaData·semantics tree/ack/action/metadata·실패 owner 회복·reader·Apple/Linux producer 코드·영향 기능 |
| **W11-10 후속 B native/HTML view** | W10-11 | DEFERRED | 생성/부착/배치/합성·clip/transform/z-order·focus/input·해제/복구·route/scroll/overlay/reload 결합 |
| **W11-11 전체 통합·정리** | W10-12 | OPEN | 후속 영향 회귀·최종 실제 환경/공급·기능/출처/consumer/배포 감사·재현 입력·문서/정리·전체 완료 판정 |

원래 W8/W9에서 승계한 필수 기능/API·locale·플랫폼·개발·성능/안정성·배포 요구도 해당 W11 단계에 남는다. 기존 scoped 구현을 전체 단계 완료로 확대하지 않는다. W10-00·01의 완료 이력은 재작업 단계로 만들지 않는다.

## 3. 첫 구현 대상: Cupertino/Material 최대한 일괄 처리

### 3.1 소스 선택과 확인된 제약

두 대상은 `packages/cupertino`·`packages/material`이다. 우선 입력은 `.tmp/work6/flutter-source`의 고정 Flutter pin이며, 대안은 `C:\Users\parti\Labo\DorotiLab\packages\Doroti.Cupertino`·`Doroti.Material`이다.

W10 정적 검토의 파일 목록은 Flutter Cupertino52/Material198 Dart, Doroti52/202 C#, Nelyx20/21 TS다. 생성물·helper·GlobalUsings·animated icon 데이터가 포함된 수로 API 충족률을 뜻하지 않는다. Doroti 검토 pin은 `6778077f9f71ffd0d31652a51efca0163dcc348f`이며 사용 시 현재 HEAD/bytes를 다시 확인한다.

| 경로 | 선택 기준 |
| --- | --- |
| Flutter Dart → TS | 기존 IR/body emitter·recipe/cache/compose/검증을 활용할 수 있는 family의 우선 경로. 전체 디자인 패키지의 무제약 변환은 아직 검증하지 않았으므로 실제 family 후보로 판단 |
| Doroti C# → TS | Dart에서 막힌 family의 대안. 현재 SourceReader는 단일 tree/.NET 기본 참조이고 project·GlobalUsings·partial closure를 해석하지 않음. lowerer도 상속/generic·nullable/generic type·named/ref 인자·virtual/override/setter·대부분 문장을 거부하므로 즉시 전체 자동 변환이 가능하지 않음 |
| Nelyx TypeScript | 두 경로의 필요한 보정량·검증 비용이 비실용적일 때 해당 family를 보완/구현. 기능 요구와 출처·소유권을 유지 |

막힌 family는 소스 양쪽의 frontend/lowering·Core binding·API/동작 차이·보정/검증 비용을 비교한다. C# 경로 선택 시 project/partial/global-using·필요 언어/runtime 의미와 재생성/수정/충돌 보존을 대표 묶음으로 확인하고 확대한다. `reviewed` marker·C# build 성공·파일 수를 최신 Flutter 동등성으로 간주하지 않는다.

Doroti의 Runtime/Ui/framework는 Nelyx Core에 binding하며 별도 identity로 가져오지 않는다. Material의 Cupertino·별도 icon 패키지·`MaterialColorUtilities`·`ink_sparkle.sksl` 의존성은 TS/asset 공급에 대응시킨다. Doroti 기본 localization delegate는 영어이고 최신 Flutter 동기화를 주장하지 않는다. 변환 comment의 원본 `reference/flutter-master`가 검토 당시 checkout에 없었으므로 Doroti HEAD/bytes와 선택 기능의 Flutter API/동작 대조를 사용한다. 전체 locale·font/icon·shader/license/notice 요구는 별도로 검증한다.

### 3.2 일괄 실행 묶음

| 묶음 | 범위와 결과 |
| --- | --- |
| **DESIGN-0 전체 계획·mapping** | 두 패키지의 전체 공개 API/선정 기능·private helper·Core/package 의존성/SCC·source 선택·destination/export·generated/adopted 소유권. 기존 file inventory와 검증된 scrollbar/behavior/dynamic-color/selection 경로 재사용 |
| **DESIGN-1 디자인 기반** | constants/colors·theme/color scheme·text theme/typography·공통 타입/기본값·M3 only·Cupertino dynamic/high-contrast/brightness·locale/icon/font/asset 경계 |
| **DESIGN-2 기본 컨트롤** | button/ink/focus/state property·activity/progress·checkbox/radio/switch/slider/chip·관련 theme·State/private helper·animation/gesture 의존성을 함께 처리 |
| **DESIGN-3 복합 family** | list/form/text-field/selection·menu/context-menu/tooltip·dialog/sheet·picker/date/time. dependency component별 일괄 후보·보정 및 편집/overlay/scroll·locale/RTL·복원/해제 |
| **DESIGN-4 App·공개/공급** | CupertinoApp/MaterialApp·scaffold/bar/tab/navigation/route/Hero/adaptive·exports·독립 consumer·locale/asset/notice·공개/default App·영향 package/browser/native 공급 |

순서는 실제 의존성에 따라 조정한다. 모든 family가 끝나야만 App을 연결하는 장벽을 만들지 않는다. Material↔Cupertino theme/adaptive 및 공통 navigator/inspector 접점은 W11-05/07과 연결하고 한 번 구현한 mapping을 재사용한다. 파일마다 전체 build/browser/native를 반복하지 않는다.

### 3.3 후보에서 제품까지

1. family 전체의 소스 pin/hash·본문/helper·필수 Core binding·공개 타입·동작/수명 계약을 정한다.
2. 가능한 모듈을 scratch에 일괄 변환하고 공통 진단을 모은다. 미지원 본문을 stub으로 통과시키지 않으며 독립 모듈은 계속한다.
3. Dart 제약 family만 Doroti 변환 경로와 비교한다. 더 적은 정당한 보정으로 기능 계약을 충족하는 경로를 고르고 한 클래스의 서로 다른 State/Theme 구현을 혼합하지 않는다.
4. 일괄 결과를 보정하고 실제 Core·package·공개/default 소비에 연결한다. 3-way merge 또는 adopted 전환으로 직접 수정과 재생성의 소유권을 명확히 한다.
5. strict/public `.d.ts`·숫자 출처·실제 Widget/State·입력/focus/selection·theme/locale/RTL·animation·복원/해제·독립 consumer·영향 공급을 묶음별 검증한다. borrowed code/data/asset의 출처·pin/hash/license/notice를 연결한다.

- [ ] DESIGN-0의 API/기능 범위·mapping·family별 소스 선택 확정. 파일 inventory만으로 완료 처리하지 않음.
- [ ] DESIGN-1 디자인 기반 후보·보정·제품 소비·검증.
- [ ] DESIGN-2 기본 컨트롤 후보·보정·제품 소비·검증.
- [ ] DESIGN-3 복합 family 후보·보정·제품 소비·검증.
- [ ] DESIGN-4 App·공개/default API·locale/asset·독립 소비·영향 공급 검증.

## 4. 나머지 기능별 실행 작업

### 4.1 W11-02 scroll·viewport·변환

- [ ] 기존 wheel/2D/tree/Viewer/Scrollbar/behavior 통합을 재사용하고 남은 animated API와 Page/Nested/header/refresh/reorder/dismiss/sheet의 실제 누락을 확인·보완.
- [ ] mixed sliver·first seek·key/offset 복원, mutation/resize 중 keyed State/editor/focus/selection 보존과 selection auto-scroll·active owner 종료 검증.
- [ ] 입력·layout/paint/hit/clip·restore/close 및 영향 browser/packed/native 소비·성능 요구 충족. 전체 Dart hierarchy 생성은 선행 조건이 아님.

### 4.2 W11-03 공통 runtime·paint·text·입력

- [ ] foundation/scheduler/services·service/worker 초기화·취소/stop·cache/retirement·오류/복구/drain과 앱/View 자원 수명 보완.
- [ ] painting/rendering·wide-gamut rendering/output·bitmap/image cache·font/typography·paragraph/style/strut/hyphens 등 승계한 남은 출력·측정 계약 확인·완성.
- [ ] gestures/focus/keyboard·pointer/animation/physics의 남은 공개 API와 실제 backend 접점 검증. 이미 검증된 공통 identity·이미지/animation 경로를 재구현하지 않음.

### 4.3 W11-04 편집·Form·입력

- [ ] editable/render editable·text input/editing/delta·formatter/grapheme·style/API·undo/autofill·toolbar/selection의 미완료 계약 보완.
- [ ] 여러 필드·Form·조합 안전·scroll·selection/paragraph fragments·복원/해제, multi-View/provider·OS touch/menu/keyboard/caret 접점 검증.
- [ ] DOM/native transform·font/style·caret·hit/clip·동일 editor/focus 수명과 실제 IME 요구 완료. synthetic composition과 Android emulator EditText를 물리 IME/caret pixels 검증으로 확대하지 않음.

### 4.4 W11-05 앱·라우팅·복원

- [ ] app/navigator/router/routes·overlay/Hero·async·locale resolution의 기능과 공개/default API 누락을 W11-01 App 묶음과 함께 연결.
- [ ] 기존 저장/URI producer를 재사용해 OS link→nested Form/list/dialog→Back→locale 변화→process recreation/restore/close의 남은 조합 검증.
- [ ] current copied Windows/Android 후보의 예외·취소·animation/overlay·native drain·종료 수명 검증. 원본 NavigatorState 전체 컴파일을 요구하지 않음.

### 4.5 W11-06 플랫폼 runtime/tooling 분리

- [ ] 여섯 host/tool·SDK/CLI/Metro/provider·runner/template의 선택 설치/로드·runtime/tooling 역의존 제거·Core 단일 identity 확인.
- [ ] 일반 native/Skia·공통 texture·OS adapter·앱/View 종료/ack와 target별 공급/배포 구성 완료.
- [ ] 여섯 target 공통 코드·package/runner/template·공급 구성을 확인하고 Windows/Android/Web 필수 실제 환경 수명 검증. native 예외는 §5.2 유지.

### 4.6 W11-07 개발 갱신·inspector

- [ ] 최종 package 구조에서 Web 실제 수정·hot reload/reassemble·State 유지·source map/preview·diagnostics/inspector/service extension 연결.
- [ ] Windows/Android 실제 reload/remount 정책·State/자원 소유권·실패 회복·cleanup 검증. compiler draft/타입검사로 개발 흐름 완료를 대체하지 않음.

### 4.7 W11-08 우선 실제 환경·감사·공급

- [ ] 변경된 Core3와 이후 W11 구현의 source/JS/`.d.ts`/map·archive·설치 bytes를 확인하고 최신 외부 consumer/browser/Windows/Android 공급 검증 갱신.
- [ ] 실제 입력·물리 IME/caret·성능/FPS·Windows editor pixels·hardware GPU, resize·hidden/resume·GPU loss·복구·close/drain의 필수 요구 검증.
- [ ] package/version/range/lock·여섯 target 공급 구성·signing/clean-machine·출처/license/notice·재현/배포 감사 후 우선 범위 완료 판정.

### 4.8 W11-09 후속 A 접근성

- [ ] 기존 Web/OS 설정 scoped 결과를 보존하며 native 설정/알림→실제 View/MediaData·semantics tree 제출/ack/해제·metadata/action 완성.
- [ ] callback 교체/실패 owner 회복·reader·영향 디자인/입력 수명, Apple/Linux producer 코드를 기존 검증 예외 범위에 맞춰 완료.

### 4.9 W11-10 후속 B native/HTML view

- [ ] 임베딩 생성/부착/배치/합성·texture/ViewApi/header adapter·clip/transform/z-order·focus/input·해제/실패/복구 완성.
- [ ] route/scroll/overlay/reload와 결합한 실제 합성·입력·종료 검증. 일반 host·IME·keyboard/menu·앱/View 수명을 이 단계 전체로 미루지 않음.

### 4.10 W11-11 전체 통합·최종 정리

- [ ] 접근성·임베딩 영향 회귀와 최신 package/실제 환경/공급 증거 갱신.
- [ ] 전체 선정 기능/API·locale·플랫폼/개발·성능/안정성·출처/consumer/배포 요구 감사와 재현 입력·문서·임시 자원 정리.
- [ ] 필수 미구현·FAIL·notVerified가 없는지 확인한 뒤 전체 완료 판정. 후속이 남으면 전체 PARTIAL 유지.

## 5. 검증·완료 기준과 실행 비용

### 5.1 검증을 모으는 기준

| 변경 | 필수 검증 |
| --- | --- |
| TypeScript 기능/통합 | 영향 package/dependent 타입·빌드, 독립 기대값의 API/Root·사용자 흐름·오류/수명/복원·필요 실제 backend |
| 생성기/생성 코드 | 제품에 반영하는 범위의 의미·공개 타입·숫자 출처·소유권/충돌 보존 확인. 삭제한 변환기 fixture/전체 배치 회귀는 필수 아님. 기존 recipe 재사용은 §0.1의 검증 경로를 먼저 확보 |
| 공급/구조 전환 | 동일 source/artifact의 archive·외부 consumer·설치 bytes·실제 EXE/APK 실행/restore/close. 구조 전환/최종 후보에서 여섯 target 공급 구성 확인 |
| 문서·checkpoint | 입력/receipt/control hash·단계 대응·기존 코드/증거 보존·소유 실행/lock/설정 정리. runtime 전체 재실행 없음 |

같은 입력·도구·환경·artifact의 유효 결과를 재사용하고 변경·실패·필수 gate 누락이 있는 영향 범위만 다시 실행한다. controlled receiver·Core·browser·native archive·물리 장비 관측을 구분한다. 구현을 복사한 기대값으로 검증하지 않으며 CPU Root 결과를 native FPS로 바꾸지 않는다.

[.github/copilot-instructions.md](.github/copilot-instructions.md)에 따라 테스트는 **20분(1,200초)** timeout을 적용한다. 삭제한 `run-check.mjs` wrapper는 요구하지 않으며 실행 환경에서 제한 시간을 설정한다. 대부분의 반복 검증은 30회 이내로 제한하며 같은 checkout Dart 분석은 직렬 실행한다. 제품 패키지 변경마다 `build:sdk`나 전체 native 공급을 반복하지 않는다.

### 5.2 플랫폼 범위

Windows/Android/Web은 필수 실제 환경이다. **iOS/macOS/Linux 전용 native build/run·물리 입력·서명·전용 harness는 기존 사용자 결정의 `SKIPPED`, provider는 `notVerified`를 유지**한다. 여섯 target 공통 TS·코드·package/runner/template·공급 구성 의무는 유지한다. 이 예외를 여섯 native target 전체 PASS로 표현하지 않는다.

### 5.3 종료 조건

**파트 완료:** 선정 기능과 공개 타입/API가 실제 제품에서 소비되고, 상태/layout·입력/편집·오류/취소/복원·자원 수명·필요 성능·영향 플랫폼/공급 계약을 만족한다. 자체 TS 구현도 가능하며 기존 생성 부분의 source 의미·숫자 출처·license·ownership gate는 유지한다.

**우선 범위 완료:** W11-00~08의 필수 조건을 모두 충족한 뒤 `우선 범위 완료 / 전체 PARTIAL`로 기록한다. W11-09·10은 미완료로 남는다.

**전체 완료:** W11-09·10과 영향 통합/공급까지 마친 W11-11에서 판정한다. 범용 Dart/C# 문법 지원·원본 전수 inventory missing0·전체 원본 hierarchy 폐쇄는 제품 완료 조건이 아니다.

## 6. 선택 compiler backlog

W10에서 남은 const collection spread/if/null-aware·추가 constant/list/or-join pattern·generator/collection loop·lazy global/member 문법·extension-type/getter/setter owner 탐색·전체 source hierarchy/SDK closure는 선택 후속 작업으로 남긴다. C# project/partial/global-using·상속/generic/runtime lowering도 실제 선택 family에 필요한 범위만 검토한다.

기능 해결에 필요하거나 별도로 요청된 경우만 수행하고, 미지원 의미는 명시적 진단으로 유지한다. 이 backlog 수를 W11 기능 완료율이나 필수 잔여 수로 사용하지 않는다. 생성 경로를 다시 사용할 때에는 캐시 identity·제품 소유권을 보존하고 §0.1에 따라 현재 검증 경로를 연결한다. 삭제한 fixture/checks를 다시 만드는 것은 필수 작업이 아니다.

## 7. 재개 순서와 기록 규칙

1. W11 checkpoint → progress → 공통 handoff의 activePlan/hash를 확인하고 diff·dirty 상태·계승 W10 ledger 입력/receipt·Flutter pin을 검증한다. 현재 Doroti 소스를 선택하면 review pin/bytes와 drift도 확인한다.
2. W11-01 DESIGN-0의 기존 소스 목록을 재사용해 실제 공개 API/기능·Core mapping·family/source/ownership을 확정한다. DESIGN-1 및 필요한 App/runtime 접점을 첫 일괄 후보로 진행한다.
3. 기능 묶음별 구현·검증·출처/차이·유효 증거·남은 조건을 한 묶음으로 기록한다. 미사용 후보·IR 추출·컴파일만으로 체크하지 않는다.
4. 영향 검증 후 기본 제품 경로·공개 API·현재 공급·진행/체크리스트를 함께 갱신한다. 사용자 수정·병합 충돌과 immutable receipt를 보존한다.
5. 중간 마무리 시 sample/runner·임시 설정/lock·소유 process를 정리하고 current checkpoint에 정확한 PAUSED/PARTIAL·다음 작업·hash를 남긴다. 공유 서비스는 임의 종료하지 않는다.

## 8. 전체 실행 체크리스트

- [x] **W11-00 계획 이관:** W10 CLOSED/SUPERSEDED·W10-02~12의 전 항목 대응·증거/코드 보존·W11 활성 기록 연결. 문서 작업 완료이며 제품 완료 항목은 추가하지 않음.
- [ ] **W11-01 디자인·locale:** DESIGN-0~4 일괄 후보/보정·선정 API·전체 지원 locale/asset·독립 소비·영향 공급 완료.
- [ ] **W11-02 scroll:** 잔여 animation·Page/Nested/header/refresh/reorder/dismiss/sheet·mixed/first seek/keyed selection·복원/close·공급/성능 완료.
- [ ] **W11-03 runtime:** 공통 service/worker·paint/image/font/text·입력/animation·오류/복구/drain·backend 완료.
- [ ] **W11-04 편집:** Form·grapheme/style/undo/autofill/toolbar/selection·multi-View·native menu/keyboard/caret·실제 IME 완료.
- [ ] **W11-05 앱 흐름:** app/route/overlay/Hero·OS link/Back/locale·cold restoration·native drain 완료.
- [ ] **W11-06 플랫폼:** 여섯 host/tool·SDK/CLI/Metro·runner/template·Core identity·선택 공급 구조·필수 환경 수명 완료.
- [ ] **W11-07 개발:** 실제 hot reload/reassemble·State 유지·inspector/source map/preview·cleanup 완료.
- [ ] **W11-08 실제 환경·공급:** 최신 source/archive/native parity·물리 입력/IME/caret/FPS·복구/종료·출처/배포/재현 감사·우선 범위 판정 완료.
- [ ] **W11-09 접근성:** 설정→View·tree/ack/action·reader·실패 owner 회복·영향 기능 완료.
- [ ] **W11-10 임베딩:** native/HTML view 합성·입력/focus·route/scroll/overlay/reload·해제/복구 완료.
- [ ] **W11-11 최종 통합:** 후속 회귀·최종 실제 환경/공급·감사·문서/정리·전체 완료 판정.

**W11 실행은 CLOSED / SUPERSEDED BY W12다.** 아래 선정 묶음은 당시의 구현·검증 이력이며 제품 전체는 PARTIAL이다. 현재 실행 상태와 다음 작업은 W12 기록을 따른다.

## 9. 구현 실행 — 2026-10-18 KST

### 9.1 디자인 기반 첫 묶음

재개 시 현재 HEAD `0392f8589db4178454e92fd2dae24546fec6e7a0`와 이관 당시 HEAD의 조상 관계를 확인했다. W11 입력7·receipt9, 계승 W10 입력621·receipt12927, owning source605·promoted batch26의 bytes를 검증했으며 Flutter pin은 그대로다. 기존 변경이 없는 상태에서 시작했고, 기존 sample/runner 설정과 Core 제품 본문은 수정하지 않았다.

- [전체 디자인 매핑](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-package-plan.json): Cupertino52/Material198 파일, 공개 선언121/521, private/member span·export·dependency owner·SCC143·destination을 함께 기록한다. 이는 실제 전체 API 동등성 검증이나 DESIGN-0의 최종 source/behavior mapping 완료가 아니다.
- Cupertino palette는 기존 resolved Dart IR/emitter로 `CupertinoColors` 공개47 필드 전체를 생성해 새 `w11-cupertino-palette` recipe로 검증·승격했다. 원본 전체 본문 Dart oracle에서 8변형×47=376개 값을 대조했다. alias와 Core const identity·불변성을 유지한다.
- Material palette는 generic `ColorSwatch` superclass binding 제약을 확인하고 현재 Doroti pin/bytes·generic base/indexer/virtual/runtime 보정 비용을 대조했다. 고정 Flutter 원본 데이터와 작은 TS swatch 포트를 선택했다. 공개54 필드·모든 shade·primaries18/accents16 목록을 원본 전체 Material/ColorSwatch/UI Color Dart 실행과 대조했다. 일반 `ColorSwatch<T>` 상속·lerp는 아직 구현하지 않았으며 palette family 전체 완료가 아니다.
- [디자인 데이터 소유권](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-design-data-ownership.json)은 원본 palette, M3 2021 English-like/dense/tall scale, M3 ThemeData 색상 기본값의 AST 제한 추출과 출력 hash를 고정한다. 직접 수정된 제품 데이터의 재생성은 거부한다. 제품 build/runtime에 Dart·scratch·Doroti 의존성을 추가하지 않았다.
- `ColorScheme`의 ARGB 역할49개와 값 복사/비교/보간, `TextTheme`의 nullable 역할15개와 copy/merge/apply/lerp/ambient lookup을 공급했다. `ThemeData.textTheme`·`primaryTextTheme`와 실제 `DefaultTextStyle` 소비를 연결했다. seed 생성·전체 M2/2014/2018·locale별 scale 선택 및 나머지 ThemeData API는 미완료다.
- Cupertino의 theme/text-theme 기본값을 확장하고 `widgets`와 `theme`의 `CupertinoTheme`을 같은 inherited class로 통합했다. 기존 `(child, AppThemeData?)` 생성과 canonical `(CupertinoThemeData, child)` 생성을 유지한다. 숫자 ARGB 경계, 전체 theme API 및 font 공급의 미완료 범위를 유지한다.
- 초기 ESM 순환을 brightness 조회 bridge로 해소했다. 이후 원본 회귀가 Babel→ESM 사이 bridge 공유로 조회 dependency가 달라지는 harness 오류를 검출했다. 각 loader가 전체 디자인 closure를 갖도록 수정했으며 기대값이나 원본 조회 조건을 완화하지 않는다. 최신 영향 회귀 상태는 checkpoint의 receipt를 따른다.

현재 선정 기능에 대해 strict package build·sample 타입 검사, 실제 Core Root10·기존 selection/theme Root8, Chromium9, 저장소 밖 새 archive 설치·public NodeNext 타입/runtime·전체 설치 파일 bytes 검증 이력이 있다. 변경 이후의 최종 fresh receipt와 정확한 유효 범위는 W11 checkpoint를 따른다. Windows/Android 최신 후보·물리 IME/caret/FPS·font/icon/asset·전체 locale·나머지 컨트롤·App·후속 단계는 완료 처리하지 않는다.

### 9.2 공통 swatch·테마 계약·CupertinoApp 연결

첫 묶음의 W11 입력1118·receipt25와 계승 W10 입력621·immutable receipt12927을 확인한 뒤, 이전 W11 입력 전부와 control4의 정확한 bytes를 별도 baseline으로 보존했다. 이전 §9.1과 디자인 기반 기록 (보관된 과거 기록 `w11-design-foundation.json`)은 당시 범위의 이력이며 아래 구현으로 일부 미완료 조건을 갱신한다. 제품 전체와 W11-01/05는 계속 `ACTIVE / PARTIAL`이다.

- Core에 `ColorSwatch<K>`를 추가하고 Material의 두 swatch가 이를 상속하도록 연결했다. 원본처럼 입력 Map을 live로 유지하며 null/동일 객체/범위 밖 보간·비대칭 키 집합을 처리한다. `DartMap`의 명시적 키 policy·동시 변경 검사와 type witness를 보존하고 Core Color interface/value dispatch에 연결한다. 일반 JS Map의 키/반복 의미와 erased TS generic의 명시적 token 경계, VM hash와 다른 안정적인 로컬 hash를 문서화한다. 원본 전체 ColorSwatch/UI Color로 palette54 및 dynamic Color interface를 포함한 swatch28 사례를 비교했다.
- `NoDefaultCupertinoThemeData`와 내부 지정값/default 구분을 공급했다. `copyWith`가 파생 textTheme를 지정값으로 고정하던 문제를 수정했고, primary 변경 시 action 역할을 다시 계산한다. 독립 selection 기본색, null 유지, 명시적 style, 반복 context 해석을 보존한다. 내부 Color 객체는 동적 변형을 유지하며 공개 색상 getter/Core TextStyle은 기존 ARGB ABI를 따른다. `brightness`는 Nelyx effective 값이고 `specifiedBrightness`·`noDefault()`는 원본의 nullable 지정값이다.
- 원본 Cupertino theme/text-theme 및 모든 private default helper의 전체 본문을 Dart에서 실행했다. 9개 역할·8개 trait 조합·raw/noDefault/copy/resolve/re-resolve·동등성의 13개 묶음을 실제 Core TextStyle/Root 관측과 대조했다. Dart TextStyle은 이 비교 필드만 받는 controlled receiver다. 원본 전체 text engine·native glyph/font·VM hash로 확대하지 않는다.
- `CupertinoApp`를 공개 `widgets`/`app` entry에 공급했다. Core WidgetsApp의 locale/RTL·MediaQuery·Overlay/Navigator·복원 owner를 재사용하고 CupertinoTheme·기본 interface level·text/selection·scroll behavior·focus/shortcut·Hero scope를 연결한다. `WidgetsApp`에는 명시적 navigator restoration id/resolver 전달을 추가했다. `mediaFromView`의 플랫폼 brightness 누락도 수정했다. 두 디자인 앱의 기본 키보드 경로는 공통 Core `AppFocus`를 소비한다.
- CupertinoApp의 실제 Root/CPU CanvasKit 사례6에서 환경 변경 후 State 유지, 키보드 이동/Material 버튼 활성화, custom theme/scroll, Back/Hero 중간 paint, 두 cold Root의 route/필드 복원, 두 View 격리·종료 시 pending route 취소를 검증했다. 환경 producer는 controlled receiver이며 OS ingress/물리 입력 검증은 아니다. 기존 app-flow15·selection/theme8·Chromium9도 영향 검증 범위에 포함한다.
- 원본 Cupertino/Material App 전체 선언5의 현재 Dart 일괄 후보는 exact superclass constructor binding에서 명시적으로 막혔다. 현재 Doroti App bytes도 WidgetApp/Router/Hero/localization 의존성을 유지하고 delegate/virtual/project lowering을 추가하므로, 이미 있는 Core 계약으로 유한한 TS App 연결을 선택했다. 원본 전체 App API를 생성·승격했다고 표현하지 않는다.

기본 팔레트 생성/소유권·license/notice·독립 archive NodeNext 타입/runtime·설치 bytes와 영향 recipe 회귀의 최종 결과는 디자인 runtime 기록 (보관된 과거 기록 `w11-design-runtime.json`) 및 checkpoint를 따른다. **MaterialApp의 전체 options/routing, Cupertino default page motion·Router/named-route/locale delegate, DESIGN-2/3 컨트롤, locale별 typography/data/font/icon/asset·system chrome/inspector 및 W11-02~11의 잔여 필수 조건은 미완료**다. 현재 Windows/Android source/archive/native parity와 물리 IME/caret/FPS는 `notVerified`를 유지한다.

### 9.3 양쪽 App·named route·Router·locale 계약

직전 W11 입력1132·receipt40 및 계승 W10 입력621·receipt12927을 확인하고 이전 입력 전체와 control4를 다시 보존했다. §9.2의 MaterialApp options/routing과 양쪽 Router/named-route 미완료 중 **아래 명시한 Core API 연결**을 공급한다. App 실행 기록 (보관된 과거 기록 `w11-design-apps.json`)은 해당 묶음의 범위이며, 앞선 part와 immutable receipt는 당시 이력으로 유지한다. 전체 W11-01/05와 제품은 계속 `ACTIVE / PARTIAL`이다.

- `MaterialApp`를 독립 `app` entry로 분리하고 `widgets`가 같은 class를 내보내도록 했다. 기존 positional 인자/키보드/scroll 경로를 유지하며 새 options 경로는 실제 WidgetsApp·Navigator·Overlay·복원·locale/RTL·focus/Hero를 소비한다. 원본 `_themeBuilder` 순서로 system/light/dark 및 normal/high-contrast theme fallback을 선택한다. 사용자 builder가 실제 Theme/DefaultTextStyle/selection을 읽으며 Material 컨트롤의 AppTheme 팔레트도 선택한 Material 색상을 유지한다.
- Core WidgetsApp에 routes·string/Route initialRoute·generation/unknown/custom-initial factory를 연결했다. 원본 default initial-route 알고리즘처럼 prefix stack을 구성하고 중간 gap을 생략하며 최종 target 누락 시 `/`로 fallback한다. 이름→route 생성과 cold restoration이 같은 resolver를 사용한다. 기존 bounded JSON 인자·route budget·단일 mounted controller 소유권을 유지한다. named push/replacement/pop-and-push는 결과 완료·stale async Back·전파되는 observer 오류의 rollback·종료 후 resolver 해제를 검증한다.
- Core·Material·Cupertino의 typed `router({routerConfig,...})` 경로를 연결했다. provider/parser/delegate/error callback은 Core RouterOptions다. NavigatorRouterDelegate에 자동 Hero scope를 제공하고 latest-parse-wins·local route report/replace·Back·활성 flight 종료를 실제 Root에서 검증한다. 외부 controller/provider/delegate는 caller 소유다. 원본 Flutter constructor 전체나 default page motion/OS ingress 전체 완료로 확대하지 않는다.
- 원본 engine `Locale`의 language alias78·region alias6을 유한 Dart AST parser로 추출했다. [locale 데이터 소유권](tools/Nelyx.FrameworkToTypeScript/data/work8/w11-locale-data-ownership.json)은 pin/input/tool/output hash와 직접 수정 충돌 거부를 기록한다. basic locale matching·list→single→default callback 우선순위·script/region/country fallback을 공급했다. `canonicalLocaleTag`는 alias와 language/script/region을 정규화하고 extension의 `ca`/`latn`을 region/script로 오인하지 않는다. 앱 message key를 위해 기존 supported-string spelling은 유지한다. 전체 번역/delegate/날짜·숫자 데이터·typography/locale 공급 완료가 아니다.
- 원본 Locale class·basicLocaleListResolution·LocalizationsResolver callback 본문·Material theme selector·Navigator default initial-route 전체 메서드를 Dart에서 실행했다. locale20·theme20·initial route11·callback5·tag4 사례를 현재 compiled 제품과 대조했다. Theme/MediaQuery/route allocation/SystemChrome receiver는 controlled이며 theme 선택·locale 값·route 이름/조회 순서를 검증한다. 원본 VM hash·route dispose API·실제 OS chrome 결과를 주장하지 않는다.
- 실제 Core Root/CPU CanvasKit의 App13 묶음에서 두 App의 4개 cold Root route/field 복원, named/deep-link/unknown/replacement/error·stale Back, 양쪽 Router의 stale parse·Hero 중간 pixels·report/replace, theme/locale/State/키·메시지/RTL·키보드/종료를 검증했다. 기존 app-flow15·sample strict·Chromium9·영향 recipe27/fixture5·독립 archive/public NodeNext·전체 설치 bytes의 최신 receipt는 checkpoint를 따른다. 모든 디자인 모듈을 같은 Babel loader가 소유하도록 app/scroll-behavior fixture도 확장했다.

당시 다음 구현으로 선정한 DESIGN-2 기본 컨트롤의 첫 묶음은 §9.4에 기록한다. ColorScheme seed/M2/전체 typography·locale delegate/data/font/icon/shader/asset, App의 default page/theme motion·system chrome/inspector·나머지 공개 API, W11-02~11의 필수 범위와 최신 Windows/Android/물리 IME/caret/FPS는 계속 미완료다. 여섯 target 공통 공급 의무와 iOS/macOS/Linux dedicated native `SKIPPED`/provider `notVerified` 경계도 유지한다.

### 9.4 기본 컨트롤·공통 입력/상태 첫 묶음

직전 입력1143·receipt53과 계승 W10 입력621·immutable receipt12927을 확인하고 이전 W11 입력 전체/control4를 보존했다. 컨트롤 실행 기록 (보관된 과거 기록 `w11-design-controls.json`)은 아래 선정 계약과 최종 검증을 연결한다. 기존 source·promoted batch27·sample/runner를 보존하며 새 compiler 규칙이나 generated 제품 승격은 추가하지 않았다. **DESIGN-2 전체와 W11-01은 계속 PARTIAL**이다.

- 고정 Flutter의 Cupertino6/Material13 파일에서 공개 선언·State·private helper·상수 등216개를 일괄 IR/emit 후보로 검사했다. constructor/mixin·generic const·render/theme/helper binding과 일부 frontend 제약을 명시적으로 기록한다. 현재 Doroti pin의 대응19파일도 실제 bytes·virtual/member·named-argument 비용을 확인했다. 같은 의존성에 C# project/delegate/nullable/override lowering이 더해지므로 이미 있는 Core 계약으로 유한한 TS 기능 포트를 선택했다. 전체 선언 생성/승격이나 범용 compiler 완료를 주장하지 않는다.
- Core `ControlInteraction`이 실제 WidgetStateProperty/StatesController·focus/actions·MouseRegion·gesture arena·press/long-press/취소·ticker·source semantics를 한 owner에서 소비한다. caller의 focus node/controller를 해제하지 않으며 교체 시 listener를 분리한다. disable·deactivate·이동·종료에서는 pressed/drag를 정리하고 inactive ancestor에서 MediaQuery/animation을 다시 시작하지 않는다. 기존 host id는 `Semantics.transportId`로 source flags/actions와 함께 보존한다. tap event는 control의 실제 source semantics node와 명시적 per-View messenger를 사용한다.
- Material의 filled/tonal/text/outlined/elevated 버튼과 Cupertino plain/filled/tinted 버튼을 공개 entry와 `widgets`의 같은 class로 연결했다. 기존 `(id,label,onPressed)` 생성도 유지한다. child·callback·focus/state controller·long-press, 선정 style/theme 우선순위와 M3 색상 결정, Cupertino 크기3·small text·밝기별 tint·동적 색상·pressed opacity를 공급한다. Material style의 uniform radius는 generic double 경계에서 명시적인 DartDouble carrier/witness를 요구한다. 기존 generated numeric provenance를 변경하거나 수치의 이름/값으로 source kind를 추측하지 않는다.
- 양쪽 checkbox/radio/switch를 controlled 값과 공통 toggle position/입력에 연결했다. checkbox는 false→true→null→false와 source mixed semantics를 지원한다. Core `RadioGroup<T>`/`RawRadio<T>`는 erased generic의 명시적 token 또는 caller registry를 사용하며 현재 읽기 순서의 한 Tab stop·arrow/wrap·disabled 건너뛰기·다른 control의 키 전달·keyed 재배치를 검증한다. Material switch의 연속 위치/중간값 결정과 Cupertino의 고정 source hysteresis 및 RTL drag를 분리한다. 고정 recognizer는 수락 전 PointerCancel을 취소하고 수락된 drag의 PointerCancel은 onEnd로 마무리하므로 두 경계를 별도 검증한다.
- 원본 M3 버튼의 foreground/background/overlay getter 본문을 그대로 Dart에서 실행해 다섯 variant×세 palette×아홉 state 조합135개를 대조했다. 원본 Toggleable `_handleTap`10개와 Cupertino switch `_handleDragUpdate` 경계10개도 비교했다. Color/property/position/haptic/semantics는 해당 값/효과를 받는 controlled receiver이며 전체 engine·haptic 실행이 아니다. 실제 제품의 투명한 기본/명시적 색상에서 alpha를 잃던 경우를 이 범위에 추가하고 수정했다.
- 실제 Core Root/CPU CanvasKit15 묶음은 pointer·keyboard·semantic 활성화, long-press 경쟁, pressed/position 중간 paint, source state/property/theme, nullable/disabled/hover, LTR/RTL switch drag, typed/nested/keyed radio, controller 교체·caller 소유권·stale action·mute/retirement, 두 View의 source node/codec/messenger를 검증한다. 기존 App13/4 cold Root·app-flow15·selection/theme·overlay 수명·sample strict·Chromium9도 현재 제품의 영향 범위에서 확인한다. 원본 fixture가 기존 함수 signature를 가정하던 harness는 명시적 messenger 주입 signature에 맞췄으며 source 동작/기대값을 완화하지 않는다.
- 최신 Core/Cupertino/Material archive를 저장소 밖에 offline 설치해 public NodeNext 타입·잘못된 타입 거부·shared identity·전체 설치 파일3245개의 bytes를 검증했다. 최종 recipe27 fresh 생성/strict와 영향 fixture6, generated 제품과 scratch byte 대조·이전 제품 유지, 새 입력/이전 receipt/notice/hash 연결의 결과는 part와 checkpoint를 따른다. archive/Root/Chromium의 서로 다른 검증 범위를 합쳐 전체 제품 완료로 계산하지 않는다.

당시 다음 작업이던 positional 버튼의 공개 metadata와 선정 activity/progress는 §9.5에서 보완했다. slider·chip·ink 및 나머지 control theme/API는 계속 열린 범위다. 이번 묶음은 positional 생성/동작을 유지했으며 기존 readonly metadata 필드의 projection은 아직 보완 대상이다. 이번 rounded mark painter/선정 opacity motion은 원본 전체 superellipse/gradient/focus shape·thumb/outline/icon/elevation·InkSparkle·M2·haptic·motion/API 동등성 완료가 아니다. DESIGN-3/4, 전체 locale/data/font/icon/asset, W11-02~11 및 최신 Windows/Android/물리 IME/caret/FPS의 필수 작업과 `notVerified` 경계를 유지한다. 실행은 `ACTIVE / PARTIAL`이며 다음 작업을 위해 사용자 재개 승인을 요구하지 않는다.


### 9.5 Activity·Progress·테마와 브라우저 semantics

직전 W11 입력1160·receipt73 및 계승 W10 입력621·immutable receipt12927을 확인하고 이전 입력 전체/control4를 별도 baseline에 보존했다. 진행 표시기 실행 기록 (보관된 과거 기록 `w11-design-progress.json`)은 이 묶음의 source 선택·검증·소유권·archive와 연결된다. 실행은 `ACTIVE / PARTIAL`이며 전체 W11 완료 판정이 아니다.

- Cupertino `CupertinoActivityIndicator`·`partiallyRevealed`·`CupertinoLinearActivityIndicator`, Material `LinearProgressIndicator`·`CircularProgressIndicator`·`adaptive`, inherited `ProgressIndicatorTheme`·16-field data를 공개 subpath와 `widgets`의 같은 class로 공급했다. 원본 전체 activity/progress 후보는 앞선19파일216선언 검토를 재사용하고 progress theme의 전체2선언을 추가 probe했다. theme mixin/host binding 제약과 고정 Doroti의 동일 의존성/lowering 비용 때문에 현재 Core owner 위의 유한한 TS 기능 포트를 유지한다.
- 원본8개 tick의 alpha·회전·partial reveal, 선형4개 curve·track gap ramp·paint 순서·RTL·stop mark, 원형 arc·stroke align/cap·현행/2023 M3·M2 기본값, 명시/지역/전역 테마 우선순위를 연결했다. color/valueColor·nullable theme copy·보간·동등성은 현재 Color/Geometry/Constraints identity를 소비한다. old positional 버튼의 공개 `id`·`label`·optional `onPressed` getter도 복구했다. options Widget에 없는 문자열 metadata는 만들어내지 않고 조회 시 명시적으로 거부한다.
- Core Canvas 원호를 기존 wire/path ABI의 rational conic으로 공급했다. 큰 center sweep는 공통 path operation budget을 사전 검사한다. 원본 Cupertino tick의 inverted RRect는 고정 engine `rrect.cc`처럼 paint capture에서 양의 bounds로 정규화하고 wire snapshot의 음수 bounds 거부는 유지한다. CanvasKit 원호6개 비교에서5개는 픽셀 일치, full oval 한 경우는9개 경계 픽셀/채널 최대2 차이였다. 12픽셀·채널2·평균오차.001 이내의 명시적 허용 범위를 사용하며 native/GPU/FPS 동등성을 주장하지 않는다.
- 원본 linear/circular/tick painter 전체 본문, progress theme constructor/copy/lerp/equality, Curve/Cubic/Interval/SawTooth와 engine Color/transform 본문을 그대로 Dart에서 실행했다. painter15+10·tick8·theme18+3, 총54개를 현재 제품과 대조했다. geometry/paint receiver는 해당 operation/value 범위이며 전체 engine geometry나 wide-gamut 출력 검증이 아니다.
- 실제 Root/CPU CanvasKit9개 묶음에서 State 유지, animating·determinate/indeterminate·TickerMode, shared/theme controller 교체와 caller 소유권, color listenable 변경/해제, adaptive 경로·semantics·종료를 검증했다. 외부 controller/Apple adaptive 사용 시 쓸모없는 내부 ticker를 멈추고 determinate valueColor 변화도 repaint한다. 이는 원본의 unused ticker/build와 의도적으로 다른 기능적 수명 보완이다.
- source semantics에 있던 progress role/min/max가 coarse host 변환에서 유실되는 누락을 수정했다. 기존 host role vocabulary를 유지하면서 sourceRole와 range strings를 보존·검증하고 browser가 실제 DOM progressbar·numeric range/value·busy를 게시한다. Chromium6개 묶음은 같은 State/DOM node의 determinate→indeterminate→설명값 전환과 stale 속성 제거, 외부 animation, 두 View 동일 id 격리, adaptive Cupertino 원본 no-Material-semantics 경로와 종료를 검증한다. 실제 reader/native producer 완료는 아니다.
- 기존 control15·App13/4 cold Root·app-flow15·selection/theme8·overlay9, data/locale/notice 재생성·sample strict를 영향 검증했다. 기존 Chromium scroll/editor9도 현재 Core/SDK에서 갱신했다. 외부 offline archive의 public NodeNext 긍정/부정 타입·identity·설치 bytes, 최종 recipe27 fresh 생성/strict, 영향 fixture6 및 generated-product 유지 대조는 part/checkpoint의 최종 receipt를 따른다. fixture6 이후 추가한 두 모듈의 nullable-color fallback/명시 minHeight 양수 검사만 별도 현재 Root·원본·public/DOM 검증으로 갱신한다. 모든 Core/생성 입력과 나머지 제품 bytes 동일성을 증명해 fixture6의 원래 범위를 재사용하며, 이를 두 경계 수정의 재실행으로 주장하지 않는다. 중간 Core metadata 변경으로 무효화된 scratch 회귀는 hash guard의 실패로 보존했다. 별도 RN Babel 회귀가 진행 표시기의 declare-field 재선언을 거부한 문제는 generic base의 정확한 options 타입으로 수정했으며, 최종 입력으로 다시 실행한다. 두 실패를 PASS로 바꾸지 않는다.

다음 DESIGN-2 작업은 slider·chip·ink/Material surface와 나머지 control theme/default/API·RefreshProgressIndicator·diagnostics/hash다. 이 묶음의 선정 activity/progress 기능을 전체 디자인 API/모션/시각/접근성 완료로 확대하지 않는다. DESIGN-3/4, 전체 locale/font/icon/shader/assets, W11-02~11, 최신 Windows/Android와 물리 IME/caret/FPS 및 여섯 target 공급 조건은 계속 미완료다. dedicated Apple/Linux native 예외도 유지한다.

### 9.6 Cupertino Slider·공통 입력·Slider 데이터

직전 입력1173·receipt102/control4 전체 bytes를 별도 baseline에 보존하고 현재 pin과 immutable 계승 receipt를 확인했다. Slider 실행 기록 (보관된 과거 기록 `w11-design-sliders.json`)이 이번 묶음의 소유권·검증·archive와 연결된다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

- Core `SliderControl`: 기존 View gesture arena/team, source horizontal drag/tap, focus/action, state controller, ticker/semantics를 사용한다. Material의 네 interaction 정책, duplicate 억제, RTL·keyboard·semantic callback 순서와 Cupertino thumb hit·drag 시작값·fast threshold·off-grid semantic 증감 차이를 보존한다. 외부 focus/state는 caller 소유이며 disabled/stale/deactivate/dispose 경계를 검증한다.
- 실제 `CupertinoSlider`와 `CupertinoThumbPainter`: 원본 트랙·thumb·shadow/border/fill, 동적 색상, 176×44 크기, 원본 value/position 차이, controlled 값, 공개 subpath/aggregate를 연결했다. 원본은 keyboard Focus wrapper가 없으므로 이를 보존한다. haptic은 명시적인 View messenger에서만 요청하며 물리 전달은 notVerified다. min==max는 zero fraction/disabled로 처리하는 명시적 host 경계다.
- `SliderThemeData`의36 final field/type는 resolved IR에서 관리 생성하며 숫자3필드와 함수형 숫자 signature의 출처를 유지한다. constructor/copy/lerp/equality·InheritedTheme/ThemeData override와 원본 shape 추상 계약을 구현한다. source theme hash의 valueIndicatorStrokeColor 누락도 equality 관계와 분리해 보존하며 VM 숫자 hash 일치로 주장하지 않는다. `RangeValues`/`RangeLabels` 및 enum3종은 완전한 선정 원본 본문을 별도 관리 생성한다. 신규 promoted batch는 없으며 기존27개를 유지한다.
- Core Size generic 경계는 실제 owning Size만 명시적으로 capture한다. nullable WidgetStateProperty와 lerp 결과에서 type identity를 유지하며 구조적 가짜/uncaptured 인스턴스를 거부한다. source slider flag·표시 문자열·별도 actual numeric range를 브라우저까지 전달하고 RTL 증감·disabled/stale metadata·무id·동일id 두View·retirement를 검증한다. SDK capture 단계에서 이미 처리된 키의 semantics 중복 실행을 막고 실제 입력 binding에서 증감1회와 기존 scroll/editor DOM9 영향을 확인한다.
- 원본 비교: Cupertino paint28(폭20/44 경계 포함)·thumb2, theme lerp18·copy/equality3, value4·enum12, callback/fast timestamp8. Root7과 Chromium DOM7은 독립 범위다. shadow sigma만 기존 SkScalar float32 wire 경계로 정규화하고 raw Dart stdout을 보존한다. text/shape/geometry receiver는 유한 범위이며 원본 전체 font/shape/GPU 판정이 아니다.

Material Slider·RangeSlider 본체, concrete track/thumb/value indicator/default factory(`fromPrimaryColors`)·diagnostics, chip·ink/Material surface·RefreshProgressIndicator·나머지 control 시각/모션/API는 계속 미완료다. DESIGN-3/4, 전체 locale/font/icon/shader/assets, W11-02~11, 최신 Windows/Android와 물리 IME/caret/FPS 및 dedicated Apple/Linux 예외를 유지한다. 이번 선정 기능의 검증을 전체 디자인·native·assistive reader·physical 완료로 확대하지 않는다.


### 9.7 Material Slider·원본 도형 본문·Path 원호

직전 W11 입력1197·receipt132/control4 전체 bytes와 계승 W10 입력621·immutable receipt12927을 보존한 baseline에서 계속했다. Material Slider 실행 기록 (보관된 과거 기록 `w11-design-material-sliders.json`)에 생성 소유권, 원본 비교, 검증과 archive를 연결한다. 요청은 계속 `ACTIVE / PARTIAL`이다.

- `Slider`/`Slider.adaptive`를 현재 Core gesture/focus/action/ticker/semantics 소유자 위에 구현했다. M2·2023 M3·현재 M3 기본값, secondary track, discrete ticks, 네 가지 상호작용, actual track shape 영역으로 입력/paint 좌표 일치, RTL과 controlled callbacks를 연결했다. Apple adaptive 경로는 기존 Cupertino 소유자를 사용한다.
- 기존 full-family IR의 `slider_parts.dart`15·`range_slider_parts.dart`16·`slider_value_indicator_shape.dart`9 선언을 각 원본 라이브러리 단위로 생성했다. private helper 이름을 라이브러리별로 유지한다. 원본 도형 본문40개는 managed 재생성/직접 수정 거부/strict 검사 범위이며 새 promoted batch는 추가하지 않았다. 모든 range 도형의 독립 원본 paint/font 검증은 아직 열려 있다.
- `SliderThemeData.fromPrimaryColors`의 원본16개 색상과 shared const 도형 identity를 연결했다. 값 표시기는 실제 per-View font/TextPainter와 composited overlay를 사용하며 500ms 최소 상호작용 시간·timeDilation·비활성화·route 제거를 처리한다. Overlay removal/dirty rebuild는 다른 위젯의 persistent build/layout/paint 중이면 프레임 뒤로 연기한다.
- 명시적 `retained-core-numeric-operations` 정책으로 resolved num 피연산자의 carrier를 보존한다. raw number·unsafe integer·정책 누락·foreign/mismatched/unsupported/nullable 연산을 거부한다. abstract 메서드의 named 기본값은 TS 선언 서명과 구현으로 구분하고, lazy static 자식 초기화는 eager 의존성에서 제외하며 owned static const helper는 먼저 초기화한다. 네이티브 Dart 비교에서 발견한 `math.min` 동률 carrier 차이를 보완했다.
- owning Size/Offset의 source witness/const 경계를 추가·보완하여 반복 capture, zero/infinite singleton, signed zero와 immutable host storage를 유지했다. `Path.addArc/arcTo`는 pinned Skia float 변환·기존 contour/current point·rational conic을 현 path ABI에 연결하며, 오류/operation budget은 변경 전에 거부한다. Skia 원본 notice를 패키지에 보존했다.

검증은 각 receipt 범위로 구분한다. 실제 Root 9개(기본 외형 3, discrete off-grid 75ms retarget, custom real receivers/track 변환, no-shape/narrow, actual-font overlay, single-thumb 값 표시기 4종, const geometry, 최소 timer/borrowed owner/retirement/adaptive), Chromium 7개, unchanged 원본 factory 3·thumb center 24, native Dart 산술·비교 12·min/max 36, 실제 CanvasKit CPU/native PathBuilder 픽셀 18개가 별도 기록이다. Core/Material 빌드·공개 외부 archive 설치·strict NodeNext 소비자와 전체 27 recipe 생성/선정 6 fixture 회귀 및 이전 App/control/progress/selection/scroll 영향 검증을 수행한다. 현재 회귀·archive 결과의 최종 수치와 hash는 위 실행 기록을 기준으로 한다.

Material RangeSlider 본체, 원본 전체 defaults getter/모든 shape paint/font·diagnostics, 남은 DESIGN-2/3/4·locale/assets 및 W11-02~11은 계속 열린 작업이다. Windows/Android 최신 native artifact와 물리 IME/caret/haptic/GPU/FPS는 `notVerified`, 전용 Apple/Linux native 예외는 기존 `SKIPPED`/provider `notVerified` 경계를 유지한다. 다음은 RangeSlider의 두 thumb 선택·간격·overlay·semantics를 현재 소유자에 연결하고 독립 원본 도형 검증을 넓히는 작업이다.


### 9.8 RangeSlider·두 thumb·원본 기본값/layout 보완

직전 W11 입력1219·receipt156/control4 전체 bytes와 계승 immutable 기록을 보존한 baseline에서 계속했다. RangeSlider 실행 기록 (보관된 과거 기록 `w11-design-range-sliders.json`)에 원본 선택, 현재 source·검증·archive·회귀를 연결한다. 전체 요청은 `ACTIVE / PARTIAL`이다.

- `RangeSlider`를 현재 Core의 실제 Widget/State/RenderBox·gesture arena/team·FocusNode·ticker·TextPainter·composited layer/overlay 소유자로 구현했다. 두 focus와 두 source semantics 노드를 따로 유지한다. source default thumb selector의 겹친 target 방향 지연 선택, 반복 interaction, tap/drag callback 순서·min/max 변환·continuous pixel separation/discrete zero separation·RTL·off-grid semantic 증감·cancel/disable/retirement를 연결했다. 두 position controller는 parent 변경을 원본 75ms로 전환한다.
- 2023 M3 RangeSlider에도 원본 M2 defaults를 사용하고 현재 M3는 handle/gapped/rounded defaults를 사용한다. 원본 range M2/M3 getter 전체, thumb 상태 7개와 BaseRange preferred-rect/round·handle·overlay·tick preferred-size 본문을 독립 Dart 실행과 비교한다. 원본 range rectangle·rounded·drop·paddle indicator 4종은 실제 per-View font/paragraph와 overlay에서 paint한다. 모든 shape의 독립 원본 paint/font 완료를 주장하지 않는다.
- `SemanticsTransportProperties`의 명시 numeric range를 manually assembled source child node에도 보존한다. source slider flag·formatted text·actual min/max/value는 분리한다. `id-start`/`id-end`, 무id 두 thumb와 동일id 두View를 검증한다. 원본 disabled range node의 focusable flag는 유지하며 value/stale action은 실행하지 않는다.
- 독립 원본 geometry 비교에서 현재 fixed-height port의 차이를 발견했다. Material Slider 공통 표면과 RangeSlider는 원본처럼 bounded width/height를 채우고, unbounded 축에서 preferred part 크기를 사용하도록 고쳤다. single Slider의 source no-thumb/no-overlay/no-tick와 trackHeight 0 조합의 zero preferred height도 허용한다. Cupertino의 고유 fixed-height 정책은 유지한다.

네 가지 owner 동작 차이는 의도적으로 보완했다. RangeSlider의 초기 off-grid 입력은 ambient/layout-only rebuild로 바뀌지 않고 parent values/divisions 변경 시 양자화한다(원본 unconditional render setter의 초기 재빌드 의존성을 제거). 직접 Root arrow/DOM focus는 실제 thumb owner에 연결하며 native reader 전체 구현으로 확대하지 않는다. thumb semantics geometry는 position animation을 따라 갱신한다(원본은 position paint listener만 사용). disable/retirement에서는 진행 중 입력과 timer를 종료하고 stale callback을 막는다. 선택 원본 callback/semantic 본문 비교는 이 내부 lifecycle 동일성을 주장하는 검증이 아니다.

선정 검증은 Range Root 14·single Material Root 11, unchanged 원본 callback/selector/drag/semantic 결정 14개×Dart 2모드, range defaults 3·thumb 상태 7·preferred geometry 12, Chromium 7 및 최신 공개 archive/NodeNext 소비자로 구분한다. Root에는 bounded/unbounded·zero-shape·두 controller 75ms·actual receiver/font/indicator 4종·source paint 순서/overlap·min separation·cancel·State/disabled/stale/retirement가 포함된다. 전체 27 recipe 생성/strict·선정 6 fixture와 이전 App/control/progress/selection/scroll 영향 검증의 최종 결과는 위 실행 기록을 따른다. 기록의 입력 hash와 immutable predecessor bytes를 함께 확인한 뒤 checkpoint를 갱신한다.

이제 다음 DESIGN-2 family는 chip·ink/Material surface·RefreshProgressIndicator·나머지 control 시각/모션/API·source diagnostics와 모든 shape/font 독립 비교다. DESIGN-3/4, 전체 locale/seed/typography/font/icon/shader/assets, W11-02~11 및 최신 Windows/Android native artifact·물리 IME/caret/haptic/GPU/FPS는 계속 열린 범위다. Apple/Linux 전용 native 예외의 `SKIPPED`/provider `notVerified`도 유지한다.


### 9.9 Material surface·InkFeature·Ink/Ink.image

직전 W11 입력1229·receipt177/control4 전체 bytes와 immutable 계승 기록을 보존한 baseline에서 계속했다. Material/Ink 실행 기록 (보관된 과거 기록 `w11-design-material-ink.json`)에 선택·검증·공개 archive·생성 회귀와 checkpoint를 연결한다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

- material/elevation/ink/chip/progress 15개 라이브러리의 private helper를 포함한125 선언을 일괄 후보로 분석했다. 실제 Doroti source HEAD/hash와 보정 비용도 확인했다. 두 경로의 기존 State/render/implicit tween·matrix·nullable/virtual/project 연결 비용을 근거로 현재 Core 소유자에 coherent TypeScript Material/Ink family를 연결했다. 전체 compiler/hierarchy 폐쇄를 선행 조건으로 만들지 않았으며 신규 promoted batch는 없다.
- `MaterialType`는 기존 일괄 IR에서 선정 원본 enum 본문을 별도 관리 생성해 canonical values/index/name/toString과 resolved int 출처를 유지한다. direct edit 거부/재생성 검사를 적용하며 새 promoted batch는 아니다. `Material` 다섯 type, 실제 physical model/shape·shadow/clip·border foreground/background·source canvas/card/shadow Theme 기본값·surface tint/dark overlay를 공급했다. source canvas fast path의 animateColor와 shaped interior의 즉시 배경색·elevation/shape/tint/shadow 전환 차이를 유지한다. 실제 inherited text style도 source duration으로 전환한다.
- `MaterialInkController`/`InkFeature`는 현재 State ticker/RenderBox를 사용한다. 원본 paint transform 알고리즘, 실제 reference 좌표·Material clip·child 아래 paint·layout notification·closest LookupBoundary와 다중 View 수명을 연결했다. Core `CircleBorder`/`ShapeBorderClipper`와 source paintsChild hook, zero-alpha RenderOpacity visibility를 공급했다.
- `Ink`, `Ink.image`, `InkDecoration`은 source decoration padding·width/height·maintained Visibility·local image configuration·reference size·translation/full matrix 분기를 사용한다. image 경로는 기존 View ImageService와 실제 codec/cache/BoxPainter를 쓰며, 독립 Core embedder에도 해당 image owner가 필요하다. 오류 후 제거·painter/image/feature 자원 해제를 검증했다.

선정 실제 Root/CPU 검증15개에는 type/defaults·shape/border/clip·동일 keyed State·elevation retarget·text style·layout notification·reference transform/paint order·Offstage/opacity0/singular/unrelated tree·LookupBoundary·다중 View·ticker/feature retirement·Ink padding/Visibility/null·actual image decode/error/retirement가 포함된다. 독립 원본은 unchanged Material build15·tint48·dark overlay6·CircleBorder geometry12와 InkDecoration lifecycle/paint6을 native Dart 두 모드에서 비교한다. 유한 Theme/widget descriptor·fixed side/path/matrix/decoration receiver는 전체 원본 hierarchy·paint/font/async/VM hash 구현이 아니다.

API/수명 차이는 명시한다. erased generic lookup은 constructor token을 받고 Duration은 host milliseconds다. Material retirement에서 남은 등록 feature를 한 번 해제하고 stale controller의 신규 feature를 거부한다. InkDecoration은 stale painter callback을 막고 해제 뒤 변경을 거부한다. diagnostics는 선정 field 범위만 공급했으며 전체 diagnostics 동일성으로 확대하지 않는다.

제품 source를 고정한 뒤 영향 검증21개, 현재 공개 archive·NodeNext consumer·작업 공간 밖 installed file bytes, 전체27 recipe 생성/strict와 선정6 fixture를 수행한다. 최종 수치·hash는 실행 기록을 따른다. 실제 PNG/font와 실행 fixture bytes도 Root 실행 전후 hash로 연결한다. 기존 RangeSlider/Slider/progress/control/App/selection·DOM capture/scroll 증거와 native/physical 경계를 구분한다.

다음은 이미 검토한 family의 InteractiveInkFeature·InkResponse/InkWell·highlight/splash/ripple/sparkle asset/runtime, chip family와 RefreshProgressIndicator 및 나머지 control motion/default/API/diagnostics다. DESIGN-3/4, 전체 locale/seed/typography/font/icon/shader/assets, W11-02~11, 최신 Windows/Android native artifact·reader와 물리 IME/caret/haptic/GPU/FPS는 계속 미완료다. Apple/Linux 전용 native 예외는 기존 `SKIPPED`/provider `notVerified`를 유지한다.


### 9.10 InkResponse·InkWell·interactive ink·Feedback

직전 W11 입력1246·receipt207/control4 전체 bytes와 계승 immutable 기록을 보존한 baseline에서 계속했다. InkResponse 실행 기록 (보관된 과거 기록 `w11-design-ink-response.json`)에 현재 source·원본 비교·공개 archive·생성 회귀와 checkpoint를 연결한다. 전체 요청은 `ACTIVE / PARTIAL`이다.

- `InteractiveInkFeature`/factory와 `InkHighlight`, `InkSplash`, `InkRipple`, 원본의 명시적 무시각 효과 `NoSplash`를 공급했다. 실제 Material/InkFeature 소유자는 하나로 유지하며 Theme→effect 초기화 cycle을 제거했다. Core AnimationController/ticker와 실제 reference geometry/matrix를 사용한다. source alpha capture·target radius·lazy callback·Splash confirm velocity·Ripple delayed fade/zero cancel·custom/path/rounded/rect clip을 유지한다.
- `InkResponse`/직사각형 contained `InkWell`을 현재 Core arena·Focus/Actions·MouseRegion·semantics·keep-alive 소유자에 연결했다. tap/down/up/cancel, secondary, double/long press, callback 순서와 source 활성 조건, 100ms keyboard highlight, controlled states·isolated overlay·focus mode, nested pressed 전달과 caller-owned FocusNode/WidgetStatesController 수명을 공급했다. 실제 arena winner와 CPU ink 픽셀 변화·종료를 검증했다.
- ThemeData의 source focus/hover/splash 기본색과 nonnullable splashFactory를 공급했다. M2 Splash·지원되는 M3 Ripple을 사용한다. native Android M3의 원본 기본값인 Sparkle는 실제 shader가 공급될 때까지 `ink-sparkle-unavailable`로 명시적으로 거부한다. 임의 Ripple fallback을 만들지 않으며 Theme 생성/copyWith는 이 factory를 필요할 때 해석한다.
- `Feedback` tap/long-press/wrapper는 actual View messenger로 source 플랫폼별 accessibility·click·vibrate·heavyImpact protocol을 보낸다. 두 View 소유권과 여섯 플랫폼의 메시지/callback 순서를 검증했다. 소리·진동의 실제 기기 전달은 별도 `notVerified`다.

원본 비교는 각각의 범위를 유지한다. unchanged InteractiveInkFeature/factory 및 Highlight/Splash/Ripple/NoSplash 전체 클래스·상수·private helper를 별도 native Dart 라이브러리로 실행하여36개 단계/paint/confirm/cancel/등록 결정을 두 모드에서 비교했다. 유한 animation/geometry/Canvas receiver가 원본 native ticker/hierarchy를 구현한다는 주장은 하지 않는다. response callback9·enabled3·fade duration 본문의21개 mask/sequence는 실제 Root State와 비교하며, source updateHighlight/createSplash/focus/build 전체 본문 동일성은 이 비교에 포함하지 않는다. complete unchanged Feedback 클래스는6개 플랫폼 protocol/순서를 두 Dart 모드에서 actual View messenger와 비교한다.

실제 Root/CPU 검증18개는 효과 timing/clip/좌표·tap/secondary/double/long arena·source projections/default factory·keyboard/semantics·disabled/stale·nested·overlay/focus·keep-alive·custom rect/border/controller 변경·다중 View Feedback·NoSplash 무등록/무ticker 수명을 포함한다. 공개 subpath/aggregate identity·strict NodeNext 소비자·작업 공간 밖 installed archive3451개 파일 bytes가 통과했다. 영향 검증24개와 전체27 recipe 생성/strict·선정6 fixture의 최종 수치/hash는 실행 기록에 연결한다. 기존 source·Root·DOM·archive 및 native/physical 증거를 서로 확대하지 않는다.

API/수명 차이를 명시한다. public InkResponse가 source의 Stateless/private Stateful 쌍 대신 State를 직접 소유한다. parent pressed 전파는 logical child set을 사용한다. Duration은 host milliseconds이며 missing InkSplash position은 animation 시작 전에 거부한다. stale action/timer/feature와 disable 중 interaction을 정리하고 caller 소유자는 해제하지 않는다. Feedback은 명시 View messenger가 없으면 전송하지 않는다. 전체 diagnostics·원본 hierarchy·VM hash 동등성은 계속 열린 범위다.

기존125 선언 full-family IR/Doroti 실제 source 비용에 추가로 NoSplash/Feedback 전체3 선언의 일괄 후보와 실제 Doroti HEAD/hash/코드를 확인했다. constructor adapter·async 표현 제약을 기록하고 기능을 현재 Core 소유자에 연결했다. 신규 compiler rule/promoted batch는 없다. 다음은 Sparkle shader asset/runtime, chip family, RefreshProgressIndicator와 나머지 control motion/default/API/diagnostics·모든 shape/font 독립 비교다. DESIGN-3/4·전체 locale/seed/typography/font/icon/assets·W11-02~11·최신 Windows/Android native artifact/reader·물리 IME/caret/haptic/GPU/FPS는 계속 미완료이며 dedicated Apple/Linux `SKIPPED`/provider `notVerified` 경계를 유지한다.


### 9.11 RefreshProgressIndicator·progress 공개 속성·진단

직전 W11 입력1262·receipt241/control4의 정확한 bytes와 계승 immutable 기록을 보존한 baseline에서 계속했다. Refresh/progress 실행 기록 (보관된 과거 기록 `w11-design-refresh.json`)에 구현·원본 비교·현재 archive·회귀·checkpoint를 연결한다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

- `RefreshProgressIndicator`를 source CircularProgressIndicator subclass로 공급했다. 원본41px circular Material·elevation2·margin4·padding12·stroke2.5 기본값과 widget/local/global/default 색상·배경·stroke 우선순위를 유지한다. 명시 null strokeWidth는 theme/default로 내려가지만 생략은2.5다. 실제 Core Material/physical shape·shadow·Opacity·Transform·Path·AnimationController를 사용한다.
- 값이 있는 동안에도 source의 lengthened indeterminate arc와 값에 따른 arrowhead·추가 회전을 그린다. source convert Interval/TweenSequence를 사용하고 값→null 전환에서 현재 animation phase·마지막 추가 회전을 유지하며 화살표를 제거한다. 실제 semantics는 값이 있으면 determinate progress, 없으면 loadingSpinner다. valueColor opacity는 fully opaque arc/arrow 밖에 적용한다.
- Linear/Circular/Refresh의 원본 public field projection과 CupertinoActivityIndicator.color getter를 보완했다. ProgressIndicator의 원본 PercentProperty, ProgressIndicatorThemeData16개 diagnostic 필드의 type/order/value/default를 현재 Core diagnostic class에 연결했다. source16개 field/runtime-class equality와 hash 관계 및 subclass 추가 필드 제외를 유지하고 ProgressIndicatorTheme의 선택 key 인자를 공급했다. 수치 VM hash·identity string과 full serialized diagnostics 동일성은 주장하지 않는다.

원본은 unchanged Refresh widget·State·painter, Circular painter/static tween/default 클래스와 Progress 색상/semantics 메서드, TweenSequence/private interval 본문을 native Dart 두 모드에서 실행한다.23개 구성(값→null 전환3개 포함)의 실제 Root tree·phase·rotation matrix·opacity·Material/defaults·semantics·arc/path를 비교한다. 유한 Widget/State/controller/Tween/geometry/Canvas receiver는 원본 native hierarchy/ticker 구현이 아니다. native path receiver는 engine float32 endpoint 경계를 사용하고 수치 tolerance를 명시한다. complete unchanged progress Theme 본문과 progress debug 메서드는16개 필드·5개 값/3개 widget·6개 equality/hash 관계를 actual Core diagnostic class와 비교한다. debug/release 진단 정책, 실제 theme key/wrap/notification도 확인한다.

별도 실제 Root/CPU9개는 원본 layout/arrow/opacity·clamp/semantics·keyed State·value→null resumption·theme 우선순위·borrowed controller/valueColor·RTL/제약·mute/해제를 검증한다. 실제 Chromium progress9개 중 Refresh3개 흐름은49px DOM 영역·ARIA 값/설명/busy 갱신·State/node 보존·한 ticker·M2/M3·두 View/동일id·해제를 확인한다. source/Root/DOM/외부 installed archive3451개 파일과29개 영향 검사·전체27 recipe 생성/strict·선정6 fixture를 구분하며 최종 hash와 수치는 실행 기록을 따른다.

명시적 host 차이도 유지한다. Refresh는 원본처럼 determinate phase를 borrowed theme controller에 기록하지만 해제하지 않는다. external controller 사용 중 숨은 internal ticker를 반복하지 않고 determinate에서도 valueColor 변화가 repaint되도록 listener를 연결한다. Duration은 milliseconds, inherited theme key는 기존 positional data/child 뒤 선택 WidgetOptions로 받는다. source type/hierarchy와 VM 숫자 hash를 새 기능의 완료 조건으로 바꾸지 않는다.

기존125-declaration full-family IR/private helper와 complete progress Theme2개 선언을 byte 검증해 재사용하고 Refresh3개 선언 및 실제 Doroti progress/theme/activity source HEAD/hash/비용을 다시 확인했다. 새 compiler rule/promoted batch는 없다. 이 작업은 시각 indicator이며 swipe/scroll `RefreshIndicator`는 남아 있다. 다음은 chip family·Sparkle shader asset/runtime/native Android M3 default·나머지 control motion/default/API 및 모든 shape/font 독립 비교다. DESIGN-3/4·전체 locale/seed/typography/font/icon/assets·W11-02~11·최신 Windows/Android artifact/reader와 물리 IME/caret/haptic/GPU/FPS는 계속 열린 범위이며 dedicated Apple/Linux `SKIPPED`/provider `notVerified` 경계도 유지한다.


RN Babel 선정 회귀의 첫 실행에서는 Refresh options의 새 `declare` field narrowing을 preset이 거부하여 terminal FAIL을 확인했다. 단일 base-owned options는 그대로 유지하고 private typed getter로 조회하도록 보정했다. 초기 실제 실패 log/source bytes를 보존하고 현재 두 디자인 패키지96개 source module을 동일 RN preset으로 변환한다. 보정 뒤 current source/Root/DOM/archive·27 recipe/선정6 fixture를 다시 실행하며, 최종 회귀의 실제 RN Babel 실행이 통과해야 해당 결과를 기록한다. parser 성공만으로 native artifact나 물리 환경을 완료 처리하지 않는다.


추가 RN Babel runtime 검증은 하나의 design source loader와 현재 workspace Core identity로68개 design 모듈을 실제 실행했다. Babel로 변환한 Refresh/MaterialApp constructor·public getter·aggregate identity·theme hash와 실제 Core/CanvasKit CPU Root의 determinate→indeterminate→determinate 전환3개를 확인했다. keyed State·49px layout·source semantics·픽셀 변화·한 ticker·해제가 통과했다.29개 선정 영향 명령과 구분된 추가 검사1개이며 제품 source는 동일하다. 이 결과도 최신 native SDK artifact/device/physical/GPU/FPS 검증으로 확대하지 않는다.


### 9.12 Chip·Icon 테마/data와 상태별 테두리·Stadium 기반

직전 W11 입력1271·receipt283/control4의 정확한 bytes와 계승 immutable 기록을 보존한 baseline에서 계속했다. Chip/Icon/도형 실행 기록 (보관된 과거 기록 `w11-design-chip-foundation.json`)에 현재 소유자·원본 비교·공개 archive·회귀·checkpoint를 연결한다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

- Core `IconThemeData`의9개 필드·fallback/copy/merge/lerp·opacity clamp·live shadows·runtime-class equality/hash/diagnostics와 실제 `IconTheme` 상속·merge·resolve-before-fallback·갱신을 공급했다. `IconData`의 exact integer/final runtime owner·live font fallback list·equality/hash/string과 codePoint diagnostic JSON을 공급했다. `Icon` 글리프나 font asset 공급으로 확대하지 않는다.
- `CupertinoIconThemeData` subtype-copy와 ambient dynamic color 해석을 연결했다. unchanged 원본 실행에서 반복 적용된 `Diagnosticable` mixin이 부모 debug 메서드를 가려 진단 필드가 color 하나임을 확인했다. TS도 동일 mixin 순서로 보정했으며9+1개의 진단이라고 추정하지 않는다.
- `ChipThemeData`의23개 source field·fromDefaults·copy/lerp·private side 보간·equality/hash/diagnostics와 실제 inherited `ChipTheme`,4개 nullable `ChipAnimationStyle`을 공급했다. ThemeData는 canonical Core iconTheme와 Material chipTheme를 가지고 Theme가 실제 IconTheme를 설치한다. source의 `checkMarkColor` diagnostic key도 유지한다.
- `WidgetStateBorderSide` callback/map/nullable lerp는 실제 generated property/constraint/Mapper에 연결한다. callback의 default BorderSide equality는 resolver identity와 무관하며, map-backed 값은 일반 Side 필드/메서드 접근을 거부한다. nullable generic witness를 유지한다. Chip side는 empty states로 먼저 해석하며 두 supplied side가 모두 null로 해석되는 source runtime 실패를 유지한다.
- `StadiumBorder`와 circle/rounded private 전환 전체 계약을 현재 Core ShapeBorder·Radius·Path·Canvas·Material에 연결했다. source private circularity/rectilinearity scale과 eccentricity를 제외한 private equality/hash, directional radius와 별도 inner inset 수식을 유지한다. native 대조에서 연속 BorderSide 보간의 중간 ARGB 변환 손실을 발견해 공통 Side 내부에 actual floating Core Color를 보존했다. copy/scale/merge/lerp/equality/hash는 이 Color를 사용하고 public paint color의 기존 ARGB8 ABI는 유지한다.

원본 비교는 전체 unchanged IconThemeData/IconTheme/IconData/IconDataProperty/CupertinoIconThemeData/ChipThemeData, original BorderSide 및 state-property/side callback·lerp helpers를 native Dart 두 모드에서 실행하여68개 행을 비교한다. Icon lerp20·Chip lerp15·side lerp12, defaults/copy/merge/list/hash 관계와9/1/23개 진단 속성을 포함한다. finite Shadow/Offset/simple Insets/TextStyle/BoxConstraints/diagnostic/context/dynamic-color/map receiver의 범위를 명시하며 full source hierarchy·map 전체 원본·serialized inspector·VM 숫자 hash를 주장하지 않는다. 실제 Core Root의 ambient icon 결과는 별도 비교한다.

Stadium과 두 private class의 unchanged 전체 본문 및 original BorderSide는25개 shape/scale/lerp/null/copy 구성의 가로·세로·정사각형/양방향150개 조합을 비교했다. 실제 owning Core outer/inner Path, interior/border paint command, finite hit test, preferInterior와 private equality/hash 관계가 두 Dart 모드에서 일치한다. finite Radius/BorderRadiusGeometry/Rect/RRect/Path/Canvas receiver와 path/paint float32 수송 경계를 명시하며 raster/GPU/native hierarchy 동일성을 확대하지 않는다.

실제 Root/CPU10개 그룹은 상속/동적색/상태 Side·live list·source defaults/diagnostics와 keyed Material의 Stadium→Circle→rounded 전환·clip/pixel/ticker 해제를 검증한다. 실제 RN Babel runtime은71개 design module의 하나의 Core identity로 기존 Refresh3개와 새 foundation2개 흐름을 실행했다. parser99개 module과 실제 runtime을 구분한다. 공개 NodeNext 정상/오류 타입·subpath/aggregate/Core identity, 작업 공간 밖 installed archive3491개 파일 bytes가 통과했다. 선정 영향30개와 전체27 recipe 생성/strict·선정6 fixture의 최종 hash/수치는 실행 기록을 따른다. 기존 Slider/Range/default 독립 원본 algorithm proof는 historical로 유지하고 현재 Root/DOM/generated 영향 검증으로 확대하지 않는다.

새7개 library의42개 class/mixin/enum/typedef 선언과 private helper를 먼저 일괄 IR로 확보하고, 기존125 full-family 선언을 byte 검증해 재사용했다. 현재 Doroti HEAD/hash와 새 범위84,683byte·2,335line·179개 virtual/override/abstract member의 실제 비용을 확인했다. ordered mixin/super/operator/multiple-interface emitter 제약은 `BLOCKED/PARTIAL`로 남기고 현재 Core functional owner를 선택했다. 새 compiler rule/promoted batch는 없다. 전체 원본 hierarchy/compiler closure를 기능 공급의 선행조건으로 바꾸지 않는다.

host 차이를 명시한다. inherited theme는 positional data/child 뒤 optional WidgetOptions key, Duration은 milliseconds, source generic은 explicit witness를 사용한다. TS static inheritance 때문에 state-side static lerp에는 inherited ordinary BorderSide overload도 존재한다. IconThemeData constructor assertion은 모든 host mode에서 강제하여 zero weight/opticalSize가 생기는 invalid null-lerp endpoint는 release에서도 거부한다. IconData의 final은 runtime에서 강제하며 source global `staticIconProvider`/tree shaking annotation은 이 선언 후보의 공급 범위가 아니다.

다음은 실제 Icon glyph/semantics/scaling/direction/variation과 per-View font-family 수송, Material/Cupertino icon font/data/notices, Tooltip과 RawChip/Action/Choice/Filter/Input/Chip의 실제 input/render/widget family다. Sparkle shader/runtime/native Android M3 default, 나머지 control/design, DESIGN-3/4, locale/seed/typography/assets, swipe RefreshIndicator와 W11-02~11도 계속 미완료다. 최신 Windows/Android artifact/reader 및 물리 IME/caret/haptic/GPU/FPS는 `notVerified`, dedicated Apple/Linux `SKIPPED`/provider `notVerified` 경계는 유지한다.

### 9.13 실제 Icon·전체 아이콘 목록·폰트와 SDK 공급

직전 W11 입력1288·receipt324/control4의 정확한 bytes와 계승 immutable 기록을 보존한 baseline에서 계속했다. Icon 실행 기록 (보관된 과거 기록 `w11-design-icons.json`)에 현재 source·원본 비교·폰트·SDK·공개 archive·생성 회귀와 checkpoint를 연결한다. 추가 SDK/tooling7개 파일은 최초 resume의 clean tracked 상태와 Git HEAD를 확인하고 이전 committed blob bytes를 별도로 보존했다. 기록하지 않았던 최초 worktree 줄바꿈 hash까지 추정하지 않는다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

- Core `Icon`을 실제 StatelessWidget·RichText/TextSpan/TextStyle·Semantics·ExcludeSemantics·SizedBox/Center/Transform·Paint에 연결했다. null icon, inherited theme·opacity·dynamic Cupertino color, source text height/leading, RTL 방향성, semanticLabel, shadow와 FILL/wght/GRAD/opsz variation 입력을 공급했다. `MediaQuery`의 명시적 nonlinear TextScaler를 한 번 적용하고 RichText에는 noScaling을 전달한다. 일반 Text도 같은 ambient scaler를 사용하며 scaler 변경 시 inherited notification이 발생한다.
- original IconData의 analyzer-resolved field/constructor `int` provenance에 근거한 `@dartType`/`@dartParam`을 유지한다. const catalog factory는 실제 Core final runtime type·기존 canonical Dart value owner를 사용한다. Material8825개·Cupertino1322개 전체 source 이름/값과 adaptive20개 getter·6개 플랫폼 정책을 생성했다. unchanged 원본 native Dart 두 모드에서10147개 정의와283개 alias identity 관계를 비교했다. lazy getter 공급이며 JS tree shaking이나 폰트 subset 완료를 주장하지 않는다.
- Doroti의 clean icon package에서 original MaterialIcons.otf·CupertinoIcons.ttf와 CC-BY-4.0/MIT 고지 bytes를 그대로 공급했다. 실제 SFNT cmap의9856개 unique code point에 대해10147개 정의 모두 non-notdef glyph로 연결된다. 모든 글리프의 raster golden 또는 원본 native renderer 동일성으로 확대하지 않는다. Material/Cupertino는 같은 Core Icon을 재수출하고 독립 catalog·font metadata·font/license export를 제공한다.
- SDK `AppAsset.packageSource`와 실제 Metro/CLI 경로는 설치된 package export에서 font/notice를 검증한 뒤 앱 로컬 경로로 공급한다. hash·상대 경로·notice/id·예산을 검증하고 이미 수정된 destination과 junction 경계를 보존한다. actual CLI readApplication→materialize→Windows bootstrap/config, Android bootstrap URI와 외부 설치 CLI 공급을 검증했다. 앱은 기존 text defaultFont를 유지하면서 icon metadata를 assets에 추가할 수 있다. font 도구/.NET/Dart는 제품 실행 의존성이 아니다.
- actual Root 검사에서 Focus debugLabel이 사용자 semantics 이름에 섞이는 문제를 확인했다. unchanged Focus/FocusScope build16개 분기를 native Dart 두 모드와 비교하여 label 없는 focus 상태·iOS onFocus 정책·scope explicitChildNodes 구성을 공급했다. Icon source의 noncontainer semantics는 상위 노드와 병합될 수 있으므로 glyph render 크기와 병합 semantics bounds를 별도로 확인한다.

원본 Icon 전체 constructor/build/debug 본문과 Focus/Scope build 메서드는 finite Widget/State/MediaQuery/TextStyle/Matrix/Semantics receiver에서 실행한다. Icon14개·Focus16개 구성을 실제 owning Core tree와 native Dart 두 모드에서 비교했다. 전체 native Focus State/hierarchy·inspector serialization·VM 숫자 hash는 이 비교에 포함하지 않는다. actual Root/CanvasKit CPU8개 그룹은 두 폰트와 astral glyph·null 무paragraph·RTL·nonlinear media·blend/shadow/variation·dynamic color·두 View·font provider/paragraph 해제·11개 diagnostics를 확인한다.

actual Chromium5개 흐름은 현재 SDK browser asset service가 hash-qualified 원본 font를 fetch하고 CSS FontFace와 owning Skia에 등록하는 경로를 실행했다. 실제 glyph pixels·DOM label·RTL·nonlinear scaling·두 View와 CSS/Skia/resource/DOM 해제가 통과했다. CanvasKit CPU raster이며 hardware WebGL/GPU·assistive reader·물리/FPS 결과가 아니다. actual RN Babel은 Core Icon source와 두 전체 catalog를 변환하여 하나의 Core identity로 기존 Refresh3·foundation2·새 Icon3개 흐름,76개 module을 실행했다. design parser103개 module과 runtime을 구분한다.

공개 Core/Cupertino/Material/SDK/Metro/CLI6개 archive를 offline으로 작업 공간 밖에 설치하고 NodeNext 정상/오류 타입·runtime canonical identity·실제 CLI font/notice 공급·4302개 installed file bytes를 검증했다. 선정 영향30개와 전체27 recipe 생성/strict·선정6 fixture를 실행한다. 첫 생성 회귀는 common package staging이 모든 export를 JS condition object로 가정하여 실제 font/notice string export에서 terminal FAIL했다. 정확한 이전 helper/log bytes를 보존하고 raw resource export를 원본 bytes 그대로 staging하도록 수정했다. 존재하는 파일을 덮어쓰거나 가짜 TS module mapping을 만들지 않는다. 보정 후 fresh 생성 회귀와 staged asset hash를 별도로 연결하며 이전 RN Babel 문법 실패와 혼동하지 않는다.

전체 Material/Cupertino catalog3개 선언을 먼저 analyzer IR로 확보하고 기존125개 full-family 및42개 Icon/Chip/shape 선언을 검증해 재사용했다. 실제 Doroti icon source HEAD/hash/비용을 확인했다. full emitter의 platform getter/import binding 제약은 `BLOCKED/PARTIAL`로 남기고 유한 resolved constant 생성과 현재 Core 기능 소유자를 사용한다. 새 compiler rule/promoted batch는 없으며27개를 유지한다.

다음은 Tooltip과 RawChip/Action/Choice/Filter/Input/Chip의 실제 input/render/widget family, Sparkle shader/runtime/native Android M3 default, 나머지 control/design·DESIGN-3/4·전체 locale/seed/typography/assets·swipe RefreshIndicator와 W11-02~11이다. 최신 Windows/Android artifact/reader·물리 IME/caret/haptic/GPU/FPS는 `notVerified`, dedicated Apple/Linux `SKIPPED`/provider `notVerified` 경계는 유지한다.

### 9.14 RawTooltip·Tooltip·theme·visibility와 실제 tooltip 수송

직전 W11 입력1323·receipt367/control4를 byte 검증하고 exact baseline을 보존한 뒤 계속했다. Tooltip 실행 기록 (보관된 과거 기록 `w11-design-tooltip.json`)에 구현·원본 비교·공개 공급·영향 회귀와 checkpoint를 연결한다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

- 고정 Flutter의 RawTooltip/Tooltip/theme/visibility와 painting geometry 전체18개 선언을 먼저 analyzer IR로 확보했다. 기존125개 full-family·42개 foundation 선언과 현재 Doroti tooltip source HEAD/hash/실제 비용을 확인했다. operator·superclass·ordered mixin emitter 제약은 `BLOCKED/PARTIAL`로 유지하고 현재 Core 소유자에 일관된 기능 포트를 연결했다. geometry 함수는 전체 emitted body를 채택하고 정확한 Core import binding만 변경했다. 새 compiler rule/promoted batch는 없으며27개를 유지한다.
- Core `RawTooltip`, source trigger enum/position context/callback과 Material `Tooltip`/State·15-field TooltipThemeData/TooltipTheme·TooltipVisibility를 공개 경로와 aggregate에 공급했다. hover/tap/longPress/manual, wait/show/exit 지연·취소, nested exclusive mouse hit, source animation style와 실제 ticker, 상위 global pointer dismiss·Feedback/tooltip semantics protocol·Escape·두 View·해제를 현재 Core arena/focus/animation/overlay에 연결했다. Duration은 host milliseconds다. height/verticalOffset5개 필드와 constructor 주석은 정확한 analyzer-resolved double/double? 기록과 공개 `.d.ts`를 확인한다.
- source Tooltip 기본 height는 desktop24/mobile32의 **최소 높이**다. 실제 text/font metrics와 padding 때문에 paint box가 더 클 수 있다. platform·brightness·theme/widget 우선순위, rich InlineSpan·동적 갱신·padding/margin/constraints·custom position·keyboard inset·ignorePointer 경로를 공급한다. original theme copyWith는 exitDuration을 constructor에 전달하지 않으며 lerp는 duration/trigger/feedback을 전달하지 않는다. 원본 전체 실행으로 이 누락을 확인하고 유지한다.
- 기존 bounded OverlayEntry를 transport로 사용하며 public OverlayPortal 전체 hierarchy를 새로 만들지 않는다. 실제 target transform/size·tooltip/overlay size로 position을 계산하고 paint/hit/semantics가 같은 위치를 사용한다. singular/offstage/가려진 overlay target은 표시하지 않는다. keyed 이동 동안 inactive target은 즉시 paint에서 제외하고 같은 entry를 재사용하며, 최종 unmount는 기존 deferred overlay removal protocol로 정리한다. source position 값과 실제 같은 프레임 anchor 이동을 확인하며 전체 원본 portal layout/callback timing 동일성은 주장하지 않는다.
- source tooltip 문자열이 host snapshot에서 빠지는 경로를 보완했다. label과 별도 `SemanticsNode.tooltip`을 검증·동결·수송하고 실제 SDK browser `aria-description`으로 공급한다. 갱신·exclusion 시 같은 DOM owner에서 이전 문구를 지운다. reader/OS native metadata 전달과 실제 발표는 별도 검증 범위다.

실제 Root/CanvasKit CPU12개 그룹은 공개/진단·minimum layout·glyph pixel·semantics·hover 지연/exit 취소·touch tap/long-press arena·global pointer/opt-out·Escape down 우선 처리와 key-up 전파·visibility/empty·rich/custom position·같은 프레임 transform/singular/offstage·nested hover·두 View 자원 해제를 확인한다. 원본 TooltipThemeData/TooltipPositionContext/positionDependentBox 전체 body와 설치된 Dart SDK VM min/max body는 두 native Dart 모드에서 theme22개 행·15개 diagnostic·geometry32개·numeric81쌍을 비교한다. source num의 int/double·NaN·signed-zero 선택은 실제 retained carrier를 사용하며 raw-number provenance를 거부한다. finite Insets/TextStyle/BoxConstraints/diagnostic receiver와 null decoration 경계를 명시한다. 원본 RawTooltip State/build/timing 전체 body/hierarchy 실행은 이 비교 범위가 아니다.

추가 실제 shared ServicesBinding/HardwareKeyboard 검사는 primary focus가 없는 두 Root에서 Escape가 다른 View tooltip도 닫는 오류를 재현했다. 정확한 실패 receipt와 이전 RawTooltip bytes를 보존하고 fallback을 현재 Root의 키 ingress로 옮겼다. focused child는 early Focus handler에서 보호하며 focusless fallback도 View 소유권을 유지한다. 보정 중 최초 생성 회귀는 임시 잘못된 hosting/events import가 scratch에 복사되어 TS2307 terminal FAIL했다. 해당 staged source/log를 보존하고 실제 ui/input 경로로 수정한 소스를 고정한 뒤 무효화된 Tooltip/archive/generated 검증을 갱신한다. 이전 RN Babel 문법/asset staging 실패와 구분한다.

actual Chromium5개는 현재 SDK font/DOM service·Noto/CSS FontFace·owning Skia CPU glyph pixels·aria-description 갱신/삭제·직접 Core hover/Escape ingress·두 View/해제를 확인한다. 실제 OS pointer/reader/GPU/FPS 결과로 확대하지 않는다. RN Babel은 실제 변환한 Material Tooltip/theme/visibility/App/aggregate75개 module을 current compiled Core identity와 CPU Root에서3개 흐름으로 실행한다. 전체106개 design module syntax는 이전 parser103개 중 unchanged101개 bytes와 현재 실제 Babel 변환/실행5개로 content 검증한다. Core RawTooltip 자체는 이 Babel 검사에서 compiled Core 경로다.

영향 검사30개, 공개 Core/Cupertino/Material/SDK/Metro/CLI6개 archive·NodeNext 정상/오류 타입·Core identity·외부 설치4327개 file bytes와 전체27 recipe 생성/strict·선정6 fixture의 최종 hash·수치는 실행 기록을 따른다. 실제 shared keyboard 수정 전 결과는 historical/invalidated로 보존하고 현재 source 결과로 대체한다. 최신 Windows/Android SDK artifact·reader·물리 IME/caret/haptic/GPU/FPS는 `notVerified`다.

다음은 RawChip/Action/Choice/Filter/Input/Chip의 실제 widget/render/input family와 나머지 복합 디자인·App/API, Sparkle shader/runtime/native Android M3 default·전체 locale/seed/typography/assets·swipe RefreshIndicator·W11-02~11이다. 전체 단계 완료로 계산하지 않으며 dedicated Apple/Linux `SKIPPED`/provider `notVerified` 예외를 유지한다.

추가 geometry 검사는 interactive RawTooltip에 실제 source semantics boundary를 형성하여 anchor 이동과 같은 프레임에 bounds가 x70→190으로120px 이동하고 width60을 유지하는 것을 확인했다. 같은 새 위치의 실제 gesture arena tap도 한 번 전달된다. 병합된 ancestor bounds를 glyph 크기로 사용하지 않는다. 이 검사는 선정 영향30개와 구분된 추가1개이며 제품 bytes는 같다. TooltipState의 사용하지 않는 source ticker mixin은 중복하지 않고 RawTooltip이 실제 ticker를 단독 소유한다.

### 9.15 Chip 공통 VisualDensity·tap target·ThemeData 정책

직전 W11 입력1344·receipt410/control4의 bytes를 검증하고 baseline을 보존한 뒤 계속했다. 밀도·tap target 실행 기록 (보관된 과거 기록 `w11-design-density.json`)에 구현·원본 비교·공개 공급·영향 회귀·checkpoint를 연결한다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

기존125개 full-family IR에서 Chip/RawChip/Action/Choice/Filter/Input/theme의 전체48개 선언과 private layout·hit·paint·state·default helper를 검증해 재사용했다. 공통 VisualDensity/MaterialTapTargetSize2개를 추가 분석하여50개 후보를 평가하고 실제 Doroti source HEAD/hash/비용을 확인했다. Duration·superclass·ordered mixin binding 제약은 `BLOCKED/PARTIAL`로 유지한다. 이번 구현은 공통2개 선언을 현재 Core Offset·BoxConstraints·Diagnosticable·generated lerpDouble에 연결한 범위이며 신규 compiler rule/promoted batch는 없다.

VisualDensity의 전체 constructor/limits·platform constants·copy/lerp·base adjustment·effectiveConstraints·runtime-class equality/hash 관계·diagnostics와 MaterialTapTargetSize enum을 공개 theme-data/theme/widgets에 공급했다. source의 모바일 standard/padded·데스크톱 compact/shrinkWrap 기본값을 ThemeData에 연결하고 disabledColor/primaryColor의 기존 지원 옵션 내 M2/M3·light/dark 정책과 null-retaining copy를 공급했다. 보간에는 기존 Core generated lerpDouble을 사용하여 동일 축 값과 NaN factor의 source 빠른 반환을 유지한다. 전체 ThemeData constructor·다른 theme families 또는 VM 수치 hash/diagnostic identity 문자열 동일성을 추론하지 않는다. source assertion은 모든 host 모드에서 검사하며4개 double field·constructor/method와 enum integer provenance는 resolved IR/public declarations에서 확인한다.

원본 VisualDensity/MaterialTapTargetSize 전체 unchanged body와 original lerpDouble을 native Dart 두 모드에서 실행했다. 밀도/constraint25개·보간7개·copy/equality/hash/subtype/identity/default·diagnostic2개와 source ThemeData의 exact platform/density/disabled/primary statements25개 정책을 비교했다. finite Offset/BoxConstraints/diagnostic/ColorScheme/colors receiver 범위와 전체 원본 Core hierarchy·Theme constructor 미실행을 구분한다. 실제 Root/CanvasKit CPU4개 그룹은6개 host 플랫폼 정책·상속 Theme 갱신·동일 render owner에서38×36→22×32 layout/pixel 변화·null-retaining copy·해제를 확인한다.

actual RN Babel4개 흐름/76개 실행 모듈은 기존 Tooltip3개와 새로운 density/theme 갱신1개를 같은 Core identity에서 실행했다. 전체107개 design module syntax는 이전106개 중 unchanged104개 exact bytes와 현재3개 actual Babel 변환/실행으로 검증한다. 공개6개 archive의 외부 offline 설치·NodeNext 정상/오류 타입·공유 identity·null-retaining copy·4332개 installed file bytes가 통과했다. 영향 검사17개와 전체27 recipe 생성/strict·선정6 fixture의 최종 hash·수치는 실행 기록을 따른다.

다음은 이미 확보한50개 full-family IR과 현재 공통 설정을 사용한 실제 RawChip layout/hit/paint/checkmark/drawer/enable/selection/ink/focus/semantics/수명 및 Action/Choice/Filter/Input/Chip wrapper/defaults 구현이다. 기존 Core RenderBox/State 소유자를 사용하며 generic Slotted 전체 hierarchy나 compiler closure를 선행 완료 조건으로 추가하지 않는다. RawChip 계열은 아직 미완료다. Sparkle·나머지 design/locale/assets·swipe RefreshIndicator·W11-02~11과 최신 Windows/Android artifact/reader·물리 IME/caret/haptic/GPU/FPS는 계속 열린 범위이며 dedicated Apple/Linux `SKIPPED`/provider `notVerified` 경계를 유지한다.

공개 경로 비교에서 기존 theme-data가 ThemeData/Theme/ColorScheme도 재수출하는 alias임을 확인했다. 새 density-only 파일로 경로를 바꾸면 이 API가 빠지므로 기존 theme.ts alias를 유지하고 그곳에서 밀도 API를 재수출한다. 최초 신규 밀도 API 검사와 생성 회귀는 통과했으나 기존 alias projection을 검사하지 않은 범위다. 이전 archive/receipt·최초 생성 로그를 보존하고 기존3개 public identity를 추가한 외부 archive·영향17개 및 최종27 recipe/선정6 fixture를 metadata 고정 후 갱신한다. 이 검토를 terminal product FAIL로 기록하지 않는다.

다음 Chip avatar/delete child 교체에 필요한 AnimatedSwitcher·private State/_ChildEntry·callback typedef 전체5개 선언도 별도 IR로 확보했다. 이 후보는 다음 작업용 `PARTIAL` 자료이며 제품 채택/행동 검증/신규 batch 완료가 아니다. outgoing child·keyed update·fade·ticker와 해제를 포함한 전체 기능을 현재 Core 소유자에 연결할 때 사용한다.

### 9.16 실제 RawChip 계열·AnimatedSwitcher와 공통 semantics 보정

직전 W11 입력1356·receipt428/control4와 계승 immutable bytes를 검증한 baseline에서 계속했다. Chip 실행 기록 (보관된 과거 기록 `w11-design-chips.json`)에 현재 구현·원본 비교·실제 입력/paint·공개 공급·영향/생성 회귀와 checkpoint를 연결한다. owning source705·promoted batch27이며 신규 compiler rule/batch는 없다. 전체 요청은 계속 `ACTIVE / PARTIAL`이다.

- 이미 확보한 전체 Chip 계열50개 선언과 AnimatedSwitcher5개를 재사용하고 ShapeDecoration/painter2개를 추가 분석했다. 원본 private layout/hit/paint/State/default helper와 실제 Doroti source HEAD/hash/보정 비용을 함께 확인했다. Duration·superclass·ordered mixin·shortHash binding의 full-emitter 제약은 `BLOCKED/PARTIAL`로 남긴다. resolved IR의 정확한 field/constructor/default를 생성하는 Chip API projection과 현재 단일 Core identity의 기능 포트를 사용한다. 공개11개 double field 및 constructor의 provenance와 `.d.ts`를 확인하며 private AnimatedSwitcher counter의 int 주석은 public API로 내보내지 않는다.
- RawChip/Chip/ActionChip/ChoiceChip/FilterChip/InputChip과 세 elevated factory를 공개 subpath·widgets에 공급했다. controlled selection, required/nullable callback, enabled 정책, M2/M3 checkmark/delete icon·theme/widget/default 우선순위와 source key 전달 정책을 유지한다. 실제 Material/InkWell/Focus/Tooltip/Semantics와 네 controller의 duration/curve·reverse·update·해제를 현재 Core에 연결했다. custom animation duration은 원본처럼 init 때 정하고 widget 갱신 중 다시 쓰지 않는다.
- 실제 세 child RenderBox는 avatar/label/delete의 dry/wet/intrinsic/baseline, RTL·비대칭 padding·visual density·custom constraints·animated drawer 폭·label/delete 영역의 center hit redirect와 최소 tap/semantics bounds를 계산한다. source checkmark path·avatar scrim·disabled alpha와 color/shape-only background의 실제 paintInterior inset/border를 공급한다. private ordered slot adapter와 Core saveLayer alpha group을 사용한다. generic Slotted 전체나 original retained-opacity-layer/native compositing hierarchy를 완료로 주장하지 않는다. 전체 public ShapeDecoration의 image/gradient/shadow는 별도 미완료다.
- Core AnimatedSwitcher를 실제 State/TickerProvider/AnimationController/CurvedAnimation/FadeTransition/KeyedSubtree/Stack에 연결했다. Widget.canUpdate·keyed incoming 교체·여러 outgoing child·transition builder 변경·cached layout·source mutable callback list·reverse 종료와 자원 해제를 공급한다. floating disabled BorderSide 색상은 내부 Core source Color binding으로 보존하며 기존 ARGB8 paint ABI를 유지한다.
- 실제 SDK DOM 검사에서 두 오류를 재현했다. source Semantics의 transportId가 가짜 enabled flag를 생성해 Chip의 checked/button과 label/action 노드를 갈랐으며, nested delete DOM button click이 body handler로 전달되어 delete와 selection을 함께 호출했다. 정확한 이전 source/bundle/log bytes와 두 실패 replay를 보존했다. source-only transport id는 legacy annotation을 만들지 않도록 수정하고 SDK button action은 이벤트를 소유한 semantic node에서 한 번만 처리한다. 실제 legacy Semantics annotation과 retarget도 별도로 확인했다.

원본 unchanged `_RenderChip`/theme/sizes/hit helper와 다섯 M3 defaults·individual overrides·background resolver를 native Dart 두 모드에서 실행했다. renderer22개·default50개·background24개와 실제 Core 결과를 비교한다. finite leaf/geometry/animation/Canvas/theme/shape receiver, original renderer의 `needsCompositing=false` branch와 명시적 float32 tolerance를 사용한다. 원본 native text/ticker/input/hierarchy·retained compositor 실행으로 확대하지 않는다. source annotations22개/78 properties/23 callbacks·configuration·pipeline26개 검사는 공통 transport-id/DOM 수정의 actual Root 결과와 구분한다.

actual Core/CanvasKit CPU9개 그룹은 여섯 widget·LTR/RTL arena·delete/vertical padding·controlled selection·동일 keyed State·controller/paint·theme/state side·borrowed focus·keyboard/hover·AnimatedSwitcher 다중 outgoing·source/legacy semantics·해제를 확인했다. actual Chromium5개는 SDK font/image/DOM service·원본 Material font/Noto·glyph/checkmark pixels·분리된 body/delete semantic action·checked 갱신·동일 State/DOM·disabled/stale callback·RTL/두 View/종료를 확인했다. 직접 DOM/Core ingress이며 OS reader/물리 입력/GPU/FPS 검증은 아니다. 기본 아이콘은 현재 package-source font asset와 per-View 등록을 사용하며 암묵적 다운로드를 추가하지 않는다.

RN Babel8개 흐름/89개 실제 실행 모듈은 기존 Tooltip/density 흐름과 새 Chip/wrapper/AnimatedSwitcher를 하나의 Core identity로 실행했다. Core Icon과 AnimatedSwitcher source도 실제 변환·실행한다. 전체117개 design syntax는 직전 exact unchanged106개 bytes와 현재 실제 Babel 변환/실행11개로 검증한다. 공개 Core/Cupertino/Material/SDK/Metro/CLI6개 archive의 외부 offline 설치·NodeNext 정상/오류 타입·공유 identity·Chip/AnimatedSwitcher API·4387개 installed file bytes, 선정 영향30개와 전체27 recipe 생성/strict·선정6 fixture를 실행했다. 최종 수치·terminal exit/hash와 재현 경계는 실행 기록을 따른다.

다음은 실제 InkSparkle shader/runtime와 native Android M3 기본 경로, 남은 DESIGN-3/4·App/API·전체 locale/seed/typography/font/asset/shape·swipe RefreshIndicator·W11-02~11이다. 최신 Windows/Android artifact/reader·물리 IME/caret/haptic/GPU/FPS는 `notVerified`, dedicated Apple/Linux `SKIPPED`/provider `notVerified` 경계를 유지한다. 이번 Chip 범위의 검증 완료를 전체 단계 완료로 계산하지 않는다.

### 9.17 사용자 요청에 따른 중간 마무리

사용자의 “일단 중간 마무리 해줘” 요청으로 2026-10-18T05:47:03.246Z에 실행을 `PAUSED`로 전환했다. 전체 계획은 `IN_PROGRESS / PARTIAL`, `wholePlanComplete=false`이며 명시적인 재개 요청 전에는 구현·장시간 검증을 이어가지 않는다. §9.16 Chip/AnimatedSwitcher/common semantics/SDK action 구현과 원본/Root/Babel/Chromium/public/영향/생성 검증 결과는 그대로 보존한다. 문서·control 변경 외 제품 bytes는 바꾸지 않았으며 새 native/물리 환경 결과로 승격하지 않는다.

중간 마무리 checkpoint (보관된 과거 기록 `w11-middle-pause.json`), 활성 checkpoint (보관된 과거 기록 `w11-active-checkpoint.json`), progress/handoff에 이전 입력1384·receipt454/control4의 정확한 bytes·dirty diff·진행 프로세스 없음과 재개 순서를 연결한다. 최종 입력/receipt 개수와 hash는 checkpoint 및 최종 무결성 검사 기록을 따른다. 이전 후보/실패와 immutable W10 기록도 유지한다. 공유 artifact/CUA/Jarvis 서비스는 작업 프로세스가 아니므로 보존했다.

InkSparkle는 기존125-family IR·원본 Flutter shader·Doroti 포트·현 Skia gradient/image 수송 경계를 읽기만 했다. shader 컴파일/native probe·새 제품 구현/수송 검증은 수행하지 않았다. scratch의 Sparkle 초기 baseline은 구현 완료 증거가 아니다.

재개 시 먼저 `w11-resume.mjs`로 plan/progress/handoff/checkpoint·입력/receipt·source pin·dirty 상태를 확인하고, 현재 중간 마무리 control bytes를 보존한 뒤 `ACTIVE`로 전환한다. 다음 기능은 실제 InkSparkle shader/runtime·native Android M3 default이며 남은 DESIGN-3/4·App/API·전체 locale/seed/typography/font/asset/shape·swipe RefreshIndicator·W11-02~11을 계속한다. 최신 Windows/Android artifact/reader·물리 IME/caret/haptic/GPU/FPS는 `notVerified`, dedicated Apple/Linux `SKIPPED`/provider `notVerified` 경계도 유지한다.

### 9.18 전체 작업 재개

`work11.md 전체작업해줘` 요청으로 2026-10-18T06:24:15.057Z에 실행을 `ACTIVE / PARTIAL`로 재개했다. 입력1385·receipt460과 계승 W10 입력621·receipt12927, Flutter pin 및 control hash 검증이 통과했고 작업 트리는 clean이었다. 중간 마무리 기록과 이전 입력/control bytes를 보존했다. 다음은 InkSparkle shader/runtime·native Android M3 기본 경로이며, §2의 나머지 전체 범위도 계속 유효하다. 이번 재개 무결성 검사는 제품/native 검증을 추가하지 않는다.

### 9.19 InkSparkle·runtime shader·wire11 공급

실행 기록 (보관된 과거 기록 `w11-design-sparkle.json`)에 InkSparkle, Android native M3 기본 factory, 공통 RuntimeShader와 Web/RN/native 경로의 선정 검증을 연결했다. 전체 실행은 `ACTIVE / PARTIAL`이며 W11-01/03/06/08 전체 완료가 아니다.

- 기존 전체 InkSparkle/private factory/helper 4개 IR과 현재 Doroti source/hash/비용을 확인하고 현재 Material·Core animation/render 소유자를 유지하는 기능 포트를 적용했다. 617ms·radius/center/alpha/sparkle-alpha·원본 초기 색상·seed·rect/rrect/custom/uncontained clip·완료/조기 해제를 공급한다. 원본 애니메이션 구성문, TweenSequence/curves, 전체 uniform/target-radius 메서드를 finite receiver의 native Dart 두 모드에서 실행하여 실제 Core 9시점×28=252개 float32 uniform과 일치했다. 전체 원본 ticker/native hierarchy를 실행한 결과로 확대하지 않는다.
- 고정 Flutter shader를 유한한 GLSL→SkSL spelling/entrypoint·uniform alias 보정으로 공급한다. generator는 수동 수정 충돌을 거부하고 pin/hash/license/notice를 기록한다. Core RuntimeShader는 bounded ASCII SkSL·최대256 finite float uniform을 불변 값으로 기록한다. child effect는 지원하지 않는다. Flutter FragmentProgram asset API와 동일하다고 주장하지 않으며 backend 컴파일은 동기식이다. zero-area reference box는 paint를 생략한다.
- wire11은 packed source·uniform 수송과 native preflight 검증을 추가한다. 기존 wire1~10 clear는 유지하고 낮은 wire의 runtime shader는 거부한다. RN 공급 handshake를11로 올렸으며, native manifest의 오래된9 고정을 Core/native 정의 일치 검사 기반 생성으로 수정했다. 기존 native supplier는 재빌드가 필요하다.
- 실제 Core Root3·RN Babel9흐름/91모듈·Chromium WebGL3시점·외부8개 archive/5758 installed bytes·선정 영향15개와 생성27 recipe/선정6 fixture를 검증했다. Chromium GPU는 명시적 SwiftShader다. Windows 실제 AMD Radeon780M Graphite/Vulkan offscreen은 solid 독립 픽셀·Sparkle 출력·11개 malformed/compile/type 오류의 화면 변경 전 거부·복구/종료를 검증했다. Android native 기기/JSI 실행, 물리 입력·scanout/FPS 완료를 뜻하지 않는다.
- 최초 native 빌드의 Skia API 불일치와 영향 magnifier fixture의 이전 wire10 기대값 실패를 보존했다. 현재 헤더에 맞게 native API를 보정하고 magnifier fixture는 wire11 및 별도 출력 디렉터리로 갱신했다. 최종 영향 검사는 통과했다.

지속 program cache/성능, 현재 Android native package/기본 경로·실제 입력/해제, 남은 DESIGN-3/4·locale/seed/typography/assets/shape·swipe RefreshIndicator 및 W11-02~11은 계속 진행한다. 이번 scoped 검증을 전체 제품 또는 물리 환경 완료로 승격하지 않는다.

### 9.20 Runtime program cache·Android native 공급

실행 기록 (보관된 과거 기록 `w11-runtime-program-cache.json`)에 Core/Web/RN/native runtime program cache와 최종 Android APK의 입력·화면·해제 근거를 연결했다. 전체 `ACTIVE / PARTIAL`을 유지하며 W11-03은 선정 runtime 구현·검증이 진행된 `PARTIAL`이다.

- 각 View/renderer 소유자에 source-key LRU(최대16개, ASCII source128KiB)를 공급했다. uniforms 변경은 재컴파일하지 않으며 compile/type 오류는 기존 cache를 보존한다. context loss는 재컴파일하고 종료는 drain 후 소유권을 해제한다. JS native 삭제 실패는 불확실 소유권을 보존하고 중복 삭제/재사용을 거부한다. RN SDK의 renderer·text·picture가 Surface cache를 공유한다. 이 제한은 driver memory 제한이 아니다.
- 기존 C++ FrameResources layout/vtable과 원래 replay entry를 유지하고 명시적 cache overload를 추가했다. ABI1/wire11을 유지한다. RN 공개 선언의 내부 경로 노출을 공개 타입 명시로 수정했다. 소스 ABI 검사이며 임의 외부 prebuilt C++ ABI 전체 검증은 아니다.
- JS/cache5개 그룹, 실제 Windows AMD Vulkan offscreen24프레임·독립 소유자·16개 LRU·128KiB 제한·retained picture·오류 복구/종료, Chromium AMD/D3D11 실제 WebGL4프레임·fence retirement·loss/restore·픽셀 복구/종료를 검증했다. software Chromium의 raw fence 실패는 별도 환경 진단으로 보존했다.24회 CPU 측정은 FPS 근거가 아니다.
- 외부8개 archive/5763개 설치 파일의 NodeNext·runtime 소비와 영향15개, 전체27 recipe 생성/strict 및 선정6 fixture가 통과했다. 최종 native overload 수정 후7개 archive를 그대로 재사용하고 RN archive의 변경이 native3파일+manifest뿐임을 전체 파일 비교로 확인했다. 공개 TS/JS/declaration은 통과한 소비와 동일하다.
- 최종7개 native 공급 패키지의 설치5721개 파일 bytes를 확인하고 Temurin21로 Release x86_64 APK를 만들었다. task-owned read-only Pixel5 emulator(host NVIDIA GPU)의 실제 SDK/RN JSI/native Surface에서 ADB2회 터치→기본 InkSparkle→compile1/cache reuse→animation/ticker 종료→Surface unmount/cache0을 확인했다. 버튼 영역 두 animation 스크린샷은 기준과 다르고 두 완료 화면은 정확히 동일하다. font가 누락된 초기 fixture 실패와 GraalVM jlink 실패를 보존했다. 사용자 sample은 변경하지 않았다. 전용 emulator/receiver/reverse를 종료했다.

708개 owning source와27개 promoted batch를 유지한다. 복합 control·full locale/seed/typography/assets/shapes·swipe RefreshIndicator와 남은 W11 단계는 계속 진행한다. 이 결과는 물리 터치·IME·scanout/FPS·production signing·전체 제품 완료를 뜻하지 않는다.

### 9.21 사용자 요청에 따른 중간 마무리

사용자의 “일단 중간마무리해줘” 요청으로 실행을 `PAUSED`로 전환했다. 전체 계획은 `IN_PROGRESS / PARTIAL`, `wholePlanComplete=false`다. 명시적인 재개 요청 전에는 구현·장시간 검증을 이어가지 않는다. §9.19~9.20 InkSparkle·runtime shader·View별 program cache와 실제 Windows offscreen/하드웨어 WebGL/격리 Android APK·JSI·터치·픽셀·종료, 공개 공급·영향·생성 회귀의 선정 검증 결과를 그대로 보존했다. 물리 입력·IME·scanout/FPS·전체 제품 완료로 승격하지 않는다.

중간 마무리 checkpoint (보관된 과거 기록 `w11-runtime-cache-pause.json`), 활성 checkpoint (보관된 과거 기록 `w11-active-checkpoint.json`), progress/handoff에 이전 입력1438·receipt497·control4의 정확한 bytes, dirty diff, 전용 작업 프로세스 없음과 재개 순서를 연결했다. 최종 입력/receipt 개수와 해시는 checkpoint 및 최종 무결성 검사 기록을 따른다. 제품 소스는 추가 변경하지 않았다. 전용 Android emulator/receiver/reverse는 이미 정리됐으며 공유 서비스는 유지했다.

ListTile/Divider/CupertinoListTile 계열은 현재 구현을 읽고 다음 묶음으로 확인한 상태다. 새로운 기능 구현·변환·제품 검증은 시작하지 않았다. 재개 시 `w11-resume.mjs`로 plan/progress/handoff/checkpoint·입력/receipt·source pin·dirty 상태를 검증하고 현재 pause control bytes를 보존한 뒤 `ACTIVE`로 전환한다. 이후 DESIGN-3/4 복합 컨트롤·App/API, full locale/seed/typography/fonts/assets/shapes·swipe RefreshIndicator 및 W11-02~11을 이어간다. 전용 Apple/Linux `SKIPPED`와 provider `notVerified` 경계도 유지한다.

### 9.22 전체 작업 재개

`work11.md 전체작업해줘` 요청으로 2026-10-18T07:34:12.650Z에 실행을 `ACTIVE / PARTIAL`로 재개했다. 입력1439·receipt503과 계승 W10 입력621·receipt12927, Flutter pin 및 control hash 검증이 통과했다. 작업 트리 상태는 재개 receipt에 보존한다. 중간 마무리 기록과 이전 입력/control bytes를 보존했다. 다음은 DESIGN-3/4 ListTile·Divider·CupertinoListTile 등 복합 컨트롤이며, §2의 나머지 전체 범위도 계속 유효하다. 이번 재개 무결성 검사는 제품/native 검증을 추가하지 않는다.

### 9.23 목록 family 분석·Divider/theme와 hairline paint

실행 기록 (보관된 과거 기록 `w11-design-dividers.json`)에 목록 family 분석과 Divider·VerticalDivider·DividerThemeData·DividerTheme의 선정 구현/검증을 연결했다. 전체 실행은 `ACTIVE / PARTIAL`이며 W11-01 전체 완료가 아니다.

- Material divider/list-tile/theme/check/radio/switch tile와 Cupertino tile/section의9개 전체 라이브러리·private helper34개 선언을 분석했다. frontend IR은 확보했으나 전체 body emission은 superclass·ordered mixin·pattern binding에서 `BLOCKED`다. 현재 Doroti HEAD/bytes·override/named argument 비용을 비교하고 현재 Core 소유자의 기능 포트를 선택했다. ListTile 계열의 후보 확보를 제품 공급으로 세지 않는다.
- Divider 수평/수직 extent·thickness·directional indent·color/radius, M2/M3 기본값, createBorderSide·local/global theme 우선순위와 실제 Container/Border/InheritedTheme 소유자를 공급했다. ThemeData.dividerTheme/dividerColor는 source null-retaining copy와 M3 outline/M2 dark/light 정책을 따른다.12개 nullable double field 및 constructor/관련 method의 resolved IR 숫자 주석과 공개 선언을 확인했다.
- 공통 Border.paint가 zero-area rect를 조기에 생략하던 경로를 보정하여 M2 hairline을 실제 paint에 전달한다. 원본 Divider/default/theme 전체 unchanged body를 native Dart 두 모드의 유한 widget/color/radius/diagnostic receiver에서 실행하여 build16·border11·lerp13·정책4와 copy/equality/hash 관계·diagnostic6개를 비교했다. 원본 native engine/layout hierarchy·VM hash나 임의 color interpolation 전체로 확대하지 않는다.
- 실제 Root/CanvasKit CPU4개 그룹은 수평/수직 한 device-pixel hairline, M3 두께/rounded paint, 비대칭 RTL indent·directional radius, local/fallback inherited theme 갱신·wrap·동일 keyed render·해제를 확인했다. RN Babel2개 흐름/91개 실제 source 실행 모듈과 외부3개 archive의 offline NodeNext 정상/오류 타입·공유 Core identity·설치3630개 file bytes가 통과했다. SDK/native/물리 환경 공급 검증으로 확대하지 않는다.
- 선정 영향11개와 전체27 recipe 생성/strict·선정6 fixture가 통과했다. 신규 compiler rule/managed batch 승격은 없다. fixture bootstrap의 Node/Bun·nullable diagnostic·host/mode·private import·CanvasKit instance·Babel/ESM 등록 혼합 오류 로그를 보존했고 최종 fixture는 통과했다. 완전한 실패 fixture source snapshot은 확보하지 않았다.

다음은 확보한34개 선언을 재사용한 ListTile 네 slot layout/baseline/dry/intrinsic·입력/ink/focus/theme/semantics·toggle tile·Cupertino tile/section이다. 나머지 DESIGN-3/4·전체 locale/assets·swipe RefreshIndicator·W11-02~11 및 최신 전체 native/물리 IME/caret/scanout/FPS·production 공급은 계속 열려 있다.

### 9.24 ListTile 네 slot·테마·상태 색상/커서

실행 기록 (보관된 과거 기록 `w11-design-list-tiles.json`)에 ListTile·ListTileThemeData/ListTileTheme와 공통 상태값의 선정 구현/검증을 연결했다. 전체는 `ACTIVE / PARTIAL`이며 W11-01 전체 완료가 아니다.

- 확보한 목록 family34개 선언의 IR을 재사용했다. WidgetStateColor/MouseCursor 전체 private helper·SafeArea/SliverSafeArea·IconButtonThemeData/Theme11개 선언을 추가 분석했다. 전체 body emission은 inherited accessor·super constructor·ordered mixin에서 `BLOCKED`이며 명시적 소유자 기능 포트를 선택했다. 후보 확보를 제품 공급으로 세지 않는다.
- ListTile 전체 resolved 공개 필드/기본값과 세 enum·22-field theme API를 생성기 소유 projection으로 공급하고8개 nullable double field의 source/public declaration provenance를 확인했다. 네 slot wet/dry/intrinsic/baseline·density/compact/three-line/RTL·paint/hit, M2/M3 defaults·상태색/커서 우선순위, 실제 Material/Ink·focus/semantics/input·divideTiles·modern local/global theme merge/wrap·diagnostics를 공급했다. source wrap의 text style/minTileHeight 등 생략을 보존하고 obsolete theme aliases는 제거했다. 기존 positional 생성 ingress는 Text/onTap으로 정규화하며 공개 title은 Widget|null이다. 선정 Scaffold는 Material owner를 공급한다.
- source slot 교체 중 기존 multi-child reconcile의 일시적인 fifth child가 실제 Root에서 재현됐다. 네 persistent slot proxy로 수정하여 sibling title State/focus를 유지한다. 원본 renderer와 title-alignment method의 unchanged body를 native Dart2모드·유한 leaf/constraint/slot receiver에서 실행해24개 wet/dry/intrinsic/baseline/paint/hit 구성을 비교했다. 원본 native paragraph/Slotted 전체 hierarchy로 확대하지 않는다.
- 공통 WidgetStateColor/MouseCursor callback/default/map factory·canonical Color/cursor·property multiple-interface·generic mapper storage/type bridge·양방향 equality·live map inline hash를 공급했다. MouseCursor의 virtual identity/system-value hash를 canonical owner에 등록했다. color/cursor 기본 상태의 const Set은 공통 canonical owner로 identity/불변성을 보존하고 transparent Color도 기존 canonical const owner를 사용한다. private SafeArea 선정 경로는 horizontal safe inset만 소비하며 공개 SafeArea/SliverSafeArea 전체 공급이 아니다. IconButtonThemeData/Theme와 기존 finite7-field ButtonStyle의 lerp/equality/hash를 공급했으며 전체 source ButtonStyle/IconButton은 열려 있다.
- original22-field theme/default/IndividualOverrides/state factory/icon theme unchanged body를 native2모드의 유한 receiver에서 실행해 lerp13·default8·color override12·cursor policy4·icon-theme lerp4·copy/equality/hash/diagnostics와 const 기본값3개 관계를 비교했다. actual canonical state values4개 그룹과 실제 Root6개 그룹은 paragraph/pixel·slot/theme 갱신·pointer/Enter/long press·controlled selection/disabled·stale callback·borrowed focus/states·nested child action·safe inset·retirement를 확인했다. RN Babel3개 흐름/100개 source module와 외부3 archive offline NodeNext 정상/거부 타입·공유 identity·설치3675개 bytes가 통과했다. 선정 회귀14개 및 전체27recipe 생성/strict·선정6fixture도 통과했다. compiler rule/managed batch 신규 승격은 없다.
- source witness/map hash/render-slot product 실패와 fixture/bootstrap 오류를 수정하고 확보한 실패 source/log를 보존했다. 최종 const host 보정으로 첫 생성 run은 source-byte mismatch를 거부했으며 보정 후 전체를 새로 실행했다. 일부 초기 TypeScript/native bootstrap 실패의 완전한 source와 generic-hash fixture-order 실패 log는 확보하지 못했다. source/runtime/native-platform/물리 evidence를 혼동하지 않는다.

다음은 checkbox/radio/switch tile·Cupertino tile/section이다. 나머지 DESIGN-3/4·전체 locale/assets·swipe RefreshIndicator·W11-02~11 및 최신 전체 native/물리 IME/caret/scanout/FPS·production 공급은 계속 열려 있다.

### 9.25 Cupertino 목록 공급과 Material2 제거

실행 기록 (보관된 과거 기록 `w11-design-cupertino-lists-m3-only.json`)에 두 변경의 구현·검증·소유권을 연결했다. 전체 W11은 `ACTIVE / PARTIAL`이다.

- CupertinoListTile/base/notched·Chevron·ListSection/base/insetGrouped의 resolved 공개 API와 기본값, canonical enum·다섯 numeric field를 공급했다. 실제 State/async tap pending·취소·성공·실패 latch·unmount를 유지하며 오류는 owning host error 채널로 전달한다. 전체 Dart Zone 구현을 주장하지 않는다. slot/typography/dynamic color/header/footer/separator·실제 Core superellipse path를 사용하는 private ClipPath receiver를 연결했다. 공통 finite ColorShapeDecoration을 Core로 공유하고 Material chip은 같은 owner를 소비한다. default margin은 source const처럼 공유한다.
- unchanged 원본 본문을 native Dart 두 모드의 finite receiver에서 실행해 tile24·section12·chevron2·default identity3·callback7 trace와 숫자 provenance를 비교했다. 실제 Root6개 그룹은 문단/RTL/키 상태 이동·pointer/nested action·async 오류/late unmount·active pixels·clip/hit·separator·실제 chevron glyph·해제를 확인했다. RN Babel3흐름/30모듈 및 외부3 archive의 offline NodeNext 정상/거부 타입·공유 identity·설치 bytes를 확인했다. 공개 전체 RSuperellipse/native hierarchy와 실제 native/물리 환경으로 확대하지 않는다.
- Material ThemeData의 useMaterial3와 applyElevationOverlayColor 옵션/멤버, ChipThemeData.fromDefaults·SliderThemeData.fromPrimaryColors·M2 elevation overlay methods를 제거했다. JS constructor/copy의 옛 theme 옵션은 명시적으로 거부한다. palette/surface/divider/primary/ink·chip·ListTile·progress·slider/range 기본값에서 M2 분기를 제거했다. Android stretch와 native Android InkSparkle/다른 host InkRipple을 사용한다. Fuchsia glow는 원본 M3 플랫폼 정책으로 유지한다. current/2023 M3는 유지하며 M2 지원을 뜻하지 않는다.
- chip API 생성기와 소유권/선정 source fixtures·공개 소비·notice/README를 함께 갱신했다. Material scroll은 generated에서 adopted로 명시 전환하고 이전 state/base/fingerprint/receipt를 보존했다. fresh reference generation은 exact resolved getter를 true에 고정한다. 향후 batch는 adopted 제품을 보존하므로 M2 분기/선택 API를 되살리지 않는다. 원본 Flutter pin은 수정하지 않았다. native 공급 fixture의 M2 mode도 제거했으나 최신 native 실행은 별도 `notVerified`다.
- 선정 검증27개(원본 유한 비교·실제 Core Root/CPU·RN Babel·외부 archive·managed API/notice·sample types), 전체27 recipe 생성/strict와 선정6 fixture가 통과했다. native fixture flag·host platform·제외된 M2 row 오류3건을 보정해 재검증했고, 수정한 Root label/count도 재확인했다. 정리한 notice를 포함한 최종 archive를 다시 확인했다. 일부 초기 Cupertino fixture의 완전한 실패 source는 확보하지 못했으며 확보한 로그/전후 source를 보존한다.

다음은 Material3 checkbox/radio/switch tile와 나머지 DESIGN-3/4·전체 locale/assets·W11-02~11이다. M2는 남은 작업에서 제외한다. 최신 전체 native·물리 IME/caret/scanout/FPS·production 공급 완료를 주장하지 않는다.

### 9.26 Toggle 테마28 필드·M3 defaults와 공통 Color identity

실행 기록 (보관된 과거 기록 `w11-design-toggle-foundation.json`)에 목록 wrapper의 공통 선행 기반을 연결했다. 전체 W11은 `ACTIVE / PARTIAL`이며 세 toggle 위젯/목록 wrapper 전체 완료가 아니다.

- 확보한 control125/list34 선언 IR을 보존하고 Checkbox/Radio/Switch 전체 theme, ToggleableStateMixin/Painter·RawRadio·RadioGroup/private registry18개 선언을 추가 분석했다. 전체 본문 emission은 ordered mixin·generic/stateful mixin·super adapter에서 BLOCKED다. 현재 Doroti의 세 theme source HEAD/bytes/virtual/named-argument 비용을 확인하고 현재 Core 소유자에 대한 기능 포트를 선택했다. 후보와 선언 수를 제품 동등성으로 세지 않는다.
- CheckboxThemeData9·RadioThemeData9·SwitchThemeData10의 전체 nullable 필드/constructor/copy API를 resolved IR projection으로 공급하고 null-retaining copy·non-null empty lerp·property/side/shape/padding/step 보간·runtime-class equality/hash 관계·diagnostics와 세 inherited theme의 of/wrap/value-based notification을 구현했다. 독립 checkbox-theme/radio-theme/switch-theme와 aggregate가 같은 owner를 공급한다. ThemeData는 공유 immutable 기본 data와 nullable copy 보존을 제공한다. generic innerRadius/trackOutlineWidth는 DartDouble carrier/witness를 사용하며 숫자5필드의 source/public declaration·constructor/copy 주석을 확인했다.
- private M3 기본 getter supplier3개를 공급했다. 원본이 공유하는 shape/padding/track property identity를 보존하고 track 폭 const는 기존 canonical generated WidgetStatePropertyAll<double>와 정확한 source double witness를 사용한다. M2는 공급하지 않는다.
- 원본 세 theme-data/M3 default 본문을 native Dart 두 모드의 finite context/shape/inset/icon/density/cursor/diagnostic receiver에서 실행해28필드·18상태/두 target·density context·nullable/외삽 lerp72·copy/equality/hash/diagnostics·const identity6·generic runtime type2·dual-null side rejection을 비교했다. Chip/Checkbox/Radio의 공통 side 보간은 source const empty 상태 Set의 identity/불변성3개 그룹과 양 끝 nullable floating color6개 구성을 보존한다. Shape receiver는 선정 rounded-radius 보간이며 원본 전체 native shape/VM hash/hierarchy 또는 전체 control State/paint를 주장하지 않는다.
- 검사 중 같은 Color 재등록 오류를 공통 sourceColor 경계에서 확인했다. 정확한 final Color와 이미 등록된 동일 concrete witness만 재사용한다. subclass/다른 owner 및 하위 captureDartType 중복 등록 거부는 유지한다. unchanged 원본 Color.lerp의11개 동일/다른/null endpoint와 NaN identity를 native 두 모드로 비교했다. source generic 숫자/클래스 소유권을 느슨하게 풀지 않았다.
- 실제 Root4개 그룹은 nearest/global theme·value equality notification·wrap/같은 keyed render·기존 지원 Checkbox/Switch 색상 픽셀/controlled pointer/keyboard/disabled·borrowed focus/해제와 generic double 거부를 확인했다. RN Babel4개 흐름/101모듈은 실제 Data/Theme/M3 supplier/App/aggregate·기존 컨트롤 입력/픽셀·const generic owner와 선정 Color capture 함수 본문을 실행했다. Core 전체 source module 초기화/graph 검증으로 확대하지 않는다. 외부3 archive의 offline NodeNext28필드/subpath/identity/정상·거부 타입과 설치3730개 bytes가 통과했다.
- 선정 영향16개 및 전체27 recipe 생성/strict·선정6 fixture가 통과했다. 공통 side 보정 전의 완료된27/6 생성 run은 historical로 보존하고 현재 bytes로 전체를 다시 검증했다. 초기 projection typing·finite native bootstrap·source numeric/witness·fixture keyboard/Set length 오류를 보정하고 확보한 실패 로그/전후 source를 보존했다. 일부 초기 완전한 before source는 확보하지 못했다. 신규 compiler rule/managed batch 승격은 없다.

다음은 완전한 M3 toggle control API/State/painter/테마 적용과 세 ListTile wrapper다. 현재 toggle 위젯은 기존 선정 필드만 지원하며 새 테마 필드 전체의 시각적 적용을 주장하지 않는다. 나머지 DESIGN-3/4·전체 locale/assets·W11-02~11과 최신 전체 native/물리 공급은 계속 열려 있다.

### 9.27 표준 Material Checkbox·공통 source motion

실행 기록 (보관된 과거 기록 `w11-design-checkbox.json`)에 체크박스의 표준 생성자와 공통 토글 기반의 구현·검증을 연결했다. 전체 W11은 `ACTIVE / PARTIAL`이며 Checkbox.adaptive/전체 CupertinoCheckbox·Radio/Switch·세 목록 wrapper는 다음 범위다. M2는 제외한다.

- 기존 resolved control IR과 앞서 비교한 Flutter/Doroti 소유권 결정을 재사용했다. Checkbox 표준 생성자의19개 전체 공개 필드/기본값과 StatefulWidget/State ingress를 managed projection으로 공급한다. splashRadius·static width의 resolved double provenance를 source/public declaration·constructor에 보존한다. 원본 raw CRLF bytes와 analyzer 정규화 LF hash를 구분해 검증한다. 기존 aggregate와 새 checkbox subpath가 같은 owner를 공급한다. 지원 Core extension을 명시적으로 Pick하고 JS의 알 수 없는 옵션/필수 nullable callback 누락을 거부한다. 내부 mouseCursorResolver는 공개 Checkbox 필드가 아니다.
- M39-field theme의 widget→local/global theme→default 우선순위, 선택/비선택 별도 fill·side, plain side의 선택 상태 생략과 state side callback, error/check/press/focus/hover 색상·state cursor, splashRadius, padded/shrinkWrap·visual density 크기와 실제 shape interior/path/border를 연결했다. 이전 finite 마크 대신 원본의 box 축소/확장·check 두 stroke·dash·false/true/null·forward/reverse paint와 radial reaction을 공급한다. paint ABI에서만 Color를 ARGB로 변환한다.
- 공통 Core ToggleableControl에 source motion 경로를 추가했다. null도 selected인 source 상태, 이전 값, null 전환 reset,200ms easeIn/easeOut 위치,100ms fastOutSlowIn reaction·50ms focus/hover fade·down position을 공급한다. ControlInteraction의 기존 focus/action/gesture/semantics/borrowed owner를 재사용하며 source cursor와 paint에는 pressed를 제외하고 highlight focus/hover를 제공한다. 기존 finite Cupertino/Radio/Switch 소비는 기존 경로를 유지하며 전체 source 시각 동등성을 주장하지 않는다. deactivate에서는 tick을 중지하고 dispose에서 controller/listener/ticker를 해제한다. 원본 tap은 focus를 요청하지 않지만 현재 공유 Core pointer tap은 focus를 요청하며, deactivate는 진행률을 target으로 맞춘다. 이 pointer focus·이동 중 animation parity는 다음 공통 입력 보완에서 닫아야 한다.
- unchanged 원본의 선정 build 결정문/_widgetFillColor/_resolveSide와 전체 _CheckboxPainter·radial method를 native Dart 두 모드의 finite receiver에서 실행했다. 값·disabled/hover/focus/error·widget/theme/null fallback·down 조합288개와 이전/현재 값·status/진행률·shape interior/path 분기432개가 일치했다. finite trace shape는 callback routing이며 전체 native shape/Widget/engine hierarchy나 실제 source mixin runtime 검증으로 확대하지 않는다.
- 실제 Root/CanvasKit CPU5개 그룹은19필드·기본값/override/density/shape/side/error pixels, 같은 keyed State, controlled 세 값 pointer/Space·mixed source semantics·stale/disabled callback, source curve/반응/cancel/focus/hover·pressed state 분리, borrowed focus/states·이동/교체·진행 중 종료를 확인했다. RN Babel4개 흐름/106개 모듈은 변경된 Core ControlInteraction/ToggleableControl 전체와 실제 Checkbox State/build/painter/Theme/App/aggregate를 canonical compiled framework/value identity에서 변환·실행했다. 나머지 Core의 전체 source 초기화/native RN은 주장하지 않는다.
- 외부3 archive의 offline NodeNext 표준19필드/정상·거부 타입/동일 StatefulWidget·공유 owner·numeric2와 설치3745개 bytes를 확인했다. 선정 영향16개 및 전체27 recipe 생성/strict·선정6 fixture가 통과했다. 이전 단순 painter를 찾던 영향 fixture와 native/bootstrap·Root fixture를 보정했고 확보한 전후 소스/실패 로그를 보존했다. ingress 보정으로 staged bytes가 무효화된 전용 생성 run은 확인된 PID를 종료한 뒤 전체를 새로 실행했다. 신규 compiler rule/managed batch 승격은 없다.

다음은 공통 source pointer focus·이동 중 animation 보존 보완, 전체 CupertinoCheckbox와 Checkbox.adaptive, 완전한 M3 Radio/Switch 및 세 ListTile wrapper다. 나머지 DESIGN-3/4·전체 locale/assets·W11-02~11과 최신 전체 native/물리 공급은 계속 열려 있다.

### 9.28 전체 CupertinoCheckbox·adaptive와 공통 입력·색상 값

[실행 기록](work11.md#928-전체-cupertinocheckboxadaptive와-공통-입력색상-값)에 구현과 검증을 연결했다. 전체 W11은 `ACTIVE / PARTIAL`이며 M2 제외 방침을 유지한다. 앞선 §9.27의 pointer focus·이동 중 motion·Cupertino/adaptive 미완료 항목은 이 범위에서 보완했다.

- 기존 complete control/list IR을 재사용하고 HSL/HSV·세 hue helper·Cupertino private/default/focus constants17개를 함께 추출했다. colors의 exact modulo receiver와 checkbox의 generic const/pure-expression emission은 `BLOCKED`, constants4개는 `EMITTED`다. Doroti의 현재 checkbox family를 비교한 뒤 complete source 본문을 명시적인 TS 포트로 공급하고 resolved public/numeric API/default를 managed projection으로 연결했다. compiler rule/batch 신규 승격은 없다.
- CupertinoCheckbox는 원본의14개 nondeprecated 필드와 StatefulWidget/State, static width double,12개 source 기본값·focus/tap constants를 공급한다. 사용되지 않는 deprecated inactiveColor는 타입과 JS ingress에서 제거한다. Core extension은 명시적인 Pick이고 알 수 없는 옵션/필수 nullable callback 누락을 거부한다. 기존 Nelyx 숫자 색상 ingress는 Core Color로 명시 변환한다. default/state side·shape·cursor, HSL focus color, disabled check,14px box/check/dash·dark enabled/disabled gradient·press overlay·focus stroke를 기존 Core paint owners에 연결했다. nullable source theme brightness는 specifiedBrightness로 유지한다. mobile44/desktop14·explicit Size의 tap bounds와 source의 직접 값 교체를 보존한다. 원본 Cupertino didUpdateWidget에 없는 position animation을 추가하지 않는다.
- Checkbox.adaptive는 기존19필드 생성자와 바깥 State를 유지하며 Theme.platform iOS/macOS에서 Cupertino로 전환한다. source12개 전달 필드와7개 무시 필드, Apple에서 Material local/global checkbox theme 생략, Foundation platform에 독립적인 크기 결정을 검증했다. 플랫폼 교체 시 내부 State/gesture/controller/ticker를 정리하고 최신 callback만 사용한다.
- 공통 source toggle은 pointer tap에서 focus를 요청하지 않으며 explicit focus/Space와 기존 버튼 focus 정책을 유지한다. GlobalKey의 부모 간 이동에서는 forward/reverse curve·이전 값·진행률·원래 deadline·pending pointer/reaction과 borrowed focus/states를 보존한다. dispose에서는 실제 ticker/controller를 해제한다. 기존 finite Radio/Switch 경로는 전체 source visual parity를 주장하지 않는다.
- 공통 HSLColor/HSVColor의 complete conversion/copy/nullable shortest-hue/extrapolation/equality/local hash/text·세 helper, numeric8 fields/params/returns와 const/root/value owners를 공급했다. shared canonicalDartList는 기존 SourceList/generic List·Iterable/type/value owner에서 boxed numeric witness·type-sensitive/signed-zero identity·readonly mutation/range/sublist를 제공한다. 임의 raw-number provenance를 추정하지 않으며 general compiler const-list emission과 full List API는 미완료다.
- 실제 Root에서 발견한 공통 CustomPaint의 getter-backed Size spread 누락을 width/height capture로 수정했다. BorderSide의 source color는 기존 nominal Color interface admission을 공유해 generated CupertinoDynamicColor receiver/floating state를 그대로 보존하며 exact final Color capture guard는 유지한다. ARGB 변환은 paint ABI에서 수행한다.
- unchanged 원본 default/side getters·selected complete build decisions·전체 painter를 native Dart 두 assertion 모드의 finite receivers에서 비교해 결정384개·플랫폼 크기6개·paint144개가 일치했다. 공통 input 원본12개와 실제 Root3그룹, HSL/HSV conversion28·grid288·lerp28·const8/generic2·assertion8, const List identity4/type4/mutation7·거부3개도 통과했다. finite source/shape/gradient receivers는 전체 native Widget/engine hierarchy의 실행 증거가 아니다.
- 실제 CPU Root6그룹은14필드·동적색상경계·크기/shape/side·pixels, controlled 세 값/직접 교체·keyboard/semantics/stale-disabled, dark/light/null·press/cancel/focus, held-pointer 이동/borrowed owner, adaptive6플랫폼·12전달/7무시·theme독립, 플랫폼 child 교체/retirement를 검증했다. RN Babel6흐름/126모듈은 변경 Core input/toggle/CustomPaint/HSL 전체와 실제 두 Checkbox/App/aggregate를 canonical compiled framework/value identity에서 실행했다. 별도 source39/compiled53 value dependency graphs는 const/list/color/type ledger를 각 graph 안에서 유지하며3흐름씩 실행했다.
- 외부 archive3개의 offline NodeNext 소비에서 두 Checkbox/API·원본숫자21·HSL/HSV·const List·동적테두리·제거/오류 타입과 설치3770개 bytes를 확인했다. 영향28개·전체27 recipe strict 생성/선정6 fixture가 통과했다. 실제 공통 결함의 전후 소스와 fixture/native/bootstrap/build 실패 보정 이력을 보존했다. 전체 Radio/Switch·세 toggle tile wrapper·나머지 DESIGN/W11 및 최신 native/물리 공급은 계속 열려 있다.

### 9.29 사용자 요청에 따른 중간 마무리

사용자의 “일단 중간 마무리하자” 요청으로 실행을 `PAUSED`로 전환했다. 전체 계획은 `IN_PROGRESS / PARTIAL`, `wholePlanComplete=false`다. 명시적인 재개 요청 전에는 구현·장시간 검증을 이어가지 않는다. Material M3 전용 방침과 §9.28 전체 CupertinoCheckbox·Checkbox.adaptive·공통 입력/이동 motion·Color/Size·HSL/HSV·typed const List 구현 및 source/Root/Babel/외부 archive/영향28/전체 생성27·선정 fixture6의 PASS-scoped 결과를 보존한다. 전체 native/물리 공급의 notVerified 경계는 유지한다.

중간 마무리 checkpoint (보관된 과거 기록 `w11-controls-pause.json`), 활성 checkpoint (보관된 과거 기록 `w11-active-checkpoint.json`), progress/handoff에 이전 입력1543·receipt664·control4의 정확한 bytes·dirty diff와 전용 작업 프로세스 없음, 재개 순서를 연결했다. 제품 소스와 기존 dirty 작업, 공유 서비스는 그대로 유지했다. 최종 입력/receipt 개수와 해시는 checkpoint 및 최종 무결성 검사 기록을 따른다.

당시 재개 절차의 `w11-resume.mjs`는 §0.1의 사용자 요청으로 삭제했다. 현재 재개 절차는 plan/progress/handoff/checkpoint·현재 입력/receipt·의도적 삭제 목록·source pin·dirty 상태를 확인하고 현재 pause control bytes를 보존한 뒤 `ACTIVE`로 전환하는 것이다. 명시적 재개 요청은 계속 필요하다. 다음은 기존 resolved control family IR을 활용한 완전한 M3 Radio/Switch와 세 toggle ListTile wrapper, 나머지 DESIGN-3/4·App/full locale/assets·swipe RefreshIndicator 및 W11-02~11이다.

### 9.30 초기 변환기 fixture/checks 삭제 — 2026-10-18

사용자 요청으로 초기 개발 도구의 `checks` 전체와 별도 Dart fixture 추출기를 제거하고 §0.1·§5·§6·재개 지시를 갱신했다. 변환기 README의 과거 검증 명령은 이력으로만 표시하고 외부의 삭제된 검증 링크·재생성 안내를 정리했다. 활성 입력에서 의도적으로 제거한 도구 파일과 변경 전 control/hash는 도구 정리 기록 (보관된 과거 기록 `w11-intermediate-tooling-cleanup.json`)에 기록한다. 과거 recipe·immutable receipt·이전 pause는 보존한다. 제품 구현·장시간 검증은 재개하지 않았으며 `PAUSED / PARTIAL`·전체 미완료·native/물리 `notVerified`를 유지한다.

## 10. W11 종료와 W12 이관 — 2026-10-18 KST

사용자의 “work11.md의 남은작업에 대해 work12.md에 새 작업계획으로 작성” 요청으로 **W11을 CLOSED / SUPERSEDED BY W12**로 종료한다. W11-00의 문서 이관은 완료 이력으로 남기고 W11-01~11의 미완료 요구는 [W12 단계표](work12.md#2-w11--w12-잔여-단계-대응)에 같은 번호의 W12-01~11로 전부 대응했다.

| W11 잔여 | W12 후속 | 종료 시 진행 상태 |
| --- | --- | --- |
| W11-01 디자인·locale | W12-01 | PARTIAL |
| W11-02 scroll·viewport | W12-02 | PARTIAL |
| W11-03 runtime·paint·text·입력 | W12-03 | PARTIAL |
| W11-04 편집·Form·입력 | W12-04 | PARTIAL |
| W11-05 앱·라우팅·복원 | W12-05 | PARTIAL |
| W11-06 플랫폼 runtime/tooling | W12-06 | PARTIAL |
| W11-07 개발 갱신·inspector | W12-07 | OPEN |
| W11-08 실제 환경·감사·공급 | W12-08 | PARTIAL |
| W11-09 접근성 | W12-09 | DEFERRED |
| W11-10 native/HTML view | W12-10 | DEFERRED |
| W11-11 최종 통합·정리 | W12-11 | OPEN |

현재 입력969·receipt670·control 연결5개와 계승 W10 immutable receipt12,927개의 hash가 이관 전 일치했다. owning source738·promoted batch27 및 제품·기존 증거를 보존한다. 변경 전 문서/control의 exact bytes와 이관 무결성은 [w12-plan-transfer.json](work11.md#10-w11-종료와-w12-이관--2026-10-18-kst)에 연결한다. 이번 작업은 문서/control 정리이며 제품 구현·build/runtime·native·물리 환경 검증은 재개하지 않았다.

W12의 첫 구현은 §9.28 이후 남은 **완전한 M3 Radio/Switch와 세 toggle ListTile wrapper**다. 남은 DESIGN-0~4·App/full locale/assets·swipe RefreshIndicator 및 W11-02~11의 필수 요구와 플랫폼 예외·notVerified 경계를 승계한다. M2와 삭제한 초기 변환기 checks의 복구/유지는 필수 작업에 포함하지 않는다.

현재 진행과 재개 기준은 [work13.md §7](work13.md#7-현재-상태와-재개-순서)에서 관리한다. 별도 progress/checkpoint/handoff JSON은 삭제했으며 다시 만들지 않는다. W12도 종료됐고 W13은 **ACTIVE / READY 계획 · PAUSED 실행 · PARTIAL 제품**이다. 명시적 재개 요청 전에는 구현을 계속하지 않는다. W11/W12 종료는 제품 완료 판정이 아니다.
