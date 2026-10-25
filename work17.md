# W17: Hermes 직접 host와 Nelyx 자체 레이아웃으로 Windows 버벅임 제거

작성일: **2026-10-25 KST** · 우선 구현 대상: **Windows x64 Release / Hermes bytecode·Static Hermes / Nelyx Core·Skia·SDK** · 기본 엔진 정책: **iOS 지원까지 고려한 Hermes 중심의 native 플랫폼 공통 방향**

> **구현 PAUSED · 전체 PARTIAL · performanceAccepted=false · physicalInputAccepted=notVerified.** 2026-10-25 17:10 KST 사용자 중간 마무리 요청으로 구현과 추가 native 측정을 멈췄다. 시작 HEAD ee82b364efbb48e7821f006f2e1ed3750f4b3f95와 원래 수락 범위를 유지하며, 재개 위치·현재 증거·잔여 작업은 §8에 정리했다.

**선택한 방향은 RN의 콘텐츠 레이아웃에 의존하지 않는 Hermes 직접 host다.** Nelyx의 Widget → Element → RenderObject/Sliver → paint 구조를 유지하고, React/Fabric/Yoga를 거치던 Windows surface·입력·semantics 연결을 SDK의 native 서비스로 옮긴다. 먼저 같은 Hermes에서 최소 host의 실제 차이를 확인하고, native 그리기 명령 일괄 처리와 접근성 전달 개선을 결합한다. RNW 최소 포크는 원인 분리 또는 이전 단계의 대안이며, 필요하면 Hermes VM까지 수정한다.

**Hermes를 기본 엔진으로 두는 제품상의 이유는 iOS 플랫폼 지원까지 고려하기 때문이다.** Windows 단독 성능 순위로 엔진을 선택하기보다 iOS·Android·Windows에 이어지는 공통 runtime 방향을 유지하고 Hermes에서 버벅임을 해결한다. Hermes 선택과 RN backend 사용은 별개이며, 자체 레이아웃과 플랫폼별 native host를 통해 Hermes를 사용할 수 있는 구조를 목표로 한다. V8/JSC는 선택 가능한 비교·호환 경로로 둔다.

[W16](work16.md)의 실행 계획은 **CLOSED / SUPERSEDED BY W17**이다. 기존 구현과 실패 기록은 근거로 보존하고, 이번 문제의 현재 계획·진행 상태·잔여 작업은 이 문서 하나에서 관리한다. W14 전체 개편을 재개하지 않으며 W15A의 과거 AOT coverage와 타입 정책 결과를 신규 성능 수락으로 승격하지 않는다. W16의 G6 통과를 새 host 시제품의 선행조건으로 요구하지 않는다.

**W17 구현은 기준선 불일치 수정까지 포함한다.** 작업 중 기존 코드·공급·도구·샘플·문서가 아래 W17 기준선과 맞지 않으면 해당 경로를 고치면서 진행한다. 새 host만 추가한 뒤 기존 불일치를 그대로 두거나, 작업 표에 개별 파일이 없다는 이유로 필요한 수정을 후속 작업으로 넘기지 않는다. 적용 범위와 완료 조건은 §5.1을 따른다.

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

### 1.3 계획 작성 시점의 identity

- 계획 작성 때의 HEAD는 `9323ceee79dadb4d07b2946fa9de3292fc69f525`였고 빈 `work17.md`만 untracked였다. **구현 실행 시작 HEAD는 `ee82b364efbb48e7821f006f2e1ed3750f4b3f95`이며 시작 dirty 없음**이다. W16의 옛 HEAD를 이 저장소에서 checkout 가능한 기준선으로 가정하지 않는다.
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
- **엔진 기본값과 host 기본값을 분리한다.** Hermes 기본 엔진 계약은 W17-08에서 SDK/CLI·템플릿·일반 launcher·사용법에 반영한다. RNW host를 직접 host로 기본 전환하는 시점은 H0~H5 수락에 따른다. 현재 Windows Release 기본 엔진/profile은 Hermes/optimized이며 기본 host는 RNW다.
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
- 새 native host는 `Nelyx/sdk/native/windows-hermes/`, SDK adapter는 `Nelyx/sdk/src/backends/native-hermes/`에 구현했다. 공통 native scheduler·입력 batch는 `Nelyx/skia/native/host/`에 두며 기존 Skia native 소스를 RN/직접 host 양쪽에서 컴파일한다. RN renderer/runtime import는 직접 host graph에서 거절한다.
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

### 5.1 W17 기준선 점검·수정을 모든 단계에 적용

여기서 **W17 기준선은 목표 구조·제품 계약**이고, W17-00의 **성능 비교 baseline은 현재 실행의 측정 기준**이다. 불일치를 수정해도 수정 전 비교 조건·실패 사실을 새 결과로 덮어쓰지 않는다.

- **점검 기준:** Hermes 기본 엔진과 bytecode·Static Hermes의 독립 수락, Nelyx 자체 build/layout·hit test·scroll physics, 목표 D의 RN/Fabric/Yoga·Node-API JSI 비의존 경로, iOS에서도 구현 가능한 공통 계약과 Windows adapter 분리, 입력·IME·UIA·자원/종료 계약, source→공급→실제 실행의 일치를 기준으로 삼는다. 세부 계약은 §1.5·§3·§7을 적용한다.
- **점검 범위:** 작업 대상과 연결된 Core·Skia·SDK/native host·공급 manifest·build/CLI·템플릿/launcher·두 Testbed·검증 도구·README를 함께 확인한다. 이전 기본값·RN 전제·중복 경로·누락 서비스·잘못된 공급/실행 옵션 등 기준선에 맞지 않는 부분은 실제 호출·의존 경로를 확인하고 해당 단계에서 함께 수정한다. 구조·정확성·공급 계약 위반의 수정은 성능 병목 입증을 선행조건으로 삼지 않는다.
- **단계별 처리:** W17-00에서 현재 불일치와 수정할 단계/owner를 정하고, W17-01~08에서도 단계 시작과 완료 전에 다시 확인한다. 새로 발견한 불일치도 현재 단계 또는 의존하는 후속 단계의 필수 작업으로 편입한다. 해당 단계의 완료 조건을 깨는 불일치는 수정·관련 회귀 확인 전까지 그 단계를 완료 처리하지 않는다.
- **진행과 기록:** 독립 작업은 계속 진행하되 해결하지 못한 항목은 이 문서의 짧은 현재 상태에 `불일치 / 영향 경로 / 수정 단계·owner / 상태·검증 결과`로 남긴다. 이전부터 있었다는 이유만으로 제외하거나, 문구·상태값만 바꿔 일치한 것으로 처리하지 않는다. 최종 수락에 필요한 미해결 항목이 있으면 전체는 `PARTIAL`이다.
- **전환 순서와 범위:** 기존 RNW 비교 경로와 명시적 V8/JSC 선택은 유지하고 목표 D에 W17 계약을 적용한다. Hermes 기본 엔진 반영은 W17-08, 직접 host 기본 전환은 H0~H5 수락 후라는 순서를 지킨다. 관련 없는 전면 재작성이나 iOS host 전체 구현으로 범위를 넓히지 않으며, 새 경로의 성공으로 기존 경로의 실패를 해결 처리하지 않는다.

### 5.2 실행 작업

| ID | 구현 범위 | 완료 조건 |
|---|---|---|
| **W17-00 현재 공급·실패 기준선 고정과 불일치 점검** | source/dist/설치·native input locator·실제 loaded VM/host/HBC/AOT·toolchain 확인. 모니터/DPI/실제 viewport·접근성·전체 catalog·입력 정책 고정. AV/입력 거리·종료 실패를 작은 재현으로 분리. §5.1 기준선 불일치와 수정 단계/owner 확인, 기준선 실행을 막는 문제 수정 | 현재 Nelyx로 실행 가능한 baseline과 unresolved 목록, 각 불일치의 수정 단계 확보. 기준선 확보 전 수정은 변경 내용·공급 identity를 구분하고 옛 수치를 신규 baseline으로 사용하지 않음 |
| **W17-01 RN 없는 Hermes vertical slice** | HWND+전용 Hermes thread+직접 API+Skia surface, 최소 SDK bootstrap, 동일 고정 ListView·한국어 font, HBC 우선/Static Hermes 연결 | RN/Fabric/Yoga 없는 실제 새 frame·scroll·resize·close 확인. 두 Hermes 모드 로더·thread/자원 소유권 확인. rendering-only 한계 표시 |
| **W17-02 host 서비스와 공통 native 경계** | runtime event loop·timers/microtasks·환경·assets/font/image·platform service 계약. 기존 RNW 결합에서 공통 native 계층 추출. iOS에서도 구현 가능한 공통 계약과 Windows adapter 분리 | 최종 graph/링크/loaded modules에서 RN runtime 의존성 없음. 공통 계약에 Windows 전용 타입 없음. 생성 실패·숨김/복귀·shutdown 정리 확인 |
| **W17-03 native display-list 경로** | versioned bounded packet·handle table·native recording·retained resource, 기존 paint 명령 parity | 실제 사용 명령의 출력·오류·자원 수명 동등. encode/validation/replay/전체 frame 비용 구분. 숨은 fallback 없음 |
| **W17-04 입력과 frame scheduling** | native input batch·oldest/latest timestamp·compositor clock·bounded wakeup·backpressure | 거리/순서/velocity·capture/cancel·precision·wheel·reverse 보존. 임의 JS preemption 없이 queue 지연 감소 |
| **W17-05 TSF/IME·UIA 정식 경로** | RN proxy 없이 native editor endpoint·Core semantics delta·UIA virtual tree·native action·좌표 변환 | 한글 조합/selection/caret·Tab/focus·screen reader·text/action 기능 유지. accessibility on에서 정상 동작 |
| **W17-06 남은 공통 Core 비용 축소** | owner별 증분 sync·생성/할당·text/semantics·paint snapshot을 한 변경씩 개선 | 기존 State/Key/layout/편집/자원 회귀 통과. Hermes 각 모드에서 해당 비용과 전체 frame 효과를 대응 |
| **W17-07 조건부 RNW/VM 개선** | §4 B/C 비교, 필요한 RNW/Node-API/VM patch 또는 관련 upstream fix | 개선 근거·유지 비용·ABI·rollback 명시. 불필요하면 `SKIPPED / 근거`로 닫음. 필수 기능/성능 실패를 SKIPPED로 덮지 않음 |
| **W17-08 제품 공급·실제 Testbed 전환** | SDK/CLI·템플릿·일반 launcher의 Hermes 기본 엔진 계약, 명시적 host 선택과 새 entry, 전체 gallery 소비, 두 Release 앱·설치/실행·기존 host 회귀. 제품 진입점·공급·검증 도구·README의 잔여 기준선 불일치 수정 | 사용자는 기존 Nelyx 앱 API로 실행 가능. 실제 기본값·옵션·공급·사용법이 W17 계약과 일치. 엔진/host 옵션과 iOS 포함 선택 근거 문서화. 직접 host 기본 전환은 최종 수락 후 |
| **W17-09 최종 성능·물리 수락과 정리** | §6 부하·§7 gate, §5.1 기준선 불일치 최종 점검과 필요한 수정·재검증, 최신 결과·잔여 작업·사용법 갱신 | 두 모드의 결과와 실제 표시·입력·안정성·자원 수락. 필수 기준선 불일치 미해결 0. 실패·미해결 시 PARTIAL과 다음 수정 단계/owner 기록 |

**의존 순서:** 00 → 01 → 02 → 03/04 → 05/06 → 08 → 09. 07은 관찰된 병목에 따라 삽입한다. **모든 단계는 §5.1의 불일치 점검·수정·관련 검증을 포함한다.** 먼저 layout 엔진을 다시 쓰거나 full-gallery AOT를 매번 재컴파일하지 않는다. 시제품 비교에서 효과가 작아도 측정된 Core/recording 병목으로 이어가며, RN 제거만으로 버벅임이 없어졌다고 결론내리지 않는다.

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
- 모든 검사는 저장소 지침대로 **20분 timeout**을 둔다. 기존 `npm.cmd run test:scroll-engine`과 변경에 해당하는 paint replay·frame clock/backpressure·layout/편집·Windows input/semantics·loader/supply 검사를 선택한다. 현재 실행한 검사의 범위는 §8에 기록한다.
- 기존 `node Nelyx/eng/tests/run-windows-scroll.mjs matrix 3`는 **현재 RNW 경로**다. 직접 host는 CLI의 `--host native-hermes` 또는 `node Nelyx/eng/run-native-hermes.mjs --hermes-mode bytecode|static-aot`로 실행한다. `node Nelyx/eng/run-native-scroll.mjs --hermes-mode bytecode --scope diagnostic --catalog`는 실제 Testbed의 **프로그램 스크롤 진단**이다. `--viewport default|maximized`, `--scope cpu|gc|diagnostic`을 선택하며 임시 entry·패키지는 종료 시 정리한다. bytecode의 별도 `--scope sampling`은 1,000Hz Hermes PC 관측을 정확한 bundle source map에 연결한다. 관측 횟수를 시간 비율로 사용하지 않으며, 기본 상위8개 함수 대신 전체 mapped stack은 `--details`로 출력한다. 아직 matched OS 입력 성능 matrix가 아니며 기능 smoke·프로그램 진단을 정규 성능 matrix에 포함하지 않는다.
- 직접 host의 `--input os --scope cpu --viewport both`는 별도 native thread의 실제 wheel ListView 진단이다. 같은 bundle을 한 번 빌드해 기본/최대화 새 process에 사용한다. `--catalog --scope cpu`는 실제 Material29개·Cupertino20개 전체를 OS wheel로 이동하고, cold/revisit의 각 section을 Core build sequence와 정확히 같은 native surface content frame에 연결한다. fast의 건너뛴 section은 보고하며 built-only/discarded frame은 노출로 세지 않는다. bytecode의 별도 ListView `--scope sampling`도 지원하며 OS catalog sampling·GC·inclusive diagnostic 조합은 거부한다. input dispatch와 callback/checkpoint를 별도 보고하고, 동일 pacing·전체 CPU 계측의 RNW baseline과 물리 표시 수락을 대체하지 않는다.
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

> **전체 PARTIAL / goal PAUSED · performanceAccepted=false · physicalInputAccepted=notVerified · displayed=unobserved.** 2026-10-25 **17:10 KST**, 사용자 중간 마무리 요청으로 구현·추가 측정을 정지했다. Core **fcce0e24…c2c7**·SDK **e09e0698…5757**·CLI **3400a611…1688**, 두 정식 native 제품의 byte identity는 유지한다. native suite36/36·C++ host1/1과 앞선 정식 UIA/OS pointer4실행은 통과했지만 최신 private commit의 마지막3회 순증가도 고정 한계를 넘었다. H2/H3/H4/H5는 미수락이며 기본값은 Hermes/optimized·RNW다.

| 단계 | 구현·검증 범위와 남은 조건 |
|---|---|
| W17-00 | 시작 HEAD `ee82b364efbb48e7821f006f2e1ed3750f4b3f95`·시작 dirty 없음. Core/SDK/Skia 공급과 RNW binding18개 library를 재컴파일했다. Windows165Hz/DPI192·기본974×929/최대화2560×1459 physical px를 확인했다. 정규 matched baseline/matrix0회. |
| W17-01/02 | HWND/UI owner·전용 Hermes/JSI owner·Vulkan/DirectComposition·RN-neutral scheduler·timer/microtask/Promise rejection·환경·assets/font/image·clipboard/messenger 구현. 두 모드의 시작/scroll/편집/resize/close를 확인했다. admission 중단→입력/서비스 종료→GPU drain→JS handle/VM 정리를 유지한다. |
| W17-03/04 | bounded display-list1의23 opcode·paragraph/sampling/clip/picture/backdrop·오류 시 mutation 전 거부·강제 Hermes GC 뒤 replay/snap/drain을 실제 raster/Vulkan로 검증했다. 64개 초과 입력 tail이 key/frame/close를 추월하던 경합을 고쳐 실제201 samples·microtask·종료 순서를 확인했다. OS wheel의 cookie/거리/방향/원래 timestamp와 matching surface 검증도 구현했다. |
| W17-05 | TSF·UIA fragment/Text/Text2/Value/RangeValue/Invoke/Toggle·stable ID/peer retirement·viewport/owner/revision·최근16 actionable snapshots를 연결했다. 제거·교체·종료 provider의 Windows 해제 통보와 WM_DESTROY map 정리를 추가했다. UI owner의 posted turn에서만 해제하고, 그 호출 동안 runtime/host/root 식별만 허용한다. stale action/data/bounds는 계속 거부하며 closed root 재게시를 차단한다. 물리 한글 IME·reader·전체 action/state 수락은 잔여다. |
| W17-06 | transform/detach cycle·layer depth/callback·중복 frame 예약·Paint/resource batch·Matrix4 접근·semantics geometry를 보완했다. 성공 경로의 errors/closure·layout 방문 Set·BuildOwner 중복 membership·action 없는 Map·상수 invariant 호출을 줄였고, 스타일의 빈 spread25곳과 SemanticsFlags 필드 분류 배열 생성도 제거했다. virtual getter/iterator·State/Key·rollback·falsey 오류/순서·frozen/Proxy 계약을 유지한다. 전체 속도/할당 개선은 미수락이다. |
| W17-07 | **prototype cache 포크 SKIPPED / 미채택.** 작은 fixture 개선이 실제 앱의 일관된 개선으로 확인되지 않아 원래 source/compiler/runtime으로 복귀하고 패치 파일·추가 cache ABI를 제거했다. 별도 RNW B/C 포크도 채택하지 않았다. H2 실패를 SKIPPED로 닫은 것은 아니다. |
| W17-08 | explicit native-hermes doctor/prepare/build/run/pack·실제 zip 왕복/변조 거부·공유 host/AOT cache·일반 앱 API/자산 소비를 구현했다. 새 공급인데 옛 locator hash가 prepare를 막던 오류를 red→green 회귀와 실제 설치 CLI로 수정했다. prepare는 현재 공급을 검증한 뒤 hash를 갱신하고 build/doctor는 stale 입력을 계속 거부한다. 양 언어 README도 갱신했다. |
| W17-09 | 아래 현재 제품/기능 검증과 새 임시 owner 정리를 마쳤다. 고정 한계를 사용하는 실제 process/Vulkan 메모리 관측과 실패 판정을 추가했지만 private plateau는 실패다. frame/표시·물리 입력·미해결 RNW 실패·두 번째 실제 앱도 남아 전체 PARTIAL이다. |

| 현재 공급 | workspace와 Windows/Web/Android 세 설치의 동일 파일 목록·내용 |
|---|---|
| Core | src/dist/package **3,121 files**, **fcce0e24287d817b97002fded1696a8d1e18c0358be3a021a7d10eeee7bec2c7** |
| SDK | native/README/라이선스를 포함한 실제 package **633 files**, **e09e06981c9dadc579e44b642907a31812fd95319072f6d2d8e492b3cebd5757** |
| Material | assets/라이선스를 포함한 실제 package **1,324 files**, **9009e35222c19975915f6a7cec12df3dd3375d81b9c302e8df76ffd30bf6b80e** |
| CLI | 실제 package **270 files**, **3400a6114265a515726c3111fe3c8cd36d2b3064f61d23a496bb8c56f0531688** |

모두 정렬한 경로에 SHA256(path+NUL+fileSHA256+LF)를 적용했다. Core는 명시한 code 범위이며 SDK/Material/CLI는 실제 설치 package 전체의 source 대응 범위다. 마지막 SDK633 변경은 native/windows-hermes에 한정한다. 이번 외부 주소 공간 관측은 Nelyx/eng만 바꿔 Core/SDK·정식 HBC/AOT 제품의 동일 identity를 유지한다. 아래 RNW/Web/Android 실행은 SDK632의 앞선 검증 범위다.

| 현재 제품·검사 | 결과와 증거 범위 |
|---|---|
| Core 회귀 | 현재 fcce에서 Core build·scroll159/159·접근성80/80·paint/Scene/Matrix4/semantics/resource96/96·text/paragraph38/38·9 workspace 타입 통과. 앞선2ac의 상수 code/message invariant527곳/21 modules·TypeChecker binding543개 점검과 실제 ListView 논리 호출110,203/6,493/116,809/98,921→17,816/130/17,257/13,436(초기/settled/목적지/복귀, predicate 실패0·동일 트리/configuration 수)는 이전 변경의 근거이며 native 개선율이 아니다. |
| Core 할당 진단 | 실제 ListView Node/CanvasKit의 목적지 프레임에서 빈 스타일 객체4,980개(run capture2,235+style adapter2,745)와 flag 분류 배열6,141개(267 constructors×23), 합계11,121개 생성을 제거한 별도 논리 계수를 확인했다. getter/Proxy·nested snapshot·borrowed Paint/custom scaler·오류 순서는 기존38개 text/paragraph 회귀에서 유지됐다. instrument 없는 단회 V8 sampling(512-byte interval)은2ac21,609,184→fcce21,086,584bytes였지만 표본 추정치이며 Hermes 할당·native timing·전체 개선율로 수락하지 않는다. |
| 직접 host identity | host source **cdba6b89c7fcce315ff3e0e6c0908ba0eceb2ce0e90d42b4d3ac2c19fa618804**·현재 EXE **ca31355a0d3a736fac07f16319829046f9bb64cb703ebd75742e12dc636ae498**·stock VM **de31402961ea5c2f2d7da367b81f0f219786ffab98c24ba3bad6e34d07fe5696**·v3 toolchain **a0d7d3c2a023a3610e0c12e4182fd6ab604cf9e3ca1a89a8533dd43a964e71ff**. supplier source tree86a15cef…8fd3도 원래 pin/patch와 대조했다. |
| 정식 두 제품 | HBC153 files/app.hbc8,209,919bytes **c68678eae8d16f2cd31cc9c3a47d32b2629a2cbd413b95dcf009ffa4bf357fe3**. AOT156 files/DLL46,101,504bytes **18d043844d0cfb5716555838d758a2ecb4d605bf268a35fa167a8394777f7809**. SDK633의 native host 수정 뒤 두 제품을 갱신했다. 최종 AOT frontend45.65초·nelyx_typed/nelyx_app object cache hit·image 재링크이며 full-gallery native 함수 재컴파일은 하지 않았다. |
| 정식 UIA·OS pointer | 현재 각 모드에서 range6 requests(absolute/discrete/thumb/invalid/disabled/readOnly)와 OS category-text→field-filled click·CUIAutomation8 GetFocusedElement/HasKeyboardFocus·동일 owner/ID·최대화를 통과했다. range surface49/61·입력12/14, pointer surface18/15·입력10/10, reject0. 네 실행 모두 memory observer off·exit0/forced=false. loaded79/80 modules·RN/Node-API 없음·현재 source848/owner11·EXE/VM/bundle hashes를 대조했다. generated3개/asset 내용은 code-only source 검사에서 제외하며 전체 package inventory는 별도 검증한다. |
| AOT coverage | initializer851/851, original callable36,298 native(typed21)+34 proven-dead, emitted40,543 native. wholeAppNativeAot/typePolicyAccepted=true·unresolved/unclassified/dynamic-code0. execution 파일 SHA **ec87ef0d1fab7805f3aa0d75d079fad0905e3d054006d4b6c52407131b51543a**·내부 identity19549b76…ef5a, policy SHA **fd7e96f379d4e3c8902d8b1a37f481dfbcea80986c1fb992b0bfe25c6d37051d**·내부 identitya3e1fb81…d9a0. compiler map36,892(app36826/typed66)·두 SHUnit 확인. type policy callables31,007/specialize21/dynamic30,986은 original callable 수와 별도다. |
| native 회귀 | 현재 제품의 실제 zip/변조 거부·graph/loaded/source drift·receipt/report·prepare 갱신·자원/메모리 증거 검증과 두 모드 실제 VM getter/receiver/Proxy/HostObject/falsey 예외/weak root/getter 중 GC/young GC까지 **36/36·skip0**. 새 주소 공간 관측의 PID/순서/누락/범위·commit 증감 보존·비원자적 증거 범위 검사2개를 추가했다. 실제 두 제품의 memory observer on/trace off 창 생성 전 거부도 포함한다. C++ loop/23 opcode/Vulkan 강제 GC/queue/close·UIA retirement/실제 UiaDisconnectProvider/다른 UI apartment 거부·idempotent close와 실제 VirtualAlloc reserve/commit/expand/decommit/release **1/1**. [Windows 해제 계약](https://learn.microsoft.com/en-us/windows/win32/api/uiautomationcoreapi/nf-uiautomationcoreapi-uiadisconnectprovider)·[runtime identity 예제](https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/UIAutomationCleanShutdown/cpp/UiaCleanShutdownControl/UiaCleanShutdownControl.cpp)에 따른 해제용 식별 조회만 일시 허용한다. 일반 회귀는 correctness-only다. |
| 정식 제품 메모리 관측 | opt-in PSAPI [PrivateUsage](https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters_ex)·실제 Device Vulkan 할당/import·강제 GC 없는 VM 계수를 읽는다. 고정 상한 private1GiB/Vulkan512MiB·마지막3회 span8MiB/1MiB·순증가1MiB/64KiB·allocation count 순증가0을 유지한다. 동일 cdba HBC 최대화2560×1459/DPI192의 새6회 원인 진단은 OS wheel192개/native190개 coalescing·raw 절대23040/net0·JS 절대9216 보존, focus/viewport 고정·거부0·surface331·exit0/forced=false였다. 마지막3회 private453,603,328→454,356,992→455,950,336bytes, 순증가2,347,008bytes로 **FAIL**(probe exit1). Vulkan20개/149,702,720bytes·VM capacity62,914,560bytes는 일정하고 private peak455,962,624bytes는 상한 안이다. driver residency·수정 후 AOT/기본 창 plateau는 notVerified, H4 전체는 미수락이다. |
| 외부 주소 공간 원인 관측 | 새 native-memory-regions.h와 실제 UIA 클라이언트의 read-only VirtualQueryEx, scalar 검증을 연결했다. 앱/SDK·JS entry·AOT image를 바꾸거나 heap/registry를 조작하지 않는다. scan7개·0..16ms·1,331..1,415 queries, 원시 주소/로그 파일 없음. cycle2의 새 private base77,594,624bytes는 protection0x404였고, tail4→6의 MEM_PRIVATE commit+2,338,816bytes는 새 base1,052,672+동일 base 증가1,286,144였다. PSAPI tail+2,347,008과8,192bytes 차이다. [VirtualQueryEx는 image/mapped의 copy-on-write 전환을 MEM_PRIVATE로 바꾸어 분류하지 않으므로](https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-virtualqueryex) PSAPI를 대체하지 않는다. scan은 비원자적이고 주소 재사용도 가능해 allocation stack/실제 owner·수명은 unproven이다. |
| RNW Hermes | Core fcce0e24·SDK632·optimized/HBC99,1,764 files/313,731,950bytes. EXE **9cfa72e544e227b0d057fce467c1cd4c261f8260b67f0d55336f23e8a6edeb94**, HBC **15111b2a8c5a21f8c68e6c91ea6d11477785026dbe45020da4679c78c7a5e1fb**. 실제 first-content·Responding/유효 HWND·패키지 DLL paths/hashes·owner/GPU/input drain·exit0/forced=false1/1. 현재 output/배포본 모두 옛 AOT map과 옛 host/assets 없음. |
| RNW focus·한국어 TSF | 이전 native commit을 latest React handler가 버리던 경합을 재현해 수정했다. 실제 layout-effect commit16개와 현재 Core callback을 조회하되 unmount/source/owner/surface/viewport·편집 generation/privacy/capability·revision/range를 fencing한다. Windows semantics12/12는 SDK4114a418의 앞선 회귀다. 현재 Core fcce에서 실제 commit22를 보류하고23을 게시해 old strict 거부/new receiver 수락·Core/TSF/UIA focus/GPU caret를 대조했다. 한국어 HKL0412 TSF 조합/확정/편집/privacy/OS키/resize/8회 blur-focus·geometry publications max3·정상 drain/exit0 통합1/1. 과거 단회 focus 실패와 동일 원인인지는 미확정이다. |
| Web | Core fcce·SDK632 application.js **92c466188775855cd805b4f1d47a1ddc46cb0bff98210b58c55c511864c7a627**. 실제 Chrome/SwiftShader WebGL2 시작·EditContext 한글A 입력/selection/focus·투명 DOM carrier1/1, CanvasKit gallery24 PASS/1 profiling SKIP. CanvasKit JS cc0c8868…e665/WASM2b9fe2ff…5f1c는 앞서 C++ source·patch5개·dependency pin/origin/dirty14개·recipe b8c1eabd…f5fbd를 대조하고 WSL1,854단계/440.13초에 sourceRebuild=PASS-build한 공급과 동일 byte다. 출력→공급→설치→Web 출력 hash 일치를 유지하며 이번 Core-only 변경에서 C++는 반복 빌드하지 않았다. notice=PARTIAL·물리 입력/표시 notVerified. |
| Android | Core fcce·SDK632 x86_64 Release/emulator-vulkan APK **d89555b06c45e9e8b46824d2f51727903eccea3cbf1546f94fd5986fe43a2b61**. Temurin21.0.11로 빌드(1분46초/119 tasks), read-only/no-snapshot Pixel_5/API33 실제 시작/activity6frames/Back 복귀/scoped app PID 오류0, smoke1/1. emulator는 종료 대기 뒤 소유 tree 강제 정리(forced=true,exit0)했으며 native drain·물리 입력/표시는 notVerified. Android Hermes0.14.1/HBC96/-Og는 Windows1.0.0/HBC99와 별도다. 일반 OpenJDK21 사용법을 README에 반영했다. |
| 기타 범위 | boundary944 files/507 facades/7,735 runtime edges·cycles0, ownership56 moved/8 adopted/11 managed와 출처 metadata12개의 registry 참조16개는 앞선 통과 범위다. JSC26.4 JIT/interpreter·V8 24.1.10 실제 앱/loaded/drain 검증은 이전 Core379150f8의 별도 범위이며 현재 Core 결과로 합치지 않는다. RNW Static Hermes supplier/locator는 없어 notVerified다. |

GC 단회 비교는 **5f6a618d→2ac2c8df**, `turns / wall p95 ms / allocated MB(10^6)`다. 최대화2560×1459·DPI192·165Hz·programmatic·GC enabled·spans off, 같은1,000행/80px·부하·트리·semantics 주기를 대조했다. callback과 이어지는 checkpoint wall이며 heap delta는 trace 분석 bookkeeping도 포함한다.

| phase | HBC 5f → 2ac | Static Hermes 5f → 2ac |
|---|---|---|
| retained | 136 / 9.60 / 126.30 → 137 / 10.57 / 126.14 | 132 / 10.56 / 120.19 → 132 / 9.52 / 120.19 |
| cold | 59 / 39.21 / 151.03 → 57 / 32.50 / 151.17 | 73 / 29.02 / 173.89 → 77 / 31.60 / 177.15 |
| revisit | 64 / 29.80 / 147.21 → 66 / 27.64 / 153.24 | 79 / 22.69 / 171.63 → 80 / 24.41 / 173.34 |
| fast | 11 / 193.92 / 164.71 → 12 / 176.76 / 170.94 | 12 / 196.29 / 181.71 → 12 / 195.55 / 174.24 |

두 새 실행 모두 phase 입력0·foreground/focus/keyboard/UIA/lastInputTick 고정·cursorParked=true·정상 exit0·강제 종료 없음(surface387/407, 시작 pointer2개씩은 phase 밖)이다. 진단 bundle은 HBC4421225d…3809/AOT5a889acd…1c20이며 host/VM identity와 package153/156 files를 대조했다. phase 순서의 collection은 HBC33/40/39/43→33/40/41/44, AOT32/47/45/47→32/47/46/46, young GC ms는 HBC50/107/95/130→52/99/103/128, AOT48/108/105/133→49/102/107/122이다. 보고된 full GC time delta는0ms이며 full collection 수는 HBC0/1/1/1·AOT0/2/1/1로 전후 동일하다. full GC가 발생하지 않았다는 뜻은 아니다. frame 수가 달라지는 phase의 총량을 개선율로 쓰지 않는다. AOT retained는 같은132turns/약120.19MB로 거의 같고 fast도 단회 wall196.29→195.55ms이므로 전체 할당·속도 개선을 수락하지 않는다. fast는 두 모드 모두50ms를 크게 초과한다. 정규 OS 입력/표시 matrix 표본이 아니며 performanceAccepted=false·physicalInputAccepted=notVerified·displayed=unobserved를 유지한다.

이 GC 비교는 이전 Core2ac와 stock host/VM을 사용한 재링크 전 진단(EXE4cb19cfc…f311)이며 최신 Core fcce의 성능 결과가 아니다. 현재 정식 EXEca31355a…e498·AOT18d04384…7809는 별도 기능/loaded 검증 대상이며 진단 bundle과 정식 제품의 hash를 합치지 않는다.

| 원인 검토·잔여 수락 | 현재 판단 |
|---|---|
| 행 생성 원가 | 앞선 inclusive 진단의 최악 fast frame1,110 elements mount/1,036 unmount·행당74 elements·Sliver.createChild115.98ms/trailingBuildLayout150.00ms·Layout p95168.62ms가 생성/배치 비용을 가리켰다. 고정80px/1,000행 far-seek는 목적지 cache496..505/994..999/0..5만 생성하고 중간 행을 만들지 않았다(28 mount/28 dispose·max10 live). 캐시/샘플 정책 변경은 해법으로 채택하지 않는다. |
| 2ac source 진단 | Core2ac HBC PC sampling fast750 observations에서 self GC69/invalidatePaint22/layoutMutationAllowed14/SemanticsConfiguration 초기화12/copyDataProperties11을 관측했다. CPU ms/비율이 아니다. Node 실제 ListView 목적지에서 paint589회/부모27,660방문·layout permission3,225회/부모19,661방문·inherited Map165 copies/2,850 entries였다. configuration 생성1,176개=provider-original1,130+copy46이므로 대량 copy 폭증 가설은 제외했다. 트리와 오류0을 확인한 계수 진단이며 native timing이 아니다. attach의 eager configuration 읽기는 [pinned Flutter](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/rendering/object.dart#L2384)와 같아 생략하지 않았다. pinned HiddenClass dictionary threshold64와 기본 ProxyBox31/Stack37 필드 수만으로 추가 분할을 정당화하지 않는다. |
| VM 시제품 미채택 | descriptor 위치만 검증하는 cache의 작은400,000 reads fixture는 getter HBC18.83→13.21ms/AOT16.78→11.01ms였고 동작/GC 검사도 통과했다. 그러나 동일 Core/HBC 진단 bundle4421225d…3809의 앱 GC는 retained/cold/revisit/fast10.68/33.34/24.48/183.14ms(n132/66/70/11)로 기존 stock10.57/32.50/27.64/176.76ms(n137/57/66/12)와 혼재했다. phase 입력0/같은 부하·트리·경계/정상 exit0이나 개선을 수락하지 않았다. AOT 앱 시제품은 추가 빌드하지 않았다. source/ABI/patch 파일을 제거하고 v3 toolchain a0d7d3c2·VM de314029의 정확한 identity와 현재 두 제품을 복구했다. |
| H2/H3 | 정규 matched matrix0회. 앞선 OS49 catalog의 CPU max118.21ms/oldest input→surface max205.28ms, Static OS list fast64.16/120.17ms와 RNW166.58/445.82ms 실패도 유지한다. 공급/창/부하/계측이 다른 수치를 합치지 않는다. 실제 content-to-display·precision contact/관성/재접촉/반전·물리 wheel·reader·물리 한글 IME는 notVerified/unobserved다. |
| H4 | recording wrapper GC 만료·fatal/submission drain·보고8KB 절단·Static helper 선언·wheel UI join timeout·UIA provider 해제 누락은 수정했다. 과거 RNW0xC0000005 AV·단회 focus·빌드 npx0xC0000409 원인은 미확정이다. 앞선 두 모드6회 논리 자원 반복의 gallery tree1726/852/45·producer78/units653/bytes124104, tail resident131/units1033/bytes205266·picture14/14/195656bytes·native[1,0,1,0,0]는 이전 범위다. UIA 수정까지의 메모리 관측30회는 종료했고 이번에는 새 주소 공간 분류를 추가한1process×6회 원인 진단만 실행했다. private 증가가 다시 실패했으며, tail의 신규 base와 기존 base commit 증가를 분리할 근거를 얻었다. 특정 cache/COM/driver의 leak이나 UIA 누락이 모든 증가의 원인이라는 입증은 아니다. |
| H5·정리 제한 | tracked 실제 앱은 Testbed2 하나다. 두 번째 앱 경로는 사용자에게 요청했으며 ignored 옛 Ozeli 앱을 새 소비자 증거로 세지 않는다. 옛44 stage·렌더링 시제품bytecode/static-aot·중복 root .nelyx/windows-native-host·옛 RNW입력425dae08…·sample Windows project의 옛 OzeliRNHost 중간 metadata 삭제는 자동 승인 검토가 blocked by policy로 거절했다. 구체 사유 미제공, 우회하지 않는다. |
| 최신 종료 점검 | 2026-10-25 **17:10 KST**, HEAD ee82b364…3f95·git status 기본163 entries/전개181 files·diff --check exit0. 현재 package·제품 identity는 위 값과 같다. 소유 native app/emulator/compiler process0·ADB device0, 새 native build/pack/scroll/UIA/source-check/supply/input/browser/property/prepare 임시 owner0·Chrome profile/process0·Core build temp0·새 stage0. VM patch marker/file0, RNW 옛 AOT map0, 금지된 docs/plans·docs/migrations 없음, 기존 animation fixture2개 보존. 거절된 옛 정리 대상은 남아 있으며 새 로그·checkpoint/archive는 만들지 않았다. |

**현재 진행점 — PAUSED:** 사용자 중간 마무리 요청으로 구현과 추가 측정을 멈췄다. 외부 주소 공간의 신규·동일 base commit 증감 관측과 실제 VirtualAlloc/집계 보존 회귀를 추가해 C++1/1·native36/36을 확인했다. 정식 제품 bytes는 그대로이며 새6회 HBC 원인 진단도 private 순증가 한계 실패다. OS/JS 입력량과 normal close/loaded identity는 유효했다. 마지막2ac stock source의 fast wall p95 HBC176.76/AOT195.55ms는 H2 실패이며 최신 matched matrix는0회다. 전체 작업 완료나 기본 host 전환으로 표시하지 않는다.

**재개 시작점:** 먼저 현재 hashes·dirty state와 실행 process0을 대조한다. native-memory-regions.h/외부 클라이언트·검증기를 읽고, tail에서 늘어난 기존 PAGE_READWRITE base와 신규 약1MiB base를 실제 heap/retained owner·allocation stack에 대응시키는 read-only 근거부터 찾는다. protection0x404의 큰 새 base도 owner가 확인되기 전에는 driver leak으로 단정하지 않는다. 새 원인 없이 같은 진단을 반복하거나 한계·횟수를 늘려 통과시키지 않는다. W17-06 목적지 행 constructor/build/adopt/layout·render sync·paragraph configuration 할당 감소, H2/H3·RNW AV/과거 focus·process/driver plateau(H4)·두 번째 실제 앱 경로(H5)·물리 입력/reader 수락이 남아 있다. 재개 요청 전에는 구현·native 측정을 다시 시작하지 않는다.
