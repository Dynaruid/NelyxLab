# work11-1 — 남은 Source 비용과 직접 렌더 갱신을 줄이는 후속 설계

작성: **2026-11-13 KST** · 상태: **설계 작성 완료 / 구현 미착수**

대상: [work11.md](work11.md)의 §18.2·§19.4에 남은 작업. 이 문서는 기존 구현을 이어갈 **아이디어·적용 순서·채택 기준**이다. 이번 요청에서는 코드와 기록을 읽고 이 문서만 작성했다. 제품 코드·공급·성능 판정은 바꾸지 않았으며, 전체 실행 계약은 **PAUSED / PARTIAL**을 유지한다. 구현은 사용자의 재개 요청 후 진행한다.

핵심 제안은 **현재 Hermes가 직접 실행할 수 있는 필드 초기화를 보존하고, 변경 정보는 원래 render setter에서 얻으며, cold 생성의 중간 설정 표현을 줄이는 것**이다. warm 갱신의 journal 완성과 cold 월의 첫 생성 비용을 따로 다룬다. 생성된 객체·State·callback을 생략하거나 준비 창을 늘리는 방식으로 해결하지 않는다.

## 1. 현재 출발점과 남은 범위

### 1.1 현재 공급과 기록의 구분

- [work11 §19](work11.md#19-최신-안정-hermes-공급으로-전환)의 Windows 직접 compiler·VM·JSI 전환은 완료했다. pin은 **Hermes 260318099.0.7 / b464dba92ad87bcfb77fae381a49a2394d9836d9 / HBC 99**, class 정책은 **native-upstream-v1**, 최적화는 표준 **-O**다. 이전 공급의 no-CFG·no-inline·로컬 class-spill 패치를 다시 적용하지 않는다.
- 이번에 읽은 [engine manifest](Nelyx/engine/dist/engine-manifest.json)의 sourceSha256은 **9e03625ee2e2ce1f5f2d5099a387b44033f966805d6753ffdba02caeeb4b1e26**이다. manifest와 pin의 기록을 읽은 것이며, 제품 재빌드·파일 전수 무결성·runtime 재검증을 새로 수행한 것은 아니다.
- §17.5는 이전 공급의 Windows 네 시나리오와 Web 두 profile의 기능 근거다. §19의 최신 공급에서는 Windows All·Fast·NoTrace를 실행했고 Web App은 빌드·공급 정합성까지 확인했다. 최신 Web UI 재실행이나 직접 native host의 전체 App/static-AOT 실행을 새로 통과한 것으로 설명하지 않는다.

| work11 §19.3의 기록 | 기능 | 이동 게시 지연 p95 / 최대 | offset 정체 최대 / ≥100ms |
| --- | --- | --- | --- |
| All / 12개월 / 60Hz / YearMode | PASS | 66.916 / 122.494ms | 127ms / 4회 |
| CalendarFast / 역방향 24개월 / YearMode | PASS | notVerified | 278ms / 11회 |
| All / NoTrace | PASS | notVerified | notVerified |

이는 기존 기록이며 이번 설계의 측정값이 아니다. 60Hz의 목표는 이동 게시 지연 **p95 ≤ 약 33.3ms / 최대 ≤ 약 66.7ms**, 진행해야 하는 활성 구간의 **offset 무진행 ≥100ms 0회**다. 기능 PASS와 ≥500ms 경보 PASS만으로 W11 성능을 수락하지 않는다.

### 1.2 미완료 의무의 대응

| 기존 미완료 범위 | 이 문서의 대응 |
| --- | --- |
| W11-00A/00B: Source constructor·label 비용, UIA 관찰 조건·소비자 | §3·§6·§8에서 분리. 이미 줄인 App rect 구성은 보존 |
| W11-01: 전체 setter별 dirty journal | §4의 변경 mask와 봉인·accepted 상태 분리 |
| W11-02: Source 필수 실행/할당 분리, projection을 끈 독립 비교 | §3의 필드 초기화, §6의 담당 코드별 분석·비교 |
| W11-03: 남은 adapter와 일반 소비자 | §5의 cold 투영 단순화·적용 범위 표 |
| W11-04: demand→coverage-ready 인과와 성능 | §7의 bounded 연결, §9의 통합 검증 |
| W11-05: 원본 visual·물리 입력·display/scanout·resize | §8·§9의 별도 수락 |
| work10에서 이관한 다른 API·플랫폼·제품 전환 | §10에 미완료 의무 유지 |

## 2. 코드에서 확인한 사실과 원인 가설

사용자 지침에 따라 **코드·로직 분석 → 원인 가설 → 해결책 적용 → 실행으로 반증** 순서로 진행한다. 아래의 구조는 소스에서 확인했지만, 각 구조가 최신 공급의 지연을 얼마나 차지하는지는 미측정이다.

| 코드에서 확인한 사실 | 원인 가설과 적용 경계 |
| --- | --- |
| [Core 빌드 설정](Nelyx/tsconfig.build.json)은 ES2022이며 현재 dist의 Element도 실제 class field를 유지한다. [Windows App bundler](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)는 ES2015 target을 쓰고, [syntax 정책](Nelyx/sdk/tooling/cli/src/windows-hermes-policy.mjs)은 public instance field 보존을 지정하지 않는다. | package 단계에서 유지한 필드가 최종 Windows 번들에서 helper 호출로 내려가는 경계가 있다. native class 전환만으로 이 비용까지 제거한 것은 아니다. §3에서 이 경계를 먼저 다룬다. |
| [현재 Hermes 소스](.nelyx/windows-hermes/source/lib/IRGen/ESTreeIRGen-legacy-class.cpp)는 instance initializer에서 DefineOwnProperty IR을 생성하고, 성공한 super 호출 후 initializer를 실행한다. | 필드별 JS helper를 줄일 후보가 있다. 다만 별도 initializer 호출과 실제 속성 정의는 남으므로 자동으로 빨라진다고 확정하지 않는다. |
| [BuildOwner](Nelyx/src/framework/widgets/framework.ts)는 intrusive dirty queue와 render owner transaction을 이미 사용한다. syncRenderTree도 owner의 대기 작업을 commit하는 경계다. | root 전체 순회 제거를 새 아이디어로 반복하지 않는다. dirty 자손의 build·reconcile·constructor·등록 작업 중 실제 반복을 찾는다. |
| [NativeCapture](Nelyx/runtime/app/capture.ts)는 Source 경계 안의 invalidation을 이미 합치고, warm subtree와 변경된 자식 연결도 재사용한다. NativeRenderChange는 children/layout/paint/semantics/interaction/resource 수준이다. | 남은 것은 같은 local owner에서 어느 native 필드가 바뀌었는지다. 기존 합치기에 필드 정보를 연결하고 범용 deep 비교를 추가하지 않는다. |
| [RenderBinding](Nelyx/runtime/engine-client/scene.ts)은 목적지 없는 program 공유와 일부 scalar 명령의 encoder 생략을 이미 구현한다. | journal은 기존 기능의 정밀화다. 새 월의 최초 encode·allocation은 재사용만으로 없어지지 않는다. |
| [native box 등록](Nelyx/src/framework/rendering/boxes.ts)은 exact prototype별로 fresh NativeBoxConfiguration·중첩 layout 값을 만든다. 직접 module 경로는 이미 Scene options 검사를 우회한다. | direct-data 도입 자체를 다시 제안하지 않는다. 남은 module 설정 객체와 범용 codec 준비의 중간 표현을 줄이는 후보를 §5에서 검토한다. |
| [날짜 Source](packages/material/src/generated/date/calendar_date_picker.generated.ts)는 날짜별 FocusNode·_Day·상태 resolver·Ink·Semantics·InkResponse를 실제로 실행한다. | wrapper 수만으로 제거 대상을 정하지 않는다. 객체 identity·lifecycle·Inherited 의존성과 사용자 호출은 필수 비용이다. |

work11 §17.5의 **이전 공급**에서는 같은 pass의 descendant/render commit이 **173/4ms**였다. 이는 자손 처리 우선 조사 근거이며 constructor 단독 원인이나 최신 Hermes에서의 같은 비중을 입증하지 않는다. 당시 capture/scene 비용과도 구분한다.

**우선순위 판단:** 필드 초기화는 cold Source 생성에 직접 닿는 비교적 작은 첫 후보다. 필드 journal은 변경된 기존 owner에 유리하고, cold 월에는 중간 설정·encode 작업을 줄이는 경로가 따로 필요하다. 접근성 전면 개편과 scheduler 재작성은 현재 근거로 첫 해법에 두지 않는다.

## 3. 아이디어 A — public instance field를 현재 Hermes까지 보존한다

### 3.1 바꿀 경계

TS public field → package ES2022 JS → **최종 Windows bundler에서 public instance field 보존** → pinned Hermes IR/HBC로 연결한다. 현재 target 전체를 ES2022로 올리지 않고, 첫 후보는 esbuild의 **class-field 지원 항목 하나**로 제한한다. 이 항목은 static field·private field·static block과 구분된다. [esbuild 공식 Supported 문서](https://esbuild.github.io/api/#supported).

[고정 Hermes 원본](https://github.com/meta/hermes/blob/b464dba92ad87bcfb77fae381a49a2394d9836d9/lib/IRGen/ESTreeIRGen-legacy-class.cpp)의 DefineOwnProperty·super 이후 초기화 경로를 근거로 한 **성능 가설**이다. 원본 compiler를 추가 패치하거나 undefined field를 삭제하는 제안은 아니다.

1. **현재 직접 Windows cohort에만** public instance field 보존 정책을 둔다. 공유 windowsHermesSyntax를 무조건 바꾸어 stock RNW 구형 공급까지 함께 전환하지 않는다. 실제 cohort에 따른 syntax 선택이 필요하면 내부 정책 함수로 분리한다.
2. [runner](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)의 번들 생성·bytecode syntax manifest·실행 전 거부 검사를 같은 선택 결과로 연결한다. 관련 SDK/CLI 공급 사본의 생성 경로도 함께 갱신한다. 후보 정책은 기존 번들과 구별되는 identity를 가져야 한다.
3. TypeScript의 **DefineOwnProperty 의미**를 유지한다. 필드를 assignment로 바꾸거나, constructor 끝으로 이동하거나, 초기 undefined own-property를 제거하지 않는다. parameter property와 TS 전처리 결과도 실제 번들에서 확인한다.
4. 최종 App JS에서 해당 helper가 줄었는지와 실제 HBC/IR의 필드 정의·initializer 호출을 대조한다. JS 문자 수 감소를 runtime 비용 감소로 대신하지 않는다.

### 3.2 보존해야 할 의미

- 상속 setter를 호출하지 않는 own data property 정의, 필드 순서·descriptor·열거 순서.
- base/derived constructor, 명시적·암시적 super, super가 다른 객체를 반환하는 경우, new.target과 교체 superclass.
- computed key의 class 정의 시 평가와 field value의 instance별 평가, symbol·익명 함수 이름·예외 identity/순서.
- base constructor 중 관찰되는 derived 상태, 사용자 hook, mixin·Diagnosticable 그래프와 대형 App 초기화.
- 실제 package dist를 거친 입력과 debug/optimized 양쪽의 전체 Demo App module initialization.

기존 [Hermes 의미 검사](Nelyx/eng/check-hermes-syntax.mjs)를 확장한다. 기존 helper 경로와 field 보존 후보는 같은 compiler/VM·같은 Source로 비교하며, 작은 constructor 표본만으로 채택하지 않는다.

### 3.3 채택·철회 기준

언어 의미와 실제 App 초기화를 통과하고, 같은 cold 월에서 Source 처리량·긴 동기 구간 또는 활성 이동 지연의 개선 근거가 있어야 채택한다. native initializer의 함수 호출 때문에 이득이 작거나 기능·성능이 악화되면 후보 정책을 철회한다. compiler 개조로 계속 범위를 넓히지 않고 §6에서 남은 Source 담당 코드를 다시 고른다.

## 4. 아이디어 B — 원래 render 변경에 필드 정보를 붙인다

### 4.1 별도 Source revision을 만들지 않는 journal

[RenderObject](Nelyx/src/framework/rendering/object.ts)의 기존 native invalidator와 [NativeCapture.invalidate](Nelyx/runtime/app/capture.ts)에 **모듈별 변경 필드 mask**를 연결한다. setter가 이미 수행하는 검증·동등성 판정·값 대입·무효화는 그대로 실행한다. 그 변경이 확정되는 지점에서 해당 command의 필드 bit를 세우고, 같은 Source 경계에서는 OR로 합친다.

| 변경 묶음 | 예 | 처리 |
| --- | --- | --- |
| native layout 데이터 | padding·alignment·constraints·방향 | 관련 layout/constraints 명령만 재생성 |
| paint·text 데이터 | color·opacity·문자열·style의 실제 변경 | 해당 명령과 실제 dependency 갱신 |
| semantics 속성 | label·role·flags·action capability | 변경 metadata와 노출 영향 갱신 |
| callback record | 같은 capability의 함수 교체 | native program 공유 가능, 현재 App callback은 교체 |
| children·참조·resource·global context | reparent·parking·font·metrics·device | edge/fixup 재검증, 불명확하면 전체 owner 갱신 |

mask 이름과 저장 위치는 **미구현 설계**다. 모듈별 고정 bit 집합을 사용하고 무제한 필드 이름 Map이나 객체별 deep snapshot을 만들지 않는다. setter에서 scalar를 다시 복사하거나 Widget/options마다 revision·freeze를 추가하지 않는다.

### 4.2 반드시 지켜야 할 세 경계

1. **Source의 현재 변경:** 여러 번 대입해도 원래 setter와 예외·callback은 모두 실행한다. mask는 native 투영만 합친다.
2. **capture에서 봉인한 변경:** capture가 성공하면 그 pass가 읽은 변경만 봉인한다. capture 도중 발생한 새 invalidation, 예외·abort·close는 다음 pass 또는 기존 복구 경로에 남긴다.
3. **native가 accepted한 record:** ACK를 받기 전 Source program 재사용과 native accepted 상태를 합치지 않는다. NACK·in-flight·generation 변경 시 기존 checkpoint/RecordPatch가 기준이다.

처음 생성한 owner, adapter↔직접 경로 전환, 알 수 없는 subclass·실행형 값은 **전체 초기화**한다. layout/paint/semantics의 넓은 markNeeds 호출에는 보수적인 전체 mask가 필요하다. 최적화한 setter 몇 개만 보고 모든 공개 mutation이 필드별 journal을 가진다고 선언하지 않는다.

### 4.3 실제 확장 순서

- 기존 scalar 재사용이 없는 layout·constraints부터, 이미 exact prototype으로 opt-in한 공통 box 모듈에 적용한다.
- 다음으로 static semantics와 내부 Focus/Gesture의 callback 교체를 연결한다. 이전에 철회한 Source revision 후보를 복원하지 않는다.
- Ink/paragraph의 참조·font·paintPlacement는 기존 dependency/fixup 검증과 함께 다룬다. mutable Paint·객체/배열 identity만으로 unchanged라고 판정하지 않는다.
- 마지막으로 남은 render setter를 목록화해 **필드 매핑 완료 / 전체 owner 갱신 / adapter / 미지원**을 구분한다. 전체 setter 의무는 이 목록과 회귀까지 마쳐야 닫는다.

**한계:** cold 월에서는 대부분의 owner가 처음 생성된다. journal의 warm 효과만으로 새 월 생성 성능이 해결됐다고 판정할 수 없다. 변경 기록 유지 비용이 제거한 encode 비용보다 커지면 해당 모듈 도입을 철회한다.

## 5. 아이디어 C — cold 투영에서 module 설정을 만들고 다시 읽는 단계를 줄인다

현재 direct box 경로도 **등록된 reader → NativeBoxConfiguration/layout 생성 → parent layout 보강 → boxRenderBindingConfiguration → codec → 봉인**을 거친다. [boxes.ts](Nelyx/src/framework/rendering/boxes.ts)의 Padding·Align 등은 이 중간 데이터를 매번 만든다. 기존 direct-data가 우회한 Scene options·descriptor 검사와 이번에 남은 비용을 구분한다.

### 5.1 모듈의 고정 투영 절차를 기존 writer에 붙인다

공통 모듈에 내부 전용 command 작성 절차를 등록해, 필요한 scalar를 읽은 뒤 기존 명령 codec/검증에 바로 전달하는 후보를 검토한다. **wire/schema·handle allocation·accepted diff·Core validator는 유지**한다. 모듈별로 고정된 기본 command와 실제 payload를 연결하고, 중간 layout/options 객체 중 더 이상 소비자가 없는 것만 제거한다.

- **cold:** 처음 생성한 native node·모든 필수 초기 명령은 남는다. 중간 설정 객체·중복 scalar 정규화·불필요한 clone을 줄이는 것이 목표다.
- **warm:** §4의 mask를 소비해 바뀐 command만 다시 작성하고 나머지 destination-free program을 공유한다.
- **공통:** 자식 연결·callback record·registration·dependency는 현재 Source 결과를 사용한다. 기록용 트리를 하나 더 복제하지 않는다.

exact prototype 등록만으로 중첩 값까지 순수하다고 보지 않는다. 사용자 Alignment/EdgeInsets resolve·delegate·getter가 실행될 수 있으면 기존 호출 횟수·순서·예외를 유지하거나 adapter로 남긴다. 기존 [host](Nelyx/runtime/app/host.ts)의 instance hook 검사와 실행형·합성 노드 경계를 우회하지 않는다.

### 5.2 제한된 첫 묶음과 적용률 판정

첫 묶음은 기존 공통 box 중 scalar·불변 기본값으로 의미를 닫을 수 있는 경로다. 기능과 제거 작업량이 확인되면 static semantics, 내부 Focus/Gesture, Ink의 합성 paragraph·참조까지 확장한다. 공개 arbitrary paint/layout·editor/image 등은 각 소비자 계약을 읽은 뒤 별도 묶음으로 진행한다.

동일 cold pass에서 **모듈 종류 / 호출 수 / full 초기화·필드 갱신 수 / adapter와 이유 / 생성한 중간 payload 수·encode bytes**를 제한된 카운터로 확인한다. startup과 여러 월의 누적 binding/adapter 비율을 cold 적용률로 계산하지 않는다. 남은 adapter가 시간을 지배하면 다음 구현 대상으로 적거나 미완료로 남긴다.

**채택 기준:** 최종 wire/정규화 graph·callback·관찰 결과가 reference 경로와 같고, 실제 중간 표현 제거와 cold capture/scene 비용 감소가 확인돼야 한다. 단순 객체 하나의 이름 변경이나 counter 증가만으로 완료하지 않는다.

## 6. Source 필수 실행을 담당 코드별로 나누고 생성기를 좁게 개선한다

### 6.1 계측부터 확대하지 말고 호출 소유권을 먼저 고정한다

[날짜 Source](packages/material/src/generated/date/calendar_date_picker.generated.ts), [framework](Nelyx/src/framework/widgets/framework.ts), [LayoutBuilder](Nelyx/src/framework/widgets/layout-builder.ts)를 읽어 아래 비용을 먼저 분류한다.

| 담당 구간 | 분석할 작업 | 최적화 가능 범위 |
| --- | --- | --- |
| _DayPickerState | 날짜 delegate·predicate, FocusNode 수명, Key·_Day 생성 | 번역 helper의 추가 비용. 사용자 호출·새 객체는 유지 |
| _DayState와 Material 소비자 | theme/Inherited 조회, state resolver, label·TextStyle, Ink·Semantics | 불필요한 번역 표현과 내부 데이터 변환. 필수 State·callback 유지 |
| Element/BuildOwner | create/mount/update/reconcile, dirty 자손, 의존성·등록 | 이미 있는 single-child fast path·scope ancestry cache·queue를 보존하고 남은 반복만 제거 |
| capture/writer | local 설정, 자식 연결, codec·fixup·diff | §4·§5에서 처리. Source build와 분리 |

기존 pass ID·retainedBuilderCosts·sourcePreparation를 사용한다. 필요한 추가 계측은 **한 cold 월의 담당 구간별 coarse scope와 개수**부터 시작한다. 모든 constructor/getter에 timestamp·문자열·Map을 붙이는 상시 profiler를 만들지 않는다. 중첩 시간은 inclusive/exclusive로 구분하고, 누적값·다른 pass 최대값을 더하지 않는다. 낮은 시간 해상도에서 0ms인 호출을 비용 없음으로 확정하지 않는다.

객체 생성 개수와 VM 할당 bytes도 구분한다. 알려진 생성 지점의 count·payload bytes는 집계할 수 있지만, 이를 해당 owner의 정확한 Hermes heap/GC 비용으로 표시하지 않는다. 진단 on/off로 의미와 부하를 확인한다.

### 6.2 생성기 후보의 선택 기준

- analyzer가 type·effect·receiver 평가 횟수를 증명한 **좁은 IR 패턴**에만 static binding·불필요한 임시 표현 축소를 추가한다. work11에서 완료한 null-aware/final-field/helper 결합을 다시 미착수로 돌리지 않는다.
- 같은 원본 nullable local을 여러 closure로 감싸는 표현이나 증명된 내부 helper 왕복이 실제 잔여 비용이면 emitter에서 처리한다. 임의 getter·Proxy·교체 함수·예외 의미가 달라지면 기존 경로를 유지한다.
- _DayState의 formatDecimal은 표시와 label에서 원래 두 번 호출된다. custom localization·calendar delegate·resolver의 결과를 임의로 공통화하거나 월별로 cache하지 않는다. 필수 호출을 포함한 비용을 먼저 인정한다.
- Widget/Element/State·FocusNode·사용자 callback을 다른 월과 공유하지 않는다. mutable 결과 cache나 가상 Element를 새 해법으로 도입하지 않는다.
- 변경 위치는 [생성기](tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts)·[emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts)·관련 adapter다. generated TS만 수작업으로 고치지 않는다. 원본 pin **71e4717a61786faab4c7aa39825989305ed29e8a**, normalized hash·타입 provenance를 유지한다.

전체 재생성 검증은 현재 계약인 **시스템 Dart 3.12.2 / 75개 선언·원본 oracle** 경로로 한다. 과거 임시 dev SDK가 필수라는 이전 기록을 다시 적용하지 않는다.

### 6.3 Source 개선과 projection 개선의 독립 비교

같은 compiler/VM·날짜·theme·locale·predicate·입력·resident 정책에서 **기존 Source/후보 Source × reference projection/direct projection**을 비교할 수 있게 한다. 이미 있는 정확성 경로를 우선 재사용하고, 필요한 선택 장치가 없으면 검사 전용 옵션으로 한정한다. 제품의 공개 renderer 선택지나 별도 장기 runner로 만들지 않는다.

같은 cold 월의 필수 호출 순서·개수·결과, Source/build와 capture/scene, 신규/재사용 owner·payload를 분리한다. 모든 조합의 전체 App을 반복 빌드하기보다 국소 비교로 후보를 좁힌 뒤 챕터 끝에서 실제 공급을 통합한다.

**재설계 기준:** helper 제거와 올바른 직접 투영 뒤에도 원본 필수 실행 자체가 준비 여유와 refresh 예산을 넘으면 W11-02의 **설계 효용 PARTIAL**을 유지한다. 추가 cache나 callback 생략으로 완료 처리하지 않고 남은 필수 담당 코드·비용·대안이 필요한 이유를 적는다.

## 7. 아이디어 D — demand에서 실제 이동까지 기존 identity로 연결한다

현재 [host.sourcePreparation](Nelyx/runtime/app/host.ts)은 128개 bounded 표본과 sourceThrough를 기록하지만, **callback의 built는 coverage-ready가 아니고 sourceThrough는 정확한 demand별 연결이 아니다.** [Core scheduler](Nelyx/engine/core/scheduler/scheduler.cpp)의 layout 완료·providerReady·activation·coverage 검사와 연결해야 한다.

### 7.1 연결할 identity와 경계

| 경계 | 필요한 연결·정의 |
| --- | --- |
| Core demand 생성 | session/view 수명, viewport node slot/generation, coverage revision·요청 range, input sequence, document/metrics/device/font cohort |
| App 요청 접수·실행 | authoritative request의 preparation/id/revision 또는 observed-window의 publication/list generation/range → Source preparation sequence |
| Source 완료·capture | 실행 시작/끝, 실제 신규·재사용 페이지, Source pass → 봉인한 transaction/document. 하나의 pass에 여러 demand가 합쳐진 경우 관계를 보존 |
| Content 준비 | 같은 cohort의 layout·provider 준비, 요청 위치를 포함하는 실제 coverage. 일반 ready bit만으로 대상 월 ready라고 판정하지 않음 |
| activation·이동 게시 | 실제 publication/document·input consumedThrough와 표시 offset을 대조해 해당 이동을 처음 반영한 게시를 연결 |

표의 항목은 **필요한 정보의 설계**이며 모두 현재 wire에 있다는 뜻은 아니다. 기존 request/event/observation·coverageRevision을 먼저 대조하고 없는 identity/timestamp만 기존 bounded diagnostics에 추가한다. 진단 때문에 scheduling 권위·wire를 먼저 전면 교체하지 않는다.

### 7.2 bounded 기록의 정확성

- App의 performance.now와 native monotonic clock을 직접 빼지 않는다. App 내부 시간, Core 내부 시간, 공통 clock으로 교정된 end-to-end 시간을 구분한다. 교정 오차가 목표 해상도를 만족하지 않으면 해당 지연은 notVerified다.
- 기존 ring 한도 안에서 demand의 시작·단계·종료를 보존하고, 완료 표본은 histogram/최대·분모로 접는다. 취소·superseded·현재 pending·관찰 누락은 별도 결과로 남긴다. 성공 표본만 남겨 꼬리가 짧아 보이게 하지 않는다.
- 필요한 chain이 overwrite되면 해당 구간의 p95/최대는 notVerified다. 전체 run의 ring overwrite와 실제 입력 손실은 구분한다. 기록을 늘리기 위해 파일·receipt·checkpoint를 누적하지 않는다.
- NACK·역방향·resize·font/device 변경·close의 chain 종료를 명시한다. slot 재사용이나 우연히 같은 range라는 이유로 다른 generation의 demand를 연결하지 않는다.

이 연결로 **Source가 늦음 / Content·provider가 늦음 / 준비 뒤 activation이 늦음 / 게시에서 이동 반영이 늦음**을 구분한다. 먼저 분석·적용한 변경의 효과를 확인하고, 다음 수정 대상이 어느 owner인지 결정하는 데 쓴다. 수집을 반복하는 독립 장기 과제로 만들지 않는다.

## 8. 접근성·시각·물리 확인을 마무리하는 방법

### 8.1 접근성은 실제 소비자 계약부터 닫는다

이미 구현된 [App publication-bound rect resolver](Nelyx/runtime/app/semantics.ts)와 [SemanticsBinding](Nelyx/src/framework/semantics/binding.ts)을 유지한다. TapRegion·focus/editor·geometry/layers가 같은 관찰을 사용하므로 UIA listener가 없다는 이유로 App 관찰을 끄지 않는다.

[Windows Interaction.sync](Nelyx/engine/platform/windows/interaction.hpp)는 현재 semantic packet·문자열·정렬·부모 연결을 만들고 [SemanticsTree.publish](Nelyx/engine/platform/windows/interop/SemanticsTree.h)를 호출한다. update(delta)도 전체 order packet을 복원하므로 호출명만 바꾸는 방식은 증분화가 아니다.

먼저 다음 조건의 정확성을 확인한다.

1. 실제 UIA client가 없는 실행, 늦게 접속한 실행, reader/query가 활성인 실행. 기존 자동 검사 자체가 UIA를 사용한 상태를 비청취 표본으로 계산하지 않는다.
2. 실제 날짜 action·focus·keyboard, editor의 TextPattern·selection/composition, custom action, 동기 재진입.
3. scroll/clip·hidden·route·merge/order 변화와 metrics/device 변경, 삭제·parking·generation 재사용, 오래된 action/lease 거부.

그 뒤 UI owner의 비용이 여전히 유의미할 때만 **불변 metadata/UTF-16 문자열의 node 수명 재사용 + 현재 geometry/state 갱신**을 구현한다. key에는 generation과 metadata·locale/action 변화를 포함하고 삭제·close 때 회수한다. 비청취 중에도 최신 provider/query 상태를 보존해 늦은 접속을 지원한다. 광범위한 UIA/Core semantics 개편은 기본 선행 작업으로 삼지 않는다.

### 8.2 제품 확인은 별도 결과로 남긴다

- **원본 visual:** 같은 월·locale·theme·DPI·선택/disabled/today·focus/Ink·연도 모드에서 원본 날짜 pin의 배치·텍스트·clip·접근성 label을 비교한다. 기능 checker의 header/grid 일치만으로 시각 수락하지 않는다.
- **물리 입력:** 사용자의 실제 빠른 왕복·재접촉·반전·날짜 선택·close를 확인한다. PowerShell 합성 contact와 물리 trackpad를 구분한다.
- **표시와 resize:** software publication, GPU 완료, 실제 display/scanout, 물리 resize의 기능·성능을 각각 기록한다. 현재 장치·도구가 scanout을 관찰하지 못하면 notVerified로 남긴다.

## 9. 구현 순서와 검증 묶음

아래는 **재개 후 실행할 계획**이다. 새 성능 개선이 이미 달성됐다는 체크리스트가 아니다. 각 챕터에서 관련 구현·소비자·공급 검사를 묶고, 코드 검토와 국소 정확성 검사를 거쳐 통합한다.

| 순서 / ID | 구현 묶음 | 국소 확인과 완료·중단 기준 |
| --- | --- | --- |
| 0 / W11-1-00 | §19의 현 공급·diff·pin과 공개 실행 경로 확인, 위 후보의 호출 소유권 고정 | 이전 측정과 현재 공급을 구분. 바로 baseline 반복 실행부터 시작하지 않음 |
| 1 / W11-1-01 | §3 public instance field·cohort별 syntax·manifest/거부 검사 | 기존 Hermes 의미 검사와 실제 App debug/optimized 초기화 → 같은 cold Source 비교. 무효하면 철회 |
| 2 / W11-1-02 | §6의 Source 담당 코드 분리, §7의 최소 identity 연결 | 한 cold pass에서 필수 실행/투영/coverage를 구분. 새 profiler·장기 로그를 만들지 않음 |
| 3 / W11-1-03 | §4 필드 journal + §5 공통 module cold 투영 | 기존 wire oracle, capture/reconcile·generation·NACK/취소/참조 검사를 통과. warm와 cold 효과 별도 확인 |
| 4 / W11-1-04 | 실제 비중이 큰 남은 adapter·좁은 생성기 패턴·일반 소비자 연결 | generated 원본 oracle·State/Key/FocusNode/Inherited·Ink·callback 보존. 전체 적용 범위 목록 작성 |
| 5 / W11-1-05 | §7 전체 인과, §8 UIA 실제 소비자·원본 visual, 현재 Windows/Web 통합 | 기능/언어/수명/성능/관찰 조건별 판정. 정확성만 PASS면 성능 미완료 유지 |
| 6 / W11-1-06 | 사용자 물리 입력·표시/scanout·resize, 실행 계약 갱신 | 관찰한 범위만 수락. 미검증·다른 플랫폼 의무는 유지 |

### 9.1 재사용할 검사와 실행 범위

- **필드/Source:** [check-hermes-syntax.mjs](Nelyx/eng/check-hermes-syntax.mjs), [check-child-reconciliation.mjs](Nelyx/eng/check-child-reconciliation.mjs), [check-immediate-reads.mjs](Nelyx/eng/check-immediate-reads.mjs), 기존 생성기 --check --verify와 원본 oracle.
- **binding/관찰:** [check-render-bindings.mjs](Nelyx/eng/check-render-bindings.mjs), [check-incremental-capture.mjs](Nelyx/eng/check-incremental-capture.mjs), [check-semantics-publication.mjs](Nelyx/eng/check-semantics-publication.mjs), 관련 Ink·native frame/coverage·lease 회귀. 새 검사는 기존 oracle가 놓치는 의미 경계에만 추가한다.
- **Windows 통합:** [check-windows-scroll.ps1](Nelyx/eng/check-windows-scroll.ps1)의 All / 12개월 / 60Hz / YearMode, 빠른 역방향 24개월, 0.4/0.8페이지 양방향, NoTrace. [movement verdict 검사](Nelyx/eng/check-scroll-movement.mjs)를 유지하고 실제 consumer를 선택한다.
- **Web·공급:** 공통 Source/writer를 바꾸면 threaded·single-worker의 월 왕복·resize·연도/날짜 선택·오류/종료를 현재 공급에서 확인한다. 직접 Windows compiler 변경만으로 Web runtime 성능 효과를 주장하지 않는다. native 변경이 없으면 불필요한 native 재빌드는 생략한다.

모든 검사는 **20분 timeout**, 대부분 **30회 이내** 원칙을 따른다. 변경마다 전체 App을 빌드하지 않고 챕터 끝에서 통합한다. 같은 공급·입력·관찰 조건의 짧은 대조로 시작하고 새 실패나 불확실성이 있을 때만 추가한다. 단 한 번 낮은 수치가 나온 것을 개선율이나 최종 수락으로 확정하지 않는다.

소유 임시 디렉터리·consumer·browser context·process·이전 dist/staging은 성공/실패/중단 모두 finally에서 회수한다. 사용자 변경·기존 SDK·필요한 현재 공급 입력은 보존하며, 로그·profile·SDK 사본·receipt/history JSON을 누적하지 않는다.

### 9.2 유지할 성능·정확성 기준

- work11 §6.3의 100ms offset 정체 0회, 이동 게시 지연 p95 ≤ 2T / 최대 ≤ 4T를 유지한다. 입력 궤적·정상 clamp·끝 경계·반전 순간·missing/ring loss를 함께 판정한다.
- demand→coverage-ready p95/최대와 각 실제 경계의 준비 여유를 같은 identity로 제시한다. 실제 신규 페이지 수·재사용 수를 구분하고 평균 월 이동량을 실제 월 생성 service time으로 바꾸지 않는다.
- 필수 App 동기 구간은 한 refresh를 넘지 않는 것을 우선 목표로 삼는다. 넘는 원본 작업은 담당 코드와 비용을 남기며 임의 callback 전체에 상한을 보장한다고 주장하지 않는다.
- 입력 속도·200ms 원본 animation·기본 4페이지 resident 준비 정책·coverage/ACK/publication fence는 그대로 둔다. 사용자 KeepAlive/Focus의 별도 보존 계약도 지킨다.
- user build/constructor/resolver 중간에 await·microtask yield를 삽입하지 않는다. 긴 순수 encode만 남으면 봉인 batch의 continuation을 후속 후보로 검토하되, 총 처리량 개선과 부분 Document 미게시를 함께 확인한다.

## 10. 재시도하지 않을 후보와 남겨 둘 제품 의무

work11 §13.1·§15.2에서 철회한 **범용 constructor descriptor layout, Source 객체별 scalar revision/freeze, 구조화된 명령 인수 tree/flat key 복사·비교**를 그대로 다시 도입하지 않는다. 이번 field journal은 이미 변경을 아는 render setter에서 얻고, cold 투영은 불필요한 표현을 만들지 않는 데 초점을 둔다. 이름만 바꿔 같은 관리 비용을 추가하지 않는다.

또한 [work10 잔여 의무](history/26/11/11/work10-summary.md#work9-잔여-의무-이관)는 존속한다.

| 이관 범위 | 유지할 의무 |
| --- | --- |
| W10-R01/R02 | 공개 Core 실행·layout/paint/hit/delegate·scroll/editor/PlatformView, 전체 디자인·접근성·입력 계약 |
| W10-R03/R04 | OS 실제 소스 이식·SDK/VM 수명, 독립 설치·CLI/config/template/공급·출처/notice |
| W10-R05/R06 | Demo/Testbed 전체 소비자, 원래 4 packages / 834 subpaths·서명 분모의 API·기술 gate |
| W10-R07 | 대상별 수락 후 기본값 전환·마지막 소비자 제거. 잔여 legacy의 성급한 삭제 금지 |
| W10-R08 | Android 두 ABI 최신 공급·실제 설치/run, Linux·iOS·macOS와 대상별 지원·배포 gate |

이 전체 플랫폼 의무를 첫 성능 개선의 선행 조건으로 요구하지 않되, 날짜 선택기 부분 PASS로 함께 완료하지 않는다. 최신 직접 host의 C++ compile/link PASS와 전체 App/static-AOT 실행 수락도 구분한다.

## 11. 현재 체크포인트

- [x] work11 §18.2·§19.4와 현 코드·공급 manifest를 읽고, 남은 작업을 이 문서에 연결했다.
- [x] 코드상 근거·원인 가설·cold/warm 효과·채택/철회 기준·검증 순서를 작성했다.
- [ ] W11-1-00~06의 구현과 실행 검증은 **미착수**다.
- [ ] 원래 work11의 전체 setter/adapter·Source 분리·coverage 인과·UIA·visual·물리/표시/resize·다른 제품 의무는 **미완료**다.

현재 제품 상태는 **PAUSED / PARTIAL**, **compatible=false**, **performanceAccepted=false**, **resizePerformanceAccepted=false**, 물리 입력·전체 display/scanout **notVerified**다. 이 문서 작성으로 원래 work11을 닫거나 자동 재개하지 않는다.
