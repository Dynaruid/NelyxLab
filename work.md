# 앱 버벅임·긴 프레임 감소 작업계획

작성: **2026-11-16 KST** · 코드 검토 기준: **`092c393`**

상태: **READY / 구현 NOT_STARTED / 성능 notVerified**

이번 요청의 산출물은 개선 아이디어 검토와 실행 가능한 작업계획이다. 현재 코드와 이력을 읽어 이 문서를 작성했으며, 제품 코드 수정·빌드·앱 실행·성능 측정은 하지 않았다. 이후 실행 시에는 이 문서의 상태와 결과를 갱신한다.

## 1. 목표와 작업 원칙

목표는 Windows Demo의 낮은 FPS와 스크롤·달력 전환 중 긴 프레임을 줄이는 것이다. 공통 Source/SDK 변경은 Testbed와 Web에도 회귀가 없어야 한다. Android와 다른 플랫폼의 성능 수락은 실제 해당 환경에서 확인하기 전까지 별도로 남긴다.

1. **코드·소유권·호출 경로 분석 → 원인 가설 → 해결 설계 → 적용 → 검증** 순서로 진행한다. 계측 확대나 반복 실행으로 원인 찾기를 먼저 시작하지 않는다.
2. 평균 FPS만 보지 않고 첫 진입, 이미 본 구간 복귀, 연속 동작의 CPU 시간·입력 대기·진행 정체를 구분한다.
3. Widget·Element·State·layout·gesture·scroll 정책은 현재 Source 프레임워크에 유지한다. native 변경은 문단·drawing·자원·OS transport의 기존 경계 안에서 수행한다.
4. 한 작업 단위의 관련 변경을 모아서 적용하고 해당 회귀를 확인한다. 각 작은 수정마다 전체 SDK/native 빌드를 반복하지 않는다.
5. 이미 있는 캐시·batch·준비 기능의 적용 여부를 확인한 뒤 수정한다. 새 캐시나 별도 스케줄러를 중복 도입하지 않는다.
6. [.github/copilot-instructions.md](.github/copilot-instructions.md)에 따라 검증은 **20분 timeout**, 시나리오 반복은 원칙적으로 **30회 이내**로 제한한다. 한 실행의 임시 파일·소유 프로세스는 성공·실패·중단 모두 `finally`에서 회수한다.

## 2. 현재 판단의 출발점

[work12 종료 기록](history/26/11/14/work12-summary.md)에 따르면 11월 15일 사용자는 주기적 스크롤 버벅임과 고속 달력 전환의 애니메이션 누락이 해결됐다고 확인했다. **낮은 평균 FPS는 남았으며 상승은 확인되지 않았다.** 해결된 증상을 현재도 재현되는 문제로 가정하지 않는다.

같은 기록의 과거 가상 입력에서는 목록 첫 하강의 Source frame CPU p95 **39.6ms**, 새 섹션 layout 최대 **47.7ms**가 남았다. 고속 달력에서는 layout 최대 **84.7~155.5ms**, 입력→surface 지연 최대 **571.3ms**도 관측했다. 이 값은 당시 공급·입력·실행 구간의 이력이며 현재 checkout의 baseline 또는 물리 트랙패드 결과가 아니다.

[이전 GC 검토](history/26/11/14/report-summary.md)는 할당·회수의 비용 가능성을 남겼지만 GC가 정체 원인임을 입증하지 않았다. 이후 Source 전환으로 예전 `OriginalWidgetHost`·engine transaction 경로가 철거됐다. 예전 response buffer·Core ledger 가설을 현재 경로의 확정 원인으로 가져오지 않는다.

현재 직접 확인한 실행 연결은 다음과 같다.

- [FrameworkRoot.build](Nelyx/src/framework/widgets/root.ts)는 build → layout → optional work → compositing → paint → compose → input geometry → semantics를 한 Source 프레임에서 수행한다. 긴 동기 작업 동안 같은 runtime owner의 다음 입력 처리는 기다린다.
- [ViewRuntime](Nelyx/src/hosting/runtime.ts)은 입력 mailbox, 준비 프레임, GPU admission을 조정한다. 준비 프레임을 먼저 제출하는 경로와 입력 세대 검사가 이미 있다.
- [native-hermes 초기화](Nelyx/sdk/src/backends/native-hermes/application.ts)는 [공통 native engine](Nelyx/sdk/src/runtime/native-engine.ts)을 생성한다. 현재 이 호출에는 `sceneBatch`, `sceneComposition`, `latestInputAdmission`, `inputBatches` 옵션을 전달하지 않는다.
- native engine의 `nativeDisplayLists`는 이미 `true`다. **그리기마다 전부 개별 JSI 호출을 한다는 설명은 현재 코드에 맞지 않는다.** 다만 packet을 만들기 전 Path·Paint·Rect 등의 임시 native wrapper 생성은 남는다.

## 3. 코드 근거로 검토한 개선안

아래 우선순위는 코드상 반복 작업의 명확성·변경 범위·회귀 위험을 기준으로 정했다. 실행 시간 기여도와 개선율은 아직 미측정이다.

| 우선순위 | 개선안과 현재 근거 | 기대하는 변화 | 주의할 경계 |
| --- | --- | --- | --- |
| P1 | layout 대기 목록의 중간 할당 축소. [object.ts](Nelyx/src/framework/rendering/object.ts)의 `PipelineOwner.flushLayout`은 pass마다 Set 합치기·배열·filter·sort·callback Set을 만든다. BuildScope는 이미 [DepthQueue](Nelyx/src/runtime/depth-queue.ts)를 사용한다. | dirty layout 처리에 필요한 임시 객체와 정렬 작업 감소 | 부모 우선 순서·동일 깊이 순서·callback 재진입·실패 복원 유지 |
| P1 | 문단 native transaction 연결 검토. [text.ts](Nelyx/skia/packages/native/src/text.ts)의 `nativeTransactions=false`, `setNativeParagraphTransactions`는 현재 제품 TS 호출부가 없다. transaction 구현과 capability 검사는 존재한다. | cache miss 문단의 style/text/placeholder/build/layout/metrics 왕복 감소 | shaping 자체와 Source build가 없어지는 것은 아님. operations 배열·native parsing 비용 포함 |
| P1 | scene packet 생성 전 임시 wrapper 축소. [scene.ts](Nelyx/skia/packages/native/src/scene.ts)의 `sceneBatch`는 path/paint/all을 지원하나 현재 direct 앱은 기본 none이다. | display-list 준비에 쓰는 JSI wrapper와 생성·dispose 감소 | 기존 display-list 위의 추가 개선. path/paint/all을 한꺼번에 켜서 효과를 섞지 않음 |
| P2 | retained composition 비교 중복 축소. [context.ts](Nelyx/src/framework/painting/context.ts)의 `composeInto`는 reuse 판정 후 transform 갱신 경로에서 구조·명령을 다시 검사하고 Map·snapshot 배열을 만든다. | 이미 그린 구간의 스크롤·애니메이션 프레임 CPU 감소 | 구조·command identity·부모 변경·사용자 훅의 관측 의미 보존 |
| P2 | 첫 섹션·새 달력 월의 동기 생산량 축소. Demo는 이미 ListView.builder·section별 통지·repaint boundary를 사용한다. 하지만 새 섹션과 달력 월의 하위 Widget·text 생산은 동기다. | cold frame의 build/layout·단명 할당 감소 | 모든 항목 고정 높이화·전부 KeepAlive·큰 subtree 선행 생성은 피함 |
| P2, 조건부 | 입력 전달·프레임 공정성 보완. [InputBatch.h](Nelyx/skia/native/host/InputBatch.h)는 기본 64개 batch, ViewRuntime은 최대 256개 mailbox와 전체 flush를 사용한다. | 긴 입력 burst 뒤 프레임 대기 감소 | down/up/cancel·keyboard/IME·viewport barrier·속도 추정·누적 delta 보존 |
| P2, 조건부 | semantics snapshot의 변하지 않은 부분 재사용. [semantics-transport.ts](Nelyx/src/framework/rendering/semantics-transport.ts)는 capture마다 여러 Map과 transport 객체를 구성한다. | 접근성을 유지하면서 motion-only 프레임의 CPU·할당 감소 | Windows native upsert/remove delta와 motion 간격 300ms는 이미 존재 |
| P3, 조건부 | 남은 GC·native 회수 정체와 생성 코드의 잉여 검증 축소 | P1/P2 이후에도 남는 긴 tail 개선 | GC 단독 원인·VM 교체 효과를 가정하지 않고 현재 경로만 다룸 |

**먼저 실행할 묶음은 layout 임시 할당, 문단 transaction, scene wrapper 세 항목이다.** 이후 retained composition과 cold 생산을 다룬다. 입력·semantics·GC 변경은 해당 경로에 남은 비용을 설명할 코드 근거가 있을 때 진행한다.

## 4. 단계별 작업

### J-00 — 현재 경로와 변경 경계 고정

상태: **정적 1차 검토 완료 / 실행 시 재확인**

- 이 문서에 적힌 호출부와 현재 checkout 차이를 확인한다. 기존 사용자 변경을 보존한다.
- 앱 진입 → Source 프레임 → native text/scene → GPU retire의 owner와 자원 수명을 정리한다. 함수별로 필수 작업·중복 검사·임시 객체·동기 native 호출을 구별한다.
- 문단 transaction·sceneBatch 등은 **미연결 후보**와 **현재 기본 경로**를 구분한다. native 공급에 함수가 있는지와 앱이 실제 호출하는지도 구분한다.
- 해결 설계가 정해진 뒤 효과 비교용 기준 실행을 최소 1세트 확보한다. 이는 코드 분석 뒤의 비교 자료 확보이며 반복 실행으로 원인을 탐색하는 단계가 아니다. 기준 실행을 확보하지 못하면 이후 개선율은 주장하지 않는다.

완료 조건: 변경할 함수·없앨 반복 작업·보존할 동작·대응 회귀가 지정된다. 기존 이력의 수치로 현재 baseline을 대신하지 않는다.

### J-01 — layout queue의 임시 할당과 반복 정렬 감소

대상: [PipelineOwner](Nelyx/src/framework/rendering/object.ts), 필요 시 [depth-queue.ts](Nelyx/src/runtime/depth-queue.ts).

1. `dirtyLayout`·`layoutCallbacks`를 합치는 과정의 중복 제거·필터링·callback membership 캡처를 한 pass로 정리한다. 우선 기존 batch 의미를 유지하면서 중간 컨테이너부터 없앤다.
2. owner별 작업 배열 재사용 또는 별도의 layout queue가 필요한지 코드로 비교한다. BuildScope의 intrusive 필드를 RenderObject에 그대로 섞지 않는다. 작은 dirty 집합에서 heap bookkeeping이 더 비싸면 정렬 방식 자체는 유지한다.
3. flush 도중 다시 dirty가 된 node, 깊이 변경, covered theater의 보류 callback, detach·dispose, 예외 이후 미처리 작업 복원을 보존한다. scratch는 프레임 자원이나 detached node를 다음 프레임까지 불필요하게 붙잡지 않게 비운다.
4. layout이 끝나기 전에 일부 필수 작업을 다음 프레임으로 넘기는 방식은 사용하지 않는다. convergence의 30 pass 제한도 유지한다.

검증: 부모/자식 동시 dirty, 같은 node의 layout+callback, flush 중 재등록, LayoutBuilder의 고립 build scope, 예외 후 재시도, route 덮임/복귀를 확인한다. 기존 [Source 회귀](Nelyx/eng/check-source-framework.mjs)에 필요한 동작 사례만 추가한다.

완료 조건: 기존 동작 결과가 유지되고 pass별 임시 컨테이너 생성이 줄어든다. 전체 layout 시간 개선 여부는 통합 성능 확인에서 별도로 판정한다.

### J-02 — text·scene의 native 경계 비용 감소

대상: [native-engine.ts](Nelyx/sdk/src/runtime/native-engine.ts), [native-hermes/application.ts](Nelyx/sdk/src/backends/native-hermes/application.ts), [text.ts](Nelyx/skia/packages/native/src/text.ts), [scene.ts](Nelyx/skia/packages/native/src/scene.ts).

**J-02A: 문단 transaction**

- 기존 builder 방식과 `nelyxBuildAndLayout`의 입력·출력·예외·자원 소유권을 먼저 대조한다. style stack·foreground/background·placeholder·UTF-16 index·line metrics·무한 width·unlimited lines가 같은지 확인한다.
- 현재 Source가 만든 문단 요청을 그대로 transaction에 전달하도록 engine 생성 경계에 연결한다. 별도 native Widget·날짜 grid·scroll 정책은 추가하지 않는다.
- capability는 service 생성 시 확인한다. 요청한 버전과 공급이 다르면 명확히 실패하고, 현재 경로가 무엇인지 execution counter로 구별한다. Web 및 미수락 backend에 일괄 활성화하지 않는다.
- transaction의 operations 배열과 native validation·copy 비용도 포함해 비교한다. cache hit에는 불필요한 transaction 준비가 들어가지 않게 한다.

**J-02B: scene wrapper**

- `sceneBatch='path'`, `'paint'`, `'all'`의 실제 지원 범위를 읽고 Path/Rect/Paint 등의 wrapper 생성 위치를 확인한다. 현재 활성 display-list를 유지한 상태에서 각 후보를 독립적으로 검토한다.
- 가장 단순하고 반복이 큰 변환부터 packet의 숫자 데이터로 전달한다. shader·image filter·clip·rrect·shadow·fill rule·비대칭 radius·runtime effect의 의미와 temporary 해제 순서를 보존한다.
- sceneBatch를 켰다는 이유만으로 모든 wrapper가 없어졌다고 기록하지 않는다. 남는 wrapper와 fallback은 구분한다.
- `setNativeFrameSegments`도 현재 미연결이지만, seal/admit 단계와 소유권이 추가되므로 별도 고효율 근거 없이 함께 켜지 않는다.

검증: 한글·emoji·RTL·fallback font·줄바꿈·ellipsis·다양한 width·placeholder, paint effect·clip·shadow·CustomPainter, 잘못된 입력·자원 교체·GPU in-flight 중 dispose·종료를 확인한다. 새로운 회귀 runner가 필요하면 `Nelyx/eng/`에 **현재 Source 요청을 입력으로 하는** 작은 검사를 만든다. 기존 폐기된 Original/App projection fixture를 재활용하지 않는다.

완료 조건: 각 하위 후보의 동작 동등성과 lifetime이 통과하고, 관련 JSI 호출·wrapper·준비 CPU가 실제로 감소한 후보만 채택한다. 1회 호출 안의 shaping/raster가 지배적이면 그 한계를 기록한다. 모든 후보를 채택해야 다음 단계로 갈 수 있는 것은 아니다.

### J-03 — retained paint·composition의 중복 검사 축소

대상: [PaintingContext](Nelyx/src/framework/painting/context.ts), [retained-paint.ts](Nelyx/src/framework/rendering/retained-paint.ts), [layer.ts](Nelyx/src/framework/rendering/layer.ts), [scene.ts](Nelyx/src/ui/scene.ts).

- 같은 `composeInto` 호출 안에서 구조 비교 결과와 명령 비교 결과를 공유해 재검사부터 줄인다. immutable 내부 recording에 대해서만 구조/내용 revision으로 재사용할 수 있는 범위를 넓힌다.
- transform만 바뀌었을 때 전체 명령 snapshot·Map을 다시 만들지 않는 경로를 검토한다. 같은 command identity가 여러 위치에 나타나는 경우의 일치 검사와 save/restore·clip 범위를 보존한다.
- 캐시 hit여도 제출 프레임의 독립 자원 lease는 획득한다. 실패/discard, detach, 숨김, Picture retire, renderer/context 세대 변경 시 stale recording을 재사용하지 않는다.
- [native scene-composition service](Nelyx/skia/packages/native/src/scene-composition.ts)의 전체 source 순회도 후보지만 **현재 direct 앱에서는 미활성**이다. 이 경로의 최적화를 현재 병목 수정으로 보고하지 않는다. 새로 채택할 근거가 생기기 전까지 우선 보류한다.

검증: 기존 [retained paint 회귀](Nelyx/eng/check-retained-paint.mjs)를 확장해 transform-only 이동, 중첩 dirty boundary, 구조 재배치, 공유 명령, paint 실패 후 복원, 제출 후 원본 dispose를 확인한다.

완료 조건: 같은 표시 결과·자원 수명을 유지하면서 `composition-command-visits`, `composition-structure-visits`, `composition-match` 또는 관련 할당이 감소한다. draw 제출·GPU 비용까지 dirty 개수만큼 줄었다고 확대 해석하지 않는다.

### J-04 — 새 섹션·달력 월의 동기 생산량 축소

대상: [Demo components](sample/nelyx-demo-app/src/components.ts), [GallerySection](sample/nelyx-demo-app/src/gallery-section.ts), [TextPainter](Nelyx/src/framework/painting/text-painter.ts), [Paragraph](Nelyx/src/ui/paragraph.ts), [text-layout-cache.ts](Nelyx/src/hosting/text-layout-cache.ts), [sliver.ts](Nelyx/src/framework/widgets/sliver.ts).

- Demo는 이미 section별 Listenable·stable key·SectionExtentIndex·editor만 명시적 KeepAlive를 사용한다. 전체 화면 rebuild나 eager list로 잘못 진단하지 않는다.
- 섹션 안에서 변하지 않는 Widget 구성과 값 객체를 State 범위에서 재사용한다. theme·locale·text scale·사용자 값에 의존하는 것은 정확히 무효화한다. Element/State를 공유하지 않는다.
- Paragraph의 폭별 요청 생성, TextPainter의 intrinsic→최종 layout, cache key 준비를 추적한다. 이미 있는 64개/1MiB 문단 보관·font provider·owned-input serialization 캐시와 중복되는 캐시를 만들지 않는다. 같은 내부 immutable 입력의 불필요한 재캡처·재직렬화가 남는 지점만 수정한다.
- Demo의 현재 `childPolicy`는 미지정이다. 기존 `bounded` 보관을 작은 capacity로 적용하는 후보와 기본 경로를 비교한다. 먼저 preparation을 끄고 재진입 비용·live 자원 증가를 확인한 다음 필요할 때만 `observed-budget`을 검토한다.
- [ViewWorkBudget](Nelyx/src/framework/widgets/view-work-budget.ts)은 준비 후보의 추정 비용 ≤2ms와 deadline 여유를 이미 검사한다. 큰 섹션을 이 예산 안에 들어간 것으로 간주하지 않는다. 비싼 원자적 build를 쪼개지 않고 prewarm만 켜면 frame이 길어질 수 있다.
- [달력 생성 코드](packages/material/src/generated/date/calendar_date_picker.generated.ts)의 한 월은 날짜별 Widget·focus·label을 동기 구성한다. 변하지 않는 내부 값의 재생성부터 줄이고, arbitrary `CalendarDelegate`·predicate·localization의 호출을 임의 memoize하지 않는다.

검증: 첫 진입/재진입, theme·locale·text scale 변경, 2열/1열 전환, Key 이동·child 제거, focus/편집 중 이탈·복귀, 달력 빠른 정·역방향 recontact·월 경계·선택·입력 모드를 확인한다.

완료 조건: cold build/layout 또는 동작당 할당이 감소하고 자원 보관 한도를 지킨다. 재진입 개선과 첫 진입 개선은 따로 보고한다. Testbed의 전체 mount를 의도한 MixedScroll 화면을 임의 lazy list로 바꾸지 않는다.

### J-05 — 입력 burst와 frame 대기 보완, 조건부

진입 조건: P1~J-04 이후에도 입력 dispatch/queue 대기가 긴 프레임의 독립적인 비용으로 남고, 코드에서 반복 flush·배열 복사·barrier drain 등의 개선 지점을 확인한 경우.

대상: [ViewRuntime](Nelyx/src/hosting/runtime.ts), [InputBatch.h](Nelyx/skia/native/host/InputBatch.h), [RuntimeLoop.h](Nelyx/sdk/native/windows-hermes/RuntimeLoop.h), [main.cpp](Nelyx/sdk/native/windows-hermes/main.cpp).

- 먼저 packet마다 반복하는 복사·상태 통지와 batch 배열 생성을 줄인다. 입력 좌표·sequence·원래 timestamp·delta를 보존한다.
- 시간/개수 예산으로 delivery와 frame 사이에 양보하려면 UI barrier의 이전 입력 완료 조건과 마지막 입력을 포함한 frame 제출 계약부터 설계한다. batching이 이미 존재하므로 한도를 단순히 더 키우지 않는다.
- move/wheel/panZoom을 마지막 위치 하나로 덮지 않는다. recognizer·velocity·방향 반전·여러 pointer의 의미를 보존할 수 없으면 coalescing은 채택하지 않는다.
- 긴 Source build를 delivery 정책만으로 중단할 수 없다는 한계를 명시한다. `latestInputAdmission`을 단순 활성화해 starvation을 재도입하지 않는다.

검증: burst, reentrant 입력, down→move→up/cancel, panZoom start/end·inertia cancel, keyboard/IME/resize barrier, close 직전 입력, GPU busy를 확인한다. 수신·전달·처리 sequence와 누적 wheel delta의 누락을 검사한다.

완료 조건: 동작·최종 위치·속도 추정이 유지되고 frame starvation 없이 queue 대기가 감소한다. 근거가 없으면 **DEFERRED**로 기록하고 과도한 스케줄러 변경은 하지 않는다.

### J-06 — semantics의 정적 상태와 이동 geometry 재사용, 조건부

진입 조건: 접근성을 켠 정상 경로에서 semantics capture/freeze/publish의 비용이 남고, 재사용해도 되는 내부 immutable 부분을 코드로 식별한 경우.

- [FrameworkRoot](Nelyx/src/framework/widgets/root.ts)의 tree/owner/metrics·focus·pending action guard와 [SemanticsTransportSnapshot](Nelyx/src/framework/rendering/semantics-transport.ts)의 action generation을 유지한다.
- 정적 label·actions·topology와 이동 geometry를 나누어 이미 계산한 부분을 재사용한다. focused editor의 caret·selection·조합 상태는 즉시 갱신한다. 사용자 getter·custom semantics는 내부 revision만으로 안전하다고 가정하지 않는다.
- [Windows SemanticsTree](Nelyx/engine/platform/windows/interop/SemanticsTree.h)는 이미 native delta를 받는다. 새 delta protocol을 먼저 만드는 대신 Source snapshot 생성과 실제 native 갱신의 중복 비용을 따로 다룬다.
- 접근성 비활성화나 현재 Demo의 motion 간격 300ms 연장을 개선책으로 삼지 않는다. quiet wake·즉시 상태 통지·stale action 거부를 유지한다.

검증: 스크롤 중 UIA bounds/상태, focus 이동, toggle·range action, 텍스트 selection, 오래된 action 거부, viewport/context 교체·제거 후 provider 수명을 확인한다. reader·한국어 IME 실사용 수락은 자동 UIA 검사와 분리한다.

완료 조건: 같은 접근성 동작과 갱신 계약을 유지하면서 snapshot 할당·CPU가 감소한다. 비용 근거가 없으면 **DEFERRED**로 남긴다.

### J-07 — 남은 GC·native 회수·생성 코드 비용, 조건부

- 현재 direct host는 [main.cpp](Nelyx/sdk/native/windows-hermes/main.cpp)의 Hermes runtime을 사용한다. 로컬 CMake cache의 `HADES`·concurrent ON은 정적으로 확인했지만, 실제 로드 제품의 VM 설정·GC 기여도를 검증한 것은 아니다.
- 먼저 J-01~J-04로 제거한 임시 할당과 현재 text/Path/Paint/Picture의 producer→frame lease→native retire→wrapper finalizer 수명을 추적한다. 회수 완료 전에 메모리가 사라진 것으로 계산하지 않는다.
- 잔여 tail이 이 경로와 관련될 때만 현재 FrameDiagnostics/FrameTrace와 같은 시계에 bounded GC 진입·수거·finalizer/native retire 시간을 추가한다. 통계 밖의 pre-GC 대기 가능성과 실제 관측을 구분한다. callback 안에서는 Runtime 호출·파일 I/O·동적 할당을 하지 않는다.
- 누적 할당·live heap·native resident·GPU in-flight를 따로 본다. 단명 할당을 pool로 바꾸는 후보는 총 live bytes 증가와 세대 간 보관 비용까지 검토한다. 강제 GC, pressure accounting 제거, 무제한 pool, 무조건 큰 heap은 채택하지 않는다.
- 생성된 날짜 코드의 중복 `checkedInteger`·증감 IIFE는 별도 P3 후보다. typed IR에서 부작용·평가 순서·정수 예외 의미가 같다고 증명 가능한 경우에만 emitter를 개선한다. generated 출력만 수작업 수정하지 않고 [날짜 생성기](tools/Nelyx.FrameworkToTypeScript/generate-date-picker.ts)와 재생성 경로를 함께 고친다.

완료 조건: 실제 남은 비용의 기여도와 변경의 이익이 설명되는 후보만 채택한다. GC 원인이 확인되지 않거나 emitter 변경 범위가 과도하면 **DEFERRED**로 종료할 수 있다.

### J-08 — 공급 반영·통합 확인·수락 기록

- 채택한 변경을 모아 Core/디자인/renderer/SDK와 Demo 설치 공급을 갱신한다. alias가 dist를 읽는 회귀는 Core 빌드 후 실행한다.
- native는 [정본 입력 규칙](Nelyx/skia/eng/native-source-inputs.mjs)에 따라 `Nelyx/skia/native`와 `Nelyx/engine`의 원본을 수정하고 projection을 재생성한다. `packages/native/cpp`, `generated`, 설치본만 고치지 않는다.
- host·VM·bytecode·SDK·Skia supplier·viewport/DPR/refresh를 확인한다. 변경 전후 서로 다른 공급·입력·화면을 섞어 개선율을 계산하지 않는다.
- 결과는 이 문서에 **채택/철회/DEFERRED, 기능 판정, 성능 판정, 미실행 범위**로 짧게 갱신한다. 과거 work11/work12의 중단 작업이나 전체 API 수락을 자동 재개하지 않는다.

## 5. 검증 계획과 실행 명령

### 코드·기능 회귀

다음은 **향후 구현 후 실행할 기존 명령**이다. 이번 문서 작성에서는 실행하지 않았다. 변경한 경로의 검사부터 실행하고, 최종 통합 시 타입·lint·format을 확인한다. 새 검사는 기존 runner에 동작 사례를 추가하는 것을 우선하며 구현을 그대로 되풀이하는 테스트는 만들지 않는다.

```powershell
# 저장소 루트. alias 기반 검사 전에 현재 Core dist를 갱신한다.
npm.cmd run build:core
node Nelyx/eng/check-source-framework.mjs
node Nelyx/eng/check-child-reconciliation.mjs
node Nelyx/eng/check-retained-paint.mjs

# 최종 통합 검사
npm.cmd run check:types
npm.cmd run lint
npm.cmd run format:check

# SDK/native 변경을 모은 뒤 한 번 공급하고 실제 Demo 경로 확인
npm.cmd run build:sdk
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run build:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

검사 runner 내부의 20분 timeout을 유지한다. npm 타입/lint 등 외부 검증도 `commands.mjs`의 `execute`에 `timeout: 1_200_000`을 지정한 소유 process-tree 래퍼에서 실행한다. 빌드에 이 제한이 필요하면 단계별로 나누고 timeout 실패를 PASS로 간주하지 않는다. `check-native-windows-run.mjs`는 launcher를 바꿀 때의 회귀이며 앱 입력·성능 검사를 대신하지 않는다.

Flutter 의미 변경이 가능한 queue/geometry/생성기 수정에는 [고정 원본 oracle](Nelyx/eng/check-flutter-framework.mjs)을 필요한 사례로 확장한다. `--source`와 `--flutter`는 실제 설치 경로를 확인한 뒤 명시하고, 변경된 local reference 파일을 oracle로 대신하지 않는다. Web은 공통 Source 변경의 화면·입력·수명 회귀를 확인한다. native 공통 변경의 Android 영향은 빌드와 실행 확인 여부를 분리해 기록한다.

### 성능 시나리오와 데이터

| 시나리오 | 확인할 차이 |
| --- | --- |
| Gallery 첫 하강 → 복귀 → 재하강 | cold 생산과 재사용 비용, 새 섹션 진입 시 긴 frame |
| 가변 높이·한글/emoji 목록 | text shaping/cache·extent 보정·layout 반복 |
| 달력 보통/빠른 정방향 → 빠른 역방향·재접촉 | 새 월 생산, 입력 대기, 실제 page/월 진행·정착 |
| editor focus 상태에서 스크롤·resize·화면 복귀 | input geometry·semantics·cache 무효화·자원 수명 |
| 동작 종료 → 화면 이탈 → 앱 정상 종료 | 남는 optional owner·paragraph/Picture·GPU lease·입력 batch |

- 기본 비교는 시나리오별 같은 입력 **3회**로 시작한다. cold는 프로세스 재시작 등 조건을 통일하고 warm은 그 실행 안의 재방문으로 구별한다. 추가 반복은 변동·실패를 해소할 때만 하며 30회 이내로 제한한다.
- [FrameDiagnostics](Nelyx/src/ui/frame-diagnostics.ts)와 [FrameTrace](Nelyx/sdk/native/windows-hermes/FrameTrace.h)를 우선 사용한다. 현재 Source 앱에 필요한 자동 시나리오/집계가 없으면 `Nelyx/eng/`에 최소 runner를 추가한다. 이는 **예정 작업**이며 옛 scroll harness가 현재도 존재하거나 작동한다고 가정하지 않는다.
- build/layout/optional-work/paint/compose/geometry/semantics/capture/submit, 입력 dispatch 전 대기, surface fence 완료, offset/page 진행 간격을 구분한다. 중첩 구간의 시간을 더하지 않는다.
- 입력 수신/전달/반영 누락, trace overflow, foreground 상실, 잘못된 viewport/공급이면 해당 성능 표본을 무효로 한다. 진단 켠 실행과 끈 실행을 섞지 않고 probe 비용을 확인한다.
- trace·CPU profile·receipt·SDK 복사본을 누적 보관하지 않는다. 비교에 필요한 숫자와 공급 식별만 이 문서의 현재 결과표에 남기고 실행 임시 데이터는 회수한다. 현재 dist와 현재 제품 패키지만 유지한다.

### 제안 수락 기준

| 판정 | 기준 |
| --- | --- |
| 기능 | 입력·최종 위치/월·편집·접근성·시각·자원 수명에 회귀가 없음 |
| 변경 채택 | 원래 겨냥한 반복 작업/할당이 감소하고 해당 CPU 구간 또는 end-to-end 지연이 일관되게 개선됨. warm 개선을 위해 cold tail이나 live 자원을 악화시키지 않음 |
| 60Hz 입력 응답 목표 | 유효한 입력→native surface-copy fence 완료 p95 **≤33.3ms**, 최대 **≤66.7ms**. 장치가 165Hz여도 이 목표를 165Hz 수락으로 부르지 않음 |
| CPU frame 목표 | 활성 구간 Source frame CPU p95 **≤16.7ms**. cold 최대와 단계별 최대를 별도 표기하고 p95만으로 긴 frame을 숨기지 않음 |
| 정체 목표 | 입력에 따라 움직여야 하는 활성 구간에서 offset/page 진행 간격 **100ms 이상 정체 0회**. 경계·정착·의도된 무이동은 제외 근거를 명시 |
| 메모리 | 보관 한도와 producer/frame/native retire 계약 유지. 동등한 상태로 복귀한 뒤 반복마다 불필요한 resident 자원이 계속 증가하지 않음 |
| 표시·물리 수락 | surface 완료율은 displayed FPS가 아님. 실제 화면 FPS/scanout 및 물리 트랙패드 체감은 별도 확인 전 **notVerified** |

위 기준은 이번 계획의 목표이며 달성 사실이 아니다. 유용한 일부 변경을 채택해도 전체 목표에 못 미치면 **PARTIAL / performanceAccepted=false**를 유지한다. 3회의 짧은 확인만으로 장시간 안정성·누수 부재·모든 기기 성능을 수락하지 않는다.

## 6. 우선 진행하지 않을 방향

- **VM 교체·JIT/AOT 비교부터 재개:** Source 생산·native 경계·회수 비용을 함께 바꾸므로 원인 분리가 어렵고 이전 비교도 전체 성능 수락에 이르지 못했다.
- **C++ Widget/scroll 정책 재도입:** 현재 Source 소유권을 다시 나누며 기존 전환 결정과 충돌한다.
- **repaint boundary·paragraph cache의 무조건 추가/확대:** 이미 있는 기능이며 현재 부족한 것은 재사용 범위·준비 비용일 수 있다.
- **모든 항목 KeepAlive·무제한 prewarm·가짜 고정 extent:** cold 비용을 다른 frame이나 live memory로 옮기고 가변 높이·focus·접근성을 바꿀 수 있다.
- **FPS 제한·입력 폐기·접근성 끄기로 수치 개선:** 실제 처리 비용과 기능 회귀를 해결하지 못한다.
- **MSAA를 추가로 낮추거나 GPU부터 교체:** 이전 2× MSAA 수정의 crash 해결과 이번 CPU 긴 frame 가설을 구분한다. renderer/GPU가 지배적이라는 현재 근거 없이 화질·기술 스택을 바꾸지 않는다.

## 7. 현재 인계 상태

- [x] 저장소 지침·최근 종료 기록·현재 Source/SDK/native 호출 경로 검토
- [x] 기존 최적화의 적용/미적용 구분과 우선순위·작업·수락 기준 작성
- [ ] J-01~J-04 우선 개선 구현·회귀·공급 반영
- [ ] J-05~J-07 조건부 후보 채택/보류 판단
- [ ] J-08 현재 공급의 기능·성능·물리 확인과 결과 기록

문서 확인: 로컬 링크 대상 **36개 존재**, code fence 짝 일치, 공백 검사 통과. 제품 빌드·기능 회귀·성능 측정은 미실행이다.

**다음 실행 시작점: J-00의 checkout/연결 재확인 후 J-01.** 계획 작성은 완료했으며 구현과 성능 수락은 시작하지 않았다.
