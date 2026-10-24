# W15A: Testbed 전체 앱 Static Hermes AOT·선택적 타입 최적화 작업계획

기준일: **2026-10-23 KST**

> **계획 COMPLETE · Windows G3 구현·기능·공급 수락 완료 · wholeAppNativeAot=true · typePolicyAccepted=true · performanceAccepted=false · wholePlanComplete=true**. 2026-10-22 재개 요청의 구현·검증·18회 비교·최종 판정을 완료했다. 전체 실행 코드를 Static Hermes native AOT로 공급하고 신뢰할 수 있는 타입만 선택적으로 최적화했다. 타입이 불명확한 코드는 같은 native image/VM에서 동적 JS 연산으로 처리한다. 성능 목표와 빌드 메모리 예산은 미달이므로 기본 V8을 유지한다. Windows 실험적 공급의 수락 범위와 과거 외부 임시 폴더1개의 정책상 보존 예외는 §11을 따른다. 이전 typed body100%·untyped native0 조건은 폐기했다.

[W15](work15.md)는 **CLOSED / SUPERSEDED BY W15A**인 선정 numeric subset 실험 자료로 보존한다. W15의 TA-07 미전환 범위, TA-13 standalone untyped AOT 제거, 남은 공급·진단·성능 판정을 이 문서로 이관한다. [W14](work14.md)의 전체 엔진·컴포넌트 개편은 계속 **PAUSED / PARTIAL**이며 이번 계획으로 재개하거나 완료 처리하지 않는다.

## 1. 목표와 “전체 앱”의 정확한 의미

목표는 `sample/nelyx-testbed-app-2`의 Windows x64 Release에서 **앱과 전이 실행 의존성 전체를 Static Hermes native AOT로 빌드·실행하고, 원본의 유효한 타입 정보를 활용할 수 있는 부분을 선택적으로 최적화**하는 것이다. native AOT 범위와 타입 특화 비율은 서로 다른 판정이다. 타입이 없거나 표현·호출 계약을 입증하지 못한 코드는 일반 JS 의미를 유지한 동적 연산으로 native 컴파일한다. 모든 함수를 강제로 typed로 만들거나 React/RN에 타입을 새로 붙이는 것은 목표가 아니다. 전체 타입을 지워 유효한 타입 최적화 기회까지 조용히 잃는 것도 최종 정책으로 수락하지 않는다. 현재 제공하는 Material/Cupertino·ListView·입력·route·렌더링 기능을 유지하며 W14의 미구현 컴포넌트는 새로 만들지 않는다.

완료 단계를 다음과 같이 구분한다. **최종 목표는 G3이며 G1/G2에서 멈추고 전체 앱 완료라고 부르지 않는다.**

| 단계 | 필수 범위 | 판정 |
|---|---|---|
| G0: 기존 실험 | 전체 Metro 앱 bundle의 untyped native root + `Cubic.transformInternal`, `_evaluateCubic`, `value-math.lerp`의 선정 typed body | 이미 두 종류의 native code를 같은 VM에 연결한다. 타입 최적화는 세 body만 선정했고 전체 graph/body 공급·분류·자동 정책 수락은 미완료다. |
| G1: 공통 frontend와 수직 통합 | 실제 Widget 생성→State/build→layout→paint 및 callback·dispose의 class/collection/helper 묶음 | 해당 경로 전체의 native 실행, typed 특화와 동적 native 연산의 혼합·의미 보존, 타입 선택 정책을 검증한다. |
| G2: 앱·Nelyx 전체 | runner `main.tsx`/`App.tsx`, 앱 `src`, 실행에 필요한 Core·Material·Cupertino·SDK·Skia RN의 body와 초기화 | `nelyx-native-closure-complete`. 외부 의존성도 dynamic-native이면 허용하되 외부 전체 수락은 G3에서 한다. |
| G3: 실행 의존성 전체 | G2 + 실제 Release bundle의 React·React Native·Metro runtime/module loader·polyfill·기타 외부 JS/Flow/CJS와 lazy 경로 | `full-runtime-native-complete`. 전체 live body/초기화의 native coverage 100%, 미분류·미지원·source/bytecode/JIT fallback 0, 선택적 타입 정책 수락. dynamic-native는 정상 실행 경로다. |

C++ RNW host, Hermes VM·GC·native builtin 구현, Skia/Dawn/GPU, OS 입력·접근성 provider는 이미 native인 런타임/플랫폼 경계다. 이 구현을 TypeScript로 다시 쓰지 않는다. 경계 호출부와 JS wrapper는 G3에 포함하고 ABI·호출·수명·오류 계약을 검증한다. Node.js 빌드 도구·compiler 자체·타입 전용 `.d.ts`·정적 이미지/폰트/shader bytes는 실행 body 분모에서 제외하되 분류와 공급을 확인한다. JS로 제공되는 polyfill을 VM builtin으로 잘못 분류해 제외하지 않는다.

공개 TS/ESM·`.d.ts`, 모듈·constructor·객체 identity, 사용자 subclass/override·callback 계약을 유지한다. 기본 실행 엔진은 V8으로 유지한다. 다른 OS의 Static Hermes AOT와 물리 기기 수락은 별도 범위다.

**AOT backend는 Static Hermes로 고정한다.** source/type provenance·선택 IR → typed/untyped 입력 → `shermes -emit-c`(typed 입력은 `-typed`) → C compile/link → SHUnit image/DLL → 같은 Hermes VM/GC가 목표 경로다. `-typed` unit 안의 untyped 함수와 별도 dynamic native unit 모두 가능하며 unit 수는 완료 조건이 아니다. 내부 untyped native bootstrap도 G3에 남을 수 있다. standalone `--hermes-mode aot` 제품 선택 제거와 내부 dynamic-native 지원 보존은 별개다. 다른 compiler/backend나 별도 VM으로의 대체는 범위가 아니다.

### 타입 최적화 정책

- 원본의 명시 타입을 우선 근거로 삼고 checker·호출 경계·관찰 가능한 JS 의미를 확인한 경우에 타입 기반 특화를 적용한다. 타입이 불명확한 값·`any`·외부 JS·Proxy·공개 override 경로는 동적 JS 표현/호출로 native 컴파일할 수 있다.
- annotation만으로 layout/identity가 보장되지는 않는다. 예를 들어 TS `number[]`가 있어도 JS array의 hole/out-of-range/alias를 Static Hermes typed array의 다른 의미로 바꾸지 않는다. 그런 부분은 dynamic-native로 유지하고 선택 이유를 기록한다. 불명확한 동적 값을 typed 연산으로 좁힐 때는 실제 의미와 일치하는 검증·guard가 필요하다.
- 이 정책은 타입 불명확 시 컴파일 자체를 포기하라는 뜻이 아니다. 상수 전파·일반 JS 최적화·compiler가 증명한 안전한 추론은 계속 허용한다. frontend가 근거 없이 타입을 발명하거나 사용자 annotation을 무조건 신뢰해 관찰 가능한 의미를 바꾸는 것을 금지한다.
- body/연산마다 `specialize`, `dynamic-js-with-reason`, `unsupported`를 자동 판정한다. 수동 세 함수 목록으로 끝내지 않으며 원본 타입 근거·선정/제외 이유·실제 typed IR/native 연산을 공개한다. 타입 특화율 100%는 요구하지 않는다. 미지원 문법/의미가 있는 경우에는 별도의 의미 보존 lowering 또는 compiler 지원이 필요하며, `dynamic` 표기만으로 compiler 오류를 우회했다고 판정하지 않는다.

## 2. 현재 기준선과 실제 부족

아래는 문서 작성 시 소스·설정 확인과 W15 기록을 구분한 기준이다. W15의 native/성능 결과를 이번에 다시 실행한 것으로 해석하지 않는다.

| 근거 | 확인한 사실과 W15A에 필요한 변경 |
|---|---|
| `static-aot/src/product-partition.mjs` | 앞의 세 body를 직접 선택한다. 원본 타입에 따른 전체 앱의 자동 특화/동적 native 선택 정책이 아니다. 수동 selection을 source/type 근거가 있는 자동 정책으로 확장해야 한다. |
| `static-aot/src/partition.mjs` | 1~32개 numeric body, scalar/control-flow IR이다. generic·nested function/class·async/generator·일반 collection/class lowering은 미지원이다. receiver·lexical binding·메서드 호출은 원래 동적 모듈에 남는다. |
| `static-aot/src/source-graph.mjs` | owner는 `@nelyx/*`와 앱, 구현 파일은 TS/TSX 중심이고 외부는 boundary로 보고한다. 현재 4096-module/closure 탐색 한도를 포함한 admission이 있다. 전체 third-party JS/Flow/CJS와 Metro runtime의 분석기가 필요하다. |
| `metro/src/native-typed-transformer.cjs` | 선정 함수/메서드 body만 Babel class lowering 전에 adapter로 치환한다. constructor·모듈 초기화·나머지 body는 기존 Metro가 소유한다. 파일 계획에도 32개 한도가 있다. |
| `cli/src/windows-static-aot.mjs`, `native/windows/StaticHermes.h` | typed `nelyx_typed`→전체 Metro bundle의 untyped native `nelyx_app`을 같은 VM에 연결하고 metadata를 검증한다. 이 구조를 재사용할 수 있으나 전체 graph/body native coverage·타입 선택 정책의 versioned 검증은 아직 없다. |
| `cli/src/windows-typed-hermes-policy.mjs` | pin `94aa5e1d40a4ce99df79d951cbe45310ec40680c`, `windows-hermes-94aa5e1d-typed-no-cfg-v1`. 기존 loop-phi/inline 제한과 필수 lowering을 새 지원표에서 다시 검증해야 한다. |
| W15 §9 기록 | 설치본 graph 926 modules와 Metro map 1404 modules는 **서로 다른 분석 범위의 당시 수치**다. 외부 모듈·Proxy·mixin·unresolved 경계가 남았다. 926을 전체 앱 분모로 쓰거나 두 수를 빼서 typed 누락 수로 단정하지 않는다. |
| W15 compiler/interop 기록 | 당시 TS probe의 generic/class/array 등 제한, Flow record/array의 JS 경계 호환 실패가 있다. 단순 TS→Flow 문법 치환이나 record/array reinterpret로 확대할 수 없다. 작성 당시 재검증은 미실시였으며 현재 native 결과는 §11에 기록한다. |
| `start-windows-static-aot.ps1` 및 앱 README | 현재 세 body의 기존 `static-aot` 준비·빌드·실행을 묶은 도구다. 스크립트의 존재나 모의 명령 검증은 전체 앱 변환·native 수락 증거가 아니다. |

작성 시 HEAD는 `00e68e6b9b6b5c90d3ab2da417b3dbcff133b24c`다. 앞선 요청의 README 두 파일 수정과 새 실행 PS1을 보존한다. native locator가 가리키는 입력 hash는 `cf218f5831ffa57be820cbada5f32d99c6612c3ee62f21a0c63e032039ca8efd`, toolchain locator hash는 `f6f3401285b3b12400e41c9dd61788f8ed7211e97864158d1b6eb3e5fae50831`이다. 이는 locator를 읽은 기준이며 해당 공급 전체의 hash/ABI 재검증은 WA-00에서 한다.

### 공식 문서와 compiler 선정 원칙

현재 pin의 [TypeScript stripping 문서](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/doc/typescript-stripping.md)는 타입 제거 옵션과 typed 모드의 병용을 금지한다. dynamic-native용으로 타입 구문을 제거하는 것은 허용하지만, 원본 타입 근거와 선택 이유는 별도로 보존한다. 타입 제거된 JS에 `-typed`만 붙여 타입 특화 성공으로 세지 않는다.

2026-10-22 확인한 [upstream Typed Language](https://github.com/facebook/hermes/blob/static_h/doc/TypedLanguage.md)는 개발 중인 언어를 설명하며 TS 일부 지원, JS와 다른 typed array/exact object/nominal class 의미, annotation 없는 함수의 untyped 취급을 다룬다. 이는 움직이는 branch의 참고 자료이며 현재 Microsoft pin의 지원 보증이 아니다. WA-02에서 선정 revision의 source/test와 실제 native probe로 지원표를 고정한다.

같은 pin의 [Compilation and Runtime Modes](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/doc/blog/2025-11-02-hermes-compilation-runtime-modes.md)는 typed/untyped JS 모두 native AOT로 컴파일하고 같은 VM에서 섞을 수 있음을 설명한다. **untyped 함수와 동적 JS 연산이 native 실행이라는 사실은 모순이 아니다.** compiler가 지원하지 않는 문법/타입 오류까지 자동으로 동적 처리한다는 보장은 아니다. W15의 두-unit 성공은 재사용 가능한 기반이며 전체 graph·공급·수명·선택 정책 수락은 별도로 한다.

## 3. 전체 그래프와 완료율 계산

분석 시작점은 실제 설치된 Windows runner `main.tsx`다. `App.tsx`와 앱 entry뿐 아니라 Metro가 주입하는 bootstrap·loader·polyfill 및 platform 조건부 export도 루트로 수집한다. build config·engine·platform·Release define·package resolution·native feature 유무를 graph identity에 포함한다.

1. 앱 TS/TSX, 공급된 Nelyx source↔dist map, 외부 package의 실제 JS/Flow/CJS body를 읽고 module·symbol·함수·constructor·accessor·closure·module initializer ID를 만든다. `.d.ts`는 타입 근거로 사용하되 구현 body를 대신 생성하지 않는다.
2. Metro의 최종 runtime module 목록과 양방향 대조한다. ESM/CJS interop, static/literal `require`·`import()`, lazy inline require, JSON/asset loader, builtin·native module·optional dependency를 구분한다. 외부라는 이유로 통째로 분석을 끝내지 않는다.
3. 동적 호출은 가능한 native target set 또는 같은 VM/호스트 계약을 확인한다. build-time 상수 조건이나 compiler의 의미 보존 dead-code 제거만 근거와 함께 분모에서 제외한다. 테스트에서 호출되지 않았다는 이유로 빼지 않는다. `eval`/`new Function` 등 필수 runtime 생성 코드가 source/bytecode 실행을 요구하면 사전 생성의 의미 동등성을 증명하거나 지원 과제로 남긴다. 동적 property lookup/callback과 runtime 소스 생성은 구분한다.
4. 함수/initializer별로 `typed-native`, `dynamic-native`(compiler 내부 untyped 포함), `bytecode/source`, `unsupported`, `native/builtin boundary`, `proven-dead`를 중복 없이 분류한다. typed wrapper가 dynamic-native body를 호출해도 둘 다 native coverage에 포함하되 실제 typed 특화 body/연산으로 이중 집계하지 않는다. helper와 generated initializer도 포함한다.
5. **G3 필수 수치**: live module 초기화와 live callable body의 **native coverage 각각 100% = typed-native + dynamic-native**, 미분류 0, unsupported 0, source/bytecode/JIT fallback 0. dynamic-native body 수/비율은 제한하지 않는다. native/builtin 경계와 proven-dead는 별도 공개한다. 타입 특화율과 실행 빈도 가중 지표는 최적화·성능 지표이며 native coverage와 분리한다.
6. 타입 정책은 원본 annotation/checker 근거, eligibility, 실제 typed IR·representation, dynamic-native 선택 이유를 연결한다. `any`/무주석 함수나 `-typed` unit의 수를 타입 특화율로 세지 않는다. 합법적인 동적 JS 연산은 typed/untyped native body 어디에 있어도 허용하고 위치·비용을 공개한다. unsupported body가 실제 native 컴파일되지 않았는데 dynamic-native로 표시하는 것은 거절한다.

coverage report는 현재 빌드의 source→IR→native unit→metadata와 연결한다. source/hash/graph/coverage를 바꾸면 검증이 실패해야 한다. 도구 내부의 bounded report는 메모리나 현재 패키지의 한 파일로 교체하며 실행별 기록을 누적하지 않는다.

## 4. 구성 방향과 소유권

제품 source/type graph와 외부 runtime graph를 합쳐 **공통 native 실행·타입 선택 IR**을 만든다. 원본 body·source map·타입 근거를 보존하고 SCC 단위 초기화·native unit owner 및 특화/동적 실행 결정을 연결한다. 모든 JS 의미를 새 typed compiler로 다시 구현할 필요는 없다. 검증된 Metro/Babel 변환은 dynamic-native 입력에 재사용하고 특화할 구간은 타입 제거 전에 확보해 Static Hermes typed 입력으로 전달한다. 두 입력 모두 같은 Static Hermes compiler/runtime 공급과 native image로 연결한다.

최종 unit 수는 ABI·빌드 비용에 맞춰 결정하며 **기존 typed+untyped native 두-unit 구조도 재사용할 수 있다.** 남은 문제는 두 unit이라는 사실이 아니라 수동 세 body 선택, 타입 정보 손실/선택 이유 누락, 전체 coverage·공급 검증 부족이다. bootstrap도 native coverage에 포함한다. module 평가·constructor·singleton의 owner를 하나로 유지하고 typed/untyped 간 객체를 복제하지 않는다.

| 소유 위치 | 구현 책임 |
|---|---|
| `Nelyx/sdk/tooling/static-aot/src` | 설치본 전체 그래프, native 실행·타입 선택 IR, 타입 근거·eligibility·특화/동적 선택, 필요한 공통 lowering, SCC·representation·coverage·원본 위치 진단. 모든 body의 강제 typed 변환기는 만들지 않는다. |
| `Nelyx/sdk/tooling/metro/src` | 타입 제거 전 원본/타입 확보, 최종 graph와 identity 대응, 기존 TSX/JSX·Flow·CJS·loader/asset 변환의 재사용, native 입력 누락·특화 구간의 타입 손실 검사. |
| `Nelyx/sdk/tooling/cli/src`, contracts·template | 범위 선택, compiler/runtime pin·공급, versioned metadata, strict full-runtime build/run/pack 검증과 사용자 오류. declaration/export/schema도 함께 갱신한다. |
| `Nelyx/sdk/native/windows`, owned Hermes patch | typed unit admission, 같은 VM/GC·JSI/Node-API 계약, GC roots·예외·재진입·microtask, 실패 시 수명·종료. compiler와 runtime ABI를 같은 공급으로 묶는다. |
| Core·Material·Cupertino·SDK·Skia RN source | 공개 의미와 구현의 원본. compiler 누락을 회피하는 샘플용 typed 복사본이나 수동 generated C는 만들지 않는다. |
| 공급 스크립트·package manifests | 외부 원본·타입 근거·정확한 버전·license, generated adapter의 원본 연결, source/dist/archive/install/native image 일치. |
| `Nelyx/eng/tests`와 Testbed | 언어 차등·실제 제품 묶음·same-VM 경계·native 기능/수명·coverage 실패·성능 회귀. |

typed 표현이 원본 의미와 맞지 않으면 먼저 같은 VM의 dynamic-native 표현으로 의미를 유지할 수 있는지 확인한다. 가능하면 정상 선택으로 기록하며 타입 특화 보류만으로 전체 AOT를 BLOCKED 처리하지 않는다. dynamic-native에서도 필요한 문법/의미를 native 컴파일하지 못할 때 공통 lowering 또는 bounded Static Hermes patch를 평가한다. 해결되지 않으면 호환 Static Hermes revision 하나를 고정해 compiler·VM·Node-API·heap/CRT·ICU·Skia/RNW ABI 전체를 재검증한다. 최신 compiler와 기존 VM을 임의로 섞지 않는다. 필수 native 실행 자체를 해결하지 못하면 WA-02를 BLOCKED/PARTIAL로 남기며 다른 backend·VM·객체 복제로 대체하지 않는다.

## 5. 보존할 언어·객체 의미와 필요한 변환

아래는 모든 기능의 정적 표현을 새로 구현하라는 목록이 아니다. 먼저 기존 JS→Static Hermes dynamic-native 경로의 의미 보존을 검증하고, 타입 특화가 가능한 구간에만 추가 표현/lowering을 적용한다. generic·interface 등 타입 전용 의미를 runtime specialization으로 무조건 확장하지 않는다.

| 영역 | 처리와 필수 회귀 |
|---|---|
| 타입·generic | scalar/nullable/union/narrowing, interface·구조적 할당, generic class/function/method, overload, readonly, recursive type와 callback variance. type erasure가 가능한 타입 정보와 runtime specialization 필요 정보를 분리한다. specialization은 identity와 code-size 한도를 지킨다. |
| 객체·class·mixin | constructor/static 초기화, 상속·`super`, private brand, getter/setter, prototype·동적 override, mixin factory와 generic SCC. Widget/Element/RenderObject의 생성/호출/폐기 전체와 `instanceof`·`===`를 검증한다. 최적화를 위해 공개 메서드를 임의로 final 처리하지 않는다. |
| collection·값 표현 | JS Array의 hole/out-of-range/length/alias, typed array와 buffer/view의 offset·공유·수명, Map/Set/WeakMap, plain object·descriptor·freeze·Proxy·Symbol·enumeration. 정적 배열/record 표현은 기존 관찰이 동등한 경우에만 선택한다. |
| 함수·제어 흐름 | closure capture·mutable cell·재진입·`this`/bind/call/apply, optional/default/rest/destructuring/spread, 모든 필요한 loop/switch/try/finally, exception identity·발생 순서. TSX/JSX는 타입 정보를 유지한 React 호출 IR로 연결한다. |
| 비동기·module | Promise·microtask·async/await·generator, iterator/iterator-close, ESM live binding·TDZ·cycle, CJS cache·부분 초기화·dynamic import, lazy module. TS/Flow import type만 제거하고 runtime 순서·단일 평가를 보존한다. |
| host와 동적 값 | JSI/Node-API/NativeModule·Skia handle·timer·frame callback·IME·accessibility·React/RN callback. ingress 검증·GC root·예외·취소·thread/owner·closing 계약을 유지한다. boxed checked representation과 신뢰된 내부 표현의 경계를 증명한다. |
| 수치·builtin | binary64, NaN/Infinity/음수0/subnormal·rounding·정수/bit 연산·문자/Unicode. builtin 교체가 관찰 가능한 기존 경로는 순서와 lookup을 유지한다. no-fast-math/FP contraction·optimizer pass 정책은 회귀와 함께 고정한다. |

전환은 원본 body→private helper→capture/type/실행 의존성→SCC 묶음 순서로 처리하고 자동 특화/동적 선택 정책을 적용한다. 수동 함수명 목록은 초기 fixture에만 남긴다. 제품 원본의 합법적인 입력을 compiler에 맞추려고 금지하거나 제품 source를 `as any`로 넓히지 않는다. 생성 입력의 동적 표현은 원본 타입·이유·source map을 보존하면 허용한다. public API 변경이 필요하면 별도 호환성 변경으로 명시하며 기존 앱의 동일 동작 수락을 먼저 해결한다.

## 6. 실행 작업과 단계별 종료 조건

**WA-00~17 COMPLETE**다. G1/G2/G3 구현·native coverage/정책·기능/수명·현재 공급·PC 진단·compiler 없는 실행을 수락했다. WA-16은 평가 완료·성능 미채택이며 WA-17은 현재 실행 출력 정리와 외부 과거 잔여의 보존 예외를 명시해 종료했다. 패키지 coverage, 기능 실행, 성능 결과의 분모와 수락 범위는 §9~11에서 구분한다. W14는 재개하지 않았다.

| ID | 작업 | 선행 | 완료 증거 |
|---|---|---|---|
| WA-00 | 현재 diff·설치·archive·native/compiler/runtime 기준과 소유 프로세스 확인 | 없음 | 앞선 README/PS1 등 사용자 변경 보존. 실제 입력 hash·ABI·정상 시작/close 기준을 재확인하고 W15 기록과 현재 결과를 구분한다. |
| WA-01 | 실제 bundle의 전체 실행 closure와 semantic inventory | WA-00 | runner/Nelyx/외부 JS·Flow/CJS/Metro 주입 모듈을 모두 대응. 미분류·동적 target·unresolved 목록에 원본 위치/owner를 붙이고 coverage 분모를 확정한다. |
| WA-02 | Static Hermes native 지원·타입 특화 eligibility gate | WA-01 | §5의 실제 native 의미 probe, typed/dynamic-native 선택 기준·호환성·ABI 지원표. 특화 불가 시 동적 native로 유지할 수 있는지 먼저 검증한다. 필수 native 실행을 해결하지 못할 때 G3 BLOCKED/PARTIAL. |
| WA-03 | 전체 native 실행·타입 선택 IR와 source map | WA-02 | constructor/accessor/initializer/closure·외부 body의 원본 hash·native owner·ESM/CJS ID·SCC, 타입 근거·특화/동적 이유와 deterministic 결과. 모든 body를 typed IR로 재작성할 필요는 없다. |
| WA-04 | 객체·class·collection의 동적 의미와 선택적 특화 | WA-03 | identity/override/alias/Proxy/field·array·GC/예외 차등. W15의 unsafe Flow reinterpret는 사용하지 않고 dynamic-native를 유지한다. 정적 표현은 동등성을 증명한 부분만 사용한다. |
| WA-05 | 기존 변환 재사용과 closure·비동기·module 의미 검증 | WA-03,04 | Metro/Babel 및 필요한 추가 lowering의 capture/this·async/microtask·try/finally·cycle/TDZ·CJS 초기화 차등. constructor/static/module 초기화 owner 중복 없음. |
| WA-06 | typed/dynamic native linking과 versioned loader | WA-04,05 | 기존 두-unit 포함 전체 unit 계획·한 VM/GC·한 module owner·root/init/실패 계약. 32 selection·고정 수동 목록을 자동 정책·실제 규모 한도로 바꾼다. unit 수 자체를 변경할 의무는 없다. |
| WA-07 | G1 비수치 수직 경로 | WA-06 | 실제 Widget/State→Element/RenderObject→layout/paint, list·입력 callback·dispose의 원본/helper가 typed 또는 dynamic native로 실행. stub·handwritten 복사·비native delegate 없이 차등·선택 정책 증거. |
| WA-08 | Core 전체 reachable closure의 native 분류·정책 적용 | G1 | foundation·collection·geometry/text/animation·gesture·rendering·widgets·semantics/hosting과 lazy/오류/종료의 native coverage 100%. 타입 특화율은 별도 보고하며 동적 유지 이유를 공개한다. |
| WA-09 | SDK·Skia RN·Material·Cupertino·앱 전체 전환 | WA-08 | application/surface·renderer·resource·input/semantics adapter 및 양쪽 디자인·ListView/route·runner 초기화. G2 coverage와 실제 native 기능/수명 회귀 통과. |
| WA-10 | 외부 JS/Flow/CJS와 Metro runtime 전체 native 수락 | G2, WA-01~06 | React/RN·scheduler·loader/polyfill 등 실제 전체 의존성 body/초기화를 typed 또는 dynamic native로 연결. 외부 JS에 타입을 억지로 부여하지 않으며 공급·라이선스·선택 이유를 고정한다. |
| WA-11 | native coverage·타입 정책·build/run/pack 계약 | WA-10 | native coverage 100%, 특화/동적 판정 누락0, source/bytecode/JIT fallback0. body 누락·특화할 타입 근거/IR 누락·비native delegate·coverage 변조 거절. dynamic-native와 무주석 자체는 허용한다. |
| WA-12 | 진단과 대규모 빌드 비용 | WA-06~11 | TS/JS→IR→native stack/PC map·최소 실제 native 오류 위치 검증. deterministic 단위 분할·동일 pin cache 무효화·메모리/공간 한도·취소/실패 정리. 빌드 시간이 길다는 이유로 runtime JIT로 회피하지 않음. |
| WA-13 | G3 실제 native 기능·수명·실패 수락 | WA-11,12 | §8 matrix, responsive 창·현재 DLL, same-VM identity·typed/dynamic native 호출·금지 fallback 계측, 협력적 close/drain/exit0. 예상 실패는 지정 오류/exit와 누수 없음으로 별도 수락. |
| WA-14 | source→dist→archive→설치→native package 공급 | WA-13 | 앱/8개 기존 owned package 및 추가 compiler 입력·외부 원본 전체의 설치 body/hash/export·license 일치. runtime이 compiler cache 없이 동일 strict package를 실행. |
| WA-15 | W15 TA-13과 CLI/template/PS1 사용 경로 정리 | WA-11~14 | standalone `--hermes-mode aot`·전용 script/schema/metadata/비교 후보 제거. typed 공통 compiler/VM/host admission은 보존. full-runtime 실행 선택을 PS1·한/영 README에 정확하게 연결. |
| WA-16 | 같은 공급의 성능·크기·메모리 평가 | WA-13~15 | §9의 선택적 타입 최적화를 적용한 Static Hermes full-runtime/Hermes bytecode/V8 비교. native coverage·타입 정책·성능을 분리하고 동적 native 비용과 미달 결과를 공개한다. |
| WA-17 | 최종 판정·문서·현재 출력 정리 | WA-00~16 | §10 수락표와 잔여/notVerified를 갱신. 임시 산출물·소유 process/profile 정리, 현재 dist/archive/install/package와 재사용 toolchain만 유지. |

기본 순서는 **WA-00→01→02→03→04/05→06→07(G1)→08→09(G2)→10→11/12→13→14→15→16→17**이다. 외부 의존성의 위험 의미 probe는 WA-02에서 먼저 수행하며 WA-10까지 미루지 않는다. 각 batch에서 공통 frontend/owner를 개선하고 필요한 body와 helper를 함께 전환한다. G1 이전에는 큰 Core 목록을 무작정 확장하지 않는다.

## 7. 사용자 명령과 metadata의 계약

명칭은 **Static Hermes AOT**, 도구 패키지/경로는 `@nelyx/static-aot` / `Nelyx/sdk/tooling/static-aot`, public 모드는 `--hermes-mode static-aot`로 통일한다. 구 `typed-aot`·standalone `aot` 모드, 구 패키지/export/PS1/metadata/plan은 호환 별칭 없이 제거한다. CLI·template·선언·공급·설치·native loader를 함께 바꾸며 이전 패키지는 재빌드한다. 타입 최적화 자체의 IR/flag/leaf에는 `typed` 용어를 유지한다.

`--engine hermes --hermes-mode static-aot`는 **전체 Metro bundle의 native root + 자동 선택한 body의 타입 최적화**다. 현재 자동 정책은 검증된 원본 scalar body 19개를 선택했다. G3의 graph/body 대응과 실제 기능·공급/수명 증거는 §11을 따른다. README/PS1은 strict 준비·빌드·검증·실행 경로를 안내하며, 성능 채택은 §9에서 별도로 판단한다.

제품 `static-aot`의 scope는 **full-runtime으로 고정**한다. 앞서 제안했던 `--aot-scope selected|nelyx|full-runtime` 옵션은 공급하지 않는다. body를 빠뜨린 선정 패키지로 성공 처리하지 않으며 전체 graph/body·타입 정책 검증이 실패하면 build/run/pack을 거절한다. 저수준 compiler probe는 native-probe scope로만 표시하고 제품 metadata에서 거절한다. 기본 V8 경로는 유지한다.

CLI/schema/template/선언 파일·Metro·native loader가 같은 scope와 graph/coverage/type-policy/unit-plan version을 검사해야 한다. compiler/runtime/policy/bridge identity, 원본 source/type 근거, body/initializer의 typed-native·dynamic-native·비native 분류와 native coverage, 특화/동적 선택 이유·실제 IR, 외부 원본/ABI·unit/image hash·map을 기록한다. `static-native-aot`라는 현재 mode 명칭은 그대로 사용할 수 있지만 기존 metadata를 새 수락 증거로 자동 승격하지 않는다.

완료 필드는 `wholeAppNativeAot`와 `typePolicyAccepted`로 나눈다. inventory는 `nelyx.static-aot-runtime-inventory/v2`로 올렸으며 `nativeCoverage`·`typeSpecializationCoverage`·위 두 필드를 사용한다. 이전 필드와 형식의 호환은 제공하지 않는다. native metadata는 `static-aot-app.json` / `nelyx.windows-static-aot-app/v5`, mode `static-native-aot`, unit plan v5와 execution plan v2로 함께 변경했다. typed·Metro root·지연 RNW JSI manager 세 unit을 한 image/VM으로 연결하고 VM 내부 JavaScript도 native로 고정한다. 두 runtime script의 원본 hash를 검증하며 구 v3/v4 제품은 재빌드한다. 이 계약 변경 자체가 G3 수락을 뜻하지는 않는다.

실행 PS1은 strict 준비→빌드→검증→앱 실행을 연결한다. full-runtime 실패 시 기존 leaf/bytecode/V8 패키지를 대신 실행하지 않는다. compiler cache는 빌드 전용이며 배포 앱은 compiler/toolchain 없이 실행돼야 한다. W15의 PS1 모의 검증은 새 명령 계약이나 실제 G3 실행 증거로 재사용하지 않는다.

## 8. 정확성·native 수락 matrix

| 범위 | 필수 확인 |
|---|---|
| 언어 차등 | §5의 반환값·mutation·identity·getter/Proxy 횟수·예외 순서·async/microtask·array hole/alias·module cycle을 원본 JS/bytecode와 같은 입력으로 대조. compiler 오류/지원 거절과 process fault를 구분. |
| 제품 native 실행·타입 특화 | build/layout/paint·scroll/gesture·text/editing·semantics·React/RN callback·초기화의 typed/dynamic native 경로 확인. 특화 주장에는 별도 typed IR/native hit가 필요하며 동적 native를 특화로 세지 않음. |
| 화면·상태 | Material↔Cupertino·theme/seed·폭/배율·ListView 1000항목·선택/scroll·route push/pop/result·dialog·animation. 원래 App/State·controller 보존과 새 route 상태 reset을 확인. |
| 편집·접근성 | Windows OS 입력/TSF/UIA·Unicode·selection/composition·caret/clipboard·secure privacy·Form Next/Done/검증/reset·페이지 왕복. 기존 VM/fixture 검사와 물리 IME/reader 검증을 구분. |
| GPU·자원·종료 | resize·hide/reopen·callback/worker 작업 중 close·실패. resource/fence/paragraph/handle retirement, views=0/consumers=0·input retirement·gpuDrained와 협력적 exit0 확인. 강제 kill을 정상 종료 증거로 쓰지 않음. |
| JS/native 경계 | timer/frame·Skia resource·NativeModule·JSI/Node-API callback/예외/GC·stale/cancel/thread/owner. 한 VM·constructor·singleton과 public override 동작 보존. |
| strict 거절 | graph/body·선택 판정 누락, 특화를 주장한 annotation/IR 근거 누락, 외부 lazy 누락, hidden 비native delegate·source/bytecode/JIT fallback, 잘못된 unit 순서·ABI/policy/hash·map·coverage, 초기화 재진입·root throw. 무주석·동적 native 자체는 거절하지 않음. |
| 설치·실행 | 현재 archive 설치본과 packaged exe/VM/native image/metadata/map 일치, 창 제목·`Responding=True`와 현재 DLL 경로, compiler cache 없이 실행·close. build 성공만으로 대체하지 않음. |

시험은 **20분 timeout**, 필요한 선정 표본과 회귀만 실행한다. 의미 없는 수백 회 재검증은 하지 않는다. 종료·실패·cancel에도 실행별 `finally`로 자신이 만든 temp·서버·profile·fixture·process를 정리한다. 물리 IME 후보창·reader·precision trackpad·scanout/FPS는 별도 증거가 없으면 `notVerified`다.

## 9. 성능과 채택 판정

**2026-10-23 최종18회 모두 PASS, 성능 채택은 FAIL이다.** 기본/최대화 × V8·동일 VM Hermes bytecode·선택적 특화 Static AOT ×3회를 엔진 순서를 회전해 실행했다. 기능·예상 실패 사전 검사와 별도 계측은18회에 포함하지 않았다. 개별 시험은20분 timeout이며 전체 준비·비교 합계는27분03초였다. 모든 builder 종료 후 측정했으며 OS file cache·외부 부하는 통제하지 않았다. 전원 구성: 전원 구성표 GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (균형 조정). 화면에 나타난 시점·scanout/FPS는 계측하지 않았다.

입력은 시작 전150ms pointer 안정화 후 실제 OS wheel240개를16ms 간격,24개마다 방향을 바꾸는10 half-sweep로 전송했다. 입력240/net0·실제 이동·선택 행/clip 화면 pixels·원위치60 복귀·warm mount/unmount0을 매번 요구했다. resize는 A-B-A와 실제 OS sizing loop의 복수 중간 surface epoch를 확인했다. 아래 CPU는 그림을 만든 owned callback의 wall time이며 FPS가 아니다. p50/p95는 run별 값의 중앙값, max는3회 중 최댓값이다. 단위는 ms다.

| 엔진 | 창 | cold list p95 | 먼 첫 진입 p95 | warm p50 | warm p95 | warm max | 재방문 max | route p95 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| V8 | 기본 | 106.48 | 109.37 | 1.82 | 5.16 | 24.13 | 108.85 | 8.34 |
| V8 | 최대화 | 115.47 | 111.88 | 1.76 | 6.04 | 12.56 | 102.71 | 6.93 |
| Hermes bytecode | 기본 | 168.58 | 205.91 | 6.45 | 14.29 | 33.10 | 208.09 | 16.09 |
| Hermes bytecode | 최대화 | 223.59 | 247.76 | 9.65 | 18.17 | 46.88 | 249.28 | 14.25 |
| Static AOT | 기본 | 146.41 | 187.07 | 3.58 | 11.05 | 44.82 | 206.23 | 11.23 |
| Static AOT | 최대화 | 190.05 | 214.21 | 8.11 | 14.36 | 32.61 | 265.73 | 12.14 |

| 엔진 | 창 | 최신 입력→surface p95 | resize 요청→surface p95 | process→surface 중앙/최대 | peak WS 중앙/최대(MiB) |
|---|---|---:|---:|---:|---:|
| V8 | 기본 | 15.51 | 76.59 | 1595.78 / 1615.81 | 514.13 / 516.18 |
| V8 | 최대화 | 16.04 | 81.40 | 1588.22 / 1608.77 | 589.07 / 677.87 |
| Hermes bytecode | 기본 | 26.75 | 181.64 | 1556.21 / 1570.92 | 291.93 / 292.93 |
| Hermes bytecode | 최대화 | 33.53 | 223.91 | 855.19 / 856.05 | 440.63 / 443.54 |
| Static AOT | 기본 | 23.49 | 171.11 | 831.00 / 838.80 | 306.79 / 307.66 |
| Static AOT | 최대화 | 30.06 | 177.66 | 827.54 / 842.27 | 454.91 / 456.54 |

입력 지연은 해당 warm 동안 수신돼 surface token에 연결된 최신 입력 표본이다. 모든 입력의 개별 지연이나 실제 표시 지연으로 해석하지 않는다. process 시작은 OS GetProcessTimes creation FILETIME을 기준으로 native entry offset을 얻고 이후 monotonic clock으로 측정했다. 첫 shown 시점에는 최소1 surface frame이 있었다. 기본/최대화 실제 크기는 각각 기본 487×464.5 logical / 974×929 physical / scale2, 최대화 1280×729.5 logical / 2560×1459 physical / scale2다.

사전 목표 warm p95≤V8의1.10배·재방문 max<100ms는 유지했다. AOT는 기본 2.142배, 최대화 2.378배이며 재방문 206.23 / 265.73ms로 모두 미달이다. AOT가 bytecode보다 빠른 결과를 V8 수준의 채택으로 바꾸지 않는다. V8 재방문에도100ms 초과 표본이 있었으며 아래에 그대로 공개한다.

| 고정 예산 | 최종 관찰 | 판정 |
|---|---:|---|
| package≤640MiB | 483.335MiB, manifest 제외 | PASS |
| AOT DLL≤96MiB | 54.489MiB | PASS |
| process→first surface≤15초 | AOT 최대 0.842초 | PASS |
| 전체 제품 빌드≤20분 | 743.073초, cached toolchain/증분 host | PASS |
| 빌드 peak WS≤8GiB | compiler OS lifetime peak9.397GiB; tree sample peak9.984GiB | **FAIL** |
| 앱 peak WS≤2GiB | 전체18회 중 AOT6회 최대 456.54MiB; 전체18회 최대 677.87MiB | PASS |

따라서 performanceAccepted=false이며 기본 엔진 V8을 유지한다. G3 native coverage와 타입 정책의 수락은 독립이다. 예산은 평가 전에 고정했고 미달 후 높이지 않았다.

현재 비교 identity: V8 source 3bd979ca07faab12323373754d4aa87abaedbec0c495372932541e067ee0bda0, bytecode source 676e37e57a8f98594e8d2c12fd11b60e0cee33ff70ef37b0ed129438a5553177, AOT source 41d2771481264500c4c96476365cd6d0ecbbd89381d76225438037846565e4f4, AOT DLL 0f7c88dba0bb3997b9d7ac578f1ee27b7b438b2f127cd5964f24d9fce318cb01. 같은 renderer/native 입력과 설치본을 사용했고 Hermes 두 경로는 같은 VM DLL4d7a589d56c1b8ec35d31603acf979280a69819517d8111552a6d028175b7c83 및 native-hermes-es2022 frontend다. V8은 native-v8-es2022다. 엔진 supplier의 상세 pin/qualification은 §11을 따른다.

각 run의 warm 분포와 재방문 max:

| 엔진 | 창 | 회차 | warm n | p50 | p95 | max | 재방문 max |
|---|---|---:|---:|---:|---:|---:|---:|
| V8 | 기본 | 1 | 745 | 1.62 | 5.32 | 24.13 | 108.85 |
| Hermes bytecode | 기본 | 1 | 521 | 7.47 | 15.98 | 28.11 | 208.09 |
| Static AOT | 기본 | 1 | 683 | 3.58 | 11.05 | 34.42 | 184.99 |
| Static AOT | 최대화 | 1 | 545 | 8.09 | 14.36 | 26.52 | 228.96 |
| Hermes bytecode | 최대화 | 1 | 487 | 9.65 | 18.35 | 40.38 | 245.88 |
| V8 | 최대화 | 1 | 794 | 1.80 | 5.52 | 11.93 | 102.71 |
| Hermes bytecode | 기본 | 2 | 592 | 6.45 | 13.88 | 33.10 | 192.45 |
| Static AOT | 기본 | 2 | 681 | 3.60 | 10.81 | 44.82 | 206.23 |
| V8 | 기본 | 2 | 777 | 1.82 | 5.16 | 16.63 | 78.81 |
| V8 | 최대화 | 2 | 780 | 1.76 | 6.18 | 12.32 | 98.18 |
| Static AOT | 최대화 | 2 | 533 | 8.15 | 14.93 | 28.06 | 265.73 |
| Hermes bytecode | 최대화 | 2 | 469 | 9.81 | 18.17 | 46.88 | 234.01 |
| Static AOT | 기본 | 3 | 677 | 3.41 | 11.26 | 31.49 | 203.91 |
| V8 | 기본 | 3 | 788 | 1.85 | 5.11 | 14.02 | 78.64 |
| Hermes bytecode | 기본 | 3 | 596 | 6.02 | 14.29 | 27.35 | 182.58 |
| Hermes bytecode | 최대화 | 3 | 484 | 9.63 | 18.12 | 40.18 | 249.28 |
| V8 | 최대화 | 3 | 796 | 1.75 | 6.04 | 12.56 | 93.48 |
| Static AOT | 최대화 | 3 | 542 | 8.11 | 14.03 | 32.61 | 217.50 |

Hermes VM counter는 모든6 phase의 delta를 각 창3회에 걸쳐 합산했다. gcTime/gcCPUTime 원본 seconds를 ms로 변환했다. allocated는 누적 allocation이며 live size가 아니다. V8은 이 VM counter를 제공하지 않아0으로 대체하지 않는다.

| 엔진 | 창 | GC 횟수 합 | GC wall/CPU 합(ms) | JS allocated 합(MiB) | 관찰 allocatedBytes/heapSize 최대(MiB) |
|---|---|---:|---:|---:|---:|
| Hermes bytecode | 기본 | 777 | 2105.22 / 2390.63 | 2884.95 | 53.58 / 60.00 |
| Hermes bytecode | 최대화 | 911 | 2816.84 / 2796.88 | 3401.74 | 66.24 / 76.00 |
| Static AOT | 기본 | 806 | 2201.54 / 2484.38 | 3005.07 | 53.62 / 60.00 |
| Static AOT | 최대화 | 928 | 2855.96 / 2656.25 | 3476.03 | 59.58 / 76.00 |

AOT6회는 매번 원본 특화19개의 counter를 확인했고3개 body가 실제 호출됐다. run별 총 호출은 36500, 34625, 36221, 35134, 36260, 36168회다. 전체 동적 body의 호출 분모는 계측하지 않았으므로 실행 빈도 가중 특화율을 만들지 않는다. warm 동안 새 row mount/unmount와 text cache miss는0이었으며 먼 진입/재방문은 별도 수명·text-cache 표본이다. 대부분의 Widget/class/collection 경로는 원래 표현의 dynamic-native이고 그 비용은 callback·build/layout/paint·GC/native 제출에 포함된다.

별도 phase/native worker 계측도 PASS다. 같은 비교 AOT image0f7c88dba0bb3997b9d7ac578f1ee27b7b438b2f127cd5964f24d9fce318cb01와 source/bootstrap(총5개 파일, 각 hash 확인)을 한 번 재사용하고 계측 host만131,994ms에 빌드했다. trace는 runtime NativeModule flag로 켰으며 source/bytecode 실행은 없었다. 기본창1회이며18회 채택 통계에서 제외한다. 함수 span은 inclusive이고 병렬 worker와 겹치므로 열을 더해 frame 시간으로 만들지 않는다. 단위는 ms다.

| phase | Frame CPU p95 | Root.build p95 | Widgets.flushBuild p95 | layout p95 | paint/compose p95 | Renderer.submit p95 |
|---|---:|---:|---:|---:|---:|---:|
| list-cold | 151.305 | 148.866 | 14.801 | 99.723 | 8.902 | 2.225 |
| list-warm | 11.970 | 8.733 | 0.009 | 0.505 | 2.233 | 1.431 |
| list-entry-cold | 184.551 | 183.074 | 4.580 | 145.432 | 8.436 | 1.486 |
| list-entry-revisit | 163.495 | 162.303 | 1.588 | 125.608 | 6.711 | 1.409 |
| list-resize | 108.844 | 107.285 | 12.081 | 49.591 | 11.472 | 1.345 |
| route-typed | 10.742 | 9.207 | 1.214 | 0.037 | 4.664 | 1.820 |

| phase | worker n | workerRender p95 | native import p95 | native submit p95 | UI publish p95 | producer wait p95 | workerRetire p95 | Graphite retirement p95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| list-cold | 3 | 3.076 | 1.652 | 0.028 | 0.242 | 0.928 | 1.027 | 0.083 |
| list-warm | 489 | 3.628 | 1.739 | 0.030 | 0.335 | 1.048 | 1.004 | 0.087 |
| list-entry-cold | 12 | 3.529 | 1.671 | 0.032 | 0.573 | 1.001 | 2.465 | 0.094 |
| list-entry-revisit | 24 | 3.439 | 1.574 | 0.034 | 0.336 | 0.985 | 1.123 | 0.074 |
| list-resize | 22 | 4.510 | 2.530 | 0.091 | 2.119 | 0.987 | 1.567 | 0.085 |
| route-typed | 129 | 2.733 | 1.082 | 0.028 | 0.322 | 1.219 | 1.040 | 0.091 |

이는 native raster/replay/제출/완료 경계의 CPU span·대기 관찰이며 GPU timestamp로 얻은 raster 실행 시간은 아니다. cacheFallback 호출은6 phase 모두0이다. Vulkan allocator에서 관찰한 신규 할당은 resize12건·약27.848MiB(단일 vkAllocateMemory p95 1.385ms), route43건·약3.264MiB(p95 0.502ms)였다. allocation 시 기록된 liveBytes 최대는약9.642MiB다. 다른 phase에 신규 할당 기록이 없다는 것을 live memory0으로 해석하지 않는다. 이 수치는 해당 allocator 범위이며 D3D·driver·물리 VRAM 전체 사용량은 미계측이다. 계측 process peak WS 326.441MiB, process→surface 2972.011ms였다.

재방문에서 layout p95가125.608ms였고 warm에서는 Root.build p95 8.733ms·paint2.233ms였다. 어떤 단일 dynamic 연산의 self time이라고 단정하지 않는다. 강한 class/prototype 계측은 teardown 오류로 미수락했고, 이어진 native span 출력의 thread interleaving은 결과를 한 string으로 구성해 출력하도록 보정했다. 위 표는 수정 후6 phase JSON·기능·audit·close/drain 검사를 모두 통과한 실행이다.

## 10. 최종 완료·중단·재개 조건

| 판정 | 완료 조건 | 현재 |
|---|---|---|
| `wholeAppNativeAot` | G3 initializer/body의 native coverage 각각100%(typed+dynamic native), 미분류/unsupported/source·bytecode·JIT fallback0, graph/artifact 검증 | **true / 현재 Windows Release full-runtime v5** |
| `typePolicyAccepted` | 원본 타입·eligibility·특화/동적 판정과 이유·실제 IR 연결. 수동 세 함수 선정에서 자동 정책으로 확장. 특화율100% 요구 없음. | **true / guarded-closed-scalar-v2 · 원본19개 특화** |
| native 기능·수명 | §8의 실제 Windows 기능·same-VM·자원/종료·예상 실패 수락 | **PASS / §11의 실제 fixture·배포 앱 범위, 물리 장치는 별도** |
| 공급·진단 | WA-12/14의 source→native/package·원본 오류 위치·compiler 없는 실행 확인 | **PASS / 현재8 archives·Release·ZIP·함수 PC map·compilerless** |
| `performanceAccepted` | §9의 사전 고정 예산·정확성·3경로 비교 충족 | **false / warm V8대비2.142·2.378배, 재방문206.23·265.73ms, 빌드 peak9.397GiB** |
| `wholePlanComplete` | WA-00~17의 구현·G3/기능/공급·평가·최종 판정·정리 완료. 성능 채택 실패라면 미채택 사유와 제품 상태를 명시하며 성공으로 바꾸지 않음. | **true / Windows 범위 완료·성능 미채택·§11 외부 정리 예외 보존** |

동적 native로도 해결되지 않는 필수 실행 의미, ABI 불일치, 객체 identity 분열, 종료 drain 실패, 숨은 비native fallback이면 해당 gate를 BLOCKED/PARTIAL로 기록한다. 단순 타입 특화 불가·무주석·일반 JS 표현은 전체 AOT 실패 사유가 아니다. 미지원 코드를 실행하지 않은 채 native/builtin이나 dynamic-native로 분류하거나 G2를 G3로 이름만 바꿔 완료하지 않는다.

추후 변경 시에는 §11과 `git status`/diff, 입력·설치·archive/toolchain hash를 비교해 기준의 유효성을 확인한다. frontend/compiler/runtime 입력이 달라지면 해당 native package·기능·비교 증거를 다시 검증하며 과거 hash를 무조건 복구하지 않는다. 최종 패키지·설치본·VM의 구체적 버전과 수락 범위는 §11을 따른다.

진행 상태와 잔여 작업은 이 문서에 갱신하고, 제품 사용 안내는 기존 한/영 README에 반영한다. 검증 log·immutable receipt·checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile은 누적하지 않는다. 현재 dist·현재 공급/설치/package와 재사용 toolchain만 유지하고 교체 staging/backup은 종료 시 정리한다. `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`를 만들거나 기록 경로로 사용하지 않는다.

## 11. 현재 구현·공급·검증 결과

**2026-10-23 KST · COMPLETE / G3 수락·성능 미채택.** W15는 CLOSED / SUPERSEDED, W14는 PAUSED / PARTIAL이다. 시작 HEAD 0a245ac39b8f7bdb7ee617dbae1bb8e654783f44의 기존 수정·미추적 작업을 보존했다. 이번 결과는 Windows x64 Release이며 다른 OS·물리 장치 수락으로 확장하지 않는다.

### 실행 의미와 G3

- 공통 ES2022 frontend는 JSX, for-in/of RHS의 TDZ, destructuring, block-scoping을 함께 처리한다. 일반 for-head의 TDZ sentinel 위치·초기화 closure와 반복 cell, 내부 shadow rename, 지연 instance field와 즉시 static field의 평가 시점을 보정했다. 실제 Core defaultStackFilter·ancestor mutation·environment와 SDK defineConfig·PageRoute.registerPolicy 및 원본/native 차등이 통과했다. 제품 body를 우회 복사하지 않았다.
- 자동 정책 guarded-closed-scalar-v2는 명시 annotation·checker·checked IR·입력 guard·원본 dynamic-native slow path를 요구한다. field/getter/lexical/callback·배열 표현을 annotation만으로 좁히지 않는다. 잘못된 입력 타입·valueOf·NaN·음수0·Infinity·public subclass dispatch의 native 차등을 통과했다.
- 타입 정책의 annotation/checker 후보 분모는 806 source modules의 31,391 callables이며 19 specialize / 31,372 dynamic이다. dynamic-callable-shape22,173·explicit-scalar-contract-required8,855·그 밖의 scalar IR/동적 관찰 유지344다. 이 분모는 전체 runtime 원본 callable 분모와 다르다. typed IR의 unsupported 이유는 해당 특화를 보류한 이유이며 native 실행 unsupported를 뜻하지 않는다. 외부·생성 body를 포함한 전체 native 분류는 아래 실행 plan을 따른다.
- 현재 제품은 1,369 native initializers(coverage100%), 원본 callable 40,624 native(19 typed + 40,605 dynamic) / 98 proven-dead, emitted callable 47,149 native / 14 proven-dead다. 미분류·unresolved·runtime code generation은 0이다. typed wrapper/helper 수를 원본 특화 body 수로 세지 않는다. compiler native 함수는 42,775개(typed unit60 + Metro root42,711 + RNW manager4)다.
- full-runtime v5의 unit 순서는 nelyx_typed → nelyx_app → nelyx_rnw_pal이다. execution plan v2가 원본/생성 span·source map·SCC·SH C 함수·검증된 제거 근거를 연결한다. optional worklets는 실제 null dependency slot과 native loader throw로 분류했다. pre-link seal·descriptor·loader가 축소/변조된 ledger, 잘못된 scope·ABI·정책·순서·hash, hidden 비native delegate를 거절한다.
- VM 내부 JavaScript도 native 308개 함수다. RNW0.83.2의 324-byte JSI manager는 정확한 원본 source+URL의 첫 요청에서 같은 image/VM의 native unit으로 한 번 초기화한다. direct/prepared·Symbol owner·잘못된 source/URL·누락 export의 실제 VM 검사가 통과했다. source preparation/execution·bytecode execution·blocked fallback은 0이며 eval/JIT는 비활성이다.
- PC map은 DLL hash·PE/PDB GUID/age·code RVA에 묶인 함수 범위다. 실제 native 오류 PC→원본 함수 검사를 통과했다. folded alias 후보를 공개하며 statement 단위 정확도는 주장하지 않는다.

### 현재 공급과 배포물

native input hash cf218f5831ffa57be820cbada5f32d99c6612c3ee62f21a0c63e032039ca8efd: 1,795 files / 224,976,281 bytes / RNW0.83.2 / JSI21 / x64 Release / MD다. Static Hermes pin은 94aa5e1d40a4ce99df79d951cbe45310ec40680c, HEAP_HV_64·unit CRT=MD·JSI21이며 no-SimplifyCFG/no-inline·no-fast-math/fp-contract off와 검증된 class-initializer source-range patch를 고정했다. toolchain manifest의 runtimeCrt=vendor-hybrid·qualification=experimental 표기는 유지한다. 이번 Windows 앱/경계 검증을 vendor runtime 전체의 보편적 qualification으로 바꾸지 않는다.

비교 V8 supplier는 version24.1.10 / revision c1877966a8285b7cbacbdd03e26ca003496436bc, locator/manifest hash42c3c2e3d3d820099e196f0b4164c17adb59fe555f1fb359ded4cd1631fe3551, v8jsi.dll106b7a596430f3de3d51c02534b31ad2c85c7df205fbdd803459ec7f26e9f250이다. 해당 manifest는 RNW JS0.83.2/nativeReactNative0.83.4·JSI21·MD와 qualification=notVerified를 명시한다. 이를 수정하지 않으며 이번 앱 비교/기능 표본을 V8 공급 전체의 qualification으로 확대하지 않는다.

| 현재 파일/입력 | SHA-256 |
|---|---|
| reusable toolchain manifest | 93621ec5dd5d3fa1b805ca07e57fb256d809782156fa67e37ecfdce4ad615e41 |
| VM DLL | 4d7a589d56c1b8ec35d31603acf979280a69819517d8111552a6d028175b7c83 |
| VM internal JS / generated C | c917a77eb7d770ed5e8ba7da12ef6303d105d8975e29fcb5692db49c5c389fd0 / 28839b65f3db8bf194ca5ec2f0382e1549a06e34c12107d53fd67389959992f0 |
| RNW manager / original JsiApi.cpp | 33b3511fb792121ec490c30de532e436312262808697317764e513ae6ecff3d3 / bb13f3f6dcf468d2738217e23e28ba647d3536877866f7780890f1ef41bb1081 |
| Release/NelyxRNHost.exe | 5f08de99b0703222e3545e9fcae58ba802532f3c303aaa1907048453ba190124 |
| Release/NelyxApp.aot.dll | 3cbb770d8be017a04ee952ad84362d347747da9af9ae9aaf4a67bec8d6b8aad2 |
| Release package manifest | 97a0eba87b86309bfac847c2bde71e604599e88b1f961fc65a719088f8834f46 |
| NelyxTestbed2-Release-static-aot.zip | 526033212201131d1c0c690b19d8b08d1f030eb5fa7056e55e1d098a106b97b7 |

배포 경로는 sample/nelyx-testbed-app-2/.nelyx/windows/packages/Release와 같은 부모의 현재 ZIP이다. package는 manifest records 1,749 files / 506,813,160 bytes(별도 manifest 제외), AOT DLL 57,136,128 bytes, ZIP 136,132,850 bytes다. ZIP의 1,750개 파일 전부를 압축 해제 없이 길이·SHA로 현재 package와 대조했다. pack은 package 전체 복제 없이 현재 검증 디렉터리를 압축하며 실제 compressor spawn 실패에도 staging/잘못된 ZIP을 남기지 않았다.

8개 현재 archive의 source→dist→archive→설치 파일 7,038개 / 169,571,875 bytes를 bytewise 대조했다. SDK에는 pinned Hermes LICENSE(6ba2fab96121dba8364707e8eb3826ef3134682e2f73ec6ef86fdbc9f7454d61)와 RNW MIT 원본을 포함했다.

| archive | SHA-256 |
|---|---|
| core | e114c3b7dc485378c25ba48b18a6423e264bdffcbbf1fb706067cb1135d38a55 |
| sdk | b0b64b19b57083d27222e6d4f868947bf8f61bef142cb78e73d6956e0f7c61ac |
| skia-rn | 5f0c1b0cc5e84b7251b0ea4fcc52d5b4e533f9d984786f0e265daa21f2441287 |
| material | f5591290bee8f18972cbabb94044ab986f0a1daeede7fff548f7a521d512e1df |
| cupertino | 8728ec77822c43c3cf745ca3ba8d6999ad9ce6746283314ddb21cc1df96eac22 |
| metro | d577a4c7be4b0e67a818c2f4f2706738443e3876217715901ccec916b405bd21 |
| cli | 9334458426f498ef9221533cf5c5db7ac282eb83e52969ae0f7b69963e3da7d1 |
| static-aot | bf5600edf7d174162a7af71c329c451b5b56fc8f9f9c314e7d3ae28d77c4a979 |

### 실제 검증

- source AOT suite 38개 중36 PASS·opt-in2는 별도로 각각 PASS다. 마지막 frontend/constructor/provenance/native-language 선정 13개와 package lifecycle13개, CLI/Metro/static-aot 선언 검사, 설치본 runtime graph 대응이 통과했다. Node/CanvasKit gallery23 PASS·profile skip1은 비native 증거로만 취급한다.
- 현재 packaged app은 NelyxTestbed2 제목·Visible/Responding=True와 세 DLL의 정확한 package 경로를 확인했다. peak WS258,285,568 bytes, 협력적 close exit0·forced=false·error=null이다.
- toolchain cache 전체를 검증된 workspace 내부 sibling으로 일시 이동한 실제 실행도 PASS다. cache 부재 상태의 responsive 창·현재 DLL·peak WS251,412,480 bytes·협력적 exit0을 확인하고 finally로 cache를 원래 manifest hash 그대로 복구했다. compilerless 임시 sibling은 남지 않았다.
- 현재 배포 앱의 추가 OS pointer/UIA/OCR 검사도 PASS(33,050ms)다. seed/theme·Material/Cupertino dialog, Material Form의 UIA 편집·실제 Enter의 Next/Done·저장·reset, route0→increment1→result1·재진입0·reset0·result0·디자인 왕복 보존을 확인했다. UIA 편집은 focus/value acknowledgment 뒤 진행하고 일반 Text 상태 문구는 실제 화면의 Windows OCR로 확인했다. 결과는 cooperative exit0·forced=false다. 이 검사는 현재 제공 기능만 대상으로 하며 planned Cupertino Form을 새로 구현하거나 수락하지 않았다.
- 최종 frontend의 TSF/UIA native fixture PASS(544,230ms): 957 native initializers, 원본23,035 native(15 typed / 23,020 dynamic)·98dead, emitted27,628native/14dead, 미분류·unresolved·codegen0이다. GPU caret pixels·TSF 좌표/range/hit·UIA Text/Text2/Value와 live event/selection/replacement/privacy·readonly/password·OS Ctrl+A/a/b/Backspace/c·WM_CHAR/Unicode VK_PACKET·stale focus 거절을 확인했다. resize/document 유지, 최대 geometry3/frame, 3-unit ACK, native scalar 실제 hit, fallback0·internal/PAL native, close active→closing·views0/consumers0/gpuDrained1/inputRetired1·exit0이다.
- 현재 Material29/Cupertino20개 갤러리 섹션(준비 중 placeholder 포함)·OS 편집/resize·6회 수명 회귀와 research OS wheel/route는 최종 AOT/bytecode 비교 fixture의 별도 사전 검사도 PASS다. V8의 research 사전 검사와 세 경로의 presentation/bundle 실패exit2·startup cancel exit0도 확인했다. 예상 실패의 native owners는 process exit까지 보존하며 정상 drain으로 분류하지 않는다. 기능 사전 검사는18회 성능 표본에 포함하지 않는다.
- 중간 frontend의 loop/shadow/deferred-field 오류와 초기 wheel cursor 전달 race는 실제 native/동일 VM bytecode 실행에서 검출해 공통 변환·fixture handshake를 수정했다. 실패·취소·옛 package/ZIP은 최종 증거에서 제외했다. wheel은 cursor 소유를 실제 240개 입력 도착·렌더 완료까지 유지하고 입력240/net0/실제 이동/원위치 복귀를 요구한다. 검사 기준을 느슨하게 바꾸지 않았다.
- 이전4ms wheel matrix는 V8 기본창1회 뒤 bytecode에서238/240 입력으로 실패했으며 그1회도 최종 통계에서 제외했다. 시작 전150ms pointer 안정화·전송 중 cursor/foreground 확인·16ms 간격으로 세 경로를 동일하게 고정했다. 이 조건의 최종18회는 모두 PASS다. 별도 깊은 prototype 계측은 teardown 오류로 실패했고 정상 결과에 섞지 않았다. 최종 세부 비용은 class별 강한 prototype 변경을 제외한 phase/native worker 계측으로 수락했다. 출력 thread interleaving을 수정한 계측 host와 현재 비교 compiler image의 조합도6 phase·기능·audit·정상 close를 통과했고 재사용 입력은 finally로 제거했다.

최종 제품 전체 빌드는 743,073ms(12분23초), native image compiler567,912ms다. cached toolchain/일부 증분 host 조건이며 clean-machine 시간은 아니다. compiler OS PeakWorkingSet64는 10,089,484,288 bytes, 소유 빌드 tree의 250ms sample peak는 10,720,260,096 bytes였다(프로세스 발견1초·공유 page 중복 포함). tree 관찰이 빌드 약38초 뒤 시작했지만 compiler OS lifetime peak 자체가 사전8GiB를 넘으므로 예산 실패는 확정이다. 다른 fixture 준비와 병행한 조건을 명시하며 기계 전체/순간 최대 메모리라고 주장하지 않는다.

최종18회는 모두 정상 종료·기능/입력/수명/audit 검사를 통과했다. 별도 phase/native 계측도 같은 compiler image에서 PASS이며 비교 표본에 섞지 않았다. 현재 실행이 만든 fixture entry·native project·compiler/pack staging·재사용 image/입력·process를 정리했고 현재 Release·ZIP·8개 archive·설치/dist와 reusable toolchain만 유지했다. 최종 syntax와 git diff --check도 PASS다. 물리 IME 후보창·screen reader·precision trackpad·GPU timestamp/물리 VRAM·scanout/FPS는 notVerified다. OCR은 보이는 결과의 확인이며 표시 시점/FPS 계측이 아니다.

이전 2026-10-21 외부 임시 fixture C:\Users\parti\AppData\Local\Temp\nelyx-windows-animation-lZr0JK의 삭제는 자동 승인 검토가 blocked by policy로 거절했다(상세 사유 미제공). 우회하지 않고 보존했다. 이번 실행 소유 임시 입력·native project·compiler/pack staging은 각각 finally에서 정리한다. 이 외부 잔여 예외를 현재 실행 정리와 구분한다.

## 12. 별도 Windows JSC 백엔드 추가 (2026-10-23)

사용자 요청의 JSC 백엔드와 JIT/인터프리터 선택 구현은 **COMPLETE / Windows x64 Release 첫 콘텐츠·응답 창·정상 종료 PASS**다. 이 확장은 완료된 Static Hermes G3/성능 판정을 변경하지 않는다. JSC cohort `rn-0.83.10-jsc`, profile `rn-jsc-graphite-vulkan`, WebKit26.4/Playwright2272, RNW0.83.2/native RN0.83.4/JSI21/x64/MD를 고정했다. V8 기본 사용을 유지한다.

- CLI prepare/build·SDK 등록·Metro source transformer·패키지/runtime 검증·현재 runner와 생성 템플릿에 JSC를 연결했다. `--engine jsc --jsc-mode jit|interpreter`를 선택한다(JSC 기본 jit). `jsc-mode.txt`와 owning VM identity가 모드를 전달/검증하며 다른 엔진 플래그와 bytecode payload를 거절한다. 기존 PS1의 기본 Static Hermes 동작을 유지하고 `-Engine jsc -JscMode jit|interpreter`를 추가했다. npm `start:windows:jsc` / `start:windows:jsc:interpreter`도 제공한다.
- interpreter는 VM 생성 전에 JS/RegExp JIT·Wasm을 끄고 pinned `VM::canUseAssembler`가 false인지 검사한다. jit는 true를 요구한다. RN JSC adapter의 JSI host microtask와 intrinsic Promise job을 같은 native queue에 연결했다. 실제 JSC DLL에서 두 모드의 native admission PASS: codegen 상태, Promise chaining·host/Promise FIFO·nested job·빈 checkpoint, class/private field/getter/BigInt/typed array의 JS 의미, rooted closure, 예외 후 복구.
- 실제 실행에서 native close가 admission을 먼저 닫고 JS owner drain 전에 늦은 layout/visibility 이벤트를 보내는 순서를 검출했다. 공통 Windows surface가 closing 상태에서는 새 active admission을 열지 않고 visibility를 중단하도록 고쳤다. 실제 native failure는 계속 보고한다. 이 회귀를 source test와 두 모드 실제 종료로 확인했다.
- JSC·Babel·패키지 수명 회귀28 PASS, Windows surface7 PASS, 기존 V8/Static Hermes mode 계약 PASS(별도 AOT 패키지 opt-in1 SKIP). 전체 workspace·CLI/Metro 선언 타입, package boundary, PowerShell parse와 diff 검사를 통과했다. JSC opt-in native 통합1 PASS(111,296ms): 각 모드에서 debug 실행의 first-content-ready·REACT_ERROR/fault0·closed views0/consumers0/gpuDrained1/inputRetired1·InstanceDestroyed·exit0과, 별도 일반 실행의 `NelyxTestbed2`/Responding=true·JavaScriptCore.dll 로드·cooperative close/forced=false/exit0을 확인했다. `NELYX_TEST_JSC_APP=1 npm run test:windows-jsc`로 재검증한다.
- SDK/CLI/Metro의 주요9개 source↔설치 hash를 일치시켰고 archive→설치 receipt, current supplier inventory와 패키지 전체 hash/portable Metro map도 검증했다. 현재 Release는 interpreter, exe SHA256 `5ebc2981c9404ab8a898e180ee318b0918953cd2ee3991f78970cdd89d4de9a1`, JSC supplier manifest SHA256 `e238af9d57618b5d7b731e5274eebd7c031d0560cb6fbff192c47f858732a190`다. 모드 변경은 새 process에서 한다. JSC LGPL notice `COPYING.LIB`가 native .lib 제외 규칙에 걸리지 않도록 licenses 경로를 보존했다.
- reusable supplier1개와 현재 패키지만 사용하고 supplier build/source/archive/probe·native test 임시는 finally에서 정리했다. **예외:** 이번 탐색용 `Nelyx/.cache/native/windows-jsc-download` 폴더 삭제는 자동 승인 검토가 `blocked by policy`로 거절했고 상세 사유는 제공하지 않았다. 우회하지 않아 이 폴더는 남아 있다. 이전 §11 외부 임시 폴더 예외와 별개다.

JSC의 전체 입력/접근성·실기기·FPS·성능 비교·clean-machine 배포는 notVerified다. RN JSC의 BigInt C++ JSI 값 변환 등 upstream 미구현 API를 전체 구현했다고 주장하지 않는다. Hermes inspector/Metro 개발 세션은 JSC 모드에 포함하지 않는다. 사용 안내는 앱 README와 CLI README를 따른다.

## 13. 접근성 전체 비활성화 옵션 (2026-10-23)

사용자 요청의 비용 비교용 `widgetApplication({accessibilityEnabled: false, ...})`를 추가했다. 기본값은 `true`이며 Testbed `src/app.ts`에 값을 명시했다. 이 시작 옵션은 앱을 재시작해 변경한다. 완료된 W15A G3/JSC 수락과 W14의 PAUSED 범위를 변경하지 않는다.

- 비활성 View는 semantics owner/transport snapshot을 생성하지 않고 프레임의 semantics 단계·트리/geometry 갱신·직렬화/host 전송·action 처리를 건너뛴다. 접근성 전용 무효화는 프레임을 요청하지 않으며 명시적 semantics handle도 다시 켤 수 없다. annotation 문자열은 configuration 요청 시에만 준비한다. Semantics widget 선언 자체는 widget tree에 남는다.
- SDK 기본 Web/RN 포트는 접근성 OS 설정 조회/관찰과 announcement handler 설치를 생략한다. Windows semantics proxy component를 mount하지 않으며 다른 플랫폼의 편집 carrier는 별도로 유지한다. custom platformMessages를 제공하면 해당 포트의 관찰 정책은 호출자 소유다.
- 최종 Core/SDK ESM·선언·source map 빌드, 전체 workspace 타입 검사, `npm run test:accessibility` **58/58 PASS**(새 옵션 11개 포함), diff 검사를 통과했다. 새 옵션 검증은 semantics 경로 진입 시 실패하는 guard, 접근성 전용 frame request 0, 다중 View 격리, OS 조회 생략, 포인터/Enter와 실제 Core/CanvasKit 편집 경로의 한글 composing snapshot·IME geometry 유지를 포함한다. 플랫폼 OS producer는 mock 경계 검증이며 물리 IME 검증이 아니다.
- 추가 입력/Windows semantics 회귀 **72/72 PASS**. 이 중 Chrome 3경우는 기존 supplied Web bundle의 회귀이며 새 옵션의 browser/runtime 수락 증거로 세지 않는다. 새 옵션의 native Release/실기기/reader 동작과 FPS·CPU 성능 비교는 **notVerified**다. 기존 설치 runner·archive·Release에는 이번 변경을 재공급하지 않았다. 최초 Windows 비교 전 sample의 `start-windows-static-aot.ps1 -RefreshSdk -Engine v8`로 현재 SDK를 공급·재설치·빌드하고 두 비교에 같은 엔진/모드를 사용한다. 제품 안내는 Core/Testbed README에 반영했다.

## 14. RefreshSdk 캐시 복구와 접근성 실행 스위치 (2026-10-23)

`start-windows-static-aot.ps1 -RefreshSdk`의 실패를 재현했다. SDK 빌드·공급·설치는 성공했으나 `static-hermes-inputs.json`이 삭제된 `Nelyx/.cache/native/windows-static-hermes`를 참조해 `Prepare hermes supplier`에서 ENOENT로 종료됐다.

- CLI prepare는 유효한 locator의 공급자 디렉터리만 삭제된 경우 앱 내부 `.nelyx/windows/static-hermes-build`에 같은 pinned compiler/runtime을 재준비하고, 성공 후 locator를 교체한다. 기존 공급자의 무결성 오류·잘못된 locator·명시적 EngineInputs는 계속 엄격하게 검증한다. build 자체는 자동 복구하지 않는다.
- PS1에 `-DisableAccessibility`를 추가했다. 빌드 중 `NELYX_ACCESSIBILITY_ENABLED=false` → runner `app-config.json` → Windows App → 공통 main/defineApplication → 기존 `widgetApplication.accessibilityEnabled`로 연결한다. 코드 파일을 수정하지 않으며 finally에서 호출자 환경을 복원한다. 옵션 전달을 지원하지 않는 설치 CLI는 앱 실행 전에 거절한다. 옵션을 뺀 다음 빌드는 override를 제거한다.
- 원래 명령의 실제 Static Hermes Release 빌드·패키지 검증·응답 창·자체 VM DLL 로드·UIA 콘텐츠·협력적 종료와 전체 스크립트 exit0을 확인했다. 재준비한 toolchain locator SHA는 `aaa154e0612813270addf73c6d5fb3aa7440f300666063f27751baab9ee44b6f`다. 이어지는 비활성 빌드는 같은 toolchain을 재사용했다.
- 회귀: Windows launch/locator 4 PASS, Static Hermes 4 PASS·opt-in1 SKIP, Gallery 24 PASS·profile1 SKIP(공통 entry 옵션 전달 포함), workspace/Windows runner/CLI 선언 타입과 syntax/diff 검사가 통과했다. source CLI와 재설치 CLI의 주요 변경 파일 SHA를 대조했다. 설명은 Testbed 영문/한국어 README에 반영했다.
- 최종 `-RefreshSdk -DisableAccessibility`도 실제 AOT Release 빌드·패키지·응답 창·자체 VM/native image 로드·협력적 종료와 전체 스크립트 **exit0 PASS**다. 일반 실행의 UIA descendant 15/Cupertino 노출과 달리 비활성 실행은 descendant2/Cupertino 접근성 콘텐츠 없음이며, 실제 화면 OCR은 Components·Cupertino·버튼 콘텐츠를 확인했다. OCR은 그려진 결과의 확인이며 FPS 측정이 아니다. 최종 Release는 접근성 비활성이며 exe SHA `3138524c517cf980edc0b27c8ee80dc4e74ebffedcce4057b66dbd36f7f71432`다. 성능 비교와 물리 IME/reader 수락은 notVerified다. 실행 소유 앱과 임시 검증 디렉터리·package/compiler staging을 정리하고 현재 dist/8개 공급 archive·설치본/Release와 재사용 toolchain1개를 유지했다.

## 15. Static AOT 반복 빌드 비용 개선 (2026-10-23)

사용자 요청의 빌드 속도 개선이다. 완료된 G3 범위와 runtime 성능 미채택 판정, W14의 PAUSED 범위를 변경하지 않는다.

- Metro의 무작위 임시 plan 경로를 결정적인 plan 내용으로 교체했다. native worker가 변환 코드와 frontend elimination·typed consumption 근거를 같은 Metro cache entry에 저장하므로 cache hit에도 검증 근거가 유지된다. 별도 임시 provenance 파일은 생성하지 않는다.
- runner는 `.nelyx/windows/static-aot-cache`에 현재 unit object·함수 대응과 image identity만 교체한다. verified toolchain·Clang/linker·producer·옵션·환경·원본 hash 및 출력 DLL hash가 같으면 image를 재사용한다. 일부 unit 변경 시 해당 unit을 재생성하고 나머지 object·baseline 근거를 재사용한 뒤 재링크·PC map을 생성한다. 손상된 입력은 다시 빌드하며 활성 cache owner 중복을 거절한다. C/PDB/staging은 finally에서 제거하고 과거 세대·입력 복제·배포 cache는 만들지 않는다.
- unit 컴파일은 CPU/메모리에 따라 최대2개로 제한해 병렬 수행한다. 큰 app C translation unit 자체를 분할하거나 `-O3`·부동소수점 정책을 변경하지 않았으므로 첫 빌드와 app unit 변경의 전체 C 컴파일 비용은 남는다. frontend·baseline·근거 분석·Clang 시간을 분리해 출력한다.
- 검증 완료: 일반 AOT suite **29 PASS / opt-in12 SKIP**, 별도 cache·Metro·실제 VM 선정 **6 PASS**, 최종 packaged window **1 PASS**다. 실제 Metro cache hit/소스·정책 변경, native image cold/warm·부분 변경·descriptor 재링크·DLL/object/metadata 손상·취소·compiler 실패 후 정상 결과 재사용을 확인했다. 같은 VM의 scalar guard·클래스/private·예외·GC 회귀, CLI/Metro/static-aot 선언 타입·package boundary·diff 검사도 통과했다. 변경한 tooling·선언·문서의 source→archive→설치13개 파일 hash가 일치한다.

같은 Windows x64 Release·접근성 비활성 설정의 실제 installed Testbed 결과다. supplier toolchain은 준비된 상태이고 host는 증분 빌드다. clean-machine 수치나 runtime frame 성능 수락이 아니며 첫 빌드 중 짧은 회귀 검사·OS file cache·외부 부하는 격리하지 않았다.

| 빌드 | 전체 시간 | native image 단계 | 관찰 |
|---|---:|---:|---|
| 새 compiler cache 생성 | 574,914ms (9분35초) | 424,470ms | app Clang386,286ms, 최적화 frontend21,808ms, baseline5,128ms, 함수 대응2,933ms |
| 문서 포함 공급본 갱신 후 | 122,622ms | 8,224ms | 세 unit 모두 cache hit, 새 manifest plan의 descriptor 재링크·PC map 재생성 |
| 동일 입력 반복 | 113,934ms (1분54초) | 373ms | image hit, C/baseline/Clang 실행0, DLL hash 동일 |

전체 반복 빌드80.18% 감소(5.05배)다. Metro 변환·inventory 단계는45,006ms에서9,553ms로 줄었으며 source graph/type policy와 package 검증은 매번 유지한다. 최종 `wholeAppNativeAot=true`·`typePolicyAccepted=true`, DLL SHA256 `c2f0b64aa29a7afd38111555e90c75ef210377c05e9706dd40c4b8b4b84e4c4e`다. `NelyxTestbed2` Visible/Responding=true·세 DLL의 package 경로, cooperative close exit0/forced=false/error=null을 확인했다. 현재 Release는 기존 비교 설정인 접근성 비활성을 유지한다. 기존 `performanceAccepted=false`를 변경하지 않는다.

현재 cache는 index1개와 세 unit object만 유지한다. 새 C/PDB/native staging·cache lock·package/compiler staging과 이전 Release 사본은 남지 않았고 공급 archive8개와 현재 Release만 교체했다. 첫 빌드/앱 unit 변경 시 큰 C 컴파일 비용과 더 세밀한 native C 분할은 남는다.
