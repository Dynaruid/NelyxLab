# 추가 C++ 엔진 후보와 All components 전체 구간 스크롤 검증

작성: **2026-11-03 KST** · 상태: **DESIGN_ONLY / 소스 검토·계획 작성 완료 / 구현·새 측정 미실행**

**새 C++ 후보는 레이아웃 subtree 처리, 텍스트 구성·측정, 프레임 봉인·자원 입장, Windows GPU backing 재사용으로 넓힌다.** 기존 geometry·Path/Paint·Scene·Semantics 후보와 구분해 하나씩 평가한다. 실제 지배 병목인지는 아래의 새 전체 구간 기준에서 먼저 확인한다.

**주 성능 검증은 Material Gallery의 `All components`에서 양쪽 열의 lazy load를 끝까지 예열한 뒤, 각 열의 최상단에서 실제 최하단까지 이동하는 것으로 바꾼다.** 기존 5초짜리 좁은 왕복 결과는 이 전체 구간 결과를 대신하지 않는다. 전체 로딩 완료·시작점·종료점·중간 섹션 coverage를 함께 확인한다.

[work5.md](work5.md)는 기존 구현·재실험·수동 C++ 모드의 기록으로 유지한다. 이 문서의 새 후보와 검증 방법은 아직 구현하지 않았다. 기존 일반 기본값 **TS**, 후보 **NO_ADOPTION**, 제품 **PARTIAL**, `performanceAccepted=false`, `resizePerformanceAccepted=false`를 이어받는다.

## 1. 현재 확인한 출발점

- 작성 시 HEAD는 `6505484c46333313cd1660cbc236299d325b9a99`, 작업 트리는 clean이었다. 이번에는 소스와 문서만 읽었으며 설치본·실행 제품 identity를 새로 인증하지 않았다.
- [work5 §14](work5.md)의 retained 비교는 실제 C++ 실행이 있었지만 Mixed 평균이 **49.314698→40.292055 surface FPS**로 약 18.30% 낮았다. TS eligibility·변경 생산·전송·결과 반영을 포함한 경로의 결과다.
- work5 §16의 재실험도 snapshot·Path·clip/Paint·Scene·Semantics를 모두 기본 채택하지 않았다. Native 실행 사실과 전체 경로의 순이득은 별도 조건이다. 새 후보의 근거로 기존 kernel 성능만 재사용하지 않는다.
- work5 §17에는 `npm.cmd run run:windows:cpp`와 개별 module 선택이 이미 있다. 수동 결과의 `observed`는 native 작업 확인이며 FPS 향상의 증거가 아니다.
- [현재 cadence](Nelyx/eng/run-rnw-cadence.mjs)는 Gallery 좌/우에 각 방향 **5초**를 전달한다. [OS wheel helper](Nelyx/eng/tests/windows-continuous-scroll.ps1)도 기본 보고를 `packet-defined reversals`로 표시한다. 이미 있는 `RangeExtent` 경로는 전달받은 extent를 이동하는 기능이며, 모든 섹션의 로딩·측정 완료를 인증하지 않는다.

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

아래 진단 항목은 **새 내부 관측 계약의 제안이며 아직 구현되지 않았다.** 기존 controller·index·resource 수명에서 읽는 opt-in 상태로 제공하고 제품 UI에 개발자 체크리스트를 추가하지 않는다.

| 항목 | 통과 조건 |
| --- | --- |
| catalog coverage | expected IDs = 한 번 이상 구성·layout·초기 준비를 완료한 IDs, 누락 0 |
| extent measurement | 두 열 모두 모든 대상 index가 현재 configuration에서 measured |
| 초기 자원 | 해당 section에서 발생한 유한 초기 작업의 미완료 0, 오류 별도 명시 |
| 환경 | catalog/column/폭/theme/locale/text scale/DPI·owner 세대 일치 |
| 안정성 | extent와 관련 revision의 수렴 확인. 변경 이유를 알 수 없는 경우 실패 |
| 시작 위치 | 양쪽 실제 offset이 각각 `minScrollExtent`에서 **0.5 logical px 이내** |
| 실제 끝 확인 | 예열 중 각 열의 마지막 section을 실제 layout·유효 frame에서 확인 |

`measurement(index)`, `totalExtent`는 이미 있지만 Gallery private scroll owner의 coverage·초기 자원 상태를 함께 내보내는 완료 gate는 없다. 새 도구가 이 증거를 만들기 전에는 현재 cadence를 `fully-loaded`로 부르지 않는다.

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

**이미 C++인 부분을 다른 소유 구조로 바꾸는 후보다.** [win32_import.inc](Nelyx/skia/native/platforms/vulkan/win32_import.inc)는 frame별 import 과정에서 Vulkan image/memory·command buffer·surface/recorder 등을 준비하고 producer/consumer fence를 관리한다. 매번의 생성 비용과 같은 backing 재등장 여부를 새 전체 구간에서 확인한다. 과거 import wall을 새 제품의 측정값으로 쓰지 않는다.

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

새 class·API 이름과 protocol은 아직 없다. 아래는 구현할 경우의 소스 경계이며 실제 capability를 추가할 때 실행 audit와 fallback 보고도 함께 추가한다.

| 단계 | 수정할 위치·작업 | 종료 조건 |
| --- | --- | --- |
| W6-0 전체 구간 도구 | Gallery/controller·section 준비/extent의 opt-in 관측, `run-rnw-cadence.mjs`, `windows-continuous-scroll.ps1`, native experiment 도구에 §2–3 절차 추가 | 양 열 전부 예열·측정·top→bottom 증거가 있는 TS 기준 3 owners. 짧은 왕복은 별도 control |
| W6-1 병목 재귀속 | 기존 [FrameDiagnostics](Nelyx/src/ui/frame-diagnostics.ts)·RNW probe로 section별 layout/text/capture/admission/producer를 구분 | 전체 이동 중 지배 비용과 각 후보의 실제 수요를 확인. 겹치는 wall 구간을 합산하지 않음 |
| W6-2 작은 독립 후보 | N4 backing 수명 조사 또는 N2 text transaction 중 근거가 큰 하나부터 | 실제 native 작업·지원률·총경로 이득·정확성·메모리 확인 |
| W6-3 구조 후보 | N1은 boxes/wrap/constraints·[hosting services](Nelyx/src/hosting/services.ts)·공통 core/JSI, N3은 frame/resources/scene/native core를 확장 | 하나씩 별도 모드·일반 제품 비교. 준비 비용·TS fallback 포함 |
| W6-4 선택적 후속 | 남은 비용에 따라 다른 후보나 N5 진입 | 수요·지원 계약·순이득이 없으면 비진입 |
| W6-5 최종 확인 | 채택 조합 공급·전체 구간 재검증·기능 회귀·일반 App 복구·정리 | 후보별 채택과 전체 제품 수락을 구분한 짧은 현재 상태 |

N1/N2/N3의 순수 kernel은 기존 `Nelyx/skia/native/core/`에 두고 JSI는 기존 adapter의 얇은 경계로 제공한다. N4는 기존 Windows Vulkan/platform 코드에서 다룬다. canonical source만 원본으로 편집하고 generated 사본은 기존 공급 도구로 갱신한다. 새 DLL·별도 VM·Wasm toolchain을 필수로 추가하지 않는다. Web/custom backend의 기존 TS 경로를 유지한다.

공통 경계는 TS Number에 맞는 `double`과 기존 행렬/숫자 의미를 유지하고 `fast-math`로 결과를 바꾸지 않는다. owner·session·node/resource generation·layout/frame revision을 검사한다. 각 모듈의 node/depth/bytes·입출력 복사·staging/scratch/capacity 상한을 schema와 함께 먼저 확정하고 allocation 전에 검증한다. JSI 입력은 native 소유로 복사하며 반환 뒤 JS buffer 포인터·JS 함수·Runtime 참조를 보유하지 않는다. 잘못된 protocol·공급 불일치와 정상 custom fallback은 별도 결과다.

## 11. 실행 검증·성능 수락·정리

### 11.1 새 도구에 반드시 추가할 실패 검사

- 처음 관측한 작은 extent만 왕복, 한 열만 예열, planned/필터로 expected IDs 불일치, 중간 section 건너뜀, 이미지 준비 미완료를 거부한다.
- 측정 직전 offset이 top이 아님, 실제 bottom 미도달, 뒤늦은 보완 입력으로 완주 표시, DPI/폭/theme 변경, foreground 상실·partial OS input을 거부한다.
- 전체 gate를 통과한 뒤 정상 cache 축출로 재구성된 경우는 비용에 포함한다. 새 미방문 section·무효 configuration을 성공으로 숨기지 않는다.
- 명시적 C++ capability 누락은 시작 실패다. 실제 native 작업 0, SDK/native 불일치·window 밖 startup 작업·fallback-only·미해제 session을 native 성능 성공으로 쓰지 않는다. 무수요 section은 control로 구분한다.
- 입력 구간 안에 완전히 들어온 native QPC bucket으로 audit한다. 구간이 너무 짧아 유효 bucket이 없으면 판정 불가다. counters-only 수동 보고를 timing 증거로 대신하지 않는다.

### 11.2 정확성과 실제 제품

변경 영역에 맞게 기존 검사를 선택한다. 아래는 **현재 존재하는 검사 이름이며 이번 작성에서 실행하지 않았다.** 새 모듈·전체 구간 verifier의 검사는 구현과 함께 등록한다.

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

현재의 `experiment:native-services -- --trials=3 --functional`은 기존 audit 회귀로 유지한다. **그 명령을 수정 없이 실행한 결과만으로 새 fully-loaded 전체 구간 검증을 통과했다고 쓰지 않는다.** 기존 cadence/experiment/manual launcher에 새 coverage protocol과 native 선택·실행 audit를 연결한 뒤 지원하는 새 명령 형식을 문서화한다. 아직 없는 full-range 옵션을 현재 실행 가능한 명령처럼 제시하지 않는다.

사용자 직접 확인의 현재 실행 명령은 다음과 같다. 자동 전체 로딩 완료 gate는 아직 없으며, 수동 확인은 §3의 순서로 수행한다.

현재 C++ preview의 `all`은 work5에서 구현한 기존 모듈 묶음이다. **새 N1–N5는 아직 포함되지 않는다.** 새 후보는 구현과 capability·선택 보고·실행 audit를 추가한 뒤 개별 모드로 연결한다.

```powershell
# 일반 TS 제품
npm.cmd run run:windows --workspace @nelyx/testbed-2

# 기존 C++ preview: 표시 모드는 선택값, 종료 집계로 실제 작업 확인
npm.cmd run run:windows:cpp
```

### 11.3 채택과 종료

- 각 후보를 독립 선택해 같은 전체 로딩·전체 이동 조건의 3쌍을 비교한다. 호출/전송/검증/결과 반영·예열 비용·steady state·회수 비용을 함께 보고한다. kernel 단독 속도·startup native 작업으로 채택하지 않는다.
- 전체 구간의 평균·section별 느린 구간·입력 응답·peak memory가 함께 나아지는지 판단한다. 지속 60 surface FPS와 체감 끊김 해소가 미달이면 일부 후보를 채택해도 제품 **PARTIAL**을 유지한다. 기존 350ms 시각 생존 검사 통과는 smoothness 수락이 아니다.
- source→generated→현재 dist/archive→runner 설치본→실행 package와 native/SDK/App 입력 identity를 대조한다. Windows bytecode를 주 비교로 하고 Static AOT의 type/build/runtime 증거를 따로 구분한다. 채택된 공통 변경은 최신 Web fallback·Android 공급/회귀를 확인하며 미실행 플랫폼을 수락으로 확대하지 않는다.
- 테스트 timeout은 **1,200,000ms(20분)**, 대부분 반복은 **30회 이내**다. 전체 예열·이동이 길어지면 반복 개수를 줄이고 구간을 줄이지 않는다. 중단·표본 부족은 명시한다.
- coverage/히스토그램·audit 집계는 bounded RAM으로 관리하고 현재 결과만 이 문서에 짧게 남긴다. 임시 fixture·App patch·staging·소유 process는 성공/실패/중단 모두 `finally`에서 복구·정리한다. 과거 package/SDK 사본·로그·receipt·checkpoint/history JSON을 누적하지 않는다.
- 현재 dist만 유지하며 `Nelyx/docs/plans/`·`Nelyx/docs/migrations/`를 생성하지 않는다. 기존 사용자 cache/emulator와 과거 삭제 차단 항목을 임의로 정리하지 않는다. 문서 작성 단계에서 기존 C++ 후보를 기본 활성화하거나 제품 캐시 예산을 바꾸지 않는다.

## 12. 현재 상태와 다음 시작점

| 항목 | 상태 |
| --- | --- |
| 기존 C++ 구현·재실험과 새 영역 대조 | 완료 |
| lazy load 완료 후 양 열 top→bottom 검증 설계 | 완료 |
| N1–N5와 우선순위·중단 기준 설계 | 완료 |
| 완료 gate·새 전체 구간 runner·새 C++ 모듈 구현 | 미실행 |
| 새 전체 구간 제품 공급·측정·수락 | 미실행 |

다음 작업은 **W6-0: All components의 모든 대상 section을 예열하고 각 열의 실제 최상단→최하단을 증명하는 도구부터 구현**하는 것이다. 그 기준에서 병목을 다시 나눈 뒤, N4/N2의 독립 후보와 N1/N3의 구조 변경을 근거에 따라 선택한다.
