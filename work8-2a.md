# work8-2a — 엔진 v2 구현·전체 API 호환·npm 비정상 종료 재검토

검토일: **2026-11-05 KST** · 상태: **PARTIAL / 전체 API 호환 gate FAIL / npm 종료 원인 미확정**

[전체 목차](work8.md) · [2부 구현·설계](work8-2.md) · [3부 완료 기준](work8-3.md)

## 1. 판정과 이번 검토 범위

사용자가 확인한 완료 기준은 **기존 공개 API 전체의 생성자·동작 호환**이다. 현재 구현은 그래픽·Windows/Web 일반 프로젝트 실행·통합 메모리 장부의 일부 구간을 제공하지만, 이 기준에는 도달하지 않았다. 기존 앱을 import 경로와 호출 의미까지 유지해 v2로 실행하는 호환 제품으로 판정할 수 없다.

이번 요청은 재검토와 문서 작성이다. 구현 소스, 현재 package export/declaration, API audit, 공급 manifest/hash, runner 검사 소스를 읽었다. **빌드·기능 테스트·npm 설치는 재실행하지 않았고 구현도 수정하지 않았다.** 아래에서 이번에 다시 확인한 사실과 직전 구현 작업의 검사 기록을 구분한다.

| 대상 | 재검토 판정 |
| --- | --- |
| 전체 기존 공개 API | **FAIL**. 현재 audit를 직접 실행해 `compatible=false`, strict 종료 코드 **1** 재확인 |
| 그래픽 확장 | 제한된 retained 그래픽 기능과 회귀가 있음. 전체 기존 paint/custom rendering API 및 세 profile 전체 pixel 동등성은 미완료 |
| 일반 runner | Windows·Web 두 profile의 v2 앱 경로가 있음. 기존 앱/SDK 전체 호환·모든 플랫폼·generation reload 완료는 아님 |
| 통합 메모리 | 공통 ledger와 admission/회수 구현이 있음. 브라우저 JS heap과 불투명한 내부 할당을 포함하는 전체 process/GPU hard cap은 미완료 |
| npm 비정상 종료 | 이전 `npm install` 자식 프로세스의 **0xC0000409 두 건**과 환경 보완 후 전체 runner **8/8** 기록이 있음. 근본 원인 해결로 판정하지 않음 |
| 제품 수락 | `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 IME/reader/trackpad·display/scanout `notVerified` 유지 |

## 2. 현재 기준점과 증거의 범위

검토 시작 시 HEAD는 `61fa2d2`이며 이전 구현의 미커밋 변경과 신규 파일이 존재한다. 이 문서는 HEAD 단독이 아니라 **현재 작업 트리와 현재 공급**을 검토한 결과다. [2부의 현재 재개 현황](work8-2.md#현재-재개-현황)이 과거 `PAUSED` 절보다 우선한다.

이번 읽기 전용 확인 결과는 다음과 같다.

| 항목 | 확인 결과 |
| --- | --- |
| API 검사 | `node Nelyx/engine/tools/api-audit.mjs --summary --strict` → `compatible=false`, exit **1** |
| 공개 선언 entry | Core/Material/Cupertino/SDK의 현재 export 대상 파일은 모두 존재. `/v2` 또는 `/engine-v2`를 포함한 subpath는 **526/190/45/77개** |
| 현재 공급 | [engine-manifest.json](Nelyx/engine/dist/engine-manifest.json), qualification **host-integration-candidate** |
| ABI·schema | ABI major **2**, schema **2587795476** |
| 소스 identity | `sourceIdentity()`와 manifest의 SHA-256 일치: `1f959c6e09f3868361e2d0d71c797029e1c5d8140930ff89272660af4b1137fc` |
| 공급 파일 | **33파일 / 4 font**, manifest에 나열된 파일의 hash 불일치 **0개** |
| 현재 도구 | Node **v24.15.0**, npm **11.17.0**. 현재 설치본을 읽은 결과이며 실패 당시 npm 버전을 별도로 입증하는 기록은 아님 |

Source identity는 [빌더가 열거한 입력](Nelyx/engine/tools/build.mjs)에 대한 확인이다. 모든 기존 SDK/Cupertino 소스와 모든 생성 선언의 최신성을 포괄하는 증명은 아니다. 공개 선언 파일의 존재 확인도 소스와 선언의 의미적 일치 확인을 대신하지 않는다. 다음 구현 검증에서는 공개 패키지를 다시 빌드한 뒤 audit해야 한다.

직전 구현 작업에서 [기록한 검사](work8-2.md#이번-재개의-검증)는 기능 **242개**와 별도 package ownership **5개**다. 구성은 Core 211, host 5, runner 8, glyph 3, actor 3, graphics 2, 기존 입력 geometry 2+7, paragraph query 1이다. 이번 문서 작성에서 이 검사들을 다시 실행한 것은 아니다. 검사 개수는 기존 API별 호환 사례 수나 완료율로 환산할 수 없다.

당시 실제 Testbed에서 SDK 명령 **1210 = C++ transactionWork 1210**, 그래픽 record **14**, native extension **1**을 보고했다. 이는 해당 장면의 실제 C++ 작업을 뒷받침한다. 다만 아래 §6의 `fallbacks` 계측 한계 때문에 **TS fallback 0을 독립적으로 실측한 증거라고 확대하지 않는다.**

## 3. 구현되어 있는 범위와 남은 경계

### 3.1 그래픽·geometry·확장

| 현재 구현 | 남은 작업·수락 경계 |
| --- | --- |
| Affine/inverse, 계층 world matrix와 clip, rounded clip, move/line/quad/cubic/close path, winding/evenOdd, stroke/shadow, subtree opacity/blur | 기존 Canvas/Path/Paint·shader/filter·custom paint/render API 전체의 생성자와 동작을 대체하지 않음 |
| 합성 geometry의 finite/범위 검사, transaction/layout/활성화 실패 시 기존 scene 보존, 명시적 빈 path의 입력·paint 차단 | 경계 좌표·중첩 clip/effect·실패/교체를 Native 및 두 Web profile에서 공통 pixel/input corpus로 비교해야 함 |
| Inverse hit, 변환된 scroll/slider delta, 중첩 handoff, 게시 geometry 기반 TSF/UIA·DOM carrier | Curve hit는 0.25 단위의 bounded 평탄화. Raster 경계와 완전 동일한 hit 판정 수락은 아님 |
| `NativeSparkline`: 2–256개 정규화 표본으로 C++/Wasm path 생성, capability·node flag, 확장 재선언 없는 크기 변경 거부 | 하나의 정적 확장 사례. 사용자 정의 native extension 등록/배포·임의 RenderObject 동기 hook 전체 호환은 아님 |
| `AppDrivenBoundary`: Stateless/Inherited 하위까지 모든 node의 finite width/height를 요구하고 native child layout 비활성화 | 기존 intrinsic/baseline/parent-data/layout/paint/hit-test subclass 계약을 자동으로 실행하는 adapter가 없음 |

근거: [공통 geometry](Nelyx/engine/core/scene/geometry.hpp), [v2 그래픽 Widget](Nelyx/runtime/engine-client/graphics.ts), [Native 그래픽](Nelyx/engine/platform/windows/graphics.hpp), [CanvasKit 그래픽](Nelyx/engine/render/canvaskit-web/graphics.ts), [계약 회귀](Nelyx/engine/tests/graphics-contracts.mjs), [실제 provider 검사](Nelyx/engine/tests/graphics-render.test.mjs).

기존 그래픽 pixel 검사는 실제 CanvasKit **CPU surface**의 path/rounded clip/rotation/opacity/stroke/shadow/blur와 자원 회수를 확인한다. 실제 Web host의 WebGL2 실행 증거와 구분해야 하며, Native/두 Web GPU 전체의 동일 pixel 결과를 이미 검증한 것으로 쓰지 않는다. Web host의 SwiftShader 결과도 hardware 성능 증거가 아니다.

### 3.2 일반 앱·runner·종료

[SDK bootstrap](Nelyx/sdk/src/runtime/engine-v2-app.ts)은 `defineEngineV2App`/`launchEngineV2App`, build/ready/dispose, asset·view·notify를 제공한다. [CLI runner](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)는 `--engine v2`의 create/doctor/prepare/build/run/dev/pack, `nelyx.v2.json`, entry/asset 검증, ABI/schema/source/file identity, 손상 거부, 실패한 빌드의 이전 bundle 보존, supplier 포함 package를 구현한다.

Windows host는 `--app`으로 일반 bundle을 읽는다. Web은 `/plain/`의 비격리 single-worker와 `/isolated/`의 threaded 경로를 제공한다. `dev`는 **빌드 후 실행**이며 파일 감시·generation reload/hot reload 구현은 없다. Android/Apple/Linux는 v2 host가 없어 명시적으로 실패한다. 기존 SDK의 app/service/platform API 전체도 이식되지 않았다.

종료는 App dispose → Widget close → transport abort → provider/Core 회수를 목표로 연결되어 있다. Native의 반환하지 않는 JS dispose loop에는 3초 대기와 250 ms 종료 유예 후 Hermes async break, owner join, 실패 exit가 있다. 직전 runner 검사는 정상 종료, dispose 자체 오류, 중복 close, 무한 JS dispose를 다룬다. Native API 호출 자체가 반환하지 않는 경우 등 모든 종류의 hang을 해결했다는 증거는 아니다.

Testbed dispose 누락과 종료 뒤 늦은 poll이 `mailbox full/closed`를 App 오류로 올리는 경합은 이전 작업에서 수정했다. 닫힌 WidgetHost의 늦은 응답/예약 build 차단과 활성 session 오류 보고 회귀가 있다. 이는 npm 설치 프로세스의 비정상 종료와 **별개 결함**이다.

### 3.3 통합 메모리 장부

[Core ledger](Nelyx/engine/core/memory.hpp)는 8 owner × 6 종류의 외부 계정과 Core 논리 자원을 합산한다. 기본 한도는 **총 384 MiB / GPU 예약 128 MiB**, Core 논리 자원 64 MiB / resource 32 MiB다.

```text
total = max(Core 논리 bytes, engine committed heap)
      + provider heap + CPU 예약 + GPU 예약 + staging + transport
```

Staging과 transport는 ledger 내부에서 별도 slot을 사용하지만 snapshot의 `staging`에는 합산해 노출한다. 예약 초과 rollback·peak/rejected·trusted host 계정 보고·App의 계정 쓰기 거부가 있으며, Wasm 내부의 Core 논리 비용을 engine heap과 이중 합산하지 않는다.

| 계정 | 현재 구현과 한계 |
| --- | --- |
| Engine/CanvasKit heap | Wasm exchange와 provider API 경계에서 committed heap 관측. CanvasKit 내부 growth 순간의 선제 차단은 아님 |
| Native App | Hermes heap/external bytes를 App packet/turn 경계에서 관측. VM 파괴 뒤 계정 해제. 순간 peak·모든 native 내부 할당 측정은 아님 |
| Native provider | Font/ICU/cache, 추정 paragraph 비용, image bytes, Picture approximate bytes 등을 예약. 실제 RSS와 동일하지 않음 |
| GPU·effect | Cache/backing/교체 중첩/effect layer의 보수적 owned reservation. 실제 driver VRAM 측정값이 아님 |
| Web 전송 | 실제 보유 packet/직렬화 bytes와 preparation/import/draw/load 임시 예약을 사용. Threaded의 두 CanvasKit instance도 계정에 반영 |
| 미계측 | 브라우저 App·host adapter JS heap, 불투명한 provider/driver의 내부 peak 등은 전체 상한의 선제 통제 밖에 있음 |

근거: [Web budget](Nelyx/engine/platform/web/memory.ts), [CanvasKit provider](Nelyx/engine/render/canvaskit-web/provider.ts), [Native provider](Nelyx/engine/platform/windows/skia_provider.hpp), [Hermes 계정·종료](Nelyx/engine/platform/windows/host.cpp).

실제 C++ Wasm ledger + CanvasKit provider의 거대 backing 거부, 이전 surface 보존, close 후 provider heap/GPU/staging 회수 검사가 있다. Wasm engine heap은 worker 종료 전까지 살아 있으므로 close snapshot의 전체 메모리가 언제나 0이라는 주장은 하지 않는다. Native의 `memoryTotal=0`도 ledger 회수 증거이며 OS process/GPU 전체 해제의 물리 측정값은 아니다. **통합 예산 전체 완료 판정은 계속 PARTIAL**이다.

## 4. 전체 공개 API audit 재검토

### 4.1 이번 재실행 수치

[Audit 구현](Nelyx/engine/tools/api-audit.mjs)은 현재 package export의 선언을 읽고, Core/Material/Cupertino는 `/v2`, SDK는 `/engine-v2` aggregate와 비교한다. 아래 subpath 수는 이 네 신규 entry를 각각 제외한 값이다.

| 패키지 | 기존 subpath | 비교 대상 v2 symbol | 원본 경로 재사용 분류 | missing | signatureChanged |
| --- | ---: | ---: | ---: | ---: | ---: |
| Core | 525 | 124 | 415 | 2617 | 39 |
| Material | 189 | 37 | 3 | 936 | 54 |
| Cupertino | 44 | 22 | 0 | 160 | 34 |
| SDK | 76 | 15 | 0 | 268 | 0 |
| 합계 | **834** | — | **418** | **3981** | **127** |

모든 수치는 **module별 export 발생 횟수**다. Reexport·type-only export도 포함하므로 고유 class/기능 수가 아니다. 총 **4526개 발생 항목** 중 원본 경로 재사용 분류를 제외한 **4108개**가 missing 또는 signatureChanged다. `signatureMatchBehaviorUnverified`는 이번 결과에서 0개다. 완료율을 산출하지 않는다.

`canonicalDataReuse`는 [허용 목록](Nelyx/sdk/tooling/cli/src/engine-v2-data-api.mjs)에 따라 원래 공개 경로와 구현을 쓰는 분류다. Foundation Key/Notifier·physics·curve·선별 geometry/painting 값·Material colors 등이 해당한다. 이것을 **418개 동작 검증 완료**로 해석하면 안 된다. 실제 회귀가 확인하는 것은 그중 선택한 Key/Notifier/reconciliation·curve/physics 사용 사례다.

### 4.2 실제 호출이 호환되지 않는 대표 사례

아래 차이는 선언 비교와 현재 구현을 함께 읽어 확인했다. 이름이 같은 v2 기능이 있어도 기존 생성자와 호출 결과가 유지되는 것은 아니다.

| 기존 공개 계약 | 현재 v2 | 이식에 필요한 내용 |
| --- | --- | --- |
| `Padding(padding, child?, key?)` | `Padding(child, insets, options?)` | 인자 순서·optional child·key·Insets geometry와 layout 의미 |
| `GlobalKey(debugLabel?, stateType?)`, currentContext/currentWidget/currentElement | 인자 없는 v2 Key, currentState/currentNode 중심 | 생성자·typed state 검증·context/element 조회·이동과 수명 |
| 기존 `BuildContext`의 services/mounted/ancestor/render/notification API | v2 `dependOn` 중심의 축소 context | 의존성·누락 시 결과·조상 탐색·notification·geometry의 동작 |
| `FilledButton(options)` 또는 `(id, label, onPressed)` | `(label, onPressed, NodeOptions?)` | 기존 overload, child/style/focus/hover/long press·disabled 의미 |
| `MaterialApp(options)` 및 기존 overload, `ThemeData(options)` | `(home, theme?)`, 축소 theme 값 | Locale/messages/direction/scroll behavior, theme 확장·상태·defaults |
| `CupertinoApp(options)`, `CupertinoSwitch(options)`, `CupertinoTextField(options)` | 각각 축소 positional 생성자, v2 EditingController | 기존 options·theme/focus/input/selection·상태 전이 |
| `ScrollController`, `TextEditingController`, `RenderObject` | 같은 공개 이름의 대응 항목 없음 | 기존 동기 조회/변경·listener/undo/composition·subclass hook 계약 |

근거: [기존 Widget/context](Nelyx/src/framework/widgets/framework.ts), [기존 GlobalKey](Nelyx/src/framework/widgets/global-key.ts), [기존 layout Widget](Nelyx/src/framework/widgets/basic.ts), [기존 scroll](Nelyx/src/framework/widgets/scroll.ts), [기존 editing](Nelyx/src/framework/widgets/editable-text.ts), [v2 Widget](Nelyx/runtime/engine-client/widgets.ts), [v2 composition](Nelyx/runtime/engine-client/composition.ts), [Material v2](packages/material/src/v2.ts), [Cupertino v2](packages/cupertino/src/v2.ts).

일반 runner의 resolver는 값 API 허용 범위를 제외한 기존 Widget/SDK import를 **빌드 시 거부**한다. 예를 들어 기존 `@nelyx/core/framework/widgets/basic`의 `Text`는 그대로 v2로 연결되지 않는다. Core source/dist를 직접 참조해 구 구현을 섞는 경로도 graph 검사로 거부한다. 명시적 실패 정책이 구현되어 있지만, 기존 공개 import 호환은 아직 제공하지 않는다.

### 4.3 현재 gate 자체의 한계

1. **동일 이름의 후보와 비교한다.** 원래 module의 symbol을 단일 v2 aggregate의 같은 이름에 대응시킨다. 다른 이름으로 같은 기능이 있는지, 같은 이름이 다른 역할인지, 원래 import에서 실제로 호출되는지는 이 비교만으로 판단할 수 없다. SDK의 기존 export도 `/engine-v2`에 없으면 missing이므로, 268건 모두가 기능 부재라고 단정하지 않고 의미별 대응을 작성해야 한다.
2. **선언 문자열을 비교한다.** Constructor/call/type과 공개 static/instance member를 JSON으로 비교한다. 타입의 대입 호환성, 기본값, 예외, 호출 순서, listener/State 수명, 비동기 terminal, 실제 그리기/입력 결과를 판정하지 않는다. Protected hook은 member 비교에서 빠져 있어 subclass 호환도 입증하지 못한다.
3. **원본 재사용은 허용 설정으로 판정한다.** 재사용 항목의 replacement에는 original을 대입한다. Audit 단독으로 실제 module 해석·의존 graph·기존 앱의 동작 보존을 검증하지 않는다.
4. **성공 조건에 이식된 새 구현을 승인하는 경로가 없다.** 현재 `compatible`은 모든 항목이 `canonicalDataReuse`일 때만 true다. 동작 증거를 가진 이식 구현의 승인 상태가 없고, signature가 일치해도 `signatureMatchBehaviorUnverified`로 남는다. 이 조건을 단순히 느슨하게 바꾸어서는 안 된다.
5. **입력의 유효성 검사도 보완해야 한다.** TS 진단을 합격 조건에 쓰지 않으며, 선언의 source/module을 읽지 못하면 빈 export로 처리한다. 이번 entry 파일은 모두 존재했지만, 향후 누락/해석 실패가 조용히 항목 수 감소로 바뀌지 않도록 오류 시 실패해야 한다.

현재 FAIL은 실제 생성자 차이·API 누락과도 일치한다. 다만 **현행 audit를 그대로 전체 API 동작 호환의 최종 합격 장치로 사용할 수는 없다.** 원래 module/symbol/overload·타입/protected hook·실제 import route·동작 사례를 대응시키고, 미구현과 미검증을 모두 실패 상태로 유지하는 gate가 필요하다. 대상 목록 축소, signature 일치, 이름 alias만으로 성공시키지 않는다.

## 5. 남은 구현 작업

아래는 우선순위를 붙인 후속 작업이며 이번 문서 작성에서 구현한 항목이 아니다. 현재 public export에는 `internal`이라는 이름의 subpath도 있으므로, 이름만 보고 전체 공개 API 범위에서 제외하지 않는다.

| 우선순위 | 작업 | 종료 조건 |
| --- | --- | --- |
| P0 | 원래 export/overload와 v2 구현/route/동작 사례의 대응, gate 입력 검사, 실제 경로 counter, 복합 종료 오류 처리 | 누락·미검증을 숨기지 않고 원래 API에서 성공 근거를 추적할 수 있음 |
| P1 | Widget/Element/State/GlobalKey/BuildContext/Inherited/parent-data의 기존 계약·생성자 | 원래 import와 호출로 일반 소비자가 타입 검사·실행하며 업데이트/이동/해제/예외 의미를 보존 |
| P2 | Layout/scroll/gesture/motion/editing/rich text/font/locale/paint·custom hook | 원래 API의 제약·동기 읽기/쓰기·listener·revision·hit/clip·cancel/terminal을 같은 조건으로 비교 |
| P3 | Material/Cupertino의 전체 theme/icon/control/form/route/overlay, SDK app/service/platform API | 기존 options/defaults/상태/입력/semantics를 의미별로 구현하고 미지원 host도 연결 |
| P4 | 일반 runner의 남은 platform·generation reload, 전체 package의 archive 소비, 예산/실패/회수 | 대상 platform 실행과 디자인 package를 포함한 실제 생성·설치·종료를 검증 |
| P5 | 전체 통합·물리 입력/display·성능 | 아래 §8의 gate를 개별 판정하고 미관측을 합격으로 바꾸지 않음 |

특히 [2부 §13.1](work8-2.md#131-보존할-경험과-바꿀-계약)의 초기 설계에는 동기 `pixels`/editing/geometry를 비동기 command와 snapshot으로 바꾸는 안이 있다. **현재 사용자 조건은 기존 동작 호환이므로 이 변경안을 그대로 호환으로 셀 수 없다.** App의 동기 상태와 engine 권위 상태의 정합성, ACK 전후 읽기/쓰기, 실패/취소·재진입을 API별로 구현·검증해야 한다.

RenderObject의 임의 동기 subclass도 유한 크기 경계를 둔 것만으로 완료할 수 없다. 표준 node 변환, 정적 engine 확장, 명시적 App 경계로 원래 계약을 어디까지 보존하는지 결정하고 보장하지 못한 항목은 미완료로 남긴다.

## 6. 검증 증거를 보완해야 하는 부분

### 6.1 `fallbacks=0`은 현재 독립적인 실행 계측이 아니다

[WidgetHost](Nelyx/runtime/engine-client/widgets.ts)의 `counters.fallbacks`는 0으로 초기화되고 현재 engine-client 내에 증가 지점이 없다. [SDK app-ready](Nelyx/sdk/src/runtime/engine-v2-app.ts), [Testbed](sample/nelyx-testbed-app-2/src/v2-app.ts), [Native stats](Nelyx/engine/platform/windows/host.cpp)도 0을 직접 보고한다. [Host 검사](Nelyx/engine/tests/hosts.test.mjs)는 이 값을 0과 비교한다.

미이식 import의 명시적 거부와 SDK/C++ 명령 수 일치는 별도의 유효한 증거다. 하지만 이 0만으로 TS layout/paint 등의 실행 횟수·이유를 독립 관측할 수는 없다. [리포지토리 지침](.github/copilot-instructions.md)의 C++ 성능 조건을 만족하려면 실제 선택/실행 경계에서 경로·fallback 유무와 이유를 집계하고, 비0도 검출하는 대조 사례가 필요하다. 현재 C++ 성능 효과를 인정하지 않는다.

### 6.2 Archive 소비자 검사의 범위는 제한적이다

[Archive 검사](Nelyx/engine/tests/runner.test.mjs)는 Core/SDK/CLI/Metro/Static AOT를 pack하고 원래 CLI create → 실제 npm install → 타입 검사 → **설치된 CLI** build/pack → portable Web plain 게시·close를 실행한다. Core/SDK의 대표 installed JS와 원본 dist 일치, Core가 symlink가 아니라는 점도 확인한다.

이 사례에서는 Material/Cupertino를 pack하지 않고 design 선택 없는 생성 초기 앱을 쓴다. 타입 검사 실행 파일도 **저장소의 TypeScript**다. Material/Cupertino를 사용하는 Windows/두 Web 일반 앱 검사는 junction 소비자다. 따라서 두 디자인의 실제 archive 설치, 전체 공개 API, 독립 환경의 TypeScript 해석, 설치본의 Windows/isolated 전체 조합까지 검증한 것으로 확대하면 안 된다. CLI의 Metro/Static AOT 의존성도 남아 있다.

### 6.3 여러 종료 처리가 함께 실패하는 경우

SDK bootstrap은 `definition.dispose()`의 finally에서 `widgets.close()`, 다시 finally에서 `client.abort()`를 await한다. WidgetHost close와 transport close도 throw할 수 있으므로 **App dispose와 cleanup이 함께 실패하면 뒤의 오류가 앞의 오류를 대체할 수 있다.** 현재 runner 회귀가 주입하는 것은 주로 App dispose 자체의 예외이며, 복합 cleanup 실패의 원인 보존은 별도 검증이 필요하다.

소스에서 확인한 미검증 경로이며 이번에 runtime 재현·수정하지 않았다. 원래 오류와 cleanup 오류의 집계/우선순위, 중복 close의 단일 terminal, 끝까지의 회수를 함께 확인해야 한다.

## 7. npm 비정상 종료 재검토

### 7.1 관측 사실과 진단의 한계

아래는 **직전 구현 작업의 관측 기록**을 정리한 것이다. 이번에 npm install이나 runner suite를 재실행해 새로 발생시킨 결과가 아니다.

| 구분 | 사실 |
| --- | --- |
| 비정상 종료 | Archive 소비자의 `npm install` 자식 프로세스가 **두 번**, status **3221226505 = 0xC0000409**, stdout/stderr 없이 종료 |
| 발생 구간 | Archive 단독 재확인 한 번, `npm.cmd run test:engine-v2:runner` 전체 실행의 archive 사례 한 번. 후자는 앞선 7개 사례 통과 |
| 자식 실행 | `process.execPath`로 `npm-cli.js` 실행. 인자는 `install --ignore-scripts --no-audit --no-fund --prefer-offline --workspaces=false` |
| npm entry 표기 | 한 번은 `C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js`, 다른 한 번은 부모 `npm_execpath`의 `C:\Users\parti\AppData\Local\nvm\v24.15.0\node_modules\npm\bin\npm-cli.js`. 표기 차이만으로 다른 실체나 원인이라고 할 수 없음 |
| 단독 통과 | Archive 사례만 직접 `node --test`로 실행해 통과한 경우도 있음. 항상 실패하는 상태는 아니었음 |
| OS 진단 | 당시 직전 12분 Application event 1000/1001의 node.exe 조회에 일치 결과 없음. Crash dump, fault module, fast-fail parameter, stack 미확보 |
| 메모리 상황 | 당시 한 시점의 가용 물리 메모리 **2,615,640 KiB / 전체 32,812,620 KiB**. OOM 원인 확정 증거는 아님 |
| 별도 검사 결함 | 초기 archive 검사의 `typescript/bin/tsc` 경로 부재는 `lib/tsc.js`로 수정. npm의 0xC0000409와는 별개 |

Microsoft는 사용자 모드 fast-fail 예외 코드로 0xC0000409를 설명하고 첫 예외 parameter에 실패 종류가 담긴다고 명시한다. 이번에는 그 parameter와 stack을 확보하지 않았으므로 코드만으로 stack buffer 손상, Node/npm의 특정 결함, 자원 부족을 확정할 수 없다. [Microsoft Learn: __fastfail](https://learn.microsoft.com/en-us/cpp/intrinsics/fastfail?view=msvc-170)

Engine session의 384 MiB ledger는 npm 설치 프로세스를 측정·제어하지 않는다. 이 종료를 engine 예산 초과와 연결할 근거도 없다.

### 7.2 이미 적용한 대책과 통과 기록

대책은 [runner 테스트 fixture](Nelyx/engine/tests/runner.test.mjs)에 있으며 Node/npm 자체를 수정한 것은 아니다.

| 대책 | 현재 내용 |
| --- | --- |
| 외부 소비자의 환경 분리 | 부모 env 복사본에서 `npm_*` 중 비 `npm_config_*` 제거. 추가로 `npm_config_local_prefix/workspace/workspaces/node_gyp`, `INIT_CWD`, `NODE_TEST_CONTEXT`, `NODE_CHANNEL_FD`, `NODE_CHANNEL_SERIALIZATION_MODE` 제거 |
| 유지하는 설정 | Registry/auth/cache 등의 npm config를 모두 버리는 처리가 아님. 환경 값·자격 증명은 문서/로그에 출력하지 않음 |
| 적용 대상 | Archive의 pack/create/install/tsc/설치 CLI 자식 명령에 동일한 분리 env 전달. npm entry는 분리 전 `npm_execpath` 또는 fallback으로 선택 |
| Compiler 수명 | 각 junction 소비자의 finally에서 esbuild `stop()` 실행. 다음 소비자까지 compiler를 계속 보유하지 않음 |
| 임시 자원 | 소비자/archives/browser/server를 finally에서 종료·삭제. 이전 archive/독립 설치본/로그를 보관하지 않음 |

두 조건을 함께 바꾼 뒤 **일반 명령 `npm.cmd run test:engine-v2:runner` 전체 8/8이 한 번 통과**했다. 당시 전체 약 60초, archive 약 38초 기록이 있다. 환경 분리·compiler 수명·시간 경과/자원 상태 중 어느 조건이 영향을 주었는지 분리한 대조 실험은 하지 않았다.

정확한 상태는 **“fixture 환경 보완 후 최종 suite 통과, npm 비정상 종료 원인은 미확정”**이다. npm 결함 해결, 재발 방지 보장, 메모리 부족이 원인이라는 판정은 할 수 없다. 두 번의 실패를 마지막 통과로 취소하지 않는다.

### 7.3 재발할 경우의 한정된 조사

1. 현재 source/supply 확인 뒤 일반 전체 suite를 한 번, 필요하면 같은 archive 사례를 단독으로 한 번 실행해 부모 실행 경로를 구분한다. 테스트 timeout은 지침의 **20분**을 유지한다.
2. 자식 Node/npm의 real path·version·cwd·status/signal·stdout/stderr 유무와 당시 메모리 상황을 확인한다. Env는 필요한 key의 존재만 비교하고 값이나 token을 출력하지 않는다.
3. 재현될 때만 compiler 종료 조건을 고정한 env 비교, env를 고정한 compiler 수명 비교를 각각 한 번 수행한다. 한 번에 여러 조건을 바꾸지 않고 전체 시도도 소수로 제한한다. 모든 조건에서 소유 process와 임시 자원은 finally로 회수한다.
4. 같은 status가 재발하면 사용 가능한 WER/Event/임시 debugger로 예외 parameter·fault module·stack을 확인한다. 확보하지 못하면 원인 미확정으로 남긴다. 이 문서에서 상시 dump 설정이나 이력 수집을 자동 활성화하지 않는다.
5. 근거가 생긴 뒤에만 Node/npm 버전·실행/fixture 변경을 하나씩 검증한다. Cache 전체 삭제나 의존 버전의 무차별 갱신을 첫 대책으로 삼지 않는다. 조사물은 한 실행의 임시 영역에서 다루고 종료 시 삭제해 본문에는 짧은 결론만 갱신한다.

## 8. 완료 gate

| Gate | 현재 판정 | 합격에 필요한 증거 |
| --- | --- | --- |
| 기존 public API 표면 | **FAIL** | 원래 subpath·전체 overload/member/protected 확장점 대응, 기존 호출 타입 검사. 누락/해석 실패를 빈 항목으로 통과시키지 않음 |
| 기존 public API 동작 | **미완료** | Defaults·예외·State/Key/context·입력/그리기·동기/비동기·listener/terminal의 의미를 일반 소비자에서 비교 |
| 일반 runner/배포 | **Windows/Web 구간 통과, 전체 PARTIAL** | 남은 platform/reload, design을 포함한 archive 소비, 기존 API 실행, 손상/불일치/실패 뒤 회수 |
| 그래픽 | **구간 통과 / PARTIAL** | Native/두 Web의 pixel/input/clip/effect·custom hook·실패/교체/종료 공통 corpus |
| 메모리 | **구간 통과 / PARTIAL** | 미계측 owner/heap의 정책과 한계, 부하/교체/실패/종료 집계. 예약·관측·물리 peak 구분 |
| npm 안정성 | **보완 후 8/8 기존 기록, 원인 미확정** | 필요시 소수 대조 재현과 실패 지점의 근거. 재현하지 못하면 원인 해결 대신 미확정 유지 |
| Native 성능·물리 입력/display | **notVerified / false** | 실제 경로 counter와 동일 조건 측정, 일반 실행·실기기의 조작/display 관측. SwiftShader나 첫 frame으로 대체하지 않음 |

이번 작업의 실행 범위는 API audit와 입력/공급 파일 읽기·hash 확인, 문서 링크·공백 검사다. 이후 구현을 재개할 때는 현재 공개 패키지와 engine을 다시 빌드하고 필요한 contract/host/runner/geometry/타입/소유권 검사를 실행해 각 gate를 따로 갱신한다.
