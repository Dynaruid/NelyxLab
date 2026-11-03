# 공통 엔진 성능 개선 구상 — 반복 준비 축소와 C++ 상태 유지

작성: **2026-11-03 KST** · 상태: **재실험·직접 조작 C++ 모드 구현/검증 완료(§16–17) — 일반 기본값 TS / 제품 PARTIAL 유지**

**C++ 적용은 입력 대상 탐색과 공유 좌표 데이터부터 검토한다.** TS가 같은 트리를 매번 펼쳐 C++에 보내는 비용을 줄이고, C++가 검증된 숫자 상태를 유지하면서 변경분과 실제 질의만 처리하도록 설계한다. 위젯 생성·의존성·reconciliation은 TS 소유를 유지하며, 공통 자료구조와 반복 준비를 먼저 개선한다.

힌트는 Doroti의 [shared-engine-performance-summary.md](../DorotiLab/history/26/11/01/shared-engine-performance-summary.md)다. Doroti에서 여러 화면이 함께 빨라진 이유를 Nelyx의 현재 코드와 대조하고, **새로 줄일 작업과 기존 C++ 실험의 차이**를 정리했다. 이 문서는 후속 설계이며 [work4.md](work4.md)의 진행·채택 기록이나 [work3.md](work3.md)의 평가 결과를 덮어쓰지 않는다. 기존 제품 상태 `PARTIAL`, `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다.

## 1. Doroti에서 가져올 원리와 Nelyx의 차이

Doroti 기록에서 마지막 공통 수정은 의존성 검색·등록·해제의 선형 비용과 중복 실행 범위 생성이었다. 새 목록 행, 월 전환의 날짜 셀, lazy 생성이 같은 엔진을 지나므로 여러 화면의 개선으로 이어질 수 있었다. Nelyx에서도 **반복 횟수·순회·객체 수명을 먼저 살펴야 한다.**

| Doroti의 힌트 | Nelyx에서 확인한 현재 상태 | 적용 판단 |
| --- | --- | --- |
| 선형 의존성 저장소를 해시 검색·순서 보존 구조로 교체 | [InheritedElement](Nelyx/src/framework/widgets/framework.ts)의 `dependents`는 이미 `Map`, Element의 의존성은 `Set`이다. [DependencyScope](Nelyx/src/runtime/dependency-scope.ts)는 상속 링크와 최대 4개 조회 메모를 사용한다 | 같은 선형 저장소 교체를 반복할 근거가 없다. 알림 snapshot, 재등록, aspect 집합, 동적 type 경로의 실제 작업량을 조사한다 |
| 같은 뷰의 중첩 실행 범위·임시 객체 감소 | `Element.rebuild`는 현재 Element를 저장·복원하고 `ComponentElement.performRebuild`는 동기 build/reconcile을 수행한다. [PlatformDispatcher](Nelyx/src/ui/platform-dispatcher.ts)의 callback context도 별도 계약이다 | Doroti의 .NET `AsyncLocal` 비용을 Nelyx에 가정하지 않는다. callback wrapper·focus 범위의 실제 중복이 관찰될 때만 재사용한다 |
| 같은 owner의 keep-alive 이동에서 detach/attach 생략 | [RenderSliverMultiBoxAdaptor](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts)의 `_destroyOrCacheChild`는 active chain에서 bucket으로 옮기고, 복귀는 `super.move`를 사용한다 | 표준 경로는 연결을 이미 유지한다. cache 이동 때 전체 subtree를 다시 연결한다고 전제하지 않는다 |
| 닫힌 그리기 명령·path·텍스트 재사용 | [PaintingContext](Nelyx/src/framework/painting/context.ts), [RepaintBoundary](Nelyx/src/framework/rendering/repaint-boundary.ts), [Scene](Nelyx/src/ui/scene.ts)에 재사용 경로가 있다 | 재사용 객체를 한 겹 더 쌓기보다 생성·무효화 지점에서 변경 정보를 유지한다 |
| 프레임 반복 closure·열거·peer 목록 생성 감소 | work4에서 빈 hover 처리, 내부 matrix 곱·inverse, bounds와 불변 자식 snapshot 접근을 이미 개선했다 | 같은 작은 최적화를 새 후보로 계산하지 않는다. 남은 대상 탐색·snapshot 준비를 본다 |

Doroti의 **10,240→20회 비교**, 중첩 범위 **27,200→5,440B**, 월 전환 UI owner wall time **75.673→19.009ms**는 해당 문서의 서로 다른 검사 결과다. Nelyx의 예상 개선율이나 FPS로 환산하지 않는다. Doroti에서도 lazy load의 독립 개선폭은 분리 계측하지 않았다.

Nelyx Testbed의 Material/Cupertino Date picker는 현재 catalog에서 `planned`다. theme 파일의 존재를 실제 달력 구현으로 보지 않는다. 이번 검증 장면은 기존 Gallery·ListView·mixed 입력 화면과 공통 build fixture로 잡는다. 달력 구현을 이 성능 작업에 추가하지 않는다.

## 2. 지금 우선순위를 정하는 근거

### 2.1 최근 기록을 기준으로 삼되 새 측정과 구분

다음 값은 **work3·work4에 보존된 기존 실행**이다. 이번 작성에서는 문서와 현재 소스만 읽었으며 제품을 실행하거나 성능을 재측정하지 않았다.

| 근거 | 이번 설계에 주는 의미 |
| --- | --- |
| work4 §9.4 일반 Gallery 평균: 좌 **53.547873→53.641015**, 우 **52.476282→54.621647 surface FPS** | 작은 입력 비용 감소는 오른쪽 열에 약 4.1% 이득이 있었으나 지속 60fps와 체감 해결은 미수락이다 |
| work4 §9.3 별도 진단: 입력+post-frame hit test **frame당 약 2.93–3.16ms** | 여러 packet과 post-frame에 걸쳐 반복하는 대상 탐색이 첫 구조 후보다. 입력 hit test는 transport wall에 포함되므로 중복 합산하지 않는다 |
| work4 §8.7 mixed warm 진단: geometry 준비 **2.50–2.59ms**, 공개 **1.69–1.73ms**, 방문 중앙값 **459**, provider **12**, 조상 방문 **650** | 이미 있는 local editor cache 이후에도 경로·좌표 준비와 공개 비용이 남는다. 한 군데 산술만 옮겨 전체 비용을 없앴다고 계산할 수 없다 |
| work4 §9.1 Gallery semantics 실행 frame: flush **2.22–3.00ms**, snapshot **1.79–2.76ms**, freeze **0.44–0.78ms** | 의미 트리 갱신과 immutable host snapshot 준비를 나눠 개선한다. 모든 frame 평균과 분모가 다르다 |
| work4 §9 마지막 판단: paint/immutable scene 준비 약 **2.4–3ms**, 비교 자체 약 **0.2ms** | 명령 비교만 없애는 후보보다 실제 명령·snapshot 생성 감소를 검토한다 |
| work3 §10: semantics 후보의 native call 중앙값 **1.212ms**, kernel **0.0163ms**인 별도 진단 | kernel 계산 외에 준비·경계·검증·결과 반영 비용을 함께 줄여야 한다. 두 수치의 차이를 전부 JSI 비용으로 단정하지 않는다 |
| work3 §10.1: Path/paint 입력 평균 **+1.28/+1.95%**, Scene/Semantics **-2.38/-4.45%** | 이미 구현된 C++ 후보의 기본 연결을 다시 켜는 것만으로는 새 개선안이 되지 않는다 |

이 수치들은 서로 다른 장면·제품·계측의 wall 구간이다. 합산해서 한 프레임의 CPU 예산이나 기대 절감량을 만들지 않는다. native producer의 import·completion wait도 남아 있으며 JS 개선 뒤 병목이 이동할 수 있다.

### 2.2 작성 시 checkout

- HEAD: `2a5fdf3b273ae2b1b50cb3dfd5f74c5f2152e288`.
- 기존 미커밋 변경: work4와 입력·matrix·painting·RNW 진단·Windows native/SDK·패키지 관련 파일. 해당 변경을 보존한다.
- work4 §9.4가 최종 Windows 공급 식별을 기록하고 있다. 이번에는 locator·설치본·EXE·bundle 일치를 새로 검증하지 않았다. 실행 착수 때 현재 소스와 실제 공급을 다시 대조한다.
- work4는 최신 Android Core를 재공급하지 않았다고 명시한다. 과거 Android/Web 빌드 결과를 현재 Windows 후속 코드의 검증으로 옮기지 않는다.

## 3. C++에 맡길 경계

추천 구조는 **TS의 의미·수명 관리 + 변경 생산 + C++의 지속 숫자 상태·질의**다. 현재 Skia·Graphite·display-list replay·producer는 이미 native이므로 이들을 처음 C++로 바꾸는 작업으로 설명하지 않는다.

| 책임 | 소유 위치 |
| --- | --- |
| Widget/Element, State, 테마 의존성, reconciliation, 사용자 build·layout·paint·입력 hook, focus/gesture 의미 | TS framework |
| 실제 layout 결과의 parent 관계·변환·clip·순서·지원 가능한 hit 동작 변경 기록 | TS의 기존 attach/layout/scroll/무효화 지점 |
| 검증된 parent/transform/clip/bounds 상태, 공유 조상 계산, 표준 영역의 점 질의·geometry 투영 | 선택적 C++ 서비스 |
| JS 객체·callback과 숫자 handle의 대응, 기존 입력 dispatch, semantics action 및 publication | TS owner |
| immutable recording/Picture·resource lease·GPU 제출·완료 대기 | 기존 native renderer 경로 |

기존 [input geometry](Nelyx/src/hosting/input-geometry.ts)는 전체 숫자 snapshot을 투영하고, [semantics geometry](Nelyx/src/hosting/semantics-geometry.ts)는 query 배열을 받는다. [SceneComposition](Nelyx/skia/native/core/nelyx_skia/scene_composition.h)에는 이미 prepare/commit/discard 상태가 있다. 새 설계는 이 코드와 JSI 설치 경로를 재사용하되, **입력/semantics의 변경 생산과 공유 상태를 추가하는 별도 내부 capability**로 구분한다. 기존 후보의 기본 비활성 정책은 그대로 두고 단독 비교한다.

초기 호출은 현재 JS owner thread의 동기 호출이다. callback을 native worker에서 실행하지 않으며 동기 C++ 호출도 JS thread 시간을 사용한다. Web/custom backend에는 TS 기준 경로를 유지한다. 새 Wasm toolchain·별도 DLL·두 번째 UI 엔진은 도입하지 않는다.

## 4. 후보 A — 위젯 생성·해제의 공통 작업량 줄이기

**우선순위 P0, TS 중심.** Doroti의 원리를 가장 직접적으로 확인하는 작은 출발점이다. warm 스크롤과 새 항목 생성 구간을 분리해서 조사한다.

1. `BuildOwner`의 dirty 등록→scope flush→reconcile→render child 동기화→finalize에서 실제 방문 수, 재스케줄 수, 새 임시 배열·Map 생성 지점을 확인한다. 이미 depth queue·dirty scope 연결 목록이 있으므로 새 큐를 또 만들지 않는다.
2. `InheritedElement.addDependent/removeDependent/notifyClients`의 등록·해제·알림을 구분한다. 이미 Map인 조회는 유지하고, **반복 알림 snapshot이나 동일 aspect 준비가 유의한 경우만** 변경한다. 알림 중 추가·삭제·재등록과 snapshot 순서를 보존한다. live Map 순회로 바꾸어 새 의존성이 같은 알림에 끼어들게 하지 않는다.
3. keep-alive 복귀·GlobalKey 이동·같은 owner의 render child 재배치에서 실제 attach/detach·dependency 재등록 횟수를 확인한다. 표준 sliver의 기존 연결 유지를 기준으로 남은 중복만 제거한다.
4. callback/focus 범위의 재사용은 owner·입력 timestamp·취소·override·복원 의미가 같은 경우에만 검토한다. `withRenderPaint`의 mutation guard나 다른 뷰의 전환을 생략하지 않는다.

**C++ 판단:** Element/Map 등록 한 번마다 JSI를 왕복하거나 native가 JS Element·callback을 보유하는 방식은 선택하지 않는다. 전체 위젯 엔진 이관보다 TS 자료구조·한 번의 flush 안의 준비 공유를 먼저 비교한다. 이 단계에서 비용이 작으면 변경 없이 종료하고 B로 진행한다.

**확인 장면:** 동일한 표준 행이 새로 들어오는 ListView/SectionList, Gallery 첫 진입과 재진입, 작은 공통 fixture의 다수 mount/update/unmount. fixture는 날짜 셀의 공통 경로를 대신 확인할 수 있지만 실제 Date picker 수락으로 보고하지 않는다.

## 5. 후보 B — C++가 좌표 상태를 유지하는 입력 대상 탐색

**우선순위 P1, 첫 C++ 실험 권고.** work4에서 남긴 약 3ms의 대상 탐색을 출발점으로 한다. 첫 적용 범위는 표준 viewport와 지원을 명시할 수 있는 box/container 경로다.

### 5.1 줄일 작업

[ViewRuntime](Nelyx/src/hosting/runtime.ts)는 최대 256 packet mailbox를 순서대로 dispatch한다. [GestureBinding](Nelyx/src/framework/gestures/binding.ts)은 입력 hit test를 수행하고, [MouseTracker](Nelyx/src/framework/rendering/mouse-tracker.ts)는 post-frame에도 현재 pointer 아래 annotation을 찾는다. root는 입력 hit 결과를 MouseTracker에 이미 전달한다. **같은 event의 결과 공유가 전혀 없다고 가정하지 않는다.**

새 후보가 줄일 것은 여러 질의가 동일한 parent 관계·local 변환·clip·children 순서를 다시 준비하는 비용이다. C++에는 숫자 상태와 표준 탐색 규칙만 유지한다. TS는 실제 hit target의 handle을 JS 객체로 대응시켜 원래 순서의 handler·gesture arena·pointer signal 처리를 계속한다.

### 5.2 상태와 변경 생산

- `nodeHandle = slot + generation`에 view/session 소유자를 결합한다. parent handle, local transform, bounds, edge clip, 역 paint 순서와 필요한 표준 hit 규칙을 저장한다. JS 객체·문자열 label·함수는 저장하지 않는다.
- 최초 연결은 한 번 구성하고, attach/remove/reparent·size·scroll/transform·clip·hit behavior·child 순서 변화에서 변경을 기록한다. 다음 질의를 위해 전체 TS tree를 다시 스캔하거나 전체 숫자 table을 만들면 이 설계의 목적을 달성한 것으로 보지 않는다.
- C++가 표준 subtree의 공유 world transform/inverse·clip을 revision별로 계산한다. 순수 scroll은 viewport의 변환 변경으로 표현할 수 있어도, 실제로 좌표가 필요한 자식 계산과 결과 출력까지 O(1)이 된다고 주장하지 않는다.
- broad phase는 해당 subtree의 hit 영역을 보수적으로 보장할 수 있을 때만 사용한다. overflow·clip 밖 자식·투명/불투명·자식 우선·역순을 고려한다. 단순 AABB로 자식을 누락시키지 않는다. 선형 packed traversal과 추가 공간 인덱스는 유지 비용까지 비교하고, 처음부터 복잡한 인덱스를 필수로 삼지 않는다.

### 5.3 event별 유효성 경계

1. 각 질의는 기존 입력 경로가 관찰하던 logical geometry revision·view·viewport/surface 세대와 같은 좌표를 사용한다. native가 먼저 스크롤하거나 입력 때문에 추가 layout을 강제하지 않는다.
2. 첫 packet의 callback이 scroll·트리·clip·크기·focus 관련 상태를 바꿀 수 있다. 이후 packet의 hit 결과를 미리 모두 계산하지 않는다. 다음 질의가 관찰할 geometry가 바뀌면 변경분을 적용하거나 기존 TS 경로로 처리한다.
3. post-frame hit test는 layout/paint 이후 revision으로 다시 수행한다. pointer가 같은 위치라는 이유만으로 이전 대상 경로를 재사용하지 않는다. 콘텐츠 이동에 따른 enter/exit/cursor 갱신을 유지한다.
4. down에서 만들어진 drag/gesture stream의 hit 경로 수명은 기존 GestureBinding 계약을 따른다. 새 index가 매 move마다 다른 대상으로 재지정하지 않는다. wheel/panZoom의 각 callback·timestamp·반전·재접촉·nested scroll 의미를 유지한다.
5. custom `hitTest`·`visitChildren`·child transform·getter·prototype 변경 경로는 원래 TS 동작을 따른다. 지원 여부를 검사하면서 hook을 추가 호출하지 않는다. custom subtree의 호출 순서를 지킬 수 없으면 그 질의 전체를 TS로 처리한다.

**가장 큰 미확정 사항은 지원 계약이다.** 공개 RenderObject의 getter/prototype 직접 변경은 표준 setter를 통하지 않을 수 있다. 한 번 등록한 handle·`instanceof`·동결된 숫자 snapshot만으로 이후 hit 동작까지 표준이라고 보장할 수 없다. W5-2에서는 먼저 대표 표준 경로에서 이 변경과 hook 호출을 어떻게 보존하는지 증명한다. 전체 tree를 질의마다 재검사해야 하거나 안전한 대상이 거의 없으면 native 탐색 index에는 진입하지 않는다. 그 경우 TS의 기존 방문·hook을 유지하면서 준비된 숫자 데이터만 공유하는 작은 후보로 축소하고, 그 비용과 적용률부터 다시 평가한다.

### 5.4 내부 API 초안과 기존 실험과의 차이

아래 이름은 **설계용 초안이며 현재 존재하는 API가 아니다.**

```text
GeometrySession.applyAndQuery(stamp, delta, query)
  -> { revision, hitHandles, requiredTransforms, geometryResults }

GeometrySession.prepareFrame(stamp, delta, requestedEditors)
  -> candidate
candidate.commit() / candidate.discard()
GeometrySession.close()
```

점 질의는 가능한 한 변경 적용과 한 호출로 묶고 실제 필요한 경로만 반환한다. 서로 다른 packet의 callback 사이에 의존성이 있으면 호출을 분리한다. frame geometry candidate의 공개는 기존 commit/discard를 따른다. 입력 질의용 현재 상태와 외부에 공개된 frame snapshot의 수명을 구분하며, 오래된 결과를 새 frame의 결과로 쓰지 않는다.

work3의 geometry 이관은 TS에서 hook·조상 경로를 준비한 뒤 산술을 호출했고, Scene 이관도 frame별 TS source lookup이 남았다. B는 **변경을 만드는 지점부터 연결해 반복 준비를 줄인다는 점**이 다르다. 동일 좌표·순서·hook 동작을 유지할 수 있는 범위와 실제 적용률을 먼저 증명한다. 지원 판정 때문에 전체 트리를 또 방문하거나 대부분 fallback이면 범위를 확대하기 전에 설계를 수정한다.

## 6. 후보 C — semantics snapshot의 내용과 이동을 분리

**우선순위 P2.** B의 공통 좌표 상태가 유효하거나, 별도 계측에서 TS snapshot 생성이 지배적일 때 진행한다. semantics 의미 판단 전체를 C++로 옮기는 계획은 아니다.

[semantics-pipeline](Nelyx/src/framework/rendering/semantics-pipeline.ts)은 dirty config/parent/geometry를 이미 나누고 있다. [root](Nelyx/src/framework/widgets/root.ts)는 조건부 snapshot 재사용도 한다. 반면 새 capture가 필요하면 [SemanticsTransportSnapshot](Nelyx/src/framework/rendering/semantics-transport.ts)에서 host 값을 구성하고 [freezeSemantics/flattenSemantics](Nelyx/src/framework/semantics/semantics.ts)에서 검증·동결·평탄화를 수행한다. 편집기의 snapshot 전체 재사용에는 현재 paragraph/geometry fence 제한이 있다.

1. **TS부터 분리:** framework가 소유하고 검증한 label/value/flags·children membership의 immutable payload와 frame별 geometry/action envelope를 나눈다. 순수 이동에 바뀌지 않은 문자열·속성·내부 배열을 다시 구성하는 양을 줄인다. 공개 mutable 객체나 `Object.freeze`된 사용자 입력은 신뢰된 payload로 취급하지 않는다.
2. **검증 유지:** stable ID 유일성·cycle·전체 count/depth는 구조 변경 시에도 보장한다. 현재 host 상한 **2,048 nodes / depth 64**를 유지한다. payload를 공유해도 매 snapshot의 identity·action 소유자와 전체 구조가 유효해야 한다.
3. **geometry 공유:** B의 같은 transform/clip 상태에서 semantics가 필요한 숫자 결과를 batch로 얻는다. label merge·reading/traversal order·hidden 의미·focus·action 결정은 TS에 남긴다. work3의 endpoint별 단일 query 호출을 그대로 반복하지 않는다.
4. **공개 비용 분리:** host가 absolute rect를 요구하면 움직인 E개 노드의 출력·publication은 여전히 O(E)다. 새 delta host protocol이 이득일지는 별도 후보로 평가하고 첫 구현의 전제조건으로 삼지 않는다.
5. **편집기 수명 보존:** 문자열 payload가 같아도 text input geometry·selection·paragraph revision·action generation은 새 envelope로 검증한다. 현재의 editable snapshot 재사용 금지를 통째로 해제하지 않는다. 오래된 published action은 철회하고 close·replace 뒤 실행을 막는다.

CPU frame seal과 `geometryCommit.commit()/discard()` 이후 semantics publication 순서를 유지한다. interval을 늘리거나 접근성·편집기 갱신을 덜 해서 성능을 얻지 않는다. B가 미채택이어도 C의 TS payload 재사용 부분은 독립 비교할 수 있다.

## 7. 후보 D — 기존 recording의 변경을 생산 지점에서 전달

**우선순위 P3, 조건부.** B/C 뒤에도 paint·immutable scene 준비가 지배적일 때 검토한다. work4의 transform 비교 비용이 작아 W4-2가 비진입이었던 결과를 존중한다.

- 기존 recording/Layer/Scene을 그대로 사용하면서 framework 소유 표준 viewport의 **내용 revision / 구조 revision / 위치 revision**을 연결한다. paint 시 새 명령을 전부 만든 뒤 같다고 확인하는 구간을 줄일 수 있는 범위를 찾는다.
- C++ 사용 여부는 existing display-list/Picture handle에 변경 transform·segment를 직접 연결할 때 전체 비용이 감소하는지로 결정한다. 기존 C++ Scene 후보의 TS source lookup과 결과 복원까지 그대로 남는 연결은 반복하지 않는다.
- 작은 변환 patch를 보내더라도 각 submitted frame은 독립 immutable snapshot과 resource hold를 가진다. GPU가 읽는 과거 recording을 in-place 수정하지 않는다. JS `Picture.onCreate`·custom paint의 호출·예외 순서를 보존한다.
- layout, explicit redraw, animation, persistent callback, capture와 submit은 계속 수행한다. root paint 전체 생략이나 `present='unobserved'`를 근거로 한 제출 취소를 도입하지 않는다.

동일 변경 생산 구조를 지원할 수 없다면 기존 paint 경로를 유지한다. 새 sample boundary·Gallery 분할·영구 keep-alive·GPU cache를 추가해 효과를 대신 만들지 않는다.

## 8. C++ 구현 위치·수명·예산

### 8.1 기존 모듈을 확장하는 배치

| 위치 | 후속 구현 책임 |
| --- | --- |
| [framework.ts](Nelyx/src/framework/widgets/framework.ts), [owner transaction](Nelyx/src/runtime/owner-transaction.ts) | A의 중복 등록·임시 작업 조사와 수정. Element 소유권은 유지 |
| [rendering/object.ts](Nelyx/src/framework/rendering/object.ts), [viewport](Nelyx/src/framework/rendering/viewport.ts), [hit-test](Nelyx/src/framework/gestures/hit-test.ts), [root](Nelyx/src/framework/widgets/root.ts) | B의 변경 생산·지원 경로·event revision·기존 dispatch 연결 |
| [hosting/input-geometry.ts](Nelyx/src/hosting/input-geometry.ts), [services](Nelyx/src/hosting/services.ts), [SDK bootstrap](Nelyx/sdk/src/runtime/bootstrap.ts) | 선택적 지속 geometry 서비스와 view별 session 수명. 현재 snapshot 서비스와 capability 구분 |
| [input_geometry.cpp](Nelyx/skia/native/core/input_geometry.cpp), [input_geometry.h](Nelyx/skia/native/core/nelyx_skia/input_geometry.h), [semantics_geometry.cpp](Nelyx/skia/native/core/semantics_geometry.cpp) | 순수 숫자 session·검증·query·rollback. 공통 상태를 중복 tree mirror 없이 공유 |
| [JsiInputGeometry.h](Nelyx/skia/native/adapters/jsi/cpp/api/JsiInputGeometry.h), [native adapter](Nelyx/skia/packages/native/src/input-geometry.ts) | 얇은 batch 경계와 native 소유 복사, capability·owner·revision 확인 |
| [semantics-transport](Nelyx/src/framework/rendering/semantics-transport.ts), [semantics.ts](Nelyx/src/framework/semantics/semantics.ts) | C의 검증된 payload 재사용·새 action/geometry envelope·구조 변경 검증 |
| [painting/context](Nelyx/src/framework/painting/context.ts), [Scene](Nelyx/src/ui/scene.ts), [JsiDisplayList](Nelyx/skia/native/adapters/jsi/cpp/api/JsiDisplayList.h) | D에 진입할 때 기존 recording/handle 연결을 확장 |

새 protocol version·구체 타입·파일 분리는 구현 착수 시 확정한다. canonical native source만 수정하고 generated 사본은 기존 준비 도구로 공급한다. 공통 kernel에는 WinUI·RN·JSI·OS 타입을 넣지 않는다.

### 8.2 정확성과 메모리

- TS Number와 같은 `double`을 사용하고 행렬 순서·좌표 단위·clip·perspective·singular·유한성·signed zero의 기존 의미를 보존한다. `fast-math`나 float 축소를 성능 수단으로 삼지 않는다.
- count/length/offset/ID/parent/depth/overflow를 allocation·cast 전에 검증하고 transaction을 원자 적용한다. malformed·stale/foreign owner는 오류로 구분한다. 지원하지 않는 경로의 TS fallback으로 protocol 오류를 숨기지 않는다.
- native는 JS ArrayBuffer 포인터·`jsi::Object/Function/Runtime&`를 호출 뒤 보유하지 않는다. 현재 검증된 소유 복사를 유지하고 데이터 생성 빈도와 양을 줄인다. user hook을 실행한 뒤 실패하면 같은 hook을 재호출해 fallback하지 않는다.
- 지속 geometry의 초기 설계 상한은 **view별 4MiB 합계 / 8,192 nodes / depth 128** 안으로 잡는다. committed·staging·입출력 복사·scratch·capacity를 합산하며, input/semantics가 별도 4MiB mirror를 각각 추가하지 않는다. hit metadata를 포함해 부족하면 지원 범위와 표현을 줄이고 기존 경로를 사용한다. 기존 snapshot별 더 작은 상한도 유지한다.
- 새 snapshot의 임시 수명은 기존 frame 소유권 안에서 제한한다. 변경 도중 예외·재진입·frame 실패는 discard하며 과거 snapshot·다음 dirty를 보존한다. handle 재사용은 generation으로 격리한다.
- Picture **64 / 32MiB**, optional child **16 / Element 2,048**, Gallery capacity **2**, CPU pending **1**, native recording **2**, mailbox **256** 등 기존 예산을 늘리지 않는다. detach/reparent/dispose·view close·context/surface 교체 때 metadata를 철회·재구축하고 close 뒤 session/handle 보유 0을 확인한다.

## 9. 실행 순서와 중단 기준

모든 후보를 한 번에 구현하지 않는다. **W5-0 → A의 작은 수정 또는 비진입 → B 단독 실험 → 필요한 C → 필요한 D → 최종 판정** 순서다.

| 단계 | 할 일 | 다음 단계에 갈 근거 |
| --- | --- | --- |
| W5-0 기준 확정 | 현재 dirty state와 work4 최종 공급 대조. 일반 명령의 Gallery 좌/우·mixed·ListView에서 warm/새 생성·hover/focus 구분 | 동일한 실제 제품 기준과 반복 비용의 귀속 확보. 유효한 기존 기준은 조건이 같을 때만 재사용 |
| W5-1 공통 작업 조사 | A의 build/dependency/keep-alive 작업량 확인. 유의한 중복만 한 개씩 수정 | 원래 hook·알림·수명 보존, 전체 경로의 순이득 또는 비진입 이유 |
| W5-2 변경 생산 | B의 표준 경로에 geometry revision·변경 기록을 연결하고 TS 기준 결과로 검증 | 전체 tree 재수집 없이 변화가 기록됨. custom fallback의 이유·비중 확인 |
| W5-3 C++ 단독 비교 | 같은 변경 기록으로 TS 처리와 C++ session을 각각 선택해 비교. C/D는 끔 | 준비→복사/검증→query→결과 반영의 총비용·일반 제품 이득과 지원률 확보 |
| W5-4 semantics | C를 별도 후보로 구현·비교 | payload/geometry/action 수명 분리와 실제 snapshot 비용 감소. B의 성과와 분리 |
| W5-5 recording | D의 진입 근거가 있을 때만 구현·비교 | 반복 명령·scene 생성이 실제로 줄고 총비용 감소 |
| W5-6 채택·종료 | 채택 조합 재공급·회귀·일반 실행 확인, 임시 연결 정리 | 후보별 구현/실행률/채택/제품 수락을 별도로 기록 |

W5-2의 지원 판정에 전체 트리 순회가 남거나 W5-3의 packing·결과 복원이 이득을 상쇄하면 기본 연결을 채택하지 않는다. 대표 화면이 대부분 fallback이면 “C++ 개선 완료”로 종료하지 않는다. 정확성·입력·메모리 회귀가 있으면 해당 후보를 먼저 철회한다. 좋은 TS 개선만 남기는 결과도 허용한다.

Flex 수치 커널·sliver extent/prefix 검색의 native 이관은 별도 프로파일에서 해당 순수 수치 루프가 지배적일 때만 후순위로 검토한다. C++ 구현 지점을 늘리는 것을 목표로 삼지 않는다. 동기 사용자 layout callback을 자식마다 왕복해야 하는 경계는 먼저 피한다.

## 10. 검증·판정 방법

### 10.1 무엇을 줄였는지 확인

기존 [FrameDiagnostics](Nelyx/src/ui/frame-diagnostics.ts)와 [RNW probe](Nelyx/eng/tests/rnw-frame-probe.js)에 opt-in 계측을 필요한 만큼만 추가한다. frame/callback·input sequence·QPC·제품 identity로 연결한다.

- A: build/reconcile/알림 수·attach/detach·bucket 이동·임시 저장소 생성 수.
- B: live/dirty node 수·TS 경로 방문·native 질의·JSI 횟수·전송 bytes·결과 target 수·fallback 이유·동일 revision 재사용·보유/peak bytes.
- C: flush 실행 frame 수와 전체 frame 수, 재사용 payload·새 envelope·검증/flatten 방문·출력 node 수·action 철회.
- D: 새 paint 명령·재사용 recording·변경 segment/transform·남은 source lookup·packet bytes.

작업량 감소는 메커니즘의 근거다. GC pause를 실제 관측하지 못하면 객체 감소를 GC 정지 감소로 표현하지 않는다. native query만 빠른 결과와 실제 callback·surface 갱신의 이득을 구분한다. 진단에 쓰는 이중 경로는 소수의 정확성 비교에만 사용하고 성능 측정에서는 끈다.

### 10.2 정확성·실제 사용

1. **공통 회귀:** 의존성 알림 중 mutation/재등록/aspect, isolated build 재진입·다른 owner, keep-alive·GlobalKey 이동·dispose를 검사한다.
2. **좌표 differential:** TS 기준과 표준 hit 경로의 target 순서·transform·clip·경계값을 비교한다. nested scroll·overflow·DPI·resize·singular/perspective·custom hook·탐색 중 mutation·old snapshot을 포함한다.
3. **event barrier:** 같은 mailbox 안에서 첫 callback이 geometry를 바꾼 뒤 다음 packet이 올바른 대상을 찾는지 확인한다. post-frame enter/exit/cursor와 기존 down-stream 소유권을 유지한다.
4. **geometry/semantics:** frame seal 실패·commit/discard·GPU busy·0-size forced query·화면 밖 editor 철회/복귀·text/selection/action generation·이전 snapshot 불변을 확인한다.
5. **일반 제품:** 평소 명령으로 최대화 Gallery 두 열과 mixed 전체 범위를 왕복한다. hover·focus·빠른 반전·재접촉·재클릭 없는 입력·한글 조합/undo·기존 그림자·정상 close/drain을 확인한다. 자동 OS 입력과 물리 입력 확인의 범위를 구분한다.

기존 검사군을 변경 범위에 맞게 선택한다. 예시는 현재 존재하는 명령이며 **이번 문서 작성에서 실행하지 않았다.**

```powershell
# 의존성·build·sliver 변경
npm.cmd run test:inherited-lookup
npm.cmd run test:scroll-engine

# native geometry·입력 탐색 변경
npm.cmd run test:input-geometry
npm.cmd run test:windows-animation
npm.cmd run test:windows-mixed-input

# semantics 또는 recording 변경 때 추가
npm.cmd run test:accessibility
npm.cmd run test:paint-recording
npm.cmd run test:native-paint-replay

# 최종 일반 실행과 bytecode 제품의 cadence 비교
npm.cmd run run:windows --workspace @nelyx/testbed-2
node Nelyx/eng/run-rnw-cadence.mjs --trials=3 --scene=gallery
```

일반 앱 확인을 종료한 다음 cadence를 직렬 실행한다. 현재 cadence 도구는 optimized/Release **Hermes bytecode** 제품을 요구한다. Static Hermes 결과와 섞지 않고, 공통/native 경계 변경에 필요한 static-aot type/build·runtime 회귀는 별도로 선택한다. 새 C++ session 검사는 구현과 함께 실제 harness·명령을 등록한다.

### 10.3 성능과 공급

- 같은 source/native/SDK/App 입력·빌드 모드·창 크기/DPI·장면·입력 시간의 **기준/후보 3쌍**을 기본으로 한다. 타당한 현재 기준을 재사용할 때 일치 근거를 적는다. source probe·상세 로그·GDI capture·다른 빌드/테스트는 일반 cadence 실행에서 끈다.
- 평균 surface FPS와 실제 움직이는 구간의 갱신 공백·입력 응답을 함께 본다. 끝점 대기·cold 생성·관측 누락을 분리하고 실패나 느린 구간을 성능 표본에서 임의 제외하지 않는다. 표본 부족은 미측정으로 남긴다.
- 채택에는 정확성·수명 통과와 전체 경로의 반복 가능한 순이득이 필요하다. 차이가 실행 변동과 비슷하면 확인된 성능 개선으로 쓰지 않는다. 지속 60 surface FPS 미달이면 개선 후보를 채택해도 제품은 `PARTIAL`이다. pixel 생존 검사·native surface counter는 물리 표시/scanout 수락과 구분한다.
- native 변경은 canonical→generated→현재 dist/archive→runner 설치본→실행 package까지 입력·파일 identity를 확인한다. Windows 먼저 단독 평가하고, 채택 공통 변경의 Web TS fallback·Android 최신 공급 회귀를 수행한다. Apple/Linux는 소스·빌드 확인과 실제 runtime 미검증을 구분한다.
- 테스트 timeout은 **1,200,000ms(20분)**, 대부분 반복 검증은 **30회 이내**다. 기존 유효 검사 통과 뒤 이유 없이 반복하지 않는다.
- 임시 fixture·진단 App·staging·소유 프로세스는 성공/실패/중단 시 `finally`에서 정리한다. 현재 dist만 남기고 package/SDK 사본·로그·receipt·checkpoint/history JSON을 누적하지 않는다. `Nelyx/docs/plans/`, `Nelyx/docs/migrations/`를 생성하지 않으며 진행·잔여 내용은 이 문서에 짧게 갱신한다. 기존 미커밋 변경과 work4의 삭제 차단 항목을 임의로 정리하지 않는다.

## 11. 설계 시점의 상태

| 항목 | 상태 |
| --- | --- |
| Doroti 힌트와 Nelyx 코드·work3/work4 대조 | 완료 |
| 공통 엔진 후보 A 및 C++ 후보 B/C/D 설계 | 완료 |
| 코드 구현·native 기본 연결 변경 | 미실행 |
| 제품 공급·성능 비교·물리 입력 확인 | 미실행 |
| 기존 제품 성능/resize 수락 | 변경 없음: `PARTIAL / false / false` |

구현을 시작할 때는 **W5-0에서 현재 제품을 확인하고, A의 중복 여부를 짧게 판정한 뒤 B의 변경 생산과 event별 revision 계약부터 구현**한다. 첫 C++ 목표는 표준 경로에서 **같은 트리·좌표를 여러 번 준비하는 비용의 감소**다. 예상 FPS나 일괄 C++ 이관의 개선율은 아직 제시하지 않는다.

## 12. 실행·후보 판정 — 2026-11-03 KST

이 절은 위 설계 작성 뒤 실제 수행한 작업이다. §2·§11의 작성 당시 `미실행`과 구분한다. 기존 work4 변경은 보존했다. 아래 비진입·철회는 성능 개선 구현이나 제품 수락으로 계산하지 않는다.

### 12.1 현재 제품 기준

평소 명령 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 실행하고 최대화 Gallery의 실제 왼쪽 열 이동과 Alt+F4 정상 종료(`exit 0`)를 확인했다. 현재 manifest·EXE·bytecode·native·SDK가 work4 §9.4와 일치한다. 이어 **다른 build/test 없이** `node Nelyx/eng/run-rnw-cadence.mjs --trials=3 --scene=all`을 직렬 실행했다. 모두 optimized/Release **Hermes bytecode**, 2560×1459 physical / DPI 192, fresh owner·정상 종료다. source probe·GDI capture·상세 native 진단은 껐다.

| 기준 trial | Gallery 좌 두 방향 surface FPS | Gallery 우 두 방향 surface FPS | mixed 두 방향 surface FPS |
| --- | --- | --- | --- |
| 1 | 52.792 / 52.405 | 52.818 / 51.985 | 45.934 / 45.438 |
| 2 | 54.080 / 53.562 | 52.096 / 51.933 | 49.530 / 49.504 |
| 3 | 52.365 / 52.863 | 54.791 / 54.587 | 49.038 / 47.204 |
| 6 legs 평균 | **53.010987** | **53.034952** | **47.774444** |

이는 packet-defined 반전 구간의 native surface counter다. 끝점까지 전체 이동·물리 트랙패드·scanout의 수락이 아니며, cadence-only의 pixel gap `0`은 관측 없음이다. work4의 다른 실행 평균과 차이를 이번 수정의 개선율로 쓰지 않는다.

### 12.2 A의 실제 작업량 — 추가 엔진 수정 비진입

같은 native `3283d2…` / SDK `a203a8…`의 진단 bytecode를 재사용해 ListView를 최대화하고 OS wheel 두 방향을 실행했다. pixel gap 최대 **188.058 / 211.520ms**, native submitted/producer/surface/retired **503씩**, superseded/failed 0, bindings close·JS ack·native drain·exit 0이다. 일반 제품 FPS 검사는 아니다.

기존 `RnwWorkProbe`로 cold 생성이 포함된 retained window에서 mount **3,729**, reconcile **5,894**, rebuild **5,765**, dependency lookup/register/remove **6,698/5,883/1,386**, notify **152**를 관측했다. notification inclusive wall은 합계 **1.399ms**였다. 이후 9개의 **서로 다른 callback 표본 중 5개**에는 이 build/dependency/sliver-create 범주의 호출이 없었다. 새 행이 필요한 표본에는 sliver-create가 각 1회 있었다.

이 window들은 Gallery→ListView 전환·resize·cold/warm이 섞이며 서로 겹친다. 전부를 warm 평균·전체 frame 전수·독립 CPU 비용으로 쓰거나 카테고리를 합산하지 않는다. `retainedFrames`에는 진단의 source-only row도 있어 native 제출 수의 분모로 쓰지 않는다. 실제 attach/detach·Map 할당 전수나 GC pause를 새로 계측한 결과는 아니다.

현재 dependency `Map`/`Set`, owner의 intrusive dirty scope·depth queue와 표준 keep-alive bucket의 연결 유지가 이미 있는 것을 소스·기존 수명 회귀와 대조했다. **알림 snapshot·재등록/aspect 준비의 유의한 중복은 확인하지 못했다.** 외부에서 수정 가능한 `dependents` Map을 revision만으로 신뢰하거나 live 순회로 바꾸지 않고 W5-1을 비진입으로 종료한다. 추가 큐·native Element 저장소·callback 범위 생략도 도입하지 않는다.

### 12.3 B 지원 계약·event barrier

`RenderBox.hitTest`는 각 방문에서 현재 size·children·child transform·hit hook을 읽는다. 공개 prototype/instance getter·`onPointer`를 setter 밖에서 바꾸면 같은 parent/size/숫자 snapshot에도 결과나 호출 순서가 달라진다. attach/layout/scroll setter에서만 만든 revision은 이 변경을 검출하지 못한다. 이를 보완하려고 매 질의 전체 트리의 descriptor를 다시 검사하면 §5.3·§9의 진입 조건을 위반한다.

새 회귀는 **이미 질의한 객체의 prototype 교체→size getter 추가→앞선 callback에서 hit 동작 변경**을 확인한다. 실제 `ViewRuntime` mailbox에 wheel 두 개를 넣은 별도 회귀는 첫 callback이 상단 box를 이동한 뒤, **다음 frame을 만들기 전에** 두 번째 packet이 하단 box를 고르고 이전 경로는 유지됨을 확인한다. 기존 post-frame tracking·custom transform·snapshot 회귀도 유지한다.

따라서 **W5-2는 지원 계약 gate에서 비진입, W5-3 native session·JSI protocol은 미구현/미측정**이다. native 지원률이나 절감량을 주장하지 않는다. TS 방문/hook을 유지하는 축소안은 기존 work4의 owned transform/inverse·box translation·불변 child snapshot 재사용과 중복돼 새 후보로 계산하지 않았다. 새 session·DLL·Wasm·기본 capability는 추가하지 않았다.

### 12.4 C의 독립 TS prototype — 철회

frame geometry·action·children과 문자열/상태 payload를 분리하는 **실행 가능한 TS prototype**을 구현·빌드했다. view별 WeakMap에 검증한 scalar payload와 빈 attributes/tags 배열만 두고, 새 envelope의 bounds·actions·편집기 fence·전체 ID/cycle/count/depth는 계속 검증했다. nonempty 외부 attributes/tags·numeric range는 기존 validator로 보냈다. 초안의 관련 source 회귀는 **97/97 PASS**였다.

다만 현재 transport가 새 host 필드를 만든 뒤 동일 payload를 확인하는 구조여서, 문자열/상태 준비 자체를 생산 지점에서 없앤 구현은 아니다. 준비·동일성 검사·envelope·freeze·flatten **전체**를 포함한 256-node Node fixture에서 비용을 비교했다. 버전별 각 mode는 3회 준비 후 12회 측정, 아래 각 행은 독립 cache의 한 쌍이다. node 수는 데이터 크기이며 같은 검사를 수백 번 반복한 것이 아니다.

| prototype | pair | 기준 평균 ms | 후보 평균 ms |
| --- | --- | --- | --- |
| generic keys/own-property 비교 | 1 | 0.792 | 0.564 |
| 동일 | 2 | 0.274 | 0.667 |
| 동일 | 3 | 0.330 | 0.668 |
| 직접 scalar 비교로 축소 | 1 | 0.767 | 0.477 |
| 동일 | 2 | 0.283 | 0.583 |
| 동일 | 3 | 0.335 | 0.940 |

각 후보 실행에서 payload **256개 생성 / 3,584회 재사용**을 확인했지만 순이득은 반복되지 않았다. 첫 pair의 기준에 약 5.8ms, 마지막 후보에 약 6.1ms 최대값이 있었으며 이를 제외해 유리한 평균을 만들지 않았다. GC pause는 귀속하지 않았다. 이 결과는 **Node fixture의 부정적 선별 결과**이며 Hermes의 성능 결과나 모든 C 설계의 불가능성을 뜻하지 않는다.

§9·§10.3의 선별 규칙에 따라 두 prototype의 제품 클래스·validator 우회·진단 stage·임시 테스트를 모두 철회하고 원래 source와 dist로 복구했다. 후보를 Windows/Android/Web에 공급하지 않았고 3쌍 일반 제품 개선으로 세지 않는다. 이후 C를 재검토하려면 필드 구성 **전**에 framework 소유 변경 토큰으로 payload를 생산하면서 공개 mutable metadata·hook을 보존하는 다른 설계가 필요하다.

### 12.5 전체 장면 진단의 한계

별도 `legacy --cycle --ranges --trials=1` source 진단은 Gallery 좌/우와 mixed를 왕복했다. Gallery의 첫 lazy extent는 변했으므로 cold로 분리했고, 안정 후 좌 **0↔2236.572px**, 우 **0↔1390.5px**, mixed **0↔2102.668px** 끝점을 관측했다. mixed의 12 fields/36 buttons와 한글 commit/undo는 기존 3초 value deadline 안에서 통과했으나 per-key receipt 최대 **478.544ms**로 350ms 안의 응답은 통과하지 못했다.

이 실행은 native outcomes **5,363씩**, failed 0·정상 close를 관측했지만 **바깥 실행 명령이 nonzero로 종료**했다. 최종 stdout이 잘려 전체 종료 실패의 원인을 이 기록만으로 확정하지 않는다. 따라서 전체 진단 성공이나 제품 성능 통과로 세지 않는다. 위 ListView 단독 실행은 별도로 끝까지 출력·정상 drain/exit를 확인한 성공이다. 재측정으로 첫 실패를 지우지 않는다.

W5-5 recording은 §7의 조건부 단계다. B의 지속 상태 경계가 채택되지 않았고 C의 준비 비용도 줄지 않았으며, production point에서 기존 Picture/custom paint 의미를 보존하는 별도 변경 근거를 확보하지 못해 **비진입**으로 남긴다. paint/capture/submit·persistent callback·GPU fence/예산은 바꾸지 않았다.

### 12.6 남긴 변경과 종료 확인

- `hit-transforms.test.mjs`: setter 밖의 prototype/getter·callback 변경 계약 회귀 1개.
- `frame-backpressure.test.mjs`: 같은 mailbox의 각 packet 사이 geometry barrier 회귀 1개.
- `inherited-lookup.test.mjs`: 알림 도중 remove/re-register/add와 aspect·다음 알림 순서 회귀 1개. live Map 순회로 바꾸지 않았다.
- `run-rnw-motion-probe.mjs`: opt-in 진단의 장면별 출력에 기존 `retainedCallbackWork`를 포함한다. 새 product wrapper나 진단 clock은 추가하지 않는다.

철회 후 공통 source 회귀 **158/158 PASS**, 새 알림/mailbox 회귀까지 포함한 focused 검사 **58/58 PASS**다. 두 실행은 일부 검사가 겹치므로 합산하지 않는다. 모든 test timeout은 **1,200,000ms**다. 최종 전체 workspace types(Static AOT type check 포함), 변경 코드 4개의 lint/format·JS syntax·`git diff --check`도 PASS다. 새 Static AOT 제품 실행이나 native session harness를 실행했다는 뜻은 아니다.

평소 명령으로 **일반 App을 다시 빌드·실행**했다. 최대화 Gallery의 Elevated 클릭(`1 · Elevated pressed`), Text inputs 전환·전체 목록 복귀, 실제 오른쪽 열 스크롤을 화면에서 확인하고 Alt+F4·runner **exit 0**으로 종료했다. 이어 `NELYX_WINDOWS_MIXED_TRIALS=1,4`를 해당 검사 프로세스에만 설정해 `npm.cmd run test:windows-mixed-input` **1/1 PASS / 두 fresh owners**를 확인했다.

- owner 1: Gallery 두 열 warm→mixed 전체 범위·재클릭 없는 입력 3회→한글 commit/undo→Gallery 두 열 복귀. warm pixel gap 최대 **113.244ms**, 복귀 **97.728ms**다.
- owner 4: 버튼 focus/key 처리·첫/마지막 행 동작·OS key 입력·한글 commit/undo. 두 owner 모두 정상 drain·`forced=false`·exit 0이다.
- per-key receipt 최대 **145.174 / 139.864ms**. 물리 키보드/트랙패드와 scanout·60fps 수락은 이 검사에 포함하지 않는다. §12.5의 source 진단 지연과 nonzero 종료는 별도 실패로 남긴다.

Windows **9개 패키지**의 현재 source/dist 입력과 runner 설치 inputs를 다시 대조했고, 실행 package inventory·locator hash·pinned runtime을 검증했다. 일반 bytecode·native/SDK/App 입력은 §12.1 기준과 같다. native EXE는 이번 일반 재빌드의 실제 값이므로 이전 EXE와 같다고 쓰지 않는다. 추가 후보별 일반 cadence 비교나 성능 개선율은 산출하지 않았다.

| 최종 일반 공급 | SHA-256 |
| --- | --- |
| manifest | `4fc419e5f34d8077c90f7d6c4626a238d7c7d4722cacbc251716170053342b6f` |
| EXE | `43ac217527fb72612c26f3057c6a26685e540957db02713c53788fd8faeae5b2` |
| bytecode | `3fd15bab698902d8753ef3849683737b820a46e50907ab72db28b8e6dc0755d6` |
| native inputs | `3283d2f3281f64468c815e337995f77ebb2499d0b2a1c3ebc8f4ddf594b58d4b` |
| SDK inputs | `a203a8bd0b02f089aff1cad0e623162e653c79ca113a057090f6854d48847b92` |
| App inputs | `968cfd53522b2cf6fc6e01c43c70151ee4cd7a872d5103b237b08ac1b3b2b4e6` |

optimized/Release Hermes **bytecode**, package `qualification=notVerified`를 유지했다. 새 공통 product 변경이 채택되지 않아 Android/Web에 재공급하지 않았다. 기존 Android Core 차이·APK/Web runtime 및 Apple/Linux 미검증 경계도 그대로다.

| 단계 | 종료 판정 |
| --- | --- |
| W5-0 | 현재 공급·일반 기준 측정 완료. source 전체 장면 진단 1회 nonzero 종료는 미수락으로 보존 |
| W5-1 / A | 기존 공통 구조·실제 작업량 조사, 추가 중복의 근거 부족으로 비진입 |
| W5-2 / B | 공개 hook·setter 밖 변경의 지원 계약 미충족으로 gate 비진입 |
| W5-3 | 선행 gate 미충족으로 native session·독립 native 비교 미진입. 구현/지원률/성능 성과 없음 |
| W5-4 / C | 독립 TS prototype 두 개 선별 후 순이득 미확인으로 철회. 생산 지점의 다른 payload 설계는 미구현 |
| W5-5 / D | 조건부 recording 구조 변경 비진입 |
| W5-6 | 새 성능 후보 **NO_ADOPTION**, 일반 제품 복구·관련 회귀·실제 입력/종료 확인 완료 |

진단 App은 원문으로 복구했고 작업 소유 fixture·staging·Testbed 프로세스를 남기지 않았다. 검증 로그·receipt·checkpoint/history JSON·독립 설치본·browser profile을 새로 보관하지 않았다. 현재 dist/package와 기존 사용자 cache·emulator, work4의 삭제 차단된 구 공급 4개는 유지했다. 커밋은 만들지 않았다.

이번 결과는 **조건부 후보 평가의 종료**다. C++ 탐색이나 구조적 성능 개선 구현이 완료됐다는 뜻은 아니다. 제품 **`PARTIAL`**, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/표시 **notVerified**를 유지한다. 후속 개선은 현재 공개 hook 계약을 보존하는 지원 경계 또는 필드 구성 전의 변경 생산 설계가 먼저 필요하며, 이 문서의 설계 초안을 존재하는 API나 검증된 성능으로 설명하지 않는다.

## 13. 사용자 요청에 따른 retained C++ geometry 후속 구현

§12의 조건부 평가 종료 뒤 사용자가 해당 부분의 C++ 구현을 요청했다. 이번 변경은 **편집기 입력 좌표 준비**에 한정한다. 위젯/Element·동적 hit-test·callback dispatch·semantics publication을 C++로 옮겼다고 설명하지 않는다. 공개 getter/prototype의 setter 밖 변경 계약 때문에 전체 hit-test index는 여전히 미구현이다.

### 13.1 구현 경계

- Canonical `input_geometry.cpp`에 별도 `RetainedSession`과 v1 delta protocol을 추가했다. 숫자 parent/transform/clip만 유지하며 공유 조상의 world transform과 clip 투영을 캐시한다. JS 객체·callback·Runtime·GPU 자원은 저장하지 않는다.
- TS의 기존 warm/표준-hook 사전 검사와 visitor 순서를 유지한다. 실제 방문에서 weak identity를 숫자 handle에 연결하고 변경 노드·삭제 handle·편집기 질의를 한 prepare packet으로 보낸다. 초기 전체 숫자 표를 매 프레임 다시 encode하지 않는다. TS의 사전 검사와 방문 비용 자체가 제거된 것은 아니다.
- CPU geometry의 prepare/commit/discard에 native 상태 확정을 결합했다. 취소·이전 candidate·세대가 다른 handle·잘못된 graph를 차단한다. viewport/renderer/context/surface 교체, custom-hook fallback, 편집기 부재와 owner 종료는 숫자 상태를 닫는다.
- TS 지원 한도는 512 nodes/64 editors, native slot은 1024개(교체 전후 동시 수용), native selection 질의는 8192개다. 알려진 selection 한도 초과는 이미 캡처한 숫자로만 TS 계산하며 hook을 다시 호출하지 않는다. 기존 16384 total/4096 per-editor 한도는 유지한다. 잘못된 protocol/VM allocation/결과 decode 오류에는 TS 재실행하지 않고 실패·정리한다.
- Native graph·staging·VM/native packet/result 복사와 숫자 TS mirror 여유분을 합한 보수적 4 MiB admission을 둔다. 이는 VM allocator/RSS 측정값이 아니다. `stats()`는 live/pending nodes, native retained bytes, admission peak, committed revision, closed, pending revision, 마지막 upserts/world products/clip products를 제공하며 close 뒤 모두 0(closed=1)이다.
- RN `ApplicationSurface`의 명시적 `nativeInputGeometry="retained"`가 새 경로를 선택한다. `'snapshot'`은 기존 독립 후보이고 생략/false는 기존 TS 경로다. owner 생성 시 선택하며 변경 시 remount한다. 아직 기본 채택하지 않았다.

### 13.2 초기 확인 — 최종 결과는 §14

- 초기 실제 C++ 회귀 4/4: TS 결과 일치·공유 조상/clip·0-delta 재사용·discard 후 같은 revision 재시도·reparent/remove/handle 세대·cycle/nonfinite/stale 거부·close 뒤 0 metadata, 실제 framework 편집기 3개·스크롤·CPU commit/discard·custom hook fallback, 알려진 selection budget fallback·오류 정리·viewport 교체·node budget, 재진입으로 먼저 commit된 새 session을 이전 prepare 실패가 닫지 않는 경계.
- 추가 검사에서 **첫 commit 전 viewport 교체**의 native owner 정리가 빠진 것을 잡아, native session 생성 시 cohort를 기록하도록 수정한 뒤 3/3 재통과했다.
- 기존 snapshot C++/framework 회귀 2/2(숫자 differential 30 cases 포함), 관련 backpressure/native-engine/hit/진단 회귀 82/82, workspace 전체 타입 검사 통과. 후속 소스 수정 뒤 필요한 최종 확인은 별도 기록한다.
- Windows canonical C++/JSI를 prepare → native supplier rebuild로 빌드했다. 9개 workspace source/dist와 실제 runner 설치 package identity 일치를 확인했다. 활성화 보완 뒤 최종 공급·일반 명령·비교 결과는 §14에 기록한다.
- 보완 전 동일 조건(2560×1459 physical, DPI 192, optimized Release Hermes bytecode) fresh owner 3회 일반 기준: Mixed **49.475259**, Gallery 좌 **59.784250**, 우 **59.842143 surface FPS**. 각 6개 방향 표본이며 Mixed trial 평균 범위는 47.616556–52.909589다. 첫 시도는 출력 처리 한도로 일부 표본을 잃어 비교에서 제외했고, 완전한 재측정 3회만 사용했다. 최종 같은 SDK 비교에는 §14의 새 TS 3회를 사용한다.

이 초기 확인은 전체 프레임 개선·물리 입력/표시·제품 성능 수락이 아니다. `PARTIAL`, `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다.

### 13.3 이전 선택 모드 측정 — 실제 C++ 미실행으로 비교 제외

계측용 source hook 없이 `ApplicationSurface`의 `nativeInputGeometry="retained"`만 임시 지정해 빌드했다. App 원문은 RAM에 보관했다가 finally에서 복구했다. 후속 source 진단에서 실제 Testbed의 표준 Material/Overlay/Offstage hook이 지원 검사에 걸려 **편집기 C++ 호출은 0이고 TS fallback으로 동작**한 것을 확인했다. 아래 수치는 옵션을 지정한 패키지의 관찰값으로만 보존하며, **C++ 성능 평가에서 모두 제외**한다.

| 장면 | 이전 TS 3회 | 옵션 지정·TS fallback 3회 | 관찰 차이 |
| --- | ---: | ---: | ---: |
| Mixed | 49.475259 | 49.820393 | +0.70% |
| Gallery 좌 | 59.784250 | 58.122687 | -2.78% |
| Gallery 우 | 59.842143 | 58.853786 | -1.65% |

이 값을 실제 C++ 비교로 해석했던 앞선 판정은 검증 오류로 철회한다. Source 진단은 `Selected native candidate did not execute its required work: input-geometry-jsi,input-geometry-retained-nodes`로 nonzero 종료했고 이는 정상적인 검증 실패다. 이 공급본으로 통과했던 실제 입력/IME/종료 검사는 **TS fallback 상태의 동작 확인**이며 C++ 경로의 제품 증거로 쓰지 않는다. 반면 실제 C++ kernel differential/3-editor framework 검사와 설치된 JSI의 직접 transaction/reentry 검사는 해당 좁은 범위에서 유효하다. CadenceOnly의 `maximumGapMs=0`/`changesDuringInput=0`도 desktop sampling 비활성의 기본값이므로 정지 없음의 증거가 아니다.

| C++ 선택 앱 비교 공급 | SHA-256 |
| --- | --- |
| manifest | `3eca63c642b3935fe7543dd62689707182a8d71df31e1b6d167c6f90d1c1f95d` |
| EXE | `26c12e820852a64f33d5161a34da95269d5ff68c39e8538efcde594536551148` |
| bytecode | `377509ea36938f64f762b20815d4c04c6e7c59e625b1cfda4e4c264f12230db5` |
| native inputs | `d50c394b3e1f9b03aff4495417f01c071ccc7b837c5ac58003a99f786ae15785` |
| SDK inputs | `a1e9d3984299a10f8576c6ef20468588a735388d21a76f9026c6588a86159146` |
| App inputs | `9173066fbc08c5e6873ff7ebc7f04ea4c583f7262b9d31d53b9cac7e494c4f3c` |

9개 source/dist와 runner 설치본 내용 hash 및 전달 package/runtime을 검증했다. 위 App inputs는 옵션을 지정한 **비교 빌드**의 식별이며 복구한 App 원문의 현재 식별이라고 설명하지 않는다. Package qualification은 `notVerified`다.

## 14. C++ 활성화 오판 재발 방지 (사용자 추가 요청)

### 14.1 이번 누락과 기존 native 범위 구분

Skia/Graphite 렌더링·GPU 제출·native display-list replay·native 문단/경로 서비스는 기존 native backend다. 이것들이 TS로 실행되고 있었다는 뜻이 아니다. `native-engine.ts`의 `nativeDisplayLists: true`와 replay capability 검사, 실제 native renderer 회귀는 유지한다.

기존 snapshot input geometry·scene composition·semantics geometry·path/paint batch 성능 후보는 이전 미채택 판정에 따라 기본적으로 꺼져 있었다. 새 retained geometry는 **옵션과 API가 있었지만 실제 Testbed에서는 TS fallback이었다.** 앞선 일반 선택 모드 FPS/IME 결과를 C++ 경로의 효과·제품 검증으로 해석한 오류는 §13.3에서 명시적으로 철회했다.

후속 재감사에서 **이전 snapshot input geometry의 대표 화면도 TS fallback**이었음을 당시 원문까지 대조했다. 따라서 “이전 후보들은 native 실행 증거가 있다”는 포괄적 설명으로 이 실험의 일반 FPS까지 C++ 실행을 보증하지 않는다. 후보별 증거와 한계는 §15를 따른다.

### 14.2 구현한 차단 장치

1. **실제 경로 회귀**: 실제 `ComponentsGallery`를 띄우고 `show-mixed-scroll`을 누르는 Gallery → Mixed 경로를 사용한다. 별도 축약 editor fixture만으로 통과하지 않는다. 12개 편집기, 실제 compiled C++ transport, scroll/clip/epoch 일치와 custom clip getter의 원래 호출 수를 검사한다. C++ 호출 0회면 실패한다.
2. **지원 경계 보완**: Overlay theater, Offstage, Proxy/Shifted child, 표준 sliver padding, Material input decorator와 기본 clip approximation의 정확한 구현 identity를 등록했다. 공개 getter/프로토타입 교체는 계속 fallback한다. 사용자 clip approximation은 미리 실행하지 않고 원래 TS 순서/횟수를 유지한다. 새 input 등록으로 별도 semantics 후보를 확대하지 않았다.
3. **명시적 capability 요구**: input geometry/snapshot·scene composition·semantics geometry를 요청했는데 해당 native capability가 없으면 runtime 시작 단계에서 오류를 내고 unused context도 정상 정리한다. Retained 모드는 실행 보고 capability도 요구한다.
4. **선택과 실행 분리**: native engine의 선택 모드(`request`), SDK의 실제 native commit/TS fallback 및 사유(`execution`), C++ JSI의 독립 prepare/commit/editor-query/close 숫자를 별도로 보고한다. API 존재·옵션 지정·직접 API smoke만으로 실제 경로 실행을 수락하지 않는다.
5. **성능 측정 실패 조건**: `run-rnw-cadence.mjs --input-geometry=retained`의 Mixed는 native editor query > 0, SDK/native commit 수 일치, 모든 native session close·0 retained bytes, warm native 처리율 **95% 이상**이 모두 필요하다. Gallery의 편집기 수요 0은 별도로 표시한다. TS 비교에서는 다른 C++ 후보 요청/실행을 거부한다. 요청 모드 보고가 없거나, 이름 모를 추가 후보가 있거나, 관찰이 잘리면 실패한다.
6. **입력 검증도 모드 고정**: `NELYX_WINDOWS_MIXED_INPUT_GEOMETRY=retained`에서 실제 C++ 실행·집계 일치를 요구한다. Cold text edit의 TS 경로는 허용하고 비율/사유를 공개한다. warm cadence의 95% gate와 혼동하지 않는다.
7. **오판 회귀**: mode/API만 있음, 전부 fallback, 실제 editor query 0, native/SDK 불일치, 미해제, 과도한 fallback, 잘린 보고, 다른 후보가 켜진 TS 비교가 모두 실패하는 검사와 stdout/stderr chunk·64 KiB 진단 tail 이후에도 활성화 기록을 보존하는 검사를 추가했다.
8. **향후 작업 지침**: `.github/copilot-instructions.md`에 실제 장면/native 집계·fallback 확인, capability 누락 실패, 두 geometry 회귀 명령과 모드별 cadence gate를 추가했다. 편집기 수요가 없는 `--scene=gallery --input-geometry=retained` 단독 명령도 시작 전에 exit 1로 거부하며 실제 명령으로 확인했다. Gallery control은 `--scene=all`에서 Mixed와 함께 측정한다.

검증은 20분 timeout을 사용하며 보고는 bounded RAM과 현재 문서에만 남긴다. 새 영구 log/receipt/history JSON은 만들지 않는다. 실제 Windows 첫 확인에서도 요청 모드 보고가 stderr에 없자 새 gate가 `Native engine has no unique requested-mode report`로 막았고 FPS를 출력하지 않았다. GUI host의 OutputDebugString 전용 출력을 기존 native diagnostics와 같은 inherited stderr HANDLE 출력으로 고쳤다. 이 실패 표본 역시 C++ 성능 비교에 포함하지 않는다.

최종 새 회귀 **7/7**, 관련 native-engine/input/probe **30/30**, backpressure/hit/editor-scroll **57/57**, `test:windows-animation` **32/32**, workspace 전체 타입 검사와 수정 TS/JS lint·format, PowerShell parser·`git diff --check`가 통과했다. 묶음 간 중복을 합산하지 않는다. 기존 snapshot C++/framework 2/2의 초기 결과와 최종 실제 Windows 경로 검증도 구분한다. 모든 test timeout은 **1,200,000ms**다.

### 14.3 실제 Windows C++ 활성화와 입력·수명

최신 native/SDK의 일반 opt-in bytecode package로 `node Nelyx/eng/run-rnw-cadence.mjs --trials=3 --scene=all --input-geometry=retained`를 실행했다. Source probe·상세 stage instrumentation·GDI capture 없이 고정 packet 반전 구간을 사용했다. Mixed의 실제 집계는 다음과 같다.

| Mixed trial | C++ committed frames | C++ editor queries | TS fallback | native 처리율 |
| --- | ---: | ---: | --- | ---: |
| 1 | 964 | 11,568 | cold-provider 1회 | 99.8964% |
| 2 | 1,017 | 12,204 | cold-provider 1회 | 99.9018% |
| 3 | 949 | 11,388 | cold-provider 1회 | 99.8947% |

총 **2,930 native commits / 35,160 editor queries / 3 cold fallbacks**다. 이는 편집기 좌표 질의이며 키 입력 횟수가 아니다. 각 owner의 SDK/native commit 수가 일치하고 모든 native session의 정상 close·retained bytes 0을 검증했다. API 존재나 TS 자체 counter로 대체한 값이 아니다. 별도 preflight의 976 commits/11,712 queries는 활성화 확인에만 사용하고 정식 3회 평균에 합산하지 않았다.

Gallery 3 owners는 retained를 요청했지만 편집기 수요가 없어 native commits/queries와 fallback 모두 **0**, coverage **null**이다. 정상적인 무수요 control이며 C++ 계산 성능 표본으로 세지 않는다.

같은 C++ package에서 `NELYX_WINDOWS_MIXED_TRIALS=1,4`, `NELYX_WINDOWS_MIXED_INPUT_GEOMETRY=retained`를 해당 검사 프로세스에만 설정한 `npm.cmd run test:windows-mixed-input`은 **1/1 PASS / 두 fresh owners**다. 두 owner 모두 실제 C++ 실행 gate를 통과했고 OS key·한글 IME commit/undo·Gallery 복귀·입력 owner 수명·정상 종료를 확인했다. Per-key Core acknowledgement 최대는 **145.437 / 149.140ms**, Gallery 복귀의 네 pixel-gap 최대는 **53.493 / 98.898 / 55.441 / 96.959ms**다. 이 상세 입력/desktop 검사를 일반 cadence FPS에 섞지 않았다. 두 owner 모두 `forced=false`, exit 0, native drain은 views=0/consumers=0/gpuDrained=1/inputRetired=1이다. 물리 키보드·트랙패드·scanout 수락은 포함하지 않는다.

### 14.4 같은 SDK의 최종 비교·기본값·공급

진단 App/opt-in prop을 원문으로 복구한 뒤 기본 prepared locator도 최신 native **`85d80a…`**로 맞췄다. 이전 locator `3283d2…`를 사용한 첫 일반 명령은 `Compiled native source inventory incomplete`로 앱 시작 전에 실패했다. 현재 supplier를 표준 CLI `prepare`로 공급해 바로잡았다. 뒤의 일반 빌드 1회는 동시에 실행한 animation 검사의 임시 runner entry를 감지해 `Windows application inputs changed during the build`로 중단됐다. Animation 검사와 finally 정리가 끝난 다음 일반 명령을 직렬 재실행했다. 두 실패를 정상 실행이나 성능 표본으로 세지 않는다.

최종 `npm.cmd run run:windows --workspace @nelyx/testbed-2`는 현재 App을 빌드·실행했다. 선택 보고는 **inputGeometry=ts**, scene composition/semantics geometry/path-paint batch는 off다. 최대화 Gallery에서 Elevated 클릭(`1 · Elevated pressed`)과 오른쪽 열의 실제 화면 이동을 확인하고 Alt+F4·runner **exit 0**으로 닫았다. 이어 다른 build/test 없이 `node Nelyx/eng/run-rnw-cadence.mjs --trials=3 --scene=all --input-geometry=ts`를 직렬 실행했다. 모든 owner가 TS 선택·다른 후보 미실행 gate와 정상 종료를 통과했다.

두 mode는 **같은 native/SDK**, optimized/Release Hermes **bytecode**, 2560×1459 physical / DPI 192, 각 장면 3 fresh owners/6 방향 표본이다. App의 차이는 retained 실험 prop이다. 정식 비교는 다음과 같다.

| 장면 | TS surface FPS 평균 | retained 선택 surface FPS 평균 | 해석 |
| --- | ---: | ---: | --- |
| Mixed | **49.314698** | **40.292055** | 실제 C++ 실행 확인, 약 **18.30% 감소** |
| Gallery 좌 | 53.637186 | 55.277963 | editor 수요 0인 control, C++ kernel 효과로 귀속하지 않음 |
| Gallery 우 | 54.023238 | 55.253873 | 같은 무수요 control |

Mixed의 최소 편도 FPS도 TS **48.344662**, C++ **36.961801**로 느린 표본을 제외하지 않았다. 이 경로는 TS의 eligibility 검사·visitor·변경 생산 및 JSI packet/result 비용을 계속 포함한다. C++ 숫자 계산이 실행된 사실과 전체 경로의 순이득은 별도 조건이며, 전체 손실을 특정 함수/GC 원인으로 확정한 profile은 아니다. **구현은 명시적 실험 옵션으로 유지하되 기본 채택은 NO_ADOPTION**, 일반 앱 기본값은 **TS**로 유지한다. 이는 의도적인 기본값이며 실제 경로 연결 누락과 구분한다. §13.3의 all-fallback 수치나 §13.2의 이전 SDK 기준으로 개선율을 계산하지 않는다.

| 공급 identity (SHA-256) | C++ opt-in 측정 package | 최종 일반 TS package |
| --- | --- | --- |
| manifest | `7c3aa6b5e94a6ee3e46d78c5e7ad4317a827b65da8ce91a8aba4af954f34ed0f` | `3820e500e1efa2d7e56e2e71fad6bd0028ed87b0ce0027a36f8676b174045cce` |
| EXE | `fcc60cfd5f4eaf5944e15ec98b53b112f37ff536178865cb9795fc139939bb00` | `9b11f96d45dec6494f71f258803f8b60383ab8aaa7790cacb7dcd51ea0a4e0d2` |
| bytecode | `76e1681997010b083d318c37080aef412f435b5ec487b9ffb97b9129c747d4d7` | `7062993851d20d0080bd34cc0cce3d5712ce6dfb296559191f3c1b55dd74fba7` |
| App inputs | `36379945028e7137ab157a962054d272074dc66eeb11571f36bcc07edb46c71a` | `7045cb03cca1464cf3f5ce6c1a63e106aed6f5ec5e0ff52800a8837b825d8cac` |

공통 native inputs는 **`85d80adeaaff04c251edeb6dceacc7c6ef8c8804fee6558aa09a9e14862a66ae`**, SDK inputs는 **`3adf8312f87a5eab765f864d63d4c6fb17d0518283d4c67e2d97712bcf64a380`**다. 최종 9개 패키지의 source/dist·설치본 identity, 현재 App/SDK와 package manifest, supplier와 기본 prepared native **1,795 files**, 실행 package **1,794 files** 및 pinned runtime을 대조했다. 현재 package qualification은 **notVerified**다.

작업 소유 App fixture/animation entry/staging/Testbed 프로세스는 정리했고 현재 Release package·dist만 유지했다. 이전 측정 package를 별도로 복사·보관하지 않았고 로그·receipt/history JSON·독립 설치본도 누적하지 않았다. 기존 사용자 cache·emulator와 work4의 삭제 차단된 구 공급 4개는 건드리지 않았다. 커밋은 만들지 않았다. Windows runtime 검증이며 Android/Web의 새 제품 공급·실행과 Apple/Linux runtime까지 확대하지 않는다.

**구현·활성화 오판 방지 작업은 완료했다.** 지속 60fps, 전체 hit-test C++ 이관, resize·물리 입력/표시 수락은 달성한 것으로 쓰지 않는다. 제품 **PARTIAL**, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/표시 **notVerified**를 유지한다.

## 15. 이전 C++ 실험 실행 증거 재감사

사용자가 이전 실험도 실제로는 TS가 아니었는지 의심해 `work3`의 서술만 재인용하지 않고 **당시 tool result 원문, 해당 시점의 tracked source, 현재 호출 경계**를 대조했다. 앞서 이전 후보들을 한꺼번에 native 실행으로 설명한 것은 부정확했다. 다음처럼 구분한다.

| 이전 실험 | 확인한 실행 근거 | 재판정 범위 |
| --- | --- | --- |
| snapshot input geometry (§8.1) | 당시 보고의 providers=12/cold=0/nodes=359와 미지원 hook 목록. `available=true / executed=true`는 별도의 한 편집기 API smoke에서 설정됨 | **대표 일반 화면은 TS fallback**. C++ kernel 성능 비교로 인정하지 않음 |
| Path batch (§12.1) | 당시 source 진단의 Path stage 항목 345, 정상 close. v2 packet을 native replay에 보내고 C++ `scene_build::path`가 숫자 table을 생성하는 경계 | 해당 source 진단에 C++ 실행을 뒷받침하는 증거 있음. 345를 native 함수 호출 수나 독립 내부 counter로 쓰지 않음 |
| clip/paint batch (§12.1) | 같은 종류의 stage 항목 clip=1,638/paint=1, 정상 close. native v2 parser와 C++ paint builder 경계 | 전부 TS였다고 판정하지 않음. 특히 paint 1건으로 전체 paint가 C++ 이관됐다고 설명하지 않음 |
| Scene composition (§12.1) | native `prepare` 반환 뒤 기록한 source-node 항목 32,893, 실제 native `stats`의 close=1/보유 nodes·bytes=0 | C++ 합성 호출 근거 있음. TS source lookup·packet 생성·원래 resource replay는 계속 존재 |
| Semantics geometry (§12.1) | native `evaluate` 반환 뒤 query 항목 5,883, **TS fallback 1,023**, 실제 native stats의 close/0 metadata | **C++와 TS 혼합**. semantics 전체가 C++이거나 fallback이 없었다는 주장은 불가 |

초기 snapshot 원문은 해당 실행 기록의 tool result에서 위 미지원 목록과 직접 smoke의 `executed=true`를 동시에 확인했다. 후속 네 후보는 별도 E3 실행 기록의 정상 source 진단 결과를 대조했다. 실패한 combined 표본(`normalClose=false`)은 위 성공 증거에 합산하지 않았다. Scene/semantics TS adapter·JSI HostObject와 Path/paint packet/replay의 관련 tracked source는 `b98ed67`과 `HEAD 2a5fdf3` 사이에 변경이 없음을 확인했다.

**증거의 강도에도 차이가 있다.** Path/clip/paint의 `scene-*-native` 수는 TS가 native packet을 준비하면서 **submit 전** 기록하는 항목 수다. Scene/semantics의 같은 stage는 native 호출 반환 뒤 기록하지만 수 자체는 TS에서 제공한 nodes/queries다. 이 수치만으로 모든 항목의 native 실행 완료·프레임별 coverage를 독립 증명하지 않는다. 실제 HostObject는 C++ `Session::prepare/evaluate`로 직결되고 그 내부에 TS 계산을 호출하는 fallback은 없다. 해당 source 진단의 성공·수명 기록과 함께 C++ 실행 근거로 사용하되, §14의 독립 C++ commit/query 집계와 같은 수준이라고 쓰지 않는다.

**과거 각 일반 FPS 실행의 C++ 처리율은 소급 확정하지 않는다.** §10의 mode별 일반 FPS package와 §12의 source 진단 package는 다르다. 후보 옵션·서로 다른 SDK/bytecode hash·별도 source 진단 성공만으로 모든 무계측 FPS owner의 실제 native 적용을 보증할 수 없다. 당시 각 FPS 실행에는 현재와 같은 독립 native/SDK 집계가 없으며, 이전 binary도 별도 보관하지 않는다. 현재 소스로 재실행한 결과를 과거 binary의 실행 증명으로 대체하지 않는다. 기존 수치는 해당 package의 관찰값으로 보존하고, C++ 자체 효과를 확정하는 수치로 재사용하지 않는다. 기존 **NO_ADOPTION**은 기본 활성화하지 않는 판정으로 유지하며 C++ 설계 전반의 무효·성능 한계로 일반화하지 않는다.

진단의 혼동도 수정했다. `rnw-frame-probe.js`의 `inputGeometry.executed`를 **`inputGeometry.apiSmokeExecuted`**로 바꿨다. 직접 API smoke와 실제 페이지 실행을 분명히 구분한다. `run-rnw-motion-probe.mjs`도 새 이름을 사용하며 실제 frame의 native stage 처리 >0과 numeric owner close/0 metadata gate를 계속 요구한다. API smoke만 성공한 이전 형식의 보고를 호환 alias로 수락하지 않는다. 현재 일반 앱의 기본값·native/SDK 공급은 §14.4 그대로다.

이 수정 뒤 RNW probe·활성화 검사 **21/21 PASS**, 수정 진단 코드 lint/format·`git diff --check`가 통과했다. 이는 진단 필드 수정의 source 회귀이며 과거 binary 재실행이나 옛 모든 FPS 표본의 native 실행 재인증이 아니다. 새 검증 로그·과거 package 사본은 만들지 않았다.

## 16. 사용자 요청에 따른 이전 후보 재실험

현재 source의 TS 기준과 snapshot input geometry·Path·clip/paint·Scene composition·Semantics geometry를 독립 선택한다. 과거 binary의 실행을 소급 증명하는 실험은 아니다. 같은 optimized/Release Hermes bytecode의 한 startup-selector package에서 mode만 명시적 process 환경으로 바꾸고 각 3 fresh owners의 Gallery 두 열 → Mixed 흐름을 비교한다. `FrameDiagnostics`·render hook wrapper·직접 API smoke·GDI capture·상세 native frame log를 cadence에 주입하지 않는다. SDK service 계수와 C++ 내부 계수, native QPC의 1초 bucket만 사용한다.

새 C++ 계수는 실제 projection 반환·Scene prepare/commit 반환·Semantics 반환·numeric display-list replay 완료 뒤 증가한다. unique native Path/Paint 생성과 native numeric clip command도 구분한다. 측정 구간 전체 안에 든 1초 bucket만 합산해 startup 작업이 warm 처리로 오인되지 않게 한다. 요청 외 후보 실행, SDK/native 불일치, 잘린 bucket, 미해제 session은 실패다. native 작업이 없는 leg는 C++ 성능 표본으로 수락하지 않고 관찰 FPS와 실패 범위를 따로 표시한다.

명령은 `npm.cmd run test:native-service-audit`, `npm.cmd run experiment:native-services -- --trials=3 --functional`이다. 보고는 bounded RAM과 이 문서에만 남기며 과거 package/SDK 사본·검증 log/receipt를 누적하지 않는다. 아래는 **현재 source의 활성화 계측을 포함한 비교**다. 일반 App 그대로의 무계측 성능이나 과거 binary의 실행 인증으로 쓰지 않는다. §14의 retained 후보는 이미 별도로 검증했으므로 이번 다섯 후보 표에 섞지 않았고, 이전 combined GPU stress도 재현 범위에 넣지 않았다.

### 16.1 공급·방법과 실패 조건

Canonical native를 prepare → Windows supplier rebuild → SDK 공급·runner 재설치했다. 기본 prepared locator도 같은 native로 갱신했다. 모든 cadence는 optimized/Release Hermes **bytecode**, 2560×1459 physical / DPI 192다. 각 fresh owner에서 Gallery 좌/우 각 두 방향 5초, 이어 Mixed 편집기 focus 상태 두 방향 10초를 실행하고 정상 종료했다. 6모드 × 3회 = **18 owners / 108 legs**이며 TS 대조군 3회를 다섯 후보 비교에 공통 사용했다. 15개의 독립 TS 대조 실험으로 세지 않는다.

회차별 실행 순서는 `ts,snapshot,path,paint,composition,semantics` → 역순 → `paint,composition,semantics,ts,snapshot,path`다. Native 내부 QPC 계수와 고정 signature의 SDK service 집계 비용이 포함된다. Source frame/stage probe·직접 API smoke·GDI capture는 cadence에서 비활성이다. 별도 snapshot preflight는 경로 확인에만 사용했고 helper 수정 전 package 및 다른 CPU 검사와 겹친 실행이므로 정식 FPS 평균에서 제외했다.

| 정식 비교 package | SHA-256 |
| --- | --- |
| manifest | `6bd93cea4862894e2d2e12f8c05e33f4d8e0cf241b3a52e22c7bc73e143219d1` |
| EXE | `e62933885558b8027bcd50fd2a12ccaa8144b3a20617ebdaaa93c9e9cefa1fc5` |
| bytecode | `aa4fa36377a5813e0542fa87544293099f595bb78064c996b2974caf67874257` |
| native inputs | `4f302267f1de13c2daead61cdd69d0622fde2be45215e24f650f3d9c49028c52` |
| SDK inputs | `aa86ae73ca3a8d1d7c2f689d73adfe547c42345a05f08ce553ffefa22420b2d1` |
| App inputs | `695c7273c1c3aa4d6aefc348b4f790484a25ccb6b5b74c55cc66f963e7b9f2b9` |

App 원문은 fixture build의 finally에서 이미 복구했다. 이 표의 App/bytecode는 startup selector가 들어간 비교 package 식별이며 일반 App의 식별이 아니다. 같은 binary에서 `NELYX_NATIVE_SERVICE_EXPERIMENT`로 하나만 선택한다. 미지정/알 수 없는 mode, 요청 외 후보, native/SDK 불일치, 누락/overflow bucket, 열린 session이나 close 뒤 retained bytes는 실패한다. 기존 TS/retained verifier도 새 실험 보고가 있으면 거부하므로 다른 실험을 TS 대조군으로 오인하지 않는다.

### 16.2 독립 C++ 실행 결과

아래 native 수는 **후보별 정식 owner 3개의 전체 수명 합계**로 startup·전환도 포함한다. Warm 실행 판정에는 별도로 각 입력 구간 안에 완전히 포함된 1초 bucket만 사용했다. Native stage의 TS 준비 항목 수를 가져온 값이 아니다. 세 numeric service의 session은 모두 명시적으로 닫혔고 열린 session/retained bytes는 0이었다. 18 owners 모두 `forced=false`, exit 0이다.

| 후보 | C++ 내부 작업 합계 | 입력 구간 실행·fallback |
| --- | --- | --- |
| snapshot input geometry | projection 2,662 / editor queries 31,944 | Mixed 6/6 legs, 전체 54개 full-second bucket에서 실행. cold-provider TS fallback 각 1회, native 처리율 99.8830–99.8909%. Gallery는 editor 수요 0인 control |
| Path batch | 완료 numeric replay 19,328 / native Path table entries 1,536 | Gallery 우·Mixed 각각 6/6 legs에서 실제 Path 생성. Gallery 좌는 6 legs 중 4개가 0, 나머지도 각 6 entries·1개 bucket뿐이므로 좌측 성능 귀속 실패 |
| clip/Paint batch | 완료 replay 19,302 / native Paint entries 9,725 / numeric clip commands 12,052 | Gallery 좌/우·Mixed 18/18 legs의 모든 full-second bucket에서 실행 |
| Scene composition | prepare/commit 각 7,719 / output ranges 210,127 | 18/18 legs의 모든 full-second bucket에서 실행, TS fallback 0. SDK/native prepare·commit 전체 수 일치 |
| Semantics geometry | evaluate/query 각 28,725 | 18/18 legs의 모든 full-second bucket에서 실행. TS fallback 5,807, native 질의 처리율 83.1440–83.2448%인 혼합 경로 |

TS 대조군은 위 선택 후보의 native 작업이 모두 0임을 확인했다. 일반 Skia/Graphite 렌더러까지 TS라는 뜻은 아니다. Path/Paint는 root replay와 실제 Picture compilation을 포함한 **unique native table entries**이고, Scene은 native output ranges다. §15의 TS stage 항목·source-node 수와 단위/관찰 범위가 달라 과거 수치와 배수 비교하지 않는다.

Path의 Gallery 좌측은 v2 native replay 자체는 계속 있었으나 해당 입력 구간에 새 Path 생성이 없었다. Startup이나 우측의 Path 작업으로 좌측을 통과시키지 않았다. `FAIL_NO_NATIVE_WORK_IN_SOME_LEGS`를 그대로 기록하고 전체 명령은 다른 모드의 입력 검사를 마친 뒤 exit 2로 종료하도록 했다. 이는 C++ Path 전체 미실행이나 모든 실험의 성공 판정이 아니다.

### 16.3 성능 관찰과 채택 판정

각 셀은 3 owners의 두 방향, **6 legs를 모두 포함한 surface FPS 평균**이다. 느린 방향·회차를 제외하지 않았다.

| 모드 | Gallery 좌 | Gallery 우 | Mixed | Mixed 회차별 평균 범위 | Mixed 최소 편도 |
| --- | ---: | ---: | ---: | ---: | ---: |
| TS control | 58.899311 | 59.329333 | **49.370187** | 48.596038–50.169285 | 47.932768 |
| snapshot | 55.723137 (무수요 control) | 56.004922 (무수요 control) | **38.639496** | 36.962214–39.782713 | 36.575589 |
| Path | 61.815606 (native 작업 부족, 귀속 실패) | 59.225510 | **50.568783** | 49.011783–52.312961 | 47.632244 |
| clip/Paint | 62.101689 | 60.506661 | **50.189382** | 48.953960–51.741233 | 47.473407 |
| Scene composition | 57.197336 | 58.947828 | **48.498853** | 46.026701–50.607840 | 45.971247 |
| Semantics geometry | 58.570139 | 58.235096 | **48.416234** | 47.226482–49.328548 | 46.432783 |

Snapshot은 native가 실제 실행된 Mixed에서 TS보다 평균 **21.7352% 낮았다**. C++ kernel 단독 비용의 판정은 아니며 TS eligibility·visitor·packet 준비·JSI/result 복사를 포함한 선택 경로의 손실이다. Path/clip-Paint Mixed 평균 차이는 각각 **+2.4278% / +1.6593%**지만 회차별 변동과 겹친다. Paint Gallery 좌측에는 +5.4370%의 관찰 차이가 있으나 이 한 장면 평균과 3회만으로 지속적 개선·전체 스크롤 해결을 수락하지 않는다. Scene/Semantics Mixed는 각각 **-1.7649% / -1.9322%**이며 역시 작은 차이의 원인을 확정하지 않는다.

**다섯 후보 모두 기본 채택은 NO_ADOPTION**, 명시적 실험 경로로 유지한다. 새 수치는 이전 all-fallback snapshot 수치를 C++ 성과로 재사용한 결과가 아니며, §14의 다른 native/SDK retained 비교와 합산하지 않는다. Native 실행 사실은 확인했지만 지속 60fps·체감 버벅임 제거는 달성하지 못했다. 특정 함수·GC·GPU를 원인으로 확정하는 profile도 이번 비교에는 없다.

### 16.4 입력·일반 App 복구·최종 검증

같은 selector package에서 각 후보의 fresh owner 1개씩, **5개 독립 검사 모두 1/1 PASS**다. Owner 1 경로인 Gallery 두 열 warm → Mixed의 재클릭 없는 편집기 키 입력 3회·처음/끝 행 버튼 → 한글 IME commit·undo → Gallery 두 열 복귀를 사용했다. 이번에 owner 4의 편집기 없는 버튼 키 경로까지 다시 실행한 것은 아니다. 상세 native diagnostics·desktop capture를 켠 입력 검사이며 §16.3의 cadence FPS와 합산하지 않는다.

| 입력 검사 후보 | 해당 owner의 실제 native 작업 | 최대 per-key Core ack ms | 복귀 Gallery 최대 pixel gap ms |
| --- | --- | ---: | ---: |
| snapshot | projection 1,019 / editor queries 12,228 | 144.2584 | 109.0323 |
| Path | replay 9,751 / Path entries 1,171 | 142.0775 | 96.7672 |
| clip/Paint | replay 9,974 / Paint entries 3,991 / clips 5,898 | 149.7506 | 88.5905 |
| Scene composition | prepare/commit 각 4,146 / output ranges 89,090 | 142.6616 | 96.3246 |
| Semantics geometry | queries 11,913 / TS fallback 2,225 (native 84.2623%) | 142.8148 | 98.0385 |

5 owners 모두 native/SDK 실행 gate·숫자 service close/0 retained bytes·`forced=false`, exit 0, native drain `views=0/consumers=0/gpuDrained=1/inputRetired=1`을 확인했다. IME는 실제 다음 OS key 전 Core value acknowledgement와 commit 뒤 undo를 검사했다. 물리 키보드/트랙패드·native input HWND 수명 전수·scanout 수락을 뜻하지 않는다.

전체 명령의 최종 결과는 **completed=true, owners=18, missingTimedWork=[path], functionalFailures=[]**, **exit 2**다. Path 좌측의 무작업 구간 때문에 전체 성공으로 쓰지 않는다. 실제 C++ 실행이 있었던 나머지 장면의 측정과 다섯 후보의 입력 PASS도 함께 보존한다.

이후 `npm.cmd run run:windows --workspace @nelyx/testbed-2`를 실행했다. 평소 명령이 현재 원문과 실험 package의 App 입력 차이를 감지해 일반 App을 재빌드·실행했다. SDK/native 공급은 위 비교와 같으며 실행 보고는 **inputGeometry=ts, sceneComposition=false, semanticsGeometry=false, sceneBatch=none**이다. 최대화 Gallery에서 Elevated 버튼 결과 `1 · Elevated pressed`와 오른쪽 열의 Communication/Containment 쪽 실제 이동을 확인한 뒤 Alt+F4, runner **exit 0**으로 닫았다.

다른 build/test 없이 `node Nelyx/eng/run-rnw-cadence.mjs --trials=3 --scene=gallery --input-geometry=ts`를 직렬 실행해 **3/3 fresh owners**, 유일한 TS 요청·다른 후보 미실행 gate와 정상 종료를 확인했다. 일반 Gallery 좌/우 평균은 **53.115897 / 53.645943 surface FPS**, 각 6개 방향 표본이다. 이 실행은 **일반 App 복구 확인**이며 selector package의 공통 TS 대조군을 대체하거나 §16.3의 개선율 분모로 쓰지 않는다. Desktop sampling과 상세 drain은 unobserved이며 pixel change/gap의 기본값 0을 정지 없음의 증거로 쓰지 않는다.

| 최종 일반 TS package | SHA-256 |
| --- | --- |
| manifest | `d2ed8e481b385a6a78286d46d6728564d5a2a064e97ce6a80740ea998e3d0c5e` |
| EXE | `38f57f845e091c92940579e8675745fbe160e50e684521c1be3d6ec36337481f` |
| bytecode | `5d07f1ad11e5a11fef14caca549ac4f8bcb222c117bc124140c8e8686ed02488` |
| native inputs | `4f302267f1de13c2daead61cdd69d0622fde2be45215e24f650f3d9c49028c52` |
| SDK inputs | `aa86ae73ca3a8d1d7c2f689d73adfe547c42345a05f08ce553ffefa22420b2d1` |
| App inputs | `752a21ecf7468c62ec22ab4cfd1f83b9c3e16fb7781d3a68a1dfda45929d6a8e` |

마지막으로 Windows **9개 패키지**의 source/dist와 runner 설치본 내용, 현재 App/SDK와 package manifest, supplier/prepared **1,795 files**와 compiled native **178 source entries**, 실행 package **1,794 files**, locator hash와 pinned Hermes runtime을 다시 검증했다. 모두 일치하며 `qualification=notVerified`를 유지한다.

### 16.5 회귀·종료 상태

`test:native-service-audit` **4/4 PASS**는 실제 MSVC C++ audit executable과 verifier의 startup-only/partial-bucket/무작업/불일치/mode 혼입/미해제 거부를 포함한다. 기존 snapshot C++/framework **2/2**, retained/activation **7/7**, accessibility **127/127**, paint recording, native paint replay **71/71**, numeric services/Scene 회귀, Windows animation **32/32**와 workspace 전체 types가 PASS다. 묶음 사이에 겹치는 검사를 합산하지 않는다. Static AOT는 타입 검사이며 새로운 Static AOT runtime 실행이 아니다.

처음 numeric/Scene 묶음은 **5/6 PASS**였고 pinned Skia pixel fixture가 실행 전에 `Compiled native source inventory incomplete`를 반환했다. 구 prepared locator를 표준 CLI prepare로 새 supplier에 맞춘 뒤 실패한 pixel fixture만 **1/1 PASS**로 확인했다. 첫 실패를 지우고 한 번에 모두 통과했다고 쓰지 않는다. 정식 실험 도중과 이후 일반 build 사이에는 native source/SDK를 교체하지 않았다. 모든 test timeout은 **1,200,000ms**이며 마지막 변경 코드 lint/format·JS syntax·PowerShell parser·`git diff --check`도 PASS다.

App 원문은 기존 `onReady={() => {}}`로 복구했고 현재 Release 출력도 일반 App이다. 작업 소유 fixture/animation entry/staging과 Testbed 프로세스는 남아 있지 않다. 현재 dist/package만 유지하며 검증 log/receipt/checkpoint/history JSON, 이전 package/SDK 사본, 독립 설치본이나 browser profile은 만들지 않았다. 기존 사용자 cache/emulator와 work4의 삭제 차단된 구 공급 4개는 유지했다. 커밋은 만들지 않았다. 사용 가이드와 향후 실행 gate를 Testbed의 양언어 README와 `.github/copilot-instructions.md`에 반영했다.

**재실험·실행 검증·일반 App 복구는 완료했다.** Windows bytecode 검증이며 Android/Web의 새 제품 공급이나 Apple/Linux runtime으로 확대하지 않는다. 제품 **PARTIAL**, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/표시 **notVerified**를 유지한다.

## 17. 사용자가 직접 조작하는 C++ 모듈 모드

사용자가 자동 검사 대신 직접 C++ 경로를 사용하는 모드를 요청했다. `npm.cmd run run:windows:cpp`와 같은 이름의 Testbed workspace 명령을 추가했다. 기본 `all`은 retained input geometry·Path/Paint·clip·Scene composition·Semantics geometry를 함께 선택한다. `--module=all|retained|snapshot|path|paint|composition|semantics|ts`로 개별 경로와 TS control도 선택할 수 있다.

수동 launcher는 현재 native/SDK를 공급·준비하고 startup selector package를 빌드한 뒤 App 원문·임시 fixture를 복구한다. 그다음 창을 열고 사용자가 닫을 때까지 기다린다. 마우스/키보드 입력·장면 이동·최대화·시간 제한을 주입하지 않는다. 모드 표시를 화면에 두고 시작 선택과 종료 후 실제 native/SDK 작업·fallback·session 정리를 구분한다. Native 수동 집계는 `counters-only`이며 per-call QPC read나 시간 bucket을 만들지 않아 장시간 실행에도 bucket을 누적하지 않는다. 자동 실험은 기존 `qpc-buckets`를 유지하고 서로의 보고를 수락하지 않는다.

수동 결과는 모듈별 `observed`, `notObserved`, `fallbackOnly`를 구분한다. 편집기 없는 Gallery만 사용한 retained 좌표의 무수요를 C++ 실행으로 쓰지 않는다. 입력 geometry는 SDK/native commit/editor-query 집계와 명시적 close/0 bytes를 대조하고, 나머지는 기존 native 내부 계수와 SDK의 실제 호출·fallback을 대조한다. 잘못된 mode·capability 누락·집계 불일치·미해제는 실패다. 성능 개선이나 전 작업의 native 처리를 주장하지 않는다.

새 모드와 기존 활성화/audit 회귀는 **6/6 PASS**다. 실제 C++ 수동 counters-only 출력, 기존 자동 QPC bucket 출력, 혼입/불일치/미해제 거부, build 실패 뒤 원문/fixture 복구를 포함한다. Testbed TypeScript 검사와 최종 변경 코드 lint/format·JS syntax·`git diff --check`도 통과했다. Canonical native를 prepare하고 Windows supplier를 재빌드했으며 변경된 Skia native/RN 두 패키지를 실제 runner에 재설치했다. 다른 패키지의 source/dist는 바꾸지 않았다.

### 17.1 실제 수동 실행

저장소 루트의 **`npm.cmd run run:windows:cpp`** 기본 명령으로 창을 띄웠다. 첫 배치의 RN 텍스트 overlay는 Skia 표면에 가려져 표시로 수락하지 않았다. 이를 제거하고 기존 framework Text로 Gallery 및 Mixed 제목에 `C++ all`을 표시하도록 바꿨다. 새 render hook이나 입력 eligibility 우회는 추가하지 않았다. 수정 후 같은 기본 명령을 다시 실행해 `Components · C++ all`과 `입력·버튼 스크롤 · C++ all`이 실제 창에서 보이는 것을 확인했다. 표시값은 선택 모드이며 실제 실행 증거는 아래 native 집계다.

초기 수동 owner에서는 편집기 클릭 뒤 `cpp-check` 입력·실제 스크롤과 정상 종료를 확인했다. 독립 native 수는 retained commits/editor queries **131/1,572**, Path **87**, Paint **167**, clip **296**, Scene prepare/commit **142씩**, Semantics queries **516**이었다. Cold geometry fallback **1**, semantics fallback **114**도 함께 공개했고 모든 모듈이 `observed`, 명시적 close/0 bytes, `forced=false`, exit 0이었다. 이 초기 표시 실패 package를 최종 package나 성능 표본으로 쓰지 않는다.

표시 수정 뒤 최종 수동 owner는 Gallery → Mixed 전환·제목 확인·정상 close를 관측했다. Retained commits/queries **2/24**, Path **58**, Paint **83**, clip **24**, Scene prepare/commit **9씩**, Semantics queries **106**을 확인했다. Cold geometry fallback **1**, semantics fallback **23**이다. 모든 선택 모듈 `observed`와 정상 종료를 다시 확인했다. 짧은 cold 진입이므로 이 owner의 geometry coverage 66.67%를 warm cadence 처리율로 쓰지 않는다.

### 17.2 같은 package의 입력·IME 회귀

최종 수동 package에 한해 `NELYX_NATIVE_SERVICE_EXPERIMENT=all`, `NELYX_NATIVE_SERVICE_MANUAL=1`, `NELYX_WINDOWS_MIXED_NATIVE_MODULES=all`, `NELYX_WINDOWS_MIXED_TRIALS=1`을 검사 프로세스에만 설정하고 기존 Windows mixed 입력 회귀를 실행했다. **1/1 PASS / fresh owner 1개**다. Gallery 두 열 warm → 편집기 재클릭 없는 입력 3회·처음/끝 행 버튼 → 실제 한글 commit·undo → Gallery 두 열 복귀를 확인했다. 이 검사에서는 모든 요청 모듈이 `observed`여야 통과하도록 했다.

| 실제 native 작업 | 해당 owner 합계 |
| --- | ---: |
| retained commits / editor queries | 974 / 11,688 |
| numeric replay / Path entries | 8,630 / 909 |
| Paint entries / clip commands | 3,489 / 4,931 |
| Scene prepare / commit / output ranges | 3,671 / 3,671 / 78,453 |
| Semantics queries | 11,702 |

Geometry fallback은 cold-provider **1회**, native 처리율 **99.8974%**다. Semantics fallback은 **2,162회**, native 질의 처리율 **84.4057%**인 혼합 경로이며 Scene fallback은 0이다. 최대 per-key Core ack **140.8497ms**, 복귀 Gallery pixel gap 최대 **102.4178ms**, native drain `views=0/consumers=0/gpuDrained=1/inputRetired=1`, 모든 session close/0 bytes, `forced=false`, exit 0이다. Desktop/native diagnostics를 켠 기능 회귀이며 일반 FPS·물리 키보드/트랙패드·scanout 수락으로 쓰지 않는다. 개별 mode의 새 Windows cadence를 모두 다시 측정한 결과도 아니다.

### 17.3 일반 실행 복구·최종 공급

수동 launcher는 SDK 입력 hash·patched App 입력 hash·prepared native hash와 실행 manifest를 대조해 오래된 일반/다른 mode package를 시작 전에 거부한다. 창을 여는 동안 manifest가 바뀌어도 성공으로 쓰지 않는다. App 원문은 창을 열기 전에 복구하므로 다음 일반 명령이 실험 package와의 차이를 감지해 재빌드할 수 있다.

검증 뒤 **`npm.cmd run run:windows --workspace @nelyx/testbed-2`**도 실제 실행했다. 재빌드된 일반 창의 `Components` 제목과 Elevated 버튼 결과 `1 · Elevated pressed`를 확인하고 Alt+F4, runner exit 0으로 닫았다. 선택 보고는 `inputGeometry=ts`, Scene/Semantics false, sceneBatch none이고 수동 선택/집계 보고가 없었다. 일반 기본값을 C++로 바꾸지 않았다.

| SHA-256 식별 | 최종 수동 all package | 복구한 일반 TS package |
| --- | --- | --- |
| manifest | `8957eda44f8e036d7dd66d998efb7c9c409cbd198a007b5c4cade431d02d7c95` | `fff1972c2e6ad278415cfe90e6924c940a6f2d0600ade8626bdbc08a73ff12d8` |
| EXE | `6d43714941cdf72df822c8c67e982da200e690d5ebc33c77a82049b9422dbbe2` | 같은 EXE |
| App inputs | `d75a408e84e2cbc68e861318244a1a4a2f66232732a8974316b2c1626e5a36ae` | `eab0eeb88a7559a1b766cd24eb5ac61408365deede0a465bc113b7e1f6b1cce4` |

공통 native inputs는 **`6226f5fc53906610ba613b8ddce94fc718e0b3125449c8664ff51181588d9235`**, SDK inputs는 **`8e8b2c9dc1cba80a0371fa65d93cf40eb5ec526f01851231f10853d6672129d1`**다. 일반 bytecode는 `113d21f539f9281728c43d693ba740c057797a0f98e4f690e96de18ee2885188`이다. 모두 optimized/Release Hermes bytecode이며 `qualification=notVerified`다. §16의 성능 비교 공급과는 다른 후속 공급이므로 그 FPS를 새 공급의 일반 성능으로 재인증하지 않는다.

최종 9개 패키지의 source/dist·설치본 내용, 현재 App/SDK와 실행 manifest, supplier/prepared 각 **1,795 files** 및 compiled native **178 source entries**, 일반 실행 package **1,795 files**, locator hash와 pinned runtime을 대조해 모두 일치함을 확인했다. 원문 App/임시 fixture·staging·Testbed process 정리를 확인했고 현재 Release/dist만 유지했다. 새 검증 log/receipt/history JSON·이전 package 사본·독립 설치본은 남기지 않았다. 기존 사용자 cache/emulator와 삭제 차단된 구 공급 4개는 건드리지 않았고 커밋은 만들지 않았다.

**직접 조작 C++ 모드 구현·실행 검증은 완료했다.** 명시적 preview 모드이며 기존 성능 후보의 NO_ADOPTION과 제품 **PARTIAL**, `performanceAccepted=false`, `resizePerformanceAccepted=false`, 물리 입력/표시 **notVerified**를 유지한다. Android/Web·Apple/Linux에 새 runtime 검증을 확대하지 않는다.
