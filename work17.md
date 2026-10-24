# W17: Hermes 직접 host와 Nelyx 자체 레이아웃으로 Windows 버벅임 제거

작성일: **2026-10-25 KST** · 우선 구현 대상: **Windows x64 Release / Hermes bytecode·Static Hermes / Nelyx Core·Skia·SDK** · 기본 엔진 정책: **iOS 지원까지 고려한 Hermes 중심의 native 플랫폼 공통 방향**

> **계획 READY · 구현 NOT_STARTED · performanceAccepted=false · physicalInputAccepted=notVerified.** 이번 변경은 조사와 계획 작성이다. 새 host·RNW 포크·native 빌드·성능 검증을 실행한 것으로 해석하지 않는다. 사용자가 현재도 느끼는 버벅임은 미해결이다.

**선택한 방향은 RN의 콘텐츠 레이아웃에 의존하지 않는 Hermes 직접 host다.** Nelyx의 Widget → Element → RenderObject/Sliver → paint 구조를 유지하고, React/Fabric/Yoga를 거치던 Windows surface·입력·semantics 연결을 SDK의 native 서비스로 옮긴다. 먼저 같은 Hermes에서 최소 host의 실제 차이를 확인하고, native 그리기 명령 일괄 처리와 접근성 전달 개선을 결합한다. RNW 최소 포크는 원인 분리 또는 이전 단계의 대안이며, 필요하면 Hermes VM까지 수정한다.

**Hermes를 기본 엔진으로 두는 제품상의 이유는 iOS 플랫폼 지원까지 고려하기 때문이다.** Windows 단독 성능 순위로 엔진을 선택하기보다 iOS·Android·Windows에 이어지는 공통 runtime 방향을 유지하고 Hermes에서 버벅임을 해결한다. Hermes 선택과 RN backend 사용은 별개이며, 자체 레이아웃과 플랫폼별 native host를 통해 Hermes를 사용할 수 있는 구조를 목표로 한다. V8/JSC는 선택 가능한 비교·호환 경로로 둔다.

[W16](work16.md)의 실행 계획은 **CLOSED / SUPERSEDED BY W17**이다. 기존 구현과 실패 기록은 근거로 보존하고, 이번 문제의 현재 계획·진행 상태·잔여 작업은 이 문서 하나에서 관리한다. W14 전체 개편을 재개하지 않으며 W15A의 과거 AOT coverage와 타입 정책 결과를 신규 성능 수락으로 승격하지 않는다. W16의 G6 통과를 새 host 시제품의 선행조건으로 요구하지 않는다.

## 1. 현재 판단과 근거

### 1.1 레이아웃 책임부터 분리한다

- Nelyx 콘텐츠 레이아웃은 이미 [`root.ts`](Nelyx/src/framework/widgets/root.ts), [`framework.ts`](Nelyx/src/framework/widgets/framework.ts), [`object.ts`](Nelyx/src/framework/rendering/object.ts)의 BuildOwner·PipelineOwner·RenderObject와 각 Sliver가 수행한다. 이 부분을 Yoga로 대체하거나 두 번째 레이아웃 엔진을 만들 이유가 없다.
- 현재 Windows [`surface.tsx`](Nelyx/sdk/src/platforms/windows/surface.tsx)는 `createReactNativeSurface`를 사용한다. RN/Fabric은 Skia surface의 native 배치와 수명을, [`windows-semantics.tsx`](Nelyx/sdk/src/backends/react-native/windows-semantics.tsx)는 Core semantics를 React/native proxy 트리로 전달한다. **Nelyx의 모든 Widget이 Yoga에서 다시 layout되는 구조라고 단정하지 않는다.** 실제 중복 범위는 host/proxy 트리와 그 갱신이다.
- Yoga만 끄는 설정으로는 React render·Fabric commit/mount·CallInvoker·Node-API 어댑터·서비스 수명이 사라지지 않는다. 최종 목표는 **콘텐츠와 semantics의 프레임 경로에서 RN render/Fabric/Yoga를 제거하는 것**이다. HWND 크기·DPI·native IME caret 위치를 반영하는 플랫폼 배치는 여전히 필요하다.
- 이 제거의 구조적 타당성과 버벅임의 주원인은 별개다. Nelyx 자체 build/layout·동기 text layout·할당/GC·paint recording이 지배적이면 RN 제거 후에도 그 비용을 직접 줄여야 한다.

### 1.2 이전 시도에서 이어받을 것

아래 수치는 **W16의 이름 변경 전 기록**이다. 현재 Nelyx 실행의 측정값이 아니며, 표본 범위가 다른 결과를 합치지 않는다.

| 기록 | 의미 / 이번 결정 |
|---|---|
| W16 §8.3 full-catalog의 list cold CPU p95 중앙값: bytecode 기본/최대화 **41.985/65.653ms**, Static Hermes **29.432/43.990ms** | AOT로 낮아진 구간도 60Hz frame 예산을 넘었다. native coverage 100%만으로 해결되지 않는다. |
| 별도 고정 범위 list cold 누적 VM 할당: bytecode 기본 **약 724MB·GC 182회**, AOT 기본 **약 485MB·124회** | 누적 할당과 GC 횟수다. live heap 크기나 GC pause가 주원인이라는 증명은 아니다. |
| 계측 실행에서 semantics flush·paint recording, N-API reference/type 경로, VM property/GC 경로 관찰 | 접근성 전달과 그리기 호출 경계를 우선 검토한다. PC 관찰 빈도를 CPU 시간 비율로 사용하지 않는다. |
| W16 §8.4의 0/1/N child store, layout closure 제거, Flex 임시 컨테이너 통합 | 이미 구현된 기반이다. 다시 구현하지 않고 잔여 중복과 Hermes 효과를 확인한다. |
| viewport/DPI가 달라진 후보 비교, 입력 거리 불일치, bytecode `0xC0000005` | 비교 무효와 미해결 안정성을 승계한다. 추가 성공 실행으로 실패 이력을 지우지 않는다. |
| W16 §8.6 이름 변경 후 native 재컴파일·실행 미실시, Web runtime `requires-build` | 새 공급으로 baseline을 재확립한다. 과거 EXE/DLL/WASM의 명칭만 바꿔 신규 검증으로 사용하지 않는다. |

이미 compositor clock, native GPU worker, 최대 2개 in-flight 제출, frame/resource generation, picture 보존과 retirement가 있다. 이들을 “새로 비동기화”하는 계획을 반복하지 않는다. 반면 [`renderer.ts`](Nelyx/skia/packages/rn/src/renderer.ts)의 `GraphiteRenderer.submit → replayFrame`은 recording 생성 중 많은 개별 Skia 호출·임시 wrapper를 사용한다. GPU 제출이 비동기라는 사실이 JS recording 비용까지 없애지는 않는다.

### 1.3 이번 조사 시점의 identity

- 저장소 HEAD: `9323ceee79dadb4d07b2946fa9de3292fc69f525`. 시작 상태는 tracked 변경 없음, 빈 `work17.md`만 untracked였다. W16의 옛 HEAD를 이 저장소에서 checkout 가능한 기준선으로 가정하지 않는다.
- 개정 전 W16 SHA-256: `58c70dc05d3f1c86a0c2c01d7220290d187f5dc9225f3113314ce399188ca187`.
- 현재 코드의 Windows cohort는 RN JS **0.83.10**, native RN **0.83.4**, RNW **0.83.2**, Hermes 선언 버전 **1.0.0**, pin **`94aa5e1d40a4ce99df79d951cbe45310ec40680c`**, HBC **99**, RNW 입력 계약 **JSI21 / x64 Release / MD**다. 선언과 실제 loaded image의 일치는 W17-00에서 다시 확인한다.
- 설치된 RNW `Shared/HermesRuntimeHolder.cpp`에서 `jsr_runtime_get_node_api_env → makeNodeApiJsiRuntime`를 확인했다. 파일 SHA-256은 `129a80ecce6f8c2175329399a1a55cca4a604f2c2dbf358ef331fd3123f7ef67`다. 이는 **Node.js 프로세스로 실행한다는 뜻이 아니라 JSI 구현이 Node-API를 거친다는 뜻**이다.
- 샘플 `.nelyx/`에는 이번 확인 시 `supply/`가 있고 `windows/native-inputs.json`·`windows/static-hermes-inputs.json` locator는 없었다. 외부 toolchain 존재 여부나 기존 Release 출력의 실행 가능성을 이 사실만으로 판정하지 않는다. 설치 Core 전체 digest와 source→native 공급도 이번 문서 작업에서는 검증하지 않았다.

### 1.4 외부 소스에서 확인한 범위

2026-10-25에 확인한 원본이다. 설계 가능성을 뒷받침하며 이 앱의 성능 효과를 증명하지 않는다.

| 원본 | 계획에 반영한 내용 |
|---|---|
| [RN render/commit/mount](https://reactnative.dev/architecture/render-pipeline) | Fabric의 Shadow Tree·Yoga·mount 책임과 Nelyx 자체 layout을 구분한다. |
| [RNW 0.83.2 HermesRuntimeHolder](https://github.com/microsoft/react-native-windows/blob/react-native-windows_v0.83.2/vnext/Shared/HermesRuntimeHolder.cpp), [Node-API JSI](https://github.com/microsoft/node-api-jsi) | 현재 runtime 어댑터 경계를 확인했다. 이 경계의 제거 효과는 별도 실험 대상이다. |
| [고정 Hermes pin의 직접 API](https://github.com/microsoft/hermes-windows/blob/94aa5e1d40a4ce99df79d951cbe45310ec40680c/API/hermes/hermes.h) | `IHermesRootAPI`·`HermesRuntime`·`IHermesSHUnit`가 소스에 존재한다. 배포 DLL export·링크·CRT·JSI 호환과 Static Hermes 연결은 아직 확인 전이다. |
| [Bundled Hermes](https://reactnative.dev/architecture/bundled-hermes) | JSI ABI가 맞는 VM·host·binding을 함께 구성한다. 최신 compiler와 기존 VM을 임의 혼합하지 않는다. |
| [RN 0.84의 Hermes V1 안내](https://reactnative.dev/blog/2026/02/11/react-native-0.84) | 모바일 기본값 변경을 Windows 개선의 증거로 사용하지 않는다. 현재 Windows도 이미 1.0.0을 선언하므로 “V1을 켜면 해결”을 반복하지 않는다. |
| [Windows compositor clock/statistics](https://learn.microsoft.com/en-us/windows/win32/directcomp/compositor-clock/compositor-clock) | clock tick·GPU 완료·target별 표시 통계를 구분한다. 실제 surface와 display frame을 연결하지 못하면 `displayed=unobserved`다. |

### 1.5 기본 엔진과 플랫폼 확장 정책

- **기본 JavaScript 엔진은 Hermes다.** 이는 사용자의 iOS 포함 플랫폼 지원 방향을 반영한 제품 결정이다. Windows에서 V8/JSC가 빠른 구간이 있어도 해당 엔진으로 기본값을 바꾸는 것을 W17의 해결책으로 삼지 않는다.
- **엔진 기본값과 host 기본값을 분리한다.** Hermes 기본 엔진 계약은 W17-08에서 SDK/CLI·템플릿·일반 launcher·사용법에 반영한다. RNW host를 직접 host로 기본 전환하는 시점은 H0~H5 수락에 따른다. 이번 문서 개정은 실행 기본값을 변경한 구현이 아니다.
- **공통 runtime과 플랫폼 adapter를 나눈다.** Nelyx build/layout·자원 수명·frame/input/semantics 계약은 iOS에서도 구현할 수 있는 형태로 정의한다. HWND·Windows dispatcher·TSF/UIA·Composition 타입을 공통 계약에 노출하지 않는다. iOS의 UIKit·Metal·입력/접근성 연결은 해당 플랫폼 adapter의 책임이다.
- **Hermes bytecode와 Static Hermes의 플랫폼 수락은 별도다.** Windows의 Static Hermes loader·SHUnit·성능 성공을 iOS 지원 완료로 간주하지 않는다. iOS의 실제 VM/compiler 공급·아키텍처·링크·패키징·기기 실행은 별도 검증 대상이다.
- W17의 구현·정규 성능 matrix는 Windows 우선 범위를 유지한다. iOS에 필요한 공통 경계를 이번 구조에 반영하고, iOS 직접 host 전체 구현과 native 실행 수락은 후속 작업으로 남긴다.

## 2. 후보 검토와 선택

| 후보 | 기대하는 효과 | 남는 비용 / 난점 | 결정 |
|---|---|---|---|
| **Hermes 직접 Windows host** | RN shell·Fabric/Yoga·RN event/service 경로 제거, 직접 JSI 구성 가능 | 창·입력·TSF/IME·UIA·서비스·종료 계약을 SDK가 소유해야 함 | **주 시제품과 목표 구조** |
| **RNW + 직접 Hermes JSI 최소 포크** | RN 서비스는 유지하며 Node-API 어댑터 비용을 분리 | Fabric/proxy와 RN scheduler는 남음, upstream 갱신 비용 | 조건부 비교 또는 이행 경로 |
| RNW에서 Yoga 호출만 생략 | host/proxy layout 비용 감소 가능 | mount와 서비스 의존성은 그대로, bounds/focus를 깨뜨릴 수 있음 | 독립 해결책으로 채택하지 않음 |
| **native display-list 일괄 recording** | 개별 JSI property/method·paint/path wrapper·반복 decode 감소 | 명령 encoding/검증·native replay 비용은 남음 | 직접 host의 우선 구현; RNW에도 재사용 |
| **Core semantics → native UIA snapshot/delta** | scroll마다 React proxy 갱신·Fabric commit 감소 | UIA 가상 트리·텍스트/선택·focus·좌표 정확성 구현 필요 | 접근성을 유지하는 정식 경로 |
| 공통 Core의 증분 build/layout·snapshot·shape 개선 | 실제 cold 생성·JS 할당·GC 압박 감소 | RN 제거와 무관하게 필요할 수 있음 | W16 구현을 이어서 병목별 적용 |
| heap/GC 설정·Hermes VM/어댑터 수정 | pause·property lookup·handle 비용 개선 가능 | 메모리 증가·ABI·정확성·유지보수 위험 | pause/CPU 근거가 있는 경로만 수정 |
| 새 Hermes revision / RNW 업그레이드 | upstream의 관련 수정 수용 가능 | 이미 V1 계열 선언, 공급 전체 변경으로 원인 혼합 가능 | 관련 fix 확인 후 독립 비교 |
| native 독립 스크롤·보존된 tile 이동 | JS 지연 중에도 확보된 영역의 이동 가능 | 새 영역 생성·hit test·physics·IME/UIA 동기화가 어려움 | 후반 조건부 실험; 전체 해결 대체 불가 |
| cache 확대·샘플 분할·접근성 off·V8 전환 | 특정 장면 수치 개선 가능 | 최초 생성/실제 기능 문제를 남김 | 진단 외 주 해결책으로 사용하지 않음 |
| worklet/두 번째 VM·전체 layout C++ 재작성 | 일부 연산을 별도 실행 가능 | 동일 State/JS 객체 공유 불가, 이중 수명·직렬화·대규모 의미 변경 | 초기 범위 제외; 순수 kernel만 후속 검토 |

**착수 순서:** 최소 직접 host의 실행 가능성과 차이를 먼저 확인 → RN 없는 SDK 서비스 완성 → paint/semantics 경계 축소 → 남은 Core/VM 비용 개선 → 실제 표시 수락. 모든 후보를 먼저 만들거나 전체 matrix를 반복하지 않는다. RNW 포크에 오래 매달리기 전에 RN이 없는 경로의 비용을 직접 확인한다.

## 3. 목표 구조와 제거할 의존성

```text
Windows HWND / native UI thread
  ├─ size·DPI·visibility·pointer·keyboard·TSF/IME·UIA
  ├─ compositor clock / native Composition surface
  └─ bounded packets + owner/generation
                 ↕
Dedicated Hermes runtime thread (VM 1개, 소유 thread 1개)
  Nelyx SDK bootstrap / timers·microtasks·platform services
    → Nelyx Widget·State·Element
    → RenderObject·Sliver / 자체 layout·hit test·scroll physics
    → paint commands + text requests + semantics delta
                 ↓
  native Skia recording → 기존 native GPU worker → surface / compositor
```

### 3.1 RN을 없애고도 유지할 계약

- [`bootstrapApplication`](Nelyx/sdk/src/runtime/bootstrap.ts), AppSession·View·BackendServices·자원 lease를 composition 경계로 유지한다. 샘플이 직접 DLL·GPU·VM을 조립하지 않는다.
- native host가 root의 logical/physical size·DPI·환경 revision만 제공하고 콘텐츠 크기·배치는 Nelyx가 계산한다. Core tree를 React/Fabric tree로 복제하지 않는다. UIA는 **이미 계산된 semantics geometry**를 소비한다.
- HWND·Composition·입력 서비스는 UI thread, Hermes와 모든 JSI handle은 runtime thread, GPU worker는 native recording/fence만 소유한다. 동일 runtime을 여러 thread에서 동시에 호출하거나 JSI value를 worker에 넘기지 않는다.
- 기존 Windows/Skia 코드의 RN-neutral 부분을 추출하고 RNW adapter와 직접 host adapter를 나눈다. `ReactContext`·RN dispatcher·Composition context에 묶인 코드는 그대로 재사용 가능하다고 가정하지 않는다. 특히 `WindowsAppHost`, `RuntimeServices`, `SkiaView`, input island, semantics provider의 결합을 먼저 분류한다.
- 새 native host의 경로 예시는 `Nelyx/sdk/native/windows-hermes/`, SDK adapter 예시는 `Nelyx/sdk/src/backends/native-hermes/`다. **제안 경로이며 아직 생성하지 않았다.** 공통 Skia 코드가 계속 `rn` 패키지의 내부 런타임에 의존하면 명시적인 공통 native 계층으로 추출한다.
- 공통 Hermes runtime·서비스 계약과 Windows host 구현을 구분한다. 이후 iOS host가 같은 Core·SDK 계약을 구현할 수 있도록 Windows 전용 native handle·dispatcher·표시 API를 adapter 내부에 둔다.

### 3.2 runtime·번들·플랫폼 서비스

- 첫 시제품은 현재 pin의 optimized HBC로 시작하고, 곧 같은 host에 Static Hermes unit을 연결한다. Hermes bytecode와 Static Hermes의 성능·안정성을 각각 수락한다. 한 모드의 성공으로 다른 모드를 대체하지 않는다.
- 직접 Hermes API를 사용하려면 실제 export·link target·JSI header/구현·heap layout·CRT·EH/RTTI·toolchain을 함께 확인한다. 현재 DLL이 API를 제공하지 않으면 같은 pin/config로 직접 API 공급을 빌드한다. 그 경우 **동일 소스 pin이더라도 바이너리 hash가 달라진 비교**임을 기록한다.
- Static Hermes는 같은 VM에 SHUnit을 등록하고 기존 coverage/type-policy/fallback audit를 유지한다. RNW PAL·Node-API entry를 떼어내는 것은 새로운 loader 작업이다. 기존 C ABI runtime을 임의 cast하거나 두 번째 runtime을 만들어 unit/객체를 공유하지 않는다.
- 최종 Metro graph에서 실제 사용하는 timers·microtask·performance/단조시계·console/error·encoding·URL·assets·image/font·platform messages 등의 의존성을 조사하고 필요한 구현을 공급한다. RN을 지운 뒤 같은 기능을 거대한 호환 shim으로 다시 끌어오지 않는다. Metro는 빌드 도구로 계속 사용할 수 있으며 그 자체가 runtime의 RN 의존성을 뜻하지 않는다.
- task 뒤 microtask checkpoint, Promise rejection, timer 취소, hide/resume, request/cancel frame, fatal error와 close 순서를 명시한다. 기존 RN의 event loop를 제거해도 이 계약을 생략할 수 없다.

### 3.3 RN 없는 입력·편집·접근성

- wheel/precision pan·contact/관성/cancel·pointer capture·keyboard를 native packet으로 전달한다. Nelyx hit test·gesture·scroll physics를 유지하며, View 소유권·입력 sequence·원래 timestamp를 보존한다.
- 합칠 수 있는 연속 입력만 batch로 운반한다. modifier/target/generation·방향 반전·gesture 경계가 다른 입력은 합치지 않는다. clamp/overscroll·velocity가 비선형이면 단순 delta 합으로 대체하지 않고 원래 샘플을 처리한다. down/up/cancel·key·IME 명령을 버리지 않는다.
- native TSF/IME 서비스는 editor binding·selection/composing revision·caret rect·screen transform을 소유한다. Core 편집 상태가 기준이며 focus·한글 조합·selection·clipboard·undo/redo·텍스트 액션을 보존한다. resize/DPI/scroll 때 caret와 후보 창 geometry도 갱신한다.
- UIA는 stable semantics ID와 native immutable snapshot/delta로 가상 트리를 제공한다. Core가 계산한 bounds·clip·transform·scroll·text range·focus를 반영하고 UIA action은 owner/revision 검증 후 Core로 되돌린다. UIA query가 JS 응답을 동기 대기하여 UI thread를 막지 않게 한다.
- 접근성 off는 진단 대조에만 쓴다. UIA/IME가 빠진 minimal host는 **렌더링 시제품**이며 제품 대체 수락을 받을 수 없다.

### 3.4 native recording과 증분 갱신

- `replayFrame`의 명령·paint/path·text/image/picture resource를 versioned packet과 native handle table로 전달해 native 쪽에서 한 번 검증하고 recording한다. JS에서 native method를 명령마다 찾고 호출하는 비용과 전체 packet property decode 비용을 함께 측정한다.
- 첫 구현은 지원하는 명령 집합을 명시한 작은 fixture다. 이후 clip/saveLayer/backdrop/filter/shader/paragraph/image/path·transform 순서와 기존 failure/retirement 의미까지 parity를 채운다. 누락 명령을 조용히 빼거나 일반 JS replay로 돌아가 성능 성공으로 보고하지 않는다.
- packet은 제출 뒤 mutation과 buffer 재사용의 영향을 받지 않는 소유 snapshot이어야 한다. copy·encode bytes와 native recording 비용도 기록하며 검증 없이 zero-copy라고 부르지 않는다. 자원은 generation 있는 handle을 사용하고 실제 GPU retirement까지 lease를 유지한다.
- 기존 picture cache와 retained layer를 활용하고 바뀌지 않은 subtree·paint/style/text descriptor의 재전달을 줄인다. cache key·invalidation·capacity·환경 revision을 유지하며 전체 frame 재직렬화와 자원 상시 pin으로 대체하지 않는다.
- text layout은 Nelyx layout에 필요한 동기 결과다. paragraph/font key 재사용과 요청 묶음·native 객체 소유권을 개선하되 임의 비동기 layout으로 바꿔 constraints/anchor를 깨뜨리지 않는다.

### 3.5 frame·Core·GC

- 기존 compositor tick→dispatch·GPU worker를 재사용한다. 입력 수만큼 frame task를 쌓지 않고 필요한 wakeup을 제한한다. queue depth·oldest age를 기록하고, 필수 입력·frame·IME·close가 오래된 optional 작업에 밀리지 않게 한다.
- Hermes는 긴 JS callback을 자동으로 중간 중단하지 않는다. safe boundary가 있는 optional 준비/retirement만 나누고 필수 layout 수렴이나 arbitrary Widget build를 임의 중단하지 않는다. 관측한 deadline이 없으면 optional 준비는 비활성으로 둔다.
- W16의 child store/layout/Flex 변경 위에서 render sync·inherited index 복사·text/style/font snapshot·paint freeze·semantics geometry의 실제 잔여 중복을 줄인다. 사용자 getter/iterator·Key/GlobalKey·State·ParentData·예외 rollback 의미를 보존한다.
- GC는 누적 allocation, young/full collection, pause, live/retained heap, native working set을 분리한다. 고정 shape·내부 immutable 재사용·짧은 wrapper 수명부터 개선한다. unbounded pool·GC 중지·강제 GC로 문제를 미루지 않는다. heap tuning은 pause와 메모리의 같은 조건 비교가 있을 때만 채택한다.

## 4. RNW·Hermes 포크의 구체적 범위

**우선은 RN 전체를 장기 유지하는 포크보다 필요한 host/서비스를 추출한 직접 host를 만든다.** 기존 RNW 0.83.2는 비교 경로로 남기고, 다음 최소 실험 중 원인 분리에 필요한 것만 실행한다.

| 구성 | host | JSI 경계 | 용도 |
|---|---|---|---|
| A | 기존 RNW | 기존 Node-API JSI | 새 Nelyx 공급의 baseline |
| B | RNW 최소 포크 | 직접 Hermes JSI | A 대비 어댑터 영향 분리; 조건부 |
| C | RN 없는 최소 host | 기존 Node-API JSI | D의 직접 API 연결이 막힐 때 host 영향 분리; 조건부 |
| D | RN 없는 최소 host | 직접 Hermes JSI | **우선 구현·최종 목표** |

A와 D의 차이는 여러 구조 변경의 합이다. 이 비교만으로 Yoga 또는 Node-API가 몇 % 원인이었다고 주장하지 않는다. B/C를 모두 제품 수준으로 먼저 구현할 필요는 없다.

- **RNW 후보 owner:** `Shared/HermesRuntimeHolder.cpp`, 실제 빌드에 포함되는 `NodeApiJsiRuntime.cpp`, CallInvoker/runtime executor/event beat, surface/semantics 연결. 설치본에는 RNW 소스와 `.node-api-jsi` 소스가 함께 있으므로 vcxproj/실제 compile input으로 어느 구현이 링크되는지 먼저 확인한다. 버전 이름만 보고 다른 복사본을 패치하지 않는다.
- **어댑터 개선 후보:** 반복 type 판별·reference/handle 생성·property name/host function 조회·string 변환. runtime/generation 별 수명을 지키고 dynamic getter/Proxy·receiver·예외·GC root 의미를 유지한다. 이미 있는 cache/stack view와 겹치는 최적화는 제외한다.
- **VM 후보:** 같은 workload에서 pause 또는 property/descriptor/WeakMap 경로가 지배적인 것으로 확인될 때만 관련 source를 줄인다. upstream 관련 fix가 있으면 backport와 새 pin을 분리 비교한다. VM 변경 시 HBC compiler·AOT compiler/unit·JSI·binding 공급을 함께 다시 qualify한다.
- fork 실험은 stock/source pin·patch·build flags·input/output identity를 재현할 수 있는 tracked source/patch로 관리한다. `node_modules`를 수동 수정한 상태를 공급 계약으로 사용하지 않는다. 기존 [`private-unload`](Nelyx/upstream/react-native-windows-private-unload.json)는 **adopted=false**이며 성능 포크와 별개다. 이번 작업을 근거로 자동 채택하지 않는다.
- native 독립 스크롤은 D와 Core 개선 후에도 표시 지연이 남을 때만 검토한다. 이미 준비된 영역·유효 transform 안에서만 허용하고 tile coverage 밖으로 나가기 전 동기화·anchor·hit test·IME/UIA를 맞춘다. 빈 영역·과거 콘텐츠·최종 offset 불일치는 실패다. “100ms JS stall 중 화면만 이동”은 신규 행 생성까지 해결한 증거가 아니다.

## 5. 실행 작업과 완료 조건

| ID | 구현 범위 | 완료 조건 |
|---|---|---|
| **W17-00 현재 공급·실패 기준선 고정** | source/dist/설치·native input locator·실제 loaded VM/host/HBC/AOT·toolchain 확인. 모니터/DPI/실제 viewport·접근성·전체 catalog·입력 정책 고정. AV/입력 거리·종료 실패를 작은 재현으로 분리 | 현재 Nelyx로 실행 가능한 baseline과 unresolved 목록 확보. 옛 수치를 신규 baseline으로 사용하지 않음 |
| **W17-01 RN 없는 Hermes vertical slice** | HWND+전용 Hermes thread+직접 API+Skia surface, 최소 SDK bootstrap, 동일 고정 ListView·한국어 font, HBC 우선/Static Hermes 연결 | RN/Fabric/Yoga 없는 실제 새 frame·scroll·resize·close 확인. 두 Hermes 모드 로더·thread/자원 소유권 확인. rendering-only 한계 표시 |
| **W17-02 host 서비스와 공통 native 경계** | runtime event loop·timers/microtasks·환경·assets/font/image·platform service 계약. 기존 RNW 결합에서 공통 native 계층 추출. iOS에서도 구현 가능한 공통 계약과 Windows adapter 분리 | 최종 graph/링크/loaded modules에서 RN runtime 의존성 없음. 공통 계약에 Windows 전용 타입 없음. 생성 실패·숨김/복귀·shutdown 정리 확인 |
| **W17-03 native display-list 경로** | versioned bounded packet·handle table·native recording·retained resource, 기존 paint 명령 parity | 실제 사용 명령의 출력·오류·자원 수명 동등. encode/validation/replay/전체 frame 비용 구분. 숨은 fallback 없음 |
| **W17-04 입력과 frame scheduling** | native input batch·oldest/latest timestamp·compositor clock·bounded wakeup·backpressure | 거리/순서/velocity·capture/cancel·precision·wheel·reverse 보존. 임의 JS preemption 없이 queue 지연 감소 |
| **W17-05 TSF/IME·UIA 정식 경로** | RN proxy 없이 native editor endpoint·Core semantics delta·UIA virtual tree·native action·좌표 변환 | 한글 조합/selection/caret·Tab/focus·screen reader·text/action 기능 유지. accessibility on에서 정상 동작 |
| **W17-06 남은 공통 Core 비용 축소** | owner별 증분 sync·생성/할당·text/semantics·paint snapshot을 한 변경씩 개선 | 기존 State/Key/layout/편집/자원 회귀 통과. Hermes 각 모드에서 해당 비용과 전체 frame 효과를 대응 |
| **W17-07 조건부 RNW/VM 개선** | §4 B/C 비교, 필요한 RNW/Node-API/VM patch 또는 관련 upstream fix | 개선 근거·유지 비용·ABI·rollback 명시. 불필요하면 `SKIPPED / 근거`로 닫음. 필수 기능/성능 실패를 SKIPPED로 덮지 않음 |
| **W17-08 제품 공급·실제 Testbed 전환** | SDK/CLI·템플릿·일반 launcher의 Hermes 기본 엔진 계약, 명시적 host 선택과 새 entry, 전체 gallery 소비, 두 Release 앱·설치/실행·기존 host 회귀 | 사용자는 기존 Nelyx 앱 API로 실행 가능. 엔진/host 옵션과 iOS 포함 선택 근거 문서화. 직접 host 기본 전환은 최종 수락 후 |
| **W17-09 최종 성능·물리 수락과 정리** | §6 부하·§7 gate, 최신 결과·잔여 작업·사용법 갱신 | 두 모드의 결과와 실제 표시·입력·안정성·자원 수락. 실패 시 PARTIAL과 다음 owner 기록 |

**의존 순서:** 00 → 01 → 02 → 03/04 → 05/06 → 08 → 09. 07은 관찰된 병목에 따라 삽입한다. 먼저 layout 엔진을 다시 쓰거나 full-gallery AOT를 매번 재컴파일하지 않는다. 시제품 비교에서 효과가 작아도 측정된 Core/recording 병목으로 이어가며, RN 제거만으로 버벅임이 없어졌다고 결론내리지 않는다.

## 6. 제한된 검증과 측정

### 6.1 같은 부하와 증거 범위

- 기본 고정 행 **80px/1,000행 ListView**, 현재 Material **29개**·Cupertino **20개** 전체 catalog를 유지한다. 수량은 현재 소스에서 다시 확인한다. 두 열·forward/reverse·cold entry·retained·보존 범위 밖 revisit·fast·끝 경계를 포함한다. 첫 화면에 이미 생성된 항목과 새 노출 항목을 구분한다.
- layout 분리 비교에서는 sample tree·row 구성·font/text scale·cache 상한·보존/자동 준비 off를 고정한다. host API adapter만 바꾸고 같은 Core와 gallery를 사용한다. host 효과와 이후 Core/paint/semantics 변경 효과를 나누어 보고한다.
- Windows x64 optimized Release, 같은 모니터·실제 viewport·DPI·refresh rate·GPU·접근성 on·속도·입력 간격으로 비교한다. 모드마다 새 process를 쓰고 baseline/후보 순서를 교차한다. 서로 다른 VM/host compile config는 비교 표에 노출한다.
- native 수신 sequence·부호/절대 delta·dispatch·offset·section 노출·frame 연결을 검증한다. 이벤트 수가 합쳐져도 원래 입력량/방향/경계를 보존해야 한다. 거리 불일치·foreground 상실·누락·중복·시나리오 미완료는 성능 표본에서 제외하고 실패 원인을 남긴다.
- CPU는 build/layout/text/semantics/paint encode/native recording·queue wait·GPU/surface를 구분하고 inclusive/self time을 혼합하지 않는다. GC는 pause와 누적 allocation을 분리한다. PC sampling은 별도 진단이며 정규 frame 수치와 합치지 않는다.
- 실제 display는 surface/frame ID·owner/generation을 compositor target/ETW 등과 대응시킨다. API 통계만 있고 해당 콘텐츠의 표시를 연결하지 못하면 표시 성공으로 판정하지 않는다. 사람의 precision·관성·재접촉·반전과 실제 표시 검증도 두 모드에서 수행한다.

### 6.2 실행 수·기존 검사·정리

- 후보 선별은 작은 fixture의 단회 진단부터 진행한다. 기본 native 성능 실행 예산은 **정규 전후 비교 24회 + 필요한 후보/원인 진단 최대 6회 = 30회 이내**다. 정규 단위는 각 측 **2모드 × 2창 × 3회 = 12회**다. 실패 원인이나 새 변경이 없으면 반복하지 않는다. 단회 결과로 p99/개선율을 수락하지 않는다.
- 모든 검사는 저장소 지침대로 **20분 timeout**을 둔다. 기존 `npm.cmd run test:scroll-engine`과 변경에 해당하는 paint replay·frame clock/backpressure·layout/편집·Windows input/semantics·loader/supply 검사를 선택한다. 문서만 바꾼 이번 작업에는 이 검사들을 실행하지 않는다.
- 기존 `node Nelyx/eng/tests/run-windows-scroll.mjs matrix 3`는 **현재 RNW 경로**다. 직접 host의 옵션·launcher는 아직 없다. W17에서 host 선택과 실제 viewport/input 검증을 확장한 뒤 같은 workload로 비교한다. 존재하지 않는 신규 실행 명령을 사용법으로 제시하지 않는다.
- OS 입력 측정은 준비 완료 후 데스크톱 입력을 함께 조작하지 않는 구간을 확보하고 실행한다. 측정 중 다른 build/test·대량 trace 출력을 실행하지 않는다. 물리 조작이 필요한 검증은 자동화 결과와 별도다.
- V8/JSC와 Android RN/Hermes는 공통 변경의 기능·수명 smoke 대상이다. Web은 새 이름의 runtime source build/공급이 필요한 현재 선행조건을 먼저 해결해야 한다. Windows 직접 host의 성공을 다른 플랫폼이나 Web 수락으로 확대하지 않는다.
- 현재 dist와 사용 중 공급만 유지한다. 실험 process/temp/entry/staging은 성공·실패·중단 모두 `finally`에서 정리한다. 기존 외부/사용자 산출물은 건드리지 않는다. 전체 SDK/cache를 매번 복제하거나 log·receipt·checkpoint/history JSON·옛 archive를 누적하지 않는다. 지속 기록은 이 문서의 짧은 현재 상태와 필요한 source/공급 manifest, 제품 안내는 기존 README에 둔다. `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`는 만들지 않는다.

## 7. 수락 기준과 전환 결정

`B = 1000 / 실제 refresh Hz` ms다. 목표는 합산 평균 FPS보다 **입력에 대응한 새 콘텐츠의 최장 정지와 지연을 없애는 것**이다. 아래는 새 수락 계약이며 현재 달성 결과가 아니다.

| Gate | 필수 조건 |
|---|---|
| **H0 Hermes/host 독립성** | 두 모드 모두 실제 Hermes 실행과 직접 Hermes JSI 경로 확인. 목표 D의 runtime graph·링크/loaded module·call path에 React renderer/Fabric/Yoga/RNW 서비스·Node-API JSI 어댑터 의존성 없음. Nelyx 자체 layout 유지. Static Hermes loader/coverage/type policy·숨은 bytecode/JS fallback 0 유지 |
| **H1 기능·입력 정확성** | 전체 catalog·State/Key/GlobalKey·layout/RTL/resize·focus·한글 IME/selection·UIA/action·input 거리/순서·scroll physics 일치. 접근성 on 유지 |
| **H2 frame·입력 지연** | 각 모드·각 창·각 화면의 cold/revisit/retained/fast에서 CPU p95≤0.75B, p99≤B, max<50ms. oldest input→matching surface p95≤2B, max<50ms. baseline 대비 개선율과 표본 수도 보고 |
| **H3 실제 표시** | 지속 이동 중 matching content 표시 간격 p95≤1.25B, p99≤2B, **50ms 이상 새 화면 정지 0회**, 1.5B 초과 간격 연속 3회 0회. oldest input→display p95≤3B/max<100ms. precision contact/관성/재접촉·반전·wheel fallback 실제 확인 |
| **H4 안정성·자원·종료** | 대상 경로의 알려진 AV·입력/종료 실패 해결. 원인 미확정 실패가 남으면 미수락이며 대체 host의 성공으로 기존 RNW 실패를 해결 처리하지 않음. 반복 cold/revisit 자원은 정한 상한 내 plateau. close는 admission 중단→작업/GPU drain→JS handle/VM 파괴→창/서비스 해제의 실제 의존 순서 보장, stale callback/미반환 owner 0, 정상 exit 0 |
| **H5 공급·회귀** | source→dist→설치→bundle/HBC/AOT→EXE/DLL loaded identity 일치. 두 실제 Testbed 앱 정상 실행·응답·종료. 공통 코드 변경의 기존 host/플랫폼 회귀와 사용법 갱신 |

60Hz H2는 CPU p95≤12.5ms/p99≤16.67ms다. 120Hz는 p95≤6.25ms/p99≤8.33ms를 별도 충족해야 한다. 적은 표본의 p99는 max에 가까울 수 있으므로 frame 수·분포·최악 사례를 함께 쓴다. 상대 20%/50% 개선이나 한 모드의 평균값으로 절대 frame/표시 실패를 상쇄하지 않는다.

**W16 G6 처리:** 일반 ListView를 보존 off로 개선해야 한다는 취지는 H2의 cold/항목 단가 비교로 승계한다. 기존 “두 모드 cold 20% 선행 수락 뒤에만 다음 구조 작업” 순서는 종료한다. 직접 host·native recording 시제품은 그 gate 전에 만들 수 있다. 샘플 구성 변경으로 수치를 낮춘 경우 엔진/host 개선과 분리하며, 기본 host 전환은 H0~H5를 충족한 뒤 한다.

모드별 `hostIndependenceAccepted / engineAccepted / performanceAccepted / physicalInputAccepted`를 별도로 기록한다. rendering-only PASS·AOT coverage PASS·CPU PASS·사람의 표시 PASS를 구분한다. 미관측 항목은 `notVerified`, 기능 또는 성능 실패가 남으면 전체 문제는 `PARTIAL`이다. native 포크/host 구현이 끝나도 실제 버벅임 수락이 미달이면 해결 완료로 표시하지 않는다.

## 8. 현재 상태와 다음 시작점

| 항목 | 2026-10-25 상태 |
|---|---|
| 이번 조사·후보 검토·계획 작성 | COMPLETE / 문서 범위 |
| 현재 활성 실행 계획 | **W17 READY** / W16 CLOSED / SUPERSEDED |
| 기본 엔진 결정 | **Hermes** / iOS 포함 플랫폼 지원을 고려한 제품 방향. 실제 기본값 적용은 W17-08에서 구현 |
| W17-00~09 구현 | **NOT_STARTED** / 조건부 W17-07은 아직 판단 전 |
| RN 없는 직접 host·RNW/VM 신규 포크 | 미구현 |
| 신규 baseline·성능·실제 display·물리 입력 | 미실행 / `performanceAccepted=false`, 나머지 `notVerified` |
| 사용자 버벅임 문제 | **미해결 / PARTIAL** |

**다음 시작점:** W17-00에서 이름 변경 후 공급과 unresolved AV/입력 상태를 고정하고, W17-01의 **같은 Nelyx ListView를 실행하는 RN 없는 Hermes host**를 만든다. 그 결과로 host/어댑터 비용과 Core 비용을 구분한 뒤 W17-02~06을 이어간다. 기존 W16 matrix 반복이나 Yoga만 생략하는 수정부터 재개하지 않는다.
