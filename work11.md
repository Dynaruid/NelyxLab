# work11 — 새 월 준비를 위한 Source 실행·렌더 투영의 결합

작성: **2026-11-13 KST** · 상태: **DESIGN / 구현 미착수** · 대상: [work10-a1](work10-a1.md)의 빠른 월 이동 정체

**제안:** 먼저 **접근성의 Source 구성·App 관찰·Core 조립·Windows UIA 갱신 비용을 분리**하고, 구조·속성이 그대로인 스크롤에서 반복되는 목록·문자열·사각형 재구성을 줄인다. 이 제한된 개편 뒤에도 새 월 준비가 느리면, 원래 TS Widget/Element/State를 실행한 뒤 그 결과를 capture 트리와 Scene 기록으로 반복 변환하는 구조를 **생성 시 정한 투영 절차와 실행 시 유지하는 RenderBinding 기록**으로 바꾼다. 생성된 Source 코드의 불필요한 중간 표현도 함께 줄인다. 준비 창을 늘리는 대신 **같은 원본 의미를 더 적은 작업으로 준비**하는 것이 목적이다.

**접근성 검토 반영:** 접근성은 구체적인 비용 후보지만 403ms 정체의 주원인으로 확정되지 않았다. §2.1–2.4에 소스 근거·소비자·개편 계약을 추가하고, 기존 대규모 투영 개편보다 **W11-00A/00B의 비용 분리와 접근성 증분 갱신을 먼저 수행**하도록 순서를 바꿨다. 이번 추가 작업도 문서·소스 검토에 한정하며 A/B 실행이나 제품 변경을 수행하지 않았다.

이 문서는 요청에 따른 새 아이디어·설계·구현 계획이다. 제품 코드 수정·빌드·앱 실행·새 성능 측정은 수행하지 않았다. [work10-a1 §24](work10-a1.md#24-2026-11-12-새-월-격자의-source-왕복과-반복-할당-제거)의 결과는 이전 실행 기록이며, 이번에 현재 공급의 전체 hash나 실행 PID까지 재검증한 결과가 아니다. 기존 문서를 종료하거나 이미 구현한 기능을 초기화하지 않는다. 기존 실행 계약은 [work10](work10.md)과 [work10-a1](work10-a1.md)에 남기고, 이 문서는 후속 구현 설계로 연결한다.

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

날짜 생성기 전체 분석/재생성은 요구 언어 버전을 만족하는 Dart SDK로 실행해야 한다. 이전 §24의 Dart 3.12.2/분석 package 3.13 불일치를 해결하지 않은 상태의 TS suffix 비교는 전체 generator 검증을 대체하지 않는다. 설치·환경 변경을 문서 작성 단계에서 실행하지는 않는다.

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
- [ ] W11-00 대표 경로·최소 입증 범위 고정.
- [ ] W11-00A 접근성 단계 비용과 실제 소비자·관찰 조건 분리.
- [ ] W11-00B 확인된 접근성 반복 구성의 증분 갱신·회귀 검증.
- [ ] W11-01 직접 RenderBinding → 기존 writer 연결.
- [ ] W11-02 생성기 specialization과 필수 Source 비용 판정.
- [ ] W11-03 달력·일반 소비자 통합.
- [ ] W11-04 공급·기능·연속 표시 통합 확인.
- [ ] W11-05 사용자 물리 확인·기존 실행 계약 갱신.

**다음 구현 시작점:** W11-00/00A에서 [OriginalSemanticsBridge.refresh](Nelyx/runtime/app/semantics.ts) → [SemanticsBinding.updateViewSemantics](Nelyx/src/framework/semantics/binding.ts)의 중복 변환과 [Windows Interaction.sync](Nelyx/engine/platform/windows/interaction.hpp) → [SemanticsTree.publish/update](Nelyx/engine/platform/windows/interop/SemanticsTree.h)의 전체 packet 재구성을 우선 대조한다. 새 월의 Source Semantics 생성/metadata 비용도 함께 분리한다. 확인된 경계부터 W11-00B로 수정하고, 남은 지연이 Source/capture/records에 있으면 기존 W11-01–03으로 이어간다. **접근성 원인 확정·수정·A/B·성능 검증은 아직 하지 않았다.** 과거 §24의 짧은 합성 PASS를 새 설계의 근거 없는 성능 완료로 승격하지 않는다.
