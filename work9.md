# W9 · 일반 스크롤에서 간헐적으로 움직임이 끊기는 원인과 개선 계획

2026-11-18 · 초기 소스 분석 기준 `deb611aa` · **PARTIAL** · Demo 와이드 2열 빠른 전 구간 비교 완료 · `performanceAccepted=false` · 아래 자동 검증 명령과 스크립트 링크는 W9 실행 당시의 기록이다. 현재 작업은 [W10](work10.md)을 따른다.

**사용자가 스크롤 중 버벅임을 체감한 화면은 Windows Demo의 `All components`가 와이드 레이아웃으로 두 열을 표시할 때다.** 대략 30 FPS는 당시 체감치다. 어느 열에서 어떤 입력 장치를 사용했는지는 미확인이다. 이 화면을 첫 재현 대상으로 삼아 왼쪽·오른쪽 열을 각각 측정한다. Testbed의 실제 ListView는 공통 목록·접근성 비용을 확인하는 비교군으로, 달력은 마지막 회귀 확인에 사용한다.

## 1. 기존 일반 스크롤 결과의 범위

W8 마지막 확인에서 Gallery와 Testbed 가변 목록은 각각 한 번 왕복했다. 처음 내리기·되돌리기·다시 내리기의 desktop 표시 FPS 하한은 Gallery 84.73 / 60.08 / 62.05, Testbed 79.74 / 61.31 / 59.95였고 여섯 구간의 desktop 최장 간격은 47.75ms였다. 앞선 W8 Gallery cold에서는 50ms를 넘은 표시 간격이 두 번 있었다. 서로 다른 공급에서 얻은 기록이다. 현재 소스와 일반 앱에서 증상이 사라졌다는 판정에는 쓸 수 없다. [W8 초기 측정](work8.md#L125) · [마지막 측정](work8.md#L191)

| 기존 검사가 보는 것 | W9에서 채울 부분 |
| --- | --- |
| 각 구간은 60Hz 휠 50개, 처음부터 마지막 입력까지 약 817ms, 논리 이동량 480px이다. Gallery probe는 첫 번째 목록의 위치를 읽는다. | 같은 영역 안에서 속도를 유지하는 수 초와 여러 섹션을 처음 넘는 수 초를 확보한다. 실제 스크롤한 열과 관측한 컨트롤러가 일치해야 한다. [입력 일정](Nelyx/eng/check-windows-jank.mjs#L236) · [관측 대상](Nelyx/eng/windows-gallery-probe.ts#L31) |
| `-Scenario list -App testbed`는 자연 높이의 여러 줄 텍스트로 `ListViewPage.createState`를 교체한다. 실제 페이지는 높이 80, dormant 보존 용량 32, 아이콘과 Ink가 있는 ListTile이다. | 실제 고정 높이 페이지를 주 비교군으로 추가한다. 가변 높이 fixture와 기존 Testbed 기능 검사는 각자의 이름으로 기록한다. [진단 대체 화면](Nelyx/eng/windows-variable-list.ts#L17) · [제품 페이지](sample/nelyx-testbed-app-2/src/list-view.ts#L100) |
| 엔진에서는 위치가 변한 프레임 간격의 분포를 구한다. desktop 집계는 marker 간격 분포와 위치 정체 ≥100ms를 반환한다. | 같은 위치가 반복된 뒤 한 번에 멀리 움직이는 현상, 33~50ms의 짧은 정체, marker와 실제 목록 내용의 불일치를 드러낸다. [기존 집계](Nelyx/eng/windows-jank-metrics.ts#L85) |

## 2. 구현에서 확인한 문제와 첫 수정 후보

**첫 수정 후보는 새 접근성 스냅샷을 Windows에 보낼 때 변경 범위가 전체 노드로 넓어지는 경로다.** 실제 Testbed 위젯으로 확인한 §2.6의 이동 구간에서는 새 캡처와 위젯 빌드가 겹쳤고, 이전에 우선시한 동일 스냅샷의 재사용 경로에는 진입하지 않았다. 아래는 초기 후보를 선정한 근거다. 제품에서 측정한 슬롯 생성과 Windows 게시 시간은 §7에 기록했다.

### 2.1 새 행의 위젯 빌드가 layout 시간에 포함된다

일반 스크롤에서 offset 변경은 viewport의 layout을 요청한다. 루트의 `flushBuild()`는 기본 build scope를 처리한다. 고정 높이 목록의 새 슬롯은 이후 sliver layout 안에서 `createChildInLayout → delegate.build → updateChildAt`으로 만들어진다. `buildScope` 안에서는 자식 조정과 해당 scope의 dirty Element 처리가 일어난다. 따라서 루트의 `build ms`가 짧아도 새 ListTile 아래에서 위젯 빌드가 오래 걸릴 수 있다. Demo는 섹션 Widget을 ID별로 캐시하고, Testbed의 행 builder는 호출할 때마다 ListTile·Text·Icon 구성을 만든다. 이미 mount된 모든 행이 스크롤 입력마다 새로 build된다고 추정할 근거는 없다. [루트의 단계 경계](Nelyx/src/framework/widgets/root.ts#L657) · [슬롯 생성](Nelyx/src/framework/widgets/sliver.ts#L638) · [scope 처리](Nelyx/src/framework/widgets/framework.ts#L1510) · [Demo 캐시](sample/nelyx-demo-app/src/components.ts#L465) · [Testbed 행](sample/nelyx-testbed-app-2/src/list-view.ts#L116)

Testbed에서 보존한 행을 다시 만날 때도 **delegate가 먼저 새 Widget을 만든 뒤** 기존 Element와 타입·키가 맞는지 검사하고 재활성화한다. 행이 화면에서 빠질 때는 dormant 캐시에 넣기 위해 그 서브트리를 순회하며 보존할 수 없는 GlobalKey와 Element 수를 확인한다. 복잡한 행 하나가 들어오고 다른 행 하나가 빠지면 생성·조정·보존 자격 검사 비용이 같은 layout에 잡힐 수 있다. 또한 `buildScope` 끝과 `finishQueuedChildren`에서 `flushRenderTree` 진입이 이어진다. 두 번째 진입에서 실제로 남은 변경이 몇 개인지 확인해야 한다. 호출 횟수로 트리 전체의 이중 커밋을 가정하지 않는다. [보존 행 채택](Nelyx/src/framework/widgets/sliver.ts#L473) · [행 이탈](Nelyx/src/framework/widgets/sliver.ts#L675) · [보존 자격 검사](Nelyx/src/framework/widgets/dormant-child-cache.ts#L63) · [scope 끝의 커밋](Nelyx/src/framework/widgets/framework.ts#L1578) · [후속 동기화](Nelyx/src/framework/widgets/sliver.ts#L590)

**수정 판단.** 첫 통과/재방문의 같은 행에서 delegate 호출, 최초 mount, 기존 Element rebuild, dormant 채택·거절, 자격 검사 방문 수, 실제 render 변경 수를 센다. 자격 검사가 지배하면 이전 결과를 동일한 서브트리 구조·키에서만 재사용하는 방안을 검토한다. 후속 커밋이 비어 있고 그 진입 비용이 크면 변경이 없음을 owner가 보장하는 경로만 단축한다. 같은 위치의 행 데이터·선택·테마가 달라졌을 때는 최신 Widget을 반영해야 한다. 기본 delegate의 접근성 인덱스·keep-alive·repaint 경계도 유지한다. [행을 감싸는 기본 위젯](Nelyx/src/framework/widgets/scroll-delegate.ts#L75)

### 2.2 위치만 바뀐 프레임도 접근성 게시 시점에 일이 몰릴 수 있다

두 앱 모두 접근성이 기본 활성이고 `semanticsUpdateInterval`은 300ms다. 범위·스크롤 가능 여부가 그대로인 표준 scroll renderer는 위치 변화를 geometry 변경으로 표시한다. 루트는 조건을 만족하면 게시를 미루고, 마지막 geometry 변화 뒤 약 100ms의 정착 시점 또는 게시 기한에 다시 처리한다. 포커스, 대기 중인 action, 설정 변경, 편집기 geometry 등에 따라 더 일찍 처리할 수 있다. **연속 스크롤에서 일정 간격으로 한 프레임만 길어지는 현상**과 맞는 후보지만 300ms는 설정값이다. 정체 주기로 측정된 값은 아니다. [Demo 설정](sample/nelyx-demo-app/src/app.ts#L25) · [Testbed 설정](sample/nelyx-testbed-app-2/src/app.ts#L21) · [geometry 변경 분기](Nelyx/src/framework/rendering/scroll-semantics.ts#L26) · [게시·정착 조건](Nelyx/src/framework/widgets/root.ts#L864)

| 실제로 반복되는 작업 | 수정 범위와 기각 조건 |
| --- | --- |
| **동일 스냅샷 재사용.** 루트는 재사용에 성공해도 게시 경로에서 `updateViewSemantics`를 호출한다. 접근성이 켜진 binding은 모든 노드의 bounds를 복사해 ID별 Map을 다시 만든다. direct SDK도 동일한 동결 루트를 받으면 동등 비교는 즉시 끝나지만, 비교 전에 `validated`가 전체를 펼쳐 Map을 만들고 `replaceNodes`가 수명 토큰 Map을 다시 채운다. native publish 자체는 변경이 있을 때 수행한다. [루트 게시](Nelyx/src/framework/widgets/root.ts#L968) · [bounds 인덱스](Nelyx/src/framework/semantics/binding.ts#L199) · [SDK 인덱스](Nelyx/sdk/src/runtime/native-interaction.ts#L1281) · [SDK 갱신 순서](Nelyx/sdk/src/runtime/native-interaction.ts#L1336) | **재사용 분기의 보조 후보.** 같은 view·binding 수명 안에서 이미 성공적으로 게시한 동일한 불변 루트에 한해 bounds·노드 인덱스를 재사용한다. 실패한 publish 재시도, 접근성 해제 후 재활성화, binding 교체, 최신 action callback의 전달을 보존한다. 다른 객체가 같은 값을 담은 경우까지 생략하지 않는다. 긴 프레임에서 동일 루트 호출이 없으면 이 변경으로 해당 정체를 설명할 수 없다. |
| **새 스냅샷 생성.** 재사용·연기 조건을 모두 벗어나면 dirty semantics를 flush하고, 등록된 transport source를 확인한 뒤 접근성 트리를 순회해 host 노드를 만든다. 그 결과를 검증·동결하고 다시 평탄화한다. 위치만 바뀌어도 새 게시가 필요한 프레임에서는 비용 범위가 실제로 바뀐 행보다 넓을 수 있다. [캡처·동결](Nelyx/src/framework/widgets/root.ts#L919) · [source 수집·트리 방문](Nelyx/src/framework/rendering/semantics-transport.ts#L319) · [검증](Nelyx/src/framework/semantics/semantics.ts#L1084) · [평탄화](Nelyx/src/framework/semantics/semantics.ts#L1368) | 새 capture가 긴 프레임이면 같은 행·다른 bounds와 새 행·다른 구조를 나눈다. 먼저 같은 게시에서 이미 검증한 노드와 인덱스를 공유한다. 이후 변경된 가지로 작업을 제한하려면 부모 transform·clip·자식 순서·text-field geometry·action 세대까지 무효화에 포함한다. |
| **Windows UIA 전달.** SDK는 게시 microtask에서 전체 트리를 걸으며 각 노드의 packet을 만든 뒤 upsert 여부를 판정하고 전체 순서를 보낸다. 네이티브는 VM에서 delta를 읽고 UI 스레드에 전달한다. UI 쪽에서는 바뀌지 않은 packet까지 순서대로 모아 `publish`하고 기존 peer를 재사용한다. upsert 수, 방문 노드 수, 새 UIA peer 수는 서로 다른 값이다. [SDK packet 생성](Nelyx/sdk/src/backends/native-hermes/interaction.ts#L66) · [VM→UI 전달](Nelyx/sdk/native/windows-hermes/main.cpp#L226) · [네이티브 delta 적용](Nelyx/engine/platform/windows/interop/SemanticsTree.h#L67) | 변경 노드가 적어도 VM packet 생성 또는 UI 적용이 늦는 경우에만 해당 단계를 고친다. 순서가 같은 단순 속성 변경과 재정렬·추가·제거·세대 reset을 구분한다. 포커스와 동작의 commit 귀속, 기존 UIA peer identity, 화면 밖으로 나간 항목의 제거를 확인한다. |

W4에서 선별한 `markConflicts`의 비중은 달력의 특정 충돌 판정에 대한 기록이다. 이번에 찾은 비용은 dirty semantics 조립 이후의 캡처·인덱스 재작성·Windows 게시에도 걸쳐 있다. 기존 측정의 분모를 일반 목록에 옮겨 쓰지 않는다. [W4 측정 범위](work4.md#L180)

### 2.3 같은 화면에서 두 가설을 가르는 기준

| 비교 구간 | 관측과 다음 결정 |
| --- | --- |
| 활성 슬롯 집합이 같은 동안 천천히 이동 | 실제 mount·rebuild 수가 0인 프레임을 찾아 `reuse / defer / capture`와 게시 시각을 함께 본다. 이 구간에서도 게시 프레임만 늦으면 접근성 단계부터 수정한다. 표시된 행이 같아도 cache 범위가 바뀔 수 있으므로 실제 슬롯 ID를 확인한다. |
| 새 행 첫 진입과 같은 행 재방문 | layout 안의 delegate·mount·rebuild·회수 **배타 시간**과 semantics의 변경 종류·방문 노드·upsert 수를 frame ID에 연결한다. 새 행 생성에서 먼저 지연되면 위젯 수명주기, 그 뒤 게시에서 또 지연되면 두 비용을 각각 산정한다. |
| 편집기 없는 고정 행과 편집기가 포함된 Gallery | 같은 화면 안에서 시작점을 고정해 전후를 비교한다. 편집기 포함 여부·포커스와 함께 bounds 및 IME geometry의 갱신 여부를 적는다. 접근성 활성 상태가 채택 기준이다. 필요할 때만 같은 앱·입력에서 접근성 off를 별도 진단 대조군으로 쓰고, 차이는 해당 경로 전체의 영향으로 기록한다. |

기존 Gallery probe는 build/layout/semantics 등의 구간 요약을 만든다. 상세 build profiler에는 달력 시나리오 제한이 있다. W9-2에서 실제 두 목록에 필요한 카운터만 연결하고, **frame ID → semantics commit → Windows UI 적용**을 잇는다. 현재 Scene의 CPU, 이후 VM microtask, UI 큐 대기와 적용 시간을 별도 기록해 다음 프레임의 입력이 늦어진 경우까지 본다. 제품 표시 비교에서는 상세 계측을 끈다. 회귀는 스크롤 후 첫·마지막 가시 행의 이름과 bounds, 선택, 포커스, 접근성 scroll action, 편집기 IME 위치, 행 재생성 후 이전 action 차단을 확인한다. [Gallery 집계](Nelyx/eng/windows-gallery-probe.ts#L100) · [build profiler 제한](Nelyx/eng/check-windows-jank.mjs#L741) · [geometry 회귀 검사](Nelyx/eng/check-semantics-geometry.mjs) · [Windows delta 회귀 검사](Nelyx/eng/check-native-semantics-delta.mjs)

### 2.4 입력부터 표시까지 남은 원인 후보

아래 번호는 입력에서 표시까지의 순서다. 위젯 빌드·접근성 작업이 긴 간격을 설명하지 못하거나 그 작업이 끝난 뒤에도 지연이 남을 때, 처음 늦어진 경계부터 조사한다.

| 단계와 현재 호출 경로 | 예상되는 현상과 수정 방향 |
| --- | --- |
| **1. 입력과 프레임 콜백이 VM을 사용하는 순서.** Win32 휠은 논리 delta로 바뀌어 배치에 들어가고, VM이 샘플별로 JS에 전달한다. direct Hermes 진입점은 각 패킷에 `view.dispatchPointer`를 호출한다. compositor wake는 UI 스레드를 거쳐 같은 VM 큐에 들어간다. 큐는 FIFO이고 task 뒤에 microtask를 처리한다. [네이티브 입력](Nelyx/sdk/native/windows-hermes/main.cpp#L120) · [frame wake](Nelyx/sdk/native/windows-hermes/main.cpp#L263) · [VM 큐](Nelyx/sdk/native/windows-hermes/RuntimeLoop.h#L18) · [실제 JS 진입점](Nelyx/sdk/src/backends/native-hermes/application.ts#L228) | 행 생성이 0이고 Scene CPU도 짧은 구간에서 wake→VM 시작이 길어지고 다음 표시 위치가 여러 입력만큼 뛴다면 이 경로가 첫 후보다. 입력 순서 경계 안에서 이미 요청한 프레임을 깨우는 중복 작업이나 불필요한 한 tick 대기가 있는지 고친다. FIFO를 통째로 재정렬하거나 위치 delta를 버리면 순서를 보존할 수 없다. |
| **2. 입력 방식에 따라 위치가 변하는 시점.** 휠은 경로를 hit-test한 후 `pointerScroll`에서 위치를 즉시 바꾸고 시작·갱신·종료를 통지한다. Precision Touchpad는 DirectManipulation에서 접촉 중 `panZoomUpdate`를 보내고 관성은 프레임워크가 담당한다. [gesture 분기](Nelyx/src/framework/gestures/binding.ts#L448) · [휠 처리](Nelyx/src/framework/widgets/scroll-position-with-single-context.ts#L176) · [Precision 처리](Nelyx/engine/platform/windows/input/WindowsPrecisionTrackpad.h#L159) · [관성 위치 갱신](Nelyx/src/framework/widgets/scroll-activity.ts#L345) | 휠에서만 발생하면 동일 tick 안에 입력마다 반복되는 hit-test·동기 통지의 소비자를 추적한다. 터치패드에서만 발생하면 contact update의 실제 간격, 마지막 접촉→첫 관성 tick, OS/프레임워크 관성 취소 순서를 본다. 중복 무효화나 불필요한 wake만 줄이고 중첩 목록의 입력 소유권, 시작·종료 통지, 역전·취소를 유지한다. |
| **3. 보이는 행의 경계에서 한 프레임에 들어오는 작업.** viewport는 offset 통지로 layout을 요청한다. Demo는 섹션 높이 인덱스를 사용한다. 새 섹션의 실측 높이가 달라지면 anchor 보정으로 layout에 재진입할 수 있다. 고정 높이 페이지와 가변 높이 fixture는 서로 다른 sliver를 사용한다. [Demo 목록](sample/nelyx-demo-app/src/components.ts#L355) · [분기](Nelyx/src/framework/widgets/scroll-view.ts#L539) · [viewport](Nelyx/src/framework/rendering/viewport.ts#L298) · [섹션 측정·보정](Nelyx/src/framework/rendering/sliver-section-list.ts#L145) · [가변 목록의 회수](Nelyx/src/framework/rendering/sliver-list.ts#L184) | 첫 통과에서만 같은 경계가 끊기면 새 행 mount, 텍스트 측정, anchor 보정 재시도, 회수, semantics 갱신을 같은 프레임에서 나눠 본다. 왕복 시 그대로인 제약·revision에 중복 측정이 있다면 그 경계에 한정해 재사용한다. 폰트·폭·테마·내용 변경, 재진입 시의 State·Focus·접근성 bounds는 보존한다. |
| **4. 만들어진 장면이 화면에 도달하는 시점.** `buildPending`은 renderer 여유와 미제출 Scene 상태를 보고 생성·대체한다. `schedulePump`의 기존 Scene 제출 순서는 renderer 옵션에 따라 갈린다. 네이티브 copy fence 이후에는 desktop 합성이 남는다. [Scene 생성](Nelyx/src/hosting/runtime.ts#L718) · [tick과 제출 순서](Nelyx/src/hosting/runtime.ts#L959) · [fence와 자원 회수](Nelyx/sdk/native/windows-hermes/WindowSurface.h#L120) | offset·Scene이 제때 나왔는데 같은 내용이 오래 표시되면 pending 대기, submit, fence, desktop 순으로 확인한다. 실제 direct renderer의 옵션과 credit 반환 시점을 확인한 뒤, 제출 가능해졌는데 놓친 wake 또는 현재 입력을 담은 Scene의 불필요한 대기를 고친다. 대기열을 늘려 평균 FPS만 올리면 입력 지연이 커질 수 있으므로 입력→표시 시간도 함께 판단한다. |

### 2.5 Flutter와 같은 목록을 움직일 때 어디서 비용이 달라지는가

**같은 행들이 보이는 구간.** Flutter release의 접근성 게시 함수는 dirty node 집합이 비면 즉시 돌아간다. 변경이 있으면 병합에 영향을 받는 부모 등 필요한 노드를 모아 갱신하고, Windows 엔진은 전달받은 노드 업데이트를 모아 커밋한다. Nelyx도 geometry 변경을 구분하지만, 재사용한 스냅샷을 게시하는 경로에는 §2.2의 좌표·수명 인덱스 전체 순회가 남아 있다. 일반 목록에서 새 행이 생기지 않아도 두 구현의 CPU 작업량이 달라질 수 있는 구체적인 지점이다. [Flutter의 변경 집합](reference/flutter-master/packages/flutter/lib/src/semantics/semantics.dart#L5078) · [Flutter Windows 전달](reference/flutter-master/engine/src/flutter/shell/platform/windows/flutter_windows_engine.cc#L449) · [Nelyx의 재사용·게시](Nelyx/src/framework/widgets/root.ts#L968)

**행이 들어오고 나가는 구간.** Flutter도 layout에서 새 행의 builder를 부르고 Element를 조정한다. 다만 Flutter sliver의 `didStartLayout` 본문에는 디버그 검사만 있고, Nelyx는 여기서 격리된 build scope와 대기 중인 자식 변경을 처리한다. 새 슬롯 생성 뒤에도 동기화를 마무리한다. 따라서 비교 단위는 같은 거리에서 생긴 행 수, 행당 실제 mount·rebuild·회수 시간, 같은 프레임의 접근성 게시 비용이다. 빈 큐에 여러 번 진입한 비용과 실제 하위 트리를 다시 만든 비용을 따로 적는다. [Flutter 자식 생성](reference/flutter-master/packages/flutter/lib/src/widgets/sliver.dart#L1065) · [Flutter layout 시작](reference/flutter-master/packages/flutter/lib/src/widgets/sliver.dart#L1222) · [Nelyx layout 시작](Nelyx/src/framework/widgets/sliver.ts#L790) · [새 슬롯 처리](Nelyx/src/framework/widgets/sliver.ts#L638)

**측정된 격차의 범위.** W8 Windows 달력의 같은 빠른 역방향 입력에서 화면 내용 변화 사이 최장 간격은 Flutter release 32.1ms, Nelyx direct Hermes 198.0ms였다. 각 1회이고 이동한 월 수도 달랐다. 당시 Flutter는 Dart AOT, Nelyx는 최적화 Hermes bytecode였으므로 구조 차이와 런타임 차이가 함께 들어 있다. 이 수치로 일반 목록에서 접근성의 기여율을 추정할 수는 없다. 일반 스크롤 대조에서는 높이 80의 같은 내용·행 수, 같은 DPI·창 크기·접근성 활성·입력 일정을 맞추고 두 제품 모두 같은 화면 내용 관측기로 이동 간격을 읽는다. 원인 판정에는 Nelyx에서 해당 작업만 줄인 전후 비교를 쓴다. [W8 대조 조건과 결과](work8.md#L70) · [Hermes 긴 프레임의 작업 구성](work8.md#L93)

### 2.6 실제 Testbed 목록에서 확인한 호출 순서

**이동 중에는 ‘게시 연기 → 새 캡처’가 주된 경로였다.** 표준 scroll renderer는 위치가 바뀌면 geometry 갱신을 요청한다. 이때 `requestUpdate(render, true)`도 기존 configuration 캐시를 비우고 대기 집합에 넣는다. 실제 트리에 기여하는 변경이 남아 있으면 루트의 `reuse` 조건이 깨진다. 게시 기한이 오면 flush는 geometry용 configuration 대기도 처리하고 `offsetOnly=false`로 전환해 해당 접근성 경계의 설정과 자식을 다시 확인한다. 부모 데이터가 같은 하위 fragment는 재사용할 수 있다. [위치 listener](Nelyx/src/framework/rendering/scroll-semantics.ts#L26) · [대기 집합과 flush](Nelyx/src/framework/rendering/semantics-pipeline.ts#L1356) · [경계 선택](Nelyx/src/framework/rendering/semantics-pipeline.ts#L843) · [루트 분기](Nelyx/src/framework/widgets/root.ts#L854)

작업 트리의 Testbed `ListViewPage`를 MaterialApp·FrameworkRoot에 올렸다. Node/V8에서 540×760 논리 픽셀, 모의 텍스트 메트릭, 접근성 활성, 300ms 게시 간격을 사용했다. 초기 두 프레임 후 매번 `ScrollPosition.pointerScroll`을 호출하고 모의 시계를 16ms 진행해 Scene 하나를 만들었다. SDK의 실제 `NativeInteraction`과 `connectNativeInteraction`을 통과시켜 Windows 브리지에 넘기는 값을 수집했다. 계측은 메모리 안에서 수행했다. 이 범위에서 분기·호출 수·전송 내용은 확인했고 Windows UI 스레드·GPU·표시 시간은 미측정이다. [Testbed 제품 목록](sample/nelyx-testbed-app-2/src/list-view.ts#L109) · [사용한 Source fixture의 시계·텍스트 호스트](Nelyx/eng/calendar-midpoint-fixture.mjs#L38) · [브리지 게시](Nelyx/sdk/src/backends/native-hermes/interaction.ts#L66)

| 입력과 위치 | 위젯 빌드 | 접근성 처리 |
| --- | --- | --- |
| 1px씩 24회, 위치 1~24px | ListTile.build 총 1회 | 21회 연기, 3회 새 캡처·게시, 동일 스냅샷 재사용 0회 |
| 그중 19px | Element rebuild 완료 0회 | 직전 캡처 후 모의 시간 304ms에 기한 도달. 새 캡처·게시 |
| 21px → 22px | 21px에서 ListTile 1개를 포함한 Element rebuild 완료 56회. 22px에서는 FocusInheritedScope 1회 | 직전 캡처 후 각각 32ms, 16ms에 새 캡처·게시. 두 번 모두 기한 미도달, rebuild 있음, 설정 변경 대기 있음, primary focus 동일 |
| 이후 80px씩 4회, 위치 104~344px | 매번 ListTile.build 1회 | 네 번 모두 기한 전에 새 캡처·게시 |

56회는 최초 mount 중의 build를 포함한 `parentRebuilt` 호출 수다. 이때 텍스트 스타일, 슬롯, 아이콘, 접근성·keep-alive 래퍼가 함께 빌드됐다. 반대로 `didStartLayout`이 build scope에 진입해도 빈 dirty 큐에서는 Element를 꺼내지 않고 빈 render transaction은 즉시 반환한다. [rebuild 완료](Nelyx/src/framework/widgets/framework.ts#L2145) · [dirty 큐](Nelyx/src/framework/widgets/framework.ts#L230) · [빈 커밋](Nelyx/src/runtime/owner-transaction.ts#L36) · [ListTile 구성](packages/material/src/internal/list/list-tile-build.ts#L328)

**왜 300ms 안에 연속으로 게시하는가.** 루트는 View 전체의 build revision과 semantics pipeline 전체의 설정 변경 여부를 조합한다. 둘이 모두 바뀌면 같은 화면에서 위치 갱신을 연기하는 조건이 성립하지 않는다. 두 신호가 같은 위젯의 의미 있는 접근성 변경에서 왔는지 대조하는 단계가 없다. 22px에서는 primary focus가 그대로이고 FocusInheritedScope만 rebuild됐는데도 새로 캡처했다. 이 사실만으로 그 게시 전체를 생략해도 된다고 단정할 수 없다. [build revision 증가](Nelyx/src/framework/widgets/framework.ts#L1498) · [연기 조건](Nelyx/src/framework/widgets/root.ts#L869)

**새 캡처에서 변경 범위가 넓어지는 이유.** capture와 freeze는 가시 노드에 새 객체를 만든다. SDK는 메타데이터가 같으면 게시를 생략할 수 있다. 변경으로 일단 게시가 시작되면 브리지가 `previous.node !== node`인 각 노드를 upsert에 넣는다. 위 이동의 **7번 게시 모두 26개 중 26개가 upsert**였다. 직전 게시와 commit 번호만 제외하고 비교했을 때 신규 또는 전송 값이 달라진 레코드는 매번 16개였다. 10개는 같은 내용이 다시 전달됐다. 네이티브는 전체 순서대로 현재 packet을 모아 적용하므로 브리지 전송 비용과 UI 스레드에 남는 비용은 별도로 확인한다. [새 host 노드](Nelyx/src/framework/rendering/semantics-transport.ts#L435) · [동결 복사](Nelyx/src/framework/semantics/semantics.ts#L1346) · [SDK 게시 생략](Nelyx/sdk/src/runtime/native-interaction.ts#L1336) · [브리지 비교](Nelyx/sdk/src/backends/native-hermes/interaction.ts#L77) · [UI 적용](Nelyx/engine/platform/windows/interop/SemanticsTree.h#L67)

**수정 방향.** 기존 노드는 Windows가 읽는 속성·bounds·부모·순서가 실제로 달라졌는지 판단하고 JS에서는 최신 commit과 action callback을 유지한다. source·편집기 세대 교체, 삭제 후 재생성, viewport reset 시에는 새 수명을 전달한다. 깊은 비교의 추가 비용까지 포함해 전송량과 VM·UI 시간, 표시 간격을 대조한다. [기존 delta 회귀](Nelyx/eng/check-native-semantics-delta.mjs)

## 3. 어느 화면에서 어떻게 구별할 것인가

| 화면 | 비교할 움직임 | 구분할 비용 |
| --- | --- | --- |
| Demo `All components` 와이드 2열 (주 재현 화면) | 창 크기와 DPI를 고정한다. 왼쪽 열에서 섹션 내부 이동·다음 섹션 첫 통과·반전·재방문을 측정하고 오른쪽 열에서도 반복한다. 기준판과 후보판의 시작 섹션과 offset을 열별로 맞춘다. | 열별 실제 이동 간격과 이동량, 새 자식이 없는 프레임과 섹션 실측·텍스트·paint가 추가되는 프레임 |
| Testbed 제품 ListView | 먼저 보이는 행 집합이 유지되는 짧은 이동을 하고, 이어서 연속 하강·반전·재하강한다. 행 선택과 원위치 복귀를 확인한다. | 고정 높이에서의 입력·표시 주기, 첫 생성과 dormant 재사용 |
| Testbed 가변 높이 fixture | 같은 속도와 논리 거리로 한글·여러 줄 행을 첫 통과·재방문한다. 실제로 지난 행 수와 생성·회수량도 적는다. | 고정 높이 대조군에 추가되는 text/layout 비용 |
| 달력 | 공통 수정 후 기존 보통·빠른 정방향·빠른 역방향 입력과 월 정착을 확인한다. | 기존 W8 대비 기능·성능 회귀와 달력 고유의 월 전환 부하 |

Demo의 실제 2열 분기는 그룹 필터가 해제된 상태(`group === null`)에서 레이아웃의 논리 폭 `constraints.maxWidth > 1000`일 때다. 측정 시작 시 두 컨트롤러가 각각 목록에 연결됐는지 확인한다. 입력 좌표는 대상 열의 실제 목록 안에서 정하고, 왼쪽은 `firstScroll`, 오른쪽은 `secondScroll`의 offset을 표시 프레임과 연결한다. 반대 열의 offset도 읽어 어느 열이 움직였는지 검증한다. 초기 Gallery 검사는 창 너비의 22% 지점에 휠을 보내고 `firstScroll`만 읽었다. §7의 와이드 검사에서는 두 열을 개별 지정해 해당 열의 프레임 위치와 반대 열의 정지를 함께 확인했다. [Demo 레이아웃 분기](sample/nelyx-demo-app/src/components.ts#L356) · [열별 컨트롤러 연결](sample/nelyx-demo-app/src/components.ts#L436) · [휠 입력 좌표](Nelyx/eng/windows-jank-input.ps1#L163) · [현재 관측 위치](Nelyx/eng/windows-gallery-probe.ts#L44)

휠 비교는 기존 60Hz 입력을 유지하고, 확장 구간은 **속도가 일정한 약 3초**를 시작점으로 삼는다. 화면 끝의 clamp나 의도적인 정지 시간을 피할 수 있는 거리로 정한다. 같은 입력 수·delta·시작 위치를 전후에 사용하고, 빠른 이동·반전은 별도 구간으로 표시한다. 실제 정밀 터치패드 확인에서는 대상 열 안에서 평소 속도로 스크롤하고 손을 뗀 뒤 감속할 때까지 본다. 접촉·관성·방향 전환을 표시해 해당 장치에서만 나타난 현상도 남긴다. 휠 자동화와 물리 입력 결과는 각각 기록한다.

## 4. 구현 순서

1. **W9-1 · 첫 패치의 유효 범위 확정.** §2.6에서 확인한 새 스냅샷의 과잉 upsert를 첫 후보로 설계한다. 같은 Windows 공급에서 실제 변경 수, 전송 수와 VM·UI 적용 시간을 비교한다. action commit, 가시 항목 bounds·순서, 신규·제거·세대 reset을 보존한다. 별도 후보는 행 경계의 위젯 생성과 다음 프레임의 조기 캡처다. 동일 스냅샷 인덱스 재사용은 실제 긴 프레임이 그 분기에 들어갈 때 선택한다.
2. **W9-2 · 비교에 필요한 관측만 보완.** Gallery probe와 기존 metrics를 확장해 실제 고정 높이 페이지, 지속 입력, 짧은 위치 정체를 다룬다. 기존 50개/480px 검증은 유지하고 새 일정의 기대 개수·합계·최종 offset을 해당 일정에서 유도한다. 기능 fixture는 일정한 30 FPS, 같은 평균에서 교대로 짧고 긴 간격, marker만 바뀌고 offset은 그대로인 경우를 구별해야 한다. 현재 공급과 후보에 같은 관측기를 적용한다. [실행기와 입력 계약](Nelyx/eng/check-windows-jank.mjs#L593) · [기존 probe의 고정 가정](Nelyx/eng/windows-gallery-probe.ts#L83) · [집계 검사](Nelyx/eng/check-windows-jank-metrics.mjs)
3. **W9-3 · 한 원인씩 수정하고 반증.** 첫 패치는 W9-1의 소스 분석에 따라 최소 범위로 적용한다. 수정 전후의 같은 장면에서 예상한 단계가 줄었는지 확인한다. 생산 경로를 추가로 계측할 때는 QPC 입력 번호·viewport 세대·frame ID로 연결한 긴 간격 몇 개와 인접 정상 간격만 비교한다. 가장 먼저 지연된 경계, 뒤 단계가 기다린 시간, 같은 프레임의 행 생성/회수와 GC 여부를 남긴다. 중첩 stage 시간이나 서로 다른 프레임의 p95를 합산하지 않는다. 예측과 다르면 후보를 분리하고 §2의 관측에 맞는 다음 경로로 넘어간다.
4. **W9-4 · 제품 비교와 회귀 판정.** 기준/후보를 같은 기기·모니터 주사율·DPI·창 크기·전원 조건에서 번갈아 각 3회 실행한다. 기본 direct Hermes 최적화 bytecode와 기본 준비 모드를 고정하고 소스→dist→설치 패키지→실행 HBC 및 native host의 버전/해시를 확인한다. CPU 샘플러·상세 추적을 켠 진단과 채택 측정은 분리한다. 기본 앱에서도 화면과 입력을 확인하고 마지막에 달력 회귀를 확인한다.

## 5. 평균 30 FPS에서도 끊기는 경우의 판정

**주 지표는 실제 이동이 관측된 desktop 프레임 사이의 시간이다.** marker가 바뀌어도 같은 scroll offset이면 이동 프레임으로 세지 않는다. 일정 입력 구간에서 표시된 offset 차이와 시간 차이를 짝지어, 같은 자리에 머물다 여러 입력분을 한 프레임에 이동했는지도 본다. 입력 시작 지연, 접촉 중 정속, 반전, 자연 감속, 마지막 입력의 표시 지연은 따로 집계한다. 감속 말단의 작은 이동과 방향 전환 순간을 정속 구간에 섞지 않는다.

| 판단 | 기록과 기준 |
| --- | --- |
| 짧은 끊김 | 구간별 이동 간격 p50/p95/p99/최장과 표본 수, 33.33ms 초과~50ms 및 50ms 초과의 횟수/초를 기록한다. 30 FPS 경계의 반올림에 민감하므로 **예산 초과 시간/초**도 같이 계산한다. 각 이동 간격에서 `max(0, 간격 − 1000/30)`을 합해 활성 초로 나눈다. 기준선에서 증상이 나타난 일반 화면에서는 후보의 3회 중앙값에서 이 값과 이동 간격 p95가 모두 줄고, 짝지은 3회 중 2회 이상 같은 방향이어야 한다. |
| 전체 처리율과 긴 정체 | 두 일반 제품 화면의 각 유효 실행·활성 구간에서 엔진 FPS와 desktop 관측 FPS 하한 각각 ≥30, ≥100ms 프레임 간격 및 이동 정체 각각 0회를 요구한다. p99·최장, >50ms 빈도·총시간, 입력→surface 및 대응 가능한 입력→desktop 지연도 함께 제시한다. 다른 일반 화면이나 빠른 역전에서 같은 악화가 반복되면 채택을 보류한다. |
| 측정 신뢰도 | native 수신·전달량, 부호 있는 합과 절대 이동량, 최종 위치·보이는 행·선택·편집·포커스를 확인한다. 입력 시한 초과나 태그 누락은 무효 사유로 남긴다. 관측기의 샘플 공백과 의심 간격이 겹치면 표시 정체 귀속을 보류한다. marker와 체감이 어긋나면 같은 행의 텍스트·경계가 있는 작은 영역에서 내용 이동을 독립 관측한다. 데스크톱 캡처는 표시 하한이며 패널 scanout은 미확인으로 둔다. |
| 결과 범위 | Demo 와이드 2열은 왼쪽·오른쪽 결과를 따로 적고, 증상이 재현된 열에서 같은 입력의 기준판·후보판을 짝지어 판정한다. 두 열 모두 기준선에서 현상이 드러나지 않으면 사용자 증상의 원인·개선율은 미확정으로 둔다. Testbed 비교 결과, 물리 입력 종류와 사용자 체감, 달력 회귀는 각각 기록한다. |

## 6. 다음 작업의 실행 출발점

아래는 현재 작업 트리에서 지원하는 명령이다. `fixed-list`는 실제 Testbed 고정 높이 페이지를 열고, `-Sustained`는 짧은 초기 이동 뒤 약 3초의 정속 휠 구간을 사용한다. 와이드 Gallery는 `-GalleryColumn left|right -FullRange`로 열을 선택하고, 반대 열의 offset을 검사한다. 루트 PowerShell에서 화면 검사는 하나씩 수행한다. 검사당 제한 20분, 통상 반복 30회 이내로 두고 한 실행의 임시 파일은 종료 시 정리한다. [저장소 지침](.github/copilot-instructions.md) · [사용 가능한 시나리오](Nelyx/eng/check-windows-jank.ps1#L1)

```powershell
# 사용자가 평소 조작하는 기본 Demo
npm.cmd run run:windows --workspace @nelyx/demo

# 기존 짧은 휠 비교와 실제 Testbed의 기능 확인
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -App demo -Runs 1
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario list -App testbed -Runs 1
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario testbed -App testbed -Runs 1

# 공통 경로 비교군인 Testbed 실제 고정 높이 목록
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario fixed-list -App testbed -Sustained -Runs 1

# 공통 패치 이후 달력 회귀
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -App demo -Runs 3
```

## 7. 2026-11-18 빠른 전 구간 비교

요청한 입력은 `-FullRange`로 실행한다. 60Hz에서 휠 한 번당 48 논리 px(초당 2,880px)를 주입하고, 프레임의 실제 위치가 layout 후 `maxScrollExtent`에 닿으면 송신을 중단한다. 실측 섹션 높이가 첫 예상과 달라도 끝까지 진행한다. 같은 창에서 하단→상단→하단까지 반복한다. 각 구간은 반대쪽 끝에서 출발해야 하고, 정착 후 현재 extent와 일치해야 한다. 경계 신호가 송신기에 도달하기 전 추가로 들어온 입력은 수신 장부에 포함하고, 실제 이동 지연은 경계 프레임까지 계산한다. 기존 짧은 휠과 3초 정속 시나리오도 유지했다.

```powershell
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -App demo -FullRange -Runs 1
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -App demo -GalleryColumn left -FullRange -Runs 1
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -App demo -GalleryColumn right -FullRange -Runs 1
pwsh -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario fixed-list -App testbed -FullRange -Runs 1
```

첫 명령은 두 열을 차례로 검사한다. 열별 비교에 사용할 SDK 아카이브가 둘 다 있으면 `node Nelyx/eng/compare-windows-scroll.mjs left <기준-SDK.tgz> <후보-SDK.tgz>`로 세 쌍을 재현할 수 있다. 대상은 `right`, `fixed-list`, `list`도 가능하다. 비교 후 해당 sample Windows runner에는 후보 SDK가 설치되며 실행 전용 패키지는 정리된다.

### Windows 접근성 패킷 후보

Windows Demo, direct Hermes 최적화 bytecode, legacy, 접근성 활성, DPI 192, 주사율 165Hz, 클라이언트 2560×1459 물리 px에서 측정했다. 왼쪽은 0↔1,966.5px, 오른쪽은 0↔1,271.5px였다. 3쌍의 각 구간에서 경계까지 반영된 입력은 왼쪽 41개, 오른쪽 27개이고 반대 열의 위치는 0이었다. 처음의 별도 왼쪽 기준 실행에서 첫 하강 desktop 하한 25.228 FPS, 최장 이동 간격 178.369ms, ≥100ms 이동 간격 2회를 관측했다. 그 실행은 아래 중앙값에서 제외했다.

아래는 각 화면에서 **기준→후보**를 3회 교차한 중앙값이다. 패킷 소스 SHA-256은 기준 `5ee9d7e52402…`, 후보 `62940cef24c1…`, 설치된 JS는 각각 `c551499908d2…`, `de69964633ad…`였다. SDK 두 아카이브의 내용 차이는 브리지와 native-interaction 소스 2개 및 대응 emit/선언/맵뿐이었다. 매 쌍은 새 앱 프로세스에서 실행했다. 패키지를 다시 사용할 때 인벤토리, 실행 파일, HBC, 관측기 해시를 확인했다. 왼쪽 기준/후보 HBC는 `7194eb483bb0…`/`b2721c3fddc8…`, 오른쪽은 `6733d09c6138…`/`ec07e3d8014a…`였다.

| 열·구간 | Desktop FPS 하한 | 실제 이동 간격 p95 (ms) | 30 FPS 예산 초과 (ms/s) |
| --- | ---: | ---: | ---: |
| 왼쪽 첫 하강 | 44.96 → 41.46 | 50.13 → 62.89 | 145.83 → 192.37 |
| 왼쪽 복귀 | 42.72 → 40.88 | 47.58 → 47.55 | 76.64 → 102.63 |
| 왼쪽 재하강 | 46.85 → 43.01 | 47.29 → 47.77 | 59.96 → 61.93 |
| 오른쪽 첫 하강 | 43.31 → 50.08 | 54.68 → 48.85 | 97.77 → 82.62 |
| 오른쪽 복귀 | 45.85 → 51.90 | 48.40 → 46.69 | 32.51 → 58.45 |
| 오른쪽 재하강 | 49.32 → 50.28 | 48.04 → 43.75 | 32.25 → 31.31 |
| Testbed 고정 목록 첫 하강 | 49.74 → 48.71 | 36.35 → 37.82 | 25.16 → 41.25 |
| Testbed 고정 목록 복귀 | 48.91 → 49.49 | 36.99 → 36.83 | 37.98 → 34.24 |
| Testbed 고정 목록 재하강 | 48.44 → 47.95 | 37.44 → 40.97 | 38.78 → 42.44 |

왼쪽 첫 하강의 p95와 초과 시간이 세 쌍 모두 증가했다. 오른쪽 첫 하강은 두 지표의 중앙값이 감소했다. 오른쪽 복귀에서는 예산 초과 시간이 증가했다. 각 실행에서 두 열 모두 편집·테마·크기 변경 후 값 유지 검사를 통과했다. §5의 일반 스크롤 전체 성능 기준은 미충족이다. 입력 시한을 넘긴 시도는 제외했다. 데스크톱 관측기 공백이 겹친 개별 간격의 원인은 미확정이다.

왼쪽 첫 하강에서 엔진 FPS 중앙값은 45.43→44.77, 입력→desktop p95 중앙값은 107.36→107.88ms였다. 실제 이동 간격 p99 중앙값은 91.60→84.62ms로 내려갔지만 50ms 초과는 세 실행 합계 5→10회였다. 가장 긴 한 간격만 비교하면 이 악화를 놓친다. 두 열의 정식 교차 비교에서는 100ms 이상 간격이 없었다.

Testbed는 0↔79,420.5px, 경계 프레임까지 각 방향에 1,655개 입력이었다. 3쌍 18구간에서 엔진·desktop의 100ms 이상 프레임 간격과 이동 정체는 모두 0회였다. 고정 목록 후보 2번째 실행에서 입력이 4.857ms 늦어진 시도를 제외하고 다시 실행했다. 장시간 입력에서 송신기의 파일 확인을 파일 생성 알림으로 교체한 시기가 고정 목록 측정과 겹쳤다. 일부 구간에는 별도 진단 호스트의 공급·컴파일도 겹쳤다. 따라서 이 표의 작은 차이를 패킷 변경만의 효과로 귀속하지 않는다.

### 긴 프레임의 비용

별도 왼쪽 진단에서 첫 하강 19회 게시의 전체 레코드 수 합은 620, 실제 upsert 합은 390이었다. 가장 긴 Scene은 1,152px에서 72.96ms였다. layout 52.71ms 안에 새 슬롯 1개의 생성 36.79ms가 포함됐고 Element 빌드 완료는 569회였다. 같은 프레임에서 semantics 7.88ms, 뒤이은 commit 18의 VM 브리지 호출은 0.14ms였다. 528px에서도 새 슬롯 1개/빌드 255회/생성 22.81ms였다. 재하강에서는 슬롯 생성 없이 paint 22.33ms인 프레임도 있었다. 계측 오버헤드를 포함하는 개별 CPU 프레임이다.

### 새 캡처의 순회 공유와 Windows UI 적용 확인

Core는 접근성 트리를 검증·동결하는 동안 전위 순서의 노드 배열을 한 번 만든다. 루트와 SDK는 같은 검증된 배열을 읽고, 바인딩은 해당 게시의 좌표를 처음 요청할 때 ID별로 인덱싱한다. 호출자가 직접 전달한 가변 트리의 좌표는 게시 시점에 복사한다. 중첩 순서, 문자열·숫자 ID와 View 별칭, 이전 게시의 제거, 원본 변경 후 격리, Windows action 교체·수명 회귀를 검사했다.

동일한 계측용 C++ 코드에서 패치 전 SDK와 최신 Core/SDK로 왼쪽 전체 하강을 각각 진단했다. 패치 전은 게시 15회·전체 순서 497개·upsert 357개, 최신은 게시 18회·전체 순서 575개·upsert 353개였다. 각 게시 VM 브리지 호출 p95는 0.310→0.325ms, UI 적용 p95는 0.532→0.614ms였다. 게시 횟수가 달랐으며 전송 수 감소를 UI 시간 감소로 판정할 수 없었다.

최신 진단의 1,152px 프레임은 왼쪽 7번 슬롯인 `Text fields`가 처음 들어온 시점이었다. Element 빌드 완료 609회, 슬롯 생성 37.49ms, 이를 포함한 layout 57.62ms, 전체 Scene 82.45ms였다. 같은 viewport·프레임의 commit 18은 노드 32개 중 24개를 전송했다. VM packet 읽기 0.138ms, UI 큐 대기 0.045ms, UI 적용 0.236ms였다. 새 섹션을 만들 때의 attach 검사 258회는 1.24ms, layout 변경 허용 검사 632회는 1.53ms였다. 이 개별 검사만 없애도 처음 나타난 수십 ms를 해소할 수 있다는 근거는 없다.

### 와이드 섹션 보존 후보

최신 Core/SDK를 고정하고 Demo 와이드 목록에서 기존 수명 정책과 열별 dormant 슬롯 4개 보존을 3쌍 교차 측정했다. 편집기 keep-alive와 GlobalKey 자격 검사는 그대로 사용했다. 양쪽 끝과 반대 열 정지, 편집 값 유지를 확인했다. 표의 순서는 기본→보존 후보다.

| 왼쪽 구간 | Desktop FPS 하한 중앙값 | 이동 p95 중앙값 (ms) | 예산 초과 중앙값 (ms/s) |
| --- | ---: | ---: | ---: |
| 첫 하강 | 39.02 → 43.03 | 59.94 → 49.89 | 174.99 → 147.57 |
| 복귀 | 43.39 → 37.94 | 61.13 → 60.62 | 141.97 → 139.72 |
| 재하강 | 41.06 → 45.95 | 47.04 → 45.13 | 57.84 → 38.71 |

보존 후보의 첫 하강 p95와 초과 시간은 세 쌍 모두 감소했다. 그러나 첫 실행에서 하강 157.42ms, 복귀 122.29ms의 표시 이동 간격이 발생했고 복귀 처리율 중앙값도 낮아졌다. §5 기준에 따라 이 후보는 제품에 적용하지 않았다. 최신 기본 정책에서도 첫 실행 첫 하강 24.59 FPS, ≥100ms 이동 간격 2회를 관측했다. 일반 스크롤 성능 판정은 `performanceAccepted=false`다. 해당 비교에 앞서 전경을 잃은 데스크톱 캡처 1회는 무효로 제외했다.

### 제품 기능 및 회귀

최신 Core와 SDK를 Demo 및 Testbed Windows runner에 공급했다. Core 접근성 소스/emit `82622f6351ad…`/`291efc1f9e80…`, SDK native-interaction emit `89fa2dc3094d…`, native host 소스 `80815c6b1af3…`의 설치본 바이트를 확인했다. 기본 Demo에서 왼쪽은 Common buttons에서 Text fields로, 오른쪽은 Icon buttons에서 이미지의 Extract colors까지 이동했다. 두 열 모두 복귀 시 처음 보이던 항목의 이름과 화면 좌표가 일치했고 반대 열도 유지됐다.

Testbed 목록에서 행 클릭 후 선택 해제 버튼은 활성화됐지만 Windows 접근성 트리에서 선택 결과 텍스트를 독립적으로 조회할 수 없었다. 화면에 이미 표시하던 선택 상태에 접근성 노드와 식별자를 부여했다. 실제 Windows에서 스크롤 후 8번 행을 눌러 `선택: 항목 0008`을 읽고 선택 해제를 확인했다. MixedScroll 한글·이모지 편집과 카운터 동작도 통과했다.

최신 고정 목록 첫 하강/복귀/재하강의 desktop FPS 하한은 46.19/46.23/45.71, 가변 높이 fixture는 54.36/52.05/52.43이었다. 가변 높이 목록의 범위는 0↔85,302.5px였다. 두 목록에서 모두 첫 행과 1,000번째 행의 UIA 노출, 되돌린 뒤의 목록 구성, 여섯 구간의 ≥100ms 간격과 진행 정체 0회를 확인했다. 달력 및 물리 입력을 포함한 성능 채택과는 별도 결과다.

달력은 새 프로세스 3회 모두 Win32 가상 터치 48/30/60개를 받고 +4/+3/−6개월에 정착했다. 보통 정방향/빠른 정방향/빠른 역방향의 desktop FPS 하한 중앙값은 28.42/23.64/15.85로, W8 마지막 기록 31.72/25.33/20.63보다 낮았다. 빠른 역방향의 ≥100ms 표시 진행 정체는 실행별 8/6/7회였다. 달력의 성능 기준도 미충족이며 W8과 이번 달력 실행은 교차 측정하지 않았다. [W8 달력 비교](work8.md#L183)

일반 Demo HBC는 `5653cd0218703ba6…`였다. 두 열 왕복 및 편집·테마·크기 변경 후 기본 실행 호스트는 입력 230개 모두 전달·수락, 거절 0개, 종료 코드 0을 반환했다. 같은 제품 HBC에서 Windows UIA TextPattern으로 편집 문자열의 첫 글자 경계를 조회했다. 창 크기·테마 변경 전 (120, 748, 18, 46)에서 변경 후 (149, 789, 18, 46)으로 바뀌었고 두 경우 모두 현재 편집기 안이었다.

Windows 패킷 교차 비교의 native 소스는 같았고 다시 빌드한 두 exe의 해시는 달랐다. 확인 시점의 전원 구성은 균형 조정·외부 전원 상태였고 실행별 전원 전환 기록은 없다. 물리 정밀 터치패드, 패널 scanout, 실제 IME 후보 창 위치, 긴 프레임에서의 GC 기여율은 미확인이다. 남은 주요 비용은 왼쪽 `Text fields` 섹션 최초 mount와 일부 재방문 프레임의 paint다.

기존 짧은 Gallery와 가변 목록 검사도 각각 통과했다. 각 구간에서 휠 50개와 480px 이동, 복귀·재하강, 정상 종료를 확인했다. Core/SDK 빌드, Testbed 타입 검사, 접근성 delta·구성·geometry 24케이스와 스크롤 지표 fixture를 검증했다.
