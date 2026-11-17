# Windows 스크롤 성능 개선의 새 접근: 필요한 자식 우선 갱신과 제한된 수명 보존

작성일: 2026-11-17

상태: **단계 A의 자격 gate FAIL → 보존 후보 보류 / 후속 공통 build·수명·동기화 비용 분해 완료 / 제품 최적화 notImplemented / performanceAccepted=false**

원설계 검토 기준: HEAD `0d917cab`과 문서 작성 전 깨끗한 작업 트리. [원인 분석](performance-cause-analysis.md)의 `720d22d6` 기준 및 [기존 작업 기록](work.md)의 측정 이력과 구분한다. 아래 §1–8은 코드 검토만 수행했던 원설계다. 사용자의 `work2.md 작업해줘` 요청에 따른 HEAD `e222fd49`의 구현·진단·판정은 **§9**, 이후 `work2.md의 다음작업해줘` 요청의 공통 비용 분해는 **§10**에 기록한다.

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

원설계 작성 시 산출물은 새 해결 방향의 검토 문서였다. 후속 실행에서도 기존 [작업 기록](work.md)과 [원인 분석](performance-cause-analysis.md)의 **PARTIAL / performanceAccepted=false**를 변경하지 않는다.

## 9. 2026-11-17 실행 기록 — 단계 A의 보존 자격 판정

### 9.1 작업 범위와 코드에서 확인한 제약

시작 checkout은 `e222fd49`, 작업 트리는 깨끗했다. §7의 순서에 따라 공통 정책 구현 전에 실제 월 subtree의 보존 자격부터 확인했다. 현재 월 페이지는 **기존 dormant 자격 조건을 충족하지 못한다.** 따라서 이 후보를 보류하고 단계 B·C로 확대하지 않는다.

코드상 연결은 다음과 같다.

1. [_DayPickerState.build](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1997)는 월 내부에 `GridView.custom`을 만든다.
2. 그 내부 [ScrollableState](Nelyx/src/framework/widgets/scrollable.ts#L210)는 gesture·ignore·semantics용 일반 `GlobalKey`를 소유한다. 이 키는 `createFrameworkAnchorKey`로 만든 anchor가 아니다.
3. Windows의 scrollbar에도 [painter·gesture용 일반 키](Nelyx/src/framework/widgets/scrollbar.generated.ts#L2103)가 있다.
4. [DormantChildCache.eligibleElements](Nelyx/src/framework/widgets/dormant-child-cache.ts#L63)는 framework anchor 이외의 `GlobalKey`를 하나라도 만나면 보존을 거절한다. 키가 framework 코드에서 생성됐다는 사실만으로 anchor 자격을 부여하지 않는다.

§5.3이 이 자격 검사의 완화를 명시적으로 제외하므로, Scrollable/scrollbar의 키를 anchor로 바꾸거나 GlobalKey 검사를 우회하지 않았다. 이는 index/key 세대 전달 경로만 추가해서 해결되는 문제가 아니다. 재취득·gesture·semantics 소유권 계약을 별도로 검토해야 한다.

정체성 계약도 여전히 구현 전이다. 공통 API를 구현한다면 delegate 객체와 독립된 명시적 도메인 토큰을 받고, index/key 대응이 바뀌면 보존분 전체를 비우는 보수적 계약이 필요하다. 같은 도메인의 설정 갱신에서도 최신 builder와 `Widget.canUpdate`를 거쳐야 한다. callback identity, 월 key 추측, 설정 revision만으로 State 갱신을 생략할 수 없다. 이번 실행은 이 토큰을 공개 API로 추가하지 않았다.

### 9.2 추가한 진단과 측정의 경계

- [자식 수명 진단](Nelyx/eng/windows-jank-child-profile.ts): 실제 FillViewport 자식의 Element·State·일반 GlobalKey·framework anchor·명시적 keep-alive를 세고, fresh 자식 요청·기존 자식 요청·active build flush·delegate update·deactivate/remove·최종 root unmount를 구분한다. root identity는 WeakMap으로 추적하고 회수된 트리를 별도 cache에 보존하지 않는다.
- [기존 build 진단](Nelyx/eng/windows-jank-build-profile.ts)과 [실행기](Nelyx/eng/check-windows-jank.mjs)에 명시적 `NELYX_JANK_BUILD_PROFILE=1`일 때만 연결했다. 일반 앱·기본 스크롤 정책에는 관측 hook이 들어가지 않는다.
- 구간 중첩은 stack으로 빼서 `exclusiveMs`를 제공한다. `inclusiveMs`나 기존 layout/build 집계와 더해서 전체 CPU 시간을 만들지 않는다. `freshChild`는 외부 PageView의 createChild/build/commit 구간이며 **그 뒤 내부 GridView layout에서 생산하는 날짜 자식 비용 전체를 포함하지 않는다.** `activeBuildFlush` 역시 PageView sliver의 build flush이지 월 전체 갱신의 배타적 총 비용이 아니다.
- native `log`는 8,192 UTF-8 bytes에서 잘린다. 최초 진단에서 긴 build record의 뒤쪽 census가 잘리는 것을 확인하여 build 유형·자식 요약·개별 페이지·이벤트를 분리했다. 각 record는 최대 2,700 UTF-16 code units로 제한하고 회귀에서 JSON 파싱·byte 한도를 확인한다. 잘린 최초 출력은 완전한 census 표본으로 사용하지 않는다.
- [진단 회귀](Nelyx/eng/check-child-reuse-profile.mjs)는 실제 PageView의 재방문 시 다른 root 생성, nested GridView의 일반 GlobalKey 제외, 캐시의 4,096 Element 경계와 anchor 예외, 중첩 시간, 비활성 관측, reset 및 hook 원복을 확인한다. 합성 cache host는 자격 판정만 검사하며 실제 복귀 성능을 증명하지 않는다.

Windows 진단은 기본 bytecode·TDZ pruning off·기존 60Hz 입력과 이동량을 유지한 legacy baseline이다. 보통 정방향·약 2배 정방향·약 2배 역방향을 각각 포함하는 진단을 세 번 실행했다. 첫 번째는 native record 잘림, 두 번째는 수집 터미널의 전체 출력 한도로 일부 결과를 온전히 확보하지 못했다. 마지막 실행에서 짧은 record와 표준 오류까지 함께 수집하여 아래 수치·페이지 17행·이벤트 54개를 모두 확인했다. 세 번 모두 `performanceSample=false`이며 표시 관측은 `-NoScreen`으로 실행하지 않았다. 이 실행의 FPS·지연을 변경 전후 성능 수락 자료로 사용하지 않는다.

### 9.3 검증 및 채택 판단

마지막 Windows 진단에서 관측한 페이지는 phase 중복을 제외한 **15개 실제 root, 9개 index**다. 같은 index를 재방문한 root identity가 달라진 것도 확인했다.

| phase | 관측 root 수 | 월별 Element 수 | fresh root 요청 / 최종 회수 | 일반 GlobalKey / root | 보존 자격 통과 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 보통 정방향 | 5 | 898–1,010 | 4 / 4 | 5 | 0 |
| 약 2배 정방향 | 5 | 961–1,017 | 4 / 4 | 5 | 0 |
| 약 2배 역방향 | 7 | 898–1,017 | 6 / 6 | 5 | 0 |

5개의 일반 키가 붙은 Widget은 `RawGestureDetector` 2개, `CustomPaint`·`_ScrollSemantics`·`IgnorePointer` 각 1개다. 이와 별도로 허용된 framework anchor는 페이지당 28–31개이며 State는 247–281개다. 관측 페이지의 명시적 keep-alive 요구는 모두 false였다. 이는 모든 입력·focus 상태에서 keep-alive가 없다는 보장이 아니다.

한 페이지는 Element 예산에 들어가며 작은 owner 용량 1도 크기만 보면 가능하다. 그러나 모든 관측 root가 일반 GlobalKey 때문에 거절되므로 **예산 통과를 보존 자격 통과로 계산하지 않는다.** capacity 1/2를 실제로 켜거나 한도를 높이는 비교는 진행하지 않았다.

관측한 수명 구간의 배타적 합계는 다음과 같다. 아래 값은 §9.2에 정의한 부분 구간이며 월 전체 생산·갱신의 총 CPU 시간이 아니다.

| phase | 외부 fresh createChild (ms) | active build flush (ms) | deactivate/remove (ms) | 최종 root unmount (ms) |
| --- | ---: | ---: | ---: | ---: |
| 보통 정방향 | 15.172 | 26.218 | 18.698 | 28.745 |
| 약 2배 정방향 | 17.299 | 12.839 | 29.739 | 33.467 |
| 약 2배 역방향 | 25.155 | 20.357 | 46.743 | 38.554 |

delegate 교체는 phase별 4·3·5회였다. 기존 buildScope의 dirty flush 합계는 445.725·396.526·601.352ms, render commit은 11.243·8.407·13.125ms다. 이 값은 위 수명 구간과 겹치며 모두 더할 수 없다. inner GridView 생산 등을 포함한 월별 비용 분해나 구조 동기화 단독 기여율을 산출한 결과도 아니다.

역방향의 fresh 재진입 index는 136→135→134→133→132→131이다. 각 index의 마지막 이탈부터 재진입 요청 전까지 새로 요청된 서로 다른 자식 수는 1·3·4·5·6·7이었다. 이 수는 `createChild`의 missing-child 요청 trace로 정의하며, 방문 가능한 전체 월 수나 기존 활성 월의 갱신 횟수가 아니다. 작은 보존 용량이 역방향 전체를 hit로 바꿀 것이라고 가정할 수 없다. 실제 legacy는 dormant cache를 생성하지 않았고 resume는 0회다. **GlobalKey 자격 미충족 상태에서 가상의 hit, fresh/resume 순절감, 메모리 이득을 계산하지 않았다.**

실행 조건은 2560×1459 physical / DPI 192 / 165Hz host, 각 입력 phase의 실제 주입률은 약 60Hz였다. 월 정착은 +4·+3·−6개월, 주입 touch는 48·30·60개였다. 종료 receipt는 전체 입력 **수신=전달=수락=158, 거절=0, exitCode=0**이었다. 이 동등성은 입력 보존의 기능 근거이며 지연 개선의 근거가 아니다.

공급 식별자는 bytecode / `windows-hermes-260318099.0.7-optimized-v1`, package revision `b464dba92ad87bcfb77fae381a49a2394d9836d9`, bundle SHA-256 `6d3701cfe43ec485f96640f55fe326f2d8c6d05e2790410b1b5b0e29a5e57345`, diagnostic entry SHA-256 `94324c0cf7736675883091e55101b1df490392a650d4a0f20f111ccf7f06cdb1`이었다. package revision을 checkout `e222fd49`와 혼동하지 않는다. 판정에 사용한 core 7개 모듈(dormant cache·GlobalKey·Scrollable·scrollbar·sliver·FillViewport·PageView)과 Material calendar 생성 모듈은 현재 dist와 Windows 설치본의 SHA-256 일치를 별도로 확인했다.

검증 결과:

- 자식 재사용 진단 회귀 **PASS**. native 길이 제한 안의 분할 JSON과 hook 원복까지 포함한다.
- Source framework **20개 사례 PASS-scoped**, child reconciliation **PASS**. 원본 Flutter 실행 비교는 이번에 수행하지 않았다.
- 변경한 코드 4개 파일의 lint·format 및 `git diff --check` **PASS**.
- Windows 세 진단 모두 정상 종료. diagnostic entry·임시 package·세 session 경로가 사라지고 해당 diagnostic host process가 남지 않은 것을 확인했다. 로그·receipt·이전 설치본을 별도로 보관하지 않았다.

**채택 판단: 자격 gate FAIL / 후보 보류.** 일반 PageView에서의 조건부 가능성과 실제 달력에 적용 가능한 해법을 구분한다. 자격에 실패한 상태에서 큰 정책을 구현하지 말라는 §7의 중단 조건을 적용한다. dormant 복귀의 최신 설정·inherited·focus·ticker·실패 복원과 순성능은 이번 실행으로 검증되지 않았다.

### 9.4 재실행 명령

저장소 루트의 PowerShell 7에서 실행한다. Windows 실행기는 전체 20분 timeout과 소유 process·임시 package·entry·session의 `finally` 정리를 적용한다. 검사 결과는 표준 출력으로 확인하고 로그·receipt·이전 package를 추가 보관하지 않는다.

```powershell
node Nelyx/eng/check-child-reuse-profile.mjs
node Nelyx/eng/check-source-framework.mjs

$previousProfile = $env:NELYX_JANK_BUILD_PROFILE
try {
  $env:NELYX_JANK_BUILD_PROFILE = '1'
  pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 `
    -Scenario calendar -HermesMode bytecode -Runs 1 -NoScreen
  if ($LASTEXITCODE -ne 0) { throw 'Calendar child feasibility diagnostic failed' }
} finally {
  $env:NELYX_JANK_BUILD_PROFILE = $previousProfile
}
```

### 9.5 남은 범위

공통 PageView/FillViewport의 childPolicy·delegate 세대 계약, 활성 자식 순서 변경, dormant resume/eviction의 순비용 비교, calendar opt-in, 변경 전후 각 3회 성능 비교는 **notImplemented / notVerified**다. 단계 A에서 탈락했으므로 §7의 조건에 따라 진행하지 않는다. 새 정책의 focus·ticker·inherited·GlobalKey retake·실패 복원과 Gallery/Testbed/Web 수락도 주장하지 않는다.

이 후보를 다시 추진하려면 내부 일반 GlobalKey를 가진 페이지의 수명·재취득 계약을 먼저 별도 설계해야 한다. 이를 이번 후보의 cache 확대나 자격 완화로 대체하지 않는다. 공통 cold 생산/구조 동기화의 다른 후보는 실제 비용 범위를 확인한 별도 작업으로 남긴다. **전체 상태는 PARTIAL / performanceAccepted=false**다.

## 10. 2026-11-17 후속 작업 — 공통 build·수명·동기화 비용 분해

### 10.1 다음 작업의 범위와 코드 판단

같은 HEAD `e222fd49`에서 §9의 미커밋 진단 변경을 보존하고 시작했다. 보존 자격에 실패한 단계 B를 진행하지 않고, §6·§9.5의 다음 작업인 **공통 필수 경로의 비용 분해와 후속 수정 대상 판정**을 수행했다. 이번 작업 단위는 완료했으며, 엔진 제품 코드의 최적화나 성능 수락 완료를 뜻하지 않는다.

코드에서 먼저 확인한 경계는 다음과 같다.

- `Element.rebuild`는 모든 build 전에 render owner를 등록한다. 그러나 `OwnerTransaction`은 이미 owner를 중복 제거하며, 동기화는 실제 자식이 같으면 교체하지 않는다. 등록 시도·commit·실제 교체를 같은 횟수로 계산할 수 없다.
- `RenderObjectElement._commitRenderChildren`는 virtual 동기화 hook을 호출한다. Viewport는 이때 center도 갱신하고, sliver는 별도의 연결 계약을 사용한다. custom hook과 `renderObjects` getter도 존재하므로 `setChildren`을 호출하지 않았다는 이유만으로 hook 전체를 제거할 수 없다.
- `StatefulElement.mount`의 State 초기화, `RenderObjectElement.mount`의 render 생성·연결, `Element.reconcile` 안의 mount/update는 중첩된다. 기존 외부 PageView `freshChild` 시간은 내부 GridView에서 나중에 만드는 날짜 subtree 전체를 포함하지 않는다. 외부 페이지 시간만으로 cold mount의 기여를 단정하지 않았다.

따라서 큰 정책 변경이나 등록 삭제에 앞서 이 공통 경로만 구분하는 진단을 추가했다. cache·prewarm·AOT 전환이나 달력 생성 코드 변경은 적용하지 않았다.

### 10.2 추가한 진단과 해석 제한

[framework 작업 진단](Nelyx/eng/windows-jank-framework-profile.ts)을 기존 build profile에 연결했다. `NELYX_JANK_BUILD_PROFILE=1`인 calendar bytecode 진단에서만 inlining하며 일반 bundle에는 넣지 않는다.

- Element의 첫 성공 rebuild 이전 호출과 그 이후 rebuild를 구분한다. 관측 phase 밖에서도 성공 여부는 WeakSet으로 추적하며 phase reset으로 기존 Element를 새 Element로 세지 않는다. 실패한 호출은 `failed`에 별도로 센다. 이 카운터는 base method 호출 수이며 Widget·State 할당량이나 월 개수의 대체 지표가 아니다.
- 공통 reconcile, base/State/render mount와 update, render attach/detach, deactivate/unmount, owner 등록·flush·commit을 측정한다. 같은 진단 stack 안의 중첩 구간만 빼서 `exclusiveMs`를 계산한다. first/later rebuild의 exclusive 시간은 관측한 reconcile·mount 등의 내부 호출을 뺀 나머지이지 순수 Widget builder 시간은 아니다.
- `ownerCommits`는 실제 base commit 진입 수다. `baseSetChildrenInCommit`은 그 실행 중 기존 `RenderObject.setChildren` base가 호출된 횟수만 센다. 진단을 위해 projection getter를 다시 실행하지 않는다. custom override가 base를 호출하지 않으면 이 카운터에 나타나지 않으며, base 호출이 있어도 실제 구조가 같을 수 있다.
- 같은 owner의 base 호출 경로만 관측한다. `super`를 호출하지 않는 custom 구현의 자체 비용 전체, layout 기하·paint·GPU·프레임 전체 시간은 이 표의 범위가 아니다. build scope·자식 수명 진단과도 겹치므로 합산하지 않는다. 관측 wrapper·clock·집계의 비용이 들어간 수치를 일반 실행 CPU 비용이나 제거 가능한 시간으로 환산하지 않는다.
- 결과는 기존 native 길이 제한에 맞춰 `FAST_FRAMEWORK_PROFILE`과 종류별 `FAST_FRAMEWORK_INTERVAL`로 분리한다. snapshot은 집계 값의 사본이며 별도의 Element 트리나 강한 참조 cache를 만들지 않는다. dispose에서 prototype과 owner의 원래 property descriptor를 복원한다.

### 10.3 Windows 진단 1회의 결과

PowerShell 7에서 §9.4와 같은 명령으로 **bytecode·기존 pruning off 공급·60Hz 가상 입력·Runs 1·NoScreen**을 실행했다. 세 phase 모두 기존 이동량과 월 정착을 통과했고, 관측 interval의 실패 호출은 0개였다. `performanceSample=false`이며 표시 화면은 관측하지 않았다. 아래 값은 모두 phase 누적 진단 값이다.

| phase | base mount / 첫 rebuild | 후속 rebuild | owner 등록 시도 | owner commit | commit 중 base setChildren |
| --- | ---: | ---: | ---: | ---: | ---: |
| 보통 정방향 | 3,879 / 3,879 | 9,187 | 18,236 | 4,717 | 0 |
| 약 2배 정방향 | 3,956 / 3,956 | 5,584 | 14,810 | 3,478 | 0 |
| 약 2배 역방향 | 5,871 / 5,871 | 7,011 | 20,705 | 4,780 | 0 |

다음 표는 위 진단 내부에서만 중첩을 제거한 시간이다. mount 계열은 base·State·render mount와 render attach의 exclusive 합, 회수 계열은 render detach·base/State deactivate·base/State/render unmount의 exclusive 합이다. owner 계열은 등록·flush·commit의 exclusive 합이다. 각 월의 전체 시간이나 프레임 전체 시간으로 해석하지 않는다.

| phase | mount·연결 (ms) | 첫 rebuild 잔여 (ms) | 후속 rebuild 잔여 (ms) | reconcile 잔여 (ms) | 회수 계열 (ms) | owner 등록·flush·commit (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 보통 정방향 | 95.866 | 86.312 | 171.536 | 57.670 | 77.504 | 24.839 |
| 약 2배 정방향 | 95.970 | 86.591 | 130.777 | 39.208 | 79.804 | 18.534 |
| 약 2배 역방향 | 139.351 | 146.048 | 122.132 | 52.357 | 119.260 | 22.532 |

이 표에서 제외한 base/State update의 exclusive 합은 각각 33.267·16.373·23.925ms다. 별도 buildScope 진단의 dirty flush는 529.975·441.326·594.573ms, render commit은 18.573·13.419·15.434ms였다. 두 진단은 측정 경계와 중첩이 달라 서로 더하거나 분모로 사용하지 않는다.

이번 관측은 **등록 시도와 실제 commit 사이의 중복 제거가 작동하며, 관측한 commit에서 base 자식 교체가 없었음**을 지지한다. 그러나 owner 계열보다 첫/후속 rebuild와 mount·회수의 누적 시간이 컸다. 그러므로 등록 축소를 전체 문제의 주된 단독 해법으로 채택하지 않는다. 보통·빠른 정방향에서는 후속 rebuild 잔여도 첫 rebuild 잔여보다 컸으므로 **cold 생산 하나가 지배적이라는 판단도 채택하지 않는다.** phase별 호출량과 관측 overhead가 다르며, 이 1회로 통계적 기여율이나 FPS 개선율을 산출하지 않는다.

종료 receipt는 **수신=전달=수락=158, 거부=0, exitCode=0**이었다. 보통/빠른 정방향/역방향은 6·6·12 gestures, 수락 입력 48·30·60개와 월 이동 +4·+3·−6을 유지했다. 유효 주입률은 각각 59.99975·59.99994·59.99978Hz다. 입력 보존과 월 정착은 기능 근거이며 낮은 지연이나 표시 FPS를 증명하지 않는다.

공급은 `windows-hermes-260318099.0.7-optimized-v1`, package revision `b464dba92ad87bcfb77fae381a49a2394d9836d9`였다. bundle SHA-256은 `62ad61272289320ee551ebe81b39011dfdb2134ee7013608c05e2b8f60f9efb3`, diagnostic entry SHA-256은 `c3d3c61189b6dac49008f1ca000681c4e6033960ac1fd625b8e6ae6e3f91dcc5`다. 새 관측 대상인 framework·render object 두 모듈은 현재 Source와 dist source-map의 `sourcesContent` 일치, dist와 실제 Windows 설치본의 JS SHA-256 일치를 확인했다. package revision을 현재 checkout revision으로 표기하지 않는다.

### 10.4 회귀와 다음 수정 대상

- 자식/framework 진단 회귀 **PASS**: 실제 PageView·nested GridView, 첫/후속 build 구분, phase 밖 build와 foreign owner 제외, 중첩 시간·snapshot 격리, 원래 예외 값과 custom commit receiver, 실패 재시도·commit 중 다음 경계 재등록, virtual projection 추가 호출 없음, base setChildren 호출과 실제 변경의 구분, reset·hook 원복·분할 JSON 길이를 검사한다.
- Source framework **20개 사례 PASS-scoped**, child reconciliation **PASS**. 원본 Flutter 실행 비교는 이번에 수행하지 않았다.
- 변경한 진단 코드의 lint·format과 `git diff --check` **PASS**. 제품 Source를 바꾸지 않아 SDK/native 전체 재빌드나 제품 성능 비교는 수행하지 않았다. Windows 진단 bundle은 현재 공급에서 새로 생성·실행했다.
- 실행기의 `finally` 정리 이후 진단 entry·package·batch/session과 해당 host가 남지 않은 것을 확인했다. 로그·receipt·설치본 사본은 추가 보관하지 않았다.

**후속 수정 대상은 첫/후속 build 양쪽의 공통 Widget 구성·설정 전달 경로다.** 다음 작업에서는 기존 유형별 build 집계와 `ComponentElement.performRebuild`, State build, render update의 실제 호출 코드를 연결해 반복 탐색·중복 자원 등록 등 제거 가능한 작업을 구체적으로 입증한다. callback identity나 Widget type/key 일치만으로 build/update를 건너뛰지 않고, Focus·Ink·Semantics 기능을 줄이지 않는다. 이번 잔여 시간을 특정 함수 하나의 비용으로 단정하거나 새 pooling·typed 전환을 바로 시작하지 않는다.

공통 정책 단계 B·C, GlobalKey 보존 계약, 엔진 최적화 patch와 변경 전후 성능 비교, Gallery/Testbed/Web 제품 수락은 여전히 미완료다. **전체 상태는 PARTIAL / performanceAccepted=false**이며 이번 진단 PASS를 제품 성능 PASS로 승격하지 않는다.
