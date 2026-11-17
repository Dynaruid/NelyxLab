# Hermes 기반 새 성능 전략: 범용 자료구조와 반복 객체 초기화 비용 줄이기

작성일: 2026-11-17

상태: **설계·탐색 완료 / 구현·성능 검증 전 / performanceAccepted=false**

검토 기준: HEAD `a2ad1701`, 작성 시작 시 깨끗한 작업 트리. [work.md](work.md), [원인 분석](performance-cause-analysis.md), [work2.md](work2.md)의 실행 기록과 현재 Core·변환기·Hermes 공급 소스를 읽었다. 이 문서 작성에서는 앱 실행, VM 빌드, 패키지 공급, 제품 코드 변경을 하지 않았다. 아래 수치는 모두 과거 기록의 인용이며 현재 checkout의 새 측정값이 아니다.

## 1. 방향 결정

**앞으로의 기본 전제는 Hermes다. 다음 질문은 “다른 엔진이 더 빠른가”가 아니라 “Hermes에 넘기는 동적 작업과 임시 객체를 얼마나 줄일 수 있는가”다.**

- 기준 실행은 기존 **Hermes bytecode + TDZ pruning off**로 둔다. Static Hermes AOT는 같은 Hermes 계열의 조건부 후보이지 자동으로 켤 해법이 아니다.
- [work2.md의 JSC 인계](work2.md#L967)는 과거 작업으로 보존한다. 그 문서의 JSC 공급·정식 제품화 우선순위를 새 작업에 이어받지 않는다. JSC 소스 삭제나 공통 factory 되돌리기도 이번 요청의 범위가 아니다.
- Widget·Element·State의 수명, build와 callback의 관측, 날짜별 Focus·Ink·Semantics, 입력률·이동량은 유지한다. 화면을 단순하게 만들거나 입력을 버려 30fps를 만드는 방향은 제외한다.
- **새 주력 후보는 제한된 도메인의 자료 표현 특수화다.** 첫 대상은 8개 값뿐인 WidgetState 집합이다. 독립적인 두 번째 후보는 Hermes의 반복 `Object.defineProperties` descriptor 해석이다.
- 어느 후보도 병목으로 확정하지 않는다. **긴 프레임에서의 실제 비용 → 작은 구현 → 실제 Hermes 비교** 순서로 진행한다. 두 후보를 묶어 구현하거나 작은 helper 제거를 끝없이 이어가지 않는다.

핵심 차이는 객체를 오래 보관하는 것이 아니다. **같은 객체 수명과 공개 동작을 유지하면서, 그 안에서 실행하는 범용 알고리즘을 줄이는 것**이다.

## 2. 이전 결과에서 배운 것

| 기존 시도 | 확인된 결과 | 새 작업에서의 의미 |
| --- | --- | --- |
| dormant 월 페이지 보존 | [work2 §9](work2.md#L239): 월 root마다 일반 GlobalKey 5개, 관측한 보존 자격 통과 0. 월별 Element 898–1,017개, State 247–281개 | 보존 용량이나 delegate 토큰만 추가해서 해결되지 않음. 같은 설계를 이름만 바꿔 재개하지 않음 |
| owner 등록·구조 동기화 축소 검토 | [work2 §10](work2.md#L330): 중복 제거가 이미 작동. 관측 owner 계열보다 mount·첫/후속 rebuild·회수의 누적 비용이 큼 | 등록 한 줄 제거를 주력 해법으로 삼지 않음. 진단 구간은 중첩되므로 전체 CPU 비율로 환산하지 않음 |
| inherited 조상 순회·최초 render 설정 중복 제거 | [work2 §11](work2.md#L391), [§12](work2.md#L485): 국소 동작 검증은 통과했지만 전체 30fps와 정체 기준 실패 | 방문·호출 횟수 감소와 프레임 개선은 별도 수락해야 함 |
| 빈 Ink 변환 제거 | [work2 §13](work2.md#L638): 정체 수치 PASS-scoped, 전체 30fps 실패, 역방향 입력 지연 개선 미입증 | 유효한 국소 변경을 무효라고 하지 않되 전체 해법으로 확대하지 않음 |
| Material 지역화 소유·재사용 | [work2 §14](work2.md#L720): 후보 성능 수락 실패 후 철회 | 반복 생성이 보인다는 이유만으로 cache 추가를 채택하지 않음 |
| 전체 동적 AOT·typed 큐·TDZ pruning·VM dictionary 한도 변경 | [work §8–9](work.md#L453): 전체 목표 미달, 일부 후보 철회 또는 opt-in 유지 | native 함수 수, 정적 helper 수, microbenchmark만으로 제품 성능을 판단하지 않음 |
| 동일 JS의 엔진 비교 | [work2 §15.6](work2.md#L883): 표시 FPS 중앙값은 Hermes **29.160 / 26.230 / 22.373**, JSC interpreter **11.476 / 15.703 / 8.693**, JSC JIT 허용 **39.934 / 43.889 / 37.566** | 실행 방식의 영향이 크다는 근거. Hermes의 불가능성이나 특정 연산의 병목을 증명하지는 않음 |

FPS 순서는 보통 정방향 / 빠른 정방향 / 역방향이다. 마지막 행은 당시 고정 입력·renderer·진단 host의 각 3회 결과이며 새 공통 factory나 현재 제품의 수락값이 아니다. 표시 값은 화면 marker 관측 하한이지 실제 scanout이 아니다.

종합하면 **기능을 유지하는 국소 개선은 있었지만, 최종 성능 목표를 달성할 전략은 아직 찾지 못했다.** 새 계획은 이를 반복하지 않도록 후보의 비용 규모와 중단 조건을 먼저 둔다.

## 3. 새로 겨냥할 비용: 작은 상태를 범용 객체망으로 처리하는 일

현재 생성된 [날짜 build](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2088)는 상태 집합을 만들고 controller에 전달한 뒤 여러 WidgetStateProperty를 resolve한다. 이 과정에서 날짜 선택 정책을 바꾸지 않고 검토할 수 있는 공통 경로가 있다.

```text
emptyWidgetStateSet
  → widgetStateSet / 새 key policy
  → DartSet
  → DartMap
  → JS Map + Set + bucket 배열 + entry 객체
  → accepts / validQuery / hash / equals
  → 등록된 enum인지 prototype·token 확인
```

또 다른 공통 경로는 생성·불변 필드 보호다.

```text
생성자
  → 이미 만들어 둔 field descriptor 묶음
  → Object.defineProperties
  → Hermes에서 key 수집·descriptor 변환·임시 저장
  → 대상 객체에 순서대로 속성 정의
```

두 경로 모두 **범용 구현 자체가 잘못됐다는 뜻은 아니다.** 임의 Dart key와 JavaScript descriptor를 받아야 하는 공개 경계에는 그 구현이 필요하다. 새 가설은 “공통 framework가 스스로 만든, 더 좁은 입력에서도 매번 같은 일반성을 지불하고 있는가”다.

이는 현재 확인한 **실행 경로**이지 아직 확인한 **성능 병목**은 아니다. 코드 길이·객체 개수로 FPS 향상률을 예측하지 않는다.

## 4. 후보 A — WidgetState 집합의 내부 표현 특수화

### 4.1 코드 근거

- [SourceWidgetState](Nelyx/src/framework/widgets/widget-state.generated.ts#L85)는 현재 8개의 frozen singleton을 갖는다. 복합 and/or/not constraint와 `any`는 이 8개 enum 값과 다른 도메인이다.
- [widgetStateSet](Nelyx/src/framework/widgets/widget-state-constraint-source-adapter.ts#L165)은 매번 policy를 만들고 일반 DartSet을 생성한다. 해당 policy의 admission과 hash는 등록 token·prototype을 확인한다.
- [DartSet](Nelyx/src/foundation/dart-collections.ts#L293)은 내부 DartMap을 만들고, [DartMap](Nelyx/src/foundation/dart-collections.ts#L107)은 bucket Map과 insertion-order Set을 가진다. 작은 집합도 일반 map의 조회·entry·revision 경로를 사용한다.
- [WidgetStatesController](Nelyx/src/framework/widgets/widget-state.generated.ts#L678)는 mutable set과 실제 add/remove 결과로 알림 여부를 정한다. 따라서 모든 동일 상태 집합을 전역 singleton으로 바꾸면 안 된다.
- 달력뿐 아니라 버튼·Ink·입력 등에서도 [공통 WidgetState API](Nelyx/src/framework/widgets/widget-state.ts)를 사용한다. 다만 실제 호출량과 시간은 화면마다 별도로 확인해야 한다.

### 4.2 제안

**공개 DartSet 객체는 유지하고, 정확히 등록된 enum 도메인에서만 내부 저장 방식을 작게 만든다.** 첫 실험은 WidgetState 한 도메인으로 제한한다. 일반 DartMap 전체를 다시 작성하거나 공개 Set 대체 API를 만들지 않는다.

설계 후보는 membership bitmask와 작은 삽입 순서 저장소다. 단순한 enum 순서 순회는 기존 삽입 순서와 다르므로 사용할 수 없다. 8개라서 선형 저장소가 더 저렴할 수도 있다. 두 구현을 모두 제품화하지 말고 실제 Hermes의 짧은 동일 연산 비교로 하나만 선택한다.

- 제거 대상: 이 집합의 범용 hash bucket·entry 객체와 반복 hash/equality dispatch.
- 유지 대상: 매 build의 새로운 mutable set identity, controller의 값 교체·알림, 외부 resolver가 받는 실제 집합, callback 순서.
- 일반 Set, 사용자 key policy, 복합 WidgetStatesConstraint map은 기존 경로를 유지한다.
- generated 날짜 build는 바꾸지 않는다. 후보의 연결점은 [공통 adapter](Nelyx/src/framework/widgets/widget-state-constraint-source-adapter.ts)와 [컬렉션 구현](Nelyx/src/foundation/dart-collections.ts)이다. 생성 선언 변경이 필요해지면 [생성 소유권 규칙](tools/Nelyx.FrameworkToTypeScript/README.md)을 따른다.

### 4.3 구현 전에 풀어야 할 계약

| 항목 | 반드시 유지할 것 |
| --- | --- |
| 자격 | 이름·`index` 숫자·겉모양이 아니라 등록된 정확한 singleton identity. 다른 owner의 enum, fake, Proxy를 임의로 인정하지 않음 |
| 관측 | `DartSet.is`, `instanceof`, 공개 method와 elementPolicy의 동작, 사용자 override와 receiver. 정책 객체 identity를 캐시해 바꾸는 작업은 별도 증명 없이 포함하지 않음 |
| 순서 | 삽입 순서, 중복 add의 반환값, 삭제 후 재삽입이 맨 뒤로 가는 동작, lookup의 원래 저장 객체 반환 |
| 변경 | iterator 생성 시 revision 캡처, 순회 중 구조 변경과 종료 뒤의 검사, freeze 후 no-op 변경도 거절하는 기존 동작 |
| 외부 코드 | 사용자 resolver가 집합을 보관·순회·변경하거나 controller listener가 재진입하는 경우. 값이 작다는 이유로 callback을 생략하지 않음 |
| 실패 | 잘못된 add의 오류, 외부 iterable의 예외와 부분 적용, 조회 시 기존 policy의 관측 순서. unsupported 입력은 관측 전에 기존 경로로 보내고 오류를 빈 집합으로 바꾸지 않음 |
| 수명 | 집합별 저장소는 집합과 함께 회수. 과거 상태 조합, Widget, Element를 전역 cache에 보관하지 않음 |

등록 당시 enum이 frozen이었다는 사실만으로 이후 owner·prototype·공개 policy 교체까지 안전하다고 가정하지 않는다. **관측 가능한 변경을 보존할 수 없으면 그 호출은 일반 경로에 남긴다.** guard가 매 연산마다 원래보다 비싸지면 이 설계도 실패다.

### 4.4 무엇을 입증해야 하는가

실제 Hermes에서 **생성 → add → 여러 resolve/contains → controller update → 순회·회수**까지 비교한다. `contains` 단독 벤치마크나 bitmask 연산 속도로 수락하지 않는다. 냉시작과 반복 build 모두에서 제거된 저장 객체·총 비용을 확인하고, 날짜와 일반 버튼/Ink의 동작이 유지되는지 검사한다.

이 후보가 비용 선별을 통과하면 **첫 구현 대상으로 권고**한다. 공통 framework 표현을 바꾸므로 bytecode에서도 효과를 시험할 수 있고, native VM fork부터 시작하지 않아도 된다. 다만 이것 하나로 월 subtree 생산 비용 전체가 없어지는 것은 아니다.

## 5. 후보 B — Hermes의 불변 descriptor 해석 계획 재사용

### 5.1 기존 최적화와 아직 남는 부분

[ownFieldInitializer](Nelyx/src/ui/value-math.ts#L77)와 [finalFieldProtector](Nelyx/src/ui/value-math.ts#L100)는 이미 descriptor 묶음을 한 번 만들고 freeze한다. “매번 descriptor object를 만드는 코드니 바깥으로 빼자”는 새 제안이 아니다.

하지만 로컬 pinned Hermes의 [objectDefinePropertiesInternal](.nelyx/windows-hermes/source/lib/VM/JSLib/Object.cpp#L620)은 호출마다 다음을 수행한다.

1. descriptor 묶음의 own keys 수집.
2. descriptor 값 읽기와 `toPropertyDescriptor` 변환.
3. 임시 ArrayStorage와 native 목록에 변환 결과 저장.
4. 모든 descriptor 변환을 마친 후 대상 객체에 순서대로 적용.

동일한 frozen descriptor 묶음을 여러 인스턴스에 쓰더라도 이 함수에는 재사용 계획을 받는 경로가 보이지 않는다. **descriptor 변환과 임시 저장 비용이 실제 생성 경로에서 충분히 크다면**, 대상 객체가 아닌 descriptor 해석 결과를 재사용하는 VM fast path를 검토할 수 있다.

확인한 공급 pin은 [260318099.0.7 / HBC99](Nelyx/sdk/tooling/cli/src/windows-native-hermes-pin.mjs)의 `b464dba92ad87bcfb77fae381a49a2394d9836d9`다. 로컬 VM 소스 링크는 해당 공급이 준비된 환경에서만 존재한다. 이번에는 공급 전체의 source hash 검사를 다시 실행하지 않았으며, 구현 때는 정규 supplier의 [source identity 검사](Nelyx/sdk/tooling/cli/src/windows-native-hermes-source.mjs)를 다시 통과해야 한다.

### 5.2 제안의 범위

첫 범위는 framework가 반복 사용하는 **값을 담지 않는 final-field 속성 보호 descriptor**처럼 좁은 경우다. 임의 값·accessor를 보관하는 범용 cache부터 만들지 않는다.

- 변경하지 않는 key 순서·descriptor flags의 해석 결과만 재사용한다. 대상 인스턴스와 속성 값은 매번 현재 객체에서 처리한다.
- 기존 속성 적용 경로는 유지한다. 대상 객체의 extensibility, 기존 descriptor와 충돌, 실패까지의 부분 적용을 생략하지 않는다.
- 객체 layout 전체를 합치거나 instance identity를 재사용하지 않는다. dictionary threshold를 64→128로 다시 올리는 실험도 아니다.
- bytecode와 Source 알고리즘은 유지하고 VM 내부 일반 builtin의 제한된 fast path로 비교한다. 앱별 생성자를 native로 수동 복제하는 방향은 제외한다.

### 5.3 가장 중요한 위험

**`Object.freeze`만으로 descriptor를 안전하게 캐시할 수는 없다.** [finalValueDescriptor](Nelyx/src/ui/value-math.ts#L69)는 일부 필드만 own property로 가진다. 없는 descriptor 필드의 조회는 prototype의 영향을 받을 수 있고, frozen object에도 accessor가 있을 수 있다.

따라서 다음을 해결하기 전에는 구현에 들어가지 않는다.

- descriptor 묶음과 각 descriptor가 일반 객체이며 필요한 관측이 안정적인 own data로 증명되는가.
- 누락 필드의 prototype 조회 결과가 바뀌지 않는다는 guard 또는 무효화가 가능한가. prototype을 강제로 freeze하는 것은 해법이 아니다.
- Proxy·accessor·symbol key·동적 prototype 경로는 일반 구현의 trap·예외 순서를 그대로 거치는가.
- 먼저 전체 descriptor를 변환한 뒤 속성을 적용하는 **두 단계 의미**를 보존하는가. 변환 도중 오류가 나는 사례를 속성 적용 뒤 오류로 바꾸면 안 된다.
- GC 이동·회수, runtime 종료, cache 수명에 맞춰 key와 plan을 안전하게 관리하는가. 단순 strong map으로 모든 descriptor를 영구 보존하지 않는가.

first-use 분석·guard·cache 관리까지 포함한 순이익을 확인한다. **호출 수가 많아도 실제 native 비용이 작거나 guard 비용이 더 크면 보류**한다.

VM 변경이 필요하므로 A보다 위험이 크다. 구현한다면 [정규 Hermes 공급 코드](Nelyx/sdk/tooling/cli/src/windows-native-hermes.mjs)에 재현 가능한 patch·정책 identity를 연결한다. 로컬 공급 디렉터리를 직접 고쳐 manifest만 맞추지 않는다. 새 VM 공급을 정상 재생성·검증하는 일은 이 후보 비용에 포함한다.

## 6. 후보 C — 큰 닫힌 실행 구역의 typed AOT: 조건부 후속

이 방향은 완전히 새로운 발견이 아니라 [기존 typed AOT 작업](work.md#L484)의 **미완성 확장**이다. 새 이름을 붙여 이전 큐 실험을 다시 수행하지 않는다.

현재 [owned factory 검사](Nelyx/sdk/tooling/static-aot/src/owned-factory.mjs#L32)는 private scalar만 증명하고 property·callback·배열 접근은 boxed JS 관측으로 남긴다. 과거 큐 9개 함수의 typed 연결이 곧 Element/layout 본체의 특수화는 아니었다.

추후 추진한다면 기준을 다음처럼 바꾼다.

> typed 함수 개수를 늘리는 대신, 실제 긴 프레임에서 비용이 큰 연속 구역 하나의 동적 객체 접근·임시 할당·호출 경계를 함께 줄인다.

- 입력의 소유권과 primitive 표현을 경계에서 증명하고, 내부에서 같은 일반성 검사를 반복하지 않는 구조를 검토한다.
- 외부 callback·getter·가상 method 호출은 구역 경계다. 임의 Widget/State를 TS 타입만 믿고 고정 slot record로 cast하지 않는다.
- Source 알고리즘 하나를 유지하고 bytecode/Web 경로도 검증한다. 포장·복사·guard 비용을 포함해 비교한다.
- [기존 Flex numeric service](Nelyx/src/hosting/flex-layout.ts)처럼 이미 있는 경계를 먼저 조사한다. numeric service를 새로 만들었다는 사실 자체를 진전으로 세지 않는다.
- A/B를 탈락시킨 뒤 자동으로 이 후보를 구현하지 않는다. 더 큰 해당 구역과 닫힌 계약이 실제로 확인된 경우에만 별도 작업으로 승격한다.

## 7. 이번에는 우선하지 않을 방향

| 방향 | 판단 |
| --- | --- |
| JSC/V8 전환·새 엔진 비교·JSC supplier 완성 | Hermes 고정 방침과 다름. 기존 작업은 보존하되 새 목표의 prerequisite으로 만들지 않음 |
| 모든 월 keep-alive·GlobalKey 자격 완화·큰 prewarm | 기존 자격 실패와 첫 생산 비용을 해결하지 못함. 메모리·수명 정책 변경을 성능 개선으로 숨기지 않음 |
| GC heap 크기·스레드 우선순위부터 변경 | [기존 GC 관측](work.md#L482)만으로 단독 원인을 특정할 수 없음. 먼저 할당을 만드는 자료 표현을 조사 |
| TDZ·null check·type witness helper를 개별적으로 계속 제거 | 이미 일관된 효과를 입증하지 못한 접근과 유사. `nullableDartType`도 [기존 cache](Nelyx/src/foundation/dart-type-witness.ts#L99)가 있어 반복 호출과 반복 생성은 다름 |
| 모든 const Widget을 cache | [Dart const 지원](Nelyx/src/foundation/dart-const.ts)과 [동일 Widget의 update 생략](Nelyx/src/framework/widgets/framework.ts#L1340)이 이미 존재. 동적 build 결과까지 const로 취급할 근거 없음 |
| 기본 class 문법 보존·`-O`만 켜기 | [native preset](Nelyx/sdk/tooling/metro/src/native-es2022-preset.cjs)이 이미 native class 정책을 사용. 기본 설정 누락을 가정하지 않음 |
| 비동기 mount·native 독립 스크롤 | 장기 대안이지만 Source 수명·입력 geometry·semantics의 소유권을 바꾸는 별도 프로젝트. 이번 표현 최적화와 혼합하지 않음 |

## 8. 실행 순서와 중단 조건

### H3-00 — Hermes 기준선을 먼저 성립시킨다

[work2 §16](work2.md#L973)은 공통 engine factory의 새 C++ compile/link/runtime 미검증과 SDK/CLI workspace·설치본 불일치를 기록했다. 작업 트리가 깨끗해졌다는 사실은 이 경로가 검증됐다는 뜻이 아니다. 문서 작성 시 설치본 identity를 다시 측정하지 않았으므로 과거 불일치가 현재도 같은 값이라고 단정하지도 않는다.

실행 작업을 시작할 때 다음만 먼저 처리한다.

1. 현재 Source·dist·설치 package·Hermes VM/host identity와 실제 engine/mode를 확인한다.
2. 현재 공통 factory의 **Hermes bytecode 경로**를 compile/link, 첫 프레임, 정상 종료까지 확인한다. 막히면 그 호환 문제를 먼저 해결하고 성능 후보를 섞지 않는다.
3. 필요한 패키지만 정규 절차로 빌드·공급한다. static-aot를 실제 사용할 때 그 경로도 별도로 확인한다.
4. JSC 공급 갱신·JSC 실행을 요구하지 않는다. 이전 binary를 실행하면서 새 Source의 baseline이라고 기록하지 않는다.

### H3-01 — 후보 A/B의 비용과 제거 가능 범위를 한 번에 판정한다

기존 [달력 실행기](Nelyx/eng/check-windows-jank.ps1), [framework 진단](Nelyx/eng/windows-jank-framework-profile.ts), [Hermes CPU hook](Nelyx/sdk/native/windows-hermes/EngineHermes.cpp#L34)을 재사용한다. 별도 범용 profiling 시스템이나 영구 trace 저장소를 만들지 않는다.

여기서 **긴 프레임**은 Source frame 처리 구간이 **33.33ms를 넘는 진단 대상**으로 정의한다. runtime-thread 실행 비용과 host/GPU 대기는 구분하며, 필요한 frame sequence 연결이 현재 집계에 없으면 제한적으로 보완한다. 이 진단 임계값은 표시 30fps 수락이나 ≥100ms 표시 정체의 정의를 대신하지 않는다.

- 원칙적으로 진단 1회, 측정 경계가 부족할 때 보완 1회까지만 한다. 진단 실행은 성능 수락 표본과 분리한다.
- 새 월 생산과 기존 월 rebuild를 나눠 A의 set 생성·조회·policy, B의 descriptor 해석·속성 적용을 구분한다. 이 비용을 단순 leaf 이름이나 정적 문자열 빈도로 대체하지 않는다.
- JS sampling만으로 B의 native 내부 시간을 분리할 수 없으면 해당 builtin의 제한된 native 계측이 필요하다. JS wrapper 시간을 descriptor 변환 시간이라고 기록하지 않는다.
- 구간은 동일 clock·중첩 제거 기준으로 측정한다. callback·GC·부모 rebuild와 중복 합산하지 않는다. 매 작은 연산마다 clock을 읽는 계측 비용도 별도로 확인한다.
- candidate 비용이 긴 프레임에 몰리는지 확인한다. phase 전체 누적 비용이 커도 다른 프레임의 빈 시간에 분산돼 있으면 우선순위가 낮다.

**새 선별 기준 제안:** 후보가 적용 가능한 호출들의 비용이, 관측한 긴 프레임의 runtime-thread busy time에서 대략 **15% 이상**인지를 먼저 확인한다. 이는 이번 설계의 투자 선별선이지 과거 관측값이나 30fps 달성의 충분조건이 아니다. 샘플 오차·계측 교란 때문에 판단할 수 없으면 미판정으로 남기고 구현을 확대하지 않는다.

A가 통과하면 A 하나를 먼저 구현한다. A는 작고 B가 충분히 크면 B의 의미 보존 설계부터 진행한다. 둘 다 작으면 **둘 다 보류**한다. 후보 목록을 계속 늘리며 작은 변경을 누적하지 않는다.

### H3-02 — 한 후보의 동작과 순비용만 검증한다

- 기존 fixture에 변경 동작의 정상·실패·재진입 사례를 추가한다. 언어 동작을 반복 확인하는 수백 개 테스트나 새로운 감사 문서 체계를 만들지 않는다.
- Source/Node 검사는 준비 단계다. 실제 pinned Hermes 실행으로 동일 입력의 결과·예외·관측 순서를 확인한다.
- A는 전체 set 수명과 공개 resolver, B는 전체 defineProperties 호출과 GC 수명을 비교한다. guard·fallback·초기화·회수 비용을 제외한 숫자는 수락하지 않는다.
- 국소 이득이 없으면 공급 확대 전에 철회한다. 국소 이득이 있어도 전체 수락은 아직 false다.

### H3-03 — 동일 조건의 제품 비교

기준선 3회와 후보 3회를 비교한다. 가능하면 명시적 실험 선택으로 교차 실행하되, 아직 존재하지 않는 flag가 있다고 가정하지 않는다. 공급을 바꿔야 하면 현재 출력만 정규 절차로 직렬 교체하고 이전 SDK 전체 사본을 만들지 않는다. A와 B의 효과는 따로 판정한다.

고정할 조건:

- 같은 앱·diagnostic entry·renderer·viewport/DPI/refresh, 같은 60Hz 입력과 보통/빠른 정방향·역방향 시나리오.
- 기존 touch **48/30/60개**, gesture **6/6/12회**, 상대 월 이동 **+4/+3/−6**. 역방향은 다른 phase와 작업량이 다르므로 방향별 알고리즘 결함의 증거로 사용하지 않는다.
- A 비교에서는 VM을 고정하고 Source의 의도한 차이만 허용한다. B 비교에서는 app JS/HBC를 고정하고 VM의 의도한 차이만 허용한다. 바뀌어야 하는 hash까지 같아야 한다고 요구하지 않는다.
- CPU/build/heap 관측 hook은 끈다. 공급 준비 실패, foreground 이탈, 주입 deadline 실패는 이유를 남기고 유효 FPS 표본과 구분한다. 실패를 숨기거나 유리한 재실행만 고르지 않는다.

**수락 기준**은 다음과 같다.

| 범위 | 기준 |
| --- | --- |
| 전체 목표 | 유효 3회 **각각**, 세 달력 phase **모두**, engine FPS와 표시 FPS 하한 **각각 30 이상** |
| 진행 정체 | phase별 ≥100ms 정체의 3회 중앙값에서 횟수·최장 비증가, baseline에 정체가 있으면 총 시간 감소, baseline 0이면 0 유지 |
| 입력 지연 | 입력→surface p50/p95/p99/최장과 queue 지연을 함께 보고. 새 기본 채택에서는 phase별 p95 중앙값 악화도 허용하지 않는 기준을 제안하며, 이는 과거 PASS의 소급 변경이 아님 |
| 기능 | 수신=전달=수락·거부 0, 월 정착·선택·focus·UIA·geometry·정상 종료. callback/오류/사용자 확장 계약 유지 |
| 자원 | 단기 왕복 후 live 객체·native 자원에 지속 증가가 없는지 확인. GC 시점 차이와 누수를 구분하며 단기 확인으로 장시간 누수 수락을 주장하지 않음 |
| 공통 회귀 | 후보가 닿는 버튼·Ink·편집 및 Gallery·가변 목록·Testbed·Web 관련 동작. Windows 결과를 Android/Apple 성능으로 확대하지 않음 |

30fps에 미달한 후보를 “대부분 개선”으로 완료 처리하지 않는다. 국소 효과만 남으면 **PARTIAL**로 기록하고 기본 채택과 다음 투자를 별도로 판단한다. 결과가 섞이면 불확실로 끝내며, 통과할 때까지 반복하지 않는다.

## 9. 실행 예산과 산출물

- **모든 테스트·검증 batch는 20분 timeout**을 사용한다. timeout은 성능 FAIL이나 정상 완료로 바꾸지 않고 중단으로 분리한다.
- 첫 후보의 계획 예산은 기준선 3회 + 진단 최대 2회 + 후보 3회 + 관련 기능 시나리오 소수 회다. 전체 시나리오 실행은 실패·보완을 포함해 원칙적으로 **30회 이내**이며, 부족한 근거를 무조건 반복으로 보충하지 않는다.
- 한 실행에 필요한 임시 디렉터리만 사용하고 성공·실패·중단 모두 `finally`에서 정리한다. 소유한 정확한 PID만 종료하며 공유 환경의 다른 앱·IDE process는 건드리지 않는다.
- raw 검증 로그·immutable receipt·checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile을 누적하지 않는다. 별도 드라이브 archive도 만들지 않는다.
- 빌드는 현재 dist·현재 공급만 남긴다. 교체용 이전 dist와 staging은 종료 시 삭제하며 SDK/cache 전체 복제로 A/B 환경을 만들지 않는다.
- 결과는 이 문서에 **조건, 짧은 표, 판정, 남은 범위**만 추가한다. 과거의 다른 공급 결과를 새 후보의 검증 결과로 복사하지 않는다.

## 10. 최종 권고

**다음 구현의 첫 후보는 공통 WidgetState 집합의 내부 표현 특수화다.** 이미 8개 singleton으로 닫힌 상태를 일반 Map·Set·hash policy 계층으로 처리하는 비용을 줄이되, 집합과 Widget의 공개 동작은 그대로 둔다. 먼저 실제 긴 프레임에서 충분한 비용인지 판정한다.

두 번째는 **Hermes의 반복 불변 descriptor 해석**이다. Source에 descriptor cache가 이미 있어도 VM의 재해석·임시 할당이 남는다는 점을 겨냥한다. 다만 prototype·예외·GC 계약 때문에 native 비용과 자격 증명이 확보된 경우에만 진행한다.

이것은 성능 향상을 약속하는 문서가 아니다. **Hermes를 유지하면서, 앞선 cache 확대·작은 검사 제거와 다른 두 가지 실행 비용을 구체적으로 시험하고 빨리 채택 또는 중단하기 위한 계획**이다. 이번 산출물은 이 문서뿐이며 제품 구현·성능 측정은 시작하지 않았다.
