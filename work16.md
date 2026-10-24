# W16: Hermes·Static Hermes 중심의 연속 스크롤 공통 엔진 개편 계획

계획 개정일: **2026-10-24 KST** · 구현 중간 마무리 기준일: **2026-10-23 KST** · 대상: **Hermes bytecode·Static Hermes에서의 Nelyx Core와 SDK host 접점**

> **CLOSED / SUPERSEDED BY [W17](work17.md) · 기존 구현 PARTIAL · performanceAccepted=false.** 2026-10-25부터 이 문제의 유일한 활성 계획은 W17이다. W16의 구현·측정·실패·이름 변경 기록은 과거 근거로 유지하며, 이하의 우선순위·다음 작업·단계 순서는 현재 실행 지시가 아니다. 미완료 기능·공급·안정성·성능·물리 수락은 W17에서 재평가·승계한다. 이번 종료는 버벅임 해결이나 성능 수락을 뜻하지 않는다.

**현재 우선순위는 §8.4의 공통 할당·레이아웃 구조 개선이다.** 사용자의 “검증보다 병목 구조 판단, GC 압박과 레이아웃 방식 검토” 요청에 따라 native 반복 측정을 멈추고 RenderObject 자식 저장소·layout 호출·Flex 측정/배치의 중복 객체를 줄인다. 기존 G6와 모드별 수락 기준은 유지한다.

**개편 방향:** **Hermes bytecode·Static Hermes의 동일 부하 기준선과 비용 계측 → 공통 엔진의 항목 소유권·증분 갱신 및 최초 생성·문단 단가 개선 → 필수 layout과 선택 작업 분리 → 자원 예산에 따른 보존·준비** 순서로 진행한다. 두 모드의 일반 `ListView.builder`와 현재 갤러리에서 먼저 엔진 효과를 검증한 뒤 샘플을 공통 API로 전환한다. 갤러리 분할·cache 확대·prefetch로 엔진 자체의 cold 진입 비용을 가리지 않는다.

이 문서의 이전 **cache/prefetch·gallery block 전환 중심 실행 순서는 CLOSED / SUPERSEDED BY 본 엔진 개편안**이다. 필요한 정확성·공급·물리 검증 조건은 아래에 통합했다. 이번 문제의 실행 계획은 이 문서 하나로 관리한다. [W14](work14.md)의 전체 개편은 **PAUSED / PARTIAL**로 두고 E01 자원·E02 scroll/State·E06 frame의 관련 공통 엔진 범위를 구체화한다. [W15A](work15a.md)의 전체 native AOT·타입 정책 수락과 기존 `performanceAccepted=false` 판정은 유지한다. 기본 V8 및 Hermes/JSC 선택 계약도 유지한다.

이전 **Static AOT/V8 주 성능 matrix는 CLOSED / SUPERSEDED BY 본 Hermes 2모드 계획**이다. 이후 실행·수락에는 §1.3/§5/§6을 적용한다. 이전 측정값은 당시 엔진·조건을 보존한 참고 근거로 남긴다. W16의 최적화 우선순위 변경과 Testbed 일반 빌드의 기본 엔진 변경은 별도이며, 이번 요청은 전자에 해당한다.

## 1. 재검토 결과와 범위

### 1.1 이전 설계·구현 기준선과 이번 계획 개정

- 최초 공통 엔진 설계 개정 HEAD: `c05325432144e5d08ed0745a866ffe515fb21de4`. 당시 개정 시작 시 `git status --short`는 비어 있었다.
- 조사 문서 SHA-256: `e8cbc815fc7431af2a693ea96acb6ad0e025561f6760b14e0193e294dddde437`.
- 최초 설계 개정 전 `work16.md` SHA-256: `cf3d6883f42636914a7258daa2cf65ff3214f2ee570fccd2d92ae81fc5940f89`.
- 최초 설계 개정 당시에는 source/검사 구조만 검토했고 실행하지 않았다. 이후 전체 구현 요청의 시작점과 실제 검증은 §8.1에 구분한다. `research.md`·W14·W15A는 이번 계획 개정에서도 수정하지 않는다.
- 2026-10-24 계획 개정 시작 HEAD는 `af62645ac8618a0d6ead40d0d361d200a0b151de`, 개정 전 W16 SHA-256은 `d375a6c9ffbae8a2d5314e1bf330fe8c0ba3f0a53c7edaf9e17ddefdf682e982f`다. 작업 트리에는 §8.1의 미커밋 구현·검사·공급 변경이 이미 있었다. 이번에는 `work16.md`만 수정하며 이전 실행 결과와 미수락 판정을 재사용해 새 실행으로 표기하지 않는다.

### 1.2 기존 계획에서 고칠 점

| 검토 결과 | 이번 개정의 결정 |
|---|---|
| 갤러리 분할이 공통 엔진 검증보다 먼저 있었다. | 공통 child store·생성/갱신·text·layout 구조를 먼저 바꾸고 기존 앱으로 검증한다. 샘플 분할은 이후 공개 엔진 API의 소비 단계로 옮긴다. |
| 기존 항목을 보존해도 처음 보는 항목의 생성 단가는 남는다. | 보존/준비를 꺼도 일반 ListView의 최초 진입 비용이 줄어야 엔진 개선으로 수락한다. cold·짧은 재방문·보존 범위 밖 재방문을 분리한다. |
| visible-first를 정책만으로 표현했다. | viewport의 layout demand, sliver의 실제 materialization, 전체 PipelineOwner 수렴을 별도 계약으로 정의한다. 일부 child를 만든 뒤 임의로 layout을 중단하지 않는다. |
| per-sliver cache와 시간 예산만으로는 두 열·nested owner의 합계가 제한되지 않는다. | 하나의 View 작업 예산과 기존 ResourceRegistry 회계를 사용한다. 두 열이 각각 같은 예산을 독립 소비하지 않는다. |
| post-frame·deadline 확장이 준비 작업의 중심이었다. | 기존 root/frame clock을 유지하고 선택 작업용 제한된 추가 layout pass를 설계한다. 관측된 deadline 부재가 기본 엔진 개선을 막지 않도록 준비 기능을 독립시킨다. |
| 내부 최적화가 모두 없는 것처럼 다시 만들 위험이 있다. | BuildScope heap, singleton reconciliation, inherited index, render projection/dirty sync, retained layer, 문단 cache·자원 회계는 이미 존재한다. 실제 잔여 중복만 제거한다. |
| 8/16개·2ms 같은 값이 구조 계약과 섞여 있었다. | 시간·개수는 비교 전 고정할 초기 실험값으로 둔다. 소유권·정확성·admission은 값과 독립적인 필수 불변식이다. |

조사의 가장 강한 근거는 새 항목 진입 시 동기 build/layout/retirement가 집중된다는 점이다. 80px 전진 24회에서 Element 생성·해제 각각 1,776회, frame p95 16.773ms는 **Node V8 + CanvasKit CPU 진단**이며 Windows AOT/물리 표시 결과가 아니다. 실제 precision·표시·GC pause·GPU 기여도는 계속 별도 검증한다.

**목표 범위:** 고정 80px/1,000행, 실제 Material/Cupertino gallery, 동일 공통 엔진을 사용하는 공개 ListView/Sliver 소비자의 cold 진입·재방문·입력 대기·자원 수명을 개선한다. Windows x64 Release의 **Hermes bytecode와 Static Hermes native AOT 모두를 주 성능·기능·물리 수락 대상**으로 한다. V8·JSC jit/interpreter·Web은 공통 변경의 호환성 회귀 대상으로 둔다. W14 신규 component family와 다른 OS의 물리 성능 수락은 별도 범위다.

### 1.3 엔진별 역할과 기준선

| 대상 | 고정 실행 조건 | W16에서의 역할 |
|---|---|---|
| **Hermes bytecode** | `--engine hermes --hermes-mode bytecode --hermes-profile optimized --configuration Release` | 첫 기준선 확보·공통 JS 연산/할당·GC 비용 분석. G3/G6 및 실제 앱·입력·수명 수락을 독립 수행한다. `debug`/`-Og`는 진단 비교용이다. |
| **Static Hermes** | `--engine hermes --hermes-mode static-aot --hermes-profile optimized --configuration Release` | 같은 앱·부하에서 native 함수/PC와 Core·VM/GC·host 비용을 연결한다. G3/G6를 독립 수행하고 전체 native coverage·타입 정책·fallback 0 audit를 유지한다. |
| V8·JSC·Web | 기존 공개 엔진/모드 계약과 공급 경로 | 기능·State/IME·자원 수명·close 회귀를 확인한다. 성능 이상이 관찰된 owner만 추가 측정하며 주 24회 성능 matrix에는 포함하지 않는다. |

- **전후 개선은 같은 모드끼리 비교한다.** Hermes bytecode baseline→bytecode 후보, Static Hermes baseline→Static Hermes 후보를 각각 판정한다. bytecode보다 AOT가 빠르다는 것만으로 공통 엔진 개선을 수락하지 않는다. 한 모드의 개선으로 다른 모드의 실패를 상쇄하지 않는다.
- 동일 Hermes revision·VM/GC 공급 identity와 native cohort를 확인하고, renderer·접근성·창/DPI·입력·font/cache 정책을 고정한다. 최종 Metro graph와 공통 변환 조건을 기록하되 HBC와 AOT의 서로 다른 lowering·compiler flags·typed/dynamic-native 정책도 구분한다. mode 전환은 새 process에서 수행한다.
- 우선 Core의 반복 JS 연산·할당·ancestor 탐색·text 직렬화·layout/retirement를 줄인다. VM/compiler 수정은 두 경로의 attribution이 해당 owner를 가리킬 때만 검토하고, pin·타입/JS 의미·coverage 계약의 재검증을 포함한다. AOT 특화율 확대는 이번 계획의 선행 해법으로 삼지 않는다.
- §8.1에는 Hermes bytecode의 신규 연속 부하 baseline이 없다. 기존 V8 결과와 W15A의 warm/seek 결과는 참고용이며, 이후 구현 시작 전 두 주 모드의 신규 baseline부터 확보한다. 과거 최적화 전 공급을 정확히 재현할 수 없으면 현재 중간 공급을 새 baseline으로 선언하고 이후 변경분만 평가한다.

## 2. 현재 엔진과 개편할 책임

| 영역 / 근거 소스 | 이미 있는 구조 | 바꿀 책임 |
|---|---|---|
| [framework.ts](Nelyx/src/framework/widgets/framework.ts) | BuildScope의 heap dirty queue, singleton reconcile, KeyMap/GlobalKey retake, inherited index, dirty render sync가 있다. | 실제 변경 subtree만 build/sync하고, lazy 항목 갱신의 구조 변경을 한 범위로 정리한다. 기존 fast path·custom getter·dependency 의미를 보존한다. |
| [widgets/sliver.ts](Nelyx/src/framework/widgets/sliver.ts) | `createChild`마다 delegate build·reconcile·child 목록 정렬/sync를 수행한다. isolated build scope가 layout에서 flush된다. | key/slot/Element의 지속적인 항목 표와 변경 내역을 관리한다. 깨끗한 재사용 항목의 불필요한 builder·전체 sibling sync를 줄인다. |
| [sliver-multi-box-adaptor.ts](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts) | active array/chain·keep-alive bucket·전체 소유 자식 256개 제한이 있다. | 항목 표와 실제 render 소유권을 일치시키고 국소 insert/move/remove를 반영한다. 명시적 keep-alive와 선택 보존의 이유·회계를 구분한다. |
| [viewport.ts](Nelyx/src/framework/rendering/viewport.ts), [fixed extent](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts), [section list](Nelyx/src/framework/rendering/sliver-section-list.ts) | cache 범위를 동기 materialize한다. section 높이 측정 후 offset correction으로 재layout한다. | 필수 coverage와 선택 준비 목표를 구분하고, 실제 확보한 cache geometry와 anchor 수렴을 공통 규칙으로 관리한다. |
| [PipelineOwner](Nelyx/src/framework/rendering/object.ts), [FrameworkRoot](Nelyx/src/framework/widgets/root.ts) | dirty layout 수렴·허용된 layout callback·paint/semantics/input geometry·finalize 순서를 소유한다. | 모든 필수 layout 완료 후 선택 항목을 제한적으로 layout할 수 있는 경계를 만든다. geometry/semantics/finalize의 기존 commit·실패 처리는 유지한다. |
| [ui/text.ts](Nelyx/src/ui/text.ts), [TextPainter](Nelyx/src/framework/painting/text-painter.ts), [TextLayoutCache](Nelyx/src/hosting/text-layout-cache.ts) | immutable 입력·문단 재사용·key 검증과 cache가 있다. | 검증된 내부 text/style snapshot을 한 번 생성해 key/cost/layout 경로에서 재사용한다. public 객체의 관찰 가능한 JS 의미는 유지한다. |
| [ResourceRegistry](Nelyx/src/hosting/resources.ts), [TextLayoutBudget](Nelyx/src/hosting/text-layout-budget.ts) | producer/resident/in-flight 수명과 비소유 cost 회계가 있다. | View의 선택 보존·준비 admission을 기존 실제 회계에 연결한다. 별도 cache가 lease를 중복 소유하지 않게 한다. |
| [FrameScheduler](Nelyx/src/framework/scheduler/scheduler.ts), [ViewRuntime](Nelyx/src/hosting/runtime.ts), [Windows frame clock](Nelyx/sdk/src/platforms/windows/frame-clock.ts) | host tick, 256-packet mailbox, prepared CPU frame/backpressure, 보정된 tick/dispatch/queueDelay가 있다. | View 전체의 작업 우선순위·취소·입력 지연 추적을 추가한다. root마다 새 RAF나 timer loop를 만들지 않는다. |
| [RepaintBoundary](Nelyx/src/framework/rendering/repaint-boundary.ts), [value-math.ts](Nelyx/src/ui/value-math.ts) | retained layer와 `finalFieldProtector`가 이미 있다. | 검증된 기존 경로를 재사용한다. 초기 cold 병목과 무관한 renderer 전면 교체나 freeze 일괄 제거를 계획에 넣지 않는다. |

## 3. 공통 엔진의 새 구조

### 3.1 책임·데이터 흐름·도입 단위

```text
기존 native input / host frame clock
  → ViewRuntime: 입력 순서·backpressure·frame token
  → FrameworkRoot: View 작업 예산·필수/선택 pass 조정
      BuildOwner / BuildScope: 변경 subtree build·동일한 State/Key 의미
      Viewport: 현재 필수 coverage·focus 요청·준비 목표
      Sliver: 실제 range 확보·측정·anchor correction
      항목 표 + 기존 RenderSliver owner: identity·slot·보존·국소 구조 변경
      Text snapshot + 기존 TextLayoutService/Registry: 문단·비용·수명
  → 기존 paint/scene·semantics/input geometry·finalize
  → frame freeze / lease / submit / native retirement
```

아래 타입명은 **설계 계약을 설명하는 잠정 이름**이다. 실제 코드는 해당 기존 owner에서 시작하고 응집된 내부 모듈만 추출한다. 비슷한 global manager·두 번째 widget tree·두 번째 registry를 만들지 않는다.

| 계약 | owner / 보유 데이터 | 공개 범위 |
|---|---|---|
| `SliverChildStore` | SliverMultiBoxAdaptorElement당 하나. key/slot→Element·실제 RenderBox 참조, 구조 revision·변경 slot·보존 이유. 실제 mount/attach owner는 기존 Element/adaptor다. | Core 내부. render 측에는 필요한 조회·변경 계약만 전달. |
| `SliverLayoutDemand` | viewport/sliver의 현재 visible·focus 필수 요청, optional 준비 목표, delegate/metric/owner revision. | Core 내부. 기존 SliverConstraints·geometry의 의미와 분리. |
| `ViewWorkBudget` | FrameworkRoot/View당 하나. 실제 CPU 경과, 선택 작업 allowance·후보·취소, 기존 자원 회계 조회. tree/paragraph/frame lease를 추가 소유하지 않음. | Core 내부, host timing/backpressure capability만 SDK 경계로 전달. |
| 내부 owned text snapshot | TextPainter/호스팅 text 경계의 검증된 immutable 입력 identity·font revision·key·cost. | Core/hosting 내부. public mutable 입력은 기존 검증 경로 사용. |
| grouped child delegate | 논리 section과 독립 lazy child의 stable key·count·builder·index 대응. | 기존 `SliverChildDelegate`/`ListView.custom` 계열로 공개. gallery 전용 API로 만들지 않음. |

공개 정책 초안은 `ListViewOptions.childPolicy`와 대응 sliver 옵션으로 전달한다. 미지정/`legacy`는 기존 cache·keep-alive 의미를 유지하고, `bounded`는 필수 수요·View 예산·선택 보존을 명시적으로 선택한다. 자동 준비는 그 안의 별도 `disabled`/`observed-budget` 선택이다. 초기에는 `bounded`와 명시적 `cacheExtent`/`scrollCacheExtent` 동시 지정을 거부해 두 의미를 섞지 않는다. 이름은 W16-02에서 확정하되 기본 ListView의 생성/갱신 단가 개선은 정책 선택과 무관하게 적용한다.

### 3.2 항목 소유권과 구조 변경을 하나로 정리한다

1. **단일 항목 표:** `_childElements`·render active chain·keep-alive bucket의 대응을 한 계약으로 묶는다. key 비교는 기존 `KeyMap`/`sameKey`, keyed remap은 `findChildIndexCallback`을 사용한다. index가 같아도 다른 논리 항목의 State를 재활용하지 않는다.
2. **변경 범위:** create/move/remove가 만든 변경 slot을 모아 구조 revision당 정렬 snapshot과 Element children projection을 갱신한다. `syncSiblings`는 바뀐 인접 관계를 우선 반영한다. 실제 predecessor와 layout callback 권한이 필요한 순간에는 즉시 일관성을 제공한다.
3. **관찰 가능한 순서:** builder·mount·dependency·render attach·didUpdate·dispose 호출 순서와 예외 의미는 유지한다. 여기서 변경 묶음은 내부 bookkeeping 최적화다. 임의의 사용자 side effect를 rollback할 수 있다고 가정하지 않는다.
4. **재사용 경로:** 같은 key/type·현재 delegate/환경에서 깨끗한 항목은 같은 Element/RenderObject를 사용한다. dirty 항목은 기존 isolated BuildScope에서 정상 갱신한다. delegate 교체나 `shouldRebuild=true`가 요구하는 builder 호출·갱신은 유지하고, callback이 같다는 이유만으로 순수성을 추정하지 않는다. 보존된 항목도 theme·locale·폭·data 변경을 건너뛰지 않는다.
5. **실패 처리:** 일부 mount/attach 뒤 실패하면 실제 생성한 소유분만 정상 정리하고 첫 예외를 보존한다. 중복 key·실패한 retake·render admission 실패 뒤에도 stale store entry·orphan render·이중 lease를 남기지 않는다.
6. **비용의 범위:** 작업량을 전체 itemCount가 아닌 현재 소유 항목과 실제 변경 subtree에 대응시킨다. 기존 256 제한을 높여 비용을 숨기지 않는다. 배열 splice 등이 남으므로 모든 연산을 O(1)로 만들었다고 주장하지 않는다.

새 범용 Widget pool이나 다른 row에 State를 재바인딩하는 recycling은 도입하지 않는다. `visitChildren`·public readonly snapshot·custom render projection의 관찰 계약도 유지한다.

### 3.3 최초 생성과 갱신 자체의 단가를 줄인다

- **보존/준비 off인 일반 ListView를 기준으로 먼저 수정한다.** Widget/Element/RenderObject 생성 수, field 보호·snapshot·단일 child projection·ancestor/dependency 처리·attach/sync의 native 비용을 분리한다.
- Hermes bytecode와 Static Hermes 각각에서 JS 연산·native 호출·할당/GC를 대응시킨다. Node/V8 profile은 탐색용으로만 사용하고, 수정 우선순위와 효과는 Hermes 두 모드의 실제 cold/revisit 비용으로 확정한다.
- 이미 구현된 singleton reconcile·BuildScope heap·inherited index·`finalFieldProtector`를 기준선으로 삼는다. 같은 기능을 새 cache로 다시 만들지 않고 실제 반복 descriptor 정의·배열/Map/Set·render projection 복사·전체 sibling 순회를 찾아 줄인다.
- 구조가 변하지 않은 subtree의 render projection과 내부 immutable config는 identity/revision에 따라 공유한다. public mutable Widget 입력과 가상 getter를 임의로 memoize하지 않는다. 현재 render-tree dirty 전파와 GlobalKey 재부모화 시 무효화를 유지한다.
- inherited/theme 조회는 현재 dependency graph를 재사용한다. 재부모화·동적 type getter·shadowing·명시적 outer dependency·다른 View 구분을 보존한다. 모든 조상 탐색이 아직 선형이라고 전제하지 않는다.
- wrapper 제거·구성 축소는 semantics/focus/Ink/keep-alive 계약과 native attribution을 확인한 항목만 적용한다. 74개 Element라는 숫자 자체를 목표로 삼아 필요한 owner를 제거하지 않는다.
- 추가 cache는 항상 수명·key·상한·무효화 owner가 있어야 한다. 캐시를 꺼도 제거된 중복 작업의 이득을 따로 확인한다. 큰 갤러리 subtree를 잘게 나누기 전에도 고정 행 cold p95와 항목당 비용이 감소해야 한다.

### 3.4 text 입력·스타일 snapshot과 문단 회계를 통합한다

1. `TextPainter → TextLayoutService` 경계에서 내부 소유 입력을 검증·snapshot하고, 동일 immutable 입력의 style freeze·key 직렬화·비용 계산을 반복하지 않도록 공통 데이터를 재사용한다. font catalog를 호출마다 새로 펼치는 비용도 실제 revision 변경과 구분한다.
2. owned snapshot identity는 엔진이 직접 만든 값에만 부여한다. `Object.isFrozen`만으로 임의의 public 객체·Proxy·getter·toJSON을 신뢰하지 않는다. 외부 입력의 검증/직렬화 순서와 uncached 처리 의미를 유지한다.
3. text·폭·font catalog/resource generation·locale·direction·textScale·strut·runs·placeholder·Paint 의존성 등 현재 key 의미를 보존한다. 내부 fast path가 지원하지 않는 값은 기존 경로를 사용한다.
4. `TextLayoutCache`와 `TextLayoutBudget`는 같은 snapshot을 참조해 admission한다. 같은 paragraph의 producer·cache owner·in-flight reference를 임의의 별도 합계로 더하지 않고 ResourceAccounting의 실제 resident/producer 수명을 따른다.
5. snapshot의 JS 데이터 공유와 native paragraph lease 공유는 별개다. View/renderer/font generation을 넘어 layout 객체를 공유하지 않는다. 실패·font A→B→A·replacement·native drain의 현재 계약을 유지한다.
6. 초기 cache 상한(indexed 128, idle resident 64/1MiB)은 유지한다. cold/revisit 비용 감소, hit/miss/cache-only hit, 중복 직렬화 횟수·allocation을 함께 보고한다. 상한 확대는 이후 독립 튜닝이다.

### 3.5 viewport/sliver layout을 필수 수요 중심으로 바꾼다

**필수 coverage와 선택 horizon을 다른 입력으로 취급한다.** 현재 명시적 `cacheExtent`/`scrollCacheExtent`의 기존 동작은 호환 경로에서 유지하며, 새 예산형 동작은 명시적인 공통 정책 옵션으로 제공한다.

- **필수 pass:** 현재 viewport를 실제 크기의 child로 채우고, focus materialization·showOnScreen·편집/선택 geometry 요청을 처리한다. 모든 관련 PipelineOwner의 layout과 anchor/content dimension correction이 정상 수렴할 때까지 진행한다. 시간 예산을 이유로 dirty 작업이나 visible child를 생략하지 않는다.
- **fixed extent:** index→offset으로 목적지의 필요한 range를 직접 찾는다. 먼 seek에서 중간 항목을 만들지 않는다. 선택 horizon 때문에 불필요한 선행 cache 항목을 visible보다 먼저 생성하지 않게 한다.
- **section extent:** 기존 [SectionExtentIndex](Nelyx/src/framework/rendering/section-extent-index.ts)의 실제 측정·prefix·anchor와 환경별 두 configuration을 유지한다. 추정치는 탐색용이며 실제 크기를 대신하지 않는다. 준비가 anchor 앞 prefix를 바꾸면 그 보정은 필수 수렴 작업으로 승격한다.
- **실제 geometry:** `cacheExtent`는 확보한 범위를 반영한다. 목표 범위 전체를 만들지 않았는데 완성된 geometry를 보고하지 않는다. active chain의 순서·연속성·paint/clip/hit/semantics 변환을 유지한다.
- **적용 범위:** 새 정책은 fixed extent와 indexed section부터 연결한다. 일반 SliverList/Grid/varied/prototype/nested/shrink-wrap은 공통 owner 변경의 회귀 대상이다. 지원 조합을 API에 명시하고 미지원 조합에서 조용히 cache 의미를 바꾸지 않는다.

### 3.6 보존과 자원 예산을 View 수준에서 통합한다

| 항목 상태/보존 이유 | 계약 |
|---|---|
| active visible / prepared | 같은 실제 layout chain에서 현재 필요한 항목과 추가 준비 항목을 구분한다. 실제 viewport 밖의 paint/hit/semantics는 기존 clip·노출 규칙을 따른다. |
| explicit keep-alive | 기존 AutomaticKeepAlive·편집·선택 등의 요청. 선택 cache LRU로 해제하지 않는다. 요청 해제는 현재 경로를 따른다. |
| optional nearby | 같은 논리 항목의 최근 이탈 subtree를 bounded 정책으로 보존한다. 실제 mounted State 수명 연장임을 공개 계약에 밝힌다. |
| removed | 보존 이유가 없으면 정상 remove/deactivate/finalize를 수행한다. 해제된 것처럼 회계만 줄이지 않는다. |

- render bucket을 재사용하되 explicit 이유를 optional boolean으로 덮어쓰지 않는다. 항목 표와 실제 bucket/parentData 사이의 상태 전이는 한 owner에서 검증한다.
- View별 선택 예산을 두 열과 모든 등록 sliver가 공유한다. 순회마다 전체 subtree를 다시 세지 않도록 mount/unmount/retake의 실제 변화에 카운터를 연결하고 close 때 정합성을 확인한다.
- 초기 실험값은 sliver당 선택 보존 8개, View당 prepared+optional 16개, 선택 subtree Element 합계 2,048개다. **후보 구현의 CPU 회귀에서 확인했으며 native 정책 수락은 아직 별도다.** 필수 사용량·측정 비용과 함께 평가하고 기존 256-owned-render-child와 paragraph/native admission은 계속 필수 제한이다.
- 알 수 없는 사용자 builder의 다음 생성량·JS heap peak를 이 개수만으로 보장하지 않는다. 선택 작업 전 추정/남은 capacity를 확인하고 실제 완료 비용·원자 작업 초과를 계상한다. 안전하게 준비할 수 없는 항목은 필수 수요가 올 때 기존 경로로 생성한다.
- 압박 시 선택 보존부터 정상 제거한다. producer를 놓아도 in-flight lease가 남으면 resident 비용은 유지한다. 필수 visible/editor·GPU lease를 강제로 퇴거해 admission 성공을 만들지 않는다.
- focus·IME composing·선택·gesture·overlay anchor와 외부 listener/ticker의 의미를 보존한다. 임의의 State 자동 pause/resume은 도입하지 않는다. 선택 보존은 해당 추가 수명과 동작을 허용한 소비자에만 적용한다.
- GlobalKey의 같은 프레임 retake·중복 검사를 유지한다. 여러 tick에 걸친 퇴거는 각 tick까지 **명시적으로 보존한 항목**을 하나씩 제거하는 방식이다. 일반 inactive 집합에 넣고 `finalizeTree`를 미루지 않는다.

### 3.7 root가 필수 작업과 선택 작업을 조정한다

현재 [FrameTiming](Nelyx/src/foundation/clock.ts)은 `tick/dispatch/queueDelay/clockUncertainty`와 host가 실제 광고한 경우의 선택적 `observedDeadline`을 전달한다. 현재 Windows clock은 deadline을 광고하지 않는다. [Windows clock 검사](Nelyx/eng/tests/react-native-frame-clock.test.mjs)는 관측하지 않은 deadline을 만들지 않는 계약을 검사한다. 이 계약과 기존 한 개의 host frame loop를 유지한다.

1. runtime은 기존 순서대로 입력을 dispatch하고 dirty root를 build한다. 각 root는 같은 ViewWorkBudget을 사용한다. 두 열 중 먼저 layout된 sliver가 다른 열의 필수 시간을 선택 작업에 소비하지 못하게 한다.
2. root/PipelineOwner의 **전체 필수 layout 수렴 뒤** 선택 후보 하나를 고른다. 허용된 layout callback을 수행할 대상에만 선택 요청을 부여하고 제한된 추가 layout pass로 실제 child build/layout을 수행한다. 수행 중 생긴 필수 dirty/correction은 정상 수렴시키고 선택 작업은 더 시작하지 않는다.
3. 해당 pass도 실제 attached owner·layout callback 권한·isolated BuildScope를 따른다. 일반 post-frame callback이나 임의의 runtime hook에서 직접 `createChild`/`performLayout`을 호출하지 않는다.
4. 새 준비 기능은 신뢰할 수 있는 host timing capability가 있을 때만 자동 실행한다. 실제 deadline/refresh를 확보할 수 있으면 기존 [CompositorFrameClock](Nelyx/skia/packages/rn/native/windows/CompositorFrameClock.h)·SDK protocol/capability·package cohort를 함께 확장한다. tick+16.67ms나 과거 평균을 관측된 deadline으로 표현하지 않는다.
5. capability가 없으면 **자동 준비만 비활성화**한다. child store·cold 단가·text·필수 layout·bounded 보존은 독립적으로 동작하고 수락 가능해야 한다. native protocol 확장을 엔진 개편 전체의 선행 조건으로 두지 않는다.
6. 초기 선택 allowance는 View당 한 tick에 최대 1항목/2ms이며 paint·semantics·finalize·frame freeze/lease/submit의 여유를 별도로 남긴다. 초기 4ms는 실험 시작 reserve이고 후속 phase의 실제 비용으로 W16-01에서 확정한다. 단조 `clock.now()`로 모든 경과 시간을 재고 queueDelay/uncertainty도 고려한다.
7. 원자 build/layout/dispose는 2ms에서 선점할 수 없다. 이전 비용·후보 적합성으로 시작을 제한하고 초과를 그대로 기록한다. 하나의 거대한 subtree는 일반 엔진 최적화와 §3.8의 명시적 lazy 경계로 줄인다.
8. 입력 backlog·native busy·hidden/closing·generation/방향/data revision 변경에서는 후보를 취소한다. 무효화 토큰에 View owner, viewport/renderer, delegate/metric revision을 포함한다. 유한 후보가 있을 때만 기존 host에 다음 tick을 요청한다.
9. 기존 root의 paint/semantics·input geometry commit/discard·`finalizeTree`·scheduler endFrame과 runtime의 frame resource acquire/submit 순서를 보존한다. 준비 때문에 늦어진 후속 입력·표시·퇴거·close 비용도 총비용에 포함한다.

### 3.8 큰 section의 lazy 경계를 공통 delegate로 제공한다

엔진이 임의의 `Column`·Form·Wrap 내부를 자동 분할하면 Widget 생명주기와 layout 의미를 보존하기 어렵다. **소비자가 독립 경계를 선언하고 엔진이 lazy identity/index/extent를 관리하는 방식**을 채택한다.

- 기존 [SliverChildDelegate](Nelyx/src/framework/widgets/scroll-delegate.ts)·[ListView.custom / CustomScrollView](Nelyx/src/framework/widgets/scroll-view.ts)를 재사용하고 grouped delegate를 추가한다. 논리 section key, 독립 child key/count/builder, key→현재 index와 section→첫 child 탐색을 제공한다. group 메타데이터를 실제 Widget 조상이나 공유 Form owner처럼 취급하지 않는다.
- 엔진이 namespace된 key equality·flat index·anchor remap을 담당한다. 문자열 단순 연결로 key 충돌을 만들지 않는다. 펼친 section list의 현재 count 제한 4,096과 index configuration 제한은 유지한다.
- descriptor만 펼치고 Widget/Element는 필요한 때 생성한다. builder 교체·삽입/삭제/재정렬·section 이동·환경 변경에서 item identity와 측정 revision을 관리한다. 화면 밖 모든 child를 미리 build하지 않는다.
- 엔진에는 Material/Cupertino class나 demo ID를 넣지 않는다. header·간격·배경·모서리·block decoration은 소비자가 기존 Widget으로 표현하고 semantics 순서·group metadata 연결은 공통 계약으로 제공한다.
- Form·editor·focus scope·같은 Wrap/Flow의 한 layout 묶음은 원자 단위로 유지한다. 더 쪼갤 수 없는 항목의 cold 비용은 엔진 단가 개선 대상으로 남긴다.
- 공개 API를 일반 목적 fixture 두 개 이상에서 검증한 뒤 gallery가 사용한다. 두 gallery의 controller/values, editor의 GlobalKey/keep-alive, primary scroll owner·selection/composing/undo와 기존 category/filter/두 열 동작을 보존한다.

### 3.9 입력·renderer 경계

- [native precision](Nelyx/skia/packages/rn/native/windows/WindowsPrecisionTrackpad.h) → [SkiaView](Nelyx/skia/packages/rn/native/windows/SkiaView.h) → [SDK input](Nelyx/sdk/src/backends/react-native/input.ts) → runtime의 수신·dispatch·offset·frame을 연결한다. 기존 `windowsMonotonicTimestamp` 보정과 uncertainty를 재사용한다.
- 기존 mailbox의 순서·256개 상한·key/focus/metrics 전 flush를 보존한다. frame이 반영한 native sequence/timestamp 구간의 oldest/latest를 추적한다. runtime inputSequence와 native sequence를 혼동하지 않는다.
- 엔진 개편 후에도 dispatch/backlog가 지배적일 때만 동일 target·View/generation·pointer/device·phase 안의 병합을 검토한다. nested scroll·방향 반전·velocity 표본·start/end/cancel·관성 의미를 보존한다.
- 기존 retained layer·recording·scene import·native lease/fence 경로는 재사용한다. attribution에서 남는 비용이 확인된 owner만 후속 수정한다. surface 완료·실제 표시·물리 scanout의 증거를 구분한다.

## 4. 엔진 우선 실행 순서와 전환 기준

이전 단계별 구현 상태는 **§8.1**, 재개 순서는 **§8.2**, 현재 실행은 **§8.3**에 기록한다. 실행 순서는 **Hermes bytecode 기준선 → Static Hermes 동일 부하 기준선·native attribution → 공통 엔진 변경 → 두 모드의 샘플 변경 없는 엔진 수락 → 공통 API의 샘플 소비 → 두 모드의 최종 공급/성능·물리 수락**이다.

| ID | 선행 | 작업 | 종료 조건 |
|---|---|---|---|
| **W16-00 기준선·소유권 감사** | 시작 | 현재 dirty·source/dist/archive/install/bundle·EXE/HBC/AOT DLL·locator hash를 확인한다. Hermes bytecode와 Static Hermes의 revision·VM/GC·compiler policy와 source→실행 대응을 확인한다. | 두 주 모드의 최신 공급과 비교 장비·창·접근성·입력 조건, 현재 실패/지원 범위 고정. |
| **W16-01 Hermes 2모드 부하·계측** | 00 | 연속 부하 harness에 Hermes bytecode 경로를 추가하고 주 matrix를 bytecode/Static Hermes로 바꾼다. 일반 ListView·기존 gallery의 모드별 baseline, build/layout/text/finalize·할당/GC·입력·자원을 계측한다. | optimized Release 두 경로의 실제 entry/delivery·정상 close 확인. 계측/성능 실행 분리, 공통 비교 조건·모드별 기준선·정책 실험값 확정. |
| **W16-02 엔진 계약·호환 seam** | 01 | 항목 표·layout demand·View 예산·owned snapshot·공개 정책과 grouped delegate 계약을 확정한다. 기존 경로와 내부 신경로를 나란히 비교할 최소 검증 seam을 둔다. | owner·key·순서·예외·옵션·무효화 계약과 지원 조합 확정. 서로 다른 Core identity/중복 tree 없음. |
| **W16-03 child store·국소 구조 변경** | 02 | sliver Element/adaptor의 지속 항목 표와 구조 revision·변경 slot 갱신을 연결한다. 정렬/projection/sibling sync 중복을 줄인다. | 같은 State/Key/attach 순서, 실제 변경량 기반 bookkeeping, remap/retake/실패 cleanup 회귀 통과. cache/prefetch off 검사 통과. |
| **W16-04 framework 생성·갱신 경로** | 03 | Hermes 두 모드의 attribution을 기준으로 반복 field/config/projection·build/attach/sync 비용을 줄인다. 기존 heap/singleton/inherited index의 정확성을 유지한다. | 두 모드 각각 일반 고정 행 cold의 항목당 비용/할당 감소. public getter·dependency·GlobalKey 의미 및 기존 fixture 수명 유지. |
| **W16-05 text snapshot·admission** | 02, 04 | 내부 입력의 snapshot/key/cost/font revision 재사용을 공통 경계에 도입하고 기존 문단 cache/budget에 연결한다. Hermes 두 모드에서 반복 직렬화·할당·native 문단 비용을 구분한다. | 두 모드의 중복 작업·cold/revisit 개선, custom 입력·font/scale·replacement·native drain·압박 회귀 통과. |
| **W16-06 demand 기반 layout** | 03~05 | fixed/section에서 필수 coverage를 먼저 확보하고 실제 cache geometry·anchor/correction을 처리한다. 기존 옵션 호환 경로를 유지한다. | far seek·긴 연속 입력·가변/zero extent·focus·RTL/역방향에서 빈칸/잘못된 geometry 없음. 아직 자동 준비 없이 수락. |
| **W16-07 View 예산·bounded 보존** | 06 | 기존 bucket·자원 회계에 explicit/optional 이유, View 총량·admission·정상 퇴거를 연결한다. | 두 열 합계 상한, 짧은 재방문 동일 subtree 재사용, 압박/IME/GlobalKey·close 수명 회귀 통과. |
| **W16-08 root 선택 pass·입력 잔여** | 06, 07 | 전체 필수 layout 뒤 선택 pass·capability·취소·backpressure를 연결한다. 실제 timing 관측이 가능할 때만 native/SDK protocol을 확장한다. 입력 잔여를 측정해 필요한 최소 수정만 한다. | 준비 off/미지원도 기본 엔진 정상. on의 총비용·초과·hit·취소가 검증됨. mailbox/precision 의미 유지. timing 부재는 기능 제한으로 명시. |
| **W16-09 공통 grouped delegate** | 03, 06, 07 | section/item descriptor·key/index/anchor 대응을 기존 공개 delegate 계열에 구현한다. 일반 목적 fixture에서 mutation·theme/폭·원자 owner 경계를 검증한다. | Material/Cupertino·sample import 없는 공통 API와 공개 package 소비 통과. |
| **W16-10 엔진 선행 수락** | 03~09 | 샘플 소스와 row 구성을 유지한 고정 행·기존 gallery를 Hermes bytecode와 Static Hermes 모두에서 실행한다. 보존/준비 off 및 각 on 조건을 분리한다. | 두 모드 각각 §6 G6 충족. 공통 cold 단가 개선과 기능/수명/공급 근거가 있어야 샘플 전환 착수. |
| **W16-11 샘플의 공통 API 소비** | 10 | 두 gallery의 큰 section을 독립 lazy child로 선언하고 공개 grouped delegate/정책만 사용한다. decoration·필터/열·anchor·editor를 유지한다. | gallery 전용 scheduler/cache/index map 중복 없음. 같은 기능/화면/State 유지. 수정 전후 효과를 엔진 효과와 분리 보고. |
| **W16-12 최종 공급·타 경로 회귀** | 11 | Core/SDK/runner의 현재 package 공급과 installed identity, Hermes HBC/compiler policy 및 Static Hermes coverage/type policy/audit를 확인한다. V8/Web/JSC 두 모드는 호환성 smoke로 검사한다. | Hermes 두 실제 앱의 source→실행 일치, responsive 창·cooperative exit 0·정상 drain. 기존 공개 엔진 선택 계약 유지. |
| **W16-13 Hermes 2모드 성능·물리 수락** | 12 | §5/6의 모드별 동일 조건 전후 비교와 각 실제 앱의 precision 접촉/관성·표시를 확인한다. | 두 모드별 각 gate 개별 판정. 미관측 물리/표시는 notVerified이며 전체 해결 완료로 표기하지 않음. |
| **W16-14 전환 마무리·정리** | 13 | 수락한 공통 경로를 남기고 개발용 이중 구현·계측 seam 중 불필요한 것을 제거한다. 기존 한/영 README와 이 문서 상태를 갱신한다. | 공개 API·fallback/지원 범위·실행법·미달 사유가 명확하고 이전 산출물/기록 누적 없음. |

**전환 원칙:** framework 내부의 관찰 가능한 동작을 보존하는 단가 개선은 기존 ListView 소비자에도 적용한다. State 수명을 늘리는 보존과 cache 의미를 바꾸는 예산형 정책은 명시적 선택으로 도입한다. 개발 중 old/new 경로 비교는 수락을 위한 임시 수단이며 두 엔진을 영구 복제하지 않는다. 새 경로가 gate를 통과하지 못하면 마지막으로 수락한 경로를 유지하고 해당 실패·다음 수정점을 이 문서에 남긴다.


## 5. 검증 부하와 측정 방법

### 5.1 반드시 함께 유지할 부하

| 부하 | 입력·범위 | 필수 확인 |
|---|---|---|
| retained 왕복 | 기존 loaded 작은 왕복 | mount/unmount=0인 기존 warm 비용이 악화되지 않는지 확인. 다른 부하와 별도 분포. |
| 고정 80px / 1,000행 | 최소 5 viewport 전진→방향 반전→같은 범위 재방문. 목적지 seek도 별도 수행 | cold에서 실제 새 row 노출·mount가 발생해야 함. 보존 도입 뒤 revisit mount=0은 정상일 수 있으며 identity hit·최종 퇴거로 대체 확인. 1,000행 전체를 보존하지 않음. |
| Material 전체 gallery | 실제 전체 카탈로그의 큰 section·editor 전후를 통과. narrow와 최대화의 실제 열 구성 | 모든 block/section의 최초 노출·퇴장·재방문이 포함됨. 예정 component를 구현 완료로 바꾸지 않음. |
| Cupertino 전체 gallery | 실제 전체 카탈로그와 editor를 같은 방식으로 이동 | 분할 후 control 동작·theme·상태·editor binding·semantics 순서 유지. |
| 환경·상태 변경 | 폭/DPI·theme/font/text scale/locale/RTL·필터·열 변경·keyed mutation·먼 focus 요청 | anchor·실제 크기·caret/composing·selection·재준비 취소와 generation 일치. |
| 수명·압박 | cache 포화·자원 admission 경계·hidden/resume·prepare 중 route pop/close·실패 | 선택 cache가 먼저 줄고 owner/lease 누락·stale callback·강제 정상 처리 없음. |

각 연속 스트림에는 작은 delta·보통 이동·빠른 이동·burst를 넣는다. 보통 속도의 초기 기준은 약 **1 viewport/초**, 빠른 이동은 **3 viewport/초**로 두고 native 수신 거리/시간으로 실제 속도를 보고한다. 고정 행 경계 반복을 확인하는 80px/update 진단도 별도로 둔다. 입력 중 frame마다 `delay/drain/seek`를 넣지 않고 스트림 종료 뒤에만 완료·수신·offset을 검증한다.

4ms 간격은 stress 조건이다. 실제 native 수신 packet·절대/부호 누적 delta·순서가 확인된 표본만 성능 비교에 사용한다. 주입 호출 수와 OS 수신 이벤트 수는 따로 기록한다. 이벤트가 합쳐져도 전체 이동량·방향 반전과 emitted native sequence의 연속성이 보존돼야 한다. 손실된 입력 때문에 빨라진 실행은 delivery 실패로 별도 보고하고 성공 표본으로 세지 않는다. 주기적 jank를 좋은 값만 골라 제외하지 않는다.

### 5.2 frame별 attribution과 지표

- **수명:** row/block ID, 필요한/준비한/보존한 항목 수, subtree Element mount/unmount, active/pinned/optional 수, 실제 cache 퇴거·prepare hit/miss/cancel.
- **Core CPU:** input dispatch, 일반 build, layout 안 lazy build, child bookkeeping, text key/snapshot/native layout, viewport correction 횟수, paint/compose, finalize/dispose. 겹치는 span과 self time을 구분한다.
- **분포:** 최초 노출, 새 subtree mount, unmount, text miss, nearby 재방문, 보존 범위 밖 재방문, 완전 retained를 분리해 p50/p95/p99/max와 표본 수를 낸다. 작은 표본의 p99가 max에 가까운 점도 표시한다.
- **입력:** native received→JS dispatch→offset applied→matching surface까지 oldest/latest age, queue depth/high-water, 수신/dispatch/반영량. 마지막 packet의 지연만 대표값으로 사용하지 않는다.
- **표시:** surface 완료와 compositor/display 관측을 구분한다. matching frame/owner/generation에 대한 실제 표시 간격·missed refresh·50/100ms 정지·연속 jank를 구한다. 기존 `displayed=unobserved`를 표시 성공으로 해석하지 않는다.
- **자원:** registry의 logical producer/resident/in-flight, 문단 cache·recording 수와 charge, JS heap/GC 가능 범위, native process working set/private bytes, close 뒤 미반환 owner. 직렬화 input bytes를 실제 GPU/총 heap byte로 표기하지 않는다.
- **Hermes 공통 VM:** bytecode/Static Hermes 각각의 phase별 allocation·GC 횟수/시간·heap/live 수치를 제공 가능한 범위에서 확인한다. 누적 allocation과 resident/live memory를 구분하고 미제공 수치는 `notVerified`로 둔다. AOT native 함수/PC·typed/dynamic-native 분류와 bytecode compiler policy는 각 입력 identity에 연결한다. AOT 준비/컴파일 시간·peak memory는 runtime frame 비용과 별도 기록한다.

### 5.3 실행 수와 증거 등급

- 정규 성능 비교의 기본 단위는 전후 각각 **Hermes bytecode/Static Hermes × 기본/최대화 × 3회 = 12회**, 전후 합계 **24회 native 실행**이다. 두 모드의 표본과 gate를 각각 계산한다. 한 실행에 세 화면의 구간별 측정을 포함하되 시나리오 사이 상태를 정리하고 cold는 해당 subtree의 첫 방문으로 정의한다. OS/file cache cold와 혼동하지 않는다.
- W16-10은 두 모드에서 일반 행·기존 gallery·보존/준비 off의 엔진 선행 수락을 먼저 확인한다. 최종 앱/API 소비 수락과 결과를 분리하고, 소규모 수정마다 전체 24회를 반복하지 않는다. 동일 source·공급·부하·정책이 유지된 표본만 재사용하며 gallery/정책 변경 전후를 같은 후보로 합치지 않는다. 상세 계측·물리 조작과 V8/JSC/Web smoke는 필요한 소수만 별도로 수행한다.
- 비교용 baseline은 다음 구조 변경 전에 같은 신규 부하로 Hermes bytecode부터, 이어 Static Hermes에서 확보한다. 현재 중간 공급을 baseline으로 삼으면 기존 변경분의 개선율은 주장하지 않는다. 상세 attribution은 별도 소수 실행으로 확보하고 계측 on/off 비용을 확인한다. timing 판정에는 계측 조건이 맞는 전후 표본을 사용하며 측정 순서를 교대해 엔진 실행 순서의 영향을 줄인다.
- 각 실행은 20분 timeout을 적용한다. 반복 실패를 수백 회 돌리지 않는다. 실패 원인과 입력 조건을 수정한 뒤 필요한 표본만 다시 실행한다. 빌더·다른 엔진 실행을 종료한 상태에서 측정한다.
- Core fixture는 알고리즘/수명 회귀, Hermes 두 native fixture는 RNW·VM/GC·입력·surface 성능, 각 installed 앱은 공급·실제 화면/기능 증거다. 마지막으로 두 모드 각각 실제 precision trackpad 접촉·손을 뗀 관성·재접촉·방향 반전·wheel fallback과 표시를 확인한다.
- 표시 관측은 현재 host의 ETW/표시 추적·화면 관측으로 가능한 범위를 먼저 확인한다. application present 호출만 얻으면 surface 수준으로 남긴다. 입력과 화면의 직접 대응을 확보하지 못하면 input-to-display는 `notVerified`다. compositor 관측도 물리 scanout/광학 지연 측정으로 확대하지 않는다.

### 5.4 기존 검사와 실행 경로

수정 owner에 맞춰 다음 기존 회귀를 확장한다. 공통 검사는 `scroll-entry.test.mjs`/`grouped-delegate.test.mjs`/`bounded-sliver.test.mjs`/`optional-sliver-work.test.mjs`, 설치 소비 검사는 `check-scroll-supply.mjs`, native 연속 부하는 `run-windows-scroll.mjs`다.

**현재 도구:** `run-windows-scroll.mjs`는 `hermes|static-aot|v8|matrix`를 지원하며 `matrix`는 optimized Release Hermes bytecode+Static Hermes다. V8은 명시적 호환성 실행이다. 두 주 모드의 locator·compiler policy·실행 mode와 공급 identity, 실제 입력·close/drain을 검사한다. 계측·PC 진단은 정규 성능 실행 뒤 별도로 수행한다. 구현 전 V8+Static AOT `matrix` 기록은 새 주 matrix 수락으로 세지 않는다.

| 범위 | 기존 검사/도구 |
|---|---|
| keyed/GlobalKey·child 수명·extent | [framework-reconciliation.test.mjs](Nelyx/eng/tests/framework-reconciliation.test.mjs), [section-list.test.mjs](Nelyx/eng/tests/section-list.test.mjs), [inherited-lookup.test.mjs](Nelyx/eng/tests/inherited-lookup.test.mjs), [final-fields.test.mjs](Nelyx/eng/tests/final-fields.test.mjs) |
| 문단 cache·admission·retirement | [text-layout-cache.test.mjs](Nelyx/eng/tests/text-layout-cache.test.mjs), [text-layout-budget.test.mjs](Nelyx/eng/tests/text-layout-budget.test.mjs), [paragraph-lifetime.test.mjs](Nelyx/eng/tests/paragraph-lifetime.test.mjs) |
| frame/입력·backpressure | [frame-backpressure.test.mjs](Nelyx/eng/tests/frame-backpressure.test.mjs), [react-native-frame-clock.test.mjs](Nelyx/eng/tests/react-native-frame-clock.test.mjs), [windows-frame-clock.test.mjs](Nelyx/eng/tests/windows-frame-clock.test.mjs), [windows-animation.test.mjs](Nelyx/eng/tests/windows-animation.test.mjs), [windows-precision.test.mjs](Nelyx/eng/tests/windows-precision.test.mjs) |
| native workload와 성능 판정 | [windows-animation.tsx](Nelyx/eng/tests/windows-animation.tsx), [run-windows-research.mjs](Nelyx/eng/tests/run-windows-research.mjs), [windows-research-results.mjs](Nelyx/eng/tests/windows-research-results.mjs) |
| 실제 gallery·editor·control | [gallery.test.mjs](sample/nelyx-testbed-app-2/tests/gallery.test.mjs)와 현재 installed 앱의 pointer/keyboard/IME 조작 |

다음은 현재 지원되는 검사 명령이다. Hermes bytecode와 새 주 matrix 연결은 §8.3에서 구현했다. 실제 실행 범위·성공 수·미검증 범위는 실행 상태에 구분한다.

```powershell
npm run test:scroll-engine
node Nelyx/eng/tests/check-scroll-supply.mjs
node Nelyx/eng/tests/run-windows-scroll.mjs hermes 1
node Nelyx/eng/tests/run-windows-scroll.mjs static-aot 1
# 두 모드 × 두 창 × 3회. 한 공급의 기준선 또는 후보 12회다.
node Nelyx/eng/tests/run-windows-scroll.mjs matrix 3
node --test --test-timeout=1200000 Nelyx/eng/tests/framework-reconciliation.test.mjs Nelyx/eng/tests/section-list.test.mjs Nelyx/eng/tests/inherited-lookup.test.mjs
node --test --test-timeout=1200000 Nelyx/eng/tests/text-layout-cache.test.mjs Nelyx/eng/tests/text-layout-budget.test.mjs Nelyx/eng/tests/paragraph-lifetime.test.mjs Nelyx/eng/tests/frame-backpressure.test.mjs
node --test --test-timeout=1200000 sample/nelyx-testbed-app-2/tests/gallery.test.mjs
```

build/typecheck/prepare/native 실행도 각 child process에 1,200,000ms timeout을 거는 bounded wrapper로 수행한다. Core dist를 먼저 갱신하고 필요한 SDK·package·runner 공급을 갱신한 뒤 검사한다. 실제 Hermes bytecode 앱은 기존 `build:windows:hermes`/`start:windows:hermes`, Static Hermes 앱은 저장소 루트의 기존 `sample/nelyx-testbed-app-2/start-windows-static-aot.ps1` 경로를 사용한다(SDK/공급 변경 시 `-RefreshSdk`). 두 모드의 최종 실행 hash와 선택 mode/profile을 확인한다. 기존 research 명령은 현재의 warm/seek 부하만으로 W16 수락을 대신할 수 없다.

## 6. 수락 기준과 실패 처리

아래는 **Hermes bytecode·Static Hermes 각각에 적용할 목표값**이다. W16-01에서 장비 refresh·논리 viewport·입력 수신 조건과 정책 상한을 문서에 고정한 뒤 모드별 전후 평가한다. 측정 실패를 통과시키려고 사후 임계값을 높이지 않는다. 초기 주 수락 등급은 **60Hz**이며 120Hz는 별도 등급이다. `B=1000/측정 refreshHz` ms다.

| Gate | 통과 조건 |
|---|---|
| **G0 부하·공급 유효성** | 두 Hermes 모드 각각 최신 공급·VM/compiler policy·실행 mode identity, 실제 수신량/거리, 여러 viewport 이동, cold의 신규 mount와 실제 새 항목 노출이 확인된다. 조건이 다른 실행은 비교 불가이며 성능 PASS가 아니다. |
| **G1 정확성·상태·수명** | visible 누락/빈칸/중복 hit·잘못된 anchor가 없다. key/State·editor/IME/selection·Form/route·theme/scale/locale·accessibility 회귀가 통과한다. 정상 close/drain과 실패 경로의 원인 보존을 확인한다. |
| **G2 작업량·자원** | 짧은 재방문에서 보존 hit에 대응하는 subtree 재생성이 줄고, cold block의 원자 비용도 줄어든다. 선택 보존/준비 상한과 기존 전체 자원 상한을 지킨다. 같은 범위를 3회 왕복한 뒤 live owner/producer가 계속 증가하지 않는다. 전체 방문량에 비례하는 keep-alive/heap 증가가 없다. |
| **G3 CPU·입력 개선** | **Hermes bytecode와 Static Hermes 각각**, 세 화면의 cold 연속 진입과 보존 범위 밖 revisit frame CPU p95가 **동일 모드 신규 baseline 대비 50% 이상 감소**한다. 동시에 연속 부하의 CPU p95≤0.75B, p99≤B, max<50ms, oldest-input→surface p95≤2B/max<50ms를 만족한다. 각 모드의 retained p95·입력 지연은 전후 중앙값 기준 10% 넘게 악화되지 않는다. 모드 간 속도 비교나 단일 개선 지표로 다른 실패를 상쇄하지 않는다. |
| **G4 실제 표시·precision** | 실제 precision 경로·contact/ballistic/cancel의 거리·방향·최종 offset이 맞는다. 지속 이동 중 표시 간격 p95≤1.25B/p99≤2B, 50ms 이상 새 화면 정지 0회, 1.5B 초과 간격의 연속 3회 발생 0회를 목표로 한다. frame에 직접 대응된 oldest-input→display p95≤3B/max<100ms를 요구한다. 관측할 수 없는 항목은 `notVerified`다. |
| **G5 메모리·공급·타 엔진 회귀** | Hermes 두 앱의 자원 계수가 상한 안에서 plateau를 이루고 close 후 drain된다. 모드별 메모리·할당/GC와 보존 hit 이득을 보고한다. bytecode HBC/compiler policy와 Static Hermes coverage/type policy/audit를 유지한다. 같은 소스의 V8·Web·JSC jit/interpreter에서 기능·State/IME·자원 수명 smoke를 통과한다. 이들은 주 성능 matrix 대상에서 제외하고 관찰된 회귀만 추가 조사한다. |
| **G6 엔진 선행 수락 / W16-10** | sample/행 Widget 구성과 문단 cache 상한을 유지하고 보존·자동 준비를 끈 동일 조건에서, **두 Hermes 모드 각각** 일반 ListView의 cold frame CPU p95와 항목당 생성/build/layout 비용이 **동일 모드 신규 baseline 대비 각각 20% 이상 감소**한다. 각 모드의 기존 gallery 기능·수명과 retained/entry CPU p95 10% 회귀 기준도 통과한다. 공통 grouped delegate는 gallery import 없는 공개 소비 fixture에서 검증한다. 두 모드의 source→설치 identity와 off/on 분리 근거가 있어야 샘플 전환을 시작한다. |

60Hz에서 G3 CPU 기준은 p95≤12.5ms/p99≤16.67ms다. 120Hz 수락은 같은 식의 p95≤6.25ms/p99≤8.33ms와 G4를 별도로 충족해야 한다. 120Hz 표시를 관측하지 않고 해당 등급을 주장하지 않는다. 여러 frame을 합친 평균 FPS가 높아도 entry spike·최장 정지 gate 실패는 그대로 실패다.

성능 전후 표에는 엔진·mode/profile·창·화면·속도·cold/retained/revisit·정책·표본 수·CPU/입력/표시·자원·정확성 판정을 함께 쓴다. Hermes bytecode와 Static Hermes의 `engineAccepted`/`performanceAccepted`/`physicalInputAccepted`를 따로 기록하고, 둘 다 충족해야 W16 전체 해당 항목을 수락한다. 엔진 단독 효과와 이후 sample/API 소비 효과를 구분한다. G6는 샘플 전환을 허용하는 중간 gate이며 최종 G3/G4를 대신하지 않는다. CPU/자동화 PASS와 실제 표시·물리 수락을 별도 열로 남긴다. 구현을 끝내고 성능이 미달하면 `구현 COMPLETE / performanceAccepted=false`로 기록할 수 있지만 사용자 스크롤 문제의 해결은 `PARTIAL`이다. 물리 입력·표시가 미검증인 상태에서 최종 수락을 완료하지 않는다.

## 7. 설계상 한계와 변경 범위 통제

| 항목 | 원칙 |
|---|---|
| 거대한 단일 Widget build/layout | 동기 사용자 코드를 임의로 선점하거나 자동 분할할 수 없다. 엔진 단가와 명시적 공통 lazy 경계를 개선하고 남는 spike는 실패로 기록한다. |
| 전체 항목 보존 / cache 숫자 확대 | cold 단가·메모리·종료 비용을 해결하지 못한다. 선택 예산과 전체 자원 admission을 유지한다. |
| 무제한 post-frame·timer·worker tree 생성 | 같은 JS thread/owner 의미와 실제 입력 지연을 함께 검증해야 한다. canonical build/layout owner에서 작은 단위로만 작업한다. |
| GlobalKey/State/dispose 순서 | 구조 변경을 묶어도 관찰 가능한 순서는 보존한다. rollback 가능한 내부 메타데이터와 사용자 side effect를 구분한다. |
| snapshot 최적화 | 내부 소유 identity에 한정하고 외부 mutable·Proxy·getter·toJSON의 기존 경로를 유지한다. field 보호/검증을 일괄 제거하지 않는다. |
| deadline 부재 | 기존 timing을 재사용하며 관측값을 꾸미지 않는다. 자동 준비 제한이 기본 엔진 cold 개선의 미구현 사유가 될 수 없다. |
| semantics·IME·native lease/fence | 성능 수치를 위해 비활성화하거나 admission을 우회하지 않는다. 같은 설정 전후 비교와 accessibility enabled 회귀를 수행한다. |
| renderer/native 전체 교체 | 현재 증거는 Core 진입 비용을 우선 가리킨다. 남는 병목의 실제 attribution이 확인된 owner를 단계적으로 수정한다. |
| backend·컴포넌트 확장 | Hermes bytecode/Static Hermes의 최적화를 우선하고 V8/JSC 계약과 AOT 수락 경계를 유지한다. W14 신규 component family·compiler 타입 특화 확대는 별도 계획이다. |

## 8. 기록·정리와 다음 시작점

- 현재 계획·짧은 진행 상태·잔여는 이 문서에, 제품 사용법은 기존 README에 반영한다. [저장소 지침](.github/copilot-instructions.md)에 따라 `Nelyx/docs/plans/`와 `Nelyx/docs/migrations/`를 만들거나 복구하지 않는다.
- 검증 임시 파일은 한 실행에 필요한 것만 사용하고 성공·실패·중단 모두 `finally`에서 정리한다. 현재 dist/package/설치본과 재사용 toolchain을 유지하고 이전 dist/staging/SDK 사본·archive·독립 소비자 설치본·browser profile·검증 log·immutable receipt·checkpoint/history JSON은 누적하지 않는다.
- 전후 비교 후보는 한 bounded 실행이 소유한 최소 범위만 잠시 유지하고 종료 시 삭제한다. 전체 SDK/cache/package를 매번 복제하지 않는다. 이 문서에는 입력 hash와 짧은 수치·판정·미검증 사유만 남긴다.
- **현재 다음 작업은 §8.4를 따른다.** 공통 cold 경로의 할당·레이아웃 구조를 먼저 개선한다. native 반복은 중단했으며 G6를 두 모드 모두 수락한 뒤 gallery를 grouped API로 전환한다.

| 현재 상태 | 값 |
|---|---|
| 공통 엔진 개편 설계 검토·계획 개정 | COMPLETE |
| 2026-10-24 주 대상·matrix 개정 | COMPLETE / Hermes bytecode·Static Hermes 공동 주 대상. 후속 전체 구현 요청으로 §8.3 실행 재개 |
| 이전 W16 실행 순서·Static AOT/V8 주 matrix | CLOSED / SUPERSEDED BY 본 Hermes 2모드 엔진 개편안 |
| W16-00~14 구현 | IN_PROGRESS / PARTIAL / §8.3의 두 모드 기준선·계측부터 재개. 이전 제품 구현 범위는 §8.1 참조 |
| 제품 코드·검사/실행 스크립트 변경 | 기존 sliver/ParentData/text/grouped·Focus·semantics 개선 + 지연 생성하는 0/1/N child store, layout closure 제거, Flex의 pass 단위 측정·배치 배열 |
| 기존 실행 확인 (2026-10-23) | Core build, 전체 workspace 타입 검사, 회귀 112 PASS / 1 profiling SKIP, 당시 설치 Core 소비 4 PASS. 추가 계약 검사 16 PASS. native 후보 4회 입력·종료 qualification PASS |
| 기존 runtime/성능/물리 입력 검증 | §8.1의 V8/Static AOT 기록. G3 성능 목표 미달 / G6 정규 전후 비교·물리 입력 미수락 |
| 새 주 matrix 상태 | PARTIAL / baseline 12회·첫 후보 12회 확보(G6 미달). 후속 B 후보는 실제 viewport 불일치로 정규 비교 불가, 별도 정책 진단은 두 모드 입력 거리 실패. 반복 측정 중단, C 공통 구조 개선 진행. bytecode AV 미해결 |
| `engineAccepted` / `performanceAccepted` / `physicalInputAccepted` | notVerified / false / notVerified |
| 사용자 스크롤 문제 해결 | PARTIAL / 전체 해결 완료 아님 |

### 8.1 구현 중간 마무리 기록 (2026-10-23 KST)

이 절의 수치·hash·프로세스 정리는 당시 실행 기록이다. 2026-10-24 계획 개정 때에는 문서만 수정했으며 이 절을 현재 공급의 재검증이나 Hermes 두 모드의 신규 수락으로 확대하지 않는다. 이후 실행 순서는 §8.2, 신규 실행은 §8.3을 적용한다.

- 시작 HEAD `af62645ac8618a0d6ead40d0d361d200a0b151de`, 시작 tracked/untracked dirty 없음. W16 입력 SHA-256 `a4a6082de9f2b61afe6048d87694f2643d43314faa1ece8d52ed2cc5f187f6c7`, research 입력 hash는 §1.1과 일치한다. 이전 계획의 기준 HEAD와 현재 구현 시작 HEAD를 구분한다.
- 시작 시 Core dist 및 Windows runner 설치 sliver JS SHA-256 모두 `9f98cc4e1d4b6b24e72d829661018cc8961031ce3e563ef8e8faa5813c91bc9f`. 현재 두 공급본은 `735a03bdf95d33e109c0da834030f66f80d52f95e83432f0652f96aeb29e8cc8`로 일치한다. native input locator payload는 `cf218f5831ffa57be820cbada5f32d99c6612c3ee62f21a0c63e032039ca8efd`(1,795 files / 224,976,281 bytes), Static Hermes supplier manifest는 `aaa154e0612813270addf73c6d5fb3aa7440f300666063f27751baab9ee44b6f`다. 공개 Release 및 타 엔진의 전체 공급 수락은 아직 미완료다.
- 기존 Core 정확성/수명 회귀 61/61 PASS (20분 test timeout). 이번 실행 전부터 남아 있던 ignored `nelyx-animation-32204.tsx`/`nelyx-animation-main-32204.tsx`는 별도 작업으로 보존한다. 해당 PID의 측정/빌더는 실행 중이지 않았다.
- 기존 V8 locator의 공급 디렉터리가 존재하지 않아 첫 native fixture 준비가 ENOENT로 실패했다. CLI의 기존 `prepare --engine v8` 경로로 현재 app 소유 supplier로 재생성했고 inventory 검증을 통과했다(supplier manifest `c1aa0af13d67a33c0cdf56579ca085c9d6a62a1c450578ea9c5f7e079b3f20d1`). 실패를 성능 표본으로 세지 않는다.
- 새 `node Nelyx/eng/tests/run-windows-scroll.mjs v8|static-aot|matrix [1..3]`는 현재 엔진 공급을 이용하고 실행 소유 fixture만 `finally`에서 삭제한다. 최초 1회는 부하 qualification이며 최종 matrix 수락을 대신하지 않는다.
- 수정 전 설치 Core를 고정해 V8 기본/최대화 각 1회 qualification을 통과했다. 이후 현재 Core를 build/pack/install했고 6개 변경 owner의 dist/설치 JS hash 일치를 확인했다. **공개 Release EXE는 아직 갱신/수락하지 않았다.** 기본/최대화 actual logical viewport는 487×464.5 / 1280×729.5, scale 2, AMD Radeon 780M 경로다. OS는 이 adapter의 2560×1600/165Hz를 보고했으나 실제 표시를 관측한 것은 아니다. G3의 초기 CPU 60Hz 목표와 물리 refresh 수락을 혼동하지 않는다.
- 첫 부하 실행은 기존 접근성 비활성 config에서 fixture의 undefined snapshot 접근으로 실패했다. fixture는 비활성 설정도 처리하며 새 harness는 동일 접근성 enabled/semantics interval 50ms 조건을 사용하고 종료 시 원래 config를 복원한다. 최대화의 끝 경계에서 offset이 바뀌지 않은 입력은 수신/거리 검사에는 포함하고 latency의 offset-changing packet 집합과 분리했다. 실패/중단된 준비와 부하는 수락 표본에 세지 않는다.
- source/row/gallery 구성 및 문단 cache 상한을 바꾸지 않은 Core 후보의 native qualification을 완료했다. 보존·prefetch 기능을 구현한 것으로 표기하지 않는다. G0 전체 부하/G6/최종 G1~G5는 미수락이며, 아래 실제 성능 미달에 따라 `performanceAccepted=false`다. 기본 V8과 기존 엔진 선택 계약을 유지한다.
- 사용자의 “일단 중간 마무리하자” 요청에 따라 추가 구현과 상세 native 계측 빌드를 중단했다. 마지막 진단은 Static AOT 컴파일 중 중단했으므로 native attribution 결과가 없다. 실행 소유 프로세스·임시 디렉터리·생성 entry가 남지 않았고 `app-config.json`은 실행 전 내용으로 복원됐다. 앞서 존재하던 `32204` fixture 두 파일은 보존했다. 기록은 이 문서에만 갱신하며 로그/receipt/archive를 추가하지 않았다.

**공급·회귀 확인.** 최종 Core tarball은 `nelyx-core-0.16.0-dcbb98f328474b21beff276b9ff6f8c5f3c8be7d9c6efb583c49aaf508f0f820.tgz`다. Windows runner의 package/lock과 설치본을 갱신했다. source 623개와 dist 2,492개의 경로별 SHA-256을 설치본과 모두 비교해 일치했다(각 목록 digest `e11d7bfcc0f859549d9c2dae2c312443aaa699677b713ccda5be51510d300278`, `1de43b274372e19e38164cfe0f3f0010dd6d954b98ebbd7233439e09c87c4092`). 기존 공개 Release EXE의 갱신을 의미하지 않는다.

- 전체 Core/gallery 회귀: 113개 중 **112 PASS / 선택 CPU profiling 1 SKIP**. Material 전체 카탈로그의 Node/CanvasKit, key/State·GlobalKey·수명, editor/IME transport·Form, semantics/focus, text cache/자원 압박, frame backpressure를 포함한다. 사람의 실제 IME 입력·표시 수락은 아니다.
- 마지막 sliver snapshot 해제 보완 후 Core를 다시 공급했으며 현재 설치 공개 소비 **4 PASS**, 전체 9개 workspace 타입 검사 PASS다. full 회귀는 이 작은 해제 보완 직전 실행이다.
- 별도 package 경계·모듈 배치·RN/Windows frame clock·JSC 계약·Static AOT 타입 정책 검사 **16 PASS**. JSC 검사는 source/contract 범위이며 JSC 실제 앱 smoke가 아니다.
- 선택 Node/CanvasKit CPU profile도 별도 **1 PASS**로 실행했다. 당시 AOT 빌드와 겹친 intrusive sampling이므로 성능 수락에서 제외한다. ancestor 탐색·paint invalidation·text snapshot 비용은 후속 native attribution의 후보일 뿐 원인 확정이 아니다.

**Native 결과.** `node Nelyx/eng/tests/run-windows-scroll.mjs matrix 1`의 V8/Static AOT × 기본/최대화 **4회 모두 exit 0**, 연속 입력 수신·거리·방향과 `closed views=0 consumers=0 gpuDrained=1 inputRetired=1`을 확인했다. 매 phase의 OS wheel 입력은 연속으로 주입하고 phase 경계에서만 drain한다. retained(신규 mount 0), cold, revisit, 4ms fast와 gallery 각 열을 구분했다. cold list는 1,000×80 항목 중 최소 5 viewport 이동이다. gallery 전체 카탈로그의 최초 노출 및 물리 precision 입력을 수락한 것은 아니다.

아래는 **각 조건 1회**의 대표값(ms)이다. CPU는 `Frame.cpu`, entry는 신규 mount가 있었던 frame 집합이며 표본 집합이 다르다. surface latency는 offset이 바뀐 입력을 대응 native surface 완료에 연결한 값으로 실제 표시 지연이 아니다. 측정 중 별도 빌더/다른 엔진 실행은 종료했지만 OS/file cache와 외부 부하는 통제하지 않았다.

| 후보 / 창 | list cold CPU p95 | list cold entry p95 | Material 0 cold entry p95 | Cupertino cold entry p95 | list fast CPU p95 | list fast oldest→surface p95 |
|---|---:|---:|---:|---:|---:|---:|
| V8 / 기본 | 7.089 | 17.138 | 39.270 | 70.379 | 12.996 | 26.420 |
| Static AOT / 기본 | 17.277 | 31.393 | 60.199 | 120.120 | 58.051 | 135.670 |
| V8 / 최대화 | 13.162 | 22.977 | 94.741 | 68.834 | 22.946 | 44.565 |
| Static AOT / 최대화 | 37.680 | 42.999 | 152.410 | 118.526 | 183.861 | 364.104 |

- **G3 FAIL / performanceAccepted=false.** 60Hz 초기 CPU p95 목표 12.5ms를 여러 구간이 넘고, AOT 기본 Material revisit CPU max는 224.636ms, 최대화 Material revisit는 CPU p95 84.069ms / oldest→surface p95 255.266ms였다. native AOT coverage 성공을 성능 개선으로 판단하지 않는다.
- 수정 전 V8 cold entry p95는 기본 list/Material 0/Cupertino `15.890 / 32.867 / 69.448`, 최대화 `24.529 / 90.489 / 54.320`ms였다. 각 1회이며 AOT 수정 전 표본과 정규 3회 반복이 없어 20%/50% 개선을 주장할 수 없다. **G6 NOT_ACCEPTED**, gallery 전환을 시작하지 않는다.
- 후보 Static AOT coverage는 initializer native 1,373 / original callable native 40,850(dead 99) / emitted native 47,445(dead 14), 각 coverage 100%, unclassified/unresolved/dynamic-code candidate 0이었다. `wholeAppNativeAot=true`, `typePolicyAccepted=true`는 이번 fixture bundle 범위다. 준비 시간은 bundle 123.594s + compiler 630.383s, host build 156.630s였다. source SHA-256: V8 `e7a5298944bc1c46d1e6116b500700314bda3d464cfcfc220359bade81257f95`, AOT `c0d5e4e45b723e7aa12bbce314b9194285ff30ddf747fefc72dee4f133daebe2`.
- **실제 표시·physical precision/contact/관성·사람의 체감은 notVerified**다. injected wheel/surface 완료와 구분한다.

**중단된 진단.** `NELYX_SCROLL_DIAGNOSTIC=1` + `node Nelyx/eng/tests/run-windows-scroll.mjs static-aot 1`은 기본 창 1회의 계측용이며 당시 컴파일 중 중단했다. 계측 span은 겹칠 수 있으므로 합산하지 않고 계측 실행은 성능 표본에서 제외한다. 이 도구의 Hermes bytecode 진단 연결은 W16-01의 잔여 작업이다. 이전 재개 순서는 §8.2로 대체한다.

| 단계 | 현재 구현·검증 범위 | 남은 종료 조건 |
|---|---|---|
| W16-00/01 | PARTIAL: 입력·공급 감사, 연속 native wheel/역방향/4ms stress, entry/retained/retirement CPU 분리, oldest/latest offset-changing input→surface | Hermes bytecode wrapper와 두 주 모드 공급·baseline, 전체 catalog 최초 노출, 속도·queue depth/high-water·수명/자원/GC attribution, 모드별 정규 전후 비교와 display 관측 |
| W16-02 | PARTIAL: 기존 단일 owner를 유지한 store/snapshot/grouped delegate seam | demand·View 예산·bounded 정책·취소/metric 계약 확정 |
| W16-03 | PARTIAL: 구조 revision당 정렬 snapshot/Element projection 재사용, 인접 sibling 갱신, unmount snapshot 해제. 기존 remap/retake/수명 검사 PASS | 실제 변경 slot flush 축소와 상세 native 단가/실패 경로 수락 |
| W16-04 | PARTIAL: ParentData 없는 render attach에서 배열/Set 세 개의 불필요한 할당 제거 | Hermes 두 모드의 생성·build/layout 비용/할당 attribution 및 모드별 G6 cold 20% 개선 |
| W16-05 | PARTIAL: 로컬에서 생성하고 schema를 검증한 immutable text만 key/cost/후속 freeze/TextPainter 직렬화 공유. raw frozen/Proxy/getter/toJSON·상속 hook은 기존 경로. cache/수명/압박 회귀 PASS | font catalog revision별 재사용, Hermes 두 모드 cold/revisit·직렬화/할당/native 문단 단가 수락 |
| W16-06~08 | NOT_STARTED | demand 필수 coverage, View 합계 bounded 보존·실제 자원 admission, root 선택 pass/취소/capability |
| W16-09 | PARTIAL: 공개 `SliverChildGroupedDelegate`, Key 동등성 기반 namespace/remap/flat index, descriptor 4,096 제한. 일반 목적 공개 소비 및 설치 소비 4 PASS | W16-06/07 정책·anchor/environment 조합과 최종 수락 |
| W16-10 | NOT_ACCEPTED | Hermes 두 모드의 정규 G6 수락 후 sample 전환 |
| W16-11 | NOT_STARTED | G6 수락 후 두 gallery의 큰 section을 공통 lazy 경계로 전환 |
| W16-12~14 | PARTIAL: 당시 Core 공급/README·native 후보 4회 qualification·중간 정리 완료. 성능 미달 | Hermes 두 공개 Release 앱·정규 성능/물리 입력, V8/JSC/Web 호환성 회귀·최종 정리 |

### 8.2 Hermes 중심 개정과 다음 구현 순서 (2026-10-24 KST)

**계획 개정 당시 완료 범위는 `work16.md` 수정이었다. 이후 전체 구현 요청으로 §8.3에서 실행을 재개했다.** 기존 V8/Static AOT 결과와 W15A의 coverage·성능 판정은 그대로 두고 아래 순서를 적용한다.

1. **W16-00/01: Hermes 두 경로의 실행 기반부터 맞춘다.** dirty와 Core/SDK/runner·VM/compiler 공급을 재확인한다. `run-windows-scroll.mjs`에 Hermes bytecode/optimized 지원을 연결하고 주 `matrix`를 bytecode+Static Hermes로 변경한다. mode/profile·공급 hash·정상 close/drain과 성공/실패/중단 cleanup을 검증한다.
2. **Hermes bytecode baseline → Static Hermes baseline·계측.** 같은 고정 행·기존 전체 gallery의 retained/cold/revisit/fast를 두 창에서 측정한다. 현재 중간 공급을 새 baseline으로 쓸 경우 그 범위를 명시한다. bytecode의 JS 연산/할당·GC와 AOT의 native 함수/PC·VM/GC·host 비용을 연결하고, 전체 catalog·속도·queue/자원 계측의 빠진 부분을 보완한다.
3. **W16-02~05: 측정된 공통 엔진 비용부터 줄인다.** 기존 child store·ParentData·owned text 구현을 출발점으로 삼는다. ancestor/dependency·field/config·구조 갱신·text key/font revision·layout/retirement 중 실제 비용이 남는 owner를 수정하고 두 Hermes 모드에서 효과·JS 의미·State 수명을 확인한다.
4. **W16-06~10: 공통 정책과 두 모드 G6를 수락한다.** demand·View 합계 bounded 보존·선택 pass·grouped delegate를 완성하고 보존/준비 off/on을 분리한다. gallery 소스를 유지한 상태에서 두 모드 각각 cold CPU·항목당 단가 20% 개선과 기능/수명을 확인한다.
5. **W16-11~14: gallery 소비 → 최종 두 모드 수락.** G6 이후 gallery를 공통 API로 전환하고 Hermes 두 실제 Release 앱을 공급한다. §5.3의 전후 24회 기본 비교로 모드별 G3를 평가하고 각 실제 앱의 precision·표시·close를 확인한다. V8/JSC/Web은 호환성 회귀를 수행한다. 미달·미관측 항목과 불필요한 계측/임시 파일 정리를 기록한다.

| 모드 | `engineAccepted` | `performanceAccepted` | `physicalInputAccepted` | 현재 근거 / 다음 필요 사항 |
|---|---|---|---|---|
| Hermes bytecode | notVerified | false | notVerified | baseline 6회·첫 후보 6회 확보, G6 미달. 후속 B viewport 불일치/정책 입력 거리 실패, AV 미해결. C 구조 개선 후 별도 수락 필요 |
| Static Hermes | notVerified | false | notVerified | baseline 6회·첫 후보 6회 확보, 기본 창 G6 미달. 후속 B viewport 불일치/정책 입력 거리 실패. C 구조 개선 후 별도 수락 필요 |

계획 개정만으로 이전 실패를 초기화하지 않는다. 모드별 실제 수락이 쌓일 때 이 표와 W16 전체 판정을 함께 갱신한다.

### 8.3 전체 구현 재개 (2026-10-24 KST)

- 시작 HEAD `6db708e1`, tracked/untracked dirty 없음. 시작 W16 SHA-256 `9522a692fb928ed65364a3f71bcfb6cc77786b9f54ecbb426455fd6d74e72a35`, research SHA-256은 §1.1과 동일하다. 현재 중간 Core를 신규 baseline으로 사용한다. 시작 source 623개/dist 2,492개가 runner 설치본과 경로별 SHA-256 일치했고, 기존 6개 변경 owner의 dist/설치 hash도 다시 확인했다. 이전 구현분의 개선율은 신규 baseline에 포함해 주장하지 않는다.
- W16-01 wrapper에 Hermes bytecode/optimized/Release를 연결하고 주 matrix를 bytecode+Static Hermes로 변경했다. 두 모드는 같은 qualified VM/GC supplier를 사용하며 실제 HBC 99·VM/host/compiler/AOT identity를 검사한다. 접근성 enabled/semantics 50ms, 기존 gallery/행 구성·cache 상한을 유지한다.
- 공통 회귀 **73/73 PASS**, helper strict 타입 검사 PASS(20분 timeout). State/Key·GlobalKey·section/focus/RTL·문단 admission/lease·mailbox와 신규 callback 계약·native 결과 검증을 포함한다. 공개 Release 앱·사람의 IME/precision 수락을 대신하지 않는다.
- 초기 foreground/pointer 중단과 불완전 실행은 제외했다. 재귀 unmount/deactivate에 추가한 타이밍 wrapper가 deep 진단의 해제를 방해해 제거했다. 수정 후 bytecode queued 진단 10개 구간 전체 PASS/정상 drain. queued 입력과 intrusive 계측은 OS 성능 표본에서 제외한다. native context facade는 기능 유무·native receiver·동적 속성·close 예외를 보존한다.
- 첫 정규 matrix는 list-fast 이벤트 **239개**, 절대 이동량 **1,824px**(240회 주입분과 일치), native sequence **529~767**(239개 연속), queue high-water **57**에서 기존 이벤트 수 일치 검사로 중단됐다. 부호 누적값은 실패 출력에 없어 이 실행은 수락하지 않는다. 단순 이동량 손실로 확정했던 해석을 철회했다. fixture는 주입 수/수신 수를 분리하고 절대/부호 이동량·sequence 연속성·queue/dispatch 대응·주입 기록을 모두 요구한다. SDK queued 진단은 정확한 이벤트 수를 유지하며 실제 손실/중복/반전·sequence 누락을 거부한다.
- 사용자의 desktop 비사용 답변 뒤 준비한 **현재 고정 범위 baseline 12/12회**(두 모드×기본/최대화×3회)가 전달량·거리·순서와 정상 close/drain을 통과했다. AOT는 실제 native 초기화/선택 body 실행·fallback 0 audit도 통과했다. 일부 fast 구간 수신 이벤트 237~239개도 전체 이동량과 emitted native sequence를 보존했다. 별도 native ingress 계측으로 callback/delta를 대조 중이다. 이전 대기 후보는 timeout 정리됐으며 현재 실행에서 재준비했다.

현재 baseline identity(전체 hash):

| 모드 | Metro source SHA-256 | HBC / AOT DLL SHA-256 | host SHA-256 |
|---|---|---|---|
| bytecode | `71de66da9b7c7c7f38ae098a1f1b2124271d53db70be2e7c12f5c91e530fc1c5` | `c0813b01f50b45f9295487b61539217e7a5001f3e154a817721f408954802447` | `a70b16c93ea6846c3e2f5e88e6930d01c4534fc93f61d9246c2a982e826c931c` |
| Static Hermes | `eec156f510b297d00d8876f964f25d1771ac143c8fc6a4f89c11da115ea92fcd` | `2000eab899bbd895c9521b90e4481ba2d567bee391f204397965865b42c7f4d9` | `3d640e0ffe7e57bd3a9e9707e89296f862e4a2dc7d211444bee823d490a8a3ed` |

- 공통 VM `c6e57ac68ad43a6073c3e159efbf273197f6b41a297c8b75c9fc1364202a9d5c`, bytecode compiler `74b975947a885939296540664f1f6c0067d1ff4b409f105377ac256a3d3f33cc`. Static Hermes는 고정 revision/policy를 유지하고 initializer **1,373**, original callable **40,862**, emitted **47,457** native, 각 coverage **100%**, 미분류/미해결/dynamic-code candidate **0**, typed original body **19**다. image/PDB 함수 범위 map **43,110개**가 생성됐으나 **실제 PC sampling은 notVerified**다. 이 coverage는 fixture build/runtime 범위이며 공개 앱 공급 수락과 구분한다.

각 조건 3회 **p95의 중앙값**, 단위 ms. pooled percentile이 아니다. 기본/최대화 cold 신규 row 진입 frame은 매회 23/40개, Element mount는 1,702/2,960개다. CPU 전체 frame 수는 모드/실행에 따라 달라진다.

| 모드 / 창 | list cold CPU | cold entry | revisit CPU | retained CPU | fast CPU | cold oldest→surface | Material 0/1 cold entry | Cupertino cold entry |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| bytecode / 기본 | 40.942 | 50.944 | 45.048 | 17.974 | 238.470 | 80.280 | 86.619 / — | 142.316 |
| bytecode / 최대화 | 68.753 | 84.959 | 64.873 | 19.717 | 363.606 | 135.257 | 164.717 / 78.650 | 126.692 |
| Static Hermes / 기본 | 28.518 | 37.485 | 26.976 | 11.457 | 112.220 | 57.222 | 67.049 / — | 107.505 |
| Static Hermes / 최대화 | 46.883 | 58.668 | 39.206 | 15.410 | 243.783 | 88.886 | 131.971 / 76.965 | 123.464 |

- list cold 누적 VM 할당/GC 중앙값은 bytecode 기본 **723,820,032 bytes / 182회**, 최대화 **795,373,840 / 200회**, AOT 기본 **484,686,088 / 124회**, 최대화 **559,609,112 / 142회**다. live heap·GC pause percentile과 다르다. 최대 process peak working set은 각각 **398,819,328 / 625,025,024 / 447,586,304 / 948,994,048 bytes**였다. OS/file cache·외부 부하는 통제하지 않았다.
- **G3 FAIL / performanceAccepted=false**, **G6 NOT_ACCEPTED**(후보 변경 전). 이 fixture는 일반 ListView의 ≥5 viewport와 gallery의 고정 이동 구간이며 **gallery 전체 catalog의 최초 노출/재방문은 아직 충족하지 않는다**. 따라서 W16 전체 G0/최종 24회 full-catalog matrix 수락으로 확대하지 않는다. native surface 완료는 실제 표시·physical precision/contact/관성 수락이 아니며 모두 **notVerified**다.
- 두 모드 native/JS/Core 진단 **각 10개 구간 전체 PASS / exit 0 / 정상 drain**. 같은 실행의 compiler output hash를 확인해 native 진단 host만 교체했다(bytecode host `c6a0d989e404f03d641e661582d06cd4e6f6e36fe93311dca134e51334568568`, AOT host `42dd9931ba8fff535b9c2f15b101240954c6ad5f5b824dcbe32c9d37bbae286b`). list cold self time은 bytecode semantics flush **860ms/109회**, paint recording **698ms/648회**, AOT는 **677ms/118회**, **474ms/899회**였다. semantics flush 누적 할당은 **162,179,224 / 92,763,296 bytes**. inclusive span은 중첩되며 이 계측값을 정규 CPU에 합치지 않는다. 각 native callback/절대·부호 delta가 Core 수신과 일치했고 state/geometry rejection은 없었다. 이 두 진단은 모두 240개 수신이어서 aggregation 자체의 native histrogram을 직접 관측한 표본은 아니다.
- 위 실행의 프로세스·임시 후보·생성 entry가 정리됐고 runner config는 실행 전 bytes로 복원됐다. 기존 ignored `32204` fixture 두 파일은 보존했다. 이후 사용자는 desktop을 조작할 수 있다고 안내했으며 다음 OS 입력 검사 전에 다시 알린다.
- **공통 제품 후보 4개 파일 구현:** unfocused subtree 추가로 모든 Focus 조상을 dirty로 만들던 경로를 줄이고 이동 subtree 자손의 inherited eligibility 알림을 보존했다. Focus widget은 실제 관련 상태가 바뀔 때 갱신하며 custom FocusNode/own getter는 보수적 경로를 유지한다. 고정 원본 [Focus](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/widgets/focus_scope.dart#L644), [focus reparent](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/widgets/focus_manager.dart#L997)과 대조했다. 실제 focus 이동·외부 callback·자손 eligibility·custom getter 회귀 PASS. semantics original callback을 lazy 고정 구조로 분리해 configuration own fields **71→47**(callback 구조 25개, VM dictionary 기준 64)로 줄였고 명시적 `undefined`·freeze 실패/handler 순서·copy/absorb 의미를 보존했다. 빈 absorb는 writable copy를 만들지 않는다. Node/CanvasKit 24×80px 탐색에서 configuration copy **288→144회**였으며 Hermes 성능 개선율은 아직 주장하지 않는다.
- 현재 Core build·공통 회귀 **106/106 PASS**, 전체 9 workspace 타입 검사와 이후 Core 재검사 PASS, gallery **24 PASS / 선택 profiling 1 SKIP**. Material 29개 section, editor/Form·route·theme/resize·자원 수명은 Node/CanvasKit 범위다. **runner 설치 Core는 아직 baseline 공급을 유지하며 새 후보를 pack/install하지 않았다.**
- **전체 catalog 부하 보완 중:** OS 기본 부하를 planned 포함 전체 열의 끝 경계→역방향 재방문→fast로 확장했다. 기존 frame callback에서 section key와 viewport 교차를 관찰하며 cold/revisit의 실제 전체 membership·노출을 검사한다. fast는 건너뛴 section을 보고하되 끝 경계와 입력 보존을 요구한다. 8,192회 상한의 native stream은 render 완료로 packet을 pace하지 않고 끝 경계에서만 중단한다. 일반 ListView의 adapter 삽입부터 첫 layout까지 항목 단가·mount coverage도 별도로 보고한다. gallery의 초기 leading child 생성은 이 항목 타이머 범위 밖이며 전체 frame 비용에는 포함된다. 첫 화면의 이미 만들어진 section과 새로 진입한 section의 비용 범위를 구분한다.
- 결과 검증 **4/4 PASS**, Static Hermes 전체 source graph preflight PASS. 공급 검사는 sliver 한 파일에서 전체 Core **3,116개 src/dist/package 파일**의 정렬 경로+내용 digest로 확대했다. baseline 설치 digest **`8b4eb3fbbe108b0f4039839e9340d6223196ca6c4f43a91322e60fa1887955cb`**, 현재 workspace 후보 digest **`22c7faa7258ca0f1173a1b1c68022cd9a68646b95df1d154ba8544dd3fb8b290`**. 후보는 아직 설치하지 않았고 baseline을 명시적으로 고정한다.
- 첫 전체 부하 qualification은 좁은 창의 compact header에 planned 토글 자체가 구성되지 않아 list 4구간 뒤 준비 단계에서 중단됐고 close/drain도 실패했다. fixture는 실제 State의 catalog 입력을 설정한 뒤 기존 category 전환으로 extent/scroll owner를 초기화한다. 다음 실행은 Material **29/29**의 cold/revisit/fast viewport 노출을 확인했으나 design 전환에서 실패했다. nested 원인은 깊이 260의 unmount 중 **native stack overflow**였다. 추가 관찰 wrapper를 재귀 lifecycle에서 제거하고 `BuildOwner.register/unregister`에서 실제 mount/unmount와 section 수명을 집계하도록 수정했다. 두 실패 실행은 성능/기능 수락에서 제외하고 임시 산출물을 정리했다. product gallery 소스는 유지하며 정상 전환·close를 재검사한다.
- 재귀 lifecycle 관찰 제거 후 bytecode의 기본/최대화 **1·2회차 총 4회 전체 부하 PASS**, Material **29개**/Cupertino **20개**의 전체 membership·노출/재방문, 입력 보존·정상 close/drain을 확인했다. 같은 build의 3회차 기본 창은 Material revisit 시작에서 **`0xC0000005` native access violation**으로 종료됐고 최대화 3회차는 실행하지 않았다. 전체 6회 수락은 미완료다. 유효한 네 실행의 source/HBC는 `3cd8f605dcbc4a23994f3e04949b9493b1799d6cf6f3bf50b09b5e99f641ea13` / `5321deaed7a1a9d3c19d865b5be289909b88af3683c2dcb024fd295db19b1aa5`, host는 `6eac1d11176c59eb1d9f3c0fba6d2fe16ad764e05162367dda4f2b8cff57181d`다. 중단된 실행은 비교 표본에서 제외하고 fault module/PC 원인을 추가 검사한다.
- 첫 기본 창의 Material 역방향 mount는 **10,905개**, 정방향 **2,459개**였다. section renderer가 start index가 작아질 때 겹치는 활성 항목까지 전부 제거하는 경로를 수정했다. 새 회귀는 수정 전 `[9,10,11,12]` 재생성을 재현했고 수정 후 새 행 `[9]`만 만들며 기존 State와 clip bounds를 보존한다. 먼 역방향 seek도 목적지 `[1,2,3]`만 생성한다. 현재 Core build·공통 **108/108 PASS**, Core 타입 검사 PASS. 이 다섯 번째 제품 후보도 아직 runner에 공급하지 않았다. candidate source/dist 전체 digest는 `3b19ebe4a937484e672a15a0ce69252b6375275b38b2cc4d01b772dafcd11f43`, 설치 기준선은 계속 `8b4eb3fbbe108b0f4039839e9340d6223196ca6c4f43a91322e60fa1887955cb`다.
- fatal-only fixture는 실제 예외 context에서 module/RVA/stack을 남긴다. 별도 진단 helper는 같은 사용자로 시작한 프로세스의 sync JSI thread를 관찰하며 context를 읽은 뒤 즉시 재개하고, 할당·module 탐색·symbol/출력은 그 후 수행한다. 관찰에는 wait가 포함되며 **PC 빈도를 CPU 시간 비율이나 성능 수락으로 해석하지 않는다**. 실제 CPU 시간·간격·observer/host/VM/image/map identity와 function-range·alias 후보를 보고한다. 의도된 native AV의 원래 종료 코드·함수 stack, 관찰 PC·stdio 전달·임시 입력 삭제 제어 검사와 pure PC/IR/symbol 검사 **3 PASS**. 정규 실행에는 sampler가 없고 별도 native 진단에만 사용한다.
- 첫 full-catalog AOT 준비는 native coverage 100%(initializer 1,373 / original callable 40,870(typed 19) / emitted 47,467, 미분류·미해결 0)를 통과했으나 추가 PC metadata adapter의 잘못된 IR 경로로 runtime 전에 실패했다. 수락 표본이 아니며 compiler 임시 산출물은 삭제했다. adapter를 실제 `partition.ir.functions` schema로 수정하고 변환 검증을 native compile 앞으로 이동했다. 실제 전체 Metro frontend-only 검사 **PASS**(typed body 19/source owner 1,375, native compiler 미호출). 수정 후 AOT 전체 기준선과 PC 진단을 다시 준비 중이다.
- bytecode 추가 기본/최대화 **2회 PASS**로 비교용 유효 표본은 **창별 3회, 총 6회**가 됐다. 앞선 AV는 여전히 **원인 미확정/engine 미수락**이며 추가 성공으로 실패를 지우지 않는다. 추가 실행의 Metro source는 앞선 네 표본과 같고, HBC/host는 각각 `55b2c382fa05ebf8461fdb5a7fa7671c409eb9ea54af53d5c68b65e89080ccc4` / `ae9981628a501641d485fa2069405e651d56ee6c300589981a4b5756e22d1a58`이다. 서로 다른 실행의 HBC byte identity는 같다고 주장하지 않는다. 같은 추가 실행 안의 진단은 이 HBC hash를 그대로 재사용했다.
- bytecode 별도 bounded native/JS/Core+PC 진단 **10/10 구간 PASS / exit 0 / 정상 drain**. observer `0a68ab109fcab40670a125b97b9c0471be8c4cd5fcf5711d0d65477b59c3835d`, 진단 host `de045215ebac66cfc01f4d5c1e54d2b3841dbf1c4754a25bfca4fb5670d38f0c`, VM은 위 공통 hash다. 실제 VM PC에서 HadesGC young-generation evacuation/weak-map list, interpreter slow property lookup, N-API typeof/reference 함수가 해독됐다. 도구 출력 전송이 큰 attribution JSON 중간을 잘라 agent가 완전히 보유한 PC record는 **5구간**이다(해당 구간 각 108~435 snapshot). parent의 전체 qualification PASS와 보유 trace 범위를 구분한다. symbol 출력은 경로·중첩 template를 줄이고 원본 signature hash·RVA·source line을 유지하도록 보완했다. 이 관찰을 AV 원인 확정이나 정규 CPU 수치로 확대하지 않는다.
- full-catalog bytecode 비교용 3회 p95 중앙값(ms)은 기본/최대화 순으로 list cold CPU **41.985 / 65.653**, cold entry **47.311 / 66.261**, 순수 항목 생성→첫 layout **22.788 / 24.540**, retained CPU **17.674 / 24.105**, Material 0 cold entry **75.119 / 174.231**, Cupertino cold entry **123.509 / 126.356**이다. 앞의 고정 범위 표와 구분하며 pooled percentile이 아니다. 원인 미확정 AV를 제외한 유효 비교 표본이지 engine 전체 수락은 아니다.
- section overlap 수정 후 gallery 회귀 **24 PASS / 선택 profiling 1 SKIP**를 다시 확인했다. G6 판정 helper는 메모리 내 출력에서 실제 성공 qualification만 선택하며 실패 시도는 별도 유지한다. 창·모드별 정확히 3개의 p95 중앙값, 동일 VM/compiler·AOT policy·6개 부하 source, cold CPU/항목 단가 각각 20%, 모든 gallery phase의 retained/entry 10% 회귀 한계를 독립 검사한다. 공급 혼합·불완전/계측 실행·source 전환·항목 계측 누락·한 모드 실패를 거부하는 검사 **3 PASS**다. 아직 후보 native 결과를 얻지 않았으므로 G6 개선 수락은 아니다.
- AOT 재준비는 compiler/native coverage PASS(1,373 initializer / 40,870 original callable(typed 19) / 47,467 emitted, coverage 100%, 미분류·미해결·dynamic-code candidate 0), 함수 범위 **43,122개**를 확인했다. compiler 509.717s / Metro 84.843s, AOT DLL `1399f93d4349c2d9eb58ae668a96d77c0bcb61f795dbc937dcf71150ffd7095e`, toolchain `aaa154e0612813270addf73c6d5fb3aa7440f300666063f27751baab9ee44b6f`, guarded-closed-scalar-v2 유지다. 아직 host 준비/입력/실제 AOT PC 단계 전이다.
- AOT host 133.898s 후 OS 전체 부하를 재개했고 첫 기본/최대화 **2회 PASS**(close/drain 포함), 나머지 4회 및 진단 진행 중이다. host `6bd2b994fd8cfeba61ae2a62cdb7997ef7ff876efe378f38f3f378f2bbdd6922`, Metro source `708fb0399bd9ee65827c57e538003eee7f7552c002952036ddcc123b9e427f22`다. 측정 중 추가 build/test는 실행하지 않는다.
- **W16-06/07 source 구현 진행 중 / 아직 build·검증·공급 전:** `ListView.childPolicy`와 fixed/section sliver opt-in, mandatory demand 범위, 기존 bucket의 optional/explicit 이유 분리, BuildOwner mount/unmount/activate delta 기반 View 합계 8/sliver·16/View·2,048 Element 보존 회계를 연결 중이다. registry의 실제 producer/resident cost를 서비스 간 합산하며 in-flight 비용은 실제 retirement까지 남긴다. canonical layout callback에서 퇴거하고 자동 준비는 관측 deadline이 없어 비활성 상태다. nested bounded·shrink-wrap/일반·varied/prototype 조합은 명시적으로 지원하지 않는다. 두 열·State 재사용·explicit 해제·거대 원자 row·legacy/옵션 충돌 회귀를 작성했으나 현재 native 측정과 겹치지 않게 실행을 미룬다. 위 `3b19…`는 앞선 다섯 파일 후보의 source/dist digest이며 이후 작성 중인 source를 포함한 최신 후보 hash는 build 후 다시 기록한다. 설치 Core와 gallery 제품 소스는 기준선 그대로다.
- **full-catalog 설치 기준선 확보:** AOT 기본/최대화 각 3회 **6/6 PASS**, 별도 bounded native/JS/Core+PC 진단 **10/10 구간 PASS / exit 0 / 정상 drain**. AOT list cold CPU p95 중앙값은 기본/최대화 **29.432 / 43.990ms**, cold entry **37.117 / 48.457ms**, 항목 생성→첫 layout **16.465 / 20.252ms**, retained CPU **11.064 / 14.688ms**, Material 0 cold entry **70.154 / 143.401ms**, Cupertino cold entry **116.884 / 107.889ms**다. bytecode 6개와 합쳐 비교용 12개이며, bytecode의 미해결 AV 한 시도는 별도로 유지한다. G3 성능은 여전히 미달이다.
- **실제 AOT PC 대응 확인:** 10구간의 **3,022 snapshot**, owned AOT 함수 범위 대응 **350**, AOT image 안이지만 범위 map 밖인 **7**은 미분류로 남겼다. Core semantics-pipeline `parent`/focus `descendants`, layer, Metro require/TDZ 및 VM descriptor/GC 경로가 관찰됐다. original source 후보·folded alias의 모호성을 유지하며 statement 단위나 CPU 시간 비율을 주장하지 않는다. map `5b6fe935ebecccc527d349971dec518097468e0057660937b022640a0b5aa823`, observer `94a30a68b6c23aff4832036db995f0ebfe1c346bd3d2c61df47c72fe27a2e300`, 진단 host `b8f7975d2d63fbf0eaa5ad236966e69aedaa85a4dde0fc1d44e5412d98fde1bb`, AOT/VM hash는 위와 같다. 최종 10구간 attribution을 전송 누락 없이 파싱했다. intrusive 진단의 일부 구간은 후속 Core/gallery 검사와 겹쳤으므로 그 시간값을 성능 판정에 쓰지 않는다. 정규 6회에는 추가 build/test가 없었다.
- **W16-06/07 후보 검증·공급:** Core build/전체 9 workspace 타입 검사 PASS, 공통 **121/121 PASS**, gallery **24 PASS / profiling 1 SKIP**. 신규 bounded 6개는 두 열 공유 상한·실제 State 재사용·explicit 해제·거대 Element row 보존 거부·indexed anchor·GlobalKey retake와 close 후 회계 0을 확인한다. 큰 원자 갱신의 순간 초과는 peak/overrun으로 계상하고 정상 퇴거한다. 필수 render-child admission은 optional bucket부터 실제 해제하며 explicit/visible은 강제 해제하지 않는다. 자동 준비용 제한 pass·capability/cancel은 아직 잔여다.
- `prepare-sample`은 archive/lock 공급 단계여서 첫 source-to-install 검사가 구 설치본을 거부했다. 실제 runner `npm install --offline --ignore-scripts --workspaces=false` 후 최신 Core **3,121개 src/dist/package 파일 전부 일치**, digest **`3f4a483f7a889f0d67e1fbbc16d68073a4786a976730bbe1f65187d16c412789`**, 변경 13개 owner JS 일치, 설치 공개 소비 **18/18 PASS**. 이 첫 후보의 archive는 `nelyx-core-0.16.0-c6835788b9cf97b6f62ce2d95f66ca30b4bbec4ad66b21d0f460605b9e2821a6.tgz`였다. 공급 hash와 실제 설치 검증을 구분한다. 공개 Release EXE 갱신은 아직 아니다. 실행 소유 native 임시 파일·프로세스는 정리됐고 config 원래 bytes와 기존 `32204` entry는 보존했다. 2026-10-21 생성된 외부 temp `lZr0JK`는 이번 실행 소유가 아니므로 건드리지 않았다.
- **W16-08 source 구현:** host가 실제로 광고한 같은 clock epoch의 `FrameTiming.observedDeadline` 숫자와 live runtime admission을 모두 요구한다. 현재 Windows clock은 이 필드를 만들지 않으며 자동 준비는 계속 비활성이다. 필수 PipelineOwner 수렴 뒤 기존 root에서 1 host tick당 최대 1개/2ms 추정 allowance·4ms reserve와 queueDelay/uncertainty를 확인하고, 선택 sliver만 실제 layout callback을 거치는 추가 pass와 필수 범위 복원 pass를 수행한다. 원자 작업 초과는 중단/은폐하지 않고 계상한다. 방향/위젯·delegate·metric 환경 변경, 입력 backlog·native busy·hidden/closing은 후보를 제한/취소한다. 새 RAF/timer loop·두 번째 tree/lease를 만들지 않는다.
- 선택 pass 후속 후보는 Core build/전체 9 workspace 타입 검사 PASS, 공통 **125 PASS**(후속 두 검사 추가 전), gallery **24 PASS / profiling 1 SKIP**, 선택/clock/backpressure **27 PASS**다. 이후 실제 runtime의 deadline 부재·busy·input backlog·forced frame·generation·hide/close live guard 검사와 Windows deadline 미생성 검사 **17 PASS**, in-flight resident 압박 중 optional만 정상 해제하는 검사 포함 bounded/선택 **11 PASS**를 추가 확인했다. 이들은 CPU/합성 host capability 범위이며 실제 Windows의 준비 기능 활성화나 성능 수락은 아니다. 후속 pass를 추가한 sliver Element own fields는 **41개**(설치 후보 33개)로 dictionary 기준 64 미만이다.
- **첫 설치 후보 native 비교는 후속 source와 분리된 `3f4a…2789`에 고정했다.** gallery 제품 6개 source/cache 상한, 보존·준비 off 조건을 유지한다. 후보 bytecode source/HBC/host는 `cb50192f8089ae6df86d7d0f55c15c269cd6359c4ab7253436ceb13f2fb0330c` / `5fadc168fa55ed5a95ef54686ba2ae3f6fbb3e9066fcfae566997eb52263afe3` / `6f22417ffddd1b32bc65ff8ee80be978f78bd81c79fcc50821221f67d7a60a69`. AOT source/DLL/host는 `0ce66371513d4cc1800c4fc56c7f9710d8fcd2e040484321c7e6202f0d0a6423` / `d7ebcb801b0fd972f226349abb0ba848b05626a88884af2f21ee0a381baec0f0` / `df0e1d1d21668bb32500f750da2b9440d765c32597a5866735e4219e76358366`다. AOT initializer 1,374 / original callable 40,925(typed 19) / emitted 47,527, coverage 100%, 미분류·미해결·dynamic-code candidate 0, 함수 범위 43,170개. 같은 VM/compiler·policy를 유지한다.
- **설치 `3f4a…2789` 후보 정규 12/12회 PASS, G6 NOT_ACCEPTED.** 모드별 동일 공급·부하의 전후 24개 유효 표본을 helper로 판정했다. 후보 AV 0회이며 baseline의 원인 미확정 AV 1회는 별도로 남긴다. 아래는 창별 3회 p95 중앙값(ms)이며 보존/준비 off, gallery 제품 6개 source hash와 cache 상한은 같다.

| 후보 모드 / 창 | list cold CPU | 항목 생성→첫 layout | retained CPU | G6 |
|---|---:|---:|---:|---|
| bytecode / 기본 | 36.397 (-13.3%) | 19.368 (-15.0%) | 16.671 | FAIL: cold·항목 20% 미달 |
| bytecode / 최대화 | 47.770 (-27.2%) | 20.700 (-15.6%) | 21.396 | FAIL: 항목 20% 미달·gallery entry 회귀 |
| Static Hermes / 기본 | 22.878 (-22.3%) | 13.532 (-17.8%) | 10.818 | FAIL: 항목 20% 미달 |
| Static Hermes / 최대화 | 30.972 (-29.6%) | 13.932 (-31.2%) | 13.977 | 이 조건의 G6 PASS |

- bytecode 최대화 Material 0 cold entry p95 중앙값은 **174.231→207.720ms (+19.2%)**로 10% 회귀 한계를 넘었다. 다른 gallery phase의 entry/retained 조건은 통과했다. Static Hermes 한 조건의 개선으로 나머지 실패를 상쇄하지 않으며 gallery 전환을 시작하지 않는다. G3/실제 표시·physical 수락은 여전히 미달/미관측이다. 같은 compiler output을 재사용한 별도 native 진단의 결과는 아래와 같다.
- **후속 source 추가 실험:** 보존 reuse와 준비 hit/miss·유한 후보 취소를 실제 bucket obtain/최종 teardown에 연결했다. explicit offscreen keep-alive를 visible hit로 세지 않는다. indexed 준비의 실제 측정·anchor/resize와 hit/miss/hide 취소 회귀를 추가했다. baseline PC의 semantics parent·WeakMap/GC 관찰에 근거해 fragment를 실제 RenderObject가 이미 소유한 private child-table 객체의 symbol metadata에 두고(Map child entry와 구분), flush 한정 geometry 표를 일반 Map으로 바꿨다. RenderObject own field를 늘리지 않으며 사용자 getter를 memoize하지 않는다. 임시 geometry 표는 기존 finally에서 제거한다. configuration의 다섯 immutable 빈 attributed-text 기본값도 내부에서 공유한다. 공개 mutable/custom 입력의 경로는 유지한다. 이 후속 후보는 현재 설치 `3f4a…2789` matrix에 포함하지 않는다.
- **첫 후보 진단 결과:** Static Hermes bounded native/JS/Core+PC **10/10 구간 PASS / exit 0 / 정상 drain**, **2,933 snapshot / owned AOT 대응 341 / owned 범위 밖 10**을 관찰했다. map `cbc781b6ff937f8bf41c7e1bac88f9cfe243179d10e38ef1b670eb196e6c1a17`, observer `b6d7b9a6c8575eac8bfceda5ce0ff5923ec4e1fb5e1c92c15365fbd2e4f06245`, 진단 host `2e34377fa4648f805ca0be715d905d069d8300e85c6462dedf146a2c679327ff`다. bytecode는 list 4구간의 **1,066 snapshot**을 확보했지만 다음 Material cold에서 기대 거리 **2,016px** 대비 **2,024.4px**가 전달돼 종료 코드 8로 실패했다(240회 주입, 239 native 이벤트, sequence 767~1005 연속). 중단된 phase의 PC scope도 미완료다. 전 실행 exit 1/진단 FAIL을 정규 12회 PASS와 구분하고 원인 미확정 입력 중복을 수락하지 않는다. 정규·PC sampling 구간에는 추가 build/test를 실행하지 않았다. 실행 소유 process/temp/entry는 정리됐고 원래 config bytes·기존 32204 entry·외부 lZr0JK temp를 보존했다.
- **최신 후속 후보 검증·공급:** 실제 annotation action wrapper 23개를 필요한 때만 한 번 만들고 안정된 identity로 현재 properties를 읽도록 바꿔 RenderSemantics own fields **71→49**를 확인했다. fragment는 기존 child-table 객체에 보유해 RenderParagraph의 기존 **64 fields**를 늘리지 않는다. callback 교체·receiver·인자·제거 및 기존 word-setter getter bookkeeping을 보존한다. Core build/전체 **9 workspace 타입 검사 PASS**, 공통 **132/132 PASS**, gallery **25/25 PASS**(선택 Node/CanvasKit profiling 포함), 설치 공개 소비 **20/20 PASS**다. Node profile은 탐색·shape 확인이며 native 성능 수락이 아니다.
- 최신 Core source/dist/설치 **3,121개 파일 전체 일치**, digest **`aa441343475ffe4f00e8a03577317087090a9405a2ba175bfd0946b79b11e3b7`**, 현재 archive **`nelyx-core-0.16.0-ea8bf5d97caf8ffe990048506ed13c4c96479365b9ccd889cd03d75a2b2e48e8.tgz`** 하나다. 새 matrix의 일반 12회는 legacy/보존·준비 off를 유지한다. 그 뒤 같은 compiler output으로 별도 PC 진단과 최대화 bounded/observed-budget 정책 검사를 수행한다. 실제 View 예산·재사용 hit·Windows deadline 미광고/준비 0을 검사하며 정책 on을 G6 off 표본에 섞지 않는다. gallery 제품 6개 source는 여전히 기준선 hash와 같다.
- **최신 후보 실행 identity:** bytecode source/HBC/host `c8e1d13ca7eca08258ef3422fcce68eeda21abaa3365b3071500724c630d5d30` / `924719d4ea66581891ad2e6804c20abacf6ee783d6197cd1c0723e344b40b02e` / `5d4635ca165912c302b00f227c872d5f2d99296d000fdf67f9549e022cc049d4`. AOT source/DLL/host `f53673824c5724fd00aea827a6e167d4c1559b8bc3d1279a88b8add18ed26a3a` / `47113bd5847cac2038fb51f353f747eebe1869be9f81119de4722251565448da` / `db7c09c02b621a291193fae29439857eda2fc80b640c4b3d270babb92b3b4522`. 동일 VM/compiler·타입 정책, initializer **1,374**, original callable **40,986**(typed 19), emitted **47,594**, native coverage 100%, 미분류·미해결·dynamic-code candidate 0, 함수 범위 **43,222개**. AOT bundle 87.877s + compiler 506.434s, host 121.313s. 준비 완료 후 2026-10-24 10:25 KST OS 비교를 시작했고 정규/PC sampling 중 다른 build/test는 실행하지 않는다.
- **최신 후보 첫 정규 실행은 비교 불가:** 기본 창 두 모드는 delivery/catalog/close qualification을 통과했지만 ListView 실제 viewport가 기준선 **314.5px**에서 **612.400px**로 달라졌다. 이어 bytecode 최대화는 **579.5→642.800px**로 바뀌었고 retained sweep가 행 경계를 넘어 **mount/unmount 각 74개**를 발생시켜 qualification이 실패했다(exit 0과 구분). G6 개선율 계산에 사용하지 않으며 남은 정규 반복은 실행되지 않았다. 별도 PC/정책 진단은 진행한다. helper에 phase별 실제 viewport·wheel delta·간격 일치 검사를 추가하고 명시적인 모니터 배치/조건 기록을 보완한 뒤 정규 비교를 재개한다. 기존 baseline과 첫 후보 12회의 phase viewport·delta는 실제로 일치한다.
- **편집 수명 추가 검증:** 실제 Core/CanvasKit와 합성 editing port에서 explicit keep-alive 중 한글 composing/caret·Focus·State·단일 host binding을 유지한 채 멀리 이동하고 실제 resident/in-flight 자원 압박으로 optional 항목을 해제하는 검사를 통과했다. 종료 시 binding 해제 1회·추적 Element 0을 확인했다. 확장 편집/선택 회귀 **98/98 PASS**다. 기존 9개 검사가 unmount 직후 문단 0을 요구했지만 기존 idle text cache는 producer 0에서 bounded resident를 보유하므로, 실제 producer·cache resident 일치와 기존 64개/1MiB 상한을 검사하도록 고쳤다. 최종 fixture close의 문단/font 0 검사는 유지했고 제품 cache 상한/동작은 바꾸지 않았다. 실제 OS IME/사람 입력 검증으로 확대하지 않는다.
- **grouped 정책 조합:** 일반 목적 공개 소비에서 목적지 section만 생성하고 bounded 보존·역방향 이동·폭/text scale/locale/RTL·group 이동과 공개 key→index 요청을 조합해 논리 anchor·기존 State·최종 drain을 확인했다. grouped **4/4 PASS**, 현재 설치 공개 소비 **21/21 PASS**다. 제품 gallery 소스와 Core 공급은 바꾸지 않은 검사 추가다.
- 최신 matrix의 첫 준비는 fixture의 optional `itemExtent` nullable 검사에서 Static AOT TypeScript frontend가 실패했다. `typeof === 'number'`로 좁혔고 실행 소유 임시 입력은 finally에서 정리한 뒤 다시 준비했다. 성능/OS 입력 표본은 시작 전이어서 실패 시도를 유효 표본에 포함하지 않는다.
- 위 B 후보의 정규 비교·진단 중심 후속 순서는 **SUPERSEDED BY §8.4**다. G6 이후 gallery 소비, 최종 full-catalog 성능/공개 앱·V8/JSC/Web/물리 수락은 미완료다.

### 8.4 GC 압박을 만드는 공통 구조 우선 개선 (2026-10-24 KST)

**사용자 요청과 판단.** native 검증 반복을 중단하고 할당을 만드는 owner를 먼저 수정한다. GC 관찰만으로 GC가 지연의 주원인이라고 확정하지 않는다. 현재 가장 강한 구조적 의심은 행 진입 때 깊은 Widget/Element/RenderObject wrapper를 만들고, 자식 관계·측정·배치 결과를 여러 임시 컨테이너에 옮기는 비용이다. 보존/준비를 켜기 전에 일반 cold 생성 경로에서 이 비용을 줄인다.

- **RenderObject 자식 저장소:** 모든 객체에 Map·연결 레코드·빈 snapshot을 미리 만들던 구조를 0/1/N 저장소로 바꿨다. 자식·semantics 상태가 없으면 저장소를 만들지 않고, 한 자식은 저장소 자체가 link가 되어 Map과 별도 ChildEntry를 만들지 않는다. 두 번째 서로 다른 자식에서 Map으로 승격한다. 이미 승격한 Map은 재정렬 때 재사용하고, public readonly snapshot·sibling·adopt/drop/실패 rollback 순서는 유지한다. 분산된 child 필드 세 개도 저장소로 모았다. 접근성 fragment가 필요하면 leaf에도 저장소가 만들어지며 그 비용을 없앴다고 주장하지 않는다.
- **Layout 호출:** RenderObject/RenderBox/RenderSliver의 실행 body를 `performLayoutInScope`로 옮겨 clean/same-constraints 반환 전에 매번 만들던 closure를 제거했다. 기존 protected `runLayout`의 명시적 callback도 지원한다. constraint 검증·resize·size/geometry 검증·dirty revision·예외 복구는 유지한다. options/constraint/offset 등 다른 할당은 남아 있어 무할당 layout이라고 표현하지 않는다.
- **Flex 측정·배치:** Row/Column 공통 RenderFlex의 item 배열 + 측정 Map + 배치 Map을 하나의 pass-local 순서 레코드 배열로 합쳤다. 같은 레코드에 크기·constraints·baseline·x/y를 기록하고, 측정과 배치 계산을 모두 끝낸 뒤 offset을 반영한다. 역방향 배치도 배열을 뒤집어 복사하지 않고 역방향 index로 순회한다. non-flex→flex 측정 순서, RTL/up 배치·논리 첫 child baseline·overflow·실패 전 offset과 재실행을 보존한다. dry/intrinsic 재진입에 공유 scratch나 이전 child 참조를 남기지 않는다. wet/dry callback도 모듈 단위로 공유한다.
- **확인 범위:** child store/layout dispatch 변경 후 기존 수명·layout/semantics·section/bounded/선택 pass 회귀 **65 PASS**, Flex 변경 후 Core build 및 constraints/layout/Flex **10 PASS**, 실제 Node/CanvasKit ListView의 선택 CPU 검사 **1 PASS**다. 전체 native matrix를 재실행하지 않았다.
- **구조 관찰:** 같은 선택 ListView 트리의 RenderObject **410개**에서 기존 child Map **410개**가 새 구조에서 **21개**였다. 접근성이 켜진 상태의 child store는 **410개**(빈 store 50개)로 남아 있다. RenderParagraph 자체 필드 **64→61**, RenderSemantics **49→46**을 관찰했다. Map 수 감소를 전체 heap·할당 bytes·GC pause·native 성능 개선율로 해석하지 않는다. Flex의 두 임시 Map 제거는 source 구조상 변경이며 이 21개 child Map 집계와 별개다.
- **후속 병목 우선순위:** 아직 같은 관계를 재검증하는 `setChildren`/render sync, inherited index 복사, 반복 text/style snapshot·font catalog key, frame command freeze를 검토한다. 기존 dirty ancestor 차단·singleton projection·text snapshot 공유는 이미 있으므로 없는 기능처럼 다시 만들지 않는다. 임의의 사용자 getter/iterator/toJSON·State/ParentData 의미를 생략하거나 wrapper를 무조건 합치는 변경은 하지 않는다. 현재 판단은 작은 독립 owner 개선부터 적용하고, 일반 layout 알고리즘 전면 교체는 실제 중복이 확인된 범위로 제한하는 것이다.

**Native 실행 정리와 미수락 근거.** B 후보 legacy 별도 진단은 bytecode/AOT 각각 10구간 runtime·진단 qualification을 통과했다. AOT attribution 출력 일부가 도구 전송에서 잘려 전체 PC sidecar를 보유하지 못했으므로 완전한 PC 합계는 주장하지 않는다. 이후 bounded/observed-budget 진단은 bytecode **2,880→2,892px**, AOT **2,880→2,928px**의 입력 거리 불일치로 각각 exit 8이었다. 완료된 구간의 예산·재사용 관찰을 전체 정책 수락으로 확대하지 않는다. 정규 B viewport 차이는 primary 2560×1600/DPI192와 secondary 1920×1080/DPI120의 배치 차이로 확인했고, source에 명시적인 monitor 선택·실제 조건 비교를 추가했다. 이 native 배치 변경은 아직 runtime 검증 전이다.

사용자 우선순위 변경 시 진행 중이던 입력 원인 조사 fixture는 native 준비 단계에서 중단했다. 실행 소유 builder/process/temp/생성 entry는 정리됐고 원래 runner config bytes를 복원했다. 기존 `32204` entry 두 개와 외부 `lZr0JK` temp는 보존했다. 별도 log/receipt/과거 archive를 추가하지 않는다.

**현재 C 공급:** Core를 재빌드하고 Core만 pack/runner에 offline 설치했다. source **624개**·dist **2,496개**·package.json을 합한 **3,121개 파일 전부 설치본과 일치**, 경로+SHA-256 digest는 **`08264dd5fe01ff3c65b204be364057a9e53a6ce6a91d83434a6830a6be0b1b99`**다. 현재 Core archive는 **`nelyx-core-0.16.0-882cdb782c79a86d59cdc11ede3dea8c2f97991376c12f84a89f8e3443f83a57.tgz`**(16,211,781 bytes) 하나만 남는다. gallery 제품 6개 source는 기준선과 일치한다. 위 B 후보의 native identity·coverage는 이 C 공급의 실행 근거가 아니다. 최신 C 공개 Release 앱의 기본 빌드·시작·종료 확인은 §8.5에 추가했으며 native 성능 수락은 아직 없다.

**현재 다음 작업:** 위 공통 구조 개선을 우선한다. G6 전 gallery 제품 6개 source/cache 상한은 유지한다. 성능은 여전히 `performanceAccepted=false`, 두 모드 G6·공개 Release 앱·V8/JSC/Web·실제 표시/physical 입력 수락은 남아 있다. 이 절의 CPU 구조 관찰을 W16 전체 완료로 표현하지 않는다.

### 8.5 Static Hermes 실행 스크립트의 빈 환경 변수 수정 (2026-10-24 KST)

- 사용자 기본 명령의 `NELYX_ACCESSIBILITY_ENABLED must be true or false`를 조사했다. PowerShell **7.6.7**에서 없던 값을 `[Environment]::SetEnvironmentVariable(..., $null, 'Process')`로 복원하면 null이 빈 문자열로 변환되어 변수가 실제로 남는 것을 재현했다. 다음 실행의 CLI는 이 빈 값을 유효하지 않은 설정으로 거부했다.
- `start-windows-static-aot.ps1`은 기존 변수가 없거나 비어 있으면 실행 전 정리하고 `finally`에서도 `Remove-Item Env:...`으로 실제 삭제한다. 명시적인 `true/false`와 `-DisableAccessibility`의 임시 override·실패 시 복원은 유지한다. CLI의 잘못된 값 검사는 완화하지 않는다. 이 스크립트 수정에는 Core/SDK 재공급이 필요 없다.
- PowerShell/CLI 회귀 **2 PASS**. 같은 세션의 기본 Static Hermes 명령 2회·기존 빈 값·옵션 실행 반복·명시적 true/false·실패 후 환경/작업 디렉터리 복원 등 9개 시나리오를 확인했다. 임시 fake runner·호출 기록은 finally에서 삭제했다. 사용법은 기존 한/영 README에 반영했다.
- 최신 C Core를 설치한 기본 명령의 실제 **Release build/package·앱 시작·정상 종료 PASS / 전체 명령 exit 0**. packaged EXE에서 `NelyxTestbed2` 창의 HWND와 `Responding=True`를 확인하고 정상 close했다. 검증용 앱·컴파일러·임시 C/object·cache lock은 남지 않았다. 최신 앱 unit의 native 재컴파일은 약 **431.875s**, AOT build 전체는 **472.220s**였다. 이번 환경 변수 수정의 회귀 근거는 앞의 PowerShell 검사이며, native 실행은 최신 Core 앱의 기본 시작 범위다. 성능 matrix·전체 gallery/IME·물리 표시 수락은 아니다.
- C 공개 앱 identity: Metro source **`fd453fc9b5906dd484e3a8c2d1031b7670e64aa792faa9d15345fb3272e137b9`**, AOT DLL **`20207cef8649fd55ff7d36bafb5c228ff9a742b70fc7dba324a2965b0c564390`**, EXE **`5465504fc52c51fbdca30f18b3fd56ac6f1258f19f24ca8174d98340589e398a`**. VM **`c6e57ac68ad43a6073c3e159efbf273197f6b41a297c8b75c9fc1364202a9d5c`**, 기존 toolchain/type policy를 유지하며 native PC 함수 범위는 **42,921개**다. SDK/Core 재공급 없이 수정한 스크립트의 기존 기본 명령을 다시 사용할 수 있다.
### 8.6 Nelyx 이름 변경 (2026-10-24 KST)

- 제품 소스·문서·패키지 scope·CLI·설정 키·환경변수·네이티브 클래스/파일/디렉터리를 Nelyx 이름으로 전환했다. SDK는 `Nelyx/`, 샘플은 `sample/nelyx-testbed-app-2/`, 패키지는 `@nelyx/*`, CLI·앱 설정은 `nelyx`, 환경변수는 `NELYX_*`, 앱 공급 경로는 `.nelyx/`를 사용한다.
- 사용자의 후속 지시에 따라 호환 유지 방침을 폐기했다. CanvasKit·JSI paragraph 심볼, runtime/source/build schema, build marker·출력 경로·job 환경변수도 모두 Nelyx로 바꿨다. 고정된 원본 5개 파일의 before hash와 패치 적용을 검증하고 변경된 2개 파일의 after hash 및 patch/lock identity를 갱신했다.
- 초기 이름 변경 검증(호환 삭제 전): Core·Cupertino·Material·contracts·Skia RN/Web·SDK 패키지 빌드, 9 workspace/CLI/Metro 타입 검사, package boundary 검사 PASS. 앱 구성·생성/러너 공급·launcher 검사 12개와 새 패키지 설치 후 Hermes/V8/JSC Babel 검사 9개 PASS, 공통 scroll/engine 회귀 133/133 PASS.
- 초기 Web 정적 빌드 PASS는 호환 삭제 전의 증거다. 기존 CanvasKit WASM·Web 출력·Web 공급 archive·Web SDK 설치본을 제거했고 현재 runtime manifest는 `requires-build` / files 없음이다. 새 source build 후 `prepare-web-runtime.mjs <built-runtime-directory> --adopt`로 공급해야 Web prepare/build를 재개할 수 있다. 이전 바이너리의 해시를 새 빌드 결과로 사용하지 않는다.
- 호환 삭제 후 Skia RN/Web·SDK 패키지 재빌드, 9 workspace·Metro 타입 검사 및 `test:web-runtime-supply` 3/3 PASS. pending runtime, 오래된 source-build receipt, 다른 runtime cohort와 변조된 파일을 거절하는지 확인했다. Windows·Android의 SDK/Skia RN/Metro를 다시 공급하고 세 패키지를 새로 설치해 실제 파일 bytes와 공급 archive identity의 일치를 확인했다. native 앱·새 WASM의 컴파일/실행은 이번 검증에 포함하지 않았다.
- 초기 디자인 검사 258개 중 248 PASS / 10 FAIL: 9개는 paragraph cache 보존 이후 문단 개수 기대값, 1개는 Zoom 전환의 `liveImages` 기대값 불일치다. 별도 엔진/전환 수정은 하지 않았다. 새 WASM 공급 전에는 이를 재실행하지 않는다. 검사에서 생성한 CPU 이미지·JSON 및 공급 staging은 정리했다.
- 이 절 위의 native 실행·hash·성능 기록은 이름 변경 전의 증거다. 문서의 경로·명칭 치환을 새 Nelyx native 실행 검증으로 해석하지 않는다. 이름 변경으로 source/package identity가 달라졌으므로 native 재개 시 새 공급으로 다시 검증해야 한다. W16의 PARTIAL 및 `performanceAccepted=false`는 유지한다.
