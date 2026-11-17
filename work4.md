# 공통 Semantics 형제 충돌 판정의 비교량 줄이기

작성일: 2026-11-17

상태: **H4-00 선별 종료·후보 보류 / H4-01~03 조건부 미착수 / PARTIAL / performanceAccepted=false**

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
