# 스크롤 잔끊김 개선 — 프레임 통지 축소와 변경분 중심의 화면 갱신

작성: **2026-11-03 KST** · 상태: **PLAN_READY / 구현·새 성능 측정 전**

**새 방향은 스크롤 한 프레임을 준비하는 데 필요한 작업 자체를 줄이는 것이다.** Windows의 반복 frame-status 전송을 먼저 줄이고, 표준 viewport에서 내용은 그대로이고 위치만 바뀔 때 기존 recording과 변환 위치를 직접 연결하는 경로를 만든다. C++로 계산을 옮긴 뒤 매번 TS에서 전체 입력을 준비하고 결과를 복원하는 방식의 반복은 피한다.

현재 후속 계획·진행·채택/철회·잔여 작업은 **work4.md**에서 관리한다. [work3.md §12](work3.md#12-e0e4-실행-상태--2026-11-0203-kst)는 이전 구현·평가의 종료 기록으로 보존하며 C0~E4를 다시 실행하지 않는다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 제품 `PARTIAL`을 이어받는다. 문서 작성과 구현 완료, 기능 회귀 통과, 일반 사용 성능 수락은 각각 구분한다.

## 1. work3 이후에도 문제가 남는 이유

### 1.1 확인된 결과와 아직 모르는 것

| 근거 | 해석과 이번 계획에 주는 의미 |
| --- | --- |
| work3 §12.2의 최종 일반 제품: mixed 평균 **49.430 surface FPS**, Gallery 좌/우열 **58.254 / 57.260** | 입력·일반 최대화 시각 회귀가 통과해도 지속 60fps는 미달이다. 이 값은 이전 실행의 기록이며 이번 작성 중 재측정하지 않았다 |
| 일반 최대화 Gallery의 maximum primary pixel gap **54.856~97.871ms** | 350ms의 시각 생존 검사 통과는 잔끊김 해소를 판정하기에 부족하다. 평균 FPS와 연속 갱신 간격을 함께 봐야 한다. pixel gap을 개별 native frame 시간으로 바꾸지 않는다 |
| work3 §10.1의 Path/paint 평균 변화 **+1.28 / +1.95%**, Scene/Semantics **-2.38 / -4.45%** | 당시 제품·조건의 비교다. C++ 실행 여부나 kernel 속도로 전체 경로의 이득을 보장할 수 없다. 후보 기본 비활성화를 유지한다 |
| work3 §10 D3는 매 frame TS source lookup이 남고, D4는 endpoint마다 추출·호출·반영 | 처리 언어를 바꿔도 반복 방문·준비·경계 왕복이 남는다. 새 경로는 생산 지점에서 변경 정보를 유지해야 한다 |
| 이전 RNW 진단의 owned callback p95 **35.489ms**, native worker completion wait 중앙값 **5.381ms**인 별도 실행 | 서로 다른 실행·겹칠 수 있는 wall 구간이다. 더해서 프레임 예산을 계산하지 않는다. JS 반복 작업과 native 병목을 모두 열어 둔다 |
| 사용자 보고: work3 적용 뒤에도 자잘한 버벅임 지속 | 기능·생존 통과를 체감 해결로 올리지 않는다. warm 일반 스크롤·hover·focus의 지속 저하부터 다룬다 |

mixed 49.430fps의 평균 갱신 간격은 약 20.23ms다. 60fps의 16.67ms와 약 3.56ms 차이가 있지만, 이것은 **end-to-end 평균 간격의 차이**다. 특정 CPU 함수에서 3.56ms를 줄이면 해결된다는 예산표로 사용하지 않는다. 이번 후보의 이득과 병목 이동은 실제 일반 제품에서 확인한다.

work3에서 최대화 Gallery의 약 1초 정지 일부는 맨 위에서 위쪽 입력을 보내던 끝점 대기로 분리했다. 이번에도 **실제로 움직이는 구간과 끝점 대기·입력 준비·cold 생성 구간을 구분**한다. 측정 구간을 짧게 자르거나 느린 구간을 임의로 제외해 성능을 올리지 않는다.

### 1.2 작성 시 현재 상태 대조

작성 착수 HEAD는 `858482994e92260989a34bb651f0d7dd4b353ad2`이며 작업 트리는 clean이었다. 현재 locator가 가리키는 Release 제품에서 manifest·EXE·bytecode 파일 SHA-256을 직접 읽어 work3 §12.3과 일치함을 확인했다.

| 항목 | 현재 읽은 값 |
| --- | --- |
| manifest SHA-256 | `ae084a4b50ae9d102f77a977b32503d163dedaddfa643c869232afa3fbc7d1eb` |
| EXE SHA-256 | `4c3b24d0b8f170471746dd053870cfa6b74497b1bccb78169bcc140ee56e75e0` |
| bytecode SHA-256 | `f014f968574874cc4e21f49d5efa8498f8bdeaf6d2eec1db8790177dec8e5e18` |
| manifest의 native / SDK inputs | `32d160b77d22012fc10fb6a478391a9435cdf1d494413500a32a2d571ad21777` / `b2713a79bc2c76005676b58a55470adc8e2737786fde2bf79ae7b9e797893548` |
| mode | Hermes **bytecode / optimized / Release** |

이번에는 소스와 문서·위 세 파일의 식별만 조사했다. package 전체 inventory, source/dist/설치본 일치 검사, 제품 실행·입력·성능 검사를 새로 수행한 결과가 아니다. 구현 시작 시 최신 dirty state와 전체 공급 식별을 다시 대조한다.

## 2. 현재 소스에서 찾은 새 출발점

| 현재 코드 | 이미 있는 동작 | 남은 작업과 새 후보 |
| --- | --- | --- |
| [Windows SkiaView](Nelyx/skia/packages/rn/native/windows/SkiaView.h)의 `setPresented` → `emit` | 실제 surface 갱신 때 native `frames`를 올리고 매번 `emit("frame", "")` 수행 | 매 frame 전체 `JSValueObject`를 구성하고 Fabric `windowsSurfaceStatus`를 보낸다. 일반 소유 surface가 첫 콘텐츠 이후에도 이 통지를 계속 필요로 하는지 분리한다 |
| [Windows native-surface adapter](Nelyx/sdk/src/platforms/windows/native-surface.ts)의 `phase === 'frame'` | owner/세대가 맞으면 `firstContentReady`만 부르고 반환 | 일반 adapter는 반복 frame 통지에서 metrics를 갱신하거나 다음 frame을 요청하지 않는다. 상위 알림은 이미 멱등적이다. **매번 React 재렌더가 난다는 근거는 없다**. 줄일 대상은 native payload·전송·JS handler 호출이다 |
| [SkiaGraphiteView](Nelyx/skia/packages/rn/src/views/SkiaGraphiteView.tsx), [Windows Fabric metadata](Nelyx/skia/packages/rn/src/specs/SkiaViewNativeComponent.windows.ts) | JS ref가 마지막 상태와 bound 상태를 보관하고 공개 status callback으로 전달 | 공개 소비자가 매 frame callback을 사용할 수 있으므로 모든 소비자의 통지를 일괄 삭제하지 않는다. SDK 소유 surface의 별도 모드와 capability를 설계한다 |
| [FrameworkRoot](Nelyx/src/framework/widgets/root.ts)의 `recordPaint` | 매 요청 frame에서 `render.paint` 후 compose·입력 geometry·semantics·capture 진행 | 표준 순수 스크롤에도 어디까지 paint 명령을 재생성하는지 세어야 한다. 단순히 root paint 전체를 건너뛰는 최적화는 재도입하지 않는다 |
| [PaintingContext](Nelyx/src/framework/painting/context.ts)의 `composeInto` | 기존 명령·구조를 비교하고 transform만 다르면 `_replaceTransforms`로 재사용 | **변환 교체는 이미 구현돼 있다.** 새 명령을 모두 만든 뒤 비교·검색하는 비용을 앞단의 명시적 변경 연결로 줄이는 것이 새 작업이다 |
| [RepaintBoundary](Nelyx/src/framework/rendering/repaint-boundary.ts), [Layer](Nelyx/src/framework/rendering/layer.ts), [Scene](Nelyx/src/ui/scene.ts) | 정적인 내용 recording·nested boundary·EngineLayer·native Picture 재사용 | 같은 내용을 다시 캐시하는 계층을 추가하지 않는다. 새 metadata는 기존 recording/Layer를 가리키는 위치·수정 정보만 가진다 |
| [RenderObject](Nelyx/src/framework/rendering/object.ts)의 `commitTextInputGeometries` | 빈 subtree 생략, commit 안의 공유 조상 transform cache, commit/discard scope 존재 | 현재 commit마다 방문·Map·projection 준비가 반복된다. **frame 간에 유효한 local geometry와 조상 연결만** 재사용하는 후보를 별도 비교한다 |
| [SurfaceFrameClock](Nelyx/sdk/src/runtime/frame-clock.ts), [RNW host](Nelyx/skia/packages/rn/native/windows/RNSkWindowsHost.h) | frame 요청과 retirement poll 요청이 있고 native는 callback들을 같은 tick batch로 전달 | callback 두 종류가 있다고 compositor 대기나 `invokeAsync`가 두 배라고 계산하지 않는다. 불필요한 callback·빈 poll의 기여가 측정될 때만 합친다 |

이 표는 **소스의 작업 존재**를 확인한 것이다. 어느 항목이 현재 잔끊김의 주원인인지, 제거하면 얼마가 빨라지는지는 아직 측정하지 않았다.

## 3. 새 방식의 핵심 계약

### 3.1 순수 스크롤에서 기존 내용과 이동값을 분리

표준 viewport의 frame을 다음 세 종류로 구분한다. 이 구분은 TS의 실제 layout·상태 변화에서 생성하며 native가 독립적으로 추측하지 않는다.

| 변화 | 다음 frame에서 하는 일 |
| --- | --- |
| 자식 membership·내용·local geometry는 같고 paint offset만 변경 | TS layout은 정상 수행한다. 기존 내용 recording을 재사용하고 이미 연결한 변환 위치만 현재 offset으로 갱신한다. 현재 좌표의 입력 geometry·semantics와 새 frame capture·submit은 계속 수행한다 |
| hover/pressed/caret/value 등 일부 내용 변경 | 실제 무효화된 기존 boundary/segment를 갱신한다. 같은 frame에 이동값도 반영하고 정적인 형제의 내용 recording을 유지한다 |
| 자식 구성·크기·clip 방식·효과·DPI·owner/세대 변경 또는 지원하지 않는 custom 동작 | 필요한 범위를 기존 paint/compose 경로로 재구축하고 변경 연결을 다시 만든다. 구조 변경을 transform update로 덮지 않는다 |

현재 sliver layout은 가시성·extent·hit-test·최대 범위·조상 좌표를 계산한다. **layout을 건너뛰거나 native만 먼저 스크롤시키지 않는다.** 같은 TS scroll offset을 painting·hit-test·IME·semantics가 사용한다. 첫 적용 대상은 `RenderViewportBase`와 `RenderSliverToBoxAdapter`의 표준 연결이다. 일반 sliver·사용자 paint 전체를 한 번에 바꾸지 않는다.

### 3.2 기록이 만들어질 때 변경 위치를 연결

1. 기존 recording을 만들 때 framework 소유 transform 명령의 위치와 그 위치를 갱신하는 viewport/parent-data owner를 연결한다. 원래 명령의 순서·save/restore·clip 경계를 보존한다. 매 frame 전체 명령을 비교해서 해당 위치를 다시 찾지 않는다.
2. layout/paint 무효화의 생산 지점에서 **구조 변경, 내용 변경, 위치 변경**을 기록한다. 기존 `paintVersion`·`paintContentsVersion`의 의미를 유지하고, 필요한 추가 revision은 소유자의 private 상태로 둔다. 전역 paint version 하나만 보고 모든 재사용을 무효화하거나 모든 작업을 생략하지 않는다.
3. 새 frame에는 변경한 변환·새로 그린 segment만 처리하되, 기존 immutable recording과 resource hold에서 독립적인 frame snapshot을 만든다. GPU/native에 제출한 과거 snapshot의 변환을 뒤에서 수정하지 않는다.
4. 실패·재진입·paint 중 무효화·stale frame이면 새 변경을 commit하지 않는다. 기존 유효 상태와 submitted frame의 lease를 보존한다. 다음 frame의 dirty를 이번 frame의 성공으로 지우지 않는다.
5. framework가 소유한 캡슐화된 상태·검증 가능한 무효화 경로만 사용한다. `instanceof`, `Object.freeze`, 사용자 hook이 바뀌지 않을 것이라는 가정만으로 공개 paint/visitor를 생략하지 않는다. custom paint·getter·prototype 교체·동적 child 방문의 호출 순서/횟수/예외는 기존 경로로 보존한다.
6. 지원을 증명하느라 매 frame 같은 전체 트리·descriptor·명령을 다시 스캔하면 목표를 달성한 것으로 보지 않는다. 안전하게 줄일 수 없는 경로는 기존 구현을 유지하고 실제 적용률·남은 방문 수를 보고한다.

이는 work2의 dirty paint/Gallery 분할 묶음이나 전체 Column 캐시의 복원이 아니다. **새 sample boundary·분할·영구 keep-alive를 추가하지 않고, 기존 엔진 recording을 생성할 때 변경 위치까지 연결**한다. work3의 C++ Scene 합성도 기본 활성화하지 않는다.

### 3.3 입력·공개·메모리

- 프레임 요청은 유지한다. 재사용은 recording과 계산 결과에 적용하며, animation·explicit redraw·persistent callback·capture·submit을 admission 결과만으로 취소하지 않는다. `present='unobserved'`는 display receipt가 아니다.
- `geometryCommit.commit()/discard()`와 semantics publication 순서를 유지한다. frame token·owner·layout/paint·viewport/renderer/context/surface 세대·scale이 맞는 결과만 공개한다. GPU busy·0-size에서도 기존 forced geometry 질의를 처리한다.
- 화면 밖 편집기의 State·controller·selection·focus/connection 수명과 native surface 철회/복귀를 보존한다. 보이지 않는 editor를 등록 목록에서 영구 제거하거나 활성 editor 하나만 처리하지 않는다.
- Picture **64-entry / 32MiB**, optional child **16 / Element 2,048**, Gallery capacity **2**, CPU pending **1**·native recording **2**를 유지한다. status queue·recording slots·GPU budget도 성능을 위해 늘리지 않는다.
- 새 metadata는 해당 live recording/viewport/editor가 소유하며 detach·재부모화·dispose·context 교체 때 해제한다. 중복 전체 tree mirror·새 GPU raster cache·별도 native scroll 상태를 만들지 않는다. 수량·peak bytes·구조 변경 뒤 회수·close 뒤 0을 확인한다.

## 4. 실행 단계

순서는 **W4-0 → W4-1 → W4-2 → 필요한 W4-3/W4-4 → W4-5**다. 각 후보는 하나씩 적용·공급·비교한다. 작은 후보도 성능 비교 전에는 `IMPLEMENTED / NOT_YET_ADOPTED`로 표시한다. 기존 경로가 60fps를 충족하면 더 큰 구조 변경은 비진입으로 종료할 수 있다.

### W4-0. 같은 제품에서 갱신 공백을 귀속

대상: [RNW probe](Nelyx/eng/tests/rnw-frame-probe.js), [FrameDiagnostics](Nelyx/src/ui/frame-diagnostics.ts), [motion 실행기](Nelyx/eng/run-rnw-motion-probe.mjs), [OS wheel helper](Nelyx/eng/tests/windows-continuous-scroll.ps1).

- [ ] 사용자 일반 명령으로 현재 문제 장면을 확인한다. 같은 최대화 조건의 mixed no-hover/button-hover/field-focus와 Gallery 좌/우열을 구분한다. 재접촉·빠른 반전과 실제 전체 범위 왕복을 포함한다.
- [ ] 같은 identity/QPC로 native input → JS dispatch → owned callback → capture/submit → producer → surface 갱신을 연결한다. endpoint 대기·표본 덮어쓰기·관측 누락을 정지로 세지 않는다.
- [ ] 기존 bounded 계측에 **surface-status 생성/전달 수와 handler wall**, paint/compose의 **전체 방문·새 명령·transform 갱신·재사용 수**, geometry provider/조상 방문 수만 필요한 만큼 추가한다. native callback delivery·retirement poll·owned callback의 중첩/포함 관계를 표시한다.
- [ ] 진단은 대표 실행 1회에서 시작하고 불일치할 때만 추가한다. 1ms 내외 작업으로 전체 20ms대 경로를 설명하거나, 계측 아래에서만 느려진 장면을 일반 제품 성능으로 보고하지 않는다.
- [ ] source probe·상세 로그·GDI capture를 끈 일반 cadence 기준을 새 process mixed/Gallery 각 3회 확보한다. 현재 제품·조건이 동일한 기존 기준을 재사용할 수 있으면 이유를 적는다.

**종료 조건:** 지배적인 반복 작업과 관측 공백을 구분한 짧은 표, 동일 조건의 기준, 다음 후보의 구체적인 진입 사유가 있어야 한다. 개별 GC pause·독립 GPU 시간이 미관찰이라는 이유로 모든 작업을 막지 않는다. GC가 직접 관측되지 않으면 GC 원인으로 쓰지 않는다.

### W4-1. SDK 소유 Windows surface의 반복 frame-status 축소

**우선 구현할 작은 후보다.** native 갱신마다 만드는 전체 상태 payload와 호출을 source에서 제거할 수 있는지 단독으로 비교한다. JS handler 안에서 무시하는 것만으로 완료하지 않는다.

- [ ] 제안 API `windowsSurfaceStatusMode`의 `continuous` / `lifecycle` 계약과 capability/version을 확정한다. 공개 SkiaView 기본은 기존 continuous 동작을 유지하고, 새 SDK 소유 surface만 lifecycle을 명시한다. 실제 이름과 version 값은 이 단계에서 고정한다.
- [ ] lifecycle에서는 owner/backing 세대별 **첫 유효 surface 갱신과 실제 수명 전환**을 전달한다. layout/bound/unbound/visibility/resize 준비·완료/실패/종료를 누락하지 않는다. 새 emitter 연결·mode 교체 때 현재 준비 상태를 재전달해 첫 콘텐츠 대기가 영원히 남지 않게 한다.
- [ ] native `frames`·presented generation/size·resize coordinator·first-content 처리·`observeStatus`와 입력 surface 수명은 매번 필요한 대로 갱신한다. **Fabric payload 생성과 전송만** 선택적으로 줄인다. 현재 `notifyInputSurface`는 tuple 변화 때만 observer를 호출하므로 이를 매 frame 중복 통지 문제라고 다시 구현하지 않는다.
- [ ] 첫 frame이 현재 owner/세대인지 기존 strict 조건으로 확인한다. 오래된 frame, close 뒤 callback, hidden startup, minimize/restore, emitter 교체, resize 경합·오류를 검사한다. capability 없는 설치본을 새 mode 지원으로 오인하지 않는다.
- [ ] 갱신 counter와 기존 native trace는 유지해 status event 수 감소가 FPS 측정 자체를 낮추거나 위조하지 않게 한다. 성능 실행 중 별도 polling으로 제거한 통지를 다시 만들지 않는다.

대상은 [SkiaView.h](Nelyx/skia/packages/rn/native/windows/SkiaView.h), [view types](Nelyx/skia/packages/rn/src/views/types.ts), [Windows metadata](Nelyx/skia/packages/rn/src/specs/SkiaViewNativeComponent.windows.ts), [SkiaGraphiteView](Nelyx/skia/packages/rn/src/views/SkiaGraphiteView.tsx), [SDK native-surface](Nelyx/sdk/src/platforms/windows/native-surface.ts)다.

**판정:** native payload/handler 수와 비용의 감소, 정상 초기 표시·resize·오류·close를 먼저 확인한다. 일반 제품 3쌍 비교에서 실제 갱신과 입력 응답의 이득을 판단한다. 소폭 비용만 줄고 60fps 미달이면 해결로 선언하지 않는다. 기본 적용 여부는 별도 기록하고 W4-2의 기준 제품을 명시한다.

### W4-2. 표준 viewport의 변환 위치를 기존 recording에 직접 연결

**핵심 구조 후보다.** W4-0에서 warm paint/compose의 반복 명령 생성·비교가 유의한 기여일 때 구현한다. 이미 해당 비용이 작거나 기존 `_replaceTransforms`가 충분하면 비진입 이유를 적고 원인에 맞는 W4-3/W4-4로 간다.

- [ ] [viewport](Nelyx/src/framework/rendering/viewport.ts)·[sliver adapter](Nelyx/src/framework/rendering/sliver.ts)의 layout/paint 연결에서 순수 offset 변화와 내용/구조 변화를 분리한다. 기존 [RenderObject 무효화](Nelyx/src/framework/rendering/object.ts)·[RepaintBoundary](Nelyx/src/framework/rendering/repaint-boundary.ts)를 이용한다.
- [ ] [PaintingContext](Nelyx/src/framework/painting/context.ts)·[RecordedCompositionLayer](Nelyx/src/framework/painting/recorded-layer.ts)의 최초 recording 시 변환 위치를 연결한다. unchanged 구간의 명령 재생성·전체 `sameStructure`/transform 검색을 반복하지 않는 경로를 작은 표준 범위에 만든다. 새 internal API가 필요하면 공개 paint 동작과 분리하고 custom 경로는 유지한다.
- [ ] 하나의 명령 identity가 여러 위치에서 쓰이는 경우, compiled Picture 내부의 transform, clip/saveLayer/backdrop·perspective/singular transform은 현재 제약을 보존한다. 변경할 위치를 증명하지 못하면 기존 compose를 사용한다. 이동값을 Picture 안에 굽고 다시 compile하는 방식은 피한다.
- [ ] hover/press/caret/텍스트 변경과 scroll을 함께 주어 내용 갱신이 사라지지 않는지 확인한다. 두 Gallery 열의 변환·clip·hit-test를 독립 유지한다. lazy child 진입·퇴장·재부모화·DPI/resize 때 재구축과 resource retirement를 확인한다.
- [ ] 과거 submitted frame을 유지한 상태에서 다음 offset을 바꾸는 fixture로 snapshot 격리를 확인한다. paint 중 invalidate·재진입·capture 실패·빠른 close는 commit/discard·기존 lease 의미를 유지한다.
- [ ] 진단에서 적용률, 새로 그린 boundary, 만든 명령, 전체 비교 방문, transform 위치 갱신, JS 총 wall·native replay를 비교한다. 일부 노드를 native에 옮긴 수나 내부 fixture의 O(1) 결과를 제품 효과로 대신하지 않는다.

**판정:** 같은 eager mixed·Gallery에서 구조 변화가 없는 이동 동안 반복 준비가 실제 줄어야 한다. 현재 Picture/child 예산 안의 일반 제품 60fps와 입력·시각 정합성을 함께 확인한다. 일반 제품이 후퇴하거나 지원 판정/metadata 비용이 절감을 상쇄하면 후보 기본 연결을 철회한다.

### W4-3. 입력 geometry의 local 결과와 조상 연결 재사용 — 조건부

진입 조건은 W4-0/2에서 geometry 추출·투영·공개 준비가 계속 주요 기여로 남는 것이다. work3의 C++ 입력 geometry 기본 주입이나 work2의 재귀→반복문 후보를 복원하지 않는다.

- [ ] `coreEditingGeometry`의 local caret/selection/baseline 결과와 frame별 view 투영을 구분한다. text/selection/style/font/local layout revision이 같을 때 local 결과만 재사용한다. scroll 때 현재 조상 transform·clip·가시성을 적용한다.
- [ ] 표준 provider의 조상 연결과 무효화 정보는 attach/adopt/drop/layout·clip/transform 변경 지점에서 갱신한다. 등록 editor 수·조상 edge 수에 따라 보유하며 별도 전체 render tree 복제는 만들지 않는다. custom visitor·provider/getter·동적 hook은 기존 live 순회와 호출 프로토콜을 따른다.
- [ ] frame별 transaction scope와 현재 `paintVersion` 검증은 새로 만든다. 좌표가 같아도 새 token으로 읽는 경로, `didCommitTextInputGeometry` 순서·예외·discard 알림, 화면 밖 native surface 철회와 복귀를 유지한다.
- [ ] scratch 저장소를 재사용한다면 view별 예산·예외 정리·재진입 격리를 정의한다. 반환된 rect/array나 이전 scope가 참조하는 저장소를 다음 frame에서 덮어쓰지 않는다.

대상은 [object.ts](Nelyx/src/framework/rendering/object.ts), [root.ts](Nelyx/src/framework/widgets/root.ts), 필요할 때 기존 editor geometry 생산 경계다. semantics의 merge/order/action·publication 간격은 바꾸지 않는다. **geometry 절약을 위해 IME·접근성 갱신을 늦추지 않는다.**

**판정:** 방문·local geometry 재생성·준비 비용이 실제 줄고, mixed 전체 범위 왕복 뒤 재클릭 없는 입력·selection·한국어 조합·clear/undo가 유지돼야 한다. 숫자 결과가 같은 fixture만으로 제품 수락하지 않는다.

### W4-4. 남은 host callback 또는 native 대기 — 관찰한 원인만

| 진입 근거 | 허용할 다음 작업 | 경계 |
| --- | --- | --- |
| 같은 owner/tick의 frame callback과 retirement poll 사이에 빈 poll·불필요한 추가 callback 비용이 관측됨 | `createSurfaceFrameClock`의 underlying 요청을 공유하는 작은 후보를 단독 비교 | native host는 이미 callback을 batch한다. clock 정밀도·모니터 설정·credit/queue 수를 바꾸지 않는다. 새 요청은 다음 tick, 개별 취소·오류·다중 view 공정성·poll-only drain·close를 보존한다 |
| JS를 줄인 뒤에도 producer/completion→surface가 갱신 간격을 지배함 | 현재 frame identity에서 import/replay/submit/completion/publish를 분리하고 해당 중복 작업만 수정 | completion wait를 삭제하지 않는다. GPU 완료 전 공유 이미지를 소비하지 않고 allocator/cache/recording 예산을 확대하지 않는다. 독립 GPU 시간이 미관찰이면 원인을 단정하지 않는다 |
| 둘 다 주요 기여가 아님 | 비진입으로 기록하고 W4-0의 지배 구간을 재검토 | 사전에 준비한 최적화를 모두 구현하는 것을 완료 조건으로 삼지 않는다 |

대상은 [SurfaceFrameClock](Nelyx/sdk/src/runtime/frame-clock.ts), [RNW host](Nelyx/skia/packages/rn/native/windows/RNSkWindowsHost.h), [native renderer](Nelyx/skia/packages/native/src/renderer.ts), [Windows surface](Nelyx/skia/packages/rn/native/windows/CompositionSurface.h) 중 근거가 확인된 부분이다.

### W4-5. 일반 제품 최종 비교·정리

- [ ] 채택 후보만 남기고 source/dist/설치본·canonical/generated native·archive·최종 실행 제품을 대조한다. W4-1만 바꿨더라도 native 변경이면 현재 공급을 다시 빌드·설치한다. 진단 App은 원복하고 일반 명령으로 마지막 제품을 확인한다.
- [ ] §5의 전체 범위·warm 일반 사용과 기능/입력/시각 회귀를 통과한다. 최종 후보를 합칠 때 상호작용을 확인하고 개별 성과를 합산하지 않는다.
- [ ] 미채택 후보의 기본 연결과 임시 계측을 정리한다. 최종 상태·짧은 요약·미수락 원인·다음 시작점을 이 문서에 갱신한다. 실제 사용법이 바뀐 경우에만 기존 한/영 README를 수정한다.

## 5. 비교 방법과 수락 기준

### 5.1 장면과 입력

- **Hermes bytecode / optimized / Release**만 사용한다. 현재 RNW host·pinned runtime·compiler policy `windows-hermes-94aa5e1d-no-cfg-v1`을 유지한다. Static AOT 준비·빌드·실행·전용 성능 비교는 이번 범위에 넣지 않는다.
- 모니터 주사율·해상도·DPI·동적 주사율·adapter를 바꾸지 않는다. 이전 최대화는 **2560×1459 physical / DPI 192**, 주 디스플레이 보고 주사율 **165Hz**였다. 현재 설정을 읽어 기록하고 동일 조건끼리 비교한다. 새 60fps cap을 추가하지 않는다.
- mixed는 기존 **단일 eager Column, 편집기 12개·버튼 36개**를 유지한다. no-hover/button-hover/field-focus를 구분하고 **현재 `maxScrollExtent`의 맨 위↔맨 아래**를 왕복한다. 편도 약 4초의 일반 왕복과 warm 편도 약 1.5초의 빠른 왕복, 정지→시작→10초 이상 연속→반전→재접촉을 포함한다.
- OS packet-defined cadence는 원인 비교용으로 별도 기록할 수 있다. 이것만으로 전체 범위 수락을 대신하지 않는다. 전체 범위 검사는 준비 후 실제 시작·최종 위치와 양 끝 도달을 확인한다. FPS timed phase에 JS/UIA 질의를 반복해 입력을 pace하지 않고, endpoint 확인은 별도 기능 실행 또는 timed phase 밖에서 한다.
- Gallery는 실제 좌열 **X=0.4**, 우열 **X=2/3**에서 no-hover·button-hover·field-focus를 확인한다. 두 열·전체 범위 복귀·maximize/restore/maximize를 포함하고 cold/lazy 생성과 warm 지속 구간을 구분한다. 정적 sidebar를 움직임 표본으로 쓰지 않는다.
- 최종 FPS 측정은 source probe·상세 native diagnostics·GDI capture·다른 build/test 없이 수행한다. 별도 시각 실행에서 갱신 counter와 픽셀·실제 offset의 관계를 대조한다. 원시 결과는 합쳐 다른 실행의 receipt로 사용하지 않는다.

### 5.2 무엇을 보고 채택하는가

| 항목 | 판정 |
| --- | --- |
| warm 일반 사용 | 현재 모니터 설정에서 실제 화면 갱신 **지속 60fps 이상**. 방향·hover/focus별 느린 장면을 전체 평균으로 가리지 않는다. 기준/후보 새 process **3쌍**을 기본으로 같은 입력·창·공급 조건을 맞춘다 |
| 잔끊김 | 연속 surface 갱신 interval의 표본 수·중앙값/p95/p99/max와 **33.3/50ms 초과 횟수**를 진단값으로 비교한다. 이 숫자는 새 필수 수락 문턱이 아니다. 표본 누락과 counter jump를 실제 단일 frame 지연으로 세지 않는다 |
| 시각 생존 | 기존 **350ms** gate를 완화하지 않는다. 이것의 통과만으로 smoothness를 수락하지 않는다. 정적/끝점·미진행·잘못된 대상 입력을 구분한다 |
| cold/lazy | 최초 child 생성의 일시적 jitter는 허용하고 구간을 별도 표시한다. 생성이 끝난 뒤에도 지속되는 60fps 미만·입력 불응을 cold 예외로 처리하지 않는다 |
| 응답·정합성 | 입력 누락/중복, stale 좌표/semantics, 입력 후 상태 지연의 회귀, 수명·메모리·shutdown 오류가 없어야 한다. IME value ack 대기를 늘려 성능 통과로 만들지 않는다 |
| 관측 수준 | native surface counter는 **surface FPS**로 표기한다. submit/callback 수를 표시 FPS로 쓰지 않는다. scanout은 별도 `notVerified`이며 이번 일반 사용 수락의 추가 필수 gate로 늘리지 않는다 |
| 채택과 종료 | 유효한 작업량 감소도 일반 제품 비교 전에는 실험 후보다. 60fps에 못 미치면 남은 차이와 기본 적용 여부를 명시하고 제품 `PARTIAL`을 유지한다. 모든 p99 개선이나 모든 조건부 단계 구현을 종료 요건으로 요구하지 않는다 |

물리 트랙패드의 시작·연속·반전·재접촉과 물리 키보드 직접 한글 조합은 자동 OS 입력과 구별한다. 직접 확인할 수 없는 범위는 `notVerified`로 남기되, 추가 사용자 승인 대기를 자동화·구현 진행의 필수 단계로 만들지 않는다. `resizePerformanceAccepted=false`는 별도 resize 성능 검증 전까지 유지한다.

## 6. 검증과 공급

아래 명령은 **구현 뒤 필요한 변경 범위에 맞춰 선택**한다. 문서 작성 단계에서는 실행하지 않았다. source 검사가 dist를 소비하는 경우 해당 workspace를 먼저 빌드한다. 통과한 같은 검사를 이유 없이 다시 돌리지 않는다.

```powershell
# 사용자의 일반 실행 경로 — 착수 재현과 최종 확인
npm.cmd run run:windows --workspace @nelyx/testbed-2

# W4-1: surface 수명·첫 콘텐츠·입력 소유 회귀
npm.cmd run test:windows-input-service
npm.cmd run test:windows-input-surface

# W4-2: recording 재사용·변환·독립 snapshot·paint 중 무효화
npm.cmd run test:paint-recording
npm.cmd run test:native-paint-replay

# W4-3: 실제 변경한 geometry 계약과 입력 복귀
node --test --test-timeout=1200000 Nelyx/eng/tests/input-geometry-integration.test.mjs Nelyx/eng/tests/frame-visual-commit.test.mjs
npm.cmd run test:windows-mixed-input

# W4-4에서 clock을 변경한 경우에만 추가
node --test --test-timeout=1200000 Nelyx/eng/tests/react-native-frame-clock.test.mjs Nelyx/eng/tests/frame-backpressure.test.mjs Nelyx/eng/tests/runtime-close.test.mjs

# 최종 현재 제품: 기본 네 페이지·최대화 Gallery·정상 종료
npm.cmd run test:windows-continuous-scroll
npm.cmd run check:types
npm.cmd run check:package-boundaries
git diff --check
```

기존 [RNW frame 실행기](Nelyx/eng/run-rnw-frame-probe.mjs)·[motion 실행기](Nelyx/eng/run-rnw-motion-probe.mjs)의 bounded 관측과 finally 정리를 재사용한다. [run-scene-candidates](Nelyx/eng/run-scene-candidates.mjs)는 work3 SDK 주입 후보용이므로 새 lifecycle/변경분 후보를 이미 지원한다고 가정하지 않는다. 후보를 실행기에 추가한다면 명시적인 mode·제품 identity·실제 적용 확인을 갖추고 기본 후보를 잘못 켜지 않는다.

모든 테스트 timeout은 **20분(1,200,000ms)**으로 둔다. 대표 비교는 3쌍부터 시작하고 대부분의 반복은 **30회 이내**로 제한한다. 후보별로 모든 장면을 곱한 전수 반복 대신 지배 장면에서 선별한 뒤 필요한 최종 장면을 검사한다. native 오류·stale publish·미진행·비정상 종료를 재시도로 숨기지 않는다.

native/SDK 변경 뒤 canonical → generated → 현재 dist/archive → runner 설치본 → 최종 package manifest·EXE·bytecode·inputs를 연결한다. `.nelyx/windows/last-package.json`이 가리키는 현재 제품을 검증하고 다른 진단 제품을 일반 제품으로 실행하지 않는다. 공통 Core 변경이면 Web/Android fallback의 관련 회귀도 확인하며 runtime을 실행하지 않은 플랫폼은 검사 범위를 그대로 적는다.

[저장소 지침](.github/copilot-instructions.md)에 따라 임시 fixture·probe·staging·작업 소유 process는 성공/실패/중단의 finally에서 정리한다. 현재 dist/공급 제품만 남기고 검증 로그·receipt/checkpoint/history JSON·이전 archive·독립 소비자 설치본·browser profile을 누적하지 않는다. `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`를 만들거나 복구하지 않는다. 기존 사용자 소유 출력·앱·emulator는 정리 대상으로 삼지 않는다.

## 7. 착수·종료 상태

| 단계 | 현재 상태 | 완료할 때 남길 내용 |
| --- | --- | --- |
| W4-0 | **TODO** | 현재 공급·재현 장면·주요 반복 작업·유효 기준 |
| W4-1 | **TODO / 우선 후보** | native 통지 감소·회귀·일반 제품 비교·기본 적용 여부 |
| W4-2 | **TODO / 핵심 구조 후보** | 진입 근거·실제 적용률·준비 작업 감소·snapshot/입력 검증·채택/철회 |
| W4-3 | **CONDITIONAL** | geometry 기여·진입/비진입·local 재사용과 현재 좌표 정합성 |
| W4-4 | **CONDITIONAL** | 관측한 callback 또는 native 병목·단독 변경·채택/철회 |
| W4-5 | **TODO** | 최종 일반 제품 identity·60fps/기능 판정·정리·잔여 작업 |

**이번 작업은 새 방안 설계와 문서 작성까지다.** 제품 코드는 바꾸거나 앱을 다시 실행하지 않았다. 다음 구현 요청은 W4-0부터 시작한다. 입력 geometry·sceneBatch·sceneComposition·semanticsGeometry의 기존 opt-in은 계속 기본 비활성 상태에서 출발하며, 이 문서만으로 버벅임 해결·성능/resize 수락을 선언하지 않는다.
