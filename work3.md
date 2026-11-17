# Hermes 기반 새 성능 전략: 범용 자료구조와 반복 객체 초기화 비용 줄이기

작성일: 2026-11-17

상태: **H3-00 PASS / H3-01·후속 선별 종료·A/B 및 getter VM 변경 보류 / H3-02·03 조건부 미착수 / PARTIAL / performanceAccepted=false**

설계 당시 검토 기준: HEAD `a2ad1701`, 작성 시작 시 깨끗한 작업 트리. [work.md](work.md), [원인 분석](performance-cause-analysis.md), [work2.md](work2.md)의 실행 기록과 당시 Core·변환기·Hermes 공급 소스를 읽었다. §1–10의 수치는 과거 기록의 인용이다. **2026-11-17 사용자의 실행 요청과 후속 계속 요청으로 수행한 현재 checkout의 결과는 §11–12에 별도로 기록한다.**

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

이것은 성능 향상을 약속하는 문서가 아니다. **Hermes를 유지하면서, 앞선 cache 확대·작은 검사 제거와 다른 두 가지 실행 비용을 구체적으로 시험하고 빨리 채택 또는 중단하기 위한 계획**이다. §1–10은 구현 전 설계이며, 이후의 실행 판정은 아래 절을 따른다.

## 11. 실행 결과 — 2026-11-17

### 11.1 H3-00 — 현재 Hermes factory 기준선 PASS

실행 시작 HEAD는 `f4ceea9d`, 작업 트리는 깨끗했다. VM/JSI callback·SHUnit/DLL 수명과 profiler 종료 순서를 코드에서 먼저 확인했다. 실제 설치 Demo의 SDK/CLI는 workspace와 달랐고 Core/Material은 같았다. 정규 `refreshSampleWindowsSdk`의 변경 패키지 공급·설치로 맞췄다. TypeScript Source와 emitted source-map 입력도 Core 645개, SDK 117개, Material 275개 일치를 확인했다. SDK의 TS Source 변경은 없어 불필요한 전체 SDK build는 하지 않았다.

README의 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`으로 새 공통 factory의 C++ compile/link, Hermes bytecode 첫 프레임, 정상 종료를 확인했다. exit 0, `forced=false`, RN/Node-API JSI 혼입 없음이다. 초기 host는 `a67796af…`, 일반 HBC는 `a3fb0dd8…`였다. 기본 TDZ pruning off, VM pin/HBC99와 ICU 79.1을 유지했다. JSC 공급·실행과 static-aot는 진행하지 않았다.

### 11.2 성능 기준선 — 유효 3회, 전체 목표 FAIL

실행은 `check-windows-jank.ps1 -Scenario calendar -HermesMode bytecode -Runs 3`이다. Demo, Graphite/Vulkan, 2560×1459, DPI 192, 165Hz, 같은 60Hz touch 48/30/60개·gesture 6/6/12회·월 이동 +4/+3/−6을 고정했다. CPU/build/heap 관측 hook은 껐다. 세 실행의 진단 entry·JS/HBC·renderer·VM·host Source identity는 동일했다. HBC `fd2930da…`, renderer `c072724c…`, VM `5a7a8d64…`, host Source `9b133b77…`, 설치 SDK 묶음 `d46e6402…`다.

아래 각 칸은 **engine FPS / 표시 FPS 하한**이다. engine 값은 surface-copy fence 완료 기준, 표시 값은 desktop marker 관측이며 scanout이 아니다.

| 실행 | 보통 정방향 | 빠른 정방향 | 역방향 |
| --- | --- | --- | --- |
| 1 | 33.181 / 30.523 | 30.554 / 25.073 | 15.093 / 14.256 |
| 2 | 38.047 / 32.545 | 30.069 / 27.159 | 20.912 / 18.124 |
| 3 | 30.089 / 25.216 | 28.912 / 25.996 | 23.691 / 21.195 |
| 중앙값 | 33.181 / 30.523 | 30.069 / 25.996 | 20.912 / 18.124 |

다음은 phase별 3회 중앙값이다. 지연과 정체는 FPS와 별도로 남긴다.

| phase | 표시 진행 ≥100ms 정체 횟수 / 총 ms / 최장 ms | 입력→surface p50 / p95 / p99 / 최장 ms | queue p50 / p95 / p99 / 최장 ms |
| --- | --- | --- | --- |
| 보통 정방향 | 6 / 906.025 / 215.814 | 190.086 / 346.169 / 355.979 / 355.979 | 75.340 / 211.752 / 216.599 / 216.599 |
| 빠른 정방향 | 4 / 720.131 / 217.944 | 214.332 / 383.875 / 383.875 / 383.875 | 89.279 / 171.436 / 171.436 / 171.436 |
| 역방향 | 6 / 965.254 / 203.576 | 327.510 / 448.432 / 464.432 / 464.432 | 164.400 / 282.449 / 298.217 / 298.217 |

모든 실행에서 입력 수신=전달=수락 158, 거부 0, 주입 touch 138개 전부 보존, 월 정착·UIA 날짜/geometry·정상 종료 PASS다. 선택·focus·screen reader·실제 trackpad 전체 수락을 이 결과로 확대하지 않는다. 유리한 재실행을 고르거나 실패 표본을 제외하지 않았으며, 제품 30fps 목표는 실패다.

### 11.3 H3-01 — 프레임 연결 진단 1회와 제한된 보완

기존 달력 실행기·framework profile·Hermes CPU hook을 확장했다. 일반 진단 entry는 그대로 두고 `NELYX_JANK_REPRESENTATION_PROFILE=1`과 `NELYX_NATIVE_CPU_PROFILE=1`에서만 profile helper를 inline한다. 매 작은 연산을 감싸지 않고 프레임 경계에서만 clock을 읽는다. sampler와 같은 steady-clock epoch로 frame sequence를 연결하고 `GetThreadTimes`의 runtime-thread CPU를 별도로 수집했다. CPU 값은 약 15.625ms 단위로 양자화되어 개별 프레임에서 elapsed보다 조금 클 수 있다.

첫 진단은 `-Runs 1 -NoScreen`, `performanceSample=false`다. frame 밖 샘플은 제외하고, 중첩 호출은 후보별 한 번만 세며, GC는 저장된 부모 JS 경로에 귀속하지 않았다. source map으로 일반 컬렉션 전체와 WidgetState adapter를 합친 **A보다 넓은 샘플 범위**를 사용했다. 이는 제거 가능한 시간이나 정확한 WidgetState 호출 비용이 아니다.

| phase | 긴 프레임 수 | elapsed / thread CPU ms | 긴 프레임 샘플 | 컬렉션·policy 범위 | defineProperties builtin 전체 |
| --- | --- | --- | --- | --- | --- |
| 보통 정방향 | 8 | 928.141 / 906.250 | 469 | 4 / 0.853% | 2 / 0.426% |
| 빠른 정방향 | 5 | 668.290 / 656.250 | 337 | 1 / 0.297% | 2 / 0.593% |
| 역방향 | 6 | 1060.628 / 1000.000 | 535 | 7 / 1.308% | 2 / 0.374% |

긴 프레임 19개의 source map 누락은 0이다. 새 `_Day` Element를 생산한 긴 프레임과 기존 날짜를 rebuild한 긴 프레임의 샘플 분모는 각각 295/174, 288/49, 430/105였다. 새 생산 구간의 컬렉션 범위 비중은 1.017/0.347/1.628%, 기존 rebuild 구간은 0.575/0/0%다. phase 전체 누적 비용을 긴 프레임 비용으로 바꾸거나 inclusive 부모를 더해 합계 CPU 비중으로 만들지 않았다. frame clock pair의 평균/최장은 0.000352/0.001600ms였다. 이는 profiler·build observer 전체 교란 비용을 측정한 값이 아니다.

**A는 15% 선별선 통과 근거 없음으로 보류한다.** 위 샘플 비중을 CPU 비용의 정확한 비율이나 성능 향상률로 간주하지 않는다. 전체 집합 수명·정책·callback·GC 기여까지 정량 증명한 것은 아니므로 A의 실제 제거 가능 비용은 확정하지 않았다.

B는 첫 진단의 builtin 전체 비용을 descriptor 변환 시간으로 기록하지 않았다. [정규 supplier](Nelyx/sdk/tooling/cli/src/windows-native-hermes-toolchain.mjs)에 [재현 가능한 native 계측](Nelyx/sdk/tooling/cli/src/windows-hermes-descriptor-profile.mjs)을 연결하고 보완 진단 **1회**를 실행했다. `NELYX_HERMES_DESCRIPTOR_PROFILE=1`은 위 두 진단 flag와 함께 사용할 때만 허용한다. supplier의 producer hash·source-tree hash·출력 파일 hash에 계측 여부를 연결했다. 기본 공급에서는 해당 C++ patch 자체를 제거한다. 로컬 Source나 manifest만 손으로 바꿔 맞추지 않았다.

native 계측은 builtin 진입부터 keys 수집·descriptor 변환·임시 저장까지와, 이후 속성 적용·정리까지를 나눈다. 중첩 호출은 가장 바깥 호출에서 한 번만 시간에 합산한다. Proxy/getter/callback/GC를 새로 관측하거나 생략하지 않으며, 그 비용과 스케줄링 대기가 포함될 수 있는 **전체 호출의 보수적인 상한**이다. 자격이 증명된 descriptor만의 제거 가능한 비용이나 순수 변환 CPU라고 부르지 않는다. 모든 합산 구간은 sampler와 같은 steady clock을 쓴다.

| phase | 긴 프레임 수 / thread CPU ms | builtin 호출 / 실패 | 변환 상한 ms / CPU 대비 | 적용·정리 상한 ms | 전체 상한 / CPU 대비 |
| --- | --- | --- | --- | --- | --- |
| 보통 정방향 | 9 / 921.875 | 2216 / 0 | 7.194 / 0.780% | 1.242 | 8.436 / 0.915% |
| 빠른 정방향 | 6 / 703.125 | 1627 / 0 | 1.599 / 0.227% | 0.921 | 2.520 / 0.358% |
| 역방향 | 8 / 1015.625 | 2486 / 0 | 2.270 / 0.223% | 1.388 | 3.657 / 0.360% |

새 날짜 생산 / 기존 날짜 rebuild의 변환 상한 ms는 각각 0.853/6.341, 1.291/0.308, 1.624/0.646이었다. 가장 큰 기존 rebuild 집계도 전체 builtin 상한이 thread CPU의 1.567%다. native clock pair 교정 평균/관측 최장은 0.0000227/0.000100ms였고 계측 비용을 위 숫자에서 빼지 않았다. 이 호출 범위에는 cache가 제거할 수 없는 속성 적용까지 포함한다. 따라서 **B의 직접 변환 비용은 15% 선별선에 충분히 못 미쳐 보류**한다. 임시 할당이 프레임 밖 GC에 기여하는 양은 별도로 증명하지 않았다.

보완 실행의 supplier는 `f7e9b520…`, HBC는 `bfd0c70d…`이고 `performanceSample=false`다. 첫 진단·기준선과 FPS를 섞지 않는다. 보완 샘플의 source map 미해결은 긴 프레임에서 2/2/4개였으며 누락을 0으로 숨기지 않았다. B의 native 시간은 JS symbolication에 의존하지 않는다. 첫 진단의 A 선별을 이 불완전한 추가 샘플로 정밀화하지 않았다.

같은 pinned Hermes의 첫 화면 준비 전에 제한된 오류·재진입 fixture를 실행했다. descriptor 변환 중 오류가 나면 대상에 먼저 적용하지 않는 동작, 속성 적용 중 오류까지의 부분 적용, getter callback·중첩 defineProperties 관측 순서가 PASS다. 호출 4개·예상 실패 2개, 순서 `convert,outer,nested`를 확인했다. fixture의 예상 오류는 제품 phase의 실패 수와 별개다.

### 11.4 현재 판정과 남은 범위

H3-00 PASS, H3-01은 **A/B 모두 보류로 선별 종료**했다. A의 실제 제거 가능 비용은 미확정이며, B의 직접 비용 상한은 작다. 선별선 통과 근거가 없는 후보를 구현하는 대신 §8의 중단 조건을 적용한다. 따라서 H3-02의 후보 구현·국소 이득과 H3-03의 후보 3회 비교는 조건부 미착수다. 후보가 없으므로 버튼·Ink·Gallery·Testbed·Web 전체 회귀나 장시간 자원 수락을 이번 결과로 주장하지 않는다.

남긴 변경은 명시적으로 켜는 진단 경계·분석·회귀 fixture와 현재 SDK/CLI 공급이다. `DartSet`·WidgetState adapter·생성된 날짜 build·descriptor 의미·cache 수명 정책은 변경하지 않았다. C는 자동으로 승격하지 않는다. 분석 fixture의 frame clock·source map·중첩·GC 분리·불완전 입력 거절, native patch의 반복 적용·정확한 복원·flag 자격, 관련 lint/format과 CLI 선언 타입 검사는 PASS다. 제품 성능 목표는 **PARTIAL / performanceAccepted=false**다.

### 11.5 일반 공급 복원·최종 확인·정리

보완 진단을 소유한 실행의 `finally`에서 정규 supplier를 다시 생성했다. 기본 `descriptorProfile=false`, `Object.cpp`의 계측 marker 0, source-tree SHA-256 `2cdd4ce7ff07f9c0a9a4c1ca3b5485df446a95a8efd2941b2bde0ff4bb3963a2`로 최초 일반 Source와 정확히 같다. 최종 supplier는 `8b551b30…`, 새 일반 VM은 `1f1316f9…`다. 재링크된 binary hash는 최초 기준선 VM과 다르므로 새 binary의 FPS를 이미 측정한 것처럼 기록하지 않는다.

최종 일반 실행의 첫 시도는 준비된 입력의 supplier 서명이 바뀌어 **실행 전에 거절**됐다. 검사를 우회하지 않고 `node sample/nelyx-demo-app/eng/windows-inputs.mjs`로 정규 prepare를 갱신했다. 그 뒤 같은 README의 `run:windows -- -- 8000`으로 현재 SDK/CLI·일반 VM의 첫 프레임, 정상 종료 exit 0·`forced=false`를 확인했다. 최종 host `7256bb41…`, HBC `a3fb0dd8…`, 974×929/DPI 192/165Hz, RN/Node-API JSI 혼입 없음이다. 이 유한 실행은 달력 최대화 성능 표본이 아니다.

현재 Source/dist/설치본 파일 내용은 Core `05eb141b…`, SDK `44b166b8…`, CLI `46a3fcbc…`, Material `4c1deb16…`로 일치한다. 일반 제품의 설치 SDK 묶음은 `ea13fee5…`, renderer·VM 공급까지 포함한 build identity는 `4ffed39c…`다. 제품 inventory를 검증했고 diagnostic entry와 source-map 입력은 없다.

달력 시나리오는 기준선 3회 + 진단 2회로 **5회**에서 종료했다. 테스트·실행 batch는 `commands.execute`의 1,200,000ms timeout과 실행기의 자체 timeout으로 제한했다. 소유한 native/진단 process, diagnostic entry/package, 임시 source-check·build/replace staging·공급 staging·lock이 남지 않았다. `.tmp`의 기존 네 파일은 보존했고 SDK/CLI 공급 archive는 각각 현재 1개만 남겼다. 새 raw log·receipt·history JSON·이전 SDK 사본·browser profile·별도 archive는 저장하지 않았다. 최종 `git diff --check` PASS이며 변경은 커밋하지 않았다.

## 12. 사용자 계속 요청 후의 공통 경로 선별

사용자가 이어서 작업하고 파생 작업도 처리하도록 요청했다. §11의 A/B 보류를 성능 수락으로 바꾸지 않고, 다음 구현 대상의 규모와 닫힌 계약을 Source부터 조사했다. HEAD는 `f4ceea9d`이며 앞선 변경을 보존했다.

### 12.1 함수별 표본과 닫힌 구역 조사

기존 sampler의 함수 시작 위치를 source map으로 연결해 직접 표본, 호출 가지 포함 표본, 실제 native leaf를 구분했다. 직접 표본에는 가장 가까운 JS 함수의 native callee가 포함되고, GC 표본은 별도로 제외한다. 호출 가지의 표본은 중첩되므로 더하지 않는다. Windows 경로를 정규화하고 출력은 각 종류의 상위 24개로 제한했다. raw trace는 RAM에서 소비하고 저장하지 않는다.

일반 VM의 추가 sampling 진단 1회에서 긴 프레임은 보통/빠른 정방향/역방향 **9/5/6개**, thread CPU는 **937.5/656.25/984.375ms**였다. GC 표본은 44/33/58개, source-map 미해결은 1/0/1개다. reconcile·mount·inherited lookup·paint 무효화·semantics 등으로 직접 표본이 분산됐다. `flushLayout`·`buildScope` 등의 큰 부모 포함 수치를 하나의 제거 가능한 연산 비용으로 바꾸지 않았다. 이 진단도 `performanceSample=false`다.

조사한 기존 Flex numeric service와 Semantics geometry service는 이미 있는 경계다. Semantics 경로의 조상 탐색·clip·`applyPaintTransform`·bounds getter는 외부 관측을 포함하며, private TypeScript 선언만으로 고정 native layout을 보장하지 않는다. Element·RenderObject·Focus의 public getter/override/callback을 생략할 근거도 없다. 따라서 **C로 승격할 충분히 크고 닫힌 새 구역은 확인하지 못했다.** 큐의 scalar factory를 다시 확대하거나 기존 numeric service를 새 구현으로 세지 않았다.

### 12.2 추가 VM 가설: accessor 탐색과 getter 재진입

pinned Hermes의 `GetById` slow path는 `getNamedWithReceiver_RJS`에서 descriptor를 탐색하고, getter를 `executeCall0`으로 실행한다. 이 호출은 인터프리터에 재진입한다. 기존 read cache는 data slot 위주이며 accessor는 같은 경로를 반복한다. 가능한 해법은 accessor 탐색 cache 또는 일반 bytecode call frame으로의 getter dispatch다. 후자는 반환 명령 위치·예외 unwind·GC root·lazy/JIT·debugger 계약까지 영향을 주므로 호출량만으로 구현하지 않았다.

[제한된 native 계측](Nelyx/sdk/tooling/cli/src/windows-hermes-property-profile.mjs)을 정규 supplier에 연결했다. `NELYX_HERMES_PROPERTY_PROFILE=1`, `NELYX_NATIVE_CPU_PROFILE=1`, `NELYX_JANK_REPRESENTATION_PROFILE=1`을 함께 요구하며 descriptor 진단과 동시에 켜지지 않는다. supplier producer·source-tree·출력 identity에 계측 여부를 포함했다. 기본 모드에서는 C++ patch 자체를 제거한다.

측정 범위는 위 named-property 함수다. 임의 computed/super/descriptor API를 포함한 모든 JS property read의 총량으로 확대하지 않는다. cache 자격은 기존 data cache와 같은 own 또는 바로 위 prototype, slot 범위, dictionary 제외 조건과 실제 cache entry 유무로 제한했다. getter gateway는 중첩 인터프리터의 첫 loop 진입부터 반환/예외 종료까지를 빼므로 getter 본체·callee·그 안의 GC 시간을 포함하지 않는다. native stack scope만 연결하고 JS 객체를 보관하지 않는다. 남는 시간도 clock·계측·스케줄링·loop 밖 GC 등이 포함될 수 있는 wall-time 상한이며 제거 가능한 순수 CPU로 간주하지 않는다.

실제 진단 VM의 첫 화면 전 fixture는 getter receiver, 중첩 호출과 같은 오류 객체의 전달을 통과했다. getter/해석된 loop 호출 **3/3개**, 순서 `outer,nested,failing`이다. 이후 같은 달력 workload의 진단 1회를 실행했다.

| 구간 | 긴 프레임 / CPU ms | named lookup / cache 자격 accessor | 자격 탐색 상한 ms / CPU 대비 | getter gateway 상한 ms / CPU 대비 | 두 상한 합 / CPU 대비 |
| --- | --- | --- | --- | --- | --- |
| 보통 정방향 | 8 / 1109.375 | 3,209,117 / 822,808 | 28.207 / 2.543% | 107.857 / 9.722% | 12.265% |
| 빠른 정방향 | 6 / 1000 | 2,952,765 / 721,780 | 23.478 / 2.348% | 94.950 / 9.495% | 11.843% |
| 역방향 | 8 / 1578.125 | 4,416,315 / 1,073,843 | 36.886 / 2.337% | 147.504 / 9.347% | 11.684% |

getter 호출/해석된 loop 호출은 각각 **1,547,957/1,530,877**, **1,395,390/1,380,031**, **2,096,534/2,074,292**다. loop가 확인되지 않은 native 등의 getter를 gateway 시간에 임의로 포함하지 않았다. 새 날짜가 포함된 긴 프레임의 합산 비율은 11.883/11.206/10.699%, 기존 날짜 구간은 13.479/13.471/13.910%다. 날짜 분류는 `_Day`의 첫 rebuild 관측 기준이며 정확한 월 root 생성 수가 아니다.

모든 named descriptor 탐색의 상한은 135.751/119.367/205.049ms지만, data·깊은 prototype·cache 불가 경로가 섞여 있다. 이를 accessor cache가 모두 제거할 비용에 더하지 않는다. clock pair 평균/최장은 **0.0000242/0.000100ms**, 비용은 측정치에서 차감하지 않았다. 수백만 번의 clock·scope가 실행되므로 계측 교란이 있으며 진단 FPS를 일반 VM 기준선과 비교하지 않는다. 이 실행의 supplier는 `ab48fbbb…`, HBC는 `03522341…`, `performanceSample=false`다. 표본 미해결 1/2/4개는 native 시간 집계와 별개다.

계측이 프레임 길이와 CPU 분모도 바꾸므로 위 비율을 일반 VM의 엄밀한 비용 상한으로 부르지 않는다. **이 추가 VM 가설도 실제 제거 가능한 비용이 15% 이상이라는 근거를 확보하지 못해 보류한다.** 그 비율은 미확정이며, 두 계측 상한을 함께 전부 없앤다는 가정도 순이익 증명이 아니다. 작은 accessor cache와 큰 호출 구조 변경을 묶어 성능 개선으로 제출하지 않았다. A/B 보류와 C의 조건부 상태를 유지한다.

### 12.3 복원과 후속 검증

진단을 소유한 실행의 `finally`에서 정규 supplier와 Demo prepared inputs를 복원했다. `propertyProfile=false`, `descriptorProfile=false`이며 `JSObject.cpp`·`Interpreter.cpp`·`Object.cpp`의 계측 marker와 VM DLL의 두 진단 export가 없다. Source tree는 §11과 정확히 같은 `2cdd4ce7…`다. 최종 supplier는 `003eba84…`, 재링크 VM은 `6705e10d…`이며 최초 기준선과 binary가 다르므로 새 binary의 FPS를 측정했다고 하지 않는다.

README의 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`으로 일반 패키지를 정규 재생성해 첫 프레임·exit 0·`forced=false`를 확인했다. host는 `2d40eea6…`, 일반 HBC는 앞선 제품과 같은 `a3fb0dd8…`다. 974×929/DPI 192/165Hz의 유한 실행이며 달력 최대화 FPS 표본이 아니다. 제품 manifest는 `experimental`, `performanceAccepted=false`, diagnostic entry 없음이고 파일 inventory 검증이 PASS다. native JSI 직접 실행이며 RN runtime/Node-API JSI 혼입이 없다.

설치된 Windows SDK 10개 패키지의 package identity와 workspace가 일치하고 Source-input 검사가 PASS다. 최종 SDK/CLI identity는 `6bcd6406…`/`e1e25a98…`, 설치 aggregate는 `b97b528b…`다. renderer·supplier를 포함한 제품 composite `be73adf5…`가 제품 manifest와 일치한다. Core/Material Source와 기존 dist identity는 유지됐다. 분석 fixture의 함수 귀속·중첩·GC 분리·시계/범위 오류·property coverage 검증, native patch의 반복 적용·정확한 복원·flag 자격, 관련 lint/format과 CLI 선언 타입 검사가 PASS다. 진단 VM과 일반 VM의 C++ compile/link 및 위 getter fixture도 PASS다.

달력은 이번 계속 작업에서 진단 2회, 앞선 기준선·진단을 합해 **총 7회**다. batch는 1,200,000ms timeout으로 제한했고 진단 실패 여부와 무관하게 정규 공급을 복원하도록 했다. 소유한 process·diagnostic entry/package·임시 source-check·build/replace/supply staging을 회수했고 `.tmp`의 기존 네 파일을 보존했다. SDK/CLI archive는 현재 1개씩이며 raw trace·log·receipt·history나 별도 SDK 사본을 보관하지 않았다. 변경은 커밋하지 않았다.

최종 변경은 명시적 진단과 분석·회귀 fixture다. 새로운 최적화 후보의 3회 비교, Gallery·Testbed·Web 전체 회귀·장시간 자원 수락을 수행했다고 주장하지 않는다. 후속 구현에는 비용이 충분히 크고 외부 관측 계약을 닫을 수 있는 새 공통 구역의 근거가 필요하다. 현재 근거로 H3-02·03이나 C를 강행하지 않는다. **30fps·정체·입력 지연의 제품 성능 수락은 여전히 PARTIAL / performanceAccepted=false**다.

**선별 작업은 여기서 종료한다. A/B 최적화 미채택 / 30fps 제품 목표 미달 / PARTIAL / performanceAccepted=false.**

다음 전략의 설계와 적용 대상 선정은 [work4.md](work4.md)에 기록했다.
