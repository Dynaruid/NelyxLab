# Windows 스크롤 성능 개선의 새 접근: 필요한 자식 우선 갱신과 제한된 수명 보존

작성일: 2026-11-17

상태: **설계 제안 / notImplemented / performanceAccepted=false**

검토 기준: HEAD `0d917cab`과 문서 작성 전 깨끗한 작업 트리. [원인 분석](performance-cause-analysis.md)의 `720d22d6` 기준 및 [기존 작업 기록](work.md)의 측정 이력과 구분한다. 이번 작업에서는 관련 코드를 읽고 대안을 검토했으며, 엔진 수정·빌드·테스트·추가 성능 실행은 하지 않았다.

## 1. 결론

새 권고안은 **필요한 자식은 현재 프레임에서 완결하고, 당장 필요하지 않은 자식은 제한된 inactive 보존 대상으로 분리하는 demand-first child reuse**다. 먼저 이 방향의 타당성을 판정하고, 계약과 제거 가능한 작업량이 확인될 때만 구현 후보로 올린다.

기존 분석이 제안한 render children 동기화 등록 축소는 유지할 가치가 있다. 다만 그 비용 비중은 아직 미확정이고, 성공하더라도 새 월의 Widget·Element·State 생산 자체는 남는다. 다음 접근을 다시 작은 검사·큐 연산의 단가 절감 하나에만 걸지는 않는다.

새 접근의 질문은 다음과 같다.

> 자식 하나의 처리를 조금 빠르게 하는 것뿐 아니라, 이번 프레임에 처리할 필요가 없는 subtree의 갱신과 재생산을 줄일 수 있는가?

이것은 모든 월 keep-alive, builder 결과 캐시, 스크롤 감속 제안이 아니다. 공통 PageView/sliver의 **자식 정체성·갱신·수명 계약을 분리**하는 제안이다. 날짜 계산이나 날짜별 Focus·Ink·Semantics를 간소화하지 않는다.

**중요한 한계:** 재방문 비용을 줄여도 처음 보는 월의 생산 비용은 사라지지 않는다. 복귀 역시 activation·의존성 재연결·rebuild를 필요로 한다. 이 방향 하나로 보통/빠른 정방향/역방향 모두 30fps를 달성한다고 예측할 근거는 없다.

## 2. 기존 판단에서 유지할 것

- 월 경계에서 기존 자식 갱신, 새 자식 생산, 범위 밖 자식 회수가 동기 build/layout 경로에 겹칠 수 있다. [sliver layout](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts#L191)과 [createChild](Nelyx/src/framework/widgets/sliver.ts#L459)에서 확인된다.
- rebuild 횟수는 새 Element 생성 횟수가 아니다. [자식 조정](Nelyx/src/framework/widgets/framework.ts#L1330)은 type/key가 맞으면 기존 Element를 사용한다.
- owner 등록은 이미 중복 제거되고, 동일한 render 자식은 실제 교체를 피한다. [OwnerTransaction](Nelyx/src/runtime/owner-transaction.ts#L10)과 [자식 동기화](Nelyx/src/framework/widgets/framework.ts#L2071)를 무시한 전체 재생성 설명은 채택하지 않는다.
- [기존 비교 기록](work.md#L552)의 TDZ 제거는 정적 helper 감소와 일관된 FPS·정체 개선이 같은 것이 아님을 보여 준다. AOT·GC·GPU 중 하나를 단독 원인으로 확정한 결과도 아니다.
- 기존 역방향 시나리오는 제스처 수와 이동량이 다르다. 낮은 역방향 FPS만으로 방향별 알고리즘 결함을 단정하지 않는다.

이 판단을 뒤집는 것이 아니라, **비용의 단가 외에 갱신 대상과 실제 재생산 횟수를 설계 변수로 추가**한다.

## 3. 단순 cache/prewarm 확대가 충분하지 않은 코드상 이유

### 3.1 현재 PageView에는 정책 전달 경로가 없다

[PageViewOptions와 builder](Nelyx/src/framework/widgets/page-view.ts#L354)에는 childPolicy가 없고, [SliverFillViewport 내부 Widget](Nelyx/src/framework/widgets/sliver-fill.ts#L58)은 delegate만 공통 adaptor에 전달한다. [정책 허용 검사](Nelyx/src/framework/widgets/sliver.ts#L117)도 FixedExtentList·SectionList로 제한한다.

따라서 기존 목록의 bounded/dormant 설정을 달력에 켜기만 하면 된다는 제안은 현재 코드에 맞지 않는다. 공통 정책을 확장하는 설계와 전달 경로가 필요하다. allowImplicitScrolling을 켜는 것은 접근성·cache extent 계약까지 바꾸므로 대체 스위치로 사용하지 않는다.

### 3.2 활성 보존을 늘리면 갱신 대상도 늘어날 수 있다

[bounded 보존](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts#L384)은 자식을 keep-alive bucket에 남긴다. 이 경우 dormant처럼 Element subtree를 deactivate해서 별도 inactive 보존 대상으로 옮기는 것이 아니다.

한편 [SliverMultiBoxAdaptorElement.performRebuild](Nelyx/src/framework/widgets/sliver.ts#L368)는 현재 소유 슬롯을 순회해 delegate를 다시 호출한다. 그러므로 **활성 보존량 증가 → 월 변경 때 갱신하는 subtree 증가**라는 역효과가 가능하다. 보존 hit 수만 늘었다고 개선으로 판정해서는 안 된다.

이것은 현재 legacy 달력이 많은 비가시 월을 갱신한다는 증거가 아니다. 비필수 갱신 분리는 **활성 cache를 확대할 때 생길 비용을 방지하는 설계**이고, 현재 legacy 대비 직접 절감 후보는 주로 반복 생산·회수다. 가상의 더 비싼 cache와 비교해서만 이긴 결과를 baseline 개선으로 계산하지 않는다.

### 3.3 dormant는 이미 있지만 delegate 교체에 취약하다

[DormantChildCache](Nelyx/src/framework/widgets/dormant-child-cache.ts#L22)는 기존 inactive root를 보관한다. 별도 Element/RenderObject 트리를 복제하거나 객체 identity를 재활용하는 구현이 아니다. [removeChild](Nelyx/src/framework/widgets/sliver.ts#L479)는 자식을 슬롯에서 제거하고 deactivate한 뒤 이 정책에 보존을 요청한다.

그러나 [sliver update](Nelyx/src/framework/widgets/sliver.ts#L273)는 **동일 delegate 객체일 때만** 기존 dormant 용량을 유지한다. [PageView.builder](Nelyx/src/framework/widgets/page-view.ts#L398)는 새 delegate를 만들므로, 정책 전달만 추가해도 월 변경에 따른 delegate 교체가 보존분을 비울 수 있다.

또한 [activate](Nelyx/src/framework/widgets/framework.ts#L1469)는 subtree를 다시 순회하고 build를 예약한다. **State를 보존하는 것과 rebuild를 없애는 것은 다르다.** 절감 후보는 createState/initState·자원 재생성 및 일부 dispose/unmount이지 복귀 전체 비용이 아니다.

### 3.4 기존 사전 준비는 큰 작업을 분할하지 않는다

[ViewWorkBudget.runOptional](Nelyx/src/framework/widgets/view-work-budget.ts#L475)은 필수 layout 뒤의 선택 작업이다. 현재 조건은 추정 비용 **2ms 이하**, deadline 여유, queue delay·clock uncertainty, 자원·Element 용량이며 같은 host tick에 최대 한 항목을 실행한다. 준비와 원래 범위 복원을 위한 layout을 동기 실행한다.

이는 비선점형 자식 생산을 여러 프레임으로 나누는 기능이 아니다. 실제 달력 한 월의 추정 비용이 이 조건에 들어가는지는 미측정이다. 비싼 월이 거절된다면 2ms 제한을 높여 실행시키는 것은 원인 해결이 아니라 정체 위험의 이전이다. Root의 [호출 위치](Nelyx/src/framework/widgets/root.ts#L693)도 필수 layout 뒤이므로 현재 프레임에서 이미 요구된 월을 소급해 준비할 수 없다.

## 4. 대안 비교와 선택

| 대안 | 제거하거나 옮기는 비용 | 장점 | 한계·위험 | 판단 |
| --- | --- | --- | --- | --- |
| 실제 구조 변경에 따른 동기화 등록 | 변하지 않은 owner의 등록·정렬·projection·비교 | 의미를 유지하면 모든 화면에 적용 가능 | 현재 시간 비중 미확정. cold 생산은 남음. custom hook·실패 복원 필요 | 기존 유효 후보. 작은 구현이라는 이유만으로 단독 해법으로 삼지 않음 |
| **필요 자식 우선 갱신 + inactive 제한 보존** | 비필수 보존분의 갱신, 재방문 시 State·자원 재생산 | 큰 처리 단위의 반복을 직접 줄이는 방향. 기존 dormant 기반 활용 | 수명·콜백 계약 변경, key 정체성 증명, 복귀 rebuild·메모리 비용 | **새 권고안. 타당성 gate를 먼저 통과해야 함** |
| 활성 keep-alive·cache extent 확대 | 일부 재생산을 메모리 보존으로 교환 | 기존 연결을 유지할 수 있음 | 보존분 갱신 증가, 비가시 focus/ticker, 첫 생산 비용과 자원 압력 | 비교 대조군일 수 있으나 우선 해법 아님 |
| 관측 예산 기반 사전 준비 | 생산 시점을 앞당김 | 작은 원자 작업이고 여유가 있으면 유용 | 처리량 자체는 줄지 않음. 큰 월은 예산 밖일 수 있음 | 기존 기능 재사용만 검토. 새 scheduler·한도 상향 제외 |
| cooperative/incremental mount | 한 subtree 생산을 여러 tick으로 분할 | cold 원자 작업의 긴 tail을 직접 겨냥 | 동기 builder/initState, GlobalKey, 예외 복원, 미완성 트리 비노출을 새로 설계해야 함 | 장기 대안. 중간에 await를 넣는 방식은 배제 |
| native/compositor 독립 스크롤 | JS 생산 중에도 기존 화면 이동 | 시각적 반응을 분리할 가능성 | 입력 geometry·semantics·신규 콘텐츠의 세대 일치와 scroll 소유권 변경. 빈 콘텐츠 문제는 남음 | 기존 Source 정책 경계를 바꾸는 별도 프로젝트 |
| 추가 AOT·helper·단명 할당 최적화 | 처리 단가·일부 할당 감소 | 의미 보존 범위를 좁힐 수 있음 | 앞선 국소 개선이 전체 목표로 이어지지 않음 | 배제하지 않되 다음 기본 전략으로 반복하지 않음 |

권고안은 가장 작은 patch라는 뜻이 아니다. **반복되는 큰 작업을 얼마나 실제로 없앨 수 있는지 판정할 가치가 크다**는 선택이다. 수명 변경을 허용하지 않거나 재사용 이득이 작으면 기존 동기화 후보가 더 적절하다.

## 5. 권고안의 최소 설계

### 5.1 첫 버전은 기존 active 갱신 순서를 바꾸지 않는다

초기 범위는 공통 PageView/FillViewport의 명시적 opt-in이다. 기본은 legacy로 유지한다. 현재 프레임의 layout에 필요한 자식과 명시적 keep-alive는 기존 동기 계약으로 처리한다. 부분적으로 보이는 두 페이지도 모두 필수 대상이다.

화면을 벗어나고 기존 keep-alive 요구가 없는 자식만 기존 deactivate 경로를 거쳐 dormant 후보로 보낸다. 보존분은 active 슬롯 집합 밖에 두므로 이후 delegate 갱신 때 함께 재빌드할 필요가 없다. 이것이 여기서 말하는 **필요한 자식 우선**의 첫 범위다.

현재 didStartLayout보다 먼저 정밀 가시 범위를 계산해 모든 dirty build를 재정렬하는 큰 변경부터 시작하지 않는다. active 자식의 builder 호출 순서와 self-dirty·inherited 갱신을 임의로 건너뛰지 않는다. 별도의 보존 트리나 dirty queue도 만들지 않는다.

제안하는 경로는 다음과 같다. 기존 메커니즘 위의 정책 제안이며 현재 PageView에 구현된 동작이 아니다.

```text
필수 자식 없음 → 현재 delegate로 생산 → 현재 프레임 build/layout 완결
필수 자식 있음 → 기존 순서로 갱신·layout
범위 이탈 → 기존 keep-alive 요구 우선 → 없으면 deactivate
  → 자격·예산 충족: dormant 보존 / 미충족: 기존 회수
재진입 → 최신 delegate 실행 → 정체성·type/key 확인
  → 일치: 기존 root activate + 최신 설정 반영 + rebuild/layout
  → 불일치: 기존 root 회수 + 새 자식 생산
```

### 5.2 delegate 객체 수명과 자식 정체성 수명을 구분한다

현재 dormant 무효화 조건을 단순 삭제해서는 안 된다. 새 delegate는 같은 index에서도 다른 논리 자식을 반환할 수 있고, 같은 callback도 바뀐 State를 읽을 수 있다.

공통 delegate의 opt-in 계약으로 다음 두 개념을 구분하는 방안을 검토한다. 아래 이름은 설명용이며 현재 API가 아니다.

- **identity generation:** index/key 대응과 자식 도메인의 유효 기간. 삽입·삭제·재정렬·범위 의미 변경 시 보존분을 무효화하거나 검증된 key remap을 수행한다.
- **configuration revision:** 정체성을 유지하는 설정 변경. dormant 보존 자체는 가능하지만 복귀 때 최신 builder와 의존성을 다시 적용해야 한다. 이 값이 같다는 이유만으로 활성 State의 build를 생략하지 않는다.

이는 두 revision 필드를 반드시 새 API로 추가하자는 뜻이 아니다. 내용 갱신은 기존 delegate update 신호로 충분할 수 있다. 최소한 필요한 것은 delegate 교체를 넘어 정체성이 유지됨을 명시하는 계약이며, 불필요한 버전 체계를 중복 도입하지 않는다.

이 계약은 엔진이 closure를 분석하거나 callback identity에서 추측하지 않는다. 명시적 계약을 제공할 수 없는 delegate는 기존 무효화/legacy 경로를 사용한다. 첫 구현은 임의 key remap을 함께 추가하기보다 정체성 변경 시 전체 보존분을 비우는 보수적 범위가 적절하다.

[현재 복귀 경로](Nelyx/src/framework/widgets/sliver.ts#L338)처럼 **fresh Widget과 Widget.canUpdate를 확인한 뒤에만** 기존 root를 되살린다. 세대 계약과 type/key 검사는 서로 대체재가 아니다. 잘못된 세대·중복 key·소유권 위반은 기존 invariant/오류 보고 경로로 드러내며 조용히 성공 처리하지 않는다.

### 5.3 수명 변경은 최적화 세부 사항이 아니라 공개 계약이다

| 항목 | 필요한 계약 |
| --- | --- |
| State | legacy보다 dispose가 늦어진다. offscreen 동안 매 설정 갱신의 didUpdateWidget이 호출된다고 보장하지 않는다. 복귀 시 최신 설정을 반영하는 정책임을 opt-in 사용자에게 명시 |
| inherited 데이터 | deactivate 때 의존성 해제, 복귀 때 최신 Theme·Localizations·MediaQuery 등을 재연결. 과거 Widget 결과를 그대로 표시하지 않음 |
| focus·입력 | 비가시 입력 대상이나 오래된 geometry가 노출되지 않아야 함. 기존 focus·showOnScreen·명시적 keep-alive 요구를 우회하지 않음 |
| semantics | 보존분을 보이는 접근성 노드로 게시하지 않음. 복귀한 최신 날짜·선택·disabled 상태를 같은 프레임의 geometry와 일치시킴 |
| ticker·timer | framework ticker의 비활성/복귀 계약을 검증. 임의 사용자 timer·구독까지 자동 정지한다고 약속하지 않음 |
| GlobalKey | 현재 dormant는 application GlobalKey subtree를 보존 대상에서 제외하고 framework anchor만 구분한다. 이 자격 검사를 완화하지 않음 |
| 예외·종료 | builder/activate/dispose 실패를 표면화. 실패한 복귀를 정리하고 View 종료·route 제거·자원 압력 때 실제 root를 한 번만 회수 |

[Element의 deactivate/activate](Nelyx/src/framework/widgets/framework.ts#L1450), [State의 갱신·수명 hook](Nelyx/src/framework/widgets/framework.ts#L1679), [dormant 자격 검사](Nelyx/src/framework/widgets/dormant-child-cache.ts#L63), [복귀 실패 정리](Nelyx/src/framework/widgets/framework.ts#L364)를 재사용하는 방향이다. 이 코드가 존재한다는 것만으로 PageView의 위 계약이 모두 검증됐다고 보지는 않는다.

### 5.4 보존량은 월 개수보다 실제 자원으로 제한한다

현재 두 정책은 서로 다른 Element 예산을 가진다.

| 기존 정책 | 현재 상한 | 해석 |
| --- | --- | --- |
| [bounded](Nelyx/src/framework/widgets/view-work-budget.ts#L54) | sliver별 최대 8, View의 optional 자식 16·Element 2,048 | 필수·명시적 keep-alive 전체를 포함한 총량 상한이 아님 |
| [dormant](Nelyx/src/framework/widgets/dormant-child-cache.ts#L7) | cache 전체 자식 32·Element 4,096, owner별 별도 capacity | 한 월이 이 예산 안에 들어가는지 미측정. resident byte 상한과도 다름 |

한 페이지가 자격 검사나 Element 예산을 넘으면 보존할 수 없다. 무조건 1~2개월을 보관할 수 있다고 전제하거나 상한부터 올리지 않는다. 큰 페이지의 최초 mount 중 필요한 자원과 보존분의 예산을 구분한다.

첫 타당성 검사는 legacy 대조군과 작은 owner 용량 하나를 비교한다. 용량 1 또는 2 중 실제 자식 크기에 맞는 값을 선택하며, capacity=0을 dormant API에 전달하지 않는다. 현재 dormant는 양수만 허용하므로 보존 없는 대조군은 legacy다.

기존 DormantChildCache와 resource reclaimer를 재사용하되, bounded와 dormant가 함께 있을 때 두 한도가 자동으로 하나의 View 총예산이 되는 것은 아니다. 최초 국소 검증은 한 View의 단일 opt-in owner로 제한하고, 제품 적용 전에는 혼합 사용의 총 자원 압력·회수 계약도 확인한다. 별도 무제한 cache로 우회하지 않는다.

### 5.5 역방향 우대가 아니라 재방문 거리와 회수 비용으로 판단한다

처음부터 방향 예측기나 앞뒤 페이지 prewarm을 추가하지 않는다. 최근 이탈 자식의 제한 보존만으로 시작하고 기존 eviction 경로를 사용한다.

연속해서 여러 월을 이동한 뒤 돌아오면 작은 보존 용량의 hit는 일부에 그칠 수 있다. 필요한 지표는 전체 월 개수보다 **이탈 후 재진입까지 거친 서로 다른 자식 수와 실제 hit 비율**, 그리고 hit에서 절감한 생산·회수 비용이다.

예산 초과 시 기존 cache가 victim을 동기 회수할 수 있으므로 retirement가 완전히 idle로 이동한다고 주장하지 않는다. 복귀 rebuild와 eviction까지 합쳐 이득이 없는 정책은 채택하지 않는다.

## 6. cold 생산 문제는 별도 판정한다

새 권고안이 직접 겨냥하는 것은 **같은 자식의 불필요한 갱신과 반복 생산**이다. 다음 경우에는 해결 범위 밖이거나 이득이 작다.

1. 계속 처음 보는 월로만 이동한다.
2. 재방문 거리가 보존 용량보다 길다.
3. 한 월이 보존 예산·GlobalKey 자격을 충족하지 못한다.
4. activate·의존성 재연결·rebuild가 fresh mount와 비슷하게 비싸다.
5. delegate 정체성 세대를 안정적으로 제공할 수 없어 계속 무효화된다.
6. 동기 eviction, 사용자 timer·구독, 늘어난 live heap/GC가 절감분을 상쇄한다.

이 경우 cache를 더 키우거나 prewarm 한도를 높이는 방향으로 자동 확대하지 않는다. cold 생산이 지배적이면 **stock mount/init/build의 공통 필수 경로에서 실제 중복 작업을 제거하는 설계**로 돌아가야 한다. render commit이 큰 몫이면 기존 구조 변경 기반 동기화 후보가 그 하나다. 어느 구간이 큰지 모른 채 새 pooling·typed 변환으로 넘어가지 않는다.

cold 원자 작업 자체가 목표 프레임의 시간을 소진한다면 단순 준비 scheduler로 해결할 수 없다. incremental mount는 별도의 작업 단위·중단·rollback·게시 계약이 있어야 하는 장기 대안이다. 임의 lifecycle 중단이나 미완성 화면 제출을 이번 권고안에 끼워 넣지 않는다.

## 7. 채택 전 확인 순서와 검증 설계

아래는 **후속 구현 시 수행할 제안**이다. 이번 문서 작성에서 실행한 결과가 아니다.

### 단계 A — 설계 타당성 gate

먼저 코드 계약과 아주 작은 원인 분해 진단으로 다음을 확인한다. 반복 성능 실행으로 설계를 대신하지 않는다.

- 실제 월 subtree의 Element 수, 보존 자격, GlobalKey/명시적 keep-alive 여부.
- 새 mount·현재 Element update·dormant resume·최종 회수를 구별한 횟수와 배타적 시간. rebuild 횟수로 생성량을 대체하지 않는다.
- 필요한 자식의 갱신과 보존분 갱신, delegate 교체·세대 무효화·eviction의 관계.
- legacy에서의 재방문 거리와 제한 보존 시 기대 가능한 hit. 모든 과거 월을 보관하는 전제는 금지한다.
- fresh mount와 resume의 차이가 retirement·관리·live 자원 증가를 상쇄할 가능성.

기존 [build 진단](Nelyx/eng/windows-jank-build-profile.ts#L3)의 dirtyFlushMs/renderCommitMs는 재사용하되, callback 안의 생산 시간까지 전부 분해하는 값은 아니다. 필요한 lifecycle 구분만 보강하고 중첩 build 시간과 layout 시간을 이중 합산하지 않는다. 진단 run은 FPS 비교 표본에서 제외한다.

**진행 조건:** 정체성 계약을 설명할 수 있고, 페이지가 기존 예산에 들어가며, **현재 legacy 대비** 반복 생산·회수의 순비용을 줄일 여지가 있어야 한다. 가상의 활성 cache 확대보다 갱신이 적다는 이유만으로 통과시키지 않는다. 하나라도 없으면 큰 정책 구현 전에 이 방향을 보류한다.

### 단계 B — 최소 기능 검증

공통 PageView의 국소 fixture에서 새 정책을 명시적으로 켠다. 기본 legacy, 기존 bounded/dormant 목록 동작은 그대로 둔다. 기존 [Source 회귀](Nelyx/eng/check-source-framework.mjs)와 [child reconciliation 회귀](Nelyx/eng/check-child-reconciliation.mjs)에 변경이 도입하는 사례만 추가하는 방향으로 한다.

- 동일 정체성의 delegate 교체 후 복귀: State는 보존하고 설정·의존성·semantics는 최신이어야 한다.
- key/type·정체성 세대 변경: stale State를 다른 항목에 연결하지 않는다.
- 부분 노출 두 페이지·빠른 반전·jump·resize·viewportFraction·RTL/reverse에서 필요한 자식을 누락하지 않는다.
- dormant 중 setState·Theme/locale 변경, focus 이동·showOnScreen, ticker 복귀·사용자 timer의 계약을 확인한다.
- GlobalKey retake·명시적 keep-alive, 예산 미달/초과·자원 압력, builder/activate/dispose 실패·종료 후 회계를 확인한다.

이 단계에서 builder 호출 순서나 lifecycle 의미를 legacy와 같다고 허위로 맞추지 않는다. **legacy의 비변경**과 **새 opt-in 계약의 정확성**을 따로 검사한다.

### 단계 C — 효과를 분리해서 비교

국소 비교는 같은 복잡한 공통 PageView workload에서 cold와 근접 재방문을 분리한다. 구조 동기화 축소·추가 AOT·prewarm을 동시에 켜지 않는다. hit 수보다 **필수 경로 CPU, resume 포함 생산·회수 총량, 관리 비용, live 자원**이 실제로 줄었는지를 본다.

프레임 간격 p95/p99/최대와 입력 대기·입력→surface 지연도 기존 집계로 함께 비교한다. 입력 개수 보존은 기능 근거이지 낮은 지연의 증거가 아니다. 작은 3회 비교를 통계적 유의성이나 신뢰구간으로 표현하지 않는다.

그 뒤 기존 Windows 달력의 보통 정방향·약 2배 정방향·약 2배 역방향을 변경 전후 각 3회 비교한다. bytecode·pruning off 등 기본 공급, viewport·host·VM·입력 조건을 고정한다. 60Hz 주입과 기존 이동 거리·제스처 수·월 정착 조건을 바꾸지 않는다. 방향만 분리하는 대칭 실험이 필요하면 별도 진단으로 둔다.

**연결 조건을 빠뜨리지 않는다:** 현재 달력은 legacy다. 공통 API를 추가했거나 국소 fixture에서 이겼다는 이유만으로 달력 개선을 주장할 수 없다. 실제 달력에 공통 opt-in·정체성 계약을 연결하는 후속 범위를 별도 승인받아야 한다. 달력 전용 key 추측, 생성 파일 수동 patch, 전역 강제 활성화는 사용하지 않는다. 연결하지 못하면 달력 성능 효과는 notVerified로 남긴다.

### 단계 D — 수락과 중단

| 구분 | 판단 기준 |
| --- | --- |
| 국소 메커니즘 | 재생산·비필수 갱신 절감이 확인되고 resume·eviction·메모리를 포함해 이득. hit 증가만으로 PASS 아님 |
| 전체 성능 | 유효 3회 각각의 기존 모든 달력 phase에서 engine FPS와 관측 표시 FPS 하한 모두 30 이상. 평균으로 미달 phase를 숨기지 않음 |
| 진행 정체 | 같은 공급·입력의 baseline과 ≥100ms 정체 횟수·총 시간·최장을 비교. 이 문서의 보수적 제안 기준은 phase별 3회 중앙값에서 횟수·최장이 증가하지 않고, baseline 정체가 있으면 총 시간이 감소하는 것. baseline 0인 phase는 0 유지. 기준을 바꾸면 비교 전에 명시 |
| 기능·자원 | 입력 수신=전달=수락, 월 정착, 최신 선택·focus·UIA·geometry, 정상 종료·실제 자원 회수. 보존량의 증가와 누수를 구분 |
| 공통 회귀 | Gallery·가변 목록·편집·일반 PageView·Testbed와 Web의 관련 동작 유지. 플랫폼 성능은 실제 확인 전까지 별도 |
| 중단 | 계약 불명확, 예산 미충족, 낮은 hit, 비싼 resume/eviction, 지속적 무효화·live heap 부담이면 보류/철회. cache 확대나 기능 축소로 수락을 만들지 않음 |

수락 기준의 30fps를 특정 CPU 구간의 33.3ms와 동치로 보지 않는다. engine 완료율·관측 표시 FPS는 실제 scanout도 아니다. 국소 성공과 기존 목표 전체 달성을 분리해 기록한다.

후속 검증은 **PowerShell 7, 20분 timeout, 전체 시나리오 반복 원칙 30회 이내**로 제한한다. 주입 deadline 초과·foreground 이탈 등 무효 표본은 실패 이유와 분리하고 성공 표본으로 바꾸지 않는다. 임시 파일·소유 process·browser profile은 성공·실패·중단 모두 finally에서 정리한다. 로그·receipt·history JSON·이전 archive·설치본을 누적 보관하지 않고 패키지 빌드는 현재 dist만 남긴다.

## 8. 최종 권고

**다음 단계는 캐시 확대 구현이 아니라, dormant 기반 공통 자식 재사용의 정체성 계약과 실제 절감 가능성을 확인하는 것이다.**

조건이 맞으면 PageView까지 공통 정책을 확장하고, 비필수 보존분을 활성 갱신 대상에서 분리한다. 조건이 맞지 않으면 이 방향을 접고 실제 시간 비중이 확인된 공통 cold 생산·구조 동기화 경로를 선택한다. 이 판단을 위해 기본 동작이나 접근성·입력 계약을 희생하지 않는다.

이번 산출물은 새 해결 방향의 검토 문서다. 기존 [작업 기록](work.md)과 [원인 분석](performance-cause-analysis.md)의 **PARTIAL / performanceAccepted=false**를 변경하지 않는다.
