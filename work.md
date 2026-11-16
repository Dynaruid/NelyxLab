# 엔진 개선으로 평균 30fps 이상·간헐적 버벅임 감소 작업계획

작성: **2026-11-16 KST** · 코드 검토 기준: **`092c393`**

상태: **PAUSED / PARTIAL / performanceAccepted=false**

2026-11-16 `19940ce`의 clean checkout에서 실행을 시작했다. 같은 날 사용자의 **“일단 중간 마무리”** 요청으로 중단했다. 변경은 미커밋 상태로 보존했다. 아래 계획의 현재 실행 결과와 재개 지점은 **§7**에 기록했다. 구현·일부 회귀는 진행했으나 성능 목표와 최종 통합 수락은 미완료다. 사용자 재개 요청 전에는 자동으로 이어서 실행하지 않는다.

이후 같은 날 사용자가 요청한 **가상 스크롤 입력의 60Hz 보정**을 별도로 진행했다. 해당 변경과 확인 결과는 §7의 **60Hz 가상 입력 보정**에 기록한다. J-01~08 전체 성능 작업의 중단·미수락 상태와 구분한다.

계획 개정: **2026-11-16 KST**. 이번 요청으로 목표·우선순위·수락 기준을 수정했다. 엔진 구현과 성능 실행을 재개한 것은 아니며, 기존 변경·측정 이력과 **PAUSED / PARTIAL** 상태를 보존한다.

## 1. 목표와 작업 원칙

목표는 **공통 엔진을 개선해 Windows Demo의 활성 스크롤·애니메이션 구간에서 평균 30fps 이상을 확보하고, 간헐적으로 발생하는 버벅임을 줄이거나 없애는 것**이다. 평균 FPS와 긴 프레임·진행 정체는 별도로 판정한다. 평균 30fps를 넘겨도 간헐적 정체가 개선되지 않았다면 목표 전체를 달성한 것으로 보지 않는다.

이 문서에서 엔진 개선은 Source의 공통 build/layout/paint·text·scroll 기반, hosting의 입력·프레임 실행, SDK/native 경계와 자원 회수를 포함한다. **datepicker는 공통 엔진 개선의 효과를 확인하는 통합 시나리오**로 사용한다. datepicker 자체의 날짜 계산·월 생성기·개별 callback을 우선 탐색하거나 전용 우회 최적화를 추가하는 방향으로 진행하지 않는다. Gallery·가변 목록·편집 화면·PageView에도 적용되는 비용을 줄여 datepicker가 함께 개선되도록 한다.

datepicker의 빠른 제스처는 기존 **3배 스트레스 요구 대신 보통 속도의 약 2배**를 기준으로 한다. 같은 이동 거리에서 이동 시간을 약 절반으로 줄이는 뜻이며 입력 주입률은 **60Hz**로 유지한다. 시나리오의 비교 실행 **3회**와 제스처 속도 **2배**는 서로 다른 기준이다. 구체적인 입력과 FPS 계산은 §5를 따른다.

공통 Source/SDK 변경은 Testbed와 Web에도 회귀가 없어야 한다. Android와 다른 플랫폼의 성능 수락은 실제 해당 환경에서 확인하기 전까지 별도로 남긴다.

1. **코드·소유권·호출 경로 분석 → 원인 가설 → 해결 설계 → 적용 → 검증** 순서로 진행한다. 계측 확대나 반복 실행으로 원인 찾기를 먼저 시작하지 않는다.
2. **평균 30fps 이상과 버벅임 감소를 함께 목표**로 삼는다. 첫 진입, 이미 본 구간 복귀, 연속 동작의 평균 FPS·프레임 간격 p95/p99/최대·입력 대기·진행 정체를 구분한다. 60fps 수준의 CPU p95 16.7ms는 이번 작업의 필수 수락 기준에서 제외한다.
3. Widget·Element·State·layout·gesture·scroll 정책은 현재 Source 프레임워크에 유지한다. native 변경은 문단·drawing·자원·OS transport의 기존 경계 안에서 수행한다.
4. 한 작업 단위의 관련 변경을 모아서 적용하고 해당 회귀를 확인한다. 각 작은 수정마다 전체 SDK/native 빌드를 반복하지 않는다.
5. 이미 있는 캐시·batch·준비 기능의 적용 여부를 확인한 뒤 수정한다. 새 캐시나 별도 스케줄러를 중복 도입하지 않는다.
6. [.github/copilot-instructions.md](.github/copilot-instructions.md)에 따라 검증은 **20분 timeout**, 시나리오 반복은 원칙적으로 **30회 이내**로 제한한다. 한 실행의 임시 파일·소유 프로세스는 성공·실패·중단 모두 `finally`에서 회수한다.
7. **검증 명령은 PowerShell 7(`pwsh`)에서 실행하고, Windows Demo/Testbed의 실행 기능·성능 검증은 `pwsh`로 가상 입력을 생성해 수행한다.** 코드 분석·원인 가설·해결 설계를 먼저 진행한다. 물리 마우스·트랙패드 수동 조작을 이번 작업의 필수 완료 조건으로 두지 않는다.
8. 엔진 후보의 채택 근거는 제거한 공통 비용과 실제 FPS·정체 변화다. datepicker 한 화면의 지연만으로 원인을 단정하지 않고 다른 공통 경로에서도 개선 또는 회귀 여부를 확인한다.

## 2. 현재 판단의 출발점

[work12 종료 기록](history/26/11/14/work12-summary.md)에 따르면 11월 15일 사용자는 주기적 스크롤 버벅임과 고속 달력 전환의 애니메이션 누락이 해결됐다고 확인했다. **낮은 평균 FPS는 남았으며 상승은 확인되지 않았다.** 해결된 증상을 현재도 재현되는 문제로 가정하지 않는다.

같은 기록의 과거 가상 입력에서는 목록 첫 하강의 Source frame CPU p95 **39.6ms**, 새 섹션 layout 최대 **47.7ms**가 남았다. 고속 달력에서는 layout 최대 **84.7~155.5ms**, 입력→surface 지연 최대 **571.3ms**도 관측했다. 이 값은 당시 공급·입력·실행 구간의 이력이며 현재 checkout의 baseline 또는 물리 트랙패드 결과가 아니다.

[이전 GC 검토](history/26/11/14/report-summary.md)는 할당·회수의 비용 가능성을 남겼지만 GC가 정체 원인임을 입증하지 않았다. 이후 Source 전환으로 예전 `OriginalWidgetHost`·engine transaction 경로가 철거됐다. 예전 response buffer·Core ledger 가설을 현재 경로의 확정 원인으로 가져오지 않는다.

§7에는 이후 가상 입력에서 관측한 긴 프레임과 정체도 남아 있다. 이전 실사용 확인과 입력·공급·측정 범위가 다르므로 구분한다. 재개 시에는 이 자료를 **공통 프레임 실행·할당·native 경계의 후보를 검토하는 근거**로 사용한다. datepicker 내부를 먼저 파고드는 작업 목록으로 바꾸지 않는다. 기존 이력에는 새 목표를 판정할 평균 FPS가 없으므로 **평균 30fps 달성 여부는 notVerified**다.

기존 코드 검토와 이후 변경을 반영한 실행 연결은 다음과 같다. 후보별 검증·채택 여부는 §7을 따른다.

- [FrameworkRoot.build](Nelyx/src/framework/widgets/root.ts)는 build → layout → optional work → compositing → paint → compose → input geometry → semantics를 한 Source 프레임에서 수행한다. 긴 동기 작업 동안 같은 runtime owner의 다음 입력 처리는 기다린다.
- [ViewRuntime](Nelyx/src/hosting/runtime.ts)은 입력 mailbox, 준비 프레임, GPU admission을 조정한다. 준비 프레임을 먼저 제출하는 경로와 입력 세대 검사가 이미 있다.
- [native-hermes 초기화](Nelyx/sdk/src/backends/native-hermes/application.ts)는 [공통 native engine](Nelyx/sdk/src/runtime/native-engine.ts)을 생성한다. 현재 소스에는 `sceneBatch='paint'` 후보가 반영돼 있다. `sceneComposition`, `latestInputAdmission`, `inputBatches`, `paragraphTransactions`는 이 앱에서 활성화하지 않는다.
- native engine의 `nativeDisplayLists`는 이미 `true`다. **그리기마다 전부 개별 JSI 호출을 한다는 설명은 현재 코드에 맞지 않는다.** 다만 packet을 만들기 전 Path·Paint·Rect 등의 임시 native wrapper 생성은 남는다.

## 3. 코드 근거로 검토한 개선안

아래 우선순위는 공통 엔진의 반복 작업·긴 동기 작업·변경 범위·회귀 위험을 기준으로 정했다. 일부 후보는 이미 구현·국소 검증했으므로 §7의 채택/철회 상태를 먼저 확인한다. 평균 FPS와 버벅임에 대한 전체 개선 효과는 아직 수락하지 않았다.

| 우선순위 | 개선안과 현재 근거 | 기대하는 변화 | 주의할 경계 |
| --- | --- | --- | --- |
| P1 | layout 대기 목록의 할당·반복 작업 축소. [object.ts](Nelyx/src/framework/rendering/object.ts)의 `PipelineOwner.flushLayout`에 작업 배열·callback Set 재사용을 이미 반영했다(J-01). 잔여 필수 순회·정렬·재진입 비용과 기존 patch의 실효성을 검토한다. | dirty layout 처리에 필요한 임시 객체와 반복 작업 감소 | 부모 우선 순서·동일 깊이 순서·callback 재진입·실패 복원 유지 |
| P1, 재검토 | 문단 native transaction의 비용·채택 판단. [text.ts](Nelyx/skia/packages/native/src/text.ts)에 transaction·capability 검사가 있고 engine opt-in도 연결했다. 제품 기본은 off이며 활성화는 철회한 상태다(J-02A). | cache miss 문단의 style/text/placeholder/build/layout/metrics 왕복 감소 가능성 | shaping·operations 배열·native parsing을 포함한 총 비용으로 판단. 새 근거 없이 기본 활성화하지 않음 |
| P1 | scene packet 생성 전 임시 wrapper 축소. [scene.ts](Nelyx/skia/packages/native/src/scene.ts)는 path/paint/all을 지원하며 현재 direct 앱에는 paint 후보가 반영됐다(J-02B). 국소 이득과 전체 프레임 효과를 구분한다. | display-list 준비에 쓰는 JSI wrapper와 생성·dispose 감소 | 기존 display-list 위의 추가 개선. path/all 동시 활성화 없이 후보별 효과 확인 |
| P2 | retained composition의 잔여 비교·할당 축소. [context.ts](Nelyx/src/framework/painting/context.ts)의 `composeInto`에 구조 비교 결과 공유와 첫 command mismatch 이후 transform 검사 등을 반영했다(J-03). 남은 공통 순회·snapshot 비용을 검토한다. | 이미 그린 구간의 스크롤·애니메이션 프레임 CPU 감소 | 구조·command identity·부모 변경·사용자 훅의 관측 의미 보존 |
| P2 | 공통 build/layout·문단 요청·lazy child 생산의 중복 축소. 새 목록 섹션과 PageView 진입 등에서 같은 기반 경로를 검토한다. | 여러 화면의 cold frame과 동작 중 build/layout·단명 할당 감소 | 날짜별 Widget·달력 callback 전용 최적화보다 공통 기반을 수정. 보관 한도와 focus·접근성 유지 |
| P2, 조건부 | 입력 전달·프레임 공정성 보완. [InputBatch.h](Nelyx/skia/native/host/InputBatch.h)는 기본 64개 batch, ViewRuntime은 최대 256개 mailbox와 전체 flush를 사용한다. | 긴 입력 burst 뒤 프레임 대기 감소 | down/up/cancel·keyboard/IME·viewport barrier·속도 추정·누적 delta 보존 |
| P2, 조건부 | semantics snapshot의 변하지 않은 부분 재사용. [semantics-transport.ts](Nelyx/src/framework/rendering/semantics-transport.ts)는 capture마다 여러 Map과 transport 객체를 구성한다. | 접근성을 유지하면서 motion-only 프레임의 CPU·할당 감소 | Windows native upsert/remove delta와 motion 간격 300ms는 이미 존재 |
| P3, 조건부 | 남은 GC·native 회수 정체와 생성 코드의 잉여 검증 축소 | P1/P2 이후에도 남는 긴 tail 개선 | GC 단독 원인·VM 교체 효과를 가정하지 않고 현재 경로만 다룸 |

**재개 순서는 기존 엔진 patch의 유지/철회 검토 → 공통 프레임 경로의 비용 분석·설계·적용 → 관련 회귀 → 동일 입력에서 FPS·버벅임 비교**다. layout·text/scene 경계·retained composition·공통 child 생산을 우선 검토한다. 국소 이득만 확인한 후보를 일괄 활성화하지 않으며, 기본 활성화를 철회한 문단 transaction도 새 근거 없이 다시 켜지 않는다. 입력·semantics·GC 변경은 해당 경로에 남은 비용을 설명할 코드 근거가 있을 때 진행한다.

## 4. 단계별 작업

### J-00 — 현재 경로와 변경 경계 고정

상태: **기존 코드·소유권 검토 및 당시 입력의 변경 전 달력 baseline 3회 확보 / 새 평균 FPS·버벅임 기준 비교 준비는 미완료**.

- 이 문서에 적힌 호출부와 현재 checkout 차이를 확인한다. 기존 사용자 변경을 보존한다.
- 앱 진입 → Source 프레임 → native text/scene → GPU retire의 owner와 자원 수명을 정리한다. 함수별로 필수 작업·중복 검사·임시 객체·동기 native 호출을 구별한다.
- 문단 transaction·sceneBatch 등은 **미연결 후보**와 **현재 기본 경로**를 구분한다. native 공급에 함수가 있는지와 앱이 실제 호출하는지도 구분한다.
- 공통 프레임의 비용이 여러 화면으로 이어지는 경로를 먼저 분석한다. datepicker 내부 로직은 통합 결과를 해석하는 데 필요한 호출 관계만 확인한다.
- §5의 평균 FPS 집계에 필요한 프레임 식별·완료 시각·측정 구간을 현재 코드에서 정한다. 기존 frame CPU p95나 입력 주입률을 평균 FPS로 환산하지 않는다. 표시 프레임을 측정할 수 없는 경우 엔진 완료율과 표시 FPS를 구분해 남긴다.
- datepicker의 보통/약 2배 제스처에 대해 거리·이동 시간·접촉 간격·60Hz 주입을 고정한다. 현재 생성기의 100/50ms 이동은 이미 이동 속도 약 2배에 해당하므로 이름만 바꾸기 위해 더 빠르게 만들지 않는다.
- 해결 설계가 정해진 뒤 효과 비교용 기준 실행을 최소 1세트 확보한다. 변경 전후에 같은 `pwsh` 가상 입력 시나리오를 사용한다. 이는 코드 분석 뒤의 비교 자료 확보이며 반복 실행으로 원인을 탐색하는 단계가 아니다. 기준 실행을 확보하지 못하면 이후 개선율은 주장하지 않는다.

완료 조건: 변경할 공통 함수·없앨 반복 작업·보존할 동작·대응 회귀와 평균 FPS·정체의 집계 경로가 지정된다. 기존 이력의 수치로 현재 baseline을 대신하지 않는다.

### J-01 — layout queue의 임시 할당과 반복 정렬 감소

실행 상태: **구현·해당 Source/Flutter 순서 회귀 통과 / 전체 성능 이득 미수락**.

대상: [PipelineOwner](Nelyx/src/framework/rendering/object.ts), 필요 시 [depth-queue.ts](Nelyx/src/runtime/depth-queue.ts).

1. `dirtyLayout`·`layoutCallbacks`를 합치는 과정의 중복 제거·필터링·callback membership 캡처를 한 pass로 정리한다. 우선 기존 batch 의미를 유지하면서 중간 컨테이너부터 없앤다.
2. owner별 작업 배열 재사용 또는 별도의 layout queue가 필요한지 코드로 비교한다. BuildScope의 intrusive 필드를 RenderObject에 그대로 섞지 않는다. 작은 dirty 집합에서 heap bookkeeping이 더 비싸면 정렬 방식 자체는 유지한다.
3. flush 도중 다시 dirty가 된 node, 깊이 변경, covered theater의 보류 callback, detach·dispose, 예외 이후 미처리 작업 복원을 보존한다. scratch는 프레임 자원이나 detached node를 다음 프레임까지 불필요하게 붙잡지 않게 비운다.
4. layout이 끝나기 전에 일부 필수 작업을 다음 프레임으로 넘기는 방식은 사용하지 않는다. convergence의 30 pass 제한도 유지한다.

검증: 부모/자식 동시 dirty, 같은 node의 layout+callback, flush 중 재등록, LayoutBuilder의 고립 build scope, 예외 후 재시도, route 덮임/복귀를 확인한다. 기존 [Source 회귀](Nelyx/eng/check-source-framework.mjs)에 필요한 동작 사례만 추가한다.

완료 조건: 기존 동작 결과가 유지되고 pass별 임시 컨테이너 생성이 줄어든다. 전체 layout 시간 개선 여부는 통합 성능 확인에서 별도로 판정한다.

### J-02 — text·scene의 native 경계 비용 감소

실행 상태: **transaction opt-in 연결·경계 회귀 구현, 기본 활성화 철회 / scene paint 후보 반영 / 최종 통합 PARTIAL**.

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

실행 상태: **구현·retained paint 회귀 통과 / 전체 성능 이득 미수락**.

대상: [PaintingContext](Nelyx/src/framework/painting/context.ts), [retained-paint.ts](Nelyx/src/framework/rendering/retained-paint.ts), [layer.ts](Nelyx/src/framework/rendering/layer.ts), [scene.ts](Nelyx/src/ui/scene.ts).

- 같은 `composeInto` 호출 안에서 구조 비교 결과와 명령 비교 결과를 공유해 재검사부터 줄인다. immutable 내부 recording에 대해서만 구조/내용 revision으로 재사용할 수 있는 범위를 넓힌다.
- transform만 바뀌었을 때 전체 명령 snapshot·Map을 다시 만들지 않는 경로를 검토한다. 같은 command identity가 여러 위치에 나타나는 경우의 일치 검사와 save/restore·clip 범위를 보존한다.
- 캐시 hit여도 제출 프레임의 독립 자원 lease는 획득한다. 실패/discard, detach, 숨김, Picture retire, renderer/context 세대 변경 시 stale recording을 재사용하지 않는다.
- [native scene-composition service](Nelyx/skia/packages/native/src/scene-composition.ts)의 전체 source 순회도 후보지만 **현재 direct 앱에서는 미활성**이다. 이 경로의 최적화를 현재 병목 수정으로 보고하지 않는다. 새로 채택할 근거가 생기기 전까지 우선 보류한다.

검증: 기존 [retained paint 회귀](Nelyx/eng/check-retained-paint.mjs)를 확장해 transform-only 이동, 중첩 dirty boundary, 구조 재배치, 공유 명령, paint 실패 후 복원, 제출 후 원본 dispose를 확인한다.

완료 조건: 같은 표시 결과·자원 수명을 유지하면서 `composition-command-visits`, `composition-structure-visits`, `composition-match` 또는 관련 할당이 감소한다. draw 제출·GPU 비용까지 dirty 개수만큼 줄었다고 확대 해석하지 않는다.

### J-04 — 공통 build/layout·text·lazy child 생산 비용 축소

실행 이력: **내부 immutable 문단 요청과 Demo section wrapper 재사용 구현 / bounded child·prewarm·달력 생성기 변경 DEFERRED / 전체 수락 PARTIAL**. 개정 계획에서는 공통 엔진 비용을 다루며 달력 생성기는 우선 수정 범위에서 제외한다.

대상: [FrameworkRoot](Nelyx/src/framework/widgets/root.ts), [PipelineOwner](Nelyx/src/framework/rendering/object.ts), [TextPainter](Nelyx/src/framework/painting/text-painter.ts), [Paragraph](Nelyx/src/ui/paragraph.ts), [text-layout-cache.ts](Nelyx/src/hosting/text-layout-cache.ts), [sliver.ts](Nelyx/src/framework/widgets/sliver.ts). Demo/Gallery와 datepicker는 공통 변경의 효과·회귀를 확인하는 소비자다.

- Demo는 이미 section별 Listenable·stable key·SectionExtentIndex·editor만 명시적 KeepAlive를 사용한다. 전체 화면 rebuild나 eager list로 잘못 진단하지 않는다.
- 기존 Demo State 범위의 section wrapper 재사용은 §7의 구현 이력으로 유지한다. 새 작업의 중심은 여러 소비자가 공유하는 build/layout·문단 준비·child 관리의 반복 비용으로 옮긴다. theme·locale·text scale·사용자 값의 무효화와 Element/State의 독립 소유권을 보존한다.
- Paragraph의 폭별 요청 생성, TextPainter의 intrinsic→최종 layout, cache key 준비를 추적한다. 이미 있는 64개/1MiB 문단 보관·font provider·owned-input serialization 캐시와 중복되는 캐시를 만들지 않는다. 같은 내부 immutable 입력의 불필요한 재캡처·재직렬화가 남는 지점만 수정한다.
- 공통 sliver/PageView의 child 재사용·layout 반복·필수 생산과 optional 준비의 경계를 분석한다. 기존 `bounded`/`observed-budget`은 여러 소비자에서 유효하고 live 자원 한도를 지킬 수 있는 경우에만 검토한다. Demo나 달력 하나의 보관량을 늘리는 것을 엔진 개선으로 대신하지 않는다.
- [ViewWorkBudget](Nelyx/src/framework/widgets/view-work-budget.ts)은 준비 후보의 추정 비용 ≤2ms와 deadline 여유를 이미 검사한다. 큰 섹션을 이 예산 안에 들어간 것으로 간주하지 않는다. 비싼 원자적 build를 쪼개지 않고 prewarm만 켜면 frame이 길어질 수 있다.
- datepicker의 월 생성기·날짜 계산·`CalendarDelegate`·predicate·localization callback은 이번 개선의 우선 수정 대상에서 제외한다. 공통 엔진 변경 후 보통/약 2배 정·역방향 제스처의 FPS·정체·월 정착·선택·접근성으로 효과를 확인한다.

검증: 첫 진입/재진입, theme·locale·text scale 변경, 2열/1열 전환, Key 이동·child 제거, focus/편집 중 이탈·복귀, 달력 빠른 정·역방향 recontact·월 경계·선택·입력 모드를 확인한다.

완료 조건: 공통 경로의 cold build/layout 또는 동작당 할당이 감소하고 자원 보관 한도를 지킨다. Gallery/가변 목록과 datepicker에서 평균 FPS·정체 변화를 각각 확인하며 재진입 개선과 첫 진입 개선은 따로 보고한다. Testbed의 전체 mount를 의도한 MixedScroll 화면을 임의 lazy list로 바꾸지 않는다.

### J-05 — 입력 burst와 frame 대기 보완, 조건부

실행 판단: **queue/scheduler 변경 DEFERRED**. 긴 동기 layout을 중단할 수 있는 안전한 별도 개선 근거를 확보하지 못했다. 가상 입력 회귀에서 발견한 `VK_PACKET` surrogate 처리 결함은 별도로 수정했다(§7).

진입 조건: P1~J-04 이후에도 입력 dispatch/queue 대기가 긴 프레임의 독립적인 비용으로 남고, 코드에서 반복 flush·배열 복사·barrier drain 등의 개선 지점을 확인한 경우.

대상: [ViewRuntime](Nelyx/src/hosting/runtime.ts), [InputBatch.h](Nelyx/skia/native/host/InputBatch.h), [RuntimeLoop.h](Nelyx/sdk/native/windows-hermes/RuntimeLoop.h), [main.cpp](Nelyx/sdk/native/windows-hermes/main.cpp).

- 먼저 packet마다 반복하는 복사·상태 통지와 batch 배열 생성을 줄인다. 입력 좌표·sequence·원래 timestamp·delta를 보존한다.
- 시간/개수 예산으로 delivery와 frame 사이에 양보하려면 UI barrier의 이전 입력 완료 조건과 마지막 입력을 포함한 frame 제출 계약부터 설계한다. batching이 이미 존재하므로 한도를 단순히 더 키우지 않는다.
- move/wheel/panZoom을 마지막 위치 하나로 덮지 않는다. recognizer·velocity·방향 반전·여러 pointer의 의미를 보존할 수 없으면 coalescing은 채택하지 않는다.
- 긴 Source build를 delivery 정책만으로 중단할 수 없다는 한계를 명시한다. `latestInputAdmission`을 단순 활성화해 starvation을 재도입하지 않는다.

검증: burst, reentrant 입력, down→move→up/cancel, panZoom start/end·inertia cancel, keyboard/IME/resize barrier, close 직전 입력, GPU busy를 확인한다. 수신·전달·처리 sequence와 누적 wheel delta의 누락을 검사한다.

완료 조건: 동작·최종 위치·속도 추정이 유지되고 frame starvation 없이 queue 대기가 감소한다. 근거가 없으면 **DEFERRED**로 기록하고 과도한 스케줄러 변경은 하지 않는다.

### J-06 — semantics의 정적 상태와 이동 geometry 재사용, 조건부

실행 판단: **DEFERRED**. cold topology 변경과 사용자 getter/action generation을 보존하면서 재사용할 독립 단위를 확정하지 못했다. 접근성을 끄거나 motion 간격을 늘리지 않았다.

진입 조건: 접근성을 켠 정상 경로에서 semantics capture/freeze/publish의 비용이 남고, 재사용해도 되는 내부 immutable 부분을 코드로 식별한 경우.

- [FrameworkRoot](Nelyx/src/framework/widgets/root.ts)의 tree/owner/metrics·focus·pending action guard와 [SemanticsTransportSnapshot](Nelyx/src/framework/rendering/semantics-transport.ts)의 action generation을 유지한다.
- 정적 label·actions·topology와 이동 geometry를 나누어 이미 계산한 부분을 재사용한다. focused editor의 caret·selection·조합 상태는 즉시 갱신한다. 사용자 getter·custom semantics는 내부 revision만으로 안전하다고 가정하지 않는다.
- [Windows SemanticsTree](Nelyx/engine/platform/windows/interop/SemanticsTree.h)는 이미 native delta를 받는다. 새 delta protocol을 먼저 만드는 대신 Source snapshot 생성과 실제 native 갱신의 중복 비용을 따로 다룬다.
- 접근성 비활성화나 현재 Demo의 motion 간격 300ms 연장을 개선책으로 삼지 않는다. quiet wake·즉시 상태 통지·stale action 거부를 유지한다.

검증: `pwsh` 가상 입력과 PowerShell에서 조회한 UIA 상태로 스크롤 중 bounds/상태, focus 이동, toggle·range action, 텍스트 selection, 오래된 action 거부, viewport/context 교체·제거 후 provider 수명을 확인한다. reader·한국어 IME 실사용 수락은 이번 가상 입력 검증 범위 밖으로 구분해 기록한다.

완료 조건: 같은 접근성 동작과 갱신 계약을 유지하면서 snapshot 할당·CPU가 감소한다. 비용 근거가 없으면 **DEFERRED**로 남긴다.

### J-07 — 남은 GC·native 회수·생성 코드 비용, 조건부

실행 판단: **DEFERRED**. GC의 인과 기여도와 emitter 평가 순서 동등성을 입증하지 못했으며, 강제 GC·VM 교체·generated 출력 수작업 수정은 수행하지 않았다.

- 현재 direct host는 [main.cpp](Nelyx/sdk/native/windows-hermes/main.cpp)의 Hermes runtime을 사용한다. 로컬 CMake cache의 `HADES`·concurrent ON은 정적으로 확인했지만, 실제 로드 제품의 VM 설정·GC 기여도를 검증한 것은 아니다.
- 먼저 J-01~J-04로 제거한 임시 할당과 현재 text/Path/Paint/Picture의 producer→frame lease→native retire→wrapper finalizer 수명을 추적한다. 회수 완료 전에 메모리가 사라진 것으로 계산하지 않는다.
- 잔여 tail이 이 경로와 관련될 때만 현재 FrameDiagnostics/FrameTrace와 같은 시계에 bounded GC 진입·수거·finalizer/native retire 시간을 추가한다. 통계 밖의 pre-GC 대기 가능성과 실제 관측을 구분한다. callback 안에서는 Runtime 호출·파일 I/O·동적 할당을 하지 않는다.
- 누적 할당·live heap·native resident·GPU in-flight를 따로 본다. 단명 할당을 pool로 바꾸는 후보는 총 live bytes 증가와 세대 간 보관 비용까지 검토한다. 강제 GC, pressure accounting 제거, 무제한 pool, 무조건 큰 heap은 채택하지 않는다.
- emitter 변경은 여러 Widget의 공통 실행 코드에 같은 잉여 비용이 남고 typed IR에서 부작용·평가 순서·정수 예외 의미를 보존할 수 있는 경우에만 별도 P3 후보로 검토한다. datepicker 생성 코드만을 겨냥한 탐색·수작업 최적화는 이번 우선 범위에 넣지 않는다. 채택한다면 생성기 정본과 재생성 경로에서 수정한다.

완료 조건: 실제 남은 비용의 기여도와 변경의 이익이 설명되는 후보만 채택한다. GC 원인이 확인되지 않거나 emitter 변경 범위가 과도하면 **DEFERRED**로 종료할 수 있다.

### J-08 — 공급 반영·통합 확인·수락 기록

실행 상태: **PARTIAL**. Core/SDK·Demo Windows/Web·Testbed Windows 공급 갱신을 진행했다. 최종 Keyboard header 반영 후 Testbed 재공급·실행, Web 실행, 제품 기본 run, 최신 변경 전체 검사 등은 사용자 중단 시점에 미완료다.

- 채택한 변경을 모아 Core/디자인/renderer/SDK와 Demo 설치 공급을 갱신한다. alias가 dist를 읽는 회귀는 Core 빌드 후 실행한다.
- native는 [정본 입력 규칙](Nelyx/skia/eng/native-source-inputs.mjs)에 따라 `Nelyx/skia/native`와 `Nelyx/engine`의 원본을 수정하고 projection을 재생성한다. `packages/native/cpp`, `generated`, 설치본만 고치지 않는다.
- host·VM·bytecode·SDK·Skia supplier·viewport/DPR/refresh를 확인한다. 변경 전후 서로 다른 공급·입력·화면을 섞어 개선율을 계산하지 않는다.
- §5의 `pwsh` 가상 입력으로 Demo/Testbed의 해당 기능·성능 시나리오를 실행한다. 물리 입력 확인을 기다리며 통합 검증을 미루지 않는다.
- 결과는 이 문서에 **채택/철회/DEFERRED, 시나리오별 평균 FPS와 측정 경계, 간헐적 정체의 빈도·총 시간·최대, 가상 입력 기능 판정, 미실행 범위**로 짧게 갱신한다. datepicker 약 2배 입력의 결과도 다른 화면과 구분한다. 과거 work11/work12의 중단 작업이나 전체 API 수락을 자동 재개하지 않는다.

## 5. 검증 계획과 실행 명령

**실행 환경은 PowerShell 7(`pwsh`)이며, Windows 앱 실행 검증의 입력은 PowerShell 스크립트에서 생성한다.** 코드 회귀·타입·lint 명령도 `pwsh`에서 구동한다. 아래는 계획과 재현 명령이며, 실제 완료 여부는 §7을 따른다.

### 코드·기능 회귀

다음은 구현 및 통합에 사용하는 명령이다. 변경한 경로의 검사부터 실행하고, 최종 통합 시 타입·lint·format을 확인한다. 새 검사는 기존 runner에 동작 사례를 추가하는 것을 우선하며 구현을 그대로 되풀이하는 테스트는 만들지 않는다.

```powershell
# pwsh에서 저장소 루트 기준으로 실행한다.
# alias 기반 검사 전에 현재 Core dist를 갱신한다.
npm.cmd run build:core
node Nelyx/eng/check-source-framework.mjs
node Nelyx/eng/check-child-reconciliation.mjs
node Nelyx/eng/check-retained-paint.mjs

# 최종 통합 검사
npm.cmd run check:types
npm.cmd run lint
npm.cmd run format:check

# SDK/native 변경을 모은 뒤 한 번 공급한다.
# 실행한 Demo는 아래 pwsh 가상 입력 방식으로 검증한다.
npm.cmd run build:sdk
npm.cmd run prepare:windows --workspace @nelyx/demo
npm.cmd run build:windows --workspace @nelyx/demo
npm.cmd run run:windows --workspace @nelyx/demo
```

검사 runner 내부의 20분 timeout을 유지한다. npm 타입/lint 등 외부 검증도 `commands.mjs`의 `execute`에 `timeout: 1_200_000`을 지정한 소유 process-tree 래퍼에서 실행한다. 빌드에 이 제한이 필요하면 단계별로 나누고 timeout 실패를 PASS로 간주하지 않는다. `check-native-windows-run.mjs`는 launcher를 바꿀 때의 회귀이며 앱 입력·성능 검사를 대신하지 않는다.

Flutter 의미 변경이 가능한 queue/geometry/생성기 수정에는 [고정 원본 oracle](Nelyx/eng/check-flutter-framework.mjs)을 필요한 사례로 확장한다. `--source`와 `--flutter`는 실제 설치 경로를 확인한 뒤 명시하고, 변경된 local reference 파일을 oracle로 대신하지 않는다. Web은 공통 Source 변경의 화면·입력·수명 회귀를 확인한다. native 공통 변경의 Android 영향은 빌드와 실행 확인 여부를 분리해 기록한다.

### pwsh 가상 입력 실행 방식

- 현재 Source 앱에 맞는 [Windows runner](Nelyx/eng/check-windows-jank.ps1)와 [가상 입력](Nelyx/eng/windows-jank-input.ps1)을 추가했다. 완료한 시나리오는 §7에 구분한다.
- 입력 시간표는 [C# 입력 생성기](Nelyx/eng/windows-jank-input.cs)가 QPC 기준 절대 시각으로 재생한다. 기본 **60Hz / 16.6667ms**이며 wheel은 작은 delta로 나눈다. `Timing`의 예정·실제 주입 시각·API 소요 시간·간격 오차를 앱 처리 시간과 구분한다. 한 주기 25%(60Hz에서 약 4.17ms)를 넘는 지연은 몰아 보내기나 입력 폐기 없이 실패 처리한다.
- PowerShell `Add-Type`으로 Win32 입력 API를 호출한다. 마우스 이동·버튼·세로/가로 wheel·키보드는 `SendInput`, 터치 swipe는 `InjectTouchInput` 등 해당 입력을 지원하는 API로 생성한다. 앱 내부 offset/page 값을 직접 바꿔 입력 처리를 생략하지 않는다.
- 대상 PID/HWND와 입력을 받는 창, foreground, client 영역·DPI를 확인한 뒤 좌표를 계산한다. 입력 종류·방향·delta·이동 거리·주입 간격·반복 횟수를 시나리오로 고정하고, 변경 전후 같은 프로파일을 재생한다.
- datepicker는 **보통 → 약 2배 정방향 → 약 2배 역방향·재접촉**을 기본으로 한다. 같은 거리의 이동 시간은 현재 60Hz 생성기의 **100ms/50ms**를 기준으로 하고, down/up·접촉 사이 간격·실제 제스처 시작 간격도 함께 기록한다. 2배는 이동 속도의 기준이며 60Hz를 120Hz로 바꾸거나 이동 거리를 늘리는 뜻이 아니다. 기존 6/6/12 gesture 구성과 비교 실행 3회는 유지한다. 3배 스트레스 입력은 필수 수락에서 제외한다.
- 주입 시도/성공 수와 앱의 수신·전달·처리 수, 누적 delta, 최종 offset/page/월·focus/편집 상태를 대조한다. PowerShell의 UIA 조회·화면 캡처와 기존 diagnostics를 함께 사용해 실제 반영을 확인한다. 입력 API 성공만으로 기능 PASS를 판정하지 않는다.
- 합성 wheel·touch swipe와 실제 precision trackpad의 panZoom·관성 경로를 구분한다. 가상 입력으로 생성하지 못한 panZoom/IME 등은 기존 Source 계약 회귀의 결과와 구분해 **해당 실행 경로 notVerified**로 남긴다. 물리 입력 실사용 확인은 이번 작업의 필수 단계에 추가하지 않는다.
- runner는 실행 전체에 20분 timeout을 적용하고 성공·실패·중단 모두 `finally`에서 누른 키·버튼·touch contact를 해제한 뒤 소유 프로세스·임시 파일을 회수한다. 기능 시나리오와 성능 측정에 같은 입력 생성 방식을 사용한다.

### 성능 시나리오와 데이터

| 시나리오 | pwsh 가상 입력 | 확인할 차이 |
| --- | --- | --- |
| Gallery 첫 하강 → 복귀 → 재하강 | 같은 좌표에서 고정 delta·간격의 세로 wheel을 정·역방향 재생 | 공통 엔진의 평균 FPS, cold 생산과 재사용 비용, 새 섹션 진입 시 긴 frame |
| 가변 높이·한글/emoji 목록 | 같은 목록·viewport에서 세로 wheel·drag를 재생 | 공통 text shaping/cache·extent 보정·layout 반복, 평균 FPS·정체 |
| datepicker 보통 → 약 2배 정방향 → 약 2배 역방향·재접촉 | 같은 거리의 touch swipe를 100/50ms 이동·60Hz로 재생하고 접촉 종료·재시작·방향 반전 | 공통 엔진 개선의 통합 효과: 평균 FPS·정체·입력 대기, 실제 page/월 진행·정착 |
| editor focus 상태에서 스크롤·resize·화면 복귀 | click·키보드 편집·wheel, Win32 창 크기 변경·복귀를 스크립트로 수행 | input geometry·semantics·cache 무효화·자원 수명 |
| 동작 종료 → 화면 이탈 → 앱 정상 종료 | 입력 종료 후 화면 이동·닫기 click 또는 정상 종료 키 입력 | 남는 optional owner·paragraph/Picture·GPU lease·입력 batch |

- 기본 비교는 시나리오별 같은 `pwsh` 가상 입력 **3회**로 시작한다. cold는 프로세스 재시작 등 조건을 통일하고 warm은 그 실행 안의 재방문으로 구별한다. 추가 반복은 변동·실패를 해소할 때만 하며 30회 이내로 제한한다.
- [FrameDiagnostics](Nelyx/src/ui/frame-diagnostics.ts)와 [FrameTrace](Nelyx/sdk/native/windows-hermes/FrameTrace.h)를 사용해 현재 Source 요청·입력 구간을 연결했다. 새 runner는 현재 Source probe를 사용하며 폐기된 Original projection을 사용하지 않는다.
- **평균 FPS = 측정 구간의 고유 프레임 완료 수 / 구간의 전체 경과 시간(초)**로 집계한다. 표시 FPS는 해당 표시 프레임의 시각·식별로, 엔진 FPS는 native surface 완료 시각·식별로 계산해 측정 경계를 명시한다. 입력 주입률 60Hz, CPU 시간의 역수, 단계별 p95의 역수로 FPS를 대신하지 않는다.
- 측정 구간은 입력·애니메이션에 따라 움직여야 하는 구간으로 미리 정한다. cold/warm과 정·역방향을 나누어 보고하고, 구간 중 긴 정체·누락된 갱신의 대기 시간도 분모에 포함한다. 진단 수집·의도된 idle은 별도 기록한다. 서로 다른 구간의 FPS를 단순 평균해 느린 구간을 가리지 않는다.
- 프레임 간격 p95/p99/최대, **50ms 초과·100ms 이상 프레임 간격**, **offset/page 진행 간격 100ms 이상 정체**의 횟수·초당 빈도·총 시간·최장 시간을 함께 기록한다. 경계·의도된 무이동은 제외 근거를 명시한다. 기존 runner의 CPU·surface 지연 결과만으로 새 평균 FPS와 정체 감소 판정을 대신하지 않도록 집계를 보완한다.
- build/layout/optional-work/paint/compose/geometry/semantics/capture/submit, 입력 dispatch 전 대기, surface fence 완료, offset/page 진행 간격을 구분한다. 중첩 구간의 시간을 더하지 않는다.
- 주입 실패·입력 수신/전달/반영 누락, trace overflow, foreground 상실, 수동 입력 간섭, 잘못된 viewport/공급이면 해당 성능 표본을 무효로 한다. 예약한 주입 시각·실제 주입 시각·앱 수신 시각을 구분하고 PowerShell 실행 지연을 앱 처리 시간에 섞지 않는다. 진단 켠 실행과 끈 실행을 섞지 않고 probe 비용을 확인한다.
- trace·CPU profile·receipt·SDK 복사본을 누적 보관하지 않는다. 비교에 필요한 숫자와 공급 식별만 이 문서의 현재 결과표에 남기고 실행 임시 데이터는 회수한다. 현재 dist와 현재 제품 패키지만 유지한다.

### 개정 수락 기준 — 평균 30fps 이상과 버벅임 감소

| 판정 | 기준 |
| --- | --- |
| 가상 입력 기능 | `pwsh`로 검증한 입력 경로에서 입력·최종 위치/월·편집·접근성·시각·자원 수명에 회귀가 없음. 생성하지 못한 입력 경로는 별도 notVerified |
| 변경 채택 | 원래 겨냥한 반복 작업/할당이 감소하고 해당 CPU 구간 또는 end-to-end 지연이 일관되게 개선됨. warm 개선을 위해 cold tail이나 live 자원을 악화시키지 않음 |
| 평균 FPS 목표 | 주요 활성 시나리오별 평균 **30fps 이상**. Gallery·가변 목록·datepicker 보통/약 2배 제스처를 각각 판정하며 빠른 화면과 합쳐 평균내지 않음. native surface 완료율만 확인했다면 **엔진 평균 FPS**로 한정하고 표시 FPS 목표는 미수락으로 남김 |
| 간헐적 버벅임 목표 | 같은 입력·측정 시간 기준으로 긴 프레임/진행 정체의 **빈도·총 시간 감소 또는 0회**를 확인. p99·최장 정체도 함께 비교해 더 긴 멈춤으로 바꾸지 않음. 기존 100ms 이상 정체 0회는 지향점으로 유지하되, 일관된 감소도 개선 성과로 수락 |
| CPU frame 보조 지표 | 평균 30fps의 시간 예산은 약 **33.3ms/frame**. Source frame CPU p95/p99/최대와 단계별 비용을 함께 보고하되, CPU p95 16.7ms 달성을 필수로 요구하지 않음. CPU 수치만으로 FPS 목표를 수락하지 않음 |
| 입력 응답 보조 지표 | 입력→native surface-copy fence 지연의 p95/p99/최대가 동일 입력에서 악화되지 않고 정체와 함께 줄어드는지 확인. 과거 p95 33.3ms·최대 66.7ms는 이력 비교용이며 이번 평균 30fps 목표의 독립 필수 조건으로 두지 않음 |
| 메모리 | 보관 한도와 producer/frame/native retire 계약 유지. 동등한 상태로 복귀한 뒤 반복마다 불필요한 resident 자원이 계속 증가하지 않음 |
| 표시·물리 범위 | 가상 입력 중 표시 프레임의 평균 FPS를 확인할 수 있는 계측 경로를 우선 연결. surface 완료율은 displayed FPS가 아니므로 표시 계측이 없으면 **표시 FPS notVerified**. scanout·물리 트랙패드 체감은 별도 notVerified이며 수동 조작을 필수 단계로 추가하지 않음 |

위 기준은 이번 계획의 목표이며 달성 사실이 아니다. 기능·성능 판정의 입력 방식은 **pwsh 가상 입력**으로 명시한다. **평균 30fps 이상과 간헐적 버벅임 감소/제거를 함께 확인**하고 기능·자원 수명 회귀가 없어야 전체 목표를 수락한다. FPS가 부족하거나 버벅임 감소가 입증되지 않으면 **PARTIAL / performanceAccepted=false**를 유지한다. 엔진 FPS만 확인한 경우에도 표시 FPS를 포함한 전체 목표 완료로 올리지 않는다. 물리 입력·scanout 미확인은 별도 기록하며 가상 입력 검증 완료의 선행 조건으로 삼지 않는다. 3회의 짧은 확인만으로 장시간 안정성·누수 부재·모든 기기 성능을 수락하지 않는다.

## 6. 우선 진행하지 않을 방향

- **datepicker 전용 원인 탐색·날짜/월 생성기 최적화부터 진행:** 공통 엔진의 프레임 실행·text/scene·layout·할당을 개선하고 datepicker를 통합 확인에 사용한다. 재현 입력을 약 2배로 정리한 것 자체를 엔진 성능 향상으로 계산하지 않는다.
- **VM 교체·JIT/AOT 비교부터 재개:** Source 생산·native 경계·회수 비용을 함께 바꾸므로 원인 분리가 어렵고 이전 비교도 전체 성능 수락에 이르지 못했다.
- **C++ Widget/scroll 정책 재도입:** 현재 Source 소유권을 다시 나누며 기존 전환 결정과 충돌한다.
- **repaint boundary·paragraph cache의 무조건 추가/확대:** 이미 있는 기능이며 현재 부족한 것은 재사용 범위·준비 비용일 수 있다.
- **모든 항목 KeepAlive·무제한 prewarm·가짜 고정 extent:** cold 비용을 다른 frame이나 live memory로 옮기고 가변 높이·focus·접근성을 바꿀 수 있다.
- **FPS 제한·입력 폐기·접근성 끄기로 수치 개선:** 실제 처리 비용과 기능 회귀를 해결하지 못한다.
- **MSAA를 추가로 낮추거나 GPU부터 교체:** 이전 2× MSAA 수정의 crash 해결과 이번 CPU 긴 frame 가설을 구분한다. renderer/GPU가 지배적이라는 현재 근거 없이 화질·기술 스택을 바꾸지 않는다.

## 7. 현재 인계 상태

**PAUSED / PARTIAL — 2026-11-16 사용자 요청으로 중간 마무리.** 구현 변경은 미커밋 상태로 보존했다. 기능 회귀의 통과 범위와 성능 목표 미달을 구분한다. 달력 긴 frame은 해결되지 않았으며 전체 개선율·FPS 상승을 주장하지 않는다.

**아래는 목표 개정 전 구현·실행의 이력이다.** 기존 FAIL은 당시 CPU p95 16.7ms·입력→surface p95 33.3ms/최대 66.7ms·진행 정체 0회 기준의 판정으로 보존한다. **평균 FPS는 측정하지 않았으므로 새 평균 30fps 목표의 PASS/FAIL로 소급 판정하지 않는다.** 새 작업 방향과 수락 기준은 §1~6을 따르며, 이번 문서 개정만으로 구현 채택이나 앱 성능 달성을 새로 수락하지 않는다.

### 반영한 변경과 후보 판단

| 작업 | 현재 변경·판단 | 확인한 경계 |
| --- | --- | --- |
| J-01 | PipelineOwner의 pass 작업 배열·callback Set 재사용, union/filter 중간 컨테이너 제거. stable depth sort와 30 pass 제한 유지 | 부모/동일 깊이 순서, 중복 callback, 재등록, 가상 getter의 다음 pass admission, suppressed route, detach·예외 복원 회귀 통과 |
| J-02A | native engine에 명시적 paragraph transaction opt-in 연결. **제품 기본 활성화는 철회** | Source 문단 12종×3회로 geometry·UTF-16 query·cache hit·dispose 확인. 일반 입력 10종은 transaction, 큰 metadata/placeholder offset 2종은 기존 builder fallback. warm CPU가 일관되게 줄지 않아 기본 off 유지 |
| J-02B | Windows direct Hermes에 `sceneBatch='paint'` 반영. path/all은 기본 미활성 | none/path/paint/all을 순서 교대 3회 비교해 CPU surface 픽셀 일치. fixture wrapper 16/13/9/6개, paint 준비 CPU 0.087~0.106ms, none warm 0.192~0.193ms. effect 자원 wrapper는 남음. 달력 end-to-end 개선은 미수락 |
| J-03 | 한 compose 호출의 구조 비교 결과 공유, 첫 command mismatch 이후만 transform 검사. 변경 없는 recorded scope의 배열 복사 제거 | shared transform identity·부모 교체·중첩 boundary·실패 복원·in-flight lease 등 retained paint 회귀 통과 |
| J-04 | builder 소유 immutable 문단 입력의 재캡처 생략, Paragraph별 마지막 요청 하나 재사용. Demo State 안에서 section wrapper Widget 재사용 | locale/toString·prototype toJSON·외부 getter 관측 유지. 편집값 theme/resize 유지. Element/State 공유·cache 용량 확대 없음 |
| J-04 보류 | bounded child/prewarm·달력 callback/생성기 변경 **DEFERRED** | cold 이익과 live 자원 증가를 함께 수락할 근거 부족. Testbed MixedScroll의 전체 mount 유지 |
| 입력 결함 | SDK 정본 `windows-hermes/Keyboard.h`에서 `VK_PACKET` key 메시지가 surrogate 조합을 초기화하지 않도록 수정 | 수정 전 `Jank 한글 `로 emoji 누락. 수정 후 Gallery 3회 모두 `Jank 한글 😀` 및 selection 유지, Ctrl+A·theme·resize·종료 통과 |
| J-05~07 | queue 정책·semantics 재사용·GC/emitter 변경 **DEFERRED** | 현재 긴 동기 layout을 안전하게 줄이는 독립 후보를 입증하지 못함. 기존 정책·접근성·회수 계약 유지 |

### 수행한 검증과 중단 범위

- `build:core`, `build:sdk`, Source framework, child reconciliation, retained paint 회귀가 통과했다. 마지막 shared-transform identity 사례 추가 후 retained paint를 다시 통과했다.
- Flutter pinned oracle `71e4717a61786faab4c7aa39825989305ed29e8a`의 실제 Dart PipelineOwner 사례를 추가했고 **25 cases PASS**. 실행: `node Nelyx/eng/check-flutter-framework.mjs --source C:/Users/parti/flutter --flutter C:/Users/parti/flutter`.
- 전체 `check:types` 11 workspaces, `lint`, `format:check`가 중간 통합 시점에 통과했다. **그 이후의 Keyboard header, 추가 probe/runner·일부 회귀 수정까지 포함한 최종 일괄 검사는 미실행**이다. 새 파일의 formatting 완료를 주장하지 않는다.
- Demo `prepare:windows`, `build:windows`, Web prepare/build가 통과했다. **제품 build:windows는 Keyboard 수정 전**이며, 수정 후에는 Gallery·달력 진단 host를 실제 재빌드해 사용했다. 기본 `run:windows`와 최종 제품 패키지 갱신은 아직 확인하지 않았다.
- native text/scene 경계 검사 최종 1세트가 native 정상 종료(exit 0)까지 통과했다. helper 실수로 실패했던 선행 시도는 수정 후 결과로 대체하며 제품 성능 PASS로 계산하지 않는다.
- Gallery는 Keyboard 수정 후 cold/return/warm wheel 각 10개, 편집·theme·resize·화면 복귀·정상 종료 **3회 통과**. 매회 `0 → 480 → 0 → 480`, 수신=전달=처리, 거부 0, 누적 wheel delta 보존. resident/producers는 같은 상태에서 매회 `57/54 → 65/57 → 65/54`, 약 90.8/103.6/103.6kB로 같았다. 이 짧은 구간만으로 누수 전체 부재를 수락하지 않는다.
- Testbed Windows 공급은 Keyboard 수정 전에 갱신했다. **수정 후 재공급과 Testbed 실행은 미실행**. `SetupTestbed` 시나리오는 작성했으나 MixedScroll 편집/버튼·가변 목록 진행의 실행 결과가 없다.
- [Web runner](Nelyx/eng/check-source-web.mjs)는 작성했으나 **실행 전 중단**했다. 로컬 Playwright는 존재하지만 root의 명시적 dependency/lock 재현성 정리는 미완료다. Web 빌드 성공을 Web 입력·시각 회귀 PASS로 간주하지 않는다.

### 가상 입력 성능 결과

환경: direct Hermes bytecode, 같은 renderer/VM supplier, 2560×1459 physical / DPR 2, logical 1280×729.5, 달력 viewport 344. 현재 화면 refresh/scanout 실측은 하지 않았다. 진단 켠 Source frame CPU와 input→surface-copy fence를 측정했다. 수치는 ms이며 percentile을 서로 합산하지 않는다.

달력 입력은 매회 6회 정방향(8 move×12ms), 6회 빠른 정방향(8×6ms), 12회 빠른 역방향(8×6ms)으로 동일하다. 실제 주입 간격은 PowerShell에서 별도 측정했다. baseline 3회, 변경 후 3회에서 각 phase의 touch down/up·move 240개와 월 정착을 확인했다. 마지막 회차는 native가 exit 0 및 `FAST_VALIDATION_PASS`/cleanup을 출력했으나, **중단 요청에 따라 최상위 검증 process tree를 종료해 명령 자체 exit 1**이다. 이를 최상위 명령 전체 PASS로 보고하지 않는다.

| 달력 구간 | 변경 전 대표 run 1 frame p95 / max | 변경 후 run 1 frame p95 / max | run 2 | run 3(상위 명령 중단) |
| --- | --- | --- | --- | --- |
| 정방향 96ms | 101.445 / 121.613 | 109.233 / 174.221 | 107.405 / 163.704 | 111.449 / 121.580 |
| 정방향 48ms | 162.784 / 177.957 | 190.923 / 195.841 | 172.031 / 198.220 | 181.830 / 210.839 |
| 역방향 48ms | 145.009 / 203.573 | 162.218 / 252.854 | 184.909 / 224.353 | 186.764 / 232.443 |

| 변경 후 달력 구간 | input→surface p95 (run 1 / 2 / 3) | surface 최대(3회 중) | layout 최대(3회 중) | 진행 간격 ≥100ms 횟수(run 1 / 2 / 3) |
| --- | --- | --- | --- | --- |
| 정방향 96ms | 287.641 / 270.350 / 237.270 | 313.641 | 129.939 | 5 / 4 / 5 |
| 정방향 48ms | 451.362 / 415.153 / 439.225 | 465.362 | 138.581 | 2 / 2 / 2 |
| 역방향 48ms | 530.599 / 532.781 / 480.478 | 576.970 | 191.573 | 4 / 4 / 4 |

달력은 매회 `November 2026(page 130) → March 2027(134) → July 2027(138) → December 2026(131)`로 정착했고 UIA 월·일 수를 대조했다. **frame·surface 지연·정체 목표 모두 FAIL**이며 변경 전보다 frame tail이 커진 표본도 있다. 현재 patch 전체의 성능 이익은 미수락이며 재개 시 후보별 유지/철회를 다시 판단해야 한다.

| 변경 후 Gallery 구간 | frame p95 범위(3회) | frame 최대 | input→surface p95 범위 | input→surface 최대 |
| --- | --- | --- | --- | --- |
| cold 하강 | 13.680~14.735 | 28.338 | 33.555~46.357 | 46.357 |
| 복귀 | 8.840~11.618 | 41.719 | 47.251~62.735 | 62.735 |
| warm 하강 | 9.919~11.104 | 16.361 | 33.278~34.688 | 34.688 |

Gallery의 CPU p95는 이 구간에서 목표 안이지만 surface p95가 목표를 벗어나는 구간이 있다. 동일 조건의 변경 전 Gallery baseline을 확보하지 않았으므로 개선율은 계산하지 않는다. 진행 정체 집계도 달력과 같은 방식으로 아직 수락하지 않았다.

공급 식별(SHA-256):

- 달력 baseline bundle `7d809ac2f3ada70e3bb8cfb6668f263488697b2d526e3aba40b8c2738dd5bb4c`, host source `9da272249184eff08392e06499546af4100233bfabd1b910e0a5e54c6e20732e`.
- 현재 달력 diagnostic bundle `2f7ac6483c34ba0a8ea5fc3d236ef8199fe8eedde29fe80346a4cf6b215c291c`, host source `f8d512323edcdfbbfa747c696df558504c1156e57415b51a2711c8ea61a90c0a`. host 차이는 Unicode 입력 수정이다. probe 진입/종료 진단도 갱신했으므로 엄밀한 동일 바이너리 비교나 개선율로 해석하지 않는다.
- renderer supplier `c4bc9a7c4da9fe55e0bc00c18c39fdf26c662cd934f0bc0c709d30592e31a754`, engine inputs `ca45f86547042c31d7069a1621457d6eaefd66d264867ee79290748a2d5331eb`.
- Gallery diagnostic bundle `fa38ad59626d6329581c6e58e46baf983a860afdcb7046c3c996b8b3231a4384`, Web static application `6c940665d8a4ae86325d925631a20342b2a31cc02e45749347881d4cf788eb19`.

diagnostic-only bundle 결과를 제품 전체 수락으로 올리지 않는다. displayed FPS·scanout·물리 trackpad/panZoom·한국어 IME 조합·screen reader·Android 실행/성능은 **notVerified**다.

### 60Hz 가상 입력 보정

2026-11-16 추가 요청 범위는 스크롤 검사의 **입력 생성기**다. 위 성능 표는 보정 전 입력의 이력이며 새 프로파일과 직접 비교해 개선율을 계산하지 않는다.

- 코드상 원인: Gallery의 `120 delta × 10개 / 90ms 간격`은 약 11Hz의 큰 계단 입력이었다. touch는 8번의 상대 `Sleep(moveMs)` 뒤에 API·스케줄러 시간이 더해졌고, wheel은 timer resolution 요청도 없었다.
- 수정: `Stopwatch` 절대 deadline과 coarse sleep/짧은 spin 대기로 누적 지연을 제거했다. wheel/touch 모두 `timeBeginPeriod(1)`을 요청하고 `finally`에서 해제한다. 입력 packet 배열은 재사용한다. foreground 상실·늦은 주입은 실패시키며 touch 오류 시 마지막 접촉도 해제한다.
- Gallery는 `24 delta × 50개 / 60Hz`로 총 ±1200 Win32 delta, ±480 logical px를 보존한다. 첫~마지막 주입 간격은 기존 810ms에서 프레임 단위 816.667ms로 조정했다. 달력의 기존 96/48ms 이동은 각각 6/3 update, 100/50ms로 반올림하며 시작·끝 좌표·방향·down/up·재접촉을 보존한다. up 직전 1ms terminal 간격은 motion cadence 계산에서 제외한다.
- runner는 실제 주입 간격과 주입/수신/처리 수를 대조한다. 작은 delta의 누적 비교는 부동소수점 허용 오차 `1e-6`을 사용한다. 엄격한 동등 비교 때문에 실패했던 선행 Gallery 검사는 이를 보완한 최종 실행으로 대체한다.
- [입력 회귀](Nelyx/eng/check-windows-input.mjs) **6 cases PASS**: 각 sender에 2ms 작업을 넣어도 59.991~60.007Hz, wheel·정/역방향 touch 경로·끝 좌표·terminal·재접촉 보존, 지연 시 burst 거부, 잘못된 시간표의 주입 전 거부를 확인했다. Win64 입력 구조체 크기도 확인했다.
- 실제 Demo Gallery **1회 PASS**: cold/return/warm 각 50개가 모두 수신·처리됐고 `0 → 480 → 0 → 480`을 유지했다. 각 phase 60.000Hz, 주입 지연 최대 0.233ms, 간격 오차 최대 0.232ms. 한글/emoji 편집·theme/resize·정상 종료 exit 0도 통과했다.
- 실제 Demo 달력 **1회 입력·기능 PASS**: 6/6/12 gesture, 각각 48/30/60개(총 138개) 모두 주입=수신=처리, 거부 0. 주입률 59.973~60.000Hz, 주입 지연 최대 0.130ms, 간격 오차 최대 0.127ms. `November 2026 → March 2027 → June 2027 → December 2026` 정착과 UIA 월/일 수, 정상 종료 exit 0을 확인했다. 새 입력에서 Source frame CPU p95는 110.097/171.221/151.775ms, input→surface p95는 270.148/385.619/415.428ms, 진행 간격 ≥100ms는 6/3/5회로 **앱 성능 목표는 여전히 FAIL**이다.
- 변경 파일의 lint·format 검사와 PowerShell 구문 검사를 통과했다. 두 최종 앱 검사 모두 최상위 명령 exit 0, entry·diagnostic package·session 파일 정리 완료. 이번에는 Testbed·Web·전체 SDK/제품 성능 작업을 재개하지 않았다.

이번 수정은 가상 입력 주입률의 보정이다. 앱의 displayed FPS·scanout·실제 precision trackpad/panZoom 수락으로 확대하지 않으며 전체 `performanceAccepted=false`를 유지한다.

```powershell
node Nelyx/eng/check-windows-input.mjs
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -Runs 1
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -Runs 1
```

### 정리와 재개 지점

- 이번 소유 검증 process tree를 종료했고 남은 native host는 없다. probe app entry·diagnostic package·session screenshot 디렉터리는 runner의 cleanup으로 회수됐다. 로그/receipt/이전 SDK 사본을 별도 누적 저장하지 않았다.
- 중간에 중단된 공급의 `packages/cupertino/.cache/sdk-jJ9K0n` staging은 남아 있다. 절대 경로와 workspace 내부 여부를 검사한 삭제 요청이 **자동 승인 검토에서 `blocked by policy`로 거절**됐다. 삭제 완료로 보고하지 않는다. 기존 실행 전부터 있던 `.tmp/calendar-fast-*` 스크립트는 보존했다.
- **재개 시:** 기존 엔진 patch별 공통 비용·할당·소유권을 코드에서 재검토하고 국소 이득만 있거나 긴 frame을 악화시킨 후보는 유지/철회를 다시 판단한다. 공통 build/layout·text/scene·composition·입력/회수 경로에서 다음 해결안을 설계·적용하며 datepicker 개별 생성기 탐색으로 시작하지 않는다. 코드 검토와 설계 뒤에는 새 평균 FPS 집계와 보통/약 2배 입력을 고정하고 동일 조건 baseline/변경 후의 FPS·정체를 비교한다. 최종 통합은 최신 변경의 format/lint/types·관련 회귀, Keyboard 반영 제품 Windows build/run, Testbed 재공급·실행, Web dependency 정리·실행·시각 확인까지 수행한다. 전체 SDK를 매번 다시 빌드하거나 완료한 동일 조건 baseline을 무조건 반복하지 않는다.
- 현재 단계는 최종 제품 수락이 아니다. `performanceAccepted=false`, 기능 통과는 위에 명시한 경로에만 한정한다.

재개용 명령(지금은 실행하지 않음): 아래 runner는 기존 입력·기능·지연 검사 진입점이다. §5의 평균 FPS·긴 프레임/정체 집계를 반영한 뒤 새 목표를 판정한다.

```powershell
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario gallery -Runs 3
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario calendar -Runs 3
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -Scenario boundaries -Runs 1
pwsh.exe -NoProfile -File Nelyx/eng/check-windows-jank.ps1 -App testbed -Scenario testbed -Runs 1
node Nelyx/eng/check-source-web.mjs
```
