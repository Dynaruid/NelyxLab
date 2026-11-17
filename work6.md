# Nelyx 공통 프레임워크 FPS·버벅임 개선 계획

작성일 2026-11-18 · 기준선 `3c2b4335` · 상태 **W6-1~4 구현 및 검증 완료 / 부분 개선 / performanceAccepted=false**

## 1. 목표와 우선순위

Windows Demo의 활성 스크롤·애니메이션에서 **평균 30fps 이상과 100ms 이상 진행 정체 0회**를 함께 목표로 한다. 50ms를 넘는 프레임의 빈도와 입력 지연도 줄인다. 달력은 중첩 PageView·GridView·Focus·텍스트·접근성이 동시에 작동하는 부하 화면이다. 공통 경로의 이득과 회귀는 Gallery, Testbed 가변 목록과 혼합 화면에서도 확인한다.

**첫 수정은 Sliver의 필수 자식 생성·연결·회수에서 반복되는 순회와 목록 생성이다.** 이어서 움직일 때마다 실행되는 layout에서 현재 자식 배치를 재사용할 수 있는 범위를 좁혀 적용한다. 남은 긴 프레임에 대해서는 준비된 자식의 승격·실제 layout·회수 중 어느 일이 큰지 확인한 뒤 해당 경로를 줄인다. 각각 코드와 호출 계약을 확인하고 수정한 뒤 Source 회귀와 제품 실행으로 검증한다.

## 2. 현재 코드에서 확인한 비용

### 2.1 스크롤의 필수 layout에 자식 수명 작업이 들어간다

월이 바뀌면 달력 State가 갱신되며 PageView가 전달하는 delegate 변경은 Sliver의 기존 자식 갱신을 예약할 수 있다. `didStartLayout`은 해당 BuildScope와 render 연결을 비운다. 이후 Grid·고정 extent Sliver는 필요한 인덱스 범위에서 이탈한 자식을 회수하고, 누락된 자식은 layout callback 안에서 delegate 호출부터 build·연결까지 완료한 뒤 `child.layout`을 호출한다. 달력 월 한 장에는 날짜·요일·빈 칸을 담은 GridView가 있으므로 한 번의 PageView 경계 진입에 여러 슬롯의 생산과 회수가 겹칠 수 있다. [월 변경](packages/material/src/generated/date/calendar_date_picker.generated.ts#L1284) · [날짜 GridView](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2012) · [Sliver build·연결](Nelyx/src/framework/widgets/sliver.ts#L494) · [Grid layout](Nelyx/src/framework/rendering/sliver-grid.ts#L365) · [고정 extent layout](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts#L184)

현재 구현에서 바로 제거를 검토할 수 있는 반복은 두 가지다.

- **삽입 위치 재검색.** RenderSliver는 현재 앞 자식 `after`를 `createChild`에 넘긴다. Element는 이를 검사한 뒤 렌더 삽입에서 `precedingBox`로 처음부터 다시 찾는다. 끝에 자식을 하나씩 추가하면 이 검색만으로 앞선 자식들을 반복 방문한다. RenderSliver 자체의 배열 변경·검사 비용은 별도로 남는다. [RenderSliver의 호출](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts#L347) · [Element의 삽입 위치 검색](Nelyx/src/framework/widgets/sliver.ts#L596)
- **자식 목록 재구성.** `SliverChildStore`에는 구조 revision별 정렬 결과 캐시가 있다. 자식이 하나씩 추가·삭제되면 매번 새 revision이므로 `syncElementChildren`은 목록 복사·정렬·투영을 할 수 있다. 같은 revision의 빠른 경로에도 부모 일치 검사가 있다. 이 검사는 키 이동과 재진입에 의미가 있어 제거하려면 그 경우까지 포괄하는 소유권 확인이 필요하다. render owner 중복 등록 방지는 이미 `Set`으로 처리한다. [자식 저장소](Nelyx/src/framework/widgets/sliver.ts#L61) · [목록 투영](Nelyx/src/framework/widgets/sliver.ts#L362) · [owner commit](Nelyx/src/runtime/owner-transaction.ts#L15)

### 2.2 준비가 끝나도 실제 layout과 게시 비용이 남는다

`SubtreePreparation.ready`는 Element 생산과 연결을 준비했다는 뜻이다. 승격 시 실제 부모·PipelineOwner로 옮기며 attach/detach는 layout을 dirty로 만들고 기존 측정 상태를 무효화한다. 다음 실제 layout에서 제약과 크기를 확정하고, Root는 paint·입력 geometry·semantics·수명 종료와 CPU frame capture를 완료한다. 이전 진단의 layout 구간에는 그 안에서 실행된 자식 생산과 회수도 포함되므로 실제 `performLayout`의 몫은 호출 경계를 좁혀 확인해야 한다. [준비 완료·승격](Nelyx/src/framework/widgets/subtree-preparation.ts#L102) · [RenderObject attach](Nelyx/src/framework/rendering/object.ts#L1989) · [Root layout](Nelyx/src/framework/widgets/root.ts#L668) · [회수·capture](Nelyx/src/framework/widgets/root.ts#L1126)

이미 살아 있는 자식은 dirty 상태가 아니고 제약이 같으면 `RenderObject.runLayout`에서 반환한다. 그 경우에도 Sliver는 인덱스별 geometry·제약·배치를 다시 계산한다. 고정 extent에서 자식 범위와 배치 입력이 모두 같으면 이 루프에서 반복되는 계산을 줄일 수 있다. 달력 안쪽 Grid의 delegate는 `getLayout`에서 `MediaQuery`의 배율·화면 방향과 테마를 읽으므로 타입이나 화면 크기만으로 그 결과를 재사용할 수 없다. [clean layout 확인](Nelyx/src/framework/rendering/object.ts#L1626) · [SliverGrid 루프](Nelyx/src/framework/rendering/sliver-grid.ts#L365) · [달력 Grid delegate](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2248)

### 2.3 이전 실행에서 남은 증상

`work5.md` §15의 단일 Hermes 진단에서는 선행 finite child 162개, 필수 cold 요청 15회 중 준비 cursor 채택 3회를 관측했다. 선택 준비는 총 501.357ms였고 가장 긴 slice는 9.725ms였다. 빠른 역방향에서는 엔진 FPS 20.568, layout 최장 177.683ms, 입력→surface p95 430.433ms였다. 진단 당시 desktop 관측은 꺼져 있었다. §17에서는 접근성 geometry 누락 수정과 달력 기본 기능을 확인했다. 두 기록은 현재 코드의 수정 우선순위를 정하는 데 쓰고, 비교는 새 기준선에서 시작한다. [준비 진단](work5.md#L497) · [접근성 수정](work5.md#L551)

이전 기본 공급에서는 Gallery와 Testbed 가변 목록의 각 3회에서 100ms 이상 진행 정체가 0회였다. 이 화면들은 달력의 cold 생산과 다른 부하를 제공하므로 성능 회귀 확인에 사용한다. [Gallery·가변 목록 기록](work.md#L597)

direct Hermes의 `RuntimeLoop`는 VM 작업 하나를 끝낸 뒤 다음 작업을 시작한다. 긴 필수 프레임은 뒤에 들어온 입력 전달도 늦출 수 있다. 현재 진단의 input queue 지표는 입력 시각부터 native의 JS 전달 시작까지다. JS 전달 뒤의 입력 대기와 renderer admission·surface fence 대기는 각각 해당 시각이 있어야 계산할 수 있다. 빠른 역방향은 정방향의 두 배 제스처를 보내므로 개선률은 같은 구간끼리 비교한다. [native 실행 루프](Nelyx/sdk/native/windows-hermes/RuntimeLoop.h#L27) · [View 입력과 frame 처리](Nelyx/src/hosting/runtime.ts#L959) · [입력 지연 집계](Nelyx/eng/windows-jank-probe.ts#L218) · [입력 계획](Nelyx/eng/check-windows-jank.mjs#L220)

## 3. 단계별 구현

### W6-1 삽입·회수의 반복 순회를 줄인다

1. 현재 `createChild(index, { after })`가 이미 가진 삽입 위치를 해당 슬롯의 렌더 삽입까지 사용한다. 같은 Sliver의 실제 활성 자식이고 현재 앞뒤 관계가 그 슬롯과 맞을 때 사용한다. 빈 목록과 맨 앞 삽입도 실제 위치로 확인한다. 내부 scope가 끝나거나 오류가 나면 위치 정보를 해제한다. key 이동, keep-alive 복귀, 순서 변경, 재진입으로 위치가 달라졌을 때는 기존 검색을 사용한다.
2. `SliverChildStore`의 기존 revision을 첫 근거로 삼아 순서가 확정된 단일 끝 삽입·삭제에서 정렬이나 전체 목록 변환이 필요한지 확인한다. `finishQueuedChildren` 전후의 투영이 이미 유효하면 재구성을 건너뛴다. key retake, 대체 슬롯, offstage prototype, parent 변경에는 기존 투영을 수행한다. builder·`didStartLayout`·`didFinishLayout`·Element 수명 callback의 호출 순서와 각 callback에서 보이는 자식 순서는 보존한다. [기존 투영·회수](Nelyx/src/framework/widgets/sliver.ts#L494)
3. 기존 fixture에 경계 삽입·연속 회수, keyed reorder, 빈 슬롯과 underflow, keep-alive, GlobalKey retake, delegate 예외 뒤 정리·다음 frame을 확인하는 필요한 사례를 보강한다. 동일 슬롯·동일 순서·동일 수명 결과를 확인한 뒤, 연속 삽입에서 선행 검색 방문과 목록 재구성 횟수가 줄었는지 확인한다. [child reconciliation](Nelyx/eng/check-child-reconciliation.mjs) · [Source framework](Nelyx/eng/check-source-framework.mjs)

### W6-2 움직이는 동안 이미 끝난 자식 layout 결과를 재사용한다

1. 첫 대상은 양의 고정 extent를 쓰는 `RenderSliverFixedExtentList`와 `RenderSliverFillViewport`다. 기존 child-manager 시작 작업 후 실제 활성·cache 범위와 자식 순서, 축·방향·extent·제약, dirty 자식·대기 callback 조건을 확인한다. 연속 offset 변화에서 배치 입력이 동일한 구역만 기존 자식의 `layoutOffset`과 box layout 결과를 사용한다. 자식 추가·이동·dirty 요청은 재사용 자격을 무효화한다. 이 확인을 위해 전체 자식 목록을 다시 만들 필요가 있으면 비용을 비교한 뒤 적용 범위를 좁힌다. [고정 extent 제약](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts#L25) · [FillViewport](Nelyx/src/framework/rendering/sliver-fill.ts#L11)
2. 새 제약과 scroll offset으로 paint/cache extent·overflow·가시 범위를 계산한다. 시작·종료 callback, scroll correction, 자식 dirty layout, hit test·UIA·IME가 보는 geometry는 기존 계약을 따른다. focus reveal, viewport resize·DPI·locale·RTL 변경, pinned/kept-alive 자식 변동과 사용자 정의 extent callback이 있는 경로는 일반 layout으로 검증한다. [Viewport 제약·보정](Nelyx/src/framework/rendering/viewport.ts#L757) · [geometry 게시 회귀](Nelyx/eng/check-semantics-geometry.mjs)
3. 반복 계산 감소가 같은 Source fixture에서 확인되면 Grid로 확대한다. 기존 `getLayout` 호출을 거쳐 얻은 규칙 타일 geometry의 입력과 당해 frame의 layout 조건이 일치하는 구역을 먼저 다룬다. 달력의 방향·텍스트 배율·테마 변경과 사용자 delegate를 fixture에 포함한다. 변경된 clip·semantics membership은 현재 frame에서 계산한다. [Grid delegate 계약](Nelyx/src/framework/rendering/sliver-grid.ts) · [게시 순서 회귀](Nelyx/eng/check-frame-publication.mjs)

### W6-3 남은 긴 프레임에서 실제 작업량이 큰 구역을 줄인다

W6-1·2의 국소 검증 후 현재 공급에서 제한된 진단으로 다음 수정 구역을 고른다. 기존 frame token으로 자식의 build/commit, 승격·attach, 실제 layout, deactivate/unmount, paint/composition, geometry/semantics, capture·admission·surface를 연결한다. layout 내부의 하위 시간은 부모 구간에 포함된 값으로 기록한다. 가장 긴 프레임에서 신규·갱신·회수 슬롯 수, 실제 `performLayout` 호출 수, viewport 보정 횟수와 입력 대기 시작점을 확인한다. `split`을 쓰면 준비 시작·채택·취소 시간과 준비 tick의 CPU 비용도 포함하고 채택 여부를 인덱스·세대별로 확인한다. [기존 frame 진단](Nelyx/src/ui/frame-diagnostics.ts) · [달력 지표](Nelyx/eng/windows-jank-probe.ts)

| 진단에서 큰 구역 | 다음 소스 수정 |
| --- | --- |
| **필수 cold layout** | 실제 Grid layout이 정한 규칙 타일에서 같은 폭·높이의 불변 제약을 공유한다. 텍스트가 크면 `RenderRichParagraph`와 `TextPainter`를 따라 최초 paragraph 설정, 서비스 캐시 hit, width 변경에 따른 실제 native 요청을 확인한다. 동일 문단에서 반복 요청이 확인되면 기존 `TextPainter` 결과 또는 서비스 캐시로 통과하는 경로를 우선 고친다. 긴 최초 요청은 실제 폭을 사전에 확정할 수 있는 내부 박스에 한해 현 준비 기회에서 기존 캐시를 채우는 후보로 삼는다. 폰트 세대·width·locale·배율·방향·스타일이 달라지면 현재 표준 layout을 사용한다. 사용자 layout callback과 attach/detach 순서를 보존한다. [문단 layout](Nelyx/src/framework/rendering/paragraph.ts#L587) · [TextPainter](Nelyx/src/framework/painting/text-painter.ts) · [텍스트 캐시](Nelyx/src/hosting/text-layout-cache.ts) |
| **승격·회수 또는 선택 CPU** | `_adoptPreparedParent` 재귀 순회와 render attach, 준비 scope 회수, 일반 `finalizeTree`에서 이미 알고 있는 소유권·슬롯 정리를 다시 계산하는 곳부터 줄인다. 준비 낭비가 크면 delegate/크기 변경·방향 전환에서 무효가 된 세대를 식별하고 조기에 취소한다. 현재 단일 준비 세대와 Element/resource 예산 안에서 실측 원자 작업이 deadline 여유를 넘길 때 다음 기회로 넘긴다. 실제로 필요한 경우에는 같은 cursor를 동기로 완결하고 원래 lifecycle을 한 번 수행한다. [BuildOwner 준비](Nelyx/src/framework/widgets/framework.ts#L473) · [Sliver 준비 후보](Nelyx/src/framework/widgets/sliver.ts#L751) |
| **paint·semantics 또는 admission** | 기존 retained paint에서 같은 도형의 위치 이동이 전체 재기록을 일으키는지 확인한다. 이동만 확인된 경우 현재 transform과 접근성 geometry를 갱신하는 기존 경로를 사용한다. 접근성 구성·가시 자식·포커스·IME가 바뀐 frame은 원래 게시 경로를 사용한다. CPU frame이 짧아진 뒤에도 입력·GPU 대기가 지배하면 native 큐와 View credit의 겹침을 먼저 추적하고 admission 변경은 독립 비교한다. [기존 geometry 무효화](Nelyx/src/framework/rendering/object.ts#L2169) · [Runtime admission](Nelyx/src/hosting/runtime.ts#L718) |

가장 큰 구역의 첫 후보에서 제거되는 호출이나 반복 작업을 Source로 증명하고 구현한다. 복잡한 재사용 조건 때문에 제거 가능한 범위가 작거나 유지 비용이 더 크면 해당 후보의 결과를 기록하고 같은 진단에서 확인된 다음 구역으로 이동한다. 준비용 wet layout 전체를 복사하는 방식은 attachment·의존성·리소스 계약을 만족하는 근거가 생겼을 때 별도 설계한다.

### W6-4 실제 공급과 제품에서 비교한다

기준선은 이 문서의 검토 revision을 사용한다. 변경을 모은 뒤 정규 Core 빌드·공급으로 Demo/Testbed의 설치 입력을 갱신한다. 기준선과 후보의 Source·dist·설치 package·실제 실행 bundle을 확인한다. 동일한 Windows direct Hermes bytecode, host/renderer/VM, viewport/DPI/refresh, 전경 조건과 입력을 사용한다. 기본 `legacy`의 변경 전후를 비교하고, 준비 경로를 변경했으면 양쪽에서 `split`을 선택한 비교도 수행한다. 진단과 계측 환경 변수를 끈 실행으로 제품 성능을 판정한다. [Windows 실행·공급](sample/nelyx-demo-app/README.ko.md#L49) · [성능 실행기](Nelyx/eng/check-windows-jank.ps1)

## 4. 검증과 수락

| 검증 | 확인할 동작 |
| --- | --- |
| Source | 슬롯/키/keep-alive, dirty queue와 재진입, 크기·스크롤 보정, old frame 불변, seal→geometry→semantics 게시, GPU busy에서의 강제 query, 취소·close·오류 후 lease 회수 |
| Windows 달력 | 보통 정방향·약 2배 정방향·약 2배 역방향 각각 기존 60Hz touch 48/30/60개, 제스처 6/6/12회, 정착 월 이동 +4/+3/−6을 유지. 첫 열기·복귀·빠른 방향 전환, 날짜 선택·disabled 날짜, focus·UIA, locale/범위·resize·재열기·정상 종료 확인 |
| 공통 시나리오 | Gallery와 Testbed 가변 목록의 cold/return/warm, Testbed 혼합 스크롤·입력·리스트의 기능, Web Gallery 스크롤·resize·한글/이모지 편집·달력 왕복 확인. 그 화면에서 이미 정체가 없었던 경우 0회를 유지 |
| 수명 | 왕복·취소·resize·close에서 active/detached Element, 선택 준비와 resource/lease, 소유 timer가 회수되는지 확인. 공용 renderer 자원은 실제 drain 뒤에 판정 |

**성능 판정.** 달력 동일 조건 변경 전후 각 3회의 유효 실행을 사용한다. 각 후보 실행의 각 활성 구간에서 native surface fence의 엔진 FPS와 desktop frame tag 관측 FPS 하한이 각각 **30 이상**, **100ms 이상 프레임 간격과 실제 진행 정체가 각각 0회**여야 한다. 목표에 미달했던 구간은 기준선 대비 FPS 상승과 50ms 초과 간격의 빈도·총 시간 감소를 확인한다. 프레임 간격 p95/p99/최장과 입력→surface p95/p99/최장을 함께 비교하고 Gallery·가변 목록의 기존 구간에도 일관된 회귀가 없어야 한다. 개선을 관측한 구간이 있어도 수락 조건이 남아 있으면 **부분 개선 / performanceAccepted=false**로 기록한다. [기존 목표](work.md#L277) · [프레임 집계](Nelyx/eng/windows-jank-metrics.ts)

측정 구간은 첫 입력부터 최종 이동과 입력이 반영된 frame까지다. 실제 입력 큐 대기·준비 miss·최종 fence 대기를 포함하고, 의도된 무이동·경계는 같은 조건을 양쪽에 적용한다. 전경 상실·주입 cadence 오류·화면 관측 누락은 원인을 확인해 유효 표본을 확보한다. 입력을 정상 주입했는데 월 정착·입력 보존·최종 surface가 실패하면 제품 회귀로 기록하고 수정 뒤 다시 검증한다. desktop 관측은 marker의 샘플링 하한이다. 물리 trackpad와 실제 화면 scanout의 수락은 직접 관찰 범위가 있을 때 기록한다.

### 실행 명령

아래 명령을 저장소 루트에서 PowerShell 7로 실행한다. 성능 명령은 해당 비교용 Source와 설치 공급을 준비한 뒤 실행한다.

```powershell
npm.cmd run build:core
npm.cmd run check --workspace @nelyx/core
node Nelyx/eng/check-child-reconciliation.mjs
node Nelyx/eng/check-source-framework.mjs
node Nelyx/eng/check-frame-publication.mjs
node Nelyx/eng/check-frame-publication.mjs --subtree-preparation
node Nelyx/eng/check-semantics-geometry.mjs
node Nelyx/eng/check-retained-paint.mjs
node Nelyx/eng/check-windows-input.mjs

pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -Preparation legacy -Diagnostic -Runs 1 -NoScreen
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -Preparation legacy -Runs 3
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -Preparation split -Runs 3
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -Runs 1
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -App testbed -Scenario list -Runs 1
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -App testbed -Scenario testbed -Runs 1
npm.cmd run run:windows --workspace @nelyx/demo -- -- 10000
npm.cmd run build:web --workspace @nelyx/demo
node Nelyx/eng/check-source-web.mjs
```

검증마다 20분 timeout을 적용하고 앱 실행은 정상 종료까지 확인한다. Windows 전체 실행은 진단 최대 3회, 달력 기본 비교 6회와 조건부 준비 비교 6회, Gallery/목록 전후 4회, Testbed 혼합 1회, 최종 일반 1회 및 원인 수정·무효 표본 보완 4회로 최대 25회를 계획한다. 임시 경로는 실행에 필요한 소유 범위에서 만들고 `finally`에서 정리한다. 현재 dist를 유지하고 이 문서에 비교 범위·결과·잔여 항목을 남긴다. [저장소 검증 규칙](.github/copilot-instructions.md)

## 5. 완료 체크리스트

- [x] W6-1에서 제거한 반복과 자식 순서·수명 회귀 결과를 기록했다.
- [x] W6-2에서 배치 재사용의 자격과 resize·입력 geometry·접근성 전환을 확인했다.
- [x] W6-3에서 긴 frame에 남은 실제 작업을 짚었고, 선택한 수정의 동기 비용·선택 CPU·회수 비용을 확인했다.
- [x] 현재 공급에서 FPS·정체·입력 지연·기능·자원 수락 조건을 판정했고, 일반 CLI 실행과 정상 종료를 확인했다.

## 6. 구현과 Source 확인

- **W6-1** 필수 슬롯은 실제 활성 체인의 revision과 앞뒤 인덱스가 맞을 때 레이아웃이 전달한 선행 자식을 사용한다. 범위를 벗어나거나 render 순서가 바뀌면 기존 검색을 사용한다. Element 투영은 store revision과 자식 분리 revision을 함께 확인하고 끝 삽입·회수를 반영한다. 키 재배치, GlobalKey retake, prototype 자식과 일반 투영 경로를 유지한다. [Element](Nelyx/src/framework/widgets/sliver.ts) · [render adaptor](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts)
- **W6-2** 고정 extent와 FillViewport에서 크기·방향·활성 슬롯·자식의 현재 배치가 모두 같은 범위에 한해 기존 layout 결과를 쓴다. Grid는 매번 delegate의 layout 결과를 받아 규칙 타일의 수치와 방향을 확인한다. dirty 자식, 대기 layout callback, 사용자 정의 box layout 및 타일 geometry, 비연속 범위에서는 일반 경로가 실행된다. 현재 offset으로 paint/cache extent와 가시성을 계산한다. [고정 extent](Nelyx/src/framework/rendering/sliver-fixed-extent-list.ts) · [Grid](Nelyx/src/framework/rendering/sliver-grid.ts)
- **W6-3** 단일 슬롯은 같은 Element 조정 로직을 직접 호출해 입력·출력 배열의 생성을 줄인다. 사용자 정의 조정은 기존 배열 호출을 유지한다. 규칙 Grid가 처음 배치할 때 각 타일의 폭·높이가 같으면 불변 박스 제약을 공유한다. `split`은 방향·축·delegate·대상 슬롯의 자격을 확인하고 무효가 된 준비를 취소한다. 취소 시 준비 root를 먼저 회수하고 남아 있는 Element를 정리한다. [Element 조정·회수](Nelyx/src/framework/widgets/framework.ts) · [준비 자격](Nelyx/src/framework/widgets/sliver.ts)

연속 슬롯 fixture는 최초 delegate 예외 뒤 앞선 자식의 보존과 다음 layout의 복구, 콜백이 관측한 순서, 양쪽 경계의 회수, 키 이동, GlobalKey retake, keep-alive 복귀와 underflow를 확인했다. 연속 삽입의 선행 검색 방문 수는 0이었고, 이미 배치된 범위에서 고정 extent와 규칙 Grid의 적용 제약 검증은 0회였다. 4개 타일의 첫 layout은 불변 제약 객체 1개를 사용했고, 사용자 정의 타일 layout은 각각의 제약을 받았다. Grid delegate의 실제 layout과 scroll extent estimate 호출을 모두 확인했다. [Source 회귀](Nelyx/eng/check-child-reconciliation.mjs)

### W6-3 긴 프레임 진단

W6-1·2 공급의 Windows direct Hermes 진단에서 frame token으로 자식 생성·갱신·회수, 실제 layout, 입력, surface fence를 연결했다. 보통·빠른 정방향·빠른 역방향 중 필수 자식 생산이 겹친 역방향 frame이 가장 길었다. 아래 수치는 서로 다른 단일 진단이며, 포함 시간은 합산하지 않는다.

| 진단의 역방향 최대 layout frame | layout / 필수 자식 확보 (ms) | 슬롯 생산·갱신·회수 | 실제 Box layout 호출 | 주요 하위 구간 |
| --- | ---: | ---: | ---: | --- |
| `legacy`, frame 183 | 191.441 / 139.926 | 81 / 2 / 2 | 646 | box 자체 18.449ms, Grid 제약 83회 0.196ms, 텍스트 서비스 74회 모두 캐시 hit, finalize 18.724ms |
| `split`, frame 179 | 217.502 / 147.869 | 81 / 2 / 2 | 646 | dirty rebuild 2,136회 136.760ms, deactivate 14.985ms, finalize 28.209ms |

진단은 viewport의 평상시 양쪽 layout 시도도 기록했다. 두 최대 frame에서 scroll offset correction은 0회였다. 역방향 `legacy` 최대 layout frame에 연결된 입력은 native 도착부터 JS 전달까지 7.516ms, 전달 이후 layout 시작까지 0.281ms, 도착부터 해당 surface fence까지 281.704ms가 걸렸다. 이 원인 분해를 근거로 필수 슬롯 생산과 준비 회수를 줄였다. 해당 frame의 모든 텍스트 요청은 캐시에 적중했다.

`split`의 W6-1·2 진단은 준비 시작 7회·게시 3회·취소 4회, 선택 작업 342 slice·537.527ms를 기록했다. 필수 cold 16회 중 준비 cursor를 3회 채택했고, 그중 동기 완결 1회에 31.660ms가 들었다. 최대 slice는 4.630ms다. 준비 후 닫기에서 활성 세대·남은 Element·resource producer는 0이었다. [frame별 계측](Nelyx/eng/windows-jank-framework-profile.ts)

최종 `split` 진단에서 131·135·136번 슬롯의 준비 세대를 각각 채택했다. 132번 슬롯의 후속 세대 4개는 방향 전환 이후의 기능 검사와 종료에서 모두 회수했다. 역방향 최대 layout은 frame 182의 202.632ms였다. 슬롯 생산·갱신·회수는 77·2·2개였고, dirty rebuild 2,108회의 배타 시간은 114.932ms, deactivate 두 번은 47.230ms였다. 이후 `finalizeTree`에 25.137ms, paint에 11.857ms, semantics에 26.995ms가 들었다. Box layout 638회 중 날짜 Grid의 타일 제약 생성은 2회였고, 텍스트 요청 74회는 캐시에 적중했다. 선택한 입력은 native 도착부터 JS 전달까지 11.666ms, 도착부터 해당 surface fence까지 317.290ms였다. 진단 계측 비용이 포함되므로 실행 간 프레임 소요 시간의 비교는 §7의 일반 표본을 사용한다.

## 7. Windows 성능 비교

동일 direct Hermes bytecode, 엔진 revision `b464dba92ad87bcfb77fae381a49a2394d9836d9`, 물리 client 2560×1459, DPI 192, refresh 165Hz에서 60Hz 가상 touch를 주입했다. 계측 profile을 끈 실행에 기존 surface fence와 합성 desktop marker 관측을 적용했다. 기준선 `legacy` 1회에서 입력을 모두 수락했지만 첫 정방향이 +3개월에 정착했다. 계획의 +4개월을 충족한 보완 표본을 사용했다. 표의 FPS와 간격·지연은 각 3회에서 중앙값을 산출했다. ≥100ms 진행 정체에는 실제 활성 구간 내 frame별 위치 변화가 사용된다.

### 기본 `legacy`

| 활성 구간 | 엔진 FPS | desktop FPS 하한 | 엔진 >50ms 간격 횟수 / 총 ms | 엔진 ≥100ms 진행 정체 범위 | desktop ≥100ms 진행 정체 범위 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 정방향 100ms | 30.32 → 33.89 | 30.16 → 30.98 | 8 / 977.0 → 9 / 965.3 | 7 → 7 | 6–7 → 6–7 |
| 정방향 50ms | 27.25 → 29.37 | 23.89 → 25.53 | 7 / 859.1 → 6 / 763.9 | 5 → 4–5 | 5 → 4–5 |
| 역방향 50ms | 20.45 → 17.63 | 19.80 → 14.81 | 8 / 1,232.8 → 9 / 1,237.3 | 5–7 → 6–9 | 5–7 → 6–7 |

| 활성 구간 | 엔진 간격 p95 / p99 / 최장 (ms) | desktop 간격 p95 / p99 / 최장 (ms) | 입력→surface p95 / p99 / 최장 (ms) |
| --- | ---: | ---: | ---: |
| 정방향 100ms | 121.7 / 201.8 / 201.8 → 118.4 / 126.2 / 126.2 | 121.2 / 205.7 / 205.7 → 115.8 / 126.6 / 126.6 | 330.2 / 347.2 / 347.2 → 244.0 / 255.0 / 255.0 |
| 정방향 50ms | 160.1 / 202.4 / 202.4 → 166.4 / 211.0 / 211.0 | 158.5 / 208.3 / 208.3 → 163.0 / 200.3 / 200.3 | 441.0 / 441.0 / 441.0 → 377.8 / 377.8 / 377.8 |
| 역방향 50ms | 233.0 / 265.6 / 265.6 → 186.1 / 200.4 / 200.4 | 231.0 / 279.3 / 279.3 → 191.2 / 200.9 / 200.9 | 496.2 / 512.2 / 512.2 → 414.2 / 418.1 / 418.1 |

두 정방향은 FPS 중앙값이 상승했다. 세 구간의 입력→surface p95가 줄었고 역방향 최장 간격도 짧아졌다. 역방향의 FPS·50ms 초과 간격 빈도·100ms 이상 정체 수에서는 개선이 이어지지 않았다. 후보 3회가 모두 touch 48/30/60개와 gesture 6/6/12회, 월 이동 +4/+3/−6에 도달했고 모든 native 입력을 수락했다. 세 후보의 세 구간에 각각 100ms 이상 엔진 간격과 진행 정체가 있어 **부분 개선 / performanceAccepted=false**로 판정했다.

기준선·후보 Core의 package build inputs는 각각 `72313883ff7b545aab108769fc3e3ce90893d2650d90b901796a91f7c82b2195`, `806db23a83cae125215311d8652224fb680c97fb9c8f683afd678b62708663fd`다. Demo Windows·Web과 Testbed Windows의 Core는 현재 Source와 dist source-map 입력 646개 및 설치 파일 해시를 대조했다. `legacy` 비교의 Hermes bundle SHA-256은 `2867c74b50fc818aac8a0e6c94cebe1b5181ca8fed17c913cbbe5222c261a7ed` → `3c2d05967b02ca41e088a2b099032816334667170f05f2c2096805b0e79aaf5b`다. probe 진입점·host·renderer·VM toolchain의 해시는 변경 전후에 일치했다.

### 선택 준비 `split`

| 활성 구간 | 엔진 FPS | desktop FPS 하한 | 엔진 >50ms 간격 횟수 / 총 ms | 엔진 ≥100ms 진행 정체 범위 | desktop ≥100ms 진행 정체 범위 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 정방향 100ms | 33.73 → 33.58 | 33.01 → 30.24 | 9 / 984.3 → 9 / 974.5 | 6–7 → 6–7 | 6–7 → 6–7 |
| 정방향 50ms | 32.55 → 29.30 | 32.37 → 25.97 | 6 / 692.5 → 8 / 772.9 | 4–5 → 4–5 | 4–5 → 5–6 |
| 역방향 50ms | 19.75 → 20.49 | 19.07 → 18.49 | 8 / 1,270.0 → 10 / 1,238.9 | 5–7 → 6–9 | 5–7 → 7–9 |

| 활성 구간 | 엔진 간격 p95 / p99 / 최장 (ms) | desktop 간격 p95 / p99 / 최장 (ms) | 입력→surface p95 / p99 / 최장 (ms) |
| --- | ---: | ---: | ---: |
| 정방향 100ms | 129.4 / 145.4 / 145.4 → 128.9 / 169.5 / 169.5 | 129.0 / 145.4 / 145.4 → 133.5 / 167.7 / 167.7 | 254.8 / 260.6 / 260.6 → 294.6 / 310.6 / 310.6 |
| 정방향 50ms | 135.6 / 201.7 / 201.7 → 124.7 / 157.7 / 157.7 | 132.8 / 206.3 / 206.3 → 123.4 / 151.8 / 151.8 | 350.3 / 350.3 / 350.3 → 368.5 / 368.5 / 368.5 |
| 역방향 50ms | 211.6 / 279.9 / 279.9 → 170.4 / 233.5 / 233.5 | 212.5 / 290.4 / 290.4 → 170.2 / 229.5 / 229.5 | 511.7 / 515.6 / 515.6 → 492.7 / 508.7 / 508.7 |

전후 3회 모두 touch와 월 이동을 충족했다. 각 실행에서 준비 4세대 중 3세대를 채택했다. 선택 준비 CPU 중앙값은 477.215 → 426.654ms, slice 수 중앙값은 324 → 262회, 필수 동기 완결 중앙값은 11.715 → 9.227ms였다. 후보의 최대 선택 slice는 6.050ms였다. 정방향 표시 FPS 저하와 역방향 정체 증가가 관찰되어 **performanceAccepted=false**다. `split` 비교 bundle SHA-256은 `c4c432a52143873b29a7a305ebca5a020be265a59c6abfb708cd2e7261123eeb` → `9e8b21686998f61f9d9267dd18effa02d1abe043371ec7414151bd15bde93c70`다.

후보의 100ms 이상 프레임 간격은 보통 정방향·빠른 정방향·빠른 역방향 순으로, `legacy` 엔진 7·3–5·6–9회와 desktop 6–7·4–5·6–7회였다. `split` 엔진은 5–6·3–4·5–8회, desktop은 5–6·4–5·6–8회였다.

### 공통 화면

| Windows 전후 1회씩, cold / return / warm | 엔진 FPS | desktop FPS 하한 | 엔진·desktop ≥100ms 간격 / 진행 정체 |
| --- | --- | --- | --- |
| Demo Gallery | 74.58 / 76.83 / 76.26 → 73.24 / 76.01 / 75.61 | 72.20 / 60.15 / 57.25 → 72.70 / 60.70 / 58.79 | 전 구간 0 / 0 |
| Testbed 가변 목록 | 75.96 / 78.32 / 76.81 → 76.36 / 80.00 / 74.43 | 73.46 / 59.08 / 58.45 → 71.26 / 60.91 / 57.95 | 전 구간 0 / 0 |

Gallery의 한글·이모지 입력과 resize, 가변 목록에서 UIA의 cold/return/warm 항목 복원을 확인했다. Gallery return 입력→surface p95는 28.511 → 46.529ms, 가변 목록 cold는 29.565 → 36.827ms였다. 각 화면 1회 비교의 지연 변동도 결과에 포함했다.

## 8. 기능·수명 검증

- **Source** Core 빌드·타입 검사, 자식 조정, Source framework, frame publication과 subtree preparation, semantics geometry 20개, retained paint, 진단 호환성, 변경 파일 lint·format을 확인했다. RTL과 scale 전환, pinned header의 가림 영역을 반영한 `ensureVisible`, 사용자 정의 extent와 대기 layout callback도 확인했다.
- **Windows** 달력 Tab 포커스의 UIA 게시, 현재 월을 유지한 resize, 날짜 확정 및 UIA 상태 문구, 재열기와 Cancel을 W6-1·2의 `split` 진단에서 통과했다. W6-1·2 `legacy` 진단은 세 구간을 측정한 뒤 진단 코드가 닫힌 달력 State를 읽어서 종료 검증에 실패했다. 진단의 달력 관측을 활성 구간에 한정했고 이후 기능 검사에서 정상 종료했다.
- **최종 `split` 달력과 종료** 위 기능을 다시 통과했다. 닫은 뒤 active Element, detached root, 준비 Element·활성 세대·wake와 resource producer는 모두 0이었고 scheduler는 dispose 상태였다. 공유 저장소에는 native drain 직전 resident 자원 64개가 관측됐다. native host는 GPU drain과 VM callback 정리를 마친 뒤 종료 코드 0을 기록했다. [Windows 진단](Nelyx/eng/windows-jank-framework-profile.ts) · [native 종료](Nelyx/sdk/native/windows-hermes/main.cpp#L277)
- **Windows 날짜 옵션** 현재 공급의 `showDatePicker`에 `ko-KR`, 2024-02-10~03-20, 초기값 02-15, 12일을 제외하는 predicate를 넣어 검사했다. dialog의 locale override가 적용됐다. 양 끝 월의 이동 버튼과 범위 밖 날짜가 비활성으로 게시됐고, 비활성 날짜를 누른 뒤 확정 결과는 02-15였다. 재열어 다음 월에서 돌아온 뒤 윤일 02-29를 확정했다. UIA 검색은 이름과 tooltip HelpText를 사용했다. native 입력 40개를 모두 수락하고 exit 0으로 종료했다.
- **Windows Testbed 혼합** 현재 공급에서 스크롤과 입력, 가변 목록 진입·복원, 한글·이모지 입력과 정상 종료를 확인했다. native 입력은 118개 수신·전달·수락, reject 0개였고 wheel 이동 합계 288을 전달했다.
- **일반 CLI와 Windows 가상 입력** `npm.cmd run run:windows --workspace @nelyx/demo -- -- 10000`이 기본 `src/index.ts`를 direct Hermes bytecode로 실행했다. 첫 surface frame을 게시하고 강제 종료 없이 exit 0을 기록했다. 실행 bundle SHA-256은 `bcd9a44c16e2d8f3a74fedb62a720b260f94717b4ac9f6b246ce453956263a80`이다. Windows 입력 검사 6개가 통과했고, 달력 cadence 세 구간 모두 60Hz 부근에서 계획한 touch 수를 확인했다. [가상 입력 검사](Nelyx/eng/check-windows-input.mjs)
- **Web** 현재 정적 Metro·Ganesh WebGL2 빌드에서 Playwright와 SwiftShader로 첫 frame, Gallery wheel 왕복, 테마와 viewport 변경 후 한글·이모지 입력 보존, 달력 한 달 전후 이동과 닫기를 통과했다. `application.js` SHA-256은 `7188cfed4006490ef14d7ce31c2911a86f91e5ad5a015f40826a955ff205c0eb`다. Web 검증 범위는 해당 기능이다. [Web 검사](Nelyx/eng/check-source-web.mjs)

## 9. 역방향에서 월과 접근성 노드의 수명

달력의 PageView는 `allowImplicitScrolling` 기본값인 `false`를 사용한다. viewport의 기본 cache extent가 0이므로, 월이 활성 범위를 벗어나고 keep-alive 조건에도 들지 않으면 Sliver가 해당 슬롯을 회수한다. 이후 같은 인덱스를 요청하면 새 Element와 그 달의 Grid·날짜 자식을 만들어 연결한다. Source에서 일반 슬롯 왕복의 unmount와 재생성을 확인했다. 이전 `work2.md`의 실제 달력 9개 인덱스에서도 같은 인덱스의 root identity가 바뀌었고, 중첩 Scrollable·Scrollbar의 일반 GlobalKey로 인해 대상 월은 당시 dormant cache의 자격에 들지 않았다. 전환 프레임 안의 deactivate와 finalize는 위젯·렌더 객체 수명 작업을 측정한다. [PageView](Nelyx/src/framework/widgets/page-view.ts#L398) · [회수 경로](Nelyx/src/framework/rendering/sliver-multi-box-adaptor.ts#L439) · [기존 자격 조사](work2.md)

각 날짜는 `Semantics` 위젯에서 label·enabled·selected 상태를 게시한다. render semantics가 현재 가시 트리를 구성할 때 새 노드를 만들거나 기존 노드를 연결하고, 화면에서 빠진 노드는 해제한다. Core 게시 후 Windows bridge는 delta를 해석해 UI thread에 전달한다. UIA 트리는 동일 ID의 provider를 재사용할 수 있다. JS 노드 해제, bridge 전달과 네이티브 COM 객체 수명에는 각각 별도의 경계가 있다. [날짜 접근성 위젯](packages/material/src/generated/date/calendar_date_picker.generated.ts#L2219) · [노드 조립](Nelyx/src/framework/rendering/semantics-pipeline.ts#L601) · [Windows 게시](Nelyx/sdk/native/windows-hermes/main.cpp#L226) · [UIA 트리](Nelyx/engine/platform/windows/interop/SemanticsTree.h)

최종 `legacy`에서 `NELYX_JANK_SLIVER_PROFILE=1`과 `NELYX_NATIVE_GC_STATS=1`을 함께 사용해 `-Diagnostic -NoScreen`으로 한 차례 원인을 확인했다. 빠른 역방향에서 재진입한 여섯 월 모두 새 Element였다. 예를 들어 132번 월의 Element 3은 정방향 frame 77에서 unmount됐고, 역방향 frame 176에서 Element 13으로 생성됐다. 133번 월의 Element 4도 frame 114에서 unmount된 뒤 frame 176에서 Element 14로 생성됐다. 이 프레임에서 다른 두 월도 회수됐다. layout 199.679ms 중 dirty rebuild의 배타 시간은 142.840ms였고 deactivate 두 번에 8.345ms, layout 뒤 finalize에 22.777ms가 들었다. [월 identity와 frame 계측](Nelyx/eng/windows-jank-framework-profile.ts)

같은 frame 176은 역방향 semantics 최대 frame이었다. 전체 21.214ms 중 `flush`에 18.247ms, snapshot에 2.532ms가 들었다. JS 노드 63개가 처음 연결됐고 65개가 분리됐다. 연결·분리 메서드의 배타 시간 합계는 0.319ms였다. 앞선 layout의 `Semantics` backing render 객체 생성 177회는 2.178ms였고, finalize 안의 `clearSemantics` 호출은 0.936ms였다. 역방향 구간의 native bridge 전달 13회에는 upsert 642개·삭제 193개가 있었으며, 가장 긴 전달은 0.288ms였다. `flush` 시간에는 트리와 geometry 재구성이 포함된다. bridge 전달 시각은 UI thread의 COM provider 생성·해제 및 UIA 이벤트 처리 시간을 포함하지 않는다.

Hermes 통계상 보통 정방향·빠른 정방향·빠른 역방향의 전체 VM 할당 증가량은 119.92·98.21·131.12MB였다. GC 기록은 32·26·35회, GC wall time 증가량은 103.10·81.17·138.79ms였다. 역방향 끝까지의 누적 최대 단일 pause는 13.182ms였다. 구간 집계에는 진단 비용이 들어가고 통계는 GC 전 mutex 대기와 개별 frame의 GC 겹침을 제공하지 않는다. 이 진단에서 긴 역방향 frame의 가장 큰 관측 구역은 되돌아간 월의 필수 layout 안에서 실행된 rebuild였다. 종료까지 native 입력 174개를 모두 수락했고 종료 코드는 0이었다. [Hermes 통계 수집](Nelyx/eng/windows-jank-heap-profile.ts)

## 10. 종료 판정과 검증 범위

Source와 Windows UIA·달력 옵션·일반 CLI·Testbed·Web을 확인했고, 현재 공급의 입력 지연과 성능·수명 결과를 위에 기록했다. 달력의 30fps와 진행 정체 0회 조건은 미달했다. 특히 `legacy` 빠른 역방향의 엔진 FPS 중앙값은 20.45 → 17.63으로 하락했다. 이번 성능 측정은 Windows 가상 touch, native surface fence, desktop marker 샘플링에 한정된다. 물리 trackpad, 화면 scanout, 네이티브 COM provider 해제 시간과 장시간 힙 증가는 관측 범위에 포함되지 않았다.

Windows 앱은 총 27회 실행했다. 날짜 옵션 검사에서 선택을 UIA 이름으로 확인하던 방식을 실제 확정값으로 교체했고, PowerShell 검사 코드와 활성 월 이동 버튼의 tooltip 조회를 보완했다. 이 기능 검사의 재실행으로 계획보다 2회 늘었다. 성능 판정에는 계획대로 모드별 전후 3회씩의 유효 표본을 사용했다. 검증용 진입점·패키지·브라우저 임시 디렉터리를 정리했고, 최초 날짜 검사에서 생긴 중복 Hermes toolchain은 휴지통으로 보냈다. 일반 CLI와 Web의 현재 빌드 출력 및 공급 해시를 확인했다.
