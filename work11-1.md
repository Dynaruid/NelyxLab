# work11-1 — 남은 Source 비용과 직접 렌더 갱신을 줄이는 후속 설계

작성·갱신: **2026-11-14 KST** · 상태: **PAUSED / PARTIAL · 사용자 외출로 명시적 정지 · 성능 미수락**

대상: [work11.md](work11.md)의 §18.2·§19.4에 남은 작업. §1–10은 후속 설계·적용 순서·채택 기준이며, §11은 설계 작성 당시의 기록이다. 사용자의 **“work11-1.md 작업해줘”** 요청으로 구현을 재개했다. **현재 변경·공급·검증·미완료 범위는 §12–13**을 기준으로 한다. 원래 work11의 전체 제품 수락을 완료한 것은 아니다.

사용자가 물리 확인 뒤 **멈춤·점프 해결을 active 목표로 지정**했고, **“테스트 자체를 가상 제스처를 3배 빠르게 … 나는 부재중”**이라고 요청해 작업을 계속했다. 이후 Hermes/JIT 조사와 V8 JIT Demo 실행을 요청했고, 가장 최근 **“나 외출해야해서 일단 정지해줘”**라고 명시적으로 중단했다. **현재는 PAUSED이며 자동으로 재개하지 않는다.** §13.33이 이번 정지 지점이고 아래 active 표현과 이전 수치는 당시의 이력이다.

**정지 시점:** V8 JIT의 실제 Demo 모듈 초기화·Promise/microtask·외부 버퍼 수명·현재 Windows SDK 활성화와 진단 host 빌드는 PASS했다. 그러나 GUI startup에서 **Original App viewport is unavailable**로 종료돼 app-ready·사용 가능한 V8 Demo 실행·3배속 성능 비교는 **미완료**다. 새 진단 도구 두 파일을 보존했고 기존 Source/SDK/App/engine dist를 변경하지 않았다. 마지막 실패 실행은 reserved/memory 0·workers joined로 종료했으며 현재 소유 App/비교·compiler 프로세스와 임시 디렉터리는 없다. 원인 가설과 다음 코드 확인은 §13.33에 기록했다.

**최신 검증 기록:** §13.31의 native public static·instance private field 후보까지 SDK·네 App·Source 입력·전체 파일/native image를 갱신·대조했다. engine은 **`7fde85bf…c56ebf1a`**를 유지했고 Demo Windows JS는 **c296ecf9…8f1be360**이며 명시적 native unit 선택이다. 일반 Calendar 3배속은 **360 updates / 2,000.453ms / 180Hz**, 12개월·resize·연도/날짜·종료 PASS지만 이동 **200.279/241.915ms**, offset **최대 234ms / ≥100ms 11회 / ≥250ms 0회**로 **성능 FAIL**이다. 기본 CLI/native 제품 전환은 아니다.

**진행 경계:** §13.31 공급의 Fast -24개월·연도/날짜·종료도 기능 PASS지만 offset 정체 **최대 246ms / ≥100ms 4회**로 FAIL이다. 접촉 중 반전·네 Contact·Web UI의 최신 실행은 변경 전 §13.30 공급이며, §13.31로 다시 실행한 것으로 표시하지 않는다. 목표는 **active / PARTIAL / performanceAccepted=false**다. 사용자의 Hermes/JIT 근본 원인 질문에 따라 **§13.32의 런타임과 준비 구조 분리**를 다음 조사 우선순위로 바꾼다.

**현재 구현:** 일반 실행에는 Widget 진단 observer를 설치하지 않는다. 별도 profiling에서 queue rebuild **26,109회 / 72종류** 중 **210구간**을 관측했고 분류·시계 경계 실패는 0이다. **25,899회는 종류/자식 상태별 표본 제한으로 제외**했으며 전체 allocation으로 외삽하지 않는다. _GridView의 빈 자식 상태 두 표본은 기존 **752,672 / 641,408 bytes**에서 **223,744 / 196,216 bytes**가 됐다. native probe 총/최대 **2.888/0.023ms**와 추가 분류 비용이 있어 시간 순위를 CPU self time으로 수락하지 않는다. 일반 Calendar cold build/capture/scene는 **88.716/50.571/48.296ms**로 긴 비용이 남는다.

**§13.30 구현 경계:** 42셀 숫자 graph의 서로 다른 소유 객체 수는 **1,175→241**이며 데이터·명령 또는 원래 budget 거부·policy getter·예외·mutable/accessor 입력 대조와 실제 Wasm Core layout/State 검사를 PASS했다. 전체 타입·84개 수기 파일·관련 회귀와 Core→SDK·네 App 빌드·3배속 Native/Web·할당 재관측을 마쳤다. 이는 해당 반복 복사의 감소 근거이며 성능 해결이나 전체 Source 할당의 감소율은 아니다. Source 값·Widget/State·callback·public/mutable producer 검사와 resident/lead/animation은 유지한다.

**§13.31 구현 경계:** Windows V2의 현재 직접 Hermes cohort에서 public static field·instance private field와 field brand를 native 문법으로 유지하는 후보를 적용했다. private method/accessor·static private member·static block과 stock RNW는 기존 lowering을 유지한다. Node·고정 debug/optimized HBC·native unit의 언어 의미·직접 private IR/HBC와 실제 Core 값 대조를 PASS했다. geometry 묶음의 textual private get/set/add helper 호출 지점은 **36/11/11→0/0/0**, 전체 App JS 후보의 private get 지점은 **4,009→20**이며 실행 횟수나 개선율이 아니다. 전체 타입·86개 수기 파일·최종 SDK·네 App 빌드와 현재 공급의 Calendar/Fast를 마쳤다. 긴 동기 Source와 정체를 해결하지 못했으며 비용 개선율은 수락하지 않는다.

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

## 11. 설계 작성 당시 체크포인트

- [x] work11 §18.2·§19.4와 현 코드·공급 manifest를 읽고, 남은 작업을 이 문서에 연결했다.
- [x] 코드상 근거·원인 가설·cold/warm 효과·채택/철회 기준·검증 순서를 작성했다.
- [ ] 설계 작성 시점에는 W11-1-00~06의 구현과 실행 검증이 **미착수**였다. 현재 진척은 §12에 있다.
- [ ] 원래 work11의 전체 setter/adapter·Source 분리·coverage 인과·UIA·visual·물리/표시/resize·다른 제품 의무는 **미완료**다.

설계 작성 당시 제품 상태는 **PAUSED / PARTIAL**, **compatible=false**, **performanceAccepted=false**, **resizePerformanceAccepted=false**, 물리 입력·전체 display/scanout **notVerified**였다. 이후 명시적인 재개 요청에 따른 실행은 아래에 구분한다.

## 12. 구현과 실행 기록 — 2026-11-13

### 12.1 코드 분석과 적용 범위

깨끗한 checkout에서 시작했다. `.github/copilot-instructions.md`의 20분 상한·제한된 반복·현재 dist만 유지·임시 산출물 회수 원칙을 적용했다. 기존 intrusive dirty queue, render owner transaction, capture 재사용, destination-free program과 ACK/NACK 기준은 보존했다.

| 묶음 | 적용한 변경 | 현재 경계 |
| --- | --- | --- |
| W11-1-00 | 현재 pin·engine/App 입력·공개 v2 실행 경로와 Source 담당 코드를 대조 | 완료. 이전 측정을 새 실행의 baseline으로 사용하지 않음 |
| W11-1-01 | `windows-hermes-syntax.mjs`에서 최신 직접 cohort의 `class-field`만 보존. runner의 bundler·App syntax identity·실행 전 거부를 연결 | 언어·실제 App 초기화 PASS. 성능 수락은 별도 |
| W11-1-02 | 기존 128 Source 표본에 owner/node generation·문서/metrics/device/font·request/range와 sealed capture pass·ACK 관찰·publication을 연결. retained LayoutBuilder도 `retained-box`로 기록 | App 관찰 연결 구현. native demand 시작·provider-ready·activation별 시각은 미완료 |
| W11-1-03 | 원래 invalidator의 필드 mask를 Source 경계에서 OR. 봉인 중 새 invalidation·실패/abort·unknown context는 보존 또는 full 갱신. 공통 5개 prototype의 고정 command 절차 추가 | 부분 구현. 전체 setter/adapter 의무는 열림 |
| W11-1-04 | 생성기가 직접 만든 인접 정수 검사만 접는 좁은 emitter 정책과 원본 재생성 | 이 패턴은 완료. 나머지 adapter·일반 소비자 확장은 미완료 |
| W11-1-05 | 현재 Windows/Web 번들, 언어·capture/참조·수명·기능 회귀와 독립 projection 비교 | 아래 결과와 관찰 조건만 수락. UIA 전체 소비자·원본 visual·완전한 native 인과는 미완료 |
| W11-1-06 | 실제 사용자 트랙패드 빠른 스크롤 확인·정상 종료 | 사용자가 멈춤·점프를 보고해 물리 성능 수락 실패. 나머지 미확인 기능·scanout·물리 resize는 열림 |

**public field:** compiler/VM producer와 App bundling 정책을 분리했다. `windows-hermes-policy.mjs`의 기존 compiler flags·producer 입력은 바꾸지 않는다. 새 syntax identity는 `windows-hermes-260318099.0.7-instance-fields-v1`이며, stock RNW의 구형 syntax는 그대로다. 이전 Windows App의 syntax identity 누락은 실행 전에 거부됨을 확인했다. 현재 v2 Windows App SDK 경로를 검증한 것이며, 다른 direct host/static-AOT 전체 실행을 함께 수락하지 않는다.

**필드 journal:** `markNativeFieldsChanged`는 기존 virtual invalidation hook을 원래의 **인수 0개**로 호출한다. hint는 native callback 전에 소비하므로 재진입에 전달되지 않으며 예외 뒤에도 남지 않는다. capture의 Source baseline과 native accepted record는 분리되어 있다. static semantics의 metadata 재사용 통로는 추가했지만, 아래 네 비교 실행에서 `commandReuses=0`이었다. 이 소비자의 warm encode 감소를 달성했다고 주장하지 않는다.

**cold command 절차:** `RenderProxyBox`, `RenderConstrainedBox`, `RenderPadding`, `RenderPositionedBox`, `RenderAlign`만 exact prototype으로 등록했다. 이 경로는 `NativeBoxConfiguration`과 Scene options를 만들지 않고 기존 codec에 전달한다. Padding/Alignment의 resolver, 자식 capture, mutable constraints의 scalar 읽기, codec 예외는 원래 순서를 지킨다. 자식 capture 재진입에는 깊이별 sink를 재사용하고 finally에서 Source 참조를 비운다. NodeLayout과 실제 명령·handle allocation·wire 검증은 남는다. Flex/Stack/Clip/Transform 등의 기존 data reader와 일반 adapter를 제거하지 않았다.

`projection.moduleCounts`는 **[proxy 초기, proxy 갱신, constraints 초기, constraints 갱신, padding 초기, padding 갱신, alignment 초기, alignment 갱신]**이다. 여기서 초기/갱신은 Source capture entry 기준이며 native accepted allocation 수가 아니다. pass별 `created/captured`, module vector, command encodes/bytes를 함께 기록한다. 한 pass의 신규 owner와 warm owner를 섞어 cold 적용률로 바꾸지 않는다.

**생성기:** `integerGuardFolding`은 정확한 canonical `checkedInteger` import와 생성기 소유 AST 결과에만 적용한다. 괄호·타입 단언 사이의 중복 검사만 접고 산술·getter·사용자 호출을 건너뛰지 않는다. `-0` 정규화·안전 정수 거부·원래 getter/Proxy 평가 횟수와 예외 identity를 보존한다. `_DayState.formatDecimal`의 원래 두 호출, FocusNode·Widget/State 생성과 resolver 호출은 남긴다. 생성 TS는 emitter에서 전부 재생성했으며 손으로 수정하지 않았다.

### 12.2 setter와 adapter의 남은 범위

`Nelyx/src/framework/rendering/*.ts`의 setter 선언 **263개**를 정적으로 목록화했다. 직접/같은 class helper를 따라 필드 mask를 찾은 선언은 **15개**, 넓은 invalidation을 찾은 선언은 **109개**, 다른 setter·manager·상속·생성 코드로 위임하거나 추가 검토가 필요한 선언은 **139개**다. 이는 이 디렉터리의 선언 분모이며 전체 공개 mutation/API 수나 263개 회귀 PASS를 뜻하지 않는다.

| 필드 매핑을 적용한 원래 setter | mask |
| --- | --- |
| RenderConstrainedBox.additionalConstraints (`additional`은 원래 setter로 위임) | constraints |
| RenderPadding.padding/textDirection | layout |
| RenderPositionedBox.shrink/widthFactor/heightFactor | layout |
| RenderAligningShiftedBox.alignment/textDirection | layout |
| SemanticsAnnotationsMixin.properties/container/explicitChildNodes/excludeSemantics/blockUserActions/localeForSubtree/textDirection | semantics + interaction |

나머지 box/Flex/Stack/Clip/Transform, paragraph/Ink/font·mutable paint와 참조, Focus/Gesture의 일반 callback 교체, editor/image/layers/viewport/sliver 등은 기존 full owner·encoder/dependency/fixup 또는 명시적 adapter/거부 계약에 남는다. 139개의 위임 선언은 전수 검토가 끝난 것으로 처리하지 않는다. **W11-01의 전체 setter mapping은 미완료**다.

### 12.3 Source와 projection의 같은 공급 비교

`check-windows-source-comparison.mjs`는 동일한 compiler/VM·날짜/theme/locale·12개월/60Hz·YearMode·resident 정책에서, 같은 JS snapshot을 필드 helper/필드 보존 × reference/direct projection으로 비교했다. reference는 검사 전용 `diagnosticProjection` 선택이다. JS/HBC/manifest 3개만 메모리에서 보존하고 finally에서 원래 bundle을 복구하며 SDK·consumer·profile·로그 파일을 복제하지 않는다.

비교의 기준 JS는 `89eed745fc0c38f5b9e10785da4d669ecb9679687e939b437b29290ce9167f70`이다. 이후 retained Source 연결과 module 초기/갱신 진단을 보강한 최종 bundle과 구분한다. 네 조합 모두 기능·연도/날짜 선택·종료 PASS, 입력 360/360 반영·누락 0, native ring loss 0이었다.

| 비교 조합 | 이동 게시 p95 / 최대 | App build p95 / 최대 | capture p95 / scene p95 |
| --- | --- | --- | --- |
| helper / direct | 150.296 / 222.082ms | 134 / 184ms | 117 / 79ms |
| native field / direct | 83.627 / 167.499ms | 111 / 144ms | 99 / 66ms |
| helper / reference | 81.706 / 131.906ms | 123 / 152ms | 84 / 97ms |
| native field / reference | 124.561 / 209.405ms | 127 / 162ms | 95 / 104ms |

**네 조합 모두 W11 성능 FAIL**이다. 각 조합 1회이므로 일관된 개선율이나 native field 단독 효과를 확정하지 않는다. capture와 scene은 encode가 실행되는 위치가 다르며 서로 다른 pass의 p95를 합하지 않는다. Source App clock은 현재 Hermes의 `date-milliseconds`로 1ms 해상도다. Core QPC와 직접 빼지 않는다.

한정된 cold 형상 비교에서 native/direct pass 96은 신규/captured owner **392/847**, build **129ms**(descendant **125**, render commit **4**), capture/scene **118/75ms**였다. native/reference pass 76의 같은 신규/captured 형상은 **392/847**, build **148ms**(descendant **142**, render commit **6**), capture/scene **112/104ms**였다. 이는 pass 안의 구간 비교이며 실제 같은 월 service time의 전수 분모나 전체 cold 적용률을 대신하지 않는다.

중요한 잔여 원인은 **retained LayoutBuilder의 실제 자손 build**다. 기존 `sourcePreparation`은 authoritative request/observed-window만 기록해 이동 중 긴 retained pass의 `sourceSequences`가 비어 있었다. 이 발견 뒤 기존 ring에 `retained-box`와 종류별 count/elapsed/max를 추가했다. 각 capture timing의 `pass`와 실제 봉인한 Source sequence 목록으로 연결한다. callback의 `built`를 coverage-ready로 취급하지 않으며, publication 관찰은 owner·node/list generation·revision·요청 range·published font/cohort를 검사한다. native demand/provider/activation timing과 물리 display latency는 계속 `notVerified`다.

### 12.4 검증과 현재 공급

- **언어 PASS:** helper/native field를 같은 고정 compiler·VM의 debug/optimized에서 실행했다. 상속 setter 우회, own undefined·descriptor/열거 순서, computed key·symbol·익명 함수 이름, base/derived/super 반환 객체·new.target·교체 superclass·예외 순서, 실제 ES2022 TypeScript parameter property를 포함한다. 실제 전체 Demo App module initialization도 debug/optimized 모두 PASS다.
- **실제 compiler 출력 PASS:** 좁은 필드 fixture에서 debug IR initializer **2회 참조**, optimized HBC의 `DefineOwnById` **2개**와 `NewObjectWithBufferAndParent` **2개**를 확인했다. optimized HBC의 named initializer는 **0**이므로 initializer 함수 호출이 그대로 남았다고 설명하지 않는다. 전체 Windows App의 instance helper는 **3개**다.
- **Source PASS:** 시스템 Dart **3.12.2**에서 전체 **75/75** 선언 `--write --verify`, 이후 `--check --verify`와 원본 Dart oracle **12 dates / 11 inputs / 4 decimal cases**를 통과했다. 생성기와 전체 workspace·CLI 타입 검사를 통과했다.
- **수명/정확성 PASS:** box reference wire와 5개 module/parent fields·resolver/예외·mutable alias·nested sink, incremental capture의 OR/재진입/abort/context, render binding의 callback·generation·NACK/in-flight·fixup, real Core immediate reads/Source reply/취소된 preparation, child reconciliation·GlobalKey, Ink parking, semantics publication/action/lease, LayoutBuilder scheduling, movement verdict oracle를 통과했다.
- **Web 기능 PASS:** threaded(`isolated`)·single-worker(`plain`)에서 12개월 왕복·grid/header·resize anchor·연도 선택·정상 종료를 통과했다. 이 검사는 의도적인 App 지연 주입을 포함하므로 성능 결과로 쓰지 않는다. 처음 연도 검사 실패는 `detail=1` pointer click과 DOM semantic action 경로의 차이였다. 기존 `activate()`와 같은 `element.click()` 접근성 action으로 검사 경로를 맞췄다. 해당 경계는 resize-only 두 profile에서도 따로 통과했다.
- **빌드/공급 PASS:** Core·Material·SDK를 빌드했고 현재 source-map 입력은 각각 **714 / 284 / 133 modules**다. Demo/Testbed Windows/Web 네 bundle을 현재 source로 갱신하고 전체 manifest 파일·ABI/schema/engine identity를 검증했다. runtime/native source가 바뀌지 않아 engine 재빌드는 하지 않았다. engine identity는 `9e03625ee2e2ce1f5f2d5099a387b44033f966805d6753ffdba02caeeb4b1e26`, **360 files**, ABI **2 / schema 313408118**이다.

변경한 수작업 TS/MJS lint·format과 `git diff --check`를 확인했다. 생성 소스의 기존 unused parameter 경고 3개(`intent` 2개, `initialDate` 1개)는 원래 선언에도 있음을 확인했으며 생성물만 수정해 없애지 않았다.

현재 Demo Windows JS는 `fc0b414b12f51a3660b2d1670f9dfcd88d86efba7c1cc9c11ff0955ddef36217`, HBC는 `71619aa457bf7cb3a85aed9a369cbae2587f764b3880a2705eaf0e791fb391d5`다. 아래 최종 Windows 실행은 이 bundle을 그대로 사용한다. retained Source/module 진단을 보강한 뒤 Web resize-only·연도 선택·종료도 두 profile에서 다시 PASS했다. 12개월 왕복 전체는 진단 보강 전의 같은 제품 로직에서 확인한 결과다.

### 12.5 공급 입력의 한정된 불일치와 정리

처음 App syntax를 compiler policy 파일에 추가했을 때 불필요하게 toolchain producer identity가 달라져 engine 준비가 거부되었다. 이를 App 전용 `windows-hermes-syntax.mjs`로 분리해 compiler policy 파일을 원래대로 보존했다. 현재 engine source identity와 배포 파일 무결성은 일치한다.

별도로 현재 `.nelyx/windows-hermes/source`에는 고정 archive에 없는 Gradle 생성 보고서 **3개**가 있다. archive와 추출 tree의 파일명 비교에서 추가는 다음 3개, 삭제는 0개였다: `build/intermediates/prefab_package_header_only/prefab_publication.json/{debug,debugOptimized,release}`. toolchain의 개별 필수 파일 검사는 통과했지만 raw source-tree 검사는 이 상태에서 FAIL이다. native compiler/VM을 새로 재빌드한 근거로 사용하지 않는다.

자동 승인 검토가 이 기존 보고서들의 삭제를 `blocked by policy`로 거부해 그대로 보존했다. 검증 도중 만든 현재 실행 소유 임시 디렉터리와 교체용 이전 dist/staging은 각 checker/build의 finally에서 회수하며, 다른 사용자 cache나 프로세스는 정리하지 않는다. commit은 만들지 않았다.

### 12.6 최종 자동 통합 실행

| 현재 bundle의 Windows 실행 | 기능·연도/날짜·종료 | 이동 게시 지연 p95 / 최대 | 활성 offset 정체 최대 / ≥100ms |
| --- | --- | --- | --- |
| All / 12개월 / 60Hz / YearMode | PASS | **134.809 / 228.177ms — FAIL** | **236ms / 9회 — FAIL** |
| CalendarFast / 역방향 24개월 / YearMode | PASS | notVerified | **295ms / 9회 — FAIL** |
| CalendarContact / 0.4·0.8페이지 양방향 / YearMode | PASS | 별도 resident 접촉 oracle | W11 전체 성능은 notVerified |
| All / 12개월 / 60Hz / YearMode / NoTrace | PASS | notVerified | notVerified |

All은 **360/360 입력 반영·누락 0**, native trace ring loss·output drop **0**이었다. Fast도 120개 접수·거부 0, 요청한 **-24개월**에 도착했다. Contact 네 접촉 각각 36 updates에서 소비된 delta와 offset의 최대 오차는 **8.74e-11px 미만**, 수신→게시 최대는 **18.121–31.862ms**였다. 이는 준비된 범위의 접촉 결과이며 cold 월 생산 성능과 물리 trackpad의 증거로 바꾸지 않는다. 네 실행 모두 정상 close의 **reservedBytes=0 / memoryTotal=0 / workersJoined=true**, App exit 0을 확인했다.

최종 All의 App build p95/최대는 **123/163ms**, capture **110/219ms**, scene **86/119ms**였다. 이 histogram은 마지막 128개 pass이며 서로 더하지 않는다. pass **135**는 신규/captured owner **398/845**, build **163ms** 중 retained scope **162ms**(descendant **154**, render commit **8**), capture/scene **107/81ms**였다. Source sequence **94·95**가 이 pass에 봉인됐고 sequence 95의 retained-box 실행 **154ms** → accepted document **133** → publication **242** 관찰을 연결했다. 해당 pass의 고정 module은 constraints 초기 **5**, padding 초기 **33**, alignment 초기 **38**, command **81개 / 16,128 bytes**였다. 전체 binding **714개**에는 이 고정 module **76개**가 포함되며, adapter는 **131개**였다. 이것은 모듈 호출 분모이며 전체 owner의 의미 검토 완료 비율이 아니다.

All Source **166개** 중 retained-box는 **79개 / 2,287ms / 최대 154ms**였고, 전체 retained builder 누적은 descendant **2,315ms**, render commit **109ms**였다. Source ring overwrite **38개**, 그중 pending chain overwrite **2개**를 기록했다. 종료 결과는 published-coverage **109**, declined **2**, cohort-changed **50**, closed **3**, 현재 pending **0**이다. 따라서 성공 관찰만 골라 demand→coverage p95를 제시하지 않는다. Fast는 pending overwrite 0이지만 close로 끝난 chain **33개**를 포함한다. native demand/provider-ready/activation 시각과 실제 대상 월의 coverage-ready p95/최대는 여전히 **notVerified**다.

이 결과로 **§6.3의 설계 효용 PARTIAL**을 유지한다. 원래 retained LayoutBuilder 자손 build 자체가 refresh·준비 여유보다 길며, 해당 pass의 capture/scene도 남아 있다. 다음 구현에는 이 원래 Element/Material/Ink·Semantics 자손 경로와 남은 adapter의 반복을 소스에서 더 줄이는 설계가 필요하다. 현재 field helper 제거·5개 모듈 투영·좁은 정수 guard 축소만으로 W11 성능을 수락하지 않는다. 입력·200ms 원본 animation·기본 4페이지 resident 정책은 변경하지 않았다.

### 12.7 실제 트랙패드 확인과 최종 경계

같은 최종 bundle의 Manual 실행에서 사용자는 **“스크롤을 매우 빠르게 하면 멈춤 점프있음”**을 보고했다. 따라서 실제 빠른 스크롤의 성능·사용감 수락은 **실패**다. 날짜 선택·OK·물리 resize의 정상 여부는 사용자가 별도로 확인하지 않았으므로 물리 기능 PASS로 확대하지 않는다.

DirectManipulation 물리 입력은 **195개 접수 / 거부 0**, end **17개 / moving end 17개**였다. 같은 물리 활동 구간의 App turn **224개**는 p95/최대 **269.683/352.259ms**, ≥100ms **22개**, ≥250ms **15개**였다. 실제 입력이 포함된 native publication 공백은 **211.810ms**(3개 입력의 span **22.055ms**, document **68→68**)와 **145.687ms**(2개 입력의 span **17.684ms**, document **82→82**)를 관찰했다. 이 값은 native 수신/게시의 소프트웨어 시각이다. 사용자의 손이 움직인 전체 시간·물리 샘플 시각·scanout 지연이나 점프의 모든 원인으로 해석하지 않는다.

물리 실행의 retained-box는 **77개 / 3,096ms / 최대 168ms**, 전체 retained builder의 descendant/render commit 누적은 **3,030/126ms**였다. App pass 105는 신규/captured **395/854**, build **129ms** 중 descendant **123ms**, capture/scene **223/103ms**로 Source 뒤의 투영 비용도 남았다. Source **106개**는 published-coverage **71**, declined **2**, closed **33**, pending·overwrittenPending **0**이었다. 이 실행 역시 native demand/provider-ready 인과를 완성한 것은 아니다.

Manual의 전체 ring loss·output drop은 **0**, 최종 queue **0**, 오류 목록은 비어 있었다. 정상 close 후 **status=0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true**, CLI·App exit 0을 확인했다. 자동 checker의 Manual `functional/physicalTrackpad=notVerified`는 전수 기능·성능 판정이 없다는 뜻이며, 위 사용자의 실제 물리 실패 보고를 덮지 않는다.

현재 결과는 **PARTIAL**, **compatible=false**, **performanceAccepted=false**, **resizePerformanceAccepted=false**다. W11-1의 좁은 언어/생성기·5개 cold 모듈·App 연결과 기능 회귀는 구현·검증했지만, §3.3·§5.2의 일관된 성능 효용과 §6.3의 refresh 예산은 수락하지 못했다. 전체 setter/adapter·Focus/Gesture/Ink 참조 확대, 실제 native demand→provider-ready→activation 연결, UIA 비청취/늦은 접속/reader·editor 재진입, 원본 visual·scanout·물리 resize 성능과 §10의 다른 제품/플랫폼 의무는 계속 미완료다. 다음 변경은 남은 원래 Element/Material/Ink 자손 실행과 capture/scene의 반복 작업을 소스에서 줄이는 설계부터 이어야 한다. 이미 철회한 객체 revision/cache, 원래 호출 생략, resident 창 확대나 입력 감속으로 실패를 숨기지 않는다.

## 13. 실제 실패 피드백 이후 계속 구현

### 13.1 새 자동 입력 조건

Windows checker의 기본값을 **`-GestureSpeed 3`**으로 변경했다. 이동 거리와 표본 수는 유지하고 고해상도 native 주입 시각을 1/3로 줄인다. 연속 12개월은 **360 updates / 목표 2초 / 180Hz 입력**이며, 화면의 성능 기준은 계속 **60Hz / p95 33.3ms / 최대 66.7ms / 활성 offset ≥100ms 0회**다. Fast 재접촉과 0.4/0.8 contact에도 같은 시간 배율을 적용하고 실제 시간·driver lateness·배율을 출력한다. stationary lift의 100ms는 거리 검사를 fling과 분리하기 위한 기존 terminal 조건으로 유지한다. 과거 1배속과 대조할 때만 `-GestureSpeed 1`을 명시한다.

Web precision checker도 기본 3배속이며 `--gesture-speed=1`로 과거 조건을 선택할 수 있다. 같은 6 updates / 600px의 목표 시간은 **96→32ms**, packet velocity는 3배다. RPC 대기 때문에 실제 시간이 더 길어질 수 있어 `DATEPREP`에 목표·실제 active 시간을 함께 출력한다. Web의 기존 60/120ms App 지연 주입은 correctness 부하이며 물리 입력이나 3배속 성능 수락을 대신하지 않는다.

### 13.2 반복 할당 제거

Element·Material·Ink·Focus 및 capture/관찰 코드의 호출 소유권을 다시 읽었다. 현재 코드의 날짜 문자열은 기본 localization 배열과 숫자 변환이며, 임의 localization 호출이나 Focus/State 구성을 생략하는 후보는 적용하지 않는다. 기존 bounded CPU 진단 1회에서 Young GC self **253/1,246 samples**, 전체 기록의 GC CPU/시간과 큰 관찰·Map 처리 비중을 확인했다. 이 실행의 성능 수치를 새 기준 수락이나 단일 GC가 모든 정체의 원인이라는 근거로 쓰지 않는다.

- capture의 빈 registration/dependency Map은 불변 sentinel을 쓰고 실제 첫 쓰기에서만 private Map을 만든다. dependency consumer가 없는 invalidation에는 visited Set을 만들지 않는다. field OR·재진입·cycle·실패 복구는 유지한다. 부모의 render-child sequence가 같은 경우 retirement membership Set도 만들지 않는다.
- ObservationStream은 바뀐 row overlay로 immutable 공개 배열을 조립하고, 전체 응답 검증이 끝난 commit에서만 기존 private row index를 갱신한다. 매 delta의 전체 row Map 복사를 제거한다.
- immutable 등록 수명은 영향을 받은 owner의 이전/새 reference만 private count로 증감한다. 같은 reference 목록과 무관한 전체 등록 ID를 다시 순회해 live Set을 만들지 않는다. full resync·삭제·generation 재사용·quota 거부·close의 기존 수명 계약을 유지한다.

국소 capture/재진입·cycle/참조/parking/ACK, real Core immediate reads, 64/2,048-node 전체 관찰 oracle·불변 snapshot·resync·quota·종료와 packet 소유권 검사는 PASS다. 새 실제 공급에서 3배속 통합 결과를 이어서 기록한다.

### 13.3 공통 provider 공급과 Gradle 보고서 보존

관찰 stream은 App뿐 아니라 공통 provider graph에 포함된다. 따라서 이 변경 뒤 기존 engine과의 source identity 검사가 거부되는 것은 정상이며, 기존 engine hash에 새 App만 붙여 최신 공급이라고 수락하지 않는다. Core와 네 App 빌드는 한 번 통과했지만, 이후 통합 검사는 최신 engine 재생성까지 보류한다.

기존 raw source 불일치의 정확한 원인인 Gradle 보고서 3개는 **삭제하지 않고 보존**했다. [windows-native-hermes-source.mjs](Nelyx/sdk/tooling/cli/src/windows-native-hermes-source.mjs)에서 원래 4개 Android 출력 디렉터리 규칙에 더해, 정확한 `build/intermediates/prefab_package_header_only/prefab_publication.json/{debug,debugOptimized,release}` **regular file 3개만** 생성 metadata로 구분했다. 같은 이름의 디렉터리·링크와 다른 파일은 제외하지 않는다. 고정 archive의 해당 경로는 0개이고, 이 규칙의 현재 source hash는 기존 기록 **`2cdd4ce7ff07f9c0a9a4c1ca3b5485df446a95a8efd2941b2bde0ff4bb3963a2`**와 정확히 일치했다. 실제 C++/JSI 소스나 compiler flags를 변경한 것이 아니다.

[check-hermes-source-identity.mjs](Nelyx/eng/check-hermes-source-identity.mjs)는 정확한 보고서·예상하지 못한 추가 파일·원본 수정·같은 이름의 디렉터리·링크 거부를 검증하고 소유 temp를 finally에서 회수한다. producer 변경은 정상 toolchain 준비 절차에서 archive 재대조와 compiler/VM·JSI 공급 검증을 거친다. §12.5의 raw 검사 FAIL은 이 보완 전의 기록이며, 새 producer·engine 공급의 최종 결과를 이어서 기록한다.

정상 `prepareNativeHermes`에서 고정 archive를 다시 추출·현재 patch와 전수 대조하고, CMake configure·빌드(`ninja: no work to do`)와 35개 필수 파일·ICU·source tree 검증을 PASS했다. compiler/VM·JSI를 새 코드로 바꾼 것이 아니라 같은 바이너리를 새 producer **`d7c8ab389c9aa938450bdc384f2a03242cbad68515e6697616fd00a5856f9296`**로 재검증했다. 이어서 native/MSVC·single-worker·threaded/Emscripten **4.0.22** 및 Windows App SDK의 정상 engine 공급 빌드를 PASS했다. 최신 engine source identity는 **`9f5fed8791795832cff211a04db894835569c0b338cdde12018c242328a6f2bd`**, ABI/schema는 **2 / 313408118**이다. 소유 source-check와 engine staging/이전 dist는 finally에서 회수했다.

### 13.4 첫 3배속 결과와 paint 없는 경로 정리

반복 할당/관찰 갱신 뒤 Core와 네 App을 새 engine으로 갱신했다. 이 단계의 Demo JS는 `ca34e6b5637d88bc6c3e6a58699cd2fceef2bcda2508b05b5b9301cab9cc6658`, HBC는 `a6c125c4f0461b855191fd7832b636bcdbeab93051cb9de660581c423fbc6aaf`다. **Calendar / 12개월 / GestureSpeed 3 / YearMode**에서 360 updates를 **2,000.114ms**, 요청 **180Hz**로 전달했다. driver lateness p95/최대는 **0.514/2.755ms**, 누락·거부 0, 실제 **12개월 이동·연도/날짜 선택·정상 종료 PASS**였다.

이동 게시 지연 p95/최대는 **451.018/514.239ms**로 **FAIL**이다. 입력 360개는 모두 반영됐지만, 새 속도의 수요를 생산/투영이 따라가지 못한다. build p95/최대 **99/131ms**, capture **96/230ms**, scene **74/120ms**였다. 마지막 전체 110 pass의 수치로 active 구간만의 비용이나 서로 같은 pass 합계는 아니다. 이전 1배속과 성능 개선율로 비교하지 않는다. native ring loss·output drop 0, close의 reserved/memory 0·workers joined·App exit 0을 확인했다.

다음 소스 검토에서 `captureNode`가 paint 없는 box·semantics·focus에도 빈 rrect shape·8개 값 배열·두 paragraph key 배열·sequence closure를 무조건 만드는 것을 확인했다. 고정 빈 shape는 private 불변 상수로 두고, sequence closure는 실제 paint 경로 안에서만 만들며 paragraph key 표는 실제 paragraph entry를 처음 만나면 만든다. Source resolver·자식 capture·paragraph capture·예외·참조 순서는 유지한다. Ink parking/복원·live/static/empty paint·semantics publication 국소 검사는 PASS했으며, 현재 Demo Windows를 이 변경으로 갱신해 남은 Source/capture CPU 범위를 확인한다. 효과 수락은 아직 하지 않는다.

### 13.5 Codec 중복 읽기와 준비 시점 후보 — 준비 시점은 철회

paint 없는 경로 정리 뒤 동일한 3배속 Calendar CPU 진단 1회에서도 360/360 입력 반영·기능·정상 종료는 PASS였으나 이동 게시 지연 **496.372/562.874ms**로 FAIL이었다. CPU 표본 460개 중 Young GC self 70개였고, Source/capture stack 안에서도 각각 15/21개였다. 전체 프로파일의 할당량은 **732,878,200 bytes**, 최대 GC pause **13.777ms**였다. 구간·실행 길이가 다른 이전 프로파일과 개선율로 비교하지 않으며, GC 하나가 수백 ms 지연을 전부 설명한다고 해석하지 않는다.

다음 코드 분석으로 두 묶음을 적용했다.

- `originalParagraphInput`은 `paragraphOptionsBytes` 내부 검증용 decode 뒤 같은 bytes를 다시 decode했다. 새 `captureParagraphOptions`는 **같은 codec의 검증 결과**를 반환해 두 번째 decode만 없앤다. encoder·wire·예외·UTF-8·run/strut/probe 검증은 그대로이며 별도 완화된 normalizer나 Source cache를 만들지 않는다. 기존 binding differential에 옵션·rich run·strut·probe·거부·mutable producer 독립성 검사를 추가해 PASS했다.
- render edge의 ParentData는 기존 순서로 읽되, 기본 edge의 비교에 빈 options 객체와 JSON 변환을 만들지 않는다. Flex/Stack의 실제 값은 기존 JSON 직렬화로 비교한다. instance hook 검사 이름 배열도 private 상수로 옮겼다.
- **철회한 후보:** Core의 page preparation을 contact 중 최대 4페이지 한도 안에서 이르게 요청하도록 바꿨다. C++의 visible 포함·4페이지 한도·pause/reverse/finite extent 검사는 PASS했고 통합 공급도 빌드했지만, 실제 Web에서는 원래 3개였던 상주 월을 4개로 유지했다. 이 정책 차이와 미수락 성능 때문에 **§13.7에서 원래 코드로 전부 복구**했다. 한도 4 유지가 원래 상주 동작 보존을 뜻하지 않음을 확인했다.

Scene에서는 reference 없는 cold binding의 이미 봉인한 program을 다시 배열로 복사하지 않는다. 빈 accepted child 배열과 config-input Map은 불변 private sentinel을 공유하고, retained 자식의 count/height/geometry/cacheable 요약은 임시 배열·여러 reduce 대신 한 순회에서 계산한다. wire·reset·callback·reference fixup·NACK·in-flight·parking 검사는 PASS다.

Core·native/MSVC·single-worker/threaded Wasm·Windows 공급과 네 App bundle을 갱신하고 manifest 파일·ABI/schema를 검증했다. 이 단계의 engine은 **`5b6b01e66f695a73e1bbfa64ced72a6e62b57f9222d52bc000d5f6045be63b86`**, Demo Windows JS/HBC는 **`03bd80a1a16f1ca9623ffbd0ebfa72025807c0068631eaf735ccdcb063a5d048` / `6b6f8f3d109c4efeb4a0f59056fd2b7d553f1c68b0f3276c295f641100d8d1d1`**다. 3배속 Calendar/YearMode의 360 updates는 **2,000.436ms**, driver lateness p95/최대 **0.503/4.466ms**, 반영 360/누락·거부 0, 12개월 도착·날짜 선택·정상 종료 PASS였다.

이동 지연 **440.661/466.452ms**, 활성 offset 정체 최대 **332ms / ≥100ms 7회**로 여전히 FAIL이다. publication 공백 최대는 **46.081ms**여서 게시가 계속되는 동안 준비된 실제 offset이 따라오지 못한 실패와 구분한다. active App turn p95/최대는 **228.874/302.302ms**였다. 전체 pass의 build/capture/scene p95는 **113/119/78ms**이며 resize와 YearMode도 포함한다. active pass 44는 신규/captured **353/1,022**, build **124ms**(descendant **118**), capture/scene **103/55ms**였다. 한정된 1회 비교로 일관된 개선율이나 4페이지 활용만의 효과를 확정하지 않는다. ring loss/output drop 0, close reserved/memory 0·workers joined·App exit 0을 확인했다.

### 13.6 Native paragraph의 계속 켜진 TS cache dirty 조건

그 다음 Source 검토에서 `RenderRichParagraph.config`가 실제 입력 변화와 무관하게 `TextPainter._needsLayout`을 새 layout 변경으로 취급하는 것을 확인했다. native paragraph는 TS layout을 수행하지 않아 이 getter의 `cache === undefined`가 계속 참이다. 따라서 동일 내용의 새 Source config도 매번 layout mark·native capture·encode로 이어진다. plain text의 semantics 재사용 역시 TS pipeline에서 실제 describe한 cache만 허용해 native owner에는 적용되지 않았다.

기존 TextPainter의 **inputRevision**을 configure 전후에 읽어, 새로운 입력 변경과 TS cache 부재를 분리했다. 새 counter나 Source scalar snapshot/revision cache를 만들지 않는다. 새 config의 resource 검증·span/style compare·painter setter는 원래대로 실행한다. 이 최적화는 실제 framework constructor로 만든 exact native paragraph, 기존 capture 소유권이 확인된 style/span/scaler와 닫힌 painter 옵션, 원래 invalidation/semantics hook에만 적용한다. 사용자 Paint·custom style/scaler/span·외부 Locale/strut·subclass/Proxy·instance/prototype getter hook은 기존 전체 경로다. TS layout/semantics cache가 생겼다고 표시하지 않으며 일반 TS renderer의 cold-cache 동작도 보존한다.

새 [check-native-paragraph-update.mjs](Nelyx/eng/check-native-paragraph-update.mjs)는 현재 source를 직접 bundle해 동일 config의 새 객체 적용·wire·실제 Source semantics, text/style/scaler/font/direction/locale/options 변경·stale font 거부, 일반 renderer·mutable/custom 입력·hook/getter 순서·Proxy fallback을 PASS했다. Core와 네 App을 갱신했다. 이 변경은 engine provider graph 밖의 App framework이므로 실제 `sourceIdentity()`가 위 engine identity와 계속 같음을 확인했다.

이 paragraph 후보를 포함한 Demo JS/HBC는 **`4eb5f38216d66533f7f622625a40e486b09219463bd5bbf3160fadcdfef444fd` / `cb1f702eb0921a592baa5b476ee65527b489f341708c0101577475caf0aec3bb`**였다. 같은 3배속 Calendar/YearMode에서 360 updates **2,000.128ms**, driver lateness p95/최대 **0.519/0.623ms**, 360개 반영·누락/거부 0·12개월 도착·날짜/연도·종료 PASS였다. 전체 capture p95는 직전 119ms에서 **71ms**였지만, 이동 지연 **500.321/553.899ms**, 활성 offset 최대 **339ms / ≥100ms 8회**로 성능 FAIL이다. build p95/최대 **113/137ms**, scene **76/120ms**, active App turn **186.633/258.852ms**였다. pass 46·48은 신규/captured **764/789**, **767/776**인 두 cold 월 형상이며 build/capture/scene **129/64/91ms**, **113/74/120ms**였다. 단일 실행의 p95 차이를 인과 개선율로 확정하지 않는다. 정체 해결과 native coverage 인과는 계속 미완료다.

### 13.7 Web 상주 회귀와 준비 시점 후보 철회

위 공급의 Web isolated precision/3배속 첫 이동 후 accepted nodes가 **1,787→2,157(+370)**, Elements가 **4,455→5,443(+988)**로 늘었다. Core range는 초기 3개월에서 contact 뒤 4개월을 계속 유지했다. 기존 `Calendar nodes accumulated` 검사에서 FAIL했고, 정상 finally에서 reserved **0 / workersStopped=true**로 종료했다. plain profile은 이 실패로 실행되지 않았다. 의도적인 App 지연 때문에 Web 실제 6 updates 시간은 **86.240ms**로 목표 32ms를 넘었으며, 3배속 성능 PASS로 사용하지 않는다.

이 실패는 노드 검사 상한을 완화하지 않고 처리한다. page range 변경과 그 전용 C++ 변경은 전부 원래대로 복구해 해당 두 파일의 최종 diff는 **0**이다. Source/capture/codec/관찰/paragraph 수정은 유지하고, 원래 resident 정책의 native/Wasm/Windows 공급을 다시 빌드해 네 App과 Web 두 profile을 재검증한다. 전체 workspace 타입 검사, 변경 수작업 파일 **31개** format/lint, `git diff --check`는 이 복구 직전 PASS였으며 source/package 입력은 Core/SDK/Material **714/133/284 modules**다.

복구 뒤 정상 native/MSVC·single-worker/threaded Wasm·Windows App SDK 빌드와 네 App 재생성·전체 manifest 검증을 PASS했다. 현재 engine identity는 **`acf978fd0eba77ecd9c8890d81c640e7b3296927a016b7d154c11ee0ecd45753`**, 360 files / ABI **2 / 313408118**이다. 현재 Demo Windows JS/HBC는 **`4eb5f38216d66533f7f622625a40e486b09219463bd5bbf3160fadcdfef444fd` / `f7a30928f29d1dde90c33fed0f603dd2edad3fa98a049f60270abc04a5645528`**다. Testbed Windows JS/HBC는 **`66f0e69d634f4bfdf7a0aa12e3372029c2f023a43e2b3971a72f4f122d412fae` / `df9e11badebd5a1d868007d80e60961b55b6d91dac9642f1344c32e46bb83877`**이다. Core/SDK/Material source-map 입력 **714/133/284**도 현재 source와 일치했다.

**Web 두 profile 기능 PASS:** isolated와 plain 모두 12회 왕복·header/grid·원래 node/Element/semantics/builder 상한·resize anchor·연도/날짜 선택·정상 종료를 통과했다. baseline/12회 뒤 nodes·Elements는 각 **1,787 / 4,455**로 돌아왔고, resize 뒤 nodes **1,877**은 기존 허용 범위다. 두 close 모두 reserved **0 / workersStopped=true**다. 24개 가상 gesture는 목표 **6 updates / 600px / 32ms**이며 실제 active **55.465–146.300ms**였다. 의도적인 App 지연/RPC를 포함한 기능 검사로, 실제 3배속 성능 수락은 아니다.

**현재 Windows All / 12개월 / 60Hz display / GestureSpeed 3 / YearMode:** 기능·12개월 도착·연도/날짜·정상 종료 PASS, 360 updates를 **2,000.332ms**, driver lateness p95/최대 **0.515/1.682ms**로 전달했다. 반영 **360 / 누락·거부 0**, ring loss/output drop **0**이다. 이동 지연 **423.007/504.921ms — FAIL**, 활성 offset 정체 **최대 324ms / ≥100ms 8회 — FAIL**이다. active App turn p95/최대는 **187.518/291.101ms**, 마지막 128 pass의 build/capture/scene p95는 **100/58/74ms**다. pass 110은 신규/captured **778/803**, build **123ms**(descendant **116**, commit **7**), capture/scene **63/127ms**인 두 cold 월 형상이다. 다른 실행·서로 다른 pass의 p95를 더하거나 개선율로 확정하지 않는다.

Source 137개는 published-coverage **89**, declined **4**, cohort-changed **41**, closed **3**, pending·overwrittenPending **0**이었다. native demand/provider-ready 시각과 scanout은 계속 notVerified다. 정상 close의 reserved/memory **0**, workers joined·App exit **0**을 확인했다. 최신 Fast/Contact/NoTrace·물리 입력 검사는 이번 공급에서 새로 수행하지 않았다. **목표는 active / PARTIAL / performanceAccepted=false**이며, 다음 분석 대상은 두 cold 월의 원래 자손 build와 scene 제출/관찰을 포함한 처리량이다. §13.5의 준비 창 후보를 다시 확대하거나 검사 상한을 완화해 완료 처리하지 않는다.

### 13.8 문단별 폰트 accounting snapshot 제거

`OriginalWidgetHost.paragraph`와 App text 입력은 폰트 목록을 읽을 때마다 전체 backend snapshot을 만들고 있었다. native snapshot은 폰트 세대 확인 외에도 수십 개 JSI 속성·버퍼/asset/network/owner 사용량 집계를 수행한다. 목록만 필요한 경로에 선택적 **`fontFamiliesVersion=1` / `fontFamilies(revision)`** capability를 추가했다. native와 Web 모두 매 조회에서 살아 있는 세대를 검증하고 새 목록/Set을 반환한다. 폰트 목록을 서비스에 cache하거나 retirement 검사를 생략하지 않는다. 기존/custom backend는 capability와 method가 모두 있을 때만 전환하며, `execution`과 폰트 관찰의 accounting snapshot은 계속 현재 값을 읽는다. App text version **12**, wire ABI/schema는 유지한다.

새 [check-app-font-families.mjs](Nelyx/eng/check-app-font-families.mjs)는 legacy optional getter 비관찰·method 없는 capability fallback, hot 조회의 accounting 미접근, 반환값 독립성, 실제 Web staging/rollback/commit/이전 세대 retirement·종료 거부, 문단 family 선택과 native owner/revision 전달을 PASS했다. Core·native/MSVC·single-worker/threaded Wasm·Windows host와 네 App을 정상 빌드·검증했다. engine은 **`d559ad327337a8a7a354fdf6c7f82f411edbf4bd126c597a4c8f2e218fc58d32` / 360 files / ABI 2 / schema 313408118**이다.

폰트 변경만 포함한 Windows 3배속 All은 **360/360 반영·누락/거부 0**, 실제 **2,000.309ms**, driver lateness **0.519/1.339ms**, 12개월·연도/날짜·정상 close PASS였다. 이동 지연 **434.570/512.097ms**, 활성 offset 정체 **최대 304ms / ≥100ms 8회**로 FAIL이다. 비용 제거 자체와 정체 해결을 구분한다. 이어 한 번의 3배속 Calendar CPU 진단은 표본 **448개**, 그중 Young GC **76개**였다. GC report의 누적 allocation은 **693,162,440 bytes**, 최대 pause **13.286ms**다. startup을 포함한 진단 범위이며 단일 GC가 수백 ms 정체를 만들었다고 판정하지 않는다. Source/capture/Scene의 포함 표본은 서로 중첩되어 더하지 않는다. profile/로그 파일은 누적 저장하지 않았다.

### 13.9 grid의 고정 Source wrapper 투영과 현재 통합 결과

남은 grid tile/row wrapper는 SDK가 직접 만든 `OriginalNativeNode`인데도 일반 producer로 처리되어 범용 Scene snapshot·encode를 거쳤다. 이 고정 adapter를 기존 Source capability로 연결했다. 실제 Widget·Element·State·RenderObject·key·child delegate 실행은 그대로다. `sliverChildren`·`keepAliveChildren`·`sourceCollectionIndex`·`parkedChildren`·`onChildrenInvalidated`는 원래 render options에 보존하고 native wire 옵션에서만 제외한다. key/rest getter 평가 순서와 실제 회수 callback도 유지한다. 일반 producer로 update하면 기존처럼 capability를 철회한다.

grid의 이미 깊이 불변으로 봉인한 숫자 layout policy는 기존 per-reference part journal에서 identity로 재사용한다. 새 Scene/Source cache를 만들지 않으며, 가변 배열·객체·참조 handle은 매번 기존 codec/fixup 경로다. Scene의 command-kind Map은 임시 tuple 배열 없이 작성하고, handle 동등성은 기존 scalar 판정으로 비교한다. config snapshot의 cycle Set은 실제 object 순회 때 만들며, ACK 적용의 changed/removed·retirement 집합도 불필요한 중간 배열 없이 같은 순서로 구성한다.

[check-render-bindings.mjs](Nelyx/eng/check-render-bindings.mjs)의 reference wire·reset·전환·callback·key/rest getter·mutable policy·참조·generation·NACK·in-flight 검사는 PASS다. [check-viewport-grid.mjs](Nelyx/eng/check-viewport-grid.mjs)는 실제 Core와 원본 generated getLayout을 대조해 resize/DPR2/text scale/RTL/부분·빈 grid·한 transaction·builder reply 없음·keyed State/update/controller·잘못된 viewport 거부를 PASS했다. policy 수명 검사는 이제 accepted record의 생략된 options 대신 **실제 Source render의 두 program**을 확인해 빈 목록으로 통과할 수 없게 했다. incremental capture·전체 workspace 타입·변경 수작업 TS/MJS **38개** format/lint와 `git diff --check`도 PASS했다.

Core와 네 App을 재생성하고 전체 파일 hash·supply·ABI 및 Core/SDK/Material source-map 입력 **714/133/284 modules**를 검증했다. 위 engine identity는 그대로이며, 현재 Demo Windows JS/HBC는 **`6d5ef9d5cedcf2d29fc44e12174e7d5c8b19d2240717239bb8448a8a56539439` / `61f663e8a9ffe844fdcb52a05be3917a4317cc12569a7e14431fa1455d06101c`**다. Testbed Windows JS/HBC는 **`532e582b631937f8ddded39f27533618a5e112c7bf37c7b9cd0a9bde082e3bd6` / `c2c03343228e5222279bb5a97bba625f33a5945aa025be9ac71f587638cbc711`**이다. pinned Hermes/compiler flags·200ms animation·실제 resident 정책은 변경하지 않았다.

| 현재 bundle / 3배속 | 기능·목적 월·연도/날짜·종료 | 이동 지연 p95 / 최대 | 활성 offset 정체 최대 / ≥100ms |
| --- | --- | --- | --- |
| Windows All / 12개월 / display 60Hz | PASS | **473.338 / 523.454ms — FAIL** | **302ms / 9회 — FAIL** |
| Windows CalendarFast / 역방향 24개월 | PASS | notVerified | **291ms / 3회 — FAIL** |
| Windows CalendarContact / 0.4·0.8 양방향 | PASS | 별도 prepared-range 접촉 oracle | 전체 W11 성능 notVerified |
| Windows All / 12개월 / NoTrace | PASS | notVerified | notVerified |

All은 **360 updates / 2,000.279ms / 180Hz**, driver lateness **0.509/0.600ms**, 반영 **360 / 누락·거부 0**이었다. 실제 publication 공백 최대는 **29.524ms**지만 offset이 움직이지 않는 구간은 위와 같이 길다. active App turn **160.480/252.104ms**와 구분한다. cold pass 103은 신규/captured **784/796**, bindings/adapters **789/7**, build **102ms**(descendant **99**, commit **3**), capture/scene **67/99ms**였다. pass 115는 신규/captured **767/791**, bindings/adapters **785/6**, build **141ms**(descendant **139**), capture/scene **73/74ms**다. 직전 비슷한 두 cold 월 형상의 adapter 89–91개보다 줄었지만, 원래 자손 build와 end-to-end 정체는 해결되지 않았다. 마지막 128 pass의 build/capture/scene p95 **102/53/65ms**는 resize·연도 선택도 포함하며 더하지 않는다. 단일 실행의 차이를 인과 개선율로 제시하지 않는다.

All Source 140개는 published-coverage **88**, declined **3**, cohort-changed **45**, closed **4**, pending·overwrittenPending **0**이었다. Fast는 moving release **12 strokes / 96 updates / 836.055ms**, **120개 접수 / 거부 0**, **-24개월** 도착을 확인했다. Contact 네 구간은 각 **36 updates / 실제 200.285–200.588ms**, 소비 delta와 실제 offset 오차 **8.74e-11px 미만**, 수신→게시 최대 **11.752–16.330ms**였다. 준비된 범위의 반응을 cold 월 생산 성능이나 실제 트랙패드 수락으로 확대하지 않는다. 세 실행 모두 ring loss/output drop **0**, 정상 close의 reserved/memory **0**, workers joined·App exit **0**이다.

별도 NoTrace All도 **360 updates / 실제 2,000.450ms / 12개월**·연도/날짜·기능·정상 close PASS다. 이 옵션은 native input trace를 끄며 App의 bounded 진단 전체를 끈 검사가 아니다. 게시 지연·offset 정체는 notVerified이고, reserved/memory **0 / workers joined / App exit 0**을 확인했다.

최신 Web isolated/plain 두 profile도 12회 왕복·header/grid·기존 node/Element/semantics/builder 상한·resize anchor·연도/날짜·종료 PASS다. baseline/12회 뒤 nodes/Elements는 **1,787/4,455**, resize 뒤 **1,877/4,545**였고 두 close 모두 reserved **0 / workersStopped=true**다. 24개 gesture의 목표 **6 updates / 600px / 32ms**, 실제 active **45.400–112.495ms**는 의도적인 App 지연/RPC가 있는 기능 검사다.

**계속할 경계:** 목표는 **active / PARTIAL / performanceAccepted=false**다. 다음에는 긴 원래 자손 build의 담당 코드와, 해당 작업을 기다린 **native demand→provider-ready→activation→실제 offset**을 기존 identity로 연결하는 §7의 미완료 경계를 함께 다룬다. 현재 App Date clock과 native QPC를 빼서 critical-path 지연을 꾸며내지 않는다. lifecycle·사용자 호출을 생략하거나 resident 창·허용 지연을 늘리지 않는다. 실제 물리 입력/scanout·물리 resize, UIA 전체 소비자와 §10의 전체 제품/플랫폼 의무는 여전히 미완료다.

### 13.10 공통 시계의 준비 단계 연결과 상태 관찰 비용 축소

먼저 scheduler의 builder continuation·provider gate·coverage 검사·activation·deferred offset과 Source 실행 순서를 분석했다. 문서 교체로 같은 preparation ID가 계속될 수 있고, 게시가 계속돼도 준비된 offset 경계에 머무를 수 있었다. 원래 resident 정책·200ms animation·입력 거리·compiler/VM은 유지했다.

Source 진단은 host가 명시한 native clock domain을 SDK에서 협상한다. Windows에서는 기존 **QPC milliseconds**를 그대로 사용하고, 해당 선언이 없는 host는 기존 App 시계를 유지한다. native Core mutex 안에서 owner/generation과 preparation/document/metrics/device/font, builder request/node/revision/list generation/range, 준비·active·published cohort와 viewport coverage를 숫자만 복사한다. wire/schema는 바꾸지 않았다. Windows의 trace-on 경로만 **128 cohort / cohort당 request 4개 / viewport 16개**의 bounded journal에 접는다. 최초 관찰은 dispatch 시작/끝 **구간**이며 정확한 demand 생성 시각으로 부르지 않는다. 계속된 문서·superseded·게시·close, pending/overwrite·역순·truncated를 구분하고 넓은 identity는 decimal string으로 출력한다.

새 [preparation_journal.hpp](Nelyx/engine/platform/common/preparation_journal.hpp), [check-preparation-journal.cpp](Nelyx/eng/check-preparation-journal.cpp), [windows-preparation-chain.mjs](Nelyx/eng/windows-preparation-chain.mjs)는 optional 진단의 protocol byte 동등성, layout/provider gate·activation·publication·close, 같은 preparation의 새 문서, 2^53보다 큰 ID, generation/range·공통 clock·모호한 cohort 거부와 bounded 기록을 검증했다. native 구간끼리의 차이는 양쪽 관찰 오차를 보존한다. 첫 All 실행의 PowerShell UTF-8 BOM 처리 오류는 수정하고 실제 Windows PowerShell 파이프와 국소 검사를 통과했다. 그 실행의 기능/성능 결과는 유효하지만 진단 후처리 exit 1을 PASS로 바꾸지 않는다.

App 관찰 행은 이미 재료화한 parent/resource/BigInt/rect/matrix/coverage를 읽을 때마다 내부 callback closure를 만들고 있었다. callback 없는 고정 decoder로 바꾸고 cache 객체는 첫 복합 값 조회 때 만든다. eager 숫자 검증, private backing, frozen 값의 객체 동일성, 0n/null, snapshot 재배치·이전 reader 수명은 그대로다. 폰트 상태 통지 역시 매번 전체 accounting snapshot을 요청하므로, 협상된 live-generation 조회가 있으면 이를 사용한다. backward active-revision 검사와 실행 진단의 전체 snapshot, legacy/custom backend fallback은 유지한다. immutable observation/full oracle·64/2048 rows·quota/resync/close, 폰트 stage/rollback/commit/retirement·live 상태 통지·counter 격리 검사를 PASS했다.

정상 Core/SDK·MSVC/single-worker/threaded/Windows host와 Demo/Testbed의 Windows/Web 네 App을 재빌드했다. engine **`440d72f9c1161489836053100342e1cd23466cfc62e34b22aa6724d1687931b7` / 360 files / ABI 2 / schema 313408118**, Core/SDK/Material source-map 입력 **714/134/284 modules**를 대조했다. Demo Windows JS/HBC는 **`b18f25cb60bb41ca475ae357cd3751a5785a7dd138a58be0e3149c77c15bcc2f` / `77e8b7a572d4fbb02da06c3e86aa1820d824ebaca0edc410e4fa5a71f35a2bde`**, Testbed Windows는 **`6bf2981719f97379625febd7860a93c1f41e64c44cf0c2aa45ef712402c807a3` / `cb1fce3cb59d944369fbb488c3165a6ff10ff907a2e6688e5168e08a61d73b30`**다. 전체 workspace 타입·수작업 TS/MJS **44개** format/lint·diff 검사를 PASS했다.

| 검사 | 입력·기능 | 이동 지연 p95 / 최대 | 활성 offset 정체 |
| --- | --- | --- | --- |
| 초기 공통-clock All / engine 5cc26f57…837ba | 360개 전부 반영, 12개월·연도/날짜·종료 PASS. 진단 후처리 BOM 오류로 checker exit 1 | **516.040 / 601.505ms — FAIL** | 성능 수락 없음 |
| 최신 Calendar / 12개월 / 3배속 / YearMode | **360 updates / 실제 2,000.254ms / 180Hz**, 전부 반영·누락/거부 0, 목적 월·연도/날짜·정상 close PASS | **427.934 / 505.547ms — FAIL** | **최대 311ms / ≥100ms 9 / ≥250ms 2 — FAIL** |
| 최신 Web isolated/plain | 12회 왕복·header/grid·기존 resident/Element/builder 상한·resize anchor·연도/날짜·종료 PASS | 실제 3배속 성능 notVerified | 지연 주입/RPC가 있는 기능 검사 |

최신 Calendar의 driver lateness p95/최대는 **0.509/4.335ms**, publication gap 최대 **30.263ms**, active App turn **213.469/261.666ms**다. source pass 45의 build/capture/scene은 **127.251/68.963/90.078ms**, 신규/captured **764/789**, bindings/adapters **782/7**이었다. 같은 pass의 Source 58은 **121.122ms**, accepted document **45**, native preparation **42**, 최초 publication **300**으로 연결됐다. Source 완료→native layout-ready 관찰은 **156.797–159.341ms**이며, 여기에는 Source 이후 투영·전송도 포함된다. 순수 Content CPU로 표시하지 않는다. 이후 ready→provider **0.957–3.584ms**, provider→activation **0.003–2.476ms**, activation→publication **11.383–14.305ms**였다. 문서 단위 관찰 연결이며 해당 월의 정확한 demand 생성→pixels 지연은 아니다. 서로 다른 실행·pass·inclusive scope를 더하거나 이 단일 비교를 개선율로 쓰지 않는다.

공통 clock 호환은 확인했고, Source **99개**(sliver 29 / box 10 / retained-box 60)와 native **85 cohort** 모두 overwrite·역순 **0**이다. 권위 builder 요청 **39개**는 정확한 request/node/revision/list로 연결됐다. native terminal은 published **46**, continued **7**, superseded **31**, trace 시점 pending **1**이다. native trace는 close 전, Source 출력은 close 후이므로 cutoff를 같다고 가정하지 않는다. retained-box의 문서 연결과 일반 ready를 실제 요구 월의 coverage-ready로 승격하지 않는다. **actualDemandCreation=notObserved / demandToCoverage=notVerified / coverageReadyGoal=notVerified**를 유지한다. trace ring 손실/output drop **0**, 정상 close의 reserved/memory **0**, workers joined·App exit **0**이며, 두 Windows 실행의 소유 PID와 일회성 staging은 남기지 않았다.

**계속할 경계:** 목표는 **active / PARTIAL / 성능 FAIL**이다. 긴 retained descendant build와 cold capture/scene이 여전히 다음 수정 대상이다. 원래 `_DayPicker`·`_DayState`와 Element/Focus/스타일의 필수 실행을 유지하면서 번역·내부 변환의 반복을 코드에서 줄인다. 문서 상관 진단을 독립 장기 계측 과제로 늘리거나, lifecycle/callback 생략·resident 확대·느린 입력·기준 완화로 통과시키지 않는다. full setter mapping·실제 demand/offset chain·UIA 전체 소비자·다른 플랫폼 제품 및 물리/scanout/resize 수락은 미완료다.

### 13.11 포인터·semantics 정책의 고정 명령 후보 확대

원래 adapter reader와 host의 변환 순서를 먼저 대조했다. PointerListener, Ignore/AbsorbPointer, Block/Exclude/MergeSemantics, Offstage, RepaintBoundary는 최종 scalar·callback을 얻고도 NativeBoxConfiguration과 Scene options를 다시 만들었다. 이 **8개 class**를 기존 5개 class의 pooled BoxRenderBindingWriter에 연결했다. writer의 interaction 저장 공간은 depth별로 재사용하고 완료·실패 때 callback·정책 참조를 지운다. 필요한 getter/resolver는 그대로 읽고, module reader→bind→parent fields→child capture→codec 순서를 유지한다. canonical pointer carrier는 매 capture 교체하되 실제 호출에서는 현재 Source handler를 읽고 disposed guard·기존 event 변환/오류 보고를 유지한다. 생성자 성질도 원래 callback과 동일하게 보존했다.

직접 데이터의 exact-prototype 등록은 유지하며 임의 subclass·instance render hook·custom pointer handler·pan-zoom carrier를 새로 허용하지 않는다. public mutable producer나 callback을 identity cache로 고정하지 않는다. packet schema·Core·200ms animation·실제 resident 정책은 바꾸지 않았다. 진단 module group은 proxy/constraints(경계 포함)/padding/alignment/pointer/semantics-policy/offstage의 **7개 × cold/warm = 14칸**이다. 전체 setter mapping 15/263의 미완료 의무를 이 reader 확대와 혼동하지 않는다.

[check-box-commands.mjs](Nelyx/eng/check-box-commands.mjs)는 실제 Source alias를 사용해 **13개 class의 기존 adapter wire**와 parent fields를 대조했다. pointer callback 교체/현재 handler/dispose/생성자 성질, getter·exception·자식 순서, 차단·semantics·offstage true/false 전환, mutable constraints, 중첩 interaction·실패 뒤 pool 정리를 PASS했다. render binding의 NACK/reset/참조/generation/in-flight와 incremental capture 회귀도 PASS다. 전체 workspace 타입 및 수작업 TS/MJS **49개** format/lint·diff가 PASS다. 이는 직접 투영의 정확성 근거이며 이 class들의 모든 공개 API 완료를 뜻하지 않는다.

Core와 Demo/Testbed Windows/Web 네 App을 재생성하고 전체 공급·source-map 입력 **714/134/284 modules**를 대조했다. engine은 **`440d72f9c1161489836053100342e1cd23466cfc62e34b22aa6724d1687931b7` / 360 files / ABI 2 / schema 313408118** 그대로다. 최신 Demo Windows JS/HBC는 **`996b2eeea8f207cb4da8a686bae5cc997a1f0950f13c5a0e4ebb81ba8f995d4b` / `a5810e3aba1eb39114cf3081e02b1e734c131b21ddabdd33fa7867e2e01bac58`**, Testbed Windows는 **`504eb849d4156a32a8aa1483f25bc3cd93e5797862801134fa2a474384eb55e3` / `59398578b2df3934acf2776b548cfdcf38b77752b6fe649a8c3a3968893be5f6`**이다. Demo/Testbed Web JS는 각각 **`1124aef7ff9c387c2837ebe03439fbce8ffdd429ef0944150b5bb15965c50acb` / `e4bf55b1464a33484cc97db3a8f93ea1675d88c0d7f09039ccb6b9ffd7136977`**다.

최신 **Calendar / RapidMonths 12 / PrecisionHz 60 / GestureSpeed 3 / YearMode**는 **360 updates / 실제 2,001.061ms / 180Hz**, 전부 반영·누락/거부 **0**, 12개월·연도/날짜·정상 close PASS다. driver lateness p95/최대 **0.519/1.924ms**, 이동 지연 **395.713/455.558ms**, offset 정체 **최대 277ms / ≥100ms 8회 / ≥250ms 3회**로 **성능 FAIL**이다. publication gap 최대 **30.368ms**, active App turn **210.336/229.529ms**와 구분한다. ring loss/output drop **0**, close reserved/memory **0**, workers joined·App exit **0**이다.

실제 cold pass 35는 신규/captured **784/827**, bindings/adapters **820/7**, 직접 command bindings **164**, semantics-policy **14개**를 확인했다. build/capture/scene은 **108.104/74.044/57.692ms**다. active input의 pass 47은 신규/captured **779/788**, 직접 commands **164**, build/capture/scene **101.017/65.352/90.793ms**였다. 마지막 110 pass의 build/capture/scene p95 **108.104/65.352/59.955ms**는 초기화·resize·연도 선택도 포함한다. 이 실행에서 cold 월의 pointer group은 0이므로 pointer reader 확대가 월의 주 경로를 모두 제거했다고 하지 않는다. 중간 표현의 제거와 적용은 확인했지만, 전체 cold capture/scene의 일관된 감소와 §5.2의 성능 채택 기준은 **PARTIAL**이다. 서로 다른 pass·실행의 합이나 단일 개선율로 완료 처리하지 않는다.

Source **102개**(sliver 31 / box 10 / retained-box 61), native **86 cohort**, 권위 request **41개**를 공통 QPC로 연결했다. bounded overwrite·역순은 **0**이며 native는 published **46**, continued **8**, superseded **32**, pending **0**이었다. Source의 pending·overwrittenPending도 **0**이다. 일반 ready·문서 연결은 실제 demand→coverage가 아니므로 관련 목표는 계속 notVerified다.

최신 Web isolated/plain도 각각 12회 왕복·기존 노드/Element/builder 상한·grid/header·resize anchor·연도/날짜·종료를 PASS했다. 두 profile 모두 baseline/12회 뒤 **1,787 nodes / 4,455 Elements**, resize 뒤 **1,877 / 4,545**, close reserved **0 / workersStopped=true**다. 24 gesture의 3배속 목표는 6 updates/600px/32ms이며 실제 **39.300–146.200ms**였다. 의도적 App 지연/RPC가 있는 기능 검사로, 실제 3배속 성능 수락은 아니다. 소유 Windows PID·App staging과 Web 일회성 자원은 회수했고 current dist만 남겼다.

**계속할 경계:** 목표는 **active / PARTIAL / performanceAccepted=false**다. Source의 긴 descendant build와 큰 비중의 Focus/Gesture·문단·정적 semantics 구성/투영은 남아 있다. 이번 pointer/policy 후보의 정확성 PASS를 전체 설계 성공으로 확대하지 않고, 실제 cold 경로의 필수 실행과 중간 표현을 코드에서 구분해 다음 묶음을 고른다. full setter/API·완전한 demand/offset chain·UIA·물리/scanout/resize·다른 플랫폼 의무도 그대로 열린다.

### 13.12 Gesture 이벤트 변환 함수 공유와 Inherited 후보 철회

Element 초기화·상속 조회·Focus 및 실제 날짜 셀 생성 경로를 먼저 읽었다. 기존 intrusive queue, scope ancestry, 상속 타입 인덱스와 단일 자식 경로를 새로 구현하는 것으로 돌아가지 않았다. Inherited 인덱스의 4개짜리 Map 조회 캐시를 같은 상한·교체 순서의 고정 슬롯으로 바꾼 후보는 독립 조상 조회 oracle·타입·기능을 통과했지만, 실제 3배속에서 cold build **105.741ms**, 이동 **444.834/506.850ms**, offset **최대 284ms / ≥100ms 8회**가 남았다. 실제 Source 비용 개선 근거가 부족하므로 **후보와 임시 전용 checker를 철회**했다. 현재 `DependencyScope`는 원래 Map 구현이며 이 실행은 최신 공급의 결과가 아니다.

그다음 [Gesture adapter](Nelyx/runtime/app/gesture.ts)가 날짜 셀마다 `invoke/details/positions/pointerKind/tapDown/tapUp/longDown/longStart/longEnd/drag` 함수들을 다시 만드는 경로를 줄였다. 10개 내부 절차를 공유 `NativeGestureDispatcher` 메서드로 옮겼다. 셀별 dispatcher 한 객체와 원래 두 arrow callback을 유지하며, 실제 Element·옵션 참조·tap/long/pan/축 설정은 해당 셀에 남긴다. callback은 호출 시 현재 옵션에서 읽고 mounted guard·undefined receiver·동일한 상세 객체 생성·오류 보고를 보존한다. recognizer capability, 옵션 검증과 getter 호출, semantic action의 down/up/tap 및 long-press 순서는 그대로다. 사용자 callback·State·FocusNode·200ms animation·실제 resident 정책은 생략하거나 바꾸지 않았다.

기존 실제 App HBC와 새 App HBC에서 native gesture adapter 함수 본문의 `CreateClosure`를 직접 대조했다. **13개에서 `has/onGesture/onAction` 3개로 감소**했다. 함수 이름만 옮기고 기존 per-cell closure가 compiler 출력에 남은 경우와 구분한다. dispatcher 객체와 기존 `has` 내부 작업은 남으며, 이 수치를 정확한 Hermes heap bytes나 전체 Source 절감량으로 해석하지 않는다.

[check-native-gestures.mjs](Nelyx/eng/check-native-gestures.mjs)는 현재 Source alias로 탭·길게 누르기·pan·양 축 drag/cancel·semantic action을 확인했다. 원래 adapter를 일회성 reference로 함께 실행해 **wire 값·상세 객체·callback 순서/receiver·옵션 Proxy getter 순서·오류 보고**를 대조했고 PASS했다. callback 교체·missing details·폐기 후 callback 미조회·arrow의 생성자 성질도 PASS다. reference 임시 파일은 회수했다. 기존 render binding의 NACK/reset/참조/generation/in-flight 및 incremental capture 회귀, 전체 workspace 타입, 수작업 TS/MJS **51개** format/lint와 diff 검사가 PASS다.

Core와 Demo/Testbed Windows/Web 네 App을 재생성했다. source-map 입력은 **714/134/284 modules**이며 현재 Source와 전부 일치한다. engine은 **`440d72f9c1161489836053100342e1cd23466cfc62e34b22aa6724d1687931b7` / 360 files / ABI 2 / schema 313408118** 그대로다. Hermes pin·표준 `-O`·native-upstream-v1과 instance-fields-v1 정책도 유지한다. 최신 Demo Windows JS/HBC는 **`a8750a46895ee09e11565ca1397345d334d6cf2aa9b3cf349546212fdb678991` / `c568e9d96c5fce15c9f62d35a748a67b1eb093d65047fcf87629362d59a7077e`**, Testbed Windows는 **`c98ade546e6afc8ad9ef04ef5ec9422a957dc00a46fa45b1ff93031e0b86ea79` / `e79808ac6abd2a96cb413eb506f3915a3f0ba567697dde43d1bc4171fc4abd2b`**다. Demo/Testbed Web JS는 **`83c5bdb75cd2109c4e438941019b7496b7658f3c420581f23cfb899ebed1a977` / `f1cc3a3219ec70ef0efb5c16a2085f0845060bde21733fe35e7b3dee5ea80715`**다.

최신 **Calendar / RapidMonths 12 / PrecisionHz 60 / GestureSpeed 3 / YearMode**는 **360 updates / 실제 2,000.309ms / 180Hz**를 전부 반영했다. 누락·거부 **0**, 12개월·연도/날짜 선택·정상 close PASS다. driver lateness p95/최대 **0.503/1.548ms**, 이동 지연 **400.541/467.222ms**, offset 정체 **최대 256ms / ≥100ms 9회 / ≥250ms 3회**로 **성능 FAIL**이다. publication gap 최대 **30.454ms**와 active App turn **181.585/218.769ms**는 별도다. ring loss/output drop **0**, close reserved/memory **0**, workers joined·App exit **0**이다.

같은 규모의 cold pass 35는 신규/captured **784/827**, bindings/adapters **820/7**이며 build/capture/scene **90.959/79.079/54.075ms**였다. input 12의 이 표본을 활성 3배속 구간 전체의 비용으로 표시하지 않는다. active input 43의 pass 42는 신규/captured **398/768**, build/capture/scene **114.892/59.985/55.541ms**로 서로 다른 생성량이다. 마지막 119 pass의 p95 **103.178/59.985/61.488ms**에는 초기화·resize·연도 선택도 들어간다. closure 제거와 이번 cold 표본의 감소는 확인했으나 여러 실행의 일관된 개선율이나 §6의 전체 효용 수락은 확정하지 않는다.

Source **104개**(sliver 30 / box 12 / retained-box 62), native **92 cohort**, 권위 request **42개**를 연결했다. Source/native bounded overwrite와 native 역순은 **0**, native는 published **50** / continued **9** / superseded **33** / pending **0**이었다. Source pending·overwrittenPending도 **0**이다. exact demand 생성은 계속 **notObserved**, demand→실제 coverage 목표는 **notVerified**다.

최신 Web isolated/plain은 각각 12회 왕복·grid/header·노드/Element/builder 상한·resize anchor·연도/날짜·종료를 PASS했다. 두 profile 모두 12회 뒤 **1,787 nodes / 4,455 Elements**, resize 뒤 **1,877 / 4,545**, close reserved **0 / workersStopped=true**다. 24 gesture의 목표는 6 updates/600px/**32ms**, 실제 **59.195–136.190ms**였다. 의도적 App 지연/RPC가 있는 기능 검사이므로 실제 3배속 성능 PASS가 아니다. 소유 Windows CLI/App 종료와 staging·reference 임시 파일 회수를 확인했고 current dist만 남겼다.

**계속할 경계:** 목표는 **active / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 함수 생성 감소만으로 긴 descendant build와 capture/scene이 해결된 것은 아니다. 다음 묶음은 실제 cold 경로의 Focus/Gesture·문단·정적 semantics 투영과 반복 owner 작업 중 의미를 보존해 제거할 수 있는 부분을 고른다. getter·callback·새 Source 객체를 생략하거나 resident 수를 늘려 성능을 통과시키지 않는다. full setter/API·완전한 demand/offset chain·UIA·물리/scanout/resize·다른 플랫폼은 여전히 열린 범위다.

### 13.13 문단 검증 payload 일회 전달과 constructor 후보 철회

실제 HBC와 고정 Hermes 소스의 암시적 derived constructor를 먼저 확인했다. `applyArguments`는 native 인자 프레임에 복사하며 JS rest 배열을 만드는 경로가 아니었다. 6개 Element/State constructor의 흔한 0/1 인자 호출을 명시적 super로 바꾸고 나머지 인자는 원래 forwarding을 보존한 후보를 시험했다. Node와 실제 pinned VM에서 30개 arity/superclass/new.target 조합, own descriptor·opaque Proxy 인자·Array iterator 격리·예외 identity·교체 super 결과·실제 State lifecycle을 통과했다. 그러나 해당 후보의 Calendar 3배속은 이동 **450.028/497.401ms**, offset **최대 297ms / ≥100ms 9회**로 개선 근거가 부족했다. **constructor 구현과 전달 helper는 전부 철회**했다. 현재 framework constructor는 원래 구현이다. 의미 검사의 빈틈을 메운 [check-element-construction.mjs](Nelyx/eng/check-element-construction.mjs)와 공용 fixture만 유지하고 실제 package/VM에서 다시 PASS했다. `new.target.prototype` 관찰 수는 서로 다른 VM을 같다고 가정하지 않고 같은 VM의 암시적 forwarding을 oracle로 비교한다.

다음으로 [originalParagraphInput](Nelyx/runtime/app/paragraph.ts)이 문단을 encode→검증→decode해 소유한 frozen snapshot을 만든 뒤, Source host가 같은 문단을 다시 encode·decode하는 경로를 줄였다. [paragraph codec](Nelyx/runtime/engine-client/paragraph.ts)은 prepare 요청으로 **직접 만든 불변 snapshot에만** 방금 검증한 bytes를 private WeakMap으로 붙인다. 바로 다음 [Source projection](Nelyx/runtime/app/host.ts)에서 기존 height 생략·wrap override를 동일하게 수행하고 한 소유자에게 전달한다. wrap 변경 때는 해당 header bit만 바꾼 복사본을 사용한다. 최종 encoder는 payload를 한 번 소비하고 항상 새 mutable bytes를 반환한다. 임의 producer·가변 nested 값·나중 capture를 위한 일반 identity cache가 아니다. 장기 AppText entry는 prepare를 요청하지 않는다.

fade의 최종 합성 문단은 일반 검증 경로에 남으며, 중간 snapshot의 미사용 payload는 weak key와 함께 회수된다. Source의 overflow getter를 추가로 읽어 경로를 고르지 않는다. 깊이 소유한 문단과 scalar text에 한해 binding의 재귀 eligibility 검사를 줄이며, ParentData·listItem이 붙은 설정은 기존 검사를 거친다. 사용자 getter·callback·State·FocusNode 실행, Source 자식 capture와 bind 순서, full codec의 실제 scalar 검증 및 native 검증은 유지한다. **200ms animation·실제 resident 3개월·wire schema는 그대로**다.

[check-render-bindings.mjs](Nelyx/eng/check-render-bindings.mjs)는 기본·strut·runs·overflow probe를 포함한 문단 6종 × wrap 양쪽의 기존 wire·정규화 shape를 대조했다. payload 단일 소유/소비, 반환 bytes 변조 격리, producer 변경 격리, nested probe 거부/후속 정상 소비, 가짜 brand·Proxy getter·invalid option 오류를 PASS했다. native paragraph 검사에 clip/fade의 overflow getter 횟수 회귀를 추가했다. 기존 native paragraph 갱신·incremental capture·render binding의 NACK/reset/참조/generation/in-flight 및 실제 Element 생성 의미 검사를 PASS했다. 전체 workspace 타입, 수작업 TS/MJS **54개** format/lint·diff와 pinned compiler/VM의 class fields·module 초기화 검사도 PASS다.

정상 Core·MSVC/single-worker/threaded/Windows host와 Demo/Testbed Windows/Web 네 App을 재생성했다. engine **`a5e80023ec52d5400709d31bbac6bd277a9ad43d01d15346fe85220c53363b3c` / 360 files / ABI 2 / schema 313408118**, Source 입력 **714/134/284 modules**를 전부 대조했다. Hermes **260318099.0.7 / b464dba92ad87bcfb77fae381a49a2394d9836d9 / HBC 99**, native-upstream-v1·표준 `-O`·instance-fields-v1은 유지한다. 최신 Demo Windows JS/HBC는 **`1325d0966293c34747d6918b8e2e370fdb0b823b07ee3c363660b8b1a18abe6e` / `69191d9b2d781b1c0b42ca9b1f33a47d790121125ec2c1e9cc6f3202c45feefb`**, Testbed Windows는 **`9eb8c511869376a00f38b937ccb1f01462aac85df2bf093a3666407acbed6ed6` / `ad356825814ceae2e69f4d0abd19716a3c30f9cd5cf35928a9a390915d14495f`**다. Demo/Testbed Web JS는 **`4db41b160f1c23e17af4ed3bcae4788dd1bc12504350971b6c215f14deb9804d` / `44ac857bfd8ed9c8fb62ff30b2decc38eb4a1bdec58ee0bedc5091135e0515e0`**다.

최신 **Calendar / RapidMonths 12 / PrecisionHz 60 / GestureSpeed 3 / YearMode**는 **360 updates / 실제 2,000.293ms / 180Hz**를 전부 반영했다. 누락·거부 **0**, 12개월·연도/날짜·정상 close PASS다. driver lateness p95/최대 **0.513/2.686ms**, 이동 지연 **336.691/430.978ms**, offset 정체 **최대 268ms / ≥100ms 9회 / ≥250ms 1회**로 **성능 FAIL**이다. publication gap 최대 **31.153ms**와 active App turn **149.980/230.350ms**는 별도다. ring loss/output drop **0**, close reserved/memory **0**, workers joined·App exit **0**이다.

같은 규모의 cold pass 34는 신규/captured **784/827**, bindings/adapters **820/7**이며 **문단 준비/직접 bindings 76/76**을 확인했다. build/capture/scene **113.359/51.205/57.497ms**, descendant/render commit **110/3ms**였다. input 12의 이 표본을 활성 구간 전체 비용으로 표시하지 않는다. 활성 input 315의 pass 47은 신규/captured **779/789**, 문단 **75/75**, build/capture/scene **92.031/54.794/114.821ms**였다. 마지막 116 pass의 p95 **102.831/48.871/59.423ms**에는 초기화·resize·연도 선택도 포함한다. 중복 codec 제거와 적용률은 확인했고 capture 표본은 줄었지만, 서로 다른 실행의 값을 단일 개선율로 쓰거나 전체 성능 수락으로 확대하지 않는다.

Source **103개**(sliver 30 / box 12 / retained-box 61), native **86 cohort**, 권위 request **42개**를 연결했다. bounded overwrite·역순 **0**, native terminal은 published **44** / continued **9** / superseded **32** / trace 시점 pending **1**이다. Source는 published-coverage **61** / declined **4** / cohort-changed **34** / closed **4** / pending **0**이다. close 전 native trace와 close 후 Source 출력의 cutoff는 다르다. exact demand 생성 **notObserved**, demand→실제 coverage 목표 **notVerified**를 유지한다.

최신 Web isolated/plain은 각각 12회 왕복·grid/header·기존 노드/Element/builder 상한·resize anchor·연도/날짜·정상 종료를 PASS했다. 두 profile 모두 12회 뒤 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877 / 4,545 / 3**이며 close reserved **0 / workersStopped=true**다. 24 gesture의 목표는 6 updates/600px/**32ms**, 실제 **46.500–168.400ms**였다. 의도적 App 지연/RPC가 있는 기능 검사이므로 실제 3배속 성능 PASS가 아니다. 소유 Windows CLI/App 종료와 일회성 staging·검사 임시 자원의 회수를 확인했고 current dist만 남겼다.

**계속할 경계:** 목표는 **active / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 문단 중복 변환을 줄여도 긴 Source descendant build와 capture/scene의 나머지 비용은 남는다. 다음에는 실제 생성 경로의 번역·내부 투영 반복을 코드에서 구분하며, 필수 Widget/Element/State·사용자 호출을 생략하거나 준비 창·resident 수·입력 조건·수락 기준을 바꾸지 않는다. full setter/API·실제 demand/offset chain·UIA 전체 소비자·물리/scanout/resize·다른 플랫폼은 여전히 열린 범위다.

### 13.14 Scene 생성 순서의 반복 조회와 노드별 집계 함수 제거

[SceneWriter](Nelyx/runtime/engine-client/scene.ts)의 cold diff는 새 record들을 depth로 stable sort하면서 comparator마다 handle key 문자열과 depth Map을 다시 조회했다. 이미 검증하는 depth가 유한 정수인 점을 사용해 **새 record당 depth 한 번 조회 → 같은 depth 안에서는 원래 삽입 순서 → 낮은 depth부터 생성**하는 bounded bucket 구성을 적용했다. 부모 우선·같은 깊이의 기존 순서·실제 sibling 배치·실제 handle/generation·원래 commands는 유지한다. 별도 장기 record/Source cache는 만들지 않았다.

같은 records pass의 subtree 집계 helper도 노드별 closure에서 pass당 하나로 옮겼다. 원래 local options와 geometry를 명시적으로 전달해 자식 처리 뒤 옵션을 다시 읽지 않는다. 실제 HBC의 해당 visit 본문은 closure 명령 **37→36개**이며, 제거한 `retainSubtree` closure는 records 본문에 **한 번** 있다. 나머지 명령에는 다른 분기의 closure도 포함되므로 37개 모두가 매 node 실행된다는 뜻은 아니다. 깊이·참조·cacheability 집계 값과 getter/callback 순서는 유지한다.

[render binding 검사](Nelyx/eng/check-render-bindings.mjs)에 13/27/41 node의 가변 깊이와 기존/신규 혼합, 일반/direct 경로를 넣어 **기존 stable depth sort를 독립 순서 oracle**로 대조했다. 원래 sort를 메모리 내 reference module로 실행해 생성·설정·topology bytes, 삭제·reparent·NACK를 새 구현과 직접 비교했고 PASS했다. reference 파일은 만들지 않았다. 기존 render binding·incremental capture·native paragraph·13종 box commands, 전체 타입·수작업 TS/MJS **54개** format/lint·diff와 pinned Hermes 의미/module 초기화 검사도 PASS다.

Core와 Demo/Testbed Windows/Web 네 App을 재생성하고 source-map 입력 **714/134/284 modules**와 공급 파일을 대조했다. engine **`a5e80023ec52d5400709d31bbac6bd277a9ad43d01d15346fe85220c53363b3c` / 360 files / ABI 2 / schema 313408118**와 Hermes pin·표준 `-O`·class/instance-field 정책은 그대로다. 최신 Demo Windows JS/HBC는 **`8e9e5facff24bc92c49973ba58437abc99dc0ab096c43f222cf9081e597b9d22` / `1aa2c8b6725020abd2dc07c4e42357d7639982ffda02adbb81d908119dbf5d8c`**, Testbed Windows는 **`ed9ab1621888b9143ff8110337c65ee81109e62027f1cd35a058150f9f0f0b7e` / `95b0e2f4b96a4bbe276068b89ce007fb69ac0fb546b03c21729a7ffdab37d581`**다. Demo/Testbed Web JS는 **`dbfe8d7ca5d1f01e53837c8298af46b26150bca41b25f7c7d6bcd1ffea6b42da` / `80dd96699537429d2360cd5bf2bb1cf09b1414025c17d43040daf88d16cb4171`**다.

최신 **Calendar / RapidMonths 12 / PrecisionHz 60 / GestureSpeed 3 / YearMode**는 **360 updates / 실제 2,000.110ms / 180Hz**를 전부 반영했다. 누락·거부 **0**, 12개월·연도/날짜·정상 close PASS다. driver lateness p95/최대 **0.514/1.338ms**, 이동 지연 **315.157/409.237ms**, offset 정체 **최대 259ms / ≥100ms 9회 / ≥250ms 2회**로 **성능 FAIL**이다. publication gap 최대 **29.016ms**, active App turn **147.589/227.783ms**와 구분한다. ring loss/output drop **0**, close reserved/memory **0**, workers joined·App exit **0**이다.

cold pass 35(input 12)는 신규/captured **784/827**, bindings/adapters **820/7**, 문단 준비/직접 bindings **76/76**이었다. build/capture/scene **107.428/45.253/57.259ms**, descendant/render commit **95/12ms**다. 활성 input 192의 pass 49는 신규/captured **779/803**, build/capture/scene **93.035/57.506/75.232ms**였다. 마지막 114 pass의 p95 **107.053/57.506/58.282ms**는 초기화·resize·연도 선택도 포함한다. 실제 반복 조회와 노드별 closure는 제거됐지만 전체 cold scene 비용의 일관된 감소나 §5.2의 전체 효용 수락은 **PARTIAL**이다. 앞선 실행의 지연과 단일 개선율로 묶지 않는다.

Source **99개**(sliver 30 / box 8 / retained-box 61), native **89 cohort**, 권위 request **38개**를 연결했다. bounded overwrite·역순 **0**, native는 published **51** / continued **9** / superseded **29** / pending **0**, Source는 published-coverage **65** / cohort-changed **30** / closed **4** / pending **0**이다. exact demand 생성 **notObserved**, demand→실제 coverage 목표 **notVerified**는 유지한다.

Web isolated/plain은 각각 12회 왕복·기존 resident/Element/builder 상한·grid/header·resize anchor·연도/날짜·종료를 PASS했다. 12회 뒤 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877 / 4,545 / 3**, close reserved **0 / workersStopped=true**다. 24 gesture는 6 updates/600px/목표 **32ms**, 실제 **50.300–120.700ms**이며 지연 주입/RPC가 있는 기능 검사다. 실제 3배속 성능 수락이 아니다. 소유 Windows PID와 일회성 자원 회수를 확인했고 current dist만 남겼다.

**계속할 경계:** 목표는 **active / PARTIAL / performanceAccepted=false**다. 코드상 반복 제거가 입력 조건의 준비 여유 안에 들어오지는 못했다. 긴 Source descendant build와 남은 capture/scene이 다음 분석 대상이며 원래 Widget/Element/State·FocusNode·사용자 실행·resident 3개월·200ms animation을 유지한다. full setter/API·실제 demand/offset chain·UIA·물리/scanout/resize·다른 플랫폼의 미완료 의무도 그대로다.

### 13.15 dirty queue 비교의 직접 호출과 지연 command index 후보 철회

Source의 debug 작업이 잘못 켜졌다는 가설은 코드에서 제외했다. FoundationBuildMode의 기본값은 이미 release다. 이어 [DepthQueue](Nelyx/src/runtime/depth-queue.ts)의 `up/down`을 실제 HBC에서 확인했다. 작은 private `before` 비교를 매번 method lookup·Call3로 실행하고 있었다. 같은 필드 읽기 순서의 module 함수로 옮겨 현재 compiler가 직접 인라인하게 했다. 최종 HBC의 두 heap 함수에는 **before lookup과 함수 호출이 모두 0개**이며 register는 **20→13 / 24→17개**다. 힙 데이터 구조·metadata·우선순위/FIFO·실제 build 순서·기존 사용자 hook은 바꾸지 않았다.

원래 queue와 새 queue를 실제 Proxy record로 함께 실행해 getter/setter와 predicate 순서, 같은 depth 순서·depth 변경·중간 제거·외부 queue membership·재진입·order overflow·예외 identity를 대조했고 PASS했다. 기존 LayoutBuilder scheduling·stale callback·scope 및 child reconciliation/GlobalKey 회귀도 PASS다. render bindings·incremental capture, 전체 workspace 타입, 수작업 TS/MJS **55개** format/lint·diff를 PASS했다. 이 기계적 호출 제거를 Source 전체 비용 개선으로 확정하지 않는다.

같이 시험한 Scene command index의 지연 생성은 private 공용 prototype/getter로 첫 생성의 전체 Map을 피했다. cold Map 미생성 및 원래 초기/reset/topology/reference/generation/NACK bytes는 PASS했고 실제 생성 scan **9,026개**도 확인했다. 그러나 해당 묶음의 3배속은 이동 **429.018/507.127ms**, offset **최대 271ms / ≥100ms 9회**였고 Scene 비용 개선은 확인하지 못했다. 추가 prototype/getter의 복잡성을 감수할 근거가 부족해 **지연 index·관련 counter·전용 검사 확장을 전부 철회**했다. Scene 소스가 §13.14 상태와 정확히 같음을 대조했다. 아래 결과는 queue 변경만 남겨 새로 공급한 독립 실행이다.

Core와 Demo/Testbed Windows/Web 네 App을 재생성하고 Source 입력 **714/134/284 modules**와 공급 파일을 대조했다. engine **`a5e80023ec52d5400709d31bbac6bd277a9ad43d01d15346fe85220c53363b3c` / 360 files / ABI 2 / schema 313408118**와 Hermes pin·표준 `-O`·class/instance-field 정책은 그대로다. 최신 Demo Windows JS/HBC는 **`3517ea780e56914a19340de0899086275664482ecf57908dc426faedcad675b6` / `5e7f63340c2bfbf78d7c33474aba6d5c79f3ee00938c7b56ac773f4e529ffb16`**, Testbed Windows는 **`e086853d56795d6775f66a9a5e0f0c9879456076de8a73f2dc589b58d0bc1f16` / `291ac7419c6a3191ad2428459c2c4abe9ad26fa3aba07c0151ec2c4f66a48dff`**다. Demo/Testbed Web JS는 **`0f5bbb2b465f0f0ef78293b6d3cea9f1801b574386dfea9470f8f09dfd4ed1f2` / `9a0c5ab020747d6419e889a5d4427aec97023d94a74bc9f0ef3518ae54dc9698`**다.

최신 **Calendar / RapidMonths 12 / PrecisionHz 60 / GestureSpeed 3 / YearMode**는 **360 updates / 실제 2,000.167ms / 180Hz** 전부 반영, 누락·거부 **0**, 12개월·연도/날짜·정상 close PASS다. driver lateness p95/최대 **0.511/4.098ms**, 이동 지연 **346.564/432.376ms**, offset 정체 **최대 277ms / ≥100ms 9회 / ≥250ms 2회**로 **성능 FAIL**이다. publication gap 최대 **33.324ms**, active App turn **174.198/228.232ms**는 별도다. ring loss/output drop **0**, close reserved/memory **0**, workers joined·App exit **0**이다.

cold pass 35(input 12)는 신규/captured **784/827**, bindings/adapters **820/7**, 문단 **76/76**, build/capture/scene **115.529/56.809/56.934ms**, descendant/render commit **112/3ms**였다. 활성 input 283의 pass 47은 신규/captured **764/789**, build/capture/scene **119.343/53.840/78.530ms**였다. 마지막 110 pass의 p95 **106.350/53.840/58.953ms**에는 초기화·resize·연도 선택도 있다. 최종 queue의 호출 제거는 확인했지만 Source 전체 cold 비용의 일관된 감소는 입증하지 못했다.

Source **107개**, native **88 cohort**, 권위 request **42개**의 연결에서 overwrite·역순은 **0**이다. native는 published **46** / continued **10** / superseded **32** / pending **0**, Source는 published-coverage **70** / declined **4** / cohort-changed **30** / closed **3** / pending **0**이다. exact demand 생성 **notObserved**, demand→실제 coverage 목표 **notVerified**는 유지한다.

Web isolated/plain은 각각 12회 왕복·기존 resident/Element/builder 상한·grid/header·resize anchor·연도/날짜·종료 PASS다. 12회 뒤 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877 / 4,545 / 3**, close reserved **0 / workersStopped=true**다. 24 gesture는 목표 6 updates/600px/**32ms**, 실제 **55.345–135.800ms**였으며 지연 주입/RPC를 포함한 기능 검사다. 실제 3배속 성능 수락이 아니다. 두 Windows 실행의 소유 PID·App staging과 일회성 reference를 회수했다.

**계속할 경계:** 목표는 **active / PARTIAL / performanceAccepted=false**다. 작은 helper·할당 제거 뒤에도 Source와 투영의 필수 실행이 준비 여유를 넘는 §6.3의 재검토 조건이 남는다. 현재 pin의 upstream native unit 실행 가능성을 코드와 선택형 의미 검사에서 확인하며, bytecode 제품 공급을 전환한 것으로 간주하지 않는다. 실제 App·3배속·전체 의미 검증을 거치기 전 성능이나 호환 수락을 올리지 않는다. 사용자 실행·resident 3개월·200ms animation·기존 미완료 의무는 유지한다.

### 13.16 같은 upstream pin의 native unit 실행 후보 — 구현·검증 중

작은 helper 제거 뒤에도 실제 Source 준비 비용이 남아 실행 경로를 검토했다. 현재 공급의 upstream 소스·도구에 `shermes`, `evaluateSHUnit`와 native InternalJavaScript가 이미 포함돼 있다. 별도 VM·revision·로컬 compiler 패치를 추가하지 않고 **같은 App JS와 같은 VM의 native unit**을 시험한다. 현재 x64 공급의 JIT를 켠 결과가 아니며, 기존 RNW/옛 Static Hermes 공급으로 되돌리지 않는다.

[check-hermes-syntax.mjs](Nelyx/eng/check-hermes-syntax.mjs)에 `--native-unit` 선택형 비교를 추가했다. 실제 package의 생성자·Source/observation/Scene 의미 fixture를 표준 upstream compiler로 C/DLL로 만들고 동일 Runtime의 SHUnit API로 실행했다. 원래 fixture의 계약 검사 및 hits **9,728**, bytes **65,536**, part encode/reuse **1/1**가 bytecode와 일치했다. native image 빌드는 **95,718ms**, checker exit **0**이었다. 이어 현재 Demo JS **3517ea78…675b6**의 `--application-init`을 debug/optimized bytecode와 native unit에서 모두 PASS했다. native image 빌드 **443,014ms**, 최종 checker exit **0**이다. App launch 직전까지의 모듈 초기화이며 실제 UI/입력이나 성능 근거로 승격하지 않는다. 두 실행의 C·object·DLL·검사 실행파일은 finally에서 회수했다. 검사 deadline은 caller의 20분 안에서 정리 시간을 남기도록 연결했다.

Windows host에 선택형 `--native-unit` 경로를 구현했다. library는 App owner thread의 Runtime보다 오래 유지하며 실제 entry 종류를 출력한다. 기존 타이머·microtask·JSI port·Source App과 200ms animation·resident 정책은 유지한다. SDK builder의 명시적 `nativeUnitInputs`로 같은 JS를 컴파일하고, 공급 VM의 실제 파일 hash와 compiler 입력의 VM이 같은지 확인한다. executable과 현재 function/PC map만 App 산출물에 넣으며, source/runtime/compiler/ABI·factory·async break check·file hash·evidence를 검증한다. 원래 bytecode 경로는 유지한다. Windows checker도 manifest 선택과 실제 host 실행 종류를 대조하도록 연결했다.

[check-native-unit-contract.mjs](Nelyx/eng/check-native-unit-contract.mjs)의 source/runtime/compiler/ABI·target·factory·break-check·evidence 불일치 거부와 bytecode 경로가 PASS했다. SDK 패키지를 재생성했고 새 host C++와 single-worker 컴파일도 통과했다. **새 엔진 공급·네 App 갱신과 native Demo 실행은 진행 중이며 아직 전체 자격 부여하지 않았다.** 새 공급 identity·실제 App 수명/입력·3배속·메모리·범위별 계약을 확인한 뒤 채택 여부를 판단한다. native unit 모듈 초기화 PASS를 전체 Native AOT/제품/성능 완료로 표시하지 않는다. 목표와 기존 미완료 범위는 계속 active / PARTIAL이다.

### 13.17 같은 Source의 실제 native unit·bytecode 대조 — 기능 PASS / 성능 FAIL

§13.16의 공급 재생성을 마쳤다. 현재 engine source identity는 **`56ac99a46944ef1794da8f237bc74a34f67672c5824231156316690c7f2db2f1`**, **360 files / ABI 2 / schema 313408118**이다. 전체 파일 hash와 현재 Source identity를 다시 대조했다. Core/SDK/Material source-map 입력 **714/134/284 modules**도 현재 Source와 일치한다. SDK·native/single-worker/threaded·Windows host 빌드는 exit 0이다.

| 현재 App | JS SHA-256 | Windows HBC SHA-256 / 실행 |
| --- | --- | --- |
| Demo Windows | `3517ea780e56914a19340de0899086275664482ecf57908dc426faedcad675b6` | `26cf1f5576e2ca2192a67e6fbc3e90f0e061c3c04022cc32ea1c7c684a9e2099` / native unit 선택 |
| Testbed Windows | `e086853d56795d6775f66a9a5e0f0c9879456076de8a73f2dc589b58d0bc1f16` | `59d8165d61c89347c1ab147cfda186a8828016872b738b1e984714e7d6abb604` / bytecode |
| Demo Web | `0f5bbb2b465f0f0ef78293b6d3cea9f1801b574386dfea9470f8f09dfd4ed1f2` | Web |
| Testbed Web | `9a0c5ab020747d6419e889a5d4427aec97023d94a74bc9f0ef3518ae54dc9698` | Web |

Demo native DLL SHA-256은 **`b78be92dbfd3819dd90d8a3e5129f4dd786c76571e31ef6be67852547aaa083a`**다. 크기 **60,945,920 bytes**, 현재 executable function/PC map **21,421,081 bytes**이며 C 함수·Source 위치·PC range **30,683개**가 대응한다. O0 baseline 함수는 **33,544개**다. map의 image hash와 실제 DLL hash도 대조했다. 이 수치는 현재 unit 출력의 연결 근거이며 원래 TypeScript 전 함수/동적 실행의 native coverage나 제품 전체 AOT 수락은 아니다. 기존 JS 타이머 bootstrap 등은 그대로다. C·object·PDB·이전 dist/staging은 회수하고 현재 executable·function map만 남겼다.

`check-hermes-syntax.mjs --native-syntax`로 실제 App과 같은 block-scoping/async-break-check/`-g1` 설정의 native unit도 확인했다. 상속·mixin·new.target·대체 super 객체·필드 descriptor/순서·예외·symbol/rest·비동기 receiver/thenable/finally와 NaN/부호 있는 0이 PASS했고 합계 **6,438,000**이 bytecode와 일치했다. Native fixture 빌드는 **1,818ms**, checker exit 0이다. 전체 workspace 타입, 수작업 TS/MJS **60개** format/lint, PowerShell parser, `git diff --check`도 PASS했다.

아래는 컴파일·다른 성능 검사를 겹치지 않은 실제 Windows 실행이다. 모두 원래 200ms animation·준비 창·입력 거리/표본 수·60Hz 표시 목표를 유지하고 입력 시계만 3배속으로 사용했다. host가 manifest와 같은 실행 종류를 실제 선택했는지 대조했다.

| 실행 | 기능과 입력 | 이동 게시 지연 p95 / 최대 | offset 무진행 최대 / ≥100ms |
| --- | --- | --- | --- |
| Native Calendar / 12개월 / YearMode | 360 updates·실제 **2,000.360ms**·180Hz, 360개 모두 반영·missing 0·12개월·연도/날짜·종료 PASS | **237.218 / 286.234ms** | **237ms / 10회**, ≥250ms 0 |
| 같은 App/engine의 bytecode 대조 | 같은 Source·HBC·입력, 360개 반영·12개월·연도/날짜·종료 PASS | **379.392 / 446.717ms** | **261ms / 9회**, ≥250ms 2 |
| Native Fast / 이동 중 lift·12회 재접촉 | 96 updates·실제 **757.239ms**·120 start/update/end 승인·거부 0, **24개월 역방향**·연도/날짜·종료 PASS | 이 궤적에서는 notVerified | **268ms / 3회**, ≥250ms 2 |

bytecode 대조에서는 현재 manifest의 실행 선택만 메모리에 보존한 뒤 일시 변경했다. JS/HBC/DLL·SDK·cache를 복제하거나 변경하지 않았고, 정상 종료 후 finally에서 원래 native manifest를 정확히 복구·검증했다. 각 표는 단일 bounded 대조이며 일관된 개선율이나 해결로 승격하지 않는다. Native Calendar의 입력 lateness p95/최대는 **0.515/4.569ms**, publication 공백 최대 **25.305ms**, 활성 App turn **139.228/201.264ms**였다. 게시가 계속되는 동안 실제 offset이 따라오지 못한 실패다.

같은 input 12의 cold pass에서 신규/captured **784/827**, 문단 준비/직접 binding **76/76**을 유지했다. native build/capture/scene은 **83.510/53.018/57.143ms**, bytecode는 **136.536/78.467/73.269ms**였다. Source 객체나 callback을 제거한 대조가 아니며 이 한 pass로 전체 경로의 상한을 보장하지 않는다. native Source terminal은 published **63**, declined **4**, cohort-changed **30**, closed **5**, pending·overwrittenPending **0**이었다. native preparation terminal은 published **49**, continued **9**, superseded **31**, pending·order 오류 **0**이다. 실제 demand 생성과 전체 coverage-ready chain은 계속 notVerified다.

Native Contact의 ±0.4/±0.8 page 양방향 네 접촉은 각 **36 updates / 약 200.5ms / 180Hz**, 활성 게시 **23/25/27/25**, 최대 consumed-offset 오차 **8.8e-11 이하**였다. 최대 입력→게시 지연은 각각 **26.521/13.338/12.034/15.408ms**다. 준비된 구간의 이동 경로가 동작한다는 근거이며 cold 연속 이동 실패를 덮지 않는다. 네 접촉·resize anchor·연도·날짜·종료 기능을 PASS했다. 이 시나리오의 전체 movement/coverage 목표는 notVerified다.

위 네 실행은 ring loss/output drop **0**, close reserved/memory **0**, workers joined·CLI/App exit **0**을 확인했다. 물리 trackpad·scanout·원본 visual·resize 성능은 미검증이다. Web은 이번 새 공급의 빌드/파일 정합성까지 재검증했으며, 같은 Web JS의 두 profile 기능 근거는 §13.15다. 이번에 새 Web UI 실행을 했다고 표시하지 않는다.

**현재 실행 선택:** Demo Windows는 `buildEngineV2Application`의 명시적 `nativeUnitInputs`로 만든 실험 후보다. `run`은 검증된 manifest로 native를 선택하지만 일반 build의 기본값은 bytecode다. CLI/config/template 전환·compiler 입력 공급·전체 public API/플랫폼·native coverage와 추가 거부 계약은 열려 있다. 실제 부재중 3배속 증상은 아직 해결하지 못했으므로 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**를 유지한다.

### 13.18 native 함수 지도에 연결한 제한된 Source 스택 관찰

고정 pin의 `SamplingProfiler::walkRuntimeStack`는 bytecode/NativeFunction을 처리하고 SH unit Source 프레임은 건너뛴다. 해당 profiler로 native Source 함수 비용이 보인다고 가정하지 않았다. 기존 host stats의 실제 App thread ID와 소유 프로세스 생성 FILETIME을 확인한 뒤, [windows-source-sampler.cpp](Nelyx/eng/windows-source-sampler.cpp)와 [check-native-source-profile.mjs](Nelyx/eng/check-native-source-profile.mjs)로 **가상 3배속 12개월 한 구간**만 관찰했다. product VM/compiler나 실행 경로는 바꾸지 않는다.

최대 **256 표본 / 표본당 48 frame / 512KiB stack**만 사용한다. PID·생성 시각·thread 소유자·실제 loaded image를 대조하고, snapshot을 위해 잠깐 정지한 thread는 RAII로 원래 suspend count에 복구한다. 첫 구현의 약 **497ms** 누적 정지는 침습적이라 채택하지 않았다. 최종 구현은 stack을 복사한 즉시 App을 재개한 뒤 복사본과 image의 unwind 정보를 읽는다. 최종 실행의 활성 표본 **249개**, App frame 포함 **244개**, PC 미매핑·alias 모호성 **0**, 전체 frame 상한에 걸린 표본 **107개**, 정지 최대/누적 **0.136/15.018ms**였다. Source의 실제 C 함수 위치까지 연결됐지만 wall-time stack 표본·최근접 App caller와 제한된 inclusive 관찰이며 instruction CPU self time이 아니다. Native 호출 안의 시간과 잘린 상위 frame도 구분해야 한다.

최근접 App caller에는 native `post`와 observation `prepare`가 각각 **11개**, Scene `adopt` **7개**, default config 비교와 blob hash가 각각 **6개** 포함됐다. `buildScope`의 관찰된 inclusive 표본 **83개**, capture node **46개**, Scene perform **39개** 등으로 작업이 여러 경계에 남아 있다. 이 값으로 생성자 하나가 단독 원인이라고 확정하거나 전체 CPU 비율/개선율을 계산하지 않는다. 첫 침습적 실행의 constructor 순위를 채택하지 않는다.

두 진단 실행은 기능·정상 종료와 임시 실행파일 회수를 확인했지만 **성능 수락 표본에서 제외**한다. 최종 변경 후 수기 코드 format/lint와 현재 공급/네 App/Source 입력을 다시 확인했다. 소유 compiler·App·sampler 프로세스, 검사 임시 폴더와 교체 staging은 남지 않았다. 로그·profile·receipt/history 파일을 누적 보관하지 않는다.

**다음 구현 경계:** warm 입력이 정상이어도 여러 cold 월의 Source 자손 build와 capture/Scene가 한 동기 경계에 묶인 비용은 남는다. 원래 callback·Element/State/Focus·ref/ACK 계약을 유지하며 관찰 row/Scene 장부의 반복과 cold 투영·실제 자손 처리의 중간 작업을 코드에서 더 줄여야 한다. 가변 Source를 불변으로 간주하는 cache, 이미 철회한 constructor/Inherited 슬롯·지연 index 후보, 원래 resident 창/lead 확대나 입력 감속을 새 해결책으로 반복하지 않는다. 준비 batch를 나누는 설계가 필요하면 같은 창 안의 실제 수명·완전한 Document 게시·publication fence를 먼저 증명해야 하며, 현재 코드에서 그것이 이미 구현됐다는 뜻은 아니다.

### 13.19 관찰 row의 private helper 호출 제거 — 기능 PASS / 성능 FAIL

[observation-row.ts](Nelyx/runtime/engine-client/observation-row.ts)의 비공개 scalar/unsigned/handle/BigInt/rect 읽기 5개를 module 함수로 옮겨 getter 29곳에서 직접 호출했다. eager scalar 검증·private WeakMap backing·relocation·lazy cache·freeze·공개 getter는 유지했다. 같은 pin의 HBC 표본과 실제 App 생성 C에서 별도 reader 함수/중첩 method lookup이 사라지는 것을 확인했다. 공개 Source 객체·callback·준비 창·입력·animation을 줄이지 않았다.

관찰 delta의 immutable row·backing 이동·64/2048-node 전체 oracle·removal/recycling·resync·quota/NACK/close 검사와 전체 타입이 PASS했다. Core/SDK·engine native/single-worker/threaded·Windows host·네 App 재생성을 마쳤다. engine은 **`59b5ef9f049541aaf487acc6fc3e51ac0df09f9ebe552f95ff6d64247102cb22` / 360 files / ABI 2 / schema 313408118**, package Source 입력 **714/134/284 modules**와 전체 manifest 파일이 일치한다. Demo Windows JS/HBC는 **`6e2f0abea95f1b7ed16ef5ef6a60d6f801b48239461f3a0aa472d64ed6ffe6e8` / `1f5b9be0a29f446d8c4b270f7141040ba3e05437868c6d8f99c8bde906cfe0b3`**, native DLL은 **`c094ba3a3238a47a3115fdec7ac8b8a921cbe79873acc10217cfaea2690ffb91` / 60,973,056 bytes**다. 현재 map **21,419,058 bytes / 30,678 native functions**의 image hash도 실제 DLL과 일치한다.

컴파일·다른 검사와 겹치지 않은 Calendar 3배속은 **360 updates / 실제 2,000.181ms / 180Hz**, 360개 모두 반영·누락/거부 **0**, 12개월·resize anchor·연도/날짜·정상 종료 검사 exit **0**이었다. 이동 지연 **233.678/272.895ms**, offset 정체 **최대 228ms / ≥100ms 10회 / ≥250ms 0회**로 성능 FAIL이다. 앞선 native 실행과의 작은 차이를 유의미한 개선율로 해석하지 않는다. 이번 출력 수신에서 큰 진단 부분이 잘렸으므로 새 cold pass별 비용·Source terminal 수치는 기록하지 않는다. 소유 CLI/App의 종료를 확인했다.

Web isolated/plain의 각각 12회 왕복·resident/Element/builder 상한·grid/header·resize anchor·연도/날짜·close가 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877 / 4,545 / 3**이며 reserved 0/workers stopped를 확인했다. 24 gesture는 목표 32ms/6 updates/600px, 실제 **38.6–112.3ms**의 지연 주입/RPC 기능 검사이며 3배속 성능 수락이 아니다.

목표는 **active / PARTIAL / performanceAccepted=false**다. 전체 native/API/default CLI 전환, setter·adapter, 실제 demand 생성/coverage 인과, UIA 소비자·원본 visual·물리/scanout/resize 성능과 다른 플랫폼 의무는 그대로 열려 있다. 다음 구현은 실제 관찰 장부의 전체 노드 반복을 줄이며, 필수 Source 수명이나 resident 정책을 바꾸지 않는다.

### 13.20 관찰 membership/index의 전체 반복 제거 — 정확성 PASS / 성능 FAIL

[ObservationStream](Nelyx/runtime/engine-client/observation-stream.ts)은 tombstone·order 교체가 없는 delta의 모든 changed handle/generation을 현재 집합과 대조한 뒤 검증된 membership을 재사용한다. 새 handle, generation 교체, 같은 크기의 잘못된 대체는 계속 거부하고 order 교체/removal/full resync는 전체 검증을 유지한다. 공개 row 배열·원래 snapshot·backing/registration·검증 완료 후 commit은 유지했다. [node index](Nelyx/runtime/engine-client/node-index.ts)는 불변 row 배열을 key로 사용해 같은 배열을 공유하는 response metadata 변경에서 index를 다시 만들지 않는다. 새 배열과 재활용 generation은 독립적으로 조회한다.

위조 delta·재정렬·generation 교체·오래된 snapshot, 실제 64/2048-node local 변경의 bounded order 검사와 전체 row oracle, quota/NACK/resync/close 및 notification/focus index 회귀가 PASS했다. 전체 workspace 타입, 수작업 TS/MJS **62개** format/lint·diff도 PASS다. Core/SDK와 engine·네 App을 재생성했고 Source 입력 **714/134/284 modules**, 전체 파일 hash, 현재 engine Source identity가 일치한다.

engine은 **`d351594cb9b569c7c1da69f3eac0ccd3012b28ea3e854a59d46e12d14a432307` / 360 files / ABI 2 / schema 313408118**이다. Demo Windows JS/HBC는 **`422edc1acab757b55d008364d34643237e1e8f2a3389dd7440547ec6f229c850` / `cc85de867232b588ae197eb370a37dfcf0d60680508910e7afcc996de79ebc7a`**, native DLL은 **`7bab08e3033044d4273a09f8200230b909a953290b640ce6ce4e0253e27517ac` / 60,972,032 bytes**다. map **21,419,210 bytes / 30,678 native functions**의 image hash도 실제 DLL과 일치한다.

컴파일·다른 검사와 겹치지 않은 Calendar 3배속은 **360 updates / 실제 2,000.235ms / 180Hz**, 전부 반영·누락/거부 **0**, 12개월·resize anchor·연도/날짜·close 기능 PASS다. 이동 지연 **324.368/413.155ms**, offset 정체 **최대 321ms / ≥100ms 9회 / ≥250ms 1회**로 성능 FAIL이다. driver lateness **0.514/2.096ms**, publication 공백 최대 **33.378ms**, 활성 App turn **137.517/194.890ms**와 구분한다. 직전 후보보다 실행 지연이 커졌으며 반복 제거를 제품 성능 개선으로 수락하지 않는다.

cold pass 35(input 12)는 신규/captured **784/797**, bindings/adapters **790/7**, 문단 **76/76**, build/capture/scene **85.743/51.805/62.793ms**였다. Source는 **104 calls**, published **62** / declined **6** / cohort-changed **32** / closed **4**, overwrite **0**이다. native terminal은 published **54** / continued **9** / superseded **32**, 마지막 관찰 시 pending **1**·역순 **0**이다. 종료는 reserved/memory **0**, workers joined·CLI/App exit **0**, ring loss/output drop **0**으로 확인했다. 마지막 관찰 pending과 실제 종료 후 자원 회수를 같은 시점으로 혼동하지 않는다.

Web isolated/plain의 각각 12회 왕복·기존 상한·grid/header·resize·연도/날짜·close가 PASS했고 마지막 node/Element/builder는 **1,787/4,455/3**, resize 뒤 **1,877/4,545/3**다. isolated의 한 stream은 12회 뒤 membership을 **332회** 재사용했으며 그 외 실제 변경의 order 검사도 유지했다. 이는 회피한 장부 작업의 근거이고 Windows 전체 효과 수락은 아니다.

다음 layout encoder 후보는 별도의 메모리 대조에서 **12개 wire/getter/예외 순서 표본 PASS**, 실제 pinned HBC에서 명령 함수의 callback 생성 **1→0**, scalar/positioned 임시 배열과 forEach/entries 호출 제거를 확인했다. HBC register는 **25→53**으로 바뀌었으므로 함수 호출 제거만으로 채택하지 않고 실제 Native App에서 다시 판정한다. 아직 해당 후보의 전체 실행 성능 근거가 아니다. 목표와 §13.19의 미완료 의무는 계속 **active / PARTIAL / performanceAccepted=false**다.

### 13.21 layout encoder 임시 표현 제거 — 의미 PASS / 효용 미입증으로 철회

generic layout encoder의 body writer를 직접 module 함수로 옮기고 scalar 배열/forEach 및 positioned entries 임시 표현을 줄이는 후보를 실제로 적용했다. 모든 scalar getter를 먼저 읽은 뒤 검증하는 원래 순서, positioned getter 6회, 오류 우선순위·identity와 signed zero를 보존했다. 메모리에서 원래 구현과 대조한 12개 표본, 실제 debug/optimized HBC 및 Native unit의 4개 계약 표본, 13개 box module의 adapter wire·재진입·부모 필드·NACK·incremental capture가 PASS했다. [공유 계약 fixture](Nelyx/eng/layout-encoder-fixture.mjs)는 회귀 검사로 남긴다.

Core/SDK·engine·네 App, 현재 Source 입력 **714/134/284 modules**, 전체 타입과 수작업 TS/MJS **64개** format/lint·파일 hash 검사를 PASS했다. 해당 검증 공급은 engine **`d22d3e060adf3626f75fcec6bcbd73ea11f4be30cda00806bfe71bcf5cdd7cfc` / 360 files / ABI 2 / schema 313408118**이다. Demo Windows JS/HBC는 **`1f30ec3b1f80f6d1e976b4c01ee24981b668448f5e3ca7403b9819c5d909bcb0` / `7cd1b4dafc78137c28832c93ab1908e27f34ce4d73362639d58a1f0d687b7263`**, native DLL은 **`9719b7044f179dce651591fcffbd23e990386783159429763f6b30b789e17feb` / 60,978,688 bytes**다. map **21,418,281 bytes / 30,676 native functions**의 image hash가 실제 DLL과 일치한다.

컴파일·다른 검사와 겹치지 않은 Calendar 3배속은 **360 updates / 실제 2,000.315ms / 180Hz**, 전부 반영·누락/거부 **0**, 12개월·resize anchor·연도/날짜·종료 기능 PASS다. 이동 지연 **365.314/463.731ms**, offset 정체 **최대 244ms / ≥100ms 10회 / ≥250ms 0회**로 성능 FAIL이다. Source/투영의 긴 동기 구간도 남았다. 입력 lateness **0.511/3.263ms**, ring loss/output drop **0**, close reserved/memory **0**, workers joined·CLI/App exit **0**을 확인했다. Web 두 profile도 각각 12회 왕복·기존 상한·grid/header·resize·연도/날짜·정상 close 기능을 PASS했다. 성능 수락이나 원본 visual/물리/scanout 검증은 아니다.

임시 표현 제거와 함수 2개 감소를 실제 효용으로 바꿀 근거를 얻지 못해 **production layout encoder 후보를 전부 철회**했다. `codec.ts`가 적용 전 SHA-256 **`29ac4e706986e5406a77af13bb8cb4ff26db7be0ca66bfe8deda8203c021227d`**와 정확히 같은 것을 확인했다. Native/HBC 계약 fixture만 남겼다. 철회 직후 dist는 위 철회 전 검증 산출물이었다. 이후 §13.22에서 새 Source와 함께 갱신·검증했다. 반복 검사를 늘려 이 실행을 PASS로 만들지 않는다.

### 13.22 Scene key 표현과 commit 구간 분리 — 의미·기능 PASS / 성능 FAIL

Scene 장부의 `id`가 handle 비교·record/edge/depth/topology/입력 lookup마다 `slot:generation` 문자열을 만드는 것을 코드에서 확인했다. private key의 일반 경로를 정확한 정수로 바꿨다. **uint32 slot + 0부터 2^21−1까지의 generation은 최대 `Number.MAX_SAFE_INTEGER`까지 충돌 없이 표현**하며, 그 밖의 generation은 전체 pair 문자열을 사용한다. slot만으로 조회하거나 generation을 잘라내지 않는다. 기존 getter 읽기와 비숫자 slot의 ToString/예외 순서, public wire/handle·Source 객체·callback·resident 범위는 유지한다.

현재 private 함수 본문을 읽는 [경계 fixture](Nelyx/eng/scene-key-fixture.mjs)의 **17개 표본**에서 uint32 최대·safe-integer 경계·서로 다른 generation·signed zero 및 getter/변환/예외 순서를 대조했다. Node와 실제 고정 Hermes의 debug/optimized HBC·Native unit에서 PASS했다. layout 계약 4개도 함께 PASS했고 Native 언어·field/async 표본의 합계 **6,438,000**이 bytecode와 일치했다. binding/reset/reparent/recycling/NACK·capture·gesture·notification·box 회귀, 전체 workspace 타입과 수작업 TS/MJS **67개** format/lint, PowerShell parser·diff 검사를 PASS했다. private Map의 문자열 표현을 직접 가정하던 검사만 handle 값 조회로 바꿨으며 wire/order oracle은 유지했다.

Core/SDK·engine·네 App을 재생성했고 Source 입력 **714/134/284 modules**, 전체 manifest 파일과 현재 engine Source identity가 일치한다. engine은 **`d351594cb9b569c7c1da69f3eac0ccd3012b28ea3e854a59d46e12d14a432307` / 360 files / ABI 2 / schema 313408118**이다. §13.21의 codec 철회로 provider graph는 §13.20과 같아졌고, App/runtime 변경은 별도의 App JS hash에 반영된다. Demo Windows JS/HBC는 **`440d56d769d7b308aeb6a6238486462581a596a8563347d7ce5e025e72907860` / `d0ace8f9ecf5709f49229cb7624fbda902ca1146784748400af157918a387674`**, native DLL은 **`f45b6a4d229cc92c9004d9176b6c4c712f3f294b47665d5c2f2fef131673b123` / 61,026,816 bytes**다. map **21,419,344 bytes / 30,678 native functions**의 image hash도 실제 DLL과 일치한다. Demo Windows는 명시적 native unit, Testbed Windows는 bytecode이며 기본 CLI의 제품 전환은 아니다.

컴파일·Web·다른 CPU 검사를 모두 끝낸 뒤 아래 Windows 실행을 각각 단독 수행했다. 입력 시계만 3배속이며 원래 거리·표본 수·200ms animation·resident 정책·수락 기준은 유지한다.

| 실행 | 실제 입력·기능 | 이동 게시 지연 p95 / 최대 | offset 무진행 최대 / ≥100ms |
| --- | --- | --- | --- |
| Native Calendar / 12개월 / YearMode | **360 updates / 2,000.445ms / 180Hz**, 반영 360·누락/거부 0, 12개월·resize anchor·연도/날짜·종료 PASS | **245.097 / 289.740ms — FAIL** | **233ms / 10회 — FAIL**, ≥250ms 0 |
| Native Fast / 이동 중 lift·재접촉 12회 | **96 updates / 757.082ms**, start/update/end 120개 승인·거부 0, **24개월 역방향**·연도/날짜·종료 PASS | 이 궤적에서는 notVerified | **260ms / 4회 — FAIL**, ≥250ms 1 |

Calendar의 driver lateness p95/최대는 **0.504/0.893ms**, publication 공백 최대 **28.971ms**, 활성 App turn **129.918/184.184ms**였다. 앞선 실행과 공급·경로가 완전히 같은 단일 변수 대조가 아니므로 key 변경만의 개선율이나 해결로 해석하지 않는다. 정수 key의 의미와 기능은 확인했지만 전체 성능 수락은 계속 실패다.

`sceneMs`가 순수 기록·비교 CPU가 아닌 점을 구분하려고 owner counter의 records/diff와 비동기 commit/recovery 구간을 별도로 연결했다. `sceneWork`는 해당 update 동안의 counter delta이며 interleaved owner 작업을 포함할 수 있다. CPU self time·activation·coverage 증명이 아니다. 같은 cold pass **36 / input 12**는 신규/captured **784/827**, 문단 준비/직접 bindings **76/76**, build/capture/scene **80.855/50.761/68.193ms**였고 records/diff/commit은 **10/27/6ms**, commit/build 각 **1회**였다. scene의 나머지 구간을 전부 특정 함수 비용으로 배정하지 않는다. 활성 pass 47(input 44)은 신규 **398**, build/capture/scene **84.549/36.027/39.520ms**였다. Fast의 두 cold 월 pass 43(input 72)은 신규 **776**, **115.941/59.332/59.598ms**, records/diff/commit **6/31/13ms**였다. 비동기 ACK 대기 하나로 긴 Source 자손 실행을 설명할 수 없다.

첫 Calendar 출력은 retained cold 표본의 앞 **24개**와 생략 **14개**를 기록했다. 초기화가 뒤쪽 cold pass를 밀어내는 점을 확인해 checker만 생성량이 큰 **24개**를 먼저 고른 뒤 pass 순서로 출력하도록 바꿨다. Fast 출력의 `coldSampleScope=retained-created-largest24`, 생략 **7개**와 parser PASS를 확인했다. 기존 전체 aggregate·상위 5개 비용 표본·입력·Source 작업은 유지하며, 선택된 표본을 전체 활성 구간으로 확대하지 않는다.

Calendar의 Source **107 calls**는 published-coverage **68** / declined **6** / cohort-changed **29** / closed **4**, pending·overwrittenPending **0**이다. native **104 cohort**는 published **63** / continued **9** / superseded **32**, pending·역순·pending overwrite **0**이었다. 권위 request **42개**를 연결했지만 실제 demand 생성은 **notObserved**, 전체 demand→coverage는 **notVerified**다.

Native Contact의 ±0.4/±0.8 page 네 접촉은 각각 **36 updates / 200.121–200.467ms / 180Hz**, 활성 게시 **26/27/31/25개**, 최대 consumed-offset 오차 **8.74e-11px 미만**이었다. 최대 입력→게시 지연은 **11.883/11.752/11.648/12.717ms**다. 양방향 이동·resize anchor·연도/날짜·종료 기능을 PASS했으며 준비된 범위의 근거다. 전체 cold 이동·coverage·물리/scanout/resize 성능 수락은 아니다. 세 Windows 실행 모두 ring loss/output drop **0**, close reserved/memory **0**, workers joined·CLI exit **0**·App exit를 확인했다.

Web isolated/plain은 각각 12회 왕복·기존 resident/Element/builder 상한·grid/header·resize anchor·연도/날짜·정상 종료를 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877 / 4,545 / 3**, close reserved **0 / workersStopped=true**다. 24 gesture의 목표는 6 updates/600px/32ms이며 의도적 App 지연/RPC를 포함한 기능 검사다. 실제 Windows의 180Hz 연속 입력과 같은 성능 수락으로 쓰지 않는다. 소유 App/CLI와 일회성 build staging·이전 출력·검사 임시 자원의 회수를 확인했고 current dist만 남겼다.

**계속할 경계:** 목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**다. 다음 수정은 여전히 긴 실제 Source 자손 생성과 capture/record의 중간 작업, 기존 필드 journal의 소비 경로를 줄이는 데 집중한다. 월 header rebuild의 요청 창 보존 로직은 이미 있으므로 같은 가설을 새 해결책으로 반복하지 않는다. full setter/API/default CLI/native coverage·실제 demand 인과·UIA 전체 소비자·원본 visual·물리/scanout/resize·다른 플랫폼 의무는 열린 상태다.

### 13.23 공통 box 명령 body 공유 — 의미·기능 PASS / 성능 FAIL

canonical box sink가 같은 destination-free layout/constraint/policy body를 새 Render/SceneReference마다 반복 생성하는 경로를 코드에서 확인했다. 고정 layout 7개는 framework 내부 상수로 공유하고, 제약은 getter를 원래 자식 처리 뒤 순서로 매번 읽은 후 숫자 4개가 모두 같을 때만 body를 재사용한다. host와 nested sink는 제약 8개·정책 8개의 bounded 표를 공유한다. Source/render/constraint 객체·callback·ACK 상태는 보관하지 않는다. parent 필드와 mutable 값은 기존 Source/codec 순서를 유지한다.

**고정 body 단계 검증:** Node 및 고정 Hermes의 debug/optimized HBC·Native unit에서 제약 8개·고정 layout 7개·정책 9개, signed zero/Infinity·상한/eviction·가변 layout getter를 대조했다. 13개 모듈의 원래 adapter wire·ParentData·live callback·getter/예외·재진입, 새 Reference 사이의 재사용·가변 제약 재읽기·destination 변조 격리, 기존 reset/reparent/generation/NACK와 capture·gesture·notification이 PASS했다. 전체 타입·Core/SDK·네 App과 68개 수작업 파일의 format/lint·diff도 PASS했다. provider graph와 engine은 d351594c…4a432307로 동일해 불필요한 C++/Wasm 재빌드는 생략했다.

이 단계의 Demo Windows JS/HBC는 **`00b8c4f7d31853c8d826abeaba2a7039509d1a00964b03458f247905583dd504` / `0abc6a6451b2837a141c03e96a53c14c2615cd8bec6558119e2db85c9c497b16`**, native DLL은 **`53b905d1c5133c03915eece83a02149ddde701a2673e301caf642aa63c4f9ab1` / 61,045,248 bytes**다. map **21,425,172 bytes / 30,685 functions**의 실제 image hash와 전체 manifest/Source 입력 **714/134/284 modules**를 확인했다. Web 두 profile은 각각 12회 왕복·기존 상한·resize·연도/날짜·close PASS다.

컴파일·다른 CPU 검사를 모두 끝낸 뒤 Calendar 3배속은 **360 updates / 2,000.116ms / 180Hz**, 반영 360·누락/거부 0, 12개월·resize anchor·연도/날짜·종료를 PASS했다. 하지만 이동 **244.462/274.555ms**, offset **최대 240ms / ≥100ms 10회 / ≥250ms 0회**로 **성능 FAIL**이다. driver lateness **0.508/0.583ms**, ring loss/output drop **0**, close reserved/memory **0**, workers joined·CLI exit 0·App exit를 확인했다. 실제 body 재사용 **1,165회**와 command encode **2,219회**를 기록했지만 전체 지연 개선으로 승격하지 않는다. 같은 초기 두 cold 월 pass 35(input 12)은 신규/captured **784/827**, build/capture/scene **90.323/67.797/53.684ms**, records/diff/비동기 commit **11/28/6ms**였다.

**숫자 layout 확장:** 기존 cold module vector의 padding·alignment가 각각 **66/76개**인 경로를 대상으로, live padding 4개와 미리 읽은 alignment/factor 4개의 body 공유를 추가했다. 숫자 layout 표도 최대 **8개**이며 Source getter는 매번 원래 단계에서 읽는다. getter가 뒤에서 던지는 예외가 앞선 NaN 검증보다 먼저 나는 순서도 대조했다. canonical host가 소유한 private layout wrapper에만 적용하고, ParentData가 합쳐진 layout이나 임의 parent callback은 원래 codec 경로다. Source 입력의 revision/freeze cache를 만들지 않는다.

새 scalar 표본 5개와 Node/HBC/Native 의미, live getter·자식 변경·오류·ParentData·기존 NACK 회귀가 PASS했다. optional padding 선언의 타입 불일치를 수정한 뒤 Core/SDK·전체 workspace 타입도 다시 PASS했다. 수작업 TS/MJS **68개** format/lint와 네 App 재생성·Source 입력 **714/134/284 modules**·전체 manifest 파일 hash를 PASS했다. provider graph는 그대로이므로 engine은 **`d351594cb9b569c7c1da69f3eac0ccd3012b28ea3e854a59d46e12d14a432307` / 360 files / ABI 2 / schema 313408118**이다.

최신 Demo Windows JS/HBC는 **`d9bdfe0a15efe9bbda00e0f5a2ef07f4113e99aac1599172116c723ac2817228` / `4cec39f57c0d5fc003d04a18b6a15ffddc8ee383db2ed90cd1fe2f243822f62e`**, native DLL은 **`4aa576bf2796ed8b29c2a6bcbf9be5dbe18175dc684c2f7170fdea4df4bbba37` / 61,057,536 bytes**다. map **21,427,783 bytes / 30,688 functions**의 image hash도 실제 DLL과 일치한다. Demo Web은 **`4f6edd80ab21571595cf9e38760581a971620bdce449e9c31441458b8da852cc`**, Testbed Windows JS/HBC는 **`825e43d9994b06d22d722e0618ccc84a8377050f8383da797c6b20d9f0503442` / `25c06bebad9940f9d318da56a9c1abb495616d681c287f465aba3c8fa562355b`**, Testbed Web은 **`f1d27fde4bb00a7deaaf888164fe782a26659a543dee43a007f212d2432fa695`**다. Hermes pin·표준 -O·HBC99와 기본 CLI bytecode 정책은 유지한다.

컴파일·Web·다른 CPU 검사가 끝난 뒤 아래 Windows 실행을 각각 단독 수행했다. 입력 거리·표본 수·animation·resident 정책과 성능 수락 기준은 유지했다.

| 실행 | 실제 입력·기능 | 성능 판정 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | **360 updates / 2,000.387ms / 180Hz**, 전부 반영·누락/거부 0, resize anchor·연도/날짜·종료 PASS | 이동 p95/최대 **231.096/265.107ms**, offset **최대 220ms / ≥100ms 10회 / ≥250ms 0회 — FAIL** |
| Fast / 이동 중 lift·재접촉 12회 | **96 updates / 751.715ms**, start/update/end 120개 승인·거부 0, **24개월 역방향**·연도/날짜·종료 PASS | offset **최대 256ms / ≥100ms 3회 / ≥250ms 1회 — FAIL**; 이 궤적의 이동 p95는 notVerified |
| Contact / 준비된 ±0.4·±0.8 page 네 접촉 | 각각 **36 updates / 200.146·200.370·200.560·200.286ms / 180Hz**, 입력/offset 오차 최대 **8.8e-11px**, resize·연도/날짜·종료 PASS | 접촉별 최대 게시 지연 **12.049/13.162/11.988/15.466ms**; 전체 cold·scanout·물리 성능은 notVerified |

Calendar의 driver lateness p95/최대는 **0.521/1.385ms**다. 총 command 경로 **3,384회**와 module vector **[0,0,323,194,742,284,808,266,21,24,139,50,3,4]**는 이전 단계와 같으며, 새 인코딩은 **211회 / body 33,320 bytes**, 재사용 **3,173회**였다. 이 작업 제거를 전체 지연 개선율로 해석하지 않는다. 두 cold 월의 pass 38(input 12)는 신규/captured **784/827**, build/capture/scene **92.039/42.184/43.231ms**, records/diff/비동기 commit **7/24/6ms**였다. 활성 pass 51(input 34)도 신규 **398개**, build/capture/scene **103.380/51.070/36.136ms**로 긴 동기 Source 처리가 남았다.

Calendar Source **102 calls**, published-coverage **65** / declined **2** / cohort-changed **30** / closed **5**, failed/rejected/overwrite **0**이다. native terminal은 published **63** / continued **10** / superseded **30**, pending·역순·overwrite **0**이다. 실제 demand 생성은 notObserved이며 전체 demand→coverage는 notVerified다. 네 Windows 검사 모두 ring loss/output drop **0**, close reserved/memory **0**, workers joined·CLI exit 0·App 종료를 확인했다.

Web isolated/plain은 각각 12회 왕복·grid/header·resident/Element/builder 상한·resize·연도/날짜·close가 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877/4,545/3**, close reserved **0**·workers stopped다. 24 gesture의 6 updates/600px/목표 32ms 지연 주입은 Web 기능 근거이며 Windows 3배속 성능 수락이 아니다.

**같은 접촉 안의 반전 검사:** 기존 Fast는 한 방향의 빠른 재접촉, Contact는 준비된 짧은 왕복이다. 별도의 `CalendarReversal`은 90개 전진/90개 후진 업데이트, 접촉 중 lift·settle·cancel 없이 논리 거리 각 3개월을 보낸다. parser·Windows PowerShell 5.1 C# helper compile 뒤 최신 native App에서 **180 updates / 1,000.284ms / 180Hz**, start/update/end **182개** 승인·거부 0을 확인했다. native requested offset의 누적 delta 오차 **3.64e-11px**, 실제 게시 양방향 진행과 최대 이탈 **2.933333 pages**, 최종 원래 2026년 11월·15일 선택·종료 PASS다. driver lateness **0.514/0.580ms**, offset 무진행은 **최대 211ms / ≥100ms 4회 / ≥250ms 0회**였다. 비단조 궤적에 기존 직선 이동 p95를 적용하지 않으며 궤적 정합 PASS와 전체 성능 notVerified를 구분한다. 이 시나리오에는 연도 전환·resize를 넣지 않았다.

목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**다. 기본 CLI/native 제품 전환·전체 setter/API·demand 인과·UIA 소비자·visual·물리/scanout/resize·다른 플랫폼 의무는 유지한다.

### 13.24 선택적 Inherited provider의 누락 결과 보존 — 의미·기능 PASS / 성능 FAIL

Source 경로를 읽고 `DependencyScope`의 네 칸 표가 실제 provider와 누락 결과를 함께 보관해 반복 조회가 서로 밀려나는 후보를 찾았다. 현재 Web App에만 메모리에서 계수를 넣은 두 gesture 관찰은 시작 이후 ancestor link **78,930회**, 그중 누락된 DatePickerTheme·Visibility·DefaultAssetBundle이 **56,439회**였다. 호출·link 수이며 CPU 시간이나 Windows 성능 비율이 아니다. 상시 profiler나 로그 파일을 추가하지 않았다.

기존 immutable ancestry index 안에서 provider 결과 Map과 누락 결과 Set을 각각 최대 **4개**로 분리했다. 원래 provider Element 참조를 계속 쓰고 누락 token만 별도 보관하며, Source 값 snapshot·callback·State·resident 창은 줄이거나 새로 공유하지 않는다. 새 link·shadowing·GlobalKey 활성화와 동적 type token의 기존 fallback은 유지한다. [현재 구현 fixture](Nelyx/eng/dependency-scope-fixture.mjs)의 64개 link·24회·24,576 query oracle, 독립 상한/eviction·live 값은 Node와 고정 Hermes의 debug/optimized HBC·Native unit에서 PASS했다. [실제 Element 검사](Nelyx/eng/check-dependency-scope.mjs)의 의존성 알림·GlobalKey 이동·동적 type token·종료 및 reconciliation·construction·binding/NACK·incremental capture도 PASS했다.

전체 workspace 타입·수작업 TS/MJS **71개** format/lint·PowerShell parser·Core/SDK·네 App 재생성과 Source 입력 **714/134/284 modules**·전체 manifest 파일 hash를 PASS했다. engine은 **`d351594cb9b569c7c1da69f3eac0ccd3012b28ea3e854a59d46e12d14a432307` / 360 files / ABI 2 / schema 313408118**로 같다. 최신 Demo Windows JS/HBC는 **`089615723ce4114044cd75742eaf139e3a779bbd336a9f11968001b7b278c2c8` / `5387195a3c1998a500216ac794ca6d48fc97e0fc90613ff5cb4ad4d8b60477fb`**, native DLL은 **`39dc1607125a829f5d87021afd609f48df765d9190d425f59f8435e551419d20` / 61,059,584 bytes**다. map **21,427,783 bytes / 30,688 functions**의 image hash도 실제 DLL과 일치한다. Demo Web은 **`9419ca999cde414bbe5b2e90287cbc948429e5c098e5bb7450ceac16ac89575a`**, Testbed Windows JS/HBC는 **`709d56aed3a74ce60d21ed50dc457ed8c2c8a1612861113d68e1884eb146a509` / `332b93f9d9d62f211ef2b76b716096bb38b877a0693ac5d0728b72c22b845432`**, Testbed Web은 **`fc34374b8ebeaff4785d6678f8a1e14d0e7f0f973f11b0a6fb2152d3708de862`**다. 같은 Hermes pin·표준 -O·명시적 Demo native 선택과 기본 CLI bytecode 정책을 유지한다.

**연도 검사 첫 실패와 대기 보강:** 첫 Calendar 실행은 360개·12개월을 반영했지만 연도 선택 후 기대한 November 2027 대신 November 2030이 관찰되어 검사 exit **1**이었다. 이 실행을 기능 PASS로 사용하지 않는다. 검사기의 `Click-Peer`는 모드 전환 뒤 고정 200ms만 기다려, 초기 scroll/layout 중의 UIA rectangle을 클릭할 가능성이 있었다. 연도 peer 출현 뒤 기존 `Settle`을 수행하고 좌표를 다시 읽어 **한 번만** 클릭하도록 보강했다. target label·handle·rectangle과 document/publishedDocument를 출력한다. active 3배속 구간·속도·거리·성능 기준은 바꾸지 않았다. 이후 Contact·Calendar·Fast에서 각각 **2026/2027/2024년** 선택과 원래 월 복귀가 PASS했다. 첫 실패의 정확한 실제 hit target을 사후 확정한 것은 아니며 전체 UIA/물리 소비자 수락으로 승격하지 않는다.

컴파일·Web·다른 CPU 검사가 끝난 뒤 Windows를 각각 단독 실행했다. 첫 실패는 위와 구분하며, 아래는 검사 대기 보강 이후의 최신 결과다.

| 실행 | 실제 입력·기능 | 성능 판정 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | **360 updates / 2,000.311ms / 180Hz**, 전부 반영·누락/거부 0, resize anchor·연도/15일 선택·종료 PASS | 이동 p95/최대 **213.957/262.263ms**, offset **최대 256ms / ≥100ms 10회 / ≥250ms 1회 — FAIL** |
| Fast / 이동 중 lift·재접촉 12회 / YearMode | **96 updates / 758.218ms**, start/update/end 120개 승인·거부 0, **24개월 역방향**·연도/15일 선택·종료 PASS | offset **최대 228ms / ≥100ms 4회 / ≥250ms 0회 — FAIL**; 이동 p95는 notVerified |
| CalendarReversal / 같은 접촉의 각 3개월 왕복 | **180 updates / 1,000.323ms / 180Hz**, 182개 승인·거부 0, requested 오차 **5.83e-11px**, 실제 최대 이탈 **3 pages**·양방향 게시·원래 월·15일 선택·종료 PASS | offset **최대 166ms / ≥100ms 4회 / ≥250ms 0회**; 비단조 이동 p95/전체 성능은 notVerified |
| Contact / 준비된 ±0.4·±0.8 page 네 접촉 / YearMode | 각각 **36 updates / 200.521·200.164·200.208·200.307ms / 180Hz**, 오차 최대 **8.74e-11px**, resize·연도/15일 선택·종료 PASS | 접촉별 최대 게시 지연 **13.930/13.283/12.572/13.476ms**; 전체 cold·scanout·물리 성능은 notVerified |

Calendar driver lateness p95/최대는 **0.521/8.194ms**였다. command 인코딩 **211회 / 33,320 bytes + 재사용 3,173회**와 module vector는 §13.23과 같았다. 두 cold 월 pass 35(input 12)는 신규/captured **784/827**, build/capture/scene **97.691/48.302/46.267ms**, records/diff/비동기 commit **11/25/4ms**였다. 활성 pass 42(input 30)도 신규 **398개**, **84.547/36.663/36.256ms**였다. 단일 실행의 이동 p95 차이를 누락 표 변경만의 유의미한 개선율로 해석하지 않는다. offset 최댓값은 §13.23보다 커졌으며 성능 FAIL은 그대로다.

Calendar Source **112 calls**, published-coverage **70** / declined **6** / cohort-changed **32** / closed **4**, failed/rejected/overwrite **0**이다. native terminal은 published **61** / continued **10** / superseded **32**, pending·역순·overwrite **0**이었다. Reversal은 마지막 관찰 시 native pending **1**이었으며 종료 후 reserved/memory **0** 회수와 같은 시점으로 혼동하지 않는다. 최신 네 Windows 실행 모두 ring loss/output drop **0**, workers joined·CLI/App exit 0·close reserved/memory **0**을 확인했다. 실제 demand 생성 notObserved / 전체 demand→coverage notVerified는 남는다.

Web isolated/plain은 각각 12회 왕복·grid/header·resident/Element/builder 상한·resize·연도 선택·close가 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877/4,545/3**, close reserved **0**·workers stopped다. 목표 32ms/6 updates/600px와 지연 주입/RPC의 기능 검사이며 Windows 3배속 성능 근거가 아니다. 소유 App·검사 임시 폴더·교체 staging/이전 dist가 남지 않은 것을 확인했다.

후속 코드 분석에서 `maybeMaterialThemeScopeOf`는 base class의 가장 가까운 Inherited provider를 찾으려고 전체 Element 조상을 걷고 있었다. 별도의 두 gesture 호출 계수에서 이 경로는 시작 이후 **141,185 Element steps**였다. 해당 실행은 native 컴파일과 겹쳤으므로 시간·성능 근거에서 제외한다. 다음 후보는 기존 immutable Inherited link를 이용해 불필요한 일반 Element 순회를 줄이는 것이다. subclass·live 값·의존성 알림·동적 token·사용자 context의 순회 의미를 먼저 보존해야 하며 아직 production에 적용하지 않았다.

목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**다. setter·adapter/API·default CLI/native 제품 전환·demand 인과·UIA 전체 소비자·원본 visual·물리/scanout/resize와 다른 플랫폼 의무는 계속 열려 있다.

### 13.25 Material theme의 일반 Element 순회 축소 — 의미·기능 PASS / 성능 FAIL

현재 Material theme helper는 가장 가까운 `MaterialThemeScope` subclass를 찾으려고 일반 Element도 모두 방문한다. Core의 기존 Inherited index에서 다음 provider까지 건너뛰는 내부 lookup을 추가했다. 현재 widget의 `instanceof`는 매번 다시 실행하며 subtype·값·callback 결과를 새로 캐시하지 않는다. matching 뒤 live parent를 다시 읽고, 동적 type token 구간은 일반 순회로 처리한다. 사용자 context/Element의 순회 override는 원래 receiver로 실행한다. 해제 도중 비워진 인덱스는 lifecycle을 확인해 일반 순회로 돌아가 기존 inactive ancestor 오류를 유지한다.

현재 구현 본문을 읽는 64-wrapper fixture의 **18개 확인**은 Node와 고정 debug/optimized HBC·Native unit에서 PASS했다. 실제 Material/Core Element의 subclass·live widget·prototype/context override·getter 오류·부모 변경·의존성 알림·GlobalKey 이동·동적 token·해제 callback도 PASS했다. 해제 경계 보완 뒤 Core/Material/SDK Source를 대조했고 전체 workspace 타입·수작업 TS/MJS **75개** format/lint·defaults·reconciliation·construction·binding/NACK·incremental capture가 PASS다. Native 언어·field/async 표본의 합계 **6,438,000**도 bytecode와 일치했다.

새 Web App에만 메모리에서 기존 Material helper 본문/현재 본문을 각각 넣고 동일한 두 gesture를 대조했다. 초기 상태를 뺀 조회는 기존 **1,410회 / 141,081 Element 단계**, 현재 **1,407회 / 29,075 lookup loop 단계**였다. 마지막까지 grid·resident 상한·resize와 reserved 0/workers stopped를 확인했다. 조회 횟수도 완전히 같은 표본이 아니며 loop 경계가 달라져 이 차이를 CPU·전체 성능 개선율로 해석하지 않는다. native 컴파일과 겹친 진단이며 임시 로그·profile·App 복사본을 남기지 않았다.

**현재 공급:** Core/SDK와 Demo/Testbed Windows/Web 재생성, Source 입력 **714/134/284 modules**, engine·전체 App manifest 파일과 native image/map hash 검사를 PASS했다. engine provider graph는 **`d351594cb9b569c7c1da69f3eac0ccd3012b28ea3e854a59d46e12d14a432307` / 360 files / ABI 2 / schema 313408118**로 그대로다. Demo Windows JS/HBC는 **`8763c50c014bba06d8cd2a0dba894ffd6fa3a98e50836525ba083db105593f92` / `f159051e8bf4f70125598ff3b103df626b3de16a58d15c73b73625e4a1c7fac8`**, native DLL은 **`333488bdac8009f44a68d4d36bccf9480be2b7866aaa83cc28f38324947ed60f` / 61,076,480 bytes**다. 현재 map **21,428,238 bytes / 30,688 functions**의 image hash도 실제 DLL과 일치한다. Demo Web은 **`a38e0fa8e837076fa38799cac61e75118c70a056e4e7f9cae13dd2f87eab73c7`**, Testbed Windows JS/HBC는 **`231a8f63f3bae9d0e1abeeb2c4638a38ab6aa4bc24c628a3a5993ee55ad7292b` / `fec9952bae4abc435de422ea87819d7928cc5fe8eca4105f9f45e6b2d04b8156`**, Testbed Web은 **`824671b3242fabddf689c8163a061de0d3191bcedb36ea7f7812ce3b657cb6b0`**다. 고정 Hermes pin·표준 -O·JIT off·명시적 Demo native 선택과 Testbed bytecode를 유지했다. 기본 CLI/native 제품 전환은 아니다.

컴파일·Web·다른 CPU 검사와 겹치지 않게 Windows 네 시나리오를 각각 실행했다. 입력 시간만 3배속이며 거리·표본 수·200ms animation·resident·수락 기준은 유지한다.

| 실행 | 실제 입력·기능 | 성능 판정 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | **360 updates / 2,000.329ms / 180Hz**, 전부 반영·누락/거부 0, resize anchor·2027년/15일 선택·종료 PASS | 이동 p95/최대 **237.124/259.095ms**, offset **최대 234ms / ≥100ms 10회 / ≥250ms 0회 — FAIL** |
| Fast / 이동 중 lift·재접촉 12회 / YearMode | **96 updates / 753.692ms**, start/update/end 120개 승인·거부 0, **24개월 역방향**·2024년/15일 선택·종료 PASS | offset **최대 204ms / ≥100ms 4회 / ≥250ms 0회 — FAIL**; 이동 p95는 notVerified |
| CalendarReversal / 같은 접촉의 각 3개월 왕복 | **180 updates / 1,000.387ms / 180Hz**, 182개 승인·거부 0, requested 오차 **4.37e-11px**, 실제 최대 이탈 **3 pages**·양방향 게시·원래 월·15일 선택·종료 PASS | offset **최대 155ms / ≥100ms 4회 / ≥250ms 0회**; 비단조 이동 p95/전체 성능은 notVerified |
| Contact / 준비된 ±0.4·±0.8 page 네 접촉 / YearMode | 각각 **36 updates / 200.102·200.350·200.168·200.458ms / 180Hz**, 활성 게시 **25/27/28/28개**, 오차 최대 **8.74e-11px**, resize·2026년/15일 선택·종료 PASS | 접촉별 최대 게시 지연 **21.160/11.877/14.647/15.449ms**; 전체 cold·scanout·물리 성능은 notVerified |

Calendar driver lateness p95/최대는 **0.515/3.637ms**, Reversal은 **0.506/0.619ms**였다. Calendar의 command 인코딩 **211회 / 33,320 bytes + 재사용 3,173회**, module vector **[0,0,323,194,742,284,808,266,21,24,139,50,3,4]**는 유지됐다. 두 cold 월 pass 35(input 12)는 신규/captured **784/827**, build/capture/scene **98.022/64.647/43.103ms**, records/diff/비동기 commit **12/21/5ms**·build/commit 각 1회였다. 활성 pass 46(input 39)도 신규/captured **398/767**, **85.054/37.326/59.740ms**·records/diff/commit **11/15/28ms**였다. 다음 pass 50/52의 신규 **401/395개**, build **38.549/37.630ms**가 남는다. 이전 실행보다 이동 p95는 커졌으며 일반 Element 순회 제거를 전체 성능 개선이나 해결로 수락하지 않는다.

Calendar Source **103 calls**는 published-coverage **66** / declined **4** / cohort-changed **29** / closed **4**, failed/rejected/pending/overwrite **0**이다. native terminal **99개**는 published **59** / continued **9** / superseded **31**이며 pending·역순·overwrite **0**이었다. 권위 request **41개**를 연결했지만 실제 demand 생성 **notObserved**, 전체 demand→coverage **notVerified**다. Reversal/Fast/Contact의 마지막 관찰 native pending도 각각 **0**이며 네 Windows 실행 모두 ring loss/output drop **0**, close reserved/memory **0**, workers joined·CLI exit 0·App exit를 확인했다.

Web isolated/plain은 각각 12회 왕복·grid/header·resident/Element/builder 상한·resize anchor·2026년 선택·close를 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877/4,545/3**, close reserved **0**·workers stopped다. 날짜 격자의 15일 표시를 확인하는 검사이며 Web의 실제 날짜/OK 선택 완료를 뜻하지 않는다. `--precision`의 rebuild 60ms/update 120ms RPC 지연 주입을 포함한 기능 검사로, 목표 6 updates/600px/32ms를 Windows의 실제 180Hz 성능 수락과 혼동하지 않는다.

**별도 GC/CPU 진단:** 위 일반 성능 실행과 Web 종료 뒤 `-CpuProfile` Calendar를 한 번 실행해 기능·정상 close를 확인했다. 계측 실행은 성능 수락 표본에서 제외한다. GC 통계는 활성 입력 2초만이 아니라 **Runtime 생성부터 입력 후 dump까지의 누적값**이다. 고정 로컬 upstream `GCBase.cpp`의 `formatSecs(...).secs`로 단위를 확인했으며 **196 collections / 총 579.153ms / 평균 3.114ms / 최대 단일 14.346ms**, 누적 할당 **677,504,592 bytes**, 최종 heap **64MiB**였다. 반복 GC/할당 비용은 남지만 단일 GC 정지로 98ms Source build를 설명할 수 없다. 한 build 안의 여러 GC 합계는 이 진단만으로 배제하지 않는다. upstream SamplingProfiler는 현재 SH Source frame을 생략해 `sourceSelf`/`captureSelf`가 비어 있으므로 native/generator 순위나 GC sample 수를 Source CPU 비율로 사용하지 않는다. heap·VM/compiler·GC 설정은 변경하지 않았다.

마지막 Source/package/engine·네 App identity 재대조와 `git diff --check`는 exit **0**이다. 소유 Windows host·App, 이번 Hermes syntax 검사 임시 폴더와 App 교체 staging/이전 출력의 잔여가 없음을 확인했다. Temp의 기존 w9b-indicator-screen/windows-animation/windows-input-surface 폴더는 이번 실행 소유가 아니어서 건드리지 않았다. 검증 로그·profile·SDK/App 복사본은 누적 보관하지 않았다.

**계속할 경계:** 목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**다. 실제 Source 자손 구성·capture의 반복 할당과 같은 resident 창 안의 안전한 continuation 경로가 다음 분석 대상이다. 위 callback/State/수명·입력·animation을 생략하거나 준비 창을 늘리지 않는다. 전체 setter·adapter/API·default CLI/native 제품 전환·실제 demand 인과·UIA 전체 소비자·원본 visual·물리/scanout/resize와 다른 플랫폼 의무는 열려 있다.

### 13.26 capture의 노드별 build/refresh 함수 생성 제거 — 의미·기능 PASS / 성능 FAIL

`OriginalWidgetHost.node`는 render 노드를 읽을 때마다 build·refresh closure를 하나씩 만들었다. 완전히 재사용하는 노드도 해당 함수를 먼저 생성했다. host 수명당 projection 두 개를 공유하고 기존 child record에 edge input만 보관하도록 바꿨다. 각 read의 live ParentData/list-item key 계산과 동적 owner 실행, 자식별 이전 edge 입력, field mask·registration/dependency·완료 후 commit·실패 시 abort는 유지한다. 기존 callback 형식과 공유 형식을 한 capture 안에서 함께 사용할 수 있다. Source Widget/Element/State·사용자 callback을 생략하거나 공유하지 않고 resident/lead/animation/입력 정책도 바꾸지 않는다.

[대조 검사](Nelyx/eng/check-capture-projection.mjs)의 15단계는 전체 callback / 공유 projection / 혼합 경로의 wire·호출 순서·mask·동적 실행·이전 edge와 현재 edge·getter 오류·reparent·등록 회수·capture 중 invalidation·cohort·abort·예산·clear를 대조해 PASS했다. 해당 표본의 노드별 closure 생성은 **186→0**이다. 기존 incremental capture·binding/NACK·13개 box command·paragraph·gesture·notification 회귀, 전체 workspace 타입과 수작업 TS/MJS **76개** format/lint도 PASS했다. 이전/현재 실제 App JS의 `host.node`는 화살표 함수 표현 **2→0**이며, 새 공급의 실제 native C `_12582_node_1_` 본문 **140줄**에는 `_sh_ljs_create_closure`·`_sh_ljs_create_environment` 호출이 각각 **0개**였다. 이 제거량을 Windows의 시간·GC 할당 bytes 개선율로 해석하지 않는다. 15단계 국소 대조 자체는 Node에서 실행했으며, 아래 Native App 검증과 범위를 구분한다.

Core의 `dist/v2/app`도 현재 runtime Source를 포함하므로 초기 공급 사전 검사는 이전 capture map을 감지해 App 빌드 전에 중단했다. 이후 **Core→SDK→네 App**을 재생성하고 Source 입력 **714/134/284 modules**, 전체 manifest 파일·native image/map hash를 확인했다. engine provider graph는 **`d351594cb9b569c7c1da69f3eac0ccd3012b28ea3e854a59d46e12d14a432307` / 360 files / ABI 2 / schema 313408118**로 같다. Demo Windows JS/HBC는 **`16f29fb53fc0e3f3c02d03f2bf7da65f0b14fa98d09344b0976f91f08a1f6e82` / `5f94f2562cb91c7c22d82b8cf547320c92fe2b26da4bb5c6c4a6ff3791729df8`**, native DLL은 **`1157eee91995214ebca958e91a4209a64c54446884093dcefb27ac9069949412` / 61,078,016 bytes**다. map **21,428,247 bytes / 30,688 functions**의 image hash도 실제 DLL과 일치한다. Demo Web은 **`249f6f7ce72b1c90ddaa6dec6db90b6fb091e8c38f1e72ad11ff9b9d0b901f32`**, Testbed Windows JS/HBC는 **`5bfdc1dd6ad9d882f08cb301acf630c9233102c6526e62a92afb4754a3fbc01c` / `01aa700563d89dd894dd0631a148cafa2c9239ed65e42ec517fb53f435161aa9`**, Testbed Web은 **`bed296b3bf68a39113c1f33d81c09090aea73221ed590548d59cb61d508bd376`**다. 고정 upstream pin·표준 -O·기존 native C -O3·JIT off·명시적 Demo native 선택과 Testbed bytecode를 유지했다. 기본 CLI/native 제품 전환이나 VM/compiler 패치는 아니다.

컴파일이 실제 종료된 뒤 Windows 네 시나리오를 각각 단독 실행했다. Web이나 다른 CPU 검사와 겹치지 않았고 3배속의 거리·표본 수·200ms animation·resident/lead·기존 수락 기준은 유지했다.

| 실행 | 실제 입력·기능 | 성능 판정 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | **360 updates / 2,000.172ms / 180Hz**, 전부 반영·누락/거부 0, resize anchor·2027년/15일 선택·종료 PASS | 이동 p95/최대 **196.949/234.190ms**, offset **최대 194ms / ≥100ms 10회 / ≥250ms 0회 — FAIL** |
| Fast / 이동 중 lift·재접촉 12회 / YearMode | **96 updates / 756.627ms**, start/update/end 120개 승인·거부 0, **24개월 역방향**·2024년/15일 선택·종료 PASS | offset **최대 230ms / ≥100ms 3회 / ≥250ms 0회 — FAIL**; 이동 p95는 notVerified |
| CalendarReversal / 같은 접촉의 각 3개월 왕복 | **180 updates / 1,000.467ms / 180Hz**, 182개 승인·거부 0, requested 오차 **5.10e-11px**, 실제 최대 이탈 **약 2.967 pages**·양방향 게시·원래 월·15일 선택·종료 PASS | offset **최대 195ms / ≥100ms 4회 / ≥250ms 0회**; 비단조 이동 p95/전체 성능은 notVerified |
| Contact / 준비된 ±0.4·±0.8 page 네 접촉 / YearMode | 각각 **36 updates / 200.507·200.181·200.453·200.356ms / 180Hz**, 활성 게시 **30/27/25/24개**, 오차 최대 **8.74e-11px**, resize·2026년/15일 선택·종료 PASS | 접촉별 최대 게시 지연 **12.436/12.217/14.059/14.578ms**; 전체 cold·scanout·물리 성능은 notVerified |

Calendar driver lateness p95/최대는 **0.515/0.754ms**, publication 공백 최대 **28.080ms**, 활성 App turn **124.596/176.006ms**였다. command 인코딩 **211회 / 33,320 bytes + 재사용 3,173회**, module vector **[0,0,323,194,742,284,808,266,21,24,139,50,3,4]**를 유지했다. 두 cold 월 pass 35(input 12)는 신규/captured **784/827**, build/capture/scene **97.913/38.304/43.229ms**, records/diff/비동기 commit **7/24/7ms**·build/commit 각 1회였다. 활성 pass 49(input 39)는 신규/captured **398/767**, **103.764/35.825/43.088ms**·records/diff/commit **8/15/11ms**였다. 이전보다 Calendar 이동 p95와 이 cold capture는 낮았지만 Source build는 여전히 길고 Fast 정체 최댓값은 커졌다. 단일 실행의 차이를 공유 호출만의 개선율이나 전체 해결로 수락하지 않는다.

Calendar Source **110 calls**는 published-coverage **70** / declined **4** / cohort-changed **31** / closed **5**, failed/rejected/pending/overwrite **0**이다. native terminal **103개**는 published **63** / continued **11** / superseded **29**이며 pending·역순·overwrite **0**이었다. 권위 request **41개**를 연결했지만 실제 demand 생성 **notObserved**, 전체 demand→coverage **notVerified**다. 네 Windows 실행 모두 마지막 관찰 native pending·역순·overwrite와 ring loss/output drop **0**, close reserved/memory **0**, workers joined·CLI exit 0·App exit를 확인했다.

Web isolated/plain은 각각 12회 왕복·grid/header·resident/Element/builder 상한·resize anchor·2026년 선택·close를 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877/4,545/3**, close reserved **0**·workers stopped다. 15일 표시를 확인하는 기능 검사이며 Web에서 실제 날짜/OK 선택을 완료한 것은 아니다. 목표 6 updates/600px/32ms와 rebuild 60ms/update 120ms RPC 지연 주입을 포함하며 Windows 180Hz 성능 수락으로 사용하지 않는다.

현재 `NelyxEngineAppSdkHost.exe`와 이번 검사·컴파일 임시 폴더, Core/SDK/App staging·이전 출력이 남지 않은 것을 확인했다. 현재 dist와 필요한 공급 입력만 유지했고 C 중간 파일·로그·profile·SDK/App 복사본은 누적 보관하지 않았다.

**계속할 경계:** 목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**다. 노드별 함수 생성 제거는 확인했지만 실제 Source 구성과 capture/record의 비용은 남는다. 다음 분석은 기존 Source 시간 경계와 같은 App owner의 할당·GC 관측을 연결해 어느 구간이 반복 할당을 만드는지 좁힌다. Source 값·State·callback 생략, 준비 창/lead 확대나 입력 감속을 해결책으로 사용하지 않는다. 전체 setter·adapter/API·default CLI/native 제품 전환·실제 demand 인과·UIA 전체 소비자·원본 visual·물리/scanout/resize와 다른 플랫폼 의무는 열려 있다.

후속 진단의 코드 근거로 고정 로컬 Hermes의 `jsi::Instrumentation::getHeapInfo(false)`가 `hermes_totalAllocatedBytes`·`hermes_numCollections`를 반환하고, Windows host의 기존 `NelyxV2Native.clock`이 같은 App owner에서 QPC를 읽는 것을 확인했다. 아래 §13.27에서 이 연결을 구현·검증했다. §13.25의 누적 통계를 개별 Source build의 할당으로 나눠 적지 않는다.

### 13.27 기존 Source 시각과 같은 App owner의 힙 관측 연결 — 진단 PASS / 일반 성능 FAIL

Windows의 기존 `-CpuProfile` 구간에서만 QPC clock 호출에 VM heap 통계를 연결했다. native 시계의 반환값과 일반 입력·scheduling은 그대로이며, profiling을 켜지 않으면 collector를 만들거나 힙을 조회하지 않는다. 최대 **2,048회 조회 시도** 뒤에는 저장·조회 없이 dropped 수만 세고, 실패한 조회도 이 예산을 소비한다. 조회 예외는 시계 밖으로 전달하지 않는다. startup부터의 절대 카운터를 각 read의 QPC bracket과 함께 보관하며 로그·profile 파일을 누적하지 않는다.

기존 bounded App timing에 이미 읽은 build/capture/scene 시작 시각을 추가했다. timestamp 호출을 더 넣지 않았다. [결합기](Nelyx/eng/windows-source-heap.mjs)는 같은 domain의 고유한 경계만 연결하고, profile 밖/걸친 구간·누락/중복 시각·반올림·실패/overflow·카운터 단조성을 구분한다. Source는 build와 중첩될 수 있고 Scene는 비동기 owner 할당이므로 분류들을 합산하거나 CPU self time·객체 수·live bytes로 표시하지 않는다. GC 횟수는 native read bracket 사이에서 관찰한 완료 수이며 Source의 GC 정지 시간으로 환산하지 않는다.

고정 upstream의 JSI bridge는 일부 heap 카운터를 double을 거쳐 반환한다. 실제 adapter는 음수와 안전 정수 범위를 벗어난 값을 거부하고 해당 조회를 failed로 남긴다. 진단 전송·결합기 자체의 uint64 decimal 보존과 실제 upstream counter 정밀도 범위를 구분한다. C++ collector와 Node 결합기의 off/stop/full/실패 예산·예외 격리·구간/시계/누락·정수 경계·초기화·출력 상한·stdin CLI 검사가 PASS했다. 실제 Windows PowerShell이 UTF-8 BOM을 두 번 붙이는 경우를 첫 App 진단 뒤 발견해 수정했다. 실제 PowerShell→Node pipeline·한/두 BOM·제한된 오류 출력 회귀도 PASS했다. 첫 진단은 기능 PASS 뒤 결합 실패/exit 1이므로 성공 통계에 포함하지 않고, 수정 후 진단 한 번의 결과를 아래에 적는다. VM/compiler/heap/GC 설정은 변경하지 않았다.

전체 workspace 타입·수작업 TS/MJS 78개 format/lint, Source journal·공유 capture·incremental capture·binding·notification 회귀를 PASS했다. Core→SDK와 전체 engine의 Windows/native·single-worker/threaded Web을 빌드하고 네 App을 갱신했다. Source 입력 **714/134/284 modules**, manifest 전체 파일·실제 native image와 map을 대조했다. engine은 **`d03549620080e088a07a8194c4ed438c91458c30fb422b0cec63923b7a87f935` / 360 files / ABI 2 / schema 313408118**이다. Demo Windows JS/HBC는 **`cb2529e17b07387ede1642d98ff3c4b63f089eb7b4c32fafa609814f01d5db03` / `e7a9a679710773106c1a59dee940fc106f09414bab095609be739affc926823f`**, native DLL은 **`203533c3c2c3975ecc5b4142d7f5039a093d2e6b650ce358337ad3a58663719f` / 61,079,552 bytes**다. map **21,428,247 bytes / 30,688 functions**의 image hash도 일치한다. Demo Web은 **`56c7fe8b63d6de90488cbdd5683c0f7d171de5bb7b99a426370517c776c6ec25`**, Testbed Windows JS/HBC는 **`4bbea1fe4dfbab9233bd699dfdafa492cceecfbef2d44bf62ce70b86f4a49291` / `ae3e931240eb6f1934a85ce237e4682e8d48650ba8e77df77c7cb90aa4cca65a`**, Testbed Web은 **`5e6e5c5fd1a55df4bcb4b0f479965e0527d04dbc07cbe461fcd2ef80917dc033`**다. 기존 upstream pin·표준 -O/-O3·instance field·JIT off·명시적 Demo native와 Testbed bytecode를 유지한다.

컴파일 종료 뒤 일반 Calendar와 두 차례의 진단(첫 결합 실패/수정 뒤 성공)을 각각 단독 실행했다. 일반 Calendar는 **360 updates / 2,000.416ms / 180Hz / 362 승인·거부 0 / 360 반영·누락 0**, 12개월·resize anchor·2027년/15일·종료 PASS다. 이동 p95/최대는 **314.187/414.425ms**, offset **최대 256ms / ≥100ms 10회 / ≥250ms 1회 — FAIL**이다. driver lateness **0.517/2.626ms**, 게시 공백 최대 **47.650ms**, 활성 App turn **150.323/180.106ms**였고 cold pass 34(input 12)는 신규/captured **784/827**, build/capture/scene **115.989/37.791/51.152ms**였다. 세 시작 시각 추가를 이 실행 차이의 원인이나 성능 개선으로 확정하지 않는다. Fast·Reversal·Contact·Web UI는 이번 공급에서 다시 실행하지 않았다.

일반 Calendar Source **107 calls**는 published-coverage **66** / declined **6** / cohort-changed **32** / closed **3**, failed/rejected/pending/overwrite **0**이다. native terminal **99개**는 published **57** / continued **12** / superseded **30**, pending·역순·overwrite **0**이며 권위 request **43개**를 연결했다. 실제 demand 생성 **notObserved**, 전체 demand→coverage **notVerified**는 유지한다. 일반 실행과 수정 후 진단 모두 ring loss/output drop **0**, close reserved/memory **0**·workers joined·CLI exit 0·App exit를 확인했다.

수정 후 계측 실행은 **2,233.204ms profile window / 289 native points / dropped·invalid·failed 0 / 경계 누락·domain 오류 0**이다. 저장된 probe 합계/최대는 **1.694/0.035ms**이며 App·Source journal overwrite는 0이었다. profile 밖 App stage는 각 **101개**, Source는 **71개**로 구분하며 startup과 앞선 cold 구간까지 측정한 것으로 설명하지 않는다.

| 같은 native clock의 retained 구간 | 구간 수 | 관찰 elapsed 합계 | 누적 allocation 차이 합계 | 관찰 GC 완료 수 |
| --- | --- | --- | --- | --- |
| build | 17 | 750.191ms | 103,684,024 bytes | 26 |
| capture | 17 | 403.865ms | 83,277,736 bytes | 22 |
| 비동기 Scene owner | 17 | 569.699ms | 126,740,000 bytes | 36 |
| Source (build 등에 중첩) | 19 | 747.839ms | 103,499,856 bytes | 26 |

각 category는 **합산하지 않는다**. 예를 들어 input 233/pass 55의 build는 **119.873ms / 12,511,600 bytes / GC 4회**, 그 안 retained Source는 **115.117ms / 11,898,800 bytes / 4회**다. input 39/pass 48의 build는 **88.270ms / 12,929,736 bytes / 3회**, 뒤 capture는 **43.953ms / 9,198,864 bytes / 2회**였다. 해당 read bracket 범위 안 GC 완료 횟수이며 GC pause 시간은 아니다. 같은 진단의 Runtime 시작부터 누적 GC **191회 / 총 556.026ms / 최대 단일 13.948ms / 누적 할당 659,749,360 bytes**도 활성 profile 구간의 통계와 구분한다. 기존 CPU sampler는 SH Source frame을 제공하지 않아 Source/capture self time이 비어 있으며 이 제한은 해결하지 않았다.

**다음 코드 분석:** Source의 필수 객체·State·callback을 없애지 않으면서 반복 할당을 줄인다. 특히 내부 `SceneBlobJournal`의 기본 byte hash는 typed-array iterator를 byte마다 진행시키므로 정확한 raw-byte hash를 인덱스로 계산하는 후보를 검토한다. 이 위치의 실제 할당 비중은 아직 측정하지 않았으며 현재 진단을 hash 단독 원인으로 해석하지 않는다. Source 자손 build의 queue·reconcile과 capture/record도 별도 대상이다. 목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**이며 전체 setter·API/adapter·default CLI/native 제품 전환·demand 인과·UIA 전체 소비자·원본 visual·물리/scanout/resize·다른 플랫폼 의무를 유지한다.


마지막 공급 재검사와 diff whitespace 검사를 PASS했다. 현재 NelyxEngineAppSdkHost.exe·cl/clang/link 소유 검사 프로세스와 source-heap/native-stack·App staging·이전 dist가 남지 않은 것을 확인했다. 현재 dist만 유지하며 이번 진단의 로그·profile·중간 C·SDK 복사본을 누적 보관하지 않았다.

### 13.28 내부 byte hash의 iterator 결과 생성 제거 — 기능 PASS / 성능 FAIL

앞선 구간별 할당 관측 뒤 [SceneBlobJournal](Nelyx/runtime/engine-client/scene-blobs.ts)의 기본 hash를 코드에서 확인했다. 내부 canonical wire의 매 byte를 typed-array iterator로 진행시켰고, 고정 upstream의 `TypedArray.cpp`→`JSArrayIterator::nextElement` 값 경로는 `createIterResultObject`를 호출한다. 같은 unsigned FNV-1a를 인덱스 순회로 계산하도록 바꿨다. collision의 실제 byte 비교·등록/참조·ACK/NACK·해제·선택적으로 주입한 hash callback은 유지하며 Source Widget/Element/State·사용자 callback·입력/lead/resident/animation은 바꾸지 않는다. `Math.imul` 호출은 아직 byte마다 남는다.

[대조 검사](Nelyx/eng/check-scene-blob-hash.mjs)는 알려진 FNV 값과 길이/offset별 기존 hash 대조, 두 journal의 **12단계** wire/ID·동일 bytes 공유·빈 입력·거절 뒤 replay·짧은 payload·destroy·generation/ID 재사용·중복 terminal·최종 해제를 PASS했다. 해당 표본의 typed-array iterator 결과 생성은 **5,130→0**이다. payload 자체의 의미를 새로 검증한 test는 아니며, 실제 Wasm Core의 immutable configuration collision/NACK/해제 회귀도 별도로 PASS했다. binding·capture·Source/heap 경계 회귀, 전체 workspace 타입과 수작업 TS/MJS **80개** format/lint도 PASS했다. App build 중 읽은 실제 native C `_26935_hashBytes` **83줄**에는 iterator 언급 **0개**, index read **1개**, loop 안 `Math.imul` call **1개**가 있다. Node 객체 count를 Windows 전체 allocation 절감량으로 대신하지 않는다.

Core→SDK→네 App을 재생성하고 Source 입력 **714/134/284 modules**, 전체 manifest 파일과 실제 native image/map hash를 대조했다. engine **`d03549620080e088a07a8194c4ed438c91458c30fb422b0cec63923b7a87f935` / 360 files / ABI 2 / schema 313408118**은 같다. Demo Windows JS/HBC는 **`1c1956b252b5e5b3d7f76b69a2cad7492d8feab0610b1f88460dee3048183ac0` / `fe635b03ea1aa09e67f0146a2bd9922360e18cb88022f27d75dde32d1b3286a7`**, native DLL은 **`43f554cf1a29fd782c4137936c2cc0a08627505dbd6dee48a7bbe9f648fcb7f5` / 61,079,552 bytes**다. map **21,428,256 bytes / 30,688 functions**의 image hash도 일치한다. Demo Web은 **`ced9abc82d7b8110c71aff9fafc82a272ced611a7031a619452b676d2712d1d0`**, Testbed Windows JS/HBC는 **`347c9b4727ff31b3aa48b807bab2a2f4a7697df1ac60c461ec19f2eb593635b7` / `12fc8be212efcbe400ef705fc38564386b05000a9e1a9bad5c16cd3538864a7b`**, Testbed Web은 **`d7a899c649dcda41f8b67a76f0ab706653ce82aff2d14b86c986effccb116c00`**다. upstream pin·표준 -O/-O3·instance fields·JIT off·명시적 Demo native와 Testbed bytecode를 유지한다.

컴파일 종료 뒤 네 Windows 시나리오, 별도 profile, Web을 순서대로 단독 실행했다. 3배속의 거리·표본 수와 기존 수락 기준을 유지했다.

| 실행 | 입력·기능 | 남은 성능 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | **360 updates / 2,000.215ms / 180Hz**, 362 승인·거부 0 / 360 반영·누락 0, resize·2027년/15일·종료 PASS | 이동 p95/최대 **191.932/224.580ms**, offset **최대 199ms / ≥100ms 11회 / ≥250ms 0회 — FAIL** |
| Fast / 이동 중 재접촉 12회 / YearMode | **96 updates / 776.026ms**, start/update/end 120개 승인·거부 0, **24개월 역방향**·2024년/15일·종료 PASS | offset **최대 250ms / ≥100ms 3회 / ≥250ms 1회 — FAIL** |
| 같은 접촉의 3개월 전진·반전 | **180 updates / 1,000.503ms / 180Hz**, 182 승인·거부 0, requested 오차 **5.10e-11px**, 실제 이탈 **약 2.967 pages**·양방향 게시·원래 월/15일·종료 PASS | offset **최대 196ms / ≥100ms 3회**; 비단조 이동 p95/전체 성능 notVerified |
| 준비된 ±0.4·±0.8 page 네 Contact / YearMode | 각각 **36 updates / 200.294·200.479·200.493·200.305ms**, 활성 게시 **26/26/27/27개**, 오차 최대 **8.74e-11px**, resize·2026년/15일·종료 PASS | 최대 게시 지연 **11.879/11.875/11.869/15.351ms**; 전체 cold 성능 notVerified |

일반 Calendar driver lateness p95/최대는 **0.508/0.582ms**, 게시 공백 최대 **34.978ms**, 활성 App turn **131.447/171.255ms**였다. cold pass 35(input 12)는 신규/captured **784/827**, build/capture/scene **76.489/49.425/58.269ms**다. 실제 command **3,384개 = 인코딩 211회 / 33,320 bytes + 재사용 3,173회**를 유지했다. 이전 표본보다 Calendar 이동 p95는 낮지만 Fast는 최대 250ms이고 capture/Scene와 Source의 비용도 남아 있어, 단일 실행 차이를 hash만의 개선율이나 전체 해결로 수락하지 않는다.

Calendar Source **109 calls**는 published-coverage **71** / declined **4** / cohort-changed **29** / closed **5**, failed/rejected/pending/overwrite **0**이다. native terminal **96개**는 published **56** / continued **10** / superseded **30**, pending·역순·overwrite **0**, 권위 request **41개** 연결이다. 실제 demand 생성 **notObserved**와 전체 coverage **notVerified**는 유지한다. 네 Windows 실행 모두 ring loss/output drop **0**, close reserved/memory **0**·workers joined·CLI exit 0·App exit를 확인했다.

별도 계측은 **2,455.675ms profile window / 382 points / dropped·invalid·failed 0 / probe 합계·최대 2.075/0.030ms / App·Source overwrite 0**이다. 아래는 profile 안 retained 구간만이며 Scene 하나는 profile 경계를 걸쳐 제외했다. profile 밖 App stage 각 **98개**, Source **73개**는 합계에서 빠진다.

| 같은 native clock의 구간 | 수 | elapsed 합계 | allocation 차이 합계 | GC 완료 수 |
| --- | --- | --- | --- | --- |
| build | 21 | 837.358ms | 112,664,800 bytes | 29 |
| capture | 21 | 472.656ms | 92,333,392 bytes | 25 |
| 비동기 Scene owner | 20 | 597.332ms | 107,235,664 bytes | 34 |
| 중첩 Source | 21 | 834.690ms | 112,447,672 bytes | 29 |

예를 들어 Source input 44/pass 47은 **80.026ms / 12,223,848 bytes / GC 완료 3회**, input 159/pass 51은 **83.263ms / 12,168,216 bytes / 3회**다. 비동기 Scene input 79/pass 48은 **67.835ms / 12,318,744 bytes / 5회**였다. 이전 §13.27과 profile 길이·구간 수·비동기 owner 작업이 달라 합계의 차이를 hash 단독 절감률로 표시하지 않는다. 중첩 category는 합산하지 않고 GC 횟수를 pause 시간으로 바꾸지 않는다. Runtime 누적 GC **184회 / 총 609.681ms / 최대 단일 13.746ms / 누적 할당 628,030,848 bytes** 역시 활성 구간만의 통계가 아니다. SH Source CPU self time이 없는 제한도 유지한다.

Web isolated/plain은 각각 12회 왕복·grid/header·resident/Element/builder 상한·resize anchor·2026년 선택·close를 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877/4,545/3**, close reserved **0**·workers stopped다. 15일 표시 검사이며 실제 Web 날짜/OK 선택은 아니다. 목표 6 updates/600px/32ms의 3배속과 RPC 60/120ms 지연 주입을 사용했고 Windows 성능 수락으로 합치지 않는다.

**다음 분석:** Theme·날짜 defaults·nullable type witness는 이미 cache가 있어 같은 cache를 재도입하지 않았다. Source queue를 depth bucket으로 바꾸는 후보는 FIFO·깊이 재예약·검증 순서·재진입/사용자 hook의 보존이 필요하므로 적용하지 않았다. 현재 가장 큰 미해결 비용은 실제 자손 build다. 기존 clock/heap 표본에 Widget 종류별 bounded rebuild 구간을 연결하는 진단 observer를 다음 후보로 검토하며, 아직 이를 구현·공급한 것은 아니다. 기본 hash의 Math.imul call도 byte마다 남는다. 목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**이며 기존 setter/API/adapter·제품 전환·demand 인과·UIA·원본 visual·물리/scanout/resize·다른 플랫폼 의무를 유지한다.


공급 재검사·diff whitespace 검사를 PASS하고 NelyxEngineAppSdkHost.exe·cl/clang/link 및 이번 source-heap/native-stack·App staging·이전 dist가 남지 않은 것을 확인했다. 현재 dist만 유지하며 로그·profile·중간 C·SDK/App 복사본을 누적하지 않았다.

### 13.29 profiling 안의 Widget별 Source rebuild 표본 — 할당 관측 PASS / 일반 성능 FAIL

기존 queue에서 실제 호출하는 `Element.rebuild`의 진단 observer를 추가했다. native profiling을 명시적으로 켠 host만 활동 조회 함수를 제공하며, 일반 실행은 observer나 표본 수집기를 설치하지 않는다. observer의 active/begin/end 오류는 Source 실행·원래 예외를 대체하지 않는다. 진단용 try/finally를 별도 helper에 두고 dirty queue·우선순위/FIFO·Source build·reconcile·State 수명과 callback을 유지했다. 최대 **128 constructor 종류 / 512 구간**, 종류별 자식이 빈/비어 있지 않은 경우 각각 첫 두 표본만 보관하며 Element/Widget/State 객체를 직접 보관하지 않는다. 각 constructor의 전체 호출 수와 표본 수·제한/분류 실패·불완료를 구분한다.

이는 queue에서 flush한 rebuild 구간만의 표본이며 초기 callback의 직접 rebuild나 모든 사용자 직접 호출, constructor CPU self time은 아니다. native heap의 동일 clock 경계와 연결하며 Source·build의 중첩을 합산하지 않는다. 같은 name의 다른 constructor도 별도 ID로 구분한다. absent/inactive/active와 active/begin/end 실패 대조, 실제 State 수명·원래 Source 예외·own field·첫 두 strata·128/512 상한·snapshot 격리·시계 실패·heap join 분류/회계·optional host 조회 실패의 국소 검사를 PASS했다. 전체 타입·82개 수기 파일·Element/Inherited/GlobalKey/dependency/notification 회귀를 PASS했고 Core→SDK를 재생성했다. 아래와 같이 engine/App 공급·일반 성능·실제 Widget별 표본을 검증했다. 목표는 active / PARTIAL / 성능 미수락이다.

추가 heap·실제 Wasm Core observation/collision/NACK·binding·capture·byte hash 회귀도 PASS했다. 실제 native C의 dirty callback `_27540__1224_` **181줄**에는 try frame 언급이 **0개**이고 observer가 없으면 원래 `element.rebuild()`를 직접 호출한다. 별도 진단 helper는 profiling 분기에 남는다. 이 코드 확인을 성능 개선율로 설명하지 않는다.

전체 engine의 native/MSVC·single-worker/threaded Emscripten·Windows host, Core→SDK→네 App을 재생성했다. Source 입력 **715/134/284 modules**, 전체 파일·native image/map을 대조했다. engine은 **`7fde85bf683331939cbefdd47c0a1fb417805db05f37a3f1dec29e15c56ebf1a` / 360 files / ABI 2 / schema 313408118**이다. Demo Windows JS/HBC는 **`a7a3e0011a8980a454c227414197ec6a473ccc06662a75831ae8f0062e9157d1` / `bbc9484b89a86b71b7be4879e863082e8bbff34578f5d5ce2b6abe5bbe457706`**, native DLL은 **`43c4e82e20eb304d44f63a312ce172d2ae99f2693485f22e976de10f139f5f45` / 61,104,128 bytes**다. map **21,435,218 bytes / 30,698 functions**의 image hash도 일치한다. Demo Web은 **`6f79de28e88ccf2ef5602aae085a302d6a73131115556a59ada3a47c0f7de24c`**, Testbed Windows JS/HBC는 **`f9df378baa2f689b463daa22cee120c7893b0dcdb8d88d8cc4aa40a4e4658c78` / `8f3de92f0b3fd9cdb914d6de1693ba85a4a41d1f9151939ce313d57d15a60d06`**, Testbed Web은 **`debbc6e58b19c7a9de045b7310a436bf75479a0adbdad66ff95e365134c6cc4f`**다. 기존 upstream pin·표준 -O/-O3·instance fields·JIT off·명시적 Demo native/Testbed bytecode를 유지한다.

컴파일 종료 뒤 일반 Calendar, 별도 profiling, Web, 나머지 Native를 각각 단독 실행했다. 3배속의 거리·표본 수·수락 기준을 유지했다.

| 실행 | 입력·기능 | 성능 경계 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | **360 updates / 2,000.120ms / 180Hz**, 362 승인·거부 0 / 360 반영·누락 0, resize·2027년/15일·종료 PASS | 이동 p95/최대 **195.107/228.742ms**, offset **최대 228ms / ≥100ms 11회 / ≥250ms 0회 — FAIL** |
| Fast / 이동 중 재접촉 12회 / YearMode | **96 updates / 757.804ms**, 120 승인·거부 0, **24개월 역방향**·2024년/15일·종료 PASS | offset **최대 253ms / ≥100ms 3회 / ≥250ms 1회 — FAIL** |
| 같은 접촉의 3개월 전진·반전 | **180 updates / 1,000.342ms / 180Hz**, 182 승인·거부 0, requested 오차 **4.37e-11px**, 실제 이탈 **약 2.867 pages**·양방향 게시·원래 월/15일·종료 PASS | offset **최대 229ms / ≥100ms 3회**; 비단조 이동 p95/전체 성능 notVerified |
| 준비된 네 ±0.4·±0.8 page Contact / YearMode | 각각 **36 updates / 200.460·200.327·200.167·200.173ms**, 활성 게시 **26/26/28/28개**, 오차 최대 **8.74e-11px**, resize·2026년/15일·종료 PASS | 최대 게시 지연 **12.268/12.924/12.042/11.825ms**; 전체 cold 성능 notVerified |

일반 Calendar driver lateness p95/최대 **0.517/0.906ms**, 게시 공백 최대 **29.653ms**, 활성 App turn **132.838/207.216ms**다. cold pass 35(input 12)의 신규/captured **784/827**, build/capture/scene **89.648/57.967/42.178ms**, records/diff/비동기 commit **11/14/10ms**였다. 이전 실행 차이를 observer 분기만의 효과로 확정하지 않는다. Source **102 calls**는 published-coverage **66** / declined **4** / cohort-changed **28** / closed **4**, failed/rejected/pending/overwrite **0**이다. native terminal **100개**는 published **60** / continued **9** / superseded **31**, pending·역순·overwrite **0**, 권위 request **41개** 연결이다. 실제 demand 생성 **notObserved**·전체 coverage **notVerified**는 유지한다. 네 Native의 ring/output loss **0**, close reserved/memory **0**·workers joined·CLI exit 0·App exit를 확인했다.

별도 profiling은 **2,441.358ms window / 743 native points / dropped·invalid·failed 0 / App·Source overwrite 0**이다. probe 총/최대는 **18.588/15.471ms**로 긴 한 표본이 있다. Widget 표본 elapsed에는 그 시작 probe가 포함될 수 있고 별도 분류/호출 비용도 있으므로 `_Focus`의 시간 합계 등을 Source CPU 병목으로 단정하지 않는다. native bracket 사이 allocation 차이와 GC 완료 수를 사용한다. Scene 두 구간은 profile 경계를 걸쳐 제외했으며 profile 밖 App build/capture/scene **97/97/96개**, Source **73개**도 합계에서 제외했다.

| profile 안 retained 구간 | 수 | elapsed 합계 | allocation 차이 합계 | GC 완료 수 |
| --- | --- | --- | --- | --- |
| build | 18 | 917.109ms | 116,128,856 bytes | 30 |
| capture | 18 | 466.410ms | 91,925,872 bytes | 25 |
| 비동기 Scene owner | 17 | 474.121ms | 91,270,632 bytes | 23 |
| 중첩 Source | 20 | 914.439ms | 115,934,192 bytes | 30 |
| 표본 queue Element rebuild | 210 | 35.708ms | 3,486,304 bytes | 1 |

category는 합산하지 않는다. Element의 전체 호출 **26,096회**, constructor **72종류**, 표본 **210개**, 종류/빈·비어 있지 않은 자식 상태별 표본 제한으로 제외 **25,886회**, unclassified·failures·경계 누락 **0**이다. 최초 표본의 편향을 유지하며 전체 Widget/constructor allocation·CPU self time이나 전체 Source의 비중으로 외삽하지 않는다.

| 관측 Widget 종류 | profile 안 호출 수 | 보관한 구간 수 | 해당 구간 allocation 합계 / 최대 |
| --- | --- | --- | --- |
| _GridView | 24 | 4 | **1,399,448 / 752,672 bytes** |
| _DayPicker | 24 | 4 | **626,808 / 164,640 bytes** |
| NativeEditorScroll | 24 | 4 | **366,400 / 102,768 bytes** |
| _Day | 729 | 4 | **96,472 / 24,592 bytes** |
| Text | 905 | 4 | **40,328 / 21,424 bytes** |

빈 자식 상태의 _GridView 두 표본은 Source sequence 48/49에서 **2.093ms / 752,672 bytes**, **1.885ms / 641,408 bytes**였다. 이것만으로 80ms대 전체 Source build를 설명하지 않는다. 가장 많은 타입 호출은 OriginalNativeNode **2,610회**, _Semantics **2,299회** 등이며 실제 Source wrapper 실행과 queue 비용도 남는다. 같은 진단의 Runtime 누적 GC **186회 / 총 605.105ms / 최대 단일 16.544ms / 누적 할당 637,554,528 bytes**, CPU profiler **484 samples**도 활성 구간과 CPU self time으로 바꾸지 않는다. SH Source self frame을 제공하지 않는 기존 제한을 유지한다.

Web isolated/plain은 각각 12회 왕복·grid/header·resident/Element/builder 상한·resize anchor·2026년 선택·close를 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877/4,545/3**, close reserved **0**·workers stopped다. 실제 Web 날짜/OK 선택은 아니고 15일 표시 검사다. 3배속 목표 6 updates/600px/32ms와 RPC 60/120ms 지연 주입의 기능 표본이며 Windows 성능으로 수락하지 않는다.

**다음 코드 수정 후보:** _GridView의 fitted program은 `viewportGridPrograms`에서 폭·높이 식을 여러 cell에 참조한 뒤 `immutableSceneData`로 snapshot한다. `captureConfigInput`은 이미 봉인한 식을 재사용할 수 있지만 현재 이 private graph의 반복 하위 식은 봉인 전이라 여러 번 복사된다. 일반 mutable/accessor producer의 traversal·오류·동적 Source policy 호출은 유지하면서, 새로 만든 내부 순수 숫자 식부터 소유·봉인해 공유하는 후보를 적용한다. 아직 그 수정이나 할당 감소율을 검증한 것은 아니다. 목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**이며 기존 setter/API/adapter·제품 전환·demand 인과·UIA·원본 visual·물리/scanout/resize·다른 플랫폼 의무는 유지한다.


최종 Source/engine/package/App identity와 whitespace 검사를 다시 PASS했다. NelyxEngineAppSdkHost.exe·cl/clang/link 및 이번 source-heap/native-stack·App staging·이전 dist가 남지 않은 것을 확인했다. 현재 dist만 유지하며 로그·profile·중간 C·SDK/App 복사본을 누적 보관하지 않았다.

### 13.30 fitted grid의 소유 숫자 식 공유 — 반복 할당 감소 확인 / 전체 성능 FAIL

§13.29의 _GridView 표본을 따라가 `viewportGridPrograms`가 폭·높이 식을 여러 cell에서 참조하지만 일반 snapshot이 봉인 전의 반복 경로를 각각 복사하는 것을 확인했다. 일반 `immutableSceneData`나 public producer의 traversal을 바꾸지 않고, 새로 만든 내부 숫자 식과 query를 먼저 소유·봉인해 기존 fast path로 공유한다. 안전한 양의 정수 columns/rows·유한 양수 extent·안전한 비음수 count·boolean 방향인 경우에 적용한다. row/column 위치 식의 표는 한 factory 호출 안의 null-prototype 숫자 record 두 개로 제한하며 count/columns ≤64·정수 index 0..63에만 사용한다. signed zero·비정상/boxed producer·범위 밖 값은 원래 경로를 유지한다. 전역이나 다른 Element 간 cache를 추가하지 않고 Source policy getter·Math.floor 호출 순서·delegate build·Widget/State/callback·기존 Element별 program 교체와 resident/lead/animation을 유지한다.

변경 전 factory를 테스트 전용 reference로 동결하고 실제 Source 모듈과 비교했다. 14가지 count/columns·LTR/RTL·partial/empty/signed-zero 데이터와 command bytes 또는 정확한 codec 거부를 대조했다. count 65는 기존 child budget 거부의 동일성이지 큰 grid 수락이 아니다. policy getter·원래 예외 identity·boxed 값·public scalar input 변경/접근자·Math.floor의 평가와 fallback도 확인했다. 42셀 graph의 서로 다른 소유 객체 수는 **1,175→241**이며 이는 native bytes나 전체 Source의 비중이 아니다. factory 간 공유가 없고 외부 입력을 봉인하지 않는 것도 검사했다.

`check-grid-program-sharing`와 실제 Wasm Core의 `check-viewport-grid`, render binding·incremental capture·capture projection·box commands·Source element/heap/preparation 회귀, 전체 타입·84개 수기 파일의 format/lint를 PASS했다. Core→SDK와 네 App을 재생성했다. engine 코드는 바꾸지 않아 §13.29의 **`7fde85bf683331939cbefdd47c0a1fb417805db05f37a3f1dec29e15c56ebf1a` / 360 files / ABI 2 / schema 313408118**을 유지하고 현재 source·파일 전수를 다시 대조했다. Source 입력 **715/134/284 modules**, 네 App 전체 파일·native image/map도 일치한다. Demo Windows JS/HBC는 **`ef37078588eeafaebebf8e52180d082a020344a0e22e41710c1d87ef31996444` / `067f558eb0dfe465d4bd5a3d0fca6d240172f02c8046c249a4e395dc5c6b039d`**, native DLL은 **`331bed413a7b9634d38f5ebfb3cb45ab42e7e284bcfe07540bd8c61de3f12314` / 61,109,760 bytes**다. map **21,435,424 bytes / 30,698 functions**의 image hash도 일치한다. Demo Web은 **`a9d77f0570902f65ce9eb8b961423ebdef95e62d50c530257b55880a5b6e69d2`**, Testbed Windows JS/HBC는 **`586c55c4e9ddc7c0e9d223af2fffab8276ecc9ef0983c045b6e30abad7525342` / `22947cb5e63dd102f32929579216df38134fcf26b707925ea5f2ae14ba72da7c`**, Testbed Web은 **`6cec695617680f54ebb43c58d01718f26ca92ee152f8d2a3b063439ce645df76`**다. 기존 upstream pin·표준 -O/-O3·instance fields·JIT off·명시적 Demo native/Testbed bytecode를 유지한다.

컴파일과 다른 검사 종료 뒤 Native를 각각 단독 실행했다. 입력 거리·표본 수·3배속과 수락 기준을 유지했다.

| 실행 | 입력·기능 | 성능 경계 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | **360 updates / 2,000.517ms / 180Hz**, 362 승인·거부 0 / 360 반영·누락 0, resize·2027년/15일·종료 PASS | 이동 p95/최대 **194.984/230.298ms**, offset **최대 223ms / ≥100ms 11회 / ≥250ms 0회 — FAIL** |
| Fast / 이동 중 재접촉 12회 / YearMode | **96 updates / 761.133ms**, 120 승인·거부 0, **24개월 역방향**·2024년/15일·종료 PASS | offset **최대 246ms / ≥100ms 3회 / ≥250ms 0회 — FAIL** |
| 같은 접촉의 3개월 전진·반전 | **180 updates / 1,000.295ms / 180Hz**, 182 승인·거부 0, requested 오차 **3.64e-11px**, 실제 이탈 **약 2.733 pages**·양방향 게시·원래 월/15일·종료 PASS | offset **최대 311ms / ≥100ms 3회 / ≥250ms 1회**; 비단조 이동 p95/전체 성능 notVerified |
| 준비된 네 ±0.4·±0.8 page Contact / YearMode | 각각 **36 updates / 200.444·200.493·200.271·200.417ms**, 활성 게시 **26/26/26/24개**, 오차 최대 **8.74e-11px**, resize·2026년/15일·종료 PASS | 최대 게시 지연 **17.098/11.774/12.427/12.243ms**; 전체 cold 성능 notVerified |

일반 Calendar driver lateness p95/최대 **0.505/0.674ms**, 게시 공백 최대 **29.323ms**, 활성 App turn **121.610/161.497ms**다. cold pass 36(input 12)의 신규/captured **784/827**, build/capture/scene **88.716/50.571/48.296ms**, records/diff/비동기 commit **9/21/5ms**였다. §13.29와의 실행별 시간 차이를 이 수정만의 효과나 개선율로 확정하지 않는다. Source **111 calls**는 published-coverage **72** / declined **4** / cohort-changed **30** / closed **5**, failed/rejected/pending/overwrite **0**이다. native terminal **98개**는 published **59** / continued **9** / superseded **30**, pending·역순·overwrite **0**, 권위 request **40개** 연결이다. 실제 demand 생성 **notObserved**·전체 coverage **notVerified**는 유지한다. 네 Native의 ring/output loss **0**, close reserved/memory **0**·workers joined·CLI exit 0·App exit와 같은 App JS identity를 확인했다.

별도 profiling은 **2,253.065ms window / 700 native points / dropped·invalid·failed 0 / App·Source overwrite 0**이다. probe 총/최대 **2.888/0.023ms**이며 Scene 한 구간은 profile 경계를 걸쳐 제외했다. profile 밖 App build/capture/scene **100/100/100개**, Source **76개**도 제외했다. 이는 관측 자체의 비용을 포함한 진단이며 일반 성능 표본이 아니다.

| profile 안 retained 구간 | 수 | elapsed 합계 | allocation 차이 합계 | GC 완료 수 |
| --- | --- | --- | --- | --- |
| build | 16 | 806.667ms | 107,091,616 bytes | 28 |
| capture | 16 | 392.919ms | 82,398,688 bytes | 20 |
| 비동기 Scene owner | 15 | 603.225ms | 108,878,912 bytes | 33 |
| 중첩 Source | 19 | 803.641ms | 106,915,240 bytes | 28 |
| 표본 queue Element rebuild | 210 | 14.267ms | 2,518,448 bytes | 0 |

category는 중첩되므로 합산하지 않는다. queue rebuild **26,109회 / 72종류 / 210표본**, 종류/빈·비어 있지 않은 자식 상태별 첫 두 표본 제한으로 제외 **25,899회**, 분류·시계 경계 실패 **0**이다. _GridView의 빈 자식 상태 두 표본은 **1.095ms / 223,744 bytes**, **0.701ms / 196,216 bytes**로 §13.29의 **752,672 / 641,408 bytes**보다 작다. 종류별 네 보관 구간 allocation 합계도 **1,399,448→425,328 bytes**다. 데이터/명령 동일성·graph 수 감소와 함께 private 반복 snapshot 감소를 확인하는 근거다. 표본이 같은 Source sequence의 무작위 대조는 아니며 첫 표본 편향을 전체 Source allocation·CPU self time·전체 개선율로 외삽하지 않는다. _DayPicker·NativeEditorScroll·_Day의 최대 표본 **163,984 / 102,768 / 24,592 bytes**, 가장 큰 Source 세 구간의 **76–86ms / 약 11.4–11.7MB**와 cold build의 긴 비용은 남는다. Runtime 누적 GC **179회 / 총 565.883ms / 최대 단일 14.925ms / 누적 할당 608,690,088 bytes**와 CPU **460 samples**도 활성 구간 통계와 구분한다. SH Source self frame이 비어 있는 기존 제한을 유지한다.

Web isolated/plain은 각각 12회 왕복·grid/header·resident/Element/builder 상한·resize anchor·2026년 선택·close를 PASS했다. 마지막 **1,787 nodes / 4,455 Elements / 3 builders**, resize 뒤 **1,877/4,545/3**, close reserved **0**·workers stopped다. 실제 Web 날짜/OK 선택은 아니고 15일 표시 검사다. 24개 gesture의 목표는 **6 updates/600px/32ms**, 실제 **41.7–157.4ms**였으며 RPC 60/120ms 지연 주입이 있는 기능 표본이다. Windows나 Web 성능 수락으로 바꾸지 않는다.

**다음 코드 분석:** 실제 cold 자손 build와 capture/Scene의 중간 작업은 남는다. Core의 `NotificationListener`·`KeepAlive`·sliver delegate 등에는 고정 literal field 배열을 instance마다 만들고 `protect`에서 필드별 builtin을 호출하는 경로가 있다. 기존 `finalFieldProtector`와 의미가 맞는 고정 layout을 먼저 분석하되, readonly descriptor·필드 순서·subclass·오류/사용자 hook을 유지해야 하며 아직 이를 수정하거나 원인 비중을 입증한 것은 아니다. 반복 snapshot을 줄인 이번 수정은 유지하고 Source 객체·State·callback을 생략하거나 resident/lead/animation을 바꾸지 않는다. 목표는 **active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**이며 전체 setter/API/adapter·default CLI/native 제품 전환·demand 인과·UIA 전체 소비자·원본 visual·물리/scanout/resize·다른 플랫폼 의무를 유지한다.

최종 Source/engine/package/App identity와 whitespace 검사를 PASS했다. NelyxEngineAppSdkHost.exe·이번 App compiler 및 이번 source-heap/native-stack·App staging·이전 dist가 남지 않은 것을 확인했다. 현재 dist만 유지하며 로그·profile·중간 C·SDK/App 복사본을 누적 보관하지 않았다.

### 13.31 public static·instance private field의 native 저장소 후보 — 통합 기능 PASS, Calendar/Fast 성능 FAIL

§13.30 뒤 dirty queue는 이미 heap이고 각 rebuild마다 전체 queue를 검사하는 구조가 아닌 것을 확인했다. 큰 Source 값의 기존 `sourceSemanticsProperties`·`TextStyle.fromAppliedOptions` 및 native object spread도 이미 적용돼 있어 재도입하지 않았다. 대신 최종 Windows App의 Rect/Radius/Insets/Alignment 등 `#private` 필드 접근이 `__privateGet`/`__privateSet`와 WeakMap으로 내려가는 경계를 확인했다. 현재 고정 compiler의 IRGen·HBC/SH emitter는 자체 private name/slot과 add/get/put 명령을 제공한다. instance private field만 유지하면 Rect의 `static zero=new Rect(...)` 등 때문에 esbuild가 class 전체를 계속 낮추는 것도 확인했다. public static field를 함께 유지하는 후보로 확장하고 Windows V2의 직접 고정 cohort syntax identity를 `windows-hermes-260318099.0.7-native-fields-v1`로 구분했다. framework 객체·Source callback·resident/lead/input/animation이나 compiler/VM pin·표준 최적화는 바꾸지 않는다.

처음 검토한 instance private method/accessor 유지 후보는 철회했다. 고정 compiler가 유효한 JavaScript의 private method 덮어쓰기·getter-only 쓰기·setter-only 읽기를 실행 시 TypeError 대신 컴파일 오류로 거부했기 때문이다. 이 실패는 성공에서 제외했고 compiler를 패치하거나 해당 fixture를 삭제해 우회하지 않았다. **public field·instance private field와 field brand를 유지**하며 private method/accessor·static private member·static block 및 stock RNW의 lowering은 그대로 둔다. esbuild가 혼합 class 전체를 낮추는 범위도 유지한다. 따라서 private method가 있는 DartMap 등 모든 private 접근이 제거된다는 주장은 하지 않는다.

공유 fixture는 원본 Node·기존 lowering·후보를 대조하며 reflection, freeze 뒤 private 쓰기, Proxy trap 비호출, brand/오류, 상속의 같은 이름, class factory별 brand, 초기화 순서·원래 예외, 미초기화 필드, nonextensible/Proxy 반환 객체의 stamp·중복 거부, custom new.target, static/instance 혼합, async/generator를 포함한다. public static field는 computed key 선평가·자신의 private constructor 사용·inherited setter 비호출·descriptor·super receiver·중복 field/method·예외의 부분 초기화도 검사한다. static field의 `new.target`와 익명 함수 이름은 기존 lowering의 한계와 구분해 Node 원본 및 native 후보를 검사한다. 공통 대조의 18개 TypeError·순서·값, Node·고정 debug/optimized HBC·언어 native unit과 실제 IR의 Add/Load/StoreOwnPrivateField·HBC의 Add/Get/PutOwnPrivateBySym 검사를 PASS했다. 실제 Core Rect/Offset/Insets/Alignment·subclass/Proxy·DartMap/DartSet의 최종 HBC/native unit 대조도 PASS했고 observation/scene·Source constructor·layout/keys/box cache/dependency/ancestor fixture의 의미를 유지했다. 전체 타입·86개 수기 파일 format/lint·최종 SDK 빌드도 PASS다. engine 코드는 바꾸지 않았고 `sourceIdentity()`는 기존 7fde85bf…c56ebf1a와 같다.

실제 Core geometry를 묶은 동일 source/target의 출력에서는 private get/set/add helper textual 호출 지점이 **36/11/11→0/0/0**, 출력 길이는 **58,634→55,750 characters**다. Rect의 `#bounds`, Insets의 `#values`, Alignment의 `#horizontal`이 유지된다. 이는 고정된 출력의 범위이며 native 실행 횟수·Source 비용 비중이나 성능 개선율이 아니다.

최종 실제 Demo App JS도 대조했다. 변경 전 hash ef370785…31996444의 private get/set/add/method textual 호출 지점 **4,009/36/38/15**에서 후보 c296ecf9…8f1be360의 **20/6/8/15**가 됐다. JS 길이는 **8,906,296→8,782,730 characters**다. 생성 C에서도 직접 own-private add/get/put primitive의 textual 호출 지점 4,050개를 확인했다. 모두 정적 출력의 수치이며 실행 빈도나 성능 개선율이 아니다.

SDK·네 App 빌드와 Source 입력 715/134/284 modules·현재 engine Source·전체 App 파일·native image/map 대조를 PASS했다. engine은 **7fde85bf683331939cbefdd47c0a1fb417805db05f37a3f1dec29e15c56ebf1a / 360 files / ABI 2 / schema 313408118**를 유지했다. Demo Windows JS/HBC는 **c296ecf9b217df968cc2e17adf2edd7d76e086cd392314b8d8cf2dde8f1be360 / befad1bcb9677cf29ffd3c9582ab12083f941c5dc27f06724346c229cb412e6d**, native DLL은 **a2f88dcc133b0cd8c374a82b99e22303667f9c2411cc1e64b49d3514a2809a05 / 60,172,800 bytes**다. map 21,599,395 bytes / 30,906 native functions의 image hash가 실제 DLL과 일치한다. Demo Web JS는 **a9d77f0570902f65ce9eb8b961423ebdef95e62d50c530257b55880a5b6e69d2**다. Testbed Windows JS/HBC는 **7e3de7d8627a95ac687e960f213969033c72f4573f0e0138b02ab8dca950a2b9 / f55df152d6b02b5a3249b0a5673ee961098cff65925fdc83de6933b51e7dfda0**, Web JS는 **6cec695617680f54ebb43c58d01718f26ca92ee152f8d2a3b063439ce645df76**다. Testbed는 bytecode이며 명시적 Demo native만 검사한 범위를 유지한다.

다른 CPU 작업을 끝낸 뒤 Calendar와 Fast를 각각 단독 실행했다. 가상 입력 시계만 3배속이며 거리·표본·animation·resident/lead는 유지했다.

| 실행 | 기능과 입력 | 성능 |
| --- | --- | --- |
| Calendar / 12개월 / YearMode | 360 updates / 2,000.453ms / 180Hz, 승인 362·거부 0·반영 360·누락 0, 2026년 11월→2027년 11월·resize·2027년/15일·종료 PASS | 이동 p95/최대 **200.279/241.915ms**, offset **최대 234ms / ≥100ms 11회 / ≥250ms 0회 — FAIL** |
| Fast / moving recontact 12회 / YearMode | 96 updates / 755.228ms, 승인 120·거부 0, 역방향 24개월→2024년 11월·2024년/15일·종료 PASS | offset **최대 246ms / ≥100ms 4회 / ≥250ms 0회 — FAIL**, 비단조 이동 p95 notVerified |

Calendar 입력 lateness p95/최대 **0.507/0.792ms**, publication gap 최대 **26.819ms**, 활성 App turn p95/최대 **145.279/165.368ms**다. cold pass **36 / input 12**는 신규/captured **784/827**, 문단 준비 **76**, build/capture/scene **78.705/43.249/53.054ms**, records/diff/비동기 commit **7/24/16ms**, wait **19.752ms**였다. §13.30의 같은 784/827 구간은 88.716/50.571/48.296ms였으나 단일 실행 차이를 native field만의 인과적 개선율로 승격하지 않는다. 긴 동기 작업과 정체는 남는다.

Source 109 calls의 published/declined/cohort-changed/closed는 **73/4/29/3**, failed/rejected/pending/overwrite는 0이다. native through **106**의 published/continued/superseded는 **66/8/31**이며 마지막 관찰 **pending 1**·역순/overwrite 0이다. shutdown 이전 retained 관찰의 pending을 0으로 고쳐 쓰지 않는다. 실제 demand와 전체 coverage-ready 연결은 계속 notVerified다. 두 실행 모두 ring/output loss 0, close reserved/memory 0, workers joined·CLI exit 0·AppExited를 확인했다.

**미검증:** 변경 후 Reversal·Contact·Web UI·heap 재관측은 하지 않았다. native field의 비용 개선율·전체 정체 해결·제품 전환을 수락하지 않는다. 목표는 active / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false이며 기존 전체 수락 의무를 유지한다.

### 13.32 조사 우선순위 변경 — Hermes/JIT와 준비 구조를 분리한다

사용자가 모든 시도 뒤에도 남은 정체의 근본 원인으로 Hermes runtime과 JIT를 질문했다. 이후 작은 constructor/encoder 수정을 먼저 추가하지 않고 **런타임 실행 비용과 새 월 준비의 동기 의존 구조를 분리**하는 방향을 우선한다. 런타임 결함·Hermes 부적합 또는 V8 전환으로의 해결을 아직 확정하지 않는다.

**현재 코드에서 확인한 사실:**

- 현재 Demo는 `engine-v2-native-unit.mjs`의 **typed=false / requireNumeric=false**로 생성한 SH native DLL을 host의 `evaluateSHUnit`으로 실행한다. Testbed의 HBC·JS timer bootstrap과 구분한다. native 기계어인 사실이 동적 객체·속성·call·GC 비용을 제거했다는 뜻은 아니다.
- `windows-native-hermes-toolchain.mjs`는 **HERMESVM_ALLOW_JIT=0**으로 빌드하고 manifest의 jit=false를 확인한다. 실제 CMakeCache도 0이며 `host.cpp`는 EnableJIT를 켜지 않는다.
- 고정 revision의 [JIT Config.h](https://github.com/meta/hermes/blob/b464dba92ad87bcfb77fae381a49a2394d9836d9/include/hermes/VM/JIT/Config.h)는 auto JIT를 AArch64/ARM64 조건에 둔다. 실제 `lib/VM/JIT`에는 arm64 backend만 있고 `lib/VM/CMakeLists.txt`도 그 emitter/handler만 추가한다. **현재 Windows x64에서는 옵션만 켜는 해법이 아니다.** 강제 allow=2가 x64 backend를 제공하는 것도 아니다.
- 같은 pin의 [runtime modes 문서](https://github.com/meta/hermes/blob/b464dba92ad87bcfb77fae381a49a2394d9836d9/doc/blog/2025-11-02-hermes-compilation-runtime-modes.md)는 baseline JIT의 대상을 hot bytecode/동적 source로 정한다. 이미 native로 컴파일한 Demo SH 함수를 JIT로 다시 최적화하는 경로가 아니다. [upstream README](https://github.com/meta/hermes/blob/static_h/README.md)도 단순 baseline JIT와 typed 최적화의 개발 상태를 구분한다.
- `runtime/app/host.ts`의 Source build/flushBuild → capture → Scene 제출은 App owner의 동기 작업 구간을 포함하고 native host는 continuation을 `drainMicrotasks()`로 실행한다. 고정 Hermes의 hint는 이 continuation을 선점하지 못한다. Core/render가 프레임을 게시해도 준비된 coverage를 기다리는 offset은 멈출 수 있다. **긴 실행 비용과 게시/coverage 의존이 결합한다는 가설**이며 특정 runtime 버그의 증명은 아니다.
- §13.16의 같은 App/engine native↔HBC 대조는 cold build/capture/scene **83.510/53.018/57.143 ↔ 136.536/78.467/73.269ms**, 이동 p95 **237.218 ↔ 379.392ms**였다. runtime 실행 모드의 영향이 있을 수 있다는 단일 대조이나 양쪽 모두 실패했고 현재 §13.31 공급의 V8 대조가 아니다. GC 누적 시간이나 첫 할당 표본만으로 234ms 정체 전체를 GC에 배정하지 않는다.

**다음 비교의 계약:** 같은 최종 Source/정책·Windows native Core/render·JSI host 기능·입력·resident/lead/animation에서 **App runtime만** 바꾸는 진단 경로가 필요하다. Hermes native AOT와 V8 optimizing JIT를 비교하고, V8에서 지원되는 경우 같은 V8의 JIT on/off도 별도 비교한다. [V8 JIT-less 문서](https://v8.dev/blog/jitless)의 지원 원리와 실제 선택한 supplier의 flag/API 지원을 구분해야 한다. Cold 첫 진입과 후속 새 월을 나누며 같은 함수의 반복 실행은 객체가 새것이어도 JIT의 대상이 될 수 있다. V8의 startup/compile·GC·heap·배경 task 비용도 포함한다. 작은 Source kernel이나 Web V8만의 수치를 같은 Windows host의 스크롤 해결로 해석하지 않는다.

기존 `windows-v8.mjs` / `sdk/native/windows/V8Runtime.h`는 **RNW supplier / JSI 21**용이며 현재 직접 V2 host의 즉시 교체 옵션이 아니다. 해당 NuGet의 C ABI adapter를 현재 JSI로 소비할 가능성은 있으나 아직 build/run을 검증하지 않았다. 직접 host의 Hermes 전용 heap accounting·external memory credit·timeout interrupt·SH loader·sampling/profile 및 V8 foreground task runner/microtask 수명까지 분리해야 한다. memory counter를 0으로 속이거나 shutdown을 약화시켜 비교를 통과시키지 않는다. product runtime을 변경하거나 V8가 더 빠르다고 아직 표시하지 않는다.

V8에서 Source CPU와 offset stall이 함께 충분히 줄면 runtime 적합성을 우선 판단한다. Source CPU만 줄어도 stall이 남으면 preparation/coverage의 동기 결합을 조사한다. 양쪽이 비슷하게 느리면 Source 작업량·할당·경계 구조를 우선한다. **Hermes runtime과 구조적 문제는 동시에 존재할 수 있다.** 고정된 수락 기준과 실제 offset 지표로 판단하며 FPS만으로 종료하지 않는다.

**미통합 소규모 후보 정리:** 바이트 FNV를 shift/add로 바꾸는 별도 후보는 독립 BigInt 24 vectors와 debug/optimized HBC/native 의미 검사를 통과했으나 kernel의 native **21→15ms**, debug HBC **26→29ms**, optimized HBC **20→22ms**로 결과가 일관되지 않았고 App에 통합하지 않았다. 해당 production 후보와 전용 kernel timing을 철회해 §13.31 공급과 Source를 다시 일치시켰다. §13.28의 indexed loop와 iterator 제거는 유지하며 독립 vector·12단계 wire/ID/공유/offset/rollback/recycle/retirement 검사, 86개 수기 파일 format/lint, Source/engine/package/네 App/native map identity를 다시 PASS했다. 이 후보를 스크롤 해결 시도로 집계하거나 runtime 원인의 반증으로 쓰지 않는다.


### 13.33 V8 JIT 직접 host 진단과 사용자 요청에 따른 정지 — PAUSED / PARTIAL

사용자는 V8 JIT으로 Demo 실행을 요청한 뒤 외출을 이유로 명시적으로 정지를 요청했다. 이 절이 현재 handoff다. 멈춤·점프 해결 목표는 미완료이며 자동으로 재개하지 않는다.

새 파일은 [check-windows-runtime-comparison.mjs](Nelyx/eng/check-windows-runtime-comparison.mjs)와 [windows-v8-comparison.hpp](Nelyx/eng/windows-v8-comparison.hpp)다. 기존 RNW를 빌드하지 않고, 고정 V8 24.1.10 / c1877966a8285b7cbacbdd03e26ca003496436bc의 C ABI adapter를 현재 Hermes pin의 JSI 헤더로 소비한다. vendor의 별도 JSI 헤더를 제외하고 const/noexcept 호환 매크로를 정했다. JSI_VERSION=19는 consumer adapter의 구형 선택 매크로이며 실제 사용한 헤더·jsi.lib는 현재 직접 host의 pin이다. V8 DLL SHA256은 106b7a596430f3de3d51c02534b31ad2c85c7df205fbdd803459ec7f26e9f250이다.

도구는 실행마다 소유 임시 디렉터리에 작은 probe와 변경된 host만 빌드하고, 현재 native Core library·현재 SDK DLL/등록 정보·현재 Demo JS와 assets를 그대로 참조한다. SDK/App/cache 설치본을 복제하지 않고 기존 dist/manifest를 교체하지 않았다. host의 runtime factory·Source loader·heap adapter·foreground task 처리·timeout 실패와 C ABI namespace 충돌을 진단 사본에서 분리했다. Windows SDK는 원래 실행 파일의 임베디드 activation context와 실제 SDK assembly directory를 사용한다. 일반 host와 App의 제품 전환이나 V8 제품 자격 부여는 아니다.

**PASS한 범위:** V8 JIT의 Promise chain·host/empty microtask와 completion bit, 32KB 외부 버퍼 내용/쓰기/단 한 번의 release, 실제 현재 Demo JS의 module initialization, 같은 isolate의 Node-API heap counter, 실제 SDK의 WinRT factory 활성화와 전체 진단 Windows host 빌드다. 외부 버퍼 probe는 alias 1 / copy 0, 초기화 probe의 heap 약 46MB·executable heap 524,288 bytes였으며 성능 목표의 근거는 아니다. MJS syntax/format/lint도 PASS했다. JITless 및 Windows 3배속 비교·실제 V8 날짜 선택·전체 의미/제품 검증은 수행하지 못했다.

V8는 ArrayBuffer backing을 자체 계상하므로 Hermes용 추가 pressure hint를 그대로 호출하지 않는다. 고정 C ABI의 pressure 구현은 amount를 가산하고 객체 finalizer와 묶지 않기 때문이다. host와 실제 data pointer가 같은 경우에만 기존 lease와 VM external bytes를 중복 차감한다. heap counter를 0으로 대체하지 않았고 totalHeapSize/externalMemory/mallocedMemory/global handles를 읽어 원래 unified ledger에 보고한다. 이 pin C ABI는 timeout interrupt를 제공하지 않아 진단 host가 정지하면 실패 코드로 종료하도록 했다. 정상 종료를 허위 PASS로 처리하지 않으며 이 제한을 product qualification으로 승격하지 않는다.

**최종 GUI startup 실패:** V8 생성·JS 실행·native App 명령은 진행됐지만 app-ready 전에 Original App viewport is unavailable가 발생했다. stack은 OriginalWidgetHost.observeMetrics ← onState ← SceneWriter.observeScene이다. 이후 startup/cleanup mailbox-closed 오류는 첫 실패 뒤의 후속 오류다. 최종 진단 host Source hash db07fd9247bf20600bcc64154254c802ccd58f0dbb0cee2e79f20cb01978e29e, exe hash 1268a05ad8b233825b0e05feddd84af07bcffb420a3316cb1ee8f90f74371fe3이었다. 이는 철회·삭제된 일회성 후보이며 현재 공급의 identity가 아니다.

실행의 V8 counters는 heapReads 136, peakHeap 52,793,344 bytes, peakExternal 60,359,900 bytes, peakExecutable 1,310,720 bytes, response alias 65 / copy 0 / alias bytes 61,560, foreground posted/executed/cancelled 0이었다. 마지막 host 상태는 appReady=false·frames=0·activeDocument=0·document=1·pendingDocument=1이다. 마지막 V2_CLOSED는 status=0·reservedBytes=0·memoryTotal=0·workersJoined=true였지만 App 오류 때문에 전체 CLI exit는 1이다. **사용 가능한 V8 Demo를 띄웠다거나 성능을 확인했다고 보고하지 않는다.**

**다음 원인 가설 — 아직 미수정/미검증:** scene.ts의 observeScene은 semanticsSnapshot의 notFound를 허용하며 semanticPublication을 비우지만, observed에는 그 notFound response를 남긴 채 onState에 전달할 수 있다. OriginalWidgetHost.observeMetrics는 state.status!==ok 또는 viewport 부재를 오류로 거부한다. 첫 publication 전의 조회가 빨라지면 이 모순이 드러날 수 있으며, 최종 activeDocument=0 상태와 stack이 이 경로에 부합한다. 아직 실패 당시 callback의 status/viewport 원본을 직접 확인하지 않았으므로 확정 원인으로 표시하지 않는다. 재개 시 먼저 notFound 결과와 정상 live state의 전달 계약·freshness fence를 코드에서 확인하고, published geometry/semantics를 섞지 않는 해법을 정한다. 단순 sleep·입력 감속·오류 무시로 덮지 않는다. 이번 정지 전에 Source scene.ts나 generated App을 수정하지 않았다.

현재 기준 공급은 engine 7fde85bf…c56ebf1a와 Demo Windows JS c296ecf9…8f1be360인 §13.31이다. 마지막 진단 시작 때 전체 기존 engine/App identity와 package Source inputs가 일치했다. 실패 후 finally로 소유 다운로드·probe·host·MSBuild intermediates를 회수했고, 정지 요청 뒤 실제 프로세스와 .nelyx 디렉터리를 확인해 NelyxEngineAppSdkHost 및 비교용 Node/MSBuild/cl/python이 없고 android-v2/windows-hermes만 남은 것을 확인했다. 이전 실패 실행의 임시 폴더도 남지 않았다. 새 코드는 보존하되 재개 요청 전에는 추가 수정·빌드·테스트·실행을 하지 않는다. 상태는 **PAUSED / PARTIAL / compatible=false / performanceAccepted=false / resizePerformanceAccepted=false**다.
