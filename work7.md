# Windows 스크롤 C++ 구현·검증 — 입력·프레임 재개·hit-test·섹션 수명

최초 분석: **2026-11-03 KST** · 계획 재작성·구현 시작: **2026-11-04 KST** · 상태: **PARTIAL / scroll starvation 수정·자동 회귀 scoped-pass / 물리 재확인 대기 / NO_ADOPTION / 60fps 미수락**

**이 문서는 기존 분석을 바탕으로 C++ 구현 작업을 정의한다.** 추가 수치 커널만 만드는 방식에서 범위를 넓혀, native가 터치패드 입력의 생산·배치, frame 재개 신호, 지원되는 입력 대상 질의, bounded section의 보존·준비 결정을 맡도록 한다. TS는 Widget/Element·사용자 callback과 framework의 공개 상태를 소유한다.

계획 재작성 뒤 사용자가 `/goal work7.md작업해줘 난 잘께`로 구현·검증을 요청했다. 아래 본문의 계획 계약과 실제 구현·검증 상태를 구분하며, 최신 진행 상태는 §11.9를 기준으로 한다. §11.1–11.5는 H v1 공급의 결과다.

## 1. 목표와 현재 기준

- 사용자는 [work6.md](work6.md)의 C++ 구현을 사용해도 **노트북 터치패드 두 손가락 스크롤**이 버벅인다고 보고했다.
- 계획 기준 HEAD는 9dcc2795ad80f3a66b1e6d374b8ff58a16a72a63이다. 이번 재작성 시작 시 변경은 앞서 작성한 미추적 work7.md뿐이었다.
- 이번 작업의 목표는 C++ 모듈의 수를 늘리는 것이 아니라 **실제 입력이 최신 프레임으로 반영되기까지의 대기와 반복 작업을 줄이는 것**이다. 실제 native 실행·기능 정합성·총경로 성능은 각각 검증한다.
- 주 실행 환경은 Windows / Hermes bytecode / optimized / Release다. 현재 모니터 설정을 유지하며 일반 사용 **60fps 이상**을 기존 수락 기준으로 사용한다. 모니터 변경이나 새로운 60fps cap을 요구하지 않는다.
- 구현·비교 전까지 일반 App 기본값 TS, 기존 후보 NO_ADOPTION, 제품 PARTIAL, performanceAccepted=false, resizePerformanceAccepted=false를 유지한다. 새 후보의 실제 구현·비교 결과는 §11을 따른다. 터치패드 증상의 물리 입력 성능 수락은 notVerified다.

계획 재작성 당시에는 공급 identity·창 크기·DPI·주사율·물리 터치패드 timing을 새로 측정하지 않았다. 이번 구현의 실제 identity·비교 결과는 §11을 따른다. 과거 제품의 수치를 새로운 C++ 공급의 before/after로 사용하지 않는다.

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

Windows host에 **WindowsScrollCoordinator** 역할을 추가하거나 기존 동등 owner를 확장한다. 구현된 클래스와 실제 지원 범위는 §11을 따른다. 하나의 view owner 아래에서 input boundary, compositor tick, native completion, visibility/close를 조율한다.

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

**계획 재작성 당시 위 모드와 새 API는 미구현이었다. 현재 구현·실행 결과는 §11을 따른다.** CLI parser·fixture·SDK·native capability·실행 verifier가 모두 연결된 뒤에만 사용 가능한 명령으로 안내한다. 각 모듈의 독립 검증 뒤 사용자용 all에 통합하며, 이름만 all에 추가하고 실제 기능이 꺼진 상태로 완료하지 않는다.

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

1. 평소 일반 명령과 C++ 선택 명령의 현재 native/SDK/App identity·실제 선택을 확인한다. 명령은 아래와 같으며 현재 실행 결과는 §11에 기록한다.

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

## 10. 계획 재작성 당시 상태 (구현 전 기록)

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

계획 재작성 요청 당시에는 **work7.md만 재작성**했다. 제품 코드 수정·native 재빌드·새 성능 비교·물리 입력 검증은 수행하지 않았고 기존 회귀도 재실행하지 않았다. 이후 구현 착수점은 W7-0의 protocol/실행 검증을 갖추는 작업과 W7-P1/P2의 native coordinator 연결이다.

## 11. 2026-11-04 구현 진행

착수 HEAD는 `ff7e29a957cd76a3257f1d0195587891a66655dc`이며 dirty 변경 없이 시작했다. §10은 앞선 계획 재작성의 기록이다.

| 모듈 | 구현과 현재 검증 범위 |
| --- | --- |
| W7-P1 | `WindowsScrollCoordinator`가 기존 compositor clock을 공유하고 UI Update·batch 봉인 뒤 JS frame을 요청한다. 활성 입력은 render/GPU 수요와 독립해 계속 poll한다. Fabric의 기존 pointer event에 protocol 2 batch를 전달하며 선택 경로에서 각 packet을 동기 dispatch하고 ACK한다. 누적 미소비 packet 한도 256, 유실 대신 명시적 실패, boundary 전 flush, view/surface 세대 검사를 연결했다. 실제 물리 contact trace는 아직 미관찰이다. |
| W7-P2 | 실제 GPU retirement와 recording slot 반환에서 native admission 신호를 발생시키고 JS-owner subscription으로 합친다. pending frame은 native watermark·mailbox drain 뒤 재시도한다. Credit wake에서 animation callback을 실행하거나 이전 deadline을 새 CPU work에 쓰지 않는다. 실제 제출 재개 집계를 별도 제공한다. |
| W7-H | v2 기본은 순수한 단일 자식 prefix의 bounds·translation·local point/transform을 C++에서 계산한다. Custom·분기 경계의 hitTest와 unwind의 현재 self/behavior hook은 TS에서 원래 순서대로 실행한다. 현행 public descriptor·불변 geometry·layout 문맥을 확인하고 변경 rows만 전송한다. v1의 닫힌 전체 subtree는 explicit `closed-reference` control로만 남긴다. 실제 새 공급 검증은 §11.6을 따른다. |
| W7-L | 기존 ViewWorkBudget의 실제 Element 회계를 C++ retain/evict/prepare transaction에 연결했다. Optional cached row만 기존 layout scope에서 퇴출하고 실제 Element 반환을 확인한 뒤 같은 capacity로 보존한다. Native 전용 자원 cache는 없다. 선택 모드에서만 Gallery observed-budget 준비를 켠다. |

Pointer 공통 한도는 tree 16 × 각 128 nodes, depth 32다. v2 prefix는 표준 ancestor 최대 32 + TS boundary 1, patch 최대 `(7+33×8)×8=2,168 bytes`, query 96 bytes, 결과 최대 `(4+33×11)×8=2,936 bytes`다. Closed reference의 patch/result 최대는 8,248 / 7,200 bytes다. Native는 숫자 row와 부모 ID만 보유한다. Section packet은 최대 `(16+17×8)×8=1,216 bytes`, 결과 40 bytes이며 canonical Element accounting의 transaction만 계산한다. 이 수치는 protocol storage 범위이며 전체 RSS/GPU 메모리 수치가 아니다.

선택 코드에 `scroll-input`, `scroll-frame`, `pointer-targets`, `section-lifetime`, `scroll`을 추가했다. SDK/native capability·실제 선택을 검사하고 새 SDK/native 집계 verifier를 연결했다. 명령·실행 verifier는 연결됐고 통합 `scroll`/`all`의 실제 기능·정리는 통과했다. 단독 UIA 기능 실패와 전체 구간 성능 비교 실패는 §11.3–11.4처럼 구분한다.

초기 자동 검사 결과: `test:native-scroll` **56 PASS**, input geometry **2 PASS**, retained geometry **7 PASS**, native module mode **8 PASS**, native service audit **4 PASS**, bounded/optional/dormant sliver·hit-transform·runtime close 묶음 **55 PASS**, 전체 `check:types` PASS. 후속 최종 검사는 §11.8을 따른다. Native RNW 정적 공급물 Release 재빌드 PASS. 이 결과는 물리 터치패드·표시·60fps 수락을 뜻하지 않는다.

최신 H의 입력 구간 실제 실행은 §11.8에서 확인했지만 지원 판정·전송·반영을 포함한 총경로는 TS보다 느리다. P1의 실제 접촉 trace, 일반 60fps와 기능 gate의 최종 상태도 §11.8을 따른다. 중간 캐시 두 개는 도구의 삭제 차단으로 남았다(§11.4). 입력 구간 안의 완전한 QPC bucket 비교와 수동 counters-only 결과를 구분한다. 기본 TS / NO_ADOPTION / 제품 PARTIAL / `performanceAccepted=false` / `resizePerformanceAccepted=false`를 유지한다.

### 11.1 첫 실제 통합 실행 — 실패 보존

`scroll` Release/Hermes bytecode/optimized 패키지의 native 입력은 `870db316ea43a53cba5c4896cd214d63423f4d6c6b311c7a219fda1206c3fc2c`, exe는 `c7e8bf465a6351cf68c723babe8ae06a7372c4829481aae05acd8d04d4c417d7`이었다. 실제 Gallery 양 열 → Mixed 12 fields/36 buttons, 재클릭 없는 입력 3회, 한국어 IME 조합/확정/undo는 통과했지만 같은 owner의 Gallery 복귀 후 최대 gap **1,000.6751ms / 653.9973ms**로 기존 350ms 회귀를 실패했다. 정상 종료는 `views=0 consumers=0 gpuDrained=1 inputRetired=1`이었다. Source/native diagnostics·desktop capture가 켜진 기능 owner이므로 그때의 surface FPS를 일반 cadence로 해석하지 않는다.

모듈별 원인을 분리하며 다음 수정을 적용했다. P1의 일반 wheel까지 동기 dispatch하던 연결을 원래 frame mailbox로 되돌리고 native outstanding와 JS mailbox의 합계 256 한도를 유지한다. 실제 protocol 2 panZoom batch는 packet별 동기 callback을 유지한다. Pointer SDK의 LRU는 root를 강하게 보유하지 않는 WeakMap + 숫자 tree LRU로 바꿔 떠난 장면의 RenderObject를 붙잡지 않게 했다. 이 변경 뒤 P1 단독은 아래 기능 회귀를 통과했으며 통합/H는 추가 수정 중이다.

첫 패키지 빌드에서는 포맷터가 실행 fixture App을 수정해 입력 identity 검사와 자동 rollback이 거부됐다. 이 빌드를 검증 결과로 쓰지 않았으며, 확인한 fixture 변경과 파일만 원복·삭제했다. 이후 formatter에서 실행 fixture를 제외했다. 로그·receipt·독립 소비자 사본은 추가 보관하지 않았다.


### 11.2 분리 실행과 현재 수정 범위

현재 canonical native supplier는 `dec419af731f0eba01e67fe8df95c98dafa99c1e9125c0bd4e9762ba91ff36bd`다. 모드별 자동 비교용 fixture는 native 등록 뒤 App 렌더 시점에 모드를 읽으며, 등록 전 모듈 평가 회귀도 통과했다. 같은 패키지에서 fresh owners를 만들고 normal App을 finally에서 복구한다. 실패한 기능 owner 뒤에도 나머지 독립 모드를 검사하되 최종 실패를 유지한다.

- TS 기준의 Gallery → Mixed 12 fields/36 buttons·재클릭 없는 입력·한국어 IME → Gallery 복귀와 정상 종료는 통과했다.
- P1 단독 OS-wheel 기능 control은 통과했다. 복귀 네 구간 최대 gap은 96.2151 / 139.6540 / 96.6644 / 91.8767ms였고, pending native/JS packets·mailbox owners는 0이었다. 실제 DirectManipulation 접촉이 없어 native input은 `notObserved`이며 P1 실행/성능 수락은 아니다.
- P2 단독은 실제 credit 재제출 191회 / 시도 197회, native wake 4,138회를 SDK와 대조했고 기능 회귀·구독 회수·정상 종료를 통과했다. 복귀 최대 gap 121.3443ms는 diagnostics/capture owner의 기능 결과다.
- H는 native 질의 611회 / 방문 1,388 / patch 2,400 bytes를 대조했지만 TS fallback 483,981회와 복귀 최대 gap 679.1215ms로 기능 gate를 실패했다. Bounds 밖의 subtree 지원 검사를 제거한 것만으로는 충분하지 않았다. 현재 등록된 표준 prototype만 지원하고, 질의 안에서 순수 prototype descriptor를 재사용하며, custom/proxy prototype은 TS로 실행하도록 범위를 좁혔다. Prototype proxy의 callback 순서 차등 검사와 필수 geometry 검사를 통과했으며 후속 실제 결과는 §11.3과 같다.
- L은 실제 결정 560회 / retain 42 / evict 5를 대조했고, 실제 canonical record 반환 뒤 적용된 retain 37 / evict 5를 확인했다. Native evict 요청이 즉시 unmount되지 않으면 기존 charge를 유지하며 마지막 Element 회계 반환에서만 적용을 센다. 실제 prepare는 0이므로 준비 효과는 `notObserved`다.
- 일부 owner의 UIA navigation은 화면이 전환된 뒤 `ElementNotAvailableException`(HRESULT -2147220991)로 실패했다. Native 액션 전달을 한 UI hop 미루는 시도는 해결을 증명하지 못해 원복했다. [Microsoft UIA threading 안내](https://learn.microsoft.com/en-us/windows/win32/winauto/uiauto-threading)에 따라 기존 자동화 helper를 MTA로도 실행했지만 후속 단독 owner에서 오류가 남았다. Invoke 재시도·예외 무시·350ms gate 완화는 하지 않는다.

자동 검사에는 native-scroll 56, geometry 2, retained geometry 7, Windows semantics 12, bounded/optional/dormant + native section 24 PASS가 포함된다. Type/lint PASS. 일반 App 기본 TS / 새 후보 NO_ADOPTION / 제품 PARTIAL과 두 performanceAccepted=false를 유지한다. 물리 터치패드와 일반 60fps는 아직 notVerified다.


### 11.3 H v1 공급의 전체 구간 3쌍 비교 — NO_ADOPTION

`experiment:native-scroll -- --trials=3 --modes=ts,scroll-frame,pointer-targets,section-lifetime,scroll-input,scroll --functional`을 실행했다. 같은 Release/Hermes bytecode/optimized 공급에서 모드 순서를 교차한 fresh owners 18개, 각 owner 양 열의 top→bottom 2개 입력 구간을 사용했다. Source frame probe·capture 없는 cadence owner와 diagnostics/capture 기능 owner를 구분했다. 모든 cadence owner의 전체 section coverage와 native/SDK 정리는 통과했다.

비교 package identity는 manifest `571236cd8d79884a693e48723ba8bfd22c84ac64482be63bd2b18d3b50863612`, exe `f7671dd75a14728845a327c5607263414556af9b0fdda9a63455e3b11a300384`, SDK `2904d8b442e4460da88c7863d468a6ff9d8ee53c29203c962c51c633415e1ddb`, native `dec419af731f0eba01e67fe8df95c98dafa99c1e9125c0bd4e9762ba91ff36bd`였다. 아래는 3회 평균 **surface FPS**이며 scanout/물리 입력 FPS가 아니다.

| 모드 | primary | secondary | 입력 구간 안 native QPC 판정 |
| --- | ---: | ---: | --- |
| TS control | 52.45 | 45.87 | native 후보 off |
| scroll-frame | 52.43 | 41.52 | 6/6 구간 실제 submit·credit·wake 관측 |
| pointer-targets | 41.88 | 33.50 | owner 질의 각 61회지만 6/6 입력 구간 작업 0. 성능 비교 실패 |
| section-lifetime | 52.97 | 44.78 | 6/6 구간 실제 decision 관측. 각 owner applied retain 22 / evict 11 / prepare 0 |
| scroll-input | 52.86 | 44.61 | 실제 DM contact 없음. 6/6 입력 구간 작업 0. OS-wheel control |
| scroll | 43.12 | 31.70 | P2/L은 관측, P1/H는 입력 구간 작업 0. 통합 성능 비교 실패 |

H는 현재 범위의 지원 판정 비용과 낮은 지원률 때문에 TS보다 느리며, startup/seek 작업으로 빈 입력 구간을 채우지 않았다. P2/L도 전체 구간의 일관된 순이득이나 60fps를 증명하지 못했다. 모든 새 후보의 **NO_ADOPTION**을 유지하며 일반 App 기본을 변경하지 않는다. `FAIL_NO_NATIVE_WORK_IN_SOME_LEGS` 판정은 유지된다. 이번 명령은 추가 기능 owner 실패가 함께 있어 최종 exit 1이었다. 정상적인 no-native-work 단독 결과의 exit 2 계약은 바꾸지 않았다.

같은 공급의 기능 owner에서 TS, P1 control, 통합 scroll은 Gallery → Mixed 12 fields/36 buttons·재클릭 없는 입력·한국어 IME → Gallery 복귀와 정상 종료를 통과했다. 복귀 최대 gap은 각각 132.9709 / 120.8327 / 242.4725ms였다. 통합 native/SDK 결과는 H queries 253 / visits 506 / patch 920 bytes, L decisions 656 / applied retain 73 / applied evict 14 / prepare 0, P2 actual resume submissions 95였고, pending input·mailbox·credit subscriptions는 모두 0이었다. H의 입력 구간 timing gate가 통과했다는 뜻은 아니다.

P2/H/L 단독 기능 owner는 Mixed 화면 전환 직후 UIA Invoke가 `ElementNotAvailableException`으로 실패했다. MTA 변경으로 해결됐다고 보지 않는다. 예외 무시나 재시도 없이 실패를 보존했다. 후속 manual `all`과 일반 App 실행·정리 결과는 §11.4–11.5에 있다. 일반 60fps와 실제 두 손가락 contact·반전·관성·재접촉 trace도 아직 미수락이다.


### 11.4 H v1 all 통합 기능 검증

Manual `all` package(manifest `fb108a1cfe3e667b168b98bfa24a85525febd7e78d52603a72953bc2ce2fb0bf`, exe `db9951cf7cf2c8b5f34424e128f4555862f30f587c55d06b2432decbced98d30`)를 실제 실행해 Gallery 양 열 → Mixed 12 fields/36 buttons·재클릭 없는 입력 3회·한국어 IME 조합/확정/undo → 같은 owner Gallery 복귀와 정상 종료를 통과했다. 복귀 최대 gap은 230.0490ms였다. 이 owner는 diagnostics/capture·수동 counters-only 관측이며 자동 전체 section coverage나 cadence 비교를 실행한 것으로 쓰지 않는다.

기존 retained geometry는 editor queries 10,884 / native commits 907 / cold fallback 1(coverage 99.89%)였으며, layout/text/frame/Path/Paint·clip/Scene/Semantics/backing과 새 P2/H/L의 독립 native·SDK 집계가 일치했다. Native frame은 seal/admission/retirement 모두 2,132, drain 후 frame objects/bytes 0이었다. Backing은 create/destroy 4, reuse 2,128, live 0이었다. 새 H queries 221 / visits 442, L decisions 722 / applied retain 70 / applied evict 10 / prepare 0, P2 실제 resume submissions 4를 확인했다. P1은 contact가 없어서 `notObserved`로 남겼다. 종료는 exit 0 / forced=false / `views=0 consumers=0 gpuDrained=1 inputRetired=1`이었다.

첫 all owner는 입력·복귀를 통과했으나 종료 보고서 합성 중 nested scroll 보고서에 없는 fallbackReasons를 순회해 실패했다. 빈 legacy fallback map을 명시하고 원래 native/SDK 수를 보존하는 합성 회귀를 추가한 뒤 위 실제 owner로 재검증했다. 모드 검사 8 PASS, 전체 구간·backing 회귀 8 PASS, lint PASS다. 빌드 중 실제 App 원문을 읽는 fixture 검사 2개를 병렬 실행한 시도는 실행 순서 오류로 실패했으며, App 복구 뒤 순차 실행에서 통과했다. 실제 App/임시 fixture는 finally에서 원복·삭제됐다.

현재 source로 일반 App의 평소 명령 실행·종료를 확인했다(§11.5). 이번 작업이 만든 중간 native 캐시 `sample/nelyx-testbed-app-2/.nelyx/windows-native/870db316ea43a53cba5c4896cd214d63423f4d6c6b311c7a219fda1206c3fc2c`와 `b4052d41ede5db8c6f4748568ce51fd42b0439250392182f535946433e0c6e0f`는 현재 공급과 다르고 W7 소유 manifest·해시·경로·reparse 부재를 확인했다. 삭제 preview 뒤 자동 승인 검토가 computed allowlist와 개별 literal 경로의 PowerShell 삭제를 모두 `blocked by policy`로 거부해 보존했다. 다른 삭제 경로로 우회하지 않았다. 현재 사용 공급은 dec419af... 한 개이며 기존 사용자 캐시는 건드리지 않았다.


### 11.5 H v1 일반 App 복구와 당시 경계

평소 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`를 실제 실행했다. 소스 변경을 감지해 일반 App을 자동 재빌드한 뒤 시작했으며, native request는 `inputGeometry=ts`, `sceneComposition=false`, `semanticsGeometry=false`, `sceneBatch=none`이었다. 현재 App 원문에 fixture/onReady 실험 설치가 없고 native module 환경변수도 지정하지 않았다. 창 responding=true를 확인한 뒤 소유 PID의 정상 창 닫기로 exit 0을 확인했다. 이 startup/close 검사는 물리 입력·표시·60fps 수락이 아니다.

최종 일반 package는 manifest `4fdcc9c621142c86b24c10477c59832ac1fd0233a618196257390c2992fcb903`, exe `db9951cf7cf2c8b5f34424e128f4555862f30f587c55d06b2432decbced98d30`, SDK `2904d8b442e4460da88c7863d468a6ff9d8ee53c29203c962c51c633415e1ddb`, App `80ebca94f87f7d5a40571d1ad695743ea3db5b0361abd7c459963dd4b307ebad`, native `dec419af731f0eba01e67fe8df95c98dafa99c1e9125c0bd4e9762ba91ff36bd`다. Release / Hermes bytecode / optimized이며 canonical core/SDK/skia-native/skia-rn → 설치본 → 실행 package와 native source inventory의 일치를 대조했다. App.tsx diff 0, 임시 .rnw fixture 0, 현재 package 디렉터리 Release 하나, 소유 App process 0이다. README 한·영 사용법에 모드·비교 명령과 NO_ADOPTION 한계를 반영했다.

현재 판정은 **후보 구현·실행 경로 연결 / 통합 기능 scoped-pass / 단독 UIA 기능 PARTIAL / 새 후보 NO_ADOPTION / 제품 PARTIAL**이다. `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다. H는 이번 입력 구간에서 native work 0이라 성능 후보로 수락하지 않는다. P1의 실제 두 손가락 시작·연속·반전·관성·재접촉 timing과 체감은 사용자 물리 입력 없이는 확인하지 못했다. Android/Web 런타임도 이번 실행 범위가 아니다. 삭제가 차단된 중간 native 캐시 두 개는 보존돼 있다.

### 11.6 H v2 후속 구현 과정

H v1의 입력 구간 native work 0·전수 지원 판정 비용을 확인한 뒤 기본 경로를 `linear-prefix`로 바꿨다. 최소 표준 ancestor 2개부터 최대 32개까지 순수 numeric 작업만 묶고, 마지막 boundary는 현재 TS hitTest를 호출한다. Boundary 뒤의 self getter·behavior·translucent 비교는 실제 unwind 시점에 읽는다. 원래 root point 참조와 기존 translation/inverse/product cache의 transform 참조를 보존한다. Branch의 뒤쪽 sibling geometry는 미리 읽지 않는다. Native capability·patch version 2가 없는 공급은 startup에서 실패한다.

실제 C++ 차등 검사에서 callback 중 point/behavior/sibling 변경, 공개 base children·parent getter 교체, layout 중 size 의존성 예외, signed zero·affine·overflow fallback을 확인했다. Native 결과를 먼저 넣은 shared cache가 비교를 가리지 않도록 uncaptured JS matrix oracle도 사용했다. `all` verifier는 W7 보고가 없는 옛 bundle을 거부한다. 필수 geometry 2·retained 7, hit/matrix/lifecycle/mode 49, Windows semantics 12, 전체 type/lint 검사를 통과했다. 서로 겹치는 검사 수를 합계로 쓰지 않는다.

첫 v2 기능 pilot에서 H 12,102 queries / 36,306 visits, SDK/native 일치, Mixed 12 fields·36 buttons·한국어 IME와 Gallery 복귀(max gap 188.0152ms), 정상 close를 확인했다. 이 pilot 뒤 추가한 layout/getter guard와 focus 수정의 후속 검증은 §11.7–11.8을 따른다. 이전 native 작업 0 결과를 새 경로의 통과 결과로 바꾸지 않는다.

UIA 실패 stack을 재검토해 §11.2–11.3의 Invoke 오류 해석을 정정한다. Invoke는 helper 99행에서 끝났고 실제 예외는 전환 후 101행의 `FocusedElement` 질의였다. RNW는 Parent를 먼저 지운 뒤 Unmounted를 알리므로 기존 retireFocusProxy가 root를 찾지 못할 수 있다. Mounted 동안 weak root를 기억하고, 그 peer가 여전히 focus를 소유하며 같은 canvas/island가 살아 있을 때만 focus를 반환하는 수정을 추가했다. 예외 무시·재시도·gate 완화는 없으며 실제 재현·해결 여부는 후속 결과로 판단한다.

후속 v2 비교(manifest `7831978faaa0c67f532bcbe2c8c36fc7fd68fafe426c227016a3bb830184b833`, SDK `2f290af537993a06efa27ec19e954ef738e9dae544e0d4b7e0f7509dc91f8745`)는 trial 3 section-lifetime secondary의 `FAIL_FULL_RANGE_COVERAGE`에서 중단됐다. H 단독 3 owners의 양 열에는 실제 native QPC 작업이 있었지만 TS보다 느렸다. 전체 3쌍 비교·뒤의 기능 owner 완료로 쓰지 않는다. 첫 harness가 상세 실패 상태를 출력하지 않아 이 실행만으로 coverage의 원인을 확정하지 못했다. 후속 실행에는 동일 gate 앞의 bounded console 진단을 추가했다.

추가 검토에서 bounds miss 응답이 빠뜨린 마지막 edge 때문에 기존 one-product cache의 참조 교체가 생략되는 사례를 실제 차등 검사로 재현했다. Miss는 원래 TS traversal로 돌려 cache와 self-hook 관찰 순서를 보존하도록 수정했고 회귀가 통과했다. 이 수정 뒤 geometry 2·retained 7, 전체 type/lint와 gallery/mode 회귀를 다시 확인했다. 이후 공급의 3쌍·기능·일반 실행은 아래에 구분하며 이전 공급 결과를 현재 수락으로 쓰지 않는다.

### 11.7 Bounds miss 수정 공급의 3쌍 비교와 기능 검증

Bounds miss 수정 뒤 같은 명령으로 다시 비교했다. Release / Hermes bytecode / optimized, 2560×1459·DPI 192, 동일 package에서 교차한 fresh owners 18개를 사용했다. 상세 source frame probe·desktop capture 없이 양 열 top→bottom의 전체 section coverage와 native/SDK 정리를 모두 통과했다. Package manifest `b7bb7e5ec8cd5a61ab8d63043b96c36d5e73185e289a2e92efe31a334ad67368`, exe `ce43d861f8b1e3621a6b1095140786891942e2f877bf9232780780a758c3dd6b`, SDK `00b6aa4f5ea61a66b71b6e065db71beb10378df8f47c8bc769e6738e68bfcdfa`, native `03a49855f0fd1953957573df5c71693e48ec8f0f27cd35ba3404c1ef6aaaca55`다. 아래는 입력 전체 구간의 3회 평균 surface FPS이며 scanout/물리 터치패드 FPS가 아니다.

| 모드 | primary | secondary | 입력 구간 안 native QPC 판정 |
| --- | ---: | ---: | --- |
| TS control | 51.49 | 43.04 | native 후보 off |
| scroll-frame | 51.83 | 42.50 | 6/6 구간 실제 submit·credit·wake 관측 |
| pointer-targets | 43.70 | 34.49 | 6/6 구간 실제 prefix query·visit 관측. TS보다 느림 |
| section-lifetime | 52.42 | 44.03 | 6/6 구간 실제 decision 관측. prepare 0 |
| scroll-input | 51.90 | 44.36 | DM contact 없음. 6/6 구간 작업 0. OS-wheel control |
| scroll | 46.41 | 35.68 | P2/H/L은 관측, P1은 작업 0. 통합 성능 비교 실패 |

H 단독 owner는 native query 1,782–1,830 / visit 5,346–5,490 / 변경 patch 2,728–2,976 bytes였으며 SDK와 일치했다. TS fallback은 68,472–70,450회로 `short-or-custom-prefix`가 대부분이고 `projective-or-nonfinite`가 나머지였다. C++ 호출만 늘어난 것을 순이득으로 쓰지 않는다. L 단독은 각 owner에서 실제 retain 22 / evict 11 / prepare 0을 적용했다. P2 단독의 실제 credit 재제출은 39–74회였다.

H는 이전의 startup-only 범위를 벗어나 실제 입력 구간을 계산했지만 총경로 이득이 없다. P2/L도 일관된 이득이나 일반 60fps를 입증하지 못했다. P1·통합의 `FAIL_NO_NATIVE_WORK_IN_SOME_LEGS`와 모든 새 후보의 **NO_ADOPTION**을 유지한다. 앞선 L coverage 실패는 이번 세 owners에서 재현되지 않았지만 원인이 해결됐다고 주장하지 않는다.

같은 package의 TS·P2·H·L·P1 control·통합 6개 owner 모두 Gallery → Mixed 12 fields/36 buttons·재클릭 없는 키 입력·한국어 IME/undo → Gallery 복귀·정상 종료를 통과했다. 복귀 최대 gap은 순서대로 91.7440 / 91.7127 / 181.8451 / 103.4718 / 155.9949 / 128.0777ms였다. Native/SDK 수·closed/pending 정리를 대조했다. H 단독 12,225 queries / 36,675 visits, L 실제 retain 69 / evict 10 / prepare 0, P2 실제 재제출 239를 확인했다. 통합은 H 12,273 queries, L 실제 retain 76 / evict 9, P2 실제 재제출 94였다. 이전 `FocusedElement` 오류는 이 6 owners에서 재현되지 않았다. 물리 입력·scanout·일반 FPS 수락은 아니며, P1은 `notObserved`다. 명령 최종 exit 2는 no-native-work gate를 보존한 결과다. 일반 App 소스와 package 복구는 통과했다. 이후 point provenance 수정은 §11.8에서 별도로 검증한다.

### 11.8 좌표 provenance 수정과 최종 공급 검증

Proxy 좌표의 getOwnPropertyDescriptor trap이 native 지원 판정에서 추가로 호출되는 사례를 실제 C++ 차등 검사로 재현했다. 활성 pointer service가 있는 동안 직접 생성한 numeric point만 weak marker로 증명하고, 외부 객체는 descriptor를 읽기 전에 TS fallback한다. Marker는 point를 강하게 보유하지 않으며 마지막 서비스의 종료·native close 실패에서도 회수된다. Mutable root point와 live callback 의미를 유지한다. Native-scroll 57, geometry 2·retained 7, hit/matrix/lifecycle 45, 전체 type/lint가 통과했다. 이전 공급의 수치를 최종 공급의 비교로 재사용하지 않고 TS/H/통합 3쌍과 기능, all 통합, 평소 실행을 확인했다.

최종 비교 package는 manifest `d46a9beecd0e11fa410753d9b208e098623c6147a76fddc9080d8594a62d27c3`, exe `7197045772902829aac5f2d9fbeadf6e548fd8ef56734dc325a9316ee3dce2ed`, SDK `d822a2cb3352ae9bbf84b1f8020753c3581cb6942d0d2fde306ed3c924831b77`, native `03a49855f0fd1953957573df5c71693e48ec8f0f27cd35ba3404c1ef6aaaca55`다. 같은 환경과 공급에서 교차한 9 fresh owners의 coverage·SDK/native 정리가 통과했다. 평균 surface FPS는 아래와 같으며 물리 입력·scanout 수치가 아니다.

| 모드 | primary | secondary | 실제 입력 구간 판정 |
| --- | ---: | ---: | --- |
| TS control | 52.10 | 42.86 | 후보 off |
| pointer-targets | 43.06 | 33.84 | 6/6 구간 native prefix 작업. 총경로 성능 미수락 |
| scroll | 45.72 | 35.25 | P2/H/L 관측, P1 contact 0. `FAIL_NO_NATIVE_WORK_IN_SOME_LEGS` |

H의 외부 좌표는 `foreign-position`으로 집계되며 TS 의미를 보존한다. 새 marker를 포함한 최종 공급에서도 순이득이 없어 **NO_ADOPTION**이다. 같은 package의 TS/H/통합 3개 owner가 모두 Mixed 12 fields/36 buttons·재클릭 없는 입력·한국어 IME/undo·Gallery 복귀·정상 종료를 통과했다. 복귀 최대 gap은 100.6388 / 157.9590 / 127.0689ms였다. H 단독 native queries 11,725 / visits 35,175와 SDK 집계가 일치했고 모든 pending·subscription·mailbox owner가 0이었다. 최종 exit 2는 P1의 입력 구간 작업 0 판정을 유지한 결과다. 일반 App 복구도 완료했다.

추가 startup 실패 검사에서 all의 뒤쪽 capability가 없을 때 먼저 열린 pointer 서비스와 audit가 남는 사례를 재현했다. 실패 시 설치한 서비스·정책을 원복하고 두 audit를 닫되 최초 오류와 cleanup 오류를 함께 보존하도록 수정했다. Pointer factory 생성 중 실패와 뒤쪽 text capability 실패 모두 회수 범위에 포함된다. 이 수정의 startup/mode 회귀 5·lint가 통과했다. 정상 입력 hot path와 SDK/native 공급은 그대로이며, 이 helper를 포함한 실제 all 통합도 아래처럼 통과했다.

최종 manual all package(manifest `5dd356367d69bd48cb1ef40ded9bd447003e01b3abd95e780e7910d7df7b38b5`, exe `e69906816903c114283c1e7b561392a0919f988e12dad260b6bbbc90446abd80`)가 Gallery 양 열 → Mixed 12 fields/36 buttons·재클릭 없는 키 입력·한국어 IME/undo → Gallery 복귀(max gap 163.2594ms)와 정상 close를 통과했다. SDK/native는 위 최종 비교와 같다. 기존 모듈과 P2/H/L 모두 독립 native·SDK 집계가 일치했고 P1은 notObserved로 남았다. Retained editor queries 10,992 / commits 916 / cold fallback 1(99.89%), frame seal/admission/retirement 각 2,384 / live objects·bytes 0, backing create/destroy 4 / reuse 2,380 / live 0이었다. H queries 11,720 / visits 35,160, L 실제 retain 72 / evict 10 / prepare 0, P2 실제 재제출 7을 확인했다. Exit 0 / forced=false / `views=0 consumers=0 gpuDrained=1 inputRetired=1`이었다. 이 owner는 manual counters-only·기능 검증이며 자동 전체 section coverage·cadence나 물리 입력 수락이 아니다.

마지막으로 평소 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`를 실제 실행했다. 일반 App을 자동 재빌드한 뒤 `inputGeometry=ts`, `sceneComposition=false`, `semanticsGeometry=false`, `sceneBatch=none` 요청과 응답하는 가시 창을 확인했다. 소유 PID 11576의 실행 경로를 대조한 뒤 정상 창 닫기를 요청했고 CLI가 exit 0을 반환했다. 최종 일반 package는 manifest `5e13063feef20531bec105d859fdd429d2a0f28705d48fcb8ac9f13d8d657588`, exe `e69906816903c114283c1e7b561392a0919f988e12dad260b6bbbc90446abd80`, App `1b4799f4696baa1daee8fa1240a2d65731396b1f5848beabd30181a732550b6e`, SDK `d822a2cb3352ae9bbf84b1f8020753c3581cb6942d0d2fde306ed3c924831b77`, native `03a49855f0fd1953957573df5c71693e48ec8f0f27cd35ba3404c1ef6aaaca55`다. Release / Hermes bytecode / optimized다.

Canonical core/SDK/skia-native/skia-rn의 source-map inventory와 설치본 fingerprint, 실제 현재 tgz의 package-lock SHA-512 integrity, 실행 package의 file·SDK·App hash, native 공급 1,795 files와 compiled-source inventory를 대조했다. CLI가 재배열한 generated app-config는 JSON 값의 동일성을 확인한 뒤 원래 key 순서로 복구했으며 App input identity도 같다. 일반 App 기본 TS, README 한·영 사용법, 새 후보 NO_ADOPTION을 유지한다.

최종 App.tsx·app-config diff 0, 임시 .rnw fixture 0, supply staging 0, 소유 App process 0을 확인했다. 현재 package 디렉터리는 Release 하나이며 현재 supply tgz는 9개다. `git diff --check`도 통과했다. 코드·문서 변경은 미커밋 상태다.

현재 남은 필수 수락은 실제 두 손가락 접촉·반전·관성·재접촉 trace와 체감, 일반 사용 60fps·scanout이다. 자동 OS-wheel과 직접 native callback 검사를 물리 입력으로 치환하지 않는다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 제품 PARTIAL을 유지한다. 과거 UIA·L coverage 실패는 남겨 두며 이번 scoped-pass만으로 일반적인 해결을 확정하지 않는다. 도구의 자동 승인 검토가 `blocked by policy`로 삭제를 거부한 중간 native 캐시 두 개는 우회하지 않고 보존했다(§11.4).

이 시점의 자동 goal은 세 goal 턴의 물리 입력 미관찰로 blocked였다. 이후 사용자가 직접 실행해 아래 실패를 보고했으므로 수정 작업을 재개했다. 위 공급을 완료 또는 성능 채택으로 표시하지 않는다.

### 11.9 사용자 scroll 접촉 중 갱신 실패 — 입력 대기 범위 고정

사용자는 `--module=scroll` 실행에서 **손가락을 움직이는 동안 반영되지 않고 트랙패드에서 손을 떼어야 스크롤이 들어간다**고 보고했다. 이전 자동 OS-wheel·기능 scoped-pass를 실제 터치패드 성공으로 간주하지 않는다. 이 사용자 공급의 물리 입력 결과는 FAIL이며, 수정 공급의 물리 재검증은 아직 대기 중이다.

P2의 기존 gate는 native staged/sealed 입력이 전부 비워져야 frame을 제출했다. 연속 producer에서 이전 packet이 ACK되어도 새 packet이 남으면 대기를 계속하는 starvation을 회귀 검사로 재현했다(수정 전 제출 0). 수정은 native 수신 serial의 watermark를 capture하고, 실제 대기를 시작한 watermark를 GPU busy·CPU frame 교체 중에도 유지하며 실제 제출이 accepted일 때 해제한다. 이미 그 범위가 ACK되면 더 새로운 native packet이 남아 있어도 최신 JS 입력을 drain·반영한 frame을 제출한다. Batch가 경계를 걸치면 전체 batch ACK를 기다리며 staged packet도 capture 범위에 포함한다. 입력 순서·callback·ACK·shared 256 packet·CPU pending 1·native recording 2 상한은 유지한다.

새 `inputAdmissionVersion=1`·`captureInputWatermark`·`hasPendingInputThrough` capability를 선택 경로에 요구하므로 구 native 공급을 조용히 재사용하지 않는다. Native C++ 검사는 staged/sealed·경계 걸친 batch·복수 view·partial seal·retire/late ACK를 확인했고, JS 검사는 native queue가 끝까지 비지 않는 상황에서 credit 및 scheduled frame이 계속 진행하는지 확인했다. `test:native-scroll` 58, native Engine 11, input geometry 2, retained geometry/activation 7, startup/mode 5, 타입 검사·lint가 통과했다. 이는 starvation 수정 근거이며 실제 사용자 증상의 유일 원인이나 해결 완료를 확정한 결과가 아니다.

수정한 실제 manual `scroll` Release/Hermes bytecode/optimized package는 manifest `f3c26f50346b0203b5fe5fd9e0e62fc1a551db4fc7b1512394b3cebd26c9c5f4`, exe `3351f8580368dbb00819f073db5b50fd7dd1d49bd1eb6a8e68a288a46faa56f6`, SDK `3ded3d59679d73344610ef34c2bde18635a1c65e43cad65227245e894a442d76`, native `85c636cbb66186e82285147b8b5aa9b8d23c2ff46108419c41a9bdc28706f1da`다. Canonical core/SDK/skia-native/skia-rn의 source-map inventory·설치 fingerprint·현재 archive SHA-512/lock integrity가 일치한다.

같은 수정 package의 실제 Gallery 양 열 → Mixed 12 fields/36 buttons·재클릭 없는 키 입력·한국어 IME/undo → Gallery 복귀 기능 owner 1개가 통과했다. 복귀 최대 gap 129.2093ms, P2 실제 credit 제출 95, H queries 12,429 / visits 37,287, L 실제 retain 69 / evict 13 / prepare 0이 native·SDK와 일치했다. Exit 0 / forced=false / `views=0 consumers=0 gpuDrained=1 inputRetired=1`, native pending·mailbox·credit subscription 0이었다. P1 contact는 0/notObserved이며 `blockedInput=0`이므로 이 OS-wheel owner를 물리 접촉 중 starvation 해소 증거로 쓰지 않는다.

일반 App을 복구하고 평소 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 실제 재빌드·실행했다. 기본 `inputGeometry=ts`, `sceneComposition=false`, `semanticsGeometry=false`, `sceneBatch=none`, 소유 PID 27392의 정확한 경로·응답하는 가시 창을 확인한 뒤 정상 창 닫기와 CLI exit 0을 확인했다. 최종 일반 manifest `0a6f152e2e7c28302eda5f74980b3599b37eaba3291a70cba9253737ffe9ea29`, App `1d33b10cb632d01764c0aee37c667cc4c81eae5c0392f819e00394734236c7a3`이며 exe·SDK·native는 위 수정 manual package와 같다. Portable package·native runtime files·현재 SDK/App hash·native 공급 1,795 files 및 compiled source inventory 검증이 통과했다. Generated app-config는 값 동일성을 확인해 원래 key 순서로 복구했다.

최종 App.tsx·app-config diff 0, 임시 fixture 0, supply staging 0, App process 0, 현재 supply archives 9개·Release package 하나를 확인했고 변경 파일 format 및 `git diff --check`가 통과했다. 변경은 미커밋 상태다.

물리 접촉 중 갱신·반전·관성·재접촉은 같은 `npm.cmd run run:windows:cpp -- --module=scroll` 명령으로 재확인해야 한다. NO_ADOPTION·제품 PARTIAL·performanceAccepted=false·resizePerformanceAccepted=false를 유지한다.
