# 엔진 v2 2부 — 렌더링·플랫폼·API 이식 요약

원문: 루트 `work8-2.md` · 설계: **2026-11-04 KST** · 구현 갱신·종료: **2026-11-05 KST** · 보관: **2026-11-05 KST**

문서: **CLOSED / SUPERSEDED** · 구현: **PARTIAL / 전체 기존 API 호환 FAIL**. §8–14와 구현 경과를 요약한다. 마지막 API/실행/공급 기록은 [2a 요약](../05/work8-2a-summary.md#현재-구현-현황)이 우선한다. 아래 기록은 이번 보관에서 재실행하지 않았다.

## 이번 작업의 구현·검증 현황

| 구간 | 구현한 범위와 경계 |
| --- | --- |
| C++ layout/query | Box/Flex/Stack/Wrap/Grid/ScrollViewport·선형 Sliver, text/image/editable 측정, padding/gap·flex/fit·정렬/stretch/baseline. Intrinsic/dry는 별도 continuation으로 query 시작 시 document/metrics/font를 고정하고 active scene/cache를 수정하지 않음. 지원 밖 intrinsic·복합 제약은 남음 |
| Widget/Element | Stateless/Stateful/Inherited·State·Key/GlobalKey·reparent·의존성·ACK 기준 diff. Build/codec/NACK 복구·할당 rollback, deactivate/activate·dispose 예외 정리. 원래 Widget/RenderObject 전체 생성자/동기 hook 호환은 미완료 |
| 편집 document | C++ text/selection/composing·revision·read-only/multiline/password·조건부 replace·undo/redo. 편집 serial로 layout 무효화. App seed를 동기 controller의 모든 의미로 대체하지 않음 |
| Text geometry | Content paragraph의 caret/selection·content rect/padding·UTF-16/grapheme hit를 같은 게시 revision에 연결. 최신 text에 맞는 게시 paragraph가 없으면 range geometry unavailable. Caret는 C++ deadline으로 blink하고 App/Content rebuild·idle 60 Hz polling을 요구하지 않음 |
| Native/Web peer | Windows STA UI owner의 TSF·UIA Fragment/Value/Text/Invoke, Web Main의 DOM carrier·ARIA. Focus session·publication·node 세대·action mask 검사와 제한된 최신 snapshot 재시도. UI thread의 새 shaping·App 동기 응답 대기 없음 |
| 다국어/provider | NotoSansKR/Arabic/Hebrew/ColorEmoji·license 공급, RTL/fallback/color emoji glyph replay. Npm CanvasKit 0.41.0/full의 실제 line-index 단위를 probe하고 UTF-16 adapter 사용. `unscaledAscent=false`, `softHyphenSwitch=false`를 capability로 공개 |
| Graphics·geometry | Affine/inverse·world matrix·rounded/path clip·stroke/shadow·subtree opacity/blur, bounded curve hit·빈 path 차단·실패 원자성. Native Skia와 공식 CanvasKit record/replay에 연결. 전체 shader/filter/rich paint와 모든 GPU 공통 pixel corpus는 미완료 |
| 정적 확장·App 경계 | NativeSparkline의 2–256개 정규화 표본을 C++/Wasm path로 생성. AppDrivenBoundary는 하위 finite 크기를 요구. 임의 동기 RenderObject intrinsic/layout/paint/hit-test 자동 호환을 뜻하지 않음 |
| Budget | 총 384 MiB/GPU 예약 128 MiB의 단일 ledger에 engine/provider·CPU/GPU reservation·staging/transport·Hermes heap/external bytes를 연결. Core 논리 비용과 engine heap은 max로 중복 제거. 실제 process/driver 내부 순간 peak hard cap은 아님 |
| 일반 앱·runner | SDK bootstrap·`--engine v2` create/doctor/prepare/build/run/dev/pack·entry/asset·ABI/schema/source/file hash·실패 build의 이전 bundle 보존. Windows `--app`·plain/isolated Web·portable 공급/설치 소비자. `dev`는 build 후 run이며 generation reload는 미구현 |

관련 소스: [layout](../../../../Nelyx/engine/core/layout/layout.cpp), [query](../../../../Nelyx/engine/core/layout/query.cpp), [Widget](../../../../Nelyx/runtime/engine-client/widgets.ts), [editing](../../../../Nelyx/engine/core/interaction/editing.cpp), [Windows interaction](../../../../Nelyx/engine/platform/windows/interaction.hpp), [Web interaction](../../../../Nelyx/sdk/src/runtime/engine-v2-interaction.ts), [graphics](../../../../Nelyx/runtime/engine-client/graphics.ts), [ledger](../../../../Nelyx/engine/core/memory.hpp), [runner](../../../../Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs).

원문의 11월 5일 중간 중단·193개 및 이전 dist는 당시 미검증 상태다. 이후 재개에서 211개/기능 합계242개와 일반 runner·ledger를 확인했고, 최종 2a에서 Core214·API7·lifecycle3·host5·runner8을 기록했다. 서로 다른 구간 수치를 합산하거나 이전 공급을 최신 소스의 증거로 사용하지 않는다.

## lazy list·디자인 control·gesture/IME 후속 구현

Bounded/async item builder·generation/key/index·findChildIndex·가변 높이 측정·activation-time anchor 보정·수평 list와 먼 index seek를 연결했다. Cache items 8–128/기본96, async builder 동시4·placeholder/cancel·late 결과 차단을 구현했다. 최신 compositor offset에서 anchor를 다시 찾아 준비 중 입력을 보존하며, 미준비 경계를 ancestor handoff의 끝으로 오판하지 않는다.

`@nelyx/material/v2`, `@nelyx/cupertino/v2`는 native control·paint를 선언하는 별도 범위다. Button/selection/slider/range/progress/editor·theme primary·card/list/dialog, 최대32 route의 Navigator·modal barrier를 추가했다. 전체 v1 constructor·icon/theme/form/route/transition 호환을 완료한 것은 아니다.

표준 tap/double/long press·pan/pinch·hover/scrollbar drag·pressed/hover/value·keyboard control을 연결했다. Bounded raw observer·명시적 App 제어 입력·수집 publication hold를 보완했으나 전체 중첩 arena·physics/transform/clip motion graph는 남았다.

App의 commit/cancel replace는 Windows TSF 또는 Web composition-end 확인 뒤 같은 focus session·최신 revision에 적용한다. Prepared ancestor focus/caret reveal와 Windows clipboard 실패의 편집 보존을 보완했다. 모든 bidi/keyboard/clipboard·editor 내부 scroll·먼 lazy focus, 물리 한국어 IME/후보창/reader는 남았다.

## 그래픽·text·게시와 자원 계약

표준 render node는 constraints·측정·geometry의 단일 권위 상태다. 승인 document와 layout 결과·준비 시도·활성 scene·publication을 구분하고 draw/hit-test/semantics/편집 range가 같은 property/geometry를 사용하도록 한다. 새로운 document의 ACK만으로 geometry를 최신으로 반환하지 않는다.

Native는 Skia 공급, Web은 공식 npm CanvasKit과 별도 engine Wasm을 사용한다. Content가 paragraph/Picture/font/image를 준비하고 Render가 module-local 자원으로 import/replay한다. CanvasKit CPU pixel 검사는 실제 WebGL2 host/hardware GPU corpus와 구분하며, Native/Web 모든 GPU의 동등 pixel 결과를 이미 수락했다고 표시하지 않는다.

Budget 거부·취소·교체·device generation·close에서 이전 scene/surface의 유효성과 held resource를 보존한다. Native ledger 종료0은 owned 계정 회수이고 RSS/VRAM 전체 해제 측정이 아니다. Web engine heap은 worker 종료 전까지 살아 있어 close snapshot 전체0을 요구하지 않는다.

## 플랫폼과 API 호환의 미완료 경계

당시 Windows 자체 HWND host와 두 Web profile은 실제 연결했다. Android 최소 surface/ABI·InputConnection/접근성, Apple/Linux host는 미완료였고 Web context loss는 새 session이 필요한 실패 경로였다. Reload의 App generation 교체·이전 callback/편집 수명·실제 device 재생성/loss 중 close는 남았다.

초기 §13에는 동기 pixels/editing/geometry를 비동기 command/snapshot으로 바꾸는 안이 있었지만, 후속 사용자 기준은 **원래 공개 API 전체의 생성자·동작 호환**이다. Cached snapshot·이름 alias·미이식 import 거부나 AppDrivenBoundary만으로 그 기준을 충족했다고 세지 않는다.

원래 Widget/Element/State/GlobalKey/context·parent-data·RenderObject, 전체 layout/gesture/editing/rich text/font/locale/paint/custom hook·디자인·SDK API와 전체 platform/package 소비 조합을 [work9](../05/work9-summary.md)로 이월했다. `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리/표시 `notVerified`를 유지한다.

[보관 목차](work8-summary.md) · [1부](work8-1-summary.md) · [2a 최종 기록](../05/work8-2a-summary.md) · [3부](work8-3-summary.md)
