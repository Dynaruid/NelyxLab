# Windows 스크롤 C++ 구현 계획 — 입력·프레임 재개·hit-test·섹션 수명

최초 분석: **2026-11-03 KST** · 계획 재작성: **2026-11-04 KST** · 상태: **PLAN_READY / 구현 미착수 / 제품 PARTIAL 유지**

**이 문서는 기존 분석을 바탕으로 C++ 구현 작업을 정의한다.** 추가 수치 커널만 만드는 방식에서 범위를 넓혀, native가 터치패드 입력의 생산·배치, frame 재개 신호, 지원되는 입력 대상 질의, bounded section의 보존·준비 결정을 맡도록 한다. TS는 Widget/Element·사용자 callback과 framework의 공개 상태를 소유한다.

사용자가 이번에 요청한 범위는 **work7.md를 C++ 구현 계획으로 재작성**하는 것이다. 아래 API·선택 모드·작업 단계는 구현할 계약이며 현재 제공되는 기능이나 완료 기록이 아니다.

## 1. 목표와 현재 기준

- 사용자는 [work6.md](work6.md)의 C++ 구현을 사용해도 **노트북 터치패드 두 손가락 스크롤**이 버벅인다고 보고했다.
- 계획 기준 HEAD는 9dcc2795ad80f3a66b1e6d374b8ff58a16a72a63이다. 이번 재작성 시작 시 변경은 앞서 작성한 미추적 work7.md뿐이었다.
- 이번 작업의 목표는 C++ 모듈의 수를 늘리는 것이 아니라 **실제 입력이 최신 프레임으로 반영되기까지의 대기와 반복 작업을 줄이는 것**이다. 실제 native 실행·기능 정합성·총경로 성능은 각각 검증한다.
- 주 실행 환경은 Windows / Hermes bytecode / optimized / Release다. 현재 모니터 설정을 유지하며 일반 사용 **60fps 이상**을 기존 수락 기준으로 사용한다. 모니터 변경이나 새로운 60fps cap을 요구하지 않는다.
- 구현·비교 전까지 일반 App 기본값 TS, 기존 후보 NO_ADOPTION, 제품 PARTIAL, performanceAccepted=false, resizePerformanceAccepted=false를 유지한다. 새 후보의 채택 상태는 **PENDING / 미구현·미측정**이며 이번 터치패드 증상의 성능 수락은 notVerified다.

현재 공급 identity·창 크기·DPI·주사율·물리 터치패드 timing은 이번 문서 작업에서 새로 측정하지 않았다. 과거 제품의 수치를 새로운 C++ 공급의 before/after로 사용하지 않는다.

## 2. 기존 분석을 구현 책임으로 바꾸기

| 현재 코드와 분석 | C++ 구현 책임 | TS에 남는 책임 |
| --- | --- | --- |
| DirectManipulation을 UI의 14ms WM_TIMER로 갱신하고, 이후 별도 frame tick에서 입력 처리 | W7-P1: 입력 수집 시점과 native frame wake를 조율하고 순서 있는 입력 batch 전달 | gesture arena·drag·scroll position·사용자 입력 callback |
| native 완료 뒤 입장 여유를 JS tick에서 확인하며 준비 프레임이 보류됨 | W7-P2: 완료·credit 변화를 native에서 통지하고 유효한 최신 준비 프레임의 재개 조율 | 현재 상태 검증·CPU scene 구성·공개 frame callback 실행 |
| pointerHitTest와 post-frame hover 대상 탐색이 TS에 남음 | W7-H: 지원 계약이 있는 숫자 geometry의 순서 있는 hit-path 질의 | 실제 RenderObject/annotation 해석·custom hook·callback·cursor/enter/exit 전송 |
| Gallery의 optional 보존 한도와 동기 child 생성 때문에 예열 뒤에도 재구성 가능 | W7-L: 같은 예산 안에서 section 보존·퇴출·다음 준비 후보를 결정 | Element 생성·보존 bucket 반영·layout·사용자 State 수명 |

W7-P1/P2는 **이미 C++인 Windows host의 책임과 전달 구조를 바꾸는 작업**이다. W7-H는 기존 편집기 retained input geometry와 별도의 pointer 질의다. W7-L은 전체 Widget 엔진의 C++ 이관이 아니라 기존 sliver 수명 정책의 native 조율이다. [work6 §13–14](work6.md)의 Flex 숫자 계산·text transaction·frame segment·backing 재사용과 실행 집계를 구분한다.

### 2.1 유지할 분석 근거와 한계

- [WindowsPrecisionTrackpad](Nelyx/skia/native/host/windows/WindowsPrecisionTrackpad.h)는 MANUALUPDATE와 SetTimer(14ms)를 사용한다. 실제 간격이 정확히 14ms라는 보장은 없다. [MANUALUPDATE](https://learn.microsoft.com/en-us/windows/win32/api/directmanipulation/ne-directmanipulation-directmanipulation_viewport_options)와 낮은 우선순위의 [WM_TIMER](https://learn.microsoft.com/en-us/windows/win32/winmsg/wm-timer)는 입력 생산과 UI 부하의 관계를 확인할 근거다. 타이머 설정 자체를 현재 원인으로 확정하지 않았다.
- [GestureBinding](Nelyx/src/framework/gestures/binding.ts)의 resampling은 기본 off이며 기존 resampler는 touch만 처리한다. Trackpad는 시작 hit-path를 저장하고 update에서 재사용한다. 손가락 접촉 중 이동과 손을 뗀 뒤의 관성 애니메이션은 분리한다.
- [work4 §9.3](work4.md)의 2.9347–3.1648ms/frame은 **과거 OS wheel 입력 hit-test와 post-frame hit-test의 합산 wall**이다. 한 번의 질의 비용이나 현재 물리 터치패드 비용이 아니다. 이후 bounds·자식 snapshot 최적화도 있어 현재 비용은 다시 확인해야 한다.
- [work6 §13.1](work6.md)에서 N4 import 준비 평균은 primary 1.798→0.082ms/frame, secondary 1.912→0.082ms/frame였지만 전체 입력 surface FPS는 53.447→54.252 / 44.100→44.025였다. 진단 owner 각 1회와 cadence 3쌍을 구분한다. 다른 단계가 남는다는 단서이며 GPU/driver나 단일 함수의 병목 확정은 아니다.
- [Gallery](sample/nelyx-testbed-app-2/src/gallery.ts)의 capacity 2는 각 sliver의 **화면 밖 optional section 보존 한도**다. 가시 child를 총 두 개로 제한하는 값이 아니다. Editor의 명시적 keep-alive와 [TextLayoutCache](Nelyx/src/hosting/text-layout-cache.ts)의 별도 자원 수명을 구분한다.

기존 자동 성능 비교의 [OS wheel 주입](Nelyx/eng/tests/windows-continuous-scroll.ps1)은 실제 DirectManipulation·panZoom 입력 경로를 대신하지 않는다. 이 차이를 W7-P1 구현과 검증에 반영한다.

## 3. 공통 구조·소유권·예산

### 3.1 native owner와 얇은 TS 연결

Windows host에 **WindowsScrollCoordinator** 역할을 추가하거나 기존 동등 owner를 확장한다. 이 이름은 설계상 명칭이며 현재 클래스가 존재한다는 뜻은 아니다. 하나의 view owner 아래에서 input boundary, compositor tick, native completion, visibility/close를 조율한다.

공통 숫자 상태·packet 검증·pointer 질의·section 결정은 기존 [native/core](Nelyx/skia/native/core/)에 둔다. Win32/COM·UI dispatcher·CallInvoker 연결은 기존 Windows host/RN adapter에 둔다. JSI adapter는 검증한 native 값과 서비스 호출만 연결한다. 별도 DLL·VM·Wasm이나 병렬 framework 트리를 필수로 추가하지 않는다.

[ViewRuntime](Nelyx/src/hosting/runtime.ts), [native input](Nelyx/sdk/src/backends/react-native/input.ts), [surface frame clock](Nelyx/sdk/src/runtime/frame-clock.ts), [native engine](Nelyx/sdk/src/runtime/native-engine.ts)에 새 capability와 수명 연결을 추가한다. 기존 순서와 오류 처리를 보존할 수 있도록 모듈별 선택이 가능해야 한다.

### 3.2 세대와 실행 문맥

- owner/view/surface/context generation, input sequence, frame sequence, layout/geometry/section revision을 packet과 결과에 포함한다.
- Win32/DirectManipulation 작업은 원래 UI owner에서 실행한다. 타이머·GPU worker는 UI 작업을 예약하며 COM 객체나 JS callback을 임의 스레드에서 호출하지 않는다.
- Native는 JS 객체·함수·Runtime 참조·반환 뒤의 JS buffer 포인터를 보유하지 않는다. 숫자 ID·복사한 값과 명시적인 native resource hold만 보유한다.
- callback 재진입, prototype/getter 변경, detach/reparent, resize·context 교체, hide·close 뒤의 late wake를 별도 계약으로 다룬다.
- C++ 계산은 TS Number와 맞는 double 및 현재 matrix·clip 의미를 유지한다. fast-math로 결과를 바꾸지 않는다.

### 3.3 기존 한도를 재사용한다

- 입력은 기존 **256-packet** 한도를 기준으로 native→JS 전체 미소비 구간의 accounting을 정한다. native 큐와 기존 mailbox에 각각 256개를 쌓는 방식으로 숨은 총량 증가를 만들지 않는다.
- CPU pending 1, native recording 2, 현재 backing/frame resource 예산을 유지한다. Fence·producer/consumer ACK·retirement 조건을 삭제하지 않는다.
- Section optional 한도는 Gallery의 sliver별 2, View 전체 children 16 / Elements 2,048을 유지한다. 필수·가시 child와 명시적 editor keep-alive를 optional 희생 대상으로 쓰지 않는다.
- Paragraph index 128 / resident 64 / units 65,536 / 입력 metadata 1MiB와 기존 Picture·image 예산을 재사용한다. 별도의 native 캐시로 같은 자원을 중복 보유하지 않는다.
- 새 protocol의 node/depth/bytes·scratch·반환 buffer 상한은 첫 구현 단계에서 schema 상수와 실제 비용식으로 확정한다. 정수성·overflow·세대·예산을 allocation/cast 전에 검사하며 제품 전체 RSS/GPU 메모리 측정과 구분한다.

## 4. W7-P1 — native 입력 수집과 frame batch

### 4.1 구현할 경로

현재 경로는 UI WM_TIMER → DirectManipulation Update → Fabric 이벤트 → JS mailbox → 별도 DWM tick이다. 새 후보는 **native의 공통 wake 조율 → UI의 Update → 봉인된 input batch → JS owner의 같은 frame 처리**로 연결한다.

[CompositorFrameClock](Nelyx/skia/native/host/windows/CompositorFrameClock.h)의 대기 구조와 [RNSkWindowsHost](Nelyx/skia/packages/rn/native/windows/RNSkWindowsHost.h)의 전달 연결을 확장한다. 활성 contact·입력 수요가 있을 때 native wake가 UI에 한 번의 Update를 예약하고, 그 결과의 batch 준비 뒤 JS dispatch를 요청한다. 원래 UI 문맥과 idle 정지를 보존하며 JS draw나 GPU credit이 없어도 접촉·종료 입력은 계속 진행돼야 한다.

일반 WM_TIMER의 주기만 낮추는 것으로 완료하지 않는다. native wake와 UI Update의 시점·중복 예약·JS 전달 순서를 실제로 조율하고, UI가 바쁠 때 생기는 잔여 지연도 관측한다.

### 4.2 입력 batch 계약

- 원래 panZoomStart/update/end·inertiaCancel 및 다른 입력 boundary의 순서를 보존한다. Boundary가 오면 그 이전 update를 먼저 전달하고 해당 boundary를 진행한다.
- 같은 입력을 Fabric 경로와 새 batch 경로로 중복 전달하지 않는다. 실제 선택 경로와 owner/input sequence로 중복을 거부한다.
- Batch는 original sample·delta·cumulative pan·생성 QPC·전달 QPC를 유지한다. 센서의 원래 표본 시각을 관측한 것처럼 timestamp를 만들어 넣지 않는다.
- 기본 구현은 packet별 framework callback과 총 delta를 보존한다. 단순 합산·중간 callback 생략으로 성능을 만들지 않는다. 여러 update를 한 번의 JS 진입으로 전달하더라도 각 event의 관찰 가능한 순서는 유지한다.
- 큐가 가득 찼을 때 원래 boundary/전달 순서를 유지하는 bounded drain 또는 명시적 실패를 정의한다. 조용한 packet 유실·임의 순서 변경은 허용하지 않는다.
- Start/end·키·focus·metrics 변경과 renderer busy는 서로 다른 사건이다. 입력 수명을 GPU 입장 여유에 종속시키지 않는다.

기존의 보간 부재는 우선 **C++가 실제 transform을 읽는 시점과 frame 처리를 맞추는 문제**로 재해석한다. 이 범위에서 trackpad physics·예측·외삽을 새로 넣거나 TS touch resampling 옵션만 켜지 않는다. 별도 보간을 추가하려면 raw callback·velocity·종료/반전 의미를 보존하는 별도 계약과 비교가 필요하다.

### 4.3 완료 기준

실제 Testbed 접촉 구간에서 native Update·sample·batch·JS drain 수를 대조하고 0·누락·불일치를 실패로 판정한다. 정지→시작·연속·반전·손 뗌·관성·재접촉과 busy/hide/close에서도 유실·중복·stale owner 전달이 없어야 한다. Native timer worker의 깨움 자체를 표시 성공이나 성능 개선으로 세지 않는다.

## 5. W7-P2 — native 완료 통지와 최신 프레임 재개

### 5.1 변경할 소유·재개 경계

[GraphiteRenderer](Nelyx/skia/packages/native/src/renderer.ts)는 통지를 poll하고 native stats를 확인한다. [RNSkGraphiteTarget](Nelyx/skia/native/adapters/jsi/cpp/rnskia/RNSkGraphiteTarget.h)은 완료 통지를 저장하고, [RNSkView](Nelyx/skia/native/adapters/jsi/cpp/rnskia/RNSkView.h)와 [Windows window surface](Nelyx/skia/packages/rn/native/windows/RNSkWindowsWindowSurface.h)는 표시·copy retirement 완료 뒤 다음 처리를 허용한다.

새 후보는 native가 **입장 여유를 바꾼 실제 사건**을 coordinator에 알리고, pending CPU frame이나 새 입력이 있을 때 JS owner에 합쳐진 재개 요청을 보낸다. native 완료마다 별도 JS task·timer를 무제한 만들지 않으며, 이미 예약된 입력/frame task와 합친다.

Wake reason은 compositor tick, input boundary, native credit, visibility/lifecycle로 구분한다. Completion wake를 새 vsync·새 animation timestamp·표시 receipt로 위장하지 않는다. 새 CPU frame이 필요한 경우와 이미 준비한 frame의 admission 재시도도 구분한다.

### 5.2 최신 입력과 프레임 순서

- Native 미소비 input watermark와 JS mailbox의 입력을 함께 확인한다. 새 입력이 있는데 sequence가 아직 dispatch되지 않았다는 이유만으로 이전 준비 frame을 먼저 제출하지 않는 후보 정책을 구현한다.
- 입력 drain → 현재 owner/geometry/scene 확인 → 필요하면 CPU 준비 frame 교체 → 유효한 frame 입장의 순서를 정한다. callback·explicit redraw·persistent animation 요청을 빠뜨리지 않는다.
- Native 여유가 없는 동안은 기존 CPU pending 1을 유지하고 매 busy tick마다 scene을 다시 구성하지 않는다. Credit 반환 뒤에는 최신 입력이 반영된 frame으로 재개한다.
- Completion 시점에 안전한 현재 준비 frame이 있으면 불필요한 추가 compositor 대기 없이 admission 재시도를 할 수 있게 한다. 유효하지 않으면 기존 frame 정책으로 재구성하며, 이전 deadline을 새 work의 유효 deadline으로 재사용하지 않는다.
- 통지 수신 중 close/metrics 교체·새 입력·submit 재진입이 생기면 기존 세대·lease·오류 규칙을 적용한다. Credit은 이전 화면용 recording과 실제 native hold까지 포함한다.

### 5.3 GPU 수명과 실제 이득

[CompositionSurface](Nelyx/skia/packages/rn/native/windows/CompositionSurface.h)의 busy, producer 완료·UI copy·consumer ACK, [GpuContext](Nelyx/skia/native/platforms/vulkan/gpu_context.cpp)의 완료 확인을 유지한다. GPU worker의 wait를 삭제하거나 native recording 수를 늘리는 방식으로 재개 비용을 숨기지 않는다.

이 작업의 1차 목표는 **완료 → 입장 가능 상태 공개 → 다음 제출 사이의 대기**를 줄이는 것이다. 하나의 backing을 재사용하는 현재 직렬 구조를 완전한 다중 frame pipeline으로 바꿨다고 표시하지 않는다. 이 구간을 줄인 뒤에도 producer/copy가 지배하면 해당 별도 구조 변경을 이 계획의 성과로 미리 계산하지 않는다.

실제 재개 횟수·동시 예약 peak·native credit 변화·준비 frame age·재개 후 input sequence·retirement 균형을 검사하고, 제출/표시 cadence와 입력 나이를 함께 비교한다.

## 6. W7-H — 편집기 geometry와 구별되는 C++ pointer 질의

### 6.1 구현 목표

[FrameworkRoot.pointerHitTest](Nelyx/src/framework/widgets/root.ts), [RenderBox.hitTest](Nelyx/src/framework/rendering/object.ts), [MouseTracker](Nelyx/src/framework/rendering/mouse-tracker.ts)의 숫자 geometry 처리에서 **지원되는 표준 영역의 순서 있는 후보·hit path와 local transform 계산**을 native 서비스로 만든다.

기존 [input_geometry core](Nelyx/skia/native/core/input_geometry.cpp)의 검증·행렬 계산·세대 관리 중 맞는 부분은 재사용하되, 편집기 좌표 API에 pointer 질의를 실행한 것처럼 집계하지 않는다. 별도의 pointer capability/version·query 수·실제 native 방문 수를 제공한다.

### 6.2 지원 계약을 먼저 구현한다

- 첫 범위는 표준 box bounds·child paint 순서·지원하는 transform/clip·hit-test behavior다. 지원 행렬과 opaque/translucent/defer 동작, invisible·singular·perspective·zero-size 처리를 TS 기준과 정의한다.
- Native는 opaque target ID·숫자 geometry·부모/자식 순서만 보유한다. 반환 path를 현재 TS RenderObject/annotation에 매핑하고 callback은 원래 JS owner와 순서에서 실행한다.
- Layout/paint/attach/detach/scroll 생산 지점에서 변경을 전달한다. 같은 전체 node table을 매 packet 복제하거나 TS와 C++가 같은 트리를 각각 전수 계산하는 것을 최종 fast path로 채택하지 않는다.
- **Setter 밖의 prototype/getter·hit hook 변경은 layout revision 하나로 검출되지 않는다.** 이벤트 시점의 현재 구현·geometry를 증명하는 지원 판정과 검증 계약을 먼저 작성한다. 표준으로 증명할 수 없는 경계는 TS로 실행하고 사유를 남긴다.
- Static snapshot만 맞춘 구현은 reference/control이다. 새 후보의 실제 완료 조건은 현재 live hook의 관찰 순서를 보존하면서, 실제 장면의 지원 구간에서 native 질의가 실행되는 것이다.
- Custom hit-test/visitor·동적 getter·callback 중 트리 변경·nested scroll·source entry override는 기존 TS 의미를 보존한다. 증명되지 않은 경계를 이전 frame snapshot으로 질의하거나 후보 path만 검증해서, 새로 겹친 다른 target을 놓치면 안 된다.
- 이 계약을 일반 RenderObject에 성립시키기 어렵다면 명시적으로 닫힌 표준 subtree 계약부터 지원한다. 지원 밖을 조용히 native 처리하거나 일반 TS API의 변경 관찰 가능성을 제한하지 않는다. 지원 범위 축소·fallback-only는 완료 상태에 그대로 드러낸다.

### 6.3 연결 순서와 실행 검증

먼저 frame 뒤의 지원 가능한 hover 숫자 질의를 연결하고, 이어 wheel·panZoomStart의 현재 상태 질의를 연결한다. Trackpad update의 기존 저장 hit-path 재사용은 유지한다. Enter/exit·cursor·target callback을 줄이는 것과 숫자 탐색을 C++에서 실행하는 것을 구분한다.

Native query·candidate/visited node·반환 path·업데이트 bytes와 TS 지원 판정·검증·fallback 비용을 함께 보고한다. 기존 mouse/pen 상태가 없거나 trackpad update만 있는 무수요 구간을 native hit-test 성공으로 세지 않는다. 실제 Gallery의 지원 대상 구간에 native 작업이 없으면 해당 모듈의 실행 검증 실패다.

변경 시 input-geometry와 retained-input-geometry 검사, 실제 Gallery → Mixed·편집기 복귀 회귀를 유지한다. 지원 계약 검사를 통과하지 못한 범위를 성능 비교나 all 통합 완료로 올리지 않는다.

## 7. W7-L — 같은 예산에서 C++가 조율하는 section 보존·준비

### 7.1 옮길 책임

[SliverMultiBoxAdaptorElement](Nelyx/src/framework/widgets/sliver.ts)와 [ViewWorkBudget](Nelyx/src/framework/widgets/view-work-budget.ts)의 optional section 정책에 native session을 연결한다. Native 입력은 section ID/세대, extent·현재 가시/cache 범위, 이동 방향, Element 개수 변화, resource pressure, 이전 생성 비용, deadline/queue delay/clock uncertainty다.

Native는 retain/evict/prepare 후보를 결정하고, TS는 기존 layout callback·build scope에서 실제 bucket·Element 수명을 변경한다. JS callback·Element 포인터·Widget factory를 C++ worker에 넘기지 않는다. Native와 TS에 독립적인 예산 관리자를 두지 않고, native 결정·TS 적용 결과를 하나의 transaction으로 대조한다.

### 7.2 같은 capacity에서 재사용을 늘리는 정책

- 현재 required/visible child와 [GallerySection](sample/nelyx-testbed-app-2/src/gallery-section.ts)의 명시적 editor keep-alive를 보존한다.
- Optional capacity가 찼을 때 단순히 새 보존을 포기하는 동작과 비교해, 현재 위치·방향·재접촉/반전 정보에 따른 보존 후보 선택을 native에서 수행한다. 가까운 복귀 후보의 실제 hit와 잘못된 예측에 의한 재생성을 모두 센다.
- Evict→retain 교체는 기존 허용 layout scope에서 적용하고, 중간에 optional Element·자원 한도를 초과하지 않는다. callback 예외·close·세대 변경이면 결과를 폐기하거나 기존 수명 규칙으로 정리한다.
- 작은 왕복·같은 가시 범위에서 불필요한 section 재생성이 없도록 하고, 긴 이동·반전에서 유지할 section 선택을 비교한다. 모든 section 영구 keep-alive나 capacity 확대는 구현 목표가 아니다.

### 7.3 다음 section 준비와 자원 재사용

현재 Gallery의 preparation은 disabled다. 새 section-lifetime 선택 모드에서만 기존 observed-budget 경로를 연결하고 C++ 결정으로 다음 후보를 선택한다. 기존의 한 tick당 최대 한 비선점 작업, 관측 deadline, 생성 비용 2ms 이하·여유 4ms 및 queue delay/uncertainty 조건을 기준으로 시작한다. 기준을 맞추려고 비용을 과소평가하거나 deadline이 없는 frame에 optional build를 강제하지 않는다.

실제 Widget/Element 생성·layout은 TS owner가 실행한다. C++는 준비·보존의 시점과 대상·허용량을 결정하며, 무거운 custom build를 중간에서 선점할 수 있다고 설명하지 않는다. 첫 필수 생성의 긴 frame이 남을 수 있다는 한계도 유지한다.

[RenderSliverList](Nelyx/src/framework/rendering/sliver-list.ts)와 [RenderSliverMultiBoxAdaptor](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts)의 실제 create/obtain/remove와 section ID를 연결한다. [NativeTextLayoutService](Nelyx/skia/packages/native/src/text.ts)·기존 paragraph/Picture cache를 재사용하고, N2 transaction과 별도의 native paragraph cache를 추가하지 않는다. Element 재mount와 paragraph miss, TS description/key 준비를 각각 센다.

### 7.4 완료 기준

같은 가시 구간·최초 진입·이미 방문한 section 복귀를 나눠 native retain/evict/prepare 결정과 실제 적용·hit/miss·생성 시간을 대조한다. SectionExtentIndex의 measured 상태를 Element/native resource 상주로 치환하지 않는다. Native가 후보를 계산했어도 TS 생성 비용이나 재생성이 줄지 않으면 그 결과를 그대로 보고하며, 예산·입력·기능 회귀 없이 전체 이동의 순이득이 있어야 채택한다.

## 8. 구현 순서와 실행 선택

| 단계 | 구체적인 산출물 | 완료 기준 |
| --- | --- | --- |
| W7-0 기준·protocol | 현재 제품 identity, 물리 입력 구간, 네 모듈의 지원 계약·예산·capability·native counters 정의 | 기존 분석과 새 기준 분리. 미관찰을 0으로 쓰지 않음 |
| W7-1 입력 batch | W7-P1 coordinator·UI Update 조율·JS drain 연결 | 실제 접촉 중 native 실행·delta/순서·수명 검증 |
| W7-2 credit 재개 | W7-P2 완료 통지·최신 입력 watermark·pending 재개 연결 | 실제 완료→다음 제출 연결, 중복 wake·stale 제출·유실 0 |
| W7-3 pointer 질의 | W7-H 지원 계약·C++ 질의·TS callback 연결 | differential·live mutation 회귀와 실제 장면 native 실행. fallback-only를 완료로 표시하지 않음 |
| W7-4 section 수명 | W7-L native 정책·TS 적용 transaction·bounded 준비 | 기존 예산과 editor 수명 유지, 실제 native 결정·재사용·재생성 집계 |
| W7-5 독립 비교·통합 | 모듈별 비교, 필요한 조합, all 연결·일반 App 복구 | 실제 실행·기능·성능·정리 결과를 각각 판정 |

각 모듈은 구현·실행 검증까지 진행하고 **성능 채택은 비교 후** 결정한다. 시작 전에 모든 원인의 지배 비중이 확정될 때까지 구현을 미루는 계획으로 두지 않는다. 다만 올바른 지원 계약과 수명을 증명하지 못한 범위를 연결 완료로 간주하지 않는다.

### 8.1 선택 모드와 API 상태

기존 [run-native-modules](Nelyx/eng/run-native-modules.mjs)의 선택·시작 검증·종료 보고를 확장한다. 새 선택 이름의 초안은 다음과 같다.

| 계획 모드 | 선택할 기능 |
| --- | --- |
| scroll-input | W7-P1 |
| scroll-frame | W7-P2 |
| pointer-targets | W7-H |
| section-lifetime | W7-L |
| scroll | 네 모듈의 검증된 조합 |

**위 모드와 새 API는 현재 미구현이다.** CLI parser·fixture·SDK·native capability·실행 verifier가 모두 연결된 뒤에만 사용 가능한 명령으로 안내한다. 각 모듈의 독립 검증 뒤 사용자용 all에 통합하며, 이름만 all에 추가하고 실제 기능이 꺼진 상태로 완료하지 않는다.

명시적으로 선택한 capability가 없으면 시작 실패다. 의도적으로 off인 모듈과 stale 공급·연결 누락을 구분한다. 기존 retained geometry·Path/Paint·Scene·Semantics·Flex/text/frame/backing의 선택과 보고도 보존한다.

## 9. 검증·성능 판정·공급

### 9.1 실제 native 실행을 증명한다

- Native 내부에서 input Update/sample/batch, credit/completion/wake, hit query/방문, section decision/retain/evict/prepare를 모듈별로 센다. TS에서 준비한 항목 수만으로 native 실행을 선언하지 않는다.
- 입력 구간 안에 완전히 포함된 QPC bucket과 독립 SDK 집계를 대조하고 TS fallback 횟수·사유·지원률을 함께 보고한다.
- Startup-only·다른 장면의 작업·무수요 control로 빈 구간을 채우지 않는다. 작업 0·관측 누락·SDK/native 불일치·fallback-only는 해당 모듈의 C++ 성능 판정 실패다.
- 수동 모드의 counters-only 결과는 native 작업·정리 확인용이며 자동 timing bucket이나 물리 터치패드 성능 증거로 수락하지 않는다.
- 닫힌 owner의 pending wake/input/session·metadata·native hold가 0이고 GPU/input drain·정상 exit가 완료돼야 한다.

### 9.2 기능·정확성 회귀

변경 계약에 맞춰 기존 검사를 사용하고, 새 coordinator·질의·section transaction의 실제 동작에 필요한 회귀를 보강한다.

- P1/P2: [Windows precision](Nelyx/eng/tests/windows-precision.test.mjs), [frame clock](Nelyx/eng/tests/react-native-frame-clock.test.mjs), [frame backpressure](Nelyx/eng/tests/frame-backpressure.test.mjs), runtime close·visibility·resize·late callback·복수 view 공정성.
- H: [input geometry](Nelyx/eng/tests/input-geometry-integration.test.mjs), [retained geometry](Nelyx/eng/tests/retained-input-geometry.test.mjs), TS/native hit-path·transform 차등 비교, custom getter/prototype 변경·이벤트 사이 mutation·nested scroll·hover enter/exit·cursor·callback 순서.
- L: [bounded sliver](Nelyx/eng/tests/bounded-sliver.test.mjs), [optional work](Nelyx/eng/tests/optional-sliver-work.test.mjs), [dormant sliver](Nelyx/eng/tests/dormant-sliver.test.mjs), section index·Element 수명·text cache·paragraph retirement.
- 공통: 실제 Gallery 양 열 → Mixed의 12 fields/36 buttons·스크롤 뒤 재클릭 없는 입력·한국어 IME 조합/확정/undo → 같은 owner의 Gallery 복귀, 창 전환·그림자·자원 drain.

입력 geometry를 변경하면 기존 필수 명령을 실행한다.

    npm.cmd run test:input-geometry
    npm.cmd run test:retained-input-geometry

기존 서비스 비교·전체 구간을 변경하면 해당 audit와 full-range 회귀를 실행하고, 기존 후보 비교에는 저장소 지침의 명령을 유지한다.

    npm.cmd run test:native-service-audit
    npm.cmd run experiment:native-services -- --trials=3 --functional
    npm.cmd run test:gallery-full-range

이 명령만으로 새 네 모듈의 실행·물리 입력 검증을 대신하지 않는다. 관련 검사 timeout은 **1,200,000ms**, 대부분의 반복은 **30회 이내**로 유지한다. 같은 검사를 문서 상태 때문에 반복하지 않는다.

### 9.3 실제 터치패드와 전체 구간 비교

1. 평소 일반 명령과 C++ 선택 명령의 현재 native/SDK/App identity·실제 선택을 확인한다. 기존 명령은 아래와 같으며 이번 문서 작업에서는 실행하지 않았다.

       npm.cmd run run:windows --workspace @nelyx/testbed-2
       npm.cmd run run:windows:cpp

2. 같은 창·DPI·theme·locale·모니터 설정에서 All components 양 열을 work6의 전체 section 준비 gate로 예열한다. 측정된 extent와 Element/자원 상주를 구분한다.
3. **실제 두 손가락 접촉 이동·반전·손 뗀 뒤 관성·재접촉**을 주 증상 확인으로 둔다. 같은 가시 구간, 최초 section 진입, 기존 section 복귀를 구분하고 좌/우 열의 top→bottom coverage를 함께 확인한다.
4. 자동 비교는 전체 구간 native cadence·기능 control로 사용한다. 필요하면 같은 packet sequence의 panZoom 재생 도구를 추가하되, 물리 터치패드의 입력 수집·센서→poll timing 검증으로 치환하지 않는다. OS wheel은 별도 control이다.
5. 기준/후보는 동일 공급의 모듈 선택만 바꾼 fresh owners **3쌍**을 교차한다. 다른 build/test를 함께 실행하지 않고 상세 probe·pixel capture 실행은 일반 cadence와 분리한다. 실제 사람 입력의 속도·거리 차이도 숨기지 않는다.
6. 입력 emit→JS drain→offset→CPU 준비→submit→producer/surface→consumer ACK→다음 제출의 경계를 같은 식별로 연결한다. Input timestamp가 poll/생성 시각이면 센서 입력부터의 전체 지연이라고 쓰지 않는다.
7. 전체 입력 구간과 실제 연속 이동 구간의 surface cadence, 긴 gap·입력 나이·section별 mount/layout/cache miss, peak/live resource를 함께 보고한다. 포함·중첩 wall을 합산하거나 endpoint 대기·느린 frame을 임의로 제거하지 않는다.

지속적인 일반 사용 60fps와 체감 끊김을 별도 확인한다. Lazy load 중 일시적인 jitter는 기존 사용자 기준대로 별도 관찰하며, 이미 준비된 구간의 지속 저하를 그 예외로 숨기지 않는다. Surface 갱신을 측정했다면 surface FPS라고 쓰고 scanout 관측과 구분한다. Resize 성능 수락은 이 작업의 스크롤 결과로 자동 변경하지 않는다.

### 9.4 채택·공급·정리

정확성·수명·실제 실행을 통과한 후보별로 준비/전송/검증/반영까지 포함한 총경로를 비교한다. 국소 kernel 개선이나 native 호출 수 증가만으로 채택하지 않는다. 순이득이 없으면 구현·실행 증거와 기본 NO_ADOPTION을 구분해 남기며, 전체 일반 사용 기준 미달이면 제품 PARTIAL을 유지한다.

Canonical source만 편집하고 generated native 사본은 기존 공급 도구로 갱신한다. source→generated→현재 dist/archive→runner 설치본→실행 package를 대조하며, Web·Android의 TS 경로와 적용한 공통 변경의 회귀 범위를 확인한다. 미실행 플랫폼을 검증 완료로 확대하지 않는다.

실험 후 일반 App 소스·fixture를 복구하고 평소 명령으로 실제 TS 선택·현재 공급·정상 종료를 확인한다. 임시 파일·staging·소유 process는 성공/실패/중단 모두 finally에서 정리한다. 검증 로그·receipt·이전 SDK/package·checkpoint JSON을 누적하지 않고 현재 결과와 잔여 작업은 이 문서에 짧게 남긴다.

## 10. 현재 진행 상태

| 항목 | 현재 상태 |
| --- | --- |
| 기존 코드 분석과 사용자 입력 종류 확인 | 완료. 터치패드 두 손가락 스크롤 |
| C++ 책임·모듈별 작업·지원/수명 계약·검증 계획 | 이 문서로 재작성 완료 |
| W7-P1 / W7-P2 / W7-H / W7-L 구현 | 미착수 |
| 새 capability·선택 모드·all 통합·verifier | 미구현 |
| 새 native 빌드·실제 실행·비교·물리 터치패드 trace | 미실행 |
| 일반 App 기본값 / 기존 후보 채택 / 제품 | TS / NO_ADOPTION / PARTIAL 유지 |
| 새 후보 성능 채택 | PENDING / 미측정 |

앞선 분석에서 기존 frame-backpressure·react-native-frame-clock의 관련 회귀 **5 PASS / 0 FAIL**을 확인했다. Mailbox 순차 의미·front recording backpressure·credit 재개·polling의 기존 계약에 대한 결과이며 새 구현이나 물리 터치패드 성능의 증거가 아니다.

이번 요청에서는 **work7.md만 재작성**했다. 제품 코드 수정·native 재빌드·새 성능 비교·물리 입력 검증은 수행하지 않았고 기존 회귀도 재실행하지 않았다. 이후 구현 착수점은 W7-0의 protocol/실행 검증을 갖추는 작업과 W7-P1/P2의 native coordinator 연결이다.
