# 엔진 개선으로 평균 30fps 이상·간헐적 버벅임 감소 작업계획

작성: **2026-11-16 KST** · 코드 검토 기준: **`092c393`**

상태: **PARTIAL / performanceAccepted=false — §9 새 접근 검토·구현·비교 및 최종 기본 회귀 완료**

2026-11-17 사용자의 새 아이디어 검토·새 접근법 추진 요청으로 재개했다. 현재 checkout은 `720d22d6`이며 이번 접근법·구현·비교 결과는 **§9**를 따른다. 앞선 작은 할당 최적화나 typed 함수 개수 확대를 이번 성과로 계산하지 않는다.

2026-11-16 사용자의 **“중간마무리해줘”** 요청으로 중단했던 범위는 §8 마지막 중단 기록에 보존한다. 이전 `PAUSED / PARTIAL`은 그 중단 시점의 상태다.

2026-11-16 사용자의 **“/goal work.md 작업해줘”** 요청으로 재개했다. 이전 중단 기록은 §7에 보존하며, 이번 재개의 구현·검증과 남은 수락은 **§8**에 기록한다.

이전 실행은 2026-11-16 `19940ce`에서 시작했고, 사용자의 **“일단 중간 마무리”** 요청으로 중단했다. 당시 미커밋 변경과 중단 판단은 **§7의 이력**이다. 이번 재개 checkout `63a8c748`에는 그 변경이 이미 포함돼 있었으며, 현재 실행 상태는 §8을 따른다.

이후 같은 날 사용자가 요청한 **가상 스크롤 입력의 60Hz 보정**을 별도로 진행했다. 해당 변경과 확인 결과는 §7의 **60Hz 가상 입력 보정**에 기록한다. J-01~08 전체 성능 작업의 중단·미수락 상태와 구분한다.

계획 개정: **2026-11-16 KST**. 앞선 문서 개정 때 목표·우선순위·수락 기준을 수정했다. 이후 이번 `/goal` 요청으로 엔진 구현과 성능 실행을 재개했다. §7의 **PAUSED / PARTIAL**은 이전 중단 시점에만 적용한다.

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
| §9 검토 완료, 기본 미채택 | Windows Hermes lowering의 중복 TDZ 제거를 구현·비교했다. 동작 회귀는 통과했지만 FPS·정체 이익이 일관되지 않아 **명시적 opt-in / 기본 off**로 남긴다. | 정적 helper 감소는 확인. 전체 성능 이득은 미수락 | TDZ/readonly/loop 의미 유지. 함께 발견한 compact 출력의 statement 결함만 기본 수정 |
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

상태: **코드·소유권 검토 및 새 평균 FPS·정체 기준의 변경 전/후 달력 각 3회 비교 완료(§9) / 성능 목표 미달**. 과거 입력 baseline과 이번 60Hz 비교를 구분한다.

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

실행 판단: **GC·회수 정책은 DEFERRED / 공통 lowering 후보 검토는 §8~9**. GC의 단독 인과 기여도는 확정하지 않았다. §9의 중복 TDZ 제거는 동작 동등성 검사를 통과했지만 성능 이익이 일관되지 않아 기본 off다. 강제 GC·VM 교체·generated 출력 수작업 수정은 제품 개선책으로 채택하지 않았다.

- 현재 direct host는 [main.cpp](Nelyx/sdk/native/windows-hermes/main.cpp)의 Hermes runtime을 사용한다. 로컬 CMake cache의 `HADES`·concurrent ON은 정적으로 확인했지만, 실제 로드 제품의 VM 설정·GC 기여도를 검증한 것은 아니다.
- 먼저 J-01~J-04로 제거한 임시 할당과 현재 text/Path/Paint/Picture의 producer→frame lease→native retire→wrapper finalizer 수명을 추적한다. 회수 완료 전에 메모리가 사라진 것으로 계산하지 않는다.
- 잔여 tail이 이 경로와 관련될 때만 현재 FrameDiagnostics/FrameTrace와 같은 시계에 bounded GC 진입·수거·finalizer/native retire 시간을 추가한다. 통계 밖의 pre-GC 대기 가능성과 실제 관측을 구분한다. callback 안에서는 Runtime 호출·파일 I/O·동적 할당을 하지 않는다.
- 누적 할당·live heap·native resident·GPU in-flight를 따로 본다. 단명 할당을 pool로 바꾸는 후보는 총 live bytes 증가와 세대 간 보관 비용까지 검토한다. 강제 GC, pressure accounting 제거, 무제한 pool, 무조건 큰 heap은 채택하지 않는다.
- emitter 변경은 여러 Widget의 공통 실행 코드에 같은 잉여 비용이 남고 typed IR에서 부작용·평가 순서·정수 예외 의미를 보존할 수 있는 경우에만 별도 P3 후보로 검토한다. datepicker 생성 코드만을 겨냥한 탐색·수작업 최적화는 이번 우선 범위에 넣지 않는다. 채택한다면 생성기 정본과 재생성 경로에서 수정한다.

완료 조건: 실제 남은 비용의 기여도와 변경의 이익이 설명되는 후보만 채택한다. GC 원인이 확인되지 않거나 emitter 변경 범위가 과도하면 **DEFERRED**로 종료할 수 있다.

### J-08 — 공급 반영·통합 확인·수락 기록

실행 상태: **기능·코드 회귀는 확인 범위 PASS / 전체 성능 PARTIAL**. 현재 결과는 §9다. 최종 Demo/Testbed Windows 공급에서 Gallery·가변 목록 각 3회, MixedScroll·달력 기능 각 1회, 일반 Demo 제품 build/run이 통과했다. 코드·타입·lint·format과 source-input identity도 확인했다. 달력의 30fps+정체 감소 목표는 미달이다. Web의 이전 확인은 §8 이력이며 이번 Windows Hermes 수정 후 별도 플랫폼 실행을 추가하지 않았다.

- 채택한 변경을 모아 Core/디자인/renderer/SDK와 Demo 설치 공급을 갱신한다. alias가 dist를 읽는 회귀는 Core 빌드 후 실행한다.
- native는 [정본 입력 규칙](Nelyx/skia/eng/native-source-inputs.mjs)에 따라 `Nelyx/skia/native`와 `Nelyx/engine`의 원본을 수정하고 projection을 재생성한다. `packages/native/cpp`, `generated`, 설치본만 고치지 않는다.
- host·VM·bytecode·SDK·Skia supplier·viewport/DPR/refresh를 확인한다. 변경 전후 서로 다른 공급·입력·화면을 섞어 개선율을 계산하지 않는다.
- §5의 `pwsh` 가상 입력으로 Demo/Testbed의 해당 기능·성능 시나리오를 실행한다. 물리 입력 확인을 기다리며 통합 검증을 미루지 않는다.
- 결과는 이 문서에 **채택/철회/DEFERRED, 시나리오별 평균 FPS와 측정 경계, 간헐적 정체의 빈도·총 시간·최대, 가상 입력 기능 판정, 미실행 범위**로 짧게 갱신한다. datepicker 약 2배 입력의 결과도 다른 화면과 구분한다. 과거 work11/work12의 중단 작업이나 전체 API 수락을 자동 재개하지 않는다.

## 5. 검증 계획과 실행 명령

**실행 환경은 PowerShell 7(`pwsh`)이며, Windows 앱 실행 검증의 입력은 PowerShell 스크립트에서 생성한다.** 코드 회귀·타입·lint 명령도 `pwsh`에서 구동한다. 아래는 계획과 재현 명령이며, 실행 이력은 §7~8, 최신 완료·미수락 범위는 §9를 따른다.

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

## 7. 이전 중단 시점의 인계 이력

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

## 8. 2026-11-16 재개 실행

현재 상태: **PAUSED / PARTIAL / performanceAccepted=false**. 재개 checkout은 `63a8c748`이며 시작 시 tracked 변경은 없었다. 이전 patch는 이 커밋에 포함돼 있다. 아래는 이번 재개에서 수행한 작업이며, 사용자 요청에 따른 최종 중단 범위는 이 절 마지막에 기록했다.

- J-04 공통 측정 조회: RenderBox intrinsic/dry/baseline cache hit의 compute callback 할당을 제거하고, 재귀 검사에서 stack별 key 문자열 분할을 없앴다. 같은 종류의 재귀 거부, 다른 종류의 중첩, dependency invalidation, 실패 후 재시도, null baseline·wet-size guard를 보존한다. Source·child reconciliation·retained paint 및 실제 pinned Flutter oracle이 통과했다. 전체 성능 이익은 아직 미수락이다.
- J-04 문단 준비 후보: plain span의 image resource 배열·빈 admission Map을 만들지 않으며, font catalog는 이미 engine이 캡처한 immutable ResourceId의 복사를 생략한다. 외부 ID·font getter·registry 검사는 유지한다. 이 묶음의 Core/SDK 공급·관련 회귀·Windows/Web 제품 build/run은 통과했으나 달력 성능 이익은 미수락이다.
- Windows resize 접근성 결함: native UI가 이전 viewport delta를 버리는데 SDK는 보낸 snapshot을 기준으로 다음 delta를 만들던 경로를 확인했다. 이 상태에서 `Missing/Invalid native semantics removal`로 앱이 종료되는 기준 실행이 있었다. scope 변경의 첫 게시와 종료에는 complete reset을 보내며, native는 reset의 전체 upsert·빈 removed를 검증한다. 같은 scope의 removal 검증은 유지한다. discarded packet·viewport/surface 변경·일반 delta·종료 회귀와 수정 공급의 달력/Gallery 기능 각 1회가 통과했다.
- 측정: `windows-jank-metrics.ts`에 고유 Source frame/surface 완료, 입력 시작부터 최종 이동·입력 반영 surface까지의 전체 분모, frame 간격 p95/p99/최대, >50ms/≥100ms frame·≥100ms 진행 정체의 횟수·초당 빈도·총 시간·최장을 추가했다. quiet polling과 진단 수집은 종료 뒤로 분리한다. 마지막 surface가 없으면 표본을 거부한다.
- 표시 확인: 진단 전용 `NELYX_NATIVE_SCREEN_MARKER=1`에서 native compositor surface에 Source frame 번호·sync·checksum을 그린다. 별도 pwsh/GDI sampler가 실제 composed desktop에 나타난 번호를 관측한다. 중복·scope/coverage·checksum 오류를 검사하고 **관측한 표시 FPS 하한**과 sampling 오차를 보고한다. 표식은 제품 기본 실행에서 off이며, screen capture는 scanout 관측이 아니다. 생성 trace·screenshot·진단 package는 실행 finally에서 회수한다.

예비 결과(최종 채택 비교 아님):

| 공급·범위 | 구간별 결과 | 판정 |
| --- | --- | --- |
| 재개 전 설치 공급, 새 집계·screen off, 달력 1회 | 엔진 FPS 보통 정방향 33.453 / 빠른 정방향 26.033 / 빠른 역방향 14.938. ≥100ms 진행 정체 6/4/6회, 총 793.914/641.456/1000.294ms | 달력 전체 목표 미달. 다른 startup 실패 표본은 제외. 3회 비교 baseline 미확보 |
| query+resize 수정 공급, Gallery screen on 1회 | 관측 표시 FPS 하한 cold/return/warm 72.787/61.467/60.454. ≥100ms 진행 정체 0/0/0회, >50ms 표시 frame 간격 0/0/0회. capture 562회, invalid 0, 최대 관측 간격 26.355ms | 해당 실행 기능·표시 30fps 기준 통과. 같은 조건 변경 전 Gallery 비교는 없음 |

Gallery 편집 `Jank 한글 😀`, theme/resize·화면 복귀·정상 종료 exit 0, wheel 150개 및 최종 `0→480→0→480`을 확인했다. 별도 1000Hz Hermes sampling 실행은 원인 가설을 좁히는 진단이며 성능 비교 표본에서 제외한다. sampling은 common child build/layout·ink paint 경로와 young-GC 비용을 보였지만 GC 단독 원인을 입증하지 않았다.

### 추가 layout·Focus 후보와 현재 통합 상태

- BoxConstraints 생성의 숫자 검사용 임시 배열/callback과 Flex 8개 setter의 assign closure를 제거했다. 검증·변경 시 무효화·속성 훅은 유지했다. 해당 묶음의 Source·child·retained paint, 11개 workspace 타입, lint·format은 통과했다. 같은 진단 entry/host·입력의 달력 3회 비교에서 일관된 FPS·정체 개선은 입증하지 못했다.
- 최신 공급 Gallery 3회는 표시 FPS 하한 cold **70.903/68.647/72.728**, 복귀 **59.836/60.126/60.288**, warm **59.585/59.014/58.791**였다. 모든 phase에서 >50ms 표시 frame과 ≥100ms 진행 정체는 0회였다. 한글/emoji 편집, theme·resize·복귀·정상 종료 및 150 wheel의 `0→480→0→480`·모든 입력 처리도 통과했다.
- Testbed 기존 목록은 `itemExtent=80`의 고정 높이였다. 가변 목록 성능용 entry에서만 public Source ListView와 1~4줄 한글·emoji TextButton 1,000개를 구성했다. 최신 공급 3회 표시 FPS 하한 cold **67.598/74.812/69.110**, 복귀 **58.571/62.795/59.857**, warm **54.497/54.860/56.443**. 모든 phase의 ≥100ms 진행 정체는 0회였고 UIA membership의 하강·복귀·warm 일치, 입력 보존·정상 종료가 통과했다. 원래 Testbed 목록과 MixedScroll은 이 entry로 대체하지 않았다.
- 실제 native 표시는 2560×1459 physical / DPR 2, 달력 viewport 344, Windows가 보고한 refresh **165Hz**에서 관측했다. composed desktop marker의 관측률은 표시 FPS **하한**이며 scanout이 아니다. sampler의 최대 관측 간격은 약 26~40ms라 frame 누락 가능성이 있다. 30 미만 하한만으로 실제 표시율 상한을 단정하지 않지만, 달력 engine 완료율도 목표를 벗어난다.

Focus 추가 전, 같은 60Hz 입력의 달력 결과(표시 FPS 하한):

| 구간 | Flex/constraints 수정 전 3회 | 수정 후 3회 | 수정 후 ≥100ms 진행 정체 횟수 / 총 시간(ms) / 최장(ms) |
| --- | --- | --- | --- |
| 보통 정방향 | 29.461/27.065/26.995 | 25.679/23.945/26.150 | 8/7/7 · 1065.308/994.781/1050.757 · 210.166/190.688/194.962 |
| 약 2배 정방향 | 24.912/25.957/23.841 | 25.534/25.839/23.999 | 4/5/5 · 676.930/773.163/748.556 · 236.626/200.178/200.811 |
| 약 2배 역방향 | 19.267/15.150/15.810 | 12.899/19.578/18.277 | 7/6/8 · 1161.705/1072.405/1200.316 · 234.317/285.550/192.686 |

수정 후 engine FPS는 각각 **30.910/28.166/31.591**, **28.285/31.304/25.744**, **13.645/23.785/22.434**였다. 모든 3회는 138 touch 입력 보존, `November 2026→March 2027→June 2027→December 2026` 정착과 UIA, 명령 exit 0·cleanup을 통과했다. **30fps+정체 감소 목표는 FAIL**이며 위 작은 할당 변경으로 목표를 달성했다고 판정하지 않는다.

- 별도 build 진단의 앞 두 phase는 각각 13,024/8,607 Element rebuild와 outer build scope **470.608/356.189ms**를 관측했다. 빠른 phase 문단 cache 증분은 **150 hit / 3 miss**였다. 비용은 공통 Focus·MouseRegion·Text·Ink·Semantics 생산 등에 분산됐다. native 문단 cache 확대·transaction 기본 활성화의 근거로 사용하지 않는다. 역방향은 입력 deadline 7.643ms 초과로 거부돼 이 진단 전체를 기능 PASS 또는 성능 비교 표본으로 계산하지 않는다.
- 이어 Focus.children의 매 조회 배열 복사를 현재 membership당 immutable snapshot 하나로 바꿨다. 실제 reparent/detach의 모든 Set 변경에서 즉시 무효화하며 오래된 snapshot은 바뀌지 않는다. subclass children getter·traversal과 focus flags 계산은 유지한다. 이전 snapshot 격리·foreign manager 거부·재부모화·dispose 회귀, Source·child·retained paint·타입·lint·format과 실제 pinned Flutter oracle 25 cases가 통과했고 Core를 Demo Windows/Testbed Windows/Web에 재공급했다.
- Focus 공급 달력 3회 표시 FPS 하한은 보통 **26.048/29.712/25.119**, 약 2배 정방향 **22.596/20.405/25.347**, 역방향 **14.552/18.528/14.441**였다. ≥100ms 진행 정체 횟수는 각각 **6/5/8**, **5/4/4**, **5/5/9**, 총 시간은 **881.278/772.594/1053.126ms**, **764.036/710.411/661.175ms**, **979.168/1013.180/1297.206ms**였다. 입력 138개와 월 정착·UIA·정상 종료는 모두 통과했지만 일관된 FPS·정체 개선은 입증하지 못했다. bundle `d150c002…`, 같은 entry `45e8d519…`·host `67dbdc22…`다.
- Focus 공급 Gallery 3회 표시 FPS 하한 cold **71.642/68.566/73.743**, 복귀 **59.381/58.837/59.965**, warm **58.725/60.480/59.649**, 모든 phase의 ≥100ms 진행 정체 0회였다. 편집·theme/resize·모든 입력 보존·정상 종료가 통과했다. native boundaries도 text 12 cases×3 rounds와 scene none/path/paint/all을 정상 종료까지 통과했다.
- Focus 공급의 진짜 가변 목록 3회 표시 FPS 하한 cold **71.089/74.053/73.988**, 복귀 **63.965/60.334/61.661**, warm **54.903/59.834/55.033**, 모든 phase의 ≥100ms 진행 정체 0회였다. 모든 입력 159개 보존·UIA membership 하강/복귀/warm 일치·정상 종료도 통과했다. bundle `0b4ebc34…`, 같은 entry `2e07efd9…`다.
- Web Playwright **1.64.0**을 root dependency/lock에 고정했다. 실제 canvas mouse·keyboard로 Gallery wheel/복귀, `Jank 한글 😀`, theme·폭 전환 보존, 달력 전/후월·취소 완료가 통과했다. 닫기 animation 종료 후 최신 화면도 직접 확인했다. WebGL2 SwiftShader 기능 검사이며 Web 성능 수락은 아니다. 사용한 browser/profile/screenshot·server는 finally에서 회수했다.
- Focus 공급의 Windows 제품 기본 build/run도 정상 첫 프레임·exit 0을 통과했다(bundle `b5178f5b…`, host `6c424bfd…`, VM `30355a6c…`). Web static build/runtime·시각 확인도 통과했다. Windows run의 유효 duration 전달은 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`이다. 진단 bundle과 같은 native build cache를 동시에 사용한 한 빌드는 거부됐고, 직렬 재실행이 성공했다.
- MixedScroll 최초 검사는 12개 row의 eager entry 뒤 400ms 고정 대기만 하고 Edit UIA를 읽어 실패했다. 실제 editor와 입력한 값이 UIA에 나타날 때까지 조건 대기를 추가했다. 이후 두 실행은 주입기 deadline 12.071/5.107ms 초과로 거부됐으며 기능 PASS에 포함하지 않는다.
- 주입기의 `Thread.Sleep`은 숨겨진 pwsh의 고해상도 timer resolution을 보장하지 않는다([Windows timer 설명](https://learn.microsoft.com/en-us/windows/win32/api/timeapi/nf-timeapi-timebeginperiod)). coarse sleep을 [고해상도 one-shot waitable timer](https://learn.microsoft.com/en-us/windows/win32/api/synchapi/nf-synchapi-createwaitabletimerexw)로 바꾸고 QPC 마지막 대기·60Hz absolute deadline·25% 지터 초과 거부·입력/terminal 수는 유지했다. 측정 시작 전에 blocking/spin 경로를 모두 준비하며 unnamed handle은 SafeWaitHandle로 회수한다. 변경 후 sender 작업을 포함한 **입력 6 cases PASS**, 실제 MixedScroll의 한글/emoji 편집 보존·counter 0→1·원래 고정 목록 스크롤/복귀·118개 입력 보존·정상 종료가 통과했다.

### 공통 실행 비용의 다음 후보

Source build 비용이 여러 Widget에 분산되고 기존 문단 cache가 작동하므로, 기존 같은-VM Static Hermes native 컴파일 경로를 후속 진단 후보로 선택했다. Widget/State/layout·scroll 정책과 동적 JS fallback을 유지하고 기존 guarded scalar/type-policy·전체 body/native coverage 검사를 통과한 경우에만 실행한다. §6의 VM/JIT/AOT 비교로 시작하는 방향과 달리 공통 Source/경계 후보를 먼저 적용·비교한 뒤의 검토다. 예전 다른 pin의 AOT 결과를 현재 공급의 성능 근거로 사용하지 않는다. `check-windows-jank.ps1 -HermesMode static-aot`로만 명시적으로 선택하며 기본은 bytecode다. 실제 native 동등성·기능과 같은 입력의 FPS·정체를 확인하기 전 제품 기본값을 바꾸지 않는다.

- native 컴파일의 strict 검사가 진단 entry의 미지정 타입·불완전 PaintFrame·Source/dist 중복 경로를 거부했다. 진단 타입을 실제 Core/Skia 계약에 맞추고 frame은 captureBorrowedFrame/disposeFrame으로 생성·회수하며 public native imports를 통일했다. 달력 진단의 별도 strict source graph 검사도 오류 0개다. 공통 집계는 Node와 Metro가 같은 TypeScript 파일을 사용하며 집계 회귀가 통과했다.
- 첫 native 이미지는 typed kernel **21개 미분류 / typePolicyAccepted=false / wholeAppNativeAot=false**로 실행 전에 거부됐다. 새 compiler의 `-O`가 kernel을 boundary에 inline해 named C definition을 없애는 것을 작은 독립 사례로 확인했다(기본 최적화 kernel 0개, `-fno-inline` 1개). 대응 검사를 완화하지 않고 앱 AOT의 typed/dynamic unit에만 named body 보존 정책을 추가했다. VM 내부·bytecode 정책과 공급은 유지하며 C `-O3`는 유지한다. compiler 정책 회귀와 CLI 선언 타입 검사가 통과했다.
- 수정 정책은 전체 native 대응과 실제 boundaries 실행을 통과했다. original callable **36,230 native(21 typed / 36,209 dynamic), 34 dead**, emitted **40,640 native / 0 dead**, initializer **877 native**, 미분류·미해결·동적 코드 생성 후보 **0**이며 typePolicyAccepted/wholeAppNativeAot 모두 true다. 문단 12 cases×3 rounds·scene 12개 픽셀 비교·정상 종료도 통과했다. 같은 entry(`f2abcd75…`)의 bytecode boundaries도 통과했다. native 대응의 통과는 성능 수락과 구별한다.
- 이어 실제 달력 wrapper의 사용하지 않는 반환 필드가 strict contextual type 검사에서 거부됐다. 앞선 사전 검사와 달랐던 이 반환을 실제 사용하는 helper 이름들로 맞췄다. 이 실행은 native 컴파일/달력 동작 전에 거부됐으며 FPS 표본이 아니다. 수정 후 달력 비교를 다시 진행한다.
- AOT 반복 비교는 같은 batch의 현재 compiler object만 임시 재사용한다. 입력·source·flags·toolchain hash가 일치할 때만 재사용하며 20분 batch timeout과 종료 finally에서 cache/package/entry를 모두 회수한다. 전체 SDK나 과거 cache를 복제하지 않는다.
- 제품 캡처 임시 폴더 생성/재귀 정리 복합 명령은 자동 승인 검토가 `blocked by policy`로 거부했다. 상세 이유는 제공되지 않았고 해당 명령은 실행되지 않았다. 이전 `packages/cupertino/.cache/sdk-jJ9K0n` 삭제 거부와 함께 재시도하지 않았다. 기존 진단 runner의 캡처 경로를 계속 사용한다.

현재 entry `9b550ab9…`, 같은 Source·host `67dbdc22…`·VM/toolchain `ca45f865…`와 고해상도 60Hz 주입기의 달력 비교는 다음과 같다. 모든 유효 실행은 158개 전체 입력/138개 touch 처리, 월 정착·UIA·exit 0을 통과했다. 최초 bytecode control은 Setup의 foreground guard에서 거부돼 표본에서 제외했다.

| 구간 | bytecode 표시 FPS 하한 3회 | audited AOT 표시 FPS 하한 3회 | bytecode / AOT ≥100ms 진행 정체 횟수 |
| --- | --- | --- | --- |
| 보통 정방향 | 31.544/27.593/27.595 | 30.990/27.624/26.418 | 5/7/7 · 7/5/5 |
| 약 2배 정방향 | 23.453/32.973/31.181 | 25.940/26.371/26.726 | 5/5/4 · 3/4/5 |
| 약 2배 역방향 | 15.942/13.499/16.909 | 24.105/18.132/17.842 | 7/7/9 · 7/7/5 |

AOT의 역방향 engine FPS도 **26.830/21.612/20.760**으로 30 미만이다. ≥100ms 표시 진행 정체 총 시간은 bytecode 역방향 **1079.445/1145.927/1253.313ms**, AOT **1153.233/1028.295/925.836ms**다. 일부 역방향 FPS 변화만으로 전체 목표를 수락하지 않으며 AOT는 기본 활성화하지 않는다.

### 고정 폭 객체 shape 재사용 후보

코드 검토에서 `SemanticsProperties`의 실제 own field가 **78개**이고, pinned Hermes `HiddenClass::kDictionaryThreshold`는 **64**임을 확인했다. `addProperty`는 65번째 속성에서 객체마다 별도 dictionary로 전환하며 `getHiddenClassForBuffer`와 StaticH의 리터럴 생성도 `addBufferPropertiesToHiddenClass → addProperty`를 거친다. dictionary는 리터럴 shape cache와 `makeAllReadOnly` freeze transition cache에서 제외된다. 기존 Source의 78-field 리터럴 fast path도 이 경계에 걸린다. 이 코드는 반복 생성·freeze의 중복 map 작업을 설명하지만 전체 정체의 단독 원인을 입증하지 않는다.

이 후보는 같은 pinned VM의 dictionary 전환 한도만 128개로 변경해 비교했다. 재현 가능한 supplier patch·manifest 정책/입력 hash를 사용했고 64/65/78/127/128/129/160-field 객체의 freeze/seal·descriptor·prototype·symbol·key 순서·삭제/재삽입·인스턴스 독립성, 실제 Source 값 생성, 문단·scene 검사는 통과했다. 같은 512개 생성에서 constructor는 **10.908/11.936/11.010 → 8.777/8.647/8.702ms**, 리터럴은 **2.053/3.590/4.150 → 1.377/1.326/1.400ms**였다. 해당 boundary entry는 `4536e9a0…`, app.js `41ce2890…`, bundle `2c807af5…`로 동일했다.

그러나 같은 달력 entry `9b550ab9…`/app.js `cc89835e…`/bundle `e9ca4374…`의 3회 표시 FPS 하한은 보통 **25.687/26.412/30.227**, 빠른 정방향 **24.156/28.492/25.325**, 역방향 **13.238/15.436/16.778**이었다. ≥100ms 표시 진행 정체는 각각 **6/6/6**, **4/4/5**, **6/7/7**회였다. 모든 입력 158개·월 정착·UIA·정상 종료는 통과했지만 일관된 성능 이득이 없어 **VM 한도 변경은 철회**했다. 128 공급은 `5d85ed9a…`/VM `8cf04752…`였다. pinned 64 한도로 복구·재빌드했고 임시 patch/manifest 정책도 canonical tooling에서 제거했다. fresh pinned archive+정규 patch의 전체 source tree와 최종 supplier 재검증이 통과했다. 현재 toolchain **`dbd11135911508448fb9fa66910a5d2babe590efc6b8f0106a678273d1e3d10e`**, source tree **`2cdd4ce7ff07f9c0a9a4c1ca3b5485df446a95a8efd2941b2bde0ff4bb3963a2`**, VM **`5a7a8d64…`**다. 원래 64 한도와 동일 소스/설정으로 재빌드했으며 기존 DLL과 byte 동일성은 주장하지 않는다.

별도 GC 진단은 native `heapInfo`의 `GC stats:` section을 사용한다. 최초 두 실행은 진단 파서가 collector dump/머리말을 JSON으로 읽어 첫 입력에서 실패했고, 뒤따른 foreground 이탈은 앱 종료의 결과였다. 유효 FPS 표본이 아니다. 공급 소스의 출력 형식에 맞춘 파서와 invalid-report 회귀를 추가한 뒤 진단이 정상 종료했다. 정상/빠른 정방향/역방향의 할당 증분은 약 **112.4/94.5/123.6MB**, GC pause 증분 **137.9/102.4/157.6ms**, 누적 최대 단일 GC pause **19.512ms**, 마지막 heap **60MiB**, peak live-after-GC **26.34MiB**였다. GC 기록은 32/25/33회 증가했다. 이 실행은 `performanceSample=false`이며 최대 pause 통계가 GC 전 mutex 대기를 포함하지 않으므로 GC 단독 원인이나 그 부재를 단정하지 않는다. 12월 달력의 native 화면도 직접 확인했다.

### 사용자 후속 방향: typed AOT

사용자가 같은 진행 중 **“typed aot로 하면 어떨까?”**라고 제안했다. 현재 `static-aot`의 native callable 대부분은 동적 JS 의미를 유지하며, 실제 타입 특수화는 **21개의 closed scalar kernel**뿐이다. `automaticPartition`은 receiver/property/call/new 관측을 모두 제외하므로 Source layout/child 생산 본체가 typed AOT로 내려갔다고 볼 수 없다. 다음 검토는 공통 hot path에 적용할 수 있는 typed lowering·객체/호출 경계이며 Widget/Element/State/scroll 정책은 Source에 유지한다. 임의 cast로 kernel 개수만 늘리지 않고 동적 getter·callback·잘못된 런타임 값·예외/관측 순서를 보존할 수 있는 계약을 먼저 설계한다.

선행 AOT 감사 수정의 범위도 좁혔다. pinned compiler의 `test/Optimizer/noinline-directive.js`에서 함수별 `"noinline"` 지시문을 확인했다. typed emitters의 kernel에만 지시문을 추가하고 앱 전체 `-fno-inline` 대신 표준 `-O`를 복원했다. typed kernel의 named C 대응과 기존 미분류 거부는 그대로 유지한다. 실제 compiler fixture는 지시문 없음 kernel 0개/있음 1개를 통과했다. CLI/static-aot 타입, 수정 파일 lint/format, 집계·GC 파서 회귀도 통과했다.

새 정책의 boundaries도 전체 native 대응·객체·문단·scene·정상 종료를 통과했다. original callable **32,335 native(21 typed/32,314 dynamic), 3,933 eliminated definitions**, emitted **35,217 native/5,427 eliminated definitions**, initializer **877 native**, 미분류·미해결·동적 코드 생성 후보 **0**, typePolicyAccepted/wholeAppNativeAot true다. 최적화가 없앤 callable 정의에는 inlining된 정의도 포함되므로 원본 알고리즘 전체가 dead code라는 뜻으로 해석하지 않는다. entry `4536e9a0…`, app.js `2d1a33f0…`, typed source `3218a35b…`, bundle `14759a17…`다. native 정책 **`windows-hermes-260318099.0.7-native-aot-kernel-boundary-v2`**, typed 정책 **`windows-hermes-260318099.0.7-typed-kernel-boundary-v3`**다. 성능 3회는 진행 중이며 이 변경은 typed 적용 범위 확대 자체를 뜻하지 않는다.

현재 Demo Source graph의 실제 결정은 **29,904 callables 중 21 specialize / 29,883 dynamic**이다. 20,429개는 callable shape, 9,105개는 명시적 scalar 계약 제한에 걸렸다. 후보 중 137개는 동적 관측 보존, 61개는 conditional expression 미지원 등으로 제외됐다. 21개에는 곡선/보간·좌표 변환과 상수 intrinsic 반환이 포함되며 layout/Element 생성 본체의 typed 수락으로 확대 해석하지 않는다.

내부 record를 typed class로 만드는 작은 compiler 자격 확인도 진행했다. 현재 TS frontend는 class method 반환 주석에서 `ts2flow: remaining TS node TSTypeAnnotation in FunctionExpression`으로 거부했다. 같은 타입의 내부 record를 지원되는 Flow frontend로 내리면 IR에 **PrLoad 3 / PrStore 5 / CheckedTypeCast 3**, 숫자 `FAdd`가 생성됐다. 이는 컴파일 IR의 가능성 확인이며 실제 제품 ABI·실행·성능 수락이 아니다. Source는 TypeScript에 유지하고 검증한 중간 표현을 compiler가 지원하는 typed dialect로 방출하는 경로를 검토한다. `SH.cpp`의 class cast는 object tag 수준이고 고정 슬롯 load/store를 생성하므로, 임의 JS 객체를 typed record로 cast해서 사용하면 안 된다. private factory의 provenance/owner 검증과 불일치·Proxy·예외 순서에 대한 동작 검사가 선행돼야 한다. public Widget/State를 일괄 typed class로 바꾸는 대신 Source 내부에서 닫힌 자료구조의 수명을 보존하는 계약부터 정한다. 자격 확인용 파일·폴더는 finally에서 삭제했다.

CLI/static-aot archive는 Demo Windows/Web와 Testbed Windows에 갱신했다. 최초 실행은 이전 installed CLI의 archive 경계 불일치로 시작 전에 거부됐다. Demo Windows `npm ci`는 성공했으나 Web은 변경된 전이 의존성 `hermes-estree@0.32.0`이 lock에 없어 거부됐다. 문서의 표준 install 단계로 Web/Testbed lock·설치를 갱신한 후 달력 비교를 재시작했다. 공급·설치 거부는 FPS 표본에 포함하지 않는다.

함수별 kernel 보존 정책의 달력 3회 결과는 다음과 같다. 같은 entry `9b550ab9…`, app.js `02c4b554…`, typed source `3218a35b…`, host source `67dbdc22…`·현재 64-field VM/toolchain을 사용했다. original callable **32,360 native(21 typed), 3,935 eliminated**, emitted **35,240 native/5,429 eliminated**, initializer **877 native**, 미분류·미해결 **0**이다. 모든 phase의 48/30/60 touch(총 138개), 월 정착·UIA·정상 종료가 통과했고 전체 native 입력도 각각 **159/156/157개 수신=전달=수락, 거부 0**이었다. bundle은 `8a3756d9…`/`fb79cd8b…`/`06f67fa2…`다.

| 구간 | 표시 FPS 하한 3회 | engine FPS 3회 | 표시 ≥100ms 진행 정체 횟수 / 총 시간(ms) / 최장(ms) |
| --- | --- | --- | --- |
| 보통 정방향 | 36.255/36.265/33.960 | 39.750/40.207/39.950 | 5/5/5 · 635.054/632.437/615.140 · 183.010/179.077/183.181 |
| 약 2배 정방향 | 30.133/31.935/24.620 | 35.461/37.826/27.648 | 4/4/4 · 549.029/543.334/559.917 · 188.826/180.658/183.471 |
| 약 2배 역방향 | 22.883/22.324/17.810 | 25.133/25.803/19.493 | 5/5/5 · 785.469/713.514/793.080 · 175.930/175.197/200.784 |

보통 정방향은 개선됐으나 빠른 정·역방향을 포함한 **전체 30fps+정체 목표는 FAIL**이다. compiler의 정상 inlining과 감사 대응 수정은 유지하며 제품 기본은 bytecode다. 도구 출력 한도로 첫 전체 receipt 일부가 잘렸지만, 9개 완전한 표시 phase 객체와 첫 run의 phase/exit·나머지 완전한 run 객체에서 위 값을 확인했다. 같은 검사를 반복하지 않았고, 이후 runner는 상세 결과 뒤에 작은 `JANK_COMPARISON_SUMMARY`를 추가해 최종 비교 값이 출력 제한에 사라지는 문제를 줄인다. 별도 로그·receipt 파일은 보관하지 않는다.

최종 공급의 Demo Windows 제품 `build:windows`/`run:windows -- -- 8000`는 정상 첫 프레임·종료를 통과했다. VM 재빌드 뒤 처음 build는 이전 input locator hash로 거부돼 README의 `eng/windows-inputs.mjs`로 실제 supplier를 재검증·갱신한 뒤 같은 명령을 다시 실행했다. bundle **`b5178f5b…`**, host **`642e76a2…`**, VM **`5a7a8d64…`**다. Web `check:web`/`build:web`도 통과했고 application hash **`91995298…`**는 앞서 실제 기능·시각 검사를 통과한 값과 동일하다. Web 성능·notice 전체 수락을 뜻하지 않는다.

최종 Testbed MixedScroll 회귀도 편집 `Jank 한글 😀`, counter **0→1**, 기존 고정 목록 membership **0..7→3..10**, 복귀·정상 종료를 통과했다. 입력 **118개 수신=전달=수락, 거부 0**, wheel 합계 보존을 확인했다. bundle `5ec0814b…`/entry `da79a76c…`이며 이 실행은 성능 시나리오가 아니다. 생성한 package/entry·batch compiler cache·자격 확인 폴더와 소유 native process는 종료 시 회수했고 `.tmp`의 기존 4개 파일은 보존했다.

typed 확장의 다음 계약은 **Source 내부의 닫힌 자료구조·루프를 실제 typed module로 낮추는 것**이다. closed-scalar admission을 단순 완화해 arbitrary getter/객체를 숫자나 고정 record로 cast하지 않는다. 후보는 기존 `OwnerTransaction`/`DepthQueue` 등 내부 owner 자료구조의 primitive 상태와 참조 값이며, 공개 Widget/State 정책을 SDK/native로 옮기지 않는다. 생성된 private record를 외부 JS 객체와 구분하는 provenance·owner/lifetime 검증, callback의 receiver/재진입/예외·동일 깊이 순서·GC 수명, bytecode/Web fallback을 먼저 구체화한다. 그 계약과 실제 hot-path 비용을 충족하지 못하는 작은 kernel 증가만으로 typed engine 성능 수락을 대신하지 않는다. 이 계약 검토 뒤 아래 첫 Source 내부 경로를 구현했다.

### typed Source 내부 상태의 첫 연결

- `check-typed-hermes-records.mjs`는 compiler IR만 확인하던 private record를 **실제 C SHUnit/DLL로 실행**한다. canonical VM/toolchain `dbd11135…`에서 동일한 dynamic/typed(Flow frontend) 구현이 각각 **55개 assertion**을 통과했다. fake·Proxy·다른 종류·retired token, 숫자 coercion 거부, WeakMap prototype 교체, boxed 한글/emoji 참조와 실제 VM GC 2회 이후 참조 보존을 확인했다. 고정 slot load/store와 native 숫자 덧셈도 IR에서 확인했다. weak key의 실제 회수 시점·장시간 누수나 제품 성능을 수락한 검사는 아니다.
- 첫 제품 Source 후보는 `runtime/depth-queue.ts`의 내부 저장소다. 하나의 Source factory 안에 heap·order/revision·heap 루프를 두고, `owned-factory.mjs`가 **증명한 private 숫자 상태만 typed로 낮춘다**. Element/record 필드·callback·배열 index는 boxed JS 연산이며 arbitrary 객체를 typed class/array로 cast하지 않는다. 알고리즘은 Source 한 곳에 있으며 bytecode/Web도 같은 Source body를 실행한다. public `pop → this.remove`의 receiver·override 호출을 보존한다.
- `guarded-scalars-owned-state-v3` 정책은 `@nelyxTypedFactory owned-state-v1`의 initializer·모든 scalar write·return을 검사한다. 주석 자체로 타입을 신뢰하지 않는다. 외부 lexical capture·this·nominal/asserted layout·괄호/구조 분해에 숨은 scalar write·dynamic void 반환·native adapter 이름 충돌 등 **18개 거부 사례**가 통과했다. 외부 native ABI는 factory **1개**뿐이며, 내부 함수 **9개**는 private 이름과 개별 Source-to-C range를 가진다. 부모 함수 하나의 대응으로 helper들을 포괄 수락하지 않는다.
- 실제 Source 큐의 dynamic/typed C 실행은 각각 **24개 assertion**을 통과했다. 동일 깊이 순서·깊이 변경·24-record heap 순회·중복/foreign queue·재진입·callback receiver/예외·getter 순서·string/BigInt/object index coercion·public override·GC 참조 보존을 확인했다. native 예외가 VM/image보다 먼저 회수되는 실패 경로도 확인했다. `typed-hermes-fixture.mjs`는 canonical DLL을 복사하지 않고 같은 VM을 로드하며 실행별 파일·이미지·process를 finally에서 회수한다.
- Core 재빌드 후 Source·child reconciliation·retained paint, **11개 workspace 타입**, 실제 pinned Flutter oracle **25 cases**가 통과했다. Flutter pin `71e4717a…`/installed engine `371f7720…`/Dart 3.14.0이다. Core/static-aot를 Demo Windows/Web·Testbed Windows에 공급·설치했다.
- 새 Web 공급의 `check:web`/`build:web`와 실제 Playwright 회귀가 통과했다. application **`574c483c2d9d6dd56005f8cc4e95e7c4b326c1ee913bd277ec1cdb5ba4ac3936`**, Gallery wheel/복귀·`Jank 한글 😀` 편집·theme/폭 보존·달력 전후월/닫기와 최종 화면을 확인했고 browser/profile/server/screenshot을 회수했다. Web 성능 수락은 아니다.
- 이 첫 경로는 Widget/Element/layout 전체의 typed 전환을 뜻하지 않는다. 전체 Demo native correspondence·Windows 기능·동일 입력의 FPS/정체 비교는 별도 수락 대상으로 남긴다. Source 큐 분리의 bytecode 비용까지 실제 비교하기 전 성능 이익을 주장하지 않는다.

최종 guard 보강은 현재 Source 큐의 emitted source와 callable range를 바꾸지 않는 것을 root/supplied frontend의 직접 비교로 확인했다. 해당 isolated Source hash는 `09677e32…`다. 최종 tooling을 세 runner에 재공급했으며 static-aot·CLI 선언 타입과 변경 파일 lint/format이 통과했다.

전체 Demo AOT boundaries는 initializer **877 native**, original **32,342 native(30 typed / 32,312 dynamic)·3,930 eliminated**, emitted **35,214 native·5,426 eliminated**, 미분류·미해결·동적 코드 생성 후보 **0**으로 통과했다. 30 typed 중 **기존 scalar 21 + 내부 큐 9**이며 전체 framework가 typed라는 뜻이 아니다. wide object·문단 12 cases×3·scene 12 pixel 비교·정상 종료도 통과했다. bundle `03dd16f5…`, app.js `8beb3eb9…`, typed source **`446bb314…`**, entry `4536e9a0…`다.

같은 viewport **2560×1459 / DPR 2 / 165Hz**, 같은 host `67dbdc22…`·entry `9b550ab9…`·toolchain `dbd11135…`, 60Hz·100/50ms 입력의 달력 비교 결과:

| 구간 | 큐 연결 전 AOT 표시 FPS 하한 3회 | 큐 연결 후 AOT 표시 FPS 하한 3회 | 큐 연결 후 bytecode 표시 FPS 하한 3회 |
| --- | --- | --- | --- |
| 보통 정방향 | 36.255/36.265/33.960 | **36.613/35.270/35.711** | 27.365/30.394/28.362 |
| 약 2배 정방향 | 30.133/31.935/24.620 | **31.466/28.153/34.021** | 22.798/27.475/30.516 |
| 약 2배 역방향 | 22.883/22.324/17.810 | **22.965/19.867/25.494** | 15.069/19.942/14.726 |

새 AOT engine FPS는 보통 **41.402/39.721/39.859**, 빠른 정방향 **35.938/35.173/38.886**, 역방향 **27.501/22.787/29.472**다. 역방향은 engine 완료율도 모두 30 미만이다. AOT의 ≥100ms 표시 진행 정체는 보통 **4/5/4회·504.907/612.899/507.901ms**, 빠른 정방향 **3/3/3회·454.580/477.712/449.550ms**, 역방향 **6/6/6회·923.211/954.464/918.699ms**다. 연결 전 AOT 역방향은 5/5/5회였다. **이 큐 전환만의 일관된 성능 이득이나 전체 30fps+정체 감소 목표는 수락하지 않는다.** 기본 모드는 bytecode로 유지한다.

새 AOT 달력은 original **32,367 native(30 typed / 32,337 dynamic)·3,932 eliminated**, emitted **35,237 native·5,428 eliminated**, 미분류·미해결 0을 모두 통과했다. app.js **`9a35b04e…`**, typed source `446bb314…`, 각 bundle `898af225…`/`193068b3…`/`659d2673…`다. 각 실행은 own touch **48+30+60=138개**와 월 정착 `November 2026→March 2027→June 2027→December 2026`, UIA·exit 0을 통과했다. 첫 실행의 December 화면도 직접 확인했다. native 수신=전달=수락은 156/159/783개, 거부 0이다. 3회차 phase 종료의 lastPublishedInput은 159이며 이후 총 입력 증가는 종료 뒤 review/quiet 구간이다. 그 구간의 추가 surface는 FPS 분모·분자에 포함하지 않았다. bytecode는 각 158개 입력 보존·정상 종료가 통과했다. 생성 entry/package·batch compiler cache·스크린 캡처와 소유 process는 각 실행 finally에서 회수했다.

### 사용자 요청 중단 — PAUSED / PARTIAL

2026-11-16 사용자의 **“중간마무리해줘”** 요청으로 추가 구현·성능 실행을 중단했다. 목표는 **PAUSED**, 성능 수락은 **false**이며 미커밋 변경을 보존한다. 명시적인 재개 요청 전에는 자동 재개하지 않는다.

- 새 공급의 Gallery 유효 **3회**는 표시 FPS 하한 cold **70.951/70.621/69.298**, 복귀 **59.913/59.619/61.323**, warm **58.336/60.051/58.494**, 모든 phase의 ≥100ms 진행 정체 **0회**였다. 한글/emoji 편집·theme/resize·복귀·정상 종료와 각 **177개 입력 보존·거부 0**이 통과했다. 최초 batch의 세 번째 실행은 SetupGallery에서 `Owned window lost foreground`로 거부됐으므로 제외했고, 빠진 1회만 다시 확인했다. 전경 보호 조건은 유지했다. app.js `ff82bf4c…`/bundle `2b58f0e0…`다.
- 가변 목록 **`-App testbed -Scenario list -Runs 3`**는 첫 실행의 host 준비 후 **bundle 생성 중에 중단**했다. 이번 Source 큐 연결 공급에서 가변 목록의 build 완료·실행·성능은 **미검증**이다. 중단을 엔진 실패나 기능 PASS로 계산하지 않는다.
- 당시 소유한 list 검증 child와 하위 트리를 종료했고 parent의 finally로 batch가 정리됐다. 강제 종료로 남은 이 실행의 session 폴더·`.windows-jank-probe.ts`는 절대 경로·직접 parent·symlink 여부를 확인한 뒤 회수했다. 검증 Node/NativeHost 잔류가 없고 `.tmp`는 기존 사용자 파일 4개만 남은 것을 확인했다. 기존 Testbed `build-bytecode`/host 캐시와 사용자 파일은 보존했다.
- 최신 공급의 **Testbed MixedScroll**, **일반 Demo Windows 제품 build/run**은 아직 실행하지 않았다. 앞선 성공 기록은 큐 연결 전 공급의 결과이며 이 새 Source의 제품 수락으로 승격하지 않는다. Web 새 공급의 기능·시각 확인, Source/Flutter/타입·native AOT 경계/달력과 Gallery 결과는 위 범위대로 유효하다.
- 최종 static-aot guard는 dynamic void 반환·adapter namespace 충돌까지 거부한다. 실제 큐의 생성 source/callable range가 이전 공급과 동일함을 직접 비교했고 최종 tooling을 세 runner에 재공급·설치했다. 18개 거부 검사는 실행됐으며 출력의 거부 수에 별도 namespace 사례 1개를 더하도록 집계도 바로잡았다. 집계 수정은 테스트 표시만 바꾼다.

남은 작업은 새 공급의 가변 목록·Testbed·일반 제품 Windows 회귀, 그리고 더 큰 공통 build/layout·할당 경로의 typed 내부 상태 검토/구현이다. 현재 9개 내부 큐 함수 연결만으로 일관된 성능 이득이나 **30fps+정체 감소**를 수락하지 않는다. 제품 기본은 bytecode다. Android·scanout·물리 trackpad/panZoom·한국어 IME 조합·screen reader·장시간 누수 수락도 notVerified다.

## 9. 2026-11-17 새 접근법 — lowering의 중복 TDZ 검사 제거

사용자의 새 아이디어 검토·추진 요청으로 재개했다. 이전 후보의 일부 개선과 미달 결과는 §8에 보존한다. 이번 후보는 **공통 프레임 코드가 수행하는 작업 자체를 줄이는 compiler lowering**이며 VM·Widget 정책·접근성·입력률을 바꾸지 않는다.

### 코드 근거와 대안 판단

- 현재 제품 bytecode 번들(`app.js`, 약 11.15MB)에는 `temporalRef` 문자열이 **23,305회** 나타난다. 이는 helper 정의·문자열을 포함한 정적 빈도이며 실행 횟수나 단독 병목의 증거가 아니다. 실제 `RenderObject._registerInputGeometryHooks` 등에는 이미 같은 함수 안에서 초기화하거나 검사한 지역 변수를 다시 검사하는 호출이 남는다.
- `native-es2022-transformer.cjs`는 Hermes에 `hermes-loop-tdz.cjs` → destructuring → `hermes-block-scoping.cjs` 순서를 적용한다. 기존 TDZ·const 쓰기·per-iteration capture 보정은 유지하고 그 뒤에 증명 가능한 중복 검사만 제거한다. 타입 주석이나 이름으로 initialized 상태를 추측하지 않는다.
- 대안인 render children 동기화 등록 축소는 custom Element/동기화 훅과 실패 복원의 동작 경계를 더 크게 건드린다. 무조건 cache/prewarm을 늘리면 cold 생산 비용을 다른 시점과 live 자원으로 옮긴다. 이번에는 기존 Source 알고리즘을 유지하는 lowering 후보 하나를 먼저 분리해 비교한다.

### 구현 계약

- `hermes-temporal-refs.cjs`가 Babel의 실제 helper binding과 함수별 지역 binding을 확인한다. 검사 성공 또는 primitive/fresh 값으로 sentinel이 아님을 증명한 뒤의 검사만 제거한다. 읽기 전용 closure capture는 값 identity를 바꾸지 않지만, 외부 closure/class에서 쓸 수 있는 binding·sloppy arguments와 연결된 parameter는 제외한다. 모듈의 eval/with는 전체 fallback이다.
- 알 수 없는 쓰기는 증명을 폐기한다. if/조건식/단락식은 도달 가능한 경로의 교집합만 유지한다. loop의 반복 진입·break/continue, try/catch/finally와 switch의 진입은 빈 증명에서 시작한다. optional chain·spread·class evaluation·suspension·delete 등 미지원 표현은 기존 검사를 유지한다. 특히 `delete helper(x)`를 `delete x`로 바꾸지 않는다.
- 기존 native transformer cache identity에 새 pass의 source hash를 포함하고 Hermes transformer policy를 `/v2`로 구별했다. V8/JSC/Web/Android에는 이 Hermes pass를 실행하지 않는다. static-aot도 기존 upstream lowering을 사용하므로 전체 callable 대응은 별도 수락 대상이다.
- `check-hermes-temporal-refs.mjs`는 control/후보의 실제 동작·TDZ/readonly 예외·쓰기/캡처·분기·루프·receiver·예외 경계를 비교한다. 실제 Windows Hermes VM/SHUnit 검사는 `--native`로 수행하며 파일·image/process는 기존 fixture의 finally에서 회수한다.

### 이번 실행 결과

이번 접근의 **구현·비교·최종 기본 회귀는 완료**, 전체 성능 목표는 **PARTIAL / performanceAccepted=false**다. 변경 전 달력 3회 → 후보 회귀와 공급 → 같은 60Hz·100/50ms 달력 3회를 비교했다. 후보의 기본 활성화는 철회했고 최종 기본 공급의 Gallery/가변 목록 각 3회·MixedScroll/달력 기능 각 1회·일반 Demo 제품 build/run까지 확인했다. 각각의 입력·공급·측정 경계와 수치는 아래를 따른다. 이전 중단에서 남았던 회귀를 확인한 범위와 달력 성능 미달을 구분한다.

변경 전 bytecode 공급의 유효 달력 **3회**는 모두 138개 touch·월 정착·UIA·입력 156개 수신=전달=수락·거부 0·exit 0·cleanup을 통과했다. viewport는 2560×1459 physical / DPR 2 / Windows 보고 165Hz다. entry `9b550ab9…`, app.js `c749bbd4…`, bundle `972b7302…`, host `67dbdc22…`, toolchain `dbd11135…`이며 세 실행의 공급 식별은 같다.

| 구간 | 변경 전 표시 FPS 하한 3회 | 변경 전 engine FPS 3회 | 표시 ≥100ms 진행 정체 횟수 / 총 시간(ms) / 최장(ms) |
| --- | --- | --- | --- |
| 보통 정방향 | 35.148/26.377/26.558 | 38.258/32.423/32.894 | 6/7/7 · 871.976/915.751/909.452 · 209.425/195.868/188.190 |
| 약 2배 정방향 | 28.513/23.865/23.702 | 31.361/29.416/27.705 | 4/4/5 · 646.804/675.761/808.908 · 230.020/210.474/211.717 |
| 약 2배 역방향 | 14.974/9.720/20.844 | 16.343/9.785/24.208 | 6/6/7 · 1120.860/1078.362/1070.551 · 205.208/286.956/201.314 |

정적 control/후보 검사와 실제 canonical Hermes SHUnit 실행은 각각 raw **31개**·실제 lexical lowering **15개** assertion의 결과가 같다. eval·교체된 helper·sloppy parameter alias의 fallback도 확인했다. 현재 실제 Core `framework.js`의 local helper 248개 중 **50개**, `object.js`의 633개 중 **164개**를 제거한다. 전체 번들의 실행 빈도·FPS 이익은 이 개수로 환산하지 않는다.

전체 Source 회귀를 실제 native transformer에 통과시키는 `check-source-framework.mjs --hermes-lowering`도 추가했다. 첫 검사는 큰 파일의 compact 생성에서 `…temporalRef(index)index++` 문법 오류로 거부됐다. pinned Babel `validation.js`는 UpdateExpression 앞에 ExpressionStatement 대신 raw helper expression을 삽입한다. 기존 pretty 출력은 줄바꿈으로 구분되지만 compact 출력에서는 사라진다. block lowering 종료 시 Program/Block/SwitchCase의 raw expression을 정식 statement로 감싸 AST 경계를 복구했다. compact loop 사례의 Node/실제 Hermes control·후보가 통과했고, **전체 Source lowering 회귀 20 cases PASS**(local helper 8,592개 중 2,450개 제거)로 확인했다. 이 오류는 FPS 표본이 아니며 TDZ 검사를 끄는 방식으로 해결하지 않았다.

child reconciliation·retained paint 회귀, 11개 workspace 타입·lint·format도 통과했다. Source harness 확장·AST statement 보강·최종 opt-in gate 후 lint/format도 다시 통과했다. 실제 VM/fixture 파일·이미지·소유 process는 기존 finally로 회수했다. Demo/Testbed Windows의 Metro 최종 공급·설치를 완료했다. 전체 Source lowering 회귀는 Node에서 native transformer의 결과를 실행한 검사이며, 실제 VM 실행 46개 assertion 및 Windows 통합 입력과 구분한다.

후보를 켠 bytecode 달력 **3회**의 비교 결과는 다음과 같다. 같은 entry·host source·toolchain·viewport·60Hz/100·50ms 입력을 사용했다. app.js **`23202d17…`**, bundle **`9bf81426…`**는 세 실행 모두 같다. 모든 138개 touch와 월 정착 `November 2026→March 2027→June 2027→December 2026`, UIA·입력 156/158/157개 수신=전달=수락·거부 0·exit 0·cleanup을 통과했다.

| 구간 | 후보 표시 FPS 하한 3회 | 후보 engine FPS 3회 | 표시 ≥100ms 진행 정체 횟수 / 총 시간(ms) / 최장(ms) |
| --- | --- | --- | --- |
| 보통 정방향 | 26.051/27.639/29.023 | 29.452/32.744/32.445 | 6/7/8 · 901.153/900.369/1025.343 · 210.556/198.142/204.030 |
| 약 2배 정방향 | 23.048/30.241/22.937 | 26.784/35.778/26.966 | 5/4/5 · 783.388/670.328/708.467 · 222.660/251.990/204.824 |
| 약 2배 역방향 | 15.616/15.013/17.679 | 17.123/16.486/19.092 | 7/6/7 · 1050.340/982.528/1060.127 · 187.925/197.003/180.837 |

**판정: 중복 TDZ 제거의 기본 활성화는 채택하지 않는다.** 정적 검사와 helper 호출은 줄었지만 FPS·정체에 일관된 이익을 입증하지 못했고 전체 30fps 목표도 미달이다. 제품 기본은 **bytecode + pruning off**다. 새 pass는 boolean transformer 옵션 `customTransformOptions.nelyxTemporalRefOptimization: true`로만 선택하는 실험 경로로 남기며 string 등 잘못된 옵션은 거부한다. 기본값과 명시적 false의 생성 코드 일치, true에서만 제거가 일어나는 것, 세 경로의 compact 실행과 동작 결과가 같음을 회귀로 고정했다. AST statement 정규화는 문법 결함 수정이므로 기본 경로에 유지한다. 앞선 후보-on 성능 수치를 최종 기본 공급의 결과로 바꾸어 기록하지 않는다.

### 최종 기본 공급 회귀와 다음 설계

최종 **pruning off** 공급 Gallery **3회**의 표시 FPS 하한은 cold **72.512/74.048/71.303**, 복귀 **58.477/60.042/61.136**, warm **59.071/60.069/60.177**였다. 모든 phase의 ≥100ms 진행 정체는 **0회**다. 한글/emoji 편집·theme/resize·복귀·정상 종료와 각 **177개 입력 수신=전달=수락, 거부 0**이 통과했다. app.js `9aed79d6…` / bundle `d380e324…` / entry `54827ed9…`이며 세 실행의 공급 식별이 같다. 이 수치는 후보-on 개선율의 근거로 사용하지 않는다.

같은 최종 기본 공급의 진짜 가변 목록 **3회**는 표시 FPS 하한 cold **71.059/72.417/72.842**, 복귀 **58.978/59.902/58.612**, warm **58.801/57.670/58.376**였다. 모든 phase의 ≥100ms 진행 정체는 **0회**, 입력 **160/159/159개 수신=전달=수락·거부 0**, UIA membership 하강·복귀·warm 일치와 정상 종료가 통과했다. app.js `30ea1d2a…` / bundle `926e5982…` / entry `e10a726f…`다. §8 중단 시 남았던 큐 연결 후 공급의 가변 목록 수락은 이 범위에서 확인했으며, 달력 미달과 합쳐 전체 성능 목표를 PASS로 만들지 않는다.

최종 기본 공급 **MixedScroll 1회**는 한글/emoji 편집 보존·counter 0→1·목록 membership 하강/복귀·입력 **118개 수신=전달=수락, 거부 0**·wheel 합계 보존·정상 종료가 통과했다. bundle `8ff3e8b…` / entry `da79a76c…`다. 이는 성능 시나리오가 아니다.

최종 기본 **달력 기능 1회**도 138개 touch·월 정착·UIA·입력 158개 보존·정상 종료가 통과했다. 표시 FPS 하한은 보통/빠른 정방향/역방향 **31.056/24.516/14.827**, engine FPS는 **32.322/28.733/16.262**, ≥100ms 표시 진행 정체는 **8/5/7회**, 총 시간 **1035.743/820.245/1154.863ms**였다. app.js `086877b0…` / bundle `d84b9452…`다. 최종 기본 공급에서도 목표 미달이며, 이 1회는 후보-on 3회의 성능 수락을 대신하지 않는다.

일반 Demo의 문서 명령 `npm.cmd run build:windows --workspace @nelyx/demo` 및 `npm.cmd run run:windows --workspace @nelyx/demo -- -- 8000`은 정상 첫 프레임·exit 0·forced=false를 통과했다. bundle **`ba0939e9…`**, host **`619460b0…`**, VM **`5a7a8d64…`**다. 기본 mode는 bytecode이며 `sceneBatch=paint`, paragraph transactions off 등 기존 제품 설정을 유지했다. 이 짧은 기본 실행은 성능 수락이 아니다.

최종 Core/SDK/Material/Cupertino dist의 source-input identity를 재확인했다. 생성한 fixture/image·진단 entry/package·batch/session·소유 process는 회수했고 `.tmp`의 기존 사용자 파일 4개는 보존했다. Web/Android/V8/JSC는 이 Windows Hermes pass를 실행하지 않으며 이번 수정 후 별도 플랫폼 실행은 하지 않았다. 전체 Demo AOT correspondence·scanout·물리 trackpad/panZoom·IME 조합·screen reader·장시간 누수 수락도 이번 결과로 올리지 않는다.

다음 공통 엔진 후보는 **실제 구조 변경에 따른 render children 동기화 등록**이다. 현재 `Element.rebuild`는 속성만 바뀌는 갱신에도 nearest render owner를 등록하고, 각 isolated scope 경계에서 `OwnerTransaction`이 depth 정렬·동기화를 수행한다. 기존 mount/slot/attach 경로의 직접 구조 변경과 겹치는 비용을 검토한다. 구현 전에 built-in 경로의 insert/move/remove admission, custom Element/동기화 훅의 기존 관측, 실패한 commit의 재시도·다음 경계 재등록을 함께 보존하는 계약이 필요하다. **이번 실행에서 이 후속 Source 변경은 구현하지 않았다.** 중복 검사 제거가 단독 성능 해법이 아니라는 이번 결과를 근거로 더 작은 scalar/검사 제거를 연속 확대하지 않는다.

후속 [원인 분석 문서](performance-cause-analysis.md)에 월 변경→기존 자식 갱신→layout 중 새 페이지 생산·회수 경로와 남은 가설을 정리했다. 현재 owner `Set` 중복 제거·동일 자식 fast path가 이미 있으므로 rebuild 횟수를 실제 구조 commit 횟수로 해석하지 않는다. 동기화 등록 축소의 시간 비중과 cold 생산 개선 효과는 미확정이며, 역방향은 제스처 수·이동량이 달라 방향 결함으로 단정하지 않는다. 이 문서 작성에서는 후속 Source 수정이나 추가 성능 실행을 하지 않았다.
