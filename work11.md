# work11 — 새 월 준비를 위한 Source 실행·렌더 투영의 결합

작성·갱신: **2026-11-13 KST** · 상태: **PAUSED / PARTIAL** · 대상: [work10-a1](work10-a1.md)의 빠른 월 이동 정체

**중간 마무리:** 사용자의 “일단 중간 마무리하자” 요청으로 새 구현을 중단했다. 현재 공급과 작업 트리를 보존하며, 검증된 범위와 미완료·재개 지점은 **§18**이다. 자동 재개하지 않는다.

**실행 현황:** 사용자의 전체 작업 요청으로 §11의 중단 상태에서 재개했다. 공통 모듈·binding 참조·Source 값 구성과 §16의 날짜/연도 helper 정적 결합에 이어, §17에서 원래 builder와 자손 갱신·render commit 비용을 분리하고 Hermes 클래스 spill 오류를 수정했다. 원본 Flutter의 페이지 진행도·허용오차에 맞춰 fixed-page resize anchor도 보완했다. 현재 Windows 네 시나리오와 두 Web profile의 월 왕복·resize·실제 연도 선택 기능은 **PASS**다. Windows `All / 12개월 / 60Hz` 이동 게시 지연은 **97.825/167.275ms**, offset 정체 최대 **177ms**, 빠른 24개월 정체 최대 **313ms**로 **W11 성능 FAIL**이다. **시스템 Dart 3.12.2의 기본 `dart`로 전체 생성 비교 75/75·원본 oracle PASS**를 유지한다. 현재 공급·검증은 **§17.5**, 이번 중단과 재개 지점은 **§18**, 이전 공급은 §12–16과 §17.3, 과거 중단 기록은 §11에서 구분한다.

**제안:** 먼저 **접근성의 Source 구성·App 관찰·Core 조립·Windows UIA 갱신 비용을 분리**하고, 구조·속성이 그대로인 스크롤에서 반복되는 목록·문자열·사각형 재구성을 줄인다. 이 제한된 개편 뒤에도 새 월 준비가 느리면, 원래 TS Widget/Element/State를 실행한 뒤 그 결과를 capture 트리와 Scene 기록으로 반복 변환하는 구조를 **생성 시 정한 투영 절차와 실행 시 유지하는 RenderBinding 기록**으로 바꾼다. 생성된 Source 코드의 불필요한 중간 표현도 함께 줄인다. 준비 창을 늘리는 대신 **같은 원본 의미를 더 적은 작업으로 준비**하는 것이 목적이다.

**접근성 검토 반영:** 설계 단계에서 §2.1–2.4의 소스 근거·소비자·개편 계약을 추가하고 **W11-00A/00B의 비용 분리와 접근성 증분 갱신을 먼저 수행**하도록 순서를 바꿨다. 이후 §11의 실제 실행에서는 App refresh와 Core/UIA 갱신보다 긴 Source build/capture/scene이 남았다. 접근성을 403ms 정체의 주원인으로 확정하지 않는다.

§1–9는 새 아이디어·설계·구현 계획이며 그 안의 목표는 달성값이 아니다. [work10-a1 §24](work10-a1.md#24-2026-11-12-새-월-격자의-source-왕복과-반복-할당-제거)의 결과는 이전 실행 기록으로 보존하고, 이번 재개 공급과 실행은 §12–17에서 구분한다. 기존 문서를 종료하거나 이미 구현한 기능을 초기화하지 않는다. 기존 실행 계약은 [work10](work10.md)과 [work10-a1](work10-a1.md)에 남긴다.

제품 판정은 **PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 사용자 물리 입력·전체 display/scanout 수락 **notVerified**를 유지한다.

## 1. 해결할 문제를 다시 정의한다

### 1.1 최신 기록이 보여 주는 병목

| 근거 | 기록된 결과 | 설계에 주는 의미 |
| --- | --- | --- |
| 연속 12개월 / 약 6초 | 입력 362개 접수·소비, 거부 0. 실제 offset 진행 공백 최대 279ms, ≥100ms 10회, ≥250ms 2회. 게시 gap은 35.413ms | 프레임이 게시돼도 달력이 제자리일 수 있다. FPS나 게시 gap만으로 해결을 판정할 수 없다. |
| 빠른 재접촉 12회 / 24개월 | 약 2,218.868ms, 입력 120개 접수·소비, 거부 0. offset 공백 최대 403ms, 표시/논리 위치 차이 최대 2,752px | 입력 전달과 최종 월 도착은 되지만, 준비 속도가 빠른 입력을 따라가지 못하는 구간이 남는다. |
| 같은 실행의 비용 | 연속/빠른 활성 App turn 최대 364.554/362.271ms. 전체 Source 구간의 build/capture/scene 최대는 각각 198/150/177ms, 178/91/153ms | Source 구성뿐 아니라 구성 이후 투영도 함께 줄여야 한다. 서로 다른 pass·구간의 최대값을 합산한 수치를 한 월의 비용으로 쓰지 않는다. |
| 같은 실행의 native 관측 | Core 개별 호출 최대 9.801/6.558ms, record/submit 5.301/6.197ms, 관측 GPU 완료 12.474/13.010ms | 이 표본은 Source 우선 조사 근거다. Core·GPU가 모든 실행에서 병목이 아니라는 증명은 아니다. |
| resident 범위의 0.4·0.8페이지 접촉 | frame의 consumedThrough와 누적 delta 대조 오차 0.000001px 미만. 수신→게시 최대 17.441–26.336ms | 준비된 내용의 fractional 이동은 이미 가능하다. 새 월의 준비를 앞지르는 순간을 해결해야 한다. |

위 수치는 모두 [work10-a1 §24.3](work10-a1.md#243-최종-공급통합-검증)의 기록이다. ≥500ms 0회는 이전 정지 목표의 부분 진전이며, 100–403ms 정체와 backlog의 해결이 아니다. GC 누적량과 짧은 pause의 이전 진단도 단일 GC가 긴 정지의 원인이라는 증거로 사용하지 않는다.

### 1.2 근본적인 구조 가설: 소비 속도보다 비싼 새 내용 생산

준비된 페이지에서는 Core가 최신 입력으로 transform을 게시할 수 있다. 그러나 아직 존재하지 않는 월은 TS에서 원본 날짜·상태·자식 구성을 실행하고, native 표현으로 변환하고, Content가 실제 제약으로 준비해야 한다. 그 결과가 늦으면 coverage fence를 지키는 화면은 경계에 머문다.

평균 새 페이지 수요를 `λ`, 필수 새 페이지를 준비하는 유효 처리량을 `μ`라고 하면, 지속 구간에서 `μ <= λ`인 구조는 유한 prefetch만으로 해결할 수 없다. 순간 응답에는 평균 처리량뿐 아니라 긴 단일 App turn과 준비 지연의 꼬리도 영향을 준다.

- 12개월/6초는 단순 평균 약 2개월/초, 빠른 24개월/2.219초는 약 10.8개월/초의 이동량이다. 후자는 월마다 약 92ms의 간격에 해당하지만, **현재 한 월의 측정된 service time이라는 뜻은 아니다.** 실제 필수 생성 수는 resident 재사용·입력 경로·동일 프레임 사이에 지나간 페이지에 따라 다르다.
- 다음 미준비 경계까지 거리 `d`, 접근 속도 `v`가 있을 때 대략적인 준비 여유는 `d / |v|`다. 반 페이지의 여유를 위 평균 10.8페이지/초에 대입하면 약 46ms다. 이는 규모를 설명하는 예시이고, 실제 input trace와 Core demand 시점으로 계산해야 한다.
- 따라서 몇백 ms의 Source turn을 그대로 둔 채 힌트 시간을 늘리는 것은 근본 해결이 되기 어렵다. 긴 작업을 단순 분할해도 총 처리량이 그대로라면 backlog는 남는다.

**설계 가설:** 새 월의 필수 원본 실행은 유지하되, 접근성의 반복 구성·게시 후 갱신, 번역 코드의 불필요한 실행, 새 결과의 반복 표현 변환을 제거하면 유한 resident 범위 안에서 준비 처리량과 최악 지연을 함께 개선할 수 있다. App의 접근성 갱신은 다음 Source 작업과 같은 owner의 시간을 소비하며, Windows UIA 갱신은 UI owner의 입력 처리를 지연시킬 가능성이 있다. 실제 실행에서 이 인과가 있었는지는 단계별 시간으로 확인해야 한다. 이 가설의 성능 효과는 미검증이다.

## 2. 현재 소스에서 확인한 출발점

| 현재 경로 | 확인한 구조 | 이번 설계의 변경 경계 |
| --- | --- | --- |
| [calendar_date_picker.generated.ts](packages/material/src/generated/date/calendar_date_picker.generated.ts)의 `_DayPickerState.build` | 실제 calendar delegate·predicate를 호출하고 날짜별 Key, FocusNode, `_Day`를 구성한다. | 월 번호만 native로 보내 원본 실행을 대체할 수 없다. Source 생성 비용 자체를 별도 최적화해야 한다. |
| 같은 파일의 `_DayState.build` | theme/localization 의존성, 상태 resolver, Ink·Semantics·InkResponse, callback을 구성한다. 번역된 generic helper·임시 closure도 있다. | 상수 구조와 실행 시 값의 경계를 생성 단계에서 분석한다. 실제 사용자 callback·상태 전환은 보존한다. helper의 개수만으로 병목이라고 확정하지 않는다. |
| [host.ts](Nelyx/runtime/app/host.ts)의 `perform` | BuildOwner flush·render 연결·retained builder 갱신 뒤 `sceneConfiguration` 및 render별 capture를 호출한다. | Source 완료 경계에 dirty binding 묶음을 봉인해 뒤의 중간 트리 구성을 대체한다. `syncRenderTree`를 무조건 전체 순회로 오인하지 않는다. |
| [capture.ts](Nelyx/runtime/app/capture.ts) | 정적 subtree 재사용·자손만 변경 시 재연결·동적 의존성을 이미 관리한다. | 이미 재사용되는 warm subtree를 다시 최적화했다고 주장하지 않는다. 새 노드와 변경 owner의 projection 생성이 대상이다. |
| [scene.ts](Nelyx/runtime/engine-client/scene.ts)의 `records` | RecordPatch와 retained subtree 생략이 있다. 새 subtree는 handle allocate와 record visit, 입력 정규화·encode를 거친다. | 변경 기록을 기존 writer가 직접 소비하도록 한다. 단순히 RecordPatch 이름만 바꾸거나 그 앞에 새 캐시를 놓지 않는다. |
| [scroll.ts](Nelyx/runtime/app/scroll.ts)의 `NativeListState` | retained entry, delegate generation, Key/KeepAlive, Core demand, 취소된 창 복구가 있다. | 기존 자식 재사용 정책을 보존한다. 새 달을 이전 달의 State로 재활용하지 않는다. |
| [grid.ts](Nelyx/runtime/app/grid.ts)·[native-grid.ts](Nelyx/src/framework/rendering/native-grid.ts) | 제한된 원본 격자는 Content의 실제 viewport를 사용하는 숫자 layout program으로 실행된다. Element별 현재 program을 공유한다. | 이 계약을 보존한다. 제거된 격자 LayoutBuilder 왕복을 다시 만들지 않는다. |

[work10](work10.md)도 직접 변경 기록과 중간 트리 제거를 목표로 했다. 따라서 **직접 journal이라는 발상 자체를 새로운 성과처럼 포장하지 않는다.** 이번의 추가 제안은 그 목표를 새 월의 cold 생성까지 적용하기 위해 **생성기 specialization, 모듈별 투영 절차, writer의 직접 입력 경로**를 한 묶음으로 설계하는 것이다. 단순 payload 공유 이후에도 남은 작업을 실제로 없애는 데 초점을 둔다.

### 2.1 접근성 비용을 네 경계로 나눠 확인했다

아래는 **2026-11-13 현재 소스의 실행 구조**다. 실제 호출 빈도·지연 비중·사용자 환경의 UIA 청취자 존재는 이번에 측정하지 않았다.

| 경계 | 소스에서 확인한 사실 | 조사·수정 후보와 한계 |
| --- | --- | --- |
| **A. Source 접근성 구성·capture** | 날짜의 `_DayState.build`는 label과 selected/enabled 등을 담은 Semantics를 만든다. [Semantics 생성자](Nelyx/src/framework/widgets/semantics.ts)는 SemanticsProperties를 구성하고, [native metadata](Nelyx/src/framework/rendering/native-semantics.ts)는 속성을 검사하고 SemanticsConfiguration을 만든다. [controls.ts](Nelyx/runtime/app/controls.ts)는 이를 native role/flags/actions/metadata로 투영한다. | 새 월에서 발생하는 실제 구성·문자열 formatting·변환 비용을 Source build와 projection으로 구분한다. 날짜별 wrapper 수만 세어 주원인이라고 결론 내리지 않는다. |
| **B. App 게시 관찰·사각형 mirror** | [SceneWriter.observeScene](Nelyx/runtime/engine-client/scene.ts)은 publication 등 관찰 조건이 바뀌면 semanticsSnapshot을 요청한다. [OriginalSemanticsBridge.refresh](Nelyx/runtime/app/semantics.ts)는 새 유효 publication에서 관찰 노드 전체를 훑고 visible semantics 배열을 만든다. [SemanticsBinding.updateViewSemantics](Nelyx/src/framework/semantics/binding.ts)는 이를 다시 순회해 bounds 사본과 새 Map을 만든다. | transport가 delta를 쓰더라도 소비자가 복원된 nodes를 전량 순회하는 비용은 남을 수 있다. 화면 위치만 달라질 때 문자열·역할까지 담은 임시 목록을 만드는 경계를 먼저 줄인다. 새 publication마다 항상 외부 요청 하나가 정확히 실행된다고 단정하지는 않는다. 기존 관찰 합치기·lane 동작을 유지한다. |
| **C. Core semantics 조립·순서·geometry** | [frame.cpp](Nelyx/engine/core/scene/frame.cpp)는 같은 scene의 이전 frame이 있으면 semantics를 복사해 재사용하고, 없으면 makeSemantics를 실행한다. geometry/visibility를 갱신하고 순서 재사용 조건을 검사하며, 조건이 깨지면 orderSemantics를 실행한다. | 이미 존재하는 구조 재사용을 보존한다. `매 frame 전체 의미 트리 재조립`이라는 가정은 틀리다. 다만 vector 복사·순서 검사·새 scene 조립의 실제 비용은 별도로 남는다. |
| **D. Windows UIA projection·게시** | [Interaction.sync](Nelyx/engine/platform/windows/interaction.hpp)는 같은 snapshot/준비가 아니면 items에서 packet을 구성하고 문자열을 wide 변환하며 정렬·부모 연결·custom action peer를 처리한다. [SemanticsTree.publish](Nelyx/engine/platform/windows/interop/SemanticsTree.h)는 topology 검사·peer 갱신을 수행한다. UiaClientsAreListening은 주로 알림 수집/발행을 제한하며 전체 갱신을 끄는 조건은 아니다. | UI thread의 packet 생성과 provider 갱신/알림을 분리 측정한다. 기존 peer는 가능한 재사용되고 있어 모든 peer를 매번 새로 생성한다고 설명하지 않는다. |

추가로 [SemanticsTree.update](Nelyx/engine/platform/windows/interop/SemanticsTree.h)는 delta를 받아도 `delta.order` 전체로 packet 배열을 다시 구성해 `publish`를 호출한다. **이 함수로 호출을 바꾸는 것만으로 진정한 증분 갱신이 되지는 않는다.** 현재 Windows Interaction 경로는 `publish`를 직접 호출한다.

### 2.2 이미 줄인 비용과 제거하면 안 되는 소비자

- [RenderSemantics.updateProperties](Nelyx/src/framework/widgets/semantics.ts)는 단순 불변 속성이 같으면 보수적인 전체 invalidation을 피한다. static layout semantics는 geometry 갱신 경로도 구분한다. [controls.ts](Nelyx/runtime/app/controls.ts)의 `cacheableSemantics`와 [host.ts](Nelyx/runtime/app/host.ts)의 dynamic 판정도 이미 있다. 같은 속성 재사용을 처음 도입하는 계획으로 다시 설명하지 않는다.
- [App host의 onPublication](Nelyx/runtime/app/host.ts)은 semantics 외에도 geometry·layers·focus·editing에 같은 게시 관찰을 전달한다. 이름이 semanticsSnapshot이라고 해서 요청 자체를 제거하면 다른 필수 소비자까지 영향을 받는다. 첫 실험은 관찰 수신과 fence를 유지한 채 **semantics 소비자 내부 비용만** 분리한다.
- [App TapRegion bridge](Nelyx/runtime/app/tap-regions.ts)의 semanticSurface는 해당 view/node의 접근성 사각형 존재 여부를 사용한다. [원본 TapRegion](Nelyx/src/framework/widgets/tap-region.ts)도 semantic action을 처리할 때 사각형을 조회한다. App mirror를 없애거나 오래된 rect를 그대로 반환하면 접근성 액션과 inside/outside 동작이 달라질 수 있다.
- [OriginalSemanticsBridge](Nelyx/runtime/app/semantics.ts)는 유효 publication에서 `ensureSemantics()`를 호출한다. 스크린 리더를 사용하지 않는다는 이유만으로 App 쪽 구성이 비활성이라고 가정할 수 없다. [SemanticsBinding](Nelyx/src/framework/semantics/binding.ts)의 accessibilityEnabled와 Windows의 UIA 청취 여부 역시 같은 조건이 아니다.
- [interaction.cpp](Nelyx/engine/core/interaction/interaction.cpp)의 `semanticsWork` 증가는 semantic action 처리 경로에 있다. 이 카운터가 작거나 0이라는 이유로 A–D의 구성·관찰 비용을 무시하지 않는다.

### 2.3 접근성 개편안: 내용·노출 구조·좌표를 따로 갱신한다

기존 Source/Core 권위를 유지하고, 두 플랫폼 owner가 같은 mutable Map을 공유하도록 바꾸지 않는다. **하나의 Core 게시 의미를 각 소비자가 최소 데이터로 투영**하는 방식이다. 아래 revision 이름은 설계 개념이며 새 wire/API가 구현됐다는 뜻이 아니다.

| 변경 종류 | 포함할 정보 | 갱신 방식 |
| --- | --- | --- |
| **의미 속성 변경** | label/hint/value/role, selected/enabled, action capability, custom action 설명, locale·방향 | 해당 node의 immutable metadata만 갱신한다. 콜백 함수는 App에 남기며 함수 교체와 action 비트 변경을 구분한다. |
| **노출 구조·순서 변경** | 생성/삭제, merge/exclude/block, parent/traversal, route/modal, generation, custom action peer 구성 | 영향 subtree와 노출 목록을 검증한다. stable identity로 peer를 재사용하고 실제 topology 변경만 구조 알림 대상으로 삼는다. |
| **게시 geometry·상태 변경** | bounds/clip/world transform, visibility, focus, control/editor 상태, metrics/device/publication | 현재 게시의 좌표·상태를 갱신한다. metadata가 같으면 label 재생성·변환이나 전체 역할 설정은 반복하지 않는다. |

**스크롤은 항상 geometry-only라는 규칙을 만들지 않는다.** viewport 진입/이탈, clip·opacity 변화, modal route, 읽기 순서, 선택·focus 변화가 동반되면 노출 구조나 속성도 달라진다. scene identity 하나나 publication 번호 하나로 모든 유효성을 판정하지 않는다.

**App 쪽 첫 후보:** `관찰 nodes → 임시 SemanticsNode 배열 → bounds 복사 → Map`의 두 번 변환을 하나의 내부 rect 소비 경계로 줄인다. 외부/public API는 유지한다. 이후 실제 비용이 남으면 stable node key별 delta 적용 또는 현재 immutable publication에 묶인 동기 rect resolver를 검토한다. resolver는 기존 관찰의 index를 재사용해야 하며, query마다 전체 nodes를 다시 훑거나 Core 왕복을 만들지 않는다. 무효 publication·metrics mismatch·hidden/offscreen·삭제된 generation은 기존과 동일하게 null을 반환한다. 공개된 Rect를 제자리 변경하지 않으며 오래된 snapshot을 월 이동 횟수만큼 붙잡지 않는다.

**Windows 쪽 첫 후보:** stable handle/generation과 semantic metadata identity를 기준으로 name/tooltip/automationId 등의 변환 결과를 node 수명 동안 유지한다. UIA의 geometry/commit은 최신 게시로 갱신하고, 변하지 않은 문자열·role·order의 전량 재구성은 피한다. 구조 변경이 있을 때만 순서와 부모 연결을 다시 계산하되, 이를 증명하지 못하는 경우 기존 검증으로 돌아간다. 기존 `update`의 전체 배열 복원까지 제거해야 이 단계가 완료다. `packet` 안의 불변 metadata와 publication별 frame/text context를 분리해, 이전 paragraph lease·geometry를 잘못 재사용하지 않는다.

**Source 쪽 후보:** 새 월의 label formatting, SemanticsProperties/Configuration 생성, native metadata 검증이 실제로 큰 비용이면 기존 owner별 revision/cache 계약을 확장한다. mutable collection, callback, overridden describeSemanticsConfiguration, custom action, locale와 날짜 delegate는 각각 무효화 조건을 갖는다. 전체 SemanticsProperties를 작은 내부 record로 바꾸면서 공개 필드·subclass 의미를 잃는 변경은 하지 않는다. 필요할 때 §3의 생성기 specialization·직접 binding으로 이어간다.

**일관성 계약:** UIA는 event 통지에서 재진입할 수 있으므로, 새 metadata·topology·geometry를 같은 publication으로 설치한 후 알린다. 시각 frame과 다른 월의 label/선택/클릭 대상을 섞지 않는다. stale 액션의 재검증, editor TextPattern/paragraph 수명, TapRegion, focus·route·announcement의 기존 순서도 보존한다. lifecycle·action·terminal·필수 알림을 latest-only 속성처럼 버리지 않는다. UIA provider를 무조건 다른 thread로 옮기지 않는다.

`UiaClientsAreListening()==false`를 provider 미사용의 증거로 삼아 tree를 폐기하지 않는다. 이벤트를 구독하지 않고 조회하는 UIA client나 실행 도중 시작한 보조 기술도 현재 결과를 볼 수 있어야 한다. 소비자 수요에 따른 활성화는 이 조건들을 별도로 증명한 뒤의 후속 선택지다.

### 2.4 비용을 분리하는 검증 설계

**먼저 코드로 확인한 전량 변환 경계를 수정 후보로 정하고, 구분되지 않는 비중만 최소 계측한다.** 장시간 trace 수집을 개편의 선행 조건으로 만들지 않는다. 아래 항목은 아직 실행하지 않은 계획이다.

| 구간 | 기록할 최소 항목 | 해석 주의 |
| --- | --- | --- |
| A / Source | Semantics 생성·metadata 구성 횟수/시간, 새 월과 기존 월의 변경 수, 가능할 때 할당 표본 | build 안에 포함된 시간을 build 시간과 더하지 않는다. 개별 constructor마다 고비용 타이머를 넣어 결과를 왜곡하지 않는다. |
| B / App | publication 관찰 대기/수신 처리와 refresh/rect Map 시간, 방문/생성/변경 rect 수 | 기존 publicationObservationMs는 다른 비용을 포함하므로 접근성 소비자 CPU 시간으로 읽지 않는다. transport delta와 소비자 재순회를 구분한다. |
| C / Core | makeSemantics·기존 배열 복사·순서 검사/정렬의 실행 수와 시간 | 같은 scene의 이동과 새 월 scene을 분리한다. 기존 Core 호출 시간 안의 세부 비용이다. |
| D / UI | Interaction packet 구성/문자열 변환·sort, provider 적용, 알림 발행 시간, 청취 여부, 기존/신규 peer 수 | 새 snapshot 처리와 동일 snapshot skip을 구분한다. UI thread 지연과 App turn 지연을 서로의 원인처럼 합치지 않는다. |

같은 demand/Source pass/publication/input sequence와 각 owner 시간축을 연결한다. 초기 표시, resident 내 0.4/0.8페이지 이동, 새 월 연속 12개월, 빠른 24개월·반전을 구분한다. **resident 이동에서 A가 거의 없는데 B/D가 크면 게시 갱신을, cold 월에서 A가 지배하면 Source 구성을 우선**한다. 둘 다 작으면 접근성은 주병목 가설에서 내리고 기존 Source/projection 계획으로 진행한다.

A/B는 한 경계씩 바꾼다. 우선 정확성을 유지하는 `현재 경로 ↔ 후보 증분 경로`를 비교한다. 비용 격리를 위한 임시 skip이 꼭 필요하면 테스트 전용으로 범위를 명시하고 제품 공급에서 제거한다. 특히 B 전체 skip은 TapRegion 의미를, D 전체 skip은 UIA 조회와 검사 oracle을 바꾸므로 그 실행을 기능·성능 수락 표본으로 사용하지 않는다. 모든 접근성 경로를 한꺼번에 끄고 빨라졌다는 결과는 수정 위치를 특정하지 못한다.

UIA 검사 도구가 비교 조건을 바꿀 수 있으므로, 활성 스크롤 중 조회 빈도를 기록하고 동일하게 유지한다. 한 쌍은 초기 위치 확인 뒤 활성 구간에 UIA polling을 하지 않고 기존 native input/frame trace로 추종을 비교한다. 이후 별도 기능 구간에서 최신 UIA 이름·좌표·액션을 확인한다. 실제 보조 기술/청취자가 있는 조건도 따로 확인하고, 비활성 조건과 섞어 평균을 내지 않는다. 관찰 도구 때문에 UIA가 활성화됐는지 실측하며, UIA 조회 자체를 곧바로 이벤트 청취 등록과 동일시하지 않는다.

비교에서는 source/engine/App 공급, 입력 궤적, viewport/DPI, cold/warm 상태, 수집 on/off를 맞춘다. 후보는 정확성 통과 뒤 단계 시간과 실제 offset backlog가 함께 줄어야 한다. 짧은 표본의 작은 시간 차이만 있으면 효용 미입증으로 남기고 반복 횟수를 늘려 통과값을 찾지 않는다. 접근성을 끈 실행이나 불완전한 trace로 §6의 성능 완료를 체크하지 않는다.

## 3. 핵심 아이디어: 정해진 투영 절차와 하나의 retained 기록

### 3.1 두 종류의 실행을 분리한다

**Source 실행**은 TS의 원본 Widget/Element/State가 맡는다. 어떤 날짜가 가능한지, 어떤 테마 상태인지, 어떤 콜백을 호출하는지는 계속 여기서 결정한다.

**렌더 투영**은 이미 결정된 render 설정을 Core 명령으로 옮기는 내부 작업이다. 알려진 render 종류의 고정된 필드·연결·명령 형태는 매 월마다 일반 객체 트리로 재구성할 필요가 없다. 생성기나 해당 모듈이 준비한 투영 절차에 현재 값과 참조만 넣는다.

목표 흐름은 다음과 같다. 아래 용어는 계획상 내부 개념이며 존재하는 API라고 주장하지 않는다.

```text
원본 TS build / lifecycle / callback
    → 기존 Element·RenderObject의 실제 변경
    → RenderBinding의 필드·연결 journal
    → Source 완료 지점에서 불변 batch 봉인
    → 기존 SceneWriter의 handle 해석·diff·transaction
    → 기존 Core Document / Content / Render / publication
```

현재 내부 Source 경로의 `RenderObject → SceneNode/options/children → NativeRecord/config` 중, 증명된 종류는 **RenderBinding의 소유 데이터 → NativeRecord 변경분**으로 연결한다. 공개 Scene producer 및 아직 지원하지 않는 종류는 기존 경로로 유지한다. 한 subtree에 양쪽 경로가 동시에 create/delete를 보내지는 않는다.

### 3.2 투영 절차는 픽셀 캐시가 아니다

투영 절차는 `종류, 안정적인 partKey, 입력 필드, 명령 종류, 참조 연결, 의존성 종류`를 표현한다. 월별 장면이나 완성된 bitmap을 저장하지 않는다. 예를 들어 내부 text projection은 현재 text/style/font binding을, decoration projection은 현재 shape/color를 받는다. 실제 geometry와 text layout은 기존 Core/provider 권위에 남는다.

- 고정 schema와 명령 기본형은 모듈 수에 비례해 보유한다. 테마·월마다 recipe를 계속 추가하지 않는다.
- 실행 데이터는 실제 살아 있는 render binding에만 존재한다. 월 이력 Map, 무제한 paragraph/scene 보관, 재방문용 전체 월 snapshot을 만들지 않는다.
- 날짜를 판별해 그리는 C++ 전용 달력, 별도 renderer, 임의 사용자 함수를 실행하는 새 bytecode VM은 만들지 않는다.
- 첫 구현은 **현재 wire opcode와 transaction**을 사용한다. template 등록 protocol·shared-memory pool·JSI 교체는 전제가 아니다. 명령 수나 native 검증이 다음 병목이라는 근거가 생길 때만 별도 protocol 변경을 검토한다.

### 3.3 새 월의 Source 비용도 줄인다

직접 투영만으로 원래 Widget 생성 시간이 사라지지 않는다. 따라서 [날짜 생성기](tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts)와 [Dart emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts)에 **좁은 범위의 정적 specialization**을 추가하는 것을 함께 제안한다.

대상은 정적으로 확정된 순수 helper 호출, 중간 tuple/설정 조합, capture하지 않고 escape하지 않는 임시 closure, 반복되는 내부 projection schema다. 생성된 JS에서 효과가 같은 직접 코드로 내릴 수 있는 것만 바꾼다. 런타임 build마다 AST 분석이나 범용 해시를 실행하지 않는다.

| 허용할 최적화 후보 | 반드시 유지할 의미 / 거부 조건 |
| --- | --- |
| 정적 타입·원본 선언으로 증명된 helper의 직접 호출 또는 인라인 | 평가 순서, receiver, null/숫자 오류, 예외 시점, Dart 동등성·정수 의미. 단순 TS 타입 표기만으로 런타임 검증을 지우지 않는다. |
| 순수하고 외부로 노출되지 않는 임시 표현의 결합 | accessor·Proxy·외부 함수·가변 컬렉션·알 수 없는 subclass가 끼면 적용하지 않는다. 사용자 입력을 미리 읽어 eligibility를 검사하면서 부작용을 두 번 실행하지 않는다. |
| 모듈이 소유한 불변 기본값과 projection schema 공유 | 공개 객체 identity·field descriptor·불변성 계약을 보존한다. State, FocusNode, states controller, 살아 있는 Ink feature를 공유하지 않는다. |
| 안정된 native binding의 필드별 갱신 | 새 콜백은 App registry에 반영하고, event-policy 변화는 Core에도 전달한다. 같은 paint 값이라는 이유로 콜백 교체를 생략하지 않는다. |

원래 `_Day`, InkResponse, Semantics 및 그 아래 Element를 없애거나 가상 Element로 대체하는 것은 이 계획에 포함하지 않는다. BuildContext의 ancestor 조회·Inherited 의존성·GlobalKey·lifecycle을 보존해야 하기 때문이다. **원본이 관찰할 수 있는 객체의 새 생성 비용은 남는다.** 그 필수 비용만으로도 예산을 넘으면 이 설계는 충분한 해결이 아니며, W11-02에서 이를 명시적으로 판정한다.

### 3.4 날짜 한 칸에서 실제로 없어질 작업

첫 입증은 `_DayState.build`가 만든 날짜 한 칸을 대상으로 한다. 날짜 칸 전체를 하나의 native control로 합치는 것이 아니라, 원래 render 결과를 만드는 각 모듈의 projection을 직접 연결한다.

| 입력 변화 | 원본에서 계속 실행할 작업 | 직접 projection의 결과 |
| --- | --- | --- |
| 새 월의 15일 mount | 새 날짜 Key/State·FocusNode 연결, theme/locale 의존성, predicate와 원본 build | 새 render binding과 실제 native 노드 생성. 고정 projection 구조는 재사용하고 SceneNode/options 트리를 별도로 구성하지 않음 |
| 같은 날짜의 selected 변경 | 원래 상태 controller 갱신, theme resolver, 필요한 Widget update/build | 실제 바뀐 decoration/text style/semantics 및 관련 interaction 필드만 journal에 기록 |
| 같은 값의 새 onChanged | 원래 Widget update와 callback 연결 | App callback binding 갱신. event-policy·기타 wire 값이 같으면 paint 명령 재생성 없음 |
| locale·font·DPR 변경 | 원래 dependency에 따른 rebuild와 실제 문자열·geometry 재계산 | text/resource/layout 등 영향 필드와 참조를 무효화. 이전 recipe의 데이터 결과를 그대로 재사용하지 않음 |

생성기 쪽 첫 후보도 이 경로로 한정한다. 예를 들어 `_DayState.build` 안의 `effectiveValue`·`resolve`는 호출 위치와 임시 closure의 탈출 여부를 분석해, 증명 가능한 호출에 한해 직접 조건식/지역 변수로 내린다. **사용자 WidgetStateProperty.resolve 호출은 그대로 실행**하며, theme 결과가 null일 때 defaults를 평가하는 순서·횟수도 보존한다. getter 접근·type witness 생성에 효과가 있거나 증명하지 못하면 기존 코드를 유지한다. 이를 통해 줄일 수 있는 것은 번역용 임시 함수/호출이지, 사용자가 정의한 resolver 실행 자체가 아니다.

이 최소 경로에서 원본 실행 trace와 native 결과를 먼저 대조하고, cold 월 전체에서 Source 시간·투영 시간·할당을 다시 확인한다. 날짜 한 칸 microbenchmark의 개선만으로 월 전환 성능을 선언하지 않는다.

## 4. RenderBinding 직접 기록 계약

### 4.1 소유자와 데이터

| 데이터 | 소유자 / 계약 |
| --- | --- |
| Widget/Element/State, callback과 delegate 실행 | 기존 TS App owner. 호출 횟수·순서·상속 의존성을 기존 계약대로 유지한다. |
| binding identity | `(RenderObject identity, stable partKey)`. synthetic paint/text/layer node도 독립 partKey를 가진다. 배열 순서나 월 번호만으로 identity를 만들지 않는다. |
| native handle / accepted record | 기존 SceneWriter. slot·generation, provisional 할당과 rollback, transaction checkpoint를 그대로 사용한다. |
| pending 필드·연결 | App binding이 소유한다. mutable 외부 값은 기존 계약대로 독립 캡처하고, 등록된 내부 불변 값만 공유한다. |
| callback binding | App registry. 해당 accepted/게시 checkpoint와 기존 input routing 계약을 유지한다. 미게시 geometry와 잘못 결합하지 않는다. |
| Document / layout / hit-test / scroll | 기존 Core. TS는 viewport 최종 위치나 coverage를 추측해 승인하지 않는다. |
| reader / GPU / 자원 회수 | 기존 frame·lease·retirement owner. Source batch가 끝났다는 이유로 GPU 자원을 반환하지 않는다. |

`children / layout / paint / semantics / interaction / resource` 변경을 구분한다. 같은 Source pass의 여러 setter는 마지막 **설정값**으로 합칠 수 있다. lifecycle·delegate·callback·명령 terminal·입력은 설정값이 아니므로 합치거나 누락하지 않는다.

### 4.2 정상 commit 절차

1. 기존 동기 Source build와 render 연결을 실행한다. 변경 hook은 binding의 필드와 관계만 기록하고 그 자리에서 Core에 보내지 않는다.
2. 해당 Source 완료 경계에서 `baseDocument`, metrics/device/font, binding revision, 의존성 revision을 포함한 불변 batch를 봉인한다. 봉인 뒤 발생한 변경은 다음 batch에 남긴다.
3. 기존 writer가 새 binding의 provisional handle을 먼저 배정한다. 이후 참조와 children을 해석해 NativeRecord 변경분을 만든다. 새 노드끼리의 forward reference 때문에 필요한 두 단계까지 억지로 한 단계라고 주장하지 않는다.
4. 기존 diff/encode/transaction으로 전송한다. create/delete/reparent의 순서·최종 graph 유효성·quota를 보존한다.
5. ACK 뒤 accepted 기록을 갱신한다. NACK은 provisional handle·자원을 rollback하고 현재 desired 변경분을 재구성한다. ACK가 불확정인 timeout은 거부와 구분하며 기존 terminal 확인 전 재사용하지 않는다.
6. Content 준비·publication·retirement는 기존 fence를 따른다. `[accepted → prepared → published → retired]`를 하나의 성공 상태로 합치지 않는다.

기존 `RenderSceneCapture`의 abort/commit, SceneWriter의 checkpoint와 병행하는 두 번째 transaction 상태 기계를 만들지 않는다. 직접 경로는 그 기존 경계에 들어가는 입력 형태다. build 예외 뒤 원본 ErrorWidget 처리는 유지하되, 폐기된 중간 projection과 부분 성공 transaction은 외부에 노출하지 않는다.

### 4.3 비트리 참조와 무효화

Ink, leader/follower, tooltip, inline text child, font/image, semantics/focus 등은 subtree identity만 같다고 재사용할 수 없다. 기존 동적 경로가 매번 live encode하는 이유를 먼저 binding dependency로 옮긴다.

- 참조 대상 generation 변경·parking·reparent·dispose 시 소비 binding을 무효화한다.
- refs의 역방향 색인은 살아 있는 binding 수와 실제 edge 수에 한정한다. dirty queue는 binding별 중복을 합치되 tombstone과 dispose 순서를 보존한다.
- topology·depth·중복 reference·node limit 검증을 생략하지 않는다. 최초 구현에서는 기존 Core graph validator를 유지한다. 그 비용이 남으면 별도 근거로 최적화한다.
- 전역 theme/font/locale/DPR·viewport 변경은 실제 영향 범위를 무효화한다. 전체에 영향이 있으면 넓은 갱신이 정상이다. 모든 update를 O(1)로 약속하지 않는다.

### 4.4 부분 도입과 fallback

직접 경로의 경계는 모듈이 소유한 render 종류와 명시적 capability로 결정한다. 달력 화면 이름이나 위젯 class 이름 문자열에 따른 runtime 특례를 두지 않는다.

지원하지 않는 subtree는 기존 capture가 하나의 adapter로 연결한다. 어느 쪽이 handle·부모 연결·삭제를 소유하는지 정하고, 전환은 하나의 기존 transaction에서 수행한다. 미지원 subclass·실행형 참조를 억지로 순수하다고 분류하지 않는다. fallback 빈도와 비용을 집계해 **달력 대부분이 fallback인데 새 경로 완료로 표시하는 일**을 막는다.

공개 Scene producer는 계속 mutable 입력·accessor 의미를 보존한다. 테스트용 reference 경로는 유지할 수 있지만, 제품에서 매 프레임 양쪽 전체 파이프라인을 실행해 결과를 비교하지 않는다.

## 5. PageView에 적용하는 방법

페이지는 **dirty 작업의 색인 단위**로만 사용한다. 독립 Document나 별도 준비 queue·renderer를 추가하는 단위가 아니다.

- 새 월 demand는 원래 delegate를 실행하고 새 Key/State를 정상 mount한다. 날짜가 다르면 같은 날짜 칸이라는 이유로 State나 focus를 넘겨 쓰지 않는다.
- 기존 월은 실제 설정·의존성이 바뀐 부분만 투영한다. `shouldRebuild=true`인 원본 실행이나 header callback은 그대로 수행하고, 그 결과가 native 표현을 바꿀 때만 record를 만든다.
- 새 월의 geometry·paint·semantics·hit-test와 관련 header 변경은 기존 Source/Content snapshot 계약으로 일관되게 준비한다. 빠른 표시를 위해 이전 월의 클릭 영역을 새 월의 그림과 섞지 않는다.
- 최초 visible page, 이후 양쪽 이웃, coverage miss의 visible 우선 복구, 기존 최대 4페이지의 준비 창 정책을 보존한다. KeepAlive/focus로 parked된 State와 in-flight/GPU reader의 메모리는 별도 기존 quota에 포함하며, 4페이지라는 말로 이 메모리를 숨기지 않는다.
- 이미 완성된 coverage 내에서는 App의 다음 준비와 관계없이 Core의 fractional transform이 계속 진행한다. coverage 밖은 기존 안전 동작을 유지하고 **예산 실패로 기록**한다. 보간 animation이나 최종 위치 순간 이동을 새로운 성능 해결책으로 추가하지 않는다.
- 물리 delta를 손실시키지 않는다. 한 refresh 사이에 여러 월을 지나가는 입력까지 모든 중간 월을 반드시 한 프레임씩 재생하라는 요구는 아니다. 실제 게시 시점의 표시 위치가 올바른 논리 시점을 따라가는지 검사한다.

공통 경로에서는 월별 소스 의미를 모른다. 달력은 반복적인 새 자식 구성·Ink·semantics·text·page coverage를 함께 갖춘 첫 소비자이고, 같은 직접 투영을 일반 목록·버튼에도 연결해 달력 전용 우회가 아닌지 확인한다.

## 6. 긴 turn을 다루는 원칙과 비용 목표

### 6.1 먼저 작업량을 없애고, 안전한 부분만 나눈다

임의의 사용자 `build`, constructor, delegate, state resolver를 중간에 suspend하면 원본 동기 실행·예외·재진입 의미가 바뀔 수 있다. `await`를 몇 군데 넣거나 microtask를 무조건 쪼개는 방식을 해법으로 삼지 않는다.

직접 투영에서도 긴 순수 작업이 남으면 **봉인된 불변 batch의 encode/검증**처럼 user callback과 무관한 구간만 continuation 후보로 삼는다. 이때도 부분 Document를 게시하지 않고 batch·source revision을 검증한다. UI/native 완료 처리로 양보하는 기존 App scheduling과 close/cancel 경계를 확인한다. 별도 optional page preparation queue를 복원하지 않는다.

필수 Source 실행 자체가 수백 ms이면 순수 encode 분할은 보조 개선일 뿐이다. 그 상태에서 전체 해결로 진입하지 않는다.

### 6.2 구조적 비용 목표

`M`은 새로 생성하거나 변경한 binding, `E`는 바뀐 연결·실제 dependency edge다.

| 구간 | 목표 | 남는 비용 |
| --- | --- | --- |
| 원본 Source | 생성기 specialization으로 불필요한 helper/임시 할당을 줄임 | 필수 Widget/Element/State 생성, 사용자 코드, 실제 상태 계산 |
| 직접 투영 | 정상 local 변경은 `O(M + E)`, 직접 지원 영역의 중간 SceneNode 재구성 0 | 값 캡처, handle 해석, 실제 변경 command encode |
| cold mount | 정적 schema를 재사용하고 새 노드의 데이터만 생성 | 모든 새 native 노드·필수 자원에 비례한 작업. O(1) 아님 |
| global 변경 | 영향 owner를 정확히 갱신 | 전역 font/theme 등은 전체 갱신 가능 |
| native 준비 | 기존 layout program·Document 공유 재사용 | 실제 layout/paragraph/GPU 준비와 보수적 graph 검증 |
| 접근성 게시 소비 | 의미 속성·노출 구조가 같으면 문자열·role·전체 packet/Map 재구성 생략 | 현재 frame의 geometry/visibility/순서 변화 판정과 실제 필요한 상태·알림 갱신. 모든 스크롤을 O(1)로 약속하지 않음 |

카운터는 `sourceBuild`, `projection`, `records/encode`, `Content ready`를 구분하며 같은 pass ID와 demand revision으로 연결한다. 기존 timing/ring을 먼저 재사용하고 필요한 누락 필드만 추가한다. 서로 다른 구간의 최대값을 더하지 않는다.

### 6.3 새 성능 판정안

아래는 **구현 후 검증할 설계 목표**이며 현재 달성값이 아니다. 기준을 코드 수정 후 결과에 맞춰 느슨하게 바꾸지 않는다. 기존 ≥500ms 검사는 회귀 경보로 남기되 그것만으로 통과하지 않는다.

1. 동일한 60Hz 연속 12개월·빠른 24개월·양방향 재접촉에서, 진행해야 하는 활성 구간의 **offset 무진행 ≥100ms 0회**를 요구한다. 실제 정지 명령·끝 경계·델타 0·정상 반전 순간을 정체로 세지 않도록 입력 궤적과 함께 판정한다.
2. refresh 주기를 `T`라 할 때, 입력 수신→그 이동을 반영한 게시 지연의 초기 목표는 **p95 ≤ 2T, 최대 ≤ 4T**다. 60Hz에서는 약 33.3/66.7ms다. 로그의 consumedThrough가 증가했어도 표시 offset이 해당 이동을 반영하지 않으면 반영 완료로 세지 않는다.
3. contact 중 `requested(t)`와 `displayed(t)`를 **같은 시각**에 비교하고, 각 frame의 consumedThrough 기준 기대 offset과도 대조한다. 정상 clamp/축/RTL을 반영한 기대 궤적, 게시 수, 서로 다른 offset 수, 시간 지연, px backlog를 함께 제시한다. 고속 이동을 임의의 고정 px 문턱 하나로만 판단하지 않는다.
4. 새 월 demand→coverage-ready의 p95·최대와 각 경계의 실제 준비 여유를 대조한다. 평균 처리량이 수요를 넘더라도 긴 꼬리 때문에 정체가 생기면 미달이다. 필수 신규 페이지 수와 재사용 수를 분리해 집계한다.
5. App의 필수 동기 구간은 60Hz에서 **긴 구간이 한 refresh를 넘지 않는 것**을 우선 목표로 잡는다. 이를 못 지키는 남은 원본 호출을 이름과 비용으로 기록한다. 임의 사용자 callback 전체에 이 상한을 보장한다고 주장하지 않는다.

이 목표들은 지정된 입력·공급·장치에서의 software publication 판정이다. 무제한 속도의 입력에 대한 보장이나 물리 latency/scanout 수락으로 확대하지 않는다. ring loss·진단 overwrite가 구간 판정에 영향을 주면 해당 최대/백분위는 notVerified로 남긴다.

## 7. 구현 순서와 중단 기준

각 챕터에서 관련 구현과 소비자를 묶고, 국소 정확성 검사를 거친 뒤 통합 검증한다. 수정마다 전체 앱을 반복 빌드하거나 수백 번 입력하지 않는다. **W11-00 → W11-00A → 필요한 W11-00B → W11-04의 대상 구간 검증**을 먼저 진행한다. 접근성 개편만으로 목표가 충족되면 W11-01–03을 억지로 구현하지 않고 후속 선택지로 남긴다. 미달이면 남은 병목 근거에 따라 W11-01–03으로 이어간다.

### W11-00 — 대표 경로와 최소 입증 범위 고정

대상: [host.ts](Nelyx/runtime/app/host.ts), [capture.ts](Nelyx/runtime/app/capture.ts), [scene.ts](Nelyx/runtime/engine-client/scene.ts), [날짜 생성 TS](packages/material/src/generated/date/calendar_date_picker.generated.ts).

- 현 diff·소비자·공급을 다시 읽고, 새 월 한 번의 필수 원본 실행과 projection 작업을 구분한다. 현재 기록을 새로운 baseline인 것처럼 복사하지 않는다.
- §2.1의 A–D와 기존 재사용을 먼저 대조한다. 첫 직접 projection 후보도 기록하되 접근성 분리 결과 전에 전면 개편 대상으로 확정하지 않는다. text/box만 빨라져도 Ink·semantics 때문에 대부분이 기존 capture로 돌아가는지 포함한다.
- 원본 build/callback trace, native record/graph, 메모리/할당, demand→coverage 지연의 비교 방법을 고정한다. 기존 검사 도구를 확장하고 별도 장기 수집기를 만들지 않는다.

**완료:** 제거할 중간 표현·보존할 부작용·지원 범위·fallback 이유·성능 반증 기준이 구체적이다. 이 단계만으로 제품 통과를 기록하지 않는다.

### W11-00A — 접근성 비용 분리와 소비자 계약 고정

대상: [App semantics bridge](Nelyx/runtime/app/semantics.ts), [SemanticsBinding](Nelyx/src/framework/semantics/binding.ts), [SceneWriter](Nelyx/runtime/engine-client/scene.ts), [Core frame](Nelyx/engine/core/scene/frame.cpp), [Windows Interaction](Nelyx/engine/platform/windows/interaction.hpp), [UIA tree](Nelyx/engine/platform/windows/interop/SemanticsTree.h).

- §2.4의 경계별 최소 계측과 counter를 기존 진단에 연결한다. source·frame·UI owner의 대기와 실행을 분리한다.
- TapRegion·focus/editor·geometry·layers·UIA action·TextPattern 소비자를 목록화하고 현재 snapshot/lease 계약을 고정한다. semanticsSnapshot 전체를 제거하는 실험을 기본값으로 삼지 않는다.
- resident와 cold 월, UIA query/청취 조건을 나눠 짧게 확인한다. 사용자 물리 입력을 검사 도구 부하와 혼동하지 않는다.

**완료:** A–D 중 큰 비용 또는 불필요한 반복이 확인된 위치, 보존해야 할 소비자, 후보 변경을 선택한다. 접근성 비중이 작으면 주원인 가설을 내려놓고 W11-01/02 후보를 진행한다. 수집만 반복하며 구현을 미루지 않는다.

### W11-00B — 접근성 구조·속성·geometry의 증분 소비

W11-00A에서 확인한 비용에 해당하는 부분만 묶어서 구현한다. 모든 플랫폼의 접근성 파이프라인을 일괄 재작성하지 않는다.

1. App은 우선 임시 SemanticsNode 목록과 bounds Map의 중복 변환을 줄인다. 필요하면 기존 observation index를 이용한 delta 또는 publication별 resolver로 연결하고 동기 rect 조회·삭제·무효 publication 의미를 유지한다.
2. Windows는 변하지 않은 semantic metadata/UTF-16 문자열과 peer를 유지하며 최신 geometry/commit만 적용하는 경로를 만든다. 변경 topology/order·custom action은 별도로 처리하고, 기존 delta 함수의 전체 배열 복원도 제거한다.
3. Source 생성·metadata가 큰 비용이면 기존 static/cacheable 경로의 빠진 revision을 보강한다. 공개 Semantics/State·callback 의미를 유지하며, 생성기 변경이 필요할 때 W11-02의 원본 검증을 함께 적용한다.
4. Core semantics 배열/순서 작업은 측정상 필요할 때만 바꾼다. 같은 scene 재사용을 퇴행시키거나 새 월의 의미 조립을 생략하지 않는다.

**완료/중단:** §8의 접근성 회귀와 해당 Windows 시나리오를 통과하고 실제 처리량·표시 backlog의 개선을 확인한다. 정확성만 통과하면 기능 PASS/성능 미입증으로 구분한다. snapshot/액션 의미가 깨지면 후보를 채택하지 않는다. 관련 비용은 줄었지만 새 월 지연이 남으면 남은 Source/projection을 W11-01–03에서 처리한다.

### W11-01 — 기존 writer로 들어가는 직접 binding 경로

대상: [render object](Nelyx/src/framework/rendering/object.ts), [framework](Nelyx/src/framework/widgets/framework.ts), [host.ts](Nelyx/runtime/app/host.ts), [capture.ts](Nelyx/runtime/app/capture.ts), [scene.ts](Nelyx/runtime/engine-client/scene.ts).

- binding identity·dirty kind·payload 소유·dependency edge를 연결한다.
- 기존 checkpoint/RecordPatch에 직접 입력을 추가하고, host의 Source 완료 경계에서 봉인한다.
- 기존 producer와의 혼합 subtree, synthetic part, NACK·cancel·close를 하나의 writer에서 처리한다.
- 최초에는 Core wire·scheduler·coverage 정책을 변경하지 않는다. 충분한 정확성 없이 native validator까지 함께 교체하지 않는다.

**완료:** 동일 입력의 reference 경로와 최종 record/명령 의미·관찰/입력 결과가 같다. 같은 handle 배정 순서가 가능한 fixture는 bytes도 비교한다. 배정 순서가 달라지면 handle을 정규화한 graph와 실행 결과를 비교하고, byte 동일이라고 부르지 않는다. 직접 영역의 SceneNode/capture 재구성은 없어야 한다.

### W11-02 — 생성 코드의 필수 실행과 불필요한 표현 분리

대상: [날짜 생성기](tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts), [Dart emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts), [입력 manifest](tools/Nelyx.FrameworkToTypeScript/data/material-date-picker.json), 관련 [date adapter](packages/material/src/internal/date).

- 원본 날짜 pin `71e4717a61786faab4c7aa39825989305ed29e8a`와 normalized source hash를 확인하고 생성기/adapter에서 변경한다. 생성 TS만 수작업 수정하지 않는다.
- effect가 증명된 좁은 IR 패턴부터 specialization을 구현한다. generated constructor의 generic field 초기화를 일괄 바꾸는 과거 실패 실험을 그대로 재시도하지 않는다.
- 원본과 동등한 State·Key·FocusNode·상속 의존성·callback 실행을 확인한다. 직접 projection을 껐을 때도 Source 개선의 독립 효과를 확인한다.
- 기존 격자 숫자 program과 theme 기본값 공유를 유지한다. 새로운 month cache나 resolver 결과 cache로 수치를 낮추지 않는다.

**완료/중단:** 동일 cold 월의 Source 필수 비용·projection 비용·할당량을 따로 비교한다. 올바른 직접 projection 후에도 원본 Source가 예산을 압도하거나 specialization이 유의미한 비용을 제거하지 못하면 **설계 효용 PARTIAL/미입증**으로 기록한다. 임의 객체·callback 생략으로 진행하지 않고 남은 실제 hot path를 근거로 설계를 재검토한다.

날짜 생성기 전체 분석/재생성은 요구 언어 버전을 만족하는 Dart SDK로 실행해야 한다. §12에서 도구 프로젝트의 과도한 SDK 하한을 `>=3.12.0`으로 조정했고, analyzer 14.4.0과 lockfile을 유지한 채 시스템 Dart 3.12.2로 전체 `--check --verify`를 통과했다. TS suffix 비교로 전체 generator 검증을 대체하지 않는다. 별도 dev SDK나 전역 SDK/PATH 변경은 필요하지 않다.

### W11-03 — 달력 전체와 일반 소비자 연결

대상: [scroll.ts](Nelyx/runtime/app/scroll.ts), [grid.ts](Nelyx/runtime/app/grid.ts), [native-sliver.ts](Nelyx/src/framework/rendering/native-sliver.ts), 직접 projection을 소유한 렌더 모듈.

- 새 월 생성, header 갱신, 날짜 상태·Ink·semantics·focus를 포함해 직접 경로의 실제 적용 범위를 확인한다.
- constraint-only 갱신·delegate 교체·방향 반전·KeepAlive/parking·취소된 준비 복구를 보존한다.
- 일반 목록과 버튼의 같은 render 종류에도 연결한다. 미지원 API를 조용히 다른 표현으로 치환하지 않는다.

**완료:** correctness oracle가 통과하고, 새 월에서 제거된 작업량이 확인된다. 남은 fallback이 hot path를 차지하면 완료로 표시하지 않는다.

### W11-04 — 현재 공급의 통합·성능 반증

- 변경된 Core/package·engine·Windows App 공급을 맞추고 sourceIdentity·번들·실제 PID/HWND/DPI를 확인한다. native를 바꾸지 않았다는 사실도 검증하고 필요 없는 native 재빌드는 생략한다.
- 일반 Windows App SDK CLI 앱을 [PowerShell 검사](Nelyx/eng/check-windows-scroll.ps1)로 조작한다. CUA/sky와 별도 진단 host를 제품 성능 증거로 사용하지 않는다.
- §8의 기능·수명·성능 시나리오를 통합 검사한다. profiling을 켠 실행과 끈 실행의 시간을 섞어 개선율을 계산하지 않는다.
- 정확성은 통과했지만 §6의 연속 표시 목표에 미달하면 다음 병목의 owner를 기록한다. 무제한 cache·입력 속도 제한·animation 단축으로 수치를 맞추지 않는다.

**완료:** 같은 시나리오·관찰 기준·완전한 수집 아래 새 공급의 실제 표시 추종을 확인한다. 합성 결과와 사용자 물리 결과를 분리한다.

### W11-05 — 물리 확인과 실행 계약 갱신

- 사용자의 빠른 왕복·재접촉에서 체감 끊김·날짜 선택·반전·정상 close를 확인한다. 자동 검사는 물리 결과를 대신하지 않는다.
- 미해결 문제와 다음 파일/조건을 기존 문서에 연결한다. 문서 상태 변경을 구현·전체 제품 완료로 해석하지 않는다.
- [work10 §8](work10.md#8-work9-종료와-잔여-의무-이관)의 다른 API·플랫폼·제품 전환 의무는 그대로 유지한다.

## 8. 반드시 통과해야 할 검증

| 묶음 | 검사 내용 | 기존 출발점 |
| --- | --- | --- |
| Source 의미 | init/update/build/deactivate/dispose, Key 재배치, GlobalKey·BuildContext 조회, Inherited 의존성, delegate/predicate/상태 resolver의 순서·예외 | [framework](Nelyx/src/framework/widgets/framework.ts), [날짜 compiler 검증](tools/Nelyx.FrameworkToTypeScript/verify-date-picker.ts) |
| 투영·transaction | mutable/accessor 격리, 같은 paint/새 callback, event-policy 비트, generation, reparent, dependency, NACK·OOM·ACK 불확정, in-flight 중 추가 수정 | [check-incremental-capture.mjs](Nelyx/eng/check-incremental-capture.mjs) |
| 원본 생성기·Hermes | pinned Dart oracle, 전체 regenerate/check, 실제 배포 ESM과 pinned compiler/VM. 일반 Node 성능만으로 Hermes 개선 판단 금지 | [날짜 생성 README](packages/material/src/generated/date/README.md), [check-hermes-syntax.mjs](Nelyx/eng/check-hermes-syntax.mjs) |
| 테마·날짜 | 선택/disabled/today/hover/focus/pressed, theme 교체, locale·calendar delegate·predicate 변경, 월 경계·윤년·부분 행·DPR·RTL·text scale | [check-date-defaults.mjs](Nelyx/eng/check-date-defaults.mjs), [check-date-layout.cpp](Nelyx/eng/check-date-layout.cpp) |
| Source/Content 정합성 | canceled document 뒤 다음 입력 진행, 실제 pending Content 대기, 오래된 root 미게시, header/grid/semantics/hit-test 정합성 | [check-immediate-reads.mjs](Nelyx/eng/check-immediate-reads.mjs) |
| 접근성 내용·geometry 분리 | 순수 이동에서 label/role 재구성 없음, clip 진입/이탈·숨김·merge/order 변경, selected/enabled·locale·custom action 갱신, 같은 값/새 callback, 삭제·generation 교체 | [Semantics bridge](Nelyx/runtime/app/semantics.ts), [Core frame](Nelyx/engine/core/scene/frame.cpp), 기존 native/Source semantics oracle |
| 접근성 실제 소비자 | TapRegion inside/outside, focus·편집·TextPattern·paragraph lease, UIA invoke/custom action, route/announcement, 갱신 중 UIA 재진입, stale 액션 거부 | [tap-regions.ts](Nelyx/runtime/app/tap-regions.ts), [Interaction](Nelyx/engine/platform/windows/interaction.hpp), [SemanticsTree](Nelyx/engine/platform/windows/interop/SemanticsTree.h) |
| 접근성 관찰 조건 | 비청취/청취, 실행 중 client 접속, 이벤트 미구독 query, 활성 구간 UIA polling 유무, 수집 off/on을 구분 | [PowerShell 검사](Nelyx/eng/check-windows-scroll.ps1)와 기존 native trace. 기능을 생략한 진단은 수락 근거에서 제외 |
| 표시·입력 | 작은 접촉 0.4/0.8페이지, 연속 12개월, 빠른 24개월, 빠른 양방향 재접촉, resize/cancel/선택/close, 일반 목록 | [check-windows-scroll.ps1](Nelyx/eng/check-windows-scroll.ps1) |
| 회수·메모리 | resident/parked/provisional/retired/GPU별 bytes, 방향 전환 반복 후 비증가, 취소·close의 lease/credit 회수, workersJoined | 기존 Core/native quota·lease 검사와 Windows 종료 요약 |

빠른 입력에서 모든 input sequence의 수신·소비만 확인하지 않는다. 표시 offset, 실제 draw transform, 동일 snapshot의 header/grid·hit-test를 대조한다. 픽셀은 원본 캡처로 확인하고 축소 이미지의 판독을 결함 증거로 단정하지 않는다. 한 사용자 입력이 두 display frame 사이에 발생하면 실제 게시 시점으로 평가하며, refresh보다 높은 input rate 자체를 실패로 세지 않는다.

공통 TS 경로 변경은 Web single-worker/threaded에도 영향을 줄 수 있다. 최소 해당 배포·회귀를 수행하고 Windows 제품 결과와 구분한다. ABI를 바꾸지 않더라도 다른 플랫폼의 생성 코드 소비를 점검한다. Android native 공급·제품 실행 및 Linux/Apple 검증을 수행하지 않았다면 각각 notVerified/기존 DEFERRED로 남긴다. Windows PASS를 전체 플랫폼 호환으로 확대하지 않는다.

검사마다 **20분 timeout**, 일반적으로 30회 이내의 필요한 반복만 사용한다. 소유 임시 출력·프로세스·mapping·timer·staging은 finally에서 회수한다. 현재 dist만 남기며 immutable receipt·history JSON·설치본 사본·archive를 누적하지 않는다. 기존 정리 차단 기록을 이번 문서 작업에서 해결했다고 주장하거나 다른 API로 우회하지 않는다.

## 9. 대안과 이번 선택의 한계

| 대안 | 이번에 주 해법으로 선택하지 않은 이유 |
| --- | --- |
| 더 많은 월을 미리 생성 | 유한 메모리에서 `μ <= λ`를 해결하지 못하고 첫 준비·퇴거 비용을 늘린다. |
| 달력을 C++로 다시 작성 | 원본 delegate·predicate·State·Ink·semantics와 별도 구현의 동등성 부담이 크며 기존 소유권을 바꾼다. |
| 마지막 월만 즉시 그리거나 bitmap 이동 | 실제 선택·focus·접근성·연속 입력과 분리된 그림으로 비용을 숨길 수 있다. |
| JSI 교체 또는 JS worker 추가 | 원본 Source의 같은 구성·투영 작업은 남는다. 동일 JS 객체/BuildContext를 다른 owner에서 실행할 수 있다는 전제도 성립하지 않는다. |
| 모든 build를 cooperative scheduler로 분할 | 동기 lifecycle·callback 의미를 바꾸고, 총 작업량 부족을 해결하지 못한다. 안전한 순수 후처리 구간에서만 보조적으로 검토한다. |
| payload 캐시만 추가 | 같은 데이터는 줄여도 처음 생성하는 월의 Widget·projection 구조 생성은 남는다. 현재까지의 공유 최적화만으로 충분하지 않았다는 기록이 있다. |
| 모든 Widget을 가상 Element로 컴파일 | BuildContext·Key·lifecycle의 관찰 가능성이 넓다. 이 설계는 그런 새로운 framework를 전제하지 않는다. |
| 접근성을 모두 끄거나 청취자 없으면 UIA tree를 폐기 | 원본 동작·TapRegion 액션·동기 조회·늦게 접속한 UIA client가 영향을 받는다. 비용은 경계별로 분리하고 내용·geometry의 재사용으로 줄인다. |

이번 제안의 가장 큰 위험은 **실제 필수 Source 객체 생성이 지배적이면 직접 투영만으로 목표에 도달하지 못한다는 점**이다. 다른 위험은 dependency 누락으로 인한 stale 화면, mixed 경로의 이중 소유, static specialization의 의미 변경이다. 각각 Source/투영 분리 측정, 참조 무효화 oracle, 하나의 writer checkpoint, pinned 원본과의 differential 검사로 반증한다.

그래서 첫 투자는 **접근성의 반복 구성이 실제 지연에 얼마나 기여하는지 분리하고, 확인된 소비 경계를 원본 의미를 보존하면서 줄이는 것**이다. 그 뒤 남은 새 월 Source/projection 비용에 직접 binding과 생성기 specialization을 적용한다. 제거한 객체 수만 줄고 demand→coverage와 표시 추종이 개선되지 않으면 성공으로 판정하지 않는다.

## 10. 현재 완료 범위와 다음 실행점

- [x] 최신 문제 기록과 현재 Source/capture/writer/scroll/grid 구조 대조.
- [x] 원본 의미 보존, 직접 투영, 생성기 specialization, 단계별 반증·검증 기준 설계.
- [x] 접근성 A–D 경계, 기존 재사용, TapRegion/게시 관찰 의존성, UIA delta의 전체 복원 경로를 소스로 확인하고 선행 계획에 반영.
- [x] W11-00 대표 경로·최소 입증 범위 고정. §11의 공통 모듈·혼합 adapter·wire oracle 및 성능 반증 기준.
- [ ] W11-00A **PARTIAL** — metadata/App/Core/UIA·Source CPU/GC·명시적 준비 callback에 이어 원래 builder/즉시 rebuild/dirty 자손/render commit을 구분했다. 긴 build는 주로 자손 처리에 남는다. constructor/label formatting 단독 비용 및 비청취 조건은 미분리.
- [ ] W11-00B **기능 PASS / 성능 PARTIAL** — App의 중복 목록·Map 재구성 제거, Source Semantics 생성 최적화와 독립 의미 비교 PASS. Core/UIA 전면 개편은 현재 측정 근거로 선택하지 않았다.
- [ ] W11-01 **PARTIAL** — 공통 박스 9종의 module data, Ink/paragraph 참조와 내부 Focus/Gesture의 봉인 명령을 같은 checkpoint/RecordPatch로 전달. 참조 대상 slot/generation과 accepted 소유 record를 검증해 retained subtree를 재사용하고, 같은 sealed program은 callback record와 독립적으로 공유한다. 스칼라 인수의 같은 명령은 인코더 실행 전 재사용하지만 전체 필드별 dirty binding journal은 미구현.
- [ ] W11-02 **설계 효용 PARTIAL** — null-aware/final-field schema·날짜/연도 지역 helper 결합과 Source `TextStyle.apply`를 구현·대조했다. 시스템 Dart 75/75·원본 oracle 및 실제 생성 식의 효과 비교 PASS. Hermes class spill을 고쳐 원래 constructor·상속·`new.target`를 native JS class로 실행하는 실제 App을 검증했다. Source build와 필수 실행·할당의 owner별 독립 분리는 여전히 미달/미완료다.
- [ ] W11-03 **PARTIAL** — 공통 목록/버튼·달력, Key/Ink/참조·취소 복구 회귀 PASS. §17.3 동일 pass의 binding/adapter **715/132**를 확인했다. 모든 render 모듈·UIA 실제 소비자의 통합 완료는 아니다.
- [ ] W11-04 **PARTIAL** — §17.5 최종 Windows 네 시나리오·실제 연도 선택, 양쪽 Web profile 월 왕복/resize/연도 선택 기능 PASS / 연속·빠른 이동 성능 FAIL. Core의 양축·확대/축소·부분/정수 페이지·일반 목록 anchor 회귀 PASS. 같은 Core의 독립 설치 검증은 §15에 있다. demand→coverage-ready는 notVerified다.
- [ ] W11-05 **PARTIAL** — 기존 실행 계약과 남은 owner를 갱신했다. 사용자 물리 입력·전체 display/scanout·resize 성능은 미검증이다.

**현재 실행 계약:** 사용자 중간 마무리 요청으로 **PAUSED / PARTIAL**이다. §18에서 재개 범위를 고정한다. §17.5의 최종 anchor 공급과 §17.3의 첫 native-class 공급, §11–16의 이전 공급을 구분한다. 직접 모듈 데이터와 binding 참조까지 확장했지만 전체 render setter의 필드별 journal 완료로 설명하지 않는다. generated constructor 일괄 변경이나 원본 Widget/State/콜백 생략으로 지연을 숨기지 않는다. 사용자 물리 확인·전체 display/scanout은 별도 미검증이다.

## 11. 2026-11-13 구현·측정 기록

### 11.1 대표 경로·소비자와 구현 경계

시작 시 `git status --short`가 비어 있었고, 원본 날짜 → Element/State → render metadata → capture → writer → Content → publication 경로를 다시 읽었다. source/engine `d900a3719162f865b9672ee7a2fd532a8e7790dc2514077965e5d29f90b321d9`, App JS `3f1a0dab7a5dde419b06e3390509fe5be6d032221076ef6aaeec7564b024e045`, HBC `302c88e15d7f1e63ebcaf6168cd561c2d6101976af1e222dafd78e8fe23b0bfb`, engine 356 / App 10 files를 현재 파일로 확인했다. 과거 표를 baseline으로 복사하지 않고 이 공급을 다시 실행했다.

- [App bridge](Nelyx/runtime/app/semantics.ts)는 임시 `SemanticsNode[]`와 게시별 전량 rect Map을 만들지 않는다. 현재 immutable publication과 기존 [observation index](Nelyx/runtime/engine-client/node-index.ts)를 묶은 동기 resolver를 [binding](Nelyx/src/framework/semantics/binding.ts)에 설치한다. 첫 query의 index 구성은 기존 geometry/focus 소비자와 공유하고 query마다 다시 순회하지 않는다. 공개 `updateViewSemantics`의 tree·child/source ID·legacy view alias API는 유지한다.
- publication/metrics/device/visibility/close mismatch, 숨김·clip 밖·삭제·다른 generation은 null을 반환한다. 반환한 Rect는 freeze하고 이후 게시에서 제자리 변경하지 않는다. stop/close는 resolver를 버린다. stale action listener 동안 rect를 비우고 기존 action dispatch 후 현재 게시로 복원한다. transport의 publication 관찰과 geometry/layers/focus/editing/TapRegion 소비자는 유지한다.
- [공통 직접 투영](Nelyx/runtime/engine-client/scene.ts)의 `RenderBinding`은 box/stack/paragraph/clip 중 닫힌 data configuration을 기존 codec으로 봉인한다. native handle은 기존 writer checkpoint에서 배정하고 명령의 목적지에 연결한다. 공개 `SceneNode` producer는 기존 mutable/accessor 경로를 사용한다. callback은 App record에 남고 callback 교체와 event-policy 변경을 구분한다.
- native paint의 다른 node 참조, 실행형 payload, control/editor/image·builder 등 미지원 capability는 기존 adapter로 남긴다. raw `OriginalNativeRender`를 직접 입력으로 잘못 분류하지 않는다. [capture 재연결](Nelyx/runtime/app/capture.ts)은 자식만 바뀌면 부모의 봉인된 program을 공유한다. 같은 program의 accepted config/command는 다시 복제하지 않는다. handle generation 변경은 이전 in-flight bytes를 수정하지 않는다.
- 새 transaction/queue/renderer·month cache는 추가하지 않았다. 원본 Widget/State/Key/FocusNode·predicate·resolver·lifecycle 실행, 최대 4페이지 준비 정책, Core layout program과 accepted/prepared/published/retired fence는 유지한다.

**남은 구조 비용:** Source module이 만들던 options와 capture의 부모/자식 순회는 아직 남는다. 직접 지원 영역에서 SceneNode 및 generic input snapshot을 줄였지만, render setter부터 필드별로 기록하는 전체 `O(M+E)` journal과 모든 synthetic/Ink 의존성을 완성한 것은 아니다. `bindingRecords`, `bindingCommands`, `bindingProgramReuses`, `projection.bindings/adapters`로 실제 경로를 구분한다.

### 11.2 접근성 비용을 분리한 결과

계측은 기존 App 종료 diagnostics와 Windows stats 출력에 넣었다. constructor마다 타이머를 추가하지 않았다. [controls](Nelyx/runtime/app/controls.ts)는 native Semantics metadata 구성 횟수/경과 시간을 집계하고, App refresh/query, [Core frame](Nelyx/engine/core/scene/frame.cpp)은 assembly/copy/order-check/order, [Windows Interaction](Nelyx/engine/platform/windows/interaction.hpp)과 [UIA tree](Nelyx/engine/platform/windows/interop/SemanticsTree.h)는 packet/sort/provider/notification과 peer 생성/재사용·청취 여부를 분리한다. UI에서 관찰한 Core frame의 집계이며 폐기된 모든 frame의 전수 시간은 아니다. elapsed 시간은 owner 대기를 포함할 수 있고 App 정수 ms의 0을 무비용으로 해석하지 않는다.

직접 입력 첫 표본의 전체 실행 집계:

| 경계 | 관측 | 해석 |
| --- | --- | --- |
| A / metadata | 2,353회, 누적 99ms | capture에 포함된 하위 비용. Source SemanticsProperties 생성·label formatting 전체의 독립 시간은 아니다. |
| B / App | 유효 publication 44회, refresh 누적/최대 1/1ms, rect query 0, 전량 순회·임시 SemanticsNode 0 | 이 실행에서 사각형 query 수요가 없었으므로 게시마다 만들던 목록이 필요하지 않았다. 실제 query 의미는 별도 differential fixture로 검증했다. |
| C / 관찰된 frame | assembly 31회/9.314ms, copy 107회/3.809ms, order-check 5.507ms, sort 34회/2.967ms | 같은 scene 재사용을 보존했다. 서로 다른 frame의 누적 비용을 한 새 월의 latency로 쓰지 않는다. |
| D / Windows | sync 200회, packet 누적/최대 90.931/1.365ms, provider 27.564/3.108ms, notification 9.658ms, peer 생성/재사용 605/10,653 | notification은 provider 하위 구간이다. 합산하지 않는다. 모든 sync에서 UIA 청취가 관측돼 비청취 조건으로 보고하지 않는다. |

이 표본은 **Source build/capture/scene에 남은 긴 구간보다 Core/UIA 단계가 작다**는 조사 근거다. Windows provider 전면 재작성이나 접근성 전체 skip을 선택하지 않았다. Source 접근성 constructor와 나머지 Widget 생성의 비중은 추가 분리가 필요하다. 실시간 UIA polling은 초기 위치/시나리오 후의 기능 query와 구분했고, 빠른 활성 입력 구간에는 UIA polling을 넣지 않았다.

### 11.3 기준선과 중간 후보 — 최종 공급 결과와 구분

| 공급/입력 | 관측과 판정 |
| --- | --- |
| 시작 공급, 빠른 24개월 | PID 27060 / HWND 3607306 / DPI 192. 12회 재접촉, 120개 전량 접수·소비, 거부 0, 2026-11→2024-11 및 15일 선택·close PASS. 활성 App turn 최대 341.413ms, 표시 offset 공백 최대 383ms / ≥100ms 6회 / ≥250ms 5회, 최대 backlog 2,580px. 기존 500ms 경보 PASS가 W11 목표 PASS는 아니다. |
| App resolver+계측, 직접 입력 전 | engine `fcd5e7cff95859ed988fb3689c7c4672faadfc666bb20746a4db1d5ec6d33d40`, JS `8b1b0ab99808c118676b7de1fc4a3df7675227cdfbafd2d9f385e34f988afd69`, HBC `9c8f5563fe876025a6892c9be4c2351772f1ac725ca411e06bab762308acd2b2`. 기능/close PASS지만 driver gap 110.760ms가 있어 성능 비교는 **notVerified**. raw offset 공백 723ms를 통과값이나 개선율로 쓰지 않는다. |
| 같은 공급의 CPU/GC 진단 1회 | 1,243 CPU samples. GC 표본 314개, `__defNormalProp` self 47개, Source build/capture stack이 관측됐다. GC 통계 구간 8.832초의 누적 GC 1.725초, 최대 pause 약 27.351ms, 총 할당 약 1.427GB. 단일 GC가 긴 정체의 원인이라는 증거가 아니며 비프로파일 실행과 개선율을 계산하지 않는다. |
| 직접 입력 첫 표본 | 같은 engine, JS `59fcb25265b0e279d775732414dfe0b64784c39389fbcbbe8acf9ad86fb623ab`, HBC `d8076b4dea4c6a02e8ed6857650c744876bf939cd92a16da2bec3d2d301dcaf7`. PID 46420 / HWND 1771984 / DPI 192. 120개 전량 접수·소비·거부 0, 24개월 이동·15일 선택·close PASS. driver 최대 77.757ms, offset 최대 364ms / ≥100ms 7회 / ≥250ms 5회, backlog 2,408px로 **W11 FAIL**. Source build/capture/scene의 각 최대 141/111/121ms는 서로 다른 pass일 수 있어 합산하지 않는다. |

첫 직접 표본의 전체 captureNode 반환은 binding 7,149 / adapter 3,462였고 writer는 binding record 14,497회를 처리했다. startup·기존 월·새 월이 섞인 실행 집계이며 cold 월만의 적용률이 아니다. 이후 자식 재연결에서 같은 program의 명령을 다시 복제하지 않도록 보완했으므로 위 JS/HBC와 시간은 그 보완 전 중간 결과다.

### 11.4 좁은 생성기 변경과 검증 범위

[body IR](tools/Nelyx.FrameworkToTypeScript/src/body-ir.ts)과 [Dart emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts)에 선택적 `single-local-property-read` 정책을 추가하고 [날짜 생성 recipe](tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts)에만 적용했다. analyzer가 local identifier receiver임을 증명하고 출력도 단순 identifier/property인 null-aware 읽기를 엄격한 null 조건식으로 출력한다. 효과가 불명확한 receiver·late 값·호출식은 기존 evaluate-once 경로를 유지한다. getter/Proxy property read 1회, `undefined`의 TypeError, throw identity·임시 변수 순서는 보존한다. 일반 constructor·상태 resolver·generic helper를 일괄 생략하지 않았다.

[달력 generated TS](packages/material/src/generated/date/calendar_date_picker.generated.ts)는 pinned 원본 분석으로 **전체 재생성**했다. day/year theme와 `_FocusedDate.maybeOf`의 정적 IIFE 13개 지점을 줄였고 [생성 문서](packages/material/src/generated/date/README.md)에 적용 경계를 기록했다. [검증기](tools/Nelyx.FrameworkToTypeScript/verify-date-picker.ts)는 실제 `_DayState` selector의 기존/새 출력에 null·undefined·getter·Proxy·throw differential fixture와 잘못된 정책 거부를 추가했다. 이 좁은 변환이 긴 월 준비를 해결했다는 성능 증거는 없다.

당시 기본 Dart는 3.12.2이고 **도구 프로젝트의 pubspec**이 `>=3.13.0-0`을 요구했다. 공식 archive와 SHA256을 대조한 **임시 Dart 3.14.0-296.0.dev**로 전체 `--write`, Material build, `--check --verify`를 수행했다. **75/75 declarations, errors 0**, 원본 Dart 날짜/localization oracle **12 dates / 11 inputs / 4 decimal cases PASS**다. 전역 SDK·PATH는 변경하지 않았고 임시 SDK·download·helper는 성공/실패의 finally에서 삭제했다. analyzer 자체의 요구로 적었던 설명은 §12에서 정정한다.

- [새 semantics 검사](Nelyx/eng/check-semantics-publication.mjs): 기존 eager rect oracle, lazy index 1회 공유, 같은 publication의 Rect identity, semanticGeometry/clip/숨김·삭제·generation, publication/metrics/device/visibility, stale action·legacy alias·공개 child/source ID·close PASS. cache는 현재 publication에서 조회된 유효 Rect만 보유한다.
- [직접 binding 검사](Nelyx/eng/check-render-bindings.mjs): 같은 handle 순서의 reference wire bytes, optional reset·adapter 전환, 새 callback/event bits, reparent·generation, NACK, mutable 값의 명령 봉인, 이전 bytes 불변, in-flight ACK 중 새 update, 자식 변경 시 부모 program 보존 PASS. fake ACK fixture의 범위이며 실제 UIA 재진입·TextPattern oracle을 대체하지 않는다.
- [이동 게시 판정 검사](Nelyx/eng/check-scroll-movement.mjs): 실제 반영과 입력 소비만 된 상태의 구분, 200ms backlog의 FAIL, 누락된 frame/input·궤적 불일치·NoTrace의 notVerified를 6개 결정적 fixture로 확인했다. 알려진 고정 폭 LTR 궤적에 한정하며 범용 gesture/물리 scanout oracle로 확대하지 않는다.
- 기존 incremental capture/journal, immediate reads의 실제 Core pending Content·취소 후 복구·publication fence, 재생성 후 날짜 기본값/상태 resolver, GlobalKey·충돌 Key·slot/lifecycle 및 Ink parking/복구 검사 PASS. native frame semantics equivalence·날짜 격자/RTL·빠른 반전·coverage·generation·lease/종료 회귀도 현재 native library로 PASS. 모든 검사는 20분 timeout을 사용한다.
- Core ESM/declaration/strict type, native/두 Wasm/Windows App SDK 공급, 생성기 tooling type, Material 및 실제 pinned Hermes 앱 번들 빌드 PASS. 변경 파일 lint/format과 diff 검사를 수행했다. 공통 TS 변경의 Web/Android 제품 실행을 완료한 뜻은 아니다.

### 11.5 최종 공급의 통합 실행 — 기능 PASS / 성능 FAIL

최종 [Windows 검사](Nelyx/eng/check-windows-scroll.ps1)는 `-Scenario All -RapidMonths 12 -PrecisionHz 60`으로 실행했다. 임시 SDK 작업과 빌드를 끝낸 뒤 시작했고 사용자 중단 요청 당시 이미 진행 중이던 실행만 정상 종료·회수했다. engine `fcd5e7cff95859ed988fb3689c7c4672faadfc666bb20746a4db1d5ec6d33d40`, ABI 2/schema 313408118, engine 356 / App 10 files, App JS `54c1ce4d2d7320eb2907c6c63d4d0bc69bc4feb55afb280f5786667b268971f3`, HBC `42aa28e51db1c0bc003d36e9292fa983c35842467771339d448491b672f606ab`다. PID 49060 / CLI 18304 / HWND 2228962 / DPI 192로 실제 실행 공급을 연결했다.

| 범위 | 최종 공급의 관측과 판정 |
| --- | --- |
| 기능 | 일반 목록 warm 정방향/역방향·새 영역·재방문 4구간, 연속 2026-11→2027-11 12개월, precision cancel, resize 후 달력 header/all days 및 `2027-11-15` 선택·close **PASS**. 픽셀 잉크 표본은 출력했으나 전체 원본 캡처의 시각 수락은 미완료다. |
| 연속 60Hz 입력 | 360 samples / 6,000.303ms, driver gap p95/최대 17.048/17.161ms, lateness 최대 0.754ms. 연속 입력 362개 접수·거부 0, 실제 월 이동 12개월. 활성 App turn p95/최대 341.282/407.606ms. |
| 실제 이동 게시 | 고정 폭 LTR의 입력별 목표 offset을 실제 게시 offset과 consumedThrough로 대조했다. 360/360 반영, 누락 0, 요청 궤적 오차 약 `1.67e-10px`. 수신→실제 이동 게시 p95/최대 **267.118/417.732ms**, ≥100ms 88개 / ≥250ms 23개로 **FAIL**. display publication의 관측이며 물리 scanout은 아니다. |
| 표시 offset 진행 | 활성 연속 구간 공백 최대 **424ms**, ≥100ms 9회 / ≥250ms 4회, 표시/논리 차이 최대 약 **263.733px**. 게시 gap 최대 40.266ms와 구분한다. |
| 전체 결과 | `functional=PASS`, 이전 `syntheticStallGoal=PASS`, `offsetStallGoal100ms=FAIL`, `movementLatencyGoal=FAIL`, `w11PerformanceGoal=FAIL`, `coverageReadyGoal=notVerified`, `performanceAccepted=false`. |
| 종료 | exit 0, closed status 0, reservedBytes 0, memoryTotal 0, workersJoined true, appExited true. ringLost/outputDropped 0. bounded traceOverwritten 12,820은 전체 실행의 누적값이며 입력별 반영 판정은 해당 구간의 완전성을 별도로 확인했다. |

마지막 App timing buffer는 192 samples 중 최근 128개를 보유했고 64개가 교체됐다. 그 범위에서 build/capture/scene 최대 **192/199/148ms**, publication observation 최대 **409ms**, layout observation 최대 **380ms**다. 서로 다른 pass와 중첩 구간이므로 합산하지 않는다. 전체 집계에서 projection binding/adapter **14,311/7,698**, writer bindingRecords **37,791**, bindingProgramReuses **23,480**이다. startup·새 월·기존 월이 섞인 누적 횟수이므로 cold 월 적용률이 아니다. 필수 Source 생성·module options·capture traversal·관찰 소비의 긴 구간이 남았다.

접근성 최종 집계는 A metadata **4,565회/207ms**, B publication **278회**, refresh 누적/최대 **18/1ms**, rect query·전량 방문·임시 SemanticsNode **0**이다. C 관찰 frame **624개**, assembly/copy **79/545회**, 누적 **22.639/22.972ms**, order-check/order **39.162/21.378ms**다. D sync **762회**, packet 누적/최대 **450.032/2.170ms**, provider **144.991/9.506ms**, 그 안의 notification **54.417ms**, peer 생성/재사용 **644/56,133**이다. 모든 sync에서 청취가 관측됐으므로 비청취 환경의 비용으로 해석하지 않는다. 이 누적값으로 단일 새 월이나 전체 정체의 원인을 확정하지 않는다.

**중간 실패와 미재검사:** 최종 generator 변경 전 JS `6066fc1a…` / HBC `004731f…`의 `All / 12개월 / NoTrace`는 목록 4구간 뒤 header/grid 월 불일치로 실패했다. Core idle이 최종 App `onPageChanged` 처리 완료를 보장하지 않아, 활성 측정 종료 후 목표 월을 `Wait-Month`로 기다리도록 검사 경계를 보완했다. 그 뒤 traced Calendar와 위 최종 traced All은 통과했지만 **수정 후 NoTrace 재검사는 미실행**이다. 최종 공급의 CalendarFast 24개월, CalendarContact 0.4/0.8페이지도 미실행이며 이전 공급의 결과로 대체하지 않는다.

### 11.6 PAUSED / PARTIAL — 보존 상태와 재개 지점

사용자의 **외출에 따른 중간 마무리 요청**으로 새 구현·추가 검사를 멈췄다. 위 최종 실행을 정상 종료하고 소유 App/CLI PID의 종료를 별도로 확인했다. 임시 SDK·download·검사용 helper와 소유 Windows 자원은 회수했다. 현재 소스 변경과 회귀 검사, 현재 dist는 보존하며 commit/reset·과거 설치본/trace/archive 누적은 하지 않았다. **사용자의 재개 요청 전에는 자동으로 계속하지 않는다.**

재개 시 다음 순서로 이어간다.

1. 현재 diff·source/dist/실행 JS·HBC identity를 다시 대조한다. §11.5는 중단 시점의 공급이며 이후 편집된 공급의 검증으로 옮겨 쓰지 않는다.
2. cold 월별 필수 Source constructor·SemanticsProperties/label formatting과 번역 helper·module options·capture/records·publication/layout observation 비용을 분리한다. 현재 binding/adapter 누적 횟수를 cold 적용률로 사용하지 않는다.
3. 남은 RenderBinding owner/part/dependency와 지원 모듈을 완성하고, 기존 checkpoint/ACK/NACK/timeout 및 synthetic/Ink 의존성을 보존한다. 현재 pilot은 필드별 전체 `O(M+E)` journal 완료가 아니다. 생성기 최적화도 증명 가능한 좁은 패턴만 확장하고 전체 regenerate/oracle을 다시 적용한다.
4. 변경을 묶은 뒤 최종 공급의 빠른 24개월·0.4/0.8페이지 접촉·NoTrace를 포함해 필요한 기능/표시 검사를 수행한다. 100ms offset 정체 0회, 이동 게시 p95 2T/최대 4T, demand→coverage-ready 연결을 별도로 판정한다. 이번 p95/최대는 측정된 **FAIL**이고 demand→coverage-ready는 **notVerified**다.
5. UIA 비청취·실행 중 client 접속, native Invoke/custom action·editor TextPattern/paragraph lease·재진입, Web/Android 제품 실행과 사용자 물리 트랙패드·전체 display/scanout·resize 성능을 각각 검증한다. Windows scoped PASS를 전체 호환으로 확대하지 않는다.

최종 상태는 **PAUSED / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 실제 기능 회귀 PASS와 연속 표시 성능 FAIL, 아직 실행하지 않은 소비자/물리 수락을 구분한다.

## 12. 2026-11-13 재개 구현과 현재 공급 검증

### 12.1 공통 모듈 데이터와 참조를 기존 writer에 연결

재개 시 `git status --short`는 비어 있었다. §11의 Source/capture/writer와 공급을 읽은 뒤 관련 변경을 묶어 구현하고 통합 검증했다.

- [native-box](Nelyx/src/framework/rendering/native-box.ts)의 명시적 data capability를 [boxes](Nelyx/src/framework/rendering/boxes.ts)의 Proxy/Constrained/Padding/Positioned/Align/Flex/Stack/Clip/Transform 9종에 연결했다. 해당 종류는 module data에서 codec으로 바로 봉인하며 중간 BoxConfiguration/Scene options와 descriptor eligibility 순회를 만들지 않는다. custom subclass는 capability를 상속하지 않는다. 부모 Flex/positioned 필드는 [layout](Nelyx/runtime/app/layout.ts)의 같은 함수로 양 경로에 적용한다.
- [SceneWriter](Nelyx/runtime/engine-client/scene.ts)는 봉인된 command body를 accepted 기록에서도 재사용하고 실제 diff 명령에만 목적지 handle을 연결한다. cold 기록마다 수행하던 명령 복제와 정렬을 줄였다. optional reset이 추가될 때만 순서를 다시 맞춘다. NACK·불확정 ACK·in-flight update는 기존 checkpoint와 terminal 계약을 따른다.
- Ink와 synthetic paragraph의 render 참조는 임의 콜백 대신 [host](Nelyx/runtime/app/host.ts)가 소유한 binding token으로 봉인한다. writer는 기존 두 단계 handle 배정 뒤 참조를 해석한다. 대상 generation 변경·재부착·NACK에서 이전 bytes를 수정하지 않는다. 참조를 가진 기록은 보수적으로 재검증하며, generic adapter에 token이 연결될 때도 해석한다. 공개 Scene producer의 accessor 읽기 순서는 바꾸지 않는다.
- [capture](Nelyx/runtime/app/capture.ts)는 실제 소비하지 않던 revision 사본과 보통의 부모에서 필요 없던 synthetic subtree Set/순회를 제거했다. 실제 synthetic 노드와 dependency·registration·parking·retirement·abort 처리는 유지한다. pass마다 created/captured/module/binding/adapter 횟수를 기록해 전체 누적치를 cold 월 적용률로 오인하지 않게 했다.
- [SemanticsProperties](Nelyx/src/framework/semantics/semantics.ts)의 78개 빈 own field 정의를 고정 schema의 `Object.defineProperties` 호출로 묶었다. 값 읽기·할당·final 보호·base freeze·subclass 확장 시점은 그대로다. inherited setter를 호출하는 단순 대입 변환은 사용하지 않았다.

모든 render setter를 필드별로 기록하는 완전한 journal은 아니다. 일부 adapter/module options, dirty ancestor 재연결과 writer record 순회가 남는다. 이전 generic 경로와 병렬 transaction 상태 기계를 추가하지 않았다.

### 12.2 생성기와 시스템 Dart

[생성 recipe](tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts)와 [emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts)에 선택한 Source owner의 final-field descriptor schema를 모듈 초기화 때 한 번 만드는 정책을 추가했다. 원래 constructor 입력 평가·필드 할당·보호 위치를 유지하며, Widget/State/FocusNode·callback을 재사용하거나 생략하지 않는다. 생성 TS를 수작업으로 바꾸지 않고 pinned 원본 전체에서 재생성했다.

[compiler oracle](tools/Nelyx.FrameworkToTypeScript/verify-date-picker.ts)은 기존/새 `_Day` constructor의 descriptor·입력 getter 순서·callback·subclass 필드·final 보호를 대조하고 잘못된 정책·owner·factory를 거부한다. 기존 lexical null-read oracle도 유지했다.

사용자의 **시스템 Dart SDK 사용 요청**을 반영했다. 원인은 analyzer 14.4.0 자체가 아니라 [도구 pubspec](tools/Nelyx.FrameworkToTypeScript/dart/pubspec.yaml)의 `>=3.13.0-0` 하한이었다. 이를 `>=3.12.0 <4.0.0`으로 맞췄다. 기본 `dart`는 **3.12.2**이며 `dart pub get --enforce-lockfile`을 통과했다. 의존성 버전·hash와 tracked lockfile 변경은 **0**이다. 기본 `dart`로 전체 `--check --verify`가 **75/75, errors 0**, 원본 Dart oracle **12 dates / 11 inputs / 4 decimal cases PASS**다. [실행 README](packages/material/src/generated/date/README.md)도 기본 시스템 명령으로 갱신했다.

초기 임시 SDK 다운로드/실행/정리 묶음 명령은 자동 승인 검토에서 두 번 거부됐고 구체 사유가 제공되지 않았다. 두 명령은 실행되지 않아 새 SDK나 다운로드 파일을 만들지 않았다. 이후 이미 있던 `.nelyx/date-picker-port/dart-sdk` 3.14를 발견해 첫 전체 재생성에 사용했지만, 최종 전체 비교/oracle은 위 시스템 3.12.2로 다시 수행했다. 기존 SDK는 이번 소유물이 아니므로 정리하지 않았다. 전역 SDK/PATH는 변경하지 않았다.

### 12.3 통합에서 드러난 입력·월 정합성 수정

첫 중간 공급 `ee67b9b8… / 7131a43e…`의 Windows All은 목록 4구간 뒤 precision 샘플 하나가 거부돼 실패했다. 그 구간의 offset 공백 193ms를 유효한 최종 성능 개선값으로 사용하지 않는다.

[Core enqueue](Nelyx/engine/core/scheduler/scheduler.cpp)는 host inspect와 input enqueue 사이에 Source document가 게시되면, pointer와 wheel에는 실제 geometry 호환성을 검사하면서 precision stream에는 그 경로를 적용하지 않았다. 실제 scroll target과 조상의 geometry가 같은 contact의 begin/update/lift만 계속 받도록 고쳤다. metrics/device/삭제/geometry 변경은 계속 거부한다. 추가한 [native oracle](Nelyx/eng/check-frame-reuse.cpp)은 **이전 library에서 precision begin 경합으로 FAIL**, 새 library에서 위 contact와 거부 fence를 통과했다.

첫 Web threaded 실행은 멈춘 뒤 두 인접 월의 날짜 59개를 노출해 실패했다. 원본 [pointerScroll](Nelyx/src/framework/widgets/scroll-position-with-single-context.ts)은 휠 갱신 뒤 `goBallistic(0)`을 실행하지만 Core가 이를 빠뜨렸다. 원래 PageScrollPhysics의 기존 spring을 호출하도록 연결했다. live precision contact는 lift까지 기다리는 동작을 유지한다. 이는 성능 수치를 맞추는 새 animation이 아니라 원본 휠 종료 의미의 복구다. fractional wheel의 zero-velocity spring과 완전한 page 정착을 native oracle에 추가했다.

### 12.4 제1 중간 공급과 검증

source/engine identity는 `820c61ccede47473f812bb469ca433a74fe4204b8ee48d2f84bcd92d21c6e625`, ABI 2/schema 313408118이다. native·single-worker·threaded·Windows App SDK를 재빌드했다. engine 356 / App 10 files, JS `410f7b93af0d0852874ab01899368f184dc40163a3187334be8ed3b809c4dc07`, HBC `d86d6655082d837f90b90648cc62c20026b520a6c21e52af096b815b1c6ec87d`를 실제 실행과 연결했다. 아래는 §12.6의 Source factory/Focus/Gesture 확장 전 중간 공급이며 최신 번들로 표현하지 않는다.

- Core ESM/declaration/strict type와 Material build, generator tooling type, 변경 TS/MJS lint/format, 독립 설치 Core의 strict 선언·package-only import·commit·공유 transaction·close PASS.
- 공통 박스 **27개 reference wire 비교**(RTL·제약·Flex/positioned parent), direct/generic adapter 전환, optional reset, 새 callback/event bits, forward Ink/paragraph 참조·generation·NACK·in-flight ACK·이전 bytes 불변 PASS.
- incremental capture/journal·실제 pending Content·superseded Source reply·취소 후 복구·publication fence, published semantics rect/stale action/alias, GlobalKey·충돌 Key·slot/lifecycle, Ink parking·복구, 원본 fitted grid/DPR/RTL/resize와 날짜 기본값/상태 resolver PASS.
- pinned Hermes compiler/VM에서 own-field descriptor·setter·subclass·불변성과 실제 배포 ESM 경계 PASS. 생성기 75개 선언과 원본 oracle은 별도 위 시스템 Dart 결과다.
- 현재 native library의 frame semantics·input geometry/metrics/device·precision/coverage/reversal/spring·날짜/RTL·lease 회귀 PASS.
- 현재 Web 앱의 **threaded(`isolated`)와 single-worker(`plain`)** 각각 12개월 왕복·header/날짜 전체·resize·메모리/Element/node 증가 제한·오류 없음 PASS. 두 context 모두 `reservedBytes=0`, `workersStopped=true`로 종료했다. 첫 Web 실패를 이 최종 결과로 대체하되 공급을 구분한다.

이 공급의 Windows `All / 12개월 / 60Hz`(PID 44576 / CLI 17128 / HWND 2099536 / DPI 192):

| 항목 | 실제 결과 |
| --- | --- |
| 기능 | 목록 4구간, 2026-11→2027-11, precision cancel, resize, header/all days, `2027-11-15` 선택과 정상 close **PASS** |
| 연속 입력 | 360 update/6,000.401ms, start/end 포함 **362 admitted / rejected 0**, driver lateness 최대 0.986ms |
| 이동 반영 | **360/360**, 누락 0, 요청 궤적 오차 약 `1.75e-10px`; 수신→실제 이동 게시 p95/최대 **185.287/280.813ms**, ≥100ms 71개 / ≥250ms 3개로 **FAIL** |
| offset 진행 | 공백 최대 **285ms**, ≥100ms 11회 / ≥250ms 2회. backlog 최대 **172px**. publication gap 최대 42.311ms와 별개 |
| 활성 App | turn p95/최대 **331.311/376.952ms**. 마지막 128 pass의 build/capture/scene 최대 **189/206/134ms**는 서로 다른 pass·중첩 구간이므로 합산하지 않음 |
| 종료·수집 | ringLost/outputDropped 0; exit/status 0, reservedBytes/memoryTotal 0, workersJoined/appExited true. bounded traceOverwritten 14,602와 App samplesOverwritten 96을 전 구간 무유실로 바꾸지 않음 |

같은 Source pass의 한 예(`document=156`, `input=374`)는 created/captured **383/838**, module/binding/adapter **71/514/324**, build/capture/scene **189/111/86ms**다. 이는 실제 해당 pass의 비용 분리이며 cold 월 1개만의 모든 constructor 비용이나 전체 새 월들의 적용률은 아니다. 필수 Source와 남은 투영 비용이 여전히 한 refresh를 크게 넘는다. §6의 목표를 낮추거나 cache/입력 제한으로 통과시키지 않는다.

같은 중간 공급의 빠른 이동·contact·NoTrace·CPU 표본은 §12.5, 이후 최신 공급은 §12.6에서 구분한다. `coverageReadyGoal`은 실제 demand revision→coverage-ready 연결이 없으므로 **notVerified**다. Windows 기능 PASS와 성능 FAIL, Web 기능 PASS를 제품 전체 호환·물리 입력·display/scanout·resize 성능 수락으로 확대하지 않는다.

### 12.5 중간 공급의 추가 시나리오와 원인 분리

모두 §12.4의 동일 JS/HBC이고 native engine은 같다. profiling 유무가 다른 실행으로 개선율을 계산하지 않는다.

| 시나리오 | 기능·수집 | 성능 경계 |
| --- | --- | --- |
| 빠른 24개월 역방향 / PID 10196, CLI 11952, HWND 920402 | 12 contacts, 96 updates/120 packets 전량 접수·거부 0, 약 2,209.862ms, 2026-11→2024-11, 15일 선택/close PASS | offset 공백 최대 **527ms**, ≥100/250/500ms **6/4/1회**, backlog **3,440px**, App turn 최대 **398.250ms**. W11 및 기존 500ms 경보 FAIL |
| 0.4/0.8페이지 양방향 / PID 38576, CLI 13948, HWND 2427174 | 각 36 updates, 180 packets 전량 접수·거부 0, cancel/선택/close PASS. 게시/서로 다른 offset 각각 37/36, 35/35, 35/35, 35/35 | 수신→게시 최대 **27.097/18.179/15.318/16.695ms**, consumed offset 오차 `<8.74e-11px`. resident contact 의미 PASS이며 새 월 준비 전체 성능 수락은 아님 |
| All/12개월/60Hz/NoTrace / PID 18828, CLI 47448, HWND 1444628 | 362 packets 접수·거부 0, 약 6,000.099ms, 목록·12개월·cancel/resize/날짜/close PASS | trace-disabled이므로 movement/offset 성능 **notVerified**. 기본 종료 diagnostics까지 모두 꺼진 실행으로 설명하지 않음 |
| Calendar/12개월/60Hz/CPU profile / PID 32952, CLI 27392, HWND 133438 | 362 packets 전량 접수, 기능/close PASS, CPU 1,265 samples | 계측 실행의 지연 **597.870/700.616ms FAIL**. 비계측 시간과 비교하지 않음 |

위 실행들은 정상 종료에서 reservedBytes/memoryTotal 0, workersJoined/appExited true를 확인했다. CPU self 표본에는 GC young **250**, `__defNormalProp` **55**, native `Object.defineProperties` **29**, `captureNode` **12**가 있었다. inclusive 표본은 `withNativeRenderConfiguration` **489**, `batchInvalidations` **450**, `buildScope` **449**, node/capture **299**였다. 함수별 exclusive 합처럼 더하지 않는다. GC 통계 9.858초의 누적 GC 1.380초/최대 pause 27.733ms/할당 약 1.178GB는 Source 구성과 할당을 추가로 줄일 근거이며, 단일 GC가 수백 ms 정체의 원인이라는 증거는 아니다.

### 12.6 Source 값 생성과 내부 Focus/Gesture의 직접 binding

- [Source Semantics factory](Nelyx/src/framework/semantics/semantics.ts)는 정확한 base 값만 고정 객체 schema로 새로 구성한다. 78개 own field의 순서·기본값·prototype·검증·freeze는 공개 생성자와 같다. 비어 있는 DiagnosticableTree 생성 이외의 사용자 생성자나 subclass를 생략하지 않는다. [Semantics Widget](Nelyx/src/framework/widgets/semantics.ts)의 기존 두 생성 위치만 연결했고 명시적으로 전달한 properties는 유지한다.
- [의미 비교](Nelyx/eng/check-semantics-construction.mjs)는 모든 descriptor, Proxy getter/예외 순서, callback/collection alias, debug assertion, inherited setter, subclass 및 Widget 연결을 대조한다. 실제 배포 Core의 pinned Hermes compiler/VM에서도 공개/Source factory의 prototype·descriptor와 subclass 확장을 확인했다.
- [내부 native node](Nelyx/runtime/app/native-node.ts)의 명시적 Source factory를 [Focus](Nelyx/runtime/app/focus.ts)와 [Gesture](Nelyx/runtime/app/gesture.ts)에만 연결했다. Widget/RenderObject와 Key·원본 recognizer·callback 수명은 같다. wire에서 사용하지 않는 Widget key만 투영 입력에서 제외하고 같은 writer에 봉인한다. 일반 producer로 update하면 capability를 해제하며 generic accessor 경로를 유지한다. editor/viewport/sliver 등 미지원 kind는 기존 adapter를 사용한다.
- [binding oracle](Nelyx/eng/check-render-bindings.mjs)은 실제 Source factory의 wire bytes, Focus/Gesture event-policy와 callback, Key 유지, callback 교체와 capability 해제·일반 producer getter 무실행을 확인한다. incremental capture, 실제 pending Content·superseded/cancel 복구, Ink parking도 재검사했다. 전체 `npm.cmd run check:types`와 변경 파일 lint PASS다.

Semantics factory만 반영한 제2 중간 공급 JS `2c418317b360ffae6a3900d572874d38f69a0e34d6aa226c0752bf95d8727273` / HBC `bd94346004be10a337f1e82eec49d8a72649944890ceeb6943ea4e59930b0b20`의 All은 PID 32044/CLI 6236/HWND 1837436에서 기능 PASS, 이동 p95/최대 **164.797/231.738ms**, offset 최대 **236ms**로 여전히 FAIL이었다. 두 Web profile도 기능/회수 PASS다. 이 공급의 수치를 다음 최신 공급과 섞지 않는다.

**§12 최종 공급:** engine identity/ABI/schema는 §12.4와 같고 이후 native 변경은 없다. Core와 Windows/Web 앱을 재빌드했다. Windows JS `71e4a33597c4b05c4532230c9cf6b622068c8b9b8fcef263081ade80a208ee35`, HBC `9884e292903228d3007de6063bc3a9edbf0c0449a585e9d30f49d2bab2f818e9`, engine 356/App 10 files, Windows 892/Web 891 modules다. 이 공급 뒤의 현재 결과는 §13에 있다.

§12 최종 All/12개월/60Hz(PID **4280**, CLI **42928**, HWND **4327756**, DPI **192**):

| 항목 | 결과 |
| --- | --- |
| 기능 | 목록 4구간, 2026-11→2027-11, precision cancel, resize, header/날짜 전체와 `2027-11-15` 선택, 정상 close **PASS** |
| 연속 입력 | 360 updates/6,000.584ms, begin/end 포함 **362 admitted/rejected 0**, driver lateness 최대 **0.627ms** |
| 실제 이동 게시 | **360/360**, missing 0, 궤적 오차 약 `1.89e-10px`, 지연 p95/최대 **156.544/262.225ms**, ≥100/250ms **42/1개** → **FAIL** |
| offset 진행 | 공백 최대 **266ms**, ≥100/250ms **8/1회**, backlog **160.533px**. publication gap 최대 **36.208ms**와 다름 |
| 활성 App | turn p95/최대 **280.853/384.562ms**. 보존한 128 pass의 build/capture/scene 최대 **174/205/119ms**, 서로 다른 pass·중첩 구간이므로 합산하지 않음 |
| 수집 | App samplesThrough **225**, 보존 128/overwritten **97**. bounded diagnostics를 전체 pass 전수라고 부르지 않음 |

동일 pass `document=151/input=401`은 created/captured **381/838**, module/bindings/adapters **72/707/131**, build/capture/scene **174/113/102ms**다. 이전 제1 중간 공급의 예와 달리 지원하는 Focus/Gesture도 binding으로 통과하지만, 이 두 pass를 통제된 동일 월 A/B 비교나 전체 cold 생성 적용률로 설명하지 않는다. 실제 필요한 Source build 하나만으로도 60Hz 한 refresh를 크게 넘는다.

### 12.7 §12 공급의 추가 통합과 남은 경계

모두 §12.6의 JS/HBC이며 매 실행의 PID/HWND를 확인했다. 다음 §13 공급과 구분한다.

| 시나리오 | 실제 결과 |
| --- | --- |
| 빠른 24개월 역방향 / PID 14812, CLI 34204, HWND 2689406 | 약 **2,227.000ms**, 12 contacts/96 updates, **120 admitted/rejected 0**, 2026-11→2024-11, 15일 선택·close **PASS**. 활성 구간 received 118은 경계 밖 begin/end와 전체 접수 120을 구분한다. offset 공백 최대 **528ms**, ≥100/250/500ms **8/3/1회**, backlog **2,408px**로 **W11 및 기존 500ms 경보 FAIL**. App turn 최대 **299.686ms**, 전체 App samples 63개/overwrite 0 |
| 0.4/0.8페이지 양방향 / PID 17080, CLI 13344, HWND 2754942 | 각 36 updates, **180 admitted/rejected 0**, cancel/resize/날짜·close **PASS**. 게시/서로 다른 offset은 39/36, 35/35, 35/35, 35/35. 수신→게시 최대 **30.037/12.311/12.884/18.743ms**, consumed offset 최대 오차 `<8.74e-11px`. 준비된 범위의 이동 의미 PASS이며 새 월 전체 성능 수락은 아님 |
| Calendar/12개월/60Hz/NoTrace / PID 39240, CLI 45972, HWND 1509784 | 약 **6,000.601ms**, **362 admitted/rejected 0**, 12개월·cancel/resize/header/날짜 선택·close **PASS**. driver lateness 최대 **0.573ms**. trace-disabled이므로 movement/offset/전체 W11 성능 **notVerified**. 기본 diagnostics는 계속 켜져 있음 |

Fast/contact/NoTrace는 ringLost/outputDropped **0**, 정상 exit/status **0**, reservedBytes/memoryTotal **0**, workersJoined/appExited **true**다. peak bytes는 각각 **511,470,486 / 523,103,467 / 527,773,593**이며 서로 다른 시나리오의 메모리를 한 상한 증명으로 합치지 않는다. bounded trace overwritten **5,035/7,657/9,529**는 원인 진단의 전수 수집을 뜻하지 않는다. NoTrace의 ringThrough 0을 0ms 지연으로 해석하지 않는다.

최신 Web `check-date-scroll-web.mjs --both`도 **PASS**다. threaded(`isolated`)와 single-worker(`plain`) 각각 12개월 왕복·header/날짜 전체·resize·Element/node 증가 제한·오류 없음과 정상 회수를 확인했다. 두 profile 모두 nodes/elements **1,787/4,455 → 왕복 뒤 1,787/4,455 → resize 1,877/4,545**, builders 3이며, 종료 reservedBytes **0**/workersStopped **true**다. 이는 Web 기능·수명 검증이고 Windows Hermes 표시 지연의 수락 근거는 아니다. 최신 Core의 독립 설치 strict 선언·package-only imports·scene commit·shared transaction·close도 다시 **PASS**했다. 변경 TS/MJS 22개 lint/format과 `git diff --check` PASS이며 저장소 전체 lint PASS로 확대하지 않는다.

**판정과 다음 실행점:** W11의 기능 구현은 확장됐지만 전체 목표는 **IN PROGRESS / PARTIAL**이다. §7 W11-02의 중단 기준대로, 원본 Source build 자체가 예산을 압도하고 현재 specialization·직접 binding만으로 표시 목표를 달성하지 못한 사실을 **설계 효용 PARTIAL**로 기록한다. 최대 4페이지 정책·원본 Widget/State/Key/FocusNode·callback·속도·애니메이션 시간을 바꿔 수치를 맞추지 않았다.

1. [생성기](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts), [value-math](Nelyx/src/ui/value-math.ts), [framework](Nelyx/src/framework/widgets/framework.ts), [날짜 원본 생성](packages/material/src/generated/date/calendar_date_picker.generated.ts)의 **필수 constructor/lifecycle/label formatting과 불필요한 표현·할당을 독립적으로 구분**하는 것이 다음 Source 작업이다. 현재의 base Semantics factory/선택 owner schema를 모든 생성자에 일괄 적용하지 않는다. Source 구간이 여전히 길면 writer만 추가 개편해 전체 목표 완료로 기록하지 않는다.
2. [host/capture](Nelyx/runtime/app/host.ts)와 각 render 모듈은 **전체 setter→field journal과 남은 adapter**, synthetic/reference dependency를 이어서 검토한다. 최신 동일 pass의 131 adapters를 전체 구현 완료나 모두 불필요한 경로라고 부르지 않는다.
3. **demand revision→Source pass→Content ready→최초 해당 이동 게시** 연결이 빠져 있어 coverage-ready p95/최대는 notVerified다. 이미 측정한 이동 latency FAIL과 구분하고 다음 계측은 기존 bounded trace를 확장한다.
4. UIA 비청취/늦은 접속·native Invoke/custom action·TextPattern/paragraph lease·재진입, 원본 캡처 visual review와 물리 트랙패드·전체 display/scanout·resize 성능은 미검증이다. Android 연결 장치가 없어 제품 실행을 수행하지 않았으며 Linux/Apple 의무도 이 Windows/Web 결과로 종료하지 않는다.

원본 캡처/임시 정리 묶음 명령은 자동 승인 검토에서 거부돼 실행되지 않았고 구체 사유는 제공되지 않았다. `.nelyx/work11-visual`은 생성하지 않았다. 픽셀 ink 표본 PASS를 전체 원본 캡처 검토나 물리 scanout PASS로 대체하지 않는다.

제품 상태는 `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, physical/display/scanout **notVerified**다. 전체 작업을 완료 처리하거나 자의적으로 PAUSED로 바꾸지 않는다. 사용자의 변경과 기존 SDK/과거 디렉터리는 보존하고, 이번 소유 test process·임시 consumer·browser context·staging만 회수한다. 검증 로그·프로필·SDK 사본은 추가 보관하지 않는다.

## 13. 참조 dependency 재사용과 Source 준비 경계

### 13.1 채택하지 않은 Source 후보

§12의 구현·회귀·공급을 유지한 채 현재 diff와 코드부터 대조했다.

- Element base의 23개 필드를 고정 descriptor layout으로 묶는 후보는 own-field 순서·descriptor·상속 setter·fresh children·subclass 검사를 통과했다. 그러나 pinned Hermes의 2,000개 constructor 비교는 기존 **12ms / 후보 11ms**여서 유의미한 Source 절감 근거가 부족했다. 후보와 전용 fixture를 철회했고 `framework.ts`는 이 후보 전 코드다.
- 내부 Focus/Gesture의 scalar revision을 구분해 같은 필드/새 callback에서 같은 명령 program을 공유하는 후보도 구현했다. 실제 모듈의 필드 변경/wire 비교·callback 교체·상태 수명·부모 입력/global context와 abort guard는 통과했다. 그러나 다음 참조 재사용과 함께 실행한 공급의 All은 기능 PASS, 이동 p95/최대 **343.376/588.674ms**, offset 최대 **588ms**로 악화됐다. 객체 동결·revision 관리가 Source에 추가돼 있었으나 이 결합 실행만으로 그 비용을 전체 악화의 단독 원인으로 확정하지 않는다. Source revision 후보·추가 동결·API·전용 fixture를 철회하고 참조 재사용을 분리해 검증한다. 원본 Widget/State·공개 native producer를 생략하는 변환은 남기지 않았다.

철회 공급은 engine §12.4와 동일, JS `179c3597b3838535dac7e9c74ad76c2ab56aa59d39e6e10acaac3dcc929c6866`, HBC `196bddc262f8de0b222f9d1ea449ceea4b4d0c89974ebc98d2de2db80e22c74c`, PID 43528/CLI 45132/HWND 4000034/DPI 192다. 362 packets 접수·거부 0, 이동 360/360·궤적 오차 `<1.82e-10px`, ringLost/outputDropped 0이었다. 관측 Source build/capture/scene 최대 **239/244/166ms**, dependency 검사/참조 subtree 재사용 **701/171**은 각각의 구간/작업량이며 개선율로 바꾸지 않는다. 정상 exit/status 0, reservedBytes/memoryTotal 0, workersJoined/appExited true였다.

### 13.2 같은 writer의 참조 dependency 재사용

[SceneWriter](Nelyx/runtime/engine-client/scene.ts)는 sealed binding의 nativePaint/paintPlacement 대상마다 slot/generation을 독립 값으로 보존한다. 이전처럼 임의 실행형 참조를 cacheable로 분류하지 않는다. handle 배정을 먼저 끝내고 현재 대상과 비교한 뒤, 해당 참조와 소유 record가 일치하면 불변 subtree를 재사용한다. 대상의 kind/generation 변경·parking/재부착은 기존 명령 경로에서 다시 해석한다.

자손별 참조 Map을 조상마다 전량 복제하지 않는다. 단일 자식 dependency는 공유하고 여러 자식은 불변 연결로 묶으며, 한 records pass의 검증 결과만 memoize한다. `referenceDependencyChecks/referenceSubtreeReuses`로 실제 사용을 구분한다. Core wire·scheduler·coverage·ACK/checkpoint·quota/graph 검증은 변경하지 않았다.

새 differential oracle는 stable 참조 subtree의 전체 record 순회 생략, 무관한 handle 추가, forward 참조의 대상 kind/generation 변경, 양쪽 parking과 NACK 재시도의 wire를 비교한다. 첫 NACK fixture가 실패해 **거부된 자손의 참조 정보가 자신의 record는 동일한 부모 cache에 섞이는 경우**를 찾았다. dependency의 소유 record도 현재 accepted registry와 동일해야 재사용하도록 고쳤고, 재시도 wire 및 이전 accepted bytes 불변을 통과했다. candidate의 데이터 일치와 ACK를 받은 소유권을 합치지 않는다.

### 13.3 기존 build 측정 밖의 Source 준비 기록

코드상 `rebuildFromContent`의 필수 builder/sliver callback은 기존 `timing.buildMs` 전에 실행하거나 게시 관찰에서 실행될 수 있다. 그 시간을 Source build의 독립 전수 시간으로 설명할 수 없으므로 [host](Nelyx/runtime/app/host.ts)의 기존 diagnostics에 보완했다.

- `sourcePreparation`은 box/sliver 요청과 관찰된 window 준비의 request identity·시작/경과·built/declined/failed를 **128개 bounded 표본**과 누적 합/최대로 구분한다. 결과의 built는 Source callback 결과이며 Core ready/publication/ACK 수락이 아니다.
- 각 capture의 `sourceThrough`는 그 봉인 전에 끝난 준비 sequence를 기록한다. ACK 대기 중 뒤늦게 수행한 준비를 앞선 capture의 Source 결과로 합치지 않는다. 기존 build 안의 retained builder 비용도 `retainedBuilderMs`로 구분하며 build의 하위 구간이므로 더하지 않는다.
- [PowerShell 검사](Nelyx/eng/check-windows-scroll.ps1)는 같은 domain과 표본 overwrite를 표시한다. [실제 Core 요청 회귀](Nelyx/eng/check-immediate-reads.mjs)는 원래 constraints/callback·요청 identity와 다음 capture 연결을 함께 확인한다. 별도 수집기·프로필 파일·history JSON은 만들지 않는다.

이 연결은 App에서 실행한 준비의 범위다. native demand 수신 시간과 실제 coverage-ready·최초 이동 publication까지의 전 경계 지연을 입증한 것은 아니므로 `coverageReadyGoal`은 계속 notVerified다.

### 13.4 §13 공급의 통합 결과와 다음 Source owner

철회한 두 Source 후보를 제거한 뒤 현재 Core·Windows/Web 앱을 재빌드했다. native identity는 `820c61ccede47473f812bb469ca433a74fe4204b8ee48d2f84bcd92d21c6e625`, ABI 2/schema 313408118, engine 356/App 10 files로 §12.4와 같다. 이후 native 변경은 없다. Windows JS는 `c96ad368c69f5fb3f2ecca75697b2d9cfdad49bc84f0b550c3a10e4ea985cba0`, HBC는 `cbadba9bab0d3c035f3711b827c68b92f1c9ad0a657e6cf502876de390c5e557`, Windows/Web는 892/891 modules다.

| 현재 공급 시나리오 | 기능·입력 | 표시·성능 경계 |
| --- | --- | --- |
| All / 12개월 / 60Hz / PID 48376, CLI 5084, HWND 592478, DPI 192 | 목록 4구간, 2026-11→2027-11, cancel/resize/header/전체 날짜/15일 선택/close **PASS**. 360 updates/6,000.291ms, **362 admitted/rejected 0**, driver lateness 최대 0.696ms | 이동 **360/360**, missing 0, 궤적 오차 `<1.75e-10px`. 지연 p95/최대 **134.058/185.246ms**, ≥100ms 41개로 **FAIL**. offset 공백 최대 **194ms**, ≥100/250ms 10/0회, backlog 114.667px. publication gap 33.979ms와 구분 |
| 빠른 24개월 역방향 / PID 12676, CLI 46120, HWND 3869366, DPI 192 | 12 contacts/96 updates/120 packets 전량 접수, 거부 0, 약 2,220.817ms, 2026-11→2024-11, 15일 선택/close **PASS**. 활성 received 118과 전체 접수 120의 경계는 별개 | offset 공백 최대 **364ms**, ≥100/250/500ms 9/3/0회, backlog 2,064px. **W11 FAIL**, 이전 500ms 경보만 PASS. App turn p95/최대 172.725/323.703ms |
| 0.4/0.8페이지 양방향 / PID 47644, CLI 17464, HWND 4327798, DPI 192 | 각 36 updates, **180 admitted/rejected 0**, cancel/resize/선택/close **PASS**. 게시/서로 다른 offset은 39/36, 35/35, 35/35, 35/35 | 수신→게시 최대 **31.323/13.937/14.466/14.670ms**, consumed offset 오차 `<8.74e-11px`. resident contact 의미 PASS이며 새 월 전체 성능은 notVerified |
| Calendar / 12개월 / 60Hz / NoTrace / PID 38232, CLI 47656, HWND 6490328, DPI 192 | **362 admitted/rejected 0**, 약 6,000.221ms, 12개월/cancel/resize/header/전체 날짜/선택/close **PASS**, driver lateness 최대 0.607ms | trace-disabled이므로 movement/offset/W11 성능은 **notVerified**. 기본 App/native diagnostics까지 모두 꺼진 실행은 아님 |

All의 활성 App turn p95/최대는 **296.190/338.789ms**다. 최근 128 pass에서 build/capture/scene 최대 **167/181/125ms**, 그 build 하위 retained builder p95/최대 **144/167ms**를 관측했다. 동일 pass `document=157/input=462`는 build/**retained**/capture/scene **154/154/92/125ms**, created/captured 375/834, module/bindings/adapters 70/702/132, `sourceThrough=76`이었다. 다른 긴 pass `document=149/input=340`도 build/**retained** **167/167ms**였다. 서로 다른 최대값이나 하위 구간을 더해 한 월의 비용으로 만들지 않는다.

연속 cold 월 진행의 긴 pass들에서 `sourceThrough=76`이 유지됐다. 따라서 이번의 긴 build는 별도 box/sliver 준비 callback만의 시간이 아니라 **기존 retained builder와 그 안의 BuildOwner scope**에 있다. 이 scope는 원래 builder 호출 외에도 dirty 자손의 build/reconcile과 render commit을 포함한다. 167ms 전체를 날짜 constructor나 label formatting의 단독 비용으로 확정하지 않는다. All의 명시적 Source 준비는 전체 87 calls/누적 589ms/최대 56ms, 보존 87개/overwrite 0이었다. Fast는 31 calls/291ms/최대 55ms, build/capture/scene 최대 163/128/89ms이고 retained builder 최대도 163ms였다.

참조 dependency 검사/subtree 재사용은 All **966/234**, Fast **177/38**, contact **863/179**였다. 이는 같은 writer가 실제 그 경로를 사용한 증거다. 기록 전체의 누적량·서로 다른 실행의 시간으로 cold 월만의 적용률이나 통제된 개선율을 계산하지 않는다. All의 App samplesThrough 236/overwrite 108과 bounded traceOverwritten 15,034도 전체 전수 수집을 뜻하지 않는다.

네 Windows 실행은 모두 exit/status 0, reservedBytes/memoryTotal 0, workersJoined/appExited true, ringLost/outputDropped 0으로 종료했다. peak bytes는 All/Fast/contact/NoTrace 각각 **530,892,858 / 504,071,926 / 526,236,618 / 529,531,445**다. 개별 실행의 회수 결과이며 전체 제품의 장기 메모리 상한 증명으로 확대하지 않는다.

현재 Web의 threaded(`isolated`)·single-worker(`plain`)도 각각 **12개월 왕복/header/전체 날짜/resize/Element·node 증가 제한/오류 없음 PASS**다. 양쪽 nodes/elements는 1,787/4,455 → 왕복 뒤 1,787/4,455 → resize 1,877/4,545, builders 3이었다. 두 context의 종료 reservedBytes 0/workersStopped true를 확인했다. 현재 설치 Core의 strict 선언·package-only import·commit·공유 transaction·clean close, pinned Hermes compiler/VM과 실제 배포 ESM 경계도 PASS다. 최신 Source의 root `check:types`, binding/NACK·incremental capture·실제 pending Content/취소 복구·Ink·semantics·공통 박스 wire·page observation 회귀와 변경 파일 lint/format을 통과했다.

**이어갈 구현 경계:** [host의 retained builder loop](Nelyx/runtime/app/host.ts), [LayoutBuilder의 `_rebuildWithConstraints`](Nelyx/src/framework/widgets/layout-builder.ts), [BuildOwner scope](Nelyx/src/framework/widgets/framework.ts), [native window Source](Nelyx/runtime/app/scroll.ts)를 먼저 분석한다. `updateShouldRebuild=true`와 dirty 자손·원래 callback 실행은 유지한다. native-owned render의 paint/semantics 무효화가 반복해서 부모를 걷는 경로도 후보지만, 현재 virtual getter/hook·paintVersion 의미를 생략하는 변경은 적용하지 않았다. blob journal의 prepare는 동기 wire 구성이고 `sceneMs`에는 ACK 대기도 포함되므로, 전체 scene 시간을 직렬 blob RPC 비용으로 오인하지 않는다.

전체 setter→field journal과 남은 adapter, demand revision→Source→coverage-ready→최초 이동 게시 연결, UIA 늦은 접속/실제 action·TextPattern·재진입, 원본 visual review와 물리 입력·display/scanout·resize 성능 및 다른 플랫폼 의무는 남아 있다. 상태는 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 현재 dist와 사용자 변경·기존 SDK는 보존했고 소유 임시 검사 폴더/설치본/browser context/process는 회수했다. 별도 검증 로그·SDK 사본·history JSON을 보관하지 않는다.

## 14. TextStyle 값 구성과 sealed program 공유

### 14.1 필수 apply 실행과 값 구성의 분리

[TextStyle](Nelyx/src/framework/painting/text-style.ts)의 공개 `apply` 입력 평가·산술·검증은 유지했다. 반환할 정확한 base 값만 고정 schema로 새로 구성한다. 공개 생성자의 **27개 undefined own-field 정의 후 값 재할당**을 이 내부 경로에서 반복하지 않는다. `copyWith`·공개 생성자·subclass 생성은 기존 경로다. Widget/State/FocusNode·날짜 predicate·resolver·callback과 새 TextStyle의 identity를 생략하거나 공유하지 않는다.

필드 순서는 constructor 대입 순서가 아닌 원래 선언 순서와 같다. package의 null family 표현, fallback/features/variations 배열 복사, Shadow 재구성, Paint identity, snapshot validation·capture 판정·freeze를 보존했다. 비어 있는 Diagnosticable 상속 constructor가 교체되면 두 단계 parent identity guard가 공개 생성자로 돌아간다.

[독립 비교](Nelyx/eng/check-text-style-construction.mjs)는 같은 apply 프로토콜을 기존 공개 생성자로 수행한 값을 기준으로 전체 field/descriptor/prototype, fresh 배열/Shadow, debug/release 오류, delta/package, Paint 변경, receiver/options Proxy와 중첩 collection getter, throw identity/순서, subclass·교체 superclass를 대조한다. [기준 apply 추출](Nelyx/eng/text-style-apply-reference.mjs)은 새 고정 schema를 호출하지 않는다. [실제 배포 Core의 pinned Hermes 검사](Nelyx/eng/check-hermes-syntax.mjs)도 descriptor·새 값·subclass 및 2,000회 결과를 통과했다. 최종 fixture 시간은 공개 constructor 경로 **22ms / 내부 값 구성 12ms**다. 이 제한된 구성 비교를 새 월 전체의 개선율이나 목표 달성으로 사용하지 않는다.

### 14.2 callback과 독립적인 같은 program의 재사용

[writer의 binding 봉인](Nelyx/runtime/engine-client/scene.ts)에서 Source reference마다 최근 **하나의 destination-free immutable program**만 유지한다. 같은 kind·명령 수·본문과 각 fixup의 reference/offset이 같을 때만 공유한다. 다른 참조를 같은 placeholder bytes라는 이유로 합치지 않는다. 새 children과 callback record는 매번 따로 봉인하며, 원래 writer의 accepted/checkpoint/ACK/NACK·generation 관리가 그대로 적용된다.

이는 Source Focus/Gesture의 추가 revision·동결을 철회한 §13.1 후보와 다르다. Source Widget·options에 새 상태를 붙이지 않고, 이미 생성한 private 명령을 비교한다. [oracle](Nelyx/eng/check-render-bindings.mjs)은 같은 필드/새 callback에서 accepted config 재사용과 새 callback 실행, 변경 후 복귀, 서로 다른 cross-node 참조, NACK/in-flight와 이전 bytes 불변을 확인한다. capture·encoder 작업 자체는 여전히 남아 있으며 전체 setter→field journal 완료는 아니다.

### 14.3 현재 공급의 통합과 성능 반증

현재 Core와 Windows/Web 앱을 재빌드했다. native identity/ABI/schema는 §13과 같고 이후 native 수정은 없다. Windows JS `3ce623bd8388024110448a071ca01ce5b1d23b20dcdfc1282faefe45bff08ac5`, HBC `55e2ae1d2e290450cf50ec07d644864f11da080b319c43d23f9a469508f96d53`, engine 356/App 10 files다.

| 시나리오·실행 identity | 기능·입력 | 표시·성능 경계 |
| --- | --- | --- |
| All / 12개월 / 60Hz / PID 33304, CLI 27216, HWND 4983586, DPI 192 | 목록 4구간, 2026-11→2027-11, cancel/resize/header/전체 날짜/15일 선택/close **PASS**. 360 updates/6,000.180ms, **362 admitted/rejected 0**, driver lateness 최대 12.340ms | 이동 **360/360**, missing 0, 궤적 오차 `<1.68e-10px`. 지연 p95/최대 **122.580/187.507ms**, ≥100ms 33개 → **FAIL**. offset 공백 최대 **194ms**, ≥100/250ms 9/0회, backlog 114.667px. publication gap 35.219ms와 별개 |
| 빠른 24개월 역방향 / PID 18528, CLI 45140, HWND 4917542, DPI 192 | 12 contacts/96 updates, **120 admitted/rejected 0**, 약 2,206.483ms, 2026-11→2024-11·15일 선택/close **PASS**. 활성 received 118은 경계 밖 begin/end와 구분 | offset 공백 최대 **357ms**, ≥100/250/500ms 8/4/0회, backlog 2,236px. **W11 FAIL**, 이전 500ms 경보만 PASS. App turn p95/최대 264.681/318.527ms |
| 0.4/0.8페이지 양방향 / PID 25356, CLI 34236, HWND 2688768, DPI 192 | 각 36 updates, **180 admitted/rejected 0**, cancel/resize/header/날짜 선택/close **PASS**. 게시/서로 다른 offset 38/35, 35/35, 35/35, 35/35 | 수신→게시 최대 **33.575/14.148/13.899/14.176ms**, consumed offset 오차 `<8.74e-11px`. resident contact 의미 PASS이며 새 월 전체 성능은 notVerified |
| Calendar / 12개월 / 60Hz / NoTrace / PID 14940, CLI 17276, HWND 7014616, DPI 192 | **362 admitted/rejected 0**, 약 6,000.337ms, 12개월/cancel/resize/header/전체 날짜/선택/close **PASS**, driver lateness 최대 0.774ms | trace-disabled이므로 movement/offset/W11 성능 **notVerified**. 기본 diagnostics는 켜져 있고 0개 trace 표본을 0ms 지연으로 해석하지 않음 |

All의 활성 App turn p95/최대 **287.861/333.404ms**다. 최근 128 pass의 build/capture/scene 최대는 **158/214/180ms**이며 서로 다른·중첩 구간이므로 합산하지 않는다. 동일 pass `document=140/input=402`는 build/retained/capture/scene **158/158/104/77ms**, created/captured **381/838**, module/binding/adapter **72/707/131**, `sourceThrough=70`이다. Fast의 전체 60 pass에는 build/capture/scene 최대 **164/107/85ms**, retained 최대 **164ms**가 남았다. NoTrace도 보존 구간의 build 최대 **183ms**였다. 값 구성·program 공유만으로 필수 Source 비용이 해결됐다고 판정하지 않는다.

All의 writer `bindingRecords/bindingProgramReuses`는 **44,587/36,564**, `bindingCommands` **46,143**, reference dependency 검사/subtree 재사용 **898/219**, records/diff 누적 **872/590ms**다. same-pass 제거량은 oracle로 확인하며, 이 실행 전체의 누적치를 cold 월 적용률이나 이전 실행 대비 통제된 개선율로 계산하지 않는다. App samplesThrough **223**, 보존 128/overwrite **95**, bounded trace overwritten **14,627**이다.

네 Windows 실행은 모두 exit/status 0, reservedBytes/memoryTotal 0, workersJoined/appExited true, ringLost/outputDropped 0으로 종료했다. peak bytes All/Fast/contact/NoTrace는 각각 **529,042,733 / 510,525,207 / 524,874,059 / 526,223,505**다. 이 기능·회수 결과를 전체 제품의 물리 입력·scanout·장기 메모리 상한 수락으로 확대하지 않는다.

현재 Source의 root `check:types`, TextStyle 독립 의미 비교, 공통 박스 27개 wire, binding/참조/NACK, incremental capture, 실제 pending Content·superseded/cancel 복구, Ink parking, 게시 semantics, page observation·LayoutBuilder scheduling과 pinned Hermes를 통과했다. 변경 TS/MJS **26개** lint/format도 PASS다. 생성기/생성 TS/의존성 lockfile은 §12의 시스템 Dart 검증 후 바꾸지 않았으며 그 SDK 지원 계약을 유지한다.

현재 Web의 threaded(`isolated`)와 single-worker(`plain`)도 각각 12개월 왕복/header/전체 날짜/resize·Element/node 증가 제한·오류 없음 **PASS**다. 두 profile 모두 nodes/elements **1,787/4,455 → 왕복 뒤 1,787/4,455 → resize 1,877/4,545**, builders 3이며, 종료 reservedBytes **0**/workersStopped **true**를 확인했다. 독립 설치 Core의 strict 선언·package-only import·commit·공유 transaction·clean close도 **PASS**다. 모든 소유 검사 process/consumer/browser context·Hermes 임시 출력·이전 dist/staging은 회수했고 현재 dist와 기존 사용자 SDK/디렉터리는 보존했다.

### 14.4 남은 구현 경계

상태는 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 같은 callback/State·최대 4페이지 resident 정책·입력 속도와 애니메이션 시간은 유지했다. 전체 필드별 binding journal, 남은 adapter, Source의 필수 constructor/lifecycle/label formatting과 불필요한 표현 분리, demand→coverage-ready 연결, UIA 실제 소비자/관찰 조건, 원본 visual review·물리/display/scanout·resize 성능 및 다른 플랫폼 의무가 남아 있다.

다음 Source 분석은 retained LayoutBuilder의 **원래 callback과 scope dirty 자손 flush**를 구분하고, 현재 Windows 배포의 Babel 상속 helper가 반복하는 constructor/할당 비용을 함께 검토한다. pinned Hermes의 전체 Diagnosticable mixin graph가 native class에서 실패한다는 기존 공급 계약이 있으므로, native class로 일괄 전환하거나 `new.target`·교체 superclass·사용자 hook을 무시하는 loose lowering은 적용하지 않았다. 작은 값 factory의 microbenchmark만으로 긴 Source turn 전체가 해결된 것처럼 계속 확장하지 않는다. 검증 로그·SDK/profile/consumer 사본을 별도 보관하지 않는다.

## 15. 스칼라 명령 인수 재사용과 구조화된 기록 후보 철회

### 15.1 채택한 구현과 보존 계약

[scene.ts](Nelyx/runtime/engine-client/scene.ts)의 직접 binding은 paint·text·gesture·event-policy의 내부 인수 중 **동결된 목적지 placeholder와 원시값만** 보유한다. 같은 reference·종류·명령에서 인수 길이와 각 `Object.is`가 같으면 인코더를 생략한다. 텍스트는 direction을 포함한 스칼라 인수로 비교하므로 같은 문자열의 UTF-8 생성도 생략한다. 실제 명령 body는 §14의 목적지 없는 sealed program에 남고, 변경분의 handle 해석·native transaction은 기존 writer가 맡는다.

이 기록은 live Source reference당 최근 한 묶음이다. 새로운 종류·값·제거된 optional command는 현재 config로 반영하며, 자식 연결·callback은 매번 현재 Source 결과를 사용한다. encoder 예외로 끝난 구성은 최근 기록을 설치하지 않는다. native NACK 뒤에도 Source 값과 ACK 상태는 같은 것으로 취급하지 않으며 기존 accepted diff·세대 복구를 유지한다. 공개 Scene producer의 capture/비교는 바꾸지 않았다.

**객체·배열·접근자·실행형 참조는 추가 기록·재귀 probe 없이 기존 codec을 실행한다.** `closedData`여도 중첩 객체를 raw identity로 재사용하지 않는다. Source setter revision이나 전체 `O(M+E)` journal의 완료가 아니며, 새 월의 필수 첫 인코딩도 남는다. [host.ts](Nelyx/runtime/app/host.ts)의 기존 bounded pass 진단에 `partEncodes/partReuses`를 연결했다. 두 수치는 위 스칼라 후보 명령만 집계하며 모든 객체 명령의 인코딩 횟수가 아니다.

[wire oracle](Nelyx/eng/check-render-bindings.mjs)은 structured Source와 공개 Scene의 전체 bytes, NACK/복귀·adapter 전환·참조/세대·콜백을 비교한다. 같은 paint/text 인수의 실제 codec 호출 생략, paint 변경, 실패 후 이전 기록 보존, 중첩 배열/비열거 필드 변경, 사용자 Array subclass 실행, 접근자 호출 횟수도 PASS다. pinned compiler/VM의 **실제 배포 ESM**에서도 같은 스칼라 인코딩 **1회/재사용 1회**, wire 변경 0·새 callback 실행을 확인했다.

### 15.2 철회한 후보

첫 후보는 명령별 구조화된 인수 tree를 복사·비교했다. Windows JS `d927ac5766121105925f4ab5979eae9d88b53767c3624170b394d8c2dfb8ae1f` / HBC `5fee86039cdd56466417cc25e287374a51ee2d2c7f382d81efe3475e2fd97c23`, All PID 34376에서 기능은 PASS였지만 이동 지연 p95/최대 **223.983/324.844ms**, offset 정체 최대 **333ms**, backlog **206.4px**였다. codec 17,379회 생략은 표시 성능 개선 증거가 아니었다.

다음 후보는 tree 사본 대신 flat key와 순차 비교를 사용했다. Windows JS `b9c6389945b5cbc0fefe2f4cbf183f718c72bc11819c50e7552d1b84b93f8fb6` / HBC `5386743839f2bb9882a03e3f8823fdc8ed29bf3336d6be997676986c21ebf5af`, All PID 25012에서 기능 PASS, 이동 지연 **153.034/243.259ms**였다. 이전 §14 공급 대비 효용을 입증하지 못했고 새 reference에 key를 만드는 추가 작업도 남았다. **두 구조화된 기록 후보는 소스에서 제거했으며 현재 공급이 아니다.** 서로 다른 실행의 retained build·native 비용도 달라 이 차이 전체를 기록 방식 하나의 원인으로 확정하지 않는다. 두 실행은 exit/status 0·reserved/memory 0·workersJoined/appExited true로 회수했다.

### 15.3 현재 공급과 통합 결과

현재 native/source identity는 **`820c61ccede47473f812bb469ca433a74fe4204b8ee48d2f84bcd92d21c6e625`**, ABI **2** / schema **313408118**, engine **356** / App **10** files다. Windows JS **`544524698bf02fe8fd80cce10152ba5ff320e656790ab5f21d67b4394973ff67`**, HBC **`bd206728bc50f2ecf2586e825a74a1c1686c64d59f424f3bec63c444f7ad7260`**, Web JS **`03fc2a793e859f6031d07006f81892349eccbc9f2e7be4d7f6de8ed1184e1347`**로 빌드·실행을 연결했다. §14와 달리 스칼라 인코더 전 재사용을 포함한 공급이다.

| 실행 / 실제 owner | 기능·입력 | 표시 추종과 판정 |
| --- | --- | --- |
| All / 12개월 / 60Hz / PID 38488, CLI 15532, HWND 2623950, DPI 192 | 목록 4구간, 2026-11→2027-11·cancel/resize/header/전체 날짜/15일 선택/close **PASS**. 360 updates/6,000.385ms, **362 admitted / rejected 0**, driver lateness 최대 1.026ms | **360/360 반영**, missing 0, 오차 `<1.75e-10px`. 지연 p95/최대 **137.194/204.138ms**, ≥100/250ms 37/0개로 **FAIL**. offset 정체 최대 **211ms**, ≥100/250ms 9/0회, backlog 126.133px. publication gap 최대 36.577ms와 구분 |
| 빠른 24개월 역방향 / PID 428, CLI 24628, HWND 1377120, DPI 192 | 12 contacts/96 updates/120 packets 전량 접수·거부 0, 약 2,199.279ms, 2026-11→2024-11·15일 선택/close **PASS** | offset 정체 최대 **381ms**, ≥100/250/500ms 7/4/0회, backlog **2,408px**. **W11 FAIL**, 이전 500ms 경보만 PASS. App turn p95/최대 263.177/336.972ms |
| 0.4/0.8페이지 양방향 / PID 26400, CLI 35344, HWND 1706540, DPI 192 | 각 36 updates, **180 admitted / rejected 0**, cancel/resize/header/날짜 선택/close **PASS**. 게시/서로 다른 offset 40/36, 35/35, 35/35, 35/35 | 수신→게시 최대 **27.052/13.455/13.399/12.942ms**, consumed offset 오차 `<8.74e-11px`. resident 접촉 의미 PASS이며 새 월 전체 성능은 notVerified |
| Calendar / 12개월 / 60Hz / NoTrace / PID 32140, CLI 49200, HWND 5507460, DPI 192 | **362 admitted / rejected 0**, 약 6,000.146ms, 12개월·cancel/resize/header/전체 날짜/선택/close **PASS**, driver lateness 최대 4.182ms | trace-disabled이므로 movement/offset/W11 성능 **notVerified**. 기본 App/native 진단까지 모두 꺼진 실행은 아님 |

All의 활성 App turn p95/최대는 **280.183/364.432ms**다. 최근 128 pass의 build/capture/scene 최대 **191/210/136ms**는 서로 다른·중첩 구간이므로 합산하지 않는다. 동일 pass `document=154/input=462`는 build/retained/capture/scene **191/191/97/94ms**, created/captured **375/834**, module/binding/adapter **70/702/132**, 스칼라 encode/reuse **292/424**, `sourceThrough=76`이다. Source 준비 ring은 **85 calls/누적 559ms/최대 55ms**, overwrite 0이며 긴 cold pass에서 그 sequence가 유지됐다. Fast retained builder 최대 **183ms**, NoTrace **179ms**도 남는다. Source retained build/scope가 여전히 예산을 압도한다.

All 전체의 스칼라 `partEncodes/partReuses`는 **6,079/12,062**, `bindingRecords/bindingProgramReuses` **44,661/36,645**, records/diff 누적 **830/609ms**다. 이는 실제 인코더 생략과 프로그램 공유의 발동 근거이며 cold 생성 비용·이전 공급 대비 개선율은 아니다. App samplesThrough **234/overwrite 106**, bounded trace overwritten **14,844**를 기록했다. 기능은 통과했지만 §14보다 표시 성능이 개선됐다고 판정하지 않는다.

네 Windows 실행 모두 exit/status 0, reservedBytes/memoryTotal 0, workersJoined/appExited true, ringLost/outputDropped 0으로 종료했다. peak bytes All/Fast/contact/NoTrace는 **528,978,951 / 511,206,812 / 524,486,130 / 525,998,827**이다. 사용자가 기존에 보유한 SDK/디렉터리를 제거했다는 뜻은 아니다.

전체 root `check:types`, binding/공통 박스 27개 wire, 실제 Core pending Content·superseded/cancel 복구, incremental capture/journal, Ink parking, 게시 semantics·page observation·LayoutBuilder scheduling, pinned Hermes와 독립 설치 Core strict 선언/package-only import/commit/공유 transaction/clean close **PASS**다. 구현 TS/MJS **26개** lint/format PASS다. 생성 TS까지 포함한 lint는 기존의 미사용 매개변수 경고 **3개**가 남으며 이를 전체 lint PASS로 기록하지 않는다. 생성기·생성 TS·lockfile은 §12 이후 추가 변경하지 않았고, 기본 시스템 `dart --version`의 **3.12.2**와 `>=3.12.0 <4.0.0` 제약을 다시 확인했다. 전체 75/75·원본 oracle PASS는 §12의 실행이며 이번 단계에서 불필요하게 반복하지 않았다.

Web threaded(`isolated`)·single-worker(`plain`) 모두 **6개월 전진·6개월 복귀, 총 12회 월 이동**, header/전체 날짜/resize·Element/node 증가 제한·오류 없음 **PASS**다. 각 nodes/elements는 **1,787/4,455 → 왕복 후 1,787/4,455 → resize 1,877/4,545**, builders 3이고 종료 reservedBytes **0**/workersStopped **true**다. 검증용 consumer/Hermes 출력/browser context·소유 process와 build staging은 회수했으며 현재 dist만 남겼다.

### 15.4 남은 작업과 다음 실행점

전체 작업은 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 현재 공급의 기능 PASS와 스칼라 인코더 생략으로 전체 작업을 완료 처리하지 않는다. 입력 속도·animation·최대 4페이지 resident 정책·원본 callback/State를 유지했다.

다음은 같은 owner가 새 월의 필수 Source 실행과 module projection을 중복 구성하는 실제 경계를 줄이는 작업이다. **범용 mutable 값 캐시나 작은 값 factory를 계속 추가하는 것**으로 대신하지 않는다. retained builder의 원래 callback과 자손 flush·reconcile·render commit을 구분하고, 생성기에서는 `_DayState.build`의 local `resolve/effectiveValue/getProperty` 중 escape하지 않는 호출의 정적 결합을 검토한다. overlay callback으로 escape하는 helper와 사용자 resolver 호출·null fallback 순서, 반복 `this.widget.isToday` 읽기를 임의로 합치지 않는다. Babel class lowering도 `new.target`·교체 superclass·전체 mixin 의미가 보존되는 범위만 검토한다. 이번에 두 변환을 구현한 것은 아니다.

전체 setter→필드 journal·남은 adapter, demand→coverage-ready의 같은 request/pass/준비 identity 연결, UIA 늦은 client/query/청취·TextPattern·재진입과 원본 visual review·사용자 물리 입력/display/scanout·resize 성능·다른 플랫폼 의무가 남아 있다. 이전 capture/정리의 자동 승인 거부를 해결하거나 우회했다고 주장하지 않는다. 로그·receipt·SDK/profile/설치본·history JSON을 누적 보관하지 않는다.

## 16. 날짜와 연도 생성 코드의 지역 helper 정적 결합

### 16.1 구현과 효과 보존

§3.4의 `resolve/effectiveValue/getProperty` 경계를 [생성기](tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts)와 [emitter](tools/Nelyx.FrameworkToTypeScript/src/dart-emitter.ts)에 연결했다. [local-functions.ts](tools/Nelyx.FrameworkToTypeScript/src/local-functions.ts)는 정상 Dart ABI emission 이후 TypeScript 심볼로 선언·사용처·lexical receiver를 검사한다. recipe는 원본 analyzer identity로 `_DayState.build`와 `_YearPickerState._buildYearItem` 두 method를 선택한다. Source pin과 normalized hash는 그대로이며 생성 TS를 직접 편집하지 않았다. 이 분석은 생성할 때만 실행한다.

대상은 단일 return의 final 지역 arrow이며 함수 값의 모든 사용이 직접 호출이어야 한다. 별도 owner로 넘긴 함수 identity, shadowed free variable, 다른 `this` scope, TDZ 이전 호출, spread/default/rest·formal parameter 쓰기·type query·eval 등 증명하지 못한 형태는 기존 코드로 남긴다. 인수의 효과는 순서대로 한 번 평가하고, 전달된 가변 binding과 중복되는 효과식은 독립 지역 값으로 묶는다. 사용되지 않게 된 witness도 `void`로 원래 시점에 평가한다. 중간의 순수한 literal null만 `??` 연쇄에서 제거하며 마지막 null과 실행형 읽기/호출은 보존한다. 타입 전용으로만 쓰던 미사용 import는 제거하고 값 import의 초기화는 유지한다.

두 method의 helper 정의 **4개**와 해당 selector closure/call을 직접 식으로 결합했다. **사용자 WidgetStateProperty.resolve와 fallback은 계속 실행**한다. `this.widget.isToday`의 반복 읽기를 합치지 않으며 첫 resolver가 null을 돌려준 뒤의 fallback 시점도 같다. overlay의 외부 callback 자체는 남고 그 안의 원래 식은 나중에 callback이 호출될 때 실행된다. Widget/State/FocusNode/controller·theme 의존성·날짜 label·실제 callback이나 constructor를 생략/공유하지 않았다.

[효과 oracle](tools/Nelyx.FrameworkToTypeScript/verify-local-functions.ts)은 독립 예제뿐 아니라 **baseline emitter와 새 emitter의 실제 날짜/연도 값 계산 식**을 추출해 비교한다. theme Proxy/getter, resolver receiver·states, null/undefined fallback, witness/getter/resolver 예외 identity, states-controller write, 나중 overlay 호출과 변하는 isToday getter가 같다. 외부로 넘긴 함수 identity, 반복 효과 인수, mutable parameter, shorthand 결과, 연산자 우선순위, free/global 이름 가림, 다른 receiver·TDZ·eval·spread 거부도 확인했다. IR에서 벗어난 임의의 Dart 전체 함수 inlining을 지원한다고 주장하지 않는다.

시스템 Dart **3.12.2**의 최종 `--check --verify`는 **75/75, errors 0**, 원본 Dart date/localization oracle **12 dates / 11 inputs / 4 decimal cases PASS**다. 이 단계의 새 생성 출력까지 다시 분석·비교했다. compiler 정책 오류/누락·중복 method 거부, generator TS 타입 검사, root `check:types`, Material ESM/선언 빌드와 구현 TS/MJS **29개** lint/format도 PASS다. 생성 TS 전체 lint에는 기존 unused parameter **3개**만 남아 있어 전체 lint PASS로 부르지 않는다.

### 16.2 현재 공급과 실제 통합

native/source는 **`820c61ccede47473f812bb469ca433a74fe4204b8ee48d2f84bcd92d21c6e625`**, ABI **2** / schema **313408118**, engine **356** / App **10** files다. 현재 Windows JS **`512f1f40a8c65ef8d39fd6d92dfa9825a866bc690911bbdc558d3b2823c83931`**, HBC **`a3a01c74a4aacf9730c983b6246b1bbf273df3ce57a875d9d449bc5fe7d6f831`**, Web JS **`ac4324d05b07885ac43f5b5e125eb87fde8a538c2aead354286040574823c647`**다. Core/Material의 Source inputs와 두 App bundle identity도 최종 상태로 확인했다. §15 공급과 섞지 않는다.

| 실행 / 실제 owner | 기능·입력 | 표시 추종과 판정 |
| --- | --- | --- |
| All / 12개월 / 60Hz / PID 38648, CLI 48220, HWND 2099508, DPI 192 | 목록 4구간, 2026-11→2027-11·cancel/resize/header/전체 날짜/15일 선택/close **PASS**. 360 updates/6,000.334ms, **362 admitted / rejected 0**, driver lateness 최대 0.573ms | **360/360 반영**, missing 0, 오차 `<1.75e-10px`. 지연 p95/최대 **116.612/199.790ms**, ≥100/250ms 28/0개로 **FAIL**. offset 정체 최대 **205ms**, ≥100/250ms 10/0회, backlog **126.133px**. publication gap 최대 36.326ms와 구분 |
| 빠른 24개월 역방향 / PID 43876, CLI 15356, HWND 2820010, DPI 192 | 12 contacts/96 updates/120 packets 전량 접수·거부 0, 약 2,225.376ms, 2026-11→2024-11·15일 선택/close **PASS** | offset 정체 최대 **344ms**, ≥100/250/500ms 8/4/0회, backlog **2,064px**. **W11 FAIL**, 이전 500ms 경보만 PASS. App turn p95/최대 218.006/280.357ms |
| 0.4/0.8페이지 양방향 / PID 9108, CLI 34692, HWND 6817766, DPI 192 | 각 36 updates, **180 admitted / rejected 0**, cancel/resize/header/날짜 선택/close **PASS**. 게시/서로 다른 offset 40/36, 35/35, 35/35, 35/35 | 수신→게시 최대 **32.716/12.509/13.437/12.190ms**, consumed offset 오차 `<8.74e-11px`. resident 접촉 의미 PASS이며 새 월 전체 성능은 notVerified |
| Calendar / 12개월 / 60Hz / NoTrace / PID 44768, CLI 10744, HWND 2427188, DPI 192 | **362 admitted / rejected 0**, 약 6,000.541ms, 12개월·cancel/resize/header/전체 날짜/선택/close **PASS**, driver lateness 최대 2.177ms | trace-disabled이므로 movement/offset/W11 성능 **notVerified**. 기본 App/native 진단까지 모두 꺼진 실행은 아님 |

All 활성 App turn p95/최대 **268.852/350.521ms**다. 최근 128 pass의 build/capture/scene 최대는 **160/196/106ms**이며 서로 다른·중첩 구간이므로 합산하지 않는다. 같은 `document=145/input=401` pass는 build/retained/capture/scene **151/151/94/69ms**, created/captured **381/838**, module/binding/adapter **72/707/131**, 스칼라 encode/reuse **292/430**, `sourceThrough=74`다. 명시적 Source 준비 **83 calls/누적 574ms/최대 59ms**, overwrite 0과 별개로 긴 retained scope가 남았다. Fast retained 최대 **199ms**, NoTrace **156ms**도 남는다. 이 시간 전체를 helper나 원래 builder callback 하나의 비용으로 확정하지 않는다.

§15 대비 All의 p95는 낮아졌지만 최대 지연·offset 정체와 backlog 목표는 미달이다. 서로 다른 실행의 작은 차이로 통제된 개선율을 주장하지 않으며, **지역 함수 제거의 확인과 새 월 처리량 목표 달성을 구분**한다. Widget/Element 전체 allocation 표본과 직접 projection을 끈 독립 성능 비교도 미실행이다. All App samplesThrough **234/overwrite 106**, bounded trace overwritten **14,603**이며 전체 pass 전수 수집으로 부르지 않는다.

네 Windows 실행은 모두 exit/status 0·reservedBytes/memoryTotal 0·workersJoined/appExited true·ringLost/outputDropped 0으로 회수했다. peak bytes All/Fast/contact/NoTrace는 **529,914,056 / 506,374,633 / 524,027,593 / 530,773,467**이다.

[Web 검사](Nelyx/eng/check-date-scroll-web.mjs)의 threaded(`isolated`)·single-worker(`plain`) 모두 6개월 전진·6개월 복귀와 header/전체 날짜/resize·증가 제한·오류 없음 PASS다. **추가 `--year-mode`로 실제 연도 화면 진입 → 2026 선택 → 원래 월/날짜 화면 복귀도 두 profile PASS**다. 연도 전환 전 왕복/resize의 nodes/elements는 각각 **1,787/4,455 → 1,787/4,455 → 1,877/4,545**, builders 3이었다. 연도 전환 이후의 별도 장기 증가 검사는 아니다. 양쪽 종료 reservedBytes **0**/workersStopped **true**를 확인했다. 같은 Core의 독립 설치 검증은 §15에 있으며 이번에는 바뀐 Material과 실제 App을 재검증했다. 소유 process·임시 분석/oracle·browser context·이전 dist/staging 잔류 없이 현재 dist와 기존 사용자 디렉터리만 보존했다.

### 16.3 남은 구현과 다음 실행점

전체 작업은 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. W11-02의 명시된 helper 결합은 구현했으나 필수 Source 객체 생성·build/reconcile와 capture/scene이 여전히 예산을 넘는다. 전체 필드별 setter journal·남은 adapter, demand→coverage-ready identity 연결, UIA 실제 소비자/관찰 조건과 원본 visual·사용자 물리/display/scanout·resize 성능·다른 플랫폼 의무는 남는다.

다음에는 retained builder의 원래 callback과 dirty 자손 build/reconcile·render commit을 현재 소스의 실제 호출 경계로 나눈다. 지역 함수 제거를 같은 값의 cache·추가 factory로 반복 확장하지 않는다. Babel 상속 helper의 반복 allocation도 여전히 검토 대상이며 `new.target`·교체 superclass·전체 mixin 의미를 잃는 lowering으로 바꾸지 않는다. 구조화된 payload 기록 후보를 다시 도입하거나 원본 Widget/State·사용자 callback·4페이지 resident 상한·입력/animation을 바꿔 통과시키지 않는다. capture/정리 자동 승인 거부를 해결하거나 우회했다는 주장도 하지 않는다.

## 17. Source 하위 트리 비용과 Hermes 클래스 생성 수정

### 17.1 실제 builder 호출과 하위 요소 갱신을 분리

[LayoutBuilder](Nelyx/src/framework/widgets/layout-builder.ts)에 owner 수명의 스칼라 카운터를 추가하고 [BuildOwner](Nelyx/src/framework/widgets/framework.ts)의 dirty flush와 render commit을 나눴다. 원래 callback, 즉시 element rebuild, dirty 자손 처리, render commit, 전체 scope, 마지막 sync를 기존 bounded App pass에 연결한다. callback과 즉시 rebuild는 descendant 시간에서 제외하며 scope에는 포함된다. 원래 builder 실행·예외 복구·deferred frame 취소·새 invalidation 순서는 유지한다. 스냅샷은 불변이고 별도 이력 파일은 생성하지 않는다.

첫 비용 분리 공급은 native/source `820c61cc…`, JS `3c597401…`, HBC `34120974…`였다. All PID **768** / CLI **21752** / HWND **7931878** / DPI **192**, 기능 PASS·362/0, 360/360 이동 반영·missing 0, 지연 p95/최대 **116.822/182.017ms**, offset 정체 최대 **190ms**·≥100ms **10회**, backlog **114.667px**로 성능 FAIL이었다. 같은 `document=143/input=367` pass의 retained **157ms** 중 callback/즉시 rebuild는 **0/0ms**, 전체 scope는 **156ms**였다. 이 결과는 원래 builder 하나의 계산보다 scope 안의 하위 작업이 비싸다는 증거이며, 전체를 constructor 비용으로 확정하지 않는다.

### 17.2 큰 함수의 클래스 spill 오류를 고친 공급

native class의 작은 Core 그래프는 통과했지만 실제 App은 `SliverGeometry extends Diagnosticable(class {})` 초기화에서 `Object is not a constructor`로 실패했다. 빈 base에 명시적 생성자를 넣은 후보도 같은 오류로 실패했고 철회했다. 같은 전체 App의 debug 컴파일은 통과하고 optimized 컴파일은 실패했다.

pinned Hermes의 IR·spill 코드를 대조했다. 큰 함수에서 생성자와 사용하지 않는 home object가 같은 높은 레지스터 **r615**를 공유할 수 있다. `CreateClass`는 home object를 먼저, 생성자를 마지막에 쓰지만 기존 spill은 생성자를 r615에 저장한 뒤 home object로 덮어썼다. [공급 패치](Nelyx/sdk/tooling/cli/src/static-hermes-compiler-patch.mjs)는 클래스의 주 결과를 마지막에 spill하고 결과 사용자를 그 spill에 연결한다. source archive/pin·JSI **21**·HBC **99**를 유지하며 `compilerClassSpill=nelyx.hbc-class-spill/v1`을 공급에 기록한다. [엔진 공급 검사](Nelyx/engine/tools/build.mjs)는 이 정책과 실제 패치 파일·compiler/VM hash를 확인한다.

[Windows App 빌드](Nelyx/sdk/tooling/cli/src/engine-v2-runner.mjs)는 이 공급에서 native class를 유지하고 `classes=native-spill-v1`, compiler policy `windows-hermes-94aa5e1d-no-cfg-class-spill-v2`를 요구한다. 원래 constructor·상속·field 실행은 유지하면서 반복 Babel 상속 helper 실행을 제거했다. 준비 중 발견한 CMake의 삭제된 MSVC **14.51** 경로도 현재 **14.52.37025** 도구로 갱신한다. 실제 공급 compiler/VM hash는 각각 `ed4d44de…` / `3d14f41d…`다.

[pinned VM 검사](Nelyx/eng/check-hermes-syntax.mjs)는 실제 배포 Core의 값·descriptor·subclass·LayoutBuilder와 native async/spread/rest를 통과했다. 별도 `new.target`, 교체 superclass, super가 반환하는 객체와 field 순서, class의 일반 함수 호출 거부도 PASS다. 650개 live value 사례와 별도로 **실제 전체 App module initialization을 debug/optimized 모두 실행해 PASS**했다. 작은 그래프 통과만으로 제품 공급을 채택하지 않는다.

### 17.3 첫 native-class 공급의 실제 결과

이 절의 공급은 source **`5af8cb078b1b1cf21e3e4e323db6159093818562dd7d580192425daf1713f9f4`**, ABI **2** / schema **313408118**, engine **356** / App **10** files, Windows JS **`1e0b6051a60bbd6d60e8f62cc261ad1a2f86344887e03d1f5ad13a3b2b5eca06`**, HBC **`535f5dc4d4e3f460fe19a4431d721cd25dd20241be11368a2f322d90a7c1e303`**다. 아래 Web resize 수정 전의 공급으로 구분한다.

| 실행 / 실제 owner | 기능과 표시 결과 |
| --- | --- |
| All / 12개월 / 60Hz / PID 44336, CLI 4524, HWND 2951410, DPI 192 | 목록 4구간·2026-11→2027-11·cancel/resize·전체 날짜·**실제 연도 화면에서 2027 선택 후 월 복귀**·15일 확정·close PASS. 360 updates/6,000.124ms, main **362 admitted/rejected 0**, driver lateness 최대 **0.818ms**. **360/360 반영**, missing 0, 오차 `<1.82e-10px`. 지연 **96.078/179.872ms**, ≥100ms **14개**로 FAIL. offset 정체 최대 **189ms**, ≥100ms **6회**, backlog **114.667px**. App turn p95/최대 **52.731/334.680ms** |
| 빠른 24개월 역방향 / PID 34192, CLI 14212, HWND 3934500, DPI 192 | **120/0**, 2,207.646ms, 2026-11→2024-11·날짜 확정·close PASS. offset 정체 최대 **322ms**, ≥100/250/500ms **9/4/0회**, backlog **2,064px**로 W11 FAIL. App turn **248.097/284.263ms** |
| 0.4/0.8페이지 양방향 / PID 23220, CLI 20876, HWND 8259558, DPI 192 | **180/0**, 각 36 updates·cancel/resize·선택·close PASS. 게시/서로 다른 offset **38/36, 35/35, 35/35, 35/35**, 반영 지연 최대 **26.362/14.025/13.569/14.525ms**, 오차 `<8.74e-11px`. resident contact 의미 PASS |
| Calendar / 12개월 / 60Hz / NoTrace / PID 37684, CLI 14852, HWND 4065226, DPI 192 | main **362/0**, 6,000.582ms, 날짜/resize/close PASS. driver lateness 최대 **2.938ms**. trace-disabled이므로 movement/offset/W11 성능은 **notVerified**이며 기본 App/native diagnostics는 계속 켜져 있음 |

All의 같은 `document=151/input=431`은 build/retained **134/134ms**, callback/즉시 rebuild/descendant/render commit/scope/sync **0/0/129/4/133/0ms**, capture/scene **93/129ms**, created/captured **398/847**, module/binding/adapter **76/715/132**, scalar encode/reuse **301/424**, `sourceThrough=74`다. 최근 128 pass의 build/capture/scene 최대 **134/211/129ms**는 연도 전환·resize까지 포함한 서로 다른 pass의 최대이며 합산하지 않는다. Source 준비 **83 calls/592ms/최대 50ms/overwrite 0**, builder 전체 **84 calls/31 builds**, descendant/render commit 누적 **2,249/83ms**다. constructor helper 제거는 확인했지만 남은 하위 요소 갱신을 해결하지 못했다. toolset 재빌드·추가 계측·실행별 pass 수 차이도 있으므로 이전 공급과 통제된 개선율을 주장하지 않는다.

네 실행은 exit/status **0**, reservedBytes/memoryTotal **0**, workersJoined/appExited **true**, ringLost/outputDropped **0**으로 종료했다. peak bytes는 All/Fast/contact/NoTrace **527,400,608 / 511,571,166 / 524,214,243 / 527,264,135**다. All bounded App samplesThrough/overwrite **247/119**, trace overwritten **15,658**이며 전수 pass 수집으로 부르지 않는다.

### 17.4 Web resize에서 드러난 anchor 수정 — 재검증 진행 중

같은 공급의 Web threaded(`isolated`)는 월 왕복·resize·2026 연도 선택 PASS였다. single-worker(`plain`)는 월 왕복 후 resize에서 **November 2026과 October 2026의 61개 날짜**가 함께 노출돼 실패했다. 종료는 양쪽 reservedBytes **0** / workersStopped **true**였다. 이 실패를 재실행으로 지우거나 Web 전체 PASS로 기록하지 않는다.

[Core anchor](Nelyx/engine/core/scheduler/scheduler.cpp)는 이전 행의 미세한 겹침을 anchor로 선택할 수 있는데, 페이지 크기가 344→360으로 바뀌어도 그 행 안의 이전 픽셀 위치를 유지했다. 관측된 **46,784px**는 기대 페이지 경계 **46,800px**보다 16px 앞선 값으로 이 계산과 일치한다. 수정은 이전 viewport의 크기로 가시 행을 고르고, snapping fixed page의 span 변경에는 선언된 fixed extent로 상대 진행도를 보존한다. 고정 pin의 [Flutter `_PagePosition`](https://github.com/flutter/flutter/blob/71e4717a61786faab4c7aa39825989305ed29e8a/packages/flutter/lib/src/widgets/page_view.dart#L376-L464)과 대조해 정수 페이지 근처의 오차를 **페이지 단위 `precisionErrorTolerance=1e-10`**로 정규화한다. 일반 목록의 pixel anchor는 유지한다.

[회귀 검사](Nelyx/eng/check-frame-reuse.cpp)에 양축·확대/축소·부분 페이지/경계 오차·일반 목록을 추가했다. 첫 후보는 측정된 row extent를 비율로 사용해 경계 oracle가 실패했고, fixed page의 선언 extent와 원본의 페이지 단위 허용오차를 사용하도록 보완했다. 최종 native/Web 공급을 다시 빌드했고 **§17.5에서 Core 회귀와 실제 제품 경로를 재검증**했다. §17.3의 이전 공급과 구분한다.

v3 준비 경로를 잘못 선택한 실행은 자체 finally로 임시 소스 대조 디렉터리와 owner lock을 회수했다. 별도의 중단·임시 복사본/아카이브 삭제 명령은 자동 승인 검토에서 `blocked by policy`로 거부됐고 재실행하지 않았다. pinned 소스 아카이브는 현재 toolchain cache에 남아 있다. 기존 사용자 디렉터리와 2026-11-08의 engine cache는 보존한다.

이 절 시점에는 후속 공급 재검증을 진행 중이었다. 최종 기능 회귀 결과와 남은 전체 의무는 §17.5–17.6에서 구분한다.

### 17.5 최종 fixed-page anchor 공급 검증

현재 source/supply는 **`7801b11834650c11ecc6a6a737176ddcabb30390b3b24f177ab693f426e066f1`**, ABI **2** / schema **313408118**, engine **356** / App **10** files다. Windows JS는 §17.3과 같은 **`1e0b6051a60bbd6d60e8f62cc261ad1a2f86344887e03d1f5ad13a3b2b5eca06`**, 새 HBC **`7a244537ffae82c45bf750a26edb9691433dad165b0e29851320f866dd4c16f1`**, Web JS **`a2091add13aa21d603060374328ea74e6d3d4a958aeee1b781059693d3755d41`**다. 두 App identity와 Core/Material Source inputs를 최종 확인했다. 원본 생성기 검증은 바뀌지 않은 §16의 시스템 Dart **3.12.2 / 75/75·원본 oracle PASS**다.

최종 native library의 frame oracle는 양축 grow/shrink·129.5/130/정수 근처 페이지·일반 목록의 pixel anchor, 원본 page spring·RTL/date grid·native frame/semantics·generation/lease·Source 지연/취소/반전·coverage 재요청을 모두 PASS했다. 원본의 허용오차 안에 있는 `130-5e-11` 페이지도 정확한 새 정수 경계로 복원한다. 이 검사는 사용자 물리 resize나 scanout 성능 수락은 아니다.

| 실행 / 실제 owner · DPI 192 | 기능과 표시 결과 |
| --- | --- |
| All / 12개월 / 60Hz / PID 15512, CLI 20924, HWND 4458736 | 목록 4구간·2026-11→2027-11·cancel/resize/header/전체 날짜·실제 연도 선택 2027→원래 월·15일 확정·close PASS. 360 updates/6,000.237ms, main **362/0**, driver lateness 최대 **0.756ms**. **360/360 반영**, missing 0, 오차 `<1.68e-10px`. 지연 p95/최대 **97.825/167.275ms**, ≥100/250ms **17/0개**로 FAIL. offset 정체 최대 **177ms**, ≥100/250ms **8/0회**, backlog **103.200px**. App turn **257.708/379.728ms** |
| 빠른 24개월 역방향 / PID 26652, CLI 38984, HWND 3278786 | **120/0**, 2,213.518ms, 2026-11→2024-11·15일 확정·close PASS. offset 정체 최대 **313ms**, ≥100/250/500ms **11/1/0회**, backlog **1,376px**, App turn **150.571/266.807ms**로 W11 FAIL |
| 0.4/0.8페이지 양방향 / PID 35400, CLI 4268, HWND 4917486 | **180/0**, 각 36 updates·cancel/resize·날짜 확정·close PASS. 게시/서로 다른 offset **39/36, 35/35, 35/35, 35/35**, 반영 지연 최대 **21.734/14.017/15.034/14.239ms**, 오차 `<8.74e-11px`. resident contact 의미 PASS |
| Calendar / 12개월 / 60Hz / NoTrace / PID 26248, CLI 37912, HWND 3278864 | main **362/0**, 6,000.137ms, 12개월·cancel/resize·날짜 확정·close PASS. driver lateness 최대 **1.803ms**. movement/offset/W11 성능은 trace-disabled로 notVerified이며 기본 diagnostics는 활성 |

같은 cold pass `document=160/input=428`의 build/retained **178/178ms**, callback/즉시 rebuild/descendant/render commit/scope/sync **0/0/173/4/177/0ms**, capture/scene **101/88ms**, created/captured **398/847**, module/binding/adapter **76/715/132**, scalar encode/reuse **301/424**, `sourceThrough=76`다. Source 하위 요소 갱신의 긴 동기 구간이 남았다. 최근 128 pass의 build/capture/scene 최대는 **178/189/165ms**로 서로 다른 pass다. Source 준비 **87 calls/588ms/최대 52ms/overwrite 0**, builder **84 calls/31 builds**, descendant/render commit 누적 **2,339/98ms**다. All bounded App samplesThrough/overwrite **248/120**, native trace overwritten **15,844**와 실제 입력 ring loss **0**을 구분한다.

네 Windows 실행은 exit/status **0**, reservedBytes/memoryTotal **0**, workersJoined/appExited **true**, ringLost/outputDropped **0**으로 종료했다. peak bytes All/Fast/contact/NoTrace는 **526,098,173 / 511,188,510 / 524,202,912 / 528,920,927**이다.

Web threaded·single-worker 모두 **6개월 전진/6개월 복귀·header/전체 날짜·resize·성장 제한·2026 연도 선택·오류 없음 PASS**다. 양쪽 nodes/elements는 **1,787/4,455 → 1,787/4,455 → 1,877/4,545**, builders **3**이며 연도 전환 전의 왕복/resize 관찰 범위다. 이후 장기 증가 검사로 확대하지 않는다. 양쪽 종료 reservedBytes **0** / workersStopped **true**, 소유 Windows test process·browser context·App staging·이번 engine staging 회수를 확인했다. §17.4의 수동 정리 거부와 남은 현재 toolchain archive는 별개로 보존한다.

### 17.6 남은 Source 비용과 다음 실행점

§17 검증을 마쳤을 때 판정은 **IN PROGRESS / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`였다. fixed-page resize 기능 회귀는 통과했지만 연속/빠른 이동 성능 목표는 계속 FAIL이다. full setter journal·남은 adapter, demand→coverage-ready 인과, UIA 실제 소비자/관찰 조건, 원본 visual·물리/display/scanout·다른 플랫폼 의무는 남는다.

다음 Source 후보는 Windows App에서 각 필드마다 실행되는 esbuild `__publicField`와 pinned Hermes의 표준 instance-field initializer를 대조하는 것이다. 현재 배포는 class 문법만 native로 유지하고 field는 ES2015 helper로 내린다. compiler 소스는 필드 정의와 초기화 호출을 별도로 제공한다. 먼저 field descriptor·상속 setter·반환 객체·computed key·순서/예외·`new.target`·전체 App 의미를 확인하고, 같은 공급에서 필수 Source 객체를 모두 실행한 비용을 비교한다. 아직 native field 채택이나 성능 개선을 구현·입증한 것은 아니다. 과거 generic constructor schema·mutable 결과 cache를 반복 도입하거나 원본 constructor/사용자 callback·4페이지 resident 정책·입력/animation을 생략하지 않는다.

## 18. 중간 마무리와 재개 지점

### 18.1 PAUSED / PARTIAL — 보존한 상태

2026-11-13 사용자의 **“일단 중간 마무리하자”** 요청으로 중단했다. source 변경·현재 dist·미커밋 작업 트리를 보존하며 commit/reset/별도 archive를 만들지 않았다. 이 중간 마무리에서 제품 구현·통합 테스트를 추가하지 않았고, 공급 identity와 Source 정합성만 read-only로 확인했다.

중단 직전 read-only 확인으로 현재 engine source와 Windows/Web 공급이 모두 **`7801b11834650c11ecc6a6a737176ddcabb30390b3b24f177ab693f426e066f1`**에 일치하고, §17.5의 App JS/HBC identity와 Core/Material Source inputs가 유효함을 확인했다. Windows는 **`classes=native-spill-v1`**이며 native instance field 전환은 적용하지 않았다.

- **구현·검증 완료 범위:** 공통 module/binding 참조와 Source 값 구성, 날짜/연도 helper 정적 결합, 실제 builder/자손/render commit 비용 분리, Hermes class spill 수정, 원본 Flutter의 페이지 진행도·허용오차에 맞춘 fixed-page resize anchor. 세부 범위와 이전 공급은 §12–17에서 구분한다.
- **기능 검증 PASS:** §17.5 Windows All·빠른 24개월·양방향 접촉·NoTrace, 양쪽 Web profile의 월 왕복/resize/실제 연도 선택, Core frame/anchor·coverage/취소/반전·lease 회귀. 루트/CLI 타입, 구현 lint, 43개 TS/MJS/MTS formatting, `git diff --check`도 통과했다. 생성기는 §16의 **시스템 Dart 3.12.2 / 75/75·원본 oracle PASS**를 유지한다.
- **성능 미달:** 최신 60Hz 12개월의 이동 게시 p95/최대 **97.825/167.275ms**, offset 정체 최대 **177ms**·≥100ms **8회**. 빠른 24개월 정체 최대 **313ms**·≥100ms **11회**. 같은 cold pass의 자손 처리 **173ms**, render commit **4ms**이며 이를 constructor 단독 비용으로 확정하지 않는다.
- **회수·보존:** 소유 Windows host/checker와 Web 검사 프로세스가 남아 있지 않다. 이번 App/engine staging은 회수했으며 현재 dist와 기존 사용자 디렉터리·2026-11-08 engine cache는 보존한다. §17.4에서 자동 승인 검토가 거부한 수동 정리 명령은 재시도하지 않았다. 현재 Hermes toolchain의 pinned 소스 아카이브는 남아 있다.

### 18.2 재개 순서와 미완료 의무

1. §17.5 identity와 현 diff를 다시 확인한다. 다음 후보인 **표준 instance-field initializer**는 compiler의 `DefineOwnProperty`와 초기화 호출 코드까지 읽은 **분석 단계**다. 지원 flag·제품 코드·효과 oracle·성능 비교는 아직 추가하지 않았다. descriptor·setter·반환 객체·computed key·실행/예외 순서·`new.target`·전체 App 의미를 먼저 보존하고, 실제 공급에서 효용을 확인한 뒤 채택 여부를 정한다.
2. **전체 render setter별 dirty journal과 남은 adapter**, 원본 Source 필수 실행/할당의 owner별 독립 분리, direct projection을 끈 성능 비교를 완료해야 한다. 작은 값 factory·mutable cache·원본 constructor/callback 생략으로 대체하지 않는다.
3. **demand revision→Source pass→Content ready→최초 실제 이동 게시**의 bounded 인과 연결과 coverage-ready p95/최대가 남는다. 이미 측정한 이동 지연 FAIL을 이 미검증 값과 혼동하지 않는다.
4. **실제 UIA 소비자와 관찰 조건**, 원본 visual 검토·사용자 물리 입력·display/scanout·resize 성능, [work10 §8](work10.md#8-work9-종료와-잔여-의무-이관)의 다른 API/플랫폼·제품 전환 의무는 남는다. Windows/Web 기능 PASS를 이 범위의 완료로 확대하지 않는다.

최종 중단 상태는 **PAUSED / PARTIAL**, `compatible=false`, `performanceAccepted=false`, `resizePerformanceAccepted=false`, physical/display/scanout **notVerified**다. 사용자가 재개를 요청하기 전까지 새 작업을 시작하거나 자동 재개하지 않는다.

### 18.3 후속 요청에 따른 구형 출력·일회성 검사 정리

2026-11-13 사용자의 구버전·불필요한 테스트 정리와 `.tmp` 이동 요청으로, 현재 실행 경로와 소스 참조를 대조한 뒤 **38개 경로 / 118,708개 파일 / 19,804,584,445 bytes(18.44 GiB)**를 `.tmp/obsolete/<원래 경로>`로 이동했다. 복사본이나 압축 archive를 추가하지 않았으며, 이동 전후 파일 수·용량이 모두 일치하고 원래 경로가 사라졌음을 확인했다. 전체 목록은 [삭제 대기 자료](.tmp/README.md)에 있다. 이동만으로 디스크 공간이 반환되지는 않으며, 사용자가 이 자료를 영구 삭제할 수 있도록 `.tmp`에 모았다.

- **이동:** `.nelyx/date-picker-port`의 초기 생성기 probe·생성 사본·별도 Dart dev SDK, `.nelyx/viewport-grid-review-c18d66d9`의 일회성 시각 검사·이전 host 사본, `Nelyx/engine/.cache/engine-vTz0Je`의 중단된 staging, 구형 Demo/Testbed의 `.nelyx` 설치·실행 사본과 Android/Windows/Metro 빌드 출력, 루트 CMake 출력·로그·PDB. 이미 `.tmp`에 있던 `w10-windows-guCeXo`는 새 복사 없이 유지했다.
- **유지:** 현재 `Nelyx/engine/dist`·`dist-android`, package/App dist, 시스템 Dart, 현재 Hermes source/build/pinned archive, Android v2 입력, Skia 공급 cache, reference 원본, 원래 소스와 작업 이력. `Nelyx/eng/check-*`와 생성기 `verify-*`는 현재 소스/계약의 회귀 검사이므로 제거하지 않았다. 구형 runner의 소스·명령도 남아 있으며 해당 runner를 다시 사용하려면 필요한 준비/빌드를 다시 수행해야 한다.
- **재발 방지·확인:** 실수로 추적되던 루트 `vc140.pdb`를 이동하고 `.gitignore`에 `*.pdb`를 추가했다. 현재 Windows/Web App과 engine의 모든 manifest 파일 무결성·ABI/schema·source identity 검사를 통과했으며 공급 hash는 §18.1의 `7801b118…66f1`, Windows는 `classes=native-spill-v1`을 유지한다. 제품 구현·기능/성능 테스트는 추가 실행하지 않았다.

이 정리는 후속 파일 관리 요청의 범위이며 `work11` 목표를 재개하지 않는다. **PAUSED / PARTIAL**과 §18.2의 미완료 의무를 유지한다.
