# Windows engine v2 스크롤·호버·클릭 지연 검토

작성·갱신: **2026-11-09 KST** · 상태: **P0/P1 및 P2/P3 일부 구현·Windows/Web 통합 확인 / 전체 PARTIAL**

**현재 구현과 검증은 §9에 기록한다. §2–8은 수정 전 검토 기록이며, 그 안의 source hash·실행 표본·“문서만 변경”은 당시 시점에 한정한다. 전체 증분 scene 전환·bounded 선행 준비·물리 성능 수락을 완료한 것은 아니다.**

대상: `sample/nelyx-demo-app/engine-v2`, Windows App SDK, Hermes App + C++ Core + Skia Graphite/Vulkan.

## 1. 결론

**lazy 항목 생성만 최적화해서 해결할 문제는 아니다. 프레임 출력의 동기 대기, App 이벤트 전달의 타이머 왕복, 작은 변경에도 남는 전체 scene 작업을 함께 개편해야 한다.** 다만 Widget/API를 버리고 엔진을 처음부터 다시 만들 필요가 있다는 근거는 없다. 현재 TS 구성·C++ 실행 소유권과 이미 구현한 캐시를 유지하면서, 실행 경로를 짧게 만드는 것이 우선이다.

우선순위는 다음과 같다.

1. **GPU 대기가 입력·animation tick을 막지 않게 한다.** Windows 출력의 매 프레임 CPU 동기화를 완료 추적이 있는 제한된 비동기 제출로 바꾼다.
2. **입력·builder 요청을 16ms polling과 Content 일반 작업 뒤에서 꺼낸다.** 이벤트 기반 App 깨우기, 입력 우선 처리, 준비 완료 알림을 연결한다.
3. **이미 준비된 장면의 이동은 property 변경으로 끝내도록 한다.** scene record, draw topology, semantics, picture의 재사용 단위를 분리하고, lazy coverage가 바뀔 때만 필요한 부분을 준비한다.

소스에서 이 비용 경로의 존재는 확인했다. 각 경로가 사용자가 느낀 전체 지연의 몇 %를 차지하는지는 아직 측정하지 않았다. 아래 실행 표본도 물리 트랙패드·전체 프레임 분포·scanout 측정은 아니다. **performanceAccepted=false, resizePerformanceAccepted=false, physical/display/scanout=notVerified**를 유지한다.

## 2. 검토 기준과 실제 실행 확인

### 2.1 현재 공급과 과거 개선 구분

검토 시작 시 `problem.md`는 **0 bytes**였다. 이 문서는 현재 소스를 다시 검토해 작성한 문서이며, [work9-c 보관 요약](history/26/11/09/work9-c-summary.md#11월-9일-구조-수정과-증분-캡처)의 원문 §3.1.4–3.1.6이 참조하던 과거 `problem.md` §8–10 원문을 복원한 것은 아니다. 과거 실행 결과는 해당 요약에 보존한 당시 기록으로만 취급한다.

현재 코드에는 이미 다음이 있다. 이를 없는 기능으로 취급해서 같은 작업을 반복하면 안 된다.

- Core builder continuation 재개와 완료한 layout 결과 재사용.
- `RenderSceneCapture`의 invalidation→조상 dirty 전파와 안전한 subtree 재사용.
- SceneWriter의 불변 configuration/설정 바이트 재사용, 큰 관측보다 입력 callback을 먼저 전달하는 순서.
- Content의 paragraph/picture 캐시, Core가 실행하는 scroll offset·ballistic, 유한 input cut.
- Windows의 QPC/DWM 기반 clock 및 stage timing, 원래 shadow 동작 보완.

이번 읽기 확인과 실행의 식별값:

| 항목 | 확인 결과 |
| --- | --- |
| Nelyx checkout | `a3a5ea4` / 시작 시 변경은 비어 있는 미추적 `problem.md`뿐 |
| engine source / supply SHA-256 | 모두 `9ec9b741c87660a56e3b6d5ac8ebd9cbe884c84c8672d133aaf07957ea5885e9` |
| supply | ABI 2 / schema 896476372 / manifest 355 files 검증 통과 |
| Demo bundle | `verifyEngineV2Application()` 통과 / 861 modules |
| `application/app.js` SHA-256 | `3a49dc47e6f082586e893ecb911327afe48ca09b343074f3bef5308d8571377d` |
| Doroti 참조 checkout | `c168bfee`, 작업 트리 변경 없음; 이번에는 소스 비교만 수행 |

`run`은 현재 TS/C++를 빌드하는 명령이 아니다. [engine-v2-runner.mjs](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)의 `engineV2Operation()`은 이미 있는 앱 bundle과 engine supply를 검증하고 실행한다. 이번에는 source identity도 별도로 재계산해 일치시켰다. 이후 수정 검증에서도 build→현재 supply→앱 bundle 갱신→동일 명령 실행을 지켜야 한다.

### 2.2 일반 실행 명령 관찰

repository root에서 사용자가 준 것과 같은 CLI 인자로 실행했다.

```powershell
node .\Nelyx\sdk\tooling\cli\src\main.mjs run --engine v2 --app .\sample\nelyx-demo-app\engine-v2 --target windows
```

- 관찰 환경: content 960×720 logical pixels, NVIDIA GeForce RTX 4060 Laptop GPU, Windows App SDK. 최대화 조건은 이번에 측정하지 않았다.
- Computer Use로 wheel 아래/위 각 1회와 `Filled` 버튼 클릭을 실행했다. 상단 복귀와 하단의 `Filled pressed` 표시를 확인했다. 실제 손으로 입력한 트랙패드 동작은 아니다.
- 기존 stdin `stats`를 약 200ms 간격으로 표본 수집했다. **마지막 frame timing을 읽는 방식이므로 전체 프레임 trace가 아니며 FPS·p95·p99를 계산하지 않는다.** 수집 자체도 실행에 부하를 더할 수 있다.
- DWM composition clock 표본은 약 **6.0605ms**였다. 코드가 명시하듯 이 값은 window별 monitor-specific clock이나 scanout 관측이 아니다.

| 표본 | 관찰값 | 해석 범위 |
| --- | --- | --- |
| submission 9 / document 13 | Core 1.274ms, record/backing 1.035ms, submit 15.208ms | `submit`은 GPU 순수 실행시간이 아니라 acquire·동기 제출·present 관련 대기까지 포함 |
| preparation 8 / 시작 document 11 | 41 steps, wall 103.829ms, Core step 합 2.610ms, measure 합 1.943ms, record 0.895ms | 계측된 작업 합은 약 5.45ms. 나머지는 App 응답·큐·깨우기·비계측 작업 등이 섞여 있으며 전부 sleep이라고 단정할 수 없음 |
| preparation 9 / 시작 document 14 | 22 steps, wall 32.190ms, Core 1.722ms, measure 0ms, record 0.901ms | 문단 측정이 없어도 준비의 wall time이 발생한 표본 |
| 왕복 전→복귀 후 | nodes 420→519→385→420, document 9→19, layoutWork 2349→5765 | 이 왕복에 active 목록과 preparation 변경이 실제 포함됨. 동일 노드를 순수 이동한 benchmark로 볼 수 없음 |
| 종료 | exit=0, reservedBytes=0, memoryTotal=0, workersJoined=true | 이번에 연 앱 정상 종료, 추가 원시 로그 파일 생성 없음 |

Frame timing과 Content timing은 독립적인 최신 표본이다. 같은 stats 행에 있다고 같은 입력을 처리한 인과 관계로 연결하지 않는다. `completedAtSeconds=0`인 진행 중 preparation은 wall time 계산에서 제외했다. 이번 관찰로 사용자 증상의 심각도 전체를 재현했다고 주장하지 않는다.

## 3. 소스에서 확인한 병목 구조와 수정 방향

### 3.1 Windows Render owner가 매 프레임 GPU를 기다린다 — P1

근거:

- [device.cpp](Nelyx/engine/render/vulkan/device.cpp) `Device::Impl::present()`, 현재 398–420행.
- [skia_provider.hpp](Nelyx/engine/platform/windows/skia_provider.hpp) `RenderProvider::draw()`의 `device->present()` 호출.
- [host.cpp](Nelyx/engine/platform/windows/host.cpp) `renderLoop()`, 현재 258–313행.

출력은 `vkAcquireNextImageKHR` → acquire fence CPU wait → offscreen을 swapchain image에 draw → `submit(SyncToCpu::kYes)` → `vkQueuePresentKHR` → 즉시 `waitPresent()` 순서다. 현재 하나의 mutable offscreen surface를 재사용하기 때문에 단순히 wait를 지워서는 안 된다.

같은 `renderLoop()`가 `View::tick()`을 호출한다. 이 tick이 입력 소비, scroll/animation 진행, App frame event 발행도 담당한다. GPU/WSI 대기 중 UI가 입력을 넣을 수 있더라도 다음 tick의 처리는 늦어진다. 깨우기 플래그로 Vulkan 내부 wait를 중단할 수는 없다. 따라서 이미 준비된 위젯만 움직여도 이 경로의 영향을 받는다.

**수정안:**

- `FrameSlot`에 backing/recording/Prepared·Frame lease와 GPU 완료 상태를 보유한다. 우선 1개 제출을 비동기로 유지하고, 측정 후 호환 가능한 장면만 최대 2개로 허용한다. swapchain image 개수와 논리적 GPU in-flight 개수는 별개다.
- acquire semaphore를 GPU wait에 연결하고, normal path의 `SyncToCpu::kYes`를 완료 추적이 있는 비동기 제출로 교체한다. 슬롯이 없으면 입력/clock 처리를 계속하고 다음 완료 신호에서 최신 표시 상태를 다시 선택한다.
- `releaseFrame(drawn)`·`publish`·GPU resource retirement를 분리한다. `Prepared`, paragraph/image, recording, backing을 GPU 사용 종료 전에 파괴하지 않는다. display acknowledgement와 GPU resource 재사용도 구분한다.
- resize/hide/close/device loss는 generation별로 회수한다. 완료를 증명하지 못한 timeout을 회수 성공으로 처리하지 않는다.
- 현재의 FIFO+CPU wait+추가 clock wait가 어떤 간격을 만드는지 먼저 분해 계측한다. `sleep(1)` 삽입이나 무조건적인 frame 수 증설로 보정하지 않는다.

**주의:** present fence는 화면에 실제 픽셀이 보였음을 증명하지 않는다. Vulkan 명세도 이 fence가 present operation 자체의 완료를 기다리지 않을 수 있다고 명시한다. [Khronos present fence 문서](https://docs.vulkan.org/refpages/latest/refpages/source/VkSwapchainPresentFenceInfoKHR.html), [semaphore 재사용 규칙](https://docs.vulkan.org/guide/latest/swapchain_semaphore_reuse.html)을 따라 자원 수명과 표시 측정을 각각 설계한다.

### 3.2 App 이벤트와 lazy builder가 타이머·일반 Content 큐를 왕복한다 — P1

근거:

- [scene.ts](Nelyx/runtime/engine-client/scene.ts) `pollSoon()`: 이전 `pollEvents()` 완료 후 다시 **16ms** timer, 현재 1286–1294행.
- [host.cpp](Nelyx/engine/platform/windows/host.cpp) `enqueue`·`contentLoop`: App 요청은 대부분 하나의 `jobs` deque를 거치며 매 loop 한 job 처리 후 contentStep/measure/prepare 수행.
- [host.ts](Nelyx/runtime/app/host.ts) `perform()`·`waitForContent()`: 이전 document가 게시될 때까지 **8ms** 간격 inspect/rebuild, 현재 1105–1152행.
- [layout.cpp](Nelyx/engine/core/layout/layout.cpp) `nativeListDemand()`·`pendingBuild`: 알 수 없는 row를 만들고 측정해 coverage를 늘리는 단계적 요청.

`pollEvents()`가 큰 관측보다 입력을 먼저 전달하도록 바뀐 것은 유효하다. 그러나 이벤트를 읽기 시작하기 전 16ms와 같은 polling cycle 안의 RPC/처리 시간이 여전히 남는다. 고주사율에서 이미 한 프레임보다 길 수 있고, builder가 여러 번 필요한 화면에서는 왕복마다 누적된다.

`waitForContent()`는 진행 중인 preparation이 animation update에 계속 교체되어 굶는 것을 막는다. 이를 삭제해 새 transaction을 마구 넣으면 이전 starvation을 재발시킨다. 하지만 현재 구조는 paint-only invalidation도 이전 document 게시 뒤까지 합쳐 기다릴 수 있다.

**수정안:**

- Host→App에 `interaction available`, `builder request available`, `publication changed` 알림을 추가하고 실제 Hermes App thread를 깨운다. UI/Render thread에서 JS callback을 직접 호출하지 않는다.
- interaction polling과 builder reply를 일반 Content 준비와 분리해 우선 처리한다. bounded batch, request ID/ACK, 유한 input cut과 lost-wakeup 방지를 함께 설계한다.
- Native event 알림과 Web message 알림이 같은 client 계약을 구현하게 한다. 지원되지 않는 host에서만 명시적 polling 경로를 유지한다.
- 8ms 재조회는 preparation 완료/취소 알림으로 대체한다. 구조·layout 변경은 안정적으로 완료시키되, 독립적인 paint/property 변경은 현재 scene에 적용할 수 있도록 revision을 분리한다.
- 여러 independent builder/알려진 list range는 한 번에 요청·응답할 수 있게 한다. 사용자 builder의 실행은 TS에 남기고 C++는 범위·제약·generation을 검증한다.

완료 기준은 timer 숫자 감소가 아니다. **입력 대기시간, builder 왕복 횟수, preparation wall/CPU 차이, publication starvation 여부**가 줄어야 한다.

### 3.3 스레드는 나뉘어 있지만 Core 임계 구역은 공유한다 — P2

[protocol/engine.cpp](Nelyx/engine/core/protocol/engine.cpp)의 `Engine::dispatch()`는 하나의 `State::mutex`를 잡는다. `contentStep()`, tick, frame acquire와 응답 구성 등이 이 구역을 공유한다. UI pointer/wheel도 [host.cpp](Nelyx/engine/platform/windows/host.cpp)의 `inspect`와 `input` dispatch를 거친다.

단, **transaction 본체 `transact()`는 이미 unlock 후 실행한다**. “모든 transaction과 GPU 작업이 전역 lock 안에 있다”는 설명은 잘못이다. provider의 paragraph 측정 및 GPU draw도 해당 lock 바깥이다. 남은 lock hold/wait의 실제 길이는 이번에 계측하지 않았다.

**수정안:** 먼저 opcode별 lock 대기·보유 시간을 측정한다. 긴 Content 계산은 immutable document/metrics snapshot으로 수행하고 짧은 publish/commit 구간에서 generation을 검증한다. Render가 읽을 geometry/paint/semantics는 snapshot으로 넘긴다. Input admission은 bounded mailbox에 짧게 기록하고 mutable interaction state의 단일 소유자를 유지한다. `contentPerStep=64` 작업 수 제한만으로 시간 예산을 보장하지 말고, 측정 가능한 deadline과 취소 지점을 둔다.

전역 lock을 조각내기만 하는 변경은 피한다. document/resource revision, close, metrics 교체, ACK 순서까지 함께 유지해야 한다.

### 3.4 부분 캡처 재사용 뒤에도 scene 전체 순회가 남는다 — P2

근거:

- [capture.ts](Nelyx/runtime/app/capture.ts): 안전한 subtree 재사용은 이미 존재한다. 다만 `dynamic()`은 재사용 불가를 조상까지 전파한다.
- [host.ts](Nelyx/runtime/app/host.ts): sliver·자원·builder·editable 등 동적 경계 처리, `perform()`의 root 구성/`syncRenderTree()`/scene 생성.
- [scene.ts](Nelyx/runtime/engine-client/scene.ts) `records()`: 전체 allocate 순회 후 전체 visit 순회. config를 재사용해도 자식 방문·새 Map/record/children 배열 생성은 남는다.
- [공통 skia_provider.hpp](Nelyx/engine/platform/common/skia_provider.hpp) `ContentProvider::prepare()`: node별 picture 재사용 여부를 매 preparation 전체 순회로 확인한다.

즉, **설정 바이트 재사용률이 높아도 App CPU와 할당량이 변경된 노드 수에만 비례하는 것은 아니다.** 동적 경계를 무조건 재사용하도록 바꾸면 resource lease, callback, geometry 참조가 오래된 상태로 남을 수 있다.

**수정안:** stable handle별 record 저장소와 dirty subtree/edge 목록을 유지한다. 구조 변경, config 변경, 자원 binding 변경, callback 변경을 분리해 delta만 transaction으로 보낸다. Resource/layer/tap/observer 등록은 매번 tree를 방문해야만 갱신되는 부수효과에서 명시적 attach/update/detach 수명으로 옮긴다. 그 뒤 동적 경계가 clean 형제까지 다시 방문하게 만드는 범위를 줄인다.

Core final geometry, 원래 Widget/State/Key, API 서명을 유지한다. custom callback이나 mutable 공개 입력을 임의로 immutable이라고 간주하지 않는다. 전체 diff는 reset/recovery용으로 남기되 일반 hover의 기본 경로에서 빠져야 한다.

### 3.5 warm scroll도 draw topology·semantics를 새로 만든다 — P2

근거:

- [scheduler.cpp](Nelyx/engine/core/scheduler/scheduler.cpp) `acquire()`, 현재 915–924행: 모든 active node property를 새 Frame에 복사하고 `makeDrawItems()` 호출.
- [frame.cpp](Nelyx/engine/core/scene/frame.cpp) `makeDrawItems()`, 현재 316–420행: tree 순회, clip/hit 정보 구성, `makeSemantics()`와 `orderSemantics()` 실행. frame-dependent paint는 추가 geometry 계산도 수행.
- [공통 skia_provider.hpp](Nelyx/engine/platform/common/skia_provider.hpp) `drawPreparedFrame()`: 매 frame subtree end index 등을 만들고 picture/native paint를 순회 replay.

이는 “매 scroll frame마다 모든 paragraph를 다시 측정한다”는 뜻은 아니다. layout·picture 재사용이 되어도 **프레임용 scene 자료구조 생성과 raster replay 비용이 계속 발생한다**는 뜻이다. 이번 작은 화면 표본의 Core 약 1ms를 전체 지연의 주원인으로 확대할 수는 없지만, node 수와 창 크기에 따른 확장 비용이다.

**수정안:**

- topology/paint order/clip 구조를 scene revision별로 보관하고 transform·opacity·scroll offset·control value는 별도 property 집합으로 갱신한다.
- semantics 내용/정렬 topology와 위치를 분리한다. 스크롤에서 필요한 bounds·hit-test transform은 갱신하되 text/custom action 병합과 전체 sort는 dirty revision이 바뀔 때 수행한다.
- 반복 traversal scratch를 frame slot별로 재사용하고, viewport 밖의 안전하게 생략 가능한 subtree를 cull한다. clip 밖 shadow·filter, follower, semantic/hit 요구는 보존한다.
- RepaintBoundary/picture별 immutable command identity를 유지한다. raster cache는 비용·재사용 횟수·pixel budget으로 선택적으로 승격하며, 큰 전체 화면 bitmap cache를 기본 해법으로 삼지 않는다.

출력이 같고 input geometry도 동일하다는 검증을 먼저 통과시킨다. 스크롤 중 hit 대상, Tooltip/follower, clip, shadow, focus, UIA bounds가 이전 프레임에 남으면 실패다.

### 3.6 “이전에 봤다”와 “지금 준비되어 있다”는 서로 다르다 — P2

[Demo components.ts](sample/nelyx-demo-app/src/components.ts) 333–341행은 `ListView.builder`, extent index, **`childPolicy: { mode: 'bounded', capacity: 2, preparation: 'disabled' }`**를 사용한다. [sliver.ts](Nelyx/src/framework/widgets/sliver.ts)의 보관 정책에 따라 방문한 child가 항상 유지되는 것은 아니다.

또한 [runtime/app/host.ts](Nelyx/runtime/app/host.ts)의 `sliverNode()`는 bounded policy의 preparation이 `disabled`가 아니면 현재 거부한다. 따라서 설정만 `observed-budget`으로 바꾸면 해결된다는 제안은 현재 v2에 적용할 수 없다.

Core의 [scheduler.cpp](Nelyx/engine/core/scheduler/scheduler.cpp) `applyDelta()`는 준비된 coverage를 벗어나면 offset을 해당 범위로 제한하고 `needContent()`를 요청한다. 여기에 §3.2의 builder 왕복이 걸리면 움직임이 멈췄다가 준비 후 진행할 수 있다. 그림자·geometry가 틀린 미준비 영역을 그대로 표시하도록 clamp를 제거하는 것은 해법이 아니다.

Content의 picture cache도 무한 방문 기록이 아니다. `prepare()`에서 다음 cache를 만들고 교체하며, node handle/generation·metrics·font·paint 일치가 필요하다. Source State가 남아 있어도 native node/picture가 퇴거되었을 수 있다.

**수정안:**

- Widget/Element 보관, 측정 extent, native layout, CPU picture, GPU raster의 cache hit/miss/eviction을 따로 기록한다.
- 작은 왕복의 warm-resident 경로와, capacity 초과 후 다시 오는 warm-evicted 경로를 별도 benchmark로 만든다.
- viewport에 필요한 row와 예산 내 앞/뒤 준비 범위를 Core가 요구하고 TS는 bounded range를 한 번에 제공한다. 방향 반전과 속도를 고려하되, 계속되는 입력이 준비를 무한 취소하지 않게 한다.
- 변경되지 않은 visible/retained row의 handle·측정·paint identity를 보존한다. theme/font/폭/Key 교체 때는 정확히 무효화한다.
- 메모리 한도 안에서 cache와 overscan을 조정한다. 먼저 엔진 경로를 수정하고 그 뒤 Demo의 보관 수를 비교 실험한다. capacity만 크게 바꾸고 엔진 개선으로 보고하지 않는다.

## 4. DorotiLab에서 가져올 설계와 그대로 복사하면 안 되는 부분

이번 비교는 현재 파일을 읽어 확인했다. Doroti의 과거 문제 해결 경험을 참고했지만, 이번에 Doroti 앱을 실행해 동일 조건 성능 수치를 재확인한 것은 아니다.

| Doroti 현재 소스 | 확인한 방식 | Nelyx 적용 |
| --- | --- | --- |
| [WindowsManagedVulkanPresenter.Pipeline.cs](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsManagedVulkanPresenter.Pipeline.cs) `PollPipelineFrames` / `TrySelectPipelineBank` | active/spare backing 분리, fence status polling, Vulkan 완료와 D3D consumer 완료를 각각 확인 | §3.1의 슬롯·lease·retirement 모델. busy면 새 프레임 admission을 늦추고 사용 중인 backing을 덮어쓰지 않음 |
| [NativeFramePipeline.cs](../DorotiLab/Doroti/src/Doroti.Skia.Rendering/NativeFramePipeline.cs) 및 [Windows runner](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/DorotiWindowsAppSdkRunner.cs) 927행 부근 | 조건에 따라 논리적 GPU frame 한도 1/2, resize/native view/지원 여부를 고려 | 무조건 triple buffering을 도입하지 않고 실제 장면·수명 조건에 따라 admission |
| [WindowsManagedVulkanPresenter.cs](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsManagedVulkanPresenter.cs) 및 [d3d12_output.cpp](../DorotiLab/packages/platforms/windowsappsdk/native/src/d3d12_output.cpp) | Graphite/Vulkan raster→같은 adapter의 D3D12 공유 resource→DXGI/DirectComposition. queue wait/signal과 copy fence로 source 재사용 판정 | 필요 시 Windows 출력 이식 후보. 먼저 현재 Vulkan WSI 비동기 경로와 비교; D3D12라는 이름 자체를 성능 해법으로 간주하지 않음 |
| [WindowsFrameInputState.cs](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsFrameInputState.cs), [WindowsManagedProductHost.cs](../DorotiLab/packages/platforms/windowsappsdk/Doroti.Host.WindowsAppSdk/WindowsManagedProductHost.cs) `BeginFrame` | received/dispatched 분리, 시작 시 유한 input batch, 해당 input 처리 뒤 frame callback 선택 | input cut과 publication 인과 관계 보존. 새 입력 수신만으로 진행 중 프레임을 계속 폐기하는 starvation 방지 |
| [rendering/object.cs](../DorotiLab/Doroti/src/Doroti.Framework.Rendering/object.cs) `_compositeChild` | clean RepaintBoundary는 repaint 대신 layer property/offset 갱신·재연결 | §3.4–3.5의 property-only 경로와 retained subtree 단위 |
| [DorotiFrozenScene.cs](../DorotiLab/Doroti/src/Doroti.Ui/DorotiFrozenScene.cs), [SkiaSceneRenderer.cs](../DorotiLab/Doroti/src/Doroti.Skia.Rendering/SkiaSceneRenderer.cs) `Submit` / replay | immutable scene handoff, 마지막 유효 scene 재사용, GPU 완료까지 resource lease 유지 | Content 교체 준비 중 기존 scene 표시. GPU 완료 전 scene/resource 해제 금지 |
| [SkiaPictureCommandCache.cs](../DorotiLab/Doroti/src/Doroti.Skia.Rendering/SkiaPictureCommandCache.cs) | snapshot identity로 bounded command cache, 움직임/clip/scale은 replay에서 적용, 매번 바뀌는 picture는 승격 제외 | 단순 picture 객체 수가 아닌 recording 재사용과 비용 절감 측정 |
| [rendering/section_list.cs](../DorotiLab/Doroti/src/Doroti.Framework.Rendering/section_list.cs), [Components.cs](../DorotiLab/samples/DorotiDemoApp/src/Components/Components.cs) 371–383행 | indexed extent, 방문 subtree 유지, suspended owner는 layout/paint에서 제외 | 재방문 보관과 offscreen 실행 비용 분리. Nelyx capacity 2 정책과 동일 조건은 아님 |

Doroti도 무조건 무대기인 것은 아니다. `BeginFrame`에는 dispatcher 완료 대기가 있고, DXGI 출력에는 back-buffer allocator 재사용 대기 및 조건부 동기 경로가 있다. 가져올 핵심은 **각 대기의 목적과 소유 자원을 분리하고, 준비·입력·GPU 완료를 별도로 진행시키는 방식**이다. C# 구현과 MAUI 경로 전체를 Nelyx Windows host에 복제하지 않는다.

## 5. 목표 실행 구조

| 소유자 | 유지할 권한 | 바꿀 연결 방식 |
| --- | --- | --- |
| TS App | 원래 Widget/Element/State, Material/Cupertino 정책, 사용자 builder/callback, 명령 생성 | 알림으로 즉시 깨움, dirty record/range delta, bounded builder batch |
| C++ Core | 입력 순서, gesture/scroll/animation, 최종 layout·geometry·hit-test·semantics, revision 검증 | 입력을 짧게 수용, Content snapshot 계산과 짧은 commit, retained topology+property |
| Content | paragraph/image 준비, layout 작업, immutable paint/picture 준비 | input보다 긴 작업이 앞서지 않도록 deadline; 재사용 가능한 준비를 보존하며 필요한 subtree만 갱신 |
| Render/GPU | 최신 유효 frame 선택, raster, submit, resource retirement | bounded slot, nonblocking completion 확인, GPU가 바빠도 Core input/tick 정체 방지 |
| Windows UI host | OS 입력/IME/UIA/clipboard, metrics, surface/lifecycle | 짧은 ingress와 wake, immutable published geometry 사용, 별도 JS/layout 권한 없음 |

반드시 유지할 불변 조건:

- `accepted document`, `prepared scene`, `submitted frame`, `published input geometry`, `GPU completed`, `display observed`는 서로 다른 상태다.
- latest-wins는 미제출 visual candidate/허용되는 pointer update에 적용한다. down/up/cancel, key, IME edit, semantic action, ACK를 임의로 버리지 않는다.
- 현재 frame에 고정한 input cut 이후 입력은 다음 frame의 몫이다. 새 수신 때문에 현재 frame을 무한 취소하지 않는다.
- Core scroll의 requested/applied/coverage를 구분하고, 보이지 않은 geometry로 hit-test하지 않는다.
- GPU slot/메모리 한도 초과 시 admission을 늦추며 자원 수명을 단축하지 않는다. TS fallback, 별도 C++ Material 복제, 무제한 cache로 해결하지 않는다.

## 6. 구현 순서와 단계별 완료 조건

이 문서는 구현 계획이다. 이번 요청에서는 아래 엔진 변경을 수행하지 않았다. 당시 [work9-c의 소유권·API 계약](history/26/11/09/work9-c-summary.md)을 유지한 W9C-00 성능 수정 묶음으로 제안했다. 이후 진행·이월과 현재 후속 문서는 보관 요약에서 구분한다.

| 단계 | 작업과 주요 파일 | 완료 조건 |
| --- | --- | --- |
| P0 — 인과 관계 계측 | Windows `host.cpp`, `device.cpp`, Core dispatch, TS scene/host에 sequence·stage·큐 대기 계측 | 한 입력에서 ingress→tick→App callback/transaction→prepare→submit→publication까지 연결. GPU/WSI 대기 세분화. 통계 수집은 bounded memory ring, hot path 파일/콘솔 I/O 없음 |
| P1-A — 이벤트 경로 | `scene.ts`, App transport, Windows jobs/done/wake | interaction/builder/completion push 연결; 16/8ms 재조회 의존 제거; idle spin 없음; event 순서·ACK·starvation 회귀 통과 |
| P1-B — 비동기 출력 | Windows provider, Vulkan device, Frame/Prepared lease, host render loop | 정상 프레임의 CPU GPU-completion wait 제거, bounded in-flight, busy 중 입력 처리 가능. resize/hide/close/device loss에서도 조기 해제 없음 |
| P2 — 증분 scene/frame | `capture.ts`, SceneWriter records/diff, Core frame/semantics, common provider | clean row 이동은 layout/paragraph/전체 config 재생성 없이 property 갱신. hover가 관계없는 subtree 작업을 늘리지 않음. 입력·픽셀 동일성 유지 |
| P3 — lazy 경로 | Core list/layout builder, native sliver, TS 보관 정책 | range 응답 묶음, generation 일치 시 재사용, warm-resident/evicted 구분, bounded preparation의 실제 v2 지원. 방향 반전·Key/state·font/resize 무효화 정상 |
| P4 — 통합 및 출력 선택 | 현재 공급 재빌드·Demo 재번들, Windows 실앱, 공통 변경의 Web 회귀 | 아래 성능·정확성 기준으로 비교. WSI 수정 뒤에도 출력 병목이 남으면 Doroti D3D12/DXGI 출력 경계 이식을 별도 판단 |

P0로 baseline을 한 번 잡고 P1-A/B의 관련 변경을 묶어 구현한다. 국소적인 수명/순서 검사는 작업 중 수행하되, 파일 하나 바뀔 때마다 전체 공급·설치·모든 플랫폼 검증을 반복하지 않는다. 각 묶음이 끝날 때 공급과 앱을 갱신해 통합 검증한다. 검증 timeout은 **20분**, 반복 시나리오는 보통 **30회 이내**로 제한하고 원시 산출물을 누적 보관하지 않는다.

P1 이후에도 CPU 작업 자체가 budget을 넘는다면 P2를 이어간다. 모든 단계가 끝나기 전에는 엔진 개편 완료나 성능 수락으로 표시하지 않는다. Windows 호스트 변경만으로 Android를 새로 검증한 것으로 세지 않으며, 공통 Core/wire 변경은 Web 및 후속 Android 공급에 명시적으로 반영해야 한다.

## 7. 비교 시나리오와 측정 기준

### 7.1 같은 조건을 고정한다

동일 GPU/드라이버, 창 크기/DPI, 전원 상태, refresh rate, Release 공급, 메뉴·테마·폰트·이미지 준비 상태를 기록한다. 엔진 source/supply/app bundle hash를 함께 남긴다. Doroti와 직접 비교하려면 visible section 수·효과·방문 child 보관 정책도 맞춘다.

| 시나리오 | 확인할 것 |
| --- | --- |
| idle → 버튼 hover/click | OS ingress부터 callback/상태 변경/첫 표시까지. 입력 종류별 큐 체류시간, 관련 없는 subtree build/paint |
| 현재 준비 coverage 안에서 작은 상하 왕복 | resident handle·extent·picture 재사용, 불필요한 transaction/layout/paragraph 기록 여부 |
| 같은 목록 경계를 반복 통과 | retained 복원과 eviction 후 재생성 분리, builder 요청 수, coverage 제한 시간 |
| 처음 보는 구간으로 긴 scroll 후 방향 반전 | input backlog, stale candidate 처리, 화면 빈칸·점프·offset 손실 |
| 스크롤 중 hover/click 및 애니메이션 | callback 지연, GPU busy 중 Core tick 계속 진행, input cut 보존 |
| 최대화·DPI/resize·Text inputs·hide/resume/close | lifecycle/IME/focus/UIA/그림자 회귀, GPU lease drain, 메모리 회수 |

### 7.2 필요한 수치

- input queue delay, event notification→App dispatch, callback/build/capture/diff 시간·할당량, transaction 수/bytes.
- Content preparation wall/CPU, builder wait/왕복 수, measurement/record 신규·재사용 수, coverage requested/applied 차이.
- Core lock wait/hold, tick/acquire/makeDrawItems/semantics 시간, traversed·dirty·visible node 수.
- acquire 대기, record, GPU execution, submit, present API, resource fence 완료, 실제 표시 interval을 별도 수집.
- queued/in-flight 수, coalesced/superseded/dropped/canceled 이유, 장시간 증가하는 oldest age, memory peak/퇴거 수.

`V2_STATS`의 마지막 timing 하나로 percentile을 만들지 않는다. 입력 sequence와 preparation/document/submission을 연결한 **전체 frame event 표본**이 필요하다. API가 완료 시간을 노출하지 않으면 그 부분은 미측정으로 둔다. PresentMon/ETW 등 compositor 관찰도 실제 물리 scanout과는 구분한다.

### 7.3 제안하는 수락 목표

다음은 **측정 결과가 아닌 초기 목표**다. `T`는 대상 표시 장치의 확인된 refresh interval이다. 60Hz의 16.67ms를 모든 장치에 고정하지 않는다.

- warm-resident scroll: 불필요한 builder/paragraph 재측정 0. 필요한 property·visibility·semantics 위치 갱신은 허용.
- interaction→Core 소비 p95 ≤ T, input→App callback p95 ≤ T. 큐 age가 시간이 갈수록 증가하지 않음.
- warm frame CPU 작업 p95 ≤ 0.5T를 지향하고, GPU/표시까지 합친 deadline miss를 따로 평가.
- 표시 관측이 가능한 환경에서 warm-scroll frame interval p95 ≤ 1.25T, p99 ≤ 2T, input→첫 반응 표시 p95 ≤ 2T를 초기 목표로 설정.
- 정상 입력 시 유실·중복 callback·잘못된 hit 0, white flash/잘린 shadow/잘못된 cache 재사용 0, 종료 후 owned lease 0.
- 첫 방문의 비용과 eviction 후 재방문은 warm-resident 목표와 섞지 않는다. 각각 latency·memory tradeoff를 보고하고, 준비 중에도 이미 보이는 UI의 반응성을 유지한다.

목표 수치를 만족해도 사용자가 준 일반 PowerShell 실행과 물리 마우스/트랙패드에서 다시 확인해야 한다. 합성 입력·build PASS·source cache hit만으로 체감 개선을 수락하지 않는다.

## 8. 이번 검토의 완료 범위

- 현재 Nelyx 엔진·runtime·CLI·Demo 및 Doroti Windows/frame/retained rendering/list 소스 비교 완료.
- 현재 supply 355 files와 Demo bundle 검증, engine source identity 일치 확인.
- 일반 CLI 실행, 제한된 합성 wheel 왕복·버튼 반응·기존 timing 표본 관찰 및 정상 종료 완료.
- **변경은 이 문서뿐**이다. 엔진 구현·재빌드·새 성능 계측기 추가·Doroti 실행 비교·물리 트랙패드·최대화 성능·전체 프레임 분포 검증은 이번에 수행하지 않았다.

다음 구현 시작점은 **P0의 stage/queue 계측 → P1-A 이벤트 전달과 P1-B GPU lifetime/비동기 제출 설계**다. 단순 cache 확대나 또 다른 전체 rewrite에 앞서 이 두 지연 경로를 우선 제거하고 동일 조건으로 비교한다.

## 9. 2026-11-09 구현 및 통합 확인

### 9.1 반영한 변경

- **P0 계측:** Windows host에 최근 **1,024 dispatch / 256 frame** 고정 크기 ring을 추가했다. stdin `trace`에서 sequence, opcode/request, consumed input, document/preparation/submission/publication, 큐 체류, Core lock 대기·보유, frame record/output, acquire/Graphite submit/present API 및 완료 관측 시간을 읽는다. hot path에는 파일·콘솔 출력이 없다. 덮어쓴 표본 수를 함께 반환한다. `gpuObservedMs`는 완료 callback을 확인한 시간이며 GPU 순수 실행시간이 아니다. transaction의 unlock 구간은 lock 보유 시간에서 제외한다.
- **P1-A App 전달:** 공통 transport에 선택적 변경 알림 구독을 연결했다. Windows는 Hermes App owner만 JS를 호출하고, Web은 Content/Render→coordinator→App port로 알린다. 지원 host에서는 SceneWriter의 16ms polling과 OriginalWidgetHost의 8ms preparation 재조회를 제거했다. 알림 revision·진행 중 poll의 후속 요청 병합·잔여 interaction batch 처리·종료 시 readiness wait 해제를 포함한다. Android 등 미지원 host는 기존 polling fallback이다.
- **Windows App wake:** Hermes timer의 다음 실제 deadline까지 condition variable로 기다린다. 기존 2ms pump를 계속 돌리지 않는다. wake revision은 대기 mutex로 동기화한다. interaction/raw poll은 일반 Content job 대기열을 거치지 않고 App owner에서 짧은 Core dispatch를 수행한다. 일반 transaction 순서와 ACK는 유지한다.
- **P1-B 출력:** v2 Windows는 **GPU slot 1개**로 제한한다. timeout=0 acquire와 GPU wait semaphore, `SyncToCpu::kNo`, Graphite finished callback 및 present-resource fence의 nonblocking status 확인을 연결했다. Core tick은 slot 대기와 별도로 실행할 수 있다. offscreen은 완료 확인 뒤에만 다시 쓴다. slot은 Frame·Prepared·recording·path/layer lease를 보유한다. `releaseFrame(gpuObserved)`와 publish는 완료 확인 뒤에 수행하며 scanout으로 간주하지 않는다. resize/close의 drain은 유지하고, 완료 불명 실패는 자원을 조기 해제하지 않는다. 구 renderer의 동기 `present()` API는 별도 유지한다.
- **P2 일부:** 같은 Scene의 semantic text/custom-action 병합을 재사용한다. 노출 집합·modal root·선형 transform이 같고 각 semantic sibling group의 공통 이동만 바뀌면 정렬도 재사용한다. 그 외에는 정렬을 다시 한다. bounds/hit/clip/visibility는 매 frame 갱신한다. native provider의 subtree 종료 index를 Prepared별로 보관하며, 동일 SceneWriter record는 다시 할당·config diff하지 않는다.
- **P3 일부:** indexed variable list의 미측정 row를 한 번에 최대 **8개** 요청한다. estimate는 요청량 선택에만 쓰고 Content 실측 후 range를 다시 계산한다. viewport보다 큰 첫 row에서는 실제 필요한 range로 줄어드는 회귀를 확인했다. Demo capacity=2와 preparation=disabled는 바꾸지 않았다.
- **추가 입력 수정:** click/hover의 paint-only document 교체와 wheel이 겹치면 이전 publication의 wheel을 무조건 stale로 거부하던 Core 경로를 수정했다. 같은 스크롤 대상과 전체 조상 input geometry가 확인될 때만 받아들인다. viewport geometry가 달라진 stale wheel은 계속 거부한다. 새 publication으로 무조건 재전송하거나 입력 hit 검사를 생략하지 않는다.

통합 중 발견한 activated Prepared 선택 지연, App wake와 job mutex의 lock 순서 충돌, host 종료 중 notification wait 잔류도 수정했다. 실패했던 실행은 PASS에 포함하지 않았다. 정상 종료하지 못했던 이번 소유 테스트 process는 종료했고, 그 후 새 공급으로 재확인했다.

### 9.2 공급과 검증

| 항목 | 결과 |
| --- | --- |
| 최종 engine source/supply | `2416cdf4ae7075a0567e22100b6c5ff3927f245e9eff4e2e68283c6e72004d32` 일치, manifest **355 files** SHA-256 확인 |
| wire | ABI **2**, schema **896476372**, wire 변경 없음 |
| 빌드 | MSVC Core·Windows App SDK, Wasm single-worker/threaded, Core/SDK, Demo Windows **861** / Web **860** modules |
| source 회귀 | `node Nelyx/eng/check-event-notifications.mjs`: early/lost wake, poll 중 알림 병합, 잔여 batch, idle, fallback, host/view 종료 구독 해제 PASS |
| native 회귀 | `node Nelyx/eng/check-frame-reuse.mjs`: 6가지 이동/opacity 조건에서 full semantics 재계산과 비교, list batch/실측 범위, paint-only wheel 허용·geometry 변경 거부, ledger=0 PASS |
| Web 실제 앱 | `node Nelyx/eng/check-event-web.mjs`: threaded/single-worker에서 클릭 직후 wheel, resident 왕복 4회, 긴 이동·반전, resize, 오류 없음, 종료 reservedBytes=0 / workersStopped=true |
| Windows 실제 앱 | §2.2와 같은 일반 CLI. Filled callback 표시, 목록 경계 이동, resident 왕복, 오류 없음. 최종 exit=0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true |
| Windows lifecycle | 직전 동일 비동기 출력 구현에서 최대화 1280×729.5 logical, 최소화 visible=false, 복귀 visible=true, 정상 종료 확인. 마지막 wheel admission 수정 이후 최대화/hide를 다시 수행한 것은 아님 |
| 정적 확인 | Core·SDK 타입, Web host 타입(엔진 빌드), 변경 TS/JS lint·format·diff 검사 |

Web 자동 실행의 renderer는 **ANGLE SwiftShader**다. 기능·수명 회귀이며 RTX의 Web 성능 결과로 해석하지 않는다. Windows는 **RTX 4060 Laptop GPU**, DWM composition interval 약 **6.0605ms**, 물리 트랙패드가 아닌 Computer Use 합성 입력이다.

### 9.3 확인한 비용과 한계

- **Windows resident 왕복:** offset **176→184→176**, document **21**, layoutWork **6,863**, paragraphLayouts **338**, pictures **1,121** 유지, queued=0. 마지막 두 frame의 Core **1.219/1.105ms**, record **0.454/0.573ms**, output **0.669/0.704ms**. acquire **0.023/0.030ms**, Graphite submit **0.406/0.383ms**, present API **0.060/0.056ms**. GPU 완료 관측 **2.566/6.790ms**는 위 CPU 호출과 별개다.
- 최종 Windows **38 frame** ring의 output 중앙값은 **0.430ms**였다. 시작/클릭/목록 준비가 섞인 표본이며 warm p95/FPS로 보고하지 않는다. §2의 과거 단일 submit 15.208ms와 동일 인과 frame을 대조한 수치는 아니다.
- **Web resident 왕복:** 최종 재번들 재확인에서 threaded document **19**, layoutWork **5,593**, measurement **49** 유지. single-worker document **19**, layoutWork **5,601**, measurement **49** 유지. 양쪽에서 최초 click→wheel은 **5 collected / 5 dispatched / 0 rejected**, 왕복 뒤 **9/9/0**, queued=0이었다. 변경 전 같은 빠른 순서에서는 5/4/1과 offset=0이 재현됐다.
- **Cold/resize 비용은 남음:** 직전 Windows lifecycle 실행의 첫 backing 준비 **372ms**, resize backing 준비 **172ms**, 첫 내용 recording/output **40ms** 수준의 표본이 있었다. 정상 frame의 GPU 완료 CPU wait를 없앤 것과 초기 GPU pipeline/큰 backing 비용을 없앤 것은 다르다. resize 직후 이전 크기 장면과 빈 오른쪽 영역이 잠깐 관측됐으므로 resize 표시 성능·무깜빡임을 PASS로 판정하지 않는다.
- GPU slot 대기 중 tick을 수행하는 경로는 연결했으나, 이번 제한된 입력 trace에서 **실제로 아직 GPU가 busy인 순간의 input→tick p95**를 산출하지 않았다. notification→JS callback 전체 분포, builder request별 왕복 분포, actual display interval/scanout도 미측정이다.

### 9.4 남은 설계와 수락 범위

**P0 전체 인과 latency와 P2/P3 전체 개편은 완료가 아니다.** dirty subtree/edge만 방문하는 SceneWriter 저장소·동적 등록 attach/update/detach 수명, Content 계산의 immutable snapshot/시간 deadline, property-only 독립 revision, 전체 draw topology/property 분리, 모든 cache 계층의 hit/miss/eviction 계측은 남는다. semantics 병합/정렬과 native replay index 재사용을 이 전체 전환으로 확대하지 않는다.

여러 independent builder의 동시 range protocol과 v2 `bounded preparation: observed-budget`도 미구현이며 기존 명시적 거부를 유지한다. 첫 방문과 eviction 후 복귀를 resident 수치와 합치지 않는다. 이번 확인은 Demo 대상이며 Gallery·Android 공급/실앱·설치 소비자 전체·IME/UIA 세부 행렬·device-loss 주입·물리 트랙패드·전체 표시 성능을 재수락한 것이 아니다. Android는 공통 Core 변경 미반영 **stale/notVerified**다.

후속 시작점은 현재 `trace`로 cold/resize 및 연속 입력 구간을 별도로 수집하고, §6 P2/P3의 남은 항목을 이어가는 것이다. **compatible=false, performanceAccepted=false, resizePerformanceAccepted=false, physical/display/scanout=notVerified, 전체 PARTIAL**을 유지한다. 원시 trace/스크린샷/검증 browser profile·임시 native executable은 누적 보관하지 않았다. 새로 복구한 `.nelyx/windows-hermes`는 현재 빌드 공급이며 검증 임시 복사본이 아니다.

## 10. 2026-11-10 일반 실행의 클릭·스크롤 지연 후속

### 10.1 재현과 Doroti 비교

사용자가 §2.2의 일반 Windows CLI로 재실행했으며 스크롤과 hover/click이 모두 비슷하게 느리다고 보고했다. 시작 시 source/supply는 §9의 `2416cdf4…`로 일치했다. 오래된 공급만의 문제로 처리하지 않는다. 변경 전 버튼 입력 구간에서 preparation 6의 wall time은 **69.295ms**, 실제 Core step 합계는 **1.492ms**, recording은 **0.760ms**였다. Core CPU 시간만으로 전체 입력 반응을 설명할 수 없었다.

사용자가 언급한 Doroti 최적화는 [공통 엔진 기록](../DorotiLab/history/26/11/01/shared-engine-performance-summary.md)에 확인된다. `InheritedElement` 의존성을 선형 `DartMap`에서 Dictionary/LinkedList로 옮겨 검색·등록·삭제 비용과 알림 순서를 함께 관리했다. Nelyx의 대응 `InheritedElement.dependents`는 이미 JS `Map`이다. 내용 해시만 같으면 무조건 동일하다고 판단하는 최적화는 도입하지 않았다.

대신 Nelyx 응답 해석기가 **각 노드마다 전체 blob을 검색**하고 있었다. SceneWriter에서도 설정 명령 종류를 반복 선형 검색했다. 이 반복 검색과 전체 관측 payload, 장면 캡처/ACK 시간을 함께 수정·계측했다.

### 10.2 반영한 변경

- 응답 blob을 **slot+generation**별 Map으로 한 번 분류한다. semantic owner/parent/source 세대 검증, 중복 blob 거부와 개별 payload 검증을 유지한다. 노드의 기본 필드를 두 번째 객체에 복사하지 않고 내부에서 보강한 뒤 한 번 freeze한다. 반환 노드는 계속 불변이다.
- `inspectionFlags.appObservation=2`를 추가했다. 명시적으로 선택한 layout/semantics 관측만 renderer용 paint·path·paragraph/font/image style blob을 생략한다. 좌표·부모·게시 cohort·list demand·layout builder·semantics·편집/선택·control·layer composition은 유지한다. 일반 검사와 렌더러의 기본 응답은 그대로다. 알 수 없는 flag는 거부한다.
- OriginalWidgetHost만 이 경량 관측을 사용한다. 이 경로에서 입력 serial만 달라진 경우 같은 화면을 재복사하지 않는다. 게시 프레임, property, 준비/metrics/device, focus/editing/control 변화는 계속 관측한다. 입력 전달은 별도 interaction queue에서 수행한다.
- SceneWriter의 명령 종류별 Map을 record와 함께 보관한다. handle/부모/자식 순서가 같은 paint 변경은 전체 구조 이동용 임시 Map을 만들지 않는다. 자식 순서 변경과 실제 재배치는 기존 구조 diff를 사용하며, default reset·자원 acquire/release·ACK 의미를 유지한다.
- 같은 App root widget이면 AppRoot/MediaQuery를 다시 교체하지 않는다. dirty State와 metrics 의존성의 BuildOwner 갱신은 계속 실행한다. Native picture 비교는 immutable text/paragraph 값이 같으면 포인터 재할당만으로 cache miss가 되지 않게 했다.
- Windows GPU slot은 GPU 작업 완료 후 반환한다. 각 swapchain image의 present fence/semaphore 수명은 해당 image를 다시 acquire할 때 별도로 확인한다. resize/close drain은 유지한다. GPU 완료와 물리 표시 완료를 동일시하지 않는다.
- Windows trace가 응답 opcode의 `0x8000` bit를 그대로 사용하던 오류를 수정했다. 이제 요청 opcode로 inspect 제외와 input sequence를 기록한다. 이전 trace의 opcode별 분포를 수정 후 분포와 그대로 합치지 않는다.
- App에 최근 128개 build/capture/scene/대기 표본과 관측·records/diff 누적 시간을 추가했다. 종료 시에만 직렬화하며 파일 로그를 만들지 않는다. Hermes의 Date fallback과 performance clock을 진단의 domain으로 구분한다. 이는 정확한 OS input→callback 상관계측 전체를 대체하지 않는다.

GPU cache를 128MiB로 선예약한 중간 후보는 기존 GPU 예산과 충돌해 시작에 실패했다. 해당 확대는 철회했고 최종 변경에 포함하지 않는다. 실패 실행은 PASS 표본이 아니다.

### 10.3 통합 검증

최종 engine source/supply는 **`9fb2046a0056407728d224ef12cc35b8b68b7b13910dd27a9e82f1fd60eae07b`**, ABI **2**, schema **3243076890**이다. manifest **355 files**의 SHA-256과 sourceIdentity 일치를 확인했다. Core/SDK 및 native·Windows App SDK·Wasm 두 profile을 빌드하고 Demo Windows/Web을 이 공급으로 다시 번들링했다.

| 검사 | 결과 |
| --- | --- |
| `check-event-notifications.mjs` | notification/idle/close, 420-node blob 결합·불변성·중복/세대 거부, topology fast path·순서 변경·reset, App input serial만의 재관측 생략·property/publication 변화 관측 PASS |
| `check-app-observations.mjs` | 실제 Wasm Core에서 경량/전체 layout·semantics의 좌표·의미 정보·cohort 동일, 기본 paint 응답 보존, 알 수 없는 flag 거부 PASS |
| `check-frame-reuse.mjs` | semantics 동등성·list batch·paint-only wheel/geometry stale 거부·ledger=0 PASS |
| Web 두 profile | 클릭 직후 wheel, resident 4회 왕복, 큰 이동·반전, 1280×900 resize, 오류 없음, reservedBytes=0 / workersStopped=true |
| Windows 일반 CLI 최종 실행 | Filled callback 표시, offset 0→176→184→176, 오류 없음, exit=0 / reservedBytes=0 / memoryTotal=0 / workersJoined=true |
| Windows 크기 변경 | 동일한 최종 C++/wire 구현에서 1280×729.5 최대화·960×720 복원, 새 layout 표시·종료 확인. 마지막 JS 객체 복사/명령 인덱스 변경 후에는 Web resize만 재확인 |
| 정적 확인 | Core/SDK 타입·Web host 타입, 변경 TS/JS lint·format·diff 검사 PASS |

최종 Windows resident 왕복에서는 **document=25, layoutWork=8,671, paragraphLayouts=461**이 유지되고 queued=0이었다. 하지만 이 전의 클릭 애니메이션/준비에서는 paragraphLayouts가 **59→329**로 증가했다. native value 비교 보강만으로 모든 문단 재기록이 없어진 것은 아니다.

같은 위치의 Filled 클릭 입력 시퀀스에서, 첫 hover 포함 입력부터 **첫 새 document 게시**까지의 단일 비교 표본은 **173.196→105.350ms**였다. 이는 정확한 click-down→callback 지연이나 화면 scanout, p95가 아니다. 첫 paint 변경 preparation wall time은 **69.295→46.437ms**였다. 최종 App document 8–18 표본은 대부분 **27–34ms**, 한 표본은 **80ms**였다. capture는 **6–10ms**, scene update/ACK는 보통 **12–22ms**였고 39ms 표본이 있었다. 초기화 포함 layout 관측 누적은 **29회/386ms**였으며 publication 관측은 **29회/732ms**, 최대138ms로 긴 표본이 남았다. 관측 계측은 RPC 대기와 JS 해석을 합친 값이다.

따라서 **일부 지연 감소는 관측됐지만 §7의 성능 목표를 충족했다고 판정하지 않는다.** 클릭과 비슷하게 느리다는 사용자 보고를 단순 GPU 시간 개선으로 닫지 않는다. Windows 최대화 직후 검은 오른쪽 영역이 일시 관측됐으며 이후 정상 layout으로 바뀌었다. resize 무깜빡임도 PASS가 아니다. Web은 SwiftShader 기능 검사, Windows 조작은 Computer Use 합성 입력이며 물리 트랙패드는 미측정이다.

### 10.4 수락 범위

§9.4의 dirty subtree 전체 전환, 동적 등록 수명, property revision 분리, 독립 builder batch, observed-budget 준비는 잔여 작업이다. 다음 병목은 dynamic descendant 때문에 전체 조상까지 다시 캡처하는 경로와 full SceneWriter records 구성, 반복 문단 재기록이다. 단순 해시 일치로 lifecycle/callback/font/image 등록을 생략해서는 안 된다. 실제 사용자 트랙패드·표시 간격/scanout 수락도 자동 입력 검사와 구분한다. Android는 새 wire 및 공통 변경 미반영 **stale/notVerified**다. 전체 compatible/performance/resizePerformance 수락은 아직 false다. 이번 소유 native process는 모두 종료했고 raw trace·스크린샷·브라우저 profile은 파일로 누적하지 않았다.

## 11. 2026-11-10 전체 재캡처·문단 재기록 집중 수정

### 11.1 변경한 실행 경로

- `RenderSceneCapture`가 **자기 설정 변경**과 **하위 경로 변경**을 구분한다. 깨끗한 정적 하위 트리는 그대로 사용하고, 동적 자식 또는 dirty 자식이 있는 정적 조상은 자식 Scene 연결만 바꾼다. 동적 tap/layer/semantics/editor/image/font 및 layout/sliver builder는 계속 실행한다. 부모/edge 입력, metrics/device/font context가 달라지면 재캡처한다. 자식 이동/제거·실패 복구·node/depth 예산을 유지한다.
- 같은 immutable 자체 설정과 동일 handle topology를 가진 SceneWriter record는 identity를 유지한다. record는 자체 설정과 자식 handle만 보관해 제거된 과거 Scene subtree를 붙잡지 않는다. unchanged handle 재바인딩 할당, 자식별 singleton 배열/flatMap, 설정 전체의 반복 cacheability 검사, 불필요한 재연결 Map도 제거했다. **records의 전체 handle 검증/방문 자체를 모두 없앤 것은 아니다.**
- Native picture cache의 `held` 비용에 공유 font/catalog cache lease가 문단마다 반복 합산되고 있었다. 16MiB picture 예산에서는 같은 문단도 cache에 보존되지 않을 수 있었다. 공유 font lease는 cache entry에 계속 보유하고 unified Ledger에도 계속 회계하지만, 개별 picture 비용에 다시 합산하지 않는다. 실제 전체 메모리 예산이나 16MiB picture 예산을 늘린 변경은 아니다.
- App 전용 관측의 node geometry/BigInt/배열은 **수치 검증 후 접근 시 생성**한다. 반환 객체는 불변이며 geometry는 독립 복사한 packet을 읽는다. 일반 inspect·renderer 응답은 기존 eager 형태다. 사용하지 않는 수백 개 row의 값을 매번 객체로 만드는 비용을 줄였다.

### 11.2 사용자 보고와 확인한 수치

첫 번째 증분 캡처/폰트 cache 후보(`5b0e389e…`, 접근 시 관측 생성 전)를 사용자가 직접 조작한 뒤 **“약간 개선되었지만 10fps도 안되는 것 같다”**고 보고했다. 이는 측정 FPS가 아닌 사용자 체감 보고이며, 성공 판정으로 바꾸지 않는다. 해당 실행 후반 App 갱신 표본은 **43–114ms**였고, 같은 trace의 Core semantics 관측 처리는 약 **0.5–1.4ms**였다. 이 결과에 따라 App 관측 객체 생성과 records 할당/검색을 추가 수정했다.

최종 일반 Windows CLI의 Filled 클릭·scroll 확인:

| 항목 | §10 공급 | 이번 최종 공급 |
| --- | --- | --- |
| 버튼 동작 중 paragraphLayouts | 59→329, 추가 **270** | 59→60, 추가 **1** |
| 목록 첫 이동 후 paragraphLayouts | 461 | **63**, 필요한 새 내용의 3회 추가 |
| 캡처 집계 | 28 pass / 7,948 full capture | 31 pass / **2,367 full capture**, 6,497 ancestor relink |
| SceneWriter records 누적 | 28 builds / 323ms | 31 builds / **196ms**, reusedRecords=9,014 |
| 종료 | 예약/메모리 0 | 예약/메모리 **0**, workersJoined=true, exit=0 |

pass 수와 실행 중 입력 수가 다르므로 위 누적 시간을 그대로 FPS 개선율로 해석하지 않는다. 최종 App document 8–18 표본은 **20–38ms 및 64ms 한 표본**이었다. capture **4–9ms**, scene update/ACK 대부분 **9–18ms**, 긴 표본33ms. 첫 입력→첫 새 document 게시 단일 표본은 **109.533ms**로 §10의105.350ms보다 개선됐다고 판단할 수 없다. **중복 작업은 크게 줄었으나 표시 지연/60fps 해결은 아직 수락하지 않는다.**

### 11.3 공급과 기능·수명 검증

- 최종 engine source/supply **`874c2c56000c6e39e473db0ee0e0682a2ee0dd826527ec8fd4949ef92da65c6b`**, ABI2 / schema3243076890, 355 files SHA-256 일치. Native/Windows host·Wasm 두 profile 및 Core/SDK 빌드, 최종 Core 반영 후 Windows/Web 앱 재번들링 완료. 마지막 App-only 변경은 동일 engine sourceIdentity를 확인해 엔진 중복 빌드를 생략했다.
- `check-incremental-capture.mjs`: 동적 효과 실행, 자체 dirty path, 정적 조상 record identity, 과거 자식 Scene 미보유, reparent, edge/context 변경, 실패 후 재시도, node budget PASS.
- `check-event-notifications.mjs`: 기존 알림/입력/구조 diff 회귀에 더해 420-node eager/lazy 값 동등성, 반환 불변성, 원본 packet 변경 격리, 접근 전 NaN 거부 PASS.
- `check-app-observations.mjs`: 실제 Wasm의 geometry/semantics/cohort 값 동등성, 기본 renderer payload 보존, 잘못된 flag 거부 PASS. `check-frame-reuse.mjs`: native semantics/list/input/ledger 회귀 PASS.
- `check-event-web.mjs --extended`: 두 profile에서 click→wheel, resident 왕복, 긴 이동·반전, resize에 이어 **테마 왕복, Navigation/Favorites, 로컬 이미지/Contain, editor 입력, Show all 복귀** PASS. 메뉴 확장 부분은 semantic action이며 물리 입력 검사가 아니다. 두 profile 모두 오류 없음, 예약0/worker 종료. 초기 검사 실패는 tooltip이 aria-description에 있고 label이 병합된 것을 정확히 찾지 못한 selector 실패였으며, 최종 실행과 구분한다.
- Windows 최종 일반 명령에서 Filled callback 표시, offset0→176, 오류 없음·정상 종료를 확인했다. 동일 C++/관측 구현의 직전 실행에서는 offset176→184→176 동안 문단/layout 수 유지도 확인했다. 최종 App-only allocation 변경 이후 Windows resize/IME 세부 행렬은 다시 실행하지 않았다.
- 테스트는 20분 제한, 임시 빌드·browser profile은 종료 시 정리한다. raw trace/스크린샷은 파일로 누적하지 않았다. 최종 공급의 별도 데모 창 하나를 사용자 재확인용으로 열어둔다.

### 11.4 남은 성능 범위

전체 records handle 방문, 동적 노드 자신의 매번 구성, publication/layout 관측 왕복, 큰 route/첫 방문 비용이 남는다. 그 결과 및 사용자 실제 입력을 함께 봐야 한다. 내용 hash 일치만으로 callback/font/image 수명을 생략하지 않는다. **performanceAccepted=false / resizePerformanceAccepted=false**, 실제 표시/scanout은 미측정이며 Android 공급은 stale/notVerified다. `5b0e389e…`에 대한 사용자 체감 보고와 최종 `874c2c56…` 앱의 후속 확인을 구분한다.

## 12. 2026-11-10 입력부터 게시까지 전체 경로 재검토

### 12.1 확인한 구조와 수정

사용자 후속 요청: **“근본적인 문제가 뭔지 전체적인 구간들을 검토하고 고쳐줘”**. §11 창에서 사용자가 실제 조작한 후 종료한 기록도 분석했다. App 380 builds에서 records 3,476ms / diff 1,383ms, publication 관측 516회 8,091ms / layout 관측 504회 5,993ms였다. 각 비용의 실행 구간이 겹치므로 합계를 화면 FPS로 환산하지 않는다.

| 구간 | 확인한 문제 | 변경 |
| --- | --- | --- |
| Windows App 실행 | 큰 JS 소스를 Hermes runtime compiler로 실행. 최적화 bytecode producer가 v2 일반 경로에 없었음 | 같은 pinned VM의 hermesc를 SHA 검증된 공급에 포함하고 기존 no-CFG 최적화 정책으로 app.hbc 생성·실행. Babel class 변환과 ES6 block scoping을 적용. 앱 manifest에 bytecode/source/policy/version을 결합하고 오래된 JS-only 번들을 거부 |
| 입력→관측 | pollEvents가 publication/layout RPC를 모두 기다린 뒤 다음 입력을 처리 | 입력 drain과 관측 owner 분리. 관측은 한 건만 진행하고 최신 요구 하나로 합침. 늦은 관측이 최신 입력 state를 덮어쓰지 않음 |
| list 관측 | 소수 list observer 때문에 전체 노드 layout을 직렬화·디코딩 | appLayoutSelection으로 해당 handle과 직계 부모만 요청. 기본 renderer/full inspection은 유지. 재활용된 generation은 반환하지 않음 |
| geometry/focus | 동기 조회와 semantics 조상 순회에서 nodes.find를 반복 | snapshot 수명에 결합된 WeakMap 인덱스를 공유하고 generation을 대조 |
| native 응답→App | 완료된 응답도 하나를 resolve한 뒤 전체 microtask를 실행해 다음 응답을 지연 | 이미 완료된 bounded mailbox를 먼저 resolve한 뒤 continuation 실행 |
| App frame 요청→게시 | 콜백 예약만으로 dirty=true가 되어 변경 없는 문서도 GPU 제출/게시. 다시 publication 관측과 layout 재관측을 유발 | 콜백 예약과 paint invalidation 분리. AppFrame 이벤트는 계속 전달하지만 실제 transaction/native motion/input이 있을 때만 새 화면 제출 |
| GPU 완료→게시 | QPC/DWM은 약 6ms 주기이나 condition_variable timed wait는 Windows timer quantum에 영향받음 | 전역 timer period 변경 없이 owner 전용 high-resolution waitable timer와 interrupt event 사용. deadline 전에 입력/종료 신호가 오면 즉시 깨움 |

기존 실패 공급 `1ad8ba38…`의 최초 raw-class HBC는 `Diagnosticable` constructor 오류로 종료했다. 이후 기존 native producer처럼 class 변환을 적용한 실행은 버튼 callback·scroll·정상 종료를 통과했다. 이 중간 실행의 layout 관측 평균은 약 **1.81ms**(108회/195ms)였지만 App document 8–18은 **15–42ms**라서 최종 개선으로 수락하지 않고 timer/mailbox/index 수정까지 진행했다.

native 대기 검사: 3ms 요청 8회씩 비교에서 condition variable 평균 **7.465ms**, high-resolution timer **3.179ms**. deadline 조기 반환 없음, 진행 중 interrupt와 미리 도착한 wake 처리 PASS. 이 수치는 표시 FPS가 아닌 OS 대기 구간 검사다.

### 12.2 통합 검증

최종 공급의 실행 측정과 기능·수명 결과는 아래에 기록한다. 성능 수락은 실제 표시/입력 확인과 분리한다.

- 최종 source/supply **`a0300a429496272d1d5d5859665affa1281a1634ca8b625fe6130e31ea132abc`**, ABI2/schema**3270880734**, **356 files**. sourceIdentity·공급 파일 hash·Windows/Web 앱 manifest 검증 완료. Windows 앱은 HBC99 / no-CFG 정책 / Babel class 변환으로 실행하며, compiler는 CLI 자체 dependency에서 해석한다. JS source SHA는 `11dd05fb7e7725a1ae02e5e2abd3d7ffc6fe22d4ad75851259fa10e0acd7c23e`다.
- 일반 CLI 최종 실행: Filled callback 표시, scroll **0→176→184→176**, 오류 없음. 작은 왕복 동안 **document38 / layoutWork14,404 / paragraphLayouts63 유지**. 버튼 구간 문단59→60, 첫 목록 이동63으로 기존 cache 수정도 유지된다.
- 첫 pointer 입력→첫 새 document 게시 **46.715ms**. §11의109.533ms와 동일한 계산 방식의 제한된 단일 표본이며, 물리 click→scanout p95나 FPS 측정은 아니다. 버튼 구간 document8–28의 App 갱신 표본은 **12–30ms**. 전체 실행39 builds, records157ms/diff61ms, publication 관측37회233ms(최대16ms), 선택 layout 관측55회186ms(최대13ms). 입력 수와 pass 수가 다른 실행의 누적 시간을 직접 FPS 비율로 환산하지 않는다.
- 재게시 제거 직전 `35797023…`의 버튼 trace는 동일 document9를10회 게시했다. 최종 trace는 document9를2회, 이후 게시된 document12–28은 각각1회였다. 실제 native 입력/overlay 변경의 추가 프레임은 유지한다. Frame callback만 요청했을 때 property epoch 불변·takeFrame notFound·AppFrame 이벤트 전달을 실제 Wasm 회귀검사로 별도 입증했다.
- `check-event-notifications.mjs`: 알림/lost wake/입력 batch·idle·종료, 지연된 geometry와 독립적인 입력 drain, 단일 관측 진행, 이전 응답의 입력 fence 역행 방지, node index generation 대조 PASS.
- `check-app-observations.mjs`: 전체/projected 값 동등성과 기본 renderer payload, 선택 node+부모, 누락/재활용 handle, 중복/잘못된 flag/잘린 body 거부, callback-only 무재게시 PASS. `check-incremental-capture.mjs`와 native `check-frame-reuse.mjs`도 PASS. 타이머 회귀는 8회씩, 모든 검사20분 제한.
- **최종 Core 변경 후** Web threaded/single-worker의 `check-event-web.mjs --extended`에서 button→wheel, 기존 항목 왕복, 긴 이동·반전, resize, theme, route, image, editor, 종료 모두 PASS(예약0/worker 종료). Windows 최종에서는 button/scroll/종료를 재검증했다. 직전 동일 native timer/mailbox/HBC 구현의 `35797023…`에서는 최대화·복원·dark theme·drawer·로컬 이미지 표시도 확인했다. 확대 직후 기존 크기의 화면 오른쪽에 검은 영역이 잠깐 나타나므로 resize 표시 성능을 해결했다고 쓰지 않는다.
- 최종 Windows **exit0 / reservedBytes0 / memoryTotal0 / memoryPeak466,335,730 / workersJoined=true**. 변경 파일 lint/format·diff 검사 완료. 자체 임시 디렉터리와 browser profile은 종료 시 정리했으며 raw trace/스크린샷 파일은 누적하지 않았다.

**수락 경계:** 불필요한 게시→관측 반복과 입력 직렬 대기 등 확인한 구조적 원인은 수정했다. App 전체 records 방문·동적 구성·GC 등의 비용은 남아12–30ms 표본을 보이며, 60fps/실제 트랙패드/scanout 수락은 여전히 별도다. **performanceAccepted=false / resizePerformanceAccepted=false**, Android stale/notVerified를 유지한다. 최신 공급의 초기 화면을 별도 창으로 열어 사용자 재확인에 제공한다.

## 13. 2026-11-10 트랙패드 손 떼기·관성·목록 준비 경계 후속

사용자는 §12의 체감 개선을 확인했지만 스크롤 끊김과 **손을 뗄 때 관성이 거의 없는 현상**을 보고했다. 해당 실제 조작 실행에서 precision-trackpad-directmanipulation 입력679개는 모두 admitted/rejected0이었다. Core의 canceled22와 별개이며, 마지막 App 표본에는34–50ms가 남았다. 입력 미수신으로 단정하지 않는다.

### 13.1 수정

- Host가 마지막 delta/time 한 건으로 속도를 계산해, DirectManipulation의 마지막 0 transform에서 속도를0으로 덮어쓰던 경로를 교체했다. 최대8개/약100ms 위치 이력의 기울기로 추정하고 이벤트 QPC 시각을 쓴다. 실제 움직임이80ms 이상 없으면 관성을 만들지 않으며 반전·동일 시각 묶음·취소를 구분한다.
- 목록의 준비된 범위 끝에서 normal end가 들어오면 deferred라는 이유로 관성 시작을 생략하던 조건을 제거했다. 이미 수락된 요청 위치에서 관성을 이어간다. 새 행을 기다리는 동안에는 관성 clock/속도를 보존하고, 같은 미반영 delta를 반복 누적하지 않는다. 실제 전체 목록 끝에서는 정지한다.
- 준비된 내용으로 교체할 때의 anchor 보정을 관성 시작점에도 반영한다. 새 접촉과 명시적인 관성 취소는 남은 이동을 중단한다. Pointer/canonical scroll의 같은 종료 경로도 일치시켰다.
- Windows 취소를 normal panZoomEnd로 보내던 것을 panZoomCancel로 분리했다. 종료 후 inactive stream의 inertiaCancel도 처리하여 재접촉/취소를 무시하지 않는다.
- `V2_INPUT_SOURCE`에 ends/movingEnds/lastEndVelocity를 추가했다. 실제 손 떼기 후 속도 전달을 기능 검사와 별도로 확인하기 위한 계측이다.

### 13.2 검증

- 현재 소스와 새 native Core library 각각에서 `check-frame-reuse.mjs` PASS. 일정 속도, 마지막0 transform, 정지 후 손 떼기, 반전, 같은 시각 샘플, 취소, coverage 경계에서 손 떼기, 준비 대기 중 중복 delta 방지, 내용 도착 후 재개, 실제 끝 정지, 새 접촉 정지 및 ledger0을 확인했다. 각 실행20분 제한이며 임시 출력은 finally에서 삭제한다.
- 빌드·앱 실행과 실제 트랙패드 확인 결과는 아래에 추가한다. 물리 트랙패드 관성을 마우스 휠 주입으로 검증했다고 쓰지 않는다.
- 최종 engine/supply **`0d0cdfa1534a03792bdd20341df715754dd66a208570be27b1e8dd98830faa4d`**, ABI2/schema3270880734, 356 files. native/Windows App SDK/Wasm 두 profile 빌드 및 Windows/Web 앱 재번들·identity 검증 완료.
- 새 공급의 App 관측/콜백 무재게시 검사, Web threaded/single-worker의 버튼·wheel·기존 항목 왕복·긴 이동·resize·테마·경로·이미지·편집·종료 통합검사 PASS. 두 Web profile 모두 예약0/worker 종료. 소유 임시 출력은 정리했다.
- 일반 Windows CLI의 새 창 app-ready/초기 화면/오류 없음 확인. 실제 트랙패드 확인을 요청해 창을 제공했다. 자동 기능 근거와 사용자의 관성·끊김 평가는 분리한다.
- 요청 후 확인 시 새 실행의 precision admitted/ends/movingEnds는 모두0이었다. 따라서 이 공급의 물리 lift/coasting 체감은 아직 **notVerified**이며 창을 열어둔다. 스크롤 전체 성능/resize 성능 flag는 false를 유지한다.
- 이후 사용자 실제 확인: **“관성은 생겼지만 끊김이 큼”**, **“60fps로 렌더 되다가 0.5초마다 끊기는 느낌”**. 새 공급에서 admitted315/rejected0, ends24/movingEnds24, lastEndVelocity2196.45를 기록했다. 관성 소실은 사용자 체감 개선을 확인했으며, 전체 부드러움은 미수락이다. 해당 trace의 항목 준비 구간 게시 간격은105.7/153.1/188.1ms인 반면 그 프레임의 Core/GPU 제출·완료 자체는 약11–16ms였다.

## 14. 2026-11-10 주기적인 목록 경계 정지 — 사전 준비 복원

- nativeListRange가 실제 보이는 영역만 반환하고, Source Viewport의 기본 cacheExtent250px를 native 경로가 반영하지 않았다. 그래서 보이는 경계를 넘은 뒤에 App/Content 왕복으로 다음 행을 만들며 주기적으로 기다렸다.
- nativeListCacheRange를 layout 준비와 App list-demand 관측 양쪽에 적용했다. 우선 실제 viewport를 덮고, 기본250px 앞뒤 범위를 준비한다. 준비 범위가 절반 이하로 줄기 전에 다시 채우고, 기존 범위 안의 작은 스크롤에서는 같은 Source window를 유지한다.
- 최대128행 budget과 unknown indexed row 최대8개 batch를 유지한다. 뒤쪽 cache 때문에 visible rows가 예산에서 밀리지 않으며, 준비 재개 시 이전 geometry가 이미 수락된 새 window를 되돌리지 않도록 현재 선언을 기준으로 삼는다.
- native 회귀에서 resident window 유지, 미리 refill, reverse 준비, dense-list visible coverage/budget, empty viewport, unknown measurement batch, 이전 geometry의 window rollback 방지 PASS. 최종 앱 검증은 아래에 추가한다.
- 최종 source/supply **`ee87662c02e010404fb921c3b7a75f98cf3e2bd95b965f37c03c1dcac13cd681`**, ABI2/schema3270880734,356 files. Native/Windows App SDK/Wasm 두 profile 빌드, Windows/Web 재번들 및 sourceIdentity 확인 완료.
- 새 library의 frame/list/precision/inertia/ledger 회귀와 App 관측 검사 PASS. Web 두 profile의 긴 이동·반전·기존 항목 왕복·resize·theme·route·image·editor·close 모두 PASS(예약0/worker 종료). 새 물리 확인용 Windows 창을 제공한다. §13의 관성 확인을 이 공급의 주기적 끊김 해결로 확대하지 않는다.
- 사용자 후속 확인: **“조금 줄었지만 여전히 큼”**. cache 복원만으로 해결되지 않았으며 전체 성능은 미수락이다.

## 15. 2026-11-10 이동 중 builder 준비 재시작과 속도별 선행 준비

- `LayoutWork::resumeBuild`가 offset 하나라도 달라지면 준비 재개를 거부했다. 같은 목록의 App 자식 응답을 기다리는 동안 compositor 스크롤이 움직이는 정상 상황에서도 전체 준비 경로를 다시 탔다. pending list의 자기 viewport 이동만 retarget하여 완료한 형제/부모 작업을 유지한다. 다른 viewport와 manual/editor 변경, generation·constraints·문서 경계 검사 등은 유지한다.
- Source child 응답 재개 시 최신 native offset/velocity를 전달하고 parent box의 요청 위치도 갱신한다. 테스트는 실제 LayoutWork를 App builder 대기까지 진행시킨 뒤, 다른 viewport/manual 변경 거부 및 자기 viewport0→8 이동의 continuation 성공·다음 요구offset8을 확인한다.
- 250px 고정 cache만으로 빠른 관성 중100ms 이상인 App/Content 응답을 숨기기 부족했다. 진행 방향에 native 속도×350ms를 선행 준비 힌트로 사용하고 속도×180ms 여유에서 refill한다. 기본250px, 최대 두 viewport,128행/unknown8행 제한을 유지하며 반대 방향의 기본 cache도 유지한다. 예측값은 준비 범위만 선택하며 실제 offset/측정 geometry를 만들지 않는다.
- 현재 소스 회귀에서 속도 방향별 추가 준비·budget, moving builder continuation/fence, 기존 관성/cancel/coverage·ledger0 PASS. 최종 공급·앱 검증은 아래에 기록한다.
- 최종 engine/supply **`b00ad6814988010044da3bf03df189cbf32746fd537a0b098151187aa8a3a593`**, ABI2/schema3270880734,356 files. 전체 native/Windows/Wasm 빌드와 Windows/Web 앱 재번들·sourceIdentity 확인 완료. 새 native library의 continuation·관성·cache 회귀, App 관측, Web 두 profile의 전체 extended 검증 모두 PASS(예약0/worker 종료). 별도 Windows 창을 제공해 실제 주기적 정지 평가를 이어간다.

## 16. 2026-11-10 준비 실패 복구와 중복 App 왕복

- §15 사용자 확인은 **“줄었지만 아직 눈에 띔”**이다. 그 실행에서 preparation63/document99가 상태19로 실패했으며 activeDocument96에 머물렀다. 상태19는 `budgetExceeded`다. 이전 `contentUnavailable(19)` 표기는 잘못됐으며 콘텐츠 부족은31이다. 별도로 완성된 준비 범위가 현재 offset을 덮지 않는 activation 분기도 조사했으나, 그 회귀 수정만으로 이 예산 초과의 원인이 해결됐다고 볼 수 없다.
- 숫자 requested/preparedOffset이 같아도 실제로 필요한 child range가 바뀌면 재준비하도록 했다. 해당 viewport와 조상 캐시를 무효화하여 같은 잘못된 준비 결과를 반복 재사용하지 않는다. 실패 시 preparation/document/offset/coverage 범위를 출력하는 제한된 진단을 추가했다. 실제 LayoutWork와 retargeted-coverage 회귀는 새 native Core에서 통과했다.
- 현재 native/Windows/Wasm 공급은 **`f546d901a85bcf10835f3e3893527c22b8b2ee863dcf2530ea1b3e255b0f356d`**, ABI2/schema3270880734,356 files. App 관측 검사 및 Web 두 profile의 extended 검사 통과. 일반 Windows 실행 오류0, 종료 exit0/reservedBytes0/memoryTotal0/workersJoined=true였다. 물리 주기적 끊김 수락은 아직 아니다.
- 환경 변수로 명시적으로 켠 실행에서만 최대30초/250Hz Hermes CPU 샘플을 수집했다. 마우스 휠4회 진단의 GC 최대 pause는3.7699ms였고, App 활성 샘플은 capture/records/child build에 집중됐다. 이 표본을 물리 트랙패드나 FPS 측정으로 바꾸어 해석하지 않는다. 로그와 CPU profile은 메모리에서만 읽었고 파일로 누적하지 않았다.
- `observeSliver`에서 최신 published document/metrics와 실제 measured leading row를 확인할 수 있으면 그 자료로 다음 child window를 직접 준비한다. 빈 window 게시→Core 재요청→App 재구성 왕복을 줄인다. 진행 중인 transaction/preparation, stale document, 실제 leading row가 없는 경우에는 기존 권위 있는 builder 요청 경로를 유지한다. Web 기존 범위 왕복은 layout/measurement 증가 없이 통과했다. 최신 실제 트랙패드 평가는 **notVerified**다.
- 후속 사용자 요청으로 날짜 선택기를 추가하다가 **Flutter 원본 그대로 컴파일할 것**으로 요구가 명확해졌다. 임의로 작성한 달력 위젯과 전용 단위 검사는 제거했다. 해당 간이 위젯의 이전 PASS는 원본 날짜 선택기의 근거가 아니다. 원본 변환 작업과 native PageView/GridView 연결을 이어가며, 스크롤의 **performanceAccepted=false / resizePerformanceAccepted=false**를 유지한다.

## 17. 2026-11-10 원본 날짜 선택기와 최초 페이지 준비

- Flutter `71e4717a61786faab4c7aa39825989305ed29e8a`의 9개 라이브러리에서 75개 선언을 analyzer IR로 변환했다. 원본 월/일/연도/입력 상태 로직과 날짜 지역화 본문을 생성하며, 임의 작성 달력을 대체했다. fresh 재생성 비교, 원본 Dart oracle와 compiler 거부 경계 통과. 지원 범위는 Material 3 / 원본 US-English / 단일 날짜 선택기이며 Cupertino·범위 선택기 전체 완료가 아니다.
- 최초 표시 지연의 확인된 중복은 0번 월 window 준비→Core initial seek→선택 월 window 준비→opacity 노출이었다. Flutter `_PagePosition.applyViewportDimension`의 초기 위치 확정 순서처럼 Content에서 받은 page 폭으로 초기 offset을 선언하고 Core 첫 layout/activation부터 적용한다. 동일 node generation의 후속 선언은 현재 offset을 초기값으로 되돌리지 않는다. 첫 준비는 선택된 월 하나로 한정하고 인접 월 4-page window는 첫 게시 이후 준비한다. 이 준비 중 인접 월 이동은 coverage를 기다린다.
- 원본 UI에서 확인한 예산 문제도 수정했다: semantics373/기존256 제한을 1024로 조정(초과1025 거부 회귀), full scene 관측이 1MiB를 초과할 때 response 한도를4MiB로 분리(request1MiB 유지). unrelated publication이 진행 중 list seek의 requested offset을 지우지 않게 했다. Core64MiB ledger pressure에서는 입력이 참조하지 않는 과거 publication lookup을 줄이고, 활성 입력이 소유한 snapshot과 최신2개는 보존한다.
- generated enum의 Dart 동일성 등록으로 원본 Restorable 모드 setter를 연결했다. Web semantic activation은 같은 generation의 현재 Core route를 검사하며, 과거 peer의 화면 위치가 바뀌었다는 이유만으로 클릭을 버리지 않는다. 반복된 편집 snapshot이 아직 mailbox에 도달하지 않은 DOM 선택 영역을 접는 문제도 수정했다.
- 최종 engine 공급 **`e20cf385e5d743cbc0f2a189be0e7277aea9d079289e85ad819512b5b17ad79b`**, ABI2/schema2570296319. sourceIdentity 일치, native/WindowsAppSDK/single-worker/threaded 빌드, Core/SDK/Material 빌드, 변경 TS lint 및 diff 검사 통과.
- 최종 native 회귀: first-page-only layout/activation, 동일 generation 재게시 초기화 방지, 기존 PageSpring/가로 pages/RTL grid/semantics, pending seek/history pressure, moving list/precision inertia/frame/lease 검사 PASS. App 관측의 큰 응답·request 제한·flag 거부도 PASS.
- Web `check-event-web.mjs --extended` 최종 **isolated/plain 모두 PASS**, 원본 월/연도/날짜 선택, 즉시 다음 달, 확인/취소/재개방/잘못된 날짜/윤년 입력, 기존 theme/route/image/editor/scroll/resize 포함. 오류·preparation-error 없음, reservedBytes0/workersStopped=true. 최종 첫 accessible grid는 isolated871ms/plain840ms, dialog는844ms/830ms로 간격27ms/10ms였다. 이는 접근성 게시 관측이며 scanout/물리 클릭 지연 수락으로 바꾸지 않는다.
- Windows는 사용자 일반 CLI로 실행하여 올바른 초기 월, 취소 후 재개방, 다음 월 표시를 화면에서 확인했다. 종료 exit0/reservedBytes0/memoryTotal0/workersJoined=true, memoryPeak535287900. 별도 UIA 시간 표본은 화면보다 오래된 tree가 반환되어 표시 지연 근거에서 제외했다. Windows 최초 표시의 물리 수치·트랙패드 잔여 끊김은 **notVerified**, **performanceAccepted=false / resizePerformanceAccepted=false** 유지.

- 정리: 이번 검증용 `.nelyx/date-picker-port` 재귀 삭제가 자동 승인 검토의 `blocked by policy`로 거부됐다. 세부 사유는 제공되지 않았고 우회하지 않았다. 관련 process/native 창0, 1,056 files / 647,805,507 bytes 정리 미완료. 현재 dist와 구분한다.

## 18. 2026-11-10 반복 월 이동의 공통 실행 경로 개선

- 사용자 후속 보고는 “트랙패드로 달력을 넘기면 점점 느려짐”이며, 엔진 자체 수정이 필요한지도 물었다. 초기 날짜 표시 개선을 반복 이동의 성능 수락으로 간주하지 않는다.
- 수정 전 Web 합성 수평 wheel 12회(6회 전진/6회 후진)에서 살아 있는 월4개, Elements5488–5602, nodes2197–2239, builder7개로 유지됐다. Core reserved는 약38.6→43.8MB에서 안정됐다. 이 제한된 표본에서는 선형 누수가 재현되지 않았으나, 월 경계마다 기존 children 재생성과 LayoutBuilder별 전체 scene 왕복이 반복됐다. baseline 전송111회/build122회였다.
- `runtime/app/scroll.ts`: 동일 delegate generation에서 창 범위만 움직이면 기존 Entry/Widget을 재사용하고 신규 children만 만든다. 실제 delegate 변경은 재빌드한다. `runtime/app/host.ts`: 동일 metrics/device/font에서 dirty retained LayoutBuilder들을 마지막 Content-supplied constraints로 한 준비 안에서 재빌드한다. Core의 실제 parent constraints 비교가 유지되며, 일치하지 않는 결과는 게시하지 않고 새 입력을 요청한다. 앱에서 layout을 계산하는 fallback은 추가하지 않았다.
- **C++ Core** `protocol/transaction.cpp`: 완료된 box LayoutBuilder의 callback revision만 바뀌고 실제 constraints가 같으면 layoutRevision을 불필요하게 변경하지 않는다. 자식 geometry 변경은 별도로 dirty 전파하고, 입력이 바뀌면 기존대로 재레이아웃한다. native 회귀에서 같은 입력의 measured geometry 재사용과 잘못된 parent constraints 거부를 확인했다.
- 열린 달력 resize 검사에서 별도 status31(contentUnavailable)/page viewport 준비 범위 실패를 발견했다. App이 이전 폭 기준 pixels를 새 itemExtent로 나누며 잘못된 월 window를 만들던 문제였다. window 선택에 logical page를 사용해 Core anchor와 맞췄다. portrait 전환 뒤 표시 월 유지와 게시 완료를 확인했다.
- 최종 공급 **`53aaaba2ccee2b728aebad7f35bd0e7cf2c7bcd46c9ecb2bf4797f5fd1139214`**, ABI2/schema2570296319. sourceIdentity 일치, native/WindowsAppSDK/양쪽 Wasm 및 Core/SDK/Windows·Web 앱 빌드 통과. native frame/precision/moving-list/page/grid/cache/lease 검사와 App 관측 검사 PASS.
- `check-date-scroll-web.mjs`: isolated 12회 전송44회, plain 12회 전송43회(기존111회 대비 약60–61% 감소), 월4개/nodes2197–2239/builders7 유지, Core reserved 약44MB로 bounded. 두 profile 모두 열린 달력 resize와 logical month 유지, 오류 없음, close reservedBytes0/workersStopped=true. 초기 인접 월 prefetch가 끝나기 전의 baseline은 성장으로 오판할 수 있어 App preparation settle 뒤 측정한다.
- 최종 `check-event-web.mjs --extended` isolated/plain 모두 PASS: 날짜 선택·월/연도·입력·확인/취소/재개방 및 기존 theme/route/editor/image/scroll/resize/종료. 새 native 일반 CLI에서 ready/appGeometryNodes0/rejectedFallbacks0와 원본 달력 표시를 확인하고, 사용자 트랙패드 확인을 위해 창을 열어 두었다.
- 위 수치는 준비/전송 횟수와 제한된 메모리 관측이다. 모든 Content 작업량 또는 실제 FPS가 같은 비율로 감소했다는 뜻은 아니다. 실제 트랙패드의 누적 지연/scanout 수락은 **notVerified**, **performanceAccepted=false / resizePerformanceAccepted=false** 유지. 이전 임시 root 삭제 거부는 재시도하지 않았으며 이번 검사의 로그/profile archive는 만들지 않았다.

## 19. 2026-11-10 새 월 진입·빠른 다중 월 이동 후속

- 사용자 물리 피드백: 누적 지연은 줄었으나 **새 월 렌더링이 필요할 때와 여러 월을 빠르게 건널 때 버벅임**. §18 자동 검증을 이 잔여 증상의 수락 근거로 쓰지 않는다.
- 이전 Windows 수동 실행을 정상 종료하고 메모리에 남은 bounded 진단을 확인했다. document228 표본은 build312ms/capture468ms/scene143ms, 완료까지 약1011ms였다. 전체 publication observation 최대1089ms, layout observation 최대1064ms. 종료 status0/reservedBytes0/memoryTotal0/workersJoined=true, memoryPeak604966184. 이 App/RPC 표본은 scanout 지연 또는 순수 GPU 비용이 아니다.
- C++ `LayoutWork::resumeBuild`: fixed horizontal page 안의 일반 box builder가 답변을 기다릴 때, 조상 viewport의 offset 변화만으로 답변을 버리던 조건을 수정했다. 같은 ancestor/page 구조와 동일한 실제 builder constraints이면 진행 중인 layout continuation을 이어 간다. Source sliver/editor 및 foreign/manual 입력 fence는 유지한다. 회귀에서 이동 중 descendant reply 수락·최신 offset 보존·외부/manual 거부를 확인했다.
- App `NativeListState.reset`: onPageChanged/월 제목 재빌드 때 현재 logical page를 포함하는 기존 prefetch window를 보존한다. Core demand가 실제 범위를 이동시키며, callback 재빌드가 준비 중인 창을 기본 위치로 되돌리지 않는다. 월 cache는 여전히4개로 bounded이며 용량 한도를 올리지 않았다.
- 불변·단순 semantics는 canonical setter의 dirty 신호에 따라 재캡처한다. mutable 객체가 있는 semantics와 range는 동적 경로를 유지한다. label/action 변경 후 새 callback이 호출되고, 변경 없는 configuration은 재사용되는 회귀 PASS. Windows 동일 startup8 passes에서 dynamic capture398→68을 관측했으나 이 수치를 월 전환 FPS 개선율로 바꾸어 해석하지 않는다.
- 최종 공급 **`840c007b00058751c3eaa886874d2432c70dada287f3a99e5038b2d67a21ce30`**, ABI2/schema2570296319. sourceIdentity 일치. native/WindowsAppSDK/Wasm·Core/SDK·앱 빌드, native frame/precision/moving-list/page continuation/cache/lease, incremental capture/semantics, App observation, TS lint/diff 검사 PASS.
- `check-date-scroll-web.mjs --both --burst`: 각 profile에서 빠른 수평 wheel6회 후 역방향6회, 이어서 열린 달력 resize를 검사했다. 정상 종료/오류 없음, nodes2234–2239/builders7 및 예약 bounded, resize 후 logical month 유지, close reservedBytes0/workersStopped=true. **합성 wheel은 물리 precision trackpad와 동일하지 않다.**
- 최종 Web extended isolated/plain 모두 PASS(원본 달력의 월/연도/날짜/입력/확인/취소/재개방, 기존 theme/route/image/editor/scroll/resize/close). 일반 Windows CLI ready/appGeometryNodes0/rejectedFallbacks0 확인. 새 창을 사용자 물리 확인에 제공한다. **performanceAccepted=false / resizePerformanceAccepted=false**, 새 월/빠른 다중 월 이동의 최종 체감은 재확인 전이다.

## 20. 2026-11-10 빠른 월 왕복의 실제 오류 종료와 KeepAlive 분리

- §19 사용자 확인은 **“여전히 버벅이고 빠르게 다음 달로 넘기던중 크래시난듯”**이다. 실행 종료 코드1을 확인했다. 최초 preparation69/document73에서 현재 offset40972.8보다 준비 하한41280이 앞서 `contentUnavailable(31)`가 발생했고, 이후 오래된 범위의 준비 실패가 반복됐다. document103에서는 **nodes3451/4096, semantics1028/1024**로 transaction `budgetExceeded(19)`가 발생했다. session 메모리 최대578368052/805306368이므로 이 증거를 일반 메모리 부족이나 GPU 크래시로 분류하지 않는다. 오류 후 종료 정리는 reservedBytes0/memoryTotal0/workersJoined=true였다.
- `NativeListState`는 화면 밖 KeepAlive 항목을 살아 있는 Source State뿐 아니라 전체 native scene에도 유지했다. 이제 보존된 항목의 wrapper/키/State는 유지하되 화면 밖 자식 geometry·semantics·LayoutBuilder 캡처는 제외한다. 실제 focused 항목은 제외 대상이 아니다. KeepAlive가 해제되면 다음 스크롤까지 기다리지 않고 Source 항목도 정리한다. 사라진 native mouse region의 마지막 전달된 enter에는 exit를 정확히 한 번 전달하여 보존된 Ink hover 상태가 남지 않게 한다. 한도1024는 올리지 않았다.
- C++ 활성화에서 고정 목록의 늦은 window가 현재 offset을 덮지 못할 때, 같은 viewport/list handle·count·extent인 기존 scene을 유지하고 준비를 superseded로 취소한다. 현재 demand를 App에 재요청하고 같은 낡은 문서를 busy-loop하지 않는다. App은 같은 count/extent의 이전 page generation에서 **demand만** 받으며 anchor/focus/geometry는 재사용하지 않는다. resize·다른 목록 경계는 유지한다.
- 최종 공급 **`03b6095dabab90803be040ec6fefe179aadc71fb4085207f5669fc04a5d97699`**, ABI2/schema2570296319, sourceIdentity 일치. native/WindowsAppSDK/Wasm·Core/SDK 및 Windows/Web 번들 재생성 완료. 실제 번들에서 `collectingParked`/`onChildrenInvalidated`까지 반영된 것을 확인했다.
- native 회귀: 늦은 fixed window 취소→needChildren→obsolete 문서 재시도 없음→수정 window 활성화 및 lease0, 기존 frame/precision/list/page/continuation 검사 PASS. App observations 및 incremental capture/semantics/hover terminal 검사 PASS.
- Web `--precision --burst --reverse --both`: 실제 Core stream phase1/2/3과 x delta/속도를 주고, App update120ms·builder reply60ms 지연을 주입했다. profile별12회 방향 전환 뒤 nodes2197–2239/elements5488–5602/builders7, resize 후 logical month 유지, close reservedBytes0/workersStopped=true. 이는 Windows DirectManipulation 물리 입력이나 FPS 측정이 아니다.
- `--precision --burst --keep-alive --both`:9–10개 월의 Source KeepAlive를 강제로 유지하며 빠르게 앞뒤 이동했다. Source elements10787–11863을 보존하는 동안 native nodes2202–2249/semantics627–635/builders7로 유지했고 resize·close도 통과했다. 해당 회귀는 Source 보존 자체를 제거해 예산 문제를 숨기는 것을 방지한다.
- 최종 Web extended isolated/plain 모두 PASS. 중간 번들 검증에서는 `Native scroll failed (27)`가 한 번 관측됐으며, 그 결과를 성공으로 덮지 않는다. 최종 번들에서는 재현되지 않았지만 간헐 list command stale 경로는 후속 물리 실행에서 계속 추적한다. Windows 일반 CLI ready/appGeometryNodes0/rejectedFallbacks0 확인. 이전 확인 창 종료 exit0/reservedBytes0/memoryTotal0/workersJoined=true. 최종 창을 물리 확인에 제공한다.
- **performanceAccepted=false / resizePerformanceAccepted=false / physicalAcceptance=notVerified**. 이번 결과는 확인된 노드 예산 초과·준비 복구 경로의 수정과 자동 회귀 근거이며, 빠른 다중 월 이동의 체감 해결 판정은 아니다.
- 최종 Windows 창에서 Selection→Choose date와 November2026→December2026의 실제 그리드/접근성 표시를 확인했다. 입력 중 오류 출력은 없었으며 이 창은 사용자 트랙패드 확인을 위해 열어 두었다. 버튼 한 번의 성공은 빠른 물리 왕복 검증을 대체하지 않는다.

## 21. 2026-11-10 종료 해결 후 남은 앱 CPU·객체 생성 비용

- §20 물리 피드백은 **“종료는 없지만 끊김은 여전함”**이다. 해당 실행은 exit0/reservedBytes0/memoryTotal0/workersJoined=true, memoryPeak616660456이었다. App preparation 표본에는 document184 build293ms/capture511ms/scene152ms, document197 build355ms/capture700ms/scene106ms 등 긴 구간이 남았다. FPS나 scanout 표본으로 환산하지 않는다.
- 같은 공급을 임시 환경 변수 `NELYX_V2_CPU_PROFILE=1`로 실행하고 stdin의 profile-start/stop으로 최대30초·250Hz 표본을 수집했다. 파일/profile/browser 자료는 누적하지 않고 메모리에서 분석했다. baseline 물리 precision226개/종료22회/거부0. 5329개 CPU 표본에서 root1304, YoungGen GC855, spreadValues474, defNormalProp153, JSI enqueue99였다. native trace의 마지막1024개 dispatch는12ms 초과가 없었고 retained256 frame의 최대 render 작업은30.82ms였다. 전체 실행 분포·화면 FPS는 아니다.
- Windows ES2015 번들이 객체 spread/rest를 JavaScript 반복 복사 helper로 낮추고 있었다. 고정된 Hermes94aa5e1d/HBC99 compiler+VM의 native CopyDataProperties를 사용하도록 Windows만 syntax 지원을 선언했다. Android/Web 정책은 유지한다. manifest의 bytecode.syntax도 검증하여 이전 생성 정책의 번들을 현재 것으로 수락하지 않는다.
- 새 `check-hermes-syntax.mjs`는 실제 Hermes VM/DLL와 compiler로 getter·symbol·own/inherited·proto·rest exclusion, 기존 클래스 field/setter/상속·mixin·Reflect.construct·내장 subclass 계약을 검증한다. 같은 연산12000회 비교는 ES2015 helper89–92ms/native spread26ms였으나 달력 FPS 개선율이 아니다. 임시 C++/HBC는 finally에서 정리한다.
- 객체 복사 최적화만의 물리 피드백은 **“조금 줄었지만 여전히 큼”**. precision545개/종료35회/거부0, 오류 없음. 6012개 표본에서 spread helper는 사라졌지만 root2582/YoungGenGC888/defNormalProp133/enqueue87, builder 재빌드가 여전히 컸다. GC 통계는 전체 runtime 기준이며 서로 다른 입력량의 실행을 단순 비율로 비교하지 않는다.
- native class/field 경로는 작은 compiler+VM 계약 검사는 통과했지만 전체 앱의 `Diagnosticable(class {})` 초기화에서 `Object is not a constructor`로 실패했다. **해당 변경은 철회하고 Babel 클래스 변환을 복원했다.** 실패 실행은 exit1/reservedBytes0/memoryTotal0/workersJoined=true. 기본 실행에 native class를 남기지 않는다.
- 반복 App 관측에서 바뀌지 않은 semantics/paragraph blob도 매번 다시 해석하는 경로를 수정 중이다. owner/view generation/node generation/type와 **정확한 바이트 일치**로 검증된 불변 값만 재사용한다. 최대4096개/원본 blob1MiB, 큰 전체 packet 보존 금지, 세션 종료 clear, 변경·잘못된 입력은 재검증한다. 회귀에서 같은 값 identity 재사용, label 변경 반영, 원본 buffer 변경 격리, 재사용 generation 분리, entry/byte 상한, 기존 App 응답/flag 검증 PASS. 최종 공급·번들 검증은 완료 후 아래에 추가한다.
- 질문 “jsi때문에 병목이 있는거야?”에 대한 현재 근거는 JSI 자체의 호출 진입보다 App 재빌드·장면 변환·관측 데이터 객체 생성/GC가 더 크다는 것이다. JSI를 지나는 데이터 복사/해석 비용까지 없다고 단정하지 않는다. **performanceAccepted=false / resizePerformanceAccepted=false**를 유지한다.
- 관측 blob 재사용 구현·공급 반영 완료. 전체 query와 App projection 모두 같은 검증된 blob을 공유한다. 실제 pinned VM에서 semantics512개×20회 해석은75ms→58ms, cache hit9728/원본 blob65536bytes였으며 동일 결과를 확인했다. 이는 작은 반복 해석 비교이며 앱 전체 성능 수락이 아니다.
- 최종 공급 **`dea64e1fb0ab7a415de1659aaf31a132f76ca2263bc8c2d73b7cee9aee001cc3`**, ABI2/schema2570296319. native/WindowsAppSDK/Wasm·Core/SDK·Windows/Web 재빌드 및 source/supply/manifest identity 일치. Windows bytecode JS SHA256=`8bd3c28e8b306a76f21036dedda434a12a2bd4415a9483547e629008cdc13081`, classes=babel, syntax={bigint:true,object-rest-spread:true}.
- 최종 native frame/precision/list/late-page-coverage/page-layout 회귀, App observation/cache/packet/flag, incremental capture/semantics/terminal, TS lint/diff PASS. Web 두 profile의 지연 precision12회 왕복·열린 달력 resize와 extended 날짜 선택/입력·기존 UI·close 모두 PASS(예약0/worker 종료). 최신 Windows 일반 CLI ready/appGeometryNodes0/rejectedFallbacks0 확인. **이 cache 변경 후 물리 트랙패드 체감은 아직 notVerified**다.

## 22. 2026-11-10 과거 월 연속 스와이프의 잉크 참조 오류

- 사용자 제공 실행 로그에서 **`Native ink reference is not mounted` / exitCode1**을 확인했다. `nativePaintBody`→SceneWriter encode/visit 중 잉크의 reference가 null이었다. document180/active177, failedDocument0, nodes1527, memoryPeak564988165/805306368, precision admitted270/rejected0/ends25였다. 이번 최초 오류는 §20의 semantics 예산 초과와 구분한다. 종료 정리는 status0/reservedBytes0/memoryTotal0/workersJoined=true였다.
- 화면 밖 page의 Source State는 보존하고 native 자식은 제외했으나, `OriginalNativeRender.paintsChild`는 여전히 true를 반환했다. Material 원본 adapter는 이 Source ancestor 정책으로 잉크 reference의 표시 여부를 판단하므로, 보존된 날짜 셀의 잉크가 제외되지 않았다. `paintsChild`가 native projection의 `parkedChildren`과 같은 표시 정책을 반환하도록 수정했다.
- 별도로 Material 잉크 설정이 정적 capture로 보관되어, 자손 page의 표시 정책이 바뀌어도 이전 paint reference가 재사용됐다. 살아 있는 잉크 feature가 있을 때만 `dependsOnChildVisibility`/`dynamicPaint`로 설정을 다시 읽는다. 모든 feature가 화면 밖인 동안에도 이 의존성은 유지하며, feature가 없는 Material은 정적 capture를 유지한다. 원본 feature를 임의 dispose하거나 encoder의 잘못된 reference 검사를 완화하지 않는다.
- 새 `check-ink-parking.mjs`에서 수정 전 **parked child의 paintsChild=true**를 재현했고, 표시 정책만 고친 중간 상태에서도 **retained ink configuration still references a parked cell**을 재현했다. 최종 수정은 live highlight 생성→page 보존/제외→native reference 해제 후 재캡처→동일 Source feature를 살려 둔 채 다시 표시→새 native generation으로 paint 복원까지 PASS. 실제 TS layout/paint는 실행하지 않는다. idle Material 정적 capture도 검사한다.
- `check-date-scroll-web.mjs --precision --burst --past-only --both`를 추가했다. 각 profile에서 과거 방향 stream24회, update/commit 지연 주입, mouse hover 및 월 제목 변경, 노드/semantics/Element/예약 상한, 열린 달력 resize, 정리를 확인한다. 첫 통합 실행은 두 profile 모두 PASS(닫을 때 reservedBytes0/workersStopped=true). 최종 활성 feature 한정 형태의 공급·번들 검증 결과는 아래에 기록한다.
- 이번 변경은 App/Source adapter 경로다. C++ 공급은 **dea64e1fb0ab7a415de1659aaf31a132f76ca2263bc8c2d73b7cee9aee001cc3 / ABI2 / schema2570296319**이며 sourceIdentity 일치를 확인했다. 실제 트랙패드 장시간 재확인과 기존 끊김의 성능 수락은 아직 별개다.
- 최종 Core/SDK/Material 및 Windows/Web 앱 재빌드 완료. Windows bytecode JS SHA256=`60eb73974e438c039e9d9e9205a81778c1bb2157f2020aba7215ec48089813d5`. 두 target의 manifest/supply identity 검증과 실제 번들의 paintsChild/dependsOnChildVisibility/dynamicPaint 반영을 확인했다. 전체 C++ 재빌드는 하지 않았다(해당 공급 소스 변경 없음).
- 최종 feature 한정 형태의 ink parking/capture/App observation 회귀와 TS lint/diff PASS. Web 두 profile의 past-only24회·resize 및 extended 날짜 선택/입력/확인/취소/재개방·기존 theme/route/image/editor·close 모두 PASS. past-only의 nodes2190–2253/Elements5474–5637/builders7로 bounded, close reservedBytes0/workersStopped=true. Windows 일반 CLI app-ready/appGeometryNodes0/rejectedFallbacks0 확인. 이 자동 증거를 물리 트랙패드·FPS 수락으로 확대하지 않는다.
- Windows 최종 일반 실행에서 Selection→Choose date의 November2026 실제 그리드/접근성 표시와 오류 출력 없음을 확인했다. 창은 사용자 과거 월 연속 트랙패드 입력을 위해 열어 두었다. §20의 화면 밖 보존 처리에 잉크 표시·capture 의존성을 연결하지 못했던 누락을 보완한 것이다.
- 사용자 물리 후속: **“이제 종료없이 계속 이동은 되는데 여전히 준비하는데 너무 오래걸림”**. 해당 입력 구간의 종료 재발 없음은 사용자 확인으로 기록한다. 월 준비 지연과 performanceAccepted=false는 유지한다. 후속 FFI/객체 공유 제안은 현재 JSI 경계의 패킷 복사와 TS 재빌드·capture 비용을 구분하여 검토하며, 전면 교체를 구현 완료로 표기하지 않는다.
