# 공통 Semantics 형제 충돌 판정의 비교량 줄이기

작성일: 2026-11-17

상태: **H4-00 선별 종료·후보 보류 / H4-01~03 조건부 미착수 / PARTIAL / performanceAccepted=false**

후속 상태: **큰 구조 변경 검토 및 S0 동기 계약 fixture·준비 프레임 자격 검사 구현 / 세대 격리·S1~4 미구현**. §10은 기존 형제 충돌 인덱스의 재개가 아닌 별도 구조안이며, 이후 구현은 §11에 기록한다. 과거 실행 판정은 그대로 유지한다.

남은 구현·검증·최종 공급의 전체 실행 순서와 완료 기준은 [work5.md](work5.md)에 통합했다. 이 문서의 설계·실행 이력과 구분한다.

다음 적용 대상은 공통 `_RenderObjectSemantics.markConflicts`의 형제 간 호환성 판정이다. 같은 그룹에서 이전 형제를 모두 다시 비교하는 작업을, 자격이 증명된 기본 구성에 한해 **그룹 단위의 충돌 인덱스**로 대체한다. Widget·Element·State의 수명과 날짜별 Focus·Ink·접근성은 유지한다. 첫 구현 전에는 실제 그룹 크기와 비용, 안전하게 처리할 수 있는 비율을 확인한다.

[work3.md](work3.md)의 A/B 및 getter VM 선별은 종료된 결과로 보존한다. 이번 사용자의 선택은 **새 성능 전략 설계 및 적용 대상 선정**이다. 이 문서는 그 범위를 수행한 설계이며, 제품 코드 변경이나 성능 개선의 실행 결과를 뜻하지 않는다. 코드 검토 기준은 HEAD `f4ceea9d`와 현재 미커밋 작업 트리다.

§1–8은 구현 전 설계다. 이후 사용자의 **“다음단계 전체 진행해줘”** 요청에 따른 실행 결과와 조건부 중단 판정은 §9에 기록한다.

## 1. 선택한 전략과 적용 경로

앞선 선별에서 WidgetState 집합과 descriptor 변환의 비용 규모는 구현을 정당화하지 못했다. getter 계측도 일반 VM의 제거 가능 비용을 확정하지 못했다. 이번에는 개별 연산의 실행 방식을 바꾸는 대신, 동일한 결과를 위해 수행하는 **형제 간 비교의 수**를 줄인다.

[updateChildren](Nelyx/src/framework/rendering/semantics-pipeline.ts#L331)는 다음 순서로 접근성 fragment를 조립한다.

```text
자식 configuration과 parent data 준비
  → collectChildren
  → mergeUp 그룹의 markConflicts
  → siblingMergeGroups별 markConflicts
  → configuration 흡수
  → semantics node·geometry 조립과 게시
```

[markConflicts](Nelyx/src/framework/rendering/semantics-pipeline.ts#L837)는 현재 fragment의 이전 충돌을 해제한 뒤 `configToMergeUp`을 얻는다. 구성 값이 null이 아니면 이전 위치 전부에 `isCompatibleWith`를 호출한다. `mergeUp`에서는 부모와의 비교도 수행한다. 모든 판정 뒤에 충돌 Set의 순서대로 flag와 build 상태를 적용한다.

구성 값이 모두 존재하는 크기 n의 그룹은 형제 비교를 **n(n−1)/2회** 수행한다. n=32/64/128이면 496/2,016/8,128회다. null 구성은 해당 위치의 내부 루프를 생략하므로 실제 횟수는 작을 수 있다. **현재 달력에 이 크기의 그룹이 얼마나 있는지는 아직 측정하지 않았다.** 중첩 루프가 존재한다는 사실로 달력 전체가 O(n²)이거나 이 구역이 주 병목이라고 결론내리지 않는다.

이 경로는 일반 버튼·복합 접근성 subtree에도 공통이다. 날짜 생성 코드나 달력별 UI 구성은 첫 변경 대상에 넣지 않는다.

## 2. 다른 방향과의 비교

| 방향 | 코드에서 확인한 제약 | 선택 |
| --- | --- | --- |
| 형제 충돌을 그룹 단위로 계획 | 비교 규칙의 상당 부분이 action/flag/presence 같은 유한 상태다. 기본 구성과 custom 관측의 경계를 닫아야 한다 | **첫 비용 선별 대상** |
| Element·layout 전체를 typed object graph로 전환 | public property·virtual method·builder가 촘촘히 연결돼 있고 기존 owned factory는 private scalar만 증명한다 | 이번 첫 구현에서 제외 |
| JS와 독립적으로 native scroll/동기 생산을 분할 | 입력 geometry·semantics·content 세대와 lifecycle 시점의 소유권을 바꾸며 신규 콘텐츠의 생산 비용도 남는다 | 별도 구조 변경 과제 |
| debug 정책을 release로 변경 | [FoundationBuildMode](Nelyx/src/foundation/constants.ts#L7)는 이미 기본 release다 | 설정 누락으로 취급하지 않음 |
| 기존 flag word·numeric geometry를 다시 추가 | [31-bit flag 표현](Nelyx/src/ui/semantics.ts#L272)과 geometry service가 이미 존재한다 | 기존 구현을 재사용 |

이 선택은 **알고리즘과 적용 경계가 구체적인 다음 조사 대상**이라는 뜻이다. 비용 선별과 관측 보존 증명에 앞서 최적화 채택을 결정한 것은 아니다. 이번에도 하나의 대상만 다루며, 통과하지 못하면 후보 목록을 늘려 작은 변경을 누적하지 않는다.

## 3. 호환성 규칙을 유지하는 방법

[isCompatibleWith](Nelyx/src/framework/semantics/semantics.ts#L2603)의 현재 순서를 기준으로 한다. 판정은 단순한 동치 관계가 아니다.

| 순서 | 판정 | 인덱스 설계에 필요한 정보 |
| --- | --- | --- |
| 1 | 상대가 null 또는 미주석이면 호환 | 이전 위치의 null·annotated 여부 |
| 2 | traversal child identifier가 다르면 충돌 | `valueEquals`의 방향과 관측 |
| 3 | 현재 구성이 미주석이면 호환 | 현재 annotated 여부 |
| 4 | action bit 겹침 또는 flag 충돌 | action mask와 기존 31-bit flag word |
| 5 | platform view·max/current value length가 양쪽 모두 존재하면 충돌 | 각 필드의 null 여부 |
| 6 | attributed value가 양쪽 모두 비어 있지 않으면 충돌 | 검증된 string의 nonempty 여부 |
| 7 | subtree locale 차이 또는 양쪽 explicit role이면 충돌 | locale 관계와 explicit role |
| 8 | 어느 쪽이든 hit test가 defer가 아니면 충돌 | 현재/이전 non-defer 여부 |
| 9 | min/max value가 양쪽 모두 존재하면 충돌 | 각 필드의 null 여부 |

[semanticsFlagWordsConflict](Nelyx/src/ui/semantics.ts#L593)는 이미 scalar 판정을 제공한다. boolean bit의 공통 설정, bit 14의 차이, 일곱 2-bit 필드의 양쪽 nonzero 조건을 그대로 사용한다. 새로운 flag 의미나 기존 engine legacy mask로 치환하지 않는다.

예를 들어 다른 조건이 모두 호환이고 action mask가 A=1, B=2, C=3이면 A와 B는 호환되지만 C는 둘과 충돌한다. 대표 하나와 비교하거나 union-find로 동치 그룹을 만드는 방식은 사용할 수 없다. 기존 루프의 충돌 Set 삽입 순서는 **C, A, B**이며 최종 상태만 같게 만드는 것도 충분하지 않다.

또한 `other.hasBeenAnnotated`가 먼저 검사되므로 두 인자를 바꿔 같은 답이 나온다고 가정하지 않는다. 부모 비교는 `parent.isCompatibleWith(current)`, 형제 비교는 `current.isCompatibleWith(previous)` 방향이다.

## 4. 첫 fast path의 자격

한 그룹을 처리하기 전에 **외부 코드를 실행하지 않는 자격 검사**를 마친다. 하나라도 증명하지 못하면 상태 변경 전에 기존 전체 루프로 보낸다. 사용자 getter를 먼저 실행해 자격을 조사한 뒤 원래 경로에서 다시 실행하는 방식은 제외한다.

첫 범위는 다음 조건을 모두 만족하는 기본 fragment·구성으로 제한한다.

1. Core가 만든 ordinary 그룹 배열·fragment·configuration·필요한 RenderObject임을 소유 증거로 확인한다. `instanceof`, TypeScript private, 같은 prototype만으로 Proxy 부재를 추정하지 않는다. 필요한 module-private WeakSet 등의 constructor 등록 비용도 후보 비용에 포함한다. Proxy는 brand 조회에서 탈락시켜 descriptor/prototype 조사 trap을 새로 호출하지 않는다.
2. `configToMergeUp`, `shouldFormSemanticsNode`, parent 조회와 configuration 판정이 의존하는 기본 method/getter 및 자체 data field를 확인한다. 사용자 override·자체 accessor·변경된 prototype·custom fragment는 기존 루프를 사용한다.
3. [configuration provider](Nelyx/src/framework/rendering/semantics-pipeline.ts#L94)의 필요한 original/effective 구성이 이미 준비돼 있어야 한다. 판정 도중 `describeSemanticsConfiguration`이나 delegate를 실행해야 하는 그룹은 제외한다. `collectChildren`이 하위 구성을 먼저 처리하는 현재 순서는 이 자격의 후보 근거이며, 모든 그룹의 보장은 아니다.
4. identifier와 subtree locale은 그룹 및 필요한 부모에서 **같은 identity인 경우**부터 지원한다. [valueEquals](Nelyx/src/framework/painting/value-equality.ts#L3)는 `===` 실패 뒤 사용자 `equals`를 조회한다. primitive라는 이유만으로 그 관측을 생략하지 않는다. 서로 다른 Locale의 코드 문자열 정규화나 임의 identifier hashing은 첫 구현에 넣지 않는다.
5. action/flag 상태와 null/presence·문자열을 읽는 필드는 primitive 또는 검증된 own data다. `_flagsWord === null`인 custom flags 경로는 제외한다. [AttributedString](Nelyx/src/framework/semantics/attributed-string.ts#L10)의 `.string`도 accessor로 바뀐 객체를 허용하지 않는다.
6. `_hasExplicitRole`의 platform-dependent header 경로 등 외부 상태 관측이 남으면 제외한다. 기존 getter를 단 한 번 호출하는 것으로 반복 관측 보존을 대신하지 않는다.
7. 그룹 내 fragment identity 중복, 미지원 상태, index overflow와 자격 검사의 불확실성은 기존 루프를 사용한다. 설정 객체 identity가 같더라도 서로 다른 fragment를 하나로 합치지 않는다.

[기존 `_nativeMergeConfiguration`](Nelyx/src/framework/semantics/semantics.ts#L2584)의 네 필드만으로 전체 호환성을 표현할 수 없다. 그 메서드를 호출했다고 위 자격이 증명되는 것도 아니다. 새 판정 경계는 필요한 정보를 모두 다루되 public API를 확대하지 않는 Core 내부 경로로 둔다.

자격 검사·소유 증거가 달력의 대부분을 fallback으로 만들거나 비용을 상쇄하면 이 설계도 중단한다. 자격을 넓히기 위해 custom callback·Proxy·GlobalKey의 동작을 제한하지 않는다.

## 5. 그룹 단위 충돌 인덱스

자격이 확인된 그룹에서만 기존 i 순서대로 이전 충돌 해제와 구성 선택을 수행한다. 순수 계산 구역에는 fragment나 configuration 객체 대신 **위치와 검증된 primitive 기록**을 전달한다. 외부 method·getter·callback은 그 구역에 넣지 않는다.

각 action bit·flag 조건·exclusive field 등에 대해 두 종류의 상태를 유지한다.

- **전체 이전 기록의 존재/count**: 이미 충돌 처리된 형제라도 새 fragment와 충돌하는지 판정하는 데 필요하다.
- **아직 충돌 Set에 들어가지 않은 이전 위치**: 새로 표시해야 하는 형제만 회수한다. 하나의 위치가 처음 표시되면 소속된 모든 미표시 bucket에서 제거한다.

현재 위치가 충돌하는 조건들의 count로 충돌 존재를 판단하고, 해당 미표시 bucket에서 새 이전 위치들을 모은다. 새 위치는 기존 j 오름차순으로 정렬해 적용한다. 부모 충돌은 원래 위치에서 먼저 반영하고, 형제 충돌이 있으면 **현재 fragment를 먼저, 이후 새 이전 fragment들을 원래 순서대로** 충돌 Set에 삽입한다. 현재 위치의 기록은 이전 위치들과의 판정이 끝난 뒤 전체 count에 등록하며, 아직 충돌 Set에 없을 때만 미표시 bucket에도 등록한다. 자기 자신을 이전 형제로 비교하거나 이미 표시된 현재 위치를 다시 후보로 남기지 않는다. 마지막 `markSiblingConfigurationConflict(true)`·`markNeedsBuild` 및 previous 충돌 해제의 적용 순서도 유지한다.

bucket에 이미 표시된 위치를 남겨 매번 다시 훑으면 O(n²)이 남는다. 구현은 다중 bucket에서 제거할 위치를 직접 찾는 bookkeeping을 포함해야 한다. K를 고정 판정 조건 수라고 할 때 목표는 O(Kn)의 인덱스 처리와 새로 표시되는 위치의 순서 정리다. 정렬·메모리 초기화·자격 검사까지 포함한 실제 비용으로 판단한다. 무조건 O(n)이라고 표기하지 않는다.

기록·bucket·위치 배열은 현재 그룹의 처리 수명으로 제한한다. 최악의 임시 공간은 O(Kn)이며 작은 그룹에서 기존 루프보다 비쌀 수 있다. 전역 configuration cache, Widget/Element 보존, 월 prewarm을 추가하지 않는다. 적용 임계값은 실제 그룹 분포와 pinned Hermes의 전체 호출 비용으로 정한다.

Source 알고리즘을 먼저 유지해 Hermes bytecode와 Web에서 같은 결과를 낸다. 닫힌 계산 구역을 이후 typed AOT로 옮길 필요가 생겨도 독립 C++ 알고리즘을 복제하지 않는다. 현재 `owned-state-v1`이 숫자 record/배열 전체를 typed로 증명한다고 가정하지 않으며, 해당 lowering 확장은 별도 판단이다. **이번 첫 범위에 VM patch나 새 native service는 없다.**

## 6. 구현 전 비용 선별

다음 실행 작업의 첫 항목은 **H4-00: 원래 루프의 실제 규모와 자격 비용 확인**이다. 먼저 위 자격을 코드로 증명하고 제한된 diagnostic에서만 연결한다. 새 최적화 구현부터 시작하지 않는다.

비용 확인은 모든 그룹의 외곽 합부터 시작할 수 있다. callback·부모 비교·충돌 적용까지 포함한 전체 구역도 선별선보다 충분히 작으면, 자격을 통과한 일부 그룹의 제거 가능 비용은 더 작다. 이 경우 자격 검사·record 구현과 상세 비교 계수를 추가하지 않고 H4-00에서 보류한다. 전체 상한이 충분히 클 때 아래 세부 분해로 진행한다.

기존 달력 실행기와 frame clock을 재사용해 다음을 한 번에 집계한다.

- 긴 Source 프레임별 그룹 수·크기 분포·최대 크기, mergeUp/sibling 구분.
- 기존 코드에서 실제 실행한 부모/형제 비교 수와 null 구성 수. 계수를 얻기 위해 getter나 비교를 추가 호출하지 않는다.
- 전체 그룹과 자격 통과 그룹의 외곽 구간 시간, 자격 검사·record 준비 비용. 중첩은 union 기준이며 callback을 포함하는 시간은 제거 가능 시간으로 단정하지 않는다.
- 새 날짜 포함/기존 날짜 rebuild 구간, runtime thread CPU와 elapsed, fallback 사유별 작업량.

**작은 비교마다 clock을 읽지 않는다.** 그룹 또는 frame 외곽만 계측하고 실제 비교문에는 필요한 counter만 둔다. 원칙적으로 진단 1회, 측정 경계 보완 1회까지다. 진단의 FPS는 성능 수락 표본으로 사용하지 않는다.

구현 진입에는 자격 통과한 구역이 긴 프레임 runtime-thread busy time의 대략 **15% 이상**이라는 근거와, 그중 줄일 수 있는 반복 작업의 확인이 필요하다. 작은 그룹뿐이거나 비용·자격이 작거나 계측 교란 때문에 판단할 수 없으면 **H4-00에서 보류하고 종료**한다. 다른 Semantics 구역이나 전체 AOT로 자동 확장하지 않는다.

## 7. 구현과 검증 순서

### H4-01 관측 보존과 Source 알고리즘

비용 선별을 통과했을 때 내부 primitive 판정기와 Source 연결을 한 묶음으로 구현한다. 기존 루프를 control/fallback으로 유지하고 구현한 명시적 실험 선택으로 비교한다. 아직 존재하지 않는 선택 flag나 CLI 명령이 있다고 가정하지 않는다.

필요한 회귀는 다음으로 한정한다.

- 기본/미주석/null 구성과 부모 비교 방향, action overlap, 각 flag 충돌, role·value·hit test 조건.
- 호환성이 비추이적인 A/B/C와 충돌 Set의 삽입 순서, 이전 충돌 해제·build 적용 순서.
- custom method/getter·identifier equals·Locale·delegate·Proxy·자체 field descriptor 변경의 fallback과 호출·오류·receiver 순서.
- 자격 검사 뒤 비교 도중 외부 코드가 실행되지 않는 증명. 비교 뒤 build 적용에서 생기는 예외의 원래 부분 적용과 후속 재시도.
- 다른 fragment가 같은 configuration을 공유하는 경우, identity 중복 그룹, 작은 그룹과 큰 그룹, 임시 상태 회수.

기존 semantics Source 회귀에 집중 사례를 추가하고, 실제 pinned Hermes에서도 동일 결과와 관측 순서를 확인한다. Source/Flutter 이식 소유권 기록이 닿는 부분은 [생성·출처 규칙](tools/Nelyx.FrameworkToTypeScript/README.md)에 맞춰 갱신한다. generic public `isCompatibleWith`의 의미를 교체하거나 생성 날짜 코드를 직접 수정하지 않는다.

### H4-02 준비 비용을 포함한 순이익

자격 판정·constructor의 소유 등록·record/bucket 할당·정리·GC·작은 그룹 fallback을 포함해 control과 비교한다. predicate만의 microbenchmark나 비교 횟수 감소만으로 통과시키지 않는다. 순이익이 없으면 제품 공급 확대 전에 철회한다.

### H4-03 같은 조건의 제품 비교

현재 정규 공급을 확인하고 진단을 끈 **기준선 3회 + 후보 3회**를 비교한다. work3의 과거 binary/FPS를 새 기준선으로 복사하지 않는다. Hermes bytecode + TDZ pruning off, VM·renderer·viewport/DPI/refresh·입력 조건을 고정한다. 의도한 Source/실험 선택 차이와 공급 hash를 기록하고 SDK 전체 사본 없이 정규 절차로 현재 출력을 교체한다.

수락은 [work3의 기준](work3.md#L212)을 유지한다. 세 phase 모두 유효 3회 각각 engine FPS와 관측 표시 FPS 하한 30 이상, phase별 ≥100ms 정체 감소·횟수/최장 비증가, 입력 지연 p95 중앙값 비악화와 나머지 지연 분포를 함께 확인한다. touch 48/30/60개, gesture 6/6/12회, 월 이동 +4/+3/−6과 수신=전달=수락·거부 0을 유지한다.

semantics tree·action·순서·UIA·focus·geometry와 resize/복귀/종료를 확인하고, 닿는 버튼·Ink·편집·Gallery·가변 목록·Testbed·Web을 검증한다. 화면 reader·물리 trackpad·scanout·장시간 누수는 별도 수락 범위다. 국소 이득만 남으면 PARTIAL로 기록하고 기본 채택을 분리한다.

## 8. 실행 예산과 현재 산출물

테스트·검증 batch는 20분 timeout을 사용한다. 진단 최대 2회, 이후 조건을 통과하면 기준선/후보 각 3회와 필요한 기능 회귀를 수행하며, 전체 시나리오는 실패·보완을 포함해 원칙적으로 30회 이내다. timeout과 주입/foreground 실패를 정상 성능 표본으로 바꾸지 않는다.

임시 entry/package·자료·정확히 소유한 process는 성공·실패·중단의 finally에서 정리한다. 현재 dist·현재 공급만 남기고 raw log/trace·receipt·history JSON·과거 SDK 사본을 누적하지 않는다. 결과는 이 문서에 조건·짧은 표·판정·남은 범위만 기록한다.

이번 요청의 산출물은 이 설계와 첫 비용 선별 대상의 선정이다. 기존 제품 Source·dist·설치 공급·기본값은 변경하지 않았다. **다음 실행은 H4-00이며, 큰 자격 구역이 확인되기 전에는 H4-01 구현이나 typed AOT로 넘어가지 않는다.** 전체 성능 상태는 `PARTIAL / performanceAccepted=false`를 유지한다.

## 9. 2026-11-17 전체 진행 요청의 실행 결과

### H4-00 모든 그룹의 비용 상한으로 보류

기존 모든 `markConflicts` 구역은 자격 통과 그룹과 실제 제거 가능한 비교를 포함한다. 따라서 전체 비용부터 측정해 구현 투자 여부를 판정했다. Core의 판정 알고리즘·생성자·소유 증거·public exports는 변경하지 않았다.

[진단 helper](Nelyx/eng/windows-jank-semantics-conflict-profile.mjs)는 설치된 동일 Core 내부 모듈의 method descriptor를 임시로 감싸고, 활성 Source frame 안의 호출 외곽만 계측한다. group·fragment·configuration을 읽지 않으며 원래 receiver·인자를 전달한다. 중첩 호출은 가장 바깥 구간 한 번만 시간에 더한다. 예외는 그대로 전달하며 종료 시 원래 descriptor를 복원한다. 그룹 크기를 얻기 위해 `length`, getter나 호환성 판정을 추가 호출하지 않았다.

`NELYX_JANK_SEMANTICS_CONFLICT_PROFILE=1`은 기존 representation CPU 진단과 함께 달력 bytecode에서만 사용한다. native property/descriptor 계측과 함께 쓰지 않는다. 작은 비교마다 clock을 읽거나 제품 기본 경로에 observer 분기를 추가하지 않았다. Source frame의 기존 CPU/steady clock과 새 날짜 관측을 재사용했다.

첫 준비 시도는 비공개 모듈을 공개 export 경로로 불러와 bundle 단계에서 거절됐다. 진단 import를 설치된 Core 내부 파일로 고쳤고 임시 파일은 finally에서 회수했다. 이 실패는 FPS 또는 유효 진단 표본에 포함하지 않는다. 이후 진단 **1회**가 완료됐다.

| 구간 | 긴 프레임 / thread CPU ms | 그룹 호출 | 모든 그룹 외곽 합 ms | CPU 대비 진단 비율 | 가장 긴 단일 그룹 ms |
| --- | --- | --- | --- | --- | --- |
| 보통 정방향 | 8 / 875 | 1,326 | 20.868 | 2.385% | 1.987 |
| 빠른 정방향 | 5 / 640.625 | 931 | 13.206 | 2.061% | 1.471 |
| 역방향 | 8 / 1031.25 | 1,481 | 24.997 | 2.424% | 1.932 |

긴 프레임별 비율의 최댓값도 각각 **3.988/3.375/3.199%**였다. 새 날짜가 포함된 긴 프레임 집계는 **1.875/1.836/2.264%**, 기존 날짜 구간은 **3.234/3.375/3.017%**다. 날짜 분류는 기존 `_Day` 첫 rebuild 관측 기준이며 월 root 생성 수가 아니다. 관측한 호출은 모두 `mergeUp=true` 경로이고 별도 sibling-group·중첩·실패 호출은 0이다. 이것을 화면에 형제가 없다는 뜻으로 해석하지 않는다.

위 외곽에는 부모 비교·이전 상태 처리·충돌 Set 적용·관련 callback과 계측 비용이 포함된다. 순수 비교 CPU나 인덱스의 이득이 아니다. clock pair 교정 평균/최장은 **0.000394/0.001300ms**이고 비용을 차감하지 않았다. runtime CPU의 측정 해상도와 계측 교란도 있으므로 일반 제품의 정확한 CPU 비율로 옮기지 않는다. 전체 구역과 프레임별 상한 모두 15% 선별선과 충분한 차이가 있어, 자격이 제한된 일부 비교만으로 선별선을 통과할 근거가 없다.

**H4-00에서 후보를 보류하고 종료한다.** 자격 통과 비율·record 준비 비용·그룹 크기 분포·비교 횟수는 후속 상세 측정으로 진행하지 않았다. 비용이 작은 전체 구역을 확인한 뒤 그 하위 구역을 구현하기 위해 소유 WeakSet이나 callback guard를 제품에 추가하지 않는다. H4-01의 인덱스 구현, H4-02 순이익 비교, H4-03 후보 3회·공통 회귀는 조건부 미착수다. 다른 구역이나 typed AOT로 자동 확장하지 않는다.

### 실행 경계와 진단 검증

정규 Hermes bytecode supplier `003eba84…`, VM source tree `2cdd4ce7…`, 설치 SDK aggregate `b97b528b…`를 확인했고 Core/SDK/CLI의 Source-input·설치 package identity가 일치했다. native descriptor/property 계측은 둘 다 false다. 이번에는 VM·SDK 공급을 바꾸지 않았다. renderer `c072724c…`, host source `14ce0f7c…`, 진단 entry `0e3381c0…`, HBC `b6084505…`다.

실행은 2560×1459/DPI 192/165Hz, 기존 60Hz touch **48/30/60개**, gesture **6/6/12회**, 월 이동 **+4/+3/−6** 조건이다. 입력 **158개 수신=전달=수락, 거부 0**, 월 정착·UIA·geometry·exit 0을 확인했다. `performanceSample=false`, 표시 관측 off이며 이 진단의 FPS는 기준선/후보 성능 수락에 쓰지 않는다. source-map 미해결은 긴 프레임에서 0/0/3개이며 method 외곽 시간은 symbolication과 독립적이다.

[분석 fixture](Nelyx/eng/check-semantics-conflict-profile.mjs)는 중첩 시간 union, Proxy 읽기·receiver·오류 객체 보존, frame 합산·불완전 coverage 거절, 잘못된 clock, descriptor 복원과 중단 정리를 통과했다. 기존 representation fixture와 관련 lint/format도 PASS다. 이는 인덱스 알고리즘이나 H4-01의 전체 custom semantics 회귀를 실행했다는 뜻은 아니다.

모든 진단 flag를 끄고 README의 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`을 실행했다. 기존 정규 패키지의 첫 프레임·exit 0·`forced=false`를 확인했다. host `2d40eea6…`, VM `6705e10d…`, 일반 HBC `a3fb0dd8…`는 이전 일반 제품과 동일하며 RN runtime/Node-API JSI 혼입이 없다. 이 974×929/DPI 192/165Hz의 유한 실행은 달력 성능 수락이 아니다.

최종 일반 package의 파일 inventory·`experimental` 자격·diagnostic entry 없음, supplier·설치 SDK aggregate와 workspace package identity를 재확인했다. 소유 native process·진단 entry/package·임시 build/replace/source-check/supply staging·supplier lock이 남지 않았다. `.tmp`의 기존 네 파일을 보존했고 raw log/trace·receipt·history·이전 SDK 사본을 추가하지 않았다. 남긴 변경은 명시적 진단 helper·분석·회귀 fixture와 이 기록이며, 기존 미커밋 변경을 보존했다. 변경은 커밋하지 않았다.

이번 달력 실행 시도는 **2회: bundle 준비 실패 1회 + 완료 진단 1회**다. 각 검증 batch는 1,200,000ms timeout을 사용했다. 문서 링크와 `git diff --check`도 PASS다. 요청된 순서는 H4-00의 중단 조건까지 실행했으며, 전체 성능은 **PARTIAL / performanceAccepted=false**다.

## 10. 큰 구조 변경 검토 — 분할 생산과 원자적 게시

### 10.1 범위와 결정

`046f93d8`에서 현재 동기 build/layout, 입력과 게시 경계를 조사하고 Hermes sampling 진단을 1회 실행했다. 결과는 [work3 §13](work3.md#13-큰-구조-변경-선택-후의-재검토--2026-11-17)에 분리했다. 사용자는 **큰 구조 변경 검토**를 선택했다. 기존 H3/H4의 작은 후보를 다시 구현하거나 15% 투자 선별선을 낮추는 요청으로 해석하지 않는다.

검토 결론은 **새 콘텐츠 생산의 작업 단위를 나누는 것과 미완성 콘텐츠의 비노출을 함께 설계해야 한다**는 것이다. 첫 구조안은 명시적 opt-in의 분할 생산·원자적 게시다. native 독립 스크롤, 월 보존량 확대, 입력 생략과 전체 AOT 전환은 이 구조안에 섞지 않는다. 아래 명칭은 설계용이며 현재 존재하는 API·flag가 아니다.

### 10.2 현재 경계와 바꿔야 할 경계

| 현재 구현 | 단순 변경이 실패하는 이유 | 필요한 새 경계 |
| --- | --- | --- |
| [BuildScope와 BuildOwner](Nelyx/src/framework/widgets/framework.ts)는 dirty 큐와 owner commit을 동기 완결 | 큐에서 임의로 반환하면 호출자는 scope가 끝난 것으로 진행한다. layout-time build는 별도로 남는다 | `pending/ready/failed`를 구분하는 명시적 생산 결과, 재개 위치와 소유 scope |
| [sliver createChild](Nelyx/src/framework/widgets/sliver.ts)와 [grid layout](Nelyx/src/framework/rendering/sliver-grid.ts)은 자식 생성 뒤 즉시 geometry를 사용 | layout 도중 `await`나 제어용 예외를 넣으면 상위 stack·parent data·실행한 callback을 복원하지 못한다 | 자식 요구/대기/재개의 명시적 상태와, 완료 전 geometry를 읽지 않는 부모 프로토콜 |
| [FrameworkRoot](Nelyx/src/framework/widgets/root.ts)는 live render tree로 paint·hit test·focus·입력 geometry·semantics를 처리 | paint만 이전 화면으로 유지해도 hit target과 State는 새 상태일 수 있다 | 동일 게시 세대를 참조하는 입력 target·geometry·semantics·paint의 소유권 |
| [View runtime](Nelyx/src/hosting/runtime.ts)은 scene을 동기 호출하고 frame lease를 획득 | scene 반환 타입만 Promise로 바꿔서는 frame credit·강제 geometry·close·자원 회수를 보존하지 못한다 | 생산 중인 작업과 게시 가능한 CPU frame의 별도 수명, credit 및 취소 계약 |
| [선택 작업 예산](Nelyx/src/framework/widgets/view-work-budget.ts)은 2ms 이하로 추정한 원자 항목 하나를 실행 | 월 생산 전체를 나누지 못한다. 한도 상향은 stall의 이동일 뿐이다 | 원자 항목 사이에만 yield하는 continuation과 실제 slice 비용 관측 |

따라서 **BuildScope의 while 루프에 deadline 검사 하나를 넣는 patch는 채택하지 않는다.** 상위 호출자가 미완성 상태를 이해하지 못하는 상태에서 반환하거나 예외로 전체 layout을 재시작하지 않는다. 기존 callback을 다시 실행하면서 순수 계산 재시도라고 부르지도 않는다.

### 10.3 제안하는 생산·게시 상태

한 View의 한 opt-in 경계에서 동시에 준비하는 세대는 최대 하나로 제한한다. 이전의 *게시된* 세대와 현재 *준비 중인* 세대를 구분한다. 이는 기존 Element/State 전체를 복제해 두 벌의 앱을 만들라는 뜻이 아니다. **현재 단일 live tree를 그대로 공유하며 이 격리가 이미 가능하다고도 가정하지 않는다.** 게시 세대가 참조하는 가변 상태를 분리할 표현과 수명 계약의 증명이 첫 구현의 선행 조건이다.

1. **Plan:** 가시 범위와 필요한 콘텐츠를 정한다. 임의 delegate/getter를 자격 확인용으로 미리 호출하지 않는다. custom layout은 명시적 continuation 지원이 없으면 기존 동기 경로다.
2. **Produce:** 명시적으로 지원하는 작업만 순서대로 실행한다. 사용자 `build/initState`나 개별 layout callback은 원자 작업이며 중간 선점하지 않는다. 작업 사이에서만 반환하고 재개 cursor를 소유한다.
3. **Wait:** 미완성 geometry를 paint·hit test·접근성에 게시하지 않는다. host deadline이 없거나 입력/credit 조건이 맞지 않으면 선택적 다음 slice를 시작하지 않는다. renderer credit을 JS 생산을 선점하는 기능으로 취급하지 않는다.
4. **Ready:** 필요한 전체 범위의 build, layout, render 연결과 자원 획득을 확인한다. 부분적으로 보이는 인접 페이지도 필수 범위다. 완료 여부와 coverage를 별도로 검사한다.
5. **Publish:** owner·metrics·renderer·content 및 입력 세대를 검증한 뒤 CPU 입력/geometry/semantics의 일관된 게시 경계를 확정한다. GPU 수락·표시 완료는 기존처럼 별도 단계로 추적하며 같은 사건이라고 부르지 않는다.
6. **Retire/Cancel:** 게시 독자의 사용이 끝난 이전 자원, 게시되지 않은 준비 자원을 각자의 owner가 회수한다. 사용자 callback의 부수 효과는 rollback할 수 없으므로 취소를 “아무 일도 없었던 것”으로 정의하지 않는다.

오래된 준비 결과는 게시하지 않는다. 반대로 매 입력마다 작업을 모두 취소해 영원히 `Ready`가 되지 않는 설계도 허용하지 않는다. 스크롤 위치만 바뀐 요구는 준비 coverage와 비교해 계속 사용할 수 있는지 판단하고, 의미가 바뀐 데이터·metrics·renderer 세대는 명시적으로 무효화한다. 이 판단 자체도 사용자 callback을 중복 실행해서 해서는 안 된다.

### 10.4 구현 전 확정해야 할 관측 계약

| 항목 | 반드시 해결할 사항 |
| --- | --- |
| State·callback | 준비 단계의 `initState/build/didUpdateWidget` 시점과 취소 후 `dispose`를 opt-in 계약에 명시한다. side effect가 없는 callback이라고 추측하지 않는다. 기존 Widget을 기본으로 등록하지 않는다 |
| GlobalKey | 게시/준비 세대 사이의 단일 소유와 retake·예약·중복 오류를 정의한다. 달력 내부 GlobalKey를 framework 것이라는 이유만으로 제외하지 않는다. 사후 subtree 스캔으로 자격을 확인하기 전에 lifecycle이 이미 실행되는 문제도 해결해야 한다 |
| 입력 | 현 `pointerHitTest`는 live RenderObject 경로다. 과거 frame만 보관한다고 안전하지 않다. 기존 pointer stream의 target 수명과 transform, 새 down·wheel·key·IME·접근성 action의 세대를 분리 없이 사용할 수 없다 |
| 준비 범위 밖 입력 | 오래된 좌표로 새 콘텐츠를 누르거나 빈 페이지를 게시하지 않는다. 입력 지연·대기·취소 중 어떤 UX를 허용할지는 별도 승인 사항이며, native 수신·JS 전달·최종 적용을 모두 계수한다. 임의 motion 병합/폐기로 보존 수치를 맞추지 않는다 |
| focus·ticker·timer | 미게시 콘텐츠가 focus·semantics를 획득하거나 framework ticker를 활성화하지 않도록 한다. 임의 사용자 timer/구독을 엔진이 자동 정지한다고 약속하지 않는다 |
| 오류 | 원래 오류 객체와 실행한 callback 순서를 유지한다. 부분 생산의 실패를 `ready`·빈 성공으로 바꾸지 않는다. 원자 callback 실패 후 중복 실행 없이 정리할 수 있어야 한다 |
| 회수 | route 제거, hide, resize, renderer 재생성, View close 시 준비 작업·frame lease·입력 target을 회수한다. frame마다 snapshot/SDK/archive를 쌓는 방식으로 격리를 구현하지 않는다 |

특히 **기존 입력을 계속 live tree에 전달하면서 같은 tree를 tick 사이에 부분 변경하는 구현은 첫 버전에서 금지**한다. 안전한 격리를 증명하지 못하면 기존 동기 경로에 남긴다. 입력을 오래 대기시킨 뒤 FPS만 좋아졌다고 채택하지 않는다.

### 10.5 최소 구현 순서와 중단 기준

| 단계 | 산출물과 검증 | 진행 조건 |
| --- | --- | --- |
| S0 게시·입력 계약 | 현재 동기 경로를 control로 두고 게시 세대, target 수명, 강제 geometry query·close의 순서를 작은 통합 fixture로 고정 | 단일 live tree와 기존 frame cache만으로 격리된다고 가정하지 않고 구체적인 표현·소유권을 제시할 것 |
| S1 생산 continuation | 지원 범위를 닫은 stock fixed-extent/grid 경계에서 자식 요구·build·layout 재개를 구현. scope, slot, parent data, 오류 정리의 명시적 상태를 포함 | 같은 callback을 재시도하지 않고 각 자식을 정확히 한 번 생산. custom callback의 원자 비용은 별도로 보고 |
| S2 원자적 게시 | S0의 표현으로 paint·geometry·semantics와 입력을 연결. 세대 변경·취소·재진입을 실제 pinned Hermes에서 검증 | 임의 tick 경계마다 미완성 tree가 외부 입력에 관측되지 않음. 준비/게시/회수 중복과 미회수 0 |
| S3 달력 opt-in | 공통 PageView/FillViewport 전달과 **중첩 grid의 layout-time 생성까지** 연결. Material 생성 코드에 임의 fast path를 삽입하지 않음 | 한 월을 위젯 shell만 나눠 만든 것을 날짜 전체 생산 분할이라고 세지 않음. Source/생성 소유권·새 lifecycle 계약을 함께 문서화 |
| S4 제품 비교 | 일반 진단 off 기준선 3회와 후보 3회. 실제 slice 최장·coverage 대기·취소 낭비·게시 지연·자원을 기존 FPS·정체·입력 분포와 함께 비교 | 기존 세 phase 모두 30fps·정체·p95 비악화 및 기능 기준 유지. 실패하면 opt-in 실험으로도 기본 채택하지 않음 |

S0에서 격리와 target 수명 표현을 닫지 못하면 S1부터 제품에 연결하지 않는다. S1에서 하나의 원자 callback이 이미 예산을 넘으면 slice 수를 늘리거나 deadline을 높여 성공 처리하지 않는다. 해당 atomic tail이 최종 정체를 지배하는지 기록하고 구조안을 재판정한다. cold 첫 생산과 빠른 역방향 모두에서 준비가 가시 요구를 따라가지 못하면, 평균 slice가 짧아도 이 설계의 제품 목표는 실패다.

이 구조안은 총 작업량을 줄인다는 보장이 없다. 더 많은 tick·준비 메모리·취소 낭비로 처리량이 악화될 수 있다. 따라서 기존 15% 연산 선별 대신 **실제로 긴 원자 생산 구간이 분할됐는지와 end-to-end 반응**을 검증한다. 이는 과거 후보의 탈락을 뒤집거나 전체 성능 수락 기준을 낮추는 변경이 아니다.

### 10.6 이번 완료 범위

현재 경계 조사, 현재 Hermes 진단 1회, 구조안·위험·구현 gate 문서화를 완료했다. **S0 통합 fixture와 S1~4 구현·제품 비교는 아직 수행하지 않았다.** 기존 기본값·동기 lifecycle·공급과 생성 코드는 변경하지 않았다. 새 API, experimental flag 또는 성능 향상이 이미 존재한다고 기록하지 않는다. 다음 구현 착수점은 S0이며, 준비 중 lifecycle과 coverage 밖 입력의 새 UX는 구현 전에 별도 승인이 필요하다.

현재 판정은 **구조 검토 완료 / 구현 미착수 / PARTIAL / performanceAccepted=false**다.

## 11. S0 착수 — 실제 runtime 계약과 준비 프레임 자격 검사

### 11.1 남긴 코드

사용자의 계속 요청에 따라 S0의 동기 control을 코드로 고정했다. [통합 fixture](Nelyx/eng/check-frame-publication.mjs)는 현재 Source의 실제 `AppSession`·`ViewRuntime`·`FrameworkRoot`를 연결하고, local frame clock과 renderer로 실행 순서·GPU busy만 제어한다. 준비 프레임을 흉내 내는 별도 상태 기계나 분할 layout 알고리즘으로 대체하지 않는다.

이 과정에서 [canSubmitPreparedFrame](Nelyx/src/framework/widgets/root.ts)의 기존 검사에 View owner 및 input scope가 빠져 있음을 확인했다. 동일 sequence·metrics로 다른 View id/generation이나 입력 sequence/timestamp를 전달해도 조기 자격 검사에서 통과할 수 있었다. `preparedFrame`은 이제 원래 `FrameBuildToken`을 보관하고 입력 scope를 비교하며, 공통 현재-frame 검사는 기존 `sameOwner` helper도 사용한다. capture가 만든 token 복사본은 정상 통과하고 sequence·tree revision·paint version·metrics 검사는 유지한다. 새 public API·실험 flag는 추가하지 않았다.

기존 [ViewRuntime.pump](Nelyx/src/hosting/runtime.ts)의 renderer 직전 owner 검사는 이미 존재한다. 이번 수정은 그 검사를 대신하거나 실제 교차 View 렌더링 취약점을 발견했다는 뜻이 아니다. 여러 생산 세대를 다루기 전에 **조기 재사용 자격도 정확한 소유·입력 범위로 닫은 것**이다. 생산이나 입력 순서를 재배치하지 않았다.

### 11.2 고정한 관측 계약

| 사례 | 검증한 결과 |
| --- | --- |
| token 범위 | 정상 capture 복사본 허용. 다른 View id/generation, 입력 sequence/timestamp, 이전 frame 또는 resize 이전 scope는 준비 프레임 재사용 불가 |
| CPU seal·게시 | recording seal 이후 geometry 알림, 그 뒤 semantics 게시. 이후 build가 이전 sealed paint commands를 변경하지 않음 |
| target 수명 | down 뒤 target이 교체·dispose되면 이전 stream의 up을 새 target으로 재지정하지 않음. 새 down은 새 live target에 도달. 수신한 4개 contact의 dispatch begin/end 보존·임의 drop 0 |
| GPU backpressure | busy pending을 ordinary tick마다 재생산하지 않음. 강제 geometry 요청은 GPU 수락 없이도 새 CPU frame과 semantics를 완결. 교체된 caller lease는 회수되고 credit 복귀 시 현재 frame을 제출 |
| 재진입 close | geometry 게시 알림에서 `beginClose`하면 이후 semantics 게시·renderer admission·새 pointer 전달을 중지. 예정된 clock task와 CPU lease를 실제 종료에서 회수 |
| 생산 실패 | paint 오류 객체를 그대로 보고하고 partial seal/geometry/semantics·renderer admission을 하지 않음. 실패 후 종료도 task·lease를 회수 |

이 검증은 **CPU 입력/geometry/semantics 갱신과 GPU 수락이 별개**라는 기존 계약을 고정한다. GPU가 busy라는 이유로 강제 geometry 갱신을 미루거나, 미완성 준비 작업을 CPU frame처럼 게시하는 변경은 이 control과 양립할 수 없다.

### 11.3 검증과 현재 한계

- 수정 전 통합 fixture는 `Foreign View generation reused a prepared frame`으로 실패했다. 수정 후 4개 통합 시나리오가 PASS다. fixture 초기의 constructor-name 의존 assertion은 실제 event class의 `instanceof` 검사로 고쳐 bundler의 class 이름에 의존하지 않게 했다.
- 기존 `check-source-framework.mjs`, `check-retained-paint.mjs`, `npm run check --workspace @nelyx/core`, 변경 두 코드 파일의 oxlint/oxfmt가 PASS다. 개별 검증은 1,200,000ms timeout이다. 타입 검사 첫 시도의 직접 tsc 경로가 현재 package alias 구조와 달라 실패했으며, dependency 설치 없이 정규 npm script로 확인했다.
- fixture는 in-memory bundle이고 영구 trace·receipt·history·별도 SDK/cache 사본을 만들지 않는다. 기존 회귀의 임시 디렉터리는 각 실행의 finally에서 회수한다. 현재 dist·설치 공급은 교체하지 않았으며, 이전 일반 Hermes binary 실행을 변경 Source의 검증이라고 기록하지 않는다.

**S0의 동기 계약 control·정확한 준비 프레임 자격은 구현/검증했지만, S0 전체의 세대 격리 gate는 아직 통과하지 않았다.** 과거 paint commands가 불변이어도 pointer hit test와 State·Focus·GlobalKey는 여전히 단일 live tree를 사용한다. 이 fixture 통과를 준비 중 tree를 tick 사이에 변경해도 된다는 증명으로 바꾸지 않는다. 게시된 target/geometry의 수명을 준비 작업과 분리하는 표현이 없으므로, S1을 기존 build/layout 루프의 조기 반환으로 연결하지 않았다.

다음 선행 작업은 준비 전용 경계의 소유권과 lifecycle, coverage 밖 입력의 UX를 확정하고 격리 자체를 통합 검증하는 것이다. 이번 Source 수정은 성능 개선 수락이나 S1~4 완료가 아니다. **S0 동기 control PASS / 세대 격리 미구현 / PARTIAL / performanceAccepted=false**를 유지한다.
