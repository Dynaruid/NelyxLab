# Nelyx 공통 프레임워크 FPS·버벅임 개선 계획

작성일 2026-11-18 · 검토 기준 `3c2b4335` · 상태 **계획 작성 완료 / 구현 대기 / performanceAccepted=false**

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
```

검증마다 20분 timeout을 적용하고 앱 실행은 정상 종료까지 확인한다. Windows 전체 실행은 진단 최대 3회, 달력 기본 비교 6회와 조건부 준비 비교 6회, Gallery/목록 전후 4회, Testbed 혼합 1회, 최종 일반 1회 및 원인 수정·무효 표본 보완 4회로 최대 25회를 계획한다. 임시 경로는 실행에 필요한 소유 범위에서 만들고 `finally`에서 정리한다. 현재 dist를 유지하고 이 문서에 비교 범위·결과·잔여 항목을 남긴다. [저장소 검증 규칙](.github/copilot-instructions.md)

## 5. 완료 체크리스트

- [ ] W6-1에서 제거한 반복과 자식 순서·수명 회귀 결과를 기록했다.
- [ ] W6-2에서 배치 재사용의 자격과 resize·입력 geometry·접근성 전환을 확인했다.
- [ ] W6-3에서 긴 frame에 남은 실제 작업을 짚었고, 선택한 수정의 동기 비용·선택 CPU·회수 비용을 확인했다.
- [ ] 현재 공급에서 FPS·정체·입력 지연·기능·자원 수락 조건을 판정했고, 일반 CLI 실행과 정상 종료를 확인했다.

이번 문서의 근거는 현재 Source와 이전 실행 기록이다. 위 구현과 새 제품 성능 측정은 **대기** 상태다.
