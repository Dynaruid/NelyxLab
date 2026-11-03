# 스크롤 잔끊김 개선 — 프레임 통지 축소와 변경분 중심의 화면 갱신

작성: **2026-11-03 KST** · 상태: **Gallery 후속 비용 감소·평가 완료 / 오른쪽 열 소폭 개선·지속 60fps 미달 / 제품 PARTIAL · 구 공급 4개 정리 차단**

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

- [x] 사용자 일반 명령으로 현재 문제 장면을 확인한다. 같은 최대화 조건의 mixed no-hover/button-hover/field-focus와 Gallery 좌/우열을 구분한다. 재접촉·빠른 반전과 실제 전체 범위 왕복을 포함한다. **관측 범위:** 일반 명령의 배경·버튼 위치 스크롤과 편집기 포커스/입력 복귀, 별도 전체 범위 진단을 확인했다(§8.7). 모든 hover/focus 조합의 성능 수락은 확보하지 못했다.
- [x] 같은 identity/QPC로 native input → JS dispatch → owned callback → capture/submit → producer → surface 갱신을 연결한다. endpoint 대기·표본 덮어쓰기·관측 누락을 정지로 세지 않는다.
- [x] 기존 bounded 계측에 **surface-status 생성/전달 수와 handler wall**, paint/compose의 **전체 방문·새 명령·transform 갱신·재사용 수**, geometry provider/조상 방문 수만 필요한 만큼 추가한다. native callback delivery·retirement poll·owned callback의 중첩/포함 관계를 표시한다.
- [x] 진단은 대표 실행 1회에서 시작하고 불일치할 때만 추가한다. 1ms 내외 작업으로 전체 20ms대 경로를 설명하거나, 계측 아래에서만 느려진 장면을 일반 제품 성능으로 보고하지 않는다.
- [x] source probe·상세 로그·GDI capture를 끈 일반 cadence 기준을 새 process mixed/Gallery 각 3회 확보한다. 현재 제품·조건이 동일한 기존 기준을 재사용할 수 있으면 이유를 적는다.

**종료 조건:** 지배적인 반복 작업과 관측 공백을 구분한 짧은 표, 동일 조건의 기준, 다음 후보의 구체적인 진입 사유가 있어야 한다. 개별 GC pause·독립 GPU 시간이 미관찰이라는 이유로 모든 작업을 막지 않는다. GC가 직접 관측되지 않으면 GC 원인으로 쓰지 않는다.

### W4-1. SDK 소유 Windows surface의 반복 frame-status 축소

**우선 구현할 작은 후보다.** native 갱신마다 만드는 전체 상태 payload와 호출을 source에서 제거할 수 있는지 단독으로 비교한다. JS handler 안에서 무시하는 것만으로 완료하지 않는다.

- [x] 제안 API `windowsSurfaceStatusMode`의 `continuous` / `lifecycle` 계약과 capability/version을 확정한다. 공개 SkiaView 기본은 기존 continuous 동작을 유지하고, 새 SDK 소유 surface만 lifecycle을 명시한다. 실제 이름과 version 값은 이 단계에서 고정한다.
- [x] lifecycle에서는 owner/backing 세대별 **첫 유효 surface 갱신과 실제 수명 전환**을 전달한다. layout/bound/unbound/visibility/resize 준비·완료/실패/종료를 누락하지 않는다. 새 emitter 연결·mode 교체 때 현재 준비 상태를 재전달해 첫 콘텐츠 대기가 영원히 남지 않게 한다.
- [x] native `frames`·presented generation/size·resize coordinator·first-content 처리·`observeStatus`와 입력 surface 수명은 매번 필요한 대로 갱신한다. **Fabric payload 생성과 전송만** 선택적으로 줄인다. 현재 `notifyInputSurface`는 tuple 변화 때만 observer를 호출하므로 이를 매 frame 중복 통지 문제라고 다시 구현하지 않는다.
- [x] 첫 frame이 현재 owner/세대인지 기존 strict 조건으로 확인한다. 오래된 frame, close 뒤 callback, hidden startup, minimize/restore, emitter 교체, resize 경합·오류를 검사한다. capability 없는 설치본을 새 mode 지원으로 오인하지 않는다.
- [x] 갱신 counter와 기존 native trace는 유지해 status event 수 감소가 FPS 측정 자체를 낮추거나 위조하지 않게 한다. 성능 실행 중 별도 polling으로 제거한 통지를 다시 만들지 않는다.

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

- [x] 채택 후보만 남기고 source/dist/설치본·canonical/generated native·archive·최종 실행 제품을 대조한다. W4-1만 바꿨더라도 native 변경이면 현재 공급을 다시 빌드·설치한다. 진단 App은 원복하고 일반 명령으로 마지막 제품을 확인한다.
- [ ] §5의 전체 범위·warm 일반 사용과 기능/입력/시각 회귀를 통과한다. 최종 후보를 합칠 때 상호작용을 확인하고 개별 성과를 합산하지 않는다.
- [ ] 미채택 후보의 기본 연결과 임시 계측을 정리한다. 최종 상태·짧은 요약·미수락 원인·다음 시작점을 이 문서에 갱신한다. 실제 사용법이 바뀐 경우에만 기존 한/영 README를 수정한다. **코드·문서·fixture 정리는 수행했고 구 native 공급 4개 삭제는 정책 차단으로 남았다(§8.6).**

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
| W4-0 | **MEASURED / 범위별 한계 기록** | 같은 최종 공급 3쌍·전체 범위 진단과 별도 순수 warm 609/197 frames 확보. 모든 hover/focus의 성능 수락은 미확보 |
| W4-1 | **ADOPTED / 통지 작업량 감소** | protocol 1·native payload 선별, 50 tests·최종 실제 입력/시각 회귀 통과. 일관된 FPS 이득은 미확인 |
| W4-2 | **CONDITIONAL / 비진입** | 비교·변환 갱신 중앙값 Gallery 0.157 / mixed 0.071ms. 기존 변환 교체를 유지하며 root/public paint는 생략하지 않음 |
| W4-3 | **CONDITIONAL / 추가 캐시 비진입** | local 결과 캐시는 이미 존재. 순수 warm 준비 2.50–2.59ms·공개 1.69–1.73ms는 유의한 비용이며 무시하지 않음. frame 간 조상 연결 재사용은 구현하지 않았고 현재 투영·clip·가시성·custom hook을 유지 |
| W4-4 | **ADOPTED / native 회귀 수정** | allocator 회수·clear 이동은 철회. 동등한 filled RRect shadow로 큰 scratch 할당 실패 경로 수정, 실제 Vulkan shadow·입력 회귀 통과 |
| W4-5 | **VERIFIED / PARTIAL · CLEANUP_BLOCKED** | 일반 제품·입력/시각 회귀·공급 대조 완료. 60fps·전체 범위 source 350ms 미수락, 구 native 공급 4개 삭제 차단 |

입력 geometry·sceneBatch·sceneComposition·semanticsGeometry의 기존 opt-in은 계속 기본 비활성이다. 아래 실행 결과를 성능/resize 수락으로 올리지 않는다.

## 8. 실행 기록 — 2026-11-03 KST

### 8.1 착수 공급과 대표 귀속

- 착수 HEAD `2a5fdf3b273ae2b1b50cb3dfd5f74c5f2152e288`, clean. 사용자 일반 명령을 실행하고 최대화 Gallery·mixed 실제 화면과 정상 exit 0을 확인했다. 현재 package/runtime **1,794 files**, 9개 Windows 공급 패키지의 source/dist/설치 inputs를 검증했다. manifest·EXE·bytecode·native/SDK inputs는 §1.2와 전부 일치한다.
- work3 §12.2는 같은 원래 제품의 과거 기준으로 보존한다. 다만 이번 새 공급의 continuous도 이전보다 낮게 측정되어 **과거 각 3회를 W4-1 효과 비교의 기준으로 재사용하지 않았다.** 같은 새 native/SDK 공급에서 continuous/lifecycle 각 3회를 다시 확보한 §8.3을 사용한다. 이전 수치를 전체 범위나 새 hover 조건의 기준으로 확대하지 않는다.
- `run-rnw-motion-probe.mjs legacy --cycle --full-input` 대표 1회: native submitted/producer/surface/retired **1,895/1,895/1,895/1,895**, failed 0, bindings close·JS ack·native GPU/input drain·exit 0. mixed **12 fields/36 buttons**, 전체 OS wheel 복귀 3회 뒤 재클릭 없는 키 입력·selection, send/count/clear·마지막 editor·Korean IME commit/undo 통과. 최대 per-key ack **142.5595ms**. 물리 키보드/트랙패드 확인은 아니다.
- 진단 retained Gallery 300 frames: paint **p50 1.1712 / p95 2.1844ms**, compose **1.2835 / 3.8464ms**, input geometry **0.1852 / 0.3200ms**, owned callback **11.4979 / 27.1816ms**(288 callbacks). native worker **6.9445 / 9.9333ms**, import **1.833 / 2.259ms**, completion wait **4.078 / 7.012ms**, producer→surface **0.5383 / 0.7308ms**. 이 구간은 겹치거나 포함되므로 합산하지 않는다. GC·독립 GPU 시간은 미관찰이다.
- 이 진단의 Gallery pixel gap은 전환 전 `162.375/187.825ms`, mixed 복귀 후 `327.926/248.929ms`. source probe·GDI 계측 아래 결과이며 일반 제품 smoothness가 아니다. 일부 gap의 joined motion이 0~1 frame뿐이어서 원인을 확정하지 않는다. native 오류나 실패를 재시도로 숨기지 않았다.

### 8.2 W4-1 구현과 현재 검증

계약은 **`windowsSurfaceStatusMode: 'continuous' | 'lifecycle'`, `surfaceStatusVersion: 1`**이다. 공개 SkiaGraphiteView의 기본은 continuous이며 SDK 소유 surface가 lifecycle을 명시한다. SDK는 capability와 실제 mode를 확인하고 구 설치본을 admission하지 않는다. native는 owner/backing별 첫 유효 갱신만 Fabric에 전달하며 emitter/mode 변경 때 현재 bound·준비된 frame을 재전달한다. native frames·presented generation/size·resize·입력 tuple/observer·native observeStatus는 계속 갱신한다. close/unbound 이후 frame은 first-content를 다시 열 수 없다.

옵트인 진단에서만 native attempts/payload/writer·prepare wall과 JS handler wall을 고정 8개 scalar로 관측한다. paint 명령·compose 비교/구조/transform 방문·geometry provider/조상 방문도 기존 bounded frame 진단에 추가했다. 새 GPU cache·전체 tree mirror·queue/recording 예산 증가는 없다.

- `test:windows-input-service`: **50/50 PASS**(새 native C++ 정책·capability·late frame·명시적 continuous 포함).
- `test:paint-recording`: **169/169 PASS**.
- input-geometry integration + RNW probe: **17/17 PASS**.
- workspace 전체 `check:types`: **PASS**.
- canonical/generated 준비와 SDK 빌드·변경 3개 패키지 재공급/설치 후 일반 명령의 첫 콘텐츠·실제 화면·exit 0 확인.
- 첫 lifecycle 공급은 중간 산출물이며 최종 채택·현재 manifest/EXE/bytecode는 **§8.5**, 최종 공급 대조는 **§8.6**을 기준으로 한다.

일반 cadence 비교는 `node Nelyx/eng/run-rnw-cadence.mjs --trials=3`으로 현재 검증 package만 사용한다. mixed focus 10초×2, Gallery 좌/우열 각 5초×2를 새 process에서 직렬 실행하며 source probe·상세 native diagnostics·GDI를 끈다. 임시 파일/로그를 남기지 않고 결과는 RAM/stdout에만 둔다. 아직 whole-range/hover별 최종 수락을 대신하지 않는다.

### 8.3 같은 공급에서의 통지 모드 단독 비교

`node Nelyx/eng/run-rnw-surface-status.mjs --trials=3`은 continuous만 App의 명시적 prop으로 선택하고, 마지막 lifecycle은 원래 일반 App을 빌드한다. 중간 오류·중단에도 App 원문을 finally에서 복원하며 concurrent edit는 덮지 않는다. 두 모드 모두 source probe·GDI·상세 native diagnostics가 없고, 2560×1459 / DPI 192·동일 priming/입력이다. 다른 build/test 없이 직렬 실행했고 12개 fresh owner가 모두 exit 0이다. SDK는 실제 native 응답 mode와 capability를 확인하므로 무시된 prop을 적용으로 집계하지 않는다.

| trial | continuous mixed | lifecycle mixed | continuous Gallery 좌/우 | lifecycle Gallery 좌/우 |
| --- | --- | --- | --- | --- |
| 1 | 43.291 / 39.935 | 41.733 / 41.741 | 51.969/53.218 · 53.535/53.891 | 52.569/53.709 · 55.308/53.742 |
| 2 | 44.549 / 43.349 | 43.796 / 44.168 | 53.670/54.027 · 54.336/54.185 | 52.581/54.499 · 56.394/53.516 |
| 3 | 42.316 / 43.592 | 42.985 / 42.981 | 53.502/52.390 · 54.539/52.186 | 52.616/53.863 · 53.558/54.068 |

평균 surface FPS는 mixed **42.838→42.901**, Gallery 좌열 **53.129→53.306**, 우열 **53.779→54.431**이다. 작은 차이를 확정적인 FPS 개선으로 해석하지 않는다. **지속 60fps 미달, performanceAccepted=false**다. 이 실행은 packet-defined 반전이며 전체 범위·모든 hover/focus·물리 입력·scanout 수락은 아니다.

비교 native/SDK inputs는 `32d160b77d22012fc10fb6a478391a9435cdf1d494413500a32a2d571ad21777` / `defdb0b8e8c3077e4c5677582ced9ab7f1709fc6c2b697f875af436b78df2be3`, EXE는 두 모드 모두 `d05a1fb333cd16038285cfeb922532f4cf143c24de097d88c6628f9660cfb8e6`다. continuous manifest/bytecode는 `35a541b83b6312be82da24aa12623c56924c694d4bdb2521797ac1f80d389272` / `86eb929c4230efd4b2356c2fa095fb6db6d01add74452f1f71021a392fff22a6`, lifecycle은 `bc82ebc587631c7a0c57854937ea28af8461b15dad6411f1c04d491917948914` / `e243114484c647c5a849ecf5212bbc80c4e23cf6c6403e8cd1d1f422ebc45c9b`다. 이후 일반 경로에서 진단을 끈 비교 wrapper 호출도 우회하도록 정리했으므로 최종 공급은 별도로 대조한다.

### 8.4 전체 범위 관측과 native 회귀 조사

전체 범위 입력은 OS wheel을 경과 시간에 따라 보내는 편도 4초/1.5초이며 임의의 추가 이동 여유는 **0px**다. 입력 종료와 2초 주기의 source 보고 전달을 분리하고, mixed 준비가 끝난 QPC 이후의 새 위치만 읽는다. lazy extent 증가·감소는 각각 당시 위치와 비교한다. 안정된 범위 실패는 재시도하지 않고 확인된 cold 범위 변경에만 warm 실행 1회를 허용한다. 관련 harness 회귀 **18/18 PASS**. Gallery 좌열 **0↔2236.572px**, 우열 **0↔1390.5px**의 warm 끝점을 확인했다.

W4-2 비교/transform 처리 중앙값은 Gallery **0.157ms**, mixed **0.071ms**여서 직접 연결은 비진입이다. 새 명령 생성과 immutable scene 구성의 나머지 비용까지 이 후보로 제거할 수 있다고 계산하지 않는다. W4-3의 mixed geometry **2.460ms**는 입력·전환이 섞인 진단이며 순수 warm scroll 귀속이 아니다. RenderEditable의 paragraph/epoch/local 크기·scroll·caret 기반 local 캐시는 이미 존재한다. 현재 좌표 투영·가시성·custom hook을 유지하며 중복 캐시를 추가하지 않았다. retirement empty poll의 owned callback 밖 평균 wall은 약 **0.031ms**여서 clock 공유 후보도 비진입이다.

큰 native 할당 실패는 source 실행과 **원복한 일반 명령의 App 모두**에서 Gallery 두 열 warm→mixed 마지막 행 send 순서로 재현했다. 최초 관측은 allocator **198,279,232B + 요청 76,267,888B**, 256MiB cap 초과였다. 다음 후보들은 오류·후퇴를 보존하고 철회했다.

| 후보 native inputs | 결과와 철회 근거 |
| --- | --- |
| `777009…` frame별 단일 image 여유 | input-surface 실제 fixture 1/1 PASS 후 큰 cycle은 같은 allocator 오류로 실패 |
| `f9d4ca…` recording별 단일 여유 | insertion 내부에서 137,739,984→198,279,232B로 증가한 뒤 같은 요청 실패 |
| `4851a7…` recording별 이중 여유 | source cycle 5,062 frames·4개 범위·입력/IME·종료 PASS. 일반 선별 1쌍은 mixed 약 40.2, Gallery 약 46.2–48.6 surface FPS로 후퇴하여 철회 |
| `f53e37…` 실제 부족분 회수 | source outcomes 5,681씩·정상 종료였지만 pixel gap 442.766ms·upload 오류 2건으로 exit 2. 일반 입력도 205,934,336B + 요청 76,267,888B, purgeable 0으로 실패 |
| `2a8521…` clear recording을 Vulkan 초기화로 교체 | 일반 입력이 213,971,040B + 요청 76,267,888B, recording 0/1에서 실패. 중복 clear만으로 압력을 설명할 수 없어 원복 |

실패 때만 수집한 Context 큰 자원 요약에서 full MSAA **2560×1459** 외에 **D32F_S8 3072×512 / 3072×256** 등의 attachment가 참조 중이었다. 임시 요약·allocator 회수·clear 이동 코드는 모두 제거했다. [pinned SkCanvas의 analytic blur 조건](https://github.com/rust-skia/skia/blob/61e7ca4e99062cdd0ab69445d5963fb3365778f6/src/core/SkCanvas.cpp#L1831)을 확인하니 기존 drawStableShadow는 rounded rect도 drawPath·stroke-and-fill로 보내 이 경로에 진입하지 않았다.

현재 후보는 spot의 RRect를 filled RRect로 보내고, 원형 모서리·직사각형의 ambient stroke-and-fill은 같은 외곽의 outset filled RRect로 바꾼다. 타원 모서리의 stroke와 일반/역방향 path는 기존 경로를 유지한다. **allocator 256MiB·Context 96–192MiB·Picture 64/32MiB·recording 2·completion/consumer fence는 그대로다.** 새로운 cache나 tree mirror는 없다.

- 현재 native inputs **`3283d2f3281f64468c815e337995f77ebb2499d0b2a1c3ebc8f4ddf594b58d4b`**, SDK inputs **`99399c417fff9df72e9127975dc7fda73c55f2f8ba3ac5b7fe79abb8405bf7e6`**.
- 현재 archive를 링크한 `test:native-shadows` **1/1 PASS**: 실제 Vulkan DPR 1/1.25/1.5/2, fractional elevation·press/release/hover-exit, direct/retained·clip·GPU drain.
- 같은 현재 공급의 `test:windows-input-surface` **1/1 PASS**: optimized Release bytecode, 실제 caret 픽셀·TSF·UIA range/focus, resize NOLAYOUT fence·live 문서, newer React commit을 가로지른 native focus receipt, 50ms accessibility coalescing·admitted producer close·GPU/input drain.
- 일반 App의 Gallery 두 열 warm→mixed 전체 입력/IME→Gallery 복귀 owner **PASS / exit 0**. 마지막 행 send/count/clear, 재클릭 없는 입력 복귀 3회, 한글 commit/undo·GPU/input drain 확인. 한글 per-key ack 최대 **141.0631ms**, Gallery 복귀의 두 열 4개 leg pixel gap **101.766/102.501/97.327/77.445ms**. 상세 native diagnostics·GDI를 켠 기능/시각 실행이며 60fps 수락은 아니다.
- 현재 일반 locator도 이 공급으로 prepare했다. 전체 범위 진단은 4개 안정 범위 끝점, native outcomes **5,855/5,855/5,855/5,855**, failed 0·upload 오류 0·정상 ack/drain/close를 확인했다. 하지만 Gallery 복귀 gap **358.408ms**로 350ms gate를 넘어 **source 실행 exit 2 / FAIL**이다. 같은 일반 App의 102.501ms 결과와 합쳐 PASS로 바꾸지 않는다. 이 진단의 Gallery/mixed native replay 평균은 **0.585/0.630ms**, worker **6.726/5.998ms**이며 source callback·wait를 포함한 다른 구간과 합산하지 않는다. 최종 일반 3쌍·fixture 결과는 §8.5–8.6에 별도 기록한다.

실험 실행기는 `--native-inputs=<현재 supplier/inputs.json>`으로 검증된 현재 출력에서 빌드한다. `--reuse`와 다른 native 입력의 동시 선택은 거부한다. 실험마다 전체 native SDK를 새 디렉터리로 복제하지 않는다.

정리 제약: 이번 실행에서 만든 구 native 공급의 재귀 삭제를 자동 승인 검토가 **blocked by policy**로 거부했다. 절대경로·manifest·하위 링크 검사로 대상을 좁혀도 거부됐다. 삭제를 우회하지 않았고 잔여 4개는 §8.6에 명시했다. 기존 사용자 소유 native cache·emulator는 삭제하지 않았다.

### 8.5 최종 일반 제품 비교

현재 analytic shadow 공급에서 `node Nelyx/eng/run-rnw-surface-status.mjs --trials=3` 실행 완료. source probe·상세 native diagnostics·GDI·다른 build/test 없이, 2560×1459 / DPI 192와 같은 입력으로 **12 fresh owners 전부 exit 0**이다. mixed는 field-focus 10초×2, Gallery는 mouse-motion 좌/우열 각 5초×2다. 이 packet-defined 비교를 모든 hover/focus의 전체 범위 성능 수락으로 확대하지 않는다.

| trial | continuous mixed | lifecycle mixed | continuous Gallery 좌/우 | lifecycle Gallery 좌/우 |
| --- | --- | --- | --- | --- |
| 1 | 46.010 / 48.195 | 51.167 / 46.757 | 54.192/54.878 · 55.138/54.107 | 49.636/53.563 · 52.737/54.978 |
| 2 | 50.886 / 49.655 | 50.147 / 50.645 | 54.212/54.363 · 54.279/54.465 | 54.562/54.093 · 54.894/56.919 |
| 3 | 48.312 / 50.420 | 48.497 / 48.188 | 52.576/54.476 · 53.507/56.040 | 54.797/54.706 · 54.257/53.352 |

평균 surface FPS는 mixed **48.913→49.233**, Gallery 좌 **54.116→53.559**, 우 **54.589→54.523**이다. **일관된 FPS 이득은 확인하지 못했고 모든 측정 leg가 60fps 미만이다.** `performanceAccepted=false`, `resizePerformanceAccepted=false`, 제품 **PARTIAL**을 유지한다.

SDK lifecycle 기본값은 반복 Fabric payload 생성을 줄이는 변경으로 채택한다. 원래 continuous 공개 기본과 native 갱신 counter·observer·첫 콘텐츠·resize/입력/close 계약은 유지한다. FPS 개선이나 체감 해결을 채택 사유로 쓰지 않는다. analytic shadow는 큰 scratch 할당 실패가 발생하던 일반 입력 경로와 GPU shadow/입력 fixture의 회귀 수정으로 채택한다. allocator 회수·clear 이동은 남기지 않았다.

| 식별값 | 최종 비교 공급 |
| --- | --- |
| native inputs | `3283d2f3281f64468c815e337995f77ebb2499d0b2a1c3ebc8f4ddf594b58d4b` |
| SDK inputs | `99399c417fff9df72e9127975dc7fda73c55f2f8ba3ac5b7fe79abb8405bf7e6` |
| 두 모드 공통 EXE | `793e0a6b41cd824b6b081e3e1902a7081754715635028212a03803a709d5bb4b` |
| continuous manifest / bytecode | `f4e2b439f2269d77329b2f9135f235599979874909828a0d9f1bdeb9f3b682cb` / `8c8e86ec6b6e9f4cb05cd09964c81ed025a47f565646674d3472e3b0e1e8c2b8` |
| 일반 lifecycle manifest / bytecode | `037b2c8cdfd11d3a664403abd162714601845d70ec73a91acfd69401af0ce6c1` / `3fea06f52716a6dc92132a53a424f7c66d7e66ad81d4f00de6fc678c84f7cdfa` |

현재 last-package는 원래 App을 복원해 빌드한 **일반 lifecycle**이다. 최종 검증 뒤에도 위 manifest·EXE·bytecode·native/SDK inputs가 일치한다.

### 8.6 최종 검증·공급·잔여 작업

- **사용자 명령:** `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 최종 일반 제품을 재빌드 없이 실행했다. 최대화·버튼 위치 스크롤·Gallery 두 열 왕복→mixed 전체 입력/한글 IME→Gallery 두 열 복귀·복원·닫기를 같은 프로세스에서 확인했다. 12 fields/36 buttons, 재클릭 없는 입력 복귀 3회, 첫/마지막 행 send/count/clear, selection·한글 commit/undo 모두 PASS, per-key ack 최대 **141.007ms**, 명령 **exit 0**. 이 실행은 상세 native 진단을 켜지 않았으므로 native drain의 별도 로그 관측으로 세지 않는다.
- **일반 제품 시각 회귀:** `test:windows-continuous-scroll` **2/2 PASS**. 기본 네 페이지와 최대화 Gallery 3회, 실제 창 maximize/restore/minimize 전환을 포함한 **7 fresh owners 전부 exit 0·GPU/input drain**. 기본 페이지 pixel gap 최대 **109.571ms**, 최대화 Gallery 두 열 최대 **123.877ms**. packet-defined 연속 입력의 350ms 생존 검사이며 전체 범위/60fps 수락은 아니다.
- **mixed 나머지 owners 2/3/4:** 최종 일반 제품에서 **1/1 PASS**(3 fresh owners, 모두 정상 close/drain). 입력 복귀 3회 또는 editor 밖 button key 3회, 12 fields/36 buttons, 마지막 행 동작·Korean IME commit/undo를 검사했다. 앞선 두 열 warm owner 1의 별도 결과는 §8.4에 보존했다. native 할당/upload 오류는 bounded 로그가 덮이기 전 별도 실패 flag로도 감시한다.
- **변경 범위 검증:** `test:windows-input-service` **50/50**, `test:paint-recording` **169/169**, recorded-composition/input-geometry/frame-visual-commit/RNW probe 묶음 **40/40**, 최종 `test:native-paint-replay` **69/69 PASS**. 현재 C++ 공급의 실제 Vulkan shadow **1/1**, 실제 Windows input-surface **1/1 PASS**는 §8.4와 같다. workspace 전체 `check:types`, package boundaries(**950 files / 511 facades / 7,634 runtime edges / 오류 0**), 변경 TS/JS 20개 lint/format, PowerShell parser·`git diff --check` PASS. 모든 테스트는 1,200,000ms timeout을 사용했다.
- **반복 통지 관측:** 최종 source 전체 범위 실행에서 native frame 시도 **5,855→Fabric frame payload 6**, 전체 status payload/JS handler **20/20**이다. 전체 payload 준비 wall **712µs**, handler wall **9,986µs**는 누적 진단값이다. 전달하지 않은 5,849건에 이 값을 곱해 FPS 절감량을 추정하지 않는다. 모든 native frame outcome은 계속 기록됐다.
- **공급 대조:** Windows 9개 패키지의 source/dist 입력·설치 inputs가 일치한다. 현재 tarball을 추출 사본 없이 읽어 **7,411 files 전부 canonical source와 설치본의 SHA-256**을 대조했고 lock의 resolved 경로·SHA-512 integrity도 확인했다. native 두 패키지는 canonical/generated 각 **175 files**가 일치한다. prepared native와 현재 supplier의 **1,795 files / 228,615,215B**를 검증했다. 실제 실행 package/runtime은 **1,794 files / 319,273,394B**, pinned Hermes·optimized/Release/bytecode·compiler policy도 검증했다. package manifest의 `qualification=notVerified`는 그대로다.
- **Web/Android 경계:** Web 실제 Chrome EditContext **3/3 PASS**는 앞선 공통 Core 변경 시점의 관련 회귀 결과다. 이후 변경은 opt-in 진단 clock/count와 Windows 코드이며 최종 Web 제품을 다시 실행한 것으로 확대하지 않는다. Android는 마지막에 native/RN과 누락된 Core를 재공급·설치했고 **9개 패키지의 소스·설치본·archive·lock이 최종 Windows 공급과 일치**한다. APK는 재빌드하지 않았다. 앞선 emulator 검사는 `Owned Metro server must become ready`에서 앱 실행 전에 중단돼 Android runtime/IME는 **notVerified**다. 기존 Pixel_5 `emulator-5554`는 유지했다.

진단 App은 원문으로 복원했고 이번 작업 소유 임시 fixture·package staging·Testbed 프로세스는 남지 않았다. 현재 Windows/Android supply에는 각 9개 현재 archive만 있으며 검증 로그·receipt/history·독립 SDK 설치본·browser profile을 새로 보관하지 않았다. 현재 Release package·dist·공급 출력과 기존 사용자 소유 cache는 유지했다. Temp의 `nelyx-windows-input-surface-DkFyS3`는 **2026-10-28 생성**으로 이번 작업 전부터 있어 보존했다.

**미완료 정리:** 다음 네 디렉터리는 이번 실행에서 만든 구 공급이다. 모두 `sample/nelyx-testbed-app-2/.nelyx/windows-native/` 바로 아래이며 현재 `3283d2…` 공급이 아니다. preview에서 절대경로·manifest hash·reparse point를 검사했지만 PowerShell `Remove-Item -LiteralPath -Recurse`가 자동 승인 검토에서 **blocked by policy**로 거부돼 남아 있다. 다른 shell/tool로 우회하지 않았다.

- `77700937011ea55aa019c141c71792df7bf5bb14dd63eb780c4e1630daefbb9e`
- `ffd05e60aaa00114fac59de0e93c1b23cf4896ab933099995413517479f9e1ae`
- `4851a710a9ec0353ea71222646872cce5e38771a993547f7506f3a602cb6957b`
- `f53e376e5f183f9a8eb66bf6138e1a6636dcf726b274441ba44d0e608c8045e0`

**다음 성능 작업의 시작점:** 입력·전환이 섞일 수 있는 §8.4의 mixed 평균과 순수 warm을 분리한 §8.7을 구분한다. 기존 local cache·custom live hook·현재 좌표 공개를 보존하면서 geometry 준비/공개와 빠른 왕복의 semantics 준비를 세부 귀속한 뒤 조건부 구조 후보를 판단한다. 명령 비교의 비용만으로 전체 paint/compose·owned callback을 설명하지 않는다. 60fps 미달과 source 358.408ms 실패, 모든 hover/focus 미수락·물리 입력/scanout **notVerified**, `performanceAccepted=false`·`resizePerformanceAccepted=false`·제품 **PARTIAL**을 유지한다.

### 8.7 종료 대조에서 추가한 순수 warm 귀속

앞선 mixed 평균에 입력·전환이 섞일 수 있어 같은 native/SDK/EXE에서 상세 layout/rebuild wrapper를 끈 대표 진단을 추가했다. 첫 시도는 마지막 frame의 report-cadence 표본이 **6개**뿐이어서 자체 coverage 조건으로 실패했다. 전체 범위 끝점과 native exit 0은 확인했지만 그 표본으로 비용을 확정하지 않았다. 빠른 왕복까지 실행한 결과로 세지 않는다.

보완한 `RnwFrameRecords.report(clock, nativeWindow)`는 해당 native QPC 구간 안에서 제출·surface 갱신이 모두 끝난 retained frame의 통계만 계산한다. fixture의 `sourceWindows` 옵션은 보고 구간을 분리한다. 누적 outcome·slow/latest 자료는 원래 범위를 유지해 window 통계와 혼동하지 않는다. 준비·입력 종료 경계를 넘긴 frame과 미완료 frame을 제외하는 회귀를 포함해 **RNW probe 19/19 PASS**, lint/format·diff 검사 PASS다. 일반 제품의 동작은 바꾸지 않았다.

추가 대표 실행은 2560×1459 / DPI 192, mixed field-focus 상태에서 **타이핑·버튼·화면 전환 없이 실제 OS wheel**만 보냈다. 각 방향의 timed input 안에 완전히 들어온 보고 구간을 합쳤다. 구간 경계를 걸친 표본은 제외되므로 입력 전체의 전수 통계나 일반 FPS가 아니다. `p50`들을 평균해 pooled quantile로 쓰지 않았다.

| 편도 시간 | 보고 구간 / frame | paint 평균 | compose 평균 | 명령 비교 평균 | geometry 준비 / 공개 평균 | semantics 준비 평균 | owned callback 평균 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4초 | 9 / **609** | 2.808ms | 2.801ms | 0.319ms | **2.496 / 1.690ms** | **3.039ms** | 20.299ms |
| 1.5초 | 4 / **197** | 3.010ms | 3.531ms | 0.378ms | **2.586 / 1.726ms** | **7.344ms** | 28.222ms |

두 실행 모두 현재 범위 **0↔2102.668001px**, extent 변경 없음·양 끝 도달을 확인했다. 각 window의 중앙값은 geometry 방문 **459**, provider **12**, 조상 방문 **650**, transform 갱신 **1**이다. 명령 비교 방문 중앙값은 242/244였고 새 paint 명령 중앙값 범위는 318–343 / 345–346이다. native submitted/producer/surface/retired **1,212씩**, superseded/failed 0, source errors/invalid 0, bindings close·JS ack·GPU/input drain·exit 0이다. 진단 manifest `d5c947…`, bytecode `9d7e60…`는 일반 제품 receipt로 쓰지 않는다.

이 결과로 geometry 비용을 전환 탓이나 미미한 비용으로 처리하지 않는다. 빠른 왕복의 semantics 준비도 추가 주요 기여다. W4-2의 직접 연결이 전체 paint/compose 또는 semantics 비용까지 없애 준다고 가정하지 않으며, W4-3의 local 결과 중복 캐시만 추가해서 현재 투영·clip·가시성·virtual getter/visitor·공개 hook을 생략하지 않는다. frame 간 조상 연결 재사용과 semantics 내부 비용의 세부 최적화는 **미구현**으로 남긴다. §5.2의 조건부 단계 종료 규칙에 따라 이번 채택은 W4-1과 확인된 native 회귀 수정까지이며, 이 결과를 60fps·전체 hover/focus 수락으로 올리지 않는다.

추가 진단 뒤 App 원문·fixture를 정리하고 사용자 일반 명령으로 다시 빌드·실행했다. 최종 일반 manifest/EXE/bytecode는 §8.5의 **037b2c… / 793e0a… / 3fea06…**로 정확히 복원됐다. 현재 App/SDK inputs와 package/runtime 1,794개 파일·pinned runtime을 다시 대조해 PASS다. 새 진단 로직은 opt-in fixture에만 있고 일반 제품 inputs는 바뀌지 않았다.

같은 일반 owner에서 mixed의 비대화형 왼쪽 여백 스크롤, 버튼 상호작용 후 버튼 위치 스크롤, 편집기 포커스 상태의 화면 밖 왕복을 구분했다. 편집기를 재클릭하지 않고 **`warm`→`warm z`** 입력을 확인했다. Gallery는 좌 **X=0.4**, 우 **X≈2/3**의 배경/버튼 위치에서 시작·반전·재접촉을 확인했다. 좌열 편집기 포커스를 둔 우열 왕복 뒤 **`gallery z`**, 좌열 화면 밖 이동 뒤 편집기가 실제 가시화된 것을 확인하고 **`gallery z q`**를 재클릭 없이 입력했다. lazy 범위 변경으로 같은 wheel 양이 같은 복귀 위치를 보장하지 않아 실제 편집기 가시성을 별도로 확인했다. 화면 밖에서 시도한 입력을 복귀 입력 통과로 세지 않았다.

이 UIA·실제 화면/OS 입력 확인은 기능·상태 전환 범위다. 콘텐츠가 pointer 아래로 이동하므로 매 frame 동일 hover 상태를 고정했다는 결과나 모든 상태의 timed FPS 비교가 아니다. 일반 명령 **exit 0**, 작업 소유 Testbed·probe fixture·package staging 0을 확인했다. 구 native 공급 4개의 정책 차단은 §8.6과 같으며 삭제를 다시 우회하지 않았다.

## 9. 사용자 Gallery 잔끊김 후속 — 2026-11-03 KST

사용자가 일반 명령으로 확인한 뒤 **Gallery 스크롤이 여전히 버벅인다**고 보고해 해당 화면의 입력 처리 비용을 다시 조사했다. §8은 앞선 공급의 기록이며, 후속 공급과 판정은 이 절에서 구분한다. 기존 구 공급 삭제 차단을 우회하지 않는다.

### 9.1 재현과 기준

일반 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 시작한 owner에서 최대화·Gallery 좌열 이동/반전을 확인하고 exit 0으로 종료했다. 이어 기존 일반 lifecycle 제품으로 `run-rnw-cadence.mjs --trials=3 --scene=gallery`를 다른 빌드/테스트 없이 직렬 실행했다. 2560×1459 / DPI 192, source probe·GDI·상세 native 진단 비활성, 3 fresh owners 모두 exit 0이다.

| 기준 trial | 좌열 두 방향 surface FPS | 우열 두 방향 surface FPS |
| --- | --- | --- |
| 1 | 54.486 / 55.650 | 52.274 / 51.756 |
| 2 | 52.308 / 53.571 | 52.539 / 54.260 |
| 3 | 52.116 / 53.156 | 50.843 / 53.186 |

좌 평균 **53.547873**, 우 평균 **52.476282**다. packet-defined 일반 제품 비교이며 전체 범위·물리 트랙패드·scanout의 수락은 아니다. 기준 manifest/native/SDK는 §8.5의 `037b2c… / 3283d2… / 99399c…`다.

기존 opt-in 진단에 semantics flush/snapshot/freeze와 post-frame mouse tracking 구간을 추가했다. 일반 제품에서는 진단 clock을 호출하지 않는다. 첫 source 실행은 정상 drain·outcomes 각 1,771이었지만 stdout 일부가 잘려 세부 귀속 자료로 쓰지 않았다. 같은 진단 package를 명시적으로 재사용해 출력 항목을 좁힌 1회에서 4개 timed leg 안의 **각 3개 보고 구간, 301/295/284/267 frames**를 확보했다. native outcomes 각 **1,723**, failed 0·source errors/invalid 0·정상 ack/drain/exit 0이다.

| 진단 leg | owned callback 평균 | 그중 입력 dispatch | paint / compose | mouse tracking |
| --- | --- | --- | --- | --- |
| 좌 -1 | 11.1775ms | **4.8854ms** | 1.2159 / 1.3003ms | 0.8698ms |
| 좌 +1 | 11.6074ms | **4.9647ms** | 1.2658 / 1.3323ms | 0.9335ms |
| 우 -1 | 12.3516ms | **4.9941ms** | 1.3496 / 1.5191ms | 0.9253ms |
| 우 +1 | 13.8211ms | **5.3640ms** | 1.4332 / 1.5354ms | 1.0150ms |

포함·중첩 구간을 합산하지 않는다. semantics가 실제 실행된 frame의 flush **2.22–3.00ms**, snapshot **1.79–2.76ms**, freeze **0.44–0.78ms**도 별도 기여다(21/21/41/42 samples). 모든 frame 평균 semantics **0.3834–0.9370ms**와 분모가 다르다. native import **1.82–1.90ms**, completion wait **3.86–4.21ms**는 GPU 독립 실행 시간이 아니다. 진단 manifest `93ff77…`, SDK `927fc1…`는 진단 구간 추가만 반영한 중간 공급이다.

### 9.2 입력 경로 수정 후보

- 표준 `RenderPointerListener` / `RenderMouseRegion`의 hover 콜백이 없는 경우 source event 좌표 변환과 빈 dispatch를 건너뛴다. 실제 callback·legacy `onPointer`, callback accessor, 대체/상속 handler, 사용자 source entry와 event transform은 기존 경로를 따른다. MouseTracker의 hit/enter/exit/cursor 갱신은 계속 수행한다.
- hit-test의 identity product를 **검증·동결된 내부 matrix**별 WeakMap으로 재사용한다. product도 기존 `captureMatrix4` 소유권 경계에서 생성해 event admission이 같은 배열을 다시 복사하지 않게 한다. 외부 mutable/frozen 배열은 계속 복사·검증하며, 이전 event snapshot·signed zero·극단값은 유지한다. render tree나 native 자원·frame lease를 보유하지 않는다.
- **116/116 source tests PASS**, 전체 workspace types PASS, 변경 7개 코드 lint/format PASS. 새 회귀는 빈 hover listener의 transform 확장 0, 실제 좌표/진입·이탈, callback getter 1회, prototype/event override·legacy 호출, 반복 matrix의 소유권 재사용과 외부 배열 격리를 확인했다.

일반 제품 빌드·성능 비교와 실제 Windows 입력/시각 검증 전까지 채택/체감 해결을 확정하지 않는다. geometry/semantics의 다른 미구현 후보와 60fps·resize·물리 입력 수락 경계는 유지한다.

### 9.3 후보의 실제 효과와 추가 귀속

첫 hover/identity-product 후보의 일반 제품 3 fresh owners는 모두 정상 종료했다. 좌 평균 **53.438409**, 우 **52.753257 surface FPS**로 기준 **53.547873 / 52.476282**와 차이가 작았다. **체감 잔끊김 해결이나 지속 60fps 달성으로 채택하지 않는다.** 이 공급은 manifest `e69598…`, EXE `76ba8b…`, bytecode `c6fc6f…`, SDK `be8631…`, native `3283d2…`다.

진단에만 `pointerWork` wrapper와 native window 안의 고유 callback별 집계를 추가했다. 여러 frame이 같은 callback을 공유해도 작업을 한 번만 합치며, window 밖 표본을 제외한다. 해당 RNW 회귀 **19/19 PASS**다. 추가 진단의 timed frame은 **317/316/294/281**, native outcomes 각 **1,801**·failed/source errors/invalid 0·정상 ack/drain/exit 0이다. 새 wrapper가 있으므로 이전 진단 평균과의 차이를 후보 절감량으로 확정하지 않는다.

| timed leg | 입력 hit test / post-frame hit test 호출 수 | 두 hit test의 frame당 wall | handler dispatch의 frame당 wall | 전체 transport 처리의 frame당 wall |
| --- | --- | --- | --- | --- |
| 좌 -1 | 889 / 315 | 3.0800ms | 1.4526ms | 4.4234ms |
| 좌 +1 | 807 / 316 | 2.9347ms | 1.4168ms | 4.1970ms |
| 우 -1 | 807 / 294 | 3.1613ms | 1.5802ms | 4.6923ms |
| 우 +1 | 805 / 281 | 3.1648ms | 1.5280ms | 4.6742ms |

입력 hit test는 transport에 포함되며 post-frame hit test는 별도다. 이 열들을 전부 합산하지 않는다. 그림 그리기 밖의 반복 대상 탐색이 주요 기여라는 근거이며, 모든 입력을 하나로 합치거나 callback을 버리는 근거가 아니다. 이 진단 manifest `66030a…`는 일반 제품으로 남기지 않았다.

이어서 내부 소유 4×4 matrix의 최신 곱·paint inverse 재사용을 후보로 추가했다. 외부 mutable/frozen storage, perspective의 XY 분리, signed zero·overflow·이전 snapshot을 보존한다. 선별 1 owner의 좌/우 평균은 **53.428660 / 54.305932**로, 좌열의 60fps 차이를 해소하지 못했다. 1회를 3쌍 비교의 성과로 확대하지 않는다. 해당 중간 manifest/SDK는 `645f90… / fcb038…`다.

최종 비교에는 표준 box의 내부 측정 크기를 사용한 bounds 검사와 기존 불변 자식 snapshot의 역순 접근을 추가했다. 매 hit마다 임시 rect·자식 배열을 만들지 않는다. 외부 자식 목록·size getter·iterator/reverse 교체는 기존 경로를 따르고, 탐색 중 remove/insert가 있어도 해당 탐색의 원래 membership/역순을 유지한다. **119/119 source tests PASS**, 일반 제품/시각·입력 결과는 아래와 같다.

별도 현재 clock 관측은 **DWM observed=1 / interval 6.0605ms**, idle/stop 회귀 **1/1 PASS**다. CIM은 AMD panel 2560×1600/165Hz와 NVIDIA 출력 1920×1080/60Hz를 보고했다. 설정은 변경하지 않았다. 이 관측은 표시/scanout receipt가 아니며, 주사율만 높이거나 대기·fence를 없애는 방식으로 수치를 맞추지 않는다.

### 9.4 최종 일반 제품 — 소폭 개선 / PARTIAL

같은 일반 Gallery 명령·2560×1459 / DPI 192에서 최종 3 fresh owners를 직렬 비교했다. source·GDI·상세 native 진단과 다른 build/test는 껐고 모두 exit 0이다.

| 최종 trial | 좌열 두 방향 surface FPS | 우열 두 방향 surface FPS |
| --- | --- | --- |
| 1 | 52.563 / 51.818 | 54.221 / 55.326 |
| 2 | 55.139 / 56.059 | 53.757 / 56.088 |
| 3 | 53.084 / 53.183 | 53.286 / 55.052 |

기준→최종 평균은 좌 **53.547873→53.641015**, 우 **52.476282→54.621647**다. 오른쪽 열은 약 **4.1%** 개선됐지만 좌열은 거의 같고, 모든 leg가 60fps 미만이다. 내부 반복 작업 감소와 범위가 확인된 오른쪽 열 개선으로 남긴다. **사용자가 보고한 체감 문제의 완전 해결·전체 범위 성능 수락으로 표시하지 않는다.** `performanceAccepted=false`, `resizePerformanceAccepted=false`, 제품 **PARTIAL**을 유지한다.

- 최종 최대화 Gallery 시각 검사 **1/1 PASS / 3 fresh owners**: 실제 창 전환·두 방향 이동, 픽셀 gap 최대 **115.9858ms**, 정상 ack·GPU/input drain·exit 0. 350ms 생존 검사이며 smoothness 수락은 아니다.
- 최종 mixed 입력 **1/1 PASS / owners 1·4**: owner 1은 Gallery 두 열 warm→12 fields/36 buttons·전체 범위 복귀 후 재클릭 없는 입력 3회·한글 commit/undo→Gallery 두 열 복귀를 통과했다. 복귀 Gallery gap 최대 **109.0811ms**. owner 4의 버튼 focus/키 입력과 마지막 행 동작·한글 commit/undo도 통과했다. 두 owner 정상 drain·forced=false·exit 0, per-key ack 최대 **141.6458 / 138.6368ms**다. 물리 입력은 notVerified다.
- **119/119 Core 회귀**, **19/19 RNW probe**, **4/4 package-boundary 회귀**, **1/1 native clock** PASS. 최종 전체 workspace types, 변경 JS/TS 14개 lint/format·diff 검사 PASS. 모두 기존 1,200,000ms timeout을 사용했다.
- Windows 9개 패키지의 source/dist 입력·설치 bytes, 실제 runtime/package를 검증했다. 갱신한 Core archive의 **3,176 files**를 추출 사본 없이 canonical source·Windows 설치본과 SHA-256 대조했고 lock SHA-512 integrity도 일치한다. 현재 package **1,794 files / 319,287,746B**, Hermes bytecode/optimized/Release·pinned runtime 유지, `qualification=notVerified`다.

| 최종 공급 | SHA-256 |
| --- | --- |
| manifest | `5137aa8c3d2700b9e5ddaa437e8aa6cf1c32d56c8549c33f2e0b266d9c44759b` |
| EXE | `ff290e0e19a95e3e44fdd31ec5379a4a843ee775dc520e4f02e7c95170856843` |
| bytecode | `3fd15bab698902d8753ef3849683737b820a46e50907ab72db28b8e6dc0755d6` |
| native inputs | `3283d2f3281f64468c815e337995f77ebb2499d0b2a1c3ebc8f4ddf594b58d4b` |
| SDK inputs | `a203a8bd0b02f089aff1cad0e623162e653c79ca113a057090f6854d48847b92` |
| App inputs | `968cfd53522b2cf6fc6e01c43c70151ee4cd7a872d5103b237b08ac1b3b2b4e6` |

진단 App은 원문으로 복원했고 소유 fixture·package staging은 0이다. 이번 후속 공급/실행 검증은 Windows 범위다. **Android runner의 Core는 이번 최신 Core와 다르며 재공급하지 않았다.** APK·Web output/runtime을 이번 코드의 검증 결과로 확대하지 않는다. 기존 emulator·사용자 cache와 §8.6의 정책 차단된 구 native 공급 4개는 유지했다.

최종 공급에서 평소 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`를 다시 실행했다. rebuild 없이 같은 package로 시작해 최대화 Gallery의 Elevated 버튼 상태 `1 · Elevated pressed`, 왼쪽 Text inputs까지 이동 후 복귀, 오른쪽 Image demo까지 이동 후 복귀를 실제 화면에서 확인했다. Alt+F4 정상 종료·runner exit 0·잔여 NelyxRNHost 0이다. 이 확인은 물리 입력·표시 부드러움 수락을 대신하지 않는다.

**다음 구조 작업:** frame당 약 3ms의 입력/마우스 대상 탐색과 여러 OS packet의 반복 준비를, 현재 좌표·각 callback·custom hook을 유지하며 공유하는 경계를 먼저 설계한다. 이어 비교 자체의 약 0.2ms와 구분해 paint/immutable scene 구성의 약 2.4–3ms를 변경된 viewport·boundary 중심으로 줄인다. 이 구조 변경은 **미구현**이며, 이번 작은 캐시·배열 감소가 그 비용을 모두 제거했다고 가정하지 않는다. 60fps까지 남은 차이와 전체 범위·물리 입력/scanout 수락은 별도로 검증한다.
