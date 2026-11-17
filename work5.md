# Hermes 성능 개선 전체 작업계획서 — 분할 생산부터 제품 검증까지

작성일: 2026-11-17

상태: **§15 후속 개선 종료: 실제 Hermes 날짜 선행 생산 PASS-scoped / 필수 동기 완결 8.174ms 관측 / 일반 회귀·최종 공급·정리 완료 / 전체 성능 PARTIAL / performanceAccepted=false / 기본 legacy**

CLI 인계: **§16 개선판 수동 실행 구성·Windows 전환 검증 완료. 기본값 legacy 유지.**

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

## 3. 확정한 행동 계약

아래는 계획 작성 당시의 권고안이다. 2026-11-17의 `work5.md대로 전체작업해줘` 요청에 따라 이번 실행에서는 **명시적 opt-in 범위의 실행 계약으로 적용했다.** 기본 활성화는 포함하지 않는다. 적용한 범위와 검증 결과는 §14에 기록한다.

| 결정 | 첫 버전 권고안 | 승인·확인이 필요한 이유 |
| --- | --- | --- |
| 적용 방식 | 기본은 기존 동기 경로, 새 경계에만 명시적 opt-in | 기존 앱의 수명·builder 호출 시점을 바꾸지 않기 위함 |
| 선행 lifecycle | 새 콘텐츠의 init/build가 표시 전에 실행될 수 있음. 취소 시 실제 생성분을 한 번 회수 | callback 부수 효과는 rollback할 수 없음 |
| 준비 중 입력·focus | 미게시 subtree는 hit test·semantics·focus 획득·framework ticker 활성화 대상에서 제외 | mounted 상태와 사용자에게 게시된 상태가 달라짐 |
| coverage 밖 필수 요구 | 무제한 입력 대기 대신, 같은 continuation의 남은 작업을 기존 동기 계약에 맞게 완결하는 fallback을 우선 검토 | FPS를 위해 새로운 입력 지연 정책을 숨기지 않음. fallback 비용도 후보 성능에 포함 |
| GlobalKey | 게시 subtree의 State/GlobalKey를 준비 작업이 retake하지 않음. 새 준비 콘텐츠의 key 조회·예약 노출 시점은 명시적으로 정의 | 달력 내부 key도 예외로 취급할 수 없음 |
| 실험 채택 | 성능 통과 시에도 우선 opt-in. 기본 활성화는 별도 결정 | 실험 수락과 기존 UX 변경은 다른 결정 |

이번 적용 범위는 위 표의 cold 콘텐츠 opt-in까지다. 기존 앱의 기본 활성화나 임의 callback 부수 효과의 rollback은 이 계약에 포함하지 않는다. 내부 prototype 또는 일부 기능 검증을 전체 구현·성능 수락으로 보고하지 않는다.

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

- [x] P0: opt-in lifecycle·필수 동기 완결 정책과 준비/자원 상한 확정.
- [x] P1: 실제 AppSession/FrameworkRoot의 Source gate 범위에서 게시/준비 tree·target·key·focus 격리 검증.
- [x] P2: 실제 dirty queue와 owner commit continuation 구현·Source 검증. native의 shell 준비 재개도 실행했으나 날짜 선행 생산 수락은 아님.
- [ ] P3: §15에서 실제 Hermes의 날짜 선행 생산은 해결했다. 일반 layout coverage continuation·큰 원자 작업/필수 layout tail의 전체 수락은 미완료다.
- [ ] P4: 구현·Source 게시/forced/GPU busy/close 사례 PASS-scoped. 실제 pinned Hermes의 전체 forced IME/접근성 조합 수락은 미완료.
- [ ] P5: 공통 PageView·달력 opt-in 및 legacy 회귀, 실제 날짜 선행 생산을 확인했다. 날짜 선택/disabled/locale/범위/focus 전체 matrix의 제품 수락은 미완료다.
- [ ] P6: 현재 Hermes/Web/공통 기능의 명시한 사례는 통과. 큰 원자 작업/필수 layout tail·전체 기능/장기 자원 수락은 미달/미검증.
- [ ] P7: 남은 P3/P6 수락 조건에 따라 각 3회 비교 미실행, 성능 수락 false.
- [x] P8: 기본 legacy 일반 공급·시작/정상 종료, 임시 산출물 정리와 미채택·제약 인계 완료.

**전체 기능·성능 수락 판정은 `PARTIAL / performanceAccepted=false`다. 계획의 기술 gate 중단과 P8 안전한 복원까지 실행했고, 남은 단계를 성공 완료로 바꾸지 않았다.**

## 12. 실행 기록 — P1 내부 prototype의 격리 gate 중단 (2026-11-17)

### 실행 범위와 결정

- 실제 시작 HEAD는 `3614b568`이며 시작 worktree는 clean이었다. 앞부분의 `046f93d8`은 계획 작성 당시의 기준으로 보존한다.
- §3의 계약을 한 번에 확인했으나 사용자 응답을 받을 수 없었다. 따라서 문서의 **승인 부재 시 내부 prototype까지만 진행**하는 규칙을 적용했다. 이 요청 자체를 표시 전 lifecycle·입력 UX 변경의 별도 승인으로 확대하지 않았다.
- [게시 통합 fixture](Nelyx/eng/check-frame-publication.mjs)에 `--preparation-prototype` 실행을 추가했다. 실제 `AppSession`·`FrameworkRoot`의 canonical `BuildOwner`를 공유하면서 별도 `BuildScope`와 게시 pipeline에 연결하지 않은 `PipelineOwner`에 새 subtree를 mount/build/layout한다. fake scheduler 결과나 token 복사만으로 격리를 판정하지 않는다.
- 이 경계는 **fixture 내부에만 존재**한다. framework API, PageView, 달력 생성물, 기본 정책과 제품 공급은 변경하지 않았다. 기존 기본 실행은 계속 S0 동기 control이다.

### 관측 결과

| 검증 | 결과 | 실제 확인한 범위 |
| --- | --- | --- |
| 준비 dirty queue 분리 | PASS-scoped | default flush·finalize가 별도 scope의 작업을 대신 비우거나 active 준비 root를 폐기하지 않음 |
| 충돌 없는 새 subtree 생산 | PASS-scoped | 실제 별도 render tree의 layout 완료. 준비 전·후의 새 pointer는 기존 게시 target에 도달하며, 기존 render children·paint version·sealed commands·게시 semantics는 보존됨 |
| host로 반환 후 다시 준비 | PASS-scoped | 두 번의 **동기 scope flush 사이**에서 게시 입력을 처리. init 1회, 명시적 rebuild 2회, cancel/dispose 1회. **하나의 build/layout을 yield·재개한 P2/P3 결과가 아님** |
| 준비 GlobalKey의 외부 조회 차단 | **FAIL** | 미게시 State의 `GlobalKey.currentElement/currentState`가 즉시 외부에 노출됨 |
| 게시 State/target retake 금지 | **FAIL** | 준비 scope가 기존 GlobalKey의 동일 State를 실제로 가져감. 원래 부모의 child가 사라지고 기존 live render target의 pipeline owner도 준비 pipeline으로 바뀜 |
| 미게시 focus 차단 | **FAIL** | 준비 subtree의 stock Focus autofocus가 실제 View의 primary focus를 차지함 |
| 미게시 framework ticker 차단 | **FAIL** | 준비 State의 stock ticker provider가 실제 View scheduler에 callback을 등록하고 다음 host tick에 실행됨 |
| 취소·실험 복원·종료 | PASS-scoped | 준비 key·dirty 작업·ticker callback 회수, 중복 cancel 시 dispose 1회. retake 실험은 원래 State를 되돌린 뒤 실제 강제 frame으로 live pipeline을 재연결함. 각 session close에서 owned host task 0, 관측한 frame lease 전부 반환 |

**P1 판정: `BLOCKED / implementationAccepted=false / performanceAccepted=false`.** 별도 BuildScope와 detached render tree만으로는 canonical owner의 GlobalKey registry·FocusManager·ticker scheduler까지 격리되지 않는다는 반례를 실제 객체로 확인했다. 따라서 이 표현을 그대로 P2~P5에 연결하지 않는다. 외부 관측 이후 legacy로 처음부터 재실행하거나 기존 게시 State를 복제하는 우회도 추가하지 않았다.

다음 P1 구현 gate는 canonical owner 안에서 준비 세대별 key 예약/공개 시점과 양방향 retake 금지, framework focus/ticker 자격, render owner transaction 적용 범위를 함께 정의·구현하는 것이다. stock wrapper 하나를 추가한 것만으로 arbitrary opt-in subtree가 안전하다고 간주하지 않는다. 이번 prototype은 승격·오류/resize/close 재진입의 전체 조합이나 resource byte 상한을 증명하지 못하며, **P1 완료 또는 제품용 scaffolding으로 인계하지 않는다.**

### 실행 방법과 검증 예산

기존 S0 control:

```powershell
node .\Nelyx\eng\check-frame-publication.mjs
```

내부 구조의 격리 gate:

```powershell
node .\Nelyx\eng\check-frame-publication.mjs --preparation-prototype
```

이 첫 실행 당시 두 번째 명령은 네 가지 위반을 `FRAME_PREPARATION_PROTOTYPE`의 `gate=BLOCKED`로 출력하고 **종료 code 2**를 반환했다. 정상 수락이나 성능 PASS가 아니다. 이후 구현으로 변경된 현재 명령 결과는 §13을 따른다. 기본 control에는 이 실험을 실행하지 않으며, 양 경로는 기존 실행기의 **20분 timeout** 안에서 실행한다.

| 실행 | 횟수·결과 |
| --- | --- |
| S0 frame publication | 3회 PASS: 최초 control, prototype 정상화 후 control, 공개 CLI 확인 후 최종 control |
| Source framework / retained paint | 각 1회 PASS-scoped. 이번에는 이들 제품 Source를 변경하지 않음 |
| core 타입 검사 | 설치된 `@typescript/native` compiler로 PASS. 최초 잘못 지정한 compiler 파일 경로의 실패는 수정했으며 dependency 설치 없음 |
| 내부 prototype | 5회: fixture 취소/복원 구현 오류로 무효 3회, 정상 gate 실행 2회 모두 같은 4개 위반으로 BLOCKED. 무효 실행을 수락 표본에 넣지 않음 |
| 변경 fixture lint / format / diff | 최종 PASS. 새 로컬 문서 링크를 포함한 50개 링크 대상도 존재 확인 |
| native 전체 시나리오 / FPS 표본 | **0회**. P1 gate와 승인 조건 미충족으로 실제 Hermes·Web 제품 검증·기준선/후보 비교에 진입하지 않음 |

### 공급과 종료 상태

- 현재 [root Source](Nelyx/src/framework/widgets/root.ts) SHA-256 앞 12자리는 `6b6f25d85000`, 현재 dist의 대응 JS는 `09248baa1b94`다. 설치된 `@nelyx/core`는 같은 `Nelyx` 디렉터리의 junction이다. 이번에는 이 Source·dist·설치본을 교체하지 않았다.
- 현재 dist에는 Source의 S0 input sequence/timestamp 자격 검사가 아직 공급되지 않은 상태도 그대로 남아 있다. Source fixture PASS를 현재 배포 출력이나 실제 Hermes 실행의 검증으로 인용하지 않는다. VM/host/renderer identity와 최종 native 일반 시작·종료는 **미검증**이다.
- 새 준비/제품 자원 상한 확정, 승격·입력 게시 통합, nested 날짜 grid 분할, 실제 Hermes 공급과 성능 수락은 미완료다. P0는 control 확인만 완료, P1은 내부 후보 반례 검증 후 중단, P2~P7은 미진행이다.
- P8은 **제품 공급 무변경·fixture 내부 State/target 복원·취소/종료 회수와 제한된 인계**까지만 수행한다. 제품용 최종 공급 완료로 표시하지 않는다. 별도 설치본·archive·history JSON·raw 로그를 만들지 않으며, fixture bundle은 메모리에서만 사용한다.

**이 첫 실행의 판정: PARTIAL / P1 gate BLOCKED / 제품 구현·기능·성능 수락 모두 미완료 / performanceAccepted=false.**

## 13. 다음 단계 실행 — 준비 세대 소유권과 네 가지 격리 실패 수정 (2026-11-17)

### 실제 구현

제품 lifecycle·입력 정책 승인을 새로 받았다고 간주하지 않고, 기본 동기 경로를 보존한 **명시적 내부 준비 세대**만 구현했다. 앞선 미커밋 fixture·문서 변경도 보존했다.

| 변경 파일 | 구현 범위 |
| --- | --- |
| [framework](Nelyx/src/framework/widgets/framework.ts) | canonical BuildOwner당 준비 세대 최대 1개. 준비 root의 mount callback 전에 세대 소유권을 부여하고, 자손은 별도 LayoutBuilder scope 안에서도 이를 상속함. render-children transaction·GlobalKey 예약/retake 검증·inactive finalize를 게시 세대와 분리. 취소 및 owner close에서 준비 Element를 회수하며 같은 unmount hook을 중복 호출하지 않음 |
| [GlobalKey](Nelyx/src/framework/widgets/global-key.ts) | 미게시 key의 context/widget/State 조회를 숨기되 실제 binding은 유지하여 다른 View와 동등한 GlobalObjectKey의 중복 mount를 계속 차단. 게시↔준비 retake는 기존 부모나 live render target을 변경하기 전에 명시적 오류 |
| [Focus](Nelyx/src/framework/widgets/focus.ts), [Focus widget](Nelyx/src/framework/widgets/focus-scope.ts) | 준비 Focus의 autofocus·focus 획득과 게시 focus tree 편입을 차단. 이미 host/tree가 있는 FocusNode의 재사용은 flags나 callback을 재설정하기 전에 거부하여 기존 focus 상태를 보존 |
| [ticker provider](Nelyx/src/framework/widgets/ticker-provider.ts) | stock framework ticker에 준비 세대 소유의 mute를 설정. 수동 `muted=false`나 `forceFrames=true`가 미게시 ticker를 활성화하지 못하며, 기존 게시 ticker는 계속 실행 |
| [게시 통합 fixture](Nelyx/eng/check-frame-publication.mjs) | 기존 네 가지 반례를 실패 차단 검증으로 전환. 실제 AppSession/FrameworkRoot·별도 render pipeline을 계속 사용하며, 단순 token 검사로 대체하지 않음 |

준비 중 build/dirty 작업은 게시 build revision이나 현재 CPU frame의 유효 geometry를 변경한 것으로 계산하지 않는다. 일반 mount에서 추가로 사용자 `buildScope` getter를 읽어 준비 여부를 추측하지 않고, 내부 root 진입점에서 소유권을 명시적으로 seed한다. 준비의 **render 연결 경계 자체는 여전히 fixture 내부**에 있으며, 이 내부 primitive를 완성된 준비 widget/API로 제공하지 않는다.

### 검증 결과

최종 선택 명령은 §12와 같다. `--preparation-prototype`은 이제 `gate=PASS-scoped`, **종료 code 0**을 반환한다. 이는 아래 소유권 하위 gate의 통과이며, 출력의 `implementationAccepted=false`, `performanceAccepted=false`는 그대로 유지한다.

| 범위 | 최종 결과 |
| --- | --- |
| §12의 네 가지 위반 | 수정 후 PASS-scoped: 미게시 key 조회 차단, 양방향 retake 거부, 기존 primary focus 보존, 미게시 ticker callback 0 |
| key/예약/실제 target | 객체·문자열 identity의 GlobalObjectKey alias, 다른 View의 중복 mount, nested LayoutBuilder의 세대 상속, 같은 준비 세대 안의 정상 retake와 별도 finalize 검증. 거부된 게시 target은 기존 pipeline에 남고 pointer down/up이 정상 도달 |
| 게시/준비 transaction | 게시 flush가 준비 render commit을 실행하지 않음. 준비 flush는 실제 준비 render children을 commit하며, 기존 sealed frame·paint version·게시 semantics·입력 geometry 자격 유지 |
| 수명과 실패 | init·dispose 1회, 중복 cancel 시 unmount hook 1회, 취소 전 build 미실행, dispose 오류의 원본 보존·나머지 생성분 회수·다음 세대 생성 가능, owner close 시 준비 Element와 owned frame task/lease 회수 |
| 내부 Element 상한 | 준비 세대 2,048개를 넘는 첫 Element는 lifecycle 실행 전에 거부. 실제 생성된 State의 dispose 수가 init 수와 같고 dirty 작업 잔여 0 |
| 기존 회귀 | S0 frame publication, child reconciliation, dependency scope, Source framework 20개 사례, retained paint 모두 PASS 또는 해당 실행기의 PASS-scoped |
| 코드 품질 | core 타입 검사, 변경 6개 코드 파일 lint·format PASS. 모든 검증 subprocess는 20분 timeout |

이번 후속 실행의 준비 fixture는 코드 보완에 따라 총 5회, 기본 publication control은 총 4회 실행했으며 모두 통과했다. child reconciliation은 3회, dependency scope·Source framework·retained paint는 각 2회 통과했다. native 전체 시나리오와 성능 표본은 추가 **0회**다. Element 상한 검증의 내부 mount 수를 native 시나리오 반복 횟수로 세지 않는다.

### 남은 gate와 공급 상태

- **전체 P1은 미완료**다. 준비→게시 승격과 그 실패·재진입, parent/route/hide/resize/renderer 무효화에 따른 취소, 수명·GlobalKey 공개 시점·Focus/ticker 승격 정책의 결합을 아직 구현·수락하지 않았다. 자동 사용자 timer/구독 정지나 callback 부수 효과 rollback도 제공하지 않는다.
- 2,048개는 현재 **준비 세대 자체의 내부 Element 제한**이다. 기존 optional retention과의 합산 View 상한, resource byte/lease 상한 및 JS heap 관측은 미완료다. 이 제한만으로 §4.2/§9의 자원 gate를 수락하지 않는다.
- 준비 scope의 실제 build/layout을 중간에 yield·재개하는 P2/P3, CPU seal·입력/semantics 게시·GPU backpressure를 통합하는 P4, PageView/달력 opt-in인 P5는 여전히 미구현이다. stock framework 경로의 이 검증을 arbitrary custom subtree 전체 지원으로 확대하지 않는다.
- 기존 dist·설치 junction·Demo 출력은 교체하지 않았다. 새 framework Source는 아직 정규 package 공급이나 pinned Hermes/Web 제품 실행으로 검증하지 않았으며, 오래된 Web bundle을 이번 변경의 검증에 사용하지 않았다. 새 archive·별도 설치본·raw 로그는 남기지 않고, 도구가 생성한 임시 diff 출력도 삭제했다.
- 다음 단계는 **P1의 실제 준비 경계·승격/취소 소유권과 총량 예산 통합**이다. 제품 연결 전 §3의 행동 계약 확인은 여전히 필요하며, 전체 P1 gate 통과 전에는 P2~P7을 완료로 표시하지 않는다.

**현재 판정: P1 소유권 하위 gate PASS-scoped / 전체 작업 PARTIAL / performanceAccepted=false.**

## 14. 이전 전체 실행 결과 — cold finite 생산 후보 미채택 (2026-11-17)

### 실행 계약과 실제 구현

- 시작 HEAD는 `475989b8`, worktree는 clean이었다. 이번 전체 실행 요청에 따라 §3 권고안을 명시적 opt-in의 실행 계약으로 적용했다. 기본 활성화, 입력 폐기, cache 확대, 다른 VM 전환은 포함하지 않는다.
- 공개 선택은 `PageView`의 `childPolicy: { mode: 'split' }` 또는 dialog를 감싸는 `PageViewPreparation`이다. 생략하면 `legacy`다. Demo는 `main(undefined, { calendarPreparation: true })`에서 날짜 dialog에만 이 경계를 적용한다. 생성된 날짜 파일과 생성 소유 입력은 수정하지 않았다.
- [실제 준비 경계](Nelyx/src/framework/widgets/subtree-preparation.ts)는 canonical BuildOwner 안의 별도 BuildScope와 detached PipelineOwner를 소유한다. 준비 중에는 실제 게시 target, render children, key 조회, focus, framework ticker와 외부 notification 전달을 격리한다. 완료한 cold Element/State를 재초기화하지 않고 실제 부모로 옮긴다.
- build는 실제 DepthQueue를 재개하고, render owner commit도 같은 soft deadline에서 재개한다. 새 dirty ancestor의 기존 깊이 순서를 유지한다. nested finite grid/fixed list는 각자 실제 child index cursor로 delegate/build/mount를 생산한다. View당 준비 세대 1개, 준비+optional Element 합산 2,048개, nested sliver당 최대 64개 child가 첫 범위다. 준비 자원의 실제 등록은 128개/16,384 units/1MiB 이내이며, 최종 필수 layout에도 같은 등록 예산을 적용한다. JS heap과 기존 공유 자원 hold는 이 byte 수치와 별개다.
- **생산 완료와 layout coverage 완료를 구분한다.** detached tree를 미리 layout한 뒤 attach하면 기존 render 규칙이 layout을 무효화하여 custom callback까지 재실행한다. 이 경로는 제거했다. 준비 단계에서 nested 날짜의 실제 생산을 분할하고, 최종 layout은 실제 부모 pipeline에서 한 번 수행한 뒤 capture·geometry·semantics 게시를 거친다. 이 필수 layout·승격·회수 tail은 성능에서 제외하지 않는다. 임의 LayoutBuilder를 통한 지연 producer 발견은 callback 실행 전에 거절하고 같은 세대를 취소하며 legacy subtree를 중복 실행하지 않는다. 기존 내부 prototype의 LayoutBuilder 자격은 유지한다.
- key 공개와 focus/ticker 재개는 CPU capture 및 현재 geometry·semantics notification 성공 뒤에 수행한다. GPU admission과 별개다. 필수 페이지가 먼저 요구되면 이미 시작한 같은 cursor를 동기로 완결한다. 관측 deadline이 없으면 선택 lifecycle을 시작하지 않는다.
- 준비 중 Ink는 기존 Material의 feature/paint 상태를 변경하지 않는다. 실제 부모의 layout 후 현재 paint 직전에 등록하며, 등록 실패 때 painter/feature를 회수한다. 내부 anchor 조회만 같은 미게시 세대의 실제 조상·자손 범위로 허용하며 public GlobalKey 조회는 계속 숨긴다.
- 선택 재개는 `requestFrameAt`으로 실제 host tick에 연결한다. GPU credit 알림이 deadline 없는 CPU frame에서 다음 요청을 소비하지 않도록 한다. slice에서 실제 rebuild/commit/finite 생산이 진행됐으면 도중 credit 소진 후에도 다음 tick을 예약하고, 진전 없는 작업은 반복 예약하지 않는다. 이 수정은 Source의 실제 credit wake 순서와 중간 credit 소진 사례로 확인했다.

### 검증 결과와 기술 gate

| 범위 | 결과 / 남은 확인 |
| --- | --- |
| 준비·승격 통합 | `node Nelyx/eng/check-frame-publication.mjs --subtree-preparation` PASS-scoped. live target 사이의 실제 yield, 42개 nested grid cursor, public PageView 재개·필수 동기 완결, credit wake/중간 credit 소진, dirty-ready 재개, 원래 오류의 회수 후 보고, Ink 격리·등록 실패 회수, init/build 단일 실행, CPU 게시 후 key/focus/ticker, resource cap/retirement, unsupported callback 사전 거절, resize·close·게시 오류·GPU busy forced frame |
| 기존 경로 | S0 publication, 기존 preparation prototype, child reconciliation, dependency scope, Source framework 20개 사례, retained paint PASS-scoped |
| 코드 품질 | core·Demo·Testbed 타입 검사, 변경 코드 lint/format·`git diff --check` PASS. 실행기 subprocess timeout 1,200,000ms |
| 공급 | core/material 정규 build와 Demo의 기존 Windows/Web runner 공급·설치 갱신. 실제 pinned Hermes bytecode로 실행. VM/host/renderer 변경 및 TDZ pruning 활성화 없음 |
| 실제 달력 기능 | 최종 진단에서 60Hz touch 48/30/60개 전부 수락, gesture 6/6/12회, 월 이동 +4/+3/−6, 거부 및 surface 대응 누락 0. 전체 native 입력 수신=전달=수락=158, 거부 0, 정상 종료 0 |
| 실제 날짜 분할 | **FAIL.** 선택 slice에서 실제 nested finite child 생산 0. 필수 cold admission 15회 중 같은 준비 cursor 채택 3회(20%)였으나 finite child 125개는 전부 필수 동기 drain에서 생산됨. shell 준비를 날짜 생산 성공으로 계산하지 않음 |
| Web | legacy와 opt-in 각각 현재 CanvasKit 공급의 headless WebGL2/SwiftShader 기능 PASS-scoped. 첫 화면, Gallery wheel 왕복, 한글·이모지 editor, theme·breakpoint 보존, 달력 앞뒤 이동·닫기. Web에는 관측 deadline이 없어 선택 준비는 시작하지 않음. 임시 App.tsx는 바이트 단위 복원했고 최종 출력은 legacy |
| Windows 공통 화면 | 현재 공급의 Gallery wheel 3구간·Ink/편집·theme/resize·정상 종료 PASS-scoped. Testbed 혼합 editor/counter/scroll/목록과 가변 목록 cold/return/warm·UIA membership 왕복 PASS-scoped. 현재 Testbed 입력은 118/118/118, 목록은 159/159/159, 모두 거부 0·종료 0 |
| sender control | `check-windows-input.mjs` 첫 실행은 sample 1의 14.688ms deadline miss로 무효. 코드·주입 cadence를 바꾸지 않은 독립 재확인 1회에서 6개 사례 PASS, 50/48/30/60개 모두 약 60Hz. 늦은 burst를 성공으로 허용하지 않음 |
| P7 | **기술 gate 때문에 미실행.** §6 P3/P6와 §7 규칙에 따라 기준선/후보 각 3회로 확대하지 않음. 진단 FPS를 성능 표본이나 비교 수락으로 사용하지 않음 |
| P8 | 기본 legacy 유지. README의 일반 Windows build/run에서 첫 프레임과 강제 종료 없는 정상 종료 PASS. 진단 entry/profile을 포함하지 않은 현재 bytecode와 Web legacy 출력 유지. 소유 임시 산출물·프로세스 정리 확인 |

최종 달력 진단은 2560×1459, DPI 192, 165Hz에서 실행했다. 선택 준비는 4세대/5slice, 게시 3회·취소 1회, 최장 slice 2.166ms(2ms는 soft budget), 선택 원자 작업 최장 1.338ms였다. peak 준비 Element 1,018개, 새 resource 2개/3,220 bytes였으며 root 종료 시 준비 Element/active generation은 0, producer hold는 0이었다. 그 시점의 renderer 등 공유 resident 64개/102,270 bytes는 이후 host drain 대상이며 이를 준비 미회수 또는 resident 0으로 바꿔 보고하지 않는다. 실제 프로세스는 정상 종료했다. 이 관측만으로 JS heap의 장기 비누수나 모든 Focus/보조기술 수락을 확정하지 않는다.

| 구간 | engine FPS (진단, 수락 제외) | layout 최장 ms | 해당 구간 필수 준비 drain ms | 입력→surface p95 ms |
| --- | ---: | ---: | ---: | ---: |
| 정방향 100ms | 32.143 | 111.952 | 54.527 | 307.390 |
| 정방향 50ms | 17.292 | 153.268 | 64.787 | 439.266 |
| 역방향 50ms | 17.662 | 154.840 | 70.396 | 445.516 |

필수 준비 drain 합계는 189.710ms다. 위 실행은 frame diagnostics ON, CPU/build/GC profile OFF, desktop 표시 관측 OFF이며 표시 FPS는 미검증이다. 최종 layout·commit·retirement tail을 제외한 수치를 제시하지 않는다. 실제 선택 날짜 생산이 0인 원인의 세부 시간/credit 분해와 이를 해결하는 구조는 미완료이며, 현재 후보를 제품 성능 개선으로 채택하지 않는다.

진단 전체 시나리오는 6회였다(계획 진단 2회 + 원인 수정/무효 실행 보완 예비 4회). 최초 native 실행은 Ink anchor/기존 Material 등록 문제로 실패했고 이를 수정했다. 다음 1회는 GC 포함 기능 진단 PASS, 다음 1회는 sender sample 12의 22.361ms deadline miss로 무효였다. 이후 참여율 계측·실제 host tick 재개·중간 credit 소진 수정 후 각각 1회씩 실행했다. 기능은 통과했지만 마지막에도 선택 날짜 생산은 0이었다. 그 이전의 archive 경로 불일치 1회는 앱 시작 전 공급 검사 실패였으며 native 실행으로 세지 않았다. 실패/무효 실행을 성공 표본으로 대체하지 않았다.

공통 화면은 Gallery 1회, Testbed/목록 각각 이전 SDK 1회와 현재 SDK 1회로 총 5회다. 첫 Testbed 2회는 기능이 통과해도 설치된 SDK/CLI 실제 bytes가 저장소와 달랐으므로 현재 공급 수락에서 제외했다. 선언된 기존 SDK/CLI snapshot만 다시 공급·설치했고, `refreshSampleWindowsSdk`의 `changed=[]`와 SDK inputs `ed368c88…`를 확인한 뒤 각각 1회 재확인했다. Testbed renderer SHA는 `fef5ea8a80551be8c1d779b23b70dd387413b48bd942790f98156d7dfff4ca52`이며 Demo 성능 표본으로 혼합하지 않는다. 첫 Testbed incremental install의 비정상 종료 1회는 `--no-audit --no-fund`로 같은 선언 패키지를 설치해 복구했고 dependency/toolchain version은 올리지 않았다.

Web도 첫 2회는 SDK/CLI/Metro 설치 bytes가 현재 저장소와 달라 최종 현재 공급 수락에서 제외했다. 해당 3개 선언 snapshot을 갱신하고 모든 Web package inputs의 `changed=[]`를 확인한 뒤 opt-in/legacy를 각각 1회 재확인했다(총 Web 4회). 신구 application bundle SHA는 같았지만 설치 package identity를 확인하지 않은 결과로 대체하지 않았다. 최종 App.tsx는 원본 SHA `ec8603835f38da75fe385d1ba21ec755f11e8e4cc19f3d904b1613ffd7dd6445`로 복원했다.

날짜 선택/disabled 날짜·locale/범위 변경·focus 이동의 전체 matrix, 실제 pinned Hermes의 준비 중 forced IME/접근성 query·GPU busy/close 조합, 물리 trackpad·실제 IME composition·screen reader, 장기 heap/hold 안정성은 수락하지 않았다. Source fixture와 synthetic Unicode 입력을 이 항목들의 실제 장치 수락으로 확대하지 않는다. 기술 gate 미달에 따라 이번 실행은 **PARTIAL / performanceAccepted=false / 미채택**으로 끝내며, 남은 작업을 전체 구현·성능 성공으로 표시하지 않는다.

현재 공급의 마지막 진단 identity:

| 항목 | SHA/revision |
| --- | --- |
| installed SDK inputs | `ed368c88c1b62feceb3b1c2e9c76bf5f8b3cb8574234b48f5bf6745eb7387d2b` |
| Hermes revision | `b464dba92ad87bcfb77fae381a49a2394d9836d9` |
| toolchain | `003eba84c3f3a322ddc2c79bd5271a8c3102bbf1d70e545ad23e98f6c6e5e628` |
| renderer | `c66b0cf9750b6ce31652c810263a12f41d7f8a2ccb55fb9ed584ddab8709ae2c` |
| host source | `14ce0f7cdd860996f4fc34a3a8e5457289df4e61890801718f3316e2a7807b57` |
| diagnostic bundle | `0e29756fde0e3d1c0eea5034bcef9a3b6342f866315535f5f2e9558605925796` |
| 최종 Web legacy bundle | `9f10cda23fa03a3434c8b87d377220ea3d9bf18665c7a01b706e70edfec451b6` |
| 최종 일반 Windows bytecode | `b3ac4601dba93280e312fe9aa9eba4fef573817f2096ed3d4318a98f456c5e7e` |
| 일반 package의 native/engine 결합 SDK inputs | `e25416f57daf277a6a42edf95056426c192a929ecc25b9b2db8f1215362d72cf` |

### 최종 공급·정리와 변경 파일

- `npm.cmd run build:windows --workspace @nelyx/demo`와 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 10000`을 실행했다. 진단 관련 환경 변수는 자식 실행에서 제거했다. 일반 bytecode `current-bytecode`는 `qualification=experimental`, diagnostic entry 없음, 현재 app inputs 일치, probe 문자열 없음으로 확인했다. 첫 프레임 후 surface 4개, `exitCode=0`, `forced=false`로 종료했다. 표시/scanout·물리 입력 수락은 별도 미검증이다.
- native 전체 시나리오는 진단 6회 + 공통 5회 + 최종 일반 1회 = **12회**였다. 앱 시작 전 공급 검사/설치 실패, standalone sender control, Source fixture와 Web 실행을 native 전체 시나리오 수로 세지 않았다.
- 이번 실행의 `.tmp`·`supply-*`·probe entry/output·package replacement·core/material build staging을 정리했다. `.tmp`에는 시작 전에 있던 `calendar-fast-entry.ts`, `calendar-fast-run.mjs`, `calendar-fast-ui.ps1`, `calendar-product-build.mjs` 4개만 남겼고, 해당 두 앱 경로의 소유 native process는 0이었다. 현재 dist/선언 archive/기존 runner 설치본만 유지하며 별도 소비자·이전 공급 archive·검증 history/receipt JSON은 만들지 않았다.
- 소유권/게시 변경은 `framework.ts`, 새 `subtree-preparation.ts`, `root.ts`, `global-key.ts`, `focus.ts`, `focus-scope.ts`, `ticker-provider.ts`, `resources.ts`, `owner-transaction.ts`, rendering `object.ts`에 있다. 생산/선택 변경은 `sliver.ts`, `sliver-fixed-extent-list.ts`, `layout-builder.ts`, `scroll-delegate.ts`, `scrollable.ts`, `view-work-budget.ts`, `page-view.ts`, `sliver-fill.ts`와 Material `ink-decoration.ts`에 있다.
- Demo의 `src/app.ts`, `src/components.ts`, `src/demo-application.ts`, 양 README, Demo Windows/Web 및 Testbed Windows의 package/lock을 갱신했다. 검증 확장은 `check-frame-publication.mjs`, `windows-jank-probe.ts`, `check-windows-jank.mjs/.ps1`에 있다. 생성된 calendar 소스·VM·renderer/toolchain 소스는 수정하지 않았다.

실제 달력 선택과 진단 실행:

```powershell
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -HermesMode bytecode -Preparation split -Diagnostic -Runs 1 -NoScreen
```

성능 비교에서는 `-Diagnostic`과 CPU/GC/build profiling 환경 변수를 끄고 `-Preparation legacy`와 `-Preparation split`을 각각 선택한다. 새 선택과 진단 여부는 실행 identity에 포함한다. 현재 성능 판정은 계속 **PARTIAL / performanceAccepted=false**다.

## 15. 후속 개선 — CPU 프레임과 준비 host 기회 분리 (2026-11-17)

### 원인 분석과 변경

- `다음 개선작업을 해줘` 요청으로 §14의 날짜 선행 생산 0개부터 이어서 개선한다. 이전 변경과 일반 기본값을 보존한다.
- 기존 `requestFrameAt → dirty=true → FrameworkRoot.build → layout 이후 준비`는 준비를 재개할 때마다 실제 CPU 프레임을 만들었다. 이 과정에서 시간이 소진되거나 예측이 없는 tick을 만나면 다음 준비 요청도 끊겼다. 단순한 2ms slice 구현만으로 여러 준비 기회를 보장하지 못했다.
- Core ViewRuntime의 `requestOptionalWork`는 필수 입력/CPU/GPU admission 처리 뒤 실제 host tick에서 준비 callback 하나를 실행한다. 화면을 dirty로 만들거나 CPU frame을 capture하지 않는다. callback 중 새 요청은 다음 host tick으로 넘어간다. GPU busy에서는 tick을 반복 소비하지 않고 credit 알림으로 다음 실제 tick을 예약한다. credit 알림 자체에 deadline을 붙이지 않는다.
- 현재 direct host는 `latestInputAdmission=false`이며 SDK scheduler에 별도 credit subscription이 없다. 기존 Renderer의 유효한 retirement 알림으로도 같은 준비 tick을 예약하도록 보완했다. 새 입력 admission 모드를 켜거나 SDK/VM/renderer를 교체하지 않았다. Source fixture는 credit API 없는 submitted/retired renderer를 실제로 구성해 이 경로를 확인한다.
- BuildOwner는 이 기회에서 같은 준비 cursor를 계속한다. 2ms soft slice, 4ms 안전 여유, 실제 deadline·queue delay·clock uncertainty, 기존 Element/resource 상한을 보존한다. deadline 누락은 선택 lifecycle 없이 정지한다. 일시적인 예산 만료는 최대 2회 추가 기회만 요청하며 이후에는 새 필수 프레임 등 별도 사건까지 기다린다.
- Source 통합 검증에서 준비 중 실제 날짜 child가 여러 tick에 생산돼도 게시된 CPU frame 수가 증가하지 않음을 확인했다. credit 소진/복귀, 예산 만료 뒤 재개, 지속 만료의 유한 정지, deadline 누락, hide와 준비 오류의 예약/세대 회수도 통과했다. 기존 publication/조정/의존성/Source framework/retained paint 회귀와 core 타입·변경 lint도 통과했다.

### 검증 범위

- 현재 core를 기존 runner에 공급한 뒤 같은 pinned Hermes/2560×1459/DPI 192/165Hz, 60Hz touch 48/30/60개, gesture 6/6/12회, 월 이동 +4/+3/−6을 유지해 진단한다. 선택 finite child는 header/blank도 포함하므로 현재 Gregorian의 7개 header+최대 6개 blank를 넘는 세대별 생산과 필수 채택·회수까지 확인한다.
- 진단 1회와 실제 수정/환경 실패 보완 1회까지만 우선 사용한다. 후속 native 전체 시나리오는 기본적으로 진단/공통/최종 일반을 합쳐 4회 이내로 제한한다. 각 검사는 20분 timeout이며 raw 로그/새 receipt/history는 남기지 않는다.
- 이번 개선의 직접 수락은 실제 날짜 선행 생산과 CPU frame 격리/기능/회수다. 최종 layout tail, 입력 지연과 FPS는 별도 보고한다. 전체 P6/P7 기준을 통과하기 전에는 성능 수락·기본 활성화로 바꾸지 않는다.

### 실제 Hermes 결과

- 후속 진단은 2회였다. 첫 실행은 준비 전용 slice 8회, 선행 finite child 4개로 header까지만 진행했다. 별도 credit API가 없는 현재 direct host의 retirement 재개 연결이 빠졌음을 코드로 확인하고 수정했다. 두 번째 실행에서 **선행 finite child 162개, 세대별 최대 44개**를 관측했다. 현재 Gregorian의 header/blank 상한을 넘어 실제 날짜까지 생산했으며, 첫 touch 전에도 40개/990 Element가 생산됐다. 생성된 calendar 소스와 입력량은 그대로다.
- 두 번째 실행은 준비 4세대, 게시 3회, 취소 1회, 실제 cold required admission 15회 중 준비 cursor 채택 3회였다. 선택 slice 322회/누적 501.357ms, 별도 기회 323회, 예산 만료 1회·deadline 누락 0회였다. 필수 동기 완결은 1회/8.174ms였으며 §14의 단일 진단 3회/189.710ms와 구분한다. 이는 대응된 성능 3회 비교가 아니며 전체 CPU 비용 감소를 확정하지 않는다.
- 최대 선택 slice 9.725ms, 최대 원자 작업 8.379ms였다. 2ms는 soft budget이며 이 초과를 숨기지 않는다. 최종 필수 layout·회수 tail도 남아 있다. 준비 전용 tick의 CPU 비용은 Root frame diagnostics의 build/layout에 들어가지 않으므로 `sliceMs`로 별도 합산한다. engine/input 관측은 실제 wall-clock 구간을 유지한다.
- peak 준비 Element 1,018개, 등록 resource 2개/3,220 bytes, 종료 시 준비 Element/active generation/producer hold 0, native 종료 0이었다. root 종료의 공유 resident 64개/102,270 bytes는 이후 renderer drain 대상이다. 장기 heap·모든 hold의 비누수를 수락한 결과는 아니다.
- touch는 48/30/60개 모두 수락했고 gesture 6/6/12회·월 이동 +4/+3/−6을 유지했다. 전체 native 수신=전달=수락=156, 거부 0, move→surface 대응 누락 0이었다. setup mouse 등 전체 packet 수와 touch 수를 혼동하지 않는다.

| 구간 | engine FPS (진단) | layout 최장 ms | 입력 queue p95 ms | 입력→surface p95 ms |
| --- | ---: | ---: | ---: | ---: |
| 정방향 100ms | 32.128 | 83.785 | 110.285 | 252.374 |
| 정방향 50ms | 36.694 | 128.018 | 279.825 | 361.780 |
| 역방향 50ms | 20.568 | 177.683 | 201.268 | 430.433 |

현재 공급은 설치 SDK inputs `7a3793949e3cc6a08b8edb523aa70100a46bfe6f44788d3a6df46d108b569603`, 진단 bundle `72c58ffff8e3cee559c141c037060b6b44bb184c773339ccf34b7f6735d568a2`다. Hermes revision/toolchain·Demo renderer·host source는 §14와 동일하다. frame diagnostics ON, CPU/build/GC profile OFF, desktop 표시 관측 OFF다. **날짜 선행 생산 정체는 개선했지만 역방향 FPS·원자 작업/필수 layout tail과 P6 미검증 matrix가 남아 있어, 전체 성능 수락과 P7 비교는 계속 미완료다.**

### 회귀·최종 공급과 인계

| 범위 | 후속 결과 |
| --- | --- |
| Source | 준비 전용 tick/CPU frame 격리, retirement-only renderer, credit 복귀, bounded deadline 재시도, hide/오류 회수 포함 통합 PASS-scoped. 기존 publication/prototype·조정·의존성·Source framework·retained paint도 PASS-scoped |
| 코드 품질 | core·Demo·Testbed 타입 검사, 후속 변경 scope lint/format, `git diff --check` PASS |
| 실제 공통 화면 | 현재 Source 공급의 Testbed mixed scroll/editor/counter/list PASS-scoped. native 수신=전달=수락=118, 거부 0, 종료 0. Testbed renderer를 Demo FPS 표본으로 혼합하지 않음 |
| Web | 현재 Source의 opt-in/legacy 각각 첫 화면·wheel 왕복·한글/이모지 editor·theme/resize·달력 앞뒤/닫기 PASS-scoped. 원본 App.tsx의 bytes 복원, 최종 legacy 출력 유지. deadline 없는 Web의 선택 lifecycle은 시작하지 않음 |
| 일반 Windows | README의 일반 build/run에서 첫 프레임·surface 4개·종료 0·`forced=false`. 진단/profile 환경 변수 제거, diagnostic entry/probe 문자열 없음, 현재 app inputs 일치 |
| 공급·정리 | Demo Windows/Web·Testbed Windows의 실제 package inputs가 저장소와 일치함을 확인. 현재 dist/선언 snapshot만 유지. 소유 native process 0, probe·supply/build staging·replacement 잔여 없음. 기존 `.tmp` 4개 파일 보존 |

후속 native 전체 실행은 진단 2회 + Testbed 1회 + 최종 일반 1회 = **4회**, §14와 합쳐 16회다. 후속 Web은 2회다. Source fixture assertion을 native 전체 시나리오 수로 세지 않았다. 각 실행은 20분 timeout을 유지했고 별도 검증 로그/receipt/history 파일은 추가하지 않았다.

최종 일반 Windows bytecode는 `df95bf8671885999d7b1c6d626e5500d4f993eedc85f484b3a8b18c7f42aa511`, native/engine 결합 SDK inputs는 `8a11e2adf68614ba99edb83755306f9efcd369a0a1c6e2902c1a2070cf787e64`다. 최종 Web legacy bundle은 `714e8d32ee4b76267ee53278d33ff1ea3a63ca46295154596a047461249ce850`이며 App.tsx는 §14의 원본 SHA와 일치한다.

후속 구현 변경은 `Nelyx/src/hosting/runtime.ts`, `framework.ts`, `root.ts`와 `check-frame-publication.mjs`다. README와 기존 runner package/lock, 이 문서에 선택·공급·수락 범위를 반영했고 이전 작업 변경은 보존했다. 새 기본 활성화, generated calendar/VM/renderer/toolchain 변경은 없다.

다음 개선의 주요 잔여는 최종 필수 layout의 큰 비용(이번 역방향 최장 177.683ms), 큰 원자 callback(최장 8.379ms), 선택 작업 누적 CPU/취소 낭비와 전체 입력/기능 matrix다. 이번의 준비 재개·날짜 생산 개선을 30fps/표시/물리 장치 성능 수락으로 확대하지 않는다.

## 16. 개선판 CLI 수동 실행 (2026-11-17)

저장소 루트에서 다음 명령으로 개선판을 실행한다. 현재 SDK 공급과 필요한 빌드를 자동 갱신하며, 일반 명령에는 자동 입력이나 종료 timer를 추가하지 않았다.

```powershell
npm.cmd run run:windows:prepared --workspace @nelyx/demo
# 동일한 명시적 선택
npm.cmd run run:windows --workspace @nelyx/demo -- --preparation split
# 기존 창을 닫은 뒤 기본판 비교
npm.cmd run run:windows --workspace @nelyx/demo
```

창을 최대화하고 **메뉴 → Selection → Choose date**에서 달력을 연다.
`--preparation legacy`도 기본판을 선택한다. 개선판 진입점 `src/calendar-preparation.ts`가 기존 앱에 `calendarPreparation: true`를 전달하고, 기본 `src/index.ts`는 변경하지 않았다.

Direct native CLI의 `build/run --entry <앱 내부 파일>`와 package manifest의 `appEntry`를 연결했다. 선택한 진입점도 재사용 조건에 포함하므로 개선판 출력이 남아 있어도 옵션 없는 실행은 기본판으로 재빌드한다. 같은 선택은 현재 출력 재사용이 가능하며, 진입점이 고정된 `--package`와 선택 옵션의 동시 지정은 명시적으로 거절한다. 진단 probe·VM·renderer·compiler 변경은 없다.

검증은 native 실행/재사용 fixture 36개, Demo·CLI 타입 검사, 변경 lint/format과 `git diff --check`가 통과했다. 실제 Windows에서는 개선판 → 기본판 → 개선판의 3회 전환을 확인했고, 각각 첫 프레임과 종료 0·`forced=false`를 관측했다. 검증에만 `-- -- 10000`을 전달해 10초 후 정상 종료했으며 각 실행 timeout은 20분이다. 이번 CLI 작업을 합친 native 전체 실행은 19회다.

현재 설치 CLI bytes는 저장소와 일치한다. 최종 출력은 개선판 `src/calendar-preparation.ts`, bytecode SHA `2cf7646fb3aa4affda3591e302a782ee22669cfdc286ac32df7125455e6bfda3`, native/engine 결합 SDK inputs `05fa2a4b4024717cb5870324f6203b3717afdfb3445b2f8ab31c7145f9fc2bf6`다. 기본판 bytecode는 §15의 `df95bf8671885999d7b1c6d626e5500d4f993eedc85f484b3a8b18c7f42aa511`과 동일했다. 소유 앱 process·공급/build/replacement staging 잔여는 없고 기존 `.tmp` 4개 파일을 보존했다. 이번 CLI 확인은 추가 성능 판정이 아니며 `performanceAccepted=false`를 유지한다.

## 17. 달력 진입 중 semantics geometry 누락 수정 (2026-11-17)

사용자가 `run:windows:prepared`의 간헐 종료 로그를 제공했다. 첫 오류는 `buildSubtree → ensureSemanticsNode → flushSemantics`의 `Cannot read property 'hidden' of null`이며, 이후 native drain 실패가 이어졌다. 수정 전 같은 패키지로 PowerShell 입력을 실행했을 때 달력 진입은 정상 동작했으므로 원래 입력 타이밍의 결정적 재현을 주장하지 않는다.

[semantics-pipeline](Nelyx/src/framework/rendering/semantics-pipeline.ts)은 좌표 갱신을 요청한 render object와 최종 조립 대상을 별도로 선택한다. 구성 갱신의 조상, 특히 보이지 않는 자식을 제거하기 위해 추가된 부모도 조립 대상이 될 수 있었다. 이 대상의 geometry가 비어 있으면 기존 코드는 갱신 큐의 처리만으로 좌표가 유효하다고 가정하고 `hidden`을 읽었다. 구성 갱신 대상의 조상도 geometry 단계에 포함하고, 뒤늦게 선택된 조립 대상은 현재 접근성 조상에서 실제 좌표를 계산하도록 보완했다. 현재 트리에서 차단된 가지는 부모의 다음 구조 갱신 때 다시 참여한다. `hidden`에 임의 기본값을 넣거나 접근성을 끄지 않았다.

[회귀 검사](Nelyx/eng/check-semantics-geometry.mjs)는 조상 geometry가 누락된 큐 상태를 직접 구성하여 수정 전 같은 `null.hidden` 예외를 확인했고 수정 후 통과했다. 이는 원래 native 제스처 순서를 재현한 결과와 구분한다. debug/release, 구성 갱신만 남은 root, 보이지 않는 자식의 부모 조립, clip 복귀, 노드 identity, 배경 이동과 모달 차단, transport 회수의 총 20개 사례가 통과했다. 기존 Source framework·subtree preparation·native semantics delta·semantics construction, core 타입 검사, 변경 lint/format과 `git diff --check`도 통과했다.

Windows 통합 확인도 완료했다. 수정 core를 재빌드하고 Demo에 설치된 소스·emit이 현재 Source와 일치함을 확인한 뒤, 같은 `npm.cmd run run:windows:prepared --workspace @nelyx/demo`로 제품 패키지를 갱신했다. PowerShell 가상 입력으로 최대화·기본 크기 창에서 달력 열기, 11월↔12월 이동, 날짜 선택·확인 및 선택 결과, 닫기·재열기, 열린 dialog의 resize를 확인했다. JS 오류 없이 입력 79개가 모두 수락됐고 거절 0, 최종 종료는 `exitCode=0`, `forced=false`였다. 이 기능 확인을 평균 FPS·정상 동작 중 버벅임 개선으로 확대하지 않으며 `performanceAccepted=false`를 유지한다.

검증용 임시 파일의 묶음 강제 삭제는 자동 승인 검토에서 차단됐다. 생성한 텍스트 helper 2개는 명시적 파일 patch로 제거했고, 캡처 이미지 1개도 확인한 경로에서 강제 옵션 없는 개별 삭제로 정리했다. 기존 `.tmp` 4개는 보존했다. 소유 native process와 이번 공급/build/replacement staging 잔여는 없다. 새 raw 로그·receipt·checkpoint/history JSON은 남기지 않았다.
