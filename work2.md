# Windows 스크롤 성능 개선의 새 접근: 필요한 자식 우선 갱신과 제한된 수명 보존

작성일: 2026-11-17

상태: **PAUSED / PARTIAL — 사용자 중간 마무리 요청으로 중지 / §15 진단의 JSC JIT 달력 30fps·정체 및 공통 기능 PASS-scoped / §16 공통 engine factory·정식 CLI 연결 Source 작성 중, 새 C++ 빌드·공급·실행 미검증 / workspace SDK·CLI와 설치 공급 불일치 / 기본 설치 제품은 §15.7 Hermes / performanceAccepted=false / 자동 재개 금지**

원설계 검토 기준: HEAD `0d917cab`과 문서 작성 전 깨끗한 작업 트리. [원인 분석](performance-cause-analysis.md)의 `720d22d6` 기준 및 [기존 작업 기록](work.md)의 측정 이력과 구분한다. 아래 §1–8은 코드 검토만 수행했던 원설계다. 사용자의 `work2.md 작업해줘` 요청에 따른 HEAD `e222fd49`의 구현·진단·판정은 **§9**, 이후 `work2.md의 다음작업해줘` 요청의 공통 비용 분해는 **§10**에 기록한다.

이번 `설계와 구현 적용까지` 요청에 따른 제품 Source 변경과 변경 전후 비교는 **§11**에 기록한다. §9–10의 `notImplemented`는 당시 상태이며, 새로운 dormant 정책은 여전히 보류한다.

이후 `work2.md와 파생되는 작업` 요청의 최초 렌더 설정·metrics 귀속 수정과 제품 검증은 **§12**에 기록한다.

계속 작업한 공통 빈 Ink의 변환 제거와 검증은 **§13**에 기록한다.

이후 기본 Material 지역화 데이터의 앱 소유·Overlay 전달 후보를 시험한 뒤 철회한 판단과 복원은 **§14**에 기록한다.

사용자의 Hermes/JSC interpreter 질문에 따른 direct host 연결·동일 JS의 interpreter/JIT 비교·공통 기능 검증과 후속 제품 경로 작업은 **§15**에 기록한다. 전체 30fps 수락 목표는 유지한다.

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

## 11. 2026-11-17 설계·구현 적용 — 공통 inherited 조상 순회

### 11.1 코드에서 확인한 제거 대상과 적용 범위

시작 checkout은 `bd8e47f6`, tracked 작업 트리는 깨끗했다. 사용자의 이번 요청은 §10.4의 다음 대상을 설계 문서에서 끝내지 않고 제품 Source에 적용하는 범위다. §9에서 탈락한 dormant 정책과 GlobalKey 보존 자격은 변경하지 않는다.

`FocusState.build → FocusAttachment.reparent → findFocusAncestor`는 첫 build와 설정 갱신 모두에서 `visitAncestorElements`로 일반 wrapper까지 방문하고 각 Widget의 marker를 조회한다. `focusOrderFor`·`traversalDirections`도 같은 순회를 반복하며, `Actions`는 일반 Element를 방문한 뒤 InheritedElement만 골라낸다. 이 후보는 이 조회의 방문 대상만 줄인다. `reparent`의 cycle·View 소유권·subtree 검사와 FocusNode의 실제 재연결은 모두 유지한다. 이 코드 판단을 §10의 잔여 시간 전체에 대한 원인 확정이나 FPS 예측으로 해석하지 않는다.

Focus marker의 유일한 생산자는 `FocusInheritedScope`, order marker는 `FocusTraversalOrder`, direction marker는 `Directionality`이며 모두 inherited Widget이다. 반면 `traversalScrollable`의 marker는 일반 스크롤 Widget에도 있으므로 기존 전체 순회를 유지한다. 이 구분은 callback identity나 Widget type/key로 build를 생략하는 계약이 아니다.

### 11.2 구현 계약

- 공통 `visitAncestorInheritedElements`는 이미 존재하는 `inheritedIndex` 연결로 일반 wrapper 구간을 건너뛰며 가장 가까운 provider부터 방문한다. 별도 ancestry Map·Widget 결과 cache·트리를 만들지 않는다.
- 일반 Element의 원래 `visitAncestorElements` 경로에만 이 순회를 적용한다. 사용자 BuildContext/Element의 override와 prototype 교체는 원래 virtual 순회를 정확한 receiver로 호출한다. 동적 type token 구간은 기존 parent 연결로 내려가면서 InheritedElement만 방문한다.
- callback이 false를 반환하면 즉시 종료한다. callback 뒤에는 현재 provider의 live parent를 읽으며, marker 값·Widget·설정·provider 선택 결과는 보관하지 않는다. 중첩 조회와 callback/Widget getter의 예외를 그대로 전달한다.
- mount·deactivate·GlobalKey activate의 기존 inherited 연결 갱신을 재사용한다. 새 dependency를 등록하지 않고 State build, didUpdateWidget, inherited 알림과 Focus·Ink·Semantics의 구성·입력 계약을 유지한다.
- Focus/order/direction의 내부 marker 등록 인자는 실제 생산 계약에 맞게 InheritedWidget으로 표현한다. 전체 Element가 필요한 scroll marker와 일반 공개 조상 순회는 유지한다.

### 11.3 검증 순서와 판정

설계 후 기존 bytecode·pruning off·60Hz 입력의 달력 baseline 3회를 먼저 확보한다. Source 변경 뒤 국소 회귀에서 순서·중단·live 설정·동적 token·사용자 순회·GlobalKey 이동·예외·종료와 실제 Focus/Actions 연결을 확인하고, core를 한 번 빌드해 현재 runner에 공급한다. 같은 달력 3회와 Gallery·가변 목록·Testbed·Web 관련 회귀를 확인한다. 모든 실행은 20분 timeout을 적용하며 임시 산출물과 소유 process는 finally에서 정리한다.

방문량 감소와 전체 성능 수락을 구분한다. 결과를 확인하기 전에는 이 절을 완료나 성능 개선으로 표시하지 않는다. §7의 전체 기준과 `performanceAccepted=false`를 유지한다. 이 실행의 검증 결과와 남은 범위는 아래에 기록한다.

### 11.4 구현과 국소 검증 결과

- [공통 순회](Nelyx/src/framework/widgets/framework.ts#L1214)와 [진입 함수](Nelyx/src/framework/widgets/framework.ts#L1547)를 제품 Source에 추가하고 [Focus 부모 조회](Nelyx/src/framework/widgets/focus-tree-context.ts), [order·direction 조회](Nelyx/src/framework/widgets/focus-traversal-context.ts), [Actions 조회](Nelyx/src/framework/widgets/actions.ts)에 적용했다. `visitAncestorElements` 자체와 scroll marker 경로는 유지했다. runtime native 엔진·VM·달력 생성 파일은 변경하지 않았다.
- [새 회귀](Nelyx/eng/check-inherited-traversal.mjs) **PASS**. 64개 일반 wrapper를 둔 fixture에서 전체 조상 방문 67회와 provider 방문 2회를 구분했다. 이는 방문량의 구조적 증거이며 실제 달력의 방문량·CPU·FPS 절감 수치가 아니다. 순서·중단·live Widget 값과 getter 예외·중첩 순회·callback 후 live parent·사용자 Context/Element 및 prototype override·receiver·동적 token·GlobalKey 이동·종료를 검사한다. 실제 Focus/Actions의 구성·설정 교체·primary focus·scope 이동·최신 action과 order/direction 반영도 확인했다.
- Source framework **20 cases PASS-scoped**, Source의 Hermes lowering 적용 후 같은 회귀 **PASS-scoped**, child reconciliation·dependency scope·inherited ancestor·retained paint **PASS**. lowering 회귀는 Node에서 변환 결과를 실행한 검사이고, 아래 Windows bytecode 앱 실행과 구분한다. 원본 Flutter oracle을 새로 실행하지는 않았다.
- 기존 child/framework 진단 회귀 **PASS**, 전체 `npm.cmd run check:types` **PASS**, 변경 코드 5개 파일 lint·format 및 `git diff --check` **PASS**. 별도 ESM 진입점으로 FocusNode/FocusManager를 import한 연결·회수도 통과했다.
- core만 한 번 빌드하고 Demo Windows/Web·Testbed Windows에 공급·설치했다. 변경한 4개 모듈의 Source와 dist source-map `sourcesContent` 일치, dist JS와 세 runner 설치본의 SHA-256 일치, npm 설치 receipt/공급 archive의 일치를 확인했다. 세 runner의 manifest/lock 변경은 같은 core 공급을 가리킨다. 전체 SDK/native 재빌드는 하지 않았다.

공급 직후 첫 변경 후 시도는 npm 설치 전이어서 공급/설치본 일치 검사에서 앱 시작 전에 거절됐다. Web 공급 중 lock-only 갱신이 기존 `hermes-estree@0.32.0` 항목을 제거한 것도 확인해 해당 기존 항목을 복원하고 `npm ci --workspaces=false`를 통과시켰다. 이 두 준비 실패는 기능·FPS 표본에 포함하지 않았다. 공급 검사를 우회하거나 설치 receipt만 고쳐 성공 처리하지 않았다.

### 11.5 Windows 달력 변경 전후 각 3회

두 공급 모두 bytecode·pruning off, 동일 entry `9b550ab9…`, host `67dbdc22…`, VM/toolchain `dbd11135…`, 2560×1459 physical / DPI 192 / 165Hz와 기존 60Hz 입력을 사용했다. build/heap 관측 hook은 넣지 않았고 모든 유효 실행은 `performanceSample=true`다. baseline 3회 이후 core 변경 공급의 3회를 실행했다. bundle은 baseline `d84b9452…`, 변경 후 `20b2fabe…`로 각 공급의 세 실행 안에서 동일했다. package revision은 공통 공급 식별자인 `b464dba9…`이며 checkout `bd8e47f6`와 다르다.

아래 각 셀의 세 값은 실행 1·2·3의 원자료 요약이다. engine FPS는 native surface-copy fence 완료율, 표시 FPS는 desktop frame tag 관측 하한이다. 실제 scanout FPS는 미검증이다.

| phase | 변경 전 engine FPS | 변경 후 engine FPS | 변경 전 표시 FPS 하한 | 변경 후 표시 FPS 하한 |
| --- | --- | --- | --- | --- |
| 보통 정방향 | 36.355 / 31.643 / 33.230 | 32.963 / 32.225 / 34.971 | 29.977 / 27.624 / 28.730 | 28.766 / 28.181 / 28.684 |
| 약 2배 정방향 | 29.865 / 31.245 / 27.567 | 27.041 / 30.455 / 29.309 | 24.349 / 26.757 / 23.879 | 23.389 / 28.327 / 24.140 |
| 약 2배 역방향 | 21.596 / 18.433 / 20.820 | 17.595 / 18.384 / 23.541 | 19.490 / 17.022 / 18.019 | 16.759 / 14.904 / 20.332 |

간격 tail도 함께 확인했다. 아래는 각 실행의 p95/p99/최장을 구한 뒤 해당 지표의 3회 중앙값을 비교한 값(ms)이다. 여러 실행의 프레임을 합쳐 새 percentile을 구한 값이 아니다.

| phase | 표시 간격 p95 / p99 / 최장 전→후 | surface 간격 p95 / p99 / 최장 전→후 |
| --- | --- | --- |
| 보통 정방향 | 128.645 / 149.637 / 149.637 → 137.773 / 188.115 / 188.115 | 128.719 / 147.165 / 147.165 → 135.653 / 186.538 / 186.538 |
| 약 2배 정방향 | 174.736 / 199.582 / 199.582 → 146.512 / 199.708 / 199.708 | 177.675 / 199.479 / 199.479 → 136.275 / 206.130 / 206.130 |
| 약 2배 역방향 | 183.360 / 296.548 / 296.548 → 199.399 / 241.132 / 241.132 | 183.046 / 281.056 / 281.056 → 210.292 / 244.372 / 244.372 |

표시 관측의 ≥100ms 진행 정체를 같은 정의로 비교했다. 총 시간과 최장은 ms이며 아래 `전→후`는 phase별 3회 중앙값이다. 작은 세 표본을 통계적 유의성이나 안정된 개선율로 해석하지 않는다.

| phase | 변경 전 정체 횟수 3회 | 변경 후 정체 횟수 3회 | 횟수 중앙값 전→후 | 총 시간 중앙값 전→후 | 최장 중앙값 전→후 |
| --- | --- | --- | --- | --- | --- |
| 보통 정방향 | 7 / 7 / 7 | 8 / 6 / 7 | 7→7 | 950.990→1013.147 | 199.721→197.180 |
| 약 2배 정방향 | 3 / 5 / 4 | 4 / 4 / 4 | 4→4 | 615.523→639.711 | 199.582→217.944 |
| 약 2배 역방향 | 5 / 8 / 5 | 5 / 6 / 7 | 5→6 | 1000.026→1046.331 | 296.548→241.132 |

**판정: 전체 30fps 기준 FAIL / 정체 감소 기준 FAIL / 일관된 성능 이득 미입증.** 모든 phase의 표시 FPS 하한이 30 미만이고, 정체 총 시간 중앙값은 세 phase 모두 증가했다. 빠른 정방향의 최장과 역방향의 횟수 중앙값도 증가했다. 방문 대상 축소가 이 변화의 단독 원인이라고 확정할 수는 없으며, 이 비교로 patch의 순성능 이득을 수락하지 않는다. build·생산·회수 비용 전체를 해결했다는 결론도 내리지 않는다.

여섯 유효 실행 모두 기존 입력 48/30/60 touch, 월 정착 `November 2026→March 2027→June 2027→December 2026`, UIA·정상 종료를 통과했다. 종료 입력은 매회 **수신=전달=수락=158, 거부=0, exitCode=0**이었다. 양쪽의 screen·surface 간격 p95/p99/최장은 실행 summary에서 관측했다. 입력→surface는 변경 후 수치를 포함한 비교 요약을 확보하지 않았으므로 지연 개선은 **notVerified**다. 입력 수 보존으로 이를 대신하지 않는다. 별도 로그·receipt JSON은 보관하지 않았다.

### 11.6 공통 기능·제품 실행·정리

| 확인 범위 | 결과와 경계 |
| --- | --- |
| Windows Gallery 1회 | 편집·theme/resize·wheel 왕복·UIA·종료 PASS. 표시 FPS 하한 cold/return/warm 73.334 / 58.346 / 57.479, ≥100ms 정체 모두 0. 입력 177개 전부 수신=전달=수락, 거부 0, wheel 합계 수신=전달=480 |
| Windows 가변 목록 1회 | UIA 항목의 하강·복귀·warm membership 일치와 종료 PASS. 표시 FPS 하한 69.768 / 58.478 / 54.001, ≥100ms 정체 모두 0. 입력 159개 전부 보존, 거부 0, wheel 합계 수신=전달=480 |
| 일반 Testbed 1회 | 실제 앱의 MixedScroll 한글/emoji 편집 유지·왕복 스크롤·counter 갱신, 별도 목록의 UIA 항목 진행과 정상 종료 PASS. 입력 118개 전부 보존, 거부 0, wheel 합계 수신=전달=288. Testbed 전체 화면·표시 FPS 수락은 아님 |
| 일반 Demo Windows | `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`이 변경 입력을 감지해 현재 bytecode 제품 package를 재빌드. 첫 프레임과 exit 0, `forced=false` PASS. bundle `03ed704e…`. 진단 entry 실행과 구분 |
| Demo Web | 현재 core 설치본의 static build 및 Chromium WebGL2/SwiftShader 기능 회귀 4 cases PASS. 첫 프레임·Gallery wheel 복귀·한글/emoji 편집과 theme/breakpoint 유지·달력 forward/reverse/close 확인. 최종 Selection 화면도 시각 확인. bundle `6cf90f57…`. 브라우저 실장치 성능·다른 브라우저·Skia native source 재빌드 수락은 아님 |

Gallery·목록의 각 1회 결과는 관련 기능 회귀의 범위이며, 새 플랫폼 전체 성능 수락이나 달력 비교의 보충 표본이 아니다. 공통 순회 변경은 제품 Source와 현재 설치 공급에 적용해 두었다. **방문량 축소·기능 정확성의 확인과 patch의 순성능 이득 미수락을 구분한다.** 이것만으로 달력의 후속 build·fresh 생산·회수 비용을 해결했다고 보지 않으며 추가 cache/prewarm·AOT 확대의 근거로 사용하지 않는다.

각 runner의 finally 이후 diagnostic entry·package·batch/session과 Web 임시 screenshot/profile을 회수했다. 현재 core dist만 유지하고 staging·이전 dist와 공급용 임시 package를 남기지 않았다. 소유 native host와 Web 검사 프로세스가 종료된 것도 확인했다. 기존 사용자의 `.tmp/calendar-fast-*` 자료를 이동하거나 지우지 않았다.

### 11.7 완료 범위와 재실행

이번 작업 단위의 **공통 조회 설계·제품 Source 구현/연결·기능 회귀·동일 조건 달력 각 3회 비교는 완료**했다. 전체 목표는 **PARTIAL / performanceAccepted=false**다. §9의 dormant 자격 실패·GlobalKey 수명 계약, PageView 정책·delegate 세대 API와 실제 calendar opt-in은 계속 보류한다. 이번에 새 보존 정책을 구현하거나 활성화한 것은 아니다. 달력 30fps·정체 감소·입력 지연 개선과 physical trackpad·scanout·screen reader·장시간 자원 수락도 완료로 표시하지 않는다.

저장소 루트의 PowerShell 7에서 아래 진입점은 자체 20분 timeout과 임시 작업 정리를 적용한다. 현재 공급에서 실행하는 기능/성능 검사이며 위 비교의 과거 baseline을 다시 만드는 명령은 아니다.

```powershell
node Nelyx/eng/check-inherited-traversal.mjs
node Nelyx/eng/check-source-framework.mjs
node Nelyx/eng/check-child-reuse-profile.mjs
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 `
  -Scenario calendar -HermesMode bytecode -Runs 3
```

## 12. 2026-11-17 후속 구현 — 최초 렌더 설정의 중복 적용 제거

### 12.1 코드 근거와 범위

시작 checkout은 `0b549dfa`이며 tracked 작업 트리는 깨끗했다. 이번 `work2.md와 파생되는 작업` 요청은 §11의 실패 판정을 유지하면서 공통 필수 생산 경로를 이어서 다룬다. §9의 dormant 자격 검사를 완화하거나 보존 정책을 활성화하지 않는다.

`RenderObjectElement.mount → createRenderObject` 뒤에 예약된 첫 `build → updateRenderObject`가 이어진다. 특히 내부 `PlainTextWidget`은 `Text.make`와 `Text.configure` 양쪽에서 `resolveTextConfiguration`을 실행하므로 첫 생산에 스타일 병합·locale/방향·배율 해석과 paragraph configuration capture를 두 번 수행했다. 내부 `RichParagraphWidget`도 생성 직후 registrar·selection·텍스트 semantics를 다시 전달한다. 로컬 Flutter 고정 원본 `71e4717a61786faab4c7aa39825989305ed29e8a`의 `RenderObjectElement.mount`는 생성 후 최초 dirty flag를 정리하며 `updateRenderObject`는 후속 update/rebuild에서 호출한다. 이 원본의 호출 구분을 현재 queued-build 구조에 제한적으로 적용한다.

모든 render Widget에서 첫 update를 없애면 `SizedBox` 등의 `make/configure` 어댑터와 사용자 훅이 깨질 수 있다. 따라서 기본은 기존 첫 update이며, **완전한 최초 설정을 갖춘 내부 plain text 어댑터만 명시적으로 자격을 제공**한다. 공개 MouseRegion/Listener/Semantics를 일괄 등록하지 않는다. 이는 활성 State/Widget build 생략이나 type/key·callback identity를 이용한 결과 캐시가 아니다.

### 12.2 구현 계약

- `RenderObjectWidget._hasInitialRenderObjectConfiguration`의 기본은 false다. `RenderObjectElement`는 opt-in 생성에 대한 첫 설정 완료 표시만 보관하고, 첫 build 전에 소비한다. Widget update·명시적 dirty·의존성 변경·GlobalKey activation은 이를 무효화한다. 첫 child getter 실패 뒤 재시도도 갱신을 다시 수행한다.
- plain text는 약한 생성 증명과 내부 어댑터·공개 `Text.make/configure`의 원래 함수 descriptor, 정확한 기본 prototype 및 자체 data field를 확인한다. subclass·Proxy·함수 교체·자체/prototype accessor가 있는 경우 기존 호출로 돌아가며 자격 검사에서 그 getter를 추가로 호출하지 않는다. 생성 시 text role/name/id semantics와 selection 설정도 완결한다. 후속 build는 최신 options·스타일·locale·방향·배율을 다시 읽는다. WeakSet의 생성 증명은 Text 결과나 트리를 보존하지 않는다.
- rich text는 **기존 초기 update를 유지**한다. 최초 후보의 captured span 조건만으로는 생성 후 공개 `toPlainText`·`visitDirectChildren` prototype 교체를 증명할 수 없었다. 이 두 경우를 실제 회귀에 추가하고 rich text의 opt-in을 철회했다. 아래 최초 후보 비교와 최종 공급 비교를 구분한다.
- 생성 중 `services.readMetrics`를 실제 렌더 Element에 귀속시킨다. 기존에는 생성자의 호출자 Element가 currentElement여서 첫 update를 생략하면 잘못된 metrics reader가 남을 수 있었다. 생성 성공·예외 모두 이전 currentElement를 복원한다. 별도 provider/result cache나 트리를 만들지 않는다.
- Windows 비교 출력에 이미 측정하는 `inputQueue`와 `inputToSurface`를 함께 남긴다. 입력 개수 보존을 지연 개선으로 간주하지 않는다.

### 12.3 Source 검증

[렌더 초기화 회귀](Nelyx/eng/check-render-initialization.mjs)는 실제 Text의 최초 옵션 해석 1회, 후속 live 갱신, 초기 dirty/의존성/Widget 무효화·실패 재시도, 사용자 Text/span 훅·생성 후 prototype 교체, 생성 metrics 귀속·예외 복원, GlobalKey 이동·종료와 미자격 SizedBox의 초기 설정을 검사했다. **PASS**다. 이 1회는 configuration 해석 횟수이며 layout·shaping·GPU 횟수나 성능 개선율이 아니다.

Source framework와 Hermes lowering 적용 회귀, child reconciliation·dependency scope·inherited traversal·retained paint·child/framework profile·전체 workspace 타입 검사 및 변경 코드 lint/format을 통과했다. 실제 고정 Flutter 원본 oracle **25 cases PASS-scoped**도 수행했다. 기존 PageView/list/grid/paint 비교의 범위이며 새 텍스트 초기화의 모든 Dart lifecycle이나 물리 입력을 수락하는 결과는 아니다.

제품 Source 변경 전 현재 공급의 calendar bytecode·pruning off·기존 60Hz 입력으로 유효 baseline 3회를 확보했다. bundle `20b2fabe…`, entry `9b550ab9…`, host `67dbdc22…`, toolchain `dbd11135…`와 2560×1459 physical / DPI 192 / 165Hz를 유지했다. baseline의 입력은 매회 수신=전달=수락=158, 거부=0, exitCode=0이었다.

최종 공급의 달력 3회 비교 및 Demo Web·Gallery·가변 목록·일반 Testbed·일반 Demo Windows 회귀를 완료했다. 공급과 제품별 근거는 아래 §12.6–12.7에 기록한다. **전체 성능 상태는 PARTIAL / performanceAccepted=false**를 유지한다.

### 12.4 최초 후보의 동일 조건 달력 각 3회 비교

새 core archive는 `293691b8…`이며 Demo Windows/Web·Testbed Windows에 공급·설치했다. Source→현재 dist의 source-map 입력 645개를 검사했고, 변경한 framework/basic/rich-text 세 모듈의 dist JS와 각 설치본 SHA-256을 대조했다. 이전 공급과 같은 native host·VM/toolchain·entry·viewport·60Hz 입력을 사용했다. 변경 후 bundle `c2cb0672…`와 application Source `0865508c…`는 세 실행에서 같고, 모두 `performanceSample=true`다. build/heap/CPU profile hook을 넣지 않았다.

이 표는 RichText opt-in 철회와 Text의 Proxy/accessor 자격 보강 **이전 후보**의 관측이다. 최종 제품 공급의 수락 자료로 승격하지 않으며, 최종 공급 비교는 후속 절에 기록한다. baseline 3회는 유지하고 최종 후보만 다시 측정한다.

각 셀은 실행 1·2·3의 값이다. engine FPS는 native surface-copy fence 완료율이고 표시 FPS는 desktop frame tag 관측 하한이다. scanout·물리 트랙패드 성능으로 해석하지 않는다.

| phase | 변경 전 engine FPS | 변경 후 engine FPS | 변경 전 표시 FPS 하한 | 변경 후 표시 FPS 하한 |
| --- | --- | --- | --- | --- |
| 보통 정방향 | 31.899 / 30.054 / 31.795 | 35.589 / 30.945 / 31.871 | 29.159 / 25.866 / 26.321 | 29.160 / 25.449 / 26.528 |
| 약 2배 정방향 | 27.693 / 29.132 / 33.944 | 27.812 / 31.035 / 32.917 | 26.546 / 25.606 / 30.068 | 22.167 / 26.765 / 28.416 |
| 약 2배 역방향 | 26.686 / 21.161 / 12.365 | 20.441 / 19.166 / 17.087 | 22.329 / 18.236 / 12.281 | 19.038 / 18.376 / 15.048 |

아래는 실행별 간격 지표의 3회 중앙값(ms)이다. 여러 실행의 프레임을 합쳐 percentile을 새로 만들지 않았다.

| phase | 표시 간격 p95 / p99 / 최장 전→후 | surface 간격 p95 / p99 / 최장 전→후 |
| --- | --- | --- |
| 보통 정방향 | 144.470 / 218.785 / 218.785 → 115.891 / 144.806 / 144.806 | 128.502 / 207.066 / 207.066 → 117.288 / 142.602 / 142.602 |
| 약 2배 정방향 | 150.872 / 194.751 / 194.751 → 147.200 / 205.859 / 205.859 | 147.389 / 203.607 / 203.607 → 135.468 / 199.493 / 199.493 |
| 약 2배 역방향 | 206.732 / 237.002 / 237.002 → 184.614 / 237.903 / 237.903 | 202.288 / 247.843 / 247.843 → 178.454 / 247.982 / 247.982 |

표시 관측의 ≥100ms 진행 정체는 다음과 같다. 총 시간·최장은 ms이고 중앙값은 phase별 세 실행에서 계산했다.

| phase | 변경 전 횟수 3회 | 변경 후 횟수 3회 | 횟수 중앙값 전→후 | 총 시간 중앙값 전→후 | 최장 중앙값 전→후 |
| --- | --- | --- | --- | --- | --- |
| 보통 정방향 | 7 / 5 / 6 | 8 / 6 / 7 | 6→7 | 891.543→983.441 | 218.785→199.169 |
| 약 2배 정방향 | 5 / 5 / 4 | 6 / 5 / 5 | 5→5 | 752.112→744.055 | 199.929→205.859 |
| 약 2배 역방향 | 7 / 5 / 8 | 7 / 6 / 7 | 7→7 | 1205.429→1127.154 | 254.145→237.903 |

입력→surface 지연은 native 수신 QPC부터 해당 입력을 포함하는 surface-copy fence까지의 move 표본이다. OS/장치 발생 시각부터의 지연이나 표시 지연이 아니다. 각 실행의 지표를 먼저 구한 뒤 3회 중앙값을 비교했다.

| phase | 입력→surface p50 / p95 / p99 / 최장 전→후 (ms) |
| --- | --- |
| 보통 정방향 | 233.696 / 352.880 / 363.861 / 363.861 → 238.147 / 338.088 / 346.153 / 346.153 |
| 약 2배 정방향 | 272.638 / 419.833 / 419.833 / 419.833 → 290.897 / 404.185 / 404.185 / 404.185 |
| 약 2배 역방향 | 328.330 / 464.722 / 479.505 / 479.505 → 319.311 / 503.311 / 520.311 / 520.311 |

변경 후 inputQueue p50/p95/최장의 3회 중앙값은 보통 **95.925/201.795/217.941ms**, 빠른 정방향 **141.766/214.755/214.755ms**, 역방향 **143.915/255.729/270.545ms**다. baseline 역방향 세 번째 표본의 inputQueue 출력은 터미널 잘림으로 온전히 확보하지 못해 그 지표의 전후 수락은 **notVerified**다. 기존 수신·표시·입력→surface 자료는 회수했으며, 누락을 이유로 완료한 baseline 전체를 다시 실행하지 않았다. 새 실행기는 inputQueue도 최종 비교 요약에 포함한다.

**판정: 전체 30fps 기준 FAIL / 진행 정체 기준 FAIL / 일관된 입력 지연 개선 미입증.** 변경 후 모든 phase의 표시 FPS 하한이 30 미만이다. 보통 정방향의 정체 횟수·총 시간 중앙값이 증가했고 빠른 정방향 최장도 증가했다. 역방향 입력→surface tail도 증가했다. 텍스트 최초 configuration 중복 제거의 기능적 근거와 전체 성능 수락을 구분한다. 작은 3회 비교로 변동의 단독 원인이나 통계적 개선율을 확정하지 않는다.

여섯 유효 실행 모두 48/30/60 touch, 월 정착 `November 2026→March 2027→June 2027→December 2026`, UIA·정상 종료를 통과했다. 각 실행의 전체 입력은 **수신=전달=수락=158, 거부=0, exitCode=0**이었다. 성능 표본의 동작·입력 조건을 바꾸거나 실패한 phase를 평균으로 숨기지 않았다.

### 12.5 파생 수정 — 변경하지 않은 공급의 중첩 dependency 보존

core 공급 중 기존 §11.4와 같은 Web lock 문제가 다시 발생했다. `supplyRunner`가 `reuseCurrent`의 바뀌지 않은 공급까지 모든 `node_modules/@nelyx/*` parent 기록을 삭제한 뒤 lock-only install을 수행하고 있었다. 이때 기존 static-aot의 중첩 `hermes-estree@0.32.0` 항목이 사라졌다. 처음 core 공급에서는 기존 항목만 복원하고 실제 `npm ci --workspaces=false`를 수행했으며, 이후 저장소 공급 로직을 수정했다.

이제 lock의 `resolved`와 새 manifest의 content-addressed archive를 runner 기준 절대 경로로 비교한다. 같은 공급의 parent/dependency 기록은 유지하고 변경된 archive 및 명시적 retired 패키지만 무효화한다. 같은 버전의 다른 core archive는 계속 새 integrity로 해석한다. lock-only 단계에서 설치본 receipt를 보존하는 기존 계약도 유지한다.

[새 공급 회귀](Nelyx/eng/check-runner-supply.mjs)는 작은 로컬 패키지와 실행 중 한 개의 npm cache만 사용하는 offline 실제 npm 검사다. 초기 설치→같은 버전 core 내용 교체→재설치→변경 없는 재공급에서 core의 새 내용·integrity, root `hermes-estree@0.35.0`와 static-aot 내부 `0.32.0`, 설치본 receipt 격리를 확인했다. **PASS**다. 실제 현재 Demo Web에도 archive 복제 없이 변경 없는 재공급을 실행해 전체 package graph·중첩 항목·설치 receipt 불변을 확인했다. **PASS**다. fixture의 package/install/cache는 finally에서 회수했으며 새 SDK/설치본 사본이나 로그를 남기지 않았다.


### 12.6 최종 공급의 달력 비교와 판정

최종 제품 Source는 framework/basic 두 모듈이다. core archive `ba4dd0f2…`를 세 runner에 공급하고 두 변경 모듈 및 기존 rich-text 모듈의 실제 설치 JS SHA-256을 대조했다. 수정 CLI도 세 runner에 공급해 설치된 `supply-runner.mjs`와 저장소 Source의 SHA-256을 확인했다. 이번 마지막 공급은 변경된 패키지만 `npm install --workspaces=false --ignore-scripts`로 교체했고 Web의 중첩 dependency를 수동 복원하지 않았다.

최종 달력 bundle은 `c66503fa…`, application Source는 `14ca3c13…`이며 세 실행에서 동일하다. baseline의 host `67dbdc22…`, toolchain `dbd11135…`, entry `9b550ab9…`, 2560×1459 / DPI 192 / 165Hz와 60Hz 입력을 유지했다. 세 실행 모두 `performanceSample=true`다. §12.4의 최초 후보 세 표본과 합치지 않았다.

| phase | baseline engine FPS | 최종 engine FPS | baseline 표시 FPS 하한 | 최종 표시 FPS 하한 |
| --- | --- | --- | --- | --- |
| 보통 정방향 | 31.899 / 30.054 / 31.795 | 31.495 / 32.496 / 28.760 | 29.159 / 25.866 / 26.321 | 28.620 / 27.752 / 23.144 |
| 약 2배 정방향 | 27.693 / 29.132 / 33.944 | 29.561 / 28.331 / 32.549 | 26.546 / 25.606 / 30.068 | 26.096 / 23.315 / 26.589 |
| 약 2배 역방향 | 26.686 / 21.161 / 12.365 | 18.233 / 15.520 / 21.588 | 22.329 / 18.236 / 12.281 | 15.887 / 14.793 / 19.497 |

각 실행의 간격 지표에서 계산한 3회 중앙값(ms)은 다음과 같다.

| phase | 표시 p95 / p99 / 최장 baseline→최종 | surface p95 / p99 / 최장 baseline→최종 |
| --- | --- | --- |
| 보통 정방향 | 144.470 / 218.785 / 218.785 → 120.499 / 164.433 / 164.433 | 128.502 / 207.066 / 207.066 → 124.387 / 154.189 / 154.189 |
| 약 2배 정방향 | 150.872 / 194.751 / 194.751 → 139.381 / 213.960 / 213.960 | 147.389 / 203.607 / 203.607 → 135.599 / 216.567 / 216.567 |
| 약 2배 역방향 | 206.732 / 237.002 / 237.002 → 174.568 / 218.806 / 218.806 | 202.288 / 247.843 / 247.843 → 185.974 / 206.945 / 206.945 |

| phase | 최종 ≥100ms 표시 정체 횟수 3회 | 횟수 중앙값 전→후 | 총 시간 중앙값 전→후 (ms) | 최장 중앙값 전→후 (ms) |
| --- | --- | --- | --- | --- |
| 보통 정방향 | 7 / 6 / 6 | 6→6 | 891.543→873.212 | 218.785→202.531 |
| 약 2배 정방향 | 5 / 4 / 5 | 5→5 | 752.112→727.997 | 199.929→230.577 |
| 약 2배 역방향 | 5 / 7 / 6 | 7→6 | 1205.429→1001.918 | 254.145→235.143 |

| phase | 입력→surface p50 / p95 / p99 / 최장 baseline→최종 (ms) | 최종 inputQueue p50 / p95 / 최장 중앙값 (ms) |
| --- | --- | --- |
| 보통 정방향 | 233.696 / 352.880 / 363.861 / 363.861 → 249.555 / 349.766 / 363.565 / 363.565 | 119.380 / 215.934 / 231.534 |
| 약 2배 정방향 | 272.638 / 419.833 / 419.833 / 419.833 → 286.032 / 439.782 / 439.782 / 439.782 | 101.129 / 203.740 / 203.740 |
| 약 2배 역방향 | 328.330 / 464.722 / 479.505 / 479.505 → 323.074 / 473.549 / 489.549 / 489.549 | 144.162 / 289.037 / 300.390 |

**최종 판정: 전체 30fps FAIL / 진행 정체 기준 FAIL / 입력 지연 개선 미입증 / performanceAccepted=false.** 최종 공급에서도 모든 phase의 표시 FPS 하한이 30 미만이며 engine FPS도 미달 표본이 있다. 정체의 횟수·총 시간 중앙값은 유지 또는 감소했지만 빠른 정방향 최장 중앙값이 증가해 §7의 세 조건을 모두 만족하지 못했다. 입력→surface 역시 p50과 tail의 변화가 섞였다. 최초 설정 해석 2회→1회의 구조적 확인을 전체 프레임의 순성능 이득으로 승격하지 않는다.

최종 세 실행 모두 48/30/60 touch, 동일 월 정착·UIA 및 정상 종료를 통과했다. 매회 전체 입력은 **수신=전달=수락=158, 거부=0, exitCode=0**이다. 무효 표본이나 교체 표본은 없었다. 최종 공급은 일반 Text에만 적용하며 RichText 공개 span의 메서드/prototype·Text의 own/prototype getter·Proxy·첫 build 전 GlobalKey 이동도 새 회귀와 pruning off Hermes lowering 회귀에서 확인했다.

### 12.7 최종 제품 회귀·정리와 재실행

다음은 §12.6의 최종 core 및 수정 CLI를 공급한 뒤의 결과다. 최초 후보의 기능 결과나 이전 §11 공급과 구분한다.

| 확인 범위 | 최종 결과와 경계 |
| --- | --- |
| Windows Gallery 1회 | 편집·theme/resize·wheel 왕복·UIA·종료 PASS. 표시 FPS 하한 cold/return/warm **75.959 / 60.072 / 61.060**, ≥100ms 정체 모두 0. 입력 177개 전부 수신=전달=수락, 거부 0, wheel 수신=전달=480. bundle `5496e94c…` |
| Windows 가변 목록 1회 | UIA 항목의 하강·복귀·warm membership 및 종료 PASS. 표시 FPS 하한 **69.154 / 59.163 / 54.134**, ≥100ms 정체 모두 0. 입력 159개 전부 보존, 거부 0, wheel 수신=전달=480. bundle `732720b9…` |
| 일반 Testbed 1회 | 실제 MixedScroll의 한글/emoji 편집 유지·왕복 스크롤·counter 1 갱신과 별도 목록의 UIA 진행·종료 PASS. 입력 118개 전부 보존, 거부 0, wheel 수신=전달=288. bundle `26a42348…`. 전체 Testbed 화면이나 표시 FPS 수락은 아님 |
| 일반 Demo Windows | README의 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000` 실행이 수정 CLI를 감지해 공급하고 현재 bytecode 제품을 재빌드. 첫 프레임·exit 0·`forced=false` PASS. bundle `880d4a35…`, host binary `13aaefc4…`, VM `5a7a8d64…`. 일반 제품 974×929 viewport이며 최대화한 진단 실행과 구분 |
| Demo Web | 현재 공급의 static build 및 Chromium WebGL2/SwiftShader 관련 기능 회귀 **4 cases PASS**. 첫 프레임·Gallery wheel 복귀·한글/emoji 편집과 theme/breakpoint 유지·달력 forward/reverse/close, 최종 화면 확인. bundle `81132d2c…`. 브라우저 실장치 성능 수락은 아님 |

Source의 모든 645개 모듈과 현재 dist의 source-map 입력을 검사했고, Demo Windows/Web·Testbed Windows의 설치된 framework/basic/rich-text 및 CLI 공급을 현재 파일과 대조했다. `check:types`의 11 workspace, `check:cli-types`, 새 두 회귀와 렌더 초기화의 Hermes lowering, 관련 framework/child/dependency/paint/profile·motion 회귀 및 변경 코드 lint/format이 PASS다. Android·Apple·Linux와 전체 native/SDK 재빌드, AOT 성능 비교는 이번 범위에서 실행하지 않았다.

각 native runner의 `FAST_CLEANUP_DONE`과 exit 0을 확인했다. 소유 diagnostic entry·package·batch/session, Web 서버·브라우저·profile·screenshot, npm fixture/cache 및 임시 core/CLI pack은 finally에서 회수했다. 남은 소유 native host·검사 프로세스가 없고 `.cache/packages`도 비어 있으며 staging·이전 dist 사본은 없다. 현재 dist와 제품 출력만 유지한다. 기존 `.tmp/calendar-fast-*`와 `calendar-product-build.mjs`는 보존했다. 새 검증 로그·JSON receipt·history archive를 저장하지 않았다.

이번 실행 단위의 **원인 분석·설계·제품 Source 적용·파생 공급 수정·기능 회귀·동일 조건 최종 비교는 완료**했다. 전체 달력 목표는 **PARTIAL / performanceAccepted=false**다. §9의 dormant 자격·GlobalKey 수명 계약과 새 PageView 정책/API·실제 opt-in은 보류 상태를 유지한다. 첫 생산·build/layout·회수의 남은 필수 비용과 입력 지연이 해결됐다고 표시하지 않는다. physical trackpad·scanout·screen reader·장시간 자원 수락도 남아 있다. 다음 구현은 이 실패 판정에서 출발해 공통 필수 경로의 남은 큰 작업량을 코드에서 분해해야 하며, cache/prewarm 확대나 추가 AOT를 기본 해법으로 승격하지 않는다.

저장소 루트의 PowerShell 7에서 아래 검사는 자체 20분 timeout 및 임시 작업 정리를 사용한다. 현재 dist·공급으로 검사하며 과거 baseline을 재생성하지 않는다. `--hermes-lowering`은 pruning off로 변환한 코드를 실행하는 Source 의미 회귀이고 실제 native Hermes 성능 검사는 아래 Windows 실행이다.

```powershell
node Nelyx/eng/check-render-initialization.mjs
node Nelyx/eng/check-render-initialization.mjs --hermes-lowering
node Nelyx/eng/check-runner-supply.mjs
node Nelyx/eng/check-source-framework.mjs
node Nelyx/eng/check-source-web.mjs
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 `
  -Scenario calendar -HermesMode bytecode -Runs 3
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 `
  -Scenario gallery -HermesMode bytecode -Runs 1
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 `
  -App testbed -Scenario list -HermesMode bytecode -Runs 1
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 `
  -App testbed -Scenario testbed -HermesMode bytecode -Runs 1
```

## 13. 2026-11-17 계속 작업 — 그리지 않는 공통 Ink의 조상 변환 제거

### 13.1 코드 분석과 제한된 CPU 진단

§12의 전체 성능 실패에서 계속했다. `InkFeature.paintOnMaterial → paintTransform`은 feature마다 reference box와 Material의 공통 조상 경로를 찾고, 각 edge의 `paintsChild/applyPaintTransform`과 두 Matrix4의 역행렬·곱을 처리한다. `InkDecoration.paintFeature`는 그 뒤에야 실제 painter를 호출한다. 기본 `ColorShapeDecoration`의 **color=null + CircleBorder의 기본 BorderSide.none**은 `ColorShapePainter.paint → CircleBorder.paint`에서 Canvas 작업을 전혀 하지 않지만 앞의 경로 계산을 지불한다. 이는 공통 Material Ink/painting 경로의 판정이며 날짜 생성 코드·선택·오늘 표시·Focus·Semantics 구성을 바꾸지 않는다.

코드를 분석한 뒤 현재 §12 최종 공급의 bytecode·기존 입력·Runs 1·NoScreen으로 CPU 샘플 진단을 수행했다. bundle `c66503fa…`, entry `9b550ab9…`, host `67dbdc22…`, toolchain `dbd11135…`가 §12와 같고 `performanceSample=false`다. phase별 sample 수는 보통/빠른 정방향/역방향 **1005/775/1044**, leaf의 `paintTransform`은 **10/14/26**, `childTransform`은 **22/11/18**, `applyPaintTransform`은 **21/6/11**이었다. 전체 이름별 집계에는 익명 함수와 root·GC 표본도 있으며, 이 수치를 특정 call site의 배타적 시간·제거 가능 비율·FPS 향상률로 환산하지 않는다. 후보의 우선순위를 지지하는 보조 근거다.

세 phase의 월 정착·UIA와 입력 **수신=전달=수락=158, 거부=0, exitCode=0**, `FAST_CLEANUP_DONE`을 확인했다. 표시 관측은 실행하지 않았고 이 실행을 §12의 성능 표본에 추가하지 않았다. 원시 sampled trace나 검증 로그를 디스크에 보관하지 않았다.

### 13.2 구현 계약과 국소 회귀

- Core는 실제 기본 생성자에서 만든 CircleBorder·ColorShapeDecoration·내부 painter의 약한 생성 증명을 확인한다. color가 null이며 기본 none side를 사용하는 원래 CircleBorder.paint body만 빈 paint로 인정한다. 현재 data descriptor와 메서드를 매번 확인하므로 side·색상·prototype 변경 뒤에도 이전 판정을 보관하지 않는다. transparent Color·임의 shape·caller painter·subclass·Proxy는 이 자격에 포함하지 않는다.
- Material InkDecoration은 원래 기본 paintFeature일 때만 이 결과로 변환 전에 반환한다. feature 등록·설정 갱신·equality에 따른 기존 painter 유지·해제와 onRemoved는 계속 수행한다. 기존 private empty 장식도 교체된 paintFeature 훅을 관측하도록 같은 기본 메서드 조건을 적용한다. 새로운 트리·builder cache·보존 정책은 없다.
- [빈 Ink 회귀](Nelyx/eng/check-empty-ink-paint.mjs)는 실제 24단계 RenderProxyBox 경로에서 변환·Canvas 작업 0과 feature 생존을 확인하고, 선택 fill·오늘 outline·빈 장식으로 복귀·side 변경·단일 getter 관측·사용자 painter/shape/Ink·prototype 교체·Proxy·예외 재시도·visibility·정상 회수를 검사한다. 동등한 새 장식으로 update해도 기존 사용자 painter가 유지되는 기존 계약도 확인한다. disposed painter와 바뀐 assertLive 훅은 빈 paint로 인정하지 않는다.

국소 Source·pruning off Hermes lowering과 현재 공급의 제품 회귀 및 변경 전후 비교를 완료했다. §12.6의 최종 3회를 이번 변경 전 baseline으로 유지했다. 아래 §13.3–13.5의 검증 범위와 전체 **PARTIAL / performanceAccepted=false**를 구분한다.

### 13.3 현재 공급·Source 및 일반 제품 검증

현재 core archive는 `50c8a2f5bb7878bdff388e68716573cdf57a70c286fae65287570da981cfad0f`, Material archive는 `8e52374ef43d257006635a93bdcd810fda1d8b69f0fb308633d8a3ac7e69d94d`다. Source→dist의 source-map 입력을 core **645**·Material **275** 모듈에서 검사한 뒤 두 package를 한 번씩 pack해 Demo Windows/Web·Testbed Windows 세 runner에 공급했다. 각 설치는 변경된 두 package만 교체했고 두 새 Core painting 모듈·기존 framework/basic·Material ink-decoration의 실제 JS와 CLI 공급 SHA-256을 대조했다. Web static-aot의 중첩 hermes-estree 0.32.0도 유지됐다. 임시 pack은 finally에서 회수했다.

새 빈 Ink 회귀의 Source·pruning off Hermes lowering, 렌더 초기화·retained paint·Source framework **20 cases**·child reconciliation, 최종 11 workspace 타입·변경 코드 lint/format을 통과했다. 타입 검사의 최초 실행은 Material이 이전 core 선언을 읽어 새 helper export를 찾지 못했고, core dist를 갱신한 뒤 최종 전체 검사를 통과했다. 설치된 예전 선언이나 합성 fixture 성공만으로 제품 공급을 수락하지 않았다.

일반 Demo Web static build의 bundle은 `437bfb4c…`다. 현재 제품의 WebGL2/SwiftShader 기능 **4 cases PASS**와 최종 Selection 화면을 확인했다. 일반 Windows README 명령 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`도 현재 제품을 재빌드해 첫 프레임·exit 0·`forced=false`를 통과했다. Windows 제품 bundle은 `4bba1aee…`, host binary `13aaefc4…`, VM `5a7a8d64…`다. 기능·일반 제품 실행과 아래 최대화한 달력 성능 비교는 별도 범위다.

최종 달력 3회·Gallery·가변 목록·일반 Testbed 검증을 완료했다. 상세 비교와 정리는 아래에 기록하며 전체 성능 수락은 **false**다.

### 13.4 같은 조건 달력 3회 비교와 판정

§12.6의 현재 공급 3회와 이번 공급 3회를 비교했다. 최종 bundle `f8527fdd…`, application Source `f7263067…`는 세 실행에서 같고 host·VM/toolchain·entry·2560×1459 / DPI 192 / 165Hz·60Hz 입력 조건을 유지했다. CPU/build/GC 관측 훅을 제외했으며 모두 `performanceSample=true`다. CPU 샘플 진단은 이 비교에 합치지 않는다.

| phase | 변경 전 engine FPS | 변경 후 engine FPS | 변경 전 표시 FPS 하한 | 변경 후 표시 FPS 하한 |
| --- | --- | --- | --- | --- |
| 보통 정방향 | 31.495 / 32.496 / 28.760 | 32.879 / 34.028 / 33.442 | 28.620 / 27.752 / 23.144 | 26.298 / 30.058 / 27.331 |
| 약 2배 정방향 | 29.561 / 28.331 / 32.549 | 31.511 / 32.849 / 29.721 | 26.096 / 23.315 / 26.589 | 27.834 / 28.590 / 25.893 |
| 약 2배 역방향 | 18.233 / 15.520 / 21.588 | 17.351 / 20.574 / 29.339 | 15.887 / 14.793 / 19.497 | 15.594 / 18.519 / 25.619 |

아래 간격·지연 수치는 각 실행 지표의 3회 중앙값(ms)이다. 프레임을 여러 실행에서 합쳐 percentile을 새로 만들지 않았다. 표시 FPS는 desktop frame tag 관측 하한이고 engine FPS는 surface-copy fence 완료율이며 scanout이 아니다.

| phase | 표시 간격 p95 / p99 / 최장 전→후 | surface 간격 p95 / p99 / 최장 전→후 |
| --- | --- | --- |
| 보통 정방향 | 120.499 / 164.433 / 164.433 → 132.015 / 151.997 / 151.997 | 124.387 / 154.189 / 154.189 → 130.607 / 144.989 / 144.989 |
| 약 2배 정방향 | 139.381 / 213.960 / 213.960 → 169.396 / 199.938 / 199.938 | 135.599 / 216.567 / 216.567 → 172.929 / 202.865 / 202.865 |
| 약 2배 역방향 | 174.568 / 218.806 / 218.806 → 199.380 / 219.744 / 219.744 | 185.974 / 206.945 / 206.945 → 183.701 / 222.836 / 222.836 |

| phase | 변경 후 ≥100ms 표시 정체 횟수 3회 | 횟수 중앙값 전→후 | 총 시간 중앙값 전→후 (ms) | 최장 중앙값 전→후 (ms) |
| --- | --- | --- | --- | --- |
| 보통 정방향 | 7 / 6 / 5 | 6→6 | 873.212→796.249 | 202.531→192.910 |
| 약 2배 정방향 | 4 / 5 / 4 | 5→4 | 727.997→656.980 | 230.577→199.938 |
| 약 2배 역방향 | 6 / 5 / 6 | 6→6 | 1001.918→998.424 | 235.143→219.744 |

| phase | 입력→surface p50 / p95 / p99 / 최장 전→후 (ms) | inputQueue p50 / p95 / 최장 전→후 (ms) |
| --- | --- | --- |
| 보통 정방향 | 249.555 / 349.766 / 363.565 / 363.565 → 184.776 / 259.794 / 273.281 / 273.281 | 119.380 / 215.934 / 231.534 → 64.090 / 167.014 / 219.869 |
| 약 2배 정방향 | 286.032 / 439.782 / 439.782 / 439.782 → 223.031 / 382.770 / 382.770 / 382.770 | 101.129 / 203.740 / 203.740 → 93.636 / 167.067 / 167.067 |
| 약 2배 역방향 | 323.074 / 473.549 / 489.549 / 489.549 → 335.956 / 486.822 / 502.822 / 502.822 | 144.162 / 289.037 / 300.390 → 161.462 / 268.861 / 314.440 |

**판정: 전체 30fps FAIL / §7의 진행 정체 수치 기준 PASS-scoped / 일관된 입력 지연 개선 미입증 / performanceAccepted=false.** 보통 정방향 표시 FPS 한 표본만 30 이상이고 빠른 정방향·역방향은 모든 표시 표본이 미달이다. 정체 기준은 phase별 중앙값에서 횟수·최장 비증가와 총 시간 감소를 만족했다. 다만 역방향 총 시간 감소는 1001.918→998.424ms로 작아 세 표본만으로 통계적 개선이나 단독 원인을 확정하지 않는다. 보통·빠른 정방향의 입력→surface 중앙 지표는 감소했으나 역방향 p50과 tail이 증가했다. 입력 보존을 낮은 지연으로 간주하지 않는다.

여섯 비교 실행 모두 같은 48/30/60 touch·6/6/12 gestures와 월 정착·UIA·정상 종료를 통과했다. 이번 최종 세 실행의 전체 입력은 매회 **수신=전달=수락=158, 거부=0, exitCode=0**이며 무효·교체 표본은 없다. 빈 paint의 24단계 변환 생략이라는 국소 메커니즘과 전체 달력 목표 달성을 구분한다.

### 13.5 최종 공통 회귀·정리와 남은 범위

| 확인 범위 | 결과와 경계 |
| --- | --- |
| Windows Gallery 1회 | 편집·theme/resize·wheel 왕복·UIA·종료 PASS. 표시 FPS 하한 cold/return/warm **74.050 / 61.952 / 61.034**, ≥100ms 정체 모두 0. 입력 177개 전부 보존, 거부 0, wheel 수신=전달=480. bundle `ceb1beb8…` |
| Windows 가변 목록 1회 | UIA 하강·복귀·warm membership·종료 PASS. 표시 FPS 하한 **70.592 / 56.307 / 56.220**, ≥100ms 정체 모두 0. 입력 159개 전부 보존, 거부 0, wheel 수신=전달=480. bundle `c557ce66…` |
| 일반 Testbed 1회 | MixedScroll 한글/emoji 편집 유지·counter 1 갱신·왕복 스크롤과 원래 목록의 UIA 진행·종료 PASS. 입력 118개 전부 보존, 거부 0, wheel 수신=전달=288. bundle `2cd78d92…`. 전체 Testbed 화면·표시 FPS 수락은 아님 |
| 일반 Demo Windows/Web | §13.3의 현재 제품 첫 프레임·정상 종료 및 Web 관련 기능 4 cases·시각 확인 PASS. 진단 bundle과 구분 |

마지막 runner까지 exit 0·`FAST_CLEANUP_DONE`을 확인했다. diagnostic entry·package·batch/session·Web server/browser/profile/screenshot·임시 core/Material pack이 회수됐고, 소유 native host·검사 프로세스와 build staging·이전 dist 사본이 없는 것을 확인했다. `Nelyx/.cache/packages`와 Material의 build cache는 비어 있다. 현재 dist·제품 출력과 기존 사용자의 `.tmp/calendar-fast-*`·`calendar-product-build.mjs`만 유지하며 raw trace·검증 로그·별도 receipt·history archive는 저장하지 않았다. 최종 `git diff --check`도 확인한다.

이번 후속 구현의 **공통 빈 Ink의 코드 근거·제품 Source 적용·공급·관련 기능 회귀·동일 조건 3회 비교는 완료**했다. 전체 목표는 **PARTIAL / performanceAccepted=false**로 유지하며 goal은 계속 활성이다. 30fps와 역방향 입력 지연이 남아 있고 physical trackpad·scanout·screen reader·장시간 자원 수락은 별도 미확인이다. §9의 보존 후보와 자격 완화·새 PageView 정책/API·calendar opt-in은 계속 보류한다.

다음 수정은 남은 공통 첫/후속 build·필수 layout의 실제 중복 작업을 코드에서 확인하는 데서 이어간다. 이번 정체 수치 PASS만으로 추가 cache·prewarm·AOT 확대나 Widget build 생략을 채택하지 않는다. 새 Source 검사 명령은 다음과 같으며 자체 20분 timeout을 적용한다. 현재 공급의 Windows/Web 재실행은 §12.7의 기존 명령을 사용한다.

```powershell
node Nelyx/eng/check-empty-ink-paint.mjs
node Nelyx/eng/check-empty-ink-paint.mjs --hermes-lowering
```

## 14. 기본 Material 지역화 소유 후보 — 성능 수락 실패·철회

### 14.1 코드 근거와 범위

§13 이후 공통 첫/후속 build를 분석했다. `MaterialLocalizations.of()`는 사용자 `MaterialLocalizationsScope`가 없으면 매 호출마다 locale 후보 배열, selection/refresh 메시지 병합·동결, script category를 포함하는 새 객체를 생성했다. `MaterialApp`의 두 생성 경로 어디에도 기본 지역화 데이터 공급자가 없었고 실제 `_DayState.build`도 이 함수를 각 날짜에서 호출한다. 날짜 build 결과나 수명을 보존하는 대신 같은 locale 자원의 반복 생산을 줄이는 공통 후보로 정했다. 이 코드 근거를 전체 정체의 지배 원인이나 기존 제품 기능 장애로 단정하지 않는다.

고정 Flutter Git 원본 `71e4717a61786faab4c7aa39825989305ed29e8a`를 실제 `C:/Users/parti/flutter`의 불변 object로 읽었다. Material app의 기본 delegate와 사용자 delegate 우선순위(`material/app.dart`, blob `fd618e3c326ee3c04a6a61d9aaf397d3cedc541b`), Localizations가 type별 resource를 소유해 반환하는 구조(`widgets/localizations.dart`, blob `afae44e8e00e8ff5445b554a4009b029bee358fc`)를 확인했다. Nelyx의 현재 동기 locale·메시지 모델 안에서 이 소유를 보완하며 Flutter delegate API 전체나 추가 date locale 번역을 구현했다고 주장하지 않는다. local reference checkout을 고정 원본 identity로 사용하지 않았다.

### 14.2 구현과 보존 계약

**아래는 시험한 후보의 설계이며 §14.4의 FAIL 이후 최종 Source에서 철회했다.**

- Core `WidgetsApp.buildLocalizations()`의 내부 adapter 지점을 resolved `Localizations` 아래·루트 Overlay 위에 둔다. 기본 동작은 전달받은 child 그대로이며, 기존 사용자 builder는 실제 Navigator/Router를 계속 받는다.
- Material의 내부 WidgetsApp adapter와 legacy 생성 경로는 현재 locale의 `MaterialLocalizations` 하나를 State에서 소유한다. locale 변경 시 교체하고 inherited 독자에게 알린다. 모든 과거 locale을 보관하거나 process/View 간 데이터를 공유하지 않는다.
- 별도의 내부 기본 Scope를 사용해 명시적 사용자 `MaterialLocalizationsScope`의 기존 우선순위를 유지한다. Core Localizations만 내부에서 다른 locale로 바꾸면 기존 fresh fallback을 사용한다. 앱 밖 fallback과 공개 `.of` 교체 hook도 유지한다.
- 처음에는 themed builder 안에 기본 Scope를 배치했으나, route/overlay 검사가 루트 Overlay에 추가한 독자에게 전달되지 않는 구조를 확인했다. 최종 배치는 Overlay 위이며 dialog 같은 별도 entry도 동일 앱 데이터를 받는다. Canvas·날짜별 Focus/Ink/Semantics·builder/delegate·스크롤 pacing은 변경하지 않았다.

후보 전용 `check-material-app-localizations.mjs`는 실제 FrameworkRoot와 MaterialApp을 사용했다. 앱 밖 fallback·기본 WidgetsApp·legacy locale 교체·사용자 Scope 우선순위·내부 locale 및 중첩 앱·독립 View·options builder/Navigator/Material route/루트 Overlay·resolved locale callback·공개 hook을 **8 cases**로 확인했다. 루트 Overlay의 42개 독자가 각각 2회 `.of()`를 호출해 같은 앱 자원 하나를 받고, locale 변경 시 보존된 모든 독자가 새 자원을 받았다. route는 rasterizer가 없는 Source fixture에서 `allowSnapshotting=false`로 검사하며 제품 기본값을 바꾸지 않았다. 이 구조적 중복 제거를 제품 FPS 수락과 구분한다. 후보를 철회하며 그 후보에서만 유효한 fixture도 회수했다. 기존 §12·§13의 회귀 Source는 유지한다.

### 14.3 후보 공급과 기능 검증

- Source 8 cases와 pruning off Hermes lowering 8 cases PASS. 공통 Source framework 20 cases, 변경 파일 lint/format, 전체 11 workspace 타입 검사 PASS. 모두 실행 제한 20분을 사용한다.
- Core 645개·Material 275개 모듈의 dist source map 내용을 현재 Source와 전부 대조했다. 새 core archive `a65bc3fd259f770a51301ec2c9ede679d1bdde472af6ef004ac80a8be8a2e05d`, Material `91744da86b5a374492788908e71c7dfb76f70ae33e069d59126972e9a15f1d03`를 각각 한 번 pack해 Demo Windows/Web·Testbed Windows에 공급했다.
- 세 runner 모두 실제 npm install이 2 packages를 교체했다. 설치된 app/framework/basic/circle/color-shape/ink/localizations JS를 현재 dist와 대조했고, Web의 nested `hermes-estree@0.32.0` 보존도 확인했다. 기존 CLI 및 native/VM 공급은 유지한다. 공급용 pack/cache는 finally에서 회수했다.
- 후보 Demo Web bundle `c8bfc87ba81c868c6f658c2ba35d35f9165cf0ad06347e91f6b30900fa070575`: 제품 정적 build와 Source Web 4 cases PASS. 첫 화면·Gallery 왕복·한글/emoji 편집/theme/breakpoint·달력 정방향/역방향/닫기를 확인했고 최종 Selection 화면을 직접 봤다. WebGL2 SwiftShader 기능 회귀이며 성능 수락은 아니다.
- README의 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`도 현재 앱으로 rebuild·첫 프레임·정상 종료 PASS(`forced=false`, exit 0). bundle `863d6d7e02801d8ef0c21343daa6f99bee694c63208de4e85a6c6c084347fc9e`, host `13aaefc4…`·VM `5a7a8d64…`, 기본 974×929 / DPI 192 / 165Hz. 준비 단계의 SDK/native 내용 검사는 실행 시간과 구분하며 native host는 재컴파일할 변경이 없었다.

### 14.4 같은 조건 3회 비교 — 후보 수락 FAIL

§13 공급의 세 표본과 후보 공급의 세 표본을 비교했다. 후보 application Source `712f1b79e38222dd18682029ac1f465574618c4dbf860c9ce2f4f32695fd3eb3`, bundle `0a29175da65d6c3509b00c25069f89846d82f0de82477541eb0523e24dbffaf1`은 세 실행에서 같았다. host `67dbdc22…`·toolchain `dbd11135…`·compiler policy·entry `9b550ab9…`·2560×1459 / DPI 192 / 165Hz·기존 60Hz 입력과 월 정착 조건이 모두 같고 `performanceSample=true`다. 진단 훅이나 무효 표본 교체는 없다.

| phase | §13 engine FPS | 후보 engine FPS | §13 표시 FPS 하한 | 후보 표시 FPS 하한 |
| --- | --- | --- | --- | --- |
| 보통 정방향 | 32.879 / 34.028 / 33.442 | 32.166 / 34.839 / 33.047 | 26.298 / 30.058 / 27.331 | 27.227 / 28.096 / 26.095 |
| 약 2배 정방향 | 31.511 / 32.849 / 29.721 | 31.735 / 30.044 / 26.433 | 27.834 / 28.590 / 25.893 | 25.600 / 26.558 / 22.512 |
| 약 2배 역방향 | 17.351 / 20.574 / 29.339 | 15.771 / 23.099 / 23.204 | 15.594 / 18.519 / 25.619 | 13.025 / 20.265 / 21.914 |

≥100ms 표시 진행 정체의 phase별 세 표본 중앙값은 다음과 같다. 각 실행의 p95·최장 등 간격 지표와 진행 정체의 집계 경계는 같다고 합치지 않는다.

| phase | 정체 횟수 §13→후보 | 총 시간 §13→후보 (ms) | 최장 §13→후보 (ms) |
| --- | ---: | ---: | ---: |
| 보통 정방향 | 6→6 | 796.249→862.992 | 192.910→198.587 |
| 약 2배 정방향 | 4→5 | 656.980→752.990 | 199.938→181.471 |
| 약 2배 역방향 | 6→7 | 998.424→1033.130 | 219.744→230.269 |

| phase | 입력→surface p50 / p95 / p99 / 최장 §13→후보 (ms) | inputQueue p50 / p95 / 최장 §13→후보 (ms) |
| --- | --- | --- |
| 보통 정방향 | 184.776 / 259.794 / 273.281 / 273.281 → 180.021 / 291.921 / 308.921 / 308.921 | 64.090 / 167.014 / 219.869 → 70.775 / 162.408 / 214.079 |
| 약 2배 정방향 | 223.031 / 382.770 / 382.770 / 382.770 → 250.148 / 374.293 / 374.293 / 374.293 | 93.636 / 167.067 / 167.067 → 101.784 / 187.715 / 187.715 |
| 약 2배 역방향 | 335.956 / 486.822 / 502.822 / 502.822 → 286.263 / 412.051 / 414.364 / 414.364 | 161.462 / 268.861 / 314.440 → 106.569 / 264.244 / 279.896 |

**후보 전체 30fps FAIL / 진행 정체 수치 기준 FAIL / 일관된 입력 지연 개선 미입증.** 후보의 표시 표본은 모두 30 미만이며 정체 중앙값도 기준을 만족하지 못했다. 역방향 지연 감소나 객체 생성 절감 fixture만으로 채택하지 않는다. 세 표본으로 후보가 정체 증가의 단독 원인이라고 확정하지 않지만, 수락 근거가 없는 공유 객체 반환 계약을 성능 fix로 통합하지 않는다.

후보 세 실행 모두 48/30/60 touch·6/6/12 gestures와 +4/+3/−6개월 정착·UIA를 통과했다. 매회 전체 입력은 **수신=전달=수락=158, 거부=0, exit 0**이다. 실패 표본은 그대로 기록하며 새 표본으로 대체하지 않는다.

### 14.5 철회와 현재 공급 복원

후보의 Windows Gallery·가변 목록·Testbed를 각 1회 검사했고 기능·입력·UIA·정상 종료는 통과했다. Gallery 표시 FPS 하한은 cold/return/warm **73.126 / 59.967 / 60.743**, 목록은 **72.594 / 56.725 / 57.598**이며 두 시나리오의 ≥100ms 표시 정체는 모두 0이다. 각각 입력 177/159개 전부 보존·거부 0·wheel 수신=전달=480이었다. Testbed는 한글/emoji 편집·counter 1·목록 UIA 진행을 통과했고 입력 118개 전부 보존·거부 0·wheel 수신=전달=288이었다. bundle은 각각 `2e56ae51…` / `1bccafe3…` / `c393e0ae…`다. 이 PASS는 철회한 후보의 관련 기능 범위이며 달력 성능 수락을 대신하지 않는다.

공통 회귀 종료 후 §14의 Core App hook·Material adapter/지역화 공급자와 후보 전용 fixture를 함께 철회했다. 세 제품 Source 파일에 후보 diff가 없는 것을 확인했고 §12·§13의 이미 검증한 변경은 유지했다. 과거 archive나 dist를 복사하지 않고 복원한 Source를 다시 build·pack했다.

- 재생성한 core `50c8a2f5…`·Material `8e52374e…` archive SHA-256이 **§13과 완전히 동일**했다. Core 645개·Material 275개 source map을 다시 대조했다. Demo Windows/Web·Testbed Windows의 실제 npm install이 각각 2 packages를 복원했으며, 두 패키지의 전체 선언된 파일 내용 identity를 현재 workspace와 대조했다. Web nested estree 0.32.0도 유지됐다.
- 복원한 Source의 render initialization·empty Ink·공통 framework 20 cases를 다시 통과했다. 후보의 성능 실패 표본을 삭제하거나 재측정 값으로 바꾸지 않았다.
- 복원한 Web 제품 build의 bundle `437bfb4c8bd111f88016b542771024479948d177110f153b8f8136ecfb9e64c5`도 §13과 동일했다. Source Web 4 cases와 최종 1280×800 Selection 캡처를 확인했다. 캡처 확인을 위해 기능 검사를 한 번 추가했으며 성능 표본을 재선정한 실행이 아니다.
- 기존 `calendar-product-build.mjs`의 동일 build/run API로 현재 Windows 제품을 재생성하고 8초 실행했다. bundle `4bba1aee8cef2096394b3698f4d0eaef9d113bfc83e0de92da38889a40418a5a`도 §13과 동일했고 host·VM identity, 첫 프레임, exit 0을 확인했다. README smoke는 §14.3의 후보 실행과 구분한다. 복원 제품에는 후보 코드와 diagnostic entry가 없다.

마지막 검사에서 소유 native/검사 process 0, 추가 `.tmp` 항목 0, SDK staging·이전 dist·임시 pack·native diagnostic/staging 0을 확인했다. Web browser/server/profile/screenshot과 후보 공급용 archive/cache, 복원용 pack/cache를 finally에서 회수했다. 현재 dist·현재 제품·현재 runner 공급과 기존 사용자의 `.tmp` 네 파일만 유지한다. 새 raw log·receipt·history JSON·이전 archive를 저장하지 않았고 최종 `git diff --check`도 통과했다.

**현재 제품 Source·공급은 §13이며, §14 지역화 공유는 미적용이다.** §14의 분석·후보 구현·기능 검증·성능 실패 판정·철회·복원은 완료했다. 전체 목표는 **PARTIAL / performanceAccepted=false / goal active**로 계속된다. 다음 작업은 작은 할당 후보의 국소 성공을 또 성능 해법으로 승격하지 않고, 남은 공통 필수 build/layout의 큰 동기 작업량을 코드에서 확인하는 데서 출발한다. §9의 dormant 자격 완화·새 PageView 정책/API·calendar opt-in·cache/prewarm 확대는 계속 보류하며 physical trackpad·scanout·screen reader·장시간 자원 수락을 완료로 표시하지 않는다.

## 15. 실행 엔진 비교 — JSC direct host와 interpreter/JIT 판정

### 15.1 질문과 현재 판단

사용자가 반복한 국소 수정의 효과가 충분하지 않다며 Hermes의 제약인지, JSC interpreting이 대안인지 질문했다. 앞선 국소 성공으로 전체 목표에 접근한다는 가정은 측정 결과가 지지하지 않는다. 같은 workload에서 엔진만 바꾸는 비교를 다음 Widget 미세 수정보다 먼저 수행하는 방향으로 전환한다. **Hermes 한계 확정이나 JSC 성능 수락을 뜻하지 않는다.**

JSC의 LLInt는 interpreter 자체에서도 객체 접근 inline cache를 사용하는 구현이다([WebKit 설명](https://webkit.org/blog/10308/speculation-in-javascriptcore/)). 따라서 JIT를 끈 JSC도 비교할 근거는 있지만 Hermes보다 빠르다거나 30fps를 달성할 것이라고 예측하지 않는다. startup·실행·GC·JS/native 호출 비용을 구분하고, 서로 다른 엔진의 GC/내부 실행 비용도 결과에 포함한다.

현재 저장소의 기존 `--engine jsc --jsc-mode interpreter`는 RNW host의 `rn-jsc-graphite-vulkan` 경로다. 지금 달력 수치는 RN/Node-API 없이 실행하는 direct native host이며 `nativeWindowsOperation()`이 다른 engine과 jscMode를 거절한다. **기존 RNW JSC 실행과 현재 Hermes 수치를 직접 비교하면 host 변경이 섞인다.** 현재 Demo·Testbed에 검증한 direct JSC package/supplier는 없다.

### 15.2 코드에서 확인한 연결 범위

- `windows-hermes/RuntimeLoop.h`·native callback·Skia binding의 상당 부분은 `facebook::jsi::Runtime`을 받는다. 반면 `main.cpp`는 Hermes 생성·profiling·HBC99 검증·SHUnit 실행·VM/ICU image inventory·실행 mode를 직접 소유한다. `LoadedIdentity.h`는 현재 JavaScriptCore DLL도 foreign engine으로 거절한다.
- SDK `backends/native-hermes/globals.ts`는 `HermesInternal.enablePromiseRejectionTracker`를 필수로 요구하고 application metadata도 runtime을 Hermes로 기록한다. JSC를 연결할 때 Promise/host microtask FIFO·intrinsic async rejection 관측·종료 중 callback 수명·실제 engine identity를 같이 보존해야 한다. 오류 추적을 끄거나 Promise 전역을 단순 감싸서 실행시킨 결과는 동등한 host 수락으로 사용하지 않는다.
- 기존 JSC supplier에는 VM 생성 전에 JS/RegExp JIT와 Wasm을 끄고 pinned `canUseAssembler()` seam으로 실제 code-generation 허용 여부를 검사하는 코드가 있다. 재사용 가능성은 있지만 새 direct host의 공급·link·실행을 별도로 입증해야 한다. 기존 RNW 검증 이력은 현재 direct host의 PASS가 아니다.

### 15.3 첫 gate: adapter 소스 컴파일 호환성 PASS

새 `Nelyx/eng/probe-jsc-host-abi.mjs`로 기존 JSC adapter에 현재 microtask patch를 적용한 뒤 같은 MSVC Release 옵션으로 두 번 compile-only 검사했다. WebKit pin `482d54b279fd6147a45aaa122242f2ac315f46df`의 API header 8개를 공급 코드의 SHA-256과 대조했고 작은 임시 폴더 하나만 사용했다. 기존 RNW JSI를 positive control로 두고, 현재 direct host가 실제 사용하는 Hermes source의 JSI header로도 컴파일했다.

| 대상 | JSI header SHA-256 | 결과 |
| --- | --- | --- |
| 기존 RNW adapter 기준 | `953891d786e1337c95b56bff8097924301679310db08acbf7e380e722299b554` | compile 0, 오류 0 |
| 현재 direct host 기준 | `db2f1ee9291340f3d05b11abdcdc3d12ac84c239e58599d4ef2ac06dbaa14d92` | compile 0, 오류 0 |

원래 adapter Source hash는 `d8452ac0199fd9d7098b3b50c5d42ef042d562054febb4bbc2edf2e6c1e5b165`다. **소스 인터페이스 호환성의 첫 gate만 PASS**다. JSC DLL link·실제 VM/microtask/rejection/lifetime admission·렌더링·달력 성능은 아직 실행하지 않았다. binary ABI 호환성이나 제품 성능을 이 결과로 승격하지 않는다. 실행 제한 20분, 임시 header/adapter/object는 finally에서 모두 회수했고 probe lint/format·diff check를 확인했다. 제품 Source·dist·runner 공급은 §13 그대로다.

```powershell
node Nelyx/eng/probe-jsc-host-abi.mjs
```

다음 순서는 같은 direct host에서 JSC interpreter의 link·필수 runtime 서비스·첫 프레임·종료를 확인한 뒤, 같은 framework/app Source·renderer·viewport·60Hz 입력·월 이동으로 Hermes bytecode와 비교하는 것이다. JSC JIT는 실행 엔진 차이와 JIT 효과를 분리하는 진단 대조군으로 둘 수 있으며 기본 엔진 전환을 뜻하지 않는다. 기존 phase별 engine/표시 30fps·정체·입력·공통 회귀 기준과 `performanceAccepted=false / goal active`를 유지한다.

### 15.4 실제 direct JSI link·VM 서비스 admission PASS-scoped

후속 코드 검토에서 JSC의 outer C API lock 해제 때 job이 실행되므로, 기존 RNW adapter를 그대로 연결하면 개별 JSI 호출 사이에 microtask가 실행될 수 있음을 확인했다. 현재 host의 frame callback 묶음·timer·명시적 checkpoint와 맞추기 위해 새 `native-jsc-adapter.mjs`는 pinned RN adapter의 native job queue patch 위에 다음을 추가한다.

- API lock을 runtime owner에서 유지하고 `drainMicrotasks()`에서 해제·재획득한다. 따라서 일반 JSI getter나 두 frame callback 사이에 intrinsic job을 먼저 실행하지 않는다. WebKit pin의 C API `JSLock`/`JSUnlock`만 사용하며 private C++ VM 객체·allocator layout을 넘기지 않는다([고정 원본](https://github.com/WebKit/WebKit/blob/482d54b279fd6147a45aaa122242f2ac315f46df/Source/JavaScriptCore/API/JSLockRef.cpp)).
- `JSGlobalContextSetUnhandledRejectionCallback`으로 native handler를 연결해 intrinsic async·Promise.reject·host microtask 오류를 관측한다. Promise 전역을 대체하거나 tracker를 생략하지 않았다. `JSGlobalContextSetEvalEnabled`로 현재 host의 dynamic eval 금지 정책도 맞춘다.
- `native/windows-jsc/NativeJscRuntime.h`는 기존 JSC의 프로세스별 mode 선택·실제 code-generation 허용 검사 위에 이 서비스를 구성한다. 기존 Hermes host·기존 RNW JSC adapter 동작은 수정하지 않았다.

로컬 Playwright WebKit 2272의 `JavaScriptCore.dll` SHA-256이 기존 pin `6b5403129383847cacfcadd7fda112ec953c89c1066c883df6ae4dc0b7ce9cd3`과 일치했고, 위 네 C API와 pinned assembler seam의 실제 DLL export를 확인했다. 이 DLL과 ICU 77 세 파일만 한 실행의 임시 폴더에 복사해 현재 direct host의 **JSI header와 실제 `jsi.lib`**로 admission executable을 link했다. RNW 또는 Hermes VM은 로드하지 않으며, 로드된 JSC의 경로도 임시 실행 파일 옆의 검증한 DLL과 일치하는지 검사한다.

`probe-jsc-host-abi.mjs --runtime`의 최종 실행에서 **interpreter·JIT 허용 모드를 서로 다른 새 프로세스로 실행해 둘 다 exit 0**이었다. `fixtures/native-jsc-admission.cpp`는 실제 `windows-hermes/VmCallbacks.h`를 사용하며 다음 범위를 확인했다.

| 범위 | 최종 결과 |
| --- | --- |
| 현재 JSI와 실제 JSC DLL link·로드·mode | PASS. interpreter는 JS/RegExp JIT·Wasm off 및 실제 assembler 허용 false, 대조군은 허용 true |
| 명시적 checkpoint | PASS. Promise job이 일반 JSI 호출이나 두 frame callback 사이에 실행되지 않고 `drainMicrotasks`에서 실행 |
| Promise/host job FIFO와 intrinsic 오류 | PASS. 기존 factory FIFO admission, plain/async rejection 각각 관측, 즉시 catch한 rejection 제외, host microtask throw 관측 |
| 동일 native callback 코드 | PASS. 두 frame callback 뒤 Promise job, 그 뒤 timer 순서·단일 frame wake·취소 timer 미실행·close 후 handle 회수 |
| 언어·오류 | private field·getter·BigInt·typed array, 원래 JS 예외와 후속 실행 복구, eval 금지 PASS |
| 수명 | native callback capture가 VM retirement 후 남지 않음 PASS |

이는 renderer가 없는 실제 VM 서비스 수락이다. **Skia binding 전체·SDK bootstrap·첫 화면·달력·입력·표시 FPS·제품 binary ABI 전체 수락은 아직 미검증**이다. JIT 대조군은 code generation을 허용한 모드이며 workload의 모든 함수가 JIT되었다는 주장이 아니다. JSC core는 pin과 대조했고 ICU 77 의존 파일은 로컬 기존 설치의 실제 hash를 확인했다. 최종 제품 supplier의 전체 archive provenance·license·inventory 수락은 후속 공급 단계에서 별도로 수행한다.

새 runtime Source·fixture는 아직 기존 제품 패키지에 공급하지 않았다. 기존 설치 제품·framework·화면/스크롤 구현은 §13이며, 새 JSC 관련 Source까지 workspace↔설치 일치가 완료됐다고 표기하지 않는다. 최종 검사 후 probe process와 임시 header/adapter/object/import library/executable/DLL은 모두 회수했고 `.tmp`의 기존 네 파일을 보존했다. lint·format·diff check PASS. 새 log/receipt/history archive는 없다. 실행 명령은 자체 20분 timeout을 적용한다.

```powershell
node Nelyx/eng/probe-jsc-host-abi.mjs --runtime
```

다음 필수 작업은 shared native host의 engine 생성·image inventory·source 실행 경로와 SDK rejection tracker/실제 runtime metadata를 JSC에 연결해 실제 Demo를 실행하는 것이다. 그 뒤 같은 app/renderer/input 조건에서 Hermes와 JSC interpreter를 비교한다. 이번 VM gate를 성능 비교나 전체 목표 완료로 대체하지 않으며 **PARTIAL / performanceAccepted=false / goal active**다.

### 15.5 공통 direct host의 JSC 화면·달력 연결과 공급

`native-jsc-host.mjs`는 기존 `windows-hermes/main.cpp`의 고정된 생성·실행·VM inventory 지점만 검사해 별도 진단 host를 만든다. 창·입력·frame clock·Skia binding·GPU 제출·SDK 서비스·종료 코드는 공통 원본을 사용한다. 기존 Hermes `main.cpp`와 `LoadedIdentity.h`는 변경하지 않았다. VM은 pinned JSC source 실행, rejection tracker는 C API, engine/profile/ready 표시는 실제 JSC로 연결한다. Hermes 전용 GC/CPU profiling 옵션을 JSC 결과에 섞지 않는다. 로드된 VM·ICU 경로/hash 검사와 RN/Node-API/다른 VM 거절도 유지한다. renderer의 ICU 79와 JSC의 ICU 77을 명시적으로 함께 로드하고 각각 검증한다.

`native-jsc-probe-build.mjs`는 현재 host의 **동일한 `nelyx_host_skia.lib`**와 direct JSI library·MSVC Release flags를 사용한다. adapter/header/object/import library/실행 파일·DLL·번들은 실행 하나의 임시 출력에만 생성하고 종료 시 회수한다. 앱 assets는 현재 제품의 파일을 Source와 대조해 읽으며 SDK/설치본 전체를 복제하지 않는다. 새 JSC 기본 제품 supplier나 RNW host 전환을 만들지 않았다. JSC VM core pin과 header pin은 검증하지만 최종 배포용 archive provenance·license 공급 수락은 아직 범위 밖이다.

SDK bridge에 명시적 `engine='jsc' / mode='source' / executionMode / trackRejections` admission을 추가했다. 기존 engine 태그가 없는 Hermes ABI 2와 bytecode/static-aot는 유지하고 잘못된 engine/mode·tracker·capability·port는 거절한다. bootstrap의 host/runtime/profile/ready도 실제 엔진을 사용한다. 새 `check-direct-runtime-bridge.mjs`에서 legacy Hermes·명시적 JSC 두 모드 및 malformed admission을 검사해 PASS했다.

실제 JSC interpreter Demo 첫 프레임·8초 실행·정상 종료가 PASS했다. 후속 달력 입력 검사에서는 도구의 고정 `NelyxHermesHost.exe`를 발견해 허용된 두 실행 파일 중 요청된 이름과 **소유 출력의 절대 경로**가 모두 맞는 한 process만 선택하도록 고쳤다. 첫 dialog 검사 실패는 `FAST_CALENDAR_READY` 이후에도 400ms 고정 대기 직후 UIA header/day가 아직 없는 경우였다. Setup에서만 최대 5초 동안 실제 dialog semantics를 기다리며 header/day 개수·foreground·입력·월 이동 기준은 유지했다. 마지막 no-screen 준비 실행에서 **+4/+3/−6월·입력 158개 수신=전달=수락·거부 0·exit 0 PASS**다. 이 준비 실행은 공급 통일 전 workspace SDK를 사용했으며 표시 관측도 없으므로 최종 엔진 비교 표본으로 사용하지 않는다.

이후 Core·SDK를 현재 Source에서 build하고 Core·SDK·CLI를 한 번 pack해 Demo Windows/Web·Testbed Windows에 공급했다. 세 runner의 실제 npm install이 각각 3 packages를 교체했으며 다음 **전체 선언 파일의 `packageBuildInputs`**가 workspace와 모두 같았다. 이 값은 archive SHA와 구분한다. Web의 nested `hermes-estree@0.32.0`도 보존했다.

| package | 세 runner 공통 내용 identity |
| --- | --- |
| Core | `05eb141b82c8c508205511f09ed99899c06cdd3db01dfd17a06a197bb8e111ab` |
| SDK | `6a21ce7d2b549d79e03987ce141956585f58f36e7a5e42528cb3889bbb95b0df` |
| CLI | `5285bc503e14b504dfce9992cc239a0cc91ff7812f0b171e70b0331332cdbe69` |
| Material, §13 그대로 | `4c1deb1677e138c32cef0cdc4a35c148a2e7ab5ca37a8f693ddb8f1385e6771f` |

Core 645개·SDK 117개 emitted source-map 입력 검사와 11 workspace 전체 타입 검사가 PASS했다. 이 공급 이후 JSC도 workspace SDK override 없이 **같은 설치 SDK/framework/design**를 사용한다. Metro serializer·entry·asset notice hash를 Hermes와 맞췄으며 실제 비교는 `app.js`의 byte identity까지 확인한다. 기존 §13 제품 출력의 번들 hash가 이번 SDK 공급까지 포함한 최신 출력이라는 뜻은 아니며 일반 제품 재검증을 별도로 수행한다.

새 `check-direct-engine-comparison.mjs`는 각 새 프로세스를 Hermes→JSC interpreter→선택적 JSC JIT 순서로 반복한다. 공통 JS·renderer·원본 host Source·diagnostic entry·설치 SDK 전체 입력 및 viewport/DPI/refresh를 비교하며, 표시 관측 없는 결과는 받지 않는다. 첫 batch는 설치 SDK에서 CLI를 찾던 한 경로 오류로 JSC build 전에 중단됐다. 이때 완료된 Hermes 준비 실행은 engine FPS `38.752 / 29.824 / 17.141`, 표시 하한 `32.509 / 26.010 / 15.647`이었다. 준비 실패를 JSC 성능이나 성공한 3회 교차 비교로 처리하지 않는다. 경로 수정 후 공통 입력의 세 모드 교차 비교를 진행한다.

```powershell
node Nelyx/eng/check-direct-runtime-bridge.mjs
node Nelyx/eng/check-direct-engine-comparison.mjs --runs 3 --jit
```

비교는 현재 direct host 빌드·앱 assets와 로컬 pinned WebKit 2272 DLL이 준비된 환경에서 실행하는 진단이다. 전체 실행 제한은 20분이며 새 로그/receipt/history archive를 저장하지 않는다. 원래 framework §13의 기능·성능 판정은 유지하며 **PARTIAL / performanceAccepted=false / goal active**다.
### 15.6 동일 JS·renderer의 세 모드 교차 비교: JSC interpreter FAIL / JIT 허용 PASS-scoped

수정한 비교 도구로 **Hermes bytecode → JSC interpreter → JSC JIT 허용을 새 프로세스로 번갈아 3회씩, 총 9회** 실행했다. 최종 batch는 exit 0이며 무효 표본·교체 표본이 없다. 앞 절의 준비 실패와 공급 통일 전 no-screen 실행은 이 batch에 섞지 않는다. 각 비교에서 다음 identity가 모두 같았다.

- application `app.js`: `f2cdfc03585f8ed326718cb7d54d15c70a6a3a97af31b798a4c90e26c4f6014e`. JSC는 이 Source를 실행하고 Hermes는 같은 Source의 optimized HBC99를 실행했다.
- shared renderer library: `c072724ce40e82af5bf08076a800d5563500c4b6fb9312ad31c707aec8a3cadd`.
- 원본 host `main.cpp`: `99a04d4787a7dfb059b52f7c1ec28fc22c3094222bcebd0292a843141f870c8f`. JSC variant는 §15.5의 생성/VM 관련 patch만 적용했다.
- 설치 SDK 전체 입력: `b24bb38adcdcc2883a156e2579f91b7e34eefdc7d61bac717dedd85538dac9b6`; diagnostic entry: `9b550ab9a213445a67122f17e8d0b31c562b2920a029e09c72a66354e8916ece`.
- 2560×1459 physical, DPI 192, 165Hz; 같은 60Hz touch 48/30/60개, 6/6/12 gestures, 월 이동 +4/+3/−6. CPU/GC/build 관측 hook은 껐다.

Hermes VM/toolchain은 기존 `dbd11135…`, JSC는 pinned core DLL `6b540312…`를 사용했다. Hermes HBC는 `fd2930da527af584ac6ff75ff1ecfbd6a4a7978d638f6a3dc1504af836330687`, JSC variant Source는 `eb21d8ef…`였다. interpreter는 VM의 code-generation 허용 false, JIT 허용 모드는 true를 검사한 기존 factory를 사용했다. JIT 허용이라는 표현은 workload의 모든 함수가 JIT됐다는 주장이 아니다.

아래 순서는 **보통 정방향 / 빠른 정방향 / 역방향**이다. 표시는 별도 화면 marker observer의 평균 FPS 하한이며 실제 scanout을 뜻하지 않는다. native 종료 receipt 자체의 `displayed=unobserved` 표시는 그대로 유지한다.

| 모드·회차 | engine FPS | 관측 표시 FPS 하한 |
| --- | --- | --- |
| hermes 1 | 33.086 / 30.807 / 27.214 | 28.306 / 26.230 / 22.373 |
| hermes 2 | 31.177 / 27.907 / 19.179 | 29.160 / 25.881 / 17.793 |
| hermes 3 | 33.577 / 31.628 / 26.835 | 30.727 / 27.201 / 24.165 |
| interpreter 1 | 21.014 / 17.381 / 9.347 | 17.049 / 15.703 / 8.693 |
| interpreter 2 | 12.297 / 26.586 / 6.346 | 11.476 / 21.169 / 6.299 |
| interpreter 3 | 12.084 / 10.233 / 13.870 | 10.636 / 9.340 / 12.364 |
| jit 1 | 44.895 / 47.666 / 37.535 | 41.913 / 43.139 / 34.660 |
| jit 2 | 41.726 / 50.994 / 43.385 | 36.797 / 43.889 / 37.566 |
| jit 3 | 44.987 / 55.426 / 46.158 | 39.934 / 47.111 / 38.860 |

표시 FPS의 phase별 **3회 중앙값**은 Hermes **29.160 / 26.230 / 22.373**, JSC interpreter **11.476 / 15.703 / 8.693**, JSC JIT 허용 **39.934 / 43.889 / 37.566**다. engine 중앙값은 각각 **33.086 / 30.807 / 26.835**, **12.297 / 17.381 / 9.347**, **44.895 / 50.994 / 43.385**다. JSC interpreter는 세 phase 모두 성능 대안으로 실패했다. JSC JIT 허용은 **각 실행·각 phase의 engine과 표시 하한 모두 30 이상**이며 이 달력 gate를 PASS했다. 작은 3회 비교를 통계적 유의성이나 엔진 전체의 보편적 우열로 표현하지 않는다.

표시 진행의 ≥100ms 정체 중앙값을 현재 Hermes baseline과 비교했다.

| phase | 횟수 Hermes→JIT | 총 시간 ms Hermes→JIT | 최장 ms Hermes→JIT |
| --- | --- | --- | --- |
| 보통 정방향 | 8 → 3 | 1001.595 → 397.798 | 197.182 → 173.070 |
| 빠른 정방향 | 4 → 1 | 666.688 → 133.342 | 188.675 → 133.342 |
| 역방향 | 7 → 2 | 1138.180 → 221.631 | 229.004 → 125.881 |

engine 정체 중앙값도 모든 phase에서 횟수·최장이 증가하지 않고 총 시간이 줄었다. 따라서 §7의 진행 정체 수치 gate는 **JIT 허용 PASS-scoped**다. 정체가 사라진 것은 아니며 보통 구간의 표시 최장 중앙값은 여전히 173.070ms다. interpreter는 횟수가 적게 집계된 phase도 총 시간·최장이 늘어 정체 기준을 통과하지 못했다.

입력→surface 지연의 phase별 **p50 / p95 / p99 / 최장 중앙값(ms)**도 모두 감소했다. surface는 표시 시간이 아니다.

| phase | Hermes | JSC JIT 허용 |
| --- | --- | --- |
| 보통 정방향 | 177.578 / 253.894 / 256.050 / 256.050 | 111.598 / 187.795 / 196.807 / 196.807 |
| 빠른 정방향 | 214.324 / 386.895 / 386.895 / 386.895 | 93.977 / 138.498 / 138.498 / 138.498 |
| 역방향 | 292.557 / 445.647 / 461.647 / 461.647 | 99.883 / 155.647 / 159.124 / 159.124 |

9회 모두 주입 touch 48/30/60개가 수신·수락됐고 같은 월 정착과 UIA 검사를 통과했다. 전체 native 입력은 Hermes 158/158/158개, interpreter 158/157/160개, JIT 157/158/157개이며 각 실행에서 **수신=전달=수락·거부 0·exit 0**이다. 전체 개수에는 Setup 등의 마우스 입력도 포함돼 차이가 있으며 성능 phase의 touch 계획은 같다.

이번 결과는 현재 Nelyx workload에서 실행 엔진/JIT 허용 여부가 큰 영향을 준다는 근거다. **Hermes이기 때문에 목표 달성이 원천적으로 불가능하다는 증명은 아니며, JSC interpreter로 교체할 근거도 아니다.** 다음 후보는 JSC JIT의 shared host 경로다. 현재 연결은 명시적 진단이며 기본 제품 엔진은 Hermes다. JSC의 공통 기능·제품 supplier·일반 CLI/API 경로·장시간/실제 입력 수락을 이 달력 결과로 대신하지 않는다. **달력 JIT 수치 gate PASS-scoped / 전체 performanceAccepted=false / goal active**를 유지한다.

### 15.7 JSC 공통 기능·현재 기본 제품 검증과 다음 경계

달력 비교 뒤 JSC JIT의 공통 기능 검사를 이어갔다. 이 검사는 새 달력 성능 표본을 고르는 재실행이 아니며 각 시나리오 1회다.

| 검사 | 최종 결과 |
| --- | --- |
| native boundary | 넓은 객체 64/65/78/127/128/129/160 fields의 순서·prototype·freeze/seal·symbol/accessor, 실제 Semantics 값 생성, 12개 텍스트 case의 한글/emoji/RTL·ellipsis·placeholder·fallback, 장면 path/paint replay PASS. bundle `e75a3473…`, first frame·exit 0 |
| Demo Gallery | wheel cold/return/warm, 한글·emoji 편집, theme/resize 후 값 보존·최종 editor 확인 PASS. 표시 하한 63.091/60.101/59.348fps, ≥100ms 정체 0. 입력 177개 전부 보존·거부 0, wheel 수신=전달=480, exit 0. bundle `dd6ede3b…` |
| Testbed variable list | cold→이동→return→warm의 UIA 항목 A→B→A→B와 같은 진행량 PASS. 표시 하한 66.620/61.043/59.210fps, ≥100ms 정체 0. 입력 161개 전부 보존·거부 0, wheel 수신=전달=480, exit 0. bundle `8bc4814a…` |
| 일반 Testbed | MixedScroll 한글·emoji 편집 유지·왕복 wheel·counter 1, 별도 ListView의 UIA 진행과 돌아오기 PASS. 입력 121개 전부 보존·거부 0, wheel 수신=전달=288, exit 0. bundle `f948d072…`. 표시 FPS 미관측 |

Gallery의 2560×1459 최종 화면을 임시 screenshot으로 열어 카드·아이콘·progress/dialog controls·텍스트 배치를 확인했다. 왼쪽 위의 검정 표식은 진단 marker이며 제품 UI가 아니다. screenshot은 finally에서 회수했고 저장하지 않았다. 이는 Gallery의 제한된 시각 확인이며 다른 모든 화면의 시각 수락을 뜻하지 않는다.

첫 Testbed list 시도는 기존 `current-bytecode/Assets`가 없어 build 단계에서 멈췄다. 기능 실행·FPS 표본으로 세지 않았고 이미 통과한 boundary/Gallery를 반복하지 않았다. 현재 설치 SDK로 **일반 Testbed native bytecode 제품**을 먼저 빌드해 Source 자산과 inventory를 준비한 뒤 남은 list/Testbed 두 검사를 통과했다. Testbed renderer archive `fef5ea8a…`는 그 앱의 현재 host 공급이다. Demo 달력의 동일 renderer 비교 `c072724c…`와 섞지 않는다.

기본 엔진을 바꾸지 않고 일반 제품 출력도 최신 SDK와 맞췄다.

- README의 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`: 변경된 입력을 감지한 재빌드·첫 프레임·정상 종료 PASS. `forced=false`, exit 0. 기본 974×929 / DPI 192 / 165Hz이며 최대화한 달력 비교와 구분한다. HBC `a3fb0dd8a001cafc6c18cd4c0c57225f9a538d0fe6964e7b29b8afd497d186e3`, host `6364b833…`, VM `5a7a8d64…`.
- 일반 Testbed의 현재 native HBC `1738228fc89f11f5566e9db4127232bc9dd52476754847f6c73da6d879a2f323`를 빌드·inventory 검증했다. 위 실제 Testbed 기능 검사는 JSC 진단 실행이며 일반 Hermes Testbed UI를 이번 절에서 다시 실행한 것은 아니다.
- `npm.cmd run build:web --workspace @nelyx/demo` PASS. 새 Web 제품의 `application.js` SHA-256 `437bfb4c8bd111f88016b542771024479948d177110f153b8f8136ecfb9e64c5`가 §13/§14 복원 제품과 완전히 같다. 기존 Source Web 기능 이력과 현재 동일 번들을 구분해 기록하며, 이번 절에서는 browser 검사를 반복하지 않았다.
- 최종 Core 645개·SDK 117개·Material 275개 emitted source-map 입력, Demo Windows/Web·Testbed Windows의 Core/SDK/CLI/Material 전체 package 파일 내용 일치, Web nested estree 0.32.0 및 두 일반 native 제품 inventory를 다시 확인했다. 모두 PASS이며 일반 제품에는 diagnostic entry가 없다. 새 코드 12개 파일 lint/format과 전체 11 workspace 타입 검사도 PASS다.

JSC direct 연결·실제 동일 입력의 세 모드 각 3회 비교·위 공통 기능 검증은 완료했다. 현재 결과에 맞춰 다음 우선순위를 **JSC JIT 허용의 정식 direct host 공급과 제품 경로**로 옮긴다. interpreter 교체와 추가 Widget 미세 수정을 성능 해법으로 계속 시험하지 않는다.

남은 필수 구현·수락은 다음과 같다.

1. 현재 진단용 Source patch에 의존하는 VM 생성·실행·inventory를 공통 host의 명시적 engine factory로 옮기고, direct JSI용 JSC supplier의 archive provenance·license·ICU·mode file hash/실제 mode 일치를 제품 계약으로 확정한다.
2. 일반 CLI/API의 명시적 JSC 옵션을 같은 direct host로 연결한다. 기존 RNW JSC 옵션으로 우회하지 않으며, 기존 Hermes 기본값을 이 진단 결과만으로 바꾸지 않는다.
3. 정식 제품 경로의 최종 Source·공급에서 공통 기능과 같은 3회 달력 gate를 확인한다. 실제 trackpad·scanout·screen reader·장시간 자원 수락은 별도 범위로 남긴다.

최종 정리에서 소유 native/입력/화면 검사 process, diagnostic entry/package, batch/session, SDK staging·이전 dist·임시 pack이 남지 않은 것을 확인했다. `.tmp`의 기존 네 파일은 보존했다. 현재 dist·현재 일반 제품·현재 runner 공급만 유지하고 새 raw log/receipt/history archive를 저장하지 않았다. 최종 `git diff --check` PASS다.

**달력 JSC JIT 30fps·정체 수치 및 공통 기능 PASS-scoped / 기본 제품 Hermes / JSC 정식 제품 경로 notImplemented / 전체 PARTIAL / performanceAccepted=false / goal active**다.

## 16. JSC 정식 direct host 연결 작업의 중간 인계 — PAUSED / PARTIAL

### 16.1 중지 계약

2026-11-17 사용자의 **“일단 중간 마무리해줘”** 요청으로 새 구현·build·공급·실행 검증을 중지했다. 현재 미커밋 변경과 기존 작업을 그대로 보존한다. 이 절이 §15.7 이후의 최신 상태이며, §15의 `goal active`와 최신 공급 일치 표기는 당시 이력이다. **사용자의 명시적인 재개 요청 전에는 자동으로 다음 구현·검증·공급을 시작하지 않는다.** 전체 목표는 완료가 아니며 `performanceAccepted=false`다.

### 16.2 이번에 작성한 Source와 실제 검증 경계

- `native/windows-hermes/Engine.h`, `Engine.cpp`, `EngineHermes.cpp`, `EngineJsc.cpp`를 추가했다. VM 생성·bridge port·HBC/SHUnit 또는 Source 실행·프로파일러 종료·DLL 수명을 엔진 구현으로 옮기고 `main.cpp`와 CMake를 공통 host로 연결하는 변경을 작성했다. `LoadedIdentity.h`도 선택한 VM만 허용하도록 수정했다. **이 새 C++ Source는 아직 compile/link/runtime 검증을 하지 않았다.** 기존 Hermes bytecode/static-aot 및 JSC가 새 factory에서 정상 작동한다고 표시하지 않는다.
- 새 `windows-native-jsc.mjs`는 원본 WebKit archive SHA-256, runtime DLL 4개·공개 C API header 8개·고정 RN JSI adapter Source·라이선스를 검사해 최소 공급을 생성한다. 최초 실제 생성은 성공했고 `.nelyx/windows-native-jsc`에 현재 공급 1개만 남겼다. 당시 manifest SHA-256은 `db913cce10170817d044f221be1b82e0f7ea9d765e61a5711c26e3b2ddbd746a`, 파일은 21개다. archive·Source·license 다운로드/hash 및 import library 생성의 PASS이며 새 host 실행의 PASS가 아니다.
- 그 생성 **이후** portable package용 embedded 검증을 추가해 producer Source가 바뀌었다. 중단 시 공급의 producer hash는 `a20ed3e90c841f089d9b1151b08671ba2965e6973f074e80bb731c3ff3643396`, 현재 producer Source hash는 `80d0acea518e964030bd0ef8e450b781585c83ce7ba4f288ba42def3aea08ba0`다. 따라서 **현재 verifier 기준의 공급 갱신은 미완료**다. stale identity 검사를 우회하거나 manifest만 고쳐 맞추지 않는다.
- `windows-native-engine.mjs`의 엔진·mode 정책, `windows-native-host.mjs`의 JSC CMake target/공급 선택, `windows-native-runner.mjs`의 prepare/build/run/pack·공급/이미지/mode file 검사와 `windows-native-run-preparation.mjs`의 cache 선택을 작성했다. 일반 CLI의 `--host native`와 `--engine jsc --jsc-mode jit|interpreter`, `--jsc-inputs` 및 공개 선언도 연결하는 중이다. **일반 CLI end-to-end·typed CLI 검사·패키징/실행은 아직 미검증**이다.
- Demo의 app/runner 스크립트를 generic native host 선택으로 바꿨다. 기본 engine의 의도는 Hermes 유지다. 이 변경은 아직 새 SDK/CLI로 공급·build하지 않았으며 현재 README 실행을 새 Source의 PASS라고 안내하지 않는다.
- `native-jsc-probe-build.mjs`를 일반 `buildNativeHost`/`buildNativeApplication` 호출로 바꾸고 JSC도 `verifyNativePackage`를 거치게 했다. 이전 문자열 치환용 `native-jsc-host.mjs`는 참조를 확인한 뒤 제거했다. 새 경로로 진단을 다시 실행하지 않았다. §15.6의 성능 값은 **이전 진단 host의 검증 결과**이며 새 factory 성능 수락으로 이월하지 않는다.
- 엔진/mode 변경 시 잘못된 cache를 재사용하지 않는 JS 정책 회귀를 추가했다. `node Nelyx/eng/check-native-windows-run.mjs` **32 cases PASS**, 관련 변경 JS의 제한된 lint/format·구문 검사는 PASS다. 이것으로 새 native binary·실행·전체 CLI 타입을 검증한 것은 아니다. §15.7의 11 workspace 타입 검사도 이번 CLI 선언 변경 전 이력과 구분한다.
- 현재 Source에서 JSC의 Hermes 전용 profiling/heap counter 옵션은 거절하도록 두었다. JSC의 장시간 VM heap 관측·자원 수락은 구현/검증 완료로 표시하지 않는다.

### 16.3 현재 공급·제품과 workspace 차이

이번 factory/CLI 변경은 **SDK/CLI pack·공급·설치를 하지 않았다**. SDK의 TypeScript dist를 새로 빌드한 것도 아니다. 현재 설치/일반 제품은 §15.7 시점이며 최신 workspace native/CLI Source와 같다고 주장하지 않는다. 중단 직전 Demo Windows에서 전체 선언 package 파일을 대조한 값은 다음과 같다.

| package | workspace `packageBuildInputs` | 설치 Demo Windows |
| --- | --- | --- |
| SDK | `a410b384308130bf7535c894f322a04cea768dfbb9292ebac5efafd90e20f8d4` | `6a21ce7d2b549d79e03987ce141956585f58f36e7a5e42528cb3889bbb95b0df` |
| CLI | `a2bc75544b86f8e72502f7fd1510fd75028ece0b96f9a82f4b7790d94ee116fe` | `5285bc503e14b504dfce9992cc239a0cc91ff7812f0b171e70b0331332cdbe69` |

검증한 이전 일반 제품은 Demo Hermes HBC `a3fb0dd8…`, Testbed Hermes HBC `1738228f…`, Web `437bfb4c…`다. §15.7의 실행·기능 범위만 유효하며 새 Source를 포함하지 않는다. JSC JIT 표시 FPS 중앙값 `39.934 / 43.889 / 37.566`과 입력·공통 기능 PASS도 §15.6–15.7의 고정된 조건에 한정한다.

### 16.4 재개 시 첫 작업

1. 현재 factory의 VM/JSI callback·SHUnit/DLL 수명, 프로파일러 종료, 선택 mode와 mixed CLI 옵션을 코드에서 먼저 검토한다. 현재 Source를 그대로 빌드 가능한 완성본으로 가정하지 않는다.
2. producer Source를 확정한 뒤 고정 원본에서 JSC 공급을 갱신하고, SDK/CLI를 한 번 pack해 필요한 runner에 공급·설치한다. 현재 Source/dist/설치/공급 identity와 CLI 타입을 확인한다.
3. 새 CMake factory의 Hermes bytecode/static-aot·JSC 두 mode compile/link·첫 프레임·종료, mode/이미지 불일치 거절, 일반 CLI prepare/build/run/pack과 portable package를 확인한다.
4. 정식 경로의 최종 Source·공급에서 공통 기능과 같은 조건의 달력 3회 비교를 수행한다. §15 진단 결과를 새 제품 결과로 복사하지 않는다. 실제 trackpad·scanout·screen reader·장시간 자원은 별도 미검증 범위다.

이 목록은 인계용이며 지금 실행하지 않는다. 중단 정리에서 소유 native/compiler/진단 process 0, diagnostic entry 0, 추가 `.tmp` 항목·공급 staging·lock·임시 pack·SDK 이전 dist 사본 0을 확인했다. `.tmp`의 기존 네 파일, 현재 공급 1개와 기존 일반 제품·설치본은 보존했다. 새 log/receipt/history archive·독립 설치본을 남기지 않았고 commit은 하지 않았다.

**PAUSED / PARTIAL / performanceAccepted=false / goal paused / 명시적 재개 전 자동 진행 금지.**
