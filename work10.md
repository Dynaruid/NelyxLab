# work10 — Nelyx TypeScript 기능 동등성 구현·통합 계획 (CLOSED)

> 2026-10-19 긴급 정리: 이 문서의 보고서·validator·재개 지시는 과거 이력이다. 현재 계획·짧은 진행 상태·재개 기준은 [work12.md](work12.md)를 따르며 실행은 PAUSED다. 필요한 생성 입력/소유권과 라이선스는 유지한다. 과거 checkpoint/handoff·receipt·복구 archive는 삭제했으며 재개 조건으로 요구하거나 복구·재생성하지 않는다.

**종료일: 2026-10-18 KST. 상태: CLOSED / SUPERSEDED BY W11.** 남은 W10-02~12 요구와 디자인 패키지 일괄 처리 계획은 [work11.md](work11.md)로 전부 이관했다. W10-00·01의 완료 이력과 아래 구현·검증 기록은 보존한다. **계획 종료이며 제품 전체 완료가 아니다.** 제품은 계속 PARTIAL이고 새 계획의 실행은 PAUSED다.

이 문서의 실행 지침·다음 작업·재개 조건·미완료 체크는 종료 시점의 역사적 기록이다. 현재 계획과 재개 기준은 [work12.md](work12.md)이며 실행은 PAUSED다. 이관 당시 대응은 W11 §1~2의 이력으로 남기고 삭제한 progress/checkpoint/이관 기록을 복구하도록 요구하지 않는다.

**종료 전 상태(이력):** 작성일 **2026-10-16 KST**, 방향 변경·중간 마무리 **2026-10-18 KST**. 당시 **PAUSED / PARTIAL**, **W10-00·01 완료 / W10-02 PARTIAL**이었다. 아래 정책은 W11에 승계했으며 이후 실행은 W11을 따른다.

목표는 [work9.md](work9.md)에서 승계한 필수 기능을 **Nelyx TypeScript 구현과 기능 동등성 검증**으로 완성하는 것이다. Flutter Dart는 동작·API·경계 조건의 참고 자료이며, **Cupertino/Material 두 디자인 패키지는 일괄 변환의 우선 입력**으로도 사용한다(§0.2·§5.1~5.3). 남은 Dart 전체 본문 컴파일이나 전이 의존성 폐쇄를 제품 구현의 선행 조건으로 두지 않는다. 이미 통합·검증한 생성 코드와 변환기 캐시는 재사용한다.

**종료 시 정책 이력:** 당시 실행 지침은 §0~7·§9.2였으며 현재는 W11로 대체했다. §8~8.119 및 §9.1은 당시 구현·검증의 이력이다. 그 안의 “다음 작업”, source-first·전체 closure·compiler blocker 우선 지시는 종료 전 기능 동등성 정책으로 대체했던 이력이다. §8.120~121은 중간 마무리·디자인 패키지 정책 변경 이력이다. 과거 receipt의 PASS/BLOCKED 범위와 원본 비교 결과는 그대로 보존한다. W9→W10에서 승계한 미완료 기능 요구도 W11에 계속 남는다.

**용어:** ‘검증 완료’와 ‘완료 기준 충족’은 기술적 판정이다. 계획 수정만으로 미구현 항목을 완료 처리하지 않는다.

## 0. 사용자 결정과 바로 다음 작업

2026-10-18 요청: “이쯤에서 중간 마무리하고, 남은 작업을 수정할께, 남은 dart소스를 무조건 컴파일할수있게 하기보단 nelyx 타입스크립트 자체구현으로 기능상으로 동등하게 구성하도록 할께”.

| 항목 | 현재 실행 기준 |
| --- | --- |
| 구현 기본값 | 기존 Nelyx Widget/Element/State/RenderObject·scheduler·services·package를 활용. 두 디자인 패키지는 §0.2의 일괄 변환·보정 우선 경로 적용 |
| Flutter 활용 | 동작·공개 API·오류/수명/복원 경계의 참고 및 디자인 family 일괄 변환 입력. 제약이 있는 family는 Doroti C# 경로와 비교 |
| 다음 기능 | 두 디자인 패키지 전체 inventory·공통 API mapping → 의존성별 family 일괄 후보·보정 → CupertinoApp/MaterialApp·theme/localizations/Hero·공개 기본 경로 통합. 잔여 scroll·편집·복원도 계속 승계 |
| compiler 범위 | 기존 생성 경로의 회귀·캐시를 유지. 신규 Dart 문법/전체 hierarchy 생성/SDK closure 확장은 선택 도구 backlog |
| 완료 판단 | 선정 기능의 실제 제품 소비·공개 타입·사용자 흐름·소유권/수명·필요 플랫폼/공급 검증 |
| 재개 조건 | 사용자의 다음 작업 요청 후 checkpoint·diff·입력/receipt hash부터 확인. 현재 자동 장기 실행 없음 |

### 0.1 기능 동등성의 의미

1. 기능별로 공개 API, 입력과 상태 전이, layout/paint/hit/clip, focus/selection/편집, 오류·취소·복원·종료의 관찰 가능한 계약을 먼저 정한다. 내부 클래스 구조나 private helper를 Flutter와 동일하게 만들 의무는 없다.
2. 기존 Nelyx 기능·호환 API·단일 Core identity·자원 소유권을 보존한다. 기능 요구를 줄이거나 빈 구현·`any`·가짜 기본값으로 검사를 통과시키지 않는다.
3. Flutter와 의도적으로 다른 API/동작은 이유·영향·검증 계약을 명시한다. 실제 기능 결함과 누락은 계속 미완료로 기록한다.
4. 생성 코드를 유지하는 부분에는 기존 원본 의미·출처·수치 provenance·recipe 검증을 적용한다. 자체 구현에는 제품 계약을 적용하며 원본 본문을 변환했다고 표시하지 않는다.
5. 기존 완료 증거는 동일 입력·도구·환경·artifact 범위에서 재사용한다. 내부 구현 방식을 바꿨다는 이유만으로 이전 전체 범위를 재작성하지 않는다.

### 0.2 Cupertino/Material은 일괄 처리 우선 — 2026-10-18 추가 결정

사용자는 `packages/cupertino`·`packages/material`을 최대한 일괄 처리하고 **일괄 변환 후 수정도 허용**했다. Flutter Dart 변환에 제약이 없는 묶음은 기존 변환기/캐시로 처리하며, 제약이 있는 묶음은 `C:\Users\parti\Labo\DorotiLab\packages\Doroti.Cupertino`·`Doroti.Material`의 C# 포트를 변환·가져오는 경로와 비교한다.

두 패키지 전체를 한 번에 검토 범위로 잡고, 실행·검증·승격은 **기능 family와 공통 의존성 묶음**으로 진행한다. 위젯마다 처음부터 수동 구현하거나 하나의 unsupported 선언 때문에 독립 묶음까지 중단하지 않는다. 소스 선택 순서는 **가능한 Flutter Dart 일괄 변환 → 막힌 family의 Doroti C# 변환 가능성·보정 비용 비교 → 필요한 Nelyx TypeScript 자체 구현**이다. Dart 제약이 있다고 C# 자동 변환이 가능하다고 가정하지 않는다.

이 결정은 기능 동등성 목표를 유지하면서 두 디자인 패키지의 처리 방식을 구체화한다. 전체 Dart/SDK/Core hierarchy 컴파일이나 범용 C# 변환기 완성을 새 선행 목표로 만들지 않는다. 이번 요청은 **검토·계획 반영**이며 실제 변환·제품 코드 수정·구현 재개는 수행하지 않았다. 비교 근거와 실행 묶음은 §5.1~5.3 및 소스 검토 기록 (보관된 과거 기록 `w10-design-package-source-review.json`)에 있다.

## 1. 중간 마무리 시점의 상태와 재사용 기반

### 1.1 현재 확인 범위

| 항목 | 상태와 해석 |
| --- | --- |
| 최신 구현·검증 | §8.119 const Set·generic 상수 및 영향 회귀. 등록 26개 fixture fresh 실행, IR181·출력39 byte 동일 |
| 현재 기반 | wheel19·2D21·tree18/public7·typedef4·Viewer16·Scrollbar family43·behavior/stretch10의 통합 및 각 scoped 검증 이력 |
| 캐시 | 내용 기반 Dart IR/TypeScript base·파일 AST 캐시와 실제 compiler bytes identity 검증 완료. 기능 구현에 도움이 되는 경우 계속 사용 |
| 제품 보존 | owning source605·promoted state26·sample/runner5를 중간 마무리 기준으로 보존. 이번 변경은 계획·handoff·checkpoint만 수정 |
| 입력·증거 | 변경 전 입력619·immutable receipt12914 및 기존 checkpoint 연결 검증 완료. 최신 개수·hash는 현재 progress/checkpoint 참조 |
| Dart 도구 잔여 | recursive IR1826·unsupported45·위치6·SDK261/기타17 및 route emission의 NavigatorState binding BLOCKED는 과거 변환 경로의 한계. 제품 기능의 선행 blocker에서 분리 |
| 실제 공급 | §8.95 archive의 Windows/Android48·각 cold3프로세스/7흐름·Android EditText는 해당 archive의 PASS-scoped. §8.119 Core3 변경 후 최신 native source parity는 **notVerified** |
| 전체 상태 | CupertinoApp 제품 연결·잔여 기능/API·플랫폼/개발/접근성/임베딩·물리 IME/caret/FPS는 미완료. 전체 W10은 **PARTIAL** |

최신 progress (보관된 과거 기록 `w10-progress.json`) → handoff (당시 기록, 긴급 정리로 삭제됨) → checkpoint (보관된 과거 기록 `w10-active-checkpoint.json`)를 재개 기준으로 사용한다. 이전 Windows hang·DOM bounds FAIL 같은 과거 상태는 최신 해당 receipt와 대조하고 현재 실패로 복사하지 않는다.

### 1.2 변환기와 기존 생성물의 역할

[body_ir.dart](tools/Nelyx.FrameworkToTypeScript/dart/bin/body_ir.dart) → [body-ir.ts](tools/Nelyx.FrameworkToTypeScript/src/body-ir.ts) → [dart-emitter.ts](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts) → [batch.ts](tools/Nelyx.FrameworkToTypeScript/src/batch.ts)의 도구·캐시·recipe26은 유지한다. `resume all`은 등록 recipe의 생성·검증 도구이며 W10 전체 기능의 완료 명령이 아니다.

Const Set spread/if/null-aware·추가 pattern/loop/global/member 문법, extension-type·getter/setter owner 탐색, 전체 NavigatorState hierarchy 생성과 SDK closure는 **선택 compiler backlog**다. 실제 제품 결함을 해결하는 데 필요하거나 별도로 요청될 때 수행한다. 기존 recipe의 필수 검증·fail-closed merge/promote·숫자 provenance는 계속 지킨다. Dart SDK·생성기·scratch를 제품 build/runtime 의존성으로 만들지 않는다.

## 2. 기능 파트와 구현 소유권

파트는 사용자에게 의미 있는 기능/API 묶음과 필요한 Nelyx 의존성으로 정한다. `기능 / 공개 API·소비 경로 / 기존 구현·누락 / Flutter 참고 / 수명·오류 경계 / 검증 / 남은 조건`을 한 묶음에 기록한다. 전수 Dart inventory나 클래스 수를 제품 완료율로 사용하지 않는다.

| 구분 | 처리 |
| --- | --- |
| 기존 자체 구현 | 기존 identity·타입·호환·수명을 활용하고 필요한 동작을 직접 보완 |
| 기존 생성 구현 | 검증된 본문·adapter·recipe·출처를 재사용. 재생성이 필요하면 기존 3-way compose와 충돌 보존 적용 |
| 자체 구현으로 전환 | generated/base를 거짓으로 갱신하지 않음. 소유권·recipe 소비 경로·출처를 명시적으로 정리해 재생성 덮어쓰기 방지 |
| host 경계 | DOM/OS/Skia·IME·clipboard/menu·accessibility·앱/View 종료를 명시적 adapter로 연결 |
| 참고한 원본 | 사용·수정·복사한 코드/데이터/asset의 pin/hash/license/notice 기록. 자체 작성 코드에 허위 Dart span/provenance를 붙이지 않음 |

기존 Dart-derived 타입의 `@dartType`·`@dartParam`·`@dartReturn` 및 공개 `.d.ts` 숫자 의미는 보존한다. 새 TypeScript API는 실제 요구에 맞는 구체 타입을 사용한다. Widget/State/Key·runtime type identity를 중복 생성하지 않는다.

## 3. 모든 파트의 실행 절차

1. checkpoint·diff·관련 입력/receipt를 확인하고 기존 Nelyx API·소비 경로에서 실제 누락을 찾는다. 유효한 검증 완료 범위를 보존한다.
2. 기능 동등성 계약과 필수 경계 사례를 정한다. 두 디자인 패키지는 §5.1~5.3에 따라 전체 inventory를 재사용하고 family별 일괄 후보를 만든다. 다른 파트의 Flutter 참고·추출 범위는 실제 기능 요구로 정한다.
3. 선택한 소스의 일괄 변환·보정 또는 Nelyx TypeScript 자체 구현으로 실제 Core/SDK/디자인·공개 기본 경로에 연결한다. 생성 코드가 연관되면 §2의 소유권을 먼저 명확히 한다.
4. 영향 타입/빌드와 사용자 동작·오류/수명·복원 사례를 검증한다. 필요한 browser/외부 consumer/native 공급은 해당 후보와 같은 source/artifact로 확인한다.
5. 기능·검증·출처·차이·남은 조건을 progress와 checklist에 기록한다. 독립 파트는 다른 compiler backlog 때문에 중단하지 않는다.

임시 파일이나 컴파일 성공만으로 통합 완료를 표시하지 않는다. `생성됨 / 컴파일됨 / 통합됨 / 완료 기준 충족`과 `PASS / PARTIAL / FAIL / SKIPPED / notVerified`를 구분한다. 기존 `archived record: work8` 경로·recipe/state/schema를 계획 방향 변경만으로 대규모 이전하지 않는다.

## 4. 승계한 전체 범위와 단계 종료 조건

W10-00·01의 완료 이력은 유지한다. W10-02~12는 기능 동등성 구현과 제품 검증으로 진행한다. 공통 기반은 소비 기능에 필요한 순서로 보완하며 전체 기반 완성을 기다리지 않는다.

| 단계 | 남은 범위와 종료 조건 | W9 대응 |
| --- | --- | --- |
| **W10-00 완료 이력** | 중단 입력·diff·pin·첫 파트/경계/검증 묶음 확정 | 00·§9.40 |
| **W10-01 완료 이력** | 첫 wheel/viewport19 생성·통합·검증·재생성/수정/충돌 보존. 이후 기능의 compiler 확장을 의무로 만들지 않음 | 02 |
| **W10-02 scroll·viewport·변환** | 기존 wheel/2D/tree/Viewer/Scrollbar/behavior 활용. 추가 animated API, Page/Nested/header/refresh/reorder/dismiss/sheet 복원·mixed sliver·first seek·keyed State/selection, 입력·resize·mutation·restore·close와 영향 공급/성능 | 04 |
| **W10-03 공통 runtime·paint·text·입력** | service/worker 초기화·stop·cache/retirement, wide-gamut/output·bitmap·font/typography·pointer/animation API. 공통 Nelyx 구현과 backend의 오류/복구/drain·수명·출력/입력 검증 | 03 |
| **W10-04 편집·Form·입력** | grapheme/formatter·style/API·undo/autofill·toolbar/selection·multi-View/provider·OS touch/menu/keyboard/caret. 여러 필드·조합·scroll·복원·해제·실제 IME 검증 | 01·04 |
| **W10-05 앱 흐름·복원** | app/navigator/router/routes·overlay/Hero·async·locale resolution. OS link→nested Form/list/dialog→Back→locale→process recreation·복원·종료/drain | 05 |
| **W10-06 디자인·locale** | Cupertino/Material 전체 inventory 후 theme·control/form·복합/adaptive family를 일괄 변환·보정. Flutter 우선, 제약 family는 Doroti C# 경로와 비교. 전체 지원 locale·RTL·data/asset/icon/font/notice·선정 API·독립 package/consumer 검증 | 06 |
| **W10-07 플랫폼 runtime/tooling 분리** | 여섯 host/tool·SDK/CLI/Metro·provider·runner/template·native/Skia/texture·배포. Core 단일 identity·선택 설치/로드·역의존 제거·여섯 target 구성/공급·필수 3환경 수명 | 07 |
| **W10-08 개발 갱신·inspector** | Nelyx hot reload/reassemble·diagnostics/inspector·source map/preview/service extension. 최종 package의 실제 수정·State 유지·reload/remount·cleanup | 08 |
| **W10-09 우선 실제 환경·감사·공급** | Windows/Android/Web 입력·IME·성능/FPS·resize·hidden/resume·GPU loss·복구/종료. package/version/lock/archive·외부 소비·signing/clean-machine·출처/notice·재현 | 09·10 |
| **W10-10 후속 A 접근성** | 설정→View/MediaData·semantics tree/ack/action·metadata·실패 owner 회복·reader와 Apple/Linux producer 코드. 기존 scoped 검증 보존 | 03·05 후속 |
| **W10-11 후속 B native/HTML view** | 생성·부착·배치·합성·clip/transform/z-order·focus/input·해제/복구. route/scroll/overlay/reload 결합 검증 | 07 후속 |
| **W10-12 전체 통합·정리** | 후속 영향 회귀·실제 환경·최종 공급·출처/consumer/배포 감사·재현 입력·문서/정리 및 §7 전체 완료 조건 | 09·10 전체 |

접근성·임베딩은 후속 범위로 유지한다. 공유 계약에 필요한 접점은 먼저 보존하되, 일반 편집/IME·keyboard/menu·앱/View 수명을 후속 전체로 미루지 않는다.

## 5. 재개 후 기능별 우선순위

| 순서 | 구현·확인할 기능 | 기능 검증 기준 |
| --- | --- | --- |
| 1 | **Cupertino/Material 일괄 처리와 앱 연결**: §5.1~5.3의 전체 inventory·공통 mapping·family 후보/보정부터 진행. 현재 navigator/router/overlay·theme/localizations·Hero·button/inspector의 누락을 연결하고 W10-05/06/08에 귀속 | family별 실제 제품 소비·공개 타입·theme/input/State/수명 및 공개/default App·push/pop/Back/dialog·locale·복원/종료. 전체 Dart NavigatorState 생성 선행 없음 |
| 2 | **잔여 scroll 통합**: 추가 animation·Page/Nested/header/refresh/reorder/dismiss/sheet·mixed sliver·first seek·keyed selection/복원 | mutation/resize/input·동일 State/editor·offset/key 복원·active 종료와 영향 browser/native/packed 소비 |
| 3 | **runtime·편집·디자인/locale 완성**: §4의 W10-03/04/06에서 실제 누락된 API/동작과 수명 경계 보완 | 구체 제품 계약·오류/취소·조합/undo/autofill·RTL/theme·필수 locale·독립 소비 |
| 4 | **플랫폼·개발·공급**: W10-07~09 및 변경된 Core3의 최신 source/archive/native parity 갱신 | 같은 후보·설치 bytes·실제 runtime/restore/close·성능/복구·reload/State·출처/배포 |
| 5 | **접근성·임베딩·최종 통합**: W10-10~12 | reader/action/ack·View 합성/입력/해제·후속 회귀와 전체 완료 판정 |

이 표는 재개 계획이며 새 기능의 구현 완료를 뜻하지 않는다. 사용자 수정 사항이 추가되면 기능 범위와 검증 계약을 먼저 반영한다.

### 5.1 디자인 패키지 소스·변환 경로 검토

Nelyx HEAD `49152f35c76c944387ff09a3ccb248692c1b020f`의 clean 상태, Flutter pin `71e4717a61786faab4c7aa39825989305ed29e8a`, Doroti HEAD `6778077f9f71ffd0d31652a51efca0163dcc348f`와 두 Doroti 패키지의 clean 상태에서 소스·도구·project 참조를 읽었다. **정적 검토와 파일/hash 목록**이며 새 전체 변환·C# build·Dart 분석·제품 실행 결과는 아니다. 아래 수에는 생성물·helper·GlobalUsings·animated icon 데이터가 포함되므로 API 충족률로 계산하지 않는다.

| 소스 | Cupertino | Material | 의미 |
| --- | --- | --- | --- |
| 현재 Nelyx `src/**/*.ts` | 20파일 / 2,629줄 | 21파일 / 2,977줄 | `widgets.ts`는 선정 composition이며 theme도 selection/scrollbar 중심의 부분 계약. 기존 generated family와 공개 API는 보존 |
| 고정 Flutter `lib/src/**/*.dart` | 52파일 / 48,205줄 | 198파일 / 210,532줄 | 일괄 검토의 우선 입력. private helper와 필요한 의존성을 family에 포함 |
| Doroti `src/**/*.cs` | 52파일 / 44,954줄 | 202파일 / 184,852줄 | Flutter 기반 C# 포트. 별도 runtime/helper·GlobalUsings 포함, upstream 동기화·동작 동등성은 별도 확인 |

| 경로 | 확인한 장점 | 현재 제약과 판단 |
| --- | --- | --- |
| **Flutter Dart → TS** | 기존 resolved IR·body emitter·batch compose/validate/promote·내용/AST 캐시·출처/숫자 주석·recipe26 검증 체계 사용 가능 | §8.119 navigation 재귀 결과의 unsupported45·위치6·NavigatorState binding 한계가 존재. 이 수를 두 디자인 패키지 전체의 진단 수로 확대하지 않음. family의 실제 생성/타입/동작 통과 여부로 선택하며 전체 무제약 변환은 미검증 |
| **Doroti C# → TS** | app/button/theme·Material family 등 이미 포트한 구현과 host 접점·수정 내용을 참고·변환 가능 | 현재 [SourceReader](tools/Nelyx.FrameworkToTypeScript/roslyn/Program.cs)는 단일 syntax tree와 .NET 기본 참조만 사용. project 참조·GlobalUsings·partial type 전체 해석이 없음. [lower.ts](tools/Nelyx.FrameworkToTypeScript/src/lower.ts)는 상속/generic class, nullable/generic type·named/ref 인자·virtual/override·setter·대부분 문장을 거부. 현재 도구로 두 패키지 무제약 일괄 변환은 불가 |
| **Nelyx TS 보완/자체 구현** | 기존 Core·공개 API·수명·제품 요구에 맞춰 막힌 기능을 닫을 수 있음 | 변환된 것처럼 출처를 표기하거나 축소된 placeholder로 동등성을 주장하지 않음. 일괄 후보를 우선 활용하고 필요한 묶음만 직접 보완 |

Doroti `CupertinoButton : StatefulWidget`, `CupertinoApp`의 generic callback/State/DartMap, `ButtonStyleButton`의 abstract·stateful·runtime conversion은 현재 C# lowerer의 실제 거부 조건과 겹친다. 따라서 **Dart가 막히면 Doroti가 즉시 자동 해결한다는 결론은 내리지 않는다.** 막힌 family마다 frontend/lowering·Core binding·동작/API 차이·보정/검증 비용을 비교해 소스를 고른다. C# 경로를 선택할 때는 필요한 project/partial/global-using 해석과 규칙을 먼저 대표 family로 검증한다.

추가 경계도 함께 처리한다. Doroti Material은 Cupertino·별도 icon 패키지·`MaterialColorUtilities`·`ink_sparkle.sksl`에 의존한다. 이를 .NET dependency 그대로 가져오지 않고 Nelyx의 단일 Core와 TS/asset 공급에 대응시킨다. Doroti README는 최신 Flutter 동기화를 주장하지 않으며 기본 localization delegate는 영어다. 원본 변환 comment의 `reference/flutter-master` 경로는 현재 Doroti checkout에 없어 upstream pin을 그 경로만으로 확정할 수 없다. Doroti HEAD/bytes를 고정하고 선택 기능을 Flutter pin의 API/동작과 대조한다. 전체 locale·icon/font·shader/license/notice 요구는 별도로 닫는다.

### 5.2 최대한 일괄 처리할 실행 묶음

| 묶음 | 범위 | 실행 방식 |
| --- | --- | --- |
| **DESIGN-0 전체 계획·mapping** | 두 패키지 전체 소스/API 목록, 기존 generated/adopted 구분, Core·package·private identity·공통 dependency/SCC | inventory는 한 번 만들고 재사용. 기존 scrollbars/behavior/dynamic-color·selection의 검증된 경로 보존, source 선택/소유권·destination/export 누락 기록 |
| **DESIGN-1 디자인 기반** | constants/colors·theme/color scheme·text theme/typography, locale/icon/font/asset 의존성 | 양 패키지 공통 값/타입/기본값·M2/M3·Cupertino dynamic/high-contrast/brightness 경계를 묶어 후보 생성·보정 |
| **DESIGN-2 기본 컨트롤** | button/ink/focus/state property·activity/progress·checkbox/radio/switch/slider/chip 및 관련 theme | public Widget·State·private helper·animation/gesture 의존성을 같이 처리. 단일 Core identity와 hover/press/focus/disabled·수명 검증 |
| **DESIGN-3 복합 family** | list/form/text-field/selection·menu/context-menu/tooltip·dialog/sheet·picker/date/time | 실제 dependency component별 일괄 출력·보정. 독립 component는 다른 blocker 때문에 기다리지 않음. 편집/overlay·scroll·locale/RTL·복원·해제 검증 |
| **DESIGN-4 App·공개/공급** | CupertinoApp/MaterialApp·scaffold/bar/tab/navigation/route/Hero/adaptive, exports·독립 consumer·locale/asset/notice | W10-05/08과 공통 navigator/inspector 연결. App에 필요한 mapping은 앞선 묶음에도 공급. theme/locale·push/pop/Back·State/restore/close와 영향 browser/native/package 검증 |

이 묶음은 최초 순서이며 실제 의존성에 따라 함께 처리한다. 모든 family를 끝내야만 App을 연결하는 직렬 장벽을 만들지 않는다. Material↔Cupertino theme/adaptive 접점과 Core 선행 기능은 한 번 mapping하고 소비 묶음이 재사용한다. 파일 수와 검증 반복 횟수는 별개이며 클래스마다 전체 build/browser/native를 반복하지 않는다.

### 5.3 소스 선택·보정·검증 절차와 남은 체크

1. DESIGN-0에서 두 패키지 전체를 계획하고 family별 대상 본문/private helper·필수 Core binding·공개 API/동작 계약을 고정한다. 기존 제품 코드를 바로 덮어쓰지 않는다.
2. Flutter 경로로 가능한 family 전체를 scratch에 일괄 생성하고 공통 실패를 한 번에 수집한다. 한 모듈 내 미지원 본문은 명시적으로 막고, 독립 모듈은 계속한다. 일괄 변환 후 수동 보정도 허용하며 변경 소유권을 기록한다.
3. 치명적인 Dart 제약이 있는 family만 대응 Doroti C# 포트와 비교한다. C# 경로의 project/partial/참조 해석, 필요한 언어 규칙·runtime 의미·타입/숫자 provenance·원본/API 차이와 보정량을 작은 대표 묶음에서 확인한다. 현재 C# draft 명령은 Dart batch의 IR/cache/compose/promote 체계와 다르므로 동일한 재생성·수정/충돌 보존·출처/검증 연결까지 확인한 뒤 확대한다.
4. 더 적은 보정으로 기능 동등성을 충족하는 경로를 family 단위로 고른다. 어느 쪽도 실용적이지 않으면 그 묶음을 Nelyx TS로 구현한다. 한 클래스의 두 State·Theme·Core identity를 혼합하거나 모든 Dart/C# 문법 지원을 위해 제품 작업을 장기 중단하지 않는다.
5. generated base/effective/product의 3-way 보존 또는 명시적 adopted 전환, 정확한 Core·imports/exports·public `.d.ts`·숫자 출처, 실제 Widget/State 동작·theme/locale/RTL·입력/focus/selection·animation·복원/해제를 family별 검증한다. borrowed code/data/asset의 양쪽 출처·pin/hash/license/notice를 연결한다. 필요한 packed/browser/native 공급은 묶음 경계에서 수행한다.

- [x] **소스 경로 검토·계획 반영:** 두 패키지의 Dart/C#/TS 목록·도구 제약·Doroti runtime/asset/locale 차이 확인. 실제 변환 가능성은 정적 근거 범위로 한정.
- [ ] **DESIGN-0:** 전체 공개 API/선정 기능·dependency mapping과 family별 소스 선택 확정. 현재 파일 inventory를 재사용하되 선언/동작 범위는 착수 시 확인.
- [ ] **DESIGN-1~4:** family별 일괄 후보 생성·필요 보정·기능 검증·공개 기본 소비·공급. Doroti 경로는 선택한 family의 probe를 통과한 경우에만 사용.
- [ ] **W10-06 종료:** 전체 선정 디자인 API·지원 locale/data/icon/font/asset·독립 소비·기능/플랫폼 요구 충족. 이번 계획 반영으로 완료 처리하지 않음.

## 6. 검증·빌드·기록 비용 제한

| 변경 | 필요한 검증 |
| --- | --- |
| 자체 TypeScript 기능 | 영향 package/dependent 타입·빌드, 독립 기대값에 따른 API/Root·사용자 흐름·수명/오류 경계, 필요한 실제 backend |
| 기존 생성기/생성물 | 변경된 의미를 소비하는 원본 비교·배치 회귀·결정적 재생성·숫자 주석·충돌 보존. 기존 recipe의 필수 gate 유지 |
| 공급/구조 전환 | 같은 source/artifact의 archive·외부 consumer·복사 EXE/APK 실행/복원/종료. 여섯 target 공급 구성은 구조 전환·최종 후보에서 확인 |
| 문서/체크포인트 | 입력·receipt·control 연결 hash·dirty 보존·소유 작업/임시 설정 정리. runtime 전체 재실행 없음 |

같은 입력·도구·환경·artifact의 유효 결과를 재사용한다. controlled receiver·Core/browser·native archive·물리 장비 관측을 구분한다. synthetic composition은 물리 IME를, CPU Root 성능값은 native FPS를 대체하지 않는다. 동작을 구현에서 그대로 복사한 기대값으로 검사하지 않는다.

[.github/copilot-instructions.md](.github/copilot-instructions.md)에 따라 **테스트 timeout은 20분(1,200초)**이며 `run-check.mjs` wrapper를 사용한다. 대부분의 반복 검증은 30회 이내로 제한한다. 동일 checkout Dart 분석이 필요한 경우 직렬 실행한다. 문서만 바뀐 이번 중간 마무리에서는 제품 테스트를 재실행하지 않는다.

파트당 한 묶음에 기능/API·소비 경로·변경 입력·유효 증거·출처/차이·남은 검증·다음 작업을 남긴다. 기존 immutable receipt는 수정하지 않으며 과거 source blocker를 현재 제품 blocker와 구분한다.

## 7. 완료 기준과 플랫폼 경계

**파트 완료:** 선정 기능과 공개 타입/API가 실제 제품에서 실행되고, 입력·상태/layout·오류/복원·자원 수명·필요 성능·영향 플랫폼/공급의 계약을 충족해야 한다. 자체 TypeScript 구현으로 이 조건을 충족할 수 있다. 기존 생성 코드를 사용하는 부분의 source 의미·출처·숫자 주석·ownership 검증은 유지한다.

**우선 범위 완료:** W10-00~09의 필수 기능·실제 환경·감사·공급을 닫은 뒤 `우선 범위 완료 / 전체 PARTIAL`로 기록한다. W10-10·11은 미완료로 남는다.

**전체 완료:** W10-12에서 승계한 필수 기능/API·locale·플랫폼/개발·성능/안정성·출처/배포·접근성/임베딩에 미구현·FAIL·필수 notVerified가 없는지 판정한다. Dart 전체 컴파일·IR 수·원본 내부 hierarchy/전이 closure 폐쇄는 완료 조건이 아니다. 사용자에게 약속한 기능을 축소하거나 검증 없이 동등성을 주장하지 않는다.

Windows/Android/Web은 필수 실제 환경 검증 대상이다. **iOS/macOS/Linux 전용 native build/run·물리 입력·서명·전용 harness는 기존 사용자 결정의 `SKIPPED`, provider는 `notVerified`를 유지**한다. 여섯 target 공통 TS·코드·package/runner/template·공급 구성 의무는 유지한다. §8.119 변경 후 최신 native parity, 물리 IME/caret/FPS·Windows native 편집기 픽셀·hardware GPU 등은 아직 미검증이며 과거 archive 결과로 대체하지 않는다.

---

다음 §8~8.119는 당시 작업 이력이다. 현재 정책과 중간 마무리는 §0~7·§8.120~121·§9.2를 따른다.


## 8. 상태 클래스·상속 compiler 확장 — 2026-10-16 KST

사용자의 추가 요청에 따라 변환기의 클래스 처리 구조와 기능을 수정했다. **W10-01의 기반 확장만 scoped 검증을 완료**했으며, 첫 wheel/viewport의 일괄 이식·product promote·W10-01 전체 완료를 뜻하지 않는다.

| 변경 | 구현한 범위 |
| --- | --- |
| 구조 분리 | [class-model.ts](tools/Nelyx.FrameworkToTypeScript/src/class-model.ts)에 generated 클래스 관계·부모 우선 출력·상속 멤버 해석·private library identity·생성 안전성 분석을 분리. batch tool fingerprint에도 포함 |
| 상태 클래스 IR | mutable/final 필드 구분·필드 선언 초기값·nullable 기본값·생성자 본문·implicit constructor·abstract 클래스/메서드·getter/setter를 표현. compound assignment는 analyzer의 write element/type 사용 |
| 상속과 호출 | 한 emission에 포함된 generated 클래스 간 generic/다단계 상속, 명시적 super 인자·super getter/setter/method, positional/named 호출과 평가 순서, super-formal 전달·상속된 scalar/null 기본값 |
| 의미 보존 | 필드/initializer/assert→super→생성자 본문 순서, final만 불변 보호, void/setter expression body 결과 폐기, 동일 library private 접근과 다른 library private 이름 분리 |
| 기존 host 경계 | 별도 모듈은 명시적 import/type binding과 exact super constructor 계약 유지. 초기화 중 derived 상태를 관측하는 generated base는 진단으로 차단하며 JS super로 잘못 통과시키지 않음 |

**검증 PASS:** 도구 TypeScript 검사, Dart analyzer, [state-classes.ts](tools/Nelyx.FrameworkToTypeScript/checks/state-classes.ts)의 12개 클래스·strict consumer/선언·Dart 실행 비교(주 fixture debug/release), [numeric-provenance.ts](tools/Nelyx.FrameworkToTypeScript/checks/numeric-provenance.ts)의 18개 선언·숫자 주석/공개 `.d.ts`/런타임 경계, [class-regression.ts](tools/Nelyx.FrameworkToTypeScript/checks/class-regression.ts)의 기존 8 recipe 새 생성물·기존 Nelyx 및 원본 비교 fixture. 모든 테스트는 1,200초 제한 wrapper를 사용했다.

실제 고정 Flutter의 **abstract·mutable `Simulation`과 `GravitySimulation` 전체 선언을 함께 생성**하고, handwritten Simulation/super mapping 없이 연결·strict types·동작을 확인했다. 해당 원본 비교/제품 fixture는 scratch에서 실행했으며 제품 `.ts`·기존 배치 state/검증 완료 receipt를 승격하지 않았다. 생성기가 바뀌었으므로 기존 도구 fingerprint로 새 생성을 검증 완료로 판정하지 않는다.

현재 증거: `.tmp/work8/state-classes-63iqbV/result.json`, `.tmp/work8/numeric-provenance-3JLTKD/result.json`, `.tmp/work8/class-regression-G9VVi1/result.json`. 원본 입력과 generated hash·개별 fixture 결과는 각 디렉터리에 있다. 명령과 지원 경계는 [변환기 README](tools/Nelyx.FrameworkToTypeScript/README.md)에 기록했다.

**§8 당시 남은 제한(최신 상태는 §8.2):** mixin/implements, late/static state field, primary/redirecting/named generative state constructor, generic method·callback/async·미지원 control flow, non-scalar super 기본값, inherited accessor 한쪽만 override할 때의 forwarding, 생성자 인자가 필드 initializer의 외부 이름을 가리는 경우, base 생성 중 virtual dispatch/this 유출. 빈 구현·`any`로 통과시키지 않는다. 다음은 실제 wheel/viewport closure 초회 생성으로 필요한 제한을 선별해 해소하고 compose/통합을 검증하는 것이다.

## 8.1 W10-00~02 현재 실행 — 2026-10-16 KST

이 절은 첫 통합 시점의 이력이다. 이후 controller 통합·현재 native 공급 결과는 §8.3을 따른다.

**W10-00은 완료, W10-01·02는 PARTIAL이다.** 전체 wheel viewport·2D/tree/viewer 본문이나 native 검증 완료를 physics 부분 검증 완료로 대체하지 않는다. 현재 기록은 w10-progress.json (보관된 과거 기록 `w10-progress.json`), 활성 handoff는 handoff.json (당시 기록, 긴급 정리로 삭제됨)이다. W9 중단점/검증 완료 receipt는 역사적 입력으로 보존했다.

### 승계와 첫 파트

착수 HEAD `520e84bb92ee35519d0e2bb56149d9d8b8df6952`, 작업 트리는 clean이었다. W9 중단점의 제품 7개·check 7개 SHA-256과 Flutter HEAD `71e4717a61786faab4c7aa39825989305ed29e8a`를 확인했다. wheel/viewport part (보관된 과거 기록 `w10-wheel-viewport.json`)에 두 원본 library의 전체 클래스와 private offset helper 19개, 원본 hash·목적지·기존 framework/render/scroll/physics 경계·필요 언어 규칙·검증 명령을 연결했다. 기존 facade는 최초 adopted 입력으로 기록하고 원본 generated base가 있는 것으로 가장하지 않았다. source 내부 의존성은 함께 선택하고 기존 Widget/State/RenderObject·ScrollPosition/Simulation identity에서 SCC 경계를 끊는다. `ContainerRenderObjectMixin`의 compiler 적용과 남은 member binding은 아직 미완료다.

실제 초회 추출에서 상대 output 경로의 sky_engine package URI와 Windows embedder 경로 문제를 확인·수정했다. [part-generation.mjs](tools/Nelyx.FrameworkToTypeScript/checks/part-generation.mjs)는 전체 선택을 hash/pin 확인 후 한 번에 분석하고, 실패한 선언을 포함한 진단을 scratch에 남긴다. 최신 결과는 **19개 중 IR 추출 10개 / blocked 9개**이며, IR 추출은 TypeScript 생성·타입검사 통과를 의미하지 않는다. blocked 모듈의 빈/부분 구현을 제품에 쓰지 않는다. dependency inventory는 기존 입력을 재사용하여 새 recipe만 연결했다.

### 실제 원본 생성과 제품 소비

[wheel physics recipe](tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/w10-wheel-physics.json)는 고정 원본의 **`FixedExtentScrollPhysics` 전체 클래스와 `_getItemFromOffset`·`_clipOffsetToScrollableRange` 전체 본문**을 생성한다. [생성물](Nelyx/src/framework/widgets/list-wheel-physics.generated.ts)은 실제 공개 [wheel facade](Nelyx/src/framework/widgets/list-wheel-scroll-view.ts)의 부모로 소비된다. 임시·미사용 생성물이 아니다. source/목적지/span/license·numeric 주석·tool/dependency fingerprint와 compose/promote는 기존 batch state에 기록했다.

공통 compiler에는 adjacent string, exact runtime predicate/checked cast에 연결된 `is`/`is!`/`as`, null-aware target method 호출과 `??`, named top-level 함수 인자·호출 순서, positional+trailing named adapter, explicit inherited host property binding, resolved numeric `sign`을 추가했다. cast를 TS type assertion으로 지우지 않으며 nullable/generic runtime type과 다른 null-aware call 형태는 여전히 진단한다. [adapter](Nelyx/src/framework/widgets/list-wheel-physics-adapter.ts)는 실제 ScrollPosition identity 확인과 Spring constructor 인자 모양만 연결한다. 원본의 다섯 ballistic 분기·spring/friction 선택·private helper를 다시 작성하지 않았다.

기존 itemExtent/single-owner controller, display-only wheel item, NeverScrollable parent 정책은 facade에 유지했다. **원본 spring/friction은 tolerance 이내에서 종료**하므로 pointer ballistic 검사는 0px 오차 대신 실제 `toleranceFor(position).distance`로 판정하고 최대 24회 virtual frame으로 friction→spring 전환을 기다린다. 명시적 item jump/animate와 tap 검사의 정확한 좌표 기대는 유지했다.

`requireSourceComparison`이 설정된 이 recipe는 제품 검증이 PASS여도 원본 비교가 FAIL이면 승격하지 않는다. 기존 W9 recipe의 독립 Nelyx 계약 정책은 변경하지 않았다. 실제 recipe에서 결정적 재생성, 사용자 주석 보존, 겹치는 rename 충돌 시 원문 보존, source 비교 실패 시 promote 차단을 확인했다. 검증 중 임시 수정과 patch는 원복했다.

### viewer 편집 host 보정

실패 원인은 **잘린 semantics bounds를 편집 컨트롤 전체 layout 크기로 사용하고 18px font를 고정한 host 경계**였다. semantics의 visible bounds는 유지하면서 positive uniform `editorGeometry`의 full bounds/scale을 별도로 계산·검증·동결한다. DOM은 기존 input의 local layout을 유지하고 CSS scale과 clip-path로 glyph·caret·decoration을 함께 변환한다. RN은 stable clip/scale 부모와 같은 TextInput key로 같은 좌표 계약을 연결했다. 이는 일반 편집기의 host adapter 수정이며 viewer source 전체 이식이나 후속 임베딩 전체 검증 완료는 아니다.

실제 Chromium에서 180×48 → 360×96, 시각적 글꼴 18→36px, 0.5배 9px, 오른쪽 clip 밖 pointer 차단, 원상 복귀, 동일 Core/DOM identity·부모·focus·composition 및 `한😀` commit을 확인했다. tree expansion·2D keyed field mutation/retirement와 wheel direct seek도 같은 browser 묶음에서 통과했다. RN의 Windows/Android 분기는 **실제 compiled overlay 함수 + controlled React/native receiver**로 full/clip/scale 원점·stable key를 검사했으며 실제 EXE/APK 실행·native caret/IME/pixel 증거가 아니다.

### 검증과 미완료

- PASS: Core/SDK 영향 package build, compiler TypeScript 검사·Dart analyzer, 기존 8개+신규 1개 recipe의 scratch 생성·strict type·제품/원본 비교, 새 언어 규칙의 독립 Dart debug/release 비교, numeric provenance.
- PASS: 새 physics recipe의 제품 gate·원본 9개 시나리오×debug/release·재생성/merge/필수 source gate. 원본 비교의 base/metrics/simulation receiver는 controlled이고 실제 Spring/Friction 동작은 별도 제품 gate다.
- PASS-scoped: 현재 dist로 wheel 10·tree 11·2D 12·viewer 12·custom scrollbar 5, 합계 **50 Core Root**; actual Chromium 4개 흐름; RN controlled geometry 2개 target; repository 밖 **4개 packed NodeNext/ESM consumer**의 advanced-scroll subpath 및 generated dependency·단일 core identity.
- **§8.1 당시 미완료(최신 상태는 §8.2):** 전체 wheel/viewport의 callback/function·async/Future/collection·implements/mixin·non-scalar super default·cascade 및 exact host API binding. source `RenderListWheelViewport` 전체 생성/연결과 2D/tree/viewer source 파트는 아직 검증 완료로 판정하지 않았다.
- **notVerified:** 이번 후보의 복사 Windows EXE·Android APK·실제 cold app restore/close, native editor transform/caret/IME/pixels·성능/FPS. 과거 W9 설치본으로 현재 변경을 검증 완료로 판정하지 않았다. 기존 iOS/macOS/Linux 전용 native SKIPPED/provider notVerified 정책을 유지한다.
- **W10-02 잔여:** Page/Nested/header/refresh/reorder/dismiss/sheet 복원·mixed sliver·first seek·keyed selection의 최종 source 통합 및 공급 묶음. 접근성/임베딩 후속을 재개하지 않았다.

모든 실행 check는 1,200초 wrapper를 사용했다. 실제 part 추출 약 22초, 새 recipe promote 약 27초, 9개 recipe 회귀 약 45초, 외부 packed consumer 약 72초였다. 이는 해당 로컬 후보의 실행 시간이며 전체 이식 처리량이나 native FPS 수치가 아니다. 상세 hash와 receipt 경로는 현재 progress에 모았다. 다음 작업은 blocked 9개를 공통 언어 규칙별로 해소하여 전체 wheel/viewport 후보를 만든 뒤 동일 검증 절차로 연결하는 것이다.

## 8.2 전체 요청의 compiler 후속 실행 — 2026-10-16 KST

이 절은 17/19 추출 시점의 이력이다. 남았던 frontend 차단과 native 검증의 최신 상태는 §8.3을 따른다.

**W10 전체는 여전히 PARTIAL이다.** 이번 구현은 첫 wheel/viewport 파트의 공통 compiler blocker를 줄였다. 전체 source widget/renderer 통합, W10-02~12 종료와 현재 Windows/Android 공급 검증은 완료하지 않았다. 제품을 미완성 생성물로 교체하지 않았다.

착수 HEAD `ee90ed7`, 작업 트리 clean과 w10-progress.json (보관된 과거 기록 `w10-progress.json`)의 입력 **25개 SHA-256 일치**를 확인했다. 고정 Flutter pin/선택 원본을 유지했으며, W9의 과거 pause 플래그를 현재 사용자 전체 실행 요청으로 해제했다. 과거 handoff/progress와 receipt는 hash 기반 이력으로 보존한다.

| 공통 규칙 | 구현·검증 범위 |
| --- | --- |
| callback | analyzer의 구조화된 non-generic function type, positional/optional/named 호출, closure의 mutable capture·lexical `this`, 반환 callback, nullable callback. 숫자를 포함하는 callback 타입의 출처 주석을 공개 `.d.ts`까지 보존 |
| cascade·null | 일반/nullable/nested cascade에서 수신자를 한 번 평가하고 section 순서·반환 identity 보존. null `!`는 release에서도 인자 평가 전에 실패. 단일 null-aware property 지원 |
| 상속·interface | `implements`를 생성/import 타입 계약으로 출력. interface-only 멤버를 거짓 superclass override로 표시하지 않음. required super formal은 optional 부모 기본값을 상속하지 않고, optional enum 기본값은 resolved constant identity로 연결 |
| control flow | while·unlabelled break/continue·scalar/enum constant switch. Dart의 nonempty case 암시 종료와 empty label 공유를 보존 |
| 정수 상태 | 명시적 safe-number 계약의 scalar 정수 인자 진입 검사와 nullable 처리. local/property/indexed `++/--`·`+=/-=/*=`의 수신자/index/getter/우변/setter 순서를 유지하고 범위 초과 시 쓰기 전에 실패. 전체 Dart int 동등성은 주장하지 않음 |
| 미지원 보호 | generic callback·instance method tear-off의 receiver/equality identity, 복합 null-shortening selector chain, indexed plain integer assignment의 range-checked setter, async/mixin 및 기타 미지원 의미는 진단으로 유지 |

**고정 원본 전체 재추출:** 19개 중 **IR 추출 17개 / blocked 2개**. 기존 10/9에서 callback·implements·enum default·cascade·switch 관련 앞단 차단을 해소했다. 남은 최초 오류는 `FixedExtentScrollController`의 async `Future.wait`/collection-for/cast와 `RenderListWheelViewport`의 mixin이다. **17개가 TypeScript 생성·타입검사·제품 연결을 통과했다는 뜻은 아니다.** exact host member/runtime type/collection binding, tear-off, source 전체 dependency closure와 제품 통합은 계속 필요하다.

**검증:** 모든 check는 1,200초 wrapper를 사용했다. 도구 TypeScript/Dart analyzer, [callback-cascade.ts](tools/Nelyx.FrameworkToTypeScript/checks/callback-cascade.ts)의 독립 Dart debug/release·strict 공개 선언·미지원 거부, [integer-state.ts](tools/Nelyx.FrameworkToTypeScript/checks/integer-state.ts)의 Dart 비교·안전 정수 실패/쓰기 순서, 기존 state 12개·numeric provenance 18개 선언 및 9 recipe의 scratch 생성·strict types·제품/원본 비교를 통과했다. 기존 Spring fixture의 “정수 증가 무조건 거부” 기대는 새 지원에 맞춰 제거하고, 그 실패 경계를 독립 integer-state 검사로 검증한다. 한 회귀 실행의 source analyzer 독점 설정 충돌은 원본을 덮어쓰지 않고 실패했으며, 원본 checkout을 사용하는 작업을 직렬화한 재실행은 통과했다.

wheel recipe의 현재 compiler 재생성·compose·충돌 보존·필수 source gate도 통과했다. generated 제품 파일 SHA-256은 기존 `5216eab0…`과 같고, 배치 fingerprint만 현재 도구의 `c870b64c…`로 갱신했다. receipt·현재 입력 hash·stage별 잔여는 w10-progress.json (보관된 과거 기록 `w10-progress.json`)과 handoff.json (당시 기록, 긴급 정리로 삭제됨)에 모은다. 기존 Core50/browser/packed/native 관련 증거는 §8.1의 범위이며 이번 compiler 실행의 새 실제 환경 검증 완료로 다시 세지 않는다. 다음은 async/collection·mixin의 공통 의미 및 exact binding을 해소하여 실제 전체 wheel/viewport 후보를 생성·연결하는 것이다.

## 8.3 controller 제품 통합·전체 IR·현재 native 공급 — 2026-10-16 KST

사용자의 “체크리스트 최대한 채울 수 있게 전체 작업” 요청으로 구현·원본 비교·현재 패키지 실행을 진행했다. 착수 HEAD `ee90ed7`, 기존 W10 변경을 보존하고 progress의 **30개 입력 hash 일치**를 확인했다. **전체 W10은 PARTIAL**이며, 아래 검증된 묶음을 §9의 세부 완료 항목으로 추가했다.

### 실제 제품 변경

- [controller recipe](tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/w10-wheel-controller.json)는 고정 원본 **`FixedExtentScrollController` 전체 본문**을 생성한다. 공개 facade가 [생성 클래스](Nelyx/src/framework/widgets/list-wheel-controller.generated.ts)를 상속하여 selected item·jump·animation 순회·position 생성을 실제로 소비한다. itemExtent·single owner·범위/생존 검사·기본 curve 등 기존 공개 정책은 유지했다.
- [adapter](Nelyx/src/framework/widgets/list-wheel-controller-adapter.ts)는 기존 ScrollController/position identity와 lazy cast·live iteration·길이 변경 검사를 연결한다. `Future.wait<void>`는 모든 motion이 끝난 뒤 **시간상 먼저 관측한 오류**를 전달한다. Dart Zone이나 임의 microtask 순서의 전체 동등성을 주장하지 않는다.
- source superclass의 초기화 계약을 검토하면서 **debug 생성 observer가 초기화 전 derived 값을 읽을 수 있는 문제**를 수정했다. generated host의 생성 알림을 실제 source 필드와 extent 설정 후로 미뤘다. 일반 ScrollController의 기본 동작은 유지하며, observer가 `initialItem=3 / itemExtent=40 / initialScrollOffset=120`을 읽는 검사를 추가했다.

### 공통 compiler와 전체 선택

명시적 `asyncRuntime`/`iteration` 경계에서 async·await·for-in·list collection-for를 지원하고, generic adapter는 **정확한 type argument specialization**을 확인한다. mixin은 순서·qualified type이 일치하는 host superclass 계약으로 연결하며 mixin 본문을 생성한 것으로 표시하지 않는다. static const 의존성 순서/불변 보호·local function의 lexical this/super·throw도 추가하고, cycle·잘못된 mixin 순서·없는 binding·지원하지 않는 suspension은 계속 거부한다.

전체 재추출은 **19/19 IR, frontend blocked 0**이다. controller/physics 이외 widget·renderer의 TypeScript emission·host binding·제품 통합은 아직 미완료다. `RenderListWheelViewport`의 IR 추출을 렌더러 완성으로 계산하지 않는다. 전체 source closure에 필요한 exact mixin host 구현·member/collection/runtime type·tear-off 계약이 다음 작업이다.

### 검증된 현재 후보

| 묶음 | 결과와 범위 |
| --- | --- |
| compiler | TypeScript 검사·Dart analyzer PASS. callback/cascade·integer state·state 12개·numeric 18개 선언·mixin/static/local function의 독립 Dart debug/release 및 거부 조건 검사 PASS |
| 생성·제품 gate | 등록 **10 recipe** 회귀 PASS. 새 controller **13개 그룹**, unchanged source Dart debug/release 비교·strict types PASS. 실제 recipe의 결정적 재생성·주석 보존·충돌 시 원문 보존·필수 source 비교 실패 시 승격 차단 PASS |
| 제품/브라우저 | 현재 Core **50개**와 실제 Chromium **4개 흐름** PASS. 동일 편집 identity·focus·합성 입력, wheel/2D first seek, tree mutation, viewer 2x/0.5x geometry/typography·clip 확인 |
| 외부 소비 | 최종 native 공급에 사용한 archive로 저장소 밖 **4개 NodeNext/ESM 조합** PASS. 공개 controller의 core identity·초기값과 generated dependency를 확인. 새 Core/SDK 소스·JS 9개가 공급 archive와 byte 일치 |
| Windows | 최종 복사 EXE의 manifest **1,300개 파일 hash** 확인 후 실행. wheel/tree/grid/viewer 흐름, 프로세스 `4928→20216` 교체 후 item 44·offset 1760·`saved 한국 😀` 복원, motion 도중 View 종료·binding/disposal 균형·정상 exit **0** PASS-scoped |
| Android | 최종 복사 후보 manifest **991개 파일** 및 설치 APK hash 일치. API33 x86_64 emulator에서 같은 흐름·별도 프로세스 cold restore·motion settle/retirement·Activity 종료 PASS-scoped. 실제 EditText에 OS tap 후 focus/Unicode 유지와 2x/0.5x native bounds 확인 |

최종 후보는 생성 observer 수정까지 포함한다. 기존 설치본 결과로 대체하지 않았다. build의 `qualification: notVerified`는 build-only 기록으로 보존하며, 별도 `windows-runtime-final.json`·`android-runtime-final.json`의 실제 실행 결과로 해당 범위를 검증했다. Android는 로컬 개발 서명·emulator Vulkan/Hermes `-Og` 후보이며 생산 서명·물리 장치 검증이 아니다.

첫 Android 종료 fixture는 scheduler가 내려간 뒤 timer를 기다려 acknowledgement가 누락됐다. fixture를 실제 진행 중 motion promise를 기다리도록 고쳤고, 최종 두 target에서 retirement·motion settled를 검증했다. 중간 Android driver 로그 경로 오류도 수정·재검증했으며 실패 receipt는 보존했다. 제품 실패와 harness 실패를 섞어서 PASS로 덮지 않았다.

모든 실행 check는 1,200초 wrapper를 사용했다. 최종 양 target 빌드는 약 233초, packed consumer 약 60초, Windows runtime 약 16초, Android runtime 약 33초였다. 실행한 sample entry·runner manifest/lock은 원래 bytes로 복원했으며, 소유한 server·emulator를 종료했다. 공유 ADB/Gradle은 유지했다. 현재 입력·recipe fingerprint·immutable receipt와 다음 작업은 w10-progress.json (보관된 과거 기록 `w10-progress.json`), handoff.json (당시 기록, 긴급 정리로 삭제됨)에 연결했다.

**남은 범위:** 전체 wheel widget/viewport 및 2D/tree/viewer source 통합, 다른 scroll 복원/혼합 흐름, Windows native 편집기의 실제 geometry/caret 픽셀, 물리 IME·FPS, 나머지 W10-03~09 및 후속 A/B·전체 통합. 현재 advanced fixture의 cold restore/close만으로 OS link·route·locale 전체 흐름을 완료 처리하지 않는다. 기존 iOS/macOS/Linux 전용 native `SKIPPED`/provider `notVerified` 정책을 유지한다.

## 8.4 원본 child builder 연결·함수 identity·현재 공급 갱신 — 2026-10-16 KST

착수 시 기존 변경을 보존하고 progress의 **48개 입력 hash 일치**를 확인했다. 이번 묶음은 전체 wheel/viewport 완료가 아니다. 19개 선택 선언 중 controller·physics/helper·abstract/builder delegate의 **6개 본문**이 실제 제품에서 소비되며, 나머지 13개 선택 선언과 전체 renderer 연결은 남아 있다.

- **공통 compiler:** 명시적 `methodTearOff` 경계로 non-generic instance method의 수신자·실제 method identity를 공유 Core WeakMap에 보존한다. 반복 add/remove, 여러 생성 모듈, virtual override/`super`, optional/named 인자, nullable 수신자의 1회 평가를 독립 Dart debug/release와 비교했다. generic/unbound method·임의 call adapter는 계속 거부한다. monomorphic class의 `covariant` 인자는 생성 클래스 identity 또는 명시적 host predicate로 검사하여 잘못된 delegate가 본문에 진입하기 전에 실패한다.
- **원본 제품 연결:** [builder recipe](tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/w10-wheel-builder.json)가 `ListWheelChildDelegate`·`ListWheelChildBuilderDelegate` 전체를 생성한다. 실제 wheel facade가 lazy build·child count·IndexedSemantics를 소비하며 원래 item key를 보존한다. Sliver의 중복 index decoration을 끄고 항목마다 source index 하나를 유지한다. nullable child는 기존 host의 absent-child 계약으로만 변환한다. 공개 wheel의 finite count·nonnull builder 정책은 유지한다.
- **생성 검증:** builder 제품 **8개 그룹**, 수정하지 않은 source 본문의 Dart debug/release 비교·strict types·재생성·주석 보존·겹치는 rename 충돌 시 원문 보존·source 비교 실패 시 승격 차단 PASS. 전체 **11 recipe** scratch 생성·제품/source 회귀, callback/cascade·상태 클래스12·새 method identity 검사, compiler TypeScript·Dart analyzer PASS. 전체 재추출 **19/19**, frontend blocked 0을 유지했다.
- **제품 검증:** 현재 Core wheel **10개**와 실제 Chromium **4개 흐름** PASS. 10,000개 lazy list의 9001 seek, snap/drag/tap, resize·State 보존, 재정렬 전후 단일 semantic index `4→5`, motion retirement·cold snapshot을 확인했다. 다른 40개 Root 검사는 §8.3의 영향 없는 기존 증거를 재사용하며 이번 실행으로 다시 세지 않는다.
- **현재 공급:** native에 사용한 동일 archive의 외부 NodeNext/ESM **4조합**, Core/SDK source·dist **16개 byte 일치** PASS. 새 복사 Windows 후보 **1,302개**, Android 후보 **993개** manifest 파일 hash와 설치 APK hash를 검증했다. 양 target의 advanced 흐름·별도 프로세스 item44/offset1760/Unicode 복원·motion settle/close, Windows exit0 및 Android Activity 종료 PASS-scoped. Android 실제 EditText OS tap·focus·Unicode·2x/0.5x bounds도 통과했다. 물리 IME/caret pixels/FPS·Windows native 편집기 픽셀·전체 source renderer를 완료 처리하지 않는다.

초기 병렬 source 분석은 기존 exclusive config guard에 의해 실패했으며 원본을 보존한 직렬 회귀는 통과했다. 초기 adapter의 명시적 `undefined` child는 strict optional-property 검사에서 거부되어, 없는 child 속성을 생략하도록 수정했다. 실패 이력과 성공 receipt를 구분한다. 모든 실행 check는 1,200초 wrapper를 사용했다. 양 target 빌드 약210초, 외부 소비 약53초, Windows runtime 약14초, Android runtime 약33초였다.

sample entry·runner manifest/lock의 원래 bytes를 확인했고, 소유 server·emulator를 종료했다. 공유 ADB/Gradle은 유지한다. 최신 progress 입력 **55개**, builder 출처·fingerprint·immutable receipt·현재 native 후보는 w10-progress.json (보관된 과거 기록 `w10-progress.json`)과 handoff.json (당시 기록, 긴급 정리로 삭제됨)에 연결했다. W10-01·02 및 전체 계획은 **PARTIAL**이며 다음은 list/looping delegate의 collection 및 renderer/widget exact host·mixin 연결이다.

## 8.5 source list/looping delegate와 collection 연결 — 2026-10-16 KST

착수 시 기존 dirty 변경을 보존하고 progress 입력 **55개 SHA-256 일치**를 확인했다. `ListWheelChildListDelegate`·`ListWheelChildLoopingListDelegate` 전체 본문을 기존 builder recipe에 추가했다. frontend는 resolved `[]` identity를 보존하고, emitter는 exact getter/index/modulo adapter를 요구한다. 공통 `dart-list.ts`는 목록 참조·실시간 길이·범위 검사와 음수 Euclidean modulo를 연결하며 source의 목록 비교·반복 알고리즘을 generated 파일 밖에서 다시 구현하지 않는다.

공개 wheel subpath의 네 delegate와 `ListWheelScrollView.useDelegate`를 실제 viewport에 연결했다. 기존 host의 양수·유한 범위 정책을 유지하여 무한 delegate는 명시적 `itemCount`를 받는다. 반복 항목의 외부 cell key는 slot별로 구분하고 선택 callback은 source `trueIndexOf`를 따른다. 일반 목록의 keyed State와 단일 semantic index는 보존한다. 전체 무한/음수 viewport 또는 source renderer 완료로 계산하지 않는다.

현재 완료한 검증은 네 delegate의 제품 **14개 그룹**, 전체 원본 Dart debug/release 비교, collection의 평가 순서·참조 비교·양/음 극값·0 나머지·빈 목록/범위 오류, strict types 및 지원하지 않는 setter의 거부 검사다. Core build와 실제 wheel **13개**, Chromium **4개 흐름**도 PASS이며 list/looping 실제 소비를 포함한다. 최종 compiler TypeScript·Dart analyzer, **11 recipe** 회귀, 전체 **19/19 IR** 추출과 결정적 재생성·사용자 주석·rename 충돌 보존·필수 source gate도 PASS다. 현재 공급 archive의 외부 NodeNext/ESM **4조합**이 새 공개 delegate·단일 Core identity를 검증했다. 동일 archive의 Core/SDK source·JS **14개 byte 일치**, native 설치 시 target별 **13개 입력 일치**도 확인했다. 새 복사 Windows **1303개**·Android **994개** manifest 파일과 설치 APK hash를 검증했다. 양 target **19개 이벤트**에서 list slot123·loop slot7777/true index1, 기존 advanced 흐름, 별도 프로세스 item44/offset1760/Unicode 복원·motion settle·Windows exit0/Android Activity 종료가 PASS-scoped다. Android 실제 EditText OS tap·focus·Unicode·2x/0.5x bounds도 통과했다.

재생성 보존 검사가 의도적으로 source를 바꾸는 동안 시작한 browser 검사는 stale map guard에 차단되었다. 원문 복원 이후 재실행한 결과만 사용했다. 새 getter/index/modulo adapter도 미지원 setter나 임의 JS 연산으로 자동 우회하지 않는다. 네이티브 공급 빌드 약321초, Windows 실행 약21초, Android 실행 약39초이며 성능/FPS 측정값이 아니다. 모든 정규 check는 1,200초 wrapper를 사용했다.

sample entry와 runner manifest/lock bytes를 복원하고 소유 server/emulator를 종료했다. 최신 progress 입력 **57개**와 immutable receipt·source span·batch fingerprint는 현재 progress/handoff에 연결했다. **W10-01·02 전체는 PARTIAL**이다. 다음은 남은 metrics/position/widget/renderer exact host·mixin과 generic callback binding, 이어서 2D/tree/viewer source 파트다. 생성·소비한 선택 선언은 **8/19**이며 다른 11개를 완료로 세지 않는다.

## 8.6 source metrics·position과 초기화 규칙 — 2026-10-16 KST

이전 턴은 구현·검증이 이루어진 진행으로 분류했다. 재개 시 dirty 변경을 보존하고 progress 입력 **57개 hash 일치**를 확인했다. 남은 11개 선언을 기존 exact binding으로 생성해 첫 오류를 수집했다. metrics/position의 host constructor, widget 계층의 constructor/named initialization, renderer의 mutable field 초기화와 mixin 계약을 구분했다.

`FixedExtentMetrics`·`_FixedExtentScrollPosition` **전체 본문**을 새 recipe로 생성하고 실제 wheel position의 부모로 연결했다. source itemExtent·clamp/round·copyWith가 소비되며, ScrollNotification은 실제 generated metrics snapshot을 전달한다. WeakMap extent 등록으로 원래 Scrollable context·View·ticker identity를 유지하고 public facade의 기존 pre-layout index fallback만 보존한다. Dart implements는 source public surface에서 유도한 타입으로 연결하여 host의 private storage identity를 복제하지 않는다.

renderer를 막던 mutable 필드 기본값과 생성자 초기화 중복도 공통 규칙으로 보정했다. **덮어쓸 선언부 초기값도 먼저 평가**한다는 것을 실제 Dart로 확인하고 그 순서와 super 호출 전 평가를 보존했다. final/중복 explicit 초기화는 여전히 거부한다. 이 변경 이후 renderer의 최초 오류는 초기화에서 exact mixin binding으로 이동했다.

현재 source 제품 **12개 그룹**, 원본 debug/release 비교, 초기화·public interface 독립 비교, 기존 상태 클래스12·compiler typecheck, Core build·실제 wheel14·Chromium4가 PASS다. 실제 Root에서 notifications의 source metrics identity/index, snapshot 불변성, physics 교체 후 position/context/선택값 보존을 확인했다. 최종 **12 recipe** 회귀와 동일 archive의 외부 consumer **4조합**, Core/SDK source·JS **20개 byte 일치**가 PASS다. 현재 복사 Windows **1305개**·Android **996개** manifest 파일, 설치 APK hash와 target별 **20개 설치 입력**도 일치했다. 양 target의 **19개 이벤트**에서 source metrics identity/index·delegate 이동·advanced 흐름·별도 프로세스 복원·motion settle·정상 종료를 확인했다. Android 실제 EditText focus/Unicode·2x/0.5x bounds/OS tap 역시 PASS-scoped다. **전체 W10은 PARTIAL**이며 아직 source viewport 통합 완료가 아니다.

초기 부정 검사는 기존 초기화 오류 문구를 기대하여 실패했다. final/중복 explicit 거부를 유지한 채 문구를 갱신하고 state12·recipe12 회귀를 통과했다. sample/runner 원래 bytes 복원과 소유 server/emulator 종료를 확인했으며 입력 **64개**·receipt·handoff를 갱신했다. 공급 빌드 약359초, Windows 실행 약21초, Android 약39초였다. 모든 정규 check는 1,200초 wrapper를 사용했다. 이전40개 Root 검사는 변경 영향이 없는 유효 증거를 재사용했다.

전체 source widget/renderer는 남는다. 현재 emitter 진단은 **9개 선언**의 named constructor/정확한 superclass·mixin/type binding을 다음 장애로 기록하며, frontend 19/19 추출을 전체 생성·통합으로 바꾸어 표기하지 않는다.

## 8.7 source renderer 공개 API와 실제 공급 — 2026-10-16 KST

재개 시 progress 입력 **64개 hash 일치**와 이전 구현·검증 진행을 확인했다. 기존 dirty 변경을 보존하면서 남은 렌더러 전체 본문을 먼저 연결했다. `ListWheelChildManager`·`ListWheelParentData`·`RenderListWheelViewport` **3개 전체 원본**을 새 recipe로 생성했으며 생성 파일은 1,190줄이다. 공개 `@nelyx/core/framework/rendering/list-wheel-viewport`를 추가하고 실제 Core container/layout/viewport identity·UI 값·layer·hit path에 연결했다. layout·cylindrical projection·lazy 범위 알고리즘은 generated 본문에 남는다.

외부 generic constructor의 exact monomorphic specialization, private named field formal의 analyzer 공개 이름, 공개 base type과 검토된 host subclass 구분, value operator·nullable identity adapter, 단일 수신자 평가를 보존하는 `??=`를 공통 생성 규칙에 추가했다. 독립 Dart debug/release·strict type·거부 조건 검증을 통과했다. 원본 renderer 비교는 **3개 시나리오×2 frame×2 mode**이며 전체 원본 본문·pinned cylindrical helper·실제 vector_math를 사용한다. framework 수신자는 통제된 참조 모델이므로 실제 host 검증과 분리한다.

통합 중 getter 기반 `Rect`를 object spread로 복사하면서 좌표가 사라지는 문제와 즉시 페인팅의 임시 layer 소유권 누락을 수정했다. 명시적 값 복사와 context 수명 동안의 handle 유지로 보정하고, 롤백·scene 실패·외부 캐시·해제 후 진입을 **5개 검사**로 확인했다. renderer 제품 **7개**, 실제 Root/CPU CanvasKit **5개**에서 직접 item9001 이동·중앙·hit/reveal·magnifier/opacity/offaxis·rebuild/resize·모든 child/listener/layer 해제가 PASS다. 기존 advanced Root **54개**, magnifier pixel **6개**·수명 **5개**도 공유 변경 이후 통과했다.

현재 compiler typecheck·Dart analyzer·**13 recipe** 재생성/원본 회귀, 사용자 주석·충돌 보존·필수 source gate가 PASS다. Chromium은 새 공개 renderer 소비를 포함한 **5개 흐름**, 동일 공급 archive의 외부 NodeNext/ESM **4조합**, Core/SDK source·JS **32개 byte 일치**를 통과했다. 복사 Windows **1309개**·Android **1000개** manifest와 설치 APK hash를 검증했고 target별 설치 입력 **32개**도 일치했다. 양 target **21개 이벤트**에서 renderer 직접 이동/중앙/hit/reveal/magnifier, 기존 source metrics/delegates·tree/grid/viewer·별도 프로세스 cold restore·정상 종료를 확인했다. Android 실제 EditText OS tap·focus·Unicode·2x/0.5x bounds도 PASS-scoped다. 물리 IME/caret pixels·FPS·다른 target 완료는 별도다.

첫 Windows 빌드는 RN Babel의 static block 미지원으로 실패했다. Metro 실패 뒤 이전 bytecode를 읽으며 발생한 UTF-8 후속 오류와 구분했다. scalar static 상수 보호를 class 선언 직후로 이동해 순서·불변성을 유지하고 **실제 Windows runner Babel 변환/실행**을 검증했다. 수정 후 source 재생성·13 recipe·renderer Root/browser·새 renderer2 archive/consumer/native를 다시 검증했다. 최초 실패 공급은 보존했다. 재생성 검사와 겹친 초기 Root 시도는 stale-map guard가 차단했으며 복원/재빌드 이후 결과만 사용한다.

**전체 W10은 PARTIAL**이다. 실제 기본 wheel facade에서 소비하는 source 선언은 기존 **10개**, 별도 공개 renderer API는 추가 **3개**다. 기존 기본 wheel은 아직 이전 renderer를 사용하며 source Scrollable/State/Widget/Element/Viewport **6개**와 최종 통합이 남는다. fixture의 직접 render-child 관리자를 source Widget 구현 완료로 계산하지 않는다. sample/runner 원래 bytes 복원·소유 server/emulator 종료·최신 입력/receipt/handoff를 확인했다. 검증은 모두 1,200초 wrapper를 사용했고 불변 공급/비영향 입력의 유효 증거만 재사용했다.

## 8.8 남은 Widget 전체 생성과 생성자·Map 경계 — 2026-10-16 KST

앞선 턴은 renderer 구현·제품/원본/실제 공급 검증까지 진행한 것으로 분류했다. 재개 시 현재 입력 **82개 hash 일치**를 확인했다. 기본 wheel의 남은6개 원본과 Core Element/Scrollable/sliver의 실제 수명 계약을 읽고, 별도 named 초기화와 lazy child 관리 차이를 다음 장애로 확인했다.

named constructor별 superclass identity·인수·super formal을 IR에 보존했다. 별도 생성 경로는 declaration default→field formal/initializer/assert→실제 base 호출→field commit/protect 순서를 유지하며 원래 클래스 prototype으로 할당한다. unnamed 경로의 defaults/assert/body를 실행하지 않는다. 동등성을 증명할 수 있는 기존 단순 경로만 보존하고, 복잡하거나 derived인 경로는 공통 초기화 lowering을 재사용한다. **Dart 양 mode·strict types·실제 RN Babel 변환/실행·pinned Windows Hermes 실행**으로 필드값·효과 순서·부모 호출·prototype/constructor/instanceof·쓰기 보호를 확인했다. 합성 subclass 방식은 Babel classCallCheck에 실패하여 실제 base 할당 helper로 교체했다. generic/abstract owner, generic base, 다른 super entry와 named body는 여전히 명시적 경계다.

`[]=`의 실제 write identity를 보존하고 별도 exact setter를 요구한다. 수신자→index→RHS를 한 번씩 평가하고 setter 결과 대신 RHS를 반환한다. nullable cast/test는 null을 보존하고 나머지는 기존 checked host binding으로 검사한다. 외부 generic constructor의 nullable type argument는 별도 exact specialization key를 사용한다. 새 내부 `dart-int-map.ts`는 선택된 safe integer key·nullable value cache·numeric ordered traversal·키 변경 오류를 제공한다. 독립 Dart 양 mode 비교와 잘못된 값/키·missing setter·compound write·잘못된 specialization 거부 검사를 통과했다. 이 Map은 아직 기존 공개 wheel에서 소비하지 않으며 copied-app 검증 완료로 세지 않는다.

이후 남은 **6개 전체 본문을 한 모듈로 생성**했다. 생성 후보 (보관된 과거 기록 `w10-wheel-widget.json`)와 host 연결 계획 (보관된 과거 기록 `w10-wheel-widget-host-plan.md`)은 **미승격·type/runtime 미검증**이다. 현재 실제 연결 수는 여전히 **10+3=13개**이며, 19개 전체 출력 가능과 제품 수용을 분리한다. Core의 queued build와 source의 synchronous updateChild, slot/parent-data·inactive transfer, source가 금지한 move와 facade의 keyed reorder, source backup controller/live extent를 실제 host에 연결해야 한다.

최종 compiler typecheck·Dart analyzer·Core build, **13 recipe 원본 회귀**, 기존 collection boundary와 새 두 언어 fixture가 통과했다. **14개 fresh module 출력이 이전 renderer 턴의 fresh 출력과 byte 일치**한다. 기존 제품과 다른6개 출력은 이번 변경 이전부터 있던 차이이며 임의로 덮어쓰지 않았다. 이전 native/packed 공급의 **32개 소비 source·JS도 현재와 byte 일치**하여 §8.7의 관련 실행 증거를 재사용한다. 새 미소비 Map과 미연결 Widget 후보의 native 완료 증거는 아니다. 이번에는 앱 공급/실행을 반복하지 않았으며 전체 W10은 PARTIAL이다.

## 8.9 전체 source Widget/Element 공개 API·현재 공급 — 2026-10-16 KST

시작 시 이전 checkpoint의 **88개 입력 hash가 일치**했다. 기존 변경을 보존하고 남은6개 전체 본문을 실제 Core host에 연결했다. [w10-wheel-widget recipe](tools/Nelyx.FrameworkToTypeScript/data/work8/recipes/w10-wheel-widget.json)는 `@nelyx/core/framework/widgets/list-wheel-source`에 `ListWheelScrollView`, `ListWheelViewport`, `ListWheelElement`, `ChangeReportingBehavior`를 공개한다. source backup controller와 실제 `ScrollableState`/notification/ticker를 사용하며, 기본 유한 facade는 아직 이전 renderer를 사용한다.

- **Core 접점:** 원본 cache·정렬 Element map·레이아웃 알고리즘을 유지했다. private BuildScope를 source layout 전에 flush하고 지연 render 삽입의 slot/offset을 보존한다. inactive 자식도 unmount 소유권에서 빠지지 않으며, GlobalKey 이동의 이전 slot과 Core rebuild 확인을 연결했다. 같은 delegate의 `shouldRebuild=false`와 명시적 cache 무효화도 구분한다.
- **수명 보정:** source extent는 실제 Scrollable Widget의 현재 값을 읽는다. 동기 선택/종료/hold 취소 callback이 Root를 닫으면 공유 ScrollPosition 후처리를 중단한다. source controller 순회는 방금 처리한 position이 종료되고 전체 client가 분리된 경우에만 종료를 허용하며 일반 live 변경 오류는 유지한다. superclass host와 generated nominal cast를 분리해 import 순서에 따른 초기화 cycle도 제거했다.
- **원본·생성 검증:** 6개 원본 전체 본문을 독립 Dart debug/release와 비교했다. strict type·실제 Root/CPU CanvasKit **12건**, 정식 승격·사용자 수정 보존·충돌·필수 source 실패 차단, 새 추출을 이용한 **14 recipe** 회귀가 통과했다. Root12에는 10,000개 직접 이동, live extent, descendant rebuild, effect/layer 종료, nullable cache, reporting-on-end, 동기 Root 종료, active/inactive GlobalKey retake, delegate rebuild veto, controller 교체가 포함된다.
- **제품·공급 검증:** 기존 advanced Root54 + renderer Root5 + source Widget Root12, 공유 nested/action/control/sheet **43건**, Chromium **6개 흐름**, 동일 archive 외부 NodeNext/ESM **4조합**이 PASS. Core/SDK source·JS **48파일**의 archive 일치와 두 runner 설치 일치를 확인했다. 복사 Windows **1,314파일**, Android **1,005파일** manifest/설치 hash 및 각각 **24이벤트**가 PASS-scoped다. full source Widget의 backup controller 이동·효과·motion 중 종료와 기존 cold restore·종료, Android 실제 EditText bounds/focus/Unicode·OS tap을 포함한다.
- **실패와 정리:** 초기 host 검증에서 import cycle, inactive 자식 누락, Core config rebuild/GlobalKey 확인, 동기 종료 후 scroll 접근을 발견해 보정했다. native fixture의 RenderObject→RenderBox type guard 누락도 공급 전 타입 검사에서 수정했다. 최종 원본/제품/source gate와 실제 공급으로 재검증했다. sample/runner 5입력 원복·임시 파일/lock 제거·소유 서버/에뮬레이터 종료를 확인했다.

**전체 완료로 올리지 않은 항목:** `list-wheel-scroll-view` 유한 facade의 `findChildIndexCallback` 재정렬, display-only input/tap/selectionOverlay/밀도/복원 정책 최종 연결과 수동 projection 제거. source 기본 Element의 move assert는 유지한다. 2D/tree/viewer와 나머지 W10 파트, 물리 IME/caret pixels·FPS, 다른 native target도 별도다. host 계획 (보관된 과거 기록 `w10-wheel-widget-host-plan.md`), 현재 입력·receipt (보관된 과거 기록 `w10-progress.json`), 재개 기록 (당시 기록, 긴급 정리로 삭제됨)을 갱신했다.

## 8.10 기본 유한 wheel 최종 연결과 W10-01 완료 — 2026-10-16 KST

§8.9의 98개 입력·65개 receipt hash를 확인한 뒤, 기존 `ListWheelScrollView`를 생성 `SourceListWheelScrollView.useDelegate`에 연결했다. `_WheelSliver`/`_RenderWheelSliver`/`_WheelCell` 및 수동 cylindrical projection을 제거했다. **기본 API도 19개 source 본문을 사용하는 전체 경로**가 되었다.

- facade만 등록하는 key 정책을 실제 Element host에 연결했다. 소유권 변경 전에 remap을 계산하고, 현재 창 안의 State와 source slot을 보존한다. 먼 위치로 이동한 자식은 먼저 종료해 원본의 연속 rebuild가 중간 수천 개 항목을 만들지 않게 한다. 기본 source Element의 move assert는 debug 모드에서 그대로 검증했다.
- 전체 너비의 표시 전용 자식, 단일 source semantic index, tap-to-select, overlay, positive finite/density 검사, 기존 controller 교체 제한·선택 callback·cold restoration을 유지했다. `cacheExtent`는 보수적인 밀도 admission hint로 남고 실제 자식/cache 창은 source renderer가 결정한다. 이 차이는 recipe 계약에 명시했다.
- 기본 wheel **17건**: 기존14건 및 cyclic/far key remap·모델 축소·자식/overlay 입력 차단이 PASS. 10,000개 직접 이동 사례의 누적 생성 자식은 이전29개에서11개가 되었으며, 이 수치는 해당 fixture의 범위이고 FPS 증거는 아니다. 별도 full source Root12, strict/Dart gate 및 renderer gate도 PASS. 전체 generated Widget/renderer bytes가 이전 14-recipe fresh 출력과 같음을 확인했으므로, compiler/무관한 recipe 검증은 재사용했다.
- 영향 Chromium6·동일 archive 외부 소비4·현재 source/JS48파일 검증을 갱신했다. 새 복사 Windows/Android 각각 **25이벤트**에서 기본 facade의 source renderer identity와 key 재정렬 후 동일 항목·slot9002, full source API와 기존 advanced/cold restore/close/editor 흐름을 확인했다. 이전에 완료한 공유43건은 변경 없는 소비 경로에 한해 유지한다. 임시 입력·소유 프로세스도 정리했다.
- 최초 모델 축소 fixture는 기존 정책이 금지하는 `initialItem=44`/새 count5 조합을 사용해 거부되었다. 초기0→실제44 이동→count5 축소로 바꿔 정책을 그대로 검증했다. source 이동 assert 검사는 Core 기본 release 모드에서 예외가 없었으므로 해당 호출만 debug 모드로 검증하고 즉시 복원했다.

**W10-01 종료 근거:** 첫 실전 파트 전체 생성→compose→strict type·원본 비교→실제 기본 경로/환경 검증→재생성·사용자 수정/충돌 보존의 기준을 충족했다. 임의의 Flutter/Dart 전체 지원을 뜻하지 않는다. **W10-02는 계속 PARTIAL**이며 2D/tree/viewer와 나머지 scroll·복원·성능 범위를 다음으로 진행한다. 현재 progress (보관된 과거 기록 `w10-progress.json`)와 handoff (당시 기록, 긴급 정리로 삭제됨)가 재개 기준이다.

## 8.11 2D 전체 파트 진단과 표현식·동등성 규칙 — 2026-10-16 KST

시작 시 §8.10의 **98개 입력·67개 receipt hash가 일치**했다. 2D 파트 (보관된 과거 기록 `w10-two-dimensional.json`)는 `TwoDimensionalScrollView`, viewport/Element/renderer/ChildVicinity, 세 child delegate와 selection/error helper, 양축 Scrollable/State/내부 axis subclass, ScrollableDetails까지 **5파일·21개 전체 선언**을 선택한다. 기존 fixed-cell/controller·양축 physics·keyed editor·복원 정책을 유지하며 원본 상태 전이를 연결하는 범위다.

초기 추출10개·장애11개에서, 다음 공통 규칙을 보정한 뒤 **15개 추출·6개 장애**가 되었다. 아직 2D generated module의 제품 소비는 **0개**이며, IR만으로 완료를 올리지 않는다.

- **switch 표현식:** scalar/enum/null 상수 패턴과 마지막 wildcard, 단일 scrutinee 평가·선택 branch만 평가·중첩 throw를 지원한다. 직접 suspension, guarded/logical/구조 패턴은 이 규칙으로 대신 처리하지 않고 거부한다.
- **동적 adjacent strings:** literal/interpolation 조각을 순서대로 합쳐 원본 escape와 callback 평가 순서를 보존한다. 기존 상수 문자열 출력은 그대로다.
- **전체 equality 연산자:** `operator ==` 본문에 명시적 member rename·동일 receiver adapter를 요구한다. virtual/super dispatch와 nullable 양 operand의 단일 평가·null 비교 시 연산자 호출 생략을 구현했다. 왼쪽이 값 객체이고 오른쪽이 문자열일 때 JS identity로 빠지던 조건도 수정해 원본 연산자를 호출한다. rename 충돌·예약 이름·잘못된 adapter와 미지원 연산자는 거부한다.
- **검증:** 두 독립 fixture가 Dart debug/release·strict type·실제 RN Babel에서 PASS. compiler tsc와 Dart analyzer, 새 추출을 사용한 **14 recipe 회귀**도 PASS. 모든 **15개 기존 fresh module 출력이 이전 검증과 byte 일치**했다. 제품 source/JS를 바꾸지 않았고, 기존 facade archive48파일의 현재 일치를 재확인했다. 따라서 §8.10의 실제 앱 검증은 그 동일 소비 코드에 한해 유지한다.

남은 장애 기록 (보관된 과거 기록 `w10-two-dimensional-blockers.json`): viewport Element/renderer의 Map, selection helper의 Set, builder try/catch, outer axis State의 record, inner axis State의 late field. **각 선언의 첫 장애**이므로 이후 추가 장애가 나타날 수 있다. Map/Set은 실제 ChildVicinity/Key equality/hash·순서·변경/keepalive 수명과 함께, 예외는 stack/rethrow/finally와 함께 보정한다. 그 다음 전체 본문 생성·원본 비교·현재 Core host/기본 grid 연결을 검증한다. W10-02와 전체 계획은 계속 PARTIAL이다.

## 8.12 2D 전체 추출과 collection·예외·late·record 규칙 — 2026-10-16 KST

시작 시 §8.11의 **103개 입력·75개 receipt hash가 일치**했다. 같은 5파일·21개 전체 선언을 유지하면서 공통 언어·런타임 경계를 확장했다. 최종 추출은 **21개 IR·frontend 장애0**이다. **2D generated 제품 소비0**은 그대로이며 실제 기본 grid 연결·원본 비교는 다음 단계다.

- **Map/Set:** 정확한 resolved type별 factory와 key equality/hash/admission 계약, 삽입 순서·원래 equal key identity·nullable cache·callback 변경·live/lazy view·iterator 생성/종료 후 변경 검사를 구현했다. plain Map은 모든 key/value를 먼저 평가하고, control Map/Set은 순서대로 삽입한다. if/for/spread/null-aware spread와 fixed list를 비교했다. VM hash 재탐색/rehash 호출 횟수는 동등성 범위에서 제외한다.
- **null selector·예외:** null-shorting 전체 chain의 receiver 단일 평가와 후속 property/index/argument/checked tear-off 생략을 보존한다. typed catch 순서·lexical rethrow·finally의 return/throw/break/continue·host Promise 정리를 검증했다. 예외 identity와 own data stack을 보존하지만 Dart VM frame/primitive 원래 throw-site를 재현한다고 주장하지 않는다.
- **late instance:** source-qualified field identity와 owner별 storage로 미초기화 읽기·nullable 초기값·late-final 중복 쓰기·상속/독립 named construction을 처리했다. lazy initializer/static late는 거부한다.
- **record·패턴:** 위치 기반 불변 record 생성·`$1`/`$2`·nullable chain·중첩 구조 분해와 record 상수/wildcard switch를 구현했다. selector 단일 평가, implicit case 종료·break·바깥 continue를 보존한다. scalar logical-or switch 표현식도 지원한다. named/const record·binding/guard pattern·record structural equality/hash는 별도 미지원 경계다.
- **클래스 키·상수 빈 collection:** monomorphic Type literal은 실제 generated/imported class identity를 사용한다. 빈 const Map/Set은 exact canonical immutable factory를 요구하고, 빈 addAll/remove/clear 같은 변경 시도도 callback 전에 거부한다. type-only import/generic token/비어 있지 않은 const collection은 거부한다. 오류는 host TypeError이며 Dart UnsupportedError 클래스 일치 증거가 아니다.
- **검증:** ordered collection21 case와 null-chain·exception·late·record·Type-key 및 갱신한 expression/callback fixture가 Dart 양 mode·strict TypeScript·실제 RN Babel에서 PASS. 새 runtime 네 파일도 해당 Babel 검증에 포함했다. compiler tsc·Dart analyzer·Core ESM/declarations/source-map build 및 **fresh14 recipe 회귀 PASS**. **기존 fresh15 module byte 동일**, 기존 facade archive의 현재 source/JS48파일 일치를 확인했다.

새 `dart-collections`/`dart-exceptions`/`dart-late`/`dart-record`는 아직 제품 소비 경로에 연결되지 않았다. 이전 copied Windows/Android·Chromium 증거는 **변경 없는 기존 소비 코드**에 한해 유지하며 새 런타임의 native/2D 승인을 추가하지 않는다. 초기 fixture의 catch-variable 재대입, VM array prototype 비교, RN Babel helper require 누락, Type alias 반환 binding과 compiler 타입 추론 문제는 수정 후 최종 검증했다.

다음은 장애/연결 기록 (보관된 과거 기록 `w10-two-dimensional-blockers.json`)의 exact Core dependency/type/constructor/member binding, ChildVicinity/Key collection 정책, queued Element·layout/keepalive·양축 gesture 수명이다. 전체 본문 생성·source 비교·default finite grid 통합 후 필요한 실제 환경 검증을 진행한다. **W10-02와 전체 계획은 계속 PARTIAL**이다.

## 8.13 2D delegate 전체 생성 후보와 실제 Core 수명 — 2026-10-16 KST

§8.12의 **113개 입력·96개 receipt hash**를 확인하고 시작했다. 21개 선택을 유지한 채 dependency 순서대로 **ChildVicinity + 세 child delegate + selection Widget/State + error helper = 7개 전체 선언**을 생성했다. ChildVicinity를 독립 output으로 분리해 viewport/delegate 순환 소유를 피했다. 원본 파일은 여전히5개이며 output 계획은6개다. 새 전체 추출도 **21 IR·frontend0**이다.

- **생성 후보:** candidate recipe (보관된 과거 기록 `w10-two-dimensional-delegate.json`)의 두 모듈에 원본 본문을 모두 생성했다. 실제 Core Widget/State/ChangeNotifier/AutomaticKeepAlive/selection/error identity를 사용하며, bounds·notifier 변경·list identity·wrapper 순서·selection 전이는 생성 본문에 남긴다. 기존 수동 selection helper는 원본에 없는 복구 로직이 있어 동일하다고 재사용하지 않았다.
- **const·생성자 안전성:** monomorphic·상속 없는 immutable generated const 생성자에 exact canonical factory를 요구한다. constructor identity와 두 safe-int 값으로 ChildVicinity 상수를 공유하고 일반 `new`는 별도 인스턴스를 만든다. 실제 class token·static/instance final·module 초기화 순서를 Dart/strict/RN Babel로 검증했다. base constructor의 receiver 노출은 literal 또는 exact boolean mapping으로 죽은 branch만 제외하며 live/unmapped branch는 계속 거부한다. 이 후보의 선택적 source memory-allocation flag는 명시적으로 false이고 Core listener instrumentation과 구분한다.
- **원본 비교:** 7개 변경 없는 전체 선언의 source hash·raw offset·정규화 span을 확인했다. Dart assertions on/off와 실제 Core host/통제된 context의 TS를 비교해 각각15개 관측 묶음이 PASS했다. generated modules·canonical helper·collections/exception/tear-off runtime의 RN Babel 실행도 같은 결과다. VM hash 숫자·VM stack frame 동등성은 주장하지 않는다.
- **실제 Core host6:** 실제 ListView/sliver에서 generated selection State·registrar 연결, 선택된 화면 밖 셀 유지, 선택 해제 후 keepalive 해제·폐기, registrar 변경 시 State 보존·등록 이전, generated list lookup, 전체 listener/registrar/scroll 종료가 PASS했다. 전체2D renderer나 기본 grid를 실행한 증거는 아니다.
- **회귀:** candidate deterministic emission/strict type·누락 canonical 및 live observer 거부, compiler tsc·Core build·fresh14 recipe가 PASS했다. 기존15 fresh output과 기존 공급 archive48개 source/JS가 동일하다. 새로운 미소비 후보의 native 승인은 추가하지 않았다.

초기 fixture의 CRLF offset을 정규화 문자열에 적용해 잘못 잘랐던 문제는 **raw source에서 slicing 후 LF 정규화와 upstream span hash 확인**으로 수정했다. Dart annotation stub과 JS template escaping도 보정했다. 첫 `RepaintBoundary` binding의 named/positional shape 차이는 명시적 host factory로 연결했으며, generated 본문을 손수 고치지 않았다.

**현재: source/strict/host 검증 후보7, 나머지14개 연결·생성 대기, 기본2D 제품 소비0.** 다음은 renderer/Element/parent-data/child-manager의 정확한 host·Map/keepalive/layout 계약과 양축 Scrollable 연결이다. 원본 helper의 registrar 예외 상황은 이전 수동 구현의 복구와 차이가 있으므로 제품 통합 시 명시적으로 해결한다. W10-02·전체 계획은 계속 PARTIAL이다.

## 8.14 2D viewport 전체 생성 후보와 source-flow 경계 — 2026-10-16 KST

§8.13의 **123개 입력·109개 receipt hash**가 일치했다. 이어서 viewport Widget·Element·ParentData·renderer·ChildManager **5개 전체 본문**을 생성했다. 기존7개와 합쳐 **생성 후보12개**, 나머지 view/양축 Scrollable/Details **9개**가 남는다. 모든21개 source 선택은 유지한다.

- **실제 Core 연결:** source 활성/새 자식/keep-alive Map을 실제 render-child adopt/drop·독립 BuildScope·queued Element 갱신과 연결했다. 원본 자식 선택·key lookup·배치·정렬·paint/hit/reveal 알고리즘은 생성 본문에 유지했다. Key/ChildVicinity의 equality/hash와 실제 Element/RenderBox identity 정책을 명시했다. viewport candidate (보관된 과거 기록 `w10-two-dimensional-viewport.json`)는 deterministic emission과 strict 실제 Core 의존성을 통과했다.
- **source-flow:** nullable 지역변수는 null로 초기화하고, 나중에 분기에서 초기화되는 final 지역변수는 lexical assignment로 표현한다. 빈 목록 초기값은 원본 필드 타입을 유지한다. analyzer가 증명한 local/parameter promotion을 선택된 recipe에서 소비해 null-check IIFE 이후의 TypeScript 타입 정보를 복원했다. enum/bool/null 전체 switch coverage를 확인한 경우에만 잘못된 외부 값의 default 오류를 추가한다. late local은 계속 거부한다.
- **추가 언어·collection 경계:** nullable interpolation은 값을 한 번만 평가하고 null이면 converter를 호출하지 않는다. exact monomorphic host const factory는 실제 owner token·signed-zero identity를 유지한다. Map.containsValue/Iterable.contains는 명시적 equality policy를 사용하며, equality callback이 변경 후 false/true를 반환하는 경우를 Dart와 비교했다. 독립 source-flow·membership fixture의 Dart 양mode/strict 또는 실제 runtime·RN Babel이 PASS했다.
- **실제 viewport Root6:** 1억 논리 셀의 시험 subclass에서 최초24개만 생성, key 이동 시 State 보존,9001:9001로 양축 직접 이동 후24개 유지, 역방향 배치·column traversal, 실제 pointer hit, 전체 자식/offset/delegate 종료가 PASS했다. 실제 Core geometry·paint/hit·Element·render tree를 사용하지만 offset은 통제된 시험 receiver이며 아직 기본2D Scrollable/facade가 아니다.
- **회귀:** 기존7개도 새 compiler로 재생성해 strict·원본15묶음×2mode/RN Babel·실제 Core host6을 다시 통과했다. compiler tsc·Dart analyzer·Core build·fresh14 recipe·기존15 output byte 동일이 PASS했다. 기존 archive48개 source/JS가 일치하며, Core `redepthChildren`의 public 타입 노출 변경도 **emitted object.js가 기존 archive와 byte 동일**함을 확인했다. 해당 source/API 표면은 달라졌으므로 새 전체 패키지/native 승인은 주장하지 않는다.

초기 strict 검사에서 드러난 nullable 초기값·분기 final·타입 promotion·빈 목록 추론 문제를 생성기에서 보정했다. source-flow의 첫 late-local 음성 fixture는 Dart 자체가 확정 미초기화를 거부했으므로, 유효한 conditional late 초기화로 바꾸고 변환기의 미지원 거부를 별도로 확인했다. generated 파일을 수동으로 고치지 않았다.

**승인 경계:** 기존 delegate7개는 whole-source 비교까지 PASS. 이번 viewport5개는 strict/Root만 PASS이며 **전체 Dart 원본 비교, debug/exception/keepalive/reveal 경계는 아직 미완료**다. 이후9개 생성과 기본grid 연결·browser/공급/native 검증도 남아 있다. **기본2D 제품 소비0, W10-02·전체 계획 PARTIAL**을 유지한다.

## 8.15 2D viewport 원본 비교와 Core 경계 회복 — 2026-10-16 KST

§8.14의 **133개 입력·130개 receipt hash**가 모두 일치함을 확인했다. viewport의 **전체5개 선언과 ChildVicinity**를 수정하지 않은 pinned Dart로 실행하고, 생성 TS 및 실제 RN Babel 실행과 **4시나리오·mode당10 frame·양 assertion mode**를 비교했다. 실제 Core layout/geometry/소유권과 통제된 Element·paint·ScrollPosition cast receiver를 사용하며, Dart geometry는 독립 vector_math다. key 이동, row/column/reverse, keepalive 왕복, hole/resize, paint/clip/hit, reveal, 진단·listener 교체/해제를 비교했다. 이는 native 앱 실행 증거가 아니다.

실제 Root·ScrollPosition의 별도 **22건(debug/release)**에서 다음 Core 연결 문제를 수정했다.

- 화면 밖 보관 셀은 State를 유지하지만 pointer hit 후보에서는 제외한다. pinned 원본은 cache 셀의 과거 paint 위치를 hit하므로 reference oracle에는 그 동작을 그대로 남기고 제품 정책을 별도 검사했다.
- 보관된 keyed 셀을 활성 위치로 이동할 때 원본 active move 처리를 사용하고 이전 cache 참조를 제거한다. 이전에 보이지 않던 셀도 포함한다.
- layout 예외 뒤 반쯤 구성된 자식 트리를 정리하고 같은 offset/delegate로 재시도한다. 실패 전 자식 State 보존을 약속하지 않으며, 즉시 종료와 정상 재시도를 모두 검증했다. unmount/dispose는 source Map과 first/last 참조도 비운다.
- reveal은 descendant-local rect를 상위 좌표로 변환한다. 두 축 모두 이동하지 않는 경우 원래 subrect를 보존하고, offset 이동 완료 시점의 동기 Root 종료 뒤 두 번째 축 처리를 중단한다.

생성·strict, Core build, 정상 viewport Root6 및 원본/Babel 비교가 PASS다. 기존 wheel 공급 archive의 **48개 소비 source/JS 일치**를 재확인했다. compiler/frontend는 이 묶음에서 바뀌지 않아 이전14 recipe·15 output 동일성 증거를 유지한다. 새 viewport는 여전히 미소비 후보이며 기본grid/native 승인으로 확대하지 않는다.

남은 경계: 실제 listener 실행 중 외부 소유 ScrollPosition을 남긴 채 Root가 닫히면 closed scheduler 오류가 발생하는 probe가 있다. listener 안의 즉시 position dispose도 notifier 계약에 걸린다. 22건의 종료 검사는 **offset 완료 callback** 범위이며, 이 별도 소유권 문제는 실제 generated Scrollable 연결 때 해소해야 한다. source selection registrar 실패 회복과 공통 wheel reveal의 descendant 전달도 후속 검토 대상이다.

현재 전체21 중 **생성후보12·전체 원본 비교12**, source 비교 대기0, 나머지9개 생성/연결 대기, **기본2D 제품 소비0**이다. W10-02와 전체 W10은 PARTIAL을 유지한다.

## 8.16 ScrollableDetails 전체 생성과 설정값 경계 — 2026-10-16 KST

§8.15 checkpoint **137개 입력·138개 receipt** 이후, 기존 선택의 ScrollableDetails 전체 선언을 생성했다. 기존 수동 공개 클래스는 그대로 유지하며 생성 후보의 실제 Core ScrollController/ScrollPhysics identity를 검증했다. unnamed/vertical/horizontal 생성, reverse, deprecated clip 우선순위, nullable copyWith, subclass 동등성, hash 일관성, nested diagnostic helper와 final field 보호를 **8경우·Dart 양mode·RN Babel**로 비교했다. 플랫폼별 identity label과 실제 hash 숫자는 동일하다고 주장하지 않는다.

진단 helper의 String +는 기존 scalar 분류 때문에 adapter가 있어도 차단되었다. 정확한 resolved receiver adapter가 있을 때만 처리하도록 공통 변환기를 수정하고, 누락·잘못된 adapter를 거부하는 검증을 추가했다. vertical/horizontal의 **인수 없는 const 기본값**만 별도 canonical table에 허용했다. 다른 인수는 거부하며 downstream ScrollView의 실제 const 호출 연결은 후속 작업이다.

Compiler strict와 Core build, fresh **14 recipe** 전체 회귀가 PASS다. 기존15 output byte는 이전과 동일하고, 현재13개 후보 선언도 결정적으로 재생성되었다. delegate7/viewport5의 출력이 변하지 않아 앞선 source/Root 증거를 승계한다. 소비 archive48파일 일치도 다시 확인했다. 수동 공개 Details와 생성 후보의 교차 class identity나 기본2D/native 소비 승인은 하지 않았다.

남은 **8개**는 ScrollView1과 Scrollable/axis Widget·State·scope7이다. 원본 검토상 Core Scrollable의 gesture handler/state 저장소, chrome 구성, 두 축 ensureVisible 결과 전달을 명시적으로 연결해야 한다. 기존 Core static ensureVisible은 position을 직접 호출하므로 원본 inner-axis 결과에서 반환하는 다음 ancestor State를 반영할 hook이 필요하다. 단순 타입 cast나 수동 상태 전이 복제로 이 경계를 넘기지 않는다. listener 실행 중 Root/position 종료·selection registrar 실패 회복도 함께 검증한다.

현재 **21 IR·생성/원본 비교13·미생성8·기본2D 제품 소비0**, 전체 W10 PARTIAL이다.

## 8.17 전체2D 생성과 실제 두 축 Scrollable 연결 — 2026-10-16 KST

§8.16의 **143개 입력·146개 receipt hash** 일치를 확인하고 진행했다. 남은 ScrollView1 및 Scrollable/축 Widget·State·scope7의 **전체 본문을 생성**해 선택21개 모두 deterministic emission·strict 실제 Core binding을 통과했다. 원본 자체는 수정하지 않았다. 새8개 전체 Dart oracle은 아직 별도 미완료다.

Core Scrollable의 실제 gesture handler·설정·recognizer 저장소를 host 연결부로 사용하며, source inner-axis ensureVisible이 두 Future와 outer State를 반환하면 Core가 그 State부터 상위 탐색을 이어간다. chrome 구성도 override 가능한 경로로 분리했다. Pan factory는 실제 소유 Element의 gesture binding을 사용하고 constructor token/Map identity를 유지한다. source keyboard-dismiss callback의 FocusManager singleton은 해당 listener가 생성된 View의 실제 manager로 제한했다. 동일 Widget의 중첩 build/callback도 finally에서 이전 scope를 복원한다.

전체 generated closure를 유한100M-cell 시험 viewport와 실제 Root/ScrollPosition에 연결한 **28건(debug/release)**이 PASS다. 같은28건을 generated/adapter **18모듈의 실제 RN Babel 변환 결과**로 다시 실행했다. Core의 나머지 의존성은 현재 ESM build이며 Hermes/copied native 앱 증거가 아니다.

- 양축 직접 원거리 이동·bounded24 children·reverse/traversal, inherited lookup·독립 position, fallback→외부 controller 전환, main-axis primary 상속을 확인했다.
- 두 축 reveal의 중복 outer 호출 방지, 실제 wheel 신호, none/free/weightedEvent/weightedContinuous drag의 원본 축 전이를 확인했다.
- source constructor에서 인수 없는 vertical/horizontal const 기본값의 canonical identity와 final 보호를 실행했다. 두 View 동시 실행에서 keyboard dismissal이 원래 View에만 적용됨을 확인했다.
- position 및 activity notifier callback 중 동기 Root 종료, 중첩 알림 종료와 새 listener 등록 거부·참조 해제를 확인했다. §8.15의 실제 소유 ScrollPosition 종료 경계를 이 경로에서 해소했다. 외부 소유 position을 폐기하지 않고 닫는 임의 ScrollContext까지 보장하는 것은 아니다.

두 구현 오류를 재현해 수정했다. 마지막 빈 Dart switch case가 합성한 exhaustive-error default로 넘어가던 문제는 마지막 빈 case에서 switch를 종료하도록 고쳤고 독립 Dart 양mode/strict/RN Babel로 검증했다. ScrollPosition/소유 activity notifier는 알림 callback 중 종료될 때 소유권을 즉시 폐기하고 notifier 저장소는 현재 알림 stack이 끝나면 해제한다. 일반 ChangeNotifier의 dispose-during-notification 계약은 변경하지 않았다.

Core build·compiler strict·fresh14 recipe 및 기존15 output byte 동일성이 PASS다. 현재 host로 wheel facade17·전체 Widget12·renderer5, 공유 scroll43(nested8/action6/controls19/sheet10), delegate6·viewport lifecycle22가 PASS다. 새 switch 규칙에도 이전13 후보 출력은 변하지 않았다.

**공급 경계:** 이전 facade archive와50파일을 비교해46개 일치, Scrollable/ScrollPosition의 source/JS **4개 불일치**를 확인했다. 이전 Chromium/packed/copied Windows·Android 성공은 해당 과거 artifact의 증거로 보존하며 현재 변경의 승인으로 재사용하지 않는다. 현재 공급·browser/native 재검증은 source closure 최종 통합 후 수행한다.

현재 **전체21 생성·strict/Core/RN Babel 실행**, 원본 비교13·새8개 oracle 대기, 미생성0, **기본2D 제품 소비0**이다. 다음은 새8개 unchanged Dart oracle, selection registrar 실패 회복·reveal 종료 경계, 기본 finite grid 통합과 현재 공급 검증이다. W10-02 및 전체 W10은 PARTIAL이다.

## 8.18 전체2D 원본 비교와 첫 축 reveal 종료 — 2026-10-16 KST

§8.17의 **154개 입력·171개 receipt hash**가 모두 일치함을 확인했다. 남은 Scrollable7·ScrollView1과 이미 비교한 Details1의 **9개 선언 전체 본문**을 pinned 원본 그대로 실행하고, 생성 TS 및 RN Babel과 비교했다. 새로 완료한 선택은8개이며 전체 선택21개가 모두 원본 비교 범위에 들어갔다.

각 assertion mode에서 **축8시나리오 + View8시나리오**를 비교했다. 네 drag 모드×정방향/역방향의 down/start/update/end/cancel·axis lock, Pan 초기화, fallback controller 생성/교체/해제, widget/key/scope 구성, chrome, 두 축 reveal 결과·Future 목록, primary 상속/충돌, keyboard callback의 조건·null focus와 diagnostics를 확인했다. 원본/span hash와 전체 본문 보존을 검사하며, base gesture/position/primary/focus 수신부는 명시적인 fixture다. 실제 Core Root/RN Babel 입력·수명 증거와 구분한다. 초기 fixture의 generic factory 조회와 release diagnostics 수집 차이는 해당 host 계약에 맞춰 수정했으며 원본 본문은 바꾸지 않았다.

추가 실제 Root 검사에서 첫 축 ensureVisible listener가 Root를 닫으면 원본이 폐기된 두 번째 Scrollable.position을 읽는 오류를 재현했다. public dispatch 시작 시 두 축의 position과 실제 Element를 저장해 해당 동기 호출 동안 사용하고, Element가 닫혔으면 남은 reveal을 취소한다. Core의 상위 Scrollable 탐색도 종료된 State의 context를 다시 읽지 않는다. 원본 상태 전이 자체를 수동 재작성하지 않았다.

수정 후 **Root30건 및 동일 RN Babel30건(debug/release)**, Core build·strict 후보8, wheel facade17/Widget12/renderer5와 공유 scroll43(nested8/action6/controls19/sheet10)이 PASS다. 새 수신부를 적용한 원본 TS/RN Babel 비교도 다시 통과했다. compiler/frontend는 이 묶음에서 바뀌지 않아 앞선14 recipe 증거를 유지하며, 현재 전체21 후보의 deterministic 생성과 도구 hash를 재확인했다. 이전 archive 비교는 여전히 **50개 중46개 일치·공유 source/JS4개 불일치**로, 현재 browser/packed/copied native는 notVerified다.

현재 **21 IR·전체21 생성/strict/원본 비교·Core/RN Babel30건**, source 비교 대기0·미생성0·**기본2D 제품 소비0**이다. 남은 연결은 selection registrar의 add/remove/이전/dispose 예외 복구 정책과 실제 Core 검증, 기본 finite grid 통합, 현재 공급 검증이다. W10-02 및 전체 W10은 PARTIAL이다.

## 8.19 selection 예외 복구와 사용자 요청 중간 마무리 — 2026-10-16 KST

§8.18의 입력159개·receipt188개 hash 일치를 확인하고 시작했다. 원본 generated selection의 초기24개 fault 검사 중22개 실패를 재현했다. 전체 원본 메서드 본문은 보존하고 실제 Core keepalive 기반 host에 등록/해제·registrar 이전·dispose 예외 시 local listener/map/selection/keepalive 정리를 추가했다. parent proxy는 실제 Selectable과 원래 registrar receiver를 유지한다. 해제에 실패한 callback은 즉시 무효화하고 정확한 callback identity로 재시도하며, 이전 retry가 나중의 정상 재등록을 지우지 않는다. parent가 remove에서 예외를 던지면 외부 소유권 해제 여부는 확인 불가로 보고하며 무조건 재호출하지 않는다. local 정리와 외부 parent 해제 완료를 구분한다.

실제 Core ListView/sliver에서 before/after 실패, 선택 셀의 화면 밖 유지와 실패 후 해제, 이전/종료 drain, 지속 listener 해제 실패와 복구, null parent, parent.add 중 Root 종료를 debug/release **30건**으로 검증했고 RN Babel에서도 같은 **30건**이 PASS다. 이 검사는 listener 등록/해제 메서드와 registrar 실패 범위이며, 임의 selection-change callback 본문 예외 전체를 승인하지 않는다. 정상 delegate Root6, 전체7개 unchanged Dart/TS/RN Babel 원본 비교, deterministic 후보 생성·strict, Core build도 PASS다. compiler/frontend는 이번 묶음에서 변경하지 않았다.

실제 전체2D 연결에는 selection cell을 추가하여 화면 밖 keepalive와 selection-clear 후 State/listener/parent 해제를 확인했고 **Core32건 PASS**다. **확장한 전체2D RN Babel32건은 아직 실행하지 않았다.** 이전 전체 closure Babel30건은 과거 증거로 보존하며 현재32건 성공으로 계산하지 않는다. candidate 경계 설명은 마무리 시 metadata만 갱신했고 modules 설정 hash가 그대로임을 확인했다. 실행 당시 candidate는 receipt로 별도 보존한다.

사용자의 **“일단 작업마무리해줘”** 요청으로 추가 구현·검증을 중단한다. 현재 **전체21 IR/생성/strict/원본 비교, 기본2D 제품 소비0**, W10-02 및 전체 계획 **PARTIAL**, 실행 상태 **PAUSED**다. 기본 finite grid 통합·whole21 등록 batch의 재생성/수정/충돌/source gate·현재 browser/packed/copied native 검증은 남는다. 이전 archive50개 중46개 일치·공유 source/JS4개 차이의 증거는 과거 검사이며 이번 묶음에서 공급 재검증하지 않았다. 접근성과 native/HTML view 임베딩은 후속 범위를 유지한다.

재개 시 w10-middle-pause.json → progress/handoff와 입력·receipt hash를 먼저 확인하고, 전체2D Babel32의 미검증 경계 → whole21 batch 등록/보존 gate → 기본 finite grid의 controller/model/key remap/restore/input 연결 → 영향받는 browser/공급 검증 순으로 진행한다. 새로운 장기 실행 명령은 남기지 않는다.

## 8.20 전체2D 정식 batch와 기본 finite grid 연결 — 2026-10-16 KST

사용자의 전체 작업 재개 요청으로 §8.19의 PAUSED를 해제했다. 시작 HEAD `52b224c`, clean 작업 트리, 중단점의 progress/handoff/plan 및 **입력161·receipt201 hash 일치**를 확인했다. 기존 W9 기록은 증거로만 승계하고 현재 실행 지침은 W10을 따른다.

`w10-two-dimensional` recipe가 **21개 전체 선언·6개 생성 파일**을 소유한다. fresh IR·strict·전체 unchanged Dart/TS/RN Babel 비교와 실제 effective TS의 Core Root32·selection 복구30·기본grid18을 통과한 뒤 승격한다. 원본 비교도 batch IR/configuration/effective 의존성을 사용하며, controlled receiver import만 교체한 실제 effective 본문을 비교하여 보존된 사용자 수정을 건너뛰지 않는다. 하위 검증 fixture는 새 `validationInputs`로 fingerprint에 포함한다. 결정적 전체 재생성, 하위 fixture 변경, source hash 불일치, 사용자 주석 보존, rename 충돌 보존, 필수 source 비교 실패 차단의 **6개 batch 수명 검증 PASS**다. 복구 후 제품6개와 recipe 원본 byte를 확인했다.

기본 `TwoDimensionalScrollView`의 수동 Stack/layout·pan 상태를 source viewport/Element/양축 Scrollable로 교체했다. 고정 유한 셀 배치와 공개 controller/model, vector wheel·NeverScrollable 축 제한, 4096 셀 밀도 제한, 선택 wrapper 바깥의 model key, 기존 `x/y` 복원 이름은 명시적 facade/host 정책이다. 원본 abstract viewport가 요구하는 `layoutChildSequence`만 고정 셀 모델로 제공한다. 원본 generated 본문은 수동 수정하지 않았다. 원본 ScrollView가 생략한 restorationId는 반환된 Scrollable 설정에 연결하고 직접 source API의 원래 role 이름은 보존한다.

검증은 기본 Core18·RN Babel18, 전체closure Core32·RN Babel32, fresh 전체 source 비교·batch gate, Chromium6이 PASS-scoped다. 기본grid 검사는 1억 logical cell 직접 탐색, keyed State/편집기·reverse·양축 wheel/pan/cancel, 모델 축소/resize, legacy x/y snapshot, 빈 모델 초기 offset, NeverScrollable 대각 drag, 첫 축 callback의 Root 종료, 화면 밖 선택 셀 keepalive/해제를 포함한다. selection fixture는 local keepalive/listener 수명 범위이며 실제 문단 selection/reader를 뜻하지 않는다. 초기 추가 검사에서 NeverScrollable drag·빈 모델 초기 clamp 차이를 재현해 facade에서 보정했다. 밀도 오류는 builder 호출 전에 owner에게 보고하고 빈 source window로 정리한다.

현재 공급은 2D acceptance (보관된 과거 기록 `w10-two-dimensional-acceptance.json`)에 묶었다. 같은 Core/SDK archive의 **외부 NodeNext/ESM4조합, source/JS90개 일치, 복사 Windows/Android 각각25이벤트**가 PASS-scoped다. source grid identity·keyed 편집기·advanced cold restore·Windows exit0·Android Activity 종료, Android OS tap/EditText focus/Unicode/2x·0.5x bounds를 확인했다. sample/runner 원본5개를 복구하고 소유 server/emulator를 종료했다. 공유 scroll43·wheel17·양축 scrollbar5도 통과했다. 기본 Core18은 debug/release 각각 실행했고 RN Babel18은 release 실행이다.

Android 첫 빌드는 현재 GraalVM jlink의 androidJdkImage 변환에서 실패해 프로세스 한정 JAVA_HOME을 Android Studio JBR로 바꾸어 통과했다. 재포장 Core/SDK archive hash가 Windows/외부 consumer 입력과 동일함을 확인했다. 첫 에뮬레이터 실행은 SwiftShader Vulkan1.2에서 `No matching adapter found`로 실패했고, 동일 APK를 기존 검증의 Lavapipe Vulkan1.4로 실행해 통과했다. 실패 기록과 성공 기록을 구분해 보존했다. 이는 API33 에뮬레이터 자동화 범위이며 실제 물리 입력·FPS나 다른 OS native 검증이 아니다.

**기본2D source 통합·현재 공급은 scoped 완료**, W10-02 전체와 전체 계획은 PARTIAL이다. 선택 closure의 list delegate/error 같은 대안 경로는 별도 원본 비교로 확인했으며 기본 builder 장면이 모든 분기를 실행했다는 뜻은 아니다. 다음은 §8.21 tree 및 viewer·잔여 scroll/복원/성능 범위다.

## 8.21 tree 파트 전체 선택·초회 추출 — 2026-10-16 KST

`w10-tree.json`에서 pinned widgets/rendering `sliver_tree.dart`의 **11개 class/mixin/helper와 6개 타입 별칭 의존성**을 확인했다. source/파일 hash를 확인한 초회 추출은 **IR5·첫 장애6**, 제품 생성/소비0이다. `w10-tree-blockers.json`은 abstract-only generic mixin 선언, generic class의 mutable static 초기화, named record 타입/필드/평가 순서, private named-only generative constructor를 공통 장애로 분류한다. TreeSliverStateMixin의 7개 메서드는 모두 abstract 계약이며, 실제 동작은 전체 `_TreeSliverState` 본문에 있다. 각 원본을 부분 절단하거나 수동 상태 머신으로 대체하지 않았다.

다음은 named record → abstract mixin 계약·mutable static/constructor → exact varied-extent sliver/State/animation host 연결 순으로 실제 장애를 해소한다. 기존 TreeNode/TreeModel/TreeController의 immutable ID, keyed editor, 복원 API를 유지하는 facade를 검토한다. **이 절은 원본 선택·실제 추출 결과이며 tree 통합 완료가 아니다.**

## 8.22 tree 공통 언어 장애 해소·전체12 IR — 2026-10-16 KST

재개 시 현재 입력169개·receipt234개 hash를 확인했다. §8.21의 원본 선택에 실제 `TreeSliver.defaultTreeRowExtentBuilder`가 읽는 private `_kDefaultRowExtent` 상수를 추가해 **전체12개 선언**으로 확장했다. 6개 타입 별칭은 resolved type dependency로 유지한다. 현재 고정 원본 전체 추출은 **12 IR / frontend 장애0**이다. tree blocker (보관된 과거 기록 `w10-tree-blockers.json`)는 이전6개 장애 기록을 보존하고 후단 lowering/host 단계로 이동했다.

- **Named/mixed record:** 이름·위치 형태를 분리해 보존하고, 생성식의 실제 순서대로 필드를 평가한다. nullable chain·중첩 record·class generic 필드·객체 identity·예외 후 평가 생략·정확한 shape 거부·숫자 주석/checked integer를 검증했다. immutable named runtime과 생성18개를 Dart debug/release·strict TS·RN Babel에서 비교했다. 기존 positional 경로는 유지하며 named const/패턴/구조 동등성은 별도 진단으로 남긴다.
- **Abstract-only mixin:** 전체 abstract method 계약을 타입 전용 TS interface로 생성한다. generic 인수, required/named/default 호출 형태와 실제 구현체 동작을 검증했다. source7-method TreeSliverStateMixin에는 실행 본문이 없으며, `_TreeSliverState` 전체 본문을 대체하지 않는다. body/field/on/accessor mixin, interface runtime token, predicate 없는 covariant 검사는 거부한다.
- **Lazy static:** mutable/final static을 class owner별 첫 읽기 초기화로 보존한다. 초기화 전 쓰기·실패 후 재시도·초기화 중 쓰고 예외·유한 재진입·nullable 값·generic 클래스 공통 static과 RN Babel getter/setter 봉인을 Dart 양mode와 비교했다. static late, static 문맥의 class type parameter는 거부한다. 무한 재귀의 host stack 오류를 Dart VM 오류 class/frame 동등성으로 주장하지 않는다.
- **Private named-only constructor:** 가짜 unnamed 생성자를 만들지 않고 private TS constructor 및 runtime 거부를 제공한다. 실제 named entry는 원본의 선언/인수/필드/assert 순서와 정확한 prototype을 사용한다. private library identity·같은 owner의 const canonicalization·signed zero·일반 생성 분리, class 초기화 도중 const named entry와 RN Babel을 검증했다. named-only generated 상속·factory-only·generic named 생성은 미지원 진단으로 유지한다.

**검증:** compiler types/Dart analyzer/Core build PASS, 위 독립 원본 비교와 기존 positional/named/const 생성 회귀 PASS. **fresh15 recipe**의 strict·제품·원본 비교 PASS다. 이전 raw 생성물15개와 신규 등록2D6개, 합계 **21개 생성 출력 byte 동일**을 확인했다. 과거 manual/adopted 제품 보정은 그대로 보존한다. 생성 출력이 같은 기존 경로의 browser/native를 반복 실행하지 않았으며, §8.20 archive의 소비 source/JS90개가 현재도 일치함을 확인했다. 새 runtime2개는 아직 tree 제품에서 소비하지 않으므로 native 완료로 계산하지 않는다. 도구 fingerprint가 바뀌었으며 기존 promotion receipt를 새 fingerprint로 임의 재기록하지 않았다.

전체 tree 후보 (보관된 과거 기록 `w10-tree.json`)로 두 library 전체 본문 생성을 시도했다. 현재 첫 장애는 widget의 **generic content 문자열 변환 명시 경계**, rendering의 **정확한 ParentData superclass constructor binding**이다. 실제 Core 타입 경로만 연결했고 가짜 host/stub이나 부분 제품 파일은 쓰지 않았다. generic collection/record factory, State/ticker/mixin·varied-extent sliver/child manager, const host API 등 exact binding을 이어서 검토한다. **tree generated 제품 소비0, 전체 W10-02/PARTIAL**이며 12 IR을 제품 이식 완료로 계산하지 않는다.

현재 묶음 증거는 `.tmp/work8/w10-tree-language-session/result.json`과 progress/handoff의 immutable receipt를 따른다.

## 8.23 tree renderer 전체 후보와 실제 배치 장애 — 2026-10-16 KST

재개 시 입력177·receipt247의 hash를 확인했다. 전체12 선택을 유지하며 generic record collection·indexed null assignment·lexical scope 경계를 확장했다. renderer3은 **전체 본문 생성·strict·원본 비교 PASS**, 제품 승격은 **실제 Core FAIL 때문에 보류**다. W10-02와 전체 계획은 ACTIVE/PARTIAL을 유지한다.

- exact class type-parameter ID를 유지하는 named/mixed record Map factory와 명시적 문자열 변환을 추가했다. 서로 다른 클래스의 `T`를 구분하고 누락/중복/다른 매개변수·record shape를 거부한다. string-ID payload admission으로 한정하며 일반 Dart reified generic을 주장하지 않는다. Dart 양mode·strict consumer·RN Babel을 통과했다.
- `map[key] ??=`는 analyzer의 nullable getter와 nonnullable setter를 각각 보존한다. receiver/key/read 단일 평가·기존 값의 RHS 생략·재진입 RHS 쓰기 뒤 실제 setter·모든 단계 예외 순서12경우를 Dart 양mode/strict/RN Babel로 비교했다. 다른 compound index 연산은 계속 거부한다.
- 함수 본문이 같은 이름의 formal을 가리면 내부 block을 유지한다. 상위 클래스 private 메서드는 같은 library일 때만 override로 판정한다. tree 원본의 `itemExtent` 지역변수와 다른 library의 `_getChildIndexForScrollOffset`에서 확인했다.
- `TreeSliverNodeParentData`·`TreeSliverIndentationType`·`RenderTreeSliver` 세 선언과 record alias2개를 그대로 생성했다. 실제 Core varied-extent/parent-data/layer/paint bindings에 대한 strict 검사와 통제 superclass/paint receiver를 사용하는 독립 Dart 비교6시나리오24frame이 PASS다. root-zero·중첩 animation·cache·query/offset·indentation·clip handle 재사용/해제를 포함한다. 통제 receiver 원본 비교는 실제 Core 배치 승인이 아니다.
- 실제 Core fixture는 생성본·adapter·Map/record를 RN Babel에서도 실행했다. 일반 배치·hit·retained scene 기록과 animation 초기 frame 등 **8frame 통과 후 debug/release 두 animation 시나리오가 실패**했다. extent `[20,30,40,50,60,70]`, 자식1..3 animation=0.5, scroll=25에서 원본은 min index=5를 반환하지만 source offsets는 `[0,-40,-10,30,80,140]`이다. debug는 leading-offset 계약 위반, release는 hit 누락이며 Babel도 동일하다. source24frame의 Dart 결과에서도 index 계산을 재현했다. 이것을 NelyxContract PASS나 tree 완료로 바꾸지 않는다.
- 제품 generated file을 쓰지 않았다. runtime type fixture는 candidate effective tree에만 설치하고, 공개 TreeModel/TreeController/TreeView는 아직 연결하지 않았다. Widget9의 첫 후단 장애는 nested generic ancestor lookup이다. renderer 인덱스 보정과 sourceComparison 경계 기록 후 전체 Widget/State/ticker/ID facade를 연결해야 한다.
- compiler/analyzer·Core build와 fresh15 recipe를 확인하고 이전21 raw generated output·기존 공급 source/JS90 byte 일치를 검사했다. 과거 batch 승격 fingerprint를 새 compiler로 위조하지 않으며 새 tree helper의 native 승인은 주장하지 않는다. 상세 receipt와 현재 입력은 progress/handoff에 연결한다.

## 8.24 tree renderer 계약 보정과 nested generic lookup — 2026-10-16 KST

입력184·receipt260의 hash를 확인하고 §8.23의 실제 실패를 수정했다. **원본 generated3 전체 본문은 보존**하고, 별도의 reviewed `RenderTreeSliver` subclass와 paint adapter에 필요한 차이만 두었다. 원본 Dart 비교 PASS와 보정된 제품 후보의 계약 PASS는 서로 다른 결과다. Widget/State와 공개 facade가 아직 연결되지 않아 generated 제품 승격은 하지 않았다.

- 첫 자식 검색에서 부모 row의 범위를 먼저 판정하고, 각 animation segment의 접힌 거리는 후속 rows에 한 번만 적용한다. 빈 tree는 index0으로 유지하며 Core varied-extent와 같은 100만 query 상한을 둔다. 원본의 반복 차감 실패와 원본 그대로의 Core/Babel FAIL receipt는 이력으로 보존한다.
- 원본의 layout 좌표 clip을 paint 시 scrollOffset만큼 옮기고, 같은 parent 구간을 hit-test에도 적용해 가려진 자식이 부모 입력을 받지 못하게 했다. paint scope는 중첩/예외 후 이전 값을 복원한다.
- 작은 cache 창 밖에서 네 노드가 함께 애니메이션하면 미계산 offset을 읽는 추가 실패를 실제 Core 양mode/Babel에서 재현했다. 실제 paint 자식을 소유하는 직전/현재 구간만 선택하도록 보정했다. source의 전체 animation/layout map은 변경하지 않으므로 누적 배치 offset은 보존한다.
- corrected candidate는 실제 Core 및 RN Babel에서 일반·root·중첩·다중 animation, 짧은 cache, scroll, 빈 tree **각26frame PASS**다. 독립적인 row trailing-edge geometry와 inverse 결과를 비교하고, 부모 입력·viewport clip 좌표·retained scene·animation 종료 및 중첩 paint 예외 복원을 검사했다. 검증용 먼 위치 query가 실제 paint나 다음 frame의 cache를 미리 채우지 않도록 paint 후 별도 cache 복원 범위에서만 수행한다.
- raw 전체3/alias2의 strict·독립 Dart 양mode24frame 비교도 유지했다. strict에는 correction subclass까지 포함한다. corrected 동작 자체를 raw source와 동등하다고 표시하지 않는다. 현재 근거는 renderer/Core/Babel 범위이며 public TreeView·브라우저 픽셀·native application 승인은 아니다.
- closed generic method specialization이 nested nullable interface 인수를 exact resolved ID로 비교하도록 확장했다. `Shelf<String?>`의 독립 Dart/strict/RN Babel 및 잘못된 specialization 거부를 확인했다. class parameter/dynamic 임의 특수화는 계속 차단한다. TreeController의 실제 ancestor lookup 경계와 foundation diagnostics/Core Stateful host를 연결하여 Widget9의 다음 장애를 AnimationStyle const canonicalization으로 좁혔다.
- compiler/Core build·fresh15 recipe PASS, 이전21 raw output·기존 공급 source/JS90 byte 동일을 재확인했다. 기존 정상 경로의 공급 근거를 재사용하되 새 미소비 tree 후보의 native 승인으로 확대하지 않는다. 다음은 Widget9 전체 본문 생성·State/ticker/collection/default builder·ID facade 연결과 원본/Root/공급 검증이다.

## 8.25 tree 전체12 생성·Widget 원본 비교·Root 수명 — 2026-10-16 KST

입력186·receipt270의 hash를 확인했다. `TreeSliverNode`·mixin/controller·TreeSliver/State·ParentDataWidget·Sliver와 상수, renderer를 포함한 **두 라이브러리12개 전체 본문이 생성·strict 검사에 통과**했다. 공개 TreeView는 아직 기존 경로이고 생성 제품 승격은0이다.

- generic State/mixin 결합을 exact resolved parameter ID로 검증하고, 선택 recipe에서 암묵 `Object?` bound를 보존한다. analyzer의 실제 override origin을 IR에 보존하여 type-only mixin은 `implements`로 검사하고 실존 superclass method만 TS `override`로 표시한다. exact generic covariance host admission은 String-ID 범위를 검사하며 임의 Dart VM reification을 주장하지 않는다. 독립 `generic-state-contract.ts`가 Dart 양mode/strict/RN Babel과 거부 조건을 통과했다.
- 실제 Core의 Stateful/Ticker State·ParentData/Sliver Element·diagnostics·List/Map/record·animation·Widget constructors를 연결했다. const AnimationStyle/EdgeInsets/spacer와 선택된 Unicode arrow(0x25BA,14px)의 canonical host 경계를 제공했다. 화살표는 Core Text/Center/SizedBox/AnimatedRotation으로 실행하며 일반 Icon/IconTheme 전체 구현으로 표시하지 않는다.
- unchanged Widget9+원본 alias를 독립 Dart의 통제 framework/animation receiver와 실제 Core Root에서 비교했다. 각 mode11개 상태의 node parent/depth/active index, expand/collapse-all, callback, delegate/semantic/repaint/extent, 기본 부모/leaf 행의 constructor graph/arrow 속성, 직접 animation value 변화·controller 이전이 일치한다. renderer3의 raw Dart24frame도 다시 통과하여 전체12의 원본 비교를 확보했다.
- 원본의 즉시 nested collapseAll은 debug에서 부모를 먼저 접은 후 비활성 자식을 토글하여 assert한다. 이 mode 차이를 Dart 비교에 그대로 남겼다. 실제 Root에서는 callback 동기 종료 후 widget 접근과 animation 도중 noAnimation 전환 시 자식 잔류도 재현했다. raw FAIL을 보존하고 별도 reviewed Widget/State subclass에서 owner 종료 fence·animation 해제·제거 node 정리·즉시 child-first collapse·bulk toggle 중 종료·dispose 참조 정리를 보정했다.
- corrected 후보는 actual Core Root16·RN Babel16 PASS다. 단일/중첩 즉시 토글, 애니메이션 반전, controller/State 이전, 모델 node 제거, callback/bulk Root 종료, animation 비활성화, 기본 행과 실제 포인터 화살표 토글을 포함한다. Source Tree State identity 근거이며 **행별 State/key 보존과 공개 immutable-ID TreeView 통합은 별도**다. 원본9의 통제 Dart animation receiver를 실제 OS 입력이나 native 공급 증거로 확대하지 않는다.
- compiler/analyzer·Core build·fresh15 recipe PASS. 기존21 raw output와 qualified archive source/JS90 byte가 동일하다. tree renderer 보정26·raw24도 현재 compiler/host에서 재검증했다. 자동 승격 fingerprint와 기존 receipt는 보존했다.

다음은 source ParentData wrapper를 통한 row key 전달, immutable-ID TreeModel/TreeController의 동기 index·복원/reveal·종료를 실제 source State/renderer에 연결하고 정식 batch/effective gate를 등록하는 일이다. source의 중첩 animated descendant 범위 등 아직 검사하지 않은 animation 조합도 공개 source 범위 확정 전에 확인한다. 기존 정상 TreeView의 계약을 작은 후보 테스트로 대신하지 않는다.

## 8.26 tree 공개 facade·정식 batch·브라우저 — 2026-10-17 KST

입력191·receipt283의 hash를 확인하고 시작했다. 기존 immutable-ID TreeView를 **두 라이브러리12개 전체 source 선언**의 Node/State/Sliver/renderer 경로에 연결하고 정식 batch로 승격했다. 전체 W10-02 완료는 아니며 현재 패키지/native 공급은 후속 검증 대상이다.

- TreeModel의 임의 payload는 기존 immutable 모델에 유지하고, source Node에는 안정적인 ID만 연결한다. source의 전체 unpack traversal이 active rows를 소유하고 파생 index cache로 동기 visibleIndex/reveal을 제공한다. 기존 수동 ListView flatten 경로는 제거했다. 공개 API의 고정 행 높이·즉시 토글 계약과 restoration/reveal/callback 수명을 유지한다.
- source ParentData host가 원래 row key를 로컬 wrapper로 전달하고 findChildIndexCallback에서 복원한다. GlobalKey 중복 소유 없이 원래 행 State를 유지한다. 기존11 계약에 로컬 키 State 이동, RTL/소수 행 높이 변경, 원거리 scroll 후 empty/repopulate를 추가했다. 실제 source State/renderer 확인까지 Core16·RN Babel16 PASS, 현재 compiled 공개 계약14 PASS다.
- 고정 extent를 명시 등록한 공개 facade만 animation이 없을 때 상수 시간 inverse 경로를 사용한다. 소수 extent 경계와 1만 자식의 원거리 seek를 debug/release에서 확인했다. 각38 extent query·23 materialized children이며, 기존 lazy/reveal 계약은38개 State 생성 범위에서 통과했다. wall-clock seek 값은 관찰값이고 물리 FPS 증거가 아니다.
- full12 원본을 다시 생성해 덮는 대신 **병합된 effective 파일**을 Root/renderer/facade 및 독립 Dart gate가 소비한다. raw Widget9 양mode11-state·renderer3 양mode24-frame 비교를 유지하며, reviewed State/renderer 보정과 sourceComparison을 분리한다. source 후보의 중복 host fixture는 제품 source로 일원화하고 이전 bytes는 scratch 이력에 보존했다.
- validationSources가 소비자 facade와 전이 의존성을 fingerprint에 포함한다. 같은 이름의 Widget/renderer 생성 파일은 목적지 경로별 patch로 보존한다. 전체 재생성, 하위 fixture/소비자/source drift, 경로 거부, 주석 보존, 서로 다른 patch, 의미가 깨진 effective 수정 거부, rename 충돌, 필수 원본 비교 실패 차단을 묶은9건이 PASS다. 의도적 실패 receipt는 보존하고 제품/recipe는 원복했다.
- Core ESM/declaration 및 compiler typecheck PASS. fresh16 recipe/23 raw output 검증이 통과했고, 이전21 fresh 출력은 byte 동일하며 새 tree2는 제품과 일치한다. 이전6개 제품의 과거 승격 본문과 최신 generator 출력 차이는 유지하고 임의 재승격하지 않았다. Chromium6 PASS에서 기본 source tree renderer와 편집기 Core/DOM identity·부모·geometry·focus/composition 유지 및 해제를 확인했다. 합성 DOM 입력은 실제 IME 검증이 아니다. 이전 native artifact를 현재 tree 공급 승인으로 재사용하지 않는다.

다음은 같은 archive를 사용하는 외부 소비자·복사 Windows/Android 공급을 갱신하고, nested animated descendant의 남은 조합과 viewer 전체 source closure를 진행한다. 공개 fixed facade 통과가 full animated source API나 W10 전체 완료를 뜻하지 않는다.

## 8.27 tree 현재 패키지·복사 native 공급 — 2026-10-17 KST

입력201·receipt301의 hash를 확인하고 시작했다. §8.26 제품 source와 동일한 Core/SDK archive를 외부 소비자와 복사 Windows/Android에 공급했다. tree acceptance (보관된 과거 기록 `w10-tree-acceptance.json`)는 **기존 고정 immutable-ID facade의 현재 공급 PASS-scoped**이며 전체 animated source API/W10 완료는 아니다.

- tree의 전체 generated Widget/renderer, reviewed State/renderer, ID facade·key host와 record/static/collection 런타임26개 source/JS 파일을 설치 검사에 추가했다. 기존 wheel/2D 및 SDK를 합친116개 파일이 현재 source/JS와 동일한 archive bytes다. 양 target에 설치된 tree26개도 각각 일치한다.
- 같은 archive의 repository-external NodeNext strict declaration/ESM 소비자4조합 PASS다. generic TreeModel payload·TreeView 구성·단일 Core identity 및 실제 설치된 tree26파일을 확인했다. package 소비와 native 실행 근거는 별도 기록한다.
- 복사 Windows Release EXE 및 Android x86_64 Release APK가 각각25이벤트 PASS다. 기본 tree의 실제 generated renderer 식별, 펼침 전후 editor index1→3→1·field State/geometry 유지와 기존 source wheel/2D/viewer 흐름을 확인했다. cold process 재실행은 기존 wheel index44/Unicode 복원 시나리오다. tree 전용 native cold restoration을 검증했다고 표시하지 않는다.
- Windows는 정상 exit0, Android는 실제 설치 APK hash 일치·Activity 종료와 OS tap 후 실제 EditText bounds/focus/Unicode 변화를 확인했다. 양쪽 모두 active motion 종료와 editing binding 해제가 균형을 이룬다. Android는 전용 headless emulator/Lavapipe이며 물리 IME/caret pixels·FPS 근거가 아니다.
- Android Studio JBR을 해당 빌드 프로세스에서 사용해 양 target을 한 공급 묶음으로 완료했다. 샘플 entry와 runner manifest/lock5개의 원래 hash를 복원하고 임시 fixture3개를 제거했다. 소유 서버·emulator를 종료하고 현재116파일·batch lock/source 분석 설정 부재를 재확인했다. 공유 adb/다른 Gradle process는 종료하지 않았다.

다음은 source의 nested animated descendant 범위·남은 animation 조합을 실제 State/renderer에서 검증하고 viewer 전체 closure 및 잔여 파트를 진행한다. 현재 공급 승인을 이후 제품 변경에 자동 적용하지 않는다.

## 8.28 tree 중첩 animation 범위·이동·clip 보정 — 2026-10-17 KST

입력203·receipt312 hash를 확인하고 시작했다. 실제 source State/renderer에서 부모 범위가 활성 손자 행을 빠뜨려 tail 위치120(expected100)이 되는 문제와, 부모 접힘 완료 뒤 자식 animation index가 이전 목록을 가리키는 문제를 재현했다. 초기 FAIL과 3단계 합성 FAIL을 보존하고 **원본 generated12개는 변경하지 않은 채** 별도 reviewed State/renderer를 보정했다.

- State는 원본 unpack이 만든 depth/active 목록으로 전체 후손 구간을 잡고, root unpack 뒤 index/range를 갱신한다. 비활성 node의 animation은 root 행을 가리키는 범위를 만들지 않는다. 원본 traversal/controller/ticker 상태 전이는 그대로 사용한다.
- renderer는 원본이 처음 정한 cache 제한 이동 prefix를 보존하고, 포함된 각 후손의 접힘 이동량을 한 번씩 빼서 조상 이동량을 계산한다. 3단계에서 직계 자식만 빼면 손자의 이동이 중복되므로 모든 포함 구간을 memoized 합성한다. active 구간이 이동하면 이전 topology의 cache를 버린다. ordinary 값 변화/스크롤에서는 원본의 고정 이동 prefix를 유지한다.
- 원본 painter가 traversal·clip layer 소유/종료를 담당하고, 보정 경계는 각 내부 segment의 clip/hit를 모든 조상의 trailing edge 아래로 제한한다. 뒤집힌 clip 구간은 빈 영역으로 처리하며 paint scope는 중첩/예외 뒤 이전 상태를 복원한다.
- 실제 Core26·RN Babel26 PASS: 부모/자식 선후 종료, 겹침·3단계, 가변 extent, 작은 cache, 부모가 cache 밖으로 이동했다 돌아오는 흐름, 자식 삽입, 반전/bulk 토글과 실제 ticker 완료를 포함한다. 독립 subtree-height/range/parent-hit 계약을 검사한다. ticker 완료는 source simulation의 strict duration 초과 조건을 따른다. CPU CanvasKit replay는 실행 근거이며 물리 pixel/FPS 비교로 확대하지 않는다.
- 기존 Root/Core·Babel 각각16·renderer26·facade/Core·Babel 각각16 및 raw Widget9 양mode11-state/renderer3 양mode24-frame source 비교도 통과했다. 원본12 본문 hash는 유지된다. 공개 RTL 검사의 Point 좌표 필드를 x로 바로잡았으며, 현재 compiled 공개 계약14·Chromium6이 통과했다. 수치 override4개의 주석은 generated 원본의 resolved provenance를 그대로 보존하여 제품 TS와 공개 d.ts에서 비교했다. 주석 보강 전 Babel26 실행과 최종 runtime3파일의 executable Babel bytes도 동일하다.
- 중첩26 검사를 정식 effective batch gate와 fingerprint 입력에 추가했다. 검토용 host overlay는 hash를 확인해 격리 복사하고, 정식 batch effective 입력을 덮을 수 없게 차단한다. 최종 Core 빌드·batch 원본/제품 gate PASS 후 동일 archive 외부 소비4·source/JS116·복사 Windows/Android 각25이벤트를 다시 통과했다. native 검사는 기존 fixed TreeView 경로이며 중첩 animation의 native timing 검사가 아니다. 샘플/runner5 원복과 소유 서버/emulator 종료를 확인했다.

다음은 InteractiveViewer의 전체 source/dependency closure다. tree 전용 native cold restoration, 임의 custom/nonmonotonic curve·추가 source API의 native animation timing과 물리 IME/FPS는 별도 미검증 경계를 유지한다. 현재 공개 TreeView의 고정 행 높이·즉시 토글 API를 이 미검증 API로 바꾸지 않는다.

## 8.29 Viewer 전체 선택·lazy late 및 scalar OR 지원 — 2026-10-17 KST

입력204·receipt340 hash를 확인하고 Viewer 전체 source closure를 시작했다. pinned interactive_viewer.dart의 Widget/State/Built/TransformationController·두 enum·private helper까지 **14개 전체 선언과 builder alias**를 선택했다. 초회10/14 추출·4개 차단에서 lazy late와 scalar OR 문장 규칙을 확장하여 **12/14 IR 추출·enum2 차단**으로 진행했다. 아직 Viewer 생성·제품 소비는0이며 전체 이식을 완료로 표시하지 않는다.

- late 지역 변수는 analyzer의 local declaration identity와 실제 declaration offset으로 구분하고 lexical accessor cell로 생성한다. 초기화 전 읽기, final 재쓰기, nullable 값, closure 캡처·변수 가림·반복문 본문별 scope를 보존한다. 변수 이름/값으로 타입이나 binding을 추정하지 않는다.
- 초기값을 가진 instance late field는 생성자에서 평가하지 않고 getter의 최초 읽기 때 평가한다. 명시적 쓰기로 초기값 생략, 실패 후 재시도, 성공/실패 중 재진입 쓰기와 bounded 재귀를 독립 Dart 양mode·strict·RN Babel26개 관찰값으로 확인했다. named constructor의 lazy getter는 원래 class member identity를 사용한다. static late와 late loop header는 계속 명시적으로 차단한다. VM stack 한계 동등성은 검증 범위가 아니다.
- Viewer에서 발견된 case rotate || null은 기존 scalar/enum/null constant alternative 규칙을 switch 문장에도 적용했다. scrutinee 단일 평가·선택 body·break·nullable exhaustive domain을 source-flow에서 비교했다. guarded/binding pattern은 계속 차단하며 기존 switch expression 비교도 통과했다.
- 필요한 Quad 및 Quad.copyTriangles의 Triangle은 기존 Core에 없어 vector_math2.4.3의 전체 class dependency로 추가 선택했다. 기존 Vector3/Matrix4와 같은 package pin, cache archive hash stamp와 실제 source bytes를 기록했다. 외부 package root를 허용하는 정식 pin-bound extractor 지원이 필요하며 framework root 제한을 우회하지 않았다. 두 외부 선언은 아직 추출 전이다.
- frontend Dart analyzer·compiler TypeScript·Core build PASS. 정식16 recipe를 새 IR에서 격리 재생성해 strict·각 제품 계약·원본 비교를 통과했다. 생성23파일이 이전 fresh 결과와 byte 동일하다. 과거부터 product 보정이 있는6파일은 그대로 유지하고 재승격하지 않았다. Tree12 IR 캐시만 최신 frontend로 갱신했다.
- 기존 archive 비교 대상 source/JS116은 모두 현재와 일치한다. 추가한 lazy runtime 함수는 이116 밖이며 현재 Viewer 제품에서 소비하지 않는다. 새 함수의 RN Babel 검사는 native 앱 공급 증거가 아니며, 이전 archive 전체가 새 Core 빌드와 같다는 주장도 하지 않는다.

다음은 source enum2 및 pinned Quad/Triangle 전체 추출·생성, 실제 Core binding, 독립 Dart 비교와 기존 Viewer facade 통합이다. source controller의 mutable Matrix4와 공개 copy-on-read, source minimum-scale/boundary와 공개 centering 차이는 명시적 경계에서 보존·검증한다. Viewer blocker (보관된 과거 기록 `w10-viewer-blockers.json`)에 source·의존성·진척과 다음 단계를 기록했다.

## 8.30 Viewer enum·잠금 외부 소스 지원, 전체16 IR — 2026-10-17 KST

입력207·receipt354 hash를 확인하고 이어서 진행했다. 단순 enum 두 개와 vector_math의 Quad/Triangle 추출 경계를 구현하여 **Viewer14 + 외부2 = 전체16 선언 IR 추출, frontend 장애0**까지 진행했다. builder alias1과 실제 Core binding·생성·batch 통합은 남아 있으며 제품 소비는 아직0이다.

- enum은 analyzer가 확인한 선언·상수 ordinal·dart:core Enum.index의 int provenance로 생성한다. 선언마다 고유한 인스턴스, 읽기 전용 values 목록, source name/index/toString을 보존하고 class rename 뒤에도 원본 문자열을 유지한다. 숨겨진 생성 token과 private nominal 타입으로 임의 생성·다른 enum의 구조적 대입을 막는다. instance/list/class는 불변이다.
- 독립 Dart 양mode·strict·RN Babel10개 관찰 묶음에서 identity, 순서, private member, 기본 인자·상수 초기화, nullable equality, exhaustive switch를 비교했다. strict 부정 대입/생성/수정과 runtime 불변성도 검사했으며 공개 d.ts의 index 수치 주석을 확인했다. RN preset이 declare field를 받지 않는 문제를 고쳐 현재 설정으로 통과했다. enhanced enum과 JS static 충돌 이름은 명시적으로 차단한다.
- 외부 추출은 package URI와 도구 pubspec.lock의 hosted package 이름·버전·archive hash를 함께 검증한다. 소속 library hash와 각 source hash를 확인하고, 같은 analysis session에서 해당 library의 실제 part만 선택한다. 경로·symlink의 package library 탈출을 차단하고 기존 framework root 보호를 유지한다. 잠금 YAML 파싱을 위해 기존 전이 의존성 yaml3.1.4를 같은 버전의 직접 의존성으로 등록했다.
- 실제 vector_math2.4.3 Quad/Triangle의 전체 본문과 공유 library-private field 참조를 추출했다. package-source9건은 정상 추출1건과 pin 누락·version/archive/source/library hash 불일치·경로 탈출·다른 package library·소속되지 않은 source 등8거부를 확인했다. 실패 시 부분 IR을 쓰지 않고 소유 analysis config도 제거한다. Windows 경로 표기 차이는 정규화된 경로 동등성으로 처리한다.
- frontend analyzer·compiler 타입 검사 PASS. 기존 정식16 recipe의 새 생성·strict·제품 계약·원본 비교 PASS, 생성23파일은 이전 fresh 결과와 byte 동일하다. 기존 제품 보정6파일과 batch 승격 상태는 유지했다. Tree12 캐시만 최신 frontend로 갱신했고, 기존 archive의116 source/JS도 일치한다. 이번 변경은 compiler/extractor이며 Viewer 제품·native acceptance를 새로 주장하지 않는다.

다음은 전체16의 Core binding과 생성·원본/제품 검증이다. 외부 package를 허용한 것은 현재 **추출 경로**이며 정식 batch source loading/fingerprint까지 완료한 것이 아니다. 이를 연결한 뒤 Viewer facade·browser/package/native 공급을 진행한다.

## 8.31 Viewer 전체16 생성·strict·실제 Root 후보 — 2026-10-17 KST

입력211·receipt363 hash를 확인한 뒤 전체16을 모듈 단위로 생성했다. 먼저 Quad/Triangle2는 strict에 통과했고 Viewer14는 host superclass에서 막혔다. 실제 Core Widget/State/ticker·Matrix4/Vector3·gesture/animation identity에 명시적 adapter를 연결하고 다음 언어 장애를 해결하여 **전체16 생성·strict PASS**에 도달했다. 생성물은 격리 후보이며 제품 공개 Viewer는 아직 기존 구현이다.

- exact constructor specialization을 중첩된 monomorphic interface까지 확장했다. GlobalKey<State<StatefulWidget>>처럼 모든 타입이 결정된 입력을 qualified ID·각 단계 nullable까지 비교한다. 독립 Dart/strict/RN Babel에서 identity와 nullable nested 인자를 검증하고 다른 타입·중복/누락 매핑·해결되지 않은 type parameter는 거부했다.
- nullable function의 .call을 analyzer의 FunctionType으로 식별하여 함수 호출로 생성한다. receiver/getter 한 번 평가, null이면 argument/body 생략, named argument 순서, void/number 반환, 예외 및 전체 selector chain을 Dart 양mode·strict·RN Babel11건으로 비교했다. dynamic call을 이름만 보고 함수로 취급하지 않는다.
- strict 검사에서 Offset에 JavaScript 단항 -가 적용된 문제를 발견했다. frontend가 연산자 element identity를 보존하고 nonnumeric unary minus는 정확한 adapter를 요구하도록 수정했다. 실제 Offset.negate로 연결했으며 독립 Dart/strict/RN Babel에서 한 번 평가·값 identity·일반 숫자 negation 및 매핑 누락 거부를 확인했다.
- Quad/Triangle 전체 본문2는 실제 Core Vector3/Matrix4와 연결하여 원본 vector_math2.4.3 Dart 양mode·strict·Core/RN Babel19개 관찰 묶음에서 비교했다. 복사/별칭, normal, transform/translate, triangulation, equality/NaN/signed-zero/string을 포함하며 Babel은 전이13모듈을 실행했다. Object.hash는 기존 안정적인 local hash로 연결하며 VM seed integer 자체가 아닌 같은 값의 hash 일관성을 검증한다.
- 실제 CanvasKit/Core Root6 및 RN Babel6 PASS: debug/release source controller의 live matrix·값 동등성, 전체 generated Widget/State의 실제 wheel 확대·callback 순서·종료, builder의 generated Quad 전달·owned controller 종료를 확인했다. source 반환 Size와 Core geometry 값, nullable GlobalKey context, event matrix, constructor options는 명시적 변환 경계에서 연결한다. 기본 ClipRect는 clipBehavior를 지원하는 실제 Core clip widget을 사용한다.
- frontend analyzer·compiler 타입 검사, 기존 callback-cascade/renderer-language 및 정식16 recipe strict·제품/원본 gate PASS. 기존 생성23파일은 이전 fresh 결과와 byte 동일하며 제품 보정6파일과 batch state를 유지했다. Tree12 캐시는 최신 frontend로 갱신했다. 제품 코드 변경이 없어 기존 archive116 source/JS도 일치한다.

다음은 Viewer14 전체 원본 Dart 비교와 pan/pinch/inertia·bounds/rotation·callback 수명 등의 실제 Root 범위 확대다. 이후 external package의 정식 batch/fingerprint·수정 보존을 연결하고 공개 finite facade의 copied matrix·coalesced notification·animateTo/cancel·resize·복원·editor 계약을 통합한다. 현재 Root6은 그 전체 계약의 완료 근거가 아니며 browser/native 공급도 아직 기존 제품 경로의 증거다.

## 8.32 Viewer 전체 원본 비교28·실제 recognizer Root10 — 2026-10-17 KST

입력220·receipt382 hash를 확인하고 Viewer14의 원본 본문 전체와 builder typedef1을 수정 없이 Dart library로 구성했다. math2는 기존 원본 비교19를 재사용한다. **Viewer14 + math2 전체16 source closure의 비교 근거**가 갖춰졌으며 생성16/strict 후보는 그대로 유지한다. 공개 제품 경로로 승격한 것은 아니다.

- Dart oracle은 pinned Viewer의 14개 전체 선언·원본 alias를 사용한다. vector_math/listen은 실제 잠금 패키지를 사용하고 FrictionSimulation·_newtonsMethod·Simulation·Tolerance도 pinned 원본 본문 그대로 포함한다. UI 값·Widget 수명·animation clock receiver는 제어 가능한 시험 경계다. 반대편은 실제 Core Root·레이아웃·ticker이며 이 비교를 Flutter 엔진 전체 동등성으로 확대하지 않는다.
- debug/release 각각28개 입력 전환을 실제 Core 및 source RN Babel에서 원본 Dart와 비교했다. nearest point/quad/회전 AABB, 경계 translation·scale clamp·rotation helper·debug zero-scale assertion, negative zero/9자리 round, pan→pinch·축 제한, wheel/변환 trackpad/scale signal, enabled flag, 완전 무한 margin, pan/scale inertia 중간/종료 tick, controller 교체·owned 전환, builder 생성 graph·viewport resize를 포함한다. source controller는 live Matrix4/동기 알림을 그대로 사용한다.
- 네 비교 결과(Core/Babel × debug/release)의 관찰된 유한 숫자 차이는0이었다. 이는 시험 입력의 결과이며 모든 숫자·장치·렌더링의 bitwise equivalence 주장은 아니다. source의 debug zero-scale rejection과 release 계산 차이도 각각 비교한다.
- 변환된 trackpad 입력은 constructor에 transform을 붙이는 방식이 아닌 실제 Core PointerEvent.transformed 경로로 수정했다. PointerScrollEvent constructor에는 그 옵션이 없으므로 잘못된 시험 입력을 제품 결함으로 분류하지 않았다. 실제 변환 getter와 source delta 보정은 이후 원본과 일치했다.
- 기존 실제 Root 검사를 Core10·RN Babel10으로 확장했다. 구체적인 touch down/move/up 이벤트가 실제 recognizer를 지나 source pan inertia ticker를 시작하고, 실제 두 pointer가 같은 source State에서 pinch를 수행하며, 활성 ticker·owned controller가 Root 종료 시 정리되는 것을 확인했다. 기존 live-controller·wheel·builder 검증도 유지한다. cancel 시 공개 facade의 잔여 fling 억제와 reentrant 사용자 callback 종료는 이후 제품 계약에서 검증한다.
- 이번 단계는 검증 harness/문서 변경이며 compiler·generated16·제품 경로는 바뀌지 않았다. 이전16 recipe 회귀/생성23 보존 근거를 재사용하고 기존 archive116 source/JS 일치를 확인했다. 새 Core build나 native 공급 PASS를 추가하지 않았다.

다음은 외부 package 모듈의 정식 batch source/fingerprint·effective 수정/충돌 보존을 연결하는 것이다. 이후 공개 finite Viewer의 복사형 matrix·coalesced notification·animateTo/cancel·resize anchoring·복원·editor·callback 수명 계약을 source facade로 연결하고 browser/package/native 공급을 갱신한다.

## 8.33 Viewer 외부 package 정식 batch·source16 승격 — 2026-10-17 KST

입력224·receipt393 hash를 확인하고 외부 package 모듈을 정식 batch에 연결했다. **17번째 recipe w10-viewer가 내부 generated3파일/전체16 선언을 승격**했다. 실제 adapter2도 제품 source로 정리했다. 이는 source 계층의 승격이며 공개 finite Viewer facade는 아직 기존 구현이다.

- package source URI는 도구 lock의 이름·version·archive hash, 실제 manifest·선택 source hash·owning library hash를 확인한다. 선택 패키지의 lib 안 Dart source tree 전체를 fingerprint에 포함해 선택하지 않은 Vector3 같은 의존 코드가 바뀌어도 이전 승인을 재사용하지 않는다. 현재 vector_math73파일을 hash하지만 생성 대상은 Quad/Triangle2개다. 원본 oracle이 쓰는 listen/meta도 reference package로 fingerprint한다.
- Dart frontend가 같은 analysis session에서 실제 소속 library/part와 private identity를 다시 검증한다. 승격 origin에는 package pin·library·source hash를 남긴다. inventory-plan은 원래 inventory의 vector_math library/component에 두 part 선언을 연결하고 전체17 recipe·Viewer16 selection을 표시한다. 라이브러리 전체나 미선택 API를 완료로 바꾸지 않는다.
- Viewer gate는 batch context에서 fresh IR과 실제 effective generated/host 파일을 복사하여 그대로 소비한다. 이 경로에서 재생성하거나 후보 fixture로 덮어쓰지 않는다. Core/Babel 실제 recognizer10, Viewer14 원본 양mode Core/Babel28 및 math2 source19가 필수 gate다. source gate 실패는 Core 계약 PASS여도 commit을 막는다.
- package filesystem/fingerprint11건과 실제 batch lifecycle12건 PASS: 다른 cache root에서 동일 identity, 비선택 의존 파일 변경, pin/path/link·library mismatch 거부, host/fixture 변화, generated3파일 각각의 사용자 수정 보존, 실제 toScene 오염 검출, 겹치는 enum rename 충돌, 필수 원본 비교 실패 차단을 확인했다. 제품·recipe·host·fixture·patch를 원복하고 정상 승격 상태를 유지했다.
- 제품 build 설정의 verbatimModuleSyntax 검사에서 BuildContext를 type-only import로 고쳤다. Core ESM·d.ts build PASS와 수치 API 선언18개의 TS→d.ts 주석 일치를 확인했다. 기존16+새Viewer의 fresh17 recipe gate가 모두 통과했고 총26 생성파일 중 이전23은 byte 동일, 새3은 현재 제품과 일치한다. 과거 보정6파일은 재승격하지 않았다.
- 후보 adapter 복사본2는 먼저 hash archive로 보존한 뒤 제거하고 candidate도 실제 제품 파일을 가리키도록 정리했다. Core build 이후 batch compare는 fingerprint 변화없음·product 변화없음이다. 기존 archive116 source/JS는 일치하지만 새 Viewer source16의 packed/native 공급 승인은 추가하지 않는다.

다음은 공개 facade의 copy-on-read matrix·coalesced notification·animateTo/cancel·작은 content centering/resize anchoring·복원·editor·callback 수명을 source 계층에 연결하는 것이다. source acceptance (보관된 과거 기록 `w10-viewer-acceptance.json`)는 sourceOnly=true/publicFacadeSourceConsumption=0 경계를 명시한다.

## 8.34 Viewer 공개 finite facade의 source State 통합 — 2026-10-17 KST

입력235·receipt416 hash를 확인한 뒤 공개 `InteractiveViewer`의 수기 pan/pinch/wheel/fling 구현을 제거하고 정식 generated State를 기본 경로에 연결했다. 공개 `TransformationController`의 복사형 XY 행렬·비동기 병합 알림·명시적 animateTo, finite content·resize·복원 계약은 유지한다. **W10-02의 Viewer 기본 source 소비는 연결했으며 새 archive/native 공급은 아직 미검증이다.**

- `viewer-finite-source.ts`는 generated Widget/State/controller를 실제로 상속·소비하는 경계다. 원본 scale/pan 상태 전이와 두 관성 ticker를 사용하며 generated3파일/전체16 선언은 변경하지 않는다. 기존 공개 facade의 별도 fling 추정/보간은 제거했다. 명시적 public animateTo는 소유 API로 유지한다.
- source는 XYZ uniform scale을 `getMaxScaleOnAxis`로 읽지만 공개 API는 XY uniform·Z=1 복사본을 반환한다. 내부 행렬의 Z를 XY와 맞추고, 한 source 입력/관성 tick의 마지막에 공개 finite 정규화를 반영한다. 중간 scale→focal translation에 먼저 clamp를 적용하지 않아 소수 배율에서도 확대 중심점이 유지된다.
- source 경계는 infinite margin으로 설정하고 실제 finite 이동/작은 content 중앙 배치는 기존 공개 normalizer가 담당한다. 이는 source의 최소 viewport-fit 규칙과 구분되는 공개 API 정책이다. source 동작 비교는 raw 계층 그대로 유지한다. 극단적인 wheel 입력의 exp underflow는 공개 최소 배율로 포화한다.
- pointer cancel·새 입력·외부 value/animateTo·View 종료는 source 관성도 중단한다. 상호작용 콜백은 기존처럼 입력 dispatch 이후 전달하고 소유자 종료 시 폐기한다. 모두 disabled이면 source wrapper/child identity를 유지하면서 scale recognizer 등록을 제거한다. pan-only wheel은 source의 변환된 trackpad pan 경로를 소비하며 실제 PointerSignalResolver에서 중복 소비를 막는다.
- Core build·기존 공개12건 PASS. 실제 generated State를 확인하는 finite 계약은 debug/release 합계16건으로 Core와 RN Babel 각각 PASS: source 관성 시작/중단, 소수 배율, 작은 content·resize, pan-only wheel, 하위 signal owner, inertia disabled, 알림 병합, disabled→reenable. Babel은 공개 facade·bridge와 generated closure를 함께 변환하고 나머지는 실제 Core identity를 공유한다.
- Chromium6 PASS. 공개 Viewer의 generated State 및 실제 wheel 확대를 확인하고 DOM editor의 glyph/caret/control 크기·별도 clip·fractional zoom·동일 Element/포커스/조합 입력·Unicode commit을 유지했다. 이는 자동 DOM/Core 증거이며 물리 IME/caret pixels/FPS 판정은 아니다.
- 정식 recipe에 공개2파일을 `validationSources`로, finite Core/Babel16을 필수 gate로 포함했다. effective source를 그대로 실행하고 hash를 비교한다. raw Root10/Babel10, Viewer14 원본 Core/Babel28·math2 source19도 다시 통과했다. 보존/차단 lifecycle14건은 공개 source hash 변화와 실제 effective 소수 배율 오염 실패까지 확인하고 제품·recipe·host·fixture·patch를 원복했다. 공개 matrix 정책은 raw 원본 동등성으로 표시하지 않는다.

이전 native archive의 검증된 wheel/2D/tree116 경로는 유지된다. 다만 그 archive는 이전 공개 Viewer를 포함하므로 **현재 Viewer의 package 소비·Windows/Android 실행 승인은 새로 필요**하다. 다음은 Viewer generated/bridge/late helper를 포함한 동일 archive 검증과 실제 source 입력·관성·편집기·종료 공급이다. tree 전용 native cold restoration과 W10 잔여 파트는 계속 열린 상태다.

## 8.35 Viewer 현재 archive·실제 Windows/Android 공급 — 2026-10-17 KST

입력237·receipt437 hash와 §8.34 제품 source를 재확인했다. Viewer 공개 facade·generated3·adapter/bridge·late runtime을 공급 검증에 추가했고, **동일 archive의 외부 소비4·현재 source/JS132·복사 Windows/Android 각각27이벤트**를 통과했다.

- 공개/generated Viewer·math2·adapter/bridge·late/tear-off/static helper의10 모듈(20 source/JS)을 명시한다. 외부 NodeNext declaration/ESM 조합4에서 설치된 bytes, 단일 Core identity, 공개 Viewer copied matrix와 State API를 확인했다. 기존 wheel/2D/tree 경로와 합쳐 중복 없는132 source/JS가 현재 제품·archive와 일치하며 두 runner에 설치된 Viewer40 경로도 일치한다.
- native probe는 공개 Viewer 아래 실제 source State를 확인한다. concrete Core PointerScrollEvent로1.5배 확대하고 PointerDown/Move/Up으로 source 관성을 시작한다. 관성에 따른 실제 행렬 이동, 공개 value 대입 후 두 시점의 정지, 동일 editor Element를 검사했다. OS 하드웨어 wheel/pan을 입력한 증거로 확대하지 않는다.
- Windows Release 복사 앱27이벤트와 exit0, Android x86_64 Release 복사/설치 APK27이벤트와 Activity 종료가 PASS-scoped다. 기존 wheel/2D/tree·편집기·별도 프로세스 cold wheel 복원·motion 중 종료도 같은 artifact에서 통과했다. Android는 설치 APK hash, OS tap, 실제 EditText bounds/focus/Unicode와2x/0.5x 변환을 확인했다. emulator API33/lavapipe이며 물리 IME/caret 픽셀·하드웨어 FPS와 구분한다.
- 첫 Android 빌드는 환경의 GraalVM21 jlink/androidJdkImage 단계에서 실패했다. 실패 receipt/log와 이미 통과한 Windows artifact를 보존하고 Android Studio JBR25를 해당 프로세스의 JAVA_HOME에만 지정했다. Android-only 재시도는 archive·fixture·설정 hash를 유지하며 통과했다. 시스템 환경이나 제품 source를 우회 수정하지 않았다.
- 샘플 entry·두 runner package/lock5개를 원래 hash로 복구하고 임시 fixture3개를 제거했다. native build 자체가 입력을 원복했고 별도 검증도 통과했다. 이번에 소유한 server/emulator를 종료했으며 batch lock·임시 source analysis config는 없다. 기존 native 실패·과거 archive·중간 pause 증거를 덮어쓰지 않았다.

Viewer acceptance (보관된 과거 기록 `w10-viewer-acceptance.json`)는 currentSupply=PASS-scoped로 갱신했다. **W10-02/전체는 PARTIAL**이다. tree/Viewer 전용 native cold restoration, 필요한 추가 animated/public 흐름, 나머지 파트와 독립적인 native pixels/물리 IME/FPS는 계속 남는다.

## 8.36 Tree/Viewer 위젯 소유 상태의 native cold 복원 — 2026-10-17 KST

입력238·receipt453 hash를 확인했다. 제품 source와 이전 승인 archive를 그대로 사용하고 cold 전용 native probe를 추가했다. **Windows/Android 각각3개 실제 프로세스·7개 흐름**으로 tree와 Viewer 자체 bucket의 복원을 검증했다. 앞선27이벤트 artifact와 이번 cold 전용 artifact의 범위는 별도로 유지한다.

- 모든 프로세스에서 TreeController.expandedIds=[]·ScrollController.initialScrollOffset=0·TransformationController.identity의 실제 생성자 기본값을 기록했다. 부모는 화면 선택과 텍스트만 저장한다. 확장 ID·offset·matrix를 부모 restorable 값이나 fixture 상수로 주입하여 복원시키지 않는다.
- TreeView.restorationId로 cold-root/cold-branch의 두 단계 확장과 editor active index152·offset6080을 저장했다. 플랫폼 flush 완료 후 프로세스를 강제 종료하고 다른 PID에서 실제 generated tree 경로·동일 offset/geometry/text를 확인했다.
- InteractiveViewer.restorationId로 XY0.75/Z1·translation(-40,-20)을 저장했다. 다시 flush→강제 종료→새 PID를 거쳐 public copied matrix·generated State·geometry/text를 확인했다. Android에서는 두 재시작 뒤 실제 EditText의 한국어·emoji도 확인했다.
- 복원된 Viewer에 concrete Core pan 입력을 보내 source 관성이 active인 상태에서 SystemNavigator.pop을 실행했다. source State·두 관성 ticker와 editing binding의 종료, Windows exit0·Android Activity finish를 확인했다. flush 전 crash의 내구성이나 물리 IME/caret/FPS 증거로 확대하지 않는다.
- 첫 driver는 확장 ID의 삽입 순서를 잘못 가정해 실패했다. 기대값을 집합으로 판정하되 seed→restore 사이의 실제 배열·offset·geometry는 정확히 비교한다. Android 첫 probe는 observed native 편집 응답 전에 이전 텍스트를 읽어 저장했다. single replace 요청 후 최대20회×50ms 동안 목표 텍스트 관측을 기다리고, 응답이 없으면 실패하도록 fixture를 고쳤다. 요청 재전송·가짜 acknowledgement·제품 우회는 넣지 않았다. 두 실패 로그/receipt를 보존했다.
- prepared archive 재사용은 전체 archive hash를 검증하며 새 fixture에는 새 설정 ID를 발급한다. 최종 첫 실행은 양쪽 모두 wheel/default에서 시작했다. source/JS132와 기존 external consumer4의 동일 archive 근거를 재사용했다. 샘플/runner 입력5개 원복, 임시 fixture 제거, 소유 server/emulator 종료도 확인했다.

- 최종 비교에서 tree의 이전 promotion 이후 변경된 compiler/package 도구7개의 fingerprint 차이를 확인했다. source·의존 코드·제품 차이는 없었다. 현재 도구로 effective Core16/renderer26/facade16/nested26 및 raw 전체12 원본 비교를 다시 통과해 승격을 갱신했다. generated2·archive132 경로가 byte 동일하므로 cold/native 증거는 유지된다. Viewer batch도 변화없음을 확인했다.

Tree/Viewer의 native cold 항목은 **PASS-scoped**다. 다음은 원래 순서의 scrollbar source closure·Material/Cupertino 경계와 Page/Nested/header/refresh/reorder/dismiss/sheet의 남은 mixed 복원·selection 흐름이다. broader animated/native timing, 물리 IME/pixels/FPS 및 W10 전체는 계속 PARTIAL이다.

## 8.37 Scrollbar 전체 선언 추출·implicit Object mixin — 2026-10-17 KST

입력239·receipt480 hash와 현재 RawScrollbar를 검토했다. 현재 core scrollbar는 수기 적응 구현이며 Material/Cupertino scrollbar·scrollbar theme은 아직 없다. 원본 widgets15·Material10·theme3·Cupertino10의 **전체38 선언**을 선택했다. type/property·shape·theme 등의 공통 의존성은 별도 연결 과제로 유지한다.

- 최초37 선택에서36개 IR와 ScrollbarThemeData1개 frontend 실패를 확인했다. theme의 같은 library private helper _lerpBool을 추가해38개로 정리했다. 첫 선택의 bytes도 기존 extraction hash와 일치하도록 보존했다.
- 실패 원인은 class Foo with Diagnosticable처럼 extends를 생략한 mixin class를 통째로 거부하던 frontend guard였다. 실제 analyzer의 Object superclass/constructor와 mixin 순서를 IR에 보존한다. emitter는 기존과 동일하게 정확한 ordered host superclass binding과 no-derived-state-observation 정책을 요구한다. mixin 본문을 자동 합성하거나 host 없는 선언을 통과시키지 않는다.
- 신규10건은 implicit/named constructor identity, ordinary class 비변경, final/nonnull Object strict, Dart 양mode 값, host 단일 생성, readonly runtime, missing/reversed/different host 거부와 실제 RN Babel을 확인했다. 기존 explicit mixin·abstract-only mixin 검증 및 Dart analyzer도 PASS다.
- 수정 후38개 전체 IR·frontend 장애0. 네 module을 전체 단위로 emission 시도했으며 현재 실제 host superclass, ordered Diagnosticable host, Color/Radius canonical const binding에서 막힌다. 부족한 임시 타입이나 stub으로 strict를 통과시키지 않았고 생성 product는0이다. resolved reference1099개 census에는 local/intrinsic도 포함되므로 이를 미구현 수로 세지 않는다.
- 실제 Core Color/Radius와 기존 numeric/late/static/tear-off 정책을 후보 설정에 연결했다. RawScrollbar의 explicit controller별 notification 소유권·두 축 독립성, source enum(left/right/top/bottom)과 기존 public enum(top/bottom/left/right)의 순서 차이는 공개 경계로 남겼다. WidgetState/property 전체 의존성, CustomPainter/paint·shape, theme 확장과 gesture/timer 수명은 다음 구현 대상이다.
- 기존 공개 scrollbar5건(축별 metrics·thumb drag·track page·style/resize·disable·retirement) PASS. 공용 frontend 변경 후 등록17 recipe의 fresh 생성·strict·계약·원본 gate가 모두 통과했고26 생성파일은 이전 fresh 결과와 byte 동일하다. 제품 보정과 현재 archive132 경로는 변경하지 않았다.
- 현재 tree/Viewer 후보의 IR metadata는 실제 fresh17 IR에서 해당 records를 추출해 갱신했다. 다섯 candidate 출력이 이전 candidate 및 fresh recipe와 동일함을 검증했다. 기존 promotion fingerprint는 이전 도구의 역사적 기록이며, 현재 도구 검증은 fresh17 receipt로 구분한다. 동일 product의 native/cold 근거를 새 scrollbar 승인으로 확대하지 않는다.

다음은 actual Core painter/State/gesture/timer 연결과 required WidgetState/style dependency를 해결하고 Material/Cupertino 공개 경계까지 통합하는 것이다. scrollbar blockers (보관된 과거 기록 `w10-scrollbar-blockers.json`)는 **IR38·소비0 / PARTIAL**을 유지한다.

## 8.38 ScrollbarPainter 전체 생성·Core·독립 Dart 비교 — 2026-10-17 KST

입력244·receipt494의 현재 상태와 full38 후보를 검토한 뒤, 원본 ScrollbarPainter 전체 클래스·enum·상수7개를 먼저 실제 Core에 연결했다. 기존 public scrollbar를 교체하거나 full38 완료로 계산하지 않는다.

- 후보7개 전체를 scratch에 결정적으로 생성했고 실제 Core를 복사한 strict 검사에서 오류0을 확인했다. 원본의 ChangeNotifier 상속/CustomPainter 구현을 유지하기 위해 실제 notifier를 상속한 추상 경계와 실제 CustomPainter bridge를 사용한다. geometry/paint/hit/scroll 계산은 모두 생성된 원본 본문에 남는다.
- 실제 Core Color·Radius·Canvas·ScrollMetrics·ShapeBorder를 연결했다. Color 객체를 ARGB8 paint 기록으로 옮기는 명시적 setter, exact canonical const factory, source enum 문자열·covariant runtime 검사와 value equality를 지정했다. source/public enum ordinal 차이는 여전히 공개 통합 과제다.
- 기존 memberBindings는 inherited this에만 적용돼 explicit receiver의 Paint cascade가 color:number에 Color를 쓰고 있었다. exact instance property binding을 명시 receiver와 checked integer storage에도 적용하고 잘못된 경로·static/local mapping을 거부한다. 독립 fixture8건은 Dart 양mode·strict·RN Babel에서 nullable cascade skip/receiver identity/단일 평가·복합 대입·정수 postfix·잘못된 경로 거부를 확인했다. 기존 callback/cascade·generic State 회귀도 PASS다.
- Core/RN Babel16항목을 debug/release에서 확인했다. 네 방향·reverse·RTL padding/margins, 실제 Canvas의 opacity/ARGB/rounded/shape, overscroll 최소 길이, mouse/touch/hover/ignorePointer, scroll 변환, setter 알림 억제, covariant 검사와 dispose listener 해제가 포함된다. bridge는 실제 renderer constructor에서 허용되며 같은 listener를 전달·제거한다. 이는 renderer 전체 프레임·native pixel 검증은 아니다.
- 독립 Dart에서는 원본7개 선언의 본문을 그대로 사용하고 잠금 listen과 명시적 UI/Canvas/metrics 경계를 붙였다. 네 축×정상·양끝 overscroll의20개 시나리오에서 paint·6종 포인터 hit·위치 변환·중복 update 억제·transparent hover·dispose가 실제 Core와 양mode 일치했다. RRect 기록의 float32 축소는 명시적 기록 경계로 맞췄다. Flutter engine pixel 및 shape의 독립 Dart 비교는 포함하지 않는다.
- 공유 emitter 변경 뒤 fresh17 recipe의 생성·strict·계약·원본 gate가 PASS이며26개 생성출력이 직전 fresh와 byte 동일하다. 변환기 자체 TypeScript 검사와 Core ESM/d.ts/source-map build도 PASS다. 기존 archive132개 source/JS 경로 hash는 동일하다. 새 미사용 adapter의 native 검증을 이전 공급 근거로 주장하지 않는다.
- 최초 fixture의 Babel runtime import, visible mouse hover 기대값, constructor assertion 대상, cross-realm 배열 비교와 Dart constant 선언 범위 오류는 로그로 보존하고 테스트 경계를 수정했다. 제품/원본 알고리즘을 테스트 기대에 맞춰 변경하지 않았다.

scrollbar blockers (보관된 과거 기록 `w10-scrollbar-blockers.json`)는 **full38 IR / Painter7 후보 검증 / product 소비0 / PARTIAL**이다. 다음은 전체 widgets15의 RawScrollbar/State/recognizer·controller/gesture/timer 연결과 WidgetState/style 의존성, Material/Cupertino 및 공개 공급 검증이다.

## 8.39 Scrollbar 입력 helper·recognizer 통합 후보와 WidgetState 의존성 — 2026-10-17 KST

입력251·receipt509 hash를 검증하고 원본 RawScrollbar의 실제 View·controller·gesture 경계를 검토했다. 전체 State에 필요한 WidgetState/property가 없으므로 source helper/recognizer6을 Painter7과 함께 연결하고, 상태 의존성의 전체 공통 closure도 선택·추출했다.

- Painter7+helper3+recognizer3의13개 전체 선언이 결정적으로 생성되고 실제 Core strict0을 통과했다. recognizer constructor는 mounted State의 실제 View GestureBinding을 받는다. GlobalKey context의 undefined→null, CustomPaint.foregroundPainter의 bridge→source delegate, RenderBox.globalToLocal의 plain Offset→실제 Offset만 경계에서 변환하며 hit/track/gesture 판정 본문은 그대로 생성한다.
- source helper의 as ScrollbarPainter가 드러낸 생성 클래스 cast 누락을 해결했다. recipe가 정확히 선택한 generatedRuntimeTypes의 소유 class/enum만 실제 runtime token으로 검사한다. 단일 operand 평가·nullable/negated check·서브클래스·guard narrowing을 보존하며, 명시 host predicate가 우선한다. generic application·abstract mixin·알려진 implements-only 객체는 이 규칙으로 통과시키지 않는다. 독립 Dart/strict/Babel8항목 PASS다.
- 첫 일반화에서 기존 ChildVicinity의 명시 predicate를 덮어써 strict narrowing이 실패했다. 이 실패를 보존하고 명시 predicate 우선 및 opt-in 정책으로 보정했다. 실제 fresh17 recipe 생성·strict·계약·원본 gate가 PASS다. 최종 opt-in 변경으로 다시 생성한26 출력은 실행한 fresh 결과와 직전 fresh에 byte 동일하며, effective의 비생성 Core/design 소스521개도 현재와 동일하다. Painter7 출력도 그대로다.
- Core DragGestureRecognizer의 source signature는 PointerEvent이며 callback/buttons 필터 뒤 PointerDownEvent로 검사한다. 현재 Core의 좁은 signature를 이 계약에 맞추고 실제 runtime 검사도 추가했다. 필터를 우회하거나 모든 이벤트를 허용하지 않는다.
- 실제 copied Core/CanvasKit Root14 및 RN Babel14가 debug/release에서 PASS다. mounted owner/서로 다른 View binding, scale0.75+translate(12,9)에서 key→render→source Painter 좌표 변환, track tap·vertical/horizontal thumb drag의 실제 arena, off-track/transparent/ignorePointer 거부, panzoom 거부, 축 교체·factory 제거/재생성·active drag 중 Root 종료 및 listener/recognizer 해제를 확인했다.
- 독립 Dart에서 unchanged13 선언과 잠금 listen을 실행하고12개 시나리오(두 축×opacity×thumb/track/outside)를 실제 Core Root와 비교했다. 허용되는 down-event5종 및 trackpad panzoom, 변환 좌표·판정·분리된 thumb/track·detached key가 양mode 일치했다. Dart의 key/render/base-admission은 controlled receivers이며 base recognizer arena 전체 동등성을 주장하지 않는다. 실제 arena는 위 Root 검증 근거다. 첫 fixture가 Core에서 금지된 trackpad PointerDownEvent를 만들던 오류는 실제 정책대로 고치고 로그를 보존했다.
- 필수 WidgetState constraint/enum/property/mapper/lerp와 controller의 전체13 선언 및 alias2개를 선택했다.10개 IR·3개 frontend 장애는 mixin 연산자 본문, mixin/member가 있는 enhanced enum, generic static property method다. 간소화된 state token/property stub을 만들지 않았다. 상태 의존성 blockers (보관된 과거 기록 `w10-widget-state-blockers.json`)에 실제 진단과 source hash를 남겼다.
- 변환기 자체 TypeScript 검사와 Core ESM/d.ts/source-map build PASS. 이전 공급의 감사 대상132개 source/JS 경로는 그대로지만 변경한 common monodrag는 그132개 목록 밖이므로 이전 native receipt를 현재 drag 변경 승인으로 사용하지 않는다. full38 통합 후 공급 검증을 갱신해야 한다.

현재 scrollbar blockers (보관된 과거 기록 `w10-scrollbar-blockers.json`)는 **full38 IR / candidate13 검증 / public 소비0 / PARTIAL**이다. 다음은 WidgetState/property의 실제 source 장애와 RawScrollbar/State·Material/Cupertino 연결이다.

## 8.40 Generic method·redirect factory와 WidgetStateProperty 전체 IR — 2026-10-17 KST

입력260·receipt526 hash를 확인하고 WidgetStateProperty의 실제 static generic method 장애를 해결했다. 원본 전체 클래스의 다음 장애였던 generic redirecting factory도 이어서 처리했다. 의존성13개 중 전체 IR은10→11개, frontend 장애는3→2개로 줄었다.

- method type parameter의 analyzer identity/bound를 IR에 보존한다. class T와 method T는 다른 scope이며, 충돌 시 출력 이름만 구분한다. static method는 자신의 타입 인자만 사용할 수 있고 클래스 타입 인자가 새는 경우 거부한다. abstract/override·callback·instance/static generic 본문도 그대로 생성한다.
- owned generic method 호출에는 analyzer가 확정한 타입 인자를 명시적으로 출력한다. 원본에 적은 인자와 문맥에서 추론한 인자를 구분해 보존하므로 TS가 다시 추론하지 않는다. 예를 들어 Box<Object?> 문맥의 box('hello')는 정확히 Object? 인자를 유지한다. 외부 generic adapter의 기존 exact specialization 정책은 유지한다.
- named factory의 generic scope와 return type을 생성하고, required-only redirect의 실제 target constructor/type/argument identity를 IR에 남겨 호출한다. named 인자의 원본 평가 순서를 유지한다. body factory와 generic factory chain도 지원한다. const 호출의 canonicalization은 별도 명시 경계이며, optional redirect의 상속 기본값·generic generative named constructor·generic function value·runtime reification을 이 변경으로 허용하지 않는다.
- 독립 fixture11항목은 Dart 양mode·strict consumer negative·d.ts·RN Babel에서 scope/shadowing, 명시·문맥추론 호출, generic abstract override/callback, numeric bound 및 @dartParam/@dartReturn/@dartBound, named 평가 순서, factory identity/chain을 확인했다. 누락된 resolved 인자·static class-param 누출·중복 type parameter 이름과 미지원 factory는 계속 거부한다.
- 기존 named/only constructor와 generic State 회귀 PASS. named constructor의 실제 Windows Hermes 검증도 PASS다. frontend analyzer와 변환기 TypeScript 검사 PASS. 같은 Flutter source 설정을 동시에 쓰려던 첫 회귀 실행은 analyzer ownership guard에서 거부돼 종료됐다. 선행 추출 종료 후 순서대로 다시 실행했다. batch 전용 generic-class fixture의 단독 실행은 환경 context가 없어 종료됐으며, 실제 fresh17의 tween-sequence-item gate에서 정상 검증했다. 두 실행 오류는 로그로 보존했다.
- WidgetStateProperty 전체 본문(resolveAs/resolveWith/all/lerp/resolve)과 fromMap redirect가 IR에 들어왔다. 남은 frontend 장애는 WidgetStatesConstraint의 concrete operator mixin과 WidgetState의 enhanced enum이다. 전체 property의 제품 연결·generic runtime 판정·const/Set/Map/diagnostics 경계는 아직 미완료다.
- fresh17 recipe의 생성·strict·계약·원본 gate PASS. 최종 emitter로 다시 생성한26 출력은 실행한 fresh 결과 및 이전 fresh와 byte 동일하다. tree/Viewer 후보5개와 scrollbar Painter/gesture 후보2개의 출력도 동일하다. 실제 fresh IR과 scrollbar38 재추출로 후보 frontend hash/IR 참조를 갱신했고 현재 scrollbar13 strict0을 확인했다. 제품 source는 변경하지 않았으며 기존 native 범위를 확대하지 않는다.

WidgetState blockers (보관된 과거 기록 `w10-widget-state-blockers.json`)는 **selected13 / IR11 / frontend2 / product 소비0 / PARTIAL**이다. 다음은 원본 mixin 연산자와 enum을 함께 생성하고, property/RawScrollbar/State/style 전체를 연결하는 것이다.

## 8.41 Source mixin 연산자·enhanced enum과 WidgetState 전체 IR — 2026-10-17 KST

입력261·receipt540 hash를 검증하고 남은 WidgetState frontend 장애2개를 해결했다. constraint/enum/property/mapper/lerp/controller의 전체13 선언과 alias2개를 원본 선택대로 유지했으며 **IR13·frontend0**을 확보했다.

- 필드·on/implements 제약·class type parameter가 없는 concrete source mixin의 실제 메서드/연산자 본문을 보존한다. 정확히 한 개의 monomorphic mixin이 resolved empty Object constructor에 적용되는 경우, 동일 본문을 생성된 추상 기반 클래스로 공유한다. 새 constraint 알고리즘을 host에 작성하지 않는다. 원본 superclass identity를 IR에서 바꾸거나 가짜 Dart constructor reference를 만들지 않는다.
- source &/|/~는 명시적인 member rename/receiver adapter로 호출하며 본문·단락 평가를 유지한다. 기존 == 정책도 유지한다. source body 기반 mixin과 다른 정확한 Object-host mixin이 한 module에 공존할 수 있다. 같은 source mixin을 경쟁 host binding으로 덮어쓰거나 stateful/on/multiple/non-Object/generic 조합을 이 규칙으로 허용하지 않는다.
- constructor/instance field가 없는 enhanced enum의 메서드·static const와 위 source mixin을 함께 생성한다. 원본 enum index/name·private token·불변 values/instance/prototype을 유지한다. 필요한 mixin 및 static const helper class를 먼저 정의하는 순서를 계산하며 초기화 cycle은 lazy 경계 없이 통과시키지 않는다. source enum의 reserved API 충돌·허용되지 않은 field layout도 거부한다.
- 독립 fixture12항목은 Dart 양mode·strict/d.ts·RN Babel에서 전체 mixin 본문, inherited/named constructor와 super receiver, &/|/~ composition/단락 side effect, enum의 같은 mixin 소비·static const canonical identity·ordinal/sealing·초기화 순서를 비교했다. operator binding 누락·미지원 조합/constructor enum·초기화 cycle·잘못된 enum field metadata도 거부한다. 마지막 fixture 확장 중 JS 쪽 receiver 접두사가 빠진 오류는 수정하고 실패 로그를 보존했다.
- 기존 abstract-only generic mixin·명시 host mixin·단순 enum10 회귀 PASS. 기존 abstract fixture의 WithBody는 새 concrete mixin IR로 확인하고, field/on/abstract accessor 및 interface runtime-token 거부를 유지했다. analyzer 및 변환기 TypeScript 검사 PASS다.
- 전체 WidgetState13 후보를 실제 Core DartSet/DartMap/ValueNotifier와 numeric/source-flow 경계로 구성해 모듈 전체 생성을 시도했다. 첫 장애는 WidgetState.any의 canonical immutable const adapter다. virtual equality/hash·generic runtime property·diagnostics/collection의 실제 연결도 남아 있다. 미완성 module을 부분 생성하거나 state/property stub으로 통과시키지 않았다. reference census187은 local/intrinsic도 포함하므로 미구현 API 수가 아니다.
- fresh17 recipe의 생성·strict·계약·원본 gate가 PASS다. 최종 도구로 생성한26 출력은 이전과 byte 동일하고 tree/Viewer5·scrollbar2 후보 출력도 동일하다. 현재 frontend의 실제 fresh IR/scrollbar38 재추출로 후보 metadata를 갱신했으며 scrollbar13 strict0을 확인했다. 제품 source는 변경하지 않았고 native·공개 scrollbar 통합 승인을 확대하지 않는다.

WidgetState blockers (보관된 과거 기록 `w10-widget-state-blockers.json`)는 **selected13 / IR13 / frontend0 / Core binding·product 소비0 / PARTIAL**이다. 다음은 canonical const·Object equality/hash·typed collections·generic property와 실제 diagnostics/notifier 경계를 연결하고 전체 source 계약을 검증하는 것이다.

## 8.42 WidgetState constraint·controller 실제 Core 연결과 원본 비교 — 2026-10-17 KST

입력264·receipt557 hash를 확인하고 전체13 후보의 canonical const 경계부터 연결했다. 원본 constraint/mixin/enum/helper7과 WidgetStatesController1의 **전체8 선언**이 실제 Core에서 실행되는 후보가 됐다. generic property5와 full13/public 통합은 계속 미완료다.

- 생성된 base/enum/And/Or/Not/Any constructor token을 명시 등록한다. 객체 모양·이름으로 타입을 추측하지 않는다. Any의 zero-argument const는 compiler의 immutable proof에 따라 owner별 canonical 객체로 만들고 freeze한다. equality와 hashCode는 원본 생성 getter/operator 본문으로 dispatch한다. 기본 identity와 hash 결합은 실제 Core 경계이며 hash 정숫값의 Dart VM ABI 동등성을 주장하지 않는다.
- 실제 DartSet/DartMap에 명시 key policy를 제공했다. enum 소유 모듈, 값 identity와 constraint의 구조적 equality를 구분하고, 같은 hash의 And/Or가 다른 key로 공존하도록 했다. 임의 객체와 다른 모듈의 enum은 이 닫힌 경계에 들어오지 못한다. 더 넓은 custom constraint subclass/public 계약은 아직 별도다.
- 원본 constraint7 전체의 strict0·d.ts numeric annotation과 독립 Dart 비교를 완료했다. 원본 Dart는 standard Set/Map과 실제 meta를 사용하며 대체 constraint 구현을 넣지 않는다.20개 state 집합에서 원본 연산·중첩 문자열·ordered equality·hash 관계·canonical stored key/replacement/order를 Core 및 RN Babel과 양mode 비교했다. 전체8 enum identity, 불변 field/const, typed collection 변이/dedup와 등록 불일치 거부를 포함한10 contract group PASS다.
- 최초 strict 오류 중 Dart Object의 equals/hashCode override를 TS의 빈 source-mixin 기반 클래스에도 표시하던 문제를 보정했다. 원본 override origin을 유지하고, 해당 TS 기반 계층에 대응 member가 없는 경우의 modifier만 생략한다. 실제 생성 ancestor member override는 유지한다. adapter의 명시 매개변수 타입도 보완했다. 원본 equality/hash 본문은 변경하지 않았다.
- WidgetStatesController는 실제 Core ValueNotifier/ChangeNotifier에 연결했다. source Set literal factory가 정확한 생성 module의 enum을 참조하도록 staged host를 구성했다. 생성된 constructor의 null-aware set 복사와 update 본문이 실행되며, factory는 원본 알고리즘을 복제하지 않는다. 이 module-local ESM cycle은 해당 generated module과 host를 함께 RN Babel 변환해서도 검증했다.
- constraint7+controller1 전체8의 strict0/d.ts와 독립 Dart(native collections·잠금 listen)/Core/RN Babel8 group이 양mode PASS다. 빈 기본값·입력 집합 복사, 중복/없는 state update의 무알림, value replacement identity와 명시적 직접 변이, 재진입 알림, self-removal/dispose, 외부/retained Set 수명 및 모듈별 enum 격리를 비교했다.
- 전체13 module도 canonical Any 연결 후 다시 생성 시도했다. 현재 첫 진단은 일반 Object reference 경계다. constraint 전용 equality/hash를 generic property의 임의 값에 그대로 확대하지 않았다. runtime T/nullability·value provenance, diagnostics/MapEquality 및 나머지 generic const 경계가 남아 있다. full13 파일이나 public facade를 부분 동작 상태로 승격하지 않았다.
- fresh17 recipe의 생성·strict·계약·원본 gate PASS.26 출력은 직전과 byte 동일하며 실행한 effective의 비생성 Core/design522개가 현재와 일치한다. 변환기 TypeScript 검사·Core ESM/d.ts/source-map build PASS. 기존 archive 감사132 경로는 그대로이고, 새 adapter/staged host/candidate에 이전 native receipt를 적용하지 않는다.

WidgetState blockers (보관된 과거 기록 `w10-widget-state-blockers.json`)는 **IR13/frontend0 / constraint·controller8 후보 검증 / property5·full13/public 소비0 / PARTIAL**이다. 다음은 generic property의 실제 타입/nullability 경계와 RawScrollbar/State/style 통합이다.

## 8.43 Generic 메서드의 명시적 runtime type witness — 2026-10-17 KST

입력272·receipt574 hash와 현재 scope를 확인했다. generic property5에 필요한 타입 전달을 한 번에 포괄 승인하지 않고, 먼저 **선택한 concrete generic 메서드의 명시적 호출 규약**을 구현했다. WidgetState 전체13 또는 property5의 제품 소비를 완료한 단계는 아니다.

- recipe의 exact method ID와 imported Witness<T>/is/cast/nullable 경계를 명시한다. 호출부의 hidden 인수는 analyzer의 resolvedTypeArguments에서만 생성한다. 명시 타입·문맥 추론 타입·method forwarding·class와 같은 이름의 method T도 각 원본 parameter ID로 구분한다. source signature와 return 타입은 strict/d.ts에 보존되며, 잘못된 witness 타입은 consumer 검사에서 거부된다.
- 원본 null as T·value as T·is/is! T·T?·generic application의 checked test/cast 및 T type literal이 동작한다. nullable은 host의 canonical 조합 정책이며, generic application은 exact type identity/arity/imported factory를 요구한다. 인수 값으로 int/double을 추측하거나 TS 타입 단언만으로 cast를 대체하지 않는다.
- witness factory는 recipe에서 pure/canonical 계약으로 한정한다. 원본 receiver/일반 인수 평가 순서를 보존하며, 명명 인수 순서·test/cast 피검사식 단일 평가·closure가 메서드 종료 뒤 해당 T를 유지하는 것을 검증했다. 타입 검사 뒤 source Property<T> member 접근은 TS에서도 실제 type guard로 좁혀진다.
- 독립 Dart 원본 양mode와 생성TS/RN Babel의31 결과가 일치했다. String/bool/Object?/nullable/nested Property application을 다루는12 group이다. fixture의 Property는 명시 host 경계이며 generated generic class의 자동 reification 증거로 사용하지 않는다. 숨은 인수 누락·타입 불일치 consumer 검사와15 fail-closed case도 PASS다.
- selected method의 override/abstract/adapter bypass, method tear-off ABI, scope 밖 class T, missing resolved arguments/token/application arity, 숫자 runtime witness 누락은 거부한다. class/factory의 실제 type token 보관, inherited interface application, virtual method ABI 및 numeric value provenance는 다음 구현 범위다.
- 기존 generic-method·generic-State·nominal-runtime 회귀 PASS. WidgetState constraint7/controller8의 strict/d.ts 및 원본/Core/RN Babel20·8 검증도 재실행 PASS이며 생성 bytes가 직전과 같다. full13의 첫 일반 Object 경계와 public 소비0 상태는 유지된다.
- fresh17 recipe의 strict·source/effective gate PASS,26 생성 출력은 직전과 byte 동일하다. 실행한 effective의 비생성 Core/design522개가 현재 입력과 일치한다. 변환기 타입 검사 PASS. 제품 Core 소스는 이번 단계에서 변경하지 않았으며 과거 native/package receipt를 새 타입 경계의 실행 근거로 확대하지 않는다.

다음은 source class/factory에서 원본 generic 인자를 보관·전달하는 규칙과 property의 value/equality/hash/diagnostic 경계다. 전체 상태는 ACTIVE/PARTIAL이다.

## 8.44 Generic 클래스·factory 타입 보관과 원본 promoted bound — 2026-10-17 KST

입력273·receipt595 hash를 확인하고 §8.43의 method witness를 source class/factory로 확장했다. 실제 Core의 nominal type 저장소와 생성 규칙을 구현했으며, property5 후보에는 이 호출 규약을 설정했다. **전체 WidgetState13/public 소비 완료는 아니다.**

- constructor의 hidden Witness<T>는 analyzer constructedType에서 전달된다. superclass의 정확한 타입 인자도 전달하고 super 뒤·source body 전에 원본 owner별로 보관한다. eager initializer는 아직 this를 읽지 않고 전달받은 witness를 사용한다. 일반 method/closure/lazy field는 자신의 lexical class owner와 parameter index로 읽는다.
- 실제 Core의 WeakMap 저장소와 immutable type token을 추가했다. source constructor identity·원본 display name·타입 인자·extends/implements projection을 명시하며 JS constructor 이름이나 객체 모양으로 추측하지 않는다. 여러 단계 상속과 fixed monomorphic subclass, transitive interface, 중첩 generic argument의 공변 관계를 보존한다. type metadata는 source instance의 공개 field로 노출되지 않는다.
- named redirect/body factory는 클래스 타입 인자를 concrete 생성자로 넘긴다. factory 자신의 가짜 instance capture를 만들지 않는다. source constructor의 final field 보호·base의 가상 호출/this 노출 차단은 유지한다. conflicting owner/arity/projection·중복 capture·다른 lexical owner read·structural/prototype impostor를 검증했다.
- 원본 resolveAs<T>와 같은 코드에서 analyzer의 T & Property<T> promotion을 IR이 T로만 저장하던 문제를 발견했다. public analyzer bound와 declared bound의 차이를 보존하고 TS intersection으로 출력한다. runtime 타입 인자로 promoted intersection을 전달하는 별도 표현은 아직 명시적으로 차단한다.
- 독립 Dart 양mode와 actual Core/생성TS/RN Babel39 결과가 일치했다. constructor initializer/body/lazy 구분, null as T, method/class scope,3단계 상속, fixed subclass, transitive implements와 nested nominal subtyping, factory concrete identity, strict/d.ts consumer를 포함한14 group PASS다. compiler 거부12종도 확인했다. 이는 source class/factory의 scoped ABI 증거이며 임의 Dart VM type 체계의 포괄 구현은 아니다.
- WidgetState13과 scrollbar38을 현재 frontend로 재추출해 각각 frontend0을 확인했다. property5/그 generic static method4의 witness recipe를 실제 Core helper에 연결했다. full13의 첫 진단은 아직 일반 Object reference다. constraint/controller8은 현재 strict/d.ts·Dart/Core/Babel20·8 재실행 PASS이며 생성 bytes가 직전과 같다. general equality/hash, runtimeType, numeric value provenance, Diagnosticable/MapEquality/error 및 generic const의 나머지 경계가 남아 있다.
- Core ESM/d.ts/source-map build·변환기 타입 검사·Dart analyzer PASS. method witness/generic method/generic State/source-flow 회귀 PASS. fresh17 gate를 재실행했고26 생성 출력이 그대로다. tree/Viewer 후보 IR와 scrollbar 후보를 현재 frontend 근거로 갱신했으며 실행한 effective의 비생성 Core/design523개가 현재와 일치한다. 이전 archive132 감사 경로도 불변이나 새 helper의 native/package 실행 근거로 확대하지 않는다.

다음은 generic property의 실제 value/diagnostic/const 경계와 전체13 원본 비교·Core 통합이다. 전체 계획은 ACTIVE/PARTIAL을 유지한다.

## 8.45 Object value 연산·정확한 runtimeType과 상태 후보 재연결 — 2026-10-17 KST

입력275·receipt626 hash를 확인했다. generic property 전체 생성의 첫 Object 경계를 실제 Core value dispatcher로 연결했고, 전체13 probe는 **Diagnosticable mixin host 연결**까지 진행됐다. property5/public 통합은 계속 미완료다.

- 원시 string/bool/number/null과 명시 등록한 object owner를 구분한다. object는 등록된 admission predicate를 통과한 뒤 실제 원본 equals/hashCode로 dispatch한다. unregistered object나 equals/hashCode 모양만 같은 객체에 임의 identity 계약을 부여하지 않는다. identity-only class도 별도 policy로 등록한다.
- 일반 equality 앞에 자기 자신이면 true라는 단축을 넣지 않는다. 비반사적·방향성 원본 연산자와 hash getter/예외가 실제 실행된다. nullable 비교, NaN·±0·int/double의 같은 수치, Unicode string에 대한 equality/hash 관계와 actual Core DartMap의 canonical key/replacement를 독립 Dart 양mode와 비교했다. hash는 local integer ABI이며 Dart VM의 특정 정숫값과 동일하다고 주장하지 않는다. numeric kind를 JS 값으로 추정하지 않는다.
- exact captured constructor와 type argument로 runtimeType을 반환한다. Value<Object>와 Value<String>, base와 실제 generated subclass를 구분하며 같은 타입의 인스턴스는 canonical token을 공유한다. 보관되지 않은 외부 subclass를 base runtimeType으로 잘못 표시하지 않고 거부한다. 숫자 값 자체의 runtimeType/provenance는 별도 범위다.
- implicit Object getter에 exact receiver-first adapter를 적용했다. 기존 exact memberBindings를 우선하여 receiver 계약을 유지한다. static/initializer/lvalue 문맥을 허용하지 않는다. 전체 원본 생성 중 드러난 generic 지역변수 T의 resolved identity 누락과 source-owned null-aware generic method call도 보정했다. optional receiver가 null일 때 witness/일반 인수 평가를 생략하며, 원본 hidden 타입 전달과 generic 지역 타입을 유지한다.
- independent Dart/Core/strict/d.ts/RN Babel40 결과,10 group과 compiler 거부4종 PASS. 실제 Core registry의 중복·충돌·잘못된 owner·prototype impostor·throwing callback도 검증했다. 기존 method witness31/class witness39 회귀 PASS다.
- constraint/controller8 후보를 새 공통 Object dispatcher에 연결했다. constraint의 닫힌 admission 계약은 유지하고, exact generated token으로 기존 원본 연산자를 등록했다. 양mode 원본/Core/RN Babel20·8와 strict/d.ts를 다시 통과했다. 이 후보2개 출력은 adapter import/registration 변경으로 달라졌고 새 receipt로 기록했다. full13은 property의 원본 본문을 줄이거나 stub으로 바꾸지 않았으며 현재 emitted=false다.
- Core ESM/d.ts/source-map build와 변환기 타입 검사 PASS. fresh17 recipe 전체 gate와 기존26 출력 byte 보존을 확인했다. 실행한 effective의 비생성 Core/design525개가 현재와 일치하며, 이전 archive132 감사 경로는 불변이다. 새 helper의 native/package acceptance는 아직 없다.

다음은 actual Diagnosticable·MapEquality/DiagnosticsProperty·문자열/Invocation/error와 generic const/numeric value provenance다. 전체 계획 상태는 ACTIVE/PARTIAL이다.

## 8.46 Generic 외부 생성자와 Diagnosticable·Map hash host — 2026-10-17 KST

입력280·receipt655 hash를 확인했다. Mapper의 실제 Diagnosticable host와 default MapEquality.hash 경계를 연결했고, 전체13 생성 probe는 **generic Map 문자열 변환**까지 진행했다. 전체 Mapper/PropertyAll/public 통합은 아직 미완료다.

- external generic constructor application은 정확한 constructed type과 source parameter ID를 recipe에서 지정한다. 모든 in-scope 매개변수를 확인하고 host generic 인자 및 선택적 witness로 전달한다. T? 사용 위치에서도 formal T 자체를 전달하며 nullable shape는 exact application 계약에 남긴다. 같은 이름의 다른 class T, nested type, new/factory, 명명 인수 순서와 const 거부를 검증했다.
- 독립 Dart fixture와 실제 Core DiagnosticsProperty를 이용해17 결과·8 group·8 compiler 거부 조건을 검증했다. direct/nullable 타입 표시와 value 보관, nested generic 결과, strict/d.ts consumer와 RN Babel이 PASS다. 이것은 reviewed constructor 규칙 및 실제 Core property contract 근거이며, Mapper의 DiagnosticsProperty<Map<...>> 최종 연결을 완료한 것은 아니다.
- WidgetStateDiagnosticableBase는 실제 Core Diagnosticable mixin을 사용한다. equals/hashCode/noSuchMethod는 원본 Mapper가 채우는 abstract 계약이며 대체 본문을 만들지 않는다. 생성 중 override 관찰 없음, captured runtime type의 debug/release 표시·hash 하위20bit, 진단 속성의 지연 평가와 builder 동작을 실제 Core에서 확인했다. Flutter 전체 diagnostics 원본 oracle 완료로 확대하지 않는다.
- 기존 exception capture와 같은 realm의 TypeError predicate를 연결하고, 원본 resolve에서 사용하는 message-only ArgumentError 및 등록된 enum Set 문자열을 구현했다. Set의 순서와 형식은 원본 constraint/enum7을 그대로 사용한 Dart 비교로 확인했다. Source argument error 문자열과 null cast/type catch도 검증했다.
- DartMapHash는 사용 중인 collection1.19.1의 default MapEquality.hash 경계만 구현한다. custom equality/equals/isValidKey 전체 구현으로 표시하지 않는다. actual Core DartMap에서 key hash 뒤의 map[key] as V 순서를 보존한다. 키 hash가 항목을 삭제할 때 nonnullable V의 TypeError가 iterator 실패보다 먼저 발생하고 nullable V는 concurrent modification으로 이어지는 것을 native Dart와 비교했다.
- local hash ABI는 유지하면서 원본31bit 결합식을 구현했다. multiplication 전에 safe integer hash를 modulo2^31로 줄여 JS 정밀도를 보존한다. ±최대 safe integer·음수·충돌·입력 순서를 포함한 controlled hash 정숫값이 실제 package MapEquality와 일치했다. 일반 VM hash 정숫값의 동등성은 주장하지 않는다. Flutter mapEquals 전체 원본 함수의 b[key] == a[key] 방향·identity/null 조건도 비교했다.
- Map/Set/error의 원본 결과11묶음과 별도 Core Diagnosticable 검증을 포함한8 contract group이 debug/release 및 RN Babel에서 PASS다. RN Babel은 생성TS/hostTS와 실제 빌드된 Core ESM을 하나의 realm에서 실행한다. Core source map 원문과 실행 JS hash를 확인했다. raw Core TS 직접 처리는 declare/Flow 경계에서 실패했으며, 이 단계의 승인 범위는 제품의 빌드된 Core ESM 공급 경로다.
- Core ESM/d.ts/source-map build·변환기 타입 검사, 기존 nested constructor/generic method/class witness·controller8 회귀 PASS. fresh17 전체 gate와 기존26 생성 byte 보존을 확인했다. effective의 비생성 Core/design528개 및 기존 archive132 감사 경로가 현재와 일치한다. 새 host의 물리/native/package 실행 근거는 없다.

다음은 generic Map/value 문자열, Mapper의 나머지 diagnostic/Invocation/error 계약과 PropertyAll의 numeric value provenance·generic const다. 전체 계획은 ACTIVE/PARTIAL이다.

## 8.47 Map 문자열·Symbol/Invocation·nested diagnostics 연결 — 2026-10-17 KST

입력285·receipt686 hash를 확인했다. Map 문자열과 Mapper의 Symbol/Invocation/diagnostic 생성자 bindings를 연결했으며, full13 probe는 **PropertyAll의 value is double** 경계까지 진행했다. 전체 Mapper/PropertyAll의 strict·public 통합을 완료한 것은 아니다.

- Object string은 명시 등록된 원본 toString으로 dispatch한다. string/bool/null과 등록된 객체를 지원하고 JS number로 int/double을 추측하지 않는다. native Dart에서 Object? map의1과1.0이 다른 문자열을 만드는 증거를 기록했으며, raw JS number는 출처가 확보될 때까지 거부한다.
- actual Core Map의 삽입 순서, forEach entry의 key 변환 이전 value capture, nested/self/mutual cycle의 {...}, 반복 참조와 formatter 예외 뒤 방문 상태 해제를 구현했다. Map은 실제 constructor의 private WeakSet 표식으로 admission을 확인하여 prototype만 위조한 객체에 identity/string 계약을 부여하지 않는다.
- constructor-created Dart Symbol의 이름·동등성/hash 관계·원본 문자열을 보존한다. 따옴표·개행·Unicode도 native Dart와 비교했다. private library symbol literal과 const identity는 별도다. Invocation은 Mapper가 사용하는 memberName projection만 제공하며 일반 dynamic dispatch/reflection을 구현했다고 표시하지 않는다.
- external constructor의 generic 인자를 analyzer interface argument 경로로 선택하도록 확장했다. DiagnosticsProperty<Map<WidgetStatesConstraint,T>>에서 key/value 타입을 별도로 전달한다. 실제 Core property subclass가 Map identity를 보관하고 toDescription 시점에만 변환하므로 생성 중 callback을 호출하지 않고 이후 값 변이를 반영한다.
- source implements-only 계약을 TS superclass override로 잘못 표시할 수 있는 경계도 보정했다. 실제 source ancestor의 동일 member override는 유지한다. concrete base+generic interface fixture의 strict/d.ts와 기존17 recipe 출력 보존을 확인했다.
- original constraint/enum7을 포함한 native Dart Map/Symbol 결과와 diagnostics 저장·format protocol fixture12묶음, 실제 Core ErrorSummary/Description/Hint 및 builder debug/release 계약을 검증했다. nested factory probe는 analyzer IR에서 생성하고 strict/d.ts를 통과했다. 전체 Flutter DiagnosticsProperty/Mapper 원본 oracle 승인과 구분한다. constructor fixture18 결과·10 group·거부11종도 PASS다.
- 생성TS와 빌드된 actual Core ESM을 같은 RN Babel realm에서 실행하고 source-map 원문/JS hash를 확인했다. 기존 Map hash host11·value40·controller8 회귀, 변환기 타입 검사·Core ESM/d.ts build와 fresh17 전체 gate PASS다. 기존26 생성 출력과 constraint/controller 후보8의 bytes는 유지됐다. effective의 비생성 Core/design530개가 현재 입력과 일치한다.
- 공통 DartMap 생성자 표식 추가로 이전 공급 archive132 감사 경로 중 source/JS2개가 달라졌다.130개는 그대로다. 이전 native receipt는 해당 과거 artifact의 근거로 유지하며 **현재 branded collection의 package/native 공급은 notVerified**로 기록한다. 새 helper의 physical/native acceptance도 없다.

다음은 actual numeric value provenance·generic const와 full13 최종 연결/원본 비교, 그리고 변경된 공통 collection을 포함한 공급 갱신이다. 전체 계획은 ACTIVE/PARTIAL이다.

## 8.48 명시적 numeric value 보관·전체 WidgetState13 생성/실행 — 2026-10-17 KST

입력288·receipt715 hash를 확인하고 §8.47 이후의 numeric 경계를 구현했다. **전체13 원본 선언의 생성·strict/d.ts 및 실제 Core 실행이 통과했다.** full13의 native Dart 원본 비교와 제품 승격은 별도 미완료다.

- DartInt/DartDouble은 호출자가 알고 있는 source 종류를 명시하는 immutable private-brand 형식이다. Object/num/T에 보관되어도 1과1.0, 음의0 구분을 잃지 않는다. scalar number와 타입을 분리했으며 int는 기존 safe integer 범위를 유지한다. Number.isInteger/표시 문자열로 runtime 종류를 추측하지 않는다.
- numeric witness의 int/double→num→Object 관계와 정확한 runtimeType을 추가했다. 원본 double is/as는 명시적으로 보관된 값에 대해 검사하고 scalar를 추출한다. raw JS number가 erased 경계에 들어오면 provenance 오류로 거부한다. 기존 numeric equality/hash는 종류와 무관한 값 동등성을 유지하고, Map key 교체에서도 int/double의 canonical key를 보존한다.
- 독립 analyzer Box<T>의 생성 본문에서 generic 저장/forward·double 검사/cast·string·equality/hash를 실행했다. native Dart 양 mode28결과,16개 숫자 문자열(음의0·비정상값·subnormal 포함),9검증 묶음과 strict 소비자 거부·d.ts·빌드 Core ESM/RN Babel 비교가 PASS다. **일반 source의 widened argument/local/field/return/collection에 자동 boxing을 삽입하는 emitter 규칙은 아직 없다.** 명시적 bridge를 그 완료로 표시하지 않는다.
- 전체 후보의 PropertyAll double/debugFormatDouble binding과 이미 검증한 controller Core binding을 연결했다. controller의 Set factory는 전체 생성 모듈의 enum을 사용하도록 별도 staged host로 연결하여 다른 후보 enum과 섞이지 않는다. 원본13 전체가 처음으로 strict 및 declaration 출력을 통과했다.
- full13의 all/resolveAs/resolveWith/lerp, PropertyAll 값/string/hash, Mapper 순서/nullable/error/hash·lazy diagnostics/noSuchMethod, controller copy/update/dispose를 실제 Core에서8묶음으로 실행했다. debug/release와 빌드 Core ESM을 사용하는 같은 realm의 RN Babel에서도 통과했다. 이것은 **full13 Core 통합 검증**이며 **full13 Flutter/native Dart 원본 비교나 기기 실행 검증은 아니다.** 원본 비교가 완료된 subset8, public 소비0의 경계를 유지한다.
- 기존 source-value40·Map diagnostics12·controller8, fresh17 및 기존26 출력 byte 보존, Core build가 PASS다. 현재 effective 비생성 Core/design531개가 입력과 일치한다. 이전 archive132경로 중130개 동일·DartMap source/JS2 변경은 유지되며 현재 collection package/native 공급은 notVerified다.

다음은 full13 원본 비교, numeric 자동 lowering·generic const, 정식 batch/scrollbar/style 연결과 공급 갱신이다. 전체 계획은 ACTIVE/PARTIAL이다.

## 8.49 전체 WidgetState13 원본 비교 — 2026-10-17 KST

입력292·receipt740 및 handoff hash를 재검증했다. 직전 turn은 numeric bridge와 full13 strict/Core 실행을 추가한 진전이었다. 이번에는 **전체13 선언의 원본 동작 비교**를 수행했다.

- 고정 Flutter revision의 constraint/enum/property/Mapper/lerp/controller13 전체 본문과 원본 typedef2개를 그대로 native Dart oracle에 넣었다. 원본 diagnostics·assertions·StackFrame의 전체 unit 본문과 objectRuntimeType/debugFormatDouble/clampDouble/mapEquals의 정확한 span도 hash로 확인해 사용했다. diagnostic/property/error 본문을 단순 fixture로 대체하지 않았다.
- standalone 실행에 필요한 import·annotation·build-mode flags·사용하지 않는 console sink만 harness 경계로 제공했다. native collection과 잠금 collection/listen 패키지를 사용하고 실제 읽은 package source hash도 기록했다. Flutter engine/기기 실행을 의미하지는 않는다.
- native Dart debug/release 각각20결과 묶음이 actual Core와 빌드 Core ESM을 같은 realm에서 실행한 RN Babel 결과와 일치했다. generic PropertyAll의 runtimeType/equality/hash, 비반사적 값의 receiver 호출, factory/resolveAs/callback/lerp 순서, Mapper의 우선순위·공변성·방향성 equality·nullable fallback·정확한 오류문, numeric/복합 constraint, 원본 diagnostics의 lazy formatting·property identity·4개 error part 및 controller 소유권을 포함한다.
- Dart DiagnosticsProperty.propertyType은 실제 Type이므로 oracle에서 그 문자열 표현을 비교한다. TS Core의 명시 typeName 계약과 구분하며 VM Type 객체 동일성을 주장하지 않는다. numeric TS 입력은 명시 carrier를 사용했다. 원본13 비교 통과가 numeric 자동 lowering이나 generic const의 완료를 뜻하지 않는다.
- 제품/Core/compiler/recipe의 변경은 없었다. 직전17 recipe의26개 출력과 effective 비생성531개 입력이 모두 현재 bytes와 일치함을 확인해 기존 회귀 근거를 재사용했다. 전체13 strict/d.ts·Core8묶음 근거도 유효하다. source-qualified는 **전체13의 이번 exercised contract**로 확장하지만 generated public 소비는0이다.
- 이전 archive132 감사 경로의130개 동일·DartMap source/JS2 변경 상태가 유지된다. 현재 collection package/native 공급은 계속 notVerified다.

다음은 numeric 자동 boxing/unboxing과 generic const, full13 정식 batch·scrollbar/style 연결 및 공급 갱신이다. 전체 계획은 ACTIVE/PARTIAL이다.

## 8.50 source 숫자의 scalar/erased 저장 자동 전달 — 2026-10-17 KST

입력295·receipt753 hash를 확인했다. 직전 전체13 원본 비교는 실행 근거를 확장한 진전이었다. 이번에는 수동 numeric carrier 입력에 의존하던 경계를 compiler의 실제 전달 규칙으로 확장했다.

- analyzer의 baseElement에서 substitution·flow promotion 이전 선언 저장 타입을 storageType으로 보존한다. 숫자 종류는 기존 NumericSource의 resolved core identity를 사용하며 변수 이름·값·정수 여부로 추측하지 않는다. plain List에도 analyzer element type을 기록한다.
- numericValues opt-in recipe가 scalar int/double을 Object/num/T 저장으로 넘길 때 명시 carrier를 자동 생성한다. 지역 변수·필드 초기화/대입·기본값·positional/named 인자·반환값·직접 closure·List/Map 항목에서 전달한다. conditional branch는 각 원본 종류를 보존하고 nullable 변환은 값을 한 번 평가한다.
- promoted Object 저장에서 숫자를 읽거나 checked cast 후 연산할 때 scalar를 꺼낸다. generic cast의 숫자 입력도 먼저 보관한다. num 저장은 DartNumeric으로 유지하여 종류를 잃지 않는다. 단순 대입은 boxed storage와 source expression의 scalar 결과를 분리한다. 함수 반환 공변성에 따른 직접 closure의 Object 반환도 보관한다.
- native Dart 양mode31결과와 strict/d.ts·빌드 Core ESM을 같은 realm에서 실행한 RN Babel 비교가 통과했다. 음의0, 문맥상 double인 정수 리터럴, generic cast, nullable/조건식·흐름 promotion·인자/반환·closure·Map key 동등성과 값 대입을 포함한다. num 반환의 원본 numeric annotation도 d.ts에 남는다. 누락된 imports/storage/numeric metadata·종류가 사라진 num·numeric generic 인자·covariant numeric admission6개 거부 검사를 통과했다.
- numeric generic type arguments/caller-result, num 연산, 숫자 collection widening spread/iteration, erased compound mutation, 일반 function-value/async/covariant/record 경계와 generic const는 별도다. 현재 구현을 numeric 자동 변환 전체 완료로 표시하지 않으며 해당 미지원 경계를 명시적으로 차단한다.
- 전체 WidgetState13에 opt-in을 연결하고 현재 frontend로 재추출했다. 전체13 strict/d.ts·실제 Core8묶음·원본 foundation을 포함한 native Dart/Core/RN Babel20묶음 비교가 최종 emitter로 다시 통과했다. raw JS 숫자를 임의로 분류하는 경로는 없다. public 소비는0이다.
- fresh17 회귀가 통과했고26개 생성 출력은 그대로다. 마지막 opt-in 거부 guard는 등록17 recipe에서 사용하지 않으며, 최종 emitter로 전체26을 다시 생성해 bytes를 확인했다. constraint/controller subset8 출력도 유지됐다. tree/viewer/scrollbar 후보 IR을 current frontend로 갱신하고 scrollbar38 추출·helper13 strict도 통과했다. Core build/type 검사, current 비생성531개 입력 일치를 확인했다.
- 이전 archive132 감사 경로 중130개 동일·DartMap source/JS2 변경 상태는 유지된다. 현재 package/native 공급과 새 numeric helper의 기기 실행은 notVerified다.

다음은 실제 Property<double>/int/num 호출에 필요한 numeric generic 인자·결과 경계와 generic const, 정식 batch·scrollbar/style 및 공급 갱신이다. 전체 계획은 ACTIVE/PARTIAL이다.

## 8.51 numeric generic 인자·callback·실제 WidgetState 호출 생성 — 2026-10-17 KST

입력296·receipt782와 handoff hash를 확인했다. 직전 scalar/erased 자동 전달은 구현·검증 진전이었다. 이번에는 실제 Property<double>/int/num 호출을 막던 generic 타입·callback·반환 경계를 연결했다.

- numericValues.genericTypes를 켠 모듈에서 int/double/num generic 인자와 numeric bound는 DartInt/DartDouble/DartNumeric carrier로 표현한다. scalar 선언·연산·외부 결과는 number를 유지한다. 원본 Box<double>, List<double>, T extends double/int의 numeric annotation과 bound는 public d.ts에도 보존한다. 값·이름으로 종류를 추측하지 않는다.
- analyzer는 인자에 선언 원형 parameterType과 적용 후 appliedParameterType을 함께 기록한다. 함수 호출 결과의 저장 타입과 index parameter, generic setter의 선언 타입도 보존한다. typed callback의 숫자 인자는 checked scalar로 꺼내고 결과는 generic 저장으로 보관한다. 현재 변환되는 숫자 입력 callback은 required positional 형태이며 일반 function-value/optional/named bridge는 별도다.
- 구체적인 generic 호출 결과·getter·function invocation에서 scalar를 복구한다. int/double/num 및 nullable witness를 연결했다. typed List/Map 항목·조회·key/value 대입과 검증한 iteration/spread에서 종류를 유지한다. generic T 인자와 source 필드 대입은 실제 captured witness로 검사하여 Box<double>를 Box<num>로 넓힌 뒤 int를 쓰는 경우 원본처럼 TypeError가 발생한다.
- 독립 native Dart 양mode32결과·compiler 거부6과 strict 소비자 오류·d.ts·빌드 Core ESM/RN Babel 비교가 통과했다. generic leaf bound, nullable callback, function-field 호출, 타입 공변성에 따른 잘못된 대입/메서드 인자, List/Map 경계를 포함한다. 누락 carrier/witness/applied/index 정보, callback shape 및 optional numeric callback 거부도 확인했다.
- **실제 원본 WidgetState13을 호출하는 Dart 함수10개를 추가로 추출·생성해11결과를 비교했다.** all/PropertyAll/resolveAs/resolveWith/lerp/fromMap/resolve/equality의 double/int/num/nullable 경로가 원본 foundation 전체 본문을 쓰는 native Dart 양mode 및 actual Core/compiled-Core RN Babel과 일치했다. caller에 손으로 boxed 숫자를 넣지 않는다. double generic 문맥의 정수 리터럴도 원본처럼1.0으로 보존한다. 분석용 임시 caller 파일은 소유 hash 확인 후 제거했다.
- 전체13 strict/d.ts·Core8·원본20 비교도 현재 emitter로 통과했다. 기존 scalar 전달31/거부6은 최종 generic-bound 변경 후 생성 bytes와 나머지 입력 동일성을 확인해 재사용했다. fresh17 gate·출력26·constraint/controller subset8 bytes 및 current 비생성531개가 유지됐다. 최종 bound mapping은 등록17 recipe에서 쓰지 않는 opt-in이며 current emitter 재생성으로 확인했다. tree/viewer/scrollbar metadata 갱신·scrollbar38 추출/helper13 strict·Core build와 compiler type 검사도 PASS다.
- 다음 실제 소비 경계도 확인했다: material/scrollbar_theme.dart의 ScrollbarThemeData.lerp는 lerpDouble 함수 값을 전달한다. 현재 직접 closure bridge를 이 일반 함수/host ABI 완료로 표시하지 않는다. generic const·이 함수 전달 경계·정식 batch/제품 연결은 계속 남는다.
- 이전 archive132 감사 경로 중130개 동일·DartMap source/JS2 변경 상태가 유지된다. 현재 package/native 공급과 새 helper의 기기 실행은 notVerified다. generated public 소비는0이며 전체 계획은 ACTIVE/PARTIAL이다.

## 8.52 generic const·실제 PropertyAll 상수 호출 — 2026-10-17 KST

입력299·receipt825 및 handoff hash를 확인했다. 직전 numeric generic/실제 caller 작업은 구현·검증 진전이었으며 이번에는 직접 immutable generic owner의 const 경계를 구현했다.

- analyzer는 const 변수·getter의 실제 identity에 constant metadata를 기록한다. 명시 canonical-immutable-generic-fields 정책은 closed interface 타입 인자·captured owner·final/non-late 필드·지원하는 순수 초기화만 받는다. 원본 타입/숫자 종류를 값이나 이름으로 추측하지 않는다. 상속/host owner·nullable scalar 필드·일반 함수/Type/collection 상수는 별도 경계다.
- Core는 생성자 인자가 아닌 **초기화된 필드 값과 실제 generic runtime type**으로 상수를 재사용한다. 서로 다른 인자가 같은 필드를 만드는 경우도 원본과 같다. int/double·signed zero를 구분하며 nullable generic 저장·명명 인자·중첩 승인 const를 지원한다. ordinary new는 기존대로 별도 객체다. 원본의 final 필드만 캐시에 들어가고 extra state/getter/변경 가능한 필드·미등록 일반 객체·출처 없는 숫자는 거부한다.
- 독립 native Dart debug/release22결과, compiler 거부7, strict 소비자 오류·numeric d.ts·실제 빌드 Core ESM/RN Babel 비교가 통과했다. 기존 monomorphic const 검사, 숫자 전달31/거부6과 numeric generic32/거부6도 현재 compiler로 PASS다.
- **실제 원본 WidgetState13에 PropertyAll const 정책을 연결했다.** 원본 Dart caller19개를 함께 생성한20결과가 양mode/native Dart·strict/d.ts·compiled-Core RN Babel에서 일치했다. const resolve/문자열·타입 인자 구분·int/double·signed zero·nullable·중첩 PropertyAll·ordinary new 구분을 포함한다. caller에 손으로 boxed 값을 넣지 않았으며 분석용 임시 파일은 소유 hash를 확인한 뒤 제거했다.
- 전체13 strict/d.ts/Core8 및 원본 foundation 전체 본문20묶음도 현재 입력으로 PASS다. fresh17 recipe gate·기존 출력26 bytes가 유지됐다. tree/viewer/scrollbar38 metadata를 갱신하고 Painter/helper13 strict를 확인했다. 현재 비생성 source533개 중 새 identity helper1개는 gate 실행 중 NaN 거부로 바뀌어 별도 최종 const 검사로 검증한 뒤 미소비 scratch 복사본만 갱신했다. 기존 registered recipe는 이 새 helper를 import하지 않는다.
- **NaN은 미완료이며 명시 거부한다.** native Dart는 NaN/-NaN 및 payload를 구분하지만 Bun이 숫자 저장 전에 이를 정규화하는 것을 확인했다. 현재 number 기반 carrier로 이를 복구할 수 없으므로 모든 NaN identity/const 필드는 오류를 내며 잘못 같은 상수로 합치지 않는다. 원본 비트 provenance가 필요한 별도 작업이다. 일반 equality/hash의 기존 NaN 동작과 혼동하지 않는다.
- Core build/compiler type 검사 PASS. 이전 archive132 경로는130개 동일·DartMap source/JS2 변경 상태다. 새 const/identity helper는 그 archive에 포함되지 않았으며 현재 package/native 공급은 notVerified다. full13 generated public 소비0 및 전체 계획 ACTIVE/PARTIAL을 유지한다. 다음은 실제 lerpDouble 함수값/host ABI, 필요한 const Map/외부 값 영역, 정식 batch/전체 RawScrollbar·State/style 및 공급 갱신이다.

## 8.53 함수값 numeric ABI·원본 lerpDouble 생성/소비 — 2026-10-17 KST

입력302·receipt868과 handoff hash를 확인했다. 직전 직접 generic const 작업은 구현·검증 진전이었다. 이번에는 실제 ScrollbarThemeData.lerp 패턴에서 필요한 lerpDouble 함수 전달을 연결했다.

- analyzer는 함수 참조와 호출 결과를 구분한다. identifier/property의 executable 참조에는 전체 원형 function signature를 기록하고, index·invocation에는 반환 저장 타입을 남긴다. 초기에 Map [] 결과까지 함수로 분류되어 기존 numeric generic strict 검사가 실패했으며, AST 종류를 정확히 제한한 후32결과/거부6 회귀를 다시 통과했다. 타입·값의 이름이나 숫자 모양으로 종류를 추측하지 않는다.
- 명시 numericFunctions 정책은 required positional 함수값의 scalar↔generic 숫자 표현을 typed thunk로 변환한다. top-level/static/instance tear-off, getter 평가1회, generic 저장/역방향 반환, nullable 함수, void callback의 반환값 폐기, 원본 오류 전달을 확인했다. 캐시는 실제 원본 함수와 변환 서명을 사용하며 void 폐기와 Object 반환을 구분한다. 원본 함수 identity/equality/hash는 표현 래퍼를 통과해 유지된다. nested/optional/named·generic-method tear-off·function runtime type은 별도다.
- scalar-numeric host 정책은 exact 원본 함수 identity/import와 연결된다. num 인자는 명시 carrier에서 값만 꺼내며, 출처 없는 scalar num 반환은 거부한다. double/int 반환 종류는 analyzer signature를 따른다. 함수 전용 검증은 native Dart 양mode28결과·compiler 거부5, strict 소비자/d.ts·실제 빌드 Core ESM/RN Babel에서 PASS다. receiver-first null-aware call의 receiver1회·null 시 인자 생략도 원본과 비교했다.
- **고정된 engine dart:ui의 lerpDouble 전체 함수를 정식 recipe로 생성·promote했다.** 일반 분석에서 제외된 engine part는 실제 embedded dart:ui library를 해석해 정확한 unit을 선택한다. 원본 본문을 다른 라이브러리로 바꿔 분석하지 않는다. 입력 null/equal/NaN·무한대·signed zero·보간/외삽·debug assertion24개가 원본 Dart 양mode와 실제 Core에서 일치했고, compiled-Core RN Babel24 및 numeric d.ts도 확인했다. assertion은 기존 Nelyx invariant 정책을 사용한다. NaN 산술과 미완료인 NaN identity/const는 구분한다.
- 실제 원본 WidgetState13과 Dart caller25개를 함께 생성한25결과가 양mode/native Dart·strict/d.ts·compiled-Core RN Babel에서 PASS다. Property.lerp<double?>에 원본 lerpDouble을 직접 넘기거나 지역 변수에 저장한 후 전달하는 경우, num 입력 직접 호출, 생성한 원본 callback 함수 전달을 포함한다. caller에 수동 boxed 입력을 넣지 않는다. 원본 foundation/WidgetState와 새 lerpDouble의 전체 본문을 oracle로 사용했으며 임시 분석 파일은 소유 hash 확인 후 제거했다. ScrollbarThemeData 클래스 전체 통합 완료를 뜻하지 않는다.
- 전체13 Core8/원본20, const22/거부7, 숫자 전달31/거부6, numeric generic32/거부6, Object value40 회귀가 통과했다. recipe18 gate는 최종 opt-in 함수 규칙/index metadata 수정 전에 실행됐으므로 **최신 frontend로 전체 IR를 다시 추출하고 최신 emitter가 gate 출력27개를 정확히 재현하는지 별도 확인했다.** 기존26 출력과 기존17 batch 상태를 보존했고 새 lerpDouble1개만 추가됐다. 모든 기존 recipe는 numericFunctions를 사용하지 않는다. current 비생성 source534개도 gate 복사본과 일치하며 tree/viewer/scrollbar38 metadata 및 Painter/helper13 strict를 갱신했다.
- 새 recipe의 NelyxContract/sourceComparison은 각각 PASS이고 현재 tool fingerprint로 promote됐다. inventory에도 dart:ui 선택을 연결했다. Core build/compiler types PASS, 이전 archive132 중130개 동일·DartMap source/JS2 변경 상태다. 새 함수/lerp helper는 이전 archive에 없으며 현재 package/native 공급은 notVerified다. full13 제품/public 소비0과 전체 ACTIVE/PARTIAL은 유지한다. 다음은 필요한 const Map/외부 값 영역, full13 batch와 전체 RawScrollbar/State/style 연결 및 공급 갱신이다.

## 8.54 immutable const Map·실제 Mapper와 모듈 간 const 공유 — 2026-10-17 KST

직전 입력312·receipt926과 handoff hash를 확인하고, 기존 WIP를 유지하며 const Map/Mapper 소비 경계를 구현했다.

- 원본 plain const Map의 순서·정확한 타입 인자·숫자 종류와 signed zero를 보존한다. 실제 DartMap 저장소와 내부 조회/반복 메서드를 JS private로 보호하고 freeze 이후 no-op을 포함한 모든 변경을 callback 실행 전에 거부한다. 순서가 다른 Map은 내용 동등성/해시가 같아도 같은 const 객체로 합치지 않는다. 중복 키·double 키·출처 없는 숫자·임의 frozen 객체 키는 거부한다. 고정 Dart에서도 double 및 hashCode override 키의 primitive equality 제한을 확인했다.
- 명시 등록한 enum/singleton과 원본 기본 Object equality를 가진 const 객체·중첩 const Map을 키로 허용한다. nullable/bool/string/int 키와 int-key/double-query 동등성, nested Map/value, 일반 mutable Map 구분을 native Dart 양mode·실제 Core·compiled-Core RN Babel26결과/거부4 및 strict/d.ts로 검증했다. Map의 공개 generic interface를 보관하며 VM private const Map runtimeType은 추측하지 않는다.
- 원본 WidgetStateMapper의 Diagnosticable base는 exact constructor/mixin·무상태 계약으로 검증했다. WidgetStateProperty.fromMap const redirect는 원본 required positional forwarding만 허용한다. 생성기는 PropertyAll/Mapper/redirect의 generic const 공개 함수를 원본 생성자에서 자동 방출한다. 외부 호출자는 exact owner/import/type witness 경계로 이 함수를 사용하며 private 필드나 원본 알고리즘을 수기로 복제하지 않는다.
- 실제 원본 WidgetState caller16개를 별도 소비자 모듈로 생성했다. 15결과가 원본 debug/release·strict/d.ts·compiled-Core RN Babel과 일치하고, 객체를 반환하는 추가 caller로 두 모듈이 같은 frozen const Mapper를 공유함을 확인했다. 잘못된 factory import/owner/type binding/host base/redirect6종도 거부한다. PropertyAll<double>의 정수 literal 문맥과 PropertyAll<num>의 int/double 구분, const와 일반 factory의 객체 구분, nullable fallback, enum/any 키, 순서·동등성·해시·covariance를 포함한다.
- 전체 WidgetState13 strict/Core8/원본 foundation20 및 기존 numeric caller25, generic const22/7·함수28/5·numeric generic32·전달31·value40 회귀가 PASS다. 최신18 recipe gate·최종 IR/출력27 byte 동일·비생성 source534와 기존17 batch 상태 보존, Painter/helper13 strict를 확인했다. 기존 lerpDouble recipe는 현재 compiler fingerprint로 다시 검증했다. Core build/compiler types PASS다.
- full13의 정식 batch/public 소비는 아직0이다. NaN const identity, function/Type constants, const spread/control-flow, 추가 host/상속 const와 callable 영역은 명시적으로 별도다. 이전 공급 archive132 중130개 동일·Map source/JS2 변경 상태이며 새 helper의 현재 package/native 공급은 notVerified다. 전체 ACTIVE/PARTIAL을 유지하고 full13 정식 배치와 실제 RawScrollbar/State/style 연결을 다음 작업으로 둔다.

## 8.55 WidgetState 전체13 정식 source 배치·수정 보존 — 2026-10-17 KST

입력315·receipt995와 handoff/pin/dirty 상태를 검증한 후, 직전 const Map 작업의 전체13 후보를 정식 배치에 연결했다.

- 고정 widget_state.dart의 constraint·enum·property·Mapper·controller 전체13을 **19번째 recipe / 28번째 생성 출력**으로 내부 승격했다. 검증된 full collection host는 Core 경로에, 수동 token/value 등록 선언은 배치 inputs 경로에 연결했다. listen/meta/collection의 잠금 version/archive/library와 수동 입력·host·필수 fixture가 fingerprint에 포함된다. 공용 facade나 RawScrollbar의 기본 소비 완료를 뜻하지 않는다.
- contract와 source gate는 실제 effective 생성 파일을 그대로 검사한다. 숫자/const caller의 함수만 추가 생성하며 producer 클래스 본문은 검증 대상 bytes를 보존한다. 원본 oracle는 현재 고정 source와 추적된 foundation/alias/lerp manifest로 구성하고 과거 progress/임시 receipt/다른 배치 IR에 의존하지 않는다. 실제 로드한 compiled-Core dependency가 effective source와 일치하는지도 확인한다.
- full13 strict/d.ts·Core/RN Babel8, 전체 원본/foundation 양mode20묶음, numeric caller25결과와 const caller16개15결과·모듈 간 identity·거부6이 필수 gate에서 PASS다. NelyxContract와 sourceComparison은 각각 PASS이며 원본13 provenance와 정확한 batch fingerprint를 보관했다.
- 실제 등록 배치의 lifecycle9건이 통과했다. host/manual/fixture 변경의 fingerprint 갱신, 독립 수정 보존, 실제 effective resolve 파손의 검증 실패, 겹치는 클래스 수정의 merge 충돌 보존, collection pin 거부, 필수 source 실패 시 승격 차단을 확인했다. product·recipe·host·manual·fixture·patch를 원복했고, 의도적으로 파손된 임시 effective 산출물도 최종 validate로 다시 검증한 뒤 promoted 상태를 복구했다.
- 새19 recipe 전체 gate가 PASS다. 기존27 생성 출력과 이전18 batch 상태를 보존했고 새 출력1개만 추가됐다. 비생성 source535개가 현재 bytes와 일치하고 Core ESM/d.ts/source-map build도 통과했다. inventory19 선택에 full13을 연결했다. 이전 archive132 중130개 동일·Map source/JS2 변경 상태를 유지하며, 새 generated/host의 현재 package/native 공급은 notVerified다.
- 전체는 ACTIVE/PARTIAL이다. 최신 전체38 probe에서도 네 모듈의 superclass/const/mixin 첫 binding 장애를 확인했다. 이미 검증한 Painter/gesture13과 새 WidgetState13의 경계를 전체 RawScrollbar/State15에 합친 뒤 Material/theme/Cupertino 생성·기본 소비에 연결한다. 미지원 const/host/callable 영역은 실제 소비자가 요구하는 범위에서 원본 근거와 함께 확장하며 물리 IME/FPS·후속 파트는 계속 남는다.

## 8.56 전체 RawScrollbar/State15 생성·실제 Core 입력 후보 — 2026-10-17 KST

입력326·receipt1070 및 handoff를 확인했다. 직전 WidgetState13 정식 배치 승격은 진전이었으며, 이번에는 기존 Painter/gesture13 경계를 RawScrollbar/State까지 합쳤다.

- widgets/scrollbar.dart 전체15를 주 후보 module에 연결하여 결정적 생성·strict0을 통과했다. 원본 widget/State 본문·private helper를 보존하고, 기존 Painter·recognizer와 실제 generated WidgetState13을 사용한다. 생성 파일은 아직 scratch 후보이며 기본/public 소비0이다. Material/theme/Cupertino23의 초기 const/mixin binding 장애는 그대로 명시한다.
- 실제 State의 didUpdateWidget(covariant T oldWidget)에서 발견한 공통 compiler 경계를 수정했다. 정확한 lexical class witness로 공변 T와 nullable T를 검사하며 숫자 generic 정책을 요구하지 않는다. 잘못된 값은 본문 실행 전에 TypeError로 거부한다. top-level getter는 exact import·읽기 전용·인자 없는 adapter로 연결하고, import prefix도 analyzer의 PREFIX identity로 확인한다. 독립 Dart 양mode15결과/거부5·strict/d.ts·compiled-Core RN Babel이 통과했다. 기존 class witness39·numeric generic32도 재검증했다.
- State/StatefulWidget/Ticker의 실제 Core 생성자와 타입 관계, GlobalKey, Timer 취소, MediaQuery padding, notification token과 gesture factory token/ordered Map, CustomPainter 변환을 명시적인 host로 연결했다. post-frame과 pointer signal은 현재 State의 실제 Element/Root 서비스를 사용한다. global View나 간소화된 Scrollbar 상태 머신을 만들지 않는다. source enum/Property의 실제 owner를 cursor Set에 사용하며 SystemMouseCursor 및 generated PropertyAll/Mapper의 가상 동등 비교도 유지한다.
- 실제 Core/CanvasKit Root18 및 생성 TS/host의 RN Babel18이 debug/release에서 통과했다. 원본 전체 widget/State mount와 실제 list metrics·paint, Root 소유 recognizer, thumb drag·실제 ScrollPosition 이동·track page, pointer signal 1회 처리, generated enum/property cursor 상태, State 유지 업데이트·비활성화/재생성·fade, active-drag Root 종료를 포함한다. 초기 animation은 실제 notification microtask와 첫 ticker frame을 전달한 뒤 확인한다. 잘못된 oldWidget도 실제 State 경계에서 거부된다. 이는 native 디바이스나 물리 pixel/FPS 검증이 아니다.
- fresh19 전체 gate가 PASS이며 최신 compiler가 기존 생성 출력28개를 같은 bytes로 재현한다. 비생성 source535개와 현재 bytes가 일치하고 기존19 accepted batch 상태를 보존했다. compiler types PASS, Core 소스는 변경하지 않았으며 이전 build/helper 근거의 유효 범위를 유지한다. 현재 package/native 공급은 계속 notVerified다.
- 전체는 ACTIVE/PARTIAL이다. 전체 RawState15의 독립 원본 Dart 비교와 잔여 edge case, Material/theme/Cupertino23 및 외부 generic 상속·theme 경계, 정식 raw 배치/default/public 연결·현재 공급이 남는다. source method를 잘라 대체하거나 미지원 의미를 추측하지 않고 다음 단계에서 이어 간다.

## 8.57 전체 RawScrollbar/State15 독립 원본 비교 — 2026-10-17 KST

입력329·receipt1106 및 handoff hash를 확인했다. §8.56에서 남겨 둔 전체 RawState의 독립 Dart 비교를 추가했으며, compiler·제품 소스·기존19 배치 상태는 변경하지 않았다.

- 원본 widgets/scrollbar.dart 전체15와 WidgetState13, foundation helper 및 assertions/diagnostics/stack-frame 전체 본문을 hash·offset/span으로 확인하여 그대로 실행한다. UI 자료형·외부 프레임 완료·physics/hold/drag receiver는 제어 가능한 경계다. RawScrollbar의 build·드래그 계산·커서 해석·notification·private helper 본문은 대체하지 않았다. 사용하지 않는 track-page/pointer 활동은 oracle에서 명시적으로 거부하며, 해당 실제 동작은 §8.56의 Core Root 근거로 분리한다.
- 독립 Dart debug/release 각각72개 관측 기록이 실제 Core/CanvasKit Root와 일치했다. 같은 생성 TS/host를 RN Babel로 실행한 비교도 양mode 각각72개가 일치한다. 모드별 네 방향 Root 묶음과 네 constructor assertion 검사이며, 숫자는 유한성 및 상대 오차를 검사하고 null·bool·상태 목록은 정확히 비교한다.
- 네 방향의 드래그·desktop extent clamp·mobile overscroll·외부 physics 보정·metrics 축소 후 방향 보정, 동일 위치/physics 거부 시 입력 무시를 확인했다. 여섯 pointer kind의 hover/drag/end, 마우스·trackpad 종료 후 hover 해제와 touch/stylus의 별도 mouse hover 보존, 새 객체이지만 같은 커서일 때 불필요한 setState 없음, interactive 해제·scroll extent 소멸 시 stale 상태 정리, 축과 notification depth filtering도 일치한다. 잘못된 constructor 값은 debug assertion으로만 거부되고 release에서는 원본과 동일하다.
- 이전 strict/Core18/Babel18과 동일한 생성 출력이며 현재 Core 복사 입력과 원본 bytes가 일치한다. 기존19 recipe/28 생성 출력/535 비생성 source 및 batch 상태 hash를 보존했다. 신규 비교와 원본 입력 manifest·실행 로그를 immutable receipt에 기록했다. native oracle의 즉시 animation 완료는 실제 ticker/curve 또는 Flutter engine pixel 검증을 뜻하지 않는다.
- **전체는 ACTIVE/PARTIAL**이다. Raw 후보의 정식 effective gate/배치·default/public 소비는 아직0이며, Material/theme/Cupertino23·외부 generic 상속 및 theme/const 값 경계, 현재 package/native 공급과 물리 입력·성능은 남는다. 다음 단계는 전체 style23 연결과 Raw 정식 배치로 이어진다.

## 8.58 외부 generic 부모 ABI·Cupertino 전체 의존성 추출 — 2026-10-17 KST

입력333·receipt1127 및 handoff/pin을 확인했다. Material/Cupertino State가 다른 모듈의 RawScrollbarState<T>를 상속하는 경계를 공통 생성기에 추가했다. 현재 제품·기존 배치 상태는 변경하지 않았다.

- exact super-constructor binding의 명시적 typeWitnessArguments 계약으로 원본에서 해석된 부모 타입 인자를 전달한다. arity/order·import·nullable/nested 타입을 검증하며, 값이나 이름으로 추측하지 않는다. 같은 모듈의 부모는 기존 declaration 기반 ABI를 유지하고 외부 계약의 덮어쓰기를 거부한다.
- 독립 원본 producer/consumer 전체 클래스를 별도 TS 모듈로 생성하여 Dart debug/release28결과·거부7·strict/d.ts·compiled-Core RN Babel을 통과했다. fixed/nullable/nested/swapped 타입 인자, 다단 상속의 lexical capture, positional/named-options 호출과 본문 실행 전 공변 거부를 포함한다. 이 공통 기능 검증을 실제 style 통합 완료로 간주하지 않는다.
- 기존 class39·covariance15·numeric32와 compiler types가 PASS다. fresh19 전체 gate가 기존28 effective 출력과 동일한 bytes를 재현했고535 비생성 source 및19 batch 상태를 보존했다. 전체 Raw15 원본 비교도 debug/release72기록이 PASS이며 이전 생성 출력과 같다.
- CupertinoDynamicColor 제품 구현이 없어 원본 전체 클래스·진단 helper와 interface-level enum/widget을 추가4개 closure로 선택했다. 기존 scrollbar38 선택은 유지한다. 전체4 중3개가 IR 추출됐고, CupertinoDynamicColor는 (Brightness, CupertinoUserInterfaceLevelData, bool) record pattern에서 명시적으로 막혔다. 이는 첫 frontend 장애이며 이후 lowering/const/named-constructor/Color 계약도 별도 검증 대상이다. 밝기·고대비·elevation을 간소화한 대체 구현은 추가하지 않았다.
- **전체는 ACTIVE/PARTIAL**이다. 다음은 공통 record-pattern 규칙과 원본 전체 동적 색상 closure, Material/theme/Cupertino23 연결이다. Raw 정식 effective gate/배치·default/public 소비0과 현재 native 공급·물리 입력/성능은 계속 미완료다.

## 8.59 record switch 표현식 공통 지원·현재 frontend 갱신 — 2026-10-17 KST

입력335·receipt1161 및 handoff hash를 확인했다. 기존 positional record switch 문의 필드 매칭 규칙을 표현식에도 공유하여 Cupertino 동적 색상 원본의 첫 장애를 해소했다.

- analyzer가 제공한 non-null positional record shape와 상수/wildcard 필드 경로를 IR에 보존한다. selector를 한 번 평가하고, 중첩 필드를 순서대로 비교하며 선택된 결과식만 실행한다. 마지막 wildcard와 원본의 exhaustive enum 조합을 처리하고 외부의 잘못된 값에는 명시적 오류를 낸다. guarded/binding/type/named/nullable-selector/or-record pattern은 여전히 거부한다.
- 독립 Dart debug/release14묶음·frontend 거부6·emitter 거부6, strict/d.ts·compiled-Core RN Babel이 PASS다. 밝기/elevation/고대비8조합, single evaluation·lazy throw 결과, nested/wildcard/nullable field·숫자 동등 비교·first-match 우선순위를 확인했다. 입력과 다른 shape의 record 반환 회귀에서 타입 정보 충돌을 재현해 matchedType과 결과 recordType을 분리했다. 기존 positional record 생성·분해·switch 문 회귀도 PASS다. 숫자 주석은 기존 analyzer provenance를 유지한다.
- 현재 frontend로 scrollbar38 및 WidgetState13을 재추출했고 이전51개 IR record와 정확히 동일함을 확인했다. 후보의 frontend receipt만 현재 기준으로 갱신했다. fresh19 전체 gate와 기존28 effective 출력 동일성,535 비생성 source 및19 batch 상태 보존, 전체 Raw15 원본 비교 양mode72기록을 확인했다. compiler types와 Dart analyzer도 PASS다.
- 전체 CupertinoDynamicColor는 record pattern을 통과한 뒤 생성자 내부의 this._(...) 리다이렉트에서 명시적으로 막혔다. 추가 closure는 여전히4개 중3개 IR이며 전체 클래스 본문을 잘라 대체하지 않았다. 다음은 공통 generative constructor redirect의 인자 평가·default·final-field·const identity 규칙과 전체 색상 closure를 이어 간다.
- **전체 ACTIVE/PARTIAL 유지.** 실제 Material/theme/Cupertino23 통합, Raw 정식 batch/default/public 소비0, 현재 native 공급·물리 입력·성능은 별도 미완료다.

## 8.60 일반 generative redirect·전체 Cupertino 의존성4 IR — 2026-10-17 KST

입력336·receipt1187 및 handoff hash를 확인했다. this(...)·this.named(...)를 같은 객체의 초기화 계획으로 처리하는 공통 compiler 계층을 추가했다. 현재 제품·기존 배치 상태는 변경하지 않았다.

- analyzer가 실제 생성자와 parameter identity를 보존하고, source 순서의 명시적 인자를 한 번씩 저장한 뒤 대상 기본값·parameter 검사·필드 초기화·assertion·super·본문으로 연결한다. 다단 리다이렉트도 한 객체를 초기화한다. 합성 변수는 recipe import/adapter 이름까지 피하며, 다른 생성자 본문의 지역 변수와 원래 formal이 충돌하지 않도록 범위를 보존한다. factory/foreign/cycle·누락/중복 인자 등은 거부한다.
- 독립 Dart debug/release12묶음·거부9, strict/d.ts·compiled-Core RN Babel이 PASS다. 명명된 인자의 평가 순서, optional/default, 선언 필드 초기화, mutable parameter, 기존 필드/최종 값, 생성자 조기 종료와 내부 함수 return 분리·본문·상속의 실제 constructor/prototype를 확인했다. 기존 named·named-only·constructor-field 회귀도 통과했다. 일반 생성과 redirected const identity는 분리하며 후자는 아직 명시적으로 차단한다.
- 원본 CupertinoDynamicColor·진단 helper·interface-level enum/widget 전체4개가 IR 추출됐고 frontend 장애0이다. 원본 동적 색상의 기본/withBrightness/withBrightnessAndContrast 세 경로가5단계의 초기화 계획으로 변환됐다. 모든 필드와 메서드 본문은 그대로 보존했다. 이는 전체4 IR/constructor-plan 검증이며, 전체 색상 TS 생성·strict·원본 동작·theme/Color host 또는 const 검증 완료는 아니다.
- 새 compiler 계층은 정식 tool fingerprint와 Raw 후보 입력 manifest에 포함했다. 현재 frontend51 IR은 이전과 동일하고 fresh19 전체 gate가28 effective 출력·535 비생성 source·19 batch 상태를 보존했다. 전체 Raw15 원본 비교는 양mode72기록 PASS, compiler types/Dart analyzer도 PASS다.
- **전체 ACTIVE/PARTIAL 유지.** 다음은 redirected const의 실제 field-plan canonical identity와 전체 색상/테마 closure·style23이다. Raw 정식 batch/default/public 소비0, 현재 native 공급·물리 입력·성능은 별도 미완료다.

## 8.61 생성자 경로 간 const field identity·외부 factory — 2026-10-17 KST

입력339·receipt1218 및 handoff hash를 확인했다. 기존 canonicalDartObject pool을 재사용하여 monomorphic 기본/named generative const가 최종 필드 값과 정확한 타입에 따라 같은 객체를 공유하도록 연결했다. Core runtime·제품 파일은 변경하지 않았다.

- 새로운 명시적 field-plan 정책이 대상 const 생성자·owner identity, 기본값·중간 redirect 변수·최종 initializer의 순수성, final/non-late 필드, 정확한 stateless host base 계약을 검증한다. 숫자 종류는 analyzer provenance로 유지하며 int/double·signed zero를 임의로 합치지 않는다. 허용하지 않은 host 값과 nullable scalar field·generic redirect는 계속 차단한다.
- named 생성자에도 정확한 class capture를 남긴다. 정적 self const 초기화에서 외부 class 변수가 아직 준비되지 않은 경우를 피하도록 실제 owner token을 helper에 전달한다. optional/named ABI를 보존하는 producer-owned const factory와 exact 외부 factory binding을 추가했다. 동일 초기 상태를 만드는 서로 다른 인자/생성자 경로도 공유하며 일반 생성은 별도 객체다.
- 독립 Dart debug/release26결과·거부12, strict/d.ts·compiled-Core RN Babel이 PASS다. 기본/named/private 경로, unused/normalized 인자, int/double·-0.0, 중첩 상수, 정적 self const, 두 모듈 간 공유, 실제 Core Diagnosticable stateless base와 일반 생성 분리를 확인했다. 기존 generic const22·class39·일반 redirect12·named-only 회귀도 PASS다.
- fresh19 전체 gate가 기존28 effective 출력과535 비생성 source 및19 batch 상태를 보존했다. 전체 Raw15 원본 비교는 양mode72기록 PASS, compiler types도 PASS다. 기존 배치의 검증 완료 fingerprint를 새 검증으로 덮어쓰거나 제품을 승격하지 않았다.
- **전체 ACTIVE/PARTIAL 유지.** 공통 const 규칙 검증을 실제 CupertinoDynamicColor의 Color 값·interface/host·전체 동작 검증으로 간주하지 않는다. 다음은 정확한 Color constant admission과 전체 색상/테마 closure·style23이며 Raw 정식 batch/default/public 소비0, 현재 native 공급·물리 입력/성능은 남는다.

## 8.62 Color 상수 값 영역·전체 원본 비교 — 2026-10-17 KST

입력340·receipt1249, handoff hash와 Flutter pin을 다시 확인했다. Core Color의 기존 부동소수 표현을 재사용하는 source adapter를 후보에 추가하고, 검토한 host 필드 상수를 생성 클래스의 중첩 const에 연결했다. Core/제품 파일은 변경하지 않았다.

- 명시적 canonical-immutable-host-fields 정책은 exact owner/생성자/import·숫자 표현·analyzer parameter provenance·순수 인자를 요구한다. 기존 host 상수를 모두 중첩 허용으로 바꾸지 않는다. 네 Color 생성 경로를 실제 초기화된 a/r/g/b/colorSpace와 정확한 타입으로 같은 pool에 연결했다.
- 독립 Dart fixture는 pinned painting.dart의 **전체 Color·ColorSpace·색 변환 helper 본문**과 lerp 본문을 그대로 사용한다. Core/Babel과 debug/release29기록이 일치한다. 네 생성 경로·상위 비트/음수/채널 modulo·float precision·signed zero·세 색 공간·범위 밖 채널·중첩 const·동등성/hash 관계를 확인했다. 같은 ARGB32라도 float 값이 다르면 합치지 않는다.
- strict/d.ts·compiled-Core RN Babel 및 잘못된 compiler 계약6건 거부 PASS. 잘못된 owner/색 공간·NaN provenance·부정확한 숫자 입력·일반 Color의 중첩 const 유입도 차단했다. 기존 generative26/12·fresh19 gate·출력28·비생성535·batch 상태19를 보존했고 compiler types가 PASS다.
- **전체 ACTIVE/PARTIAL 유지.** Color 상수 영역은 검증했지만 전체 CupertinoDynamicColor의 interface/ordinary-result·진단·테마 서비스 binding과 source 동작 검증, Material/theme/Cupertino23 및 Raw 정식 batch/default/public·현재 native 공급은 남는다. 생성 제품 소비는0이다.

## 8.63 전체 style 의존성5 생성·상속 상수 기본값·레코드 규칙 — 2026-10-17 KST

입력342·receipt1269와 pin/handoff hash를 확인했다. 전체 dynamic-color 진단 경로에 필요한 **ColorProperty 전체 클래스**를 추가했다. 원본 ColorProperty JSON 본문을 대체하거나 제거하지 않았다.

- super.defaultValue가 상속받은 객체 상수를 analyzer의 정확한 top-level getter identity로 유지한다. 같은 이름의 다른 library 상수, 반복 호출, 명시적 null/override와 기존 scalar 기본값을 독립 Dart 양mode7묶음·거부2·strict/d.ts로 검증했다. 직접 객체 생성/default static field 등 검토하지 않은 경로는 계속 차단한다.
- numeric ABI가 켜진 상태에서도 analyzer가 증명한 enum/bool/String 레코드 필드를 허용했다. 숫자/범용 Object 레코드는 계속 차단한다. 원본 record14묶음의 enum 분기9기록이 numeric ABI·Core·compiled-Core RN Babel에서 일치하고 추가 거부2를 확인했다.
- CupertinoDynamicColor/createCupertinoColorProperty/interface-level2/ColorProperty **전체5 선언을 추출하고3모듈로 생성**했다. 생성 후보는 원본의 모든 필드·메서드·진단 경로를 포함하지만 **실제 host 계약 미연결로 strict60 오류가 남은 PARTIAL**이다. Color interface/ordinary-result, 진단 JSON 변환, inherited lookup, nullable theme brightness와 MediaQuery 우선순위가 다음 연결 대상이다. 기존 선택 UI용 테마를 원본 전체 테마로 간주하지 않는다.
- 기존 scrollbar38·WidgetState13 IR은 정확히 동일하며 frontend fingerprint를 갱신했다. Color29·Raw 양mode72·fresh19 전체 gate·생성28/비생성535/batch 상태19 보존, Dart analyzer·compiler types가 PASS다. 기존 제품·검증 완료 batch fingerprint는 변경하지 않았다.
- **전체 ACTIVE/PARTIAL 유지.** 전체 style5 strict/원본 동작, Material/theme/Cupertino23, Raw 정식 batch/default/public·현재 native 공급 및 잔여 W10 요구는 미완료다.

## 8.64 전체 style5 host·원본24·Root 의존성·const factory — 2026-10-17 KST

입력344·receipt1314 및 handoff/pin을 확인했다. 실제 Core inherited widget·진단 객체·MediaQuery와 Cupertino 테마에 전체 style5 후보를 연결하여 strict 오류60개를0개로 줄였다. 원본 메서드는 유지했다.

- 테마의 명시적 밝기를 보존하는 specifiedBrightness와 maybeBrightnessOf, MediaQuery 밝기/대비 조회를 연결했다. 테마 지정값이 없으면 MediaQuery로 내려가며 Query 자체가 없으면 null이다. 기존 선택 팔레트 기본값은 보존한다. **MediaQuery 입력 계약의 검증이며, 실제 OS 밝기 producer·변경 전파는 별도 미완료**다.
- ColorProperty의 전체 원본 Map/JSON 메서드를 생성하고, 실제 Core DiagnosticsProperty와 source Map 사이에 변환 경계를 뒀다. 원본 int 채널은 DartInt로 보존하고 provenance 없는 host number는 추측하지 않는다. 원본 비교에서 발견한 Core 진단의 equals(null) 직접 호출을 공통 경계에서 수정했다. 객체와 null의 비교가 사용자 연산자를 부르지 않는 Dart 규칙을 따른다.
- 독립 Dart oracle은 전체 style5·UI Color/transform·foundation diagnostics 본문을 사용한다. 실제 Core Root와 source RN Babel이 **debug/release 각각24기록**과 일치한다. 밝기/대비/높이8조합, 조회 순서·불필요한 의존성 생략·fallback, 색상 연산·동등성/hash, 진단 문자열/JSON·resolved context, 기본/named const 공유·label 차이·일반 생성 분리를 확인했다. 실제 Root의 동일 값 억제·대비/높이 변경 rebuild12건과 JSON 숫자 경계8건도 PASS다.
- strict/d.ts와 숫자 주석, Core/design 빌드, 기존 선택 테마8·Raw 양mode72·fresh19 gate가 PASS다. 기존 생성28과 batch 상태19는 유지했고 비생성535 중 의도한 product source3(진단·MediaQuery·CupertinoTheme)만 바뀌었다. 나머지532는 이전 후보와 같으며 현재535가 검증 복사본과 일치한다.
- **전체 ACTIVE/PARTIAL 유지.** style 생성 제품 소비0이며 Material/theme/Cupertino23, Raw 정식 batch/default/public·공급, 실제 밝기 producer와 물리 입력/성능 등 잔여 W10 요구가 남는다. 이번 Babel은 source 후보 실행이며 compiled-Core/native 공급 검증으로 확대하지 않는다.

## 8.65 숫자 레코드·외부 generic 호출·전체 Material10 생성 — 2026-10-17 KST

입력353·receipt1348 및 handoff/pin을 검토했다. 전체 Material/theme/Cupertino23을 기존 Raw15와 style5 producer에 연결하면서 확인한 공통 변환 경계를 보완했다. 원본 본문을 잘라내거나 수동 대체하지 않았다.

- positional/named 레코드의 int/double 필드는 명시 carrier로 보관하고 읽기·분해에서 원본 scalar로 복원한다. Object/num 확장, nullable/nested/generic 레코드, 숫자 pattern 동등성 및 평가 횟수를 원본25묶음·거부4·strict/d.ts·compiled-Core RN Babel로 검증했다. const 레코드·구조적 equality 전체는 별도 미완료다.
- 별도 생성 모듈의 generic 정적 메서드를 정확한 owner/member와 resolved 인자·숨은 type witness ABI로 호출한다. 명시/추론·두 타입 인자·named 평가 순서·callback/tear-off·runtime type 및 nullable callable ??의 단일 평가/지연 fallback을 원본18묶음·거부9·strict/d.ts·compiled-Core RN Babel로 검증했다.
- numeric super-formal 인자의 parameter/applied/storage 타입을 analyzer에서 유지했다. 독립 원본 기본값7묶음·거부2가 PASS다. 전체38+13+5 선언을 재추출했으며 CupertinoScrollbar/_MaterialScrollbar 두 선언의 provenance9개만 추가됐다. 기존 Raw15·WidgetState13·style5 IR은 그대로다.
- 전체23 probe에서 Material10이 생성된다. 테마3은 DiagnosticsProperty generic 생성자, Cupertino10은 Future<void> 콜백에서 차단된다. 생성 범위 strict6은 미생성 테마/Cupertino 및 Material host 모듈 참조다. **Material10은 생성 후보이며 전체 동작·strict 완료가 아니다.** nullable const/theme/haptic/View 경계와 whole23 원본 비교가 남는다.
- record14(기존 numeric ABI9), style 양mode24·Root 의존성12·JSON8, Raw 양mode72, fresh19 gate, Dart analyzer·compiler types PASS. 기존 생성28·비생성 제품535·batch 상태19를 모두 보존했다. 제품 수정과 새 제품 소비는0이다.
- **전체 ACTIVE/PARTIAL 유지.** Raw 정식 batch/default/public·공급, whole23, OS 밝기 producer와 물리 입력/성능 및 잔여 W10 요구를 계속한다.

## 8.66 전체 themed23 생성·Cupertino Root·진단 경계 — 2026-10-17 KST

입력357·receipt1427과 handoff/pin을 재검토했다. 기존 공통 변환기를 바꾸지 않고 전체 Material10/theme3/Cupertino10을 원본 그대로 생성했다. Raw15/style5를 합하면43개 선언이다.

- 원본 generic DiagnosticsProperty의 bool/Radius/WidgetStateProperty 타입 이름과 double carrier/JSON을 실제 Core 진단 객체에 연결했다. 전체 원본 foundation 본문과 debug/release 각각13기록이 일치하며 provenance 없는 숫자는 거부한다. nonnull 상태 property 값의 전체 진단 동작은 별도 미완료다.
- Cupertino Future<void> 콜백과 double.abs를 정확한 실제 API로 연결했다. haptic은 현재 mounted State의 View platform channel을 사용한다. 전체 Cupertino10은 독립 strict/d.ts가 통과했고 실제 Core Root 및 source RN Babel **각14건**이 PASS다. 장착/paint·실제 포인터 스크롤, 두께 애니메이션 완료·취소, numeric record 축 선택/release, 정확한 JSON haptic 호출·중복 억제와 View 종료를 확인했다. 제어된 messenger 검증이며 실제 기기 진동 증거가 아니다.
- 소비자 진입점에서 드러난 Raw 호스트↔생성 recognizer의 ESM 초기화 순환을 factory 별도 모듈로 분리했다. Raw 생성 결과는 해당 import3개 경로만 변경됐으며 본문은 동일하다. Raw Root18·원본 양mode72, style 양mode24 회귀가 PASS다.
- **전체23 생성은 완료했지만 strict5가 남는다.** 오류는 실제 Material 테마 연결 파일 누락이다. ThemeData의 scrollbarTheme/highlightColor, ColorScheme Color 경계, nullable scalar const/canonical 기본 테마 및 전체23 독립 원본 비교를 계속한다. 임시 테마 값을 만들어 완료로 처리하지 않았다.
- 기존 compiler·제품 소스535·생성28·batch 상태19와 이전19 gate 입력이 그대로임을 해시로 확인했다. 이번에는 변경된 후보/호스트 경로를 재검증했으며19 gate를 중복 재실행하지 않았다. 새 제품 소비0, 전체 ACTIVE/PARTIAL이다.

## 8.67 실제 Material 테마·전체43 strict/Root·nullable const — 2026-10-17 KST

입력362·receipt1462와 pin/handoff를 검토했다. nullable 숫자 const와 실제 Material 테마 경계를 연결하여 전체 Raw15/style5/Material10/theme3/Cupertino10 **43개 선언의 strict 오류를0개로 줄이고 d.ts를 생성**했다.

- int?/double? 상수 필드 schema는 null과 숫자0, double ±0을 구분한다. 일반/named/redirect·모듈 간 const 원본34/거부12, generic const26/거부7·strict/d.ts·compiled-Core RN Babel이 PASS다. Core const 런타임을 빌드했다.
- 실제 제품 ThemeData/Theme를 후보에 복사한 뒤 scrollbarTheme/highlightColor를 추가했다. 원본 기본값은 const ScrollbarThemeData와 light0x66BCBCBC/dark0x40CCCCCC다. 사용자 지정값·copyWith null 유지·기존 선택 테마를 보존한다. 전체 Flutter ThemeData를 변환했다는 의미는 아니며 제품 승격 전의 검토 가능한 staged 변경이다.
- Material Root20/source RN Babel20에서 기본 const 공유, 지역/global/theme/widget 우선순위, theme lerp/copy/equality/hash, Android 두께4/desktop8 및 margin/radius, iOS Cupertino 전환과 종료를 확인했다. Cupertino14는 두 경로 모두 재검증했다.
- 실제 Core Color의 opacity/lerp 결과에 원본 Color 타입을 유지했다. 상수와 일반 값은 구분하고 임의 구조 객체는 거부한다. 전체 원본 Color 비교33/거부6이 PASS다. resolve만 재정의하는 정확한 WidgetStateProperty 두 구현의 Object identity/hash·문자열을 연결했고 진단 원본15기록이 양mode 일치한다.
- Raw 양mode72·style 양mode24, fresh19 gate·생성28/state19 보존·compiler types가 PASS다. 제품535개 중 const runtime1개만 바뀌었으며 나머지534는 보존했다. Material 테마 추가와 생성43의 제품 소비는 아직0이다.
- **전체 ACTIVE/PARTIAL 유지.** 전체 themed23의 독립 원본 동작 비교, 실제 caller에 필요한 추가 const 값 영역(Radius 등), 정식 batch/수정 보존·default/public 및 변경된 const runtime을 포함한 현재 native 공급과 잔여 W10 요구가 남는다.

## 8.68 전체 원본109·Radius private const·남은 Color identity — 2026-10-17 KST

입력367·receipt1536과 현재 pin/handoff를 확인했다. 원본43 선언을 라이브러리별로 분리하여 private 경계를 유지하고 WidgetState13·foundation·UI Color/Radius 본문을 포함한 독립 Dart 비교를 구성했다.

- Android/Windows/iOS×밝기×default/global/local/widget 설정의 normal/hover/drag/release96기록과 테마 const·lerp/equality/hash13기록, **양mode 각각109기록**이 실제 Core Root와 source RN Babel에 일치한다. framework/frame/physics receiver는 제어된 경계이며 Flutter engine pixels·실제 ticker 시간·기기 진동 증거는 아니다.
- 원본 Radius의 final x/y는 실제 Core의 private getter 저장소에 대응한다. 명시적으로 검토한 getter schema와 실제 singleton에서 얻은 저장소 키를 사용하고 이름은 추측하지 않는다. native private fields와 Babel 비공개 own slots 모두 검사하며, 추가 상태·setter·위조 슬롯·숫자/문자열 키 별칭을 거부한다. 원본20/거부9·compiled-Core RN Babel PASS다. circular/elliptical/zero와 중첩 테마 const가 공유되며 ±0은 구분된다. 기존 scrollbarConstRadius 캐시/alias는 제거했다.
- 전체43 strict/d.ts, Raw 양mode72·Painter16·style24, Material20/Cupertino14 양경로, const34/26·Color33, Core build·최종 fresh19 PASS다. 검증 중 런타임 변경으로 중간 회귀의 source/compiled 불일치가 감지되어 해당 실패 로그를 보존하고 최종 입력으로 재검증했다. 기존 생성28/state19를 보존했으며 제품536개는 기존2수정·1신규·533동일이다.
- **별도 const identity 비교는 FAIL2다.** Raw painter의 투명 track/trackBorder Color가 공통 Material/style Color pool과 객체를 공유하지 않는다(원본 true/true, 후보 false/false). ARGB 값 일치와109 동작 PASS로 이 차이를 덮지 않는다. 이 공통 Color domain 통합을 정식 승격의 선행 조건으로 기록했다.
- **전체 ACTIVE/PARTIAL 유지.** Color identity2 수정, 전체43 effective batch/수정 보존·실제 Theme/default/public 통합, 현재 native 공급 및 잔여 W10 요구를 계속한다.

## 8.69 사용자 요청 중간 마무리 — 2026-10-17 KST

사용자의 “일단 중간 마무리해줘” 요청으로 자동 목표와 현재 실행을 **PAUSED**로 전환했다. 전체 기술 상태는 **PARTIAL**이며 완료 체크를 추가하지 않았다. 명시적인 재개 요청 전까지 추가 구현·장기 검증을 진행하지 않는다.

- §8.68의 전체 원본109기록(debug/release, Core Root/RN Babel), Radius20·거부9, Core build와 fresh19 회귀 결과를 보존했다.
- Raw transparent Color const identity **2건 실패**는 별도로 유지한다. Raw의 ARGB 전용 캐시와 공유 Color field pool 통합이 다음 수정 지점이다. 전체43 배치 등록·제품 통합 및 현재 런타임의 browser/package/native 공급 검증도 남아 있다.
- 중단 전 입력 **372개·receipt1609개**의 SHA-256 일치를 확인했다. 기존 작업 트리를 보존하고 진행 중 장기 명령은 남기지 않았다. 최신 중단 체크포인트 (보관된 과거 기록 `w10-middle-pause.json`)에 최종 plan/progress/handoff hash와 재개 순서를 저장했다.
- 재개 시 체크포인트 → 입력/receipt hash·Flutter pin·현재 diff 확인 → Color identity2 수정/검증 → 전체43 정식 배치·보존 gate·Theme/public 통합 → 영향받는 공급 검증 순으로 진행한다. 물리 IME/caret/FPS 및 전체 제품 완료 여부는 계속 별도 미검증이다.

## 8.70 공통 Color identity·RawScrollbar15 정식 배치·기본 소비 — 2026-10-17 KST

사용자의 전체 작업 요청으로 재개했다. 중단 기준 입력372·receipt1609의 SHA-256, clean HEAD `3c1a612`와 Flutter pin을 확인했다. Color FAIL2를 먼저 해소한 뒤 전체 Raw library를 독립 검증·승격했다.

- Raw의 ARGB 전용 캐시를 제거하고 실제 Core의 Color field pool을 공유한다. 생성자4종·큰 정수·일반 할당·음수0·색 공간을 원본 Dart/Core/RN Babel9건으로 비교했고, 기존 Color33/거부6·compiled-Core Babel도 통과했다. Raw/helper와 Color의 staged 사본3개는 제품 경계로 옮기고 삭제했다.
- 20번째 recipe `w10-raw-scrollbar`는 원본 전체15 선언을 생성한다. 실제 effective 본문을 교체하지 않는 필수 gate에서 Core Root18/RN Babel18, 원본 양mode72씩, const identity2를 확인했다. 수동 수정·의존성·충돌·실제 실행 오류·필수 source 실패의 보존/거부6과 공개 facade fingerprint2를 통과했다. 기존19 state·28 출력은 보존했고 fresh20/출력29·공통 class graph가 통과했다.
- 공개 RawScrollbar/ScrollbarPainter는 생성된 State·Painter를 기본 소비한다. 수기 fade·drag·paint를 제거하고 ARGB/숫자 radius·명시 controller의 notification owner·외부 key/State를 facade에서 연결한다. 기존 즉시 thumb 표시를 위해 명시 thumbVisibility는 fade0으로, 생략 가능한 MediaQuery/Directionality는 기존 기본값으로 전달한다. 원본 host의 필수 조건은 유지한다.
- 공개 두 축 계약5를 실제 Core/source RN Babel 각각, 빌드 Core5와 Chromium6으로 검증했다. 첫 브라우저의 MediaQuery 생략 오류를 facade에서 보정했으며 오류 수집도 FlutterErrorDetails.exception/stack을 보존한다. source RN 검증은 하나의 공통 Core const 등록을 공유하고, 해당 런타임의 Babel 검증은 별도 Color33에서 수행한다.
- 전체43 후보 strict/d.ts·독립 원본109 양mode/Core/RN Babel을 현재 입력으로 재검증했고 후보 Raw 출력과 제품 bytes가 일치한다. **제품 기본 소비는 Raw15이며 styled28은 후보**다. 전체43 승격이나 W10-02 전체 완료로 해석하지 않는다.

## 8.71 Raw source 현재 패키지·Windows/Android 공급 — 2026-10-17 KST

- 현재 Core/SDK/Material/Cupertino를 모두 재포장하고 동일 archive의 외부 NodeNext 선언/ESM4 조합을 통과했다. 설치 비교에 Raw source와 공통 Map/const/numeric/Color/Radius17 모듈의 source/JS34를 추가했다. 양 target의 해당 bytes68개가 현재 제품과 일치한다.
- 복사 Windows manifest1385·Android1076 전체 hash, 각각29 이벤트를 검증했다. 기본 source State/Painter, 가로·세로 thumb drag의 축 소유, 활성 drag 중 제거/두 위치 detach·painter 구독 해제와 기존 wheel/tree/2D/Viewer·cold wheel/종료 흐름이 PASS-scoped다. Android OS tap·실제 EditText focus/Unicode/변환 bounds를 포함한다.
- 첫 공급의 Android 비교는 병행한 fingerprint probe의 임시 source 주석을 감지해 FAIL했다. 실패 기록과 Windows 산출물을 보존했고 정확한 원복을 archive와 비교한 뒤 동일 archive/fixture/config로 Android-only 재시도를 통과했다. Android Studio JBR25는 해당 프로세스에만 지정했다. sample entry와 runner manifest/lock5개·임시 fixture3개를 원복했다.
- 현재 공급은 공통 Map/const/Color/Radius의 변경 후 경계를 갱신한다. **Windows native 편집기 픽셀·물리 IME/caret·FPS·나머지 host·전체 styled 동작은 별도**다.

## 8.72 현재 tree/Viewer cold 재검증·재개 상태 — 2026-10-17 KST

- 동일 새 archive에서 Windows/Android 각각3 native 프로세스·7 흐름으로 tree의 위젯 소유 확장/scroll과 Viewer의 copied matrix·geometry/text 복원을 재검증했다. 명시 flush 뒤 중단/재시작 범위이며 unflushed crash durability는 주장하지 않는다. source Viewer 관성 중 종료와 두 ticker retirement·Android 실제 Unicode도 포함한다.
- 소유 서버·Lavapipe API33 emulator를 종료하고 공유 adb/Gradle은 유지했다. `w10-active-checkpoint.json`에 현재 입력·receipt·progress/handoff/plan hash와 다음 작업을 저장한다. 기술 상태는 PARTIAL, 자동 목표는 ACTIVE다.
- 다음은 styled28의 Core/design owner 경계 정리 → 정식 배치/보존 gate → 실제 Theme/default/public 소비 → 영향 공급 갱신이다. 추가 animated API·잔여 W10 파트·물리 IME/caret/FPS는 계속 남는다.

## 8.73 Core ColorProperty1 정식 배치·import 경계 — 2026-10-17 KST

기준 입력384·receipt1675와 ACTIVE 체크포인트를 확인했다. ColorProperty 후보의 Core→Cupertino import를 제거하도록 Map/JSON host를 Core painting으로 분리했다. 원본 source Map 메서드를 유지하고 Core JSON 변환은 경계에서 한 번 수행하며, 출처 없는 JS 숫자는 계속 거부한다.

- 21번째 recipe w10-color-property는 전체 선언1을 정식 승격했다. 실제 effective 본문을 교체하지 않는 contract/source gate가 debug/release × Core/RN Babel 각각7개를 통과했다. 별도지만 값이 같은 기본 Color·typed delegate double·안전한 prototype key·숫자 출처 거부를 포함한다. release JSON의 생략 가능한 level을 강제한 첫 검증 조건은 직접 level과 원본 비교로 수정했고 실패 로그를 보존했다.
- importEmission은 새 recipe만 opt-in이다. 본문·type·manual registration에서 사용한 이름을 보수적으로 유지하고 초기화 import는 명시한다. unused poison module·one-time initialization·독립 Dart/ESM/RN Babel8 및 거부3이 통과했다. 기존20 recipe 생성 방식은 유지한다.
- Core batch의 의존성 변경·수정 보존·실제 effective 손상·충돌·필수 source 실패 등6 검증 후 product/host/recipe를 정확히 원복했다. **fresh21/출력30**과 Core build·compiler types가 통과했고 기존20 state·29 생성 base/제품·기존539 copied source를 독립 보존했다. 신규 ColorProperty의 native 공급은 미검증이다.

## 8.74 styled28 패키지 owner·전체43 재검증 — 2026-10-17 KST

- retained recipe import를 등록된 owner와 실제 dependency/peerDependency에 따라 package export로 연결한다. generated body는 bound recipe/IR로 다시 생성하며 수기로 수정하지 않는다. Core→design의 상대·bare import2를 거부했다. 명시 export24는 후보 sandbox에서만 추가한다.
- 전체28 = Core ColorProperty1 + Cupertino14(dynamic/interface4·scrollbar10) + Material13(scrollbar10·theme3)이다. 독립 Core/Cupertino/Material package strict/declaration build3이 통과했다. Root/Babel은 sandbox source condition으로 같은 Core 인스턴스를 사용하고, plain Node는 기본 compiled export로 identity·진단·숫자 theme·const5를 검증했다.
- 현재 owner 후보에서 전체43 원본 비교가 debug/release 각각109개로 실제 Core Root/RN Babel에 일치했다. style24·Cupertino Root14·Material Root20도 양경로 PASS다. receiver 제어·기기 haptic/픽셀/실제 시간 구분은 유지한다. 추적 후보는 candidates/w10-scrollbar-packages.json이다.
- **제품 내부 승격은 Raw15 + ColorProperty1, 나머지 design27은 후보**다. 정식 design batch·effective gate/충돌 보존·실제 Theme/default/public 연결 후 영향을 받는 공급을 갱신한다. 이전 Raw native 증거는 해당 archive의 scoped 결과이며 신규 모듈을 검증하지 않는다. handoff의 중첩 과거 PAUSED/Color FAIL2 표기를 최신 ACTIVE로 정리하고 과거 문서를 보존했다. 전체 W10은 ACTIVE/PARTIAL이다.

## 8.75 Cupertino14·Material13 정식 배치와 전체43 제품 source — 2026-10-17 KST

기준 입력398·receipt1766·ACTIVE 체크포인트와 pin/dirty state를 확인했다. 22번째 Cupertino14, 23번째 Material13 recipe를 승격했다. Core→design 의존성 없이 checked host6개를 각 제품 owner로 옮기고 staged 사본을 삭제했다. 실제 Material ThemeData/Theme의 scrollbarTheme·highlightColor·canonical defaults를 제품에 연결했다.

- Gate는 소유한 actual effective 본문을 그대로 복사하고 전후 bytes를 확인한다. 첫 Cupertino gate의 미승격 Material companion2는 별도로 기록했으며, 최종 양 owner gate는 **제품 companion0**이다. 독립 원본43·양mode 각각109, style24, 실제 Root14/20 양경로, compiled Node8이 통과했다.
- 공개 Scrollbar/CupertinoScrollbar·Theme/Data·dynamic color/interface와 Core WidgetState/numeric witness API는 source class identity를 유지한다. erased double의 명시 carrier와 public d.ts metadata를 유지하며 무형 JS number로 추측하지 않는다. 자동 app scroll-behavior source 연결은 별도 잔여다.
- validationData는 canonical tracked recipe/candidate/input JSON만 fingerprint한다. 데이터 변경·mutable output 거부·공개 facade fingerprint·수정 보존·실제 effective 및 공개 API 대체 오류·필수 source 실패·충돌 등 **owner별9개**를 통과했고 bytes/patch/다른 state를 원복했다. Raw의 독립 original helper도 현재 gate로 갱신했다.
- **fresh23/출력35**, Core/design build·compiler types PASS. 이전30 generated base/제품은 보존했고 기존21 state 중 Raw만 의도적으로 갱신, 다른20 state는 동일하다. 제품의 원본 family43은 승격됐지만 전체 W10은 PARTIAL이다.

## 8.76 현재 Chromium8·Windows optional haptic 응답 — 2026-10-17 KST

- Chromium의 기존6 흐름에 실제 공개 Material/Cupertino source State·theme/default thickness·pressed resolution·controller drag·retirement2를 추가해8 흐름 PASS다. fixture 폭400에 포인터315를 사용한 첫 실패는 실제 metrics 기반 좌표로 수정했다. owning controlled messenger의 haptic 요청은 기기 진동 증거와 구분한다.
- Windows-style 미지원 host에서 SDK가 unsupported error envelope를 반환해 source OptionalMethodChannel이 오류를 받는 차이를 확인했다. 고정 원본 Windows handler는 알 수 없는 메서드에 NotImplemented를 반환하며, 원본 platform channel은 optional이다. SDK의 haptic host 부재만 MissingPlugin으로 전달하도록 수정했다. [고정 Windows 원본](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/engine/src/flutter/shell/platform/windows/platform_handler.cc#L426).
- 실제 SDK plugin port·Core Optional/일반 channel·HapticFeedback8 호출, 미지원/정상 전달/invalid input/실제 host 실패5가 PASS다. 실제 host 오류는 억제하지 않는다. 기존 native feedback/accessibility channel 회귀·SDK build·native fixture types도 PASS다. 물리 haptic을 주장하지 않는다.

## 8.77 현재 공급 진행 중 체크포인트 — 2026-10-17 KST

- 첫 styledsource Windows/Android 빌드는 완료했지만 optional haptic 수정 이전 archive이므로 현재 공급 검증으로 사용하지 않는다. 수정 SDK와 source family43의 **styledcurrent** 새 archive/양 target 빌드는 완료했다. 첫 외부 소비의 private data 접근과 native active-retire 뒤 포인터 재사용을 fixture에서 보정하고, 같은 archive의 **styledpointer** fixture 재빌드를 진행한다. Native fixture는 공개 themed 양축 drag·active retirement·owning haptic request/reply와 오류 수집을 추가한다.
- 현재 live build PID/도구 session, 정확한 suffix/fixture/supply 경로와 소유 server/emulator를 active checkpoint에 저장했다. 종료 관찰 전 새 명령을 중복 시작하지 않는다. 같은 archive의 외부4 NodeNext/ESM 소비와 공개 source/numeric 경계는 통과했다. Windows/Android33 이벤트·tree/Viewer cold3/7은 아직 완료로 표시하지 않는다.
- Native 빌드 중 sample/runner overlay는 임시 상태다. 빌드 finally의 원복 hash, runtime 및 종료·소유 도구 정리 뒤 공급 receipt를 갱신한다. 이전 Raw native 증거는 그 과거 artifact 범위로만 보존한다. 전체 목표는 ACTIVE/PARTIAL이다.

## 8.78 whole43 현재 archive·양 native/cold 공급 — 2026-10-17 KST

- 수정 SDK/source43의 같은8 archive에서 Windows/Android를 빌드했다. Core source/JS112·design source/JS80개 설치 bytes와 외부 NodeNext/ESM4조합이 제품과 일치했다. 복사 실행본에서 각33 이벤트·tree/Viewer cold 각3프로세스/7이벤트가 PASS-scoped다. 공개 Material/Cupertino 양축 thumb·실제 theme/default 두께12/10 및 pressed16·source State/painter active retirement·owning haptic request/reply와 오류 없음이 확인됐다.
- 첫 styledcurrent fixture의 active-retire 포인터 lease 재사용, styledpointer Windows reader의 offscreen editor 기반 sourceGrid 검사, Android의 Material 기본 비활성 상태에서 드래그를 기대한 실패와 실제 thumb hit-test 거부를 각각 보존했다. 최종 styledinteractive는 Material의 Android 기본 비활성/Windows 기본 활성과 explicit interactive=true의 우선순위를 검증하고, 원본 painter의 실제 thumb 중앙·public thumb hit test·reset paint 대기·cancel로 검사한다. 제품 source 본문을 이 결과에 맞춰 수정하지 않았다.
- sample/runner 원본5 hash·임시 fixture3 제거와 소유 emulator/server 종료를 확인했다. 공유 adb/Gradle은 유지했다. Android 실제 EditText bounds/focus/Unicode·OS tap 및 명시 flush 후 cold 복원 범위다. Windows 편집기 픽셀·물리 IME/caret/FPS·다른 플랫폼은 notVerified이며 전체 W10은 ACTIVE/PARTIAL이다.

## 8.79 namespace 타입 값·정확한 Null 반환·구체 생성자 witness — 2026-10-17 KST

입력427·receipt1825와 active checkpoint/Flutter pin/HEAD를 확인한 뒤 app behavior 의존성을 전체 선언 단위로 조사했다. ui.ImageFilter의 import prefix와 원본 Future.then의 Null callback을 공통 compiler 경계에서 연결했다.

- analyzer가 식별한 class/enum의 정확한 runtime import만 namespace prefix를 제거한다. getter는 매번 실행하며 capability 값을 접지 않는다. missing/type-only/foreign/nullable/write5는 거부한다. 정확한 dart:core Null의 fallthrough와 bare return만 null을 생성하며 임의 nullable/dynamic 반환을 추측하지 않는다. 독립 Dart 양mode·strict/d.ts·Core/RN Babel7결과가 일치했다.
- constructor의 witnessArgumentPaths는 analyzer 구체 인자에서 runtime witness를 전달한다. 기존 passWitnesses의 source parameter ABI와 host TS type projection은 보존한다. String witness·인자 순서·generic/nullability/compiled Core를 원본18결과로 비교했고 누락/빈 경로/범위 탈출/경합 포함16계약을 거부했다. 실제 EnumProperty<AxisDirection> 진단 타입도 공통 Core constructor helper로 보존했다.
- fresh23 이후 최종 emitter로 같은 resolved IR의35출력을 다시 생성해 bytes 일치와 기존 제품35/state23 보존을 확인했다. 기존 copied552 중 변경은 Material Theme/scrollbar host2이며 새 Core host3은 별도다. Core/design build·전체 types·compiler types PASS. 현재 archive/native 실행 증거는 별도다.

## 8.80 전체 behavior/stretch10 원본 비교·패키지 후보 — 2026-10-17 KST

[고정 후보](tools/Nelyx.FrameworkToTypeScript/data/work8/candidates/w10-scroll-behavior.json)와 현재 파트 (보관된 과거 기록 `w10-scroll-behavior.json`)에 MaterialScrollBehavior1·CupertinoScrollBehavior1·StretchingOverscrollIndicator/State/controller3·StretchEffect/private effect/State/painter/shader5를 기록했다. 전체 원본10·private closure를4모듈로 결정적으로 생성했고 원본 file/span hash를 검증했다. 기존 Core behavior/glow6선언은 재사용한다. 초기 inventory16 중 const Set1의 frontend 제한은 미선택 기존 Core 범위다.

- 실제 owner import/manifest 경계로 다시 생성해 Core/Cupertino/Material 각각 strict·ESM·d.ts·maps를 빌드했다. 내부 export3은 후보 manifest에만 적용했다. 원본 public 이름·Core base/type identity·inherited debug/release 이름·copyWith dispatch·canonical physics·actual Theme를 compiled Node6으로 확인했다.
- 원본 controller/spring/primary TickerFuture의 독립 Dart와 whole10 Dart 양mode 각각30결과가 실제 Core/RN Babel과 일치한다. Root 양경로 각각9묶음에서 pull/clamp/impact/interrupt/dispose·12 matrix/alignment 조합·원본 네 corner point·진단 타입·notification/clip/recede/active ticker retirement·6플랫폼/2축 behavior를 검증했다. 두 색 viewport의 실제 CanvasKit pixel hash도 원본 nonuniform matrix fallback 전후 달랐다.
- 실제 ThemeData/ColorScheme에 source가 소비하는 useMaterial3/secondary·nullable copy·M2/M3 secondary 기본값을 연결했다. full ThemeData migration은 아니다. Android 원본 M3 stretch/M2 glow 선택을 유지한다. shader capability는 현 backend false이며 원본 shader 본문을 보존하되 GPU 실행은 notVerified, 없는 FragmentProgram/drawPoints backend는 명시적으로 거부한다.
- **후보 검증 완료 / 새10 정식 recipe0·제품/public/default 소비0 / 전체 ACTIVE/PARTIAL.** 다음은 실제 effective 본문을 재생성하지 않는 필수 gate·lifecycle·3묶음 배치와 공개/앱 기본 연결이다. CupertinoApp 구현이 없으므로 그 자동 연결을 주장하지 않는다. Theme host가 변한 현재 package/browser/native 공급은 notVerified이며 §8.78 증거는 이전 archive 범위로 보존한다. 물리 IME/caret/FPS와 잔여 W10 파트는 계속 남는다.

## 8.81 behavior/stretch10 정식 배치·공개 API·MaterialApp 기본 연결 — 2026-10-17 KST

Core8·Cupertino1·Material1을 정식 recipe24~26으로 승격했다. 실제 소유 effective 본문은 재생성하지 않고 전후 bytes를 검증한다. 초기 gate의 미승격 companion은 기록했으며, 최종 현재 세 owner는 모두 product companion0이다. 공통 host 축 geometry 변경 후 필수 NelyxContract/sourceComparison을 다시 통과했다.

- 원본 Dart30/양mode와 Core/RN Babel이 일치하고, Root9·실제 appRoot12가 양경로에서 통과했다. 수정/정적 data·공개 facade fingerprint/실제 effective·public 대체/필수 source 실패/충돌9개씩을 검증했고 제품·recipe·public·data·patch bytes를 원복했다. 이 음성 검증은 축 geometry host 수정 전에 실행했으며, 수정 뒤 현재 positive source/Root gate는 재검증했다.
- public StretchEffect·StretchingOverscrollIndicator·Material/CupertinoScrollBehavior는 원본 class identity를 유지한다. MaterialApp은 원본 ScrollConfiguration 기본값과 명시 override를 연결했다. 현재 제품 compiled Node10, 실제 ListView의 자동 chrome·live Theme 위치80/연결 유지·실제 touch overscroll·active retirement를 검증했다. 전체 MaterialApp source나 미구현 CupertinoApp 완료를 주장하지 않는다.
- 기존23 state/35 제품 bytes는 보존됐다. 현재26 recipe/출력39 전체 fresh 회귀는 실행 중이며 종료·출력/metadata 최종 감사가 남는다. 현재 archive/native 공급과 전체 W10은 PARTIAL이다.

첫 fresh26은 앞선 Simulation runtime fixture의 w9-ordered 임시 파일이 공유 effective tree에 남아 후속 Core 전체 build에서 override6 오류로 종료했다. 실패 log를 보존하고 recipe별 effective 전체 복사로 검증 오염을 분리했다. 새 isolated fresh26은 실행 중이며 성공/출력·metadata 감사 전까지 전체 회귀 완료로 표시하지 않는다.

## 8.82 원본 nonuniform stretch의 편집기 geometry 보정 — 2026-10-17 KST

새 실제 Chromium 재현에서 원본 세로 배율1.0186713596에 DOM 편집기는1을 유지했다. Core/SDK가 uniform scalar만 전달해 text/caret/control이 함께 늘어나지 않는 host 차이였다. 실패 entry/bundle/결과를 보존했다.

- 원본 stretch 본문은 보존하고 Core semantics transport/freezer와 SDK browser/RN overlay를 bounds·scaleX·scaleY 계약으로 연결했다. 양 축의 local width/height·clip·중심 transform을 별도로 계산한다. scalar fallback은 제거했으며 finite 양수 축 geometry만 허용한다. rotation/shear/perspective는 별도 경계다.
- 실제 제품 Chromium 가로/세로2 흐름에서 원본 matrix와 DOM glyph/caret/control 배율, focus·composition·Unicode commit·1 binding/1 disposal이 통과했다. 기존 Chromium8 흐름도 유지됐다. actual compiled RN overlay는 제어된 Windows/Android receiver12 사례와 잘못된 geometry10 거부를 검증했다. 제어된 RN 구조 검사를 실제 native app/pixels로 확대하지 않는다.
- Core/design/SDK build·전체 types, 현재 제품 Node10 PASS. 동일 변경을 포함한 세 source gate는 다시 PASS다. fresh26 진행·현재 archive/native 갱신은 active checkpoint의 다음 작업이며 물리 IME/caret/FPS는 계속 미검증이다.

## 8.83 isolated fresh26·출력39 최종 감사 — 2026-10-17 KST

첫 공유 effective 검증의 Simulation 임시 probe 오염을 recipe별 전체 effective 복사로 격리했다. 새 `class-regression-00qDCP`는 정식26 recipe와 abstract Simulation graph를 20분 제한 내 PASS했다. strict 검증이나 입력을 필터링하지 않았다.

- 기존23 state·기존35 제품 bytes·기존35 qualified fresh base를 각각 보존했다. 과거 state의 생성 fingerprint와 현재 compiler가 만드는 base를 같은 hash로 간주하지 않는다. 새4를 포함한 전체39 출력·복사 source559를 감사했다.
- 원본10의 UTF-16 span과 raw/CRLF-normalized hash를 구분해 검증했다. 새4 generated TS의 숫자 member/parameter/return 주석이 공개 d.ts에도 정확히 유지되고 JS source map과 Flutter license3도 일치한다. 실패한 감사 가정의 log와 성공 audit를 함께 보존했다.
- 현재 native fixture strict 타입 검사는 PASS다. 새 archive/Windows·Android default/nonuniform editor·cold 공급 검증은 진행 중이며 native/물리 IME/caret/FPS 완료로 확대하지 않는다.

## 8.84 behavior/stretch10 현재 archive·Windows/Android 공급 — 2026-10-17 KST

현재 Core·SDK·Cupertino·Material을 새로 pack하고 기존 native supplier4와 같은 archive8을 외부4 소비 조합 및 복사 Windows/Android Release 앱에 공급했다. 두 native fixture/config/source probe의 bytes와 archive8 hash는 같다. 첫 Android GraalVM jlink 실패는 보존했고, 동일 공급을 process-local Temurin JDK21로 재빌드해 통과했다. 전역 Java 설정은 바꾸지 않았다.

- source/JS/d.ts/maps까지 behavior Core65·design20·SDK10, target별95 설치 bytes를 확인했다. manifest 전체 hash·Android 설치 APK hash와 외부4의 NodeNext/public source identity·MaterialApp 기본/명시 override를 검증했다.
- Windows/Android 각각42 이벤트에서 기존 wheel/2D/tree/Viewer·공개 styled 양축/pressed/haptic·복원/해제를 유지했다. 실제 MaterialApp 기본 chrome은 Windows scrollbar1·Android stretch1이며, 강제 Android Theme의 양축 원본 touch stretch→Core/editor geometry, M2 secondary glow와 명시 override, active source/controller/editor retirement를 확인했다.
- Android는 실제 OS tap으로 EditText focus·Unicode 문자열과 양축 stretch 전후 native bounds를 추가 검증했다. Windows는 actual native Hermes 앱의 source/semantics geometry 범위이며 Windows editor/caret 픽셀 완료를 주장하지 않는다. Core synthetic touch와 OS tap·물리 IME의 증거도 구분한다.
- 같은 공급의 양 target tree/Viewer cold3프로세스/7이벤트·source inertia 중 정상 종료를 통과했다. 원본 sample/runner 입력5 hash 원복·임시 fixture3 제거·소유 server/emulator 정리까지 감사했다. shared adb/Gradle은 중단하지 않았다. 현재 공급 검증 (보관된 과거 기록 `w10-scroll-behavior-acceptance.json`)은 PASS-scoped이며 전체 W10·추가 animated/mixed·CupertinoApp·shader GPU·물리 IME/caret/FPS는 계속 PARTIAL/notVerified다.

## 8.85 현재 tree 제품 본문 보존 검증·공개 API 경계 — 2026-10-17 KST

추가 animated/public API를 검토하면서 standalone tree 검사가 옛 후보를 재생성하고 archived host를 다시 덮는 경로를 확인했다. `tree-test-candidate.ts`의 기본값을 현재 owning 제품/호스트의 bytes 보존 복사로 바꿨다. batch는 기존 owning effective 본문 보존을 유지하며 candidate/review 대체를 거부한다.

- standalone은 `product-body-preserved`, batch는 `effective-body-preserved`를 stage receipt에 기록한다. 원본 pinned span metadata는 archived IR에서 읽을 수 있지만 fresh extraction이나 재생성으로 가장하지 않는다. 명시 `--candidate` 생성은 frontend hash 일치를 계속 요구하고 `--review`는 별도 진단 overlay로 기록한다.
- 현재 제품의 Widget Core/Babel 각16·고정 facade16·nested Core/Babel 각26·renderer와 serial raw Dart 비교11 widget states/양mode가 PASS했다. 변경 checker 입력을 포함한 전체 fresh26/출력39와 abstract Simulation graph도 통과했다. state26·qualified generated base39·제품39·복사 source559는 보존했다. 현재 native 공급의 source/JS/d.ts/maps95/target도 변하지 않았다.
- 공개 tree inventory (보관된 과거 기록 `w10-tree-public-api.json`)에 원본 공개 선언7·typedef4와 private closure를 연결했다. 현재 공개 TreeView는 string ID·고정 높이·즉시 toggle 계약이다. 내부 node Map 및 Widget admission이 string 전용이므로 generic 타입 표기만으로 임의 content를 지원한다고 주장하지 않는다. 원본 public class/controller/typedef 소유권·generic witness/runtime admission을 먼저 해결해야 하며 새 저수준 공개 export0과 broader animated/native timing은 미완료다.

## 8.86 공통 mutable List·정확한 generic literal/parameter/callable 경계 — 2026-10-17 KST

tree children의 공변 대입과 임의 content 지원에 필요한 경계를 공통 런타임/컴파일러에 구현했다. dependency 기록 (보관된 과거 기록 `w10-tree-list-witness.json`)은 이 기능의 검증과 아직 연결하지 않은 tree/public 제품 경계를 구분한다.

- Core `dart-mutable-list.ts`는 명시 element witness를 보존하는 dense List를 제공한다. indexed get/set, nullable length 증가, add/addAll·clear/removeAt/insert·sublist/reversed, fixed-length 변경 거부·공변 대입·iterator concurrent modification·identity/hash/string/cycle을 확인했다. raw JS 숫자는 종류를 추측하지 않고 거부한다. fixed List의 오류 우선순위와 self-addAll은 독립 Dart 결과에 맞춰 수정했다. 전체 Dart List API 구현은 아니다.
- `listLiterals`는 정확한 analyzer element type과 non-const provenance를 요구한다. 일반 literal은 요소별 producer를 순서대로 평가·검사하고, collection literal은 insert 시점에 검사하여 잘못된 값 이후 callback/loop 부작용을 실행하지 않는다. `parameterTypeWitnesses`는 List<T> 인자를 본문/초기화 전에 검사한다. 일반 generic function·standalone static method의 type parameter와 명시/추론 인수를 analyzer에서 받아 기존 witness ABI로 전달한다. 숫자 generic은 DartInt/DartDouble 및 `@dartType`을 d.ts까지 유지한다.
- 원본 native Dart 양mode와 source/실제 compiled-Core RN Babel에서 runtime24·거부4, compiler22결과·거부8이 통과했다. 별도 supplier hash와 실제 x64/x86 실행파일 bytes를 확인한 Hermes x64 -O0/-Og·x86 -Og 세 bytecode 실행에서도 같은 결과를 얻었다. 이는 네이티브 엔진 검증이며 UI/packed app/물리 입력 검증으로 계산하지 않는다.
- 변경 compiler의 fresh26/39·abstract Simulation graph, 기존 state26·qualified base39·제품39·source559 및 기존 native95/target을 독립 감사했다. 새 공통 모듈1을 더한 source560이며 tree 생성물·host·public API의 연결 변경은0이다. const List는 mutable 경로 진입을 명시 거부하며 full List API·tree12 witness/Map admission·원본 public7/typedef4·새 dependency의 packed/native app 공급은 미완료다.

## 8.87 Map/Set factory witness 경로·전체 tree generic 후보 — 2026-10-17 KST

기존 collection factory는 TypeScript 타입 인수만 받아 node Map의 실행 타입을 유지할 수 없었다. 공통 `collectionLiterals.witnessArgumentPaths`로 원본 Map/Set의 정확한 argument 경로에서 runtime witness를 전달한다. host TypeScript 인수 선택과 독립적이므로 Node<T> 전체와 내부 T, 구체 Node<int>를 모두 표현할 수 있다.

- 독립 Dart 양mode·실제 Core·compiled-Core RN Babel에서 Map/Set 공변 검사·잘못된 Node<double> 쓰기 거부·조회·순서·조건부 literal·generic/구체 호출22결과가 일치했다. empty/duplicate/escaping/fractional/non-interface 경로·미등록 owner/factory·const 진입10조건을 거부한다. 기존 List literal22/거부8 회귀, runtime24·literal22·collection22를 함께 실행한 실제 supplier-verified Hermes3도 PASS다.
- compiler types와 변경 compiler fresh26/39·abstract Simulation graph PASS. 기존 state26·qualified base39·제품39·source560 및 native95/target은 그대로다. 새 공통 옵션이 실제 tree/public/현재 archive에 연결됐다고 계산하지 않는다. const Map/Set의 canonical factory에 witness를 전달하는 ABI는 명시 거부한다.
- 전체 tree generic 후보 (보관된 과거 기록 `w10-tree-generic.json`)는 현재 fresh IR의 12개 전체 본문에 captured Node/Widget/State·typed children·checked parameter9종·node Map witness를 적용해 생성했다. 기존 owning 보정과의 read-only 3-way 시험 병합은 두 모듈 모두 충돌0이다. 실제 Core 복사본의 기존 host를 유지한 strict 검사는 **진단21 / PARTIAL**이다. 누락 State/Ticker/mixin witness, numeric Map/record/ValueKey/paint·math max ABI, 기존 node Map factory 인수가 후속 작업이며 generic content equality/string·List/Iterable 검사도 별도 확인해야 한다. 소스 알고리즘·IR을 수동 대체하거나 any로 진단을 숨기지 않았다. candidate runtime/public export0·제품 연결0·새 packed/native 앱 공급은 미완료다.

현재 hash/불변 증거와 다음 작업은 dependency 기록 (보관된 과거 기록 `w10-tree-collection-witness.json`), progress/handoff/active checkpoint를 따른다.

## 8.88 receiver 소유 generic 필드·원본 numeric math 경계 — 2026-10-17 KST

공통 compiler에 정확한 nested mutable field의 runtime type application을 추가했다. 쓰는 함수의 T가 아니라 대상 receiver가 생성될 때 보존한 U를 읽으므로, Cell<int>/Store<int>를 num으로 넓혀도 잘못된 Node/List 대입을 거부한다. receiver와 RHS를 각각 한 번 평가하고 검사 뒤 대입하며, 대입식은 원래 RHS 값을 반환한다. unchecked null-coalescing assignment (??=)·null-aware mutation은 지원 전까지 명시 거부한다.

- 독립 native Dart 양mode·strict/d.ts·실제 compiled-Core RN Babel에서18결과와11거부 조건이 PASS했다. nullable 결과·평가/예외 순서·다른 lexical parameter 이름·공변 저장소 identity를 확인했다. 기존 scalar type-test ABI를 바꾸지 않고 별도 source generic cast가 raw JS 숫자의 Object/Object? 진입을 거부한다.
- 원본 Dart VM max를 int/double carrier 경계로 연결했다. 두 값이 같은 경우의 operand 선택, NaN·양/음 zero·무한대·정수 경계를24결과/5거부로 대조했고 원본 SDK 파일·license·span/hash를 기록했다. 숫자 종류는 값의 모양으로 추측하지 않는다.
- 실제 compiled-Core와 전체 generated field 본문은 supplier archive/exe hash를 확인한 Hermes x64 -O0/-Og·x86 -Og에서 같은18/24결과를 통과했다. 이는 native engine 검사이며 packed UI·물리 입력 검증과 구분한다.

## 8.89 전체 tree generic 후보 실제 Core·원본·독립 package 검증 — 2026-10-17 KST

후보 검증 기록 (보관된 과거 기록 `w10-tree-generic-host.json`)에 전체 widget9/rendering3 원본과 실제 Core host를 묶었다. 원본 알고리즘·IR을 대체하지 않고, 기존 State/renderer 보정은 owning previous base와 read-only 3-way 병합으로 유지했다. Widget/State/Ticker의 canonical 부모 witness를 Raw/themed staged host와 공유하고 Node/Widget/State/Controller의 실제 owner capture, children List·node Map, numeric record/paint/ValueKey 경계를 연결하여 기존 strict 진단21개를 해소했다.

- String·혼합 int/double num·bool·nullable String·등록 custom equality/string·원본 Controller content·공변 실패의7시나리오/18상태를 원본 Dart 양mode와 actual Core/RN Babel로 비교했다. Node<int> 자식의 private parent 필드는 Node<num> 대입을 거부하고, 실패 전 depth/isExpanded의 부분 상태도 원본과 같다. unproven raw 숫자·array·미등록 custom 표현5조건을 거부한다.
- 기존 assertion/oracle 본문을 유지하고 test 입력만 명시 String witness와 analyzer record numeric schema로 전달했다. 실제 Root16·nested animation26·fixed facade16이 Core/Babel 각각 PASS다. raw widget11상태/양mode는 Core/Babel, renderer24frame/양mode는 기존 독립 controlled paint receiver 비교로 PASS다. 원본 raw nested-collapse failure도 유지하며 보정 제품 계약과 혼동하지 않는다.
- 실제 Core/Cupertino/Material의 독립 strict/declaration/JS build3와 actual Node ESM6을 통과했다. 동일 compiled 모듈의 RN Babel6·supplier-verified Hermes3×6에서 renderer 선행 import, 공변 identity/쓰기 거부, generated private parent 검사, mixed numeric lookup, Controller 문자열, raw Object 숫자 거부를 확인했다. 선택 source/JS/d.ts/maps와 numeric 주석을 함께 보존했다.
- 최종 compiler의 fresh26/출력39·abstract Simulation graph가 PASS다. final guard 추가 전후 raw/composed 생성물·host·공통 모듈 bytes가 같음을 별도 대조하여 이전 Root/package/engine 근거를 재사용했다. candidate metadata hash 차이를 숨기지 않는다. 기존 state26·qualified base39·제품39·복사 source560은 그대로이며 shared source3을 더했다(복사 입력563 + generated39 = 소유 source602). 기존 native 설치 source/JS/d.ts/maps95/target도 같고 소유 server/emulator는 종료 상태다.

정식 generic recipe/effective gate와 제품/public 연결은0이다. 원본 public7/typedef4 소유권·numeric declaration provenance, 현재 보정 State 수명과 공개 identity, actual effective 보존 검증·승격 및 영향 browser/packed/native UI 공급은 후속 작업이다. 전체 W10·CupertinoApp·물리 IME/caret/FPS는 계속 PARTIAL/notVerified이며 후보 결과로 완료 처리하지 않는다.

## 8.90 원본 typedef identity·숫자 출처와 record callback — 2026-10-17 KST

공통 frontend/IR/emitter에 typeAlias 선언을 추가했다. 선택한 alias의 analyzer element·타입 인수·generic bound를 보존하여 함수/record/nullable/interface alias와 참조를 원본 이름으로 생성한다. alias를 선택하지 않은 기존 배치는 기존 expanded 타입 경로를 유지한다. 숫자 정보는 analyzer의 정확한 member 경로에서 받아 선언·callback 인자/반환·record field의 @dartType/@dartParam/@dartReturn 및 bound를 d.ts까지 전달한다.

- alias10의 원본18결과가 native Dart 양mode·strict/declaration·source/실제 compiled-Core RN Babel에서 일치했다. named/positional/nested record, optional named callback·nullable alias, generic List·callback·num bound와 identity를 확인했다. 중복/충돌·잘못된 arity/숫자 경로·누락 numeric provenance·escaping parameter·recursive alias·implicit bound·dynamic 반환 등을14조건으로 거부했다. generic function type 자체는 frontend에서 별도 거부한다.
- record field에는 일반 variable/getter element가 없어 callback 호출의 반환 storage provenance가 빠지는 문제를 보완했다. 정확한 resolved record field의 FunctionType을 전달하며 값이나 이름에서 숫자 종류를 추측하지 않는다. concrete numeric function alias의 별도 representation ABI는 지원 전까지 명시 거부하며, 실제 tree의 원본 alias6에는 이 경계가 발생하지 않는다.
- 같은 전체 generated subject와 실제 compiled-Core를 import 경로만 연결하여 supplier-verified Hermes x64 -O0/-Og·x86 -Og에서18결과가 일치했다. alias는 타입으로 소거되며 native UI/물리 입력 완료로 계산하지 않는다.

## 8.91 tree 원본 공개7·typedef4의 실제 Core/package 후보 — 2026-10-17 KST

검증 기록 (보관된 과거 기록 `w10-tree-type-aliases.json`)에 원본 widget9/rendering3과 public typedef4/private typedef2를 묶은18개 IR·전체 생성·strict0을 연결했다. 원본 class 본문/span은 그대로다. Widget 공개 module은 Node/Controller·abstract StateMixin 및 builder/callback3을, renderer module은 parent-data/indentation/renderer와 animation record를 원본 이름으로 제안한다. private State/aliases는 공개 module에서 export하지 않는다.

- Node/Controller/parent-data/indentation 네 값은 원본 생성자와 동일하다. Widget/renderer 두 값은 기존 검증된 Core 보정 owner를 그대로 export하고 원본 source 상속·captured type을 유지한다. raw base와 같은 생성자라고 가장하지 않는다. createState의 공개 반환은 원본 State 경계로 넓히고 실제 객체는 기존 보정 State를 생성한다.
- Core/RN Babel 각각11검사에서 정확한 공개7/typedef4 선언·runtime constructor6, num content·custom builder·소수 row extent·정적 Controller.of/maybeOf, 중첩 curve animation·controller 교체·동기 Root 종료를 확인했다. TreeView의 기존 Widget16/nested26/facade16은 양 경로에서 유지되며 raw widget11/renderer24 양mode·generic7시나리오/18상태 비교도 PASS다.
- Core/Cupertino/Material 독립 build3, 제안 package export5의 실제 Node10·compiled RN Babel10·supplier-verified Hermes3×10이 통과했다. List·named record·Map의 공통 public 생성 경로도 실제 Core helper를 재사용한다. 선택 source/JS/d.ts/maps와 원본 alias의 숫자 주석을 보존했다. 실제 제품 manifest 변경은0이다.
- compiler/frontend 검사와 fresh26/39·abstract Simulation graph가 PASS다. 전체26 실행 뒤 추가한 두 alias 거부 guard는 alias를 선택하지 않는 기존 recipe에서 실행되지 않는다. 최종 compiler로39개를 다시 생성해 qualified base와 byte 동일함을 확인했고, 최종 guard는 alias18/거부14·native18에서 별도 검증했다. 이 재사용 범위를 전체 재실행으로 표기하지 않는다. state26·base39·제품39·복사 source563(생성 포함602)와 기존 native95/target도 그대로이며 소유 프로세스/port는 종료 상태다.

정식 actual-effective gate·edit/conflict/fingerprint lifecycle·source18/host/public의 제품 승격과 영향 archive/browser/native UI 공급은 다음 작업이다. 현재 제품/public 연결0이며, 전체 W10·CupertinoApp·물리 IME/caret/FPS는 계속 PARTIAL/notVerified다.

## 8.92 tree 원본18의 실제 effective gate와 보존 — 2026-10-17 KST

정식 검증 기록 (보관된 과거 기록 `w10-tree-formal-promotion.json`)에 원본 widget9/rendering3과 public4/private2 typedef를 합친18개의 현재 owning 입력을 연결했다. gate는 공통 배치의 effective 파일과 현재 host13/shared3·공개 manifest를 그대로 복사한다. 후보 재생성이나 archived host overlay로 검사를 통과시키지 않는다. 실제 typedef6의 정확한 구조·숫자 provenance를 원본 analyzer IR 및 d.ts와 대조한다.

- 계약 gate11개는 Core/RN Babel Widget16·nested26·facade16·public11씩, 실제 renderer geometry/clip/hit26프레임, 독립3-package·Node10·compiled Babel10·supplier-verified Hermes3×10을 검사한다. 필수 원본 gate5개는 widget11/render24 및 generic7시나리오/18상태의 양mode 비교를 유지한다. renderer 원본 비교는 격리 copy의 paint receiver import 두 개만 연결하며 본문은 동일하다. 실제 Core geometry26 검사는 receiver 대체 없이 수행한다.
- 격리 보존 검사10개에서 source/host 수정의 bytes 유지, candidate/review 및 batch의 후보 emission 차단, 누락 host·공개 mapping 대체·typedef field 숫자 주석 제거·any 치환·원본 본문 손상·공개 생성자 대체를 확인했다. 실제 owning 파일은 덮어쓰지 않는다.
- standalone 검사도 현재 승격 제품과 해당 pin IR을 선택한다. 원본 fixture 입력에만 명시 String witness와 analyzer numeric record ABI를 적용하며, 실패 exit status를 그대로 전달한다. candidate/effective/product producer를 기록에서 구분한다.

## 8.93 generic18·원본 public7/typedef4 정식 승격과 fresh26 — 2026-10-17 KST

검증한 nongenerated host/public module을 현재 제품에 옮긴 뒤 공통 batch resume으로 두 generated 제품을 승격했다. 원본 재추출·3-way compose·전체 Core strict·실제 effective 계약과 필수 원본 비교를 모두 통과했다. 기존25개 batch state와 나머지 generated37개, 해당 qualified base 및 무관한 copied source는 보존했다. 전체 generated 출력은39개이고 owning source는605개다.

- 실제 배치 lifecycle7개가 gate 입력·공개 barrel·공유 consumer host·manifest fingerprint, 독립 사용자 수정 보존, 겹치는 rename 충돌, owning 계약 PASS 뒤 필수 원본 gate 실패의 승격 차단을 확인했다. 제품·recipe·state·manifest·patch를 원복했고 qualified scratch의 복원 guard도 별도1검사로 확인했다.
- public module에는 원본7개 선언·typedef4개를 공개한다. Node/Controller/parent-data/indentation 네 값은 원본 생성자이고 Widget/renderer 두 값은 원본 상속을 유지하는 기존 Core 보정 owner다. abstract mixin은 type-only이며 private State는 공개하지 않는다. 기존 고정 TreeView 계약도 유지했다.
- Core·SDK·Skia Web·Cupertino·Material 실제 build5와 최종 compiler의 fresh26/39 및 abstract Simulation graph가 PASS다. tree 두 raw base는 새 승격 base와, 무관37개 raw 출력은 이전 최종 compiler의 검증된 fresh 출력과 bytes가 일치한다. 다른25배치의 과거 promoted base는 변경하지 않았다. §8.91의 최종 두 guard 전 fresh26/후속39 replay 이력과 이번 전체 실행은 별도 증거다.

## 8.94 현재 packed 공개 API와 Chromium animated tree — 2026-10-17 KST

새 공개 module·generic witness·숫자/List helper를 포함한 tree22모듈의 source/JS/d.ts/maps110개를 공급 비교에 포함했다. 현재 Core/Cupertino/Material archive의 repository-external NodeNext 선언·ESM 소비4조합이 통과했다. 원본 generic Node/List identity, public7/typedef4·숫자 record 선언과 private State 비공개도 확인했다.

Chromium9흐름은 기존8개에 실제 공개 generic tree를 추가했다. 중첩 animation과 소수 row extent의84px DOM 이동, Core/DOM editor identity·focus/composition, 정적 controller lookup·controller 교체·State 유지, bulk collapse, animation 중 Root 종료와 scroll/editing owner 해제를 확인했다.

이 단계 당시 packed native UI와 cold 공급은 notVerified였으며, 이후 §8.95에서 현재 공급을 갱신했다. 이전 behavior artifact의 Windows/Android42·cold7은 새 tree bytes의 검증으로 승계하지 않는다. compiled Hermes3는 engine 동작 증거이며 새 UI/물리 IME/caret/FPS 판정과 구분한다.

## 8.95 generic18 현재 Windows/Android 공급·편집기·cold — 2026-10-17 KST

현재 native 검증 기록 (보관된 과거 기록 `w10-tree-native-acceptance.json`)에 같은8개 archive·repository-external 소비4조합·Windows/Android Release 복사본을 연결했다. native fixture는 실제 public TreeSliver/Node/Controller/renderer를 사용한다. source 본문이나 상태 전이를 대체하지 않으며 현재605개 owning source와26개 batch state는 bytes 그대로다. public API의 exact fixture strict0을 확인한 뒤 process-local Temurin21로 두 package를 빌드했다.

- 양 target에서 현재 tree22모듈의 source/JS/d.ts/maps110개 및 기존 behavior/SDK95개 설치 bytes가 일치했다. copied package manifest도 Windows1421/Android1112파일을 검증했다. 현재 native48이벤트씩은 기존42에 공개 generic tree6흐름을 추가한 결과다.
- 명시 num witness·growable List·int/double carrier가 원본 Node/Controller 경계를 통과했다. mixed int2/double2 조회, 중첩 curve animation의 소수 extent84px 이동, controller 교체와 원래 State/editor identity, bulk collapse, source animation 중 해제와 scroll/editing owner 종료를 실제 native app에서 확인했다.
- Android 실제 EditText는 OS tap focus·Unicode를 유지했고,84 logical px에 대응한 bounds 이동과 controller 교체 후 같은 bounds/focus/text를 확인했다. 해제 뒤 UI XML에서도 편집기가 제거됐다. Windows는 실제 Core/SDK/native runtime의 상태·geometry/수명 증거이며 native editor glyph/caret 픽셀 검증으로 계산하지 않는다.
- 같은 현재 artifact에서 target별3개 실제 프로세스·7이벤트의 기존 TreeView ancestor/scroll 및 Viewer subunit matrix cold 복원, source inertia 중 close·ticker/editor 해제가 통과했다. generic low-level tree 자체에 새 restoration API가 생겼다고 주장하지 않는다.
- sample entry와 양 runner package/lock의 원본5개를 원복했고 임시 fixture/config/source-probe3개를 제거했다. 소유 localhost 서버와19_12T software Vulkan emulator를 종료했으며 공유 adb/Gradle은 중지하지 않았다. 물리 IME/caret/FPS·Windows editor pixels·hardware GPU와 전체 W10은 계속 미완료다.

## 8.96 CupertinoApp 원본 IR·공통 generic function 값 — 2026-10-17 KST

원본/공통 compiler 검증 기록 (보관된 과거 기록 `w10-cupertino-app-source.json`)에 CupertinoApp·private State·inspector 전체3개 선언과 첫 의존성30개 선언의 추출 결과를 보존했다. 원래 generic pageRouteBuilder 리터럴을 IR로 표현하면서 root3은 모두 해석됐다. 의존성 전체30 중27개가 해석됐고, CupertinoRouteTransitionMixin의 generic/on 제약·CupertinoPageRoute의 overriding title field·CupertinoPage의 function-typed super.onPopInvoked는 정확한 장애3개로 남겼다. 이30개는 transitive closure 전체가 아니며 후속 route/private animation·theme/text-theme·WidgetsApp router/Hero/inspector/localizations 통합은 미완료다.

- 공통 IR/emitter에 analyzer 기반 generic function type·리터럴·explicit/inferred 호출과 checked witness ABI를 추가했다. 익명 binder는 source offset으로 구분하며 원본 타입 인자와 bound를 보존한다. nullable/named 호출, 캡처와 type parameter shadowing, int/double carrier, 원본 generic class constructor로의 witness 전달을 검증했다.
- 원본21개 선언·15개 결과가 Dart 양 mode와 일치했다. strict TypeScript/d.ts와 @dartReturn/@dartParam/bound 정보, 잘못된 runtime 인자2개, 거부9개, 실제 compiled Core/RN Babel 및 supplier 검증 Hermes x64 O0/Og·x86 Og3개 실행을 통과했다. Generic function alias emission·generic method tear-off·numeric-function bridge·dynamic callable은 별도이며 명시적으로 거부한다.
- 기존 alias10/결과18/거부15·양 Dart mode·compiled Core/Babel·Hermes3도 통과했다. 최종 compiler의 isolated fresh26/출력39·기존 source 비교·abstract Simulation이 PASS다. 출력39 모두 이전 최종 fresh bytes와 일치하고 현재 owning source605·batch state26은 그대로다. 중간 회귀는 동적 호출 guard 보완 전에 소유 process tree를 종료했고 완료 증거로 계산하지 않았다.
- CupertinoApp 생성 후보/정식 recipe/public/default behavior 연결은0이다. 현재 selection용 CupertinoTheme와 Nelyx WidgetsApp API가 원본 전체 계약을 충족한다고 가정하지 않았다. 제품 bytes가 유지됐으므로 §8.95의 현재 native48/cold7 공급 범위를 승계하며 새 앱 실행 증거로 확대하지 않는다. 전체 W10·물리 IME/caret/FPS·Windows editor pixels·hardware GPU는 계속 PARTIAL/notVerified다.

## 8.97 Cupertino route 원본 closure·field/default/collection 공통 의미 — 2026-10-17 KST

원본·공통 의미 검증 기록 (보관된 과거 기록 `w10-cupertino-route-source.json`)은 §8.96의 첫 의존성30개를 모두 IR로 해석한 후속 결과다. 기존3개 장애를 source 본문 교체 없이 해소했다. 범위를 Cupertino route 파일의 class/mixin16·global9·함수3 선택28개와 원본 Page/PageRoute로 넓혔다. route unit28은 모두 IR로 해석되고 부모 포함30 중29개가 해석됐다. 두 frontier의 중복을 제거한53개 중52개가 IR이며, PageRoute.fullscreenDialog의 concrete getter/field 재정의는 정확한 source 장애로 남는다.

- 공통 IR은 mixin의 generic T·on PageRoute<T>, private nullable field·static const·generic static method와 super 호출 본문을 모두 보존한다. 아직 지원하지 않는 generic/on/stateful/static application은5개 거부로 검증했으며 fields/제약을 버려서 통과시키지 않는다. 실행 가능한 mixin/route/app 후보는0이다.
- abstract getter/setter를 구현하는 원본 field에는 정확한 accessor origin과 별도 opt-in backing storage를 적용했다. final/mutable/nullable·generic int carrier·상위 메서드 dispatch를 유지한다. mutable setter는 receiver의 원래 witness로 검사한 뒤 commit하여, 상위 타입으로 넓힌 generic/nullable field의 잘못된 정수 대입이 TypeError이고 기존 값은 보존됨을 확인했다. 최초 생성 코드가 대입을 허용한 TS/Dart 불일치와 수정 후 결과를 보존했으며 해당 중간 회귀는 소유 process tree를 종료하고 완료로 계산하지 않았다. 상속한 static 함수의 기본값은 analyzer의 실제 함수 identity를 사용한다. 라이브러리를 넘는 private default·동일 identity·사용자 override·명시 null·void callback을 검증했다. 원본14/결과20·거부9/frontend4·Dart2·strict/d.ts·actual compiled Core/RN Babel·Hermes3이 PASS다. concrete storage/getter 재정의·generic/constructor tear-off 기본값·mutable scalar numeric setter ABI·unsafe base dispatch·late field 구현은 별도다.
- declaration을 갖는 collection for의 초기화/조건/복수 update·중첩·반복별 closure 캡처와 checked insertion을 연결했다. 원본에서 발견한 null-aware index도 IR에 보존하고, null이면 index와 뒤 selector를 건너뛰며 receiver는 한 번만 평가한다. 원본10/결과18·거부3/frontend1·Dart2·strict 숫자 d.ts·actual compiled Core/Babel 및 실제 runner RN preset을 거친 Hermes3이 PASS다. null-aware indexed write와 광범위 Map/Set 실행 완료로 확대하지 않는다.
- 직접 Bun bundle-to-Hermes x64 O0는 closure 캡처가 Dart0/1/2 대신3/3/3이 되는 FAIL-scoped다. 원래 bundle·bytecode·출력과 실패 로그를 보존했다. 실제 runner와 같은 RN Babel preset의 표준 block-scoping compilation 및 helper module 경로 해석을 거친 경로는18개 결과가 모두 일치했다. 수동 subject body 수정0이며 직접 경로의 실패를 PASS로 바꾸지 않았다. 실제 app/native UI 실행을 새로 검증했다는 뜻도 아니다.
- 최종 compiler의 기존 generic21/15·alias10/18와 각 Hermes3, isolated fresh26/출력39·기존 독립 원본 비교·abstract Simulation은 PASS다. 출력39가 이전 최종 fresh bytes와 일치하고 owning source605·batch state26·sample/runner5 입력은 그대로다. §8.95 현재 native48/cold7은 같은 제품 cohort 범위로 승계한다. 전체 W10·App 제품/public/default 연결·물리 IME/caret/FPS·Windows editor pixels·hardware GPU는 계속 PARTIAL/notVerified다.

## 8.98 변환기 내용 기반 캐시·반복 배치 가속 — 2026-10-17 KST

캐시 검증 기록 (보관된 과거 기록 `w10-batch-cache.json`)에 따라 Dart 분석 IR과 TypeScript generated base를 별도 캐시로 재사용한다. 기본 경로는 `.tmp/work8/port-cache/v1`이고 기존 batch 명령에서 자동 사용한다. `NELYX_PORT_CACHE=off`는 두 계산 캐시를 우회하며 `NELYX_PORT_CACHE_ROOT`로 격리 경로를 지정할 수 있다. 각 배치의 `cache-report.json`과 CLI JSON은 단계별 hit/miss/corrupt/disabled·key·시간을 남긴다. 기존 unchanged promotion 재사용 경계와 계산 캐시 우회는 구분한다.

- 입력 key는 mtime이 아닌 실제 bytes/파일 집합, source 밖의 상대/file/package import·conditional alternative·part URI와 missing dependency, analysis options include, SDK lib/runtime, analyzer/package lock·설정/라이브러리, frontend/compiler, request·resolved IR·module recipe·manual declarations를 포함한다. URI prefix 검사는 캐시 의존성 입장만 담당하며 실제 source 의미는 계속 Dart analyzer가 결정한다. 알 수 없는 directive 경계와 source/tool drift를 임의로 생략하지 않는다.
- 캐시 파일은 SHA256 envelope·artifact 검사를 거쳐 원자적으로 저장한다. 손상은 재계산하고 producer 실패는 게시하지 않는다. 원본 unsupported 진단을 보존하며 hit도 analyzer configuration 소유권을 지킨다. 캐시15건과 실제 Matrix lifecycle7건이 PASS-scoped다. 수동 수정 compose 보존·actual effective 본문 실패·필수 원본 비교 실패/승격 차단·off 결과 동일성을 확인했고 제품/recipe/patch/state를 원복했다.
- 이 호스트에서 단일 분석 10.93s → 0.63s, 실제 Matrix 생성 17.42s → 1.07s였다. 전체26 recipe의 generation-only cold/warm은 41.75s → 12.18s이며, 새로 emit한39개가 모두 직전 §8.97 full26 strict/Nelyx/Dart 검증의 bytes와 일치한다. 두 경로에서 strict 및 abstract Simulation runtime은 실행했다. generation-only에서 recipe별26 fixture를 다시 실행했다는 뜻은 아니다.
- source hash/merge·ownership·strict·semantic·Dart 비교·promotion은 생략하지 않는다. 따라서 위 시간은 생성 단계 측정이며 전체26 semantic/native 회귀의 가속률이 아니다. 이전 full26 검증은 별도 이력으로 유지한다. owning605·promoted26·sample/runner5 및 현재 native48/cold7 공급은 그대로다. App/route 제품 통합과 전체 W10·물리 IME/caret/FPS 등 기존 PARTIAL/notVerified 범위도 유지한다.

## 8.99 concrete accessor field·원본 전체 navigation catalog — 2026-10-17 KST

공통 compiler·source 검증 기록 (보관된 과거 기록 `w10-concrete-accessor-source.json`)에 따라 PageRoute의 concrete getter/field 재정의 IR 장애를 해소했다. `inherited-accessor-source-field`는 정확한 owned accessor origin을 검증하고 private backing storage를 사용한다. 이전 abstract-only policy는 concrete accessor를 계속 거부하는 별도 제한 계약이다. genuine inherited storage, final field와 inherited setter의 partial forwarding, late 초기화, mutable scalar numeric setter ABI는 따로 남긴다.

- 원본13개의 결과30을 Dart debug/assert2·strict/d.ts·source Core·actual compiled Core/RN Babel·supplier Hermes3에서 비교했다. concrete getter/setter의 virtual 읽기/쓰기, lexical super 읽기/쓰기, 3단계 상속, final/mutable/nullable·generic int carrier·private library identity가 일치했다. 잘못된 넓은 타입 대입은 TypeError 후 기존 값을 유지했다. 생성 중 상위 body가 미초기화 override를 읽는 원본은9개 명시적 거부 중 하나로 남기며, Dart에서 실제 derived 값이 관찰되는 것도 확인했다. 기존 abstract field/static default14/20·거부9/frontend3 및 Hermes3도 PASS다.
- 수동 선택 목록 대신 Dart parser의 top-level catalog를 사용했다. **§8.97의 ‘전체28’은 선택28의 이력이며 전체 coverage 주장은 보정한다.** 빠졌던 `_kStandardStiffness`, `_kStandardDamping`, `_kStandardSpring`, `_kStandardTolerance` 4개를 포함한 실제 Cupertino route 전체32(16 class/mixin·global13·함수3)가 모두 IR이다. PageRoute/Page까지34/34이고 App 첫 frontier30/30과의 union57/57이다. 과거 선택28의 IR·공통 runtime 검증을 무효로 확대하지 않는다.
- widgets/routes22 중20, pages3/3, navigator42 중37, cupertino/route32/32의 전체4파일99개를 원본 private body·정확한 span으로 확인했다. App를 포함한 unique121 중114가 IR이며 남은7개는 원본 진단 그대로다: ModalScope/restoration의 null-aware element3, RouteAware의 abstract mixin class, Navigator object if-case, RouteEntry wildcard switch case, History index operator. 일부 probe가 실패한 선언을 다른 probe의 성공으로 덮어서 완료 처리하지 않았다.
- 최종 full26 strict/Nelyx/독립 Dart fixture·abstract Simulation이 PASS이고 raw39개가 직전 full26과 동일하다. 제품605·promoted state26·sample/runner5와 §8.95 native48/cold7 cohort를 보존했다. generic/on/stateful/static mixin application·전체 hierarchy·App 제품/public/default 연결·나머지 W10 및 물리 IME/caret/FPS 등은 계속 PARTIAL/notVerified다.

## 8.100 실제 compiler bytes·실행 중 구현 변경 캐시 경계 — 2026-10-17 KST

compiler identity 검증 기록 (보관된 과거 기록 `w10-compiler-cache-identity.json`)에 따라 배치/context와 generated base key에 실제 import된 TypeScript JS·package manifest의 SHA256을 포함했다. 버전 문자열이 같아도 설치 파일이 바뀌면 새 key로 계산한다. 이미 로드된 TypeScript·converter·emitter가 실행 중 disk 변경을 발견하면 이전 코드로 새 identity의 결과를 게시/재사용하지 않고 새 process를 요구한다.

- 실제 TypeScript 설치를 격리 복사하여 printer/cache cold/warm·같은 버전/경로/보존 mtime의 구현 변경·로드 후 변경 거부와 tool graph 변경 거부4건을 확인했다. 실제 설치 파일은 수정하지 않았다. 새 driver의 Matrix lifecycle7건도 PASS이며 타입/Nelyx/원본 비교·수동 수정 보존·effective 실패·필수 source gate·off는 계속 검증했다.
- 현재 host의 실제 Matrix 생성은 13.29s → 0.95s이고, 기본 cache에 검증된3개 entry를 준비한 뒤 원래 등록 recipe로 두 단계 hit와 동일 bytes를 확인했다. 제품/state는 원복했다. 전체26 generation-only cold/warm·strict/Simulation의 출력39개도 직전 §8.99 full26과 동일하다. generation-only를26 semantic/source fixture 재실행으로 계산하지 않는다.
- source compiler4·제품605·promoted26·sample/runner5·native cohort는 그대로다. §8.99의 전체 source/정확한7개 장애와 mixin/App 통합, 나머지 W10 PARTIAL/notVerified 범위를 유지한다.

## 8.101 null-aware collection·wildcard 원본 변환 — 2026-10-17 KST

공통 compiler 검증 기록 (보관된 과거 기록 `w10-null-collection-source.json`)에 따라 List/Set의 null-aware element와 Map key/value question을 IR에 보존하고 공통 emitter에서 처리한다. 기존 MapLiteralEntry가 question flag를 누락하던 경계도 수정했다. 값은 한 번만 평가하고 checked type witness·generic/int carrier를 전달한다. null key는 value 평가를 건너뛰며 null value는 삽입하지 않는다. mixed Map의 key/value/hash 순서도 실제 Dart와 비교했다. 최종 untyped/unguarded wildcard switch case는 fallback으로 변환하고 typed/guarded/nonfinal 형태는 명시적으로 거부한다.

- 원본16개·결과27개를 Dart debug/assert2·strict/numeric d.ts·source Core·실제 compiled Core/RN Babel·supplier Hermes x64 O0/Og·x86 Og에서 비교했다. null 제거와 일반 null 보존, 한 번 평가, 잘못된 callback의 TypeError와 이후 부작용 차단, hash 순서, nullable selector와 loop break/continue가 일치했다. emitter 거부5/frontend 거부5, const collection 경계는 유지했다.
- 전체 navigation4파일99개 중 IR은 **92 → 96**, 장애는 **7 → 3**으로 줄었다. 해소한 원본은 `_ModalScopeState`, `_NamedRestorationInformation`, `_AnonymousRestorationInformation`, `_RouteEntry`다. 최신 App30/30·route32와 부모34/34·선택 union57/57·전체 unique union121/118을 다시 확인했다. 남은3개는 RouteAware abstract mixin class, Navigator object if-case, History index operator의 원본 진단이다.
- 동결 compiler의 **full26 strict/Nelyx/독립 Dart fixture·abstract Simulation PASS**이며 출력39개는 직전 검증본과 동일하다. 이어서 같은26 요청의 IR cache hit·generation-only strict/Simulation·출력39 byte parity도 확인했다. 이 warm 측정은26 fixture 재실행으로 계산하지 않는다. 제품605·state26·sample/runner5와 현재 native48/cold7 공급은 보존했다.
- generic/on/stateful/static mixin application·projected field/getter 생성 안전성·전체 App 제품/public/default 연결 및 나머지 W10·물리 IME/caret/FPS는 계속 PARTIAL/notVerified다. 직접 raw Bun/Hermes loop capture의 과거 FAIL 범위도 유지한다.

## 8.102 object pattern·index operator·mixin class 원본 경계 — 2026-10-17 KST

공통 compiler 검증 기록 (보관된 과거 기록 `w10-navigation-language-source.json`)에 따라 object if-case의 원본 type/getter/변수·숫자 storage를 IR에 보존했다. 공통 matcher는 selector/getter를 한 번씩 순서대로 읽고 refutable type·guard 실패에서 다음 getter와 본문을 건너뛴다. then 본문은 바깥 scope에 남겨 return/break/continue와 loop closure를 유지한다. 원본 `[]`는 정확한 owned method rename/receiver 계약으로 호출하며 virtual·lexical super와 generic 숫자 carrier를 유지한다.

- 원본22개·결과27개가 Dart debug/assert2·strict/numeric d.ts·source Core·actual compiled Core/RN Babel·supplier Hermes x64 O0/Og·x86 Og에서 일치했다. typed/wildcard/nested object, guard·var 변경, getter 예외·한 번 평가·실패 후 뒤 getter 생략, generic type 실패, loop break/continue·closure 값, nullable index 인자 생략과 generic index virtual/super를 확인했다. emitter 거부6/frontend 거부3을 유지한다. async guard·list/null-check 등 다른 pattern family와 index write는 별도다.
- `mixin class` marker와 실제 constructor identity를 보존한다. stateless/monomorphic Object 적용은 원본 class body와 nominal witness로 처리했다. **고정 Flutter RouteAware의 전체 원문 span**을 수정 없이 fixture에 포함해 실제 didPush/다른 callback과 type identity를 검증했다. generic/stateful/constrained class 적용 및 기존 Cupertino generic/on/stateful/static mixin application은 명시적 미완료다.
- navigation4파일99개는 **99/99 IR·원본 장애0**, App30/30·route32와 부모34/34·선택 union57/57·전체 unique union121/121이다. RouteAware/Navigator/History의 이전3개 장애는 해소했다. 이는 원본 전체 body 분석이며 emitted hierarchy/App 후보·public/default 통합 완료 판정이 아니다.
- 현재 compiler의26 cold/warm generation·strict·abstract Simulation PASS, warm IR hit이며 **전체 recipe IR 181개와 출력39개가 직전 §8.101 full26과 동일**하다. 원본/fixture/제품 입력이 동일하므로 직전 full26 fixture 검증을 보존한다. 이번 recipe fixture 재실행은0이며 새 full26 실행으로 세지 않는다. 새로운 의미는 위 전용 원본22/결과27과 Hermes3에서 검증했다. 제품605·state26·sample/runner5·기존 native48/cold7 cohort와 나머지 W10 PARTIAL/notVerified를 유지한다.

## 8.103 원본 generic/stateful/static mixin 적용·projected getter — 2026-10-18 KST

공통 compiler 검증 기록 (보관된 과거 기록 `w10-mixin-application-source.json`)의 `sourceMixinApplications: {policy: 'owned-source-mixin-application', hasCaptured: 'hasCapturedDartType'}`는 원본 instance body를 적용별 lexical class로 유지한다. static/nominal owner는 한 번만 생성하며 직접 생성할 수 없는 계약이다. superclass의 실제 generic 관계와 원본 on 제약을 맞추고 원래 생성자 entry로 인자를 전달한다. compiler 내부 class·인자·type parameter 이름을 source/recipe와 구분하고 적용 class는 export하지 않는다. 기존 witness API와 captured application 기반 Symbol.hasInstance를 사용하며 제품 runtime은 수정하지 않았다.

- source22/application10/results20이 Dart debug/assert2·strict/declaration·실제 compiled Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. ordered/repeated stateless mixin, direct/ancestor/Object base, generic int 상태와 type test, library별 private 슬롯, 한 static mutable owner와 generic static method, virtual/lexical super getter/setter·dispose·named forwarding·생성자 인자 shadowing을 검증했다. 명시적 거부9와 별도 unsafe constructor 원본 관찰99(debug/assert2)를 기록했다.
- 이미 private backing accessor로 투영된 final field의 파생 getter override를 허용했다. base 생성자가 projected getter를 읽어 파생 상태를 관찰할 수 있는 경우와 genuine unprojected inherited storage는 계속 거부한다. mixin setter의 원본 body·정확한 override origin도 보존한다.
- 고정 CupertinoPageRoute와 page-based route의 **전체 superclass/mixin closure10·적용3**에는 LocalHistoryRoute도 포함한다. 원본 instance method/field body가 모두 동일하며 **lowering과 ClassModel PASS**다. 전체 타입·helper·constructor 접점을 연결한 emitted hierarchy/strict/runtime/App/public/default 후보는 아직 만들지 않았다. external base·dependent generic·interface-only·late/generic instance method 경계도 별도다.
- 새 module bytes를 batch/context identity에 포함했고 실제 cache lifecycle7이 PASS다. Matrix 생성은 15.48s → 1.02s다. 현재26 cold/warm generation·strict·Simulation PASS, warm hit 및 **181 IR/39 raw outputs가 직전 full26-qualified cohort와 동일**하다. 원본 fixture 재실행0이며 직전 full26 검증을 동일 입력의 이력으로 보존한다. 최신 navigation99/99와 제품605/state26/sample5/native cohort도 보존했다. 나머지 W10과 물리 IME/caret/FPS 등은 PARTIAL/notVerified다.

## 8.104 파일별 AST 캐시·원본 route 의존성 frontier — 2026-10-18 KST

캐시·원본 의존성 기록 (보관된 과거 기록 `w10-route-dependency-cache.json`)에 따라 공통 `catalogDartSources`가 파일별 parser AST 목록을 `dart-catalog` namespace로 재사용한다. 서로 다른 배치·순서에도 같은 unit은 hit이며, miss 전체만 한 번의 Dart 프로세스로 읽는다. 실제 source/원본 span·진단·parser/package/SDK/loaded implementation bytes를 검증하고 손상은 재계산한다. `NELYX_PORT_CACHE=off`와 `NELYX_PORT_CACHE_ROOT`는 기존 IR/base 캐시와 함께 적용한다. navigation·외부 route source audit가 이 공통 경로를 사용하며 batch 검증/승격은 캐시하지 않는다.

- 실제 parser 캐시10건이 PASS다. cold3 unit/1프로세스, 순서가 바뀐 겹침0프로세스, 새 unit만 분석, 관련 없는 source 변화, 같은 길이·mtime를 유지한 변경, 유효 envelope의 잘못된 span 복구, 우회, 원래 parse 오류 진단·Unicode/CRLF, 경로·중복 거부와 analyzer 소유권을 확인했다. fixture 7.68s → 1.32s다.
- 원본 navigation99/99 IR은 동일하다. 두 Cupertino route에서 whole body를 따라간 내부 closure는 **72개**, 외부 owner는 **196개(Flutter145·SDK46·기타5)**다. import prefix 사용5는 실제 선언 의존성과 분리했다. dynamic865는 **IR type 발생 위치 수**이며 고유 의미 연산865개라는 뜻이 아니다. 기존 recipe binding 후보69는 검토 전 후보이며 자동 타입 동등성이나 대체 본문으로 사용하지 않는다. 그래프의 원본 body·순서·중복·충돌/unsupported·누락·prefix 경계6건도 PASS다.
- 외부 Flutter owner145를 **59 source unit**의 실제 AST catalog에서 전부 찾아 한 요청으로 읽었다. **원본 whole-body IR120·미지원25·선언 위치 누락0**이다. guarded/object switch·nullable/map/collection 패턴, shorthand, factory/redirect/named constructor/super formal/operator/top-level getter 등 실제 진단을 보존했다. 이 단계는 첫 frontier이며 전체 전이 의존성 폐쇄가 아니다. 실제 audit 10.43s → 2.80s이고, warm은 Dart 프로세스0·IR hit다. catalog/145 IR/25 진단은 cold/warm 및 직전 IR과 같다.
- 원본10 hierarchy emission은 정확한 NavigatorState binding 부재로 차단된다. 임의 binding이나 축약 body는 추가하지 않았다. 별도 Dart probe에서 dynamic과 Object?의 runtime type identity 차이, switch arm/guard 사이 getter cache와 서로 다른 access path의 별도 read를 기록했다. 해당 공통 의미 구현은 후속 작업이다.
- 현재26 cold/warm generation·strict·Simulation PASS, warm hit 및 **181 IR/39 출력 동일**이다. 원본 recipe fixture 재실행0이며 직전 full26 검증을 같은 입력의 이력으로 보존한다. 제품605·state26·sample5·현재 native cohort도 보존했고 이번 native 재검증은 하지 않았다. 전체 emitted hierarchy/App/public/default와 W10 전체는 PARTIAL이다.

## 8.105 캐시된 공통 object/guard switch·nullable/collection 패턴 — 2026-10-18 KST

공통 source pattern 기록 (보관된 과거 기록 `w10-cached-source-patterns.json`)의 `patternMatching: {policy: 'ordered-cached-access-paths', equals: 'dartValueEquals'}`는 analyzer 원본 패턴을 guard/object/typed/nullable switch expression·statement와 collection if-case에 연결한다. field의 원래 getter·applied/storage 타입을 유지하고, matcher의 neutral numeric carrier에서 원래 변수 타입으로 되돌린다. 기존 scalar/record switch 경로와 정책 없는 object if-case 경로는 보존한다. 제품 runtime 변경은 없다.

- getter cache는 **정적 접근 경로**로 구분한다. 같은 경로는 앞 arm/guard 실패 뒤에도 한 번 읽은 값을 유지한다. a와 b가 같은 객체를 가리켜도 a.state와 b.state는 각각 읽는다. public inherited getter의 같은 경로는 공유하고 private library 이름은 기존 property identity를 따른다. guard·변수 scope와 평가 순서, getter 실패의 즉시 전파를 보존한다.
- 원본23/results26·명시적 거부6·frontend 거부2가 Dart debug/assert2·strict/numeric d.ts·actual compiled Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. T()·정확한 generic/nullable witness, int/double constant equality와 Object widening, binding 없는 logical-or, collection의 guard/else, empty source case body 공유, 주변 break/continue와 closure capture를 포함한다. 이전 source22/results27·거부6/frontend3도 Dart2/Core/Babel/Hermes3로 재실행했다. 이전 null-check negative는 이제 별도 미지원인 null-assert로 바꿨다.
- 같은 실제 외부 owner145 요청은 whole-body IR **120 → 126**, 미지원 **25 → 19**, 선언 위치 누락0이다. 새로 원본 전체 IR을 읽은 선언은 **FlutterErrorDetails·FlagProperty·DragGestureRecognizer·ServicesBinding·Action·Element**다. Focus·GlobalKey의 패턴 장애는 해소됐지만 원래 factory 생성자 진단이 다음 차단점으로 드러났다. navigation99/99·App30/30·중복 제거 union121/121 IR도 현재 frontend에서 검증했다. 이는 emitted hierarchy나 제품 App 통합이 아니다.
- 원본10 hierarchy의 현재 emission probe는 정확한 NavigatorState binding 부재로 계속 차단된다. logical-or 변수 join·record/map/list/null-assert 패턴·suspended matcher 등은 명시적 경계로 남긴다. 기존 raw Bun-to-Hermes capture FAIL 이력과 actual RN Babel 경로의 PASS도 구분한다.
- cache lifecycle7·현재26 cold/warm generation/strict/Simulation·warm IR hit PASS다. **181 IR/39 출력이 직전 full26-qualified cohort와 동일**하며 원본 recipe fixture 재실행0이다. 해당 fixture 이력·제품605·state26·sample5·현재 native cohort를 보존했다. 이번 full native/물리 IME/caret/FPS 검증은 하지 않았고 W10 전체는 PARTIAL이다.

## 8.106 원본 named 생성자 본문·상속 default AST·dot shorthand — 2026-10-18 KST

공통 생성자 검증 기록 (보관된 과거 기록 `w10-constructor-body-source.json`)에 따라 monomorphic named generative constructor는 기존 초기화 계획으로 field 값을 순서대로 평가하고 정확한 owned base/newTarget으로 한 번 할당한 뒤 원래 본문을 실행한다. 본문을 생략할 수 있는 compact 경로와 구분했다. early return은 생성된 객체를 반환하고 중첩 closure의 return은 유지한다. named-only class의 private unnamed 생성 계약과 실제 owner witness capture도 검증했다. lexical super member 본문·generic named/generic-base 계획과 unsafe base 관찰은 계속 명시적으로 거부한다.

- 상속된 객체 기본값은 문자열 파싱·새 객체·임의 null로 바꾸지 않는다. analyzer의 super-parameter 관계를 **3단계 상속의 실제 default 선언**까지 따라가 resolved library AST를 사용한다. private/static/inline const identity와 출처 library/source·정규화 source hash·원본 UTF-16 offset/span hash를 보존했다. 원본9곳의 Unicode/CRLF span을 검증했다. 함수/enum/primitive에 대한 기존 기본값 경로는 유지했고 generic-function/constructor-function default는 별도다.
- dot shorthand static property는 analyzer의 정확한 getter/owner로 변환한다. enum .forward/.reverse 및 const .zero의 source identity를 검증했다. constructor shorthand나 이름 기반 owner 추론은 추가하지 않았다.
- 원본22/results13·거부3/frontend1이 Dart debug/assert2·strict/numeric d.ts·actual compiled Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. named/body·initializer·base 실행 순서와 unnamed body 비실행, early return/closure·예외 값, named-only/ancestor witness, canonical const·private 기본값·3단계 상속을 포함한다. 직전 cached pattern source23/results26도 Dart2/Core/Babel/Hermes3로 재검증했다.
- 같은 외부 owner145는 whole-body IR **126 → 134**, 미지원 **19 → 11**, 위치 누락0이다. 새 원본 전체 IR은 **AnimationController·PointerCancelEvent·PointerDownEvent·PointerUpEvent·PerformanceModeRequestHandle·TickerFuture·RestorationBucket·Stack**다. navigation99/99·App30/30·중복 제거 union121/121도 현재 frontend로 검증했다. 나머지 factory/generic named/getter/operator/map-pattern 진단은 원본 그대로 기록했다. 현재 원본10 hierarchy emission은 정확한 NavigatorState binding 부재로 차단된다. 전체 emitted/runtime/App 후보는 아직 없다.
- cache lifecycle7·현재26 cold/warm generation/strict/Simulation·warm IR hit PASS다. **181 IR/39 출력이 직전 full26-qualified cohort와 동일**하고 원본 recipe fixture 재실행0이다. 해당 fixture 이력·제품605·state26·sample5·현재 native cohort를 보존했다. 이번 전체 native/물리 IME/caret/FPS 검증은 하지 않았고 W10 전체는 PARTIAL이다.

## 8.107 optional redirect factory·인자 provenance·선택 fixture 검증 — 2026-10-18 KST

공통 factory 검증 기록 (보관된 과거 기록 `w10-optional-factory-source.json`)에 따라 optional positional/named redirect factory와 factory chain의 기본값을 원래 target AST에서 찾는다. factory의 analyzer parameter 자체에는 hasDefaultValue/code가 없을 수 있어, 실제 redirect constructor 관계와 positional index/named identity로 최종 선언까지 따라간다. 다른 positional 이름·private const/function identity·target에만 있는 추가 옵션·호출 인자 평가 순서와 generic/int carrier를 보존한다. redirect args에는 실제 declared/applied parameter와 source storage provenance를 함께 담는다.

- 원본17/results11·거부4·default origin6이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. default의 Unicode/CRLF 원본 span, cross-library private 상수·함수와 canonical const identity, null/전체 인자/chain, generic 숫자 값과 subtype witness를 포함한다. 직전 생성자22/results13·3단계 default span9도 Dart2/Core/Babel/Hermes3로 재실행했다. const optional factory 호출의 canonical 계약과 unnamed/factory-only 생성자 소유권은 별도이며 임의 fallback을 추가하지 않았다.
- 실제 외부 owner145는 whole-body IR **134 → 137**, 미지원 **11 → 8**, 위치 누락0이다. 새 원본 전체 IR은 **Animation·Focus·FocusScope**다. navigation99/99·App30/30·중복 제거 union121/121도 현재 frontend로 검증했다. 원본10 hierarchy의 현재 emission은 정확한 NavigatorState binding 부재로 차단된다. 전체 emitted/runtime/App 후보는 아직 없다.
- 기존26 recipe는 모두 현재 생성·strict·Simulation을 통과했고 **39 출력이 byte 동일**하다. 181 IR 중 **180개 동일**, WidgetStateProperty.fromMap의 **인자 provenance만 바뀐1개**를 별도 감사했다. `class-regression.ts --fixture-recipes w10-widget-state`로 변경 recipe의 semantic/source fixture를 **실제로1개 재실행**했고, 나머지 **25개는 같은 입력·IR·출력의 이전 fixture 증거로 보존**했다. 잘못된 selection/mode3건도 거부했다. full26 fixture를 재실행했다고 기록하지 않는다.
- 현재 검증은 `currentRecipeQualification26`의 mixed coverage로 기록한다. 이전 `currentFresh26`은 `lastFullFixtureRun26` 이력으로 옮겼다. 후속 변경도 currentGeneration26의 IR/출력으로 영향 recipe를 계산하고 선택 fixture를 실행한다. cache lifecycle7·warm IR hit·제품605/state26/sample5/native cohort 보존도 PASS다. 이번 전체 native/물리 IME/caret/FPS 검증은 하지 않았고 W10 전체는 PARTIAL이다.

## 8.108 unnamed factory·실제 generative anchor·factory-only 소유권 — 2026-10-18 KST

공통 factory 소유권 검증 기록 (보관된 과거 기록 `w10-unnamed-factory-source.json`)에 따라 unnamed factory의 원본 body/redirect를 실제 인스턴스를 초기화하는 generative constructor와 분리한다. IR은 실제 source constructor reference와 nominal superclass를 보존한다. generative anchor가 있으면 보호된 constructor가 기존 초기화·base 호출·body 순서를 수행하고, concrete named entry는 checked witness/인자를 전달한다. abstract owner의 reserved-name anchor도 실제 subclass super entry로 연결한다. generative constructor가 없는 factory-only owner는 할당할 수 없으며, factory가 반환한 실제 구현체의 타입·identity를 유지한다. owner instance initializer/field store/capture를 생성된 할당 경로처럼 실행하지 않는다.

- 원본 **21개/results10·거부4·factory owner6**이 Dart debug/assert2·strict/d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. generic Box와 abstract KeyLike의 witness/인자 전달, factory→anchor·base→derived 실행 순서, 기존 canonical 구현체 반환과 fresh non-const identity, implements factory-only owner의 nominal type check, 실행되면 throw하는 owner instance initializer 미실행을 포함한다. 직전 optional factory17/results11/default origin6도 Dart2/Core/Babel/Hermes3로 재실행했다. const unnamed/optional canonical 계약·explicit .new 표기·generic named non-anchor·factory-only non-Object ancestry/mixin은 별도 경계다.
- 같은 실제 외부 owner145의 whole-body IR은 **137 → 140**, 미지원 **8 → 5**, 위치 누락0이다. 새 전체 원본 IR은 **FlutterError·Key·GlobalKey**이며 남은5는 DiagnosticsProperty·defaultTargetPlatform·Velocity·EdgeInsets·WidgetsBinding이다. navigation99/99·App30/30·union121/121은 IR 검증이며, 원본10 emission은 정확한 NavigatorState binding 부재로 계속 차단된다. 전체 hierarchy/App 제품 후보는 아직 없다.
- 현재26 recipe 전체 생성·strict·Simulation을 통과했고 **181 IR 전부와39 출력 byte가 이전과 같다**. semantic/source fixture는 이번 **0개 실행**, 이전 mixed coverage **26개 보존**이다(§8.107의 실제 실행1+이전 full-run25). `currentRecipeQualification26`에 recipe/input/IR/output 불변 근거와 이전 qualification 연결을 기록했다. warm IR hit·cache lifecycle7·제품605/state26/sample5/native cohort 보존도 PASS다. full26 fixture나 전체 native/물리 IME/caret/FPS를 새로 검증한 것으로 기록하지 않으며 W10 전체는 PARTIAL이다.

## 8.109 generic named generative·타입을 보존한 초기화 helper — 2026-10-18 KST

공통 제네릭 생성자 검증 기록 (보관된 과거 기록 `w10-generic-named-source.json`)에 따라 generic named generative 원본을 IR에 보존하고, 초기화 helper가 실제 source owner·type arguments·bounds·checked witness를 전달한다. 임시 helper class를 실제 runtime type으로 만들지 않고 exact base constructor와 source owner newTarget으로 할당한다. base의 declared storage를 출력한 뒤 analyzer-resolved 인자로 적용해 T→int가 boxed carrier를 scalar number로 바꾸지 않게 한다. protected abstract anchor도 원본 formal tuple로 검증하며, 생성자 본문의 타입 조회는 실제 source owner를 가리킨다. private accessor backing storage가 있는 반환값은 captured owner witness로 검사한다.

- 원본 **20개/results14·거부5·generic owner8+generic base를 둔 monomorphic owner1**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. 여러 생성자·named-only·factory owner 추가 entry, base named options와 T callback, protected abstract base/accessor backing storage, 원래 field/init/base/body 순서, own/inherited method와 T 조회, early return/nested closure/throw, int/double bounded carrier를 포함한다. 잘못된 T 인자는 관찰 가능한 초기화 전에 거부한다. 기존 generic 미지원 fixture는 실제 external constructor 경계로 바꾸었고, 이전 monomorphic 생성자22/results13/default origin9·external 거부1·unnamed factory21/results10도 Dart2/Core/Babel/Hermes3로 재실행했다.
- 같은 외부 owner145의 whole-body IR은 **140 → 141**, 미지원 **5 → 4**, 위치 누락0이다. 새 전체 원본 IR은 **DiagnosticsProperty**이며 남은4는 defaultTargetPlatform·Velocity·EdgeInsets·WidgetsBinding이다. navigation99/99·App30/30·union121/121은 IR 검증이고 원본10 emission은 정확한 NavigatorState binding 부재로 차단된다. DiagnosticsProperty 전체 emitted/runtime 및 hierarchy/App 제품 후보를 검증한 것은 아니다. const unnamed/optional factory·explicit .new·다른 named super entry·lexical-super member body dispatch는 별도 경계다.
- 현재26 recipe 전체 생성·strict·Simulation을 통과했고 **181 IR 전부와39 출력 byte가 이전과 같다**. semantic/source fixture는 이번 **0개 실행**, 이전 mixed coverage **26개 보존**이다(§8.108 보존 감사 및 §8.107 실제 실행1+이전 full-run25). currentRecipeQualification26에 불변 근거와 이전 qualification 연결을 기록했다. warm IR hit·cache lifecycle7·제품605/state26/sample5/native cohort 보존도 PASS다. full26 fixture나 전체 native/물리 IME/caret/FPS를 새로 검증한 것으로 기록하지 않으며 W10 전체는 PARTIAL이다.

## 8.110 source arithmetic operator·인자/반환 provenance·영향 recipe 검증 — 2026-10-18 KST

공통 source operator 검증 기록 (보관된 과거 기록 `w10-source-operators-source.json`)에 따라 owned framework 연산자를 실제 analyzer method identity와 arity로 연결한다. 같은 클래스의 unary/binary minus를 별도 slot으로 내보내고, operator token 자체를 JS 산술로 바꾸지 않고 원본 body를 호출한다. 원본 override는 같은 생성 slot을 사용하며, 다른 멤버와 충돌하거나 외부 override 관계가 불명확하면 차단한다. opt-in sourceOperators 정책을 쓰고 기존 명시적 operator mapping은 보존한다. binary operand의 declared/applied type과 operator 결과·괄호 expression의 원래 storage type을 IR에 남겨 T→int carrier와 callback 전달을 보존한다.

- 원본 **28개/operator21/results26·거부7**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. unary/binary minus·산술/비교/bitwise source method·override dispatch·receiver→argument→body 평가 순서, T operand와 return·numeric callback bridge와 괄호로 묶은 generic 숫자 결과의 추가 산술을 포함한다. 후자의 중복 scalarization 오류를 별도 diagnostic IR로 재현하고, inner expression에서 변환한 값을 괄호가 다시 변환하지 않도록 고쳤다. 최종 compiler로 영향10 fixture를 다시 실행했다. bitwise 사례는 사용자 정의 body dispatch의 검증이며 JS의 넓은 정수 bit 연산 의미를 검증한 것이 아니다. bounded int modulo/truncation은 기존 Core의 명시적 exact host로 비교했다. overloaded compound/increment·unbound/dynamic·source-owned SDK operator provenance는 별도 경계다. 기존 generic named20/results14·거부5와 mixin22/application10/results20·거부9도 Dart2/Core/Babel/Hermes3로 재실행했다.
- 같은 외부 owner145의 whole-body IR은 **141 → 143**, 미지원 **4 → 2**, 위치 누락0이다. 새 전체 원본 IR은 **Velocity·EdgeInsets**이며 남은2는 defaultTargetPlatform getter·WidgetsBinding map pattern이다. navigation99/99·App30/30·union121/121은 IR 검증이고 원본10 emission은 정확한 NavigatorState binding 부재로 차단된다. 두 클래스 전체 emitted/runtime 및 hierarchy/App 제품 후보를 검증한 것은 아니다.
- 현재26 recipe 생성·strict·Simulation과 **39 출력 byte 불변**을 확인했다. 181 IR 중 **164개 동일**, **17개는 operator 인자/반환 및 괄호 storage metadata144개 추가만** 있었다. 변경 recipe를 실제 계산해 **10개 semantic/source fixture를 재실행**했고 **16개는 같은 recipe/input/IR/output의 이전 qualification을 보존**했다. 대상은 matrix·Cupertino/Material/Raw scrollbar·tree·2D·Viewer·wheel builder/renderer/widget이다. currentRecipeQualification26은 fresh10+retained16이며 full26 fixture 재실행이라고 기록하지 않는다. warm IR hit·cache lifecycle7·제품605/state26/sample5/native cohort 보존도 PASS다. 전체 native/물리 IME/caret/FPS는 새로 검증하지 않았고 W10 전체는 PARTIAL이다.

## 8.111 live top-level getter·Map pattern·외부 첫 frontier IR 완료 — 2026-10-18 KST

공통 getter/Map 검증 기록 (보관된 과거 기록 `w10-live-getter-map-source.json`)에 따라 원본 top-level getter body를 매 read마다 실행하는 frozen readonly accessor namespace로 내보낸다. opt-in 정책과 정확한 analyzer GETTER identity를 사용하며, 내부 namespace 이름은 원본 local/parameter와 충돌하지 않는다. private·prefixed cross-library 접근, 중첩 read·numeric return·closure·예외를 보존하고 eager snapshot으로 대체하지 않는다. lazy top-level 변수·setter·async/external getter는 별도 경계다.

- getter **원본18/getter8/results12·거부6·frontend 거부1**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. 초기화 전 reads0, 반복 read, 숫자 boxing, 매번 새 callback identity·closure 호출, 반복 예외와 Unicode/CRLF 원본 span을 검증했다.
- Map pattern **원본17/results26·거부4**도 같은 Dart2/strict/Core/Babel/Hermes3에서 일치했다. Core nominal Map 확인 후 key get을 먼저 실행하고 결과가 null일 때만 containsKey로 absence를 구분한다. 실패 arm/guard 사이의 lookup·presence cache, 정확한 typed Map·generic binding·collection if-case·중첩/object path, 추가 entry, guard mutation 후 기존 cache를 검증했다. analyzer 상수 평가로 key의 타입/값/identity를 보존하며 const alias는 같은 key cache를 공유하고 int1/double1.0 및0.0/-0.0 lookup은 Dart처럼 구분한다. signed zero는 JSON 숫자로 부호를 잃지 않도록 analyzer가 확인한 double zero metadata를 보존한다. enum constant key identity를 검증했으며 nominal enum type-test를 검증한 것은 아니다. non-scalar/nonfinite/wide integer key·dynamic typed argument·or binding join은 별도 경계다.
- 기존 cached pattern/source operator 원본 비교 및 Hermes3 회귀 검증도 PASS다. 동일 외부 owner145 whole-body IR은 **143 → 145/145**, 미지원 **2 → 0**, 위치 누락0이며 새 원본은 **defaultTargetPlatform·WidgetsBinding**이다. 이는 route72의 **첫 외부 frontier** 검증이다. 전체 재귀 source graph·원본10 emission·App 제품 통합은 미완료이며 정확한 NavigatorState binding 부재 진단은 유지된다. navigation99/99·App30/30·union121/121도 IR 범위다.
- 현재26 recipe 생성·strict·Simulation, **181 IR 전부 동일·39 출력 byte 동일**, warm IR hit·cache lifecycle7 PASS다. 실제 Matrix generate는 cold13,657ms → warm941ms(약14.5배)였으며, 이 수치는 전체 build/검증 시간을 뜻하지 않는다. **fixture 신규 실행0/기존26 qualification 보존**이며 full26 fixture 재실행으로 기록하지 않는다. 제품605/state26/sample5/native cohort는 보존했다. 물리 IME/caret/FPS·Windows editor pixels·hardware GPU 검증은 추가하지 않았고 W10 전체는 PARTIAL이다.

## 8.112 원본 source 재귀 배치·의존성 fixed point·warm 재사용 — 2026-10-18 KST

재귀 원본 의존성 검증 기록 (보관된 과거 기록 `w10-route-transitive-source.json`)에 따라 첫 외부145에서 멈추던 경로를 exact analyzer library/owner 기준의 공통 expansion으로 확장했다. 매 round의 전체 body를 한 배치로 추출하며 순환 참조와 이미 시도한 owner는 중복 처리하지 않는다. 요청/응답 owner·source·symbol을 검증하고, 원본 body 미지원·정확한 위치 미해결·round 한도·정책 밖 경계를 분리한다. 미지원 owner를 빈 body나 대체 타입으로 바꾸지 않는다.

- 원본 navigation99+첫 frontier145의 **seed244**에서 **9 round·새 owner1403/새 IR1335**를 추출했고, 현재 reachable whole-body IR은 **1552개**다. 원본 span **1579개/245개 unit**의 실제 bytes와 pinned revision을 확인했다. **미지원 body65·위치 미해결3·정책 밖 SDK247/기타13·미시도0**를 남긴다. represented IR의 fixed point이며 **미지원 body 안의 추가 의존성과 전체 transitive closure는 미완료**다. dynamic2106은 IR occurrence 수이며 semantic operation 수가 아니다.
- 원본 두 library/5개 선언을 analyzer로 분석한 graph 검증 **14개**와 기존 closure 검증6개가 PASS다. 순환 참조·미사용 선언 제외·원본 불변·response 순서·round 한도·미지원/미해결 유지·충돌/누락/중복/잘못된 library/source/body identity 거부를 확인했다. whole traversal 재실행은 **aggregate IR·frontier bytes 동일**, **parser process0·IR miss0**이었다. cold257267ms → warm27358ms는 이 추출 cohort의 측정이며 제품 build/전체 검증 성능을 의미하지 않는다.
- 현재26 recipe 생성·strict·Simulation은 **181 IR·39 출력 byte 동일**이며 **fixture 신규0/기존26 qualification 보존**이다. 제품605/state26/sample5/native cohort는 유지했다. 원본 route10 emission은 정확한 NavigatorState binding 부재로 여전히 차단된다. 다음 작업은 blocker manifest의 원본 언어 경계를 공통 변환기에서 해소한 뒤 재귀 확장을 다시 수행하고, source-equivalent hierarchy·App 제품 통합으로 연결하는 것이다. W10 전체는 PARTIAL이다.

## 8.113 source do-while·lexical label·switch case 이동 — 2026-10-18 KST

공통 원본 control-flow 기록 (보관된 과거 기록 `w10-source-control-flow.json`)에 따라 do-while·empty statement와 analyzer가 확인한 label identity를 공통 IR/emitter에 추가했다. label은 local control identity이며 source dependency로 분류하지 않는다. 반복문·block의 break/continue는 정확한 lexical target으로 연결하고, labeled scalar/enum switch의 case 이동은 case index dispatcher로 내보낸다. synthetic dispatcher loop를 통과하는 continue는 원본 반복문 label로 연결해 목적지가 바뀌지 않게 한다. callable에 진입할 때 control scope를 격리한다. 원본 static type으로 switch entry를 widen해, 상수0으로 진입한 후 다른 case로 이동하는 유효한 Dart가 TypeScript literal narrowing에 막히지 않게 했다.

- 원본 **21개/results30·거부7·frontend 거부2**가 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. body→condition·continue→condition·break 순서, 여러 loop label·block break·for-in, scalar/string/enum case 이동·empty group·동일 case 재진입·no-match, 중첩 switch에서 outer case로 이동, 바깥/안쪽 loop continue, finally가 jump/return/throw를 바꾸는 동작, loop 안에 선언한 closure의 label scope·generic loop를 검증했다. guarded/refutable pattern case label은 전체 원본 IR에서 명시적으로 거부한다. 기존 cached pattern23/results26·거부6도 Core/Babel/Hermes3로 다시 검증했다.
- 같은 route roots의 재귀 추출은 **9 round·reachable IR1573**, **미지원 body63·위치 미해결3·SDK247/기타13**다. 이전 미지원 원본 중 **LicenseEntryWithLineBreaks·VelocityTracker·RenderViewport**가 whole-body IR로 진전했다. 새 body 안의 추가 owner도 재귀로 추출했으며 원본 span1600개를 확인했다. represented IR fixed point이며 미지원 body 내부의 숨은 의존성과 전체 hierarchy/App 통합은 미완료다. warm 재실행은 aggregate IR/frontier bytes 동일·parser0·IR miss0이다.
- 현재26 recipe 생성·strict·Simulation은 **181 IR·39 출력 byte 동일**, **fixture 신규0/기존26 qualification 보존**이다. graph14/기존closure6도 PASS다. 제품605/state26/sample5/native cohort는 보존했다. 원본 route10 emission은 정확한 NavigatorState binding 부재로 여전히 차단되고 W10 전체는 PARTIAL이다.

추가 감사에서는 **exhaustive labeled bool switch의 all-return typing이 TS2366으로 실패**했다. 원본 Dart는 true/false 모두1을 반환하며, generated TS는 반환 경로 증명이 부족하다. 이 별도 FAIL-reproduced 사례를 위 source21/results30 PASS cohort와 구분해 보존했고, §8.114에서 nonexhaustive no-match를 보존하면서 수정·재검증했다.

## 8.114 exhaustive labeled case 반환 경로·TS2366 수정 — 2026-10-18 KST

공통 source case-return 기록 (보관된 과거 기록 `w10-source-case-return.json`)에 따라 §8.113 추가 감사의 TS2366을 수정했다. 실제 Dart 원본 true/false가 모두1을 반환하던 같은 probe가 현재 strict TypeScript에서도 진단0이다. analyzer의 공개 AST에는 exhaustive flag가 없어, resolved bool/enum/nullability와 공개 constant evaluation으로 case coverage를 IR에 남겼다. const alias의 bool 값과 정확한 enum owner·상수 index/field identity도 사용한다. 판정은 emitter의 이름·값 모양 추정이 아니다. exhaustive dispatcher의 불가능한 state만 explicit sourceFlow 정책 아래 거부하며 원본 body에 임의의 반환값을 추가하지 않는다.

- 원본 **20개/results27·거부7**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. bool·enum·nullable·default·const alias, empty group·동일 case 재진입·finally return/jump·throw의 반환 경로와 break 후 이어지는 동작을 검증했다. nonexhaustive **int/string** switch의 no-match는 기존처럼 다음 statement로 이어진다. bool/enum의 누락 case나 default가 마지막이 아닌 Dart는 analyzer가 오류로 차단하며 이를 유효한 원본으로 취급하지 않는다. coverage metadata 누락/잘못된 값·정책 부재/불일치·잘못된 jump는 emitter가 거부하고, invalid host bool/enum state 두 건은 Bun에서 별도 거부를 확인했다.
- 기존 control-flow21/results30·거부7/frontend2와 cached pattern23/results26·거부6도 Dart/Core/Babel/Hermes3로 재실행했다. 같은 재귀 source graph는 **IR1573·미지원63·위치3·SDK247/기타13**로 유지된다. **1개 record에 exhaustive boolean metadata1개 추가만** 있었고 원본 body/span·의존성 frontier는 동일하다. warm aggregate IR/frontier bytes 동일·parser0·IR miss0도 확인했다. represented fixed point이며 hidden unsupported dependency 및 전체 hierarchy/App 통합은 미완료다.
- 현재26 recipe 생성·strict·Simulation은 **181 IR·39 출력 byte 동일**, **fixture 신규0/기존26 qualification 보존**이다. graph14/기존closure6·제품605/state26/sample5/native cohort 보존도 PASS다. 원본 route10의 NavigatorState binding·잔여 language/source closure·App 제품 및 native/물리 검증이 남아 W10 전체는 PARTIAL이다.

## 8.115 relational·logical-and pattern 캐시·원본 비교 연산 — 2026-10-18 KST

공통 비교 패턴 기록 (보관된 과거 기록 `w10-relational-pattern-source.json`)에 따라 원본 relational pattern과 logical-and pattern의 분석·공통 emitter를 확장했다. 실제 Dart의 연산자 호출 결과는 가드가 실패한 뒤에도 같은 access path·virtual selector·canonical constant 조합에서 재사용된다. ==와 !=는 결과를 공유하며 int0/double0.0은 다른 cache key다. static receiver가 Base에서 Child로 좁혀져도 같은 virtual selector의 결과를 공유한다. logical-and는 원본 순서·실패 시 단락·변수 바인딩을 보존한다.

- 원본 **28개/results23·거부8/frontend3**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. 비교6종·NaN/infinity/negative-zero 입력, alias·nullable·Object refinement·guard mutation·getter/path 구분·throw·상속 override·generic operator 인자를 검증했다. primitive 비교는 analyzer 숫자 provenance와 tagged Core carrier를 사용한다. owned equality의 Object 인자에도 declared/applied storage를 전달하며, 숫자 object pattern target은 저장된 carrier 타입으로 유지한다. nullable Object virtual equality는 기존 Core value-semantics의 명시적 class 등록 경계를 사용한다. 제품 class의 자동 등록이나 full App 검증을 의미하지 않는다.
- dynamic operator·무한대/unsafe integer 상수 operand는 frontend가 거부한다. 정책·import·canonical identity·operator identity·parameter provenance·원본 operator ownership 누락과 중복 and binding을 emitter가 거부하며, raw host number의 numeric kind 소거는 runtime에서 거부한다. 기존 Map17/results26·cached patterns23/results26·source operators28/results26도 Dart/Core/Babel/Hermes3로 재검증했다.
- 재귀 원본 graph는 **IR1580·미지원60·위치3·SDK248/기타13**다. 직전 미지원 중 **3개 whole body**(RenderRepaintBoundary, _SpringSolution, _colorFromHue)가 새로 표현되고 새로 드러난 의존성도 확장했다. 이는 represented fixed point이며 unsupported body 내부의 숨은 의존성은 남는다. cold 211.7초 → warm 28.1초, aggregate IR/frontier bytes 동일·warm parser0·IR miss0을 확인했다.
- 현재26 recipe 생성·strict·Simulation은 **181 IR·39 출력 byte 동일**, **fixture 신규0/기존26 qualification 보존**이다. graph14/기존closure6·제품605/state26/sample5/native cohort 보존도 PASS다. NavigatorState binding과 전체 source hierarchy/App 제품·물리 검증이 남아 W10 전체는 PARTIAL이다.

## 8.116 record 대입 패턴·검사/대입 순서·checked dynamic 값 — 2026-10-18 KST

공통 record assignment 기록 (보관된 과거 기록 `w10-record-assignment-source.json`)에 따라 실제 RenderObject·Scrollable·BoxBorder·RevealedOffset을 막던 record 대입 문법을 공통 frontend/IR/emitter에서 처리했다. RHS는 한 번 평가하고 positional/named/nested shape·cast·null assertion 검사를 모두 마친 뒤 원본 순서로 local/parameter를 대입한다. 반환값은 원본 RHS record다. analyzer의 실제 target element·matched type·공개 TypeSystem.isSubtypeOf 결과로 implicit cast 필요 여부를 IR에 보존하며 이름이나 JS 숫자 모양으로 판단하지 않는다.

- 원본 **23개/results28·거부11/frontend2**가 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. swap·중첩/이름/혼합 record·부모 괄호·RHS 부작용 순서·결과 identity·nullable/cast/shape 실패·generic int/double·Object 저장·closure·chained/short-circuit/loop를 검증했다. match/cast 실패 때 변수는 유지된다. 반면 late final의 commit 실패는 먼저 대입한 변수 변경을 유지한다는 실제 Dart 결과도 보존했다. source duplicate 대입은 Dart가 오류로 차단하며 잘못된 중복 IR도 emitter가 거부한다. 생성자 initializer가 parameter를 바꾸고 default anchor의 field 순서가 다른 별도 원본1/results2도 Dart2/strict/Core/Babel/Hermes3로 검증했다.
- dynamic 값은 explicit checked-erased-values 정책 아래 unknown과 숫자 carrier로 저장한다. int7과 double7.0도 provenance를 보존한다. dynamic 호출/연산2건은 계속 emitter가 차단하며, 원본 dynamic dispatch 전체를 지원한다는 의미가 아니다. empty record·다른 assignment pattern은 frontend 경계2건, runtime record/callable cast와 suspending RHS는 별도 미지원 경계다. 기존 relational28/results23·cached patterns23/results26은 Hermes3까지, numeric record25그룹은 Dart2/Core/Babel로 재검증했다.
- 재귀 원본 graph는 **IR1588·미지원56·위치3·SDK248/기타13**다. 직전 미지원 중 **4개 whole body**(RenderObject, Scrollable, RevealedOffset, BoxBorder)가 표현됐고 추가 owner record4개도 분석했다. 다른 body에 새로 드러난 진단은 frontier manifest에 유지했다. represented fixed point는 숨은 unsupported dependency 폐쇄나 전체 emitted App 검증이 아니다. cold 210.7초 → warm 27.9초, aggregate IR/frontier bytes 동일·warm parser0·IR miss0을 확인했다.
- 현재26 recipe 생성·strict·Simulation은 **181 IR·39 출력 byte 동일**, **fixture 신규0/기존26 qualification 보존**이다. graph14/기존closure6·제품605/state26/sample5/native cohort도 보존했다. NavigatorState binding과 전체 hierarchy/App 제품 통합·물리 검증은 남아 W10 전체는 PARTIAL이다.

## 8.117 refutable record 패턴·named 선언·Core shape probe — 2026-10-18 KST

공통 record pattern 기록 (보관된 과거 기록 `w10-record-pattern-source.json`)에 따라 positional/named/mixed/nested record의 refutable 패턴과 named 선언 분해를 확장했다. shape 판정은 기존 Core read의 private brand·완전한 shape 검사 경계를 사용한다. 순수 shape probe의 실패만 패턴 불일치로 다루며, 객체 getter·가드·숫자 provenance 검사 예외는 그 범위 밖에서 원본처럼 전파한다. JavaScript 배열 모양으로 Dart record를 추정하지 않는다. 기존 positional 상수/wildcard switch가 처리하던 경로는 유지하고 새 binding·guard·typed·named·nullable·or 패턴만 확장된 matcher로 보낸다.

- 원본 **27개/results30·거부14/frontend1**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. 정확한 arity/names·중첩 shape·int/double 구분·generic/nullable binding·Object getter/cache path·guard mutation·공유 case binding·mutable local·collection if-case·단일 selector 평가를 검증했다. plain source List가 record로 매칭되지 않고 getter/guard/invalid numeric provenance 오류가 shape probe에 숨지 않는 것도 확인했다.
- named/mixed 선언은 resolved record field path를 보존한다. 필요 implicit cast는 공개 analyzer TypeSystem.isSubtypeOf 판정과 정확한 declared type으로 기록하며, runtime witness와 numeric carrier를 사용한다. 누락/변조된 cast metadata는 거부한다. 기존 source 대입23/results28·cached pattern23/results26은 Hermes3까지, numeric record25그룹은 Dart2/Core/Babel로 재검증했다. legacy positional/record-switch fixture는 IR 추출과 별도 matcher 정책을 구분하며, named fixture는 새 선언 분해를 실제 실행한다. 기존 정상 흐름도 fixture3개에서 재실행했다. empty record·variable or-join·runtime record-type witness는 명시적 잔여 경계다.
- 재귀 원본 graph는 **IR1644·미지원52·위치5·SDK258/기타15**다. 이전 미지원 **6개 whole body**(TextStyle, StackParentData, Text, RenderTapRegionSurface, BannerPainter, RenderFlex)가 표현됐고 새 owner record52개도 분석했다. represented fixed point이며 unsupported body의 숨은 의존성과 전체 emitted hierarchy/App 통합은 남는다. cold 271.5초 → warm 34.8초, aggregate IR/frontier bytes 동일·parser0·IR miss0을 확인했다.
- 현재26 recipe 생성·strict·Simulation은 **181 IR·39 출력 byte 동일**, **fixture 신규0/기존26 qualification 보존**이다. graph14/기존closure6·제품605/state26/sample5/native cohort도 보존했다. 전체 W10은 PARTIAL이다.

## 8.118 객체 상수 패턴·typed wildcard 선언·초기화 순서 — 2026-10-18 KST

공통 변환 기록 (보관된 과거 기록 `w10-constant-pattern-source.json`)에 따라 analyzer가 실제 타입을 확인한 source 객체 상수 패턴을 추가했다. 비교 receiver는 원본 상수이며 기존 Core value equality를 사용한다. Dart 실험에서 확인한 대로 원본 access path와 canonical 객체 identity별 결과를 guard 이후에도 재사용한다. 별칭·직접 const 생성·인수가 달라도 같은 필드 상태인 생성식은 같은 cache를 사용하고, int/double 필드가 다른 상수는 구분한다. source 이름이나 JavaScript 모양으로 상수 identity를 추정하지 않는다. recipe의 canonical 생성 경계와 value semantics 등록은 명시적으로 검증한다.

- 원본 **24개/results25·거부11/frontend3**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. 비교 방향·비반사 equality·성공/실패 cache·guard mutation·getter/access path·logical and/or·nullable·같은 필드 상태의 canonical 생성·숫자 종류·operator 예외 전파를 확인했다.
- record 선언의 typed wildcard는 source 변수를 만들지 않는다. 공개 TypeSystem.isSubtypeOf가 보장하는 검사는 생략하고, 필요한 dynamic/generic/nested/named 필드 cast는 원래 순서대로 실행한다. int/double 실패·이후 문장 미실행·단일 selector 평가도 확인했다. 상수가 클래스를 선언 전에 참조하던 **TS2449 2건**을 재현해 정확한 class/static/constant dependency 순서로 수정했고, eager cycle은 lazy 경계 없이 거부한다. SDK collection/record/function 상수·or-join·runtime record-type witness는 남는다.
- 기존 record27/results30·대입23/results28·cached pattern23/results26은 Hermes3까지, numeric record25그룹·legacy fixture3도 Dart2/Core/Babel로 재검증했다. graph14/기존closure6·Dart analysis·tool typecheck가 통과했다.
- 재귀 원본 graph는 **IR1661·미지원48·위치5·SDK258/기타15**다. 이전 미지원 **4 whole body**(AccessibilityInspector, SystemTextScaler, RichText, TextPainter)가 표현됐고 새 owner record13개를 분석했다. cold 299.9초 → warm 38.8초, aggregate IR/frontier bytes 동일·parser0·IR miss0이다. represented fixed point 이후 숨은 의존성과 전체 hierarchy/App 통합은 남는다.
- 현재26 recipe 생성·strict·Simulation은 **181 IR·39 출력 byte 동일**, **fixture 신규0/기존26 qualification 보존**이다. 제품605/state26/sample5/native cohort를 보존했다. 전체 W10은 PARTIAL이며 physical IME/caret/FPS 등 미검증 경계도 유지한다.

## 8.119 const Set·generic 상수 타입·Core canonical 경계 — 2026-10-18 KST

const Set 변환 기록 (보관된 과거 기록 `w10-const-set-source.json`)에 따라 선택 원본을 막던 plain const Set을 frontend/IR/emitter와 실제 Core 저장소에 연결했다. 기존 DartSet의 불변성을 사용하고, 정확한 element type·삽입 순서·canonical 값 identity로 intern한다. 별칭과 반복 생성은 같은 객체이며 순서나 타입 인수가 다르면 다른 객체다. int/double 조회 동등성은 기존 숫자 provenance 경계를 따른다. 상수의 이름·객체 모양으로 타입이나 identity를 추정하지 않는다.

- 원본 **27개/results25·거부5/frontend3**이 Dart debug/assert2·strict/numeric d.ts·actual Core/RN Babel·supplier Hermes x64 O0/Og/x86 Og에서 일치했다. primitive/nullable/enum/default-object·Set/Map/object 중첩·typed lookup·불변 mutator·Set/Iterable 공변성·중첩 generic projection을 검증했다. double 원소는 Dart의 const_set_element_not_primitive_equality 진단을 확인했으며 Core에서도 거부한다. const spread/if/null-aware 원소는 별도 frontend 경계다.
- top-level generic 상수의 analyzer declared type을 IR에 보존해 Set<Tag> 같은 상수가 strict 생성 코드에서 정확한 타입을 갖게 했다. 실제 Core3개 파일에 canonical Set·private brand·정확한 기본 identity equality/hash를 추가했다. 기존 Set fixture2개도 같은 witness factory를 사용한다. null-aware fixture의 typed/guarded 패턴과 ordered fixture의 const Map은 현재 IR 지원과 별도 recipe 정책 요구를 구분하도록 보정했다. fake prototype·숫자 provenance 없는 값·custom equality·중복·잘못된 witness/policy는 거부한다. enum 상수 admission과 factory recipe는 명시적으로 연결하며 자동 제품 등록으로 확대하지 않는다.
- 기존 const Map26·generic const26·collection factory/null-aware/ordered/membership·객체 상수와 Core build/check를 재검증했다. 실제 Core가 바뀌어 **현재 recipe26 fixture를 모두 새로 실행**했다. **181 IR·39 생성 출력 동일**, 신규26/보존0이다. graph14/기존closure6·Dart analysis·tool typecheck도 통과했다.
- 재귀 원본 graph는 **IR1826·미지원45·위치6·SDK261/기타17**다. 이전 미지원 **4 whole body**(_kMobilePlatforms, _kTouchLikeDeviceTypes, EditableTextState, RawTooltipState)를 표현했고 새 record162개를 분석했다. 최신 seed 최초 분석(owner IR cache 재사용) 65.4초 → all-warm 40.6초, IR/frontier bytes 동일·parser0·IR miss0이다. 244 seed를 최신 compiler/cache로 재분석해 원본 source/span 일치와 generic 상수5개 metadata 갱신을 확인했다. 시작 시점이 겹친 이전 seed aggregate는 제외하고 최신 seed 결과만 판정에 쓴다. represented fixed point 이후 숨은 의존성과 전체 hierarchy/App 통합은 남는다.
- owning605 중 **Core3 변경/602 보존**, state26/sample5를 보존했다. 기존 native48/cold3 증거는 이전 archive 범위이며 **변경 Core의 새 archive/native 공급은 notVerified**다. 전체 W10은 PARTIAL이다.

## 8.120 사용자 요청 중간 마무리·TypeScript 기능 동등성으로 변경 — 2026-10-18 KST

사용자의 명시적 요청으로 남은 Dart를 무조건 컴파일하는 경로에서 **Nelyx TypeScript 자체 구현·기능 동등성 검증**으로 방향을 바꿨다. §0~7의 실행 절차·단계 종료 조건과 §9.2의 남은 작업을 함께 수정했다. 기존 source/compiler 성과와 cache·recipe·immutable receipt는 보존하며, 미지원45·위치6·NavigatorState binding은 선택 compiler backlog로 분리한다. 기존 BLOCKED receipt를 PASS로 바꾸거나 미구현 기능을 완료 처리하지 않았다.

중간 마무리 전 최신 verifier가 입력619·receipt12914·owning605/state26·sample5와 기존 checkpoint 연결을 PASS-scoped로 확인했다. §8.119의 full26 fixture fresh/IR181·출력39 검증 결과를 유지했다. 이번 요청에서는 제품·compiler·test 코드를 바꾸지 않았고 runtime 검증을 재실행하지 않았다. 문서·control·정책 연결과 코드/증거 보존은 별도 wrap verifier로 확인한다. 변경 전 문서·control은 immutable receipt-history에 보관했다.

**PAUSED / PARTIAL**, 새 작업 요청 전 장기 실행 없음. 다음은 실제 Nelyx 앱/라우팅·디자인 API 누락을 확인해 자체 구현하고 잔여 scroll·편집·복원·플랫폼/개발/공급 기능을 마무리한다. Core3 변경 후 최신 native parity·물리 IME/caret/FPS·Windows editor pixels·hardware GPU와 전체 W10 완료는 미검증/미완료로 남는다. 정책/재개 기록 (보관된 과거 기록 `w10-typescript-equivalence-handoff.json`)·현재 checkpoint (보관된 과거 기록 `w10-active-checkpoint.json`)를 따른다.

## 8.121 디자인 패키지 일괄 변환 경로 검토·계획 반영 — 2026-10-18 KST

사용자의 추가 요청으로 Cupertino/Material은 최대한 일괄 처리하며 일괄 변환 후 보정도 허용하도록 구체화했다. Flutter250 Dart 파일과 Doroti254 C# 파일, 현재 Nelyx41 TS 파일을 목록/hash로 확인하고 기존 Dart batch·Roslyn reader/lowerer·대표 app/button·project/runtime/asset/locale 경계를 검토했다. 두 경로 모두 현재 무제약 변환이 아니며 **Flutter 우선·제약 family의 Doroti 비교·필요한 자체 TS 보완**을 §0.2·§3~5·§9.2에 반영했다. Doroti 파일 수와 reviewed marker를 최신 Flutter 동등성이나 자동 변환 검증으로 계산하지 않았다.

시작 HEAD `49152f35c76c944387ff09a3ccb248692c1b020f`와 clean 작업 트리, 변경 전 입력620·receipt12921·checkpoint 연결의 hash 일치를 확인했다. 이전 구현·fresh26 fixture·native notVerified 범위와 모든 제품/변환기/test 코드, Doroti 원본은 보존했다. 이번에는 계획·검토 기록·progress/handoff/checkpoint만 수정했고 실제 변환·build/runtime 검증·승격을 실행하지 않았다. 상태는 **PAUSED / PARTIAL**이며 이전 구현 목표를 재개하지 않았다. 검토 근거/계획 (보관된 과거 기록 `w10-design-package-source-review.json`)과 현재 checkpoint를 재개 기준으로 연결했다.

## 9. 전체 실행 체크리스트

계획 작성은 구현 완료 체크에 포함하지 않는다. **세부 묶음 완료와 단계 전체 완료를 분리**한다. §9.1의 체크는 적힌 범위의 구현·검증 완료이며, 이를 합산한 비율로 W10 전체 완료율을 계산하지 않는다. §9.1은 당시 검증 범위의 이력이며, 그 안의 source/compiler 다음 작업은 현재 지시가 아니다. §9.2는 §0~7의 자체 TypeScript 기능 동등성 기준으로 남은 단계를 판단한다.

### 9.1 검증을 마친 세부 묶음

- [x] **W10-01 / 언어 규칙:** callback/cascade·상태/상속·checked integer에 async/iteration·exact generic adapter·mixin host 계약·static const/local function을 추가하고 독립 Dart 비교·거부 조건 검증(§8.2~8.3).
- [x] **W10-01 / 첫 파트 전체 추출:** pinned wheel/viewport 19개 모두 IR 추출, frontend blocked 0. 후단 생성·연결은 별도 미완료(§8.3).
- [x] **W10-01·02 / source controller·physics 통합:** 전체 controller·physics와 private helper를 실제 공개 facade가 소비. strict types·원본 비교·제품 gate·재생성/사용자 수정/충돌 보존·필수 source gate 검증(§8.1·8.3).
- [x] **W10-02 / 현재 기능·브라우저:** Core50·Chromium4에서 wheel/tree/2D/viewer·custom scrollbar와 editor full/clip bounds·2x/0.5x typography·identity/Unicode 흐름 검증(§8.3).
- [x] **W10-02·07 / 실제 공급·독립 소비:** 최종 Core/SDK archive와 source/JS 일치, 외부 NodeNext/ESM 4조합, 현재 Windows/Android 복사 artifact·설치 hash 및 advanced 흐름 검증(§8.7). 여섯 target 구조 전체 완료는 아님.
- [x] **W10-02·05 / advanced cold restore·종료:** 현재 EXE/APK의 별도 프로세스에서 item/offset/Unicode 복원, active motion settle·binding/disposal 균형·Windows exit0/Android Activity 종료 검증(§8.3). 전체 route/OS link/locale 범위는 남음.
- [x] **W10-02·04 / Android 편집 transform:** 실제 EditText OS tap·focus·Unicode·2x/0.5x bounds 검증(§8.3). 물리 IME/caret pixels·Windows native 편집기 측정은 남음.
- [x] **공유 초기화·재현 정리:** source controller 생성 observer의 초기화 전 값 노출 수정·검증, sample/runner 원복·소유 프로세스 정리·현재 hash/receipt/handoff 갱신(§8.3).
- [x] **W10-01 / 함수 참조·covariant:** non-generic method의 수신자·method identity, 여러 모듈의 listener 해제, virtual/super·nullable 평가·함수 비교와 monomorphic covariant 거부 조건을 원본 실행과 비교(§8.4). generic/unbound callback은 남음.
- [x] **W10-01·02 / source child builder 통합:** abstract/builder delegate 전체를 제품 wheel에서 소비. 원본 비교·제품8·11 recipe 회귀·필수 source gate, wheel10의 keyed State·단일 semantic index, browser4·동일 archive consumer4·현재 복사 Windows/Android 공급/복원/종료 검증(§8.4). list/looping 후속 완료는 §8.5, 전체 widget/renderer는 남음.

- [x] **W10-01 / collection·modulo 경계:** resolved index/getter와 목록 참조 비교, 범위 검사·평가 순서·음수 Euclidean modulo·0/극값 오류를 Dart debug/release와 비교. strict types·미지원 쓰기 거부·11 recipe 회귀 및 source gate 검증(§8.5).
- [x] **W10-01·02 / source list·looping 통합:** 네 delegate 전체 본문·제품14, 공개 유한 `useDelegate`, 목록 State 보존·반복 slot key·source 선택 번호를 실제 wheel13/browser4/동일 archive consumer4·현재 복사 Windows/Android19 이벤트에서 검증. cold restore·close·Android editor geometry와 입력/공급 hash 갱신(§8.5). 전체 source viewport는 남음.

- [x] **W10-01 / mutable 초기화·public interface:** 선언부 초기값의 side effect→formal/initializer→super 순서를 Dart 양 mode로 비교. explicit/final 중복 거부, host private storage와 source public implements 분리·strict typing, state12·recipe12 회귀 검증(§8.6).
- [x] **W10-01·02 / source metrics·position 통합:** 전체 두 본문·제품12·원본 비교·source gate/재생성 보존, 실제 notifications/snapshot·physics 교체 absorption·context identity를 wheel14에서 검증. browser4·동일 archive consumer4·현재 Windows/Android source metrics19 이벤트와 복원/종료·Android editor geometry 검증(§8.6).

- [x] **W10-01 / renderer 언어·host 규칙:** exact generic construction·private named formal·host subclass/base·nullable storage/value operator 경계를 Dart 양 mode로 검증. static 상수 보호는 실제 RN Babel 변환·실행으로 확인(§8.7).
- [x] **W10-01·02 / 전체 source renderer 공개 API:** 3개 전체 본문·제품7·원본3시나리오×2frame×2mode·13 recipe/재생성 보존, 실제 Root5/Chromium5/consumer4·현재 복사 Windows/Android21 이벤트 검증(§8.7). 기본 wheel Widget/Element 최종 통합은 별도 미완료.
- [x] **W10-02·03 / 공유 paint/layer 수정:** getter Rect 좌표 복사와 임시 layer context 소유권, rollback/오류/cache/closed 진입5·기존 Root54·magnifier pixel6/lifetime5 및 현재 공급 검증(§8.7).

- [x] **W10-01 / 독립 named 초기화:** 원본별 base 인수·선언/필드/assert 순서·정확한 prototype·불변성, Dart 양 mode·strict types·RN Babel·pinned Windows Hermes 실행 검증. 기존 단순 경로의 동등성과 초기화 격리도 확인(§8.8).
- [x] **W10-01 / indexed setter·nullable·Map 경계:** RHS 반환·단일 평가, nullable checked cast/test·exact specialization, safe-int Map cache/정렬/변경 오류와 거부 조건을 Dart 양 mode로 비교. Map의 실제 source wheel 연결·수명·공급 검증은 §8.9에서 후속 완료.

- [x] **W10-01·02 / 전체 source Widget/Element API:** 나머지6개 전체 본문·실제 Core host 연결, strict/Dart 양 mode·Root12·14 recipe·재생성/수정/충돌/source gate 검증. 공개 API 경로에서 19개 모두 소비(§8.9). 유한 facade 최종 통합은 별도 미완료.
- [x] **W10-02·07 / full Widget 현재 공급:** Chromium6·동일 archive consumer4·현재 source/JS48파일, 복사 Windows/Android 각각24이벤트·backup controller/effect/motion 종료·기존 cold restore/editor 검증, sample/runner 원복·소유 프로세스 정리(§8.9).
- [x] **W10-02·03 / queued Element·scroll 수명:** GlobalKey active/inactive retake·source rebuild veto/cache·지연 slot/offset·layer/자식 종료, 동기 callback Root 종료 후 scroll 후처리 차단과 공유43건 회귀 검증(§8.9).

- [x] **W10-01·02 / 기본 wheel 최종 source 통합:** 19개 전체 본문을 기본 유한 API에서 소비, 수동 sliver/projection 제거. 명시적 facade key remap·display-only input/overlay·밀도·callback/restore를 Root17로 검증하고 실제 source API/renderer gate 유지(§8.10).
- [x] **W10-02·07 / 기본 facade 현재 공급:** Chromium6·동일 archive consumer4·source/JS48파일·복사 Windows/Android 각각25이벤트로 source renderer/keyed slot·advanced restore/close 확인, 원복·프로세스 정리(§8.10).

- [x] **W10-02 / 2D 전체 선택·장애 분류:** 5파일21개 source closure를 보존하고 초기10→15 IR 당시6개 첫 장애와 전체 후속 경계를 기록. 최신21/0은 §8.12. 2D 제품 통합 완료를 뜻하지 않음(§8.11).
- [x] **W10-01·02 / switch·문자열·equality 공통 규칙:** 선택 평가·순서·nullable/virtual/super·scalar RHS 의미를 Dart 양 mode·strict·RN Babel로 비교하고 거부 조건 확인. 14 recipe·15개 기존 출력 byte 동일과 현재 archive 재사용 경계 검증(§8.11).

- [x] **W10-02 / 전체2D IR 추출:** 같은5파일21개 선언 전부 추출·frontend 장애0. generated 제품 소비0과 실제 연결 경계를 유지(§8.12).
- [x] **W10-02 / ordered Map·Set:** exact factory·custom equality/hash·평가/삽입 순서·null cache·mutation/live/lazy iterator와21 case Dart/strict/RN Babel 비교(§8.12). 실제 ChildVicinity/Key 정책 연결은 남음.
- [x] **W10-02 / null-chain·예외·late:** chain 단일 평가/후속 생략, catch/rethrow/finally, late storage/독립 named construction을 원본 양mode·strict·RN Babel 검증(§8.12). stack/host 경계 명시.
- [x] **W10-02 / positional record·타입 키:** 생성/구조 분해·상수/wildcard 분기·break/continue·scalar logical-or, actual class token과 canonical immutable empty Map/Set을 검증(§8.12). 미지원 generic/named/const/value-equality 범위 유지.
- [x] **W10-02 / 기존 소비 경로 회귀:** compiler/analyzer·Core build·fresh14 recipe, 기존15 output byte와 archive48파일 일치 확인. 새 미소비 런타임의 제품/native 승인과 구분(§8.12).

- [x] **W10-02 / ChildVicinity·delegate 전체 후보7:** 원본7개 전체 본문·exact Core binding·재생성 동일성·strict·Dart 양mode/RN Babel 검증. 전체21선택 유지, 기본grid 통합은 남음(§8.13).
- [x] **W10-02 / const·base 초기화 경계:** exact immutable canonical factory·class identity·final 보호·일반 생성 분리, 명시적 dead branch와 live receiver 노출 거부 검증(§8.13).
- [x] **W10-02 / generated selection 실제 Core host6:** 실제 sliver에서 화면 밖 유지·selection-clear 해제·registrar 이전·State 보존·listener/scroll 종료 검증. 전체2D/native 승인과 구분(§8.13).

- [x] **W10-02 / viewport 전체5개 생성·strict 후보:** Widget/Element/ParentData/renderer/manager 전체 본문, actual Core·Map·queued-child host와 deterministic strict 생성 검증. 전체 원본 비교·예외/keepalive/reveal 승인은 남음(§8.14).
- [x] **W10-02 / source-flow·host const·membership:** nullable/default/final/promotion/enum coverage·단일 interpolation·실제 owner canonicalization·contains 변경 경계를 Dart 양mode/RN Babel로 검증(§8.14).
- [x] **W10-02 / generated viewport 실제 Root6:** bounded24·key State 이동·원거리 양축 직접 이동·reverse/traversal·실제 pointer hit·종료 검증. 통제된 offset 시험 범위이며 기본grid/native 완료는 아님(§8.14).

- [x] **W10-02 / viewport 전체 원본5 비교:** ChildVicinity를 포함한 unchanged Dart·생성TS·RN Babel을 양mode·4시나리오10frame으로 비교. 원본 retained-hit 차이와 통제 receiver 경계 기록(§8.15).
- [x] **W10-02 / viewport 실제 수명·reveal22:** 보관 셀 hit 차단·cached key 재활성·keepalive 해제·실패 local window 정리/재시도·닫힌 참조 정리·subrect/좌표 전달·offset 완료 후 동기 종료 검증(§8.15). listener 내부 종료·최종 Scrollable 연결은 남음.

- [x] **W10-02 / ScrollableDetails 전체 후보:** 생성·strict·8경우 원본 양mode/RN Babel 비교, copy/equality/hash 관계·diagnostic 순서·final 보호 및 인수 없는 canonical 기본값 확인(§8.16). 기존 공개 클래스/ScrollView 연결은 남음.
- [x] **W10-02 / exact 문자열 연결·회귀:** resolved String +의 명시 adapter와 거부 조건, compiler/Core·fresh14 recipe·기존15 출력 및 후보13 재생성·archive48 일치 검증(§8.16).

- [x] **W10-02 / 전체2D21 생성·Core 연결:** 남은8개 whole body·strict·원본/span identity, 실제 두 축 Scrollable gesture/chrome/ensureVisible hook과 owned recognizer 연결(§8.17). 전체 Dart oracle8 및 기본 facade 소비는 남음.
- [x] **W10-02 / 전체 closure 실제 Root·RN Babel28:** 독립 축/controller/primary·direct seek/reverse·wheel·4 drag 모드·reveal·canonical defaults·두 View focus·중첩 종료를 같은28건으로 검증(§8.17). copied native 승인과 구분.
- [x] **W10-02 / 빈 switch·동기 notifier 종료:** source-flow 독립 비교, 즉시 owner 폐기/알림 drain 후 저장소 해제, 기존 wheel34·공유43 등 회귀 검증(§8.17).
- [x] **W10-02·07 / 현재 공유 host 공급 갱신:** 바뀐 Scrollable/ScrollPosition과 기본 source2D를 Chromium6·동일 archive consumer4·source/JS90파일·복사 Windows/Android 각25이벤트로 검증하고 정리. 물리 IME/FPS와 W10-07 전체는 별도(§8.20).

- [x] **W10-02 / 전체2D21 원본 비교:** 마지막8개를 unchanged Dart·생성TS·RN Babel 양mode에서 비교. 각 mode의 축8·View8 시나리오와 controlled receiver 경계를 기록(§8.18).
- [x] **W10-02 / 첫 축 reveal 중 Root 종료:** request-local position/Element 보존·닫힌 다음 축/ancestor 탐색 차단을 재현 후 수정, 실제 Root/RN Babel 각각30건과 원본 비교 재검증(§8.18).

- [x] **W10-02 / selection 실패 local 복구:** 원본 본문 보존, listener/registrar 등록·해제/이전/dispose 실패와 reentrant close·정확한 retry를 Core30/RN Babel30으로 검증. 외부 parent 해제 미확인은 별도 보고(§8.19).
- [x] **W10-02 / 전체2D selection keepalive:** 실제 generated grid에서 화면 밖 유지와 selection-clear 후 State/listener/parent 해제를 포함한 Core32건 검증(§8.19).
- [x] **W10-02 / 확장 전체2D RN Babel32:** 재개 후 현재 전체closure32를 실행·통과. 선택 복구 Babel30과 구분(§8.20).
- [x] **W10-02 / 전체2D 정식 batch 보존:** 21개/6파일 fresh 생성·strict·effective Core/source gate·전체 재생성·fixture/source drift·주석/충돌/필수 source 차단6건 검증(§8.20).
- [x] **W10-02 / 기본 finite grid source 연결:** 수동 viewport/pan 제거, source closure의 model/key/vector input/legacy restore 경계와 Core18·RN Babel18·Chromium6 검증. 같은 archive native 공급은 위 공유 host 항목에서 별도 확인(§8.20).

- [x] **W10-02 / tree 전체 선택·초회 장애 분류:** 2파일11개 class/mixin/helper와 타입 별칭6개 의존성, IR5·첫 장애6 및 기존 host/facade 경계 기록. tree 제품 소비0(§8.21).

- [x] **W10-02 / tree named record 규칙:** named/mixed·nullable/nested·평가/예외 순서·identity/shape·class generic 타입을 Dart 양mode·strict·RN Babel 검증. const/패턴/구조 동등성 경계 유지(§8.22).
- [x] **W10-02 / tree mixin·static·private construction:** abstract 계약 타입 출력, class owner lazy static, private named-only/const canonical entry와 거부 조건을 독립 원본 비교 및 RN Babel 해당 경로로 검증(§8.22).
- [x] **W10-02 / tree 전체12 IR·기존 경로 회귀:** private 상수까지 포함한12 추출·frontend0, fresh15 recipe·21출력 byte 동일·기존 소비 archive90파일 일치. tree full-library 후단/제품 연결은 미완료(§8.22).

- [x] **W10-02 / generic record collection 경계:** 두 class의 exact parameter ID·typed factory·명시 string conversion·거부 조건을 Dart 양mode/strict/RN Babel 검증(§8.23).
- [x] **W10-02 / indexed null assignment·lexical scope:** analyzer read/write 분리·평가/예외 순서12건, 본문 formal shadow와 library-private override 판정 및 기존 출력 회귀 검증(§8.23).
- [x] **W10-02 / tree renderer 전체3 후보·원본 비교:** full emission·actual Core strict·Dart24frame 비교 통과. 실제 Core/Babel animation 인덱스 FAIL을 별도 기록, 제품 승격/공개 facade 연결은 미완료(§8.23).

- [x] **W10-02 / tree renderer 실제 계약 보정:** 원본 전체3 유지, index·clip 좌표/소유 범위·hit 차이를 명시하고 actual Core/RN Babel26·raw Dart24frame·strict 검증. 공개 tree 통합/제품 승격은 남음(§8.24).
- [x] **W10-01·02 / nested nullable method specialization:** exact closed type ID 비교·독립 원본/strict/RN Babel·잘못된 specialization 거부, tree ancestor lookup 경계 및 기존15 recipe/21출력 회귀 검증(§8.24).

- [x] **W10-01·02 / generic State·mixin host 계약:** exact application·Object? bound·resolved override origin·checked String-ID covariance를 독립 Dart/strict/RN Babel 및 거부 조건으로 검증(§8.25).
- [x] **W10-02 / tree 전체12 생성·원본 비교:** Widget9 전체 본문/alias의 Dart 양mode11-state 비교, renderer3/24frame과 full strict를 확보. raw nested collapseAll 실패는 그대로 보존(§8.25).
- [x] **W10-02 / tree 후보 실제 Root/Core16·RN Babel16:** default arrow 실제 pointer, controller/State·callback 종료·animation disable/prune/bulk 수명 보정 검증. 행 key·공개 facade·정식 batch/공급은 남음(§8.25).

- [x] **W10-02 / tree 기본 immutable-ID facade:** 전체12 source State/renderer 소비·수동 flatten 제거, row key/동기 index·복원/reveal·RTL/소수 extent·empty/종료를 Core16·RN Babel16·compiled14로 검증(§8.26).
- [x] **W10-02 / tree 정식 batch 보존:** actual effective 계약·전체 raw Dart 비교·consumer 의존성·동일 파일명 patch 분리와 보존/거부9건, fresh16 recipe/23출력·기존21 fresh byte 동일·tree2 제품 일치 확인(§8.26).
- [x] **W10-02 / tree 현재 브라우저·고정 seek:** Chromium6의 source tree editor identity/focus/composition과 1만 자식 seek38query/23children 검증. 현재 native/물리 IME/FPS 및 전체 animation 승인은 별도(§8.26).

- [x] **W10-02·07 / tree 현재 공급:** 동일 archive 외부 소비4·source/JS116 및 양 target tree26파일 일치, 복사 Windows/Android 각25이벤트·source tree index/편집기 유지·기존 cold wheel 복원/종료·원복/정리 확인. full nested animation·tree native cold restoration·물리 IME/FPS는 별도(§8.27).

- [x] **W10-02 / tree 중첩 animation 보정:** 원본12 보존, 전체 활성 후손 range·cache prefix 이동 합성·조상 clip/hit를 Core26/RN Babel26 및 원본 비교로 검증. 정식 effective gate와 현 공급까지 갱신했으며 native nested timing/임의 curve/물리 FPS는 별도(§8.28).

- [x] **W10-02 / Viewer 전체 선택·장애 분류:** source14+alias1 및 external Quad/Triangle2 전체 선택, pin/hash와 경계 기록. IR12/14·enum2/외부 추출 잔여이며 생성·제품 통합은 미완료(§8.29).
- [x] **W10-02 / Viewer 공통 언어 장애:** lazy instance/local late와 scalar OR switch 문장 지원, 독립 Dart/strict/RN Babel26 및 기존 source-flow/expression/late 회귀 PASS. 새16 recipe strict·원본/제품 gate 및 생성23 byte 보존 확인(§8.29).

- [x] **W10-02 / Viewer enum 및 외부 전체 IR:** 단순 enum 의미·numeric provenance를 Dart/strict/RN Babel10으로, 잠금 package/소속 part 추출을9건으로 검증. Viewer14+Quad/Triangle2 전체16 IR·frontend0. 실제 생성·Core binding·batch·제품 통합은 계속 미완료(§8.30).

- [x] **W10-02 / Viewer 전체 생성·strict 후보:** source14+외부2 전체16 생성/strict, nested exact constructor·nullable function call·value unary 규칙과 회귀 검증. 원본 math2의 Dart/Core/Babel19 및 실제 Viewer Core/Babel 각각6건 PASS. 전체 source State 비교·공개 facade·batch·공급은 미완료(§8.31).

- [x] **W10-02 / Viewer 전체 원본·입력 비교:** unchanged Viewer14+alias1의 Dart 양mode와 실제 Core/source Babel28 전환 비교, 기존 math2 source19로 전체16 closure 근거 확보. 실제 recognizer pan/pinch/inertia 포함 Root10/Babel10 PASS. 공개 facade·external batch·현재 공급은 미완료(§8.32).

- [x] **W10-02 / Viewer 정식 source batch:** 외부 package/reference fingerprint·실제 part identity·effective 비재생성 gate, fingerprint11/lifecycle12, Core build·numeric d.ts18·fresh17 recipe 통과. source16/generated3 내부 승격 및 adapter2 정리. 공개 facade 소비·새 공급은 미완료(§8.33).

- [x] **W10-02 / Viewer 기본 source 소비:** 공개 facade를 전체 generated State에 연결, 수기 gesture/fling 제거. 복사/알림·finite/resize·복원·취소/소유자 계약 및 source 관성·signal ownership, Core/Babel16·공개12·Chromium6·필수 effective gate PASS(§8.34). 새 package/native 공급은 미완료.

- [x] **W10-02 / Viewer 현재 공급:** 동일 archive 외부 소비4·source/JS132·설치 Viewer40, 복사 Windows/Android 각각27이벤트에서 generated State·실제 Core 입력·source 관성/취소·editor·종료 PASS-scoped. JBR25 Android 재시도·원복5·소유 프로세스 정리 완료. 물리/native cold의 별도 경계 유지(§8.35).

- [x] **W10-02 / tree·Viewer native cold:** 동일 archive의 새 cold probe, Windows/Android 각각3프로세스·7흐름. 기본 컨트롤러에서 위젯 소유 확장2단계/offset6080·XY0.75 matrix/geometry/text 복원, 실제 Android Unicode, source 관성 중 close/retirement PASS-scoped. 명시적 flush 뒤 재시작 범위(§8.36).

- [x] **W10-02 / scrollbar 전체 IR:** widgets15·Material10/theme3·Cupertino10의 전체38 IR·frontend0. implicit Object mixin의 exact host admission/Dart/strict/Babel10, 기존 mixin·analyzer·fresh17/출력26 byte 동일·public baseline5 PASS. 연결/소비0·제품 승인 미완료(§8.37).

- [x] **W10-02 / ScrollbarPainter 전체 후보 검증:** 원본 class/enum/constants7 결정적 생성·strict0, 실제 Core/RN Babel16·독립 Dart 양mode20, host property Dart/Babel8·기존 callback/generic·fresh17/출력26 보존·Core build PASS. 전체38 통합·public 소비0·native 미검증(§8.38).

- [x] **W10-02 / scrollbar source 입력 후보:** Painter/helper/recognizer13 strict0, 실제 Core Root14·RN Babel14·독립 Dart 양mode12, 명시 nominal runtime8·fresh17/출력26 보존·Core build PASS. WidgetState closure13은 IR10/frontend3으로 분류했고 full State/style·public 소비는 미완료(§8.39).

- [x] **W10-02 / generic method·factory와 상태 의존성 IR:** analyzer identity/추론 타입 인자·required redirect·generic factory, Dart/strict/d.ts/Babel11·named/State 회귀·Windows Hermes·fresh17 PASS. WidgetStateProperty 전체 IR 확보로13개 중11개 추출·frontend2; 실제 전체 상태/스타일 연결은 미완료(§8.40).

- [x] **W10-02 / 상태 의존성 전체 IR:** 원본 stateless mixin 연산자·enhanced enum body/static const·초기화 순서, Dart/strict/d.ts/Babel12·기존 mixin/enum·fresh17 PASS. WidgetState13 전체 IR/frontend0 및 실제 전체 module probe 완료. Core 경계·전체 State/style·public 소비는 미완료(§8.41).

- [x] **W10-02 / WidgetState constraint·controller Core 후보:** 전체 source8 strict/d.ts, constraint 원본/Core/Babel20·controller 잠금 listen/Core/Babel8, 명시 token/equality/hash/collection/const·소유권, fresh17/출력26 보존·Core build PASS. generic property5 및 full13/public/native 통합은 미완료(§8.42).

- [x] **W10-02 / generic 메서드 runtime type witness:** exact analyzer 인자·scope, checked is/as/nullability·closure·명명 순서·host application을 독립 Dart/strict/d.ts/RN Babel31 및15 거부 조건으로 검증. fresh17/출력26·WidgetState8 후보 회귀 PASS. class/factory reification·numeric value provenance·property5 통합은 미완료(§8.43).

- [x] **W10-02 / generic class·factory runtime type:** actual Core owner capture·source 상속/interface projection·factory forwarding·promoted bound를 독립 Dart/Core/strict/d.ts/RN Babel39 및12 거부 조건으로 검증. fresh17/출력26·WidgetState8 후보 회귀·Core build PASS. property5 value/diagnostic/const와 full13/public 통합은 미완료(§8.44).

- [x] **W10-02 / Object value·runtimeType 및 상태 후보:** 명시 Core 등록·원본 equals/hash dispatch·captured generic runtimeType, generic local/nullable call을 Dart/Core/strict/d.ts/RN Babel40으로 검증. 상태8을 새 경계로 재검증20·8, fresh17/출력26·Core build PASS. full13은 Diagnosticable/value/const 잔여로 PARTIAL(§8.45).

- [x] **W10-02 / generic host 생성자·Diagnosticable·Map hash:** exact constructor17·거부8, actual Core DiagnosticsProperty/Diagnosticable·native Dart Map/Set/error11 group, strict/d.ts/RN Babel·fresh17/출력26·Core build PASS. Mapper nested property/Map 문자열·numeric/const와 full13/public은 미완료(§8.46).

- [x] **W10-02 / Map 문자열·Symbol·nested diagnostics:** native Dart/Core/strict/d.ts/RN Babel12묶음·constructor18/거부11, 원본 interface override 보정·fresh17/출력26·Core build PASS. full13은 numeric/const 잔여로 PARTIAL이며 공통 Map source/JS2 변경의 현재 native 공급은 notVerified(§8.47).

- [x] **W10-02 / 명시 numeric value·전체13 Core 통합:** numeric28 native Dart/strict/d.ts/RN Babel, full13 생성·strict/d.ts/Core8묶음·fresh17/출력26 보존 PASS. full13 원본 비교·numeric 자동 lowering·generic const·제품 소비 및 현재 native 공급은 미완료(§8.48).

- [x] **W10-02 / 전체 WidgetState13 원본 비교:** 전체 선언·원본 foundation closure를 native Dart 양mode20묶음과 실제 Core/빌드 Core RN Babel로 비교 PASS. 기존17/출력26/current531 근거 hash 유효. numeric 자동 lowering·generic const·정식 batch/제품/native 공급은 미완료(§8.49).

- [x] **W10-02 / scalar↔erased 숫자 자동 전달:** analyzer storage identity·지역/필드/인자/반환/closure/collection31결과·거부6, strict/d.ts/compiled-Core RN Babel·전체13 원본20·fresh17/출력26 PASS. numeric generic/추가 전달·const·batch/public/native 공급은 미완료(§8.50).

- [x] **W10-02 / numeric generic·실제 원본 호출:** generic32/거부6, 원본 WidgetState caller10개11결과·양mode/strict/d.ts/compiled-Core RN Babel·전체13 원본20·fresh17/출력26 PASS. generic const·일반 함수/host ABI·batch/public/native 공급은 미완료(§8.51).

- [x] **W10-02 / 직접 generic const·PropertyAll 원본 호출:** const22/거부7, 실제 caller19개20결과·양mode/strict/d.ts/compiled-Core RN Babel·전체13 원본20·fresh17/출력26 PASS. NaN identity·const Map/외부 값·함수/host ABI·batch/public/native 공급은 미완료(§8.52).

- [x] **W10-02 / 숫자 함수값·원본 lerpDouble 정식 생성:** 함수28/거부5, 실제 WidgetState caller25개25결과, 원본 lerpDouble24/양mode/compiled-Core RN Babel·18 recipe gate 및 최종 출력27 동일성 확인 PASS. 기존26/17 batch 보존. const 값 영역·full13 batch/전체 State/style/public/native 공급은 미완료(§8.53).

- [x] **W10-02 / const Map·Mapper 및 모듈 간 const 공유:** Map26/거부4, 실제 원본 caller16개15결과·객체 공유·거부6, 전체13/기존 회귀·fresh18/출력27 보존 PASS. full13 정식 batch/전체 State/style/public/native 공급은 미완료(§8.54).

- [x] **W10-02 / WidgetState 전체13 정식 source 배치:** 19번째 recipe/출력28 내부 승격, 실제 effective Core8·원본20·숫자25·const15·lifecycle9·fresh19 PASS. 기존27 출력/18 batch 보존. RawScrollbar/State/style 기본 소비·현재 native 공급은 미완료(§8.55).

- [x] **W10-02 / 전체 RawScrollbar/State15 Core 후보:** 결정적 생성·strict0·실제 Root18/RN Babel18, 공변/getter Dart15·거부5·기존19 gate/출력28 보존 PASS. 전체 State 원본 비교·style23/public/native 공급은 미완료(§8.56).

- [x] **W10-02 / 전체 RawScrollbar/State15 독립 원본 비교:** 원본 전체15/WidgetState13/foundation closure, debug/release 각각72기록·실제 Core 및 생성 RN Babel 일치. 입력 거부·metrics 축소·여섯 포인터·stale 커서·assertion/축/depth 검증. style23·정식 raw batch/public/native 공급은 미완료(§8.57).

- [x] **W10-02 / 외부 generic 부모 타입 전달:** 별도 producer/consumer Dart28·거부7·strict/d.ts·compiled-Core RN Babel, class39/covariance15/numeric32·fresh19/출력28 보존 PASS. 실제 style23와 추가4 closure(IR3/blocked1)는 미완료(§8.58).

- [x] **W10-02 / positional record switch 표현식:** 원본14묶음·거부6/6·strict/d.ts·compiled-Core RN Babel·기존 record 회귀 PASS. 현재 frontend51 IR 동일·fresh19/출력28 보존. 동적 색상은 다음 generative redirect 장애로 이동, style/public/native는 미완료(§8.59).

- [x] **W10-02 / 일반 generative constructor redirect:** 원본12묶음·거부9·strict/d.ts·compiled-Core RN Babel·기존 named/field 회귀 PASS. 전체 Cupertino 의존성4 IR·세 redirect/5단계 계획 및 fresh19/출력28 보존. redirected const·전체 색상/style/public/native는 미완료(§8.60).

- [x] **W10-02 / generative const field identity·모듈 공유:** 원본26결과·거부12·strict/d.ts·compiled-Core RN Babel, static self/실제 stateless host/optional·named 외부 factory PASS. 기존 회귀·fresh19/출력28 보존. Color 값 영역과 전체 style5 검증은 §8.62~64에 기록. style23/public/native는 미완료.

- [x] **W10-02 / Color 상수 값 영역:** 네 생성 경로·중첩 const·float/색 공간/동등성 보존, 전체 원본29기록·거부6·strict/d.ts·compiled-Core RN Babel PASS. 후속 전체 dynamic-color/interface5 검증은 §8.64에서 완료. style23/public/native는 미완료.

- [x] **W10-02 / 전체 style5 생성 후보:** ColorProperty 전체 의존성 포함 추출5·생성5, 상속 상수 기본값7·record14 및 numeric ABI9 검증. 후속 host/strict·전체 동작 검증은 §8.64에서 완료. style23/public/native는 미완료.

- [x] **W10-02 / 전체 style5 host·동작:** strict0/d.ts·원본24 양mode·Core Root/source Babel·의존성12·JSON 경계8·const factory4 PASS. 기존19/생성28 보존. style23/public/native·OS 밝기 producer는 미완료(§8.64).

- [x] **W10-02 / 숫자 레코드·모듈 간 generic 호출:** 원본25/거부4·정적 호출/nullable callback18/거부9·super7/거부2·strict/d.ts/Babel, 전체 Material10 생성, 기존19/28/535 보존 PASS. whole23 strict/동작·제품 소비는 미완료(§8.65).

- [x] **W10-02 / 전체 themed23 생성·Cupertino Root:** 전체43 선언 생성, Cupertino10 독립 strict/d.ts·Core Root14/source Babel14, 진단 원본13 양mode·Raw18/72/style24 PASS. Material host/전체23 원본·제품/native는 미완료(§8.66).

- [x] **W10-02 / 전체43 strict·실제 Material 테마:** d.ts/strict0·Material Core Root20/Babel20·Cupertino14씩, nullable const34/26·Color33·진단15·fresh19 PASS. 전체23 원본·제품/default/public/native는 미완료(§8.67).

- [x] **W10-02 / 전체 원본109·Radius const:** 원본43+의존13, Core Root/source Babel 양mode109·Radius20/거부9·최종19 gate PASS. 별도 Raw↔style Color identity2 FAIL이며 제품/default/public/native 승격은 미완료(§8.68).

- [x] **W10-02 / 공통 Color const identity:** Raw 전용 캐시/중복 host 제거, 원본/Core/RN Babel9·Color33/거부6/compiled-Core 검증. 이전 FAIL2 해소(§8.70).

- [x] **W10-02 / Raw 전체15 정식 배치·보존:** 20번째 recipe, 실제 effective Root18/Babel18·원본72 양mode·보존/거부6·소비자 fingerprint2, 기존19 state/28 출력 보존·fresh20/출력29 PASS(§8.70).

- [x] **W10-02 / Raw 공개 기본 source 소비:** 수기 fade/drag/paint 제거, ARGB/radius·controller owner·key/State·즉시 thumb·optional inherited 기본값 유지. Core/Babel5·빌드5·Chromium6 PASS(§8.70).

- [x] **W10-02·07 / Raw 현재 공급:** 같은 archive 외부4·source/JS34 양 target 일치, Windows/Android 각각29 이벤트·source 양축 drag/활성 제거·종료, 현재 tree/Viewer cold 각각3프로세스/7흐름·원복/정리 PASS-scoped. styled28·물리 입력/FPS는 별도(§8.71~72).

- [x] **W10-02 / Core ColorProperty1 정식 배치:** Core-only Map/JSON·actual effective 양mode/Core/Babel7·복구/거부6, import emission8/거부3·fresh21/출력30·기존20 state/29 출력 보존·Core build PASS(§8.73).

- [x] **W10-02 / styled28 package owner 후보:** Core1/Cupertino14/Material13 분리·명시 export24·경계 거부2·독립 strict/declaration build3, 전체43 원본109·style24·Root14/20 양경로·compiled Node5 PASS. design27 정식 batch/public/default/native는 미완료(§8.74).

- [x] **W10-02 / Cupertino14·Material13 정식 source 배치:** owner22/23·actual effective 보존·최종 companion0·원본109/style24·Root14/20·compiled8, 수정/거부/공개 대체/충돌9씩·fresh23/출력35 PASS(§8.75).

- [x] **W10-02 / whole43 공개 source/실제 Theme:** package host6 이전·staged 삭제, 공개 class identity·WidgetState/명시 double carrier·실제 ThemeData defaults/precedence, Core/design build·Chromium8 PASS. app 자동 behavior/current native는 별도(§8.75~77).

- [x] **W10-03 / optional haptic host 경계:** pinned Windows/optional channel 계약·실제 SDK/Core5·native feedback 회귀·SDK build PASS. 기기 haptic과 현재 archive/native runtime은 별도(§8.76~77).

- [x] **W10-02 / whole43 현재 native 공급:** 같은 archive 외부4·Core112/design80 설치 bytes·Windows/Android33·각 cold3프로세스/7이벤트·공개 styled 양축/pressed16·owning haptic 응답·retirement·원복/소유 도구 정리 PASS-scoped. 물리 IME/caret/FPS와 app 자동 behavior는 별도(§8.78).

- [x] **W10-01 / namespace 값·Null·구체 constructor witness:** analyzer runtime binding·정확한 Null 반환·구체 witness 경로, 원본7/18결과·거부5/16·strict/d.ts·Core/RN Babel·최종 reemit35/state23 보존 PASS(§8.79).

- [x] **W10-02 / behavior/stretch 전체10 후보 검증:** whole body/private closure4모듈·3 owner strict/build·원본30/양mode/Core/Babel·Root9씩·compiled6·실제 CanvasKit matrix pixels PASS-scoped. 정식 등록·제품/public/default 소비0과 현재 공급 notVerified 유지(§8.80).

- [x] **W10-02 / behavior/stretch10 정식 source 배치:** Core8·Cupertino1·Material1, 실제 effective 보존/필수 원본30·최종 companion0·현재 Root9씩·owner별 수정/실패/충돌9·기존23 state/35 제품 보존 PASS-scoped. fresh26·현재 native는 별도(§8.81).

- [x] **W10-02 / 공개 source와 MaterialApp 기본 behavior:** public class identity·현재 제품 Node10·실제 appRoot Core/Babel12·자동 chrome/Theme 위치·실제 touch/retirement PASS. 전체 App source·CupertinoApp·현재 native는 미완료(§8.81).

- [x] **W10-02 / nonuniform editor host 경계:** 원본 matrix 유지·Core/SDK scaleX/Y·actual Chromium2의 focus/composition/Unicode/해제·기존8·controlled RN12/거부10·Core/design/SDK build/types PASS-scoped. native pixels/물리 IME/FPS는 별도(§8.82).

- [x] **W10-02 / fresh26·출력39 최종 감사:** recipe별 전체 effective 격리·abstract Simulation graph PASS, 기존23 state/35 제품/35 qualified base 독립 보존, 원본10 raw/LF span·새4 숫자 d.ts/maps·license3 검증 완료. 현재 native 공급은 별도(§8.83).

- [x] **W10-02 / behavior/stretch10 현재 native 공급:** 동일 archive8·외부4·target별95 source/JS/d.ts/maps, Windows/Android42·default/custom/M2 glow·양축 stretch/editor retirement, Android OS focus/EditText bounds/Unicode·양 target cold3프로세스/7·입력5 원복/fixture3 제거/소유 도구 정리 PASS-scoped. 물리 IME/caret/FPS·Windows pixels는 별도(§8.84).

- [x] **W10-02 / 현재 tree 제품 본문 보존 검증:** standalone owning product·batch effective 재생성/archived host 덮어쓰기 분리, Widget Core/Babel16·facade16·nested26씩·renderer/raw Dart PASS, 변경 checker fresh26/39·state26/source559 보존. 공개 저수준7/typedef4와 generic/native animated 경계는 inventory에 미완료로 유지(§8.85).

- [x] **W10-02 / 공통 mutable List·generic 경계:** runtime24/거부4·literal/중첩 parameter/일반 function/static22/거부8·원본 양mode/strict/numeric d.ts/compiled-Core RN Babel·실제 Hermes3·fresh26/39 및 기존 state26/source559/native95 보존 PASS-scoped. const/full List·tree 제품/public/새 native app 연결은 미완료(§8.86).

- [x] **W10-02 / Map·Set factory 타입 전달:** 정확한 전체/중첩/구체 witness 경로·원본22/거부10·양mode/strict/d.ts/compiled-Core RN Babel·List22/runtime24/Hermes3·fresh26/39와 기존 state26/source560/native95 보존 PASS-scoped. full12 generic tree 후보는 생성·시험 병합 충돌0, host strict21·runtime/public/제품 연결은 미완료(§8.87).

- [x] **W10-02 / receiver 소유 nested field·source 숫자 경계:** field18/거부11·VM max24/거부5·Dart 양mode/strict/d.ts/compiled-Core RN Babel·Hermes3 PASS-scoped. source Object 숫자 provenance 유지·미지원 mutation 명시 거부(§8.88).

- [x] **W10-02 / 전체 tree generic 후보 검증:** full12 strict0·원본7시나리오/18상태·widget11/render24 양mode·Core/Babel Root16/nested26/facade16·독립3-package/Node6/compiled Babel6/Hermes3×6·final fresh26/39와 보존 감사 PASS-scoped. 정식 generic 제품/public7/typedef4·새 UI 공급은 미완료(§8.89).

- [x] **W10-02 / 원본 typedef·숫자 metadata·record callback:** alias10/원본18·거부14/frontend1·양mode/strict/d.ts/compiled-Core Babel/native Hermes3 PASS-scoped. 기존 alias 미선택 출력 유지 및 미검증 numeric function alias ABI 명시 거부(§8.90).

- [x] **W10-02 / tree 원본18·공개7/typedef4 후보:** strict0·Core/Babel 공개11씩·기존 Root16/nested26/facade16·원본 widget11/render24/generic18·독립3-package/Node10/compiled Babel10/Hermes3×10 PASS-scoped. fresh26와 최종39 byte 재생성 근거를 구분했고 state26/source563/native95 보존. actual effective gate·정식 승격·새 UI 공급은 미완료(§8.91).

- [x] **W10-02 / tree 원본18 actual effective gate:** strict/source·숫자 d.ts·Root/Core/Babel·renderer26·공개11·package/native-engine, candidate/overlay 차단과 보존/거부10 PASS-scoped(§8.92).

- [x] **W10-02 / generic18·공개7/typedef4 정식 승격:** 원본/3-way/필수 gate·현재 manifest5, lifecycle7/scratch1·무관25 state/37 제품 보존·실제 build5·최종 fresh26/39 PASS-scoped(§8.93).

- [x] **W10-02 / 현재 공개 tree archive·Chromium animation:** 외부4·source/JS/d.ts/maps110, Chromium9의 nested fractional84px·editor identity/focus/composition·controller transfer·활성 종료 PASS-scoped. 새 Windows/Android animated/cold 공급은 notVerified(§8.94).

- [x] **W10-02 / generic18 현재 native·cold 공급:** 같은 archive8/외부4·target별 tree110/behavior95·Windows/Android48·각 cold3프로세스/7, 숫자 content·중첩84px·controller 교체·활성 종료·Android 실제 EditText bounds/focus/Unicode/제거·원복/정리 PASS-scoped. 물리 IME/caret/FPS·Windows editor pixels는 별도(§8.95).

- [x] **W10-02 / CupertinoApp 원본 IR·공통 generic function:** root3/첫 의존성30 중27 IR·장애3 명시, generic 원본21/결과15/거부9·Dart2·strict/d.ts·실제 compiled Core/Babel·Hermes3, alias10/18/15/Hermes3 및 최종 fresh26/39·출력39 보존 PASS-scoped. App 생성/public/default 연결0·전체 closure는 미완료(§8.96).

- [x] **W10-02 / Cupertino route 원본 closure·공통 의미:** App30/30·route unit28/28·부모 포함29/30·union52/53 IR, accessor field/static default14/20/거부9+frontend4, collection for/null-aware read10/18/거부3+frontend1·Dart2·strict/d.ts·actual Core/Babel·각 Hermes3 및 최종 fresh26/39·보존 PASS-scoped. generic mixin application·PageRoute·App 제품 연결과 직접 Bun/Hermes 캡처는 미완료/FAIL 범위를 유지(§8.97).

- [x] **W10-02 / 변환기 배치 캐시:** 내용 기반 IR/base 캐시·무효화/손상/우회15·실제 lifecycle7·cold/warm26 생성39 byte parity와 strict/Simulation PASS-scoped. 제품605·state26 보존, 검증/승격은 계속 실행(§8.98).

- [x] **W10-02 / concrete accessor·전체 source catalog:** field13/30·거부9/frontend1·Dart2·strict/d.ts·actual Core/Babel/Hermes3, 기존14/20, route 전체32+부모34/34·App/route union57/57·navigation99/92와 장애7·full26/39·제품605/state26 보존 PASS-scoped. 이전 전체28 주장을 선택28로 보정; mixin/application/제품 통합은 미완료(§8.99).

- [x] **W10-02 / compiler 캐시 구현 identity:** 실제 TS implementation/manifest hash·동일 버전 변경과 loaded tool/emitter 변경 경계4·실제 lifecycle7·등록 recipe 기본 hit·26 generation-only/39 byte parity PASS-scoped. source compiler4/제품605/state26와 full26 이력 보존(§8.100).

- [x] **W10-02 / null-aware collection·wildcard 공통 변환:** 원본16/결과27·거부5/frontend5·Dart2·strict/d.ts·actual Core/Babel/Hermes3, navigation99/96·장애3·App/route union57/57·전체121/118·full26/39·warm IR hit와 제품605/state26 보존 PASS-scoped(§8.101).

- [x] **W10-02 / navigation 원본 장애0·공통 object/index/mixin class:** source22/결과27·거부6/frontend3·Dart2·strict/d.ts·actual Core/Babel/Hermes3, navigation99/99·App union121/121 IR·26 cold/warm/39 및 전체 IR 동일·직전 full26 fixture 보존(재실행0) PASS-scoped. generic mixin application·제품/public/default 통합은 미완료(§8.102).

- [x] **W10-02 / 원본 mixin application·projected getter:** source22/application10/results20·거부9·Dart2·strict/d.ts·actual Core/Babel/Hermes3, Cupertino 원본 closure10/application3와 body 동일/ClassModel PASS, cache lifecycle7·26 cold/warm/181 IR/39 출력·직전 full26 fixture 보존(재실행0) PASS-scoped. emitted hierarchy·App 제품/public/default는 미완료(§8.103).

- [x] **W10-02 / 파일별 AST 캐시·실제 route 의존성:** 실제 parser 캐시10·원본 graph6, 겹치는 batch unit 재사용·miss1프로세스/warm0, navigation99/99·route closure72·외부 Flutter145/59 source/IR120/미지원25/위치 누락0, 26 generation/strict/Simulation·181 IR/39 출력·직전 full26 fixture 보존(재실행0) PASS-scoped. 전체 전이 closure·emitted hierarchy/App 통합은 미완료(§8.104).

- [x] **W10-02 / 캐시된 공통 source pattern:** object/guard/nullable switch·collection if-case·binding 없는 logical-or·empty case 공유, 원본23/results26·거부6/frontend2·Dart2/strict/d.ts/actual Core/Babel/Hermes3, 이전22/27 재검증·외부 원본 IR126/145/미지원19·App+nav121/121, cache lifecycle7·26 generation/181 IR/39 출력·직전 full26 fixture 보존(재실행0) PASS-scoped. 전체 hierarchy/App 제품 통합은 미완료(§8.105).

- [x] **W10-02 / 원본 named 생성자·상속 default AST:** monomorphic named body/owned allocation·early return/closure/throw·named-only witness, analyzer 원본3단계 default AST/Unicode·CRLF span9·static dot shorthand, 원본22/results13·거부3/frontend1·Dart2/strict/d.ts/actual Core/Babel/Hermes3·이전 pattern23/26, 외부 원본 IR134/145/미지원11·App+nav121/121·cache lifecycle7·26 generation/181 IR/39 출력·직전 full26 fixture 보존(재실행0) PASS-scoped. factory/generic named·전체 hierarchy/App 제품 통합은 미완료(§8.106).

- [x] **W10-02 / optional redirect factory·선택 fixture 검증:** positional/named/chain generic factory·target default AST/private identity·source 인자 provenance, 원본17/results11·거부4/origin6·Dart2/strict/d.ts/actual Core/Babel/Hermes3·이전 생성자22/13, 외부 원본 IR137/145/미지원8·App+nav121/121, 현재26 생성/39 byte 동일·IR180 동일/metadata1 변경·영향 fixture1 재실행/25 이력 보존·selection 거부3·cache lifecycle7 PASS-scoped. const optional/unnamed factory·전체 hierarchy/App 통합은 미완료(§8.107).

- [x] **W10-02 / unnamed factory·generative anchor·factory-only 소유권:** generic concrete/abstract 실제 anchor·factory body/redirect·기존 객체 identity·implements witness·owner initializer 미실행, 원본21/results10·거부4·Dart2/strict/d.ts/actual Core/Babel/Hermes3·이전 factory17/11, 외부 원본 IR140/145/미지원5·App+nav121/121·현재26 생성/181 IR·39 byte 동일·fixture0 실행/26 보존·cache lifecycle7 PASS-scoped. const factory·generic named non-anchor·전체 hierarchy/App 통합은 미완료(§8.108).

- [x] **W10-02 / generic named generative·타입 보존 helper:** exact source owner/base·generic witness/bounds/carrier·protected anchor·private backing return check·callback/early return/throw, 원본20/results14·거부5·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·이전 생성자22/13 및 unnamed factory21/10, 외부 원본 IR141/145/미지원4·App+nav121/121·현재26 생성/181 IR·39 byte 동일·fixture0 실행/26 보존·cache lifecycle7 PASS-scoped. const factory·다른 named super·전체 hierarchy/App 통합은 미완료(§8.109).

- [x] **W10-02 / source arithmetic operator·provenance·영향 fixture:** exact unary/binary/virtual slots·원본 body/evaluation order·generic operand/return/callback, 원본28/operator21/results26·거부7·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·이전 generic20/14 및 mixin22/20, 외부 원본 IR143/145/미지원2·App+nav121/121·현재26 생성/39 byte 동일·IR164 동일/metadata17 변경·영향 fixture10 실행/16 보존·cache lifecycle7 PASS-scoped. getter/map·const/compound/increment·전체 hierarchy/App 통합은 미완료(§8.110).

- [x] **W10-02 / live getter·Map pattern·첫 외부 frontier IR:** getter18/8/results12·거부6·Map17/results26·거부4·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3, cached pattern/operator 회귀, 외부 원본 IR145/145/미지원0/누락0·App+nav121/121·현재26 생성/181 IR·39 byte 동일·기존 fixture26 보존·cache lifecycle7 PASS-scoped. 전체 transitive hierarchy·NavigatorState·App 제품 통합은 미완료(§8.111).

- [x] **W10-02 / 재귀 원본 dependency expansion:** exact owner 배치·cycle/dedup·미지원/위치/정책 경계, 원본 graph14/기존6·9 round·새 IR1335·reachable1552·span1579·warm aggregate bytes 동일/parser0/IR miss0·현재26/181 IR/39 byte 동일·기존 fixture26 보존 PASS-scoped. 미지원65·위치3·SDK/기타와 숨은 dependency·전체 hierarchy/App 통합은 미완료(§8.112).

- [x] **W10-02 / source control flow:** do-while/empty·resolved loop/block/case labels·nested/finally/callable scope, 원본21/results30·거부7/frontend2·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·기존pattern23/26/거부6, recursive IR1573/미지원63/위치3·warm bytes 동일/parser0/IR miss0·현재26/181 IR/39 byte 동일·기존fixture26 보존 PASS-scoped. guarded/refutable case·잔여언어·전체 hierarchy/App 통합은 미완료(§8.113).

- [x] **W10-02 / exhaustive labeled case return:** TS2366 원본 probe strict 진단0·resolved bool/enum/null/default/alias coverage·명시적 sourceFlow, 원본20/results27·거부7·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·기존control21/30 및pattern23/26 재검증·recursive1573/미지원63/위치3 유지·metadata1 record/1 boolean 추가·warm bytes 동일/parser0/IR miss0·현재26/181 IR/39 byte 동일·기존fixture26 보존 PASS-scoped. 전체 hierarchy/App 통합은 미완료(§8.114).

- [x] **W10-02 / relational·logical-and pattern:** virtual selector/constant/path 캐시·guard/alias/refinement·generic operand·숫자 provenance, 원본28/results23·거부8/frontend3·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·기존Map17/26·pattern23/26·operator28/26 재검증·recursive1580/미지원60/위치3·이전 미지원3 whole body 해소·warm bytes 동일/parser0/IR miss0·현재26/181 IR/39 byte 동일·기존fixture26 보존 PASS-scoped. 전체 hierarchy/App 통합은 미완료(§8.115).

- [x] **W10-02 / record assignment·checked dynamic 값:** RHS1회·shape/cast 검사 후 ordered commit·late final 부분 대입·generic 숫자 provenance·dynamic dispatch 차단, 원본23/results28·거부11/frontend2·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·기존relation28/23·pattern23/26·numeric record25 재검증·recursive1588/미지원56/위치3·이전 미지원4 whole body 해소·warm bytes 동일/parser0/IR miss0·현재26/181 IR/39 byte 동일·기존fixture26 보존 PASS-scoped. 전체 hierarchy/App 통합은 미완료(§8.116).

- [x] **W10-02 / record pattern·named 선언:** Core brand/shape probe·typed/generic/numeric/nullable binding·getter/guard/cache path·named/mixed 선언 cast provenance, 원본27/results30·거부14/frontend1·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·기존assignment23/28·pattern23/26·numeric record25·legacy3 재검증·recursive1644/미지원52/위치5·이전 미지원6 whole body 해소·warm bytes 동일/parser0/IR miss0·현재26/181 IR/39 byte 동일·기존fixture26 보존 PASS-scoped. 전체 hierarchy/App 통합은 미완료(§8.117).

- [x] **W10-02 / 객체 상수·typed wildcard:** 원본 receiver equality·canonical identity/access-path cache·analyzer cast·초기화 dependency, 원본24/results25·거부11/frontend3·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·기존record27/30·assignment23/28·pattern23/26·numeric record25·legacy3 재검증·recursive1661/미지원48/위치5·이전 미지원4 whole body 해소·warm bytes 동일/parser0/IR miss0·현재26/181 IR/39 byte 동일·기존fixture26 보존 PASS-scoped. hierarchy/App 통합 미완료(§8.118).

- [x] **W10-02 / const Set·generic 상수:** 정확한 타입/순서/canonical identity·Core private brand·불변성·Set/Iterable 공변성·숫자 조회, 원본27/results25·거부5/frontend3·Dart2/strict/numeric d.ts/actual Core/Babel/Hermes3·constMap/genericConst 각26·기존collection/object constant 재검증·recursive1826/미지원45/위치6·이전 미지원4 body 해소·warm bytes 동일/parser0/IR miss0·현재26 fixture fresh/181 IR/39 출력 동일 PASS-scoped. Core3 변경 후 새 native 공급과 hierarchy/App 통합은 미완료(§8.119).

### 9.2 종료 시 미완료 단계 이력 — W11로 이관

- [x] **W10-00 완료:** 최신 입력·pin·WIP 승계와 첫 파트/경계/검증 묶음 확정(§8.1).
- [x] **W10-01 완료:** 첫 wheel/viewport19 전체의 생성·통합·검증·재생성/수정/충돌 보존(§8.10). 기존 완료 이력 유지.
- [ ] **W10-02 진행 중:** wheel/2D/tree/Viewer/Scrollbar/behavior의 검증된 통합을 재사용한다. 추가 animated API, Page/Nested/header/refresh/reorder/dismiss/sheet의 잔여 복원·mixed sliver·first seek·keyed State/selection, 입력·resize·mutation·restore·close 및 영향 공급/성능은 남는다. 자체 TypeScript 구현으로 기능 동등성을 충족한다. Dart hierarchy/closure 폐쇄는 선행 조건이 아니다.
- [ ] **W10-03** 공통 runtime·서비스·paint/image/font·입력/animation 잔여 기능과 backend 검증 완료.
- [ ] **W10-04** 편집/Form·grapheme/style·toolbar·native 입력/메뉴·실제 IME·multi-View 잔여 검증 완료.
- [ ] **W10-05** 앱/navigator/router/overlay/Hero·Back·locale·OS link·cold restoration·native drain 잔여 검증 완료. CupertinoApp 관련 자체 구현은 W10-06과 연결.
- [ ] **W10-06** §0.2·§5.1~5.3의 두 패키지 전체 계획·family 일괄 변환/보정, Flutter 제약 family의 Doroti 비교·선택, App/theme/control/복합 family·전체 지원 locale/data/icon/font/asset/notice·독립 소비 검증 완료. DESIGN-0~4는 아직 미실행.
- [ ] **W10-07** 여섯 host/tool·SDK/CLI/Metro·runner/template·선택 공급 구조 검증 완료.
- [ ] **W10-08** 실제 hot reload/reassemble·State 보존·inspector/source map/preview·cleanup 검증 완료.
- [ ] **W10-09** 우선 실제 환경·성능/FPS·복구/종료·최신 소비/배포/출처·재현 감사 및 우선 범위 완료 판정. Core3 변경 후 native parity도 갱신.
- [ ] **W10-10** 후속 A: 접근성 설정→View·semantics tree/ack/action·reader·실패 owner 회복 검증 완료.
- [ ] **W10-11** 후속 B: native/HTML view 임베딩·합성/입력/focus·해제/복구 검증 완료.
- [ ] **W10-12** 후속 영향 회귀·최종 공급·문서/정리·전체 완료 판정.

### 9.3 중간 마무리·계획 검토 이력

- [x] **정책 변경:** §0~7·9.2의 Dart 본문/closure 우선 조건을 Nelyx TypeScript 자체 구현·기능 동등성 검증으로 대체. compiler backlog와 제품 기능 누락을 분리.
- [x] **증거 보존:** 변경 전 입력619·receipt12914·26개 fresh fixture의 유효성과 owning605/state26/sample5·기존 코드 보존을 확인. 이번 문서 작업으로 제품 완료 항목을 추가하지 않음.
- [x] **중간 마무리:** progress/handoff/checkpoint의 PAUSED/PARTIAL·다음 기능·정책·hash 연결 갱신, 소유 실행/lock/분석 설정 없음 확인.
- [x] **디자인 패키지 처리 계획 추가:** Flutter/Doroti 소스·현재 변환 제약을 검토하고 두 패키지의 family별 일괄 변환·보정·소스 선택과 검증 순서를 반영(§5.1~5.3·8.121). 제품 구현 완료 체크는 추가하지 않음.

### 9.4 W10 종료·W11 이관 — 2026-10-18 KST

- [x] **W10 계획 종료:** `CLOSED / SUPERSEDED BY W11`. W10-00·01의 완료 이력과 §8·9.1의 scoped 증거 보존.
- [x] **남은 요구 전부 이관:** W10-06→W11-01, W10-02~05→W11-02~05, W10-07~12→W11-06~11. 대응·시작 상태·완료 조건은 W11 §2에 명시. 미완료 기능을 완료 처리하지 않음.
- [x] **실행 기준 전환:** 새 progress/checkpoint와 공통 handoff의 활성 계획을 W11로 연결. W10 ledger/checkpoint는 종료·증거 기록으로 유지.

**현재 계획: CLOSED / SUPERSEDED BY W11.** 다음 구현 요청은 [work11.md](work11.md)와 W11 checkpoint (보관된 과거 기록 `w11-active-checkpoint.json`)에서 시작한다. 제품 전체는 PARTIAL, 구현 실행은 PAUSED다. 이번 종료·이관에서는 제품/변환기/test 코드를 바꾸거나 runtime 검증을 재실행하지 않았다.
