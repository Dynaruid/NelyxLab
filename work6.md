# 추가 C++ 엔진 후보와 All components 전체 구간 스크롤 검증

작성·실행: **2026-11-03 KST** · 상태: **IMPLEMENTED_AND_VERIFIED / 사용자 요청의 C++ all 통합·실제 실행·기능 회귀·일반 App 복구 완료 / 일반 App 기본 TS·NO_ADOPTION·제품 PARTIAL 유지**

**새 C++ 후보는 레이아웃 subtree 처리, 텍스트 구성·측정, 프레임 봉인·자원 입장, Windows GPU backing 재사용으로 넓힌다.** 기존 geometry·Path/Paint·Scene·Semantics 후보와 구분해 하나씩 평가한다. 실제 지배 병목인지는 아래의 새 전체 구간 기준에서 먼저 확인한다.

**주 성능 검증은 Material Gallery의 `All components`에서 양쪽 열의 lazy load를 끝까지 예열한 뒤, 각 열의 최상단에서 실제 최하단까지 이동하는 것으로 바꾼다.** 기존 5초짜리 좁은 왕복 결과는 이 전체 구간 결과를 대신하지 않는다. 전체 로딩 완료·시작점·종료점·중간 섹션 coverage를 함께 확인한다.

[work5.md](work5.md)는 기존 구현·재실험·수동 C++ 모드의 기록으로 유지한다. 전체 구간 완료 gate·비교 도구와 Windows N4를 구현·비교한 뒤, 사용자가 **N1·N2·N3까지 구현**하도록 범위를 추가했다. 이 세 후보는 개별 선택·실행 검증을 갖춰 추가하며, 기본 채택은 별도 성능·정확성 판단으로 남긴다. N5는 이번 추가 요청 범위에 넣지 않는다. 현재 결과·검증 범위·후보별 결정은 §12–13에 모은다. 일반 기본값 **TS**, 후보 **NO_ADOPTION**, 제품 **PARTIAL**, `performanceAccepted=false`, `resizePerformanceAccepted=false`를 유지한다.

## 1. 현재 확인한 출발점

- 설계 작성 시 HEAD는 `6505484c46333313cd1660cbc236299d325b9a99`였다. 이번 구현은 clean HEAD `69377bcd1f5b81d32d8951ade7f2e406ce9c7cf0`에서 시작했다. 현재 공급·실행 identity는 §13에서 별도로 확인한다.
- [work5 §14](work5.md)의 retained 비교는 실제 C++ 실행이 있었지만 Mixed 평균이 **49.314698→40.292055 surface FPS**로 약 18.30% 낮았다. TS eligibility·변경 생산·전송·결과 반영을 포함한 경로의 결과다.
- work5 §16의 재실험도 snapshot·Path·clip/Paint·Scene·Semantics를 모두 기본 채택하지 않았다. Native 실행 사실과 전체 경로의 순이득은 별도 조건이다. 새 후보의 근거로 기존 kernel 성능만 재사용하지 않는다.
- work5 §17에는 `npm.cmd run run:windows:cpp`와 개별 module 선택이 이미 있다. 수동 결과의 `observed`는 native 작업 확인이며 FPS 향상의 증거가 아니다.
- 기존 [cadence](Nelyx/eng/run-rnw-cadence.mjs)의 짧은 왕복은 Gallery 좌/우에 각 방향 **5초**를 전달한다. [OS wheel helper](Nelyx/eng/tests/windows-continuous-scroll.ps1)의 기존 `RangeExtent`도 전달받은 extent를 이동하는 기능이다. 새 `--full-range` 경로는 이와 별개로 모든 섹션의 준비·측정과 실제 top→bottom을 확인한다.

따라서 첫 작업은 새 C++ 모듈의 일괄 구현이 아니라 **검증 범위 확대와 전체 구간의 병목 재귀속**이다. 과거 수치와 새 전체 구간 수치를 같은 실험으로 합치지 않는다.

## 2. All components의 lazy load 완료 조건

### 2.1 현재 화면의 구조

[gallery.ts](sample/nelyx-testbed-app-2/src/gallery.ts)는 `visibleDemos`의 결과를 두 scroll owner로 나눈다. 넓은 All components 화면에서 `text-fields`는 primary 열에 유지되고, 나머지는 catalog 순서에 따라 배치된다. 각 열은 별도 `ScrollController`·`GallerySectionExtents`·`SectionExtentIndex`를 사용한다.

[gallery-section.ts](sample/nelyx-testbed-app-2/src/gallery-section.ts)는 editor section만 명시적으로 keep-alive한다. 일반 section은 `childPolicy: bounded / capacity: 2 / preparation: disabled`다. 전체를 한 번 방문한 뒤에도 화면 밖 항목이 retire되고 복귀 때 다시 구성될 수 있다. 이 재구성 비용은 일반 lazy 제품의 측정에 포함한다.

이번의 **lazy load 완료**는 다음을 뜻한다.

1. 현재 catalog·열 배치·폭·theme·locale·text scale·DPI 조건에서 **모든 대상 section을 한 번 이상 실제 구성하고 layout까지 완료**했다.
2. 각 section의 최초 글꼴·이미지 등 유한한 초기 로딩 작업이 완료됐고, 해당 콘텐츠가 유효한 frame에 포함됐다. 로딩 오류는 별도로 기록하고 성공으로 치환하지 않는다. 무한 animation이나 계속 깜박이는 caret의 정지를 기다리지는 않는다.
3. [SectionExtentIndex](Nelyx/src/framework/rendering/section-extent-index.ts)의 대상 항목이 모두 `measured`이며 `unmeasured/invalidated`가 0이다. 각 열의 실제 min/max scroll extent와 viewport dimension을 확보했다.
4. 양쪽 열의 초기 로딩·크기 변경이 수렴했고, 현재 조건의 extent/revision이 안정된 상태에서 두 열을 다시 최상단으로 돌려놓았다.

**완료 기록은 모든 위젯·텍스처가 동시에 상주한다는 뜻이 아니다.** 기존 bounded cache와 editor 수명을 유지한다. cache 축출 이후의 재생성·재측정·재업로드가 발생하면 warm 전체 구간 비용으로 보고한다. 전 항목 eager 구성이나 영구 keep-alive 제품은 필요하면 별도 control로 만들 수 있지만, 이번 주 기준을 그것으로 바꾸지 않는다.

### 2.2 무엇을 전부 로드할 것인가

- 기준은 `All components`에서 **현재 필터로 실제 표시되는 모든 section**이다. [catalog.ts](sample/nelyx-testbed-app-2/src/catalog.ts)의 `visibleDemos` 결과와 실행 시 primary/secondary ID 목록을 사용한다. section 개수나 마지막 ID를 문서의 고정 숫자로 가정하지 않는다.
- 현재 기본값 `includePlanned=false`를 기록한다. planned까지 표시하는 별도 실행은 설정과 placeholder coverage를 구분하며, 미구현 컴포넌트의 구현 완료로 해석하지 않는다.
- 최대화·동일 창 크기/DPI·동일 theme/언어로 비교한다. 두 열 조건을 만족하는지 실제 화면과 scroll owner로 확인한다. sidebar나 내부 TextField의 별도 scroll을 주 열의 이동으로 세지 않는다.
- primary/secondary의 extent·처음/마지막 section·현재 offset을 각각 기록한다. 두 열의 높이와 coverage를 합쳐 한쪽의 누락을 가리지 않는다.

## 3. 새 스크롤 검증 절차

### 3.1 예열: 전체 lazy 구간을 실제로 방문

**각 fresh owner에서, 어떤 timed leg를 시작하기 전에 양쪽 열을 모두 예열한다.**

1. All components를 선택하고 현재 표시 대상 ID·열 배치·metrics identity를 고정한다.
2. 왼쪽 열을 최상단부터 아래로 진행한다. 한 번에 여러 section을 뛰어넘는 거대 wheel이나 최하단 `jumpTo`로 예열을 대신하지 않는다. viewport가 겹치는 단위로 이동하고 새 section의 layout·초기 자원 준비를 확인한다.
3. lazy 측정으로 max extent가 늘어나면 갱신된 끝까지 계속한다. **처음 관측한 max extent 도달만으로 종료하지 않는다.** 미방문 ID·미측정 index를 확인하고 실제 마지막 section까지 도달한다.
4. 오른쪽 열도 같은 방식으로 예열한다. 마지막 Image demo 등 비동기 크기 변화가 있는 콘텐츠의 준비를 포함한다.
5. 두 열을 최상단으로 복귀시키고 모든 대상 ID의 완료 상태·현재 index measurement·실제 extent를 다시 확인한다. 폭/환경/구조 revision이 바뀌면 이전 완료 표시를 철회한다.
6. 아직 누락이 있으면 제한된 보완 순회만 수행한다. 최초 순회와 보완을 합쳐 **최대 3회**로 두고 수렴하지 않으면 `FAIL_WARMUP_NOT_COMPLETE`로 끝낸다. 이 상한과 모든 실패를 보고하고 반복으로 숨기지 않는다.

Extent 안정 확인은 예를 들어 **100ms 간격의 3개 bounded 관측**과 해당 layout revision을 사용한다. 고정 600ms 대기만으로 전부 로드됐다고 판단하지 않는다. idle에서 불필요한 frame을 계속 요청하거나 animation을 정지시키지 않는다.

### 3.2 예열 완료 gate

아래 gate는 [GalleryRangeObservation](sample/nelyx-testbed-app-2/src/gallery-range.ts)과 [verifier](Nelyx/eng/tests/gallery-range-contract.js)에 구현했다. 기존 controller·index·resource 수명에서 읽는 opt-in 상태이며, 유효한 submitted frame에서만 완료를 기록한다. 일반 UI에는 관측 표식을 설치하지 않는다.

| 항목 | 통과 조건 |
| --- | --- |
| catalog coverage | expected IDs = 한 번 이상 구성·layout·초기 준비를 완료한 IDs, 누락 0 |
| extent measurement | 두 열 모두 모든 대상 index가 현재 configuration에서 measured |
| 초기 자원 | 해당 section에서 발생한 유한 초기 작업의 미완료 0, 오류 별도 명시 |
| 환경 | catalog/column/폭/theme/locale/text scale/DPI·owner 세대 일치 |
| 안정성 | extent와 관련 revision의 수렴 확인. 변경 이유를 알 수 없는 경우 실패 |
| 시작 위치 | 양쪽 실제 offset이 각각 `minScrollExtent`에서 **0.5 logical px 이내** |
| 실제 끝 확인 | 예열 중 각 열의 마지막 section을 실제 layout·유효 frame에서 확인 |

`measurement(index)`, `totalExtent`와 section별 실제 geometry·image frame·등록된 bundled font를 함께 확인한다. 폭·환경·owner·index 조건이 바뀌면 완료 상태를 철회한다. 기존 짧은 cadence에는 이 gate를 소급 적용하지 않는다.

### 3.3 주 측정: 최상단 → 최하단

1. 일반 제품 조건과 native 선택 모드를 확인하고 예열 완료 gate를 통과한다. 주 측정은 왼쪽과 오른쪽을 별도 leg로 수행한다.
2. 각 leg 직전에 해당 열의 **실제 최상단 offset**과 첫 section을 확인한다. 입력은 실제 OS wheel로 보낸다.
3. 안정된 거리 `D = maxScrollExtent - minScrollExtent`와 viewport 높이 `H`로 이동 시간을 정한다. 기본 속도는 **초당 약 1 viewport**를 출발값으로 하고, 비교 양쪽에 같은 logical 속도·packet 간격을 사용한다. 페이지가 길면 입력 시간도 길어진다. 고정 5초 안의 작은 구간으로 되돌리지 않는다.
4. 주입 시계는 native/QPC elapsed time을 사용한다. timed 구간의 UIA/JS polling 응답 속도로 wheel을 조절하지 않는다. wheel 설정·단위와 실제 scroll delta 관계를 예열에서 확인한다.
5. 실제 offset이 `maxScrollExtent`에서 **0.5 logical px 이내**이고 마지막 section이 나타났는지 검증한다. 중간 section의 실제 가시 구간 coverage도 확인한다. 큰 packet으로 중간 콘텐츠가 표시되지 않았다면 전체 이동 PASS로 쓰지 않는다.
6. 시간 종료 뒤 추가로 끝까지 보낸 입력은 원래 leg의 완주를 대신할 수 없다. 도달 실패·새 미측정 section·조건 변경은 그 leg의 실패다. 보완 입력과 원래 timing을 이어 붙이지 않는다.
7. 다른 열의 측정을 시작할 때도 그 열을 실제 최상단에 둔다. 복귀 입력은 예열·재배치 구간으로 분리한다. 최하단→최상단의 빠른 복귀·반전·재접촉은 별도 기능/성능 항목으로 추가할 수 있다.

기본 비교는 **기준/후보 3쌍 fresh owners**, owner마다 양 열 예열 후 **좌 top→bottom 1회 + 우 top→bottom 1회**다. 주 결과는 열별 3개 편도다. 기존 짧은 양방향 6 legs 평균과 표본 수를 맞춘 것처럼 섞지 않는다. 기준/후보 순서는 교차하고 실행 중 다른 build/test를 돌리지 않는다.

기존 helper의 full-range 계산에는 finite wheel units와 한 bounded priming packet 상한이 있다. 더 긴 전체 페이지를 지원할 때는 안전한 크기의 OS packet으로 나누고 overflow·partial delivery·foreground 이탈을 검사한다. 과거 `RangeExtent` 값을 하드코딩하거나 이 상한에 맞춰 페이지 범위를 줄이지 않는다.

### 3.4 결과와 실패를 어떻게 보고할 것인가

- 열별로 expected/loaded/measured/실제 표시 section 수, warmup 시간, `min/max/start/end offset`, 이동 거리, 입력 시간·packet 수·환경·source/native/SDK/App identity를 남긴다.
- **전체 입력 시간의 cadence**와 객관적인 offset 경계로 정한 **첫 이동→실제 최하단 도달 구간**을 함께 보고한다. 첫 이동 이후의 정지·느린 frame은 포함한다. 끝점 overscroll 대기는 별도 표시하고 느린 부분을 임의로 잘라내지 않는다.
- 전체 및 section 구간별 surface 갱신 간격 p50/p95/p99·max와 긴 공백, CPU stage·입력 응답을 구분한다. 평균 FPS 하나로 특정 section의 끊김을 가리지 않는다. pixel 샘플과 상세 probe는 별도 진단 실행에서 확인한다.
- timed leg 중 mount/rebuild·paragraph miss·image decode/upload·extent 수정이 다시 발생하면 그 양과 비용을 보고한다. 예열했다는 이유로 이 frame을 제외하지 않는다. 이전 완료 gate가 유효하지 않았는지, bounded 축출 후 정상 재구성인지를 구분한다.
- native 새 후보는 실제 **이동 구간 내부**의 작업·SDK 집계·TS fallback과 사유를 확인한다. startup/예열의 작업 수를 warm 성능 증거로 쓰지 않는다. 해당 section에 수요가 없으면 control로 표시하며, 수요가 있는 구간의 native 작업 0·관측 누락은 성능 판정 실패다.
- 전체 coverage가 실패하면 FPS가 높아도 `FAIL_FULL_RANGE_COVERAGE`다. 정상 종료·session close/drain·메모리 회수도 별도 통과해야 한다.

최초 로딩 자체의 지연은 warmup 소요·section 준비 시간으로 별도 관찰한다. **이번 주 스크롤 성능 판정은 전체 lazy 준비 후 top→bottom**이다. 수동 C++ 모드에서도 같은 순서로 사용자가 확인할 수 있게 하고, 자동 완료 gate의 PASS와 사람이 본 부드러움은 구분한다.

## 4. 새 C++ 후보의 전체 지도

아래는 **소스상 작업이 있는 영역과 새 구조 후보**다. 새 전체 구간에서 어느 것이 지배 병목인지, 예상 FPS가 얼마인지는 아직 확정하지 않았다.

| 후보 | C++가 맡을 새 책임 | 기존 후보와의 차이 | 우선 진입 근거 |
| --- | --- | --- | --- |
| N1 표준 subtree layout | 제약 전파·자식 측정 순서·Flex/Stack/Wrap 배치·dirty 숫자 상태 | 이미 결정된 좌표를 투영하던 geometry와 달리 **크기와 배치 자체**를 계산 | 전체 이동 중 실제 layout/intrinsic/baseline 방문이 유의함 |
| N2 텍스트 구성·측정 transaction | 닫힌 styled text description의 일괄 builder 구성·폭별 측정·metrics 묶음 | shaping은 이미 native. 새 목표는 TS run/style 준비와 builder·metric 경계 횟수 감소 | section 재구성의 paragraph miss 또는 text 준비가 지배적 |
| N3 frame 봉인·자원 입장 | 닫힌 command segment의 검증·resource 집합·native frame lease | Path 숫자 생성·Scene range 합성과 달리 **snapshot/자원 수명 경계**를 다룸 | capture/admission/packet 준비가 반복 frame의 유의한 비용 |
| N4 Windows imported backing 수명 분리 | 같은 GPU backing의 import 객체와 frame별 fence/recording lease 분리 | 이미 C++인 producer의 객체 생성·폐기 구조를 개선 | 같은 backing 재등장과 import/setup 비용이 실제 관측됨 |
| N5 animation/physics 샘플 묶음 | 표준 독립 curve·spring·friction의 native 숫자 sampling | 입력 대상 탐색·scroll 좌표 투영과 별개 | 여러 활성 ticker의 수치 sampling이 실제 주요 비용일 때만 |

전체 구간 기준을 만든 뒤 **N4의 재사용 가능성 조사와 N2의 miss 귀속을 먼저** 확인한다. N1은 구조가 더 크므로 layout 지배 근거와 지원 계약을 갖춘 뒤 구현한다. N3은 현재 재사용 fast path가 이미 줄인 비용을 제외하고 판단한다. N5는 후순위다. C++ 후보 개수를 늘리기 위해 모두 구현하지 않는다.

## 5. N1 — 표준 subtree를 한 번에 계산하는 native layout

### 5.1 구상

[RenderFlex/RenderStack](Nelyx/src/framework/rendering/boxes.ts), [RenderWrap](Nelyx/src/framework/rendering/wrap.ts), [BoxConstraints](Nelyx/src/framework/rendering/constraints.ts)의 표준 숫자 계산을 **연속 node table과 변경분을 받는 layout session**으로 구성한다. 한 node 또는 자식마다 JSI를 호출하는 방식으로 시작하지 않는다.

TS는 Widget/Element·State·트리 수명·사용자 callback을 계속 소유한다. 지원 가능한 표준 subtree의 parent/child 순서·제약·flex factor·fit/alignment·padding·direction·baseline 정책을 기록하고, native는 한 transaction 안에서 크기와 offset을 계산한다. 결과는 필요한 dirty node의 size/parentData로 한 번에 반영한다. 기존 geometry 서비스는 그 **후**의 좌표 공개에 해당하므로 별도 역할이다.

### 5.2 구현을 가능하게 하는 경계

1. 첫 범위는 tight/loose 제약의 표준 box와 지원을 증명한 Flex 조합으로 제한한다. 전체 layout 엔진을 교체하는 작업으로 시작하지 않는다.
2. text leaf는 N2의 유효한 native paragraph handle과 같은 폰트/폭 조건일 때 직접 측정하거나, 현재 제약에 대해 TS에서 이미 검증한 측정 결과를 opaque leaf로 쓴다. 미지의 제약을 받는 custom child를 임의의 고정 크기로 대체하지 않는다.
3. custom layout·`LayoutBuilder`·intrinsic·baseline override·관찰 가능한 getter와 prototype 변경이 있는 경계는 기존 TS 순서로 실행한다. 자식 크기를 알기 위해 매번 JS callback을 호출해야 하면 해당 subtree는 native 범위에서 제외한다.
4. `computeDryLayout`과 실제 layout, intrinsic·baseline의 호출 의미, overflow 진단, relayout boundary, constraints 재사용을 보존한다. 레이아웃 중 lazy child 생성이 필요한 sliver 전체를 한 번에 native로 넘기지 않는다.
5. TS의 `markNeedsLayout`·구조 변경에서 숫자 delta를 생산하고 제약·node revision을 관리한다. 전체 RenderObject tree를 매 frame 다시 serialize하지 않는다. 직접 mutation을 감지할 수 없는 공개 객체는 등록만으로 안전하다고 판단하지 않는다.
6. 결과 반영은 current owner/layout revision에서 원자적으로 수행한다. 재진입·구조 변경·예외 때 폐기하고 다음 dirty를 유지한다. size 값만 같다는 이유로 기존 사용자 hook을 생략하지 않는다.

**실험 관문:** 같은 subtree에 대해 TS 기준 결과와 정확성 비교를 하고, 실제 section layout transaction 수·계산 node 수·fallback 이유를 native 내부에서 센다. 준비·지원 판정·결과 반영까지 포함한 순이득이 있어야 채택한다. warm 순수 스크롤에서 layout이 대부분 clean이면 해당 구간은 control이며, 성능을 만들려고 강제 relayout하지 않는다.

## 6. N2 — 텍스트 구성부터 metrics까지 묶는 native transaction

### 6.1 이미 native인 부분과 새 목표

[NativeTextLayoutService](Nelyx/skia/packages/native/src/text.ts)는 현재 SkParagraph builder/layout을 호출한다. [paragraph_queries.cpp](Nelyx/skia/native/core/paragraph_queries.cpp)도 range·hit query 수명을 이미 관리한다. 새로운 shaping 엔진을 만드는 제안은 아니다.

현재 경로는 text snapshot·font catalog·[TextLayoutCache](Nelyx/src/hosting/text-layout-cache.ts) key를 준비하고, miss에서 style push/pop·text·placeholder를 builder에 전달한 뒤 layout·metrics·line/placeholder 결과를 얻는다. 새 후보는 **닫힌 text/style description을 한 번 전달해 이 구성을 native 안에서 끝내고 필요한 metrics를 한 묶음으로 반환**하는 것이다.

### 6.2 구체적인 설계

- framework 소유 immutable text/run/style 데이터는 content/style handle로 intern한다. 원본 content·font catalog revision·locale/direction·text scale·폭·maxLines/ellipsis·placeholder 정책을 key에 포함한다. hash 충돌은 내용 확인으로 처리한다.
- native가 기존 SkParagraph API를 그대로 사용해 builder·layout·필수 metrics를 처리한다. Paint 효과·font fallback·variable axes·strut·BiDi·UTF-16 source mapping의 현재 의미를 보존한다.
- 한 section에 **독립적으로 준비된** paragraph 요청이 여럿이면 batch 처리한다. 앞 paragraph의 결과가 다음 width/layout을 결정하면 dependency 경계를 나누고, batch를 만들려고 section 전체를 eager 구성하지 않는다.
- public/custom text 입력의 serialization/getter 동작은 기존 TS 경로로 유지한다. 캐시가 이미 사용하는 framework 소유 serialization을 먼저 재사용하고, 큰 문자열 key를 만들던 경로가 현재 실제 비용인지 확인한다.
- editable text의 document/source identity, composition/selection·paragraph revision·range-query ticket을 보존한다. text 수정 뒤 이전 paragraph를 현재 caret 질의로 사용하지 않는다. JS recognizer·callback은 native에 보유하지 않는다.
- native cache가 기존 TS cache와 중복 paragraph를 붙잡지 않게 하나의 소유 예산으로 연결한다. 현재 text cache **indexed 128 / resident 64 / 65,536 units / 1MiB**를 늘리지 않는다. frame/producer lease는 별도 수명으로 유지한다.

**실험 관문:** `descriptionBuild`, native layout, cache hit, metrics batch, bytes·JSI calls·retained bytes를 구분해 센다. 기존 cache hit만 있는 warm section에서 builder 작업 0이면 N2 생성 경로의 속도 향상을 주장하지 않는다. 반복 재구성 비용·초기 전체 준비 시간을 따로 보고하고, text pixels·line break·baseline·placeholder·한글 IME/selection 회귀를 확인한다.

## 7. N3 — frame 봉인과 resource admission을 native owner로 묶기

### 7.1 새 경계

[FrameRecording/captureSceneFrame](Nelyx/src/ui/frame.ts), [resource-retention](Nelyx/src/ui/resource-retention.ts), [ResourceRegistry.acquire](Nelyx/src/hosting/resources.ts), RNW [ScenePacket](Nelyx/skia/packages/native/src/scene.ts)을 함께 본다. 현재 captured command·resource list에는 재복사·중복 집합 구성을 피하는 fast path가 이미 있다. 전체를 매번 깊은 복사한다고 전제하지 않는다.

새 후보는 **닫힌 immutable command segment의 numeric payload·resource table을 native frame record로 한 번 소유**하고, 이후 frame capture는 그 segment handle·현재 frame stamp·변경 transform으로 admission하는 구조다. native가 segment의 구조/범위·자원 generation을 검증하고 resource hold를 한 frame lease에 연결한다.

work5의 Scene 후보는 합성 range를 C++에서 만들면서 TS source lookup과 replay가 남았다. N3은 range 합성 속도를 다시 비교하는 것이 아니라, **봉인→자원 수집→입장→packet 준비 사이의 중복 owner/표현 전환을 줄이는 시도**다. 별도 direct host의 [frame-wire](Nelyx/src/ui/frame-wire.ts) 변경만으로 RNW 제품이 빨라졌다고 판단하지 않는다.

### 7.2 보존할 동작

- user paint·Picture 생성 callback과 명령 순서는 TS의 원래 위치에서 실행한다. 처음 캡처할 때 mutable 외부 값을 소유 복사·검증하고 그 이후만 handle 재사용한다. Canvas 명령 하나마다 새 JSI 왕복을 추가하지 않는다.
- resource registration은 기존 registry에 남긴다. 초기 단계는 backend-native resource 집합만 대상으로 하고 OS/JS 전용 resource가 섞인 frame은 기존 경로를 유지한다. JS 객체·dispose callback을 native worker에 넘기지 않는다.
- 논리 producer·기록 owner·queued frame·GPU in-flight의 보유를 구분한다. admission 중 일부 retain 뒤 실패하면 rollback하고, supersede/cancel/close/context loss 때 정확히 한 번 해제한다. 다음 frame이 과거 immutable snapshot을 수정하지 않는다.
- native와 TS가 같은 보유를 이중 계산하거나 모두 상대가 보유한다고 가정하지 않게 handoff 지점을 명시한다. 명시적 close/drain을 사용하고 GC finalizer를 정상 해제 경로로 삼지 않는다.
- 기존 command/bytes/layer·Picture·pending/recording 예산을 유지하고 segment metadata·입출력 복사·capacity도 peak 비용에 포함한다.

**실험 관문:** 기존 capture/admission/packet wall과 방문 수·resource lookup·hold 생성/해제·복사 bytes를 나눠 확인한다. native 안으로 같은 전체 목록을 옮겨 두 번 순회하거나 TS mirror가 그대로 남아 순이득이 없으면 철회한다. GPU busy·pending 교체·재진입·late close에서 수명 회귀를 먼저 통과한다.

## 8. N4 — Windows GPU backing과 frame lease의 수명 분리

**이미 C++인 부분의 소유 구조를 바꾸는 독립 후보를 구현했다.** [win32_import.inc](Nelyx/skia/native/platforms/vulkan/win32_import.inc)는 같은 native surface 세대의 D3D texture identity·device·크기가 일치하면 Vulkan image/memory만 재사용한다. frame별 semaphore·command pool·fence·Graphite wrapper/recording·lease는 새로 처리하며 producer 완료와 consumer ACK를 유지한다. 새 전체 구간의 실제 import/reuse 작업과 wall은 §13에서 비교한다.

같은 image를 다시 acquire할 때는 이전 외부 소유권 반환의 `GENERAL` layout에서 시작한다. 최초 import는 `UNDEFINED`에서 시작한다. 이는 [Vulkan 외부 image 접근 규칙](https://docs.vulkan.org/spec/latest/chapters/resources.html)과 [image barrier 계약](https://docs.vulkan.org/refpages/latest/refpages/source/VkImageMemoryBarrier.html)에 따른다. 수명 검사는 [device memory 규칙](https://docs.vulkan.org/spec/latest/chapters/memory.html)을 포함하며 완료가 불명확한 자원을 해제하지 않는다.

제안은 아래 두 수명을 분리하는 것이다.

| 수명 | 유지하는 값 |
| --- | --- |
| ImportedBacking | 동일 D3D texture identity·device/context·format·size·surface generation에 귀속된 안전한 import 객체와 재사용 가능한 준비 상태 |
| FrameLease | 이번 frame의 acquire/release fence 값·image layout/queue ownership 전이·Graphite recording·producer/consumer 완료 상태·frame hold |

- 같은 backing이 consumer ACK 이후 다시 사용될 때, Vulkan/Graphite 계약상 재사용 가능한 객체만 유지한다. mutable fence 값·recording 완료를 과거 frame에서 가져오지 않는다.
- 현재 **최대 3 imported frames / 64MiB** 예산 안에서 동작하게 한다. texture identity에 강한 참조를 계속 추가하는 새 무제한 cache로 만들지 않는다. per-backing 유지량과 실제 live frame 수를 함께 계산한다.
- resize·surface/renderer/context/device generation 교체, format/size 변경, device loss와 오류에서 철회한다. COM pointer 주소만 같은 경우를 새 texture identity와 혼동하지 않는다.
- 기존 `winTextures/winFences`의 동시 사용 방지, producer 완료 확인·consumer ACK·poison 처리를 유지한다. `vkWaitForFences`나 shared fence를 생략해서 수치를 올리지 않는다. queue/recording 개수도 늘리지 않는다.
- imported image·Graphite wrapper·command pool 중 실제로 어느 것을 안전하게 재사용할 수 있는지는 각각 확인한다. 가능한 부분만 남기고 나머지는 frame별로 재생성한다.

**실험 관문:** backing별 create/reuse/destroy, import/setup wall, producer wait·전체 surface cadence, resize·minimize/restore·close와 peak bytes를 비교한다. 새 backing만 계속 생성돼 hit가 거의 없거나 GPU/driver 대기가 지배적이면 비진입 또는 철회한다. CPU import가 줄어도 독립 GPU 시간·표시 수락을 얻었다고 쓰지 않는다.

## 9. N5와 먼저 선택하지 않을 영역

[AnimationController](Nelyx/src/framework/animation/animation-controller.ts), [ticker](Nelyx/src/framework/animation/ticker.ts), [spring](Nelyx/src/framework/physics/spring-simulation.ts)·[friction](Nelyx/src/framework/physics/friction-simulation.ts)의 표준 독립 수치 sampling을 view별 한 native batch로 처리하는 후보도 있다. TS는 listener/status 순서·TickerFuture·취소·pause/resume·time dilation·접근성 animation 정책을 소유한다. 앞 listener가 뒤 animation을 바꿀 수 있으면 batch 경계를 나누고 custom simulation은 TS로 처리한다. native가 별도 scroll offset을 진행시키지 않는다.

활성 animation이 적거나 callback 처리 자체가 주 비용이면 왕복만 늘 수 있어 **후순위 조건부**다. 대량 수치 계산이 실제 관찰되기 전에는 구현하지 않는다.

또한 SectionExtentIndex는 이미 Float64/Uint8 배열과 Fenwick prefix/rank 검색을 쓴다. 작은 Gallery의 index를 C++로 치환하거나, 이미 Map인 의존성 저장소를 다시 이관하는 것은 첫 후보로 삼지 않는다. Widget/Element·reconciliation 전체 C++ 재작성도 이번 범위에 넣지 않는다.

## 10. 구현 위치와 실행 순서

전체 구간은 `GalleryRangeObservation`, `run-gallery-range.mjs`, `windows-gallery-range.ps1`로 구현했다. N4 capability는 `nelyxWin32BackingVersion()` / `nelyxWin32BackingAuditBegin(owner)`이며 SDK producer-result와 독립 native QPC audit를 함께 대조한다. 아래 구조 후보는 관문을 통과한 경우에만 진행한다.

| 단계 | 수정할 위치·작업 | 종료 조건 |
| --- | --- | --- |
| W6-0 전체 구간 도구 | Gallery/controller·section 준비/extent의 opt-in 관측, `run-rnw-cadence.mjs`, `windows-continuous-scroll.ps1`, native experiment 도구에 §2–3 절차 추가 | 양 열 전부 예열·측정·top→bottom 증거가 있는 TS 기준 3 owners. 짧은 왕복은 별도 control |
| W6-1 병목 재귀속 | 기존 [FrameDiagnostics](Nelyx/src/ui/frame-diagnostics.ts)·RNW probe로 section별 layout/text/capture/admission/producer를 구분 | 전체 이동 중 지배 비용과 각 후보의 실제 수요를 확인. 겹치는 wall 구간을 합산하지 않음 |
| W6-2 작은 독립 후보 | N4 backing 수명 조사 또는 N2 text transaction 중 근거가 큰 하나부터 | 실제 native 작업·지원률·총경로 이득·정확성·메모리 확인 |
| W6-3 구조 후보 | N1은 boxes/wrap/constraints·[hosting services](Nelyx/src/hosting/services.ts)·공통 core/JSI, N3은 frame/resources/scene/native core를 확장 | 하나씩 별도 모드·일반 제품 비교. 준비 비용·TS fallback 포함 |
| W6-4 선택적 후속 | 남은 비용에 따라 다른 후보나 N5 진입 | 수요·지원 계약·순이득이 없으면 비진입 |
| W6-5 최종 확인 | 채택 조합 공급·전체 구간 재검증·기능 회귀·일반 App 복구·정리 | 후보별 채택과 전체 제품 수락을 구분한 짧은 현재 상태 |

현재 N1의 순수 숫자 kernel과 N3의 paragraph 봉인은 기존 `Nelyx/skia/native/core/`에 뒀다. N2는 기존 adapter의 paragraph/style 변환기를 재사용해 native builder·layout·metrics를 한 transaction으로 묶으며, N3의 display-list 검증·native segment/recording owner 연결도 기존 JSI adapter 안에 둔다. 별도 공통 style 변환기나 segment cache를 중복 구현하지 않았다. N4는 기존 Windows Vulkan/platform 코드에서 다룬다. canonical source만 원본으로 편집하고 generated 사본은 기존 공급 도구로 갱신한다. 새 DLL·별도 VM·Wasm toolchain을 필수로 추가하지 않는다. Web/custom backend의 기존 TS 경로를 유지한다.

공통 경계는 TS Number에 맞는 `double`과 기존 행렬/숫자 의미를 유지하고 `fast-math`로 결과를 바꾸지 않는다. owner·session·node/resource generation·layout/frame revision을 검사한다. 각 모듈의 node/depth/bytes·입출력 복사·staging/scratch/capacity 상한을 schema와 함께 먼저 확정하고 allocation 전에 검증한다. JSI 입력은 native 소유로 복사하며 반환 뒤 JS buffer 포인터·JS 함수·Runtime 참조를 보유하지 않는다. 잘못된 protocol·공급 불일치와 정상 custom fallback은 별도 결과다.

## 11. 실행 검증·성능 수락·정리

### 11.1 새 도구에 반드시 추가할 실패 검사

- 처음 관측한 작은 extent만 왕복, 한 열만 예열, planned/필터로 expected IDs 불일치, 중간 section 건너뜀, 이미지 준비 미완료를 거부한다.
- 측정 직전 offset이 top이 아님, 실제 bottom 미도달, 뒤늦은 보완 입력으로 완주 표시, DPI/폭/theme 변경, foreground 상실·partial OS input을 거부한다.
- 전체 gate를 통과한 뒤 정상 cache 축출로 재구성된 경우는 비용에 포함한다. 새 미방문 section·무효 configuration을 성공으로 숨기지 않는다.
- 명시적 C++ capability 누락은 시작 실패다. 실제 native 작업 0, SDK/native 불일치·window 밖 startup 작업·fallback-only·미해제 session을 native 성능 성공으로 쓰지 않는다. 무수요 section은 control로 구분한다.
- 입력 구간 안에 완전히 들어온 native QPC bucket으로 audit한다. 구간이 너무 짧아 유효 bucket이 없으면 판정 불가다. counters-only 수동 보고를 timing 증거로 대신하지 않는다.

### 11.2 정확성과 실제 제품

변경 영역에 맞게 기존 검사를 선택한다. 아래는 관련 검사이며 실제 실행 결과는 §13에 구분한다. 새 전체 구간·N4 audit 검사는 `test:gallery-full-range`에 등록했다.

```powershell
# layout / text
npm.cmd run test:layout-constraints
npm.cmd run test:scroll-engine
npm.cmd run test:paragraph-lifetime
npm.cmd run test:skia-paragraph-queries

# frame/resource/native 변경
npm.cmd run test:paint-recording
npm.cmd run test:native-paint-replay
npm.cmd run test:native-service-audit
npm.cmd run test:native-module-mode
```

Geometry를 함께 수정하면 저장소 규칙대로 `test:input-geometry`와 `test:retained-input-geometry`를 둘 다 실행한다. 실제 Gallery→Mixed의 재클릭 없는 입력·전체 범위 왕복·한글 commit/undo·화면 밖 editor 복귀, 버튼 상태, shadow, DPI/resize·minimize/restore·close/drain을 유지한다. 실제 normal command와 최신 공급 제품으로 확인한다.

기존 `experiment:native-services -- --trials=3 --functional`은 기존 audit 회귀로 유지한다. **그 명령을 수정 없이 실행한 결과만으로 새 fully-loaded 전체 구간 검증을 통과했다고 쓰지 않는다.** 전체 구간 자동 gate는 `measure:windows-full-range`, 후보 비교는 `experiment:native-services -- --full-range`로 실행한다.

현재 실행 명령은 다음과 같다. 수동 확인은 §3의 순서로 수행하며 자동 timing gate와 구분한다.

현재 C++ preview의 `all`은 retained 입력 좌표·Path/Paint·clip·Scene·Semantics와 **layout·text·frame·backing**을 함께 선택한다. 새 후보를 따로 확인하려면 `--module=layout|text|frame|backing`으로 선택한다. Snapshot 입력 좌표는 retained의 대안으로 별도 모드이며 N5 선택 모드는 없다. 요청한 capability가 없는 공급본은 시작 시 실패한다. 통합 실행의 현재 검증은 §14에 기록한다.

```powershell
# 일반 TS 제품
npm.cmd run run:windows --workspace @nelyx/testbed-2

# 기존 C++ preview: 표시 모드는 선택값, 종료 집계로 실제 작업 확인
npm.cmd run run:windows:cpp

# 전체 예열·양 열 top→bottom TS 기준과 별도 진단
npm.cmd run measure:windows-full-range -- --trials=3 --diagnostic-after

# 동일 bytecode의 TS/N4 교차 3쌍 + 모드별 별도 진단 owner
npm.cmd run experiment:native-services -- --full-range --modes=ts,backing --trials=3 --diagnostic-after

# N4 수동 preview: full-range coverage 관측도 설치
npm.cmd run run:windows:cpp -- --module=backing

# N1/N2/N3 실제 모드와 교차 3쌍·별도 진단·기능 회귀
npm.cmd run experiment:native-services -- --full-range --modes=ts,text,layout,frame --trials=3 --diagnostic-after --functional

# cadence 없이 기능 회귀만 재실행
npm.cmd run experiment:native-services -- --full-range --modes=ts,text,layout,frame --functional-only

# N1/N2/N3 수동 preview: 자동 입력 없이 종료 시 native 집계 확인
npm.cmd run run:windows:cpp -- --module=layout
npm.cmd run run:windows:cpp -- --module=text
npm.cmd run run:windows:cpp -- --module=frame
```

### 11.3 채택과 종료

- 각 후보를 독립 선택해 같은 전체 로딩·전체 이동 조건의 3쌍을 비교한다. 호출/전송/검증/결과 반영·예열 비용·steady state·회수 비용을 함께 보고한다. kernel 단독 속도·startup native 작업으로 채택하지 않는다.
- 전체 구간의 평균·section별 느린 구간·입력 응답·peak memory가 함께 나아지는지 판단한다. 지속 60 surface FPS와 체감 끊김 해소가 미달이면 일부 후보를 채택해도 제품 **PARTIAL**을 유지한다. 기존 350ms 시각 생존 검사 통과는 smoothness 수락이 아니다.
- source→generated→현재 dist/archive→runner 설치본→실행 package와 native/SDK/App 입력 identity를 대조한다. Windows bytecode를 주 비교로 하고 Static AOT의 type/build/runtime 증거를 따로 구분한다. 채택된 공통 변경은 최신 Web fallback·Android 공급/회귀를 확인하며 미실행 플랫폼을 수락으로 확대하지 않는다.
- 테스트 timeout은 **1,200,000ms(20분)**, 대부분 반복은 **30회 이내**다. 전체 예열·이동이 길어지면 반복 개수를 줄이고 구간을 줄이지 않는다. 중단·표본 부족은 명시한다.
- coverage/히스토그램·audit 집계는 bounded RAM으로 관리하고 현재 결과만 이 문서에 짧게 남긴다. 임시 fixture·App patch·staging·소유 process는 성공/실패/중단 모두 `finally`에서 복구·정리한다. 과거 package/SDK 사본·로그·receipt·checkpoint/history JSON을 누적하지 않는다.
- 현재 dist만 유지하며 `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`를 생성하지 않는다. 기존 사용자 cache/emulator와 과거 삭제 차단 항목을 임의로 정리하지 않는다. 문서 작성 단계에서 기존 C++ 후보를 기본 활성화하거나 제품 캐시 예산을 바꾸지 않는다.

## 12. 구현·검증 상태

| 항목 | 현재 상태 |
| --- | --- |
| 전체 section 준비·extent·환경·submitted frame 관측과 실패 gate | 구현, 계약·실제 Gallery 회귀 통과 |
| OS wheel 양 열 top→bottom·native surface trace/counter 대조 | TS/N4와 새 TS/N1/N2/N3의 각 교차 3쌍 모두 coverage 통과 |
| N4 imported backing | 실제 native 재사용·종료 회수 통과, **NO_ADOPTION** |
| N1 Flex 숫자 단계 | 제약 배분·root 크기·배치 kernel, 실제 C++/TS 12 조건 일치·양 열 native 이동 작업 확인, **NO_ADOPTION** |
| N2 text transaction | builder 구성·layout·metrics 묶음, 실제 Testbed miss·양 열 native 이동 작업 확인, **NO_ADOPTION** |
| N3 frame segment | native 봉인·자원 snapshot·recording lease·GPU 후 회수, 양 열 native 이동 작업·실제 종료 균형 확인, **NO_ADOPTION** |
| N5 animation/physics | 비진입. 이번 추가 구현 범위 아님 |
| 추가 세 후보의 3쌍 비교 | 완료, 상세 수치와 범위는 §13.3 |
| 입력·창 전환 | TS/text/layout/frame의 각 fresh owner에서 Gallery → Mixed 한글 IME/undo → Gallery 복귀·정상 drain 통과 |
| 일반 App 최종 실행·정리 | 평소 명령의 TS 시작·공급 identity·실제 키 입력/한글 IME·exit 0 확인, fixture·소유 process·이번 이전 준비본 정리 완료 |

N1은 **한 Flex의 순수 숫자 두 단계**부터 구현한다. TS는 nonflex→flex child layout의 순서와 callback을 유지하고 C++는 그 사이의 배분, 마지막 size/offset 계산을 맡는다. dry/intrinsic/baseline·custom Flex hook은 TS 경로다. subtree 전체·Stack/Wrap까지 이관한 것으로 표시하지 않는다. N2는 기존 TS paragraph cache를 공유하고 별도 native cache를 추가하지 않는다. N3는 한 frame의 닫힌 segment를 native로 소유하고 GPU recording의 수명에 연결하며, TS의 Widget/capture와 registry의 논리 예산은 유지한다.

## 13. 현재 검증 결과

### 13.1 N4 전체 구간 비교

중립 `KeyedSubtree` 표식을 사용한 Release / Hermes bytecode / optimized의 동일 package에서 `ts→backing`, `backing→ts`, `ts→backing` 순서로 fresh owners 3쌍을 측정했다. client **2560×1459 physical / DPI 192**다. 모든 owner가 예열 1회(9.78–10.10초), 양 열 각각 expected/loaded/measured/표시 **7/7/7/7**, 전체 catalog 14 section을 통과했다. 독립 native surface counter와 trace row 차이는 모든 leg에서 **0**이었다.

| 열·모드 | 전체 입력 surface FPS 3회 | 평균 | 실제 첫 이동→bottom 평균 |
| --- | --- | --- | --- |
| primary TS | 54.746 / 50.917 / 54.679 | **53.447** | 57.116 |
| primary N4 | 54.962 / 54.117 / 53.676 | **54.252** (+1.50%) | 58.027 |
| secondary TS | 42.993 / 43.376 / 45.932 | **44.100** | 50.594 |
| secondary N4 | 44.379 / 43.972 / 43.723 | **44.025** (-0.17%) | 50.826 |

primary의 실제 extent는 `0→2236.57200050354`, secondary는 `0→1390.5`, viewport 높이는 둘 다 515.5 logical px다. 전체 입력은 각각 약 4.84초/3.20초이며 첫 이동 대기 33–47ms와 bottom 뒤의 457–483ms를 포함한다. 실제 이동 중 최대 surface 간격은 TS **100.51/69.16ms**, N4 **103.91/65.22ms**(primary/secondary)였다. 끝점 대기를 평균에서 임의로 빼지 않고 두 범위를 함께 보고한다.

N4의 owner별 native create/reuse/destroy는 **2/732/2, 2/729/2, 2/723/2**였다. TS는 **731/0/731, 707/0/707, 727/0/727**이었다. 독립 SDK producer-result 집계와 일치했고 모든 종료에서 live backing/bytes가 0이었다. 실제 이동 안에 완전히 포함된 QPC bucket의 N4 reuse는 primary **178/177/173**, secondary **101/102/101**로 각 leg의 native 실행을 확인했다. 두 모드 모두 peak는 1 backing / **15,790,448 bytes**, TS fallback 0이었다. N4 miss도 기존 C++ import를 사용한다.

별도 진단 owner는 TS/N4 각각 1개이며 cadence 평균에 넣지 않았다. TS→N4 import 준비 평균은 primary **1.798→0.082ms/frame**, secondary **1.912→0.082ms/frame**였지만 producer wait는 **2.938→3.253 / 3.291→3.543ms/frame**였다. 이는 host wall이고 독립 GPU 시간·scanout은 관측하지 않았다. 전체 경로의 일관된 개선이 없어 **N4 기본 미채택**이며 60 surface FPS·체감 부드러움 수락도 없다.

TS 진단의 description/key는 열당 합계 **1.094/1.002ms**, layout 전체는 **15.427/16.264ms**(23/21 calls, 19/17 cache misses)였다. capture는 평균 **0.135/0.140ms**, transfer는 약 **0.003ms/frame**였다. layout의 최대 **46.99/35.06ms**도 남아 있다. 서로 겹치는 stage·section wall을 더하지 않는다. 이 수치는 N1/N2/N3 추가 구현 전 제품의 진단이며 새 공급의 성능으로 재사용하지 않는다.

이 비교의 native inputs는 `10a1fb291e03a5a3c7c2426f212f7da28a7dc0013282f6122e6a5c51f19e446d`, SDK inputs는 `12241056deaa5a96f3d02eb844117a0943dc1635c5f981a031a018d40db723a1`, manifest는 `7fda45c516a2e66b1deb0a7d5a7b14454765d2810b281cd92a973a4cdbea3efc`, bytecode는 `928702c846a28fbabeb9ef383e9a5f18c5c66d28c8106ee8191a4cd35854d983`이었다. 추가 후보 공급은 별도 identity로 다시 확인한다.

### 13.2 회귀·실패 범위

- 추가 N1/N2/N3 공급 뒤 Gallery **33 PASS / 1 SKIP**, scroll engine **292 PASS**, native paint/resource **71 PASS**, layout constraints **7 PASS**, engine/manual module/audit **13 PASS**, 전체 구간/audit **7 PASS**, 입력 geometry·retained geometry·원본 paragraph query·전달된 native shadow **11 PASS**를 확인했다. 전체 type check와 package boundary 검사도 통과했다. 반복 집계에 겹치는 테스트를 하나의 총합으로 더하지 않는다.
- 전체 구간/audit의 7개에는 전달된 Windows archive를 직접 link한 실제 D3D/Vulkan pixel·consumer ACK·외부 texture 거부·세대 교체·idle backing 축출·drain 검사가 포함된다(각 모드 16 frames, N4 create 7/reuse 9, peak 3/114,688 bytes). 같은 executable은 shared core의 paragraph 봉인에 대해 DPR 1.25/2 × width 80/170/+∞의 6조건에서 한글·emoji·결합 문자·BiDi·style·placeholder·ellipsis·clip의 direct/sealed 512×256 GPU pixels를 정확히 비교했다. 이 shared core 검사와 실제 N2 JSI 실행을 구분한다. Native shadow는 DPR 1/1.25/1.5/2에서 통과했다.
- 새 N1 kernel은 실제 C++/TS 비교 12 조건에서 child constraints·순서·size/offset/overflow가 정확히 일치했다. 새 engine verifier는 startup-only·SDK 불일치·fallback 불일치·미회수 frame을 거부했다. 이 소스 검사를 Testbed 실제 native 실행으로 치환하지 않는다.
- 초기 표식의 추가 RepaintBoundary는 제거했고 그 이전 FPS/CPU 수치는 사용하지 않는다. 측정 전에 차단된 환경/identity 오류와 복구 build 중 source 변경 오류도 제품 표본에서 제외했다. 최종 N4 cadence 3쌍 후 진단 1회는 눌린 마우스 버튼을 감지해 실패했으며, 진단만 별도 재실행해 통과했다. 매 실행의 일반 App 소스·임시 fixture는 복구·삭제됐다.
- 새 공급의 일반 App 복구·실행 identity는 §13.4에 기록한다. 앞 N4 단계의 App hash를 현재 최종 제품으로 재사용하지 않는다.

### 13.3 N1/N2/N3 전체 구간 비교

현재 native 공급은 `a21fe7850ce00f00c5d255dcf1f26ba4e0507d03711c5216c95212aac9df9e32`다. 하나의 optimized Release Hermes bytecode package에서 TS/text/layout/frame을 각각 fresh owner 3회 실행했고 두 번째 회차는 순서를 뒤집었다. 뒤이어 mode별 진단 owner 1개를 따로 실행했다. 12개 cadence owner와 4개 진단 owner 모두 현재 catalog의 양 열 7+7 sections·실제 extent·폰트·이미지·top 복귀·원래 입력 구간 안 bottom·독립 surface trace/counter 일치를 통과했다. 환경은 N4 비교와 같은 2560×1459 / DPI 192, viewport 515.5·각 열 width 492이며 extent도 같다. 앞 N4 cohort와 새 공급 수치를 하나의 before/after 쌍으로 섞지 않는다.

| 모드 | primary 평균 surface FPS | secondary 평균 surface FPS | 각 열 TS 대비 | 결정 |
| --- | ---: | ---: | --- | --- |
| TS control | 52.592 | 42.513 | 기준 | 기본 유지 |
| N1 `layout` | 52.641 | 41.784 | +0.09% / −1.71% | NO_ADOPTION |
| N2 `text` | 54.070 | 43.778 | +2.81% / +2.98% | NO_ADOPTION |
| N3 `frame` | 52.935 | 42.565 | +0.65% / +0.12% | NO_ADOPTION |

평균은 최초/endpoint 대기를 포함한 원래 입력 시간의 surface counter다. 세 후보 모두 지속 60 FPS를 충족하지 않으며 N2의 작은 평균 차이도 물리 표시·체감 개선의 수락이 아니다. 새 후보에서 실제 이동 간격의 최댓값은 primary 약 80–101ms, secondary 약 68–87ms였다. 별도 CPU 진단을 이 3회 평균에 넣지 않았다.

- **N1:** cadence owner당 native plan/placement는 197/203/200쌍, 두 단계 child 숫자 방문은 948/980/964였다. 원래 이동 시간 안에 완전히 포함된 QPC bucket의 child 방문은 매 회 primary 156 / secondary 56이며 SDK와 native 총계가 일치했다. 이 장면에서 TS fallback은 0이다. 첫 지원 범위는 한 Flex의 순수 숫자 두 단계이며, §5의 장기 subtree session·dirty delta·Stack/Wrap 구현이나 한 번의 subtree JSI 계약을 달성한 것으로 쓰지 않는다. 왕복·지원 판정까지 포함한 이득이 없어 이 범위에서 확장을 멈추고 기본 채택하지 않는다.
- **N2:** 매 cadence owner에서 native paragraph transaction 218회 / op 651개 / UTF-8 2,246 bytes였다. 완전히 포함된 이동 bucket의 실제 transaction은 primary 19 / secondary 15였다. cache hit는 native 생성 수에 넣지 않았고 fallback 0, SDK/native 집계가 일치했다. 기존 TS cache·font catalog·paragraph/query identity를 공유하며 별도 native intern/cache·section 전체 batch는 추가하지 않았다. 진단의 text layout 합계는 TS 24.664/15.640ms → text 16.802/14.732ms였지만 별도 owner 1회이며, description/key 준비는 여전히 TS에서 약 1ms/열이다. 이 국소 수치를 전체 제품 속도 이득으로 확대하지 않는다.
- **N3:** cadence native seal=admit=실제 retirement는 각각 699/697/704로 균형을 이뤘고 SDK seal/admit/encoded bytes와 일치했다. 완전한 이동 bucket의 admission은 primary 224/168/168, secondary 94/95/95로 실제 작업을 확인했다. fallback 0, peak 2 segments / charged metadata 98,192 bytes, drain 뒤 live 0 / bytes 0이었다. metadata 비용 계산은 encoded bytes + commands×256 + handles×64이며 실제 process/GPU 전체 메모리 측정치가 아니다. 한 frame의 closed segment와 native recording lease를 구현했으며 frame 사이 segment cache/reuse·TS capture/registry 제거를 주장하지 않는다. 진단 capture 평균은 TS 약 0.136/0.137ms → frame 0.140/0.148ms, submit 평균은 약 1.467/1.395ms → 1.561/1.537ms로 총경로 이득을 확인하지 못했다.

N1/N2는 transaction 밖에서 새 native 객체를 붙잡지 않는다. N3는 mutable Paint/Rect/RRect/Matrix와 paragraph picture를 봉인하고 native resource hold를 recording과 GPU 작업에 연결한다. JS wrapper의 명시적 dispose만으로 GPU hold를 풀지 않으며 native drain에서 실제 회수 수와 남은 객체를 확인했다. 개별 선택과 사용자 요청에 따른 `all` 통합 선택을 제공한다.

### 13.4 개별 후보 단계의 기능 회귀와 일반 App

TS/text/layout/frame에서 각각 별도 fresh owner 1개로 maximize/restore/minimize/restore, 양 열 Gallery, eager Mixed의 12 fields·36 buttons, OS wheel 왕복 뒤 refocus 없는 정확한 키 입력, 실제 한글 IME 조합·확정·undo, 같은 owner의 Gallery 양 열 복귀를 검사했다. 네 owner 모두 exit 0 / forced=false, allocation·text-input·React 오류 없음, `views=0 consumers=0 gpuDrained=1 inputRetired=1`로 종료했다. 후보별 실제 native 작업·SDK 집계·fallback/회수도 verifier를 통과했다. Gallery 복귀 최대 관측 gap은 네 mode에서 약 50–98ms였다. 진단·desktop capture를 켠 기능 회귀이며 일반 cadence나 물리 키보드·트랙패드 수락으로 쓰지 않는다. N4는 앞의 native generation/ACK/drain 검사 범위이며 이 네 owner의 창 전환 검증을 N4 결과로 확장하지 않는다.

기능 회귀 package identity는 native `a21fe785…9e32`, SDK `69b102c3…2e4a`, manifest `7d077cd6…0493`, HBC `7a034781…83b4`였다. 이는 §13.3의 cadence/별도 진단 fixture를 다시 빌드한 **기능 회귀 전용** package이며 그 성능 수치를 대표하지 않는다.

`finally` 복구 후 `npm.cmd run run:windows --workspace @nelyx/testbed-2`로 일반 App을 실제 실행했다. App 원문은 Git HEAD와 byte 단위로 같고 임시 fixture가 없다. 시작 보고는 `inputGeometry=ts`, `sceneComposition=false`, `semanticsGeometry=false`, `sceneBatch=none`이다. source map의 현재 TS 입력과 설치된 SDK **9 packages**의 내용이 일치하고, Skia native/RN의 canonical/generated/install **181 files**도 각각 일치한다.

| 개별 후보 단계 일반 App 항목 (최신 통합 공급은 §14) | SHA-256 |
| --- | --- |
| Native inputs | `a21fe7850ce00f00c5d255dcf1f26ba4e0507d03711c5216c95212aac9df9e32` |
| Installed SDK inputs | `69b102c3787022b082fd49d0fb8cef0edff0d8ea774cb20920a3661d45312e4a` |
| Ordinary App inputs | `17946713fd2d59c09d8e872429237bb5aa69d738829610077199315d87e338fd` |
| Package manifest | `53ae704cfc14e835ebf45ef6ba12b996c1f0a059ffd56db38e6ce08f761fee85` |
| NelyxRNHost.exe | `89218bcd7622aaa37e8506a9033d4da44ae0f8e9d2ac9f07fd94648c9c5dace4` |
| Ordinary optimized Release Hermes bytecode | `d8ba273e3439a06db0d877b7aa10451dea166037deda3ec2912c733ee46a3ede` |

평소 명령으로 연 일반 App에서도 OS wheel 왕복 뒤 refocus 없는 키 입력 3회, 12 fields·36 buttons, 전송·횟수·초기화, 실제 한글 IME 조합·확정·undo와 Gallery 복귀를 통과했다. 각 키의 Core value receipt 최댓값은 145.50ms였으며 물리 키보드 latency 수락이 아니다. 마지막 창을 정상 닫은 뒤 CLI는 `nelyx.run/v2 exitCode=0`으로 종료했다. 일반 실행에는 실험·frame/input 진단 환경 변수를 넣지 않았다.

임시 `.rnw-*` fixture와 소유 Testbed process가 남지 않았고 App 원문을 복구했다. 현재 dist·Windows SDK archive는 package별 하나이며 별도 로그·receipt·history 출력은 남기지 않았다. 이번 작업에서 만든 이전 N4 준비본 `10a1fb29…446d`는 현재 runner의 참조가 없고 현재 입력이 `a21fe785…9e32`임을 preview로 확인한 뒤 해당 폴더 하나만 정리했다. 기존 사용자 native cache와 다른 대상 공급은 건드리지 않았다.

이 문서의 첫 구현 범위는 종료한다. N1의 장기 subtree session과 N2의 추가 intern/batch, N3의 frame 간 reuse는 구현 완료로 표시하지 않는다. 총경로 이득이 확인되지 않아 이번 범위를 기본 채택하지 않고 추가 구조 확장은 별도 근거가 생길 때 다룬다. 최종 제품은 **PARTIAL**, `performanceAccepted=false`, `resizePerformanceAccepted=false`다. 새 후보는 Windows bytecode의 위 범위에서만 검증했으며 Static AOT·Web·Android native 실행과 물리 표시·입력의 수락을 추가하지 않는다.

## 14. 사용자 요청 — C++ all에 새 후보 통합

사용자가 전체 C++ 활성화를 요청해 기본 `npm.cmd run run:windows:cpp`와 명시적 `--module=all`에서 기존 모듈에 N1 Flex·N2 text transaction·N3 frame segment·N4 backing을 함께 켜도록 수정했다. 일반 App의 TS 기본값과 앞의 성능 미채택 판단은 유지한다. `all`은 지원되는 native 경로를 함께 선택하는 것이며 Widget/Element·사용자 callback·지원 밖 동작까지 C++로 재작성했다는 뜻이 아니다.

`all`에도 bounded Gallery 관측과 backing audit을 설치하고 종료 시 engine 3개와 backing을 독립 검증한다. 모듈 하나의 작업으로 다른 모듈을 `observed`로 표시하지 않는다. 새 모듈 선택 누락·SDK/native 불일치·frame 미회수·backing 미회수는 실패다. 봉인된 frame의 실제 admission/replay에서도 native Path/Paint·clip 작업을 집계한다. 외부 Scene/Semantics session은 기존 순서로 닫고 renderer/GPU drain 뒤에 frame retirement와 engine 보고를 확정한다.

현재 구현·단위 회귀·Windows supplier 재빌드와 실제 기본 명령의 통합 Testbed, 별도 fresh owner의 Gallery → Mixed → Gallery 기능 회귀, 일반 App 복구·실행·정리가 완료됐다.

통합 공급의 native 입력은 `4d361037655c25510fab1e1282755b99a5acca1ad05f29394d50a095e97c74c0`, 설치 SDK 입력은 `fc79f86467e919febb7e971f52cb4e76aa678783da5e0d497e481da56fe6c81d`다. 기본 명령이 만든 수동 package의 manifest는 `d30d9c83f69b844eb7bd4886b28713e4b95f4ea17f3305dfdd8a49bf3a544b62`, executable은 `3b3fb6a6ccc706a2891d9e13f107f3d08561275d7bf003d078b62ecab1e30dc9`였다. source map과 Skia native/RN 각각의 canonical/generated/install 181 files가 일치했다.

| 통합 검증 | 기본 명령의 실제 창 | 별도 fresh owner 기능 회귀 |
| --- | --- | --- |
| 실제 native 실행 보고 | inputGeometry/path/paint/clip/composition/semantics/layout/text/frame/backing 모두 `observed` | 같은 10개 항목 모두 `observed` |
| Flex plan/placement · child 숫자 방문 | 193쌍 · 2,526 | 246쌍 · 2,798 |
| native text transaction | 158 | 175 |
| frame seal = admit = retirement | 979 = 979 = 979 | 3,543 = 3,543 = 3,543 |
| frame peak / charged metadata | 2 / 167,896 bytes | 2 / 186,744 bytes |
| backing create/reuse/destroy | 2 / 977 / 2 | 4 / 3,539 / 4 |
| backing peak | 1 / 15,790,448 bytes | 1 / 15,790,448 bytes |
| 종료 | exit 0 / forced=false / frame·backing live 0 | exit 0 / forced=false / frame·backing live 0 |

기본 명령의 실제 창에서 12 fields·36 buttons, OS wheel 왕복 뒤 refocus 없는 키 입력, 한글 IME 조합·확정·undo를 통과했다. 첫 입력 시도는 `foregroundOwned=false`로 중단됐고 재시도에서 통과했다. 창 소유권 실패를 성공 표본으로 바꾸지 않았다. 수동 owner 전체의 작업 수이며 startup·탐색도 포함한다. 자동 cadence나 물리 표시의 성능 증거가 아니다.

별도 fresh owner에서는 최대화/복원/최소화/복원 → Gallery 양 열 → Mixed 실제 편집/IME → 같은 owner의 Gallery 양 열 복귀를 통과했다. 복귀의 최대 관측 gap은 72.46/55.07/90.98/96.80ms였고, `views=0 consumers=0 gpuDrained=1 inputRetired=1`로 닫혔다. retained geometry의 cold-provider fallback은 1회였고 Semantics fallback 2,188회를 별도 보고했으며 새 engine 세 모듈의 fallback은 0이었다. 각 모듈의 관측과 fallback을 따로 유지하며 100% C++ 처리라고 표시하지 않는다.

새 회귀는 module/audit **7 PASS**, engine 후보 **6 PASS**, paint/resource/lifetime **71 PASS**, 실제 통합 Windows 기능 **1 PASS**다. `all`의 engine/backing 보고 누락과 SDK/native 작업 수 불일치를 거부하고, 같은 모듈의 native 작업이 없으면 다른 모듈의 작업으로 가리지 않는다. 현재 통합은 수동 C++ 선택 기능이며 앞의 개별 후보 3쌍 수치를 통합 모드의 성능으로 재사용하지 않는다.

마지막으로 평소 `npm.cmd run run:windows --workspace @nelyx/testbed-2`가 일반 App을 다시 빌드·실행했다. 시작 보고는 TS / Scene·Semantics 후보 false / sceneBatch none이었고, 12 fields·36 buttons의 스크롤·전송·횟수·초기화·복귀를 확인한 뒤 exit 0으로 닫았다. 일반 App의 마지막 확인은 ActionsOnly이며 한글 IME 증거는 앞의 통합 C++ 두 owner 결과다.

| 최종 일반 App | SHA-256 |
| --- | --- |
| App inputs | `5f50b5ed0f59e0c23ede113ad07ef06bc4d58d29622d5d7091c52f5f8401a1b2` |
| Package manifest | `f2d34308bc0e6b9f5306454d908b323d22dced7533f7dc17048303d94f2f2212` |
| Executable | `3b3fb6a6ccc706a2891d9e13f107f3d08561275d7bf003d078b62ecab1e30dc9` |
| Ordinary optimized Release Hermes bytecode | `d8ba273e3439a06db0d877b7aa10451dea166037deda3ec2912c733ee46a3ede` |

현재 설치 SDK 9 packages와 원본·source map 입력이 일치하고 Windows SDK archive는 각각 현재 1개만 유지한다. App 원문은 HEAD와 byte 단위로 같고 `.rnw-*` fixture·소유 Testbed process가 없다. 이전 준비본 `a21fe785…9e32`는 현재 runner의 참조가 없고 선택된 입력이 `4d361037…74c0`임을 preview로 확인한 후 해당 폴더 하나만 정리했다. 기존 다른 native cache는 유지했다. 변경 소스의 lint/format과 diff 검사가 통과했으며 별도 검증 로그·receipt는 남기지 않았다.
