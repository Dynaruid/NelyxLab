# W17 — 직접 Hermes host와 native 서비스 요약

원문: `work17.md` · 작성·중간 마무리·종료일: 2026-10-25 KST · 아카이브: 2026-10-27 KST

상태: **CLOSED / SUPERSEDED BY W18 / 구현·제품 PARTIAL**. `performanceAccepted=false`, `physicalInputAccepted=notVerified`, `displayed=unobserved`.

## 방향과 구현

- iOS까지 고려한 Hermes 중심 runtime 방향과 Nelyx 자체 콘텐츠 layout을 유지하고 Windows React/Fabric/Yoga의 surface·입력·semantics를 SDK native 서비스로 옮겼다. V8/JSC 선택은 비교/호환 경로로 남겼다.
- HWND/UI owner·전용 Hermes/JSI thread·Vulkan/DirectComposition·scheduler/timer/microtask·환경/assets/font/image·clipboard/messenger를 구현했다.
- bounded display-list1의23 opcode·paragraph/clip/picture/backdrop·원자 거부·강제 GC 후 replay와 GPU drain, 입력 tail/순서·OS wheel 거리/timestamp/matching surface를 연결했다.
- RN 없는 TSF·UIA fragment/Text/Text2/Value/RangeValue/Invoke/Toggle·stable ID·snapshot/action revision과 peer retirement를 구현했다. UIA 해제 중 식별 조회와 stale action 거부를 구분했다.
- Core의 layer/dirty·Paint/resource·Matrix·semantics와 성공 경로 할당을 보강했다. 직접 host doctor/prepare/build/run/pack·ZIP 왕복/변조 거부·supplier 갱신을 연결했다.
- prototype getter cache VM fork는 작은 fixture의 개선이 실제 앱에서 일관되지 않아 **SKIPPED/미채택**으로 제거하고 원래 VM/compiler/ABI를 복구했다.

## 기록된 제품·기능 확인

정식 HBC153 files/AOT156 files의 두 모드에서 first content·응답·현재 loaded identity·RN/Node-API JSI 미의존·정상 close를 확인했다. 외부 UIA focus/range와 OS pointer 네 실행이 통과했다. AOT는 initializer851/851·원본36,298 native(typed21)와 미분류/미해결/codegen0을 확인했다.

최신 native suite **36/36**, C++ host **1/1**, Core의 scroll159·접근성80·paint/resource96·text38 등 해당 회귀가 통과했다. 당시 Web·RNW·Android와 이전 V8/JSC 증거는 각각의 Core/SDK 공급 범위로 구분했다.

## 성능·메모리 실패

정규 matched matrix는0회였고 물리 content-to-display는 미관측이었다. 이전 Core의 programmatic fast wall p95는 HBC **176.76ms**, AOT **195.55ms**로 목표를 크게 넘었다. Node 논리 객체/호출 감소나 단회 VM fixture의 성공으로 전체 성능을 수락하지 않았다.

마지막 HBC 최대화6회 원인 진단의 tail private는 **453,603,328→454,356,992→455,950,336 bytes**, 순증가 **2,347,008 bytes**로 당시 고정 한계에 FAIL이었다. Vulkan20개/약149.7MB·VM capacity60MiB는 일정했다. VirtualQueryEx로 새/기존 base commit을 나눴지만 allocation owner·stack·누수/driver residency는 입증하지 못했다.

**이 고정 private/Vulkan/plateau 한계는 후속 W18에서 필수 기준으로 퇴역했다.** 과거 실패 자체를 해결 완료로 바꾸지는 않는다.

## W18 승계

직접 host·입력/TSF/UIA·display-list·공급 구현은 재사용하되 Core 데이터/dependency/layout·text/scene/resource owner까지 기반을 재설계하도록 범위를 넓혔다. H2/H3 성능·물리 수락, RNW AV/과거 focus·종료 실패 원인, 메모리 owner·최종 공급은 미수락으로 넘겼다. W17의 마지막 메모리 진단부터 반복하는 재개 지시는 종료됐다.

[전체 이력](../../../README.md) · [W18 기반 개편](work18-summary.md)
