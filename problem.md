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

검토 시작 시 `problem.md`는 **0 bytes**였다. 이 문서는 현재 소스를 다시 검토해 작성한 문서이며, [work9-c.md](work9-c.md)의 §3.1.4–3.1.6이 참조하는 과거 `problem.md` §8–10 원문을 복원한 것은 아니다. 과거 실행 결과는 `work9-c.md`에 남은 기록으로만 취급한다.

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

이 문서는 구현 계획이다. 이번 요청에서는 아래 엔진 변경을 수행하지 않았다. [work9-c.md](work9-c.md)의 현재 소유권·API 계약을 유지한 W9C-00 성능 수정 묶음으로 진행하는 것이 적절하다.

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
