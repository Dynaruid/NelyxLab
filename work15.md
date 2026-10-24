# W15: Typed Static Hermes AOT 선정 실험 기록 (CLOSED / SUPERSEDED BY W15A)

기준일: 2026-10-22 KST

> **CLOSED / SUPERSEDED BY [W15A](work15a.md) · 선정 구현·평가 COMPLETE · 제품 PARTIAL · wholePlanComplete=false**. 이 문서는 numeric subset의 과거 계획·실험 증거로 보존한다. 전체 앱 typed AOT와 TA-07/TA-13·진단·공급·성능의 잔여 작업은 W15A로 이관하며 여기서 구현을 재개하지 않는다. standalone untyped AOT 제외 결정과 기존27회의 역사적 범위는 유지한다. 당시 정확한 구현·판정은 §9를 따른다.

## 1. 목적과 작업 범위

TypeScript의 타입 정보를 보존해 실제 Nelyx 프레임 경로를 typed native 코드로 실행하고, V8과의 프레임 성능 차이를 줄일 수 있는지 검증한다. 작은 수학 예제의 컴파일 성공과 제품 프레임의 typed 실행·성능 수락을 구분한다.

**후보 정책: standalone untyped AOT는 불필요한 경로로 제외한다.** 신규 개발·성능 후보·필수 대조군·배포 선택지로 유지하지 않는다. 제품 후보는 typed AOT이며 Hermes bytecode와 V8을 비교 기준으로 사용한다. 기존 CLI의 `--hermes-mode aot`와 전용 공급·검증 경로는 TA-13의 제거 대상이다. 이번 반영은 계획 변경이며 코드 제거 완료를 뜻하지 않는다.

여기서 제외하는 것은 전체 Metro bundle을 미타입 native AOT로 실행하는 독립 모드다. typed AOT 내부의 untyped RN/Metro bootstrap·동적 JS 경계는 같은 VM 연결에 필요한 구성으로 유지하며, 별도 untyped AOT 후보나 사용자 선택 모드로 노출하지 않는다.

Windows x64 Release를 첫 native 대상으로 한다. Core의 공개 TypeScript/ESM·`.d.ts`와 단일 Widget/Element/RenderObject identity를 유지하고, RNW·Skia·입력·접근성·GPU owner는 기존 경로를 사용한다. typed 구간과 untyped RN/Metro 코드는 **같은 VM·GC·객체 공간**에서 동작해야 한다. 기본 V8 선택 변경, 전체 RN 재작성, 다른 OS의 typed native 실행은 이번 범위에 포함하지 않는다.

typed AOT의 현행 실행 계획은 [work15a.md](work15a.md)다. 이하의 설계·단계·재개 지시는 당시 기록이며 새 구현 지시로 사용하지 않는다. [W14 §9](work14.md#9-windows-static-hermes-실험)의 미타입 도입 실험도 과거 참고 자료이며 해당 standalone 후보는 제외됐다. W14의 나머지 research/엔진·컴포넌트 작업은 계속 PAUSED/PARTIAL이다. W14 전체를 완료하거나 대체한 것으로 취급하지 않는다.

## 2. 시작 기준과 이미 확인한 사실

| 항목 | W15 작성 시점의 기준(현재 공급은 §9) |
|---|---|
| 저장소 | HEAD `903ac8af5d729fd46577093f16a9d3b18ad82e36`; 미타입 AOT의 미커밋 수정이 있음. 실행 전 diff와 공급 hash를 다시 비교한다. |
| Core / Skia RN archive | `e114c3b7dc485378c25ba48b18a6423e264bdffcbbf1fb706067cb1135d38a55` / `a7ed2015b99eb222efa9ac47e95517142952d6bec63f6c337dbbfbfa5aa19ade` |
| SDK / CLI archive | `a4348be36e3af8603a408f9331c97f9c02366935afff7fbc0b7f9d432b448e85` / `082d2b3e6f62e787b29f0cd09f2af7fc73bd10e2db6a3d0f43203ac82882a8de` |
| Native inputs | `cf218f5831ffa57be820cbada5f32d99c6612c3ee62f21a0c63e032039ca8efd` |
| Hermes source | Microsoft `94aa5e1d40a4ce99df79d951cbe45310ec40680c`, Hermes1.0.0/HBC99 |
| 당시 custom runtime / toolchain | `635a4d8a92aafa973825d30a981e1c20985e8c7d70bf320f7705ccb9614581a0` / `8be05e4e140db77bf25d3b12cd797c75e9cff6e2f77748510115423bd82906a4` |
| 당시 실행 구조(제외된 후보) | 전체 Metro JS→untyped C→clang `-O3`→단일 AOT DLL. Node-API native root admission, 프로세스당 앱1회, image exit까지 pin. |
| 기존 compiler 제한 | `windows-hermes-94aa5e1d-no-cfg-v1`: loop phi 오염 때문에 no-CFG/no-inline 정책 적용. typed에서도 무조건 해제하지 않는다. |
| 선행 결함 | 입력 본문은 동작했으나 최종 입력 suite의 close에서 GPU owner/phase admission 실패·exit2가 관측됨. 정상 종료 수락은 미완료. |

다음 값은 같은 Core·native 입력·기본 창의 **각1회** 기준이다. Hermes 두 경로는 동일 custom VM·RN Babel·비압축 입력이며 V8은 native ES2022 변환을 사용했다. 수치는 callback wall time이고 물리 FPS가 아니다.

| 기준 경로 | warm callback p95(ms) | 먼 재방문 max(ms) | 입력 수신→surface p95(ms) | process peak working set(MiB) |
|---|---:|---:|---:|---:|
| Hermes bytecode |18.07|256.93|23.72|314.3|
| Untyped native AOT(제외·과거 참고) |17.05|254.50|23.42|331.5|
| V8 |7.48|89.77|13.58|526.3|

당시 standalone AOT unit은56.4MiB이며 fixture 전체 빌드·검증은730.81초였다. 이 절의 untyped AOT 수치는 제외된 후보의 과거 참고값이다. 새 코드나 VM revision을 선정하면 현재 비교 대상인 typed AOT·Hermes bytecode·V8을 같은 공급에서 다시 측정한다.

## 3. 기술 전제와 조사할 불확실성

현재 pin의 [shermes.cpp](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/tools/shermes/shermes.cpp)는 `-typed`를 제공하며 typed에서 strict mode와 static builtins를 다룬다. [TypeScript stripping 문서](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/doc/typescript-stripping.md)는 `--transform-ts`가 타입을 지우며 typed 모드와 함께 사용할 수 없음을 명시한다. 따라서 기존 Metro/Babel 산출물에 typed 옵션을 붙이는 것만으로 타입 정보를 복구할 수 없다.

2026-10-22 열람한 [upstream Typed Language](https://github.com/facebook/hermes/blob/static_h/doc/TypedLanguage.md)는 개발 중인 명세다. TS 지원은 부분적이며 exact object·nominal class·typed array 등의 의미가 일반 TS/JS와 다를 수 있다. 이를 현재94aa compiler의 지원표로 사용하지 않는다. 현재 pin에는 같은 경로의 TypedLanguage 문서가 없으므로 실제 source/test와 작은 compile/run probe로 지원표를 확정한다.

[Compilation and Runtime Modes](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/doc/blog/2025-11-02-hermes-compilation-runtime-modes.md)는 같은 runtime에서 native와 bytecode 등을 혼합할 수 있다고 설명한다. 이것만으로 Nelyx의 module 연결·typed/untyped class 상호 운용·현재 Node-API loader가 완성됐다고 간주하지 않는다.

| 조사 항목 | 필수 판단 |
|---|---|
| TS frontend | 현재 pin의 `-parse-ts` 범위, Flow 입력과 TS 입력의 타입 보존 차이, generic/union/readonly/overload와 diagnostic 위치 |
| 객체·배열 | exact field/order, 일반 배열과 typed 배열의 차이, bounds/hole/alias·optional/null/undefined 의미 |
| 클래스 | nominal identity, 상속·mixin factory·static-of·override·getter/setter·private receiver·`instanceof` |
| JS 의미 | strict/this, builtin 교체·polyfill, Proxy/descriptor/freeze, Symbol/WeakMap, spread/optional call·async/generator |
| 최적화 | typed 필수 lowering과 기존 custom pass list의 관계, typed field/numeric/call 최적화가 실제 IR/C에 남는지 |
| Native 연결 | 두 SHUnit의 같은 VM 로드, 등록 순서·GC roots·예외·재진입·실패 뒤 owner 수명 |

지원하지 않는 항목은 소스 위치·의미·소유 패키지와 함께 명시한다. `any` 확대, 타입 단언 추가, 검사 삭제, 손으로 고친 generated C로 성공 처리하지 않는다. 타입 없는 경계를 유지하는 경우도 partition 계획에 드러나야 한다.

## 4. 구성 방향과 소유권

첫 후보는 **typed leaf unit + untyped Metro bootstrap unit을 같은 native image/VM에 연결**하는 방식이다. 두 unit을 안전하게 초기화할 수 있는지는 TA-03의 검증 대상이다. 여러 unit을 지원한다는 가정으로 현재 단일 unit loader를 먼저 바꾸지 않는다.

```text
제품 TS + 정확한 module/type graph
  → TypeScript checker + 지원 의미 분석
  → typed 구간: 타입이 남는 IR/Flow 또는 검증된 TS 입력 → typed C
  → 나머지 구간: 기존 RN/Metro 변환 → untyped JS/C
  → 중복 없는 module 연결 + native link
  → 같은 Hermes VM의 native root admission → 기존 RNW/Skia 실행
```

| 소유 위치 | 계획상 책임 |
|---|---|
| `Nelyx/src`, design package source | 제품 의미와 공개 API. 플랫폼 전용 Hermes 문법·decorator를 제품 원본에 흩뿌리지 않는다. |
| `Nelyx/sdk/tooling/typed-aot/` (신규 후보) | source/type graph, 지원 의미 판정, typed IR·lowering·partition·원본 위치 매핑. 필요한 checker API와 버전을 build 의존성으로 고정한다. |
| `Nelyx/sdk/tooling/metro/` | typed 구간이 타입 제거 이전에 분리되도록 bundler를 연결하고 RN 변환·module ID·평가 순서를 유지한다. |
| `Nelyx/sdk/tooling/cli/` | 준비·빌드 옵션, 정확한 compiler/runtime/policy 선택, manifest·공급·실행 검증. |
| `Nelyx/sdk/native/windows/StaticHermes.h` 및 owned runtime patch | root admission, 전체 앱1회 초기화, unit/image 수명과 실패 처리. |
| `Nelyx/eng/tests/`, Testbed | 차등 의미 검증, 실제 native 입력/종료, typed 실행 증거와 성능 측정. |

compiler나 Metro를 Core runtime에서 import하지 않는다. 독립 tooling package를 추가하면 package boundary·exports·버전·license도 함께 관리한다. SDK 사용자가 import만 해도 source download나 native build가 시작되면 안 된다.

## 5. 실행 작업과 완료 조건

현재 실행 상태는 §9에 기록한다. TA-01/02/04의 독립적인 정적 작업은 종료 결함 조사와 병행할 수 있다. GPU 종료 수락이 실패한 상태에서 native 통합 완료나 성능 후보 승격으로 진행하지 않는다.

| ID | 작업 | 선행 조건 | 완료 증거 |
|---|---|---|---|
| TA-00 | 현재 diff·공급·native 기준 재확인, GPU 종료 실패 원인 분리 | 없음 | expected/actual phase·owner·view/consumer·pending·device 생성·drain과 최초 실패를 확인. 원인 수정과 선정 native 입력/종료 회귀 통과. |
| TA-01 | compiler 지원표·typed 최적화 정책·revision 선정 | 기준 inventory | 현재 pin의 compile/run probe와 IR 확인. 신규 revision이 필요하면 compiler·runtime·Node-API·heap/CRT·ICU·license·patch를 하나의 pin으로 재검증. |
| TA-02 | 실제 package source/type/module graph와 SCC 조사 | TA-01 | 설치본에서 entry→body→type 의존성과 동적 경계 목록. 각 모듈·constructor·singleton의 owner1개 및 원본 source hash. |
| TA-03 | 같은 VM의 typed/untyped unit 연결 prototype | TA-01 | typed 숫자 함수·callback·객체·예외·GC·반복/누락/잘못된 unit 거절. interpreter에서 초기화 재진입하지 않고 앱 전체1회 admission. |
| TA-04 | 타입 보존 frontend와 공통 lowering | TA-02, TA-03 | annotation·generic·import/export가 타입 제거 전에 처리됨. 미지원 진단과 TS 위치, typed IR/C·생성물의 결정성. |
| TA-05 | 의미 차등 회귀와 경계 계약 | TA-04 | 원래 JS와 typed 결과의 반환값·mutation·identity·getter 횟수·예외 순서 일치. 잘못된 타입의 검출과 허용 입력의 호환성 확인. |
| TA-06 | 실제 제품 leaf 구간의 native 통합 | TA-00, TA-05 | 실제 Core 함수 body를 생성 경로로 컴파일·연결. 실제 앱이 typed 경로를 호출했다는 증거와 경계 변환 비용을 포함한 측정. |
| TA-07 | profile에 근거한 프레임 hot path 의존성 확장 | TA-06의 의미·비용 검증 | 선정 loop/owner의 필요한 body·private helper·SCC를 함께 전환. 적어도 하나의 실제 프레임 hot path에 typed 최적화가 적용됨. |
| TA-08 | CLI·정책·metadata·실행 검증 | TA-03, TA-04, 선정 partition | 명시적 typed 옵션, 내부 untyped 경계 범위·source/unit/runtime hash·생성 정책 검증. bytecode/V8 경로 보존. standalone aot 옵션은 TA-13에서 제거. |
| TA-09 | native 기능·수명·실패 경계 수락 | TA-00, TA-07, TA-08 | 아래 native matrix 통과. 실제 package의 responsive 창·DLL 로드·협력적 close/exit0와 예상 실패 exit2를 구분. |
| TA-10 | 같은 공급에서 성능·크기·메모리 비교 | TA-09 | 기본/최대화 창의 선정 반복 표본, typed 실행 확인, 내부 경계 계측, 빌드/실행 비용과 회귀 결과. |
| TA-11 | source→dist→archive→설치→공개 실행 검증 | TA-08~10 | 변경 파일 byte/hash·declaration/export·입력 map·native symbol 출처·package inventory 확인. |
| TA-12 | 판정·정리·사용 안내 | 앞 단계의 증거 | 채택 가능/실험 유지/미지원 경계를 구분. 현재 결과·남은 일만 기록하고 임시 산출물·검증 프로세스 정리. |
| TA-13 | 제외된 standalone untyped AOT 경로 정리 | 후보 제외 결정, typed 공통 의존성 확인 | CLI/schema/template/script/문서의 standalone aot 선택 제거, 전용 metadata/loader/회귀 정리, 비교 driver를3경로로 변경. typed 공통 compiler/VM/내부 bootstrap 유지와 bytecode/V8 회귀·공급 일치 확인. |

### TA-00 종료 선행 조건

원본 Hermes bytecode·같은 custom VM의 bytecode·typed AOT와 V8을 필요한 최소 재현에서 대조한다. standalone untyped AOT의 과거 재현 결과는 참고만 하며 재실행을 요구하지 않는다. 종료를 늦춰 결함을 숨기지 않고 GPU 작업·resize·input이 남은 경우도 검사한다. `gpuDrained=0`나 미확인 owner를 exit0으로 바꾸지 않는다. 최종 오류에 덮인 최초 실패를 보존하고 수정된 owner 경로를 검증한다. 이 결함이 typed 도입으로 해결된다고 가정하지 않는다.

### TA-01 compiler 선택과 optimizer 정책

우선 현재94aa pin으로 가능 범위를 확인한다. 최신 branch의 문서와 지원 기능을 현재 binary의 기능으로 보고 진행하지 않는다. revision 교체가 필요하면 하나의 정확한 후보를 선정하고 RNW가 요구하는 Microsoft Node-API 진입점·ABI와 native unit layout을 모두 다시 확인한다. 새 compiler와 옛 VM을 섞지 않는다.

typed 전용 policy ID를 두고 필수 pass 순서를 확인한다. 기존 no-CFG/no-inline 목록을 그대로 적용해 typed lowering이 사라지거나, 성능만을 위해 알려진 loop 오염 pass를 복구하면 실패다. Cubic·loop phi·예외·GC 회귀와 실제 앱을 모두 통과해야 정책을 선정한다. revision 변경 효과와 typed 효과를 분리하도록 같은 후보 VM의 Hermes bytecode 대조군을 유지한다.

### TA-02~05 타입 보존과 의미 검증

1. `.d.ts`만으로 구현을 재생성하지 않고 실제 TS body와 checker symbol을 연결한다. 현재 TypeScript CLI와 별도로 checker API가 필요하면 tooling 안에서 의존성을 고정한다.
2. 타입을 보존하는 공통 중간 표현에 module/symbol identity·source 위치·nullability·호출/field 타입·동적 경계를 둔다. 단순 TS→Flow 텍스트 치환으로 완료하지 않는다.
3. generic은 지원이 검증된 표현이나 제한된 specialization을 사용한다. specialization 수를 제한하고 code size를 기록한다. recursive generic·mixin·SCC를 `any`로 우회하지 않는다.
4. 외부 TS 구조적 객체를 typed exact object나 nominal class로 바로 단언하지 않는다. 기존 계약과 다른 필드 읽기·복사·bounds 검사·런타임 cast가 생기면 호환성을 증명하거나 해당 경계를 untyped로 남긴다.
5. typed와 untyped에서 같은 Core 객체를 두 constructor로 만들지 않는다. module 중복 평가·singleton 복제·`instanceof` 분열을 검사한다. 일반 객체·Proxy·private receiver를 필드 모양만 보고 바꾸지 않는다.
6. `Object.freeze`, descriptor, prototype/메서드 교체와 getter 관찰을 보존한다. 생성 시 고정돼 보인다는 이유로 공개 override나 accessor를 자동으로 final 처리하지 않는다.
7. `NaN`·Infinity·음수0·반올림·nullable·배열 범위·클로저·재진입·오류 순서를 비교한다. 예를 들어 constraints의 합법적인 Infinity를 일괄 finite 검사로 거절하면 안 된다.

typed 선택 함수, 실제 typed IR/field·numeric·call 최적화, 남은 dynamic call/checked cast, untyped 의존성과 경계 변환을 기록한다. `-typed` 옵션 사용이나 타입 이름의 존재만으로 typed 실행을 판정하지 않는다. 미지원 의미의 silent fallback은 금지하고 명시적 partition 제외와 이유를 남긴다.

### TA-06~07 제품 전환 순서

| 순서 | 후보 | 선정·중단 조건 |
|---|---|---|
| 1 | `Nelyx/src/framework/animation/curves.ts`의 숫자 loop, `ui/geometry.ts`·`ui/matrix4.ts`의 선정 수학 경로 | 실제 함수 body를 사용한다. identity/freeze 계약과 경계 비용을 확인한다. microbenchmark만 빨라지면 프레임 개선으로 확대하지 않는다. |
| 2 | `framework/rendering/object.ts`·layout/constraint·scene 작성의 선정 loop | 최신 native profile로 비용을 확인하고 helper·상속/mixin·SCC의 필요한 범위를 함께 처리한다. 경계 왕복이 늘면 partition을 재검토한다. |
| 3 | `framework/widgets/framework.ts`의 선정 build 경로·semantics 및 RN `renderer.ts` replay의 적합 구간 | 사용자 callback·동적 method·자원 owner는 기존 의미를 유지한다. class 상호 운용이 미지원이면 그 사실을 명시하고 leaf 성공으로 전체 완료를 선언하지 않는다. |

실제 hot path의 원본을 바꾸지 않는 자동 생성 경로를 우선한다. handwritten typed 복사본·샘플 전용 알고리즘·무제한 cache/keepAlive로 수치를 바꾸지 않는다. 변환 개선은 공통 compiler owner에 반영하고 다른 엔진에서 소비하는 제품 TS/ESM 의미를 보존한다.

### TA-08~09 CLI와 native 수명

CLI는 `--engine hermes --hermes-mode typed-aot`다. 구현된 실험 옵션이며 Hermes bytecode·V8 경로와 구분한다. standalone `--hermes-mode aot`는 TA-13의 제거 대상이다. 전체 RN bundle을 typed로 강제하지 않고 metadata에는 `hybrid-typed-native`와 실제 partition 범위를 기록한다.

unit 계획·typed/untyped source hash·compiler/VM/bridge hash·heap/CRT·optimizer/변환 정책·entry 형식을 검증한다. 여러 unit을 지원하려면 기존 v1 marker/단일 export 계약을 명시적으로 versioning하고, unit 등록 순서와 전체 초기화 성공 뒤의 ACK를 정의한다. 하나라도 실패하면 초기화 완료로 표시하지 않는다. 기존 프로세스당 앱1회·native image pin·JS owner와 GC root 계약을 유지한다.

native matrix에는 callback/microtask·GC/closure·실제 getter/private identity, unit 누락·잘못된 export/순서·반복 진입, GPU caret/pixel·TSF/UIA/privacy·OS key/Unicode, 목록 선택·scroll·resize·route/state 보존, 정상 GPU/input drain, presentation/bundle 실패와 시작 Close를 포함한다. 물리 IME 후보창·reader·precision trackpad·scanout은 별도 검증 없이는 notVerified다.

원본 TS→typed 입력→C의 진단 위치와 module 출처를 연결한다. Metro 입력 map과 native PC/PDB 주소 매핑은 별도로 검증한다. 입력 JS source map을 native instruction map으로 표시하지 않는다. 공개 package는 compiler cache 없이 실행돼야 한다.

### TA-13 standalone untyped AOT 제거

**미완료: 이번 반영은 문서의 후보 정책 변경이다.** 후속 구현에서는 CLI/schema/template/config/script/README의 standalone `aot` 선택과 해당 모드만을 위한 metadata·loader·회귀를 제거한다. typed AOT가 공유하는 compiler·VM·native image 공급·SHUnit 등록·내부 untyped bootstrap은 의존성을 확인해 유지한다. 기존 v1 경로를 쓰는 typed 검증이 있으면 typed v2 계약으로 옮긴 뒤 전용 경로를 제거하며, 파일명에 `static-hermes`가 있다는 이유로 공통 구현을 삭제하지 않는다.

비교 driver에서 standalone `aot`와 annotation 제거 `boundary-control`을 제거하고 typed AOT·bytecode·V8의 정상18회와 세 경로의 실패 경계9개(3종×3경로)로 정리한다. 코드 정리 후 typed/bytecode/V8 회귀와 source→dist→archive→설치→공개 package 일치를 다시 확인한다. 기존27회 결과를 새 구성의 검증으로 대체하지 않는다.

## 6. 성능 비교와 판정 기준

앞으로의 필수 비교는 **typed AOT / 동일 후보 VM의 Hermes bytecode / V8** 세 경로다. Core·앱·자산·native inputs·semantics·최적화 설정과 workload를 고정한다. Hermes 두 경로의 번들 변환 차이를 통제하고 V8의 ES2022 변환 차이는 별도로 적는다. standalone untyped AOT와 이를 사용하는 annotation 제거 경계 대조는 후보·필수 matrix에서 제외한다. typed 내부 경계 비용은 실제 호출 수·선정 phase 계측·IR로 확인한다.

기본/최대화 창에서 각3회, 본선은 **3경로×2창×3회=18회**다. TA-13에서 비교 driver를 이 구성으로 정리한다. 의미나 수명 검사가 실패하면 남은 성능 반복으로 성공 표본을 고르지 않는다. compiler/build 작업·다른 검증 창과 측정 구간을 겹치지 않고 순서를 교대하며 전원·외부 부하·OS cache와 실제 입력 간격을 기록한다.

같은 입력은 한 번 빌드해 재사용하고 viewport/workload는 검증된 fixture 설정으로 바꾼다. 동일 package/SDK/cache 전체를 반복 복제하지 않는다. 시간 계측과 상세 sampling/IR 조사는 별도 실행으로 구분한다.

| 항목 | 반드시 남길 결과 |
|---|---|
| 프레임 | warm·cold 진입·먼 재방문·resize의 callback n/p50/p95/max, mount/unmount·cache·geometry·표시 단계 식별 |
| 전달 지연 | matching input→surface와 resize request→surface의 n/p95/p99/max. 표본 누락·서로 다른 epoch를 섞지 않음. |
| 실행·메모리 | 실제 typed 함수 호출/IR 증거, typed↔untyped 경계 호출·변환 비용, GC와 VM heap, 전체 process peak를 구분 |
| 빌드·배포 | compiler 준비·typed 변환·C compile/link·전체 검증 시간을 분리, DLL/추가 bundle·package 크기와 source map |
| 기능·수명 | 오류·state·접근성·input·resource/GC·GPU drain 회귀. 실패를 성능 성공 표본으로 수락하지 않음. |

다음 값은 **후보 제외 결정 이후의 채택 기준**이다. 기존 untyped AOT 대비20% 개선 조건과 그 unit 크기 대비10% 조건은 비교 대상이 없어 삭제한다. V8 기준·재방문·정확성 기준은 유지한다. 이 계획 변경으로 §9의 과거 측정을 새18회 검증이나 채택 성공으로 재해석하지 않는다. 새 배포 예산은 재측정 전에 고정한다.

- 정확성·같은 VM/identity·native 수명·실패 경계·공급 검증을 모두 통과한다. 설명되지 않은 종료 실패가 남으면 제품 수락은 PARTIAL이다.
- 각 창의 run별 warm p95 중앙값이 V8 대조의1.10배 이내인지 확인한다. 같은 VM의 bytecode 대비 개선폭과 cold/입력/resize·경계 비용도 함께 보고한다.
- 정상 반복 재방문에서100ms 이상 callback이 남는지 확인한다. §8의 기존 미충족 목표를 typed 컴파일 성공으로 대신 충족 처리하지 않는다.
- 입력/resize p95가 V8보다10% 넘게 악화되거나 process peak가 같은 VM의 bytecode보다10% 넘게 늘면 이유와 비용을 해소하기 전 채택 권고를 보류한다. native unit 추가 비용과 동일 자산을 포함한 전체 package 크기는 bytecode와 비교해 기록하고 채택 전에 별도 배포 예산을 확정한다. process peak를 JS heap 절감으로 표현하지 않는다.
- 위 상대 기준과60/120/165Hz의16.67/8.33/6.06ms 예산을 별도로 보고한다. callback 예산 충족을 실제 FPS/scanout 증거로 바꾸지 않는다.

typed 경로가 실제로 실행돼도 프레임 개선이나 의미 호환성이 부족하면 **실험 유지/PARTIAL**로 판정한다. 도구 구현 완료와 제품 채택을 구분하고, 무조건 V8을 이길 것이라는 전제를 두지 않는다. 기본 엔진 변경은 이 계획의 산출물이 아니다.

## 7. 검증·공급·정리 규칙

- [저장소 지침](.github/copilot-instructions.md)을 따른다. 테스트 timeout은20분이며 대용량 build/pack/native 검증 전 작업 드라이브 여유20GiB 이상을 확인한다.
- 단계에 맞는 compiler 차등·기존 loop·Core/SDK 의미·타입/export·package boundary 회귀를 수행한다. 공통 원본이 바뀌면 Web/일반 Hermes/V8 계약도 확인한다. Windows 증거를 다른 OS 수락으로 확대하지 않는다.
- source→현재 dist/declaration/map→archive→설치→AOT 입력/unit→공개 package를 확인한다. 설치본이 실제로 사용한 body와 compiler/runtime/생성 정책을 대조한다.
- native 실행은 실제 window title·Responding·현재 package의 DLL 경로·협력적 close/exit 상태로 확인한다. 강제 종료는 정상 drain 증거가 아니다.
- 현재 manifest에는 실행에 필요한 source/unit/policy 식별만 두고, 검증 log·receipt·checkpoint/history JSON을 누적하지 않는다. 현재 상태·원인·잔여는 이 문서, 사용법은 기존 README에 남긴다.
- 임시 project/entry/config·C/obj/lib/exp·raw profile·검증 로그는 성공/실패/중단 모두 finally로 정리한다. 현재 공급과 필요한 재사용 toolchain만 보존하고, W14 §7/8의 과거 거부된 삭제는 재시도하거나 우회하지 않는다.

## 8. 완료 확인과 선정 범위

- [x] TA-00 종료 실패 원인·수정·선정 native 회귀
- [x] TA-01 현재 pin의 선정 compiler 지원표·typed optimizer 정책
- [x] TA-02~05 선정 subset의 module/identity·타입 보존 frontend·같은 VM 연결·차등 의미
- [x] TA-06 실제 Core 세 body와 실제 route 프레임의 typed 실행
- [ ] TA-07 rendering/layout/build hot path·class/array/closure/SCC 확장 수락
- [x] TA-08~09 명시적 CLI·metadata와 선정 native 기능/수명/실패 경계
- [x] TA-10 후보 정리 전 기본/최대화 본선27회·경계 비용·메모리/크기 판정(과거 참고, 성능 기준 미달)
- [x] TA-11~12 선정 공급·공개 실행·문서·정리 및 PARTIAL/notVerified 표시
- [ ] TA-13 standalone untyped AOT 옵션·전용 경로 제거와3경로/18회 matrix 반영·회귀

**선정 후보 평가 결과와 남은 제품 범위는 §9를 따른다.** §2의 수치와 공급 hash는 W15 작성 시점의 미타입 기준이며 새 구현의 성능 증거가 아니다.

## 9. 2026-10-22 현재 실행 상태

계획 실험 유지 / 선정 구현·평가 COMPLETE / 제품 PARTIAL / wholePlanComplete=false. 사용자 결정으로 standalone untyped AOT를 후보에서 제외했고 실제 옵션·코드·matrix 제거는 TA-13 미완료다. 재개 HEAD는 `28209265257267ab459846f98bd284bf94b5f2a7`이며 중단 당시 미커밋 구현을 보존했다. native inputs는 `cf218f5831ffa57be820cbada5f32d99c6612c3ee62f21a0c63e032039ca8efd`다. 아래 source/archive/install은 후보 제외 전 검증 공급이며 코드 정리 후 다시 맞춘다.

### TA-00 종료

최초 실패는 원본 Hermes에서도 재현된 producer-close 경합이다. active 때 승인된 recording이 GPU worker에서 실행되기 전에 UI가 closing으로 전환하면서 기존 consumer admission이 거절됐다. 기존 실패의 최초 이유는 `Composition consumer admission is closed`, 최종 phase는 failed, views=1/consumers=1/gpuDrained=false였다.

수정은 UI에서 active 때 승인한 최대8-frame batch에만 소모 가능한 render permit을 부여한다. closing에서는 그 batch의 upload/fence 회수만 마치고 새 batch는 받지 않는다. child visual은 UI retirement 시 분리하고 이미 승인한 native plan의 완료까지 attachment/consumer를 유지한다. GPU drain 확인과 최초 실패 보존은 유지한다.

강제 재현 fixture가 앞선 consumer retirement까지 worker에서 막을 수 있었으므로 numeric pending observation으로 이전 packet이 retire된 뒤 다음 producer를 차단하도록 수정했다. 수정 후 원본/custom Hermes bytecode 모두 admitted=1→active→closing→views=0/consumers=0/gpuDrained=1/inputRetired=1과 exit0를 통과했다(한 suite 201.90초). V8은 전체 입력·실제 GPU caret 픽셀·TSF/UIA·Unicode·resize와 같은 forced-close를 통과했다(133.07초). 미타입 AOT의 전체 입력/forced-close도 통과했다(380.73초).

### TA-01~05 compiler와 의미

revision은 `94aa5e1d40a4ce99df79d951cbe45310ec40680c`를 유지한다. typed policy `windows-hermes-94aa5e1d-typed-no-cfg-v1`은 필수 stripdebug와 기존 no-CFG/no-inline 순서를 유지한다. native C는 `-ffp-contract=off`를 사용하며 미타입 대조도 같은 native image owner를 사용하도록 정리했다.

현재 TS frontend의 generic/union/nullable/readonly-array/object-literal/class-method/private/getter/Promise/overload 입력은 선정 probe에서 거절된다. 이것을 최신 upstream의 지원표로 바꾸지 않았다. 새 공통 numeric control-flow IR은 실제 TS body/checker symbol과 원본 위치를 보존하고 required scalar parameters, local variables, 산술/비교/분기/for/break/throw/return을 처리한다. receiver와 외부 lexical binding은 원래 module의 dynamic 경계를 유지하고 number field/call은 검사한다. nominal class나 typed array로 구조적 객체를 바꾸지 않는다. 지원하지 않는 구문은 원본 TS line/column의 `NELYX_TYPED_UNSUPPORTED`다.

Flow parser는 선정 generic/union/exact-record/array/class/private/getter 입력을 IR까지 처리했지만 이것이 기존 JS 객체와의 호환성을 뜻하지 않았다. 같은 pin/policy/Node-API VM의 별도 diagnostic에서 plain/reordered record는3을 반환했으나 accessor record는 잘못된 결과 또는 process fault, string field는 per-field TypeError 없이 문자열, 일반 JS array는 access violation을 보였다. 따라서 record/array를 무검사 reinterpret하는 경계는 **blocked**다. 회귀는 이 제한이 바뀌면 재평가를 요구한다. Flow 전체 언어의 실패로 일반화하지 않으며 제품의 checked dynamic receiver와 scalar 경계를 유지한다.

실제 `Cubic.transformInternal` loop, `Cubic._evaluateCubic`, `value-math.lerp`를 선택한다. receiver/Proxy getter 횟수, override·예외 identity, callback 뒤 lexical Math 교체, freeze/instanceof, NaN/Infinity/음수0/subnormal·평가 순서와 결정성의 선정 JS/native 차등 검증을 통과했다. trusted numeric ABI는 IIFE 안에 숨기고 checked callable과 숫자 call-count accessor만 내보낸다. 이것은 전체 Core 객체/class/array frontend 수락이 아니다.

같은 VM의 실제 Node-API v2 admission도 통과했다. typed leaf→untyped root를 순서대로 로드하며 양쪽 export/정책/partition/순서를 먼저 확인한다. callback/getter/일반 객체/private identity·예외·microtask·GC, interpreter 재진입/반복 거절, 누락 export·잘못된 정책/순서·root throw와 실패 후 owner 수명을 검사했다. 두 unit이 모두 성공한 뒤 initialized=true/unitsInitialized=2를 ACK한다. native image는 기존처럼 process exit까지 pin한다. 현재 재사용 custom runtime hash는 `d152d2b9d0ea33ff1fe52e0c88b39ab076fe06d30c376a09e10efc4cc69122e2`, toolchain manifest는 `f6f3401285b3b12400e41c9dd61788f8ed7211e97864158d1b6eb3e5fae50831`다.

### TA-02 source identity와 TA-08 공급

설치본 전체 source graph의 PageRoute variance3개는 실제 필요한 generic/gesture surface 계약으로 수정했고, Skia의 global 선언 누락2개는 globalThis로 수정했다. Skia pictures/rasterization의 react-native source export 누락도 수정했다. 새 archive의 설치 graph는926 modules, checker errors0, source/emitted 중복 identity0, runtime SCC890개다. graph hash는 `c3f5c529705b0cc86d73119642fbc81ece75aa11a5fbf6c070b24ebcc8b0aaa6`이다. explicit boundary는 Proxy10/mixin123/external65/unresolved2이며 마지막2개는 shader asset import와 optional react-native-worklets다. 선정 typed body의 누락이나 checker 오류를 이 경계로 숨기지 않는다.

CLI `--engine hermes --hermes-mode typed-aot`, 두-unit metadata/입력 map, Metro adapter와 native image 빌드 구현을 추가했다. RN class lowering 이전의 선택 body만 바꾸며 source/hash/누락 selection을 검사한다. 실제 Core 원본/class/module 평가는 복제하지 않는다. 당시 bytecode/aot/V8 경로를 보존하고 Debug/V8 typed 선택을 거절했다. standalone aot의 보존 방침은 후보 제외 결정으로 폐기했으며 TA-13에서 제거한다. 아래 공개 앱 실행까지 검증했으며 전체 프레임 성능 수락은 별도다.

실제 native 호출 counter가0인 것을 확인해 Metro의 relative filename을 잘못 해석한 변환기 결함을 수정했다. projectRoot 기준 경로로 선택하며 Babel 최종 AST의 호출과 모든 선정 모듈의 소비를 빌드 중 확인한다. 소비 확인용 임시 slot은 finally로 삭제한다. 수정 전 두-unit 로드/UI 성공은 실제 typed 실행 증거로 수락하지 않는다. 수정 후 전체 typed 입력 suite를 통과했다(380.76초): 실제 editor opacity animation의 Cubic179/helper1620회, 문서/선택 보존, GPU caret/TSF/UIA/privacy/Unicode/resize와 producer-close의 drain/exit0를 확인했다. 이 화면은 lerp를 호출하지 않으므로 세 함수 전체의 frame 호출은 route 비교에서 별도 검사한다.

`check:types`, `check:cli-types`, package boundary, source/numeric/control-flow/Metro 회귀 및 관련 native Babel·gesture·공급 회귀44개를 통과했다. native opt-in을 켠 typed 회귀15개와 frame terminal 회귀4개를 각각 실행해19개 모두 통과했다(skip0). 최종 `test:typed-aot`는 이19개를 포함한다. Flow 경계 제한과 실제 native Proxy/freeze/getter 순서·잘못된 숫자 field의 checked-cast 거절도 검사했다. 기존 static admission3개, `test:animation-curves`의 설치/native 포함3개도 통과했다. native/compiler 실험은20분 timeout과 실행별 finally 정리를 사용한다.

측정 공급8개 패키지의 archive 전체 member를 workspace와 설치본에 byte/hash 대조했다(Core3146/SDK578/Skia1328/Metro29/CLI253/typed-aot11/Material1324/Cupertino347 files). 이전 전체 SDK 복사 대신 변경 tooling archive만 갱신하는 공급 경로를 추가했고 변경되지 않은 content-addressed archive는 그 자리에서 재사용한다. CLI의 생성/공급 누락도 수정했다: 새 앱의 각 runner에 typed-aot 로컬 archive를 전달하며 현재 CLI의 필수 build 의존성 누락을 supply 단계에서 거절한다. 생성/설정2개와 갱신된 공급 회귀를 통과했다. CLI archive SHA256 `720f06c23064312ac68f361ff968bdff6191a1c8bd1139209919aec5749b0dce`를 설치하고253 files를 다시 전부 byte/hash 대조했다. Windows compiler/Metro/VM/runtime source는 바뀌지 않았고 새 CLI의 공개 run에서도 같은 package의 responsive 창·3개 DLL 경로·협력적 close/exit0를 재확인했다.

현재8개 archive의 정확한 버전·전체 SHA256과 로컬 참조는 [Windows runner package.json](sample/nelyx-testbed-app-2/windows/runner/package.json)에 고정돼 있다. 별도 소비자 설치본이나 과거 archive 사본을 만들지 않았다.

공개 CLI prepare/build/run도 통과했다. Release package1779 files/419,767,612bytes, portable Metro map1404 modules, native AOT DLL58,948,608bytes/SHA256 `20059ded0000659576176b67eed51c005c95a896df1ea9d94e316672b137f1c3`다. 두-unit native compile/link353.84초(typed frontend45.77ms/native161.43ms, root frontend24.15초/native329.20초)였다. 원본 build output과 package의 exe/VM/unit/source/typed-map/metadata를 hash 대조했고, 순서/flags/source hash/map hash/mode 변조5개를 거절한 뒤 원래 bytes를 복원했다. `NelyxTestbed2`/Responding=True, 현재 package의 Microsoft.ReactNative.dll/hermes.dll/NelyxApp.aot.dll 로드와 협력적 CloseMainWindow 뒤 CLI exit0를 확인했다. runtime 검증·로더는 compiler cache를 조회하지 않으며, 실행 때 toolchain 환경 경로도 unavailable 값으로 두었다. package의 qualification=notVerified는 물리/전체 제품 수락을 뜻하므로 유지한다.

### TA-06~10 후보 정리 전 비교 결과(과거 참고)

다음은 **후보 제외 전 완료한27회 측정의 참고 자료**다. 표의 untyped AOT·annotation 제거 경계 대조는 제외된 경로이며 향후 후보·필수 재실행 대상이 아니다. 당시 수정된 단일 fixture/공급에서 V8/custom bytecode/untyped AOT/typed AOT × 기본/최대화 ×3회=24회와 경계 대조 기본3회가 모두 기능 검사를 통과했다. builder 종료 뒤 순서를 교대했다. 별도 V8 기능 사전검사3회와 당시5경로의 presentation/bundle/startup-close 실패 경계15개도 통과했다. 정상 본선은 GPU/input drain과 exit0, 의도한 실패는 exit2, startup-close는 취소 exit0로 구분했다. 준비·사전검사·본선까지2401.47초이며 정리 시간은 별도다. 중단된 부분 표본은 합치지 않았다. 새3경로/18회 matrix 검증은 아직 수행하지 않았다.

계측의 strict 타입 오류는 Parameters/generic wrapper/검사된 protected 접근/type guard로 수정했다. trace의 A-B-A→drag 전환에서 관측을 버리던 drain을 보존하고, view/context/submission별 각 packet의0→1→2또는4→3을 검사한다. 최초 capture prefix/진행 중 tail과 같은 recording의 재표시를 구분하며 중간 stage 유실·잘못된 후속 replay·failure·identity 누락은 거절한다(회귀4개 통과). OS drag는 모서리 안쪽의 hit-test/실제 window owner를 검사하고 이동→down→최초 이동을 순서대로 입력한다. 실제 sizing loop/중간 surface 갱신 조건을 유지했다. fixture graph929 modules의 사전검사와 저렴한 V8 기능검사를 큰 AOT compile보다 먼저 수행한다.

환경은 Ryzen7 8845HS(8core/16thread), 실제 host 선택 Radeon780M(driver32.0.13031.3015), Windows build26300(Version10.0.26300), 균형 조정 전원, Node24.15.0이다. clang22.1.4/LLVM `35990504507d79e0b9deb809c8ee5e1b34ceef20`, x64 Release/MD, FP contraction off다. OS file cache·외부 부하는 통제하지 않았다. 기본 logical487×464.5/physical974×929, 최대화1280×729.5/2560×1459, scale2를 엔진·반복 사이에서 대조했다. OS wheel240개/4ms 요청 간격,24개마다 방향 반전10회다. Hermes는 같은 RN/Metro 변환·custom VM이고 V8은 ES2022 변환이다. displayed/scanout은 unobserved다.

아래 CPU cell은 **run별 n 최소–최대; p50 중앙값/p95 중앙값/관측 max**, 단위ms다. 초기 진입=list-cold, 먼 진입=list-entry-cold다. warm은27회 모두 mount/unmount0, text cache miss0/resident64였다. 재방문은 controller·geometry·실제 native frame을 사용하는 고정 workload다.

| 경로/창 | 초기 진입 | warm | 먼 진입 | 재방문 | resize | route |
|---|---|---|---|---|---|---|
| V8/기본 | 3–3; 12.99/96.75/97.84 | 177–186; 3.97/6.00/18.66 | 12–12; 9.41/96.72/103.98 | 24–24; 8.29/78.24/82.71 | 64–72; 2.31/44.25/53.94 | 160–162; 4.06/7.41/32.26 |
| custom bytecode/기본 | 3–3; 25.17/183.16/183.35 | 56–65; 17.64/25.17/32.16 | 12–12; 26.57/210.42/216.80 | 24–24; 28.69/206.70/227.21 | 27–27; 18.02/148.21/167.62 | 112–114; 7.69/13.82/45.49 |
| untyped AOT/기본 | 3–3; 20.62/176.05/177.94 | 74–77; 12.95/19.28/24.15 | 12–12; 22.78/207.22/214.58 | 24–24; 26.58/198.11/267.63 | 26–31; 20.83/127.58/155.95 | 121–126; 7.11/12.77/40.12 |
| typed AOT/기본 | 3–3; 20.63/177.52/207.01 | 78–82; 12.13/18.58/23.16 | 12–12; 25.93/217.15/218.50 | 24–24; 26.88/195.07/248.10 | 27–29; 16.09/130.72/150.91 | 124–125; 7.04/12.17/40.43 |
| 경계 대조/기본 | 3–3; 25.15/168.41/183.80 | 73–75; 12.85/19.55/26.01 | 12–12; 25.01/210.92/219.15 | 24–24; 26.35/194.81/232.81 | 26–28; 17.94/129.03/165.12 | 124–125; 7.20/13.21/40.41 |
| V8/최대화 | 3–3; 13.22/108.95/113.38 | 167–170; 4.95/8.30/13.35 | 12–12; 10.74/107.88/112.37 | 24–24; 10.57/90.91/97.13 | 69–70; 2.95/39.02/62.96 | 163–164; 4.00/7.49/26.27 |
| custom bytecode/최대화 | 3–3; 30.08/263.95/284.14 | 33–36; 29.71/39.54/54.15 | 12–12; 34.49/286.68/303.30 | 24–24; 31.97/259.64/290.10 | 25–26; 22.79/150.29/174.62 | 108–114; 7.83/16.09/45.46 |
| untyped AOT/최대화 | 3–3; 32.36/237.83/237.91 | 44–57; 20.25/28.00/53.85 | 12–12; 31.88/261.90/276.44 | 24–24; 32.68/264.07/350.03 | 26–30; 18.28/130.26/173.29 | 113–118; 7.28/14.31/70.75 |
| typed AOT/최대화 | 3–3; 28.04/227.15/229.17 | 51–53; 19.08/28.70/37.12 | 12–12; 33.66/268.64/289.20 | 24–24; 29.53/257.44/268.91 | 25–27; 18.77/136.13/163.06 | 117–124; 7.05/12.39/58.13 |

전달 지연 cell은 **n 최소–최대; run별 p95 중앙값/p99 중앙값/관측 max**, ms다. 입력은 warm 중 native에서 수신된 input sequence와 matching surface, resize는 같은 surface generation의 request/update를 대응했다. process peak는 run별 peak working set의 중앙값이며 JS heap/GPU 메모리와 구분한다.

| 경로/창 | 입력→surface | resize→surface | process peak MiB |
|---|---|---|---|
| V8/기본 | 172–175; 12.00/16.59/22.86 | 22–25; 77.48/86.66/88.44 | 508.54 |
| custom bytecode/기본 | 52–60; 30.98/40.85/40.87 | 9–10; 222.02/222.02/238.56 | 297.63 |
| untyped AOT/기본 | 69–76; 26.20/29.93/35.11 | 10–11; 182.50/182.50/218.21 | 312.49 |
| typed AOT/기본 | 74–78; 25.45/29.46/31.07 | 10–10; 190.70/190.70/191.49 | 309.27 |
| 경계 대조/기본 | 71–71; 26.09/31.44/32.52 | 8–10; 205.10/205.10/221.09 | 310.00 |
| V8/최대화 | 122–126; 16.71/18.90/21.28 | 24–25; 84.21/88.26/99.51 | 649.95 |
| custom bytecode/최대화 | 31–33; 52.20/57.56/59.47 | 8–10; 240.45/240.45/271.81 | 464.38 |
| untyped AOT/최대화 | 42–48; 37.71/46.69/63.08 | 10–10; 203.00/203.00/229.86 | 480.43 |
| typed AOT/최대화 | 47–52; 40.67/46.67/47.98 | 8–10; 207.81/207.81/234.92 | 473.21 |

Hermes의 warm VM 계측 중앙값은 다음과 같다. 할당은 해당 phase의 누적 할당 증가량이고 live/heap은 phase 전후 snapshot이다. V8 VM 내부 수치는 이 API에서 제공되지 않아 notVerified이며 위 process peak만 비교한다. 서로 다른 run의 중앙값 전후를 하나의 객체 수명 변화로 해석하지 않는다.

| 경로/창 | warm GC 횟수 | warm 할당 MiB | warm VM live MiB 전→후 | VM heap MiB 전→후 |
|---|---:|---:|---|---|
| custom bytecode/기본 | 39 | 146.93 | 26.67→30.83 | 32.00→40.00 |
| untyped AOT/기본 | 45 | 168.51 | 27.79→30.61 | 32.00→40.00 |
| typed AOT/기본 | 45 | 171.00 | 27.84→31.23 | 32.00→40.00 |
| 경계 대조/기본 | 44 | 166.68 | 27.81→33.11 | 32.00→40.00 |
| custom bytecode/최대화 | 36 | 136.03 | 42.70→45.52 | 44.00→52.00 |
| untyped AOT/최대화 | 44 | 166.91 | 40.82→47.05 | 48.00→52.00 |
| typed AOT/최대화 | 44 | 168.20 | 40.67→47.16 | 48.00→52.00 |

실제 typed 본선6회에서 process별 Cubic loop958–1166회, helper8748–10730회, lerp23176–24820회를 확인했다. 같은 constructor/module/receiver를 사용하며 세 body 모두 양수였다. 공통 IR의 native numeric lowering과 경계 차등 검증을 함께 통과한 선정 범위다. 이 호출 수는 warm 전용 수치가 아니며 전체 Core class/array 변환을 뜻하지 않는다.

빌드는 candidate마다1회다. Metro/체커와 native compiler/host를 분리했고 아래 frontend/native는 unit별 시간이다. AOT entry51/56bytes는 marker이며 실제 코드는 별도 DLL이다. VM·원본 JS/map·공통 자산을 포함한 전체 배포 크기와 혼동하지 않는다. 공개 typed package 크기는 앞 절의419,767,612bytes다.

| 경로 | Metro/체커 s | frontend/native s | host s | entry bytes | AOT DLL bytes |
|---|---:|---|---:|---:|---:|
| V8 | 3.95 | JS 복사 | 123.15 | 12,203,296 | 0 |
| custom bytecode | 4.47 | HBC 24.53 | 123.51 | 10,525,718 | 0 |
| untyped AOT | 4.55 | nelyx_app: 22.65/327.07 | 122.77 | 51 | 59,243,520 |
| typed AOT | 49.93 | nelyx_typed: 0.05/0.15; nelyx_app: 27.53/328.11 | 123.84 | 56 | 59,255,808 |
| 경계 대조 | 51.43 | nelyx_app: 23.21/326.86 | 122.88 | 51 | 59,018,240 |

**판정: 실험 유지 / 제품 PARTIAL.** 과거 측정의 warm p95는 typed 기본18.58ms/최대화28.70ms, bytecode25.17/39.54ms, V8 6.00/8.30ms다. typed는 V8의3.10/3.46배로 유지한1.10배 기준에 미달이다. 입력 p95는 V8의2.12/2.43배, resize p95는2.46/2.47배다. typed 재방문 max248.10/268.91ms는100ms 기준을 넘는다. warm p95도60/120/165Hz의16.67/8.33/6.06ms callback 예산을 충족하지 않는다. 이 예산은 물리 FPS가 아니다. 제외된 untyped AOT 대비 개선율은 현재 채택 기준으로 사용하지 않는다.

route p95는 typed12.17/12.39ms, bytecode13.82/16.09ms, V8 7.41/7.49ms였다. OS cache/외부 부하를 통제하지 않은3회 관측으로 미세 차이의 인과·보편성을 주장하지 않는다. typed process peak309.27/473.21MiB는 bytecode297.63/464.38MiB 대비 약3.91/1.90% 높았다. 이 과거 관측은 새18회 검증을 뜻하지 않는다. typed DLL59,255,808bytes와 bytecode HBC10,525,718bytes는 형식이 다른 산출물이며 전체 package 비용을 포함한 배포 예산은 아직 확정하지 않았다. 제외된 AOT unit 대비 크기 합격 판정은 더 이상 사용하지 않는다. 프레임 성능 수락은 미달이다.

### TA-11~12 정리와 남은 제품 범위

선정 numeric subset의 도구·같은 VM 연결·실제 제품 호출·native 입력/수명·실패 경계·공개 공급·비교·문서 정리를 마쳤다. 기본 엔진 선택은 그대로이며 typed CLI는 명시적인 실험 옵션이다. TA-07의 rendering/layout/build loop·class/array/closure/SCC 전환과 전체 프레임 성능 목표, TA-13의 standalone untyped AOT 제거·3경로 검증·공급 재정렬이 남아 있다. hot path 확장은 실제 비용 profile과 안전한 공통 lowering/interop 지원이 필요하며 현재 leaf 성공으로 완료 처리하지 않는다. 전체 계획 완료는 `wholePlanComplete=false`다.

원본TS→typed 입력/C 진단은 연결했지만 native PC/PDB→원본TS 주소 매핑은 notVerified다. 물리 IME 후보창·reader·precision trackpad·scanout 및 다른 OS의 typed native도 notVerified다. 입력 JS map이나 responsive 창을 이 증거로 대체하지 않는다.

후보 제외 전 구현·평가 실행의 임시 project/entry/config·C/obj/lib/exp·native 비교 출력은 finally에서 모두 삭제했고 소유 검증 프로세스도 남지 않았다. 현재 dist/archive/설치/public package와 재사용 toolchain을 유지한다. 기존 W14 소유 temp/entry와 과거 거부된 삭제는 보존했다. 검증 log/receipt/history JSON·별도 소비자 설치본을 누적하지 않았다. 현재 `run-windows-research.mjs matrix`에는 제외 후보가 남아 있어 새3경로 검증 명령으로 수락하지 않는다. TA-13에서 driver를 정리한 뒤18회 비교와 실패 경계를 검증하며 실행별20분 test timeout·실패 시 중단·finally 정리를 사용한다. 이번 후보 정책 반영에서는 문서만 수정했다.
