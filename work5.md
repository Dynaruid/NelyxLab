# Hermes 성능 개선 전체 작업계획서 — 분할 생산부터 제품 검증까지

작성일: 2026-11-17

상태: **계획 작성 완료 / S0 동기 control만 구현·검증 / 세대 격리·분할 생산 미구현 / PARTIAL / performanceAccepted=false**

기준: HEAD `046f93d8`와 현재 미커밋 변경. [work3](work3.md)의 선별·실행 기록, [work4 §10](work4.md#10-큰-구조-변경-검토--분할-생산과-원자적-게시)의 구조안과 [§11](work4.md#11-s0-착수--실제-runtime-계약과-준비-프레임-자격-검사)의 S0 구현을 이어받는다. 이 문서는 **현재 남은 작업 전체의 실행·검증·중단·인계 계획**이며, 이후 단계가 이미 구현되거나 승인됐다는 뜻이 아니다.

## 1. 목표와 완료의 정의

### 최종 목표

Hermes bytecode를 유지하면서 달력의 새 월·날짜 subtree 생산이 한 프레임에 몰리는 긴 동기 구간을 줄인다. 공통 framework에 명시적 opt-in 경계를 만들고, **생산을 나누되 미완성 콘텐츠는 입력·paint·접근성에 노출하지 않는다.**

완료는 다음 세 가지를 구분한다.

| 구분 | 완료 조건 |
| --- | --- |
| 구현 완료 | 세대 격리, build/layout continuation, 일관된 CPU 게시, 공통 PageView와 중첩 날짜 grid 연결이 실제 실행됨. 선언·fake scheduler·token 검사만으로 완료하지 않음 |
| 기능 수락 | 수명·GlobalKey·입력·focus·IME·semantics·회수 계약과 기존 경로의 회귀가 통과함 |
| 성능 수락 | 같은 조건의 기준선/후보 비교에서 §9의 FPS·정체·지연·자원 기준을 모두 통과함 |

구현이나 일부 기능 검증만 끝나면 `performanceAccepted=false`를 유지한다. 성능이 불확실하거나 목표에 미달하면 **미달 또는 PARTIAL로 종료**하며 완료 표현으로 바꾸지 않는다.

### 범위에서 제외

- JSC/V8 전환, 새 엔진 비교, VM getter/descriptor patch, 전체 AOT 전환.
- 모든 월 keep-alive, dormant 자격 완화, cache 용량 확대를 주력 해법으로 대체하는 작업.
- 입력 폐기·월 이동량 축소·날짜별 Focus/Ink/Semantics 제거, 스크롤 감속으로 성능 수치 맞추기.
- native가 과거 화면만 이동하는 독립 스크롤, 전체 Element/State 트리 복제.
- Android/Apple의 성능·배포 수락을 Windows 결과로 대신하는 것.

## 2. 실제 시작 상태

| 항목 | 현재 상태 | 이번 계획에서의 취급 |
| --- | --- | --- |
| WidgetState 집합·descriptor·getter·형제 충돌 인덱스 | 기존 선별에서 보류 | 같은 실험을 다시 시작하지 않음 |
| [준비 프레임 자격 검사](Nelyx/src/framework/widgets/root.ts) | 원래 token과 View/input scope 검사 추가, Source 검증 PASS | 보존하되 성능 개선이나 세대 격리로 계산하지 않음 |
| [게시 통합 fixture](Nelyx/eng/check-frame-publication.mjs) | 실제 AppSession/FrameworkRoot, local clock/renderer의 동기 control PASS | 분할 실행의 비교 control로 확장 |
| 준비 중/게시 중 tree의 분리 | 미구현 | 첫 기술 gate |
| build·layout 분할, 달력 opt-in | 미구현 | 실제 구현 대상 |
| 최신 Source의 Hermes 공급·실행 | 직전 S0 변경은 dist/설치본에 미공급 | 새 공급 identity를 확인한 뒤 실제 VM 검증 |
| 새 구조의 FPS·자원 비교 | 미실행 | 기능 수락 후 측정 |

기존 [root 수정](Nelyx/src/framework/widgets/root.ts), [통합 fixture](Nelyx/eng/check-frame-publication.mjs), [work3](work3.md)·[work4](work4.md)의 미커밋 변경을 보존한다. 과거 일반 binary 실행과 FPS를 변경 Source의 결과로 인용하지 않는다.

## 3. 구현 전에 확정할 행동 계약

아래는 **권고안이며 아직 사용자 승인된 새 동작이 아니다.** 계획 작성 자체를 lifecycle·입력 UX 변경 승인으로 간주하지 않는다. 후속 구현 시작 시 이 항목들을 한 번에 확인하고, 승인된 범위 안에서는 단계마다 같은 질문을 반복하지 않는다.

| 결정 | 첫 버전 권고안 | 승인·확인이 필요한 이유 |
| --- | --- | --- |
| 적용 방식 | 기본은 기존 동기 경로, 새 경계에만 명시적 opt-in | 기존 앱의 수명·builder 호출 시점을 바꾸지 않기 위함 |
| 선행 lifecycle | 새 콘텐츠의 init/build가 표시 전에 실행될 수 있음. 취소 시 실제 생성분을 한 번 회수 | callback 부수 효과는 rollback할 수 없음 |
| 준비 중 입력·focus | 미게시 subtree는 hit test·semantics·focus 획득·framework ticker 활성화 대상에서 제외 | mounted 상태와 사용자에게 게시된 상태가 달라짐 |
| coverage 밖 필수 요구 | 무제한 입력 대기 대신, 같은 continuation의 남은 작업을 기존 동기 계약에 맞게 완결하는 fallback을 우선 검토 | FPS를 위해 새로운 입력 지연 정책을 숨기지 않음. fallback 비용도 후보 성능에 포함 |
| GlobalKey | 게시 subtree의 State/GlobalKey를 준비 작업이 retake하지 않음. 새 준비 콘텐츠의 key 조회·예약 노출 시점은 명시적으로 정의 | 달력 내부 key도 예외로 취급할 수 없음 |
| 실험 채택 | 성능 통과 시에도 우선 opt-in. 기본 활성화는 별도 결정 | 실험 수락과 기존 UX 변경은 다른 결정 |

승인이 없으면 영향을 받는 제품 동작은 연결하지 않는다. 독립적으로 가능한 기존 경로 검증과 내부 prototype까지만 진행하며, 이를 전체 구현 완료로 보고하지 않는다.

## 4. 구현할 구조와 불변식

### 4.1 첫 구조 후보

**기존 게시 subtree는 그대로 유지하고, 새로 필요한 콘텐츠만 준비 전용 경계에서 생산한다.** 첫 적용은 재사용 중인 State 전체의 speculative update가 아니라 cold 콘텐츠의 제한된 선행 생산이다. 따라서 기존 월 rebuild·퇴역 비용이 자동으로 없어지지는 않는다.

첫 검토안은 [기존 canonical owner](Nelyx/src/framework/widgets/framework.ts)를 유지하면서 경계 전용 BuildScope와 준비/게시 render 연결을 구분하는 방식이다. owner transfer나 두 벌의 전체 앱을 전제로 시작하지 않는다. 다만 scope를 따로 만드는 것만으로 GlobalKey·Focus·inherited 의존성·render owner transaction까지 격리됐다고 가정하지 않는다. **P1에서 이 표현이 안전하지 않으면 그대로 제품에 연결하지 않고 구조 결정을 다시 내린다.**

준비 대상의 자격은 명시적 계약으로 닫는다. arbitrary callback을 먼저 실행하거나 subtree를 만든 뒤 “지원하지 않으니 처음부터 legacy로 재실행”하는 방식을 금지한다. 외부 관측 이후의 실패는 실패·취소 경로로 처리한다.

### 4.2 소유권

| owner | 맡을 상태 | 하지 않을 일 |
| --- | --- | --- |
| View runtime | frame timing, 입력 전달, pending CPU frame, renderer credit와 lease | 일반 scene에 Promise를 허용한 것만으로 분할 완료 처리 |
| 준비 경계 | 준비 세대 1개, 작업 cursor, 새 subtree·임시 자원, 취소/승격 | 게시 subtree를 tick 사이에 부분 변경, 기존 State 복제 |
| 게시 경계 | paint·입력 geometry·semantics와 실제 target 수명의 일관된 CPU scope | GPU 수락·화면 표시까지 동시에 완료됐다고 주장 |
| 기존 BuildOwner/PipelineOwner | canonical 수명·정렬·의존성·render/semantics 규칙 | 준비 작업을 일반 dirty flush가 실수로 끝까지 비우는 것 |
| 기존 resource owner | producer·caller·renderer hold의 실제 획득·반환 | snapshot 보관으로 retirement를 무기한 미루는 것 |

View당 준비 세대는 첫 버전에서 최대 1개로 시작한다. Element·자원 상한은 P0에서 명시적으로 정하고, [기존 View 예산](Nelyx/src/framework/widgets/view-work-budget.ts)과 혼합 사용한 총량을 계산한다. 기존 optional 2,048 Element 상한이 준비 작업까지 자동으로 보장한다고 쓰지 않는다. byte accounting이 다루지 못하는 JS heap은 별도 관측한다.

### 4.3 실행 흐름

`요구 확정 → 준비 → 대기/재개 → coverage 완료 → CPU seal·게시 → GPU admission → 실제 회수`

- callback·개별 layout은 원자 작업이다. 작업 사이에서만 yield하고, 재개 cursor로 이미 실행한 callback을 중복 실행하지 않는다.
- 데이터·metrics·renderer 세대 변경과 단순 스크롤 위치 변경을 구분한다. 입력 packet마다 준비를 무조건 취소해 starvation을 만들지 않는다.
- 유효 coverage를 재사용할 수 있어도 과거 frame의 input token을 새 값으로 덮어써 제출하지 않는다. 현재 입력을 반영한 새 CPU frame의 seal·scope 검증을 거친다.
- 새 down은 게시된 유효 target으로 처리한다. 기존 stream은 살아 있는 원래 target/transform 계약을 유지하고, target 교체·회수 시 기존 cancel/skip 규칙을 따른다. up을 새 콘텐츠로 재지정하지 않는다.
- deadline이 없으면 선택 준비를 시작하지 않는다. 필수 입력 geometry query는 GPU credit 부족 때문에 무기한 대기시키지 않는다.
- 취소·오류·route 제거·hide·resize·renderer 교체·close도 정상 종료와 같은 수준으로 자원과 예약 작업을 회수한다.

## 5. 전체 단계와 의존성

| 단계 | 기존 계획 대응 | 선행 조건 | 주요 산출물 | 완료 gate |
| --- | --- | --- | --- | --- |
| P0 계약·실행 기준 확정 | S0 잔여 준비 | 현재 S0 control | §3 결정, 상한·identity·검증 범위 확정 | 바꿀 UX와 보존할 관측이 명확함 |
| P1 준비/게시 세대 격리 | S0 핵심 | P0 | 실제 준비 경계, owner·key·focus·target 수명 표현 | yield 경계에서 게시 tree가 변하지 않음 |
| P2 build continuation | S1 전반 | P1 | 재개 가능한 dirty 생산과 commit 경계 | callback 중복·작업 누락·재진입 혼선 0 |
| P3 layout-time 생산 분할 | S1 후반 | P2 | fixed-extent와 nested grid의 demand/continuation | 실제 날짜 생산의 긴 원자 묶음이 분할됨 |
| P4 runtime·입력·원자적 CPU 게시 | S2 | P1, P3 | pending/ready/failure 연결, seal·게시·lease 통합 | 미완성 콘텐츠 게시 0, 강제 query/close 계약 유지 |
| P5 공통 PageView·달력 opt-in | S3 전반 | P3, P4 | 공통 전달 경로, 실제 월·날짜 경로 적용 | shell만이 아닌 nested grid까지 후보 경로 실행 |
| P6 기능·자원·공급 예행 | S3 후반 | P5 | 실제 Hermes 검증, Web·관련 공통 회귀, 비용 진단 | 기능 및 자원 gate 통과 |
| P7 기준선/후보 제품 비교 | S4 | P6 | 현재 공급의 각 3회 비교와 판정 | §9 전체 기준 통과 여부 확정 |
| P8 최종 공급·복원·인계 | 최종 종료 | P7 판정 | 채택/미채택 최종 출력, 정리, 사용·제약 기록 | 현재 output과 최종 판정이 일치함 |

정상 critical path는 **P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8**이다. 어느 단계에서 중단돼도 P8의 안전한 복원·정리는 수행한다. 독립된 읽기·검사는 병렬화할 수 있지만, 같은 dist·설치본·native window·공급을 바꾸는 작업은 직렬 실행한다.

## 6. 단계별 구현 작업

### P0 — 계약과 비교 기준

1. 현재 S0 fixture·Source/retained paint 회귀·타입 검사를 control로 확인한다. 이미 통과한 결과를 이유 없이 반복하지 않는다.
2. §3의 행동 계약과 View당 준비 개수·Element·자원 상한을 확정한다. 기존 정책과 중복 계산하지 않는다.
3. opt-in의 범위와 stock/custom 경계를 정한다. 필요한 공개 API·옵션 명칭은 구현 시 확정하고 양 경로의 기본값을 문서화한다. 현재 `childPolicy`에 새 모드가 이미 있다고 가정하지 않는다.
4. 현재 Source, dist, 설치 package, VM/host/renderer identity와 실제 engine/mode를 확인한다. 필요한 공급 갱신과 새 성능 측정의 시점을 분리한다.

**산출물:** 승인/보류된 계약 표, 정확한 변경 범위와 control. 불명확한 lifecycle·입력 정책을 코드에 먼저 넣지 않는다.

### P1 — 격리 자체를 먼저 구현

대상: [framework](Nelyx/src/framework/widgets/framework.ts), [root](Nelyx/src/framework/widgets/root.ts), [render owner](Nelyx/src/framework/rendering/object.ts), [GlobalKey](Nelyx/src/framework/widgets/global-key.ts), [Focus](Nelyx/src/framework/widgets/focus.ts), [resources](Nelyx/src/hosting/resources.ts).

- 새 subtree의 준비 전용 BuildScope·render 연결과 취소/승격 소유권을 구현한다. 기존 게시 subtree의 owner·parent/slot·State는 준비 때문에 바뀌지 않아야 한다.
- GlobalKey 중복/retake, inherited 조회·변경, focus 요청과 ticker 시작, owner transaction의 적용 범위를 실제 코드에서 검증한다. private 선언이나 같은 prototype만으로 자격을 증명하지 않는다.
- 임의 사용자 timer·구독의 자동 정지나 callback 부수 효과의 rollback을 약속하지 않는다. 준비 중 시작한 외부 작업의 취소 책임도 opt-in 계약에 포함한다.
- “준비 중 한 번 반환 → 게시 tree로 입력/조회 → 다시 준비”를 실제 객체와 통합 fixture로 실행한다. snapshot JSON만 비교하지 않고 live target·parent data·예약·lease도 확인한다.
- 준비 시작 전, 중간 취소, ready 직전, 승격 중 예외, close 재진입에서 한 번만 회수되는지 확인한다. 전역 cache나 과거 세대 목록을 만들지 않는다.

**Gate:** 게시 경로를 안정적으로 유지할 표현을 증명하지 못하면 P2를 제품에 연결하지 않는다. control 검증만 늘려 격리 완료라고 하지 않는다.

### P2 — build 작업을 실제로 재개 가능하게 만들기

대상: [BuildScope/BuildOwner](Nelyx/src/framework/widgets/framework.ts), [기존 work budget](Nelyx/src/framework/widgets/view-work-budget.ts).

- 기존 동기 flush는 보존하고, 승인된 준비 scope에만 명시적 pending/ready/failure 결과와 cursor를 연결한다.
- depth 순서, 새 dirty ancestor, State callback, GlobalKey 예약, render children commit의 순서를 유지한다. 준비가 pending인 동안 일반 flush·finalize가 이를 완성/폐기하지 않게 한다.
- atomic 작업 사이에 실제 clock과 관측 deadline을 확인한다. 첫 실험의 선택 작업 slice 목표는 기존 준비 한도를 참고한 **2ms 이하의 soft budget**으로 두되, 단일 callback의 초과를 숨기거나 선점 가능하다고 주장하지 않는다.
- 남은 작업이 있고 실행 가능한 다음 host 기회가 오면 재개한다. paused scope의 누락, 같은 tick의 무한 drain, 불가능한 작업의 busy polling을 막는다.

**Gate:** 1회 동기 control과 여러 yield 위치의 결과·callback 순서·오류 객체가 승인된 차이 외에는 같고, 완료/취소의 task·예약·lease 잔여가 0이어야 한다.

### P3 — layout 안의 자식 생산까지 분할

대상: [sliver child manager](Nelyx/src/framework/widgets/sliver.ts), [fixed extent layout](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts), [grid layout](Nelyx/src/framework/rendering/sliver-grid.ts), [adaptor](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts).

- 자식 index·predecessor·constraints·parent data·현재 순회 위치를 명시적 continuation 상태로 만든다. 필요한 자식이 pending이면 부모도 미완료 상태를 이해해야 한다.
- delegate/build/mount와 해당 layout 완료를 구분하고, 자식 완성 전 geometry 사용·잘못된 underflow/garbage collection을 막는다.
- 달력의 중첩 grid까지 같은 준비 경계와 예산을 전달한다. 사용자 grid delegate·LayoutBuilder·paint transform 등 외부 callback의 관측을 반복하지 않는다.
- 지원하지 않는 경로는 관측 전에 legacy로 보낸다. 실행을 시작한 뒤에는 이미 생산한 상태를 재사용해 완결하거나 명시적으로 실패/취소하며 처음부터 재실행하지 않는다.

**Gate:** outer Widget shell만 잘게 만들고 날짜 생산이 layout 한 번에 남으면 실패다. 각 atomic 작업과 slice의 최장, 준비 완료까지의 tick 수, 필수 동기 fallback 비용을 함께 기록한다.

### P4 — runtime, 입력, 게시와 backpressure 통합

대상: [ViewRuntime](Nelyx/src/hosting/runtime.ts), [FrameworkRoot](Nelyx/src/framework/widgets/root.ts), [FrameRecording](Nelyx/src/ui/frame.ts), [input geometry](Nelyx/src/hosting/input-geometry.ts), [semantics transport](Nelyx/src/framework/rendering/semantics-transport.ts), [gesture binding](Nelyx/src/framework/gestures/binding.ts).

- 준비의 pending/ready/failure를 scene의 동기 반환 및 pending CPU frame 수명과 연결한다. 반환 타입에 Promise만 추가하지 않는다.
- ready coverage와 owner·content·metrics·renderer·input scope를 검증하고 seal 이후 CPU 게시를 수행한다. geometry·semantics host callback의 재진입 close/resize/오류도 처리한다.
- GPU busy 중에는 기존 pending frame·lease 정책을 유지한다. 강제 IME/입력 geometry 요청은 현재 동기 control에 맞게 처리하고, 준비 중 generation을 완성된 recording으로 취급하지 않는다.
- 기존 contact의 target/transform, 새 down·wheel·trackpad·key·IME·접근성 action을 구분한다. native 수신/JS 전달/최종 적용·거부를 따로 집계한다.
- 사용자 host callback 여러 개를 하나의 DB transaction처럼 rollback할 수 있다고 가정하지 않는다. 실패 시 이미 공개한 geometry의 철회/무효화, 이후 단계 차단과 frame 자원 회수를 검증한다.

**Gate:** 임의 yield 위치에서 잘못된 target·부분 geometry·미완성 semantics 게시 0. pending/credit/forced frame/close 조합을 실제 pinned Hermes에서도 확인한다.

### P5 — 공통 전달과 실제 달력 연결

대상: [PageView](Nelyx/src/framework/widgets/page-view.ts), [SliverFillViewport](Nelyx/src/framework/widgets/sliver-fill.ts), [sliver policy](Nelyx/src/framework/widgets/sliver.ts), [날짜 picker의 생성 소유 코드](packages/material/src/generated/date/calendar_date_picker.generated.ts).

- 공통 옵션 전달, 허용 검사, default legacy 동작을 일관되게 연결한다. `allowImplicitScrolling`이나 cache extent 변경을 새 준비 정책의 대체 스위치로 쓰지 않는다.
- 실제 달력의 cold 월·기존 월 rebuild·빠른 역방향과 부분 노출된 두 페이지를 분리해 확인한다. 후보 경로 참여율과 동기 fallback 사유/비용을 보고한다.
- 날짜 선택, disabled 날짜, locale/Theme/범위 변경, focus 이동, 월 정착과 callback 순서를 검증한다. 준비 중 설정 변경과 방향 반전을 포함한다.
- 생성 소스 변경이 필요하면 [변환기·생성 소유권 규칙](tools/Nelyx.FrameworkToTypeScript/README.md)에 따라 소유 입력/adapter·관련 검증을 함께 갱신한다. 달력만 수동 복제한 fast path를 만들지 않는다.

**Gate:** 실제 날짜 생산이 후보 경로를 사용해야 한다. 전부 legacy fallback인 실행, 빈 페이지·반응 없는 임시 화면을 성공으로 세지 않는다.

### P6 — 기능·자원·실제 공급 예행

- 현재 Source를 정규 빌드하고 필요한 package만 공급한다. 순수 Node control, 실제 pinned Hermes, 관련 Web 경로의 결과를 구분한다.
- §8의 기능 matrix를 실행하고 준비 전/중/후 입력·close·resize·route 변경을 확인한다.
- 짧은 양방향 왕복 후 준비 Element·State·FocusNode·key 예약·resource hold·작업 큐가 잔류하지 않는지 확인한다. GC 시점 차이와 지속 누적을 구분한다.
- 진단 1회, 경계 보완이 꼭 필요하면 1회만 추가한다. slice 최장, 원자 callback 초과, coverage 대기, 취소 낭비, commit/retirement tail을 관측한다. 매 작은 helper를 timer로 감싸지 않는다.

**Gate:** 부분 실행을 실제로 나눴어도 commit·취소·회수에 같은 긴 작업이 이동했거나 자원/입력 회귀가 있으면 P7로 확대하지 않고 수정 또는 중단한다.

### P7 — 같은 조건의 제품 비교

- P6에서 검증한 동일 Source·공급에 control/candidate 선택을 연결한다. 해당 선택 기능은 P0~P5에서 구현할 대상이며 현재 CLI에 존재한다고 가정하지 않는다.
- 동일 VM·renderer·입력·viewport로 기준선 3회와 후보 3회를 측정한다. 명시적 실험 선택으로 교차 실행할 수 있으면 실행 순서를 사전 고정하고, 그렇지 않으면 정규 공급을 직렬 교체하며 의도한 차이를 기록한다.
- CPU/build/heap 진단을 끈다. 진단 FPS, 과거 binary의 FPS 또는 더 작은 창의 실행을 비교 표본으로 섞지 않는다.
- §9 기준으로 수락/미달/불확실을 판정한다. 실패 표본·환경 실패와 이유를 남기고 유리한 재실행만 선택하지 않는다.

### P8 — 최종 공급과 인계

- 수락 시에도 첫 제공은 승인된 opt-in 범위로 한정한다. 기본 활성화는 별도 승인이 없으면 하지 않는다.
- 미수락 시 기본은 동기 경로로 유지하고, 원인이 된 실험 공급/선택을 복원한다. 실패 후보 코드를 남길 필요가 없다면 그 후보 변경만 회수하고 기존 S0/사용자 변경은 보존한다.
- 최종 Source·dist·설치 package·prepared input·VM/renderer/host identity를 확인하고 일반 첫 프레임·정상 종료를 검증한다. 일반 공급에 진단 entry/profile flag가 남지 않아야 한다.
- 이 문서에 결과 표·변경 파일·선택 방법·검증 범위·미검증 항목·최종 판정을 추가한다. 후속 기능 없이는 사용할 수 없는 scaffolding을 완제품으로 인계하지 않는다.

## 7. fallback·무효화·실패 처리표

| 발생 시점/사건 | 처리 원칙 |
| --- | --- |
| 첫 observable callback 전의 미지원 경로 | 기존 동기 경로. 추가 getter/Proxy trap으로 관측을 바꾸지 않음 |
| 준비 중 단순 시간 부족 | 동일 세대와 cursor를 유지하고 재개. 완료된 init/build를 다시 호출하지 않음 |
| coverage 밖 필수 입력·강제 geometry | 승인된 정책에 따라 같은 continuation을 완결. 무제한 대기·별도 중복 subtree 생성 금지 |
| 준비 중 데이터/metrics/renderer 무효화 | 미게시 작업을 명시적으로 취소·회수하고 최신 세대 요구로 재계획. 부수 효과 취소를 약속하지 않음 |
| 준비 중 기존 GlobalKey retake·소유 위반 | 기존 owner를 훔치지 않고 명시적 오류. 실행한 lifecycle을 숨긴 legacy 재시작 금지 |
| 사용자 callback/host publish 오류 | 원래 오류와 실행 순서 보존, 이후 게시 차단, 가능한 geometry 철회와 자원 회수. 빈 성공 반환 금지 |
| route 제거·hide·close | 새 작업·입력 admission 중지, 준비/예약/target·lease 회수. 필요한 기존 cancel/retirement 순서 보존 |
| 성능 목표 미달·기술 gate 실패 | 그 이유와 영향 구간을 기록하고 기본 채택하지 않음. 다른 엔진/cache/AOT 프로젝트로 자동 확대하지 않음 |

## 8. 기능 검증 matrix와 기존 실행기

| 범위 | 최소 사례 | 주요 실행기/확장 위치 |
| --- | --- | --- |
| 게시/입력/수명 | 정상 token 복사, 다른 owner/input 세대, 모든 yield 경계, 재진입 close·resize, pointer target 교체 | [frame publication fixture](Nelyx/eng/check-frame-publication.mjs) 확장 |
| build/조정/의존성 | dirty ancestor, 중복 key, retake 금지, inherited 갱신, 예외·취소 후 회수 | [Source framework](Nelyx/eng/check-source-framework.mjs), [child reconciliation](Nelyx/eng/check-child-reconciliation.mjs), [dependency scope](Nelyx/eng/check-dependency-scope.mjs) |
| layout/paint | fixed extent, nested grid, partial coverage, custom delegate fallback, retained boundary·회수 | [Source framework](Nelyx/eng/check-source-framework.mjs), [retained paint](Nelyx/eng/check-retained-paint.mjs) |
| 플랫폼 입력/접근성 | touch·wheel/trackpad, keyboard·IME, focus·semantics action·UIA·geometry | [Windows input](Nelyx/eng/check-windows-input.mjs), [jank scenario](Nelyx/eng/check-windows-jank.ps1) 및 필요한 직접 기능 확인 |
| 공통 화면 | 달력·버튼/Ink·편집·Gallery·가변 목록·Testbed, legacy와 opt-in | [jank runner](Nelyx/eng/check-windows-jank.mjs), 기존 관련 Source fixture |
| Web | legacy 회귀, 새 경계가 노출된다면 opt-in의 게시·입력·close | [Source Web](Nelyx/eng/check-source-web.mjs) 및 필요한 browser 검증 |
| 공급/코드 품질 | 현재 Source 입력, package inventory, 준비 입력, 일반 시작·종료, 변경 scope 타입·lint | [package build](Nelyx/eng/build-packages.mjs), [sample prepare](Nelyx/eng/prepare-sample.mjs), [sample runner](Nelyx/eng/run-sample-windows.mjs), [workspace scripts](package.json) |

위 matrix는 **앞으로 실행할 범위**다. 기존 S0 통과를 실제 Hermes·IME·물리 trackpad·screen reader 전체 수락으로 확대하지 않는다. 장치가 없으면 물리/보조기술 검증은 미검증으로 남기고, 필요한 수락을 배포 가능이라고 표시하지 않는다.

새 테스트는 이번 분할/격리/게시 동작과 그 회귀에 집중해 기존 fixture를 확장한다. 일반 언어 동작·상수·trivial accessor 테스트나 별도 대형 감사 체계를 만들지 않는다.

## 9. 제품 성능 수락 기준

### 고정 조건

- Windows Demo, **Hermes bytecode + TDZ pruning off**, 동일 일반 VM·renderer·host toolchain.
- 같은 viewport·DPI·refresh와 foreground 조건. 기존 최대화 환경을 재현하지 못하면 과거 값과 혼합하지 말고 새 조건의 control/candidate를 모두 측정한다.
- 기존 달력 60Hz touch **48/30/60개**, gesture **6/6/12회**, 월 이동 **+4/+3/−6**을 유지한다.
- 기준선/후보의 의도한 Source/선택 차이, bundle/host·VM·renderer 및 설치 package identity를 구분해 기록한다.

| 기준 | 수락 조건 |
| --- | --- |
| FPS | 유효 후보 3회 **각각**, 보통 정방향·빠른 정방향·역방향 **모두**, engine FPS와 표시 FPS 관측 하한 **각각 30 이상** |
| 표시 정체 | phase별 ≥100ms 정체의 3회 중앙값에서 횟수·최장 비증가. baseline에 정체가 있으면 총 시간 감소, baseline 0이면 0 유지 |
| 입력 | 수신=전달=수락, 거부 0 및 기존 주입·이동량 보존. 입력→surface p95의 phase별 중앙값 비악화. p50/p99/최장·queue delay도 함께 보고 |
| 실제 분할 | 긴 생산 묶음이 실제 분할됐는지 확인. 원자 callback·승격·회수 tail, coverage 대기와 동기 fallback을 제외한 FPS만 제출하지 않음 |
| 자원 | 정한 준비 개수·Element·resource 상한 준수. 짧은 왕복/취소/close 후 지속적인 누적·미회수 없음. 평균 메모리만으로 누수 판정하지 않음 |
| 기능 | 월 정착·날짜 선택·focus·접근성·입력 geometry·정상 종료 및 §8 필수 사례 통과 |

표시 FPS는 desktop marker의 관측 하한이지 실제 scanout이 아니다. CPU seal, GPU admission, fence 완료와 표시 관측은 서로 다른 사건으로 유지한다. slice가 2ms 이하라는 사실이나 비교 횟수 감소만으로 30fps·낮은 입력 지연을 수락하지 않는다.

## 10. 실행 예산·운영 규칙

### 유한한 검증 예산

테스트·검증 batch는 모두 **20분 timeout**이다. timeout은 정상 완료·성능 FAIL로 바꾸지 않고 중단으로 기록한다. 긴 작업은 유한한 단위로 나누고, 동일 실패를 통과할 때까지 반복하지 않는다.

| 전체 시나리오 실행 | 계획 상한 |
| --- | --- |
| 실제 native 기본 경계/일반 실행 | 2회 |
| 진단 | 2회 |
| 달력 기준선/후보 | 3 + 3회 |
| Gallery·가변 목록·Testbed/boundaries 관련 확인 | 6회 |
| resize/복귀/취소/close 통합 확인 | 4회 |
| 실제 원인 수정 후 필요한 재확인 예비 | 6회 |
| 최종 일반 공급 시작·종료 | 1회 |
| 합계 | **27회, 전체 원칙상 30회 이내** |

기존 fixture의 내부 assertion 수를 native 전체 시나리오 실행 횟수와 혼동하지 않는다. fixture도 작고 결정론적으로 유지한다. 기준선/후보 일부가 무효면 무효 이유를 보존하고, 예산을 소진하면 표본 미완성으로 끝낸다. 판정 불확실성을 반복 횟수로 덮지 않는다.

### 저장·프로세스·공급

- 임시 디렉터리는 실행에 필요한 하나의 소유 범위만 사용하고 성공·실패·중단의 `finally`에서 삭제한다. 공유 환경의 다른 디렉터리·앱·IDE process를 건드리지 않는다.
- 정확히 소유한 PID와 경로만 정리한다. 광범위 process kill·root 삭제·사용자 변경 revert는 하지 않는다.
- raw 검증 로그/trace, immutable receipt, checkpoint/history JSON, 이전 archive, 별도 소비자 설치본·browser profile을 누적하지 않는다. 결과는 이 문서의 짧은 표와 판정으로 남긴다.
- 빌드는 현재 dist와 현재 공급만 남긴다. staging·교체 전 dist·`last-sdk-*`는 실행 종료에 정리하고 SDK/cache 전체 복제나 다른 드라이브 archive를 만들지 않는다.
- 필요한 manifest 변경/실제 누락 없이 dependency install·toolchain upgrade를 시작하지 않는다. 변경 package의 정규 빌드·공급에 필요한 절차만 적용한다.
- Windows에서는 npm script를 PowerShell에서 실행하거나 실제 Node entry를 사용한다. Node의 `spawn('npm.cmd', ...)` 직접 호출로 겪은 `EINVAL`을 반복하지 않는다.

## 11. 단계 종료 보고 형식과 최종 체크리스트

후속 전체 실행에서는 승인·기술 gate·재현 불가·예산 소진 같은 실제 blocker가 없으면 통과한 다음 단계를 이어서 진행한다. token 검사나 테스트 기반만 추가한 상태를 전체 성능 작업의 완료로 보고하지 않는다. 새 아이디어 문서 작성만을 반복하면서 구현 단계를 대체하지 않는다.

각 단계는 이 문서에 **변경 파일 / 실행 조건·횟수 / PASS·FAIL·미검증 / 다음 gate**를 짧게 추가한다. 구현 완료와 성능 수락을 별도 표시한다. 근거가 부족하면 그 범위를 그대로 미검증으로 남긴다.

- [ ] P0: lifecycle·coverage 밖 입력 정책과 준비/자원 상한 확정.
- [ ] P1: 실제 게시/준비 tree와 target·key·focus의 격리 검증.
- [ ] P2: 중복 callback 없이 재개 가능한 build와 안전한 owner commit.
- [ ] P3: nested 날짜 grid까지 실제 layout-time 생산 분할.
- [ ] P4: CPU seal·입력 geometry·semantics, GPU busy·forced query·close 통합.
- [ ] P5: 공통 PageView 전달과 달력 opt-in, legacy 기본 회귀 확인.
- [ ] P6: 현재 Source의 실제 Hermes·관련 Web/공통 기능·자원 수락.
- [ ] P7: 같은 조건의 기준선/후보 각 3회와 전체 수락 판정.
- [ ] P8: 최종 일반 공급 또는 안전한 복원, 임시 산출물 정리와 제약 인계.

**이 계획서 작성 시점에는 위 P0~P8이 완료되지 않았다. 현재 성능 판정은 계속 `PARTIAL / performanceAccepted=false`다.**
